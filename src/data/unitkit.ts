import type { CUnit, SkillDef } from '../engine/combat';
import type { AugDef, Effect } from '../engine/effects';
import type { Elem, FactionId, Keyword, Major, TraitId } from '../types';

export interface UnitDef {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  traits: TraitId[];
  keywords: Keyword[];
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  range: number;
  base: Record<Major, number>;
  sprite: string;
  palette: string[];
  skill: SkillDef;
  lore: string;
  augs: AugDef[];
  /** 최고의 친구: 전투 시작 시 소환하는 단짝 */
  summon?: SummonDef;
}

export interface SummonDef {
  name: string;
  sprite: string;
  palette: string[];
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  range: number;
  hpMul?: number;
}

export const B = (vit: number, pow: number, mnd: number, def: number, agi: number) => ({ vit, pow, mnd, def, agi });

export function uaug(owner: string, id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef {
  return { id: `${owner}.${id}`, name, desc, pool: 'unit', owner, effect: () => effect, ...extra };
}
export const setSk = (f: (sk: Record<string, number>, u: CUnit) => void): Effect => ({ setup: (u) => f(u.sk, u) });

// 팔레트: [외곽선, 주색, 보조색, 피부, 바이저, 금속, 하이라이트]
export const PAL = {
  UNI: ['#10131c', '#3b6fd8', '#c9d6f2', '#f0c8a0', '#7fe3ff', '#59606e', '#ffffff'],
  KAL: ['#140c0c', '#a8283a', '#e0b040', '#e8c09a', '#ffd34d', '#6a5a50', '#fff3c0'],
  HEL: ['#0b1614', '#2fa39a', '#e8eef0', '#d8b090', '#b07cff', '#4f6866', '#ffffff'],
  PET: ['#141008', '#e07a1f', '#3a3a40', '#e6bc94', '#7dff8a', '#55555c', '#fff0d0'],
  SIR: ['#14120c', '#ece6d0', '#d4a83a', '#e8c8a8', '#6fb8ff', '#8a8270', '#ffffff'],
  PAN: ['#08141a', '#3fbfa8', '#9a5ad0', '#b88a60', '#ffd84d', '#40505a', '#e8fff8'],
};

