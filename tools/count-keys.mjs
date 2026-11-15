import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'i18n/parts';
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const conflicts = [];
const seen = new Map();
let total = 0;
const rows = [];
for (const f of files) {
  const o = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
  const n = Object.keys(o).length;
  total += n;
  rows.push('part ' + f + ' ' + n);
  for (const [k, v] of Object.entries(o)) {
    if (seen.has(k) && seen.get(k) !== v) conflicts.push('CONFLICT ' + k);
    seen.set(k, v);
  }
}
const summary = [];
summary.push('FILES ' + files.length);
summary.push('TOTAL ' + total);
summary.push('UNIQUE ' + seen.size);
summary.push('CONFLICTS ' + conflicts.length);
summary.push(...rows);
writeFileSync('ko-count.txt', summary.join('\n') + '\n');

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
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('\u0060')) return;
    if (/[\uAC00-\uD7A3]/.test(line)) return;
    if (/^\s*\//.test(line)) return;
    const m = line.match(/\u0060[^\u0060]*[A-Za-z]{3,}[^\u0060]*\u0060/g);
    if (!m) return;
    const s2 = m.join(' | ');
    if (!/ /.test(s2)) return;
    if (/(px|#|font-|border|background|rgba|calc\(|--|url\()/.test(s2)) return;
    cand.push(f + ':' + (i + 1) + ' ' + s2.slice(0, 140));
  });
}
writeFileSync('ko-cand.txt', 'CANDIDATES ' + cand.length + '\n' + cand.join('\n') + '\n');
