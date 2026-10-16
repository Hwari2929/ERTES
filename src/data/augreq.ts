// 증강 카드 · 상세의 부가 정보: 조합 조건 (AugDef.requires) 과 선택하면 포기하는 배타 증강 (AugDef.excl).
// 현재 값은 엔진과 같은 계산(psinum.psiStackCap · 기물 무기)으로 구한다. 선택은 막지 않는다.
import type { AugReq } from '../engine/effects';
import { AUG_BY_ID } from './augments';
import { psiHas } from './psiinfo';
import { psiStackCap } from './psinum';
import { UNIT_BY_ID } from './units';

const ST_NAME: Record<NonNullable<AugReq['stacks']>['st'], string> = { burn: '연소', chill: '오한', conduct: '전도', poison: '중독', scent: '향취', tempgear: '임시 장비' };
const nameOf = (id: string) => AUG_BY_ID[id]?.name || id;

export interface ReqState {
  hint: string;
  /** 현재 값 설명 (기물이 없으면 기본값 기준) */
  cur: string;
  /** true 충족 · false 미충족 (경고색) · null 안내만 (전투 중 상태에 달림) */
  ok: boolean | null;
}
/**
 * 조합 조건 상태. u = 이 증강을 받을 기물 (없으면 기본값 기준, 도감).
 * extra = 아직 보유하지 않았지만 함께 계산할 증강 (이 증강 자신 등).
 */
export function augReqState(id: string, u?: { defId: string; augments: readonly { id: string }[] } | null): ReqState | null {
  const r = AUG_BY_ID[id]?.requires;
  if (!r) return null;
  const owned = (u?.augments || []).map((a) => a.id);
  const has = psiHas(owned), hasId = (x: string) => owned.includes(x);
  if (r.stacks) {
    const cap = psiStackCap(r.stacks.st, has);
    const unit = r.stacks.st === 'tempgear' ? '개' : '중첩';
    return { hint: r.hint, cur: `${u ? '현재 자신의' : '기본'} 최대 ${ST_NAME[r.stacks.st]}: ${cap}${unit}`, ok: cap >= r.stacks.need };
  }
  if (r.breaks || r.alt) {
    const broken = (r.breaks || []).filter(hasId);
    const alt = (r.alt || []).filter(hasId);
    // breaks 가 정의돼 있으면 기본 수단이 있다 → 깨지지 않았으면 충족. breaks 가 없으면 alt 를 가져야 충족
    const ok = r.breaks ? !broken.length || alt.length > 0 : alt.length > 0;
    const cur = alt.length ? `보유: ${alt.map(nameOf).join(' · ')}` : broken.length ? `「${broken.map(nameOf).join(' · ')}」 보유로 기본 수단 없음` : r.breaks ? '기본 수단 있음' : `자신에게는 없음${r.alt?.length ? ` (${r.alt.map(nameOf).join(' · ')})` : ''}`;
    return { hint: r.hint, cur, ok };
  }
  if (r.weapon) {
    const w = u ? UNIT_BY_ID[u.defId]?.weapon : null;
    const kind = w?.kind === 'mag' ? '탄창' : w?.kind === 'combo' ? '콤보' : w ? '기본 공격 없음' : '';
    return { hint: r.hint, cur: w ? `현재 무기: ${w.name} (${kind})` : '기물마다 다름', ok: w ? w.kind === r.weapon : null };
  }
  return { hint: r.hint, cur: '전투 중 이성에 따라 켜지고 꺼짐', ok: null };
}

/** 선택하면 포기하는 증강: 이번 창의 다른 후보 + 같은 풀에서 앞으로 나올 수 있는 것 (보유 증강과 충돌하는 후보는 애초에 제시되지 않는다) */
export function augForgo(id: string, owned: readonly string[], window: readonly string[]): { now: string[]; later: string[] } {
  const a = AUG_BY_ID[id];
  if (!a) return { now: [], later: [] };
  const clash = (x: string) => !!(a.excl?.includes(x) || AUG_BY_ID[x]?.excl?.includes(id));
  const all = new Set([...(a.excl || []), ...Object.values(AUG_BY_ID).filter((x) => x.excl?.includes(id)).map((x) => x.id)]);
  const now = window.filter((x) => x !== id && clash(x));
  const later = [...all].filter((x) => !now.includes(x) && !owned.includes(x) && AUG_BY_ID[x]);
  return { now: now.map(nameOf), later: later.map(nameOf) };
}
