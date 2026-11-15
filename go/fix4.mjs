// 임시 사전 재구성 스크립트 2 (go/ 전용, 작업이 끝나면 삭제)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sha = execSync('git log --format=%H -- go/report/tpl-0.json').toString().trim().split('\n').pop();
const files = execSync('git ls-tree --name-only ' + sha + ' go/report/').toString().trim().split('\n').filter((f) => f.indexOf('/tpl-') >= 0);
const report = [];
for (const f of files) { for (const e of JSON.parse(execSync('git show ' + sha + ':' + f).toString())) report.push(e); }
const unesc = (s) => s.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
const FIX = JSON.parse(readFileSync('go/fix.json', 'utf8'));
const SUBS = {};
for (const p of ['go/fix3.json', 'go/fix3b.json']) {
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(j)) SUBS[k] = v;
}
const dict = {}; const skipped = []; const partial = [];
for (const [id, ko] of Object.entries(FIX)) {
  const [pos, sub] = id.split('|');
  const cands = report.filter((e) => e.f + ':' + e.l === pos && (!sub || e.k.indexOf(sub) >= 0));
  if (!cands.length) { skipped.push(id + ' (no entry)'); continue; }
  for (const c of cands) {
    const key = unesc(c.k);
    if (key.indexOf('<') >= 0) {
      const pairs = SUBS[id];
      if (!pairs) { skipped.push(id + ' (markup)'); continue; }
      let v = key; let miss = 0;
      for (const [a, b] of pairs) { if (v.indexOf(a) < 0) { miss++; continue; } v = v.split(a).join(b); }
      if (miss) partial.push(id + ' missing ' + miss + '/' + pairs.length);
      dict[key] = v; continue;
    }
    dict[key] = ko;
  }
}
writeFileSync('i18n/parts/zz-scan-tpl.json', JSON.stringify(dict, null, 1) + '\n');
writeFileSync('go/fix4-report.json', JSON.stringify({ sha, report: report.length, entries: Object.keys(dict).length, skipped: skipped.length, skippedIds: skipped, partial }, null, 1));
console.log(JSON.stringify({ entries: Object.keys(dict).length, skipped: skipped.length, partial: partial.length }));
execSync('git config user.name "ko-scan-bot"');
execSync('git config user.email "ko-scan-bot@users.noreply.github.com"');
execSync('git add i18n/parts/zz-scan-tpl.json go/fix4-report.json');
execSync('git diff --cached --quiet || git commit -m ' + JSON.stringify('i18n: 템플릿 사전 재구성(마크업 보존 포함) [skip ci]'));
execSync('git push');
