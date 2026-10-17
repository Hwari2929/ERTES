import type { Effect } from '../engine/effects';
import { inc, red, scaleEffect, vuln } from '../engine/effects';
import type { Major, SynergyId } from '../types';
import { ELEM_NAME, MAJOR_NAME, MAJORS } from '../types';
import { CFG } from '../config';
import { diffName } from './difficulty';
import { SYN_BY_ID } from './synergies';
import { slow } from './kit';
import { provMult } from '../engine/combat';
import { KING_GEAR_NAME } from './chungra';
import { emblemEffect, emblemText } from './emblems';

// 장비 등급: 재료(+3) → 고급(같은 재료 2개, 능력치 +12) / 희귀(서로 다른 재료 2개, 능력치 +6 + 특수 효과) · 전설(효과 3배, 조합 불가 · 이벤트 · 상점)
export const COMPONENTS: { id: string; major: Major; name: string; icon: string }[] = [
  { id: 'C_vit', major: 'vit', name: '강화 섬유', icon: '❤' },
  { id: 'C_pow', major: 'pow', name: '출력 코어', icon: '⚔' },
  { id: 'C_mnd', major: 'mnd', name: '신경 칩', icon: '◈' },
  { id: 'C_def', major: 'def', name: '복합 장갑판', icon: '⛊' },
  { id: 'C_agi', major: 'agi', name: '추진 모듈', icon: '➶' },
];
const COMP_PTS = 3;
const GRADE_PTS = 12; // 고급: 같은 재료 2개

/** craft: false = 조합식 없음 (상점 · 보급 · 전리품 등에서만, 같은 재료 희귀처럼) */
interface AdvDef { id: string; a: Major; b: Major; craft?: false; name: string; desc: (k: number) => string; effect: (k: number) => Effect }
/** 위협 신호기: 도발 배율 1당 받는 피해 감소 · 상한 (고정 피해 제외) */
const TAUNT_RED = 0.03, TAUNT_CAP = 0.3;
/** 수호자 판금: 전투 시작 보호막 (최대 체력 비율, 전설 3배). 12% → 24% 상향: 같은 시드 1200판 18% 대비 클리어 +1.4%p (성공→실패 14 · 실패→성공 31),
 *  페이즈 보정 장착 승률은 희귀 17종 중 12위 (+0.5%p, 범위 −1.1 ~ +3.5) — 상위권을 넘지 않는다. 전설은 12% 때 −8%p 로 가장 낮았다.
 *  재확인 (d9a35db, 같은 시드 400판): 12% → 24% 클리어 +1.0%p (성공→실패 7 · 실패→성공 11), 24% → 32% 는 −0.2%p 로 더 올려도 효과가 없어 24% 유지 */
const PLATE_SHIELD = 0.24;
/** 수호자 판금: 보호막이 남아 있는 동안 받는 피해 배율 (희귀 · 전설). 다른 경감과 따로 곱하는 독립 경감이고, 위협 신호기처럼 고정 피해에는 걸리지 않는다.
 *  추가 (bb84837 대비 같은 시드 400판, 위험 0): 클리어 44.75% → 44.50% (성공→실패 6 · 실패→성공 5, 차이 없음), 페이즈 보정 장착 승률 +1.3 → +1.7%p
 *  (희귀 17종 중 16위 → 14위). 위험 7 400판도 +5.0 → +5.9%p (11위). 상위권을 넘지 않아 보호막 24% 그대로 둔다 */
const PLATE_TAKEN = 0.9, PLATE_TAKEN_L = 0.8;
const plateTaken = (k: number) => (k > 1 ? PLATE_TAKEN_L : PLATE_TAKEN);

const ADV: AdvDef[] = [
  { id: 'vit_vit', a: 'vit', b: 'vit', name: '재생 외골격', desc: (k) => `초당 최대 체력 ${k}% 회복.`,
    effect: (k) => ({ hooks: { onTick(bt, u, dt) { u.mem.exo = (u.mem.exo || 0) + dt; if (u.mem.exo >= 1) { u.mem.exo = 0; bt.heal(u, u, bt.S(u, 'maxHp') * 0.01 * k); } } } }) },
  { id: 'vit_pow', a: 'vit', b: 'pow', name: '광전사 갑주', desc: (k) => `체력 50% 이하일 때 피해 +${30 * k}%.`,
    effect: (k) => ({ hooks: { dmgMult: (bt, u) => (bt.hpPct(u) <= 0.5 ? 1 + 0.3 * k : 1) } }) },
  { id: 'vit_mnd', a: 'vit', b: 'mnd', name: '생체 동기화기', desc: (k) => `회복 효율 +${30 * k}%, 효과 저항 +${15 * k}%p.`,
    effect: () => ({ stats: { healEff: 0.3, effRes: 0.15 } }) },
  { id: 'vit_def', a: 'vit', b: 'def', name: '수호자 판금',
    desc: (k) => `전투 시작 시 최대 체력 ${Math.round(PLATE_SHIELD * 100 * k)}% 보호막. 보호막이 남아 있는 동안 받는 피해 -${Math.round((1 - plateTaken(k)) * 100)}% (다른 경감과 따로 곱하는 독립 경감, 고정 피해 제외).`,
    effect: (k) => ({ hooks: {
      onStart(bt, u) { bt.shield(u, bt.S(u, 'maxHp') * PLATE_SHIELD * k); },
      takenMult: (_bt, u, _src, o) => (o.elem !== 'true' && u.shield > 0 ? plateTaken(k) : 1),
    } }) },
  { id: 'vit_agi', a: 'vit', b: 'agi', name: '생존 키트', desc: (k) => `치명적인 피해를 받으면 전투당 ${k}회 버티고 체력 15% 회복.`,
    effect: (k) => ({ hooks: { onLethal(bt, u) { if ((u.mem.kit || 0) >= k) return false; u.mem.kit = (u.mem.kit || 0) + 1; u.hp = 1; bt.heal(u, u, bt.S(u, 'maxHp') * 0.15, true); return true; } } }) },
  { id: 'pow_pow', a: 'pow', b: 'pow', name: '과출력 무기', desc: (k) => `모든 피해 +${15 * k}%.`,
    effect: () => ({ mods: [inc('all', 0.15)] }) },
  { id: 'pow_mnd', a: 'pow', b: 'mnd', name: '조준 보조 AI', desc: (k) => `치명타 확률 +${5 * k}%p, 치명타 피해 +${40 * k}%p.`,
    effect: () => ({ stats: { crit: 0.05, critDmg: 0.4 } }) },
  { id: 'pow_def', a: 'pow', b: 'def', name: '중력 해머', desc: (k) => `기본 공격 시 ${Math.min(100, 20 * k)}% 확률로 대상 1초 기절.`,
    effect: (k) => ({ hooks: { onBasic(bt, u, t) { if (t.alive && bt.rng.chance(0.2 * k)) bt.stun(u, t, 1); } } }) },
  { id: 'pow_agi', a: 'pow', b: 'agi', name: '고속 연사 장치', desc: (k) => `공격 속도 +${30 * k}%.`,
    effect: () => ({ stats: { atkSpd: 0.3 } }) },
  { id: 'mnd_mnd', a: 'mnd', b: 'mnd', name: '사이오닉 증폭기', desc: (k) => `기술 위력 +${30 * k}%, 효과 명중 +${20 * k}%p, 기술 피해 +${10 * k}%, 회복 효율 +${15 * k}%.`,
    effect: () => ({ pct: { tech: 0.3 }, stats: { effHit: 0.2, healEff: 0.15 }, mods: [inc('tech', 0.1)] }) },
  { id: 'mnd_def', a: 'mnd', b: 'def', name: '전자전 모듈', desc: (k) => `기본 공격 시 ${Math.min(100, 20 * k)}% 확률로 대상 2초 감전.`,
    effect: (k) => ({ hooks: { onBasic(bt, u, t) { if (t.alive && bt.rng.chance(0.2 * k)) bt.applyStatus(u, t, { type: 'shock', key: 'shock', dur: 2 }); } } }) },
  { id: 'mnd_agi', a: 'mnd', b: 'agi', name: '예지 회로', desc: (k) => `쿨다운 감소 속도 +${30 * k}%.`,
    effect: () => ({ stats: { cdr: 0.3 } }) },
  { id: 'def_def', a: 'def', b: 'def', name: '요새 장갑', desc: (k) => `받는 피해 -${Math.min(80, 15 * k)}%.`,
    effect: () => ({ taken: [red('all', 0.15)] }) },
  { id: 'def_agi', a: 'def', b: 'agi', name: '반응 장갑', desc: (k) => `받은 피해의 ${25 * k}%를 공격자에게 고정 피해로 반사.`,
    effect: (k) => ({ hooks: { onStart(bt, u) { bt.buff(u, u, 'item.reactive', 999, { reflectTrue: 0.25 * k, label: '' }); } } }) },
  { id: 'agi_agi', a: 'agi', b: 'agi', name: '위상 이동기', desc: (k) => `회피 +${7.5 * k}%p. 회피할 때마다 공격 속도 +${5 * k}% (최대 10중첩).`,
    effect: (k) => ({
      stats: { eva: 0.075 },
      hooks: { onEvade(bt, u) { u.mem.phase = Math.min(10, (u.mem.phase || 0) + 1); const s = u.statuses.find((x) => x.key === 'item.phase'); const d = { atkSpd: 0.05 * k * u.mem.phase }; if (s) s.delta = d; else bt.buff(u, u, 'item.phase', 999, { delta: d, label: '' }); } },
    }) },
  // 조합식 없는 희귀 (상점 · 보급 · 전리품): 도발 배율을 올려 적의 표적을 끌고, 돌격가라면 경계 교전 시간도 늘린다 (CFG.zoc.holdPerProv)
  { id: 'taunt', a: 'vit', b: 'def', craft: false, name: '위협 신호기',
    desc: (k) => `도발 배율 +${k}. 받는 피해가 도발 배율 1당 ${Math.round(TAUNT_RED * 100)}% 줄어든다 (고정 피해 제외, 최대 ${Math.round(TAUNT_CAP * 100)}%). 돌격가가 달면 경계 교전 시간도 +${+(k * CFG.zoc.holdPerProv).toFixed(3)}초 (도발 배율 1당 ${CFG.zoc.holdPerProv}초).`,
    effect: (k) => ({
      setup: (u) => { u.mem.provPlus = (u.mem.provPlus || 0) + k; },
      hooks: { takenMult: (bt, u, _src, o) => (o.elem === 'true' ? 1 : 1 - Math.min(TAUNT_CAP, TAUNT_RED * provMult(bt, u))) },
    }) },
];
// stats/pct/mods/taken 기반 효과는 scaleEffect 로 배율 적용, 훅 기반은 k 를 직접 받는다
const HOOK_SCALED = new Set(['vit_vit', 'vit_pow', 'vit_def', 'vit_agi', 'pow_def', 'mnd_def', 'def_agi', 'agi_agi', 'taunt']);

export interface ItemInfo { id: string; tier: 'C' | 'G' | 'A' | 'L' | 'M' | 'K' | 'T' | 'J'; name: string; icon: string; majors: Partial<Record<Major, number>>; desc: string; recipe?: [string, string] }

const ADV_BY_ID = Object.fromEntries(ADV.map((a) => [a.id, a]));

const UNIQUE: Record<string, { name: string; icon: string; desc: string; effect: Effect }> = {
  U_shade: {
    name: '[고유] 그늘', icon: '☂', desc: '아문센 전용 · 해제 불가. 기술 쿨다운 감소 속도 +150%, 모든 아군 회피 및 치명타 확률 +10%p.',
    effect: {
      stats: { cdr: 1.5 },
      hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'item.shade', 999, { delta: { eva: 0.1, crit: 0.1 }, label: '그늘' }); } },
    },
  },
  // 공왕 무휼 전용 (청라공국 3 · 5 · 7명에 해금, 자동 장착 · 해제 불가 · 일반 기물 장착 불가). data/chungra.ts KING_GEAR
  U_mh_seal: {
    name: `[고유] ${KING_GEAR_NAME.U_mh_seal}`, icon: '印', desc: '무휼 전용 · 청라공국 3명에 해금. 모든 주요 능력치 +4, 피해량 경감 10%.',
    effect: { majors: { vit: 4, pow: 4, mnd: 4, def: 4, agi: 4 }, taken: [red('all', 0.1)] },
  },
  U_mh_bow: {
    name: `[고유] ${KING_GEAR_NAME.U_mh_bow}`, icon: '弓', desc: '무휼 전용 · 청라공국 5명에 해금. 전투력 +8, 공격 속도 +20%. 기본 공격이 대상 주변 1칸의 다른 적에게 사격 위력 40% 물리 피해.',
    effect: { majors: { pow: 8 }, stats: { atkSpd: 0.2 }, hooks: { onBasic(b, u, t, r) {
      if (r.miss) return;
      for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) b.dealDamage(u, e, b.S(u, 'shoot') * 0.4, { elem: 'phys', tag: 'proc', kind: 'shoot' });
    } } },
  },
  U_mh_sword: {
    name: `[고유] ${KING_GEAR_NAME.U_mh_sword}`, icon: '劍', desc: '무휼 전용 · 청라공국 7명에 해금. 사이오닉 의식검. 정신력 +8, 쿨다운 감소 속도 +30%. 전투 스킬을 쓰면 대상에게 전술 위력 120% 정신 피해를 더한다.',
    effect: { majors: { mnd: 8 }, stats: { cdr: 0.3 }, hooks: { onSkill(b, u) {
      const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
      if (t) { b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'psy', ranged: true }); b.dealDamage(u, t, b.P(u, 'tech') * 1.2, { elem: 'psy', tag: 'proc', kind: 'tech' }); }
    } } },
  },
};
export const isLocked = (id: string | null) => !!id && id.startsWith('U_');

// ── 유닉스제 잡동사니 (J_): 절망 증강 [유닉스제 대량 생산]이 희귀 · 고급 장비 대신 끼워 넣는다. 기능 없음 (조합 · 전설 주조 불가, 판매 CFG.sell.J)
//    캣휠은 밍키가 달면 모든 주요 능력치 +CFG.despair.catwheelMajors (itemEffect 의 owner)
const JUNK: Record<string, { name: string; icon: string; desc: string; cat?: boolean }> = {
  J_catwheel: { name: '캣휠', icon: '◎', desc: '[유닉스제] 아무 기능이 없다. 한 성계의 빛을 가릴 만큼 만들어졌다. 고양이라면 또 모르겠다.', cat: true },
};
export const isJunk = (id: string | null | undefined) => !!id && !!JUNK[id];
/** 잡동사니 id 목록 (도감) */
export const JUNK_IDS = Object.keys(JUNK);
/** 고유 장비 id 목록 (도감) */
export const UNIQUE_IDS = Object.keys(UNIQUE);

// ── 개조부품: 장비 칸과 별도인 1칸. 문장 = 장착한 기물이 해당 시너지에 추가 소속, 신비 부품(O_) = 신비학자 전용 특수 효과
export const isEmblem = (id: string | null) => !!id && id.startsWith('M_');
export const isOccultMod = (id: string | null) => !!id && id.startsWith('O_');
export const isMod = (id: string | null) => isEmblem(id) || isOccultMod(id);
export const isConsumable = (id: string | null) => !!id && id.startsWith('K_');

const WARD = (elem: 'phys' | 'chem' | 'elec' | 'psy' | 'holy', name: string, icon: string) =>
  ({ name: `${name} 결계`, icon, tier: 1 as const, desc: `받는 ${ELEM_NAME[elem]} 피해 -45%. 그 피해의 30%를 공격자에게 고정 피해로 되돌려줍니다.`,
    effect: { taken: [red(elem, 0.45)], hooks: { onHurt(b, u, src, r, o) { if (o.elem === elem && o.tag !== 'proc' && r.amount > 0 && src.alive && src !== u) b.dealDamage(u, src, r.amount * 0.3, { elem: 'true', tag: 'proc', noHooks: true }); } } } as Effect });
/** 신비학자 4단계 부품 수치: 심연의 눈 · 영원의 성배 · 금서 사본 */
const OC4 = { abyss: { dur: 5, vuln: 0.2, crit: 0.15 }, grail: { red: 0.2, regen: 0.02 }, codex: { dmg: 0.1, max: 10, cdr: 0.3 } };
const pc = (x: number) => `${Math.round(x * 100)}%`;
/** 신비학자 전용 개조부품. tier = 해금되는 신비학자 단계 */
export const OCCULT_MODS: Record<string, { name: string; icon: string; tier: 1 | 2 | 3 | 4; desc: string; effect: Effect }> = {
  O_reach: { name: '천리안 렌즈', icon: '◎', tier: 1, desc: '기본 공격 사거리 +1, 명중 +10%p.', effect: { stats: { range: 1, acc: 0.1 } } },
  O_feast: { name: '포식의 인장', icon: '✺', tier: 1, desc: '결정타를 날리면 최대 체력 10% 회복, 3초간 피해 +30%.',
    effect: { hooks: { onKill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * 0.1, true); b.buff(u, u, 'oc.feast', 3, { mods: [inc('all', 0.3)], label: '포식' }); } } } },
  O_ward_phys: WARD('phys', '강철', '⛊'),
  O_ward_psy: WARD('psy', '정신', '◈'),
  O_ward_chem: { ...WARD('chem', '정화', '☣'), tier: 2 },
  O_ward_elec: { ...WARD('elec', '절연', 'ϟ'), tier: 2 },
  O_ward_holy: { ...WARD('holy', '모독', '✧'), tier: 2 },
  O_mirror: { name: '초반사 거울', icon: '◇', tier: 2, desc: '받은 피해의 80%를 공격자에게 고정 피해로 반사합니다. 받는 피해 -10%.',
    effect: { taken: [red('all', 0.1)], hooks: { onStart(b, u) { b.buff(u, u, 'oc.mirror', 999, { reflectTrue: 0.8, label: '' }); } } } },
  O_echo: { name: '메아리 회로', icon: '↻', tier: 2, desc: '전투 기술을 쓰면 40% 확률로 쿨다운이 절반만 돌아옵니다. 쿨다운 감소 속도 +20%.',
    effect: { stats: { cdr: 0.2 }, hooks: { onSkill(b, u) { if (b.rng.chance(0.4)) u.cd *= 0.5; } } } },
  O_soul: { name: '영혼 수확기', icon: '☠', tier: 3, desc: '전장에서 누구든 쓰러질 때마다 이 전투 동안 피해 +12% (최대 10중첩).',
    effect: { hooks: { onAnyDeath(b, u) { if (!u.alive) return; u.mem.soul = Math.min(10, (u.mem.soul || 0) + 1); }, dmgMult: (_b, u) => 1 + 0.12 * (u.mem.soul || 0) } } },
  O_aegis: { name: '불멸의 부적', icon: '☥', tier: 3, desc: '전투당 1회, 치명적인 피해를 받으면 쓰러지지 않고 체력 18% 회복 + 3초 무적.',
    effect: { hooks: { onLethal(b, u) { if (u.mem.aegis) return false; u.mem.aegis = 1; u.hp = 1; b.heal(u, u, b.S(u, 'maxHp') * 0.18, true); u.mem.invulnUntil = b.t + 3; b.emit({ k: 'mark', id: u.id, name: '불멸', style: 'immortal' }); return true; } } } },
  O_void: { name: '공허 렌즈', icon: '◉', tier: 3, desc: '방어 관통 +40%p, 치명타 피해 +40%p.', effect: { stats: { armorPen: 0.4, critDmg: 0.4 } } },
  // 4단계 (신비학자 8명): 문장 2개가 있어야 닿는 완성 보상. 적은 달지 않는다 (run.ts gearEnemies)
  O_abyss: { name: '심연의 눈', icon: '⊛', tier: 4, desc: `기본 공격 · 전투 기술로 맞힌 적에게 [심연] (${OC4.abyss.dur}초, 효과 명중 판정): 받는 모든 피해 +${pc(OC4.abyss.vuln)}. 치명타 확률 +${pc(OC4.abyss.crit)}p.`,
    effect: { stats: { crit: OC4.abyss.crit }, hooks: { onDeal(b, u, t, r, o) {
      if ((o.tag !== 'basic' && o.tag !== 'skill') || r.amount <= 0 || !t.alive || t.side === u.side) return;
      b.applyStatus(u, t, { type: 'buff', key: 'oc.abyss', dur: OC4.abyss.dur, taken: [vuln('all', OC4.abyss.vuln)], label: '심연' });
    } } } },
  O_grail: { name: '영원의 성배', icon: '♁', tier: 4, desc: `받는 피해 -${pc(OC4.grail.red)}. 전투 중 매초 최대 체력 ${pc(OC4.grail.regen)} 회복.`,
    effect: { taken: [red('all', OC4.grail.red)], hooks: { onTick(b, u, dt) { u.mem.grailT = (u.mem.grailT || 0) + dt; if (u.mem.grailT >= 1) { u.mem.grailT -= 1; b.heal(u, u, b.S(u, 'maxHp') * OC4.grail.regen, true); } } } } },
  O_codex: { name: '금서 사본', icon: '❖', tier: 4, desc: `전투 기술을 쓸 때마다 이 전투 동안 피해 +${pc(OC4.codex.dmg)} (최대 ${OC4.codex.max}중첩). 쿨다운 감소 속도 +${pc(OC4.codex.cdr)}.`,
    effect: { stats: { cdr: OC4.codex.cdr }, hooks: { onSkill(_b, u) { u.mem.codex = Math.min(OC4.codex.max, (u.mem.codex || 0) + 1); }, dmgMult: (_b, u) => 1 + OC4.codex.dmg * (u.mem.codex || 0) } } },
};
export const occultModsOfTier = (t: number) => Object.keys(OCCULT_MODS).filter((k) => OCCULT_MODS[k].tier === t);

/** 갓 구운 빵 회복량: 위험 등급 d 이하에서 가장 높은 등급의 값 (CFG.chef.breadHeal), 표의 가장 낮은 등급보다 낮으면 그 등급의 값. stale = 식은 빵 (−staleHeal, 최소 1) */
export function breadHeal(d: number | undefined, stale = false): number {
  const v = breadHealBase(d);
  return stale ? Math.max(1, v - CFG.chef.staleHeal) : v;
}
/** 빵 판매가: 셰프 단계 tier 기준 (CFG.chef.breadSell), 식은 빵 −staleSell */
export const breadSell = (tier: number, stale = false) => Math.max(0, (CFG.chef.breadSell[Math.min(tier, CFG.chef.breadSell.length - 1)] ?? CFG.sell.K) - (stale ? CFG.chef.staleSell : 0));
/** 갓 구운 빵 · 식은 빵 */
export const isBread = (id: string | null | undefined) => id === 'K_bread' || id === 'K_bread_stale';
function breadHealBase(d: number | undefined): number {
  const t = CFG.chef.breadHeal.slice().sort((a, b) => a[0] - b[0]);
  let v = t[0]?.[1] || 0;
  for (const [l, h] of t) if ((d || 0) >= l) v = h;
  return v;
}
/** 회복량 표기: '쉬움 10 · 모험 7 · 고난 5' (등급 이름은 difficulty.ts, 이름이 없는 등급은 '위험 n') */
const breadHealText = (stale = false) => CFG.chef.breadHeal.map(([l, h]) => `${diffName(l) || `위험 ${l}`} ${stale ? Math.max(1, h - CFG.chef.staleHeal) : h}`).join(' · ');
const injText = (id: string) => `기물에 사용: 공명도 +${CFG.inject.amount[id]}.`;

/** 소모품: 보관함에서 기물 · 장비 · 적에게 끌어다 사용.
 *  target: unit 기물 · item 장비 · foe 이번 전투의 적 (편성 화면) · run 바로 사용 (함대 전체)
 *  drop = 합성 공방에서 팔지 않음 (전투 보상 · 상점 · 시너지) · legend = 전설급 (공개 연출 3단계 · 금색 테두리) · chef = 셰프 시너지 전용 */
export const CONSUMABLES: Record<string, { name: string; icon: string; target: 'unit' | 'item' | 'foe' | 'run'; price: number; desc: string; drop?: boolean; legend?: boolean; chef?: boolean }> = {
  // 신비학자 [합성] 공방 상품 (price = 합성 가격)
  K_rank: { name: '공명 촉매', icon: '▲', target: 'unit', price: 10, desc: '기물에 사용: 공명 등급 +1.' },
  K_morph: { name: '변성 촉매', icon: '⟳', target: 'unit', price: 14, desc: '기물에 사용: 보유하지 않은 무작위 기물로 바뀌고 공명 등급 +3. 장비 · 개조부품 · 배치는 그대로 이어받습니다.' },
  K_legend: { name: '전설 주조액', icon: '★', target: 'item', price: 24, desc: '장비에 사용: 전설 등급으로 바꿉니다 (재료 · 고급은 같은 계열의 전설로).' },
  K_copy: { name: '복제 배양조', icon: '⧉', target: 'item', price: 30, desc: '장비에 사용: 똑같은 장비 1개를 보관함에 만듭니다.' },
  // 전투 보상 · 상점 (합성 공방에서는 팔지 않음, 상점 가격은 CFG.shop.price)
  K_strip: { name: '분리 용제', icon: '⇲', target: 'unit', price: 0, drop: true, desc: '기물에 사용: 장착한 장비를 모두 해제해 보관함으로 돌려보냅니다 (고유 장비 · 개조부품 제외).' },
  K_reroll: { name: '재구성 회로', icon: '⟲', target: 'unit', price: 0, drop: true, desc: '기물에 사용: 장착한 장비를 모두 같은 등급의 다른 무작위 장비로 바꿉니다 (고유 장비 · 개조부품 제외).' },
  // 공명 주입기: 소형 · 중형 · 대형 (K_xp 는 예전 '공명 주입기' 그대로 = 소형, 세이브 호환). 크기는 페이즈에 따라 (injectorWeights)
  K_xp: { name: '소형 공명 주입기', icon: '✚', target: 'unit', price: 0, drop: true, get desc() { return injText('K_xp'); } },
  K_xp2: { name: '중형 공명 주입기', icon: '✚', target: 'unit', price: 0, drop: true, get desc() { return injText('K_xp2'); } },
  K_xp3: { name: '대형 공명 주입기', icon: '✚', target: 'unit', price: 0, drop: true, get desc() { return injText('K_xp3'); } },
  // 전설급
  K_seize: { name: '강제 징수기', icon: '⚒', target: 'foe', price: 0, drop: true, legend: true,
    desc: '편성 화면에서 이번 전투의 적 1명에게 사용 (보스 포함): 그 적이 단 장비 · 개조부품을 모두 떼어 냅니다. 떼어 낸 것 중 등급이 가장 높은 1개(전설 > 개조부품 > 희귀 > 고급 > 재료)가 보관함으로 들어오고, 나머지는 부서집니다.' },
  K_rank3: { name: '원초 공명석', icon: '◆', target: 'unit', price: 0, drop: true, legend: true, desc: '기물에 사용: 공명 등급 +3. 정제되지 않은 공명석 원핵이 기물의 공명 구조를 단숨에 끌어올립니다.' },
  // 셰프 시너지
  K_bread: { name: '갓 구운 빵', icon: '◒', target: 'run', price: 0, drop: true, chef: true, get desc() { return `바로 사용: 플레이어 체력 회복 (위험 등급에 따라 ${breadHealText()}). 얻은 뒤 전투 ${CFG.chef.staleAfter}회를 지나면 식은 빵이 됩니다 (셰프 ${SYN_BY_ID.CHEF?.tiers[CFG.chef.noStaleTier - 1] ?? ''}명 이상이 켜진 전투는 세지 않음). 셰프들이 남는 시간에 구워 둔 빵.`; } },
  K_bread_stale: { name: '식은 빵', icon: '◒', target: 'run', price: 0, drop: true, chef: true, get desc() { return `바로 사용: 플레이어 체력 회복 (위험 등급에 따라 ${breadHealText(true)}). 갓 구운 빵이 전투 ${CFG.chef.staleAfter}회를 지나 식었다. 회복량 −${CFG.chef.staleHeal} · 판매가 −${CFG.chef.staleSell}.`; } },
};
/** 합성 공방 상품 */
export const ALL_CONSUMABLES = Object.keys(CONSUMABLES).filter((k) => !CONSUMABLES[k].drop);
/** 공명 주입기 (소형 · 중형 · 대형) */
export const INJECTORS = ['K_xp', 'K_xp2', 'K_xp3'];
export const isInjector = (id: string | null | undefined) => !!id && INJECTORS.includes(id);
export const injectAmount = (id: string) => CFG.inject.amount[id] || 0;
/** 페이즈 p 에서 나올 수 있는 공명 주입기와 가중치 (CFG.inject): 시작 페이즈 전에는 없음, smallTo 가 지나면 소형 가중치를 중형이 가져간다 */
export function injectorWeights(p: number): [string, number][] {
  const I = CFG.inject;
  const out: [string, number][] = [];
  for (const id of INJECTORS) {
    if (p < I.from[id] || (id === 'K_xp' && p > I.smallTo)) continue;
    out.push([id, I.w[id] + (id === 'K_xp2' && p > I.smallTo ? I.w.K_xp : 0)]);
  }
  return out;
}
/** 전설급 소모품 (공개 연출 · 이름 색) */
export const isLegendConsumable = (id: string | null | undefined) => !!id && !!CONSUMABLES[id]?.legend;
/** 공개 연출 등급 (revealfx · sound 공용): 전설 장비 · 전설급 소모품 3, 희귀 2, 그 밖 1 */
export const revealGrade = (id: string): 1 | 2 | 3 => { const t = itemInfo(id).tier; return isLegendConsumable(id) || t === 'L' ? 3 : t === 'A' ? 2 : 1; };
/** 장비 등급 순위 (강제 징수기가 가져올 1개를 고를 때): 전설 > 개조부품 > 희귀 > 고급 > 재료 */
export const gearRank = (id: string) => (id[0] === 'L' ? 5 : isMod(id) ? 4 : id[0] === 'A' ? 3 : id[0] === 'G' ? 2 : id[0] === 'C' ? 1 : 0);
export const emblemOf = (id: string) => id.slice(2) as SynergyId;
export const emblemId = (syn: SynergyId) => `M_${syn}`;

// ── 헬레니우스 동맹 전용 장비: 희귀(A_) 1배 · 전설(L_) 2배 (4단계 도달 시 승격)
const HEL_ITEMS: Record<string, { name: string; icon: string; major: Major; desc: (k: number) => string; effect: (k: number) => Effect }> = {
  helanchor: { name: '성운 정박기', icon: '⚓', major: 'mnd', desc: (k) => `해로운 효과를 걸 때 지속 시간 +${2 * k}초.`,
    effect: (k) => ({ hooks: { onInflict(_b, u, tgt, s) { if (tgt.side !== u.side) s.dur += 2 * k; } } }) },
  hellight: { name: '달빛 등대', icon: '☾', major: 'agi', desc: (k) => `회피하면 최대 체력 ${3 * k}% 회복.`,
    effect: (k) => ({ hooks: { onEvade(b, u) { b.heal(u, u, b.S(u, 'maxHp') * 0.03 * k, true); } } }) },
  helrelic: { name: '올림푸스 성물', icon: '⚱', major: 'def', desc: (k) => `한 번에 최대 체력 ${35 / k}%를 넘는 피해를 받지 않음.`,
    effect: (k) => ({ setup: (u) => { u.mem.hitCap = Math.min(u.mem.hitCap || 1, 0.35 / k); } }) },
};
export const HEL_ITEM_IDS = ['A_helanchor', 'A_hellight', 'A_helrelic'];
export const isHelItem = (id: string | null) => !!id && !!HEL_ITEMS[id.slice(2)];

// ── 엔지니어 포탑 전용 장비 (T_): 포탑 장비 칸에만 장착. 일반 기물 · 일반 장비 풀 · 재구성과 섞이지 않는다
export interface TurretGear { name: string; icon: string; grade: 'basic' | 'adv'; desc: string; effect: Effect }
/** 포탑 장비 가격 (정비 노드): 보급형 = 재료~고급 사이, 고급형 = 희귀와 같은 급 */
export const TURRET_PRICE = { basic: 9, adv: 18 } as const;
const tPow = (b: import('../engine/combat').Battle, u: import('../engine/combat').CUnit) => b.S(u, 'shoot');
export const TURRET_GEAR: Record<string, TurretGear> = {
  T_cal: { name: '대구경 포신', icon: '◉', grade: 'basic', desc: '포탑 피해 +35%.', effect: { mods: [inc('all', 0.35)] } },
  T_plate: { name: '증가 장갑', icon: '⛊', grade: 'basic', desc: '포탑 최대 체력 +50%, 방어도 +50%.', effect: { pct: { maxHp: 0.5, armor: 0.5 } } },
  T_cryo: { name: '냉각탄', icon: '❄', grade: 'basic', desc: '기본 공격이 대상을 2초간 둔화 (공격 · 이동 속도 -25%p).',
    effect: { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) slow(b, u, t, 0.25, 2); } } } },
  T_ammo: { name: '탄약 증설', icon: '⁂', grade: 'basic', desc: '공격 속도 +30%p. 기본 공격 3번째마다 같은 대상에게 한 발 더 쏩니다 (사격 위력 100%).',
    effect: { stats: { atkSpd: 0.3 }, hooks: { onBasic(b, u, t) {
      u.mem.tAmmo = (u.mem.tAmmo || 0) + 1;
      if (u.mem.tAmmo % 3 === 0 && t.alive) { b.emit({ k: 'atk', from: u.id, to: t.id, elem: u.atk.elem, ranged: true }); b.dealDamage(u, t, tPow(b, u), { elem: u.atk.elem, tag: 'proc', kind: 'shoot', canMiss: true }); }
    } } } },
  T_barrier: { name: '방벽 모듈', icon: '⬡', grade: 'basic', desc: '전투 시작 시 포탑 최대 체력 40% 보호막, 이후 10초마다 최대 체력 20% 보호막.',
    effect: { hooks: {
      onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.4); },
      onTick(b, u, dt) { u.mem.tBar = (u.mem.tBar || 0) + dt; if (u.mem.tBar >= 10) { u.mem.tBar = 0; b.shield(u, b.S(u, 'maxHp') * 0.2); } },
    } } },
  T_selfd: { name: '자폭 회로', icon: '✸', grade: 'basic', desc: '포탑이 파괴되면 주변 2칸 적에게 포탑 최대 체력 60% 물리 피해 + 1초 기절.',
    effect: { hooks: { onLethal(b, u) {
      if (u.mem.tBoom) return false;
      u.mem.tBoom = 1;
      b.fx(u.x, u.y, 2, 'phys');
      b.emit({ k: 'status', id: u.id, name: '자폭!' });
      for (const e of b.around(u, 2, b.enemiesOf(u))) { b.dealDamage(u, e, b.S(u, 'maxHp') * 0.6, { elem: 'phys', tag: 'proc' }); if (e.alive) b.stun(u, e, 1); }
      return false;
    } } } },
  T_rapid: { name: '과급 급탄기', icon: '≫', grade: 'adv', desc: '포탑 공격 속도 +100%p.', effect: { stats: { atkSpd: 1.0 } } },
  T_tesla: { name: '테슬라 코일', icon: 'ϟ', grade: 'adv', desc: '기본 공격이 전기 피해로 바뀌고, 맞히면 사격 위력 50% 계수의 전기 속성 피해가 2칸 내의 적에게 최대 2회 바운스된다.',
    effect: {
      setup: (u) => { u.atk = { ...u.atk, elem: 'elec' }; },
      hooks: { onBasic(b, u, t, r) {
        if (r.amount <= 0) return;
        let at = t, prev: import('../engine/combat').CUnit | null = null;
        for (let i = 0; i < 2; i++) {
          const next = b.nearest(at, b.around(at, 2, b.enemiesOf(u)).filter((e) => e !== at && e !== prev));
          if (!next) break;
          b.emit({ k: 'atk', from: at.id, to: next.id, elem: 'elec', ranged: true, chain: true });
          b.dealDamage(u, next, tPow(b, u) * 0.5, { elem: 'elec', tag: 'proc', kind: 'shoot' });
          prev = at; at = next;
        }
      } },
    } },
  T_flame: { name: '화염 방사기', icon: '♨', grade: 'adv', desc: '사거리가 2로 줄어드는 대신, 기본 공격이 대상 주변 1칸 다른 적도 관통해 같은 피해를 주고 맞은 적마다 [연소] 1중첩 (중첩당 초당 사격 위력 12% 물리 피해, 최대 5중첩, 5초).',
    effect: {
      setup: (u) => { u.mem.tFlame = 1; },
      hooks: { onBasic(b, u, t, r) {
        const burn = (e: import('../engine/combat').CUnit) => { const per = tPow(b, u) * 0.12; b.applyStatus(u, e, { type: 'dot', key: 'burn', dur: 5, elem: 'phys', stacks: 1, maxStacks: 5, perDps: per, dps: per, label: '연소' }); };
        if (r.amount > 0 && t.alive) burn(t);
        b.fx(t.x, t.y, 1, 'phys');
        for (const e of b.around(t, 1, b.enemiesOf(u)).filter((x) => x !== t)) {
          const r2 = b.dealDamage(u, e, tPow(b, u), { elem: u.atk.elem, tag: 'proc', kind: 'shoot' });
          if (r2.amount > 0 && e.alive) burn(e);
        }
      } },
    } },
  T_snipe: { name: '저격 포신', icon: '⌖', grade: 'adv', desc: '포탑 사거리 +2, 치명타 확률 +30%p, 치명타 피해 +60%p.', effect: { stats: { range: 2, crit: 0.3, critDmg: 0.6 } } },
  T_mark: { name: '표적 지시기', icon: '◎', grade: 'adv', desc: '포탑이 맞힌 적은 4초간 받는 모든 피해 +12% (중첩 안 됨).',
    effect: { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) b.applyStatus(u, t, { type: 'buff', key: 'tmark', dur: 4, taken: [vuln('all', 0.12)], label: '표적 지정' }); } } } },
};
export const TURRET_GEAR_IDS = Object.keys(TURRET_GEAR);
export const TURRET_BASIC = TURRET_GEAR_IDS.filter((k) => TURRET_GEAR[k].grade === 'basic');
export const TURRET_ADV = TURRET_GEAR_IDS.filter((k) => TURRET_GEAR[k].grade === 'adv');
export const isTurretGear = (id: string | null | undefined) => !!id && id.startsWith('T_') && !!TURRET_GEAR[id];
/** 포탑 1기의 장비 칸 수: 엔지니어 단계 1 (2명) 1칸, 2단계 (4명) 2칸, 3단계 (6명) 이상 3칸 */
export const turretSlots = (engTier: number) => (engTier >= 3 ? 3 : engTier >= 2 ? 2 : 1);

export function itemInfo(id: string): ItemInfo {
  if (isTurretGear(id)) { const g = TURRET_GEAR[id]; return { id, tier: 'T', name: g.name, icon: g.icon, majors: {}, desc: `[포탑 전용 · ${g.grade === 'adv' ? '고급형' : '보급형'}] ${g.desc}` }; }
  if (isHelItem(id)) {
    const h = HEL_ITEMS[id.slice(2)], k = id[0] === 'L' ? 2 : 1;
    return { id, tier: id[0] === 'L' ? 'L' : 'A', name: (k === 2 ? '[전설] ' : '') + h.name, icon: h.icon, majors: { [h.major]: 6 * k }, desc: `[동맹 전용] ${MAJOR_NAME[h.major]} +${6 * k}. ${h.desc(k)}` };
  }
  if (JUNK[id]) { const j = JUNK[id]; return { id, tier: 'J', name: j.name, icon: j.icon, majors: {}, desc: j.desc }; }
  if (CONSUMABLES[id]) { const c = CONSUMABLES[id]; return { id, tier: 'K', name: c.name, icon: c.icon, majors: {}, desc: `[소모품] ${c.desc}` }; }
  if (OCCULT_MODS[id]) { const o = OCCULT_MODS[id]; return { id, tier: 'M', name: o.name, icon: o.icon, majors: {}, desc: `[신비 개조부품] ${o.desc}` }; }
  if (UNIQUE[id]) return { id, tier: 'L', name: UNIQUE[id].name, icon: UNIQUE[id].icon, majors: {}, desc: UNIQUE[id].desc };
  if (isMod(id)) {
    const s = SYN_BY_ID[emblemOf(id)];
    const fx = emblemText(emblemOf(id)); // 문장 고유 효과 (장착한 기물 1명, data/emblems.ts)
    return { id, tier: 'M', name: `${s?.name || id} 문장`, icon: s?.icon || '◆', majors: {}, desc: `[개조부품] 장착한 기물이 ${s?.name || id} 시너지에 추가로 소속됩니다.${fx ? ` ${fx}` : ''}` };
  }
  const [tier, rest] = [id[0] as 'C' | 'G' | 'A' | 'L', id.slice(2)];
  if (tier === 'C') {
    const c = COMPONENTS.find((x) => x.id === id)!;
    return { id, tier, name: c.name, icon: c.icon, majors: { [c.major]: COMP_PTS }, desc: `${MAJOR_NAME[c.major]} +${COMP_PTS}` };
  }
  if (tier === 'G') {
    const c = COMPONENTS.find((x) => x.major === rest)!;
    return { id, tier, name: `고급 ${c.name}`, icon: c.icon, majors: { [c.major]: GRADE_PTS }, desc: `${MAJOR_NAME[c.major]} +${GRADE_PTS}`, recipe: [c.id, c.id] };
  }
  const a = ADV_BY_ID[rest];
  const k = tier === 'L' ? 3 : 1;
  const majors: Partial<Record<Major, number>> = {};
  majors[a.a] = (majors[a.a] || 0) + COMP_PTS * k;
  majors[a.b] = (majors[a.b] || 0) + COMP_PTS * k;
  const mtxt = Object.entries(majors).map(([m, v]) => `${MAJOR_NAME[m as Major]} +${v}`).join(', ');
  return {
    id, tier, name: (tier === 'L' ? '[전설] ' : '') + a.name, icon: COMPONENTS.find((c) => c.major === a.a)!.icon,
    majors, desc: `${mtxt}. ${a.desc(k)}`, recipe: tier === 'A' && a.a !== a.b && a.craft !== false ? [`C_${a.a}`, `C_${a.b}`] : undefined,
  };
}

/** owner: 장착한 기물 id (캣휠 · 밍키처럼 기물에 따라 달라지는 장비) */
export function itemEffect(id: string, owner?: string): Effect {
  if (JUNK[id]) { const k = JUNK[id].cat && owner === 'mingki' ? CFG.despair.catwheelMajors : 0; return k ? { majors: Object.fromEntries(MAJORS.map((m) => [m, k])) } : {}; }
  if (isTurretGear(id)) return TURRET_GEAR[id].effect;
  if (isHelItem(id)) { const h = HEL_ITEMS[id.slice(2)], k = id[0] === 'L' ? 2 : 1; return { ...h.effect(k), majors: { [h.major]: 6 * k } }; }
  if (UNIQUE[id]) return UNIQUE[id].effect;
  if (OCCULT_MODS[id]) return OCCULT_MODS[id].effect;
  if (isEmblem(id)) return emblemEffect(emblemOf(id)); // 문장 고유 효과 (data/emblems.ts)
  if (isMod(id) || isConsumable(id)) return {};
  const info = itemInfo(id);
  if (info.tier === 'C' || info.tier === 'G') return { majors: info.majors };
  const a = ADV_BY_ID[id.slice(2)];
  const k = info.tier === 'L' ? 3 : 1;
  const e = HOOK_SCALED.has(a.id) ? a.effect(k) : scaleEffect(a.effect(1), k);
  return { ...e, majors: info.majors };
}

export function combine(x: string, y: string): string | null {
  if (isLocked(x) || isLocked(y) || isMod(x) || isMod(y) || isConsumable(x) || isConsumable(y) || isTurretGear(x) || isTurretGear(y) || isJunk(x) || isJunk(y)) return null;
  // 같은 재료 2개 → 고급, 서로 다른 재료 2개 → 희귀. 전설은 조합 불가
  if (x[0] === 'C' && y[0] === 'C') {
    if (x === y) return `G_${x.slice(2)}`;
    const ma = x.slice(2), mb = y.slice(2);
    const order = ['vit', 'pow', 'mnd', 'def', 'agi'];
    const [p, q] = order.indexOf(ma) <= order.indexOf(mb) ? [ma, mb] : [mb, ma];
    return `A_${p}_${q}`;
  }
  return null;
}

export const ALL_ADVANCED = ADV.map((a) => `A_${a.id}`);
export const ALL_COMPONENTS = COMPONENTS.map((c) => c.id);
export const ALL_GRADED = COMPONENTS.map((c) => `G_${c.major}`);
