import type { Major, Mod, RunState, Stats, SynergyId, TakenMod, UnitState } from '../types';
import type { Battle, CUnit, Hooks } from './combat';

export interface EffectCtx {
  run: RunState | null;
  unit: UnitState | null;
  counts: Partial<Record<SynergyId, number>>;
  phase: number;
  credits: number;
}

export type PctKey = 'maxHp' | 'shoot' | 'strike' | 'tech' | 'armor';

/** 증강/장비/시너지/전역 증강이 공통으로 쓰는 효과 묶음 */
export interface Effect {
  majors?: Partial<Record<Major, number>>;
  stats?: Partial<Stats>;
  pct?: Partial<Record<PctKey, number>>;
  mods?: Mod[];
  taken?: TakenMod[];
  hooks?: Hooks;
  /** 전투 시작 직전, 유닛 생성 후 호출 (스킬 파라미터 수정 등) */
  setup?(u: CUnit, b: Battle, ctx: EffectCtx): void;
  /** 이 효과를 가진 기물이 추가로 소속되는 시너지 */
  extraSyn?: SynergyId[];
  /** 칼리토 작위 보정 */
  title?: number;
}

export interface AugDef {
  id: string;
  name: string;
  desc: string;
  pool: 'unit' | 'syn' | 'common';
  owner?: string; // 기물 id 또는 시너지 id
  stack?: boolean;
  effect: (param?: string) => Effect;
  /** 제시될 때 무작위 파라미터 결정 */
  roll?: (pickFrom: <T>(a: readonly T[]) => T) => string;
  descParam?: (param: string) => string;
  /** 전투 종료 후 런 단위 효과 */
  after?: (run: RunState, u: UnitState, won: boolean) => void;
}

export const inc = (tag: Mod['tag'], v: number): Mod => ({ kind: 'inc', tag, v });
export const amp = (tag: Mod['tag'], v: number): Mod => ({ kind: 'amp', tag, v });
export const red = (tag: TakenMod['tag'], v: number): TakenMod => ({ kind: 'red', tag, v });
export const vuln = (tag: TakenMod['tag'], v: number): TakenMod => ({ kind: 'vuln', tag, v });

/** 효과 수치 배율 적용 (전설 장비 = 3배) */
export function scaleEffect(e: Effect, k: number): Effect {
  if (k === 1) return e;
  const mul = <T extends object>(o: T | undefined): T | undefined => {
    if (!o) return o;
    const r: Record<string, number> = {};
    for (const [key, v] of Object.entries(o)) r[key] = (v as number) * k;
    return r as T;
  };
  return {
    ...e,
    majors: mul(e.majors),
    stats: mul(e.stats),
    pct: mul(e.pct),
    mods: e.mods?.map((m) => ({ ...m, v: m.v * k })),
    taken: e.taken?.map((m) => ({ ...m, v: m.v * k })),
  };
}
