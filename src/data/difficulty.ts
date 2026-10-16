// 난이도 단계 (위험 등급). 단계 n 은 1~n 의 조건을 모두 포함한다. 단계 n 을 클리어하면 n+1 해금.
import { CFG } from '../config';

export interface DiffDef { lvl: number; name: string; desc: string }

/** 위험 등급 d 의 적 증원 간격 (페이즈, 0 = 없음): CFG.diffAdd 에서 d 이하 가장 높은 등급의 값 */
export function diffAddEvery(d: number | undefined): number {
  let lvl = -1, every = 0;
  for (const [l, k] of CFG.diffAdd) if ((d || 0) >= l && l > lvl) { lvl = l; every = k; }
  return every;
}
/** 위험 등급 d · 페이즈 p 의 적 증원 수 = ⌊p ÷ 간격⌋ (조우마다 기본 구성에 더한다. 보드 칸 상한은 genEncounter) */
export const diffAddCount = (d: number | undefined, p: number) => { const k = diffAddEvery(d); return k > 0 ? Math.floor(p / k) : 0; };
/** 증원 규칙 한 줄: '3페이즈마다 적 +1' (간격이 없으면 '') */
export const diffAddRule = (d: number | undefined) => { const k = diffAddEvery(d); return k > 0 ? `${k}페이즈마다 적 +1` : ''; };
/** 위험 등급 설명에 붙는 증원 조건: 그 등급에서 간격이 새로 정해질 때만 (CFG.diffAdd), 의뢰 페이즈 안의 예시 포함 */
function addDesc(lvl: number): string {
  const e = CFG.diffAdd.find(([l]) => l === lvl);
  if (!e) return '';
  const prev = CFG.diffAdd.filter(([l]) => l < lvl).sort((a, b) => b[0] - a[0])[0];
  const ex: string[] = [];
  for (let p = e[1]; p <= CFG.victoryPhase; p += e[1]) ex.push(`${p}페이즈 +${diffAddCount(lvl, p)}`);
  return `적 증원: ${e[1]}페이즈마다 모든 전투의 적 +1 (${ex.join(' · ')}${prev ? `, 위험 ${prev[0]} 대체` : ''}).`;
}

const BASE: DiffDef[] = [
  { lvl: 0, name: '표준 의뢰', desc: '추가 조건 없음.' },
  { lvl: 1, name: '위험 1', desc: '적 체력 +15%.' },
  { lvl: 2, name: '위험 2', desc: '적 피해 +15%. 적이 낮은 확률로 장비 재료를 달고 나오고, 역경 · 보스전에서는 고급 장비도 장착합니다 (2페이즈마다 장비 칸 +1).' },
  { lvl: 3, name: '위험 3', desc: '적 피해 ×1.25 (위험 2 대체). 시작 크레딧 0, 이자 상한 -1. 대신 승리 크레딧 ×1.25.' },
  { lvl: 4, name: '위험 4', desc: '보스 체력 +25%, 보스 호위 +1.' },
  { lvl: 5, name: '위험 5', desc: '역경 적 +1, 일반 전투 정예 출현 확률 2배, 적 회피 +10%p. 적이 개조부품(문장 제외)을 달 수 있고, 보스는 거의 항상 전설 장비를 장착합니다.' },
  { lvl: 6, name: '위험 6', desc: '적 피해 ×1.5 (위험 3 대체). 최대 플레이어 체력 -25. 승리 크레딧 ×1.5 (위험 3 대체). 1페이즈부터 모든 적이 장비 재료(역경 · 보스전은 고급 장비도)를 최소 1개 장착합니다.' },
  { lvl: 7, name: '위험 7', desc: '적 방어도 +25%, 효과 저항 +15%p, 적 회피 +10%p 추가.' },
  { lvl: 8, name: '위험 8', desc: '페이즈마다 적 체력 +5% 추가 (누적).' },
];
/** 위험 등급표: 기본 조건 + 적 증원 조건 (설정값에서 읽는다) */
export const DIFFS: DiffDef[] = BASE.map((x) => { const a = addDesc(x.lvl); return a ? { ...x, desc: `${x.desc} ${a}` } : x; });
export const MAX_DIFF = DIFFS.length - 1;
/** 단계 d 에서 조건 n 이 켜져 있는지 */
export const diffHas = (d: number | undefined, n: number) => (d || 0) >= n;
