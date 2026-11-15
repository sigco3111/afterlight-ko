import { readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (existsSync('go/out')) rmSync('go/out', { recursive: true, force: true });
for (const f of ['go/split.mjs', 'go/scripts/split.mjs', '.github/workflows/ko4-tmp.yml']) {
  rmSync(f, { force: true });
}
mkdirSync('go/out', { recursive: true });
execSync('git add -A', { stdio: 'inherit' });
execSync('git -c user.name=sigco3111 -c user.email=sigco3111@users.noreply.github.com commit -m "정리: 4차 임시 추출 워크플로·스크립트 삭제 [skip ci]"', { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });
