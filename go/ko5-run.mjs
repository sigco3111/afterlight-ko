// afterlight-ko 5차: 번역 페이로드 반영(go/req/*.tsv, slug<TAB>idx<TAB>ko) + 사전 미수록 문자열 추출
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CLEAN = existsSync('go/req/DONE.txt');
if (CLEAN) {
  rmSync('go', { recursive: true, force: true });
  rmSync('.github/workflows/ko5-tmp.yml', { force: true });
  console.log('정리 완료');
  process.exit(0);
}
const PARTS = 'i18n/parts';
const REQ = 'go/req';
const OUT = 'go/out';
const DICT = {};
for (const f of readdirSync(PARTS).filter((f) => f.endsWith('.json')).sort()) {
  const part = JSON.parse(readFileSync(join(PARTS, f), 'utf8'));
  for (const [k, v] of Object.entries(part)) DICT[k] = v;
}
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'files'), { recursive: true });
mkdirSync(join(OUT, 'c'), { recursive: true });
const log = [];
log.push('기존 사전 키: ' + Object.keys(DICT).length);

// 1) 번역 페이로드 반영: slug <TAB> idx <TAB> 한국어
const applied = {};
if (existsSync(REQ)) {
  for (const f of readdirSync(REQ).filter((x) => x.endsWith('.tsv')).sort()) {
    const name = f.replace(/\.tsv$/, '');
    const bySlug = {};
    const bad = [];
    for (const line of readFileSync(join(REQ, f), 'utf8').split('\n')) {
      const raw = line.replace(/\r$/, '');
      if (!raw.trim()) continue;
      const p = raw.split('\t');
      if (p.length < 3) { bad.push('FORMAT: ' + raw.slice(0, 60)); continue; }
      const slug = p[0].trim();
      const idx = parseInt(p[1], 10);
      const ko = p.slice(2).join('\t');
      if (!slug || !idx) { bad.push('FORMAT: ' + raw.slice(0, 60)); continue; }
      if (ko.indexOf('\\n') >= 0) { bad.push('LITERAL-NL: ' + slug + '#' + idx); continue; }
      if (!ko.trim()) { bad.push('EMPTY: ' + slug + '#' + idx); continue; }
      (bySlug[slug] = bySlug[slug] || []).push([idx, ko]);
    }
    for (const slug of Object.keys(bySlug)) {
      const src = join(OUT, 'files', slug + '.txt');
      if (!existsSync(src)) { bad.push('NO-SLUG: ' + slug); continue; }
      const lines = readFileSync(src, 'utf8').split('\n').filter((l) => l.trim());
      for (const [idx, ko] of bySlug[slug]) {
        const row = lines[idx - 1];
        if (!row) { bad.push('NO-IDX: ' + slug + '#' + idx); continue; }
        const t = row.indexOf('\t');
        const en = t >= 0 ? row.slice(t + 1) : row;
        if (DICT[en] !== undefined && DICT[en] === ko) continue;
        applied[en] = ko;
      }
    }
    log.push('페이로드 ' + name + ': ' + Object.keys(applied).length + '키 누적' + (bad.length ? ' / 문제 ' + bad.length : ''));
    for (const b of bad) log.push('  ! ' + b);
  }
  if (Object.keys(applied).length) {
    writeFileSync(join(PARTS, 'zz-ko5-' + Date.now() + '.json'), JSON.stringify(applied, null, 1) + '\n');
  }
  for (const f of readdirSync(REQ).filter((x) => x.endsWith('.tsv'))) rmSync(join(REQ, f));
}
log.push('이번 반영: ' + Object.keys(applied).length);

// 2) src 스캔
function walk(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function extract(src) {
  const out = [];
  let i = 0;
  let prev = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '/' && '=:[,!&|?{}(;+~*%<>.'.includes(prev !== '' ? prev : '=')) {
      let j = i + 1;
      let cls = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) break;
        else if (d === '\n') break;
        j++;
      }
      i = j + 1;
      prev = '/';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      let j = i + 1;
      let val = '';
      let dynamic = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') {
          const e = src[j + 1];
          if (e === 'n') val += '\n';
          else if (e === 't') val += '\t';
          else if (e === 'r') val += '';
          else if (e === 'u') { val += '?'; j += 6; continue; }
          else if (e === 'x') { val += '?'; j += 4; continue; }
          else val += e;
          j += 2;
          continue;
        }
        if (d === q) break;
        if (q === '`' && d === '$' && src[j + 1] === '{') dynamic = true;
        if (d === '\n') { dynamic = true; break; }
        val += d;
        j++;
      }
      if (!dynamic && val) out.push(val);
      i = j + 1;
      prev = q;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

function classify(s) {
  if (!/[A-Za-z]/.test(s)) return 'code';
  const t = s.trim();
  if (t.length < 3) return 'code';
  if (/\n|\t/.test(t)) return 'multi';
  if (/^(https?:|\/|\.\/|\.\.\/|#)/.test(t)) return 'code';
  if (/^[\w-]+\.[A-Za-z0-9]{1,5}$/.test(t)) return 'code';
  if (/^[^.][^\s]*\.(js|json|css|html|png|jpg|mp3|ogg|wav|ttf|woff2?)$/i.test(t)) return 'code';
  if (/^[-+]?[0-9]/.test(t)) return 'code';
  // css 클래스·토큰 나열: 전부 소문자/숫자/하이픈 단어
  const words = t.split(/\s+/);
  const cssWords = words.every((w) => /^[a-z0-9][a-z0-9_:-]*$/.test(w));
  if (cssWords && t === t.toLowerCase() && !/[.!?,'"]/.test(t)) return 'code';
  if (/^[\w$-]+$/.test(t)) {
    if (/^[A-Z][A-Za-z'’]*$/.test(t)) return 'text';
    return 'code';
  }
  if (/px|rgba?\(|var\(--|#[0-9a-f]{3,8}\b/i.test(t) && !/\s[a-z]+\s/.test(t)) return 'code';
  if (!/[A-Za-z]{2}/.test(t)) return 'code';
  if (!/\s/.test(t) && /^[a-z]+[A-Z][A-Za-z]*$/.test(t)) return 'code';
  return 'text';
}

const files = walk('src', []).filter((p) => p !== 'src/i18n/ko.json');
const index = [];
let totalText = 0;
let totalCode = 0;
let totalMulti = 0;
const dirTotals = {};
for (const p of files) {
  const rel = p.replace(/^src\//, '');
  const strings = extract(readFileSync(p, 'utf8'));
  const seen = new Set();
  const text = [];
  let code = 0;
  let multi = 0;
  for (const s of strings) {
    if (seen.has(s)) continue;
    seen.add(s);
    if (DICT[s] !== undefined) continue;
    const k = classify(s);
    if (k === 'text') text.push(s);
    else if (k === 'multi') multi++;
    else code++;
  }
  if (!text.length) continue;
  const slug = rel.replace(/\.(js|mjs)$/, '').replace(/\//g, '__');
  writeFileSync(join(OUT, 'files', slug + '.txt'), text.map((s, i) => (i + 1) + '\t' + s).join('\n') + '\n');
  const top = rel.split('/').slice(0, 2).join('/');
  for (let k = 0; k < text.length; k += 20) {
    const part = Math.floor(k / 20) + 1;
    writeFileSync(join(OUT, 'c', slug + '.' + part + '.txt'), text.slice(k, k + 20).map((s, ii) => (k + ii + 1) + '\t' + s).join('\n') + '\n');
  }
  index.push(rel + '\t' + text.length + '\t' + code + '\t' + multi);
  totalText += text.length;
  totalCode += code;
  totalMulti += multi;
  dirTotals[top] = (dirTotals[top] || 0) + text.length;
}
writeFileSync(join(OUT, 'index.txt'), 'file\ttext\tcode\tmulti\n' + index.join('\n') + '\n');
const dirs = Object.entries(dirTotals).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '\t' + v);
log.push('미수록 텍스트 후보: ' + totalText + ' (제외 추정 코드 ' + totalCode + ', 여러 줄 ' + totalMulti + ')');
log.push('상위 폴더별:');
for (const d of dirs) log.push('  ' + d);
writeFileSync(join(OUT, 'summary.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
