// 능력 설명 (통일 형식): 전투 기술은 구조화된 정보 + 효과 행, 특성 · 증강은 토큰 문장.
// 토큰 (ui/abil.ts 가 해석):
//   [dmg:pow:계수:속성(:타수)]  위력 × 계수 기본 피해      [dmg+:pow:계수]  피해 증가량
//   [heal:계수] [heal+:계수] [shield:계수]  기술 위력 기반 회복 · 보호막
//   [st:키:초(:확률)]  상태 이상 (용어 설명에 추가)        [g:키]  용어 (설명에 추가)
//   [t:칸] [s:초] [p:비율] [pp:비율포인트]
// 위력 종류: shoot · strike · tech (지휘관은 자동으로 전술 위력)

/** 대상 범위: 단일 / 대상 주변 r칸 / 자신 주변 r칸 / 직선 / 전체 */
export type Area = { k: 'one' } | { k: 'around'; r: number } | { k: 'self'; r: number } | { k: 'line' } | { k: 'all' };
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
  red: { name: '피해 감소', desc: '받는 피해 감소.' },
  camp: { name: '임시 장비', desc: '캠핑 러버: 전투마다 장비 칸을 쓰지 않는 무작위 장비를 받음.' },
  turret: { name: '포탑', desc: '엔지니어 시너지로 전투 시작 시 배치되는 포탑.' },
  tac: { name: '전술 위력', desc: '지휘관 전용 위력. 출전 아군 구성으로 정해짐. 지휘관의 스킬은 사격 · 타격 · 기술 위력 대신 이 값을 씀.' },
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

export const ABIL: Record<string, AbilText> = {
  yelena: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy]`],
        ['망각', `[g:forget] 쿨다운 +[s:${p.forget}]`],
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
      hoodie: '[g:camp] +1. 정신력 +5, 기동력 +3.',
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
      fur: '[g:camp] +1. 생명력 +5, 방어력 +3.',
    },
  },
  winter: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['피해 감소', `[g:red] -[p:${p.red}] ([s:${p.dur}])`],
        ...(p.splash ? [['주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'] as [string, string]] : []),
      ],
    }),
    trait: '치료한 아군 최대 체력 +[p:0.02] (전투 동안, 대상당 최대 5회).',
    augs: {
      serum: '임상 시험 혈청 회복 [heal+:1.8].',
      cohort: '대상 주변 [t:1] 아군에게도 [p:0.5] 효과.',
      sterile: '[g:red] [pp:0.15]. 지속 +[s:2].',
      tenure: '정신력 +8, 생명력 +4.',
      paper: '쿨다운 감소 속도 [pp:0.35].',
      'sp.vaccine': '임상 시험 혈청 사용 시 모든 아군 [heal:0.88] (기본 회복의 [p:0.4]).',
      'sp.antidote': '치료한 아군에게 [g:cleanse].',
      'sp.pathogen': '기본 공격 적중 시 [st:poison:4]: 초당 [dmg:tech:0.3:chem].',
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
      refit: '[g:pen] [pp:0.4]. 화력 지원 [g:crit] 확률 [pp:0.3].',
      twin: '화력 지원 2회 (두 번째도 [p:1] 피해).',
      carpet: '화력 지원 범위: 대상 주변 [t:1]. 피해 [dmg+:shoot:0.3:phys].',
      travelogue: '모든 메이저 스탯 +4.',
      'sp.shade': '[g:rewind].',
      'sp.mount': '[g:immobile]. 기본 공격 피해 ×1.6, 사거리 +[t:2].',
      'sp.order': '기본 공격을 하지 않음. [g:tac] +6.',
    },
  },
};

/** 증강 id(owner.key) → 통일 문장 */
export function augAbilText(id: string): string | null {
  const i = id.indexOf('.');
  if (i < 0) return null;
  return ABIL[id.slice(0, i)]?.augs?.[id.slice(i + 1)] ?? null;
}
