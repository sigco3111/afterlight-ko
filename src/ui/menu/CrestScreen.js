import { fmt } from '../../i18n/index.js';
// Crest (class) management and Support (passive) loadouts.

import { el, richText } from '../UI.js';
import { keyCap } from '../../core/Input.js';
import { Screen, ListView, header, KEYS, portraitEl } from './common.js';
import { CRESTS, CREST_ORDER, MAX_RANK, MAX_STARS, STAR_STATS, STAR_ARTS, starText } from '../../data/crests.js';
import { artDetails } from '../../data/artInfo.js';
import { SKILLS } from '../../data/skills.js';
import { PASSIVES } from '../../data/passives.js';
import { WEAPON_TYPES } from '../../data/equipment.js';
import { getCharacterSheet, BATTLE_W, BATTLE_H } from '../../render/SpriteFactory.js';

const STAT_NAMES = { hp: 'HP', mp: 'MP', str: 'STR', mag: 'MAG', def: 'DEF', res: 'RES', spd: 'SPD', lck: 'LCK' };
const TIER_NAMES = { 1: 'Calling', 2: 'Braided Calling', 3: 'Legend', 4: 'Lost Calling' };

/** Base class for screens that work on one party member with Q/E switching. */
class MemberScreen extends Screen {
  constructor(menus, cls, memberIndex) {
    super(menus, cls);
    this.memberIndex = memberIndex || 0;
  }

  get ch() { return this.state.allMembers()[this.memberIndex]; }

  /** Draw the screen (each subclass draws its own). */
  build() {}

  switchMember(input) {
    const n = this.state.party.length;
    if (input.pressed('pageRight')) { this.memberIndex = (this.memberIndex + 1) % n; this.sfx('cursor'); this.onMemberChange(); return true; }
    if (input.pressed('pageLeft')) { this.memberIndex = (this.memberIndex + n - 1) % n; this.sfx('cursor'); this.onMemberChange(); return true; }
    return false;
  }

  onMemberChange() { this.build(); }
}

export class CrestScreen extends MemberScreen {
  constructor(menus, memberIndex) {
    super(menus, 'crest-screen', memberIndex);
    this.build();
  }

  entries() {
    const ch = this.ch;
    const avail = new Set(this.state.crestsAvailableTo(ch));
    return CREST_ORDER.map((id) => {
      const c = CRESTS[id];
      const known = avail.has(id);
      const showReq = c.tier === 2 && this.state.flags.crestArtLearned;
      const rumoured = c.tier === 4 && (this.state.chapter || 0) >= 8; // Lost Callings: rumours once their quests open
      const visible = known || showReq || rumoured || (c.tier === 1 && this.state.flags.crestArtLearned);
      return { id, c, known, visible, rank: ch.rankOf(id) };
    }).filter((e) => e.visible || e.rank > 0);
  }

  build() {
    const ch = this.ch;
    this.el.innerHTML = header(fmt('Crests — {0}', ch.name), `${KEYS.nav} ${keyCap('left')}${keyCap('right')} Scroll ${KEYS.ok} ${KEYS.back} ${KEYS.swap}`);
    const body = el('div', 'cs-body');
    const left = el('div', 'cs-left panel');
    const items = this.entries();
    const prevId = this.list?.current?.id;
    this.list = new ListView({
      items,
      pageSize: 14,
      render: (e) => {
        const tag = ch.crest === e.id ? '<span class="tag p">PRIMARY</span>' : ch.secondary === e.id ? '<span class="tag s">SECOND</span>' : '';
        // Mastered crests show their Ascension stars in place of the rank pips.
        const pips = e.rank >= MAX_RANK ? `<span class="pips stars">${starText(ch.starsOf(e.id))}</span>`
          : e.rank ? `<span class="pips">${'◆'.repeat(e.rank)}${'◇'.repeat(MAX_RANK - e.rank)}</span>` : '';
        return `<span class="ci" style="color:${e.c.color}">${e.c.icon}</span><span class="cn ${e.known ? '' : 'locked'}">${e.known ? e.c.name : e.c.tier === 1 ? '??? (Crest Stone)' : e.c.tier === 4 ? '??? (Lost Crest)' : e.c.name}</span>${tag}${pips}`;
      },
    });
    if (prevId) this.list.index = Math.max(0, items.findIndex((e) => e.id === prevId));
    this.list.refresh();
    left.appendChild(this.list.el);
    if (!this.state.flags.crestArtLearned) {
      left.appendChild(el('div', 'cs-lock dim', '<em>One Crest, one life.</em> No one you know has ever changed theirs.'));
    }
    this.detail = el('div', 'cs-detail panel');
    const who = el('div', 'cs-who panel');
    who.appendChild(portraitEl(ch.look, 3));
    who.appendChild(el('div', 'cs-who-text', fmt('<div class="pc-name">{0}</div><div>Lv {1}</div>\n      <div class="dim">Primary: <b style="color:{2}">{3}</b></div>\n      <div class="dim">Secondary: <b>{4}</b></div>', ch.name, ch.level, CRESTS[ch.crest].color, CRESTS[ch.crest].name, ch.secondary ? CRESTS[ch.secondary].name : '—')));
    this.preview = document.createElement('canvas');
    this.preview.width = BATTLE_W;
    this.preview.height = BATTLE_H;
    this.preview.className = 'cs-preview';
    who.appendChild(this.preview);
    body.append(left, this.detail, who);
    this.el.appendChild(body);
    this.renderDetail();
  }

  /** Draw the character in the highlighted Crest's battle costume. */
  renderPreview(crestId) {
    const ch = this.ch;
    const fake = Object.assign(Object.create(Object.getPrototypeOf(ch)), ch, { crest: crestId });
    const sheet = getCharacterSheet(fake.battleLook());
    const ctx = this.preview.getContext('2d');
    ctx.clearRect(0, 0, BATTLE_W, BATTLE_H);
    ctx.drawImage(sheet.canvas, 0, 128, BATTLE_W, BATTLE_H, 0, 0, BATTLE_W, BATTLE_H);
  }

  renderDetail() {
    const e = this.list.current;
    if (!e) { this.detail.innerHTML = ''; return; }
    const ch = this.ch;
    const c = e.c;
    if (!e.known && c.tier === 4) {
      // A Lost Calling not yet remembered: only the rumour of where to look.
      this.detail.innerHTML = fmt('<div class="cd-name" style="color:#8a8098">??? </div><div class="cd-tier">{0}</div>\n        <div class="cd-desc">A calling the Choir struck from its rolls long ago. Somewhere in the broken world, its crest-glass is still guarded.</div>\n        <div class="cd-legacy"><span class="k">Rumor</span> {1}</div>', TIER_NAMES[4], c.rumour || '');
      return;
    }
    if (e.known) this.renderPreview(e.id);
    const prog = e.rank ? ch.rankProgress(e.id) : null;
    let html = `<div class="cd-name" style="color:${c.color}">${c.icon} ${c.name}</div><div class="cd-tier">${TIER_NAMES[c.tier]}</div>`;
    html += `<div class="cd-desc">${c.desc}</div>`;
    if (c.requires) {
      html += '<div class="cd-req">Requires: ' + Object.entries(c.requires).map(([r, n]) => {
        const have = ch.rankOf(r);
        return `<span class="${have >= n ? 'ok' : 'no'}">${CRESTS[r].name} R${n} (${have})</span>`;
      }).join(' · ') + '</div>';
    }
    html += '<div class="cd-stats">';
    for (const [k, v] of Object.entries(c.stats)) {
      const pct = Math.round((v - 1) * 100);
      html += `<div class="cd-stat"><span>${STAT_NAMES[k]}</span><div class="cd-statbar"><i class="${pct >= 0 ? 'up' : 'down'}" style="width:${Math.min(100, Math.abs(pct) * 2.5)}%"></i></div><span class="${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${pct > 0 ? '+' : ''}${pct}%</span></div>`;
    }
    html += '</div>';
    html += fmt('<div class="cd-gear">Weapons: {0}<br>Armor: {1}{2}</div>', c.weapons.map((w) => WEAPON_TYPES[w].name).join(', '), c.armor.join(', '), c.shield ? ', shields' : '');
    if (prog && prog.need) html += fmt('<div class="cd-prog">Rank {0} — {1} CP to next<div class="mbar exp"><i style="width:{2}%"></i></div></div>', prog.rank, prog.need, prog.frac * 100);
    else if (prog) {
      const asc = ch.ascendProgress(e.id);
      html += fmt('<div class="cd-prog">MASTERED · Ascension <span class="cd-stars">{0}</span>{1}<div class="mbar exp asc"><i style="width:{2}%"></i></div></div>', starText(asc.stars), asc.need ? fmt(' — {0} CP to ★{1}', asc.need, asc.stars + 1) : '', asc.frac * 100);
    }
    if (c.legacy) {
      const have = e.rank >= MAX_RANK;
      html += fmt('<div class="cd-legacy {0}"><span class="k">Legacy</span> {1} <span class="dim">{2}</span></div>', have ? 'have' : '', c.legacy.desc, have ? '— yours, whatever you wear' : '— on mastery, whatever you wear');
      if (have) {
        const stars = ch.starsOf(e.id);
        html += fmt('<div class="cd-legacy asc dim">Each ★: all stats +{0}% as Primary, this Crest\'s Arts +{1}%; {2}★ adds a Support Point.{3}</div>', STAR_STATS, STAR_ARTS, MAX_STARS, stars ? fmt(' Now: stats +{0}%, Arts +{1}%.', stars * STAR_STATS, stars * STAR_ARTS) : '');
      }
    }
    html += '<div class="cd-ranks">';
    /** One row: rank or star, kind, name, MP, then the description and (for Arts) its details. */
    const row = (label, kind, learned, id, isSkill, extra = '') => {
      const art = isSkill ? SKILLS[id] : null;
      const def = art || PASSIVES[id];
      const shown = learned || e.known;
      const mp = art?.mp ? `${art.mp} MP` : '';
      const details = art && shown ? (() => { const d = artDetails(art, { powerMult: ch.artPower()[id] || 1 }); return `<div class="art-line">${d.line}</div>${d.effects.length ? `<div class="art-fx">${d.effects.join(' · ')}</div>` : ''}`; })() : '';
      return `<div class="cd-rank ${learned ? 'learned' : ''} ${extra}"><span class="r">${label}</span><span class="k">${kind}</span><span class="n">${shown ? def.name : '???'}</span><span class="mp">${mp}</span><div class="d">${shown ? richText(def.desc || '') : ''}${details}</div></div>`;
    };
    c.ranks.forEach((u, i) => { html += row(`R${i + 1}`, u.skill ? 'Art' : 'Support', e.rank > i, u.skill || u.passive, !!u.skill); });
    // Mastery Arts: taught by the Crest's Ascension stars.
    if (c.mastery?.length) {
      html += '<div class="cd-mastery-head">Mastery Arts <span class="dim">— learned at Ascension stars, once mastered</span></div>';
      for (const m of ch.masteryArts(e.id)) html += row(`★${m.stars}`, 'Mastery', m.learned, m.skill, true, 'mastery');
    }
    html += '</div>';
    this.detail.innerHTML = html;
  }

  async handleInput(input) {
    if (this.busy) return;
    if (this.switchMember(input)) return;
    // Left/right scroll the detail (ranks, Mastery Arts and their details run long).
    if (input.repeat('left') || input.repeat('right')) { this.detail.scrollBy({ top: input.repeat('right') ? 140 : -140 }); return; }
    const r = this.list.handle(input, (s) => this.sfx(s));
    if (r === 'move') { this.renderDetail(); this.detail.scrollTop = 0; }
    if (r === 'cancel') { this.sfx('cancel'); this.close(); return; }
    if (r !== 'confirm') return;
    const e = this.list.current;
    const ch = this.ch;
    if (!e.known) { this.sfx('buzzer'); return; }
    this.sfx('confirm');
    this.busy = true;
    const opts = ['Set as Primary', 'Set as Secondary', 'Cancel'];
    const pick = await this.game.ui.choice(opts, { prompt: `${CRESTS[e.id].name}`, cancel: 2 });
    this.busy = false;
    if (pick === 0) {
      if (ch.crest === e.id) return;
      ch.setCrest(e.id);
      const removed = ch.validateEquipment();
      for (const id of removed) this.state.inventory.add(id, 1);
      ch.clampVitals();
      this.sfx('join');
      if (removed.length) this.game.ui.toast(fmt('Unequipped: {0}', removed.map((id) => this.state.inventory.itemName(id)).join(', ')));
    } else if (pick === 1) {
      if (ch.crest === e.id) { this.sfx('buzzer'); return; }
      ch.setSecondary(ch.secondary === e.id ? null : e.id);
      this.sfx('buff');
    }
    this.build();
  }
}

export class SupportScreen extends MemberScreen {
  constructor(menus, memberIndex) {
    super(menus, 'support-screen', memberIndex);
    this.build();
  }

  build() {
    const ch = this.ch;
    const learned = ch.learnedPassives();
    const sourceOf = (pid) => Object.keys(ch.crests).find((c) => CRESTS[c].ranks.some((u) => u.passive === pid));
    this.el.innerHTML = header(fmt('Supports — {0}', ch.name), `${KEYS.nav} ${keyCap('confirm')} Equip/Remove ${KEYS.back} ${KEYS.swap}`);
    const body = el('div', 'sp-body');
    const left = el('div', 'sp-left panel');
    const used = ch.supportUsed(), budget = ch.supportBudget();
    left.appendChild(el('div', 'sp-budget', fmt('Support Points <b>{0}</b> / {1}<div class="sp-pips">{2}{3}</div>', used, budget, '●'.repeat(used), '○'.repeat(Math.max(0, budget - used)))));
    const prev = this.list?.index || 0;
    this.list = new ListView({
      items: learned.map((id) => ({ id, p: PASSIVES[id], on: ch.passives.includes(id), src: sourceOf(id) })),
      pageSize: 13,
      empty: 'No supports learned yet. Rank up Crests to learn them.',
      render: (it) => `<span class="chk">${it.on ? '◆' : '◇'}</span><span class="pn">${it.p.name}</span><span class="pc">${'●'.repeat(it.p.cost)}</span>`,
    });
    this.list.index = Math.min(prev, Math.max(0, learned.length - 1));
    this.list.refresh();
    left.appendChild(this.list.el);
    this.detail = el('div', 'sp-detail panel');
    body.append(left, this.detail);
    this.el.appendChild(body);
    this.renderDetail();
  }

  renderDetail() {
    const it = this.list.current;
    if (!it) { this.detail.innerHTML = '<div class="dim">Supports are passive abilities learned from Crest ranks. Any learned Support can be equipped, whatever your current Crest.</div>'; return; }
    this.detail.innerHTML = fmt('<div class="cd-name">{0}</div><div class="cd-tier">Cost {1} · from {2}</div><div class="cd-desc">{3}</div>\n      <div class="dim" style="margin-top:18px">Supports are passive abilities learned from Crest ranks. Any learned Support can be equipped, whatever your current Crest.</div>', it.p.name, it.p.cost, it.src ? CRESTS[it.src].name : '—', it.p.desc);
  }

  handleInput(input) {
    if (this.switchMember(input)) return;
    const r = this.list.handle(input, (s) => this.sfx(s));
    if (r === 'move') this.renderDetail();
    if (r === 'cancel') { this.sfx('cancel'); this.close(); return; }
    if (r === 'confirm' && this.list.current) {
      const ok = this.ch.togglePassive(this.list.current.id);
      this.sfx(ok ? 'confirm' : 'buzzer');
      if (!ok) this.game.ui.toast('Not enough Support Points.');
      this.ch.clampVitals();
      this.build();
    }
  }
}

export { MemberScreen };
