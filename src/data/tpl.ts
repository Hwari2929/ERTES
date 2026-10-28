// 기물 스킬 템플릿: 파라미터(u.sk)만 바꿔 다양한 기술을 만든다. 증강은 주로 이 파라미터를 고친다.
import type { Battle, CUnit, DmgResult, SkillDef } from '../engine/combat';
import { inc, red, vuln } from '../engine/effects';
import type { Elem } from '../types';
import { bleed, blinkTo, cleanse, corrode, fear, pct, poison, shock, slow, type PowKey } from './kit';

export type EnemyPick = 'current' | 'farthest' | 'lowest' | 'random' | 'strongest' | 'backline';
export type AllyPick = 'lowest' | 'all' | 'self' | 'aroundSelf' | 'strongest' | 'commanded';

export function pickEnemy(b: Battle, u: CUnit, mode: EnemyPick): CUnit | null {
  // 외길 추적 (도노반): 지금 대상이 살아 있으면 스킬도 그 대상에게
  if (u.mem.lockTarget && u.target?.alive && !b.hidden(u.target)) return u.target;
  const es = b.targetable(u);
  if (!es.length) return null;
  switch (mode) {
    case 'current': return u.target?.alive ? u.target : b.nearest(u, es);
    case 'farthest': return es.reduce((a, c) => (b.dist(u, c) > b.dist(u, a) ? c : a));
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
  if (p.bleed) bleed(b, u, v, b.P(u, pow) * p.bleed, 4);
  if (p.poison) poison(b, u, v, b.P(u, pow) * p.poison, 4, 0.9);
  if (p.shock) shock(b, u, v, p.shock, p.shockChance || 0.7);
  if (p.fear) fear(b, u, v, p.fear, p.fearChance || 0.5);
  if (p.slow) slow(b, u, v, p.slow, 3);
  if (p.corrode) corrode(b, u, v, 1 - p.corrode, 5);
  if (p.vuln) b.applyStatus(u, v, { type: 'buff', key: `vuln.${u.defId}`, dur: p.vulnDur || 4, taken: [vuln('all', p.vuln)], label: '취약' });
}

const EL: Record<Elem, string> = { phys: '물리', chem: '화학', elec: '전기', psy: '정신', holy: '신성', true: '고정' };
const RIDER: [string, string][] = [['stun', '기절'], ['fear', '공포'], ['shock', '감전'], ['poison', '중독'], ['bleed', '출혈'], ['slow', '둔화'], ['corrode', '부식'], ['vuln', '취약']];
const PICK_WORD: Record<EnemyPick, string> = { current: '', farthest: '먼 적', lowest: '약한 적', random: '무작위', strongest: '강적', backline: '후열' };
/** 공격형 기술의 짧은 설명: 범위 · 대상 · 속성 + 대표 부가 효과 1개 */
function strikeTag(o: StrikeOpts, p: Record<string, number>) {
  const e = EL[o.elem];
  let t = o.aroundSelf ? `주변 광역 ${e} 공격` : p.radius ? `광역 ${e} 공격` : p.hits > 1 ? `${p.hits}연타 ${e} 공격` : `${PICK_WORD[o.target || 'current'] ? PICK_WORD[o.target || 'current'] + ' ' : ''}${e} 공격`;
  if (o.blink) t = '돌진 · ' + t;
  const r = RIDER.find(([k]) => p[k]);
  if (r) t += ` + ${r[1]}`;
  return t;
}
const ALLY_WORD: Record<AllyPick, string> = { self: '자신', all: '아군 전체', aroundSelf: '주변 아군', lowest: '약한 아군', strongest: '핵심 아군', commanded: '핵심 아군' };
function supportTag(o: SupportOpts, p: Record<string, number>) {
  const fx = [p.heal && '회복', p.shield && '보호막', (p.as || p.dmg || p.armor || p.eva || p.crit || p.red) && '강화', p.cleanse && '정화'].filter(Boolean);
  return `${ALLY_WORD[o.target]} ${fx.slice(0, 2).join(' · ') || '지원'}`;
}

export interface StrikeOpts {
  name: string; cd: number; pow: PowKey; elem: Elem; mult: number;
  target?: EnemyPick; blink?: boolean; aroundSelf?: boolean; needsRange?: boolean;
  params?: Record<string, number>;
  desc: (p: Record<string, number>) => string;
  /** 짧은 설명을 직접 지정 (없으면 파라미터로 생성) */
  tag?: string;
  after?: (b: Battle, u: CUnit, t: CUnit, dealt: number, p: Record<string, number>, results: DmgResult[]) => void;
}

/** 공격형 기술: 대상 선택 → (순간이동) → 단일/범위 피해 × 타수 → 해로운 부가 효과.
 *  아군 쪽 효과(회복 · 보호막 · 강화)는 넣지 않는다 — 특성 · 별도 발동으로 분리 (스킬 한쪽 원칙) */
export function strike(o: StrikeOpts): SkillDef {
  return {
    name: o.name, cd: o.cd, needsRange: o.needsRange ?? (!o.blink && !o.aroundSelf && (o.target || 'current') === 'current'),
    params: { mult: o.mult, radius: 0, hits: 1, second: 0.6, pen: 0, crit: 0, resetOnKill: 0, ...o.params },
    desc: o.desc,
    tag: (p) => o.tag || strikeTag(o, p),
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
      const hit = new Set<CUnit>(); // 한 번이라도 적중한 대상: 부가 효과는 대상마다 첫 적중에 1번 (빗나가면 걸리지 않는다)
      for (let h = 0; h < p.hits; h++) {
        for (const v of victims) {
          if (!v.alive) continue;
          if (!p.radius && !o.aroundSelf && o.pow === 'shoot') b.emit({ k: 'atk', from: u.id, to: v.id, elem: o.elem, ranged: true });
          const r = b.dealDamage(u, v, b.P(u, o.pow) * p.mult * (h ? p.second : 1), {
            elem: o.elem, tag: 'skill', kind: o.pow, canMiss: !p.noMiss, critBonus: p.crit, pen: p.pen,
          });
          dealt += r.amount;
          results.push(r);
          if (!r.miss && !hit.has(v)) { hit.add(v); applyRiders(b, u, v, p, o.pow); }
          if (r.killed && p.resetOnKill) u.cd = Math.min(u.cd, u.cdMax * (1 - p.resetOnKill));
        }
      }
      // 추가 효과 (after): 한 번도 맞지 않은 대상에게는 해로운 상태 효과가 걸리지 않는다
      const miss = victims.filter((v) => !hit.has(v));
      for (const v of miss) b.missed.add(v);
      o.after?.(b, u, t, dealt, p, results);
      for (const v of miss) b.missed.delete(v);
      return true;
    },
  };
}

export interface SupportOpts {
  name: string; cd: number; target: AllyPick;
  params?: Record<string, number>;
  desc: (p: Record<string, number>) => string;
  tag?: string;
  /** 회복/보호막 위력에 곱할 추가 배율 (셰프 요리 등) */
  power?: (u: CUnit) => number;
  after?: (b: Battle, u: CUnit, targets: CUnit[], p: Record<string, number>) => void;
}

/** 지원 스킬 효과 1명분 (m = 세기 배율: 요리 배율 · 주변 50% 등). 오르카 [깜짝 마술] 잔 폭발도 이걸로 */
export function supportApply(b: Battle, u: CUnit, a: CUnit, p: Record<string, number>, m: number, label: string) {
  if (p.heal) b.heal(u, a, b.P(u, 'tech') * p.heal * m);
  if (p.shield) b.shield(a, b.P(u, 'tech') * p.shield * m);
  if (p.cleanse) cleanse(a);
  if (p.as || p.dmg || p.armor || p.eva || p.crit || p.red) {
    b.buff(u, a, `sup.${u.defId}`, p.dur, {
      delta: { atkSpd: p.as * m, armor: p.armor * m, eva: p.eva * m, crit: p.crit * m },
      mods: p.dmg ? [inc('all', p.dmg * m)] : undefined, taken: p.red ? [red('all', p.red * m)] : undefined, label,
    });
  }
}
/** 지원형 기술: 아군 선택 → 회복 / 보호막 / 버프 / 정화 */
export function support(o: SupportOpts): SkillDef {
  return {
    name: o.name, cd: o.cd,
    params: { heal: 0, shield: 0, dur: 4, as: 0, dmg: 0, armor: 0, eva: 0, crit: 0, red: 0, cleanse: 0, radius: 0, count: 1, splash: 0, ...o.params },
    desc: o.desc,
    tag: (p) => o.tag || supportTag(o, p),
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      const p = u.sk;
      let ts = pickAllies(b, u, o.target, p);
      if (!ts.length) return false;
      if (p.heal && !p.shield && !p.as && !p.dmg && !p.armor && !p.eva && !p.crit && ts.every((a) => b.hpPct(a) > 0.95)) return false;
      if (p.splash && ts.length === 1) ts = [ts[0], ...b.around(ts[0], 1, b.alliesOf(u)).filter((a) => a !== ts[0])];
      const k = o.power?.(u) ?? 1;
      ts.forEach((a, i) => supportApply(b, u, a, p, (i > 0 && p.splash && ts.length > 1 && o.target !== 'all' ? 0.5 : 1) * k, o.name));
      const c = ts[0];
      b.fx(c.x, c.y, o.target === 'all' ? 0 : p.radius, 'holy', p.heal || p.shield ? 'heal' : 'buff');
      o.after?.(b, u, ts, p);
      return true;
    },
  };
}

/** 셰프 요리 위력: 셰프 단계 배율 × (1 + 증강 보너스) */
export const cookPower = (u: CUnit) => (u.mem.cook || 1) * (1 + (u.mem.cookBonus || 0));
export { pct };
