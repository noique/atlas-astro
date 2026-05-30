// Harvest the Atlas live demo: HTML for every page type, the combined CSS/JS,
// and every same-origin asset (images, fonts) referenced by HTML or CSS.
// HTML/CSS/JS land in harvest/ (staging); images & fonts land in public/ (self-hosted, origin-stripped path).
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://demo.tmrwstudio.net';
const ROOT = '/Users/moneyprinter/Documents/atlas';
const HARVEST = path.join(ROOT, 'harvest');
const PUBLIC = path.join(ROOT, 'public');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const PAGES = {
  splash: '/atlas/',
  'home-default': '/atlas/default/',
  'home-two': '/atlas/two/',
  'home-three': '/atlas/three/',
  'home-four': '/atlas/four/',
  'home-five': '/atlas/five/',
  'home-six': '/atlas/six/',
  'home-seven': '/atlas/seven/',
  'home-eight': '/atlas/eight/',
  'home-ads': '/atlas/ads/',
  'home-rtl': '/atlas/rtl/',
  single: '/atlas/default/2023/09/06/spicy-crispy-chicken-burger-recipe/',
  'single-2': '/atlas/default/2023/09/06/mistakes-you-might-be-making-with-your-watch/',
  category: '/atlas/default/category/food/',
  author: '/atlas/default/author/admin/',
  contact: '/atlas/default/contact/',
  search: '/atlas/default/?s=venus',
  '404': '/atlas/default/this-page-does-not-exist-404/',
};

const seen = new Set();
const assetQueue = new Set();
const cssToScan = new Set();

const stripOrigin = (u) => {
  if (!u) return null;
  u = u.trim().replace(/&#0?38;|&amp;/g, '&');
  if (u.startsWith('data:') || u.startsWith('#') || u.startsWith('mailto:') || u.startsWith('javascript:')) return null;
  if (u.startsWith('//')) u = 'https:' + u;
  if (u.startsWith('http')) {
    if (!u.startsWith(ORIGIN)) return null; // external (e.g. google fonts) handled separately
    u = u.slice(ORIGIN.length);
  }
  if (!u.startsWith('/')) return null;
  return u.split('#')[0]; // keep query for cache-busting fetch, but we'll save without it
};

const savePathFor = (urlPath) => urlPath.split('?')[0];

async function fetchBuf(urlPath, tries = 3) {
  const url = ORIGIN + urlPath;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === tries - 1) { console.warn('  FAIL', urlPath, String(e.message)); return null; }
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
}

function collectFromHtml(html) {
  const push = (raw) => { const p = stripOrigin(raw); if (p) assetQueue.add(p); };
  // stylesheets
  for (const m of html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)) {
    const href = (m[0].match(/href=["']([^"']+)["']/i) || [])[1];
    const p = stripOrigin(href);
    if (p && /\.css/i.test(p)) { assetQueue.add(p); cssToScan.add(p); }
  }
  // favicons / icons / preload
  for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const rel = (m[0].match(/rel=["']([^"']+)["']/i) || [])[1] || '';
    if (/icon|preload|apple-touch|manifest/i.test(rel)) push(m[1]);
  }
  // scripts
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)) push(m[1]);
  // images: src / data-src / data-lazy-src / data-lazyload / srcset / data-srcset
  for (const m of html.matchAll(/\b(?:data-src|data-lazy-src|data-lazyload|src)=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/\b(?:data-srcset|srcset)=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]);
  }
  // inline style url(...)
  for (const m of html.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)) push(m[2]);
}

function collectFromCss(css, cssPath) {
  const baseDir = path.posix.dirname(cssPath.split('?')[0]);
  for (const m of css.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)) {
    let u = m[2].trim();
    if (u.startsWith('data:')) continue;
    let p;
    if (u.startsWith('http') || u.startsWith('//')) p = stripOrigin(u);
    else if (u.startsWith('/')) p = u.split('#')[0];
    else p = path.posix.normalize(path.posix.join(baseDir, u)).split('#')[0]; // relative
    if (p) assetQueue.add(p);
  }
}

async function pool(items, n, fn) {
  const arr = [...items];
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < arr.length) { const idx = i++; await fn(arr[idx], idx); }
  });
  await Promise.all(workers);
}

(async () => {
  fs.mkdirSync(path.join(HARVEST, 'html'), { recursive: true });
  fs.mkdirSync(path.join(HARVEST, 'css'), { recursive: true });
  fs.mkdirSync(path.join(HARVEST, 'js'), { recursive: true });

  // 1) pages
  console.log('=== fetching', Object.keys(PAGES).length, 'pages ===');
  for (const [name, p] of Object.entries(PAGES)) {
    const buf = await fetchBuf(p);
    if (!buf) continue;
    fs.writeFileSync(path.join(HARVEST, 'html', name + '.html'), buf);
    collectFromHtml(buf.toString('utf8'));
    console.log('  page', name, (buf.length / 1024 | 0) + 'KB');
  }

  // 2) fetch + save CSS first (so we can scan url()s), then everything else
  console.log('=== fetching', cssToScan.size, 'css files (scan url) ===');
  for (const cssPath of cssToScan) {
    const buf = await fetchBuf(cssPath);
    if (!buf) continue;
    const dest = path.join(HARVEST, 'css', savePathFor(cssPath));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    collectFromCss(buf.toString('utf8'), cssPath);
  }

  // 3) download remaining assets: js -> harvest/js, images/fonts -> public
  const assets = [...assetQueue].filter((p) => !cssToScan.has(p));
  console.log('=== downloading', assets.length, 'assets (js/img/font) ===');
  let okImg = 0, okJs = 0, okFont = 0, fail = 0;
  await pool(assets, 10, async (p) => {
    const clean = savePathFor(p);
    const ext = (clean.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
    let dest;
    if (ext === 'js') dest = path.join(HARVEST, 'js', clean);
    else dest = path.join(PUBLIC, clean); // images, fonts, etc. self-hosted
    if (fs.existsSync(dest)) return;
    const buf = await fetchBuf(p);
    if (!buf) { fail++; return; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    if (ext === 'js') okJs++;
    else if (/woff2?|ttf|eot|otf/.test(ext)) okFont++;
    else okImg++;
  });

  console.log('=== summary ===');
  console.log('css :', cssToScan.size);
  console.log('js  :', okJs);
  console.log('img :', okImg);
  console.log('font:', okFont);
  console.log('fail:', fail);
})();
