// go/cand.mjs - 파일별 미번역 후보 목록 생성 (스캔 전용)
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'go/out/cand';
mkdirSync(OUT, { recursive: true });
const KO = (() => { try { return JSON.parse(readFileSync('src/i18n/ko.json', 'utf8')); } catch { return {}; } })();

function literals(src) {
  const out = []; let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; const ln = line; let s = ''; i++;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { const e = src[i + 1]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; i += 2; continue; }
        if (d === q) { i++; break; }
        if (d === '\n') line++;
        s += d; i++;
      }
      out.push({ s, line: ln });
      continue;
    }
    i++;
  }
  return out;
}

const ID_RE = /^[a-z0-9_.\-\/:#$@%]+$/;
function candidate(t) {
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (KO[t] !== undefined) return false;
  if (ID_RE.test(t)) return false;
  if (/^(https?:)?\/\//.test(t)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return false;
  if (/[\uAC00-\uD7A3]/.test(t)) return false;
  if (/=>|===|!==|&&|\|\||\$\{/.test(t)) return false;
  if (/^\s*(if|for|while|return|const|let|var|function|import|export|class|new|case|break|throw)\b/.test(t)) return false;
  if (/^[a-z]+\.[a-zA-Z]+$/.test(t)) return false;
  return true;
}

function walk(dir, acc) {
  let es = [];
  try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|html)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk('src').filter((f) => !f.startsWith('src/data/maps/'));
const index = [];
let total = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const seen = new Set();
  const rows = [];
  for (const it of literals(src)) {
    if (seen.has(it.s) || !candidate(it.s)) continue;
    seen.add(it.s);
    rows.push(it.line + '\t' + it.s.replace(/\t/g, ' '));
  }
  if (!rows.length) continue;
  total += rows.length;
  const name = f.replace(/^src\//, '').replace(/\//g, '__').replace(/\.js$/, '') + '.txt';
  const body = rows.join('\n');
  writeFileSync(OUT + '/' + name, body);
  index.push(name + '\t' + rows.length + '\t' + body.length + '\t' + f);
}
writeFileSync(OUT + '/index.txt', index.join('\n'));
console.log('cand files: ' + index.length + ', strings: ' + total + ', dict: ' + Object.keys(KO).length);
