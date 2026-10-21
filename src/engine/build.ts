import { CFG, encDmgMult, phaseAmpMult, phaseHpMult } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { ENEMY_BY_ID, ENEMY_RT, type EnemyDef, setSummonHook } from '../data/enemies';
import { fieldOf } from '../data/battlefields';
import { diffHas } from '../data/difficulty';
import { oathEnemy, oathV } from '../data/oaths';
import { BOONS } from '../data/events';
import { BLESSING_BY_ID, GLOBAL_BY_ID } from '../data/globals';
import { DESPAIR_BY_ID } from '../data/despair';
import { ALL_GRADED, emblemOf, isEmblem, isTurretGear, isTurretMod, itemEffect, turretSlots } from '../data/items';
import { CHR_HOOK, ENG_HOOK, ENG_TUR, KAL_GUARD_RANK, KAL_HOOK, rankTitle, SYN_BY_ID, SYNERGIES, type SynDef, tierOf } from '../data/synergies';
import { CAMP_SYNERGIES, campMembers } from '../data/campaign';
import { causalStage, KING, kingGearOf } from '../data/chungra';
import { UNIT_BY_ID } from '../data/units';
import { enableDivine, ENEMY_PSI, FAITH_DEF, sigmundTarget } from '../data/rework';
import { DEFAULT_RELIC } from '../data/relics';
import { DEV, deviceCells, type Device, mineDmg, netCells, scopeR, strikeDmg, wallCells, wallHp } from '../data/devices';
import { mapOf, TERRAIN, type TCell, terrainOf } from '../data/maps';
import { ULTS } from '../data/ults';
import { SUMMON_RT, type SummonDef } from '../data/unitkit';
import type { SkillDef } from './combat';
import { Rng } from '../rng';
import { categoryOf, type EnemySpawn, type Geo, type MapOpt, type Major, MAJORS, type RunState, type Stats, emptyStats, type SynergyId, type UnitState, type Encounter } from '../types';
import { Battle, type CUnit, T_NOSHOT } from './combat';
import { applyLive, type Effect, type EffectCtx, red } from './effects';

export type Counts = Partial<Record<SynergyId, number>>;
/** 마이너 성장으로 커지는 기술 계수 (위력 · 회복 · 보호막 · 출혈 · 1원칙 중첩) */
export const MINOR_SKILL_KEYS = ['mult', 'heal', 'shield', 'famShield', 'bleed', 'growth'];

/** 전장 구조: 바깥 테두리 PAD · 적 진형 ZONE · 간격 GAP · 아군 진형 ZONE · 테두리 PAD (세로), 가로는 배치 폭 W + 테두리 */
export const ZONE = 3, GAP = 1, PAD = 1;
export const playerRows = (_n?: number) => ZONE;
export const boardDims = (W: number) => ({ w: W + 2 * PAD, h: 2 * ZONE + GAP + 2 * PAD });
/** 아군 진형 세로 범위 (전장 좌표) */
export const ALLY_Y0 = PAD + ZONE + GAP, ALLY_Y1 = ALLY_Y0 + ZONE - 1;
/** 전장 칸 구조: 지형 틀(data/maps.ts)의 사이 줄 수 · 포위(아래 적 진형) · 통로 폭을 반영. 저장 배치 (c, r) 는 지형과 무관 (r = 아군 진형 뒷줄부터) */
export function geoOf(n: number, map?: string, opt?: MapOpt): Geo {
  const m = mapOf(map), gap = m.gap ?? GAP, rows = m.allyRows ?? ZONE;
  const ay0 = PAD + ZONE + gap, ay1 = ay0 + rows - 1;
  const foe2 = m.surround ? ay1 + 1 + gap : 0;
  return { n, w: n + 2 * PAD, h: (foe2 ? foe2 + ZONE : ay1 + 1) + PAD, x0: PAD, ay0, ay1, rows, foe2, map: m.id, ...(m.rot ? { rot: true } : {}), ...(opt ? { opt } : {}) };
}
/** 조우의 지형 선택 (편성 화면: 연결교 접기 · 크레인) → 칸 구조에 싣는다 (terrainOf 가 읽는다) */
export const mapOptOf = (enc: Encounter | null | undefined): MapOpt | undefined =>
  enc && (enc.bridgeFold || (enc.crane && Object.keys(enc.crane).length)) ? { ...(enc.bridgeFold ? { fold: true } : {}), ...(enc.crane ? { crane: { ...enc.crane } } : {}) } : undefined;
/** 화면 칸 ↔ 전장 칸 (UI 공용). 가로 지형(rot)은 전장을 시계 방향 90° 돌려 그린다: 전장 (x, y) → 화면 (h-1-y, x). 위 적 진형 → 오른쪽, 아래 → 왼쪽 */
type RotG = { h: number; rot?: boolean } | null | undefined;
export const toScr = (g: RotG, x: number, y: number) => (g?.rot ? { x: g.h - 1 - y, y: x } : { x, y });
export const fromScr = (g: RotG, sx: number, sy: number) => (g?.rot ? { x: sy, y: g.h - 1 - sx } : { x: sx, y: sy });
/** 전장 사각형 (왼쪽 위 x, y · 폭 w · 높이 h, 칸 단위) → 화면 사각형 */
export const rectScr = (g: RotG, x: number, y: number, w: number, h: number) => (g?.rot ? { x: g.h - y - h, y: x, w: h, h: w } : { x, y, w, h });
/** 화면 가로 · 세로 칸 수 */
export const scrDims = (g: { w: number; h: number; rot?: boolean }) => (g.rot ? { w: g.h, h: g.w } : { w: g.w, h: g.h });
/** 이번 조우의 칸 구조 (조우가 없으면 기본 보드) */
export const encGeo = (enc: Encounter | null | undefined, n = enc?.n ?? CFG.bossBoard) => geoOf(n, enc?.map, mapOptOf(enc));
export const runGeo = (run: RunState, n = run.node?.enc?.n ?? CFG.bossBoard) => geoOf(n, run.node?.enc?.map, mapOptOf(run.node?.enc));
/** 적 배치(c, row) → 전장 좌표 (포위 지형의 아래 진형은 뒷줄 row 0 이 맨 아래) */
export const enemyCell = (c: number, row: number, W: number, g?: Geo, flip?: boolean) => {
  const x = PAD + Math.min(c, W - 1), r = Math.min(row, ZONE - 1);
  return { x, y: flip && g?.foe2 ? g.foe2 + ZONE - 1 - r : PAD + r };
};
export const foeCell = (s: EnemySpawn, g: Geo) => enemyCell(s.c, s.row, g.n, g, s.flip);
/** 전장 좌표 → 저장 배치 (c, r): r=0 이 맨 뒷줄 */
export const toPos = (x: number, y: number, g?: Geo) => ({ c: x - PAD, r: (g?.ay1 ?? ALLY_Y1) - y });

/** 편성 칸 구역: 적 진형 · 아군 진형 · 사이 · 바깥 테두리 (배치형 소모품이 놓일 수 있는 곳을 가린다) */
export function zoneAt(g: Geo, x: number, y: number): 'foe' | 'ally' | 'mid' | 'edge' {
  if (x < PAD || x >= g.w - PAD || y < PAD || y >= g.h - PAD) return 'edge';
  return y < PAD + ZONE || (g.foe2 && y >= g.foe2) ? 'foe' : y >= g.ay0 && y <= g.ay1 ? 'ally' : 'mid';
}
export function deployed(run: RunState) { return run.units.filter((u) => u.pos); }

/** 기물이 소속된 시너지 (세력 + 특성 + 증강으로 얻은 추가 소속) */
export function memberships(u: UnitState, run?: RunState | null): SynergyId[] {
  if (run?.campaign) return campMembers(u.defId); // 캠페인: 전용 소속표만 (증강 · 문장 추가 소속 없음)
  const d = UNIT_BY_ID[u.defId];
  const s = new Set<SynergyId>([...d.factions, ...d.traits]);
  if (run && sigmundTarget(run) === u.uid) s.add('FAM'); // 시그문드가 모시는 기물
  for (const a of u.augments) {
    const e = AUG_BY_ID[a.id]?.effect(a.param);
    e?.extraSyn?.forEach((x) => s.add(x));
  }
  if (u.mod && isEmblem(u.mod)) s.add(emblemOf(u.mod)); // 문장 개조부품
  return [...s];
}

/** raw: 예전 증표 규칙용 인자 (현재는 차이 없음) */
export function synergyCounts(units: UnitState[], run?: RunState | null, raw = false): Counts {
  const seen = new Set<string>();
  const c: Counts = {};
  for (const u of units) {
    if (seen.has(u.defId)) continue; // 같은 기물은 1회만 집계
    seen.add(u.defId);
    for (const s of memberships(u, run)) c[s] = (c[s] || 0) + 1;
  }
  if (run && !run.campaign) {
    // 연합 협정 / 전술 교범: 인원이 가장 많은 세력 / 특성 +1
    const top = (kind: 'faction' | 'trait') => SYNERGIES.filter((s) => s.kind === kind && s.tiers.length > 1 && (c[s.id] || 0) > 0)
      .sort((a, b2) => (c[b2.id] || 0) - (c[a.id] || 0))[0];
    if (run.globals.includes('G.faction')) { const t = top('faction'); if (t) c[t.id]! += 1; }
    if (run.globals.includes('G.trait')) { const t = top('trait'); if (t) c[t.id]! += 1; }
  }
  // 공왕: 청라공국이 켜져 있으면 무휼(출전 칸 밖)이 소환되므로 1명으로 센다 (청라 인원에는 넣지 않는다)
  if (run && tierOf('CHR', c.CHR || 0) >= 1) c.KING = 1;
  void raw; // (구) 최종 단계 증표 규칙은 제거됨
  return c;
}

/** 이 런에서 쓰는 시너지 목록: 캠페인 런 = 캠페인 전용, 그 밖 = 일반 표 */
export const synList = (run?: RunState | null): SynDef[] => (run?.campaign ? CAMP_SYNERGIES : SYNERGIES);

export function activeTiers(counts: Counts, run?: RunState | null): Partial<Record<SynergyId, number>> {
  const t: Partial<Record<SynergyId, number>> = {};
  for (const s of synList(run)) { const v = tierOf(s.id, counts[s.id] || 0); if (v) t[s.id] = v; }
  return t;
}

export function makeCtx(run: RunState | null, unit: UnitState | null, counts: Counts): EffectCtx {
  return { run, unit, counts, phase: run?.phase || 1, credits: run?.credits || 0 };
}

/** 기물 하나에 적용되는 모든 효과 */
export function unitEffects(run: RunState | null, u: UnitState, counts: Counts, onBoard: boolean): Effect[] {
  const out: Effect[] = [];
  const d = UNIT_BY_ID[u.defId];
  if (d.passive) out.push(d.passive);
  if (d.trait.effect) out.push(d.trait.effect);
  if (d.ttype === 'psionic' && d.psi) out.push(d.psi.effect);
  if (d.ttype === 'divine') out.push(FAITH_DEF[u.faith || d.faith].passive); // 고유 신앙 상시 버프
  // 시그문드: 모시는 기물이 원래 엘베스타드면 모든 메이저 +5
  if (run && sigmundTarget(run) === u.uid && d.factions.includes('FAM')) {
    const sg = run.units.find((x) => x.defId === 'sigmund');
    const m = Math.round(5 * CFG.minorGrow(sg?.rank || 1)); // 시그문드 성장 반영
    out.push({ majors: { vit: m, pow: m, mnd: m, def: m, agi: m } });
  }
  for (const a of u.augments) { const d = AUG_BY_ID[a.id]; if (d) out.push(d.effect(a.param)); }
  for (const it of u.items) if (it) out.push(itemEffect(it, u.defId));
  if (u.mod) out.push(itemEffect(u.mod)); // 신비 개조부품 · 문장 (고유 효과, data/emblems.ts)
  if (onBoard) {
    const ctx = makeCtx(run, u, counts);
    const mine = new Set(memberships(u, run));
    for (const s of synList(run)) {
      if (s.special && mine.has(s.id)) { const e = s.special(counts[s.id] || 0, ctx); if (e) out.push(e); }
      const tier = tierOf(s.id, counts[s.id] || 0);
      if (!tier) continue;
      if (s.team) { const e = s.team(tier, ctx); if (e) out.push(e); }
      if (s.member && mine.has(s.id)) { const e = s.member(tier, ctx); if (e) out.push(e); }
    }
    for (const g of run?.globals || []) { const e = GLOBAL_BY_ID[g]?.team; if (e) out.push(e); }
    for (const d of run?.despairs || []) { const e = DESPAIR_BY_ID[d]?.ally?.(); if (e) out.push(e); } // 절망 증강: 아군 디버프
    if (run?.blessing) { const e = BLESSING_BY_ID[run.blessing]?.team; if (e) out.push(e); }
    for (const id of [...(run?.boons || []), ...(run?.phaseBoons || [])]) { const e = BOONS[id]?.effect; if (e) out.push(e); } // 사건 효과
    const fa = run && !run.campaign ? fieldOf(run.field).ally : undefined; // 전장 세력 보너스 (캠페인은 전용 시너지만)
    if (fa && mine.has(fa.syn)) out.push(fa.effect);
    if (run?.flags.includes('cp_purge')) out.push({ taken: [red('chem', 0.4)] }); // 소모품 정화 분무기 (캠페인에서 들여옴): 다음 전투 화학 피해 -40%
    const fall = run ? fieldOf(run.field).allyAll : undefined; // 전장: 모든 아군
    if (fall) out.push(fall);
  }
  return out;
}

export function totalMajors(u: UnitState, effects: Effect[]): Record<Major, number> {
  const d = UNIT_BY_ID[u.defId];
  const m = {} as Record<Major, number>;
  for (const k of MAJORS) {
    let v = d.base[k] + u.alloc[k] + u.perm[k];
    for (const e of effects) v += e.majors?.[k] || 0;
    m[k] = Math.max(0, v);
  }
  return m;
}

export function computeStats(u: UnitState, effects: Effect[]): { st: Stats; majors: Record<Major, number> } {
  const d = UNIT_BY_ID[u.defId];
  const m = totalMajors(u, effects);
  const st = emptyStats();
  Object.assign(st, CFG.baseMinor);
  st.moveSpd = CFG.unitMoveSpd;
  st.range = d.range;
  for (const k of MAJORS) {
    const conv = CFG.conv[k] as Partial<Stats>;
    for (const [sk, per] of Object.entries(conv)) st[sk as keyof Stats] += per! * m[k];
  }
  const pct: Partial<Record<keyof Stats, number>> = {};
  for (const e of effects) {
    if (e.stats) for (const [k, v] of Object.entries(e.stats)) st[k as keyof Stats] += v as number;
    if (e.pct) for (const [k, v] of Object.entries(e.pct)) pct[k as keyof Stats] = (pct[k as keyof Stats] || 0) + (v as number);
  }
  for (const [k, v] of Object.entries(pct)) st[k as keyof Stats] *= Math.max(0.1, 1 + v!);
  st.range = Math.max(1, Math.round(st.range));
  // 공명 등급 독립 성장: 사격 · 타격 · 기술 위력 등급당 ×1.025 (곱연산)
  const rb = effects.reduce((s, e) => s + (e.rankBonus || 0), 0);
  const grow = Math.pow(CFG.rankPowGrowth, Math.max(0, u.rank + rb - 1));
  st.shoot *= grow; st.strike *= grow; st.tech *= grow;
  return { st, majors: m };
}

/** 저장된 배치(c, r)를 배치 폭 W 전장의 실제 좌표로 */
export function boardPos(pos: { c: number; r: number }, W: number, g?: Geo) {
  return { x: PAD + Math.max(0, Math.min(pos.c, W - 1)), y: (g?.ay1 ?? ALLY_Y1) - Math.max(0, Math.min(pos.r, (g?.rows ?? ZONE) - 1)) };
}

/** 분류 확정 + 분류 기본 보정 (영혼 회피 +10%p, 구조물 방어도 ×1.3) */
export function applyCategory(c: CUnit) {
  c.category = categoryOf(c.keywords, c.immobile);
  if (c.category === 'soul') c.st.eva += 0.1;
  if (c.category === 'struct') { c.st.armor *= 1.3; c.immobile = true; }
}

function blankUnit(side: 0 | 1): CUnit {
  return {
    id: 0, side, defId: '', name: '', sprite: 'soldier', palette: [], x: 0, y: 0, px: 0, py: 0, moveT: 0, moveDur: 0,
    hp: 1, shield: 0, st: emptyStats(), atk: { type: 'strike', elem: 'phys', interval: 1 }, atkTimer: 0, cd: 0, cdMax: 0,
    skill: null, sk: {}, statuses: [], mods: [], taken: [], hooks: [], keywords: [], category: 'bio', synergies: new Set(), target: null,
    alive: true, isBoss: false, isSummon: false, immobile: false, phaseAmp: 1,
    counters: { dmg: 0, taken: 0, healed: 0, kills: 0, casts: 0, shield: 0, elem: {} }, mem: {},
    weapon: null, ammo: 0, reloadT: 0, combo: 0, reason: null, div: null, divGot: 0, divCap: 0, divUsed: false,
    school: null, cantrip: null, cantripCd: 0, cantripMax: 0,
  };
}

export function buildAlly(b: Battle, run: RunState | null, u: UnitState, counts: Counts): CUnit {
  const d = UNIT_BY_ID[u.defId];
  const effects = unitEffects(run, u, counts, true);
  const { st, majors } = computeStats(u, effects);
  const c = blankUnit(0);
  Object.assign(c, {
    defId: d.id, name: d.name, sprite: d.sprite, palette: d.palette, st, keywords: d.keywords.slice(),
    atk: { ...d.atk }, skill: d.skill, sk: { ...d.skill.params }, cdMax: d.skill.cd, src: u,
    synergies: new Set(memberships(u, run)),
    weapon: { ...d.weapon }, ctype: d.ctype, ttype: d.ttype, faith: u.faith || d.faith,
  });
  if (c.synergies.has('GUARD') && !tierOf('GUARD', counts.GUARD || 0)) c.mem.guardOff = 1; // 도발 배율: 수호자 시너지가 꺼져 있으면 수호자 가산 없음
  c.mem.mnd = majors.mnd;
  if (d.inert) { c.immobile = true; c.noAttack = true; c.skill = null; c.mem.inert = 1; c.mem.invulnUntil = Infinity; } // 반려 돌 (절망 증강): 공격 · 이동 · 기술 없이 칸만 차지 (표적 · 승패 판정에서 빠지고, 범위 피해도 받지 않음)
  applyCategory(c);
  if (d.weapon.kind === 'none') c.noAttack = true;
  const p = boardPos(u.pos!, b.w - 2 * PAD, b.geo);
  c.x = c.px = p.x; c.y = c.py = p.y;
  c.mem.title = rankTitle(u.rank + effects.reduce((s, e) => s + (e.rankBonus || 0), 0)) + effects.reduce((s, e) => s + (e.title || 0), 0);
  // 마이너: 공명 등급에 따라 기술 계수 · 특성 수치 성장 (특성은 gw(u) 로 참조)
  if (d.ttype === 'minor') {
    const g = CFG.minorGrow(u.rank);
    c.mem.grow = g;
    for (const k of MINOR_SKILL_KEYS) if (typeof c.sk[k] === 'number') c.sk[k] *= g;
  }
  const ctx = makeCtx(run, u, counts);
  for (const e of effects) {
    if (e.mods) c.mods.push(...e.mods);
    if (e.taken) c.taken.push(...e.taken);
    if (e.hooks) c.hooks.push(e.hooks);
  }
  for (const e of effects) e.setup?.(c, b, ctx);
  c.cdMax = Math.max(1, c.cdMax);
  c.cd = c.cdMax * 0.5;
  if (d.ttype === 'psionic') c.reason = Math.min(100, CFG.reasonStart + (c.mem.reasonStart || 0));
  if (d.ttype === 'divine') {
    enableDivine(c, c.faith!, run?.divCap || 0);
    c.relic = u.relic || DEFAULT_RELIC[d.id];
    if (u.enh) c.mem.enh = 3; // 신권 대행 강화 (다음 전투 한정)
    c.div = Math.min(100, (c.div || 0) + (run?.mods.divStart || 0)); // 순례자의 기도
    if (run?.mods.divGain) c.mem.divBoost = (c.mem.divBoost || 0) + run.mods.divGain; // 성인 기념일
  }
  if (d.ttype === 'major' && ULTS[d.id]) { c.ult = ULTS[d.id]; c.ultG = Math.min(1, CFG.ultStart + (c.mem.ultStart || 0)); } // 메이저 궁극기
  const sd = d.summon;
  if (sd) c.hooks.push({ onStart: (bb, self) => spawnSummons(bb, self, sd) });
  return c;
}

/** 최고의 친구 소환물의 기본 상속률 (소환물별 rate 배율 · 추가 소환 배율 전): 시너지 단계 (mem.bond, 시너지가 꺼져 있으면 CFG.bond.base)
 *  + 특성 · 증강 가산 (mem.bondBonus), 상한 CFG.bond.cap */
export const summonBond = (owner: CUnit) => Math.min(CFG.bond.cap, (owner.mem.bond || CFG.bond.base) + (owner.mem.bondBonus || 0));
export interface SummonMade { sd: SummonDef; unit: CUnit; rate: number; extra: boolean }
/** 최고의 친구: 주인 스탯 일부를 물려받는 소환물을 만든다 (배치 전). 전투 시작 때 spawnSummons 가 부르고,
 *  기물 상세의 소환물 섹션도 같은 함수로 미리보기를 만든다 (rate = 실제 상속률, extra = 추가로 불린 2번째 이후 소환물) */
export function makeSummons(owner: CUnit, sd0: SummonDef): SummonMade[] {
  const n = owner.mem.noSummon ? 0 : 1 + (owner.mem.extraSummon || 0);
  const base = summonBond(owner);
  // 첫 소환물 n기 + 함께 소환되는 다른 소환물 (라스무스: 맥스 + 라라) 각 1기
  const list: { sd: SummonDef; i: number }[] = [...Array(Math.max(0, n)).keys()].map((i) => ({ sd: sd0, i }));
  if (n > 0) for (const x of sd0.also || []) list.push({ sd: x, i: 0 });
  // 추가 소환물 배율: 기본 CFG.bond.extra, 주인이 따로 정하면 그 값 (라르스: 추가 경호원은 첫 경호원 능력치의 50% — 상속 스탯 · 주요 능력치 보너스 · 방어도 보너스 모두)
  const own = owner.mem.extraRate;
  return list.map(({ sd, i }) => {
    const r = (i === 0 ? base : base * (own ?? CFG.bond.extra)) * (sd.rate || 1); // 추가 소환물은 상속률 ×CFG.bond.extra
    const flat = i > 0 && own !== undefined ? own : 1; // 고정 보너스도 같은 비율로
    const s = blankUnit(owner.side);
    const o = owner.st;
    const st = emptyStats();
    st.maxHp = o.maxHp * r * (sd.hpMul || 1);
    st.shoot = o.shoot * r; st.strike = o.strike * r; st.tech = o.tech * r;
    st.armor = o.armor * r + (owner.mem.summonArmor || 0) * flat;
    st.acc = o.acc; st.crit = o.crit; st.critDmg = o.critDmg; st.effHit = o.effHit; st.effRes = o.effRes; st.eva = o.eva;
    st.moveSpd = sd.moveSpd || 1.15; st.range = sd.range;
    st.maxHp *= (1 + (owner.mem.summonHpPct || 0)) * (owner.mem.summonHpMul || 1);
    // 라르스: 경호원 메이저 보너스
    const gm = (owner.mem.summonMaj || 0) * flat;
    if (gm) for (const k of MAJORS) for (const [sk, per] of Object.entries(CFG.conv[k])) st[sk as keyof Stats] += (per as number) * gm;
    Object.assign(s, {
      defId: 'summon', name: sd.name, sprite: sd.sprite, palette: sd.palette, art: sd.art, st, atk: { ...sd.atk },
      keywords: sd.struct ? ['struct'] : sd.sprite === 'drone' ? ['mech'] : ['bio'], isSummon: true, owner, immobile: !!sd.struct,
      mods: [
        ...(owner.mem.bondAmp ? [{ kind: 'inc' as const, tag: 'all' as const, v: owner.mem.bondAmp }] : []),
        ...(owner.mem.summonDmg ? [{ kind: 'inc' as const, tag: 'all' as const, v: owner.mem.summonDmg }] : []), // 라르스 변호인단
      ],
    });
    // 전투 유형: 도발 배율이 그 유형 값을 따른다 (돌격가 ×PROV.van, 그 밖 ×1 — provMult). 돌격가 경계(ZOC)는 소환물에게 없다
    if (sd.ctype) { s.ctype = sd.ctype; s.mem.typed = 1; }
    if (sd.prov !== undefined) s.mem.provBase = sd.prov;
    applyCategory(s);
    if (sd.focusLow) s.mem.lowestFocus = 1;
    if (sd.basicMult && sd.basicMult !== 1) s.mods.push({ kind: 'inc', tag: 'basic', v: sd.basicMult - 1 }); // 기본 공격 계수 (리키 +12%)
    s.hp = st.maxHp;
    s.atkTimer = 0.3;
    s.mem.bondRate = r; // 상세 창 (전투 중 소환물 섹션) 표시용
    if (i > 0) s.mem.bondExtra = 1;
    const treat = owner.mem.summonTreat;
    if (owner.mem.crowShock) s.hooks.push({ onBasic(bb, self, t, r2) { if (r2.amount > 0 && t.alive && bb.rng.chance(0.3)) bb.applyStatus(self, t, { type: 'shock', key: 'shock', dur: 1 }); } });
    if (treat) s.hooks.push({
      onTick(bb, self, dt) {
        self.mem.treat = (self.mem.treat || 0) + dt;
        if (self.mem.treat >= 5 && owner.alive) { self.mem.treat = 0; bb.heal(self, owner, bb.S(owner, 'tech') * treat); }
      },
    });
    return { sd, unit: s, rate: r, extra: i > 0 };
  });
}
/** 소환물 · 공왕이 설 빈칸이 없어 나오지 못했을 때: 주인 머리 위에 알림 (조용히 사라지지 않게) */
export const NO_ROOM_LABEL = '소환 자리 없음';
const noRoom = (b: Battle, owner: CUnit) => b.emit({ k: 'status', id: owner.id, name: NO_ROOM_LABEL, harm: true });
function spawnSummons(b: Battle, owner: CUnit, sd0: SummonDef) {
  const at = COMP_AT.get(b), uid = owner.side === 0 ? owner.src?.uid : undefined;
  makeSummons(owner, sd0).forEach((m, i) => {
    const c = uid ? at?.get(`${uid}:${i}`) : undefined; // 편성 화면에서 정한 시작 칸 (companionCells)
    if (!c || !b.inBounds(c.x, c.y) || b.unitAt(c.x, c.y)) { if (!b.spawn(m.unit, owner)) noRoom(b, owner); return; }
    const u = m.unit;
    u.x = u.px = c.x; u.y = u.py = c.y;
    b.add(u);
    for (const h of u.hooks) h.onStart?.(b, u);
    b.emit({ k: 'spawn', id: u.id });
  });
}
/** 전투별 소환물 시작 칸 (키 '주인 uid:번호' → 칸) */
const COMP_AT = new WeakMap<Battle, Map<string, { x: number; y: number }>>();

/** 편성 화면 · 전투 시작 공용: 출전 기물의 소환물과 공왕 무휼이 나타날 칸.
 *  저장한 칸(run.summonPos)이 배치 구역 안이고 비어 있으면 그 칸, 아니면 무휼은 뒷줄 가운데부터 · 소환물은 주인에게 가장 가까운 빈칸 (배치 구역 안).
 *  출전 기물 · 포탑 칸이 먼저이고, 무휼 → 소환물 순으로 칸을 잡는다.
 *  missing 을 넘기면 배치 구역에 빈칸이 없어 시작 칸을 못 잡은 것을 담는다 (x · y = -1, 편성 화면 경고 칩. 전투에서는 가까운 빈칸 · 없으면 '소환 자리 없음') */
export interface CompanionTok { key: string; owner?: string; king?: boolean; name: string; spr: { sprite: string; palette: string[]; art?: string }; x: number; y: number }
export function companionCells(run: RunState, W: number, missing?: CompanionTok[]): CompanionTok[] {
  const g = runGeo(run, W);
  const lay = layout(run, W);
  const used = new Set([...lay.values(), ...turretCells(run, W)].map((p) => `${p.x},${p.y}`));
  for (const d of run.node?.enc?.devices || []) for (const c of deviceCells(d)) used.add(`${c.x},${c.y}`); // 편성 화면에 놓은 장치 칸
  const zone: { x: number; y: number }[] = [];
  for (let y = g.ay1; y >= g.ay0; y--) for (let x = PAD; x < PAD + W; x++) zone.push({ x, y });
  const saved = (key: string) => { const p = run.summonPos?.[key]; if (!p) return null; const q = boardPos(p, W, g); return used.has(`${q.x},${q.y}`) ? null : q; };
  const near = (ox: number, oy: number) => zone.filter((p) => !used.has(`${p.x},${p.y}`)).sort((a, b) => Math.max(Math.abs(a.x - ox), Math.abs(a.y - oy)) - Math.max(Math.abs(b.x - ox), Math.abs(b.y - oy)) || Math.abs(a.x - ox) + Math.abs(a.y - oy) - Math.abs(b.x - ox) - Math.abs(b.y - oy))[0] || null;
  const out: CompanionTok[] = [];
  if (kingOn(run)) {
    const def = UNIT_BY_ID.muhyul;
    const c = saved('king') || kingCell(run, W);
    if (c) { used.add(`${c.x},${c.y}`); out.push({ key: 'king', king: true, name: def.name, spr: def, x: c.x, y: c.y }); }
    else missing?.push({ key: 'king', king: true, name: def.name, spr: def, x: -1, y: -1 });
  }
  const b = new Battle(g.w, g.h, new Rng(1), { phase: run.phase, credits: run.credits });
  b.geo = g;
  b.keepEvents = false;
  const counts = synergyCounts(deployed(run), run);
  for (const u of deployed(run)) {
    const sd = UNIT_BY_ID[u.defId].summon, o = lay.get(u.uid);
    if (!sd || !o) continue;
    const owner = buildAlly(b, run, u, counts);
    makeSummons(owner, sd).forEach((m, i) => {
      const key = `${u.uid}:${i}`;
      const c = saved(key) || near(o.x, o.y);
      if (!c) { missing?.push({ key, owner: u.uid, name: m.unit.name, spr: { sprite: m.unit.sprite, palette: m.unit.palette, art: m.unit.art }, x: -1, y: -1 }); return; }
      used.add(`${c.x},${c.y}`);
      out.push({ key, owner: u.uid, name: m.unit.name, spr: { sprite: m.unit.sprite, palette: m.unit.palette, art: m.unit.art }, x: c.x, y: c.y });
    });
  }
  return out;
}

/**
 * 적 메이저 스탯: 페이즈 · 등급 · 성향에 따라 정해지고, 아군과 같은 환산 규칙으로
 * 명중 · 효과 명중 · 효과 저항 · 회피 · 치명타를 올린다 (체력 · 위력 · 방어도는 기존 적 수치 그대로).
 */
export function enemyMajors(def: EnemyDef, phase: number): Record<Major, number> {
  const w: Record<Major, number> = { vit: 0.8, pow: 0.8, mnd: 0.6, def: 0.8, agi: 0.5 };
  if (def.melee) { w.vit += 0.3; w.def += 0.2; } else { w.pow += 0.2; w.agi += 0.1; }
  if (def.atk.elem === 'psy' || def.atk.elem === 'holy' || def.keywords.includes('phantom')) w.mnd += 0.6;
  if (def.keywords.includes('mech')) { w.def += 0.2; w.mnd -= 0.3; }
  if ((def.eva || 0) >= 0.15) w.agi += 0.3;
  if (def.armor >= 300) w.def += 0.4;
  const lv = (4 + 3 * (phase - 1)) * (def.tier === 'boss' ? 1.3 : def.tier === 'elite' ? 1.15 : 1);
  return Object.fromEntries(MAJORS.map((m) => [m, Math.max(0, Math.round(lv * w[m]))])) as Record<Major, number>;
}

/** 적 기본 이동 속도 (기동력 가산 전): CFG.enemyMoveSpd (암살형은 assassin) × 적별 이동 배율 */
export function enemyBaseMoveSpd(def: EnemyDef): number {
  const M = CFG.enemyMoveSpd;
  return (def.tend === 'assassin' ? M.assassin : M.base) * (def.moveSpd ?? 1);
}

/** 중립 구조물 (접이식 바리케이드 등): 어느 편도 아니고 (sideOf 2), 칸 · 탄도를 막는다. 표적 · 승패에서 빠지고, 길이 완전히 막히거나 탄이 지나가면 양쪽이 친다 */
export function buildWall(b: Battle, x: number, y: number, hp: number, o: { name?: string; armor?: number; defId?: string } = {}): CUnit {
  const c = blankUnit(1);
  c.defId = o.defId || 'wall'; c.name = o.name || '바리케이드'; c.sprite = 'turret'; c.palette = WALL_PAL;
  c.st.maxHp = hp; c.st.armor = o.armor ?? 0; c.hp = hp;
  c.immobile = true; c.noAttack = true; c.keywords = ['struct']; c.category = 'struct';
  c.mem.inert = 1; c.mem.neutral = 1; c.mem.wall = 1;
  c.x = c.px = x; c.y = c.py = y;
  b.add(c);
  return c;
}
const WALL_PAL = ['#0e0e0e', '#9a7a4a', '#6a5232', '#d8c090', '#b89a62', '#3e2f1c', '#efe2c0'];

export function buildEnemy(b: Battle, def: EnemyDef, phase: number, mult: number, gear?: { items?: string[]; mod?: string; stripped?: boolean }): CUnit {
  const c = blankUnit(1);
  const st = emptyStats();
  st.maxHp = def.hp * CFG.enemyHpMul * phaseHpMult(phase) * mult;
  st.shoot = st.strike = st.tech = def.power * CFG.enemyPowMul;
  st.armor = def.armor * Math.pow(CFG.phaseArmor, phase - 1);
  st.acc = def.acc || 0; st.eva = def.eva || 0; st.crit = def.crit ?? 0.05; st.critDmg = 1.5;
  st.effHit = def.effHit || 0; st.effRes = def.effRes || 0; st.range = def.range;
  const em = enemyMajors(def, phase);
  // 이동 속도: 기본값 (성향 · 적별 이동 배율) + 기동력 1당 아군과 같은 환산
  st.moveSpd = enemyBaseMoveSpd(def) + em.agi * CFG.conv.agi.moveSpd;
  // 효과 명중 · 효과 저항은 아군과 같은 환산, 명중 · 회피 · 치명타는 약하게 (전체 난이도 유지)
  const K = CFG.enemyMajorConv;
  st.effHit += em.mnd * CFG.conv.mnd.effHit; st.effRes += em.def * CFG.conv.def.effRes * K.effRes;
  st.acc += em.mnd * CFG.conv.mnd.acc * K.acc;
  const O = CFG.enemyOldConv;
  const eva0 = st.eva + em.agi * CFG.conv.agi.eva * O.eva, crit0 = st.crit + em.pow * CFG.conv.pow.crit * O.crit; // 예전 환산 (보정 기준)
  st.eva = Math.min(CFG.enemyEvaCap, st.eva + em.agi * CFG.conv.agi.eva * K.eva);
  st.crit = Math.min(CFG.enemyCritCap, st.crit + em.pow * CFG.conv.pow.crit * K.crit);
  st.maxHp *= (1 - st.eva) / (1 - Math.min(0.9, eva0)); // 회피가 늘어난 만큼 체력을 줄여 유효 체력 유지
  const critTax = 1 / (1 + 2 * Math.max(0, st.crit - crit0)); // 치명타 1%p = 피해 2%
  Object.assign(c, {
    defId: def.id, name: def.name, sprite: def.sprite, palette: def.palette, art: def.art, st, keywords: def.keywords.slice(),
    atk: { type: def.atk.type, elem: def.atk.elem, interval: def.interval }, skill: def.skill || null,
    sk: { ...(def.skill?.params || {}) }, cdMax: def.skill?.cd || 0, isBoss: def.tier === 'boss', big: def.tier !== 'minion',
    immobile: !!def.immobile, phaseAmp: phaseAmpMult(phase) * encDmgMult(mult) * critTax,
  });
  c.mem.mult = mult;
  c.elite = def.tier === 'elite';
  c.tend = def.tend; c.prov = new Map(); // 표적 고르기: 성향 + 도발 수치
  applyCategory(c);
  for (const m of MAJORS) c.mem[`M_${m}`] = em[m];
  c.cd = c.cdMax * 0.6;
  // 리워크: 적도 무기 · 전투 유형 · 이성을 가진다
  c.ctype = def.atk.type === 'shoot' ? 'MARK' : 'VAN';
  c.weapon = { name: '', kind: def.atk.type === 'shoot' ? 'mag' : 'combo', type: def.atk.type, elem: def.atk.elem, interval: def.interval, range: def.range,
    mult: def.atk.type === 'shoot' ? (8 * def.interval + 1.5) / (8 * def.interval) : 4 / (3 + CFG.finishMult), mag: 8, reload: 1.5, combo: 4 };
  c.reason = CFG.reasonStart;
  c.hooks.push(ENEMY_PSI);
  if (b.ctx.field) fieldOf(b.ctx.field).enemyMod?.(c); // 전장 조건
  // 난이도 단계
  const d = b.ctx.diff || 0;
  if (diffHas(d, 1)) st.maxHp *= 1.15;
  if (diffHas(d, 2)) c.phaseAmp *= diffHas(d, 6) ? 1.5 : diffHas(d, 3) ? 1.25 : 1.15; // 위험 2 ×1.15 · 쉬움(3) ×1.25 · 모험(6) · 고난(7) ×1.5
  if (diffHas(d, 4) && def.tier === 'boss') st.maxHp *= 1.25;
  if (diffHas(d, 5)) st.eva += 0.1;
  // (위험 7 = 절망 증강: 아래 ctx.despairs)
  if (diffHas(d, 8)) { st.armor *= 1.25; st.effRes += 0.15; st.eva += 0.1; }
  if (diffHas(d, 9)) st.maxHp *= Math.pow(1.05, phase - 1);
  // 절망 증강 (data/despair.ts · CFG.despair): 여러 개가 함께 걸릴 수 있다
  const dsp = b.ctx.despairs || [], DS = CFG.despair;
  if (dsp.includes('D.overclock')) st.cdr += DS.overclock;
  if (dsp.includes('D.final') && def.tier === 'boss') { st.maxHp *= 1 + DS.boss; c.phaseAmp *= 1 + DS.boss; }
  if (dsp.includes('D.plating')) st.armor *= 1 + DS.plating;
  if (dsp.includes('D.hasty')) st.atkSpd += DS.hasty;
  if (dsp.includes('D.fog')) st.eva += DS.fog;
  if (dsp.includes('D.exposed')) st.crit += DS.exposed;
  if (dsp.includes('D.petra')) c.hooks.push({ onStart(bb, u) { bb.shield(u, bb.S(u, 'maxHp') * DS.shield); } });
  if (b.ctx.globals?.includes('G.l_stakes')) c.phaseAmp *= 1 + CFG.globalAug.stakesFoe; // 전설 전역 증강 [판돈 올리기]
  oathEnemy(b.ctx, st, c, def.tier); // 절망 서약 (data/oaths.ts · CFG.oath): 고난 런에서 켠 고정 조건
  // 적 장비 · 개조부품
  for (const it of [...(gear?.stripped ? [] : [...(def.items || []), def.mod || null]), ...(gear?.items || []), gear?.mod || null]) if (it) applyLive(c, itemEffect(it), b, makeCtx(null, null, {})); // stripped: 강제 징수기
  if (gear?.items?.length || gear?.mod) { c.tempItems = [...(gear.items || []), ...(gear.mod ? [gear.mod] : [])]; c.mem.gear = 1; } // 위험 등급 장비 (표시용)
  if (def.onBasic) c.hooks.push({ onBasic: def.onBasic });
  if (def.onTick) c.hooks.push({ onTick: def.onTick });
  if (def.hooks) c.hooks.push(def.hooks);
  if (def.noAttack) c.noAttack = true;
  if (def.inert) c.mem.inert = 1;
  void b;
  return c;
}

// 엔지니어 감시 포탑: 출전한 엔지니어 능력치 평균을 단계별 비율로 상속 (data/synergies.ts ENG_TUR)
export const TURRET_PAL = ['#0c0e12', '#7a8aa0', '#3a4458', '#c0c8d0', '#7fe3ff', '#4a5468', '#e8f0ff'];
/** 포탑 배치 저장값 (c, r): c = -1 왼쪽 가장자리 열, c = 99 오른쪽 가장자리 열, 그 밖은 배치 구역 열. r = 0 이 맨 뒷줄 */
export type TurretPos = { c: number; r: number };
const TURRET_DEFAULT: TurretPos[] = [{ c: -1, r: 1 }, { c: 99, r: 1 }, { c: -1, r: 0 }, { c: 99, r: 0 }, { c: -1, r: 2 }, { c: 99, r: 2 }];
export const turretBoardCell = (p: TurretPos, W: number, g?: Geo) => ({ x: p.c < 0 ? 0 : p.c >= 99 ? W + 2 * PAD - 1 : PAD + Math.min(p.c, W - 1), y: (g?.ay1 ?? ALLY_Y1) - Math.max(0, Math.min(p.r, (g?.rows ?? ZONE) - 1)) });
export const turretSavePos = (x: number, y: number, W: number, g?: Geo): TurretPos => ({ c: x < PAD ? -1 : x >= PAD + W ? 99 : x - PAD, r: (g?.ay1 ?? ALLY_Y1) - y });
/** 엔지니어 단계 (출전 기준) */
export const engTier = (run: RunState) => tierOf('ENG', synergyCounts(deployed(run), run).ENG || 0);
/** 편성에서 보일 포탑 수 = 엔지니어 단계별 포탑 수 (ENG_TUR.count, 0단계 = 0기) */
export function turretCount(run: RunState): number {
  const t = engTier(run);
  return t ? ENG_TUR.count[Math.min(ENG_TUR.count.length, t) - 1] : 0;
}
/** 보드 크기 W 에서 포탑 칸 (저장 위치 → 기본 위치 → 빈칸 순, 기물 · 다른 포탑과 겹치지 않게) */
export function turretCells(run: RunState, W: number, count = turretCount(run)): { x: number; y: number }[] {
  const g = runGeo(run, W);
  const used = new Set([...layout(run, W).values()].map((p) => `${p.x},${p.y}`));
  for (const d of run.node?.enc?.devices || []) for (const c of deviceCells(d)) used.add(`${c.x},${c.y}`);
  const out: { x: number; y: number }[] = [];
  const free = (q: { x: number; y: number }) => !used.has(`${q.x},${q.y}`);
  for (let i = 0; i < count; i++) {
    let q: { x: number; y: number } | null = run.turretPos?.[i] ? turretBoardCell(run.turretPos[i], W, g) : null;
    if (q && !free(q)) q = null;
    for (const d of TURRET_DEFAULT) { if (q) break; const c = turretBoardCell(d, W, g); if (free(c)) q = c; }
    for (let y = g.ay1; y >= g.ay0 && !q; y--) for (let x = 0; x < W + 2 * PAD && !q; x++) if (free({ x, y })) q = { x, y };
    if (!q) break;
    used.add(`${q.x},${q.y}`);
    out.push(q);
  }
  return out;
}
// ───────── 청라공국: 공왕 무휼 (출전 칸 밖, 편성 화면에 두지 않고 전투 시작 때 나타난다). 인과율 · 단계 수치는 data/chungra.ts
/** 청라 단계 (출전 기준) */
export const chrTier = (run: RunState) => tierOf('CHR', synergyCounts(deployed(run), run).CHR || 0);
/** 무휼이 이번 편성에서 소환되는지 */
export const kingOn = (run: RunState) => chrTier(run) >= 1;
/** 무휼의 가상 기물 상태: 공명 등급 대신 인과 단계로 정한 성장 등급 · 모든 주요 능력치 가산 · 해금된 전용 장비.
 *  run.units 에 들어가지 않는다 (출전 칸 · 공명도 · 판매 없음). tier = 지금 청라 단계 (전용 장비 해금은 지금까지의 최고 단계와 비교) */
export function kingState(run: RunState, tier = chrTier(run)): UnitState {
  const n = causalStage(run.causal || 0), m = KING.maj(n);
  return {
    uid: 'king', defId: 'muhyul', rank: KING.rank(n), xp: 0,
    alloc: { vit: m, pow: m, mnd: m, def: m, agi: m }, perm: { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 },
    augments: [], items: kingGearOf(Math.max(run.chrTier || 0, tier)), mod: null, pos: { c: 0, r: 0 },
  };
}
/** 보드 크기 W 에서 무휼이 나타날 칸: 배치 구역 뒷줄 가운데부터 (가운데에서 가까운 열 순, 뒷줄 → 앞줄), 출전 기물 · 포탑 자리와 겹치지 않게.
 *  양옆 가장자리 열(포탑 칸)은 쓰지 않는다. 소환되지 않으면 null */
export function kingCell(run: RunState, W: number): { x: number; y: number } | null {
  if (!kingOn(run)) return null;
  const g = runGeo(run, W);
  const used = new Set([...layout(run, W).values(), ...turretCells(run, W)].map((p) => `${p.x},${p.y}`));
  for (const d of run.node?.enc?.devices || []) for (const c of deviceCells(d)) used.add(`${c.x},${c.y}`);
  const mid = (W - 1) / 2;
  const cols = [...Array(W).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || b - a).map((c) => PAD + c);
  for (let y = g.ay1; y >= g.ay0; y--) for (const x of cols) if (!used.has(`${x},${y}`)) return { x, y };
  return null;
}
/** 전투별 무휼 칸 */
const KING_AT = new WeakMap<Battle, { x: number; y: number } | null>();
CHR_HOOK.spawn = (b, lead, ctx, t) => {
  const run = ctx.run;
  if (!run || lead.side !== 0) return;
  const c = buildAlly(b, run, kingState(run, t), ctx.counts);
  c.isSummon = true; // 출전 기물 수 · 전술 위력 · 부활 대상에서 빠진다 (전투 기록은 무휼 자신의 줄)
  c.mem.tacOk = 1; c.mem.king = 1;
  let cell = KING_AT.get(b) || null; // 뒷줄 가운데 빈칸 (kingCell)
  if (cell && (!b.inBounds(cell.x, cell.y) || b.unitAt(cell.x, cell.y))) cell = null;
  if (!cell) { const mid = Math.floor(b.w / 2); cell = b.freeCellNear(mid, b.geo?.ay1 ?? ALLY_Y1); }
  if (!cell) cell = b.freeCellNear(lead.x, lead.y);
  if (!cell) { noRoom(b, lead); return; }
  c.x = c.px = cell.x; c.y = c.py = cell.y;
  c.hp = b.S(c, 'maxHp');
  c.atkTimer = c.atk.interval * 0.5;
  if (c.weapon?.kind === 'mag') c.ammo = c.weapon.mag || 1;
  b.add(c);
  b.emit({ k: 'spawn', id: c.id });
  b.actor = c;
  for (const h of c.hooks) h.onStart?.(b, c);
  b.actor = lead;
};
SUMMON_RT.make = (b, owner, sd) => {
  const m = makeSummons(owner, sd)[0];
  if (!m) return null;
  return b.spawn(m.unit, owner);
};

/** 전투별 포탑 설치 칸 (buildBattle 이 편성 위치를 넘긴다) */
const TURRET_AT = new WeakMap<Battle, { x: number; y: number }[]>();
/** 전투별 포탑 장비 · 개조부품 (포탑 순서대로) */
const TURRET_GEAR_AT = new WeakMap<Battle, (string | null)[][]>();
const TURRET_MOD_AT = new WeakMap<Battle, (string | null)[]>();
ENG_HOOK.spawn = (b, lead, engs, n, first = 0) => {
  const avg = (k: keyof Stats) => engs.reduce((s, e) => s + b.S(e, k), 0) / engs.length;
  const hpBonus = engs.reduce((s, e) => s + (e.mem.turretHp || 0), 0);
  const maxHpBonus = engs.reduce((s, e) => s + (e.mem.turretMaxHp || 0), 0); // 엔지니어 문장: 최대 체력만 (data/emblems.ts)
  const tier = lead.mem.eng || 1;
  const ti = Math.min(ENG_TUR.inherit.length, tier) - 1;
  const inherit = ENG_TUR.inherit[ti]; // 엔지니어 단계별 상속률
  // 기본 공격 속도 +40%, 6명 이상 추가, 8명 [오버클럭] 추가
  const asBonus = ENG_TUR.as + engs.reduce((s, e) => s + (e.mem.turretAs || 0), 0) + (tier >= ENG_TUR.asHiFrom ? ENG_TUR.asHi : 0) + (tier >= ENG_TUR.count.length ? ENG_TUR.over : 0);
  const gearAll = lead.side === 0 ? TURRET_GEAR_AT.get(b) : undefined;
  const modAll = lead.side === 0 ? TURRET_MOD_AT.get(b) : undefined;
  for (let i = first; i < first + n; i++) {
    const t = blankUnit(lead.side);
    const st = emptyStats();
    st.maxHp = avg('maxHp') * inherit * (1 + hpBonus) * (1 + maxHpBonus);
    st.shoot = st.strike = st.tech = Math.max(avg('shoot'), avg('tech')) * inherit;
    st.armor = avg('armor') * inherit * (1 + hpBonus);
    st.acc = avg('acc') * 0.5; st.crit = avg('crit') * 0.5; st.critDmg = 1.5; st.effRes = avg('effRes') * 0.5;
    st.atkSpd = asBonus; st.range = 4; st.moveSpd = 1;
    Object.assign(t, {
      defId: 'turret', name: '감시 포탑', sprite: 'turret', palette: TURRET_PAL, art: 'sm_turret', st, atk: { type: 'shoot', elem: 'phys', interval: 1.0 },
      keywords: ['mech', 'struct'], isSummon: true, immobile: true,
    });
    applyCategory(t);
    // 포탑 전용 장비 · 엔지니어 전용 개조부품 (편성 화면에서 장착, 포탑 순서대로)
    const gear = (gearAll?.[i] || []).slice(0, turretSlots(tier)).filter((x): x is string => isTurretGear(x));
    const mod = modAll?.[i];
    if (mod && isTurretMod(mod)) gear.push(mod);
    if (gear.length) {
      const ctx = makeCtx(null, null, {});
      for (const id of gear) applyLive(t, itemEffect(id), b, ctx);
      if (t.mem.tFlame) t.st.range = Math.max(1, t.st.range - 2); // 화염 방사기: 사거리 -2
      t.tempItems = gear;
    }
    t.mem.turretIdx = i;
    t.hp = t.st.maxHp;
    t.atkTimer = 0.4;
    // 전장 양옆 가장자리(배치 구역 바깥 열)부터, 대표 엔지니어와 가까운 줄에 번갈아 설치. 자리가 없으면 진영 안 빈칸
    const mine = (y: number) => (lead.side === 0 ? y >= (b.geo?.ay0 ?? ALLY_Y0) && y <= (b.geo?.ay1 ?? ALLY_Y1) : y >= PAD && y < PAD + ZONE);
    const edges = (i % 2 === 0 ? [0, b.w - 1] : [b.w - 1, 0]);
    const rowsBy = [...Array(b.h).keys()].filter(mine).sort((a, c) => Math.abs(a - lead.y) - Math.abs(c - lead.y));
    let cell: { x: number; y: number } | null = null;
    const planned = lead.side === 0 ? TURRET_AT.get(b) : undefined; // 편성 화면에서 정한 자리 (순서대로 소모)
    while (planned?.length && !cell) { const q = planned.shift()!; if (b.inBounds(q.x, q.y) && !b.unitAt(q.x, q.y)) cell = q; }
    if (!cell) for (const x of edges) { for (const y of rowsBy) if (b.inBounds(x, y) && !b.unitAt(x, y)) { cell = { x, y }; break; } if (cell) break; }
    for (let r = 1; r < Math.max(b.w, b.h) && !cell; r++)
      for (let dy = -r; dy <= r && !cell; dy++)
        for (let dx = -r; dx <= r && !cell; dx++) {
          const x = lead.x + dx, y = lead.y + dy;
          if (b.inBounds(x, y) && mine(y) && !b.unitAt(x, y)) cell = { x, y };
        }
    if (!cell) return;
    t.x = t.px = cell.x; t.y = t.py = cell.y;
    b.add(t);
    b.emit({ k: 'spawn', id: t.id });
    for (const h of t.hooks) h.onStart?.(b, t); // 전투 시작 처리 뒤에 생기므로 장비의 시작 효과를 직접 부른다
  }
};

// 칼리토 제국 (5 · 7 · 9): 근위기사 — 돌격가 메이저 소환물. 공명 등급 = 아군 최고 공명 등급 × 65% (올림)
export const KNIGHT_PAL = ['#140c0c', '#c0303a', '#e0b040', '#e8c09a', '#ffd34d', '#8a6a3a', '#fff3c0'];
/** 근위기사 기본 메이저 (돌격가 평균) · 등급당 성장: 모든 메이저 +1, 3등급마다 생명력 · 전투력 · 방어력 +2 (능력치 선택 몫) */
const KNIGHT_BASE: Record<Major, number> = { vit: 10, pow: 9, mnd: 3, def: 9, agi: 4 };
export function knightMajors(rank: number): Record<Major, number> {
  const pick = Math.floor(rank / CFG.statEvery) * 2;
  return { vit: KNIGHT_BASE.vit + (rank - 1) * CFG.rankAll + pick, pow: KNIGHT_BASE.pow + (rank - 1) * CFG.rankAll + pick,
    mnd: KNIGHT_BASE.mnd + (rank - 1) * CFG.rankAll, def: KNIGHT_BASE.def + (rank - 1) * CFG.rankAll + pick, agi: KNIGHT_BASE.agi + (rank - 1) * CFG.rankAll };
}
const KNIGHT_SKILL: SkillDef = {
  name: '근위 방패', cd: 8, params: { shield: 0.3, taunt: 4 },
  desc: (p) => `자신에게 최대 체력 ${Math.round(p.shield * 100)}% 보호막, ${p.taunt}초간 도발.`,
  tag: () => '보호막 · 도발',
  cast(b, u) {
    b.shield(u, b.S(u, 'maxHp') * u.sk.shield);
    u.mem.taunt = 1;
    const until = b.t + u.sk.taunt;
    u.mem.tauntUntil = until;
    b.later(u.sk.taunt, () => { if (u.mem.tauntUntil === until) u.mem.taunt = 0; });
    b.emit({ k: 'status', id: u.id, name: '도발' });
    return true;
  },
};
export function buildKnight(b: Battle, side: 0 | 1, rank: number, bonus = 0): CUnit {
  const m = knightMajors(rank);
  for (const k of MAJORS) m[k] += bonus; // 아군 제국 기물 최고 작위 1단계당 모든 메이저 +1
  const st = emptyStats();
  Object.assign(st, CFG.baseMinor);
  st.moveSpd = 1; st.range = 1;
  for (const k of MAJORS) for (const [sk, per] of Object.entries(CFG.conv[k])) st[sk as keyof Stats] += (per as number) * m[k];
  const grow = Math.pow(CFG.rankPowGrowth, Math.max(0, rank - 1));
  st.shoot *= grow; st.strike *= grow; st.tech *= grow;
  const c = blankUnit(side);
  Object.assign(c, {
    defId: 'kal_guard', name: '근위기사', sprite: 'knight', palette: KNIGHT_PAL, art: 'sm_kalguard', st, keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, skill: KNIGHT_SKILL, sk: { ...KNIGHT_SKILL.params }, cdMax: KNIGHT_SKILL.cd,
    weapon: { name: '근위 장검', kind: 'combo', type: 'strike', elem: 'phys', interval: 1.0, range: 1, mult: 0.9, combo: 3 },
    ctype: 'VAN', ttype: 'major', isSummon: true,
  });
  const title = rankTitle(rank);
  c.mem.title = title; c.mem.rank = rank;
  c.mods.push({ kind: 'inc', tag: 'all', v: 0.1 * title }); // 작위 1당 피해 +10%
  applyCategory(c);
  c.cd = c.cdMax * 0.5;
  c.ult = ULTS.kal_guard; c.ultG = CFG.ultStart;
  c.hp = st.maxHp;
  c.atkTimer = 0.3;
  return c;
}
KAL_HOOK.spawn = (b, lead, n) => {
  const top = Math.max(1, ...b.units.filter((u) => u.side === lead.side && u.src && !u.mem.king).map((u) => u.src!.rank)); // 공왕 무휼(인과 단계 등급)은 세지 않는다
  const rank = Math.ceil(top * KAL_GUARD_RANK);
  const titles = Math.max(0, ...b.units.filter((u) => u.side === lead.side && u.src && u.mem.kalTitle).map((u) => u.mem.kalTitle));
  for (let i = 0; i < n; i++) {
    const k = buildKnight(b, lead.side, rank, titles);
    k.mem.kalBonus = titles;
    // 대표 제국 기물 앞쪽(적 방향) 빈칸부터
    const fwd = lead.side === 0 ? -1 : 1;
    const want = { x: lead.x + (i % 2 ? 1 : -1) * Math.ceil(i / 2), y: lead.y + fwd };
    const cell = b.inBounds(want.x, want.y) && !b.unitAt(want.x, want.y) ? want : b.freeCellNear(lead.x, lead.y);
    if (!cell) return;
    k.x = k.px = cell.x; k.y = k.py = cell.y;
    b.add(k);
    for (const h of k.hooks) h.onStart?.(b, k);
    b.emit({ k: 'spawn', id: k.id });
  }
};

setSummonHook((b, owner, defId, count) => {
  for (let i = 0; i < count; i++) {
    const e = buildEnemy(b, ENEMY_BY_ID[defId], b.ctx.phase, owner.mem.mult || 1);
    e.isSummon = true;
    e.hp = e.st.maxHp;
    b.spawn(e, owner);
  }
});

// 전장 조건용 적 생성 (부활 · 장애물 · 재집결): exact 면 그 칸, 아니면 가까운 빈칸
ENEMY_RT.spawn = (b, defId, at, o = {}) => {
  const def = ENEMY_BY_ID[defId];
  if (!def) return null;
  const free = b.inBounds(at.x, at.y) && !b.unitAt(at.x, at.y);
  const cell = free ? { x: at.x, y: at.y } : o.exact ? null : b.freeCellNear(at.x, at.y);
  if (!cell) return null;
  const e = buildEnemy(b, def, b.ctx.phase, o.mult || 1);
  e.isSummon = !!o.summon;
  e.hp = e.st.maxHp * (o.hpPct ?? 1);
  e.atkTimer = e.atk.interval * 0.5;
  if (e.weapon?.kind === 'mag') e.ammo = e.weapon.mag || 1;
  e.x = e.px = cell.x; e.y = e.py = cell.y;
  b.add(e);
  for (const h of e.hooks) h.onStart?.(b, e);
  b.emit({ k: 'spawn', id: e.id });
  return e;
};
// 크레타 서사의 전염: 쓰러진 아군의 망령 (최대 체력 40% · 위력 60%, 기본 공격만, 영혼)
const GHOST_PAL = ['#0a0c12', '#8aa0b8', '#c8d8e8', '#eef6ff', '#80e0ff', '#4a5a6a', '#ffffff'];
ENEMY_RT.ghost = (b, from) => {
  const at = { x: from.x, y: from.y };
  const e = ENEMY_RT.spawn!(b, 'kr_echo', at, {});
  if (!e) return null;
  const f = from.st, st = e.st;
  st.maxHp = f.maxHp * 0.4; st.shoot = f.shoot * 0.6; st.strike = f.strike * 0.6; st.tech = f.tech * 0.6;
  st.armor = f.armor; st.acc = f.acc; st.crit = f.crit; st.critDmg = f.critDmg; st.eva = Math.min(0.6, f.eva + 0.1);
  st.range = Math.max(1, f.range); st.moveSpd = 1;
  e.hp = st.maxHp;
  e.phaseAmp = 1;
  e.name = `${from.name}의 망령`;
  e.sprite = from.sprite; e.palette = GHOST_PAL;
  e.atk = { type: from.atk.type, elem: from.atk.elem, interval: from.atk.interval || 1 };
  e.weapon = null; e.skill = null; e.cdMax = 0;
  e.mem.echoOf = from.id;
  return e;
};
// 히페리온 은행원: 아군 장비를 '빌려' 쓴다 (효과만 복제)
ENEMY_RT.borrow = (b, u, n) => {
  const pool = b.units.filter((x) => x.side === 0 && x.src).flatMap((x) => x.src!.items.filter((it): it is string => !!it));
  const got: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const it = pool.splice(b.rng.int(0, pool.length - 1), 1)[0];
    applyLive(u, itemEffect(it), b, makeCtx(null, null, {}));
    got.push(it);
  }
  if (got.length) u.tempItems = [...(u.tempItems || []), ...got];
  return got;
};

/** 보드 크기 n 에서의 실제 아군 배치. 저장 칸이 장치 · 다른 기물과 겹치면 (폭이 좁아져 잘린 경우 포함) 가장 가까운 아군 진형 빈칸으로 밀어낸다.
 *  출전 기물은 하나도 빠뜨리지 않는다: 아군 진형이 장치로 가득 차면 (편성 화면이 막지만) 가까운 사이 줄 빈칸에 세운다 */
export function layout(run: RunState, n: number): Map<string, { x: number; y: number }> {
  const g = runGeo(run, n);
  const used = new Set<string>();
  for (const d of run.node?.enc?.devices || []) for (const c of deviceCells(d)) used.add(`${c.x},${c.y}`); // 편성 화면에 놓은 장치 칸은 비켜 간다
  const zone: { x: number; y: number }[] = [];
  for (let y = g.ay1; y >= g.ay0; y--) for (let x = PAD; x < PAD + n; x++) zone.push({ x, y });
  let spill: { x: number; y: number }[] | null = null; // 마지막 수단: 사이 줄 (지형 칸 제외)
  const near = (cs: { x: number; y: number }[], o: { x: number; y: number }) => {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const c of cs) {
      if (used.has(`${c.x},${c.y}`)) continue;
      const d = Math.max(Math.abs(c.x - o.x), Math.abs(c.y - o.y)) * 100 + Math.abs(c.x - o.x) + Math.abs(c.y - o.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  const out = new Map<string, { x: number; y: number }>();
  for (const u of deployed(run)) {
    const want = boardPos(u.pos!, n, g);
    let p: { x: number; y: number } | null = used.has(`${want.x},${want.y}`) ? near(zone, want) : want;
    if (!p) {
      if (!spill) {
        const land = terrainCells(g);
        spill = [];
        for (let y = PAD; y < g.h - PAD; y++) for (let x = PAD; x < PAD + n; x++) if (zoneAt(g, x, y) === 'mid' && !((land.get(`${x},${y}`)?.bits ?? 0) & 1)) spill.push({ x, y });
      }
      p = near(spill, want);
    }
    if (!p) continue; // 전장 전체에 빈칸이 없음 (일어나지 않는다 — tests/deploy_check.ts)
    used.add(`${p.x},${p.y}`);
    out.set(u.uid, p);
  }
  return out;
}
/** 이번 조우 아군 진형에서 출전 기물이 설 수 있는 칸 수 (폭 × 줄 − 장치가 차지한 칸). 출전 인원은 이 수를 넘을 수 없다 (run.ts deployRoom · fitDeploy) */
export function allyRoom(run: RunState, n = run.node?.enc?.n ?? CFG.bossBoard, devices: Device[] = run.node?.enc?.devices || []): number {
  const g = runGeo(run, n), taken = new Set<string>();
  for (const d of devices) for (const c of deviceCells(d)) if (zoneAt(g, c.x, c.y) === 'ally') taken.add(`${c.x},${c.y}`);
  return g.rows * n - taken.size;
}

/** 편성 화면에서 칸을 차지한 것: 출전 아군 · 포탑 · 소환물 · 공왕 · 적 · 이미 놓은 장치 ('x,y'). skip = 이 장치는 빼고 (다시 놓기 검사용) */
export function prepOccupied(run: RunState, enc: Encounter, skip?: Device): Set<string> {
  const n = enc.n, s = new Set<string>();
  for (const p of layout(run, n).values()) s.add(`${p.x},${p.y}`);
  for (const c of turretCells(run, n)) s.add(`${c.x},${c.y}`);
  for (const t of companionCells(run, n)) s.add(`${t.x},${t.y}`);
  const g = encGeo(enc);
  for (const e of enc.enemies) { const c = foeCell(e, g); s.add(`${c.x},${c.y}`); }
  for (const d of enc.devices || []) if (d !== skip) for (const c of deviceCells(d)) s.add(`${c.x},${c.y}`);
  return s;
}

export function buildBattle(run: RunState, enc: Encounter, keepEvents = true): Battle {
  const g = encGeo(enc);
  const b = new Battle(g.w, g.h, new Rng(enc.seed), { phase: enc.phase ?? run.phase, credits: run.credits, field: run.field, diff: run.diff, despairs: run.despairs?.length ? [...run.despairs] : undefined, globals: run.globals.length ? [...run.globals] : undefined, oaths: run.oaths, otShift: oathV(run, 'clock', 'sec') || undefined, campIntel: run.campaign && run.flags.includes('cp_intel') ? true : undefined, campIntel2: run.campaign && run.flags.includes('cp_intel2') ? true : undefined, campIntel3: run.campaign && run.flags.includes('cp_intel3') ? true : undefined, campIntel4: run.campaign && run.flags.includes('cp_intel4') ? true : undefined, campAudit: run.campaign && run.flags.includes('cp_br_audit') ? true : undefined });
  b.keepEvents = keepEvents;
  b.geo = g;
  applyMap(b, g, !!enc.gateOpen); // 지형 칸 · 수문 · 운반차 (수문 시작 상태 · 연결교 · 크레인은 편성 화면에서, g.opt)
  const dep = deployed(run);
  const counts = synergyCounts(dep, run);
  const lay = layout(run, enc.n);
  for (const u of dep) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const c = buildAlly(b, run, u, counts);
    c.x = c.px = p.x; c.y = c.py = p.y;
    b.add(c);
  }
  TURRET_AT.set(b, turretCells(run, enc.n, 8));
  const comp = companionCells(run, enc.n);
  const kc = comp.find((t) => t.king);
  KING_AT.set(b, kc ? { x: kc.x, y: kc.y } : null);
  COMP_AT.set(b, new Map(comp.filter((t) => !t.king).map((t) => [t.key, { x: t.x, y: t.y }])));
  TURRET_GEAR_AT.set(b, (run.turretGear || []).map((g) => g.slice()));
  TURRET_MOD_AT.set(b, (run.turretMods || []).slice());
  for (const s of enc.enemies) {
    const def = ENEMY_BY_ID[s.defId];
    const e = buildEnemy(b, def, enc.phase ?? run.phase, enc.mult, s);
    const ec = foeCell(s, g);
    e.x = e.px = ec.x;
    e.y = e.py = ec.y;
    if (b.unitAt(e.x, e.y)) { const f = b.freeCellNear(e.x, e.y); if (!f) continue; e.x = e.px = f.x; e.y = e.py = f.y; }
    b.add(e);
  }
  if (enc.devices?.length) applyDevices(b, run, enc, counts);
  b.start();
  return b;
}

export { SYN_BY_ID };

/** 편성 화면에서 놓은 장치를 전장에 (전투 시작 전): 바리케이드 · 유인 신호기 · 감전 지뢰는 칸에, 항공 보급은 장비를 먼저 달고, 포격 · 그물은 첫 틱에 */
function applyDevices(b: Battle, run: RunState, enc: Encounter, counts: Counts) {
  const phase = enc.phase ?? run.phase;
  const navR = scopeR(tierOf('NAV', counts.NAV || 0));
  const dummy = (name: string, x: number, y: number) => { const c = blankUnit(0); c.name = name; c.x = c.px = x; c.y = c.py = y; c.st.effHit = 9; return c; }; // 장치의 피해 · 상태 출처 (전장에 없음)
  const foesNear = (x: number, y: number, r: number) => b.units.filter((e) => e.alive && e.side === 1 && !e.mem.inert && b.dist(e, { x, y }) <= r);
  for (const d of enc.devices || []) {
    if (d.id === 'K_barricade') {
      const cells = wallCells(d);
      for (const c of cells) if (b.inBounds(c.x, c.y) && !b.unitAt(c.x, c.y)) buildWall(b, c.x, c.y, wallHp(phase, cells.length), { name: '바리케이드', armor: DEV.wall.armor * Math.pow(CFG.phaseArmor, phase - 1), defId: 'K_barricade' });
    } else if (d.id === 'K_decoy') {
      if (!b.inBounds(d.x, d.y) || b.unitAt(d.x, d.y)) continue;
      const c = blankUnit(0);
      Object.assign(c, { defId: 'K_decoy', name: '유인 신호기', sprite: 'turret', palette: DECOY_PAL, immobile: true, noAttack: true, isSummon: true, keywords: ['struct'], category: 'struct' as const });
      c.st.maxHp = 1; c.hp = 1; c.x = c.px = d.x; c.y = c.py = d.y;
      c.mem.decoy = 1; c.mem.provBase = DEV.decoy.prov; c.mem.invulnUntil = DEV.decoy.invuln; c.mem.typed = 1;
      let next = 0;
      c.hooks.push({ onTick(bb, self) { if (bb.t < next) return; next = bb.t + 1; for (const e of bb.enemiesOf(self)) if (!e.mem.inert) bb.provAdd(e, self, DEV.decoy.pulse); } }); // 매초 적 전체의 시선을 끈다
      b.add(c);
    } else if (d.id === 'K_mine') {
      const src = dummy('감전 지뢰', d.x, d.y), dmg = mineDmg(phase), [s0, s1] = DEV.mine.shock;
      b.traps.push({ x: d.x, y: d.y, side: 0, r: DEV.mine.r, delay: DEV.mine.delay, fire: (bb) => {
        bb.emit({ k: 'fx', x: d.x, y: d.y, r: DEV.mine.r, elem: 'elec', kind: 'atk', side: 0 });
        for (const e of foesNear(d.x, d.y, DEV.mine.r)) {
          bb.dealDamage(src, e, dmg, { elem: 'elec', tag: 'skill', kind: 'tech', noHooks: true });
          if (e.alive) bb.applyStatus(src, e, { type: 'shock', key: 'shock', dur: s0 + bb.rng.next() * (s1 - s0) });
        }
      } });
    } else if (d.id === 'K_net') {
      const src = dummy('포획 그물', d.x, d.y);
      b.later(0, () => {
        b.emit({ k: 'fx', x: d.x + 0.5, y: d.y + 0.5, r: 1, elem: 'phys', kind: 'aura', side: 0 });
        for (const e of b.units.filter((u) => u.alive && u.side === 1 && !u.mem.inert && netCells(d).some((c) => c.x === u.x && c.y === u.y)))
          if (b.rng.chance(DEV.net.chance)) b.applyStatus(src, e, { type: 'buff', key: 'root', dur: Math.max(DEV.net.min, DEV.net.dur * (1 - b.S(e, 'effRes'))), label: '그물' });
      });
    } else if (d.id === 'K_scope' && d.mode === 'strike') {
      const src = dummy('지정 포격', d.x, d.y);
      b.later(0, () => {
        b.emit({ k: 'fx', x: d.x, y: d.y, r: navR, elem: 'phys', kind: 'atk', side: 0 });
        const dmg = strikeDmg(b.tac[0], phase);
        for (const e of foesNear(d.x, d.y, navR)) b.dealDamage(src, e, dmg, { elem: 'phys', tag: 'skill', kind: 'tech', noHooks: true });
      });
    } else if (d.id === 'K_scope') { // 항공 보급: 전투 시작 전에 달아 두어 체력 · 시작 효과까지 그대로
      for (const a of b.units.filter((u) => u.side === 0 && !u.isSummon && !u.mem.inert && b.dist(u, d) <= navR)) {
        const id = b.rng.pick(ALL_GRADED);
        applyLive(a, itemEffect(id), b, makeCtx(run, a.src || null, counts));
        a.tempItems = [...(a.tempItems || []), id];
        b.emit({ k: 'gift', from: a.id, to: a.id, item: id });
      }
    }
  }
}
const DECOY_PAL = ['#0e0e0e', '#ff8a3d', '#c25a1c', '#ffd2a8', '#ffb070', '#5a2a0c', '#fff0e0'];

/** 지형 칸 ('x,y' → 종류): 편성 화면 표시 · 배치 검사 */
export function terrainCells(g: Geo): Map<string, TCell & { bits: number }> {
  return new Map(terrainOf(g).map((c) => [`${c.x},${c.y}`, { ...c, bits: c.bits ?? TERRAIN[c.k].bits }]));
}
/** 지형만 보고 (기물 · 장치 무시) 아군 진형에서 모든 적 진형 줄로 걸어갈 길이 있는지 (크레인 적재칸 · tests/terrain_check.ts) */
export function terrainPathOk(g: Geo, land = terrainCells(g)): boolean {
  const walk = (x: number, y: number) => x >= PAD && x < g.w - PAD && y >= PAD && y < g.h - PAD && !((land.get(`${x},${y}`)?.bits ?? 0) & 1);
  const seen = new Set<string>(), q: [number, number][] = [];
  for (let x = PAD; x < PAD + g.n; x++) for (let y = g.ay0; y <= g.ay1; y++) { q.push([x, y]); seen.add(`${x},${y}`); }
  while (q.length) {
    const [x, y] = q.pop()!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !walk(nx, ny)) continue;
      if (dx && dy && !walk(x + dx, y) && !walk(x, y + dy)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  const foeRows = [PAD, PAD + 1, PAD + 2, ...(g.foe2 ? [g.foe2, g.foe2 + 1, g.foe2 + 2] : [])];
  return foeRows.every((y) => [...Array(g.n).keys()].some((c) => seen.has(`${c + PAD},${y}`)));
}
/** 지형 틀의 지형 칸을 전장에 깐다. 수문: 닫힌 채 시작해 gateCycle (닫힘 · 열림 초) 로 번갈아 (전장 이벤트로 알린다).
 *  b.mem.gateOpen = 지금 주기 (1 열림 · 0 닫힘) · b.mem.gateNext = 다음 전환 시각 (전투 시간 b.t). 칸마다 실제로 막혔는지는 b.terrain 비트 (gateState) */
export function applyMap(b: Battle, g: Geo, gateOpen = false) { // gateOpen: 수문이 열린 채 시작 (편성 화면에서 정함) · 연결교 접기 · 크레인은 g.opt (terrainOf)
  const m = mapOf(g.map), cells = terrainOf(g);
  for (const c of cells) {
    b.setTerrain(c.x, c.y, c.bits ?? TERRAIN[c.k].bits);
    const tk = TERRAIN[c.k].taken;
    if (tk && !((c.bits ?? 0) & 1)) (b.cellTaken ||= new Float32Array(b.w * b.h))[c.y * b.w + c.x] = tk; // 연결교: 위에 선 기물이 받는 피해 +
  }
  const rail = cells.filter((c) => c.k === 'rail');
  if (rail.length && m.cartDir) startCart(b, rail, m.cartDir);
  const gates = cells.filter((c) => c.k === 'gate');
  if (!gates.length || !m.gateCycle) return;
  const [shut, open] = m.gateCycle;
  b.mem.gateOpen = gateOpen ? 1 : 0;
  b.mem.gateNext = gateOpen ? open : shut;
  if (gateOpen) for (const c of gates) b.setTerrain(c.x, c.y, 0);
  // 닫힘 주기에 아직 열린 칸 (닫힐 때 기물이 서 있던 칸 = 폐쇄 대기): 매 틱 살펴 비는 즉시 닫는다 (기물 위로는 닫지 않는다)
  const seal = (gen: number) => {
    if (b.mem.gateOpen || b.mem.gateGen !== gen) return; // 이미 열림 주기로 넘어갔거나 새 주기가 시작됨
    let wait = false;
    for (const c of gates) {
      if (b.terrainAt(c.x, c.y)) continue;
      if (b.unitAt(c.x, c.y)) wait = true;
      else b.setTerrain(c.x, c.y, TERRAIN.gate.bits);
    }
    if (wait) b.later(0, () => seal(gen)); // 다음 틱에 다시
  };
  const flip = () => {
    const opening = !b.mem.gateOpen;
    b.mem.gateOpen = opening ? 1 : 0;
    b.mem.gateGen = (b.mem.gateGen || 0) + 1;
    b.mem.gateNext += opening ? open : shut; // 예정 시각에서 이어 센다 (틱 단위로 늦게 불려도 주기가 밀리지 않게)
    if (opening) for (const c of gates) b.setTerrain(c.x, c.y, 0);
    else seal(b.mem.gateGen); // 서 있는 기물이 없는 칸은 바로 닫고, 있는 칸은 비는 대로
    b.emit({ k: 'fx', x: gates[0].x + (gates.length - 1) / 2, y: gates[0].y, r: 1, elem: 'phys', kind: 'aura' });
    b.later(b.mem.gateNext - b.t, flip);
  };
  b.later(b.mem.gateNext, flip);
}
export type GateState = 'open' | 'shut' | 'pending';
/** 수문 칸 하나의 실제 상태: 열림 · 닫힘 · 폐쇄 대기 (닫힘 주기인데 기물이 서 있어 아직 열린 칸) */
export function gateState(b: Battle, x: number, y: number): GateState {
  if (b.terrainAt(x, y)) return 'shut';
  return b.mem.gateOpen ? 'open' : 'pending';
}
/** 수문 덩어리의 상태: 칸 하나라도 폐쇄 대기면 폐쇄 대기, 하나라도 열렸으면 열림 */
export function gateGroupState(b: Battle, cells: { x: number; y: number }[]): GateState {
  const st = cells.map((c) => gateState(b, c.x, c.y));
  return st.includes('pending') ? 'pending' : st.includes('open') ? 'open' : 'shut';
}

/** 광석 운반차 (선로 지형, CFG.maps.cart): first 초에 첫 통과, 이후 period 초마다. 방향은 지형 틀의 cartDir 부터 번갈아.
 *  b.mem: cartNext = 다음 통과 시작 시각 · cartDir = 다음 (지나는 중이면 이번) 방향 · cartRun = 지나는 중 1 · cartT0 = 이번 통과 시작 · cartPass = 통과 수.
 *  지나는 동안 운반차가 선 len 칸은 직선 사격을 막고 (T_NOSHOT), 그 칸의 기물 (아군 · 적 · 구조물 모두)은 통과마다 한 번 cartHit. 전투 중 조작은 없다 */
function startCart(b: Battle, rail: TCell[], dir: 1 | -1) {
  const C = CFG.maps.cart, y = rail[0].y, xs = rail.map((c) => c.x).sort((p, q) => p - q);
  Object.assign(b.mem, { cartNext: C.first, cartDir: dir, cartRun: 0, cartPass: 0 });
  const src = blankUnit(0);
  src.name = '광석 운반차'; src.mem.neutral = 1; src.st.effHit = 9; src.x = src.px = xs[0]; src.y = src.py = y; // 피해 · 기절 출처 (전장에 없음, 어느 편도 아님)
  const pass = () => {
    const d = b.mem.cartDir > 0 ? 1 : -1, order = d > 0 ? xs : [...xs].reverse(), last = order.length + C.len - 1, gen = ++b.mem.cartPass;
    b.mem.cartRun = 1; b.mem.cartT0 = b.t;
    const hit: CUnit[] = [];
    let on: number[] = [];
    for (let i = 0; i <= last; i++) b.later((C.sweep * i) / last, () => {
      const now = i < last ? order.slice(Math.max(0, i - C.len + 1), i + 1) : []; // 운반차가 선 칸 (머리 = order[i])
      for (const x of on) if (!now.includes(x)) b.setTerrain(x, y, TERRAIN.rail.bits);
      for (const x of now) if (!on.includes(x)) b.setTerrain(x, y, TERRAIN.rail.bits | T_NOSHOT);
      on = now;
      for (const x of now) { const u = b.unitAt(x, y); if (u && u.mem.cartHit !== gen) { u.mem.cartHit = gen; hit.push(u); cartHit(b, src, u, y); } }
      if (i < last) return;
      b.mem.cartRun = 0; b.mem.cartDir = -d; b.mem.cartNext += C.period;
      if (hit.length) b.emit({ k: 'cart', ids: hit.map((u) => u.id), dir: d });
      b.later(b.mem.cartNext - b.t, pass);
    });
  };
  b.later(C.first, pass);
}
/** 운반차에 치인 기물: 최대 체력 dmg 몫 물리 피해 → 선로 밖으로 (밀쳐내기 면역 · 고정 기물 · 구조물은 그 자리) → 기절 */
export function cartHit(b: Battle, src: CUnit, u: CUnit, railY: number) {
  const C = CFG.maps.cart;
  b.dealDamage(src, u, b.S(u, 'maxHp') * C.dmg, { elem: 'phys', tag: 'skill', kind: 'tech', noHooks: true });
  if (!u.alive || u.mem.neutral) return;
  const to = b.unmovable(u) ? null : cartOff(b, u, railY);
  if (to && b.relocate(src, u, to.x, to.y, 'knock')) b.emit({ k: 'status', id: u.id, name: '밀쳐내기', src: src.id, harm: true, stype: 'knock' });
  b.stun(src, u, C.stun);
}
/** 선로 밖 가까운 빈칸: 제 진형 쪽 (아군 아래 · 적 위) 1 · 2줄 → 반대쪽 1 · 2줄, 같은 열부터 좌우로 2칸까지. 통행 불가 지형 · 테두리 · 기물 칸은 고르지 않는다 (없으면 null = 그 자리) */
export function cartOff(b: Battle, u: CUnit, railY: number): { x: number; y: number } | null {
  const s = u.side === 1 ? -1 : 1;
  for (const sg of [s, -s]) for (const dy of [1, 2]) for (const dx of [0, -1, 1, -2, 2]) {
    const x = u.x + dx, y = railY + sg * dy;
    if (x < PAD || x >= b.w - PAD || y < PAD || y >= b.h - PAD) continue;
    if (b.inBounds(x, y) && !b.unitAt(x, y)) return { x, y };
  }
  return null;
}
