// 업적 판정 입력 만들기 (순수): 런 · 전투 · 메타 기록을 data/achievements.ts 의 사실(AchFact) 하나로 요약한다.
// 화면 · 저장 · 알림은 ui/achieve.ts 가 맡는다. 검사: tests/achieve_check.ts
import type { AchFact } from '../data/achievements';
import { runEffDiff } from '../data/difficulty';
import { ENEMY_BY_ID } from '../data/enemies';
import type { Battle } from './combat';
import type { Meta } from '../ui/meta';
import type { RunState } from '../types';

/** 전투 끝 (보상 처리 전에 부른다: 노드 · 페이즈 · 연승은 이 전투 기준) */
export function battleFact(run: RunState, b: Battle): AchFact {
  const won = b.winner === 0;
  const allies = b.units.filter((c) => c.side === 0 && !!c.src && !c.isSummon)
    .map((c) => ({ id: c.defId, items: c.src!.items.filter((x): x is string => !!x), alive: c.alive }));
  return { k: 'battle', won, node: run.node?.type || 'battle', phase: run.phase, endless: !!run.endless, tutorial: !!run.tutorial, allies, fleet: run.fleet ?? 0, streak: won ? Math.max(1, run.streak + 1) : 0 };
}
/** 사건 선택지 확정 뒤 (outcome = run.ts lastOutcome) */
export const eventFact = (run: RunState, id: string, choice: number, outcome: string): AchFact => ({ k: 'event', id, choice, outcome, tutorial: !!run.tutorial });
/** 의뢰 성공 (diff = 실효 위험 등급: 고난 + 절망 서약이면 절망 수치만큼 오른 표기 등급) */
export const clearFact = (run: RunState): AchFact => ({
  k: 'clear', tutorial: !!run.tutorial, diff: runEffDiff(run), hp: run.hp, losses: run.stats.losses, skips: run.ach?.skip || 0, units: run.units.map((u) => u.defId),
});
/** 튜토리얼 끝 */
export const tutorialFact = (run: RunState | null, done: boolean): AchFact => ({ k: 'tutorial', done, skips: run?.ach?.skip || 0 });
/** 소모품 사용 성공 뒤: 적에게 쓴 소모품이면 그 적 (강제 징수기 = 장비를 떼어 냈다) · 방금 보관함에 들어온 장비 */
export function useFact(run: RunState, item: string, foeIndex: number | null, got: string | null): AchFact {
  const s = foeIndex === null ? null : run.node?.enc?.enemies[foeIndex];
  return { k: 'use', item, foe: s ? ENEMY_BY_ID[s.defId]?.tier : undefined, got: got || undefined };
}
/** 메타 기록 */
export function metaFact(m: Meta): AchFact {
  const fs = Object.entries(m.fields || {});
  return {
    k: 'meta', clears: m.clears || 0,
    fieldsCleared: fs.filter(([, f]) => f.clears > 0).map(([id]) => id),
    bestDiff: Math.max(-1, ...fs.filter(([, f]) => f.clears > 0).map(([, f]) => f.bestDiff)),
    events: Object.values(m.events || {}).filter((n) => n > 0).length,
    barSeen: m.bar?.seen?.length || 0,
  };
}
/** 장면(미연시)을 건너뛰었다: 이번 런 기록에 센다 (바 장면은 런과 상관없음) */
export function countSkip(run: RunState | null, key: string) {
  if (!run || key.startsWith('bar:')) return;
  run.ach = { ...run.ach, skip: (run.ach?.skip || 0) + 1 };
}
