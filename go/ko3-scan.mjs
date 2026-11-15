// ko3 v3: 정적 미번역·템플릿 스캔 → go/out/*.md 로 남기고 커밋
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BT = String.fromCharCode(96);
const OUT = 'go/out';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const dict = JSON.parse(fs.readFileSync('src/i18n/ko.json', 'utf8'));
const keys = new Set(Object.keys(dict));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const normKeys = new Set();
for (const k of keys) normKeys.add(norm(k));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

function literals(src) {
  const res = [];
  let line = 1;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === BT) {
      const q = c;
      const startLine = line;
      let j = i + 1;
      let s = '';
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { s += src[j + 1] || ''; j += 2; continue; }
        if (ch === '\n') line++;
        if (ch === q) break;
        s += ch;
        j++;
      }
      res.push({ s, line: startLine });
      i = j + 1;
      continue;
    }
    i++;
  }
  return res;
}

const isProse = (s) => s.length >= 3 && s.length <= 500 &&
  /[A-Za-z]{2,}/.test(s) && /\s/.test(s) &&
  !/[\uAC00-\uD7A3]/.test(s) &&
  !/[{}<>]/.test(s) &&
  !/https?:\/\//.test(s) &&
  !/^[\w./\-]+$/.test(s);

const DIRS = ['src/data', 'src/story', 'src/ui', 'src/world', 'src/battle', 'src/scenes', 'src/script', 'src/core', 'src/state', 'src/render'];
const files = [];
for (const d of DIRS) for (const f of walk(d)) files.push(f);

const rows = [];
const miss = [];
const tmplMiss = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let total = 0; let m = 0; let tt = 0; let tm = 0;
  for (const it of literals(src)) {
    const s = it.s;
    if (/\{\d+\}/.test(s) && s.length <= 800) {
      tt++;
      if (!keys.has(s) && !keys.has(norm(s))) { tm++; tmplMiss.push({ file: f, line: it.line, s }); }
    }
    if (!isProse(s)) continue;
    total++;
    if (keys.has(s)) continue;
    m++;
    miss.push({ file: f, line: it.line, s, normHit: normKeys.has(norm(s)) });
  }
  if (total || tt) rows.push({ file: f, total, miss: m, tt, tm });
}
rows.sort((a, b) => b.miss - a.miss);

const lines = [];
lines.push('static prose total ' + rows.reduce((a, r) => a + r.total, 0) + ' missing ' + rows.reduce((a, r) => a + r.miss, 0));
lines.push('template total ' + rows.reduce((a, r) => a + r.tt, 0) + ' missing ' + tmplMiss.length);
lines.push('whitespace-normalized hits among missing: ' + miss.filter((x) => x.normHit).length + ' / ' + miss.length);
lines.push('');
for (const r of rows.filter((x) => x.miss > 0 || x.tm > 0)) lines.push(r.miss + '/' + r.total + ' tmpl ' + r.tm + '/' + r.tt + ' ' + r.file);
fs.writeFileSync(OUT + '/00-summary.md', lines.join('\n') + '\n');

function chunk(list, name, fmt, size) {
  for (let i = 0; i < list.length; i += size) {
    const part = list.slice(i, i + size).map(fmt).join('\n');
    fs.writeFileSync(OUT + '/' + name + '-' + String(i / size).padStart(2, '0') + '.md', part + '\n');
  }
}
chunk(miss, 'w', (x) => '- ' + x.file + ':' + x.line + ' | ' + norm(x.s).slice(0, 300), 20);
chunk(tmplMiss, 't', (x) => '- ' + x.file + ':' + x.line + ' | ' + norm(x.s).slice(0, 800), 8);

try {
  execSync('git config user.email ko3@local');
  execSync('git config user.name ko3');
  execSync('git add -A go/out');
  execSync('git commit -m "ko3: 정적 스캔 결과 [skip ci]"');
  execSync('git push');
  console.log('committed');
} catch (e) {
  console.log('commit failed ' + e.message.slice(0, 200));
}
console.log(lines.slice(0, 6).join('\n'));
