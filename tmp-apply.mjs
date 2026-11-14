import fs from 'fs';
const dir = 'inbox';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
const msgs = [];
for (const f of files) {
const p = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
const path = 'i18n/parts/' + p.part + '.json';
let base = {};
if (fs.existsSync(path)) base = JSON.parse(fs.readFileSync(path, 'utf8'));
Object.assign(base, p.map);
fs.writeFileSync(path, JSON.stringify(base) + '\n');
fs.rmSync(dir + '/' + f);
msgs.push(p.msg || ('ko: ' + p.part));
console.log(p.part + ' +' + Object.keys(p.map).length);
}
fs.writeFileSync('/tmp/msg.txt', msgs.length ? msgs.join(' / ') : 'noop');
