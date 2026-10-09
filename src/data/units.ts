// 기물 명단 (39명). 데이터는 세력별 파일에 나뉘어 있다.
import { ROSTER_A } from './rosterA';
import { ROSTER_B } from './rosterB';
import { ROSTER_C } from './rosterC';
import type { UnitDef } from './unitkit';

export type { UnitDef };
export const UNITS: UnitDef[] = [...ROSTER_A, ...ROSTER_B, ...ROSTER_C];
export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
