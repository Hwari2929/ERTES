import type { AugDef } from '../engine/effects';
import type { SynergyId } from '../types';
import { SYN_BY_ID } from './synergies';
import { UNITS } from './units';

// 증강은 기물 전용 증강만 (공용 · 시너지 증강 풀은 제거됨)
export const ALL_AUGS: AugDef[] = UNITS.flatMap((u) => u.augs);
export const AUG_BY_ID: Record<string, AugDef> = Object.fromEntries(ALL_AUGS.map((a) => [a.id, a]));

export function augDesc(id: string, param?: string) {
  const a = AUG_BY_ID[id];
  if (!a) return '';
  return param && a.descParam ? a.descParam(param) : a.desc;
}
export function augSource(a: AugDef): string {
  if (a.pool === 'unit') return '전용';
  if (a.pool === 'syn') return SYN_BY_ID[a.owner as SynergyId]?.name || '시너지';
  return '공용';
}
