// 철수 봇 3단계: 시너지 효과 모형 (eval 영역 'syn3').
//   (a) 실제로 켜지는 효과만 센다: 효과 단계 effTier — '우리의 출항기!'(VOYAGE)는 1명(단독 출항) · 5명(완전체)만 효과가 있고 2~4명은 아무 효과가 없다
//       (src/data/synergies.ts: member 는 단계 2 부터, special 은 1명 · 5명 이상일 때만). 엔진의 tierOf 는 2~4명도 1단계로 세므로 그대로 쓰면 안 된다.
//   (b) 인원을 늘리며 잃는 효과: 단독 출항 고유 능력은 기물 실측(profile.gen.ts, 혼자 출전 = 1명)에 들어 있으므로, 출항기 인원이 1명이 아니면 그 몫을 뺀다.
//   (c) 능력치로 잡히지 않는 시너지 효과(훅: 추가 피해 · 회복 · 부활 · 소환 · 공왕 무휼 등)는 실측 잔차(synprofile.gen.ts)로 곱한다:
//       시너지를 켠 전투 / 끈 전투(같은 시드)의 팀 초당 피해(일반 · 보스 조우 평균) · 버틴 피해 비율에서, 평가 함수가 능력치로 이미 잡은 비율을 뺀 나머지.
//       3페이즈(공명 6) · 6페이즈(공명 14) 두 시점에서 재고 지금 페이즈로 보간한다 (eval.ts profAt).
//   효과 목록과 평가 반영 방식: COVERAGE (docs/BOT_CHULSU.md 3단계 표와 같다).
import { SYN_BY_ID, tierOf } from '../../src/data/synergies';
import type { SynergyId } from '../../src/types';

/** 평가 모드 (실행마다 한 번 정한다: tests/balance.ts · 회귀 테스트) */
export const EVM = { syn3: false };
export function setEvalMode(syn3: boolean) { EVM.syn3 = syn3; }

/** 실제로 켜지는 효과 단계 (0 = 효과 없음). 출항기: 1명 = 1 (단독 출항), 5명 이상 = 2 (완전체), 2~4명 = 0 */
export function effTier(id: SynergyId | string, count: number): number {
  if (id === 'VOYAGE') return count === 1 ? 1 : count >= 5 ? 2 : 0;
  return tierOf(id as SynergyId, count);
}
/** 비활성 구간: 2명 이상 모았는데 아무 효과가 없는 상태 (여러 단계 시너지만, 1인 특성 제외) */
export function inactiveRange(id: SynergyId | string, count: number): boolean {
  const s = SYN_BY_ID[id as SynergyId];
  return !!s && s.tiers.length > 1 && count >= 2 && effTier(id, count) === 0;
}

/** 잔차를 어떻게 옮기는가: member = 효과가 구성원 자신의 전력에 비례 (구성원 몫 비율로 늘이고 줄인다), team = 팀 전체에 같은 비율 */
export const SYN_KIND: Record<string, 'member' | 'team'> = {
  UNI: 'member', KAL: 'member', HEL: 'member', PET: 'member', SIR: 'member', PAN: 'team', FAM: 'member', SEC: 'team', STL: 'team', HOI: 'member',
  TIME: 'member', CHR: 'team', MED: 'team', BUDDY: 'member', STAR: 'member', INFIL: 'member', NAV: 'member', CHEF: 'member', ENG: 'member',
  SCHEME: 'team', DECOMP: 'member', COND: 'member', GUARD: 'member', HUNTER: 'member', VOYAGE: 'member', OCCULT: 'member',
};

/** 효과 목록 · 평가 반영 (2단계 V → 3단계 V). stat = 엔진 능력치 계산(computeStats)으로 잡힘, hook = 실측 잔차(synprofile)로 곱함 */
export const COVERAGE: { id: string; key: string; before: string; after: string }[] = [
  { id: 'UNI', key: '주요 능력치 · 피해 증가 · 공명 등급 취급 · 전투 후 공명도', before: '능력치 + α', after: '능력치 + 잔차 (공명도 수입은 반영 안 함)' },
  { id: 'KAL', key: '방어력 · 작위당 피해 (setup) · 받는 피해 감소 · 근위기사 소환', before: '방어력만 + α', after: '능력치 + 잔차 (작위 피해 · 근위기사)' },
  { id: 'HEL', key: '전투력 · 피해 · 상태이상 대상 피해 · 퀘스트 · 동맹 장비', before: '능력치 + α', after: '능력치 + 잔차 (퀘스트 · 장비 지급은 반영 안 함)' },
  { id: 'PET', key: '피해 · 크레딧 비례 증폭 · 이자 · 보험', before: '능력치 + α', after: '능력치 + 잔차 (실측 때 크레딧 기준)' },
  { id: 'SIR', key: '신성 증폭 · 추가 신성 피해 · 신성 흡혈 · 부활 1회', before: '받는 피해 감소만 + α', after: '능력치 + 잔차 (추가 피해 · 부활)' },
  { id: 'PAN', key: '기물별 선물 (능력치)', before: '능력치 + α', after: '능력치 + 잔차' },
  { id: 'FAM', key: '독립 피해 증폭 · 독립 피해 감소 (훅)', before: 'α 만', after: '잔차 (증폭 · 감소)' },
  { id: 'SEC', key: '받는 피해 감소 · 해로운 효과 연장 · 합동 격리 (전술 위력 고정 피해)', before: '피해 감소 + α', after: '능력치 + 잔차 (격리)' },
  { id: 'STL', key: '기동력 · 비행선 추락 (적 최대 체력 비례 고정 피해)', before: '기동력 + α', after: '능력치 + 잔차 (추락)' },
  { id: 'HOI', key: '정신력 · 투자 노드 · 크레딧 비례 피해', before: '능력치 + α', after: '능력치 + 잔차' },
  { id: 'TIME', key: '쿨다운 · 회피 · 기술 피해 · 회피 시 회복 (3+) · 부활 (4+)', before: '능력치 + α', after: '능력치 + 잔차 (회피 회복 · 부활)' },
  { id: 'CHR', key: '능력치 · 피해 · 공왕 무휼 소환 (인과 단계로 성장)', before: '능력치만 (무휼 없음) + α', after: '능력치 + 잔차 (무휼, 인과 단계 1 · 4 · 7 실측에서 보간)' },
  { id: 'MED', key: '회복 효율 · 최대 체력 · 4초마다 치료 · 보호막', before: '능력치 + α', after: '능력치 + 잔차 (치료 · 보호막)' },
  { id: 'BUDDY', key: '단짝 소환물 (상속 · 피해 · 능력치)', before: 'α 만 (소환은 기물 실측에)', after: '잔차 (단계별 소환 강화)' },
  { id: 'STAR', key: '피해 + 명성 비례', before: '능력치 + α', after: '능력치 + 잔차 (실측 때 명성 0)' },
  { id: 'INFIL', key: '회피 · 기습 피해 · 처형 · 보스 피해 증폭', before: '회피 + α', after: '능력치 + 잔차 (기습 · 처형)' },
  { id: 'NAV', key: '에이스 능력 · 피해 · 기동력', before: '능력치 + α', after: '능력치 + 잔차 (에이스)' },
  { id: 'CHEF', key: '요리 위력 · 최대 체력 · 만찬 회복 · 빵', before: '능력치 + α', after: '능력치 + 잔차' },
  { id: 'ENG', key: '감시 포탑 (상속) · 포탑 장비', before: 'α 만', after: '잔차 (포탑, 포탑 장비 없이 실측)' },
  { id: 'SCHEME', key: '효과 명중 · 전술 위력 · [암운] 지속 고정 피해 · 추가 피해', before: '효과 명중 + α', after: '능력치 + 잔차 (암운)' },
  { id: 'DECOMP', key: '화학 피해 증가 · 최대 체력 비례 화학 피해 · [부식] · 흡혈', before: 'α 만', after: '잔차 (화학 · 부식 · 회복)' },
  { id: 'COND', key: '전기 피해 증가 · [바운스] 연쇄', before: 'α 만', after: '잔차 (바운스)' },
  { id: 'GUARD', key: '방어도 (인원 비례) · 방어도 비례 추가 피해 · 도발', before: '방어도 + α', after: '능력치 + 잔차 (추가 피해 · 도발)' },
  { id: 'HUNTER', key: '공격 속도 · 치명타 피해 · 사거리 · 최대 체력 비례 고정 피해', before: '능력치 + α', after: '능력치 + 잔차' },
  { id: 'VOYAGE', key: '1명: 고유 능력 · 2~4명: 없음 · 5명: 전원 고유 능력 + 전투력 + 기술 회복 + 연장전 증폭', before: '2~4명도 1단계 α · 단독 고유 능력은 기물 실측에 늘 포함', after: '2~4명 0 · 단독 고유 능력은 1명일 때만 · 완전체 잔차' },
  { id: 'OCCULT', key: '기술 위력 · 전용 개조부품 · 합성', before: '능력치 + α', after: '능력치 + 잔차 (부품 제외)' },
];

/** 실측 잔차 한 칸: o · d = ln(실측 비율 / 평가 함수 비율) 평균 (피해 · 버틴 피해), oe · de = 표준오차, so · sd = 실측 팀에서 구성원 몫 */
export interface SynProf { o: number; oe: number; d: number; de: number; so: number; sd: number; n: number }
/** 잡음 줄이기: 평균² / (평균² + 표준오차²) 만큼만 믿는다 */
export const shrink = (m: number, se: number) => (m * m) / Math.max(1e-12, m * m + se * se) * m;
