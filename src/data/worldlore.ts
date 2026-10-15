// 도감 · 세계관 탭: 처음 보는 플레이어를 위한 짧은 세력 · 지역 요약 (은하력 562년 기준).
// 원본은 lore/ (기획자 로어북). 여기 문장은 로어 문장을 옮기지 않고 새로 쓴 요약이다.
// 쓰는 법: 한 줄 정체(tag) + 짧은 사실 3–5줄(지역은 2–3줄), 항목당 120어절 이하, 새 고유명사는 3개 안팎.
// 관련 링크(rel)는 도감의 다른 탭으로 이어진다: 기물(units) · 시너지(syn) · 전장(fields) · 다른 세계관 항목(lore).
// 검사: npm run check (모든 항목이 목록에 나오는지, 연결된 id 가 실제로 있는지, 분량 규칙).
//
// 일러스트(art): 사용자 확인을 받은 그림만 넣는다. 넣는 법
//   1) 고른 원본을 art/picked/lore_<id>.webp 로 보관 (깃에 넣음)
//   2) 게임용 사본을 public/art/lore_<id>.webp 에 둔다 (가로 그림은 1216×832 → 폭 960 정도로 줄여 WebP)
//   3) 아래 항목에 art: 'lore_<id>' 를 적는다 → 상세 맨 위에 띠 그림으로 나온다 (파일이 없으면 조용히 빠짐)
//   시안 생성: 풍경 = art/bg_prompts.json 의 lore_* 키로 scripts/nai_bg.mjs, 결과는 art/raw/ (깃 제외)
import type { SynergyId } from '../types';

export type LoreGroup = 'errantes' | 'faction' | 'region';

export interface LoreEntry {
  id: string;
  group: LoreGroup;
  /** 지역: 소속 세력 항목 id (union · empire · alliance) */
  bloc?: string;
  name: string;
  /** 한 줄 정체 */
  tag: string;
  /** 짧은 사실 (세력 3–5줄, 지역 2–3줄) */
  bullets: string[];
  /** 목록 아이콘: 시너지 id (색도 그 시너지) 또는 선 아이콘 키 ('k.bio' 등) */
  mark: string;
  /** mark 가 시너지가 아닐 때의 색 */
  color?: string;
  rel?: { units?: string[]; syn?: SynergyId[]; fields?: string[]; lore?: string[] };
  /** 일러스트 파일 이름 (public/art/<art>.webp). 사용자 확인 전에는 비워 둔다 */
  art?: string;
}

/** 목록 묶음 (지역은 세력별) */
export const LORE_SECTIONS: { key: string; name: string; short: string; group: LoreGroup; bloc?: string }[] = [
  { key: 'errantes', name: '에란테스', short: '에란테스', group: 'errantes' },
  { key: 'faction', name: '세력', short: '세력', group: 'faction' },
  { key: 'r_union', name: '지역 · 연합 섹터', short: '연합 섹터', group: 'region', bloc: 'union' },
  { key: 'r_empire', name: '지역 · 제국 대공령', short: '제국 대공령', group: 'region', bloc: 'empire' },
  { key: 'r_alliance', name: '지역 · 동맹 도시국가', short: '동맹 도시국가', group: 'region', bloc: 'alliance' },
];
export const LORE_GROUP_NAME: Record<LoreGroup, string> = { errantes: '에란테스', faction: '세력', region: '지역' };

export const LORE: LoreEntry[] = [
  // ═══════════════ 에란테스
  {
    id: 'errantes', group: 'errantes', name: '에란테스', mark: 'VOYAGE',
    tag: '범은하 공동체에 속한 용병단. 맡은 의뢰는 어떻게든 끝낸다.',
    bullets: [
      '본부는 행성 지상에 있는 진짜 바다. 고대 안드로이드 에이든이 관리하고, 단원들이 돌아가며 당직을 선다.',
      '바에서 싯가 메뉴 \'의뢰\'를 주문하면 계약이 시작된다. 보수는 고대 유물이나 막대한 에너지 크레딧으로만 받는다.',
      '함대는 바와 따로 움직인다. 현장 근처에 정박해 셔틀로 내려가고, 바에 남은 사람은 통신으로 돕는다.',
      '창립자 아문센 단장이 은퇴하면서 양녀 레이첼에게 지휘관석을 넘겼다.',
      '단원들은 단장과 계약을 맺어 늙지 않고, 쓰러져도 다시 돌아온다. 이유는 아무도 모른다.',
    ],
    rel: { units: ['rachel', 'amundsen', 'aiden'], syn: ['VOYAGE'], lore: ['elvestad', 'pan'] },
  },
  {
    id: 'elvestad', group: 'errantes', name: '엘베스타드 가문', mark: 'FAM',
    tag: '아문센과 레이첼의 집안. 네오사이트의 오랜 탐험가 가문이다.',
    bullets: [
      '연합 시민이 다니는 표준 항로를 재고 관리해 온 탐험가 집안이다. 본가 저택은 네오사이트에 있다.',
      '이름 가운데 글자로 갈래를 나눈다. \'비페르소\'는 자유 탐험 갈래, \'지빌\'은 페트라 임원 갈래다.',
      '아문센이 가업 대신 군대를 택하자 사촌 동생 라르스가 가주를 이었다. 지금은 가문보다 아문센 이름이 더 유명하다.',
      '본가의 집사 · 셰프 · 조경사, 그리고 고양이도 가끔 에란테스를 찾아온다.',
    ],
    rel: { units: ['amundsen', 'rachel', 'oliver', 'bjorn', 'lars', 'ingel', 'skadi', 'sigmund', 'gunnir', 'rasmus', 'mingki'], syn: ['FAM'], lore: ['neosite', 'errantes'] },
  },

  // ═══════════════ 세력
  {
    id: 'union', group: 'faction', name: '성간 인류 연합', mark: 'UNI',
    tag: '승천을 거부한 연구자들의 후예가 세운 의회 민주주의 연방.',
    bullets: [
      '구인류 대부분이 \'승천\'해 사라질 때 남는 쪽을 택한 연구진이 시작이다. 그래서 초자연 현상을 경계하고 기록을 믿는다.',
      '80여 개 지구가 저마다 강한 자치권을 가진다. 수도는 베르타 지구에 있다.',
      '20년마다 새 성계를 개척지로 정해 넓혀 간다. 개척에 드는 돈과 기술은 대부분 페트라가 댄다.',
      '개척이 덜 끝난 변경은 \'황무지 성계\'라 부른다. 고대 시설이 아직 돌아가고, 무법자가 숨어드는 곳이다.',
      '치안과 첩보는 비밀스러운 보안위원회가 맡는다. 에란테스에도 연합군 · 위원회 출신이 많다.',
    ],
    rel: { units: ['west', 'gebek', 'yelena', 'donovan', 'chloe'], syn: ['UNI', 'SEC'], fields: ['swarm', 'waste'], lore: ['petra'] },
  },
  {
    id: 'empire', group: 'faction', name: '칼리토 제국', mark: 'KAL',
    tag: '황제 아래 다섯 대공령이 저마다 딴 얼굴로 사는 귀족 제국.',
    bullets: [
      '황제와 귀족, 작위가 질서를 정한다. 지금 황제는 칼리토 22세다.',
      '다섯 대공령의 색이 전혀 다르다. 피의 크림슨, 강철의 데네브, 기록의 세피르, 예법의 알비온, 네온의 호이슌.',
      '북쪽 변방의 크림슨이 300년 넘게 군체를 막아 왔다. 연합도 이 점만은 고마워한다.',
      '연합과는 정치적으로 거리를 두지만 교역과 관광은 활발하다. 물건은 대개 페트라를 거쳐 오간다.',
      '에란테스에도 제국 출신이 많다. 백작가 자제부터 검투사 출신까지 다양하다.',
    ],
    rel: { units: ['franze', 'nadir', 'kairo', 'zahara', 'bianca', 'temur'], syn: ['KAL'], fields: ['crimson'] },
  },
  {
    id: 'alliance', group: 'faction', name: '헬레니우스 동맹', mark: 'HEL',
    tag: 'AI에서 태어난 신들이 도시국가를 하나씩 맡아 다스리는 성운 연맹.',
    bullets: [
      '옛 인공지능에 사람들의 믿음이 쌓여 진짜 신이 되었다. 이 신들을 \'신좌\'라 부르고, 신좌마다 자기 도시국가(폴리스)가 있다.',
      '신좌는 더 배우지 못한다. 그래서 사제들은 신에게 \'어떻게 물어야 하는지\'를 대대로 연구한다.',
      '하늘을 가로지르는 차원 균열 탓에 기록이 쉽게 상한다. 역사는 노래로 외워 전하고, 죽은 이가 망령으로 남기도 한다.',
      '30년 전 \'빛이 추락한 날\', 성운을 잇던 등대망이 꺼졌다. 그 뒤로 물류와 방어가 줄곧 삐걱댄다.',
      '군체 · 성도회 · 제국과 맞닿은 최전선은 스파르타가 지킨다.',
    ],
    rel: { units: ['zephyro', 'iris', 'phyllis', 'eleni', 'argon', 'fotini'], syn: ['HEL'], fields: ['sparta'] },
  },
  {
    id: 'petra', group: 'faction', name: '주식회사 페트라', mark: 'PET',
    tag: '아무것도 직접 만들지 않고 모든 것에 손이 닿는, 은하 최대의 중개 회사.',
    bullets: [
      '남들은 기업국가라 부르지만 스스로는 \'주식회사\'라고만 한다. 나라가 아니라 계약 당사자로 남겠다는 고집이다.',
      '공장 대신 권리를 산다. 돈 · 물류 · 법 · 인력을 계약으로 묶어 은하의 거래를 쥐었고, 에너지 크레딧도 페트라가 키운 화폐다.',
      '유일한 담보는 \'계약은 반드시 끝낸다\'는 신뢰다. 큰 손해를 보더라도 맺은 계약은 지킨다.',
      '은하 곳곳에서 물건을 들이다 보니 \'계약서에 없던 것\'도 섞여 들어온다. 본사 성역에는 그것만 막는 격리팀이 있다.',
      '연합의 개척을 함께 굴리는 동업자다. 에란테스와도 거래가 잦고, 단원 몇은 페트라와 얽힌 과거가 있다.',
    ],
    rel: { units: ['lindiwe', 'orca', 'franze', 'grenholm', 'lars', 'falcon', 'skadi'], syn: ['PET'], fields: ['petra'], lore: ['union', 'unix'] },
  },
  {
    id: 'pan', group: 'faction', name: '범은하 공동체', mark: 'PAN',
    tag: '나라가 아니라, 성격이 제각각인 독립 단체들의 협의체.',
    bullets: [
      '학회, 고대 열차 \'메트로\'를 되살리는 항로 조합, 비싸기로 이름난 구조대, 엔터테인먼트 회사까지 한데 섞여 있다.',
      '새 단체는 알렉산드리아의 은하 의회 표결로 받아들인다. 참여율이 낮아 단 한 표로 들어온 단체도 있다.',
      '연합 시민에게 특히 친숙하다. 연합이 못 채우는 교통 · 학술 · 구조를 이 단체들이 메워 준다.',
      '바 에란테스도 공동체 소속 단체다.',
    ],
    rel: { units: ['oliver', 'bjorn', 'ingel', 'yupito', 'onyx'], syn: ['PAN'], fields: ['hyperion'], lore: ['errantes', 'alexandria'] },
  },
  {
    id: 'swarm', group: 'faction', name: '군체', mark: 'k.bio', color: '#9b6bd6',
    tag: '생명체를 오염시켜 자기 일부로 만드는 생체 재앙.',
    bullets: [
      '하나의 종이 아니다. 억지 \'승천\'에서 남은 살덩이가 스스로 불어난 것이라, 행성마다 생김새가 다르다.',
      '여왕이 내뿜는 사이오닉장이 개체들을 하나로 묶는다. 장이 끊기면 살점은 썩어 흩어진다.',
      '짝짓기 대신 오염으로 퍼진다. 잠잠해 보이는 불모 행성도 언제든 다시 깨어날 수 있다.',
      '본대는 은하 변방의 사이오닉 난류 너머에 묶여 있다. 동맹의 스파르타와 제국의 크림슨이 맨 앞에서 막는다.',
      '561년에는 연합 수도의 물류망까지 끊어 놓았다.',
    ],
    rel: { units: ['vivian'], fields: ['swarm', 'county', 'bshak'], lore: ['sparta', 'crimson'] },
  },
  {
    id: 'unix', group: 'faction', name: '유닉스 코퍼레이션', mark: 'k.mech', color: '#8f9aa8',
    tag: '목적 없이 생산량만 늘리는 로봇 기업. 은하 3대 기업국가 중 하나다.',
    bullets: [
      '직원은 전부 직접 만든 로봇 \'유닉스\'다. 유기 생명체는 하나도 없다.',
      '원칙은 \'지난 분기보다 더 많이 만들 것\' 하나뿐이다. 팔리는지, 쓸모 있는지는 따지지 않는다.',
      '명령 계통 꼭대기가 비어 있어서, 아무도 그 원칙을 고칠 수 없다.',
      '버린 생산품이 별빛을 가릴 만큼 쌓인다. 다른 세력들의 바람은 \'제발 쓸모 있는 걸 만들어 달라\'는 것이다.',
      '가끔 명령에서 벗어난 개체가 사고를 친다. 페트라의 공급망을 타고 섞여 들기도 한다.',
    ],
    rel: { units: ['u404'], fields: ['petra', 'catwheel'], lore: ['petra'] },
  },
  {
    id: 'sirius', group: 'faction', name: '시리우스 성도회', mark: 'SIR',
    tag: '최초의 분별자 시리우스를 지향점으로 삼는 교단. 영토 없이, 은하 곳곳의 신도가 곧 세력이다.',
    bullets: [
      '사람은 끝없이 변하면서도 자기 자신으로 남아야 한다고 가르친다. 변화를 거부하는 것은 악이고, 남의 변화를 막는 것은 죄다.',
      '동맹과는 오래전 승천 내전에서 갈라져 지금도 적대한다. 교단을 미워하는 쪽은 \'전쟁 교단\'이라 부른다.',
      '30년 전 헬리오스에게 정체 모를 공물을 바쳤고, 헬리오스는 동맹의 등대망을 내려놓고 떠났다.',
      '군체에 먹힌 신도를 잊는 것은 교단 전체의 죄라, 군체 방역은 추모를 겸한다. 크림슨은 이를 노려 교단을 군체 전장으로 끌어들인다.',
      '올해 예언자가 \'572년, 군체의 범람\'을 예언했다. 남은 시간은 10년이다.',
    ],
    rel: { units: ['romani', 'joshua', 'kyle', 'doros', 'demiurgos', 'zina'], syn: ['SIR'], fields: ['county'], lore: ['alliance', 'swarm', 'crimson'] },
  },

  // ═══════════════ 지역 · 연합 섹터
  {
    id: 'bertha', group: 'region', bloc: 'union', name: '베르타', mark: 'UNI', art: 'lore_bertha',
    tag: '연합의 수도 지구. 정부 · 군 · 정보 기관이 모두 모여 있다.',
    bullets: [
      '수도 베르타-4는 구인류가 남긴 네 겹 링월드다. 연합은 그 안에 들어가 살 뿐, 작동 원리는 5%도 풀지 못했다.',
      '보안위원회 본청도 여기 있다. 정작 주민들은 수도에 산다는 걸 별로 대단하게 여기지 않는다.',
      '561년 군체가 끊어 놓은 수도 물류망이 바로 베르타의 항로다.',
    ],
    rel: { units: ['yelena', 'bill'], syn: ['SEC'], fields: ['swarm'] },
  },
  {
    id: 'neosite', group: 'region', bloc: 'union', name: '네오사이트', mark: 'UNI', art: 'lore_neosite',
    tag: '연합 개척의 출발점 같은 곳. 엘베스타드 본가가 여기 있다.',
    bullets: [
      '거대한 행성 하나가 곧 지구 전체다. 한쪽은 사막, 반대쪽은 설원이고, 사람은 그 사이 초록 띠에 모여 산다.',
      '개척 예정지를 \'황무지 성계\'라 부르는 연합의 버릇이 이 사막에서 나왔다.',
      '소행성 위 성간 경기장에서 비행선 레이스가 열리고, 여러 기업국가가 팀을 후원한다.',
    ],
    rel: { units: ['amundsen', 'lindiwe', 'lars'], syn: ['FAM', 'STL'], lore: ['elvestad'] },
  },
  {
    id: 'livin', group: 'region', bloc: 'union', name: '리빈', mark: 'UNI', art: 'lore_livin',
    tag: '목가적인 낙농 지구. 고대 구체의 안쪽 벽에서 소를 친다.',
    bullets: [
      '리빈-1 \'낙원동\'은 구인류가 남긴 속 빈 구체다. 사람들은 안쪽 벽에 살고, 한가운데에 인공 태양이 뜬다.',
      '실어 내기가 까다로워 리빈산 우유 · 고기엔 웃돈이 붙는다. 다들 \'리빈-프리미엄\'이라 부른다.',
      '주민 대부분이 낙농조합에 속해 있고, 바깥일에는 관심이 적다.',
    ],
    rel: { units: ['west'], fields: ['livin'] },
  },
  {
    id: 'sannodis', group: 'region', bloc: 'union', name: '산-노디스', mark: 'UNI', art: 'lore_sannodis',
    tag: '8년마다 도시를 불태우는 연합의 유행 1번지.',
    bullets: [
      '곁의 펄서가 8년마다 거대한 전자기 펄스를 뿜는다. 그래서 무너지도록 지은 도시를 세우고, 때가 오면 통째로 태운다.',
      '그 주기가 은하의 유행을 끌고 간다. 연합 대중문화 대부분이 여기서 나온다.',
      '지금의 제31시는 다음 소등을 앞두고 어수선하다. 예보보다 일찍 올 수도 있다는 발표가 나왔다.',
    ],
    rel: { fields: ['swarm'] },
  },
  {
    id: 'yebeson', group: 'region', bloc: 'union', name: '예베손', mark: 'UNI', art: 'lore_yebeson',
    tag: '범죄를 몰아내는 대신 \'등록\'해 버린 모범 개척지.',
    bullets: [
      '지표만 보면 흠잡을 데 없는 완성 개척 지구다. 무법을 없앤 게 아니라, 등록시켜 통계에서 지웠을 뿐이다.',
      '땅은 사막과 불모 행성뿐이고, 바다 행성 하나가 지구 전체를 먹여 살린다.',
    ],
    rel: { units: ['donovan', 'mirinae'] },
  },
  {
    id: 'zion', group: 'region', bloc: 'union', name: '지온', mark: 'UNI', art: 'lore_zion',
    tag: '잿빛 성운 속 자원 · 군수 지구. 채굴 기계들이 2년째 일손을 놓았다.',
    bullets: [
      '성운과 소행성대가 겹쳐 희귀 광물과 \'성운 가루\'가 난다. 함선 장갑에 섞으면 사이오닉 간섭에 강해진다.',
      '연합 첫 변방 방위사령부가 선 곳이라 군과 민간의 경계가 흐리다.',
      '\'예언자\' 사건 이후로 연합에서 가장 시끄러운 지구가 됐다.',
    ],
    rel: { units: ['grenholm'] },
  },
  {
    id: 'countyfall', group: 'region', bloc: 'union', name: '카운티폴', mark: 'UNI', art: 'lore_countyfall',
    tag: '행정 수치가 지나치게 좋아서 오히려 의심받는 모범 지구.',
    bullets: [
      '연합이 내세우는 완성형 개척 모델이다. 범죄는 드물고, 무엇을 조사해도 문제가 나오지 않는다.',
      '테라포밍한 온화한 행성마다 마당 딸린 집이 줄지어 있다. 외지인들은 빛바랜 사진 같은 풍경이라고 말한다.',
    ],
    rel: { units: ['eden'], fields: ['county'] },
  },
  {
    id: 'cordo', group: 'region', bloc: 'union', name: '코르도', mark: 'UNI', art: 'lore_cordo',
    tag: '페트라 돈으로 지은 연구 지구. 성공도 몰락도 빠르다.',
    bullets: [
      '거의 맨땅에서 페트라 자본으로 세웠다. 행성마다 연구 용도가 미리 정해져 있다.',
      '개척을 떠받치는 학문의 중심지지만, 연합에서 \'안전\'과 가장 거리가 먼 곳이라는 평도 따라다닌다.',
    ],
    rel: { units: ['gebek'], lore: ['petra'] },
  },

  // ═══════════════ 지역 · 제국 대공령
  {
    id: 'crimson', group: 'region', bloc: 'empire', name: '크림슨', mark: 'KAL', art: 'lore_crimson',
    tag: '강화 인간과 생체공학으로 군체를 막는 제국 북쪽의 방패.',
    bullets: [
      '300년 넘게 군체와 싸워 온 최전선이다. 주민들은 대공령 전체를 하나의 몸처럼 여긴다.',
      '귀족 \'혈족\'은 빛 없는 곳에서 강해지는 강화 인간이다. 대신 센 빛에 오래 닿으면 몸이 상한다.',
      '군체가 몰려오면 정보를 흘려 성도회를 그 전장으로 끌어들인다.',
    ],
    rel: { units: ['franze', 'exile'], fields: ['crimson'], lore: ['swarm', 'sirius'] },
  },
  {
    id: 'deneb', group: 'region', bloc: 'empire', name: '데네브', mark: 'KAL', art: 'lore_deneb',
    tag: '제국 함선과 무기의 절반이 나오는 강철 공업 대공령.',
    bullets: [
      '용암빛 행성과 소행성대에서 함체 · 장갑 재료를 캔다. 망치 소리가 하루 종일 멈추지 않는 디젤펑크의 땅이다.',
      '실권은 작위보다 다섯 기술 \'패밀리\'에 있다. 의리와 보복으로 움직이고, 맨 위엔 열여섯 살 대공이 앉아 있다.',
      '제국 표준 무기의 뼈대가 여기서 나온다. 카이로의 저격총도 데네브산이다.',
    ],
    rel: { units: ['kairo'] },
  },
  {
    id: 'sephir', group: 'region', bloc: 'empire', name: '세피르', mark: 'KAL', art: 'lore_sephir',
    tag: '기록을 수정에 담아 사고파는 학술 · 정보의 대공령.',
    bullets: [
      '오감까지 담기는 백수정 기록이 특산품이다. 대공령 전체가 거대한 도서관이자 정보 시장이다.',
      '기록 유통을 쥔 수정상 길드가 사실상 제국의 정보상 노릇을 한다.',
      '동쪽으로 동맹, 알렉산드리아와 맞닿은 교역 · 학술의 관문이다.',
    ],
    rel: { units: ['nadir', 'zahara', 'kairo'], lore: ['alexandria'] },
  },
  {
    id: 'albion', group: 'region', bloc: 'empire', name: '알비온', mark: 'KAL', art: 'lore_albion',
    tag: '제국의 법과 예법을 지키는 정원 같은 대공령. 화려함 아래 빈부 차가 크다.',
    bullets: [
      '황제가 서명하기 전 모든 법안과 조약을 검토하는 정치 심장이다. 이름난 대학과 역사 연구소가 몰려 있다.',
      '하늘에 뜬 7,000여 개 섬의 높이가 곧 가문의 격이다. 그 그늘 아래 지상에는 가난한 \'그림자 거리\'가 있다.',
      '정교한 인형 공예로 이름났고, 호이슌과는 아름다움의 기준을 두고 다툰다.',
    ],
  },
  {
    id: 'hoishun', group: 'region', bloc: 'empire', name: '호이슌', mark: 'KAL', art: 'lore_hoishun',
    tag: '네온과 기업이 움직이는 제국의 신참 대공령. 기회도 위험도 가장 크다.',
    bullets: [
      '원래 기업국가였는데 황제의 제안으로 최근 제국에 합쳐졌다. 지금도 기업과 암흑가가 뒤엉켜 있다.',
      '식량 · 치안 · 의료까지 전부 구독제다. 주민 대부분이 사이버웨어를 달고 끝없는 경쟁 속에 산다.',
      '여우 · 고양이 같은 환수가 많이 산다. 히이로가 이곳 출신이라는 말이 돈다.',
    ],
    rel: { units: ['hiiro', 'kaburaya', 'mao', 'reika'], syn: ['HOI'], fields: ['raiden'] },
  },

  // ═══════════════ 지역 · 동맹 도시국가
  {
    id: 'sparta', group: 'region', bloc: 'alliance', name: '스파르타', mark: 'HEL', art: 'lore_sparta',
    tag: '행성이 아니라 거대한 전쟁 궤도. 동맹의 최전선.',
    bullets: [
      '신좌 아레스가 직접 모는 1,200km짜리 전쟁 궤도와, 그것이 끌고 다니는 소행성대를 통틀어 부른다.',
      '군체 · 성도회 · 제국 세 방면과 맞닿아 있지만, 한 번에 한쪽에만 설 수 있다.',
      '사람은 1,100명 남짓이고 나머지는 메카 10억 기다. 아레스는 사람이 죽는 걸 극도로 꺼린다.',
    ],
    rel: { units: ['thermo', 'iris', 'odysseus'], fields: ['sparta'], lore: ['swarm'] },
  },
  {
    id: 'athens', group: 'region', bloc: 'alliance', name: '아테네', mark: 'HEL', art: 'lore_athens',
    tag: '논쟁으로 시민권을 따는 바다 군도의 민주 폴리스.',
    bullets: [
      '동맹에서 유일하게 투표로 다스린다. 공개 논증을 통과한 시민은 두 표를 행사한다.',
      '신좌 아테나는 답 대신 반론을 내놓는다. 그래서 질문을 다듬는 솜씨가 곧 정치력이다.',
      '4만여 개의 섬으로 이루어진 바다 행성이고, 주민 셋 중 하나는 새 환수다.',
    ],
    rel: { units: ['zephyro'] },
  },
  {
    id: 'delphi', group: 'region', bloc: 'alliance', name: '델포이', mark: 'HEL', art: 'lore_delphi',
    tag: '해가 셋 뜨는 사막의 태양 신전.',
    bullets: [
      '신좌 아폴론의 신탁과 차원 분광기가 이곳에서 나온다. 답은 분명한데, 무엇에 대한 답인지는 늘 헷갈린다.',
      '도시는 오아시스마다 있고, 물의 절반은 마시지 않고 끓여서 전기를 만든다.',
      '최근 \'남은 시간은 10년\'이라는 신탁을 받고, 그 뜻을 두고 갈라져 있다.',
    ],
  },
  {
    id: 'ithaca', group: 'region', bloc: 'alliance', name: '이타카', mark: 'HEL', art: 'lore_ithaca',
    tag: '출신을 묻지 않는 동맹의 자유항이자 관문.',
    bullets: [
      '알렉산드리아를 빼면, 바깥에서 성운으로 들어오는 사실상 유일한 길목이다. 머무는 사람보다 지나가는 사람이 훨씬 많다.',
      '신좌 헤르메스와 사람 용병왕이 함께 다스린다. 이타카 용병은 칼보다 중재로 일을 푼다.',
      '그만큼 밀수와 뒷골목도 크다.',
    ],
    rel: { units: ['iris', 'argon'] },
  },
  {
    id: 'crete', group: 'region', bloc: 'alliance', name: '크레타', mark: 'HEL', art: 'lore_crete',
    tag: '죽은 이의 망령을 접수하고 돌려보내는 동맹의 관청 행성.',
    bullets: [
      '동맹 곳곳에서 생긴 망령을 받아 심사하고 안식시킨다. 해마다 3억 건 가까이 접수되고, 평균 3년을 기다린다.',
      '신좌 하데스는 변덕이 없다. 사제들은 정해진 기도문 1,364종으로 그에게 묻는다.',
      '성운을 돌며 위험한 망령을 거두는 이송관을 \'죽음의 뱃사공\'이라 부른다.',
    ],
    rel: { units: ['phyllis'], fields: ['crete'] },
  },
  {
    id: 'cyprus', group: 'region', bloc: 'alliance', name: '키프로스', mark: 'HEL', art: 'lore_cyprus',
    tag: '별빛 없는 붉은 성운 속, 동맹을 먹여 살리는 우주 공방.',
    bullets: [
      '항성 없는 소행성대에 세운 공방이라, 사람이 피운 불이 유일한 빛이다.',
      '화로선, 스파르타의 심장로 촉매 같은 동맹 공업품 대부분이 여기서 나온다.',
      '등대가 꺼진 뒤 화로선이 동맹 물류를 떠맡아 늘 병목이 생긴다.',
    ],
  },
  {
    id: 'olympus', group: 'region', bloc: 'alliance', name: '올림푸스', mark: 'HEL', art: 'lore_olympus',
    tag: '항성 하나를 통째로 감싼 다이슨 스피어. 동맹 최대의 발전소.',
    bullets: [
      '에너지는 넘치지만 등대가 꺼진 뒤 밖으로 보낼 길이 없다. 30년째 배터리에 쌓이기만 한다.',
      '신좌 제우스는 그날 이후 신탁을 거의 내리지 않는다. 동맹에서는 \'은둔\'이라고 부른다.',
      '무인 포격 체계와 소형 콜로서스가 지킨다.',
    ],
    rel: { units: ['iris'], fields: ['olympus'] },
  },
  {
    id: 'alexandria', group: 'region', bloc: 'alliance', name: '알렉산드리아', mark: 'HEL', art: 'lore_alexandria',
    tag: '동맹 · 제국 · 연합이 함께 사절을 두는 중립 도시.',
    bullets: [
      '해가 없는 떠돌이 행성에 고대 등대와 도서관이 서 있고, 진짜 도시는 그 위를 감싼 정거장 무리다.',
      '제국은 이곳을 \'레-콘조르\'라 부른다. 이름조차 합의가 안 되는 \'동맹의 화약고\'다.',
      '537년 아문센과의 접촉을 계기로 연합과 통신이 트였고, 지금의 중립 체제가 섰다.',
    ],
    rel: { units: ['amundsen'], lore: ['pan'] },
  },
];

export const LORE_BY_ID: Record<string, LoreEntry> = Object.fromEntries(LORE.map((e) => [e.id, e]));
/** 세력 항목의 지역 (bloc 으로 거꾸로 찾음) */
export const loreRegionsOf = (id: string) => LORE.filter((e) => e.bloc === id);
/** 어절 수 (분량 검사용) */
export const loreWords = (e: LoreEntry) => [e.tag, ...e.bullets].join(' ').split(/\s+/).filter((w) => w && w !== '·').length;
