// 임시 복원 스크립트
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
const sh = (c) => execSync(c).toString();
const sha = sh('git log --format=%H --grep="마크업 보존 포함" -1').trim();
const body = sh('git show ' + sha + ':i18n/parts/zz-scan-tpl.json');
writeFileSync('i18n/parts/zz-scan-tpl.json', body);
const n = Object.keys(JSON.parse(readFileSync('i18n/parts/zz-scan-tpl.json', 'utf8'))).length;
console.log('restored from ' + sha + ' entries ' + n);
execSync('git config user.name "ko-scan-bot"');
execSync('git config user.email "ko-scan-bot@users.noreply.github.com"');
execSync('git add i18n/parts/zz-scan-tpl.json');
execSync('git diff --cached --quiet || git commit -m ' + JSON.stringify('i18n: 템플릿 사전 복원 [skip ci]'));
execSync('git push');
