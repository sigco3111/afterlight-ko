// go/probe.mjs - 6차 러너: (1) 소스 문자열 스캔 (2) 브라우저 런타임 덤프
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'go/out';
mkdirSync(OUT, { recursive: true });
const PORT = 8099;
const log = (...a) => console.log(...a);

// ---------- 1) 스캔 ----------
const KO = (() => { try { return JSON.parse(readFileSync('src/i18n/ko.json', 'utf8')); } catch { return {}; } })();
const KO_N = Object.keys(KO).length;

function walk(dir, acc) {
  acc = acc || [];
  let es = [];
  try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|html)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function literals(src) {
  const out = [];
  let i = 0; let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; const ln = line; let s = ''; i++;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { const e = src[i + 1]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; i += 2; continue; }
        if (d === q) { i++; break; }
        if (d === '\n') line++;
        s += d; i++;
      }
      out.push({ s, line: ln });
      continue;
    }
    i++;
  }
  return out;
}

const ID_RE = /^[a-z0-9_.\-\/:#$@%]+$/;
function candidate(t) {
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (KO[t] !== undefined) return false;
  if (ID_RE.test(t)) return false;
  if (/^(https?:)?\/\//.test(t)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return false;
  if (/[\uAC00-\uD7A3]/.test(t)) return false;
  if (/=>|===|!==|&&|\|\||\$\{/.test(t)) return false;
  if (/^\s*(if|for|while|return|const|let|var|function|import|export|class|new|case|break|throw)\b/.test(t)) return false;
  if (/^[a-z]+\.[a-zA-Z]+$/.test(t)) return false;
  if (/^[A-Za-z0-9_]+\s*[:=]\s*[A-Za-z0-9_.-]+$/.test(t) && !/\s/.test(t.replace(':', ' '))) return false;
  return true;
}

const scan = {};
let scanTotal = 0;
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  const seen = new Set();
  for (const it of literals(src)) {
    if (seen.has(it.s) || !candidate(it.s)) continue;
    seen.add(it.s);
    (scan[f] = scan[f] || []).push({ line: it.line, s: it.s.length > 300 ? it.s.slice(0, 300) + '…' : it.s });
    scanTotal++;
  }
}
writeFileSync(OUT + '/scan.json', JSON.stringify({ dict: KO_N, total: scanTotal, files: scan }, null, 1));
const scanRanked = Object.entries(scan).sort((a, b) => b[1].length - a[1].length);
let md = '# 6차 스캔 (사전 ' + KO_N + '키, 미번역 후보 ' + scanTotal + ')\n\n';
for (const it of scanRanked) md += '- ' + it[0] + ': ' + it[1].length + '\n';
writeFileSync(OUT + '/scan.md', md);
log('scan: ' + scanTotal + ' candidates, dict ' + KO_N);

// ---------- 2) 런타임 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', glb: 'model/gltf-binary', gltf: 'model/gltf+json', wasm: 'application/wasm', ico: 'image/x-icon', txt: 'text/plain' };
function resolve(p) {
  const cands = ['dist' + p, 'dist' + p + '/index.html', '.' + p, '.' + p + '/index.html'];
  for (const c of cands) {
    if (!existsSync(c)) continue;
    try { readdirSync(c); continue; } catch { return c; }
  }
  return null;
}
const srv = createServer((req, res) => {
  const p0 = decodeURIComponent((req.url || '/').split('?')[0]);
  const p = p0 === '/' ? '/index.html' : p0;
  const f = resolve(p);
  if (!f) { res.writeHead(404); res.end('nf'); return; }
  const ext = (f.split('.').pop() || '').toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

const INIT = "(() => { window.__cap = new Set(); const P = CanvasRenderingContext2D.prototype; for (const m of ['fillText','strokeText']) { const o = P[m]; P[m] = function (s, ...a) { try { if (typeof s === 'string' && s.trim()) window.__cap.add(s); } catch (e) {} return o.call(this, s, ...a); }; } })();";

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(INIT);

const BASEURL = 'http://127.0.0.1:' + PORT;
const results = [];
async function run(name, url, ms, keys, shot) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  try { await page.goto(BASEURL + url, { waitUntil: 'load', timeout: 40000 }); } catch (e) { errs.push('goto: ' + String(e.message).slice(0, 200)); }
  await page.waitForTimeout(ms);
  const steps = [];
  const grab = async (label) => {
    const texts = await page.evaluate(() => Array.from(window.__cap || [])).catch(() => []);
    const dom = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 4000) : '')).catch(() => '');
    steps.push({ label, texts, dom });
  };
  await grab('load');
  if (shot) { try { await page.screenshot({ path: OUT + '/shot-' + shot + '.png' }); } catch (e) {} }
  for (const k of keys) {
    try { await page.keyboard.press(k); } catch (e) {}
    await page.waitForTimeout(800);
    await grab('key:' + k);
  }
  results.push({ name, url, errs, steps, canvas: Array.from(new Set(steps.flatMap((s) => s.texts))), dom: steps.length ? steps[steps.length - 1].dom : '' });
  log('scenario ' + name + ': ' + (results[results.length - 1].canvas.length) + ' canvas strings, errs ' + errs.length);
  await page.close();
}

const scen = [];
scen.push(['title', '/?lang=ko', 4500, ['Enter', 'ArrowDown', 'Enter'], 'title']);
let saves = [];
try { saves = readdirSync('saves').filter((f) => f.endsWith('.json')).sort(); } catch (e) {}
if (saves.length > 26) { const step = Math.ceil(saves.length / 26); saves = saves.filter((f, i) => i % step === 0); }
let si = 0;
for (const f of saves) { si++; scen.push(['save:' + f.replace(/\.json$/, ''), '/?lang=ko&load=saves/' + encodeURIComponent(f), 3200, ['KeyC', 'ArrowDown', 'KeyZ', 'Escape'], si <= 3 ? 'save' + si : null]); }
let mapIds = [];
try { mapIds = readdirSync('src/data/maps').filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.replace(/\.js$/, '')); } catch (e) {}
const base = mapIds[0] || '';
const MENUS = ['main', 'items', 'crests', 'arts', 'supports', 'equip', 'status', 'formation', 'settings', 'bestiary', 'journal', 'guide', 'world'];
for (const m of MENUS) scen.push(['menu:' + m, '/?lang=ko&map=' + encodeURIComponent(base) + '&menu=' + m, 4000, ['ArrowDown', 'ArrowDown', 'KeyZ', 'Escape'], m === 'main' ? 'menu-main' : (m === 'items' ? 'menu-items' : null)]);
let shops = [];
try { const src = readFileSync('src/data/shops.js', 'utf8'); shops = Array.from(src.matchAll(/^\s{2}([a-z0-9_]+)\s*:/gm)).map((m) => m[1]).slice(0, 3); } catch (e) {}
for (const sh of shops) scen.push(['shop:' + sh, '/?lang=ko&map=' + encodeURIComponent(base) + '&menu=shop:' + sh, 4000, ['ArrowDown', 'KeyZ', 'Escape'], null]);
let troops = [];
try { const src = readFileSync('src/data/troops.js', 'utf8'); troops = Array.from(src.matchAll(/^\s{2}([a-z0-9_]+)\s*:/gm)).map((m) => m[1]).slice(0, 2); } catch (e) {}
for (const tr of troops) scen.push(['battle:' + tr, '/?lang=ko&map=' + encodeURIComponent(base) + '&battle=' + tr, 6000, ['KeyZ', 'KeyZ', 'ArrowDown', 'KeyZ', 'KeyZ'], 'battle']);
log('scenarios: ' + scen.length);
for (const s of scen) { try { await run(s[0], s[1], s[2], s[3], s[4]); } catch (e) { results.push({ name: s[0], url: s[1], errs: ['run: ' + String(e.message).slice(0, 300)], steps: [], canvas: [], dom: '' }); } }

await browser.close();
srv.close();

// ---------- 3) 집계 ----------
const all = new Map();
for (const r of results) for (const s of r.canvas) { const k = s.trim(); if (!k) continue; all.set(k, (all.get(k) || 0) + 1); }
const untr = [];
for (const k of all.keys()) {
  if (k.length < 2) continue;
  if (!/[A-Za-z]{2}/.test(k)) continue;
  if (/[\uAC00-\uD7A3]/.test(k)) continue;
  untr.push(k);
}
untr.sort();
const scenOut = results.map((r) => ({ name: r.name, url: r.url, errs: r.errs.slice(0, 6), canvas: r.canvas, dom: r.dom }));
writeFileSync(OUT + '/runtime.json', JSON.stringify({ scenarios: scenOut, untranslated: untr }, null, 1));
writeFileSync(OUT + '/runtime.txt', untr.join('\n'));
const domEn = new Set();
for (const r of results) for (const line of (r.dom || '').split('\n')) { const t = line.trim(); if (t.length > 1 && /[A-Za-z]{2}/.test(t) && !/[\uAC00-\uD7A3]/.test(t)) domEn.add(t); }
writeFileSync(OUT + '/dom-en.txt', Array.from(domEn).sort().join('\n'));
let sum = '# 6차 런타임 덤프\n\n- 시나리오: ' + results.length + '\n- 캔버스에서 그려진 서로 다른 문자열: ' + all.size + '\n- 그중 한글 없는 문자열: ' + untr.length + '\n- DOM 영어 줄: ' + domEn.size + '\n\n## 시나리오\n';
for (const r of results) sum += '- ' + r.name + ': canvas ' + r.canvas.length + ', errs ' + r.errs.length + (r.errs.length ? ' [' + r.errs[0] + ']' : '') + '\n';
writeFileSync(OUT + '/summary.md', sum);
log('done: ' + untr.length + ' untranslated in runtime, ' + all.size + ' total drawn');
