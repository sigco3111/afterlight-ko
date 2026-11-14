import fs from 'fs';
const dict = JSON.parse(fs.readFileSync('src/i18n/ko.json', 'utf8'));
const srcs = process.argv.slice(2);
const re = /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g;
const all = [];
for (const f of srcs) {
const text = fs.readFileSync(f, 'utf8');
const found = [];
let m;
while ((m = re.exec(text))) {
let raw = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]);
if (m[3] !== undefined && raw.includes('${')) continue;
let s = raw;
if (m[2] !== undefined) { try { s = JSON.parse('"' + raw + '"'); } catch (e) { s = raw; } }
else if (m[1] !== undefined) { s = raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\'); }
s = s.trim();
if (s.length < 2) continue;
if (!/[A-Za-z]/.test(s)) continue;
if (/^[a-z][a-zA-Z0-9]*$/.test(s)) continue;
if (s.startsWith('.') || s.startsWith('/') || s.startsWith('#')) continue;
if (s.includes('://')) continue;
if (/^[A-Za-z0-9_-]+\\.(js|css|png|json|mp3|ogg|webp)$/.test(s)) continue;
if (/^[a-z0-9_-]+$/.test(s)) continue;
if (dict[s] !== undefined) continue;
if (found.indexOf(s) >= 0) continue;
found.push(s);
}
all.push({ file: f, items: found });
}
fs.rmSync('_extract', { recursive: true, force: true });
fs.mkdirSync('_extract', { recursive: true });
fs.writeFileSync('_extract/summary.json', JSON.stringify(all.map(a => a.file + ':' + a.items.length)));
let n = 0, buf = [], size = 2, idx = 1;
function flush() {
if (!buf.length) return;
fs.writeFileSync('_extract/miss-' + String(idx).padStart(2, '0') + '.json', JSON.stringify(buf, null, 0));
idx++; buf = []; size = 2;
}
for (const a of all) { for (const s of a.items) { if (size + s.length + 4 > 4200) flush(); buf.push(s); size += s.length + 4; n++; } }
flush();
console.log('total missing ' + n + ' chunks ' + (idx - 1) + ' ' + JSON.stringify(all.map(a => a.file + ':' + a.items.length)));
