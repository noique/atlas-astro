// Static link audit over dist/: every href/src in every built page, resolved against real files.
// Flags internal links that don't resolve to a built page or static asset (dead links),
// and surfaces relative placeholders (e.g. href="x") + external targets (social icons) for review.
import fs from 'node:fs';
import path from 'node:path';

const DIST = '/Users/moneyprinter/Documents/atlas/dist';

const htmlFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

// URL path of a built html file: dist/foo/index.html -> /foo/ ; dist/404.html -> /404.html
const urlOf = (file) => {
  let u = '/' + path.relative(DIST, file).split(path.sep).join('/');
  u = u.replace(/index\.html$/, '');
  return u || '/';
};

const existsAsset = (abs) => {
  const f = path.join(DIST, abs);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return true; // exact file (asset)
  if (fs.existsSync(path.join(f, 'index.html'))) return true; // directory route
  if (fs.existsSync(f + '.html')) return true; // /404 -> 404.html
  if (fs.existsSync(f.replace(/\/$/, '') + '/index.html')) return true;
  return false;
};

const dead = new Map(); // target -> Set(sourcePages)
const placeholders = new Map(); // weird relative target -> count
const externals = new Map(); // host -> count
let anchorCount = 0;
let totalLinks = 0;

const decode = (s) => s.replace(/&#0?38;|&amp;/g, '&').replace(/&#039;|&#39;/g, "'");

for (const file of htmlFiles) {
  const url = urlOf(file);
  const baseDir = url.endsWith('/') ? url : url.replace(/[^/]*$/, '');
  const html = fs.readFileSync(file, 'utf8');
  const refs = [];
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) refs.push(decode(m[1]));
  for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) for (const part of m[1].split(',')) refs.push(decode(part.trim().split(/\s+/)[0]));

  for (let ref of refs) {
    if (!ref) continue;
    ref = ref.trim();
    totalLinks++;
    if (ref.startsWith('#')) { anchorCount++; continue; }
    if (/^(mailto:|tel:|javascript:|data:)/i.test(ref)) continue;
    if (/^(https?:)?\/\//i.test(ref)) {
      try { externals.set(new URL(ref.startsWith('//') ? 'https:' + ref : ref).host, (externals.get(new URL(ref.startsWith('//') ? 'https:' + ref : ref).host) || 0) + 1); } catch {}
      continue;
    }
    // internal — resolve to absolute path under dist
    let abs;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue; // pure #/? handled
    if (clean.startsWith('/')) abs = clean;
    else { // relative (e.g. "x", "foo/bar") — flag + resolve against page dir
      placeholders.set(ref, (placeholders.get(ref) || 0) + 1);
      abs = path.posix.normalize(baseDir + clean);
    }
    if (!existsAsset(abs)) {
      if (!dead.has(ref)) dead.set(ref, new Set());
      if (dead.get(ref).size < 4) dead.get(ref).add(url);
    }
  }
}

console.log('pages scanned   :', htmlFiles.length);
console.log('total href/src  :', totalLinks);
console.log('in-page anchors :', anchorCount, '(# links, ok)');
console.log('external hosts  :', [...externals.entries()].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h}(${n})`).join(', ') || '(none)');
console.log('\n=== RELATIVE / placeholder hrefs (not starting with /, may be demo stubs) ===');
if (placeholders.size === 0) console.log('  none');
else [...placeholders.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${n.toString().padStart(5)}  "${t}"`));
console.log('\n=== DEAD internal links (resolve to nothing in dist) ===');
if (dead.size === 0) console.log('  ✅ none — every internal link resolves');
else {
  const rows = [...dead.entries()].sort((a, b) => b[1].size - a[1].size);
  for (const [t, srcs] of rows) console.log(`  ✗ ${t}\n      e.g. on: ${[...srcs].join(', ')}`);
  console.log(`\n  total distinct dead targets: ${dead.size}`);
}
