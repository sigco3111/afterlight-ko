import fs from 'node:fs';
const ko = JSON.parse(fs.readFileSync('src/i18n/ko.json', 'utf8'));
const list = (d, re) => fs.readdirSync(d).filter((f) => re.test(f)).map((f) => d + '/' + f);
const generic = (src, out) => {
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const q = m[1];
    const s = m[2];
    if (q === '`' && s.includes('${')) continue;
    if (s.length < 2 || s.length > 500) continue;
    if (!/[A-Za-z]/.test(s)) continue;
    if (ko[s] !== undefined) continue;
    out.add(s);
  }
};
const keyed = (src, out) => {
  const re = /(?:name|region|label|title|area|place|sub|text)\s*:\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[2];
    if (s.length < 2 || s.length > 500) continue;
    if (!/[A-Za-z]/.test(s)) continue;
    if (ko[s] !== undefined) continue;
    out.add(s);
  }
};
const groups = {
  ch2: [],
  tutorial: ['src/data/tutorials.js', 'src/ui/Tutorial.js'],
  battle: list('src/battle', /^[A-Za-z]+\.js$/),
  maps: list('src/data/maps', /^[A-Za-z0-9_]+\.js$/),
};
for (const f of fs.readdirSync('src/story')) if (/^ch2_/.test(f)) groups.ch2.push('src/story/' + f);
for (const f of list('src/data/maps', /^ch2_/)) groups.ch2.push(f);
for (const f of fs.readdirSync('src/data/maps/layouts')) groups.maps.push('src/data/maps/layouts/' + f);
const res = {};
for (const [k, files] of Object.entries(groups)) {
  const out = new Set();
  for (const f of files) {
    let src = '';
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (k === 'maps') keyed(src, out);
    else generic(src, out);
  }
  res[k] = [...out];
}
const lines = [];
for (const [k, v] of Object.entries(res)) {
  fs.writeFileSync('.dump/cat/' + k + '.json', JSON.stringify(v, null, 1));
  lines.push(k + ' ' + v.length);
}
lines.push('ko ' + Object.keys(ko).length);
fs.writeFileSync('.dump/stat3.txt', lines.join('\n'));
console.log(lines.join('\n'));
