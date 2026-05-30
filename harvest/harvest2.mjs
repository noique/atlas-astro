// Second pass: fetch all 43 single-post pages + remaining image assets they reference.
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://demo.tmrwstudio.net';
const ROOT = '/Users/moneyprinter/Documents/atlas';
const HARVEST = path.join(ROOT, 'harvest');
const PUBLIC = path.join(ROOT, 'public');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const postMap = JSON.parse(fs.readFileSync(path.join(HARVEST, 'post-map.json'), 'utf8'));
const outDir = path.join(HARVEST, 'html', 'posts');
fs.mkdirSync(outDir, { recursive: true });

const assetQueue = new Set();
const stripOrigin = (u) => {
  if (!u) return null;
  u = u.trim().replace(/&#0?38;|&amp;/g, '&');
  if (u.startsWith('data:') || u.startsWith('#') || u.startsWith('mailto:') || u.startsWith('javascript:')) return null;
  if (u.startsWith('//')) u = 'https:' + u;
  if (u.startsWith('http')) { if (!u.startsWith(ORIGIN)) return null; u = u.slice(ORIGIN.length); }
  if (!u.startsWith('/')) return null;
  return u.split('#')[0];
};
const collect = (html) => {
  const push = (raw) => { const p = stripOrigin(raw); if (p && /\.(jpe?g|png|webp|gif|svg|avif|woff2?|ttf)$/i.test(p.split('?')[0])) assetQueue.add(p); };
  for (const m of html.matchAll(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/\b(?:data-srcset|srcset)=["']([^"']+)["']/gi)) for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)) push(m[2]);
};
async function fetchBuf(urlPath, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(ORIGIN + urlPath, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === tries - 1) { console.warn('  FAIL', urlPath, e.message); return null; } await new Promise((r) => setTimeout(r, 400 * (i + 1))); }
  }
}
async function pool(items, n, fn) { const a = [...items]; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < a.length) await fn(a[i++]); })); }

(async () => {
  console.log('=== fetching', Object.keys(postMap).length, 'single posts ===');
  for (const [slug, urlPath] of Object.entries(postMap)) {
    const buf = await fetchBuf(urlPath);
    if (!buf) continue;
    fs.writeFileSync(path.join(outDir, slug + '.html'), buf);
    collect(buf.toString('utf8'));
  }
  const assets = [...assetQueue];
  console.log('=== downloading', assets.length, 'referenced assets (skip existing) ===');
  let ok = 0, skip = 0, fail = 0;
  await pool(assets, 12, async (p) => {
    const dest = path.join(PUBLIC, p.split('?')[0]);
    if (fs.existsSync(dest)) { skip++; return; }
    const buf = await fetchBuf(p);
    if (!buf) { fail++; return; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf); ok++;
  });
  console.log('=== summary === posts:', fs.readdirSync(outDir).length, 'new assets:', ok, 'skipped:', skip, 'fail:', fail);
})();
