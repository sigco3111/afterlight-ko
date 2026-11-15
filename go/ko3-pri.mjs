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

const PRI = [
  'src/ui', 'src/battle', 'src/world', 'src/data/artInfo.js', 'src/data/monsterInfo.js',
  'src/data/statuses.js', 'src/data/skills.js', 'src/data/passives.js', 'src/data/equipment.js',
  'src/data/items.js', 'src/data/fish.js', 'src/data/hunt.js', 'src/data/links.js',
  'src/data/shops.js', 'src/data/characters.js', 'src/data/objectives', 'src/data/crests.js',
  'src/data/tutorials.js', 'src/story/opening.js', 'src/story/prologue.js', 'src/story/fishing.js',
  'src/story/chapters.js', 'src/story/newGame.js'
];
const files = [];
for (const p of PRI) {
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isDirectory()) { for (const f of walk(p)) files.push(f); } else files.push(p);
}
const lines = [];
const seen = new Set();
let total = 0;
const perFile = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rows = [];
  for (const it of literals(src)) {
    const s = it.s;
    if (!isProse(s)) continue;
    if (keys.has(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    rows.push(it.line + ' | ' + norm(s).replace(/\|/g, '/'));
  }
  if (!rows.length) continue;
  total += rows.length;
  const base = f.replace(/^src\//, '').replace(/[\/.]/g, '_');
  fs.writeFileSync(OUT + '/' + base + '.md', rows.join('\n') + '\n');
  perFile.push(base + ' ' + rows.length);
}
fs.writeFileSync(OUT + '/00-list.md', 'total ' + total + '\n' + perFile.join('\n') + '\n');

try {
  execSync('git config user.email ko3@local');
  execSync('git config user.name ko3');
  execSync('git add -A go/pri');
  execSync('git commit -m "ko3: 우선순위 미번역 목록 [skip ci]"');
  execSync('git push');
  console.log('committed');
} catch (e) {
  console.log('commit failed ' + e.message.slice(0, 200));
}
console.log('total ' + total);
