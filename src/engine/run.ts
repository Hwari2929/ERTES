import { CFG } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { FIELDS, fieldOf } from '../data/battlefields';
import { diffHas } from '../data/difficulty';
import { EVENT_BY_ID, EVENTS, type EventApi } from '../data/events';
import { ENEMY_BY_ID } from '../data/enemies';
import { BLESSING_BY_ID, BLESSINGS, EMBLEM_SYNS, GLOBAL_BY_ID, GLOBALS, PRIVILEGES, synName } from '../data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, combine, emblemId, emblemOf, isLocked, isMod, itemInfo } from '../data/items';
import { SYN_BY_ID, tierOf } from '../data/synergies';
import { RECRUITABLE, UNIT_BY_ID } from '../data/units';
import { Rng } from '../rng';
import {
  type AugPick, type Encounter, type EnemySpawn, type Major, MAJORS, MAJOR_NAME, type NodeType, type Pending,
  type Quest, type RunState, type SynergyId, type UnitState,
} from '../types';
import { deployed, memberships, playerRows, synergyCounts } from './build';
import type { Battle } from './combat';

export const SAVE_VERSION = 4;

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
export function newRun(seed: number, starters: string[], field?: string, diff = 0): RunState {
  const run: RunState = {
    version: SAVE_VERSION, seed, rng: seed, phase: 1, step: 0, map: phaseMap(1), picked: [], node: null,
    hp: CFG.playerHp - (diffHas(diff, 6) ? 25 : 0), maxHp: CFG.playerHp - (diffHas(diff, 6) ? 25 : 0), credits: diffHas(diff, 3) ? 0 : CFG.startCredits, streak: 0, units: [], inventory: [],
    globals: [], pending: [], quests: [], questPhase: 0, loan: 0, faith: 0, fame: 0, blessing: null, staffTarget: null, aceTarget: null, privilege: null, field: field || 'waste', diff, cleared: false, endless: false,
    mods: { interestCap: 0, nodeIncome: 0 }, boons: [], phaseBoons: [], seenEvents: [], usedIds: [], rankLog: {}, nextUid: 1, log: [],
    stats: { wins: 0, losses: 0, kills: 0, bestHit: 0 }, over: false,
  };
  for (const id of starters) addUnit(run, id, 1);
  autoPlace(run);
  if (tierNow(run, 'CLERIC')) run.map.unshift(['pilgrim']);
  if (!field) run.field = rng(run, (r) => r.pick(FIELDS).id);
  const joins = run.pending.splice(0); // 시작 기물 합류 증강은 전장 브리핑 다음에
  run.pending.push({ t: 'field' }, ...joins);
  run.pending.push({ t: 'privilege', options: rollPrivileges(run), rerolls: CFG.privilegeRerolls });
  run.pending.push({ t: 'global', options: rollGlobals(run) });
  log(run, '용병단 ERRANTEs, 출격.');
  return run;
}

/** 페이즈 노드 구성 (11칸): 영입 > 전투 > 사건 > 전투 > 보급 > 전투 > 사건 > 역경 > 보급 > 역경 > 보스.
 *  보급 = 상점 / 보급 중 선택. 1페이즈는 시작 기물이 4명이라 영입 없이 시작 */
export function phaseMap(phase: number): NodeType[][] {
  const body: NodeType[][] = [['battle'], ['event'], ['battle'], ['shop', 'supply'], ['battle'], ['event'], ['adversity'], ['shop', 'supply'], ['adversity'], ['boss']];
  return phase <= 1 ? body : [['recruit'], ...body];
}

// ───────────────────────── 특권 증강 (런 시작)
export function rollPrivileges(run: RunState): AugPick[] {
  return rng(run, (r) => {
    // 문장은 시작 기물의 시너지 위주로
    const own = [...new Set(run.units.flatMap((u) => memberships(u)))].filter((s) => EMBLEM_SYNS.includes(s));
    const out: AugPick[] = [];
    for (let tries = 0; out.length < 3 && tries < 40; tries++) {
      const d = r.weighted(PRIVILEGES, (p) => p.w);
      if (d.id === 'P.emblem') {
        const pool = (own.length && r.chance(0.7) ? own : EMBLEM_SYNS).filter((s) => !out.some((o) => o.param === s));
        if (pool.length) out.push({ id: d.id, param: r.pick(pool) });
      } else if (!out.some((o) => o.id === d.id)) out.push({ id: d.id });
    }
    return out;
  });
}
export function rerollPrivilege(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'privilege' || p.rerolls <= 0) return;
  p.rerolls--;
  p.options = rollPrivileges(run);
}
/** 특권 선택: 대기열 맨 앞(특권)을 빼고, 후속 선택은 바로 다음에 끼워 넣는다 */
export function pickPrivilege(run: RunState, idx: number) {
  const p = run.pending[0];
  if (p?.t !== 'privilege' || !p.options[idx]) return;
  const pick = p.options[idx];
  run.pending.shift();
  run.privilege = pick;
  const next: Pending[] = [];
  switch (pick.id) {
    case 'P.emblem': gainItem(run, emblemId(pick.param as SynergyId)); break;
    case 'P.recruit': next.push({ t: 'recruit', options: recruitOptions(run, 3) }); break;
    case 'P.legend': next.push({ t: 'itemPick', title: '가보 — 전설 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)).map((x) => 'L_' + x.slice(2)) }); break;
    case 'P.global': next.push({ t: 'global', options: rollGlobals(run) }); break;
    case 'P.funds': run.credits += 40; break;
    case 'P.hp': run.maxHp += 40; run.hp += 40; break;
    case 'P.rank': {
      const before = run.pending.length;
      for (const u of run.units) for (let i = 0; i < 2; i++) rankUp(run, u);
      next.push(...run.pending.splice(before));
      break;
    }
  }
  run.pending.unshift(...next);
  log(run, `특권: ${privilegeName(pick)}`);
}
export const privilegeName = (p: AugPick) => PRIVILEGES.find((d) => d.id === p.id)!.name(p.param);
export const privilegeDesc = (p: AugPick) => PRIVILEGES.find((d) => d.id === p.id)!.desc(p.param);

/** 영입 선택지. 인맥(G.network)이 있으면 파티와 시너지가 겹치는 기물 가중 */
function recruitOptions(run: RunState, k: number): string[] {
  const pool = RECRUITABLE.filter((d) => !run.units.some((u) => u.defId === d.id)).map((d) => d.id);
  if (!hasGlobal(run, 'G.network')) return rng(run, (r) => r.sample(pool, k));
  const have = new Set(run.units.flatMap((u) => memberships(u)));
  return rng(run, (r) => {
    const left = pool.slice(), out: string[] = [];
    while (out.length < k && left.length) {
      const id = r.weighted(left, (x) => 1 + 2 * [...UNIT_BY_ID[x].factions, ...UNIT_BY_ID[x].traits].filter((s) => have.has(s)).length);
      out.push(id); left.splice(left.indexOf(id), 1);
    }
    return out;
  });
}

export function addUnit(run: RunState, defId: string, rank: number): UnitState {
  const u: UnitState = {
    uid: `u${run.nextUid++}`, defId, rank: 1, xp: 0, alloc: zeroMajors(), perm: zeroMajors(), augments: [],
    items: [UNIT_BY_ID[defId].item || null, null, null], mod: null, pos: null,
  };
  run.units.push(u);
  if (!run.usedIds.includes(defId)) run.usedIds.push(defId);
  run.rankLog[defId] = Math.max(run.rankLog[defId] || 0, 1);
  for (let r = 2; r <= rank; r++) rankUp(run, u);
  // 합류 즉시 전용 증강 1개
  run.pending.push({ t: 'rankup', uid: u.uid, rank: u.rank, points: 0, options: null, rerolls: CFG.augmentRerolls, allocDone: true, join: true });
  return u;
}

/** 탐험가(아문센)는 정해진 페이즈 전에는 배치할 수 없다 */
export const canDeploy = (run: RunState, u: UnitState) => u.lock !== run.phase && (!UNIT_BY_ID[u.defId].traits.includes('EXPLORER') || run.phase >= CFG.explorerPhase);

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
  if (type === 'event') {
    const id = pickEvent(run);
    run.seenEvents.push(id);
    run.pending.push({ t: 'event', id });
    advance(run);
    return;
  }
  if (type === 'battle' || type === 'adversity' || type === 'boss') {
    run.node = { type, enc: genEncounter(run, type) };
    syncQuests(run);
  } else if (type === 'shop') {
    run.node = { type, shop: genShop(run) };
  } else if (type === 'supply') {
    run.pending.push({ t: 'supply', options: rng(run, (r) => r.sample(['parts', 'credits', 'xp', 'repair', r.chance(CFG.drop.supplyAdv) ? 'adv' : 'parts2'], 3)) });
    advance(run);
  } else if (type === 'recruit') {
    const pool = RECRUITABLE.filter((d) => !run.units.some((u) => u.defId === d.id)).map((d) => d.id);
    if (!pool.length || run.units.length >= CFG.maxParty) {
      run.credits += 10;
      const why = pool.length ? `보유 한도(${CFG.maxParty}명)에 도달해` : '영입할 수 있는 기물이 없어';
      run.pending.push({ t: 'notice', title: '영입 불가', body: `${why} 크레딧 +10 으로 대체합니다.` });
    } else {
      const k = 3 + (hasGlobal(run, 'G.scout') ? 1 : 0) + (hasGlobal(run, 'G.network') ? 1 : 0);
      run.pending.push({ t: 'recruit', options: recruitOptions(run, k) });
    }
    advance(run);
  }
}

export function leaveShop(run: RunState) { run.node = null; advance(run); }

const tierNow = (run: RunState, id: 'CLERIC' | 'STAR') => tierOf(id, synergyCounts(deployed(run), run)[id] || 0);

export function advance(run: RunState) {
  run.node = null;
  run.step++;
  if (run.mods.nodeIncome) run.credits += run.mods.nodeIncome; // 분할 정산 등
  if (run.step >= run.map.length) {
    run.phase++;
    run.step = 0;
    run.map = phaseMap(run.phase);
    run.picked = [];
    autoPlace(run);
    run.blessing = null;
    run.phaseBoons = [];
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
  if (id === 'G.emblem') {
    const pool = [...new Set(deployed(run).flatMap((u) => memberships(u)))].filter((s) => EMBLEM_SYNS.includes(s));
    const s = rng(run, (r) => r.pick(pool.length ? pool : EMBLEM_SYNS));
    gainItem(run, emblemId(s));
    log(run, `문장 수여: ${synName(s)} 문장 획득`);
  }
  autoPlace(run);
}

// ───────────────────────── 조우 생성
export function genEncounter(run: RunState, type: NodeType): Encounter {
  return rng(run, (r) => {
    const env = r.weighted(CFG.boardSizes, (x) => x.w);
    const n = type === 'boss' ? CFG.bossBoard : env.n;
    const rows = playerRows(n);
    const p = run.phase;
    const f = fieldOf(run.field);
    const enemies: EnemySpawn[] = [];
    const ids: string[] = [];
    const pool = f.pool.filter((id) => ENEMY_BY_ID[id].minPhase <= p);
    if (type === 'boss') {
      const boss = f.bosses[(p - 1) % f.bosses.length];
      ids.push(boss, ...(ENEMY_BY_ID[boss].escort || []));
      const extra = Math.max(0, Math.min(4, p - 1)); // 보스 호위 추가 인원 (최대 4)
      for (let i = 0; i < extra + (diffHas(run.diff, 4) ? 1 : 0); i++) ids.push(r.pick(pool));
    } else {
      const late = run.step >= 4 ? 1 : 0;
      const count = Math.min(rows * n - 2, 2 + p + late + (f.extraEnemies || 0) + (type === 'adversity' && diffHas(run.diff, 5) ? 1 : 0));
      if (type === 'adversity' || (p >= 3 && r.chance(diffHas(run.diff, 5) ? 0.6 : 0.3))) ids.push(f.elite);
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
  const counts = synergyCounts(dep, run);
  const pet = tierOf('PET', counts.PET || 0);
  const uni = tierOf('UNI', counts.UNI || 0);

  // 이자 (수입 전 보유량 기준)
  const cap = Math.max(0, CFG.interestMax + run.mods.interestCap - (diffHas(run.diff, 3) ? 1 : 0)) + (pet >= 1 ? 3 : 0) + (pet >= 3 ? 3 : 0) + (hasGlobal(run, 'G.interest') ? 5 : 0);
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
    const fw = fieldOf(run.field).winCredits;
    if (fw) { income += fw; lines.push(`전장 조건 · 계약 정산 +${fw}`); }
    if (type === 'adversity') {
      if (rng(run, (r) => r.chance(CFG.drop.adversity * (fieldOf(run.field).dropMul || 1)))) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines);
    } else if (type === 'battle') {
      if (rng(run, (r) => r.chance(CFG.drop.battle * (fieldOf(run.field).dropMul || 1)))) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines);
    } else if (type === 'boss') {
      // 보스 전리품: n 페이즈마다 고급 장비, 그 외에는 확률로 재료 3개 중 1개
      if (p % CFG.drop.bossAdvEvery === 0) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 고급 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)) });
      else if (rng(run, (r) => r.chance(CFG.drop.bossPart))) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 장비 재료 1개 선택', options: rng(run, (r) => r.sample(ALL_COMPONENTS, 3)) });
      lines.push(`페이즈 ${p} 클리어!`);
      if (p >= CFG.victoryPhase && !run.cleared) { run.cleared = true; run.pending.push({ t: 'victory' }); }
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
  run.rankLog[u.defId] = Math.max(run.rankLog[u.defId] || 0, u.rank);
  for (const k of MAJORS) u.alloc[k] += CFG.rankAll; // 모든 메이저 자동 상승
  const pick = CFG.hasRankPick(u.rank), aug = CFG.hasRankAug(u.rank);
  if (pick || aug) run.pending.push({ t: 'rankup', uid: u.uid, rank: u.rank, points: CFG.rankPoints, options: null, rerolls: CFG.augmentRerolls, allocDone: !pick });
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
export function augOptions(run: RunState, u: UnitState, rank: number, force = false): AugPick[] {
  if (!force && !CFG.hasRankAug(rank)) return [];
  const def = UNIT_BY_ID[u.defId];
  const owned = new Set(u.augments.map((a) => a.id));
  const avail = (a: { id: string; stack?: boolean }) => a.stack || !owned.has(a.id);
  const unitPool = def.augs.filter(avail);
  return rng(run, (r) => {
    const out = r.sample(unitPool.map((x) => x.id), CFG.augmentChoices);
    return out.map((id) => {
      const a = AUG_BY_ID[id];
      return a.roll ? { id, param: a.roll((arr) => r.pick(arr)) } : { id };
    });
  });
}

export function ensureRankupOptions(run: RunState, p: Extract<Pending, { t: 'rankup' }>) {
  const u = run.units.find((x) => x.uid === p.uid);
  if (u && !p.options) p.options = augOptions(run, u, p.rank, !!p.join);
}

// ───────────────────────── 경제 / 아이템
export function gainItem(run: RunState, id: string, lines?: string[], force = false) {
  if (run.inventory.length >= CFG.inventoryMax && !force) {
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
    const pr = (g: string) => Math.round(CFG.price[g] * (fieldOf(run.field).shopMul || 1));
    for (let i = 0; i < CFG.drop.shopParts; i++) { const id = r.pick(ALL_COMPONENTS); stock.push({ item: id, price: pr('C'), sold: false }); }
    if (r.chance(CFG.drop.shopAdv)) stock.push({ item: r.pick(ALL_ADVANCED), price: pr('A'), sold: false });
    if (run.phase >= CFG.drop.shopLegendPhase && r.chance(CFG.drop.shopLegend)) stock.push({ item: 'L_' + r.pick(ALL_ADVANCED).slice(2), price: pr('L'), sold: false });
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
  // 개조부품은 전용 칸으로 (이미 있으면 맞교환)
  if (isMod(id)) {
    if (memberships(u).includes(emblemOf(id)) && u.mod !== id) return '이미 소속된 시너지의 문장입니다';
    run.inventory.splice(invIdx, 1);
    if (u.mod) run.inventory.push(u.mod);
    u.mod = id;
    return null;
  }
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
/** slot -1 = 개조부품 칸 */
export function unequip(run: RunState, uid: string, slot: number): string | null {
  const u = run.units.find((x) => x.uid === uid);
  if (u && slot === -1) {
    if (!u.mod) return null;
    if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
    run.inventory.push(u.mod);
    u.mod = null;
    return null;
  }
  if (!u || !u.items[slot]) return null;
  if (isLocked(u.items[slot])) return '고유 장비는 해제할 수 없습니다';
  if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
  run.inventory.push(u.items[slot]!);
  u.items[slot] = null;
  return null;
}

export function takeLoan(run: RunState): boolean {
  const pet = tierOf('PET', synergyCounts(deployed(run), run).PET || 0);
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
  const tier = tierOf('HEL', synergyCounts(deployed(run), run).HEL || 0);
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
  const tier = tierOf('HEL', synergyCounts(dep, run).HEL || 0);
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
  run.privilege ??= null;
  for (const u of run.units) u.mod ??= null;
  run.field ??= 'waste';
  run.diff ??= 0;
  run.cleared ??= false;
  run.endless ??= false;
  run.mods ??= { interestCap: 0, nodeIncome: 0 };
  run.boons ??= [];
  run.phaseBoons ??= [];
  run.seenEvents ??= [];
  run.usedIds ??= run.units.map((u) => u.defId);
  run.rankLog ??= Object.fromEntries(run.units.map((u) => [u.defId, u.rank]));
  run.version = SAVE_VERSION;
  return run;
}

// ───────────────────────── 사건
/** 전장 · 페이즈 · 이번 런에서 겪은 사건을 고려해 가중 무작위로 하나 */
function pickEvent(run: RunState): string {
  // 희귀 사건은 런당 1회. 일반 사건은 겪을수록 덜 나온다 (희귀 사건이 '남은 사건'이 되어 자주 뜨지 않도록)
  const seen = (id: string) => run.seenEvents.filter((x) => x === id).length;
  const list = EVENTS.filter((e) => (!e.fields || e.fields.includes(run.field)) && (e.minPhase || 1) <= run.phase && !(e.rare && seen(e.id)));
  // 엘베스타드 일가가 있으면 밍키가 조금 더 자주
  const w = (e: (typeof EVENTS)[number]) => e.weight * Math.pow(0.3, seen(e.id)) * (e.id === 'mingki' && run.units.some((u) => memberships(u).includes('FAM')) ? 2 : 1);
  return rng(run, (r) => r.weighted(list, w).id);
}

function eventApi(run: RunState): EventApi {
  const tierPool = (t: 'C' | 'A' | 'L') => (t === 'C' ? ALL_COMPONENTS : ALL_ADVANCED);
  return {
    rng: (f) => rng(run, f),
    gain: (id, force) => gainItem(run, id, undefined, force),
    recruitPick: (k) => { if (run.units.length < CFG.maxParty) run.pending.push({ t: 'recruit', options: recruitOptions(run, k) }); },
    join: (defId) => {
      if (run.units.length >= CFG.maxParty || run.units.some((u) => u.defId === defId)) return null;
      const u = addUnit(run, defId, Math.min(CFG.maxRank, Math.max(1, run.phase - 1)));
      autoPlace(run);
      log(run, `${UNIT_BY_ID[defId].name} 합류 (사건)`);
      return u;
    },
    rankUp: (u, n) => { for (let i = 0; i < n && u.rank < CFG.maxRank; i++) rankUp(run, u); },
    xp: (amount) => { distributeXp(run, amount); run.units.forEach((u) => settleXp(run, u)); },
    globalPick: () => { run.pending.push({ t: 'global', options: rollGlobals(run) }); },
    allItems: () => [
      ...run.inventory.map((id, slot) => ({ where: 'inv' as const, slot, id })),
      ...run.units.flatMap((u) => u.items.map((id, slot) => ({ where: 'unit' as const, u, slot, id: id || '' }))),
    ].filter((x) => /^[CAL]_/.test(x.id)),
    setItem: (ref, id) => {
      if (ref.where === 'unit' && ref.u) ref.u.items[ref.slot] = id;
      else if (id) run.inventory[ref.slot] = id;
      else run.inventory[ref.slot] = '';
    },
    randomItem: (t) => rng(run, (r) => { const a = r.pick(tierPool(t)); return t === 'L' ? 'L_' + a.slice(2) : a; }),
    augNow: (u) => {
      const opts = augOptions(run, u, u.rank, true);
      if (!opts.length) return null;
      u.augments.push(opts[0]);
      return AUG_BY_ID[opts[0].id]?.name || null;
    },
    phaseBoon: (id) => { if (!run.phaseBoons.includes(id)) run.phaseBoons.push(id); },
  };
}

/** 사건 선택지 실행: 결과 알림을 먼저, 후속 선택(영입 등)은 그 뒤에 */
export function chooseEvent(run: RunState, idx: number): string | null {
  const p = run.pending[0];
  if (p?.t !== 'event') return null;
  const ev = EVENT_BY_ID[p.id];
  const c = ev?.choices[idx];
  if (!c) return null;
  const blocked = c.block?.(run);
  if (blocked) return blocked;
  run.pending.shift();
  const before = run.pending.length;
  const msg = c.apply(run, eventApi(run));
  run.inventory = run.inventory.filter(Boolean); // 사건 중 비운 칸 정리
  const follow = run.pending.splice(before);
  run.pending.unshift({ t: 'notice', title: ev.title, body: `${c.label} — ${msg}` }, ...follow);
  log(run, `사건: ${ev.title} — ${c.label}`);
  return null;
}

// ───────────────────────── 기물 방출
/** 방출 보상 미리보기: 쌓은 공명도의 60%를 남은 파티에, 크레딧 3 + 등급×2, 장비 · 개조부품 반환 */
export function releaseValue(run: RunState, u: UnitState) {
  let invested = u.xp;
  for (let r = 1; r < u.rank; r++) invested += CFG.xpToNext(r);
  const items = [...u.items.filter((x): x is string => !!x && !isLocked(x)), ...(u.mod ? [u.mod] : [])];
  const lost = u.items.filter((x): x is string => !!x && isLocked(x));
  return { xp: Math.round(invested * 0.6), credits: 3 + u.rank * 2, items, lost, invested };
}
export function releaseUnit(run: RunState, uid: string): string | null {
  const u = run.units.find((x) => x.uid === uid);
  if (!u) return '대상 없음';
  if (run.units.length <= 1) return '마지막 남은 기물은 방출할 수 없습니다';
  const v = releaseValue(run, u);
  run.units = run.units.filter((x) => x !== u);
  if (run.staffTarget === uid) run.staffTarget = null;
  if (run.aceTarget === uid) run.aceTarget = null;
  run.credits += v.credits;
  for (const id of v.items) gainItem(run, id, undefined, true);
  distributeXp(run, v.xp);
  run.units.forEach((x) => settleXp(run, x));
  autoPlace(run);
  log(run, `${UNIT_BY_ID[u.defId].name} 방출: 크레딧 +${v.credits}, 공명도 ${v.xp} 분배`);
  return null;
}
