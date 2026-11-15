// 임시 스캔 스크립트 (go/ 전용, 작업이 끝나면 삭제)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BT = String.fromCharCode(96);
const OUT = 'go/report';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const dict = {};
for (const f of readdirSync('i18n/parts').filter((x) => x.endsWith('.json')).sort()) {
  try {
    const j = JSON.parse(readFileSync(join('i18n/parts', f), 'utf8'));
    for (const k of Object.keys(j)) dict[k] = 1;
  } catch (e) { console.log('bad part ' + f); }
}

const files = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
}
walk('src');

function lex(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  let line = 1;
  let prev = ';';
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'") {
      const start = i; const q = c; const sl = line; i++;
      let val = '';
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { val += src[i + 1]; i += 2; continue; }
        if (src[i] === '\n') line++;
        val += src[i]; i++;
      }
      i++;
      out.push({ kind: 'str', start, end: i, line: sl, src: src.slice(start, i), text: val });
      prev = q; continue;
    }
    if (c === BT) {
      const start = i; const sl = line; i++;
      const chunks = []; const exprs = []; let cur = '';
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { cur += src.slice(i, i + 2); i += 2; continue; }
        if (ch === BT) { i++; break; }
        if (ch === '$' && src[i + 1] === '{') {
          chunks.push(cur); cur = '';
          let depth = 1; let j = i + 2; const es = j;
          while (j < n && depth > 0) {
            const d2 = src[j];
            if (d2 === '"' || d2 === "'" || d2 === BT) {
              const q2 = d2; j++;
              while (j < n && src[j] !== q2) { if (src[j] === '\\') j++; if (src[j] === '\n') line++; j++; }
              j++; continue;
            }
            if (d2 === '{') depth++;
            else if (d2 === '}') { depth--; if (depth === 0) break; }
            else if (d2 === '\n') line++;
            j++;
          }
          exprs.push(src.slice(es, j).trim());
          i = j + 1; continue;
        }
        if (ch === '\n') line++;
        cur += ch; i++;
      }
      chunks.push(cur);
      out.push({ kind: 'tpl', start, end: i, line: sl, src: src.slice(start, i), chunks, exprs });
      prev = BT; continue;
    }
    if (c === '/' && ';,(=:[!&|?{}:+*%<>^~'.indexOf(prev) >= 0) {
      i++; let cls = false;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) { i++; break; }
        else if (d === '\n') break;
        i++;
      }
      prev = '/'; continue;
    }
    prev = c; i++;
  }
  return out;
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function isProse(text) {
  if (!/[A-Za-z]{2}/.test(text)) return false;
  if (text.length < 3) return false;
  if (/^(https?:|\/|\.\/|#|data:)/.test(text)) return false;
  if (/^[\w./-]+\.(js|mjs|css|png|jpg|json|wav|ogg|mp3|glsl)$/.test(text)) return false;
  if (/^[a-z0-9_-]+$/.test(text)) return false;
  if (/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(text)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false;
  if (/^(is-|has-|js-|ui-|hud-|btn-|font-|rgb|hsl)/.test(text)) return false;
  if (/^[A-Za-z0-9_$.:%-]+$/.test(text) && !/^[A-Z][a-z]+$/.test(text)) return false;
  return true;
}

const tpl = [];
const stat = [];
const statSeen = {};
let nLit = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lits = lex(src);
  nLit += lits.length;
  for (const L of lits) {
    const before = src.slice(Math.max(0, L.start - 40), L.start);
    const lineStart = src.lastIndexOf('\n', L.start - 1) + 1;
    const lineText = src.slice(lineStart, src.indexOf('\n', L.start) < 0 ? src.length : src.indexOf('\n', L.start));
    if (/(^|[^\w$.])(t|fmt|tr)\(\s*$/.test(before)) { continue; }
    if (/^\s*(import|export)\b/.test(lineText)) continue;
    if (L.kind === 'tpl' && L.exprs.length === 0) {
      const text = L.chunks[0];
      if (!isProse(text) || dict[text] !== undefined) continue;
      if (statSeen[text]) { statSeen[text].n++; continue; }
      const e = { f, l: L.line, k: text, src: L.src, n: 1 };
      statSeen[text] = e; stat.push(e);
      continue;
    }
    if (L.kind === 'tpl') {
      const text = L.chunks.join('');
      if (!/[A-Za-z]{2}/.test(text)) continue;
      if (L.chunks.join(' ').split(/\s+/).length < 2 && !/[A-Za-z]{4}/.test(text)) continue;
      let key = '';
      const args = [];
      L.chunks.forEach((c, ix) => { key += esc(c); if (ix < L.exprs.length) { key += '{' + ix + '}'; args.push(L.exprs[ix]); } });
      const sugg = 'fmt(' + JSON.stringify(key).replace(/^"|"$/g, "'") + (args.length ? ', ' + args.join(', ') : '') + ')';
      tpl.push({ f, l: L.line, k: key, src: L.src, sugg, inDict: dict[key] ? 1 : 0 });
      continue;
    }
    const text = L.text;
    if (!isProse(text)) continue;
    if (dict[text] !== undefined) continue;
    if (statSeen[text]) { statSeen[text].n++; continue; }
    const e = { f, l: L.line, k: text, src: L.src, n: 1 };
    statSeen[text] = e; stat.push(e);
  }
}

function chunkWrite(name, arr, size) {
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const e of arr) {
    const s = JSON.stringify(e);
    if (len + s.length > size && cur.length) { chunks.push(cur); cur = []; len = 0; }
    cur.push(e); len += s.length + 2;
  }
  if (cur.length) chunks.push(cur);
  chunks.forEach((c, ix) => writeFileSync(OUT + '/' + name + '-' + ix + '.json', JSON.stringify(c)));
  return chunks.length;
}

const tplChunks = chunkWrite('tpl', tpl, 16000);
const stChunks = chunkWrite('str', stat, 16000);
const byDir = {};
for (const e of tpl.concat(stat)) {
  const d = e.f.split('/').slice(0, 2).join('/');
  byDir[d] = (byDir[d] || 0) + 1;
}
const summary = {
  dictKeys: Object.keys(dict).length,
  files: files.length,
  literals: nLit,
  tpl: tpl.length,
  tplInDict: tpl.filter((e) => e.inDict).length,
  str: stat.length,
  tplChunks, stChunks, byDir,
};
writeFileSync(OUT + '/summary.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
