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
  bounce: { name: '바운스', desc: '피해가 맞은 적에서 정해진 칸 안의 다른 적에게 차례로 옮겨 가며 다시 맞히는 것. "n% 계수의 OO 속성 피해가 n칸 내의 적에게 최대 n회 바운스된다" 꼴로 적는다. 바로 직전에 맞은 적에게는 다시 가지 않는다.' },
  turret: { name: '포탑', desc: '엔지니어 시너지로 전투 시작 시 배치되는 감시 포탑 (기계 · 구조물). 포탑 전용 장비를 장착할 수 있다.' },
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
  // ── 사이오닉 전공 (합류 시 학파의 전공 중 선택): 비술 + 지속 능력 + 학파 이성 축 (이성에 비례). 계수 = 주요 위력
  'school.pyro': '[g:cantrip] 「소각」 ([s:6] · [g:reason] -8): [g:burn] 중첩이 가장 많은 적(없으면 현재 대상)과 주변 [t:1] 적에게 [dmg:main:0.6:phys]. 대상의 연소를 제거하고 소모한 중첩 1당 [dmg:main:0.5:phys]. 연소가 없으면 연소 2중첩. 지속 「발화」: 적중 시 [p:0.25] 확률로 [g:burn] 1중첩 (중첩당 초당 [dmg:main:0.12:phys], 최대 5중첩, [s:5]). 열역학파 — 고이성: 받는 물리 피해 최대 -[p:0.3]. 저이성: 주는 물리 피해 최대 +[p:0.4].',
  'school.chrono': '[g:cantrip] 「서리 파편」 ([s:6] · [g:reason] -8): 서로 다른 적 3명에게 각각 [dmg:main:0.5:phys] (적이 적으면 중복). 각 대상 [p:0.25] 확률로 [st:freeze:2] ([g:chill] 1중첩당 [pp:0.1]), 빙결되면 오한 제거. 지속 「절대 0도」: 적중 시 [p:0.3] 확률로 [g:chill] 1중첩 (중첩당 초당 [dmg:main:0.04:phys], 이동 · 공격 속도 [pp:-0.08], 최대 4중첩, [s:5]). 열역학파 — 고이성: 받는 물리 피해 최대 -[p:0.3]. 저이성: 주는 물리 피해 최대 +[p:0.4].',
  'school.volt': '[g:cantrip] 「방전」 ([s:5] · [g:reason] -8): 대상에게 [dmg:main:0.9:elec] + [g:conduct] 2중첩. 지속 「유도 전류」: 적중 시 [p:0.25] 확률로 [g:conduct] 1중첩 (대상이 공격 · 스킬을 쓸 때마다 주변 [t:1] 다른 적에게 중첩당 [dmg:main:0.15:elec], 최대 3중첩, [s:5]). 장역학파 — 고이성: 받는 전기 피해 최대 -[p:0.3]. 저이성: 주는 전기 피해 최대 +[p:0.4].',
  'school.wave': '[g:cantrip] 「충격파」 ([s:6] · [g:reason] -8): 대상에게 [dmg:main:0.7:elec] + [g:knock] + [s:5] [g:resonance]. 지속 「공명」: 적중 시 [p:0.2] 확률로 [g:resonance] (피격될 때마다 주변 [t:1] 적에게 [dmg:main:0.15:elec], 0.5초에 1회). 장역학파 — 고이성: 받는 전기 피해 최대 -[p:0.3]. 저이성: 주는 전기 피해 최대 +[p:0.4].',
  'school.seed': '[g:cantrip] 「포자」 ([s:5] · [g:reason] -6): 대상 적에게 [dmg:main:0.4:chem] + [g:poison] 2중첩 ([s:5], 중첩당 초당 [dmg:main:0.1:chem]). 지속 「대사」: 적중 시 [p:0.25] 확률로 [g:poison] 1중첩 (최대 3중첩). 생명학파 — 고이성: 받는 화학 · 정신 피해 최대 -[p:0.3]. 저이성: 주는 화학 · 정신 피해 최대 +[p:0.35].',
  'school.mind': '[g:cantrip] 「계시」 ([s:7] · [g:reason] -10): 대상과 주변 [t:1] 적 최대 3명 [s:5] [g:bond] (받는 피해 +[p:0.1], 받은 피해의 [p:0.25]를 다른 결속 대상이 나눠 받음). 대상이 일반 적이면 [st:charm:1.5]. 지속 「자아 침식」: 적중 시 [st:confuse:1:0.15]. 생명학파 — 고이성: 받는 화학 · 정신 피해 최대 -[p:0.3]. 저이성: 주는 화학 · 정신 피해 최대 +[p:0.35].',
  'school.gold': '[g:cantrip] 「시장 개입」 ([s:8] · [g:reason] -8): 성공 확률 [p:0.4] + [p:0.5] × |이성|/100. 성공: 무작위 재료 장비 1개를 [g:tempgear] (최대 3개). 실패: 체력이 가장 낮은 아군에게 [shield:0.8:main]. 지속 「분산 투자」: 임시 장비 1개당 주는 피해 +[p:0.05], [g:red] +[p:0.03]. 인과학파 — 고이성: 받는 [g:crit] 피해 최대 -[p:0.4], 회피 최대 [pp:0.1]. 저이성: 치명타 확률 최대 [pp:0.25], 치명타 피해 최대 +[p:0.25].',
  'school.illusion': '[g:cantrip] 「환영 향」 ([s:7] · [g:reason] -8): 대상 적 근처에 [g:illusion] 1기 ([s:6], 최대 2기, 체력 = 자신 최대 체력 [p:0.3]). 주변 [t:1] 적은 환영을 우선 공격한다 ([g:taunt]). 지속 「향취」: 적중 시 [st:scent:4:0.2]. 인과학파 — 고이성: 받는 [g:crit] 피해 최대 -[p:0.4], 회피 최대 [pp:0.1]. 저이성: 치명타 확률 최대 [pp:0.25], 치명타 피해 최대 +[p:0.25].',
  // ── 전공 증강 (전공당 7종, ◆ = 변형)
  'psi.pyro.wp': '[g:burn] 최대 중첩 5 → 10. 소각의 중첩당 피해 [dmg:main:0.5:phys] → [dmg:main:0.35:phys].',
  'psi.pyro.chain': '소각으로 [g:burn]을 소모한 적이 쓰러지면 소각이 즉시 한 번 더 나간다 (쿨다운 · 이성 소모 없음).',
  'psi.pyro.spread': '[g:burn]된 적이 쓰러지면 그 중첩을 주변 [t:1] 적 모두에게 옮긴다.',
  'psi.pyro.white': '[g:burn] 1중첩당 대상 방어도 -[p:0.06]. 소각 피해는 중첩을 제거하기 전에 계산한다.',
  'psi.pyro.runaway': '[g:reason]이 0 미만이면 발화 확률 2배, 소각 쿨다운 -[p:0.5]. 대신 자신이 준 연소 피해의 [p:0.1]를 자신도 받는다.',
  'psi.pyro.ember': '[g:burn] 피해의 [p:0.2]만큼 자신에게 보호막.',
  'psi.pyro.beacon': '◆ 발화가 아군 전원의 기본 공격에 [p:0.1] 확률로 붙는다 ([g:burn] 1중첩). 자신의 발화 확률은 0.',
  'psi.chrono.perma': '[g:freeze] [s:2] → [s:3]. 빙결을 걸어도 [g:chill]이 사라지지 않는다.',
  'psi.chrono.stop': '[g:freeze]된 적이 받는 피해 +[p:0.4].',
  'psi.chrono.storm': '서리 파편 3발 → 6발. 파편당 피해 [dmg:main:0.5:phys] → [dmg:main:0.3:phys].',
  'psi.chrono.rewind': '전투당 1회, 체력이 [p:0.3] 이하가 되면 [s:3] 전 체력으로 돌아가고 그사이 걸린 해로운 효과를 지운다.',
  'psi.chrono.revert': '[g:freeze]를 걸 때마다 [g:reason] +6. 빙결된 적 1명당 쿨다운 감소 속도 [pp:0.1] (최대 [pp:0.3]).',
  'psi.chrono.zero': '[g:chill] 최대 4 → 6중첩. 6중첩인 적에게 다음 적중은 확정 [g:freeze].',
  'psi.chrono.haste': '◆ 서리 파편이 적 대신 아군 3명에게 [s:4]간 공격 속도 +[p:0.25]를 준다. 절대 0도는 그대로.',
  'psi.volt.hv': '[g:conduct] 범위 [t:1] → [t:2]. 중첩당 피해 [dmg:main:0.15:elec] → [dmg:main:0.22:elec].',
  'psi.volt.chain': '[dmg:main:0.54:elec]가 가장 가까운 적부터 최대 3회 [g:bounce]된다 (거리 제한 없음).',
  'psi.volt.short': '[g:conduct] 3중첩인 적이 행동하면 [st:shock:1] (같은 적에게 2초에 1회).',
  'psi.volt.store': '[g:conduct] 피해를 줄 때마다 [g:reason] +1 (초당 최대 +3).',
  'psi.volt.overload': '방전 대상이 [g:conduct] 3중첩이면 중첩을 모두 소모해 [dmg:main:3:elec] 폭발.',
  'psi.volt.cage': '전투 시작 [s:6]간 아군 전원 받는 전기 피해 -[p:0.3], 효과 저항 [pp:0.2].',
  'psi.volt.reverse': '◆ 방전이 적을 치지 않고 대상과 가장 가까운 아군에게 [g:conduct] 3중첩을 건다 (유도 전류의 전도도 적 대신 그 아군에게). 전도된 아군이 행동할 때마다 주변 [t:1] 적에게 중첩당 [dmg:main:0.1:elec]. 바운스 번개 · 단락 · 과부하와 함께 가질 수 없다.',
  'psi.wave.freq': '[g:resonance] 피해 [dmg:main:0.15:elec] → [dmg:main:0.25:elec].',
  'psi.wave.impact': '[g:knock]으로 밀려난 적이 다른 기물과 부딪히면 둘 다 [st:stun:1.2] (부딪힌 쪽이 아군이면 적만).',
  'psi.wave.amp': '충격파가 대상 주변 [t:1] 적 모두를 [g:knock]하고 [g:resonance]을 건다.',
  'psi.wave.standing': '[g:resonance]된 적이 기절 · 빙결되면 공진이 갱신되고, [s:3]간 공진 피해 2배.',
  'psi.wave.field': '[g:reason]이 30 이상이면 [g:red] [p:0.15], [g:knock] 면역.',
  'psi.wave.seismic': '충격파가 [st:stun:1.2:0.35].',
  'psi.wave.attract': '◆ [g:knock]이 [g:pull]로 바뀐다 (대상을 자기 앞 칸으로). [g:resonance] 범위 [t:1] → [t:2].',
  'psi.seed.conc': '[g:poison] 최대 3 → 6중첩.',
  'psi.seed.symb': '[g:poison] 피해의 [p:0.25]만큼 체력 비율이 가장 낮은 아군을 회복.',
  'psi.seed.rot': '[g:poison]된 적이 받는 회복 -[p:0.6].',
  'psi.seed.photo': '[g:reason]이 30 이상이면 초당 자신 최대 체력 [p:0.015] 회복.',
  'psi.seed.burst': '[g:poison]된 적이 쓰러지면 주변 [t:1] 적에게 [dmg:main:0.6:chem]와 중독을 옮긴다.',
  'psi.seed.necro': '[g:poison] 6중첩 이상인 적은 받는 모든 피해 +[p:0.2].',
  'psi.seed.regen': '◆ 포자가 적 대신 체력 비율이 가장 낮은 아군에게 [s:5] [g:regen] (초당 [heal:0.25:main]). 대사는 그대로.',
  'psi.mind.ascend': '[g:charm] 지속 +[s:1], 엘리트에게도 걸린다 (지속 절반).',
  'psi.mind.fate': '[g:bond] 공유 비율 [p:0.25] → [p:0.5].',
  'psi.mind.collective': '[g:bond] 대상 최대 3 → 5명.',
  'psi.mind.dominate': '[g:charm]된 적이 주는 피해 +[p:1].',
  'psi.mind.split': '[g:reason]이 0 미만이면 자신이 받는 피해의 [p:0.3]를 [g:bond]된 적에게 넘긴다.',
  'psi.mind.gaze': '[g:bond]된 적에게 주는 피해 +[p:0.3].',
  'psi.mind.hypno': '◆ 계시가 매혹 대신 [g:bond]된 적 전원을 [st:confuse:2]에 빠뜨린다.',
  'psi.gold.futures': '전투 시작 시 무작위 재료 장비 2개를 [g:tempgear].',
  'psi.gold.insider': '시장 개입 성공 확률 [pp:0.3].',
  'psi.gold.leverage': '[g:tempgear] 효과 2배. 대신 시장 개입이 실패하면 보호막 없이 자신이 최대 체력 [p:0.1] 피해를 받는다.',
  'psi.gold.short': '[g:reason]이 0 미만이면 기본 공격 적중 시 대상에게 [dmg:main:0.2:phys] 추가 피해 (임시 장비 1개당 [pp:0.05]).',
  'psi.gold.vol': '[g:reason] 증감량 ×1.5. 시장 개입 쿨다운 -[s:2].',
  'psi.gold.folio': '[g:tempgear]이 3개면 고이성 · 저이성 효과가 모두 [p:0.5]씩 함께 적용된다.',
  'psi.gold.dividend': '◆ 시장 개입이 성공하면 임시 장비를 자신 대신 아군 3명에게 1개씩 [g:tempgear] (성공 3회까지, 분산 투자는 성공 횟수로 계산).',
  'psi.illusion.troupe': '[g:illusion] 최대 2 → 4기.',
  'psi.illusion.echo': '[g:illusion]이 사라질 때 주변 [t:1] 적에게 [dmg:main:1.2:psy].',
  'psi.illusion.fog': '[g:illusion] 주변 [t:1] 적은 명중 [pp:-0.3].',
  'psi.illusion.solid': '[g:illusion]이 [dmg:main:0.4:psy]로 공격한다.',
  'psi.illusion.dense': '[g:scent]가 최대 3중첩까지 쌓인다.',
  'psi.illusion.disrupt': '[g:illusion]을 공격한 적은 [s:4]간 공격 속도 -[p:0.1] (최대 -[p:0.3]).',
  'psi.illusion.clone': '◆ 환영 대신 자신의 [g:clone] 1기를 부른다 ([s:12], 체력 [p:0.5], 자신 피해의 [p:0.5]로 싸운다). 비술 쿨다운 +[s:4].',
} as Record<string, string>);
Object.assign(GLOSS, {
  reason: { name: '이성', desc: '사이오닉 게이지 (-100 ~ +100). 학파의 고이성 · 저이성 효과가 이성에 비례해 커진다. 0 미만이면 초당 최대 체력 × 0.5% × (−이성/100) 정신 피해 (−50 이하 2배).' },
  frenzy: { name: '광폭', desc: '이성 −100에서 시작. 피아 구분 없이 가장 가까운 대상을 공격 (같은 편에게는 피해 50%), 비술 불가, 주는 피해 +30%. 초당 이성 +5, −60을 넘으면 해제.' },
  cantrip: { name: '비술', desc: '사이오닉 전공의 추가 능동 기술. 전투 스킬과 별개로 쿨다운마다 자동 시전하고, 쓸 때마다 이성이 줄어든다. 공포 · 혼란 · 광폭 중에는 쓰지 않는다.' },
  burn: { name: '연소', desc: '중첩당 초당 물리 피해 (기본 최대 5중첩, 5초). 다시 걸리면 지속 시간 갱신.' },
  conduct: { name: '전도', desc: '대상이 기본 공격 · 전투 스킬을 쓸 때마다 주변 적에게 중첩당 전기 피해 (최대 3중첩, 5초).' },
  regen: { name: '지속 회복', desc: '1초마다 체력 회복.' },
  chill: { name: '오한', desc: '중첩당 공격 · 이동 속도 -8%p, 약한 지속 피해, 빙결 확률 +10%p (기본 최대 4중첩, 5초).' },
  freeze: { name: '빙결', desc: '행동 불가 (기절과 같음). 보스 · 구조물 면역, 엘리트는 지속 시간 절반.' },
  charm: { name: '매혹', desc: '잠시 시전자 편으로 싸우고, 원래 아군에게 공격받는다. 보스 · 영혼 면역, 엘리트는 지속 시간 절반.' },
  confuse: { name: '혼란', desc: '가까운 아무나 공격한다 (같은 편 포함). 스킬 · 비술을 쓰지 않는다. 보스 면역, 엘리트는 지속 시간 절반.' },
  scent: { name: '향취', desc: '중첩당 회피 -15%p, 받는 피해 +8% (4초).' },
  bond: { name: '결속', desc: '받는 피해 +10%. 받은 피해의 일부를 다른 결속 대상이 나눠 받는다.' },
  resonance: { name: '공진', desc: '피격될 때마다 주변 적에게 전기 피해 (0.5초에 1회).' },
  knock: { name: '밀쳐내기', desc: '시전자 반대 방향으로 1칸 밀려난다 (빈 칸일 때). 보스 · 고정 기물 면역.' },
  pull: { name: '끌어당기기', desc: '시전자 바로 앞 칸으로 끌려온다 (빈 칸일 때). 보스 · 고정 기물 면역.' },
  illusion: { name: '환영', desc: '환조 사이오닉이 부르는 제자리 소환물. 주변 1칸 적의 공격을 끈다 (도발). 시간이 다 되거나 시전자가 쓰러지면 사라진다.' },
  taunt: { name: '도발', desc: '주변 1칸 적은 이 기물을 우선 공격한다 (광폭 · 혼란 제외).' },
  clone: { name: '분신', desc: '자신의 능력치를 물려받아 함께 싸우는 소환물 (체력 · 피해 50%, 12초). 스킬 · 비술은 쓰지 않는다.' },
  tempgear: { name: '임시 장착', desc: '이번 전투 동안만 장착되는 장비 (장비 칸을 쓰지 않고 전투 후 사라진다).' },
  spawn: { name: '증원', desc: '전장에 아군 개체를 추가로 불러냄.' },
  lifesteal: { name: '흡혈', desc: '준 피해의 일부만큼 회복.' },
  root: { name: '속박', desc: '이동할 수 없다 (공격 · 스킬은 쓴다).' },
  stealth: { name: '은신', desc: '대상으로 지정되지 않는다 (광역 피해는 받는다).' },
  antiheal: { name: '회복 감소', desc: '받는 회복량이 줄어든다.' },
  rampage: { name: '광폭', desc: '전장이 일으킨 광폭. 피아 구분 없이 가장 가까운 대상을 공격 (같은 편에게는 피해 50%), 주는 피해 +30%. 이성과 무관하게 지속 시간이 끝나면 풀린다.' },
  obstacle: { name: '장애물', desc: '칸을 막는 전장 구조물. 공격하지 않고 대상으로 지정되지 않으며, 승패 판정에 세지 않는다. 일정 시간 뒤 사라진다.' },
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
  warlord: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:strike:1.5:phys]']] },
    trait: '약탈 명령: 근접한 적이 있으면 [s:8]마다 모든 아군 [s:4] 동안 피해 +[p:0.2] (전투 스킬과 별도, 기절 · 공포 중에는 미룸).',
  },
  varga: {
    skill: { tgt: '현재 대상', range: 'unit', area: { k: 'one' }, rows: [['피해', '[dmg:strike:2.2:phys]']] },
    trait: '함장의 호령: 근접한 적이 있으면 [s:9]마다 모든 아군 [s:5] 동안 공격 속도 +[p:0.3], 피해 +[p:0.3] (전투 스킬과 별도, 기절 · 공포 중에는 미룸).',
  },
  goliath: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 2 }, rows: [['피해', '[dmg:tech:1.2:elec]'], ['기절', '[st:stun:1:0.5]']] },
    trait: '[s:15]마다 정찰 드론 2기 [g:spawn].',
  },
  nyx: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 3 }, rows: [['피해', '[dmg:tech:1:psy]'], ['공포', '[st:fear:1.5:0.4]']] } },
  sw_queen: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 3 }, rows: [['피해', '[dmg:tech:0.8:psy]'], ['공포', '[st:fear:1:0.3]']] },
    trait: '사이오닉 지배: [s:8]마다 모든 군체 [s:5] 동안 공격 속도 +[p:0.3], 피해 +[p:0.25] (전투 스킬과 별도, 기절 · 공포 중에는 미룸).',
  },
  sw_harvester: {
    skill: { tgt: '현재 대상', range: 'unit', area: { k: 'one' }, rows: [['피해', '[dmg:strike:2.5:phys]'], ['회복', '자신 최대 체력의 [p:0.04]']] },
    trait: '[s:15]마다 포자 살점 2기 [g:spawn].',
  },
  cr_knight: { skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:strike:1.6:phys]'], ['회복', '자신 최대 체력의 [p:0.06]']] } },
  cr_count: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 2 }, rows: [['피해', '[dmg:strike:1.4:phys]']] },
    trait: '혈연 축제: 주변 [t:2]에 적이 있으면 [s:9]마다 자신 최대 체력 [p:0.06] 회복 + 모든 아군 [s:5] 동안 피해 +[p:0.25] (전투 스킬과 별도, 기절 · 공포 중에는 미룸).',
  },
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
  // ── 신규 전장
  cf_dog: { trait: '기본 공격 적중 시 [p:0.4] 확률로 [st:bleed:3]: 초당 [dmg:strike:0.2:phys].' },
  cf_purifier: { trait: '기본 공격 적중 시 [st:antiheal:4]: 받는 회복 -[p:0.3].' },
  cf_chair: { trait: '반상회 소집: [s:8]마다 광대 1기 [st:stealth:3] + [s:3] 동안 피해 +[p:0.5] (기절 · 공포 중에는 미룸).' },
  cf_model: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 1 }, rows: [['피해', '[dmg:tech:1:chem] (의태 해제 후 [dmg:tech:1.5:chem])'], ['침식', '[st:corrode:3:0.5] 방어도 -[p:0.15]']] },
    trait: '체력 [p:0.5]까지 받는 피해 -[p:0.3]. 그 아래로 떨어지면 의태 해제: 공격 속도 +[p:0.4], 산성 분사 강화.',
  },
  cf_inquisitor: { skill: { tgt: '현재 대상 (없으면 가장 먼 적)', range: null, area: { k: 'line' }, rows: [['피해', '[dmg:tech:1.5:holy]'], ['회복 감소', '[st:antiheal:6] 받는 회복 -[p:0.5]']] } },
  lv_floater: { trait: '기본 공격 적중 시 [p:0.3] 확률로 [st:poison:3]: 초당 [dmg:shoot:0.2:chem]. 쓰러지면 [s:1] 뒤 주변 [t:1] 산패 폭발.' },
  lv_spores: { trait: '쓰러지면 [s:1] 뒤 주변 [t:1] 산패 폭발 (양쪽 모두 최대 체력 [p:0.1] 화학 피해).' },
  lv_raptor: { trait: '산패 폭발 피해 2배.' },
  lv_alpha: { trait: '포식: [s:6]마다 주변 [t:3] 부유체를 삼켜 최대 체력 [p:0.15] 회복, [s:3] 뒤 체내 폭발 (자신 포함 주변 [t:1], 최대 체력 [p:0.1] · 프리버드 2배).' },
  lv_mother: { trait: '[s:14]마다 부유 포자 무리 2기 [g:spawn]. 쓰러지면 [s:2] 뒤 주변 [t:3]에 최대 체력 [p:0.25] 폭발.' },
  lv_king: { skill: { tgt: '가장 먼 적 (도약)', range: null, area: { k: 'around', r: 1 }, rows: [['피해', '[dmg:strike:1.8:phys]'], ['기절', '[st:stun:1]']] } },
  rd_sub: { trait: '기본 공격 적중 시 [s:4] 미납: 받는 피해 +[p:0.15].' },
  rd_stream: { trait: '공격하지 않는다. [s:2]마다 [t:4] 안 가장 가까운 적 생중계 ([s:2.5]): 받는 피해 +[p:0.15].' },
  rd_critical: { trait: '체력 [p:0.5] 이하에서 한 번 [s:8] 동안 [g:rampage] + 받는 피해 -[p:0.3].' },
  rd_tower: { trait: '펌웨어 송출: [s:10]마다 같은 편 2기 [s:4] [g:rampage] + 기계 적 [st:shock:2].' },
  rd_repo: { skill: { tgt: '장비가 가장 많은 적', range: null, area: { k: 'one' }, rows: [['피해', '[dmg:shoot:1.2:phys]'], ['원격 잠금', '[s:6] 동안 피해 -[p:0.25] · 공격 속도 -[p:0.2]']] } },
  kr_builder: { trait: '[s:10]마다 적 쪽 빈칸에 묘석 [g:obstacle] ([s:20]).' },
  kr_ferryman: { trait: '기본 공격 적중 시 [st:root:1.5:0.5].' },
  kr_bearer: { trait: '깃발: 주변 [t:2] 망령 피해 +[p:0.2]. 쓰러지면 가장 가까운 망령이 깃발을 이어받는다 (1회).' },
  kr_general: { trait: '재집결: [s:9]마다 쓰러진 망령 2기를 체력 [p:0.5]로 다시 세운다. 서사의 망령 피해 +[p:0.3].' },
  kr_choir: {
    skill: { tgt: '모든 적', range: null, area: { k: 'all' }, rows: [['피해', '[dmg:tech:0.7:psy]'], ['공포', '[st:fear:1:0.6]']] },
    trait: '같은 편 망령이 쓰러질 때마다 최대 체력 [p:0.03] 회복.',
  },
  kr_echo: { trait: '쓰러진 아군의 최대 체력 [p:0.4] · 위력 [p:0.6]을 물려받는다. 스킬 없이 기본 공격만.' },
  kr_stone: { trait: '[g:obstacle]. [s:20] 뒤 무너진다.' },
  ol_tender: { trait: '[s:8]마다 주변 [t:2] 아군에게 최대 체력 [p:0.03] + 충전 1당 [p:0.015] 보호막.' },
  ol_manager: { trait: '[s:8]마다 주변 [t:2] 아군 충전 +3. 방전 피해 면역.' },
  ol_cloud: {
    skill: { tgt: '자신', range: 0, area: { k: 'self', r: 2 }, rows: [['피해', '[dmg:tech:1.1:elec]'], ['기절', '[st:stun:1:0.5]']] },
    trait: '충전 최대 16. 가득 차면 과부하: 모든 적에게 [dmg:tech:2:elec].',
  },
  ol_conduit: { trait: '살아 있는 동안 모든 아군 공격 속도 +[p:0.2]. [s:4]마다 충전이 가장 높은 아군 충전 +2.' },
  cw_reclaim: { trait: '기계 적을 먼저 노린다. 기본 공격 적중 시 [st:root:1:0.5].' },
  cw_dropper: { trait: '공격하지 않는다. [s:6]마다 가장 가까운 적 곁에 반려 돌 [g:obstacle] 투하 (주변 [t:1] 최대 체력 [p:0.06] 피해).' },
  cw_sub: { trait: '작업 할당: [s:8]마다 모든 유닉스 [s:4] 동안 공격 속도 +[p:0.3] (기절 · 공포 중에는 미룸).' },
  cw_ship: { skill: { tgt: '기계 적 (없으면 체력 비율 최저)', range: null, area: { k: 'one' }, rows: [['끌어당기기', '[g:pull]'], ['속박', '[st:root:3]'], ['취약', '[s:3] 받는 피해 +[p:0.3]']] } },
  cw_kernel: { trait: '체력 [p:0.25] 구간마다 [s:4] 무적 + 반려 돌 4개 [g:obstacle].' },
  cw_rock: { trait: '[g:obstacle]. [s:20] 뒤 치워진다.' },
  hy_teller: { trait: '전투 시작 시 무작위 아군 장비 1개의 효과를 빌려 쓴다 ([g:tempgear]).' },
  hy_exchange: { trait: '아군 보유 크레딧 10당 피해 +[p:0.02].' },
  hy_appraiser: { skill: { tgt: '장비가 가장 많은 적', range: null, area: { k: 'one' }, rows: [['피해', '[dmg:shoot:1.2:phys]'], ['감정 중', '[s:4] 동안 피해 -[p:0.3] · 공격 속도 -[p:0.3]']] } },
  hy_door: { trait: '[s:5]마다 자기 보호막 +1겹, [s:12]마다 모든 아군 보호막 +2겹 (처음 겹 수까지).' },
  hy_zodiac: { trait: '이자: [s:5]마다 자기 피해 ×1.06 (복리). 전투 시작 시 아군 장비 2개를 빌려 쓴다 ([g:tempgear]).' },
  bs_vapor: { trait: '쓰러질 때 주변 [t:1] 적 [st:antiheal:3]: 받는 회복 -[p:0.5].' },
  bs_knight: { trait: '골갑: 화학 외 받는 피해 -[p:0.3].' },
  bs_tomb: { trait: '살아 있는 동안 생체 적이 2번까지 되살아난다. [s:15]마다 포자 살점 2기 [g:spawn].' },
  bs_signal: {
    skill: { tgt: '무작위 적', range: null, area: { k: 'one' }, rows: [['피해', '[dmg:tech:1:psy]'], ['공포', '[st:fear:2]']] },
    trait: '체력 [p:0.5]에서 한 번 [st:stealth:4].',
  },
};
