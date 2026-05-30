// Recursively complete the ENGLISH content set: discover every internal post/category/tag/page
// link across already-harvested HTML, fetch any we don't have yet, repeat until nothing new.
// Skips %-encoded (Arabic RTL) slugs — those are neutralized to '#' in lib-clean.
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://demo.tmrwstudio.net';
const ROOT = '/Users/moneyprinter/Documents/atlas';
const H = path.join(ROOT, 'harvest', 'html');
const PUBLIC = path.join(ROOT, 'public');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
['posts', 'cat', 'tag', 'page'].forEach((d) => fs.mkdirSync(path.join(H, d), { recursive: true }));

const postMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'harvest', 'post-map.json'), 'utf8'));
const catMap = {}, tagMap = {}, pageMap = {};

async function get(u, t = 3) {
  for (let i = 0; i < t; i++) {
    try { const r = await fetch(ORIGIN + u, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (!r.ok) throw 0; return Buffer.from(await r.arrayBuffer()); }
    catch { if (i === t - 1) return null; await new Promise((r) => setTimeout(r, 400)); }
  }
}
const isAscii = (s) => !/%[0-9a-f]{2}/i.test(s) && !/[^\x00-\x7f]/.test(s);
const allHtml = () => {
  const out = [];
  (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else if (e.name.endsWith('.html')) out.push(p); } })(H);
  return out;
};

function discover() {
  for (const f of allHtml()) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/https:\/\/demo\.tmrwstudio\.net(\/atlas\/[a-z0-9-]+\/(?:\d{4}\/\d{2}\/\d{2}\/)?([^"'\/?#]+))\/(?=["'?#])/gi)) {
      const url = m[1] + '/', slug = m[2];
      if (!isAscii(slug)) continue;
      if (/^(category|author|tag|page|wp-|feed|comments|cart|shop|checkout|my-account|xmlrpc)/i.test(slug)) continue;
      if (/^\d{4}$/.test(slug)) continue;
      if (!(slug in postMap)) postMap[slug] = url;
    }
    for (const m of html.matchAll(/https:\/\/demo\.tmrwstudio\.net(\/atlas\/[a-z0-9-]+\/category\/([^"'\/?#]+))\//gi)) { if (isAscii(m[2]) && !(m[2] in catMap)) catMap[m[2]] = m[1] + '/'; }
    for (const m of html.matchAll(/https:\/\/demo\.tmrwstudio\.net(\/atlas\/[a-z0-9-]+\/tag\/([^"'\/?#]+))\//gi)) { if (isAscii(m[2]) && !(m[2] in tagMap)) tagMap[m[2]] = m[1] + '/'; }
    for (const m of html.matchAll(/https:\/\/demo\.tmrwstudio\.net\/atlas\/[a-z0-9-]+\/(privacy-policy|about)\//gi)) { const name = m[1]; if (!(name in pageMap)) pageMap[name] = (m[0].match(/(\/atlas\/[a-z0-9-]+\/(?:privacy-policy|about)\/)/) || [])[1]; }
  }
}

const have = (sub, slug) => fs.existsSync(path.join(H, sub, slug + '.html'));
const assetQ = new Set();
const strip = (u) => { if (!u) return null; u = u.trim().replace(/&#0?38;|&amp;/g, '&'); if (u.startsWith('data:')) return null; if (u.startsWith('//')) u = 'https:' + u; if (u.startsWith('http')) { if (!u.startsWith(ORIGIN)) return null; u = u.slice(ORIGIN.length); } return u.startsWith('/') ? u.split('#')[0] : null; };
const collect = (html) => { const push = (r) => { const p = strip(r); if (p && /\.(jpe?g|png|webp|gif|svg)$/i.test(p.split('?')[0])) assetQ.add(p); }; for (const m of html.matchAll(/\b(?:data-src|src)=["']([^"']+)["']/gi)) push(m[1]); for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]); };

async function harvestMissing() {
  let fetched = 0;
  const jobs = [];
  for (const [slug, url] of Object.entries(postMap)) if (!have('posts', slug)) jobs.push(['posts', slug, url]);
  for (const [slug, url] of Object.entries(catMap)) if (!have('cat', slug)) jobs.push(['cat', slug, url]);
  for (const [slug, url] of Object.entries(tagMap)) if (!have('tag', slug)) jobs.push(['tag', slug, url]);
  for (const [name, url] of Object.entries(pageMap)) if (!fs.existsSync(path.join(H, name + '.html'))) jobs.push(['', name, url]);
  for (const [sub, slug, url] of jobs) {
    const buf = await get(url);
    if (!buf) { console.warn('  FAIL', url); continue; }
    fs.writeFileSync(path.join(H, sub, slug + '.html'), buf);
    collect(buf.toString('utf8'));
    fetched++;
  }
  return fetched;
}

(async () => {
  for (let pass = 1; pass <= 4; pass++) {
    discover();
    const n = await harvestMissing();
    console.log(`pass ${pass}: posts=${Object.keys(postMap).length} cats=${Object.keys(catMap).length} tags=${Object.keys(tagMap).length} pages=${Object.keys(pageMap).length} | fetched ${n}`);
    if (n === 0) break;
  }
  // download referenced assets (skip existing)
  let ok = 0;
  const arr = [...assetQ]; let i = 0;
  await Promise.all(Array.from({ length: 12 }, async () => { while (i < arr.length) { const p = arr[i++]; const dest = path.join(PUBLIC, p.split('?')[0]); if (fs.existsSync(dest)) continue; const buf = await get(p); if (!buf) continue; fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf); ok++; } }));
  fs.writeFileSync(path.join(ROOT, 'harvest', 'post-map.json'), JSON.stringify(postMap, null, 0));
  console.log('done. new assets:', ok, '| total posts:', Object.keys(postMap).length, 'cats:', Object.keys(catMap).length, 'tags:', Object.keys(tagMap).length);
})();
