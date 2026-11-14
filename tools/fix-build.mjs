// ko-build.yml 한 번 고치기(배포에 saves 포함, Pages 환경 URL 표현식 수정).
import { readFileSync, writeFileSync } from 'node:fs';
const f = '.github/workflows/ko-build.yml';
let s = readFileSync(f, 'utf8');
s = s.replace('      - name: .nojekyll',
  '      - name: playtest saves\n        run: cp -r saves dist/saves || true\n      - name: .nojekyll');
s = s.replace(/url: \$\{[^\n]*\}/, 'url: ' + String.fromCharCode(36) + '{{ steps.dep.outputs.page_url }}');
writeFileSync(f, s);
console.log(s.slice(-700));
