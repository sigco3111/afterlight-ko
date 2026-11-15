import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'i18n/parts';
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const out = [];
const seen = new Map();
let total = 0;
const rows = [];
for (const f of files) {
  const o = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
  const n = Object.keys(o).length;
  total += n;
  rows.push(f + ' ' + n);
  for (const [k, v] of Object.entries(o)) {
    if (seen.has(k) && seen.get(k) !== v) out.push('CONFLICT ' + k);
    seen.set(k, v);
  }
}
out.push('FILES ' + files.length);
out.push('TOTAL ' + total);
out.push('UNIQUE ' + seen.size);
out.push(...rows);

function walk(p, acc) {
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const q = p + '/' + e.name;
    if (e.isDirectory()) walk(q, acc);
    else if (q.endsWith('.js')) acc.push(q);
  }
  return acc;
}
const srcs = walk('src', []).filter((f) => !f.includes('/i18n/') && !f.includes('/data/'));
const cand = [];
for (const f of srcs) {
  const src = readFileSync(f, 'utf8').split('\n');
  src.forEach((line, i) => {
    if (!line.includes('\u0060')) return;
    if (/[\uAC00-\uD7A3]/.test(line)) return;
    if (/^\s*\//.test(line)) return;
    const m = line.match(/\u0060[^\u0060]*[A-Za-z]{3,}[^\u0060]*\u0060/g);
    if (!m) return;
    const s = m.join(' | ');
    if (!/ /.test(s)) return;
    if (/(px|#|font-|border|background|rgba|calc\(|--)/.test(s)) return;
    cand.push(f + ':' + (i + 1) + ' ' + s.slice(0, 150));
  });
}
out.push('---CANDIDATES ' + cand.length + '---');
out.push(...cand.slice(0, 120));
writeFileSync('ko-count.txt', out.join('\n') + '\n');
