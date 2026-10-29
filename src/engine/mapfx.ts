// 지형 틀 기믹 (data/maps.ts TERRAIN · CFG.maps): 부서지는 구조물 (주차된 차 · 봉쇄 바리케이드) · 전투 중 바뀌는 칸 (홀로그램 광고판 · 레이저 장막 · 회전 금고문) ·
// 주기 위험 (전력선 · 스프링클러) · 효과 칸 (회수 장치 · 단상 · 금고 칸). build.ts applyMap 이 지형 칸을 깐 뒤 부른다.
// 전투 화면 · 상세가 읽는 상태는 b.mem: holoOn · holoNext / laserOn · laserNext / vaultNext / powNext · powLive / sprNext / vaultT · vaultPay (폐쇄 대기 칸은 dynPending)
import { CFG } from '../config';
import { DEV, wallHp } from '../data/devices';
import { rampage } from '../data/enemies';
import { slow } from '../data/kit';
import { laserSets, TERRAIN, type TCell } from '../data/maps';
import { blankUnit, buildWall } from './build';
import { type Battle, type CUnit, T_NOWALK } from './combat';

const TICK = 0.1;
/** 전투마다 기믹 상태 (b.mem 은 수만 담는다): 폐쇄 대기 칸 (칸 번호 → 바꿀 비트) · 회수 장치 칸 · 폭발한 차 번호 */
interface FxState { pend: Map<number, number>; recov: { x: number; y: number }[]; boom: Set<number> }
const FX = new WeakMap<Battle, FxState>();
const fx = (b: Battle) => { let s = FX.get(b); if (!s) FX.set(b, (s = { pend: new Map(), recov: [], boom: new Set() })); return s; };
/** 폐쇄 대기 칸 (통행을 막을 차례인데 기물이 서 있어 아직 열린 칸, 칸 번호) — 전투 화면 표시용 */
export const dynPending = (b: Battle): ReadonlyMap<number, number> => FX.get(b)?.pend ?? new Map();
/** 회수 장치 주변 (CFG.maps.recovery.r) 칸인가 — 크레타 서사의 전염이 망령을 세우지 않는다 */
export const nearRecovery = (b: Battle, c: { x: number; y: number }) => !!FX.get(b)?.recov.some((r) => b.dist(c, r) <= CFG.maps.recovery.r);
/** 지형 효과의 출처 (전장에 없음, 어느 편도 아님) */
function source(name: string, x: number, y: number): CUnit {
  const s = blankUnit(0);
  s.name = name; s.mem.neutral = 1; s.st.effHit = 9; s.x = s.px = x; s.y = s.py = y;
  return s;
}
/** 바뀌는 칸의 비트를 바꾼다. 통행을 막을 차례인데 기물이 서 있으면 그 칸은 열어 둔 채 폐쇄 대기로 두고, 비는 즉시 막는다 (기물 위로는 막지 않는다) */
function want(b: Battle, x: number, y: number, bits: number) {
  const i = y * b.w + x, pend = fx(b).pend;
  if (bits & T_NOWALK && b.unitAt(x, y)) { pend.set(i, bits); if (b.terrainAt(x, y)) b.setTerrain(x, y, 0); return; }
  pend.delete(i);
  if (b.terrainAt(x, y) !== bits) b.setTerrain(x, y, bits);
}
function flushPend(b: Battle) {
  for (const [i, bits] of [...fx(b).pend]) { const x = i % b.w, y = (i / b.w) | 0; if (!b.unitAt(x, y)) want(b, x, y, bits); }
}
/** 칸 위에 선 살아 있는 기물 */
const unitsOn = (b: Battle, cells: { x: number; y: number }[]) => cells.map((c) => b.unitAt(c.x, c.y)).filter((u): u is CUnit => !!u && u.alive);

export function applyMapFx(b: Battle, cells: TCell[], opt: { sprLate?: boolean; laserB?: boolean } = {}) {
  const C = CFG.maps, of = (k: TCell['k']) => cells.filter((c) => c.k === k && !c.off);
  // ── 부서지는 구조물: 차 (같은 번호의 칸은 한 대 — 한 칸이 부서지면 한 대가 통째로 폭발) · 바리케이드
  const phase = b.ctx.phase || 1, armor = DEV.wall.armor * Math.pow(CFG.phaseArmor, phase - 1);
  for (const c of cells) {
    if (!TERRAIN[c.k].breakable || b.unitAt(c.x, c.y)) continue;
    const car = c.k === 'car', w = buildWall(b, c.x, c.y, wallHp(phase, car ? C.car.hpDiv : C.barricade.hpDiv), { name: TERRAIN[c.k].name, armor, defId: car ? 'map_car' : 'map_barricade' });
    if (car) w.mem.car = (c.crate ?? 0) + 1;
  }
  if (cells.some((c) => c.k === 'car')) b.onWallBreak = (bb, u) => carBreak(bb, u);
  // ── 효과 칸: 단상 (사거리) · 회수 장치 · 금고 칸
  for (const c of of('dais')) (b.cellRange ||= new Uint8Array(b.w * b.h))[c.y * b.w + c.x] = C.dais.range;
  const recov = of('recovery'), vcell = of('vaultcell'), power = of('power');
  fx(b).recov = recov.map((c) => ({ x: c.x, y: c.y }));
  if (vcell.length) b.mem.vaultT = 0;
  // ── 홀로그램 광고판: 켜진 채 시작, 켜짐 on 초 ↔ 꺼짐 off 초
  const holo = of('holo');
  if (holo.length) {
    b.mem.holoOn = 1; b.mem.holoNext = C.holo.on;
    const flip = () => {
      b.mem.holoOn = b.mem.holoOn ? 0 : 1;
      b.mem.holoNext += b.mem.holoOn ? C.holo.on : C.holo.off;
      for (const c of holo) want(b, c.x, c.y, b.mem.holoOn ? TERRAIN.holo.bits : 0);
      b.later(b.mem.holoNext - b.t, flip);
    };
    b.later(b.mem.holoNext, flip);
  }
  // ── 레이저 장막: 두 조가 period 초마다 엇갈려 켜진다 (편성 화면에서 고른 조가 먼저)
  const laser = of('laser'), sets = laserSets(laser);
  if (laser.length) {
    b.mem.laserOn = opt.laserB ? 1 : 0; b.mem.laserNext = C.laser.period;
    const flip = () => {
      b.mem.laserOn = b.mem.laserOn ? 0 : 1;
      b.mem.laserNext += C.laser.period;
      for (const c of laser) want(b, c.x, c.y, sets.get(c.y) === b.mem.laserOn ? TERRAIN.laser.bits : 0);
      b.emit({ k: 'fx', x: laser[0].x, y: laser[0].y, r: 0, elem: 'elec', kind: 'aura' });
      b.later(b.mem.laserNext - b.t, flip);
    };
    b.later(b.mem.laserNext, flip);
  }
  // ── 회전 금고문: 줄마다 틈 (처음 열린 칸)이 period 초마다 한 칸 오른쪽으로 (끝에서 처음으로)
  const ring = of('vault');
  if (ring.length) {
    const rows = [...new Set(ring.map((c) => c.y))].map((y) => {
      const xs = ring.filter((c) => c.y === y).sort((p, q) => p.x - q.x);
      return { y, xs: xs.map((c) => c.x), open: xs.map((c, i) => ((c.bits ?? TERRAIN.vault.bits) === 0 ? i : -1)).filter((i) => i >= 0) };
    });
    b.mem.vaultNext = C.vault.period;
    const turn = () => {
      for (const r of rows) {
        r.open = r.open.map((i) => (i + 1) % r.xs.length);
        r.xs.forEach((x, i) => want(b, x, r.y, r.open.includes(i) ? 0 : TERRAIN.vault.bits));
      }
      b.mem.vaultNext += C.vault.period;
      b.later(b.mem.vaultNext - b.t, turn);
    };
    b.later(b.mem.vaultNext, turn);
  }
  // ── 전력선: first 초에 첫 전류, 이후 period 초마다 live 초 동안 (차단기로 끈 쪽은 빠진다)
  if (power.length) {
    const src = source('전력선', power[0].x, power[0].y);
    b.mem.powNext = C.power.first; b.mem.powLive = 0; b.mem.powGen = 0;
    const start = () => {
      b.mem.powLive = 1; b.mem.powGen++;
      b.emit({ k: 'fx', x: power[0].x, y: power[0].y, r: 0, elem: 'elec', kind: 'aura' });
      b.later(C.power.live, () => { b.mem.powLive = 0; b.mem.powNext += C.power.period; b.later(b.mem.powNext - b.t, start); });
    };
    b.later(b.mem.powNext, start);
    POW_SRC.set(b, src);
  }
  // ── 스프링클러: 첫 살수 early · late 초 (편성 화면), 이후 period 초마다 전장 전체 은신 해제 + 주변 r칸 둔화 (아군 · 적 모두)
  const spr = of('sprinkler');
  if (spr.length) {
    const src = source('스프링클러', spr[0].x, spr[0].y);
    b.mem.sprNext = opt.sprLate ? C.sprinkler.late : C.sprinkler.early;
    const spray = () => {
      const hit = new Set<CUnit>();
      for (const c of spr) {
        b.emit({ k: 'fx', x: c.x, y: c.y, r: C.sprinkler.r, elem: 'elec', kind: 'aura' });
        for (const u of b.around(c, C.sprinkler.r, b.units.filter((v) => v.alive && !v.mem.neutral))) hit.add(u);
      }
      for (const u of b.units) if (u.alive && u.statuses.some((s) => s.key === 'stealth')) { u.statuses = u.statuses.filter((s) => s.key !== 'stealth'); b.emit({ k: 'status', id: u.id, name: '은신 해제', harm: true }); } // 잔디밭 전체가 젖는다
      for (const u of hit) slow(b, src, u, C.sprinkler.slowAmt, C.sprinkler.slow);
      b.mem.sprNext += C.sprinkler.period;
      b.later(b.mem.sprNext - b.t, spray);
    };
    b.later(b.mem.sprNext, spray);
  }
  // ── 매 TICK: 폐쇄 대기 칸 · 전류 · 회수 장치 · 금고 칸
  if (!holo.length && !laser.length && !ring.length && !power.length && !recov.length && !vcell.length) return;
  const recSrc = recov.length ? source('회수 장치', recov[0].x, recov[0].y) : null;
  let recT = 0, last = b.t;
  const tick = () => {
    const dt = b.t - last; // 예약이 틱 단위로 늦게 불려도 실제 흐른 시간으로 센다
    last = b.t;
    flushPend(b);
    if (b.mem.powLive) {
      const src = POW_SRC.get(b)!;
      for (const u of unitsOn(b, power)) if (u.mem.powHit !== b.mem.powGen) { u.mem.powHit = b.mem.powGen; powerHit(b, src, u); }
    }
    if (recSrc && (recT += dt) >= 1) {
      recT -= 1;
      for (const u of b.fighters(1)) if (u.category === 'soul' && recov.some((c) => b.dist(u, c) <= C.recovery.r))
        b.dealDamage(recSrc, u, b.S(u, 'maxHp') * C.recovery.soul, { elem: 'true', tag: 'dot', kind: 'tech', noHooks: true });
    }
    if (vcell.length && !b.mem.vaultPay) {
      const on = unitsOn(b, vcell).filter((u) => u.side === 0 && !u.mem.inert);
      b.mem.vaultT += on.length * dt;
      if (b.mem.vaultT >= C.vaultCell.need - 1e-9) { b.mem.vaultPay = C.vaultCell.credits; if (on[0]) b.emit({ k: 'status', id: on[0].id, name: `금고 반출 +${C.vaultCell.credits}` }); }
    }
    b.later(TICK, tick);
  };
  b.later(TICK, tick);
}
const POW_SRC = new WeakMap<Battle, CUnit>();
/** 전류: 최대 체력 dmg 몫 전기 피해 → (구조물이 아니면) 기절 · 기계 적은 광폭 */
function powerHit(b: Battle, src: CUnit, u: CUnit) {
  const P = CFG.maps.power;
  b.dealDamage(src, u, b.S(u, 'maxHp') * P.dmg, { elem: 'elec', tag: 'skill', kind: 'tech', noHooks: true });
  if (!u.alive || u.mem.neutral) return;
  b.stun(src, u, P.stun);
  if (u.side === 1 && u.keywords.includes('mech')) { rampage(b, u, P.rampage); b.emit({ k: 'status', id: u.id, name: '과부하 광폭', harm: true }); }
}
/** 주차된 차가 부서지면: 같은 차의 다른 칸도 무너지고 delay 초 뒤 주변 r칸 폭발 (최대 체력 dmg 몫 화학 피해, 아군 · 적 · 다른 차 모두 — 차가 이어 터질 수 있다) */
function carBreak(b: Battle, u: CUnit) {
  const id = u.mem.car, done = fx(b).boom;
  if (!id || done.has(id)) return;
  done.add(id);
  const parts = b.units.filter((v) => v.mem.car === id), at = parts.map((v) => ({ x: v.x, y: v.y }));
  for (const v of parts) if (v.alive) b.kill(v, null);
  const C = CFG.maps.car, src = source('주차된 차', at[0].x, at[0].y);
  for (const c of at) b.emit({ k: 'fx', x: c.x, y: c.y, r: 0, elem: 'chem', kind: 'aura' });
  b.later(C.delay, () => {
    for (const c of at) b.emit({ k: 'fx', x: c.x, y: c.y, r: C.r, elem: 'chem' });
    const hit = b.units.filter((v) => v.alive && at.some((c) => b.dist(v, c) <= C.r));
    for (const v of hit) if (v.alive) b.dealDamage(src, v, b.S(v, 'maxHp') * C.dmg, { elem: 'chem', tag: 'skill', kind: 'tech', noHooks: true });
  });
}
