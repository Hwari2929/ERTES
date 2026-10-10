// 난이도 단계 (위험 등급). 단계 n 은 1~n 의 조건을 모두 포함한다. 단계 n 을 클리어하면 n+1 해금.
export interface DiffDef { lvl: number; name: string; desc: string }
export const DIFFS: DiffDef[] = [
  { lvl: 0, name: '표준 의뢰', desc: '추가 조건 없음.' },
  { lvl: 1, name: '위험 1', desc: '적 체력 +15%.' },
  { lvl: 2, name: '위험 2', desc: '적 피해 +15%.' },
  { lvl: 3, name: '위험 3', desc: '시작 크레딧 0, 이자 상한 -1.' },
  { lvl: 4, name: '위험 4', desc: '보스 체력 +25%, 보스 호위 +1.' },
  { lvl: 5, name: '위험 5', desc: '역경 적 +1, 일반 전투 정예 출현 확률 2배.' },
  { lvl: 6, name: '위험 6', desc: '최대 플레이어 체력 -25.' },
  { lvl: 7, name: '위험 7', desc: '적 방어도 +25%, 효과 저항 +15%p.' },
  { lvl: 8, name: '위험 8', desc: '페이즈마다 적 체력 +5% 추가 (누적).' },
];
export const MAX_DIFF = DIFFS.length - 1;
/** 단계 d 에서 조건 n 이 켜져 있는지 */
export const diffHas = (d: number | undefined, n: number) => (d || 0) >= n;
