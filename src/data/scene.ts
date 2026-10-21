// 사건 연출 규격 (미연시형). 사건 본문 · 선택 결과를 '한 줄씩 넘기는 대사' 배열로 적는다.
// UI 는 줄마다 화자 이름표 · 스탠딩 · 배경 · 효과음 · 화면 효과를 갱신하며 보여 준다.
//
// 줄 종류
//   서술:  { text }                       — 상황 서술 (3인칭)
//   대사:  { who, text }                  — who 가 말한다 (따옴표 없이 적는다)
//   독백:  { who, think: true, text }     — who 의 속마음 (말풍선 대신 독백 상자)
//   조연:  { slot: 'sub' }                — 동적 조연 자리. 보유 기물 중 한 명의 대사 묶음으로 바뀌고, 없으면 사라진다
//
// 화자 id: 기물 id (UNIT_BY_ID) · NPC id (NPCS) · 'pc' (주인공, 이름은 PC_NAME)
// 치환: 텍스트 속 {pc} {sub} 와 선택 결과가 넘긴 변수 {이름} 을 바꿔 넣는다.

/** 주인공(플레이어) 호칭. 직책이 정해지면 여기만 바꾸면 된다 */
export const PC_NAME = '지휘관';

/** 표정 (스탠딩 차분 키) */
export type Face = 'base' | 'smile' | 'grin' | 'laugh' | 'serious' | 'angry' | 'sad' | 'surprise' | 'worried' | 'tired' | 'smug' | 'shy' | 'blank';
/** 스탠딩 위치 */
export type Pos = 'L' | 'C' | 'R';
/** 화면 효과 */
export type Fx = 'shake' | 'flash' | 'fade' | 'dark' | 'glitch';

export interface Beat {
  /** 화자. 없으면 서술 */
  who?: string;
  /** 표시 이름 덮어쓰기 ('???', '구조 신호' 등) */
  name?: string;
  /** 속마음 독백 */
  think?: boolean;
  text: string;
  /** 화자 표정 */
  face?: Face;
  /** 화자를 이 위치에 세운다 (처음이면 등장) */
  at?: Pos;
  /** 말하지 않는 인물 배치 · 표정 변경 */
  stage?: { id: string; at: Pos; face?: Face }[];
  /** 이 줄 뒤 퇴장: true = 화자, 배열 = 지정 인물 */
  exit?: true | string[];
  /** 배경 전환 (BGS 키) */
  bg?: string;
  /** 배경음 전환 (BGMS 키) */
  bgm?: string;
  /** 효과음 (SFXS 키) */
  sfx?: string;
  fx?: Fx;
  /** 이 줄은 런 깃발이 있을 때만 (앞에 '!' = 없을 때만). 앞선 조사 · 선택을 뒤 장면이 기억하게 할 때 쓴다 */
  if?: string;
}
export type ScriptLine = Beat | { slot: 'sub' };

/** 사건 하나의 연출 */
export interface EventScene {
  /** 주연: 보유 여부와 관계없이 등장 (조연 후보에서 제외) */
  cast: string[];
  scene: ScriptLine[];
  /** 조연 후보 → 대사 묶음. 보유 기물 중 한 명을 골라 { slot: 'sub' } 자리에 넣는다 (출전 기물 우선) */
  subs?: Record<string, Beat[]>;
  /** 선택지 순서대로 결과 장면. 여러 결말이면 키별로 적고, 선택지 효과에서 api.outcome(키) 로 고른다 (기본 키 'default') */
  after?: (Beat[] | Record<string, Beat[]> | null)[];
}

/** 묶음별 추가 등록부 (scenes/index.ts 가 아래 공용 등록부에 합친다) */
export interface SceneReg {
  npcs?: Record<string, { name: string; color?: string; desc: string }>;
  bgs?: Record<string, string>;
  bgms?: Record<string, string>;
  sfxs?: Record<string, string>;
}

// ───────── 등록부: 나중에 미연시 UI · 아트 작업이 참조한다
export const NPCS: Record<string, { name: string; color?: string; desc: string }> = {
  scrapper: { name: '고물상', color: '#c9a06a', desc: '정거장 외곽 고물 시장의 상인. 출처는 묻지 않는 게 예의다.' },
  max: { name: '맥스', color: '#a8c070', desc: '라스무스의 정원견. 정원이 없는 함선에서도 무언가를 판다.' },
  argo: { name: '구조 신호', color: '#8fb4d8', desc: '아르고-7 에서 반복 송신되는 녹음 음성.' },
  dealer: { name: '딜러', color: '#d8a0c0', desc: '여섯 번째 달의 딜러. 손이 빠르다.' },
  barkeep: { name: '바텐더', color: '#c0b090', desc: '여섯 번째 달의 바텐더. 오르카와 구면.' },
};

export const BGS: Record<string, string> = {
  scrap_market: '보급 정거장 외곽 고물 시장 — 폐선 세 척을 이어 붙인 노점가, 용접 불꽃',
  sparta_edge: '스파르타 전쟁 궤도 바깥 고리 — 부서진 방패와 꺼진 등화가 떠다니는 잔해 지대',
  ship_cargo: '에란테스 함선 화물칸 — 아침 조명, 바닥판 하나가 들려 있다',
  ship_duct: '정비 덕트 내부 — 좁고 어두운 배관 통로, 손전등 불빛',
  space: '항로 한가운데 — 별빛뿐인 우주, 멀리 낡은 이민선',
  argo_bridge: '아르고-7 함교 — 텅 빈 조종석, 열한 시간 앞선 벽시계',
  argo_corridor: '아르고-7 복도 — 먼지 한 톨 없는 선실 문들',
  casino: '여섯 번째 달 — 폐광 지하 도박장, 달 다섯 개가 그려진 천장, 자욱한 연기',
  casino_bar: '여섯 번째 달의 바 — 낮은 조명, 술병 진열장',
};
export const BGMS: Record<string, string> = {
  calm: '잔잔한 일상', comic: '경쾌한 소동', lively: '북적이는 시장 · 유흥가', tense: '긴장', eerie: '기묘 · 불길', melancholy: '쓸쓸함 · 여운',
};
export const SFXS: Record<string, string> = {
  clank: '쇠붙이 부딪힘', scrape: '좁은 곳을 긁고 지나감', bark: '개 짖음 (가까이)', bark_far: '개 짖음 (철판 너머 멀리)', rustle: '비닐 봉지 바스락',
  whistle: '짧은 휘파람', servo: '기계 관절 구동음', static: '무선 잡음', tick: '시계 초침', dice: '주사위 구름', crowd: '군중 환호', coin: '동전 튕김',
  blast: '포격 · 폭발',
};

// ───────── 도우미
const isSlot = (l: ScriptLine): l is { slot: 'sub' } => 'slot' in l;

/** 받침 있으면 첫째, 없으면 둘째 (으로/로: ㄹ 받침은 '로') */
const JOSA: Record<string, [string, string]> = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'], 아: ['아', '야'], 야: ['아', '야'], 으로: ['으로', '로'], 로: ['으로', '로'] };
function josa(word: string, j: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return j; // 한글이 아니면 그대로
  const jong = (c - 0xac00) % 28;
  const pair = JOSA[j];
  if (j === '으로' || j === '로') return jong && jong !== 8 ? pair[0] : pair[1];
  return jong ? pair[0] : pair[1];
}
/** 텍스트 치환: {pc} {sub} {변수}. 바로 뒤의 조사(을/를 · 이/가 · 은/는 · 과/와 · 아/야 · 으로/로)는 치환된 말에 맞춘다 */
export function fillText(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}(?:(으로|을|를|이|가|은|는|과|와|아|야|로)(?![가-힣]))?/g, (m, k, j) => (k in vars ? vars[k] + (j ? josa(vars[k], j) : '') : m));
}

/** 깃발 조건(Beat.if)에 맞는 줄인가 */
const meets = (b: Beat, flags: readonly string[]) => !b.if || (b.if[0] === '!' ? !flags.includes(b.if.slice(1)) : flags.includes(b.if));
/** 조연 슬롯을 펼치고, 깃발 조건에 맞지 않는 줄을 빼고, 치환까지 끝낸 대사 배열 */
export function resolveScene(lines: ScriptLine[], subs: Record<string, Beat[]> | undefined, sub: string | null | undefined, vars: Record<string, string>, flags: readonly string[] = []): Beat[] {
  const out: Beat[] = [];
  for (const l of lines) {
    if (isSlot(l)) { if (sub && subs?.[sub]) out.push(...subs[sub].filter((b) => meets(b, flags))); continue; }
    if (meets(l, flags)) out.push(l);
  }
  return out.map((b) => ({ ...b, text: fillText(b.text, vars) }));
}
