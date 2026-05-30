// Split each harvested page into head / bodyClass / header / main / footer parts for inspection & porting.
import fs from 'node:fs';
import path from 'node:path';

const HARVEST = '/Users/moneyprinter/Documents/atlas/harvest';
const htmlDir = path.join(HARVEST, 'html');
const outDir = path.join(HARVEST, 'parts');
fs.mkdirSync(outDir, { recursive: true });

const between = (s, openRe, closeTag) => {
  const m = s.match(openRe);
  if (!m) return null;
  const start = m.index;
  const close = s.indexOf(closeTag, start);
  return close === -1 ? null : s.slice(start, close + closeTag.length);
};

for (const file of fs.readdirSync(htmlDir).filter((f) => f.endsWith('.html'))) {
  const name = file.replace(/\.html$/, '');
  const html = fs.readFileSync(path.join(htmlDir, file), 'utf8');

  const head = between(html, /<head[^>]*>/i, '</head>') || '';
  const bodyOpen = (html.match(/<body[^>]*>/i) || [''])[0];
  const bodyClass = (bodyOpen.match(/class="([^"]*)"/i) || [, ''])[1];

  const header = between(html, /<header[^>]*>/i, '</header>') || '';
  const footer = between(html, /<footer[^>]*>/i, '</footer>') || '';

  // main content = everything between </header> and <footer>
  let main = '';
  const hEnd = html.indexOf('</header>');
  const fStart = html.indexOf('<footer');
  if (hEnd !== -1 && fStart !== -1) main = html.slice(hEnd + '</header>'.length, fStart);

  fs.writeFileSync(path.join(outDir, `${name}.head.html`), head);
  fs.writeFileSync(path.join(outDir, `${name}.bodyclass.txt`), bodyClass);
  fs.writeFileSync(path.join(outDir, `${name}.header.html`), header);
  fs.writeFileSync(path.join(outDir, `${name}.footer.html`), footer);
  fs.writeFileSync(path.join(outDir, `${name}.main.html`), main);

  console.log(
    `${name.padEnd(14)} head=${(head.length/1024|0)}K header=${(header.length/1024|0)}K main=${(main.length/1024|0)}K footer=${(footer.length/1024|0)}K`
  );
}
