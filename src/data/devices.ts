import { phaseHpMult } from '../config';

/** 편성 화면에서 배치 · 지정하는 소모품 (전투 시작 때 효과): 접이식 바리케이드 · 유인 신호기 · 감전 지뢰 · 포획 그물 · 표시 망원경.
 *  배치 기록은 이번 조우(Encounter.devices)에 남고, 전투 전에는 탭해서 회수할 수 있다 (소모품 · 망원경 사용 횟수 반환) */
export interface Device {
  id: string;
  /** 칸 (바리케이드: 첫 칸 · 그물: 2×2 의 왼쪽 위 · 망원경: 지정한 칸) */
  x: number; y: number;
  /** 바리케이드: 펼친 방향 (가로 → · 세로 ↓) · 칸 수 */
  dir?: 'h' | 'v'; n?: number;
  /** 망원경: 지정 포격 (적) · 항공 보급 (아군 · 빈칸) */
  mode?: 'strike' | 'drop';
}
export const DEV = {
  /** 바리케이드: 1칸일 때 내구도 (페이즈 체력 배율을 곱한다). 2칸 · 3칸이면 칸마다 1/2 · 1/3 · 1개를 얻으면 uses 회분 (보관함에 겹쳐 들어간다) */
  wall: { hp: 1500, armor: 3, maxN: 3, uses: 2 },
  /** 유인 신호기: 체력 1 · 배치 직후 무적 · 도발 배율 · 매초 주변 적 전체에게 쌓는 도발 수치 (도발 배율 적용 전) */
  decoy: { invuln: 4, prov: 10, pulse: 40 },
  /** 감전 지뢰: 적이 r칸 안에 들어오면 delay 초 뒤 폭발 (반경 r) · 피해 (페이즈 체력 배율^0.9) · 감전 지속 (초, 범위 안 무작위) */
  mine: { r: 1, delay: 0.5, dmg: 400, shock: [3, 6] as [number, number] },
  /** 포획 그물: 2×2 칸 안의 적에게 고정 확률로 속박 · 지속 (효과 저항만큼 줄어듦, 최소 min초) */
  net: { chance: 0.7, dur: 5, min: 1 },
  /** 표시 망원경 (항해자): 처음 받을 때 사용 횟수 · 항해자 단계별로 처음 닿을 때 더하는 횟수 · 페이즈 진입마다 · 포격 계수 (전술 위력 × 페이즈 체력 배율^0.85) · 효과 반경 (항해자 단계별) */
  scope: { base: 2, tierBonus: [0, 3, 5, 99], perPhase: 1, k: 3, r: [1, 1, 2, 2] },
  /** 만찬 백수정 (미리암 라일라 전용): 아군 진형에 놓는 아군 구조물. 내구도 (페이즈 체력 배율을 곱한다) · every 초마다 연쇄 회복:
   *  체력 비율이 가장 낮은 다친 아군이 최대 체력의 heal 만큼 회복 → 다음으로 낮은 다친 아군에게 옮겨 가며 (겹치지 않게, 모두 n명) 한 번 옮길 때마다 decay 만큼 줄어든다 */
  feast: { hp: 300, every: 5, heal: 0.08, n: 3, decay: 0.2 },
};
/** 배치형 소모품 id */
export const PLACE_IDS = ['K_barricade', 'K_decoy', 'K_mine', 'K_net', 'K_scope', 'K_feast'];
export const isPlaceable = (id: string | null | undefined) => !!id && PLACE_IDS.includes(id);
/** 바리케이드가 차지하는 칸 */
export function wallCells(d: Device): { x: number; y: number }[] {
  const n = d.n || 1;
  return [...Array(n).keys()].map((i) => (d.dir === 'v' ? { x: d.x, y: d.y + i } : { x: d.x + i, y: d.y }));
}
/** 장치가 칸을 차지하는지 (바리케이드 · 신호기 · 지뢰). 그물 · 망원경은 효과 범위만 */
export function deviceCells(d: Device): { x: number; y: number }[] {
  if (d.id === 'K_barricade') return wallCells(d);
  if (d.id === 'K_decoy' || d.id === 'K_mine' || d.id === 'K_feast') return [{ x: d.x, y: d.y }];
  return [];
}
/** 그물 2×2 칸 */
export const netCells = (d: Device) => [{ x: d.x, y: d.y }, { x: d.x + 1, y: d.y }, { x: d.x, y: d.y + 1 }, { x: d.x + 1, y: d.y + 1 }];
export const wallHp = (phase: number, n: number) => Math.round((DEV.wall.hp * phaseHpMult(phase)) / Math.max(1, n));
export const mineDmg = (phase: number) => Math.round(DEV.mine.dmg * Math.pow(phaseHpMult(phase), 0.9));
export const strikeDmg = (tac: number, phase: number) => Math.round(tac * DEV.scope.k * Math.pow(phaseHpMult(phase), 0.85));
export const feastHp = (phase: number) => Math.round(DEV.feast.hp * phaseHpMult(phase));
/** 만찬 백수정 연쇄 회복: 대상 순서별 최대 체력 대비 회복 몫 (8% → 6.4% → 5.12%) */
export const feastChain = () => [...Array(DEV.feast.n).keys()].map((k) => DEV.feast.heal * Math.pow(1 - DEV.feast.decay, k));
/** 백분율 표기 (소수 첫째 자리까지, 0 은 떼어 냄): 0.0512 → '5.1%' */
export const feastPct = (x: number) => `${+(x * 100).toFixed(1)}%`;
/** 망원경 효과 반경: 항해자 단계 (0 = 꺼짐) */
export const scopeR = (navTier: number) => DEV.scope.r[Math.max(0, navTier - 1)] ?? 1;

/** 배치형 소모품 성질 (이름 + 값 줄): 보관함 팝업 · 도감이 같은 줄을 읽는다. navTiers = 항해자 단계 인원 (망원경 횟수 단계 표시) */
export function deviceRows(id: string, navTiers: number[] = [2, 4, 6, 8]): [string, string][] {
  const W = DEV.wall, D = DEV.decoy, M = DEV.mine, N = DEV.net, S = DEV.scope, F = DEV.feast;
  switch (id) {
    case 'K_barricade': return [
      ['사용 횟수', `1개당 ${W.uses}회`],
      ['놓는 곳', '적 진형 밖 빈칸'],
      ['모양', `1칸 · 가로 · 세로 ${W.maxN}칸까지`],
      ['내구도', `${W.hp} ÷ 칸 수 (× 페이즈 체력 배율)`],
      ['이동', '막음'],
      ['직선 사격', '막음 (양쪽)'],
      ['기술 · 상태이상', '틈 없이 갈라질 때만 막음'],
      ['길이 막히면', '양쪽이 칸 단위로 부숨'],
    ];
    case 'K_decoy': return [['놓는 곳', '아무 빈칸 (적 진형 포함)'], ['체력', '1'], ['도발 배율', `×${D.prov}`], ['시작 무적', `${D.invuln}초`]];
    case 'K_mine': return [['놓는 곳', '적 진형 밖 빈칸'], ['은신', '계속'], ['발동', `적이 ${M.r}칸 안 → ${M.delay}초 뒤`], ['폭발', `주변 ${M.r}칸 · 전기 피해`], ['감전', `${M.shock[0]}~${M.shock[1]}초`]];
    case 'K_feast': return [
      ['놓는 곳', '아군 진형 빈칸'],
      ['편', '아군 구조물 (적이 노린다)'],
      ['내구도', `${F.hp} (× 페이즈 체력 배율)`],
      ['연쇄 회복', `${F.every}초마다 · ${feastChain().map(feastPct).join(' → ')} (최대 체력 대비)`],
      ['대상', `체력 비율이 가장 낮은 다친 아군부터 ${F.n}명 · 겹치지 않음`],
      ['전투 뒤', '사라짐'],
    ];
    case 'K_net': return [['범위', '2×2 (놓은 칸이 왼쪽 위)'], ['속박 확률', `${Math.round(N.chance * 100)}%`], ['속박', `${N.dur}초 − 효과 저항`]];
    case 'K_scope': return [
      ['적에게', '지정 포격 (전술 위력 비례 피해)'],
      ['아군 · 빈칸에', '항공 보급 (이번 전투 고급 장비 1개씩)'],
      ['효과 범위', `주변 ${S.r[0]}칸 · 항해자 ${navTiers[2]}명부터 ${S.r[2]}칸`],
      ['사용 횟수', `처음 ${S.base} · ${navTiers.slice(1).map((n, i) => `${n}명 +${S.tierBonus[i + 1]}`).join(' · ')} · 페이즈마다 +${S.perPhase}`],
      ['0회', '망원경은 남는다'],
      ['항해자가 꺼지면', '회수 → 다시 켜지면 반환'],
    ];
  }
  return [];
}
