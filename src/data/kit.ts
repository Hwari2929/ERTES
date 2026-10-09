// 스킬/증강 작성용 공용 헬퍼
import type { Battle, CUnit, DmgResult } from '../engine/combat';
import { vuln } from '../engine/effects';
import type { Elem } from '../types';

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const pp = (x: number) => `${Math.round(x * 100)}%p`;

export type PowKey = 'shoot' | 'strike' | 'tech';
export const POW_NAME: Record<PowKey, string> = { shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력' };

/** 기술 피해 (명중 판정 있음) */
export function skillHit(b: Battle, u: CUnit, t: CUnit, pow: PowKey, mult: number, elem: Elem,
  extra: { critBonus?: number; pen?: number; noMiss?: boolean; tag?: 'skill' | 'proc' } = {}): DmgResult {
  return b.dealDamage(u, t, b.S(u, pow) * mult, {
    elem, tag: extra.tag || 'skill', canMiss: !extra.noMiss, critBonus: extra.critBonus, pen: extra.pen,
  });
}

export function poison(b: Battle, u: CUnit, t: CUnit, dps: number, dur: number, chance: number, extra: object = {}) {
  return b.applyStatus(u, t, { type: 'dot', key: 'poison', dur, dps, elem: 'chem', ...extra }, chance);
}
export function bleed(b: Battle, u: CUnit, t: CUnit, dps: number, dur: number, chance = 1) {
  return b.applyStatus(u, t, { type: 'dot', key: 'bleed', dur, dps, elem: 'phys' }, chance);
}
export function shock(b: Battle, u: CUnit, t: CUnit, dur: number, chance: number, conductor = 0) {
  return b.applyStatus(u, t, { type: 'shock', key: 'shock', dur, taken: conductor ? [vuln('all', conductor)] : undefined }, chance);
}
export function fear(b: Battle, u: CUnit, t: CUnit, dur: number, chance: number, vul = 0) {
  return b.applyStatus(u, t, { type: 'fear', key: 'fear', dur, taken: vul ? [vuln('all', vul)] : undefined }, chance);
}
export function corrode(b: Battle, u: CUnit, t: CUnit, mul: number, dur: number, chance = 1) {
  return b.applyStatus(u, t, { type: 'buff', key: 'corrode', dur, armorMul: mul }, chance);
}
export function slow(b: Battle, u: CUnit, t: CUnit, amt: number, dur: number, chance = 1) {
  return b.applyStatus(u, t, { type: 'buff', key: 'slow', dur, delta: { atkSpd: -amt, moveSpd: -amt } }, chance);
}
export function isDebuffed(t: CUnit) {
  return t.statuses.some((s) => s.type !== 'buff' || s.key === 'corrode' || s.key === 'slow');
}

/** u 에서 t 방향으로 뻗는 직선 위의 적 (관통 공격) */
export function lineTargets(b: Battle, u: CUnit, t: CUnit): CUnit[] {
  const dx = t.x - u.x, dy = t.y - u.y;
  const len = Math.hypot(dx, dy) || 1;
  const hit = new Set<CUnit>();
  for (let s = 0.5; s < b.n * 1.5; s += 0.25) {
    const x = Math.round(u.x + (dx / len) * s), y = Math.round(u.y + (dy / len) * s);
    if (!b.inBounds(x, y)) break;
    const e = b.unitAt(x, y);
    if (e && e.side !== u.side) hit.add(e);
  }
  hit.add(t);
  return [...hit];
}
