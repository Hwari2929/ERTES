// 사이오닉 학파 (5단계): 학파 증강 7종 (pool 'school': 소마법 + 고 · 저이성 효과) · 전공 증강 42종 (pool 'psionic')
// 이성 비율 r = 이성/100, 고이성 h = max(0, r), 저이성 l = max(0, -r) (선형). 계수는 기술 위력 (지휘관은 전술 위력, b.P)
// 공통 규칙 (저이성 정신 피해 · 광폭)은 engine/combat.ts 에 있다.
import type { Battle, Cantrip, CUnit, Hooks, Status } from '../engine/combat';
import { type AugDef, type Effect, type EffectCtx, applyLive, inc, red, vuln } from '../engine/effects';
import type { StatKey } from '../types';
import { ALL_COMPONENTS, itemEffect } from './items';
import { isHarmful, skillHit } from './kit';
import { PSI_STATUS, SCHOOLS, SCHOOL_BY_ID, SCHOOL_PASSIVES, psiAugId, schoolAugId, type SchoolId } from './schools';

const LB = (k: string) => PSI_STATUS[k].name;
const tp = (b: Battle, u: CUnit) => b.P(u, 'tech');
/** 전공 보유 여부 (id = '학파.키') */
const P = (u: CUnit, id: string) => !!u.mem[`ps.${id}`];
const statusOf = (u: CUnit, k: string) => u.statuses.find((s) => s.key === k);
const hasKey = (u: CUnit, k: string) => u.statuses.some((s) => s.key === k);
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
const reasonOf = (u: CUnit) => u.reason ?? 0;

/** 고이성 · 저이성 비율 (포트폴리오: 임시 장비 3개면 둘 다 최소 50%) */
export function reasonHL(u: CUnit): [high: number, low: number] {
  const r = reasonOf(u) / 100;
  let h = Math.max(0, r), l = Math.max(0, -r);
  if (P(u, 'gold.folio') && (u.mem.goldItems || 0) >= 3) { h = Math.max(h, 0.5); l = Math.max(l, 0.5); }
  return [h, l];
}
/** 이성에 따라 바뀌는 능력치: 지난번 적용분과의 차이만 더한다 */
function dyn(u: CUnit, k: StatKey, v: number) {
  const key = `dyn.${k}`;
  const prev = u.mem[key] || 0;
  if (prev !== v) { u.st[k] += v - prev; u.mem[key] = v; }
}
/** 소마법 대상: 지금 대상(적)이 있으면 그 대상, 없으면 가장 가까운 적 */
function cantripTarget(b: Battle, u: CUnit): CUnit | null {
  const t = u.target;
  if (t && t.alive && !b.hidden(t) && b.sideOf(t) !== b.sideOf(u)) return t;
  return b.nearest(u, b.targetable(u));
}
const noCtx = (b: Battle): EffectCtx => ({ run: null, unit: null, counts: {}, phase: b.ctx.phase, credits: b.ctx.credits });

// ───────────────────────── 홍염학파: 연소
const burnArmor = (s: Status) => { s.armorMul = s.src && P(s.src, 'pyro.white') ? Math.max(0.2, 1 - 0.04 * (s.stacks || 0)) : undefined; };
export function addBurn(b: Battle, u: CUnit, t: CUnit, n: number) {
  return b.applyStatus(u, t, {
    type: 'dot', key: 'burn', dur: 6, elem: 'phys', stacks: n, maxStacks: P(u, 'pyro.boil') ? 8 : 5,
    perDps: tp(b, u) * 0.06, label: LB('burn'), onStack: burnArmor,
  });
}
function ember(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  const ex = statusOf(t, 'burn');
  if (P(u, 'pyro.ignite') && ex && (ex.stacks || 0) >= 5) {
    // 점화: 남은 연소 피해 ×1.5 를 즉시 주고 (연소 소모), 주변 1칸 적에게 연소 2중첩
    const rest = (ex.dps || 0) * Math.max(0, ex.dur) * 1.5;
    t.statuses = t.statuses.filter((s) => s !== ex);
    b.fx(t.x, t.y, 1, 'phys');
    b.emit({ k: 'status', id: t.id, name: '점화', src: u.id, harm: true });
    b.dealDamage(u, t, rest, { elem: 'phys', tag: 'proc', kind: 'tech', key: 'burn' });
    for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) addBurn(b, u, e, 2);
  } else addBurn(b, u, t, 2);
  return { to: t };
}

// ───────────────────────── 뇌전학파: 전도
function storeReason(b: Battle, c: CUnit) {
  // 축전: 전도 피해마다 이성 +1 (초당 최대 +3)
  if (b.t >= (c.mem.storeW || 0)) { c.mem.storeW = Math.floor(b.t) + 1; c.mem.storeN = 0; }
  if ((c.mem.storeN || 0) < 3) { c.mem.storeN = (c.mem.storeN || 0) + 1; b.addReason(c, 1); }
}
function conductStatus(b: Battle, u: CUnit): Status {
  const hv = P(u, 'volt.hv'), rad = hv ? 2 : 1;
  return {
    type: 'buff', key: 'conduct', dur: 4, val: tp(b, u) * (hv ? 0.5 : 0.3), label: LB('conduct'),
    onAct(bb, t, s) {
      const c = s.src;
      if (!c) return;
      for (const e of bb.around(t, rad, bb.enemiesOf(c))) {
        if (e === t || !e.alive) continue;
        const r = bb.dealDamage(c, e, s.val || 0, { elem: 'elec', tag: 'proc', kind: 'tech' });
        if (r.amount > 0 && c.alive && P(c, 'volt.store')) storeReason(bb, c);
      }
    },
  };
}
function discharge(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
  skillHit(b, u, t, 'tech', 0.9, 'elec', { noMiss: true });
  if (t.alive) b.applyStatus(u, t, conductStatus(b, u));
  if (t.alive && P(u, 'volt.short') && b.rng.chance(0.3)) b.applyStatus(u, t, { type: 'shock', key: 'shock', dur: 1 });
  if (P(u, 'volt.chain')) {
    // 연쇄 번개: 대상에서 가장 가까운 다른 적 2명에게 50%
    const others = b.targetable(u).filter((e) => e !== t).sort((a, c) => b.dist(a, t) - b.dist(c, t)).slice(0, 2);
    let prev = t;
    for (const e of others) {
      b.emit({ k: 'atk', from: prev.id, to: e.id, elem: 'elec', ranged: true, chain: true });
      skillHit(b, u, e, 'tech', 0.45, 'elec', { noMiss: true });
      prev = e;
    }
  }
  return { to: t };
}

// ───────────────────────── 파종학파: 중독 · 지속 회복
function poisonStatus(u: CUnit, dps: number, stacks = 1, dur = 5): Status {
  return {
    type: 'dot', key: 'poison', dur, elem: 'chem', dps: dps * stacks, perDps: dps, stacks, maxStacks: P(u, 'seed.conc') ? 3 : 1,
    healMul: P(u, 'seed.rot') ? 0.5 : undefined, label: '중독',
  };
}
function spore(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  b.applyStatus(u, t, poisonStatus(u, tp(b, u) * 0.15));
  b.fx(t.x, t.y, 0, 'chem');
  const allies = b.alliesOf(u).sort((a, c) => b.hpPct(a) - b.hpPct(c)).slice(0, P(u, 'seed.symb') ? 2 : 1);
  for (const a of allies) {
    b.applyStatus(u, a, { type: 'buff', key: 'regen', dur: 5, hps: tp(b, u) * 0.1, label: LB('regen') });
    if (P(u, 'seed.anti')) { const i = a.statuses.findIndex(isHarmful); if (i >= 0) a.statuses.splice(i, 1); } // 항체
    b.fx(a.x, a.y, 0, 'chem', 'heal');
  }
  return { to: t };
}

// ───────────────────────── 시공학파: 오한 · 빙결
function freeze(b: Battle, u: CUnit, t: CUnit) {
  const ok = b.applyStatus(u, t, {
    type: 'stun', key: 'freeze', dur: P(u, 'chrono.perma') ? 2.5 : 1.5, label: LB('freeze'),
    taken: P(u, 'chrono.determ') ? [vuln('all', 0.3)] : undefined,
  });
  if (!ok) return;
  t.statuses = t.statuses.filter((s) => s.key !== 'chill'); // 중첩 소모
  b.fx(t.x, t.y, 0, 'elec', 'aura');
  if (P(u, 'chrono.revert')) b.addReason(u, 4);
}
export function addChill(b: Battle, u: CUnit, t: CUnit, n: number) {
  if (!b.applyStatus(u, t, {
    type: 'dot', key: 'chill', dur: 4, elem: 'phys', stacks: n, maxStacks: 6, perDps: tp(b, u) * 0.03,
    perDelta: { atkSpd: -0.06, moveSpd: -0.06 }, label: LB('chill'),
  })) return;
  const s = statusOf(t, 'chill');
  if (s && t.alive && b.rng.chance((s.stacks || 0) * (P(u, 'chrono.zero') ? 0.12 : 0.08))) freeze(b, u, t);
}
function entropy(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  addChill(b, u, t, 2);
  if (P(u, 'chrono.delay')) for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) addChill(b, u, e, 1);
  return { to: t };
}
/** 되감기: 0.25초마다 체력 기록 (최근 4초) */
const HP_LOG = new WeakMap<CUnit, number[]>();
function tryRewind(b: Battle, u: CUnit) {
  if (u.mem.rewound || b.hpPct(u) > 0.3) return false;
  const log = HP_LOG.get(u) || [];
  let hp = 0;
  for (let i = 0; i < log.length; i += 2) if (log[i] <= b.t - 3) hp = log[i + 1]; // 3초 이상 지난 기록 중 가장 최근
  if (!hp && log.length) hp = log[1];
  if (hp <= Math.max(0, u.hp)) return false;
  u.mem.rewound = 1;
  u.hp = Math.min(b.S(u, 'maxHp'), hp);
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
      log.push(b.t, u.hp);
      while (log.length > 2 && log[0] < b.t - 4) log.splice(0, 2);
      HP_LOG.set(u, log);
    }
    tryRewind(b, u);
  },
  onHurt(b, u) { tryRewind(b, u); },
  onLethal(b, u) { return tryRewind(b, u) && u.hp > 0; },
});

// ───────────────────────── 초월학파: 결속 · 매혹
function revelation(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  const max = P(u, 'trans.collective') ? 5 : 3;
  const group = [t, ...b.around(t, 1, b.targetable(u)).filter((e) => e !== t).sort((a, c) => b.dist(a, t) - b.dist(c, t)).slice(0, max - 1)];
  const gid = (b.mem.bondGrp = (b.mem.bondGrp || 0) + 1);
  for (const e of group) b.applyStatus(u, e, { type: 'buff', key: 'bond', dur: 5, taken: [vuln('all', 0.1)], val: P(u, 'trans.fate') ? 0.5 : 0.25, grp: gid, label: LB('bond') });
  b.fx(t.x, t.y, 1, 'psy');
  // 매혹: 일반 적만 (승천: 정예도, 지속 +1초 · 정예는 절반)
  const asc = P(u, 'trans.ascend');
  if (t.alive && !t.isBoss && (!t.elite || asc)) {
    b.applyStatus(u, t, { type: 'buff', key: 'charm', dur: 1.5 + (asc ? 1 : 0), label: LB('charm'), mods: P(u, 'trans.dominate') ? [inc('all', 0.5)] : undefined });
  }
  return { to: t };
}

// ───────────────────────── 파장학파: 밀쳐내기 · 공진
function resonanceStatus(b: Battle, u: CUnit): Status {
  return {
    type: 'buff', key: 'resonance', dur: 5, val: tp(b, u) * (P(u, 'wave.freq') ? 0.25 : 0.15), label: LB('resonance'),
    onHit(bb, v, _src, _r, _o, s) {
      const c = s.src;
      if (!c || !icd(bb, v, 'resIcd', 0.5)) return;
      for (const e of bb.around(v, 1, bb.enemiesOf(c))) if (e !== v && e.alive) bb.dealDamage(c, e, s.val || 0, { elem: 'phys', tag: 'proc', kind: 'tech' });
    },
    // 정상파: 공진된 적이 기절(빙결 포함)하면 공진 지속 갱신
    onOther: P(u, 'wave.standing') ? (_bb, _v, s, added) => { if (added.type === 'stun') s.dur = Math.max(s.dur, 5); } : undefined,
  };
}
function shockwave(b: Battle, u: CUnit) {
  const t = cantripTarget(b, u);
  if (!t) return false;
  const victims = P(u, 'wave.amp') ? [t, ...b.around(t, 1, b.enemiesOf(u)).filter((e) => e !== t)] : [t];
  skillHit(b, u, t, 'tech', 0.7, 'phys', { noMiss: true });
  b.fx(t.x, t.y, victims.length > 1 ? 1 : 0, 'phys');
  for (const v of victims) {
    if (!v.alive) continue;
    const r = b.knockback(u, v);
    // 충돌: 밀려난 적이 다른 기물과 부딪히면 둘 다 1초 기절 (부딪힌 쪽이 아군이면 아군은 제외)
    if (!r.moved && r.blocker && P(u, 'wave.impact')) {
      b.stun(u, v, 1);
      if (b.sideOf(r.blocker) !== b.sideOf(u)) b.stun(u, r.blocker, 1);
    }
    if (v.alive) b.applyStatus(u, v, resonanceStatus(b, u));
  }
  if (t.alive && P(u, 'wave.seismic') && b.rng.chance(0.25)) b.stun(u, t, 0.8);
  return { to: t };
}

// ───────────────────────── 보화학파: 임시 장비 (전투 한정)
/** 무작위 재료 장비 1개를 이번 전투 동안 장착 (최대 3개). CUnit.tempItems 에 표시, 개수는 mem.goldItems */
export function giveTempItem(b: Battle, u: CUnit) {
  if ((u.mem.goldItems || 0) >= 3) return false;
  const id = b.rng.pick(ALL_COMPONENTS);
  applyLive(u, itemEffect(id), b, noCtx(b));
  u.tempItems = [...(u.tempItems || []), id];
  u.mem.goldItems = (u.mem.goldItems || 0) + 1;
  b.emit({ k: 'gift', from: u.id, to: u.id, item: id });
  return true;
}
function market(b: Battle, u: CUnit) {
  if (!b.enemiesOf(u).length) return false;
  const t = cantripTarget(b, u);
  const p = 0.3 + 0.5 * Math.abs(reasonOf(u)) / 100 + (P(u, 'gold.insider') ? 0.2 : 0);
  // 성공하면 임시 장비 (이미 3개면 실패와 같이 보호막), 실패하면 체력이 가장 낮은 아군에게 보호막
  if (!(b.rng.chance(p) && giveTempItem(b, u))) {
    const a = b.lowestHpAlly(u);
    if (a) { b.shield(a, tp(b, u) * 0.8); b.fx(a.x, a.y, 0, 'holy', 'heal'); }
  }
  if (t && t.alive && P(u, 'gold.short') && reasonOf(u) < 0) skillHit(b, u, t, 'tech', 1.5 + 0.2 * (u.mem.goldItems || 0), 'phys', { noMiss: true });
  return { to: t || undefined };
}
const credit10 = (b: Battle) => Math.floor(Math.max(0, b.ctx.credits) / 10);

// ───────────────────────── 소마법
const CAST: Record<SchoolId, Cantrip['cast']> = { pyro: ember, volt: discharge, seed: spore, chrono: entropy, trans: revelation, wave: shockwave, gold: market };
function makeCantrip(id: SchoolId): Cantrip {
  const c = SCHOOL_BY_ID[id].cantrip;
  return {
    name: c.name,
    cast: CAST[id],
    cd(_b, u) {
      let cd = c.cd;
      if (id === 'pyro' && P(u, 'pyro.overheat') && reasonOf(u) < 0) cd *= 0.6; // 과열
      if (id === 'gold' && P(u, 'gold.vol')) cd -= 2; // 변동성
      return Math.max(0.5, cd);
    },
    cost(_b, u) { return c.cost * (id === 'pyro' && P(u, 'pyro.overheat') && reasonOf(u) < 0 ? 1.5 : 1); },
  };
}
export const CANTRIPS = Object.fromEntries(SCHOOLS.map((s) => [s.id, makeCantrip(s.id)])) as Record<SchoolId, Cantrip>;

// ───────────────────────── 학파별 고 · 저이성 효과 (선형)
interface SchoolFx { dyn?: (u: CUnit, h: number, l: number) => void; hooks: Hooks }
/** 주고받는 피해 배율 (자신에게 주는 피해는 주는 쪽 배율 없음) */
const dealt = (elem: string, k: number) => (_b: Battle, u: CUnit, t: CUnit, o: { elem: string }) => (o.elem === elem && t !== u ? 1 + k * reasonHL(u)[1] : 1);
const SCHOOL_FX: Record<SchoolId, SchoolFx> = {
  pyro: {
    dyn: (u, h) => dyn(u, 'effHit', 0.3 * h),
    hooks: { dmgMult: dealt('phys', 0.4), takenMult: (_b, u, _s, o) => (o.elem === 'phys' ? 1 + 0.4 * reasonHL(u)[1] : 1) },
  },
  volt: {
    hooks: {
      dmgMult: dealt('elec', 0.4),
      takenMult: (_b, u, _s, o) => { if (o.elem !== 'elec') return 1; const [h, l] = reasonHL(u); return (1 - 0.4 * h) * (1 + 0.4 * l); },
    },
  },
  seed: {
    dyn: (u, h) => dyn(u, 'healEff', 0.3 * h),
    hooks: { dmgMult: dealt('chem', 0.4), takenMult: (_b, u, _s, o) => (o.elem === 'chem' ? 1 + 0.4 * reasonHL(u)[1] : 1) },
  },
  chrono: {
    dyn: (u, h, l) => { dyn(u, 'cdr', 0.4 * h); dyn(u, 'atkSpd', 0.4 * l); dyn(u, 'eva', -0.2 * l); },
    hooks: {},
  },
  trans: {
    hooks: {
      dmgMult: dealt('psy', 0.4),
      takenMult: (_b, u, _s, o) => { if (o.elem !== 'psy') return 1; const [h, l] = reasonHL(u); return (1 - 0.4 * h) * (1 + 0.4 * l); },
    },
  },
  wave: {
    dyn: (u, _h, l) => { dyn(u, 'effHit', 0.3 * l); dyn(u, 'effRes', -0.3 * l); },
    hooks: { takenMult: (_b, u, _s, o) => (o.elem === 'true' ? 1 - 0.4 * reasonHL(u)[0] : 1) },
  },
  gold: {
    // 안정 투자: 크레딧 10당 피해량 경감 +1% (최대 15%) × 고이성 · 투기: 크레딧 10당 피해 +1.5% (최대 25%) × 저이성
    hooks: {
      dmgMult: (b, u, t) => (t === u ? 1 : 1 + Math.min(0.25, 0.015 * credit10(b)) * reasonHL(u)[1]),
      takenMult: (b, u) => 1 - Math.min(0.15, 0.01 * credit10(b)) * reasonHL(u)[0],
    },
  },
};
function schoolEffect(id: SchoolId): Effect {
  const fx = SCHOOL_FX[id];
  const sync = (u: CUnit) => { if (fx.dyn && u.reason !== null) { const [h, l] = reasonHL(u); fx.dyn(u, h, l); } };
  return {
    setup(u) {
      if (u.ttype !== 'psionic' || u.side !== 0 || u.isSummon) return;
      u.school = id;
      u.cantrip = CANTRIPS[id];
      u.cantripMax = SCHOOL_BY_ID[id].cantrip.cd;
      u.cantripCd = u.cantripMax * 0.5;
    },
    hooks: {
      ...fx.hooks,
      onStart(b, u) {
        if (u.cantrip) { u.cantripMax = u.cantrip.cd(b, u); u.cantripCd = u.cantripMax * 0.5; } // 전공 반영 (변동성)
        sync(u);
      },
      onTick(_b, u) { sync(u); },
    },
  };
}

// ───────────────────────── 전공 (지속 능력): 플래그 + 필요한 훅
const PASSIVE_FX: Record<string, Effect> = {
  // 산불: 연소된 적이 쓰러지면 그 중첩을 주변 1칸 적에게
  'pyro.wildfire': { hooks: { onAnyDeath(b, u, dead) {
    if (!u.alive || dead.side === u.side) return;
    const s = dead.statuses.find((x) => x.key === 'burn' && x.src === u);
    if (s) for (const e of b.around(dead, 1, b.enemiesOf(u))) addBurn(b, u, e, s.stacks || 1);
  } } },
  // 열 순환: 연소 피해의 15% 보호막
  'pyro.cycle': { hooks: { onDeal(b, u, _t, r, o) { if (o.key === 'burn' && r.amount > 0 && u.alive) b.shield(u, r.amount * 0.15); } } },
  // 단락: 감전된 적에게 주는 피해 +25%
  'volt.short': { hooks: { dmgMult: (_b, _u, t) => (hasKey(t, 'shock') ? 1.25 : 1) } },
  // 패러데이 새장: 전투 시작 6초간 자신과 주변 1칸 아군
  'volt.cage': { hooks: { onStart(b, u) {
    for (const a of b.around(u, 1, b.alliesOf(u))) b.applyStatus(u, a, { type: 'buff', key: 'psi.cage', dur: 6, taken: [red('elec', 0.25)], delta: { effRes: 0.2 }, label: '패러데이 새장' });
  } } },
  // 오버클럭: 소마법 뒤 3초간 공격 속도 +30%
  'volt.oc': { hooks: { onCantrip(b, u) { b.buff(u, u, 'psi.oc', 3, { delta: { atkSpd: 0.3 }, label: '오버클럭' }); } } },
  // 광합성: 이성 50 이상이면 초당 최대 체력 1% 회복
  'seed.photo': { hooks: { onTick(b, u, dt) {
    if (reasonOf(u) < 50) { u.mem.photoT = 0; return; }
    u.mem.photoT = (u.mem.photoT || 0) + dt;
    if (u.mem.photoT >= 1) { u.mem.photoT -= 1; b.heal(u, u, b.S(u, 'maxHp') * 0.01); }
  } } },
  // 포자 폭발: 중독된 적이 쓰러지면 주변 1칸 적에게 중독을 옮긴다
  'seed.burst': { hooks: { onAnyDeath(b, u, dead) {
    if (!u.alive || dead.side === u.side) return;
    const s = dead.statuses.find((x) => x.key === 'poison' && x.src === u);
    if (s) for (const e of b.around(dead, 1, b.enemiesOf(u))) b.applyStatus(u, e, poisonStatus(u, s.perDps ?? s.dps ?? 0, s.stacks ?? 1, Math.max(1, s.dur)));
  } } },
  'chrono.rewind': { hooks: rewindHooks() },
  // 초월자의 시선: 결속된 적에게 주는 정신 피해 +25%
  'trans.gaze': { hooks: { dmgMult: (_b, _u, t, o) => (o.elem === 'psy' && hasKey(t, 'bond') ? 1.25 : 1) } },
  // 자아 분리: 이성 0 미만일 때 받는 피해의 30%를 결속된 적에게
  'trans.split': { hooks: { redirect(b, u, _src, dmg, o) {
    if (reasonOf(u) >= 0) return dmg;
    const bonded = b.enemiesOf(u).filter((e) => hasKey(e, 'bond'));
    const e = bonded.length ? b.nearest(u, bonded) : null;
    if (!e) return dmg;
    b.rawHit(u, e, dmg * 0.3, o.elem);
    return dmg * 0.7;
  } } },
  // 역장: 이성 50 이상이면 피해량 경감 15%
  'wave.field': { hooks: { takenMult: (_b, u) => (reasonOf(u) >= 50 ? 0.85 : 1) } },
  // 선물 거래: 전투 시작 시 임시 장비 1개
  'gold.futures': { hooks: { onStart(b, u) { if (u.school === 'gold') giveTempItem(b, u); } } },
  // 상승장: 이성 0 이상이면 임시 장비 1개당 피해 +6%
  'gold.bull': { hooks: { dmgMult: (_b, u, t) => (t !== u && reasonOf(u) >= 0 ? 1 + 0.06 * (u.mem.goldItems || 0) : 1) } },
  // 변동성: 이성 증감량 ×1.5 (쿨다운 -2초는 소마법 쪽)
  'gold.vol': { setup: (u) => { u.mem.reasonAmp = (u.mem.reasonAmp || 0) + 0.5; } },
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
  return `${s.study}. 소마법 「${s.cantrip.name}」 (쿨다운 ${s.cantrip.cd}초 · 이성 -${s.cantrip.cost}): ${s.cantrip.desc} 고이성: ${s.high}. 저이성: ${s.low}.`;
};
/** 학파 증강 7종 (합류 시 선택, 1개만) */
export const SCHOOL_AUGS: AugDef[] = SCHOOLS.map((s) => ({
  id: schoolAugId(s.id), name: s.name, desc: schoolDesc(s.id), pool: 'school', owner: s.id,
  effect: () => schoolEffect(s.id),
}));
/** 전공 증강 42종 (학파당 6종, 5 · 10 · 15 · 20등급에 그 학파 것만, 최대 4개) */
export const PSI_AUGS: AugDef[] = SCHOOLS.flatMap((s) => SCHOOL_PASSIVES[s.id].map(([key, name, desc]): AugDef => ({
  id: psiAugId(s.id, key), name, desc, pool: 'psionic', owner: s.id,
  effect: () => passiveEffect(s.id, key),
})));
/** 학파의 전공 증강 */
export const schoolPassives = (s: SchoolId | null) => (s ? PSI_AUGS.filter((a) => a.owner === s) : []);
