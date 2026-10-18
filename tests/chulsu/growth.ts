// 철수 봇: 성장 판단 — 공명도 구매 대상 (다음 등급까지의 비용 대비 팀 가치 상승 · 이정표), 마이너 능력치 선택 (실제 계수 기준).
import { CFG } from '../../src/config';
import { deployed } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import { MAJORS, type Major, type Pending, type RunState, type UnitState } from '../../src/types';
import { cloneUnit, milestone, rankedUp, teamEval, teamWith, unitIn } from './eval';
import type { DLog } from './log';

export const GROW = {
  milestone: 0.04, // 다음 등급에 이정표(증강 · 능력치 선택)가 있으면 팀 가치의 이 비율을 더한다
  reserve: 30, // 공명도 구매 뒤 남길 크레딧 (덤비와 같은 경제 규칙: 이번 단계에서는 경제 판단을 바꾸지 않는다)
};

/** 공명도 1점당 가치가 가장 큰 출전 기물 (다음 등급까지 남은 공명도로 나눈다). 없으면 null */
export function xpTarget(run: RunState, log?: DLog): UnitState | null {
  const dep = deployed(run).filter((u) => !R.isRock(u) && u.rank < CFG.maxRank);
  if (!dep.length) return null;
  const base = teamEval(run, deployed(run).filter((u) => !R.isRock(u)));
  const sc = dep.map((u) => {
    const gain = teamWith(base, u.uid, unitIn(base, run, rankedUp(u))) - base.v + (milestone(u) ? GROW.milestone * base.v : 0);
    const need = Math.max(1, CFG.xpToNext(u.rank) - u.xp);
    return { u, s: gain / need };
  }).sort((a, b) => b.s - a.s);
  log?.add('xp', `공명도 → ${sc[0].u.defId} (등급 ${sc[0].u.rank})`, base.v, base.v, sc.slice(1, 3).map((x) => `${x.u.defId}:${x.u.rank}`));
  return sc[0].u;
}

/** 공명도 구매: 크레딧 규칙은 덤비와 같고 (잔액 GROW.reserve + 단가 이상일 때), 대상만 고른다 */
export function buyXp(run: RunState, log: DLog) {
  for (let g = 0; g < 60 && run.credits >= GROW.reserve + R.xpCost(run); g++) {
    const u = xpTarget(run, g === 0 ? log : undefined);
    if (!u || !R.buyXp(run, u.uid)) break;
  }
}

/** 마이너 능력치 선택: 주요 능력치 하나씩 +points 를 가정해 팀 가치 상승이 큰 두 개 */
export function allocPicks(run: RunState, p: Extract<Pending, { t: 'rankup' }>, log: DLog): Major[] {
  const u = run.units.find((x) => x.uid === p.uid)!;
  const team = deployed(run).filter((x) => !R.isRock(x));
  const inTeam = team.includes(u) ? team : [...team, u];
  const base = teamEval(run, inTeam);
  const pts = p.points * (p.great ? 2 : 1);
  const sc = MAJORS.map((m) => { const c = cloneUnit(u); c.alloc[m] += pts; return { m, v: teamWith(base, u.uid, unitIn(base, run, c)) }; }).sort((a, b) => b.v - a.v);
  const pick: Major[] = [sc[0].m, sc[1].m];
  log.add('alloc', `${u.defId} +${pts} ${pick.join('/')}`, base.v, sc[0].v, sc.slice(2).map((x) => `${x.m} ${Math.round(x.v)}`));
  return pick;
}
