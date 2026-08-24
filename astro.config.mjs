import { defineConfig } from 'astro/config';

// base: './' keeps every asset URL relative, so the static build works
// from any sub-path (GitHub Pages, Netlify, Vercel) and as a local preview.
export default defineConfig({
  site: 'https://djshubhu.github.io/the-65-percent-rule/',
  base: './',
  output: 'static',
  build: {
    format: 'directory',
  },
});
