// 사이오닉 4학파 · 8전공 (docs/PSIONIC_REWORK_DRAFT.md)
// 전공 증강 8종 (pool 'school': 비술 + 기본 지속 능력 + 학파 이성 축) · 전공 증강 80종 (pool 'psionic', 전공당 기본 8종 (◆ 변형 포함) + ★ 전설 2종)
// 이성 비율 r = 이성/100, 고이성 h = max(0, r), 저이성 l = max(0, -r) (선형).
// 계수 기준 = 주요 위력 (명사수 사격 · 돌격가 타격 · 전문가 기술 · 지휘관 전술) × CFG.psiPower.
// 기본 지속 능력의 확률 발동은 기본 공격 · 전투 스킬 · 비술 적중에만 (지속 피해 · 소환물 · 부가 피해 제외).
// 공통 규칙 (저이성 정신 피해 · 광폭 · 혼란 · 도발)은 engine/combat.ts 에 있다.
import { PSI_EXTRA } from './psiextra';
import type { Battle, Cantrip, CUnit, DmgOpts, DmgResult, Hooks, Status } from '../engine/combat';
import { type AugDef, type AugReq, type Effect, type EffectCtx, applyLive, red, scaleEffect, vuln } from '../engine/effects';
import { emptyStats, type Elem, type StatKey } from '../types';
import { ALL_COMPONENTS, itemEffect } from './items';
import { isHarmful } from './kit';
import { CFG } from '../config';
import { Rng } from '../rng';
import { cantripCdOf, CONDUCT_SNAP, PSI, PSI_HIT, PSI_ICD, psiStackCap } from './psinum';
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
/** 배당이면 성공 횟수에 자신이 직접 받은 임시 장비(선물 거래)도 더한다 (최대 3) — 선물 거래 장비가 분산 투자에서 빠지지 않게 */
const goldN = (u: CUnit) => (P(u, 'gold.dividend') ? Math.min(PSI.gold.max, (u.mem.goldDiv || 0) + (u.mem.goldItems || 0)) : u.mem.goldItems || 0);
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
  const per = mp(b, u) * PSI.pyro.dps;
  const ok = b.applyStatus(u, t, {
    type: 'dot', key: 'burn', dur: P(u, 'pyro.kindle') ? PSI.pyro.kindleDur : PSI.pyro.dur, elem: 'phys', stacks: n, maxStacks: psiStackCap('burn', (k) => P(u, k)),
    perDps: per, dps: per * n, label: LB('burn'), onStack: burnArmor,
  }, chance);
  if (ok && P(u, 'pyro.nova')) nova(b, u, t);
  return ok;
}
/** ★ 초신성: 연소가 최대 중첩이면 폭발 (대상 + 주변 2칸, 중첩당 20%), 휘말린 적에게 연소 2중첩 (같은 적 3초에 1회) */
function nova(b: Battle, u: CUnit, t: CUnit) {
  const s = statusOf(t, 'burn');
  if (!s || !t.alive || (s.stacks || 0) < (s.maxStacks || PSI.pyro.max)) return;
  if (!icd(b, t, `novaIcd${u.id}`, PSI.pyro.novaIcd)) return;
  const n = s.stacks || 1;
  t.statuses = t.statuses.filter((x) => x !== s);
  b.fx(t.x, t.y, PSI.pyro.novaR, 'phys');
  b.emit({ k: 'status', id: t.id, name: '초신성', src: u.id, harm: true });
  const hit = [t, ...nearby(b, u, t, PSI.pyro.novaR)];
  for (const e of hit) if (e.alive) zap(b, u, e, PSI.pyro.novaPer * n, 'phys', 'proc');
  for (const e of hit) if (e !== t && e.alive) addBurn(b, u, e, PSI.pyro.novaSeed);
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
  const splash = nearby(b, u, t, PSI.pyro.splashR);
  const had = hasKey(t, 'burn'); // 시전 전에 연소가 있었는지 (이번 적중의 발화는 소모 여부를 바꾸지 않는다)
  zap(b, u, t, PSI.pyro.splash, 'phys');
  for (const e of splash) zap(b, u, e, PSI.pyro.splash, 'phys');
  const bs = statusOf(t, 'burn');
  if (t.alive && bs && had) {
    const n = bs.stacks || 1, per = P(u, 'pyro.wp') ? PSI.pyro.wpPer : PSI.pyro.per;
    const drop = () => { t!.statuses = t!.statuses.filter((s) => s !== bs); };
    if (!P(u, 'pyro.white')) drop(); // 백열: 방어도 감소가 남은 채로 계산
    b.emit({ k: 'status', id: t.id, name: '소각', src: u.id, harm: true });
    zap(b, u, t, per * n, 'phys');
    drop();
    // 연쇄 소각: 연소를 소모한 적이 쓰러지면 즉시 한 번 더 (쿨다운 · 이성 소모 없음)
    if (!t.alive && P(u, 'pyro.chain') && depth < PSI.pyro.chainMax && u.alive && !b.over) incinerate(b, u, depth + 1);
  } else if (t.alive) addBurn(b, u, t, P(u, 'pyro.kindle') ? PSI.pyro.kindleSeed : PSI.pyro.seed); // 불씨 보존: 2 → 4중첩
  return { to: t };
}

// ───────────────────────── 시공: 오한 · 빙결
export function addChill(b: Battle, u: CUnit, t: CUnit, n: number, chance = 1) {
  const per = mp(b, u) * PSI.chrono.chillDps;
  return b.applyStatus(u, t, {
    type: 'dot', key: 'chill', dur: 5, elem: 'phys', stacks: n, maxStacks: psiStackCap('chill', (k) => P(u, k)), perDps: per, dps: per * n,
    perDelta: { atkSpd: -PSI.chrono.chillSlow, moveSpd: -PSI.chrono.chillSlow }, label: LB('chill'),
  }, chance);
}
/** ★ 시간의 메아리: 빙결 상태별로 얼어 있는 동안 받은 피해 */
const ECHO_REC = new WeakMap<Status, number>();
function freeze(b: Battle, u: CUnit, t: CUnit, chance: number) {
  const echo = P(u, 'chrono.echo');
  const ok = b.applyStatus(u, t, {
    type: 'stun', key: 'freeze', dur: P(u, 'chrono.perma') ? PSI.chrono.permaDur : PSI.chrono.freezeDur, label: LB('freeze'),
    taken: P(u, 'chrono.stop') ? [vuln('all', PSI.chrono.stopVuln)] : undefined,
    // 시간의 메아리: 얼어 있는 동안 받은 피해를 모았다가, 빙결이 풀릴 때 그 40%를 한 번 더 (이미 경감된 피해 그대로)
    onHit: echo ? (_bb, _v, _src, r, _o, st) => { ECHO_REC.set(st, (ECHO_REC.get(st) || 0) + r.amount); } : undefined,
    onExpire: echo ? (bb, v, st) => {
      const rec = ECHO_REC.get(st) || 0;
      if (!v.alive || rec <= 0) return;
      bb.emit({ k: 'status', id: v.id, name: '시간의 메아리', src: u.id, harm: true });
      bb.rawHit(u, v, rec * PSI.chrono.echoK, 'phys');
    } : undefined,
  }, chance);
  if (!ok) return false;
  if (!P(u, 'chrono.perma')) t.statuses = t.statuses.filter((s) => s.key !== 'chill'); // 오한 소모
  b.fx(t.x, t.y, 0, 'elec', 'aura');
  if (P(u, 'chrono.revert')) b.addReason(u, PSI.chrono.revertReason, 'chrono.revert');
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
  const n = P(u, 'chrono.storm') ? PSI.chrono.stormShards : PSI.chrono.shards;
  if (P(u, 'chrono.haste')) {
    // 시간 가속: 아군 3명에게 4초간 공격 속도 +25% (소환물보다 기물 우선) + 서리 무장: 그 아군의 다음 기본 공격이 서리 파편처럼 빙결을 판정
    // 서리 폭풍이면 아군 6명 · 공격 속도 +18% (파편 수 → 대상 수)
    const N = PSI.chrono, storm = P(u, 'chrono.storm');
    const al = b.alliesOf(u);
    const real = al.filter((a) => !a.isSummon && !a.noAttack), pool = real.length ? real : al;
    const picks = [...new Set(spread(b, null, pool, Math.min(storm ? N.hasteStormN : N.hasteN, pool.length)))];
    for (const a of picks) {
      b.buff(u, a, 'psi.haste', N.hasteDur, { delta: { atkSpd: storm ? N.hasteStormAtkSpd : N.hasteAtkSpd }, label: '시간 가속' });
      b.buff(u, a, 'psi.frostArm', N.hasteDur, { label: '서리 무장' });
      if (!a.mem.frostArmHook) {
        a.mem.frostArmHook = 1;
        a.hooks.push({ onBasic(bb, self, t, r) {
          const s = statusOf(self, 'psi.frostArm');
          if (!s || !s.src || r.miss || r.amount <= 0 || !t.alive || bb.sideOf(t) === bb.sideOf(self)) return;
          self.statuses = self.statuses.filter((x) => x !== s);
          freeze(bb, s.src, t, N.freezeP + N.freezePerChill * stacksOf(t, 'chill'));
        } });
      }
      b.fx(a.x, a.y, 0, 'elec', 'buff');
    }
    return picks.length ? { to: picks[0] } : false;
  }
  const es = b.targetable(u);
  if (!es.length) return false;
  const t0 = cantripTarget(b, u);
  const coef = P(u, 'chrono.storm') ? PSI.chrono.stormCoef : PSI.chrono.coef;
  for (const t of spread(b, t0, es, n)) {
    if (!t.alive) continue;
    b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
    zap(b, u, t, coef, 'phys');
    if (t.alive) freeze(b, u, t, PSI.chrono.freezeP + PSI.chrono.freezePerChill * stacksOf(t, 'chill'));
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
  if ((c.mem.storeN || 0) < 3) { c.mem.storeN = (c.mem.storeN || 0) + 1; b.addReason(c, 1, 'volt.store'); }
}
/** ally = 역전류 (아군에게 걸린 전도: 그 아군 주변 적에게 피해). hit = 전도를 건 피해량 (적 전도는 중첩당 피해를 이 값 기준으로 고정) */
function conductStatus(b: Battle, u: CUnit, n: number, ally: boolean, hit?: number, opt?: { rad: number; per: number }): Status {
  const hv = P(u, 'volt.hv'), rad = opt?.rad ?? (hv ? PSI.volt.hvR : PSI.volt.r);
  // 역전류(아군 전도)도 고전압이면 중첩당 피해가 오른다 (고전압의 피해 증가가 사라지지 않게). opt = 뇌신 강림 (자신에게 두르는 전도)
  const per = opt?.per ?? (ally ? (hv ? PSI.volt.reverseHvPer : PSI.volt.reversePer) : hv ? PSI.volt.hvPer : PSI.volt.per);
  return {
    // 적 전도: 걸 때의 피해량으로 고정 (잔타가 거는 중첩은 약하게, 최대 2배). 피해량을 모르면 주요 위력 기준
    type: 'buff', key: 'conduct', dur: PSI.volt.dur, stacks: n, maxStacks: psiStackCap('conduct', (k) => P(u, k)),
    val: mp(b, u) * per * (!ally && hit !== undefined ? Math.min(CONDUCT_SNAP.max, Math.max(0, hit) / Math.max(1, mp(b, u) * CONDUCT_SNAP.ref)) : 1), label: LB('conduct'),
    onAct(bb, t, s) {
      const c = s.src;
      if (!c) return;
      const foes = ally ? bb.enemiesOf(t) : bb.enemiesOf(c);
      const near = bb.around(t, rad, foes);
      for (const e of near) {
        if (e === t || !e.alive) continue;
        const r = bb.dealDamage(c, e, (s.val || 0) * (s.stacks || 1), { elem: 'elec', tag: 'proc', kind: pk(c) });
        if (r.amount > 0 && c.alive && P(c, 'volt.store')) storeReason(bb, c);
      }
      // ★ 전력망: 범위 밖 무작위 적 2명에게도 같은 피해
      if (P(c, 'volt.grid')) {
        const far = foes.filter((e) => e.alive && e !== t && !near.includes(e));
        for (const e of bb.rng.sample(far, PSI.volt.gridN)) {
          bb.emit({ k: 'atk', from: t.id, to: e.id, elem: 'elec', ranged: true, chain: true });
          const r = bb.dealDamage(c, e, (s.val || 0) * (s.stacks || 1), { elem: 'elec', tag: 'proc', kind: pk(c) });
          if (r.amount > 0 && c.alive && P(c, 'volt.store')) storeReason(bb, c);
        }
      }
      // 단락: 전도 3중첩인 적이 행동하면 1초 감전 (같은 적 2초에 1회)
      if (!ally && t.alive && P(c, 'volt.short') && (s.stacks || 0) >= 3 && icd(bb, t, 'shortIcd', PSI.volt.shortIcd)) bb.applyStatus(c, t, { type: 'shock', key: 'shock', dur: PSI.volt.shortShock });
      // 역전류 + 단락: 전도 3중첩인 아군이 행동하면 범위 안 가장 가까운 적 감전 (그 아군 기준 2초에 1회)
      if (ally && P(c, 'volt.short') && (s.stacks || 0) >= 3) {
        const near = bb.around(t, rad, foes).filter((e) => e.alive);
        const e = near.length ? bb.nearest(t, near) : null;
        if (e && icd(bb, t, 'shortIcdA', PSI.volt.shortIcd)) bb.applyStatus(c, e, { type: 'shock', key: 'shock', dur: PSI.volt.shortShock });
      }
    },
  };
}
function addConduct(b: Battle, u: CUnit, t: CUnit, n: number, chance = 1, hit?: number) {
  if (P(u, 'volt.reverse')) {
    // 역전류: 대상과 가장 가까운 아군에게
    if (chance < 1 && !b.rng.chance(chance)) return false;
    const al = b.alliesOf(u).filter((a) => !a.noAttack || a === u);
    const a = al.length ? b.nearest(t, al) : null;
    return a ? b.applyStatus(u, a, conductStatus(b, u, n, true)) : false;
  }
  return b.applyStatus(u, t, conductStatus(b, u, n, false, hit), chance);
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
    // 역전류 + 과부하: 그 아군이 이미 전도 3중첩이면 소모해 주변 1칸 적 전원에게 폭발
    const prev = statusOf(a, 'conduct');
    if (prev && (prev.stacks || 0) >= PSI.volt.overloadAt && P(u, 'volt.overload')) {
      a.statuses = a.statuses.filter((x) => x !== prev);
      b.fx(a.x, a.y, 1, 'elec');
      b.emit({ k: 'status', id: a.id, name: '과부하', src: u.id });
      for (const e of b.around(a, 1, b.enemiesOf(u))) if (e.alive) zap(b, u, e, PSI.volt.reverseOverload, 'elec');
    }
    b.applyStatus(u, a, conductStatus(b, u, PSI.volt.reverseN, true));
    // 역전류 + 바운스 번개: 충전한 아군에서 가장 가까운 적부터 차례로
    if (P(u, 'volt.chain')) {
      const others = b.targetable(u).sort((x, y) => b.dist(x, a) - b.dist(y, a)).slice(0, PSI.volt.bounceN);
      let from = a;
      for (const e of others) {
        b.emit({ k: 'atk', from: from.id, to: e.id, elem: 'elec', ranged: true, chain: true });
        zap(b, u, e, PSI.volt.coef * PSI.volt.bounce, 'elec');
        from = e;
      }
    }
    return { to: a };
  }
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
  const cs = statusOf(t, 'conduct');
  const hr = zap(b, u, t, PSI.volt.coef, 'elec');
  if (t.alive && cs && (cs.stacks || 0) >= PSI.volt.overloadAt && P(u, 'volt.overload')) {
    // 과부하: 전도 3중첩 소모 → 주요 위력 300% 전기 폭발
    t.statuses = t.statuses.filter((s) => s !== cs);
    b.fx(t.x, t.y, 1, 'elec');
    b.emit({ k: 'status', id: t.id, name: '과부하', src: u.id, harm: true });
    zap(b, u, t, PSI.volt.overload, 'elec');
  } else if (t.alive) b.applyStatus(u, t, conductStatus(b, u, PSI.volt.conduct, false, hr.amount));
  if (P(u, 'volt.chain')) {
    // 바운스 번개: 대상에서 가장 가까운 다른 적 3명에게 차례로 60%
    const others = b.targetable(u).filter((e) => e !== t).sort((a, c) => b.dist(a, t) - b.dist(c, t)).slice(0, PSI.volt.bounceN);
    let prev = t;
    for (const e of others) {
      b.emit({ k: 'atk', from: prev.id, to: e.id, elem: 'elec', ranged: true, chain: true });
      zap(b, u, e, PSI.volt.coef * PSI.volt.bounce, 'elec');
      prev = e;
    }
  }
  return { to: t };
}

// ───────────────────────── 파장: 밀쳐내기 · 공진
function resonanceStatus(b: Battle, u: CUnit): Status {
  const rad = P(u, 'wave.attract') ? PSI.wave.attractResR : PSI.wave.resR;
  return {
    type: 'buff', key: 'resonance', dur: PSI.wave.resDur, val: mp(b, u) * (P(u, 'wave.freq') ? PSI.wave.freqRes : PSI.wave.res), label: LB('resonance'),
    onHit(bb, v, _src, _r, _o, s) {
      const c = s.src;
      if (!c || !icd(bb, v, 'resIcd', 0.5)) return;
      const k = (v.mem.standUntil || 0) > bb.t ? 2 : 1; // 정상파
      const amt = (s.val || 0) * k;
      for (const e of bb.around(v, rad, bb.enemiesOf(c))) {
        if (e === v || !e.alive) continue;
        bb.dealDamage(c, e, amt, { elem: 'elec', tag: 'proc', kind: pk(c) });
        // ★ 공명 연쇄: 공진 피해를 받은 적 주변 1칸에 같은 피해로 1회 여파 (적마다 1초에 1번, 공진은 옮기지 않아 더 번지지 않는다)
        if (P(c, 'wave.cascade') && icd(bb, e, 'cascIcd', PSI.wave.cascadeIcd)) {
          bb.fx(e.x, e.y, 1, 'elec');
          for (const f of bb.around(e, 1, bb.enemiesOf(c))) if (f !== e && f.alive) bb.dealDamage(c, f, amt, { elem: 'elec', tag: 'proc', kind: pk(c) });
        }
      }
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
  zap(b, u, t, PSI.wave.coef, 'elec');
  b.fx(t.x, t.y, victims.length > 1 ? 1 : 0, 'elec');
  for (const v of victims) {
    if (!v.alive) continue;
    const r = P(u, 'wave.attract') ? b.pull(u, v) : b.knockback(u, v);
    // 충돌: 밀려난 적이 다른 기물과 부딪히면 둘 다 1.2초 기절 (부딪힌 쪽이 아군이면 적만)
    if (!r.moved && r.blocker && P(u, 'wave.impact')) {
      b.stun(u, v, PSI.wave.stun);
      if (b.sideOf(r.blocker) !== b.sideOf(u)) b.stun(u, r.blocker, PSI.wave.stun);
    }
    if (v.alive) b.applyStatus(u, v, resonanceStatus(b, u));
  }
  if (t.alive && P(u, 'wave.seismic') && b.rng.chance(PSI.wave.seismicP)) b.stun(u, t, PSI.wave.stun);
  // ★ 중력 붕괴: 대상 주변 2칸 적을 대상 곁으로 끌어모으고 공진
  if (t.alive && P(u, 'wave.collapse')) {
    const pool = b.around(t, PSI.wave.collapseR, b.enemiesOf(u)).filter((e) => e !== t && e.alive).sort((a, c) => b.dist(a, t) - b.dist(c, t));
    b.fx(t.x, t.y, PSI.wave.collapseR, 'elec');
    for (const e of pool) {
      if (b.dist(e, t) > 1) b.pull(t, e);
      if (e.alive) b.applyStatus(u, e, resonanceStatus(b, u));
    }
  }
  // 여진: 1.5초 뒤 같은 대상에게 한 번 더 (밀쳐내기 없음)
  if (P(u, 'wave.after')) b.later(PSI.wave.afterDelay, () => {
    if (b.over || !t.alive || !u.alive) return;
    b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
    zap(b, u, t, PSI.wave.afterCoef, 'elec', 'proc');
    if (t.alive) b.applyStatus(u, t, resonanceStatus(b, u));
  });
  return { to: t };
}

// ───────────────────────── 파종: 중독 · (◆ 지속 회복)
function poisonStatus(b: Battle, u: CUnit, stacks: number, perDps = mp(b, u) * (P(u, 'seed.venom') ? PSI.seed.venomPer : PSI.seed.per)): Status { // 맹독 14%
  return {
    type: 'dot', key: 'poison', dur: PSI.seed.dur, elem: 'chem', perDps, dps: perDps * stacks, stacks, maxStacks: psiStackCap('poison', (k) => P(u, k)),
    healMul: P(u, 'seed.rot') ? 0.4 : undefined, label: LB('poison'),
    // 괴사: 6중첩 이상이면 받는 모든 피해 +20%
    onStack: P(u, 'seed.necro') ? (s) => { s.taken = (s.stacks || 0) >= PSI.seed.necroAt ? [vuln('all', PSI.seed.necroVuln)] : undefined; } : undefined,
  };
}
function spore(b: Battle, u: CUnit) {
  if (P(u, 'seed.regen')) {
    // 재생 포자: 체력 비율이 가장 낮은 아군에게 지속 회복 (5초, 초당 주요 위력 25%)
    if (!b.enemiesOf(u).length) return false;
    const a = b.lowestHpAlly(u);
    if (!a) return false;
    b.applyStatus(u, a, { type: 'buff', key: 'regen', dur: PSI.seed.regenDur, hps: mp(b, u) * PSI.seed.regenHps, label: LB('regen') });
    b.fx(a.x, a.y, 0, 'chem', 'heal');
    return { to: a };
  }
  const t = cantripTarget(b, u);
  if (!t) return false;
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'chem', ranged: true });
  zap(b, u, t, PSI.seed.coef, 'chem');
  if (t.alive) b.applyStatus(u, t, poisonStatus(b, u, PSI.seed.poison));
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
  const max = P(u, 'mind.collective') ? PSI.mind.collectiveN : PSI.mind.n;
  const group = [t, ...b.around(t, 1, b.targetable(u)).filter((e) => e !== t).sort((a, c) => b.dist(a, t) - b.dist(c, t))].slice(0, max);
  const gid = (b.mem.bondGrp = (b.mem.bondGrp || 0) + 1);
  for (const e of group) b.applyStatus(u, e, { type: 'buff', key: 'bond', dur: PSI.mind.bondDur, taken: [vuln('all', PSI.mind.bondVuln)], val: P(u, 'mind.fate') ? PSI.mind.fateShare : PSI.mind.share, grp: gid, label: LB('bond') });
  b.fx(t.x, t.y, 1, 'psy');
  if (P(u, 'mind.hypno')) {
    // 집단 최면: 매혹 대신 결속된 적 전원 2초 혼란
    // 승천: 혼란 지속 +1초 · 정신 지배: 혼란된 적이 같은 편에게 주는 피해 +100%
    const dur = PSI.mind.hypno + (P(u, 'mind.ascend') ? PSI.mind.ascendPlus : 0);
    for (const e of b.enemiesOf(u)) if (e.statuses.some((s) => s.key === 'bond' && s.grp === gid)) {
      if (confuse(b, u, e, dur)) puppetOn(u, e, 'confuse');
      if (P(u, 'mind.dominate') && !e.mem.hypnoDom) {
        e.mem.hypnoDom = 1;
        e.hooks.push({ dmgMult: (bb, self, t) => (t !== self && bb.sideOf(t) === bb.sideOf(self) && self.statuses.some((s) => s.key === 'confuse' && s.src && P(s.src, 'mind.dominate')) ? 1 + PSI.mind.dominate : 1) });
      }
    }
  } else {
    // 매혹: 일반 적만 (승천: 엘리트도, 지속 +1초 · 엘리트는 절반)
    const asc = P(u, 'mind.ascend');
    if (t.alive && !t.isBoss && (!t.elite || asc)) {
      if (b.applyStatus(u, t, { type: 'buff', key: 'charm', dur: PSI.mind.charm + (asc ? PSI.mind.ascendPlus : 0), label: LB('charm'), mods: P(u, 'mind.dominate') ? [{ kind: 'inc', tag: 'all', v: PSI.mind.dominate }] : undefined })) puppetOn(u, t, 'charm');
    }
  }
  return { to: t };
}
/** ★ 꼭두각시 극장: 계시의 매혹 · 혼란이 끝날 때 체력 50% 이하인 일반 적(승천이면 엘리트도)은 전투 끝까지 매혹 (전투당 최대 2명) */
function puppetOn(u: CUnit, e: CUnit, key: 'charm' | 'confuse') {
  if (!P(u, 'mind.puppet')) return;
  const s = statusOf(e, key);
  if (s && !s.onExpire) s.onExpire = (bb, v) => puppetize(bb, u, v);
}
function puppetize(b: Battle, u: CUnit, v: CUnit) {
  if (!v.alive || v.isBoss || (v.elite && !P(u, 'mind.ascend')) || b.hpPct(v) > PSI.mind.puppetHp || (u.mem.puppets || 0) >= PSI.mind.puppetMax) return;
  const ok = b.applyStatus(u, v, { type: 'buff', key: 'charm', dur: 999, label: '꼭두각시', mods: P(u, 'mind.dominate') ? [{ kind: 'inc', tag: 'all', v: PSI.mind.dominate }] : undefined }, 9);
  if (!ok) return;
  u.mem.puppets = (u.mem.puppets || 0) + 1;
  b.fx(v.x, v.y, 0, 'psy', 'aura');
  // 줄이 끊긴 꼭두각시: 매혹되지 않은 적이 하나도 남지 않으면 쓰러진다 (전투가 끝나도록)
  if (!v.mem.puppetHook) {
    v.mem.puppetHook = 1;
    v.hooks.push({ onTick(bb, self) {
      if (!self.mem.charmTo || bb.units.some((x) => x.alive && x.side === self.side && !x.mem.charmTo && !x.mem.inert)) return;
      bb.kill(self, u);
    } });
  }
}

// ───────────────────────── 보화: 임시 장비 (전투 한정)
/** 무작위 재료 장비 1개를 이번 전투 동안 장착 (기물당 최대 3개). CUnit.tempItems 에 표시, 개수는 mem.goldItems */
export function giveTempItem(b: Battle, u: CUnit, to: CUnit = u) {
  if ((to.mem.goldItems || 0) >= PSI.gold.max || !to.alive) return false;
  const id = b.rng.pick(ALL_COMPONENTS);
  applyLive(to, P(u, 'gold.leverage') ? scaleEffect(itemEffect(id), 2) : itemEffect(id), b, noCtx(b));
  to.tempItems = [...(to.tempItems || []), id];
  to.mem.goldItems = (to.mem.goldItems || 0) + 1;
  GOLD_GOT.set(u, [...(GOLD_GOT.get(u) || []), id]);
  b.emit({ k: 'gift', from: u.id, to: to.id, item: id });
  return true;
}
function market(b: Battle, u: CUnit) {
  if (!b.enemiesOf(u).length) return false;
  const t = cantripTarget(b, u);
  const p = PSI.gold.base + PSI.gold.perReason * Math.abs(reasonOf(u)) / 100 + (P(u, 'gold.insider') ? PSI.gold.insider : 0);
  const hedge = P(u, 'gold.hedge'); // ★ 완전 헤지: 성공과 실패를 모두
  const win = hedge || b.rng.chance(p);
  let got = false;
  if (win && P(u, 'gold.dividend')) {
    // 배당: 아군 3명에게 1개씩 (성공 3회까지)
    if ((u.mem.goldDiv || 0) < PSI.gold.divMax) {
      const al = b.alliesOf(u, false).filter((a) => !a.isSummon && (a.mem.goldItems || 0) < PSI.gold.max);
      for (const a of b.rng.sample(al, PSI.gold.divN)) got = giveTempItem(b, u, a) || got;
      if (got) u.mem.goldDiv = (u.mem.goldDiv || 0) + 1;
    }
  } else if (win) got = giveTempItem(b, u, u);
  if (hedge) failShield(b, u); // 완전 헤지: 실패 몫은 언제나 보호막 (레버리지여도 자해 없음)
  else if (!got) {
    if (!win && P(u, 'gold.leverage')) b.dealDamage(u, u, b.S(u, 'maxHp') * PSI.gold.leverageSelf, { elem: 'true', tag: 'proc', noHooks: true, key: 'reason' }); // 레버리지 실패
    else failShield(b, u);
  }
  return { to: t || undefined };
}
/** 시장 개입 실패 보호막: 체력이 가장 낮은 아군 (안전 자산: 2명 · 140%) */
function failShield(b: Battle, u: CUnit) {
  const safe = P(u, 'gold.safe');
  const al = b.alliesOf(u).slice().sort((x, y) => b.hpPct(x) - b.hpPct(y)).slice(0, safe ? PSI.gold.safeN : 1);
  for (const a of al) { b.shield(a, mp(b, u) * (safe ? PSI.gold.safeShield : PSI.gold.shield)); b.fx(a.x, a.y, 0, 'holy', 'heal'); }
}
/** ★ 실물 인출: 이번 전투에서 자신이 받은 임시 장비 */
const GOLD_GOT = new WeakMap<CUnit, string[]>();

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
const maxShades = (u: CUnit) => (P(u, 'illusion.troupe') ? PSI.illusion.troupeMax : PSI.illusion.max);
const shadesOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.alive && s.owner === u && s.mem.illusion);
/** 잔향: 환영이 사라질 때 주변 1칸 적에게 주요 위력 120% 정신 피해 */
function echo(b: Battle, s: CUnit) {
  const o = s.owner;
  if (!o || !o.alive || !s.mem.illusion || !P(o, 'illusion.echo') || s.mem.echoed) return;
  s.mem.echoed = 1;
  b.fx(s.x, s.y, 1, 'psy');
  for (const e of b.around(s, 1, b.enemiesOf(o))) if (e.alive) zap(b, o, e, PSI.illusion.echo, 'psy', 'proc');
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
          else e.statuses.push({ type: 'buff', key: 'psi.fog', dur: 0.4, delta: { acc: -PSI.illusion.fog }, src: owner, label: '안개' });
        }
      }
    }
  },
  // 교란: 환영을 공격한 적은 공격 속도 -10% (최대 -30%)
  onHurt(b, s, src, _r, o) {
    if (!P(owner, 'illusion.disrupt') || o.tag === 'dot' || b.sideOf(src) === b.sideOf(s) || !src.alive) return;
    b.applyStatus(owner, src, { type: 'buff', key: 'psi.disrupt', dur: 4, stacks: 1, maxStacks: PSI.illusion.disruptMax, perDelta: { atkSpd: -PSI.illusion.disrupt }, label: '교란' });
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
    const I = PSI.illusion, solid = P(u, 'illusion.solid');
    Object.assign(st, u.st);
    st.maxHp = b.S(u, 'maxHp') * (solid ? I.solidCloneHp : I.cloneHp);
    Object.assign(s, {
      name: `${u.name}의 분신`, sprite: u.sprite, palette: u.palette, art: u.defId, atk: { ...u.atk }, keywords: u.keywords.slice(), category: u.category,
      weapon: u.weapon ? { ...u.weapon } : null, ammo: u.weapon?.mag || 0, ctype: u.ctype, phaseAmp: I.cloneDmg, noAttack: u.noAttack,
    });
    s.mem.life = (P(u, 'illusion.troupe') ? I.troupeCloneLife : I.cloneLife) + (P(u, 'illusion.linger') ? I.lingerClone : 0); // 군무: 분신이 더 오래 남아 여러 기가 함께 싸운다 · 잔상 +3초
    if (solid) {
      // 실체화 + 분신: 더 단단한 몸 (체력 70%, 받는 피해 -15%), 기본 공격이 맞으면 주요 위력 20% 정신 추가 피해 (시전자 몫)
      s.mem.solid = 1;
      s.hooks.push({
        takenMult: () => 1 - I.solidCloneRed,
        onBasic(bb, _self, t, r) { if (u.alive && t.alive && !r.miss && r.amount > 0 && bb.sideOf(t) !== bb.sideOf(u)) zap(bb, u, t, I.solidCloneHit, 'psy', 'proc'); },
      });
    }
  } else {
    // 환영: 체력 = 자신 최대 체력 30%, 제자리 · 도발 (실체화: 주요 위력 40%로 공격)
    const linger = P(u, 'illusion.linger'); // 잔상: 지속 · 체력
    st.maxHp = b.S(u, 'maxHp') * (linger ? PSI.illusion.lingerHp : PSI.illusion.hp);
    st.armor = b.S(u, 'armor');
    st.effRes = b.S(u, 'effRes');
    st.range = 1; st.moveSpd = 1; st.critDmg = 1.5;
    st.strike = mp(b, u) * PSI.illusion.solid;
    st.acc = b.S(u, 'acc');
    Object.assign(s, { name: '환영', art: 'sm_illusion', immobile: true, noAttack: !P(u, 'illusion.solid') });
    s.mem.taunt = 1;
    s.mem.life = linger ? PSI.illusion.lingerLife : PSI.illusion.life;
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
  if (P(u, 'illusion.mirror') && t.alive && !t.isBoss) mirrorImage(b, u, t);
  if (!s) return false;
  b.fx(s.x, s.y, 0, 'psy', 'aura');
  return { to: t };
}
/** ★ 거울 상: 대상 적의 능력치 · 기본 공격을 복사한 아군 (8초, 체력 40%, 피해 60%, 스킬 없음, 최대 1기, 보스 제외) */
function mirrorImage(b: Battle, u: CUnit, t: CUnit) {
  const I = PSI.illusion;
  const old = b.units.find((x) => x.alive && x.owner === u && x.mem.mirror);
  if (old) dismiss(b, old);
  const s = blankSummon(u);
  Object.assign(s.st, t.st);
  s.st.maxHp = b.S(t, 'maxHp') * I.mirrorHp;
  Object.assign(s, {
    name: `${t.name}의 거울 상`, sprite: t.sprite, palette: ILLUSION_PAL, art: t.art, atk: { ...t.atk }, keywords: t.keywords.slice(), category: t.category,
    phaseAmp: (t.phaseAmp || 1) * I.mirrorDmg, immobile: t.immobile, noAttack: t.noAttack,
  });
  s.mem.mirror = 1;
  s.mem.life = I.mirrorLife;
  s.hp = s.st.maxHp;
  s.hooks.push({ onTick(bb, self, dt) { self.mem.life -= dt; if (self.mem.life <= 0) dismiss(bb, self); } });
  const m = b.spawn(s, t);
  if (m) { b.fx(m.x, m.y, 0, 'psy', 'aura'); b.emit({ k: 'status', id: m.id, name: '거울 상', src: u.id }); }
  return m;
}
function scent(b: Battle, u: CUnit, t: CUnit, chance: number) {
  return b.applyStatus(u, t, {
    type: 'buff', key: 'scent', dur: PSI.illusion.scentDur, stacks: 1, maxStacks: psiStackCap('scent', (k) => P(u, k)), perDelta: { eva: -PSI.illusion.scentEva }, label: LB('scent'),
    onStack: (s) => { s.taken = [vuln('all', PSI.illusion.scentVuln * (s.stacks || 1))]; },
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
      let cd = cantripCdOf(id, (k) => P(u, k)); // 변동성 · 분신 (설명 쪽과 같은 함수)
      if (id === 'pyro' && P(u, 'pyro.runaway') && reasonOf(u) < 0) cd *= PSI.pyro.runawayCd; // 열폭주 (이성에 따라)
      return Math.max(0.5, cd);
    },
    cost() { return c.cost; },
  };
}
export const CANTRIPS = Object.fromEntries(SCHOOLS.map((s) => [s.id, makeCantrip(s.id)])) as Record<SchoolId, Cantrip>;

// ───────────────────────── 기본 지속 능력: 기본 공격 · 전투 스킬 · 비술 적중 시 확률 발동
/** 피해량 비례 확률 배율 (파장 · 시공): 이번 피해 ÷ (주요 위력 × 0.8), 최대 2배 */
const hitScale = (b: Battle, u: CUnit, dmg: number) => Math.min(PSI_HIT.max, Math.max(0, dmg) / Math.max(1, mp(b, u) * PSI_HIT.ref));
/** 같은 대상에게는 1초에 한 번만 판정 (환조 · 정신) */
const perTarget = (b: Battle, u: CUnit, t: CUnit, tag: string) => icd(b, t, `${tag}${u.id}`, PSI_ICD);
const PROC: Record<SchoolId, ((b: Battle, u: CUnit, t: CUnit, r: DmgResult) => void) | null> = {
  pyro(b, u, t) {
    if (P(u, 'pyro.beacon')) return; // 봉화: 자신의 발화 확률 0 (아군 기본 공격 쪽에서 붙는다)
    addBurn(b, u, t, 1, PSI.pyro.proc * (P(u, 'pyro.runaway') && reasonOf(u) < 0 ? PSI.pyro.runawayProc : 1));
  },
  chrono(b, u, t, r) {
    if (P(u, 'chrono.zero') && stacksOf(t, 'chill') >= PSI.chrono.zeroMax && freeze(b, u, t, 99)) return; // 절대 영도: 확정 빙결
    addChill(b, u, t, 1, PSI.chrono.proc * hitScale(b, u, r.amount));
  },
  volt(b, u, t, r) { addConduct(b, u, t, 1, P(u, 'volt.static') ? PSI.volt.staticProc : PSI.volt.proc, r.amount); }, // 정전기 40%
  wave(b, u, t, r) { b.applyStatus(u, t, resonanceStatus(b, u), PSI.wave.proc * hitScale(b, u, r.amount)); },
  seed(b, u, t) { b.applyStatus(u, t, poisonStatus(b, u, 1), PSI.seed.proc); },
  mind(b, u, t) { const er = P(u, 'mind.erode'); if (perTarget(b, u, t, 'mindIcd')) confuse(b, u, t, er ? PSI.mind.erodeConfuse : PSI.mind.confuse, er ? PSI.mind.erodeProc : PSI.mind.proc); }, // 잠식 40% · 1.5초
  gold: null,
  illusion(b, u, t) { if (perTarget(b, u, t, 'scentIcd')) scent(b, u, t, PSI.illusion.proc); },
};
const procHooks = (id: SchoolId): Hooks => ({
  onDeal(b, u, t, r, o) {
    if (o.tag !== 'basic' && o.tag !== 'skill') return;
    if (r.miss || !t.alive || t === u || b.sideOf(t) === b.sideOf(u)) return;
    PROC[id]?.(b, u, t, r);
  },
});
/** 전공별 기본 훅 (지속 능력 중 확률 발동이 아닌 것) */
const BASE_HOOKS: Partial<Record<SchoolId, Hooks>> = {
  gold: {
    // 분산 투자: 임시 장비 1개당 주는 피해 +5%, 피해량 경감 +3%
    dmgMult: (_b, u, t) => (t === u ? 1 : 1 + PSI.gold.perDmg * goldN(u)),
    takenMult: (_b, u) => 1 - PSI.gold.perRed * goldN(u),
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
    // 저이성: 치명타가 기술 피해(전투 스킬 · 비술)에도 적용된다 (기술 치명 허용의 예외, 지속 피해 제외)
    dyn: (u, h, l) => { dyn(u, 'crit', 0.25 * l); dyn(u, 'critDmg', 0.25 * l); dyn(u, 'eva', 0.1 * h); u.mem.critRed = 0.4 * h; u.mem.lowTechCrit = l > 0 ? 1 : 0; },
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
/** ★ 뇌신 강림: 자신에게 사라지지 않는 전도를 두른다 (지워지거나 줄면 다시) */
function avatar(b: Battle, u: CUnit) {
  if (u.school !== 'volt' || !u.alive) return;
  const N = PSI.volt;
  const st = conductStatus(b, u, N.avatarN, true, undefined, { rad: N.avatarR, per: P(u, 'volt.hv') ? N.avatarHvPer : N.avatarPer });
  st.dur = 1e6; st.label = '뇌신 강림';
  const ex = statusOf(u, 'conduct');
  if (ex) u.statuses = u.statuses.filter((x) => x !== ex);
  b.applyStatus(u, u, st);
}
const COLONY_PAL = ['#14200c', '#a3d65c', '#4f7a2a', '#e6f5c8', '#8fd14f', '#2e4a18', '#f4ffe0'];
/** ★ 포자 군락: 아군 편 제자리 소환물 */
function colony(b: Battle, u: CUnit, at: CUnit) {
  const N = PSI.seed;
  const live = b.units.filter((x) => x.alive && x.owner === u && x.mem.colony);
  if (live.length >= N.colonyMax) dismiss(b, live[0]);
  const s = blankSummon(u);
  Object.assign(s.st, { maxHp: b.S(u, 'maxHp') * N.colonyHp, armor: b.S(u, 'armor'), effRes: b.S(u, 'effRes'), range: 1, moveSpd: 1 });
  Object.assign(s, { name: '포자 군락', art: 'sm_spore', sprite: 'crawler', palette: COLONY_PAL, immobile: true, noAttack: true, keywords: ['bio'], category: 'bio' });
  s.mem.colony = 1;
  s.mem.life = N.colonyLife;
  s.hp = s.st.maxHp;
  s.hooks.push({ onTick(bb, self, dt) {
    self.mem.life -= dt;
    if (self.mem.life <= 0) { dismiss(bb, self); return; }
    self.mem.sporeT = (self.mem.sporeT || 0) + dt;
    if (self.mem.sporeT < 1) return;
    self.mem.sporeT -= 1;
    for (const e of bb.around(self, 1, bb.enemiesOf(self))) if (e.alive) bb.applyStatus(u, e, poisonStatus(bb, u, 1));
  } });
  const c = b.spawn(s, at);
  if (c) { b.fx(c.x, c.y, 0, 'chem', 'aura'); b.emit({ k: 'status', id: c.id, name: '포자 군락', src: u.id }); }
  return c;
}
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
      if (u.alive && t.alive && r.amount > 0 && !r.miss && bb.sideOf(t) !== bb.sideOf(u)) addBurn(bb, u, t, 1, PSI.pyro.beacon * (P(u, 'pyro.runaway') && reasonOf(u) < 0 ? PSI.pyro.runawayProc : 1)); // 열폭주: 봉화 확률도 2배
    } });
  } } },
  // ★ 불사조: 전투당 1회, 쓰러질 피해를 받으면 체력 50% · 해로운 효과 제거로 되살아나고 주변 2칸 적 연소 최대 중첩
  'pyro.phoenix': { hooks: { onLethal(b, u) {
    if (u.mem.phoenix || u.school !== 'pyro') return false;
    u.mem.phoenix = 1;
    u.hp = b.S(u, 'maxHp') * PSI.pyro.phoenixHp;
    u.statuses = u.statuses.filter((x) => !isHarmful(x));
    b.emit({ k: 'mark', id: u.id, name: '불사조', style: 'revive' });
    b.fx(u.x, u.y, PSI.pyro.phoenixR, 'phys');
    const cap = psiStackCap('burn', (k) => P(u, k));
    for (const e of b.around(u, PSI.pyro.phoenixR, b.enemiesOf(u))) if (e.alive) addBurn(b, u, e, cap);
    return u.hp > 0;
  } } },
  'chrono.rewind': { hooks: rewindHooks() },
  // 서리 갑옷: 자신을 공격한 적에게 오한 1중첩 (같은 적 1초에 1회)
  'chrono.rime': { hooks: { onHurt(b, u, src, _r, o) {
    if ((o.tag !== 'basic' && o.tag !== 'skill') || !src.alive || src === u || b.sideOf(src) === b.sideOf(u)) return;
    if (icd(b, src, `rime${u.id}`, PSI.chrono.rimeIcd)) addChill(b, u, src, 1);
  } } },
  // ★ 시간 정지: 비술 4번째마다 보스가 아닌 적 전원 확정 빙결, 보스는 2초간 공격 · 이동 속도 -50%
  'chrono.timestop': { hooks: { onCantrip(b, u) {
    if (u.school !== 'chrono') return;
    u.mem.tstopN = (u.mem.tstopN || 0) + 1;
    if (u.mem.tstopN % PSI.chrono.stopEvery) return;
    const N = PSI.chrono;
    b.emit({ k: 'mark', id: u.id, name: '시간 정지', style: 'rewind' });
    for (const e of b.enemiesOf(u)) {
      if (!e.alive) continue;
      if (e.isBoss) b.applyStatus(u, e, { type: 'buff', key: 'psi.tstop', dur: N.stopBossDur, delta: { atkSpd: -N.stopBossSlow, moveSpd: -N.stopBossSlow }, label: '시간 정지' }, 9);
      else freeze(b, u, e, 99);
    }
  } } },
  // 엔트로피 역류: 빙결된 적 1명당 쿨다운 감소 속도 +10% (최대 +30%)
  'chrono.revert': { hooks: { onTick(b, u) {
    const n = b.enemiesOf(u).filter((e) => hasKey(e, 'freeze')).length;
    dyn(u, 'cdr', Math.min(0.3, 0.1 * n), 'revert');
  } } },
  // ★ 뇌신 강림: 자신에게 사라지지 않는 전도 3중첩 (주변 2칸, 중첩당 12% · 고전압 18%)
  'volt.avatar': { hooks: { onStart(b, u) { avatar(b, u); }, onTick(b, u) { const s = statusOf(u, 'conduct'); if (!s || (s.stacks || 0) < PSI.volt.avatarN || s.dur < 100) avatar(b, u); } } },
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
  // ★ 역병 개화: 내가 건 중독이 최대 중첩에 이르면 터뜨린다 (남은 중독 피해 전부 즉시 + 주변 1칸 중독 2중첩, 적마다 3초에 1번)
  'seed.endless': { hooks: { onInflict(b, u, tgt, s) {
    if (s.key !== 'poison' || b.sideOf(tgt) === b.sideOf(u)) return;
    b.later(0, () => {
      const p = tgt.statuses.find((x) => x.key === 'poison');
      if (b.over || !u.alive || !tgt.alive || !p || (p.stacks || 0) < (p.maxStacks || Infinity) || !icd(b, tgt, 'bloomIcd', PSI.seed.bloomIcd)) return;
      tgt.statuses.splice(tgt.statuses.indexOf(p), 1);
      b.fx(tgt.x, tgt.y, 1, 'chem');
      b.dealDamage(u, tgt, (p.dps || 0) * Math.max(0, p.dur), { elem: 'chem', tag: 'proc', kind: pk(u) });
      for (const e of b.around(tgt, 1, b.enemiesOf(u))) if (e !== tgt && e.alive) b.applyStatus(u, e, poisonStatus(b, u, PSI.seed.bloomSpread));
    });
  } } },
  // ★ 포자 군락: 중독된 적이 쓰러지면 그 자리에 아군 포자 군락 (8초, 1초마다 주변 1칸 적 중독 1중첩, 최대 3기)
  'seed.colony': { hooks: { onAnyDeath(b, u, dead) {
    if (!u.alive || u.school !== 'seed' || b.sideOf(dead) === b.sideOf(u) || dead.isSummon) return;
    if (!dead.statuses.some((x) => x.key === 'poison' && x.src === u)) return;
    colony(b, u, dead);
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
    b.rawHit(u, e, dmg * 0.3, o.elem, true);
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
  // ★ 신기루: 환영 · 분신이 있으면 은신 (적의 표적이 되지 않음)
  'illusion.mirage': { hooks: {
    onTick(b, u) {
      if (u.school !== 'illusion' || !shadesOf(b, u).length) return;
      const st = statusOf(u, 'stealth');
      if (st) st.dur = Math.max(st.dur, 0.3);
      else b.buff(u, u, 'stealth', 0.3, { label: '신기루' });
    },
    // 은신 중 주는 피해 +
    dmgMult: (b, u, t) => (t !== u && b.hidden(u) ? 1 + PSI.illusion.mirageDmg : 1),
  } },
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
/** 전투가 끝난 뒤 런 단위 효과 */
const AFTER: Record<string, AugDef['after']> = {
  // ★ 실물 인출: 이긴 전투에서 받은 임시 장비 중 1개를 30% 확률로 진짜 재료 장비로 (보관함)
  'gold.cashout': (run, _u, won, _k, x) => {
    const got = (x?.c && GOLD_GOT.get(x.c)) || [];
    if (!won || !got.length || !x?.gain) return;
    const r = new Rng(run.rng);
    const hit = r.chance(PSI.gold.cashoutP), id = r.pick(got);
    run.rng = r.s;
    if (hit) x.gain(id);
  },
};
/** 조합 조건: 다른 증강 · 상태가 있어야 제대로 작동하는 전공 증강 (선택은 막지 않는다, 표시는 data/augreq.ts) */
const REQ: Record<string, AugReq> = {
  'pyro.runaway': { hint: '이성 0 미만일 때만 작동', reason: 'neg' },
  'volt.short': { hint: `전도 ${PSI.volt.overloadAt}중첩 필요`, stacks: { st: 'conduct', need: PSI.volt.overloadAt } },
  'volt.overload': { hint: `전도 ${PSI.volt.overloadAt}중첩 필요`, stacks: { st: 'conduct', need: PSI.volt.overloadAt } },
  'wave.standing': { hint: '공진된 적을 기절 · 빙결시킬 수단 필요 (충돌 · 진도 측정, 또는 다른 기물)', alt: ['psi.wave.impact', 'psi.wave.seismic'] },
  'wave.field': { hint: '이성 30 이상일 때만 작동', reason: 'hi30' },
  'seed.photo': { hint: '이성 30 이상일 때만 작동', reason: 'hi30' },
  'seed.necro': { hint: `중독 ${PSI.seed.necroAt}중첩 필요 (독성 농축, 또는 다른 기물의 중독과 함께)`, stacks: { st: 'poison', need: PSI.seed.necroAt } },
  'mind.split': { hint: '이성 0 미만 · 결속된 적이 있을 때만 작동', reason: 'neg' },
  'gold.short': { hint: '이성 0 미만일 때만 작동', reason: 'neg' },
  'gold.folio': { hint: `임시 장비 ${PSI.gold.max}개 필요`, stacks: { st: 'tempgear', need: PSI.gold.max } },
};
/** 전공 증강 56종 (전공당 7종, 5 · 10 · 15 · 20등급에 그 전공 것만, 최대 4개) */
export const PSI_AUGS: AugDef[] = SCHOOLS.flatMap((s) => SCHOOL_PASSIVES[s.id].map(([key, name, desc]): AugDef => {
  return {
    id: psiAugId(s.id, key), name, desc, pool: 'psionic', owner: s.id,
    effect: () => passiveEffect(s.id, key),
    requires: REQ[`${s.id}.${key}`],
    after: AFTER[`${s.id}.${key}`],
  };
}));
/** 전공의 전공 증강 */
export const schoolPassives = (s: SchoolId | null) => (s ? [...PSI_AUGS.filter((a) => a.owner === s), ...(PSI_EXTRA[s] || [])] : []);
