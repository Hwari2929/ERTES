// 철수 봇: 출전 편성 (대기 ↔ 출전 교체) · 배치 (적 위치 · 주력 보호) · 영입 · 계약 기물 선택.
import { CFG } from '../../src/config';
import { ENEMY_BY_ID } from '../../src/data/enemies';
import { isLocked } from '../../src/data/items';
import { UNIT_BY_ID } from '../../src/data/units';
import { deployed } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import type { RunState, UnitState } from '../../src/types';
import { cloneUnit, isFront, teamEval } from './eval';
import type { DLog } from './log';

export const FORM = {
  swapGain: 0.03, // 교체는 팀 가치가 이만큼 (상대) 올라야 한다 (잦은 교체 방지)
  maxSwaps: 4,
};

/** 편성 평가용 기물: 위험 7 미만은 장비를 무료로 옮길 수 있으므로 일반 장비를 뺀 상태로 비교한다 (장비는 편성 뒤 장비 계획이 다시 나눈다) */
const asEval = (run: RunState, u: UnitState) => {
  if ((run.diff || 0) >= CFG.solventFrom) return u;
  const c = cloneUnit(u);
  c.items = c.items.map((x) => (x && isLocked(x) ? x : null));
  return c;
};
const freeCell = (run: RunState): { c: number; r: number } | null => {
  const used = new Set(deployed(run).map((u) => `${u.pos!.c},${u.pos!.r}`));
  for (const r of [0, 1, 2]) for (const c of [3, 2, 4, 1, 5, 0, 6]) if (!used.has(`${c},${r}`)) return { c, r };
  return null;
};

/** 출전 편성: 빈 자리 채우기 → 교체 (팀 가치 V 가 FORM.swapGain 이상 오를 때만). 반려 돌은 그대로 둔다 */
export function formation(run: RunState, log: DLog, extraBench: UnitState[] = [], bias?: (us: UnitState[]) => number): number {
  const cap = R.deployCap(run);
  const ev = (us: UnitState[]) => teamEval(run, us.filter((u) => !R.isRock(u)).map((u) => asEval(run, u))).v * (bias ? bias(us) : 1); // bias: 2단계 build 영역 (대표 빌드 가중)
  const bench = () => [...run.units.filter((u) => !u.pos && R.canDeploy(run, u) && !R.isRock(u)), ...extraBench.filter((u) => !u.pos)];
  let cur = deployed(run);
  // 1. 빈 자리
  while (cur.length < cap) {
    const b = bench();
    if (!b.length) break;
    const sc = b.map((u) => ({ u, v: ev([...cur, u]) })).sort((p, q) => q.v - p.v);
    const cell = freeCell(run);
    if (!cell) break;
    sc[0].u.pos = cell;
    log.add('form', `출전 ${sc[0].u.defId}`, ev(cur), sc[0].v, sc.slice(1, 3).map((x) => `${x.u.defId} ${Math.round(x.v)}`));
    cur = deployed(run);
  }
  // 2. 교체
  let swaps = 0;
  for (let k = 0; k < FORM.maxSwaps; k++) {
    const b = bench();
    if (!b.length) break;
    const v0 = ev(cur);
    const opts: { i: UnitState; o: UnitState; v: number }[] = [];
    for (const i of b) for (const o of cur) if (!R.isRock(o)) opts.push({ i, o, v: ev(cur.map((x) => (x === o ? i : x))) });
    opts.sort((p, q) => q.v - p.v);
    const best = opts[0];
    if (!best || best.v < v0 * (1 + FORM.swapGain)) break;
    best.i.pos = best.o.pos; best.o.pos = null;
    swaps++;
    log.add('form', `교체 ${best.o.defId}→${best.i.defId}`, v0, best.v, opts.slice(1, 4).map((x) => `${x.o.defId}→${x.i.defId} ${Math.round(x.v)}`));
    cur = deployed(run);
  }
  return swaps;
}

/** 배치: 전열(근접 · 돌격가 · 앞줄 기물)은 유효 체력 높은 순으로 적 무게중심 열 가까이 앞줄, 나머지는 주력(초당 피해 높은 순)을 무게중심 뒷줄에.
 *  암살형 적이 있으면 주력을 전열 바로 뒤 열에 두고 뒷줄 가장자리를 비운다. 적 정보는 편성 화면에서 보이는 조우(run.node.enc)만 쓴다 */
export function place(run: RunState, log: DLog) {
  const enc = run.node?.enc;
  if (!enc) return;
  const n = enc.n;
  const dep = deployed(run);
  const rock = dep.filter((u) => R.isRock(u));
  const us = dep.filter((u) => !R.isRock(u));
  const t = teamEval(run, us);
  let wsum = 0, csum = 0, assassin = 0;
  for (const s of enc.enemies) {
    const d = ENEMY_BY_ID[s.defId];
    if (!d || d.inert) continue;
    const w = d.tier === 'boss' ? 3 : d.tier === 'elite' || s.elite ? 1.5 : 1;
    wsum += w; csum += w * Math.min(s.c, n - 1);
    if (d.tend === 'assassin') assassin++;
  }
  const cx = wsum ? csum / wsum : (n - 1) / 2;
  const cols = [...Array(n).keys()].sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx) || a - b);
  const fronts = us.filter((u) => isFront(u)).sort((a, b) => t.per.get(b.uid)!.ehp - t.per.get(a.uid)!.ehp);
  const backs = us.filter((u) => !isFront(u)).sort((a, b) => t.per.get(b.uid)!.off + 20 * t.per.get(b.uid)!.heal - (t.per.get(a.uid)!.off + 20 * t.per.get(a.uid)!.heal));
  const used = new Set<string>();
  const put = (u: UnitState, rows: number[], order: number[]) => {
    for (const r of rows) for (const c of order) if (!used.has(`${c},${r}`)) { used.add(`${c},${r}`); u.pos = { c, r }; return; }
  };
  for (const u of fronts) put(u, [2, 1, 0], cols);
  // 주력 보호: 암살형이 있으면 뒷줄 대신 가운데 줄부터 (전열 바로 뒤)
  for (const u of backs) put(u, assassin ? [1, 0, 2] : [0, 1, 2], cols);
  for (const u of rock) put(u, [0, 1, 2], cols.slice().reverse());
  log.add('place', `중심 열 ${cx.toFixed(1)}${assassin ? ` · 암살형 ${assassin}` : ''} · 전열 ${fronts.map((u) => u.defId).join(',')} · 주력 ${backs.slice(0, 2).map((u) => u.defId).join(',')}`, t.v, t.v, []);
}

/** 영입: 후보마다 '영입 뒤 가능한 최선의 출전 편성' 팀 가치를 비교 (영입 등급 = recruitRank, 문장 등 바뀐 소속 반영) */
export function pickRecruit(run: RunState, options: string[], log: DLog, tie: (id: string) => number): string {
  const cap = R.deployCap(run);
  const rank = R.recruitRank(run);
  const pool0 = run.units.filter((u) => R.canDeploy(run, u) && !R.isRock(u));
  const best = (pool: UnitState[]) => {
    // 탐욕: 가치가 큰 기물부터 cap 명, 그다음 한 번 교체 개선
    let team: UnitState[] = [];
    const left = pool.slice();
    while (team.length < cap && left.length) {
      const sc = left.map((u) => ({ u, v: teamEval(run, [...team, u].map((x) => asEval(run, x))).v })).sort((p, q) => q.v - p.v);
      team.push(sc[0].u); left.splice(left.indexOf(sc[0].u), 1);
    }
    let v = teamEval(run, team.map((x) => asEval(run, x))).v;
    for (const i of left) for (const o of team) {
      const t2 = team.map((x) => (x === o ? i : x));
      const v2 = teamEval(run, t2.map((x) => asEval(run, x))).v;
      if (v2 > v) { v = v2; team = t2; }
    }
    return v;
  };
  const base = best(pool0);
  const sc = options.map((id) => {
    const d = UNIT_BY_ID[id];
    const u: UnitState = { uid: 'cand', defId: id, rank, xp: 0, alloc: { vit: rank - 1, pow: rank - 1, mnd: rank - 1, def: rank - 1, agi: rank - 1 }, perm: { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 }, augments: [], items: [d.item || null, null, null], mod: null, pos: null, faith: d.faith, grow: {} };
    return { id, v: d.inert ? 0 : best([...pool0, u]) + tie(id) * 1e-6 };
  }).sort((p, q) => q.v - p.v);
  log.add('recruit', `영입 ${sc[0].id}`, base, sc[0].v, sc.slice(1).map((x) => `${x.id} ${Math.round(x.v)}`));
  return sc[0].id;
}

/** 계약 기물: 후보 풀에서 CFG.startUnits 명 조합을 모두 비교 (시작 상태 팀 가치 + 시너지 · 전열 구성). 전장은 newRun 과 같다 */
export function pickStarters(seed: number, pool: string[], field: string | undefined, diff: number, log: DLog | null): string[] {
  const k = CFG.startUnits;
  const combos: string[][] = [];
  const rec = (i: number, cur: string[]) => { if (cur.length === k) { combos.push(cur.slice()); return; } for (let j = i; j < pool.length; j++) { cur.push(pool[j]); rec(j + 1, cur); cur.pop(); } };
  rec(0, []);
  const sc = combos.map((c) => {
    const run = R.newRun(seed, c, field, diff);
    run.pending = [];
    const t = teamEval(run, deployed(run));
    return { c, v: t.v };
  }).sort((p, q) => q.v - p.v);
  log?.add('start', `계약 ${sc[0].c.join(',')}`, sc[sc.length - 1].v, sc[0].v, sc.slice(1, 4).map((x) => `${x.c.join(',')} ${Math.round(x.v)}`));
  return sc[0].c;
}
