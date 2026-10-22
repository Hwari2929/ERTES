// 출격 계약 (에란테스 바 카운터의 의뢰 차림표, ui/contract.ts): 의뢰 · 약관 · 특약을 고르고 계산서에 서명하면 계약 기물 명부가 열린다.
//   의뢰 = 전장 (의뢰 제목 · 의뢰인은 data/scenes/fields.ts FIELD_INTROS) · 약관 = 난이도 (data/difficulty.ts DIFF_PRESETS 의 위험 등급, 조항 = DIFFS)
//   특약 = 절망 서약 (data/oaths.ts, 담보 약관 = 위험 CFG.oathFrom 이상에만 붙는다) · 싯가 의뢰 = 서명 뒤에 전장 · 의뢰인 · 보수가 드러나는 봉인 의뢰서
//   메뉴에 없는 의뢰 = 오늘 의뢰서에 없는 전장을 직접 주문 (보수 CFG.contract.customWin)
// 메뉴판 문법: 큰 글자 = 플레이어가 고르는 말(표준 · 성과급 · 담보), 작은 글자 = 세계의 말(부서 · 난이도 · 위험 등급)
// 약관 이름은 주식회사 페트라 법무부 · 재정부 · 자산관리부 (lore/세력/주식회사 페트라.md). 수치는 여기 적지 않고 그릴 때마다 설정 · 데이터에서 읽는다.
import { CFG } from '../config';

export interface PlanDef {
  /** 위험 등급 (DIFF_PRESETS 의 lvl) */
  lvl: number;
  /** 전표 품번 */
  code: string;
  /** 약관 이름 (전표 · 정보 판) */
  name: string;
  /** 차림표 큰 글자: 플레이어가 고르는 말 */
  short: string;
  /** 차림표 작은 글자: 약관을 낸 페트라 부서 */
  dept: string;
  /** 계약 종류 (짧은 이름: 지도 상단 영수 증서 칩 · 계산서) */
  label: string;
  /** 한 줄 사연 (차림표 정보 판) */
  quip: string;
}
export const PLANS: PlanDef[] = [
  { lvl: 3, code: '201', name: '법무부 표준 약관', short: '표준', dept: '법무부', label: '표준 계약', quip: '페트라 법무부가 용역 계약마다 붙이는 기본 약관. 착수금은 없고, 상대가 무장을 갖추는 것도 막지 않는다.' },
  { lvl: 6, code: '202', name: '재정부 성과급 약관', short: '성과급', dept: '재정부', label: '성과급 계약', quip: '잘 싸운 만큼 받는다. 대신 상대도 그만큼 준비하고 나온다는 조항이 줄줄이 따라붙는다.' },
  { lvl: 7, code: '203', name: '자산관리부 담보 약관', short: '담보', dept: '자산관리부', label: '담보 계약', quip: '사람도 자산입니다. 함대를 담보로 잡고, 절망을 담보 조항으로 받는다. 특약은 이 약관에만 붙는다.' },
];
export const PLAN_BY_LVL: Record<number, PlanDef> = Object.fromEntries(PLANS.map((p) => [p.lvl, p]));

/** 싯가 의뢰의 보수 가산 (승리 크레딧 +a ~ +b, 서명할 때 정해진 값이 드러난다) */
export const sealedRange = () => CFG.contract.sealedWin;
/** 싯가 의뢰 보수 가산값 하나 (1% 단위) */
export const rollSealed = (rnd: () => number) => { const [a, b] = sealedRange(); return Math.round((a + (b - a) * rnd()) * 100) / 100; };
/** 메뉴에 없는 의뢰의 보수 (승리 크레딧 −) */
export const customWin = () => CFG.contract.customWin;
/** 계약 보수 배율 (승리 크레딧): 싯가 의뢰 가산 · 메뉴에 없는 의뢰 감산 (sealed = 첫 판의 저장 이름) */
export const contractWinMul = (r: { contract?: { bonus?: number; sealed?: number } } | null | undefined) => 1 + (r?.contract?.bonus ?? r?.contract?.sealed ?? 0);
