// 주요 능력치 가치 측정 (분석 전용, tests/balance.ts 옵션 `statval[=확률]`).
//   역경 · 보스 전투 직전 (확률 p 로 골라, 기본 0.3) 런을 복제해 같은 조우 (진짜 전투 시드 대신 봇 자체 난수 시드 4개) 를 상태마다 싸워 본다 (공통 난수).
//   상태 = 그대로 · 출전 전원 주요 능력치 s +TEAM_ADD (5종 각각) · 출전 기물 2명 (무작위) 에게 s +UNIT_ADD (5종 각각, 전투 유형별 가치용)
//          · 크레딧 사다리 (16 · 32 · 64 크레딧을 공명도 구매에 씀, tests/pilval.ts spendXp — 크레딧 환산 기준).
//   기록 [이긴 수, 아군 남은 체력 비율 합, 적 남은 체력 비율 합]. 원래 런 · 봇 난수 · 진짜 전투 시드는 건드리지 않는다.
import { buildBattle, deployed } from '../src/engine/build';
import * as R from '../src/engine/run';
import type { Rng } from '../src/rng';
import { MAJORS, type Encounter, type Major, type NodeType, type RunState } from '../src/types';
import { UNIT_BY_ID } from '../src/data/units';
import { PV_LADDER, spendXp } from './pilval';

export const TEAM_ADD = 5, UNIT_ADD = 10, SV_SEEDS = 4;
type Res = [number, number, number];
export interface SVRec {
  ph: number; t: NodeType; n: number;
  /** 출전 기물 [기물 id, 전투 유형, 공명 등급] */
  dep: [string, string, number][];
  base: Res;
  /** [상태 이름 (team:<s> · unit:<기물 id>:<s> · cr:<K>), 결과] */
  v: [string, Res][];
}

function fight(st: RunState, type: NodeType, enc: Encounter, seeds: number[]): Res {
  const res: Res = [0, 0, 0];
  for (const s of seeds) {
    const r = structuredClone(st);
    const e = { ...structuredClone(enc), seed: s };
    r.node = { type, enc: e };
    const b = buildBattle(r, e, false);
    b.runToEnd();
    const side = (sd: 0 | 1) => b.units.filter((u) => u.side === sd && !u.isSummon && !u.mem.inert);
    const frac = (us: typeof b.units) => { const m = us.reduce((a, u) => a + u.st.maxHp, 0); return m > 0 ? us.reduce((a, u) => a + (u.alive ? Math.max(0, u.hp) : 0), 0) / m : 0; };
    if (b.winner === 0) res[0]++;
    res[1] += frac(side(0)); res[2] += frac(side(1));
  }
  return res.map((x) => Math.round(x * 1000) / 1000) as Res;
}

export function statValue(run: RunState, rng: Rng, p = 0.3): SVRec | null {
  const t = run.node?.type, enc = run.node?.enc;
  if (!enc || (t !== 'adversity' && t !== 'boss') || !rng.chance(p)) return null;
  const dep = deployed(run).filter((u) => !R.isRock(u));
  if (!dep.length) return null;
  const seeds = Array.from({ length: SV_SEEDS }, () => rng.int(1, 2147483646));
  const rec: SVRec = { ph: run.phase, t, n: seeds.length, dep: dep.map((u) => [u.defId, UNIT_BY_ID[u.defId].ctype, u.rank]), base: fight(run, t, enc, seeds), v: [] };
  const add = (r: RunState, uids: string[], s: Major, k: number) => { for (const u of r.units) if (uids.includes(u.uid)) u.perm[s] += k; };
  for (const s of MAJORS) { const r = structuredClone(run); add(r, dep.map((u) => u.uid), s, TEAM_ADD); rec.v.push([`team:${s}`, fight(r, t, enc, seeds)]); }
  for (const u of rng.sample(dep, Math.min(2, dep.length))) for (const s of MAJORS) {
    const r = structuredClone(run); add(r, [u.uid], s, UNIT_ADD); rec.v.push([`unit:${u.defId}:${s}`, fight(r, t, enc, seeds)]);
  }
  for (const k of PV_LADDER) { const r = structuredClone(run); if (spendXp(r, k)) rec.v.push([`cr:${k}`, fight(r, t, enc, seeds)]); }
  return rec;
}
