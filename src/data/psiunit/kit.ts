// 사이오닉 기물 전용 전공 증강: 기물마다 학파의 전공 2개 × 3개 (레이첼은 전공 8개 × 3개).
// pool 'psionic' · owner = 전공 (그 전공을 고른 그 기물에게만, 공용 전공 증강과 같은 확률로 섞인다 — run.ts psiPool)
// id = psi.<전공>.<기물>.<키> (공용 전공 증강 psi.<전공>.<키> 와 구분: 4마디)
import type { AugDef, AugReq, Effect } from '../../engine/effects';
import type { SchoolId } from '../schools';

export const puId = (unit: string, school: SchoolId, key: string) => `psi.${school}.${unit}.${key}`;
/** 기물 전용 전공 증강이면 그 기물 id */
export const psiUnitOf = (id: string): string | null => { const p = id.split('.'); return p[0] === 'psi' && p.length === 4 ? p[2] : null; };
/** 기물 전용 전공 증강 하나. 보유 표시 플래그 mem['pu.<기물>.<키>'] = 1 (setup) */
export function pu(unit: string, school: SchoolId, key: string, name: string, desc: string, effect: Effect, requires?: AugReq): AugDef {
  return {
    id: puId(unit, school, key), name, desc, pool: 'psionic', owner: school, requires,
    effect: () => ({ ...effect, setup: (u, b, ctx) => { u.mem[`pu.${unit}.${key}`] = 1; effect.setup?.(u, b, ctx); } }),
  };
}
