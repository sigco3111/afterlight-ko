// afterlight-ko 2차 러너: 도움말 문단 t() 적용, 타이틀 부제 번역, 용어집 추가, 미번역 스캔 보고.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const log = (...a) => console.log('[ko2]', ...a);

const A = JSON.parse(readFileSync('go/ko2/guide-a.json', 'utf8'));
const B = JSON.parse(readFileSync('go/ko2/guide-b.json', 'utf8'));
const labels = A.labels.concat(B.labels);
const bodies = A.bodies.concat(B.bodies);
const subtitle = B.subtitle;

function ensureImport(src, rel) {
  const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp("import \\{([^}]*)\\} from '" + esc + "';");
  const m = src.match(re);
  if (!m) throw new Error('import 없음: ' + rel);
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  if (names.includes('t')) return src;
  names.push('t');
  return src.replace(re, "import { " + names.join(', ') + " } from '" + rel + "';");
}

const dict = {};
let sc = readFileSync('src/ui/menu/screens.js', 'utf8');
if (sc.includes('].map(([a, b]) => [t(a), t(b)])')) {
  log('GUIDE 이미 적용됨');
} else {
  const s0 = sc.indexOf('export const GUIDE = [');
  if (s0 < 0) throw new Error('GUIDE를 찾지 못함');
  const open = sc.indexOf('[', s0);
  const end = sc.indexOf('\n];', open);
  if (end < 0) throw new Error('GUIDE 끝을 찾지 못함');
  const inner = sc.slice(open + 1, end + 1);
  const arr = new Function('return [' + inner + ']')();
  if (arr.length !== labels.length || arr.length !== bodies.length) {
    throw new Error('도움말 개수 불일치: ' + arr.length + ' / ' + labels.length + ' / ' + bodies.length);
  }
  for (let i = 0; i < arr.length; i++) {
    dict[arr[i][0]] = labels[i];
    dict[arr[i][1]] = bodies[i];
  }
  sc = sc.slice(0, end + 1) + '].map(([a, b]) => [t(a), t(b)])' + sc.slice(end + 2);
  sc = ensureImport(sc, '../../i18n/index.js');
  writeFileSync('src/ui/menu/screens.js', sc);
  log('GUIDE ' + arr.length + '개 t() 적용');
}

const SUB = 'A coming-of-age at the end of the world';
let ts = readFileSync('src/scenes/TitleScene.js', 'utf8');
if (ts.includes('<div class="ts-pre">{4}</div>')) {
  log('타이틀 이미 적용됨');
  dict[SUB] = subtitle;
} else {
  const pre = '<div class="ts-pre">' + SUB + '</div>';
  if (!ts.includes(pre)) throw new Error('타이틀 부제를 찾지 못함');
  ts = ts.replace(pre, '<div class="ts-pre">{4}</div>');
  const tail = "keysFor('menu')[0] ?? 'Esc');";
  if (!ts.includes(tail)) throw new Error('타이틀 fmt 인자 끝을 찾지 못함');
  ts = ts.replace(tail, "keysFor('menu')[0] ?? 'Esc', t('" + SUB + "'));");
  ts = ensureImport(ts, '../i18n/index.js');
  writeFileSync('src/scenes/TitleScene.js', ts);
  dict[SUB] = subtitle;
  log('타이틀 부제 번역 적용');
}

dict['Guide'] = '도움말';
writeFileSync('i18n/parts/zz-ko2-guide.json', JSON.stringify(dict, null, 1) + '\n');
log('사전 ' + Object.keys(dict).length + '키 추가');

let gl = readFileSync('docs/glossary.md', 'utf8');
const add = readFileSync('go/ko2/glossary-add.md', 'utf8');
if (!gl.includes('## 도움말·UI 표기 (2차)')) {
  writeFileSync('docs/glossary.md', gl.replace(/\s*$/, '') + '\n' + add);
  log('용어집 2차 표기 추가');
}

const changed = ['src/ui/menu/screens.js', 'src/scenes/TitleScene.js'];
for (const f of changed) {
  try {
    execFileSync('node', ['--check', f], { encoding: 'utf8', stdio: 'pipe' });
    log('syntax ok: ' + f);
  } catch (e) {
    const msg = String(e.stderr || e.message);
    if (/Cannot use import statement|Unexpected token 'export'/.test(msg)) log('ESM 검사 생략: ' + f);
    else throw new Error('문법 오류: ' + f + '\n' + msg);
  }
}

execFileSync('node', ['tools/merge-ko.mjs'], { stdio: 'inherit' });
const dictAll = JSON.parse(readFileSync('src/i18n/ko.json', 'utf8'));

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(e.name)) files.push(p);
  }
})('src');
const unq = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const missing = [];
const english = [];
const fill = [];
for (const f of files) {
  if (f.startsWith('src/i18n/')) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const re = /\b(fmt|t)\(\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(ln))) {
      const k = unq(m[2]);
      if (k.length > 1 && dictAll[k] === undefined) missing.push({ f, l: i + 1, k });
    }
    if (ln.indexOf('fillText(') >= 0) fill.push({ f, l: i + 1, t: ln.trim().slice(0, 120) });
    if (/^src\/(data|story)\//.test(f) && !/^\s*\/\//.test(ln)) {
      const re2 = /['"]((?:[^'\\]|\\.){6,})['"]/g;
      let mm;
      while ((mm = re2.exec(ln))) {
        const v = unq(mm[1]);
        if (!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v)) continue;
        if (/^https?:/.test(v)) continue;
        english.push({ f, l: i + 1, t: v.slice(0, 160) });
      }
    }
  });
}
writeFileSync('go/ko2/report-fmt.json', JSON.stringify({ dictKeys: Object.keys(dictAll).length, count: missing.length, items: missing.slice(0, 300) }, null, 1) + '\n');
writeFileSync('go/ko2/report-data.json', JSON.stringify({ dataStoryCount: english.length, fillTextCount: fill.length, dataStory: english.slice(0, 220), fillText: fill.slice(0, 80) }, null, 1) + '\n');
log('미번역 fmt/t: ' + missing.length + ' / data·story 영문: ' + english.length + ' / fillText: ' + fill.length);

const git = (args) => execFileSync('git', args, { stdio: 'inherit' });
git(['config', 'user.name', 'ko2-bot']);
git(['config', 'user.email', 'ko2-bot@users.noreply.github.com']);
const commits = [
  { msg: 'i18n: 도움말 문단 t() 적용·한국어 번역 (2차) [skip ci]', files: ['src/ui/menu/screens.js', 'i18n/parts/zz-ko2-guide.json'] },
  { msg: 'i18n: 타이틀 부제 한국어 표시 [skip ci]', files: ['src/scenes/TitleScene.js'] },
  { msg: 'i18n: 사전 병합·용어집 2차 표기 추가', files: ['src/i18n/ko.json', 'docs/glossary.md'] },
  { msg: 'ko2: 미번역 스캔 보고서 [skip ci]', files: ['go/ko2/report-fmt.json', 'go/ko2/report-data.json'] },
];
for (const c of commits) {
  git(['add'].concat(c.files));
  try { git(['commit', '-m', c.msg]); } catch (e) { log('변경 없음: ' + c.msg); }
}
git(['push', 'origin', 'HEAD:main']);
log('완료');
