// Third pass: category archive pages (all 12) + a real 404 page, plus their image assets.
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://demo.tmrwstudio.net';
const ROOT = '/Users/moneyprinter/Documents/atlas';
const PUBLIC = path.join(ROOT, 'public');
const H = path.join(ROOT, 'harvest', 'html');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'harvest', 'archive-map.json'), 'utf8')).categories;
fs.mkdirSync(path.join(H, 'cat'), { recursive: true });

const assetQueue = new Set();
const strip = (u) => { if (!u) return null; u = u.trim().replace(/&#0?38;|&amp;/g, '&'); if (u.startsWith('data:')) return null; if (u.startsWith('//')) u = 'https:' + u; if (u.startsWith('http')) { if (!u.startsWith(ORIGIN)) return null; u = u.slice(ORIGIN.length); } return u.startsWith('/') ? u.split('#')[0] : null; };
const collect = (html) => { const push = (r) => { const p = strip(r); if (p && /\.(jpe?g|png|webp|gif|svg)$/i.test(p.split('?')[0])) assetQueue.add(p); }; for (const m of html.matchAll(/\b(?:data-src|src)=["']([^"']+)["']/gi)) push(m[1]); for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]); };
async function get(u, t = 3) { for (let i = 0; i < t; i++) { try { const r = await fetch(ORIGIN + u, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (r.status === 404 && u.includes('404')) return Buffer.from(await r.arrayBuffer()); if (!r.ok) throw 0; return Buffer.from(await r.arrayBuffer()); } catch { if (i === t - 1) return null; await new Promise((r) => setTimeout(r, 400)); } } }
async function pool(items, n, fn) { const a = [...items]; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < a.length) await fn(a[i++]); })); }

(async () => {
  const catMap = {};
  for (const [cat, url] of Object.entries(cats)) {
    const buf = await get(url);
    if (!buf) { console.warn('FAIL cat', cat); continue; }
    fs.writeFileSync(path.join(H, 'cat', cat + '.html'), buf);
    catMap[cat] = (url.match(/\/atlas\/([a-z]+)\//) || [, 'default'])[1];
    collect(buf.toString('utf8'));
  }
  // 404 from default site
  const b404 = await get('/atlas/default/no-such-page-404-test/');
  if (b404) { fs.writeFileSync(path.join(H, '404.html'), b404); collect(b404.toString('utf8')); }
  fs.writeFileSync(path.join(ROOT, 'harvest', 'cat-site-map.json'), JSON.stringify(catMap, null, 1));

  const assets = [...assetQueue];
  let ok = 0, skip = 0;
  await pool(assets, 12, async (p) => { const dest = path.join(PUBLIC, p.split('?')[0]); if (fs.existsSync(dest)) { skip++; return; } const buf = await get(p); if (!buf) return; fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf); ok++; });
  console.log('categories saved:', Object.keys(catMap).length, '| 404:', !!b404, '| new assets:', ok, 'skipped:', skip);
})();
