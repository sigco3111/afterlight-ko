// 7차 미번역 스캔: 병합 사전에 없는 표시 문자열을 파일별로 모은다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const DICT = JSON.parse(readFileSync('src/i18n/ko.json', 'utf8'));
const SKIP = /^(node_modules|vendor|dist|\.git|src\/data\/maps\/layouts)(\/|$)/;
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p); }
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('src');
const un = (s) => s.replace(/\\([\s\S])/g, (m, c) => ({ n: '\n', t: '\t', r: '\r' }[c] ?? c));
const RE = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const out = {}; let total = 0; let tpl = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const rows = [];
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(src))) {
    const raw = un(m[1] ?? m[2] ?? m[3] ?? '');
    if (!raw || raw.length < 2) continue;
    if (!/[A-Za-z]{2}/.test(raw)) continue;
    if (/^[\w./-]+$/.test(raw)) continue;
    if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) continue;
    if (/^https?:/.test(raw)) continue;
    if (/^[a-z][a-z0-9_-]*$/.test(raw)) continue;
    const key = raw.trim();
    if (DICT[key] !== undefined || DICT[raw] !== undefined) continue;
    const line = src.slice(0, m.index).split('\n').length;
    rows.push({ line, s: raw.slice(0, 300), tpl: raw.includes('${') });
    total++; if (raw.includes('${')) tpl++;
  }
  if (rows.length) out[f] = rows;
}
writeFileSync('go/untranslated.json', JSON.stringify({ dict: Object.keys(DICT).length, total, tpl, files: out }, null, 1));
console.log('미번역 후보', total, '템플릿', tpl, '파일', Object.keys(out).length);
