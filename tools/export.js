// Usage: node tools/export.js <index.html> <out-dir>
// Builds plain-text copies of the wiki from index.html's data block:
//   wiki.md (everything), pages/index.md + pages/<id>.md (one per article), all.html (no-JS page)
const fs = require('fs'), path = require('path');
const BASE = 'https://suchonmprompunya.github.io/twelve-harvests/';
const dir = process.argv[3];
fs.mkdirSync(path.join(dir, 'pages'), { recursive: true });
const src = fs.readFileSync(process.argv[2], 'utf8');
const d = JSON.parse(src.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const ent = s => s.replace(/&ldquo;|&rdquo;/g, '"').replace(/&lsquo;|&rsquo;/g, "'").replace(/&mdash;/g, '—')
  .replace(/&ndash;/g, '–').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const inline = s => s
  .replace(/<span class="sw"[^>]*><\/span>/g, '')
  .replace(/<a href="#([^"]+)">([\s\S]*?)<\/a>/g, '[$2](#$1)')
  .replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)')
  .replace(/<\/?(strong|b)>/g, '**').replace(/<\/?(em|i)>/g, '*').replace(/<\/?code>/g, '`')
  .replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');

function table(t) {
  const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(r =>
    [...r[1].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => inline(c[2]).trim().replace(/\|/g, '\\|')));
  if (!rows.length) return '';
  const w = Math.max(...rows.map(r => r.length));
  const pad = r => '| ' + [...r, ...Array(w - r.length).fill('')].join(' | ') + ' |';
  const hasHead = /<thead/.test(t);
  const head = hasHead ? rows.shift() : Array(w).fill('');
  return [pad(head), '|' + ' --- |'.repeat(w), ...rows.map(pad)].join('\n');
}

function md(h) {
  return ent(h
    .replace(/<div class="table-wrap">|<\/div>(?=\s*<)/g, m => m) // keep
    .replace(/<table[\s\S]*?<\/table>/g, t => '\n\n' + table(t) + '\n\n')
    .replace(/<div class="xp">\s*<span class="xp-h">([\s\S]*?)<\/span>\s*<span class="xp-m">([\s\S]*?)<\/span>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/div>/g,
      (_, a, b, c) => `\n\n#### ${inline(a)}\n*${inline(b)}*\n\n${inline(c)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, x) => `\n\n### ${inline(x)}\n\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, (_, x) => `\n\n#### ${inline(x)}\n\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_, x) => '\n\n> ' + inline(x).trim() + '\n\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (_, x) => { let n = 0; return '\n\n' + [...x.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(l => `${++n}. ${inline(l[1]).trim()}`).join('\n') + '\n\n'; })
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (_, x) => '\n\n' + [...x.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(l => `- ${inline(l[1]).trim()}`).join('\n') + '\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, x) => '\n\n' + inline(x).trim() + '\n\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\n{3,}/g, '\n\n').trim();
}

let out = `# Twelve Harvests Wiki — full text\n\nEvery article from https://suchonmprompunya.github.io/twelve-harvests/ in one file. Links like (#ruby) point to the article with that id below.\n\n## Contents\n\n`;
for (const c of d.cats) {
  out += `**${c}:** ` + d.arts.filter(a => a.c === c).map(a => `[${a.t}](#${a.i})`).join(' · ') + '\n\n';
}
for (const c of d.cats) {
  out += `\n---\n\n# ${c}\n`;
  for (const a of d.arts.filter(a => a.c === c)) {
    out += `\n<a id="${a.i}"></a>\n## ${a.t}\n\n*id: ${a.i}${a.x ? ' · colour ' + a.x : ''}*\n\n> ${ent(a.l)}\n\n${md(a.h)}\n`;
  }
}
fs.writeFileSync(path.join(dir, 'wiki.md'), out);

// One short file per article, with links rewritten to the other article files
const toFiles = s => s.replace(/\]\(#([a-z0-9-]+)\)/g, (_, id) => `](${BASE}pages/${id}.md)`);
let idx = `# Twelve Harvests Wiki — page index\n\nOne Markdown file per article. Full text in one file: ${BASE}wiki.md\n`;
for (const c of d.cats) {
  idx += `\n## ${c}\n\n`;
  for (const a of d.arts.filter(a => a.c === c)) {
    idx += `- [${a.t}](${BASE}pages/${a.i}.md) — ${ent(a.l)}\n`;
    fs.writeFileSync(path.join(dir, 'pages', a.i + '.md'),
      `# ${a.t}\n\n*${c}${a.x ? ' · colour ' + a.x : ''} · part of the Twelve Harvests Wiki — index: ${BASE}pages/index.md*\n\n> ${ent(a.l)}\n\n${toFiles(md(a.h))}\n`);
  }
}
fs.writeFileSync(path.join(dir, 'pages', 'index.md'), idx);

// Static, no-JavaScript page with every article rendered in place
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Twelve Harvests Wiki — all pages</title>
<meta name="description" content="Full text of every Twelve Harvests Wiki article on one page, readable without JavaScript.">
<style>:root{color-scheme:dark}body{background:#0B0B0D;color:#E9E7E2;font:16px/1.65 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:2rem 16px 5rem}
a{color:#E9E7E2}h1,h2,h3,h4{font-family:Georgia,serif}h2{margin-top:3rem;border-top:1px solid #26262A;padding-top:2rem}
.lead{color:#9A968E;font-style:italic}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}th,td{text-align:left;padding:.4rem .8rem .4rem 0;border-bottom:1px solid #1C1C20;vertical-align:top}
.sw{display:inline-block;width:.9rem;height:.9rem;border-radius:50%;vertical-align:middle}.xp{margin-top:1.2rem}.xp-h{display:block;font-weight:600}.xp-m{display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#6A6762}code{color:#9A968E}</style></head><body>
<h1>Twelve Harvests Wiki — all pages</h1><p>Every article on one page. The interactive wiki is at <a href="./">the main site</a>; plain-text version: <a href="wiki.md">wiki.md</a>.</p><nav>`;
for (const c of d.cats) html += `<p><strong>${c}:</strong> ` + d.arts.filter(a => a.c === c).map(a => `<a href="#${a.i}">${esc(a.t)}</a>`).join(' · ') + '</p>';
html += '</nav>';
for (const c of d.cats) {
  html += `<h1 id="cat-${c.toLowerCase()}" style="margin-top:4rem">${c}</h1>`;
  for (const a of d.arts.filter(a => a.c === c)) html += `<article><h2 id="${a.i}">${esc(a.t)}</h2><p class="lead">${a.l}</p>${a.h}</article>`;
}
html += '</body></html>';
fs.writeFileSync(path.join(dir, 'all.html'), html);
console.log('articles:', d.arts.length, 'md bytes:', out.length, 'html bytes:', html.length);
