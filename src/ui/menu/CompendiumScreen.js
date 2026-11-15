import { fmt } from '../../i18n/index.js';
// The Compendium (menu 'bestiary'): Greer Thackery's book of every creature, one
// section per chapter plus side paths, marks, arenas and the Abyss. Entries are
// numbered in book order; a creature never met is a "???" in its place, so the gaps
// show what is still out there. data/monsterInfo.js decides what the party knows.

import { el } from '../UI.js';
import { Screen, ListView, header, KEYS } from './common.js';
import { keyCap } from '../../core/Input.js';
import { enemyStats } from '../../data/enemies.js';
import { SKILLS } from '../../data/skills.js';
import { STATUSES } from '../../data/statuses.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from '../../data/difficulty.js';
import { getMonsterSprite } from '../../render/MonsterFactory.js';
import { ELEM_ICONS } from '../../battle/BattleUI.js';
import { allMaps } from '../../data/maps/index.js';
import {
  SECTIONS, STUDY_DEFEATS, bookOrder, entryNo, habitatOf, recordOf, knowledge, completion, tacticsOf, rarity, familyOf,
} from '../../data/monsterInfo.js';

const elem = (e) => `<span class="cp-elem" style="color:${ELEM_ICONS[e]?.[1] || 'inherit'}">${ELEM_ICONS[e]?.[0] || ''} ${e}</span>`;
const STARS = ['', '★☆☆', '★★☆', '★★★'];

export class CompendiumScreen extends Screen {
  constructor(menus) {
    super(menus, 'bestiary-screen compendium');
    const st = this.state;
    const book = bookOrder();
    // Sections with anything in them the party has met (no spoilers for the rest).
    this.sections = SECTIONS.map((s) => ({ ...s, entries: book.filter((e) => e.section === s.id) }))
      .filter((s) => s.entries.some((e) => recordOf(st, e.id)?.seen));
    this.done = completion(st);
    const here = this.sections.findIndex((s) => s.id === st.chapter);
    this.tab = Math.max(0, here);
    this.build();
  }

  build() {
    const all = this.done.all;
    const pct = all.total ? Math.floor((100 * all.defeated) / all.total) : 0;
    this.el.innerHTML = header(fmt('Compendium — {0} recorded · {1} felled of {2} ({3}%)', all.seen, all.defeated, all.total, pct),
      `${KEYS.nav} ${keyCap('pageLeft')}${keyCap('pageRight')} Section ${KEYS.back}`);
    const body = el('div', 'bs-body');
    const left = el('div', 'bs-left panel');
    const sec = this.sections[this.tab];
    this.secEl = el('div', 'cp-section');
    left.appendChild(this.secEl);
    this.list = new ListView({
      items: sec ? sec.entries : [], pageSize: 13, empty: 'No creatures recorded yet.',
      render: (it) => this.row(it),
    });
    left.appendChild(this.list.el);
    // Start on the first entry the party knows.
    const first = this.list.items.findIndex((e) => recordOf(this.state, e.id)?.seen);
    if (first > 0) { this.list.index = first; this.list.refresh(); }
    this.detail = el('div', 'bs-detail panel');
    body.append(left, this.detail);
    this.el.appendChild(body);
    this.renderSection();
    this.renderDetail();
  }

  renderSection() {
    const sec = this.sections[this.tab];
    if (!sec) { this.secEl.innerHTML = ''; return; }
    const c = this.done.by[sec.id] || { seen: 0, defeated: 0, total: 0 };
    const many = this.sections.length > 1;
    this.secEl.innerHTML = `<div class="cp-sec-name">${many ? '◀ ' : ''}${sec.name}${many ? ' ▶' : ''}</div>
      <div class="cp-sec-sub">${sec.sub} · ${c.defeated}/${c.total} felled${c.defeated === c.total ? ' <span class="cp-full">✔ Complete</span>' : ''}</div>`;
  }

  row(it) {
    const r = recordOf(this.state, it.id);
    const k = knowledge(this.state, it.def);
    if (!k) return `<span class="cp-no">${entryNo(it.no)}</span><span class="in dim">???</span>`;
    const tag = it.def.mark ? '<span class="cp-tag mark">MARK</span>' : it.def.boss ? '<span class="cp-tag boss">BOSS</span>' : '';
    return `<span class="cp-no">${entryNo(it.no)}</span><span class="in">${it.def.name}</span>${tag}<span class="cnt">${r.defeated ? `×${r.defeated}` : '<span class="dim">seen</span>'}</span>`;
  }

  renderDetail() {
    const it = this.list.current;
    const st = this.state;
    if (!it) { this.detail.innerHTML = ''; return; }
    const k = knowledge(st, it.def);
    if (!k) {
      this.detail.innerHTML = fmt('<div class="cd-name">???</div><div class="cd-tier">{0}</div><div class="cd-desc dim">Not yet recorded. Something is out there that the book has no name for.</div>', entryNo(it.no));
      return;
    }
    const e = it.def;
    const r = recordOf(st, e.id);
    const s = enemyStats(e);
    const d = DIFFICULTIES[st.settings.difficulty ?? DEFAULT_DIFFICULTY] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    const known = (n) => (k >= n);
    const weakKnown = (r.weak || []);
    const weakAll = e.weak || [];
    const weak = weakAll.length
      ? weakAll.map((w) => (weakKnown.includes(w) || known(3) ? elem(w) : '<span class="dim">???</span>')).join(' ')
      : 'None';
    const resEntries = Object.entries(e.resist || {});
    const resSeen = new Set(r.res || []);
    const res = resEntries.length
      ? resEntries.map(([el2, m]) => (resSeen.has(el2) || known(3) ? `${elem(el2)} ${m < 0 ? 'absorbs' : m === 0 ? 'immune' : `×${m}`}` : '<span class="dim">???</span>')).join(' · ')
      : 'None';
    const imm = (e.immune || []).length
      ? e.immune.map((x) => ((r.imm || []).includes(x) || known(3) ? STATUSES[x]?.name || x : '<span class="dim">???</span>')).join(', ')
      : 'None';
    const moveIds = [...new Set((e.skills || []).map(([id]) => id))];
    const seenMoves = new Set(r.moves || []);
    const moves = e.ai && !e.skills
      ? ((r.moves || []).map((id) => SKILLS[id]?.name).filter(Boolean).join(', ') || '<span class="dim">???</span>')
      : moveIds.map((id) => (seenMoves.has(id) || known(3) ? SKILLS[id]?.name || id : '<span class="dim">???</span>')).join(', ');
    const inv = st.inventory;
    const drops = known(2) ? ((e.drops || []).map(([id, c]) => `${inv.itemName(id)} <span class="dim">(${rarity(c)})</span>`).join(', ') || 'None') : '???';
    const steal = known(3) && e.steal?.length ? `${inv.itemName(e.steal[0])}${e.steal[1] && e.steal[1] !== e.steal[0] ? ` / ${inv.itemName(e.steal[1])} <span class="dim">(rare)</span>` : ''}` : known(3) ? 'Nothing' : '???';
    const where = habitatOf(e.id, allMaps());
    const habitat = known(2) ? (where.length ? where.join(', ') : (e.mark ? 'Wherever the Ledger says' : 'Met only once')) : '???';
    const tactics = known(3)
      ? fmt('<ul class="cp-tactics">{0}</ul>', tacticsOf(e).map((t) => fmt('<li>{0}</li>', t)).join(''))
      : fmt('<div class="dim cp-tactics-locked">Fell {0} to learn how it fights. ({1}/{2})</div>', e.boss || e.mark ? 'it' : fmt('{0} of them', STUDY_DEFEATS), r.defeated || 0, e.boss || e.mark ? 1 : STUDY_DEFEATS);
    this.detail.innerHTML = fmt('<div class="cd-name">{0}{1}</div>\n      <div class="cd-tier">{2} · {3} · Lv {4} · <span class="cp-stars" title="seen · felled · studied">{5}</span> · Seen {6} · Felled {7}</div>\n      <div class="cp-top"><div class="bs-art"></div><div class="cd-desc">{8}</div></div>\n      <div class="bs-row"><b>Habitat</b> {9}</div>\n      <div class="bs-row"><b>HP</b> {10} · <b>Poise</b> {11} · <b>EXP</b> {12} · <b>Gold</b> {13} · <b>CP</b> {14}</div>\n      <div class="bs-row"><b>Weak</b> {15}</div>\n      <div class="bs-row"><b>Resists</b> {16}</div>\n      <div class="bs-row"><b>Immune</b> {17}</div>\n      <div class="bs-row"><b>Moves</b> {18}</div>\n      <div class="bs-row"><b>Drops</b> {19} · <b>Steal</b> {20}</div>\n      <div class="bs-row cp-tactics-head"><b>Tactics</b></div>{21}', e.name, e.mark ? ' <span class="cp-tag mark">MARK</span>' : e.boss ? ' <span class="cp-tag boss">BOSS</span>' : '', entryNo(it.no), familyOf(e), e.level, STARS[k], r.seen, r.defeated, e.desc || '', habitat, known(2) ? Math.round(s.hp * d.hp).toLocaleString() : '???', e.poise ?? 2, known(2) ? s.exp : '???', known(2) ? s.gold : '???', known(2) ? s.cp : '???', weak, res, imm, moves, drops, steal, tactics);
    const art = getMonsterSprite(e.sprite).canvas;
    const img = document.createElement('canvas');
    img.width = art.width; img.height = art.height;
    img.getContext('2d').drawImage(art, 0, 0);
    const scale = Math.max(1, Math.min(3, Math.floor(150 / art.height)));
    img.style.width = `${art.width * scale}px`;
    this.detail.querySelector('.bs-art').appendChild(img);
  }

  handleInput(input) {
    const n = this.sections.length;
    if (n > 1 && (input.pressed('pageRight') || input.pressed('pageLeft'))) {
      this.tab = (this.tab + (input.pressed('pageRight') ? 1 : n - 1)) % n;
      input.consume('pageRight'); input.consume('pageLeft');
      this.sfx('cursor');
      this.build();
      return;
    }
    const r = this.list.handle(input, (s) => this.sfx(s));
    if (r === 'move') this.renderDetail();
    if (r === 'cancel' || r === 'confirm') { this.sfx('cancel'); this.close(); }
  }
}
