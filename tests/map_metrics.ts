// 지형 틀 측정 (check 에 들어가지 않는다): 지형 틀마다 · 편성 유형마다 전투를 여러 번 돌려
// 승률 · 전투 시간 · 아군 첫 공격 시각 · 아군 시간 몫 (이동 · 대기 · 막힘 · 교전 · 제어) · 소환 실패를 잰다.
// 실행: npm run -s map-metrics -- [표본 수 (기본 60)] [--phase=2] [--rank=2] [--type=battle|adversity] [--field=livin]
// 같은 표본 번호는 모든 지형 틀에서 같은 편성 · 같은 시드 (짝 비교). 지형 틀은 MAPS 를 잠시 바꿔 pickMap 이 그 틀만 고르게 한다
import { CFG } from '../src/config';
import { MAPS, mapOf } from '../src/data/maps';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { buildBattle } from '../src/engine/build';
import { Battle, type CUnit } from '../src/engine/combat';
import * as R from '../src/engine/run';
import { Rng } from '../src/rng';
import type { NodeType } from '../src/types';

declare const process: { argv: string[]; stdout: { write(s: string): void } };
const arg = (k: string, d: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const N = +(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 60);
const PHASE = +arg('phase', '2'), RANK = +arg('rank', '2'), TYPE = arg('type', 'battle') as NodeType, FIELD = arg('field', 'livin');
const TEAM = CFG.deployBase;

// ── 편성 유형 (기물 정의에서): 근접 = 사거리 1 · 원거리 = 사거리 3 이상 · 소환 = 소환물이 있는 기물
const pool = UNITS.filter((d) => !d.eventOnly && !d.king);
const isMelee = (id: string) => UNIT_BY_ID[id].range <= 1 && !UNIT_BY_ID[id].summon;
const isRanged = (id: string) => UNIT_BY_ID[id].range >= 3 && !UNIT_BY_ID[id].summon;
const isSummoner = (id: string) => !!UNIT_BY_ID[id].summon;
const COMPS: { id: string; name: string; core: (id: string) => boolean; k: number }[] = [
  { id: 'melee', name: '근접 위주', core: isMelee, k: TEAM - 1 },
  { id: 'ranged', name: '원거리 위주', core: isRanged, k: TEAM - 1 },
  { id: 'summon', name: '소환 위주', core: isSummoner, k: Math.max(2, TEAM - 2) },
  { id: 'mixed', name: '무작위', core: () => true, k: TEAM },
];
function team(comp: (typeof COMPS)[number], i: number): string[] {
  const r = new Rng(9001 + i * 131 + comp.id.length * 7);
  const core = r.sample(pool.filter((d) => comp.core(d.id)).map((d) => d.id), comp.k);
  const rest = r.sample(pool.map((d) => d.id).filter((id) => !core.includes(id)), TEAM - core.length);
  return [...core, ...rest];
}
/** 유형 판정 (실제 편성에서): 절반 넘게 근접 · 원거리면 그 유형, 소환 기물 2명 이상이면 소환 */
const classify = (ids: string[]) => (ids.filter(isSummoner).length >= 2 ? 'summon' : ids.filter(isMelee).length > ids.length / 2 ? 'melee' : ids.filter(isRanged).length > ids.length / 2 ? 'ranged' : 'mixed');

// ── 계측 훅: 소환 시도 · 실패 (아군), 첫 기본 공격 시각
const spawnStat = { tries: 0, fails: 0 };
const spawn0 = Battle.prototype.spawn;
Battle.prototype.spawn = function (this: Battle, u: CUnit, near: { x: number; y: number }) {
  const r = spawn0.call(this, u, near);
  if (u.side === 0) { spawnStat.tries++; if (!r) spawnStat.fails++; }
  return r;
};
const basic0 = Battle.prototype.basicAttack;
Battle.prototype.basicAttack = function (this: Battle, u: CUnit, t: CUnit, coef?: number) {
  if (u.mem.fa === undefined) u.mem.fa = this.t;
  return basic0.call(this, u, t, coef);
};

/** 지형 틀 강제: 전장 전용 틀 자리에 그 틀 하나만 (개활지는 확률 0) */
function forceMap(id: string) {
  const saved = MAPS.map((m) => [m.field, m.later] as const), cfg = { ...CFG.maps };
  MAPS.forEach((m) => { m.field = m.id === id ? FIELD : '__off'; m.later = false; });
  CFG.maps.field = id === 'open' ? 0 : 1; CFG.maps.common = 0;
  return () => { MAPS.forEach((m, i) => { [m.field, m.later] = saved[i]; }); Object.assign(CFG.maps, cfg); };
}

interface Acc { n: number; win: number; t: number; fa: number; faN: number; noAtk: number; move: number; idle: number; blocked: number; engaged: number; cc: number; total: number; sTry: number; sFail: number; preGate: number; preGateN: number }
const acc = (): Acc => ({ n: 0, win: 0, t: 0, fa: 0, faN: 0, noAtk: 0, move: 0, idle: 0, blocked: 0, engaged: 0, cc: 0, total: 0, sTry: 0, sFail: 0, preGate: 0, preGateN: 0 });
const res = new Map<string, Acc>();
const get = (k: string) => res.get(k) || (res.set(k, acc()), res.get(k)!);

function runOne(mapId: string, ids: string[], seed: number, keys: string[]) {
  const run = R.newRun(seed, ids, FIELD, 0);
  run.pending = [];
  run.phase = PHASE;
  if (RANK > 1) for (const u of run.units) u.rank = RANK;
  R.autoPlace(run);
  const undo = forceMap(mapId);
  run.mapHist = [];
  const enc = R.genEncounter(run, TYPE, PHASE);
  undo();
  if ((enc.map || 'open') !== mapId) throw new Error(`지형 틀 강제 실패: ${mapId} → ${enc.map}`);
  spawnStat.tries = spawnStat.fails = 0;
  run.node = { type: TYPE, enc }; // layout · 지형 칸 기준 (runGeo 가 run.node.enc.map 을 읽는다)
  const b = buildBattle(run, enc, false);
  const allies = b.units.filter((u) => u.side === 0 && !u.isSummon && !u.mem.wall && !u.mem.decoy);
  const tm = { move: 0, idle: 0, blocked: 0, engaged: 0, cc: 0 };
  const dt = CFG.tick, maxT = CFG.timeLimit + 1;
  while (!b.over && b.t < maxT) {
    b.step(dt);
    b.events.length = 0;
    for (const u of allies) {
      if (!u.alive) continue;
      const t = u.target && u.target.alive ? u.target : null;
      if (b.has(u, 'stun') || b.has(u, 'fear')) tm.cc += dt;
      else if (u.moveT > 0) tm.move += dt;
      else if (t && b.dist(u, t) <= b.S(u, 'range')) { if (b.los(u, t)) tm.engaged += dt; else tm.blocked += dt; }
      else tm.idle += dt;
    }
  }
  if (!b.over) b.winner = 1;
  const gate = mapOf(mapId).gateCycle?.[0];
  for (const k of keys) {
    const a = get(k);
    a.n++; a.win += b.winner === 0 ? 1 : 0; a.t += b.t;
    for (const u of allies) {
      if (u.mem.fa !== undefined) { a.fa += u.mem.fa; a.faN++; if (gate) { a.preGateN++; if (u.mem.fa < gate) a.preGate++; } } else a.noAtk++;
    }
    const tot = tm.move + tm.idle + tm.blocked + tm.engaged + tm.cc;
    a.move += tm.move; a.idle += tm.idle; a.blocked += tm.blocked; a.engaged += tm.engaged; a.cc += tm.cc; a.total += tot;
    a.sTry += spawnStat.tries; a.sFail += spawnStat.fails;
  }
}

const maps = MAPS.filter((m) => !m.field || m.field === FIELD).map((m) => m.id);
const out = (s: string) => process.stdout.write(s + '\n');
out(`지형 틀 측정 · 전장 ${FIELD} · ${TYPE} · 페이즈 ${PHASE} · 공명 등급 ${RANK} · 출전 ${TEAM}명 · 편성 유형마다 표본 ${N}개 (지형 틀 ${maps.length}종 × ${COMPS.length}유형 × ${N} = ${maps.length * COMPS.length * N}전투)`);
const realComp = new Map<string, number>();
for (const comp of COMPS)
  for (let i = 0; i < N; i++) {
    const ids = team(comp, i);
    const cls = classify(ids);
    realComp.set(`${comp.id}→${cls}`, (realComp.get(`${comp.id}→${cls}`) || 0) + 1);
    for (const m of maps) runOne(m, ids, 1000 + i * 17 + comp.id.charCodeAt(0), [`${m}|${comp.id}`, `${m}|all`]);
  }

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const f1 = (x: number) => x.toFixed(1);
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
out('\n편성 유형 판정 (뽑은 유형 → 기물 정의로 판정한 유형): ' + [...realComp].map(([k, v]) => `${k} ${v}`).join(' · '));
out('\n' + row(['지형 틀', '편성', '승률', '전투 시간', '첫 공격', '못 쏨', '이동', '대기', '막힘', '교전', '제어', '소환 실패', '수문 열리기 전 첫 공격']));
out(row(Array(13).fill('---')));
for (const m of maps)
  for (const c of ['all', ...COMPS.map((x) => x.id)]) {
    const a = res.get(`${m}|${c}`);
    if (!a) continue;
    out(row([c === 'all' ? `**${mapOf(m).name}**` : '', c === 'all' ? '전체' : COMPS.find((x) => x.id === c)!.name, pct(a.win, a.n), `${f1(a.t / a.n)}초`, a.faN ? `${f1(a.fa / a.faN)}초` : '-', pct(a.noAtk, a.noAtk + a.faN),
      pct(a.move, a.total), pct(a.idle, a.total), pct(a.blocked, a.total), pct(a.engaged, a.total), pct(a.cc, a.total),
      a.sTry ? `${a.sFail}/${a.sTry}` : '-', a.preGateN ? pct(a.preGate, a.preGateN) : '-']));
  }
out('\n열: 첫 공격 = 아군(소환물 제외) 첫 기본 공격 시각 평균 · 못 쏨 = 한 번도 기본 공격을 못 한 아군 비율 · 이동/대기/막힘/교전/제어 = 아군 생존 시간 몫 (대기 = 사거리 안에 대상 없음, 막힘 = 사거리 안이지만 지형이 사선을 막음) · 소환 실패 = 아군 소환 자리 없음/시도');
