// 메이저 전용 증강 · 추가 궁극기 모음. 기물 정의(units.ts)의 specialAugs 뒤에 붙고, ULTS(ults.ts)에 합쳐진다
import type { UltDef } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import * as g1 from './g1';
import * as g2 from './g2';
import * as g3 from './g3';
import * as g4 from './g4';
import * as g5 from './g5';

const GROUPS = [g1, g2, g3, g4, g5];
export const MAJOR_EXTRA_AUGS: Record<string, AugDef[]> = Object.assign({}, ...GROUPS.map((g) => g.AUGS));
export const EXTRA_ULTS: Record<string, UltDef> = Object.assign({}, ...GROUPS.map((g) => g.ULTS_X));
