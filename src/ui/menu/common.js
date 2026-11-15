import { fmt } from '../../i18n/index.js';
// Shared menu building blocks: a keyboard ListView, a base Screen class and
// small renderers (party cards, bars, stat diffs).

import { el } from '../UI.js';
import { keyCap } from '../../core/Input.js';
import { getPortrait } from '../../render/SpriteFactory.js';
import { CRESTS, MAX_RANK } from '../../data/crests.js';
import { expToNext } from '../../state/Character.js';

/** Vertical list with selection, scrolling and disabled rows. */
export class ListView {
  constructor({ items = [], render, cls = '', pageSize = 10, empty = 'Nothing here.' }) {
    this.items = items;
    this.renderItem = render;
    this.pageSize = pageSize;
    this.empty = empty;
    this.index = 0;
    this.scroll = 0;
    this.el = el('div', `listview ${cls}`);
    this.refresh();
  }

  get current() { return this.items[this.index]; }

  setItems(items, keepIndex = true) {
    this.items = items;
    if (!keepIndex) this.index = 0;
    this.index = Math.min(this.index, Math.max(0, items.length - 1));
    this.refresh();
  }

  refresh() {
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.pageSize) this.scroll = this.index - this.pageSize + 1;
    if (!this.items.length) { this.el.innerHTML = `<div class="lv-empty">${this.empty}</div>`; return; }
    let html = '';
    const end = Math.min(this.items.length, this.scroll + this.pageSize);
    if (this.scroll > 0) html += '<div class="lv-more up">▲</div>';
    for (let i = this.scroll; i < end; i++) {
      const it = this.items[i];
      const sel = i === this.index;
      html += `<div class="lv-row ${sel ? 'sel' : ''} ${it?.disabled ? 'off' : ''}">${this.renderItem(it, i, sel)}</div>`;
    }
    if (end < this.items.length) html += '<div class="lv-more down">▼</div>';
    this.el.innerHTML = html;
  }

  /** Handles navigation; returns 'confirm' | 'cancel' | 'move' | null. */
  handle(input, sfx) {
    const n = this.items.length;
    if (n && input.repeat('up')) { this.index = (this.index + n - 1) % n; sfx?.('cursor'); this.refresh(); return 'move'; }
    if (n && input.repeat('down')) { this.index = (this.index + 1) % n; sfx?.('cursor'); this.refresh(); return 'move'; }
    if (input.pressed('confirm')) { input.consume('confirm'); return 'confirm'; }
    if (input.pressed('cancel')) { input.consume('cancel'); input.consume('menu'); return 'cancel'; }
    return null;
  }
}

/** Base class for full-screen menu pages. */
export class Screen {
  constructor(menus, cls = '') {
    this.menus = menus;
    this.game = menus.game;
    this.state = menus.game.state;
    this.el = el('div', `menu-screen ${cls}`);
  }

  sfx(id) { this.game.audio?.sfx(id); }

  open() {
    this.menus.game.ui.push(this, 'menus');
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  close(value) {
    this.menus.game.ui.remove(this);
    this._resolve?.(value);
  }
}

export function bar(cur, max, cls) {
  const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return `<div class="mbar ${cls}"><i style="width:${pct}%"></i></div>`;
}

export function portraitEl(look, scale = 3) {
  const p = el('div', 'mportrait');
  p.appendChild(getPortrait(look, scale));
  return p;
}

/** Party member summary card. */
export function partyCard(ch, { active = true, selected = false } = {}) {
  const s = ch.stats();
  const card = el('div', `pcard ${selected ? 'sel' : ''} ${active ? '' : 'reserve'}`);
  card.appendChild(portraitEl(ch.look, 3));
  const crest = CRESTS[ch.crest];
  const prog = ch.rankProgress(ch.crest);
  const need = expToNext(ch.level);
  const body = el('div', 'pc-body', fmt('\n    <div class="pc-top"><span class="pc-name">{0}</span><span class="pc-lv">Lv <b>{1}</b></span></div>\n    <div class="pc-crest" style="color:{2}">{3} {4} <span class="pc-rank">R{5}{6}</span>{7}</div>\n    <div class="pc-vit"><span>HP</span>{8}<span class="num">{9}/{10}</span></div>\n    <div class="pc-vit"><span>MP</span>{11}<span class="num">{12}/{13}</span></div>\n    <div class="pc-vit small"><span>EXP</span>{14}<span class="num">{15} to next</span></div>', ch.name, ch.level, crest.color, crest.icon, crest.name, prog.rank, prog.rank >= MAX_RANK && ch.starsOf(ch.crest) ? ` ★${ch.starsOf(ch.crest)}` : '', ch.secondary ? ` <span class="pc-sec">/ ${CRESTS[ch.secondary].name}</span>` : '', bar(ch.hp, s.hp, 'hp'), ch.hp, s.hp, bar(ch.mp, s.mp, 'mp'), ch.mp, s.mp, bar(ch.exp, need, 'exp'), need - ch.exp));
  card.appendChild(body);
  if (!active) card.appendChild(el('div', 'pc-reserve', 'Reserve'));
  return card;
}

export const STAT_LABELS = { hp: 'Max HP', mp: 'Max MP', atk: 'Attack', matk: 'Magic', def: 'Defense', res: 'Resist', spd: 'Speed', lck: 'Luck', crit: 'Critical', evade: 'Evasion' };
export const STAT_ORDER = ['hp', 'mp', 'atk', 'matk', 'def', 'res', 'spd', 'lck', 'crit', 'evade'];

/** Rows comparing two stat blocks. */
export function statDiffHtml(before, after) {
  return STAT_ORDER.map((k) => {
    const a = before[k], b = after ? after[k] : a;
    const d = b - a;
    const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
    return `<div class="sd-row"><span class="sd-k">${STAT_LABELS[k]}</span><span class="sd-v">${a}</span>${after ? `<span class="sd-arrow">→</span><span class="sd-n ${cls}">${b}</span>` : ''}</div>`;
  }).join('');
}

export function header(title, hint = '') {
  return `<div class="ms-header"><div class="ms-title">${title}</div><div class="ms-hint">${hint}</div></div>`;
}

/** Key hints for menu headers, built from the player's current key bindings. */
export const KEYS = {
  get nav() { return fmt('{0}{1} Select', keyCap('up'), keyCap('down')); },
  get ok() { return fmt('{0} Confirm', keyCap('confirm')); },
  get back() { return fmt('{0} Back', keyCap('cancel')); },
  get swap() { return fmt('{0}{1} Character', keyCap('pageLeft'), keyCap('pageRight')); },
};
