// i18n DOM 오버레이: 화면에 그려진 영어 텍스트 노드를 사전으로 바꾼다.
// 메뉴·전투 UI처럼 DOM으로 그려지는 곳을 한 번에 덮는다. 사전에 없는 문자열은 그대로 둔다.
import { lang, DICT, t, toggleLang } from './index.js';

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'OPTION']);
const done = new WeakSet();

function trNode(node) {
  const p = node.parentElement;
  if (!p || SKIP.has(p.tagName) || done.has(node)) return;
  const raw = node.nodeValue;
  if (!raw) return;
  const key = raw.trim();
  if (key.length < 2) return;
  const hit = DICT[key];
  if (hit === undefined) return;
  done.add(node);
  node.nodeValue = raw.replace(key, hit);
}

function walk(root) {
  if (root.nodeType === 3) { trNode(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) trNode(n);
}

let installed = false;
export function installI18n() {
  if (installed) return;
  installed = true;
  if (lang === 'ko') {
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') trNode(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  const b = document.createElement('button');
  b.id = 'lang-toggle';
  b.type = 'button';
  b.textContent = lang === 'ko' ? 'EN' : '한글';
  b.title = lang === 'ko' ? 'Switch to English' : '한국어로 보기';
  b.addEventListener('click', () => toggleLang());
  document.body.appendChild(b);
}
