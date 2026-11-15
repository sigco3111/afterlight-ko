// ko3 v2: 정적·템플릿·런타임 스캔 후 결과를 go/out/*.md 로 남기고 커밋한다.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BT = String.fromCharCode(96);
const MODE = process.env.MODE || 'runtime';
const OUT = 'go/out';
fs.rmSync(OUT, { recursive: true, force: true });
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
  let line = 1;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === BT) {
      const q = c;
      const startLine = line;
      let j = i + 1;
      let s = '';
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { s += src[j + 1] || ''; j += 2; continue; }
        if (ch === '\n') line++;
        if (ch === q) break;
        s += ch;
        j++;
      }
      res.push({ s, line: startLine });
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

const flat = (s) => s.replace(/\s+/g, ' ').trim();
const DIRS = ['src/data', 'src/story', 'src/ui', 'src/world', 'src/battle', 'src/scenes', 'src/script', 'src/core', 'src/state', 'src/render'];
const files = [];
for (const d of DIRS) for (const f of walk(d)) files.push(f);

const staticRows = [];
const staticMissing = [];
const tmplRows = [];
const tmplMissing = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let total = 0; let miss = 0; let tt = 0; let tm = 0;
  for (const it of literals(src)) {
    const s = it.s;
    if (/\{\d+\}/.test(s) && s.length <= 600) {
      tt++;
      if (!keys.has(s)) { tm++; tmplMissing.push({ file: f, line: it.line, s }); }
    }
    if (!isProse(s)) continue;
    total++;
    if (keys.has(s)) continue;
    miss++;
    staticMissing.push({ file: f, line: it.line, s });
  }
  if (total || tt) staticRows.push({ file: f, total, miss, tt, tm });
}
staticRows.sort((a, b) => b.miss - a.miss);

function chunks(list, name, fmt) {
  const size = 20;
  for (let i = 0; i < list.length; i += size) {
    const part = list.slice(i, i + size);
    const body = part.map(fmt).join('\n');
    fs.writeFileSync(OUT + '/' + name + '-' + String(i / size).padStart(2, '0') + '.md', body + '\n');
  }
}

async function runtime() {
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
  const seen = new Set();
  const rows = [];
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__txt = [];
      const seen2 = new Set();
      const add = (s) => { if (!s) return; const v = s.replace(/\s+/g, ' ').trim(); if (v.length < 2 || seen2.has(v)) return; seen2.add(v); window.__txt.push(v); };
      const scan = (root) => {
        try { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let nn; while ((nn = w.nextNode())) add(nn.nodeValue); } catch (e) { void e; }
      };
      document.addEventListener('DOMContentLoaded', () => scan(document.body));
      new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === 'characterData') { const p = m.target.parentElement; if (p && !/^(SCRIPT|STYLE)$/.test(p.tagName)) add(m.target.nodeValue); }
          else for (const nn of m.addedNodes) { if (nn.nodeType === 3) add(nn.nodeValue); else if (nn.nodeType === 1) scan(nn); }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e && e.message).slice(0, 120)));
    let status = 'timeout';
    try {
      await page.goto('http://localhost:8799/index.html?lang=ko&test=' + name + '&sim=10', { waitUntil: 'load', timeout: 60000 });
      const t0 = Date.now();
      while (Date.now() - t0 < 240000) {
        await page.waitForTimeout(2000);
        const t = await page.title();
        if (/PASS|FAIL/.test(t)) { status = t.slice(-120); break; }
      }
      const txt = await page.evaluate(() => window.__txt || []);
      for (const s of txt) seen.add(s);
      rows.push(name + ' | ' + status + ' | ' + txt.length + ' | errs ' + errs.length);
    } catch (e) {
      rows.push(name + ' | error ' + e.message.slice(0, 120));
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  const all = [...seen];
  const prose = all.filter(isProse);
  const miss = prose.filter((s) => !keys.has(s));
  return { rows, all, prose, miss };
}

function writeAndCommit(summary, lists) {
  fs.writeFileSync(OUT + '/00-summary.md', summary.join('\n') + '\n');
  for (const l of lists) chunks(l.list, l.name, l.fmt);
  try {
    execSync('git config user.email ko3@local');
    execSync('git config user.name ko3');
    execSync('git add -A go/out');
    execSync('git commit -m "ko3: 스캔 결과 [skip ci]"');
    execSync('git push');
  } catch (e) {
    console.log('commit failed', e.message.slice(0, 200));
  }
}

const summary = [];
summary.push('static prose total ' + staticRows.reduce((a, r) => a + r.total, 0) + ' missing ' + staticRows.reduce((a, r) => a + r.miss, 0));
for (const r of staticRows.filter((x) => x.miss > 0).slice(0, 40)) summary.push('  ' + r.miss + '/' + r.total + ' ' + r.file);
summary.push('template total ' + staticRows.reduce((a, r) => a + r.tt, 0) + ' missing ' + tmplMissing.length);

const lists = [
  { name: 'w', list: staticMissing, fmt: (x) => '- ' + x.file + ':' + x.line + ' | ' + flat(x.s).slice(0, 260) },
  { name: 't', list: tmplMissing, fmt: (x) => '- ' + x.file + ':' + x.line + ' | ' + flat(x.s).slice(0, 900) },
];

if (MODE === 'runtime') {
  const r = await runtime();
  for (const row of r.rows) summary.push('  test ' + row);
  summary.push('runtime texts ' + r.all.length + ' prose ' + r.prose.length + ' missing ' + r.miss.length);
  lists.push({ name: 'r', list: r.miss.map((s) => ({ s })), fmt: (x) => '- ' + flat(x.s).slice(0, 400) });
}
writeAndCommit(summary, lists);
console.log(summary.join('\n'));
