// 개전 예측 검사 (engine/preview.ts): 편성 화면에서 장치를 놓거나 · 옮기거나 · 거두면 예측이 다시 계산된다.
// (예전에는 캐시 키에 조우의 장치 · 지형 틀이 빠져 있어 낡은 예측이 남았다)
import * as R from '../src/engine/run';
import { buildBattle, deployed, encGeo, layout, prepOccupied, terrainCells, zoneAt } from '../src/engine/build';
import { foeKey, previewKey, startPreview } from '../src/engine/preview';
import { DEV } from '../src/data/devices';
import { RECRUITABLE } from '../src/data/units';
import type { Encounter, RunState } from '../src/types';
declare const process: { exit(code: number): never };

let fail = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fail++; };
const snap = (run: RunState, enc: Encounter) => JSON.stringify([...startPreview(run, enc)].sort(([a], [b]) => (a < b ? -1 : 1)));
/** 캐시를 거치지 않은 예측: 복제본으로 (캐시는 1칸이라 다른 판을 먼저 돌려 비운다) */
function fresh(run: RunState) {
  const c = JSON.parse(JSON.stringify(run)) as RunState, enc = c.node!.enc!;
  startPreview(c, { ...enc, seed: enc.seed + 1 });
  return snap(c, enc);
}

/** 근접 기물만 (원거리는 첫 틱에 쏘아 경로가 없다): 길을 막으면 예상 경로 · 첫 공격이 바뀐다 */
const MELEE = RECRUITABLE.filter((u) => u.range <= 1).map((u) => u.id);
function mkRun(seed: number) {
  const run = R.newRun(seed, MELEE.slice(seed % 5, (seed % 5) + 4), 'waste');
  run.pending = [];
  R.autoPlace(run);
  const enc = R.genEncounter(run, 'battle');
  enc.map = 'open'; enc.devices = [];
  run.node = { type: 'battle', enc };
  return { run, enc };
}
/** 놓을 수 있는 빈칸 (장치 규칙 그대로) */
const free = (run: RunState, enc: Encounter, x: number, y: number, decoy = false) => {
  const g = encGeo(enc), z = zoneAt(g, x, y);
  return z !== 'edge' && (decoy || z !== 'foe') && !terrainCells(g).has(`${x},${y}`) && !prepOccupied(run, enc).has(`${x},${y}`);
};

// ── 1. 유인 신호기: 적 바로 앞에 놓으면 예측이 바뀌고, 거두면 처음 예측으로 돌아간다
{
  const { run, enc } = mkRun(7);
  const p0 = snap(run, enc);
  ok(deployed(run).every((u) => startPreview(run, enc).has(u.uid)) && deployed(run).length > 0, `예측: 출전 기물 ${deployed(run).length}명 모두`);
  ok(enc.enemies.every((_, i) => startPreview(run, enc).has(foeKey(i))) && enc.enemies.length > 0, `예측: 적 ${enc.enemies.length}명 모두`);
  { const fp = [...enc.enemies.keys()].map((i) => startPreview(run, enc).get(foeKey(i))!);
    // 적 구성이 원거리 · 고정뿐인 판도 있으니 몇 판 중 한 판이라도 움직이는 적이 있으면 된다
    const moves = (rr: RunState, ee: Encounter) => ee.enemies.some((_, i) => startPreview(rr, ee).get(foeKey(i))!.path.length > 1);
    ok(fp.some((p) => p.path.length > 1) || [3, 5, 9, 11, 13].some((sd) => { const m = mkRun(sd); return moves(m.run, m.enc); }), '예측: 적도 이동 경로가 있다');
    const allyAt = new Set(buildBattle(run, enc, true).units.filter((u) => u.side === 0).map((u) => `${u.x},${u.y}`));
    ok(fp.some((p) => p.target) && fp.filter((p) => p.target).every((p) => p.target!.enemy === undefined && allyAt.has(`${p.target!.x},${p.target!.y}`)), '예측: 적의 첫 목표 = 아군 (시작 칸)'); }
  const pv = startPreview(run, enc);
  // 근접 기물의 첫 목표 바로 앞(아군 쪽) 빈칸, 없으면 예상 경로 위 빈칸
  let at: { x: number; y: number } | null = null;
  for (const p of pv.values()) if (!at && p.target) for (const dy of [1, 2]) if (!at && free(run, enc, p.target.x, p.target.y + dy, true)) at = { x: p.target.x, y: p.target.y + dy };
  for (const p of pv.values()) for (const c of p.path.slice(1)) if (!at && free(run, enc, c.x, c.y, true)) at = { x: c.x, y: c.y };
  run.inventory.push('K_decoy');
  const r = R.useConsumable(run, run.inventory.length - 1, { k: 'cell', ...at! });
  ok(r.ok && enc.devices!.length === 1, `신호기 설치 ${JSON.stringify(at)}: ${r.msg}`);
  const p1 = snap(run, enc);
  ok(p1 !== p0, '신호기를 놓으면 개전 예측이 다시 계산되어 바뀐다');
  ok(p1 === fresh(run), '신호기를 놓은 뒤 예측 = 새로 계산한 예측');
  // 같은 판을 실제로 돌린 첫 몇 초와 맞는지: 예측과 같은 시드 · 배치의 전투에도 신호기가 있다
  ok(buildBattle(run, enc).units.some((u) => u.defId === 'K_decoy'), '실제 전투에 신호기가 들어간다');
  R.recallDevice(run, 0);
  ok(snap(run, enc) === p0, '신호기를 거두면 처음 예측으로 돌아간다');
}

// ── 2. 바리케이드: 첫 기물의 예상 경로를 가로막으면 예측이 바뀐다. 옮기기 · 늘리기(setDevice)도 다시 계산
{
  let done = false;
  for (const seed of [3, 5, 9, 11, 13]) {
    const { run, enc } = mkRun(seed);
    const p0 = startPreview(run, enc), s0 = snap(run, enc);
    const g = encGeo(enc), lay = layout(run, enc.n);
    // 경로가 사이 줄(mid)을 지나는 기물: 그 칸을 가운데로 가로 바리케이드
    let cut: { x: number; y: number } | null = null;
    for (const u of deployed(run)) {
      const p = p0.get(u.uid);
      if (!p || !lay.get(u.uid)) continue;
      for (const c of p.path) for (const x of [c.x - 1, c.x, c.x - 2]) {
        if (cut) break;
        if (zoneAt(g, c.x, c.y) !== 'mid') continue;
        if ([0, 1, 2].every((k) => free(run, enc, x + k, c.y))) cut = { x, y: c.y };
      }
      if (cut) break;
    }
    if (!cut) continue;
    run.inventory.push('K_barricade');
    const r = R.useConsumable(run, run.inventory.length - 1, { k: 'cell', ...(cut as { x: number; y: number }), dir: 'h', n: DEV.wall.maxN });
    if (!r.ok) continue;
    const s1 = snap(run, enc);
    ok(s1 !== s0, `시드 ${seed}: 경로를 가로막은 바리케이드 ${DEV.wall.maxN}칸 → 예측이 바뀐다`);
    // 줄이기: 같은 자리 1칸 (setDevice — 런 기록이 남지 않는 조작)
    const d0 = enc.devices![0], k0 = previewKey(run, enc);
    const e1 = R.setDevice(run, 0, { ...d0, n: 1 });
    ok(!e1 && previewKey(run, enc) !== k0, `시드 ${seed}: 바리케이드를 줄이면 캐시 키가 바뀐다`);
    const s2 = snap(run, enc);
    ok(s2 === fresh(run), `시드 ${seed}: 줄인 뒤 예측 = 새로 계산한 예측`);
    // 옮기기: 다른 빈칸으로
    let mv: { x: number; y: number } | null = null;
    for (let y = 0; y < g.h && !mv; y++) for (let x = 0; x < g.w && !mv; x++) if (zoneAt(g, x, y) === 'mid' && (x !== d0.x || y !== d0.y) && free(run, enc, x, y)) mv = { x, y };
    if (mv) {
      const k1 = previewKey(run, enc);
      ok(!R.setDevice(run, 0, { ...enc.devices![0], ...mv }) && previewKey(run, enc) !== k1, `시드 ${seed}: 바리케이드를 옮기면 캐시 키가 바뀐다`);
      ok(snap(run, enc) === fresh(run), `시드 ${seed}: 옮긴 뒤 예측 = 새로 계산한 예측`);
    }
    R.recallDevice(run, 0);
    ok(snap(run, enc) === s0, `시드 ${seed}: 바리케이드를 거두면 처음 예측으로 돌아간다`);
    done = true;
    break;
  }
  ok(done, '바리케이드로 경로를 가로막는 판을 찾았다');
}

// ── 3. 캐시 키: 장치 외에도 전투에 들어가는 값이 바뀌면 다시 계산 (지형 틀 · 적 벗긴 장비 · 소환물 · 포탑 자리 · 전역 증강 내용)
{
  const { run, enc } = mkRun(7);
  const k = () => previewKey(run, enc);
  const base = k();
  const changed = (name: string, f: () => void, undo: () => void) => { f(); ok(k() !== base, `캐시 키: ${name}`); undo(); };
  changed('지형 틀', () => { enc.map = 'lv_gate'; }, () => { enc.map = 'open'; });
  changed('수문 시작 상태', () => { enc.gateOpen = true; }, () => { delete enc.gateOpen; });
  changed('연결교 접기', () => { enc.bridgeFold = true; }, () => { delete enc.bridgeFold; });
  changed('크레인', () => { enc.crane = { 0: 1 }; }, () => { delete enc.crane; });
  const e0 = { ...enc.enemies[0] };
  changed('적 장비를 떼어 냄 (강제 징수기)', () => { enc.enemies[0].stripped = true; }, () => { enc.enemies[0] = { ...e0 }; });
  changed('적 장비', () => { enc.enemies[0].items = [...(e0.items || []), 'G_pow']; }, () => { enc.enemies[0] = { ...e0 }; });
  const sp = run.summonPos, tp = run.turretPos;
  changed('소환물 자리', () => { run.summonPos = { ...sp, 'x:0': { c: 1, r: 1 } }; }, () => { run.summonPos = sp; });
  changed('포탑 자리', () => { run.turretPos = [...(tp || []), { c: 1, r: 1 }]; }, () => { run.turretPos = tp; });
  const g0 = run.globals.slice();
  run.globals = g0.length ? g0 : ['G_x'];
  const gBase = k();
  run.globals = run.globals.map(() => 'G_y');
  ok(k() !== gBase, '캐시 키: 전역 증강 내용 (개수 같음)');
  run.globals = g0;
  ok(k() === base, '되돌리면 같은 키');
}

if (fail) { console.log(`\n${fail}개 실패`); process.exit(1); }
console.log('개전 예측 검사 통과');
