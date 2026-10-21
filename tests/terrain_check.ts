// 지형 · 중립 구조물 검사: 탄도 차단 · 완전 차단 시 부수고 통과 · 틈이 있으면 우회 · 물 너머 사격 · 갈라진 적에게 기술 차단
import { Battle, T_NOSHOT, T_NOWALK } from '../src/engine/combat';
import { buildEnemy, buildWall } from '../src/engine/build';
import { ENEMIES } from '../src/data/enemies';
import { Rng } from '../src/rng';

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
  ok(b.sideOf(w) === 2 && !b.alliesOf(a).includes(w) && !b.alliesOf(e).includes(w) && b.enemiesOf(a).includes(w) && b.enemiesOf(e).includes(w), '바리케이드는 중립: 양쪽의 적, 누구의 아군도 아님');
  ok(!b.fighters(0).includes(w) && !b.fighters(1).includes(w), '바리케이드는 승패 판정에서 빠진다');
}
if (fail) { console.log(`\n${fail}개 실패`); process.exit(1); }
console.log('\n지형 검사 통과');
