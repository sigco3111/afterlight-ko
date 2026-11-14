// 한국어 오버레이: 영어 원문 -> 한국어 사전(ko.json) 조회.
// UI 문자열은 렌더 시점에 t()로, 대사는 ScriptContext.fill()에서 번역한다.
import KO from './ko.json';

const KEY = 'afterlight.lang';
const q = new URLSearchParams(location.search).get('lang');
export let lang = (q === 'en' || q === 'ko') ? q
  : ((() => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'ko'; } catch { return 'ko'; } })());

export const DICT = KO;

/** 영어 원문 한 줄을 현재 언어로. 사전에 없으면 원문 그대로(게임이 깨지지 않는다). */
export function t(s) {
  if (lang !== 'ko' || typeof s !== 'string') return s;
  const hit = KO[s];
  return hit === undefined ? s : hit;
}

/** {0}, {1} 자리표시자가 있는 템플릿용. */
export function fmt(s, ...args) {
  let out = t(s);
  args.forEach((a, i) => { out = out.split('{' + i + '}').join(String(a)); });
  return out;
}

export function setLang(next) {
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  const u = new URL(location.href);
  u.searchParams.set('lang', next);
  location.replace(u.toString());
}
export function toggleLang() { setLang(lang === 'ko' ? 'en' : 'ko'); }
