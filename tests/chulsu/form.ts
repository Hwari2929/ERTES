// 철수 봇: 출전 편성 (대기 ↔ 출전 교체) · 배치 (적 위치 · 주력 보호) · 영입 · 계약 기물 선택.
import { CFG } from '../../src/config';
import { ENEMY_BY_ID } from '../../src/data/enemies';
import { isLocked } from '../../src/data/items';
import { UNIT_BY_ID } from '../../src/data/units';
import { deployed, memberships, synergyCounts } from '../../src/engine/build';
import { SYNERGIES } from '../../src/data/synergies';
import { effTier, inactiveRange } from './syn';
import * as R from '../../src/engine/run';
import type { RunState, UnitState } from '../../src/types';
import { cloneUnit, isFront, teamEval } from './eval';
import type { DLog } from './log';

export const FORM = {
  swapGain: 0.03, // 교체는 팀 가치가 이만큼 (상대) 올라야 한다 (잦은 교체 방지)
  maxSwaps: 4,
  multiMax: 4, // 3단계 multi: 임계점 후보에서 한꺼번에 바꾸는 최대 인원 (출항기 단독 → 완전체 = 4명)
};

/** 3단계 multi: 임계점 편성 후보 — 한 명씩 바꾸는 탐욕 편성이 못 보는 '여러 명을 함께 바꿔야 켜지는 효과'.
 *  시너지마다 (실제 소속: 문장 · 증강 소속 · 전역 증강 +1 포함, synergyCounts)
 *   - 완성: 다음 효과 단계까지 모자란 k명(≤ multiMax)을 대기 기물에서 넣고, 비구성원 중 빼도 가치가 가장 덜 줄어드는 k명을 뺀다
 *   - 단독 유지: 비활성 구간(예: 출항기 2~4명)이면 구성원 1명만 남기고 나머지를 비구성원 대기 기물로 바꾼다
 *  ev = 팀 가치 함수 (편성 · 영입 · 방출이 같은 함수). 돌려주는 후보는 지금 팀과 같은 인원 */
export function thresholdCands(run: RunState, cur: UnitState[], bench: UnitState[], ev: (us: UnitState[]) => number, only?: Set<string>): { name: string; team: UnitState[] }[] {
  const out: { name: string; team: UnitState[] }[] = [];
  if (!cur.length) return out;
  const counts = synergyCounts(cur, run) as Record<string, number>;
  const mem = new Map<UnitState, string[]>();
  const memOf = (u: UnitState) => { let m = mem.get(u); if (!m) { m = memberships(u, run); mem.set(u, m); } return m; };
  const curIds = new Set(cur.map((u) => u.defId));
  const lossOrder = (pool: UnitState[]) => pool.map((u) => ({ u, v: ev(cur.filter((x) => x !== u)) })).sort((a, b) => b.v - a.v).map((x) => x.u); // 빼도 가치가 가장 높게 남는 순
  let lossCache: UnitState[] | null = null;
  const losers = () => (lossCache ??= lossOrder(cur.filter((u) => !R.isRock(u))));
  for (const s of SYNERGIES) {
    if (s.tiers.length < 2 || s.id === 'KING' || (only && !only.has(s.id))) continue;
    const c = counts[s.id] || 0;
    const bS = bench.filter((u) => memOf(u).includes(s.id) && !curIds.has(u.defId));
    // 완성: 지금보다 높은 다음 효과 단계 (출항기: 2~4명이면 5명)
    const t0 = effTier(s.id, c);
    const next = s.tiers.map((n) => n).find((n) => n > c && effTier(s.id, n) > t0) ?? (s.id === 'VOYAGE' && c < 5 ? 5 : undefined);
    if (next !== undefined) {
      const k = next - c;
      const uniq = [...new Map(bS.map((u) => [u.defId, u])).values()];
      if (k >= 2 && k <= FORM.multiMax && uniq.length >= k) { // k = 1 은 한 명 교체가 이미 본다
        const ins = uniq.map((u) => ({ u, v: ev([...cur, u]) })).sort((a, b) => b.v - a.v).slice(0, k).map((x) => x.u);
        const outs = losers().filter((u) => !memOf(u).includes(s.id)).slice(0, k);
        if (outs.length === k) out.push({ name: `완성 ${s.id} ${c}→${next}`, team: [...cur.filter((u) => !outs.includes(u)), ...ins] });
      }
    }
    // 단독 유지 (비활성 구간): 구성원 1명만 남긴다
    if (inactiveRange(s.id, c) && effTier(s.id, 1) > 0) {
      const ms = cur.filter((u) => memOf(u).includes(s.id));
      const nonS = bench.filter((u) => !memOf(u).includes(s.id) && !curIds.has(u.defId));
      const keep = ms.map((u) => ({ u, v: ev(cur.filter((x) => !ms.includes(x) || x === u)) })).sort((a, b) => b.v - a.v)[0]?.u;
      const drop = ms.filter((u) => u !== keep);
      if (keep && drop.length <= nonS.length) {
        const ins: UnitState[] = [];
        let team = cur.filter((u) => !drop.includes(u));
        for (let i = 0; i < drop.length; i++) {
          const best = nonS.filter((u) => !ins.includes(u)).map((u) => ({ u, v: ev([...team, u]) })).sort((a, b) => b.v - a.v)[0];
          if (!best) break;
          ins.push(best.u); team = [...team, best.u];
        }
        if (ins.length === drop.length) out.push({ name: `단독 ${s.id} ${c}→1 (${keep.defId})`, team });
      }
    }
  }
  return out;
}

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
export function formation(run: RunState, log: DLog, extraBench: UnitState[] = [], bias?: (us: UnitState[]) => number, multi = false, onMulti?: (name: string) => void): number {
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
  // 2. 임계점 다중 교체 (3단계 multi): 지금 · 완성 · 단독 유지 후보를 함께 비교
  if (multi) {
    const v0 = ev(cur);
    const cands = thresholdCands(run, cur, bench(), ev).map((c) => ({ ...c, v: ev(c.team) })).sort((a, b) => b.v - a.v);
    const best = cands[0];
    if (best && best.v >= v0 * (1 + FORM.swapGain)) {
      const outs = cur.filter((u) => !best.team.includes(u)), ins = best.team.filter((u) => !cur.includes(u));
      ins.forEach((u, i) => { u.pos = outs[i].pos; outs[i].pos = null; });
      log.add('form', `다중 교체 ${best.name}: ${outs.map((u) => u.defId).join(',')}→${ins.map((u) => u.defId).join(',')}`, v0, best.v, cands.slice(1, 4).map((x) => `${x.name} ${Math.round(x.v)}`));
      onMulti?.(best.name);
      cur = deployed(run);
    } else if (cands.length) log.add('form', '다중 교체 안 함', v0, v0, cands.slice(0, 3).map((x) => `${x.name} ${Math.round(x.v)}`));
  }
  // 3. 교체
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
export function place(run: RunState, log: DLog, bossRule = false) {
  const enc = run.node?.enc;
  if (!enc) return;
  const n = enc.n;
  const dep = deployed(run);
  const rock = dep.filter((u) => R.isRock(u));
  const us = dep.filter((u) => !R.isRock(u));
  const t = teamEval(run, us);
  let wsum = 0, csum = 0, assassin = 0;
  let boss: { c: number; tend: string } | null = null;
  for (const s of enc.enemies) {
    const d = ENEMY_BY_ID[s.defId];
    if (!d || d.inert) continue;
    const w = d.tier === 'boss' ? 3 : d.tier === 'elite' || s.elite ? 1.5 : 1;
    wsum += w; csum += w * Math.min(s.c, n - 1);
    if (d.tend === 'assassin') assassin++;
    if (d.tier === 'boss') boss = { c: Math.min(s.c, n - 1), tend: d.tend };
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
  // 3단계 boss: 보스 성향(공개 정보)별 — 저격형(피해를 많이 준 아군을 노린다, 거리 감쇠) · 돌격형은 주력을 보스 열에서 가장 먼 열 뒷줄에 (전열은 보스 열 앞).
  //   암살형(뒤쪽 · 체력 낮은 아군)은 2단계 규칙 그대로 (가운데 줄)
  const far = boss && bossRule && boss.tend !== 'assassin' ? [...Array(n).keys()].sort((a, b) => Math.abs(b - boss!.c) - Math.abs(a - boss!.c) || a - b) : null;
  // 주력 보호: 암살형이 있으면 뒷줄 대신 가운데 줄부터 (전열 바로 뒤)
  for (const u of backs) put(u, assassin ? [1, 0, 2] : [0, 1, 2], far || cols);
  for (const u of rock) put(u, [0, 1, 2], cols.slice().reverse());
  log.add('place', `중심 열 ${cx.toFixed(1)}${assassin ? ` · 암살형 ${assassin}` : ''}${far ? ` · 보스(${boss!.tend}) 열 ${boss!.c} 반대편에 주력` : ''} · 전열 ${fronts.map((u) => u.defId).join(',')} · 주력 ${backs.slice(0, 2).map((u) => u.defId).join(',')}`, t.v, t.v, []);
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
