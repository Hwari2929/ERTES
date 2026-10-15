// 사이오닉 4학파 · 8전공 (docs/PSIONIC_REWORK_DRAFT.md)
// 전공 증강 8종 (pool 'school': 비술 + 기본 지속 능력 + 학파 이성 축) · 전공 증강 56종 (pool 'psionic', 전공당 7종, ◆ 변형 포함)
// 이성 비율 r = 이성/100, 고이성 h = max(0, r), 저이성 l = max(0, -r) (선형).
// 계수 기준 = 주요 위력 (명사수 사격 · 돌격가 타격 · 전문가 기술 · 지휘관 전술) × CFG.psiPower.
// 기본 지속 능력의 확률 발동은 기본 공격 · 전투 스킬 · 비술 적중에만 (지속 피해 · 소환물 · 부가 피해 제외).
// 공통 규칙 (저이성 정신 피해 · 광폭 · 혼란 · 도발)은 engine/combat.ts 에 있다.
import type { Battle, Cantrip, CUnit, DmgOpts, DmgResult, Hooks, Status } from '../engine/combat';
import { type AugDef, type Effect, type EffectCtx, applyLive, red, scaleEffect, vuln } from '../engine/effects';
import { emptyStats, type Elem, type StatKey } from '../types';
import { ALL_COMPONENTS, itemEffect } from './items';
import { isHarmful } from './kit';
import { CFG } from '../config';
import { GROUPS, PSI_STATUS, SCHOOLS, SCHOOL_BY_ID, SCHOOL_PASSIVES, psiAugId, schoolAugId, type GroupId, type SchoolId } from './schools';

const LB = (k: string) => PSI_STATUS[k].name;
type PK = 'shoot' | 'strike' | 'tech';
/** 주요 위력 종류: 명사수 사격 · 돌격가 타격 · 전문가 · 지휘관 기술(지휘관은 전술 위력) */
const pk = (u: CUnit): PK => (u.ctype === 'MARK' ? 'shoot' : u.ctype === 'VAN' ? 'strike' : 'tech');
/** 주요 위력 × 사이오닉 배율 */
export const mp = (b: Battle, u: CUnit) => (pk(u) === 'tech' ? b.P(u, 'tech') : b.S(u, pk(u))) * CFG.psiPower;
/** 전공 증강 보유 여부 (id = '전공.키') */
const P = (u: CUnit, id: string) => !!u.mem[`ps.${id}`];
const statusOf = (u: CUnit, k: string) => u.statuses.find((s) => s.key === k);
const hasKey = (u: CUnit, k: string) => u.statuses.some((s) => s.key === k);
const stacksOf = (u: CUnit, k: string) => statusOf(u, k)?.stacks || 0;
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
const reasonOf = (u: CUnit) => u.reason ?? 0;
const noCtx = (b: Battle): EffectCtx => ({ run: null, unit: null, counts: {}, phase: b.ctx.phase, credits: b.ctx.credits });

/** 비술 · 지속 능력 피해 (주요 위력 × 계수). tag 'skill' = 비술 적중 (지속 능력 발동), 'proc' = 부가 피해 */
function zap(b: Battle, u: CUnit, t: CUnit, coef: number, elem: Elem, tag: 'skill' | 'proc' = 'skill'): DmgResult {
  return b.dealDamage(u, t, mp(b, u) * coef, { elem, tag, kind: pk(u), key: tag === 'skill' ? 'cantrip' : undefined });
}

/** 임시 장비 수 (배당: 성공 횟수) */
const goldN = (u: CUnit) => (P(u, 'gold.dividend') ? u.mem.goldDiv || 0 : u.mem.goldItems || 0);
/** 고이성 · 저이성 비율 (포트폴리오: 임시 장비 3개면 둘 다 최소 50%) */
export function reasonHL(u: CUnit): [high: number, low: number] {
  const r = reasonOf(u) / 100;
  let h = Math.max(0, r), l = Math.max(0, -r);
  if (P(u, 'gold.folio') && goldN(u) >= 3) { h = Math.max(h, 0.5); l = Math.max(l, 0.5); }
  return [h, l];
}
/** 이성에 따라 바뀌는 능력치: 지난번 적용분과의 차이만 더한다 */
function dyn(u: CUnit, k: StatKey, v: number, tag = 'g') {
  const key = `dyn.${tag}.${k}`;
  const prev = u.mem[key] || 0;
  if (prev !== v) { u.st[k] += v - prev; u.mem[key] = v; }
}
/** 비술 대상: 지금 대상(적)이 있으면 그 대상, 없으면 가장 가까운 적 */
function cantripTarget(b: Battle, u: CUnit): CUnit | null {
  const t = u.target;
  if (t && t.alive && !b.hidden(t) && b.sideOf(t) !== b.sideOf(u)) return t;
  return b.nearest(u, b.targetable(u));
}
/** 주변 n칸 적 (대상 제외) */
const nearby = (b: Battle, u: CUnit, t: CUnit, r: number) => b.around(t, r, b.enemiesOf(u)).filter((e) => e !== t && e.alive);

// ───────────────────────── 홍염: 연소 축적 · 소각
const burnArmor = (s: Status) => { s.armorMul = s.src && P(s.src, 'pyro.white') ? Math.max(0.2, 1 - 0.06 * (s.stacks || 0)) : undefined; };
export function addBurn(b: Battle, u: CUnit, t: CUnit, n: number, chance = 1) {
  const per = mp(b, u) * 0.12;
  return b.applyStatus(u, t, {
    type: 'dot', key: 'burn', dur: 5, elem: 'phys', stacks: n, maxStacks: P(u, 'pyro.wp') ? 10 : 5,
    perDps: per, dps: per * n, label: LB('burn'), onStack: burnArmor,
  }, chance);
}
function incinerate(b: Battle, u: CUnit, depth = 0): false | { to?: CUnit } {
  const es = b.targetable(u);
  if (!es.length) return false;
  let t: CUnit | null = null, best = 0;
  for (const e of es) { const n = stacksOf(e, 'burn'); if (n > best) { best = n; t = e; } }
  t ??= cantripTarget(b, u);
  if (!t) return false;
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
  b.fx(t.x, t.y, 1, 'phys');
  const splash = nearby(b, u, t, 1);
  const had = hasKey(t, 'burn'); // 시전 전에 연소가 있었는지 (이번 적중의 발화는 소모 여부를 바꾸지 않는다)
  zap(b, u, t, 0.6, 'phys');
  for (const e of splash) zap(b, u, e, 0.6, 'phys');
  const bs = statusOf(t, 'burn');
  if (t.alive && bs && had) {
    const n = bs.stacks || 1, per = P(u, 'pyro.wp') ? 0.35 : 0.5;
    const drop = () => { t!.statuses = t!.statuses.filter((s) => s !== bs); };
    if (!P(u, 'pyro.white')) drop(); // 백열: 방어도 감소가 남은 채로 계산
    b.emit({ k: 'status', id: t.id, name: '소각', src: u.id, harm: true });
    zap(b, u, t, per * n, 'phys');
    drop();
    // 연쇄 소각: 연소를 소모한 적이 쓰러지면 즉시 한 번 더 (쿨다운 · 이성 소모 없음)
    if (!t.alive && P(u, 'pyro.chain') && depth < 4 && u.alive && !b.over) incinerate(b, u, depth + 1);
  } else if (t.alive) addBurn(b, u, t, 2);
  return { to: t };
}

// ───────────────────────── 시공: 오한 · 빙결
export function addChill(b: Battle, u: CUnit, t: CUnit, n: number, chance = 1) {
  const per = mp(b, u) * 0.04;
  return b.applyStatus(u, t, {
    type: 'dot', key: 'chill', dur: 5, elem: 'phys', stacks: n, maxStacks: P(u, 'chrono.zero') ? 6 : 4, perDps: per, dps: per * n,
    perDelta: { atkSpd: -0.08, moveSpd: -0.08 }, label: LB('chill'),
  }, chance);
}
function freeze(b: Battle, u: CUnit, t: CUnit, chance: number) {
  const ok = b.applyStatus(u, t, {
    type: 'stun', key: 'freeze', dur: P(u, 'chrono.perma') ? 3 : 2, label: LB('freeze'),
    taken: P(u, 'chrono.stop') ? [vuln('all', 0.4)] : undefined,
  }, chance);
  if (!ok) return false;
  if (!P(u, 'chrono.perma')) t.statuses = t.statuses.filter((s) => s.key !== 'chill'); // 오한 소모
  b.fx(t.x, t.y, 0, 'elec', 'aura');
  if (P(u, 'chrono.revert')) b.addReason(u, 6);
  return true;
}
/** 서리 파편 대상: 서로 다른 적 n명 (현재 대상 우선, 모자라면 중복) */
function spread<T>(b: Battle, first: T | null, pool: T[], n: number): T[] {
  const rest = b.rng.sample(pool.filter((x) => x !== first), pool.length);
  const order = first ? [first, ...rest] : rest;
  const out: T[] = [];
  for (let i = 0; i < n && order.length; i++) out.push(order[i % order.length]);
  return out;
}
function frostShards(b: Battle, u: CUnit) {
  const n = P(u, 'chrono.storm') ? 6 : 3;
  if (P(u, 'chrono.haste')) {
    // 시간 가속: 아군 3명에게 4초간 공격 속도 +25% (소환물보다 기물 우선)
    const al = b.alliesOf(u);
    const real = al.filter((a) => !a.isSummon && !a.noAttack), pool = real.length ? real : al;
    const picks = [...new Set(spread(b, null, pool, Math.min(n, pool.length)))];
    for (const a of picks) { b.buff(u, a, 'psi.haste', 4, { delta: { atkSpd: 0.25 }, label: '시간 가속' }); b.fx(a.x, a.y, 0, 'elec', 'buff'); }
    return picks.length ? { to: picks[0] } : false;
  }
  const es = b.targetable(u);
  if (!es.length) return false;
  const t0 = cantripTarget(b, u);
  const coef = P(u, 'chrono.storm') ? 0.3 : 0.5;
  for (const t of spread(b, t0, es, n)) {
    if (!t.alive) continue;
    b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
    zap(b, u, t, coef, 'phys');
    if (t.alive) freeze(b, u, t, 0.25 + 0.1 * stacksOf(t, 'chill'));
  }
  return { to: t0 || undefined };
}
/** 되감기: 0.25초마다 체력 · 상태이상 기록 (최근 4초) */
interface RwLog { t: number; hp: number; keys: Set<string> }
const HP_LOG = new WeakMap<CUnit, RwLog[]>();
function tryRewind(b: Battle, u: CUnit) {
  if (u.mem.rewound || b.hpPct(u) > 0.3) return false;
  const log = HP_LOG.get(u) || [];
  let rec: RwLog | null = null;
  for (const x of log) if (x.t <= b.t - 3) rec = x; // 3초 이상 지난 기록 중 가장 최근
  rec ??= log[0] || null;
  if (!rec || rec.hp <= Math.max(0, u.hp)) return false;
  u.mem.rewound = 1;
  u.hp = Math.min(b.S(u, 'maxHp'), rec.hp);
  const keep = rec.keys;
  u.statuses = u.statuses.filter((s) => !isHarmful(s) || keep.has(s.key)); // 그사이 걸린 해로운 효과
  b.emit({ k: 'mark', id: u.id, name: '되감기', style: 'rewind' });
  return true;
}
const rewindHooks = (): Hooks => ({
  onTick(b, u, dt) {
    if (u.mem.rewound) return;
    u.mem.rwT = (u.mem.rwT || 0) + dt;
    if (u.mem.rwT >= 0.25) {
      u.mem.rwT = 0;
      const log = HP_LOG.get(u) || [];
      log.push({ t: b.t, hp: u.hp, keys: new Set(u.statuses.filter(isHarmful).map((s) => s.key)) });
      while (log.length > 1 && log[0].t < b.t - 4) log.shift();
      HP_LOG.set(u, log);
    }
    tryRewind(b, u);
  },
  onHurt(b, u) { tryRewind(b, u); },
  onLethal(b, u) { return tryRewind(b, u) && u.hp > 0; },
});

// ───────────────────────── 뇌전: 전도 (행동에 반응)
function storeReason(b: Battle, c: CUnit) {
  // 축전: 전도 피해마다 이성 +1 (초당 최대 +3)
  if (b.t >= (c.mem.storeW || 0)) { c.mem.storeW = Math.floor(b.t) + 1; c.mem.storeN = 0; }
  if ((c.mem.storeN || 0) < 3) { c.mem.storeN = (c.mem.storeN || 0) + 1; b.addReason(c, 1); }
}
/** ally = 역전류 (아군에게 걸린 전도: 그 아군 주변 적에게 피해) */
function conductStatus(b: Battle, u: CUnit, n: number, ally: boolean): Status {
  const hv = P(u, 'volt.hv'), rad = hv ? 2 : 1;
  return {
    type: 'buff', key: 'conduct', dur: 5, stacks: n, maxStacks: 3, val: mp(b, u) * (ally ? 0.1 : hv ? 0.22 : 0.15), label: LB('conduct'),
    onAct(bb, t, s) {
      const c = s.src;
      if (!c) return;
      const foes = ally ? bb.enemiesOf(t) : bb.enemiesOf(c);
      for (const e of bb.around(t, rad, foes)) {
        if (e === t || !e.alive) continue;
        const r = bb.dealDamage(c, e, (s.val || 0) * (s.stacks || 1), { elem: 'elec', tag: 'proc', kind: pk(c) });
        if (r.amount > 0 && c.alive && P(c, 'volt.store')) storeReason(bb, c);
      }
      // 단락: 전도 3중첩인 적이 행동하면 1초 감전 (같은 적 2초에 1회)
      if (!ally && t.alive && P(c, 'volt.short') && (s.stacks || 0) >= 3 && icd(bb, t, 'shortIcd', 2)) bb.applyStatus(c, t, { type: 'shock', key: 'shock', dur: 1 });
    },
  };
}
function addConduct(b: Battle, u: CUnit, t: CUnit, n: number, chance = 1) {
  if (P(u, 'volt.reverse')) {
    // 역전류: 대상과 가장 가까운 아군에게
    if (chance < 1 && !b.rng.chance(chance)) return false;
    const al = b.alliesOf(u).filter((a) => !a.noAttack || a === u);
    const a = al.length ? b.nearest(t, al) : null;
    return a ? b.applyStatus(u, a, conductStatus(b, u, n, true)) : false;
  }
  return b.applyStatus(u, t, conductStatus(b, u, n, false), chance);
}
function discharge(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  if (P(u, 'volt.reverse')) {
    // 역전류 (◆ 변형, 스킬 한쪽 원칙): 적을 치지 않고 대상과 가장 가까운 아군에게 전도 3중첩을 충전한다
    const al = b.alliesOf(u).filter((a) => !a.noAttack || a === u);
    const a = al.length ? b.nearest(t, al) : null;
    if (!a) return false;
    b.fx(a.x, a.y, 0, 'elec', 'buff');
    b.applyStatus(u, a, conductStatus(b, u, 3, true));
    return { to: a };
  }
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
  const cs = statusOf(t, 'conduct');
  zap(b, u, t, 0.9, 'elec');
  if (t.alive && cs && (cs.stacks || 0) >= 3 && P(u, 'volt.overload')) {
    // 과부하: 전도 3중첩 소모 → 주요 위력 300% 전기 폭발
    t.statuses = t.statuses.filter((s) => s !== cs);
    b.fx(t.x, t.y, 1, 'elec');
    b.emit({ k: 'status', id: t.id, name: '과부하', src: u.id, harm: true });
    zap(b, u, t, 3, 'elec');
  } else if (t.alive) b.applyStatus(u, t, conductStatus(b, u, 2, false));
  if (P(u, 'volt.chain')) {
    // 연쇄 번개: 대상에서 가장 가까운 다른 적 3명에게 60%
    const others = b.targetable(u).filter((e) => e !== t).sort((a, c) => b.dist(a, t) - b.dist(c, t)).slice(0, 3);
    let prev = t;
    for (const e of others) {
      b.emit({ k: 'atk', from: prev.id, to: e.id, elem: 'elec', ranged: true, chain: true });
      zap(b, u, e, 0.9 * 0.6, 'elec');
      prev = e;
    }
  }
  return { to: t };
}

// ───────────────────────── 파장: 밀쳐내기 · 공진
function resonanceStatus(b: Battle, u: CUnit): Status {
  const rad = P(u, 'wave.attract') ? 2 : 1;
  return {
    type: 'buff', key: 'resonance', dur: 5, val: mp(b, u) * (P(u, 'wave.freq') ? 0.25 : 0.15), label: LB('resonance'),
    onHit(bb, v, _src, _r, _o, s) {
      const c = s.src;
      if (!c || !icd(bb, v, 'resIcd', 0.5)) return;
      const k = (v.mem.standUntil || 0) > bb.t ? 2 : 1; // 정상파
      for (const e of bb.around(v, rad, bb.enemiesOf(c))) if (e !== v && e.alive) bb.dealDamage(c, e, (s.val || 0) * k, { elem: 'elec', tag: 'proc', kind: pk(c) });
    },
    // 정상파: 공진된 적이 기절(빙결 포함)하면 공진 갱신 + 3초간 공진 피해 2배
    onOther: P(u, 'wave.standing') ? (bb, v, s, added) => { if (added.type === 'stun') { s.dur = Math.max(s.dur, 5); v.mem.standUntil = bb.t + 3; } } : undefined,
  };
}
function shockwave(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  const victims = P(u, 'wave.amp') ? [t, ...nearby(b, u, t, 1)] : [t];
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
  zap(b, u, t, 0.7, 'elec');
  b.fx(t.x, t.y, victims.length > 1 ? 1 : 0, 'elec');
  for (const v of victims) {
    if (!v.alive) continue;
    const r = P(u, 'wave.attract') ? b.pull(u, v) : b.knockback(u, v);
    // 충돌: 밀려난 적이 다른 기물과 부딪히면 둘 다 1.2초 기절 (부딪힌 쪽이 아군이면 적만)
    if (!r.moved && r.blocker && P(u, 'wave.impact')) {
      b.stun(u, v, 1.2);
      if (b.sideOf(r.blocker) !== b.sideOf(u)) b.stun(u, r.blocker, 1.2);
    }
    if (v.alive) b.applyStatus(u, v, resonanceStatus(b, u));
  }
  if (t.alive && P(u, 'wave.seismic') && b.rng.chance(0.35)) b.stun(u, t, 1.2);
  return { to: t };
}

// ───────────────────────── 파종: 중독 · (◆ 지속 회복)
function poisonStatus(b: Battle, u: CUnit, stacks: number, perDps = mp(b, u) * 0.1): Status {
  return {
    type: 'dot', key: 'poison', dur: 5, elem: 'chem', perDps, dps: perDps * stacks, stacks, maxStacks: P(u, 'seed.conc') ? 6 : 3,
    healMul: P(u, 'seed.rot') ? 0.4 : undefined, label: LB('poison'),
    // 괴사: 6중첩 이상이면 받는 모든 피해 +20%
    onStack: P(u, 'seed.necro') ? (s) => { s.taken = (s.stacks || 0) >= 6 ? [vuln('all', 0.2)] : undefined; } : undefined,
  };
}
function spore(b: Battle, u: CUnit) {
  if (P(u, 'seed.regen')) {
    // 재생 포자: 체력 비율이 가장 낮은 아군에게 지속 회복 (5초, 초당 주요 위력 25%)
    if (!b.enemiesOf(u).length) return false;
    const a = b.lowestHpAlly(u);
    if (!a) return false;
    b.applyStatus(u, a, { type: 'buff', key: 'regen', dur: 5, hps: mp(b, u) * 0.25, label: LB('regen') });
    b.fx(a.x, a.y, 0, 'chem', 'heal');
    return { to: a };
  }
  const t = cantripTarget(b, u);
  if (!t) return false;
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'chem', ranged: true });
  zap(b, u, t, 0.4, 'chem');
  if (t.alive) b.applyStatus(u, t, poisonStatus(b, u, 2));
  b.fx(t.x, t.y, 0, 'chem');
  return { to: t };
}

// ───────────────────────── 정신: 결속 · 매혹 · 혼란
export function confuse(b: Battle, u: CUnit, t: CUnit, dur: number, chance = 1) {
  return b.applyStatus(u, t, { type: 'buff', key: 'confuse', dur, label: LB('confuse') }, chance);
}
function revelation(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  const max = P(u, 'mind.collective') ? 5 : 3;
  const group = [t, ...b.around(t, 1, b.targetable(u)).filter((e) => e !== t).sort((a, c) => b.dist(a, t) - b.dist(c, t))].slice(0, max);
  const gid = (b.mem.bondGrp = (b.mem.bondGrp || 0) + 1);
  for (const e of group) b.applyStatus(u, e, { type: 'buff', key: 'bond', dur: 5, taken: [vuln('all', 0.1)], val: P(u, 'mind.fate') ? 0.5 : 0.25, grp: gid, label: LB('bond') });
  b.fx(t.x, t.y, 1, 'psy');
  if (P(u, 'mind.hypno')) {
    // 집단 최면: 매혹 대신 결속된 적 전원 2초 혼란
    for (const e of b.enemiesOf(u)) if (e.statuses.some((s) => s.key === 'bond' && s.grp === gid)) confuse(b, u, e, 2);
  } else {
    // 매혹: 일반 적만 (승천: 엘리트도, 지속 +1초 · 엘리트는 절반)
    const asc = P(u, 'mind.ascend');
    if (t.alive && !t.isBoss && (!t.elite || asc)) {
      b.applyStatus(u, t, { type: 'buff', key: 'charm', dur: 1.5 + (asc ? 1 : 0), label: LB('charm'), mods: P(u, 'mind.dominate') ? [{ kind: 'inc', tag: 'all', v: 1 }] : undefined });
    }
  }
  return { to: t };
}

// ───────────────────────── 보화: 임시 장비 (전투 한정)
/** 무작위 재료 장비 1개를 이번 전투 동안 장착 (기물당 최대 3개). CUnit.tempItems 에 표시, 개수는 mem.goldItems */
export function giveTempItem(b: Battle, u: CUnit, to: CUnit = u) {
  if ((to.mem.goldItems || 0) >= 3 || !to.alive) return false;
  const id = b.rng.pick(ALL_COMPONENTS);
  applyLive(to, P(u, 'gold.leverage') ? scaleEffect(itemEffect(id), 2) : itemEffect(id), b, noCtx(b));
  to.tempItems = [...(to.tempItems || []), id];
  to.mem.goldItems = (to.mem.goldItems || 0) + 1;
  b.emit({ k: 'gift', from: u.id, to: to.id, item: id });
  return true;
}
function market(b: Battle, u: CUnit) {
  if (!b.enemiesOf(u).length) return false;
  const t = cantripTarget(b, u);
  const p = 0.4 + 0.5 * Math.abs(reasonOf(u)) / 100 + (P(u, 'gold.insider') ? 0.3 : 0);
  const win = b.rng.chance(p);
  let got = false;
  if (win && P(u, 'gold.dividend')) {
    // 배당: 아군 3명에게 1개씩 (성공 3회까지)
    if ((u.mem.goldDiv || 0) < 3) {
      const al = b.alliesOf(u, false).filter((a) => !a.isSummon && (a.mem.goldItems || 0) < 3);
      for (const a of b.rng.sample(al, 3)) got = giveTempItem(b, u, a) || got;
      if (got) u.mem.goldDiv = (u.mem.goldDiv || 0) + 1;
    }
  } else if (win) got = giveTempItem(b, u, u);
  if (!got) {
    if (!win && P(u, 'gold.leverage')) b.dealDamage(u, u, b.S(u, 'maxHp') * 0.1, { elem: 'true', tag: 'proc', noHooks: true, key: 'reason' }); // 레버리지 실패
    else {
      const a = b.lowestHpAlly(u);
      if (a) { b.shield(a, mp(b, u) * 0.8); b.fx(a.x, a.y, 0, 'holy', 'heal'); }
    }
  }
  return { to: t || undefined };
}

// ───────────────────────── 환조: 환영 (도발 소환물) · 향취
const ILLUSION_PAL = ['#1a0f24', '#e9a6ff', '#7a3f9e', '#ffd6f5', '#ff8fd0', '#4a2a66', '#fff0fb'];
function blankSummon(owner: CUnit): CUnit {
  return {
    id: 0, side: owner.side, defId: 'summon', name: '', sprite: 'phantom', palette: ILLUSION_PAL, x: 0, y: 0, px: 0, py: 0, moveT: 0, moveDur: 0,
    hp: 1, shield: 0, st: emptyStats(), atk: { type: 'strike', elem: 'psy', interval: 1 }, atkTimer: 0.4, cd: 0, cdMax: 0,
    skill: null, sk: {}, statuses: [], mods: [], taken: [], hooks: [], keywords: [], category: 'bio', synergies: new Set(), target: null,
    alive: true, isBoss: false, isSummon: true, immobile: false, phaseAmp: 1, owner,
    counters: { dmg: 0, taken: 0, healed: 0, kills: 0, casts: 0, shield: 0, elem: {} }, mem: {},
    weapon: null, ammo: 0, reloadT: 0, combo: 0, reason: null, div: null, divGot: 0, divCap: 0, divUsed: false,
    school: null, cantrip: null, cantripCd: 0, cantripMax: 0,
  };
}
const maxShades = (u: CUnit) => (P(u, 'illusion.troupe') ? 4 : 2);
const shadesOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.alive && s.owner === u && s.mem.illusion);
/** 잔향: 환영이 사라질 때 주변 1칸 적에게 주요 위력 120% 정신 피해 */
function echo(b: Battle, s: CUnit) {
  const o = s.owner;
  if (!o || !o.alive || !P(o, 'illusion.echo') || s.mem.echoed) return;
  s.mem.echoed = 1;
  b.fx(s.x, s.y, 1, 'psy');
  for (const e of b.around(s, 1, b.enemiesOf(o))) if (e.alive) zap(b, o, e, 1.2, 'psy', 'proc');
}
/** 시간이 다 된 환영을 거둔다 */
function dismiss(b: Battle, s: CUnit) {
  if (!s.alive) return;
  s.alive = false;
  s.hp = 0;
  b.emit({ k: 'die', id: s.id });
  for (const x of b.units) if (x.target === s) x.target = null;
  echo(b, s);
}
const shadeHooks = (owner: CUnit): Hooks => ({
  onTick(b, s, dt) {
    s.mem.life = (s.mem.life || 0) - dt;
    if (s.mem.life <= 0) { dismiss(b, s); return; }
    // 안개: 주변 1칸 적 명중 -30%p (환영이 가진 속성)
    if (P(owner, 'illusion.fog')) {
      s.mem.fogT = (s.mem.fogT || 0) - dt;
      if (s.mem.fogT <= 0) {
        s.mem.fogT = 0.25;
        for (const e of b.around(s, 1, b.enemiesOf(s))) {
          const ex = statusOf(e, 'psi.fog');
          if (ex) ex.dur = Math.max(ex.dur, 0.4);
          else e.statuses.push({ type: 'buff', key: 'psi.fog', dur: 0.4, delta: { acc: -0.3 }, src: owner, label: '안개' });
        }
      }
    }
  },
  // 교란: 환영을 공격한 적은 공격 속도 -10% (최대 -30%)
  onHurt(b, s, src, _r, o) {
    if (!P(owner, 'illusion.disrupt') || o.tag === 'dot' || b.sideOf(src) === b.sideOf(s) || !src.alive) return;
    b.applyStatus(owner, src, { type: 'buff', key: 'psi.disrupt', dur: 4, stacks: 1, maxStacks: 3, perDelta: { atkSpd: -0.1 }, label: '교란' });
  },
});
function summonShade(b: Battle, u: CUnit, near: CUnit) {
  const clone = P(u, 'illusion.clone');
  const live = shadesOf(b, u);
  if (live.length >= maxShades(u)) dismiss(b, live[0]); // 가장 오래된 것부터 교체
  const s = blankSummon(u);
  const st = s.st;
  if (clone) {
    // 분신: 자신의 능력치 (체력 50%, 피해 50%), 12초
    Object.assign(st, u.st);
    st.maxHp = b.S(u, 'maxHp') * 0.5;
    Object.assign(s, {
      name: `${u.name}의 분신`, sprite: u.sprite, palette: u.palette, art: u.defId, atk: { ...u.atk }, keywords: u.keywords.slice(), category: u.category,
      weapon: u.weapon ? { ...u.weapon } : null, ammo: u.weapon?.mag || 0, ctype: u.ctype, phaseAmp: 0.5, noAttack: u.noAttack,
    });
    s.mem.life = 12;
  } else {
    // 환영: 체력 = 자신 최대 체력 30%, 제자리 · 도발 (실체화: 주요 위력 40%로 공격)
    st.maxHp = b.S(u, 'maxHp') * 0.3;
    st.armor = b.S(u, 'armor');
    st.effRes = b.S(u, 'effRes');
    st.range = 1; st.moveSpd = 1; st.critDmg = 1.5;
    st.strike = mp(b, u) * 0.4;
    st.acc = b.S(u, 'acc');
    Object.assign(s, { name: '환영', immobile: true, noAttack: !P(u, 'illusion.solid') });
    s.mem.taunt = 1;
    s.mem.life = 6;
  }
  s.mem.illusion = 1;
  s.hp = st.maxHp;
  s.hooks.push(shadeHooks(u));
  return b.spawn(s, near);
}
function incense(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  const s = summonShade(b, u, P(u, 'illusion.clone') ? u : t);
  if (!s) return false;
  b.fx(s.x, s.y, 0, 'psy', 'aura');
  return { to: t };
}
function scent(b: Battle, u: CUnit, t: CUnit, chance: number) {
  return b.applyStatus(u, t, {
    type: 'buff', key: 'scent', dur: 4, stacks: 1, maxStacks: P(u, 'illusion.dense') ? 3 : 1, perDelta: { eva: -0.15 }, label: LB('scent'),
    onStack: (s) => { s.taken = [vuln('all', 0.08 * (s.stacks || 1))]; },
  }, chance);
}

// ───────────────────────── 비술
const CAST: Record<SchoolId, (b: Battle, u: CUnit) => false | { to?: CUnit }> = {
  pyro: (b, u) => incinerate(b, u), chrono: frostShards, volt: discharge, wave: shockwave, seed: spore, mind: revelation, gold: market, illusion: incense,
};
function makeCantrip(id: SchoolId): Cantrip {
  const c = SCHOOL_BY_ID[id].cantrip;
  return {
    name: c.name,
    cast: CAST[id],
    cd(_b, u) {
      let cd = c.cd;
      if (id === 'pyro' && P(u, 'pyro.runaway') && reasonOf(u) < 0) cd *= 0.5; // 열폭주
      if (id === 'gold' && P(u, 'gold.vol')) cd -= 2; // 변동성
      if (id === 'illusion' && P(u, 'illusion.clone')) cd += 4; // 분신
      return Math.max(0.5, cd);
    },
    cost() { return c.cost; },
  };
}
export const CANTRIPS = Object.fromEntries(SCHOOLS.map((s) => [s.id, makeCantrip(s.id)])) as Record<SchoolId, Cantrip>;

// ───────────────────────── 기본 지속 능력: 기본 공격 · 전투 스킬 · 비술 적중 시 확률 발동
const PROC: Record<SchoolId, ((b: Battle, u: CUnit, t: CUnit) => void) | null> = {
  pyro(b, u, t) {
    if (P(u, 'pyro.beacon')) return; // 봉화: 자신의 발화 확률 0 (아군 기본 공격 쪽에서 붙는다)
    addBurn(b, u, t, 1, 0.25 * (P(u, 'pyro.runaway') && reasonOf(u) < 0 ? 2 : 1));
  },
  chrono(b, u, t) {
    if (P(u, 'chrono.zero') && stacksOf(t, 'chill') >= 6 && freeze(b, u, t, 99)) return; // 절대 영도: 확정 빙결
    addChill(b, u, t, 1, 0.3);
  },
  volt(b, u, t) { addConduct(b, u, t, 1, 0.25); },
  wave(b, u, t) { b.applyStatus(u, t, resonanceStatus(b, u), 0.2); },
  seed(b, u, t) { b.applyStatus(u, t, poisonStatus(b, u, 1), 0.25); },
  mind(b, u, t) { confuse(b, u, t, 1, 0.15); },
  gold: null,
  illusion(b, u, t) { scent(b, u, t, 0.2); },
};
const procHooks = (id: SchoolId): Hooks => ({
  onDeal(b, u, t, r, o) {
    if (o.tag !== 'basic' && o.tag !== 'skill') return;
    if (r.miss || !t.alive || t === u || b.sideOf(t) === b.sideOf(u)) return;
    PROC[id]?.(b, u, t);
  },
});
/** 전공별 기본 훅 (지속 능력 중 확률 발동이 아닌 것) */
const BASE_HOOKS: Partial<Record<SchoolId, Hooks>> = {
  gold: {
    // 분산 투자: 임시 장비 1개당 주는 피해 +5%, 피해량 경감 +3%
    dmgMult: (_b, u, t) => (t === u ? 1 : 1 + 0.05 * goldN(u)),
    takenMult: (_b, u) => 1 - 0.03 * goldN(u),
  },
};

// ───────────────────────── 학파 이성 축 (선형)
interface GroupFx { dyn?: (u: CUnit, h: number, l: number) => void; hooks: Hooks }
const elemIn = (o: DmgOpts, els: Elem[]) => els.includes(o.elem);
function axis(els: Elem[], lo: number, hi: number): GroupFx {
  return {
    hooks: {
      dmgMult: (_b, u, t, o) => (t !== u && elemIn(o, els) ? 1 + lo * reasonHL(u)[1] : 1),
      takenMult: (_b, u, _s, o) => (elemIn(o, els) ? 1 - hi * reasonHL(u)[0] : 1),
    },
  };
}
const GROUP_FX: Record<GroupId, GroupFx> = {
  thermo: axis(['phys'], 0.4, 0.3),
  field: axis(['elec'], 0.4, 0.3),
  life: axis(['chem', 'psy'], 0.35, 0.3),
  causal: {
    dyn: (u, h, l) => { dyn(u, 'crit', 0.25 * l); dyn(u, 'critDmg', 0.25 * l); dyn(u, 'eva', 0.1 * h); u.mem.critRed = 0.4 * h; },
    hooks: {},
  },
};
function schoolEffect(id: SchoolId): Effect {
  const fx = GROUP_FX[SCHOOL_BY_ID[id].group];
  const sync = (u: CUnit) => { if (fx.dyn && u.reason !== null) { const [h, l] = reasonHL(u); fx.dyn(u, h, l); } };
  return {
    setup(u) {
      if (u.ttype !== 'psionic' || u.isSummon) return;
      u.school = id;
      u.cantrip = CANTRIPS[id];
      u.cantripMax = SCHOOL_BY_ID[id].cantrip.cd;
      u.cantripCd = u.cantripMax * 0.5;
      u.hooks.push(procHooks(id));
      const base = BASE_HOOKS[id];
      if (base) u.hooks.push(base);
    },
    hooks: {
      ...fx.hooks,
      onStart(b, u) {
        if (u.cantrip) { u.cantripMax = u.cantrip.cd(b, u); u.cantripCd = u.cantripMax * 0.5; } // 전공 증강 반영 (변동성 · 분신)
        sync(u);
      },
      onTick(_b, u) { sync(u); },
    },
  };
}

// ───────────────────────── 전공 증강: 플래그 + 필요한 훅
const PASSIVE_FX: Record<string, Effect> = {
  // 화염 확산: 연소된 적이 쓰러지면 그 중첩을 주변 1칸 적 모두에게
  'pyro.spread': { hooks: { onAnyDeath(b, u, dead) {
    if (!u.alive || b.sideOf(dead) === b.sideOf(u)) return;
    const s = dead.statuses.find((x) => x.key === 'burn' && x.src === u);
    if (s) for (const e of b.around(dead, 1, b.enemiesOf(u))) if (e.alive) addBurn(b, u, e, s.stacks || 1);
  } } },
  // 열폭주: 이성 0 미만이면 자신이 준 연소 피해의 10%를 자신도 받는다 (확률 · 쿨다운은 비술 · 발동 쪽)
  'pyro.runaway': { hooks: { onDeal(b, u, t, r, o) {
    if (o.key === 'burn' && t !== u && r.amount > 0 && u.alive && reasonOf(u) < 0) b.rawHit(u, u, r.amount * 0.1, 'phys');
  } } },
  // 잿불 갑주: 연소 피해의 20% 보호막
  'pyro.ember': { hooks: { onDeal(b, u, t, r, o) { if (o.key === 'burn' && t !== u && r.amount > 0 && u.alive) b.shield(u, r.amount * 0.2); } } },
  // 봉화: 아군 전원의 기본 공격에 10% 발화
  'pyro.beacon': { hooks: { onStart(b, u) {
    if (u.school !== 'pyro') return;
    for (const a of b.alliesOf(u)) a.hooks.push({ onBasic(bb, _self, t, r) {
      if (u.alive && t.alive && r.amount > 0 && !r.miss && bb.sideOf(t) !== bb.sideOf(u)) addBurn(bb, u, t, 1, 0.1);
    } });
  } } },
  'chrono.rewind': { hooks: rewindHooks() },
  // 엔트로피 역류: 빙결된 적 1명당 쿨다운 감소 속도 +10% (최대 +30%)
  'chrono.revert': { hooks: { onTick(b, u) {
    const n = b.enemiesOf(u).filter((e) => hasKey(e, 'freeze')).length;
    dyn(u, 'cdr', Math.min(0.3, 0.1 * n), 'revert');
  } } },
  // 패러데이 새장: 전투 시작 6초간 아군 전원
  'volt.cage': { hooks: { onStart(b, u) {
    if (u.school !== 'volt') return;
    for (const a of b.alliesOf(u)) b.applyStatus(u, a, { type: 'buff', key: 'psi.cage', dur: 6, taken: [red('elec', 0.3)], delta: { effRes: 0.2 }, label: '패러데이 새장' });
  } } },
  // 역장: 이성 30 이상이면 피해량 경감 15%, 밀쳐내기 면역
  'wave.field': { hooks: {
    takenMult: (_b, u) => (reasonOf(u) >= 30 ? 0.85 : 1),
    onTick(_b, u) { u.mem.noKnock = reasonOf(u) >= 30 ? 1 : 0; },
  } },
  // 공생균: 중독 피해의 25%만큼 체력 비율이 가장 낮은 아군 회복
  'seed.symb': { hooks: { onDeal(b, u, t, r, o) {
    if (o.key !== 'poison' || t === u || r.amount <= 0 || !u.alive) return;
    const a = b.lowestHpAlly(u);
    if (a) b.heal(u, a, r.amount * 0.25);
  } } },
  // 광합성: 이성 30 이상이면 초당 최대 체력 1.5% 회복
  'seed.photo': { hooks: { onTick(b, u, dt) {
    if (reasonOf(u) < 30) { u.mem.photoT = 0; return; }
    u.mem.photoT = (u.mem.photoT || 0) + dt;
    if (u.mem.photoT >= 1) { u.mem.photoT -= 1; b.heal(u, u, b.S(u, 'maxHp') * 0.015); }
  } } },
  // 포자 폭발: 중독된 적이 쓰러지면 주변 1칸 적에게 60% 화학 피해 + 중독을 옮긴다
  'seed.burst': { hooks: { onAnyDeath(b, u, dead) {
    if (!u.alive || b.sideOf(dead) === b.sideOf(u)) return;
    const s = dead.statuses.find((x) => x.key === 'poison' && x.src === u);
    if (!s) return;
    b.fx(dead.x, dead.y, 1, 'chem');
    for (const e of b.around(dead, 1, b.enemiesOf(u))) {
      if (!e.alive) continue;
      zap(b, u, e, 0.6, 'chem', 'proc');
      if (e.alive) b.applyStatus(u, e, poisonStatus(b, u, s.stacks ?? 1));
    }
  } } },
  // 초월자의 시선: 결속된 적에게 주는 피해 +30%
  'mind.gaze': { hooks: { dmgMult: (b, u, t) => (t !== u && b.sideOf(t) !== b.sideOf(u) && hasKey(t, 'bond') ? 1.3 : 1) } },
  // 자아 분리: 이성 0 미만일 때 받는 피해의 30%를 결속된 적에게
  'mind.split': { hooks: { redirect(b, u, _src, dmg, o) {
    if (reasonOf(u) >= 0) return dmg;
    const bonded = b.enemiesOf(u).filter((e) => hasKey(e, 'bond'));
    const e = bonded.length ? b.nearest(u, bonded) : null;
    if (!e) return dmg;
    b.rawHit(u, e, dmg * 0.3, o.elem);
    return dmg * 0.7;
  } } },
  // 공매도: 이성 0 미만이면 기본 공격 적중 시 주요 위력 20% (+임시 장비 1개당 5%) 추가 피해 (시장 개입과 별도)
  'gold.short': { hooks: { onBasic(b, u, t, r) {
    if (r.amount <= 0 || !t.alive || !u.alive || reasonOf(u) >= 0) return;
    zap(b, u, t, 0.2 + 0.05 * goldN(u), 'phys', 'proc');
  } } },
  // 선물 거래: 전투 시작 시 임시 장비 2개
  'gold.futures': { hooks: { onStart(b, u) { if (u.school === 'gold') { giveTempItem(b, u); giveTempItem(b, u); } } } },
  // 변동성: 이성 증감량 ×1.5 (쿨다운 -2초는 비술 쪽)
  'gold.vol': { setup: (u) => { u.mem.reasonAmp = (u.mem.reasonAmp || 0) + 0.5; } },
  // 환조: 환영이 쓰러질 때 잔향 (시간 만료는 dismiss 에서)
  'illusion.echo': { hooks: { onAllyDeath(b, u, dead) { if (dead.owner === u && dead.mem.illusion) echo(b, dead); } } },
};
function passiveEffect(school: SchoolId, key: string): Effect {
  const id = `${school}.${key}`;
  const fx = PASSIVE_FX[id];
  return {
    ...fx,
    setup(u, b, ctx) { u.mem[`ps.${id}`] = 1; fx?.setup?.(u, b, ctx); },
  };
}

// ───────────────────────── 증강 정의
const schoolDesc = (id: SchoolId) => {
  const s = SCHOOL_BY_ID[id];
  const g = GROUPS[s.group];
  return `${g.name} · ${s.study}. 비술 「${s.cantrip.name}」 (쿨다운 ${s.cantrip.cd}초 · 이성 -${s.cantrip.cost}): ${s.cantrip.desc} 지속 「${s.passive.name}」: ${s.passive.desc} 고이성: ${g.high}. 저이성: ${g.low}.`;
};
/** 전공 선택 증강 8종 (합류 시 학파의 2개 중 1개, 레이첼은 8개 중) */
export const SCHOOL_AUGS: AugDef[] = SCHOOLS.map((s) => ({
  id: schoolAugId(s.id), name: s.name, desc: schoolDesc(s.id), pool: 'school', owner: s.id,
  effect: () => schoolEffect(s.id),
}));
/** 서로 함께 가질 수 없는 조합 (◆ 변형이 무의미하게 만드는 증강) */
const EXCL: Record<string, string[]> = {
  'chrono.haste': ['chrono.storm'],
  'volt.reverse': ['volt.short', 'volt.overload', 'volt.chain'],
  'mind.hypno': ['mind.ascend', 'mind.dominate'],
  'gold.dividend': ['gold.folio'],
};
/** 전공 증강 56종 (전공당 7종, 5 · 10 · 15 · 20등급에 그 전공 것만, 최대 4개) */
export const PSI_AUGS: AugDef[] = SCHOOLS.flatMap((s) => SCHOOL_PASSIVES[s.id].map(([key, name, desc]): AugDef => {
  const ex = [...(EXCL[`${s.id}.${key}`] || []), ...Object.entries(EXCL).filter(([, v]) => v.includes(`${s.id}.${key}`)).map(([k]) => k)];
  return {
    id: psiAugId(s.id, key), name, desc, pool: 'psionic', owner: s.id,
    effect: () => passiveEffect(s.id, key),
    excl: ex.length ? ex.map((x) => `psi.${x}`) : undefined,
  };
}));
/** 전공의 전공 증강 */
export const schoolPassives = (s: SchoolId | null) => (s ? PSI_AUGS.filter((a) => a.owner === s) : []);
