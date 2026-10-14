// 사이오닉 학파 7종: 학파 = 합류 시 고르는 증강(pool 'school', 소마법 + 고 · 저이성 효과),
// 전공 = 그 학파의 지속 능력 6개 (pool 'psionic', 5 · 10 · 15 · 20등급, 최대 4개)
import type { AugDef } from '../engine/effects';

export type SchoolId = 'pyro' | 'volt' | 'seed' | 'chrono' | 'trans' | 'wave' | 'gold';
export interface CantripDef { name: string; cd: number; cost: number; desc: string }
export interface SchoolDef {
  id: SchoolId; name: string; study: string; color: string;
  cantrip: CantripDef;
  /** 고이성 · 저이성 효과 설명 (이성에 선형 비례, 최대치 기준) */
  high: string; low: string;
}

export const SCHOOLS: SchoolDef[] = [
  { id: 'pyro', name: '홍염학파', study: '국소 열역학 · 비등 이론', color: '#ff7a3d',
    cantrip: { name: '불씨', cd: 5, cost: 8, desc: '대상 적에게 연소 2중첩 (6초간 중첩당 초당 기술 위력 6% 물리 피해, 최대 5중첩, 걸 때마다 시간 갱신).' },
    high: '효과 명중 최대 +30%p', low: '주고받는 물리 피해 최대 +40%' },
  { id: 'volt', name: '뇌전학파', study: '전자기장 이론 · 첨단 공학', color: '#4fd1ff',
    cantrip: { name: '방전', cd: 5, cost: 8, desc: '대상에게 기술 위력 90% 전기 피해 + 4초 전도 (대상이 공격 · 스킬을 쓸 때마다 주변 1칸 다른 적에게 기술 위력 30% 전기 피해).' },
    high: '받는 전기 피해 최대 -40%', low: '주고받는 전기 피해 최대 +40%' },
  { id: 'seed', name: '파종학파', study: '생화학', color: '#8fd14f',
    cantrip: { name: '포자', cd: 5, cost: 6, desc: '대상 적 중독 (5초, 초당 기술 위력 20% 화학) + 체력 비율이 가장 낮은 아군에게 지속 회복 (5초, 초당 기술 위력 14%).' },
    high: '받는 회복량 최대 +30%', low: '주고받는 화학 피해 최대 +40%' },
  { id: 'chrono', name: '시공학파', study: '엔트로피 · 결정론적 혼돈', color: '#a9dcff',
    cantrip: { name: '엔트로피', cd: 4, cost: 7, desc: '대상 적에게 오한 2중첩 (중첩당 공격 · 이동 속도 -6%, 초당 기술 위력 3% 피해, 4초, 최대 6중첩). 오한을 걸 때 중첩 × 8% 확률로 빙결 1.5초 (행동 불가, 중첩 소모).' },
    high: '쿨다운 감소 속도 최대 +40%', low: '공격 속도 최대 +40%, 회피 최대 -20%p' },
  { id: 'trans', name: '초월학파', study: '승천 차원 · 사이오닉학', color: '#b07cff',
    cantrip: { name: '계시', cd: 7, cost: 10, desc: '대상과 주변 1칸 적 최대 3명을 결속 (5초, 받는 피해 +10%, 받은 피해의 25%를 다른 결속 대상이 나눠 받음). 대상이 일반 적이면 1.5초 매혹 (아군처럼 싸움).' },
    high: '받는 정신 피해 최대 -40%', low: '주고받는 정신 피해 최대 +40%' },
  { id: 'wave', name: '파장학파', study: '힘과 장', color: '#7ff0d8',
    cantrip: { name: '충격파', cd: 6, cost: 8, desc: '대상에게 기술 위력 70% 피해 + 1칸 밀쳐내기 + 5초 공진 (피격될 때마다 주변 1칸 적에게 기술 위력 15% 피해, 0.5초에 1회).' },
    high: '받는 고정 피해 최대 -40%', low: '효과 명중 최대 +30%p, 효과 저항 최대 -30%p' },
  { id: 'gold', name: '보화학파', study: '크레딧 · 시장 동향', color: '#ffc94d',
    cantrip: { name: '시장 개입', cd: 8, cost: 8, desc: '성공 확률 40% + 50% × |이성|/100. 성공하면 무작위 재료 장비 1개를 전투 동안 임시 장착 (최대 3개). 실패하면 체력이 가장 낮은 아군에게 기술 위력 80% 보호막.' },
    high: '보유 크레딧 10당 피해량 경감 +1.5% (최대 +20%)', low: '보유 크레딧 10당 주는 피해 +2% (최대 +30%)' },
];
export const SCHOOL_BY_ID = Object.fromEntries(SCHOOLS.map((s) => [s.id, s])) as Record<SchoolId, SchoolDef>;

/** 지속 능력 6종 (전공 증강) — 이름 · 설명. 효과는 PSI_EFFECT 에서 붙인다 */
export const SCHOOL_PASSIVES: Record<SchoolId, [key: string, name: string, desc: string][]> = {
  pyro: [
    ['boil', '비등점', '연소 최대 중첩 5 → 8.'],
    ['ignite', '점화', '불씨가 연소 5중첩 이상인 적에게 걸리면 점화: 남은 연소 피해 ×1.5를 즉시 주고, 주변 1칸 적에게 연소 2중첩을 퍼뜨린다.'],
    ['wildfire', '산불', '연소된 적이 쓰러지면 그 중첩을 주변 1칸 적에게 그대로 옮긴다.'],
    ['white', '백열', '연소 1중첩당 대상 방어도 -6%.'],
    ['cycle', '열 순환', '연소 피해의 15%만큼 자신에게 보호막.'],
    ['overheat', '과열', '이성이 0 미만이면 불씨 쿨다운 -40%, 이성 소모 ×1.5.'],
  ],
  volt: [
    ['hv', '고전압', '전도 피해 30% → 50%, 범위 1 → 2칸.'],
    ['chain', '연쇄 번개', '방전이 가장 가까운 다른 적 2명에게 50% 피해로 튄다.'],
    ['short', '단락', '방전이 45% 확률로 1.5초 감전. 감전된 적에게 주는 피해 +25%.'],
    ['store', '축전', '전도 피해를 줄 때마다 이성 +1 (초당 최대 +3).'],
    ['cage', '패러데이 새장', '전투 시작 6초간 자신과 주변 1칸 아군 받는 전기 피해 -25%, 효과 저항 +20%p.'],
    ['oc', '오버클럭', '소마법을 쓴 뒤 3초간 공격 속도 +30%.'],
  ],
  seed: [
    ['conc', '독성 농축', '중독이 최대 3중첩까지 쌓인다.'],
    ['symb', '공생균', '지속 회복이 2명에게, 초당 회복 14% → 18%.'],
    ['rot', '부패', '중독된 적이 받는 회복 -50%.'],
    ['photo', '광합성', '이성이 30 이상이면 초당 자신 최대 체력 1.5% 회복.'],
    ['burst', '포자 폭발', '중독된 적이 쓰러지면 주변 1칸 적에게 기술 위력 60% 화학 피해를 주고 중독을 옮긴다.'],
    ['anti', '항체', '포자의 지속 회복 대상에게서 해로운 효과 1개 제거.'],
  ],
  chrono: [
    ['zero', '절대영도', '빙결 확률 중첩당 8% → 12%.'],
    ['determ', '결정론', '빙결된 적이 받는 피해 +30%.'],
    ['perma', '영구 동토', '빙결 지속 1.5 → 2.5초.'],
    ['delay', '시간 지연', '엔트로피가 주변 1칸 적에게도 오한 1중첩.'],
    ['rewind', '되감기', '전투당 1회, 체력이 30% 이하가 되면 3초 전 체력으로 되돌아간다.'],
    ['revert', '엔트로피 역행', '빙결이 일어날 때마다 이성 +4.'],
  ],
  trans: [
    ['ascend', '승천', '매혹 지속 +1초, 엘리트에게도 걸린다 (절반 지속).'],
    ['fate', '연결된 운명', '결속 공유 비율 25% → 50%.'],
    ['collective', '집단 무의식', '결속 대상 최대 3 → 5명.'],
    ['dominate', '정신 지배', '매혹된 적이 주는 피해 +100%.'],
    ['gaze', '초월자의 시선', '결속된 적에게 주는 정신 피해 +25%.'],
    ['split', '자아 분리', '이성이 0 미만일 때 받는 피해의 30%를 결속된 적에게 넘긴다.'],
  ],
  wave: [
    ['freq', '고유 진동수', '공진 피해 15% → 25%.'],
    ['impact', '충돌', '밀쳐낸 적이 다른 기물과 부딪히면 둘 다 1초 기절.'],
    ['amp', '진폭 증폭', '충격파가 대상 주변 1칸 적 모두를 밀쳐내고 공진을 건다.'],
    ['field', '역장', '이성이 50 이상이면 피해량 경감 15%.'],
    ['standing', '정상파', '공진 피해 +5%p. 공진된 적이 기절하면 공진 지속 시간이 갱신된다.'],
    ['seismic', '진도 측정', '충격파가 35% 확률로 1.2초 기절.'],
  ],
  gold: [
    ['futures', '선물 거래', '전투 시작 시 무작위 재료 장비 2개를 임시 장착.'],
    ['insider', '내부 정보', '시장 개입 성공 확률 +30%p.'],
    ['bull', '상승장', '이성이 0 이상이면 임시 장비 1개당 주는 피해 +6%.'],
    ['short', '공매도', '이성이 0 미만이면 시장 개입이 대상 적에게 기술 위력 150% 피해 (임시 장비 1개당 +20%).'],
    ['vol', '변동성', '이성 증감량 ×1.5, 시장 개입 쿨다운 -2초.'],
    ['folio', '포트폴리오', '임시 장비가 3개면 고이성 · 저이성 효과가 모두 50%씩 함께 적용.'],
  ],
};

export const schoolAugId = (s: SchoolId) => `school.${s}`;
export const psiAugId = (s: SchoolId, key: string) => `psi.${s}.${key}`;
/** 보유 증강에서 학파를 찾는다 */
export function schoolOf(u: { augments: { id: string }[] }): SchoolId | null {
  const a = u.augments.find((x) => x.id.startsWith('school.'));
  return a ? (a.id.slice(7) as SchoolId) : null;
}
/** 상태이상 표시 이름 (엔진 키 → 이름 · 설명) */
export const PSI_STATUS: Record<string, { name: string; desc: string }> = {
  burn: { name: '연소', desc: '지속 물리 피해 (중첩)' },
  conduct: { name: '전도', desc: '행동할 때마다 주변 적에게 전기 피해' },
  regen: { name: '지속 회복', desc: '초마다 체력 회복' },
  chill: { name: '오한', desc: '공격 · 이동 속도 감소, 약한 지속 피해 (중첩)' },
  freeze: { name: '빙결', desc: '행동 불가' },
  charm: { name: '매혹', desc: '잠시 상대 편으로 싸움' },
  bond: { name: '결속', desc: '받는 피해 증가, 다른 결속 대상과 피해 공유' },
  resonance: { name: '공진', desc: '피격될 때마다 주변 적에게 피해' },
};

/** 효과 구현은 엔진 쪽(src/data/psionic.ts)에서 채운다 */
export type SchoolAugBuilder = (s: SchoolDef) => AugDef;
