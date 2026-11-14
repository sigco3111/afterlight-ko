// i18n/parts/*.json 을 합쳐 src/i18n/ko.json 을 만든다. 빌드 전에 실행한다.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dir = 'i18n/parts';
const out = {};
let files = [];
try { files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); } catch { files = []; }
for (const f of files) {
  const part = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
  for (const [k, v] of Object.entries(part)) {
    if (out[k] !== undefined && out[k] !== v) console.warn('중복 키: ' + k);
    out[k] = v;
  }
}
mkdirSync('src/i18n', { recursive: true });
writeFileSync('src/i18n/ko.json', JSON.stringify(out));
console.log('ko.json: ' + Object.keys(out).length + ' entries from ' + files.length + ' parts');
