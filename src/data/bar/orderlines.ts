// 바 주문 · 반응 대사 (docs/BAR_OPS.md 4절). 주문 말풍선 한 줄 + 잔을 받아 한 모금 마신 뒤 반응 한 줄.
// {feel} = 느낌 조건 문구 (부사형으로 끝난다: '달고 청량하게, 시트러스 향 나게'), {menu} = 메뉴 이름 (조사는 fillText 가 맞춘다).
// hint = 밤에 '늘 마시던 거'를 시켰는데 레이첼이 아직 그 잔을 모를 때 손님이 흘리는 귀띔.
import type { OrderStyle } from './drinks';
import type { Grade } from './orders';
import { ORDER_TALK_A } from './orderlines_a';
import { ORDER_TALK_B } from './orderlines_b';

export type OrderTalk = Record<OrderStyle, string[]> & Record<Grade, string[]> & { hint: string };

/** 대사가 따로 없는 단원 (정규 단원 밖) */
export const ORDER_GENERIC: OrderTalk = {
  vague: ['{feel} 한 잔 부탁해요.', '오늘은 {feel} 마시고 싶네요.'],
  photo: ['이거, 사진이랑 똑같이 되나요?', '이렇게 생긴 걸로 한 잔 주세요.'],
  name: ['{menu} 하나 주세요.', '{menu}으로 부탁해요.'],
  usual: ['늘 마시던 걸로요.', '평소에 마시던 거 주세요.'],
  hint: '에이든 씨는 보통 {menu}를 주던데요.',
  like: ['와, 이거 맛있네요.', '딱 원하던 맛이에요.'],
  ok: ['음, 나쁘지 않네요.', '괜찮아요. 마실 만해요.'],
  bad: ['…생각한 맛이랑은 좀 다르네요.', '음. 그래도 다 마실게요.'],
};
/** 정규 단원 25명 (에이든 제외) */
export const ORDER_TALK: Record<string, OrderTalk> = { ...ORDER_TALK_A, ...ORDER_TALK_B };
export const orderTalk = (id: string): OrderTalk => ORDER_TALK[id] || ORDER_GENERIC;
