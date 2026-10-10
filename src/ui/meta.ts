// 도감 · 기록 (런 사이에 유지되는 데이터). 이 브라우저의 localStorage 에만 저장된다.
import { MAX_DIFF } from '../data/difficulty';
import type { Battle } from '../engine/combat';
import type { RunState } from '../types';

export interface Meta {
  v: 1;
  maxDiff: number; // 해금된 최고 난이도
  runs: number;
  clears: number;
  bestPhase: number;
  units: Record<string, { runs: number; ranks: number; best: number; clears: number }>;
  enemies: Record<string, { seen: number; kills: number }>;
  events: Record<string, number>;
  fields: Record<string, { runs: number; clears: number; bestDiff: number }>;
}

const KEY = 'errantes.meta.v1';
const blank = (): Meta => ({ v: 1, maxDiff: 0, runs: 0, clears: 0, bestPhase: 0, units: {}, enemies: {}, events: {}, fields: {} });

let cache: Meta | null = null;
export function loadMeta(): Meta {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch { cache = blank(); }
  return cache!;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 저장 불가 환경: 이번 세션에만 유지 */ }
}

/** 전투 1회: 만난 적 · 처치한 적 */
export function metaBattle(b: Battle) {
  const m = loadMeta();
  for (const u of b.units) {
    if (u.side !== 1) continue;
    const e = (m.enemies[u.defId] ||= { seen: 0, kills: 0 });
    e.seen++;
    if (!u.alive) e.kills++;
  }
  save();
}
export function metaEvent(id: string) {
  const m = loadMeta();
  m.events[id] = (m.events[id] || 0) + 1;
  save();
}
/** 의뢰 성공 (목표 페이즈 보스 격파): 다음 난이도 해금 */
export function metaClear(run: RunState) {
  const m = loadMeta();
  m.clears++;
  const f = (m.fields[run.field] ||= { runs: 0, clears: 0, bestDiff: -1 });
  f.clears++;
  f.bestDiff = Math.max(f.bestDiff, run.diff);
  if (run.diff >= m.maxDiff) m.maxDiff = Math.min(MAX_DIFF, run.diff + 1);
  for (const id of run.usedIds) (m.units[id] ||= { runs: 0, ranks: 0, best: 0, clears: 0 }).clears++;
  save();
}
/** 런 종료 (전멸 또는 의뢰 완료 후 귀환): 기용 횟수 · 누적 공명 등급 */
export function metaRunEnd(run: RunState) {
  if (run.recorded) return;
  run.recorded = true;
  const m = loadMeta();
  m.runs++;
  m.bestPhase = Math.max(m.bestPhase, run.phase);
  (m.fields[run.field] ||= { runs: 0, clears: 0, bestDiff: -1 }).runs++;
  for (const id of run.usedIds) {
    const u = (m.units[id] ||= { runs: 0, ranks: 0, best: 0, clears: 0 });
    const r = run.rankLog[id] || 1;
    u.runs++;
    u.ranks += r;
    u.best = Math.max(u.best, r);
  }
  save();
}
