// 배치 영향 측정 (분석 전용, tests/balance.ts 옵션 `placeval[=p[:q]]`, docs/BALANCE_2026_11_01_placement.md).
//   전투 직전 (일반 전투는 확률 p, 기본 0.3 · 역경은 확률 q, 기본 0.6 · 도전 · 보스는 모두) 런을 복제해 같은 조우를 배치만 바꿔 싸운다.
//   배치 = 봇 배치 그대로 (bot) · 앞뒤 뒤집기 (fb: 줄 r → 줄 수 − 1 − r, 포탑 자리도) · 좌우 뒤집기 (lr: 열 c → 폭 − 1 − c, 포탑 자리도)
//          · 무작위 배치 PL_RAND 개 (rnd1… : 아군 진형 줄 수 × 폭 칸에 무작위).
//   시드: 모든 배치가 같은 시드 묶음 S (PL_SEEDS 개, 봇 자체 난수 — 진짜 전투 시드 아님) 로 싸운다 (공통 난수).
//   운 기준선: 봇 배치를 다른 시드 묶음 S2 로 한 번 더 (bot2). 최선 · 최악 배치: 위 배치 중 S 에서 가장 좋은 · 나쁜 것을 골라 S2 로 다시 싸운다
//   (best2 · worst2 — 고른 묶음과 다른 시드로 재야 '고르기 운'이 빠진다).
//   돌파 지표 (전투마다, 읽기만 하는 훅): 역할 = 전열 (근접 · 돌격가 · 앞줄 기물, tests/chulsu/eval.ts isFront) · 후열 (그 밖), 위치 = 시작 줄 (맨 앞줄 · 그 뒤).
//   원래 런 · 봇 난수 · 진짜 전투 시드는 건드리지 않는다 (전투 동작은 바꾸지 않고 피해 · 사망 · 위치만 읽는다).
import { buildBattle, deployed, runGeo } from '../src/engine/build';
import { Battle, type CUnit, type DmgOpts, type DmgResult, VAN_LIKE, zocCapable } from '../src/engine/combat';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { UNIT_BY_ID } from '../src/data/units';
import * as R from '../src/engine/run';
import type { Rng } from '../src/rng';
import type { Encounter, NodeType, RunState } from '../src/types';
import { isFront } from './chulsu/eval';

export const PL_SEEDS = 3, PL_RAND = 3;
/** 전투 1회 기록 열 (PL_COLS 순서) */
export const PL_COLS = ['w', 'aHp', 'eHp', 't', 'tCb', 'tCf', 'tHb', 'dB', 'cB', 'tDb', 'nDb', 'nDf', 'fd', 'pass', 'passM', 'tPass', 'zoc', 'dVan', 'tCbp', 'dBp', 'tCbpRole', 'adj',
  'yF1', 'yB1', 'tgB1', 'yF3', 'yB3', 'tgB3', 'yF6', 'yB6', 'tgB6', 'yF10', 'yB10', 'tgB10'] as const;
/** 시각별 진형 · 표적 표본 시각 (초) */
export const PL_SNAP = [1, 3, 6, 10];
//   w 승 1/0 · aHp / eHp 남은 아군 / 적 체력 비율 · t 전투 시간
//   tCb / tCf: 후열 / 전열 역할 기물이 처음 '붙은 적' (1칸 안, 지속 피해 제외) 에게 피해를 받은 시각 (-1 = 없음) · tHb: 후열 역할이 처음 적 피해를 받은 시각
//   dB: 적이 아군 기물에 준 피해 중 후열 역할 몫 · cB: 붙은 적의 피해 중 후열 역할 몫 (-1 = 붙은 피해 없음)
//   tDb: 후열 역할 첫 사망 시각 · nDb / nDf: 후열 / 전열 역할 사망 수 · fd: 첫 아군 사망이 0 없음 · 1 전열 · 2 후열
//   pass: 아군 맨 앞줄보다 뒤 (아군 진형 안쪽) 칸에 한 번이라도 들어선 적 수 (이동하는 적 · 소환물 제외, 포위 지형은 -1) · passM: 그중 근접 (사거리 1) 적 · tPass: 처음 들어선 시각
//   zoc: 돌격가 경계에 걸린 횟수 · dVan: 적 피해 중 돌격가 (돌격가처럼 포함) 몫
//   tCbp / dBp: 위치 기준 — 맨 앞줄이 아닌 칸에서 시작한 기물이 처음 붙은 적에게 피해를 받은 시각 · 적 피해 몫 · tCbpRole: 그때 맞은 기물 역할 (1 전열 · 2 후열 · 0 없음)
//   adj: 적이 아군 기물에 준 피해 중 붙은 적 (1칸 안) 의 몫 (나머지는 떨어져서 — 원거리 · 범위 · 지속 피해)
//   yF<t> / yB<t> / tgB<t> (t = PL_SNAP 초): 그 시각 살아 있는 전열 / 후열 역할 기물의 평균 깊이 (아군 맨 앞줄 = 0, 뒤로 +1, 사이 줄 · 적 진형 쪽은 음수) ·
//     이동하는 적 중 후열 역할을 표적으로 삼은 몫. 해당 기물 · 표적이 없거나 전투가 끝났으면 -9, 포위 지형은 깊이 -9
type Row = number[];
export interface PLRec {
  ph: number; t: NodeType; n: number; map: string; rows: number; sur: number; field: string;
  /** 출전: 기물 수 · 전열 역할 · 후열 역할 · 돌격가 (돌격가처럼 포함) · 근접 (사거리 1) · 반려 돌 */
  dep: [number, number, number, number, number, number];
  /** 적: 이동하는 적 수 · 그중 근접 · 성향별 수 (돌격 · 암살 · 저격 · 호위 · 교란 · 무리) · 보스 · 정예 */
  foe: [number, number, number, number, number, number, number, number, number, number];
  /** 배치 이름 → 시드마다 기록 (S 묶음) */
  v: Record<string, Row[]>;
  /** S2 묶음: 봇 배치 (운 기준선) · 최선 · 최악 (S 에서 고른 배치 이름과 S2 기록, 봇 배치가 뽑히면 bot2 와 같아 기록을 생략) */
  bot2: Row[]; best: string; worst: string; best2?: Row[]; worst2?: Row[];
  /** 실제 전투 (진짜 시드, 봇 배치) 승 1/0 — balance.ts 가 전투 뒤 채운다 */
  real?: number;
}

/** 돌격가 · 돌격가처럼 (경계를 만드는 기물) */
const isVan = (id: string) => UNIT_BY_ID[id]?.ctype === 'VAN' || VAN_LIKE.includes(id);
const TENDS = ['charge', 'assassin', 'sniper', 'escort', 'disrupt', 'pack'];
const r2 = (x: number) => Math.round(x * 100) / 100;

// ───────── 전투 계측 훅 (읽기만): cur 가 가리키는 전투에서만 기록
interface Trk {
  b: Battle;
  role: Map<CUnit, 1 | 2>; back: Set<CUnit>; van: Set<CUnit>;
  tCb: number; tCf: number; tHb: number; tDb: number; nDb: number; nDf: number; fd: number;
  dmg: number; dmgB: number; dmgVan: number; dmgBp: number; cont: number; contB: number;
  tCbp: number; tCbpRole: number;
  passY: number; mobile: Set<CUnit>; melee: Set<CUnit>; passed: Set<CUnit>; tPass: number;
  ay0: number; sur: boolean; snap: number[]; si: number;
}
let cur: Trk | null = null;
const od = Battle.prototype.dealDamage;
Battle.prototype.dealDamage = function (this: Battle, src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
  const T = cur;
  if (!T || T.b !== this) return od.call(this, src, tgt, base, o);
  const role = T.role.get(tgt), adj = o.tag !== 'dot' && this.dist(src, tgt) <= 1, foe = this.sideOf(src) === 1;
  const r = od.call(this, src, tgt, base, o);
  if (role && foe && r.amount > 0) {
    const t = this.t, bk = T.back.has(tgt);
    T.dmg += r.amount;
    if (role === 2) { T.dmgB += r.amount; if (T.tHb < 0) T.tHb = t; }
    if (T.van.has(tgt)) T.dmgVan += r.amount;
    if (bk) T.dmgBp += r.amount;
    if (adj) {
      T.cont += r.amount;
      if (role === 2) { T.contB += r.amount; if (T.tCb < 0) T.tCb = t; } else if (T.tCf < 0) T.tCf = t;
      if (bk && T.tCbp < 0) { T.tCbp = t; T.tCbpRole = role; }
    }
  }
  return r;
};
const ok = Battle.prototype.kill;
Battle.prototype.kill = function (this: Battle, u: CUnit, by: CUnit | null) {
  const T = cur;
  if (T && T.b === this && u.alive) {
    const role = T.role.get(u);
    if (role) {
      if (!T.fd) T.fd = role;
      if (role === 2) { T.nDb++; if (T.tDb < 0) T.tDb = this.t; } else T.nDf++;
    }
  }
  return ok.call(this, u, by);
};
const os = Battle.prototype.step;
Battle.prototype.step = function (this: Battle, dt: number) {
  os.call(this, dt);
  const T = cur;
  if (!T || T.b !== this) return;
  if (T.passY >= 0) for (const e of T.mobile) if (e.alive && e.y > T.passY && !T.passed.has(e)) { T.passed.add(e); if (T.tPass < 0) T.tPass = this.t; }
  while (T.si < PL_SNAP.length && this.t >= PL_SNAP[T.si] - 1e-9) { T.snap.push(...snapOf(T)); T.si++; }
};
/** 진형 · 표적 표본 [전열 평균 깊이, 후열 평균 깊이, 후열을 노리는 적 몫] */
function snapOf(T: Trk): number[] {
  const depth = (role: 1 | 2) => {
    if (T.sur) return -9;
    const us = [...T.role].filter(([u, r]) => r === role && u.alive).map(([u]) => u.y - T.ay0);
    return us.length ? r2(us.reduce((a, b) => a + b, 0) / us.length) : -9;
  };
  const tg = [...T.mobile].filter((e) => e.alive && e.target?.alive && T.role.has(e.target));
  return [depth(1), depth(2), tg.length ? r2(tg.filter((e) => T.role.get(e.target!) === 2).length / tg.length) : -9];
}

/** 출전 기물 (전투 쪽): 소환물 · 반려 돌 · 움직이지 않는 장치 제외 */
const allyUnits = (b: Battle) => b.units.filter((u) => u.side === 0 && !u.isSummon && !u.mem.inert && !!u.src && !R.isRock(u.src));
const foeUnits = (b: Battle) => b.units.filter((u) => u.side === 1 && !u.isSummon && !u.mem.inert && !u.mem.neutral && !u.mem.part);

function fight(st: RunState, type: NodeType, enc: Encounter, seed: number): Row {
  const r = structuredClone(st);
  const e = { ...structuredClone(enc), seed };
  r.node = { ...r.node!, type, enc: e };
  const b = buildBattle(r, e, false);
  const g = b.geo!;
  const A = allyUnits(b), E = foeUnits(b);
  const T: Trk = { b, role: new Map(), back: new Set(), van: new Set(), tCb: -1, tCf: -1, tHb: -1, tDb: -1, nDb: 0, nDf: 0, fd: 0, dmg: 0, dmgB: 0, dmgVan: 0, dmgBp: 0, cont: 0, contB: 0, tCbp: -1, tCbpRole: 0,
    passY: g.foe2 ? -1 : g.ay0, mobile: new Set(), melee: new Set(), passed: new Set(), tPass: -1, ay0: g.ay0, sur: !!g.foe2, snap: [], si: 0 };
  for (const u of A) {
    T.role.set(u, isFront(u.src!) ? 1 : 2);
    if (u.y !== g.ay0) T.back.add(u);
    if (zocCapable(u)) T.van.add(u);
  }
  for (const u of E) if (!u.immobile) { T.mobile.add(u); if (b.S(u, 'range') <= 1) T.melee.add(u); }
  cur = T;
  try { b.runToEnd(); } finally { cur = null; }
  while (T.si < PL_SNAP.length) { T.snap.push(-9, -9, -9); T.si++; } // 표본 시각 전에 끝난 전투
  const frac = (us: CUnit[]) => { const m = us.reduce((a, u) => a + u.st.maxHp, 0); return m > 0 ? us.reduce((a, u) => a + (u.alive ? Math.max(0, u.hp) : 0), 0) / m : 0; };
  const sh = (x: number) => (T.dmg > 0 ? r2(x / T.dmg) : 0);
  const pass = T.passY < 0 ? -1 : T.passed.size, passM = T.passY < 0 ? -1 : [...T.passed].filter((u) => T.melee.has(u)).length;
  const zoc = A.reduce((s, u) => s + (u.mem.zocCaught || 0), 0);
  return [b.winner === 0 ? 1 : 0, r2(frac(A)), r2(frac(E)), Math.round(b.t * 10) / 10, r2(T.tCb), r2(T.tCf), r2(T.tHb), sh(T.dmgB), T.cont > 0 ? r2(T.contB / T.cont) : -1,
    r2(T.tDb), T.nDb, T.nDf, T.fd, pass, passM, r2(T.tPass), zoc, sh(T.dmgVan), r2(T.tCbp), sh(T.dmgBp), T.tCbpRole, sh(T.cont), ...T.snap];
}

type Edit = (r: RunState) => void;
/** 배치 변형 (복제본에 적용). rows = 이번 조우 아군 진형 줄 수 (보통 3, 긴 통로 4) */
function edits(run: RunState, rng: Rng): [string, Edit | null][] {
  const n = run.node!.enc!.n, rows = runGeo(run, n).rows;
  const out: [string, Edit | null][] = [['bot', null]];
  out.push(['fb', (r) => {
    for (const u of deployed(r)) u.pos = { c: u.pos!.c, r: rows - 1 - Math.min(rows - 1, u.pos!.r) };
    if (r.turretPos) r.turretPos = r.turretPos.map((p) => ({ c: p.c, r: rows - 1 - Math.min(rows - 1, p.r) }));
  }]);
  out.push(['lr', (r) => {
    for (const u of deployed(r)) u.pos = { c: n - 1 - Math.min(n - 1, u.pos!.c), r: u.pos!.r };
    if (r.turretPos) r.turretPos = r.turretPos.map((p) => ({ c: p.c < 0 ? 99 : p.c >= 99 ? -1 : n - 1 - Math.min(n - 1, p.c), r: p.r }));
  }]);
  for (let k = 0; k < PL_RAND; k++) {
    const cells = rng.shuffle([...Array(n * rows).keys()]);
    out.push([`rnd${k + 1}`, (r) => { deployed(r).forEach((u, i) => { u.pos = { c: cells[i] % n, r: Math.floor(cells[i] / n) }; }); }]);
  }
  return out;
}

/** 배치 점수 (고르기용): 이긴 수 → 남은 아군 체력 − 남은 적 체력 */
const score = (rows: Row[]) => rows.reduce((s, x) => s + x[0] * 10 + x[1] - x[2], 0);

export function placeValue(run: RunState, rng: Rng, p = 0.3, q = 0.6): PLRec | null {
  const t = run.node?.type, enc = run.node?.enc;
  if (!enc || !t || !['battle', 'adversity', 'challenge', 'boss'].includes(t)) return null;
  if ((t === 'battle' && !rng.chance(p)) || (t === 'adversity' && !rng.chance(q))) return null;
  const dep = deployed(run).filter((u) => !R.isRock(u));
  if (!dep.length) return null;
  const g = runGeo(run, enc.n);
  const S = Array.from({ length: PL_SEEDS }, () => rng.int(1, 2147483646));
  const S2 = Array.from({ length: PL_SEEDS }, () => rng.int(1, 2147483646));
  const foes = enc.enemies.map((s) => ({ s, d: ENEMY_BY_ID[s.defId] })).filter((x) => x.d && !x.d.inert && !(x.s.part && x.s.part > 0));
  const mob = foes.filter((x) => !x.d.immobile);
  const rec: PLRec = {
    ph: run.phase, t, n: enc.n, map: enc.map || 'open', rows: g.rows, sur: g.foe2 ? 1 : 0, field: run.field || '-',
    dep: [dep.length, dep.filter(isFront).length, dep.filter((u) => !isFront(u)).length, dep.filter((u) => isVan(u.defId)).length,
      dep.filter((u) => UNIT_BY_ID[u.defId].range <= 1).length, deployed(run).length - dep.length],
    foe: [mob.length, mob.filter((x) => x.d.range <= 1).length, ...TENDS.map((k) => foes.filter((x) => x.d.tend === k).length), foes.filter((x) => x.d.tier === 'boss').length, foes.filter((x) => x.d.tier === 'elite' || x.s.elite).length] as PLRec['foe'],
    v: {}, bot2: [], best: 'bot', worst: 'bot',
  };
  const E = edits(run, rng);
  const variant = (e: Edit | null) => { const r = structuredClone(run); e?.(r); return r; };
  const states = new Map<string, RunState>();
  for (const [name, e] of E) { const st = variant(e); states.set(name, st); rec.v[name] = S.map((s) => fight(st, t, enc, s)); }
  rec.bot2 = S2.map((s) => fight(states.get('bot')!, t, enc, s));
  const names = E.map((x) => x[0]);
  rec.best = names.reduce((a, b) => (score(rec.v[b]) > score(rec.v[a]) ? b : a));
  rec.worst = names.reduce((a, b) => (score(rec.v[b]) < score(rec.v[a]) ? b : a));
  if (rec.best !== 'bot') rec.best2 = S2.map((s) => fight(states.get(rec.best)!, t, enc, s));
  if (rec.worst !== 'bot') rec.worst2 = S2.map((s) => fight(states.get(rec.worst)!, t, enc, s));
  return rec;
}
