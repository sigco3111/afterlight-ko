// 7차 스캔 2: 영역별 미번역 문자열을 파일 단위 JSON으로 나눠 저장한다.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const DICT = JSON.parse(readFileSync('src/i18n/ko.json', 'utf8'));
const AREAS = ['src/data/content', 'src/story', 'src/ui', 'src/battle'];
const SKIP = /^(node_modules|vendor|dist|\.git|src\/data\/maps\/layouts)(\/|$)/;
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p); }
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('.');
const picked = files.filter((f) => AREAS.some((a) => f.startsWith(a + '/')) || /^src\/data\/story/.test(f) || /^src\/data\/(quests|tutorials|bestiary)/.test(f));
const un = (s) => s.replace(/\\([\s\S])/g, (m, c) => ({ n: '\n', t: '\t', r: '\r' }[c] ?? c));
const RE = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const KEEP = (raw) => raw.length >= 6 && /\s/.test(raw) && /[A-Za-z]{2}/.test(raw)
  && !/https?:|\.js\b|\.json\b|\.png\b|\.mp3\b|\.mjs\b/.test(raw)
  && !/^[\w./-]+$/.test(raw);
mkdirSync('go/untranslated', { recursive: true });
const summary = { dict: Object.keys(DICT).length, files: {}, total: 0 };
for (const f of picked) {
  const src = readFileSync(f, 'utf8');
  const rows = [];
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(src))) {
    const raw = un(m[1] ?? m[2] ?? m[3] ?? '');
    if (!KEEP(raw)) continue;
    const key = raw.trim();
    if (DICT[key] !== undefined || DICT[raw] !== undefined) continue;
    const line = src.slice(0, m.index).split('\n').length;
    rows.push({ line, tpl: raw.includes('${'), s: raw.slice(0, 400) });
  }
  if (!rows.length) continue;
  const name = f.replace(/^src\//, '').replace(/\//g, '__') + '.json';
  writeFileSync('go/untranslated/' + name, JSON.stringify(rows, null, 1));
  summary.files[f] = rows.length;
  summary.total += rows.length;
}
writeFileSync('go/scan-summary.json', JSON.stringify(summary, null, 1));
console.log('대상 파일', Object.keys(summary.files).length, '미번역', summary.total);
