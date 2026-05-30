// Build one self-contained stylesheet per page-type into public/css/.
// Each = the page's inline <style> head blocks (theme-options :root vars, etc.) + its combined LiteSpeed CSS.
// The combined CSS has no non-data url() refs, so location is irrelevant.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/moneyprinter/Documents/atlas';
const HARVEST = path.join(ROOT, 'harvest');
const htmlDir = path.join(HARVEST, 'html');
const cssDir = path.join(HARVEST, 'css');
const outDir = path.join(ROOT, 'public', 'css');
fs.mkdirSync(outDir, { recursive: true });

// page-type -> { html source page, combined-css fallback page (for ones with no combined link) }
const MAP = {
  splash: 'splash',
  'home-default': 'home-default',
  'home-two': 'home-two',
  'home-three': 'home-three',
  'home-four': 'home-four',
  'home-five': 'home-five',
  'home-six': 'home-six',
  'home-seven': 'home-seven',
  'home-eight': 'home-eight',
  'home-ads': 'home-ads',
  'home-rtl': 'home-rtl',
  single: 'single',
  archive: 'category', // category + author share this combined CSS
  contact: 'contact',
  search: 'category', // search page links no combined CSS; reuse archive skin, search inline vars below
};

const findCssByHash = (hash) => {
  let found = null;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === hash) found = p;
    }
  };
  walk(cssDir);
  return found;
};

const inlineBlocks = (html) => {
  const ids = [
    'wp-emoji-styles-inline-css',
    'classic-theme-styles-inline-css',
    'th90-style-inline-css',
    'th90_options-dynamic-css',
  ];
  let out = '';
  for (const id of ids) {
    const m = html.match(new RegExp(`<style id=["']${id}["'][^>]*>([\\s\\S]*?)</style>`, 'i'));
    if (m) out += `\n/* inline:${id} */\n${m[1]}\n`;
  }
  return out;
};

const combinedHash = (html) => {
  const m = html.match(/href="[^"]*litespeed\/css\/[^"']+\/([a-f0-9]+\.css)[^"']*"/i);
  return m ? m[1] : null;
};

for (const [outName, srcPage] of Object.entries(MAP)) {
  const html = fs.readFileSync(path.join(htmlDir, srcPage + '.html'), 'utf8');
  // inline blocks come from the actual page (search/home variants have their own vars)
  const ownHtml = fs.readFileSync(path.join(htmlDir, outName === 'search' ? 'search.html' : srcPage + '.html'), 'utf8');
  const inline = inlineBlocks(ownHtml);
  const hash = combinedHash(html);
  let combined = '';
  if (hash) {
    const f = findCssByHash(hash);
    if (f) combined = fs.readFileSync(f, 'utf8');
    else console.warn('  missing combined css for', outName, hash);
  }
  const css = `/* ===== ${outName} : combined theme CSS ===== */\n${combined}\n/* ===== ${outName} : inline head styles ===== */\n${inline}`;
  fs.writeFileSync(path.join(outDir, outName + '.css'), css);
  console.log(`${outName.padEnd(14)} -> public/css/${outName}.css  (${(css.length/1024|0)}KB, combined=${hash || 'none'})`);
}
