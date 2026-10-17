import type { CUnit, SkillDef } from '../engine/combat';
import type { AugDef, Effect } from '../engine/effects';
import type { CType, Elem, FactionId, FaithId, Keyword, Major, TraitId, TType, Weapon } from '../types';

/** 명단 파일에 적는 기본 정의 (리워크 정보는 rework.ts 에서 합쳐진다) */
export interface BaseUnit {
  id: string;
  name: string;
  title: string;
  /** 소속 세력 (엘베스타드 일가처럼 2개일 수 있음). 첫 번째가 대표 세력 */
  factions: FactionId[];
  traits: TraitId[];
  keywords: Keyword[];
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  range: number;
  base: Record<Major, number>;
  sprite: string;
  palette: string[];
  skill: SkillDef;
  lore: string;
  /** 최고의 친구: 전투 시작 시 소환하는 단짝 */
  summon?: SummonDef;
  /** 항해자: [에이스 파일럿]으로 지정되면 활성화되는 추가 특성 (k = 항해자 단계 배율) */
  ace?: { name: string; desc: (k: number) => string; effect: (k: number) => Effect };
  /** 합류할 때 장착된 고유 장비 (해제 불가) */
  item?: string;
  /** 시작 기물로 고를 수 없음 */
  noStarter?: boolean;
  /** 사건 노드로만 합류 (영입 노드 · 시작 기물 제외) */
  eventOnly?: boolean;
  /** 공격 · 이동 · 기술 없이 칸만 차지하는 짐 (절망 증강 반려 돌: 늘 출전 · 공명도 없음 · 장비 불가) */
  inert?: boolean;
  /** 기물 고유 패시브 (조슈아의 체사레 전환 등) */
  passive?: Effect;
}

/** 리워크 정보: 전투 유형 · 전술 유형 · 무기 · 고유 특성 · 신앙 */
export interface ReworkDef {
  ctype: CType;
  ttype: TType;
  weapon: Weapon;
  faith: FaithId;
  trait: { name: string; desc: string; effect?: Effect };
  /** 마이너: 런 동안 쌓이는 성장 특성. g = UnitState.grow */
  growth?: { name: string; desc: string; effect?: (g: Record<string, number>) => Effect };
  /** 스페셜: 합류 시 고르는 스페셜 증강 */
  specialAugs?: AugDef[];
  /** 사이오닉: 이성 증감 규칙 */
  psi?: { desc: string; effect: Effect };
  /** 시너지 재배치 (세력 1 + 특성 1~2) */
  factions?: FactionId[];
  traits?: TraitId[];
  title?: string;
}

export type UnitDef = BaseUnit & Omit<ReworkDef, 'factions' | 'traits' | 'title'>;

export interface SummonDef {
  name: string;
  /** 전투 유형: 도발 배율이 그 유형 값을 따른다 (돌격가 ×3, 전문가 ×1 — combat.ts provMult). 없으면 소환물 기본 (근접 · 고정 · 원거리) */
  ctype?: Extract<CType, 'VAN' | 'SPEC'>;
  sprite: string;
  palette: string[];
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  range: number;
  hpMul?: number;
  /** 일러스트 id (art/<art>.webp, 초상화 아이콘) */
  art?: string;
  /** 기본 공격 계수 (기본 1) */
  basicMult?: number;
  /** 상속률 배율 (기본 1) */
  rate?: number;
  /** 이동 속도 (기본 1.15) */
  moveSpd?: number;
  /** 사거리 안에서 체력 비율이 가장 낮은 적을 노린다 */
  focusLow?: boolean;
  /** 함께 소환되는 다른 소환물 (각 1기, 추가 소환 효과는 첫 소환물에만) */
  also?: SummonDef[];
}

export const B = (vit: number, pow: number, mnd: number, def: number, agi: number) => ({ vit, pow, mnd, def, agi });

export function uaug(owner: string, id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef {
  return { id: `${owner}.${id}`, name, desc, pool: 'unit', owner, effect: () => effect, ...extra };
}
export const setSk = (f: (sk: Record<string, number>, u: CUnit) => void): Effect => ({ setup: (u) => f(u.sk, u) });

// 팔레트: [외곽선, 주색, 보조색, 피부, 바이저, 금속, 하이라이트]
export const PAL = {
  UNI: ['#10131c', '#3b6fd8', '#c9d6f2', '#f0c8a0', '#7fe3ff', '#59606e', '#ffffff'],
  KAL: ['#140c0c', '#a8283a', '#e0b040', '#e8c09a', '#ffd34d', '#6a5a50', '#fff3c0'],
  HEL: ['#0b1614', '#2fa39a', '#e8eef0', '#d8b090', '#b07cff', '#4f6866', '#ffffff'],
  PET: ['#141008', '#e07a1f', '#3a3a40', '#e6bc94', '#7dff8a', '#55555c', '#fff0d0'],
  SIR: ['#14120c', '#ece6d0', '#d4a83a', '#e8c8a8', '#6fb8ff', '#8a8270', '#ffffff'],
  PAN: ['#08141a', '#3fbfa8', '#9a5ad0', '#b88a60', '#ffd84d', '#40505a', '#e8fff8'],
  FAM: ['#0c0c12', '#2c2f44', '#c8ccd8', '#ecd0b8', '#9ad0ff', '#5a5e70', '#ffffff'],
};
/** 같은 세력 안에서 기물마다 색을 조금씩 바꾼다 */
export function tint(base: string[], primary: string, secondary?: string, visor?: string): string[] {
  const p = base.slice();
  p[1] = primary;
  if (secondary) p[2] = secondary;
  if (visor) p[4] = visor;
  return p;
}

