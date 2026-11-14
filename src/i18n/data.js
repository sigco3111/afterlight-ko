// 데이터(아이템·장비·스킬·적·크레스트·상태·패시브·튜토리얼)의 표시 문자열을 사전으로 바꾼다.
// id는 그대로 두므로 게임 로직에는 영향이 없다. 사전에 없는 문자열은 영어로 남는다.
import { ITEMS } from '../data/items.js';
import { EQUIPMENT } from '../data/equipment.js';
import { SKILLS } from '../data/skills.js';
import { ENEMIES } from '../data/enemies.js';
import { CRESTS } from '../data/crests.js';
import { STATUSES } from '../data/statuses.js';
import { PASSIVES } from '../data/passives.js';
import { TUTORIALS } from '../data/tutorials.js';
import { t } from './index.js';

const FIELDS = ['name', 'desc', 'title', 'text', 'label', 'hint', 'summary', 'flavor'];

function apply(o) {
  if (!o || typeof o !== 'object') return;
  for (const f of FIELDS) if (typeof o[f] === 'string') o[f] = t(o[f]);
  if (Array.isArray(o.arts)) o.arts.forEach(apply);
  if (Array.isArray(o.ranks)) o.ranks.forEach(apply);
}

export function localizeData() {
  for (const obj of [ITEMS, EQUIPMENT, SKILLS, ENEMIES, CRESTS, STATUSES, PASSIVES, TUTORIALS]) {
    if (!obj) continue;
    for (const v of Object.values(obj)) apply(v);
  }
}
