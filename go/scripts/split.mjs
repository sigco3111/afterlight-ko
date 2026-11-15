import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dict = {};
for (const f of readdirSync('i18n/parts').filter((x) => x.endsWith('.json'))) {
  const o = JSON.parse(readFileSync('i18n/parts/' + f, 'utf8'));
  for (const [k, v] of Object.entries(o)) dict[k] = v;
}

const files = [
  'src/story/side.js',
  'src/data/content/ch11.js',
  'src/data/content/postgame_battle.js',
  'src/data/content/postgame_items.js',
  'src/data/content/postgame.js',
];

function litsOf(src) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) {
    const v = m[1].replace(/\\(.)/g, '$1');
    if (/[A-Za-z]+\s+[A-Za-z]+/.test(v)) out.push(v);
  }
  return [...new Set(out)];
}

mkdirSync('go/out', { recursive: true });
const summary = {};
for (const f of files) {
  const slug = f.replace(/^src\//, '').replace(/[\/.]/g, '-');
  let src = '';
  try { src = readFileSync(f, 'utf8'); } catch (e) { summary[f] = 'missing'; continue; }
  const miss = litsOf(src).filter((v) => dict[v] === undefined);
  summary[f] = miss.length;
  for (let i = 0, n = 0; i < miss.length; i += 60, n++) {
    writeFileSync('go/out/' + slug + '-' + n + '.json', JSON.stringify(miss.slice(i, i + 60), null, 1));
  }
}
writeFileSync('go/out/summary.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));

// 트리거 재시도
