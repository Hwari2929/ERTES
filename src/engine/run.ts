import { CFG } from '../config';
import { AUG_BY_ID, COMMON_AUGS } from '../data/augments';
import { BOSS_ROTATION, ENEMIES, ENEMY_BY_ID } from '../data/enemies';
import { BLESSING_BY_ID, BLESSINGS, GLOBAL_BY_ID, GLOBALS } from '../data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, combine, isLocked, itemInfo } from '../data/items';
import { SYN_BY_ID, tierOf } from '../data/synergies';
import { UNIT_BY_ID, UNITS } from '../data/units';
import { Rng } from '../rng';
import {
  type AugPick, type Encounter, type EnemySpawn, type Major, MAJORS, MAJOR_NAME, type NodeType, type Pending,
  type Quest, type RunState, type UnitState,
} from '../types';
import { deployed, memberships, playerRows, synergyCounts } from './build';
import type { Battle } from './combat';

export const SAVE_VERSION = 3;

export function rng<T>(run: RunState, f: (r: Rng) => T): T {
  const r = new Rng(run.rng);
  const out = f(r);
  run.rng = r.s;
  return out;
}
const zeroMajors = (): Record<Major, number> => ({ vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 });
const log = (run: RunState, s: string) => { run.log.unshift(s); if (run.log.length > 60) run.log.length = 60; };
export const hasGlobal = (run: RunState, id: string) => run.globals.includes(id);

// ───────────────────────── 런 생성
export function newRun(seed: number, starters: string[]): RunState {
  const run: RunState = {
    version: SAVE_VERSION, seed, rng: seed, phase: 1, step: 0, map: phaseMap(), picked: [], node: null,
    hp: CFG.playerHp, maxHp: CFG.playerHp, credits: CFG.startCredits, streak: 0, units: [], inventory: [],
    globals: [], pending: [], quests: [], questPhase: 0, loan: 0, faith: 0, fame: 0, blessing: null, staffTarget: null, aceTarget: null, nextUid: 1, log: [],
    stats: { wins: 0, losses: 0, kills: 0, bestHit: 0 }, over: false,
  };
  for (const id of starters) addUnit(run, id, 1);
  autoPlace(run);
  if (tierNow(run, 'CLERIC')) run.map.unshift(['pilgrim']);
  run.pending.push({ t: 'global', options: rollGlobals(run) });
  log(run, '용병단 ERRANTEs, 출격.');
  return run;
}

/** 페이즈 노드 구성: 전투 4 + 보스 1, 중간 영입 1, 상점/보급 선택 2 */
export function phaseMap(): NodeType[][] {
  return [['battle'], ['battle', 'adversity'], ['recruit'], ['shop', 'supply'], ['battle', 'adversity'], ['battle'], ['shop', 'supply'], ['boss']];
}

export function addUnit(run: RunState, defId: string, rank: number): UnitState {
  const u: UnitState = {
    uid: `u${run.nextUid++}`, defId, rank: 1, xp: 0, alloc: zeroMajors(), perm: zeroMajors(), augments: [],
    items: [UNIT_BY_ID[defId].item || null, null, null], pos: null,
  };
  run.units.push(u);
  for (let r = 2; r <= rank; r++) rankUp(run, u);
  return u;
}

/** 탐험가(아문센)는 정해진 페이즈 전에는 배치할 수 없다 */
export const canDeploy = (run: RunState, u: UnitState) => !UNIT_BY_ID[u.defId].traits.includes('EXPLORER') || run.phase >= CFG.explorerPhase;

export const deployCap = (run: RunState) => CFG.deployCap(run.phase) + (hasGlobal(run, 'G.squad') ? 1 : 0);

export function autoPlace(run: RunState) {
  const cap = deployCap(run);
  const used = new Set(run.units.filter((u) => u.pos).map((u) => `${u.pos!.c},${u.pos!.r}`));
  for (const u of run.units) {
    if (u.pos || deployed(run).length >= cap || !canDeploy(run, u)) continue;
    const def = UNIT_BY_ID[u.defId];
    const rowsPref = def.range <= 1 ? [2, 1, 0] : [0, 1, 2];
    outer: for (const r of rowsPref)
      for (const c of [3, 2, 4, 1, 5, 0, 6]) {
        if (!used.has(`${c},${r}`)) { u.pos = { c, r }; used.add(`${c},${r}`); break outer; }
      }
  }
}

// ───────────────────────── 노드 진행
export function currentOptions(run: RunState): NodeType[] { return run.map[run.step] || []; }

export function enterNode(run: RunState, type: NodeType) {
  run.picked[run.step] = type;
  if (type !== 'battle' && type !== 'adversity' && type !== 'boss') run.fame += tierNow(run, 'STAR');
  if (type === 'pilgrim') {
    const t = tierNow(run, 'CLERIC');
    run.faith += 2 + 2 * t;
    run.pending.push({ t: 'blessing', options: rng(run, (r) => r.sample(BLESSINGS.map((b) => b.id), 3)) });
    log(run, `순례: 신앙 +${2 + 2 * t}`);
    advance(run);
    return;
  }
  if (type === 'news') { run.node = { type, news: genNews(run) }; return; }
  if (type === 'battle' || type === 'adversity' || type === 'boss') {
    run.node = { type, enc: genEncounter(run, type) };
    syncQuests(run);
  } else if (type === 'shop') {
    run.node = { type, shop: genShop(run) };
  } else if (type === 'supply') {
    run.pending.push({ t: 'supply', options: rng(run, (r) => r.sample(['parts', 'credits', 'xp', 'repair', r.chance(CFG.drop.supplyAdv) ? 'adv' : 'parts2'], 3)) });
    advance(run);
  } else if (type === 'recruit') {
    const pool = UNITS.filter((d) => !run.units.some((u) => u.defId === d.id)).map((d) => d.id);
    if (!pool.length || run.units.length >= CFG.maxParty) {
      run.credits += 10;
      const why = pool.length ? `보유 한도(${CFG.maxParty}명)에 도달해` : '영입할 수 있는 기물이 없어';
      run.pending.push({ t: 'notice', title: '영입 불가', body: `${why} 크레딧 +10 으로 대체합니다.` });
    } else {
      const k = 3 + (hasGlobal(run, 'G.scout') ? 1 : 0);
      run.pending.push({ t: 'recruit', options: rng(run, (r) => r.sample(pool, k)) });
    }
    advance(run);
  }
}

export function leaveShop(run: RunState) { run.node = null; advance(run); }

const tierNow = (run: RunState, id: 'CLERIC' | 'STAR') => tierOf(id, synergyCounts(deployed(run))[id] || 0);

export function advance(run: RunState) {
  run.node = null;
  run.step++;
  if (run.step >= run.map.length) {
    run.phase++;
    run.step = 0;
    run.map = phaseMap();
    run.picked = [];
    autoPlace(run);
    run.blessing = null;
    log(run, `페이즈 ${run.phase} 진입. 적이 강해집니다.`);
    if ((run.phase - 1) % CFG.globalAugEvery === 0) run.pending.push({ t: 'global', options: rollGlobals(run) });
    // 성직자가 활성화된 채 페이즈를 시작하면 순례 노드가 맨 앞에 추가
    if (tierNow(run, 'CLERIC')) run.map.unshift(['pilgrim']);
  }
  // 은하 대스타가 활성화되어 있으면 보스 직전에 속보 노드 추가
  if (run.map[run.step]?.includes('boss') && run.map[run.step - 1]?.[0] !== 'news' && tierNow(run, 'STAR')) {
    run.map.splice(run.step, 0, ['news']);
  }
}

function rollGlobals(run: RunState): string[] {
  const pool = GLOBALS.filter((g) => !(g.unique && run.globals.includes(g.id))).map((g) => g.id);
  return rng(run, (r) => r.sample(pool, 3));
}
export function pickGlobal(run: RunState, id: string) {
  run.globals.push(id);
  GLOBAL_BY_ID[id].onPick?.(run);
  if (id === 'G.armory') for (let i = 0; i < 2; i++) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)));
  autoPlace(run);
}

// ───────────────────────── 조우 생성
export function genEncounter(run: RunState, type: NodeType): Encounter {
  return rng(run, (r) => {
    const env = r.weighted(CFG.boardSizes, (x) => x.w);
    const n = type === 'boss' ? CFG.bossBoard : env.n;
    const rows = playerRows(n);
    const p = run.phase;
    const enemies: EnemySpawn[] = [];
    const ids: string[] = [];
    if (type === 'boss') {
      const boss = BOSS_ROTATION[(p - 1) % BOSS_ROTATION.length];
      ids.push(boss, ...(ENEMY_BY_ID[boss].escort || []));
      const extra = Math.max(0, Math.min(6, p - 1));
      const pool = ENEMIES.filter((e) => e.tier === 'minion' && e.minPhase <= p).map((e) => e.id);
      for (let i = 0; i < extra; i++) ids.push(r.pick(pool));
    } else {
      const late = run.step >= 4 ? 1 : 0;
      const count = Math.min(rows * n - 2, 2 + p + late);
      const pool = ENEMIES.filter((e) => e.tier === 'minion' && e.minPhase <= p).map((e) => e.id);
      if (type === 'adversity' || (p >= 3 && r.chance(0.3))) ids.push('warlord');
      while (ids.length < count) ids.push(r.pick(pool));
    }
    // 근접은 앞줄, 원거리는 뒷줄
    const front = rows - 1;
    const taken = new Set<string>();
    for (const id of ids) {
      const d = ENEMY_BY_ID[id];
      const order = d.melee ? [front, front - 1, 0] : [0, 1, front];
      let placed = false;
      for (const row of order) {
        if (row < 0 || row >= rows) continue;
        const cols = r.shuffle([...Array(n).keys()]);
        for (const c of cols) if (!taken.has(`${c},${row}`)) { taken.add(`${c},${row}`); enemies.push({ defId: id, c, row }); placed = true; break; }
        if (placed) break;
      }
    }
    return {
      n, env: type === 'boss' ? '보스 아레나' : env.env, enemies,
      mult: type === 'adversity' ? CFG.adversityMult : 1 + 0.04 * run.step,
      seed: r.int(1, 2 ** 31 - 1),
    };
  });
}

// ───────────────────────── 전투 결과
export interface BattleSummary {
  won: boolean;
  lines: string[];
  xp: { uid: string; amount: number }[];
  hpLoss: number;
  gameOver: boolean;
}

export function resolveBattle(run: RunState, b: Battle): BattleSummary {
  const type = run.node!.type;
  const won = b.winner === 0;
  const p = run.phase;
  const lines: string[] = [];
  const dep = deployed(run);
  const counts = synergyCounts(dep);
  const pet = tierOf('PET', counts.PET || 0);
  const uni = tierOf('UNI', counts.UNI || 0);

  // 이자 (수입 전 보유량 기준)
  const cap = CFG.interestMax + (pet >= 1 ? 3 : 0) + (pet >= 3 ? 3 : 0) + (hasGlobal(run, 'G.interest') ? 5 : 0);
  const interest = Math.min(cap, Math.floor(run.credits / CFG.interestPer));
  let income = interest;
  if (interest) lines.push(`이자 +${interest} (상한 ${cap})`);

  let hpLoss = 0;
  if (won) {
    run.streak = Math.max(1, run.streak + 1);
    run.stats.wins++;
    let c = CFG.winCredits(p);
    if (type === 'adversity') c = Math.round(c * 1.5);
    if (type === 'boss') c += 5;
    income += c;
    lines.push(`승리 보상 +${c}`);
    const sb = CFG.streakBonus(run.streak);
    if (sb) { income += sb; lines.push(`${run.streak}연승 보너스 +${sb}`); }
    if (pet >= 1) { income += 1; lines.push('페트라 실적 +1'); }
    if (type === 'adversity') {
      if (rng(run, (r) => r.chance(CFG.drop.adversity))) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines);
    } else if (type === 'battle') {
      if (rng(run, (r) => r.chance(CFG.drop.battle))) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines);
    } else if (type === 'boss') {
      // 보스 전리품: n 페이즈마다 고급 장비, 그 외에는 확률로 재료 3개 중 1개
      if (p % CFG.drop.bossAdvEvery === 0) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 고급 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)) });
      else if (rng(run, (r) => r.chance(CFG.drop.bossPart))) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 장비 재료 1개 선택', options: rng(run, (r) => r.sample(ALL_COMPONENTS, 3)) });
      lines.push(`페이즈 ${p} 클리어!`);
    }
  } else {
    run.streak = 0;
    run.stats.losses++;
    income += CFG.lossCredits;
    const survivors = b.living(1).length;
    hpLoss = type === 'boss' ? CFG.bossLossDamage(p) : CFG.lossDamage(p, survivors) * (type === 'adversity' ? 1.5 : 1);
    if (pet >= 2) { hpLoss *= 0.5; income += 6; lines.push('페트라 보험금 +6, 체력 피해 50% 감소'); }
    if (hasGlobal(run, 'G.survival')) hpLoss *= 0.7;
    hpLoss = Math.round(hpLoss);
    run.hp -= hpLoss;
    lines.push(`패배 — 체력 -${hpLoss}`);
    if (type === 'boss') lines.push('보스를 쓰러뜨려야 다음 페이즈로 넘어갈 수 있습니다.');
  }
  if (run.loan > 0) {
    const pay = Math.min(10, run.loan, run.credits + income);
    run.loan -= pay;
    income -= pay;
    lines.push(`대출 상환 -${pay} (잔액 ${run.loan})`);
  }
  run.credits += income;

  // 공명도
  const xpBefore = new Map(run.units.map((u) => [u.uid, u.xp + totalXpOf(u)]));
  let pool = CFG.xpPool(p) * (won ? 1 : 0.5) * (type === 'adversity' ? 1.5 : 1) * (hasGlobal(run, 'G.resonance') ? 1.35 : 1);
  pool = Math.round(pool);
  distributeXp(run, pool);
  lines.push(`공명도 풀 ${pool} 분배`);
  if (uni) for (const u of dep) if (memberships(u).includes('UNI')) u.xp += uni;
  const killsOf = (u: UnitState) => b.units.find((c) => c.src === u)?.counters.kills || 0;
  for (const u of dep) for (const a of u.augments) AUG_BY_ID[a.id]?.after?.(run, u, won, killsOf(u));
  // 성직자: 승리 시 신앙 / 대스타: 승리 시 명성 + 대스타 처치 수
  const cleric = tierOf('CLERIC', counts.CLERIC || 0), star = tierOf('STAR', counts.STAR || 0);
  if (won && cleric) { run.faith += cleric; lines.push(`신앙 +${cleric} (현재 ${run.faith})`); }
  if (star) {
    const starKills = dep.filter((u) => memberships(u).includes('STAR')).reduce((sum, u) => sum + killsOf(u), 0);
    const f = (won ? 2 * star : 0) + Math.floor(starKills / 3);
    if (f) { run.fame += f; lines.push(`명성 +${f} (현재 ${run.fame})`); }
  }
  for (const u of run.units) settleXp(run, u);
  const xp = run.units.map((u) => ({ uid: u.uid, amount: u.xp + totalXpOf(u) - xpBefore.get(u.uid)! }));

  // 헬레니우스 퀘스트
  questProgress(run, b, won, type, lines);

  run.stats.kills += b.counters.kills;
  run.stats.bestHit = Math.max(run.stats.bestHit, Math.round(b.counters.bestHit));
  log(run, `P${p} ${type === 'boss' ? '보스' : type === 'adversity' ? '역경' : '전투'} ${won ? '승리' : '패배'}`);

  let gameOver = false;
  if (run.hp <= 0) { run.hp = 0; run.over = true; gameOver = true; }
  else if (won || type !== 'boss') advance(run);
  else run.node = { type: 'boss', enc: genEncounter(run, 'boss') };
  return { won, lines, xp, hpLoss, gameOver };
}

function totalXpOf(u: UnitState) { let t = 0; for (let r = 1; r < u.rank; r++) t += CFG.xpToNext(r); return t; }

/** 공명도 풀을 파티 전체에 무작위 분배 (최소 1pt 보정) */
export function distributeXp(run: RunState, pool: number) {
  // 출전 기물은 최소 1 보장, 대기 기물은 가중치를 낮춰 나눠 받는다
  const us = run.units;
  if (!us.length) return;
  rng(run, (r) => {
    const base = (u: UnitState) => (u.pos ? 1 : 0);
    const share = new Map(us.map((u) => [u.uid, base(u)]));
    const minSum = us.reduce((s, u) => s + base(u), 0);
    let rest = Math.max(0, pool - minSum);
    const w = us.map((u) => (0.15 + r.next()) * (u.pos ? 1 : CFG.benchXpWeight));
    const tw = w.reduce((a, b) => a + b, 0);
    us.forEach((u, i) => { const g = Math.floor((rest * w[i]) / tw); share.set(u.uid, share.get(u.uid)! + g); });
    rest -= [...share.values()].reduce((a, b) => a + b, 0) - minSum;
    while (rest-- > 0) { const u = r.weighted(us, (x) => w[us.indexOf(x)]); share.set(u.uid, share.get(u.uid)! + 1); }
    for (const u of us) u.xp += share.get(u.uid)!;
  });
}

export function settleXp(run: RunState, u: UnitState) {
  while (u.rank < CFG.maxRank && u.xp >= CFG.xpToNext(u.rank)) {
    u.xp -= CFG.xpToNext(u.rank);
    rankUp(run, u);
  }
  if (u.rank >= CFG.maxRank) u.xp = 0;
}

function rankUp(run: RunState, u: UnitState) {
  u.rank++;
  for (const k of MAJORS) u.alloc[k] += CFG.rankAll; // 모든 메이저 자동 상승
  run.pending.push({ t: 'rankup', uid: u.uid, rank: u.rank, points: CFG.rankPoints(u.rank), options: null, rerolls: CFG.augmentRerolls, allocDone: false });
}

export function buyXp(run: RunState, uid: string): boolean {
  const u = run.units.find((x) => x.uid === uid);
  const cost = CFG.buyXpCost - (hasGlobal(run, 'G.study') ? 1 : 0);
  if (!u || u.rank >= CFG.maxRank || run.credits < cost) return false;
  run.credits -= cost;
  u.xp += CFG.buyXpAmount + (hasGlobal(run, 'G.study') ? 1 : 0);
  settleXp(run, u);
  return true;
}
export const xpCost = (run: RunState) => CFG.buyXpCost - (hasGlobal(run, 'G.study') ? 1 : 0);

// ───────────────────────── 증강 선택
export function augOptions(run: RunState, u: UnitState, rank: number): AugPick[] {
  if (!CFG.hasRankAug(rank)) return [];
  const late = rank > CFG.augmentMaxRank; // 10등급 이후: 전용 증강 제외
  const def = UNIT_BY_ID[u.defId];
  const owned = new Set(u.augments.map((a) => a.id));
  const avail = (a: { id: string; stack?: boolean }) => a.stack || !owned.has(a.id);
  const unitPool = def.augs.filter(avail);
  const synPool = memberships(u).flatMap((s) => SYN_BY_ID[s].augs).filter(avail);
  const comPool = COMMON_AUGS.filter(avail);
  return rng(run, (r) => {
    const out: string[] = [];
    const forced = CFG.forcedUnitAugRanks.includes(rank) && unitPool.length > 0;
    const pools = forced ? [{ w: 1, p: unitPool }]
      : late ? [{ w: 0.55, p: synPool }, { w: 0.45, p: comPool }]
      : [{ w: 0.3, p: unitPool }, { w: 0.4, p: synPool }, { w: 0.3, p: comPool }];
    for (let tries = 0; out.length < CFG.augmentChoices && tries < 60; tries++) {
      const live = pools.filter((x) => x.p.some((a) => !out.includes(a.id)));
      if (!live.length) break;
      const pool = r.weighted(live, (x) => x.w).p.filter((a) => !out.includes(a.id));
      out.push(r.pick(pool).id);
    }
    return out.map((id) => {
      const a = AUG_BY_ID[id];
      return a.roll ? { id, param: a.roll((arr) => r.pick(arr)) } : { id };
    });
  });
}

export function ensureRankupOptions(run: RunState, p: Extract<Pending, { t: 'rankup' }>) {
  const u = run.units.find((x) => x.uid === p.uid);
  if (u && !p.options) p.options = augOptions(run, u, p.rank);
}

// ───────────────────────── 경제 / 아이템
export function gainItem(run: RunState, id: string, lines?: string[]) {
  if (run.inventory.length >= CFG.inventoryMax) {
    const v = CFG.sell[id[0]];
    run.credits += v;
    lines?.push(`인벤토리 가득 참 — ${itemInfo(id).name} 자동 판매 +${v}`);
    return;
  }
  run.inventory.push(id);
  lines?.push(`장비 획득: ${itemInfo(id).name}`);
}

function genShop(run: RunState) {
  return rng(run, (r) => {
    const stock = [];
    for (let i = 0; i < CFG.drop.shopParts; i++) { const id = r.pick(ALL_COMPONENTS); stock.push({ item: id, price: CFG.price.C, sold: false }); }
    if (r.chance(CFG.drop.shopAdv)) stock.push({ item: r.pick(ALL_ADVANCED), price: CFG.price.A, sold: false });
    if (run.phase >= CFG.drop.shopLegendPhase && r.chance(CFG.drop.shopLegend)) stock.push({ item: 'L_' + r.pick(ALL_ADVANCED).slice(2), price: CFG.price.L, sold: false });
    return stock;
  });
}

export function buyShop(run: RunState, idx: number): string | null {
  const s = run.node?.shop?.[idx];
  if (!s || s.sold) return '이미 판매됨';
  if (run.credits < s.price) return '크레딧 부족';
  if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
  run.credits -= s.price;
  s.sold = true;
  run.inventory.push(s.item);
  return null;
}
export function sellItem(run: RunState, invIdx: number) {
  const id = run.inventory[invIdx];
  if (!id || isLocked(id)) return;
  run.credits += CFG.sell[id[0]];
  run.inventory.splice(invIdx, 1);
}
export function combineInv(run: RunState, i: number, j: number): string | null {
  if (i === j) return null;
  const a = run.inventory[i], b = run.inventory[j];
  const res = a && b ? combine(a, b) : null;
  if (!res) return null;
  run.inventory = run.inventory.filter((_, k) => k !== i && k !== j);
  run.inventory.push(res);
  return res;
}
export function equip(run: RunState, invIdx: number, uid: string): string | null {
  const u = run.units.find((x) => x.uid === uid);
  const id = run.inventory[invIdx];
  if (!u || !id) return '대상 없음';
  // 빈 슬롯이 없으면, 장착 중인 재료와 조합 가능한지 확인
  let slot = u.items.indexOf(null);
  if (slot < 0) {
    const k = u.items.findIndex((x) => x && combine(x, id));
    if (k < 0) return '장비 슬롯이 가득 찼습니다 (3칸)';
    u.items[k] = combine(u.items[k]!, id);
    run.inventory.splice(invIdx, 1);
    return null;
  }
  // 같은 기물에 조합 가능한 재료가 있으면 자동 조합
  const k = u.items.findIndex((x) => x && x[0] === 'C' && id[0] === 'C');
  if (k >= 0) u.items[k] = combine(u.items[k]!, id);
  else u.items[slot] = id;
  run.inventory.splice(invIdx, 1);
  return null;
}
export function unequip(run: RunState, uid: string, slot: number): string | null {
  const u = run.units.find((x) => x.uid === uid);
  if (!u || !u.items[slot]) return null;
  if (isLocked(u.items[slot])) return '고유 장비는 해제할 수 없습니다';
  if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
  run.inventory.push(u.items[slot]!);
  u.items[slot] = null;
  return null;
}

export function takeLoan(run: RunState): boolean {
  const pet = tierOf('PET', synergyCounts(deployed(run)).PET || 0);
  if (pet < 2 || run.loan > 0) return false;
  run.credits += 25;
  run.loan = 30;
  log(run, '페트라 대출 실행: +25 (상환 30)');
  return true;
}

// ───────────────────────── 보급 / 영입
export const SUPPLY_TEXT: Record<string, string> = {
  parts: '장비 재료 1개 + 크레딧 +4', parts2: '장비 재료 1개 + 공명도 풀 절반 분배', credits: '에너지 크레딧 +12', xp: '공명도 풀 즉시 분배',
  repair: '플레이어 체력 +15', adv: '무작위 고급 장비 1개',
};
export function takeSupply(run: RunState, opt: string) {
  if (opt === 'parts') { gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS))); run.credits += 4; }
  if (opt === 'parts2') { gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS))); distributeXp(run, Math.round(CFG.xpPool(run.phase) / 2)); run.units.forEach((u) => settleXp(run, u)); }
  if (opt === 'credits') run.credits += 12 + run.phase;
  if (opt === 'xp') { distributeXp(run, CFG.xpPool(run.phase)); run.units.forEach((u) => settleXp(run, u)); }
  if (opt === 'repair') run.hp = Math.min(run.maxHp, run.hp + 15);
  if (opt === 'adv') gainItem(run, rng(run, (r) => r.pick(ALL_ADVANCED)));
}
export function recruit(run: RunState, defId: string) {
  const rank = Math.max(1, run.phase - 1) + (hasGlobal(run, 'G.scout') ? 1 : 0);
  addUnit(run, defId, Math.min(CFG.maxRank, rank));
  autoPlace(run);
  log(run, `${UNIT_BY_ID[defId].name} 합류 (공명 ${rank})`);
}

/** 등급업 선택: 서로 다른 메이저 CFG.rankPicks개에 각각 points만큼 */
export function applyRankPicks(run: RunState, uid: string, picks: Major[], points: number): boolean {
  const u = run.units.find((x) => x.uid === uid);
  if (!u || new Set(picks).size !== CFG.rankPicks || picks.length !== CFG.rankPicks) return false;
  for (const k of picks) u.alloc[k] += points;
  return true;
}
export function chooseAug(run: RunState, uid: string, pick: AugPick) {
  const u = run.units.find((x) => x.uid === uid)!;
  u.augments.push(pick);
  if (u.pos === null) autoPlace(run);
}

// ───────────────────────── 헬레니우스 퀘스트
const QUESTS: Record<string, { text: (n: number) => string; target: (p: number) => number }> = {
  kills: { text: (n) => `적 ${n}명 처치`, target: (p) => 10 + 3 * p },
  crits: { text: (n) => `치명타 ${n}회`, target: (p) => 15 + 5 * p },
  status: { text: (n) => `상태이상 ${n}회 부여`, target: (p) => 8 + 3 * p },
  skills: { text: (n) => `기술 ${n}회 사용`, target: (p) => 12 + 3 * p },
  flawless: { text: (n) => `아군 손실 없이 승리 ${n}회`, target: () => 2 },
  adversity: { text: () => `역경 노드 승리`, target: () => 1 },
};
export const questText = (q: Quest) => QUESTS[q.id].text(q.target);
const REWARD_TEXT: Record<string, string> = { credits: '크레딧', part: '장비 재료', xp: '공명도' };
export const questRewardText = (q: Quest) => REWARD_TEXT[q.reward];

export function syncQuests(run: RunState) {
  const tier = tierOf('HEL', synergyCounts(deployed(run)).HEL || 0);
  if (run.questPhase !== run.phase) { run.quests = []; run.questPhase = run.phase; }
  rng(run, (r) => {
    while (run.quests.length < tier) {
      const free = Object.keys(QUESTS).filter((k) => !run.quests.some((q) => q.id === k));
      const id = r.pick(free);
      run.quests.push({ id, target: QUESTS[id].target(run.phase), progress: 0, done: false, reward: r.pick(['credits', 'part', 'xp']) });
    }
  });
}

function questProgress(run: RunState, b: Battle, won: boolean, type: NodeType, lines: string[]) {
  const dep = deployed(run);
  const tier = tierOf('HEL', synergyCounts(dep).HEL || 0);
  for (const q of run.quests) {
    if (q.done) continue;
    if (q.id === 'kills') q.progress += b.counters.kills;
    if (q.id === 'crits') q.progress += b.counters.crits;
    if (q.id === 'status') q.progress += b.counters.statuses;
    if (q.id === 'skills') q.progress += b.counters.skills;
    if (q.id === 'flawless' && won && b.counters.allyDeaths === 0) q.progress++;
    if (q.id === 'adversity' && won && type === 'adversity') q.progress++;
    if (q.progress < q.target) continue;
    q.done = true;
    const mult = tier >= 3 ? 2 : tier >= 2 ? 1.5 : 1;
    if (q.reward === 'credits') run.credits += Math.round(8 * mult);
    if (q.reward === 'part') for (let i = 0; i < Math.round(1 * mult + 0.01); i++) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)));
    if (q.reward === 'xp') { distributeXp(run, Math.round(10 * mult)); run.units.forEach((u) => settleXp(run, u)); }
    lines.push(`헬레니우스 퀘스트 완료: ${questText(q)} → ${questRewardText(q)} 보상`);
    for (const u of dep) {
      if (!memberships(u).includes('HEL')) continue;
      if (tier >= 3) rng(run, (r) => { for (let i = 0; i < 2; i++) u.perm[r.pick(MAJORS)]++; });
      if (u.augments.some((a) => a.id === 'HEL.intel')) for (const k of MAJORS) u.perm[k]++;
    }
  }
}

export const MAJOR_LABEL = MAJOR_NAME;

// ───────────────────────── 순례 / 속보
export function pickBlessing(run: RunState, id: string) {
  const d = BLESSING_BY_ID[id];
  if (d.team) run.blessing = id;
  d.onPick?.(run);
}

export const NEWS_OFFERS: Record<string, { name: string; desc: string; cost: number }> = {
  interview: { name: '독점 인터뷰', desc: '에너지 크레딧 +15', cost: 5 },
  sponsor: { name: '스폰서 계약', desc: '무작위 고급 장비 1개', cost: 12 },
  fanmeet: { name: '팬미팅', desc: '공명도 풀(1.5배) 파티 전체 분배', cost: 6 },
  cheer: { name: '응원 물결', desc: '플레이어 체력 +20', cost: 6 },
  hall: { name: '명예의 전당', desc: '전설 장비 3개 중 1개 선택', cost: 45 },
  headline: { name: '헤드라인 장식', desc: '전역 증강 3개 중 1개 선택', cost: 30 },
};
function genNews(run: RunState) {
  return Object.keys(NEWS_OFFERS).map((id) => ({ id, cost: NEWS_OFFERS[id].cost, sold: false }));
}
export function buyNews(run: RunState, idx: number): string | null {
  const o = run.node?.news?.[idx];
  if (!o || o.sold) return '이미 교환함';
  if (run.fame < o.cost) return '명성이 부족합니다';
  run.fame -= o.cost;
  o.sold = true;
  if (o.id === 'interview') run.credits += 15;
  if (o.id === 'sponsor') gainItem(run, rng(run, (r) => r.pick(ALL_ADVANCED)));
  if (o.id === 'fanmeet') { distributeXp(run, Math.round(CFG.xpPool(run.phase) * 1.5)); run.units.forEach((u) => settleXp(run, u)); }
  if (o.id === 'cheer') run.hp = Math.min(run.maxHp, run.hp + 20);
  if (o.id === 'hall') run.pending.push({ t: 'itemPick', title: '명예의 전당 — 전설 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)).map((x) => 'L_' + x.slice(2)) });
  if (o.id === 'headline') run.pending.push({ t: 'global', options: rollGlobals(run) });
  return null;
}

/** 이전 버전 저장 데이터 보정 */
export function migrate(run: RunState): RunState {
  run.faith ??= 0;
  run.fame ??= 0;
  run.blessing ??= null;
  run.staffTarget ??= null;
  run.aceTarget ??= null;
  run.version = SAVE_VERSION;
  return run;
}
