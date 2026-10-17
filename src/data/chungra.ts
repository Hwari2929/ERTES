// 청라공국 · 공왕 무휼: 인과율 · 인과 단계 · 전용 장비 (수치 표 한 곳).
//  · 청라공국 시너지(3/5/7/9)가 켜져 있으면 전투 시작 때 공왕 무휼이 소환된다 (출전 칸을 쓰지 않음, 편성 화면에 두지 않고 전투 시작 때 아군 진영 뒷줄 가운데 빈칸에 나타난다 — engine/build.ts CHR_HOOK).
//  · 무휼은 공명도를 받지 않는다. 승리한 전투마다 인과율을 모아 인과 단계(1~10)로 성장한다.
//    1회 수집량 = (기본 + 장비 점수 ÷ 나눔) × 청라 단계 배율 (반올림). 장비 점수 = 출전 아군이 장착한 장비 (재료 1 · 고급 · 희귀 2 · 전설 4).
//  · 청라 단계가 3명 아래로 내려가도 쌓은 인과율은 남는다 (RunState.causal).
//  · 전용 장비 3종은 청라 3 · 5 · 7명(1 · 2 · 3단계)에 처음 닿으면 해금되어 무휼에게 자동 장착된다 (RunState.chrTier, 일반 장비 장착 불가).
import type { RunState } from '../types';

export const CAUSAL = {
  /** 청라 단계별 수집 배율 (0단계 = 수집 없음) */
  mult: [0, 1, 2, 3, 6],
  /** 기본 수집량 · 장비 점수 나눔 */
  base: 2, gearDiv: 4,
  /** 장비 점수: 재료 · 고급 · 희귀 · 전설 (고유 장비 중 전설 등급 포함). 개조부품 · 포탑 장비 · 임시 장비 · 잡동사니 · 무휼 전용 장비는 세지 않는다 */
  gearPts: { C: 1, G: 2, A: 2, L: 4 } as Record<string, number>,
  /** n단계 누적 인과율 = k × (n − 1)² */
  k: 9,
  max: 10,
};
/** n단계에 필요한 누적 인과율 */
export const causalNeed = (n: number) => Math.round(CAUSAL.k * Math.pow(Math.max(0, n - 1), 2));
/** 쌓은 인과율 → 인과 단계 (1~10) */
export function causalStage(pts: number): number {
  let n = 1;
  while (n < CAUSAL.max && pts >= causalNeed(n + 1)) n++;
  return n;
}
/** 다음 단계까지 남은 인과율 (최고 단계면 0) */
export const causalLeft = (pts: number) => { const n = causalStage(pts); return n >= CAUSAL.max ? 0 : causalNeed(n + 1) - pts; };

/** 무휼 전용 장비 (청라 1 · 2 · 3단계 = 3 · 5 · 7명에 해금). 효과는 data/items.ts UNIQUE */
export const KING_GEAR = ['U_mh_seal', 'U_mh_bow', 'U_mh_sword'];
/** 전용 장비 이름 (items.ts 와 시너지 단계 문구가 함께 읽는다) */
export const KING_GEAR_NAME: Record<string, string> = { U_mh_seal: '공왕의 인장', U_mh_bow: '청옥궁', U_mh_sword: '창청수령검' };
export const isKingGear = (id: string | null | undefined) => !!id && KING_GEAR.includes(id);
/** 해금된 전용 장비 (지금까지 도달한 최고 청라 단계 기준) */
export const kingGearOf = (tier: number) => KING_GEAR.slice(0, Math.max(0, Math.min(3, tier)));

/** 장비 하나의 점수 */
export function gearPoint(id: string | null | undefined): number {
  if (!id || isKingGear(id)) return 0;
  const t = id[0];
  if (id.startsWith('U_')) return CAUSAL.gearPts.L; // 고유 장비 (아문센 그늘 등) = 전설
  if (t === 'C' || t === 'G' || t === 'A' || t === 'L') return CAUSAL.gearPts[t] || 0;
  return 0; // 개조부품(M_ · O_) · 포탑 장비(T_) · 잡동사니(J_) · 소모품
}
/** 출전 아군이 장착한 장비 점수 */
export function gearScore(run: RunState): number {
  return run.units.filter((u) => u.pos).reduce((s, u) => s + u.items.reduce((a, it) => a + gearPoint(it), 0), 0);
}
/** 승리 1회의 인과율 (기본 몫 · 장비 몫, 둘 다 배율 적용 후). tier = 청라 단계 */
export function causalGain(run: RunState, tier: number): { total: number; gear: number; score: number } {
  const m = CAUSAL.mult[Math.min(CAUSAL.mult.length - 1, tier)] || 0;
  const score = gearScore(run);
  if (!m) return { total: 0, gear: 0, score };
  const total = Math.round((CAUSAL.base + score / CAUSAL.gearDiv) * m);
  const base = Math.round(CAUSAL.base * m);
  return { total, gear: Math.max(0, total - base), score };
}

/** 인과 단계별 성장: 모든 주요 능력치 가산 · 위력 성장 등급(공명 등급 대신) · 주는 피해 증가 · 최대 체력 증가 */
export const KING = {
  maj: (n: number) => 3 * (n - 1) + (n >= 10 ? 6 : 0),
  rank: (n: number) => 1 + 3 * (n - 1),
  dmg: (n: number) => 0.12 * (n - 1) + (n >= 10 ? 0.3 : 0),
  hp: (n: number) => 0.08 * (n - 1),
  /** 지휘관: 전술 위력 증가 (스킬 · 궁극기가 전술 위력을 쓰므로) */
  tac: (n: number) => 0.15 * (n - 1),
  /** 공왕 시너지 자체: 무휼 전술 위력 +100% (인과 단계와 별도로 더함) */
  tacBase: 1.0,
  /** 기술 강화 이정표 (인과 단계) */
  ms: [4, 7, 10],
};
export const KING_MS_TEXT = [
  '4단계 [기록 확산]: 천명 기록이 대상 주변 1칸에도 맞는다.',
  '7단계 [되풀이된 기록]: 천명 기록을 두 번 쏘고 (두 번째 70%), [기록] 표식이 받는 피해 +25%로 오른다.',
  '10단계 [마지막 공왕]: 천명 기록 피해 ×1.5, 쓰러진 [기록] 대상마다 쿨다운 50% 환급, 모든 아군 피해 +15%.',
];
/** 단계 줄 설명 (도감 · 상세) */
export function kingStageText(n: number) {
  return `모든 주요 능력치 +${KING.maj(n)} · 위력 성장 ${KING.rank(n)}등급 상당 · 주는 피해 +${Math.round(KING.dmg(n) * 100)}% · 최대 체력 +${Math.round(KING.hp(n) * 100)}% · 전술 위력 +${Math.round((KING.tacBase + KING.tac(n)) * 100)}% (공왕 +${Math.round(KING.tacBase * 100)}% 포함)`;
}
