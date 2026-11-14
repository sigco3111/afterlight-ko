// 정리용 임시 스크립트: go/, tmp/, tools/go-run.mjs 를 지우고 커밋한다(작업 후 삭제).
import { rmSync, existsSync } from 'node:fs';
for (const p of ['go', 'tmp', 'tools/go-run.mjs']) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  console.log('removed ' + p);
}
