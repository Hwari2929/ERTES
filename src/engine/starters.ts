// 계약 기물 선택 (새 런 시작 기물 후보): 후보 수 · 전장 우세 시너지 보장 · 새로고침. 화면(main.ts newRunScreen)과 봇 sim(tests/balance.ts) 공용
import { CFG } from '../config';
import { fieldOf } from '../data/battlefields';
import { SYN_BY_ID } from '../data/synergies';
import { UNITS } from '../data/units';
import type { Rng } from '../rng';
import type { SynergyId } from '../types';

/** 시작 기물로 고를 수 있는 기물 (사건 전용 · 시작 불가 기물 제외) */
export const starterIds = () => UNITS.filter((u) => !u.noStarter).map((u) => u.id);
/** 전장이 힘을 실어 주는 시너지 (FieldDef.ally.syn, 없으면 null) */
export const fieldSyn = (field: string | null | undefined): SynergyId | null => (field ? fieldOf(field).ally?.syn ?? null : null);
const hasSyn = (id: string, syn: SynergyId | null) => !!syn && !!UNITS.find((u) => u.id === id && ([...u.factions, ...u.traits] as string[]).includes(syn));
/** 이 후보 풀에서 보장하는 우세 시너지 기물 수: CFG.starterFav 와 그 시너지 첫 단계 인원 중 큰 쪽 (계약 기물만으로 바로 켤 수 있게),
 *  그 시너지를 가진 시작 기물이 더 적으면 있는 만큼 */
export const starterFavNeed = (field: string | null | undefined) => {
  const syn = fieldSyn(field);
  if (!syn || !CFG.starterFav) return 0; // starterFav 0 = 보장 없음 (sim pool0 비교용)
  const first = SYN_BY_ID[syn]?.tiers[0] ?? 0;
  return Math.min(Math.max(CFG.starterFav, first), starterIds().filter((id) => hasSyn(id, syn)).length);
};

/**
 * 시작 기물 후보 CFG.starterPool 명 (시작 기물이 그보다 적으면 전부). 전장 우세 시너지 기물을 starterFavNeed 명 이상 섞는다
 * (무작위로 뽑아 모자라면 우세 시너지가 아닌 후보를 우세 시너지 기물로 바꾼다).
 * keep = 그대로 남길 후보, avoid = 되도록 다시 내지 않을 후보 (새로고침 전 후보 — 모자라면 다시 쓴다).
 * 계약 기물 새로고침(main.ts 'reroll-starters')은 고른 기물을 모두 해제하고 keep 없이 avoid = 직전 후보 전체로 새 풀을 뽑는다
 */
export function starterPool(r: Rng, field: string | null | undefined, keep: string[] = [], avoid: string[] = []): string[] {
  const all = starterIds();
  const syn = fieldSyn(field);
  const n = Math.min(CFG.starterPool, all.length);
  const pool = keep.filter((id) => all.includes(id)).slice(0, n);
  const left = (ids: string[]) => r.shuffle(ids.filter((id) => !pool.includes(id)));
  for (const id of [...left(all.filter((x) => !avoid.includes(x))), ...left(all.filter((x) => avoid.includes(x)))]) { if (pool.length >= n) break; pool.push(id); }
  const need = starterFavNeed(field);
  let have = pool.filter((id) => hasSyn(id, syn)).length;
  if (have < need) {
    const cand = left(all.filter((id) => hasSyn(id, syn))).sort((a, b) => +avoid.includes(a) - +avoid.includes(b)); // 새 얼굴 먼저
    const slots = r.shuffle(pool.map((_, i) => i).filter((i) => !keep.includes(pool[i]) && !hasSyn(pool[i], syn)));
    while (have < need && cand.length && slots.length) { pool[slots.pop()!] = cand.shift()!; have++; }
  }
  return r.shuffle(pool);
}
