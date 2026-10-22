import { CFG } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { FIELDS, fieldOf } from '../data/battlefields';
import { diffAddCount, diffHas } from '../data/difficulty';
import { CATWHEEL, DESPAIR_BY_ID, DESPAIRS, despairAt, despairDiff, hasDespair, PETROCK } from '../data/despair';
import { contractWinMul } from '../data/contract';
import { OATH_BY_ID, oathDespairEvery, oathHeat, oathLv, oathsFor, oathV, oathWinMul, type OathSel } from '../data/oaths';
import { EVENT_BY_ID, EVENTS, type EventApi } from '../data/events';
import { PC_NAME, resolveScene, type Beat } from '../data/scene';
import { EVENT_SCENES } from '../data/scenes';
import { ENEMY_BY_ID } from '../data/enemies';
import { BLESSING_BY_ID, BLESSINGS, EMBLEM_SYNS, GLOBAL_BY_ID, GLOBAL_ODDS, GLOBALS, PRIVILEGES, synName } from '../data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_CONSUMABLES, ALL_GRADED, breadHeal, breadSell, CATWHEEL_ZI, combine, CONSUMABLES, emblemId, emblemOf, gearRank, injectAmount, injectorWeights, isConsumable, isEmblem, isInjector, isLocked, isMod, itemInfo, occultModsOfTier, OCCULT_MODS, HEL_ITEM_IDS, isHelItem, isTurretGear, isTurretItem, isTurretMod, TURRET_ADV, TURRET_BASIC, TURRET_MODS, TURRET_PRICE, turretModsOfTier, turretSlots } from '../data/items';
import { UNI_XP, OCCULT_SYNTH, SYN_BY_ID, SYNERGIES, tierOf } from '../data/synergies';
import { RECRUITABLE, UNIT_BY_ID } from '../data/units';
import { OATH_AUGS, VOW_ENH_KEEP } from '../data/oathaugs';
import { MAJOR_AUGS, recMajors } from '../data/rework';
import { SCHOOL_AUGS, schoolPassives } from '../data/psionic';
import { isLegendAug, majorsOf, schoolAugId, schoolOf, type SchoolId } from '../data/schools';
import type { AugDef } from './effects';
import { DEFAULT_RELIC, RELIC_BY_ID, RELICS } from '../data/relics';
import { Rng } from '../rng';
import { FAITHS,
  type AugPick, type Encounter, type InvestOffer, type FaithId, type EnemySpawn, type Major, MAJORS, MAJOR_NAME, type NodeType, type Pending,
  type Quest, type RunState, type ShopSlot, type SupplyCard, type SynergyId, type UnitState,
} from '../types';
import { allyRoom, companionCells, deployed, encGeo, engTier, geoOf, mapOptOf, terrainPathOk, foeCell, layout, PAD, runGeo, terrainCells, toPos, memberships, playerRows, prepOccupied, synergyCounts, turretCells, turretCount, ZONE, zoneAt } from './build';
import { DEV, deviceCells, type Device, isPlaceable } from '../data/devices';
import { MERCHANT_BY_ID, merchantPool } from '../data/merchants';
import { type Bay, crateHomes, MAPS, mapOf, type MapDef, rectCells, terrainOf } from '../data/maps';
import { causalGain, causalLeft, causalStage, KING_GEAR, KING_GEAR_NAME } from '../data/chungra';
import { EMB } from '../data/emblems';
import type { Battle } from './combat';
import { newRec, recBattle, recReroll, recSpend } from './report';
import { campAfterBattle, campBoss, campDeploy, campElite, campEnter, campFoeCount, campNextChapter } from './campaign';

export const SAVE_VERSION = 6; // 6: 전술 유형 개편 (개별 증강 폐지)

export function rng<T>(run: RunState, f: (r: Rng) => T): T {
  const r = new Rng(run.rng);
  const out = f(r);
  run.rng = r.s;
  return out;
}
const zeroMajors = (): Record<Major, number> => ({ vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 });
const log = (run: RunState, s: string) => { run.log.unshift(s); if (run.log.length > 60) run.log.length = 60; };
/** 에란테스 훈련장 (engine/lab.ts 가 채운다): 훈련장 런의 조우 만들기 · 전투 정산 (보상 · 피해 · 기록 없이 다음 칸으로) */
export const LAB_HOOK: { enc?: (run: RunState) => Encounter; resolve?: (run: RunState, b: Battle) => BattleSummary } = {};
export const hasGlobal = (run: RunState, id: string) => run.globals.includes(id);
const GA = CFG.globalAug;
/** 전설 [판돈 올리기]: 전투 승리 크레딧 · 공명도 풀 배율 */
const stakesMul = (run: RunState) => (hasGlobal(run, 'G.l_stakes') ? GA.stakes : 1);
/** 승리 크레딧에 더하는 전역 증강 몫 (전리품 회수) — 미리보기 · 정산 공용 */
const globalWinAdd = (run: RunState) => (hasGlobal(run, 'G.salvage') ? GA.salvage : 0) - (hasGlobal(run, 'G.l_midas') ? GA.midasLean : 0) - (hasDespair(run, 'D.lean') ? CFG.despair.lean : 0);
/** 반려 돌 (절망 증강): 칸만 차지하는 짐. 늘 출전 · 공명도 · 장비 없음 */
export const isRock = (u: UnitState) => !!UNIT_BY_ID[u.defId]?.inert;
/** 절망 증강 [근시안적 투자안]: 이자 수입 감소 (내림) */
const despairInterest = (run: RunState, x: number) => (hasDespair(run, 'D.myopic') ? Math.floor(x * (1 - CFG.despair.interest)) : x);
/**
 * 이자: 다음 전투를 마치면 받는 이자 (resolveBattle 정산 · battleRewardPreview 지도 미리보기 · 상단 바 크레딧 표시 공용).
 * 지금 보유 크레딧 CFG.interestPer 당 1, 상한 cap (위험 등급 · 동결의 서약 · 사건으로 줄고, 페트라 · 전역 증강 · 라르스로 는다). 근시안적 투자안이면 줄어든다 (내림).
 * parts = 상한 내역 [이름, 더하는 값] (상단 바 툴팁), floor = 줄어드는 쪽 합이 기본 상한을 넘겨 0 에서 멈췄는지
 */
export function interestInfo(run: RunState, counts = synergyCounts(deployed(run), run)) {
  const pet = tierOf('PET', counts.PET || 0);
  const diffCut = diffHas(run.diff, 6) ? 1 : 0, vault = oathV(run, 'vault', 'cap');
  const base = CFG.interestMax + run.mods.interestCap - diffCut - vault;
  const petAdd = (pet >= 1 ? 3 : 0) + (pet >= 3 ? 3 : 0) + (pet >= 4 ? 4 : 0);
  const glob = hasGlobal(run, 'G.interest') ? 5 : 0;
  const lars = run.units.some((u) => u.defId === 'lars') ? 2 : 0; // 라르스: 이자 상한 +2
  const pemb = deployed(run).filter((u) => u.mod === 'M_PET').length * EMB.PET; // 페트라 문장: 출전 기물이 단 문장 1개당 (data/emblems.ts)
  const cap = Math.max(0, base) + petAdd + glob + lars + pemb;
  const raw = Math.min(cap, Math.floor(run.credits / CFG.interestPer));
  const parts: [string, number][] = ([
    ['기본', CFG.interestMax], ['사건 · 계약', run.mods.interestCap], [`위험 6 이상`, -diffCut], [OATH_BY_ID.vault.name, -vault],
    [`${SYN_BY_ID.PET.name} ${pet}단계`, petAdd], [GLOBAL_BY_ID['G.interest']?.name || '전역 증강', glob], [UNIT_BY_ID.lars?.name || '라르스', lars], [`${SYN_BY_ID.PET.name} 문장`, pemb],
  ] as [string, number][]).filter(([, v]) => v !== 0);
  const myopic = hasDespair(run, 'D.myopic');
  const direct = hasGlobal(run, 'G.l_petra'); // 전설 [페트라 직불 계약]: 이자 0
  return { interest: direct ? 0 : despairInterest(run, raw), raw, cap, per: CFG.interestPer, parts, floor: base < 0, myopic: myopic ? DESPAIR_BY_ID['D.myopic'].name : '', direct: direct ? GLOBAL_BY_ID['G.l_petra'].name : '' };
}
/** 이자를 지키며 쓸 수 있는 크레딧 (상점 머리): 지금 이자 단계(크레딧 per 당 1, 상한까지)를 유지하는 선에서 쓸 수 있는 몫 · 그때 지켜지는 이자.
 *  after(cost) = 그만큼 쓴 뒤의 이자 (구매 확인 팝업) */
export function interestKeep(run: RunState) {
  const i = interestInfo(run);
  const tiers = i.direct ? 0 : i.raw;
  return { spend: Math.max(0, run.credits - i.per * tiers), keep: i.interest, per: i.per, after: (cost: number) => interestInfo({ ...run, credits: run.credits - cost }).interest };
}
/** 절망 증강 [군체 공명 간섭]: 전투 공명도 풀 배율 */
const despairXp = (run: RunState) => (hasDespair(run, 'D.swarm') ? 1 - CFG.despair.xp : 1);
/** 절망 증강 [무역관세부 특별 관세]: 상점 · 정비 · 합성 가격, 함대 확장 · 지정 소집 비용 배율 */
const despairPrice = (run: RunState) => (hasDespair(run, 'D.tariff') ? 1 + CFG.despair.tariff : 1);

// ───────────────────────── 런 생성
export function newRun(seed: number, starters: string[], field?: string, diff = 0, oathSel?: OathSel): RunState { // oathSel: 절망 서약 설정 (고난 이상일 때만 옮긴다, data/oaths.ts)
  const oaths = oathsFor(diff, oathSel), hp = CFG.playerHp - (diffHas(diff, 7) ? 25 : 0) - oathV({ oaths }, 'hull', 'hp');
  const run: RunState = {
    version: SAVE_VERSION, seed, rng: seed, phase: 1, step: 0, map: phaseMap(1), picked: [], node: null,
    hp, maxHp: hp, credits: diffHas(diff, 3) ? 0 : CFG.startCredits, streak: 0, units: [], inventory: [],
    globals: [], pending: [], quests: [], questPhase: 0, loan: 0, faith: 0, power: 0, divCap: 0, fame: 0, blessing: null, staffTarget: null, aceTarget: null, privilege: null, despairs: [], ...(oaths ? { oaths, oathHeat: oathHeat(oaths) } : {}), field: field || 'waste', diff, cleared: false, endless: false,
    mods: { interestCap: 0, nodeIncome: 0 }, boons: [], phaseBoons: [], seenEvents: [], flags: [], usedIds: [], rankLog: {}, nextUid: 1, log: [],
    stats: { wins: 0, losses: 0, kills: 0, bestHit: 0 }, over: false,
  };
  run.rep = newRec(run); // 전투 종료 보고서 기록 (engine/report.ts)
  for (const id of starters) addUnit(run, id, 1);
  autoPlace(run);
  if (!field) run.field = rng(run, (r) => r.pick(FIELDS).id);
  // 전장 · 난이도는 출격 전 화면에서 이미 보여 줬다. 특권 증강이 시작 기물 합류 증강보다 먼저
  run.pending.unshift({ t: 'privilege', options: rollPrivileges(run).slice(0, oathV(run, 'strip', 'choices') || undefined), rerolls: oathLv(run, 'strip') ? oathV(run, 'strip', 'rerolls') : CFG.privilegeRerolls }); // 박탈의 서약
  if (despairDiff(diff)) queueDespair(run); // 고난: 특권 바로 다음 (해금 조건 없음)
  log(run, '용병단 ERRANTEs, 출격.');
  return run;
}

/** 페이즈 노드 구성 (12칸): 전투 > 전투 > 항로 회의(전역 증강) > 사건 > 역경 > 보급 > 전투(짝수 페이즈는 전환) > 전투 > 사건 > 역경 > 보급 > 보스.
 *  보급 = 상점 / 보급 / 모집 (+ 은하 대스타 속보 · 투자 · 순례) 중 선택. 2페이즈부터는 페이즈 시작 때 영입 기회가 열린다 */
export function phaseMap(phase: number): NodeType[][] {
  // [실험] CFG.supply.p1: 1페이즈만 맨 앞 보급 + 첫 역경 → 보급 (항로 보급, 분기점 보급과 달리 재료 1장 확정 · 대박 없음)
  if (phase === 1 && CFG.supply.p1) return [['supply'], ['battle'], ['battle'], ['council'], ['event'], ['supply'], ['shop'], ['battle'], ['battle'], ['event'], ['adversity'], ['shop'], ['boss']];
  const m: NodeType[][] = [['battle'], ['battle'], ['council'], ['event'], ['adversity'], ['shop'], [phase % 2 === 0 ? 'fork' : 'battle'], ['battle'], ['event'], ['adversity'], ['shop'], ['boss']];
  return phase >= 2 && CFG.supply.front ? [['supply'], ...m] : m; // [실험] CFG.supply.front: 2페이즈부터 맨 앞 보급
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
  recReroll(run);
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
    case 'P.relic': for (let i = 0; i < 2; i++) gainItem(run, rng(run, (r) => r.pick(ALL_ADVANCED)), undefined, true); break;
    case 'P.supply': for (let i = 0; i < 3; i++) gainItem(run, rng(run, (r) => r.pick(ALL_CONSUMABLES)), undefined, true); break;
    case 'P.trust': run.mods.interestCap += 3; run.credits += 15; break;
    case 'P.scout': next.push({ t: 'recruit', options: recruitOptions(run, 5) }); break;
    case 'P.gamble': run.credits += 90; run.maxHp = Math.max(1, run.maxHp - 25); run.hp = Math.min(run.hp, run.maxHp); break;
    case 'P.rare': next.push({ t: 'global', options: rollGlobals(run, 'R') }); break;
    case 'P.legend': gainItem(run, eventApi(run).randomItem('L'), undefined, true); break;
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
  recReroll(run);
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
  if (p?.t === 'despair' && !p.phase && run.despairs.length < 1 + oathV(run, 'abyss', 'start')) queueDespair(run); // 심연의 서약: 출격 때 하나 더 (고른 뒤에 뽑아 겹치지 않게)
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
export const deployCap = (run: RunState) => run.lab?.cap ? run.lab.cap : run.campaign ? campDeploy(run) : CFG.deployBase + fleetOf(run) + (hasGlobal(run, 'G.squad') ? 1 : 0) - (hasGlobal(run, 'G.l_ascend') ? 1 : 0); // 캠페인: 장마다 정한 인원

// ───────────────────────── 함선 관리: 함대 확장 · 지정 소집
/** 다음 함대 확장 비용 (최대면 null) */
export const fleetCost = (run: RunState): number | null => { const c = CFG.fleetCosts[fleetOf(run)]; return c === undefined ? null : Math.round(c * despairPrice(run)); };
export function buyFleet(run: RunState): string | null {
  const c = fleetCost(run);
  if (c === null) return '함대가 이미 최대 규모입니다';
  if (run.credits < c) return `크레딧이 부족합니다 (${c} 필요)`;
  run.credits -= c;
  recSpend(run, 'fleet', c);
  run.fleet = fleetOf(run) + 1;
  const enc = run.node?.enc, nw = mapOf(enc?.map).narrow; // 통로 조우를 앞둔 편성 중이면 늘어난 인원만큼 통로 폭도 넓힌다 (적 칸 · 장치 칸은 그대로)
  if (enc && nw) enc.n = Math.max(enc.n, narrowWidth(run, nw, mapOf(enc.map).allyRows));
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
/** 지정 소집 티켓 (유이 전용 상품): 들고 있으면 지정 소집을 크레딧 대신 티켓 1장으로 한다 */
export const TICKET = 'K_muster_ticket';
export const ticketCount = (run: RunState) => run.inventory.filter((x) => x === TICKET).length;
/** 상점 칸 (상인 상점 · 정비 · 합성 공방)이 열려 있는 동안의 지정 소집은 티켓으로만 (크레딧 소집 · 함대 확장은 칸을 끝낸 뒤). 상인 · 진열은 그대로 남는다 */
export const SHOP_TICKET_ONLY = '상점에서는 지정 소집 티켓으로만 소집할 수 있습니다';
/** 지정 소집을 지금 열 수 없는 까닭 (null = 열 수 있음): 진행 중인 선택 · 칸 (상점 칸은 티켓이 있으면 허용) · 보유 한도 · 크레딧 */
export function musterBlock(run: RunState): string | null {
  if (run.pending.length) return '진행 중인 선택을 먼저 끝내세요';
  if (run.node && !(run.node.type === 'shop' && ticketCount(run))) return run.node.type === 'shop' ? SHOP_TICKET_ONLY : '진행 중인 일을 먼저 끝내세요';
  if (run.units.length >= CFG.maxParty) return `보유 한도(${CFG.maxParty}명)에 도달했습니다`;
  if (!ticketCount(run) && run.credits < musterCost(run)) return `크레딧이 부족합니다 (${musterCost(run)} 필요)`;
  return null;
}
export function openMuster(run: RunState): string | null {
  const err = musterBlock(run);
  if (err) return err;
  run.pending.unshift({ t: 'muster' });
  return null;
}
export function confirmMuster(run: RunState, syns: string[]): string | null {
  if (run.pending[0]?.t !== 'muster') return null;
  if (syns.length !== CFG.musterPicks || new Set(syns).size !== syns.length || syns.some((x) => !musterSyns().includes(x))) return `시너지를 ${CFG.musterPicks}개 고르세요`;
  const pool = musterPool(run, syns);
  if (!pool.length) return '조건에 맞는 기물이 없습니다';
  const c = musterCost(run), ticket = ticketCount(run) > 0;
  if (!ticket && run.node) return SHOP_TICKET_ONLY; // 상점 칸에서 연 소집 창: 그사이 티켓이 없어졌으면 막는다
  if (!ticket && run.credits < c) return `크레딧이 부족합니다 (${c} 필요)`;
  if (ticket) run.inventory.splice(run.inventory.indexOf(TICKET), 1); // 티켓이 있으면 크레딧 대신 (소집 횟수는 그대로 센다)
  else { run.credits -= c; recSpend(run, 'muster', c); }
  run.musters = (run.musters || 0) + 1;
  run.pending.shift();
  const k = 4 + (hasGlobal(run, 'G.scout') ? 1 : 0) + (hasGlobal(run, 'G.network') ? 1 : 0); // 지정 소집: 선택지 +1, 리롤 없음
  run.pending.unshift({ t: 'recruit', options: recruitOptions(run, k, pool), syns, rerolls: 0 });
  log(run, `지정 소집 (${ticket ? CONSUMABLES[TICKET].name : `크레딧 -${c}`}): ${syns.map((s) => SYN_BY_ID[s as SynergyId]?.name || s).join(' · ')}`);
  return null;
}
export function cancelMuster(run: RunState) { if (run.pending[0]?.t === 'muster') run.pending.shift(); }

/** 이번 편성에서 출전 인원 한도: 출전 한도와 아군 진형에서 설 수 있는 칸 수 (장치 칸 제외) 중 작은 쪽 */
export const deployRoom = (run: RunState) => Math.min(deployCap(run), allyRoom(run));
/** 출전 기물을 하나 더 올릴 수 없는 까닭 (null = 올릴 수 있음): 출전 인원이 찼거나, 아군 진형에 설 자리가 없다 */
export function deployBlock(run: RunState): string | null {
  const n = deployed(run).length;
  if (n >= deployCap(run)) return `출전 인원이 가득 찼습니다 (${deployCap(run)}명)`;
  if (n >= allyRoom(run)) return ROOM_ERR;
  return null;
}
export const ROOM_ERR = '출전 기물이 설 자리가 모자랍니다';
/** 배치 폭 W 의 열 순서: 가운데부터 (W/2 내림 열 → 왼쪽 · 오른쪽 번갈아). 폭 7 = 3 · 2 · 4 · 1 · 5 · 0 · 6 */
export const centerCols = (W: number) => [...Array(W).keys()].sort((a, b) => Math.abs(a - Math.floor(W / 2)) - Math.abs(b - Math.floor(W / 2)) || a - b);

/** 빈 출전 자리에 order 순으로 기물을 올린다 (근접 · 앞줄 선호는 앞줄부터, 그 밖은 뒷줄부터). 지금 조우의 배치 폭 안에서 가운데 열부터,
 *  장치 칸 · 다른 기물 칸은 건너뛰고 소환물 · 포탑 칸은 마지막에 쓴다 → 저장 칸 = 편성 화면에 보이는 칸 */
export function autoPlace(run: RunState, order: UnitState[] = run.units) {
  const limit = deployRoom(run);
  // 반려 돌 (절망 증강): 늘 출전. 자리가 없으면 공명 등급이 가장 낮은 출전 기물을 대기석으로
  const rock = run.units.find((u) => isRock(u) && !u.pos);
  if (rock) {
    if (deployed(run).length >= limit) { const low = deployed(run).filter((u) => !isRock(u)).sort((a, b) => a.rank - b.rank)[0]; if (low) low.pos = null; }
    order = [rock, ...order.filter((u) => u !== rock)];
  }
  if (!order.some((u) => !u.pos && canDeploy(run, u)) || deployed(run).length >= limit) return;
  const W = run.node?.enc?.n ?? CFG.bossBoard, g = runGeo(run, W);
  const used = new Set([...layout(run, W).values()].map((p) => `${p.x},${p.y}`));
  for (const d of run.node?.enc?.devices || []) for (const c of deviceCells(d)) used.add(`${c.x},${c.y}`); // 편성 화면에 놓은 장치 칸
  const soft = new Set([...turretCells(run, W), ...companionCells(run, W)].map((p) => `${p.x},${p.y}`)); // 포탑 · 소환물 시작 칸 (비켜 주지만 기물이 먼저)
  const cols = centerCols(W);
  for (const u of order) {
    if (u.pos || deployed(run).length >= limit || !canDeploy(run, u)) continue;
    const def = UNIT_BY_ID[u.defId];
    const rowsUp = [...Array(g.rows).keys()], rowsPref = def.range <= 1 || def.front ? rowsUp.slice().reverse() : rowsUp; // 근접 · 앞줄 선호는 앞줄부터
    outer: for (const avoid of [true, false])
      for (const r of rowsPref)
        for (const c of cols) {
          const k = `${PAD + c},${g.ay1 - r}`;
          if (used.has(k) || (avoid && soft.has(k))) continue;
          u.pos = { c, r }; used.add(k); break outer;
        }
  }
}

/** 안전장치 (전투 노드에 들어설 때 · 전투 시작 직전): 출전 기물이 아군 진형에서 설 수 있는 칸보다 많으면
 *  공명 등급이 낮은 기물부터 대기석으로 내린다 (반려 돌은 남긴다). 편성 표시 · 시너지 집계 · 전투가 어긋나지 않게. 내린 기물 이름 */
export function fitDeploy(run: RunState): string[] {
  const dep = deployed(run), over = dep.length - allyRoom(run);
  if (over <= 0) return [];
  const out = dep.filter((u) => !isRock(u)).sort((a, b) => a.rank - b.rank || a.xp - b.xp).slice(0, over);
  for (const u of out) u.pos = null;
  const names = out.map((u) => UNIT_BY_ID[u.defId].name);
  log(run, `출전 칸 부족: ${names.join(' · ')} 대기석으로`);
  return names;
}
/** 대기석으로 옮긴 까닭 알림: 지형 틀 · 아군 진형 크기 · 장치가 차지한 칸 · 설 수 있는 칸 · 출전 인원 → 옮긴 기물 */
export function roomNotice(run: RunState, names: string[]): Pending {
  const enc = run.node?.enc, g = runGeo(run), room = allyRoom(run), taken = g.n * g.rows - room;
  const rows: [string, string][] = [
    ['전장', `${enc?.map ? mapOf(enc.map).name : '개활지'} · 아군 진형 ${g.n}×${g.rows} = ${g.n * g.rows}칸`],
    ...(taken ? [['장치가 차지', `${taken}칸`] as [string, string]] : []),
    ['설 수 있는 칸', `${room}칸`],
    ['출전', `${room + names.length}명 → ${room}명`],
    ['대기석으로', `${names.join(' · ')} (공명 등급 낮은 순)`],
  ];
  return { t: 'notice', title: '출전 칸 부족', body: '이번 전장은 아군 진형이 출전 인원보다 작습니다.', rows };
}
/** 전투 노드에 들어설 때: fitDeploy 로 내린 기물이 있으면 까닭과 함께 알림 */
function fitDeployNotice(run: RunState) {
  const names = fitDeploy(run);
  if (names.length) run.pending.push(roomNotice(run, names));
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
  const { interest } = interestInfo(run, counts);
  let c = CFG.winCredits(p);
  if (type === 'adversity') c = Math.round(c * CFG.adversityReward);
  c = Math.round(c * CFG.diffWinMul(run.diff || 0) * oathWinMul(run) * contractWinMul(run)); // 박봉의 서약
  if (type === 'boss') c += 5;
  c = Math.max(0, Math.round(c * stakesMul(run)) + globalWinAdd(run));
  const win = interest + c + CFG.streakBonus(Math.max(1, run.streak + 1)) + (pet >= 1 ? (pet >= 4 ? 3 : 1) : 0) + (fieldOf(run.field).winCredits || 0);
  const loss = interest + CFG.lossCredits + (pet >= 2 ? 6 : 0);
  const pool = (won: boolean) => Math.round(CFG.xpPool(p) * (won ? 1 : 0.5) * (type === 'adversity' ? CFG.adversityReward : 1) * (hasGlobal(run, 'G.resonance') ? 1.35 : 1) * despairXp(run) * stakesMul(run));
  return { credits: { win, loss, interest }, xp: { win: pool(true), loss: pool(false) } };
}

export function enterNode(run: RunState, type: NodeType) {
  run.picked[run.step] = type;
  const campEv = run.campaign ? campEnter(run, type).event : undefined; // 캠페인: AH 차감 · 장별 고정 사건
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
    const id = campEv || pickEvent(run);
    run.seenEvents.push(id);
    run.pending.push({ t: 'event', id, sub: pickSub(run, id) });
    advance(run);
    return;
  }
  if (type === 'battle' || type === 'adversity' || type === 'boss') {
    if (hasGlobal(run, 'G.l_petra')) { const n = synergyCounts(deployed(run), run).PET || 0; if (n) { run.credits += n * GA.petraPer; log(run, `페트라 직불 계약: 크레딧 +${n * GA.petraPer}`); } }
    run.node = { type, enc: run.lab && LAB_HOOK.enc ? LAB_HOOK.enc(run) : genEncounter(run, type) };
    fitDeployNotice(run);
    syncQuests(run);
  } else if (type === 'shop') {
    run.pending.push({ t: 'branch', options: branchOptions(run) });
  } else if (type === 'supply') {
    const route = run.map[run.step]?.[0] === 'supply'; // 항로에 놓인 보급 노드 (분기점 보급 아님)
    run.pending.push({ t: 'supply', options: genSupply(run, route), ...(route ? { route } : {}) });
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
    const k = Math.max(1, 3 + (hasGlobal(run, 'G.scout') ? 1 : 0) + (hasGlobal(run, 'G.network') ? 1 : 0) - oathV(run, 'recruit', 'less')); // 고립의 서약
    run.pending.push({ t: 'recruit', options: recruitOptions(run, k) });
  }
}
/** 영입 후보 새로고침 (영입마다 1회) */
export function rerollRecruit(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'recruit' || (p.rerolls ?? 1) <= 0) return;
  p.rerolls = (p.rerolls ?? 1) - 1;
  recReroll(run);
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
  fitDeployNotice(run);
  syncQuests(run);
  log(run, '전환: 도전');
}

/** 도전 승리 보상: 건너뛰는 전투 · 사건 · 역경 · 보급 · 보스를 합친 정도 (전환 뒤 칸: phaseMap) */
function challengeReward(run: RunState, lines: string[]) {
  const p = run.phase;
  const c = Math.round(CFG.winCredits(p) * CFG.adversityReward + CFG.winCredits(p) * 2 + 5 + 12 + p);
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
  const got: string[] = [];
  for (let k = had + 1; k <= Math.min(3, t); k++) {
    const id = HEL_ITEM_IDS[k - 1];
    const g = gainItem(run, t >= 4 ? 'L_' + id.slice(2) : id, undefined, true);
    if (g) got.push(`[${itemInfo(g).name.replace(/^\[전설\] /, '전설 ')}]`);
  }
  if (t >= 4 && had < 4) {
    const up = (x: string | null) => (x && isHelItem(x) && x[0] === 'A' ? 'L_' + x.slice(2) : x);
    run.inventory = run.inventory.map((x) => up(x)!);
    for (const u of run.units) u.items = u.items.map(up);
  }
  run.helTier = t;
  // 알림: 지급한 장비 이름을 그대로 적는다 (4단계: 전설 승격도 함께)
  const lines = [got.length ? `헬레니우스 동맹: ${got.join(' · ')} 지급 (보관함).` : '', t >= 4 && had < 4 ? '동맹 대함대 집결: 보유한 동맹 전용 장비가 전설 등급으로 승격됩니다 (효과 2배).' : ''].filter(Boolean);
  run.pending.push({ t: 'notice', title: '헬레니우스 동맹', body: lines.join(' ') });
}

/** 셰프: 시너지가 처음 켜지면 갓 구운 빵 1개 (런당 1번) */
function checkChef(run: RunState) {
  if (run.chefBread || run.tutorial || !tierNow(run, 'CHEF')) return;
  run.chefBread = true;
  gainItem(run, 'K_bread', undefined, true);
  run.pending.push({ t: 'notice', title: '갓 구운 빵', body: `셰프들이 처음 손을 맞춰 빵을 구워 냈습니다. 보관함의 [${CONSUMABLES.K_bread.name}]을 쓰면 플레이어 체력을 ${breadHeal(run.diff)} 회복합니다. 셰프 시너지가 켜진 채로 전투에서 이기면 가끔 더 구워 옵니다.` });
}

/** 엔지니어: 2 · 4 · 6 · 8명에 처음 닿을 때마다 그 단계 전용 포탑 개조부품 1개를 무작위로 (아직 가진 적 없는 것 중). 빈 포탑 개조부품 칸이 있으면 바로 장착 */
function checkEng(run: RunState) {
  if (run.tutorial) return; // 튜토리얼 런은 고정 진행 (안내 창이 끼지 않게)
  const t = engTier(run), had = run.engTier || 0;
  if (t <= had) return;
  const got: string[] = [];
  for (let k = had + 1; k <= t; k++) {
    const owned = new Set([...run.inventory, ...(run.turretMods || [])].filter((x): x is string => !!x && isTurretMod(x)));
    let pool = turretModsOfTier(k).filter((id) => !owned.has(id));
    for (let j = k - 1; !pool.length && j >= 1; j--) pool = turretModsOfTier(j).filter((id) => !owned.has(id)); // 그 단계를 다 가졌으면 아래 단계에서
    if (!pool.length) continue;
    const id = rng(run, (r) => r.pick(pool));
    const n = turretCount(run), mods = (run.turretMods ||= []);
    const slot = [...Array(n).keys()].find((i) => !mods[i]);
    if (slot !== undefined) { while (mods.length <= slot) mods.push(null); mods[slot] = id; }
    else gainItem(run, id, undefined, true, true);
    got.push(`${TURRET_MODS[id].name}${slot !== undefined ? ` (포탑 ${slot + 1}에 장착)` : ' (보관함)'}`);
    log(run, `엔지니어 ${SYN_BY_ID.ENG.tiers[k - 1]}명: 포탑 개조부품 ${TURRET_MODS[id].name} 획득`);
  }
  run.engTier = t;
  if (got.length) run.pending.push({ t: 'notice', title: `엔지니어 ${SYN_BY_ID.ENG.tiers[t - 1]}명 — 포탑 개조부품 ${got.length}개`, body: `엔지니어들이 감시 포탑 전용 개조부품을 만들어 냈습니다: ${got.join(' · ')}. 편성 화면에서 포탑의 개조부품 칸으로 옮길 수 있습니다.` });
}

/** 헬레니우스 · 신비학자 전용 장비를 지금 단계에 맞춘다: 단계가 내려가면 그 단계 장비를 회수 (run.synVault), 다시 닿으면 돌려준다.
 *  헬레니우스 장비 k 는 k단계 이상에서, 전설판은 4단계에서만. 신비학자 개조부품은 그 부품의 단계 이상에서. 돌려받은 장비는 달고 있던 기물의 빈 칸 → 보관함 */
export function syncSynGear(run: RunState): { out: string[]; back: string[] } {
  if (run.lab) return { out: [], back: [] }; // 훈련장: 시너지 단계와 상관없이 전용 장비를 그대로 둔다
  const hel = tierNow(run, 'HEL'), occ = occultTier(run), nav = tierNow(run, 'NAV');
  const helK = (x: string) => HEL_ITEM_IDS.findIndex((h) => h.slice(2) === x.slice(2)) + 1;
  const allowed = (x: string) => (isHelItem(x) ? helK(x) <= Math.min(3, hel) : OCCULT_MODS[x] ? OCCULT_MODS[x].tier <= occ : x === 'K_scope' ? nav > 0 : true); // 표시 망원경: 항해자가 꺼지면 회수
  const grade = (x: string) => (isHelItem(x) ? (hel >= 4 ? 'L_' : 'A_') + x.slice(2) : x); // 4단계 = 전설판, 그 아래 = 희귀판
  const vault = (run.synVault ||= []), out: string[] = [], back: string[] = [];
  run.inventory = run.inventory.filter((x) => { if (x && !allowed(x)) { vault.push({ id: x }); out.push(x); return false; } return true; });
  for (const u of run.units) {
    u.items = u.items.map((x, slot) => { if (x && !allowed(x)) { vault.push({ id: x, uid: u.uid, slot }); out.push(x); return null; } return x; });
    if (u.mod && !allowed(u.mod)) { vault.push({ id: u.mod, uid: u.uid, slot: -1 }); out.push(u.mod); u.mod = null; }
  }
  for (const v of [...vault]) {
    if (!allowed(v.id)) continue;
    vault.splice(vault.indexOf(v), 1);
    const id = grade(v.id), u = v.uid ? run.units.find((w) => w.uid === v.uid) : undefined;
    if (u && v.slot === -1 && !u.mod) u.mod = id;
    else if (u && v.slot !== undefined && v.slot >= 0 && v.slot < u.items.length && !u.items[v.slot]) u.items[v.slot] = id;
    else run.inventory.push(id); // 보관함이 가득 차도 돌려준다
    back.push(id);
  }
  // 헬레니우스 단계가 4를 오르내리면 가진 동맹 장비의 등급도 맞춘다
  const fix = (x: string | null) => (x && isHelItem(x) ? grade(x) : x);
  run.inventory = run.inventory.map((x) => fix(x)!);
  for (const u of run.units) u.items = u.items.map(fix);
  if (!vault.length) delete run.synVault;
  if (out.length) log(run, `시너지 단계 하락: 전용 장비 ${out.length}개 회수`);
  if (back.length) log(run, `시너지 단계 회복: 전용 장비 ${back.length}개 반환`);
  return { out, back };
}
/** 항해자: 처음 켜지면 표시 망원경 (사용 횟수 DEV.scope.base), 4 · 6 · 8명에 처음 닿을 때마다 횟수 추가 */
function checkNav(run: RunState) {
  if (run.tutorial) return;
  const t = tierNow(run, 'NAV');
  if (!t) return;
  const first = !run.scope, had = run.scope?.nav || 0;
  if (t <= had) return;
  const sc = (run.scope ||= { n: DEV.scope.base, nav: 0 });
  let add = 0;
  for (let k = Math.max(2, had + 1); k <= t; k++) add += DEV.scope.tierBonus[k - 1] || 0;
  sc.n += add; sc.nav = t;
  if (first) gainItem(run, 'K_scope', undefined, true, true);
  const nm = CONSUMABLES.K_scope.name;
  run.pending.push({ t: 'notice', title: `항해자 — ${nm}`, body: first ? `항해자들이 [${nm}]을 챙겼습니다.` : `항해자 ${SYN_BY_ID.NAV.tiers[t - 1]}명이 모였습니다.`, rows: first ? [['사용 횟수', `${sc.n}회`]] : [['사용 횟수', `+${add} → ${sc.n}회`]] });
}

export function checkOccult(run: RunState): boolean {
  checkHel(run);
  checkNav(run);
  checkChef(run);
  checkEng(run);
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
  const n = OCCULT_SYNTH.base + t, mul = (1 - (OCCULT_SYNTH.disc[t - 1] || 0)) * despairPrice(run);
  return rng(run, (r) => {
    const ids = r.sample(ALL_CONSUMABLES, Math.min(n, ALL_CONSUMABLES.length)); // 서로 다른 종류 먼저, 남는 칸은 무작위
    while (ids.length < n) ids.push(r.pick(ALL_CONSUMABLES));
    return ids.map((id) => ({ item: id, price: Math.round(CONSUMABLES[id].price * mul), sold: false }));
  });
}
/** 소모품 사용 대상: 기물 · 보관함 장비 · 장착 장비 · 이번 전투의 적 (편성 화면, enc.enemies 순번) · 함대 (바로 사용) */
export type UseTarget = { k: 'unit'; uid: string } | { k: 'inv'; i: number } | { k: 'eq'; uid: string; slot: number } | { k: 'foe'; i: number } | { k: 'run' } | { k: 'cell'; x: number; y: number; dir?: 'h' | 'v'; n?: number };
/** 적 1명이 단 장비 · 개조부품: 적 정의 + 이번 조우의 위험 등급 장비 (강제 징수기로 떼어 낸 적은 정의 장비도 없음). 편성 보드 · 적 상세 · 징수기 공용 */
export function foeGearOf(s: EnemySpawn): string[] {
  const d = ENEMY_BY_ID[s.defId];
  return [...(s.stripped || !d ? [] : [...(d.items || []), d.mod]), ...(s.items || []), s.mod].filter((x): x is string => !!x);
}
/** 소모품을 쓸 수 없는 종류의 대상 (장비용을 기물에 · 기물용을 장비 · 개조부품 · 소모품에 등). 편성 화면은 이 문구를 그대로 알림으로 띄우고 선택을 푼다 */
export const WRONG_TARGET = '부적절한 대상입니다';
/** 재구성 회로가 바꿀 수 있는 장비 → 같은 등급 후보 (일반 재료 · 고급 · 희귀 · 전설만. 고유 · 개조부품 · 포탑 · 잡동사니 · 동맹 장비 등은 null) */
function rerollPool(x: string | null | undefined): string[] | null {
  if (!x) return null;
  const legends = ALL_ADVANCED.map((a) => 'L_' + a.slice(2));
  const pool = ALL_COMPONENTS.includes(x) ? ALL_COMPONENTS : ALL_GRADED.includes(x) ? ALL_GRADED : ALL_ADVANCED.includes(x) ? ALL_ADVANCED : legends.includes(x) ? legends : null;
  return pool;
}
export const canReroll = (x: string | null | undefined) => !!rerollPool(x);
/** 재구성 회로: 같은 등급의 다른 무작위 장비 */
const rerollOne = (run: RunState, x: string) => { const opts = rerollPool(x)!.filter((y) => y !== x); return opts.length ? rng(run, (r) => r.pick(opts)) : x; };
/** 배치형 소모품을 이 대상에 놓을 수 있는지 → 놓일 장치 (편성 화면, 전투 조우 중에만).
 *  바리케이드 · 지뢰: 적 진형 밖의 빈칸 · 신호기: 아무 빈칸 (적 진형 포함) · 그물: 2×2 (적 · 칸이 왼쪽 위) · 망원경: 적 = 지정 포격, 아군 · 빈칸 = 항공 보급 */
export function placeDevice(run: RunState, id: string, tg: UseTarget): { dev?: Device; err: string | null } {
  const enc = run.node?.enc;
  if (!enc) return { err: '전투를 앞둔 편성 화면에서 사용하세요' };
  if (id === 'K_scope' && !(run.scope && run.scope.n > 0)) return { err: '남은 사용 횟수가 없습니다' };
  const n = enc.n, g = encGeo(enc);
  // 대상 → 칸
  let x: number, y: number;
  if (tg.k === 'cell') ({ x, y } = tg);
  else if (tg.k === 'foe') { const s = enc.enemies[tg.i]; if (!s) return { err: WRONG_TARGET }; ({ x, y } = foeCell(s, g)); }
  else if (tg.k === 'unit' || tg.k === 'eq') { const p = layout(run, n).get(tg.uid); if (!p) return { err: '출전한 기물에게만 쓸 수 있습니다' }; ({ x, y } = p); }
  else return { err: WRONG_TARGET };
  if (zoneAt(g, x, y) === 'edge') return { err: '전장 안쪽 칸에 놓으세요' };
  const foeAt = enc.enemies.some((s) => { const c = foeCell(s, g); return c.x === x && c.y === y; });
  if (id === 'K_scope') return { dev: { id, x, y, mode: foeAt ? 'strike' : 'drop' }, err: null };
  if (id === 'K_net') { // 2×2 가 전장 안에 들어오게 (오른쪽 · 아래 끝이면 한 칸 당긴다)
    return { dev: { id, x: Math.max(PAD, Math.min(x, g.w - PAD - 2)), y: Math.max(PAD, Math.min(y, g.h - PAD - 2)) }, err: null };
  }
  const d: Device = { id, x, y, ...(id === 'K_barricade' ? { dir: tg.k === 'cell' && tg.dir ? tg.dir : 'h', n: tg.k === 'cell' && tg.n ? Math.max(1, Math.min(DEV.wall.maxN, tg.n)) : 1 } : {}) };
  const err = deviceErr(run, d);
  return err ? { err } : { dev: d, err: null };
}
/** 장치가 차지할 칸이 맞는지 (null = 가능). skip = 옮기는 · 늘리는 중인 그 장치 (자기 칸은 비어 있는 것으로) */
export function deviceErr(run: RunState, d: Device, skip?: Device): string | null {
  const enc = run.node?.enc;
  if (!enc) return '전투를 앞둔 편성 화면에서 사용하세요';
  const g = encGeo(enc), occ = prepOccupied(run, enc, skip), land = terrainCells(g);
  if (d.id === 'K_barricade' && ((d.n || 1) < 1 || (d.n || 1) > DEV.wall.maxN)) return `바리케이드는 ${DEV.wall.maxN}칸까지 펼칠 수 있습니다`;
  for (const c of deviceCells(d)) {
    const z = zoneAt(g, c.x, c.y);
    if (z === 'edge') return '전장 밖으로 펼칠 수 없습니다';
    if ((land.get(`${c.x},${c.y}`)?.bits ?? 0) & 1) return '지형 칸에는 놓을 수 없습니다';
    if (z === 'foe' && d.id !== 'K_decoy') return '적 진형에는 놓을 수 없습니다';
    if (d.id === 'K_feast' && z !== 'ally') return '아군 진형에만 놓을 수 있습니다';
    if (occ.has(`${c.x},${c.y}`)) return '다른 기물 · 장치가 있는 칸입니다';
  }
  const devs = [...(enc.devices || []).filter((x) => x !== skip), d];
  if (allyRoom(run, enc.n, devs) < deployed(run).length) return ROOM_ERR; // 출전 기물이 설 칸은 남긴다
  return null;
}
/** 놓은 장치를 옮기거나 (바리케이드) 늘리기 · 줄이기: 새 모양이 맞으면 바꾼다. 오류 문구 또는 null */
export function setDevice(run: RunState, idx: number, d: Device): string | null {
  const ds = run.node?.enc?.devices, old = ds?.[idx];
  if (!old || old.id !== d.id) return WRONG_TARGET;
  const err = deviceErr(run, d, old);
  if (err) return err;
  ds![idx] = d;
  return null;
}
// ───────── 전투 전 지형 선택 (편성 화면에서만, 전투 중 조작 없음): 연결교 접기 (도킹 연결부) · 크레인 (컨테이너 환적장)
/** 칸 묶음 위에 서 있는 것: 장치 → '장치', 기물 · 적 → '기물' (없으면 null) */
function cellsTaken(run: RunState, enc: Encounter, cells: { x: number; y: number }[]): string | null {
  const key = (c: { x: number; y: number }) => `${c.x},${c.y}`, want = new Set(cells.map(key));
  if ((enc.devices || []).some((d) => deviceCells(d).some((c) => want.has(key(c))))) return '장치가 있는 칸';
  return [...prepOccupied(run, enc)].some((k) => want.has(k)) ? '기물이 있는 칸' : null;
}
/** 연결교 접기 · 펴기: 연결교 위에 장치가 있으면 접지 못한다. 오류 문구 또는 null */
export function bridgeFoldErr(run: RunState): string | null {
  const enc = run.node?.enc;
  if (!enc) return '전투를 앞둔 편성 화면에서만';
  const g = encGeo(enc), br = terrainOf(g).filter((c) => c.k === 'bridge');
  if (!br.length) return '연결교가 없는 지형';
  if (!enc.bridgeFold && cellsTaken(run, enc, br)) return '연결교 위에 장치가 있음';
  if (!enc.bridgeFold && !terrainPathOk(geoOf(enc.n, enc.map, { ...mapOptOf(enc), fold: true }))) return '길이 모두 막힘';
  return null;
}
export function setBridgeFold(run: RunState, fold: boolean): string | null {
  const enc = run.node?.enc;
  if (!enc || !!enc.bridgeFold === fold) return null;
  const err = fold ? bridgeFoldErr(run) : null;
  if (err) return err;
  if (fold) enc.bridgeFold = true; else delete enc.bridgeFold;
  return null;
}
/** 크레인: 이 컨테이너(번호)를 옮길 수 있는 적재칸 — 크기가 같은 적재칸만 (지금 있는 칸 제외). err = 못 옮기는 이유 (다른 컨테이너 · 장치 · 기물 · 길이 모두 막힘) */
export function craneSlots(run: RunState, crate: number): { bay: number; at: Bay; err: string | null }[] {
  const enc = run.node?.enc;
  if (!enc) return [];
  const m = mapOf(enc.map), g = encGeo(enc), bs = m.bays?.(g) || [];
  const home = crateHomes(m.terrain?.(g) || []).find((c) => c.i === crate);
  if (!home) return [];
  const now = terrainOf(g), key = (c: { x: number; y: number }) => `${c.x},${c.y}`;
  const others = new Set(now.filter((c) => c.crate !== crate).map(key)), mine = new Set(now.filter((c) => c.crate === crate).map(key));
  const out: { bay: number; at: Bay; err: string | null }[] = [];
  bs.forEach((b, bi) => {
    if (b.w !== home.w || b.h !== home.h) return;
    const cells = rectCells(b);
    if (cells.every((c) => mine.has(key(c)))) return; // 지금 있는 자리
    const err = cells.some((c) => others.has(key(c))) ? '다른 컨테이너'
      : cellsTaken(run, enc, cells) || (terrainPathOk(geoOf(enc.n, enc.map, { ...mapOptOf(enc), crane: { ...enc.crane, [crate]: bi } })) ? null : '길이 모두 막힘');
    out.push({ bay: bi, at: b, err });
  });
  return out;
}
/** 크레인으로 컨테이너를 적재칸으로 (bay = null 이면 원위치). 오류 문구 또는 null */
export function craneMove(run: RunState, crate: number, bay: number | null): string | null {
  const enc = run.node?.enc;
  if (!enc) return '전투를 앞둔 편성 화면에서만';
  if (bay !== null) {
    const s = craneSlots(run, crate).find((x) => x.bay === bay);
    if (!s) return '옮길 수 없는 자리';
    if (s.err) return s.err;
    enc.crane = { ...enc.crane, [crate]: bay };
    return null;
  }
  const err = craneHomeErr(run, crate);
  if (err) return err;
  const rest = { ...enc.crane };
  delete rest[crate];
  if (Object.keys(rest).length) enc.crane = rest; else delete enc.crane;
  return null;
}
/** 원위치로 돌릴 수 있는지: 원래 칸에 장치 · 기물이 없고 길이 남아야 (옮기지 않았으면 '이미 원위치') */
export function craneHomeErr(run: RunState, crate: number): string | null {
  const enc = run.node?.enc;
  if (!enc) return '전투를 앞둔 편성 화면에서만';
  if (enc.crane?.[crate] === undefined) return '이미 원위치';
  const g = encGeo(enc), home = crateHomes(mapOf(enc.map).terrain?.(g) || []).find((c) => c.i === crate);
  if (!home) return null;
  const rest = { ...enc.crane };
  delete rest[crate];
  return cellsTaken(run, enc, home.cells) || (terrainPathOk(geoOf(enc.n, enc.map, { ...mapOptOf(enc), crane: rest })) ? null : '길이 모두 막힘');
}
/** 놓은 장치 회수 (전투 전): 소모품은 보관함으로 (가득 차도), 망원경은 사용 횟수 +1 */
export function recallDevice(run: RunState, idx: number): string | null {
  const ds = run.node?.enc?.devices, d = ds?.[idx];
  if (!d) return null;
  ds!.splice(idx, 1);
  if (d.id === 'K_scope') { if (run.scope) run.scope.n++; }
  else run.inventory.push(d.id);
  return `${CONSUMABLES[d.id]?.name || d.id} 회수`;
}
/** 소모품 사용 대상이 맞는지 (null = 사용 가능). 종류가 맞지 않는 대상은 WRONG_TARGET */
export function useCheck(run: RunState, kIdx: number, tg: UseTarget): string | null {
  const id = run.inventory[kIdx];
  const c = id ? CONSUMABLES[id] : undefined;
  if (!c) return WRONG_TARGET;
  if (c.target === 'place') return placeDevice(run, id, tg).err;
  if (tg.k === 'cell') return WRONG_TARGET;
  if (c.target === 'run') {
    if (tg.k !== 'run') return WRONG_TARGET;
    if ((id === 'K_bread' || id === 'K_bread_stale') && run.hp >= run.maxHp) return '플레이어 체력이 가득 찼습니다';
    if (id === 'K_cp_tape') return '격리 화물 사건의 선택지에서 씁니다';
    if (id === TICKET) return '지도의 지정 소집에서 크레딧 대신 씁니다';
    if (id === 'K_cp_purge' && run.flags.includes('cp_purge')) return '이미 뿌려 두었습니다 (다음 전투에 적용)';
    return null;
  }
  if (id === 'K_strip' && tg.k === 'foe') { // 용제 밀수 (G.r_solvent): 분리 용제를 적에게 — 장비를 녹여 없앤다
    if (!hasGlobal(run, 'G.r_solvent')) return WRONG_TARGET;
    const s = run.node?.enc?.enemies[tg.i];
    if (!s) return '전투를 앞둔 편성 화면에서 적에게 사용하세요';
    return foeGearOf(s).length ? null : '장비를 달지 않은 적입니다';
  }
  if (c.target === 'foe') {
    if (tg.k !== 'foe') return WRONG_TARGET;
    const s = run.node?.enc?.enemies[tg.i];
    if (!s) return '전투를 앞둔 편성 화면에서 적에게 사용하세요';
    if (!foeGearOf(s).length) return '장비를 달지 않은 적입니다';
    return null;
  }
  if (tg.k === 'foe' || tg.k === 'run') return WRONG_TARGET;
  if (c.alsoItem && tg.k !== 'unit') { // 재구성 회로: 장비 1개 (장착한 장비면 보관함으로 해제)
    if (tg.k === 'inv' && tg.i === kIdx) return WRONG_TARGET;
    return canReroll(useItemId(run, tg)) ? null : WRONG_TARGET;
  }
  if (c.target === 'unit') {
    if (tg.k === 'inv') return WRONG_TARGET;
    const u = run.units.find((x) => x.uid === tg.uid);
    if (!u || isRock(u)) return WRONG_TARGET;
    if ((id === 'K_rank' || id === 'K_rank3') && u.rank >= CFG.maxRank) return '이미 최고 공명 등급입니다';
    if (id === 'K_morph' && !morphPool(run).length) return '바뀔 수 있는 기물이 없습니다';
    if (isInjector(id) && u.rank >= CFG.maxRank) return '이미 최고 공명 등급입니다';
    const gear = u.items.filter((x) => (id === 'K_reroll' ? canReroll(x) : x && !isLocked(x))).length;
    if ((id === 'K_strip' || id === 'K_reroll') && !gear) return id === 'K_strip' ? '해제할 장비가 없습니다' : '바꿀 수 있는 장비가 없습니다';
    if ((id === 'K_strip' || id === 'K_reroll') && run.inventory.length - 1 + gear > CFG.inventoryMax) return '보관함 공간이 부족합니다';
    return null;
  }
  if (tg.k === 'unit') return WRONG_TARGET;
  if (tg.k === 'inv' && tg.i === kIdx) return WRONG_TARGET;
  const it = useItemId(run, tg);
  if (!it || isLocked(it) || isConsumable(it)) return WRONG_TARGET;
  if (id === 'K_legend' && (it[0] === 'L' || isMod(it) || isTurretItem(it))) return WRONG_TARGET;
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
  if (isPlaceable(id)) { // 배치형: 이번 조우에 기록 (전투 시작 때 작동), 망원경은 사용 횟수만 줄고 남는다
    const d = placeDevice(run, id, tg).dev!;
    (run.node!.enc!.devices ||= []).push(d);
    if (id === 'K_scope') run.scope!.n--; else run.inventory.splice(kIdx, 1);
    msg = id === 'K_scope' ? `${d.mode === 'strike' ? '지정 포격' : '항공 보급'} · 남은 ${run.scope!.n}회` : `${name} ${id === 'K_net' ? '지정' : '설치'}${d.n && d.n > 1 ? ` · ${d.n}칸` : ''}`;
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  if (id === 'K_cp_purge' || id === 'K_cp_note') { // 캠페인에서 들여온 소모품 (본편 · 캠페인 공용): 정화 분무기 (다음 전투 화학 피해 -40%) · 선지급 어음 (지금 +15, 장 정산 -20)
    run.inventory.splice(kIdx, 1);
    if (id === 'K_cp_purge') { run.flags.push('cp_purge'); msg = '다음 전투 동안 아군이 받는 화학 피해 -40%'; }
    else { run.credits += 15; run.flags.push('cp_note'); msg = run.campaign ? '크레딧 +15 (장 정산 때 -20)' : '크레딧 +15 (이번 페이즈가 끝날 때 -20)'; }
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  if (id === 'K_bread' || id === 'K_bread_stale') { // 갓 구운 빵 · 식은 빵: 플레이어 체력 회복 (위험 등급별, 식은 빵은 덜)
    const h = Math.min(run.maxHp - run.hp, breadHeal(run.diff, id === 'K_bread_stale'));
    run.hp += h;
    dropBread(run, kIdx);
    run.inventory.splice(kIdx, 1);
    msg = `플레이어 체력 +${h} (${run.hp}/${run.maxHp})`;
    log(run, `${name}: ${msg}`);
    return { ok: true, msg };
  }
  if (id === 'K_strip' && tg.k === 'foe') { // 용제 밀수: 적 장비를 모두 녹인다 (보관함으로 오지 않음)
    const s = run.node!.enc!.enemies[tg.i];
    const n = foeGearOf(s).length;
    delete s.items; delete s.mod;
    s.stripped = true;
    run.inventory.splice(kIdx, 1);
    msg = `${ENEMY_BY_ID[s.defId]?.name || '적'}의 장비 ${n}개를 녹였습니다`;
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
  if (id === 'K_reroll' && tg.k !== 'unit') { // 재구성 회로 → 장비 1개: 보관함 장비는 그 자리에서, 장착한 장비는 바꿔서 보관함으로
    const x = useItemId(run, tg)!, y = rerollOne(run, x);
    if (tg.k === 'inv') run.inventory[tg.i] = y;
    else if (tg.k === 'eq') { const u = run.units.find((v) => v.uid === tg.uid)!; u.items[tg.slot] = null; run.inventory.push(y); }
    run.inventory.splice(kIdx, 1);
    msg = `${itemInfo(x).name} → ${itemInfo(y).name}${tg.k === 'eq' ? ' (보관함으로 해제)' : ''}`;
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
    } else { // 재구성 회로 → 기물: 바꿀 수 있는 장비를 모두 바꾸고 보관함으로 해제
      const names: string[] = [];
      u.items = u.items.map((x) => {
        if (!x || !canReroll(x)) return x;
        const y = rerollOne(run, x);
        run.inventory.push(y);
        names.push(itemInfo(y).name);
        return null;
      });
      msg = `${nm} 장비 재구성 → 보관함: ${names.join(' · ')}`;
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
  if (id === 'K_copy') { run.inventory.push(it); msg = `${itemInfo(it).name} 복제`; mergeCatwheels(run); }
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
  if (run.campaign) return ['shop', 'supply']; // 캠페인: 고정 로스터 (모집 없음)
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
  if (type === 'shop') { openShop(run); return; }
  if (type === 'maint') { run.picked[run.step] = 'maint'; run.node = { type: 'shop', shop: genMaint(run), maint: true }; log(run, '분기점: 정비'); return; }
  run.fame -= tierNow(run, 'STAR'); // 분기점 진입 때 이미 받음
  enterNode(run, type);
}

export const hasDivine = (run: RunState) => run.units.some((u) => UNIT_BY_ID[u.defId].ttype === 'divine');
const tierNow = (run: RunState, id: 'STAR' | 'HOI' | 'OCCULT' | 'HEL' | 'ENG' | 'CHEF' | 'NAV') => tierOf(id, synergyCounts(deployed(run), run)[id] || 0);

export function advance(run: RunState) {
  run.node = null;
  run.step++;
  if (run.lab) { if (run.step >= run.map.length) { run.step = 0; run.picked = []; } return; } // 훈련장: 항로 끝이면 처음 칸으로 (페이즈는 훈련장 패널에서 정한다)
  if (run.tutorial && run.step >= run.map.length) return; // 튜토리얼: 항로 끝 (다음 페이즈 없음)
  if (run.mods.nodeIncome) run.credits += run.mods.nodeIncome; // 분할 정산 등
  if (run.campaign && run.step >= run.map.length) { campNextChapter(run); run.picked = []; run.nodeUnits = {}; autoPlace(run); return; } // 캠페인: 다음 장
  if (run.step >= run.map.length) {
    const notes = run.flags.filter((f) => f === 'cp_note').length; // 선지급 어음 (본편): 페이즈가 끝날 때 갚는다
    if (notes) { run.flags = run.flags.filter((f) => f !== 'cp_note'); run.credits = Math.max(0, run.credits - 20 * notes); log(run, `선지급 어음 정산: 크레딧 -${20 * notes}`); }
    run.phase++;
    if (run.scope) run.scope.n += DEV.scope.perPhase; // 표시 망원경: 페이즈마다 +1
    run.mods.divGain = 0; // 성인 기념일은 이번 페이즈만
    run.step = 0;
    run.map = phaseMap(run.phase);
    run.picked = [];
    run.nodeUnits = {};
    autoPlace(run);
    run.blessing = null;
    run.phaseBoons = [];
    log(run, `페이즈 ${run.phase} 진입. 적이 강해집니다.`);
    if (hasGlobal(run, 'G.r_patron')) { run.credits += GA.patron; log(run, `부유한 후원자: 크레딧 +${GA.patron}`); }
    if (hasGlobal(run, 'G.l_chaos')) { const opts = rollGlobals(run); if (opts[0]) { log(run, `혼돈의 주사위: ${GLOBAL_BY_ID[opts[0]].name}`); pickGlobal(run, opts[0]); } }
    if (despairAt(run.diff, run.phase, oathDespairEvery(run))) queueDespair(run, run.phase); // 고난: 절망 증강 1개 더 (영입보다 먼저, 심연의 서약이면 간격이 짧다)
    offerRecruit(run); // 페이즈 시작 영입
    if (run.fund) { run.credits += run.fund; log(run, `호이슌 투자 수익 +${run.fund}`); run.pending.push({ t: 'notice', title: '투자 수익 정산', body: `지난 페이즈에 맡긴 자금이 불어나 크레딧 +${run.fund}을 돌려받았습니다.` }); run.fund = 0; }
  }
  // 은하 대스타가 활성화되어 있으면 보스 직전에 속보 노드 추가
  // (분기점에서 이미 속보를 골랐으면 붙이지 않는다: picked 는 실제로 간 노드)
  if (run.map[run.step]?.includes('boss') && run.map[run.step - 1]?.[0] !== 'news' && run.picked[run.step - 1] !== 'news' && tierNow(run, 'STAR')) {
    run.map.splice(run.step, 0, ['news']);
  }
}

/** 전역 증강 선택지 3장: 장마다 전설 GLOBAL_ODDS.L · 희귀 GLOBAL_ODDS.R 확률로 그 등급 풀에서, 아니면 일반 풀에서 (겹치지 않게).
 *  minTier 'R' = 희귀 이상만 (특권 [고급 작전 재량]) */
export function rollGlobals(run: RunState, minTier?: 'R'): string[] {
  const ok = (g: (typeof GLOBALS)[number]) => !(g.unique && run.globals.includes(g.id));
  const byTier = (t: 'N' | 'R' | 'L') => GLOBALS.filter((g) => ok(g) && (g.tier || 'N') === t).map((g) => g.id);
  return rng(run, (r) => {
    const out: string[] = [];
    for (let i = 0; i < 3; i++) {
      const x = r.next();
      let t: 'N' | 'R' | 'L' = x < GLOBAL_ODDS.L ? 'L' : x < GLOBAL_ODDS.L + GLOBAL_ODDS.R ? 'R' : 'N';
      if (minTier && t === 'N') t = r.chance(0.15) ? 'L' : 'R';
      for (const tt of [t, 'R', 'N'] as const) { const pool = byTier(tt).filter((id) => !out.includes(id)); if (pool.length) { out.push(r.pick(pool)); break; } }
    }
    return out;
  });
}
export function rerollGlobal(run: RunState) {
  const p = run.pending[0];
  if (p?.t !== 'global' || !p.rerolls) return;
  p.rerolls--;
  recReroll(run);
  p.options = rollGlobals(run);
}
export function pickGlobal(run: RunState, id: string) {
  run.globals.push(id);
  GLOBAL_BY_ID[id].onPick?.(run, eventApi(run));
  if (id === 'G.l_minky') { // 캣휠(ZI존)을 단 밍키 (출전 평균 공명 등급 + GA.minkyRank)
    const dep = deployed(run).filter((u) => !isRock(u));
    const want = Math.min(CFG.maxRank, Math.round(dep.length ? dep.reduce((n, u) => n + u.rank, 0) / dep.length : 1) + GA.minkyRank);
    if (run.units.length < CFG.maxParty && !run.units.some((u) => u.defId === 'mingki')) {
      const u = addUnit(run, 'mingki', want);
      const slot = u.items.indexOf(null);
      if (slot >= 0) u.items[slot] = CATWHEEL_ZI; else gainItem(run, CATWHEEL_ZI, undefined, true);
      log(run, `ZI존 밍키 합류 (공명 등급 ${u.rank})`);
    } else gainItem(run, CATWHEEL_ZI, undefined, true);
  }
  if (id === 'G.l_ascend') { // 등급 +2 · 출전 인원 -1: 넘치는 출전 기물은 등급이 낮은 쪽부터 대기석으로
    for (const u of run.units) for (let i = 0; i < GA.ascend && u.rank < CFG.maxRank; i++) rankUp(run, u);
    const dep = deployed(run).sort((a, b) => a.rank - b.rank);
    while (dep.length > deployCap(run)) dep.shift()!.pos = null;
  }
  if (id === 'G.l_sacrifice' && run.units.length > 1) { // 가장 높은 등급 1명이 보상 없이 떠난다 (장비 · 개조부품은 보관함으로)
    const top = run.units.filter((u) => !isRock(u)).sort((a, b) => b.rank - a.rank)[0];
    if (top) {
      for (const it of [...top.items, top.mod]) if (it && !isLocked(it)) gainItem(run, it, undefined, true, true);
      run.units = run.units.filter((u) => u !== top);
      if (run.staffTarget === top.uid) run.staffTarget = null;
      if (run.aceTarget === top.uid) run.aceTarget = null;
      for (const u of run.units) for (let i = 0; i < GA.sacrifice && u.rank < CFG.maxRank; i++) rankUp(run, u);
      log(run, `희생 제의: ${UNIT_BY_ID[top.defId].name} 이(가) 떠났습니다`);
    }
  }
  if (id === 'G.l_double') { // 희귀 이상 2개를 무작위로 (자기 자신 · 이미 가진 고유 제외)
    for (let k = 0; k < 2; k++) {
      const pool = GLOBALS.filter((g) => g.tier && g.id !== 'G.l_double' && !(g.unique && run.globals.includes(g.id))).map((g) => g.id);
      if (!pool.length) break;
      const pick = rng(run, (r) => r.pick(pool));
      log(run, `이중 계약: ${GLOBAL_BY_ID[pick].name}`);
      pickGlobal(run, pick);
    }
  }
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
 * 위험 등급 장비 (확률은 CFG.foeGear): (2)부터 적이 칸마다 확률로 재료를 달고, 역경 · 보스전에서는 고급 장비도 단다 (희귀 · 전설처럼 추가 효과가 있는 장비는 없음).
 * (5)부터 개조부품(문장 제외)을 달 수 있고, 보스는 CFG.foeGear.bossLegend 확률로 전설 장비(재생 외골격 제외)를 단다.
 * 장비 칸 수 = 2페이즈마다 1칸 (최대 3). 칸마다 따로 굴리고, 장비는 왼쪽부터 채운다.
 */
function gearEnemies(run: RunState, r: Rng, enemies: EnemySpawn[], type: NodeType, phase: number) {
  if (!foeGearOn(run)) return;
  const slots = Math.min(3, 1 + Math.floor((phase - 1) / 2));
  const big = type === 'adversity' || type === 'boss';
  const legends = ALL_ADVANCED.filter((x) => x !== 'A_vit_vit').map((x) => 'L_' + x.slice(2));
  const mods = Object.keys(OCCULT_MODS).filter((k) => OCCULT_MODS[k].tier <= 3); // 4단계 (신비학자 8명 완성 보상) 부품은 적이 달지 않는다
  for (const s of enemies) {
    const tier = ENEMY_BY_ID[s.defId].tier;
    const items: string[] = [];
    if (type === 'adversity' && diffHas(run.diff, 7)) {
      const grades = [ALL_COMPONENTS, ALL_GRADED, ALL_ADVANCED];
      for (let i = 0; i < 3; i++) items.push(r.pick(r.pick(grades)));
    }
    const G = CFG.foeGear;
    if (!items.length && tier === 'boss' && diffHas(run.diff, 5) && r.chance(G.bossLegend)) items.push(r.pick(legends));
    const p = (big ? G.big : G.slot) * (tier === 'elite' ? G.elite : tier === 'boss' ? G.boss : 1); // 칸당 장착 확률
    for (let i = items.length; i < slots; i++) {
      if (!r.chance(p)) continue;
      items.push(big && r.chance(G.graded) ? r.pick(ALL_GRADED) : r.pick(ALL_COMPONENTS));
    }
    // (6) 고난: 1페이즈부터 모든 적이 기본 장비를 최소 1개
    if (!items.length && diffHas(run.diff, 6)) items.push(big && r.chance(G.graded) ? r.pick(ALL_GRADED) : r.pick(ALL_COMPONENTS));
    if (items.length) s.items = items;
    if (diffHas(run.diff, 5) && r.chance(G.mod[tier === 'boss' ? 2 : tier === 'elite' ? 1 : 0])) s.mod = r.pick(mods);
  }
}

/** 전장 지형 틀 고르기 (data/maps.ts): 보스전 · 튜토리얼 · 캠페인은 개활지. 그 전장 전용 틀 CFG.maps.field 확률, 아니면 공용 틀 CFG.maps.common 확률.
 *  런 난수와 따로 굴린다 (시드 · 페이즈 · 칸 · 종류에서) — 기존 조우 난수 흐름을 바꾸지 않게.
 *  직전 · 그 전 전투의 틀(run.mapHist)은 가중치를 낮춘다 (CFG.maps.repeat, 고를 틀이 그것뿐이면 그 묶음 확률째로). later 틀은 같은 전장 전용 틀이 한 번 나온 뒤부터 */
function pickMap(run: RunState, type: NodeType, phase: number): string | undefined {
  if (type === 'boss' || run.tutorial || run.campaign) return undefined;
  const r = new Rng(((run.seed * 31 + phase * 1009 + run.step * 7919 + (type === 'adversity' ? 104729 : 0)) >>> 0) || 1);
  const hist = run.mapHist || [], seen = run.mapSeen || [];
  const w = (id: string) => (id === hist[hist.length - 1] ? CFG.maps.repeat[0] : id === hist[hist.length - 2] ? CFG.maps.repeat[1] : 1);
  const fieldMaps = MAPS.filter((m) => m.field && m.field === run.field);
  const own = fieldMaps.filter((m) => !m.later || seen.some((id) => id !== m.id && fieldMaps.some((f) => f.id === id)));
  const common = MAPS.filter((m) => !m.field && m.id !== 'open');
  const top = (ms: MapDef[]) => Math.max(0, ...ms.map((m) => w(m.id))); // 묶음 안에 최근이 아닌 틀이 있으면 1
  if (own.length && r.chance(CFG.maps.field * top(own))) return r.weighted(own, (m) => w(m.id)).id;
  if (r.chance(CFG.maps.common * top(common))) return r.weighted(common, (m) => w(m.id) * (m.phaseW?.(phase) ?? 1) * (m.weight ?? 1)).id; // 긴 통로 4칸 · 5칸은 페이즈에 따라 한 자리를 나눈다 · 가로 지형은 weight 로 덜 나온다
  return undefined;
}
/** 통로(narrow) 지형의 배치 폭: 지형 틀의 폭과, 출전 한도 + 1명이 아군 진형(ZONE 줄)에 다 서는 폭 중 큰 쪽 */
export const narrowWidth = (run: RunState, narrow: number, rows = ZONE) => Math.max(narrow, Math.ceil((deployCap(run) + 1) / rows)); // 아군 진형 줄 수 (긴 통로 4줄 → 폭 4 × 4줄 = 16칸, 출전 한도 15까지 그대로)
/** 고른 지형 틀 기록 (보스 · 튜토리얼 · 캠페인 제외): 최근 2개 · 이 런에서 나온 틀 */
function noteMap(run: RunState, type: NodeType, map: string | undefined) {
  if (type === 'boss' || run.tutorial || run.campaign) return;
  run.mapHist = [...(run.mapHist || []), map || 'open'].slice(-2);
  if (map && !(run.mapSeen ||= []).includes(map)) run.mapSeen.push(map);
}
export function genEncounter(run: RunState, type: NodeType, phase = run.phase): Encounter {
  const map = pickMap(run, type, phase);
  noteMap(run, type, map);
  return rng(run, (r) => {
    const env = r.weighted(CFG.boardSizes, (x) => x.w);
    const nw = mapOf(map).narrow, n = type === 'boss' ? CFG.bossBoard : nw ? narrowWidth(run, nw, mapOf(map).allyRows) : env.n;
    const rows = playerRows(n);
    const p = phase;
    const f = fieldOf(run.field);
    const enemies: EnemySpawn[] = [];
    const ids: string[] = [];
    const pool = f.pool.filter((id) => ENEMY_BY_ID[id].minPhase <= p);
    if (type === 'boss') {
      const boss = run.campaign ? campBoss(run) : f.bosses[(p - 1) % f.bosses.length];
      ids.push(boss, ...(ENEMY_BY_ID[boss].escort || []));
      const extra = run.campaign ? 0 : Math.max(0, Math.min(4, p - 1)); // 보스 호위 추가 인원 (최대 4) · 캠페인은 장 보스 혼자 (포자를 쏟아 낸다)
      for (let i = 0; i < extra + (diffHas(run.diff, 4) ? 1 : 0) + oathV(run, 'titan', 'guard'); i++) ids.push(r.pick(pool)); // 거두의 서약: 호위 +
    } else {
      const late = run.step >= 5 ? 1 : 0; // 페이즈 후반 (항로 회의 이후 두 번째 전투부터)
      const count = run.campaign ? campFoeCount(run) : Math.min(rows * n - 2, 2 + p + late + (f.extraEnemies || 0) + (type === 'adversity' && diffHas(run.diff, 5) ? 1 : 0));
      if (run.campaign && run.flags.includes('cp_sample')) { ids.push('sw_spore', 'sw_spore'); run.flags = run.flags.filter((x) => x !== 'cp_sample'); } // 캠페인 격리 화물: 빠져나간 군체 표본
      if (run.campaign) { const el = campElite(run); if (el) ids.push(el); } // 캠페인: 장마다 정한 칸부터 정예 1마리 else if (type === 'adversity' || ((p >= 2 || oathLv(run, 'elite')) && r.chance((diffHas(run.diff, 5) ? 0.6 : 0.3) + oathV(run, 'elite', 'chance')))) ids.push(f.elite); // 정예의 서약: 1페이즈부터 · 확률 +
      while (ids.length < count) ids.push(r.pick(pool));
    }
    // 위험 등급 적 증원 (모험 · 고난, CFG.diffAdd): 보스전 포함 모든 전투. 이 조우에 이미 나온 일반 적(정예 · 보스 · 장애물 제외) 중에서 복제하고,
    // 없으면 전장 풀에서. 보드 칸(줄 × 폭 - 2)이 모자라면 들어가는 만큼만
    const add = run.campaign ? 0 : Math.max(0, Math.min(diffAddCount(run.diff, p) + oathV(run, 'horde', 'add'), rows * n - 2 - ids.length)); // + 군세의 서약 · 캠페인은 장별 인원 설계를 따른다
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
    if (mapOf(map).surround) enemies.forEach((e, i) => { if (i % 2) e.flip = true; }); // 포위: 절반은 아래 적 진형에서
    gearEnemies(run, r, enemies, type, p);
    return {
      n, env: type === 'boss' ? '보스 아레나' : mapOf(map).narrow ? '좁은 전장' : env.env, enemies,
      ...(map ? { map } : {}),
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
  /** 청라공국: 이번 전투의 인과율 (결과 창 '인과율 +k (장비 +j)') */
  causal?: { gain: number; gear: number; stage0: number; stage: number; left: number };
}

/** 이번 페이즈 보스가 '이겨야 넘어가는' 보스인지: 의뢰의 마지막 보스 (victoryPhase 이상 · 아직 의뢰 성공 전)만. 그 밖의 보스는 져도 다음 페이즈로 (무한 모드 보스 포함) */
export const bossMustWin = (run: RunState) => !run.cleared && (!!run.campaign || run.phase >= CFG.victoryPhase); // 캠페인: 장 보스는 이겨야 넘어간다

export function resolveBattle(run: RunState, b: Battle): BattleSummary {
  if (run.lab && LAB_HOOK.resolve) return LAB_HOOK.resolve(run, b);
  const staled = ageBread(run); // 갓 구운 빵: 이번 전투로 식는 것 (이번 전투에서 얻는 빵은 세지 않도록 먼저)
  const inv0 = run.inventory.slice(); // 결과 창: 새로 얻은 장비 표시용
  const node = run.node!.type;
  const challenge = node === 'challenge';
  const type: NodeType = challenge ? 'adversity' : node; // 도전은 보상 · 피해를 역경 기준으로
  const won = b.winner === 0;
  const p = run.phase;
  const lines: string[] = [];
  if (staled) lines.push(`갓 구운 빵 ${staled}개가 식었습니다`);
  const dep = deployed(run);
  const counts = synergyCounts(dep, run);
  const pet = tierOf('PET', counts.PET || 0);
  const uni = tierOf('UNI', counts.UNI || 0);

  // 이자 (수입 전 보유량 기준, interestInfo: 상단 바 · 지도 미리보기와 같은 식)
  const creditsBefore = run.credits;
  const { interest, cap } = interestInfo(run, counts);
  let income = interest;
  if (interest) lines.push(`이자 +${interest} (상한 ${cap})`);

  let hpLoss = 0;
  if (won) {
    run.streak = Math.max(1, run.streak + 1);
    run.stats.wins++;
    let c = CFG.winCredits(p);
    if (type === 'adversity') c = Math.round(c * CFG.adversityReward);
    c = Math.round(c * CFG.diffWinMul(run.diff || 0) * oathWinMul(run) * contractWinMul(run)); // 위험 3 ×1.25 · 위험 6 ×1.5 · 박봉의 서약
    if (type === 'boss') c += 5;
    c = Math.max(0, Math.round(c * stakesMul(run)) + globalWinAdd(run)); // 판돈 올리기 · 전리품 회수
    income += c;
    lines.push(`승리 보상 +${c}`);
    if (hasGlobal(run, 'G.r_bounty')) { const k = Math.min(GA.bountyMax, b.counters.kills); if (k) { income += k; lines.push(`현상금 +${k}`); } }
    if (hasGlobal(run, 'G.medic') && run.hp < run.maxHp) { const h = Math.min(GA.medic, run.maxHp - run.hp); run.hp += h; lines.push(`야전 의무대 — 체력 +${h}`); }
    const sb = CFG.streakBonus(run.streak);
    if (sb) { income += sb; lines.push(`${run.streak}연승 보너스 +${sb}`); }
    if (pet >= 1) { const pb = pet >= 4 ? 3 : 1; income += pb; lines.push(`페트라 실적 +${pb}`); }
    const fw = fieldOf(run.field).winCredits;
    if (fw) { income += fw; lines.push(`전장 조건 · 계약 정산 +${fw}`); }
    // 전투 보상 소모품: 분리 용제 · 재구성 회로 · 공명 주입기 (주입기 크기는 페이즈에 따라) · 캠페인 소모품 · 배치형 4종 중 하나
    const uc = CFG.drop.utility[type] || 0;
    if (uc && rng(run, (r) => r.chance(uc))) {
      const k = rng(run, (r) => { const k = r.pick(['K_strip', 'K_reroll', 'inject', 'K_cp_purge', 'K_cp_note', 'K_barricade', 'K_decoy', 'K_mine', 'K_net']); return k === 'inject' ? pickInjector(r, p) : k; });
      if (k === 'K_strip' && !solventOn(run)) { // 분리 용제가 안 나오는 런: 같은 값의 공명도를 파티에 분배
        const xp = Math.max(1, Math.round(CFG.shop.price.K_strip / XP_VALUE));
        distributeXp(run, xp); run.units.forEach((u) => settleXp(run, u));
        lines.push(`공명도 ${xp} 분배`);
      } else gainItem(run, k, lines);
    }
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
    hpLoss = (type === 'boss' ? CFG.bossLossDamage(p) : CFG.lossDamage(p, survivors) * (type === 'adversity' ? CFG.adversityLoss : 1)) * (1 + oathV(run, 'wound', 'loss')); // 패전의 서약
    if (pet >= 2) { hpLoss *= 0.5; income += 6; lines.push('페트라 보험금 +6, 체력 피해 50% 감소'); }
    if (hasGlobal(run, 'G.survival')) hpLoss *= 0.7;
    hpLoss = Math.round(hpLoss);
    run.hp -= hpLoss;
    lines.push(`패배 — 체력 -${hpLoss}`);
    if (type === 'boss') lines.push(bossMustWin(run) ? '의뢰의 마지막 보스입니다 — 쓰러뜨려야 의뢰를 마칠 수 있습니다. 다시 맞붙습니다.' : '보스를 넘지 못했지만, 함대는 물러나 다음 페이즈로 항로를 이어 갑니다.');
  }
  if (run.loan > 0) {
    const pay = Math.min(10, run.loan, run.credits + income);
    run.loan -= pay;
    income -= pay;
    recSpend(run, 'loan', pay);
    lines.push(`대출 상환 -${pay} (잔액 ${run.loan})`);
  }
  run.credits += income;

  // 공명도
  const xpBefore = new Map(run.units.map((u) => [u.uid, u.xp + totalXpOf(u)]));
  const lvBefore = new Map(run.units.map((u) => [u.uid, { rank0: u.rank, xp0: u.xp }]));
  let pool = CFG.xpPool(p) * (won ? 1 : 0.5) * (type === 'adversity' ? CFG.adversityReward : 1) * (hasGlobal(run, 'G.resonance') ? 1.35 : 1) * despairXp(run) * stakesMul(run);
  pool = Math.round(pool);
  distributeXp(run, pool);
  lines.push(`공명도 풀 ${pool} 분배`);
  if (uni) for (const u of dep) if (memberships(u).includes('UNI')) u.xp += UNI_XP[uni]; // 연합: 전투 후 추가 공명도
  const killsOf = (u: UnitState) => b.units.find((c) => c.src === u)?.counters.kills || 0;
  for (const u of dep) for (const a of u.augments) AUG_BY_ID[a.id]?.after?.(run, u, won, killsOf(u), { c: b.units.find((c) => c.src === u), gain: (id) => gainItem(run, id, lines) });
  // 성직자: 승리 시 신앙 / 대스타: 승리 시 명성 + 대스타 처치 수
  const star = tierOf('STAR', counts.STAR || 0);
  settleGrowth(run, b, won, interest, lines);
  const causal = settleCausal(run, won, tierOf('CHR', counts.CHR || 0), lines);
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
  recBattle(run, b, { interest, cap, credits0: creditsBefore }); // 전투 종료 보고서 누적 (engine/report.ts)

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
  run.flags = run.flags.filter((f) => f !== 'cp_purge'); // 정화 분무기: 한 전투만
  if (run.campaign) campAfterBattle(run, b, won, type, counts, lines); // 계약 정산 · 장 정산 (보스 승리 = 장 끝)
  if (run.hp <= 0 && hasGlobal(run, 'G.l_phoenix') && !run.flags.includes('g_phoenix')) { // 불사조 계약: 런마다 1회
    run.flags.push('g_phoenix'); run.hp = Math.max(1, Math.round(run.maxHp * GA.phoenix)); lines.push(`불사조 계약 — 체력 ${run.hp}로 되살아났습니다`);
  }
  if (run.hp <= 0) { run.hp = 0; run.over = true; gameOver = true; }
  else if (run.over) gameOver = true; // 캠페인 장 끝 (검증판)
  else if (won || type !== 'boss' || !bossMustWin(run)) advance(run); // 보스: 져도 다음 페이즈로 (의뢰의 마지막 보스만 다시)
  else { run.node = { type: 'boss', enc: genEncounter(run, 'boss') }; fitDeployNotice(run); }
  const gained = run.inventory.slice();
  for (const id of inv0) { const i = gained.indexOf(id); if (i >= 0) gained.splice(i, 1); }
  return { won, lines, xp, hpLoss, gameOver, items: gained, causal };
}

/** 청라공국: 이긴 전투에서만 인과율을 모은다 (기본 몫 + 출전 아군 장비 점수 몫, 둘 다 청라 단계 배율). 전용 장비 해금 단계도 여기서 기록 */
function settleCausal(run: RunState, won: boolean, tier: number, lines: string[]): BattleSummary['causal'] {
  if (tier > (run.chrTier || 0)) {
    for (let t = (run.chrTier || 0) + 1; t <= Math.min(3, tier); t++) lines.push(`청라공국 ${[3, 5, 7][t - 1]}명: 무휼 전용 장비 [${KING_GEAR_NAME[KING_GEAR[t - 1]]}] 해금 · 자동 장착`);
    run.chrTier = tier;
  }
  if (!won || !tier) return undefined;
  const pts0 = run.causal || 0, g = causalGain(run, tier);
  if (!g.total) return undefined;
  run.causal = pts0 + g.total;
  const s0 = causalStage(pts0), s1 = causalStage(run.causal);
  lines.push(`인과율 +${g.total} (장비 +${g.gear}) · 인과 ${s1}단계${s1 > s0 ? ` 상승!` : ''}${causalLeft(run.causal) ? ` · 다음까지 ${causalLeft(run.causal)}` : ' · 최고 단계'}`);
  return { gain: g.total, gear: g.gear, stage0: s0, stage: s1, left: causalLeft(run.causal) };
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
  if (CFG.growth.oath(tt, R) && augRoom(u, 'oath')) run.pending.push({ t: 'rankup', uid: u.uid, rank: R, points: 0, options: null, rerolls: CFG.augmentRerolls, allocDone: true, kind: 'oath' });
}

export function buyXp(run: RunState, uid: string): boolean {
  const u = run.units.find((x) => x.uid === uid);
  const cost = CFG.buyXpCost - (hasGlobal(run, 'G.study') ? 1 : 0);
  if (!u || isRock(u) || u.rank >= CFG.maxRank || run.credits < cost) return false;
  run.credits -= cost;
  recSpend(run, 'xp', cost);
  u.xp += CFG.buyXpAmount + (hasGlobal(run, 'G.study') ? 1 : 0);
  settleXp(run, u);
  return true;
}
export const xpCost = (run: RunState) => CFG.buyXpCost - (hasGlobal(run, 'G.study') ? 1 : 0) + (hasDespair(run, 'D.leak') ? CFG.despair.leak : 0);

// ───────────────────────── 증강 선택
export type AugKind = 'major' | 'special' | 'psionic' | 'school' | 'oath';
/** 기물 유형이 받는 증강 종류 (마이너 · 디바인은 없음) */
export function typeAugKind(u: UnitState): AugKind | null {
  const tt = UNIT_BY_ID[u.defId].ttype;
  return tt === 'major' || tt === 'special' ? 'special' : tt === 'psionic' ? 'psionic' : tt === 'divine' ? 'oath' : null; // 메이저 = 전용 증강 · 디바인 = 서약 증강
}
/** 사이오닉: 보유 학파의 전공 증강 (학파가 없으면 빈 목록) */
export const psiPool = (u: UnitState) => schoolPassives(schoolOf(u));
/** 유형 증강 풀 (메이저 전용 · 디바인 서약 · 사이오닉 전공 증강, 'major' = 예전 공용 풀: 예전 저장의 대기 선택만) — 성장 · 사건 · 호이슌 계약 공용 */
export function augPoolOf(u: UnitState, kind: AugKind): readonly AugDef[] {
  return kind === 'special' ? UNIT_BY_ID[u.defId].specialAugs || [] : kind === 'oath' ? OATH_AUGS : kind === 'psionic' ? psiPool(u) : kind === 'major' ? MAJOR_AUGS : [];
}
/** 이 유형 증강을 더 받을 수 있는지 (스페셜 · 사이오닉은 최대 4개, 학파는 1개) */
export function augRoom(u: UnitState, kind: AugKind) {
  if (kind === 'major') return true;
  if (kind === 'school') return UNIT_BY_ID[u.defId].ttype === 'psionic' && !schoolOf(u);
  if (kind === 'psionic' && !schoolOf(u)) return u.augments.filter((a) => a.id.startsWith('psi.')).length < 4; // 학파 선택 대기 중: 이정표는 남겨 둔다
  const list = augPoolOf(u, kind);
  const pool = new Set(list.map((a) => a.id));
  if (u.augments.filter((a) => pool.has(a.id)).length >= (kind === 'psionic' ? 4 : CFG.majorAugMax)) return false;
  return list.some((a) => !u.augments.some((p) => p.id === a.id)); // 고를 수 있는 증강이 남았는지
}
export function augOptions(run: RunState, u: UnitState, kind: AugKind = 'major'): AugPick[] {
  const def = UNIT_BY_ID[u.defId];
  const owned = new Set(u.augments.map((a) => a.id));
  const avail = (a: { id: string; stack?: boolean }) => a.stack || !owned.has(a.id);
  if (!augRoom(u, kind)) return [];
  // 전공: 기물 학파의 전공 2개 (학파가 없는 레이첼은 8개 전부)
  if (kind === 'school') { const ok = majorsOf(def.id); return SCHOOL_AUGS.filter((a) => ok.includes(a.owner as SchoolId)).map((a) => ({ id: a.id })); }
  const base = augPoolOf(u, kind);
  const unitPool = base.filter((a) => avail(a));
  if (kind === 'psionic' || kind === 'special') {
    // 전공 증강: 기본 증강 3장, 확률(psiLegendChance)로 그중 1장이 ★ 전설
    const leg = unitPool.filter((a) => isLegendAug(a.id)).map((a) => a.id), norm = unitPool.filter((a) => !isLegendAug(a.id)).map((a) => a.id);
    return rng(run, (r) => {
      const show = leg.length > 0 && r.chance(kind === 'special' ? majorLegendChance(u) : psiLegendChance(u));
      const out = show ? [...r.sample(norm, augN(run) - 1), r.pick(leg)] : r.sample(norm, augN(run));
      return r.shuffle(out).map((id) => ({ id }));
    });
  }
  return rng(run, (r) => {
    // 배타 증강은 없다 (어떤 조합도 함께 작동). 보유하지 않은 후보에서 균등 비복원 추출
    const out = r.sample(unitPool.map((x) => x.id), augN(run));
    return out.map((id) => {
      const a = AUG_BY_ID[id];
      return a.roll ? { id, param: a.roll((arr) => r.pick(arr)) } : { id };
    });
  });
}

/** 증강 선택지 수 (메이저 · 스페셜 · 전공 증강): 침묵의 서약이면 줄어든다 */
const augN = (run: RunState) => Math.max(1, CFG.augmentChoices - oathV(run, 'augment', 'less'));
/** ★ 전설 전공 증강이 이번 선택지에 섞일 확률: 기본 + 전설 없이 지나간 전공 증강 선택마다 보정, 전설을 한 번 얻으면 기본만 */
/** ★ 전설 메이저 전용 증강이 선택지에 섞일 확률 (CFG.majorLegend): 전설을 아직 못 얻었으면 지나간 선택마다 보정 */
export function majorLegendChance(u: UnitState): number {
  const pool = new Set((UNIT_BY_ID[u.defId].specialAugs || []).map((a) => a.id));
  const owned = u.augments.filter((a) => pool.has(a.id));
  if (owned.some((a) => isLegendAug(a.id))) return CFG.majorLegend.base;
  if (owned.length >= CFG.majorAugMax - 1) return 1; // 마지막 선택: 전설을 한 번도 못 얻었으면 확정으로 섞는다
  return Math.min(1, CFG.majorLegend.base + CFG.majorLegend.pity * owned.length);
}
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
/** 캣휠(ZI존): 보관함 + 장착 중인 캣휠이 CFG.despair.zi 개 모이면 그만큼 소모해 캣휠(ZI존) 1개로 바꾼다 (모일 때마다 반복).
 *  보관함의 캣휠부터 쓰고, 모자라면 장착한 캣휠을 뗀다 (밍키 것을 먼저 — ZI존은 처음 뗀 칸에 그대로 달린다. 장착한 것을 안 썼으면 보관함으로).
 *  알림은 대기 중인 선택(notice)으로. 장비가 들어오는 길(획득 · 구매 · 합성 · 장착 조합 · 복제)과 UI 저장(main.ts persist)에서 부른다. 만든 개수 */
export function mergeCatwheels(run: RunState, lines?: string[]): number {
  const need = CFG.despair.zi;
  let made = 0;
  const where: string[] = [];
  for (;;) {
    const inv = run.inventory.flatMap((x, i) => (x === CATWHEEL ? [i] : []));
    const eq = run.units.flatMap((u) => u.items.flatMap((x, k) => (x === CATWHEEL ? [{ u, k }] : [])));
    if (inv.length + eq.length < need) break;
    eq.sort((a, b) => +(b.u.defId === 'mingki') - +(a.u.defId === 'mingki'));
    const useInv = inv.slice(0, need), useEq = eq.slice(0, need - useInv.length);
    for (const i of useInv.reverse()) run.inventory.splice(i, 1);
    for (const e of useEq) e.u.items[e.k] = null;
    if (useEq.length) { useEq[0].u.items[useEq[0].k] = CATWHEEL_ZI; where.push(`${UNIT_BY_ID[useEq[0].u.defId]?.name || '기물'}의 장비 칸`); }
    else { run.inventory.push(CATWHEEL_ZI); where.push('보관함'); }
    made++;
  }
  if (!made) return 0;
  const zi = itemInfo(CATWHEEL_ZI).name;
  const msg = `캣휠 ${need * made}개가 맞물려 ${zi}${made > 1 ? ` ${made}개` : ''} 완성`;
  lines?.push(msg);
  log(run, msg);
  run.pending.push({ t: 'notice', title: zi, body: `캣휠 ${need * made}개가 저절로 맞물려 전설 장비 [${zi}]${made > 1 ? ` ${made}개가` : '이'} 되었습니다. 모든 주요 능력치 +${CFG.despair.ziMajors}. ${[...new Set(where)].join(' · ')}에 들어갔습니다.` });
  return made;
}
/** 장비 획득. own = 이미 가진 장비를 돌려받는 경우 (방출 · 변성: 유닉스제 대체 없음). 들어온 장비 id (자동 판매면 null) */
export function gainItem(run: RunState, id: string, lines?: string[], force = false, own = false): string | null {
  if (!own) id = unixSwap(run, id, lines);
  if (run.inventory.length >= CFG.inventoryMax && !force) {
    const v = sellPrice(run, id);
    run.credits += v;
    lines?.push(`인벤토리 가득 참 — ${itemInfo(id).name} 자동 판매 +${v}`);
    return null;
  }
  if (id === 'K_bread') breadLeft(run, true); // 지금 보관함 빵에 맞춘 뒤
  run.inventory.push(id);
  if (id === 'K_bread') run.breadFresh!.push(CFG.chef.staleAfter); // 새 빵: 식기까지 전투 staleAfter 회
  lines?.push(`장비 획득: ${itemInfo(id).name}`);
  if (id === CATWHEEL) mergeCatwheels(run, lines);
  return id;
}

/** 갓 구운 빵이 식기까지 남은 전투 수: 보관함의 'K_bread' 순서대로 (먼저 얻은 것 = 적게 남은 것부터).
 *  쓰거나 판 빵은 따로 기록하지 않으므로, 보관함 개수에 맞춰 가장 오래된 기록부터 지운다 (옛 세이브 · 모자라면 새 빵으로 채움). save = run 에 맞춘 값 저장 */
export function breadLeft(run: RunState, save = false): number[] {
  const n = run.inventory.filter((x) => x === 'K_bread').length;
  const ages = (run.breadFresh || []).slice().sort((a, b) => a - b);
  while (ages.length > n) ages.shift();
  while (ages.length < n) ages.push(CFG.chef.staleAfter);
  if (save) run.breadFresh = ages;
  return ages;
}
/** 보관함 칸 i 의 갓 구운 빵을 쓰거나 팔 때: 그 빵의 남은 전투 기록을 지운다 (보관함에서 빼기 전에 부른다) */
function dropBread(run: RunState, i: number) {
  if (run.inventory[i] !== 'K_bread') return;
  const ages = breadLeft(run, true), k = run.inventory.slice(0, i).filter((x) => x === 'K_bread').length;
  ages.splice(k, 1);
}
/** 전투 1회: 빵이 식는 데 남은 전투 −1, 0 이 되면 식은 빵으로 (가장 먼저 얻은 빵부터). 셰프 noStaleTier 단계 이상이 켜진 전투는 세지 않는다. 식은 빵 수 */
function ageBread(run: RunState): number {
  const ages = breadLeft(run, true);
  if (!ages.length || tierNow(run, 'CHEF') >= CFG.chef.noStaleTier) return 0;
  let n = 0;
  run.breadFresh = ages.map((x) => x - 1).filter((x) => { if (x > 0) return true; n++; return false; });
  for (let k = 0; k < n; k++) { const i = run.inventory.indexOf('K_bread'); if (i >= 0) run.inventory[i] = 'K_bread_stale'; }
  return n;
}
/** 보관함 물품 판매가: 빵은 위험 등급 기준 (CFG.chef.breadSell, 식은 빵 −staleSell), 그 밖은 CFG.sell */
export const sellPrice = (run: RunState, id: string) => (id === 'K_bread' || id === 'K_bread_stale' ? breadSell(run.diff, id === 'K_bread_stale') : CFG.sell[id[0]]);

/** 공명 주입기 1개: 페이즈에 맞는 크기 (injectorWeights 가중치) */
const pickInjector = (r: Rng, phase: number) => r.weighted(injectorWeights(phase), ([, w]) => w)[0];

/** 상점 가격 배율: 전장 상점 배율 × 관세 (절망 증강) × 전역 증강 [할인] */
export const shopMul = (run: RunState) => (fieldOf(run.field).shopMul || 1) * despairPrice(run) * (hasGlobal(run, 'G.discount') ? 1 - GA.discount : 1);
/** 지정 소집 티켓 가격 (유이 전용): 지금 지정 소집 기본 비용 (관세 전) × CFG.shop.ticket × 상점 배율 */
export const ticketPrice = (run: RunState) => Math.round((CFG.musterCost + CFG.musterStep * (run.musters || 0)) * CFG.shop.ticket * shopMul(run));
/** 진열 분류 (칸 표시 · 대사 · 정렬): 상인 전용 · 전설 · 희귀 · 고급 · 문장 · 재료 · 전설급 소모품 · 소모품 */
export function shopKind(id: string): 'L' | 'A' | 'G' | 'M' | 'C' | 'KL' | 'K' {
  if (isConsumable(id)) return CONSUMABLES[id]?.legend ? 'KL' : 'K';
  if (isEmblem(id)) return 'M';
  const t = id[0];
  return t === 'L' || t === 'A' || t === 'G' || t === 'C' ? t : 'A';
}
const SHOP_ORDER = ['L', 'A', 'G', 'M', 'C', 'KL', 'K'];
/** 이 상점에 나올 상인 (공용 상인 + 전장 특별 상인 중 균등). 튜토리얼 상점은 engine/tutorial.ts 가 정한다 */
export const pickMerchant = (run: RunState) => rng(run, (r) => r.pick(merchantPool(fieldOf(run.field))));
/** 상점 노드 열기: 상인 1명 + 진열 6~9개 (노드에 기록 → 다시 열거나 불러와도 같은 상인 · 같은 진열) */
export function openShop(run: RunState) {
  const merchant = pickMerchant(run);
  run.node = { type: 'shop', shop: genShop(run, merchant), merchant };
}

/** 상점 진열 (3×3 진열대에 서로 다른 물품 n 개, n = CFG.shop.count 확률로 6~9 — 남는 칸은 빈 선반).
 *  1) 예전 진열 규칙을 그대로 굴린다: 재료 2 확정 · 희귀 (1 · 2) · 고급 · 전설 (6페이즈부터, 고르곤은 페이즈 무관 20%) · 3페이즈부터 고급 · 희귀 1개 이상 · 소모품 2~3 · 강제 징수기 · 원초 공명석 · 문장.
 *  2) 상인 전용 상품은 늘 넣는다 (n 개 안). 넘치면 분류 순서 (전용 > 전설 > 희귀 > 고급 > 문장 > 재료 > 전설 소모품 > 소모품) 로 자른다 — 전용 · 굴린 전설은 남는다.
 *  3) 모자라는 칸은 CFG.shop.fill 가중치로 분류를 골라 그 분류의 아직 없는 물품으로 채운다 (재료 · 소모품 · 고급 · 희귀 · 문장).
 *  4) 할인: 칸 수 CFG.shop.sale.n 확률 · 할인율 sale.pct 균등 (드물게 sale.rare) */
export function genShop(run: RunState, merchant?: string): ShopSlot[] {
  return rng(run, (r) => {
    const S = CFG.shop, D = CFG.drop, m = merchant ? MERCHANT_BY_ID[merchant] : undefined;
    const mul = shopMul(run);
    const slots = Math.min(S.slots, r.weighted(S.count, ([, w]) => w)[0]); // 이번 진열 수 (진열대 칸 수 이하)
    const pr = (g: string) => Math.round(CFG.price[g] * mul);
    const sp = (key: string) => Math.round(S.price[key] * mul);
    const out: ShopSlot[] = [];
    const has = (id: string) => out.some((x) => x.item === id);
    const add = (item: string, price: number, ex = false) => { if (!has(item)) out.push({ item, price, sold: false, ...(ex ? { ex: true } : {}) }); };
    // 상인 전용 상품
    if (m?.ex === 'K_muster_ticket') add(m.ex, ticketPrice(run), true);
    else if (m?.ex) add(m.ex, sp(m.ex), true);
    // 예전 진열 규칙: 재료 2개 확정 (서로 다르게) + 희귀(입고 행사면 2개) · 고급 · 전설 확률
    for (const id of r.sample(ALL_COMPONENTS, D.shopParts)) add(id, pr('C'));
    const rares = r.chance(D.shopAdv2) ? 2 : r.chance(D.shopAdv) ? 1 : 0;
    for (const id of r.sample(ALL_ADVANCED, rares)) add(id, pr('A'));
    if (r.chance(D.shopGraded)) add(r.pick(ALL_GRADED), pr('G'));
    const legend = m?.legend !== undefined ? r.chance(m.legend) : run.phase >= D.shopLegendPhase && r.chance(D.shopLegend);
    if (legend) add('L_' + r.pick(ALL_ADVANCED).slice(2), pr('L'));
    // 3페이즈부터: 고급 · 희귀 장비 1개 이상 확정 (확률 입고로 하나도 없으면 하나 더)
    if (run.phase >= S.gearFrom && !out.some((x) => x.item[0] === 'G' || x.item[0] === 'A')) {
      if (r.chance(S.gearAdv)) add(r.pick(ALL_ADVANCED), pr('A'));
      else add(r.pick(ALL_GRADED), pr('G'));
    }
    // 소모품: 서로 다른 종류 S.consMin 개 확정 (+ S.cons 확률로 1개 더). 공명 주입기는 페이즈에 맞는 크기, 분리 용제는 고난 이상 일반 런만
    const ks = Object.keys(S.consW).filter((k) => k !== 'K_strip' || solventOn(run));
    const consId = (k: string) => (k === 'inject' ? pickInjector(r, run.phase) : k);
    for (let n = S.consMin + (r.chance(S.cons) ? 1 : 0); n > 0 && ks.length; n--) {
      const k = r.weighted(ks, (x) => S.consW[x]);
      ks.splice(ks.indexOf(k), 1); // 가중치 비복원 추출: 서로 다른 종류
      const id = consId(k);
      add(id, sp(id));
    }
    // 전설 소모품: 강제 징수기 (종종, 적이 장비를 다는 위험 등급에서만) · 원초 공명석 (희귀)
    if (foeGearOn(run) && r.chance(S.seize)) add('K_seize', sp('K_seize'));
    if (run.phase >= S.rank3From && r.chance(S.rank3)) add('K_rank3', sp('K_rank3'));
    // 문장 (희귀): 출전 기물이 가진 시너지 위주
    const own = [...new Set(deployed(run).flatMap((u) => memberships(u)))].filter((x) => EMBLEM_SYNS.includes(x));
    const emblem = (pool: SynergyId[]) => emblemId(r.pick(own.filter((x) => pool.includes(x)).length && r.chance(S.emblemOwn) ? own.filter((x) => pool.includes(x)) : pool));
    if (r.chance(S.emblem)) add(emblem(EMBLEM_SYNS), sp('emblem'));
    // 넘치면 자른다: 전용 > 분류 순서 (SHOP_ORDER) — 같은 분류 안에서는 먼저 들어온 것부터
    const rank = (x: ShopSlot) => (x.ex ? -1 : SHOP_ORDER.indexOf(shopKind(x.item)));
    if (out.length > slots) { const keep = out.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).slice(0, slots).map((y) => y.x); out.length = 0; out.push(...keep); }
    // 모자라는 칸 채우기 (분류 가중치 S.fill, 같은 물품 없이)
    const pools: Record<string, () => string[]> = {
      C: () => ALL_COMPONENTS.filter((id) => !has(id)),
      G: () => ALL_GRADED.filter((id) => !has(id)),
      A: () => ALL_ADVANCED.filter((id) => !has(id)),
      K: () => ks.filter((k) => (k === 'inject' ? injectorWeights(run.phase).some(([id]) => !has(id)) : !has(k))),
      M: () => EMBLEM_SYNS.filter((s) => !has(emblemId(s))).map(emblemId),
    };
    for (let guard = 0; out.length < slots && guard < 40; guard++) {
      const cats = Object.keys(S.fill).filter((c) => S.fill[c] > 0 && pools[c]?.().length);
      if (!cats.length) break;
      const c = r.weighted(cats, (x) => S.fill[x]);
      const ids = pools[c]();
      if (c === 'C') add(r.pick(ids), pr('C'));
      else if (c === 'G') add(r.pick(ids), pr('G'));
      else if (c === 'A') add(r.pick(ids), pr('A'));
      else if (c === 'M') add(emblem(ids.map(emblemOf)), sp('emblem'));
      else {
        const k = r.weighted(ids, (x) => S.consW[x]);
        const inj = injectorWeights(run.phase).filter(([id]) => !has(id));
        const id = k === 'inject' ? r.weighted(inj, ([, w]) => w)[0] : k;
        add(id, sp(id));
      }
    }
    out.sort((a, b) => rank(a) - rank(b));
    // 할인 칸 (가격이 있는 칸 중)
    const nSale = r.weighted([0, 1, 2, 3].filter((k) => k < S.sale.n.length), (k) => S.sale.n[k]);
    for (const x of r.sample(out.filter((y) => y.price >= 2), nSale)) { // 1 크레딧짜리는 깎지 않는다 · 깎으면 1 이상 싸진다
      const off = r.chance(S.sale.rareP) ? S.sale.rare : r.pick(S.sale.pct);
      x.base = x.price;
      x.off = off;
      x.price = Math.max(1, Math.min(x.price - 1, Math.round(x.price * (1 - off / 100))));
    }
    return out;
  });
}
/** 진열 새로고침 상태: 이번 페이즈에 이미 썼는지 · 다음 비용 (의뢰 첫 번은 무료, 그다음 base, 유료 1번마다 +step) × 상점 배율 (진열 가격과 같은 shopMul).
 *  base = 배율 전 비용 (설명용) */
export function refreshInfo(run: RunState) {
  const rf = run.shopRf || { n: 0, ph: 0 }, R0 = CFG.shop.refresh;
  const base = rf.n ? R0.base + R0.step * (rf.n - 1) : 0;
  return { used: rf.ph === run.phase, n: rf.n, base, cost: base ? Math.max(1, Math.round(base * shopMul(run))) : 0 };
}
/** 진열 새로고침: 진열 수 (6~9) · 품절 칸까지 모든 물품 · 할인을 새로 (상인 그대로 · 전용 상품 다시 진열). 오류 문구 또는 null */
export function refreshShop(run: RunState): string | null {
  const nd = run.node;
  if (nd?.type !== 'shop' || !nd.merchant || !nd.shop) return '상점이 아닙니다';
  if (run.tutorial) return '튜토리얼 상점은 새로고침할 수 없습니다';
  const inf = refreshInfo(run);
  if (inf.used) return '이번 페이즈에 이미 새로고침했습니다';
  if (run.credits < inf.cost) return '크레딧 부족';
  run.credits -= inf.cost;
  recSpend(run, 'shop', inf.cost);
  recReroll(run);
  run.shopRf = { n: inf.n + 1, ph: run.phase };
  nd.shop = genShop(run, nd.merchant);
  log(run, `상점 새로고침${inf.cost ? ` (크레딧 -${inf.cost})` : ' (무료)'}`);
  return null;
}
/** 고르곤 교환에 낼 수 있는 보관함 장비 (고급 · 희귀, 장착한 것 제외) → 보관함 칸 번호 */
export const tradeOptions = (run: RunState) => run.inventory.flatMap((id, i) => (ALL_GRADED.includes(id) || ALL_ADVANCED.includes(id) ? [i] : []));
/** 교환으로 돌려받는 재료: 조합법 재료 (고급 = 같은 재료 2개 · 희귀 = 서로 다른 재료 2개) + 무작위 1개. 조합법이 없는 희귀는 무작위 3개 */
export function tradeYield(id: string): { fixed: string[]; rand: number } {
  if (ALL_GRADED.includes(id)) { const c = `C_${id.slice(2)}`; return { fixed: [c, c], rand: 1 }; }
  for (const a of ALL_COMPONENTS) for (const b of ALL_COMPONENTS) if (combine(a, b) === id) return { fixed: [a, b], rand: 1 };
  return { fixed: [], rand: 3 };
}
/** 교환할 수 없는 까닭 (null = 가능): 상인 · 이미 교환 · 낼 장비 · 보관함 자리 (1개 내고 3개 받음) */
export function tradeErr(run: RunState, invIdx?: number): string | null {
  const nd = run.node;
  if (nd?.type !== 'shop' || !nd.merchant || !MERCHANT_BY_ID[nd.merchant]?.trade) return '교환할 수 있는 상인이 없습니다';
  if (nd.traded) return '이 상점에서는 이미 교환했습니다';
  if (!tradeOptions(run).length) return '교환할 고급 · 희귀 장비가 없습니다';
  if (invIdx !== undefined && !tradeOptions(run).includes(invIdx)) return '고급 · 희귀 장비만 교환할 수 있습니다';
  if (run.inventory.length - 1 + 3 > CFG.inventoryMax) return '보관함 공간이 부족합니다';
  return null;
}
/** 고르곤 교환: 보관함 장비 1개 → 재료 3개 (상점마다 1번). 받은 재료 또는 오류 */
export function gorgonTrade(run: RunState, invIdx: number): { got?: string[]; err?: string } {
  const err = tradeErr(run, invIdx);
  if (err) return { err };
  const id = run.inventory[invIdx], y = tradeYield(id);
  const got = [...y.fixed, ...rng(run, (r) => [...Array(y.rand)].map(() => r.pick(ALL_COMPONENTS)))];
  run.inventory.splice(invIdx, 1);
  run.inventory.push(...got);
  run.node!.traded = true;
  log(run, `고르곤 교환: ${itemInfo(id).name} → ${got.map((x) => itemInfo(x).name).join(' · ')}`);
  return { got };
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

/** 포탑 장비 · 개조부품 칸 상태를 엔지니어 단계에 맞춘다: 포탑 수 · 칸 수가 줄면 남는 장비는 보관함으로, 엔지니어가 꺼지면 포탑 회수 */
export function syncTurrets(run: RunState): string[] {
  const n = turretCount(run);
  const slots = turretSlots(engTier(run));
  const back: string[] = [];
  const g = (run.turretGear ||= []);
  for (let i = 0; i < g.length; i++) {
    const keep = i < n ? slots : 0;
    for (let k = keep; k < g[i].length; k++) if (g[i][k]) back.push(g[i][k]!);
    g[i] = g[i].slice(0, keep);
  }
  g.length = Math.min(g.length, n);
  for (let i = 0; i < n; i++) { g[i] ||= []; while (g[i].length < slots) g[i].push(null); }
  // 개조부품 칸: 포탑마다 1칸 (옛 세이브에는 없다 → 빈 칸)
  const m = (run.turretMods ||= []);
  for (let i = n; i < m.length; i++) if (m[i]) back.push(m[i]!);
  m.length = Math.min(m.length, n);
  for (let i = 0; i < n; i++) m[i] ??= null;
  if (!n && run.turretPos?.length) run.turretPos = []; // 엔지니어 비활성: 설치한 포탑 회수
  for (const id of back) run.inventory.push(id); // 보관함이 가득 차도 돌려준다
  if (back.length) log(run, `포탑 회수: 장비 · 개조부품 ${back.length}개 보관함으로`);
  return back;
}
/** 보관함의 포탑 장비를 포탑 ti 의 칸에 (slot 생략 = 빈 칸, 없으면 첫 칸과 맞교환). 엔지니어 전용 개조부품은 개조부품 칸으로 (slot -1, 맞교환) */
export function equipTurret(run: RunState, invIdx: number, ti: number, slot?: number): string | null {
  const id = run.inventory[invIdx];
  if (!id) return '대상 없음';
  if (!isTurretItem(id)) return '포탑에는 포탑 전용 장비 · 엔지니어 전용 개조부품만 장착할 수 있습니다';
  syncTurrets(run);
  const g = run.turretGear![ti];
  if (!g) return '포탑이 없습니다';
  if (isTurretMod(id)) {
    if (slot !== undefined && slot >= 0) return '개조부품은 포탑의 개조부품 칸에만 장착할 수 있습니다';
    const m = run.turretMods!;
    run.inventory.splice(invIdx, 1);
    if (m[ti]) run.inventory.push(m[ti]!);
    m[ti] = id;
    return null;
  }
  if (slot === -1) return '개조부품 칸에는 엔지니어 전용 개조부품만 장착할 수 있습니다';
  let k = slot !== undefined && slot >= 0 && slot < g.length ? slot : g.indexOf(null);
  if (k < 0) k = 0;
  run.inventory.splice(invIdx, 1);
  if (g[k]) run.inventory.push(g[k]!);
  g[k] = id;
  return null;
}
/** slot -1 = 개조부품 칸 */
export function unequipTurret(run: RunState, ti: number, slot: number): string | null {
  const cur = slot === -1 ? run.turretMods?.[ti] : run.turretGear?.[ti]?.[slot];
  if (!cur) return null;
  if (run.inventory.length >= CFG.inventoryMax) return '인벤토리 가득 참';
  run.inventory.push(cur);
  if (slot === -1) run.turretMods![ti] = null; else run.turretGear![ti][slot] = null;
  return null;
}
/** 포탑 장비를 다른 포탑 칸으로 (그 칸 장비와 맞교환). 칸 -1 = 개조부품 칸 (개조부품 칸끼리만) */
export function moveTurretGear(run: RunState, from: [number, number], to: [number, number]) {
  if (from[1] === -1 || to[1] === -1) {
    if (from[1] !== -1 || to[1] !== -1) return;
    const m = run.turretMods || [];
    if (from[0] >= m.length || to[0] >= m.length) return;
    [m[from[0]], m[to[0]]] = [m[to[0]], m[from[0]]];
    return;
  }
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
  recSpend(run, 'shop', s.price);
  s.sold = true;
  run.inventory.push(unixSwap(run, s.item));
  mergeCatwheels(run);
  return null;
}
/** 보관함 판매: 소모품만 (장비 · 개조부품은 팔 수 없다. 보관함이 가득 찬 채로 얻으면 gainItem 이 자동 판매) */
export function sellItem(run: RunState, invIdx: number) {
  const id = run.inventory[invIdx];
  if (!id || !isConsumable(id) || id === 'K_scope') return; // 표시 망원경은 항해자 전용 (팔 수 없음)
  run.credits += sellPrice(run, id);
  dropBread(run, invIdx);
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
  mergeCatwheels(run);
  return res;
}
/** 보관함 칸 둘을 조합하면 나올 장비 (조합 불가면 null). 유닉스제 대체 전 결과 — 확률은 unixChance */
export const combinePreview = (run: RunState, i: number, j: number) => (i !== j && run.inventory[i] && run.inventory[j] ? combine(run.inventory[i], run.inventory[j]) : null);
/** 절망 증강 [유닉스제 대량 생산]: 장비 id 를 새로 얻을 때 캣휠로 바뀔 확률 (해당 없으면 0) */
export const unixChance = (run: RunState, id: string) => (hasDespair(run, 'D.unix') && (ALL_ADVANCED.includes(id) || ALL_GRADED.includes(id)) ? CFG.despair.catwheel : 0);
/** 장비 id 를 기물 uid 에 장착할 수 있는지 (null = 가능). 보관함 밖의 장비(다른 기물에서 옮기는 장비)도 미리 확인한다 */
export function equipCheck(run: RunState, id: string | null | undefined, uid: string): string | null {
  const u = run.units.find((x) => x.uid === uid);
  if (!u || !id) return '대상 없음';
  if (isRock(u)) return '반려 돌은 장비를 달 수 없습니다';
  if (isConsumable(id)) return '소모품은 장착할 수 없습니다';
  if (isTurretGear(id)) return '포탑 전용 장비는 감시 포탑에만 장착할 수 있습니다';
  if (isTurretMod(id)) return '엔지니어 전용 개조부품은 감시 포탑에만 장착할 수 있습니다';
  if (isMod(id)) return isEmblem(id) && memberships(u).includes(emblemOf(id)) && u.mod !== id ? '이미 소속된 시너지의 문장입니다' : null;
  if (!u.items.includes(null) && !equipCombo(run, id, uid)) return '장비 슬롯이 가득 찼습니다 (3칸)';
  return null;
}
/** 장비 id 를 기물 uid 에 장착하면 조합될 칸과 결과 (조합 없으면 null): 빈 칸이 없으면 조합되는 장비, 있으면 같은 기물의 재료끼리 */
export function equipCombo(run: RunState, id: string, uid: string): { slot: number; res: string } | null {
  const u = run.units.find((x) => x.uid === uid);
  if (!u || isMod(id) || isRock(u)) return null;
  const k = u.items.includes(null) ? u.items.findIndex((x) => x && x[0] === 'C' && id[0] === 'C') : u.items.findIndex((x) => x && combine(x, id));
  const res = k >= 0 ? combine(u.items[k]!, id) : null;
  return res ? { slot: k, res } : null;
}
export function equip(run: RunState, invIdx: number, uid: string): string | null {
  const id = run.inventory[invIdx];
  const err = equipCheck(run, id, uid);
  if (err) return err;
  const u = run.units.find((x) => x.uid === uid)!;
  // 개조부품은 전용 칸으로 (이미 있으면 맞교환)
  if (isMod(id)) {
    run.inventory.splice(invIdx, 1);
    if (u.mod) run.inventory.push(u.mod);
    u.mod = id;
    return null;
  }
  // 조합되는 장비가 있으면 그 칸에서 조합 (빈 칸이 없을 때 · 같은 기물의 재료끼리), 아니면 빈 칸에
  const cb = equipCombo(run, id, uid);
  if (cb) u.items[cb.slot] = unixSwap(run, cb.res);
  else u.items[u.items.indexOf(null)] = id;
  run.inventory.splice(invIdx, 1);
  mergeCatwheels(run);
  return null;
}
/** 분리 용제 규칙 (CFG.solventFrom 이상): 기물 uid 의 칸 slot 장비를 떼어 내려면 분리 용제 1개가 드는지 (개조부품 · 고유 장비는 무료 · 불가) */
export function solventNeed(run: RunState, uid: string, slot: number): boolean {
  const u = run.units.find((x) => x.uid === uid);
  return slot >= 0 && (run.diff || 0) >= CFG.solventFrom && !!u?.items[slot] && !isLocked(u.items[slot]);
}
export const solventLeft = (run: RunState) => run.inventory.filter((x) => x === 'K_strip').length;
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
  // 분리 용제 규칙: 용제 1개를 쓰고 그 자리에 장비가 들어온다 (보관함이 가득 차도 된다)
  const pay = solventNeed(run, uid, slot), k = pay ? run.inventory.indexOf('K_strip') : -1;
  if (pay && k < 0) return '분리 용제가 없어 장비를 옮길 수 없습니다';
  if (run.inventory.length - (pay ? 1 : 0) >= CFG.inventoryMax) return '인벤토리 가득 참';
  if (pay) run.inventory.splice(k, 1);
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
/** 공명 등급 rank 까지 쌓은 공명도 (1등급부터 + 지금 등급의 xp) */
export function investedXp(rank: number, xp = 0) {
  let n = xp;
  for (let r = 1; r < rank; r++) n += CFG.xpToNext(r);
  return n;
}
/** 가치 환산 (크레딧 기준, CFG.supply 주석): 공명도 1 = 직접 구매 단가, 장비 = 상점 기본가 */
export const XP_VALUE = CFG.buyXpCost / CFG.buyXpAmount;
export const gearValue = (id: string) => CFG.price[itemInfo(id).tier] ?? CFG.price.C;
export const supplyValue = (c: Pick<SupplyCard, 'credits' | 'xp' | 'items'>) => c.credits + c.xp * XP_VALUE + c.items.reduce((s, id) => s + (isInjector(id) ? injectAmount(id) * XP_VALUE : CFG.shop.price[id] ?? gearValue(id)), 0);
/** 분리 용제가 나오는 런인지: 고난(solventFrom) 이상 일반 런만. 모험 이하 · 캠페인은 분리 용제를 주지 않고 그 몫을 공명도로 준다 (보급 마지막 칸 · 전투 소모품 · 상점) */
export const solventOn = (run: RunState) => !run.campaign && (run.diff || 0) >= CFG.solventFrom;
/** 갓 영입한 rank 등급 기물을 바로 방출할 때 받는 환급 가치 (releaseValue 와 같은 식) */
export function releaseGain(rank: number) {
  return CFG.release.base + CFG.release.perRank * rank + Math.round(investedXp(rank) * CFG.release.xpShare) * XP_VALUE;
}
/** 보급 기준 가치 (valueCards 장 합계): max(페이즈 하한, 지금 영입할 기물을 바로 방출한 환급 × ratio) */
export const supplyBase = (run: RunState) => Math.max(CFG.supply.floor(run.phase), releaseGain(recruitRank(run)) * CFG.supply.ratio);
/** 장비 카드: 가치 v 를 가장 가까운 두 등급(상점 기본가) 사이에서 확률로 (기대 가치 = v, 범위 밖이면 끝 등급). 전설은 대박 카드만 (legendFrom 페이즈부터) */
function supplyGear(run: RunState, r: Rng, v: number, jackpot: boolean): string {
  const S = CFG.supply, P = CFG.price;
  const steps: ['C' | 'U' | 'L', number][] = [['C', P.C], ['U', Math.min(P.G, P.A)], ...(jackpot && run.phase >= S.legendFrom ? [['L', P.L] as ['L', number]] : [])];
  let t = steps[0][0];
  for (let i = 0; i < steps.length; i++) {
    if (v < steps[i][1]) { if (i > 0) t = r.chance((v - steps[i - 1][1]) / (steps[i][1] - steps[i - 1][1])) ? steps[i][0] : steps[i - 1][0]; break; }
    t = steps[i][0];
  }
  if (t === 'C' && jackpot) return r.chance(S.jackpotInject) ? 'K_xp2' : r.chance(S.graded) ? r.pick(ALL_GRADED) : r.pick(ALL_ADVANCED); // 대박(×1.5 · ×2): 재료 대신 최소 고급 · 희귀 또는 중형 공명 주입기
  if (t === 'C') return r.pick(ALL_COMPONENTS);
  if (t === 'L') return 'L_' + r.pick(ALL_ADVANCED).slice(2);
  return r.chance(S.graded) ? r.pick(ALL_GRADED) : r.pick(ALL_ADVANCED);
}
/** 보급품 카드 (뒷면): 장마다 종류 무작위 (겹쳐도 됨), 가치 = 기준 ÷ valueCards × (1 ± spread) × 대박 배율.
 *  마지막 장은 장비 정비 소모품 확정: 분리 용제 · 재구성 회로 중 하나 (분리 용제가 안 나오는 런이면 그 몫은 공명도 카드) */
export function genSupply(run: RunState, onMap = false): SupplyCard[] {
  const S = CFG.supply, per = supplyBase(run) / S.valueCards;
  const kinds = Object.keys(S.kindW) as SupplyCard['kind'][];
  const total = kinds.reduce((s, k) => s + S.kindW[k], 0);
  // 항로 보급 (onMap): 첫 장은 장비 재료 확정, 대박 없음
  return rng(run, (r) => Array.from({ length: S.cards }, (_, i): SupplyCard => {
    if (i === S.cards - 1) {
      const id = r.pick(['K_strip', 'K_reroll']);
      const c: SupplyCard = id === 'K_strip' && !solventOn(run)
        ? { kind: 'xp', xp: Math.max(1, Math.round(per / XP_VALUE)), credits: 0, items: [], value: 0, mult: 1 }
        : { kind: 'gear', xp: 0, credits: 0, items: [id], value: 0, mult: 1 };
      c.value = supplyValue(c);
      return c;
    }
    let roll = r.next() * total;
    const kind = onMap && i === 0 ? 'gear' : kinds.find((k) => (roll -= S.kindW[k]) < 0) ?? kinds[0];
    const mult = onMap ? 1 : S.jackpot.find(([, p]) => r.chance(p))?.[0] ?? 1;
    const v = per * (1 + (r.next() * 2 - 1) * S.spread) * mult;
    const c: SupplyCard = { kind, xp: 0, credits: 0, items: [], value: 0, mult };
    if (kind === 'credits') c.credits = Math.max(1, Math.round(v));
    else if (kind === 'xp') c.xp = Math.max(1, Math.round(v / XP_VALUE));
    else c.items = [onMap && i === 0 ? r.pick(ALL_COMPONENTS) : supplyGear(run, r, v, mult > 1)];
    c.value = supplyValue(c);
    return c;
  }));
}
/** 보급품 카드 i 뒤집기 (화면 · 봇 공용): 뒤집는 순간 받는다. 공명도는 공명도 풀처럼 파티에 분배 */
export function flipSupply(run: RunState, p: Extract<Pending, { t: 'supply' }>, i: number) {
  const c = p.options[i];
  if (!c || c.open) return;
  c.open = true;
  run.credits += c.credits;
  for (const id of c.items) gainItem(run, id);
  if (c.xp) { distributeXp(run, c.xp); run.units.forEach((u) => settleXp(run, u)); }
  log(run, `보급${c.mult > 1 ? ` (대박 ×${c.mult})` : ''}: ${c.credits ? `크레딧 +${c.credits}` : c.xp ? `공명도 ${c.xp} 분배` : c.items.map((id) => itemInfo(id).name).join(', ')}`);
}
/** 남은 보급품 카드를 모두 뒤집는다 (봇 · 모두 뒤집기) */
export const flipAllSupply = (run: RunState, p: Extract<Pending, { t: 'supply' }>) => p.options.forEach((_, i) => flipSupply(run, p, i));
/** 영입 · 합류 등급: max(페이즈 - 1, 출전 기물 평균 등급 × k) */
export function joinRank(run: RunState): number {
  const dep = run.units.filter((u) => u.pos && !isRock(u));
  const avg = dep.length ? dep.reduce((s, u) => s + u.rank, 0) / dep.length : 1;
  if (run.campaign) return Math.min(CFG.maxRank, Math.max(1, Math.round(avg))); // 캠페인: 이야기로 합류하는 주연은 출전 평균 등급으로
  return Math.min(CFG.maxRank, Math.max(1, run.phase - 1, Math.round(avg * CFG.joinRankRatio)));
}
/** 지금 영입하면 합류할 공명 등급 (전역 증강 정찰망 +1) */
export const recruitRank = (run: RunState) => Math.min(CFG.maxRank, joinRank(run) + (hasGlobal(run, 'G.scout') ? 1 : 0));
export function recruit(run: RunState, defId: string) {
  const rank = UNIT_BY_ID[defId].inert ? 1 : recruitRank(run); // 반려 돌은 등급 1
  addUnit(run, defId, rank);
  autoPlace(run);
  if (run.picked[run.step - 1] === 'recruit') (run.nodeUnits ??= {})[run.step - 1] = defId; // 타임라인 표시용
  log(run, `${UNIT_BY_ID[defId].name} 합류 (공명 ${rank})`);
}

/** 마이너 능력치 보상 확정 (화면 · 봇 공용). 대성공이면 고른 능력치 상승량이 2배 (화면은 확정 때 황금 광 · '대성공' 표시 뒤 닫는다).
 *  반환: false = 잘못된 선택, true = 끝 (allocDone) */
export function allocRank(run: RunState, p: Extract<Pending, { t: 'rankup' }>, picks: Major[]): boolean {
  if (p.allocDone || !applyRankPicks(run, p.uid, picks, p.points * (p.great ? 2 : 1))) return false;
  if (p.great) {
    const u = run.units.find((x) => x.uid === p.uid);
    log(run, `대성공! ${u ? UNIT_BY_ID[u.defId].name : ''} 능력치 상승량 2배`);
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
      // 유형별 증강 계약: 메이저 전용 증강 · 사이오닉 전공 증강 · 디바인 서약 증강 (스페셜은 대상 아님). ★ 전설은 성장 선택으로만 얻는다
      const cands = run.units.flatMap((u) => {
        const k = typeAugKind(u);
        if (!k || !augRoom(u, k)) return [];
        return augPoolOf(u, k).filter((a) => !a.roll && !isLegendAug(a.id) && !u.augments.some((p) => p.id === a.id)).map((a) => ({ u, a }));
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
  recSpend(run, 'invest', o.cost);
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
  for (const p of run.pending) if (p.t === 'supply' && p.options.some((o) => typeof o !== 'object')) p.options = genSupply(run); // 옛 보급 (선택지 이름 문자열) → 뒷면 카드
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
  const cr0 = run.credits;
  const msg = c.apply(run, api);
  recSpend(run, 'event', cr0 - run.credits); // 사건으로 낸 크레딧 (보고서)
  lastOutcome = outKey;
  run.inventory = run.inventory.filter(Boolean); // 사건 중 비운 칸 정리
  const follow = run.pending.splice(before);
  // 결과 장면: 연출의 after[선택지] (키별이면 outcome 키)
  const aft = EVENT_SCENES[ev.id]?.after?.[idx];
  const beats = !aft ? null : Array.isArray(aft) ? aft : aft[outKey] ?? aft.default ?? null;
  const scene = beats ? resolveScene(beats, undefined, null, { ...sceneVars(p.sub), ...vars }, run.flags) : undefined;
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
/** 사건 본문 장면 (연출이 없으면 text 를 서술 한 줄로). flags = 런 깃발 (앞선 조사를 기억하는 줄 · Beat.if) */
export function eventScene(p: { id: string; sub?: string | null }, flags: readonly string[] = []): Beat[] {
  const sc = EVENT_SCENES[p.id];
  if (!sc) return [{ text: EVENT_BY_ID[p.id]?.text || '' }];
  return resolveScene(sc.scene, sc.subs, p.sub, sceneVars(p.sub), flags);
}

// ───────────────────────── 기물 방출
/** 방출 보상 미리보기: 쌓은 공명도의 일부(CFG.release)를 남은 파티에, 크레딧 base + 등급 × perRank, 장비 · 개조부품 반환 */
export function releaseValue(run: RunState, u: UnitState) {
  const invested = investedXp(u.rank, u.xp);
  const items = [...u.items.filter((x): x is string => !!x && !isLocked(x)), ...(u.mod ? [u.mod] : [])];
  const lost = u.items.filter((x): x is string => !!x && isLocked(x));
  if (isRock(u)) return { xp: 0, credits: 0, items, lost, invested: 0 }; // 반려 돌: 보상 없이 사라진다
  return { xp: Math.round(invested * CFG.release.xpShare), credits: CFG.release.base + u.rank * CFG.release.perRank, items, lost, invested };
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
  u.enhKept = false;
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
  // 강화 · 다음 전투 한정 효과는 이번 전투로 끝 (서약 증강 [축성의 서약]: 강화가 한 전투 더 남는다, data/oathaugs.ts)
  for (const u of run.units) {
    if (u.enh && !u.enhKept && u.augments.some((a) => a.id === VOW_ENH_KEEP)) u.enhKept = true;
    else { u.enh = false; u.enhKept = false; }
  }
  run.mods.divStart = 0;
  pw = Math.min(CFG.powerMax, pw);
  if (pw) { run.power += pw; lines.push(`권능 포인트 +${pw} (현재 ${run.power})`); }
}
