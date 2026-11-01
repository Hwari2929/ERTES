// 바 무대 카운터 위 소품: 만담 머리줄 〔소품: 이름〕 (docs/BANTER.md) → 그 장면 동안 말하는 사람 앞 카운터에 놓인다.
// 소품 이름(80여 종, 대부분 한 번씩)을 종류별 아이콘 한 벌로 묶는다. 잔 종류는 음료 그림(drinkart)으로 그린다. 누르면 이름이 뜬다 (잔과 같은 꼬리표).
// 그림은 한 색 면 · 선 (docs/UI.md 26), 보기 상자 24 × 24.
import { RECIPE_BY_ID } from '../data/bar/drinks';
import { drinkSvg } from './drinkart';

const S = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const L = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
const ICON: Record<string, string> = {
  paper: S(`<path d="M6 3 H15 L19 7 V21 H6 Z" fill="#efe9dc" stroke="#8a8170" stroke-width="1"/><path d="M15 3 V7 H19" fill="none" stroke="#8a8170" stroke-width="1"/><path d="M8.5 10 H16.5 M8.5 13 H16.5 M8.5 16 H14" stroke="#9a9180" stroke-width="1"/>`),
  book: S(`<path d="M4 5 Q8 3.5 12 5.5 Q16 3.5 20 5 V19 Q16 17.5 12 19.5 Q8 17.5 4 19 Z" fill="#6b4a33" stroke="#3d2a1d" stroke-width="1"/><path d="M12 5.5 V19.5" stroke="#d9c7a6" stroke-width="1"/>`),
  sign: S(`<path d="M4 7 H20 V15 H4 Z" fill="#efe9dc" stroke="#8a8170" stroke-width="1"/><path d="M7 15 L5 20 M17 15 L19 20" stroke="#6b5a45" stroke-width="1.4"/><path d="M7.5 11 H16.5" stroke="#9a9180" stroke-width="1.2"/>`),
  plate: S(`<ellipse cx="12" cy="16" rx="9" ry="3.2" fill="#e9e4da" stroke="#8a8170" stroke-width="1"/><path d="M7.5 15 Q8 10 12 10 Q16 10 16.5 15 Z" fill="#c9895a"/>`),
  bowl: S(`<path d="M3.5 11 H20.5 Q20 19 12 19 Q4 19 3.5 11 Z" fill="#e9e4da" stroke="#8a8170" stroke-width="1"/><path d="M6 11 Q12 8 18 11" fill="#e8b95a"/>`),
  pot: S(`<path d="M5 9 H19 V17 Q19 20 16 20 H8 Q5 20 5 17 Z" fill="#5a5f66" stroke="#2d3036" stroke-width="1"/><path d="M3 10 H5 M19 10 H21 M9 9 V7 H15 V9" ${L}/>`),
  bottle: S(`<path d="M10 3 H14 V7 Q17 8.5 17 12 V20 Q17 21 16 21 H8 Q7 21 7 20 V12 Q7 8.5 10 7 Z" fill="#3f6b4a" stroke="#22382a" stroke-width="1"/><path d="M8.5 13 H15.5 V17 H8.5 Z" fill="#efe9dc"/>`),
  jar: S(`<path d="M7 6 H17 V8 Q19 9 19 11 V19 Q19 21 17 21 H7 Q5 21 5 19 V11 Q5 9 7 8 Z" fill="#c98a3a" stroke="#6b4a1f" stroke-width="1"/><path d="M6.5 4 H17.5 V6 H6.5 Z" fill="#8a3b2a"/><path d="M7 13 H17 V17 H7 Z" fill="#efe9dc"/>`),
  vial: S(`<path d="M10 3 H14 V9 L17 17 Q18 21 14 21 H10 Q6 21 7 17 L10 9 Z" fill="#9fd1c9" fill-opacity=".7" stroke="#4e7d76" stroke-width="1"/><path d="M9.5 3 H14.5" stroke="#4e7d76" stroke-width="1.6"/>`),
  tool: S(`<path d="M14.5 3.5 A4.5 4.5 0 0 0 10.6 9.6 L3.8 16.4 Q3 17.2 3.8 18 L6 20.2 Q6.8 21 7.6 20.2 L14.4 13.4 A4.5 4.5 0 0 0 20.5 9.5 L17.6 12.1 L14.9 11.1 L13.9 8.4 L16.5 5.5 Q15.6 3.4 14.5 3.5 Z" fill="#9aa3ad" stroke="#4d545c" stroke-width="1"/>`),
  holo: S(`<path d="M5 4 H19 V15 H5 Z" fill="#5fc9e8" fill-opacity=".35" stroke="#5fc9e8" stroke-width="1.2"/><path d="M8 8 H16 M8 11 H13" stroke="#5fc9e8" stroke-width="1"/><path d="M9 21 L12 15 L15 21 Z" fill="#4d545c"/>`),
  phone: S(`<path d="M7.5 3 H16.5 Q17.5 3 17.5 4 V20 Q17.5 21 16.5 21 H7.5 Q6.5 21 6.5 20 V4 Q6.5 3 7.5 3 Z" fill="#2d3036" stroke="#111" stroke-width="1"/><path d="M8 5 H16 V18 H8 Z" fill="#5fc9e8" fill-opacity=".6"/>`),
  camera: S(`<path d="M3 8 H8 L9.5 5.5 H14.5 L16 8 H21 V19 H3 Z" fill="#3a3f46" stroke="#16181b" stroke-width="1"/><circle cx="12" cy="13.5" r="4" fill="#8fa3b5" stroke="#16181b" stroke-width="1"/>`),
  machine: S(`<path d="M5 3 H19 V21 H5 Z" fill="#4d545c" stroke="#24282d" stroke-width="1"/><path d="M8 6 H16 V9 H8 Z" fill="#9aa3ad"/><path d="M9.5 15 H14.5 V19 H9.5 Z" fill="#efe9dc"/><path d="M12 9 V14" stroke="#24282d" stroke-width="1.2"/>`),
  flower: S(`<path d="M12 21 V12" stroke="#4f8a47" stroke-width="1.4"/><path d="M12 13 Q8 11 9 8" fill="none" stroke="#4f8a47" stroke-width="1.2"/><circle cx="12" cy="8" r="2" fill="#f2d26b"/><circle cx="9" cy="7" r="2.2" fill="#e89ab0"/><circle cx="15" cy="7" r="2.2" fill="#e89ab0"/><circle cx="12" cy="4.6" r="2.2" fill="#e89ab0"/><circle cx="12" cy="10.2" r="2" fill="#e89ab0"/><path d="M8 17 H16 L15 21 H9 Z" fill="#8a5a3a"/>`),
  game: S(`<path d="M3 4 H21 V20 H3 Z" fill="#efe9dc" stroke="#6b5a45" stroke-width="1"/><path d="M3 8 H21 M3 12 H21 M3 16 H21 M7 4 V20 M11 4 V20 M15 4 V20 M19 4 V20" stroke="#6b5a45" stroke-width=".6"/><circle cx="9" cy="10" r="1.6" fill="#2d3036"/><circle cx="13" cy="14" r="1.6" fill="#c0392b"/>`),
  guitar: S(`<path d="M15 3 L20 8 L13.5 14.5" fill="none" stroke="#5a3b25" stroke-width="2"/><path d="M13.5 13 Q16 17 12.5 20 Q8.5 23 5 19.5 Q1.5 16 4.5 12 Q7.5 9 11 11 Z" fill="#c98a3a" stroke="#6b4a1f" stroke-width="1"/><circle cx="8.6" cy="15.6" r="1.4" fill="#3d2a1d"/>`),
  gift: S(`<path d="M4 10 H20 V20 H4 Z" fill="#c0392b" stroke="#6b1f17" stroke-width="1"/><path d="M3 7 H21 V10 H3 Z" fill="#d9534f" stroke="#6b1f17" stroke-width="1"/><path d="M12 7 V20" stroke="#f2d26b" stroke-width="2"/><path d="M12 7 Q8 3 7 6 Q8 7 12 7 Q16 7 17 6 Q16 3 12 7" fill="none" stroke="#f2d26b" stroke-width="1.2"/>`),
  candle: S(`<path d="M9 9 H15 V20 H9 Z" fill="#efe9dc" stroke="#9a9180" stroke-width="1"/><path d="M12 3 Q14.5 6 12 8.5 Q9.5 6 12 3 Z" fill="#f2b33d"/><path d="M6 20 H18" stroke="#8a8170" stroke-width="1.6"/>`),
  flag: S(`<path d="M5 21 V3" stroke="#6b5a45" stroke-width="1.6"/><path d="M5 4 H18 L15.5 8 L18 12 H5 Z" fill="#3b6fb6" stroke="#22406b" stroke-width="1"/>`),
  tent: S(`<path d="M2.5 19 L12 5 L21.5 19 Z" fill="#c9895a" stroke="#6b4a1f" stroke-width="1"/><path d="M12 5 V19 M9 19 L12 13 L15 19" fill="none" stroke="#6b4a1f" stroke-width="1"/>`),
  cushion: S(`<path d="M4 9 Q12 6 20 9 Q21.5 14 20 18 Q12 21 4 18 Q2.5 14 4 9 Z" fill="#b48ad1" stroke="#5f4176" stroke-width="1"/><path d="M5 9 L6.5 5 L9 8 M19 9 L17.5 5 L15 8" fill="#b48ad1" stroke="#5f4176" stroke-width="1"/>`),
  gem: S(`<path d="M7 4 H17 L21 9 L12 21 L3 9 Z" fill="#dfe8ef" stroke="#7d8f9e" stroke-width="1"/><path d="M3 9 H21 M7 4 L9.5 9 L12 21 L14.5 9 L17 4 M9.5 9 L12 4 L14.5 9" fill="none" stroke="#7d8f9e" stroke-width=".8"/>`),
  box: S(`<path d="M4 8 L12 4 L20 8 V17 L12 21 L4 17 Z" fill="#9aa3ad" stroke="#4d545c" stroke-width="1"/><path d="M4 8 L12 12 L20 8 M12 12 V21" fill="none" stroke="#4d545c" stroke-width="1"/>`),
};
/** 이름 → 아이콘 종류 (먼저 맞는 것). 잔 · 음료는 recipe (음료 그림) */
const RULES: [RegExp, string][] = [
  [/핫초코/, 'drink:hotchoco2'], [/찻잔|차$|딸기 차/, 'drink:nightlatte'], [/아메리카노|커피 잔/, 'drink:dutycoffee'],
  [/와인|포도주|아르키브/, 'drink:homecup'], [/에일|맥주/, 'drink:ringpint'], [/압생트/, 'drink:bitterdrop'], [/칵테일|과일 얹은|레몬 꽂은/, 'drink:frozencitrus'],
  [/잔$|가득 찬 잔/, 'drink:anchorrock'],
  [/커피머신/, 'machine'], [/홀로그램/, 'holo'], [/단말/, 'phone'], [/카메라|사진기/, 'camera'],
  [/땅콩버터|꿀단지/, 'jar'], [/약병/, 'vial'], [/병/, 'bottle'],
  [/팻말/, 'sign'], [/스케치북|공책|수첩|장부|메뉴판|잡지|책$/, 'book'], [/계약서|서류|정산표|계산서|청구서|보고서|의뢰서|배치표|설계도|항로도/, 'paper'],
  [/냄비/, 'pot'], [/그릇|라면|밥/, 'bowl'], [/푸딩|접시|떡|케이크|반죽|생선|블루라인|디저트|고기/, 'plate'],
  [/렌치|공구|나사|부품|숟가락|발전기/, 'tool'],
  [/수정|보석|원석/, 'gem'], [/꽃|백합/, 'flower'], [/체스|다트|큐대/, 'game'], [/기타/, 'guitar'], [/선물/, 'gift'], [/초$|켜진 초/, 'candle'], [/깃발/, 'flag'], [/텐트/, 'tent'], [/쿠션/, 'cushion'],
];
/** 카운터에 올라앉는 동물: 이름 → 그림(public/art/<art>.webp) · 주인 (주인이 무대에 있으면 그 앞, 없으면 첫 화자 앞) */
export const PETS: Record<string, { art: string; owner?: string }> = {
  리키: { art: 'sm_ricky', owner: 'vivian' },
  밍키: { art: 'mingki' },
};
export function propKind(name: string): string {
  for (const [re, k] of RULES) if (re.test(name)) return k;
  return 'box';
}
/** 소품 그림 (잔이면 음료 그림, 그 밖은 아이콘) */
export function propSvg(name: string): string {
  const k = propKind(name);
  if (k.startsWith('drink:')) { const r = RECIPE_BY_ID[k.slice(6)]; if (r) return drinkSvg(r, name.includes('빈') ? 0 : 0.85, 'prop-drink'); }
  return ICON[k] || ICON.box;
}
