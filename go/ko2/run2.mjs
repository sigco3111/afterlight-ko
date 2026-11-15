// afterlight-ko 2차 러너 2: 사전 병합과 data/story 미번역 집계.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const log = (...a) => console.log('[ko2b]', ...a);
const git = (args) => execFileSync('git', args, { stdio: 'inherit' });

execFileSync('node', ['tools/merge-ko.mjs'], { stdio: 'inherit' });
const dict = JSON.parse(readFileSync('src/i18n/ko.json', 'utf8'));
log('사전 키: ' + Object.keys(dict).length);

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) walk(p);
    else if (/\.js$/.test(e.name)) files.push(p);
  }
})('src/data');
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) walk(p);
    else if (/\.js$/.test(e.name)) files.push(p);
  }
})('src/story');

const unq = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const byFile = {};
const sample = [];
let total = 0;
let untranslated = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let t = 0;
  let u = 0;
  lines.forEach((ln, i) => {
    if (/^\s*\/\//.test(ln)) return;
    const re = /['"]((?:[^'\\]|\\.){6,})['"]/g;
    let m;
    while ((m = re.exec(ln))) {
      const v = unq(m[1]);
      if (!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v)) continue;
      if (/^https?:/.test(v)) continue;
      t++;
      if (dict[v] === undefined) {
        u++;
        if (sample.length < 120) sample.push({ f, l: i + 1, t: v.slice(0, 120) });
      }
    }
  });
  if (t) byFile[f] = { total: t, untranslated: u };
  total += t;
  untranslated += u;
}
log('data·story 영문 리터럴 ' + total + ' / 사전 없음 ' + untranslated);
writeFileSync('go/ko2/report-data2.json', JSON.stringify({ dictKeys: Object.keys(dict).length, total, untranslated, byFile, sample }, null, 1) + '\n');

git(['config', 'user.name', 'ko2-bot']);
git(['config', 'user.email', 'ko2-bot@users.noreply.github.com']);
git(['add', 'src/i18n/ko.json', 'go/ko2/report-data2.json']);
try { git(['commit', '-m', 'i18n: 사전 병합·data/story 미번역 집계 (2차)']); } catch (e) { log('변경 없음'); }
try {
  git(['push', 'origin', 'HEAD:main']);
} catch (e) {
  log('push 재시도');
  git(['pull', '--rebase', '--autostash', 'origin', 'main']);
  git(['push', 'origin', 'HEAD:main']);
}
log('완료');
