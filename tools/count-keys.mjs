import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'i18n/parts';
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const seen = new Map();
let total = 0;
let templ = 0;
for (const f of files) {
  const o = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
  total += Object.keys(o).length;
  for (const [k, v] of Object.entries(o)) {
    if (/\{\d\}/.test(k)) templ++;
    seen.set(k, v);
  }
}

function walk(p, acc) {
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const q = p + '/' + e.name;
    if (e.isDirectory()) walk(q, acc);
    else if (q.endsWith('.js')) acc.push(q);
  }
  return acc;
}
const srcs = walk('src', []).filter((f) => !f.includes('/i18n/') && !f.includes('/data/'));
const all = [];
const sent = [];
for (const f of srcs) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (!line.includes('\u0060')) return;
    if (/[\uAC00-\uD7A3]/.test(line)) return;
    if (/^\s*\//.test(line)) return;
    const m = line.match(/\u0060[^\u0060]*[A-Za-z]{3,}[^\u0060]*\u0060/g);
    if (!m) return;
    const lit = m.join(' | ');
    const plain = lit.replace(/\$\{[^}]*\}/g, ' ');
    if (!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(plain)) return;
    if (/(px|font-|border|background|rgba|calc\(|url\(|translate|rotate|scale|grid|flex)/.test(plain)) return;
    const entry = f + ':' + (i + 1) + ' ' + lit.slice(0, 130);
    all.push(entry);
    if (/[A-Z][a-z]{2,}/.test(plain) || /[.!?]\s*$/.test(plain.trim())) sent.push(entry);
  });
}
const lines = [];
lines.push('FILES ' + files.length);
lines.push('TOTAL ' + total);
lines.push('UNIQUE ' + seen.size);
lines.push('TEMPLATE_KEYS ' + templ);
lines.push('TEMPLATE_LINES ' + all.length);
lines.push('SENTENCE_LINES ' + sent.length);
const byFile = {};
for (const e of sent) {
  const f = e.split(':')[0];
  byFile[f] = (byFile[f] || 0) + 1;
}
for (const k of Object.keys(byFile).sort()) lines.push('sent ' + k + ' ' + byFile[k]);
lines.push('---SAMPLES---');
lines.push(...sent.slice(0, 40));
writeFileSync('ko-count.txt', lines.join('\n') + '\n');
writeFileSync('ko-cand.txt', sent.join('\n') + '\n');
