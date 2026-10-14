// 시뮬 봇 공용: 장비 · 개조부품 · 소모품 운용 (sim.ts · balance.ts 공용)
import { CFG } from '../src/config';
import { CONSUMABLES, isConsumable, isEmblem, isLocked, isOccultMod } from '../src/data/items';
import { memberships } from '../src/engine/build';
import * as R from '../src/engine/run';
import type { AugPick, RunState, UnitState } from '../src/types';

export type Track = (id: string, what: 'used' | 'sold' | 'bought') => void;
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

function use(run: RunState, i: number, tg: R.UseTarget, track?: Track): boolean {
  const id = run.inventory[i];
  const r = R.useConsumable(run, i, tg);
  if (r.ok) track?.(id, 'used');
  return r.ok;
}

/** 소모품 1개를 쓸 대상을 고른다 (없으면 null = 보관) */
function consumableTarget(run: RunState, id: string): R.UseTarget | null {
  const dep = deployedByRank(run);
  const top = dep.find((u) => u.rank < CFG.maxRank);
  switch (id) {
    case 'K_rank': case 'K_xp':
      return top ? { k: 'unit', uid: top.uid } : null;
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
export function useConsumables(run: RunState, track?: Track) {
  for (let guard = 0; guard < 40; guard++) {
    const i = run.inventory.findIndex((x) => isConsumable(x) && consumableTarget(run, x));
    if (i < 0) break;
    const tg = consumableTarget(run, run.inventory[i])!;
    if (!use(run, i, tg, track)) break;
  }
  // 상황용(분리 · 재구성 · 변성)은 종류별 1개만 남기고 판매. 보관함이 절반을 넘으면 그것도 판매
  for (const id of ['K_strip', 'K_reroll', 'K_morph']) {
    const keep = run.inventory.length > CFG.inventoryMax / 2 ? 0 : 1;
    while (run.inventory.filter((x) => x === id).length > keep) {
      const j = run.inventory.indexOf(id);
      track?.(id, 'sold');
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

/** 일반 장비: 재료는 같은 재료 든 기물(고급 조합) → 빈 칸, 칸이 차면 재료 하나를 빼고 더 좋은 장비로 */
export function equipGear(run: RunState) {
  const sorted = deployedByRank(run);
  const isGear = (x: string) => /^[CGAL]_/.test(x);
  for (let guard = 0; guard < 20 && run.inventory.some(isGear); guard++) {
    const idx = run.inventory.findIndex(isGear);
    const it = run.inventory[idx];
    let target = sorted.find((u) => it[0] === 'C' && u.items.some((x) => x && x[0] === 'C')) || sorted.find((u) => u.items.includes(null));
    if (!target && it[0] !== 'C') {
      target = sorted.find((u) => u.items.some((x) => x && x[0] === 'C'));
      if (target) { const k = target.items.findIndex((x) => x && x[0] === 'C'); R.unequip(run, target.uid, k); }
    }
    if (!target || R.equip(run, idx, target.uid)) break;
  }
}

/** 장비 운용 한 바퀴 (신비학자 부품 지급 확인 포함) */
export function manageItems(run: RunState, track?: Track) {
  R.checkOccult(run);
  equipMods(run);
  useConsumables(run, track);
  equipGear(run);
  useConsumables(run, track); // 해제 · 복제로 생긴 장비 반영 후 한 번 더
  equipGear(run);
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

/** 순례: 강화(가장 싼 성유물) → 순례자의 기도 · 성배 · 성인 기념일 · 성유 순으로 살 수 있는 만큼 */
export function pilgrimBot(run: RunState) {
  const p = run.pending.find((x) => x.t === 'pilgrim');
  if (!p || p.t !== 'pilgrim') return;
  const dv = R.divines(run).sort((a, b) => b.rank - a.rank);
  const order = ['prayer', 'saintday', 'grail', 'chrism', 'indulgence', 'bless:B.sanctum', 'bless:B.martyr', 'bless:B.flame', 'bless:B.zeal'];
  for (const id of order) {
    const i = (p.cards || []).findIndex((c) => c.id === id && !c.sold);
    if (i >= 0 && run.power >= p.cards![i].cost) R.pilgrimCard(run, i, dv[0]?.uid);
  }
  if (dv[0] && !dv[0].enh) R.enhanceRelic(run, dv[0].uid);
}
