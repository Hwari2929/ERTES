// 철수 봇 2단계: 영입 재설계 (recruit2 영역) — 1단계 영입 평가(지금 출전 가능한 최선 편성 V 만)는 고난에서 해로웠다.
//   바꾼 점: (1) 앞으로 늘 출전 인원(지금 + 1 · + 2)까지 탐욕 편성을 이어 가며 V 를 본다 (장기 시너지 경로),
//   (2) 편성에 못 드는 후보는 '방출 가치'(크레딧 + 공명도, 공개 규칙 releaseValue)로 센다 (대기석 가치),
//   (3) 편성에 들지 못하는 대기 기물은 benchKeep 명만 남기고 방출한다 (공명도가 대기석에 새지 않게, 장비도 용제 없이 돌아온다),
//   (4) 반려 돌은 영입하지 않고, 이미 있으면 방출한다 (출전 칸을 비운다).
import { CFG } from '../../src/config';
import { isLocked } from '../../src/data/items';
import { UNIT_BY_ID } from '../../src/data/units';
import * as R from '../../src/engine/run';
import type { Pending, RunState, UnitState } from '../../src/types';
import { cloneUnit, teamEval } from './eval';
import { thresholdCands } from './form';
import { memberships } from '../../src/engine/build';
import type { DLog } from './log';

export const ROSTER = {
  w: [1, 0.6, 0.35], // 출전 인원 지금 · +1 · +2 의 V 상승 무게
  benchKeep: 2, // 편성 밖 대기 기물을 이만큼은 남긴다 (교체 · 시너지 후보)
  releaseW: 0.004, // 방출 가치 크레딧 1 = 팀 가치 상대 상승 이만큼 (공명도 구매 환율 어림)
};

/** 편성 평가용 (form.ts asEval 과 같다): 위험 7 미만은 장비를 무료로 옮기므로 일반 장비를 뺀다 */
const asEval = (run: RunState, u: UnitState) => {
  if ((run.diff || 0) >= CFG.solventFrom) return u;
  const c = cloneUnit(u);
  c.items = c.items.map((x) => (x && isLocked(x) ? x : null));
  return c;
};
/** 탐욕 편성: 가치가 큰 기물부터 한 명씩, 크기 cap … cap+2 의 V 와 그 순서 */
export function greedyPath(run: RunState, pool: UnitState[], cap: number, bias?: Bias): { vs: number[]; order: UnitState[] } {
  const team: UnitState[] = [], left = pool.slice(), vs: number[] = [];
  const ev = (us: UnitState[]) => teamEval(run, us.map((x) => asEval(run, x))).v * (bias ? bias(us) : 1);
  while (team.length < cap + 2 && left.length) {
    let bi = 0, bv = -1;
    left.forEach((u, i) => { const v = ev([...team, u]); if (v > bv) { bv = v; bi = i; } });
    team.push(left[bi]); left.splice(bi, 1);
    if (team.length >= cap) vs.push(bv);
  }
  while (vs.length < 3) vs.push(vs[vs.length - 1] || 0);
  return { vs, order: team };
}
/** 3단계 multi: 크기 cap … cap+2 의 '계획 편성' 가치 — 탐욕 편성에 임계점 후보(완성 · 단독 유지, form.ts thresholdCands)를 더해 가장 큰 것.
 *  영입 가치(지금 + 앞으로 조합)와 보관 가치(계획 편성에 드는가)가 같은 계획을 본다. only = 이 시너지들만 임계점 후보를 만든다 (계산 절약) */
export function planPath(run: RunState, pool: UnitState[], cap: number, bias?: Bias, only?: Set<string>): { vs: number[]; keep: Set<UnitState>; plans: string[] } {
  const g = greedyPath(run, pool, cap, bias);
  const ev = (us: UnitState[]) => teamEval(run, us.map((x) => asEval(run, x))).v * (bias ? bias(us) : 1);
  const keep = new Set(g.order), vs = g.vs.slice(), plans: string[] = [];
  for (let k = 0; k < 3; k++) {
    const team = g.order.slice(0, cap + k);
    if (team.length < cap + k) break;
    for (const c of thresholdCands(run, team, pool.filter((u) => !team.includes(u)), ev, only)) {
      const v = ev(c.team);
      if (v > vs[k]) { vs[k] = v; plans.push(`${cap + k}:${c.name}`); for (const u of c.team) keep.add(u); }
    }
  }
  return { vs, keep, plans };
}
const candUnit = (id: string, rank: number): UnitState => {
  const d = UNIT_BY_ID[id];
  return { uid: `cand_${id}`, defId: id, rank, xp: 0, alloc: { vit: rank - 1, pow: rank - 1, mnd: rank - 1, def: rank - 1, agi: rank - 1 }, perm: { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 }, augments: [], items: [d.item || null, null, null], mod: null, pos: null, faith: d.faith, grow: {} };
};
const releaseCredits = (rank: number) => R.releaseGain(rank);

/** 대표 빌드 가중 (build 영역, 없으면 1) */
export type Bias = (us: UnitState[]) => number;
export function pickRecruit2(run: RunState, p: Extract<Pending, { t: 'recruit' }>, log: DLog, bias?: Bias, multi = false): string {
  if (run.units.length >= CFG.maxParty) return '-';
  const cap = R.deployCap(run), rank = R.recruitRank(run);
  const pool0 = run.units.filter((u) => R.canDeploy(run, u) && !R.isRock(u));
  const base = multi ? planPath(run, pool0, cap, bias).vs : greedyPath(run, pool0, cap, bias).vs;
  const sc = p.options.filter((id) => !UNIT_BY_ID[id].inert).map((id) => {
    const c = candUnit(id, rank);
    // 3단계 multi: 영입 가치 = 지금 + 앞으로(출전 +1 · +2)의 계획 편성 (후보가 들어가는 시너지의 임계점 완성 포함)
    const path = multi ? (() => { const pp = planPath(run, [...pool0, c], cap, bias, new Set(memberships(c, run))); return { vs: pp.vs, order: [...pp.keep] }; })() : greedyPath(run, [...pool0, c], cap, bias);
    const gain = ROSTER.w.reduce((s, w, k) => s + w * (path.vs[k] / Math.max(1e-9, base[k]) - 1), 0);
    const inTeam = path.order.includes(c);
    // 편성(지금 + 2 까지)에 못 들면 방출 가치로 (영입 → 방출)
    const v = inTeam ? Math.max(gain, ROSTER.releaseW * releaseCredits(rank)) : ROSTER.releaseW * releaseCredits(rank);
    return { id, v, inTeam };
  }).sort((a, b) => b.v - a.v);
  if (!sc.length) return '-';
  log.add('recruit2', `영입 ${sc[0].id}${sc[0].inTeam ? '' : ' (방출 예정)'}`, 0, sc[0].v * 1e4, sc.slice(1).map((x) => `${x.id} ${(x.v * 1e4).toFixed(0)}${x.inTeam ? '' : '·방출'}`));
  return sc[0].id;
}

/** 편성(지금 출전 인원 + 2)에 들지 못하는 대기 기물을 방출한다 (benchKeep 명은 남긴다). 반려 돌은 언제나 방출 */
let relSig = '';
export function releaseBench(run: RunState, log: DLog, bias?: Bias, multi = false): number {
  let n = 0;
  // 같은 보유 상태면 다시 보지 않는다 (계산 절약)
  const sig = JSON.stringify([run.seed, run.units.map((u) => [u.uid, u.rank, !!u.pos, u.items, u.mod, u.augments.length]), R.deployCap(run), run.phase]);
  if (sig === relSig) return 0;
  for (const rock of run.units.filter((u) => R.isRock(u))) { if (R.releaseUnit(run, rock.uid) === null) { n++; log.add('release', '반려 돌 방출', 0, 0, []); } }
  const cap = R.deployCap(run);
  const pool = run.units.filter((u) => R.canDeploy(run, u) && !R.isRock(u));
  if (pool.length <= cap + ROSTER.benchKeep) { relSig = sig; return n; }
  // 3단계 multi: 보관 가치 = 계획 편성(탐욕 + 임계점 완성 · 단독 유지)에 드는가
  const keep = new Set((multi ? [...planPath(run, pool, cap, bias).keep] : greedyPath(run, pool, cap, bias).order).map((u) => u.uid));
  const out = run.units.filter((u) => !u.pos && !R.isRock(u) && R.canDeploy(run, u) && !keep.has(u.uid));
  const extra = out.length - ROSTER.benchKeep;
  if (extra <= 0) { relSig = sig; return n; }
  // 낮은 등급부터 (방출 가치는 등급에 비례하지만, 높은 등급은 다음 교체 후보로 남긴다)
  for (const u of out.sort((a, b) => a.rank - b.rank).slice(0, extra)) {
    // 앞선 방출의 공명도 분배로 이 기물의 등급 상승 선택이 대기 중이면 남긴다 (방출하면 대기 중인 선택이 없는 기물을 가리킨다 — 3단계 기록의 실행 실패 1건)
    if (run.pending.some((p) => p.t === 'rankup' && p.uid === u.uid)) continue;
    const v = R.releaseValue(run, u);
    if (R.releaseUnit(run, u.uid) === null) { n++; log.add('release', `방출 ${u.defId} (등급 ${u.rank})`, 0, 0, [`크레딧 ${v.credits} · 공명도 ${v.xp}`]); }
  }
  relSig = JSON.stringify([run.seed, run.units.map((u) => [u.uid, u.rank, !!u.pos, u.items, u.mod, u.augments.length]), R.deployCap(run), run.phase]);
  return n;
}
