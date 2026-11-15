// 임시 적용 스크립트 (go/ 전용, 작업이 끝나면 삭제)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';

const BT = String.fromCharCode(96);
const dir = 'go/report';
const report = [];
if (existsSync(dir)) {
  for (const f of readdirSync(dir)) {
    if (!f.startsWith('tpl-')) continue;
    for (const e of JSON.parse(readFileSync(join(dir, f), 'utf8'))) report.push(e);
  }
}
const FIX = JSON.parse(readFileSync('go/fix.json', 'utf8'));
const unesc = (s) => s.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

// id -> key
const unmatched = [];
const dict = {};
for (const [id, ko] of Object.entries(FIX)) {
  const [pos, sub] = id.split('|');
  const cands = report.filter((e) => e.f + ':' + e.l === pos && (!sub || e.k.indexOf(sub) >= 0));
  if (!cands.length) { unmatched.push(id); continue; }
  for (const c of cands) dict[unesc(c.k)] = ko;
}

function lex(src) {
  const out = []; const n = src.length; let i = 0, line = 1, prev = ';';
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'") { const st = i; const q = c; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; out.push({ kind: 'str', s: st, e: i, line }); prev = q; continue; }
    if (c === BT) {
      const st = i; const sl = line; i++; const chunks = []; const exprs = []; let cur = '';
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { cur += src.slice(i, i + 2); i += 2; continue; }
        if (ch === BT) { i++; break; }
        if (ch === '$' && src[i + 1] === '{') {
          chunks.push(cur); cur = '';
          let depth = 1; let j = i + 2; const es = j;
          while (j < n && depth > 0) {
            const d2 = src[j];
            if (d2 === '"' || d2 === "'" || d2 === BT) { const q2 = d2; j++; while (j < n && src[j] !== q2) { if (src[j] === '\\') j++; if (src[j] === '\n') line++; j++; } j++; continue; }
            if (d2 === '{') depth++; else if (d2 === '}') { depth--; if (depth === 0) break; } else if (d2 === '\n') line++;
            j++;
          }
          exprs.push(src.slice(es, j).trim()); i = j + 1; continue;
        }
        if (ch === '\n') line++;
        cur += ch; i++;
      }
      chunks.push(cur);
      out.push({ kind: 'tpl', s: st, e: i, line: sl, chunks, exprs });
      prev = BT; continue;
    }
    if (c === '/' && ';,(=:[!&|?{}:+*%<>^~'.indexOf(prev) >= 0) { i++; let cls = false; while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) { i++; break; } else if (d === '\n') break; i++; } prev = '/'; continue; }
    prev = c; i++;
  }
  return out;
}

const files = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (p === 'src/i18n' || p === 'src/data') continue; walk(p); }
    else if (e.name.endsWith('.js')) files.push(p);
  }
}
walk('src');

const esc = (s) => s;
const q = (s) => "'" + s.replace(/\\/g, '\\\\').split(String.fromCharCode(39)).join('\\' + String.fromCharCode(39)).replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";

const changed = {};
let replaced = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lits = lex(src);
  const edits = [];
  for (const L of lits) {
    if (L.kind !== 'tpl' || !L.exprs.length) continue;
    const before = src.slice(Math.max(0, L.s - 40), L.s);
    if (/(^|[^\w$.])(t|fmt|tr)\(\s*$/.test(before)) continue;
    const key = L.chunks.join('');
    let full = '';
    L.chunks.forEach((c, ix) => { full += unesc(c); if (ix < L.exprs.length) full += '{' + ix + '}'; });
    if (dict[full] === undefined) continue;
    const repl = 'fmt(' + q(full) + (L.exprs.length ? ', ' + L.exprs.join(', ') : '') + ')';
    edits.push([L.s, L.e, repl]);
  }
  if (!edits.length) continue;
  let out = src;
  for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
  if (!/\bfmt\b/.test(src)) {
    const seg = dirname(f).split('/').length - 1;
    out = "import { fmt } from '" + '../'.repeat(seg) + "i18n/index.js';\n" + out;
  }
  writeFileSync(f, out);
  changed[f] = edits.length;
  replaced += edits.length;
}

// 사전 파일
const add = {};
for (const [k, v] of Object.entries(dict)) {
  const j = JSON.stringify(k);
  add[j.slice(1, -1)] = v;
}
writeFileSync('i18n/parts/zz-scan-tpl.json', JSON.stringify(add, null, 1));

// 문법 검사 (.mjs 로 복사해 ESM 파싱)
let bad = [];
for (const f of Object.keys(changed)) {
  try {
    const c = readFileSync(f, 'utf8');
    writeFileSync('/tmp/chk.mjs', c);
    execSync('node --check /tmp/chk.mjs', { stdio: 'pipe' });
  } catch (e) { bad.push(f + ': ' + String(e.stderr || e.message).slice(0, 300)); }
}

const summary = { dict: Object.keys(dict).length, files: Object.keys(changed).length, replaced, unmatched, bad };
writeFileSync('go/fix-report.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary).slice(0, 4000));
if (bad.length) process.exit(1);

// 커밋 (한국어 메시지, 3개 파일씩)
const msg = (f) => {
  if (f.startsWith('src/battle/')) return 'i18n: 전투 로그·전투 UI 문장 한글화';
  if (f.startsWith('src/ui/menu/')) return 'i18n: 메뉴 화면 문장 한글화';
  if (f.startsWith('src/ui/')) return 'i18n: UI·장면 안내 문장 한글화';
  if (f.startsWith('src/world/')) return 'i18n: 월드·지도 안내 문장 한글화';
  return 'i18n: 타이틀·스크립트 문장 한글화';
};
execSync('git config user.name "ko-scan-bot"');
execSync('git config user.email "ko-scan-bot@users.noreply.github.com"');
const list = Object.keys(changed).sort();
const groups = [];
for (let i = 0; i < list.length; i += 3) groups.push(list.slice(i, i + 3));
groups.forEach((g, ix) => {
  if (ix === 0) { execSync('git add i18n/parts/zz-scan-tpl.json'); }
  execSync('git add ' + g.join(' '));
  const m = msg(g[0]) + ' (' + (ix + 1) + '/' + groups.length + ') [skip ci]';
  execSync('git commit -m ' + JSON.stringify(m));
});
execSync('git push');
console.log('pushed ' + groups.length + ' commits');
