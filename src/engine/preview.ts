// 개전 예측 (편성 화면 기물 상세): 실제 전투와 같은 시드 · 배치로 전투 첫 몇 초를 미리 돌려
// 기물마다 예상 이동 경로 · 이동 중 멈춘 칸(병목) · 첫 공격 목표를 뽑는다. 전투는 시드가 같으면 같은 결과라 '예상'이 실제 시작과 맞는다.
// (편성 · 장비가 바뀌면 다시 계산 — key 로 캐시)
import { CFG } from '../config';
import type { Encounter, RunState } from '../types';
import { buildBattle, deployed, enemyCell } from './build';

export interface StartPreview {
  /** 지나간 칸 (시작 칸 포함, 첫 공격 전까지) */
  path: { x: number; y: number; t: number }[];
  /** 이동하려 했지만 PREV.wait 초 이상 멈춘 칸 (첫 공격 전) */
  waits: { x: number; y: number; t: number; dur: number }[];
  /** 첫 공격 대상 (조우의 적 번호 · 이름 · 시작 칸) 과 그 시각. 창 안에 공격하지 못하면 마지막으로 노린 대상 */
  target?: { enemy: number; name: string; x: number; y: number };
  firstAtk?: number;
}
const PREV = { secs: 8, wait: 0.6 };

let cacheKey = '', cache: Map<string, StartPreview> = new Map();

export function startPreview(run: RunState, enc: Encounter): Map<string, StartPreview> {
  const key = JSON.stringify([enc.seed, enc.n, run.units.map((u) => [u.uid, u.pos, u.items, u.mod, u.rank, u.augments.length]), run.summonPos, run.turretPos, run.globals.length]);
  if (key === cacheKey) return cache;
  const out = new Map<string, StartPreview>();
  try {
    const b = buildBattle(run, enc, true);
    // 적 CUnit → 조우의 적 번호 (시작 칸으로 맞춘다)
    const foeIdx = new Map<number, number>(), foeAt = new Map<number, { x: number; y: number }>(); // 적 시작 칸 (편성 화면의 적 카드 자리)
    for (const e of b.units) if (e.side === 1) {
      const i = enc.enemies.findIndex((s, k) => { const c = enemyCell(s.c, s.row, enc.n); return c.x === e.x && c.y === e.y && ![...foeIdx.values()].includes(k); });
      if (i >= 0) foeIdx.set(e.id, i);
      foeAt.set(e.id, { x: e.x, y: e.y });
    }
    const allies = b.units.filter((u) => u.side === 0 && u.src && deployed(run).includes(u.src));
    const st = new Map(allies.map((u) => [u.id, { p: { path: [{ x: u.x, y: u.y, t: 0 }], waits: [] } as StartPreview, still: 0, done: false }]));
    while (!b.over && b.t < PREV.secs) {
      b.step(CFG.tick);
      for (const ev of b.events) {
        if (ev.k !== 'atk') continue;
        const s = st.get(ev.from);
        if (!s || s.done) continue;
        const t = b.units.find((x) => x.id === ev.to);
        s.done = true; s.p.firstAtk = b.t;
        if (t && t.side === 1) s.p.target = { enemy: foeIdx.get(t.id) ?? -1, name: t.name, ...(foeAt.get(t.id) || { x: t.x, y: t.y }) };
      }
      b.events.length = 0;
      for (const u of allies) {
        const s = st.get(u.id)!;
        if (s.done || !u.alive) continue;
        const last = s.p.path[s.p.path.length - 1];
        if (u.x !== last.x || u.y !== last.y) {
          if (s.still >= PREV.wait) s.p.waits.push({ x: last.x, y: last.y, t: b.t - s.still, dur: s.still });
          s.still = 0;
          s.p.path.push({ x: u.x, y: u.y, t: b.t });
        } else if (!u.immobile) s.still += CFG.tick;
      }
    }
    for (const u of allies) {
      const s = st.get(u.id)!;
      if (!s.done && s.still >= PREV.wait) { const l = s.p.path[s.p.path.length - 1]; s.p.waits.push({ x: l.x, y: l.y, t: b.t - s.still, dur: s.still }); }
      if (!s.p.target && u.target?.alive && u.target.side === 1) s.p.target = { enemy: foeIdx.get(u.target.id) ?? -1, name: u.target.name, ...(foeAt.get(u.target.id) || { x: u.target.x, y: u.target.y }) };
      out.set(u.src!.uid, s.p);
    }
  } catch { /* 미리보기는 실패해도 편성은 그대로 */ }
  cacheKey = key; cache = out;
  return out;
}
