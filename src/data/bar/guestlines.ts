// 바 낯선 손님 대사 (명부 art/guests/<group>.json → src/data/bar/guests.gen.ts, 지침 art/guests/_lines_brief.md).
// 이름 밝히기 전에는 enter · 주문 · 반응 · drop · leave · mono 앞 3줄만, 이름을 밝힌 뒤에는 mono 뒤 3줄 · topics 가 더해진다.
// {feel} · {menu} 자리 표시는 src/data/bar/orderlines.ts 와 같다.
import type { OrderStyle } from './drinks';
import type { Grade } from './orders';
import { GUEST_LINES_ALLIANCE } from './guestlines/alliance';
import { GUEST_LINES_EMPIRE } from './guestlines/empire';
import { GUEST_LINES_PAN } from './guestlines/pan';
import { GUEST_LINES_PETRA } from './guestlines/petra';
import { GUEST_LINES_TOUR } from './guestlines/tour';
import { GUEST_LINES_UNION } from './guestlines/union';

export type GuestLines = Record<OrderStyle, string[]> & Record<Grade, string[]> & {
  /** 들어와 앉으며 혼잣말 */
  enter: string[];
  /** 이름 밝히기 전, 머리 위 표시와 함께 레이첼에게 먼저 거는 한마디 */
  call: string[];
  hint: string;
  drop: string[];
  leave: string[];
  /** 혼잣말 6줄: 앞 3줄은 처음부터, 뒤 3줄은 이름을 밝힌 뒤 */
  mono: string[];
  /** 이름을 밝히는 대화 ('레이첼: …' · '* 서술' · 이름표 없는 줄 = 그 손님) */
  meet: string[];
  /** 이름을 밝힌 뒤 말 걸기 화제 2편 */
  topics: { label: string; lines: string[] }[];
};

/** 손님 id → 대사 (세력별 파일 src/data/bar/guestlines/<세력>.ts) */
export const GUEST_LINES: Record<string, GuestLines> = { ...GUEST_LINES_UNION, ...GUEST_LINES_EMPIRE, ...GUEST_LINES_ALLIANCE, ...GUEST_LINES_PETRA, ...GUEST_LINES_PAN, ...GUEST_LINES_TOUR };
