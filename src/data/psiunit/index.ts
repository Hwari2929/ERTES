// 사이오닉 기물 전용 전공 증강 모음 (기물별 파일 → 한 목록)
import type { AugDef } from '../../engine/effects';
import { AUGS as YELENA } from './yelena';
import { AUGS as HIIRO } from './hiiro';
import { AUGS as NADIR } from './nadir';
import { AUGS as ZEPHYRO } from './zephyro';
import { AUGS as ROMANI } from './romani';
import { AUGS as JOSHUA } from './joshua';
import { AUGS as ONYX } from './onyx';
import { AUGS as RACHEL } from './rachel';
import { AUGS as ZINA } from './zina';
import { AUGS as HANA } from './hana';
import { AUGS as GUNGO } from './gungo';
import { AUGS as MINOS } from './minos';

export const PSI_UNIT_AUGS: AugDef[] = [...YELENA, ...HIIRO, ...NADIR, ...ZEPHYRO, ...ROMANI, ...JOSHUA, ...ONYX, ...RACHEL, ...ZINA, ...HANA, ...GUNGO, ...MINOS];
export { psiUnitOf } from './kit';
