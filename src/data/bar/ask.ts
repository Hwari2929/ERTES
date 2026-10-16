// 에란테스 바: 공통 질문 '물어보기'. 바에 나올 수 있는 단원 전원(영입 가능 + 사건 전용, 레이첼 제외)에게 같은 질문을 한다.
// 과거 · 꿈 질문은 관계(바에서 말 건 횟수 + 함께 출전한 런)에 따라 깊어진다: 표면(처음) → 이상(관계 3) → 실재(관계 6, 심야).
// 실재 층 답은 로어 문서(lore/인물)가 있는 인물만 둔다. 로어가 없는 인물은 기존 대사 · 소개에서 드러난 성격 안에서만, 회피 · 농담이어도 된다.
//
// 답 형식: 줄을 ' / ' 로 나눈다. 줄 형식은 talk.ts 와 같다 ('대사' · '이름: 대사' · '* 서술').
import { ASK_A } from './ask_a';
import { ASK_B } from './ask_b';

export type AskKey = 'past' | 'food' | 'dream' | 'dayoff' | 'why';
/** [표면, 이상, 실재?] */
export type Tiered = [string, string, string?];
export interface AskSet { past: Tiered; food: string; dream: Tiered; dayoff: string; why: string }

export const ASK_Q: { key: AskKey; label: string; deep: boolean; note: string }[] = [
  { key: 'past', label: '옛날엔 뭐 했어?', deep: true, note: '과거' },
  { key: 'food', label: '좋아하는 음식은?', deep: false, note: '음식' },
  { key: 'dream', label: '꿈이나 목표가 있어?', deep: true, note: '꿈 · 목표' },
  { key: 'dayoff', label: '쉬는 날엔 뭐 해?', deep: false, note: '쉬는 날' },
  { key: 'why', label: '에란테스엔 왜 왔어?', deep: false, note: '합류 이유' },
];
/** 이상 층 답이 열리는 관계 점수 (실재 층은 DEEP_BOND) */
export const ASK_MID = 3;

export const ASK: Record<string, AskSet> = { ...ASK_A, ...ASK_B };
export const askLines = (s: string) => s.split(' / ').map((x) => x.trim()).filter(Boolean);
