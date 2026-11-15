import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';

const dict = {};
for (const f of readdirSync('i18n/parts').filter((x) => x.endsWith('.json'))) {
  const o = JSON.parse(readFileSync('i18n/parts/' + f, 'utf8'));
  for (const [k, v] of Object.entries(o)) dict[k] = v;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = dir + '/' + name;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

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
const per = {};
const group = {};
let total = 0;
for (const f of walk('src', []).sort()) {
  const src = readFileSync(f, 'utf8');
  const miss = litsOf(src).filter((v) => dict[v] === undefined);
  if (!miss.length) continue;
  per[f] = miss.length;
  total += miss.length;
  const g = f.split('/').slice(0, 3).join('/');
  group[g] = (group[g] || 0) + miss.length;
  const slug = f.replace(/^src\//, '').replace(/[\/.]/g, '-');
  for (let i = 0, n = 0; i < miss.length; i += 60, n++) {
    writeFileSync('go/out/' + slug + '-' + n + '.json', JSON.stringify(miss.slice(i, i + 60), null, 1));
  }
}
writeFileSync('go/out/summary-all.json', JSON.stringify({ dict: Object.keys(dict).length, total, per, group }, null, 1));
console.log('total ' + total);
