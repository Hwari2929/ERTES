// 능력 설명 (통일 형식): 전투 기술은 구조화된 정보 + 효과 행, 특성 · 증강은 토큰 문장.
// 토큰 (ui/abil.ts 가 해석):
//   [dmg:pow:계수:속성(:타수)]  위력 × 계수 기본 피해      [dmg+:pow:계수]  피해 증가량
//   [heal:계수] [heal+:계수] [shield:계수]  기술 위력 기반 회복 · 보호막
//   [st:키:초(:확률)]  상태 이상 (용어 설명에 추가)        [g:키]  용어 (설명에 추가)
//   [t:칸] [s:초] [p:비율] [pp:비율포인트]
// 위력 종류: shoot · strike · tech (지휘관은 자동으로 전술 위력)

import { CFG } from '../config';
import { PSI } from './psinum';
import { controlNames } from '../engine/combat';
import { ABIL_A, GLOSS_A } from './abil/a';
import { ABIL_B, GLOSS_B } from './abil/b';
import { ABIL_C, GLOSS_C } from './abil/c';
import { ABIL_F, GLOSS_F } from './abil/f';
import { ABIL_G, GLOSS_G } from './abil/g';

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
  /** 상세 보기 문장 (docs/ABILITY_TEXT.md 문형, 줄마다 한 문장, 토큰 [pw] · [el] · [t] · [s] · [p] · [pp] · [g]) */
  text?: string;
}
export interface AbilText {
  /** 상세 보기 꺼짐의 한 줄 설명 (docs/ABILITY_TEXT.md 1절). 없으면 brief.ts BRIEF */
  brief?: { skill?: string; trait?: string };
  skill?: (p: Record<string, number>) => SkillInfo;
  trait?: string;
  ace?: (k: number) => string;
  /** 최고의 친구 소환물의 기술 (소환물 이름 → 정보). p = 주인의 스킬 파라미터, 위력 · 피해 수치는 소환물 기준으로 계산한다 (기물 상세의 [소환물] 칸) */
  summon?: Record<string, (p: Record<string, number>) => SkillInfo>;
  /** 증강 id(접두 없이) → 토큰 문장 */
  augs?: Record<string, string>;
}

/** 상태 효과 설명 문장 (docs/ABILITY_TEXT.md 2.3): 상세 문장에 [fx:키:지속(:추가 인자)] 를 쓰면 그 자리는 [키워드]로 보이고,
 *  설명 문장은 능력 설명 끝에 한 번만 자동으로 붙는다. 지속 · 계수만 능력마다 다르다.
 *  a = [지속 초, …] — 지속 피해: [지속, 위력, 계수(, 최대 중첩)] */
const fxEnd = (d: string, max?: string) => (max ? `[s:${d}] 지속되고, 최대 ${max}회 중첩됩니다.` : `[s:${d}] 지속됩니다.`);
const fxDot = (key: string, elem: string) => (a: string[]) => `[g:${key}] 효과가 부여된 적은 ${a[3] ? '중첩당 ' : ''}매초 [pw:${a[1]}:${a[2]}:${elem}] 피해를 받으며, ${fxEnd(a[0], a[3])}`;
export const STATUS_FX: Record<string, (a: string[]) => string> = {
  stun: (a) => `[g:stun] 효과가 부여된 적은 이동 · 공격 · 스킬 사용이 불가능하며, ${fxEnd(a[0])}`,
  freeze: (a) => `[g:freeze] 효과가 부여된 적은 이동 · 공격 · 스킬 사용이 불가능하며, ${fxEnd(a[0])}`,
  fear: (a) => `[g:fear] 효과가 부여된 적은 공격과 스킬 사용이 불가능하며, ${fxEnd(a[0])}`,
  shock: (a) => `[g:shock] 효과가 부여된 적은 스킬 쿨다운이 감소하지 않으며, ${fxEnd(a[0])}`,
  root: (a) => `[g:root] 효과가 부여된 적은 이동할 수 없으며, ${fxEnd(a[0])}`,
  confuse: (a) => `[g:confuse] 효과가 부여된 적은 같은 편을 포함해 가장 가까운 대상을 공격하고 스킬을 쓸 수 없으며, ${fxEnd(a[0])}`,
  charm: (a) => `[g:charm] 효과가 부여된 적은 시전자 편으로 싸우며, ${fxEnd(a[0])}`,
  suppress: (a) => `[g:suppress] 효과가 부여된 적은 다음 공격의 피해가 1이 되며, ${fxEnd(a[0])}`,
  taunt: (a) => `[g:taunt] 효과가 부여된 적은 시전자만 공격하며, ${fxEnd(a[0])}`,
  bleed: fxDot('bleed', 'phys'),
  poison: fxDot('poison', 'chem'),
  burn: fxDot('burn', 'phys'),
};

/** 용어 설명: 문장 끝에 --- 아래로 모아 보여준다 */
export const GLOSS: Record<string, { name: string; desc: string }> = {
  stun: { name: '기절', desc: '이동 · 공격 · 스킬 사용 불가. 보스는 지속 시간 절반. 제어 효과: 재장전이 멈추고, 재장전 중이었으면 처음부터 다시.' },
  fear: { name: '공포', desc: '공격 · 스킬 사용 불가. 보스는 지속 시간 절반. 제어 효과: 재장전이 멈추고, 재장전 중이었으면 처음부터 다시.' },
  shock: { name: '감전', desc: '스킬 쿨다운이 줄지 않음. 제어 효과: 재장전이 멈추고, 재장전 중이었으면 처음부터 다시.' },
  slow: { name: '둔화', desc: '공격 속도 · 이동 속도 감소.' },
  corrode: { name: '침식', desc: '방어도 감소.' },
  vuln: { name: '취약', desc: '받는 피해 증가.' },
  suppress: { name: '제압', desc: '다음 공격(기본 공격 · 스킬)의 피해가 1이 되고 풀린다. 지속 피해 · 부가 피해는 그대로.' },
  gladiator: { name: '투사', desc: '테무르가 피해를 받을 때마다 쌓는 중첩 (최대 100중첩). 중첩마다 테무르가 가하는 타격 피해가 늘어난다.' },
  summary: { name: '즉결', desc: '지속되는 동안 아군이 대상에게 가한 피해의 일부를 기록하고, 끝날 때 기록에 비례한 고정 피해를 가한다.' },
  ambush: { name: '기습', desc: '침투자가 전투를 시작하며 적 후방으로 순간이동한 직후의 상태. 잠시 가하는 피해가 크게 늘어난다.' },
  focus: { name: '집중', desc: '고양이 형태 대신 걸리는 상태. 능력치 보너스 없이, 고양이 형태일 때 발동하는 효과만 발동한다.' },
  verdict: { name: '판결', desc: '지속되는 동안 아군이 대상에게 준 피해의 일부를 기록하고, 끝날 때 기록에 비례한 고정 피해를 준다.' },
  bleed: { name: '출혈', desc: '초당 물리 피해.' },
  poison: { name: '중독', desc: '초당 화학 피해.' },
  pen: { name: '방어도 관통', desc: '대상 방어도를 비율만큼 무시.' },
  forget: { name: '망각', desc: '대상 스킬 쿨다운 증가.' },
  red: { name: '피해량 경감', desc: '받는 피해를 비율만큼 줄인다 (이로운 효과).' },
  weak: { name: '피해량 감소', desc: '대상이 가하는 피해를 비율만큼 줄인다 (해로운 효과).' },
  camp: { name: '임시 장비', desc: '캠핑 러버: 전투마다 장비 칸을 쓰지 않는 무작위 장비를 받음.' },
  bounce: { name: '바운스', desc: '피해가 맞은 적에서 정해진 칸 안의 다른 적에게 차례로 옮겨 가며 다시 맞힌다. 바로 직전에 맞은 적에게는 다시 가지 않는다.' },
  turret: { name: '포탑', desc: '엔지니어 시너지로 전투 시작 시 배치되는 감시 포탑 (기계 · 구조물). 엔지니어 단계에서 고른 포탑 장비가 모든 포탑에 공통으로 붙는다.' },
  tac: { name: '전술 위력', desc: `지휘관 전용 위력 (사격 · 타격 · 기술 위력과 같은 단위, 출전 4명 · 지휘관 1명 기준 ${CFG.tacBase}). 출전 기물 1명당 +${CFG.tacPerUnit}, 지휘관 1명 추가당 +${CFG.tacPerCmd}, 지휘관 정신력 1당 +${CFG.tacPerMnd}. 지휘관의 스킬은 사격 · 타격 · 기술 위력 대신 이 값을 씀.` },
  combo: { name: '콤보', desc: '정해진 횟수째 공격이 피니쉬로 강화됨.' },
  finish: { name: '피니쉬', desc: `콤보 마지막 공격. 기본 피해 ×${CFG.finishMult}.` },
  mag: { name: '탄창', desc: `다 쓰면 재장전하는 동안 공격 · 스킬 사용 불가 (스킬 쿨다운은 계속 돈다). 재장전 중 제어 효과(${controlNames()})를 받으면 재장전이 처음부터 다시.` },
  psy: { name: '정신 피해', desc: '정신 속성 피해. 사이오닉 이성 · 정신 저항의 영향을 받음.' },
  crit: { name: '치명타', desc: '사격 · 타격은 확률로 치명타 피해 배율만큼 피해 증가. 기술은 별도 허용 효과가 필요하다. 전기 · 화학 · 정신 · 신성 피해는 허용 효과가 있어도 치명타 불가. 대신 아군 기물이 주는 이 4속성 피해는 계수 ×1.25.' },
  rewind: { name: '되감기', desc: '전투당 1회, 쓰러질 피해를 받으면 체력 50%로 복귀.' },
  cleanse: { name: '정화', desc: '해로운 효과를 모두 제거.' },
  immobile: { name: '고정', desc: '이동하지 않음.' },
};

const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');

/** 다단: 'N회 가합니다' + 2번째부터 배율 */
const hitsDetail = (hits: number, second: number) => (hits > 1 ? ` 피해를 ${hits}회 가합니다.${second < 1 ? `\n2번째부터는 피해가 [p:${second}]로 감소합니다.` : ''}` : ' 피해를 가합니다.');

const ABIL_PILOT: Record<string, AbilText> = {
  yelena: {
    brief: { skill: '대상에게 정신 피해를 주고, 스킬을 늦추고 약하게 만들며, 가끔 [공포]에 빠뜨립니다.', trait: '기본 공격이 정신 피해를 주고, 정신 피해를 받은 적의 스킬을 늦춥니다.' },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy]`],
        ['망각', `[g:forget] 쿨다운 +[s:${p.forget}]`],
        ['약화', `[g:weak] [p:${p.weak}] ([s:${p.weakDur}])`],
        ['공포', `[st:fear:${p.fear}:${p.fearChance}]`],
        ...(p.vuln ? [['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`] as [string, string]] : []),
      ],
      text: [
        p.radius ? `[rng] 이내의 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:tech:${p.mult}:psy] 피해를 가합니다.` : `[rng] 이내의 적에게 [pw:tech:${p.mult}:psy] 피해를 가합니다.`,
        `공격이 적중하면 대상의 스킬 쿨다운을 [s:${p.forget}] 증가시키고, [s:${p.weakDur}]간 대상이 가하는 피해를 [pv:${p.weak}] 감소시킵니다.`,
        ...(p.vuln ? [`공격이 적중하면 [s:4]간 대상이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`] : []),
        `공격이 적중하면 대상에게 [p:${p.fearChance}] 기본 확률로 [fx:fear:${p.fear}] 효과를 부여합니다.`,
      ].join('\n'),
    }),
    trait: '기본 공격이 [el:psy] 피해를 가합니다.\n[el:psy] 피해를 가하면 대상의 스킬 쿨다운을 [s:1] 증가시킵니다.\n이 효과는 대상마다 [s:1]에 1회 발동합니다.',
  },
  gebek: {
    brief: { skill: '대상 주변의 적들에게 피해를 여러 번 가합니다.', trait: '기본 공격이 가끔 적을 [제압]해 다음 공격을 무력화합니다.' },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...(p.corrode ? [['침식', `[st:corrode:5] 방어도 -[p:${p.corrode}]`] as [string, string]] : []),
      ],
      text: [
        `[rng] 이내의 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:shoot:${p.mult}:phys]${hitsDetail(p.hits, p.second)}`,
        ...(p.corrode ? [`공격이 적중하면 [s:5]간 대상의 방어도를 [p:${p.corrode}] 감소시킵니다.`] : []),
      ].join('\n'),
    }),
    trait: '기본 공격이 적중하면 대상에게 [p:0.25] 고정 확률로 [fx:suppress:10] 효과를 부여합니다.',
    augs: {
      'mj.belt': '헤비 버니 화망의 피해 횟수가 2회 증가합니다.',
      'mj.wide': '헤비 버니 화망의 범위가 대상으로부터 [t:2] 이내로 넓어집니다.',
      'mj.ap': '헤비 버니 화망이 적중하면 [s:5]간 대상의 방어도를 [p:0.3] 감소시킵니다.',
      'mj.roar': '괴수의 [g:suppress] 고정 확률이 [pv:0.15] 증가합니다.',
      'mj.pin': '[g:suppress] 효과를 부여하면 [s:4]간 대상이 받는 피해를 [pv:0.15] 증가시킵니다.',
      'mj.drum': '[g:mag]이 60발로 증가하고, 재장전 시간이 [s:3.5]로 감소합니다.',
      'mj.spin': '기본 공격을 할 때마다 공격 속도가 [pv:0.02] 증가하며, 최대 15회 중첩됩니다. 재장전을 시작하면 초기화됩니다.',
      'mj.burp': '재장전을 시작하면 자신으로부터 [t:2] 이내의 적들에게 [pw:shoot:2:chem] 피해를 가합니다. 무한 탄띠가 있으면 탄창 1개 분량을 쏠 때마다 발동합니다.',
      'mj.yuri': '헤비 버니 풀오토가 끝나면 1초 동안 그때의 대상으로부터 [t:2] 이내의 무작위 적에게 [pw:shoot:0.6:phys] 피해를 10회 가합니다. 이 피해가 적중하면 대상에게 [p:0.5] 고정 확률로 "특성 - 괴수"의 [g:suppress] 효과를 부여합니다.',
      'mj.dad': '쓰러질 피해를 받으면 체력 [p:0.3]으로 버티고, [s:3]간 받는 피해가 [pv:0.5] 감소합니다. 전투당 1회.',
      'mj.eng': '아군 [g:turret]의 기본 공격이 적중하면 대상에게 [p:0.2] 고정 확률로 "특성 - 괴수"의 [g:suppress] 효과를 부여합니다.',
      'mj.legeno': '헤비 버니 화망이 적중할 때마다 궁극기 게이지가 [p:0.004] 차오르며, 시전마다 최대 [p:0.1]까지 차오릅니다.',
      'mj.beast': '기본 공격이 적중하면 대상으로부터 [t:1] 이내의 다른 적들에게 [pw:shoot:0.25:phys] 피해를 가합니다. 이 피해가 적중하면 대상에게 [p:0.25] 고정 확률로 "특성 - 괴수"의 [g:suppress] 효과를 부여합니다.',
      'mj.endless': '재장전하지 않습니다. 기본 공격 10회마다 헤비 버니 화망의 쿨다운이 [s:1] 감소합니다.',
    },
  },
  temur: {
    brief: { skill: '주변 적들에게 방어도를 일부 무시하는 피해를 주고 잠시 [기절]시킵니다.', trait: '효과 저항이 매우 높고, 피해를 받을수록 타격 피해가 커집니다.' },
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys]`],
        ['관통', `[g:pen] [p:${p.pen}]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
      text: [
        `자신으로부터 [t:${p.radius || 1}] 이내의 적들에게 [pw:strike:${p.mult}:phys] 피해를 가합니다.`,
        `이 공격은 방어도 관통이 [p:${p.pen}] 적용됩니다.`,
        `공격이 적중하면 대상에게 반드시 [fx:stun:${p.stun}] 효과를 부여합니다.`,
      ].join('\n'),
    }),
    trait: '효과 저항이 [pv:1] 증가합니다.\n피해를 받을 때마다 [g:gladiator]가 1중첩 쌓이며, 최대 100회 중첩됩니다.\n경기장의 왕 지속 중에는 [g:gladiator]가 2중첩씩 쌓입니다.\n[g:gladiator] 1중첩당 가하는 타격 피해가 [p:0.02] 증가합니다.',
    augs: {
      'mj.whirl': '경기장의 검의 범위가 자신으로부터 [t:2] 이내로 넓어지고, 피해가 [p:0.15] 감소합니다.',
      'mj.stomp': '경기장의 검의 [g:stun] 지속 시간이 [s:0.6] 증가합니다.',
      'mj.warm': '전투가 시작되면 [g:gladiator]가 15중첩 쌓입니다.',
      'mj.blood': '전투 스킬과 궁극기로 가한 피해의 [p:0.12]만큼 체력을 회복합니다.',
      'mj.cleave': '[g:finish]가 적중하면 대상으로부터 [t:1] 이내의 다른 적들에게 [g:finish] 피해의 [p:0.5]를 [el:phys] 피해로 가합니다.',
      'mj.roar': '경기장의 검을 쓰면 범위 안의 적들에게 [fx:taunt:1.5] 효과를 부여하고, [s:3]간 자신이 받는 피해를 [pv:0.15] 감소시킵니다.',
      'mj.hide': '받는 피해가 [pv:0.1] 감소합니다. [g:gladiator]가 50중첩 이상이면 받는 피해가 [p:0.1] 더 감소합니다.',
      'mj.meal': '최대 체력 [pp:0.15], 받는 회복량 [pp:0.2].',
      'mj.leap': '전투가 시작되면 가장 가까운 적의 곁으로 순간이동합니다. 경기장의 검을 쓸 때 주변에 적이 없으면 [t:4] 이내의 가장 가까운 적의 곁으로 순간이동해 씁니다.',
      'mj.pay': '전투가 시작될 때 보유 크레딧 10당 타격 피해가 [pv:0.03] 증가하며, 최대 [pv:0.3]까지 증가합니다.',
      'mj.quick': '검투사 대검의 [g:combo]가 2단으로 감소해 2번째 공격마다 [g:finish]가 나갑니다.',
      'mj.grit': '피해를 받을 때 [g:gladiator]가 1중첩 더 쌓입니다.',
      'mj.champ': '쓰러질 피해를 받으면 최대 체력의 [p:0.3]으로 버티고, [s:2]간 피해를 받지 않으며, 궁극기 게이지가 가득 찹니다. 전투당 1회.',
      'mj.colosseum': '지속 피해가 아닌 피해를 받으면 자신으로부터 [t:1] 이내의 적들에게 [pw:strike:0.6:phys] 피해를 가합니다. 이 효과는 [s:0.5]에 1회 발동합니다. [g:gladiator] 1중첩당 받는 피해가 [p:0.002] 감소하며, 최대 [p:0.2]까지 감소합니다.',
    },
  },
  winter: {
    brief: { skill: '체력 비율이 가장 낮은 아군을 크게 치료하고 잠시 받는 피해를 감소시킵니다.', trait: '치료한 아군의 최대 체력이 조금씩 증가합니다.' },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
        ...(p.splash ? [['주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'] as [string, string]] : []),
        ...(p.vaccine ? [['광역 백신', `모든 아군 [heal:${Math.round(p.heal * p.vaccine * 1000) / 1000}] (혈청 회복의 [p:${p.vaccine}])`] as [string, string]] : []),
      ],
      text: [
        `체력 비율이 가장 낮은 아군을 지정해 [pw:tech:${p.heal}]만큼 회복시킵니다.`,
        `[s:${p.dur}]간 대상이 받는 피해를 [pv:${p.red}] 감소시킵니다.`,
        ...(p.splash ? ['대상으로부터 [t:1] 이내의 다른 아군들에게도 [p:0.5]의 효과를 줍니다.'] : []),
        ...(p.vaccine ? [`모든 아군을 혈청 회복량의 [p:${p.vaccine}]만큼 회복시킵니다.`] : []),
      ].join('\n'),
    }),
    trait: '아군을 회복시키면 전투 동안 그 아군의 최대 체력을 [pv:0.02] 증가시킵니다.\n이 효과는 대상마다 최대 5회 발동합니다.',
    augs: {
      'sp.vaccine': '임상 시험 혈청을 쓰면 모든 아군을 혈청 회복량의 [p:0.3]만큼 회복시킵니다. 임상 시험 혈청의 쿨다운이 [s:1.5] 증가합니다.',
      'sp.antidote': '아군을 회복시키면 그 아군의 해로운 효과를 모두 제거합니다.',
      'sp.pathogen': '기본 공격이 적중하면 대상에게 반드시 [fx:poison:4:tech:0.3] 효과를 부여합니다.',
      'sp.tenure': '생명과학 교수의 대상당 발동 횟수가 10회로 증가합니다.',
      'sp.phase2': '임상 시험 혈청의 받는 피해 감소량이 [pv:0.25]로, 지속 시간이 [s:6]으로 증가합니다.',
      'sp.overheal': '아군을 회복시킬 때 넘친 회복량의 [p:0.5]만큼 보호막을 부여합니다.',
      'sp.trial': '임상 시험 혈청을 아군 대신 현재 대상 적에게 써서 [pw:tech:1.8:chem] 피해를 가합니다. 이 공격은 명중 확률이 [pv:1] 상승 적용됩니다. 혈청 지속 시간 동안 대상이 받는 피해를 혈청의 피해 감소 수치만큼 증가시킵니다. 이어서 체력 비율이 가장 낮은 아군을 혈청 회복량의 [p:0.4]만큼 회복시킵니다.',
      'sp.lab': '전투가 시작되면 보안위원회 · 의무관 아군 1명당 기술 위력이 8 증가합니다.',
      'mj.clean': '전투가 시작되면 전투 동안 아군 전원의 효과 저항이 [pv:0.2] 증가합니다.',
      'mj.data': '전투 스킬을 쓸 때마다 기술 위력이 [pv:0.03] 증가하며, 최대 10회 중첩됩니다.',
      'mj.triage': '체력 비율이 [p:0.4] 이하인 아군을 회복시킬 때 회복량이 [p:0.5] 증가합니다.',
      'mj.pit': '임상 시험 혈청을 받은 아군의 공격 속도가 혈청 지속 시간 동안 [pv:0.2] 증가합니다.',
      'mj.phase3': '윈터가 살아 있는 동안 다른 아군이 쓰러질 피해를 받으면, 쓰러지는 대신 체력 [p:0.4]로 회복하고 해로운 효과를 모두 제거합니다. 전투당 2회.',
      'mj.stem': '임상 시험 혈청을 받은 아군은 [s:8]간 1초마다 최대 체력의 [p:0.03]만큼 회복합니다. 이 회복에도 생명과학 교수가 적용됩니다.',
    },
  },
  amundsen: {
    brief: { skill: '가장 먼 적을 포격하고 느리게 만듭니다.', trait: '고유 전설 장비를 장착한 채 합류하고, 기본 공격과 스킬을 전술 위력으로 계산합니다.' },
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['관통', `[g:pen] [p:${p.pen}]`],
        ['둔화', `[st:slow:3] 공격 · 이동 속도 -[p:${p.slow}]`],
        ...(p.crit ? [['치명타', `[g:crit] 확률 [pp:${p.crit}]`] as [string, string]] : []),
      ],
      text: [
        `${p.radius ? `가장 먼 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게` : '가장 먼 적에게'} [pw:shoot:${p.mult}:phys]${hitsDetail(p.hits, p.second)}`,
        `이 공격은 방어도 관통이 [p:${p.pen}] 적용됩니다.`,
        ...(p.crit ? [`이 공격은 치명타 확률이 [pv:${p.crit}] 상승 적용됩니다.`] : []),
        `공격이 적중하면 [s:3]간 대상의 공격 속도와 이동 속도를 [pv:${p.slow}] 감소시킵니다.`,
        ...(p.vuln ? [`공격이 적중하면 [s:${p.vulnDur || 4}]간 대상이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`] : []),
      ].join('\n'),
    }),
    trait: '고유 전설 장비 [그늘]을 장착한 채 합류합니다.\n기본 공격과 스킬의 피해를 [g:tac]으로 계산합니다.',
    ace: (k) => `전투가 시작되면 모든 아군의 쿨다운 감소 속도가 [pv:${Math.round(0.15 * k * 1000) / 1000}] 증가합니다.`,
    augs: {
      'sp.shade': '쓰러질 피해를 받으면 체력 [p:0.5]로 되돌아옵니다. 전투당 1회.',
      'sp.mount': '이동하지 않고, 사거리가 2칸 증가합니다. 기본 공격의 피해가 1.6배가 되며, 단장의 명령과 함께면 대신 [g:tac]이 16 증가합니다.',
      'sp.order': '기본 공격을 하지 않습니다. [g:tac]이 48 증가합니다.',
      'sp.volley': '화력 지원이 적중하면 대상으로부터 [t:1] 이내의 다른 적들에게 화력 지원 피해의 [p:0.6]를 가합니다.',
      'sp.journal': '이번 런에서 방문한 사건 노드 1개당 자신의 [g:tac]이 [pv:0.01] 증가하며, 최대 [pv:0.3]까지 증가합니다.',
      'sp.motto': '전투가 시작되면 전투 동안 엘베스타드 아군 전원이 받는 피해를 [pv:0.1] 감소시키고, 최대 체력을 [pv:0.1] 증가시킵니다.',
      'sp.cover': '체력이 처음 [p:0.5] 이하가 되면 [s:3]간 모든 아군이 받는 피해를 [pv:0.6] 감소시킵니다.',
      'sp.maint': '화력 지원의 쿨다운이 [s:2] 감소하고, 방어도 관통이 [pv:0.3] 증가합니다.',
      'mj.double': '화력 지원이 같은 대상을 2회 포격하며, 2번째 피해는 [p:0.6]로 감소합니다.',
      'mj.mark': '화력 지원이 적중하면 [s:6]간 대상이 받는 피해를 [pv:0.15] 증가시킵니다.',
      'mj.watch': '화력 지원을 쓸 때마다 다른 아군 전원의 스킬 쿨다운을 [s:0.5] 감소시킵니다.',
      'mj.detour': '자신으로부터 [t:2] 이내에 적이 있으면 가하는 피해가 [p:0.25] 증가하고, 받는 피해가 [p:0.1] 감소합니다.',
      'mj.orbit': '화력 지원을 쓴 뒤 [s:0.5]마다 무작위 적에게 [g:tac]의 [p:0.4] [el:phys] 피해를 4회 가합니다. 이 공격은 화력 지원의 방어도 관통이 적용되고, 명중 확률이 [pv:1] 상승 적용됩니다. 다시 쓰면 4회부터 새로 셉니다.',
      'mj.lastflight': '7703 전탄 발사의 포탄이 12발로 증가합니다. 궁극기 충전 [pp:0.25]. 궁극기를 쓰면 다른 아군 전원의 남은 스킬 쿨다운을 [p:0.5] 감소시킵니다.',
    },
  },
};

for (const g of [GLOSS_A, GLOSS_B, GLOSS_C, GLOSS_F, GLOSS_G]) for (const [k, v] of Object.entries(g)) GLOSS[k] ??= v;

export const ABIL: Record<string, AbilText> = { ...ABIL_A, ...ABIL_B, ...ABIL_C, ...ABIL_F, ...ABIL_G, ...ABIL_PILOT };

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
  'school.chrono': '[g:cantrip] 「서리 파편」 ([s:6] · [g:reason] -8): 서로 다른 적 3명에게 각각 [dmg:main:0.5:phys] (적이 적으면 중복). 각 대상 [p:0.25] 확률로 [st:freeze:2] ([g:chill] 1중첩당 [pp:0.1]), 빙결되면 오한 제거. 지속 「절대 0도」: 적중 시 [p:0.3] × (피해 ÷ 주요 위력 80%, 최대 2배) 확률로 [g:chill] 1중첩 (중첩당 초당 [dmg:main:0.04:phys], 이동 · 공격 속도 [pp:-0.08], 최대 4중첩, [s:5]). 열역학파 — 고이성: 받는 물리 피해 최대 -[p:0.3]. 저이성: 주는 물리 피해 최대 +[p:0.4].',
  'school.volt': '[g:cantrip] 「방전」 ([s:5] · [g:reason] -8): 대상에게 [dmg:main:0.9:elec] + [g:conduct] 2중첩. 지속 「유도 전류」: 적중 시 [p:0.25] 확률로 [g:conduct] 1중첩 (대상이 공격 · 스킬을 쓸 때마다 주변 [t:1] 다른 적에게 중첩당 [dmg:main:0.15:elec] × (건 피해 ÷ 주요 위력, 최대 2배, 걸 때 고정), 최대 3중첩, [s:5]). 장역학파 — 고이성: 받는 전기 피해 최대 -[p:0.3]. 저이성: 주는 전기 피해 최대 +[p:0.4].',
  'school.wave': '[g:cantrip] 「충격파」 ([s:6] · [g:reason] -8): 대상에게 [dmg:main:0.7:elec] + [g:knock] + [s:5] [g:resonance]. 지속 「공명」: 적중 시 [p:0.2] × (피해 ÷ 주요 위력 80%, 최대 2배) 확률로 [g:resonance] (피격될 때마다 주변 [t:1] 적에게 [dmg:main:0.15:elec], 0.5초에 1회). 장역학파 — 고이성: 받는 전기 피해 최대 -[p:0.3]. 저이성: 주는 전기 피해 최대 +[p:0.4].',
  'school.seed': '[g:cantrip] 「포자」 ([s:5] · [g:reason] -6): 대상 적에게 [dmg:main:0.4:chem] + [g:poison] 2중첩 ([s:5], 중첩당 초당 [dmg:main:0.1:chem]). 지속 「대사」: 적중 시 [p:0.25] 확률로 [g:poison] 1중첩 (최대 3중첩). 생명학파 — 고이성: 받는 화학 · 정신 피해 최대 -[p:0.3]. 저이성: 주는 화학 · 정신 피해 최대 +[p:0.35].',
  'school.mind': '[g:cantrip] 「계시」 ([s:7] · [g:reason] -10): 대상과 주변 [t:1] 적 최대 3명 [s:5] [g:bond] (받는 피해 +[p:0.1], 받은 피해의 [p:0.25]를 다른 결속 대상이 나눠 받음). 대상이 일반 적이면 [st:charm:1.5]. 지속 「자아 침식」: 적중 시 [st:confuse:1:0.25] (같은 대상 1초에 1회 판정). 생명학파 — 고이성: 받는 화학 · 정신 피해 최대 -[p:0.3]. 저이성: 주는 화학 · 정신 피해 최대 +[p:0.35].',
  'school.gold': '[g:cantrip] 「시장 개입」 ([s:8] · [g:reason] -8): 성공 확률 [p:0.4] + [p:0.5] × |이성|/100. 성공: 무작위 재료 장비 1개를 [g:tempgear] (최대 3개). 실패: 체력이 가장 낮은 아군에게 [shield:0.8:main]. 지속 「분산 투자」: 임시 장비 1개당 주는 피해 +[p:0.05], [g:red] +[p:0.03]. 인과학파 — 고이성: 받는 [g:crit] 피해 최대 -[p:0.4], 회피 최대 [pp:0.1]. 저이성: 치명타 확률 최대 [pv:0.25], 치명타 피해 최대 +[p:0.25], 물리 기술 피해(스킬 · 비술)도 [g:crit] 가능 (전기 · 화학 · 정신 · 신성 제외).',
  'school.illusion': '[g:cantrip] 「환영 향」 ([s:7] · [g:reason] -8): 대상 적 근처에 [g:illusion] 1기 ([s:6], 최대 2기, 체력 = 자신 최대 체력 [p:0.3]). 주변 [t:1] 적은 환영을 우선 공격한다 ([g:taunt]). 지속 「향취」: 적중 시 [st:scent:4:0.3] (같은 대상 1초에 1회 판정). 인과학파 — 고이성: 받는 [g:crit] 피해 최대 -[p:0.4], 회피 최대 [pp:0.1]. 저이성: 치명타 확률 최대 [pv:0.25], 치명타 피해 최대 +[p:0.25], 물리 기술 피해(스킬 · 비술)도 [g:crit] 가능 (전기 · 화학 · 정신 · 신성 제외).',
  // ── 전공 증강 (전공당 기본 8종 + ★ 전설 2종, ◆ = 변형, 추가분은 아래 블록)
  'psi.pyro.wp': '[g:burn] 최대 중첩 5 → 10. 소각의 중첩당 피해 [dmg:main:0.5:phys] → [dmg:main:0.35:phys].',
  'psi.pyro.chain': '소각으로 [g:burn]을 소모한 적이 쓰러지면 소각이 즉시 한 번 더 나간다 (쿨다운 · 이성 소모 없음).',
  'psi.pyro.spread': '[g:burn]된 적이 쓰러지면 그 중첩을 주변 [t:1] 적 모두에게 옮긴다.',
  'psi.pyro.white': '[g:burn] 1중첩당 대상 방어도 -[p:0.06]. 소각 피해는 중첩을 제거하기 전에 계산한다.',
  'psi.pyro.runaway': `[g:reason]이 0 미만이면 발화 확률 2배 (봉화와 함께면 봉화 확률 2배), 소각 쿨다운 -[p:${1 - PSI.pyro.runawayCd}]. 대신 자신이 준 연소 피해의 [p:0.1]를 자신도 받는다.`,
  'psi.pyro.ember': '[g:burn] 피해의 [p:0.2]만큼 자신에게 보호막.',
  'psi.pyro.beacon': `◆ 발화가 아군 전원의 기본 공격에 [p:${PSI.pyro.beacon}] 확률로 붙는다 ([g:burn] 1중첩). 자신의 발화 확률은 0. 열폭주와 함께면 [g:reason] 0 미만일 때 [p:${PSI.pyro.beacon * PSI.pyro.runawayProc}].`,
  'psi.chrono.perma': '[g:freeze] [s:2] → [s:3]. 빙결을 걸어도 [g:chill]이 사라지지 않는다.',
  'psi.chrono.stop': '[g:freeze]된 적이 받는 피해 +[p:0.4].',
  'psi.chrono.storm': `서리 파편 ${PSI.chrono.shards}발 → ${PSI.chrono.stormShards}발. 파편당 피해 [dmg:main:${PSI.chrono.coef}:phys] → [dmg:main:${PSI.chrono.stormCoef}:phys]. 시간 가속과 함께면 가속 대상 ${PSI.chrono.hasteN} → ${PSI.chrono.hasteStormN}명 (공격 속도 +[p:${PSI.chrono.hasteAtkSpd}] → +[p:${PSI.chrono.hasteStormAtkSpd}]).`,
  'psi.chrono.rewind': '전투당 1회, 체력이 [p:0.3] 이하가 되면 [s:3] 전 체력으로 돌아가고 그사이 걸린 해로운 효과를 지운다.',
  'psi.chrono.revert': '[g:freeze]를 걸 때마다 [g:reason] +6. 빙결된 적 1명당 쿨다운 감소 속도 [pp:0.1] (최대 [pp:0.3]).',
  'psi.chrono.zero': '[g:chill] 최대 4 → 6중첩. 6중첩인 적에게 다음 적중은 확정 [g:freeze].',
  'psi.chrono.haste': `◆ 서리 파편이 적 대신 아군 ${PSI.chrono.hasteN}명에게 [s:${PSI.chrono.hasteDur}]간 공격 속도 +[p:${PSI.chrono.hasteAtkSpd}]와 서리 무장을 준다: 그 아군의 다음 기본 공격이 맞으면 서리 파편과 같은 확률로 [g:freeze] (빙결 증강 적용). 절대 0도는 그대로.`,
  'psi.volt.hv': `[g:conduct] 범위 [t:1] → [t:2]. 중첩당 피해 [dmg:main:${PSI.volt.per}:elec] → [dmg:main:${PSI.volt.hvPer}:elec] (역전류의 아군 전도는 [dmg:main:${PSI.volt.reversePer}:elec] → [dmg:main:${PSI.volt.reverseHvPer}:elec]).`,
  'psi.volt.chain': `[dmg:main:${Math.round(PSI.volt.coef * PSI.volt.bounce * 100) / 100}:elec]가 가장 가까운 적부터 최대 ${PSI.volt.bounceN}회 [g:bounce]된다 (거리 제한 없음). 역전류와 함께면 충전한 아군에서 출발한다.`,
  'psi.volt.short': `[g:conduct] 3중첩인 적이 행동하면 [st:shock:${PSI.volt.shortShock}] (같은 적에게 ${PSI.volt.shortIcd}초에 1회). 역전류와 함께면 전도 3중첩인 아군이 행동할 때 가장 가까운 적을 감전시킨다.`,
  'psi.volt.store': '[g:conduct] 피해를 줄 때마다 [g:reason] +1 (초당 최대 +3).',
  'psi.volt.overload': `방전 대상이 [g:conduct] 3중첩이면 중첩을 모두 소모해 [dmg:main:${PSI.volt.overload}:elec] 폭발. 역전류와 함께면 충전할 아군이 이미 3중첩일 때 소모해 주변 [t:1] 적 전원에게 [dmg:main:${PSI.volt.reverseOverload}:elec].`,
  'psi.volt.cage': '전투 시작 [s:6]간 아군 전원 받는 전기 피해 -[p:0.3], 효과 저항 [pp:0.2].',
  'psi.volt.reverse': `◆ 방전이 적을 치지 않고 대상과 가장 가까운 아군에게 [g:conduct] ${PSI.volt.reverseN}중첩을 건다 (유도 전류의 전도도 적 대신 그 아군에게). 전도된 아군이 행동할 때마다 주변 [t:1] 적에게 중첩당 [dmg:main:${PSI.volt.reversePer}:elec]. 바운스 번개 · 단락 · 과부하는 충전한 아군을 기준으로 작동한다.`,
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
  'psi.mind.ascend': `[g:charm] 지속 +[s:${PSI.mind.ascendPlus}], 엘리트에게도 걸린다 (지속 절반). 집단 최면과 함께면 혼란 지속 +[s:${PSI.mind.ascendPlus}].`,
  'psi.mind.fate': '[g:bond] 공유 비율 [p:0.25] → [p:0.5].',
  'psi.mind.collective': '[g:bond] 대상 최대 3 → 5명.',
  'psi.mind.dominate': `[g:charm]된 적이 주는 피해 +[p:${PSI.mind.dominate}]. 집단 최면과 함께면 혼란된 적이 같은 편에게 주는 피해 +[p:${PSI.mind.dominate}].`,
  'psi.mind.split': '[g:reason]이 0 미만이면 자신이 받는 피해의 [p:0.3]를 [g:bond]된 적에게 넘긴다.',
  'psi.mind.gaze': '[g:bond]된 적에게 주는 피해 +[p:0.3].',
  'psi.mind.hypno': `◆ 계시가 매혹 대신 [g:bond]된 적 전원을 [st:confuse:${PSI.mind.hypno}]에 빠뜨린다. 승천 · 정신 지배는 혼란에 적용된다.`,
  'psi.gold.futures': '전투 시작 시 무작위 재료 장비 2개를 [g:tempgear].',
  'psi.gold.insider': '시장 개입 성공 확률 [pp:0.3].',
  'psi.gold.leverage': '[g:tempgear] 효과 2배. 대신 시장 개입이 실패하면 보호막 없이 자신이 최대 체력 [p:0.1] 피해를 받는다.',
  'psi.gold.short': '[g:reason]이 0 미만이면 기본 공격 적중 시 대상에게 [dmg:main:0.2:phys] 추가 피해 (임시 장비 1개당 [pp:0.05]).',
  'psi.gold.vol': '[g:reason] 증감량 ×1.5. 시장 개입 쿨다운 -[s:2].',
  'psi.gold.folio': `[g:tempgear]이 ${PSI.gold.max}개면 고이성 · 저이성 효과가 모두 [p:0.5]씩 함께 적용된다 (배당이면 성공 횟수 + 자신이 받은 임시 장비로 센다).`,
  'psi.gold.dividend': '◆ 시장 개입이 성공하면 임시 장비를 자신 대신 아군 3명에게 1개씩 [g:tempgear] (성공 3회까지, 분산 투자는 성공 횟수 + 자신이 받은 임시 장비로 계산, 최대 3).',
  'psi.illusion.troupe': `[g:illusion] 최대 ${PSI.illusion.max} → ${PSI.illusion.troupeMax}기. 분신과 함께면 분신 지속 [s:${PSI.illusion.cloneLife}] → [s:${PSI.illusion.troupeCloneLife}].`,
  'psi.illusion.echo': '[g:illusion]이 사라질 때 주변 [t:1] 적에게 [dmg:main:1.2:psy].',
  'psi.illusion.fog': '[g:illusion] 주변 [t:1] 적은 명중 [pp:-0.3].',
  'psi.illusion.solid': `[g:illusion]이 [dmg:main:${PSI.illusion.solid}:psy]로 공격한다. 분신과 함께면: [g:clone] 체력 [p:${PSI.illusion.cloneHp}] → [p:${PSI.illusion.solidCloneHp}], 분신이 받는 피해 -[p:${PSI.illusion.solidCloneRed}], 분신의 기본 공격이 맞으면 [dmg:main:${PSI.illusion.solidCloneHit}:psy] 추가.`,
  'psi.illusion.dense': '[g:scent]가 최대 3중첩까지 쌓인다.',
  'psi.illusion.disrupt': '[g:illusion]을 공격한 적은 [s:4]간 공격 속도 -[p:0.1] (최대 -[p:0.3]).',
  'psi.illusion.clone': `◆ 환영 대신 자신의 [g:clone] 1기를 부른다 ([s:${PSI.illusion.cloneLife}], 체력 [p:${PSI.illusion.cloneHp}], 자신 피해의 [p:${PSI.illusion.cloneDmg}]로 싸운다). 비술 쿨다운 +[s:${PSI.illusion.cloneCd}]. 실체화와 함께면 분신 체력 [p:${PSI.illusion.solidCloneHp}], 받는 피해 -[p:${PSI.illusion.solidCloneRed}], 기본 공격 적중 시 [dmg:main:${PSI.illusion.solidCloneHit}:psy] 추가. 군무와 함께면 지속 [s:${PSI.illusion.troupeCloneLife}].`,
} as Record<string, string>);
// ── 전공 증강 추가 (전공당 기본 1종 + ★ 전설 2종)
Object.assign(AUG_TEXT, {
  'psi.pyro.kindle': `[g:burn] 지속 [s:${PSI.pyro.dur}] → [s:${PSI.pyro.kindleDur}]. 연소가 없는 적에게 소각을 쓰면 연소 ${PSI.pyro.seed} → ${PSI.pyro.kindleSeed}중첩.`,
  'psi.pyro.nova': `★ [g:burn]이 최대 중첩에 닿으면 폭발한다: 대상과 주변 [t:${PSI.pyro.novaR}] 적에게 중첩당 [dmg:main:${PSI.pyro.novaPer}:phys]. 대상의 연소는 사라지고 휘말린 적에게 연소 ${PSI.pyro.novaSeed}중첩 (같은 적은 [s:${PSI.pyro.novaIcd}]에 1회 폭발).`,
  'psi.pyro.phoenix': `★ 전투당 1회, 쓰러질 피해를 받으면 불꽃으로 되살아난다: 체력 [p:${PSI.pyro.phoenixHp}] · 해로운 효과 제거, 주변 [t:${PSI.pyro.phoenixR}] 적 전원에게 [g:burn]을 최대 중첩까지.`,
  'psi.chrono.rime': `자신을 공격한 적에게 [g:chill] 1중첩 (같은 적은 [s:${PSI.chrono.rimeIcd}]에 1회).`,
  'psi.chrono.timestop': `★ [g:cantrip]을 ${PSI.chrono.stopEvery}번 쓸 때마다 적 전원의 시간이 멈춘다: 보스가 아닌 적 전원 확정 [g:freeze], 보스는 [s:${PSI.chrono.stopBossDur}]간 공격 · 이동 속도 -[p:${PSI.chrono.stopBossSlow}].`,
  'psi.chrono.echo': `★ 자신이 건 [g:freeze]가 풀릴 때, 얼어 있는 동안 그 적이 받은 피해의 [p:${PSI.chrono.echoK}]를 한 번 더 준다.`,
  'psi.volt.static': `유도 전류 확률 [p:${PSI.volt.proc}] → [p:${PSI.volt.staticProc}].`,
  'psi.volt.grid': `★ [g:conduct] 피해가 범위를 넘는다: 전도된 대상이 행동할 때 범위 밖 무작위 적 ${PSI.volt.gridN}명에게도 같은 피해.`,
  'psi.volt.avatar': `★ 자신이 사라지지 않는 [g:conduct] ${PSI.volt.avatarN}중첩을 두른다: 자신이 행동할 때마다 주변 [t:${PSI.volt.avatarR}] 적에게 중첩당 [dmg:main:${PSI.volt.avatarPer}:elec] (고전압이면 [dmg:main:${PSI.volt.avatarHvPer}:elec]). 단락 · 과부하 · 축전도 이 전도에 작동한다.`,
  'psi.wave.after': `충격파 [s:${PSI.wave.afterDelay}] 뒤 같은 대상에게 한 번 더 [dmg:main:${PSI.wave.afterCoef}:elec] + [g:resonance] 갱신 ([g:knock] 없음).`,
  'psi.wave.collapse': `★ 충격파가 대상 주변 [t:${PSI.wave.collapseR}] 적을 모두 대상 곁으로 [g:pull]해 끌어모으고 [g:resonance]을 건다 (보스 · 고정 적 제외).`,
  'psi.wave.cascade': `★ [g:resonance] 피해를 받은 적 주변 1칸에 같은 피해로 1회 여파 (적마다 [s:${PSI.wave.cascadeIcd}]에 1번, 여파는 더 번지지 않음).`,
  'psi.seed.venom': `[g:poison] 중첩당 초당 [dmg:main:${PSI.seed.per}:chem] → [dmg:main:${PSI.seed.venomPer}:chem].`,
  'psi.seed.colony': `★ [g:poison]된 적이 쓰러지면 그 자리에 포자 군락(아군 소환물)이 자란다: [s:${PSI.seed.colonyLife}], 체력 = 자신 최대 체력 [p:${PSI.seed.colonyHp}], 움직이지 않고 1초마다 주변 [t:1] 적에게 중독 1중첩 (최대 ${PSI.seed.colonyMax}기).`,
  'psi.seed.endless': `★ [g:poison]이 최대 중첩에 이르면 터진다: 남은 중독 피해 전부를 즉시 화학 피해로 주고, 주변 1칸 적에게 중독 ${PSI.seed.bloomSpread}중첩 (적마다 [s:${PSI.seed.bloomIcd}]에 1번).`,
  'psi.mind.erode': `자아 침식 확률 [p:${PSI.mind.proc}] → [p:${PSI.mind.erodeProc}], [g:confuse] [s:${PSI.mind.confuse}] → [s:${PSI.mind.erodeConfuse}].`,
  'psi.mind.puppet': `★ 계시의 [g:charm] · [g:confuse]가 끝날 때 체력 [p:${PSI.mind.puppetHp}] 이하인 일반 적은 전투가 끝날 때까지 매혹된다 (전투당 최대 ${PSI.mind.puppetMax}명, 승천이면 엘리트도). 매혹되지 않은 적이 모두 쓰러지면 꼭두각시도 쓰러진다.`,
  'psi.mind.hive': '★ [g:bond] 피해 공유가 나뉘지 않는다: 결속된 적이 피해를 받으면 다른 결속 대상 각각이 공유 비율만큼 받는다 (원래는 인원수로 나눔).',
  'psi.gold.safe': `시장 개입 실패 보호막 [shield:${PSI.gold.shield}:main] → [shield:${PSI.gold.safeShield}:main], 체력이 가장 낮은 아군 ${PSI.gold.safeN}명에게.`,
  'psi.gold.hedge': '★ 시장 개입이 성공과 실패를 모두 일으킨다: [g:tempgear]하고, 체력이 가장 낮은 아군에게 보호막도 준다 (레버리지여도 자해 없음).',
  'psi.gold.cashout': `★ 이긴 전투에서 [g:tempgear]을 받았다면 [p:${PSI.gold.cashoutP}] 확률로 그중 1개를 진짜 재료 장비로 얻는다 (보관함).`,
  'psi.illusion.linger': `[g:illusion] 지속 [s:${PSI.illusion.life}] → [s:${PSI.illusion.lingerLife}], 체력 [p:${PSI.illusion.hp}] → [p:${PSI.illusion.lingerHp}] ([g:clone]은 지속 +[s:${PSI.illusion.lingerClone}]).`,
  'psi.illusion.mirage': `★ [g:illusion] · [g:clone]이 하나라도 있으면 자신은 [g:stealth] (적의 표적이 되지 않는다). 은신 중 주는 피해 +[p:${PSI.illusion.mirageDmg}].`,
  'psi.illusion.mirror': `★ 환영 향을 쓸 때마다 대상 적의 거울 상도 만든다: 대상의 능력치 · 기본 공격을 복사한 아군 ([s:${PSI.illusion.mirrorLife}], 체력 [p:${PSI.illusion.mirrorHp}], 피해 [p:${PSI.illusion.mirrorDmg}], 스킬 없음, 최대 1기, 보스 제외).`,
} as Record<string, string>);
Object.assign(GLOSS, {
  reason: { name: '이성', desc: '사이오닉 게이지 (-100 ~ +100). 학파의 고이성 · 저이성 효과가 이성에 비례해 커진다. 0 미만이면 초당 최대 체력 × 0.5% × (−이성/100) 정신 피해 (−50 이하 2배).' },
  frenzy: { name: '광폭', desc: '이성 −100에서 시작. 피아 구분 없이 가장 가까운 대상을 공격 (같은 편에게는 피해 50%), 비술 불가, 주는 피해 +30%. 초당 이성 +5, −60을 넘으면 해제.' },
  cantrip: { name: '비술', desc: '사이오닉 전공의 추가 능동 기술. 전투 스킬과 별개로 쿨다운마다 자동 시전하고, 쓸 때마다 이성이 줄어든다. 공포 · 혼란 · 광폭 중에는 쓰지 않는다.' },
  burn: { name: '연소', desc: '중첩당 초당 물리 피해 (기본 최대 5중첩, 5초). 다시 걸리면 지속 시간 갱신.' },
  conduct: { name: '전도', desc: '대상이 기본 공격 · 전투 스킬을 쓸 때마다 주변 적에게 중첩당 전기 피해 (최대 3중첩, 5초).' },
  regen: { name: '지속 회복', desc: '1초마다 체력 회복.' },
  scar: { name: '상흔', desc: '사냥꾼 시너지의 치명타가 거는 효과. 중첩당 받는 물리 피해 증가, 중첩과 무관하게 이동 속도 · 회피 감소 (5초, 다시 걸리면 갱신).' },
  necro: { name: '괴사', desc: '의무관(4명부터)이 준 회복량의 일부(넘친 회복량은 절반 효율)를 기록해 두었다가 다음 기본 공격에 그만큼 화학 피해로 터뜨린다. 6명 · 8명은 기록 일부가 남아 누적된다.' },
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
  taunt: { name: '도발', desc: '주변 1칸 적의 이 기물에 대한 도발 수치를 크게 올리고 1.5초 동안 표적을 고정시킨다 (광폭 · 혼란 제외).' },
  prov: { name: '도발 수치', desc: '적이 아군마다 기억하는 값. 그 적에게 준 피해에 비례해 오르고, 회복 · 보호막을 쓰면 주변 적에게 조금 오르며, 시간이 지나면 줄어든다. 적은 0.75초마다 도발 수치 × 성향 가중치가 가장 높은 대상을 고르고, 지금 대상보다 1.3배 이상 높을 때만 갈아탄다. 기물마다 도발 배율이 곱해진다 (돌격가 3, 수호자 시너지가 켜지면 +1.5, 은신 · 기습 중 ×0.3).' },
  clone: { name: '분신', desc: `자신의 능력치 · 무기를 물려받아 함께 싸우는 소환물 (체력 · 피해 ${Math.round(PSI.illusion.cloneHp * 100)}%, ${PSI.illusion.cloneLife}초, 실체화가 있으면 체력 ${Math.round(PSI.illusion.solidCloneHp * 100)}% · 받는 피해 -${Math.round(PSI.illusion.solidCloneRed * 100)}%). 스킬 · 비술은 쓰지 않는다.` },
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
  cp_loader: { trait: '[s:10]마다 포자 살점 2기 [g:spawn] (동시 최대 4기 · 봉인 시 [s:12]마다).' },
  cp_borer: { trait: '[골갑] 화학 외 받는 피해 -[p:0.3] (이음매를 알면 골갑이 듣지 않음).' },
  cp_gate: { trait: '[격리 셔터] [s:12] 주기로 갑문이 열린다 — 닫혀 있는 동안 받는 피해 -[p:0.6] (열림 [s:4] · 검사대를 다시 돌렸으면 [s:7]). [s:10]마다 포자 살점 2기 [g:spawn] (동시 최대 4기 · 격리팀이 봉인하면 [s:15]마다 1기).', skill: { tgt: '자신', range: 0, area: { k: 'self', r: 3 }, rows: [['피해', '[dmg:tech:1.1:chem]']] } },
  cp_herald: { trait: '[중계 증폭] 중계 안테나가 하나라도 서 있으면 받는 피해 -[p:0.5] (전투 시작 시 안테나 2개 · 배전실에서 끄고 오면 1개).', skill: { tgt: '자신', range: 0, area: { k: 'self', r: 4 }, rows: [['피해', '[dmg:tech:1:psy]'], ['공포', '[st:fear:1.5:0.4]']] } },
  cp_antenna: { trait: '공격하지 않는다. 서 있는 동안 중계탑이 받는 피해 -[p:0.5]. 중계탑이 쓰러지면 함께 꺼진다.' },
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
