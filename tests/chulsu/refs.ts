// 철수 봇 실측 생성기(profile_gen.ts · augprofile_gen.ts) 공용: 기준 아군 3명 고르기 (공개 정보 = 기물 · 시너지 정의만).
//  - 묶음 안에서 시너지가 겹치지 않는다 (겹치면 기준 전투부터 시너지가 켜진다: 예전 묶음 주성 · 케빈 · 게베크는 엔지니어 2명이라 감시 포탑이 늘 있었다).
//  - 지휘관이 아니고, 1명부터 켜지는 범은하 공동체 · 우리의 출항기! 구성원이 아니다 (X 가 같은 시너지면 X 쪽 단계가 바뀐다). 첫 기물(앞줄)은 돌격가.
//  기물 X 마다 X 가 들지 않고 'X 가 더해져 단계가 바뀌는 시너지'가 없는 묶음 전부를 쓴다 (실측은 묶음 × 시드 평균: 묶음 하나만 쓰면 기여가 그 묶음에 크게 좌우된다,
//  예: 예레나 공명 4 · 3페이즈 기여가 주성 · 케빈 · 게베크 57 / 주성 · 케빈 · 윈터 16). 지금 명단에서는 모든 기물이 그런 묶음을 2개 이상 받는다 (checkRefs 가 확인).
import { UNITS, UNIT_BY_ID } from '../../src/data/units';
import { tierOf } from '../../src/data/synergies';
import type { SynergyId } from '../../src/types';

export const REF_TRIOS = [['juseong', 'falcon', 'winter'], ['kyle', 'argon', 'mirinae'], ['aiden', 'gebek', 'fotini'], ['gayoung', 'yelena', 'sarma'], ['juseong', 'fotini', 'orca']];
const memOf = (id: string) => [...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[];

/** [X 가 더해져 단계가 바뀌는 시너지 수, 소속 겹침 수] */
export function refOverlap(id: string, trio: string[]): [number, number] {
  let act = 0, raw = 0;
  for (const s of memOf(id)) {
    const n = trio.filter((r) => memOf(r).includes(s)).length;
    if (!n) continue;
    raw++;
    if (tierOf(s as SynergyId, n + 1) !== tierOf(s as SynergyId, n)) act++;
  }
  return [act, raw];
}
/** 기물 X 의 기준 아군 묶음들 (X 가 들지 않고 시너지 단계가 바뀌지 않는 묶음) */
export const refsFor = (id: string): string[][] => REF_TRIOS.filter((t) => !t.includes(id) && !refOverlap(id, t)[0]);
/** 묶음 규칙 확인 (생성기 시작 때): 묶음 안 겹침 · 지휘관 · 1명 시너지 · 앞줄 돌격가, 실측 기물마다 단계가 바뀌지 않는 묶음 */
export function checkRefs() {
  for (const t of REF_TRIOS) {
    const seen = new Set<string>();
    for (const r of t) {
      const d = UNIT_BY_ID[r];
      if (!d || d.ctype === 'CMD') throw new Error(`기준 아군 ${r}: 없거나 지휘관`);
      for (const m of memOf(r)) { if (seen.has(m) || m === 'PAN' || m === 'VOYAGE') throw new Error(`기준 아군 ${t.join()}: ${m} 겹침 · 1명 시너지`); seen.add(m); }
    }
    if (UNIT_BY_ID[t[0]].ctype !== 'VAN') throw new Error(`기준 아군 ${t.join()}: 첫 기물이 돌격가가 아님`);
  }
  for (const u of UNITS) if (!u.king && !u.inert && refsFor(u.id).length < 2) throw new Error(`기준 아군: ${u.id} 는 시너지 단계가 바뀌지 않는 묶음이 2개 미만 (REF_TRIOS 를 늘린다)`);
}
