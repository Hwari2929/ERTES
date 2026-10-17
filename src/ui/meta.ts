// 도감 · 기록 (런 사이에 유지되는 데이터). 이 브라우저의 localStorage 에만 저장된다.
import { CFG } from '../config';
import { effDiff, MAX_DIFF, runEffDiff } from '../data/difficulty';
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
  /** 전장별 기록. bestDiff = 성공한 의뢰의 최고 실효 위험 등급 (고난 + 절망 서약이면 절망 수치만큼 오른 표기 등급, data/difficulty.ts effDiff) — 업적이 읽는다 */
  fields: Record<string, { runs: number; clears: number; bestDiff: number }>;
  /** 튜토리얼: 끝까지 봄 · 건너뜀 · 본 장면과 안내 (교범 항목 해금) */
  tut?: { done?: boolean; skipped?: boolean; seen?: string[] };
  /** 에란테스 바: 본 만담 · 들은 이야기 · 직전 런 요약 (바 반응 대사 조건) */
  bar?: BarMeta;
  /** 절망 증강별 기록 (data/despair.ts): 그 증강을 건 의뢰 수 · 성공 수 (한 의뢰에 여러 개면 각각 센다) */
  despair?: Record<string, { runs: number; clears: number }>;
  /** 위험 등급 체계 판 (DIFF_SCALE). 없으면 1 = 위험 7 · 8 이 방어도 · 페이즈 체력이던 때 */
  dv?: number;
  /** 업적 (data/achievements.ts): 달성한 업적 id → 달성 날짜 (YYYY-MM-DD) */
  achieved?: Record<string, string>;
  /** 바 카운터 뒤 진열장에 놓은 업적 (최대 3개, 놓은 순서) */
  showcase?: string[];
  /** 절망 서약 (data/oaths.ts): 지금 설정 (서약 id → 단계) · 전장별 최고 절망 수치 성공 (고난 이상 의뢰 성공 때의 총 절망 수치) */
  oath?: { sel?: Record<string, number>; best?: Record<string, number> };
}
/** 직전 런 요약: 바 반응 대사가 읽는다 */
export interface BarLast { run: number; field: string; cleared: boolean; phase: number; diff: number; mvp?: string; units: string[]; newEvents: string[] }
export interface BarMeta {
  /** 본 만담 id (도감 기록) */
  seen?: string[];
  /** 들은 말 걸기 이야기 키 (도감 기록) */
  talk?: string[];
  /** 반응 대사를 들은 키 (런 번호:기물:반응) — 같은 런 결과에 같은 반응은 한 번만 */
  heard?: string[];
  last?: BarLast;
  /** 진행 중인 런: 전투 MVP 횟수 · 처음 겪은 사건 */
  cur?: { seed: number; mvp: Record<string, number>; newEv: string[] };
  /** 기물별 마지막으로 기용한 런 번호 */
  used?: Record<string, number>;
  /** 바에서 말 건 횟수 (관계: 실재 층 해금 기준의 일부) */
  bond?: Record<string, number>;
}

const KEY = 'errantes.meta.v1';
/** 위험 등급 체계 판: 2 = 위험 7 에 절망 증강을 끼워 넣어 예전 위험 7 · 8 이 8 · 9 가 됨 (data/difficulty.ts) */
const DIFF_SCALE = 2;
const blank = (): Meta => ({ v: 1, maxDiff: 0, runs: 0, clears: 0, bestPhase: 0, units: {}, enemies: {}, events: {}, fields: {}, dv: DIFF_SCALE });
/** 예전 위험 등급 기록을 지금 체계로: 조건이 같은 등급 번호는 그대로 (예전 모험 3 → 쉬움 3, 예전 고난 6 → 모험 6), 예전 위험 7 · 8 → 8 · 9 */
function migrateDiff(m: Meta) {
  for (const f of Object.values(m.fields)) if (f.bestDiff >= 7) f.bestDiff++;
  if (m.maxDiff >= 8) m.maxDiff = Math.min(MAX_DIFF, m.maxDiff + 1); // 예전 위험 7 성공 = 지금 위험 8 성공 → 9 해금
  if (m.bar?.last && m.bar.last.diff >= 7) m.bar.last.diff++;
}

/** 절망 서약 표기 위험 등급 이전의 성공 기록: 전장별 최고 절망 수치(고난 이상 성공)로 그 전장의 최고 위험 등급을 다시 잡는다 (늘리기만, 여러 번 해도 같다) */
export function oathBestDiff(m: Meta) {
  for (const [id, heat] of Object.entries(m.oath?.best || {})) {
    const f = m.fields[id];
    if (f && f.clears > 0 && heat >= 0) f.bestDiff = Math.max(f.bestDiff, effDiff(CFG.oathFrom, heat));
  }
}

let cache: Meta | null = null;
export function loadMeta(): Meta {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const p = raw ? JSON.parse(raw) : null;
    cache = p ? { ...blank(), ...p } : blank();
    if (p && !((p.dv || 1) >= DIFF_SCALE)) migrateDiff(cache!);
    cache!.dv = DIFF_SCALE;
    oathBestDiff(cache!);
  } catch { cache = blank(); }
  return cache!;
}
/** 메타 기록이 바뀔 때마다 부를 함수 (업적: 기록으로 판정하는 업적, ui/achieve.ts) */
let watch: ((m: Meta) => void) | null = null;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 저장 불가 환경: 이번 세션에만 유지 */ }
  watch?.(cache!);
}
export function metaWatch(fn: (m: Meta) => void) { watch = fn; }
/** 업적 달성 기록: 처음 달성한 id 만 날짜와 함께 남기고 그 목록을 돌려준다 */
export function metaAchieve(ids: string[], date: string): string[] {
  const m = loadMeta();
  const got = (m.achieved ||= {});
  const fresh = ids.filter((id) => !got[id]);
  if (!fresh.length) return [];
  for (const id of fresh) got[id] = date;
  save();
  return fresh;
}
/** 바 진열장에 놓을 업적 (달성한 것만, 최대 n개) */
export function metaShowcase(ids: string[], n: number) {
  const m = loadMeta();
  m.showcase = ids.filter((id, i) => m.achieved?.[id] && ids.indexOf(id) === i).slice(0, n);
  save();
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
export function metaEvent(id: string, seed?: number) {
  const m = loadMeta();
  if (!m.events[id] && seed !== undefined) barCur(m, seed).newEv.push(id); // 처음 겪은 사건 (바 반응)
  m.events[id] = (m.events[id] || 0) + 1;
  save();
}
const barCur = (m: Meta, seed: number) => {
  const b = (m.bar ||= {});
  if (b.cur?.seed !== seed) b.cur = { seed, mvp: {}, newEv: [] };
  return b.cur;
};
/** 전투 승리 MVP (바 반응: 직전 런 MVP) */
export function metaBarMvp(seed: number, defId: string) {
  const m = loadMeta();
  const c = barCur(m, seed);
  c.mvp[defId] = (c.mvp[defId] || 0) + 1;
  save();
}
/** 바에서 이 인물에게 말을 걸었다 */
export function metaBarBond(id: string) {
  const m = loadMeta();
  const b = ((m.bar ||= {}).bond ||= {});
  b[id] = (b[id] || 0) + 1;
  save();
}
/** 바에서 본 만담 · 들은 이야기 · 반응 대사 기록 (만담 id, 확장 틀은 '틀 id+끼어든 인물') */
export function metaBar(kind: 'seen' | 'talk' | 'heard', key: string) {
  const m = loadMeta();
  const l = ((m.bar ||= {})[kind] ||= []);
  if (l.includes(key)) return;
  l.push(key);
  if (kind === 'heard' && l.length > 400) l.splice(0, l.length - 400);
  save();
}
/** 의뢰 성공 (목표 페이즈 보스 격파): 다음 난이도 해금 */
export function metaClear(run: RunState) {
  const m = loadMeta();
  m.clears++;
  for (const id of run.despairs || []) ((m.despair ||= {})[id] ||= { runs: 0, clears: 0 }).clears++;
  const f = (m.fields[run.field] ||= { runs: 0, clears: 0, bestDiff: -1 });
  f.clears++;
  f.bestDiff = Math.max(f.bestDiff, runEffDiff(run)); // 실효 위험 등급 (절망 서약 반영, 업적 판정)
  if (run.diff >= m.maxDiff) m.maxDiff = Math.min(MAX_DIFF, run.diff + 1); // 해금은 실제 등급 기준 (서약으로 위험 8 · 9 조건이 풀리지는 않는다)
  if (run.oaths) { const b = ((m.oath ||= {}).best ||= {}); b[run.field] = Math.max(b[run.field] ?? -1, run.oathHeat || 0); } // 절망 서약 (고난 이상)
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
  for (const id of run.despairs || []) ((m.despair ||= {})[id] ||= { runs: 0, clears: 0 }).runs++;
  (m.fields[run.field] ||= { runs: 0, clears: 0, bestDiff: -1 }).runs++;
  for (const id of run.usedIds) {
    const u = (m.units[id] ||= { runs: 0, ranks: 0, best: 0, clears: 0 });
    const r = run.rankLog[id] || 1;
    u.runs++;
    u.ranks += r;
    u.best = Math.max(u.best, r);
  }
  if (!run.tutorial) { // 바 반응용 직전 런 요약
    const b = (m.bar ||= {});
    const cur = b.cur?.seed === run.seed ? b.cur : null;
    const top = (o: Record<string, number>) => Object.entries(o).sort((x, y) => y[1] - x[1])[0]?.[0];
    const used = (b.used ||= {});
    for (const id of run.usedIds) used[id] = m.runs;
    b.last = { run: m.runs, field: run.field, cleared: !!run.cleared, phase: run.phase, diff: run.diff, mvp: (cur && top(cur.mvp)) || top(run.rankLog), units: [...run.usedIds], newEvents: cur?.newEv.slice(0, 6) || [] };
    b.cur = undefined;
  }
  save();
}

// ───────── 튜토리얼 · 교범
export const tutMeta = () => loadMeta().tut || {};
/** 튜토리얼을 끝냈거나 건너뛰었는지 (교범 전체 해금) */
export const tutOver = () => !!(tutMeta().done || tutMeta().skipped);
/** 튜토리얼 장면 · 안내를 봤다 (그 키에 걸린 교범 항목이 열린다) */
export function metaTutSeen(key: string) {
  const m = loadMeta();
  const t = (m.tut ||= {});
  const seen = (t.seen ||= []);
  if (seen.includes(key)) return;
  seen.push(key);
  save();
}
/** 튜토리얼 종료: 끝까지 봤거나 (done) 건너뜀 (skipped). 어느 쪽이든 교범이 모두 열린다 */
export function metaTutEnd(kind: 'done' | 'skipped') {
  const m = loadMeta();
  const t = (m.tut ||= {});
  t[kind] = true;
  save();
}
// ───────── 절망 서약 (data/oaths.ts): 타이틀 [절망 서약] 화면의 설정 (고난 이상으로 출격할 때 런에 옮긴다)
export const oathSel = (): Record<string, number> => ({ ...(loadMeta().oath?.sel || {}) });
export function metaOath(sel: Record<string, number>) {
  const m = loadMeta();
  (m.oath ||= {}).sel = Object.fromEntries(Object.entries(sel).filter(([, n]) => n > 0));
  save();
}
