/// <reference types="@cloudflare/workers-types" />

/*
 * The 65% Rule — PayU Hosted Checkout Worker
 *
 * Secrets are injected by Cloudflare Workers:
 *   PAYU_KEY  (merchant key)
 *   PAYU_SALT (merchant salt — never expose this to the browser or Git)
 *
 * The Worker serves Astro's static `dist/` assets and handles only:
 *   GET  /buy          buyer details form
 *   POST /buy          creates a signed PayU Hosted Checkout form
 *   POST /payu/return  reverse-hash + Verify Payment API reconciliation
 */

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PAYU_KEY?: string;
  PAYU_SALT?: string;
  PAYU_ENV?: 'test' | 'production';
  SITE_URL?: string;
  MAIL_WEBHOOK_URL?: string;
  MAIL_WEBHOOK_SECRET?: string;
}

type Values = Record<string, string>;

const PRICE = '199.00';
const PRODUCT_INFO = 'The 65 Percent Rule - First Edition';
const PRODUCT_SLUG = 'the-65-percent-rule';

// Google Analytics 4 (book.vardoxstudio.com property).
const GA4_ID = 'G-8BLY3BHGM8';
const GA4_CURRENCY = 'INR';
const GA4_VALUE = 199;
const GA4_ITEM = {
  item_id: PRODUCT_SLUG,
  item_name: 'The 65% Rule — Digital First Edition',
  price: 199,
  quantity: 1,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/buy' || url.pathname === '/buy/') {
      if (request.method === 'GET') return checkoutPage(env);
      if (request.method === 'POST') return startCheckout(request, env);
      return methodNotAllowed('GET, POST');
    }

    if (url.pathname === '/payu/return') {
      if (request.method === 'POST') return handlePayuReturn(request, env);
      return paymentPage({
        title: 'Return to checkout',
        eyebrow: 'PAYMENT',
        message: 'This page receives payment results directly from PayU.',
        actionLabel: 'Return to the book',
        actionHref: origin(env, url),
        tone: 'neutral',
      });
    }

    return env.ASSETS.fetch(request);
  },
};

async function checkoutPage(env: Env): Promise<Response> {
  const configurationError = missingConfig(env);
  if (configurationError) return configurationError;

  const isTest = environment(env) === 'test';
  const base = origin(env);
  const testNotice = isTest
    ? '<p class="notice"><strong>Test mode.</strong> No real payment should be made until production credentials are configured.</p>'
    : '';

  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Checkout · The 65% Rule</title>
    <style>${pageStyles()}</style>
    ${gaTag()}
  </head>
  <body>
    <main class="shell">
      <a class="brand" href="${escapeHtml(base)}" aria-label="Return to The 65% Rule">
        <span>THE</span><em>65%</em><span>RULE</span>
      </a>
      <section class="card" aria-labelledby="checkout-title">
        <p class="eyebrow">FIRST EDITION · SECURE CHECKOUT</p>
        <h1 id="checkout-title">One quiet decision.<br /><i>A different next step.</i></h1>
        <div class="order"><span>The 65% Rule · Digital First Edition</span><strong>₹199</strong></div>
        ${testNotice}
        <form method="post" action="/buy" novalidate>
          <label>First name
            <input name="firstname" autocomplete="given-name" maxlength="60" required />
          </label>
          <label>Email address
            <input name="email" type="email" autocomplete="email" maxlength="100" required />
          </label>
          <label>Mobile number
            <input name="phone" type="tel" inputmode="numeric" autocomplete="tel" minlength="10" maxlength="15" required />
          </label>
          <button type="submit">Continue securely to PayU <span>→</span></button>
        </form>
        <p class="fineprint">Payments are completed on PayU's secure checkout. We do not see or store card, UPI or banking details.</p>
      </section>
      <p class="back"><a href="${escapeHtml(base)}">← Back to the book</a></p>
    </main>
    <script>
      document.querySelector('form')?.addEventListener('submit', function () {
        if (window.gtag) gtag('event', 'begin_checkout', {
          currency: '${GA4_CURRENCY}',
          value: ${GA4_VALUE},
          items: [${JSON.stringify(GA4_ITEM)}],
        });
      });
    </script>
  </body>
</html>`);
}

async function startCheckout(request: Request, env: Env): Promise<Response> {
  const configurationError = missingConfig(env);
  if (configurationError) return configurationError;

  const form = await request.formData();
  const firstname = value(form, 'firstname').replace(/\s+/g, ' ').slice(0, 60);
  const email = value(form, 'email').toLowerCase().slice(0, 100);
  const phone = value(form, 'phone').replace(/\D/g, '').slice(0, 15);

  if (!/^[\p{L}][\p{L}\p{M}\s'.-]{0,59}$/u.test(firstname)) {
    return checkoutError(env, 'Please enter a valid first name.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return checkoutError(env, 'Please enter a valid email address.');
  }
  if (!/^\d{10,15}$/.test(phone)) {
    return checkoutError(env, 'Please enter a valid mobile number.');
  }

  const base = origin(env, new URL(request.url));
  const txnid = transactionId();
  const fields: Values = {
    key: env.PAYU_KEY!.trim(),
    txnid,
    amount: PRICE,
    productinfo: PRODUCT_INFO,
    firstname,
    email,
    phone,
    surl: `${base}/payu/return`,
    furl: `${base}/payu/return`,
    curl: `${base}/payu/return`,
    udf1: PRODUCT_SLUG,
    udf2: 'first-edition',
    udf3: '',
    udf4: '',
    udf5: '',
    pg: '',
    bankcode: '',
  };

  fields.hash = await requestHash(fields, env.PAYU_SALT!.trim());
  const endpoint = environment(env) === 'production'
    ? 'https://secure.payu.in/_payment'
    : 'https://test.payu.in/_payment';

  const inputs = Object.entries(fields)
    .map(([name, fieldValue]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(fieldValue)}" />`)
    .join('\n');

  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Redirecting to secure checkout · The 65% Rule</title>
    <style>${pageStyles()}</style>
  </head>
  <body>
    <main class="shell redirect">
      <p class="eyebrow">SECURE CHECKOUT</p>
      <h1>Taking you to <i>PayU.</i></h1>
      <p>Please wait a moment. Your order total is locked at <strong>₹199</strong>.</p>
      <form id="payu-form" method="post" action="${endpoint}">${inputs}</form>
      <button id="continue" type="submit" form="payu-form">Continue to secure checkout <span>→</span></button>
      <p class="fineprint">If you are not redirected automatically, use the button above.</p>
    </main>
    <script>document.getElementById('payu-form').submit();</script>
  </body>
</html>`);
}

async function handlePayuReturn(request: Request, env: Env): Promise<Response> {
  const configurationError = missingConfig(env);
  if (configurationError) return configurationError;

  const response = toValues(await request.formData());
  const expectedKey = env.PAYU_KEY!.trim();
  const responseHash = response.hash || '';
  const responseLooksValid = response.key === expectedKey
    && response.txnid
    && response.amount === PRICE
    && response.productinfo === PRODUCT_INFO
    && await validResponseHash(response, env.PAYU_SALT!.trim(), responseHash);

  if (!responseLooksValid) {
    return paymentPage({
      title: 'We could not verify that payment',
      eyebrow: 'PAYMENT CHECK',
      message: 'For your protection, this result was not accepted. If money was debited, please wait a few minutes and contact support with your PayU reference.',
      actionLabel: 'Try checkout again',
      actionHref: '/buy',
      tone: 'error',
    });
  }

  const status = response.status.toLowerCase();
  if (status === 'success') {
    const verified = await verifyPayment(env, response.txnid);
    if (verified) {
      await recordOrder(env, response);
      const mailed = await deliverBook(env, {
        email: response.email || '',
        firstname: response.firstname || '',
        txnid: response.txnid || '',
      });
      return paymentPage({
        title: 'Payment verified.',
        eyebrow: 'THE 65% RULE · FIRST EDITION',
        message: mailed
          ? `Thank you. Your payment has been verified and your digital copy of The 65% Rule has been emailed to ${response.email || 'your email'}. Keep this order reference for your records.`
          : `Thank you. Your payment has been verified securely with PayU. Your digital copy of The 65% Rule will be delivered to ${response.email || 'your email'}. Keep this order reference for your records.`,
        reference: response.txnid,
        actionLabel: 'Return to the book',
        actionHref: origin(env, new URL(request.url)),
        tone: 'success',
      });
    }

    return paymentPage({
      title: 'Your payment is being confirmed.',
      eyebrow: 'PAYMENT CHECK',
      message: 'PayU reported a successful payment, but final reconciliation is still in progress. Do not pay again. Keep your order reference and contact support if it is not confirmed shortly.',
      reference: response.txnid,
      actionLabel: 'Return to the book',
      actionHref: origin(env, new URL(request.url)),
      tone: 'neutral',
    });
  }

  return paymentPage({
    title: status === 'pending' ? 'Your payment is pending.' : 'Payment was not completed.',
    eyebrow: 'PAYMENT',
    message: status === 'pending'
      ? 'PayU is still waiting for confirmation. Do not try again until you have checked your bank or UPI app.'
      : 'No payment has been confirmed. You can return to checkout whenever you are ready.',
    reference: response.txnid,
    actionLabel: 'Return to checkout',
    actionHref: '/buy',
    tone: 'error',
  });
}

async function recordOrder(env: Env, params: Values): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO orders (txnid, email, firstname, phone, amount, status, paid_at, mihpayid)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
    )
      .bind(
        params.txnid || '',
        params.email || '',
        params.firstname || '',
        params.phone || '',
        params.amount || PRICE,
        new Date().toISOString(),
        params.mihpayid || '',
      )
      .run();
  } catch (error) {
    console.error('recordOrder failed', error);
  }
}

/** Fire the Apps Script webhook that emails the book from the owner's Gmail. */
async function deliverBook(env: Env, order: { email: string; firstname: string; txnid: string }): Promise<boolean> {
  if (!env.MAIL_WEBHOOK_URL || !env.MAIL_WEBHOOK_SECRET) return false;
  try {
    const result = await fetch(env.MAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: env.MAIL_WEBHOOK_SECRET,
        email: order.email,
        firstname: order.firstname,
        txnid: order.txnid,
        amount: PRICE,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await result.json() as { ok?: boolean };
    const mailed = result.ok && data.ok === true;
    if (mailed && env.DB && order.txnid) {
      try {
        await env.DB.prepare('UPDATE orders SET delivered = 1, delivered_at = ? WHERE txnid = ?')
          .bind(new Date().toISOString(), order.txnid)
          .run();
      } catch (e) {
        console.error('markDelivered failed', e);
      }
    }
    return mailed;
  } catch (error) {
    console.error('deliverBook failed', error);
    return false;
  }
}

async function verifyPayment(env: Env, txnid: string): Promise<boolean> {
  const key = env.PAYU_KEY!.trim();
  const salt = env.PAYU_SALT!.trim();
  const command = 'verify_payment';
  const hash = await sha512([key, command, txnid, salt].join('|'));
  const endpoint = environment(env) === 'production'
    ? 'https://info.payu.in/merchant/postservice.php?form=2'
    : 'https://test.payu.in/merchant/postservice.php?form=2';

  try {
    const body = new URLSearchParams({ key, command, var1: txnid, hash });
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!result.ok) return false;
    const payload = await result.json() as { status?: number; transaction_details?: Record<string, Values> };
    if (payload.status !== 1) return false;
    const transaction = payload.transaction_details?.[txnid];
    if (!transaction) return false;
    const amount = transaction.amt || transaction.transaction_amount || transaction.amount || '';
    return transaction.status?.toLowerCase() === 'success'
      && amount === PRICE
      && transaction.productinfo === PRODUCT_INFO;
  } catch {
    return false;
  }
}

async function requestHash(fields: Values, salt: string): Promise<string> {
  // PayU Hosted Checkout v1:
  // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  const values = [
    fields.key, fields.txnid, fields.amount, fields.productinfo, fields.firstname, fields.email,
    fields.udf1, fields.udf2, fields.udf3, fields.udf4, fields.udf5,
    '', '', '', '', '', salt,
  ];
  return sha512(values.join('|'));
}

async function responseHashString(params: Values, salt: string): Promise<string> {
  // Reverse hash: SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  // additional_charges, when supplied, becomes a prefix before SALT.
  const values = [
    salt,
    params.status || '',
    '', '', '', '', '',
    params.udf5 || '', params.udf4 || '', params.udf3 || '', params.udf2 || '', params.udf1 || '',
    params.email || '', params.firstname || '', params.productinfo || '', params.amount || '',
    params.txnid || '', params.key || '',
  ];
  const additionalCharges = params.additional_charges || params.additionalCharges;
  if (additionalCharges) values.unshift(additionalCharges);
  return sha512(values.join('|'));
}

async function validResponseHash(params: Values, salt: string, receivedHash: string): Promise<boolean> {
  return timingSafeEqual(await responseHashString(params, salt), receivedHash.toLowerCase());
}

function environment(env: Env): 'test' | 'production' {
  return env.PAYU_ENV === 'production' ? 'production' : 'test';
}

function origin(env: Env, fallback?: URL): string {
  return (env.SITE_URL || fallback?.origin || '').replace(/\/$/, '');
}

function transactionId(): string {
  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  return `T65${Date.now().toString(36)}${token}`.slice(0, 25);
}

async function sha512(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-512', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let i = 0; i < left.length; i += 1) different |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return different === 0;
}

function missingConfig(env: Env): Response | null {
  if (env.PAYU_KEY?.trim() && env.PAYU_SALT?.trim() && origin(env)) return null;
  return paymentPage({
    title: 'Checkout is being prepared.',
    eyebrow: 'THE 65% RULE',
    message: 'Secure payment is not configured yet. Please return shortly.',
    actionLabel: 'Return to the book',
    actionHref: '/',
    tone: 'neutral',
    status: 503,
  });
}

function checkoutError(env: Env, message: string): Response {
  return paymentPage({
    title: 'A small correction.',
    eyebrow: 'CHECKOUT',
    message,
    actionLabel: 'Return to checkout',
    actionHref: '/buy',
    tone: 'error',
  });
}

function paymentPage(options: {
  title: string;
  eyebrow: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  tone: 'success' | 'error' | 'neutral';
  reference?: string;
  status?: number;
}): Response {
  const icon = options.tone === 'success' ? '✓' : options.tone === 'error' ? '!' : '·';
  const purchaseScript = options.tone === 'success' && options.reference
    ? `gtag('event', 'purchase', {
        currency: '${GA4_CURRENCY}',
        value: ${GA4_VALUE},
        transaction_id: ${JSON.stringify(options.reference)},
        items: [${JSON.stringify(GA4_ITEM)}],
      });`
    : '';
  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(options.title)} · The 65% Rule</title>
    <style>${pageStyles()}</style>
    ${gaTag(purchaseScript)}
  </head>
  <body>
    <main class="shell result ${options.tone}">
      <div class="result-icon">${icon}</div>
      <p class="eyebrow">${escapeHtml(options.eyebrow)}</p>
      <h1>${escapeHtml(options.title)}</h1>
      <p>${escapeHtml(options.message)}</p>
      ${options.reference ? `<p class="reference">ORDER REFERENCE <strong>${escapeHtml(options.reference)}</strong></p>` : ''}
      <a class="button" href="${escapeHtml(options.actionHref)}">${escapeHtml(options.actionLabel)} <span>→</span></a>
    </main>
  </body>
</html>`, options.status ?? 200);
}

function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    },
  });
}

/** Google tag (gtag.js) head snippet for GA4. `extraScript` (optional) is
 *  injected after gtag('config') — used for the `purchase` event. */
function gaTag(extraScript = ''): string {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA4_ID}');
      ${extraScript}
    </script>`;
}

function methodNotAllowed(allow: string): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow } });
}

function value(form: FormData, key: string): string {
  const item = form.get(key);
  return typeof item === 'string' ? item.trim() : '';
}

function toValues(form: FormData): Values {
  const values: Values = {};
  for (const [key, item] of form.entries()) if (typeof item === 'string') values[key] = item;
  return values;
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char] || char));
}

function pageStyles(): string {
  return `
    :root { color-scheme: dark; --ink:#0f0c09; --ink2:#1b140d; --gold:#d9b878; --brass:#b8925a; --cream:#f4efe4; --muted:#b3a68f; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(900px 500px at 50% -15%,rgba(184,146,90,.18),transparent 62%),var(--ink); color:var(--cream); font-family:Inter,ui-sans-serif,system-ui,sans-serif; line-height:1.55; }
    .shell { width:min(100% - 2rem, 540px); padding:2.5rem 0; } .brand { display:inline-flex; align-items:baseline; gap:.55rem; color:var(--cream); text-decoration:none; font-size:.76rem; letter-spacing:.25em; font-weight:700; } .brand em { color:var(--gold); font-family:Georgia,serif; font-size:1.65rem; letter-spacing:0; font-style:italic; transform:translateY(2px); }
    .card { margin-top:1.7rem; padding:clamp(1.5rem,6vw,2.5rem); border:1px solid rgba(184,146,90,.28); border-radius:10px; background:linear-gradient(145deg,rgba(33,26,18,.97),rgba(15,12,9,.98)); box-shadow:0 28px 60px -28px #000; } .eyebrow { color:var(--gold); letter-spacing:.24em; font-size:.68rem; font-family:ui-monospace,monospace; margin:0 0 1rem; } h1 { margin:0 0 1.2rem; font-family:Georgia,serif; font-size:clamp(2rem,7vw,3rem); line-height:1.1; } h1 i { color:var(--gold); font-weight:normal; } .order { display:flex; justify-content:space-between; gap:1rem; padding:1rem 0; border-block:1px solid rgba(184,146,90,.24); color:var(--muted); } .order strong { color:var(--gold); font-family:Georgia,serif; font-size:1.3rem; }
    form { margin-top:1.45rem; } label { display:block; font-size:.84rem; color:var(--cream); margin:1rem 0; } input { display:block; width:100%; margin-top:.4rem; padding:.8rem .9rem; border:1px solid rgba(184,146,90,.35); border-radius:5px; background:#100d0a; color:var(--cream); font:inherit; } input:focus { outline:2px solid var(--gold); outline-offset:2px; border-color:var(--gold); } button,.button { display:inline-flex; justify-content:center; align-items:center; gap:.65rem; width:100%; margin-top:.5rem; padding:1rem 1.2rem; border:0; border-radius:5px; background:linear-gradient(135deg,#ebd096,var(--brass)); color:#1e1509; font:700 .98rem Inter,system-ui,sans-serif; text-decoration:none; cursor:pointer; } button span,.button span { transition:transform .2s ease; } button:hover span,.button:hover span { transform:translateX(4px); }
    .fineprint,.back { margin:1.25rem 0 0; color:var(--muted); font-size:.78rem; line-height:1.6; } .back a { color:var(--gold); text-decoration:none; } .notice { margin:1rem 0 0; padding:.75rem .85rem; border-left:2px solid var(--gold); color:var(--muted); font-size:.84rem; background:rgba(184,146,90,.08); } .redirect,.result { text-align:center; } .redirect h1,.result h1 { margin-top:.5rem; } .redirect p,.result > p:not(.eyebrow):not(.reference) { color:var(--muted); max-width:34em; margin:0 auto 1.5rem; } .redirect button,.result .button { width:auto; min-width:240px; } .result-icon { width:3.2rem; height:3.2rem; margin:0 auto 1.15rem; display:grid; place-items:center; border:1px solid var(--gold); border-radius:50%; color:var(--gold); font:1.5rem Georgia,serif; } .result.error .result-icon { border-color:#d18166; color:#e5a08b; } .reference { margin:1.5rem auto!important; font: .67rem ui-monospace,monospace; letter-spacing:.15em; color:var(--muted)!important; } .reference strong { display:block; margin-top:.35rem; color:var(--cream); letter-spacing:.04em; font-size:.82rem; }
  `;
}
