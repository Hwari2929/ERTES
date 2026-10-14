// 능력 설명 (통일 형식): 전투 기술은 구조화된 정보 + 효과 행, 특성 · 증강은 토큰 문장.
// 토큰 (ui/abil.ts 가 해석):
//   [dmg:pow:계수:속성(:타수)]  위력 × 계수 기본 피해      [dmg+:pow:계수]  피해 증가량
//   [heal:계수] [heal+:계수] [shield:계수]  기술 위력 기반 회복 · 보호막
//   [st:키:초(:확률)]  상태 이상 (용어 설명에 추가)        [g:키]  용어 (설명에 추가)
//   [t:칸] [s:초] [p:비율] [pp:비율포인트]
// 위력 종류: shoot · strike · tech (지휘관은 자동으로 전술 위력)

import { ABIL_A, GLOSS_A } from './abil/a';
import { ABIL_B, GLOSS_B } from './abil/b';
import { ABIL_C, GLOSS_C } from './abil/c';
import { ABIL_F, GLOSS_F } from './abil/f';

/** 대상 범위: 단일 / 대상 주변 r칸 / 자신 주변 r칸 / 직선 / 전체 */
export type Area = { k: 'one' } | { k: 'around'; r: number } | { k: 'self'; r: number } | { k: 'line' } | { k: 'all'; ally?: boolean };
export interface SkillInfo {
  /** 대상 고르는 방식 */
  tgt: string;
  /** 사거리: 'unit' = 기물 사거리, null = 거리 무관 */
  range: 'unit' | number | null;
  area: Area;
  /** [항목, 값] — 값은 토큰 문장 */
  rows: [string, string][];
}
export interface AbilText {
  skill?: (p: Record<string, number>) => SkillInfo;
  trait?: string;
  ace?: (k: number) => string;
  /** 증강 id(접두 없이) → 토큰 문장 */
  augs?: Record<string, string>;
}

/** 용어 설명: 문장 끝에 --- 아래로 모아 보여준다 */
export const GLOSS: Record<string, { name: string; desc: string }> = {
  stun: { name: '기절', desc: '이동 · 공격 · 스킬 사용 불가. 보스는 지속 시간 절반.' },
  fear: { name: '공포', desc: '공격 · 스킬 사용 불가. 보스는 지속 시간 절반.' },
  shock: { name: '감전', desc: '스킬 쿨다운이 줄지 않음.' },
  slow: { name: '둔화', desc: '공격 속도 · 이동 속도 감소.' },
  corrode: { name: '침식', desc: '방어도 감소.' },
  vuln: { name: '취약', desc: '받는 피해 증가.' },
  suppress: { name: '제압', desc: '다음 공격 피해가 1이 됨. 10초 지속.' },
  bleed: { name: '출혈', desc: '초당 물리 피해.' },
  poison: { name: '중독', desc: '초당 화학 피해.' },
  pen: { name: '방어도 관통', desc: '대상 방어도를 비율만큼 무시.' },
  forget: { name: '망각', desc: '대상 스킬 쿨다운 증가.' },
  red: { name: '피해량 경감', desc: '받는 피해를 비율만큼 줄인다 (이로운 효과).' },
  weak: { name: '피해량 감소', desc: '대상이 가하는 피해를 비율만큼 줄인다 (해로운 효과).' },
  camp: { name: '임시 장비', desc: '캠핑 러버: 전투마다 장비 칸을 쓰지 않는 무작위 장비를 받음.' },
  turret: { name: '포탑', desc: '엔지니어 시너지로 전투 시작 시 배치되는 포탑.' },
  tac: { name: '전술 위력', desc: '지휘관 전용 위력 (사격 · 타격 · 기술 위력과 같은 단위, 출전 4명 · 지휘관 1명 기준 100). 출전 기물 1명당 +16, 지휘관 1명 추가당 +40, 지휘관 정신력 1당 +2. 지휘관의 스킬은 사격 · 타격 · 기술 위력 대신 이 값을 씀.' },
  combo: { name: '콤보', desc: '정해진 횟수째 공격이 피니쉬로 강화됨.' },
  finish: { name: '피니쉬', desc: '콤보 마지막 공격. 기본 피해 ×2.6.' },
  mag: { name: '탄창', desc: '다 쓰면 재장전하는 동안 공격 불가.' },
  psy: { name: '정신 피해', desc: '정신 속성 피해. 사이오닉 이성 · 정신 저항의 영향을 받음.' },
  crit: { name: '치명타', desc: '확률로 치명타 피해 배율만큼 피해 증가.' },
  rewind: { name: '되감기', desc: '전투당 1회, 쓰러질 피해를 받으면 체력 50%로 복귀.' },
  cleanse: { name: '정화', desc: '해로운 효과를 모두 제거.' },
  immobile: { name: '고정', desc: '이동하지 않음.' },
};

const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');

const ABIL_PILOT: Record<string, AbilText> = {
  yelena: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy]`],
        ['망각', `[g:forget] 쿨다운 +[s:${p.forget}]`],
        ['약화', `[g:weak] [p:${p.weak}] ([s:${p.weakDur}])`],
        ['공포', `[st:fear:${p.fear}:${p.fearChance}]`],
        ...(p.vuln ? [['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`] as [string, string]] : []),
      ],
    }),
    trait: '기본 공격이 [g:psy]로 바뀐다. 기본 공격 피해 [pp:-0.25]. 정신 피해를 받은 적: 스킬 쿨다운 +[s:1] (대상당 1초에 1회).',
    augs: {
      wide: '항밈 소거 범위: 대상 주변 [t:1]. 피해 [dmg+:tech:0.3:psy].',
      deep: '[g:forget] +[s:3]. 공포 확률 [pp:0.25].',
      delta: '맞은 적에게 [st:vuln:4]: 받는 피해 +[p:0.3].',
      report: '항밈 소거 피해 [dmg+:tech:1.6:psy].',
      hoodie: '정신력 +9, 기동력 +6.',
    },
  },
  gebek: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...(p.corrode ? [['침식', `[st:corrode:5] 방어도 -[p:${p.corrode}]`] as [string, string]] : []),
      ],
    }),
    trait: '기본 공격 적중 시 [p:0.25] 확률로 [g:suppress].',
    augs: {
      drum: '헤비 버니 화망 타수 +3.',
      zirgon: '헤비 버니 화망 발당 피해 [dmg+:shoot:0.4:phys].',
      nuke: '맞은 적에게 [st:corrode:5]: 방어도 -[p:0.5].',
      suit: '방어력 +10, 생명력 +5.',
      spare: '[g:turret] +1기. 포탑 체력 · 방어도 +[p:0.4].',
    },
  },
  temur: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys]`],
        ['관통', `[g:pen] [p:${p.pen}]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
    }),
    trait: '효과 저항 [pp:1]. 피해를 받을 때마다 타격 피해 [pp:0.02] (전투 동안, 최대 [pp:2]).',
    augs: {
      rapier: '경기장의 검 피해 [dmg+:strike:1:phys]. [g:pen] [pp:0.3].',
      ritual: '경기장의 검 범위 +[t:1]. 피해 [dmg+:strike:0.3:phys].',
      lava: '효과 저항 [pp:0.25], 방어도 +250.',
      meal: '생명력 +10, 방어력 +5.',
      fur: '방어력 +9, 기동력 +6.',
    },
  },
  winter: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
        ...(p.splash ? [['주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'] as [string, string]] : []),
      ],
    }),
    trait: '치료한 아군 최대 체력 +[p:0.02] (전투 동안, 대상당 최대 5회).',
    augs: {
      serum: '임상 시험 혈청 회복 [heal+:2.2].',
      cohort: '대상 주변 [t:1] 아군에게도 [p:0.5] 효과.',
      sterile: '[g:red] [pp:0.2]. 지속 +[s:3].',
      tenure: '정신력 +10, 생명력 +5.',
      paper: '쿨다운 감소 속도 [pp:0.4].',
      'sp.vaccine': '임상 시험 혈청 사용 시 모든 아군 [heal:0.88] (기본 회복의 [p:0.4]).',
      'sp.antidote': '치료한 아군에게 [g:cleanse].',
      'sp.pathogen': '기본 공격 적중 시 [st:poison:4]: 초당 [dmg:tech:0.3:chem].',
      'sp.tenure': '생명과학 교수 대상당 상한 5회 → 10회.',
      'sp.phase2': '혈청 받는 피해 감소 -[p:0.25], 지속 [s:6].',
      'sp.overheal': '넘친 회복량의 [p:0.5]를 보호막으로.',
      'sp.trial': '혈청을 적에게: [dmg:tech:2.2:chem] + [st:vuln:4] 받는 피해 +[p:0.15] (임상 2상 수치 적용).',
      'sp.lab': '전투 시작 시 보안위원회 · 의무관 아군 1명당 기술 위력 +8.',
    },
  },
  amundsen: {
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['관통', `[g:pen] [p:${p.pen}]`],
        ['둔화', `[st:slow:3] 공격 · 이동 속도 -[p:${p.slow}]`],
        ...(p.crit ? [['치명타', `[g:crit] 확률 [pp:${p.crit}]`] as [string, string]] : []),
      ],
    }),
    trait: '고유 전설 장비 [그늘]을 장착하고 합류. 기본 공격 · 스킬은 [g:tac]으로 계산.',
    ace: (k) => `전투 시작 시 모든 아군 쿨다운 감소 속도 [pp:${0.15 * k}].`,
    augs: {
      wander: '화력 지원 피해 [dmg+:shoot:2.8:phys].',
      refit: '[g:pen] [pp:0.4]. 화력 지원 [g:crit] 확률 [pp:0.15].',
      twin: '화력 지원 2회 (두 번째도 [p:1] 피해).',
      carpet: '화력 지원 범위: 대상 주변 [t:1]. 피해 [dmg+:shoot:0.3:phys].',
      travelogue: '모든 메이저 스탯 +4.',
      'sp.shade': '[g:rewind].',
      'sp.mount': '[g:immobile]. 기본 공격 피해 ×1.6, 사거리 +[t:2].',
      'sp.order': '기본 공격을 하지 않음. [g:tac] +48.',
      'sp.volley': '스킬 포격이 대상 주변 [t:1] 적에게도 [p:0.6] 피해.',
      'sp.journal': '이번 런에서 방문한 사건 노드 1개당 자신의 [g:tac] +[p:0.01] (최대 +[p:0.3]).',
      'sp.motto': '전투 시작 시 엘베스타드 아군 [g:red] [p:0.1], 최대 체력 +[p:0.1].',
      'sp.cover': '체력이 처음 [p:0.5] 이하가 되면 모든 아군 [s:3] 동안 [g:red] [p:0.6].',
      'sp.maint': '화력 지원 쿨다운 -[s:2], [g:pen] [p:0.3] → [p:0.6].',
    },
  },
};

for (const g of [GLOSS_A, GLOSS_B, GLOSS_C, GLOSS_F]) for (const [k, v] of Object.entries(g)) GLOSS[k] ??= v;

export const ABIL: Record<string, AbilText> = { ...ABIL_A, ...ABIL_B, ...ABIL_C, ...ABIL_F, ...ABIL_PILOT };

/** 공용 증강 (메이저 · 사이오닉) */
export const AUG_TEXT: Record<string, string> = {};

/** 증강 id(owner.key) → 통일 문장 */
export function augAbilText(id: string): string | null {
  if (AUG_TEXT[id]) return AUG_TEXT[id];
  const i = id.indexOf('.');
  if (i < 0) return null;
  return ABIL[id.slice(0, i)]?.augs?.[id.slice(i + 1)] ?? null;
}

/** 공용 증강 문장 */
Object.assign(AUG_TEXT, {
  'maj.shoot': '사격 피해 [pp:0.2].',
  'maj.strike': '타격 피해 [pp:0.2].',
  'maj.tech': '기술 피해 [pp:0.2].',
  'maj.crit': '[g:crit] 피해 [pp:0.3].',
  'maj.hp': '최대 체력 +[p:0.15].',
  'maj.reload': '재장전 속도 +[p:0.25].',
  'maj.finish': '[g:finish] 피해 [pp:0.4].',
  'maj.cdr': '쿨다운 감소 속도 [pp:0.2].',
  'maj.dot': '지속 피해 [pp:0.3].',
  // ── 사이오닉 학파 (합류 시 선택): 소마법 + 고이성 · 저이성 효과 (이성에 비례)
  'school.pyro': '[g:cantrip] 「불씨」 ([s:5] · [g:reason] -8): 대상 적에게 [g:burn] 2중첩 ([s:6]간 중첩당 초당 [dmg:tech:0.06:phys], 최대 5중첩, 걸 때마다 시간 갱신). 고이성: 효과 명중 최대 [pp:0.3]. 저이성: 주고받는 물리 피해 최대 +[p:0.4] (연소 포함).',
  'school.volt': '[g:cantrip] 「방전」 ([s:5] · [g:reason] -8): 대상에게 [dmg:tech:0.9:elec] + [s:4] [g:conduct] (대상이 공격 · 스킬을 쓸 때마다 주변 [t:1] 다른 적에게 [dmg:tech:0.3:elec]). 고이성: 받는 전기 피해 최대 -[p:0.4]. 저이성: 주고받는 전기 피해 최대 +[p:0.4].',
  'school.seed': '[g:cantrip] 「포자」 ([s:5] · [g:reason] -6): 대상 적 [st:poison:5] (초당 [dmg:tech:0.15:chem]) + 체력 비율이 가장 낮은 아군 [s:5] [g:regen] (초당 [heal:0.1]). 고이성: 받는 회복량 최대 +[p:0.3]. 저이성: 주고받는 화학 피해 최대 +[p:0.4].',
  'school.chrono': '[g:cantrip] 「엔트로피」 ([s:4] · [g:reason] -7): 대상 적 [g:chill] 2중첩 (중첩당 공격 · 이동 속도 -[p:0.06], 초당 [dmg:tech:0.03:phys], [s:4], 최대 6중첩). 걸 때 중첩 × [p:0.08] 확률로 [st:freeze:1.5] (중첩 소모). 고이성: 쿨다운 감소 속도 최대 [pp:0.4]. 저이성: 공격 속도 최대 +[p:0.4], 회피 최대 [pp:-0.2].',
  'school.trans': '[g:cantrip] 「계시」 ([s:7] · [g:reason] -10): 대상과 주변 [t:1] 적 최대 3명 [s:5] [g:bond] (받는 피해 +[p:0.1], 받은 피해의 [p:0.25]를 다른 결속 대상이 나눠 받음). 대상이 일반 적이면 [st:charm:1.5]. 고이성: 받는 정신 피해 최대 -[p:0.4]. 저이성: 주고받는 정신 피해 최대 +[p:0.4].',
  'school.wave': '[g:cantrip] 「충격파」 ([s:6] · [g:reason] -8): 대상에게 [dmg:tech:0.7:phys] + [g:knock] + [s:5] [g:resonance] (피격될 때마다 주변 [t:1] 적에게 [dmg:tech:0.15:phys], 0.5초에 1회). 고이성: 받는 고정 피해 최대 -[p:0.4]. 저이성: 효과 명중 최대 [pp:0.3], 효과 저항 최대 [pp:-0.3].',
  'school.gold': '[g:cantrip] 「시장 개입」 ([s:8] · [g:reason] -8): 성공 확률 [p:0.3] + [p:0.5] × |이성|/100. 성공하면 무작위 재료 장비 1개를 [g:tempgear] (최대 3개). 실패하면 체력이 가장 낮은 아군에게 [shield:0.8]. 고이성: 보유 크레딧 10당 [g:red] +1% (최대 [p:0.15]). 저이성: 보유 크레딧 10당 주는 피해 +1.5% (최대 +[p:0.25]).',
  // ── 학파 전공 (지속 능력)
  'psi.pyro.boil': '[g:burn] 최대 중첩 5 → 8.',
  'psi.pyro.ignite': '불씨가 [g:burn] 5중첩 이상인 적에게 걸리면 점화: 남은 연소 피해 ×1.5를 즉시 주고 (연소 소모), 주변 [t:1] 적에게 연소 2중첩.',
  'psi.pyro.wildfire': '[g:burn]된 적이 쓰러지면 그 중첩을 주변 [t:1] 적에게 그대로 옮긴다.',
  'psi.pyro.white': '[g:burn] 1중첩당 대상 방어도 -[p:0.04].',
  'psi.pyro.cycle': '[g:burn] 피해의 [p:0.15]만큼 자신에게 보호막.',
  'psi.pyro.overheat': '[g:reason]이 0 미만이면 불씨 쿨다운 -[p:0.4], 이성 소모 ×1.5.',
  'psi.volt.hv': '[g:conduct] 피해 [dmg:tech:0.3:elec] → [dmg:tech:0.5:elec], 범위 [t:1] → [t:2].',
  'psi.volt.chain': '방전이 대상에서 가장 가까운 다른 적 2명에게 [dmg:tech:0.45:elec]로 튄다.',
  'psi.volt.short': '방전이 [st:shock:1:0.3]. [g:shock]된 적에게 주는 피해 +[p:0.25].',
  'psi.volt.store': '[g:conduct] 피해를 줄 때마다 [g:reason] +1 (초당 최대 +3).',
  'psi.volt.cage': '전투 시작 [s:6]간 자신과 주변 [t:1] 아군 받는 전기 피해 -[p:0.25], 효과 저항 [pp:0.2].',
  'psi.volt.oc': '[g:cantrip]을 쓴 뒤 [s:3]간 공격 속도 +[p:0.3].',
  'psi.seed.conc': '[g:poison]이 최대 3중첩까지 쌓인다.',
  'psi.seed.symb': '[g:regen]이 체력 비율이 낮은 아군 2명에게.',
  'psi.seed.rot': '[g:poison]된 적이 받는 회복 -[p:0.5].',
  'psi.seed.photo': '[g:reason]이 50 이상이면 초당 자신 최대 체력 [p:0.01] 회복.',
  'psi.seed.burst': '[g:poison]된 적이 쓰러지면 주변 [t:1] 적에게 중독을 옮긴다.',
  'psi.seed.anti': '포자의 [g:regen] 대상에게서 해로운 효과 1개 제거.',
  'psi.chrono.zero': '[g:freeze] 확률 중첩당 [p:0.08] → [p:0.12].',
  'psi.chrono.determ': '[g:freeze]된 적이 받는 피해 +[p:0.3].',
  'psi.chrono.perma': '[g:freeze] 지속 [s:1.5] → [s:2.5].',
  'psi.chrono.delay': '엔트로피가 주변 [t:1] 적에게도 [g:chill] 1중첩.',
  'psi.chrono.rewind': '전투당 1회, 체력이 [p:0.3] 이하가 되면 [s:3] 전 체력으로 되돌아간다.',
  'psi.chrono.revert': '[g:freeze]가 일어날 때마다 [g:reason] +4.',
  'psi.trans.ascend': '[g:charm] 지속 +[s:1], 정예에게도 걸린다 (절반 지속).',
  'psi.trans.fate': '[g:bond] 공유 비율 [p:0.25] → [p:0.5].',
  'psi.trans.collective': '[g:bond] 대상 최대 3 → 5명.',
  'psi.trans.dominate': '[g:charm]된 적이 주는 피해 +[p:0.5].',
  'psi.trans.gaze': '[g:bond]된 적에게 주는 [g:psy] +[p:0.25].',
  'psi.trans.split': '[g:reason]이 0 미만일 때 받는 피해의 [p:0.3]를 [g:bond]된 적에게 넘긴다.',
  'psi.wave.freq': '[g:resonance] 피해 [dmg:tech:0.15:phys] → [dmg:tech:0.25:phys].',
  'psi.wave.impact': '[g:knock]으로 밀려난 적이 다른 기물과 부딪히면 둘 다 [st:stun:1] (부딪힌 쪽이 아군이면 적만).',
  'psi.wave.amp': '충격파가 대상 주변 [t:1] 적 모두를 [g:knock]하고 [g:resonance]을 건다.',
  'psi.wave.field': '[g:reason]이 50 이상이면 [g:red] [p:0.15].',
  'psi.wave.standing': '[g:resonance]된 적이 기절 · 빙결되면 공진 지속 시간이 갱신된다.',
  'psi.wave.seismic': '충격파가 [st:stun:0.8:0.25].',
  'psi.gold.futures': '전투 시작 시 무작위 재료 장비 1개를 [g:tempgear].',
  'psi.gold.insider': '시장 개입 성공 확률 [pp:0.2].',
  'psi.gold.bull': '[g:reason]이 0 이상이면 [g:tempgear] 1개당 주는 피해 +[p:0.06].',
  'psi.gold.short': '[g:reason]이 0 미만이면 시장 개입이 대상 적에게 [dmg:tech:1.5:phys] (임시 장비 1개당 +[p:0.2]).',
  'psi.gold.vol': '[g:reason] 증감량 ×1.5, 시장 개입 쿨다운 -[s:2].',
  'psi.gold.folio': '[g:tempgear]이 3개면 고이성 · 저이성 효과가 모두 [p:0.5]씩 함께 적용.',
} as Record<string, string>);
Object.assign(GLOSS, {
  reason: { name: '이성', desc: '사이오닉 게이지 (-100 ~ +100). 학파의 고이성 · 저이성 효과가 이성에 비례해 커진다. 0 미만이면 초당 최대 체력 × 1% × (−이성/100) 정신 피해 (−50 이하 2배).' },
  frenzy: { name: '광폭', desc: '이성 −100에서 시작. 피아 구분 없이 가장 가까운 대상을 공격, 소마법 불가, 주는 피해 +30%. 초당 이성 +5, −60을 넘으면 해제.' },
  cantrip: { name: '소마법', desc: '사이오닉 학파의 추가 능동 기술. 전투 스킬과 별개로 쿨다운마다 자동 시전하고, 쓸 때마다 이성이 줄어든다. 공포 · 광폭 중에는 쓰지 않는다.' },
  burn: { name: '연소', desc: '중첩당 초당 물리 피해 (기본 최대 5중첩). 다시 걸리면 지속 시간 갱신.' },
  conduct: { name: '전도', desc: '대상이 기본 공격 · 전투 스킬을 쓸 때마다 주변 적에게 전기 피해.' },
  regen: { name: '지속 회복', desc: '1초마다 체력 회복.' },
  chill: { name: '오한', desc: '중첩당 공격 · 이동 속도 -6%, 약한 지속 피해 (최대 6중첩).' },
  freeze: { name: '빙결', desc: '행동 불가 (기절과 같음). 보스 · 구조물 면역, 정예는 지속 시간 절반.' },
  charm: { name: '매혹', desc: '잠시 시전자 편으로 싸우고, 원래 아군에게 공격받는다. 보스 · 영혼 면역, 정예는 지속 시간 절반.' },
  bond: { name: '결속', desc: '받는 피해 +10%. 받은 피해의 일부를 다른 결속 대상이 나눠 받는다.' },
  resonance: { name: '공진', desc: '피격될 때마다 주변 1칸 적에게 피해 (0.5초에 1회).' },
  knock: { name: '밀쳐내기', desc: '시전자 반대 방향으로 1칸 밀려난다 (빈 칸일 때). 보스 · 고정 기물 면역.' },
  tempgear: { name: '임시 장착', desc: '이번 전투 동안만 장착되는 장비 (장비 칸을 쓰지 않고 전투 후 사라진다).' },
  spawn: { name: '증원', desc: '전장에 아군 개체를 추가로 불러냄.' },
  lifesteal: { name: '흡혈', desc: '준 피해의 일부만큼 회복.' },
} as Record<string, { name: string; desc: string }>);

/** 적 스킬 · 특성 */
export const ENEMY_ABIL: Record<string, { skill?: SkillInfo; trait?: string }> = {
  crawler: { trait: '기본 공격 적중 시 [p:0.5] 확률로 [st:poison:3]: 초당 [dmg:strike:0.25:chem].' },
  sw_spore: { trait: '기본 공격 적중 시 [p:0.5] 확률로 [st:poison:3]: 초당 [dmg:strike:0.2:chem].' },
  sw_spitter: { trait: '기본 공격 적중 시 [p:0.3] 확률로 [st:corrode:3]: 방어도 -[p:0.15].' },
  cr_thrall: { trait: '기본 공격 시 [heal:0.6] (타격 위력 기준).' },
  cr_hound: { trait: '기본 공격 적중 시 [p:0.4] 확률로 [st:bleed:3]: 초당 [dmg:strike:0.2:phys].' },
  pt_anomaly: { trait: '기본 공격 적중 시 [p:0.15] 확률로 [st:fear:1].' },
  sw_brood: { trait: '[s:14]마다 포자 살점 2기 [g:spawn] (동시 최대 6기).' },
  pt_unixline: { trait: '[s:12]마다 유닉스 생산 로봇 [g:spawn]. 매번 수가 늘어남 (동시 최대 4기).' },
  trooper: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:strike:1:phys]'], ['기절', '[st:stun:1:0.7]']] } },
  sw_carrier: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:strike:1:phys]'], ['기절', '[st:stun:1:0.6]']] } },
  priest: { skill: { tgt: '체력 비율이 가장 낮은 아군 (85% 이하)', range: null, area: { k: 'one' }, rows: [['회복', '[heal:3]']] } },
  cr_leech: { skill: { tgt: '체력 비율이 가장 낮은 아군 (85% 이하)', range: null, area: { k: 'one' }, rows: [['회복', '[heal:3]']] } },
  warlord: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:strike:1.5:phys]'], ['강화', '모든 아군 [s:4] 피해 +[p:0.2]']] } },
  varga: { skill: { tgt: '현재 대상', range: 'unit', area: { k: 'one' }, rows: [['피해', '[dmg:strike:2.2:phys]'], ['광폭화', '모든 아군 [s:5] 공격 속도 +[p:0.3], 피해 +[p:0.3]']] } },
  goliath: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 2 }, rows: [['피해', '[dmg:tech:1.2:elec]'], ['기절', '[st:stun:1:0.5]']] },
    trait: '[s:15]마다 정찰 드론 2기 [g:spawn].',
  },
  nyx: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 3 }, rows: [['피해', '[dmg:tech:1:psy]'], ['공포', '[st:fear:1.5:0.4]']] } },
  sw_queen: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 3 }, rows: [['피해', '[dmg:tech:0.8:psy]'], ['공포', '[st:fear:1:0.3]'], ['강화', '모든 아군 [s:5] 공격 속도 +[p:0.3], 피해 +[p:0.25]']] } },
  sw_harvester: {
    skill: { tgt: '현재 대상', range: 'unit', area: { k: 'one' }, rows: [['피해', '[dmg:strike:2.5:phys]'], ['회복', '자신 최대 체력의 [p:0.04]']] },
    trait: '[s:15]마다 포자 살점 2기 [g:spawn].',
  },
  cr_knight: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:strike:1.6:phys]'], ['회복', '자신 최대 체력의 [p:0.06]']] } },
  cr_count: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 2 }, rows: [['피해', '[dmg:strike:1.4:phys]'], ['회복', '자신 최대 체력의 [p:0.06]'], ['강화', '모든 아군 [s:5] 피해 +[p:0.25]']] } },
  cr_heart: {
    skill: { tgt: '모든 적', range: null, area: { k: 'all' }, rows: [['피해', '[dmg:tech:0.5:chem]'], ['중독', '[p:0.5] 확률로 [st:poison:4]: 초당 [dmg:tech:0.1:chem]']] },
    trait: '[s:15]마다 혈족 종자 1기 [g:spawn].',
  },
  sp_phalanx: { skill: { tgt: '모든 아군', range: null, area: { k: 'all', ally: true }, rows: [['보호막', '각자 최대 체력의 [p:0.15]'], ['방어도', '[s:4] 방어도 +200']] } },
  sp_spear: { skill: { tgt: '현재 대상 (없으면 가장 먼 적)', range: null, area: { k: 'line' }, rows: [['피해', '[dmg:tech:2:elec]']] } },
  sp_colossus: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 2 }, rows: [['피해', '[dmg:tech:1.2:elec]'], ['기절', '[st:stun:1:0.5]']] },
    trait: '[s:15]마다 예인 드론 2기 [g:spawn].',
  },
  pt_auditor: { skill: { tgt: '현재 대상', range: null, area: { k: 'one' }, rows: [['피해', '[dmg:shoot:1.5:phys]'], ['취약', '[st:vuln:8] 받는 피해 +[p:0.3]']] } },
  pt_contract: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 3 }, rows: [['피해', '[dmg:tech:1:psy]'], ['취약', '[st:vuln:4] 받는 피해 +[p:0.2]']] } },
};
