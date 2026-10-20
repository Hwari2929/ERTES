// 철수 봇 2단계: 경제 판단 (econ 영역) — 저축(이자) · 공명도 · 함대 확장 · 상점 · 분기 · 사건 · 합성 · 정비.
//   한 예산으로 비교한다: '크레딧 1 당 팀 가치 V 상대 상승'(함대 확장 · 공명도 · 상점 물건)과 '남길 크레딧'(이자 구간 · 체력 · 다음 조우 · 패배 비용).
//   상점 물건 · 사건 선택지는 복제한 런에서 사 보고 / 골라 보고 (사건은 런 난수 대신 다른 난수로 여러 번), 장비 계획까지 굴린 뒤 비교한다.
//   쓰는 정보: 지금 런 상태 · 보이는 진열대 · 공개 규칙(CFG · 이자 · 보급 기준값). 숨은 보상 · 런 난수는 읽지 않는다.
import { CFG } from '../../src/config';
import { isTurretGear, isTurretMod, TURRET_ADV } from '../../src/data/items';
import { deployed, engTier, turretCount } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import { Rng } from '../../src/rng';
import type { NodeType, Pending, RunState, UnitState } from '../../src/types';
import { milestone, rankedUp, teamEval, teamWith, unitIn } from './eval';
import type { DLog } from './log';

export const ECON = {
  reserveFrac: 1, // 안전할 때 남길 크레딧 = 최대 이자 구간(상한 × 10) × 이 값
  dangerK: 2.5, // 체력 ≤ 패배 비용 × dangerK: 남기지 않는다 (전부 전력으로)
  cautionK: 5, // 체력 ≤ 패배 비용 × cautionK: 절반만 남긴다
  bigFight: 0.5, // 편성 화면의 조우가 역경 · 보스 · 도전이면 남길 크레딧 × 이 값
  bossFight: 0.5, // 3단계 boss: 편성 화면의 조우가 보스면 남길 크레딧 × 이 값. 0 (보스 전에 전부 투자)은 조정 시드에서 고난 P1 보스 39 → 48% 였지만 모험 클리어 −12.0 ± 10.5%p (이자 손실) 라 2단계와 같은 0.5 로 둔다 (docs/BOT_CHULSU.md 3단계 4절)
  shopVsXp: 1, // 상점 물건은 '크레딧당 상승'이 공명도 구매의 이 배 이상이어야 산다
  dipK: 1.5, // 크레딧당 상승이 공명도 구매의 이 배 이상인 행동(함대 확장 · 좋은 물건)은 남길 크레딧 아래로 써도 된다 (이자 손실 ≈ 크레딧당 0.5)
  eventSamples: 3, // 사건 선택지마다 복제 상태에서 굴리는 횟수 (다른 난수)
  hpVal: { d3: 0.5, d7: 1 } as Record<string, number>, // 체력 1 의 크레딧 가치 (최대 체력 근처 기준, 체력이 낮을수록 커진다)
};

const team = (run: RunState) => deployed(run).filter((u) => !R.isRock(u));
const V = (run: RunState) => { const us = team(run); return us.length ? teamEval(run, us).v : 0; };

/** 다음 패배 비용 (체력): 편성 화면이면 그 조우, 아니면 일반 전투 기준 */
export function lossCost(run: RunState): number {
  const p = run.phase, t = run.node?.type;
  const enemies = run.node?.enc?.enemies.length || 4;
  const sv = Math.ceil(enemies / 2);
  const base = t === 'boss' ? CFG.bossLossDamage(p) : CFG.lossDamage(p, sv) * (t === 'adversity' || t === 'challenge' ? CFG.adversityLoss : 1);
  return base * (R.hasGlobal(run, 'G.survival') ? 0.7 : 1);
}
const bigNode = (t: NodeType | undefined) => t === 'adversity' || t === 'boss' || t === 'challenge';
/** 남길 크레딧: 이자 구간 · 체력 · 다음 조우 · 마지막 페이즈 */
export function reserve(run: RunState, boss = false): number {
  if (run.phase >= CFG.victoryPhase) return 0; // 마지막 페이즈: 이자보다 지금 전력
  const ii = R.interestInfo(run);
  let r = ii.cap * CFG.interestPer * ECON.reserveFrac * (ii.myopic ? 0.6 : 1);
  const L = lossCost(run);
  if (run.hp <= L * ECON.dangerK) return 0;
  if (run.hp <= L * ECON.cautionK) r *= 0.5;
  if (bigNode(run.node?.type)) r *= boss && run.node?.type === 'boss' ? ECON.bossFight : ECON.bigFight;
  return Math.round(r);
}

/** 공명도 구매: 크레딧 1 당 팀 가치 상대 상승이 가장 큰 출전 기물 (growth.ts xpTarget 과 같은 점수, 기록 없음) */
export function xpBest(run: RunState): { u: UnitState; g: number } | null {
  const dep = team(run).filter((u) => u.rank < CFG.maxRank);
  if (!dep.length) return null;
  const base = teamEval(run, team(run));
  const per = (CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)) / R.xpCost(run);
  let best: { u: UnitState; g: number } | null = null;
  for (const u of dep) {
    const gain = teamWith(base, u.uid, unitIn(base, run, rankedUp(u))) - base.v + (milestone(u) ? 0.04 * base.v : 0);
    const need = Math.max(1, CFG.xpToNext(u.rank) - u.xp);
    const g = (gain / Math.max(1e-9, base.v) / need) * per;
    if (!best || g > best.g) best = { u, g };
  }
  return best;
}
/** 크레딧 1 당 상대 상승의 기준 (공명도 구매) — 다른 자원을 크레딧으로 환산할 때 쓴다 */
export const xpRate = (run: RunState) => Math.max(1e-5, xpBest(run)?.g || 0);

/** 함대 확장: 대기 기물 중 가장 좋은 1명을 더 출전시켰을 때의 상대 상승 (출전 가능한 대기 기물이 없으면 0) */
function fleetGain(run: RunState): number {
  const us = team(run);
  const bench = run.units.filter((u) => !u.pos && !R.isRock(u) && R.canDeploy(run, u));
  if (!bench.length || !us.length) return 0;
  const v0 = teamEval(run, us).v;
  return Math.max(...bench.map((b) => teamEval(run, [...us, b]).v)) / Math.max(1e-9, v0) - 1;
}

/** 함대 확장 · 공명도 구매: 남길 크레딧 위의 돈을 크레딧당 상승이 큰 쪽부터 */
export function spend(run: RunState, log: DLog, boss = false) {
  for (let g = 0; g < 80; g++) {
    const R0 = reserve(run, boss);
    const opts: { k: 'xp' | 'fleet'; cost: number; g: number; u?: UnitState }[] = [];
    const fc = R.fleetCost(run);
    if (fc !== null && run.units.length > R.deployCap(run)) { const fg = fleetGain(run); if (fg > 0) opts.push({ k: 'fleet', cost: fc, g: fg / fc }); }
    const xb = xpBest(run);
    if (xb && xb.g > 0) opts.push({ k: 'xp', cost: R.xpCost(run), g: xb.g, u: xb.u });
    const xg = xb?.g || 0;
    const floor = (o: { g: number }) => (o.g >= xg * ECON.dipK && xg > 0 ? 0 : R0); // 이득이 큰 행동은 이자 구간 아래로도
    const ok = opts.filter((o) => run.credits - o.cost >= floor(o)).sort((a, b) => b.g - a.g);
    // 함대 확장은 더 비싸다: 지금 살 수 없어도 공명도보다 크레딧당 이득이 크면 모은다 (공명도 구매를 미룬다)
    const saveFor = opts.find((o) => o.k === 'fleet' && run.credits < o.cost && o.g > xg * ECON.dipK);
    if (!ok.length || (saveFor && ok[0].k === 'xp')) break;
    const o = ok[0];
    if (o.k === 'fleet') { if (R.buyFleet(run)) break; log.add('econ', `함대 확장 (출전 ${R.deployCap(run)})`, 0, o.g * 1e4, [], `잔액 ${run.credits} · 남김 ${R0}`); continue; }
    // 공명도: 같은 대상이 다음 등급에 닿을 때까지는 점수가 오르기만 하므로 (남은 공명도가 줄어든다) 다시 계산하지 않고 이어서 산다
    const u = o.u!, r0 = u.rank;
    let bought = false;
    while (u.rank === r0 && run.credits - o.cost >= floor(o) && R.buyXp(run, u.uid)) bought = true;
    if (!bought) break;
  }
}

// ───────────────────────── 상점 · 합성 · 정비: 복제본에서 사 보고 장비 계획까지 굴린 뒤 크레딧당 상승
export interface Plan { (r: RunState): void }
function valueAfter(run: RunState, plan: Plan, f?: (r: RunState) => void): number {
  const r = structuredClone(run);
  r.pending = [];
  f?.(r);
  try { plan(r); } catch { /* 평가 실패 = 그대로 */ }
  return V(r);
}
/** 가치를 크레딧으로 쳐 주는 물건 (V 에 안 잡히는 것): 강제 징수기 · 포탑 장비 */
function flatValue(run: RunState, id: string): number {
  if (id === 'K_seize') return (run.diff || 0) >= CFG.solventFrom ? 18 : 8;
  if (isTurretGear(id) || isTurretMod(id)) return engTier(run) ? (TURRET_ADV.includes(id) ? 16 : 9) : 0;
  return 0;
}
export function shop(run: RunState, plan: Plan, log: DLog, track?: (id: string, w: 'bought') => void) {
  const stock = run.node?.shop || [];
  const maint = !!run.node?.maint;
  for (let g = 0; g < 8; g++) {
    const R0 = reserve(run);
    const rate = xpRate(run);
    const v0 = valueAfter(run, plan);
    const sc = stock.map((s, i) => ({ s, i })).filter(({ s }) => !s.sold && s.price <= run.credits && run.inventory.length < CFG.inventoryMax).map(({ s, i }) => {
      const fv = flatValue(run, s.item);
      const dv = fv ? fv * rate : valueAfter(run, plan, (r) => { r.inventory.push(s.item); }) / Math.max(1e-9, v0) - 1;
      return { i, id: s.item, price: s.price, g: s.price > 0 ? dv / s.price : dv > 0 ? 1 : 0, dv };
    }).filter((x) => x.dv > 0).sort((a, b) => b.g - a.g);
    const best = sc.find((x) => x.g >= rate * ECON.shopVsXp && (run.credits - x.price >= R0 || x.price === 0 || x.g >= rate * ECON.dipK));
    if (!best) break;
    if (R.buyShop(run, best.i) !== null) break;
    track?.(best.id, 'bought');
    log.add('shop', `${maint ? '정비' : '구매'} ${best.id} (${best.price})`, 0, best.dv * 1e4, sc.filter((x) => x !== best).slice(0, 3).map((x) => `${x.id} ${(x.g / rate).toFixed(2)}`), `공명도 대비 ${(best.g / rate).toFixed(2)} · 잔액 ${run.credits}`);
    plan(run); // 산 물건을 바로 반영 (장비 계획 · 포탑)
  }
}
/** 포탑 장비 · 엔지니어 개조부품: 보관함에 있으면 빈 포탑 칸에 */
export function equipTurrets(run: RunState) {
  const n = turretCount(run);
  if (!n) return;
  R.syncTurrets(run);
  for (let g = 0; g < 12; g++) {
    const i = run.inventory.findIndex((x) => isTurretGear(x) || isTurretMod(x));
    if (i < 0) return;
    const id = run.inventory[i];
    let ti = -1;
    if (isTurretMod(id)) ti = (run.turretMods || []).findIndex((m) => !m);
    else ti = (run.turretGear || []).findIndex((s) => s.includes(null));
    if (ti < 0) return;
    if (R.equipTurret(run, i, ti) !== null) return;
  }
}

// ───────────────────────── 분기점: 보급 · 상점 · 모집 · 정비 · 투자 · 순례 (지금 필요한 것)
export function branch(run: RunState, options: NodeType[], log: DLog): NodeType {
  const sup = R.supplyBase(run); // 보급 카드 3장 합계 기준값 (공개 규칙)
  const spare = Math.max(0, run.credits - reserve(run));
  const deployable = run.units.filter((u) => !R.isRock(u) && R.canDeploy(run, u)).length;
  const openSlot = deployable < R.deployCap(run);
  const sc = options.map((o) => {
    let v = 0;
    switch (o) {
      case 'supply': v = sup; break;
      case 'recruit': v = run.units.length >= CFG.maxParty ? 0 : openSlot ? sup * 1.6 : run.units.length < 8 ? sup * 1.05 : sup * 0.5; break;
      case 'shop': v = 4 + 0.45 * Math.min(spare, 40) + ((run.diff || 0) >= CFG.solventFrom && R.solventLeft(run) < 1 ? 4 : 0); break;
      case 'maint': { const g = run.turretGear || []; const empty = g.reduce((s, x) => s + x.filter((y) => !y).length, 0) || turretCount(run); v = empty ? 10 + Math.min(spare, 20) * 0.4 : 3; break; }
      case 'invest': v = run.credits >= 20 ? 6 + 0.5 * Math.min(spare, 30) : 0; break;
      case 'pilgrim': v = sup * 0.9; break;
      case 'news': v = Math.min(20, run.fame); break;
    }
    return { o, v };
  }).sort((a, b) => b.v - a.v);
  log.add('branch', `분기 ${sc[0].o}`, 0, sc[0].v, sc.slice(1).map((x) => `${x.o} ${x.v.toFixed(1)}`));
  return sc[0].o;
}

// ───────────────────────── 사건: 선택지마다 복제 상태에서 (런 난수 대신 다른 난수로) 굴려 상태 가치 W 비교
/** 상태 가치 (크레딧 단위): 크레딧 + 체력 가치 + ln(V) ÷ 공명도 환율 + 남은 선택(영입 · 전역 증강 등) 어림 */
export function stateW(run: RunState, plan: Plan, rate: number, hpK: number): number {
  const r = structuredClone(run);
  let extra = 0;
  // 남은 선택은 단순 규칙으로 처리 (영입 = 보급 기준값의 0.8, 전역 증강 = 12 크레딧, 전리품 = 첫 선택지, 증강 = 첫 선택지)
  for (let g = 0; g < 20 && r.pending.length; g++) {
    const p = r.pending[0];
    if (p.t === 'recruit') { extra += R.supplyBase(r) * 0.8; r.pending.shift(); }
    else if (p.t === 'global') { extra += 12; r.pending.shift(); }
    else if (p.t === 'itemPick') { R.gainItem(r, p.options[0]); r.pending.shift(); }
    else if (p.t === 'rankup') { if (!p.allocDone) R.allocRank(r, p, ['pow', 'vit']); R.ensureRankupOptions(r, p); if (p.options?.[0]) R.chooseAug(r, p.uid, p.options[0]); else r.pending.shift(); if (r.pending[0] === p) r.pending.shift(); }
    else r.pending.shift();
  }
  try { plan(r); } catch { /* 그대로 */ }
  const v = Math.max(1e-9, V(r));
  const hpW = (h: number) => hpK * h * (1 + 20 / Math.max(10, h)); // 체력이 낮을수록 1 의 가치가 크다 (적분 어림)
  return r.credits + hpW(Math.max(0, r.hp)) + Math.log(v) / rate + extra + (r.over ? -1e6 : 0);
}
export function event(run: RunState, p: Extract<Pending, { t: 'event' }>, plan: Plan, log: DLog, rng: Rng): number | null {
  const rate = xpRate(run);
  const hpK = ECON.hpVal[(run.diff || 0) >= 6 ? 'd7' : 'd3'];
  const sc: { i: number; w: number }[] = [];
  for (let i = 0; i < 3; i++) {
    let sum = 0, n = 0;
    for (let k = 0; k < ECON.eventSamples; k++) {
      const r = structuredClone(run);
      r.rng = rng.int(1, 2147483646); // 런 난수 대신 봇 난수 (결과를 미리 보지 않는다)
      if (R.chooseEvent(r, i) !== null) break; // 고를 수 없는 선택지 (막힘)
      if (r.pending[0]?.t === 'event' && r.pending[0].id === p.id) break; // 없는 선택지
      sum += stateW(r, plan, rate, hpK); n++;
    }
    if (n) sc.push({ i, w: sum / n });
  }
  if (!sc.length) return null;
  sc.sort((a, b) => b.w - a.w);
  log.add('event', `사건 ${p.id} #${sc[0].i}`, 0, sc[0].w, sc.slice(1).map((x) => `#${x.i} ${x.w.toFixed(1)}`));
  return sc[0].i;
}
