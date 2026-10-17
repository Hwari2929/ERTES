import type { Battle, CUnit } from '../engine/combat';
import { PROV } from '../engine/combat'; // 수호자 도발 배율 (설명 문구에 끼운다)
import type { Effect, EffectCtx } from '../engine/effects';
import { amp, applyLive, inc, red, vuln } from '../engine/effects';
import { CFG } from '../config';
import { type Major, MAJORS, type RunState, type Stats, type SynergyId } from '../types';
import { ALL_ADVANCED, itemEffect, itemInfo, OCCULT_MODS, occultModsOfTier } from './items';
import { CAUSAL, KING_GEAR, KING_GEAR_NAME } from './chungra';
import { addStacks, blinkTo, harmfulCount, isDebuffed, isHarmful, pct } from './kit';
import { UNIT_BY_ID } from './units';

export interface SynDef {
  id: SynergyId;
  name: string;
  kind: 'trait' | 'faction';
  tiers: number[];
  color: string;
  icon: string;
  desc: string;
  tierDesc: string[];
  /** 소속 기물에게 */
  member?: (tier: number, ctx: EffectCtx) => Effect | null;
  /** 모든 출전 아군에게 */
  team?: (tier: number, ctx: EffectCtx) => Effect | null;
  /** 단계와 무관하게 인원수로 발동하는 소속 기물 효과 (우리의 출항기! 단독 출항 · 완전체) */
  special?: (count: number, ctx: EffectCtx) => Effect | null;
}

export const TITLE_NAME = ['평민', '기사', '남작', '백작', '공작', '대공', '황제'];
export const rankTitle = (rank: number) => (rank >= 30 ? 6 : rank >= 20 ? 5 : rank >= 9 ? 4 : rank >= 6 ? 3 : rank >= 3 ? 2 : 1); // 3등급마다 작위, 대공 20 · 황제 30

const T = (tier: number, a: number[]) => a[Math.max(0, tier - 1)];
/** 최고의 친구 (2 · 4 · 6 · 8명): 소환물 스탯 상속률 · 소환물 피해 증가 · 소환물 모든 주요 능력치 */
const BUDDY_BOND = [0.6, 1.0, 1.8, 3.0], BUDDY_AMP = [0.15, 0.4, 1.0, 2.5], BUDDY_MAJ = [0, 10, 20, 40];

// ─────────────── 범은하 공동체: 기물마다 다른 선물
type Gift = { name: string; text: string; stats?: Partial<Stats>; pct?: { armor?: number }; tag?: 'tech' | 'psy'; majors?: number };
const PAN_GIFT: Record<string, Gift> = {
  zephyro: { name: '제피로', text: '회피 +5%p', stats: { eva: 0.05 } },
  joshua: { name: '조슈아', text: '받는 회복 +10%p', stats: { healEff: 0.1 } },
  vivian: { name: '비비안', text: '방어 관통 +10%p', stats: { armorPen: 0.1 } },
  yupito: { name: '유피토', text: '방어도 +10%', pct: { armor: 0.1 } },
  oliver: { name: '올리버', text: '공격 속도 +10%p', stats: { atkSpd: 0.1 } },
  ingel: { name: '잉겔', text: '기술 피해 +10%p', tag: 'tech' },
  bjorn: { name: '비외른', text: '치명타 확률 +5%p', stats: { crit: 0.05 } },
  onyx: { name: '오닉스', text: '정신 피해 +10%p', tag: 'psy' },
  rus: { name: '루스', text: '치명타 피해 +10%p', stats: { critDmg: 0.1 } },
};
const PAN_EMBLEM: Gift = { name: '증표', text: '모든 주요 능력치 +2 (내림)', majors: 2 };
const PAN_MULT = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const PAN_GIFT_TEXT = [...Object.values(PAN_GIFT), PAN_EMBLEM].map((g) => `· ${g.name}: ${g.text}`).join('\n');
const isPan = (defId: string, mod: string | null) => UNIT_BY_ID[defId]?.factions.includes('PAN') || mod === 'M_PAN';
/** 출전한 범은하 기물의 선물을 모아 하나의 효과로 */
function panGift(t: number, ctx: EffectCtx): Effect | null {
  const run = ctx.run;
  if (!run) return null;
  const k = PAN_MULT[Math.min(PAN_MULT.length, t) - 1] * (ctx.unit && isPan(ctx.unit.defId, ctx.unit.mod) ? 2 : 1);
  const seen = new Set<string>();
  const stats: Partial<Stats> = {};
  let armor = 0, maj = 0;
  const mods: ReturnType<typeof inc>[] = [];
  for (const u of run.units) {
    if (!u.pos || seen.has(u.defId) || !isPan(u.defId, u.mod)) continue;
    seen.add(u.defId);
    const g = UNIT_BY_ID[u.defId].factions.includes('PAN') ? PAN_GIFT[u.defId] || PAN_EMBLEM : PAN_EMBLEM;
    for (const [key, v] of Object.entries(g.stats || {})) stats[key as keyof Stats] = (stats[key as keyof Stats] || 0) + (v as number) * k;
    armor += (g.pct?.armor || 0) * k;
    if (g.tag) mods.push(inc(g.tag, 0.1 * k));
    maj += g.majors || 0;
  }
  const m = Math.floor(maj * k);
  const majors = m ? (Object.fromEntries(MAJORS.map((x) => [x, m])) as Record<Major, number>) : undefined;
  return { stats, pct: armor ? { armor } : undefined, mods, majors };
}

/** 스텔라레이서: 비행선 추락 */
function shipCrash(b: Battle, u: CUnit, k: number, t = 1) {
  b.emit({ k: 'status', id: u.id, name: '비행선 추락!' });
  b.emit({ k: 'crash', side: u.side as 0 | 1 }); // 연출: 비행선이 적진으로 내리꽂힌다
  for (const e of b.enemiesOf(u)) {
    b.dealDamage(u, e, b.S(e, 'maxHp') * k, { elem: 'true', tag: 'proc', syn: 'STL' });
  }
  // (4) 이상: 추락 직후 4초간 레이서 공격 속도 +60%
  if (t >= 2) for (const a of b.alliesOf(u, true)) if (a.mem.stl) b.buff(u, a, 'stl.rush', 4, { delta: { atkSpd: 0.6 }, label: '추락 가속' });
}

/** 셰프 (2 · 4 · 6 · 8명): 모든 아군 최대 체력 · (8) [만찬 코스] 요리할 때 다른 모든 아군 회복 = 셰프 기술 위력 × feast × 요리 배율.
 *  요리 배율 · 빵 확률 · 빵 판매가 · 식지 않는 단계는 CFG.cookPower · CFG.chef */
const CHEF_HP = [0, 0, 0.15, 0.25], CHEF_FEAST = 0.15;
/** 수호자 (2 · 4 · 6 · 8명): 수호자 1명당 모든 아군 방어도 (수호자 2배) · 기본 공격 추가 피해 = 방어도 × hit.
 *  (8) [난공불락]: 추가 피해의 splashK 배가 대상 주변 splash 칸의 다른 적에게도, 수호자가 받는 피해 −red */
const GUARD_T = { armor: [0.04, 0.08, 0.16, 0.22], hit: [0.1, 0.2, 0.5, 0.7] }, GUARD_WALL = { splash: 1, splashK: 0.5, red: 0.15 };
/** 신비학자 (2 · 4 · 6 · 8명): 효과 명중 · [합성] 상품 수 (base + 단계) · [합성] 가격 할인 */
const OCCULT_HIT = [0.15, 0.3, 0.5, 0.8];
export const OCCULT_SYNTH = { base: 2, disc: [0, 0, 0.3, 0.5] };

/** 의무관 단계별 수치: 모든 아군 회복 효율 · 치료 계수 (기술 위력 배율) · 모든 아군 최대 체력.
 *  회복 효율은 성장 폭이 작아, 예전의 '치료 대상 다음 기본 공격 피해 +20%' 대신 단계마다 최대 체력을 올린다 */
const MED = { eff: [0.2, 0.4, 0.75, 1.5], heal: [0.8, 1.5, 2.6, 4.5], hp: [0.06, 0.12, 0.18, 0.24] };
const medTier = (i: number) => `회복 효율 +${pct(MED.eff[i])}, ${i < 3 ? `치료 = 기술 위력 ${pct(MED.heal[i])}` : `3초마다 기술 위력 ${pct(MED.heal[i])} 치료 + 초과분 보호막`}${i === 2 ? ', 치료 대상에게 초과분까지 보호막' : ''}${i === 3 ? ', 치료할 때 해로운 효과 1개 제거' : ''}, 모든 아군 최대 체력 +${pct(MED.hp[i])}`;

/** 전도체: from 에서 시작해 주변 적에게 튀는 연쇄 전기 (skipFrom = from 을 이미 맞힌 대상으로 취급).
 *  아직 맞지 않은 적을 먼저 노리고, 없으면 (적이 2명 이상일 때) 바로 직전 대상만 빼고 다시 튄다 (적 사이를 왕복) */
function chainBolt(b: Battle, u: CUnit, from: CUnit, hops: number, radius: number, k: number, skipFrom: boolean) {
  const dmg = Math.max(b.S(u, 'shoot'), b.S(u, 'strike'), b.S(u, 'tech')) * k; // 시너지 발동: 지휘관도 전술 위력이 아닌 실제 위력
  const hit = new Set<CUnit>(skipFrom ? [from] : []);
  let at: { x: number; y: number } = from;
  let last: CUnit | null = skipFrom ? from : null;
  for (let i = 0; i < hops; i++) {
    const near = b.around(at, radius, b.enemiesOf(u)).filter((e) => e !== last);
    const fresh = near.filter((e) => !hit.has(e));
    const next = b.nearest(at as CUnit, fresh.length ? fresh : near);
    if (!next) break;
    hit.add(next);
    b.emit({ k: 'atk', from: (last || u).id, to: next.id, elem: 'elec', ranged: true, chain: true });
    b.fx(next.x, next.y, 0, 'elec');
    b.dealDamage(u, next, dmg, { elem: 'elec', tag: 'proc', kind: 'tech', syn: 'COND' });
    at = next; last = next;
  }
}

// ─────────────── 우리의 출항기!: 1명 또는 5명 출전 시 구성원 고유 능력
const NO_CTX: EffectCtx = { run: null, unit: null, counts: {}, phase: 1, credits: 0 };
/** 나디르: 대상에서 주변 적에게 3회 튕기는 물리 피해 (기본 공격 계수의 절반) */
function nadirBounce(b: Battle, u: CUnit, from: CUnit) {
  const dmg = b.S(u, 'shoot') * (u.weapon?.mult || 1) * 0.5;
  const hit = new Set<CUnit>([from]);
  let at: CUnit = from;
  for (let i = 0; i < 3; i++) {
    const next = b.nearest(at, b.around(at, 3, b.enemiesOf(u)).filter((e) => !hit.has(e)));
    if (!next) break;
    hit.add(next);
    b.emit({ k: 'atk', from: at.id, to: next.id, elem: 'phys', ranged: true, chain: true });
    b.dealDamage(u, next, dmg, { elem: 'phys', tag: 'proc', kind: 'shoot' });
    at = next;
  }
}
/** 레이첼: 적이 가장 많이 모인 곳에 파괴 광선 */
function rachelBeam(b: Battle, u: CUnit) {
  const foes = b.enemiesOf(u);
  if (!foes.length) return;
  const c = foes.slice().sort((a, z) => b.around(z, 1.5, foes).length - b.around(a, 1.5, foes).length)[0];
  b.emit({ k: 'skill', id: u.id, name: '파괴 광선!', tag: '광역 정신 공격' });
  b.emit({ k: 'atk', from: u.id, to: c.id, elem: 'psy', ranged: true });
  b.fx(c.x, c.y, 2, 'psy');
  for (const e of b.around(c, 2, foes)) b.dealDamage(u, e, b.S(u, 'strike') * 3.0, { elem: 'psy', tag: 'skill', kind: 'strike', canMiss: false });
}
const TEMUR_KEYS: (keyof Stats)[] = ['maxHp', 'shoot', 'strike', 'tech', 'armor', 'acc', 'crit', 'effHit', 'effRes', 'eva', 'critDmg', 'armorPen', 'atkSpd', 'cdr', 'healEff', 'moveSpd', 'lifesteal'];
export const VOYAGE_SPECIAL: Record<string, { who: string; name: string; text: string; effect: Effect }> = {
  rachel: { who: '레이첼', name: '파괴 광선!', text: '4초 후부터 12초마다 적이 가장 많이 모인 곳에 광선을 쏴 주변 2칸 모든 적에게 타격 위력 300% 정신 피해 (빗나가지 않음).',
    effect: { hooks: { onTick(b, u, dt) {
      u.mem.beamT = (u.mem.beamT ?? 8) + dt;
      if (u.mem.beamT >= 12) { u.mem.beamT = 0; rachelBeam(b, u); }
    } } } },
  nadir: { who: '나디르', name: '바운스 영사', text: '기본 공격 · 전투 기술이 맞으면 사격 위력 × 기본 공격 계수의 50% 계수의 물리 속성 피해가 3칸 내의 적에게 최대 3회 바운스된다.',
    effect: { hooks: {
      onBasic(b, u, t, r) { if (r.amount > 0) nadirBounce(b, u, t); },
      onSkill(b, u) { const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u)); if (t) nadirBounce(b, u, t); },
    } } },
  phyllis: { who: '필리스', name: '배달 사고', text: '전투 기술을 쓸 때마다 무작위 아군 1명에게 이 전투 동안 유지되는 무작위 희귀 장비를 줍니다.',
    effect: { hooks: { onSkill(b, u) {
      const pool = b.alliesOf(u).filter((a) => !a.isSummon);
      if (!pool.length) return;
      const a = b.rng.pick(pool), id = b.rng.pick(ALL_ADVANCED), e = itemEffect(id);
      applyLive(a, e, b, NO_CTX);
      e.hooks?.onStart?.(b, a);
      a.tempItems = [...(a.tempItems || []), id];
      b.emit({ k: 'gift', from: u.id, to: a.id, item: id });
    } } } },
  temur: { who: '테무르', name: '선장의 위엄', text: '모든 능력치 +35%.',
    effect: { hooks: { onStart(b, u) {
      for (const k of TEMUR_KEYS) u.st[k] *= 1.35;
      u.hp = b.S(u, 'maxHp');
    } } } },
  vivian: { who: '비비안', name: '정밀 분석', text: '[방어 분석]이 최대 5중첩까지 쌓이고, 1중첩마다 대상이 받는 모든 피해 +15%.',
    effect: { setup: (u) => { u.mem.voyViv = 1; } } },
};

/** 시간 여행자 (3) 이상: 회피 회복 계수 (주요 위력 대비, 단계별 [-, 3명, 4명, 5명]) · 내부 재사용 대기 */
const TIME_HEAL = [0, 0.3, 0.6, 1.0];
const TIME_ICD = 0.3;
/** 주요 위력: 명사수 사격 · 돌격가 타격 · 전문가 기술 · 지휘관 전술 위력 */
export const mainPower = (b: Battle, u: CUnit) => (u.ctype === 'MARK' ? b.S(u, 'shoot') : u.ctype === 'VAN' ? b.S(u, 'strike') : b.P(u, 'tech'));
const timeEvade = (k: number) => (b: Battle, u: CUnit) => {
  if ((u.mem.timeIcd || 0) > b.t) return;
  u.mem.timeIcd = b.t + TIME_ICD;
  b.heal(u, u, mainPower(b, u) * k, false, 'TIME');
};

/** 보안위원회 (6) [합동 격리]: 주기 · 기본 계수 · 해로운 효과 1개당 계수 · 셀 수 있는 해로운 효과 상한 (전술 위력 대비) */
/** base · per: 단계별 [-, 4명, 6명] */
export const SEC_QUAR = { first: 5, every: 8, base: [0, 2.5, 4], per: [0, 1.25, 2], cap: 6 };
function secQuarantine(b: Battle, u: CUnit, t: number) {
  const foes = b.enemiesOf(u);
  if (!foes.length) return;
  b.emit({ k: 'skill', id: u.id, name: '합동 격리!', tag: '적 전체 고정 피해' });
  const tac = b.tacPower(u);
  for (const e of foes) {
    const n = Math.min(SEC_QUAR.cap, harmfulCount(e));
    b.fx(e.x, e.y, 0, 'true');
    b.dealDamage(u, e, tac * (SEC_QUAR.base[t - 1] + SEC_QUAR.per[t - 1] * n), { elem: 'true', tag: 'proc', syn: 'SEC' });
  }
  b.emit({ k: 'skillEnd', id: u.id });
}

/** 청라공국: 청라 기물 피해 증가 (단계별). 무휼은 청라 인원이 아니라 받지 않는다 (무휼은 인과 단계로 성장). 봇 sim (청라 우선 정책) 클리어율을 다른 대형 세력 우선 정책과 맞추려 넣은 몫 */
export const CHR_DMG = [0.15, 0.4, 0.7, 1.2];
/** 청라공국: 청라 기물 모든 주요 능력치 (단계별) */
export const CHR_MAJ = [3, 6, 10, 20];
/** 칼리토 제국 (5 · 7 · 9): 전투 시작 시 [근위기사] 소환 수 · 공명 등급 비율 */
export const KAL_GUARDS = [0, 1, 2, 3];
export const KAL_GUARD_RANK = 0.65;
/** 근위기사 소개 (도감 · 시너지 설명) */
export const KAL_GUARD_TEXT = {
  name: '근위기사',
  desc: `칼리토 황실 근위대의 돌격가(메이저) 소환물. 공명 등급 = 출전 아군 중 가장 높은 공명 등급 × ${Math.round(KAL_GUARD_RANK * 100)}% (올림), 그 등급의 돌격가와 같은 방식으로 능력치를 받고, 출전한 제국 기물 중 가장 높은 작위 1단계당 모든 주요 능력치 +1 (시너지 작위 보정 포함), 자기 작위 1당 피해 +10%. 시너지 인원에 세지 않고 판매할 수 없습니다.`,
  weapon: '근위 장검: 근접 타격 콤보 (3타째 피니쉬).',
  skill: '근위 방패 (쿨다운 8초): 자신에게 최대 체력 30% 보호막, 4초간 도발 (주변 1칸 적의 도발 수치를 크게 올리고 표적을 고정).',
  ult: '제국의 검 (궁극기): 대상과 주변 1칸 적에게 타격 위력 300% 물리 피해 + 1초 기절.',
};

export const SYNERGIES: SynDef[] = [
  // ═══════════════ 세력
  {
    id: 'UNI', name: '성간 인류 연합', kind: 'faction', tiers: [3, 5, 7, 9], color: '#3b6fd8', icon: '★',
    desc: '꾸준한 공명도 상승과 안정적인 전투력 증대.\n· 전투가 끝날 때마다 연합 기물이 추가 공명도를 얻습니다.\n· 연합 기물의 모든 주요 능력치가 크게 오릅니다.\n· (7) 이상: 출전한 연합 기물이 공명 등급이 더 높은 것처럼 싸웁니다 (등급당 모든 주요 능력치 +1, 위력 ×1.025, 작위).',
    tierDesc: ['모든 주요 능력치 +4, 전투 후 공명도 +1', '모든 주요 능력치 +8, 전투 후 공명도 +2, 피해 +15%', '모든 주요 능력치 +12, 전투 후 공명도 +3, 피해 +30%, 공명 등급 +2 취급',
      '[연합 총동원령] 모든 주요 능력치 +30, 전투 후 공명도 +5, 피해 +80%, 공명 등급 +5 취급, 모든 아군 모든 주요 능력치 +6'],
    member: (t) => {
      const rb = T(t, [0, 0, 2, 5]);
      const m = T(t, [4, 8, 12, 30]) + rb * CFG.rankAll;
      return { majors: { vit: m, pow: m, mnd: m, def: m, agi: m }, mods: t >= 2 ? [inc('all', T(t, [0, 0.15, 0.3, 0.8]))] : [], rankBonus: rb };
    },
    team: (t) => (t >= 4 ? { majors: { vit: 6, pow: 6, mnd: 6, def: 6, agi: 6 } } : null),
  },
  {
    id: 'KAL', name: '칼리토 제국', kind: 'faction', tiers: [3, 5, 7, 9], color: '#c0303a', icon: '♛',
    desc: '제국 기물은 공명 등급에 따라 작위를 받고, 작위만큼 강해집니다.\n· 작위: 기사 → 3등급 남작 → 6등급 백작 → 9등급 공작 → 20등급 대공 → 30등급 황제\n· 남작 이상은 치명타 피해 +25%p.\n· (5) 이상: 전투 시작 시 [근위기사]를 소환합니다 (공명 등급 = 아군 최고 공명 등급 × 65%, 올림).\n· 근위기사는 출전한 제국 기물 중 가장 높은 작위 1단계당 모든 주요 능력치 +1 (기사 1 · 남작 2 · 백작 3 · 공작 4 · 대공 5 · 황제 6, 시너지 작위 보정 포함).',
    tierDesc: ['방어력 +5, 작위 1당 피해 +10%', '방어력 +11, 작위 1당 피해 +18%, 제국 기물 받는 피해 -10%, 전투 시작 시 [근위기사] 1기 소환', '방어력 +18, 작위 1당 피해 +30%, 모든 제국 기물 작위 +1, 제국 기물 받는 피해 -20%, [근위기사] 2기 소환',
      '[황제 친정] 방어력 +30, 작위 1당 피해 +45%, 작위 +2, 제국 기물 받는 피해 -25%, 모든 아군 치명타 피해 +50%p, [근위기사] 3기 소환'],
    member: (t) => ({
      hooks: t >= 2 ? {
        onStart(b, u) {
          const kals = b.alliesOf(u).filter((a) => !a.isSummon && a.synergies.has('KAL'));
          if (kals[0] !== u) return; // 대표 제국 기물 1명만 소환
          KAL_HOOK.spawn?.(b, u, KAL_GUARDS[t - 1]);
        },
      } : undefined,
      majors: { def: T(t, [5, 11, 18, 30]) }, taken: t >= 2 ? [red('all', T(t, [0, 0.1, 0.2, 0.25]))] : undefined,
      setup: (u) => {
        const title = (u.mem.title || 1) + (t >= 4 ? 2 : t >= 3 ? 1 : 0);
        u.mem.kalTitle = title; // 근위기사 강화용 (시너지 보정 포함 작위)
        u.mods.push(inc('all', T(t, [0.1, 0.18, 0.3, 0.45]) * title));
        if (title >= 2) u.st.critDmg += 0.25;
      },
    }),
    team: (t) => (t >= 4 ? { stats: { critDmg: 0.5 } } : null),
  },
  {
    id: 'HEL', name: '헬레니우스 동맹', kind: 'faction', tiers: [3, 5, 7, 9], color: '#2fa39a', icon: '⚑',
    desc: '시너지 단계에 따라 매 페이즈 퀘스트가 주어지고, 완료하면 보상을 받습니다.\n· 동맹 기물은 전투력이 오릅니다.\n· 1 · 2 · 3단계에 처음 도달하면 동맹 전용 희귀 장비를 하나씩 받습니다.\n· 4단계에 도달하면 그 장비들이 전설로 바뀌어 효과가 2배가 됩니다.\n\n[동맹 전용 장비]\n· 성운 정박기: 정신력 +6, 해로운 효과를 걸 때 지속 +2초\n· 달빛 등대: 기동력 +6, 회피하면 최대 체력 3% 회복\n· 올림푸스 성물: 방어력 +6, 한 번에 최대 체력 35%를 넘는 피해를 받지 않음',
    tierDesc: ['전투력 +5, 피해 +15%, 페이즈마다 퀘스트 2개, [성운 정박기] 지급', '전투력 +11, 피해 +55%, 상태이상 걸린 적에게 피해 +30%, 퀘스트 3개, 보상 1.5배, [달빛 등대] 지급', '전투력 +18, 피해 +80%, 상태이상 걸린 적에게 피해 +50%, 퀘스트 4개, 보상 2배, 완료 시 동맹 기물 영구 주요 능력치 +2, [올림푸스 성물] 지급',
      '[동맹 대함대] 전투력 +30, 피해 +150%, 상태이상 걸린 적에게 피해 +60%, 퀘스트 5개, 보상 3배, 완료 시 영구 주요 능력치 +3, 동맹 장비 전설 승격 (효과 2배)'],
    member: (t) => ({
      majors: { pow: T(t, [5, 11, 18, 30]) }, mods: [inc('all', T(t, [0.15, 0.55, 0.8, 1.5]))],
      hooks: t >= 2 ? { dmgMult: (_b, _u, tg) => (isDebuffed(tg) ? 1 + T(t, [0, 0.3, 0.5, 0.6]) : 1) } : undefined,
    }),
  },
  {
    id: 'PET', name: '주식회사 페트라', kind: 'faction', tiers: [3, 5, 7, 9], color: '#e07a1f', icon: '¤',
    desc: '에너지 크레딧 스노우볼. 이자 상한 증가, 보험, 대출, 그리고 보유 크레딧에 비례한 전투력.',
    tierDesc: ['이자 상한 +3, 전투 승리 시 크레딧 +1, 페트라 기물 피해 +15%', '보험(패배 시 크레딧 +6, 체력 피해 -50%), 대출 해금, 피해 +35%, 크레딧 10당 피해 +5% (최대 +50%)', '이자 상한 +6, 피해 +60%, 페트라 기물 피해 증폭 = 크레딧 10당 +12% (최대 200%)',
      '[적대적 인수합병] 이자 상한 +10, 승리 시 크레딧 +3, 피해 +60%, 피해 증폭 = 크레딧 10당 +15% (최대 300%)'],
    member: (t, ctx) => ({
      mods: [inc('all', T(t, [0.15, 0.35, 0.6, 0.6]) + (t === 2 ? Math.min(0.5, Math.floor(ctx.credits / 10) * 0.05) : 0)), ...(t >= 3 ? [amp('all', Math.min(t >= 4 ? 3 : 2, Math.floor(ctx.credits / 10) * (t >= 4 ? 0.15 : 0.12)))] : [])],
    }),
  },
  {
    id: 'SIR', name: '시리우스 성도회', kind: 'faction', tiers: [3, 5, 7, 9], color: '#e8e2c8', icon: '✧',
    desc: '시리우스를 섬기는 무장 교단. 성도회 기물은 신성 피해가 강하고 단단하며, 단계가 오르면 쓰러진 아군을 되살리는 기적을 일으킵니다.',
    tierDesc: ['성도회 신성 피해 증폭 +20%, 준 피해(고정 제외)의 10% 추가 신성 피해, 피해량 경감 12%', '신성 피해 증폭 +50%, 추가 신성 피해 20%, 준 신성 피해의 30% 회복, 피해량 경감 18%, 전투당 1회 처음 쓰러지는 아군 부활 (체력 40%)', '신성 피해 증폭 +100%, 추가 신성 피해 35%, 신성 피해 30% 회복, 피해량 경감 25%, 부활 3회 (체력 70%)',
      '[시리우스 강림] 신성 피해 증폭 +200%, 추가 신성 피해 50%, 신성 피해 30% 회복, 피해량 경감 35%, 부활 6회 (체력 100%), 부활한 아군은 2초 무적 · 10초간 피해 +50%'],
    member: (t) => {
      const extra = T(t, [0.1, 0.2, 0.35, 0.5]);
      return {
        mods: [amp('holy', T(t, [0.2, 0.5, 1.0, 2.0]))], taken: [red('all', T(t, [0.12, 0.18, 0.25, 0.35]))],
        hooks: {
          onDeal(b, u, tgt, r, o) {
            if (r.amount <= 0) return;
            // (5) 이상: 준 신성 피해의 30% 회복
            if (t >= 2 && o.elem === 'holy') b.heal(u, u, r.amount * 0.3, true, 'SIR');
            // 준 피해(고정 · 이 효과 자신 제외)의 일부를 추가 신성 피해로
            if (o.elem !== 'true' && o.syn !== 'SIR' && tgt.alive) b.dealDamage(u, tgt, r.amount * extra, { elem: 'holy', tag: 'proc', syn: 'SIR' });
          },
        },
      };
    },
    team: (t) => (t >= 2 ? {
      hooks: {
        onLethal(b, u) {
          if (u.isSummon || (b.mem.sirRevive || 0) >= T(t, [0, 1, 3, 6])) return false;
          b.mem.sirRevive = (b.mem.sirRevive || 0) + 1;
          u.hp = b.S(u, 'maxHp') * T(t, [0, 0.4, 0.7, 1.0]);
          u.statuses = u.statuses.filter((s) => s.type === 'buff' && !isHarmful(s));
          if (t >= 4) { u.mem.invulnUntil = b.t + 2; b.buff(u, u, 'sir.reborn', 10, { mods: [inc('all', 0.5)], label: '강림' }); }
          b.emit({ k: 'mark', id: u.id, name: '부활의 기적', style: 'revive' });
          b.fx(u.x, u.y, 0, 'holy');
          return true;
        },
      },
    } : null),
  },
  {
    id: 'PAN', name: '범은하 공동체', kind: 'faction', tiers: [1, 2, 3, 4, 5, 6, 7], color: '#5fd3c0', icon: '◍',
    desc: `온갖 종족이 섞인 자유 공동체.\n· 출전한 공동체 기물마다 모든 아군에게 선물 1개를 줍니다 (기물마다 선물이 다르고, 같은 기물은 1번만).\n· 공동체 기물 자신은 선물을 2배로 받습니다.\n· 공동체 문장을 단 기물은 [증표]를 줍니다.\n· 인원 단계가 오를수록 모든 선물이 커집니다.\n\n[선물 목록 (×1 기준)]\n${PAN_GIFT_TEXT}`,
    tierDesc: PAN_MULT.map((m) => `모든 선물 ×${m} (공동체 기물 ×${m * 2})`),
    team: (t, ctx) => panGift(t, ctx),
  },
  {
    id: 'FAM', name: '엘베스타드 일가', kind: 'faction', tiers: [3, 5, 7], color: '#b8c0d8', icon: '♞',
    desc: '은하 귀족 엘베스타드 가문. 일가 기물이 주는 모든 피해가 증폭되고, 받는 피해가 줄어듭니다. 이 증폭은 다른 증폭과 겹치지 않는 별도 배율로 곱해집니다.',
    tierDesc: ['일가 기물 피해 증폭 +30%, 받는 피해 -10%', '일가 기물 피해 증폭 +90%, 받는 피해 -10%', '일가 기물 피해 증폭 +200%, 받는 피해 -10%'],
    member: (t) => {
      const m = 1 + T(t, [0.3, 0.9, 2.0]);
      return { taken: [red('all', 0.1)], hooks: { dmgMult: () => m } };
    },
  },
  {
    id: 'SEC', name: '보안위원회', kind: 'faction', tiers: [2, 4, 6], color: '#7d8aa3', icon: '⛨',
    desc: `은하 보안을 책임지는 비밀 위원회.\n· 위원회 기물은 받는 피해와 정신 피해가 줄어듭니다.\n· 위원회 기물이 거는 해로운 효과는 더 오래 갑니다.\n· (4) 이상: ${SEC_QUAR.every}초마다 [합동 격리] — 모든 적에게 전술 위력 비례 고정 피해. 대상이 가진 해로운 효과 1개당 계수가 늘어납니다.`,
    tierDesc: ['받는 피해 -10%, 정신 피해 추가 -15%, 거는 해로운 효과 +1초', `받는 피해 -20%, 정신 피해 추가 -20%, 거는 해로운 효과 +2초, ${SEC_QUAR.first}초 후부터 ${SEC_QUAR.every}초마다 [합동 격리]: 모든 적에게 전술 위력 ${pct(SEC_QUAR.base[1])} + 대상의 해로운 효과 1개당 ${pct(SEC_QUAR.per[1])} 고정 피해 (최대 ${SEC_QUAR.cap}개)`,
      `[비상 대권] 받는 피해 -30%, 정신 피해 추가 -30%, 거는 해로운 효과 +3초, ${SEC_QUAR.first}초 후부터 ${SEC_QUAR.every}초마다 [합동 격리]: 모든 적에게 전술 위력 ${pct(SEC_QUAR.base[2])} + 대상의 해로운 효과 1개당 ${pct(SEC_QUAR.per[2])} 고정 피해 (최대 ${SEC_QUAR.cap}개)`],
    member: (t) => {
      const ext = T(t, [1, 2, 3]);
      return {
        taken: [red('all', T(t, [0.1, 0.2, 0.3])), red('psy', T(t, [0.15, 0.2, 0.3]))],
        hooks: {
          onInflict(_b, u, tgt, s) { if (tgt.side !== u.side && isHarmful(s)) s.dur += ext; },
          onTick: t >= 2 ? (b, u, dt) => {
            if (b.alliesOf(u).find((a) => a.synergies.has('SEC') && !a.isSummon) !== u) return; // 대표 위원회 기물 1명
            u.mem.secT = (u.mem.secT ?? SEC_QUAR.every - SEC_QUAR.first) + dt;
            if (u.mem.secT >= SEC_QUAR.every) { u.mem.secT = 0; secQuarantine(b, u, t); }
          } : undefined,
        },
      };
    },
  },
  {
    id: 'STL', name: '스텔라레이서', kind: 'faction', tiers: [2, 4, 6, 8], color: '#ff6a3d', icon: '➹',
    desc: '성간 경기장의 레이서들. 레이서 기물은 빠르고, 전투가 시작되면 경기장에서 이탈한 비행선이 적진에 추락해 모든 적에게 최대 체력 비례 고정 피해를 줍니다.',
    tierDesc: ['기동력 +5, 전투 시작 비행선 추락: 모든 적 최대 체력 6% 고정 피해', '기동력 +11, 추락 10%, 20초마다 다시 추락, 추락 직후 4초간 레이서 공격 속도 +60%',
      '기동력 +18, 추락 13%, 14초마다 다시 추락, 추락 직후 레이서 공격 속도 +60%', '[그랑프리 대참사] 기동력 +30, 추락 18%, 8초마다 다시 추락, 추락 직후 레이서 공격 속도 +60%'],
    member: (t) => {
      const dmg = T(t, [0.06, 0.1, 0.13, 0.18]), every = T(t, [0, 20, 14, 8]);
      const lead = (b: Battle, u: CUnit) => b.alliesOf(u).find((a) => a.mem.stl) === u;
      return {
        majors: { agi: T(t, [5, 11, 18, 30]) },
        setup: (u) => { u.mem.stl = 1; },
        hooks: {
          onStart(b, u) { if (lead(b, u)) shipCrash(b, u, dmg, t); },
          onTick(b, u, dt) {
            if (!every || !lead(b, u)) return;
            u.mem.stlT = (u.mem.stlT || 0) + dt;
            if (u.mem.stlT >= every) { u.mem.stlT = 0; shipCrash(b, u, dmg, t); }
          },
        },
      };
    },
  },
  {
    id: 'HOI', name: '호이슌 홀딩스', kind: 'faction', tiers: [2, 4, 6], color: '#d4af37', icon: '₩',
    desc: '은하 금융을 쥔 거대 지주회사. 호이슌 기물은 정신력이 오르고, 활성화되어 있으면 페이즈 중간에 [투자] 노드가 열립니다. 단계가 높을수록 투자 상품이 많고 수익률이 좋습니다.',
    tierDesc: ['정신력 +5, [투자] 노드: 상품 3개, 투자 수익 ×1.5', '정신력 +11, 상품 4개, 투자 수익 ×1.8, 가격 -15%', '[블랙 먼데이] 정신력 +24, 상품 5개, 투자 수익 ×2.5, 가격 -30%, 호이슌 기물 피해 +1%p × 보유 크레딧 (최대 +120%)'],
    member: (t, ctx) => ({ majors: { mnd: T(t, [5, 11, 24]) }, mods: t >= 3 ? [inc('all', Math.min(1.2, ctx.credits * 0.01))] : [] }),
  },
  {
    id: 'TIME', name: '시간 여행자', kind: 'faction', tiers: [2, 3, 4, 5], color: '#c8a0ff', icon: '⌛',
    desc: `시간의 틈을 걷는 이들.\n· 기술 쿨다운이 빨리 돌아오고 공격을 잘 피합니다.\n· (3) 이상: 회피할 때마다 주요 위력(명사수 사격 · 돌격가 타격 · 전문가 기술 · 지휘관 전술 위력)에 비례해 체력을 회복합니다 (${TIME_ICD}초에 1번).\n· (4) 이상: 쓰러져도 시간을 되감아 다시 일어섭니다.`,
    tierDesc: ['쿨다운 감소 속도 +40%, 회피 +8%p', `쿨다운 감소 속도 +75%, 회피 +13%p, 전투 기술 피해 +20%, 회피하면 주요 위력 ${pct(TIME_HEAL[1])} 회복`, `쿨다운 감소 속도 +120%, 회피 +18%p, 전투 기술 피해 +35%, 회피하면 주요 위력 ${pct(TIME_HEAL[2])} 회복, 처음 쓰러질 때 최대 체력 70%로 부활`,
      `[시간 역행] 쿨다운 감소 속도 +220%, 회피 +28%p, 전투 기술 피해 +50%, 회피하면 주요 위력 ${pct(TIME_HEAL[3])} 회복, 처음 쓰러질 때 부활 (체력 70%) + 전투 기술을 4번 쓸 때마다 부활 기회 1회 추가 (전투당 최대 3번 부활)`],
    member: (t) => ({
      stats: { cdr: T(t, [0.4, 0.75, 1.2, 2.2]), eva: T(t, [0.08, 0.13, 0.18, 0.28]) },
      mods: t >= 2 ? [inc('skill', T(t, [0, 0.2, 0.35, 0.5]))] : undefined,
      hooks: t === 2 ? { onEvade: timeEvade(TIME_HEAL[1]) } : t >= 3 ? {
        onEvade: timeEvade(T(t, TIME_HEAL)),
        onSkill(_b, u) { u.mem.timeSk = (u.mem.timeSk || 0) + 1; },
        onLethal(b, u) {
          const allowed = t >= 4 ? Math.min(3, 1 + Math.floor((u.mem.timeSk || 0) / 4)) : 1;
          if ((u.mem.timeRev || 0) >= allowed) return false;
          u.mem.timeRev = (u.mem.timeRev || 0) + 1;
          u.hp = b.S(u, 'maxHp') * 0.7;
          b.emit({ k: 'mark', id: u.id, name: '시간 역행', style: 'rewind' });
          b.fx(u.x, u.y, 0, 'psy');
          return true;
        },
      } : undefined,
    }),
  },

  {
    id: 'CHR', name: '청라공국', kind: 'faction', tiers: [3, 5, 7, 9], color: '#3fa8b8', icon: '靑',
    desc: `필서 속에 기록된 고대 공국. 공명도가 아닌 인과율로 공왕을 키운다.\n· 3명 이상이면 전투 시작 시 [공왕 무휼]을 소환합니다. 무휼은 출전 칸을 차지하지 않고 포탑처럼 놓입니다 (편성 화면에서 끌어 옮기기, 판매 · 대기석 불가).\n· 무휼은 공명도를 받지 않습니다. 이긴 전투마다 인과율을 모아 인과 단계 1~${CAUSAL.max}로 성장합니다.\n· 인과율 1회 수집량 = (${CAUSAL.base} + 장비 점수 ÷ ${CAUSAL.gearDiv}) × 단계 배율. 장비 점수 = 출전 아군이 장착한 장비 (재료 ${CAUSAL.gearPts.C} · 고급 · 희귀 ${CAUSAL.gearPts.A} · 전설 ${CAUSAL.gearPts.L}, 개조부품 · 포탑 장비 · 무휼 전용 장비 제외).\n· 청라 기물이 3명 아래로 줄어도 쌓은 인과율은 남습니다.\n· 3 · 5 · 7명에 처음 닿으면 무휼 전용 장비가 해금되어 자동으로 장착됩니다 (일반 장비는 장착할 수 없지만 장비 점수에는 셉니다).`,
    tierDesc: [
      `청라 기물 모든 주요 능력치 +${CHR_MAJ[0]} · 피해 +${pct(CHR_DMG[0])}, 전투 시작 시 공왕 무휼 소환, 인과율 수집 ×${CAUSAL.mult[1]}, 무휼 전용 장비 [${KING_GEAR_NAME[KING_GEAR[0]]}] 해금`,
      `청라 기물 모든 주요 능력치 +${CHR_MAJ[1]} · 피해 +${pct(CHR_DMG[1])}, 인과율 수집 ×${CAUSAL.mult[2]}, 무휼 전용 장비 [${KING_GEAR_NAME[KING_GEAR[1]]}] 해금`,
      `청라 기물 모든 주요 능력치 +${CHR_MAJ[2]} · 피해 +${pct(CHR_DMG[2])}, 인과율 수집 ×${CAUSAL.mult[3]}, 무휼 전용 장비 [${KING_GEAR_NAME[KING_GEAR[2]]}] 해금`,
      `[필서 개봉] 인과율 수집 ×${CAUSAL.mult[4]}, 청라 기물 모든 주요 능력치 +${CHR_MAJ[3]} · 피해 +${pct(CHR_DMG[3])}`,
    ],
    member: (t, ctx) => ({ majors: { vit: T(t, CHR_MAJ), pow: T(t, CHR_MAJ), mnd: T(t, CHR_MAJ), def: T(t, CHR_MAJ), agi: T(t, CHR_MAJ) }, mods: [inc('all', T(t, CHR_DMG))], hooks: { onStart(b, u) {
      const chr = b.alliesOf(u).filter((a) => !a.isSummon && a.synergies.has('CHR'));
      if (chr[0] !== u) return; // 대표 청라 기물 1명만 소환
      CHR_HOOK.spawn?.(b, u, ctx, t);
    } } }),
  },

  // ═══════════════ 특성
  {
    id: 'MED', name: '의무관', kind: 'trait', tiers: [2, 4, 6, 8], color: '#5ad08a', icon: '✚',
    desc: '모든 아군의 회복 효율과 최대 체력이 단계마다 오르고, 의무관은 4초마다 체력 비율이 가장 낮은 아군을 치료합니다.',
    tierDesc: [0, 1, 2, 3].map((i) => (i === 3 ? `[기적의 병동] ${medTier(i)}` : medTier(i))),
    team: (t) => ({ stats: { healEff: T(t, MED.eff) }, pct: { maxHp: T(t, MED.hp) } }),
    member: (t) => {
      const k = T(t, MED.heal), every = t >= 4 ? 3 : 4;
      return {
        hooks: {
          onTick(b, u, dt) {
            u.mem.medT = (u.mem.medT || 0) + dt;
            if (u.mem.medT >= every) {
              u.mem.medT = 0;
              const l = b.lowestHpAlly(u);
              if (l && (b.hpPct(l) < 1 || (t >= 4 && isDebuffed(l)))) {
                const v = b.S(u, 'tech') * k; const miss = b.S(l, 'maxHp') - l.hp;
                b.heal(u, l, v, false, 'MED');
                if (t >= 3 && v > miss) b.shield(l, v - miss, 'MED');
                if (t >= 4) { const i = l.statuses.findIndex(isHarmful); if (i >= 0) l.statuses.splice(i, 1); }
              }
            }
          },
        },
      };
    },
  },
  {
    id: 'BUDDY', name: '최고의 친구', kind: 'trait', tiers: [2, 4, 6, 8], color: '#f08fb0', icon: '♥',
    desc: `최고의 친구 기물은 전투 시작 시 단짝 소환물을 부릅니다. 소환물은 칸을 차지하고 공명도가 없으며, 주인 스탯의 일부를 물려받습니다 (기본 ${pct(CFG.bond.base)}, 추가로 불린 소환물은 그 ${pct(CFG.bond.extra)}). 소환물마다 전투 유형(돌격가 · 전문가)이 있어 도발 배율이 그 유형을 따릅니다 (돌격가 경계는 없음). 주인이 쓰러지면 함께 사라집니다.`,
    tierDesc: BUDDY_BOND.map((r, i) => `${i === 3 ? '[우정 파워 MAX] ' : ''}소환물 스탯 상속 ${pct(r)}, 소환물 피해 +${pct(BUDDY_AMP[i])}${BUDDY_MAJ[i] ? `, 소환물 모든 주요 능력치 +${BUDDY_MAJ[i]}` : ''}`),
    member: (t) => ({ setup: (u) => {
      // 6 · 8단계의 추가 소환 대신 그만큼 (추가 1기 = 80%) 상속률을 올린다
      u.mem.bond = Math.max(u.mem.bond || 0, T(t, BUDDY_BOND));
      u.mem.bondAmp = T(t, BUDDY_AMP);
      u.mem.summonMaj = (u.mem.summonMaj || 0) + T(t, BUDDY_MAJ); // 4 · 6 · 8명: 소환물 모든 메이저 +10 / 20 / 40 (라르스 경호원 보너스와 합산)
    } }),
  },
  {
    id: 'STAR', name: '은하 대스타', kind: 'trait', tiers: [2, 4, 6, 8], color: '#ff9de2', icon: '✪',
    desc: '전투와 노드 진행으로 명성을 쌓습니다. 대스타가 활성화되어 있으면 분기점에서 [속보]를 고를 수 있고 보스 직전에는 속보 노드가 추가되어, 명성을 원하는 보상으로 바꿀 수 있습니다 (대스타가 없으면 속보가 나오지 않습니다). 대스타 기물은 명성만큼 강해집니다.',
    tierDesc: ['명성 획득 ×1, 대스타 피해 +15% +명성×0.8%', '명성 획득 ×2, 대스타 피해 +35% +명성×1.5%', '명성 획득 ×3, 대스타 피해 +80% +명성×2.5%, 모든 아군 피해 +명성×0.6%',
      '[은하 월드 투어] 명성 획득 ×5, 대스타 피해 +200% +명성×4% (최대 +300%), 모든 아군 피해 +명성×1.2% (최대 +100%)'],
    member: (t, ctx) => ({ mods: [inc('all', T(t, [0.15, 0.35, 0.8, 2.0]) + Math.min(t >= 4 ? 3 : 1.5, fameOf(ctx) * T(t, [0.008, 0.015, 0.025, 0.04])))] }),
    team: (t, ctx) => (t >= 3 ? { mods: [inc('all', Math.min(t >= 4 ? 1 : 0.5, fameOf(ctx) * (t >= 4 ? 0.012 : 0.006)))] } : null),
  },
  {
    id: 'INFIL', name: '침투자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#9a8cff', icon: '☾',
    desc: '전투가 시작되면 적 후방으로 순간이동해 기습합니다. 회피가 오르고, 착지 직후 잠시 피해가 크게 증가합니다. 침투자에게 맞은 적은 남은 체력이 일정 비율 이하면 [처형]됩니다 (즉사). 보스는 처형되지 않는 대신, 침투자가 주는 피해가 처형 비율의 4배만큼 별도 증폭됩니다.',
    tierDesc: ['회피 +10%p, 기습 3초 피해 +50%, [처형] 체력 8% 이하 (보스 피해 +32%)', '회피 +20%p, 기습 4초 피해 +110%, 처치 시 기습 재발동, [처형] 15% (보스 피해 +60%)', '회피 +35%p, 기습 6초 피해 +220%, 처치 시 기습 재발동, [처형] 25% (보스 피해 +100%)',
      '[그림자 숙청] 회피 +50%p, 기습이 전투 내내 유지 · 피해 +500%, 처치 시 최대 체력 15% 회복, [처형] 40% (보스 피해 +160%)'],
    member: (t) => {
      const ambush = T(t, [0.5, 1.1, 2.2, 5.0]), dur = T(t, [3, 4, 6, 9999]);
      const exec = T(t, [0.08, 0.15, 0.25, 0.4]);
      return {
        stats: { eva: T(t, [0.1, 0.2, 0.35, 0.5]) },
        hooks: {
          // [처형]: 맞은 적의 남은 체력이 기준 이하면 즉사. 보스는 처형 대신 피해 별도 증폭 (처형 비율 × 4)
          onDeal(b, u, tgt, r, o) {
            if (o.tag === 'dot' || r.amount <= 0 || !tgt.alive || tgt.isBoss || tgt.side === u.side) return;
            if (b.hpPct(tgt) <= exec) { b.emit({ k: 'mark', id: tgt.id, name: '처형', style: 'execute' }); b.kill(tgt, u); }
          },
          dmgMult: (_b, _u, tgt) => (tgt.isBoss ? 1 + 4 * exec : 1),
          onStart(b, u) {
            const foes = b.enemiesOf(u);
            if (!foes.length) return;
            // 적 진영 가장 안쪽(아군에서 먼 쪽)의 적을 노린다
            const back = foes.slice().sort((a, c) => (u.side === 0 ? a.y - c.y : c.y - a.y))[0];
            if (blinkTo(b, u, back)) b.buff(u, u, 'infil.ambush', dur, { mods: [inc('all', ambush)], label: '기습' });
          },
          onKill: t >= 2 ? (b, u) => {
            b.buff(u, u, 'infil.ambush', dur, { mods: [inc('all', ambush)], label: '기습' });
            if (t >= 4) b.heal(u, u, b.S(u, 'maxHp') * 0.15, true, 'INFIL');
          } : undefined,
        },
      };
    },
  },
  {
    id: 'NAV', name: '항해자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#7ab8ff', icon: '✈',
    desc: '항해자 1명을 [에이스 파일럿]으로 지정합니다 (기물 정보 창, 미지정 시 공명 등급이 가장 높은 항해자). 에이스는 기물마다 다른 추가 특성이 활성화되고, 단계가 오를수록 그 능력이 강해집니다.',
    tierDesc: ['에이스 능력 ×1, 항해자 피해 +15%', '에이스 능력 ×1.8, 항해자 기동력 +5, 피해 +35%', '에이스 능력 ×3, 항해자 기동력 +10, 피해 +75%', '[전설의 항로] 에이스 능력 ×4.5, 항해자 기동력 +16, 피해 +120%'],
    member: (t, ctx) => {
      const agi = T(t, [0, 5, 10, 16]);
      const navDmg = [inc('all', T(t, [0.15, 0.35, 0.75, 1.2]))];
      const ace = ctx.run && ctx.unit && aceTargetUid(ctx.run) === ctx.unit.uid ? UNIT_BY_ID[ctx.unit.defId].ace : undefined;
      if (!ace) return { majors: { agi }, mods: navDmg };
      const e = ace.effect(T(t, [1, 1.8, 3, 4.5]));
      const prev = e.setup;
      return { ...e, mods: [...(e.mods || []), ...navDmg], majors: { ...(e.majors || {}), agi: (e.majors?.agi || 0) + agi }, setup: (u, b, c) => { u.mem.ace = 1; prev?.(u, b, c); } };
    },
  },
  {
    id: 'CHEF', name: '셰프', kind: 'trait', tiers: [2, 4, 6, 8], color: '#ffb36b', icon: '♨',
    desc: `셰프의 전투 스킬은 요리입니다. 요리는 아군 1명을 회복시키거나 보호막을 주고 특수 버프를 겁니다. 단계가 오르면 요리 위력이 커집니다.\n· 셰프 시너지가 의뢰에서 처음 켜지면 소모품 [갓 구운 빵] 1개를 받고, 켜진 채로 전투에서 이기면 단계에 따라 확률로 1개씩 더 받습니다 (빵은 플레이어 체력 회복).\n· 빵은 얻은 뒤 전투 ${CFG.chef.staleAfter}회를 지나면 식은 빵이 됩니다 (회복 −${CFG.chef.staleHeal} · 판매가 −${CFG.chef.staleSell}). 빵 판매가는 팔 때의 셰프 단계에 따라 오릅니다.`,
    tierDesc: [1, 2, 3, 4].map((t) => `${t === 4 ? '[만찬 코스] ' : ''}요리 위력 ×${CFG.cookPower[t]}${CHEF_HP[t - 1] ? `, 모든 아군 최대 체력 +${pct(CHEF_HP[t - 1])}` : ''}${t === 4 ? `, 셰프가 요리하면 다른 모든 아군도 셰프 기술 위력 ${pct(CHEF_FEAST)} × 요리 배율 회복` : ''}, 승리 시 ${pct(CFG.chef.breadWin[t - 1])} 확률로 갓 구운 빵 (빵 판매가 ${CFG.chef.breadSell[t]}${t >= CFG.chef.noStaleTier ? ', 켜진 동안 빵이 식지 않음' : ''})`),
    member: (t) => ({
      setup: (u) => { u.mem.cook = CFG.cookPower[t]; },
      // (8) [만찬 코스]: 요리(전투 기술)를 쓰면 자신을 뺀 모든 아군 회복 (요리 배율 · 증강 보너스 적용)
      hooks: t >= 4 ? { onSkill(b, u) {
        const v = b.P(u, 'tech') * CHEF_FEAST * (u.mem.cook || 1) * (1 + (u.mem.cookBonus || 0));
        for (const a of b.alliesOf(u, false)) b.heal(u, a, v, false, 'CHEF');
      } } : undefined,
    }),
    team: (t) => (CHEF_HP[t - 1] ? { pct: { maxHp: CHEF_HP[t - 1] } } : null),
  },
  {
    id: 'ENG', name: '엔지니어', kind: 'trait', tiers: [2, 4, 6, 8], color: '#a0b4c8', icon: '⚙',
    desc: '감시 포탑(기계 · 구조물)을 아군 진영에 설치합니다.\n· 포탑은 움직이지 않고, 출전한 엔지니어 능력치 평균의 일부를 물려받으며, 엔지니어 전술 위력의 일부가 사격 위력에 더해집니다.\n· 편성 화면에서 끌어 옮길 수 있고 (판매 · 대기석 불가), 배치와 장비는 다음 전투에도 유지됩니다.\n· 엔지니어는 1명마다 아군 전술 위력을 올립니다.\n\n[포탑 장비]\n· 포탑마다 장비 칸: 엔지니어 2명 1칸 · 4명 2칸 · 6명 이상 3칸, 포탑 전용 장비만 장착 (일반 기물 장착 불가).\n· 엔지니어가 출전한 동안 분기점에 [정비]가 나와 포탑 전용 장비를 삽니다 (보급형 1개 무료).\n· 엔지니어 시너지가 꺼지면 포탑이 회수되고, 장착한 장비는 보관함으로 돌아옵니다.',
    tierDesc: ['감시 포탑 1기 (장비 1칸, 상속 150%, 공격 속도 +40%, 사격 위력 + 전술 위력 80%), 엔지니어 1명당 전술 위력 +4, 방어 관통 +10%p', '감시 포탑 2기 (장비 2칸, 상속 650%, 사격 위력 + 전술 위력 300%), 엔지니어 1명당 전술 위력 +8, 방어 관통 +20%p',
      '감시 포탑 3기 (장비 3칸, 상속 950%, 사격 위력 + 전술 위력 450%), 포탑 공격 속도 추가 +80%, 엔지니어 1명당 전술 위력 +12, 방어 관통 +35%p', '[자동화 요새] 감시 포탑 4기 (장비 3칸, 상속 1400%, 사격 위력 + 전술 위력 650%), 포탑 공격 속도 추가 +80%, 엔지니어 1명당 전술 위력 +18, 방어 관통 +35%p'],
    member: (t) => ({
      stats: { armorPen: T(t, [0.1, 0.2, 0.35, 0.35]) },
      setup: (u) => { u.mem.eng = t; u.mem.engPen = T(t, [0.1, 0.2, 0.35, 0.35]); u.mem.tacBonus = (u.mem.tacBonus || 0) + T(t, [4, 8, 12, 18]); },
      hooks: {
        onStart(b, u) {
          const engs = b.alliesOf(u).filter((a) => a.mem.eng);
          if (engs[0] !== u) return; // 대표 엔지니어 1명만 설치
          const extra = engs.reduce((s2, a) => s2 + (a.mem.turretExtra || 0), 0);
          ENG_HOOK.spawn?.(b, u, engs, t + extra);
        },
      },
    }),
  },
  {
    id: 'SCHEME', name: '모략가', kind: 'trait', tiers: [2, 4, 6, 8], color: '#8a5cc8', icon: '♠',
    desc: '판 뒤에서 실을 당기는 이들. 모략가가 적에게 해로운 효과를 걸면 기본 75% 확률로 [암운]을 쌓습니다. [암운]은 1중첩당 매초 아군 전술 위력 비례 고정 피해를 줍니다 (최대 99중첩, 6초간 새로 쌓이지 않으면 사라짐).',
    tierDesc: ['효과 명중 +25%p, 전술 위력 +10%, [암운] 1중첩당 초당 전술 위력 4%', '효과 명중 +50%p, 전술 위력 +25%, 초당 전술 위력 8%, 적에게 해로운 효과를 걸 때마다 고정 50% 확률로 [암운] 1중첩 추가 (기본 확률 판정과 별개), 모략가의 기본 공격이 [암운] 1중첩당 전술 위력 8% 고정 피해 추가',
      '효과 명중 +75%p, 전술 위력 +40%, 초당 전술 위력 15%, 고정 25% 확률로 2중첩 더 추가, 모략가의 기본 공격 · 기술이 [암운] 1중첩당 전술 위력 10% 고정 피해 추가',
      '[흑막 강림] 효과 명중 +100%p, 전술 위력 +80%, 초당 전술 위력 30%, [암운] 쌓는 양 3배, 기본 공격 · 기술 추가 피해 [암운] 1중첩당 전술 위력 12%'],
    member: (t) => {
      const per = T(t, [0.04, 0.08, 0.15, 0.3]); // [암운] 1중첩 초당 피해 = 전술 위력 × per
      return {
        stats: { effHit: T(t, [0.25, 0.5, 0.75, 1.0]) },
        setup: (u) => { u.mem.tacPct = (u.mem.tacPct || 0) + T(t, [0.1, 0.25, 0.4, 0.8]); },
        hooks: {
          onInflict(b, u, tgt, s) {
            if (tgt.side === u.side || !isHarmful(s) || s.key === 'gloom') return;
            // 기본 1중첩은 효과 명중 · 저항 판정, 2 · 3단계 추가 중첩은 고정 확률 (기본 판정 실패와 무관)
            let n = b.rng.chance(Math.min(1, 0.75 * (1 + b.S(u, 'effHit') - b.S(tgt, 'effRes')))) ? 1 : 0;
            if (t >= 2 && b.rng.chance(0.5)) n += 1;
            if (t >= 3 && b.rng.chance(0.25)) n += 2;
            if (!n) return;
            if (t >= 4) n *= 3;
            addStacks(b, u, tgt, 'gloom', n, 99, 6, (k) => ({ type: 'dot', elem: 'true', dps: b.tacPower(u) * per * k, syn: 'SCHEME' }), '암운');
          },
          // (4) 기본 공격, (6) 이상 기본 공격 · 기술: 대상 [암운] 1중첩당 전술 위력 비례 고정 피해 (적에게만)
          onDeal: t >= 2 ? (b, u, tgt, r, o) => {
            if ((o.tag !== 'basic' && (t < 3 || o.tag !== 'skill')) || r.amount <= 0 || !tgt.alive || tgt.side === u.side) return;
            const g = tgt.statuses.find((x) => x.key === 'gloom')?.stacks || 0;
            if (g) b.dealDamage(u, tgt, b.tacPower(u) * T(t, [0, 0.08, 0.1, 0.12]) * g, { elem: 'true', tag: 'proc', syn: 'SCHEME' });
          } : undefined,
        },
      };
    },
  },
  {
    id: 'DECOMP', name: '분해자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#9bd13a', icon: '☣',
    desc: '무엇이든 녹여 버리는 이들. 분해자가 기본 공격 · 기술로 적을 맞히면 자신 최대 체력 비례 화학 피해를 더하고, 반드시 [부식]을 쌓습니다. [부식] 1중첩당 대상이 받는 화학 피해 +10%p (8초).',
    tierDesc: ['화학 피해 +10%, 추가 화학 피해 = 최대 체력 4%, [부식] 최대 5중첩', '화학 피해 +25%, [부식] 최대 7중첩, [부식] 걸린 적을 공격하면 피해의 10% 회복',
      '화학 피해 +50%, 추가 화학 피해 8%, [부식] 최대 9중첩', '[완전 분해] 화학 피해 +100%, 추가 화학 피해 12%, [부식] 최대 13중첩'],
    member: (t) => {
      const extra = T(t, [0.04, 0.04, 0.08, 0.12]), max = T(t, [5, 7, 9, 13]);
      return {
        mods: [inc('chem', T(t, [0.1, 0.25, 0.5, 1.0]))],
        hooks: {
          onDeal(b, u, tgt, r, o) {
            if (r.amount <= 0 || o.tag === 'dot') return;
            if (t >= 2 && tgt.statuses.some((x) => x.key === 'decay')) b.heal(u, u, r.amount * 0.1, true, 'DECOMP');
            if ((o.tag !== 'basic' && o.tag !== 'skill') || !tgt.alive) return;
            b.dealDamage(u, tgt, b.S(u, 'maxHp') * extra, { elem: 'chem', tag: 'proc', syn: 'DECOMP' });
            if (tgt.alive) addStacks(b, u, tgt, 'decay', 1, max + (u.mem.decayMax || 0), 8, (k) => ({ taken: [vuln('chem', 0.1 * k)] }), '부식');
          },
        },
      };
    },
  },
  {
    id: 'COND', name: '전도체', kind: 'trait', tiers: [2, 4, 6, 8], color: '#4fc3ff', icon: 'ϟ',
    desc: '몸에 전류가 흐르는 이들.\n· 전도체가 기본 공격 · 기술로 적을 맞히면 30% 고정 확률로 [바운스]: n% 계수의 전기 속성 피해가 n칸 내의 적에게 최대 n회 바운스된다 (단계별 수치).\n· 계수는 사격 · 타격 · 기술 위력 중 가장 높은 값 기준.\n· 바운스는 아직 맞지 않은 적을 먼저 노리고, 새 대상이 없으면 바로 직전 대상만 빼고 적 사이를 왕복합니다 (적이 2명 이상일 때).',
    tierDesc: ['전기 피해 +15%, 25% 계수의 전기 속성 피해가 1칸 내의 적에게 최대 1회 바운스된다', '전기 피해 +35%, 50% 계수의 전기 속성 피해가 2칸 내의 적에게 최대 3회 바운스된다, 명사수 · 지휘관 전도체 바운스 +1회, 전문가 · 돌격가 전도체는 피격 시 50% 확률로 바운스',
      '전기 피해 +60%, 75% 계수의 전기 속성 피해가 3칸 내의 적에게 최대 6회 바운스된다', '[천둥 폭풍] 전기 피해 +100%, 100% 계수의 전기 속성 피해가 3칸 내의 적에게 최대 10회 바운스된다'],
    member: (t) => {
      const radius = T(t, [1, 2, 3, 3]), k = T(t, [0.25, 0.5, 0.75, 1.0]);
      const hopsOf = (u: CUnit) => T(t, [1, 3, 6, 10]) + (t >= 2 && (u.ctype === 'MARK' || u.ctype === 'CMD') ? 1 : 0);
      return {
        mods: [inc('elec', T(t, [0.15, 0.35, 0.6, 1.0]))],
        hooks: {
          onDeal(b, u, tgt, r, o) {
            if ((o.tag !== 'basic' && o.tag !== 'skill') || r.amount <= 0 || !b.rng.chance(0.3)) return;
            chainBolt(b, u, tgt, hopsOf(u), radius, k, true);
          },
          onHurt: t >= 2 ? (b, u, src, _r, o) => {
            if (o.tag === 'dot' || o.tag === 'proc' || (u.ctype !== 'SPEC' && u.ctype !== 'VAN') || !src.alive || !b.rng.chance(0.5)) return;
            chainBolt(b, u, u, hopsOf(u), radius, k, false);
          } : undefined,
        },
      };
    },
  },
  {
    id: 'GUARD', name: '수호자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#c9a86a', icon: '⛉',
    desc: `앞에 서서 모두를 지키는 이들. 출전한 수호자 1명마다 모든 아군의 방어도가 오르고 (수호자 자신은 2배), 수호자의 기본 공격에는 자신 방어도에 비례한 물리 피해가 더해집니다. 시너지가 켜지면 (2명 이상) 수호자의 도발 배율이 +${PROV.guard} 올라 적이 수호자를 더 노립니다.`,
    tierDesc: GUARD_T.armor.map((a, i) => `${['', '', '[철벽 방진] ', '[난공불락] '][i]}수호자 1명당 모든 아군 방어도 +${pct(a)} (수호자 +${pct(a * 2)}), 수호자 기본 공격 + 방어도 ${pct(GUARD_T.hit[i])} 물리 피해${i === 3 ? ` (대상 주변 ${GUARD_WALL.splash}칸의 다른 적에게도 그 ${pct(GUARD_WALL.splashK)}), 수호자가 받는 피해 -${pct(GUARD_WALL.red)}` : ''}`),
    team: (t, ctx) => ({ pct: { armor: (ctx.counts.GUARD || 0) * T(t, GUARD_T.armor) } }),
    member: (t, ctx) => {
      const k = T(t, GUARD_T.hit);
      return {
        pct: { armor: (ctx.counts.GUARD || 0) * T(t, GUARD_T.armor) }, // 수호자 기물은 팀 효과를 한 번 더 받아 2배
        taken: t >= 4 ? [red('all', GUARD_WALL.red)] : undefined,
        hooks: {
          onBasic(b, u, tgt, r) {
            if (r.miss || !tgt.alive) return;
            const v = b.S(u, 'armor') * k;
            // (8) [난공불락]: 주변 적에게도 (대상이 이 피해로 쓰러져도 주변은 맞는다)
            const near = t >= 4 ? b.around(tgt, GUARD_WALL.splash, b.enemiesOf(u)).filter((e) => e !== tgt) : [];
            b.dealDamage(u, tgt, v, { elem: 'phys', tag: 'proc', kind: 'strike', syn: 'GUARD' });
            for (const e of near) if (e.alive) b.dealDamage(u, e, v * GUARD_WALL.splashK, { elem: 'phys', tag: 'proc', kind: 'strike', syn: 'GUARD' });
          },
        },
      };
    },
  },
  {
    id: 'HUNTER', name: '사냥꾼', kind: 'trait', tiers: [2, 4, 6, 8], color: '#c98a4a', icon: '➶',
    desc: '사냥감을 끝까지 쫓는 이들. 사냥꾼 기물은 공격 속도와 치명타 피해가 크게 오르고 원거리 사냥꾼은 사거리가 1 늘며, (4)부터는 기본 공격 · 기술이 대상 최대 체력 비례 고정 피해를 더합니다 (사격 위력 일정 비율이 상한).',
    tierDesc: ['공격 속도 +15%, 치명타 피해 +20%p, 원거리 사냥꾼 사거리 +1', '공격 속도 +30%, 치명타 피해 +45%p, 공격마다 대상 최대 체력 2% 고정 피해 (사격 위력 400% 상한)', '공격 속도 +50%, 치명타 피해 +80%p, 최대 체력 3% 고정 피해 (상한 600%)',
      '[최상위 포식자] 공격 속도 +85%, 치명타 피해 +140%p, 최대 체력 5% 고정 피해 (상한 1000%)'],
    member: (t) => {
      const hp = T(t, [0, 0.02, 0.03, 0.05]), cap = T(t, [0, 4, 6, 10]);
      return {
        setup: (u) => { if (u.st.range > 1) u.st.range += 1; },
        stats: { atkSpd: T(t, [0.15, 0.3, 0.5, 0.85]), critDmg: T(t, [0.2, 0.45, 0.8, 1.4]) },
        hooks: hp ? {
          onDeal(b, u, tgt, r, o) {
            if ((o.tag !== 'basic' && o.tag !== 'skill') || r.amount <= 0 || !tgt.alive) return;
            b.dealDamage(u, tgt, Math.min(b.S(tgt, 'maxHp') * hp, b.S(u, 'shoot') * cap), { elem: 'true', tag: 'proc', syn: 'HUNTER' });
          },
        } : undefined,
      };
    },
  },
  {
    id: 'VOYAGE', name: '우리의 출항기!', kind: 'faction', tiers: [1, 5], color: '#4fc3c8', icon: '⛵',
    desc: '한 배를 탄 다섯 동료. 혼자 나가거나 다섯이 다 모였을 때만 힘을 냅니다.\n· 단독 출항 (정확히 1명): 출전한 구성원이 고유 능력을 얻습니다.\n· 완전체 (5명): 구성원 전원이 고유 능력을 얻고, 전투력이 오르며, 전투 기술을 쓰면 체력을 회복하고, 연장전에 피해 증폭이 크게 늘어납니다.\n· 2~4명일 때는 효과가 없습니다.\n고유 능력은 기물마다 다릅니다 (기물 상세 · 도감에서 확인).',
    tierDesc: ['[단독 출항] 정확히 1명 출전 시 고유 능력 (2~4명이면 효과 없음)', '[완전체] 구성원 전원 고유 능력, 전투력 +20, 기술 사용 후 최대 체력 9% 회복, 연장전 피해 증폭 +250%'],
    member: (t) => {
      if (t < 2) return null; // 1단계(단독 출항)는 고유 능력만 (special)
      const heal = 0.09, ot = 1 + 2.5;
      return {
        majors: { pow: 20 },
        hooks: {
          onSkill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * heal, false, 'VOYAGE'); },
          dmgMult: (b) => (b.t > CFG.overtimeStart - (b.ctx.otShift || 0) ? ot : 1), // 연장전 (초침의 서약이면 앞당겨짐)
        },
      };
    },
    special: (n, ctx) => (n === 1 || n >= 5) && ctx.unit ? VOYAGE_SPECIAL[ctx.unit.defId]?.effect || null : null,
  },
  {
    id: 'OCCULT', name: '신비학자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#b07cff', icon: '✶',
    desc: '금지된 지식을 다루는 이들. 처음 도달한 단계마다 신비학자 전용 개조부품 1개를 골라 받고 (단계마다 더 강력한 부품이 해금), 활성화되어 있으면 [전환] 갈림길에 [합성]이 열려 전용 소모품을 살 수 있습니다. 신비학자 기물은 효과 명중이 오릅니다.',
    // 부품 이름은 OCCULT_MODS 에서 읽는다 (items.ts 와 서로 import 하므로 늦게 계산)
    get tierDesc() {
      return OCCULT_HIT.map((h, i) => `${['', '', '[금지된 의식] ', '[금단의 계시] '][i]}효과 명중 +${pct(h)}p, ${i + 1}단계 부품 해금 (${occultModsOfTier(i + 1).map((id) => OCCULT_MODS[id].name).join(' · ')}), [합성] ${i ? `상품 +${i}` : '해금'}${OCCULT_SYNTH.disc[i] ? ` · 가격 -${pct(OCCULT_SYNTH.disc[i])}` : ''}`);
    },
    member: (t) => ({ stats: { effHit: T(t, OCCULT_HIT) } }),
  },
  {
    id: 'EXPLORER', name: '탐험가', kind: 'trait', tiers: [1], color: '#e6d27a', icon: '⚓',
    desc: `아문센 전용. ${CFG.rarePhase}페이즈부터 영입 후보에 나옵니다. 고유 전설 장비 [그늘]을 장착한 채 합류합니다 (해제 불가).`,
    tierDesc: ['[그늘]: 기술 쿨다운 감소 속도 +150%, 모든 아군 회피·치명타 확률 +10%p'],
  },
  {
    id: 'RFRIEND', name: '당신의 친구, R', kind: 'trait', tiers: [1], color: '#ff7aa8', icon: 'R',
    desc: '데미우르고스 전용. 출전한 시리우스 성도회 인원과 디바인 기물 1명당 데미우르고스의 모든 주요 능력치 +2 (정신력은 +4).',
    tierDesc: ['모든 주요 능력치 +2 × (성도회 인원 + 디바인 인원), 정신력은 추가 +2 ×'],
    member: (_t, ctx) => {
      const n = (ctx.counts.SIR || 0) + (ctx.run?.units.filter((x) => x.pos && UNIT_BY_ID[x.defId].ttype === 'divine').length || 0);
      return { majors: { vit: 2 * n, pow: 2 * n, mnd: 4 * n, def: 2 * n, agi: 2 * n } };
    },
  },
  {
    id: 'KING', name: '공왕', kind: 'trait', tiers: [1], color: '#c8303a', icon: '王',
    desc: '무휼 전용. 청라공국 시너지(3명 이상)가 전투 시작 때 소환합니다. 공명 등급 대신 인과 단계로 성장하고, 영입 · 판매 · 상점에 나오지 않습니다. 청라공국 인원에는 세지 않습니다.',
    tierDesc: ['인과 단계 1~10: 단계마다 모든 주요 능력치 · 위력 · 피해 · 최대 체력 상승, 4 · 7 · 10단계에 천명 기록 강화'],
  },
  {
    id: 'SANGUN', name: '산군', kind: 'trait', tiers: [1], color: '#e07a1f', icon: '虎',
    desc: '궁오 전용. 범이 된 산군. 체력이 처음 50% 이하가 되면 [범의 형상]으로 깨어납니다.',
    tierDesc: ['[범의 형상] 체력이 처음 50% 이하가 되면 8초간 피해 +40% · 흡혈 15%, 주변 1칸 적 1초 공포'],
    member: () => ({ hooks: { onHurt(b, u) {
      if (u.mem.tigerForm || b.hpPct(u) > 0.5) return;
      u.mem.tigerForm = 1;
      b.buff(u, u, 'sangun.form', 8, { mods: [inc('all', 0.4)], delta: { lifesteal: 0.15 }, label: '범의 형상' });
      for (const e of b.around(u, 1, b.enemiesOf(u))) b.applyStatus(u, e, { type: 'fear', key: 'fear', dur: 1 });
      b.fx(u.x, u.y, 1, 'phys');
    } } }),
  },
];

export const SYN_BY_ID = Object.fromEntries(SYNERGIES.map((s) => [s.id, s])) as Record<SynergyId, SynDef>;

/** 활성 단계 (0 = 비활성, 1 = 첫 단계 …) */
export function tierOf(id: SynergyId, count: number): number {
  const s = SYN_BY_ID[id];
  let t = 0;
  for (const need of s.tiers) if (count >= need) t++;
  return t;
}
export { pct };

const fameOf = (ctx: EffectCtx) => ctx.run?.fame || 0;

export type { Battle, CUnit };

/** 항해자 에이스 파일럿: 지정한 항해자가 출전 중이면 그 기물, 아니면 공명 등급이 가장 높은 항해자 */
export function aceTargetUid(run: RunState): string | null {
  const dep = run.units.filter((u) => u.pos && UNIT_BY_ID[u.defId].traits.includes('NAV'));
  if (dep.some((u) => u.uid === run.aceTarget)) return run.aceTarget;
  return dep.slice().sort((a, b) => b.rank - a.rank)[0]?.uid ?? null;
}

/** 엔지니어 포탑 생성 (build.ts 에서 주입: 순환 import 방지) */
export const ENG_HOOK: { spawn?: (b: Battle, lead: CUnit, engs: CUnit[], n: number) => void } = {};
/** 청라공국 공왕 무휼 생성 (build.ts 에서 주입): lead = 대표 청라 기물, t = 청라 단계 */
export const CHR_HOOK: { spawn?: (b: Battle, lead: CUnit, ctx: EffectCtx, t: number) => void } = {};
/** 칼리토 근위기사 생성 (build.ts 에서 주입) */
export const KAL_HOOK: { spawn?: (b: Battle, lead: CUnit, n: number) => void } = {};
