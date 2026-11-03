// 바 낯선 손님 × 에이든 만담 (낮, 에이든과 그 손님이 함께 무대에 있을 때 — src/ui/bar.ts). 손님 40명 × 3편 (art/guests/_aiden_pick.json, 지침 art/guests/_aiden_brief.md).
// 줄: '에이든: …' = 에이든 · '레이첼: …' = 레이첼(무대 밖) · 이름표 없는 줄 = 그 손님. named = 손님이 이름을 밝힌 뒤에만 (이름 · 사연이 드러나는 편)
import { GUEST_AIDEN_A } from './guestaiden/a';
import { GUEST_AIDEN_B } from './guestaiden/b';
import { GUEST_AIDEN_C } from './guestaiden/c';

export interface GuestAidenTalk { sit: string; lines: string[]; named?: boolean; props?: string[] }
/** 손님 id → 에이든과의 만담 3편 */
export const GUEST_AIDEN: Record<string, GuestAidenTalk[]> = { ...GUEST_AIDEN_A, ...GUEST_AIDEN_B, ...GUEST_AIDEN_C };
