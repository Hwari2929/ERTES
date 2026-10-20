// 철수 봇 2단계: 전문 빌드 정책 (build 영역) — 대표 빌드 3개 중 지금 가진 기물로 가장 가까운 것을 고르고 (유지 / 전환 비교),
//   편성 · 영입 · 방출에 빌드 가중을 주며, 모자란 빌드 구성원을 지정 소집(공개 규칙: 고른 시너지 3개 중 하나라도 가진 기물 4명)으로 찾는다.
//   주어진 계약 후보 · 영입 선택지 · 지정 소집 결과만 쓴다 (기물 · 장비를 강제로 주지 않는다).
//   빌드 (1단계 · 조정 시드 관찰에서 고름): 지휘관 다수 (전술 위력이 지휘관 수 · 인원에 비례) · 수호자 (전열 유지) · 의무관 (지속 회복)
import { CFG } from '../../src/config';
import { UNIT_BY_ID } from '../../src/data/units';
import { memberships } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import type { RunState, UnitState } from '../../src/types';
import { reserve } from './econ';
import type { DLog } from './log';

export interface BuildDef { id: string; name: string; member: (u: UnitState, run: RunState) => boolean; syn?: string; target: number; steps: number[]; manual?: boolean }
/** steps (3단계 build3): 목표 임계점 — 앞 단계에 닿고 구성원을 더 모을 수 있으면 다음 단계를 목표로 한다 */
export const BUILDS: BuildDef[] = [
  { id: 'cmd', name: '지휘관 다수', member: (u) => UNIT_BY_ID[u.defId].ctype === 'CMD', target: 4, steps: [3, 4, 5] },
  { id: 'guard', name: '수호자', member: (u, r) => memberships(u, r).includes('GUARD'), syn: 'GUARD', target: 4, steps: [2, 4, 6] },
  { id: 'med', name: '의무관', member: (u, r) => memberships(u, r).includes('MED'), syn: 'MED', target: 4, steps: [2, 4, 6] },
  // 3단계 조건부 실험 전용 (forcebuild=voyage|time, 자동 선택에는 넣지 않는다): 출항기 = 단독 유지 → 완전체 (1 → 5), 시간 여행자 = 2 → 3 → 4
  { id: 'voyage', name: '출항기', member: (u, r) => memberships(u, r).includes('VOYAGE'), syn: 'VOYAGE', target: 5, steps: [1, 5], manual: true },
  { id: 'time', name: '시간 여행자', member: (u, r) => memberships(u, r).includes('TIME'), syn: 'TIME', target: 4, steps: [2, 3, 4], manual: true },
];
export const BUILD = {
  gamma: 0.05, // 편성 · 영입 가중: 출전 구성원 1명당 (목표 인원까지)
  minMembers: 2, // 보유 구성원이 이만큼은 있어야 그 빌드를 고른다
  switchMargin: 1.5, // 다른 빌드의 진척이 이만큼 더 커야 전환한다
  musterPerPhase: 1, // 페이즈당 지정 소집 최대 횟수
  abandonPhase: 3, // build3: 이 페이즈부터 첫 임계점에도 못 닿았고 직전 페이즈보다 구성원이 늘지 않았으면 빌드를 버린다 (가중 없음)
};
/** build3: 지금 목표 임계점 (닿은 단계 다음, 보유 구성원 + 남은 후보로 닿을 수 있는 단계까지) */
export function buildTarget(run: RunState, b: BuildDef): number {
  const have = run.units.filter((u) => !R.isRock(u) && b.member(u, run)).length;
  const left = memberDefs(b).filter((d) => !run.units.some((u) => u.defId === d.id)).length;
  const reach = b.steps.filter((n) => n <= have + left);
  return reach.find((n) => n > have) ?? reach[reach.length - 1] ?? b.target;
}

const memberDefs = (b: BuildDef) => Object.values(UNIT_BY_ID).filter((d) => !d.eventOnly && !d.inert && !d.king && (b.syn ? ([...d.factions, ...d.traits] as string[]).includes(b.syn) : d.ctype === 'CMD'));
/** 빌드 진척: 보유(출전 가능) 구성원 수 + 등급 보정 */
function progress(run: RunState, b: BuildDef): number {
  return run.units.filter((u) => !R.isRock(u) && b.member(u, run)).reduce((s, u) => s + 1 + 0.03 * u.rank, 0);
}
/** 빌드 고르기 · 유지/전환 (페이즈마다 다시 본다). 없으면 null */
const lastHave = new Map<string, number>();
export function chooseBuild(run: RunState, cur: string | null, log: DLog, force?: string, v3 = false): string | null {
  if (force) return force;
  const sc = BUILDS.filter((b) => !b.manual).map((b) => ({ b, p: progress(run, b) })).sort((x, y) => y.p - x.p);
  const curP = cur ? sc.find((x) => x.b.id === cur)!.p : 0;
  let pick = cur;
  if (sc[0].p >= BUILD.minMembers && (!cur || sc[0].p > curP + BUILD.switchMargin)) pick = sc[0].b.id;
  if (v3 && pick) {
    // build3 포기 조건: abandonPhase 부터 첫 임계점 미만이고 직전 판단보다 구성원이 늘지 않았으면 버린다 (다른 빌드도 조건이 안 되면 빌드 없음)
    const b = BUILDS.find((x) => x.id === pick)!;
    const have = run.units.filter((u) => !R.isRock(u) && b.member(u, run)).length;
    const k = `${run.seed}|${b.id}`, prev = lastHave.get(k);
    lastHave.set(k, have);
    if (run.phase >= BUILD.abandonPhase && have < b.steps[0] && prev !== undefined && have <= prev) {
      log.add('build', `빌드 포기 ${b.id} (구성원 ${have} < ${b.steps[0]})`, 0, 0, []);
      pick = null;
    }
  }
  if (pick !== cur) log.add('build', `빌드 ${cur || '-'} → ${pick}`, 0, 0, sc.map((x) => `${x.b.id} ${x.p.toFixed(1)}`));
  return pick;
}
/** 편성 · 영입 가중: 1 + gamma × 출전 구성원 수 (목표까지) */
export function bias(run: RunState, id: string | null, v3 = false): ((us: UnitState[]) => number) | undefined {
  const b = BUILDS.find((x) => x.id === id);
  if (!b) return undefined;
  if (v3) {
    // build3: 임계점에 닿은 인원만 센다 (임계점 사이의 구성원은 효과가 없으므로 가중도 없다), 목표 임계점까지
    const tgt = buildTarget(run, b);
    return (us) => { const n = us.filter((u) => b.member(u, run)).length; const reached = b.steps.filter((x) => x <= n && x <= tgt); return 1 + BUILD.gamma * (reached.length ? reached[reached.length - 1] : 0); };
  }
  return (us) => 1 + BUILD.gamma * Math.min(b.target, us.filter((u) => b.member(u, run)).length);
}
/** 지정 소집: 빌드 구성원이 목표보다 모자라고, 남길 크레딧 위로 비용이 있으면 (페이즈당 musterPerPhase 번) */
export function muster(run: RunState, id: string | null, used: number, log: DLog, v3 = false): boolean {
  const b = BUILDS.find((x) => x.id === id);
  if (!b || used >= BUILD.musterPerPhase || run.node || run.pending.length || run.units.length >= CFG.maxParty) return false;
  const have = run.units.filter((u) => b.member(u, run)).length;
  if (have >= (v3 ? buildTarget(run, b) : b.target + 1)) return false;
  const cost = R.musterCost(run);
  if (run.credits - cost < reserve(run)) return false;
  // 시너지 3개: 빌드 시너지 + 아직 없는 구성원을 가장 많이 담은 시너지 (지휘관 빌드는 지휘관이 많은 시너지)
  const want = memberDefs(b).filter((d) => !run.units.some((u) => u.defId === d.id) && d.id !== 'amundsen').map((d) => d.id);
  if (!want.length) return false;
  const ok = R.musterSyns().filter((s) => s !== b.syn);
  const cnt = (s: string) => want.filter((id) => ([...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[]).includes(s)).length;
  const syns = [...(b.syn ? [b.syn] : []), ...ok.sort((x, y) => cnt(y) - cnt(x))].slice(0, CFG.musterPicks);
  if (R.openMuster(run) !== null) return false;
  if (R.confirmMuster(run, syns) !== null) { R.cancelMuster(run); return false; }
  log.add('muster', `지정 소집 ${syns.join(',')} (${cost})`, 0, 0, [`빌드 ${b.id} 구성원 ${have}/${b.target}`]);
  return true;
}
