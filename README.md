# Atlas — Astro

A pixel-faithful [Astro](https://astro.build) re-creation of the **Atlas – Creative Blog & News** WordPress theme (TMRW-studio), rebuilt as a fast static site and deployed to Cloudflare Pages.

**Live:** https://atlas-8sf.pages.dev

## What's inside

- **All 10 home demos + a demo-picker splash** — `default` (Home 1) … `eight` (Home 8), plus `ads` and `rtl` (right-to-left).
- **Inner pages** — single posts (49), category & tag archives, author, search, contact, privacy policy, 404.
- **Pure blog** — WooCommerce cart/shop removed; self-hosted [Poppins](https://fontsource.org) (no Google Fonts) and all images/CSS/JS self-hosted (no third-party CDN).
- **Zero dead links** — every internal link resolves (audited by `harvest/check-links.mjs`).

## Switch the home layout

One line in [`src/config/site.ts`](src/config/site.ts):

```ts
homeVariant: 'default', // 'two' | 'three' | … | 'eight' | 'ads' | 'rtl' | 'splash'
```

`/` renders the configured variant; every variant is also reachable at `/h/{variant}/`, and the splash at `/demos/`. This makes it trivial to spin up multiple variant sites from one codebase.

## Develop & build

```bash
pnpm install
pnpm build          # → ./dist (static)
```

> Note: under Node 25 `astro dev`/`preview` can hang in some environments — build and serve `dist` with any static server (e.g. `python3 -m http.server --directory dist`).

## Deploy (Cloudflare Pages)

```bash
npx wrangler pages deploy ./dist --project-name=atlas
```

## How it was built

The 10 home demos are each a distinct Elementor "skin" with their own chrome and theme-options CSS, so instead of re-authoring components by hand, the site uses a **clean-and-inject** pipeline (scripts in `harvest/`):

1. `harvest*.mjs` — download every page + its combined CSS/JS + all images/fonts from the live demo, self-hosting them under `public/` with origin-stripped paths.
2. `build-generated.mjs` + `lib-clean.mjs` — split each page into header/main/footer/tail, strip the demo origin, remap internal links to local routes, strip WooCommerce + WP scripts, and emit cleaned fragments to `src/generated/**` plus a routing manifest at `src/data/manifest.json`.
3. Astro pages inject the fragments and link each page-type's bundled CSS/JS.

To regenerate from scratch: run the scripts in order (`harvest`, `harvest2`, `harvest3`, `harvest4`, `extract-css`, `extract-js`, `build-generated`), then `pnpm build`, then `node harvest/check-links.mjs`.

---

This is an independent fan re-creation for learning/personal use. "Atlas" and its design belong to their original author (TMRW-studio); a license to the original theme is required for commercial use.
