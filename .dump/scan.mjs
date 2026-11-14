import fs from 'node:fs';
import path from 'node:path';
const ko = JSON.parse(fs.readFileSync('src/i18n/ko.json', 'utf8'));
const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (p.endsWith('.js')) o.push(p);
  }
  return o;
};
const out = {};
let total = 0;
const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const f of walk('src')) {
  if (f.startsWith('src/i18n')) continue;
  const src = fs.readFileSync(f, 'utf8');
  const set = new Set();
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(src))) {
    const q = m[1];
    const s = m[2];
    if (q === '`' && s.includes('${')) continue;
    if (s.length < 3 || s.length > 400) continue;
    if (!/[A-Za-z]/.test(s)) continue;
    if (!/\s/.test(s)) continue;
    if (/^(\.|\/|#|http|data:|@)/.test(s)) continue;
    if (/^[a-z][a-z0-9_-]*$/.test(s)) continue;
    if (ko[s] !== undefined) continue;
    set.add(s);
  }
  if (set.size) {
    out[f] = [...set];
    total += set.size;
  }
}
fs.writeFileSync('.dump/missing.json', JSON.stringify(out, null, 1));
const stat = ['files ' + Object.keys(out).length + ' strings ' + total];
for (const [k, v] of Object.entries(out)) stat.push(k + ' ' + v.length);
fs.writeFileSync('.dump/stat.txt', stat.join('\n'));
console.log(stat.join('\n'));
