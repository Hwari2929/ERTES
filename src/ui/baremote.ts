// 바 무대 이모티콘: 말 대신 머리 둘레 둥근 말풍선 속 그림 하나 (선 그림, 명암 없음 — docs/UI.md 26).
// 움직임은 20-bar.css (.bar-emo.on[data-e]) — 점 찍기 · 계단식 기울임 · 크기 숨쉬기 · 물방울 · 툭툭 회전 · Z 오르기 · 잔 부딪힘 · 혀 츄릅. 조각에 붙인 class 를 CSS 가 움직인다.
// 색은 CSS 가 [data-e] 마다 토큰으로 준다 (20-bar.css .bar-emo). 보기 상자 24 × 24.
export type EmoteId = 'dots' | 'excl' | 'q' | 'note' | 'heart' | 'anger' | 'sweat' | 'zzz' | 'idea' | 'yum' | 'cheers' | 'drunk' | 'sparkle';
export const EMOTE_NAME: Record<EmoteId, string> = {
  dots: '말없음', excl: '놀람', q: '갸웃', note: '흥얼', heart: '좋아함', anger: '발끈', sweat: '진땀', zzz: '꾸벅', idea: '번뜩', yum: '맛있음', cheers: '건배', drunk: '취함', sparkle: '반짝',
};
const P: Record<EmoteId, string> = {
  dots: '<circle class="d1" cx="6" cy="13" r="1.8" fill="currentColor"/><circle class="d2" cx="12" cy="13" r="1.8" fill="currentColor"/><circle class="d3" cx="18" cy="13" r="1.8" fill="currentColor"/>',
  excl: '<path d="M12 4 V15" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="12" cy="20" r="1.9" fill="currentColor"/>',
  q: '<path d="M8 8.5 Q8 4 12 4 Q16.5 4 16.5 8 Q16.5 11 13 12.5 Q12 13 12 15.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="20" r="1.8" fill="currentColor"/>',
  note: '<path d="M10 18 V5 L18 3.5 V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><ellipse cx="7.5" cy="18" rx="3.2" ry="2.4" fill="currentColor"/>',
  heart: '<path d="M12 20 Q3 13.5 4 8.5 Q5 4.5 8.6 4.6 Q11 4.8 12 7.4 Q13 4.8 15.4 4.6 Q19 4.5 20 8.5 Q21 13.5 12 20 Z" fill="currentColor"/>',
  anger: '<path d="M4 9 Q9 9 9 4 M15 4 Q15 9 20 9 M20 15 Q15 15 15 20 M9 20 Q9 15 4 15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  sweat: '<path class="drop" d="M12 4 Q17 11 17 14.5 Q17 19.5 12 19.5 Q7 19.5 7 14.5 Q7 11 12 4 Z" fill="currentColor"/>',
  zzz: '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"><path class="z1" d="M16.5 16 H20.5 L16.5 20 H20.5" stroke-width="1.6"/><path class="z2" d="M10 9.5 H15 L10 14.5 H15" stroke-width="1.8"/><path class="z3" d="M3 3 H9 L3 9 H9" stroke-width="2"/></g>',
  idea: '<path d="M12 3.5 Q18 3.5 18 9.5 Q18 12.5 15 14.5 V17 H9 V14.5 Q6 12.5 6 9.5 Q6 3.5 12 3.5 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 20 H14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  yum: '<path d="M5 9 Q7 7 9 9 M15 9 Q17 7 19 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="tongue" d="M12.6 15.6 Q13 19.8 15.6 19.4 Q17.6 18.8 16.6 15.2 Z" fill="currentColor"/><path d="M6 13 Q12 20 18 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cheers: '<path class="gl" d="M3.5 8 L8.5 6.5 L11 16 L6.5 17.5 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path class="gr" d="M20.5 8 L15.5 6.5 L13 16 L17.5 17.5 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path class="ray" d="M12 2.5 V5 M9 3.5 L10 5.2 M15 3.5 L14 5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  drunk: '<path d="M12 12 Q12 10 14 10.5 Q16 11.5 15 14 Q13.5 16.5 10.5 15.5 Q7 14 8 10 Q9.5 6 14 6.5 Q19 7.5 19 12.5 Q18.5 18.5 12 19.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  sparkle: '<path d="M12 2.5 Q13 10.5 21 12 Q13 13.5 12 21.5 Q11 13.5 3 12 Q11 10.5 12 2.5 Z" fill="currentColor"/>',
};
export const emoteSvg = (e: EmoteId) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[e]}</svg>`;

/** 혼자 하는 이모티콘 가중치 (상황: 잔이 있나 · 술인가 · 밤인가) */
export function soloWeights(o: { drink: boolean; alcohol: boolean; night: boolean }): [EmoteId, number][] {
  return [
    ['dots', 3], ['note', 2], ['q', 1], ['excl', 0.8], ['idea', 0.8], ['sparkle', 0.8], ['heart', 0.6], ['sweat', 0.8], ['anger', 0.4],
    ['yum', o.drink ? 3 : 0], ['cheers', o.drink ? 1 : 0], ['drunk', o.drink && o.alcohol && o.night ? 1.4 : o.drink && o.alcohol ? 0.4 : 0], ['zzz', o.night ? 1.2 : 0.3],
  ];
}
/** 둘이 주고받는 이모티콘 (먼저 · 받아서) */
export const EMOTE_PAIRS: [EmoteId, EmoteId][] = [['anger', 'sweat'], ['cheers', 'cheers'], ['note', 'note'], ['excl', 'q'], ['idea', 'excl'], ['q', 'dots'], ['heart', 'sweat'], ['sparkle', 'heart']];
