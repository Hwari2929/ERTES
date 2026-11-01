// 인물별 말투 4칸 시트 (대사 지침 6차): ① 대상별 어체 · 호칭 ② 주 어미 · 담화표지 ③ 버릇 하나 ④ 버릇이 깨지는 조건.
// 사람이 읽는 판은 docs/VOICES.md '대상별 어체 · 4칸 시트' 표, 검사는 tests/banter_lint.ts (경고). 근거 · 출처는 VOICES 각 인물 항목과 lore/인물.
// 어체: ban 반말(해체 · 해라체) · yo 해요체 · hap 합쇼체 · hage 하게체 · hao 하오체 · da '~다' 단정 단문 · cry 울음소리만 · mix 섞어 씀.
// to 의 who: 인물 id 목록, 또는 집단 — elder (화자보다 나이 많은 사람, 나이를 알 때) · younger · elvestad (엘베스타드 일가, ELVESTAD) · crew (에란테스 정규 단원) ·
//   stranger (처음 보는 사람 · 손님) · superior (위계상 윗사람) · petra (페트라 사람). 개별 id 규칙이 집단 규칙보다 먼저다.
export type Reg = 'ban' | 'yo' | 'hap' | 'hage' | 'hao' | 'da' | 'cry' | 'mix';
export const REG_NAME: Record<Reg, string> = { ban: '반말', yo: '해요체', hap: '합쇼체', hage: '하게체', hao: '하오체', da: '단정 단문', cry: '울음소리', mix: '섞어 씀' };
export interface VoiceTo { who: string | string[]; reg: Reg; title?: string }
export interface VoiceSheet {
  name: string; age: number | null; base: Reg; to: VoiceTo[]; titles: Record<string, string>;
  endings: string[]; marker: string; quirk: string; breaks: { surface: string; real: string | null };
}
/** 엘베스타드 일가 (lore/_틀/틀-엘베스타드.md): 비페르소 · 지빌 · 레이첼(입양). 본가 고용인(시그문드 · 구닐라 · 라스무스)은 넣지 않는다 */
export const ELVESTAD = ['amundsen', 'bjorn', 'oliver', 'rachel', 'lars', 'ingel', 'skadi'];
export const VOICE: Record<string, VoiceSheet> = {
  rachel: {
    name: '레이첼', age: null, base: 'ban',
    to: [{ who: 'stranger', reg: 'yo' }, { who: 'crew', reg: 'ban' }, { who: 'elvestad', reg: 'ban' }, { who: ['amundsen'], reg: 'ban', title: '아빠' }, { who: ['aiden'], reg: 'ban', title: '에이든' }, { who: ['temur'], reg: 'ban', title: '테무르 · 너' }],
    titles: { amundsen: '아빠', aiden: '에이든', temur: '테무르' },
    endings: ['~잖아', '~야 / ~거야', '~해?'], marker: '그럼', quirk: '꼭 지금 해야 돼?',
    breaks: { surface: '먹을 것(밥 · 푸딩 · 핫초코 · 체리) 앞에서만 눈이 커지고 문장이 길어진다.', real: null },
  },
  amundsen: {
    name: '아문센', age: 66, base: 'hage',
    to: [{ who: 'crew', reg: 'hage' }, { who: ['rachel'], reg: 'hage', title: '레이첼 · 자네 (놀릴 땐 \'지휘관 나으리\')' }, { who: 'elvestad', reg: 'hage' }, { who: 'elder', reg: 'hage' }, { who: 'stranger', reg: 'hage' }],
    titles: { rachel: '레이첼 · 자네', lars: '라르스 · 자네', aiden: '에이든' },
    endings: ['~지 않나?', '~군', '~네 / ~일세'], marker: '허허,', quirk: '대답 대신 수수께끼를 낸다 (테세우스의 배 · 땅콩버터 범인 추리)',
    breaks: { surface: '흰머리 얘기가 나오면 시무룩해져 장난 없이 짧게 단정한다 (\'갑자기 이렇게 됐네. 하룻밤 사이에.\').', real: '레이첼 얘기가 나오면 장난이 한 박자 늦고 질문 대신 단정으로 끝맺는다 / 편하고 안전한 길이 보이면 일부러 다른 길을 고르고 \'그쪽이 재미없지 않나\'로 둘러댄다.' },
  },
  aiden: {
    name: '에이든', age: null, base: 'mix',
    to: [{ who: 'crew', reg: 'mix' }, { who: 'stranger', reg: 'mix' }, { who: ['rachel'], reg: 'mix', title: '핫초코 곱빼기 손님' }, { who: ['amundsen'], reg: 'mix', title: '와인 손님 (남에게 말할 땐 \'단장님\')' }],
    titles: { rachel: '핫초코 곱빼기 손님', amundsen: '와인 손님', yelena: '다크 링거 손님', temur: '고기 손님', vivian: '스튜 손님', west: '숟가락 손님', eleni: '엔진오일 손님', hiiro: '여우 손님', yupito: '렌치 손님', exile: '토마토 수프 손님', donovan: '오빠 손님' },
    endings: ['~입니다', '~죠', '~드릴까요?'], marker: '그럼', quirk: '메뉴판 밖 메뉴 · 정보를 하나 툭 꺼낸다 (\'메뉴판에 없을 뿐이죠\')',
    breaks: { surface: '불리하면 고양이로 변해 그루밍한다 — 말이 끊기고 대답은 지문으로 대신한다.', real: '구인류 · 옛날 얘기가 진지해지려 하면 주문을 일부러 틀리게 부르며 잔을 닦는다 / 진짜 중요한 순간 1번만 이름을 부른다.' },
  },
  lindiwe: {
    name: '린디웨', age: 30, base: 'yo',
    to: [{ who: 'crew', reg: 'yo' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['aiden'], reg: 'yo', title: '에이든 님' }, { who: 'petra', reg: 'yo', title: '부장님 (라르스 부장님)' }, { who: 'stranger', reg: 'yo', title: '~씨 / 직함' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', aiden: '에이든 님', lars: '라르스 부장님', grenholm: '부장님', bjorn: '비외른 대장님', orca: '오르카', phyllis: '필리스' },
    endings: ['~거든요', '~잖아요', '~할게요'], marker: '음,', quirk: '장부 항목 이름을 붙인다 (\'장부엔 \'고양이 관련 경비\'로 적을게요\')',
    breaks: { surface: '고양이 · 털 짐승 앞에서 업무가 멈추고 느낌표가 나온다 (\'어머, 배 보여 줬어요.\') / 협상에 들어가면 톤이 내려앉고 문장이 짧아진다.', real: '계약이 끝나 떠나는 사람이 생기면 정산을 한 번 더 검토한다며 서류를 붙잡는다 (작별 대신 장부) / 반죽을 내려찍다 들키면 \'복싱 연습\'으로 정정하고 더 밝게 웃는다.' },
  },
  yelena: {
    name: '예레나', age: 36, base: 'yo',
    to: [{ who: 'crew', reg: 'yo' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['bill'], reg: 'yo', title: '위원님' }, { who: ['aiden'], reg: 'yo', title: '에이든' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', bill: '위원님', aiden: '에이든' },
    endings: ['~죠', '~해 두세요', '~거예요'], marker: '결론부터요.', quirk: '기록 정정 요청 넣을게요.',
    breaks: { surface: '술이 3잔을 넘으면 시크함이 무너져 말끝이 늘어지고 \'…아무한테도 말하지 마요\'가 붙는다 (가챠 천장 한탄).', real: '누가 떠난 얘기(이직 · 탈주 · 퇴단)가 나오면 \'더 큰 판으로 간 거죠\'라고 정정해 준다 / 4번째 잔에서 아문센에게 거절당한 날을 한 줄 흘리고 다음 날 \'기록 정정 요청\'을 넣는다.' },
  },
  orca: {
    name: '오르카', age: 70, base: 'hap',
    to: [{ who: 'crew', reg: 'hap' }, { who: ['rachel'], reg: 'hap', title: '지휘관님' }, { who: ['franze'], reg: 'hap', title: '프란체 씨' }, { who: ['amundsen'], reg: 'hap', title: '단장님' }, { who: 'stranger', reg: 'hap' }],
    titles: { rachel: '지휘관님', franze: '프란체 씨', yelena: '예레나 씨', gunnir: '구닐라 씨', amundsen: '단장님' },
    endings: ['~습니다', '~죠', '~더군요'], marker: '미리 말씀드리죠.', quirk: '상담이라더니 자기 여자친구 이야기부터 꺼낸다 (\'먼저 제 3번째 여자친구 이야기부터\')',
    breaks: { surface: '요리 · 바닷물 염도처럼 자존심 걸린 얘기엔 숫자가 소수점까지 내려가고 말이 빨라진다 (표정은 그대로).', real: '분식 회계 얘기가 나오면 \'포장\'이라는 단어로 정정하며 말 속도만 빨라진다 / 상담이 끝날 때가 되면 다음 회차 날짜부터 잡는다 (혼자 남는 저녁을 만들지 않는다).' },
  },
  franze: {
    name: '프란체', age: 38, base: 'hap',
    to: [{ who: 'crew', reg: 'hap' }, { who: ['rachel'], reg: 'hap', title: '지휘관님' }, { who: ['orca'], reg: 'hap', title: '오르카' }, { who: ['amundsen'], reg: 'hap', title: '아문센 단장님' }, { who: ['exile'], reg: 'hap' }],
    titles: { rachel: '지휘관님', orca: '오르카', chloe: '클로에 씨', yelena: '예레나 씨', amundsen: '아문센 단장님' },
    endings: ['~습니다', '~지요', '~습니까?'], marker: '이의 있습니다.', quirk: '머리에 불이 붙어도 하던 말을 끝낸다 (\'…계속하지요. 제3항입니다.\')',
    breaks: { surface: '인사 · 사과 · 감사에서 110년 전 크림슨 예법이 튀어나온다 (\'송구하옵니다\') / 오르카 앞에서는 침착이 깨지고 쉽게 발끈한다.', real: '빈 시간이 생기면 즉시 판례 · 주식 시세 · 화분으로 채운다 / 기록 · 묘비 · \'가짜\' 얘기가 나오면 증거를 요구하면서도 \'기록은 틀릴 수 있습니다\'를 덧붙인다.' },
  },
  zephyro: {
    name: '제피로', age: 28, base: 'ban',
    to: [{ who: 'crew', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: ['amundsen'], reg: 'ban', title: '단장' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '지휘관', amundsen: '단장', argon: '영감', phyllis: '필리스 · 너' },
    endings: ['~지?', '~인데.', '~잖아'], marker: '왜?', quirk: '돌아가는 길부터 꺼낸다 (\'그 길 왜 가? 저쪽이 안전한데\')',
    breaks: { surface: '재밌는 말싸움거리가 생기면 반쯤 일어나 말이 길어진다.', real: '위험과 보상을 맞바꾸는 선택지가 나오면 따지기도 전에 돌아가는 길부터 꺼낸다 / 아버지 · 팔 얘기가 나오면 대답 대신 몸을 눕히고 화제를 항로로 돌린다.' },
  },
  hiiro: {
    name: '히이로', age: null, base: 'mix',
    to: [{ who: 'crew', reg: 'mix' }, { who: ['rachel'], reg: 'mix', title: '레이첼' }, { who: 'stranger', reg: 'mix' }],
    titles: { rachel: '레이첼', orca: '오르카', aiden: '에이든', west: '웨스트' },
    endings: ['~네요…', '~려나', '~거든요'], marker: '글쎄요…', quirk: '점괘 뒤에 간식값을 청구한다 — 액수가 매번 다르고 5c를 넘지 않는다',
    breaks: { surface: '점괘를 풀이할 때만 웃음이 사라지고 문장이 또렷해진다 (반말 꼬리 없이 맺는다).', real: '정체 · 과거를 물으면 더 하찮은 점괘 하나로 답하고 간식값을 청구한다 / 점괘가 맞았다고 축하받으면 아무 반응 없이 다음 간식 얘기를 한다.' },
  },
  vivian: {
    name: '비비안', age: 24, base: 'ban',
    to: [{ who: 'crew', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '레이첼' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['winter'], reg: 'yo', title: '교수님' }, { who: ['zina'], reg: 'yo', title: '지나 아줌마' }, { who: ['ingel'], reg: 'ban', title: '잉겔 언니' }, { who: ['sigmund', 'rasmus'], reg: 'yo' }],
    titles: { rachel: '레이첼', amundsen: '단장님', gebek: '아저씨', west: '아저씨', winter: '교수님', zina: '지나 아줌마', ingel: '잉겔 언니' },
    endings: ['~야!', '~잖아!', '~지?'], marker: '흠흠-', quirk: '처음 본 생물마다 \'이름 지어도 돼?\'',
    breaks: { surface: '게베크가 철 지난 유행어를 쓰면 대리 수치심에 텐션이 꺾인다 (\'…아저씨, 그거 몇 년 전 말이야.\').', real: '브샤크 · 부모 얘기가 나오면 즉시 수첩을 펴고 동물 이름 짓기로 달아나고 목소리가 한 톤 높아진다 / 누가 울면 눈치 없는 척 큰 소리로 딴 얘기를 한다.' },
  },
  nadir: {
    name: '나디르', age: 24, base: 'yo',
    to: [{ who: 'crew', reg: 'yo' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['kairo'], reg: 'yo', title: '카이로 형 · 형' }, { who: ['bianca'], reg: 'yo', title: '선생님' }, { who: ['aiden'], reg: 'yo', title: '에이든 님' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', kairo: '카이로 형', bianca: '선생님', aiden: '에이든 님' },
    endings: ['~잖아요!', '~거예요', '~할게요'], marker: '잠깐만요,', quirk: '이차원 주머니에서 잡동사니를 늘어놓다 엉뚱한 게 나온다 (\'젤리, 수정, 껌, …어, 샴페인?\')',
    breaks: { surface: '취하면 갑자기 철학을 늘어놓다 운다 (\'…우리는 왜 사는 걸까요… 흑.\').', real: '금서 · \'읽힌\' 얘기가 나오면 \'연구 과제\'라고 바꿔 부르고 목소리가 커지며, 어둠 속에 혼자 있는 걸 피한다 / 취한 다음 날은 아무 일 없던 듯 더 시끄럽다.' },
  },
  mirinae: {
    name: '미리내', age: 29, base: 'ban',
    to: [{ who: 'elder', reg: 'yo' }, { who: 'younger', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '레이첼' }, { who: ['donovan'], reg: 'ban', title: '도노반' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['west'], reg: 'yo', title: '아저씨' }],
    titles: { rachel: '레이첼', amundsen: '단장님', west: '아저씨', donovan: '도노반' },
    endings: ['~지 뭐', '~거든', '~던데'], marker: '음,', quirk: '말끝을 늘인다 (\'-\')',
    breaks: { surface: '할부 · 통장 숫자가 나오면 태평함이 잠깐 멈추고 계산부터 한다 (\'…의자 하나에 7개월이면, 텐트는 몇 년이지?\').', real: '같은 자리 · 같은 일이 길어지면 다음 캠핑지나 이직 얘기를 꺼낸다 (이유는 매번 그럴듯하다) / 힘들어하는 사람이 보이면 툭 한마디 위로를 하고 바로 딴 데를 본다.' },
  },
  gebek: {
    name: '게베크', age: 57, base: 'ban',
    to: [{ who: 'crew', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: ['amundsen'], reg: 'ban', title: '단장 양반' }, { who: ['zina'], reg: 'ban', title: '지나' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '지휘관', amundsen: '단장 양반', zina: '지나', west: '이 양반', argon: '영감님' },
    endings: ['~구먼', '~지!', '~더라'], marker: '이 양반이,', quirk: '철 지난 유행어를 어설프게 쓰고 \'맞지?\'로 확인한다 (\'킹받는다\' · \'갓배\')',
    breaks: { surface: '유행어가 틀렸다는 걸 들키면 바로 수긍한다 (\'…비비안 표정 보니 아니구먼.\').', real: '협상 상대 앞에선 일부러 바보 연기로 과소평가하게 만들고 그사이 숫자를 센다 / 가족이 위협받으면 유행어가 사라지고 문장이 짧아진다 (코르도 뒷골목 말투) — 황무지 시절은 농담 없이 짧게만 말한다.' },
  },
  phyllis: {
    name: '필리스', age: 25, base: 'ban',
    to: [{ who: 'crew', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '레이첼' }, { who: ['zephyro'], reg: 'ban', title: '너 · 제피로' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '레이첼', west: '아저씨', zephyro: '제피로', eleni: '엘레니' },
    endings: ['~야-', '~거든', '~지?'], marker: '아,', quirk: '훔친 걸 \'긴급 조달\'이라 고쳐 부른다',
    breaks: { surface: '무거운 얘기가 나오면 0.5초 만에 도망간다 (\'나 쉬러 간다-!\').', real: '추모 · 위령 · 죽음 얘기가 나오면 장난으로 달아나다 크레타 기도문 한 구절이 무심코 정확하게 튀어나온다 (\'아, 이거 기도문이다. 방금 거 없던 걸로.\') / 사제단이 그리워질 땐 쫓겨난 날 얘기를 일부러 꺼내 덮는다.' },
  },
  temur: {
    name: '테무르', age: 23, base: 'ban',
    to: [{ who: 'crew', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '주인님' }, { who: 'superior', reg: 'ban', title: '주인님 / 당신' }, { who: ['amundsen'], reg: 'ban', title: '단장님' }],
    titles: { rachel: '주인님', amundsen: '단장님', grenholm: '당신', lars: '당신 · 주인님' },
    endings: ['~냐?', '~잖아', '~거야'], marker: '그럼', quirk: '모르는 말을 밥 · 고기 · 돈으로 바꿔 되묻는다 (\'고기로 치면 몇 근이야\')',
    breaks: { surface: '얼음 · 찬 컵을 만지면 고양이 같은 비명을 지른다 (말이 끊긴다).', real: '돌을 깎기 시작하면 말이 끊기고 밥 냄새에도 고개를 안 든다 / 강해 보이는 사람 · 돈 주는 사람 앞에서는 자동으로 \'주인님\'이 나온다 (본인은 말버릇이라 한다).' },
  },
  eleni: {
    name: '엘레니', age: null, base: 'hap',
    to: [{ who: 'crew', reg: 'hap' }, { who: ['rachel'], reg: 'hap', title: '지휘관님' }, { who: ['amundsen'], reg: 'hap', title: '단장님' }, { who: ['aiden'], reg: 'hap', title: '에이든 님' }, { who: ['west'], reg: 'hap', title: '웨스트 님' }, { who: 'stranger', reg: 'hap' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', aiden: '에이든 님', west: '웨스트 님', phyllis: '필리스' },
    endings: ['~입니다', '~십시오', '~습니까?'], marker: '보안 의식 유지 중입니다.', quirk: '대검은 \'위협용\'이라고 강조한다 (\'…정말입니다.\')',
    breaks: { surface: '똥 · 방귀 얘기에 \'푸흡\'으로 합쇼체가 깨진다 (제어 불가) / 꿀 바클라바 4번째 조각 · 성숙한 미남 앞에서 \'보안 의식\'이 흔들린다.', real: '로도스 얘기가 나오면 \'제가 더 할 수 있었습니다\'로 정리하고 참회를 선언한다 — 대본은 \'확인 불가. 기록이 없습니다.\'로 끊는다 / 영혼과 대화한 직후 방금 한 약속을 되묻는다.' },
  },
  kairo: {
    name: '카이로', age: 33, base: 'mix',
    to: [{ who: 'crew', reg: 'mix' }, { who: ['rachel'], reg: 'mix', title: '지휘관' }, { who: ['bianca'], reg: 'hage', title: '비앙카 선생 · 선생' }, { who: ['amundsen'], reg: 'hage', title: '단장' }, { who: ['nadir'], reg: 'mix', title: '자네' }],
    titles: { rachel: '지휘관', bianca: '선생', amundsen: '단장', nadir: '자네' },
    endings: ['~군', '~네', '~하게'], marker: '귀찮군.', quirk: '사감은 없네.',
    breaks: { surface: '반 잔에 취하면 하게체가 풀리고 같은 말을 되풀이한다 (\'선생… 그 그림, 무명 작가… 내가 샀네…\').', real: '고맙다고 말해야 할 때 빈정 한 줄로 대신하고 계산서를 먼저 집는다 / 형 얘기가 나오면 대답 없이 기도서 뒷표지를 엄지로 문지른다.' },
  },
  donovan: {
    name: '도노반', age: 29, base: 'ban',
    to: [{ who: 'crew', reg: 'ban' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['chloe'], reg: 'ban', title: '너' }, { who: ['bill'], reg: 'ban' }, { who: ['kkaak'], reg: 'hap', title: '리비볼드 경' }],
    titles: { amundsen: '단장님', chloe: '너', kkaak: '리비볼드 경' },
    endings: ['~냐', '…됐냐', '~지'], marker: '몰라.', quirk: '유행어 뜻을 진지하게 묻는다 (\'…\'갓생\'이 뭔데. 진짜로 묻는 거야.\')',
    breaks: { surface: '일을 시작하면 투덜거림이 사라지고 소리 없이 끝낸다 / 비비안이 보스를 보러 오면 털 날린다며 싫은 척하면서 미리 빗질해 둔다.', real: '능력을 오래 쓰고 난 뒤에는 저녁 메뉴 · 사료값 · 휴가 날짜를 유난히 집요하게 묻는다 / 사람을 숫자로 말하기 시작하면 까악이나 동료가 끊어 줘야 멈춘다.' },
  },
  iris: {
    name: '이리스', age: 27, base: 'yo',
    to: [{ who: 'crew', reg: 'yo' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: 'stranger', reg: 'yo', title: '~씨' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', odysseus: '오디세우스 씨', zephyro: '제피로 씨', zina: '지나 씨' },
    endings: ['~이에요', '~거예요', '~죠'], marker: '저,', quirk: '헤르메스님 얘기가 나오면 속사포로 폭주한다 (\'그분은 정말, 정말—!\')',
    breaks: { surface: '헤르메스 스위치가 켜지면 수줍은 말투가 속사포로 바뀌고 복도에서 벽에 부딪힌다.', real: '군체 얘기가 나오면 헤르메스 수다가 뚝 끊기고 또박또박한 논리로 바뀐다 / 고마움과 분노가 같이 올라오면 \'감사\'와 \'사명\'으로 나눠 따로 말한다.' },
  },
  zahara: {
    name: '자하라', age: 26, base: 'ban',
    to: [{ who: ['rachel'], reg: 'ban', title: '레이첼' }, { who: ['amundsen'], reg: 'ban', title: '단장' }, { who: 'crew', reg: 'ban' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '레이첼', amundsen: '단장' },
    endings: ['~야', '~네', '~지'], marker: '…그래서?', quirk: '구도 · 조명 평가로 말을 맺는다 (\'구도 별로네.\' · \'역광이야.\')',
    breaks: { surface: '카메라를 들면 지시가 정확하고 길어진다 · 과일 디저트 앞에서는 \'…하나만.\' 하고 몰래 집는다', real: '친해지기 직전 → 신랄한 한마디로 간격을 되돌린다 (\'친해지려는 거 아니야.\') / 유랑령 얘기 → 책임 얘기만 짧게 하고 \'능력 있는 쪽이 맡으면 돼\'로 덮는다' },
  },
  romani: {
    name: '로마니', age: 33, base: 'ban',
    to: [{ who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['kyle'], reg: 'ban', title: '너 · 카일' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: 'crew', reg: 'ban' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '지휘관', amundsen: '단장님', kyle: '너 · 카일' },
    endings: ['~거든?', '~지? 다 보여.', '~잖아'], marker: '아니,', quirk: '\'다 보여.\' — 첫 3마디 안에 상대 약점을 짚고 이 말로 맺는다',
    breaks: { surface: '칭찬받으면 더듬으며 바로 부정한다 (\'그, 그건 고맙… 아니, 업무니까요.\')', real: '칭찬을 들으면 → 부정한 뒤 그 상대를 지나치게 챙기며 자꾸 확인한다 (\'아니지? 진짜?\') / 그 상대가 다른 사람과 웃으면 → 갑자기 존댓말로 바뀐다' },
  },
  bianca: {
    name: '비앙카', age: 35, base: 'hap',
    to: [{ who: ['behemoth'], reg: 'ban', title: '베헤모스' }, { who: ['rachel'], reg: 'hap', title: '지휘관님' }, { who: ['amundsen'], reg: 'hap', title: '단장님' }, { who: 'crew', reg: 'hap', title: '○○ 씨' }, { who: 'stranger', reg: 'hap', title: '○○ 씨' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', yelena: '예레나 씨', temur: '테무르 씨', kairo: '카이로 씨', chloe: '클로에 씨', aiden: '에이든 씨', kyle: '카일 씨' },
    endings: ['~입니다', '~하십시오', '~습니까'], marker: '그럼,', quirk: '수치로 보고하고 \'효율적입니다\'로 판정한다',
    breaks: { surface: '단 것부터 먹으면서 \'선호는 없습니다\'라고 한다 — 본인 대사가 아니라 지문 · 남의 관찰로 보여 준다 (ask: 디저트 접시만 비어 있다)', real: '감정 반응이 필요한 순간 → 연습한 표정을 번호로 수행하고 결과를 묻는다 (\'지금 표정이 맞습니까?\') / 처음 보는 생물 · 설명 안 되는 현상 앞 → 질문이 빨라지고 문장이 짧아진다 (유일하게 들뜨는 때)' },
  },
  joshua: {
    name: '조슈아', age: 57, base: 'yo',
    to: [{ who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: 'crew', reg: 'yo', title: '이름만 (나디르 · 클로에 · 비비안)' }, { who: 'stranger', reg: 'yo', title: '○○ 분' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', nadir: '나디르', chloe: '클로에', vivian: '비비안' },
    endings: ['~요', '~거든요', '~죠'], marker: '아,', quirk: '\'미리 사과할게요.\'',
    breaks: { surface: '머리끝이 붉어지면 → 사과가 습관에서 경고로 바뀌고 체사레가 나온다', real: '누군가를 도운 직후 → 득실을 따진 자신을 알아채고 \'미리 사과할게요\'가 나온다 / 체사레가 싸우고 물러난 뒤 → 말없이 자리를 비웠다가, 돌아와서는 아무 일 없다는 듯 해장약을 나눠 준다' },
  },
  chloe: {
    name: '클로에', age: 27, base: 'yo',
    to: [{ who: ['donovan'], reg: 'yo', title: '오빠' }, { who: ['bill'], reg: 'yo', title: '아버지' }, { who: ['franze'], reg: 'yo', title: '선배' }, { who: ['bianca'], reg: 'yo', title: '선생님' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'crew', reg: 'yo', title: '○○ 씨' }],
    titles: { rachel: '지휘관님', donovan: '오빠', bill: '아버지', franze: '선배', bianca: '선생님', romani: '로마니 씨', zephyro: '제피로 씨', cesare: '체사레 씨' },
    endings: ['~이신가요?', '~잖아요', '~죠'], marker: '어머,', quirk: '자신을 \'이 숙녀\'라고 부른다',
    breaks: { surface: '술자리가 무르익으면 조용히 졸다가 \'…안 잤어요. 눈 감고 배합 생각했어요.\'', real: '누가 연락 없이 사라지면(특히 오빠) → 태연한 척하며 머리만 뜬 사진을 연달아 보낸다 / 기억 지우는 약 얘기는 태연하게 하면서, 사람이 \'없어지는\' 얘기엔 화제를 돌린다 (talk wipe \'…오빠는 없죠? 아, 아니에요.\')' },
  },
  west: {
    name: '웨스트', age: 58, base: 'ban',
    to: [{ who: ['amundsen'], reg: 'ban', title: '단장' }, { who: ['rachel'], reg: 'ban', title: '지휘관 (가끔 \'레이첼\')' }, { who: ['winter'], reg: 'ban', title: '(부르지 않음)' }, { who: 'crew', reg: 'ban' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '지휘관', amundsen: '단장', yupito: '유피토 · 너', zephyro: '제피로', hiiro: '히이로' },
    endings: ['~잖아', '~더라', '~다 (해라체: \'볕 좋다\' · \'간다\')'], marker: '흠.', quirk: '\'일단 담배 한 대 피고.\' — 일 얘기 앞에 담배부터',
    breaks: { surface: '규격 안 맞는 물건을 보면 → 말이 빨라지고 공구부터 꺼낸다 (\'유피토지? 유피토잖아.\')', real: '일이 다 끝나면 → 바로 다음 고칠 거리를 찾는다 (할 일 없는 밤에 가장 날카롭다) / 윈터 얘기 → 감정 없는 단답으로 끝낸다. 아내 얘기 근처 → 공구를 집는다' },
  },
  yupito: {
    name: '유피토', age: 46, base: 'ban',
    to: [{ who: ['amundsen'], reg: 'ban', title: '아문센 (뒤에선 \'단장\')' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: ['west'], reg: 'ban', title: '웨스트' }, { who: 'crew', reg: 'ban' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '지휘관', amundsen: '아문센', west: '웨스트', phyllis: '필리스', joshua: '조슈아', aiden: '에이든', falcon: '케빈' },
    endings: ['~지?', '~거든!', '~잖아!'], marker: '잠깐,', quirk: '\'비장의 한 수\'를 달자고 한다 (대개 폭발)',
    breaks: { surface: '웨스트가 막으면 몰래 한다 · 신나면 의성어 섞인 속사포 · 실수는 \'하하!\'로 넘긴다', real: '해결 안 된 문제가 남으면 → 손을 못 멈추고 밤새 조립한다 / 안전 문제가 나오면 → \'지도자 노릇은 질렸다\'면서 웃음이 빠지고 즉시 지휘한다. 장비마다 사람을 살리는 빨간 손잡이를 단다' },
  },
  sarma: {
    name: '사르마', age: null, base: 'yo',
    to: [{ who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'crew', reg: 'yo', title: '○○ 씨' }, { who: 'stranger', reg: 'yo', title: '○○ 씨 · ○○님' }],
    titles: { rachel: '지휘관님', bianca: '비앙카 씨', hiiro: '히이로 씨 (첫 만남엔 \'점술사님\')', odysseus: '오디세우스 씨', thermo: '테르모필레 씨' },
    endings: ['~네요', '~나요?', '~거든요'], marker: '어,', quirk: '\'아, 실례(했어요).\' — 미래 얘기를 흘리고 사과한다 (매번 변주)',
    breaks: { surface: '신기한 현상(시간 · 공간이 접힘)을 보면 → 들떠서 \'아름답네요\'를 연발하고 위험은 뒤늦게 덧붙인다', real: '' },
  },
  lars: {
    name: '라르스', age: 55, base: 'mix',
    to: [{ who: ['amundsen'], reg: 'mix', title: '형님 (남 앞에선 \'아문센 형님\' · \'단장\')' }, { who: ['ingel', 'skadi'], reg: 'mix', title: '잉겔 · 스카디 (이름만)' }, { who: ['rachel'], reg: 'mix', title: '지휘관님 (바 · 업무) / 레이첼 (집안 얘기)' }, { who: ['sigmund'], reg: 'mix', title: '시그문드 (이름만)' }, { who: ['grenholm'], reg: 'mix', title: '그렌홀름 부장 · 부장님 (놀릴 때 \'할러 씨\')' }, { who: ['mingki'], reg: 'mix', title: '밍키 씨' }, { who: 'crew', reg: 'mix', title: '○○ 씨' }],
    titles: { amundsen: '형님', ingel: '잉겔', skadi: '스카디', rachel: '지휘관님', sigmund: '시그문드', grenholm: '그렌홀름 부장', mingki: '밍키 씨', orca: '오르카 씨', temur: '테무르 씨', lindiwe: '린디웨 씨' },
    endings: ['~습니다', '~군요', '~하죠'], marker: '좋습니다.', quirk: '분 단위 시각을 댄다 (\'17시 58분이군요.\')',
    breaks: { surface: '밍키 앞에서만 거래가 결렬된다 — 값을 올려 부르다 \'또 결렬이군요.\' · 웃음이 어색하다 (\'하, 하.\')', real: '자기 쪽에 손해가 떨어진 일(554년)이 나오면 → \'사고\'라고 부르고 해명하지 않는다 / 거래가 안 되는 상대를 만나면 → 제안서를 쓴다. 가주 일과 부장 일이 겹친 날엔 담배를 꺼낸다' },
  },
  ingel: {
    name: '잉겔', age: 35, base: 'yo',
    to: [{ who: ['amundsen'], reg: 'yo', title: '아문센 아저씨' }, { who: 'elvestad', reg: 'ban' }, { who: ['sigmund', 'gunnir', 'rasmus'], reg: 'yo', title: '이름 (추정)' }, { who: 'crew', reg: 'yo', title: '○○ 씨 (추정)' }, { who: 'stranger', reg: 'yo' }],
    titles: { lars: '아빠 (남 앞에선 \'아버지\')', skadi: '너', oliver: '너 · 바보야', amundsen: '아문센 아저씨', rachel: '레이첼 (추정 — 지금 대본은 \'너\')' },
    endings: ['~어 · ~야 (일가)', '~요 · ~거든요 (일가 밖 — 퉁명한 해요체)', '~요-! (무대)'], marker: '다시,', quirk: '\'누가 물어봤어?\'로 말을 끊는다 (일가 밖에선 \'누가 물어봤어요?\')',
    breaks: { surface: '무대 말투가 새어 나온다 (\'~요-!\' → \'…무대 말투 나왔다. 잊어.\') · 몰래 하는 기타 연습을 들키면 \'못 들은 걸로 해.\'', real: '' },
  },
  skadi: {
    name: '스카디', age: 31, base: 'yo',
    to: [{ who: ['lars'], reg: 'yo', title: '아빠 (남 앞에선 \'아버지\')' }, { who: ['ingel'], reg: 'yo', title: '언니' }, { who: ['amundsen'], reg: 'yo', title: '아문센 아저씨' }, { who: ['grenholm'], reg: 'yo', title: '부장님 · 그렌홀름 부장님' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'crew', reg: 'yo', title: '○○ 씨' }, { who: 'stranger', reg: 'yo', title: '○○ 씨' }],
    titles: { lars: '아빠', ingel: '언니', amundsen: '아문센 아저씨', grenholm: '부장님', rachel: '지휘관님', orca: '오르카 씨', eden: '이든 씨', kaburaya: '카부라야 씨' },
    endings: ['~네요', '~해 볼까요?', '~거든요'], marker: '어머,', quirk: '칭찬하며 스카우트한다 (\'잠재력이 보이네요. 이력서 있어요?\')',
    breaks: { surface: '강등 얘기가 나오면 → 웃으며 \'실장이라고 불러 주세요. 이름은 실장이니까요.\' · 아버지 강등 얘기엔 숫자로 받는다 (\'저는 3년 잡았어요.\')', real: '' },
  },
  oliver: {
    name: '올리버', age: 31, base: 'ban',
    to: [{ who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['argon', 'doros'], reg: 'yo', title: '영감님' }, { who: ['ingel'], reg: 'ban', title: '잉겔 누나' }, { who: 'elvestad', reg: 'ban' }, { who: ['sigmund', 'gunnir', 'rasmus'], reg: 'ban', title: '이름만' }, { who: 'crew', reg: 'ban' }],
    titles: { amundsen: '단장님', argon: '영감님', ingel: '잉겔 누나', rachel: '레이첼', sigmund: '시그문드', gunnir: '구닐라', rasmus: '라스무스', mingki: '밍키', yupito: '유피토', zephyro: '제피로' },
    endings: ['~지?', '~거든!', '~잖아!'], marker: '와,', quirk: 'SNS 말투 \'^^\' · \'오운완~\'',
    breaks: { surface: '위험한 아이디어 앞에서 \'해 보면 어떻게 될까?\' 하고 바로 실행한다', real: '집을 비울 때면 → 밍키와 식구들 당부를 길게, 몇 번이고 반복한다 / 사고를 친 뒤에는 도망치지 않고 제 방식으로 책임을 지는데, 대개 빚이 된다' },
  },
  bjorn: {
    name: '비외른', age: null, base: 'ban',
    to: [{ who: ['amundsen'], reg: 'ban', title: '아문센' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: 'elvestad', reg: 'ban', title: '이름만' }, { who: ['sigmund'], reg: 'ban', title: '시그문드' }, { who: 'crew', reg: 'ban' }, { who: 'stranger', reg: 'ban' }],
    titles: { amundsen: '아문센', rachel: '지휘관', oliver: '올리버', sigmund: '시그문드', rus: '루스' },
    endings: ['~다', '~냐', '~라 (명령: \'앉아라\' · \'발라라\')'], marker: '어디 보자.', quirk: '구조 뒤 청구 항목을 담담히 읊는다 (장면당 1번 이하)',
    breaks: { surface: '다친 사람 앞에서 말이 줄고 손이 빨라진다 · 느낌표는 전투 중 지시 한마디에만 (\'다친 놈 먼저!\')', real: '' },
  },
  sigmund: {
    name: '시그문드', age: null, base: 'hap',
    to: [{ who: ['lars'], reg: 'hap', title: '가주님' }, { who: ['oliver'], reg: 'hap', title: '(올리버) 도련님' }, { who: ['rachel'], reg: 'hap', title: '레이첼 아가씨 (본가 · 집안) / 지휘관님 (바)' }, { who: ['bjorn'], reg: 'hap', title: '비외른 님' }, { who: ['mingki', 'max'], reg: 'hap', title: '밍키 · 맥스 (이름만)' }, { who: 'crew', reg: 'hap', title: '○○ 님' }],
    titles: { lars: '가주님', oliver: '도련님', rachel: '레이첼 아가씨', bjorn: '비외른 님', gunnir: '구닐라 님', rasmus: '라스무스 님', vivian: '비비안 님', mingki: '밍키' },
    endings: ['~습니다', '~하셔야 합니다', '~하시겠습니까?'], marker: '다만,', quirk: '횟수를 세어 \'기록해 두겠습니다\' (장면당 1번 이하)',
    breaks: { surface: '혼란 중에도 넥타이 각도 · 옷매무새를 지적한다', real: '' },
  },
  gunnir: {
    name: '구닐라', age: null, base: 'yo',
    to: [{ who: ['oliver'], reg: 'mix', title: '(올리버) 도련님' }, { who: ['rachel'], reg: 'yo', title: '레이첼' }, { who: 'crew', reg: 'yo' }, { who: 'stranger', reg: 'yo' }],
    titles: { oliver: '도련님', rachel: '레이첼' },
    endings: ['~예요 · ~이에요 (\'규칙이에요\')', '~세요 (\'줄 서세요\')', '~요 (해요체 명령: \'먹어요\')'], marker: '알아요,', quirk: '\'국자 나가요.\' (올리버에겐 \'국자 나갑니다.\')',
    breaks: { surface: '배고픈 사람 앞에서는 규칙보다 먼저 먹인다 (\'배고프면 판단 못 해요.\')', real: '' },
  },
  rasmus: {
    name: '라스무스', age: null, base: 'hao',
    to: [{ who: ['oliver'], reg: 'hao', title: '(올리버) 도련님' }, { who: ['max', 'mingki'], reg: 'hao', title: '맥스' }, { who: 'crew', reg: 'hao' }, { who: 'stranger', reg: 'hao' }],
    titles: { oliver: '도련님', max: '맥스' },
    endings: ['~소', '~오', '~시오'], marker: '맥스.', quirk: '흙 상태로 상황을 읽는다 (\'흙이 젖었소. 위에 물이 있소.\') — 인생 비유로 넓히지 않는다',
    breaks: { surface: '맥스 · 식물 얘기에만 말이 늘어난다 (1~2문장이 서너 문장으로)', real: '' },
  },
  mingki: {
    name: '밍키', age: null, base: 'cry',
    to: [],
    titles: {  },
    endings: ['냐.', '냐아.'], marker: '', quirk: '가장 중요한 자리(결재 서류 · 수첩 · 상점 화면) 위에 눕는다 (지문)',
    breaks: { surface: '츄르 봉지 소리에만 길게 운다 (\'…냐아아.\')', real: '' },
  },
  grenholm: {
    name: '그렌홀름', age: 46, base: 'hap',
    to: [{ who: ['lars'], reg: 'hap', title: '라르스 부장' }, { who: ['rachel'], reg: 'hap', title: '지휘관' }, { who: 'petra', reg: 'hap', title: '이름 + 직함 (케빈 사수 · 린디웨 팀장 · 카부라야 본부장)' }, { who: 'superior', reg: 'hap' }, { who: 'crew', reg: 'hap', title: '○○ 씨 · ○○ 고문' }],
    titles: { lars: '라르스 부장', rachel: '지휘관', falcon: '케빈 사수', lindiwe: '린디웨 팀장', kaburaya: '카부라야 본부장', franze: '프란체 고문', orca: '오르카 씨', phyllis: '필리스 씨' },
    endings: ['~입니까?', '~십시오', '~습니다'], marker: '자료 보시죠.', quirk: '모욕한 뒤 숫자 · 조항 번호로 증명한다 — 욕은 근거를 박는 못',
    breaks: { surface: '\'할러\'라고 불리면 → 554년 적요 번호를 꺼낸다 / 누가 반박하면 → 입꼬리가 올라가고 질문이 늘며 말이 빨라진다 (\'좋습니다. 아주 좋습니다. 계속하시죠.\')', real: '휴가를 권하면 → 업무 일정으로 답하고, 강제 휴가 중에도 뭔가를 \'처리\'하고 돌아온다 / 전쟁 억제의 모순을 짚으면 → 운동 시간 얘기로 넘긴다' },
  },
  falcon: {
    name: '케빈', age: null, base: 'yo',
    to: [{ who: ['grenholm'], reg: 'yo', title: '부장님' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'crew', reg: 'yo', title: '○○ 씨' }, { who: 'stranger', reg: 'yo', title: '○○ 씨' }],
    titles: { grenholm: '부장님', rachel: '지휘관님', oliver: '올리버 씨', u404: 'U-404 씨' },
    endings: ['~요', '~거든요', '~네요'], marker: '보통', quirk: '사고를 보고서 번호로 센다 (\'1,203번째요.\')',
    breaks: { surface: '터지기 직전에만 합쇼체 카운트다운 (\'곧 터집니다. 3, 2—\') — 다들 대피하는데 본인은 침착하다', real: '' },
  },
  u404: {
    name: 'U-404', age: null, base: 'hap',
    to: [{ who: ['rachel'], reg: 'hap', title: '지휘관' }, { who: ['grenholm'], reg: 'hap', title: '부장님' }, { who: 'younger', reg: 'hap' }],
    titles: { rachel: '지휘관', grenholm: '부장님' },
    endings: ['~습니다 (다시 시도합니다)', '~입니까 (질문)', '명사 + 마침표 (보고 항목: \'상자 41개 운반.\')'], marker: '질문.', quirk: '끝에 다음 목표를 올려 붙인다 (\'내일 목표 45개.\' · \'다음 분기 41개 제안.\')',
    breaks: { surface: '목표로 바꿀 수 없는 말(휴식 · 좋아하는 것 · 꿈)을 받으면 \'오류.\' 뒤에 \'…\' 하고 멈췄다가 상자 얘기로 돌아간다 (16.20 \'…상자 4개.\' · 21.46 \'…대기.\')', real: null },
  },
  kaburaya: {
    name: '카부라야', age: 21, base: 'hap',
    to: [{ who: ['mao'], reg: 'hap', title: '회장님' }, { who: ['rachel'], reg: 'hap', title: '지휘관님' }, { who: ['reika'], reg: 'hap' }, { who: 'younger', reg: 'hap' }],
    titles: { mao: '회장님', rachel: '지휘관님' },
    endings: ['~입니다', '~해도 됩니까', '~(이)라서요 (덧붙임 꼬리)'], marker: '…아, 네.', quirk: '지금 시각을 분 단위로 댄다 (\'…17시 59분입니다.\')',
    breaks: { surface: '퇴근(18시)이 걸리면 무기력이 풀려 \'처음으로 ~\' 문형이 나온다 (02.23 \'처음으로 상사가 마음에 듭니다.\' · 10.1 \'처음으로 기대되는 리스크입니다.\')', real: null },
  },
  reika: {
    name: '레이카 0호', age: null, base: 'ban',
    to: [{ who: ['mao'], reg: 'yo', title: '회장님' }, { who: ['kaburaya'], reg: 'yo', title: '본부장님' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: ['ingel', 'zahara', 'hiiro'], reg: 'ban', title: '언니' }, { who: 'elder', reg: 'ban', title: '아저씨 · 언니' }],
    titles: { rachel: '지휘관', mao: '회장님', kaburaya: '본부장님', ingel: '잉겔 언니', zahara: '자하라 언니', hiiro: '언니', gebek: '게베크 아저씨' },
    endings: ['~할게~☆', '~야~ / ~어~', '~(이)래~ (채팅 전달)'], marker: '안녕안녕~', quirk: '채팅 반응을 중계한다 (\'채팅 ~ 도배~☆\')',
    breaks: { surface: '방송을 끄라는 말을 들으면 \'끄면… 어떻게 되지?\' 하고 한 박자 멈췄다가 \'클립만 따 줘~☆\'로 덮는다 (talk topic.offair · ask dream1)', real: null },
  },
  mao: {
    name: '마오', age: null, base: 'yo',
    to: [{ who: ['kaburaya'], reg: 'yo', title: '본부장' }, { who: ['lindiwe'], reg: 'yo', title: '린디웨 씨' }, { who: ['rachel'], reg: 'yo' }, { who: 'younger', reg: 'yo' }],
    titles: { kaburaya: '본부장', lindiwe: '린디웨 씨' },
    endings: ['~하실래요?', '~죠 (제가 사죠)', '~이고요'], marker: '어머,', quirk: '말끝을 계약으로 맺는다 (\'서명은 여기.\')',
    breaks: { surface: '상대가 자기 화법(공짜 잔 · 조건)을 되쓰면 \'…어머.\' 하고 말이 막힌다 (03.9 · 20.26 \'어머, 제 화법이네요.\')', real: null },
  },
  exile: {
    name: '망명 혈족 귀공자', age: null, base: 'hao',
    to: [{ who: ['franze'], reg: 'hao', title: '그대' }, { who: ['argon'], reg: 'hao', title: '뱃사공' }, { who: ['rachel'], reg: 'hao', title: '그대' }, { who: 'younger', reg: 'hao', title: '그대' }],
    titles: { rachel: '그대', franze: '그대 (남 앞에선 \'저 혈족\')', argon: '뱃사공', aiden: '그대' },
    endings: ['~하오 / ~이오', '~소 (다행이오 · 괜찮소)', '~시오 (청유 · 명령)'], marker: '그대,', quirk: '\'피 말고\' 덧붙이기 (\'수프. 피 말고.\')',
    breaks: { surface: '프란체가 대낮에 멀쩡한 걸 보면 예의가 깨져 \'…미친 것이오.\'가 나오고, 곧 \'존경하오\'로 수습한다 (09.31 · 19.14 · talk topic.franze)', real: null },
  },
  bill: {
    name: '빌', age: 60, base: 'hage',
    to: [{ who: ['donovan', 'chloe'], reg: 'hage', title: '자네 / (모르는) 아가씨' }, { who: ['mao'], reg: 'hage', title: '회장님' }, { who: ['rachel'], reg: 'hage', title: '지휘관' }, { who: 'younger', reg: 'hage', title: '~ 군 · ~ 양 · ~ 교수 · 자네' }],
    titles: { rachel: '지휘관 (부를 땐 \'지휘관 양반\')', aiden: '바텐더 양반', winter: '윈터 교수', eden: '이든 군', issac: 'ISSAC 군', yelena: '예레나 양', mao: '회장님', donovan: '자네', chloe: '(모르는) 아가씨' },
    endings: ['~라네 / ~다네', '~구먼 / ~로군', '~게(나) (신경 쓰지 말게)'], marker: '하하!', quirk: '기념사진 \'김치~!\'',
    breaks: { surface: '자식(도노반 · 클로에) 얘기에 \'모르는 이름이군\' 하다가 걱정이 한 줄 새어 나온다 (09.13 \'자네 탄산 너무 마시는 거 아닌가?\' · 13.34 \'…그거면 됐네.\')', real: null },
  },
  winter: {
    name: '윈터', age: 30, base: 'yo',
    to: [{ who: ['west'], reg: 'yo', title: '아버지' }, { who: ['vivian'], reg: 'yo', title: '비비안' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'younger', reg: 'yo', title: '~ 씨' }],
    titles: { west: '아버지', vivian: '비비안', rachel: '지휘관님', chloe: '클로에 씨', eden: '이든 씨', issac: 'ISSAC 씨', bianca: '비앙카 씨' },
    endings: ['~어요 / ~해요', '~네요 (수치가 끔찍하네요)', '~세요 (손 씻고 드세요)'], marker: '아니,', quirk: '손 씻었는지 · 소독부터 묻는다 (\'손 씻으셨어요?\')',
    breaks: { surface: '제자 비비안에게만 농담을 던졌다가 바로 거둔다 (09.14 \'공저자로 올릴 거예요?\' → \'…농담이에요.\')', real: null },
  },
  issac: {
    name: 'ISSAC', age: null, base: 'hap',
    to: [{ who: ['rachel'], reg: 'hap', title: '지휘관님' }, { who: ['eleni'], reg: 'hap', title: '엘레니 님' }, { who: 'stranger', reg: 'hap', title: '~ 분' }, { who: 'younger', reg: 'hap' }],
    titles: { rachel: '지휘관님', eleni: '엘레니 님', eden: '카운티폴 분' },
    endings: ['~습니다', '~하시지요 / ~십쇼', '~(이)라서요 · ~니까요 (해요 꼬리)'], marker: '실례합니다,', quirk: '\'예의입니다.\' 한마디로 이유를 끝낸다',
    breaks: { surface: '붕대 · 떨어진 팔 얘기에서 정중한 말투 그대로 섬뜩한 한 줄이 나온다 (09.16 \'그럼 정중하게 떨어뜨리겠습니다.\')', real: 'VOICES 새어 나오는 방식: 사이오닉 감응자(오닉스)가 곁에 오면 \'노래\'가 혼자인데 합창으로 들리고, 본인은 웃으며 사람 칭찬으로 돌린다(13.38) / 떨어진 팔 · 손이 본인보다 먼저 움직인다(\'성격이 급해서요\') / 무심코 1인칭이 \'우리\'가 된다 — 정체 고백 · 설명 금지' },
  },
  eden: {
    name: '이든', age: null, base: 'ban',
    to: [{ who: 'elder', reg: 'ban' }, { who: ['bill'], reg: 'ban', title: '그쪽' }, { who: ['rachel'], reg: 'ban' }, { who: 'stranger', reg: 'ban', title: '그쪽 · 너' }],
    titles: { bill: '그쪽', donovan: '그쪽', fotini: '너' },
    endings: ['~지 (그러니까 아무도 안 막지)', '~어 / ~야', '~(ㄴ)다 (튄다 · 간다 — 결심 선언)'], marker: '됐고.', quirk: '출구부터 센다 (\'출구 2개. 하나는 화장실 창문.\')',
    breaks: { surface: '수당 · 정규직 · 공짜 얘기가 나오면 퉁명함이 풀려 \'…진짜?\' \'…수당 있어?\'로 되묻는다 (18.5 · 21.36)', real: null },
  },
  kyle: {
    name: '카일', age: null, base: 'da',
    to: [{ who: ['rachel'], reg: 'da', title: '너' }, { who: ['romani'], reg: 'da', title: '너' }, { who: 'elder', reg: 'da' }],
    titles: { rachel: '너', romani: '너', doros: '도로스' },
    endings: ['~다 (좋다 · 내 자리다)', '~로군 / ~겠군', '~(었)나? / ~인가 (질문)'], marker: '좋다.', quirk: '앞자리부터 찾는다 (\'앞자리 비었나?\')',
    breaks: { surface: '싸움 대신 빵 · 기도 · 술이 걸리면 \'좋다\'가 한 박자 늦어진다 (frame t10 \'…빵이 좋다.\' · 19.24 \'…좋다. 한 모금.\')', real: null },
  },
  doros: {
    name: '도로스', age: null, base: 'yo',
    to: [{ who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['kyle', 'aiden'], reg: 'yo', title: '~ 님' }, { who: 'stranger', reg: 'yo', title: '친구분' }, { who: 'younger', reg: 'yo', title: '~ 씨' }],
    titles: { rachel: '지휘관님', kyle: '카일 님', aiden: '에이든 님', temur: '테무르 씨' },
    endings: ['~세요 (드세요)', '~어요 / ~해요', '~네요'], marker: '감사히.', quirk: '반죽 시간을 핑계로 일을 미룬다 (\'반죽이 지금 부풀고 있어요. 10분만요.\')',
    breaks: { surface: '누가 굶거나 의자가 비면 농담을 멈추고 빵부터 내민다 (talk react.wipe \'오늘은 그냥 드세요.\')', real: null },
  },
  demiurgos: {
    name: '데미우르고스', age: null, base: 'ban',
    to: [{ who: 'stranger', reg: 'ban' }, { who: 'elder', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '지휘관 / 너' }],
    titles: { rachel: '지휘관', doros: '도로스', joshua: '조슈아' },
    endings: ['~잖아 (전에도 이랬잖아)', '~지 (그럴 수 있지)', '~네 (같은 자리네)'], marker: '응,', quirk: '\'응, 그럴 수 있지.\' — 상대가 처음 본다고 할 때',
    breaks: { surface: '자기 기억이 흐려지는 순간이 나온다 (talk react.mvp \'아, 지난번이 언제였더라.\')', real: null },
  },
  zina: {
    name: '지나', age: 47, base: 'yo',
    to: [{ who: ['gebek'], reg: 'yo', title: '여보' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'younger', reg: 'yo' }, { who: 'stranger', reg: 'yo' }],
    titles: { gebek: '여보', rachel: '지휘관님' },
    endings: ['~예요 / ~이에요 (오늘의 꽃은 ~예요)', '~어요 / ~세요', '~거든요'], marker: '오늘의 꽃은', quirk: '\'꽃 얘기예요.\' — 섬뜩한 말 뒤에 덧붙여 수습',
    breaks: { surface: '가족(남편 · 아이)이 걸리면 표정은 그대로 말이 1~2어절로 준다 (16.17 \'여보.\' · 14.26 \'…애들 학원은요?\')', real: null },
  },
  odysseus: {
    name: '오디세우스', age: 38, base: 'ban',
    to: [{ who: ['argon'], reg: 'ban', title: '영감님' }, { who: ['iris'], reg: 'ban', title: '이리스' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: 'stranger', reg: 'ban', title: '그쪽' }],
    titles: { argon: '영감님', iris: '이리스', rachel: '지휘관', mirinae: '미리내', sarma: '그쪽' },
    endings: ['~지 (내가 뚫었지)', '~더라(고) (이사 갔더라고)', '~거든'], marker: '그것 봐.', quirk: '\'나는 어느 쪽이든 상관없어.\' (→ 결국 자기 말대로)',
    breaks: { surface: '밥 · 돈(무급)이 걸리면 \'상관없음\'이 깨진다 (18.16 \'…그건 상관있네.\' · 09.24 \'근데 무급은 상관있어.\')', real: null },
  },
  argon: {
    name: '아르곤', age: null, base: 'hao',
    to: [{ who: 'younger', reg: 'hao' }, { who: ['fotini'], reg: 'hao', title: '그쪽' }, { who: ['rachel'], reg: 'hao' }],
    titles: { fotini: '그쪽' },
    endings: ['~소 (늦소 · 됐소)', '~오 (가오 · 되오)', '~시오 (세시오 · 타시오)'], marker: '…', quirk: '숫자 하나로 답한다 (\'…11시간.\' · \'승객 12.\')',
    breaks: { surface: '칭찬 · 위로할 때만 숫자 없이 한마디 (talk react.mvp \'1등이오. …잘했소.\' · react.wipe \'…늦어도 되오. 잃지만 마시오.\')', real: null },
  },
  fotini: {
    name: '포티니', age: null, base: 'yo',
    to: [{ who: 'younger', reg: 'yo', title: '~ 님 / 여러분' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: ['eden'], reg: 'yo', title: '손님' }],
    titles: { rachel: '지휘관님', argon: '아르곤 님', odysseus: '오디세우스 님', thermo: '테르모필레 님', hiiro: '히이로 님', eden: '손님', temur: '테무르 씨' },
    endings: ['~예요 ^^ / ~이에요 ^^', '~입니다 ^^ (안내 방송)', '~세요 ^^'], marker: '여러분~', quirk: '\'사진 포인트예요 ^^ 1인 3장까지예요 ^^\'',
    breaks: { surface: '위험 · 상실을 관광 안내로 말한 뒤 한 박자 늦게 되묻는다 (talk react.wipe \'…위로가 됐나요 ^^\' · frame p05 \'…아마요 ^^\')', real: null },
  },
  thermo: {
    name: '테르모필레', age: null, base: 'da',
    to: [{ who: 'younger', reg: 'da' }, { who: ['rachel'], reg: 'da' }],
    titles: {  },
    endings: ['명사형 종결 (~함 · ~음 · 명사: \'한 발 물러섬.\')', '~인가 (질문)', '~어라 (명령 복창: \'뒤로 숨어라.\')'], marker: '명령 수신.', quirk: '말을 문자 그대로 잰다 (\'\'한 발 물러서서 생각해 봐\'는 몇 미터인가\')',
    breaks: { surface: '처음 쓰는 말(\'감사\')을 쓰면 스스로 \'단어 사용 처음\'이라 기록한다 (18.1 · talk topic.wash)', real: null },
  },
  onyx: {
    name: '오닉스 감응자', age: null, base: 'yo',
    to: [{ who: ['amundsen'], reg: 'yo', title: '단장님' }, { who: ['rachel'], reg: 'yo', title: '지휘관님' }, { who: 'younger', reg: 'yo', title: '그쪽' }],
    titles: { rachel: '지휘관님', amundsen: '단장님', issac: 'ISSAC 씨', temur: '테무르 씨', west: '웨스트 씨' },
    endings: ['~요 (노래가요 · 흰사슴 노래요)', '~어요 / ~네요', '~구나 (혼잣말 깨달음)'], marker: '들려요.', quirk: '방 · 사람을 음정으로 말한다 (\'이 방 B플랫이에요.\')',
    breaks: { surface: '끝이 안 좋은 노래가 들리면 몽롱함이 걷히고 짧게 경고한다 (12.33 \'따라 부르지 마세요.\' · talk react.wipe)', real: null },
  },
  rus: {
    name: '루스', age: null, base: 'ban',
    to: [{ who: 'elder', reg: 'ban' }, { who: ['rachel'], reg: 'ban', title: '지휘관' }, { who: 'stranger', reg: 'ban' }],
    titles: { rachel: '지휘관', tu_varga: '바르가 영감', eden: '너', oliver: '너' },
    endings: ['~잖아? (공평하잖아?)', '~지 (주웠지)', '~(ㄹ)게 (반 낼게)'], marker: '공평하게', quirk: '\'주웠어.\' — 챙겨 나온 것(배 · 깃발)을 늘 주운 것으로 친다',
    breaks: { surface: '계산이 안 맞는 호의(에란테스 깃발 · 다친 사람 몫)를 할 때 \'…반만 농담이야\'로 덮는다 (talk topic.flag · react.wipe)', real: null },
  },
};
/** speaker 가 listener 에게 쓰는 어체 (개별 id → 엘베스타드 → 나이 → 단원 → 기본). 정할 수 없으면 base */
export function regFor(speaker: string, listener: string, crew: ReadonlySet<string>): Reg | null {
  const v = VOICE[speaker];
  if (!v) return null;
  const hit = (w: string | string[]) => Array.isArray(w) && w.includes(listener);
  const t = v.to.find((x) => hit(x.who));
  if (t) return t.reg;
  const age = v.age, la = VOICE[listener]?.age;
  for (const x of v.to) {
    if (x.who === 'elvestad' && ELVESTAD.includes(listener)) return x.reg;
    if (x.who === 'elder' && age != null && la != null && la > age) return x.reg;
    if (x.who === 'younger' && age != null && la != null && la < age) return x.reg;
  }
  const c = v.to.find((x) => x.who === 'crew');
  if (c && crew.has(listener)) return c.reg;
  return v.base;
}
