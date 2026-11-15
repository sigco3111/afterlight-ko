// ko3: 정적 미번역 집계 + Playwright 런타임 표시 문자열 덤프
import fs from 'node:fs';
import path from 'node:path';

const BT = String.fromCharCode(96);
const MODE = process.env.MODE || 'static';
const OUT = 'go/out';
fs.mkdirSync(OUT, { recursive: true });
const dict = JSON.parse(fs.readFileSync('src/i18n/ko.json', 'utf8'));
const keys = new Set(Object.keys(dict));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

function literals(src) {
  const res = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === BT) {
      const q = c;
      let j = i + 1;
      let s = '';
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { s += src[j + 1] || ''; j += 2; continue; }
        if (ch === q) break;
        s += ch;
        j++;
      }
      res.push(s);
      i = j + 1;
      continue;
    }
    i++;
  }
  return res;
}

const isProse = (s) => s.length >= 3 && s.length <= 500 &&
  /[A-Za-z]{2,}/.test(s) && /\s/.test(s) &&
  !/[\uAC00-\uD7A3]/.test(s) &&
  !/[{}<>]/.test(s) &&
  !/https?:\/\//.test(s) &&
  !/^[\w./\-]+$/.test(s);

function staticScan() {
  const dirs = ['src/data', 'src/story', 'src/ui', 'src/world', 'src/battle', 'src/scenes', 'src/script', 'src/core', 'src/state', 'src/render'];
  const rows = [];
  const missingAll = [];
  for (const d of dirs) {
    for (const f of walk(d)) {
      const src = fs.readFileSync(f, 'utf8');
      let total = 0;
      let miss = 0;
      for (const s of literals(src)) {
        if (!isProse(s)) continue;
        total++;
        if (keys.has(s)) continue;
        miss++;
        missingAll.push({ file: f, s });
      }
      if (total) rows.push({ file: f, total, miss });
    }
  }
  rows.sort((a, b) => b.miss - a.miss);
  const sumT = rows.reduce((a, r) => a + r.total, 0);
  const sumM = rows.reduce((a, r) => a + r.miss, 0);
  console.log('== static: prose literals', sumT, 'missing', sumM, 'files', rows.length);
  for (const r of rows.filter((x) => x.miss > 0).slice(0, 45)) console.log('  ', r.miss + '/' + r.total, r.file);
  const uniq = [...new Set(missingAll.map((m) => m.s))];
  console.log('== static unique missing', uniq.length);
  fs.writeFileSync(OUT + '/static-missing.json', JSON.stringify(missingAll));
  fs.writeFileSync(OUT + '/static-rows.json', JSON.stringify(rows));
}

if (MODE === 'static') {
  staticScan();
} else {
  staticScan();
  const { chromium } = await import('playwright');
  const http = await import('node:http');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join('.', u === '/' ? 'index.html' : u);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(8799, r));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'] });
  const names = fs.readdirSync('tests').filter((f) => f.endsWith('.test.js')).map((f) => f.replace('.test.js', ''))
    .filter((x) => /^(prologue|ch\d|postgame|side|ending|epilogue)/.test(x)).sort();
  console.log('== runtime tests', names.length, names.join(','));
  const seenAll = new Set();
  const perTest = {};
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__txt = [];
      const seen = new Set();
      const add = (s) => { if (!s) return; const v = s.replace(/\s+/g, ' ').trim(); if (v.length < 2 || seen.has(v)) return; seen.add(v); window.__txt.push(v); };
      const scan = (root) => {
        try { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) add(n.nodeValue); } catch (e) { void e; }
      };
      document.addEventListener('DOMContentLoaded', () => scan(document.body));
      new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === 'characterData') { const p = m.target.parentElement; if (p && !/^(SCRIPT|STYLE)$/.test(p.tagName)) add(m.target.nodeValue); }
          else for (const n of m.addedNodes) { if (n.nodeType === 3) add(n.nodeValue); else if (n.nodeType === 1) scan(n); }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e && e.message).slice(0, 160)));
    try {
      await page.goto('http://localhost:8799/index.html?lang=ko&test=' + name + '&sim=10', { waitUntil: 'load', timeout: 60000 });
      const t0 = Date.now();
      let status = '';
      while (Date.now() - t0 < 300000) {
        await page.waitForTimeout(2000);
        const t = await page.title();
        if (/PASS|FAIL/.test(t)) { status = t.slice(-160); break; }
      }
      const txt = await page.evaluate(() => window.__txt || []);
      perTest[name] = { status: status || 'timeout', errs: errs.slice(0, 3), n: txt.length };
      for (const s of txt) seenAll.add(s);
      console.log('--', name, status || 'timeout', 'texts', txt.length, 'errs', errs.length);
    } catch (e) {
      perTest[name] = { status: 'error:' + e.message, errs: [], n: 0 };
      console.log('--', name, 'error', e.message);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  const all = [...seenAll];
  const prose = all.filter(isProse);
  const missing = prose.filter((s) => !keys.has(s));
  console.log('== runtime unique texts', all.length, 'prose', prose.length, 'missing', missing.length);
  fs.writeFileSync(OUT + '/runtime-all.json', JSON.stringify(all));
  fs.writeFileSync(OUT + '/runtime-missing.json', JSON.stringify(missing));
  fs.writeFileSync(OUT + '/runtime-tests.json', JSON.stringify(perTest, null, 1));
}
