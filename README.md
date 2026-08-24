# The 65% Rule — Official Website

> **The Quiet Mechanics of True Wealth Builders.**

The official website for *The 65% Rule* — a first-edition book about the quiet
decision made after money reaches you, before it disappears into the noise of
normal life.

## Tech stack

- [Astro](https://astro.build/) 5 · static output — no client-side framework
- Self-hosted fonts (Playfair Display, Inter, IBM Plex Mono) via `@fontsource`
- Zero runtime JavaScript for the marketing page (native `<details>` FAQs,
  pure-CSS motion)
- Structured data: Book + Offer + FAQ schema, Open Graph, canonical URL
- Responsive cover variants (480 / 800 / 1200 px) + `prefers-reduced-motion`
  support

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the build
```

## Configuration

Everything that must never drift apart lives in **one file**:
`src/config.ts`

| Key            | What it controls                                              |
| -------------- | ------------------------------------------------------------- |
| `CHECKOUT_URL` | Every purchase CTA on the page (replace when payment is live) |
| `PRICE`        | Displayed price (₹199)                                        |
| `NAV_LINKS`    | Navbar / footer links                                         |
| `MECHANISMS`   | "Inside the Book" content                                     |
| `FAQ_ITEMS`    | FAQ content (also feeds the FAQ schema)                       |
| `SITE_URL`     | Canonical URL                                                 |

## PayU Hosted Checkout

The site is ready for **PayU Hosted Checkout** through a Cloudflare Worker. The
Worker generates PayU's SHA-512 payment hash server-side; the merchant salt is
never shipped to the browser or committed to Git.

1. Use **PayU Hosted** (the option shown in your PayU dashboard), not Merchant Hosted.
2. Keep `PAYU_ENV = "test"` first and set two encrypted Worker secrets:
   `PAYU_KEY` and `PAYU_SALT`.
3. Test the full flow using PayU test credentials. The worker sends customers to
   `test.payu.in/_payment`, validates PayU's reverse hash on return, then calls
   PayU's `verify_payment` API before showing a verified result.
4. After successful tests, replace the secrets with production Key/Salt and set
   `PAYU_ENV = "production"`; this switches PayU to `secure.payu.in/_payment`.

`wrangler.toml` serves `dist/` and runs the Worker only on `/buy` and
`/payu/*`. The public pricing and product fields are fixed server-side at
₹199 / `The 65% Rule — First Edition`, so a browser cannot alter an order total.

**Before production:** finalise digital delivery and refund terms. A verified
payment is not automatic licence delivery yet; connect your delivery email or
download system only after that is specified.

## Design system

Built directly from the book cover:

- Warm matte black `#0f0c09` · Antique brass `#b8925a` · Bone paper `#f4efe4`
- The doorway's vertical light as the site's visual motif (hero beam + 65% dial)
- Book cover treated as a premium physical object (ivory mat, brass offset shadow)
- Editorial serif headlines, mono captions, restrained motion only

## Deployment

The live implementation uses **Cloudflare Workers**, which serves the static
Astro build and runs the secure PayU routes together:

```bash
npm run cf:deploy
```

Before the first deployment, sign into Wrangler (`wrangler login`) and add the
`PAYU_KEY` + `PAYU_SALT` secrets in the Cloudflare dashboard or with
`wrangler secret bulk`. Never put either value in `wrangler.toml`, `.env` or
Git.

`deploy.yml` remains available if you also want a GitHub Pages mirror, but the
canonical production URL is the Cloudflare Worker URL.