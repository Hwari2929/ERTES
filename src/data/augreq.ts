// 증강 카드 · 상세의 부가 정보: 조합 조건 (AugDef.requires). 배타 증강은 없다 (어떤 조합도 함께 작동, ★ 전설 전공 증강 포함).
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
 */
export function augReqState(id: string, u?: { defId: string; augments: readonly { id: string }[] } | null): ReqState | null {
  const r = AUG_BY_ID[id]?.requires;
  if (!r) return null;
  const owned = (u?.augments || []).map((a) => a.id);
  const has = psiHas(owned), hasId = (x: string) => owned.includes(x);
  if (r.stacks) {
    const cap = psiStackCap(r.stacks.st, has);
    const unit = r.stacks.st === 'tempgear' ? '개' : '중첩';
    return { hint: r.hint, cur: `${u ? '현재 자신의' : '기본'} 최대 ${ST_NAME[r.stacks.st]}: ${cap === Infinity ? '제한 없음 (끝없는 번식)' : `${cap}${unit}`}`, ok: cap >= r.stacks.need };
  }
  if (r.alt) {
    const alt = r.alt.filter(hasId);
    return { hint: r.hint, cur: alt.length ? `보유: ${alt.map(nameOf).join(' · ')}` : `자신에게는 없음 (${r.alt.map(nameOf).join(' · ')})`, ok: alt.length > 0 };
  }
  if (r.weapon) {
    const w = u ? UNIT_BY_ID[u.defId]?.weapon : null;
    const kind = w?.kind === 'mag' ? '탄창' : w?.kind === 'combo' ? '콤보' : w ? '기본 공격 없음' : '';
    return { hint: r.hint, cur: w ? `현재 무기: ${w.name} (${kind})` : '기물마다 다름', ok: w ? w.kind === r.weapon : null };
  }
  return { hint: r.hint, cur: '전투 중 이성에 따라 켜지고 꺼짐', ok: null };
}
