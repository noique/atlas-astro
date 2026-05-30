// One-file config. Switch the home layout by changing `homeVariant`, mirroring the
// Blogar master-template pattern. Each variant maps to src/components/homes/Home*.astro.
export type HomeVariant =
  | 'default' // Home 1
  | 'two' // Home 2
  | 'three' // Home 3
  | 'four' // Home 4
  | 'five' // Home 5
  | 'six' // Home 6
  | 'seven' // Home 7
  | 'eight' // Home 8
  | 'ads' // Home with ad placements
  | 'rtl' // right-to-left demo
  | 'splash'; // demo picker landing

export const site = {
  name: 'Atlas',
  tagline: 'Creative Blog & News',
  url: 'https://atlas.pages.dev',
  /** Active home layout. */
  homeVariant: 'default' as HomeVariant,
  /** Color skin: 'light' | 'dark'. The demo defaults to light with a runtime toggle. */
  skin: 'light' as 'light' | 'dark',
  social: {
    facebook: '#',
    twitter: '#',
    instagram: '#',
    youtube: '#',
    pinterest: '#',
  },
};

export type Site = typeof site;
