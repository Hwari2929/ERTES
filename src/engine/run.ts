import { CFG } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { FIELDS, fieldOf } from '../data/battlefields';
import { diffAddCount, diffHas } from '../data/difficulty';
import { CATWHEEL, DESPAIRS, despairAt, despairDiff, hasDespair, PETROCK } from '../data/despair';
import { EVENT_BY_ID, EVENTS, type EventApi } from '../data/events';
import { PC_NAME, resolveScene, type Beat } from '../data/scene';
import { EVENT_SCENES } from '../data/scenes';
import { ENEMY_BY_ID } from '../data/enemies';
import { BLESSING_BY_ID, BLESSINGS, EMBLEM_SYNS, GLOBAL_BY_ID, GLOBALS, PRIVILEGES, synName } from '../data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_CONSUMABLES, ALL_GRADED, breadHeal, combine, CONSUMABLES, emblemId, emblemOf, gearRank, injectAmount, injectorWeights, isConsumable, isEmblem, isInjector, isLocked, isMod, itemInfo, occultModsOfTier, OCCULT_MODS, HEL_ITEM_IDS, isHelItem, isTurretGear, TURRET_ADV, TURRET_BASIC, TURRET_PRICE, turretSlots } from '../data/items';
import { SYN_BY_ID, SYNERGIES, tierOf } from '../data/synergies';
import { RECRUITABLE, UNIT_BY_ID } from '../data/units';
import { MAJOR_AUGS, recMajors } from '../data/rework';
import { SCHOOL_AUGS, schoolPassives } from '../data/psionic';
import { isLegendAug, majorsOf, schoolAugId, schoolOf, type SchoolId } from '../data/schools';
import { DEFAULT_RELIC, RELIC_BY_ID, RELICS } from '../data/relics';
import { Rng } from '../rng';
import { FAITHS,
  type AugPick, type Encounter, type InvestOffer, type FaithId, type EnemySpawn, type Major, MAJORS, MAJOR_NAME, type NodeType, type Pending,
  type Quest, type RunState, type ShopSlot, type SynergyId, type UnitState,
} from '../types';
import { deployed, memberships, playerRows, synergyCounts, turretCount } from './build';
import type { Battle } from './combat';

export const SAVE_VERSION = 6; // 6: 전술 유형 개편 (개별 증강 폐지)

export function rng<T>(run: RunState, f: (r: Rng) => T): T {
  const r = new Rng(run.rng);
  const out = f(r);
  run.rng = r.s;
  return out;
}
const zeroMajors = (): Record<Major, number> => ({ vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 });
const log = (run: RunState, s: string) => { run.log.unshift(s); if (run.log.length > 60) run.log.length = 60; };
export const hasGlobal = (run: RunState, id: string) => run.globals.includes(id);
/** 반려 돌 (절망 증강): 칸만 차지하는 짐. 늘 출전 · 공명도 · 장비 없음 */
export const isRock = (u: UnitState) => !!UNIT_BY_ID[u.defId]?.inert;
/** 절망 증강 [근시안적 투자안]: 이자 수입 감소 (내림) */
const despairInterest = (run: RunState, x: number) => (hasDespair(run, 'D.myopic') ? Math.floor(x * (1 - CFG.despair.interest)) : x);
/** 절망 증강 [군체 공명 간섭]: 전투 공명도 풀 배율 */
const despairXp = (run: RunState) => (hasDespair(run, 'D.swarm') ? 1 - CFG.despair.xp : 1);
/** 절망 증강 [무역관세부 특별 관세]: 상점 · 정비 · 합성 가격, 함대 확장 · 지정 소집 비용 배율 */
const despairPrice = (run: RunState) => (hasDespair(run, 'D.tariff') ? 1 + CFG.despair.tariff : 1);

// ───────────────────────── 런 생성
export function newRun(seed: number, starters: string[], field?: string, diff = 0): RunState {
  const run: RunState = {
    version: SAVE_VERSION, seed, rng: seed, phase: 1, step: 0, map: phaseMap(1), picked: [], node: null,
    hp: CFG.playerHp - (diffHas(diff, 6) ? 25 : 0), maxHp: CFG.playerHp - (diffHas(diff, 6) ? 25 : 0), credits: diffHas(diff, 3) ? 0 : CFG.startCredits, streak: 0, units: [], inventory: [],
    globals: [], pending: [], quests: [], questPhase: 0, loan: 0, faith: 0, power: 0, divCap: 0, fame: 0, blessing: null, staffTarget: null, aceTarget: null, privilege: null, despairs: [], field: field || 'waste', diff, cleared: false, endless: false,
    mods: { interestCap: 0, nodeIncome: 0 }, boons: [], phaseBoons: [], seenEvents: [], flags: [], usedIds: [], rankLog: {}, nextUid: 1, log: [],
    stats: { wins: 0, losses: 0, kills: 0, bestHit: 0 }, over: false,
  };
  for (const id of starters) addUnit(run, id, 1);
  autoPlace(run);
  if (!field) run.field = rng(run, (r) => r.pick(FIELDS).id);
  // 전장 · 난이도는 출격 전 화면에서 이미 보여 줬다. 특권 증강이 시작 기물 합류 증강보다 먼저
  run.pending.unshift({ t: 'privilege', options: rollPrivileges(run), rerolls: CFG.privilegeRerolls });
  if (despairDiff(diff)) queueDespair(run); // 고난: 특권 바로 다음 (해금 조건 없음)
  log(run, '용병단 ERRANTEs, 출격.');
  return run;
}

/** 페이즈 노드 구성 (12칸): 전투 > 전투 > 항로 회의(전역 증강) > 사건 > 전투 > 보급 > 전투(짝수 페이즈는 전환) > 역경 > 사건 > 역경 > 보급 > 보스.
 *  보급 = 상점 / 보급 / 모집 (+ 은하 대스타 속보 · 투자 · 순례) 중 선택. 2페이즈부터는 페이즈 시작 때 영입 기회가 열린다 */
export function phaseMap(phase: number): NodeType[][] {
  return [['battle'], ['battle'], ['council'], ['event'], ['battle'], ['shop'], [phase % 2 === 0 ? 'fork' : 'battle'], ['adversity'], ['event'], ['adversity'], ['shop'], ['boss']];
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
  run.pending.splice(run.pending[0]?.t === 'despair' ? 1 : 0, 0, ...next); // 절망 증강은 특권 바로 다음
  log(run, `특권: ${privilegeName(pick)}`);
}
export const privilegeName = (p: AugPick) => PRIVILEGES.find((d) => d.id === p.id)!.name(p.param);
export const privilegeDesc = (p: AugPick) => PRIVILEGES.find((d) => d.id === p.id)!.desc(p.param);

// ───────────────────────── 절망 증강 (고난 런: 출격 때 1개 + CFG.despair.every 페이즈마다 1개, data/despair.ts)
/** 선택지: 아직 걸리지 않은 증강 중에서 (같은 증강 중복 없음) */
export function rollDespairs(run: RunState): string[] {
  const pool = DESPAIRS.filter((d) => !hasDespair(run, d.id)).map((d) => d.id);
  return rng(run, (r) => r.sample(pool, Math.min(CFG.despair.choices, pool.length)));
}
/** 절망 증강 선택을 대기열에 넣는다: 출격 때는 특권 바로 다음, 페이즈 시작 때(phase)는 맨 뒤. 남은 증강이 없으면 넘어간다 */
function queueDespair(run: RunState, phase?: number) {
  const options = rollDespairs(run);
  if (!options.length) return;
  const p: Pending = { t: 'despair', options, rerolls: CFG.despair.rerolls, ...(phase ? { phase } : {}) };
  if (phase) run.pending.push(p);
  else run.pending.splice(run.pending[0]?.t === 'privilege' ? 1 : 0, 0, p);
}
export function rerollDespair(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'despair' || p.rerolls <= 0) return;
  p.rerolls--;
  p.options = rollDespairs(run);
}
/** 절망 증강 선택 (반드시 1개, 이미 건 증강에 더한다). 영입에 걸리는 증강이면 이미 펼쳐 둔 영입 선택지(특권 추가 계약 · 페이즈 시작 영입 등)를 다시 뽑는다 */
export function pickDespair(run: RunState, idx: number) {
  const p = run.pending[0];
  const id = p?.t === 'despair' ? p.options[idx] : undefined;
  if (!id) return;
  run.pending.shift();
  if (hasDespair(run, id)) return; // 이미 건 증강 (선택지는 이를 빼고 뽑으므로 예전 저장에서만): 겹쳐 걸지 않고 넘어간다
  (run.despairs ||= []).push(id);
  if (id === 'D.rock' || id === 'D.rival') for (const q of run.pending) if (q.t === 'recruit' && !q.syns) q.options = recruitOptions(run, q.options.length);
  log(run, `절망 증강: ${DESPAIRS.find((d) => d.id === id)?.name}`);
}

/** 영입 선택지. 인맥(G.network)이 있으면 파티와 시너지가 겹치는 기물 가중 */
function recruitOptions(run: RunState, k: number, only?: string[]): string[] {
  const rare = (x: string) => x === 'amundsen' || x === 'demiurgos';
  const pool = (only || RECRUITABLE.filter((d) => !run.units.some((u) => u.defId === d.id)).map((d) => d.id)).filter((x) => !rare(x) || run.phase >= CFG.rarePhase); // 아문센 · 데미우르고스는 3페이즈부터
  const net = hasGlobal(run, 'G.network');
  const have = new Set(run.units.flatMap((u) => memberships(u)));
  const base = (x: string) => (rare(x) ? CFG.amundsenRecruitW : 1); // 아주 드물게
  const shared = (x: string) => [...UNIT_BY_ID[x].factions, ...UNIT_BY_ID[x].traits].filter((s) => have.has(s)).length;
  const rival = hasDespair(run, 'D.rival') ? CFG.despair.rival : 1; // 절망 증강 [배타적 경쟁 항로]
  return rng(run, (r) => {
    const left = pool.slice(), out: string[] = [];
    while (out.length < k && left.length) {
      const id = r.weighted(left, (x) => base(x) * (net ? 1 + 2 * shared(x) : 1) * (shared(x) ? rival : 1));
      out.push(id); left.splice(left.indexOf(id), 1);
    }
    // 절망 증강 [단장의 반려 돌]: 반려 돌이 없으면 선택지 일부가 반려 돌로 바뀐다
    if (hasDespair(run, 'D.rock') && !run.units.some((u) => u.defId === PETROCK)) for (let i = 0; i < CFG.despair.rockSlots && out.length; i++) {
      const j = r.int(0, out.length - 1);
      if (out[j] !== PETROCK) out[j] = PETROCK;
    }
    return out;
  });
}

export function addUnit(run: RunState, defId: string, rank: number): UnitState {
  const u: UnitState = {
    uid: `u${run.nextUid++}`, defId, rank: 1, xp: 0, alloc: zeroMajors(), perm: zeroMajors(), augments: [],
    items: [UNIT_BY_ID[defId].item || null, null, null], mod: null, pos: null, faith: UNIT_BY_ID[defId].faith, grow: {},
  };
  run.units.push(u);
  if (!run.usedIds.includes(defId)) run.usedIds.push(defId);
  run.rankLog[defId] = Math.max(run.rankLog[defId] || 0, 1);
  // 스페셜: 합류할 때 전용 증강 1개 · 사이오닉: 합류할 때 학파 1개 (다른 유형은 합류 선택 없음)
  if (UNIT_BY_ID[defId].ttype === 'special') run.pending.push({ t: 'rankup', uid: u.uid, rank: 1, points: 0, options: null, rerolls: CFG.augmentRerolls, allocDone: true, join: true, kind: 'special' });
  if (UNIT_BY_ID[defId].ttype === 'psionic') run.pending.push({ t: 'rankup', uid: u.uid, rank: 1, points: 0, options: null, rerolls: 0, allocDone: true, join: true, kind: 'school' });
  if (UNIT_BY_ID[defId].ttype === 'divine') u.relic = DEFAULT_RELIC[defId]; // 기본 성유물
  for (let r = 2; r <= rank; r++) rankUp(run, u); // 건너뛴 이정표도 모두 지급
  return u;
}

/** 탐험가(아문센)는 정해진 페이즈 전에는 배치할 수 없다 */
export const canDeploy = (run: RunState, u: UnitState) => u.lock !== run.phase;

/** 함대 확장 횟수 (구 세이브는 예전 페이즈 기준 출전 인원으로 환산) */
const fleetOf = (run: RunState) => run.fleet ?? 0; // 함대 확장 구입 횟수 (구입 전에는 기본 인원 그대로)
export const deployCap = (run: RunState) => CFG.deployBase + fleetOf(run) + (hasGlobal(run, 'G.squad') ? 1 : 0);

// ───────────────────────── 함선 관리: 함대 확장 · 지정 소집
/** 다음 함대 확장 비용 (최대면 null) */
export const fleetCost = (run: RunState): number | null => { const c = CFG.fleetCosts[fleetOf(run)]; return c === undefined ? null : Math.round(c * despairPrice(run)); };
export function buyFleet(run: RunState): string | null {
  const c = fleetCost(run);
  if (c === null) return '함대가 이미 최대 규모입니다';
  if (run.credits < c) return `크레딧이 부족합니다 (${c} 필요)`;
  run.credits -= c;
  run.fleet = fleetOf(run) + 1;
  autoPlace(run);
  log(run, `함대 확장: 출전 인원 ${deployCap(run)}명 (크레딧 -${c})`);
  return null;
}
export const musterCost = (run: RunState) => Math.round((CFG.musterCost + CFG.musterStep * (run.musters || 0)) * despairPrice(run));
/** 지정 소집 후보 풀: 고른 시너지 중 하나라도 가진, 아직 없는 기물 */
/** 지정 소집에 고를 수 있는 시너지: 구성 기물이 2명 이상 (데미우르고스 · 아문센 같은 1인 독립 시너지 제외) */
export const musterSyns = () => SYNERGIES.filter((s) => RECRUITABLE.filter((d) => ([...d.factions, ...d.traits] as string[]).includes(s.id)).length > 1).map((s) => s.id as string);
export const musterPool = (run: RunState, syns: string[]) =>
  RECRUITABLE.filter((d) => d.id !== 'amundsen' && !run.units.some((u) => u.defId === d.id) && [...d.factions, ...d.traits].some((s) => syns.includes(s))).map((d) => d.id); // 아문센은 지정 소집으로 부를 수 없다 (일반 영입에서만 드물게)
export function openMuster(run: RunState): string | null {
  if (run.pending.length || run.node) return '진행 중인 일을 먼저 끝내세요';
  if (run.units.length >= CFG.maxParty) return `보유 한도(${CFG.maxParty}명)에 도달했습니다`;
  if (run.credits < musterCost(run)) return `크레딧이 부족합니다 (${musterCost(run)} 필요)`;
  run.pending.unshift({ t: 'muster' });
  return null;
}
export function confirmMuster(run: RunState, syns: string[]): string | null {
  if (run.pending[0]?.t !== 'muster') return null;
  if (syns.length !== CFG.musterPicks || new Set(syns).size !== syns.length || syns.some((x) => !musterSyns().includes(x))) return `시너지를 ${CFG.musterPicks}개 고르세요`;
  const pool = musterPool(run, syns);
  if (!pool.length) return '조건에 맞는 기물이 없습니다';
  const c = musterCost(run);
  if (run.credits < c) return `크레딧이 부족합니다 (${c} 필요)`;
  run.credits -= c;
  run.musters = (run.musters || 0) + 1;
  run.pending.shift();
  const k = 4 + (hasGlobal(run, 'G.scout') ? 1 : 0) + (hasGlobal(run, 'G.network') ? 1 : 0); // 지정 소집: 선택지 +1, 리롤 없음
  run.pending.unshift({ t: 'recruit', options: recruitOptions(run, k, pool), syns, rerolls: 0 });
  log(run, `지정 소집 (크레딧 -${c}): ${syns.map((s) => SYN_BY_ID[s as SynergyId]?.name || s).join(' · ')}`);
  return null;
}
export function cancelMuster(run: RunState) { if (run.pending[0]?.t === 'muster') run.pending.shift(); }

export function autoPlace(run: RunState, order: UnitState[] = run.units) {
  const cap = deployCap(run);
  // 반려 돌 (절망 증강): 늘 출전. 자리가 없으면 공명 등급이 가장 낮은 출전 기물을 대기석으로
  const rock = run.units.find((u) => isRock(u) && !u.pos);
  if (rock) {
    if (deployed(run).length >= cap) { const low = deployed(run).filter((u) => !isRock(u)).sort((a, b) => a.rank - b.rank)[0]; if (low) low.pos = null; }
    order = [rock, ...order.filter((u) => u !== rock)];
  }
  const used = new Set(run.units.filter((u) => u.pos).map((u) => `${u.pos!.c},${u.pos!.r}`));
  for (const u of order) {
    if (u.pos || deployed(run).length >= cap || !canDeploy(run, u)) continue;
    const def = UNIT_BY_ID[u.defId];
    const rowsPref = def.range <= 1 ? [2, 1, 0] : [0, 1, 2];
    outer: for (const r of rowsPref)
      for (const c of [3, 2, 4, 1, 5, 0, 6]) {
        if (!used.has(`${c},${r}`)) { u.pos = { c, r }; used.add(`${c},${r}`); break outer; }
      }
  }
}

/** 편의: 빈 출전 자리를 대기 기물 중 공명 등급이 높은 순으로 채운다 (근접은 앞줄, 원거리는 뒷줄) */
export function autoFill(run: RunState) {
  const before = deployed(run).length;
  const bench = run.units.filter((u) => !u.pos && canDeploy(run, u)).sort((a, b) => b.rank - a.rank || b.xp - a.xp);
  autoPlace(run, bench);
  return deployed(run).length - before;
}

// ───────────────────────── 노드 진행
export function currentOptions(run: RunState): NodeType[] { return run.map[run.step] || []; }
/** 조우 강도 배율 (적 체력 · 피해): 역경은 설정값, 그 밖은 페이즈 안에서 진행한 칸에 따라 조금씩 (genEncounter · 지도 미리보기 공용) */
export const encounterMult = (type: NodeType, step: number) => (type === 'adversity' ? CFG.adversityMult : 1 + 0.04 * step);
/** 지도 미리보기: 전투 한 번의 예상 크레딧 수입 · 공명도 풀 (승리 / 패배). resolveBattle 과 같은 식 · 같은 설정값.
 *  이자는 지금 보유 크레딧 기준, 연승은 이번에 이긴다고 보고 센다 (대출 상환 · 퀘스트 · 장비 드랍 · 성장 특성은 빼고) */
export function battleRewardPreview(run: RunState, node: NodeType) {
  const type: NodeType = node === 'challenge' ? 'adversity' : node; // 도전은 보상을 역경 기준으로
  const p = run.phase;
  const counts = synergyCounts(deployed(run), run);
  const pet = tierOf('PET', counts.PET || 0);
  const cap = Math.max(0, CFG.interestMax + run.mods.interestCap - (diffHas(run.diff, 3) ? 1 : 0)) + (pet >= 1 ? 3 : 0) + (pet >= 3 ? 3 : 0) + (pet >= 4 ? 4 : 0) + (hasGlobal(run, 'G.interest') ? 5 : 0)
    + (run.units.some((u) => u.defId === 'lars') ? 2 : 0);
  const interest = despairInterest(run, Math.min(cap, Math.floor(run.credits / CFG.interestPer)));
  let c = CFG.winCredits(p);
  if (type === 'adversity') c = Math.round(c * CFG.adversityReward);
  c = Math.round(c * CFG.diffWinMul(run.diff || 0));
  if (type === 'boss') c += 5;
  const win = interest + c + CFG.streakBonus(Math.max(1, run.streak + 1)) + (pet >= 1 ? (pet >= 4 ? 3 : 1) : 0) + (fieldOf(run.field).winCredits || 0);
  const loss = interest + CFG.lossCredits + (pet >= 2 ? 6 : 0);
  const pool = (won: boolean) => Math.round(CFG.xpPool(p) * (won ? 1 : 0.5) * (type === 'adversity' ? CFG.adversityReward : 1) * (hasGlobal(run, 'G.resonance') ? 1.35 : 1) * despairXp(run));
  return { credits: { win, loss, interest }, xp: { win: pool(true), loss: pool(false) } };
}

export function enterNode(run: RunState, type: NodeType) {
  run.picked[run.step] = type;
  if (type !== 'battle' && type !== 'adversity' && type !== 'boss') run.fame += tierNow(run, 'STAR');
  if (type === 'pilgrim') {
    run.pending.push(genPilgrim(run));
    advance(run);
    return;
  }
  if (type === 'news') { run.node = { type, news: genNews(run) }; return; }
  if (type === 'council') { // 항로 회의: 전역 증강 선택 (새로고침 1회)
    run.pending.push({ t: 'global', options: rollGlobals(run), rerolls: CFG.globalRerolls });
    advance(run);
    return;
  }
  if (type === 'invest') { run.node = { type, invest: genInvest(run) }; return; }
  if (type === 'event') {
    const id = pickEvent(run);
    run.seenEvents.push(id);
    run.pending.push({ t: 'event', id, sub: pickSub(run, id) });
    advance(run);
    return;
  }
  if (type === 'battle' || type === 'adversity' || type === 'boss') {
    run.node = { type, enc: genEncounter(run, type) };
    syncQuests(run);
  } else if (type === 'shop') {
    run.pending.push({ t: 'branch', options: branchOptions(run) });
  } else if (type === 'supply') {
    run.pending.push({ t: 'supply', options: rng(run, (r) => r.sample(['parts', 'credits', 'xp', 'repair', r.chance(CFG.drop.supplyAdv) ? 'adv' : 'parts2'], 3)) });
    advance(run);
  } else if (type === 'recruit') {
    offerRecruit(run);
    advance(run);
  } else if (type === 'fork') {
    run.pending.push({ t: 'fork' });
  }
}

/** 일반 영입 기회 (페이즈 시작 · 모집 노드): 보유 한도면 크레딧으로 대체 */
function offerRecruit(run: RunState) {
  const pool = RECRUITABLE.filter((d) => !run.units.some((u) => u.defId === d.id)).map((d) => d.id);
  if (!pool.length || run.units.length >= CFG.maxParty) {
    run.credits += 10;
    const why = pool.length ? `보유 한도(${CFG.maxParty}명)에 도달해` : '영입할 수 있는 기물이 없어';
    run.pending.push({ t: 'notice', title: '영입 불가', body: `${why} 크레딧 +10 으로 대체합니다.` });
  } else {
    const k = 3 + (hasGlobal(run, 'G.scout') ? 1 : 0) + (hasGlobal(run, 'G.network') ? 1 : 0);
    run.pending.push({ t: 'recruit', options: recruitOptions(run, k) });
  }
}
/** 영입 후보 새로고침 (영입마다 1회) */
export function rerollRecruit(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'recruit' || (p.rerolls ?? 1) <= 0) return;
  p.rerolls = (p.rerolls ?? 1) - 1;
  p.options = recruitOptions(run, p.options.length, p.syns ? musterPool(run, p.syns) : undefined);
}

/** 전환: 휴식(체력 + 공명도) 또는 도전(다음 페이즈 역경급 전투) */
export function pickFork(run: RunState, choice: 'rest' | 'challenge' | 'synth') {
  if (run.pending[0]?.t !== 'fork') return;
  if (choice === 'synth' && !occultTier(run)) return;
  run.pending.shift();
  if (choice === 'synth') {
    run.picked[run.step] = 'shop';
    run.node = { type: 'shop', shop: genSynth(run), synth: true };
    log(run, '전환: 합성');
    return;
  }
  if (choice === 'rest') {
    const lost = run.maxHp - run.hp;
    const heal = Math.min(lost, CFG.forkRestHp + Math.floor(lost * CFG.forkRestLost));
    run.hp += heal;
    const xp = Math.round(CFG.xpPool(run.phase) * CFG.forkRestXp);
    distributeXp(run, xp);
    run.units.forEach((u) => settleXp(run, u));
    run.pending.push({ t: 'notice', title: '휴식', body: `한숨 돌렸습니다. 체력 +${heal}, 공명도 풀 ${xp} 분배.` });
    log(run, `전환: 휴식 (체력 +${heal})`);
    advance(run);
    return;
  }
  run.picked[run.step] = 'challenge';
  run.node = { type: 'challenge', enc: genEncounter(run, 'adversity', run.phase + 1) };
  syncQuests(run);
  log(run, '전환: 도전');
}

/** 도전 승리 보상: 남은 역경 2 · 사건 · 보급 · 보스를 합친 정도 */
function challengeReward(run: RunState, lines: string[]) {
  const p = run.phase;
  const c = Math.round(CFG.winCredits(p) * CFG.adversityReward * 2 + CFG.winCredits(p) + 5 + 12 + p);
  run.credits += c;
  lines.push(`도전 보상 +${c}`);
  gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines);
  run.pending.push({ t: 'itemPick', title: '도전 전리품 — 희귀 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)) });
  if (p % CFG.drop.bossAdvEvery === 0) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 희귀 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)) });
  else run.pending.push({ t: 'itemPick', title: '보스 전리품 — 장비 재료 1개 선택', options: rng(run, (r) => r.sample(ALL_COMPONENTS, 3)) });
}

// ───────────────────────── 신비학자: 전용 개조부품 · [합성] 소모품
export const occultTier = (run: RunState) => tierNow(run, 'OCCULT');
/** 처음 도달한 신비학자 단계마다 그 단계 전용 개조부품 1개 선택 */
/** 헬레니우스 동맹: 1 · 2 · 3단계 첫 도달 시 전용 장비, 4단계 첫 도달 시 보유한 동맹 장비를 전설로 */
function checkHel(run: RunState) {
  const t = tierNow(run, 'HEL'), had = run.helTier || 0;
  if (t <= had) return;
  for (let k = had + 1; k <= Math.min(3, t); k++) {
    const id = HEL_ITEM_IDS[k - 1];
    gainItem(run, t >= 4 ? 'L_' + id.slice(2) : id, undefined, true);
  }
  if (t >= 4 && had < 4) {
    const up = (x: string | null) => (x && isHelItem(x) && x[0] === 'A' ? 'L_' + x.slice(2) : x);
    run.inventory = run.inventory.map((x) => up(x)!);
    for (const u of run.units) u.items = u.items.map(up);
  }
  run.helTier = t;
  run.pending.push({ t: 'notice', title: '헬레니우스 동맹', body: t >= 4 && had < 4 ? '동맹 대함대가 집결했습니다. 동맹 전용 장비가 전설 등급으로 승격됩니다.' : '동맹이 전용 장비를 보내왔습니다. 보관함을 확인하세요.' });
}

/** 셰프: 시너지가 처음 켜지면 갓 구운 빵 1개 (런당 1번) */
function checkChef(run: RunState) {
  if (run.chefBread || run.tutorial || !tierNow(run, 'CHEF')) return;
  run.chefBread = true;
  gainItem(run, 'K_bread', undefined, true);
  run.pending.push({ t: 'notice', title: '갓 구운 빵', body: `셰프들이 처음 손을 맞춰 빵을 구워 냈습니다. 보관함의 [${CONSUMABLES.K_bread.name}]을 쓰면 플레이어 체력을 ${breadHeal(run.diff)} 회복합니다. 셰프 시너지가 켜진 채로 전투에서 이기면 가끔 더 구워 옵니다.` });
}

export function checkOccult(run: RunState): boolean {
  checkHel(run);
  checkChef(run);
  const t = occultTier(run), had = run.occultTier || 0;
  if (t <= had) return false;
  for (let k = had + 1; k <= t; k++) {
    run.pending.push({ t: 'itemPick', title: `신비학자 ${k}단계 도달 — 전용 개조부품 1개 선택`, options: rng(run, (r) => r.sample(occultModsOfTier(k), 3)) });
  }
  run.occultTier = t;
  return true;
}
function genSynth(run: RunState): NonNullable<NonNullable<RunState['node']>['shop']> {
  const t = occultTier(run);
  const n = 2 + t, mul = (t >= 3 ? 0.7 : 1) * despairPrice(run);
  return rng(run, (r) => {
    const ids = r.sample(ALL_CONSUMABLES, Math.min(n, ALL_CONSUMABLES.length)); // 서로 다른 종류 먼저, 남는 칸은 무작위
    while (ids.length < n) ids.push(r.pick(ALL_CONSUMABLES));
    return ids.map((id) => ({ item: id, price: Math.round(CONSUMABLES[id].price * mul), sold: false }));
  });
}
/** 소모품 사용 대상: 기물 · 보관함 장비 · 장착 장비 · 이번 전투의 적 (편성 화면, enc.enemies 순번) · 함대 (바로 사용) */
export type UseTarget = { k: 'unit'; uid: string } | { k: 'inv'; i: number } | { k: 'eq'; uid: string; slot: number } | { k: 'foe'; i: number } | { k: 'run' };
/** 적 1명이 단 장비 · 개조부품: 적 정의 + 이번 조우의 위험 등급 장비 (강제 징수기로 떼어 낸 적은 정의 장비도 없음). 편성 보드 · 적 상세 · 징수기 공용 */
export function foeGearOf(s: EnemySpawn): string[] {
  const d = ENEMY_BY_ID[s.defId];
  return [...(s.stripped || !d ? [] : [...(d.items || []), d.mod]), ...(s.items || []), s.mod].filter((x): x is string => !!x);
}
/** 소모품 사용 대상이 맞는지 (null = 사용 가능) */
export function useCheck(run: RunState, kIdx: number, tg: UseTarget): string | null {
  const id = run.inventory[kIdx];
  const c = id ? CONSUMABLES[id] : undefined;
  if (!c) return '소모품이 아닙니다';
  if (c.target === 'run') {
    if (id === 'K_bread' && run.hp >= run.maxHp) return '플레이어 체력이 가득 찼습니다';
    return null;
  }
  if (c.target === 'foe') {
    if (tg.k !== 'foe') return '이번 전투의 적에게 사용하는 소모품입니다 (편성 화면)';
    const s = run.node?.enc?.enemies[tg.i];
    if (!s) return '전투를 앞둔 편성 화면에서 적에게 사용하세요';
    if (!foeGearOf(s).length) return '장비를 달지 않은 적입니다';
    return null;
  }
  if (tg.k === 'foe' || tg.k === 'run') return c.target === 'unit' ? '기물에게 사용하는 소모품입니다' : '장비에 사용하는 소모품입니다';
  if (c.target === 'unit') {
    if (tg.k === 'inv') return '기물에게 사용하는 소모품입니다';
    const u = run.units.find((x) => x.uid === tg.uid);
    if (!u) return '대상 없음';
    if (isRock(u)) return '반려 돌에게는 쓸 수 없습니다';
    if ((id === 'K_rank' || id === 'K_rank3') && u.rank >= CFG.maxRank) return '이미 최고 공명 등급입니다';
    if (id === 'K_morph' && !morphPool(run).length) return '바뀔 수 있는 기물이 없습니다';
    if (isInjector(id) && u.rank >= CFG.maxRank) return '이미 최고 공명 등급입니다';
    const gear = u.items.filter((x) => x && !isLocked(x)).length;
    if ((id === 'K_strip' || id === 'K_reroll') && !gear) return '해제 · 변경할 장비가 없습니다';
    if (id === 'K_strip' && run.inventory.length - 1 + gear > CFG.inventoryMax) return '보관함 공간이 부족합니다';
    return null;
  }
  if (tg.k === 'unit') return '장비에 사용하는 소모품입니다';
  const it = useItemId(run, tg);
  if (!it) return '대상 장비 없음';
  if (isLocked(it) || isConsumable(it)) return '이 장비에는 쓸 수 없습니다';
  if (id === 'K_legend' && (it[0] === 'L' || isMod(it) || isTurretGear(it))) return '전설로 바꿀 수 없는 장비입니다';
  if (id === 'K_copy' && run.inventory.length - 1 >= CFG.inventoryMax) return '보관함이 가득 찼습니다';
  return null;
}
const useItemId = (run: RunState, tg: UseTarget) => tg.k === 'inv' ? run.inventory[tg.i] : tg.k === 'eq' ? (tg.slot === -1 ? run.units.find((x) => x.uid === tg.uid)?.mod : run.units.find((x) => x.uid === tg.uid)?.items[tg.slot]) ?? null : null;
const morphPool = (run: RunState) => RECRUITABLE.filter((d) => !d.traits.includes('EXPLORER') && !run.units.some((u) => u.defId === d.id)).map((d) => d.id);
const toLegend = (it: string) => it[0] === 'A' ? `L_${it.slice(2)}` : `L_${it.slice(2)}_${it.slice(2)}`;
/** 소모품 사용. 결과 문구 또는 오류 */
export function useConsumable(run: RunState, kIdx: number, tg: UseTarget): { ok: boolean; msg: string } {
  const err = useCheck(run, kIdx, tg);
  if (err) return { ok: false, msg: err };
  const id = run.inventory[kIdx];
  const name = CONSUMABLES[id].name;
  let msg = '';
  if (id === 'K_bread') { // 갓 구운 빵: 플레이어 체력 회복 (위험 등급별)
    const h = Math.min(run.maxHp - run.hp, breadHeal(run.diff));
    run.hp += h;
    run.inventory.splice(kIdx, 1);
    msg = `플레이어 체력 +${h} (${run.hp}/${run.maxHp})`;
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  if (id === 'K_seize' && tg.k === 'foe') { // 강제 징수기: 적 장비를 모두 떼어 내고 가장 높은 등급 1개를 보관함으로
    const s = run.node!.enc!.enemies[tg.i];
    const gear = foeGearOf(s);
    const best = gear.reduce((a, b) => (gearRank(b) > gearRank(a) ? b : a));
    delete s.items; delete s.mod;
    s.stripped = true;
    run.inventory.splice(kIdx, 1);
    const got = gainItem(run, best, undefined, true);
    msg = `${ENEMY_BY_ID[s.defId]?.name || '적'}의 장비 ${gear.length}개를 떼어 냈습니다 — ${got ? itemInfo(got).name : '?'} 획득`;
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  if (id === 'K_strip' || id === 'K_reroll' || isInjector(id)) {
    const u = run.units.find((x) => x.uid === (tg as { uid: string }).uid)!;
    const nm = UNIT_BY_ID[u.defId].name;
    run.inventory.splice(kIdx, 1);
    if (isInjector(id)) { const r0 = u.rank, a = injectAmount(id); u.xp += a; settleXp(run, u); msg = `${nm} 공명도 +${a}${u.rank > r0 ? ` (공명 등급 ${u.rank})` : ''}`; }
    else if (id === 'K_strip') {
      let n = 0;
      u.items = u.items.map((x) => { if (!x || isLocked(x)) return x; run.inventory.push(x); n++; return null; });
      msg = `${nm} 장비 ${n}개 해제`;
    } else {
      const pool = (x: string) => x[0] === 'C' ? ALL_COMPONENTS : x[0] === 'G' ? ALL_GRADED : x[0] === 'A' ? ALL_ADVANCED : ALL_ADVANCED.map((a) => 'L_' + a.slice(2));
      const names: string[] = [];
      u.items = u.items.map((x) => {
        if (!x || isLocked(x)) return x;
        const opts = pool(x).filter((y) => y !== x);
        const y = rng(run, (r) => r.pick(opts.length ? opts : [x]));
        names.push(itemInfo(y).name);
        return y;
      });
      msg = `${nm} 장비 재구성: ${names.join(' · ')}`;
    }
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  if (id === 'K_rank' || id === 'K_rank3' || id === 'K_morph') {
    const u = run.units.find((x) => x.uid === (tg as { uid: string }).uid)!;
    run.inventory.splice(kIdx, 1);
    if (id === 'K_rank' || id === 'K_rank3') { for (let i = 0; i < (id === 'K_rank3' ? 3 : 1) && u.rank < CFG.maxRank; i++) rankUp(run, u); msg = `${UNIT_BY_ID[u.defId].name} 공명 등급 ${u.rank}`; }
    else {
      const to = rng(run, (r) => r.pick(morphPool(run)));
      const nu = addUnit(run, to, Math.min(CFG.maxRank, u.rank + 3));
      nu.pos = u.pos; nu.xp = 0;
      for (const it of u.items) {
        if (!it || isLocked(it)) continue;
        const k = nu.items.indexOf(null);
        if (k >= 0) nu.items[k] = it; else gainItem(run, it, undefined, true, true);
      }
      nu.mod = u.mod;
      run.units = run.units.filter((x) => x !== u);
      run.pending = run.pending.filter((p) => !('uid' in p) || p.uid !== u.uid);
      if (run.aceTarget === u.uid) run.aceTarget = null;
      msg = `${UNIT_BY_ID[u.defId].name} → ${UNIT_BY_ID[to].name} (공명 등급 ${nu.rank})`;
    }
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  const it = useItemId(run, tg)!;
  const out = id === 'K_legend' ? toLegend(it) : it;
  if (id === 'K_legend') {
    if (tg.k === 'inv') run.inventory[tg.i] = out;
    else if (tg.k === 'eq') { const u = run.units.find((x) => x.uid === tg.uid)!; u.items[tg.slot] = out; }
    msg = `${itemInfo(it).name} → ${itemInfo(out).name}`;
  }
  run.inventory.splice(kIdx, 1);
  if (id === 'K_copy') { run.inventory.push(it); msg = `${itemInfo(it).name} 복제`; }
  log(run, `${name}: ${msg}`);
  return { ok: true, msg };
}

export function leaveShop(run: RunState) { run.node = null; advance(run); }

/** 분기점(상점 노드): 상점 · 보급 + 호이슌 투자 · 순례 (각각 페이즈당 1회) */
export function branchOptions(run: RunState): NodeType[] {
  const used = run.picked.slice(0, run.step);
  // 속보 (명성 교환)는 은하 대스타가 활성화되어 있을 때만. 보스 직전 분기점이면 곧 속보 노드가 자동으로 붙으므로 분기점의 속보는 빼서 중복을 막는다
  const star = tierNow(run, 'STAR') > 0;
  const preBoss = !!run.map[run.step + 1]?.includes('boss');
  const o: NodeType[] = star && !preBoss ? ['shop', 'supply', 'news', 'recruit'] : ['shop', 'supply', 'recruit'];
  if (tierNow(run, 'HOI') && !used.includes('invest')) o.push('invest');
  if (hasDivine(run) && !used.includes('pilgrim')) o.push('pilgrim');
  if (tierNow(run, 'ENG')) o.push('maint'); // 엔지니어 출전 중: 정비 (포탑 전용 장비)
  return o;
}
export function pickBranch(run: RunState, type: NodeType) {
  const p = run.pending[0];
  if (p?.t !== 'branch' || !p.options.includes(type)) return;
  run.pending.shift();
  if (type === 'shop') { run.node = { type, shop: genShop(run) }; return; }
  if (type === 'maint') { run.picked[run.step] = 'maint'; run.node = { type: 'shop', shop: genMaint(run), maint: true }; log(run, '분기점: 정비'); return; }
  run.fame -= tierNow(run, 'STAR'); // 분기점 진입 때 이미 받음
  enterNode(run, type);
}

export const hasDivine = (run: RunState) => run.units.some((u) => UNIT_BY_ID[u.defId].ttype === 'divine');
const tierNow = (run: RunState, id: 'STAR' | 'HOI' | 'OCCULT' | 'HEL' | 'ENG' | 'CHEF') => tierOf(id, synergyCounts(deployed(run), run)[id] || 0);

export function advance(run: RunState) {
  run.node = null;
  run.step++;
  if (run.tutorial && run.step >= run.map.length) return; // 튜토리얼: 항로 끝 (다음 페이즈 없음)
  if (run.mods.nodeIncome) run.credits += run.mods.nodeIncome; // 분할 정산 등
  if (run.step >= run.map.length) {
    run.phase++;
    run.mods.divGain = 0; // 성인 기념일은 이번 페이즈만
    run.step = 0;
    run.map = phaseMap(run.phase);
    run.picked = [];
    run.nodeUnits = {};
    autoPlace(run);
    run.blessing = null;
    run.phaseBoons = [];
    log(run, `페이즈 ${run.phase} 진입. 적이 강해집니다.`);
    if (despairAt(run.diff, run.phase)) queueDespair(run, run.phase); // 고난: 절망 증강 1개 더 (영입보다 먼저)
    offerRecruit(run); // 페이즈 시작 영입
    if (run.fund) { run.credits += run.fund; log(run, `호이슌 투자 수익 +${run.fund}`); run.pending.push({ t: 'notice', title: '투자 수익 정산', body: `지난 페이즈에 맡긴 자금이 불어나 크레딧 +${run.fund}을 돌려받았습니다.` }); run.fund = 0; }
  }
  // 은하 대스타가 활성화되어 있으면 보스 직전에 속보 노드 추가
  // (분기점에서 이미 속보를 골랐으면 붙이지 않는다: picked 는 실제로 간 노드)
  if (run.map[run.step]?.includes('boss') && run.map[run.step - 1]?.[0] !== 'news' && run.picked[run.step - 1] !== 'news' && tierNow(run, 'STAR')) {
    run.map.splice(run.step, 0, ['news']);
  }
}

function rollGlobals(run: RunState): string[] {
  const pool = GLOBALS.filter((g) => !(g.unique && run.globals.includes(g.id))).map((g) => g.id);
  return rng(run, (r) => r.sample(pool, 3));
}
export function rerollGlobal(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'global' || !p.rerolls) return;
  p.rerolls--;
  p.options = rollGlobals(run);
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
/** 적이 장비를 다는 위험 등급 (difficulty.ts 위험 2 설명) · 그 등급 이상인지 (gearEnemies · 강제 징수기 입고 · 보상 공용) */
export const FOE_GEAR_DIFF = 2;
export const foeGearOn = (run: RunState) => diffHas(run.diff, FOE_GEAR_DIFF);
/**
 * 위험 등급 장비: (2)부터 적이 낮은 확률로 재료를 달고, 역경 · 보스전에서는 고급 장비도 단다 (희귀 · 전설처럼 추가 효과가 있는 장비는 없음).
 * (5)부터 개조부품(문장 제외)을 달 수 있고, 보스는 거의 항상 전설 장비(재생 외골격 제외)를 단다.
 * 장비 칸 수 = 2페이즈마다 1칸 (최대 3). 칸마다 따로 굴리고, 장비는 왼쪽부터 채운다.
 */
function gearEnemies(run: RunState, r: Rng, enemies: EnemySpawn[], type: NodeType, phase: number) {
  if (!foeGearOn(run)) return;
  const slots = Math.min(3, 1 + Math.floor((phase - 1) / 2));
  const big = type === 'adversity' || type === 'boss';
  const legends = ALL_ADVANCED.filter((x) => x !== 'A_vit_vit').map((x) => 'L_' + x.slice(2));
  const mods = Object.keys(OCCULT_MODS);
  for (const s of enemies) {
    const tier = ENEMY_BY_ID[s.defId].tier;
    const items: string[] = [];
    if (tier === 'boss' && diffHas(run.diff, 5) && r.chance(0.95)) items.push(r.pick(legends));
    const p = (big ? 0.25 : 0.08) * (tier === 'elite' ? 1.5 : tier === 'boss' ? 2 : 1); // 칸당 장착 확률
    for (let i = items.length; i < slots; i++) {
      if (!r.chance(p)) continue;
      items.push(big && r.chance(0.5) ? r.pick(ALL_GRADED) : r.pick(ALL_COMPONENTS));
    }
    // (6) 고난: 1페이즈부터 모든 적이 기본 장비를 최소 1개
    if (!items.length && diffHas(run.diff, 6)) items.push(big && r.chance(0.5) ? r.pick(ALL_GRADED) : r.pick(ALL_COMPONENTS));
    if (items.length) s.items = items;
    if (diffHas(run.diff, 5) && r.chance(tier === 'boss' ? 0.6 : tier === 'elite' ? 0.3 : 0.1)) s.mod = r.pick(mods);
  }
}

export function genEncounter(run: RunState, type: NodeType, phase = run.phase): Encounter {
  return rng(run, (r) => {
    const env = r.weighted(CFG.boardSizes, (x) => x.w);
    const n = type === 'boss' ? CFG.bossBoard : env.n;
    const rows = playerRows(n);
    const p = phase;
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
      const late = run.step >= 5 ? 1 : 0; // 페이즈 후반 (항로 회의 이후 두 번째 전투부터)
      const count = Math.min(rows * n - 2, 2 + p + late + (f.extraEnemies || 0) + (type === 'adversity' && diffHas(run.diff, 5) ? 1 : 0));
      if (type === 'adversity' || (p >= 2 && r.chance(diffHas(run.diff, 5) ? 0.6 : 0.3))) ids.push(f.elite);
      while (ids.length < count) ids.push(r.pick(pool));
    }
    // 위험 등급 적 증원 (모험 · 고난, CFG.diffAdd): 보스전 포함 모든 전투. 이 조우에 이미 나온 일반 적(정예 · 보스 · 장애물 제외) 중에서 복제하고,
    // 없으면 전장 풀에서. 보드 칸(줄 × 폭 - 2)이 모자라면 들어가는 만큼만
    const add = Math.max(0, Math.min(diffAddCount(run.diff, p), rows * n - 2 - ids.length));
    if (add) {
      const same = ids.filter((id) => ENEMY_BY_ID[id].tier === 'minion' && !ENEMY_BY_ID[id].inert);
      for (let i = 0; i < add; i++) ids.push(r.pick(same.length ? same : pool));
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
    gearEnemies(run, r, enemies, type, p);
    return {
      n, env: type === 'boss' ? '보스 아레나' : env.env, enemies,
      mult: encounterMult(type, run.step),
      seed: r.int(1, 2 ** 31 - 1),
      ...(phase !== run.phase ? { phase } : {}),
      ...(add ? { add } : {}),
    };
  });
}

// ───────────────────────── 전투 결과
export interface BattleSummary {
  won: boolean;
  lines: string[];
  /** 공명도: 획득량 + 전투 전 등급 · 등급 내 공명도 (결과 창 막대 연출용) */
  xp: { uid: string; amount: number; rank0?: number; xp0?: number }[];
  /** 이번 전투로 얻은 장비 */
  items?: string[];
  hpLoss: number;
  gameOver: boolean;
}

export function resolveBattle(run: RunState, b: Battle): BattleSummary {
  const inv0 = run.inventory.slice(); // 결과 창: 새로 얻은 장비 표시용
  const node = run.node!.type;
  const challenge = node === 'challenge';
  const type: NodeType = challenge ? 'adversity' : node; // 도전은 보상 · 피해를 역경 기준으로
  const won = b.winner === 0;
  const p = run.phase;
  const lines: string[] = [];
  const dep = deployed(run);
  const counts = synergyCounts(dep, run);
  const pet = tierOf('PET', counts.PET || 0);
  const uni = tierOf('UNI', counts.UNI || 0);

  // 이자 (수입 전 보유량 기준)
  const cap = Math.max(0, CFG.interestMax + run.mods.interestCap - (diffHas(run.diff, 3) ? 1 : 0)) + (pet >= 1 ? 3 : 0) + (pet >= 3 ? 3 : 0) + (pet >= 4 ? 4 : 0) + (hasGlobal(run, 'G.interest') ? 5 : 0)
    + (run.units.some((u) => u.defId === 'lars') ? 2 : 0); // 라르스: 이자 상한 +2
  const creditsBefore = run.credits;
  const interest = despairInterest(run, Math.min(cap, Math.floor(run.credits / CFG.interestPer)));
  let income = interest;
  if (interest) lines.push(`이자 +${interest} (상한 ${cap})`);

  let hpLoss = 0;
  if (won) {
    run.streak = Math.max(1, run.streak + 1);
    run.stats.wins++;
    let c = CFG.winCredits(p);
    if (type === 'adversity') c = Math.round(c * CFG.adversityReward);
    c = Math.round(c * CFG.diffWinMul(run.diff || 0)); // 위험 3 ×1.25 · 위험 6 ×1.5
    if (type === 'boss') c += 5;
    income += c;
    lines.push(`승리 보상 +${c}`);
    const sb = CFG.streakBonus(run.streak);
    if (sb) { income += sb; lines.push(`${run.streak}연승 보너스 +${sb}`); }
    if (pet >= 1) { const pb = pet >= 4 ? 3 : 1; income += pb; lines.push(`페트라 실적 +${pb}`); }
    const fw = fieldOf(run.field).winCredits;
    if (fw) { income += fw; lines.push(`전장 조건 · 계약 정산 +${fw}`); }
    // 전투 보상 소모품: 분리 용제 · 재구성 회로 · 공명 주입기 (주입기 크기는 페이즈에 따라) 중 하나
    const uc = CFG.drop.utility[type] || 0;
    if (uc && rng(run, (r) => r.chance(uc))) gainItem(run, rng(run, (r) => { const k = r.pick(['K_strip', 'K_reroll', 'inject']); return k === 'inject' ? pickInjector(r, p) : k; }), lines);
    // 전설 소모품 (따로 굴림): 강제 징수기 (적이 장비를 다는 위험 등급에서만) · 원초 공명석
    if (foeGearOn(run) && rng(run, (r) => r.chance(CFG.drop.seize[type] || 0))) gainItem(run, 'K_seize', lines);
    if (rng(run, (r) => r.chance(CFG.drop.rank3[type] || 0))) gainItem(run, 'K_rank3', lines);
    // 셰프: 갓 구운 빵 (셰프 단계별 확률)
    const chef = tierOf('CHEF', counts.CHEF || 0);
    if (chef && rng(run, (r) => r.chance(CFG.chef.breadWin[chef - 1] || 0))) gainItem(run, 'K_bread', lines);
    if (type === 'adversity') {
      for (let k = 0; k < CFG.drop.advParts; k++) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines); // 무작위 장비 재료 확정
    } else if (type === 'battle') {
      if (rng(run, (r) => r.chance(CFG.drop.battle * (fieldOf(run.field).dropMul || 1)))) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)), lines);
    } else if (type === 'boss') {
      // 보스 전리품: n 페이즈마다 희귀 장비, 그 외에는 확률로 재료 3개 중 1개
      if (p % CFG.drop.bossAdvEvery === 0) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 희귀 장비 1개 선택', options: rng(run, (r) => r.sample(ALL_ADVANCED, 3)) });
      else if (rng(run, (r) => r.chance(CFG.drop.bossPart))) run.pending.push({ t: 'itemPick', title: '보스 전리품 — 장비 재료 1개 선택', options: rng(run, (r) => r.sample(ALL_COMPONENTS, 3)) });
      lines.push(`페이즈 ${p} 클리어!`);
      if (p >= CFG.victoryPhase && !run.cleared) { run.cleared = true; run.pending.push({ t: 'victory' }); }
    }
  } else {
    run.streak = 0;
    run.stats.losses++;
    income += CFG.lossCredits;
    const survivors = b.fighters(1).length;
    hpLoss = type === 'boss' ? CFG.bossLossDamage(p) : CFG.lossDamage(p, survivors) * (type === 'adversity' ? CFG.adversityLoss : 1);
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
  const lvBefore = new Map(run.units.map((u) => [u.uid, { rank0: u.rank, xp0: u.xp }]));
  let pool = CFG.xpPool(p) * (won ? 1 : 0.5) * (type === 'adversity' ? CFG.adversityReward : 1) * (hasGlobal(run, 'G.resonance') ? 1.35 : 1) * despairXp(run);
  pool = Math.round(pool);
  distributeXp(run, pool);
  lines.push(`공명도 풀 ${pool} 분배`);
  if (uni) for (const u of dep) if (memberships(u).includes('UNI')) u.xp += [0, 1, 2, 3, 5][uni]; // 연합: 전투 후 추가 공명도
  const killsOf = (u: UnitState) => b.units.find((c) => c.src === u)?.counters.kills || 0;
  for (const u of dep) for (const a of u.augments) AUG_BY_ID[a.id]?.after?.(run, u, won, killsOf(u), { c: b.units.find((c) => c.src === u), gain: (id) => gainItem(run, id, lines) });
  // 성직자: 승리 시 신앙 / 대스타: 승리 시 명성 + 대스타 처치 수
  const star = tierOf('STAR', counts.STAR || 0);
  settleGrowth(run, b, won, interest, lines);
  if (star) {
    const starKills = dep.filter((u) => memberships(u).includes('STAR')).reduce((sum, u) => sum + killsOf(u), 0);
    const f = (won ? 2 * [0, 1, 2, 3, 5][star] : 0) + Math.floor(starKills / 3);
    if (f) { run.fame += f; lines.push(`명성 +${f} (현재 ${run.fame})`); }
  }
  // 라르스: 함께한 뒤 번 크레딧 누적
  const earned = Math.max(0, run.credits - creditsBefore);
  for (const u of run.units) if (u.defId === 'lars') { u.grow ??= {}; u.grow.earn = (u.grow.earn || 0) + earned; }
  for (const u of run.units) settleXp(run, u);
  const xp = run.units.map((u) => ({ uid: u.uid, amount: u.xp + totalXpOf(u) - xpBefore.get(u.uid)!, ...lvBefore.get(u.uid) }));

  // 헬레니우스 퀘스트
  questProgress(run, b, won, type, lines);

  run.stats.kills += b.counters.kills;
  run.stats.bestHit = Math.max(run.stats.bestHit, Math.round(b.counters.bestHit));
  log(run, `P${p} ${type === 'boss' ? '보스' : type === 'adversity' ? '역경' : '전투'} ${won ? '승리' : '패배'}`);

  let gameOver = false;
  if (run.tutorial) {
    // 튜토리얼: 체력은 1 아래로 내려가지 않고, 지면 같은 조우를 다시 (다음 칸으로 넘어가지 않는다)
    run.hp = Math.max(1, run.hp);
    if (!won) {
      const enc = run.node!.enc!;
      run.node = { type: node, enc: { ...enc, seed: (enc.seed + 7919) % 2147483647 } };
      lines.push('튜토리얼 — 같은 전투를 다시 시도합니다.');
      const gained0 = run.inventory.slice();
      for (const id of inv0) { const i = gained0.indexOf(id); if (i >= 0) gained0.splice(i, 1); }
      return { won, lines, xp, hpLoss, gameOver: false, items: gained0 };
    }
  }
  if (challenge && won) {
    challengeReward(run, lines);
    const bonus = Math.round(CFG.xpPool(p) * CFG.challengeXp * despairXp(run));
    distributeXp(run, bonus);
    run.units.forEach((u) => settleXp(run, u));
    lines.push(`도전 성공 — 공명도 풀 ${bonus} 추가 분배`);
    if (p >= CFG.victoryPhase && !run.cleared) {
      // 최종 페이즈: 남은 노드를 건너뛰고 보스로 직행 (의뢰 성공은 보스 격파로만)
      run.step = run.map.length - 2;
      lines.push('최종 페이즈 — 곧바로 보스로 향합니다.');
    } else {
      run.step = run.map.length - 1;
      lines.push(`페이즈 ${p}의 남은 노드를 건너뛰고 다음 페이즈로 넘어갑니다.`);
    }
  }
  if (run.hp <= 0) { run.hp = 0; run.over = true; gameOver = true; }
  else if (won || type !== 'boss') advance(run);
  else run.node = { type: 'boss', enc: genEncounter(run, 'boss') };
  const gained = run.inventory.slice();
  for (const id of inv0) { const i = gained.indexOf(id); if (i >= 0) gained.splice(i, 1); }
  return { won, lines, xp, hpLoss, gameOver, items: gained };
}

function totalXpOf(u: UnitState) { let t = 0; for (let r = 1; r < u.rank; r++) t += CFG.xpToNext(r); return t; }

/** 공명도 풀을 파티 전체에 무작위 분배 (최소 1pt 보정) */
export function distributeXp(run: RunState, pool: number) {
  // 출전 기물은 최소 1 보장, 대기 기물은 가중치를 낮춰 나눠 받는다
  const us = run.units.filter((u) => !isRock(u)); // 반려 돌은 공명도를 받지 않는다
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
  if (isRock(u)) return; // 반려 돌: 공명 등급이 오르지 않는다
  u.rank++;
  run.rankLog[u.defId] = Math.max(run.rankLog[u.defId] || 0, u.rank);
  for (const k of MAJORS) u.alloc[k] += CFG.rankAll; // 모든 메이저 자동 상승
  const tt = UNIT_BY_ID[u.defId].ttype;
  const R = u.rank;
  // 마이너: 능력치 2종 +3 · 메이저: 메이저 증강 · 스페셜: 전용 증강 · 사이오닉: 전공 증강 (디바인은 스탯만)
  if (CFG.growth.pick(tt, R)) run.pending.push({ t: 'rankup', uid: u.uid, rank: R, points: CFG.rankPoints, options: [], rerolls: 0, allocDone: false, ...(rng(run, (r) => r.chance(CFG.greatChance)) ? { great: true } : {}) }); // 대성공은 미리 굴려 두고 첫 확정 때 공개
  if (CFG.growth.major(tt, R)) run.pending.push({ t: 'rankup', uid: u.uid, rank: R, points: 0, options: null, rerolls: CFG.augmentRerolls, allocDone: true, kind: 'major' });
  if (CFG.growth.special(tt, R) && augRoom(u, 'special')) run.pending.push({ t: 'rankup', uid: u.uid, rank: R, points: 0, options: null, rerolls: CFG.augmentRerolls, allocDone: true, kind: 'special' });
  if (CFG.growth.psionic(tt, R) && augRoom(u, 'psionic')) run.pending.push({ t: 'rankup', uid: u.uid, rank: R, points: 0, options: null, rerolls: CFG.augmentRerolls, allocDone: true, kind: 'psionic' });
}

export function buyXp(run: RunState, uid: string): boolean {
  const u = run.units.find((x) => x.uid === uid);
  const cost = CFG.buyXpCost - (hasGlobal(run, 'G.study') ? 1 : 0);
  if (!u || isRock(u) || u.rank >= CFG.maxRank || run.credits < cost) return false;
  run.credits -= cost;
  u.xp += CFG.buyXpAmount + (hasGlobal(run, 'G.study') ? 1 : 0);
  settleXp(run, u);
  return true;
}
export const xpCost = (run: RunState) => CFG.buyXpCost - (hasGlobal(run, 'G.study') ? 1 : 0);

// ───────────────────────── 증강 선택
export type AugKind = 'major' | 'special' | 'psionic' | 'school';
/** 기물 유형이 받는 증강 종류 (마이너 · 디바인은 없음) */
export function typeAugKind(u: UnitState): AugKind | null {
  const tt = UNIT_BY_ID[u.defId].ttype;
  return tt === 'major' || tt === 'special' || tt === 'psionic' ? tt : null;
}
/** 사이오닉: 보유 학파의 전공 증강 (학파가 없으면 빈 목록) */
export const psiPool = (u: UnitState) => schoolPassives(schoolOf(u));
/** 이 유형 증강을 더 받을 수 있는지 (스페셜 · 사이오닉은 최대 4개, 학파는 1개) */
export function augRoom(u: UnitState, kind: AugKind) {
  if (kind === 'major') return true;
  if (kind === 'school') return UNIT_BY_ID[u.defId].ttype === 'psionic' && !schoolOf(u);
  if (kind === 'psionic' && !schoolOf(u)) return u.augments.filter((a) => a.id.startsWith('psi.')).length < 4; // 학파 선택 대기 중: 이정표는 남겨 둔다
  const list = kind === 'special' ? UNIT_BY_ID[u.defId].specialAugs || [] : psiPool(u);
  const pool = new Set(list.map((a) => a.id));
  if (u.augments.filter((a) => pool.has(a.id)).length >= 4) return false;
  return list.some((a) => !u.augments.some((p) => p.id === a.id)); // 고를 수 있는 증강이 남았는지
}
export function augOptions(run: RunState, u: UnitState, kind: AugKind = 'major'): AugPick[] {
  const def = UNIT_BY_ID[u.defId];
  const owned = new Set(u.augments.map((a) => a.id));
  const avail = (a: { id: string; stack?: boolean }) => a.stack || !owned.has(a.id);
  if (!augRoom(u, kind)) return [];
  // 전공: 기물 학파의 전공 2개 (학파가 없는 레이첼은 8개 전부)
  if (kind === 'school') { const ok = majorsOf(def.id); return SCHOOL_AUGS.filter((a) => ok.includes(a.owner as SchoolId)).map((a) => ({ id: a.id })); }
  const base = kind === 'special' ? def.specialAugs || [] : kind === 'psionic' ? psiPool(u) : MAJOR_AUGS;
  const unitPool = base.filter((a) => avail(a));
  if (kind === 'psionic') {
    // 전공 증강: 기본 증강 3장, 확률(psiLegendChance)로 그중 1장이 ★ 전설
    const leg = unitPool.filter((a) => isLegendAug(a.id)).map((a) => a.id), norm = unitPool.filter((a) => !isLegendAug(a.id)).map((a) => a.id);
    return rng(run, (r) => {
      const show = leg.length > 0 && r.chance(psiLegendChance(u));
      const out = show ? [...r.sample(norm, CFG.augmentChoices - 1), r.pick(leg)] : r.sample(norm, CFG.augmentChoices);
      return r.shuffle(out).map((id) => ({ id }));
    });
  }
  return rng(run, (r) => {
    // 배타 증강은 없다 (어떤 조합도 함께 작동). 보유하지 않은 후보에서 균등 비복원 추출
    const out = r.sample(unitPool.map((x) => x.id), CFG.augmentChoices);
    return out.map((id) => {
      const a = AUG_BY_ID[id];
      return a.roll ? { id, param: a.roll((arr) => r.pick(arr)) } : { id };
    });
  });
}

/** ★ 전설 전공 증강이 이번 선택지에 섞일 확률: 기본 + 전설 없이 지나간 전공 증강 선택마다 보정, 전설을 한 번 얻으면 기본만 */
export function psiLegendChance(u: UnitState): number {
  const owned = u.augments.filter((a) => a.id.startsWith('psi.'));
  if (owned.some((a) => isLegendAug(a.id))) return CFG.psiLegend.base;
  return Math.min(1, CFG.psiLegend.base + CFG.psiLegend.pity * owned.length);
}
export function ensureRankupOptions(run: RunState, p: Extract<Pending, { t: 'rankup' }>) {
  const u = run.units.find((x) => x.uid === p.uid);
  if (u && !p.options) p.options = augOptions(run, u, (p.kind as AugKind) || 'major');
}

// ───────────────────────── 경제 / 아이템
/** 절망 증강 [유닉스제 대량 생산]: 새로 얻는 희귀 · 고급 장비 (합성 결과 포함)가 확률로 캣휠이 된다 */
export function unixSwap(run: RunState, id: string, lines?: string[]): string {
  if (!hasDespair(run, 'D.unix') || !(ALL_ADVANCED.includes(id) || ALL_GRADED.includes(id))) return id;
  if (!rng(run, (r) => r.chance(CFG.despair.catwheel))) return id;
  const msg = `유닉스제 대량 생산 — ${itemInfo(id).name} 대신 ${itemInfo(CATWHEEL).name}`;
  lines?.push(msg);
  log(run, msg);
  return CATWHEEL;
}
/** 장비 획득. own = 이미 가진 장비를 돌려받는 경우 (방출 · 변성: 유닉스제 대체 없음). 들어온 장비 id (자동 판매면 null) */
export function gainItem(run: RunState, id: string, lines?: string[], force = false, own = false): string | null {
  if (!own) id = unixSwap(run, id, lines);
  if (run.inventory.length >= CFG.inventoryMax && !force) {
    const v = CFG.sell[id[0]];
    run.credits += v;
    lines?.push(`인벤토리 가득 참 — ${itemInfo(id).name} 자동 판매 +${v}`);
    return null;
  }
  run.inventory.push(id);
  lines?.push(`장비 획득: ${itemInfo(id).name}`);
  return id;
}

/** 공명 주입기 1개: 페이즈에 맞는 크기 (injectorWeights 가중치) */
const pickInjector = (r: Rng, phase: number) => r.weighted(injectorWeights(phase), ([, w]) => w)[0];

function genShop(run: RunState) {
  return rng(run, (r) => {
    const stock: ShopSlot[] = [];
    const mul = (fieldOf(run.field).shopMul || 1) * despairPrice(run);
    const pr = (g: string) => Math.round(CFG.price[g] * mul);
    const S = CFG.shop, sp = (id: string, key = id) => ({ item: id, price: Math.round(S.price[key] * mul), sold: false });
    // 재료 2개 확정 + 희귀(입고 행사면 2개) · 고급 · 후반 전설 확률
    for (let i = 0; i < CFG.drop.shopParts; i++) { const id = r.pick(ALL_COMPONENTS); stock.push({ item: id, price: pr('C'), sold: false }); }
    const rares = r.chance(CFG.drop.shopAdv2) ? 2 : r.chance(CFG.drop.shopAdv) ? 1 : 0;
    for (const id of r.sample(ALL_ADVANCED, rares)) stock.push({ item: id, price: pr('A'), sold: false });
    if (r.chance(CFG.drop.shopGraded)) stock.push({ item: r.pick(ALL_GRADED), price: pr('G'), sold: false });
    if (run.phase >= CFG.drop.shopLegendPhase && r.chance(CFG.drop.shopLegend)) stock.push({ item: 'L_' + r.pick(ALL_ADVANCED).slice(2), price: pr('L'), sold: false });
    // 3페이즈부터: 고급 · 희귀 장비 1개 이상 확정 (확률 입고로 하나도 없으면 하나 더)
    if (run.phase >= S.gearFrom && !stock.some((x) => x.item[0] === 'G' || x.item[0] === 'A')) {
      if (r.chance(S.gearAdv)) stock.push({ item: r.pick(ALL_ADVANCED), price: pr('A'), sold: false });
      else stock.push({ item: r.pick(ALL_GRADED), price: pr('G'), sold: false });
    }
    // 소모품 (종종): 공명 주입기 (페이즈에 맞는 크기) · 분리 용제 · 재구성 회로 중 하나
    if (r.chance(S.cons)) {
      const k = r.weighted(Object.keys(S.consW), (x) => S.consW[x]);
      const id = k === 'inject' ? pickInjector(r, run.phase) : k;
      stock.push(sp(id));
    }
    // 전설 소모품: 강제 징수기 (종종, 적이 장비를 다는 위험 등급에서만) · 원초 공명석 (희귀)
    if (foeGearOn(run) && r.chance(S.seize)) stock.push(sp('K_seize'));
    if (run.phase >= S.rank3From && r.chance(S.rank3)) stock.push(sp('K_rank3'));
    // 문장 (희귀): 출전 기물이 가진 시너지 위주
    if (r.chance(S.emblem)) {
      const own = [...new Set(deployed(run).flatMap((u) => memberships(u)))].filter((x) => EMBLEM_SYNS.includes(x));
      stock.push(sp(emblemId(r.pick(own.length && r.chance(S.emblemOwn) ? own : EMBLEM_SYNS)), 'emblem'));
    }
    return stock;
  });
}

/** 정비 (엔지니어): 포탑 전용 장비. 보급형 1개 무료 + 보급형 2 · 고급형 2 (가격은 상점 등급 기준) */
function genMaint(run: RunState) {
  return rng(run, (r) => {
    const mul = (fieldOf(run.field).shopMul || 1) * despairPrice(run);
    const basic = r.sample(TURRET_BASIC, 3), adv = r.sample(TURRET_ADV, 2);
    return [
      { item: basic[0], price: 0, sold: false },
      ...basic.slice(1).map((id) => ({ item: id, price: Math.round(TURRET_PRICE.basic * mul), sold: false })),
      ...adv.map((id) => ({ item: id, price: Math.round(TURRET_PRICE.adv * mul), sold: false })),
    ];
  });
}

/** 포탑 장비 칸 상태를 엔지니어 단계에 맞춘다: 포탑 수 · 칸 수가 줄면 남는 장비는 보관함으로, 엔지니어가 꺼지면 포탑 회수 */
export function syncTurrets(run: RunState): string[] {
  const n = turretCount(run);
  const slots = turretSlots(n);
  const back: string[] = [];
  const g = (run.turretGear ||= []);
  for (let i = 0; i < g.length; i++) {
    const keep = i < n ? slots : 0;
    for (let k = keep; k < g[i].length; k++) if (g[i][k]) back.push(g[i][k]!);
    g[i] = g[i].slice(0, keep);
  }
  g.length = Math.min(g.length, n);
  for (let i = 0; i < n; i++) { g[i] ||= []; while (g[i].length < slots) g[i].push(null); }
  if (!n && run.turretPos?.length) run.turretPos = []; // 엔지니어 비활성: 설치한 포탑 회수
  for (const id of back) run.inventory.push(id); // 보관함이 가득 차도 돌려준다
  if (back.length) log(run, `포탑 회수: 장비 ${back.length}개 보관함으로`);
  return back;
}
/** 보관함의 포탑 장비를 포탑 ti 의 칸에 (slot 생략 = 빈 칸, 없으면 첫 칸과 맞교환) */
export function equipTurret(run: RunState, invIdx: number, ti: number, slot?: number): string | null {
  const id = run.inventory[invIdx];
  if (!id) return '대상 없음';
  if (!isTurretGear(id)) return '포탑에는 포탑 전용 장비만 장착할 수 있습니다';
  syncTurrets(run);
  const g = run.turretGear![ti];
  if (!g) return '포탑이 없습니다';
  let k = slot !== undefined && slot >= 0 && slot < g.length ? slot : g.indexOf(null);
  if (k < 0) k = 0;
  run.inventory.splice(invIdx, 1);
  if (g[k]) run.inventory.push(g[k]!);
  g[k] = id;
  return null;
}
export function unequipTurret(run: RunState, ti: number, slot: number): string | null {
  const g = run.turretGear?.[ti];
  if (!g?.[slot]) return null;
  if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
  run.inventory.push(g[slot]!);
  g[slot] = null;
  return null;
}
/** 포탑 장비를 다른 포탑 칸으로 (그 칸 장비와 맞교환) */
export function moveTurretGear(run: RunState, from: [number, number], to: [number, number]) {
  const g = run.turretGear || [];
  const a = g[from[0]], b = g[to[0]];
  if (!a || !b || to[1] >= b.length || from[1] >= a.length) return;
  [a[from[1]], b[to[1]]] = [b[to[1]], a[from[1]]];
}

export function buyShop(run: RunState, idx: number): string | null {
  const s = run.node?.shop?.[idx];
  if (!s || s.sold) return '이미 판매됨';
  if (run.credits < s.price) return '크레딧 부족';
  if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
  run.credits -= s.price;
  s.sold = true;
  run.inventory.push(unixSwap(run, s.item));
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
  const made = a && b ? combine(a, b) : null;
  if (!made) return null;
  const res = unixSwap(run, made);
  run.inventory = run.inventory.filter((_, k) => k !== i && k !== j);
  run.inventory.push(res);
  return res;
}
export function equip(run: RunState, invIdx: number, uid: string): string | null {
  const u = run.units.find((x) => x.uid === uid);
  const id = run.inventory[invIdx];
  if (!u || !id) return '대상 없음';
  if (isRock(u)) return '반려 돌은 장비를 달 수 없습니다';
  if (isConsumable(id)) return '소모품은 장착할 수 없습니다';
  if (isTurretGear(id)) return '포탑 전용 장비는 감시 포탑에만 장착할 수 있습니다';
  // 개조부품은 전용 칸으로 (이미 있으면 맞교환)
  if (isMod(id)) {
    if (isEmblem(id) && memberships(u).includes(emblemOf(id)) && u.mod !== id) return '이미 소속된 시너지의 문장입니다';
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
    u.items[k] = unixSwap(run, combine(u.items[k]!, id)!);
    run.inventory.splice(invIdx, 1);
    return null;
  }
  // 같은 기물에 조합 가능한 재료가 있으면 자동 조합
  const k = u.items.findIndex((x) => x && x[0] === 'C' && id[0] === 'C');
  if (k >= 0) u.items[k] = unixSwap(run, combine(u.items[k]!, id)!);
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
  repair: '플레이어 체력 +15', adv: '무작위 희귀 장비 1개',
};
export function takeSupply(run: RunState, opt: string) {
  if (opt === 'parts' && run.tutorial) { gainItem(run, 'C_pow'); run.credits += 4; return; } // 튜토리얼: 3장 조합 안내용 고정 재료
  if (opt === 'parts') { gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS))); run.credits += 4; }
  if (opt === 'parts2') { gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS))); distributeXp(run, Math.round(CFG.xpPool(run.phase) / 2)); run.units.forEach((u) => settleXp(run, u)); }
  if (opt === 'credits') run.credits += 12 + run.phase;
  if (opt === 'xp') { distributeXp(run, CFG.xpPool(run.phase)); run.units.forEach((u) => settleXp(run, u)); }
  if (opt === 'repair') run.hp = Math.min(run.maxHp, run.hp + 15);
  if (opt === 'adv') gainItem(run, rng(run, (r) => r.pick(ALL_ADVANCED)));
}
/** 영입 · 합류 등급: max(페이즈 - 1, 출전 기물 평균 등급 × k) */
export function joinRank(run: RunState): number {
  const dep = run.units.filter((u) => u.pos && !isRock(u));
  const avg = dep.length ? dep.reduce((s, u) => s + u.rank, 0) / dep.length : 1;
  return Math.min(CFG.maxRank, Math.max(1, run.phase - 1, Math.round(avg * CFG.joinRankRatio)));
}
export function recruit(run: RunState, defId: string) {
  const rank = UNIT_BY_ID[defId].inert ? 1 : Math.min(CFG.maxRank, joinRank(run) + (hasGlobal(run, 'G.scout') ? 1 : 0)); // 반려 돌은 등급 1
  addUnit(run, defId, Math.min(CFG.maxRank, rank));
  autoPlace(run);
  if (run.picked[run.step - 1] === 'recruit') (run.nodeUnits ??= {})[run.step - 1] = defId; // 타임라인 표시용
  log(run, `${UNIT_BY_ID[defId].name} 합류 (공명 ${rank})`);
}

/** 마이너 능력치 보상 확정 (화면 · 봇 공용). 대성공이면 첫 확정 뒤 같은 창에서 한 번 더 고른다.
 *  반환: false = 잘못된 선택, 'again' = 대성공 공개 (한 번 더), true = 끝 (allocDone) */
export function allocRank(run: RunState, p: Extract<Pending, { t: 'rankup' }>, picks: Major[]): boolean | 'again' {
  if (p.allocDone || !applyRankPicks(run, p.uid, picks, p.points)) return false;
  if (p.great && !p.round) {
    p.round = 1;
    const u = run.units.find((x) => x.uid === p.uid);
    log(run, `대성공! ${u ? UNIT_BY_ID[u.defId].name : ''} 능력치를 한 번 더 고른다`);
    return 'again';
  }
  p.allocDone = true;
  return true;
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
  if (pick.id.startsWith('school.') && schoolOf(u)) return; // 전공은 1개만
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
    while (tier && run.quests.length < tier + 1) { // 퀘스트 2 / 3 / 4 / 5개
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
    const mult = tier >= 4 ? 3 : tier >= 3 ? 2 : tier >= 2 ? 1.5 : 1;
    if (q.reward === 'credits') run.credits += Math.round(8 * mult);
    if (q.reward === 'part') for (let i = 0; i < Math.round(1 * mult + 0.01); i++) gainItem(run, rng(run, (r) => r.pick(ALL_COMPONENTS)));
    if (q.reward === 'xp') { distributeXp(run, Math.round(10 * mult)); run.units.forEach((u) => settleXp(run, u)); }
    lines.push(`헬레니우스 퀘스트 완료: ${questText(q)} → ${questRewardText(q)} 보상`);
    for (const u of dep) {
      if (!memberships(u).includes('HEL')) continue;
      if (tier >= 3) rng(run, (r) => { for (let i = 0; i < (tier >= 4 ? 3 : 2); i++) u.perm[r.pick(MAJORS)]++; });
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
  sponsor: { name: '스폰서 계약', desc: '무작위 희귀 장비 1개', cost: 12 },
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

// ───────────────────────── 호이슌 투자
export const INVEST_OFFERS: Record<string, { name: string; desc: (run: RunState, o: InvestOffer) => string; cost: number }> = {
  fund: { name: '호이슌 펀드', desc: () => '맡긴 크레딧을 다음 페이즈 시작에 불려서 돌려받습니다 (호이슌 단계에 따라 ×1.5 / ×1.8 / ×2.5).', cost: 20 },
  emblem: { name: '문장 매입', desc: () => '문장 3개 중 1개 선택. 장착한 기물이 그 시너지에 추가로 소속됩니다.', cost: 30 },
  rally: { name: '전략 자금 집행', desc: () => '이번 페이즈 동안 호이슌 기물 피해 +35%, 쿨다운 감소 속도 +25%.', cost: 15 },
  aug: { name: '인재 영입 패키지', desc: (run, o) => {
    const u = run.units.find((x) => x.uid === o.uid);
    const a = o.aug ? AUG_BY_ID[o.aug] : undefined;
    return u && a ? `${UNIT_BY_ID[u.defId].name}의 고유 증강 [${a.name}] 즉시 획득: ${a.desc}` : '대상 없음';
  }, cost: 25 },
  bond: { name: '정크 본드', desc: () => '다음 페이즈 시작에 50% 확률로 ×4, 아니면 0.', cost: 12 },
};
const investRate = [1.5, 1.8, 2.5];
const investPrice = [1, 0.85, 0.7];
function genInvest(run: RunState): InvestOffer[] {
  const t = Math.max(1, tierNow(run, 'HOI'));
  const order = ['fund', 'emblem', 'rally', 'aug', 'bond'].slice(0, 2 + t);
  return rng(run, (r) => order.map((id) => {
    const o: InvestOffer = { id, cost: Math.round(INVEST_OFFERS[id].cost * investPrice[t - 1]), sold: false };
    if (id === 'aug') {
      // 유형별 증강 계약: 메이저 증강 · 스페셜 전용 증강 · 사이오닉 전공 (마이너 · 디바인은 대상 아님)
      const cands = run.units.flatMap((u) => {
        const k = typeAugKind(u);
        if (!k || !augRoom(u, k)) return [];
        const pool = k === 'special' ? UNIT_BY_ID[u.defId].specialAugs || [] : k === 'psionic' ? psiPool(u) : MAJOR_AUGS;
        return pool.filter((a) => !a.roll && !u.augments.some((p) => p.id === a.id)).map((a) => ({ u, a }));
      });
      if (cands.length) { const c = r.pick(cands); o.uid = c.u.uid; o.aug = c.a.id; } else o.sold = true;
    }
    return o;
  }));
}
export function buyInvest(run: RunState, idx: number): string | null {
  const o = run.node?.invest?.[idx];
  if (!o || o.sold) return '이미 계약함';
  if (run.credits < o.cost) return '크레딧이 부족합니다';
  const t = Math.max(1, tierNow(run, 'HOI'));
  run.credits -= o.cost;
  o.sold = true;
  if (o.id === 'fund') run.fund = (run.fund || 0) + Math.round(o.cost * investRate[t - 1]);
  if (o.id === 'bond') run.fund = (run.fund || 0) + (rng(run, (r) => r.chance(0.5)) ? o.cost * 4 : 0);
  if (o.id === 'rally' && !run.phaseBoons.includes('hoi.rally')) run.phaseBoons.push('hoi.rally');
  if (o.id === 'emblem') {
    const own = [...new Set(run.units.flatMap((u) => memberships(u)))].filter((x) => EMBLEM_SYNS.includes(x));
    const opts = rng(run, (r) => r.sample(own.length >= 3 ? own : EMBLEM_SYNS, 3)).map((x) => emblemId(x));
    run.pending.push({ t: 'itemPick', title: '문장 매입 — 1개 선택', options: opts });
  }
  if (o.id === 'aug' && o.uid && o.aug) {
    const u = run.units.find((x) => x.uid === o.uid);
    if (u) u.augments.push({ id: o.aug });
  }
  log(run, `호이슌 투자: ${INVEST_OFFERS[o.id].name} (-${o.cost})`);
  return null;
}

/** 이전 버전 저장 데이터 보정 */
export function migrate(run: RunState): RunState {
  run.faith ??= 0;
  run.power ??= 0;
  run.relics ??= [];
  for (const u of run.units) if (UNIT_BY_ID[u.defId]?.ttype === 'divine' && !u.relic) u.relic = DEFAULT_RELIC[u.defId];
  run.divCap ??= 0;
  for (const u of run.units) { u.grow ??= {}; u.faith ??= UNIT_BY_ID[u.defId]?.faith; }
  run.fame ??= 0;
  run.blessing ??= null;
  run.staffTarget ??= null;
  run.aceTarget ??= null;
  run.privilege ??= null;
  for (const u of run.units) u.mod ??= null;
  for (const u of run.units) u.augments = u.augments.filter((a) => AUG_BY_ID[a.id]); // 없어진 증강 (라르스 장부 정리 · 옛 학파 school.trans · psi.* 등) 정리
  // 4학파 · 8전공: 학파에 맞지 않는 전공(옛 7학파)은 지우고, 전공이 없는 사이오닉 기물은 학파 전공 중 무작위 (합류 전공 선택이 대기 중이면 그대로 둔다)
  for (const u of run.units) {
    if (UNIT_BY_ID[u.defId]?.ttype !== 'psionic') continue;
    const ok = majorsOf(u.defId);
    const cur = schoolOf(u);
    if (cur && !ok.includes(cur)) u.augments = u.augments.filter((a) => !a.id.startsWith('school.') && !a.id.startsWith('psi.'));
    if (!schoolOf(u) && !run.pending.some((p) => p.t === 'rankup' && p.uid === u.uid && p.kind === 'school')) u.augments.unshift({ id: schoolAugId(rng(run, (r) => r.pick(ok))) });
    // 다른 전공의 전공 증강 · 중복 전공 정리 (전공 증강 최대 4개)
    const sc = schoolOf(u);
    let seenSchool = false, nPsi = 0;
    u.augments = u.augments.filter((a) => {
      if (a.id.startsWith('school.')) { const keep = !seenSchool && a.id === `school.${sc}`; seenSchool ||= keep; return keep; }
      if (a.id.startsWith('psi.')) return !!sc && AUG_BY_ID[a.id]?.owner === sc && ++nPsi <= 4;
      return true;
    });
  }
  // 없어진 증강이 든 증강 선택지 · 전공과 맞지 않는 선택지는 다시 뽑는다
  for (const p of run.pending) {
    if (p.t !== 'rankup' || !p.options) continue;
    const u = run.units.find((x) => x.uid === p.uid);
    if (p.options.some((o) => !AUG_BY_ID[o.id])) p.options = null;
    else if (u && p.kind === 'school' && p.options.some((o) => !majorsOf(u.defId).includes(o.id.slice(7) as SchoolId))) p.options = null;
    else if (u && p.kind === 'psionic' && p.options.some((o) => AUG_BY_ID[o.id]?.owner !== schoolOf(u))) p.options = null;
  }
  run.field ??= 'waste';
  run.diff ??= 0;
  if (!run.despairs) { // 위험 등급 체계 판 2 이전 저장: 절망 증강 1개 → 목록, 예전 위험 7 · 8 → 8 · 9 (위험 7 = 절망 증강을 끼워 넣음)
    run.despairs = run.despair ? [run.despair] : [];
    if (run.diff >= 7) run.diff++;
  }
  delete run.despair;
  run.cleared ??= false;
  run.endless ??= false;
  run.mods ??= { interestCap: 0, nodeIncome: 0 };
  run.boons ??= [];
  run.phaseBoons ??= [];
  run.seenEvents ??= [];
  run.flags ??= [];
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
  const list = EVENTS.filter((e) => (!e.fields || e.fields.includes(run.field)) && (e.minPhase || 1) <= run.phase && !((e.rare || e.once) && seen(e.id))
    && (!e.req || run.flags.includes(e.req)) && (!e.noFlag || !run.flags.includes(e.noFlag)));
  // 연계 후속 사건: 표식이 생겼으면 다음 사건 노드에 고정 등장
  const chain = list.find((e) => e.req && !seen(e.id));
  if (chain) return chain.id;
  // 엘베스타드 일가가 있으면 밍키가 조금 더 자주
  const w = (e: (typeof EVENTS)[number]) => e.weight * Math.pow(0.3, seen(e.id)) * (e.id === 'mingki' && run.units.some((u) => memberships(u).includes('FAM')) ? 2 : 1);
  return rng(run, (r) => r.weighted(list, w).id);
}

function eventApi(run: RunState): EventApi {
  const tierPool = (t: 'C' | 'G' | 'A' | 'L') => (t === 'C' ? ALL_COMPONENTS : t === 'G' ? ALL_GRADED : ALL_ADVANCED);
  return {
    rng: (f) => rng(run, f),
    gain: (id, force) => gainItem(run, id, undefined, force),
    recruitPick: (k) => { if (run.units.length < CFG.maxParty) run.pending.push({ t: 'recruit', options: recruitOptions(run, k) }); },
    join: (defId) => {
      if (run.units.length >= CFG.maxParty || run.units.some((u) => u.defId === defId)) return null;
      const u = addUnit(run, defId, joinRank(run));
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
    ].filter((x) => /^[CGAL]_/.test(x.id)),
    setItem: (ref, id) => {
      if (ref.where === 'unit' && ref.u) ref.u.items[ref.slot] = id;
      else if (id) run.inventory[ref.slot] = id;
      else run.inventory[ref.slot] = '';
    },
    randomItem: (t) => rng(run, (r) => { const a = r.pick(tierPool(t)); return t === 'L' ? 'L_' + a.slice(2) : a; }),
    augNow: (u) => {
      const k = typeAugKind(u);
      const opts = k ? augOptions(run, u, k) : [];
      // 증강이 없는 유형(마이너 · 디바인)이나 더 받을 수 없으면 공명 등급 +1
      if (!opts.length) { if (u.rank >= CFG.maxRank) return null; rankUp(run, u); return '공명 각성 (등급 +1)'; }
      u.augments.push(opts[0]);
      return AUG_BY_ID[opts[0].id]?.name || null;
    },
    phaseBoon: (id) => { if (!run.phaseBoons.includes(id)) run.phaseBoons.push(id); },
    boon: (id) => { if (!run.boons.includes(id)) run.boons.push(id); },
    flag: (id) => { if (!run.flags.includes(id)) run.flags.push(id); },
    chance: (p) => rng(run, (r) => r.chance(p)),
    outcome: () => {},
  };
}

/** 마지막으로 실행한 사건 선택지의 결과 키 (api.outcome, 없으면 'default'): 업적 판정용 (ui/achieve.ts) */
export let lastOutcome = 'default';
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
  let outKey = 'default';
  const vars: Record<string, string> = {};
  const api = { ...eventApi(run), outcome: (k: string, v?: Record<string, string>) => { outKey = k; Object.assign(vars, v || {}); } };
  const msg = c.apply(run, api);
  lastOutcome = outKey;
  run.inventory = run.inventory.filter(Boolean); // 사건 중 비운 칸 정리
  const follow = run.pending.splice(before);
  // 결과 장면: 연출의 after[선택지] (키별이면 outcome 키)
  const aft = EVENT_SCENES[ev.id]?.after?.[idx];
  const beats = !aft ? null : Array.isArray(aft) ? aft : aft[outKey] ?? aft.default ?? null;
  const scene = beats ? resolveScene(beats, undefined, null, { ...sceneVars(p.sub), ...vars }) : undefined;
  run.pending.unshift({ t: 'notice', title: ev.title, body: `${c.label} — ${msg}`, scene }, ...follow);
  log(run, `사건: ${ev.title} — ${c.label}`);
  return null;
}

// ───────────────────────── 사건 연출
/** 동적 조연: 연출의 조연 후보 중 보유 기물 (출전 기물 우선) 한 명 */
function pickSub(run: RunState, id: string): string | null {
  const sc = EVENT_SCENES[id];
  if (!sc?.subs) return null;
  const cand = Object.keys(sc.subs).filter((x) => !sc.cast.includes(x) && run.units.some((u) => u.defId === x));
  const front = cand.filter((x) => run.units.some((u) => u.defId === x && u.pos));
  const pool = front.length ? front : cand;
  return pool.length ? rng(run, (r) => r.pick(pool)) : null;
}
const sceneVars = (sub: string | null | undefined): Record<string, string> => ({ pc: PC_NAME, sub: sub ? UNIT_BY_ID[sub]?.name || sub : '' });
/** 사건 본문 장면 (연출이 없으면 text 를 서술 한 줄로) */
export function eventScene(p: { id: string; sub?: string | null }): Beat[] {
  const sc = EVENT_SCENES[p.id];
  if (!sc) return [{ text: EVENT_BY_ID[p.id]?.text || '' }];
  return resolveScene(sc.scene, sc.subs, p.sub, sceneVars(p.sub));
}

// ───────────────────────── 기물 방출
/** 방출 보상 미리보기: 쌓은 공명도의 60%를 남은 파티에, 크레딧 3 + 등급×2, 장비 · 개조부품 반환 */
export function releaseValue(run: RunState, u: UnitState) {
  let invested = u.xp;
  for (let r = 1; r < u.rank; r++) invested += CFG.xpToNext(r);
  const items = [...u.items.filter((x): x is string => !!x && !isLocked(x)), ...(u.mod ? [u.mod] : [])];
  const lost = u.items.filter((x): x is string => !!x && isLocked(x));
  if (isRock(u)) return { xp: 0, credits: 0, items, lost, invested: 0 }; // 반려 돌: 보상 없이 사라진다
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
  for (const id of v.items) gainItem(run, id, undefined, true, true);
  if (u.relic && u.relic !== DEFAULT_RELIC[u.defId]) (run.relics ??= []).push(u.relic); // 성유물은 보관 칸으로 (기본 성유물은 기물과 함께 떠남)
  distributeXp(run, v.xp);
  run.units.forEach((x) => settleXp(run, x));
  autoPlace(run);
  log(run, `${UNIT_BY_ID[u.defId].name} 방출: 크레딧 +${v.credits}, 공명도 ${v.xp} 분배`);
  return null;
}

// ───────────────────────── 디바인 · 순례
/** 순례 참배 카드 (권능 10~30). 축복은 이번 페이즈, 순례자의 기도는 다음 전투, 성인 기념일은 이번 페이즈 */
export const PILGRIM_CARDS: Record<string, { name: string; desc: string; cost: number; target?: boolean }> = {
  'bless:B.martyr': { name: '순교자의 가호', desc: '이번 페이즈 모든 아군 최대 체력 +20%.', cost: 15 },
  'bless:B.flame': { name: '성전의 불꽃', desc: '이번 페이즈 모든 아군 기본 공격에 기술 위력 25% 신성 추가 피해.', cost: 15 },
  'bless:B.sanctum': { name: '성소의 빛', desc: '이번 페이즈 전투 시작 시 모든 아군 최대 체력 15% 보호막.', cost: 15 },
  'bless:B.zeal': { name: '광신', desc: '이번 페이즈 모든 아군 공격 속도 +25%, 받는 피해 +10%.', cost: 15 },
  grail: { name: '성배', desc: '신성력 수집 상한 +50 (영구).', cost: 15 },
  prayer: { name: '순례자의 기도', desc: '다음 전투에서 모든 디바인이 신성력 40으로 시작.', cost: 10 },
  saintday: { name: '성인 기념일', desc: '이번 페이즈 디바인 신성력 획득 +50%.', cost: 20 },
  chrism: { name: '성유', desc: '디바인 1명 공명 등급 +1.', cost: 25, target: true },
  indulgence: { name: '면죄부', desc: '함대 체력 +15.', cost: 20 },
  convert: { name: '개종', desc: '디바인 1명의 신앙을 바꾼다.', cost: 20, target: true },
};
function genPilgrim(run: RunState): Extract<Pending, { t: 'pilgrim' }> {
  return rng(run, (r) => {
    const pool = Object.keys(PILGRIM_CARDS).filter((k) => k !== 'convert');
    const cards: NonNullable<Extract<Pending, { t: 'pilgrim' }>['cards']> = r.sample(pool, 3).map((id) => ({ id, cost: PILGRIM_CARDS[id].cost, sold: false }));
    if (r.chance(0.2)) cards[2] = { id: 'convert', cost: PILGRIM_CARDS.convert.cost, sold: false, faith: r.pick(FAITHS) };
    const owned = new Set([...(run.relics || []), ...run.units.map((u) => u.relic).filter((x): x is string => !!x)]);
    const rel = r.sample(RELICS.filter((x) => !owned.has(x.id)).map((x) => x.id), 2).map((id) => ({ id, cost: RELIC_BY_ID[id].price, sold: false }));
    return { t: 'pilgrim' as const, cards, relics: rel };
  });
}
/** 보유한 디바인 */
export const divines = (run: RunState) => run.units.filter((u) => UNIT_BY_ID[u.defId].ttype === 'divine');
const pilgrimOf = (run: RunState) => run.pending.find((x): x is Extract<Pending, { t: 'pilgrim' }> => x.t === 'pilgrim');
/** 참배 카드 구매. 대상이 필요한 카드는 uid (디바인) */
export function pilgrimCard(run: RunState, idx: number, uid?: string): string | null {
  const p = pilgrimOf(run);
  const c = p?.cards?.[idx];
  if (!p || !c || c.sold) return '이미 받았습니다';
  if (run.power < c.cost) return '권능 포인트가 부족합니다';
  const def = PILGRIM_CARDS[c.id];
  const u = uid ? run.units.find((x) => x.uid === uid) : undefined;
  if (def.target && (!u || UNIT_BY_ID[u.defId].ttype !== 'divine')) return '디바인 기물을 고르세요';
  if (c.id === 'chrism' && u!.rank >= CFG.maxRank) return '더 오를 수 없습니다';
  if (c.id === 'convert' && (!c.faith || u!.faith === c.faith)) return '이미 그 신앙입니다';
  if (c.id.startsWith('bless:')) pickBlessing(run, c.id.slice(6));
  else if (c.id === 'grail') run.divCap += 50;
  else if (c.id === 'prayer') run.mods.divStart = 40;
  else if (c.id === 'saintday') run.mods.divGain = 0.5;
  else if (c.id === 'chrism') rankUp(run, u!);
  else if (c.id === 'indulgence') run.hp = Math.min(run.maxHp, run.hp + 15);
  else if (c.id === 'convert') u!.faith = c.faith;
  run.power -= c.cost;
  c.sold = true;
  return null;
}
/** 성유물 구매 (보관함으로) */
export function pilgrimRelic(run: RunState, idx: number): string | null {
  const o = pilgrimOf(run)?.relics?.[idx];
  if (!o || o.sold) return '이미 구매했습니다';
  if (run.power < o.cost) return '권능 포인트가 부족합니다';
  run.power -= o.cost;
  o.sold = true;
  (run.relics ??= []).push(o.id);
  return null;
}
/** 성유물 장착 (디바인만, 쓰던 것은 보관함으로) */
export function equipRelic(run: RunState, uid: string, id: string): string | null {
  const u = run.units.find((x) => x.uid === uid);
  if (!u || UNIT_BY_ID[u.defId].ttype !== 'divine') return '디바인만 성유물을 장착합니다';
  const list = (run.relics ??= []);
  const i = list.indexOf(id);
  if (i < 0) return '보유하지 않은 성유물입니다';
  list.splice(i, 1);
  if (u.relic) list.push(u.relic);
  u.relic = id;
  u.enh = false;
  return null;
}
/** 신권 대행 강화: 다음 전투 한정 계수 ×3 */
export function enhanceRelic(run: RunState, uid: string): string | null {
  const u = run.units.find((x) => x.uid === uid);
  const rel = u?.relic ? RELIC_BY_ID[u.relic] : null;
  if (!u || !rel) return '성유물이 없습니다';
  if (u.enh) return '이미 강화했습니다';
  if (run.power < rel.enh) return '권능 포인트가 부족합니다';
  run.power -= rel.enh;
  u.enh = true;
  return null;
}

/** 전투 후 런 누적 성장 정산: 전투 중 g_ 기록 → UnitState.grow, 권능 포인트, 마이너 성장, 루스 전리품 */
function settleGrowth(run: RunState, b: Battle, won: boolean, interest: number, lines: string[]) {
  void won; void interest;
  let pw = 0;
  for (const c of b.units) {
    if (c.side !== 0 || !c.src) continue;
    const u = c.src;
    u.grow ??= {};
    for (const [k, v] of Object.entries(c.mem)) if (k.startsWith('g_') && v) u.grow[k.slice(2)] = (u.grow[k.slice(2)] || 0) + v;
    if (c.mem.g_loot) { run.credits += c.mem.g_loot; lines.push(`루스 약탈 +${c.mem.g_loot}`); }
    if (c.mem.g_ultLoot) { run.credits += c.mem.g_ultLoot; lines.push(`루스 약탈 개시 +${c.mem.g_ultLoot}`); }
    if (c.mem.g_divCredit) { run.credits += c.mem.g_divCredit; lines.push(`배당 결의서 +${c.mem.g_divCredit}`); }
    // 권능: 디바인 1명당 모은 신성력 ÷ 25, 신권 대행을 쓰면 +1
    if (c.div !== null && UNIT_BY_ID[u.defId]?.ttype === 'divine') pw += Math.floor(c.divGot / CFG.powerPerDiv) + (c.divUsed ? 1 : 0);
  }
  // 강화 · 다음 전투 한정 효과는 이번 전투로 끝
  for (const u of run.units) if (u.enh) u.enh = false;
  run.mods.divStart = 0;
  pw = Math.min(CFG.powerMax, pw);
  if (pw) { run.power += pw; lines.push(`권능 포인트 +${pw} (현재 ${run.power})`); }
}
