// 철수 봇 2단계: 제한 탐색 (search 영역, 분석 전용 — 대량 테스트 기본에서 뺀다. bot=chulsu-search).
//   편성 화면에서 보이는 조우(run.node.enc: 적 구성 · 자리 · 장비)를 런 복제본에서 '다른 난수'로 SEARCH.k 번씩 미리 싸워 본다.
//   진짜 전투 시드(enc.seed)는 쓰지 않는다 — 시드는 봇 자체 난수로 새로 뽑는다 (미래 난수를 읽지 않는다).
//   지금 편성이 k 번 모두 이기면 그대로 둔다 (확신). 아니면 대안(앞뒤 뒤집기 · 암살형 대비 배치 반전 · 대기 ↔ 출전 교체 · 무작위 배치)을
//   상한 안에서 비교해, 이긴 횟수(같으면 남은 아군 체력)가 더 좋은 대안을 실제 런에 적용한다.
//   상한: 판단당 후보 수 · 판단당 시간 · 런당 추가 전투 수. 추가 전투 수 · 시간은 따로 기록한다 (ins.xb · ins.xms).
import { buildBattle, deployed } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import type { Rng } from '../../src/rng';
import type { RunState } from '../../src/types';
import { cloneUnit, teamEval } from './eval';
import { thresholdCands } from './form';
import { isLocked } from '../../src/data/items';
import { CFG } from '../../src/config';
import type { DLog } from './log';

export const SEARCH = {
  k: 4, // 후보마다 미리 싸워 보는 횟수 (다른 난수)
  maxCands: 6, // 판단당 대안 수
  perRun: 400, // 런당 추가 전투 상한
  perDecisionMs: 4000, // 판단당 시간 상한
  normalBelow: 0.5, // 일반 전투는 지금 편성의 미리 싸움 승률이 이보다 낮을 때만 대안을 찾는다 (역경 · 보스 · 도전은 k 승이 아니면 언제나)
};
type Edit = { name: string; f: (r: RunState) => void };
export interface SearchCtx { run: RunState; rng: Rng; log: DLog; xb: number; xms: number }

function trial(run: RunState, edit: Edit | null, seeds: number[], ctx: SearchCtx): { w: number; hp: number } {
  let w = 0, hp = 0;
  for (const s of seeds) {
    const r = structuredClone(run);
    edit?.f(r);
    const enc = { ...r.node!.enc!, seed: s };
    const b = buildBattle(r, enc, false);
    b.runToEnd();
    ctx.xb++;
    const A = b.units.filter((u) => u.side === 0 && !u.isSummon && !u.mem.inert);
    const m = A.reduce((a, u) => a + u.st.maxHp, 0);
    if (b.winner === 0) w++;
    hp += m > 0 ? A.reduce((a, u) => a + (u.alive ? Math.max(0, u.hp) : 0), 0) / m : 0;
  }
  return { w, hp: hp / seeds.length };
}
const byUid = (r: RunState, uid: string) => r.units.find((u) => u.uid === uid)!;
/** 대안 편집 (복제본 · 실제 런 모두에 같은 결과를 내는 결정적 편집) */
function candidates(run: RunState, rng: Rng): Edit[] {
  const out: Edit[] = [];
  const n = run.node!.enc!.n;
  const dep = deployed(run).filter((u) => !R.isRock(u));
  out.push({ name: '앞뒤 뒤집기', f: (r) => { for (const u of deployed(r)) u.pos = { c: u.pos!.c, r: 2 - u.pos!.r }; } });
  out.push({ name: '좌우 뒤집기', f: (r) => { for (const u of deployed(r)) u.pos = { c: n - 1 - Math.min(n - 1, u.pos!.c), r: u.pos!.r }; } });
  // 대기 ↔ 출전: 대기 중 팀 가치가 가장 큰 기물을, 팀 가치 기여가 가장 작은 출전 기물 2명과 각각
  const bench = run.units.filter((u) => !u.pos && !R.isRock(u) && R.canDeploy(run, u));
  if (bench.length && dep.length) {
    const t = teamEval(run, dep);
    const weak = dep.slice().sort((a, b) => t.per.get(a.uid)!.off * (t.per.get(a.uid)!.ehp + 1) - t.per.get(b.uid)!.off * (t.per.get(b.uid)!.ehp + 1)).slice(0, 2);
    const bestB = bench.map((b) => ({ b, v: teamEval(run, [...dep, b]).v })).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => x.b);
    for (const i of bestB) for (const o of weak) out.push({ name: `교체 ${o.defId}→${i.defId}`, f: (r) => { const ii = byUid(r, i.uid), oo = byUid(r, o.uid); ii.pos = oo.pos; oo.pos = null; } });
  }
  // 무작위 배치 (출전 기물 그대로, 칸만)
  for (let k = 0; k < 2; k++) {
    const cells = rng.shuffle([...Array(n * 3).keys()]);
    out.push({ name: `무작위 배치 ${k + 1}`, f: (r) => { deployed(r).forEach((u, i) => { u.pos = { c: cells[i] % n, r: Math.floor(cells[i] / n) }; }); } });
  }
  return out;
}

export function search(ctx: SearchCtx) {
  const { run } = ctx;
  const t = run.node?.type;
  if (!run.node?.enc || ctx.xb >= SEARCH.perRun) return;
  const t0 = performance.now();
  const seeds = Array.from({ length: SEARCH.k }, () => ctx.rng.int(1, 2147483646)); // 봇 자체 난수 (진짜 전투 시드 아님)
  const base = trial(run, null, seeds, ctx);
  const big = t === 'adversity' || t === 'boss' || t === 'challenge';
  if (base.w === SEARCH.k || (!big && base.w / SEARCH.k >= SEARCH.normalBelow)) { ctx.xms += performance.now() - t0; return; }
  let best: { e: Edit | null; w: number; hp: number } = { e: null, ...base };
  const tried: string[] = [];
  for (const e of candidates(run, ctx.rng).slice(0, SEARCH.maxCands)) {
    if (ctx.xb + SEARCH.k > SEARCH.perRun || performance.now() - t0 > SEARCH.perDecisionMs) break;
    const r = trial(run, e, seeds, ctx);
    tried.push(`${e.name} ${r.w}/${SEARCH.k}`);
    if (r.w > best.w || (r.w === best.w && r.hp > best.hp + 0.05)) best = { e, ...r };
  }
  if (best.e) best.e.f(run);
  ctx.log.add('search', `${t} 지금 ${base.w}/${SEARCH.k} → ${best.e ? best.e.name : '그대로'} ${best.w}/${SEARCH.k}`, base.w, best.w, tried);
  ctx.xms += performance.now() - t0;
}

// ───────── 3단계 search3: 선별 탐색 — 중요한 판단에만 예산을 쓴다
//   대상: 보스전 (지금 편성이 k 승이 아니면) · 역경 · 도전 (k/2 승 이하) · 일반 전투는 '큰 편성 전환 직후'(다중 교체가 일어난 뒤 첫 전투)이거나
//   평가값이 비슷한 편성 후보(임계점 후보 · 한 명 교체가 지금 편성의 SEARCH3.nearTie 안)가 있을 때만.
//   후보: 평가값이 비슷한 편성 후보(최대 3) + 앞뒤 · 좌우 뒤집기 + 대기 ↔ 출전 교체 (2단계 후보) 순으로 최대 maxCands.
export const SEARCH3 = { nearTie: 0.03, bigMax: 0.5 };
const asEvalS = (run: RunState, u: ReturnType<typeof deployed>[number]) => {
  if ((run.diff || 0) >= CFG.solventFrom) return u;
  const c = cloneUnit(u); c.items = c.items.map((x) => (x && isLocked(x) ? x : null)); return c;
};
/** 평가값이 비슷한 편성 후보 (지금 편성 V 의 nearTie 안 · 또는 더 높은데 교체 문턱에 못 미친 것) */
function nearTies(run: RunState): Edit[] {
  const dep = deployed(run).filter((u) => !R.isRock(u));
  const bench = run.units.filter((u) => !u.pos && !R.isRock(u) && R.canDeploy(run, u));
  if (!bench.length || !dep.length) return [];
  const ev = (us: typeof dep) => teamEval(run, us.map((x) => asEvalS(run, x))).v;
  const v0 = ev(dep);
  const cands: { name: string; team: typeof dep; v: number }[] = thresholdCands(run, dep, bench, ev).map((c) => ({ ...c, v: ev(c.team) }));
  for (const i of bench) for (const o of dep) { const t = dep.map((x) => (x === o ? i : x)); cands.push({ name: `교체 ${o.defId}→${i.defId}`, team: t, v: ev(t) }); }
  return cands.filter((c) => c.v >= v0 * (1 - SEARCH3.nearTie)).sort((a, b) => b.v - a.v).slice(0, 3).map((c) => {
    const outs = dep.filter((u) => !c.team.includes(u)).map((u) => u.uid), ins = c.team.filter((u) => !dep.includes(u)).map((u) => u.uid);
    return { name: `편성 ${c.name}`, f: (r: RunState) => { ins.forEach((uid, k) => { const a = byUid(r, uid), b = byUid(r, outs[k]); a.pos = b.pos; b.pos = null; }); } };
  });
}
export function search3(ctx: SearchCtx, bigSwitch: boolean): 'skip' | 'done' {
  const { run } = ctx;
  const t = run.node?.type;
  if (!run.node?.enc || ctx.xb >= SEARCH.perRun) return 'skip';
  const big = t === 'adversity' || t === 'boss' || t === 'challenge';
  const ties = nearTies(run);
  if (!big && !bigSwitch && !ties.length) return 'skip'; // 일반 전투: 큰 전환 직후 · 비슷한 후보가 있을 때만
  const t0 = performance.now();
  const seeds = Array.from({ length: SEARCH.k }, () => ctx.rng.int(1, 2147483646));
  const base = trial(run, null, seeds, ctx);
  const enough = t === 'boss' ? base.w === SEARCH.k : big ? base.w / SEARCH.k > SEARCH3.bigMax : base.w / SEARCH.k >= SEARCH.normalBelow;
  if (enough) { ctx.xms += performance.now() - t0; return 'done'; }
  let best: { e: Edit | null; w: number; hp: number } = { e: null, ...base };
  const tried: string[] = [];
  const cands = [...ties, ...candidates(run, ctx.rng).filter((e) => !e.name.startsWith('무작위') || t === 'boss')];
  for (const e of cands.slice(0, SEARCH.maxCands)) {
    if (ctx.xb + SEARCH.k > SEARCH.perRun || performance.now() - t0 > SEARCH.perDecisionMs) break;
    const r = trial(run, e, seeds, ctx);
    tried.push(`${e.name} ${r.w}/${SEARCH.k}`);
    if (r.w > best.w || (r.w === best.w && r.hp > best.hp + 0.05)) best = { e, ...r };
  }
  if (best.e) best.e.f(run);
  ctx.log.add('search', `${t}${bigSwitch ? ' (전환 직후)' : ''}${ties.length ? ` (비슷한 후보 ${ties.length})` : ''} 지금 ${base.w}/${SEARCH.k} → ${best.e ? best.e.name : '그대로'} ${best.w}/${SEARCH.k}`, base.w, best.w, tried);
  ctx.xms += performance.now() - t0;
  return 'done';
}
