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

**Before going live:** replace `CHECKOUT_URL` with the real checkout link
(Razorpay / Shopify / Gumroad / Instamojo) and publish the final delivery
and refund terms at checkout — the page already states that these are
published before payment.

## Design system

Built directly from the book cover:

- Warm matte black `#0f0c09` · Antique brass `#b8925a` · Bone paper `#f4efe4`
- The doorway's vertical light as the site's visual motif (hero beam + 65% dial)
- Book cover treated as a premium physical object (ivory mat, brass offset shadow)
- Editorial serif headlines, mono captions, restrained motion only

## Deployment

`deploy.yml` builds the static site and publishes it to **GitHub Pages**
automatically on every push to `main` (the site is configured with a relative
base, so it works from any sub-path). You can also deploy `dist/` to Netlify,
Vercel, Cloudflare Pages, or any static host.