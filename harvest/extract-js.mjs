// Copy each page-type's combined JS bundle to public/js/{key}.js and emit a key->js map.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/moneyprinter/Documents/atlas';
const H = path.join(ROOT, 'harvest', 'html');
const jsDir = path.join(ROOT, 'harvest', 'js');
const outDir = path.join(ROOT, 'public', 'js');
fs.mkdirSync(outDir, { recursive: true });

// page-type key -> source html page that links the bundle we want
const MAP = {
  splash: 'splash',
  'home-default': 'home-default', 'home-two': 'home-two', 'home-three': 'home-three', 'home-four': 'home-four',
  'home-five': 'home-five', 'home-six': 'home-six', 'home-seven': 'home-seven', 'home-eight': 'home-eight',
  'home-ads': 'home-ads', 'home-rtl': 'home-rtl',
  single: 'single', archive: 'category', contact: 'contact', search: 'category',
};

const findByName = (name) => {
  let found = null;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === name) found = p; } })(jsDir);
  return found;
};

const map = {};
for (const [key, page] of Object.entries(MAP)) {
  const html = fs.readFileSync(path.join(H, page + '.html'), 'utf8');
  const m = html.match(/src="[^"]*litespeed\/js\/[^"']+\/([a-f0-9]+\.js)[^"']*"/i);
  if (!m) { console.warn('no bundle for', key); continue; }
  const src = findByName(m[1]);
  if (!src) { console.warn('missing harvested bundle', m[1], 'for', key); continue; }
  fs.copyFileSync(src, path.join(outDir, key + '.js'));
  map[key] = key + '.js';
  console.log(`${key.padEnd(13)} <- ${m[1]} (${(fs.statSync(src).size / 1024 | 0)}KB)`);
}
fs.writeFileSync(path.join(ROOT, 'harvest', 'js-map.json'), JSON.stringify(map, null, 1));
