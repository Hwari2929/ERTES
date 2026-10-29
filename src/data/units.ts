// 기물 명단 (일반 + 사건 전용 + 공왕 무휼). 데이터는 세력별 파일에 나뉘어 있고, 리워크 정보(rework.ts)를 합친다.
import { MARK_BASIC, REWORK, TUNE, TUNE_KEYS } from './rework';
import { ROSTER_A } from './rosterA';
import { ROSTER_B } from './rosterB';
import { ROSTER_C } from './rosterC';
import { ROSTER_E } from './rosterE';
import { REWORK_F, ROSTER_F } from './rosterF';
import { REWORK_G, ROSTER_G } from './rosterG';
import type { BaseUnit, UnitDef } from './unitkit';
import { MAJOR_EXTRA_AUGS } from './majoraugs';

export type { UnitDef };

function merge(b: BaseUnit): UnitDef {
  const r = REWORK[b.id] || REWORK_F[b.id] || REWORK_G[b.id];
  if (!r) throw new Error(`리워크 정보 없음: ${b.id}`);
  const t = TUNE[b.id] || {};
  const w = { ...r.weapon, mult: r.weapon.mult * (r.ctype === 'MARK' ? MARK_BASIC : 1) * (t.w || 1) };
  const params = { ...b.skill.params };
  if (t.s) for (const k of TUNE_KEYS) if (params[k]) params[k] = Math.round(params[k] * t.s * 100) / 100;
  return {
    ...b, ...r, weapon: w, skill: { ...b.skill, params },
    ttype: r.ttype === 'special' ? 'major' : r.ttype, // 예전 스페셜 = 메이저 (전용 증강 + 궁극기)
    specialAugs: [...(r.specialAugs || []), ...(MAJOR_EXTRA_AUGS[b.id] || [])],
    factions: r.factions || b.factions,
    traits: r.traits || b.traits,
    title: r.title || b.title,
    atk: w.kind === 'none' ? b.atk : { type: w.type, elem: w.elem, interval: w.interval },
    range: w.range,
  };
}

export const UNITS: UnitDef[] = [...ROSTER_A, ...ROSTER_B, ...ROSTER_C, ...ROSTER_F, ...ROSTER_G, ...ROSTER_E].map(merge);
/** 영입 노드 · 특권 영입에 나올 수 있는 기물 (사건 전용 · 공왕 제외) */
export const RECRUITABLE = UNITS.filter((u) => !u.eventOnly && !u.king);
export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
