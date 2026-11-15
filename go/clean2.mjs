import { execSync } from 'node:child_process';
execSync('git config user.name "ko-scan-bot"');
execSync('git config user.email "ko-scan-bot@users.noreply.github.com"');
execSync('git rm -r -q --ignore-unmatch go');
execSync('git rm -q --ignore-unmatch .github/workflows/go-restore.yml .github/workflows/go-clean2.yml');
execSync('git commit -m ' + JSON.stringify('정리: 임시 워크플로·스크립트 삭제 [skip ci]'));
execSync('git push');
console.log('cleaned');
