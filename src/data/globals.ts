import type { Effect } from '../engine/effects';
import type { RunState } from '../types';

/** 전역 증강: 런 시작 시 + n 페이즈마다 1개 선택 */
export interface GlobalDef {
  id: string;
  name: string;
  desc: string;
  /** 선택 즉시 1회 */
  onPick?: (run: RunState) => void;
  /** 모든 출전 아군에게 */
  team?: Effect;
  unique?: boolean;
}

export const GLOBALS: GlobalDef[] = [
  { id: 'G.funds', name: '전투 자금', desc: '즉시 에너지 크레딧 +25.', onPick: (r) => { r.credits += 25; } },
  { id: 'G.resonance', name: '고속 공명', desc: '전투 후 공명도 풀 +35%.', unique: true },
  { id: 'G.interest', name: '복리의 마법', desc: '이자 상한 +5.', unique: true },
  { id: 'G.armory', name: '무기고 개방', desc: '즉시 무작위 장비 재료 3개 획득.' },
  { id: 'G.squad', name: '대규모 편성', desc: '출전 인원 +1.', unique: true },
  { id: 'G.aim', name: '정밀 조준 프로토콜', desc: '모든 아군 명중 +10%p, 치명타 확률 +8%p.', team: { stats: { acc: 0.1, crit: 0.08 } } },
  { id: 'G.plate', name: '표준 강화 장갑', desc: '모든 아군 방어도 +200, 효과 저항 +10%p.', team: { stats: { armor: 200, effRes: 0.1 } } },
  { id: 'G.cooler', name: '쿨러 오버클럭', desc: '모든 아군 쿨다운 감소 속도 +20%.', team: { stats: { cdr: 0.2 } } },
  { id: 'G.survival', name: '생존 본능', desc: '최대 플레이어 체력 +30 (즉시 회복), 패배 시 받는 피해 -30%.', unique: true,
    onPick: (r) => { r.maxHp += 30; r.hp += 30; } },
  { id: 'G.study', name: '학습 곡선', desc: '공명도 구매 비용 -1, 구매량 +1.', unique: true },
  { id: 'G.scout', name: '인재 스카우트', desc: '영입 노드 선택지 +1, 영입 기물이 공명 등급 +1로 합류.', unique: true },
  { id: 'G.allin', name: '올인', desc: '모든 아군 피해 +20%, 최대 체력 -10%.', team: { mods: [{ kind: 'inc', tag: 'all', v: 0.2 }], pct: { maxHp: -0.1 } } },
];
export const GLOBAL_BY_ID: Record<string, GlobalDef> = Object.fromEntries(GLOBALS.map((g) => [g.id, g]));
