// go/probe8.mjs - 8차 러너: (1) 소스 문장 스캔 (2) 런타임 영어 잔여 덤프
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'go/out8';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const KO = (() => { try { return JSON.parse(readFileSync('src/i18n/ko.json', 'utf8')); } catch { return {}; } })();
const KO_N = Object.keys(KO).length;
const CJK = /[\uAC00-\uD7A3]/;
const LAT = /[A-Za-z]{2}/;
const BT = String.fromCharCode(96);

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
    if (c === '"' || c === "'" || c === BT) {
      const q = c; const ln = line; let s = '';
      i++;
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

// 진짜 사람이 읽는 문장만: 마크업·CSS·식별자·템플릿 조각 제외
function human(t) {
  if (t.length < 6 || t.length > 500) return false;
  if (!LAT.test(t)) return false;
  if (CJK.test(t)) return false;
  if (KO[t] !== undefined) return false;
  if (!/\s/.test(t)) return false;
  if (/\$\{/.test(t)) return false;
  if (/[{};]|=>|===|!==|&&|\|\|/.test(t)) return false;
  if (/<[A-Za-z\/!]/.test(t)) return false;
  if (/(px|rem|em|rgba?|vh|vw)\b\s*[;,)]/.test(t)) return false;
  if (/https?:/.test(t)) return false;
  if (/^[.#@]/.test(t.trim())) return false;
  const words = t.trim().split(/\s+/);
  if (words.length < 2) return false;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters / t.length < 0.55) return false;
  if (!/[A-Z"'(]/.test(t)) return false;
  return true;
}

function chunk(name, lines, limit) {
  let buf = []; let idx = 1; let size = 0;
  const flush = () => {
    if (!buf.length) return;
    const fn = OUT + '/' + name + '-' + String(idx).padStart(2, '0') + '.txt';
    writeFileSync(fn, buf.join('\n'));
    idx++; buf = []; size = 0;
  };
  for (const ln of lines) {
    if (size + ln.length + 1 > limit) flush();
    buf.push(ln); size += ln.length + 1;
  }
  flush();
  return idx - 1;
}

// ---------- 1) 소스 문장 스캔 ----------
const files = walk('src').filter((f) => !f.startsWith('src/data/maps/'));
const rows = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const seen = new Set();
  for (const it of literals(src)) {
    const t = it.s;
    if (seen.has(t) || !human(t)) continue;
    seen.add(t);
    rows.push(f + ':' + it.line + ': ' + t.replace(/\s+/g, ' ').slice(0, 300));
  }
}
writeFileSync(OUT + '/scan8.txt', rows.join('\n'));
const nScan = chunk('scan8', rows, 3000);
log('scan8: ' + rows.length + ' candidates (files ' + files.length + '), dict ' + KO_N + ', chunks ' + nScan);

// ---------- 2) 런타임 덤프 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', glb: 'model/gltf-binary', gltf: 'model/gltf+json', wasm: 'application/wasm', ico: 'image/x-icon', txt: 'text/plain' };
function resolve(p) {
  const cands = ['dist' + p, 'dist' + p + '/index.html', '.' + p, '.' + p + '/index.html'];
  for (const c of cands) {
    if (!existsSync(c)) continue;
    try { readdirSync(c); continue; } catch { return c; }
  }
  return null;
}
const PORT = 8099;
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

async function run(name, url, ms, keys) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  try { await page.goto(BASEURL + url, { waitUntil: 'load', timeout: 40000 }); }
  catch (e) { errs.push('goto: ' + String(e.message).slice(0, 200)); }
  await page.waitForTimeout(ms);
  const steps = [];
  const grab = async (label) => {
    const texts = await page.evaluate(() => Array.from(window.__cap || [])).catch(() => []);
    const dom = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 6000) : '')).catch(() => '');
    steps.push({ label, texts, dom });
  };
  await grab('load');
  for (const k of keys) {
    try { await page.keyboard.press(k); } catch (e) {}
    await page.waitForTimeout(700);
    await grab('key:' + k);
  }
  const canvas = Array.from(new Set(steps.flatMap((s) => s.texts)));
  results.push({ name, url, errs, canvas, dom: steps.length ? steps[steps.length - 1].dom : '' });
  log('scenario ' + name + ': ' + canvas.length + ' canvas strings, errs ' + errs.length);
  await page.close();
}

const scen = [];
scen.push(['title', '/?lang=ko', 4500, ['Enter', 'ArrowDown', 'Enter']]);
let saves = [];
try { saves = readdirSync('saves').filter((f) => f.endsWith('.json')).sort(); } catch (e) {}
if (saves.length > 26) { const step = Math.ceil(saves.length / 26); saves = saves.filter((f, i) => i % step === 0); }
for (const f of saves) scen.push(['save:' + f.replace(/\.json$/, ''), '/?lang=ko&load=saves/' + encodeURIComponent(f), 3000, ['KeyC', 'ArrowDown', 'KeyZ', 'Escape']]);
let mapIds = [];
try { mapIds = readdirSync('src/data/maps').filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.replace(/\.js$/, '')); } catch (e) {}
const base = mapIds[0] || '';
const MENUS = ['main', 'items', 'crests', 'arts', 'supports', 'equip', 'status', 'formation', 'settings', 'bestiary', 'journal', 'guide', 'world'];
for (const m of MENUS) scen.push(['menu:' + m, '/?lang=ko&map=' + encodeURIComponent(base) + '&menu=' + m, 3200, ['ArrowDown', 'ArrowDown', 'KeyZ', 'Escape']]);
let shops = [];
try { const src = readFileSync('src/data/shops.js', 'utf8'); shops = Array.from(src.matchAll(/^\s{2}([a-z0-9_]+)\s*:/gm)).map((x) => x[1]).slice(0, 3); } catch (e) {}
for (const sh of shops) scen.push(['shop:' + sh, '/?lang=ko&map=' + encodeURIComponent(base) + '&menu=shop:' + sh, 3200, ['ArrowDown', 'KeyZ', 'Escape']]);
let troops = [];
try { const src = readFileSync('src/data/troops.js', 'utf8'); troops = Array.from(src.matchAll(/^\s{2}([a-z0-9_]+)\s*:/gm)).map((x) => x[1]).slice(0, 2); } catch (e) {}
for (const tr of troops) scen.push(['battle:' + tr, '/?lang=ko&map=' + encodeURIComponent(base) + '&battle=' + tr, 6000, ['KeyZ', 'KeyZ', 'ArrowDown', 'KeyZ', 'KeyZ']]);
log('scenarios: ' + scen.length + ' (saves ' + saves.length + ', maps ' + mapIds.length + ')');
for (const s of scen) {
  try { await run(s[0], s[1], s[2], s[3]); }
  catch (e) { results.push({ name: s[0], url: s[1], errs: ['run: ' + String(e.message).slice(0, 300)], canvas: [], dom: '' }); }
}
await browser.close();
srv.close();

// ---------- 3) 집계 ----------
const all = new Map();
for (const r of results) for (const s of r.canvas) {
  const k = String(s).replace(/\s+/g, ' ').trim();
  if (k.length < 2) continue;
  if (!LAT.test(k)) continue;
  if (CJK.test(k)) continue;
  all.set(k, (all.get(k) || 0) + 1);
}
const unt = Array.from(all.keys()).sort();
const domLines = new Set();
for (const r of results) for (const ln of String(r.dom || '').split('\n')) {
  const t = ln.replace(/\s+/g, ' ').trim();
  if (!t || !LAT.test(t) || CJK.test(t)) continue;
  domLines.add(t);
}
const domArr = Array.from(domLines).sort();
const scenOut = results.map((r) => ({ name: r.name, url: r.url, errs: r.errs.slice(0, 4), canvas: r.canvas.length }));
writeFileSync(OUT + '/runtime8.json', JSON.stringify({ scenarios: scenOut, untranslated: unt, dom: domArr }, null, 1));
const nc = chunk('c8', unt, 3000);
const nd = chunk('d8', domArr, 3000);
const summary = [
  'dict=' + KO_N,
  'scan8_candidates=' + rows.length,
  'scenarios=' + results.length,
  'canvas_en_lines=' + unt.length,
  'dom_en_lines=' + domArr.length,
  'c8_chunks=' + nc,
  'd8_chunks=' + nd,
  'ts=' + new Date().toISOString()
].join('\n');
writeFileSync(OUT + '/summary8.txt', summary + '\n');
log(summary);
