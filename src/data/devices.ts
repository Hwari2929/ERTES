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
  /** 바리케이드: 1칸일 때 내구도 (페이즈 체력 배율을 곱한다). 2칸 · 3칸이면 칸마다 1/2 · 1/3 */
  wall: { hp: 1500, armor: 40, maxN: 3 },
  /** 유인 신호기: 체력 1 · 배치 직후 무적 · 도발 배율 · 매초 주변 적 전체에게 쌓는 도발 수치 (도발 배율 적용 전) */
  decoy: { invuln: 4, prov: 10, pulse: 40 },
  /** 감전 지뢰: 적이 r칸 안에 들어오면 delay 초 뒤 폭발 (반경 r) · 피해 (페이즈 체력 배율^0.9) · 감전 지속 (초, 범위 안 무작위) */
  mine: { r: 1, delay: 1.5, dmg: 250, shock: [2, 4] as [number, number] },
  /** 포획 그물: 2×2 칸 안의 적에게 고정 확률로 속박 · 지속 (효과 저항만큼 줄어듦, 최소 min초) */
  net: { chance: 0.7, dur: 5, min: 1 },
  /** 표시 망원경 (항해자): 처음 받을 때 사용 횟수 · 항해자 단계별로 처음 닿을 때 더하는 횟수 · 페이즈 진입마다 · 포격 계수 (전술 위력 × 페이즈 체력 배율^0.85) · 효과 반경 (항해자 단계별) */
  scope: { base: 2, tierBonus: [0, 3, 5, 99], perPhase: 1, k: 3, r: [1, 1, 2, 2] },
};
/** 배치형 소모품 id */
export const PLACE_IDS = ['K_barricade', 'K_decoy', 'K_mine', 'K_net', 'K_scope'];
export const isPlaceable = (id: string | null | undefined) => !!id && PLACE_IDS.includes(id);
/** 바리케이드가 차지하는 칸 */
export function wallCells(d: Device): { x: number; y: number }[] {
  const n = d.n || 1;
  return [...Array(n).keys()].map((i) => (d.dir === 'v' ? { x: d.x, y: d.y + i } : { x: d.x + i, y: d.y }));
}
/** 장치가 칸을 차지하는지 (바리케이드 · 신호기 · 지뢰). 그물 · 망원경은 효과 범위만 */
export function deviceCells(d: Device): { x: number; y: number }[] {
  if (d.id === 'K_barricade') return wallCells(d);
  if (d.id === 'K_decoy' || d.id === 'K_mine') return [{ x: d.x, y: d.y }];
  return [];
}
/** 그물 2×2 칸 */
export const netCells = (d: Device) => [{ x: d.x, y: d.y }, { x: d.x + 1, y: d.y }, { x: d.x, y: d.y + 1 }, { x: d.x + 1, y: d.y + 1 }];
export const wallHp = (phase: number, n: number) => Math.round((DEV.wall.hp * phaseHpMult(phase)) / Math.max(1, n));
export const mineDmg = (phase: number) => Math.round(DEV.mine.dmg * Math.pow(phaseHpMult(phase), 0.9));
export const strikeDmg = (tac: number, phase: number) => Math.round(tac * DEV.scope.k * Math.pow(phaseHpMult(phase), 0.85));
/** 망원경 효과 반경: 항해자 단계 (0 = 꺼짐) */
export const scopeR = (navTier: number) => DEV.scope.r[Math.max(0, navTier - 1)] ?? 1;

/** 배치형 소모품 성질 (이름 + 값 줄): 보관함 팝업 · 도감이 같은 줄을 읽는다. navTiers = 항해자 단계 인원 (망원경 횟수 단계 표시) */
export function deviceRows(id: string, navTiers: number[] = [2, 4, 6, 8]): [string, string][] {
  const W = DEV.wall, D = DEV.decoy, M = DEV.mine, N = DEV.net, S = DEV.scope;
  switch (id) {
    case 'K_barricade': return [
      ['놓는 곳', '적 진형 밖 빈칸'],
      ['모양', `1칸 · 가로 · 세로 ${W.maxN}칸까지`],
      ['내구도', `${W.hp} ÷ 칸 수 (× 페이즈 체력 배율)`],
      ['막는 것', '이동 · 기본 공격 (양쪽)'],
      ['틈 없이 갈라지면', '기술 · 상태이상도 막음'],
      ['길이 막히면', '양쪽이 칸 단위로 부숨'],
    ];
    case 'K_decoy': return [['놓는 곳', '아무 빈칸 (적 진형 포함)'], ['체력', '1'], ['도발 배율', `×${D.prov}`], ['시작 무적', `${D.invuln}초`]];
    case 'K_mine': return [['놓는 곳', '적 진형 밖 빈칸'], ['은신', '계속'], ['발동', `적이 ${M.r}칸 안 → ${M.delay}초 뒤`], ['폭발', `주변 ${M.r}칸 · 전기 피해`], ['감전', `${M.shock[0]}~${M.shock[1]}초`]];
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
