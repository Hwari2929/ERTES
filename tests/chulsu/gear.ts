// 철수 봇: 장비 계획. 한 번에 '가장 이득이 큰 행동 하나'를 고르고 실제로 실행한 뒤, 런 상태를 다시 읽어 다음 행동을 고른다.
//   행동: 보관함 장비 장착 (엔진과 같은 자동 조합 규칙) · 보관함 재료 2개 조합 후 장착 · 칸이 찬 기물의 장비 교체 · 출전 기물 사이 이동 · 개조부품(문장 · 신비 부품)
//   비용: 위험 CFG.solventFrom 이상에서 장착 장비를 떼면 분리 용제 1개 (run.ts unequip). 용제가 없으면 그 행동은 후보에서 뺀다.
//   실행: 보관함 칸 번호를 기억하지 않고 id 로 그때그때 찾는다. 해제 · 장착 · 조합 결과를 확인하고, 실패한 행동은 이번 바퀴에서 건너뛴다.
import { CFG } from '../../src/config';
import { combine, gearRank, isLocked, isMat, isMod, isOccultMod } from '../../src/data/items';
import { deployed } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import type { RunState, UnitState } from '../../src/types';
import { insEv, insFail, type BotIns } from '../botlib';
import { cloneUnit, teamEval, teamWith, unitIn, type TeamEval } from './eval';
import type { DLog } from './log';

/** 장비 계획 상수 */
export const GEAR = {
  minGain: 0.001, // 무료 행동 (보관함 → 빈 칸 · 조합): 팀 가치 상대 상승이 이보다 커야 한다 (보관함 장비는 가치 0 이므로 낮게)
  solventGain: 0.03, // 용제가 드는 행동 (위험 7+): 상대 상승 하한
  moveGain: 0.01, // 출전 기물 사이 이동 (무료일 때도 잦은 이동을 막는 하한)
  benchStripMin: 2, // 대기 기물의 장비를 용제(분리 용제 사용)로 한꺼번에 뗄 최소 개수 (위험 7+)
};
const isGearId = (x: string) => /^[CGAL]_/.test(x);
/** 엔진 equip 과 같은 규칙으로 장비 칸을 바꾼다 (equipCombo: 빈 칸이 있으면 같은 기물의 재료끼리, 없으면 조합되는 장비와) */
export function virtEquip(items: (string | null)[], id: string): (string | null)[] | null {
  const it = items.slice();
  const k = it.includes(null) && !isMat(id) ? it.findIndex((x) => x && x[0] === 'C' && id[0] === 'C') : it.findIndex((x) => x && combine(x, id));
  if (k >= 0) { it[k] = combine(it[k]!, id); return it; }
  if (isMat(id)) return null; // 합성 재료는 조합만 (빈 칸에 달지 않는다)
  const e = it.indexOf(null);
  if (e < 0) return null;
  it[e] = id;
  return it;
}

type Act =
  | { k: 'equip'; id: string; uid: string }
  | { k: 'combine'; a: string; b: string; uid: string }
  | { k: 'replace'; id: string; uid: string; slot: number }
  | { k: 'move'; from: string; slot: number; uid: string }
  | { k: 'mod'; id: string; uid: string };
const actKey = (a: Act) => JSON.stringify(a);
const actName = (a: Act, run: RunState) => {
  const nm = (uid: string) => run.units.find((u) => u.uid === uid)?.defId || uid;
  switch (a.k) {
    case 'equip': return `장착 ${a.id}→${nm(a.uid)}`;
    case 'combine': return `조합 ${a.a}+${a.b}→${nm(a.uid)}`;
    case 'replace': return `교체 ${nm(a.uid)}[${a.slot}]→${a.id}`;
    case 'move': return `이동 ${nm(a.from)}[${a.slot}]→${nm(a.uid)}`;
    case 'mod': return `개조부품 ${a.id}→${nm(a.uid)}`;
  }
};

export interface GearCtx { run: RunState; ins: BotIns; log: DLog }

/** 대기 기물의 장비 회수: 위험 7 미만은 해제가 무료라 모두 보관함으로, 7 이상은 장비가 여럿이면 분리 용제(사용)로 한꺼번에 */
function releaseBench(c: GearCtx) {
  const { run } = c;
  const paid = (run.diff || 0) >= CFG.solventFrom;
  for (const u of run.units.filter((x) => !x.pos && !R.isRock(x))) {
    const slots = u.items.map((x, i) => (x && !isLocked(x) ? i : -1)).filter((i) => i >= 0);
    if (!slots.length) continue;
    if (!paid) {
      for (const k of slots) { const e = R.unequip(run, u.uid, k); if (e) { insFail(c.ins, `unequip:${e}`); break; } insEv(c.ins, 'benchFree'); }
      continue;
    }
    if (slots.length < GEAR.benchStripMin && !slots.some((k) => gearRank(u.items[k]!) >= 3)) continue;
    const i = run.inventory.indexOf('K_strip');
    if (i < 0) continue;
    const r = R.useConsumable(run, i, { k: 'unit', uid: u.uid });
    if (!r.ok) { insFail(c.ins, `use:K_strip:${r.msg}`); continue; }
    insEv(c.ins, 'solventUsed'); insEv(c.ins, 'benchStrip');
    c.log.add('gear', `대기 ${u.defId} 장비 ${slots.length}개 회수 (분리 용제)`, 0, 0, []);
  }
}

/** 장비 · 개조부품 계획 한 바퀴 */
export function planGear(c: GearCtx) {
  const { run } = c;
  releaseBench(c);
  const bad = new Set<string>();
  const paid = (run.diff || 0) >= CFG.solventFrom;
  for (let guard = 0; guard < 30; guard++) {
    const dep = deployed(run).filter((u) => !R.isRock(u));
    if (!dep.length) return;
    const base = teamEval(run, dep);
    const cands: { a: Act; gain: number; cost: number }[] = [];
    const evalItems = (u: UnitState, items: (string | null)[]) => { const x = cloneUnit(u); x.items = items; return unitIn(base, run, x); };
    const push = (a: Act, v: number, cost: number) => { if (!bad.has(actKey(a))) cands.push({ a, gain: (v - base.v) / Math.max(1e-9, base.v), cost }); };
    const inv = [...new Set(run.inventory.filter((x) => isGearId(x)))];
    const solvent = R.solventLeft(run);
    // A. 보관함 장비 장착
    for (const id of inv) for (const u of dep) {
      if (R.equipCheck(run, id, u.uid)) continue;
      const items = virtEquip(u.items, id);
      if (items) push({ k: 'equip', id, uid: u.uid }, teamWith(base, u.uid, evalItems(u, items)), 0);
    }
    // B. 보관함 재료 2개 조합 → 빈 칸에 장착 (조합식을 고른다)
    const comps = run.inventory.filter((x) => x[0] === 'C' && isGearId(x));
    const pairs = new Set<string>();
    for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) pairs.add([comps[i], comps[j]].sort().join('+'));
    for (const pr of pairs) {
      const [a, b] = pr.split('+');
      const res = combine(a, b);
      if (!res) continue;
      for (const u of dep) {
        if (!u.items.includes(null) || R.equipCheck(run, res, u.uid)) continue;
        const items = virtEquip(u.items, res);
        if (items) push({ k: 'combine', a, b, uid: u.uid }, teamWith(base, u.uid, evalItems(u, items)), 0);
      }
    }
    // C. 칸이 찬 기물: 장착 장비 하나를 떼고 보관함 장비로 (뗀 장비는 보관함 → 다음 행동에서 다시 쓸 수 있다)
    for (const u of dep) {
      if (u.items.includes(null)) continue;
      u.items.forEach((x, k) => {
        if (!x || isLocked(x)) return;
        const cost = R.solventNeed(run, u.uid, k) ? 1 : 0;
        if (cost > solvent) return;
        for (const id of inv) {
          if (gearRank(id) < gearRank(x)) continue;
          const items = virtEquip(u.items.map((y, i) => (i === k ? null : y)), id);
          if (items) push({ k: 'replace', id, uid: u.uid, slot: k }, teamWith(base, u.uid, evalItems(u, items)), cost);
        }
      });
    }
    // D. 출전 기물 사이 이동 (떼는 쪽 · 받는 쪽 모두 반영)
    for (const f of dep) f.items.forEach((x, k) => {
      if (!x || isLocked(x)) return;
      const cost = R.solventNeed(run, f.uid, k) ? 1 : 0;
      if (cost > solvent) return;
      const fe = evalItems(f, f.items.map((y, i) => (i === k ? null : y)));
      const t1: TeamEval = { ...base, per: new Map(base.per) };
      const v1 = teamWith(base, f.uid, fe);
      // 떼어 낸 뒤의 합으로 기준을 옮긴다
      const o = base.per.get(f.uid)!;
      t1.off = base.off - o.off + fe.off; t1.ehp = base.ehp - o.ehp + fe.ehp; t1.heal = base.heal - o.heal + fe.heal; t1.v = v1; t1.per.set(f.uid, fe);
      for (const u of dep) {
        if (u === f || R.equipCheck(run, x, u.uid)) continue;
        const items = virtEquip(u.items, x);
        if (items) push({ k: 'move', from: f.uid, slot: k, uid: u.uid }, teamWith(t1, u.uid, evalItems(u, items)), cost);
      }
    });
    // E. 개조부품 (문장은 시너지 인원이 바뀌므로 팀 전체를 다시 평가)
    for (const id of new Set(run.inventory.filter((x) => isMod(x)))) for (const u of dep) {
      if (R.equipCheck(run, id, u.uid)) continue;
      const x = cloneUnit(u); x.mod = id;
      const team = dep.map((y) => (y === u ? x : y));
      let v = teamEval(run, team).v;
      if (isOccultMod(id) && !u.mod) v += base.v * 0.02 * (1 + (base.per.get(u.uid)!.off / Math.max(1, base.off))); // 훅 효과는 능력치로 안 잡힌다: 비어 있는 칸 · 주력일수록 가산
      push({ k: 'mod', id, uid: u.uid }, v, 0);
    }
    // 선택: 비용 행동은 더 큰 이득이 필요하다
    const need = (x: { a: Act; cost: number }) => (x.cost ? GEAR.solventGain : x.a.k === 'move' ? Math.max(GEAR.moveGain, paid ? GEAR.solventGain : 0) : GEAR.minGain);
    const ok = cands.filter((x) => x.gain > need(x)).sort((p, q) => q.gain - q.cost * GEAR.solventGain - (p.gain - p.cost * GEAR.solventGain));
    if (!ok.length) return;
    const best = ok[0];
    const t0 = run.inventory.slice();
    const err = exec(c, best.a);
    c.log.add('gear', actName(best.a, run) + (best.cost ? ' (분리 용제 1)' : ''), base.v, base.v * (1 + best.gain), ok.slice(1, 4).map((x) => `${actName(x.a, run)} ${(x.gain * 100).toFixed(1)}%`), err || undefined);
    if (err) { bad.add(actKey(best.a)); insFail(c.ins, err); if (run.inventory.join() === t0.join()) continue; }
    else { insEv(c.ins, `gear_${best.a.k}`); if (best.cost) insEv(c.ins, 'solventUsed'); }
  }
}

/** 행동 실행: 매 단계 반환값을 확인하고, 보관함 위치는 id 로 다시 찾는다. 오류 문구 (null = 성공) */
function exec(c: GearCtx, a: Act): string | null {
  const { run } = c;
  const eq = (id: string, uid: string): string | null => {
    const i = run.inventory.lastIndexOf(id); // 방금 들어온 것이 뒤에 있다 (같은 id 는 같은 물건)
    if (i < 0) return 'equip:장비가 보관함에 없음';
    const e = R.equip(run, i, uid);
    return e ? `equip:${e}` : null;
  };
  switch (a.k) {
    case 'equip': case 'mod': return eq(a.id, a.uid);
    case 'combine': {
      const i = run.inventory.indexOf(a.a), j = a.a === a.b ? run.inventory.indexOf(a.b, i + 1) : run.inventory.indexOf(a.b);
      if (i < 0 || j < 0) return 'combine:재료가 보관함에 없음';
      const res = R.combineInv(run, i, j);
      if (!res) return 'combine:조합 불가';
      return eq(res, a.uid);
    }
    case 'replace': {
      const e = R.unequip(run, a.uid, a.slot);
      if (e) return `unequip:${e}`;
      return eq(a.id, a.uid);
    }
    case 'move': {
      const f = run.units.find((u) => u.uid === a.from), x = f?.items[a.slot];
      if (!x) return 'unequip:장비 없음';
      const e = R.unequip(run, a.from, a.slot);
      if (e) return `unequip:${e}`;
      return eq(x, a.uid);
    }
  }
}
