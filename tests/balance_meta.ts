// 밸런스 보고서용 이름표: 기물 · 시너지 · 장비 · 유형
import { UNITS } from '../src/data/units';
import { SYNERGIES } from '../src/data/synergies';
import { itemInfo } from '../src/data/items';
import { CTYPE_NAME, TTYPE_NAME } from '../src/types';
import { FIELDS } from '../src/data/battlefields';
import { ALL_AUGS, augSource } from '../src/data/augments';
declare const process: { argv: string[] };
const ids: string[] = JSON.parse(process.argv[2] || '[]');
console.log(JSON.stringify({
  units: Object.fromEntries(UNITS.map((u) => [u.id, { name: u.name, ct: u.ctype, tt: u.ttype, syn: [...u.factions, ...u.traits], starter: !u.noStarter, eventOnly: !!u.eventOnly, base: u.base, range: u.range, skill: u.skill.name }])),
  syn: Object.fromEntries(SYNERGIES.map((s) => [s.id, { name: s.name, tiers: s.tiers, kind: s.kind, color: s.color }])),
  items: Object.fromEntries(ids.map((id) => { try { const i = itemInfo(id); return [id, { name: i.name, tier: id.startsWith('U_') ? 'U' : i.tier }]; } catch { return [id, { name: id, tier: '?' }]; } })),
  ct: CTYPE_NAME, tt: TTYPE_NAME,
  fields: Object.fromEntries(FIELDS.map((f) => [f.id, f.name])),
  augs: Object.fromEntries(ALL_AUGS.map((a) => [a.id, { name: a.name, src: augSource(a), owner: a.owner || '' }])),
}));
