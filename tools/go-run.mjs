// go/ 트리거 시 1회 실행되는 임시 작업 스크립트(작업 후 삭제).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('tmp', { recursive: true });
const files = ['src/story/postgame.js'];
const LIMIT = 20000;
let n = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  let buf = [];
  let len = 0;
  const flush = () => {
    if (!buf.length) return;
    n += 1;
    writeFileSync('tmp/pg-' + n + '.txt', buf.join('\n') + '\n');
    buf = [];
    len = 0;
  };
  for (const line of lines) {
    if (len + line.length + 1 > LIMIT) flush();
    buf.push(line);
    len += line.length + 1;
  }
  flush();
}
writeFileSync('tmp/info.txt', 'chunks=' + n + '\n');
console.log('chunks ' + n);
