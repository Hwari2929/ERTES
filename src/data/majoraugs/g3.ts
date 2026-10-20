// 메이저 전용 증강 (기물별 14개 = 일반 12 + ★ 전설 2) · 궁극기가 없던 기물의 궁극기. 이 묶음이 맡은 기물만 채운다 (index.ts 가 합친다)
import type { UltDef } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';

export const AUGS: Record<string, AugDef[]> = {};
export const ULTS_X: Record<string, UltDef> = {};
