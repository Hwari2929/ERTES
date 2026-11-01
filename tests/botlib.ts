// 시뮬 봇 공용: 장비 · 개조부품 · 소모품 운용 (sim.ts · balance.ts 공용)
import { CFG } from '../src/config';
import { breadHeal, CONSUMABLES, CRYSTAL, DUST, gearRank, potsOf, potSlots, isConsumable, isEmblem, isForgeLegend, isGraded, isInjector, isLocked, isOccultMod, refineLv, SHARD } from '../src/data/items';
import { memberships } from '../src/engine/build';
import * as R from '../src/engine/run';
import { offerNeed, offerStage } from '../src/data/relics';
import type { AugPick, Pending, PilOffer, RunState, UnitState } from '../src/types';
import { UNIT_BY_ID } from '../src/data/units';
import { ALMS_K, BLESS_V, FAITH_H, OFFER_V, POWER_V, RELIC_G } from './pilval.gen';

export type Track = (id: string, what: 'used' | 'sold' | 'bought') => void;
/** 봇 계측 (선택): 장착 · 해제 · 소모품 사용 실패 사유와 운용 사건 수. 넘기지 않으면 동작 · 출력이 예전과 같다 (관찰만 한다) */
export interface BotIns { fail: Record<string, number>; ev: Record<string, number> }
export const newIns = (): BotIns => ({ fail: {}, ev: {} });
export const insFail = (ins: BotIns | undefined, k: string) => { if (ins) ins.fail[k] = (ins.fail[k] || 0) + 1; };
export const insEv = (ins: BotIns | undefined, k: string, n = 1) => { if (ins) ins.ev[k] = (ins.ev[k] || 0) + n; };
/** 증강 선택: 사이오닉 학파(kind 'school')는 첫 번째, 나머지는 pick (무작위) */
export function augChoice(p: { kind?: string; options: AugPick[] | null }, pick: (a: AugPick[]) => AugPick): AugPick | null {
  const o = p.options || [];
  if (!o.length) return null;
  return p.kind === 'school' ? o[0] : pick(o);
}
const GRADE: Record<string, number> = { C: 1, G: 2, A: 3, L: 4 };
const grade = (id: string | null) => (id ? GRADE[id[0]] || 0 : 0);
const gear = (u: UnitState) => u.items.filter((x): x is string => !!x && !isLocked(x));

/** 출전 기물: 공명 등급 높은 순 */
const deployedByRank = (run: RunState) => run.units.filter((u) => u.pos).sort((a, b) => b.rank - a.rank);

function use(run: RunState, i: number, tg: R.UseTarget, track?: Track, ins?: BotIns): boolean {
  const id = run.inventory[i];
  const r = R.useConsumable(run, i, tg);
  if (r.ok) track?.(id, 'used');
  else insFail(ins, `use:${id}:${r.msg}`);
  return r.ok;
}

/** 소모품 1개를 쓸 대상을 고른다 (없으면 null = 보관) */
function consumableTarget(run: RunState, id: string, xpPick?: () => UnitState | null): R.UseTarget | null {
  const dep = deployedByRank(run);
  const top = xpPick && (isInjector(id) || id === 'K_rank' || id === 'K_rank3') ? xpPick() : dep.find((u) => u.rank < CFG.maxRank); // xpPick: 철수 성장 판단 (없으면 덤비 규칙)
  if (isInjector(id)) return top ? { k: 'unit', uid: top.uid } : null;
  switch (id) {
    case 'K_rank': case 'K_rank3':
      return top ? { k: 'unit', uid: top.uid } : null;
    case 'K_bread': case 'K_bread_stale':
      // 잃은 체력이 회복량 이상일 때 (낭비 없이)
      return run.maxHp - run.hp >= breadHeal(run.diff, id === 'K_bread_stale') ? { k: 'run' } : null;
    case 'K_seize': {
      // 편성 중인 조우에서 가장 좋은 장비를 단 적: 전설 · 개조부품이면 언제나, 고급 이상이면 역경 · 도전 · 보스에서
      const enc = run.node?.enc;
      if (!enc) return null;
      let bi = -1, bv = 0;
      enc.enemies.forEach((s, i) => { const v = Math.max(0, ...R.foeGearOf(s).map(gearRank)); if (v > bv) { bv = v; bi = i; } });
      const big = run.node!.type !== 'battle';
      return bi >= 0 && (bv >= 4 || (big && bv >= 2)) ? { k: 'foe', i: bi } : null;
    }
    case 'K_morph': {
      // 대기열에서 가장 낮은 등급 기물을 바꾼다 (출전 시너지는 건드리지 않음)
      const bench = run.units.filter((u) => !u.pos).sort((a, b) => a.rank - b.rank)[0];
      return bench ? { k: 'unit', uid: bench.uid } : null;
    }
    case 'K_legend': {
      // 출전 최고 등급 기물이 든 희귀 장비 → 없으면 보관함의 희귀 장비
      for (const u of dep) { const s = u.items.findIndex((x) => x && x[0] === 'A'); if (s >= 0) return { k: 'eq', uid: u.uid, slot: s }; }
      const j = run.inventory.findIndex((x) => x[0] === 'A');
      return j >= 0 ? { k: 'inv', i: j } : null;
    }
    case 'K_copy': {
      // 가장 좋은 장착 장비 (전설 > 희귀)를 복제
      let best: R.UseTarget | null = null, bg = 2;
      for (const u of dep) u.items.forEach((x, s) => { if (x && !isLocked(x) && grade(x) > bg) { bg = grade(x); best = { k: 'eq', uid: u.uid, slot: s }; } });
      return best;
    }
    case 'K_strip': {
      // 낮은 등급 출전 기물이 좋은 장비를 들고 있고, 높은 등급 기물에 빈 칸이 있으면 몰아준다
      const roomy = dep.filter((u) => u.items.includes(null)).length;
      const low = dep.slice().reverse().find((u) => gear(u).some((x) => grade(x) >= 3));
      const lowIdx = low ? dep.indexOf(low) : -1;
      return low && roomy && dep.findIndex((u) => u.items.includes(null)) < lowIdx ? { k: 'unit', uid: low.uid } : null;
    }
    case 'K_reroll': {
      // 같은 희귀 · 전설 장비를 2개 이상 든 기물 (중복 효과를 다른 효과로)
      const u = dep.find((x) => { const g = gear(x).filter((y) => grade(y) >= 3); return new Set(g).size < g.length; });
      return u ? { k: 'unit', uid: u.uid } : null;
    }
  }
  return null;
}

/** 소모품: 쓸 곳이 있으면 쓰고, 보관함이 넘치면 쓸 데 없는 것부터 판다 */
export function useConsumables(run: RunState, track?: Track, ins?: BotIns) {
  for (let guard = 0; guard < 40; guard++) {
    const i = run.inventory.findIndex((x) => isConsumable(x) && consumableTarget(run, x));
    if (i < 0) break;
    const tg = consumableTarget(run, run.inventory[i])!;
    if (!use(run, i, tg, track, ins)) { insEv(ins, 'useBreak'); break; } // 예전 동작: 첫 실패에서 멈춘다 (덤비)
  }
  // 상황용(분리 · 재구성 · 변성)은 종류별 1개만 남기고 판매. 보관함이 절반을 넘으면 그것도 판매
  for (const id of ['K_strip', 'K_reroll', 'K_morph']) {
    const keep = run.inventory.length > CFG.inventoryMax / 2 ? 0 : 1;
    while (run.inventory.filter((x) => x === id).length > keep) {
      const j = run.inventory.indexOf(id);
      track?.(id, 'sold');
      if (id === 'K_strip' && (run.diff || 0) >= CFG.solventFrom) insEv(ins, 'solventSold');
      R.sellItem(run, j);
    }
  }
}

/** 문장: 비소속 기물에게 · 신비 부품: 개조부품 칸이 빈 높은 등급 기물에게 */
export function equipMods(run: RunState) {
  const dep = deployedByRank(run);
  for (let i = run.inventory.length - 1; i >= 0; i--) {
    const id = run.inventory[i];
    if (isEmblem(id)) { const t = dep.find((u) => !u.mod && !memberships(u).includes(id.slice(2) as never)); if (t) R.equip(run, i, t.uid); }
  }
  for (let i = run.inventory.length - 1; i >= 0; i--) {
    const id = run.inventory[i];
    if (isOccultMod(id)) { const t = dep.find((u) => !u.mod); if (t) R.equip(run, i, t.uid); }
  }
}

/** 합성 재료 (모든 봇 공용, 장비 운용 전에): 별무리 파편 → 출전 기물이 단 전설 중 제련이 가장 낮은 것 (없으면 보관함 전설),
 *  성운 가루 → 출전 기물이 단 고급 모듈 제련 (낮은 것부터) → 단 재료 → 보관함 재료와 조합 (고급 모듈) → 제련할 전설이 있으면 2개로 별무리 파편 */
export function useMats(run: RunState) {
  const dep = deployedByRank(run).filter((u) => !R.isRock(u));
  const MAX = CFG.craft.refineMax;
  const open = (ok: (x: string) => boolean) => (x: string | null) => !!x && ok(x) && refineLv(x) < MAX;
  const canG = open(isGraded), canL = open(isForgeLegend);
  /** 출전 기물 중 조건에 맞는 장비를 단 기물 (제련이 가장 낮은 것) */
  const lowest = (ok: (x: string | null) => boolean) => dep.map((u) => ({ u, k: u.items.findIndex(ok) })).filter((x) => x.k >= 0)
    .sort((a, b) => refineLv(a.u.items[a.k]!) - refineLv(b.u.items[b.k]!))[0]?.u;
  for (let guard = 0; guard < 30; guard++) {
    // 백수정 조각: 잠재능력 칸이 빈 희귀 · 전설 (전설 먼저, 출전 기물 → 보관함). 다 열렸으면 다시 뽑지 않고 둔다
    const cr = run.inventory.indexOf(CRYSTAL);
    if (cr >= 0) {
      const room = (x: string | null) => !!x && potsOf(x).length < potSlots(x);
      const t = dep.find((u) => u.items.some((x) => room(x) && x![0] === 'L')) || dep.find((u) => u.items.some(room));
      if (t && !R.equip(run, cr, t.uid)) continue;
      const g = run.inventory.findIndex(room);
      if (g >= 0 && R.combineInv(run, cr, g)) continue;
    }
    const sh = run.inventory.indexOf(SHARD);
    if (sh >= 0) {
      const t = lowest(canL);
      if (t && !R.equip(run, sh, t.uid)) continue;
      const l = run.inventory.findIndex(canL);
      if (l >= 0 && R.combineInv(run, sh, l)) continue;
    }
    const d = run.inventory.indexOf(DUST);
    if (d < 0) break;
    const tg = lowest(canG);
    if (tg && !R.equip(run, d, tg.uid)) continue;
    const withC = dep.find((u) => u.items.some((x) => x && x[0] === 'C'));
    if (withC && !R.equip(run, d, withC.uid)) continue;
    const c = run.inventory.findIndex((x) => x[0] === 'C');
    if (c >= 0 && R.combineInv(run, d, c)) continue;
    const d2 = run.inventory.indexOf(DUST, d + 1);
    if (d2 >= 0 && (lowest(canL) || run.inventory.some(canL)) && R.combineInv(run, d, d2)) continue;
    break;
  }
}

/** 일반 장비: 재료는 같은 재료 든 기물(고급 조합) → 빈 칸, 칸이 차면 재료 하나를 빼고 더 좋은 장비로 */
export function equipGear(run: RunState, ins?: BotIns) {
  const sorted = deployedByRank(run);
  const isGear = (x: string) => /^[CGAL]_/.test(x);
  for (let guard = 0; guard < 20 && run.inventory.some(isGear); guard++) {
    const idx = run.inventory.findIndex(isGear);
    const it = run.inventory[idx];
    let target = sorted.find((u) => it[0] === 'C' && u.items.some((x) => x && x[0] === 'C')) || sorted.find((u) => u.items.includes(null));
    if (!target && it[0] !== 'C') {
      target = sorted.find((u) => u.items.some((x) => x && x[0] === 'C'));
      if (target) {
        const k = target.items.findIndex((x) => x && x[0] === 'C');
        const ue = R.unequip(run, target.uid, k); // 예전 동작: 반환값을 보지 않는다 (덤비). 계측만
        if (ue) insFail(ins, `unequip:${ue}`);
        if (ins && run.inventory[idx] !== it) insEv(ins, 'staleIdx'); // 해제로 보관함이 바뀌어 기억한 칸이 다른 물건을 가리킨다
      }
    }
    if (!target) { insEv(ins, 'gearNoTarget'); break; }
    const e = R.equip(run, idx, target.uid);
    if (e) { insFail(ins, `equip:${e}`); insEv(ins, 'gearBreak'); break; }
  }
}

/** 장비 운용 한 바퀴 (신비학자 부품 지급 확인 포함) */
export function manageItems(run: RunState, track?: Track, ins?: BotIns) {
  R.checkOccult(run);
  consecrateBot(run);
  useMats(run);
  equipMods(run);
  useConsumables(run, track, ins);
  equipGear(run, ins);
  useConsumables(run, track, ins); // 해제 · 복제로 생긴 장비 반영 후 한 번 더
  equipGear(run, ins);
}

// ───────────────────────── 라라 (rara): 덤비 + 장비 운용 결함 수정만 (판단 정책은 덤비와 같다)
const isGearId = (x: string) => /^[CGAL]_/.test(x);
/** 위험 CFG.solventFrom 이상: 분리 용제를 남길 개수 = 출전 기물이 단 재료(교체 예정 후보) 수, 1 ~ 4 */
export function solventKeep(run: RunState): number {
  if ((run.diff || 0) < CFG.solventFrom) return -1; // 규칙 없음 (예전처럼)
  const c = run.units.filter((u) => u.pos).reduce((s, u) => s + u.items.filter((x) => x && x[0] === 'C').length, 0);
  return Math.max(1, Math.min(4, c));
}
/** 소모품 (결함 수정판): 사용 실패는 그 물건만 건너뛰고 계속 · 위험 7 이상은 분리 용제를 전략 자원으로 남긴다 */
export function useConsumablesFix(run: RunState, track?: Track, ins?: BotIns, opt: { noStrip?: boolean; noSeize?: boolean; xpPick?: () => UnitState | null } = {}) {
  const bad = new Set<string>();
  for (let guard = 0; guard < 40; guard++) {
    const i = run.inventory.findIndex((x) => isConsumable(x) && !bad.has(x) && !(opt.noStrip && x === 'K_strip') && !(opt.noSeize && x === 'K_seize') && consumableTarget(run, x, opt.xpPick));
    if (i < 0) break;
    const id = run.inventory[i];
    const tg = consumableTarget(run, id, opt.xpPick)!;
    if (!use(run, i, tg, track, ins)) bad.add(id);
  }
  const keepS = solventKeep(run);
  for (const id of ['K_strip', 'K_reroll', 'K_morph']) {
    const keep = id === 'K_strip' && keepS >= 0 ? keepS + 1 : run.inventory.length > CFG.inventoryMax / 2 ? 0 : 1; // 위험 7 이상: 교체 예정 수 + 예비 1
    while (run.inventory.filter((x) => x === id).length > keep) {
      const j = run.inventory.indexOf(id);
      track?.(id, 'sold');
      R.sellItem(run, j);
    }
  }
}
/** 일반 장비 (결함 수정판): 덤비와 같은 우선순위 (재료 → 같은 재료 든 기물 · 빈 칸, 칸이 차면 재료 하나를 빼고 더 좋은 장비로).
 *  - 해제 결과를 확인하고 (용제 부족 · 보관함 가득), 실패하면 그 조합을 건너뛴다
 *  - 보관함이 바뀐 뒤에는 장착할 장비를 id 로 다시 찾는다 (기억한 칸 번호를 쓰지 않는다)
 *  - 장착 실패는 그 (장비, 기물) 조합만 건너뛰고 다른 장비 · 기물을 계속 검토한다. 무한 반복은 guard 로 막는다 */
export function equipGearFix(run: RunState, ins?: BotIns) {
  const sorted = deployedByRank(run);
  const badPair = new Set<string>(), badItem = new Set<string>();
  for (let guard = 0; guard < 40; guard++) {
    const it = run.inventory.find((x) => isGearId(x) && !badItem.has(x));
    if (!it) break;
    const ok = (u: UnitState) => !badPair.has(`${it}>${u.uid}`) && !R.isRock(u);
    let target = sorted.find((u) => ok(u) && it[0] === 'C' && u.items.some((x) => x && x[0] === 'C')) || sorted.find((u) => ok(u) && u.items.includes(null));
    let freed = false;
    if (!target && it[0] !== 'C') {
      target = sorted.find((u) => ok(u) && u.items.some((x) => x && x[0] === 'C'));
      if (target) {
        const k = target.items.findIndex((x) => x && x[0] === 'C');
        const pay = R.solventNeed(run, target.uid, k);
        if (pay && R.solventLeft(run) < 1) { insFail(ins, 'unequip:분리 용제 없음 (사전 확인)'); badPair.add(`${it}>${target.uid}`); continue; }
        const ue = R.unequip(run, target.uid, k);
        if (ue) { insFail(ins, `unequip:${ue}`); badPair.add(`${it}>${target.uid}`); continue; }
        freed = true;
        if (pay) insEv(ins, 'solventUsed');
      }
    }
    if (!target) { badItem.add(it); continue; }
    const idx = run.inventory.indexOf(it); // 보관함이 바뀌었을 수 있다: id 로 다시 찾는다
    if (idx < 0) { insFail(ins, 'equip:장비가 사라짐'); badItem.add(it); continue; }
    const e = R.equip(run, idx, target.uid);
    if (e) { insFail(ins, `equip:${e}`); badPair.add(`${it}>${target.uid}`); if (freed) insEv(ins, 'freedButFailed'); }
  }
}
/** 라라: 장비 운용 한 바퀴 (덤비와 같은 순서) */
export function manageItemsFix(run: RunState, track?: Track, ins?: BotIns) {
  R.checkOccult(run);
  consecrateBot(run);
  useMats(run);
  equipMods(run);
  useConsumablesFix(run, track, ins);
  equipGearFix(run, ins);
  useConsumablesFix(run, track, ins);
  equipGearFix(run, ins);
}

/** 전환: 신비학자 활성 + 크레딧 여유면 합성, 아니면 기존 규칙 */
export function forkChoice(run: RunState, coin: () => boolean): 'rest' | 'challenge' | 'synth' {
  if (R.occultTier(run) && run.credits >= 20) return 'synth';
  return run.hp > 60 && coin() ? 'challenge' : 'rest';
}

/** 합성 공방: 쓸 곳이 있는 소모품만, 비싼 것부터 (예비 5 남김) */
export function shopSynth(run: RunState, track?: Track) {
  const stock = run.node?.shop || [];
  const want = (id: string) => id === 'K_rank' || id === 'K_legend' || id === 'K_copy' || (id === 'K_morph' && run.units.some((u) => !u.pos));
  stock.map((s, i) => ({ s, i })).sort((a, b) => b.s.price - a.s.price).forEach(({ s, i }) => {
    if (s.sold || !want(s.item) || run.credits - s.price < 5) return;
    if (R.buyShop(run, i) === null) track?.(s.item, 'bought');
  });
  R.leaveShop(run);
}
export { CONSUMABLES };

/** 순례 봇 실측표 (tests/pilval.gen.ts — balance.ts pilval 복제 굴림, 단위 크레딧) 를 쓰는 규칙.
 *  권능은 다음 순례의 성유물 · 개종을 위해 PIL_RESERVE 만큼 남기고 축성한다 (마지막 페이즈에는 모두 축성). */
export const PIL = { reserve: 30, margin: 5, battlesPerPhase: 4.9, bench: 0.5 };
/** 이번 페이즈에만 걸리는 효과 (축복) 의 기간 몫: 이번 페이즈 남은 전투 ÷ 런 남은 전투 */
const blessShare = (run: RunState) => {
  const rem = PIL.battlesPerPhase * Math.max(0.5, 12 - run.step) / 12;
  return rem / (rem + PIL.battlesPerPhase * Math.max(0, CFG.victoryPhase - run.phase));
};
const offerVal = (u: UnitState, gain: number) => {
  let v = 0, o = u.offer || 0;
  for (let left = gain; left > 0 && offerStage(o) < CFG.offer.max;) { const sg = offerStage(o), d = Math.min(left, offerNeed(sg + 1) - o); v += d * OFFER_V[sg]; o += d; left -= d; }
  return v;
};
/** 순례 고르기 카드 점수 (크레딧): 제례 = 축복 × 기간 몫 + 대상 디바인 봉헌 +gain (대기 기물은 PIL.bench 배), 나눔 = 공시 가치 × ALMS_K */
export function pilgrimCardScore(run: RunState, o: PilOffer): number {
  if (o.k === 'alms') return (o.value || 0) * ALMS_K;
  const bl = o.bless ? (BLESS_V[o.bless] || 0) * blessShare(run) : 0;
  return bl + R.riteUnits(run, o.faith).reduce((a, u) => a + offerVal(u, o.gain) * (u.pos ? 1 : PIL.bench), 0);
}
const relicG = (id: string | undefined) => (id ? RELIC_G[id] ?? 0 : 0);
const faithOf = (u: UnitState) => u.faith || UNIT_BY_ID[u.defId].faith;
/** 진열장: 순이득 (성유물 · 신앙 이득 − 권능 × POWER_V) 이 PIL.margin 보다 큰 것부터 산다. 산 성유물은 이득이 가장 큰 출전 디바인에 장착 */
function pilgrimShelf(run: RunState, p: Extract<Pending, { t: 'pilgrim' }>) {
  const dv = () => R.divines(run).filter((u) => u.pos);
  for (let g = 0; g < 4; g++) {
    let best: { net: number; f: () => void } | null = null;
    (p.relics || []).forEach((o, i) => {
      if (o.sold || run.power < o.cost) return;
      for (const u of dv()) {
        const net = relicG(o.id) - relicG(u.relic) - o.cost * POWER_V;
        if (net > PIL.margin && (!best || net > best.net)) best = { net, f: () => { if (!R.pilgrimRelic(run, i)) R.equipRelic(run, u.uid, o.id); } };
      }
    });
    const c = p.convert;
    if (c && !c.sold && run.power >= c.cost) for (const u of dv()) {
      if (faithOf(u) === c.faith) continue;
      const net = (FAITH_H[c.faith] ?? 0) - (FAITH_H[faithOf(u)] ?? 0) - c.cost * POWER_V;
      if (net > PIL.margin && (!best || net > best.net)) best = { net, f: () => { R.pilgrimConvert(run, u.uid); } };
    }
    if (!best) break;
    (best as { f: () => void }).f();
  }
  // 보관함 성유물: 지금 것보다 나으면 출전 디바인에 (바꾼 것은 보관함으로)
  for (let g = 0; g < 6; g++) {
    let best: { id: string; u: UnitState; d: number } | null = null;
    for (const id of run.relics || []) for (const u of dv()) { const d = relicG(id) - relicG(u.relic); if (d > 0 && (!best || d > best.d)) best = { id, u, d }; }
    if (!best) break;
    R.equipRelic(run, best.u.uid, best.id);
  }
}
/** 순례: 고르기 카드는 점수 (pilgrimCardScore) 가 큰 것, 진열장은 pilgrimShelf, 남은 권능으로 축성 (PIL.reserve 를 남기고) */
export function pilgrimBot(run: RunState) {
  const p = run.pending.find((x) => x.t === 'pilgrim');
  if (!p || p.t !== 'pilgrim') return;
  if (p.took === undefined && p.offers.length) {
    const best = p.offers.map((_, i) => i).sort((a, b) => pilgrimCardScore(run, p.offers[b]) - pilgrimCardScore(run, p.offers[a]))[0];
    R.pilgrimTake(run, best);
  }
  pilgrimShelf(run, p);
  consecrateBot(run);
}
/** 축성: 권능이 CFG.consecrate.cost 이상이면 다음 단계까지 남은 봉헌이 가장 적은 디바인부터 (출전 기물 먼저, 기물마다 페이즈당 1번).
 *  마지막 페이즈가 아니면 PIL.reserve 를 남긴다 (다음 순례의 성유물 · 개종 몫) */
export function consecrateBot(run: RunState) {
  const keep = run.phase >= CFG.victoryPhase ? 0 : PIL.reserve;
  const left = (u: UnitState) => offerNeed(offerStage(u.offer) + 1) - (u.offer || 0);
  for (;;) {
    if (run.power - CFG.consecrate.cost < keep) break;
    const c = R.divines(run).filter((u) => !R.consecrateWhy(run, u)).sort((a, b) => +!!b.pos - +!!a.pos || left(a) - left(b))[0];
    if (!c || R.consecrate(run, c.uid)) break;
  }
}

/** 포탑 장비 선호 순서: 포탑을 앞줄 탱커로 쓰므로 (tests/chulsu/form.ts place) 버티는 장비 → 화력 순 */
export const TURRET_PREF = ['T_plate', 'T_barrier', 'T_cal', 'T_rapid', 'T_mark', 'T_cryo', 'T_tesla', 'T_ammo', 'T_snipe', 'T_flame', 'T_selfd'];
/** 대기 중인 포탑 장비 고르기 하나를 선호 순서대로 확정 (pickTurretMod 가 대기열에서 빼고, 모자라면 다음 고르기를 맨 앞에 넣는다) */
export function turretPickBot(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'turretPick') return;
  const id = TURRET_PREF.find((x) => p.options.includes(x)) ?? p.options[0];
  if (R.pickTurretMod(run, id) !== null && run.pending[0] === p) run.pending.shift();
}
