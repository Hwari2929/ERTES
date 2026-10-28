// 개전 예측 (편성 화면 기물 · 적 상세): 실제 전투와 같은 시드 · 배치로 전투 첫 몇 초를 미리 돌려
// 아군 기물 · 적마다 예상 이동 경로 · 이동 중 멈춘 칸(병목) · 첫 공격 목표를 뽑는다. 전투는 시드가 같으면 같은 결과라 '예상'이 실제 시작과 맞는다.
// (전투에 들어가는 것이 하나라도 바뀌면 다시 계산 — previewKey 로 캐시)
import { CFG } from '../config';
import type { Encounter, RunState } from '../types';
import { buildBattle, deployed, encGeo, foeCell } from './build';

export interface StartPreview {
  /** 지나간 칸 (시작 칸 포함, 첫 공격 전까지) */
  path: { x: number; y: number; t: number }[];
  /** 이동하려 했지만 PREV.wait 초 이상 멈춘 칸 (첫 공격 전) */
  waits: { x: number; y: number; t: number; dur: number }[];
  /** 첫 공격 대상 (이름 · 시작 칸, 적이면 조우의 적 번호) 과 그 시각. 창 안에 공격하지 못하면 마지막으로 노린 대상 */
  target?: { enemy?: number; name: string; x: number; y: number };
  firstAtk?: number;
}
const PREV = { secs: 8, wait: 0.6 };
/** 미리 돌리는 시간 (초): 화면 문구도 이 값을 읽는다 */
export const PREVIEW_SECS = PREV.secs;

/** 캐시 키: buildBattle 이 읽는 것 전부 — 조우 전체 (적 · 벗긴 장비 · 장치 · 지형 틀 · 시드) + 런 전체 (기물 · 배치 · 소환물 · 포탑 · 전역 증강 · 서약 · 플래그 …).
 *  골라 담으면 빠뜨린 값(예: 편성 화면에 놓은 장치)이 바뀌어도 낡은 예측을 보여 주므로 통째로 직렬화한다 (조우는 run.node 에서 한 번만) */
export function previewKey(run: RunState, enc: Encounter): string {
  const node = run.node && { ...run.node, enc: run.node.enc === enc ? undefined : run.node.enc };
  return JSON.stringify([enc, { ...run, node }]);
}

let cacheKey = '', cache: Map<string, StartPreview> = new Map();

/** 결과 맵의 적 키: 조우의 적 번호 (아군은 기물 uid) */
export const foeKey = (i: number) => `foe:${i}`;

export function startPreview(run: RunState, enc: Encounter): Map<string, StartPreview> {
  if (previewKey(run, enc) === cacheKey) return cache;
  const out = new Map<string, StartPreview>();
  try {
    const b = buildBattle(run, enc, true);
    // 적 CUnit → 조우의 적 번호 (시작 칸으로 맞춘다)
    const foeIdx = new Map<number, number>(), startAt = new Map<number, { x: number; y: number }>(); // 시작 칸 (편성 화면의 카드 자리 — 첫 목표 표시는 여기에)
    for (const e of b.units) if (e.side === 1) {
      const i = enc.enemies.findIndex((s, k) => { const c = foeCell(s, encGeo(enc)); return c.x === e.x && c.y === e.y && ![...foeIdx.values()].includes(k); });
      if (i >= 0) foeIdx.set(e.id, i);
    }
    for (const u of b.units) startAt.set(u.id, { x: u.x, y: u.y });
    const allies = b.units.filter((u) => u.side === 0 && u.src && deployed(run).includes(u.src));
    const foes = b.units.filter((e) => foeIdx.has(e.id));
    const movers = [...allies, ...foes];
    const tgtOf = (t: { id: number; name: string; x: number; y: number; side: number }) => ({ ...(t.side === 1 ? { enemy: foeIdx.get(t.id) ?? -1 } : {}), name: t.name, ...(startAt.get(t.id) || { x: t.x, y: t.y }) });
    const st = new Map(movers.map((u) => [u.id, { p: { path: [{ x: u.x, y: u.y, t: 0 }], waits: [] } as StartPreview, still: 0, done: false }]));
    while (!b.over && b.t < PREV.secs) {
      b.step(CFG.tick);
      for (const ev of b.events) {
        if (ev.k !== 'atk') continue;
        const s = st.get(ev.from);
        if (!s || s.done) continue;
        const t = b.units.find((x) => x.id === ev.to);
        s.done = true; s.p.firstAtk = b.t;
        const mine = b.units.find((x) => x.id === ev.from);
        if (t && mine && t.side !== mine.side) s.p.target = tgtOf(t);
      }
      b.events.length = 0;
      for (const u of movers) {
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
    for (const u of movers) {
      const s = st.get(u.id)!;
      if (!s.done && s.still >= PREV.wait) { const l = s.p.path[s.p.path.length - 1]; s.p.waits.push({ x: l.x, y: l.y, t: b.t - s.still, dur: s.still }); }
      if (!s.p.target && u.target?.alive && u.target.side !== u.side) s.p.target = tgtOf(u.target);
      out.set(u.side === 1 ? foeKey(foeIdx.get(u.id)!) : u.src!.uid, s.p);
    }
  } catch { /* 미리보기는 실패해도 편성은 그대로 */ }
  cacheKey = previewKey(run, enc); cache = out; // 만든 뒤의 키: 만드는 중에 런에 채워지는 값이 있어도 다음 호출은 캐시를 쓴다
  return out;
}
