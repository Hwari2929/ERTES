// 출전 기물 검사: 출전 명단 · 배치 칸 · 전투에 나오는 기물이 언제나 같은지 (P0 '출전 기물 누락')
// - 모든 지형 틀 × 폭 6 · 7 · 8 (통로는 출전 한도에 맞춘 폭)에서 출전 한도 14명 + 아군 진형에 장치를 놓아도 layout() 이 모두 세우고 buildBattle() 에 모두 나온다
// - autoPlace 는 지금 배치 폭 밖의 칸을 저장하지 않는다
// - 아군 진형에 설 자리가 모자라면 배치 · 장치를 막고, 그래도 넘치면 fitDeploy 가 등급 낮은 기물부터 대기석으로 내린다
import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import { allyRoom, buildBattle, companionCells, type CompanionTok, deployed, encGeo, layout, PAD, ZONE, zoneAt } from '../src/engine/build';
import { MAPS } from '../src/data/maps';
import { deviceCells, type Device } from '../src/data/devices';
import { RECRUITABLE } from '../src/data/units';
import type { Encounter, RunState } from '../src/types';
declare const process: { exit(code: number): never };

let fail = 0;
const ok = (c: boolean, msg: string) => { if (!c) { console.log(`FAIL ${msg}`); fail++; } };
let passed = 0;
const check = (c: boolean, msg: string) => { ok(c, msg); if (c) passed++; };

/** 출전 한도 14명 (기본 + 함대 확장 최대) · 보유 16명 (소환 기물 포함) */
function mkRun(): RunState {
  const pool = RECRUITABLE.filter((d) => !d.traits.includes('EXPLORER'));
  const summoners = pool.filter((d) => d.summon).slice(0, 3);
  const ids = [...summoners, ...pool.filter((d) => !d.summon)].slice(0, CFG.maxParty).map((d) => d.id);
  const run = R.newRun(7, ids.slice(0, 4), 'waste', 0);
  for (const id of ids.slice(4)) R.addUnit(run, id, 1);
  run.pending = [];
  run.fleet = CFG.fleetCosts.length;
  run.units.forEach((u, i) => { u.rank = 1 + (i % 5); u.pos = null; });
  return run;
}
const CAP = 14;
const sideAllies = (run: RunState, enc: Encounter) => buildBattle(run, enc, false).units.filter((u) => u.side === 0 && u.src && !u.isSummon).length;
/** 아군 진형 빈칸에 장치를 deviceErr 가 허락하는 만큼 놓는다 (바리케이드 3 · 2 · 1칸, 신호기 · 지뢰) */
function fillDevices(run: RunState, enc: Encounter, max = 99) {
  const g = encGeo(enc);
  enc.devices = enc.devices || [];
  for (let y = g.ay1; y >= g.ay0; y--) for (let x = PAD; x < PAD + enc.n; x++) {
    if (enc.devices.length >= max) return;
    for (const d of [3, 2, 1].map((k): Device => ({ id: 'K_barricade', x, y, dir: 'h', n: k })).concat([{ id: 'K_mine', x, y }, { id: 'K_decoy', x, y }])) {
      if (!R.deviceErr(run, d)) { enc.devices.push(d); break; }
    }
  }
}
/** skip = 일부러 넓은 폭 칸을 저장해 둔 기물 (예전 세이브) */
function inWidth(run: RunState, n: number, skip?: unknown) { return deployed(run).every((u) => u === skip || (u.pos!.c >= 0 && u.pos!.c < n && u.pos!.r >= 0 && u.pos!.r < ZONE)); }

const run = mkRun();
check(R.deployCap(run) === CAP, `출전 한도 ${R.deployCap(run)} = ${CAP}`);

// ── 1. 통로: genEncounter 가 출전 한도 + 1명이 서는 폭으로 넓힌다
{
  let found = 0;
  for (let s = 1; s < 4000 && found < 5; s++) {
    run.seed = s; run.step = s % 7;
    const enc = R.genEncounter(run, 'battle');
    if (enc.map !== 'corridor') continue;
    found++;
    check(enc.n * ZONE >= CAP + 1 && enc.n === R.narrowWidth(run, 4), `통로 폭 ${enc.n} → 아군 진형 ${enc.n * ZONE}칸 ≥ 출전 한도 ${CAP} + 1`);
  }
  check(found > 0, `통로 조우를 찾았다 (${found})`);
  run.seed = 7; run.step = 0;
}

// ── 2. 모든 지형 틀 × 폭: autoPlace (폭 안) · 장치 · layout · buildBattle
for (const m of MAPS) for (const n0 of [6, 7, 8]) {
  const n = m.narrow ? R.narrowWidth(run, m.narrow) : n0;
  const tag = `${m.id} 폭 ${n}`;
  run.units.forEach((u) => { u.pos = null; });
  const enc: Encounter = { n, env: '', enemies: [], mult: 1, seed: 3, devices: [], ...(m.id !== 'open' ? { map: m.id } : {}) };
  run.node = { type: 'battle', enc };
  // 저장 칸이 넓은 폭 기준 (예전 세이브)인 기물 하나를 먼저 세워 둔다
  run.units[0].pos = { c: 7, r: 1 };
  R.autoPlace(run);
  const dep = deployed(run).length;
  check(dep === Math.min(CAP, allyRoom(run)), `${tag}: autoPlace 출전 ${dep}명`);
  check(inWidth(run, n, run.units[0]), `${tag}: autoPlace 는 폭 밖 칸을 저장하지 않는다`);
  // 일부를 대기석으로 내리고 장치를 채운 뒤 다시 자동 배치
  deployed(run).slice(-3).forEach((u) => { u.pos = null; });
  fillDevices(run, enc, 4);
  R.autoPlace(run);
  const lay = layout(run, n), d2 = deployed(run).length;
  check(lay.size === d2 && d2 <= allyRoom(run), `${tag}: 장치 ${enc.devices!.length}개 뒤 layout ${lay.size} = 출전 ${d2} ≤ 설 칸 ${allyRoom(run)}`);
  const cells = new Set([...lay.values()].map((p) => `${p.x},${p.y}`)), devCells = new Set(enc.devices!.flatMap((d) => deviceCells(d)).map((c) => `${c.x},${c.y}`));
  check(cells.size === lay.size && [...lay.values()].every((p) => zoneAt(encGeo(enc), p.x, p.y) === 'ally' && !devCells.has(`${p.x},${p.y}`)), `${tag}: 기물 칸이 겹치지 않고 아군 진형 · 장치 밖`);
  check(sideAllies(run, enc) === d2, `${tag}: 전투에 출전 기물 ${d2}명이 모두 나온다`);
  // 다시 몇 명을 내리고 남은 빈칸을 장치로 모두 채운다 → 설 칸 = 출전 인원 < 출전 한도. 더 올릴 수 없다
  // (소환 기물도 내린다: 소환물 시작 칸에는 장치를 놓을 수 없고 기물은 설 수 있어서, 남겨 두면 진형이 장치로 다 차지 않는다)
  deployed(run).filter((u, i, a) => i >= a.length - 2 || RECRUITABLE.find((d) => d.id === u.defId)?.summon).forEach((u) => { u.pos = null; });
  check(companionCells(run, n).length === 0, `${tag}: 소환물 · 무휼 없음 (전제)`);
  fillDevices(run, enc);
  check(allyRoom(run) === deployed(run).length && deployed(run).length < CAP, `${tag}: 장치로 채운 진형 — 설 칸 ${allyRoom(run)} = 출전 ${deployed(run).length} < 한도 ${CAP}`);
  const before = deployed(run).length;
  check(R.autoFill(run) === 0 && deployed(run).length === before && R.deployBlock(run) === R.ROOM_ERR, `${tag}: 설 자리가 없으면 자동 배치가 올리지 않는다 (${R.deployBlock(run)})`);
  check(layout(run, n).size === deployed(run).length && sideAllies(run, enc) === deployed(run).length, `${tag}: 장치로 채운 뒤에도 전투에 모두 나온다`);
  run.node = null;
}

// ── 3. 안전장치: 좁은 폭 (예전 통로 4칸)에 14명이 올라가 있는 세이브
{
  run.units.forEach((u) => { u.pos = null; });
  run.node = null;
  R.autoPlace(run); // 기본 보드 (폭 7)에서 14명
  check(deployed(run).length === CAP, `기본 보드 자동 배치 ${deployed(run).length}명`);
  const enc: Encounter = { n: 4, env: '', enemies: [], mult: 1, seed: 3, devices: [], map: 'corridor' };
  run.node = { type: 'battle', enc };
  const lay = layout(run, 4);
  check(lay.size === CAP && sideAllies(run, enc) === CAP, `폭 4 · 14명: layout 이 빠뜨리지 않는다 (${lay.size}) · 전투 ${sideAllies(run, enc)}명`);
  check(R.deviceErr(run, { id: 'K_mine', x: PAD, y: encGeo(enc).ay0 - 3 }) === R.ROOM_ERR, '설 자리가 모자라면 장치를 놓을 수 없다');
  const ranks = deployed(run).map((u) => u.rank).sort((a, b) => a - b);
  const moved = R.fitDeploy(run);
  check(moved.length === CAP - 4 * ZONE && deployed(run).length === 4 * ZONE, `fitDeploy: ${moved.length}명 대기석으로 → 출전 ${deployed(run).length}`);
  check(Math.min(...deployed(run).map((u) => u.rank)) >= ranks[moved.length - 1], 'fitDeploy: 공명 등급이 낮은 기물부터 내린다');
  check(R.deployBlock(run) === R.ROOM_ERR, `가득 찬 진형: 출전 막힘 (${R.deployBlock(run)})`);
  const lost: CompanionTok[] = [];
  companionCells(run, 4, lost);
  const sumDep = deployed(run).some((u) => RECRUITABLE.find((d) => d.id === u.defId)?.summon);
  check(!sumDep || lost.length > 0, `가득 찬 진형: 시작 칸이 없는 소환물을 알린다 (${lost.map((t) => t.name).join(' · ')})`);
  run.node = null;
}

console.log(`deploy_check: ${passed} ok${fail ? `, ${fail} FAIL` : ''}`);
if (fail) process.exit(1);
