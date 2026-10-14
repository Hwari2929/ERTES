// 스킬/증강 작성용 공용 헬퍼
import type { Battle, CUnit, DmgResult, Status } from '../engine/combat';
import { vuln } from '../engine/effects';
import type { Elem } from '../types';

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const pp = (x: number) => `${Math.round(x * 100)}%p`;

export type PowKey = 'shoot' | 'strike' | 'tech';
export const POW_NAME: Record<PowKey, string> = { shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력' };

/** 기술 피해 (명중 판정 있음) */
export function skillHit(b: Battle, u: CUnit, t: CUnit, pow: PowKey, mult: number, elem: Elem,
  extra: { critBonus?: number; pen?: number; noMiss?: boolean; tag?: 'skill' | 'proc' } = {}): DmgResult {
  // 스킬은 지휘관이면 전술 위력, 기본 공격에 붙는 발동(proc)은 적힌 위력 그대로
  return b.dealDamage(u, t, (extra.tag === 'proc' ? b.S(u, pow) : b.P(u, pow)) * mult, {
    elem, tag: extra.tag || 'skill', kind: pow, canMiss: !extra.noMiss, critBonus: extra.critBonus, pen: extra.pen,
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
/** 버프 형식이지만 해로운 효과 */
/** 마이너 성장 배율 (소환물은 주인 기준): 10등급 ×2, 20등급 ×3 */
export const gw = (u: CUnit) => (u.owner || u).mem.grow || 1;
const HARMFUL_BUFF = new Set(['corrode', 'slow', 'suppress', 'decay', 'gloom', 'wound', 'root']);
export const isHarmful = (s: Status) => s.key !== 'frenzy' && (s.type !== 'buff' || HARMFUL_BUFF.has(s.key) || !!s.taken?.some((t) => t.kind === 'vuln'));
export const harmfulCount = (t: CUnit) => t.statuses.filter(isHarmful).length;
export function isDebuffed(t: CUnit) {
  return t.statuses.some(isHarmful);
}
/** 중첩형 해로운 효과 직접 부여 (onInflict 를 다시 부르지 않음). 반환: 중첩 후 상태 */
export function addStacks(b: Battle, src: CUnit, t: CUnit, key: string, n: number, max: number, dur: number, make: (stacks: number) => Partial<Status>, label: string): Status | null {
  if (!t.alive || n <= 0) return null;
  let s = t.statuses.find((x) => x.key === key);
  if (!s) { s = { type: 'buff', key, dur, stacks: 0, label, src }; t.statuses.push(s); }
  const before = s.stacks || 0;
  s.stacks = Math.min(max, before + n);
  s.dur = Math.max(s.dur, dur);
  s.src = src;
  Object.assign(s, make(s.stacks));
  if (s.stacks !== before && (s.stacks % 5 === 0 || before === 0)) b.emit({ k: 'status', id: t.id, name: `${label} ${s.stacks}` });
  return s;
}

/** u 에서 t 방향으로 뻗는 직선 위의 적 (관통 공격) */
export function lineTargets(b: Battle, u: CUnit, t: CUnit): CUnit[] {
  const dx = t.x - u.x, dy = t.y - u.y;
  const len = Math.hypot(dx, dy) || 1;
  const hit = new Set<CUnit>();
  for (let s = 0.5; s < Math.max(b.w, b.h) * 1.5; s += 0.25) {
    const x = Math.round(u.x + (dx / len) * s), y = Math.round(u.y + (dy / len) * s);
    if (!b.inBounds(x, y)) break;
    const e = b.unitAt(x, y);
    if (e && e.side !== u.side) hit.add(e);
  }
  hit.add(t);
  return [...hit];
}

/** 해로운 상태이상 제거 */
export function cleanse(u: CUnit) {
  u.statuses = u.statuses.filter((s) => !isHarmful(s));
}
/** 대상 옆 빈 칸으로 순간이동 */
export function blinkTo(b: Battle, u: CUnit, t: CUnit): boolean {
  let best: { x: number; y: number } | null = null, bd = 1e9;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = t.x + dx, y = t.y + dy;
      if (!b.inBounds(x, y) || b.unitAt(x, y)) continue;
      const d = Math.abs(x - u.x) + Math.abs(y - u.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
  if (!best) return false;
  u.x = u.px = best.x; u.y = u.py = best.y; u.moveT = 0;
  u.target = t;
  b.fx(u.x, u.y, 0, 'psy');
  return true;
}
/** 주인의 살아 있는 소환물 */
export const summonsOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.owner === u && s.alive);
