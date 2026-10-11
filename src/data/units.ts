// 기물 명단 (일반 40명 + 사건 전용 6명). 데이터는 세력별 파일에 나뉘어 있고, 리워크 정보(rework.ts)를 합친다.
import { REWORK } from './rework';
import { ROSTER_A } from './rosterA';
import { ROSTER_B } from './rosterB';
import { ROSTER_C } from './rosterC';
import { ROSTER_E } from './rosterE';
import type { BaseUnit, UnitDef } from './unitkit';

export type { UnitDef };

function merge(b: BaseUnit): UnitDef {
  const r = REWORK[b.id];
  if (!r) throw new Error(`리워크 정보 없음: ${b.id}`);
  const w = r.weapon;
  return {
    ...b, ...r,
    factions: r.factions || b.factions,
    traits: r.traits || b.traits,
    title: r.title || b.title,
    atk: w.kind === 'none' ? b.atk : { type: w.type, elem: w.elem, interval: w.interval },
    range: w.range,
  };
}

export const UNITS: UnitDef[] = [...ROSTER_A, ...ROSTER_B, ...ROSTER_C, ...ROSTER_E].map(merge);
/** 영입 노드 · 특권 영입에 나올 수 있는 기물 (사건 전용 제외) */
export const RECRUITABLE = UNITS.filter((u) => !u.eventOnly);
export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
