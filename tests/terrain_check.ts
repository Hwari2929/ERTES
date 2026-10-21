// 지형 · 중립 구조물 검사: 탄도 차단 · 완전 차단 시 부수고 통과 · 틈이 있으면 우회 · 물 너머 사격 · 갈라진 적에게 기술 차단
import { Battle, T_NOSHOT, T_NOWALK } from '../src/engine/combat';
import { applyMap, buildEnemy, buildWall, gateGroupState, gateState, geoOf, zoneAt } from '../src/engine/build';
import { MAPS, mapOf, TERRAIN } from '../src/data/maps';
import { CFG } from '../src/config';
import { ENEMIES } from '../src/data/enemies';
import { Rng } from '../src/rng';
declare const process: { exit(code: number): never };

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
if (fail) { console.log(`\n${fail}개 실패`); process.exit(1); }
console.log('\n지형 검사 통과');
