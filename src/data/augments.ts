import type { AugDef } from '../engine/effects';
import type { SynergyId } from '../types';
import { SYN_BY_ID } from './synergies';
import { MAJOR_AUGS, PSI_AUGS } from './rework';
import { UNITS } from './units';

// 증강: 메이저 공용 · 스페셜 전용 · 사이오닉 전공 (기물 개별 증강은 폐지)
export const ALL_AUGS: AugDef[] = [...UNITS.flatMap((u) => u.specialAugs || []), ...MAJOR_AUGS, ...PSI_AUGS];
export const AUG_BY_ID: Record<string, AugDef> = Object.fromEntries(ALL_AUGS.map((a) => [a.id, a]));

export function augDesc(id: string, param?: string) {
  const a = AUG_BY_ID[id];
  if (!a) return '';
  return param && a.descParam ? a.descParam(param) : a.desc;
}
export function augSource(a: AugDef): string {
  if (a.pool === 'unit') return '전용';
  if (a.pool === 'major') return '메이저';
  if (a.pool === 'special') return '스페셜';
  if (a.pool === 'psionic') return '사이오닉';
  if (a.pool === 'syn') return SYN_BY_ID[a.owner as SynergyId]?.name || '시너지';
  return '공용';
}
