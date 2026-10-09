// 기물 스킬 템플릿: 파라미터(u.sk)만 바꿔 다양한 기술을 만든다. 증강은 주로 이 파라미터를 고친다.
import type { Battle, CUnit, DmgResult, SkillDef } from '../engine/combat';
import { inc, red, vuln } from '../engine/effects';
import type { Elem } from '../types';
import { bleed, blinkTo, cleanse, corrode, fear, pct, poison, shock, slow, type PowKey } from './kit';

export type EnemyPick = 'current' | 'farthest' | 'lowest' | 'random' | 'strongest' | 'backline';
export type AllyPick = 'lowest' | 'all' | 'self' | 'aroundSelf' | 'strongest' | 'commanded';

export function pickEnemy(b: Battle, u: CUnit, mode: EnemyPick): CUnit | null {
  const es = b.enemiesOf(u);
  if (!es.length) return null;
  switch (mode) {
    case 'current': return u.target?.alive ? u.target : b.nearest(u, es);
    case 'farthest': return b.farthest(u);
    case 'lowest': return es.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a));
    case 'random': return b.rng.pick(es);
    case 'strongest': return es.reduce((a, c) => (b.S(c, 'maxHp') > b.S(a, 'maxHp') ? c : a));
    case 'backline': return es.reduce((a, c) => ((u.side === 0 ? c.y < a.y : c.y > a.y) ? c : a));
  }
}

/** 피해량 기여가 가장 큰 아군 (참모단 지원 대상 우선) */
export function strongestAlly(b: Battle, u: CUnit, n = 1, includeSelf = false): CUnit[] {
  const pool = b.alliesOf(u, includeSelf).filter((a) => !a.isSummon && a.defId !== 'turret');
  pool.sort((a, c) => (c.mem.staffed || 0) - (a.mem.staffed || 0) || c.counters.dmg - a.counters.dmg
    || Math.max(b.S(c, 'shoot'), b.S(c, 'strike'), b.S(c, 'tech')) - Math.max(b.S(a, 'shoot'), b.S(a, 'strike'), b.S(a, 'tech')));
  return pool.slice(0, n);
}

function pickAllies(b: Battle, u: CUnit, mode: AllyPick, p: Record<string, number>): CUnit[] {
  const r = p.radius || 0;
  switch (mode) {
    case 'self': return [u];
    case 'all': return b.alliesOf(u);
    case 'aroundSelf': return b.around(u, r || 1, b.alliesOf(u));
    case 'lowest': { const l = b.lowestHpAlly(u); return l ? (r ? b.around(l, r, b.alliesOf(u)) : [l]) : []; }
    case 'strongest': case 'commanded': return strongestAlly(b, u, p.count || 1);
  }
}

/** 상태이상 공통 파라미터 적용 */
function applyRiders(b: Battle, u: CUnit, v: CUnit, p: Record<string, number>, pow: PowKey) {
  if (!v.alive) return;
  if (p.stun) b.stun(u, v, p.stun, p.stunChance || 1);
  if (p.bleed) bleed(b, u, v, b.S(u, pow) * p.bleed, 4);
  if (p.poison) poison(b, u, v, b.S(u, pow) * p.poison, 4, 0.9);
  if (p.shock) shock(b, u, v, p.shock, p.shockChance || 0.7);
  if (p.fear) fear(b, u, v, p.fear, p.fearChance || 0.5);
  if (p.slow) slow(b, u, v, p.slow, 3);
  if (p.corrode) corrode(b, u, v, 1 - p.corrode, 5);
  if (p.vuln) b.applyStatus(u, v, { type: 'buff', key: `vuln.${u.defId}`, dur: 4, taken: [vuln('all', p.vuln)], label: '취약' });
}

export interface StrikeOpts {
  name: string; cd: number; pow: PowKey; elem: Elem; mult: number;
  target?: EnemyPick; blink?: boolean; aroundSelf?: boolean; needsRange?: boolean;
  params?: Record<string, number>;
  desc: (p: Record<string, number>) => string;
  after?: (b: Battle, u: CUnit, t: CUnit, dealt: number, p: Record<string, number>, results: DmgResult[]) => void;
}

/** 공격형 기술: 대상 선택 → (순간이동) → 단일/범위 피해 × 타수 → 부가 효과 */
export function strike(o: StrikeOpts): SkillDef {
  return {
    name: o.name, cd: o.cd, needsRange: o.needsRange ?? (!o.blink && !o.aroundSelf && (o.target || 'current') === 'current'),
    params: { mult: o.mult, radius: 0, hits: 1, second: 0.6, pen: 0, crit: 0, selfShield: 0, lifesteal: 0, resetOnKill: 0, ...o.params },
    desc: o.desc,
    cast(b, u) {
      const p = u.sk;
      const t = o.aroundSelf ? u : pickEnemy(b, u, o.target || 'current');
      if (!t) return false;
      if (o.blink && t !== u && b.dist(u, t) > 1 && !blinkTo(b, u, t) && b.dist(u, t) > b.S(u, 'range')) return false;
      const victims = o.aroundSelf ? b.around(u, p.radius || 1, b.enemiesOf(u)) : p.radius ? b.around(t, p.radius, b.enemiesOf(u)) : [t];
      if (!victims.length) return false;
      if (p.radius || o.aroundSelf) b.fx(t.x, t.y, o.aroundSelf ? p.radius || 1 : p.radius, o.elem);
      let dealt = 0;
      const results: DmgResult[] = [];
      for (let h = 0; h < p.hits; h++) {
        for (const v of victims) {
          if (!v.alive) continue;
          if (!p.radius && !o.aroundSelf && o.pow === 'shoot') b.emit({ k: 'atk', from: u.id, to: v.id, elem: o.elem, ranged: true });
          const r = b.dealDamage(u, v, b.S(u, o.pow) * p.mult * (h ? p.second : 1), {
            elem: o.elem, tag: 'skill', canMiss: !p.noMiss, critBonus: p.crit, pen: p.pen,
          });
          dealt += r.amount;
          results.push(r);
          if (h === 0) applyRiders(b, u, v, p, o.pow);
          if (r.killed && p.resetOnKill) u.cd = Math.min(u.cd, u.cdMax * (1 - p.resetOnKill));
        }
      }
      if (p.selfShield) b.shield(u, b.S(u, 'maxHp') * p.selfShield);
      if (p.lifesteal) b.heal(u, u, dealt * p.lifesteal, true);
      o.after?.(b, u, t, dealt, p, results);
      return true;
    },
  };
}

export interface SupportOpts {
  name: string; cd: number; target: AllyPick;
  params?: Record<string, number>;
  desc: (p: Record<string, number>) => string;
  /** 회복/보호막 위력에 곱할 추가 배율 (셰프 요리 등) */
  power?: (u: CUnit) => number;
  after?: (b: Battle, u: CUnit, targets: CUnit[], p: Record<string, number>) => void;
}

/** 지원형 기술: 아군 선택 → 회복 / 보호막 / 버프 / 정화 */
export function support(o: SupportOpts): SkillDef {
  return {
    name: o.name, cd: o.cd,
    params: { heal: 0, shield: 0, dur: 4, as: 0, dmg: 0, armor: 0, eva: 0, crit: 0, red: 0, cleanse: 0, radius: 0, count: 1, splash: 0, ...o.params },
    desc: o.desc,
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      const p = u.sk;
      let ts = pickAllies(b, u, o.target, p);
      if (!ts.length) return false;
      if (p.heal && !p.shield && !p.as && !p.dmg && !p.armor && !p.eva && !p.crit && ts.every((a) => b.hpPct(a) > 0.95)) return false;
      if (p.splash && ts.length === 1) ts = [ts[0], ...b.around(ts[0], 1, b.alliesOf(u)).filter((a) => a !== ts[0])];
      const k = o.power?.(u) ?? 1;
      ts.forEach((a, i) => {
        const m = (i > 0 && p.splash && ts.length > 1 && o.target !== 'all' ? 0.5 : 1) * k;
        if (p.heal) b.heal(u, a, b.S(u, 'tech') * p.heal * m);
        if (p.shield) b.shield(a, b.S(u, 'tech') * p.shield * m);
        if (p.cleanse) cleanse(a);
        if (p.as || p.dmg || p.armor || p.eva || p.crit || p.red) {
          b.buff(u, a, `sup.${u.defId}`, p.dur, {
            delta: { atkSpd: p.as * m, armor: p.armor * m, eva: p.eva * m, crit: p.crit * m },
            mods: p.dmg ? [inc('all', p.dmg * m)] : undefined, taken: p.red ? [red('all', p.red * m)] : undefined, label: o.name,
          });
        }
      });
      const c = ts[0];
      b.fx(c.x, c.y, o.target === 'all' ? 0 : p.radius, 'holy');
      o.after?.(b, u, ts, p);
      return true;
    },
  };
}

/** 셰프 요리 위력: 셰프 단계 배율 × (1 + 증강 보너스) */
export const cookPower = (u: CUnit) => (u.mem.cook || 1) * (1 + (u.mem.cookBonus || 0));
export { pct };
