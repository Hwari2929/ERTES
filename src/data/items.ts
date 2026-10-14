import type { Effect } from '../engine/effects';
import { inc, red, scaleEffect } from '../engine/effects';
import type { Major, SynergyId } from '../types';
import { ELEM_NAME, MAJOR_NAME } from '../types';
import { SYN_BY_ID } from './synergies';

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

interface AdvDef { id: string; a: Major; b: Major; name: string; desc: (k: number) => string; effect: (k: number) => Effect }

const ADV: AdvDef[] = [
  { id: 'vit_vit', a: 'vit', b: 'vit', name: '재생 외골격', desc: (k) => `초당 최대 체력 ${k}% 회복.`,
    effect: (k) => ({ hooks: { onTick(bt, u, dt) { u.mem.exo = (u.mem.exo || 0) + dt; if (u.mem.exo >= 1) { u.mem.exo = 0; bt.heal(u, u, bt.S(u, 'maxHp') * 0.01 * k); } } } }) },
  { id: 'vit_pow', a: 'vit', b: 'pow', name: '광전사 갑주', desc: (k) => `체력 50% 이하일 때 피해 +${30 * k}%.`,
    effect: (k) => ({ hooks: { dmgMult: (bt, u) => (bt.hpPct(u) <= 0.5 ? 1 + 0.3 * k : 1) } }) },
  { id: 'vit_mnd', a: 'vit', b: 'mnd', name: '생체 동기화기', desc: (k) => `회복 효율 +${30 * k}%, 효과 저항 +${15 * k}%p.`,
    effect: () => ({ stats: { healEff: 0.3, effRes: 0.15 } }) },
  { id: 'vit_def', a: 'vit', b: 'def', name: '수호자 판금', desc: (k) => `전투 시작 시 최대 체력 ${20 * k}% 보호막.`,
    effect: (k) => ({ hooks: { onStart(bt, u) { bt.shield(u, bt.S(u, 'maxHp') * 0.2 * k); } } }) },
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
];
// stats/pct/mods/taken 기반 효과는 scaleEffect 로 배율 적용, 훅 기반은 k 를 직접 받는다
const HOOK_SCALED = new Set(['vit_vit', 'vit_pow', 'vit_def', 'vit_agi', 'pow_def', 'mnd_def', 'def_agi', 'agi_agi']);

export interface ItemInfo { id: string; tier: 'C' | 'G' | 'A' | 'L' | 'M' | 'K'; name: string; icon: string; majors: Partial<Record<Major, number>>; desc: string; recipe?: [string, string] }

const ADV_BY_ID = Object.fromEntries(ADV.map((a) => [a.id, a]));

const UNIQUE: Record<string, { name: string; icon: string; desc: string; effect: Effect }> = {
  U_shade: {
    name: '[고유] 그늘', icon: '☂', desc: '아문센 전용 · 해제 불가. 기술 쿨다운 감소 속도 +150%, 모든 아군 회피 및 치명타 확률 +10%p.',
    effect: {
      stats: { cdr: 1.5 },
      hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'item.shade', 999, { delta: { eva: 0.1, crit: 0.1 }, label: '그늘' }); } },
    },
  },
};
export const isLocked = (id: string | null) => !!id && id.startsWith('U_');

// ── 개조부품: 장비 칸과 별도인 1칸. 문장 = 장착한 기물이 해당 시너지에 추가 소속, 신비 부품(O_) = 신비학자 전용 특수 효과
export const isEmblem = (id: string | null) => !!id && id.startsWith('M_');
export const isOccultMod = (id: string | null) => !!id && id.startsWith('O_');
export const isMod = (id: string | null) => isEmblem(id) || isOccultMod(id);
export const isConsumable = (id: string | null) => !!id && id.startsWith('K_');

const WARD = (elem: 'phys' | 'chem' | 'elec' | 'psy' | 'holy', name: string, icon: string) =>
  ({ name: `${name} 결계`, icon, tier: 1 as const, desc: `받는 ${ELEM_NAME[elem]} 피해 -45%. 그 피해의 30%를 공격자에게 고정 피해로 되돌려줍니다.`,
    effect: { taken: [red(elem, 0.45)], hooks: { onHurt(b, u, src, r, o) { if (o.elem === elem && o.tag !== 'proc' && r.amount > 0 && src.alive && src !== u) b.dealDamage(u, src, r.amount * 0.3, { elem: 'true', tag: 'proc', noHooks: true }); } } } as Effect });
/** 신비학자 전용 개조부품. tier = 해금되는 신비학자 단계 */
export const OCCULT_MODS: Record<string, { name: string; icon: string; tier: 1 | 2 | 3; desc: string; effect: Effect }> = {
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
  O_aegis: { name: '불멸의 부적', icon: '☥', tier: 3, desc: '전투당 1회, 치명적인 피해를 받으면 쓰러지지 않고 체력 30% 회복 + 3초 무적.',
    effect: { hooks: { onLethal(b, u) { if (u.mem.aegis) return false; u.mem.aegis = 1; u.hp = 1; b.heal(u, u, b.S(u, 'maxHp') * 0.3, true); u.mem.invulnUntil = b.t + 3; b.emit({ k: 'status', id: u.id, name: '불멸' }); return true; } } } },
  O_void: { name: '공허 렌즈', icon: '◉', tier: 3, desc: '방어 관통 +40%p, 치명타 피해 +40%p.', effect: { stats: { armorPen: 0.4, critDmg: 0.4 } } },
};
export const occultModsOfTier = (t: number) => Object.keys(OCCULT_MODS).filter((k) => OCCULT_MODS[k].tier === t);

/** 신비학자 [합성] 전용 소모품: 보관함에서 기물 · 장비에 끌어다 사용 */
const XP_INJECT = 8;
export const CONSUMABLES: Record<string, { name: string; icon: string; target: 'unit' | 'item'; price: number; desc: string; drop?: boolean }> = {
  K_rank: { name: '공명 촉매', icon: '▲', target: 'unit', price: 10, desc: '기물에 사용: 공명 등급 +1.' },
  K_morph: { name: '변성 촉매', icon: '⟳', target: 'unit', price: 14, desc: '기물에 사용: 보유하지 않은 무작위 기물로 바뀌고 공명 등급 +3. 장비 · 개조부품 · 배치는 그대로 이어받습니다.' },
  K_legend: { name: '전설 주조액', icon: '★', target: 'item', price: 24, desc: '장비에 사용: 전설 등급으로 바꿉니다 (재료 · 고급은 같은 계열의 전설로).' },
  K_copy: { name: '복제 배양조', icon: '⧉', target: 'item', price: 30, desc: '장비에 사용: 똑같은 장비 1개를 보관함에 만듭니다.' },
  // 전투 보상 전용 (합성 공방에서는 팔지 않음)
  K_strip: { name: '분리 용제', icon: '⇲', target: 'unit', price: 0, drop: true, desc: '기물에 사용: 장착한 장비를 모두 해제해 보관함으로 돌려보냅니다 (고유 장비 · 개조부품 제외).' },
  K_reroll: { name: '재구성 회로', icon: '⟲', target: 'unit', price: 0, drop: true, desc: '기물에 사용: 장착한 장비를 모두 같은 등급의 다른 무작위 장비로 바꿉니다 (고유 장비 · 개조부품 제외).' },
  K_xp: { name: '공명 주입기', icon: '✚', target: 'unit', price: 0, drop: true, desc: `기물에 사용: 공명도 +${XP_INJECT}.` },
};
/** 합성 공방 상품 */
export const ALL_CONSUMABLES = Object.keys(CONSUMABLES).filter((k) => !CONSUMABLES[k].drop);
/** 전투 종료 보상 소모품 */
export const DROP_CONSUMABLES = Object.keys(CONSUMABLES).filter((k) => CONSUMABLES[k].drop);
export const XP_INJECT_AMOUNT = XP_INJECT;
export const emblemOf = (id: string) => id.slice(2) as SynergyId;
export const emblemId = (syn: SynergyId) => `M_${syn}`;

export function itemInfo(id: string): ItemInfo {
  if (CONSUMABLES[id]) { const c = CONSUMABLES[id]; return { id, tier: 'K', name: c.name, icon: c.icon, majors: {}, desc: `[소모품] ${c.desc}` }; }
  if (OCCULT_MODS[id]) { const o = OCCULT_MODS[id]; return { id, tier: 'M', name: o.name, icon: o.icon, majors: {}, desc: `[신비 개조부품] ${o.desc}` }; }
  if (UNIQUE[id]) return { id, tier: 'L', name: UNIQUE[id].name, icon: UNIQUE[id].icon, majors: {}, desc: UNIQUE[id].desc };
  if (isMod(id)) {
    const s = SYN_BY_ID[emblemOf(id)];
    return { id, tier: 'M', name: `${s?.name || id} 문장`, icon: s?.icon || '◆', majors: {}, desc: `[개조부품] 장착한 기물이 ${s?.name || id} 시너지에 추가로 소속됩니다.` };
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
    majors, desc: `${mtxt}. ${a.desc(k)}`, recipe: tier === 'A' && a.a !== a.b ? [`C_${a.a}`, `C_${a.b}`] : undefined,
  };
}

export function itemEffect(id: string): Effect {
  if (UNIQUE[id]) return UNIQUE[id].effect;
  if (OCCULT_MODS[id]) return OCCULT_MODS[id].effect;
  if (isMod(id) || isConsumable(id)) return {};
  const info = itemInfo(id);
  if (info.tier === 'C' || info.tier === 'G') return { majors: info.majors };
  const a = ADV_BY_ID[id.slice(2)];
  const k = info.tier === 'L' ? 3 : 1;
  const e = HOOK_SCALED.has(a.id) ? a.effect(k) : scaleEffect(a.effect(1), k);
  return { ...e, majors: info.majors };
}

export function combine(x: string, y: string): string | null {
  if (isLocked(x) || isLocked(y) || isMod(x) || isMod(y) || isConsumable(x) || isConsumable(y)) return null;
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
