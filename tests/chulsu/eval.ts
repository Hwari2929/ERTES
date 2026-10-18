// 철수 봇: 가벼운 평가 함수 (전투 탐색 없음). 엔진의 실제 능력치 계산(unitEffects · computeStats)과
// 기물별 실측 팀 기여 · 계수(profile.gen.ts ← profile_gen.ts)로 '초당 피해 · 유효 체력 · 초당 회복'을 어림하고, 팀 가치를 낸다.
//   팀 가치 V = (Σ 초당 피해) × (Σ 유효 체력 + τ × Σ 초당 회복) × (1 + α × Σ 활성 시너지 단계) × 전열 보정
// 공개 정보만 쓴다: 기물 · 장비 · 시너지 정의와 지금 런 상태 (숨은 보상 · 난수는 읽지 않는다).
import { CFG } from '../../src/config';
import { computeStats, synergyCounts, unitEffects, type Counts } from '../../src/engine/build';
import { SYNERGIES, tierOf } from '../../src/data/synergies';
import { UNIT_BY_ID } from '../../src/data/units';
import { isLocked } from '../../src/data/items';
import type { Effect } from '../../src/engine/effects';
import type { Major, RunState, Stats, UnitState } from '../../src/types';
import { PROFILE } from './profile.gen';

/** 평가 상수 (튜닝 시드에서 정함, docs/BOT_CHULSU.md) */
export const EV = {
  tau: 20, // 회복을 유효 체력으로 바꾸는 시간 (초)
  alpha: 0.05, // 활성 시너지 단계 1당 팀 가치 배율 (능력치로 잡히지 않는 시너지 훅 몫)
  noFront: 0.88, // 전열(근접 · 돌격가 · 앞줄 기물)이 하나도 없을 때
  skillShareMinor: 0.5, // 마이너 기물 피해 · 회복 중 성장 배율(minorGrow)을 받는 몫
  backExposure: 0.6, // 뒷줄 기물 유효 체력의 무게 (적 대부분이 가까운 대상 · 도발 수치를 따른다, docs/TARGETING.md)
};

type Prof = { d: number; h: number; sp: number; sm: number; hm: number; P: number; T: number };
const PROF: Record<string, Prof> = PROFILE;
const DEF_PROF: Prof = { d: 80, h: 0, sp: 0.08, sm: 0.02, hm: 0, P: 60, T: 55 };

/** 훅으로만 작동해 능력치에 안 잡히는 희귀 · 전설 장비의 어림 배율 [피해, 유효 체력] (전설은 k 를 3으로). 역할: f = 전열 */
function hookItem(id: string, front: boolean): [number, number] {
  const k = id[0] === 'L' ? 2.2 : 1; // 전설 효과 3배 → 어림 배율은 덜 키운다
  switch (id.slice(2)) {
    case 'vit_vit': return [1, 1 + 0.15 * k];
    case 'vit_pow': return [1 + 0.1 * k, 1];
    case 'vit_def': return [1, 1 + (front ? 0.3 : 0.22) * k];
    case 'vit_agi': return [1, 1 + 0.15 * k];
    case 'pow_def': return [1 + 0.05 * k, 1 + 0.04 * k];
    case 'mnd_def': return [1 + 0.05 * k, 1];
    case 'def_agi': return [1 + (front ? 0.1 : 0.02) * k, 1];
    case 'agi_agi': return [1 + 0.04 * k, 1 + 0.04 * k];
    case 'taunt': return front ? [1, 1 + 0.15 * k] : [1, 0.95];
    case 'helanchor': case 'hellight': case 'helrelic': return [1 + 0.04 * k, 1 + 0.06 * k];
  }
  return [1, 1];
}

export const isFront = (u: UnitState) => { const d = UNIT_BY_ID[u.defId]; return d.range <= 1 || !!d.front || d.ctype === 'VAN'; };

/** 기준 상태 (profile_gen 과 같은 보강: 공명 1, 생명력 +60 · 방어력 +40, 시너지 없음) 능력치 캐시 */
const REF = new Map<string, { st: Stats; tac: number }>();
function refOf(defId: string): { st: Stats; tac: number } {
  let s = REF.get(defId);
  if (!s) {
    const d = UNIT_BY_ID[defId];
    const u: UnitState = { uid: 'ref', defId, rank: 1, xp: 0, alloc: { vit: 60, pow: 0, mnd: 0, def: 40, agi: 0 }, perm: { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 }, augments: [], items: [d.item || null, null, null], mod: null, pos: null, faith: d.faith, grow: {} };
    const c = computeStats(u, unitEffects(null, u, {}, false));
    // 실측 때(기준 아군 3명 + 지휘관 1명 = 4명)의 전술 위력: combat.ts computeTac 과 같은 식
    s = { st: c.st, tac: Math.max(8, CFG.tacBase + CFG.tacPerMnd * c.majors.mnd) };
    REF.set(defId, s);
  }
  return s;
}

export interface UEval { off: number; ehp: number; heal: number; front: boolean }
const mainPow = (defId: string, st: Stats) => { const w = UNIT_BY_ID[defId].weapon; return w.tactical ? st.tech : w.type === 'shoot' ? st.shoot : st.strike; };

/** 기물 1명 평가 (counts = 지금 가정하는 출전 시너지 인원, tac = 팀의 지휘관 전술 위력 — 지휘관 기술은 능력치 대신 이 값을 쓴다, combat.ts P) */
export function unitEval(run: RunState | null, u: UnitState, counts: Counts, tac = 0): UEval {
  const d = UNIT_BY_ID[u.defId];
  const front = isFront(u);
  if (d.inert) return { off: 0, ehp: 0, heal: 0, front: false };
  const eff: Effect[] = unitEffects(run, u, counts, true);
  const st = computeStats(u, eff).st;
  const R0 = refOf(u.defId), ref = R0.st;
  const p = PROF[u.defId] || DEF_PROF;
  // 피해: 실측 계수로 '기본 위력 비율'과 '기술 위력 비율'을 섞는다 (나머지는 위력과 무관한 몫)
  const P0 = mainPow(u.defId, ref) || 1, T0 = ref.tech || 1;
  const wP = Math.max(0, Math.min(1.2, (p.sp * P0) / 5)), wM = Math.max(0, Math.min(1, (p.sm * T0) / 5));
  const w0 = Math.max(0, 1 - wP - wM);
  // 지휘관: 기본 공격은 능력치 (전술 무기는 전술 위력), 기술 몫은 팀 전술 위력 / 실측 때 전술 위력
  const cmd = d.ctype === 'CMD' && tac > 0;
  const wB = d.weapon.tactical ? 0 : Math.min(0.9, wP); // 지휘관 기본 공격 몫 (실측 잡음으로 1을 넘지 않게)
  let ratio = cmd ? wB * (mainPow(u.defId, st) / P0) + (1 - wB) * (tac / R0.tac) : wP * (mainPow(u.defId, st) / P0) + wM * (st.tech / T0) + w0;
  const critF = (s: Stats) => 1 + Math.min(1, s.crit) * Math.max(0, s.critDmg - 1);
  const spd = 1 + 0.6 * (st.atkSpd - ref.atkSpd) + 0.4 * (st.cdr - ref.cdr);
  let incAll = 0, red = 0;
  for (const e of eff) {
    for (const m of e.mods || []) if (m.kind === 'inc' && (m.tag === 'all' || m.tag === d.weapon.type)) incAll += m.v; else if (m.kind === 'inc' && (m.tag === 'skill' || m.tag === 'tech' || m.tag === 'basic')) incAll += m.v * 0.5;
    for (const t of e.taken || []) if (t.kind === 'red' && t.tag === 'all') red += t.v;
  }
  const grow = d.ttype === 'minor' ? 1 - EV.skillShareMinor + EV.skillShareMinor * CFG.minorGrow(u.rank) : 1;
  let hOff = 1, hEhp = 1;
  for (const it of u.items) if (it && !isLocked(it) && /^[AL]_/.test(it)) { const [a, b] = hookItem(it, front); hOff *= a; hEhp *= b; }
  ratio = Math.max(0.05, ratio);
  const off = p.d * ratio * (critF(st) / critF(ref)) * Math.max(0.3, spd) * (1 + incAll) * grow * hOff;
  const armor = st.armor;
  const ehp = (st.maxHp / Math.max(0.05, 1 - armor / (armor + CFG.armorK)) / Math.max(0.4, 1 - Math.min(0.6, st.eva)) / Math.max(0.2, 1 - Math.min(0.8, red))) * hEhp;
  const wH = Math.max(0, Math.min(1, (p.hm * T0) / 5));
  const heal = p.h * (wH * (st.tech / T0) + 1 - wH) * Math.max(0.3, 1 + st.healEff - ref.healEff) * grow;
  return { off, ehp: ehp * (front ? 1 : EV.backExposure), heal, front };
}

/** 팀의 지휘관 전술 위력: 팀 인원 · 지휘관 수 · 지휘관 정신력 (combat.ts computeTac 과 같은 식, 전투 중 버프 제외). 지휘관이 없으면 0 */
function tacOf(units: UnitState[], run: RunState | null, counts: Counts): number {
  const cmds = units.filter((u) => UNIT_BY_ID[u.defId].ctype === 'CMD');
  if (!cmds.length) return 0;
  const mnd = (u: UnitState) => computeStats(u, unitEffects(run, u, counts, true)).majors.mnd;
  return Math.max(8, CFG.tacBase + CFG.tacPerUnit * (units.filter((u) => !UNIT_BY_ID[u.defId].inert).length - 4) + CFG.tacPerCmd * (cmds.length - 1) + cmds.reduce((s, c) => s + CFG.tacPerMnd * mnd(c), 0));
}

export interface TeamEval { v: number; off: number; ehp: number; heal: number; tiers: number; per: Map<string, UEval>; counts: Counts; tac: number }
/** 팀 가치. units = 출전한다고 가정한 기물 (교체 후보 평가 때는 가상의 묶음) */
export function teamEval(run: RunState | null, units: UnitState[]): TeamEval {
  const counts = synergyCounts(units, run);
  const tac = tacOf(units, run, counts);
  const per = new Map<string, UEval>();
  let off = 0, ehp = 0, heal = 0, front = false;
  for (const u of units) {
    const e = unitEval(run, u, counts, tac);
    per.set(u.uid, e);
    off += e.off; ehp += e.ehp; heal += e.heal;
    if (e.front) front = true;
  }
  let tiers = 0;
  for (const s of SYNERGIES) { if (s.id === 'KING') continue; tiers += tierOf(s.id, counts[s.id] || 0); }
  const v = off * (ehp + EV.tau * heal) * (1 + EV.alpha * tiers) * (front || !units.length ? 1 : EV.noFront);
  return { v, off, ehp, heal, tiers, per, counts, tac };
}
/** 팀 평가와 같은 조건(시너지 인원 · 지휘관 전술 위력)으로 기물 1명을 다시 평가 (가상 변경) */
export const unitIn = (t: TeamEval, run: RunState | null, u: UnitState) => unitEval(run, u, t.counts, t.tac);
/** 이미 계산한 팀 합에서 기물 1명의 평가만 바꿨을 때의 가치 (시너지 인원이 그대로인 변화: 장비 · 능력치 · 등급) */
export function teamWith(t: TeamEval, uid: string, e: UEval): number {
  const o = t.per.get(uid) || { off: 0, ehp: 0, heal: 0, front: false };
  const off = t.off - o.off + e.off, ehp = t.ehp - o.ehp + e.ehp, heal = t.heal - o.heal + e.heal;
  return t.v / Math.max(1e-9, t.off * (t.ehp + EV.tau * t.heal)) * off * (ehp + EV.tau * heal);
}

/** 기물 사본 (가상 변경 평가용, 원본 런은 건드리지 않는다) */
export const cloneUnit = (u: UnitState): UnitState => ({ ...u, items: u.items.slice(), alloc: { ...u.alloc }, perm: { ...u.perm }, augments: u.augments.slice(), grow: { ...(u.grow || {}) } });
/** 공명 등급 +1 가정 (모든 주요 능력치 +rankAll, 위력 성장 · 마이너 성장 반영. 이정표 보상은 따로) */
export function rankedUp(u: UnitState): UnitState {
  const c = cloneUnit(u);
  c.rank++;
  for (const k of Object.keys(c.alloc) as Major[]) c.alloc[k] += CFG.rankAll;
  return c;
}
/** 다음 등급에 이정표 보상이 있는지 (증강 · 능력치 선택) */
export function milestone(u: UnitState, rank = u.rank + 1): boolean {
  const tt = UNIT_BY_ID[u.defId].ttype;
  const g = CFG.growth;
  return g.pick(tt, rank) || g.major(tt, rank) || g.special(tt, rank) || g.psionic(tt, rank);
}
