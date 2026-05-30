import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://atlas-8sf.pages.dev',
  // Static output → deployed to Cloudflare Pages via `wrangler pages deploy ./dist`.
  build: { format: 'directory' },
});
