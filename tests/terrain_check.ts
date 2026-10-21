// 지형 · 중립 구조물 검사: 탄도 차단 · 완전 차단 시 부수고 통과 · 틈이 있으면 우회 · 물 너머 사격 · 갈라진 적에게 기술 차단
import { Battle, T_NOSHOT, T_NOWALK } from '../src/engine/combat';
import { applyMap, buildBattle, buildEnemy, buildWall, encGeo, gateGroupState, gateState, geoOf, terrainPathOk, zoneAt } from '../src/engine/build';
import { crateHomes, MAPS, mapOf, rectCells, TERRAIN, terrainOf } from '../src/data/maps';
import * as R from '../src/engine/run';
import { UNITS } from '../src/data/units';
import { CFG } from '../src/config';
import { ENEMIES } from '../src/data/enemies';
import { Rng } from '../src/rng';
declare const process: { exit(code: number): never };
declare function require(m: 'node:fs'): { readFileSync(p: string, e: 'utf8'): string };
const { readFileSync } = require('node:fs');

const melee = ENEMIES.find((e) => e.tier === 'minion' && e.melee && !e.skill && !e.inert && e.minPhase < 5)!;
const ranged = ENEMIES.find((e) => e.tier === 'minion' && !e.melee && e.range >= 4 && !e.skill && !e.inert && e.minPhase < 5)!;
let fail = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fail++; };
function mk(b: Battle, def: typeof melee, side: 0 | 1, x: number, y: number) {
  const u = buildEnemy(b, def, 1, 1); u.side = side; u.x = u.px = x; u.y = u.py = y; b.add(u); return u;
}
function fight(setup: (b: Battle) => void) {
  const b = new Battle(7, 7, new Rng(3), { phase: 1, credits: 0 });
  setup(b); b.start();
  const ws = new Set(b.units.filter((u) => u.mem.wall).map((u) => u.id));
  let wallHits = 0;
  for (let i = 0; i < 4000 && !b.over; i++) {
    b.step(0.05);
    for (const e of b.events) if (e.k === 'dmg' && ws.has(e.id)) wallHits++;
    b.events.length = 0;
  }
  return { b, wallHits };
}
{
  const { b, wallHits } = fight((b) => { for (let x = 0; x < 7; x++) buildWall(b, x, 3, 300); mk(b, melee, 0, 3, 5); mk(b, melee, 1, 3, 1); });
  ok(wallHits > 0 && b.units.some((u) => u.mem.wall && !u.alive) && b.winner !== null, `완전히 막힌 줄: 근접 기물이 바리케이드를 부수고 싸운다 (벽 피격 ${wallHits}, 승자 ${b.winner})`);
}
{
  const { wallHits } = fight((b) => { buildWall(b, 3, 3, 300); mk(b, ranged, 0, 3, 5); mk(b, melee, 1, 3, 1); });
  ok(wallHits > 0, `탄도 차단: 사이의 바리케이드가 사격을 대신 맞는다 (벽 피격 ${wallHits})`);
}
{
  const { b, wallHits } = fight((b) => { for (let x = 0; x < 6; x++) b.setTerrain(x, 3, T_NOWALK | T_NOSHOT); mk(b, melee, 0, 1, 5); mk(b, melee, 1, 1, 1); });
  ok(wallHits === 0 && b.winner !== null && b.units.every((u) => b.terrainAt(u.x, u.y) === 0), `틈이 있는 벽: 근접 기물이 틈으로 돌아가 싸운다 (승자 ${b.winner})`);
}
{
  const { b } = fight((b) => { for (let x = 0; x < 6; x++) b.setTerrain(x, 3, T_NOWALK); mk(b, ranged, 0, 1, 5); mk(b, melee, 1, 1, 1); });
  ok(b.winner !== null && b.units.every((u) => !(b.terrainAt(u.x, u.y) & T_NOWALK)), `물: 아무도 들어가지 않고 사격은 넘어간다 (승자 ${b.winner})`);
}
{
  const b = new Battle(7, 7, new Rng(3), { phase: 1, credits: 0 });
  for (let x = 0; x < 7; x++) buildWall(b, x, 3, 300);
  const a = mk(b, melee, 0, 3, 5), e = mk(b, melee, 1, 3, 1);
  b.start();
  const hp0 = e.hp, w = b.wallAt(3, 3)!, w0 = w.hp;
  b.dealDamage(a, e, 100, { elem: 'phys', tag: 'skill' });
  ok(e.hp === hp0 && w.hp < w0, '완전히 갈라진 적: 기술 피해가 사이의 바리케이드에 맞는다');
  ok(!b.applyStatus(a, e, { type: 'stun', key: 'stun', dur: 1 }), '완전히 갈라진 적: 상태이상도 닿지 않는다');
  const g = b.wallAt(0, 3)!; g.hp = 0; b.kill(g, null);
  ok(!b.sealed(a, e), '바리케이드 한 칸이 부서지면 틈이 생긴다');
  ok(b.sideOf(w) === 2 && !b.alliesOf(a).includes(w) && !b.alliesOf(e).includes(w) && !b.enemiesOf(a).includes(w) && !b.enemiesOf(e).includes(w), '바리케이드는 중립: 누구의 아군도, 기술이 고르는 적도 아님');
  ok(!b.fighters(0).includes(w) && !b.fighters(1).includes(w), '바리케이드는 승패 판정에서 빠진다');
}
// 지형 틀: 폭 6 · 7 · 8 (통로는 고정 폭)마다 아군 진형 → 모든 적 진형으로 걸어서 갈 길이 있고, 지형 칸이 진형 안에 없다
for (const m of MAPS) for (const n0 of [6, 7, 8]) {
  const n = m.narrow ?? n0, g = geoOf(n, m.id);
  const b = new Battle(g.w, g.h, new Rng(1), { phase: 1, credits: 0 });
  b.geo = g; applyMap(b, g);
  const seen = new Set<string>(), q: [number, number][] = [];
  for (let x = 1; x <= n; x++) { q.push([x, g.ay0]); seen.add(`${x},${g.ay0}`); }
  while (q.length) {
    const [x, y] = q.pop()!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !b.inBounds(nx, ny) || zoneAt(g, nx, ny) === 'edge') continue;
      if (dx && dy && !b.inBounds(x + dx, y) && !b.inBounds(x, y + dy)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  const foeRows = [1, 2, 3, ...(g.foe2 ? [g.foe2, g.foe2 + 1, g.foe2 + 2] : [])];
  const reach = foeRows.every((y) => [...Array(n).keys()].some((c) => seen.has(`${c + 1},${y}`)));
  const inZone = [...Array(g.w * g.h).keys()].some((i) => b.terrain && b.terrain[i] && zoneAt(g, i % g.w, (i / g.w) | 0) !== 'mid');
  if (!reach || inZone) ok(false, `지형 틀 ${m.id} 폭 ${n}: 길 ${reach ? '있음' : '없음'} · 진형 안 지형 ${inZone ? '있음' : '없음'}`);
}
ok(true, `지형 틀 ${MAPS.length}종 × 폭 6 · 7 · 8: 아군 진형에서 모든 적 진형으로 길이 있다`);
// 수문 (lv_gate): 닫힐 때 기물이 선 칸은 열린 채 '폐쇄 대기' → 기물이 떠나는 즉시 닫힘. 기물 위로는 절대 닫히지 않는다
{
  const m = mapOf('lv_gate'), [shut, open] = m.gateCycle!, g = geoOf(7, 'lv_gate');
  const gates = m.terrain!(g).filter((c) => c.k === 'gate');
  const b = new Battle(g.w, g.h, new Rng(5), { phase: 1, credits: 0 });
  b.geo = g; applyMap(b, g);
  const sitter = mk(b, melee, 0, 1, g.ay0); sitter.immobile = true; sitter.noAttack = true;
  const far = mk(b, melee, 1, 1, 1); far.immobile = true; far.noAttack = true;
  b.start();
  const run = (until: number) => { while (b.t < until - 1e-9 && !b.over) { b.step(CFG.tick); b.events.length = 0; } };
  ok(gates.length > 0 && gates.every((c) => gateState(b, c.x, c.y) === 'shut') && b.mem.gateNext === shut, `수문: 닫힌 채 시작 · 다음 전환 ${b.mem.gateNext}초`);
  run(shut + CFG.tick);
  ok(gates.every((c) => gateState(b, c.x, c.y) === 'open') && Math.abs(b.mem.gateNext - (shut + open)) < 1e-6, `수문: ${shut}초에 열림 · 다음 전환 ${b.mem.gateNext.toFixed(2)}초`);
  // 열린 수문 칸 하나에 기물을 세워 두고 닫힘 시각을 넘긴다
  const c0 = gates[0];
  ok(b.relocate(sitter, sitter, c0.x, c0.y), '열린 수문 칸으로 들어간다');
  run(shut + open + CFG.tick);
  ok(gateState(b, c0.x, c0.y) === 'pending' && !(b.terrainAt(c0.x, c0.y) & T_NOWALK), '닫힘 주기: 기물이 선 칸은 열린 채 폐쇄 대기');
  ok(gates.slice(1).every((c) => gateState(b, c.x, c.y) === 'shut'), '닫힘 주기: 빈 수문 칸은 닫힘');
  ok(gateGroupState(b, gates) === 'pending', '수문 덩어리 상태 = 폐쇄 대기');
  run(shut + open + 1);
  ok(gateState(b, c0.x, c0.y) === 'pending', '기물이 서 있는 동안은 계속 폐쇄 대기 (닫히지 않음)');
  // 떠나면 다음 틱에 닫힌다
  ok(b.relocate(sitter, sitter, c0.x, c0.y + 1), '기물이 수문 칸을 떠난다');
  b.step(CFG.tick);
  ok(gateState(b, c0.x, c0.y) === 'shut' && (b.terrainAt(c0.x, c0.y) & TERRAIN.gate.bits) === TERRAIN.gate.bits, '떠난 다음 틱에 그 칸이 닫힌다');
  ok(gateGroupState(b, gates) === 'shut' && Math.abs(b.mem.gateNext - (2 * shut + open)) < 1e-6, `수문 덩어리 닫힘 · 다음 전환 ${b.mem.gateNext.toFixed(2)}초`);
}
// 실제 싸움: 수문 지형 틀에서 양쪽 근접 기물이 싸우는 동안 매 틱 — 통행 불가 칸 위에 선 기물이 없다
{
  let bad = 0, pend = 0, ticks = 0;
  for (const seed of [1, 2, 3]) {
    const g = geoOf(7, 'lv_gate');
    const b = new Battle(g.w, g.h, new Rng(seed), { phase: 1, credits: 0 });
    b.geo = g; applyMap(b, g);
    for (let c = 0; c < 7; c++) { mk(b, melee, 0, g.x0 + c, g.ay0 + (c % 2)); mk(b, c % 2 ? ranged : melee, 1, g.x0 + c, 1 + (c % 2)); }
    b.start();
    for (let i = 0; i < 2400 && !b.over; i++) {
      b.step(CFG.tick); b.events.length = 0; ticks++;
      for (const u of b.units) if (u.alive && b.terrainAt(u.x, u.y) & T_NOWALK) bad++;
      if (!b.mem.gateOpen && b.terrain!.some((v, k) => !v && mapOf('lv_gate').terrain!(g).some((c) => c.k === 'gate' && c.y * g.w + c.x === k))) pend++;
    }
  }
  ok(bad === 0, `수문 전투 ${ticks}틱: 닫힌 칸 위에 선 기물 없음 (폐쇄 대기 ${pend}틱)`);
}

// ───────── 물류망 지형 (sw_dock · sw_yard · sw_rail)
// 도킹 연결부: 연결교 1칸 · 양 끝 통로, 접어도 길이 남고 접은 연결교는 통행 불가. 연결교 위 기물은 받는 피해 +bridgeTaken
for (const n of [6, 7, 8]) {
  const g = geoOf(n, 'sw_dock'), gf = geoOf(n, 'sw_dock', { fold: true });
  const br = terrainOf(g).filter((c) => c.k === 'bridge'), brf = terrainOf(gf).filter((c) => c.k === 'bridge');
  const cols = new Set(br.map((c) => c.x));
  ok(cols.size === 1 && br.length === 3 && terrainPathOk(g) && terrainPathOk(gf) && brf.every((c) => c.bits === 1) && br.every((c) => c.bits === 0),
    `도킹 연결부 폭 ${n}: 연결교 1칸 폭 (${[...cols]}) · 펼침 · 접음 모두 길 있음 · 접으면 통행 불가`);
  const edge = terrainOf(g).some((c) => c.x === g.x0 || c.x === g.x0 + n - 1);
  ok(!edge, `도킹 연결부 폭 ${n}: 양 끝 열은 통로`);
}
{
  const g = geoOf(7, 'sw_dock'), b = new Battle(g.w, g.h, new Rng(2), { phase: 1, credits: 0 });
  b.geo = g; applyMap(b, g);
  const bx = terrainOf(g).find((c) => c.k === 'bridge')!;
  const a = mk(b, melee, 0, bx.x, bx.y), c = mk(b, melee, 0, g.x0, bx.y), src = mk(b, melee, 1, bx.x, 1);
  a.st.armor = c.st.armor = 0; a.st.eva = c.st.eva = 0; src.st.crit = 0; a.st.maxHp = c.st.maxHp = a.hp = c.hp = 1e6;
  const h0 = a.hp, h1 = c.hp;
  b.dealDamage(src, a, 100, { elem: 'true', tag: 'skill' }); b.dealDamage(src, c, 100, { elem: 'true', tag: 'skill' });
  const ra = h0 - a.hp, rc = h1 - c.hp;
  ok(Math.abs(ra / rc - (1 + CFG.maps.bridgeTaken)) < 1e-6, `연결교 위 받는 피해 ×${(ra / rc).toFixed(2)} (기준 ${1 + CFG.maps.bridgeTaken})`);
  const bf = new Battle(g.w, g.h, new Rng(2), { phase: 1, credits: 0 }), gf = geoOf(7, 'sw_dock', { fold: true });
  bf.geo = gf; applyMap(bf, gf);
  ok(!bf.inBounds(bx.x, bx.y) && !bf.cellTaken?.[bx.y * bf.w + bx.x], '접은 연결교: 통행 불가 · 피해 증가 칸 없음');
}
// 컨테이너 환적장: 컨테이너 · 적재칸 모든 배치 조합 (같은 크기만, 겹치면 원위치)에서 컨테이너가 사각형 그대로 · 다른 지형과 겹치지 않음 · 길이 있다
for (const n of [6, 7, 8]) {
  const g = geoOf(n, 'sw_yard'), m = mapOf('sw_yard'), bays = m.bays!(g), homes = crateHomes(m.terrain!(g));
  ok(homes.length >= 2 && bays.length >= 2 && homes.every((h) => h.cells.length === h.w * h.h) && homes.some((h) => h.w === 2 && h.h === 2) && homes.some((h) => h.w === 2 && h.h === 1),
    `환적장 폭 ${n}: 컨테이너 ${homes.length}개 (${homes.map((h) => `${h.w}×${h.h}`).join(' · ')}) · 적재칸 ${bays.length}곳`);
  const bayCells = new Set(bays.flatMap((b) => rectCells(b)).map((c) => `${c.x},${c.y}`));
  ok(!terrainOf(g).some((c) => bayCells.has(`${c.x},${c.y}`)), `환적장 폭 ${n}: 적재칸은 처음에 빈칸`);
  const choices = homes.map((h) => [undefined, ...bays.map((b, i) => (b.w === h.w && b.h === h.h ? i : -1)).filter((i) => i >= 0)]);
  let combos = 0, bad = 0;
  const walk = (i: number, crane: Record<number, number>) => {
    if (i === homes.length) {
      combos++;
      const cs = terrainOf(g, { crane }), keys = cs.map((c) => `${c.x},${c.y}`);
      const sizes = homes.every((h) => cs.filter((c) => c.crate === h.i).length === h.cells.length);
      if (new Set(keys).size !== keys.length || !sizes || !terrainPathOk(geoOf(n, 'sw_yard', { crane }))) bad++;
      return;
    }
    for (const ch of choices[i]) walk(i + 1, ch === undefined ? crane : { ...crane, [homes[i].i]: ch });
  };
  walk(0, {});
  ok(bad === 0, `환적장 폭 ${n}: 크레인 배치 ${combos}가지 모두 겹침 없음 · 길 있음`);
}
// 크레인 (편성 화면 함수): 내놓는 적재칸으로 옮기면 길이 남고, 장치가 선 적재칸은 이유와 함께 막힌다. 원위치로 돌아온다
{
  const ids = UNITS.filter((d) => !d.eventOnly && !d.king).slice(0, 4).map((d) => d.id);
  const run = R.newRun(77, ids, 'swarm', 0);
  run.pending = [];
  R.autoPlace(run);
  const enc = R.genEncounter(run, 'battle');
  enc.map = 'sw_yard'; enc.n = 7; delete enc.crane;
  run.node = { type: 'battle', enc };
  const slots = R.craneSlots(run, 0), okSlots = slots.filter((s) => !s.err);
  ok(okSlots.length > 0, `크레인: 컨테이너 A 옮길 자리 ${okSlots.length}곳 (막힘 ${slots.length - okSlots.length})`);
  let pathBad = 0;
  for (const h of [0, 1, 2]) for (const s of R.craneSlots(run, h)) if (!s.err && !terrainPathOk(geoOf(7, 'sw_yard', { crane: { ...(enc.crane || {}), [h]: s.bay } }))) pathBad++;
  ok(pathBad === 0, '크레인: 내놓는 적재칸은 모두 길을 남긴다');
  const s0 = okSlots[0];
  ok(R.craneMove(run, 0, s0.bay) === null && enc.crane?.[0] === s0.bay, `크레인: A → 적재칸 ${s0.bay}`);
  const moved = terrainOf(encGeo(enc)).filter((c) => c.crate === 0);
  ok(rectCells(s0.at).every((c) => moved.some((m) => m.x === c.x && m.y === c.y)), '크레인: 편성 화면 지형 (encGeo) 이 옮긴 자리를 본다');
  const b = buildBattle(run, enc, false);
  ok(rectCells(s0.at).every((c) => (b.terrainAt(c.x, c.y) & 3) === 3), '크레인: 전투 지형도 옮긴 자리 (통행 · 사격 차단)');
  ok(R.deviceErr(run, { id: 'K_mine', x: s0.at.x, y: s0.at.y }) !== null, '크레인: 옮긴 컨테이너 칸에는 장치를 놓을 수 없다');
  ok(R.craneMove(run, 0, null) === null && enc.crane === undefined, '크레인: 원위치');
  // 장치가 선 적재칸: 이유와 함께 막힘
  const other = R.craneSlots(run, 1).find((s) => !s.err);
  if (other) {
    enc.devices = [{ id: 'K_mine', x: other.at.x, y: other.at.y }];
    const again = R.craneSlots(run, 1).find((s) => s.bay === other.bay);
    ok(!!again?.err && R.craneMove(run, 1, other.bay) !== null, `크레인: 장치가 선 적재칸은 막힘 (${again?.err})`);
    enc.devices = [];
  }
  // 연결교 접기: 연결교 위 장치가 있으면 접지 못하고, 없으면 접힌다
  enc.map = 'sw_dock'; delete enc.crane;
  const br = terrainOf(encGeo(enc)).find((c) => c.k === 'bridge')!;
  ok(R.deviceErr(run, { id: 'K_mine', x: br.x, y: br.y }) === null, '연결교 (펼침) 칸에는 장치를 놓을 수 있다');
  enc.devices = [{ id: 'K_mine', x: br.x, y: br.y }];
  ok(R.setBridgeFold(run, true) !== null && !enc.bridgeFold, '연결교 위에 장치가 있으면 접지 못한다');
  enc.devices = [];
  ok(R.setBridgeFold(run, true) === null && enc.bridgeFold === true && R.deviceErr(run, { id: 'K_mine', x: br.x, y: br.y }) !== null, '연결교 접음: 그 칸에는 장치 불가');
  const bb = buildBattle(run, enc, false);
  ok(!bb.inBounds(br.x, br.y), '연결교 접음: 전투에서 통행 불가');
}
// 광석 운반차: 첫 통과 시각에 선로 위 아군 · 적 모두 피해 · 선로 밖 (제 진형 쪽) · 기절. 밀린 칸은 통행 가능 · 전장 안. 지나는 동안 운반차 칸은 사격 차단
{
  const C = CFG.maps.cart;
  for (const n of [6, 7, 8]) {
    const g = geoOf(n, 'sw_rail'), rail = terrainOf(g).filter((c) => c.k === 'rail');
    ok(rail.length === n && new Set(rail.map((c) => c.y)).size === 1 && terrainPathOk(g), `운반차 선로 폭 ${n}: 선로 ${rail.length}칸 한 줄 · 길 있음`);
  }
  const g = geoOf(7, 'sw_rail'), ry = terrainOf(g).find((c) => c.k === 'rail')!.y;
  const b = new Battle(g.w, g.h, new Rng(4), { phase: 1, credits: 0 });
  b.geo = g; applyMap(b, g);
  const us = [0, 1, 2, 3, 4, 5, 6].map((c) => { const u = mk(b, melee, (c % 2) as 0 | 1, g.x0 + c, ry); u.immobile = c === 6; u.noAttack = true; u.st.moveSpd = 0.01; return u; });
  // 선로 옆 칸도 몇 개 채워 둔다 (밀릴 자리가 모자랄 때)
  mk(b, melee, 0, g.x0 + 1, ry + 1).noAttack = true; mk(b, melee, 1, g.x0 + 2, ry - 1).noAttack = true;
  for (const u of b.units) u.st.maxHp = u.hp = 1000;
  b.start();
  for (const u of b.units) { u.hp = u.st.maxHp; u.atkTimer = 99; }
  const hp0 = new Map(us.map((u) => [u.id, u.hp]));
  let warnSeen = false, shotBlock = false, ticks = 0, pushes = 0;
  const badPush: string[] = [];
  while (b.t < C.first + C.sweep + 0.2) {
    b.step(CFG.tick); ticks++;
    for (const e of b.events) if (e.k === 'status' && e.name === '밀쳐내기') { const u = b.units.find((x) => x.id === e.id)!; pushes++; if (!b.inBounds(u.x, u.y) || u.y === ry || u.x < g.x0 || u.x >= g.x0 + 7 || u.y < 1 || u.y >= g.h - 1) badPush.push(`${u.x},${u.y}`); }
    b.events.length = 0;
    if (b.mem.cartRun && [...Array(7).keys()].some((i) => b.terrainAt(g.x0 + i, ry) & T_NOSHOT)) shotBlock = true;
    if (!b.mem.cartRun && b.mem.cartNext - b.t <= C.warn && b.mem.cartNext - b.t > 0) warnSeen = true;
  }
  const hitA = us.filter((u) => u.side === 0 && u.hp < hp0.get(u.id)!), hitF = us.filter((u) => u.side === 1 && u.hp < hp0.get(u.id)!);
  ok(hitA.length > 0 && hitF.length > 0, `운반차: 아군 ${hitA.length} · 적 ${hitF.length} 피격 (양쪽 모두)`);
  const dmgOk = us.every((u) => Math.abs(hp0.get(u.id)! - u.hp) > 0);
  ok(dmgOk, '운반차: 선로 위 기물 모두 맞음');
  ok(pushes >= 6 && badPush.length === 0, `운반차: 밀린 ${pushes}명 모두 선로 밖 통행 가능한 전장 안 칸 (${badPush.join(' ') || '문제 없음'})`);
  const off = us.filter((u) => !u.immobile && u.y !== ry), own = off.filter((u) => (u.side === 0 ? u.y > ry : u.y < ry));
  ok(off.length === us.filter((u) => !u.immobile).length && own.length === off.length, `운반차: 고정 기물 빼고 모두 선로 밖으로 (제 진형 쪽 ${own.length}/${off.length})`);
  ok(us[6].y === ry, '운반차: 고정 기물은 제자리');
  ok(shotBlock && warnSeen, '운반차: 예고 구간 · 지나는 동안 운반차 칸 사격 차단');
  ok(b.mem.cartDir === -(mapOf('sw_rail').cartDir || 1) && Math.abs(b.mem.cartNext - (C.first + C.period)) < 1e-6, `운반차: 다음 통과 ${b.mem.cartNext}초 · 방향 반대`);
  ok(![...Array(7).keys()].some((i) => b.terrainAt(g.x0 + i, ry)), '운반차: 지나간 뒤 선로는 다시 길');
}
// 실제 싸움: 운반차 선로에서 양쪽이 싸우는 동안 매 틱 — 통행 불가 칸 위 · 전장 밖 기물 없음, 운반차가 실제로 양쪽을 친다
{
  let bad = 0, ticks = 0;
  const hitSide = [0, 0];
  for (const seed of [1, 2, 3]) {
    const g = geoOf(7, 'sw_rail');
    const b = new Battle(g.w, g.h, new Rng(seed), { phase: 1, credits: 0 });
    b.geo = g; applyMap(b, g);
    for (let c = 0; c < 7; c++) { mk(b, melee, 0, g.x0 + c, g.ay0 + (c % 2)); mk(b, c % 2 ? ranged : melee, 1, g.x0 + c, 1 + (c % 2)); }
    for (const u of b.units) u.st.maxHp *= 4;
    b.start();
    for (let i = 0; i < 2400 && !b.over; i++) {
      b.step(CFG.tick); ticks++;
      for (const e of b.events) if (e.k === 'cart') for (const id of e.ids) { const u = b.units.find((x) => x.id === id); if (u) hitSide[u.side]++; }
      b.events.length = 0;
      for (const u of b.units) if (u.alive && (b.terrainAt(u.x, u.y) & T_NOWALK || !b.inRect(u.x, u.y))) bad++;
    }
  }
  ok(bad === 0, `운반차 전투 ${ticks}틱: 통행 불가 칸 · 전장 밖 기물 없음 (운반차 피격 아군 ${hitSide[0]} · 적 ${hitSide[1]})`);
}
// 전투 중 조작 없음: 편성 화면의 지형 선택 함수는 조우(run.node.enc)만 바꾸고, 전투 화면은 지형 단추를 받지 않는다 (main.ts 허용 목록)
{
  const src = readFileSync('src/main.ts', 'utf8'), allow = /app\.screen === 'battle' && !\[([^\]]*)\]\.includes\(a\)/.exec(src)?.[1] || '';
  ok(!!allow && !/crane|bridge|gate-start/.test(allow), '전투 중 허용 동작에 크레인 · 연결교 · 수문 단추 없음');
}
if (fail) { console.log(`\n${fail}개 실패`); process.exit(1); }
console.log('\n지형 검사 통과');
