// 철수 봇 2단계: 증강 판단 (aug 영역) — 특권 · 전역 · 절망 · 기물 증강(메이저 · 스페셜 · 학파 · 전공) · 전리품 선택 · 새로고침.
//   특권 · 전역 증강: '크레딧 환산' 모형 — 팀 가치 V 상승은 공명도 구매 환율(econ.ts xpRate)로, 체력은 체력 가치로, 전투당 수입은 앞으로의 전투 수로 크레딧에 맞춘다.
//     (조정 시드에서 강제로 골라 잰 특권표는 잡음이 커서(±0.3 페이즈) 검증용으로만 쓴다: docs/BOT_CHULSU.md 2단계)
//   절망 증강: 조정 시드에서 그것을 강제로 골랐을 때의 도달 페이즈 손실 실측표(tables.ts) + 지금 상태 보정.
//   기물 증강: 평가 함수 V(능력치로 잡히는 몫) + 증강 실측(augprofile.gen.ts: 능력치로 안 잡히는 훅 몫).
//   새로고침: 지금 선택지의 최고값이 '새로 뽑았을 때의 기대 최고값'(공개된 뽑기 규칙 · 가치 모형으로 봇 자체 난수 표본, 런 난수는 읽지 않는다)보다 낮으면 새로고침.
import { CFG } from '../../src/config';
import { DESPAIRS } from '../../src/data/despair';
import { EMBLEM_SYNS, GLOBALS, PRIVILEGES } from '../../src/data/globals';
import { emblemId } from '../../src/data/items';
import { schoolPassives } from '../../src/data/psionic';
import { UNIT_BY_ID } from '../../src/data/units';
import { SYNERGIES, tierOf } from '../../src/data/synergies';
import { deployed, memberships } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import { Rng } from '../../src/rng';
import type { AugPick, Pending, RunState, SynergyId, UnitState } from '../../src/types';
import { AUGPROF } from './augprofile.gen';
import { cloneUnit, milestone, rankedUp, teamEval, unitIn } from './eval';
import type { DLog } from './log';
import { DESP_HARM } from './tables';
import { ECON, xpRate } from './econ';

export const AUG = {
  horizon: 24, // 전투당 수입형 증강: 앞으로 셀 전투 수 상한
  discount: 0.6, // 그 전투 수에 곱하는 할인 (나중 수입일수록 덜 쓸모)
  xpSpendPerBattle: 12, // 학습 곡선: 전투당 공명도 구매에 쓰는 크레딧 어림 (econ 영역 조정 시드: 쉬움 15.8 · 고난 11.2)
  recruitsPerBattle: 0.25, // 인재 스카우트 · 인맥: 전투당 영입 기회 어림 (페이즈 시작 · 모집 분기 · 사건)
  lossPerBattle: { d3: 0.5, d7: 4 } as Record<string, number>, // 생존 본능: 전투당 패배 체력 손실 어림 (econ 영역 조정 시드: 쉬움 0.38 · 고난 3.75)
  recruitDelay: 0.7, // 추가 계약: 함대 확장 전까지 출전하지 못하는 몫
  hookW: 1, // 실측 훅 몫의 무게
  schoolFuture: 0.5, // 학파 선택: 그 학파 전공 증강 상위 4개 평균 × 이 값을 더한다
  mc: 400, // 새로고침 기대값 몬테카를로 표본 (봇 자체 난수)
};

const team = (run: RunState) => deployed(run).filter((u) => !R.isRock(u));

/** 문장 시너지 하나: 그 문장을 개조부품 칸이 빈 비소속 출전 기물에 달았을 때 팀 가치 상대 상승 (가장 좋은 기물) */
export function emblemGain(run: RunState, s: string): number {
  const us = team(run);
  if (!us.length) return 0;
  const base = teamEval(run, us).v;
  let best = 0;
  for (const u of us) {
    if (u.mod || memberships(u, run).includes(s as SynergyId)) continue;
    const x = cloneUnit(u); x.mod = emblemId(s as SynergyId);
    const v = teamEval(run, us.map((y) => (y === u ? x : y))).v;
    best = Math.max(best, v / Math.max(1e-9, base) - 1);
  }
  return best;
}
/** 특권 문장 · 문장 매입 등: 가장 좋은 문장 시너지 */
export function emblemParam(run: RunState): string {
  return EMBLEM_SYNS.map((s) => ({ s, g: emblemGain(run, s) })).sort((a, b) => b.g - a.g)[0].s;
}

/** 새로고침 판단: rerolls 번 남았을 때 지금 최고값 cur 를 지킬지. sample() = 새로 뽑은 선택지의 최고값 (봇 자체 난수) */
function rerollWorth(cur: number, rerolls: number, sample: () => number): boolean {
  if (rerolls <= 0) return false;
  // EV_0 = E[새 뽑기 최고값] (마지막 새로고침이면 그 결과를 받는다), EV_k = E[max(새 뽑기, EV_{k-1})]
  const xs = Array.from({ length: AUG.mc }, sample);
  let ev = xs.reduce((s, x) => s + x, 0) / xs.length;
  for (let k = 1; k < rerolls; k++) { const e = ev; ev = xs.reduce((s, x) => s + Math.max(x, e), 0) / xs.length; }
  return ev > cur;
}

// ───────────────────────── 크레딧 환산 (econ.ts 와 같은 환율): 팀 가치 상대 상승 g → g ÷ (공명도 구매 1 크레딧의 상승), 체력 → econ 체력 가치, 전투당 수입 → 앞으로의 전투 수(상한)
const credV = (run: RunState, g: number) => g / xpRate(run);
const hpVal = (run: RunState) => ECON.hpVal[(run.diff || 0) >= 6 ? 'd7' : 'd3'] * (1 + 20 / Math.max(10, run.hp));
/** 앞으로 남은 전투 수 어림 (페이즈당 약 9번) × 할인, 상한 AUG.horizon */
const horizon = (run: RunState) => Math.min(AUG.horizon, (CFG.victoryPhase - run.phase) * 9 + Math.max(0, 12 - run.step) * 0.75) * AUG.discount;
const vOf = (run: RunState, us: UnitState[]) => (us.length ? teamEval(run, us).v : 0);
/** 기물 묶음 변경의 팀 가치 상대 상승 */
function relGain(run: RunState, f: (u: UnitState) => UnitState): number {
  const us = team(run);
  const v0 = vOf(run, us);
  return v0 > 0 ? vOf(run, us.map(f)) / v0 - 1 : 0;
}
/** 영입 후보 표본 (봇 난수, 공개된 영입 풀): 출전 기물로 더했을 때 상승의 '3개 중 최고' 기대값 */
function recruitCred(run: RunState, rng: Rng): number {
  const us = team(run), v0 = vOf(run, us);
  if (!v0) return 0;
  const pool = Object.values(UNIT_BY_ID).filter((d) => !d.noStarter && !d.eventOnly && !d.inert && !d.king && !run.units.some((u) => u.defId === d.id)).map((d) => d.id);
  const rank = R.recruitRank(run);
  const g = rng.sample(pool, Math.min(9, pool.length)).map((id) => {
    const d = UNIT_BY_ID[id];
    const u: UnitState = { uid: 'cand', defId: id, rank, xp: 0, alloc: { vit: rank - 1, pow: rank - 1, mnd: rank - 1, def: rank - 1, agi: rank - 1 }, perm: { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 }, augments: [], items: [d.item || null, null, null], mod: null, pos: null, faith: d.faith, grow: {} };
    return vOf(run, [...us, u]) / v0 - 1;
  }).sort((x, y) => y - x);
  const best3 = (g[0] + g[1] + g[2]) / 3; // 9개 중 상위 3개 평균 ≈ 3개 중 최고의 기대값
  return Math.max(0, credV(run, best3) * AUG.recruitDelay - (R.fleetCost(run) ?? 0));
}
/** 전역 증강 1개의 크레딧 환산 가치 (지금 상태) */
export function globCred(run: RunState, id: string): number {
  const H = horizon(run);
  const us = team(run);
  const withG = () => { run.globals.push(id); const v = vOf(run, us); run.globals.pop(); return v; };
  const t = us.length ? teamEval(run, us) : null;
  const act = t ? SYNERGIES.filter((x) => x.tiers.length > 1 && tierOf(x.id, t.counts[x.id] || 0) > 0) : [];
  switch (id) {
    case 'G.funds': return 25;
    case 'G.armory': return 2 * CFG.price.C;
    case 'G.interest': return 3 * H; // 상한 +5: 남길 크레딧이 늘어 실제로는 전투당 약 +3
    case 'G.resonance': return 0.35 * CFG.xpPool(run.phase) * H * CFG.buyXpCost / CFG.buyXpAmount;
    case 'G.study': return AUG.xpSpendPerBattle * (1 - (CFG.buyXpCost - 1) / (CFG.buyXpAmount + 1) / (CFG.buyXpCost / CFG.buyXpAmount)) * H; // 같은 크레딧으로 공명도 +67%
    case 'G.scout': return AUG.recruitsPerBattle * H * CFG.xpToNext(R.recruitRank(run)) + 4;
    case 'G.network': return AUG.recruitsPerBattle * H * 6;
    case 'G.squad': return (R.fleetCost(run) ?? 60) * 1.3;
    case 'G.survival': return (30 + 0.3 * AUG.lossPerBattle[(run.diff || 0) >= 6 ? 'd7' : 'd3'] * H) * hpVal(run);
    case 'G.emblem': { const own = [...new Set(us.flatMap((u) => memberships(u, run)))].filter((x) => EMBLEM_SYNS.includes(x)); const gs = own.map((x) => emblemGain(run, x)); return gs.length ? credV(run, gs.reduce((a, b) => a + b, 0) / gs.length) : 0; }
    case 'G.bond': return credV(run, 0.03 * act.length);
    case 'G.apex': { const n = act.filter((x) => tierOf(x.id, t!.counts[x.id] || 0) === x.tiers.length).length; return credV(run, n ? (1 + 0.1 * n) / (1 - 0.05 * n) - 1 : 0); }
    case 'G.diverse': return credV(run, act.filter((x) => x.kind === 'faction').length >= 3 ? 1.1 / (1 - 0.12) - 1 : 0.02);
  }
  // 능력치로 잡히는 팀 효과 (정밀 조준 · 강화 장갑 · 쿨러 · 올인 · 연합 협정 · 전술 교범): V
  const v0 = vOf(run, us);
  return v0 > 0 ? credV(run, withG() / v0 - 1) : 0;
}

// ───────────────────────── 특권 (런 시작): 크레딧 환산 모형
function privCred(run: RunState, p: AugPick, rng: Rng): number {
  switch (p.id) {
    case 'P.funds': return 40;
    case 'P.hp': return 40 * hpVal(run);
    case 'P.rank': return credV(run, relGain(run, (u) => { const a = rankedUp(u); return rankedUp(a); })) + run.units.filter((u) => milestone(u) || milestone(u, u.rank + 2)).length * 4;
    case 'P.emblem': return credV(run, emblemGain(run, p.param || ''));
    case 'P.recruit': return recruitCred(run, rng);
    case 'P.global': { const pool = GLOBALS.map((g) => g.id); const vs = pool.map((id) => globCred(run, id)); let s = 0; for (let k = 0; k < 60; k++) s += Math.max(...rng.sample(vs, 3)); return s / 60; }
  }
  return 0;
}
export function privilege(run: RunState, p: Extract<Pending, { t: 'privilege' }>, log: DLog, rng: Rng) {
  // 새 뽑기 표본용: 종류별 값 (문장은 시작 기물 시너지 70% · 전체 30% 표본 평균)
  const own = [...new Set(run.units.flatMap((u) => memberships(u)))].filter((s) => EMBLEM_SYNS.includes(s));
  const embAvg = (xs: string[]) => (xs.length ? xs.reduce((a, s) => a + credV(run, emblemGain(run, s)), 0) / xs.length : 0);
  const kindV: Record<string, number> = {};
  for (const d of PRIVILEGES) kindV[d.id] = d.id === 'P.emblem' ? 0.7 * embAvg(own) + 0.3 * embAvg(EMBLEM_SYNS) : privCred(run, { id: d.id }, rng);
  const val = (o: AugPick) => (o.id === 'P.emblem' ? privCred(run, o, rng) : kindV[o.id]);
  for (let g = 0; g < 10; g++) {
    const sc = p.options.map((o, i) => ({ i, o, v: val(o) })).sort((a, b) => b.v - a.v);
    const cur = sc[0].v;
    const sample = () => {
      const left = PRIVILEGES.slice(), got: number[] = [];
      for (let k = 0; k < 3 && left.length; k++) {
        const d = rng.weighted(left, (x) => x.w);
        got.push(kindV[d.id]);
        if (d.id !== 'P.emblem') left.splice(left.indexOf(d), 1);
      }
      return Math.max(...got);
    };
    if (!rerollWorth(cur, p.rerolls, sample)) {
      log.add('priv', `특권 ${sc[0].o.id}${sc[0].o.param ? ':' + sc[0].o.param : ''}`, 0, cur, sc.slice(1).map((x) => `${x.o.id}${x.o.param ? ':' + x.o.param : ''} ${x.v.toFixed(1)}`), `새로고침 ${p.rerolls} 남음 · 종류별 ${Object.entries(kindV).map(([k, v]) => `${k.slice(2)} ${v.toFixed(0)}`).join(' ')}`);
      R.pickPrivilege(run, sc[0].i);
      return;
    }
    log.add('priv', '새로고침', 0, cur, sc.map((x) => `${x.o.id} ${x.v.toFixed(1)}`));
    R.rerollPrivilege(run);
  }
  R.pickPrivilege(run, 0);
}

// ───────────────────────── 절망 증강 (고난): 지금 계획에 가장 덜 해로운 것
/** 해로움 = 실측표 + 상태 보정 (보정은 '해로움 배율 f' 를 0.2 × (f − 1) 페이즈로 더한다: 표값이 음수여도 방향이 맞게) */
/** 3단계 boss: 보스가 벽인지 (보스전 패배 확률 어림 = 위험별 사전값을 지금까지 본 보스전 결과로 갱신). 결승전 특집(보스 체력 · 피해 +30%)의 구조적 해로움에 곱한다 */
export const BOSS = {
  prior: { d6: 0.5, d7: 0.65 } as Record<string, number>, // 보스전 패배율 사전값 (2단계 보류 결과: 모험 P1 61% · 고난 P1 70% 패배, 이후 50~65%)
  priorW: 3, // 사전값의 무게 (보스전 수 환산)
  finalHarm: 0.6, // 결승전 특집 구조적 해로움 (페이즈 단위) × 보스 패배율. 보스 체력 · 피해 ×1.3 = 보스전 전력 1/1.69, 6페이즈 보스는 클리어 조건
};
export function bossLossRate(run: RunState, hist?: { t: string; w: number }[]): number {
  const pr = BOSS.prior[(run.diff || 0) >= 7 ? 'd7' : 'd6'];
  const bs = (hist || []).filter((h) => h.t === 'boss');
  return (pr * BOSS.priorW + bs.filter((h) => !h.w).length) / (BOSS.priorW + bs.length);
}
function despHarm(run: RunState, id: string, bossRisk?: number): number {
  if (bossRisk !== undefined && id === 'D.final') return Math.max(DESP_HARM[id] ?? 0.1, BOSS.finalHarm * bossRisk * (run.phase >= CFG.victoryPhase ? 0.5 : 1));
  const h = DESP_HARM[id] ?? 0.1;
  const ph = run.phase, us = team(run);
  const t = us.length ? teamEval(run, us) : null;
  let f = 1;
  switch (id) {
    case 'D.miracle': { // 회복 감소: 팀 회복 비중에 비례 (비중 0.12 = 보통)
      const share = t ? (20 * t.heal) / Math.max(1, t.ehp + 20 * t.heal) : 0.12;
      f = Math.min(3, share / 0.12); break;
    }
    case 'D.rival': case 'D.rock': f = ph >= 3 ? 0.5 : 1; break; // 영입: 파티가 꾸려진 뒤에는 덜 해롭다
    case 'D.swarm': case 'D.myopic': f = ph >= 6 ? 0.3 : 1; break; // 공명도 · 이자: 마지막 페이즈에는 남은 전투가 적다
    case 'D.tariff': f = ph >= 6 ? 0.5 : 1; break;
    case 'D.final': f = ph >= 3 ? 1.5 : 1; break; // 보스: 6페이즈 보스 = 클리어 조건
  }
  return h + 0.2 * (f - 1);
}
export function despair(run: RunState, p: Extract<Pending, { t: 'despair' }>, log: DLog, rng: Rng, bossRisk?: number) {
  for (let g = 0; g < 4; g++) {
    const sc = p.options.map((id, i) => ({ i, id, h: despHarm(run, id, bossRisk) })).sort((a, b) => a.h - b.h);
    const pool = DESPAIRS.filter((d) => !(run.despairs || []).includes(d.id)).map((d) => d.id);
    const sample = () => -Math.min(...rng.sample(pool, Math.min(CFG.despair.choices, pool.length)).map((id) => despHarm(run, id, bossRisk)));
    if (!rerollWorth(-sc[0].h, p.rerolls, sample)) {
      log.add('despair', `절망 ${sc[0].id}`, 0, -sc[0].h * 1000, sc.slice(1).map((x) => `${x.id} ${(-x.h * 1000).toFixed(0)}`), bossRisk !== undefined ? `보스 패배율 어림 ${bossRisk.toFixed(2)}` : undefined);
      R.pickDespair(run, sc[0].i);
      return;
    }
    log.add('despair', '새로고침', 0, -sc[0].h * 1000, sc.map((x) => `${x.id} ${(-x.h * 1000).toFixed(0)}`));
    R.rerollDespair(run);
  }
  R.pickDespair(run, 0);
}

// ───────────────────────── 전역 증강 (크레딧 환산 모형, globCred)
export function global(run: RunState, p: Extract<Pending, { t: 'global' }>, log: DLog, rng: Rng) {
  for (let g = 0; g < 3; g++) {
    const sc = p.options.map((id) => ({ id, v: globCred(run, id) })).sort((a, b) => b.v - a.v);
    const pool = GLOBALS.filter((x) => !(x.unique && run.globals.includes(x.id))).map((x) => x.id);
    const pv = pool.map((id) => globCred(run, id));
    const sample = () => Math.max(...rng.sample(pv, 3));
    if (!rerollWorth(sc[0].v, p.rerolls || 0, sample)) {
      log.add('global', `전역 ${sc[0].id}`, 0, sc[0].v, sc.slice(1).map((x) => `${x.id} ${x.v.toFixed(1)}`));
      R.pickGlobal(run, sc[0].id);
      return;
    }
    log.add('global', '새로고침', 0, sc[0].v, sc.map((x) => `${x.id} ${x.v.toFixed(1)}`));
    R.rerollGlobal(run);
  }
  R.pickGlobal(run, p.options[0]);
}

// ───────────────────────── 기물 증강
/** 증강 a 를 기물 u 에 더했을 때의 팀 가치 상대 상승: V(능력치 몫) + 실측 훅 몫 (V 가 이미 잡은 피해 · 회복 상승은 뺀다) */
export function augScore(run: RunState, u: UnitState, a: AugPick): number {
  const us0 = team(run);
  const us = us0.includes(u) ? us0 : [...us0, u];
  const t = teamEval(run, us);
  const x = cloneUnit(u); x.augments = [...u.augments, a];
  const t1 = teamEval(run, us.map((y) => (y === u ? x : y)));
  const vGain = t1.v / Math.max(1e-9, t.v) - 1;
  const e0 = t.per.get(u.uid)!, e1 = unitIn(t, run, x);
  const prof = AUGPROF[u.defId]?.[a.param && a.id === 'maj.stat' ? `${a.id}:${a.param}` : a.id];
  if (!prof) return vGain;
  const offShare = e0.off / Math.max(1e-9, t.off), healShare = (20 * e0.heal) / Math.max(1e-9, t.ehp + 20 * t.heal);
  const vOff = e1.off / Math.max(1e-9, e0.off) - 1, vHeal = e0.heal > 0 ? e1.heal / e0.heal - 1 : 0;
  const hook = offShare * Math.max(0, prof.d - vOff) + healShare * Math.max(0, prof.h - vHeal);
  return vGain + AUG.hookW * hook;
}
/** 사이오닉 학파: 학파 증강 자체 + 그 학파 전공 증강 상위 4개 평균 (앞으로 받을 몫) */
function schoolScore(run: RunState, u: UnitState, a: AugPick): number {
  const s = a.id.slice(7);
  const x = cloneUnit(u); x.augments = [...u.augments, a];
  const fut = schoolPassives(s as never).map((p) => augScore(run, x, { id: p.id })).sort((p, q) => q - p).slice(0, 4);
  return augScore(run, u, a) + AUG.schoolFuture * (fut.length ? fut.reduce((p, q) => p + q, 0) / fut.length : 0);
}
/** 새 뽑기 표본 풀 (공개 규칙 = 게임의 R.augPoolOf: 메이저 = 기물 전용 증강, 디바인 = 서약 증강, 사이오닉 = 학파 전공 증강, 보유 증강은 중첩 가능한 것만) */
function augPool(u: UnitState, kind: string): AugPick[] {
  const owned = new Set(u.augments.map((a) => a.id));
  const base = kind === 'school' ? [] : R.augPoolOf(u, kind as R.AugKind);
  return base.filter((a) => a.stack || !owned.has(a.id)).flatMap((a) => (a.roll ? (['vit', 'pow', 'mnd', 'def', 'agi'] as const).map((m) => ({ id: a.id, param: m })) : [{ id: a.id }]));
}
export function aug(run: RunState, p: Extract<Pending, { t: 'rankup' }>, log: DLog, rng: Rng): AugPick | null {
  const u = run.units.find((x) => x.uid === p.uid);
  for (let g = 0; g < 3; g++) {
    R.ensureRankupOptions(run, p);
    const o = p.options || [];
    if (!o.length || !u) return null;
    const score = (a: AugPick) => (p.kind === 'school' ? schoolScore(run, u, a) : augScore(run, u, a));
    const sc = o.map((a) => ({ a, v: score(a) })).sort((x, y) => y.v - x.v);
    const pool = p.kind === 'school' ? [] : augPool(u, p.kind || 'major');
    const pv = pool.map((a) => score(a));
    const sample = () => Math.max(...rng.sample(pv, Math.min(3, pv.length)));
    if (!pool.length || !rerollWorth(sc[0].v, p.rerolls, sample)) {
      log.add('aug', `${u.defId} ${sc[0].a.id}${sc[0].a.param ? ':' + sc[0].a.param : ''}`, 0, sc[0].v * 1000, sc.slice(1).map((x) => `${x.a.id} ${(x.v * 1000).toFixed(0)}`));
      return sc[0].a;
    }
    log.add('aug', `${u.defId} 새로고침`, 0, sc[0].v * 1000, sc.map((x) => `${x.a.id} ${(x.v * 1000).toFixed(0)}`));
    p.rerolls--; p.options = null; // 화면의 새로고침과 같은 동작 (main.ts: rerolls -1, 선택지를 비우고 다시 뽑는다)
  }
  return (p.options || [])[0] || null;
}

// ───────────────────────── 전리품 (itemPick): 받은 뒤의 장비 계획까지 복제본에서 굴려 팀 가치가 가장 큰 것
export function itemPick(run: RunState, options: string[], plan: (r: RunState) => void, log: DLog): string {
  const sc = options.map((id) => {
    const r = structuredClone(run);
    r.pending = [];
    R.gainItem(r, id, undefined, true);
    try { plan(r); } catch { /* 평가 실패 = 그대로 */ }
    return { id, v: team(r).length ? teamEval(r, team(r)).v : 0 };
  }).sort((a, b) => b.v - a.v);
  log.add('loot', `전리품 ${sc[0].id}`, 0, sc[0].v, sc.slice(1).map((x) => `${x.id} ${Math.round(x.v)}`));
  return sc[0].id;
}

/** 반려 돌 영입을 피한다 (절망 증강 '단장의 반려 돌'을 고른 계획의 일부). 반려 돌뿐이면 null (= 덤비 규칙) */
export function noRock(options: string[], score: (id: string) => number): string | null {
  const ok = options.filter((id) => !UNIT_BY_ID[id].inert);
  if (!ok.length || ok.length === options.length) return null;
  return ok.slice().sort((x, y) => score(y) - score(x))[0];
}
