// Shared HTML cleaner: strip the demo origin, remap internal page links to our routes,
// keep asset paths (/atlas/.../wp-content/...) pointing at self-hosted files in public/.
const ORIGIN = 'https://demo.tmrwstudio.net';

const VARIANTS = ['default', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'ads', 'rtl'];
const homeRoute = (v) => (v === 'default' ? '/' : `/h/${v}/`);

export function remapHref(href) {
  if (!href) return href;
  let h = href.replace(/&#0?38;|&amp;/g, '&').trim();
  if (!/^\/atlas(\/|$|#)/.test(h)) return h; // not an internal atlas link

  // peel off #hash and ?query so they survive the remap
  let hash = '', query = '';
  const hi = h.indexOf('#'); if (hi >= 0) { hash = h.slice(hi); h = h.slice(0, hi); }
  const qi = h.indexOf('?'); if (qi >= 0) { query = h.slice(qi); h = h.slice(0, qi); }

  if (/[?&]s=/.test(query)) return '/search/' + query;               // search results
  if (/^\/atlas\/?$/.test(h)) return '/demos/' + hash;               // demo-picker splash
  // asset URLs (images, theme files) — keep origin-stripped path verbatim, never slash-mangle
  if (/\/(wp-content|wp-includes|wp-json)\//i.test(h) || /\.(jpe?g|png|webp|gif|svg|avif|css|js|woff2?|ttf|pdf|mp4)$/i.test(h)) return h + query + hash;

  const m = h.match(/^\/atlas\/([a-z0-9-]+)\/?(.*)$/i);
  if (!m) return h + query + hash;
  const variant = m[1];
  const rest = (m[2] || '').replace(/^\/+/, '').replace(/\/+$/, '');

  if (variant === 'wp-admin' || /(^|\/)(wp-admin|wp-login|xmlrpc|feed|comments)(\/|$)/.test(rest)) return '#';
  if (rest === '') return (VARIANTS.includes(variant) ? homeRoute(variant) : '/demos/') + hash;
  // RTL demo ships Arabic (%-encoded) post/category slugs — throwaway showcase content we don't build → neutralize.
  if (/%[0-9a-f]{2}/i.test(rest)) return '#';
  if (/^404/.test(rest)) return '/404.html';
  if (/^(shop|cart|checkout|my-account)$/i.test(rest)) return '#'; // woo stubbed
  let cm = rest.match(/^category\/(.+)$/i); if (cm) { const c = cm[1].replace(/\/+$/, ''); return c === 'uncategorized' ? '#' : '/category/' + c + '/' + hash; } // "uncategorized" 404s even on the demo
  let am = rest.match(/^author\/(.+)$/i); if (am) return '/author/' + am[1].replace(/\/+$/, '') + '/' + hash;
  let tm = rest.match(/^tag\/(.+)$/i); if (tm) return '/tag/' + tm[1].replace(/\/+$/, '') + '/' + hash;
  if (/^(contact|about|privacy-policy|privacy)$/i.test(rest)) return '/' + rest + '/' + hash;
  // single post: optional /YYYY/MM/DD/ date prefix + slug (slug may be %-encoded, e.g. RTL Arabic)
  let pm = rest.match(/^(?:\d{4}\/\d{2}\/\d{2}\/)?([^/]+)$/);
  if (pm) return '/' + pm[1] + '/' + hash;
  return '/' + rest + '/' + hash; // fallback: keep inner path, single trailing slash
}

export function cleanFragment(html) {
  if (!html) return html;
  let out = html;
  // 1) remap every <a href="..."> (incl. protocol + origin) BEFORE stripping origin
  out = out.replace(/(<a\b[^>]*?\shref=)(["'])(.*?)\2/gis, (full, pre, q, val) => {
    let v = val;
    if (v.startsWith(ORIGIN)) v = v.slice(ORIGIN.length) || '/';
    else if (v.startsWith('//demo.tmrwstudio.net')) v = v.slice('//demo.tmrwstudio.net'.length) || '/';
    const mapped = remapHref(v);
    return `${pre}${q}${mapped}${q}`;
  });
  // 2) strip origin from all remaining absolute refs (assets: src, srcset, url(), poster, content)
  out = out.split(ORIGIN).join('');
  out = out.split('//demo.tmrwstudio.net').join('');
  // 3) drop integrity/crossorigin that would break self-hosted assets (rare in body)
  return out;
}

export { VARIANTS };
