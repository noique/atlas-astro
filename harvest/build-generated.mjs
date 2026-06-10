// Produce cleaned HTML fragments + a routing manifest consumed by the Astro app.
// Body shape per page:  <body class={bodyClass}><div id="page"><h1.sr/>{HEADER}{MAIN}{FOOTER}</div>{TAIL}</body>
import fs from 'node:fs';
import path from 'node:path';
import { cleanFragment } from './lib-clean.mjs';

const ROOT = '/Users/moneyprinter/Documents/atlas';
const H = path.join(ROOT, 'harvest', 'html');
const GEN = path.join(ROOT, 'src', 'generated');
const DATA = path.join(ROOT, 'src', 'data');
const postMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'harvest', 'post-map.json'), 'utf8'));
['chrome', 'home', 'posts', 'cat', 'page'].forEach((d) => fs.mkdirSync(path.join(GEN, d), { recursive: true }));
fs.mkdirSync(DATA, { recursive: true });

const read = (p) => fs.readFileSync(p, 'utf8');
const stripScripts = (s) => s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');

// Remove the smallest balanced <tag>…</tag> whose opening tag contains `needle`. Repeats for all matches.
function removeBalanced(html, tag, needle) {
  let out = html, guard = 0;
  const re = new RegExp('<' + tag + '\\b|</' + tag + '>', 'gi');
  while (guard++ < 100) {
    const at = out.indexOf(needle);
    if (at === -1) break;
    const start = out.lastIndexOf('<' + tag, at);
    if (start === -1) break;
    re.lastIndex = start;
    let m, depth = 0, end = -1;
    while ((m = re.exec(out))) {
      if (m[0][1] === '/') { if (--depth === 0) { end = m.index + m[0].length; break; } }
      else depth++;
    }
    if (end === -1) break;
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}
// WooCommerce is unused — strip cart triggers + the "Shop" nav item so the chrome is a pure blog.
function stripCommerce(html) {
  let out = removeBalanced(html, 'div', 'e-triggercart'); // desktop cart widget
  out = out.replace(/<a\b[^>]*\bcart-trigger\b[^>]*>[\s\S]*?<\/a>/gi, ''); // mobile cart link
  out = out.replace(/<li\b[^>]*>(?:(?!<\/?li\b)[\s\S])*?<span class="menu-text">Shop<[\s\S]*?<\/li>/gi, ''); // "Shop" menu item
  return out;
}
const deWoo = (cls) => cls.replace(/\bwoocommerce(?:-[a-z-]+)?\b/gi, '').replace(/\s+/g, ' ').trim();

// The demo ships every social icon with a placeholder href="x" (dead link). Point each at its
// real platform homepage (detected from the link's visible text) so nothing dead-ends.
const SOCIAL = {
  facebook: 'https://facebook.com', messenger: 'https://messenger.com', twitter: 'https://x.com',
  youtube: 'https://youtube.com', instagram: 'https://instagram.com', tiktok: 'https://tiktok.com',
  telegram: 'https://t.me', pinterest: 'https://pinterest.com', behance: 'https://behance.net',
  linkedin: 'https://linkedin.com', whatsapp: 'https://whatsapp.com', dribbble: 'https://dribbble.com',
  github: 'https://github.com', reddit: 'https://reddit.com', vimeo: 'https://vimeo.com', rss: '/feed/',
};
function fixSocial(html) {
  return html.replace(/<a\b([^>]*?)\shref="x"([^>]*)>([\s\S]*?)<\/a>/gi, (_full, pre, post, inner) => {
    const txt = inner.replace(/<[^>]+>/g, ' ').toLowerCase();
    let url = '#';
    for (const k in SOCIAL) if (txt.includes(k)) { url = SOCIAL[k]; break; }
    return `<a${pre} href="${url}"${post}>${inner}</a>`;
  });
}
// Drop stray <link rel="preconnect"/"dns-prefetch"> a few widgets inject into the body — fonts are self-hosted.
const stripStray = (s) => s.replace(/<link\b[^>]*\brel="(?:preconnect|dns-prefetch)"[^>]*>/gi, '');
// Remove the infinite-load trigger: an empty <div id="single-point-ajax"> after the article that the theme JS
// watches to fetch the next post via admin-ajax.php. No backend here → it would spin forever.
const stripInfinite = (s) => s.replace(/<div\b[^>]*single-point-ajax[^>]*>\s*<\/div>/gi, '');
const clean = (s) => fixSocial(stripInfinite(stripStray(stripCommerce(stripScripts(cleanFragment(s || ''))))));
const decode = (s) => String(s).replace(/&#0?38;|&amp;/g, '&').replace(/&#8217;|&#x2019;|&#8216;/g, '’').replace(/&#8211;|&#8212;/g, '–').replace(/&#8230;/g, '…').replace(/&quot;|&#34;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const meta = (h, re) => { const m = h.match(re); return m ? m[1].trim() : ''; };

function parse(html) {
  const bodyClass = meta(html, /<body[^>]*class="([^"]*)"/i);
  const dir = (html.match(/<html[^>]*\bdir="([^"]*)"/i) || [, ''])[1] || 'ltr';
  const title = decode(meta(html, /<title>([^<]*)<\/title>/i));
  const headerM = html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
  const footerM = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/i);
  const hEnd = html.indexOf('</header>');
  const fStart = html.indexOf('<footer');
  const fEnd = html.lastIndexOf('</footer>');
  const bEnd = html.indexOf('</body>');
  const main = hEnd !== -1 ? html.slice(hEnd + 9, fStart !== -1 ? fStart : bEnd) : '';
  let tail = fEnd !== -1 ? html.slice(fEnd + 9, bEnd) : '';
  tail = tail.replace(/^\s*<\/div>/, ''); // drop the </div> that closes #page (Layout emits it)
  return {
    bodyClass, title, dir,
    header: headerM ? headerM[0] : '',
    footer: footerM ? footerM[0] : '',
    main, tail,
  };
}

const manifest = { homes: {}, inner: {}, posts: [], categories: {}, tags: {}, pages: {} };

// ---- home variants + splash ----
const HOMES = { default: 'home-default', two: 'home-two', three: 'home-three', four: 'home-four', five: 'home-five', six: 'home-six', seven: 'home-seven', eight: 'home-eight', ads: 'home-ads', rtl: 'home-rtl', splash: 'splash' };
const cssFor = { default: 'home-default', two: 'home-two', three: 'home-three', four: 'home-four', five: 'home-five', six: 'home-six', seven: 'home-seven', eight: 'home-eight', ads: 'home-ads', rtl: 'home-rtl', splash: 'splash' };
for (const [variant, file] of Object.entries(HOMES)) {
  const p = parse(read(path.join(H, file + '.html')));
  fs.writeFileSync(path.join(GEN, 'chrome', variant + '.header.html'), clean(p.header));
  fs.writeFileSync(path.join(GEN, 'chrome', variant + '.footer.html'), clean(p.footer));
  fs.writeFileSync(path.join(GEN, 'chrome', variant + '.tail.html'), clean(p.tail));
  fs.writeFileSync(path.join(GEN, 'home', variant + '.html'), clean(p.main));
  manifest.homes[variant] = { title: p.title, bodyClass: deWoo(p.bodyClass), css: cssFor[variant], chrome: variant, dir: p.dir };
}

// ---- default-site chrome for all inner pages (from the single page) ----
{
  const p = parse(read(path.join(H, 'single.html')));
  fs.writeFileSync(path.join(GEN, 'chrome', 'inner.header.html'), clean(p.header));
  fs.writeFileSync(path.join(GEN, 'chrome', 'inner.footer.html'), clean(p.footer));
  fs.writeFileSync(path.join(GEN, 'chrome', 'inner.tail.html'), clean(p.tail));
}

// ---- single posts ----
for (const f of fs.readdirSync(path.join(H, 'posts')).filter((x) => x.endsWith('.html'))) {
  const slug = f.replace(/\.html$/, '');
  const html = read(path.join(H, 'posts', f));
  const p = parse(html);
  const cleanMain = clean(p.main);
  fs.writeFileSync(path.join(GEN, 'posts', slug + '.html'), cleanMain);
  const um = (postMap[slug] || '').match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  manifest.posts.push({
    slug,
    title: decode(meta(html, /<meta property="og:title" content="([^"]*)"/i) || p.title).replace(/\s*[–-]\s*Atlas.*$/i, ''),
    excerpt: decode(meta(html, /<meta property="og:description" content="([^"]*)"/i) || meta(html, /<meta name="description" content="([^"]*)"/i)),
    cover: meta(html, /<meta property="og:image" content="([^"]*)"/i).replace(/^https:\/\/demo\.tmrwstudio\.net/, ''),
    date: um ? `${um[1]}-${um[2]}-${um[3]}` : '',
    site: (postMap[slug] || '').match(/\/atlas\/([a-z]+)\//)?.[1] || 'default',
    categories: [...new Set([...cleanMain.matchAll(/post-cat[^"]*"\s+href="\/category\/([a-z0-9-]+)\//gi)].map((m) => m[1]))],
    format: (p.bodyClass.match(/\bformat-(video|audio|gallery|quote|link)\b/) || [, 'standard'])[1],
    bodyClass: deWoo(p.bodyClass),
  });
}
manifest.posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.slug.localeCompare(b.slug));

// ---- category archives ----
for (const f of fs.readdirSync(path.join(H, 'cat')).filter((x) => x.endsWith('.html'))) {
  const cat = f.replace(/\.html$/, '');
  const p = parse(read(path.join(H, 'cat', f)));
  fs.writeFileSync(path.join(GEN, 'cat', cat + '.html'), clean(p.main));
  manifest.categories[cat] = { title: p.title, bodyClass: deWoo(p.bodyClass) };
}

// ---- tag archives ----
const tagDir = path.join(H, 'tag');
if (fs.existsSync(tagDir)) {
  fs.mkdirSync(path.join(GEN, 'tag'), { recursive: true });
  for (const f of fs.readdirSync(tagDir).filter((x) => x.endsWith('.html'))) {
    const tag = f.replace(/\.html$/, '');
    const p = parse(read(path.join(tagDir, f)));
    fs.writeFileSync(path.join(GEN, 'tag', tag + '.html'), clean(p.main));
    manifest.tags[tag] = { title: p.title, bodyClass: deWoo(p.bodyClass) };
  }
}

// ---- one-off inner pages ----
for (const name of ['contact', 'author', 'search', '404', 'privacy-policy', 'about']) {
  const fp = path.join(H, name + '.html');
  if (!fs.existsSync(fp)) continue;
  const p = parse(read(fp));
  fs.writeFileSync(path.join(GEN, 'page', name + '.html'), clean(p.main));
  manifest.pages[name] = { title: p.title, bodyClass: deWoo(p.bodyClass) };
}

fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(manifest, null, 1));

console.log('homes:', Object.keys(manifest.homes).length, '| posts:', manifest.posts.length, '| categories:', Object.keys(manifest.categories).length, '| pages:', Object.keys(manifest.pages).join(','));
console.log('post check — cover:', manifest.posts.filter((p) => p.cover).length, 'date:', manifest.posts.filter((p) => p.date).length, 'cats:', manifest.posts.filter((p) => p.categories.length).length);
console.log('sample:', JSON.stringify(manifest.posts[0]).slice(0, 200));
