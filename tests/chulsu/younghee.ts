// 영희 (younghee): 철수와 판단이 같고 경제(크레딧 운용)만 '장기투자형'으로 바꾼 봇. docs/BOT_YOUNGHEE.md
//   사용자 플레이: "40크레딧 이상을 필수로 유지하면서 공명도에는 필요할 때만 투자하고, 보통 함대 확장 후 시너지 확보에 대부분의 크레딧을 사용한다."
//   1. 바닥 40 (YH.floor): 보유 크레딧을 40 아래로 내리는 지출(함대 확장 · 지정 소집 · 공명도 · 상점 · 정비 · 합성 · 투자)을 하지 않는다 (이자 상한 구간 유지).
//      변형 yh_last: 의뢰 마지막 페이즈(CFG.victoryPhase)에서는 바닥을 풀고 남은 크레딧을 다 쓴다.
//   2. 우선순위 (바닥 위 여유분): ① 함대 확장 → ② 시너지 확보 (목표 빌드 · 지금 시너지의 다음 단계: 지정 소집 · 상점 문장 · 장비 · 갈림길 영입/상점) → ③ 공명도.
//      위 순위의 지출을 아직 못 하면 (돈이 모자라면) 아래 순위에 쓰지 않고 모은다.
//   3. 공명도는 '필요할 때'만 (xpNeed): (a) 출전 주력 기물(팀 가치 몫 상위 YH.coreN)이 공명도 구매 YH.nearBuys 번 안에 이정표 등급(증강 · 능력치 선택)에 닿을 때 그만큼만,
//      (b) 편성 화면의 조우가 보스 · 역경 · 도전이고 전력이 모자랄 때 (보스: 보스 패배율 어림 ≥ YH.bossWeak · 역경/도전: 직전 역경/도전을 졌거나 남은 아군 체력 < YH.advWeakHp, 기록이 없으면 모자람으로 본다)
//      바닥 위 전부를 철수의 공명도 점수(xpBest)대로. 그 밖에는 사지 않는다.
//   4. 갈림길: 위 순위로 점수 (branch). 상점은 철수의 상점 판단(E.shop)을 바닥 40 으로.
//   그 밖의 판단(편성 · 장비 · 성장 배분 · 증강 · 사건 · 역경/휴식 · 영입 선택)은 철수와 같다 (index.ts 가 경제 함수만 바꾼다).
//   쓰는 정보: 지금 런 상태 · 공개 규칙(CFG · 비용 · 시너지 단계) · 지금까지 본 전투 결과. 숨은 보상 · 런 난수는 읽지 않는다 (철수 원칙).
import { CFG } from '../../src/config';
import { SYN_BY_ID } from '../../src/data/synergies';
import { deployed, memberships, synergyCounts, turretCount } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import type { NodeType, RunState, SynergyId, UnitState } from '../../src/types';
import { bossLossRate } from './aug';
import { BUILDS, bestMusterSyns, buildTarget } from './build';
import { fleetGain, xpBest } from './econ';
import { milestone, teamEval } from './eval';
import type { Hist } from './hard';
import type { DLog } from './log';
import { effTier } from './syn';

export type YhMode = 'yh' | 'yh_last';
export const YH = {
  floor: 40, // 바닥: 이 아래로 내리는 지출을 하지 않는다 (고난 이자 상한 4 × 10)
  coreN: 3, // 주력 = 출전 기물 중 팀 가치 몫(피해 몫 + 유효 체력 몫) 상위 이 수
  nearBuys: 2, // 주력이 공명도 구매 이 횟수 안에 이정표 등급에 닿으면 산다 (구매 1번 = 공명도 4)
  bossWeak: 0.4, // 보스 패배율 어림(aug.ts bossLossRate: 위험별 사전값 + 본 보스전 결과) 이 이상이면 '전력이 모자람'
  advWeakHp: 0.5, // 직전 역경 · 도전을 이겼어도 남은 아군 체력 비율이 이 아래면 '전력이 모자람'
  musterPerPhase: 2, // 페이즈당 지정 소집 최대 횟수 (철수 1)
  nearNeed: 1, // 지금 시너지: 이 인원만 더 모으면 다음 효과 단계 → 지정 소집 · 영입 목표
  shopVsXp: 0, // 상점 물건: 크레딧당 상승이 공명도 구매의 이 배 이상이면 산다 (철수 1). 영희는 공명도가 맨 뒤 순위라 비교하지 않는다 — 팀 가치가 오르는 물건을 크레딧당 상승 순으로 (철수 평가에서 장비는 공명도의 0.04~0.3배라 1 이면 거의 사지 않는다)
  saveGap: 25, // ① 함대 확장이 이만큼 이하로 모자라면 ② · ③ 에 쓰지 않고 모은다 (일반 전투 1번 수입 어림). 더 모자라면 바닥 위를 ② · ③ 에 쓴다
};
export const floorOf = (run: RunState, mode: YhMode) => (mode === 'yh_last' && run.phase >= CFG.victoryPhase ? 0 : YH.floor);
/** ② · ③ (시너지 · 공명도 · 상점 · 투자)이 쓸 수 있는 바닥: 보통은 바닥 F.
 *  ① 함대 확장을 원하는데 돈이 조금(YH.saveGap 이하)만 모자라면 모은다 → 바닥 = 지금 잔액 (아래 순위에 쓰지 않음, save = 모으는 함대 확장 비용) */
export function lowFloor(run: RunState, mode: YhMode): { floor: number; save?: number } {
  const F = floorOf(run, mode);
  const fw = fleetWant(run);
  if (fw && run.credits - fw.cost < F && fw.cost - (run.credits - F) <= YH.saveGap) return { floor: Math.max(F, run.credits), save: fw.cost };
  return { floor: F };
}
/** 바닥 위 여유분 (② · ③ 기준) */
export const spareOf = (run: RunState, mode: YhMode) => Math.max(0, run.credits - lowFloor(run, mode).floor);

// ───────────────────────── ① 함대 확장: 출전 가능한 대기 기물이 있고 그를 더 내보내면 팀 가치가 오를 때
export function fleetWant(run: RunState): { cost: number; g: number } | null {
  const c = R.fleetCost(run);
  if (c === null || run.units.length <= R.deployCap(run)) return null;
  const g = fleetGain(run);
  return g > 0 ? { cost: c, g } : null;
}

// ───────────────────────── ② 시너지 확보: 목표 빌드(철수 build 판단) 구성원 · 지금 시너지의 다음 효과 단계
const owned = (run: RunState) => run.units.filter((u) => !R.isRock(u) && R.canDeploy(run, u));
/** 목표 빌드가 아직 목표 임계점 아래인가 (build.ts muster 와 같은 조건) */
export function buildShort(run: RunState, buildId: string | null, v3: boolean): boolean {
  const b = BUILDS.find((x) => x.id === buildId);
  if (!b) return false;
  const have = run.units.filter((u) => b.member(u, run)).length;
  return have < (v3 ? buildTarget(run, b) : b.target + 1);
}
/** 지금 시너지 중 YH.nearNeed 명만 더 모으면 다음 효과 단계가 켜지는 것 (보유 출전 가능 기물 기준, 지정 소집 후보가 있는 시너지만). 인원이 많은 순 */
export function nearSyns(run: RunState): { s: string; n: number; need: number }[] {
  const cnt = synergyCounts(owned(run), run) as Record<string, number>;
  const ok = new Set(R.musterSyns());
  const out: { s: string; n: number; need: number }[] = [];
  for (const s of Object.keys(cnt)) {
    const n = cnt[s] || 0, d = SYN_BY_ID[s as SynergyId];
    if (!n || !d || !ok.has(s)) continue;
    const next = d.tiers.find((t) => t > n && effTier(s, t) > effTier(s, n));
    if (next === undefined || next - n > YH.nearNeed) continue;
    if (!R.musterPool(run, [s]).length) continue;
    out.push({ s, n, need: next - n });
  }
  return out.sort((a, b) => b.n - a.n);
}
/** 지정 소집할 시너지 3개 (목표 빌드가 모자라면 build.ts muster 가 고르므로 여기서는 지금 시너지용). 없으면 null */
export function nearMusterSyns(run: RunState): string[] | null {
  const near = nearSyns(run).map((x) => x.s);
  if (!near.length) return null;
  return bestMusterSyns(run, R.musterPool(run, near)); // 다음 단계 시너지 기물이 선택지에 나올 확률이 가장 높은 3개 (build.ts)
}

// ───────────────────────── ③ 공명도: 필요할 때만
const core = (run: RunState): UnitState[] => {
  const us = deployed(run).filter((u) => !R.isRock(u));
  if (!us.length) return [];
  const t = teamEval(run, us);
  const sh = (u: UnitState) => { const e = t.per.get(u.uid)!; return e.off / Math.max(1e-9, t.off) + e.ehp / Math.max(1e-9, t.ehp); };
  return us.filter((u) => u.rank < CFG.maxRank).sort((a, b) => sh(b) - sh(a)).slice(0, YH.coreN);
};
const xpPer = (run: RunState) => CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0);
/** 편성 화면의 큰 조우에서 전력이 모자란가 (본 전투 결과만) */
export function weakFor(run: RunState, hist: Hist[]): string | null {
  const t = run.node?.type;
  if (t === 'boss') { const p = bossLossRate(run, hist); return p >= YH.bossWeak ? `보스 패배율 ${p.toFixed(2)}` : null; }
  if (t === 'adversity' || t === 'challenge') {
    const h = [...hist].reverse().find((x) => x.t === 'adversity' || x.t === 'challenge');
    if (!h) return '역경 기록 없음';
    if (!h.w) return '직전 역경 패배';
    return h.hp < YH.advWeakHp ? `직전 역경 남은 체력 ${h.hp.toFixed(2)}` : null;
  }
  return null;
}
/** 공명도가 필요한가: near = 이정표 근처 주력 (그만큼만), big = 큰 조우 전력 부족 (바닥 위 전부), last = yh_last 마지막 페이즈 (바닥 0, 남은 것 전부) */
export function xpNeed(run: RunState, hist: Hist[], mode: YhMode): { k: 'near'; u: UnitState; buys: number } | { k: 'big' | 'last'; why: string } | null {
  if (mode === 'yh_last' && run.phase >= CFG.victoryPhase) return { k: 'last', why: '마지막 페이즈' };
  const w = weakFor(run, hist);
  if (w) return { k: 'big', why: w };
  for (const u of core(run)) {
    if (!milestone(u)) continue;
    const buys = Math.ceil(Math.max(1, CFG.xpToNext(u.rank) - u.xp) / xpPer(run));
    if (buys <= YH.nearBuys) return { k: 'near', u, buys };
  }
  return null;
}

/** 함대 확장 · 공명도 (지정 소집은 index.ts 에서 ① 과 ③ 사이에 부른다 — 빌드 · 소집 횟수 상태가 거기 있다).
 *  muster(floor): ② 를 시도하고 결과를 돌려준다 ('done' 소집함 · 'save' 하고 싶은데 돈이 모자람 · 'none' 할 것 없음) */
export function spend(run: RunState, log: DLog, hist: Hist[], mode: YhMode, muster: (floor: number) => 'done' | 'save' | 'none', breach: () => void) {
  const F = floorOf(run, mode);
  // ① 함대 확장
  for (let g = 0; g < 12; g++) {
    const fw = fleetWant(run);
    if (!fw || run.credits - fw.cost < F) break;
    if (R.buyFleet(run) !== null) break;
    if (run.credits < F) breach();
    log.add('econ', `함대 확장 (출전 ${R.deployCap(run)})`, 0, fw.g * 1e4, [], `잔액 ${run.credits} · 바닥 ${F}`);
  }
  const L = lowFloor(run, mode);
  if (L.save) { log.add('econ', `함대 확장 모으기 (${L.save})`, 0, 0, [], `잔액 ${run.credits} · 바닥 ${F}`); return; }
  // ② 시너지 확보 (지정 소집)
  const m = muster(L.floor);
  if (m === 'save') return;
  // ③ 공명도
  const need = xpNeed(run, hist, mode);
  if (!need) return;
  const cost = R.xpCost(run), c0 = run.credits;
  if (need.k === 'near') {
    let n = 0;
    const r0 = need.u.rank;
    while (n < need.buys && need.u.rank === r0 && run.credits - cost >= F && R.buyXp(run, need.u.uid)) n++;
    if (n) log.add('xp', `공명도 ${n}회 → ${need.u.defId} (이정표 등급 ${r0 + 1})`, 0, 0, [], `잔액 ${run.credits}`);
    if (run.credits < c0 && run.credits < F) breach();
    return;
  }
  let n = 0;
  for (let g = 0; g < 80 && run.credits - cost >= F; g++) {
    const xb = xpBest(run);
    if (!xb || xb.g <= 0 || !R.buyXp(run, xb.u.uid)) break;
    n++;
  }
  if (n) log.add('xp', `공명도 ${n}회 (${need.why})`, 0, 0, [], `잔액 ${run.credits} · 바닥 ${F}`);
  if (run.credits < c0 && run.credits < F) breach();
}

// ───────────────────────── 갈림길: 위 우선순위로 (값은 보급 카드 3장 합계 기준값 sup 단위)
export function branch(run: RunState, options: NodeType[], log: DLog, mode: YhMode, buildId: string | null, v3: boolean): NodeType {
  const sup = R.supplyBase(run);
  const spare = spareOf(run, mode);
  const full = run.units.length >= CFG.maxParty;
  const deployable = owned(run).length;
  const openSlot = deployable < R.deployCap(run);
  const fc = R.fleetCost(run);
  // ① 함대 확장을 할 수 있는데 내보낼 대기 기물이 없다 → 영입이 함대 확장의 조건
  const fleetBlocked = fc !== null && deployable <= R.deployCap(run) && spare >= fc * 0.5;
  // ② 시너지: 목표 빌드가 모자라거나 지금 시너지가 한 명 차이
  const synShort = buildShort(run, buildId, v3) || nearSyns(run).length > 0;
  const sc = options.map((o) => {
    let v = 0;
    switch (o) {
      case 'supply': v = sup; break;
      case 'recruit': v = full ? 0 : openSlot || fleetBlocked ? sup * 1.6 : synShort ? sup * 1.3 : run.units.length < 8 ? sup * 1.05 : sup * 0.5; break;
      // 상점: 바닥 위 여유분으로 시너지 장비 · 문장을 산다 (여유 16 이상부터 보급보다 높다) · 시너지 목표가 있으면 문장 몫 가산
      case 'shop': v = spare >= 7 ? sup * (0.7 + Math.min(spare, 60) / 50 + (synShort ? 0.15 : 0)) : 0; break;
      // 정비: 엔지니어 포탑의 빈 칸 (기본 포탑 장비 1개는 무료) — 빈 칸 1개 · 여유 20 이면 영입(1.6)보다 높다
      case 'maint': { const g = R.turretView(run); const empty = run.turretGear?.length ? g.reduce((s, x) => s + x.filter((y) => !y).length, 0) : turretCount(run); v = empty ? sup * (1 + 0.3 * Math.min(empty, 3) + Math.min(spare, 30) / 50) : 0; break; }
      // 투자 (장기투자): 호이슌 펀드(다음 페이즈 ×1.5~2.5) · 문장 매입(시너지) · 인재 영입 — 여유 20 이상이면 같은 여유의 상점보다 높다 (페이즈당 1번만 열린다)
      case 'invest': v = spare >= 20 ? sup * (0.95 + Math.min(spare, 60) / 50 + (synShort ? 0.15 : 0)) : 0; break;
      // 순례: 크레딧이 아니라 권능 포인트를 쓴다 (모아 둔 권능이 많을수록)
      case 'pilgrim': v = run.power >= 10 ? sup * Math.min(1.4, 0.5 + run.power / 40) : 0; break;
      // 소식: 명성 교환 (독점 인터뷰 5 → 크레딧 15 등)
      case 'news': v = run.fame >= 5 ? Math.min(sup * 1.5, run.fame * 1.2) : 0; break;
    }
    return { o, v };
  }).sort((a, b) => b.v - a.v);
  log.add('branch', `분기 ${sc[0].o}`, 0, sc[0].v, sc.slice(1).map((x) => `${x.o} ${x.v.toFixed(1)}`), `여유 ${spare} · 함대 ${fleetBlocked ? '영입 필요' : '-'} · 시너지 ${synShort ? '목표 있음' : '-'}`);
  return sc[0].o;
}

// ───────────────────────── 호이슌 투자 (갈림길 투자 노드): 바닥 위에서 문장 매입(시너지) → 인재 영입(출전 기물 증강) → 펀드(다음 페이즈 회수) → 전략 자금(호이슌 출전 2명 이상)
export function invest(run: RunState, log: DLog, mode: YhMode, breach: () => void) {
  const offers = run.node?.invest || [];
  const F = lowFloor(run, mode).floor, F0 = floorOf(run, mode);
  const dep = deployed(run);
  const hoi = dep.filter((u) => memberships(u, run).includes('HOI')).length;
  const order = ['emblem', 'aug', 'fund', 'rally'];
  for (const id of order) {
    const i = offers.findIndex((o) => o.id === id && !o.sold);
    if (i < 0) continue;
    const o = offers[i];
    if (id === 'aug' && !dep.some((u) => u.uid === o.uid)) continue;
    if (id === 'rally' && hoi < 2) continue;
    if (run.credits - o.cost < F) continue;
    if (R.buyInvest(run, i) === null) { log.add('econ', `투자 ${id} (${o.cost})`, 0, 0, [], `잔액 ${run.credits}`); if (run.credits < F0) breach(); }
  }
}
