// ── Site configuration ─────────────────────────────────────────────
// One place to change the things that must never drift apart.

/** Live site — Cloudflare Worker deployment. */
export const SITE_URL = 'https://the-65-percent-rule.machine-shubhu.workers.dev/';

/** Every purchase CTA points here. The Cloudflare Worker creates a signed
 *  PayU Hosted Checkout order after collecting buyer details. */
export const CHECKOUT_URL = '/buy';

export const PRICE = '₹199';

export const SITE_TITLE = 'The 65% Rule — The Quiet Mechanics of True Wealth Builders';
export const SITE_DESCRIPTION =
  'A first-edition book about the quiet decision made after money reaches you — before it disappears into the noise of normal life.';

export const NAV_LINKS = [
  { label: 'The Rule', href: '#rule' },
  { label: 'Inside the Book', href: '#inside' },
  { label: 'First Edition', href: '#edition' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const MECHANISMS = [
  {
    title: 'A job for every rupee',
    body: 'Every rupee you touch gets an instruction before it gets a habit. Money follows the orders it is given — the book shows you how to be the one giving them.',
  },
  {
    title: 'The 65% framework',
    body: 'A directional allocation you shape around your real numbers — your costs, your responsibilities, your starting point. It is a framework, not a rigid demand written for someone else.',
  },
  {
    title: 'Protection before accumulation',
    body: 'The floor comes first. The mechanics that stop the quiet leaks — subscriptions, payments, emergencies — before growth is asked to do the heavy lifting.',
  },
  {
    title: 'Boring by design',
    body: 'Systems that survive your weak days. No willpower theatre, no motivation roulette — architecture that keeps working when enthusiasm does not.',
  },
] as const;

export const FAQ_ITEMS = [
  {
    q: 'Is this a book about earning more?',
    a: 'No. It is not a get-rich book and it makes no income promises. It is about the quiet decision made after money reaches you — before it disappears into the noise of normal life.',
  },
  {
    q: 'I earn a small amount. Does 65% even apply to me?',
    a: 'Yes — and it may not mean saving 65% today. The 65% is a directional framework you adapt to your responsibilities and starting point. The book never pretends everyone begins from the same place.',
  },
  {
    q: 'I run a business. Is this for me too?',
    a: 'If money touches you — a salary, a side income, a business month — the question is the same: what does every rupee I touch do next? The amount changes the options. It does not remove the need for a system.',
  },
  {
    q: 'What exactly do I receive with the First Edition?',
    a: 'The complete digital book, a printable 65% Blueprint you can keep on your desk, and early-reader updates as the edition matures. Only finished work ships — nothing is promised that does not exist.',
  },
  {
    q: 'How is it delivered, and can I refund it?',
    a: 'Delivery is digital. The exact file formats, delivery details and refund terms are finalized and published at checkout before launch — no fine print games.',
  },
  {
    q: 'Why is the price ₹199?',
    a: 'It is a First Edition launch price — honest by design: no countdown, no fake discount, no invented urgency. It may change as the edition matures.',
  },
] as const;