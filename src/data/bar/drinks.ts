// 에란테스 바 음료: 재료 · 가니쉬 · 잔 · 얼음 · 이름 있는 메뉴(에이든 공략집) · 단골 메뉴.
// 기획: docs/BAR_OPS.md. 재료는 세계관 음료 모음(사용자 제공)에서 골랐고, 맛 수치 · 메뉴 · 단골은 [임시] (확인받기 전).
// 맛 축 3개는 더해서 센다 (잔이 클수록 진해진다): 당도 (음수 = 쓴맛) · 강도 (알코올) · 농도 (음수 = 청량). 향 · 산미는 태그.
// 얼음은 맛을 바꾸지 않는다 (없음 · 온더록 · 프로즌 — 프로즌은 층이 섞여 한 색이 된다). 잔 종류는 주문 조건으로만 쓴다.

export type Axis = 'sweet' | 'strength' | 'body';
export const AXES: Axis[] = ['sweet', 'strength', 'body'];
export const AXIS_NAME: Record<Axis, string> = { sweet: '당도', strength: '강도', body: '농도' };
export type Taste = Record<Axis, number>;

export type IngKind = 'spirit' | 'brew' | 'liqueur' | 'mixer' | 'powder';
export const ING_KIND_NAME: Record<IngKind, string> = { spirit: '증류주', brew: '양조주', liqueur: '리큐르 · 비터', mixer: '음료', powder: '분말' };

export interface Ingredient {
  id: string; name: string; kind: IngKind;
  /** 세계관 속 분류 (진 · 라거 …) */
  type: string;
  taste: Taste;
  /** 향 · 맛 태그 (주문의 '느낌' 맞추기 · 완성 맛 문장) */
  tags: string[];
  /** 잔 속 색 */
  color: string;
  /** 잔 속 불투명도 0.3 (맑은 술 · 탄산수) ~ 0.95 (우유 · 스타우트 · 코코아) — 완전히 불투명한 음료는 없다 (2026-11-04 사용자 결정, 표는 docs/BAR_OPS.md 3절) */
  alpha: number;
  /** 탄산 (잔 속 기포) */
  fizz?: boolean;
  /** 원산 · 한 줄 설명 (도감 · 레시피북) */
  desc: string;
}

/** 재료 24종 (술 14 · 음료 9) + 분말 3종. 한 칸 = 한 번 붓기 (2026-11-05: 빈 색 — 초록 · 청록 · 파랑 · 보라 · 분홍 — 을 채우는 7종 추가, 사용자) */
export const INGREDIENTS: Ingredient[] = [
  // ───────── 술 (14)
  { id: 'dustrain', name: '더스트레인', kind: 'spirit', type: '진', taste: { sweet: -1, strength: 2, body: -1 }, tags: ['건조함', '금속성'], color: '#dfe4dc', alpha: 0.3, desc: '네오사이트 황무지 성계 증류 진. 에란테스 바의 시그니처.' },
  { id: 'yebeson', name: '다크 블랙 예베손 라임', kind: 'spirit', type: '다크 럼', taste: { sweet: 1, strength: 2, body: 1 }, tags: ['묵직함', '라임'], color: '#4a2614', alpha: 0.75, desc: '예베손-2 블랙 마켓 유래. 밀조주 시절의 검은 병 그대로.' },
  { id: 'aster', name: '아스터', kind: 'spirit', type: '보드카', taste: { sweet: 0, strength: 2, body: -1 }, tags: ['깨끗함'], color: '#eaf0f2', alpha: 0.3, desc: '비네트-3 개척 22년차 신생 증류소. 칵테일 베이스로 두루 쓴다.' },
  { id: 'anchor', name: '올드 앵커', kind: 'spirit', type: '블렌디드 위스키', taste: { sweet: 0, strength: 3, body: 1 }, tags: ['스모키', '바닐라'], color: '#b8692a', alpha: 0.6, desc: '에란테스 바 자체 브랜드. 아문센이 여러 성계 원액을 섞었다.' },
  { id: 'ringside', name: '링사이드', kind: 'brew', type: '라거', taste: { sweet: 0, strength: 1, body: -2 }, tags: ['곡물향'], color: '#e8b84a', alpha: 0.55, fizz: true, desc: '베르타 4중 링월드 제3링 양조. 연합에서 가장 많이 팔리는 맥주.' },
  { id: 'darkringer', name: '다크 링거', kind: 'brew', type: '스타우트', taste: { sweet: 1, strength: 1, body: 2 }, tags: ['커피향'], color: '#22150e', alpha: 0.95, desc: '베르타 제1링의 차가운 기후대에서 길게 숙성한 거의 검은 맥주.' },
  { id: 'nostos', name: '노스토스', kind: 'brew', type: '과실주', taste: { sweet: 2, strength: 1, body: 0 }, tags: ['과일향', '따뜻한 여운'], color: '#9b2a3a', alpha: 0.75, desc: '이타카 귀향 과실주. 에란테스에서는 임무를 마치면 이걸로 축배를 든다.' },
  { id: 'ferma', name: '페르마', kind: 'brew', type: '사과주', taste: { sweet: 1, strength: 1, body: -1 }, tags: ['사과', '산미'], color: '#e6c879', alpha: 0.5, fizz: true, desc: '리빈-1 소규모 농가의 전통 시드르. 가을 수확기 한정.' },
  { id: 'velour', name: '벨루어', kind: 'liqueur', type: '크림 리큐르', taste: { sweet: 2, strength: 1, body: 2 }, tags: ['바닐라', '크림'], color: '#d8c3a0', alpha: 0.92, desc: '올드 앵커 원액 + 스타밀크. 에란테스 바의 2번째 하우스 브랜드.' },
  { id: 'abyss', name: '아비스', kind: 'spirit', type: '압생트', taste: { sweet: -1, strength: 3, body: 0 }, tags: ['약초향', '몽환'], color: '#62b83a', alpha: 0.55, desc: '출처 불명. 이차원 허브로 빚었다는 소문이 있다. 마시면 30분쯤 꿈을 꾸는 것 같다고들 한다.' },
  { id: 'pythia', name: '피시아', kind: 'spirit', type: '허브 증류주', taste: { sweet: 0, strength: 2, body: 0 }, tags: ['허브향', '신비로움'], color: '#8a5cd6', alpha: 0.5, desc: '델포이 신탁 증류주. 차원 균열 근처의 허브를 쓴다. 감각이 예민해진다는 소문이 있다.' },
  { id: 'skycaldo', name: '스카이 칼도', kind: 'brew', type: '발포 과실주', taste: { sweet: 1, strength: 1, body: -2 }, tags: ['과일향', '산미'], color: '#f0a0b4', alpha: 0.45, fizz: true, desc: '알비온 자동화 정원의 발포 과실주. 노스토스가 가족의 축배라면, 이건 손님을 맞는 격식 있는 건배주.' },
  { id: 'neon', name: '네코 마츠리 네온', kind: 'liqueur', type: '합성 칵테일', taste: { sweet: 3, strength: 1, body: -1 }, tags: ['인공 단맛', '형광'], color: '#ff38a8', alpha: 0.7, fizz: true, desc: '호이슌 합성 칵테일 프리믹스. 병 자체가 빛나고, 마시면 혀가 잠깐 형광색이 된다.' },
  { id: 'bitter', name: '비터 스펙트럼', kind: 'liqueur', type: '약초 비터', taste: { sweet: -3, strength: 2, body: 0 }, tags: ['약초향', '쓴맛'], color: '#6a1f1a', alpha: 0.8, desc: '델포이 약초 증류. 한 방울은 깊이, 두 방울은 약, 세 방울은 벌.' },
  // ───────── 음료 (9)
  { id: 'tonic', name: '보이드 토닉', kind: 'mixer', type: '토닉워터', taste: { sweet: -1, strength: 0, body: -2 }, tags: ['쓴맛'], color: '#e3eef5', alpha: 0.3, fizz: true, desc: '네오사이트 캠퍼스타운 제조. 황무지 자생 식물로 쓴맛을 낸다.' },
  { id: 'heliosfizz', name: '헬리오스 피즈', kind: 'mixer', type: '진저 비어', taste: { sweet: 1, strength: 0, body: -1 }, tags: ['생강', '얼얼함'], color: '#d9b25e', alpha: 0.6, fizz: true, desc: '트락스 해양 근처 생강 농장의 발효 탄산 음료.' },
  { id: 'soda', name: '과산소 소다', kind: 'mixer', type: '탄산수', taste: { sweet: 0, strength: 0, body: -2 }, tags: [], color: '#eef4f6', alpha: 0.3, fizz: true, desc: '고농도 산소 탄산수. 맛은 물인데, 임무 복귀 뒤 첫 잔으로는 이게 제일이다.' },
  { id: 'jolly', name: '졸리 시트러스 블라스트', kind: 'mixer', type: '합성 과즙', taste: { sweet: 2, strength: 0, body: -1 }, tags: ['시트러스'], color: '#f39a2b', alpha: 0.85, fizz: true, desc: '페트라 식품 부문의 합성 과즙. 라임보다는 오렌지에 가깝다.' },
  { id: 'starmilk', name: '스타밀크', kind: 'mixer', type: '우유', taste: { sweet: 1, strength: 0, body: 2 }, tags: ['우유'], color: '#f2efe6', alpha: 0.95, desc: '벨루어의 재료이기도 한 우유.' },
  { id: 'honey', name: '카스토리스 꿀 시럽', kind: 'mixer', type: '시럽', taste: { sweet: 3, strength: 0, body: 1 }, tags: ['꿀', '허브향'], color: '#d99a1c', alpha: 0.7, desc: '카스토리스 야생 벌집의 꿀을 졸인 시럽. 벌은 포위를 모른다.' },
  { id: 'jmidnight', name: '졸리 미드나이트', kind: 'mixer', type: '합성 과즙', taste: { sweet: 2, strength: 0, body: -1 }, tags: ['파인애플'], color: '#2a4fd2', alpha: 0.8, fizz: true, desc: '페트라 식품 부문의 합성 과즙. 맛은 멸종한 과일 파인애플, 색은 이름 그대로 한밤.' },
  { id: 'milkyway', name: '졸리 밀키웨이', kind: 'mixer', type: '탄산 요구르트', taste: { sweet: 2, strength: 0, body: 1 }, tags: ['요거트', '과일향'], color: '#cbc4f4', alpha: 0.88, fizz: true, desc: '페트라와 이타카 자유 용병 길드의 제휴 한정판. 오디세우스가 즐긴다더라.' },
  { id: 'crystalbloom', name: '크리스탈블룸', kind: 'mixer', type: '수정 차', taste: { sweet: 1, strength: 0, body: -2 }, tags: ['깨끗함', '투명한 향'], color: '#a6efdc', alpha: 0.3, desc: '세피르 수정상 길드의 차. 찻잎이 물에 닿으면 수정처럼 투명하게 펼쳐진다. 뒷맛 없이 깔끔하게 달다.' },
  // ───────── 분말 (3): 한 칸 = 그 분말로 탄 한 칸
  { id: 'midnight', name: '미드나이트 오일', kind: 'powder', type: '고카페인 커피', taste: { sweet: -2, strength: 0, body: 1 }, tags: ['커피향', '견과향'], color: '#3b2416', alpha: 0.9, desc: '네오사이트 학술 카페의 밤샘 연료. 당직 근무의 동반자.' },
  { id: 'cocoa', name: '에이든 코코아', kind: 'powder', type: '핫초코 가루', taste: { sweet: 2, strength: 0, body: 2 }, tags: ['초콜릿'], color: '#6b3f26', alpha: 0.95, desc: '에이든이 배합한 핫초코 가루. 배합은 메뉴판에 없다.' },
  { id: 'yakyung', name: '야경', kind: 'powder', type: '허브 블렌드', taste: { sweet: 0, strength: 0, body: -1 }, tags: ['카모마일', '꽃향'], color: '#d8d08a', alpha: 0.45, desc: '호이슌 수경 허브와 알비온 꽃을 섞은 디카페인 차. 밤을 재우는 잔.' },
];
export const ING_BY_ID: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((x) => [x.id, x]));

export interface Garnish { id: string; name: string; tags: string[]; taste?: Partial<Taste>; desc: string }
/** 가니쉬 10종 (한 잔에 최대 GARNISH_MAX 개) */
export const GARNISH_MAX = 3;
export const GARNISHES: Garnish[] = [
  { id: 'citrus', name: '솔라리스 시트러스', tags: ['산미', '시트러스'], desc: '얇게 썬 시트러스 한 바퀴. 더스트레인의 정석 짝.' },
  { id: 'lime', name: '예베손 라임', tags: ['산미', '라임'], desc: '라임 한 조각.' },
  { id: 'salt', name: '에테르 솔트 림', tags: ['짭짤함'], desc: '잔 테두리에 두른 소금.' },
  { id: 'cardia', name: '카르디아 씨앗', tags: ['향신료', '따뜻함'], desc: '한 꼬집 띄우는 것이 선원의 방식.' },
  { id: 'mint', name: '수경 민트', tags: ['허브향', '화함'], desc: '호이슌 수경 농장의 민트 잎.' },
  { id: 'petal', name: '알비온 꽃잎', tags: ['꽃향'], desc: '알비온 자동화 정원의 꽃잎.' },
  { id: 'bean', name: '커피콩 3알', tags: ['커피향'], desc: '위에 띄우는 커피콩.' },
  { id: 'marsh', name: '마시멜로', tags: ['단맛'], taste: { sweet: 1 }, desc: '몇 개를 올릴지는 손님 표정을 보고 정한다.' },
  { id: 'cream', name: '휘핑크림', tags: ['크림'], taste: { sweet: 1, body: 1 }, desc: '위에 높게 쌓은 크림.' },
  { id: 'crystal', name: '수정 설탕 조각', tags: ['단맛', '반짝임'], taste: { sweet: 1 }, desc: '사이오닉 수정 설탕 절임 조각. 에이든의 연구 부산물.' },
];
export const GARNISH_BY_ID: Record<string, Garnish> = Object.fromEntries(GARNISHES.map((x) => [x.id, x]));

export type GlassKind = 'tumbler' | 'stem';
export interface Glass { id: string; name: string; kind: GlassKind; slots: 3 | 4 | 5 }
/** 잔: 2종 × 3크기 (작은 잔 3칸 · 중간 4칸 · 큰 잔 5칸, 칸은 다 채운다). 종류 · 크기는 주문 조건 */
export const GLASSES: Glass[] = [
  { id: 'rock', name: '록 글라스', kind: 'tumbler', slots: 3 },
  { id: 'highball', name: '하이볼', kind: 'tumbler', slots: 4 },
  { id: 'pint', name: '파인트', kind: 'tumbler', slots: 5 },
  { id: 'coupe', name: '쿠페', kind: 'stem', slots: 3 },
  { id: 'wine', name: '와인 잔', kind: 'stem', slots: 4 },
  { id: 'goblet', name: '고블릿', kind: 'stem', slots: 5 },
];
export const GLASS_BY_ID: Record<string, Glass> = Object.fromEntries(GLASSES.map((x) => [x.id, x]));
export const GLASS_KIND_NAME: Record<GlassKind, string> = { tumbler: '텀블러', stem: '스템 잔' };

/** 얼음 (2026-11-04 사용자 결정: 온더록을 조금 · 많이로 나눔 — 개수는 잔 크기에 따라 조금 1~2 · 많이 2~3, ui/drinkart.ts). 프로즌은 갈린 얼음 */
export type Ice = 'none' | 'little' | 'lots' | 'frozen';
export const ICE_NAME: Record<Ice, string> = { none: '얼음 없음', little: '얼음 조금', lots: '얼음 많이', frozen: '프로즌' };
/** 옛 저장(온더록 rocks) → 지금 얼음: 같은 잔 · 재료 · 가니쉬 레시피가 있으면 그 얼음, 없으면 많이 */
export function normIce(d: Drink): Ice {
  if ((d.ice as string) !== 'rocks') return d.ice;
  const k = (x: string[]) => [...x].sort().join(',');
  return RECIPES.find((r) => r.glass === d.glass && k(r.fill) === k(d.fill) && k(r.garnish) === k(d.garnish))?.ice ?? 'lots';
}

/** 완성된 잔 (붓는 순서대로 칸 · 아래부터 층) */
export interface Drink { glass: string; fill: string[]; ice: Ice; garnish: string[];
  /** 섞기 (가니쉬 단계 선택, 2026-11-05 사용자): 층 색을 고루 섞어 보인다 — 맛 · 채점은 그대로 (보기만) */
  mix?: boolean }
/** 섞어 보일 수 있나: 재료가 2가지 이상이고 프로즌이 아님 (프로즌은 이미 섞여 있다) */
export const mixable = (d: Pick<Drink, 'fill' | 'ice'>) => d.ice !== 'frozen' && new Set(d.fill).size > 1;
export interface Recipe extends Drink { id: string; name: string; desc: string }

const R = (id: string, name: string, glass: string, fill: string[], ice: Ice, garnish: string[], desc: string): Recipe => ({ id, name, glass, fill, ice, garnish, desc });
/** 이름 있는 메뉴 = 에이든 공략집 (게베크 · 비비안 · 미리내 · 나디르가 정리하는 '메뉴판 밖 메뉴' 목록) [임시] */
export const RECIPES: Recipe[] = [
  R('hotchoco2', '핫초코 곱빼기', 'pint', ['cocoa', 'cocoa', 'starmilk', 'starmilk', 'starmilk'], 'none', ['marsh'], '마시멜로 개수는 그날 표정으로 정한다.'),
  R('ringer', '다크 링거 파인트', 'pint', ['darkringer', 'darkringer', 'darkringer', 'darkringer', 'darkringer'], 'none', [], '링사이드가 낮의 맥주라면 이건 밤의 맥주.'),
  R('dtonic', '더스트레인 토닉', 'highball', ['dustrain', 'dustrain', 'tonic', 'tonic'], 'lots', ['salt', 'citrus'], '에란테스 바 시그니처. 솔트 림과 시트러스가 정석.'),
  R('homecup', '귀향의 잔', 'wine', ['nostos', 'nostos', 'nostos', 'nostos'], 'none', ['cardia'], '임무를 마친 밤의 축배. 카르디아 씨앗 한 꼬집.'),
  R('anchorrock', '앵커 온더록', 'rock', ['anchor', 'anchor', 'anchor'], 'little', [], '만든 사람은 평가할 수 없다고 한다.'),
  R('anchorhb', '앵커 하이볼', 'highball', ['anchor', 'soda', 'soda', 'soda'], 'lots', ['citrus'], '올드 앵커를 소다로 길게.'),
  R('blackstorm', '검은 폭풍', 'highball', ['yebeson', 'yebeson', 'heliosfizz', 'heliosfizz'], 'lots', ['lime'], '다크 럼 위에 진저 비어. 밀조주 시절 맛.'),
  R('frontier', '개척지 뮬', 'highball', ['aster', 'heliosfizz', 'heliosfizz', 'heliosfizz'], 'lots', ['lime', 'mint'], '젊고 거친 보드카를 생강으로 달랜다.'),
  R('dutycoffee', '당직 커피', 'rock', ['midnight', 'midnight', 'midnight'], 'none', ['bean'], '이것 없이 밤을 새는 건 고문이다. 위에 커피콩 3알.'),
  R('velouroil', '벨루어 오일', 'coupe', ['midnight', 'midnight', 'velour'], 'none', ['cream'], '미드나이트 오일에 벨루어. 커피인지 디저트인지 정하지 않는다.'),
  R('ringpint', '링사이드 파인트', 'pint', ['ringside', 'ringside', 'ringside', 'ringside', 'ringside'], 'none', [], '누구에게나 무난하고 누구도 싫어하지 않는다.'),
  R('fermaglass', '페르마 한 잔', 'wine', ['ferma', 'ferma', 'ferma', 'ferma'], 'none', [], '입고되면 단원들에게 개인 메시지가 간다.'),
  R('jollyspark', '졸리 스파클', 'highball', ['jolly', 'jolly', 'soda', 'soda'], 'lots', ['citrus'], '술이 없는 탄산. 시고 달다.'),
  R('icesoda', '얼음 씹는 소다', 'pint', ['soda', 'soda', 'soda', 'soda', 'soda'], 'lots', [], '음료보다 얼음이 목적인 잔.'),
  R('nightlatte', '야경 라떼', 'coupe', ['yakyung', 'starmilk', 'honey'], 'none', ['petal'], '밤을 재우는 잔.'),
  R('bitterdrop', '쓴 약 한 방울', 'rock', ['bitter', 'tonic', 'tonic'], 'little', ['lime'], '두 방울은 약, 세 방울은 벌.'),
  R('sugarbomb', '설탕 폭탄', 'coupe', ['velour', 'honey', 'starmilk'], 'frozen', ['marsh', 'crystal'], '단맛 센서가 있는 손님 전용.'),
  R('hometoddy', '귀향 토디', 'rock', ['nostos', 'nostos', 'honey'], 'none', ['cardia'], '노스토스에 꿀을 풀어 따뜻하게.'),
  R('wastedry', '황무지 드라이', 'coupe', ['dustrain', 'dustrain', 'bitter'], 'none', ['citrus'], '건조하고 날카롭다. 황무지는 이렇게 건조하다.'),
  R('applehb', '사과 하이볼', 'highball', ['ferma', 'ferma', 'soda', 'soda'], 'lots', ['mint'], '페르마를 소다로 늘린 낮의 잔.'),
  R('frozencitrus', '프로즌 시트러스', 'goblet', ['aster', 'jolly', 'jolly', 'jolly', 'honey'], 'frozen', ['citrus'], '갈아 낸 시트러스. 머리가 띵할 때까지.'),
  R('milkpint', '스타밀크 파인트', 'pint', ['starmilk', 'starmilk', 'starmilk', 'starmilk', 'starmilk'], 'none', [], '큰 잔에 우유. 그게 다다.'),
  R('cocoacream', '코코아 크림', 'coupe', ['cocoa', 'starmilk', 'velour'], 'none', ['cream'], '디저트를 잔에 담았다.'),
  R('crystalcock', '수정 칵테일', 'rock', ['aster', 'tonic', 'tonic'], 'little', ['crystal'], '바텐더가 스스로에게 따르는 잔. 3잔째부터 바텐더가 조금 기운다.'),
  R('mintea', '유랑 민트 티', 'rock', ['yakyung', 'yakyung', 'honey'], 'none', ['mint'], '술 대신 차를 내는 유랑민의 잔. 당직 근무 날에는 이것만 나간다.'),
  R('neonsoda', '네온 소다', 'highball', ['neon', 'soda', 'soda', 'soda'], 'lots', [], '마젠타가 바닥에 깔리고 소다가 위로 오른다. 마시면 혀가 형광색이 된다.'),
  R('milkyway', '은하수', 'pint', ['jmidnight', 'jmidnight', 'milkyway', 'milkyway', 'milkyway'], 'none', ['crystal'], '한밤 파랑 위에 은하수. 맛은 파인애플 요구르트다.'),
  R('aurora', '오로라', 'wine', ['abyss', 'pythia', 'skycaldo', 'skycaldo'], 'none', ['petal'], '초록 · 보라 · 장밋빛 3겹. 섞으면 아깝다.'),
  R('crystaltea', '수정 아이스티', 'highball', ['crystalbloom', 'crystalbloom', 'soda', 'soda'], 'lots', ['mint'], '투명한 찻잎을 소다로 길게. 눈으로 먼저 마신다.'),
  R('gingersoda', '진저 소다', 'highball', ['heliosfizz', 'heliosfizz', 'soda', 'soda'], 'lots', ['lime'], '검은 폭풍에서 럼을 뺀 잔. 끝까지 자리를 지키는 사람의 잔.'),
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((x) => [x.id, x]));

export type OrderStyle = 'vague' | 'photo' | 'name' | 'usual';
export const ORDER_STYLE_NAME: Record<OrderStyle, string> = { vague: '느낌으로', photo: '사진으로', name: '이름으로', usual: '늘 마시던 거' };
/** 단골: 에이든이 내주는 단골 메뉴 · 좋아하는 주문 방식 (약 50% 이 방식, 나머지는 다른 방식 중 무작위) [임시] */
export const REGULARS: Record<string, { menu: string; style: OrderStyle }> = {
  amundsen: { menu: 'anchorrock', style: 'usual' },
  lindiwe: { menu: 'cocoacream', style: 'name' },
  yelena: { menu: 'ringer', style: 'usual' },
  orca: { menu: 'anchorhb', style: 'vague' },
  franze: { menu: 'velouroil', style: 'name' },
  zephyro: { menu: 'jollyspark', style: 'vague' },
  hiiro: { menu: 'nightlatte', style: 'vague' },
  vivian: { menu: 'ringpint', style: 'photo' },
  nadir: { menu: 'frontier', style: 'photo' },
  mirinae: { menu: 'applehb', style: 'photo' },
  gebek: { menu: 'fermaglass', style: 'name' },
  phyllis: { menu: 'frozencitrus', style: 'vague' },
  temur: { menu: 'milkpint', style: 'vague' },
  eleni: { menu: 'sugarbomb', style: 'name' },
  kairo: { menu: 'wastedry', style: 'name' },
  donovan: { menu: 'icesoda', style: 'usual' },
  iris: { menu: 'applehb', style: 'vague' },
  zahara: { menu: 'mintea', style: 'usual' }, // 술은 맛없다 · 알-카흐란 차 문화 (lore)
  romani: { menu: 'gingersoda', style: 'vague' }, // 술은 마시지 않는다 (lore)
  bianca: { menu: 'nightlatte', style: 'name' },
  joshua: { menu: 'dutycoffee', style: 'usual' },
  chloe: { menu: 'frozencitrus', style: 'photo' },
  west: { menu: 'hometoddy', style: 'usual' },
  yupito: { menu: 'frontier', style: 'vague' },
  sarma: { menu: 'dtonic', style: 'photo' },
};
/** 주문하지 않는 재료: 'alc' = 술(증류주 · 양조주 · 리큐르)이 든 잔 전부, 배열 = 그 재료가 든 잔. 정규 단원 id 또는 낯선 손님 명부 id (lore · 명부 persona) */
export const ORDER_AVOID: Record<string, 'alc' | string[]> = {
  romani: 'alc', // 술은 마시지 않는다
  zahara: 'alc', // 술은 맛없다 · 차 문화
  zephyro: 'alc', joshua: 'alc', // 단골 메뉴가 술 없는 잔 (졸리 스파클 · 당직 커피)
  a_ariadne: 'alc', c_melina: 'alc', // 근무 중이라 술은 안 마신다
  p_tupac: 'alc', // 현장 사고 뒤 술을 끊었다
  p_ines: ['yebeson'], // 예베손 럼이 든 잔은 이해 충돌이라 시키지 않는다
};
const ALC_KIND = new Set<IngKind>(['spirit', 'brew', 'liqueur']);
/** 이 손님이 주문할 수 있는 잔인가 (ORDER_AVOID) */
export const canOrder = (who: string, d: Drink) => { const a = ORDER_AVOID[who]; return !a || !d.fill.some((x) => (a === 'alc' ? ALC_KIND.has(ING_BY_ID[x]?.kind) : a.includes(x))); };
/** 단골이 아닌 손님에게 에이든이 내주는 무난한 메뉴 */
export const HOUSE_MENUS = ['dtonic', 'anchorhb', 'ringpint', 'jollyspark', 'applehb', 'homecup'];

// ───────── 맛 계산
/** 완성 맛 = 칸마다 재료 맛 + 가니쉬 맛 (더한다) */
export function tasteOf(d: Drink): Taste {
  const t: Taste = { sweet: 0, strength: 0, body: 0 };
  for (const id of d.fill) { const x = ING_BY_ID[id]; if (x) for (const a of AXES) t[a] += x.taste[a]; }
  for (const id of d.garnish) { const g = GARNISH_BY_ID[id]; if (g?.taste) for (const a of AXES) t[a] += g.taste[a] || 0; }
  return t;
}
/** 향 · 맛 태그 (많이 들어간 것 먼저) */
export function tagsOf(d: Drink): string[] {
  const n = new Map<string, number>();
  for (const id of d.fill) for (const t of ING_BY_ID[id]?.tags || []) n.set(t, (n.get(t) || 0) + 1);
  for (const id of d.garnish) for (const t of GARNISH_BY_ID[id]?.tags || []) n.set(t, (n.get(t) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
/** 완성 맛을 한 문장으로: '달고 독한, 청량한 편 · 시트러스 향' */
export function tasteText(d: Drink): string {
  const t = tasteOf(d);
  const sw = t.sweet >= 6 ? '아주 달고' : t.sweet >= 3 ? '달고' : t.sweet <= -6 ? '아주 쓰고' : t.sweet <= -3 ? '쓰고' : '단맛은 덜하고';
  const st = t.strength === 0 ? '술기운 없는' : t.strength <= 3 ? '순한' : t.strength <= 7 ? '독한' : '아주 독한';
  const bd = t.body >= 4 ? '진한 편' : t.body <= -4 ? '청량한 편' : '가벼운 편';
  const tags = tagsOf(d).slice(0, 2);
  return `${sw} ${st}, ${bd}${tags.length ? ` · ${tags.join(' · ')}` : ''}`;
}
