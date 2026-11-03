// 에란테스 바 허브: 알렉산드리아 궤도 정거장의 진짜 바 (용병단 본부). 접속하면 바로 여기 (런 사이에도 들른다). 레이첼(플레이어)이 카운터 안에서 손님 쪽을 본다.
// - 무대: 카운터 너머 손님이 최대 4명 상반신으로 (스탠딩을 줄이고 흰 테두리, 허리는 카운터가 가린다). 카운터 위에는 각자 마시는 잔.
//   레이첼은 무대에 서지 않는다 → 레이첼 대사는 화면 아래 '무대 밖' 말풍선으로.
// - 낮 · 밤: 에이든은 낮에만 출근해 카운터 쪽 끝에 선다 (손님에게 단골 메뉴를 내준다). 밤에는 레이첼 혼자 (조명이 바뀐다).
//   런을 마치고 돌아오면 밤, 그 밖에는 낮에서 시작하고, 머무는 동안 BAR_TUNE.day · night 마다 바뀐다 (에이든 퇴근 · 출근 인사).
// - 한때(박자): 만담 약 15% · 정적 약 40% · 나머지는 이모티콘(말풍선 속 그림) · 혼잣말 (작은 기울임 글씨). 위쪽 상황 줄은 없다 —
//   만담은 보이는 것(인물 · 잔 · 조명)과 대사만으로 읽혀야 한다.
// - 입퇴장 (바 시간 기준이라 시간 가속과 상관없이 평균 인원이 같다): 시간대마다 손님 수 목표(BAR_TUNE.crowd)가 있고, 모자라면 빈자리 대기(vacant) 뒤
//   새 사람이 말없이 걸어 들어온다 (뒤뚱거리며 · 프레임 낮게). 들어올 때 머물 시간(stay)이 정해지고, 그 시간이 되면 작별 인사를 하고 나간다.
//   단원 · 낯선 손님 비율은 낮 · 밤마다 (BAR_TUNE.stranger). 받지 못한 주문이 있으면 그 주문을 거두는 한마디를 하고 나간다 (벌점 없음).
// - 말 걸기: 인물을 누르면 미연시 화면(playAdv). 잔을 누르면 무슨 음료인지 이름이 잠깐 뜬다.
// - 통신 기록: 바 밖(전장 · 함선) 만담은 '지난 의뢰 통신 기록'으로 재생한다.
// - 바 운영 (docs/BAR_OPS.md): 정규 단원이 레이첼에게 주문한다 (머리 위 주문 표시) → 누르면 제조대(barprep.ts)로 돌아서 만들고 내준다 →
//   한 모금 뒤 만족 3단계 반응 → 다 마시면 잔 옆에 술값 + 팁 코인 (누르면 거둔다, meta.bar.coins). 좋아함을 받은 잔은 단골 장부에.
// - 첫 영업 보조 (BAR_OPS.md 9절 4단계, 대사 src/data/bar/opstut.ts): 런 튜토리얼처럼 막거나 덮지 않고 한 번씩만 귀띔한다 (meta.bar.tut).
//   첫 주문 = 낮에는 에이든이 무대에서 한마디, 에이든이 없으면 카운터에 '에이든의 메모'(누르면 펼쳐 읽는다) · 처음 연 제조대 = 붙어 있는 메모 ·
//   처음 놓인 동전 = 에이든(밤에는 레이첼이 무대 밖에서) 한마디. 바 운영을 처음 하면 첫 주문이 조금 일찍 온다 (BAR_OPS.first).
// 본 만담 · 들은 이야기는 도감 '기록' 탭에 모인다 (meta.bar).
import { BANTER, BANTER_TOPICS, type Banter } from '../data/bar/banter.gen';
import { REACT_RULES, type ReactCtx } from '../data/bar/react';
import { FRAME_THEME, FRAMES, type Frame } from '../data/bar/frames';
import { ASK, ASK_MID, ASK_Q, askLines, type AskKey } from '../data/bar/ask';
import { BAR_GUEST, BAR_IDLE, BAR_TALK, DEEP_TOPICS, FIELD_SHORT, GENERIC_REACT } from '../data/bar/talk';
import { AIDEN_BACK, AIDEN_OFF, AIDEN_ON, LEAVE_GENERIC, LEAVE_LINES } from '../data/bar/leave';
import { ERANTES_CREW, MONO, MONO_KIND_NAME, MONO_KINDS, type MonoKind } from '../data/bar/mono';
import { GLASS_BY_ID, HOUSE_MENUS, ING_BY_ID, ORDER_STYLE_NAME, RECIPE_BY_ID, REGULARS, type Drink, type OrderStyle } from '../data/bar/drinks';
import { BAR_OPS, COIN_NAME, COIN_UNIT, coinText, GRADE_NAME, judge, makeOrder, payOf, recipeName, feelText, type Grade, type Order } from '../data/bar/orders';
import { ORDER_GENERIC, ORDER_TALK, orderTalk } from '../data/bar/orderlines';
import { FIRST_MEET } from '../data/bar/firstmeet';
import { GUEST_ANON, GUEST_BY_ID, GUESTS } from '../data/bar/guests.gen';
import { GUEST_LINES, type GuestLines } from '../data/bar/guestlines';
import { GUEST_AIDEN } from '../data/bar/guestaiden';
import { FIELDS, fieldOf } from '../data/battlefields';
import { EVENT_BY_ID } from '../data/events';
import { BGS, fillText, NPCS, type Beat } from '../data/scene';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, UNITS } from '../data/units';
import { advKey, closeAdv, playAdv } from './adv';
import { barShowcaseHtml } from './achieve';
import { EMOTE_PAIRS, emoteSvg, soloWeights, type EmoteId } from './baremote';
import { drinkSvg } from './drinkart';
import { PETS, propSvg } from './barprops';
import { barOpsNew, barTutSeen, loadMeta, metaBar, metaBarBond, metaBarCoins, metaBarCoinShown, metaBarGuest, metaBarServed, metaBarTut } from './meta';
import { counterMemoHtml, newPrep, prepAct, prepDrink, prepHtml, type Prep } from './barprep';
import { OPS_LINE, OPS_MEMO } from '../data/bar/opstut';
import { artURL, bgURL, guestArtReady, loadGuestPacks, standURL } from './portraits';
import { STAND_FACE } from './standface.gen';
import { ICONS } from './portraits.gen';
import { listSaves, loadRun } from './save';
import { sfx } from './sound';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const shuffle = <T>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
/** 바에서는 지휘관을 레이첼로 부른다 */
const PC = '레이첼';
/** 튜토리얼(당직 근무)에서 만나는 단원: 튜토리얼을 봤으면 바에 나온다 */
const TUT_CAST = ['yelena', 'franze', 'lindiwe', 'vivian', 'phyllis', 'temur', 'nadir'];
/** 바에 늘 있는 인물: 바텐더 · 지휘관 */
const BASE = ['aiden', 'rachel'];
/** 무대 인원 상한 (낮의 에이든 · 손님 포함). 레이첼은 무대에 서지 않고 화면 아래쪽 말풍선으로만 말한다 */
export const STAGE_MAX = 4;
/** 입퇴장 · 박자 (ms 는 바 시간 — 시간 가속이면 실제보다 빨리 간다 · 확률). 확인용 주소(?bartest)의 __barTune 으로만 바꾼다.
 *  hour: 바 시간 1시간 (낮 07~19시 · 밤 19~07시가 각각 day · night 동안 흐른다 → 12시간)
 *  crowd: 시간대별 손님 수 목표 [시작 시, 끝 시, 최소, 최대] (레이첼 · 에이든 제외 — 매시 목표를 그 안에서 새로 굴린다)
 *  stranger: 목표 인원 중 낯선 손님 자리 몫 (낮 · 밤 — 낯선 손님은 머무는 시간이 짧아, 무대 시간으로 재면 낮 약 65% · 밤 약 35%. tests/bar_check.ts 가 잰다) · stay: 들어온 뒤 머무는 시간 (단원 · 낯선 손님) · vacant: 손님 수가 모자랄 때 다음 사람이 들어오기까지
 *  rest: 한때 사이 쉬는 시간 (실제 ms) · leave.aiden: 한때마다 에이든이 카운터 뒤로 잠깐 갈 확률 · aidenStay: 그러기 전에 무대에 있는 시간 · aidenBack: 다시 나오기까지
 *  share: 한때를 고를 확률 (만담 scene · 따로 쉬는 정적 quiet, 나머지 = 혼잣말 mono 비율 · 이모티콘). 한때 사이 rest 도 정적이라,
 *    화면에 말풍선이 떠 있는 시간으로 만담 약 15% · 이모티콘 + 혼잣말 약 45% · 정적 약 40% (tests/bar_check.ts 가 잰다) · hold: 정적 길이 (실제 ms) · monoGap: 혼잣말 사이 최소 간격
 *  serve: 에이든이 새로 온 손님에게 단골 메뉴를 내줄 확률 · refill: 빈 잔을 치우며 한 잔 더 내줄 확률 · sip: 한 잔 마시는 시간 · clear: 빈 잔을 치우기까지 */
const HOUR = 40_000;
export const BAR_TUNE = {
  hour: HOUR,
  crowd: [[7, 11, 1, 2], [11, 17, 2, 3], [17, 23, 3, 3], [23, 3, 2, 3], [3, 7, 0, 1]] as [number, number, number, number][],
  stranger: { day: 0.8, night: 0.33 },
  stay: { crew: [2 * HOUR, 4 * HOUR] as [number, number], guest: [1 * HOUR, 2 * HOUR] as [number, number] },
  vacant: [HOUR / 3, (HOUR * 2) / 3] as [number, number],
  rest: [1_800, 3_800] as [number, number],
  leave: { aiden: 0.02 },
  aidenStay: 120_000,
  aidenBack: [20_000, 45_000] as [number, number],
  day: 480_000,
  night: 480_000,
  share: { scene: 0.14, quiet: 0.03, mono: 0.3 },
  /** 만담 차례에 에이든 × 낯선 손님 만담(GUEST_AIDEN)을 먼저 고를 확률 — 낮에 에이든과 그 손님이 함께 무대에 있고 이번 방문에 안 한 편이 남았을 때 */
  guestAiden: 0.5,
  hold: [4_000, 9_000] as [number, number],
  monoGap: 40_000,
  serve: 0.35,
  refill: 0.35,
  sip: [40_000, 90_000] as [number, number],
  clear: [20_000, 45_000] as [number, number],
  crewBonus: 1,
};
/** 낯선 손님이 이름을 밝히는 차례 (meta.bar.guests 의 문턱 k = 1~5번 방문을 넘긴 방문마다): chance = 그 방문에 말을 걸 확률 · after = 들어온 뒤 말 걸기까지 (바 시간) */
export const BAR_GUEST_CALL = { chance: 0.4, after: [HOUR / 4, HOUR] as [number, number] };
/** 실재 층 해금: 그 인물과의 관계 = 바에서 말 건 횟수 + 함께 출전한 런 수 */
export const DEEP_BOND = 6;
/** 구경 모드 층 비율: 실재 약 10% · 이상 약 25% (해금된 것이 있을 때) */
const DEEP_SHARE = 0.1, IDEAL_SHARE = 0.25;
export const bondOf = (id: string) => { const m = loadMeta(); return (m.bar?.bond?.[id] || 0) + (m.units[id]?.runs || 0); };
const deepOpen = (id?: string) => !id || bondOf(id) >= DEEP_BOND;

// ───────── 화자 · 이름
const NAME_ID: Record<string, string> = Object.fromEntries([
  ...UNITS.map((u) => [u.name, u.id]),
  ['포티니', 'fotini'], ['레이카', 'reika'], ['오닉스', 'onyx'], ['귀공자', 'exile'], ['체사레', 'cesare'], ['맥스', 'max'], ['손님', 'guest'],
]);
// ───────── 낯선 손님 (명부 src/data/bar/guests.gen.ts · 대사 src/data/bar/guestlines.ts · 기록 meta.bar.guests)
/** 무대 키 'g.<gid>' → 명부 id (명부 손님 · 익명 그림 x_* · 그림이 없을 때의 임시 손님 p<n>) */
const gidOf = (k: string) => (k.startsWith('g.') ? k.slice(2) : '');
/** 이름을 밝힌 손님인가 */
const guestNamed = (gid: string) => !!loadMeta().bar?.guests?.[gid]?.named;
/** 손님 그림 id (그림이 아직 없으면 null — 그 손님은 바에 오지 않는다) */
let guestArtAny = false; // 확인용 주소(?bartest)의 __barGuest: 그림이 없어도 명부 손님을 세운다 (실루엣)
const guestArt = (gid: string) => ((standURL(`gs_${gid}`) && guestArtReady(`gs_${gid}.webp`)) || guestArtAny ? `gs_${gid}` : null);
/** 이 빌드에 손님 그림이 있나 (없으면 아직 영입 안 한 인물 그림을 빌린 임시 손님을 세운다) */
const rosterArt = () => guestArtAny || GUESTS.some((g) => !!standURL(`gs_${g.id}`));
/** 지금 세울 수 있는 낯선 손님이 있나 (묶음을 받았거나, 손님 그림이 없는 빌드면 임시 손님) */
const guestReady = () => !rosterArt() || GUESTS.some((g) => guestArt(g.id)) || GUEST_ANON.some((x) => guestArt(x.id));
/** 그 손님의 대사 (없으면 공통 대사로) */
const guestLines = (gid: string): GuestLines | undefined => GUEST_LINES[gid];
const nameOf = (id: string) => (id === 'cesare' ? '체사레' : id === 'guest' ? '손님' : id.startsWith('g.') ? (guestNamed(gidOf(id)) && GUEST_BY_ID[gidOf(id)]?.name) || '낯선 손님' : UNIT_BY_ID[id]?.name || NPCS[id]?.name || id);
/** 무대에 세우는 그림 (체사레 = 조슈아) */
const figOf = (id: string) => (id === 'cesare' ? 'joshua' : id);
const colorOf = (id: string) => {
  const d = UNIT_BY_ID[figOf(id)];
  return (d && SYN_BY_ID[(d.factions[0] || d.traits[0]) as keyof typeof SYN_BY_ID]?.color) || NPCS[id]?.color || 'var(--c-text-2)';
};
/** 말하는 사람의 그림 id: 낯선 손님은 그 자리의 그림 (명부 손님 gs_<id>) */
const artOf = (id: string) => (id.startsWith('g.') ? S.stage.find((s) => keyOf(s) === id)?.id || `gs_${gidOf(id)}` : figOf(id));
function speaker(id: string) {
  const f = artOf(id);
  return { name: nameOf(id), color: colorOf(id), stand: (UNIT_BY_ID[f] || f.startsWith('gs_')) && standURL(f) ? f : null };
}

// ───────── 해금 · 기록
/** 바에 나올 수 있는 인물: 바텐더 · 지휘관 + 기용한 적 있는 단원 + 튜토리얼에서 만난 단원 + 진행 중인 런의 단원 */
function knownSet(): Set<string> {
  const m = loadMeta();
  const k = new Set(BASE);
  for (const id of Object.keys(m.units)) k.add(id);
  for (const id of m.bar?.last?.units || []) k.add(id);
  if (m.tut?.done || m.tut?.seen?.length) TUT_CAST.forEach((id) => k.add(id));
  for (const id of resumeInfo()?.units || []) k.add(id);
  if (k.has('rasmus')) k.add('max');
  if (k.has('joshua')) k.add('cesare');
  for (const id of k) if (UNIT_BY_ID[id]?.inert || UNIT_BY_ID[id]?.noBar) k.delete(id); // 반려 돌(절망 증강) · 바 대본이 아직 없는 기물은 바에 오지 않는다
  return k;
}
let resumeCache: { t: number; v: ReactCtx['resume'] | null } = { t: -Infinity, v: null }; // 처음엔 비어 있음 (t: 0 이면 페이지를 연 뒤 2초 안에 바에 들어오면 저장이 있어도 '이어서 출격'이 빠졌다)
/** 자동 저장된 진행 중 런 */
function resumeInfo() {
  if (performance.now() - resumeCache.t < 2000) return resumeCache.v;
  const s = listSaves().find((x) => x.slot === 'auto');
  const r = s ? loadRun('auto') : null;
  resumeCache = { t: performance.now(), v: r && !r.over ? { field: r.field, phase: r.phase, units: [...new Set([...r.units.map((u) => u.defId), ...r.usedIds])] } : null };
  return resumeCache.v;
}
function reactCtx(): ReactCtx {
  const m = loadMeta();
  return { runs: m.runs, last: m.bar?.last, used: m.bar?.used || {}, resume: resumeInfo() || undefined };
}
const fieldName = (id: string) => FIELD_SHORT[id] || fieldOf(id)?.name || id;
/** 반응 변수 → 표시 문자열 */
function varsFor(raw: Record<string, string>, id: string): Record<string, string> {
  const v: Record<string, string> = { pc: PC, name: nameOf(id) };
  for (const [k, x] of Object.entries(raw)) v[k] = k === 'field' ? fieldName(x) : k === 'mvp' ? nameOf(x) : k === 'event' ? EVENT_BY_ID[x]?.title || x : x;
  return v;
}
/** 이 인물이 지금 할 반응 (같은 런 결과에 같은 반응은 한 번만) */
function reactFor(id: string): { key: string; lines: string[]; vars: Record<string, string> } | null {
  const c = reactCtx();
  const t = BAR_TALK[id];
  const heard = new Set(loadMeta().bar?.heard || []);
  for (const r of [...REACT_RULES].sort((a, b) => b.pri - a.pri)) {
    const lines = t ? t.react[r.key] : GENERIC_REACT[r.key];
    if (!lines) continue;
    const raw = r.test(c, id, !!t?.watch);
    if (!raw) continue;
    const key = `${r.key === 'resume' ? 'r' + (c.resume?.phase ?? 0) : c.last?.run ?? 0}:${id}:${r.key}`;
    if (heard.has(key)) continue;
    return { key, lines, vars: varsFor(raw, id) };
  }
  return null;
}

// ───────── 대본 → 미연시 줄
/** '대사' (주인) · '이름: 대사' · '* 서술' */
function toBeats(owner: string, lines: string[], vars: Record<string, string>): Beat[] {
  return lines.map((l) => {
    const text = (s: string) => fillText(s, vars);
    if (l.startsWith('* ')) return { text: text(l.slice(2)) };
    const m = l.match(/^([^:\s]{1,8}): (.*)$/);
    if (m && NAME_ID[m[1]]) return { who: NAME_ID[m[1]], text: text(m[2]), name: m[1] === '체사레' ? '체사레' : undefined };
    return { who: owner, text: text(l) };
  });
}
const banterBeats = (b: Banter): Beat[] => b.lines.map(([who, t, nm]) => ({ who, text: fillText(t, { pc: PC }), name: nm || (who === 'cesare' ? '체사레' : undefined) }));
const fmt = (s: string) => esc(s);

// ───────── 구경 모드 상태
/** 카운터 위 잔: by = 내준 사람 (에이든 · 플레이어 — 플레이어가 내준 잔이 남아 있으면 그 손님은 다 마시기 전에 나가지 않는다).
 *  at = 놓인 시각 (그 전에는 안 보인다) · dur = 다 마시는 데 걸리는 시간 · emptyAt = 비운 시각 */
interface Cup { d: Drink; name: string; by: 'aiden' | 'player'; at: number; dur: number; alc: boolean; emptyAt?: number; /** 플레이어가 내준 잔: 만족 · 술값을 냈나 */ grade?: Grade; paid?: boolean }
/** 무대에 선 인물. guest = 낯선 손님 (id = 세울 그림, gid = 손님 구별 — 무대 키 'g.<gid>') · since = 들어온 시각 · until = 일어날 시각 (바 시간) ·
 *  n = 들어온 뒤 말한 장면 수 · cup = 카운터 위 잔 */
interface Seat {
  id: string; guest?: boolean; gid?: string; since: number; until?: number; n: number; cup?: Cup;
  /** 걸려 있는 주문 (머리 위 주문 표시, 누르면 제조대) · 주문 귀띔(밤에 손님이 흘린 말) · 마지막으로 잔을 받은 시각 · 카운터 위 동전 (아직 안 거둔 술값 + 팁) */
  order?: Order; orderHint?: string; orderAt?: number; pay?: number;
  /** 주문을 건 실제 시각 (performance.now — 가속 중에도 BAR_OPS.patience 는 기다린다) */
  orderReal?: number;
  /** 낯선 손님이 이름을 밝히려 말을 걸 시각 (바 시간) · 머리 위 말 걸기 표시가 떠 있다 · 표시가 뜬 실제 시각 */
  callAt?: number; calling?: boolean; callReal?: number;
  /** 막 들어온 낯선 손님: 다음 한때에 들어올 때 한마디 + (거의 늘) 주문 */
  arrive?: boolean;
}
/** 장면 줄: [화자 id ('' = 서술 — 무대에서는 건너뜀), 대사, 이름표?, 종류? (e = 이모티콘: 대사 자리에 이모티콘 id · m = 혼잣말)] */
type Line = [string, string, string?, ('e' | 'm')?];
/** kind: scene 만담 · idle 바텐더와 손님 · mono 혼잣말 · tip 첫 영업 귀띔 (에이든 · 무대 밖 레이첼 한마디) · emote 이모티콘 · enter 말없이 들어옴 · serve 에이든이 잔을 내주거나 치움 ·
 *  shift 낮 ↔ 밤 · leave 작별 인사 (끝나면 exit 가 나간다, 에이든은 카운터 뒤로) · wait 정적 (hold 동안).
 *  mono = 들은 혼잣말 기록 키 (도감 '기록' 탭) · cups = serve 가 바꿀 잔 (null = 치움) · toNight = 이 장면이 끝나면 밤 · toDay = 시작하며 낮 */
interface Scene {
  key: string; sit: string; lines: Line[]; layer?: 's' | 'i' | 'r';
  kind: 'scene' | 'idle' | 'mono' | 'emote' | 'enter' | 'serve' | 'shift' | 'leave' | 'wait' | 'order' | 'react' | 'tip' | 'call';
  /** order: 이 장면으로 걸리는 주문 (무대 키 · 주문 · 귀띔) */
  order?: [string, Order, string?];
  exit?: string; hold?: number; mono?: string; idle?: number; cups?: [string, Cup | null][]; toNight?: boolean; toDay?: boolean;
  /** 들은 이야기 기록 키 (에이든 × 낯선 손님 만담 'ga:<손님 id>.<편>' — 이번 방문에 다시 안 나오고, 도감 손님 탭에 남는다) */
  talk?: string;
  /** leave: 받지 못한 주문을 거두고 나가는 손님 (장면이 시작되면 주문 표시를 지운다) */
  dropOrder?: string;
  /** 카운터 위 소품 (만담 머리줄 〔소품: …〕 · 틀 · 바텐더 대화의 props) — 그 장면 동안 말하는 사람 앞에 */
  props?: string[];
  /** 카운터에 올라앉는 동물 (만담 〔동물: …〕 · 틀의 pets) — 주인 앞에, 무대에 그 동물이 단원으로 서 있으면 그리지 않는다 */
  pets?: string[];
}
/** 장면을 시작하기 전의 무대 변화 (무대 키): add 들어오는 사람 · drop 카운터 뒤로 비켜 주는 에이든 · 나가는 손님 */
interface Plan { add: string[]; drop: string[]; /** 장면의 '손님' 줄을 말할 낯선 손님 (무대 키, 새로 들어오면 applyPlan 이 채운다) · 그 역으로 새로 들어오는 손님인가 (이름을 밝히지 않은 손님 → 익명 그림) */ as?: string; role?: boolean }
interface Pick { scene: Scene; plan: Plan }
const S = {
  /** 무대 (왼쪽 → 오른쪽). 에이든은 카운터 쪽(왼쪽)으로, 새로 온 사람은 문 쪽(오른쪽)으로 선다 */
  stage: [] as Seat[],
  cur: null as null | Scene,
  li: 0,
  timer: 0,
  known: new Set<string>(),
  session: new Set<string>(), // 이번 방문에 본 장면 키
  idleI: 0,
  /** 새 인물이 들어올 수 있는 시각: 자리가 빈 뒤 · 누가 들어온 뒤 BAR_TUNE.vacant */
  enterAt: 0,
  /** 지금 시각의 손님 수 목표 (BAR_TUNE.crowd, 매시 새로 굴린다) · 그 시 · 낯선 손님 일련번호 (무대 키 'g.<n>') */
  want: 0,
  wantH: -1,
  gseq: 0,
  /** 이번 방문에 인사하고 나간 사람 (다른 사람이 있으면 다시 들어오지 않는다) */
  gone: new Set<string>(),
  /** 카운터 뒤로 간 에이든이 다시 나올 수 있는 시각 */
  aidenAt: 0,
  /** 마지막으로 만담 · 바텐더 대화가 끝난 시각: 꽉 찬 채 오래 조용하면 한 사람이 일어난다 */
  talkAt: 0,
  /** 마지막 혼잣말 시각 · 이번 방문에 나온 혼잣말 */
  monoAt: -Infinity,
  monoUsed: new Set<string>(),
  /** 지금 카운터 위 소품 (자리 · 이름, 꼬리표용) */
  props: [] as { k: string; name: string }[],
  /** 밤 (에이든 없음) · 다음에 낮 ↔ 밤이 바뀌는 시각 */
  night: false,
  cycleAt: Infinity,
  /** 바 운영: 주문을 받는다 (모의 실행은 끈다) · 지금 제조대 (null = 정면) */
  ops: true,
  prep: null as Prep | null,
  /** 첫 영업 보조: 카운터 위 에이든의 메모 (밤 첫 주문, 이번 방문에만) · 펼쳐 읽는 중 · 처음 동전이 놓인 자리 (다음 한때에 귀띔) */
  memo: false,
  memoOpen: false,
  tipCoin: '',
};
/** 다음 방문은 밤에서 시작 (런을 마치고 돌아올 때) */
let nightNext = false;
const BAR_SEL = 'main.bar';
/** 바 안에 늘 있는 사람: 기다리지 않고 바로 나온다 (에이든은 카운터 뒤에서 — 낮에만, 손님은 문가에서) */
const BAR_FOLK = new Set(['aiden', 'guest']);
/** 정규 에란테스 단원 (lore/_틀/틀-에란테스.md, 레이첼 제외): 바에 들어올 가중치가 크고 오래 머문다 */
const CREW = new Set(ERANTES_CREW);
const keyOf = (s: Seat) => (s.guest ? `g.${s.gid}` : s.id);
/** 무대의 단원 (에이든 · 낯선 손님 빼고) · 손님 (단원 + 낯선 손님, 에이든 빼고) */
const regulars = () => S.stage.filter((s) => !s.guest && s.id !== 'aiden');
const patrons = () => S.stage.filter((s) => s.id !== 'aiden');
const aidenOn = () => S.stage.some((s) => s.id === 'aiden');
/** 장면에 필요한 무대 인원 (레이첼 제외 · 체사레 = 조슈아 그림 · 손님 = 'guest') */
const needOf = (ids: string[]) => [...new Set(ids.filter((id) => id && id !== 'rachel').map(figOf))];
/** 바의 시계 (바 시간 ms): 시간 가속(좌측 상단 ⏩)을 켜면 **말이 없는 동안**(정적 · 장면 사이 · 이모티콘 · 걸어 나감) BAR_FAST 배 빨리 간다 —
 *  입퇴장 간격 · 머무는 시간 · 잔 · 낮밤. 대사 · 혼잣말이 떠 있는 동안과 제조대 · 말 걸기 중에는 1배 (그래서 대사 장면이 바 시간을 몇 시간씩
 *  잡아먹지 않아, 가속해도 바 시간 하루의 입퇴장 흐름이 1배와 같다). real = 실제 ms (주문 기다림). 검사용 모의 실행은 now · real 을 바꿔 끼운다 */
const W = { rate: 1, base: 0, at: 0 };
const worldNow = () => W.base + (performance.now() - W.at) * W.rate;
const clock = { now: worldNow, real: () => performance.now() };
export const BAR_FAST = 8;
function setRate(r: number) { const n = worldNow(); W.base = n; W.at = performance.now(); W.rate = r; }
/** 시간 가속을 켰나 (켜면 장면 사이 쉬는 시간 · 정적도 절반) */
let fastOn = false;
const fastK = () => (fastOn ? 0.5 : 1);
/** 지금 빠르기 맞추기: talking = 대사 · 혼잣말이 떠 있다 */
function pace(talking: boolean) {
  const r = fastOn && !talking && !S.prep && !advKey() ? BAR_FAST : 1;
  if (r !== W.rate) setRate(r);
}
const isTalk = (l?: Line) => !!l && l[3] !== 'e';
const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);
const weighted = <T>(xs: T[], w: (x: T) => number): T => { let r = Math.random() * xs.reduce((a, x) => a + w(x), 0); return xs.find((x) => (r -= w(x)) < 0) ?? xs[xs.length - 1]; };

// ───────── 카운터 위 잔
const ALC = new Set(['spirit', 'brew', 'liqueur']);
/** 에이든이 내주는 잔: 단골이면 단골 메뉴, 아니면 무난한 메뉴 중 하나 */
function aidenCup(id: string, now: number, delay = 2200): Cup {
  const r = RECIPE_BY_ID[(!id.startsWith('g.') && REGULARS[id]?.menu) || pick(HOUSE_MENUS)];
  return { d: r, name: r.name, by: 'aiden', at: now + delay, dur: rand(BAR_TUNE.sip), alc: r.fill.some((x) => ALC.has(ING_BY_ID[x]?.kind)) };
}
/** 남은 양 (0~1, 아직 안 놓였으면 null) */
function cupLeft(c: Cup | undefined, now: number): number | null {
  if (!c || now < c.at) return null;
  const l = Math.max(0, 1 - (now - c.at) / c.dur);
  if (l <= 0 && c.emptyAt === undefined) c.emptyAt = c.at + c.dur;
  return l;
}
/** 이 사람이 마시는 중인가 (잔이 놓여 있고 남았다) */
const sipping = (s: Seat, now: number) => (cupLeft(s.cup, now) ?? 0) > 0;

/** 조명 표시(〔낮〕 · 〔밤〕)가 지금 시간대와 맞나 */
const timeOk = (t?: 'day' | 'night') => !t || (t === 'night') === S.night;
/** 줄 앞 〔낮〕 · 〔밤〕 접두: 지금 시간대에 쓸 수 있는 줄만, 접두를 떼고 (작별 · 혼잣말) */
const TIME_TAG = /^〔(낮|밤)〕\s*/;
const lineTimeOk = (l: string) => { const m = l.match(TIME_TAG); return !m || (m[1] === '밤') === S.night; };
const untag = (l: string) => l.replace(TIME_TAG, '');
/** 반복 개그 회수 〔회수:id,id〕: 깔린 만담을 다 본 뒤에만 */
const callbackOk = (b: Banter, seen: Set<string>) => !b.callback || b.callback.every((id) => seen.has(id));
function eligibleAmbient(): Banter[] {
  const k = S.known;
  const seen = new Set([...(loadMeta().bar?.seen || []), ...S.session]);
  return BANTER.filter((b) => b.place !== 2 && !b.hold && timeOk(b.time) && callbackOk(b, seen) && b.cast.every((id) => k.has(id)) && needOf(b.cast).length <= STAGE_MAX);
}
/** 들어올 수 있는 단원: 해금됐고 무대에 없는 사람 (이번 방문에 나간 사람은 다른 사람이 없을 때만) */
function entrants(): string[] {
  const on = new Set(S.stage.map(keyOf));
  const all = [...S.known].filter((id) => !BASE.includes(id) && UNIT_BY_ID[id] && !on.has(id));
  const fresh = all.filter((id) => !S.gone.has(id));
  return fresh.length ? fresh : all;
}
/** 무대에 빈자리가 없다 (에이든 · 낯선 손님 포함) */
const isFull = () => S.stage.length >= STAGE_MAX;
const inHours = (h: number, a: number, b: number) => (a < b ? h >= a && h < b : h >= a || h < b);
/** 지금 시각의 손님 수 목표: BAR_TUNE.crowd 에서 그 시간대 범위 안으로 매시 새로 굴린다 */
function wantNow(now: number) {
  const h = Math.floor(barClock(now).min / 60);
  if (h !== S.wantH) {
    S.wantH = h;
    const c = BAR_TUNE.crowd.find(([a, b]) => inHours(h, a, b)) || [0, 0, 2, 2];
    S.want = c[2] + Math.floor(Math.random() * (c[3] - c[2] + 1));
  }
  return S.want;
}
/** 손님 수가 목표보다 적고 빈자리가 있고 대기가 끝났나 (새 사람 1명이 들어올 수 있다) */
const canEnter = (now: number) => !isFull() && patrons().length < wantNow(now) && now >= S.enterAt;
/** 이 장면을 지금 무대로 재생할 수 있나. 에이든(낮에만) · 손님은 바로 나오고, 단원은 fresh 명까지만 새로 들어온다 (ok = 들어올 수 있는 단원).
 *  손님은 자기 장면이 끝나면 나간다. 에이든은 장면 때문에 밀려나지 않는다. 밤에는 에이든이 나오는 장면을 재생하지 않는다.
 *  재생할 수 없으면 null */
function planFor(need: string[], fresh: number, ok: Set<string>): Plan | null {
  if (S.night && need.includes('aiden')) return null;
  const on = S.stage.map(keyOf);
  // '손님' 역: 무대에 있는, 아직 이름을 밝히지 않은 낯선 손님이 맡고 (대사가 그 사람 성격과 다를 수 있어 이름 밝힌 손님은 맡지 않는다), 없으면 새로 들어온다
  const g = need.includes('guest') ? S.stage.find((s) => s.guest && !guestNamed(s.gid!)) : undefined;
  if (need.includes('guest') && !g && !guestReady()) return null;
  const add = need.map((k) => (k === 'guest' && g ? keyOf(g) : k)).filter((k) => !on.includes(k));
  const newbie = add.filter((k) => !BAR_FOLK.has(k));
  if (newbie.length > fresh || !newbie.every((k) => ok.has(k))) return null;
  return on.length + add.length <= STAGE_MAX ? { add, drop: [], as: g && keyOf(g), role: add.includes('guest') } : null;
}
/** 대본 줄 → 장면 줄 ('이름: 대사' · '* 서술', 이름이 없으면 owner) */
function parseLine(l: string, owner: string, suffix = ''): Line {
  if (l.startsWith('* ')) return ['', l.slice(2)];
  const m = l.match(/^([^:\s]{1,8}): (.*)$/);
  if (m && NAME_ID[m[1]]) return [NAME_ID[m[1]], fillText(m[2], { pc: PC })];
  return [owner, fillText(l, { pc: PC }), suffix ? nameOf(owner) + suffix : undefined];
}
/** 확장 틀 펼치기: 슬롯마다 후보 중 무대에 있는 사람 → 없으면 불러올 수 있는 후보(canCall)를 불러온다 (70%) → 없으면 건너뜀.
 *  take = 불러온 사람을 무대 계획에 넣는다. comm: 통신 기록 (끼어드는 사람은 현장에서 홀로그램으로, 자리 제한 없음) */
function buildFrame(f: Frame, pool: Set<string>, here: Set<string>, comm = false, canCall?: (id: string) => boolean, take?: (id: string) => void): Scene {
  const ints: string[] = [];
  for (const slot of f.slots) {
    const cands = Object.keys(slot).filter((id) => pool.has(id) && !f.cast.includes(id) && !ints.includes(id));
    const seated = cands.filter((id) => here.has(figOf(id)) && (!canCall || canCall(id)));
    const callable = comm ? cands : cands.filter((id) => !here.has(figOf(id)) && !!canCall?.(id));
    const c = seated.length ? pick(seated) : callable.length && Math.random() < 0.7 ? pick(callable) : null;
    if (c) take?.(c);
    ints.push(c || '');
  }
  const lines: Line[] = [];
  for (const l of f.lines) {
    const sm = l.match(/^@(\d)$/);
    if (sm) { const c = ints[+sm[1]]; if (c) lines.push(...f.slots[+sm[1]][c].map((x) => parseLine(x, c, comm ? ' (통신)' : ''))); continue; }
    lines.push(parseLine(l, f.cast[0]));
  }
  const who = new Set([...f.cast, ...ints.filter(Boolean)]);
  const pets = Object.entries(f.pets || {}).filter(([w]) => who.has(w)).flatMap(([, p]) => p);
  return { key: `${f.id}+${ints.filter(Boolean).join('+') || '-'}`, sit: f.sit, lines, layer: f.layer, kind: 'scene', props: f.props, pets: pets.length ? [...new Set(pets)] : undefined };
}
/** 확장 틀의 핵심 대화에 필요한 무대 인원 (핵심 인물 + 핵심 줄에서 말하는 사람: '손님:' 줄이 있으면 손님 자리) */
const frameNeed = (f: Frame) => needOf([...f.cast, ...f.lines.filter((l) => !/^@\d$/.test(l)).map((l) => parseLine(l, f.cast[0])[0])]);
/** 확장 틀을 지금 무대로: 끼어드는 자리는 무대에 있는 사람 → 무대 밖 레이첼 · 자리가 있으면 카운터의 에이든(낮) · 합류할 수 있으면 새 인물 */
function stageFrame(f: Frame, plan: Plan, fresh: number, ok: Set<string>): Scene {
  const on = new Set([...S.stage.map(keyOf), ...plan.add]);
  const size = () => S.stage.length - plan.drop.length + plan.add.length;
  const seated = (k: string) => on.has(k) && !plan.drop.includes(k);
  const canCall = (id: string) => {
    const k = figOf(id);
    if (k === 'rachel' || seated(k)) return true;
    if (size() >= STAGE_MAX || (k === 'aiden' && S.night)) return false;
    return plan.drop.includes(k) || k === 'aiden' || (plan.add.filter((x) => !BAR_FOLK.has(x)).length < fresh && ok.has(k));
  };
  const take = (id: string) => {
    const k = figOf(id);
    if (k === 'rachel' || seated(k)) return;
    const d = plan.drop.indexOf(k);
    if (d >= 0) plan.drop.splice(d, 1); else plan.add.push(k);
  };
  return buildFrame(f, S.known, on, false, canCall, take);
}
/** 다음 만담: 지금 무대로 재생할 수 있는 것만 (빈자리 대기가 끝났으면 새 인물 fresh 명까지).
 *  층을 먼저 고르고 (실재 10% · 이상 25%, 실재는 밤에만), 그 안에서 합류 장면 · 안 본 것 · 확장 틀 · 무대에 있는 사람이 나오는 것 우선.
 *  새로 들어오는 사람은 정규 단원이면 크게 더하고 다른 단원이면 뺀다 (정규 단원이 바에 있을 때가 훨씬 많게). 손님 장면도 낮게.
 *  repeat: 이번 방문에 본 장면도 다시 (더 볼 것이 없을 때) */
function nextScene(fresh: number, repeat = false): Pick | null {
  const m = loadMeta();
  const seen = new Set(m.bar?.seen || []);
  const seenFrame = new Set([...seen].filter((k) => k.includes('+')).map((k) => k.split('+')[0]));
  const here = new Set(S.stage.map(keyOf));
  const ok = new Set(fresh ? entrants() : []);
  type Item = { layer: 's' | 'i' | 'r'; score: number; join: boolean; plan: Plan; make: (p: Plan) => Scene };
  const items: Item[] = [];
  let avail = 0; // 해금된 장면 수 (무대와 상관없이)
  const offer = (layer: Item['layer'], base: number, need: string[], make: Item['make'], day = false) => {
    avail++;
    if (layer === 'r' && !S.night && !day) return; // 실재 층은 심야 장면 (낮 표시가 붙은 것만 낮에: 에이든이 핵심인 d01)
    const plan = planFor(need, fresh, ok);
    if (!plan) return;
    const stay = need.filter((k) => here.has(k) && k !== 'guest').length; // 무대에 있던 사람 (에이든 포함)
    const newbies = plan.add.filter((k) => !BAR_FOLK.has(k));
    const join = !!newbies.length && need.some((k) => here.has(k) && !BAR_FOLK.has(k)) && fresh === 1; // 합류 장면: 남아 있던 단원 + 새로 온 사람
    const crew = newbies.reduce((a, k) => a + (CREW.has(k) ? BAR_TUNE.crewBonus : 0), 0); // 정규 단원이 들어오는 장면 가산점
    items.push({ layer, score: base + stay * 1.5 + (join ? 8 : newbies.length && fresh === 1 ? 2 : 0) + crew - (need.includes('guest') ? 3 : 0) - plan.add.length * 0.3 - plan.drop.length, join, plan, make });
  };
  for (const b of eligibleAmbient()) {
    if (!repeat && S.session.has(b.id)) continue;
    if (b.layer === 'r' && !b.cast.filter((id) => !BASE.includes(id)).every((id) => deepOpen(id))) continue; // 실재 층: 출연자 모두와 가까워야
    offer(b.layer, seen.has(b.id) ? 0 : 4, needOf([...b.cast, ...b.lines.map((l) => l[0])]), () => ({ key: b.id, sit: b.sit, layer: b.layer, kind: 'scene', props: b.props, pets: b.pets, lines: b.lines.map((l) => [l[0], fillText(l[1], { pc: PC }), l[2]] as Line) }), b.time === 'day');
  }
  for (const f of FRAMES) {
    if (!f.cast.every((id) => S.known.has(id)) || !deepOpen(f.deep) || !timeOk(f.time) || (!repeat && [...S.session].some((k) => k.startsWith(f.id + '+')))) continue;
    offer(f.layer, seenFrame.has(f.id) ? 2 : 6, frameNeed(f), (p) => stageFrame(f, p, fresh, ok), f.time === 'day');
  }
  // 빈자리 대기가 끝났으면 합류 장면부터
  const pool = fresh === 1 && items.some((x) => x.join) ? items.filter((x) => x.join) : items;
  const roll = Math.random();
  const by = (l: string) => pool.filter((x) => x.layer === l);
  const layerPool = roll < DEEP_SHARE && by('r').length ? by('r') : roll < DEEP_SHARE + IDEAL_SHARE && by('i').length ? by('i') : by('s').length ? by('s') : pool;
  const best = layerPool.map((x) => ({ x, sc: x.score + Math.random() * 2 })).sort((a, b) => b.sc - a.sc)[0]?.x;
  // 바텐더 · 손님 대화 (낮, 에이든): 해금한 단원이 적으면 번갈아, 아니면 볼 장면이 없을 때 가끔 (같은 대화는 방문마다 한 번)
  const idleTurn = !(fresh === 1 && pool !== items) && avail < 8 && (S.idleI + S.session.size) % 2 === 1;
  if (idleTurn || (!best && (avail < 8 || repeat || Math.random() < 0.2))) {
    const left = BAR_IDLE.map((_, i) => (S.idleI + i) % BAR_IDLE.length).filter((i) => repeat || !S.session.has(`idle:${i}`));
    const i = left[0];
    const it = i === undefined ? null : BAR_IDLE[i];
    const lines = it ? it.lines.map((l) => parseLine(l, 'aiden')) : [];
    const plan = it && planFor(needOf(lines.map(([w]) => w)), 0, ok);
    if (it && plan) { S.idleI = i! + 1; return { scene: { key: '', sit: it.sit, lines, kind: 'idle', idle: i, props: it.props }, plan }; }
  }
  return best ? { scene: best.make(best.plan), plan: best.plan } : null;
}
/** 플레이어가 내준 잔이 남아 있으면 그 손님은 아직 일어나지 않는다 (내준 잔이 반응 없이 사라지지 않게) */
const owesCup = (s: Seat, now: number) => s.cup?.by === 'player' && (cupLeft(s.cup, now) ?? 1) > 0;
/** 무대를 바꾸지 않는 계획: 장면마다 새로 만든다 (decide 가 낮에 에이든을 plan.add 에 넣으므로, 한 객체를 같이 쓰면 그 뒤 밤 장면에도 에이든이 따라 나온다) */
const noop = (): Plan => ({ add: [], drop: [] });
/** 작별 인사: 머물 시간(until)이 끝난 손님이 인사하고 나간다 (가장 오래 넘긴 사람부터, 한 번에 한 명). 플레이어가 내준 잔이 남았거나
 *  지금 제조대에서 그 손님 잔을 만드는 중이면 기다린다. 받지 못한 주문이 걸려 있으면 주문을 거두는 한마디를 하고 나간다 (벌점 없음).
 *  에이든은 아주 가끔 카운터 뒤로 돌아간다 (작별이 아니라 잠깐) */
function leaveScene(now: number): Pick | null {
  const alone = !S.night && !aidenOn() && patrons().length <= 1; // 낮에 에이든이 카운터 뒤에 있으면 마지막 손님은 기다린다 (무대가 비지 않게)
  const real = clock.real();
  const due = alone ? [] : patrons().filter((s) => now >= (s.until ?? Infinity) && !owesCup(s, now) && S.prep?.k !== keyOf(s) && !(s.order && real - (s.orderReal ?? -Infinity) < BAR_OPS.patience) && !(s.calling && real - (s.callReal ?? -Infinity) < BAR_OPS.patience)).sort((a, b) => a.until! - b.until!); // 주문 · 말 걸기 표시가 뜬 손님은 실제 시간으로 BAR_OPS.patience 는 기다린다 (가속 중에도)
  const s = due[0];
  if (s) {
    const k = keyOf(s);
    const L = s.guest ? guestLines(s.gid!) : undefined;
    if (s.order) {
      const t = s.guest ? L || ORDER_GENERIC : orderTalk(s.id);
      return { scene: { key: '', sit: '', lines: [[k, fillText(pick(t.drop?.length ? t.drop : ORDER_GENERIC.drop!), { pc: PC })]], kind: 'leave', exit: k, dropOrder: k }, plan: noop() };
    }
    const own = s.guest ? L?.leave || [] : (LEAVE_LINES[s.id] || []).filter(lineTimeOk);
    const line = parseLine(fillText(untag(pick(own.length ? own : LEAVE_GENERIC)), { name: nameOf(k) }), k);
    return { scene: { key: '', sit: '', lines: [line], kind: 'leave', exit: k }, plan: noop() };
  }
  const aiden = S.stage.find((x) => x.id === 'aiden');
  if (aiden && patrons().length >= 2 && now - aiden.since >= BAR_TUNE.aidenStay && Math.random() < BAR_TUNE.leave.aiden) {
    const back = AIDEN_BACK.filter(lineTimeOk);
    return { scene: { key: '', sit: '', lines: [['aiden', fillText(untag(pick(back.length ? back : AIDEN_BACK)), { pc: PC })]], kind: 'leave', exit: 'aiden' }, plan: noop() };
  }
  return null;
}
/** 에이든 × 낯선 손님 만담 (src/data/bar/guestaiden.ts): 낮에 에이든과 그 손님이 함께 무대에 있을 때. 이번 방문에 한 편은 다시 안 하고, 안 들은 편 먼저.
 *  named 편은 그 손님이 이름을 밝힌 뒤에만. 줄 형식: '에이든: …' · '레이첼: …' (무대 밖) · 이름표 없는 줄 = 그 손님 */
function guestAidenScene(): Pick | null {
  if (S.night || !aidenOn()) return null;
  const heard = new Set(loadMeta().bar?.talk || []);
  const opts = patrons().filter((s) => s.guest && GUEST_AIDEN[s.gid!] && S.prep?.k !== keyOf(s) && !s.calling)
    .flatMap((s) => GUEST_AIDEN[s.gid!].map((t, i) => ({ s, t, key: `ga:${s.gid}.${i}` })).filter((x) => (!x.t.named || guestNamed(x.s.gid!)) && !S.session.has(x.key)));
  if (!opts.length) return null;
  const fresh = opts.filter((x) => !heard.has(x.key));
  const x = pick(fresh.length ? fresh : opts);
  const k = keyOf(x.s);
  return { scene: { key: '', sit: x.t.sit, lines: x.t.lines.map((l) => parseLine(l, k)), kind: 'idle', talk: x.key, props: x.t.props }, plan: noop() };
}
/** 정적: 아무도 말하지 않는 한때 (빈자리가 있고 곧 누가 올 거면 그때까지) */
function waitScene(now: number): Pick {
  const hold = (!isFull() && patrons().length < wantNow(now) && S.enterAt > now ? Math.max(5000, Math.min(12_000, (S.enterAt - now) / (fastOn ? BAR_FAST : 1))) : rand(BAR_TUNE.hold)) * fastK();
  return { scene: { key: '', sit: '', lines: [], kind: 'wait', hold }, plan: planFor([], 0, new Set()) || noop() };
}
/** 혼잣말 앞 이모티콘: 잠꼬대는 꾸벅 · 술주정은 취함 */
const MONO_EMO: Partial<Record<MonoKind, EmoteId>> = { sleep: 'zzz', drunk: 'drunk' };
/** 혼잣말: 무대의 정규 단원 한 명이 작게 한 줄 (이번 방문에 나온 줄은 다시 안 나오고, 안 들은 줄 먼저). 낮에는 잠꼬대 · 술주정이 드물다 */
function monoScene(now: number): Pick | null {
  if (now - S.monoAt < BAR_TUNE.monoGap) return null;
  const heard = new Set(loadMeta().bar?.talk || []);
  const opts = S.stage.filter((s) => !s.guest && MONO[s.id]).flatMap((s) => MONO_KINDS.filter((k) => !S.monoUsed.has(`${s.id}.${k}`) && lineTimeOk(MONO[s.id][k]) && (S.night || s.id === 'aiden' || (k !== 'sleep' && k !== 'drunk'))).map((k) => ({ id: s.id, k, key: `mono:${s.id}.${k}` })));
  // 낯선 손님 혼잣말: 이름을 밝히기 전엔 앞 3줄, 밝힌 뒤엔 6줄 모두 (기록은 남기지 않는다)
  const gl = patrons().filter((s) => s.guest && guestLines(s.gid!)).flatMap((s) => {
    const L = guestLines(s.gid!)!, k = keyOf(s);
    const ls = L.mono.slice(0, guestNamed(s.gid!) ? 6 : 3); // 들어올 때 한마디(enter)는 arriveScene 에서
    return ls.map((l, i) => ({ k, l, key: `${k}.${i}.${l.length}` })).filter((x) => !S.monoUsed.has(x.key));
  });
  if (gl.length && (!opts.length || Math.random() < gl.length / (gl.length + opts.length))) {
    const x = pick(gl);
    S.monoUsed.add(x.key); S.monoAt = now;
    return { scene: { key: '', sit: '', lines: [[x.k, fillText(x.l, { pc: PC }), undefined, 'm']], kind: 'mono' }, plan: noop() };
  }
  if (!opts.length) return null;
  const fresh = opts.filter((o) => !heard.has(o.key));
  const o = pick(fresh.length ? fresh : opts);
  S.monoUsed.add(`${o.id}.${o.k}`);
  S.monoAt = now;
  const vars = { name: nameOf(o.id), pc: PC };
  const emo = MONO_EMO[o.k];
  const lines: Line[] = [...(emo ? [[o.id, emo, undefined, 'e'] as Line] : []), [o.id, fillText(untag(MONO[o.id][o.k]), vars), undefined, 'm']];
  return { scene: { key: '', sit: '', lines, kind: 'mono', mono: o.key }, plan: planFor([], 0, new Set()) || noop() };
}
/** 이모티콘: 무대의 한 사람이 말 대신 그림 하나 (마시는 중이면 맛있음 · 건배, 밤이면 꾸벅 · 취함이 잦다). 둘 이상이면 가끔 주고받는다 */
function emoteScene(now: number): Pick | null {
  const ppl = S.stage.filter((s) => s.id !== 'aiden' || Math.random() < 0.3);
  if (!ppl.length) return null;
  const w = (s: Seat) => soloWeights({ drink: sipping(s, now), alcohol: !!s.cup?.alc, night: S.night });
  let lines: Line[];
  if (ppl.length >= 2 && Math.random() < 0.3) {
    const [a, b] = shuffle(ppl);
    const [ea, eb] = pick(EMOTE_PAIRS);
    lines = [[keyOf(a), ea, undefined, 'e'], [keyOf(b), eb, undefined, 'e']];
  } else {
    const s = pick(ppl);
    lines = [[keyOf(s), weighted(w(s).filter(([, x]) => x > 0), ([, x]) => x)[0], undefined, 'e']];
  }
  return { scene: { key: '', sit: '', lines, kind: 'emote' }, plan: planFor([], 0, new Set()) || noop() };
}
/** 들어올 사람 고르기 (decide 가 한때에 얹는다 · 처음 들어갈 때 이미 앉은 사람): 빈자리에 한 사람이 걸어 들어온다. 낯선 손님 · 단원은 무대 손님 중 낯선 손님 몫이 BAR_TUNE.stranger (낮 · 밤)에 가깝게
 *  (목표 인원 중 낯선 손님 자리가 비었으면 85%, 아니면 15%), 단원은 정규 단원이 더 자주. 낮이면 에이든이 곧 단골 메뉴를 내준다 (확률) */
function enterScene(now: number): Pick | null {
  if (isFull()) return null;
  const ps = patrons();
  const share = S.night ? BAR_TUNE.stranger.night : BAR_TUNE.stranger.day;
  const goal = Math.round(share * Math.max(ps.length + 1, wantNow(now))); // 목표 인원 중 낯선 손님 자리 수
  const pGuest = ps.filter((s) => s.guest).length < goal ? 0.85 : 0.15;
  const e = entrants();
  if (!e.length && !guestReady()) return null;
  const k = guestReady() && (!e.length || Math.random() < pGuest) ? 'guest' : weighted(e, (x) => (CREW.has(x) ? 6 : 1));
  return { scene: { key: '', sit: '', lines: [], kind: 'enter', hold: 2600 }, plan: { add: [k], drop: [] } };
}
/** 에이든 서빙: 빈 잔을 치우고 (가끔 한 잔 더), 잔이 없는 손님에게 가끔 단골 메뉴를 내준다 (낮에만) */
function serveScene(now: number): Pick | null {
  if (S.night || !aidenOn()) return null;
  const cups: [string, Cup | null][] = [];
  for (const s of patrons()) {
    cupLeft(s.cup, now);
    if (s.cup?.emptyAt !== undefined && now - s.cup.emptyAt >= rand(BAR_TUNE.clear)) cups.push([keyOf(s), !s.order && Math.random() < BAR_TUNE.refill ? aidenCup(keyOf(s), now, 3000) : null]);
    else if (!s.cup && !s.order && now - s.since > 30_000 && !(S.ops && barOpsNew()) && Math.random() < 0.12) cups.push([keyOf(s), aidenCup(keyOf(s), now, 1200)]); // 처음 하는 바 운영: 첫 손님은 레이첼에게 남겨 둔다
  }
  return cups.length ? { scene: { key: '', sit: '', lines: [], kind: 'serve', hold: 1800, cups }, plan: noop() } : null;
}
/** 낮 ↔ 밤: 해가 지면 에이든이 퇴근 인사를 하고 나간다 (그 뒤 밤) · 해가 뜨면 에이든이 출근 인사를 하며 들어온다 */
function shiftScene(now: number): Pick | null {
  if (now < S.cycleAt) return null;
  if (!S.night) {
    if (aidenOn()) return { scene: { key: '', sit: '', lines: [['aiden', fillText(pick(AIDEN_OFF), { pc: PC })]], kind: 'leave', exit: 'aiden', toNight: true }, plan: noop() };
    return { scene: { key: '', sit: '', lines: [], kind: 'shift', hold: 2500, toNight: true }, plan: noop() };
  }
  const room = S.stage.length < STAGE_MAX;
  return { scene: { key: '', sit: '', lines: room ? [['aiden', fillText(pick(AIDEN_ON), { pc: PC })]] : [], kind: 'shift', hold: 2500, toDay: true }, plan: room ? { add: ['aiden'], drop: [] } : noop() };
}
/** 주문: 정규 단원(주문 대사가 있는 25명) 중 잔이 없거나 비운 사람이 (들어온 뒤 BAR_OPS.firstWait, 마지막 잔에서 minGap 지나) 레이첼에게 한 잔 시킨다.
 *  동시에 BAR_OPS.maxOpen 개까지. 주문은 시간 제한 없이 머리 위에 남고, 걸려 있는 동안 그 손님은 나가지 않는다.
 *  바 운영을 처음 하면 (barOpsNew) 첫 주문만 BAR_OPS.first 의 대기 · 확률로 조금 일찍 */
function orderScene(now: number): Pick | null {
  const first = barOpsNew();
  const wait = first ? BAR_OPS.first.wait : BAR_OPS.firstWait;
  if (!S.ops || S.stage.filter((s) => s.order).length >= BAR_OPS.maxOpen || Math.random() >= (first ? BAR_OPS.first.chance : BAR_OPS.chance)) return null;
  const cand = patrons().filter((s) => (s.guest || ORDER_TALK[s.id]) && !s.order && !s.calling && now - s.since >= wait && now - (s.orderAt ?? -Infinity) >= BAR_OPS.minGap && (cupLeft(s.cup, now) ?? 0) <= 0 && !(s.cup && cupLeft(s.cup, now) === null) && (s.cup?.emptyAt === undefined || now - s.cup.emptyAt >= 15_000)); // 다 마시고 조금 쉰 뒤
  if (!cand.length) return null;
  return orderPick(pick(cand), now);
}
/** 이 손님의 주문 장면 (주문 대사 + 밤 '늘 마시던 거'면 손님의 귀띔) */
function orderPick(s: Seat, now: number, style?: OrderStyle): Pick {
  const k = keyOf(s);
  const who = s.guest ? (GUEST_BY_ID[s.gid!] ? s.gid! : k) : s.id; // 명부 손님은 단골 메뉴 · 주문 방식 · 장부를 명부 id 로
  const o = makeOrder(who, now, { usual: who === k ? undefined : loadMeta().bar?.usual?.[who], night: S.night, style });
  const t = s.guest ? guestLines(s.gid!) || ORDER_GENERIC : orderTalk(s.id);
  const vars = { pc: PC, feel: o.conds ? feelText(o.conds) : '', menu: o.name || '' };
  const lines: Line[] = [[k, fillText(pick(t[o.style]), vars)]];
  let hint: string | undefined;
  if (o.hint === 'guest') { hint = fillText(t.hint, vars); lines.push([k, hint]); }
  return { scene: { key: '', sit: '', lines, kind: 'order', order: [keyOf(s), o, hint] }, plan: noop() };
}
/** 첫 주문 귀띔 (한 번만): 에이든이 무대에 있으면 (이 장면에 나오면) 주문 대사 뒤에 한마디, 없으면 카운터에 메모를 놓는다 */
function orderTip(sc: Scene, aiden: boolean) {
  if (barTutSeen('order')) return;
  metaBarTut('order');
  if (aiden) sc.lines.push(['aiden', fillText(OPS_LINE.order, { pc: PC })]);
  else { S.memo = true; S.memoOpen = false; }
}
/** 처음 놓인 동전 귀띔 (한 번만, 동전이 아직 있을 때): 에이든이 있으면 에이든이, 없으면 레이첼이 무대 밖에서 */
function tipScene(): Pick | null {
  const k = S.tipCoin;
  if (!k) return null;
  S.tipCoin = '';
  if (!S.stage.find((x) => keyOf(x) === k)?.pay || barTutSeen('coin')) return null;
  metaBarTut('coin');
  const vars = { pc: PC, coin: COIN_NAME };
  return { scene: { key: '', sit: '', lines: [aidenOn() ? ['aiden', fillText(OPS_LINE.coin, vars)] : ['rachel', fillText(OPS_LINE.coinSelf, vars)]], kind: 'tip' }, plan: noop() };
}
/** 낯선 손님이 들어왔다: 방문 수를 늘리고, 이름 문턱(1~5번 방문)을 넘었고 대사가 있으면 BAR_GUEST.call 확률로 이번 방문 중 말을 걸 시각을 잡는다 */
function guestVisit(s: Seat, now: number) {
  if (!s.guest || !GUEST_BY_ID[s.gid!]) return;
  const g = metaBarGuest(s.gid!, 'visit');
  if (!g.named && g.v > g.k && guestLines(s.gid!) && Math.random() < BAR_GUEST_CALL.chance) s.callAt = now + rand(BAR_GUEST_CALL.after);
}
/** 막 들어온 낯선 손님: 들어올 때 한마디 (손님 대사 enter) + BAR_OPS.arrive 확률로 바로 주문 (동시 주문은 maxOpen + 1 까지) */
function arriveScene(now: number): Pick | null {
  const s = patrons().find((x) => x.arrive);
  if (!s) return null;
  s.arrive = false;
  const k = keyOf(s), L = guestLines(s.gid!);
  const hello: Line[] = L?.enter?.length ? [[k, fillText(pick(L.enter), { pc: PC })]] : [];
  if (S.ops && !s.order && !s.cup && Math.random() < BAR_OPS.arrive && S.stage.filter((x) => x.order).length < BAR_OPS.maxOpen + 1) {
    const p = orderPick(s, now);
    p.scene.lines = [...hello, ...p.scene.lines];
    return p;
  }
  return hello.length ? { scene: { key: '', sit: '', lines: hello, kind: 'mono' }, plan: noop() } : null;
}
/** 이름을 밝힐 손님이 레이첼에게 먼저 한마디 건다 (머리 위에 말 걸기 표시가 뜬다 — 누르면 이름 밝히는 대화) */
function callScene(now: number): Pick | null {
  const s = patrons().find((x) => x.callAt !== undefined && now >= x.callAt && !x.calling && !x.order && S.prep?.k !== keyOf(x));
  const L = s && guestLines(s.gid!);
  if (!s || !L) return null;
  s.callAt = undefined;
  return { scene: { key: '', sit: '', lines: [[keyOf(s), fillText(pick(L.call), { pc: PC })]], kind: 'call' }, plan: noop() };
}
/** 장면이 끝난 뒤 할 일: 낮 ↔ 밤 · 작별 인사 · 에이든 서빙 · 들어옴 · 만담 · 정적 · 혼잣말 · 이모티콘. 에이든은 낮에 자리가 있으면 카운터에서 다시 나온다 */
function decide(prev: Scene | null): Pick {
  const now = clock.now();
  const p = decideInner(prev, now);
  // 손님 수가 목표보다 적으면 (빈자리 대기 뒤) 이 한때와 함께 한 사람이 말없이 걸어 들어온다 — 따로 박자를 쓰지 않아 시간 가속에도 흐름이 같다
  if (!p.scene.toNight && !p.plan.add.some((k) => k !== 'aiden') && S.stage.length - p.plan.drop.length + p.plan.add.length < STAGE_MAX && canEnter(now)) {
    const e = enterScene(now);
    if (e) p.plan.add.push(...e.plan.add);
  }
  const size = S.stage.length - p.plan.drop.length + p.plan.add.length;
  if (!S.night && !p.scene.toNight && p.scene.kind !== 'leave' && !aidenOn() && !p.plan.add.includes('aiden') && !p.plan.drop.includes('aiden') && size < STAGE_MAX && now >= S.aidenAt) p.plan.add.push('aiden');
  if (p.scene.kind === 'order') orderTip(p.scene, (aidenOn() && !p.plan.drop.includes('aiden')) || p.plan.add.includes('aiden'));
  return p;
}
function decideInner(prev: Scene | null, now: number): Pick {
  const tp = tipScene();
  if (tp) return tp;
  const sh = shiftScene(now);
  if (sh) return sh;
  // 0) 막 들어온 낯선 손님의 한마디 + 주문
  const ar = arriveScene(now);
  if (ar) return ar;
  // 1) 머물 시간이 끝난 사람이 인사하고 나간다 (받지 못한 주문은 거두고)
  const l = leaveScene(now);
  if (l) return l;
  // 2) 에이든 서빙 (낮) · 주문
  if (prev?.kind !== 'serve') { const sv = serveScene(now); if (sv) return sv; }
  if (prev?.kind !== 'order') { const od = orderScene(now); if (od) return od; }
  if (prev?.kind !== 'call') { const cs = callScene(now); if (cs) return cs; }
  // (들어오는 사람은 decide 가 이 한때에 얹는다)
  // 3) 한때 고르기: 만담 · 정적 · 혼잣말 · 이모티콘
  const r = Math.random();
  const sh2 = BAR_TUNE.share;
  if (r < sh2.scene) { const ga = Math.random() < BAR_TUNE.guestAiden ? guestAidenScene() : null; if (ga) return ga; const nx = nextScene(0) || nextScene(0, true); if (nx) return nx; }
  if (r < sh2.scene + sh2.quiet) return waitScene(now);
  return (Math.random() < sh2.mono && monoScene(now)) || emoteScene(now) || waitScene(now);
}
/** 새 낯선 손님 자리 (머물 시간 BAR_TUNE.stay.guest): 그림이 있는 명부 손님 중 무대에 없고 이번 방문에 나가지 않은 사람 (주로 오는 시간이 맞으면 3배 · 아무 때 2배).
 *  role = 만담 · 틀의 '손님' 역: 이름을 밝히지 않은 손님만, 모두 밝혔으면 익명 그림(GUEST_ANON). 그림이 하나도 없으면 아직 영입 안 한 인물 그림을 빌린 임시 손님 */
function newGuest(now: number, role = false): Seat | null {
  const seat = (id: string, gid: string): Seat => ({ id, guest: true, gid, since: now, until: now + rand(BAR_TUNE.stay.guest), n: 0 });
  const on = new Set(S.stage.map((s) => s.gid));
  const day = !S.night;
  const pool = GUESTS.filter((g) => !on.has(g.id) && !S.gone.has(`g.${g.id}`) && guestArt(g.id) && !(role && guestNamed(g.id)));
  if (pool.length) { const g = weighted(pool, (x) => (x.when === 'any' ? 2 : (x.when === 'day') === day ? 3 : 1)); return seat(guestArt(g.id)!, g.id); }
  const anon = GUEST_ANON.filter((x) => !on.has(x.id) && guestArt(x.id));
  if (anon.length) { const a = pick(anon); return seat(guestArt(a.id)!, a.id); }
  if (rosterArt()) return null; // 손님 그림이 있는 빌드인데 묶음을 아직 받는 중 — 임시 손님 대신 아무도 오지 않는다 (단원이 대신 들어온다)
  const used = new Set(S.stage.map((s) => s.id));
  const units = UNITS.filter((d) => !S.known.has(d.id) && !used.has(d.id) && standURL(d.id) && !d.inert && !d.noBar);
  return seat(units.length ? pick(units).id : 'guest', `p${++S.gseq}`);
}
/** 무대 계획 반영: 물러날 사람을 빼고, 에이든은 카운터 쪽(왼쪽) · 나머지는 문 쪽(오른쪽)에 세운다 */
function applyPlan(plan: Plan, now: number) {
  if (plan.drop.length) S.stage = S.stage.filter((s) => !plan.drop.includes(keyOf(s)));
  if (plan.drop.includes('aiden')) S.aidenAt = now + rand(BAR_TUNE.aidenBack);
  for (const k of plan.add) {
    if (S.stage.some((s) => keyOf(s) === k)) continue;
    if (k === 'aiden') S.stage.unshift({ id: k, since: now, n: 0 });
    else if (k === 'guest') { const g = newGuest(now, !!plan.role); if (g) { S.stage.push(g); plan.as = keyOf(g); } }
    else S.stage.push({ id: k, since: now, until: now + rand(BAR_TUNE.stay.crew), n: 0 });
  }
}
/** 작별 인사를 마친 사람이 나간다: 다음 사람은 BAR_TUNE.vacant 뒤에 (에이든은 카운터 뒤로 잠깐) */
function leaveStage(id: string, now: number) {
  const gone = S.stage.find((s) => keyOf(s) === id);
  if (gone?.pay && S.ops) { metaBarCoins(gone.pay); coinFloat(gone.pay); } // 안 거둔 동전은 나가면서 레이첼이 챙긴다
  S.stage = S.stage.filter((s) => keyOf(s) !== id);
  if (id === 'aiden') { S.aidenAt = now + rand(BAR_TUNE.aidenBack); return; }
  S.gone.add(id);
  S.enterAt = Math.max(S.enterAt, now + rand(BAR_TUNE.vacant));
}
/** 낮 ↔ 밤 바꾸기 */
function setNight(night: boolean, now: number) {
  S.night = night;
  S.cycleAt = now + (night ? BAR_TUNE.night : BAR_TUNE.day);
  if (night) S.aidenAt = Infinity; else S.aidenAt = 0;
}
/** 장면 · 혼잣말이 끝났을 때의 기록 (본 장면 · 들은 혼잣말 · 마지막 대화 시각). save = 메타에 남긴다 (모의 실행은 안 남김) */
function finishScene(cur: Scene | null, now: number, save: boolean) {
  if (!cur) return;
  if (cur.key) { if (save) metaBar('seen', cur.key); S.session.add(cur.key); }
  else if (cur.kind === 'idle' && cur.idle !== undefined) S.session.add(`idle:${cur.idle}`);
  if (cur.talk) { S.session.add(cur.talk); if (save) metaBar('talk', cur.talk); }
  if (cur.mono && save) metaBar('talk', cur.mono);
  if (cur.kind === 'scene' || cur.kind === 'idle') S.talkAt = now;
  if (cur.toNight && !cur.exit) setNight(true, now);
}
/** 장면 시작: 무대를 바꾸고 (낮이 되면 조명 · 에이든 출근, 잔 내주기 · 치우기), 첫 줄까지 기다릴 시간을 돌려준다.
 *  앞 장면 · 혼잣말 뒤에는 BAR_TUNE.rest 만큼 말 없이 쉰다. 무대에서는 서술 줄을 건너뛴다 (상황 줄이 없다) */
function startScene(p: Pick, root: HTMLElement | null, prev: Scene | null = null): number {
  const now = clock.now();
  if (p.scene.toDay) setNight(false, now);
  const before = new Set(patrons().map(keyOf));
  applyPlan(p.plan, now);
  const as = p.plan.as;
  if (as) p.scene.lines = p.scene.lines.map((l) => (l[0] === 'guest' ? [as, ...l.slice(1)] as Line : l)); // '손님' 줄 → 그 자리의 낯선 손님
  if (p.scene.dropOrder) { const s = S.stage.find((x) => keyOf(x) === p.scene.dropOrder); if (s) { s.order = undefined; s.orderHint = undefined; } }
  const fresh = patrons().filter((s) => !before.has(keyOf(s)));
  if (root) for (const s of fresh) guestVisit(s, now); // 낯선 손님 방문 기록 · 이름을 밝힐 차례면 말 걸 시각 (화면에서만, 모의 실행은 기록하지 않는다)
  for (const s of fresh) if (s.guest && !p.scene.lines.some(([w]) => w === keyOf(s) || w === 'guest')) s.arrive = true; // 말없이 걸어 들어온 낯선 손님 (장면의 '손님' 역은 제외)
  if (p.scene.kind === 'call') { const s = S.stage.find((x) => keyOf(x) === p.scene.lines[0]?.[0]); if (s) { s.calling = true; s.callReal = clock.real(); s.until = Math.max(s.until ?? now, now + BAR_TUNE.hour); } }
  if (fresh.length) {
    S.enterAt = now + rand(BAR_TUNE.vacant); // 다음 사람은 다시 조금 뒤에 (한꺼번에 몰려 들어오지 않게)
    if (!S.night && aidenOn() && !(S.ops && barOpsNew())) for (const s of fresh) if (!s.guest && Math.random() < BAR_TUNE.serve) s.cup = aidenCup(keyOf(s), now, rand([4000, 9000])); // 낯선 손님은 들어오자마자 레이첼에게 주문한다 // 처음 하는 바 운영: 첫 손님은 레이첼에게
  }
  for (const [k, c] of p.scene.cups || []) { const s = S.stage.find((x) => keyOf(x) === k); if (s) s.cup = c || undefined; }
  if (p.scene.order) { const [k, o, hint] = p.scene.order; const s = S.stage.find((x) => keyOf(x) === k); if (s) { s.order = o; s.orderHint = hint; s.orderReal = clock.real(); } }
  p.scene.lines = p.scene.lines.filter(([w]) => w);
  const speak = new Set(p.scene.lines.filter((l) => l[3] !== 'e').map(([w]) => figOf(w)));
  for (const s of S.stage) if (speak.has(keyOf(s))) s.n++;
  S.cur = p.scene; S.li = 0;
  const rest = prev && prev.kind !== 'wait' && prev.kind !== 'leave' ? rand(BAR_TUNE.rest) * fastK() : 0;
  const silent = !p.scene.lines.length ? p.scene.hold || 2500 : 0;
  if (!root) return rest + (silent || (fresh.length ? 2600 : 1200));
  root.classList.toggle('night', S.night);
  const moved = syncFloor(root);
  showProps(root, p.scene);
  return rest + (silent || (moved && !reduced() ? 2000 : 1200));
}
/** 카운터 위 소품: 장면의 props 를 말하는 사람(무대에 있는, 레이첼 제외) 앞에 차례로 놓는다. 다음 장면에서 치운다 (장면에 소품이 없으면 그대로 비움) */
function showProps(root: HTMLElement, sc: Scene) {
  root.querySelectorAll<HTMLElement>('.bar-prop').forEach((e) => { e.classList.add('gone'); window.setTimeout(() => e.remove(), reduced() ? 0 : 500); });
  S.props = [];
  const onStage = (k: string) => S.stage.some((s) => keyOf(s) === k);
  const who = [...new Set(sc.lines.map(([w]) => figOf(w)).filter((w) => w && w !== 'rachel'))].filter(onStage);
  const front = (k: string) => root.querySelector<HTMLElement>(`.bar-front[data-seat="${k}"]:not(.out)`);
  const put = (fr: HTMLElement, k: string, name: string, html: string, pet = false) => {
    const b = document.createElement('button');
    b.className = pet ? 'bar-prop bar-pet' : 'bar-prop';
    b.dataset.a = 'bar-x'; b.dataset.v = `prop:${S.props.length}`;
    if (!pet) b.dataset.i = String(fr.querySelectorAll('.bar-prop:not(.gone):not(.bar-pet)').length);
    b.setAttribute('aria-label', name);
    b.innerHTML = html;
    fr.appendChild(b);
    S.props.push({ k, name });
  };
  if (who.length) sc.props?.forEach((name, i) => { const k = who[i % who.length]; const fr = front(k); if (fr) put(fr, k, name, propSvg(name)); });
  for (const name of sc.pets || []) {
    const pet = PETS[name];
    if (!pet || onStage(pet.art)) continue;
    const k = pet.owner && onStage(pet.owner) ? pet.owner : who[0];
    const fr = k && front(k);
    if (fr) put(fr, k, name, `<img src="${artURL(pet.art + '.webp')}" alt="" draggable="false">`, true);
  }
}
/** 처음 들어올 때: 한두 사람이 이미 앉아 있다 (정규 단원일 때가 많다), 낮이면 에이든도. 잔은 이미 마시던 중일 수 있다 */
function firstStage() {
  const now = clock.now();
  S.stage = []; S.enterAt = 0; S.talkAt = now; S.aidenAt = S.night ? Infinity : 0; S.wantH = -1;
  if (S.cycleAt === Infinity) setNight(S.night, now);
  // 지금 시간대 목표만큼 이미 앉아 있다 (머문 지 조금 된 사람도 있게 남은 시간을 줄여서)
  const want = Math.min(wantNow(now), STAGE_MAX - (S.night ? 0 : 1));
  for (let i = 0; i < want; i++) {
    const e = enterScene(now);
    if (!e) break;
    const before = S.stage.length;
    applyPlan(e.plan, now);
    if (S.stage.length === before) break;
    const s = S.stage[S.stage.length - 1];
    if (s.until) s.until = now + (s.until - now) * (0.25 + 0.75 * Math.random());
  }
  if (!S.night) S.stage.unshift({ id: 'aiden', since: now, n: 0 });
  for (const s of patrons()) if (Math.random() < 0.55) { const c = aidenCup(keyOf(s), now, 0); c.at = now - c.dur * Math.random() * 0.7; s.cup = c; }
  if (S.ops && barOpsNew()) { const o = regulars().filter((s) => ORDER_TALK[s.id]); if (o.length && o.every((s) => s.cup)) o[0].cup = undefined; } // 처음 하는 바 운영: 주문할 손님 한 명은 빈손으로 (첫 주문이 너무 늦지 않게)
  S.enterAt = now + rand(BAR_TUNE.vacant);
  S.cur = { key: '', sit: '', lines: [], kind: 'wait', hold: 2500 }; S.li = 0;
}

// ───────── 그리기
/** 무대 위치 (0~1): 인원에 맞춰 가운데로 모은다 */
const SPOTS = [[0.5], [0.3, 0.7], [0.18, 0.5, 0.82], [0.13, 0.38, 0.62, 0.87]];
const spotOf = (i: number, n: number) => SPOTS[Math.min(Math.max(n, 1), 4) - 1][i] ?? 0.5;
/** 허리 위 구도: 스탠딩은 전신이라 얼굴 위치표(standface.gen.ts)로 맞춘다. 얼굴 가운데를 자리 가운데에, 턱을 칸 위에서 CHIN_AT 높이에,
 *  얼굴(눈썹~턱)을 칸 높이의 FACE_AT 로 (그림마다 얼굴 크기 · 위치가 조금씩 달라서). 칸 아래(허리)부터는 카운터가 가린다 */
const CHIN_AT = 0.36, FACE_AT = 0.126;
export function figStyle(f: string) {
  const [fx, brow, chin] = STAND_FACE[f] || [0.5, 0.099, 0.152];
  const r = Math.min(2.8, Math.max(1.9, FACE_AT / Math.max(0.01, chin - brow))); // 그림 높이 ÷ 칸 높이
  return `--fx:${fx};--fy:${(CHIN_AT / r - chin).toFixed(3)};--fr:${r.toFixed(3)};--cut:${(chin + (1 - CHIN_AT) / r).toFixed(3)}`;
}
function seatHtml(s: Seat, x: number) {
  const f = figOf(s.id);
  const url = UNIT_BY_ID[f] || s.id.startsWith('gs_') ? standURL(f) : null;
  const nm = nameOf(keyOf(s));
  const art = url ? `<img alt="" src="${url}" style="${figStyle(f)}" decoding="async" onerror="this.remove()">` : '<i class="bar-sil" aria-hidden="true"></i>';
  return `<div class="bar-seat" data-seat="${keyOf(s)}" style="--x:${x}"><button class="bar-fig${s.guest && !s.id.startsWith('gs_') ? ' is-guest' : ''}" data-a="bar-x" data-v="talk:${keyOf(s)}" aria-label="${esc(nm)}에게 말 걸기">${art}</button><span class="bar-emo" hidden></span>${orderBadge(s)}</div>`;
}
/** 주문 방식 아이콘: 느낌(물결) · 사진(사진기) · 이름(메뉴 카드) · 늘 마시던 거(돌아가는 화살표) */
const STYLE_ICON: Record<OrderStyle, string> = {
  vague: '<path d="M4 8 Q8 5 12 8 T20 8 M4 13 Q8 10 12 13 T20 13 M4 18 Q8 15 12 18 T20 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  photo: '<path d="M3 8 H8 L9.5 5.5 H14.5 L16 8 H21 V19 H3 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  name: '<path d="M6 3 H18 V21 H6 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8 H15 M9 12 H15 M9 16 H13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  usual: '<path d="M19 12 A7 7 0 1 1 16.5 6.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.5 2.8 L17 7 L12.8 6.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};
const styleIcon = (st: OrderStyle) => `<svg viewBox="0 0 24 24" aria-hidden="true">${STYLE_ICON[st]}</svg>`;
/** 머리 위 주문 표시 (누르면 제조대로 돈다) */
const orderBadge = (s: Seat) => (s.order ? `<button class="bar-order" data-a="bar-x" data-v="order:${keyOf(s)}" data-st="${s.order.style}" aria-label="${esc(nameOf(keyOf(s)))}의 주문 — ${ORDER_STYLE_NAME[s.order.style]}">${styleIcon(s.order.style)}</button>` : '');
/** 머리 위 말 걸기 표시 (이름을 밝히려는 낯선 손님 — 누르면 이름 밝히는 대화): 주문 표시와 같은 말풍선 속 '…' */
const CALL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="17.5" cy="12" r="1.9" fill="currentColor"/></svg>';
const callBadge = (s: Seat) => (s.calling ? `<button class="bar-order bar-call" data-a="bar-x" data-v="talk:${keyOf(s)}" aria-label="${esc(nameOf(keyOf(s)))}이 말을 건다">${CALL_ICON}</button>` : '');
/** 만찬 주화 (카운터 위 거두지 않은 술값 + 팁 · 코인 칸): 테두리 두 겹 안에 엇갈린 칼과 총 (한 색 면 · 선, docs/UI.md 26) */
const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.6" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width=".7"/>'
  + '<g transform="rotate(-45 12 12)" fill="currentColor"><path d="M11.35 4.2 L12 3.2 L12.65 4.2 L12.65 14.2 L11.35 14.2 Z"/><rect x="9.4" y="14.2" width="5.2" height="1.1" rx=".4"/><rect x="11.4" y="15.3" width="1.2" height="2.9"/><circle cx="12" cy="19" r=".95"/></g>'
  + '<g transform="rotate(45 12 12)" fill="currentColor"><rect x="10.9" y="4.6" width="2.2" height="7.8" rx=".4"/><path d="M10.4 12 H14.8 L15.8 17.6 Q15.9 18.4 15.1 18.4 H13.4 Q12.8 18.4 12.7 17.8 L12.2 14.6 H10.4 Z"/><path d="M12.2 14.6 Q10.9 15.6 11.3 16.9" fill="none" stroke="currentColor" stroke-width=".8"/></g></svg>';
/** 카운터 앞쪽: 그 사람의 잔(카운터 위) · 이름표(카운터 앞면) */
function frontHtml(s: Seat, x: number) {
  const nm = nameOf(keyOf(s));
  return `<div class="bar-front" data-seat="${keyOf(s)}" style="--x:${x}"><button class="bar-cup" data-a="bar-x" data-v="cup:${keyOf(s)}" aria-label="${esc(nm)}의 잔" hidden></button><button class="bar-tag f-ui" data-a="bar-x" data-v="talk:${keyOf(s)}">${esc(nm)}</button></div>`;
}
/** 흰 테두리 (스티커처럼): 그림 알파를 넓혀 흰색으로 깔고 그 위에 원본 (원본 파일은 그대로) */
const STICKER = '<svg class="bar-defs" width="0" height="0" aria-hidden="true"><filter id="bar-stk" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="d"/><feFlood style="flood-color:var(--c-white)"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter></svg>';
/** 무대: 인물들 · 카운터 · 카운터 위 잔과 이름표 · 말풍선 하나 · 잔 이름 꼬리표 */
function floorHtml() {
  const n = S.stage.length;
  return `${S.stage.map((s, i) => seatHtml(s, spotOf(i, n))).join('')}
    <div class="bar-counter" aria-hidden="true" style="--tex:url('${artURL('ct_table.webp')}')"><i class="ctr-top"></i><i class="ctr-front"></i></div>
    <div class="bar-fronts">${S.stage.map((s, i) => frontHtml(s, spotOf(i, n))).join('')}</div>
    <div class="bar-bub" hidden></div><div class="bar-tip f-ui" hidden></div>`;
}
/** 카운터 위 잔을 지금 남은 양으로 다시 그린다 (남은 양이 4% 넘게 바뀌었거나 놓이고 치워질 때만) */
function syncCups(root: HTMLElement) {
  const now = clock.now();
  for (const s of S.stage) {
    const el = root.querySelector<HTMLElement>(`.bar-front[data-seat="${keyOf(s)}"]:not(.out) .bar-cup`);
    if (!el) continue;
    const l = cupLeft(s.cup, now);
    if (l === null) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; delete el.dataset.l; } continue; }
    const prevL = el.dataset.l === undefined ? null : +el.dataset.l;
    if (prevL !== null && Math.abs(prevL - l) < 0.04 && !(l === 0 && prevL > 0) && el.dataset.d === s.cup!.d.glass + s.cup!.name) continue;
    el.innerHTML = drinkSvg(s.cup!.d, l);
    el.dataset.l = l.toFixed(3);
    el.dataset.d = s.cup!.d.glass + s.cup!.name;
    if (el.hidden) { el.hidden = false; el.classList.remove('put'); void el.offsetWidth; el.classList.add('put'); }
  }
  syncMarks(root, now);
}
/** 주문 표시 · 동전: 플레이어가 내준 잔을 다 비우면 술값 + 팁이 잔 옆에 놓인다 (누르면 거둔다) */
function syncMarks(root: HTMLElement, now: number) {
  for (const s of S.stage) {
    const c = s.cup;
    if (c?.by === 'player' && c.grade && !c.paid && cupLeft(c, now) === 0) {
      c.paid = true; s.pay = (s.pay || 0) + payOf(c.d, c.grade, s.guest ? BAR_OPS.tipK[GUEST_BY_ID[s.gid!]?.tip ?? 1] : 1);
      if (S.ops && !barTutSeen('coin')) S.tipCoin = keyOf(s); // 처음 놓인 동전: 다음 한때에 한마디 (tipScene)
    }
    const seat = root.querySelector<HTMLElement>(`.bar-seat[data-seat="${keyOf(s)}"]:not(.out)`);
    if (seat) {
      const b = seat.querySelector<HTMLElement>('.bar-order:not(.bar-call)');
      if (!s.order && b) b.remove();
      else if (s.order && (!b || b.dataset.st !== s.order.style)) { b?.remove(); seat.insertAdjacentHTML('beforeend', orderBadge(s)); }
      const cb = seat.querySelector<HTMLElement>('.bar-call');
      if (!s.calling && cb) cb.remove();
      else if (s.calling && !cb) seat.insertAdjacentHTML('beforeend', callBadge(s));
    }
    const fr = root.querySelector<HTMLElement>(`.bar-front[data-seat="${keyOf(s)}"]:not(.out)`);
    if (!fr) continue;
    const coin = fr.querySelector<HTMLElement>('.bar-coin');
    if (!s.pay && coin) coin.remove();
    else if (s.pay && (!coin || coin.dataset.n !== String(s.pay))) {
      coin?.remove();
      fr.insertAdjacentHTML('beforeend', `<button class="bar-coin" data-a="bar-x" data-v="coin:${keyOf(s)}" data-n="${s.pay}" aria-label="${coinText(s.pay)} 거두기">${COIN_SVG}<b class="f-num">${s.pay}</b><small>${COIN_UNIT}</small></button>`);
    }
  }
  syncMemo(root);
}
/** 카운터 위 에이든의 메모 (첫 주문인데 에이든이 없을 때, 이번 방문에만): 접힌 종이 — 겉에 받는 사람만 펜으로 (설명 라벨 없음, docs/UI.md 21).
 *  누르면 그 위로 펼쳐 읽고 (같은 메모를 다시 누르면 접는다), 펼친 종이의 ✕ 로 닫으면 레이첼이 챙긴다 (메모가 사라진다). 무대 진행은 멈추지 않는다 */
function memoHtml() {
  if (!S.memo) return '';
  return `<button class="bar-memo" data-a="bar-x" data-v="memo:open" aria-label="에이든의 메모" aria-expanded="${S.memoOpen}"><span>${esc(OPS_MEMO.to)}</span></button>`
    + (S.memoOpen ? `<div class="bar-note lp-paper" role="note" aria-label="에이든의 메모">${counterMemoHtml('memo:close')}</div>` : '');
}
function syncMemo(root: HTMLElement) {
  const fr = root.querySelector<HTMLElement>('.bar-fronts');
  if (!fr) return;
  const key = S.memo ? (S.memoOpen ? 'open' : 'shut') : '';
  let w = fr.querySelector<HTMLElement>('.bar-memos:not(.gone)');
  if (!w) {
    if (!key) return;
    fr.insertAdjacentHTML('beforeend', '<div class="bar-memos new"></div>');
    w = fr.querySelector<HTMLElement>('.bar-memos:not(.gone)')!;
  }
  if (w.dataset.k === key) return;
  w.dataset.k = key;
  if (!key) { const g = w; g.classList.add('gone'); window.setTimeout(() => g.remove(), reduced() ? 0 : 450); return; } // 읽고 챙겼다: 짧게 흐려진 뒤 지운다
  w.innerHTML = memoHtml();
  window.setTimeout(() => w!.classList.remove('new'), 600);
}
/** 코인 칸 (오른쪽 위): 지금 가진 코인. gain 이 있으면 그 위로 +n 이 떠오른다 */
function coinChip() { const n = loadMeta().bar?.coins || 0; return `<div class="bar-coins pill" aria-label="${coinText(n)}" title="${COIN_NAME}">${COIN_SVG}<b class="f-num">${n}</b><small>${COIN_UNIT}</small></div>`; }
function coinFloat(n: number) {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  const chip = root?.querySelector<HTMLElement>('.bar-coins');
  if (!chip) return;
  const v = chip.querySelector('b');
  if (v) v.textContent = String(loadMeta().bar?.coins || 0);
  const f = document.createElement('span');
  f.className = 'bar-coin-up f-num';
  f.textContent = `+${n}${COIN_UNIT}`;
  chip.appendChild(f);
  window.setTimeout(() => f.remove(), reduced() ? 900 : 1600);
}
/** 무대 DOM 을 S.stage 에 맞춘다: 나간 사람은 옆으로 뒤뚱뒤뚱 걸어 나가고 (에이든은 카운터 뒤로), 들어온 사람은 옆에서 걸어 들어오고,
 *  남은 사람은 자리를 고쳐 선다 (잔 · 이름표도 함께). 움직임이 있었으면 true */
function syncFloor(root: HTMLElement): boolean {
  const fl = root.querySelector<HTMLElement>('.bar-floor');
  const fr = root.querySelector<HTMLElement>('.bar-fronts');
  if (!fl || !fr) return false;
  const want = S.stage.map(keyOf);
  let moved = false;
  fl.querySelectorAll<HTMLElement>('.bar-seat:not(.out)').forEach((el) => { if (!want.includes(el.dataset.seat!)) { exitEl(el); moved = true; } });
  fr.querySelectorAll<HTMLElement>('.bar-front:not(.out)').forEach((el) => { if (!want.includes(el.dataset.seat!)) exitEl(el); });
  const ctr = fl.querySelector('.bar-counter');
  S.stage.forEach((s, i) => {
    const x = String(spotOf(i, S.stage.length));
    for (const [box, sel, html, before] of [[fl, '.bar-seat', seatHtml, ctr], [fr, '.bar-front', frontHtml, null]] as const) {
      const el = box.querySelector<HTMLElement>(`${sel}[data-seat="${keyOf(s)}"]:not(.out)`);
      if (el) { if (el.style.getPropertyValue('--x') !== x) { walk(el); el.style.setProperty('--x', x); moved = true; } continue; }
      const t = document.createElement('template');
      t.innerHTML = html(s, +x);
      const nw = t.content.firstElementChild as HTMLElement;
      // 옆에서 몇 걸음 뒤뚱거리며 걸어 들어온다 (에이든은 카운터 뒤에서 올라온다 · 움직임 줄이기: 제자리에서 짧게 페이드)
      const from = s.id === 'aiden' ? 'b' : +x < 0.5 ? 'l' : 'r';
      nw.dataset.from = from;
      nw.classList.add('off');
      if (from !== 'b' && !reduced()) nw.style.setProperty('--x', String(+x + (from === 'l' ? -0.14 : 0.14)));
      box.insertBefore(nw, before);
      moved = true;
      void nw.offsetWidth;
      if (from !== 'b') walk(nw);
      nw.classList.remove('off');
      nw.style.setProperty('--x', x);
    }
  });
  fl.dataset.n = String(S.stage.length);
  syncCups(root);
  return moved;
}
/** 걷는 동안 뒤뚱거림 (프레임 낮게 좌우로 기우뚱 — 20-bar.css .walk) */
function walk(el: HTMLElement, ms = 1700) {
  if (reduced()) return;
  el.classList.add('walk');
  clearTimeout(+(el.dataset.wt || 0));
  el.dataset.wt = String(window.setTimeout(() => el.classList.remove('walk'), ms));
}
/** 나가는 사람 (잔 · 이름표도): 가까운 쪽으로 몇 걸음 뒤뚱거리며 걸어가며 흐려진다 (에이든은 카운터 뒤로 내려가며).
 *  움직임 줄이기 설정이면 제자리에서 짧게 흐려진다. 흐려짐이 끝난 뒤에 지운다 (transitionend, 늦어도 2.8초) */
function exitEl(el: HTMLElement) {
  el.classList.remove('talking');
  el.classList.add('out');
  const x = parseFloat(el.style.getPropertyValue('--x')) || 0.5;
  const to = el.dataset.seat === 'aiden' ? 'b' : x < 0.5 ? 'l' : 'r';
  el.dataset.from = to;
  if (to !== 'b' && !reduced()) { walk(el, 2400); el.style.setProperty('--x', String(x + (to === 'l' ? -0.14 : 0.14))); }
  el.classList.add('off');
  let done = false;
  const rm = () => { if (!done) { done = true; el.remove(); } };
  el.addEventListener('transitionend', (e) => { if (e.target === el && e.propertyName === 'opacity') rm(); });
  window.setTimeout(rm, reduced() ? 800 : 2800);
}

// ───────── 좌측 상단 시계 · 시간대 · 시간 가속
/** 바의 하루: 낮(에이든 출근) = 07:00 → 19:00, 밤(레이첼 혼자) = 19:00 → 07:00 을 BAR_TUNE.day · night 에 맞춰 흘려 보낸다 (분 단위) */
function barClock(now = clock.now()): { min: number; slot: ClockSlot } {
  const len = S.night ? BAR_TUNE.night : BAR_TUNE.day;
  const p = S.cycleAt === Infinity ? 0 : Math.max(0, Math.min(1, 1 - (S.cycleAt - now) / len));
  const min = Math.floor(((S.night ? 19 : 7) * 60 + p * 12 * 60) % (24 * 60));
  const h = min / 60;
  const slot: ClockSlot = h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : h >= 19 ? 'night' : 'late';
  return { min, slot };
}
type ClockSlot = 'dawn' | 'morning' | 'day' | 'dusk' | 'night' | 'late';
const SLOT_NAME: Record<ClockSlot, string> = { dawn: '새벽', morning: '아침', day: '낮', dusk: '저녁', night: '밤', late: '심야' };
/** 시간대 아이콘 (한 색 선 · 면, docs/UI.md 26) */
const SLOT_ICON: Record<ClockSlot, string> = {
  dawn: '<path d="M3 17 H21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7 17 A5 5 0 0 1 17 17" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8 V10 M5.6 11 L7 12.3 M18.4 11 L17 12.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>',
  morning: '<path d="M3 18 H21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 18 A5.5 5.5 0 0 1 17.5 18 Z" fill="currentColor"/><path d="M12 6 V9 M4.8 9.8 L6.8 11.6 M19.2 9.8 L17.2 11.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  day: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M5.3 18.7 L7 17 M17 7 L18.7 5.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  dusk: '<path d="M3 16 H21 M6 19.5 H18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 16 A5.5 5.5 0 0 1 17.5 16 Z" fill="currentColor"/><path d="M12 7.5 V9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  night: '<path d="M15.5 3.5 A8.5 8.5 0 1 0 20.5 15 A7 7 0 0 1 15.5 3.5 Z" fill="currentColor"/>',
  late: '<path d="M13.5 5 A7 7 0 1 0 18.5 14.5 A5.8 5.8 0 0 1 13.5 5 Z" fill="currentColor"/><path d="M19 3 L19.6 4.6 L21.2 5.2 L19.6 5.8 L19 7.4 L18.4 5.8 L16.8 5.2 L18.4 4.6 Z M5 17.5 L5.4 18.6 L6.5 19 L5.4 19.4 L5 20.5 L4.6 19.4 L3.5 19 L4.6 18.6 Z" fill="currentColor"/>',
};
const FAST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6 L12 12 L4 18 Z M12 6 L20 12 L12 18 Z" fill="currentColor"/></svg>';
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function clockHtml() {
  const c = barClock();
  return `<div class="bar-clock"><span class="bar-time pill" aria-live="off" title="${SLOT_NAME[c.slot]}"><svg viewBox="0 0 24 24" aria-hidden="true" data-slot="${c.slot}">${SLOT_ICON[c.slot]}</svg><b class="f-num">${hhmm(c.min)}</b><small>${SLOT_NAME[c.slot]}</small></span>
    <button class="bar-fast pill" data-a="bar-x" data-v="fast" aria-pressed="${fastOn}" aria-label="시간 가속 (말이 없는 동안 ${BAR_FAST}배 빨리 — 손님 들고 나는 간격을 건너뛴다)">${FAST_ICON}<b class="f-num">×${fastOn ? BAR_FAST : 1}</b></button></div>`;
}
/** 시계 칸만 다시 쓴다 (분이 바뀌거나 시간대 · 가속이 바뀔 때) */
function syncClock(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>('.bar-clock');
  if (!el) return;
  const c = barClock();
  const key = `${c.min}|${fastOn}`;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  const svg = el.querySelector<SVGElement>('.bar-time svg');
  if (svg && svg.dataset.slot !== c.slot) { svg.dataset.slot = c.slot; svg.innerHTML = SLOT_ICON[c.slot]; el.querySelector('.bar-time small')!.textContent = SLOT_NAME[c.slot]; el.querySelector('.bar-time')!.setAttribute('title', SLOT_NAME[c.slot]); }
  el.querySelector('.bar-time b')!.textContent = hhmm(c.min);
  const f = el.querySelector<HTMLElement>('.bar-fast');
  if (f) { f.setAttribute('aria-pressed', String(fastOn)); f.querySelector('b')!.textContent = `×${fastOn ? BAR_FAST : 1}`; }
}
/** 시간 가속 켜고 끄기: 켜면 지금 기다리던 쉬는 시간도 줄여 바로 다음 일로 */
function toggleFast() {
  fastOn = !fastOn;
  pace(!!S.cur && S.li > 0 && S.li <= S.cur.lines.length && isTalk(S.cur.lines[S.li - 1]));
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (root) syncClock(root);
  if (fastOn && !S.prep && !advKey() && S.cur && (S.cur.kind === 'wait' || S.li >= S.cur.lines.length)) schedule(300);
}
let clockTimer = 0;

/** 바 안의 장소 (배경 그림 1216 × 832 좌표의 사각형): 세로 띠의 줄을 가리키면 그 사물이 밝아진다 */
const PLACES: { id: string; box: [number, number, number, number] }[] = [
  { id: 'counter', box: [520, 300, 1216, 780] }, // 카운터 · 술병 진열장 (의뢰)
  { id: 'lounge', box: [0, 430, 410, 832] },     // 왼쪽 라운지 소파 (단원 · 도감)
  { id: 'balcony', box: [440, 0, 1216, 345] },   // 2층 발코니 · 액자 (기록 · 업적)
  { id: 'window', box: [0, 0, 540, 500] },       // 창가 · 성운 (통신 기록)
];
export function barScreen(): string {
  S.known = knownSet();
  if (!S.stage.length && !S.cur) firstStage();
  resumeCache.t = -Infinity; // 바를 그릴 때는 저장을 새로 읽는다 (페이지를 연 직후 비어 있던 값이 남아 '이어서 출격'이 빠지던 것)
  const res = resumeInfo();
  const auto = listSaves().find((x) => x.slot === 'auto');
  const m = loadMeta();
  const seenN = m.bar?.seen?.length || 0;
  const hasLog = !!awayPool().length || !!m.bar?.last;
  const achN = Object.keys(m.achieved || {}).length;
  /** 세로 띠의 한 줄: 가리키면 그 사물(장소)이 밝아진다 */
  const line = (p: string, act: string, label: string, sub = '', extra = '') =>
    `<button class="bn${p === 'counter' && !extra.includes('data-sub') ? ' pri' : ''}" data-p="${p}" data-a="${act}"${extra}><b>${label}</b>${sub ? `<small class="f-num">${sub}</small>` : ''}</button>`;
  return `<main class="bar${S.night ? ' night' : ''}" aria-label="에란테스 바">
    <div class="bar-scene">
      <div class="bar-bg" style="background-image:url('${bgURL('erantes_bar')}')"></div>
      ${PLACES.map((p) => `<i class="bar-glow" data-p="${p.id}" style="--x0:${p.box[0]};--y0:${p.box[1]};--x1:${p.box[2]};--y1:${p.box[3]}" aria-hidden="true"></i>`).join('')}
      ${barShowcaseHtml()}
    </div>
    <div class="bar-shade"></div><div class="lp-grain" aria-hidden="true"></div>${STICKER}
    <aside class="bar-nav" aria-label="바 둘러보기">
      <svg class="lp-stars" viewBox="0 0 120 40" aria-hidden="true"><circle cx="14" cy="22" r="1.2"/><circle cx="38" cy="9" r=".9"/><circle cx="61" cy="27" r="1.5"/><circle cx="84" cy="12" r=".9"/><circle cx="106" cy="24" r="1.1"/></svg>
      <h1 lang="la" aria-label="에란테스 바">Errantes</h1>
      <i class="lp-rule" aria-hidden="true"></i>
      <nav>
        ${res && auto ? line('counter', 'load', '이어서 출격', `${esc(fieldName(res.field))}<br>페이즈 ${auto.phase}`, ' data-v="auto"') : ''}
        ${line('counter', 'newrun', '새 계약', res && auto ? '진행 중인 의뢰는 덮어씁니다' : '의뢰 차림표', res && auto ? ' data-sub="1"' : '')}
        ${line('lounge', 'codex', '도감', seenN ? `만담 ${seenN}` : '단원 · 만담', ' data-v="units"')}
        ${line('balcony', 'codex', '기록 · 업적', achN ? `업적 ${achN}` : '', ' data-v="ach"')}
        ${line('window', 'bar-x', '통신 기록', hasLog ? '지난 의뢰' : '의뢰를 마친 밤에', ` data-v="log"${hasLog ? '' : ' aria-disabled="true"'}`)}
      </nav>
      <span class="est">ERRANTES</span>
    </aside>
    <div class="bar-floor" data-n="${S.stage.length}">${floorHtml()}</div>
    ${clockHtml()}
    <button class="bar-door lp-btn" data-a="to-title">타이틀 ›</button>${coinChip()}
    <section class="bar-prep" aria-label="제조대" hidden></section>
    <p class="bar-hint muted small">인물을 누르면 말을 겁니다. 머리 위 주문을 누르면 제조대로 돌아섭니다.</p>
  </main>`;
}

// ───────── 구경 모드 진행 (다시 그리지 않고 말풍선 · 무대만 바꾼다)
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function stop() { clearTimeout(S.timer); S.timer = 0; }
function schedule(ms: number) { clearTimeout(S.timer); S.timer = window.setTimeout(tick, ms); }
/** 말풍선 나타남 · 사라짐 (20-bar.css bar-bub-in · bar-bub-out, 0.65초) */
const BUB_FADE = 650;
/** 말풍선을 치운다: 떠 있던 말풍선은 그 자리에 사본을 남겨 부드럽게 사라지게 하고 (다음 줄은 원래 말풍선으로 새로 떠오른다 → 겹쳐 바뀐다) */
function hideBub(root: HTMLElement) {
  const bub = root.querySelector<HTMLElement>('.bar-bub:not(.ghost)');
  if (bub && !bub.hidden) {
    const g = bub.cloneNode(true) as HTMLElement;
    g.classList.remove('on');
    g.classList.add('ghost');
    g.setAttribute('aria-hidden', 'true');
    bub.after(g);
    g.addEventListener('animationend', () => g.remove(), { once: true });
    window.setTimeout(() => g.remove(), BUB_FADE * 2); // 애니메이션이 늦게 끝나도 (느린 기기) 끝까지 흐려진 뒤 치운다
  }
  if (bub) { bub.hidden = true; bub.classList.remove('on', 'mono'); }
  root.querySelectorAll('.bar-seat.talking').forEach((s) => s.classList.remove('talking'));
}
/** 이모티콘을 치운다: 그 자리에서 부드럽게 사라진 뒤 숨긴다 (그 사이 같은 자리에 새 이모티콘이 뜨면 취소) */
function hideEmotes(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.bar-emo:not([hidden]):not(.out)').forEach((e) => {
    e.classList.add('out');
    const done = () => { if (e.classList.contains('out')) { e.hidden = true; e.classList.remove('on', 'out'); } };
    e.onanimationend = (ev) => { if (ev.target === e && ev.animationName.startsWith('bar-fade-out') || (ev.target === e && ev.animationName === 'bar-bub-out')) done(); }; // 한 처리기만 (숨길 때마다 쌓이지 않게)
    e.dataset.ht = String(window.setTimeout(done, BUB_FADE * 2));
  });
}
/** 한 줄을 보여 주는 시간: 대사는 글자 수에 맞춰 · 혼잣말은 조금 짧게 · 이모티콘은 주고받으면 첫 그림 뒤 잠깐, 마지막 그림은 길게 */
function lineMs(sc: Scene, [who, text, , k]: Line, last = true) {
  if (k === 'e') return last ? 3800 : 1300;
  if (!who) return Math.min(5000, Math.max(1800, 900 + [...text].length * 55));
  return Math.min(6000, Math.max(k === 'm' ? 2400 : 2200, 1300 + [...text].length * (k === 'm' ? 62 : 70)));
}
/** 지금 줄을 보여 주고 보여 줄 시간을 돌려준다: 무대에 선 사람은 그 머리 위 말풍선 (이모티콘은 머리 옆 작은 말풍선), 무대 밖(레이첼)은 아래쪽 말풍선 */
function showLine() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root || !S.cur) return 0;
  const ln = S.cur.lines[S.li];
  const [who, text, nm, kind] = ln;
  const last = S.li === S.cur.lines.length - 1;
  const k = figOf(who);
  const seat = k === 'rachel' ? null : root.querySelector<HTMLElement>(`.bar-seat[data-seat="${k}"]:not(.out)`);
  if (kind === 'e') {
    if (seat) showEmote(seat, text);
    return lineMs(S.cur, ln, last);
  }
  hideBub(root);
  hideEmotes(root);
  const bub = root.querySelector<HTMLElement>('.bar-bub:not(.ghost)');
  if (!bub) return 0;
  bub.innerHTML = `<b class="f-ui" style="--c:${colorOf(who)}">${esc(nm || nameOf(who))}</b><span>${esc(text)}</span>`;
  bub.classList.toggle('off-stage', !seat);
  bub.classList.toggle('mono', kind === 'm');
  bub.hidden = false;
  placeBub(root, bub, seat);
  seat?.classList.add('talking');
  void bub.offsetWidth; bub.classList.add('on'); // 움직임 줄이기면 CSS 가 흐려지기만 한다
  return lineMs(S.cur, ln, last);
}
/** 그 자리(.bar-seat)의 머리 둘레에 이모티콘 하나를 띄운다 (자리 4곳 중 무작위, 움직임은 CSS .bar-emo.on[data-e]) */
function showEmote(seat: HTMLElement, id: string) {
  const emo = seat.querySelector<HTMLElement>('.bar-emo');
  if (!emo || !EMOTE_IDS.has(id)) return;
  clearTimeout(+(emo.dataset.ht || 0));
  emo.classList.remove('out');
  emo.innerHTML = emoteSvg(id as EmoteId);
  emo.dataset.e = id;
  emo.dataset.pos = POS.emo ?? pick(EMO_POS);
  emo.hidden = false;
  emo.classList.remove('on'); void emo.offsetWidth; emo.classList.add('on');
}
/** 말풍선 · 이모티콘이 인물 그림 기준으로 뜨는 자리 (줄마다 무작위). 확인용 주소의 __barPos 로 고정할 수 있다 */
const BUB_POS = ['top', 'tr', 'tl', 'side'] as const;
const EMO_POS = ['tr', 'tl', 'r', 'l'];
const POS: { bub?: (typeof BUB_POS)[number]; emo?: string } = {};
/** 말풍선 자리: 그 사람 자리(.bar-seat)를 재서 머리 위 · 오른쪽 위 · 왼쪽 위 · 얼굴 옆(빈 쪽) 중 하나에 놓고, 꼬리가 머리를 가리키게 한다.
 *  무대 밖(레이첼)은 CSS 자리 (카운터 앞면 위 가운데) */
function placeBub(root: HTMLElement, bub: HTMLElement, seat: HTMLElement | null) {
  bub.style.left = ''; bub.style.top = ''; bub.style.removeProperty('--tx'); bub.style.removeProperty('--ty');
  delete bub.dataset.pos; delete bub.dataset.tail;
  if (!seat) return;
  const fl = root.querySelector<HTMLElement>('.bar-floor');
  if (!fl) return;
  const F = fl.getBoundingClientRect(), R = seat.getBoundingClientRect();
  const W = F.width, bw = bub.offsetWidth, bh = bub.offsetHeight;
  const sw = R.width, h = R.height, top0 = R.top - F.top;
  const hx = R.left - F.left + sw / 2; // 얼굴 가운데 (그림은 얼굴을 자리 가운데에 맞춘다)
  const headTop = top0 + h * 0.13, faceMid = top0 + h * 0.3;
  // 옆 사람 얼굴: 다른 자리의 가운데 x (얼굴 옆 말풍선은 그 얼굴을 덮지 않을 때만)
  const others = Array.from(fl.querySelectorAll<HTMLElement>('.bar-seat:not(.out)')).filter((e) => e !== seat).map((e) => { const r = e.getBoundingClientRect(); return r.left - F.left + r.width / 2; });
  const clearOf = (l: number) => others.every((ox) => ox < l - sw * 0.2 || ox > l + bw + sw * 0.2);
  let pos = POS.bub ?? pick([...BUB_POS]);
  let left = 0, top = 0, tail = 'b';
  const fits = (l: number) => l >= 8 && l + bw <= W - 8;
  if (pos === 'side') { // 얼굴 옆: 빈 쪽이 있을 때만 (가장자리 · 인원이 적을 때), 없으면 머리 위 쪽으로
    const rl = hx + sw * 0.3, ll = hx - sw * 0.3 - bw;
    const ok = [rl, ll].filter((l) => fits(l) && clearOf(l));
    if (!ok.length) pos = POS.bub === 'side' ? 'top' : pick(['top', 'tr', 'tl'] as const);
  }
  if (pos === 'tr' && !fits(hx + sw * 0.08)) pos = 'tl';
  if (pos === 'tl' && !fits(hx - sw * 0.08 - bw)) pos = fits(hx + sw * 0.08) ? 'tr' : 'top';
  if (pos === 'top') { left = hx - bw / 2; top = headTop - bh - 12; }
  else if (pos === 'tr') { left = hx + sw * 0.08; top = headTop - bh + 4; }
  else if (pos === 'tl') { left = hx - sw * 0.08 - bw; top = headTop - bh + 4; }
  else { // 얼굴 옆: 비어 있는 쪽 (둘 다 비면 넓은 쪽)
    const rl = hx + sw * 0.3, ll = hx - sw * 0.3 - bw;
    const rOk = fits(rl) && clearOf(rl), lOk = fits(ll) && clearOf(ll);
    const right = rOk && (!lOk || W - hx > hx);
    left = right ? rl : ll; top = faceMid - bh / 2; tail = right ? 'l' : 'r';
  }
  left = Math.max(8, Math.min(W - bw - 8, left));
  top = Math.max(8, top);
  bub.dataset.pos = pos; bub.dataset.tail = tail;
  bub.style.left = `${Math.round(left)}px`; bub.style.top = `${Math.round(top)}px`;
  // 꼬리: 아래 꼬리는 머리 가운데를 향해 (말풍선 안쪽 14px ~ 폭 − 24px), 옆 꼬리는 높이 가운데
  if (tail === 'b') bub.style.setProperty('--tx', `${Math.round(Math.max(14, Math.min(bw - 24, hx - left - 6)))}px`);
  else bub.style.setProperty('--ty', `${Math.round(bh / 2 - 6)}px`);
}
const EMOTE_IDS = new Set<string>(['dots', 'excl', 'q', 'note', 'heart', 'anger', 'sweat', 'zzz', 'idea', 'yum', 'cheers', 'drunk', 'sparkle']);
function tick() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root) { stop(); return; }
  if (advKey()) { pace(true); schedule(700); return; } // 말 거는 중에는 멈춘다 (가속도 1배로)
  if (S.prep) { pace(true); stop(); return; } // 제조대를 보는 동안 무대는 멈춘다 (손님 반응 없음)
  syncCups(root);
  if (!S.cur || S.li >= S.cur.lines.length) { endScene(root); return; }
  pace(isTalk(S.cur.lines[S.li]));
  const ms = showLine();
  S.li++;
  schedule(ms || 600);
}
function endScene(root: HTMLElement) {
  const cur = S.cur;
  pace(false);
  hideBub(root);
  hideEmotes(root);
  finishScene(cur, clock.now(), true);
  if (cur?.exit) { // 인사를 마친 사람이 뒤뚱뒤뚱 걸어 나가며 흐려진다 → 빈자리 (에이든은 카운터 뒤로 — 퇴근이면 그 뒤 밤)
    leaveStage(cur.exit, clock.now());
    if (cur.toNight) setNight(true, clock.now());
    root.classList.toggle('night', S.night);
    S.cur = null; S.li = 0;
    syncFloor(root);
    schedule(EXIT_MS);
    return;
  }
  schedule(startScene(decide(cur), root, cur));
}
/** 퇴장 뒤 다음 일까지 (걸어 나가며 흐려지는 동안) */
const EXIT_MS = 2400;
const testHook = globalThis as unknown as Record<string, unknown>;
/** 확인용 (주소에 ?bartest): 특정 틀을 정한 끼어들기로 바로 재생 · 박자 바꾸기 · 무대 상태 보기 · 낮밤 바꾸기.
 *  window.__barFrame('g01', ['temur']) · window.__barTune({ day: 20000 }) · window.__barState() · window.__barNight(true) · window.__barCup('temur', 'milkpint', .5)
 *  · window.__barPlay([['temur', 'yum', null, 'e'], ['aiden', 'note', null, 'e']]) (이모티콘 · 혼잣말 'm' · 대사를 바로) */
if (typeof location !== 'undefined' && location.search.includes('bartest')) {
  testHook.__barFrame = (id: string, ints: string[]) => {
    const f = FRAMES.find((x) => x.id === id);
    if (!f) return;
    const here = new Set(ints);
    const sc = buildFrame({ ...f, slots: f.slots.map((sl, i) => (ints[i] && sl[ints[i]] ? { [ints[i]]: sl[ints[i]] } : {})) }, here, here);
    const now = clock.now();
    S.stage = needOf([...f.cast, ...ints]).slice(0, STAGE_MAX).map((k) => (k === 'guest' ? newGuest(now) : { id: k, since: now, n: 0 })).filter((x): x is Seat => !!x);
    const g = S.stage.find((x) => x.guest);
    S.cur = { ...sc, lines: sc.lines.filter(([w]) => w).map((l) => (l[0] === 'guest' && g ? [keyOf(g), ...l.slice(1)] as Line : l)) }; S.li = 0;
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    if (root) { syncFloor(root); showProps(root, S.cur); }
    stop(); tick();
  };
  /** __barGuest('c_cecilia', { v: 5 }) → 그 명부 손님을 무대에 세우고 (그림이 없으면 실루엣) 바로 말을 걸게 한다 (기록의 방문 수를 덮어쓴다) */
  testHook.__barGuest = (gid: string, rec?: { v?: number; k?: number; named?: boolean }) => {
    guestArtAny = true;
    if (rec) { const m = loadMeta(); ((m.bar ||= {}).guests ||= {})[gid] = { v: (rec.v ?? 5) - 1, k: rec.k ?? 1, named: rec.named }; metaBarGuest(gid, 'visit'); } // 기록을 덮어쓰고 저장 (방문 +1)
    const now = clock.now();
    S.stage = S.stage.filter((x) => x.gid !== gid);
    if (S.stage.length >= STAGE_MAX) S.stage.pop();
    S.stage.push({ id: `gs_${gid}`, guest: true, gid, since: now, until: now + BAR_TUNE.hour * 2, n: 0, callAt: rec?.named ? undefined : now });
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    if (root) syncFloor(root);
    stop(); S.cur = { key: '', sit: '', lines: [], kind: 'wait', hold: 300 }; S.li = 0; tick();
  };
  testHook.__barTune = (t: Partial<typeof BAR_TUNE> & { ops?: Partial<typeof BAR_OPS> }) => { const { ops, ...rest } = t; Object.assign(BAR_TUNE, rest); if (ops) Object.assign(BAR_OPS, ops); };
  /** 주문 걸기: __barOrder('temur', 'vague') → 주문 장면 (첫 주문이면 귀띔까지, 화면과 같은 길) · __barOpen('temur') → 제조대 */
  testHook.__barOrder = (k: string, style?: OrderStyle) => {
    const s = S.stage.find((x) => keyOf(x) === k);
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    if (!s || !root || S.prep) return;
    const p = orderPick(s, clock.now(), style);
    orderTip(p.scene, aidenOn());
    hideBub(root); hideEmotes(root); stop();
    schedule(startScene(p, root));
  };
  testHook.__barOpen = (k: string) => openPrep(k);
  testHook.__barPlay = (lines: Line[]) => { S.cur = { key: '', sit: '', lines, kind: 'emote' }; S.li = 0; stop(); tick(); };
  testHook.__barPos = (bub?: (typeof BUB_POS)[number], emo?: string) => { POS.bub = bub; POS.emo = emo; };
  testHook.__barEmo = (k: string, e: string, pos?: string) => { const seat = document.querySelector<HTMLElement>(`${BAR_SEL} .bar-seat[data-seat="${k}"]:not(.out)`); if (!seat) return; const keep = POS.emo; if (pos) POS.emo = pos; showEmote(seat, e); POS.emo = keep; };
  testHook.__barStage = (ids: string[]) => { const now = clock.now(); S.stage = ids.map((id) => ({ id, since: now, n: 0 })); const root = document.querySelector<HTMLElement>(BAR_SEL); if (root) syncFloor(root); };
  testHook.__barState = () => ({ tut: loadMeta().bar?.tut || [], served: loadMeta().bar?.served || 0, memo: S.memo, memoOpen: S.memoOpen, prepMemo: !!S.prep?.memo, pay: S.stage.map((s) => [keyOf(s), s.pay || 0]), stage: S.stage.map(keyOf), night: S.night, kind: S.cur?.kind, key: S.cur?.key || S.cur?.mono, li: S.li, enterIn: Math.round(S.enterAt - clock.now()), cycleIn: Math.round(S.cycleAt - clock.now()), cups: S.stage.map((s) => [keyOf(s), s.cup?.name, cupLeft(s.cup, clock.now())]) });
  testHook.__barNight = (n: boolean) => { setNight(n, clock.now()); if (n) S.stage = S.stage.filter((s) => s.id !== 'aiden'); const root = document.querySelector<HTMLElement>(BAR_SEL); if (root) { root.classList.toggle('night', n); syncFloor(root); } };
  testHook.__barCup = (k: string, recipe: string, left = 1) => { const s = S.stage.find((x) => keyOf(x) === k); const r = RECIPE_BY_ID[recipe]; if (s && r) { s.cup = { d: r, name: r.name, by: 'aiden', at: clock.now() - (1 - left) * 200_000, dur: 200_000, alc: false }; const root = document.querySelector<HTMLElement>(BAR_SEL); if (root) syncCups(root); } };
}
/** 화면을 그린 뒤 (render 끝): 말풍선 진행을 이어 간다 */
export function barMount() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root) return;
  if (!root.dataset.bound) {
    root.dataset.bound = '1';
    root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button, a, .bar-note')) barNext(); }); // 펼친 메모를 읽는 동안은 대사를 넘기지 않는다
    // 미세 시차: 마우스를 따라 배경(장소 · 진열장 포함)은 조금, 인물은 조금 더 움직인다 (움직임 줄이기면 없음)
    if (!reduced() && matchMedia('(hover: hover)').matches) {
      let raf = 0;
      root.addEventListener('pointermove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = root.getBoundingClientRect();
          root.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
          root.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
        });
      });
    }
  }
  syncCups(root);
  clearInterval(clockTimer);
  clockTimer = window.setInterval(() => { const r = document.querySelector<HTMLElement>(BAR_SEL); if (!r) { clearInterval(clockTimer); return; } syncClock(r); }, 100); // 가속(8배)이면 0.1초 = 바 시간 약 1분
  if (S.prep) { const sec = root.querySelector<HTMLElement>('.bar-prep'); if (sec) sec.hidden = false; drawPrep(root); root.classList.add('prep-on'); return; } // 제조대를 보던 중 다시 그려졌으면 그대로
  const gain = loadMeta().bar?.coinGain;
  if (gain) { metaBarCoinShown(); window.setTimeout(() => coinFloat(gain), 1200); } // 런을 마치고 받은 코인
  // 다시 그려졌으면 지금 줄부터 다시 보여 준다
  if (S.li > 0) S.li--;
  schedule(S.timer ? 300 : 900);
}
/** 다음 대사로 넘기기 */
function barNext() { if (!advKey()) { stop(); tick(); } }
/** 바에 들어올 때: 자리를 새로 채운다 (런을 마치고 돌아오면 밤, 아니면 낮) */
export function barEnter() {
  void loadGuestPacks(); // 낯선 손님 스탠딩 묶음을 뒤에서 받는다 (받기 전에는 그 손님들이 오지 않는다)
  for (const s of S.stage) if (s.pay) metaBarCoins(s.pay); // 남겨 둔 동전은 다음 방문 전에 거둔다
  S.prep = null; S.memo = false; S.memoOpen = false; S.tipCoin = '';
  stop(); S.stage = []; S.cur = null; S.li = 0; S.session.clear(); S.gone.clear(); S.enterAt = 0; S.aidenAt = 0; S.wantH = -1; S.monoAt = -Infinity; S.monoUsed.clear(); resumeCache.t = 0;
  S.night = nightNext; nightNext = false; S.cycleAt = Infinity;
}
/** 런 결과 화면에서 바로 돌아갈 때 (다음 바 방문은 밤) */
export function barAfterRun() { nightNext = true; }
/** 잔 이름 꼬리표: 그 잔 위에 잠깐 떴다 사라진다 */
let tipTimer = 0;
function showTip(k: string, text?: string, ms = 2200) {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  const s = S.stage.find((x) => keyOf(x) === k);
  const tip = root?.querySelector<HTMLElement>('.bar-tip');
  const i = S.stage.findIndex((x) => keyOf(x) === k);
  if (!root || !s || !tip) return;
  if (text === undefined) {
    if (!s.cup || cupLeft(s.cup, clock.now()) === null) return;
    const l = cupLeft(s.cup, clock.now())!;
    text = l > 0 ? s.cup.name : `${s.cup.name} (빈 잔)`;
  }
  tip.textContent = text;
  tip.style.setProperty('--x', String(spotOf(i, S.stage.length)));
  tip.hidden = false;
  tip.classList.remove('on'); void tip.offsetWidth; tip.classList.add('on');
  clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => { tip.hidden = true; }, ms);
}

/** 검사용 (tests/bar_check.ts): 화면 없이 구경 모드를 n 단계 돌린 기록. known = 해금된 단원. 시간은 화면과 같은 규칙 (줄마다 lineMs · 첫 줄까지 · 퇴장) */
export function barSimulate(n: number, known: string[], night = false, rate = 1) {
  type Rec = { t: number; kind: string; key: string; stage: string[]; add: string[]; drop: string[]; exit?: string; speakers: string[]; emotes: string[]; mono?: string; night: boolean; cups: number; vis: number };
  const log: Rec[] = [];
  const real = clock.now;
  let t = 0;
  clock.now = () => t;
  const rec = (kind: string, plan?: Plan, exit?: string) => log.push({
    t, kind, key: S.cur?.key || '', stage: S.stage.map(keyOf), add: plan?.add || [], drop: plan?.drop || [], exit, mono: exit ? undefined : S.cur?.mono, night: S.night,
    speakers: exit ? [] : [...new Set((S.cur?.lines || []).filter((l) => l[3] !== 'e').map(([w]) => figOf(w)).filter((w) => w && w !== 'rachel'))],
    emotes: exit ? [] : (S.cur?.lines || []).filter((l) => l[3] === 'e').map(([w]) => figOf(w)),
    cups: S.stage.filter((s) => cupLeft(s.cup, t) !== null).length,
    vis: exit || !S.cur ? 0 : S.cur.lines.reduce((a, l, j) => a + lineMs(S.cur!, l, j === S.cur!.lines.length - 1), 0), // 말풍선 · 이모티콘이 떠 있는 시간
  });
  const ops = S.ops, r0 = W.rate, f0 = fastOn, real0 = clock.real, any0 = guestArtAny;
  guestArtAny = true; // 모의 실행: 손님 그림은 다 받아져 있다고 본다
  let tr = 0;
  clock.real = () => tr;
  W.rate = rate; fastOn = rate > 1; // 시간 가속 모의: 바 시계(t)는 말이 없는 동안(이모티콘 · 쉬는 시간 · 정적 · 퇴장)만 실제 ms 의 rate 배, 대사 · 혼잣말은 1배
  const adv = (ms: number, talking = false) => { t += ms * (talking ? 1 : rate); tr += ms; };
  S.ops = false; // 모의 실행에는 레이첼이 없다 (주문을 받지 않는다)
  try {
    barEnter();
    S.night = night;
    S.known = new Set([...BASE, ...known]);
    if (S.known.has('joshua')) S.known.add('cesare');
    firstStage();
    rec('first');
    adv(1500);
    for (let i = 0; i < n; i++) {
      const cur = S.cur!;
      cur.lines.forEach((l, j) => adv(lineMs(cur, l, j === cur.lines.length - 1), isTalk(l)));
      finishScene(cur, t, false);
      if (cur.exit) { leaveStage(cur.exit, t); if (cur.toNight) setNight(true, t); rec('exit', undefined, cur.exit); adv(EXIT_MS); }
      const prev = cur.exit ? null : cur;
      const p = decide(prev);
      const wait = startScene(p, null, prev);
      rec(p.scene.kind, p.plan);
      adv(wait); // 첫 줄까지 (말 없는 한때는 그 길이 전체)
    }
  } finally { clock.now = real; clock.real = real0; W.rate = r0; fastOn = f0; guestArtAny = any0; barEnter(); S.ops = ops; }
  return log;
}

// ───────── 말 걸기
const advOpts = { speaker, fmt };
/** 장면 첫 줄에 바 배경 · 그 인물 자리 */
const atBar = (id: string, beats: Beat[]): Beat[] => (beats.length ? [{ ...beats[0], bg: 'erantes_bar', stage: [{ id: figOf(id), at: 'R' as const }] }, ...beats.slice(1)] : beats);
/** 메뉴로 돌아올 때 한 줄 (빈 장면이면 배경이 없으므로) */
const backBeat = (id: string): Beat[] => atBar(id, [{ text: fillText('{name}이 잔을 다시 든다.', { name: nameOf(id) }) }]);
/** 낯선 손님에게 말 걸기: 말 걸기 표시가 떠 있으면 이름 밝히는 대화 (끝나면 이름표에 이름), 이름을 밝힌 손님이면 화제 2편, 그 밖에는 에이든과의 잡담 */
function guestTalk(k: string) {
  const s = S.stage.find((x) => keyOf(x) === k);
  const gid = gidOf(k), L = guestLines(gid), g = GUEST_BY_ID[gid];
  const at = (beats: Beat[]): Beat[] => (beats.length ? [{ ...beats[0], bg: 'erantes_bar', stage: [{ id: artOf(k), at: 'R' as const }] }, ...beats.slice(1)] : beats);
  const vars = { pc: PC, name: g?.name || '손님' };
  if (s?.calling && g && L) {
    playAdv(`bar:meet:${gid}`, at(toBeats(k, L.meet, vars)), { ...advOpts, title: '에란테스 바', onDone: () => {
      s.calling = false; s.callAt = undefined;
      metaBarGuest(gid, 'named'); metaBar('talk', `guest:${gid}`);
      const root = document.querySelector<HTMLElement>(BAR_SEL);
      if (root) { syncMarks(root, clock.now()); root.querySelectorAll<HTMLElement>(`[data-seat="${k}"] .bar-tag, [data-seat="${k}"] .bar-fig`).forEach((e) => { if (e.classList.contains('bar-tag')) e.textContent = g.name; else e.setAttribute('aria-label', `${g.name}에게 말 걸기`); }); }
    } });
    return;
  }
  if (g && L && guestNamed(gid)) { guestMenu(k, at([{ text: fillText('* {name}이 잔을 내려놓고 고개를 든다.', vars) }]), []); return; }
  playAdv('bar:guest', toBeats('aiden', pick(BAR_GUEST), { pc: PC }).map((b, i) => (i ? b : { ...b, bg: 'erantes_bar' })), { ...advOpts, title: '에란테스 바', onDone: () => {} });
}
/** 이름을 밝힌 손님의 화제 메뉴 (들은 이야기는 도감 손님 명부에) */
function guestMenu(k: string, beats: Beat[], done: number[]) {
  const gid = gidOf(k), L = guestLines(gid)!, g = GUEST_BY_ID[gid];
  const heard = new Set(loadMeta().bar?.talk || []);
  const at = (b: Beat[]): Beat[] => (b.length ? [{ ...b[0], bg: 'erantes_bar', stage: [{ id: artOf(k), at: 'R' as const }] }, ...b.slice(1)] : b);
  const tops = L.topics.map((x, i) => ({ ...x, i })).filter((x) => !done.includes(x.i));
  playAdv(`bar:gtalk:${gid}:${done.length}:${Date.now()}`, beats, {
    ...advOpts, title: done.length ? undefined : g.name,
    choices: [...tops.map((x) => ({ label: x.label, desc: heard.has(`guest:${gid}.${x.i}`) ? '들은 이야기' : undefined })), { label: '자리로 돌아간다' }],
    onDone: (c) => {
      const x = tops[c];
      if (!x) return;
      metaBar('talk', `guest:${gid}.${x.i}`);
      guestMenu(k, at(toBeats(k, x.lines, { pc: PC, name: g.name })), [...done, x.i]);
    },
  });
}
function talk(id: string) {
  const t = BAR_TALK[id];
  if (id.startsWith('g.')) { guestTalk(id); return; }
  if (id === 'guest') { playAdv('bar:guest', toBeats('aiden', pick(BAR_GUEST), { pc: PC }).map((b, i) => (i ? b : { ...b, bg: 'erantes_bar' })), { ...advOpts, title: '에란테스 바', onDone: () => {} }); return; }
  metaBarBond(id);
  // 레이첼과의 첫 만남: 처음 말을 걸면 첫 만남 장면이 열리고, 끝나면 평소 화제 메뉴로 이어진다 (도감 기록 탭 '첫 만남')
  const meet = FIRST_MEET[id];
  if (meet && !(loadMeta().bar?.talk || []).includes(`meet:${id}`)) {
    metaBar('talk', `meet:${id}`);
    const beats = atBar(id, toBeats(id, meet, { pc: PC, name: nameOf(id) }));
    if (t) topicMenu(id, beats, []); else plainMenu(id, beats, true);
    return;
  }
  const r = reactFor(id);
  if (r) metaBar('heard', r.key);
  if (!t) { plainMenu(id, atBar(id, r ? toBeats(id, r.lines, r.vars) : [{ text: fillText('{name}이 잔을 들어 보인다. 옆자리가 비어 있다.', { name: nameOf(id) }) }]), true); return; }
  const open = toBeats(id, [t.at, ...(r ? r.lines : pick(t.hello))], r?.vars || { pc: PC, name: nameOf(id) });
  topicMenu(id, atBar(id, open), []);
}
const ASK_CHOICE = { label: '물어보기…', desc: '누구에게나 묻는 질문' };
/** 실재 층 화제 표시: 심야 이야기 (에이든은 낮에만 출근하므로 마감 무렵) */
const deepTag = (id: string) => (id === 'aiden' ? '마감 무렵' : '심야');
function topicMenu(id: string, beats: Beat[], done: string[]) {
  const t = BAR_TALK[id];
  const heard = new Set(loadMeta().bar?.talk || []);
  const deep = DEEP_TOPICS[id];
  const open = deepOpen(id);
  const tops = [...t.topics, ...(deep && open ? [{ ...deep, label: `(${deepTag(id)}) ${deep.label}` }] : [])].filter((x) => !done.includes(x.key));
  const locked = deep && !open ? [{ label: `(${deepTag(id)}) …`, desc: '더 가까워지면 들을 수 있는 이야기', why: `관계 ${bondOf(id)} / ${DEEP_BOND} (말 걸기 + 함께 출전한 런)` }] : [];
  playAdv(`bar:talk:${id}:${done.length}:${Date.now()}`, beats, {
    ...advOpts, title: done.length || beats.length < 2 ? undefined : nameOf(id),
    choices: [...tops.map((x) => ({ label: x.label, desc: heard.has(`${id}.${x.key}`) ? '들은 이야기' : undefined })), ...(ASK[id] ? [ASK_CHOICE] : []), ...locked, { label: '자리로 돌아간다' }],
    onDone: (k) => {
      if (k === tops.length && ASK[id]) { askMenu(id, backBeat(id), () => topicMenu(id, backBeat(id), done)); return; }
      const x = k < tops.length ? tops[k] : null;
      if (!x) return;
      metaBar('talk', `${id}.${x.key}`);
      topicMenu(id, atBar(id, toBeats(id, x.lines, { pc: PC, name: nameOf(id) })), [...done, x.key]); // 새 장면도 같은 배경 · 같은 자리에서
    },
  });
}
/** 대본이 없는 단원: 물어보기 · 같이 있던 이야기(그 단원이 나오는 만담) */
function plainMenu(id: string, beats: Beat[], first: boolean) {
  const k = S.known;
  const seen = new Set(loadMeta().bar?.seen || []);
  const pool = shuffle(BANTER.filter((b) => b.place !== 2 && b.cast.includes(id) && b.cast.every((x) => k.has(x))));
  const b = pool.find((x) => !seen.has(x.id)) || pool[0];
  const ch = [...(ASK[id] ? [ASK_CHOICE] : []), ...(b ? [{ label: '요즘 있었던 일', desc: '이 단원이 나오는 만담 한 편' }] : []), { label: '자리로 돌아간다' }];
  playAdv(`bar:plain:${id}:${Date.now()}`, beats, {
    ...advOpts, title: first ? nameOf(id) : undefined, choices: ch,
    onDone: (c) => {
      const x = ch[c];
      if (x === ASK_CHOICE) askMenu(id, backBeat(id), () => plainMenu(id, backBeat(id), false));
      else if (b && x.label === '요즘 있었던 일') { metaBar('seen', b.id); plainMenu(id, atBar(id, [{ text: b.sit }, ...banterBeats(b)]), false); }
    },
  });
}
/** 공통 질문의 지금 깊이: 0 표면 · 1 이상 (관계 ASK_MID) · 2 실재 (관계 DEEP_BOND, 로어 있는 인물만) */
export function askTier(id: string, key: AskKey): number {
  const a = ASK[id];
  if (!a) return 0;
  const v = a[key];
  if (!Array.isArray(v)) return 0;
  const b = bondOf(id);
  return v[2] && b >= DEEP_BOND ? 2 : b >= ASK_MID ? 1 : 0;
}
const TIER_NAME = ['표면', '이상', '실재'];
const askText = (id: string, key: AskKey, tier: number) => { const v = ASK[id][key]; return Array.isArray(v) ? v[tier] || v[0] : v; };
/** 물어보기: 질문 다섯 개. 과거 · 꿈은 관계가 쌓이면 답이 깊어지고, 다음 단계까지의 진행도를 보여 준다 */
function askMenu(id: string, beats: Beat[], back: () => void) {
  const heard = new Set(loadMeta().bar?.talk || []);
  const b = bondOf(id);
  const ch = ASK_Q.map((q) => {
    const v = ASK[id][q.key];
    const tier = askTier(id, q.key);
    const max = Array.isArray(v) ? (v[2] ? 3 : 2) : 1;
    const nextAt = tier === 0 ? ASK_MID : DEEP_BOND;
    const got = heard.has(`ask:${id}.${q.key}.${tier}`);
    const desc = max > 1 ? `깊이 ${tier + 1}/${max}${tier + 1 < max ? ` · 관계 ${b}/${nextAt}에서 더 깊은 답` : ''}${got ? ' · 들은 답' : ''}` : got ? '들은 답' : undefined;
    return { label: q.label, desc };
  });
  playAdv(`bar:ask:${id}:${Date.now()}`, beats, {
    ...advOpts, choices: [...ch, { label: '다른 얘기 하자' }],
    onDone: (k) => {
      const q = ASK_Q[k];
      if (!q) { back(); return; }
      const tier = askTier(id, q.key);
      metaBar('talk', `ask:${id}.${q.key}.${tier}`);
      askMenu(id, atBar(id, [{ who: 'rachel', text: q.label }, ...toBeats(id, askLines(askText(id, q.key, tier)), { pc: PC, name: nameOf(id) })]), back);
    },
  });
}

// ───────── 통신 기록: 바 밖 만담 (지난 의뢰 단원 우선)
function awayPool(): Banter[] {
  const k = S.known.size ? S.known : knownSet();
  const last = loadMeta().bar?.last;
  if (!last) return [];
  const crew = new Set([...last.units, ...BASE]);
  const seen = new Set(loadMeta().bar?.seen || []);
  for (const id of crew) if (UNIT_BY_ID[id]?.noBar) crew.delete(id); // 바에 나오지 않는 기물(카일 · 데미우르고스 등)은 통신 기록에도 없다
  const mine = BANTER.filter((b) => b.place === 2 && !b.hold && callbackOk(b, seen) && b.cast.every((id) => crew.has(figOf(id)) || id === 'max'));
  return mine.length ? mine : BANTER.filter((b) => b.place === 2 && !b.hold && callbackOk(b, seen) && b.cast.every((id) => k.has(id)));
}
const SHIP_TOPICS = new Set(['05_travel', '13_shiplife']);
// 통신 기록 배경: 전장 일러스트 (장소 표시는 전장 이름)
for (const f of FIELDS) BGS[`field_${f.id}`] ??= f.name;
/** 통신 기록: 확장 틀을 바에서 재생하고, 끼어드는 자리는 지난 의뢰에 나간 단원이 홀로그램으로 */
function playFrameLog(): boolean {
  const last = loadMeta().bar?.last;
  if (!last) return false;
  const crew = new Set(last.units.filter((id) => !UNIT_BY_ID[id]?.noBar));
  const fs = shuffle(FRAMES.filter((f) => f.cast.every((id) => S.known.has(id)) && deepOpen(f.deep) && f.slots.some((sl) => Object.keys(sl).some((id) => crew.has(id)))));
  if (!fs.length) return false;
  const sc = buildFrame(fs[0], crew, crew, true);
  metaBar('seen', sc.key);
  const beats: Beat[] = [{ text: `홀로그램 통신이 연결된다. ${sc.sit}`, bg: 'erantes_bar' }, ...sc.lines.map(([who, text, name]) => (who ? { who, text, name } : { text }))];
  playAdv(`bar:flog:${sc.key}`, beats, { ...advOpts, title: '통신 기록 — 현장에서 끼어든 단원', onDone: () => {} });
  return true;
}
function playLog() {
  if (Math.random() < 0.5 && playFrameLog()) return;
  const pool = awayPool();
  if (!pool.length) { playFrameLog(); return; }
  const seen = new Set(loadMeta().bar?.seen || []);
  const b = shuffle(pool).find((x) => !seen.has(x.id)) || pick(pool);
  const last = loadMeta().bar?.last;
  const topic = BANTER_TOPICS[b.t];
  const bg = SHIP_TOPICS.has(topic[0]) ? 'tu_bridge' : last ? `field_${last.field}` : 'tu_bridge';
  metaBar('seen', b.id);
  playAdv(`bar:log:${b.id}`, [{ text: `통신 기록 재생. ${b.sit}`, bg }, ...banterBeats(b)], { ...advOpts, title: `통신 기록 — ${topic[1]}`, onDone: () => {} });
}

// ───────── 제조대 (후면): 주문을 누르면 카메라가 180° 돌아 여기를 본다 (src/ui/barprep.ts)
/** 주문을 받아 제조대로 돌아선다 */
function openPrep(k: string) {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  const s = S.stage.find((x) => keyOf(x) === k);
  if (!root || !s?.order) return;
  stop(); hideBub(root); hideEmotes(root);
  setRate(1);
  S.prep = newPrep(k, s.id, nameOf(k), s.order, s.orderHint);
  if (!barTutSeen('prep')) { S.prep.memo = true; metaBarTut('prep'); } // 처음 연 제조대: 에이든의 메모가 붙어 있다 (한 번만)
  metaBarTut('order'); // 주문을 받아 봤다 (첫 주문 귀띔을 못 봤어도)
  delete root.querySelector<HTMLElement>('.bar-prep')?.dataset.st; // 새 주문은 출력기 자리에서 시작 (앞 주문의 단계에서 옮겨 오지 않는다)
  drawPrep(root);
  const sec = root.querySelector<HTMLElement>('.bar-prep');
  if (sec) { sec.hidden = false; void sec.offsetWidth; }
  root.classList.add('prep-on');
}
/** 제조대 다시 그리기. 단계가 바뀌었으면 앞 단계 자리에서 그려 놓고 다음 프레임에 옮긴다 (카메라가 작업대를 따라 움직이고 영수증이 오른쪽 위로 옮겨 꽂힌다, docs/UI.md 27 · 32) */
function drawPrep(root: HTMLElement) {
  const sec = root.querySelector<HTMLElement>('.bar-prep');
  const p = S.prep;
  if (!sec || !p) return;
  const keep = ['.bp-recs', '.bp-cab', '.bp-gars'].map((q) => sec.querySelector(q)?.scrollTop || 0);
  const was = sec.dataset.st === undefined ? p.step : +sec.dataset.st;
  sec.innerHTML = prepHtml(p, nameOf);
  sec.dataset.st = String(p.step);
  ['.bp-recs', '.bp-cab', '.bp-gars'].forEach((q, i) => { const el = sec.querySelector(q); if (el) el.scrollTop = keep[i]; });
  const view = sec.querySelector<HTMLElement>('.bp-view'), rail = sec.querySelector<HTMLElement>('.bp-rail');
  const rc = rail?.querySelector<HTMLElement>('.bp-rc');
  if (view && rc) view.style.setProperty('--rch', `${rc.offsetHeight}px`); // 맛 막대 = 꽂힌 영수증 바로 아래
  if (view && rail && was !== p.step && !reduced()) {
    view.style.setProperty('--st', String(was)); rail.classList.toggle('pin', was > 0); view.classList.add('still');
    void view.offsetWidth;
    view.classList.remove('still'); view.style.setProperty('--st', String(p.step)); rail.classList.toggle('pin', p.step > 0);
  }
  if (!p.printed) { // 처음 그릴 때만: 출력기에서 영수증이 줄마다 밀려 나온다
    p.printed = true;
    if (!reduced()) for (let i = 0; i < 9; i++) sfx('print', { delay: 0.35 + i * 0.13, pitch: 1 + (i % 2) * 0.04 });
  }
}
/** 카운터로 돌아선다 (served = 방금 잔을 내줬다 → 반응 장면) */
function closePrep(after: number) {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  S.prep = null;
  if (!root) return;
  root.classList.remove('prep-on');
  const sec = root.querySelector<HTMLElement>('.bar-prep');
  window.setTimeout(() => { if (sec && !S.prep) { sec.hidden = true; sec.innerHTML = ''; } }, reduced() ? 0 : 900);
  syncFloor(root);
  schedule(after);
}
const GRADE_EMO: Record<Grade, EmoteId[]> = { like: ['heart'], ok: ['note', 'q'], bad: ['sweat', 'dots'] }; // 좋아함 = 늘 하트
/** 내주기: 그 손님 앞 카운터에 잔을 놓고, 한 모금 마신 뒤 반응 (이모티콘 + 대사, 잔 위 꼬리표에 만족 · 놓친 것) */
function serveDrink() {
  const p = S.prep;
  const s = p && S.stage.find((x) => keyOf(x) === p.k);
  if (!p || !s?.order) { closePrep(600); return; }
  const now = clock.now();
  const d = prepDrink(p);
  const v = judge(s.order, d);
  const name = recipeName(d) || `레이첼의 ${GLASS_BY_ID[d.glass]?.name || '잔'}`;
  s.cup = { d, name, by: 'player', at: now + (reduced() ? 200 : 900), dur: rand(BAR_TUNE.sip), alc: d.fill.some((x) => ALC.has(ING_BY_ID[x]?.kind)), grade: v.grade };
  s.order = undefined; s.orderHint = undefined; s.orderAt = now;
  const roster = !!s.guest && !!GUEST_BY_ID[s.gid!];
  metaBarServed(roster ? s.gid! : keyOf(s), { ...d, name: recipeName(d) || undefined }, v.grade === 'like' && (!s.guest || roster)); // 임시 · 익명 손님은 단골 장부가 없다
  const t = s.guest ? guestLines(s.gid!) || ORDER_GENERIC : orderTalk(s.id);
  const k0 = keyOf(s);
  S.cur = { key: '', sit: '', kind: 'react', lines: [[k0, pick(GRADE_EMO[v.grade]), undefined, 'e'], [k0, fillText(pick(t[v.grade]), { pc: PC })]] };
  S.li = 0;
  const k = p.k;
  closePrep(reduced() ? 600 : 1500);
  window.setTimeout(() => showTip(k, `${GRADE_NAME[v.grade]}${v.miss.length ? ` · 놓친 것: ${v.miss.join(' · ')}` : ''}`, 3600), reduced() ? 700 : 1600);
}
/** 동전 거두기 (밤에는 빈 잔도 함께 치운다 — 낮에는 에이든이 치운다) */
function collect(k: string) {
  const s = S.stage.find((x) => keyOf(x) === k);
  if (!s?.pay) return;
  metaBarCoins(s.pay);
  metaBarTut('coin'); // 동전을 거둬 봤다 (귀띔 전에 거뒀으면 귀띔은 없다)
  const n = s.pay;
  s.pay = 0;
  if (S.night && s.cup && cupLeft(s.cup, clock.now()) === 0) s.cup = undefined;
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (root) syncCups(root);
  coinFloat(n);
}

/** 바 화면 버튼 (data-a="bar-x"). 다시 그려야 하면 true */
export function barAct(v: string): boolean {
  const [k, id] = v.split(':');
  if (k === 'talk' && id) { stop(); talk(id); return false; }
  if (k === 'log') { if (!awayPool().length && !loadMeta().bar?.last) return false; stop(); playLog(); return false; } // 의뢰를 한 번 마치기 전에는 열리지 않는다 (창가 명판이 흐림)
  if (k === 'next') { barNext(); return false; }
  if (k === 'cup' && id) { showTip(id); return false; }
  if (k === 'prop' && id) { const pr = S.props[+id]; if (pr) showTip(pr.k, pr.name); return false; }
  if (k === 'fast') { toggleFast(); return false; }
  if (k === 'order' && id) { openPrep(id); return false; }
  if (k === 'coin' && id) { collect(id); return false; }
  if (k === 'memo') { // 카운터 위 에이든의 메모: 펼치기 · 접기 (같은 자리) · ✕ = 읽고 챙긴다
    if (id === 'open') S.memoOpen = !S.memoOpen; else { S.memo = false; S.memoOpen = false; }
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    if (root) syncMemo(root);
    return false;
  }
  if (k === 'prep' && S.prep) {
    const r = prepAct(S.prep, v.slice(5));
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    if (r === 'serve') { sfx('bell'); serveDrink(); }
    else if (r === 'back') closePrep(900);
    else if (r === 'draw' && root) drawPrep(root);
    return false;
  }
  return false;
}
/** 다른 화면이 열 때 바 장면이 떠 있으면 닫는다 */
export function barCloseAdv() { if (advKey()?.startsWith('bar:')) closeAdv(); }

// ───────── 도감 '기록' 탭: 바에서 본 만담 · 들은 이야기
/** 도감 '손님' 탭: 바에서 만난 낯선 손님 (명부 GUESTS 를 그릴 때마다 읽는다). 이름을 밝힌 손님 = 이름 · 소속 · 출신 · 성격 · 단골 잔 · 들은 이야기,
 *  아직 이름을 모르는 손님 = '낯선 손님' 과 방문 수, 만난 적 없는 손님은 세력별 수만 */
export function barGuestsHtml(): string {
  const m = loadMeta();
  const rec = m.bar?.guests || {};
  const talkSet = new Set(m.bar?.talk || []);
  const GROUP_NAME: Record<string, string> = { union: '성간 인류 연합', empire: '칼리토 제국', alliance: '헬레니우스 동맹', petra: '주식회사 페트라', pan: '범은하 공동체', tour: '관광객 · 여행자' };
  const RACE_NAME: Record<string, string> = { human: '인간', beast: '환수', machine: '기계', wraith: '망령', other: '그 밖' };
  const SIL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.5" fill="#888"/><path d="M3 23 C3 15 21 15 21 23 Z" fill="#888"/></svg>');
  const met = GUESTS.filter((g) => rec[g.id]?.v);
  const named = met.filter((g) => rec[g.id]?.named);
  const row = (g: (typeof GUESTS)[number]) => {
    const r = rec[g.id]!;
    const icon = ICONS[`gs_${g.id}`];
    const visits = `<span class="chip f-num">방문 ${r.v}회</span>`;
    if (!r.named) return `<div class="codex-row unknown"><img class="spr" alt="" src="${icon || SIL}"><div><b>낯선 손님</b><div class="small muted">아직 이름을 밝히지 않았다.</div></div><div>${visits}</div></div>`;
    const usual = m.bar?.usual?.[g.id];
    const L = guestLines(g.id);
    const heard = (L?.topics || []).map((x, i) => ({ x, i })).filter(({ i }) => talkSet.has(`guest:${g.id}.${i}`));
    const withAiden = (GUEST_AIDEN[g.id] || []).filter((_, i) => talkSet.has(`ga:${g.id}.${i}`)); // 에이든 × 이 손님 만담 중 본 편
    return `<div class="codex-row"><img class="spr${icon ? ' pt' : ''}" alt="" src="${icon || SIL}"><div><b>${esc(g.name)}</b> <span class="small muted">${esc(g.org)} · ${esc(g.from)} · ${esc(RACE_NAME[g.race] === g.kind ? g.kind : `${RACE_NAME[g.race]} (${g.kind})`)}</span>
      <div class="small">${esc(g.persona)}</div>${usual ? `<div class="small muted">단골 잔 · ${esc(usual.name || recipeName(usual) || '레이첼의 잔')}</div>` : ''}${heard.length ? `<div class="small muted">들은 이야기 · ${heard.map(({ x }) => esc(x.label)).join(' · ')}</div>` : ''}${withAiden.length ? `<div class="small muted">에이든과 · ${withAiden.map((t) => esc(t.sit)).join(' · ')}</div>` : ''}</div><div>${visits}</div></div>`;
  };
  const groups = Object.keys(GROUP_NAME).map((k) => ({ k, all: GUESTS.filter((g) => g.group === k), met: met.filter((g) => g.group === k) }));
  return `<p class="muted small">바에서 만난 손님 ${met.length}명 · 이름을 아는 손님 ${named.length} / ${GUESTS.length}명. 낯선 손님은 몇 번 들르다 어느 날 레이첼에게 먼저 말을 걸어 온다.</p>`
    + groups.map((x) => `<h2>${esc(GROUP_NAME[x.k])} <span class="muted small f-num">${x.met.filter((g) => rec[g.id]?.named).length} / ${x.all.length}</span></h2>${x.met.length ? `<div class="codex-list">${x.met.sort((a, b) => Number(!!rec[b.id]?.named) - Number(!!rec[a.id]?.named)).map(row).join('')}</div>` : '<p class="muted small">아직 이 쪽 손님을 만나지 못했다.</p>'}`).join('');
}
export function barRecordsHtml(): string {
  const m = loadMeta();
  const seen = new Set(m.bar?.seen || []);
  const talk = new Set(m.bar?.talk || []);
  const byTopic = BANTER_TOPICS.map(([, title], t) => ({ title, all: BANTER.filter((b) => b.t === t), got: BANTER.filter((b) => b.t === t && seen.has(b.id)) }));
  const banterN = BANTER.filter((b) => seen.has(b.id)).length;
  const line = (who: string, text: string, nm?: string) => (who ? `<p><b style="--c:${colorOf(who)}">${esc(nm || nameOf(who))}</b> ${esc(fillText(text, { pc: PC }))}</p>` : `<p class="muted">${esc(text)}</p>`);
  const scriptLines = (owner: string, ls: string[]) => ls.map((l) => { const [w, t, nm] = parseLine(l, owner); return line(w, t, nm); }).join('');
  const topicsOf = (id: string) => [...BAR_TALK[id].topics, ...(DEEP_TOPICS[id] ? [{ ...DEEP_TOPICS[id], label: `(${deepTag(id)}) ${DEEP_TOPICS[id].label}` }] : [])];
  const talkRows = Object.keys(BAR_TALK).flatMap((id) => topicsOf(id).filter((x) => talk.has(`${id}.${x.key}`)).map((x) => ({ id, x })));
  const talkAll = Object.keys(BAR_TALK).reduce((n, id) => n + topicsOf(id).length, 0);
  // 확장 틀: 본 끼어들기 조합별로
  const fseen = [...seen].filter((k) => k.includes('+'));
  const frameRows = FRAMES.map((f) => ({ f, keys: fseen.filter((k) => k.split('+')[0] === f.id) })).filter((r) => r.keys.length);
  const variants = FRAMES.reduce((n, f) => n + f.slots.reduce((a, sl) => a + Object.keys(sl).length, 0), 0);
  const frameHtml = (f: Frame, keys: string[]) => {
    const ints = new Set(keys.flatMap((k) => k.split('+').slice(1)).filter((x) => x !== '-'));
    const core = f.lines.map((l) => (/^@\d$/.test(l) ? '<p class="muted small">( 끼어드는 자리 )</p>' : scriptLines(f.cast[0], [l]))).join('');
    const slots = f.slots.map((sl) => Object.entries(sl).filter(([id]) => ints.has(id)).map(([id, ls]) => `<div class="bar-rec-v"><span class="muted small">${esc(nameOf(id))} 버전</span>${scriptLines(id, ls)}</div>`).join('')).join('');
    const total = f.slots.reduce((a, sl) => a + Object.keys(sl).length, 0);
    return `<section class="bar-rec-b"><h3>${esc(FRAME_THEME[f.theme])} · ${esc(f.sit)} <span class="muted small f-num">${ints.size}/${total}</span>${f.layer === 'r' && f.time !== 'day' ? ' <span class="muted small">심야</span>' : ''}</h3>${core}${slots}</section>`;
  };
  // 알게 된 것: 물어보기로 들은 답 (인물별, 질문 · 깊이별)
  const askRows = Object.keys(ASK).map((id) => ({ id, got: ASK_Q.flatMap((q) => [0, 1, 2].filter((t) => talk.has(`ask:${id}.${q.key}.${t}`)).map((t) => ({ q, t }))) })).filter((r) => r.got.length);
  const askAll = Object.values(ASK).reduce((n, a) => n + ASK_Q.reduce((m, q) => { const v = a[q.key]; return m + (Array.isArray(v) ? (v[2] ? 3 : 2) : 1); }, 0), 0);
  const askGot = askRows.reduce((n, r) => n + r.got.length, 0);
  // 혼잣말: 구경하다 들은 정규 단원의 혼잣말 (인물별, 종류 표시)
  const monoRows = ERANTES_CREW.filter((id) => MONO[id]).map((id) => ({ id, got: MONO_KINDS.filter((k) => talk.has(`mono:${id}.${k}`)) })).filter((r) => r.got.length);
  const monoAll = ERANTES_CREW.reduce((n, id) => n + (MONO[id] ? MONO_KINDS.length : 0), 0);
  const monoGot = monoRows.reduce((n, r) => n + r.got.length, 0);
  const monoHtml = monoRows.map(({ id, got }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} <span class="muted small f-num">${got.length}/${MONO_KINDS.length}</span></h3>${got.map((k) => `<p><b style="--c:${colorOf(id)}">${esc(MONO_KIND_NAME[k])}</b> ${esc(fillText(untag(MONO[id][k]), { pc: PC }))}</p>`).join('')}</section>`).join('');
  const knowHtml = askRows.map(({ id, got }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} <span class="muted small f-num">${got.length}</span></h3>${got.map(({ q, t }) => `<div class="bar-rec-v"><span class="muted small">${esc(q.note)}${Array.isArray(ASK[id][q.key]) ? ` · ${TIER_NAME[t]}` : ''}</span>${scriptLines(id, askLines(askText(id, q.key, t)))}</div>`).join('')}</section>`).join('');
  // 첫 만남: 처음 말을 걸 때 본 장면
  const meetRows = Object.keys(FIRST_MEET).filter((id) => talk.has(`meet:${id}`));
  const meetHtml = meetRows.map((id) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))}</h3>${scriptLines(id, FIRST_MEET[id])}</section>`).join('');
  return `<h2>에란테스 바</h2>
    <p class="muted small">본 만담 <b class="f-num">${banterN}</b> / ${BANTER.length}편 · 끼어들기 만담 <b class="f-num">${frameRows.length}</b> / ${FRAMES.length}편 (버전 <b class="f-num">${fseen.length}</b> / ${variants}) · 단원에게 들은 이야기 <b class="f-num">${talkRows.length}</b> / ${talkAll}편 · 알게 된 것 <b class="f-num">${askGot}</b> / ${askAll} · 들은 혼잣말 <b class="f-num">${monoGot}</b> / ${monoAll}.
      심야 이야기는 그 단원과 가까워지면(말 걸기 + 함께 출전한 런 ${DEEP_BOND}) 열립니다.</p>
    <div class="bar-rec">
      ${meetRows.length ? `<details><summary><b>첫 만남</b> <span class="muted small f-num">${meetRows.length}/${Object.keys(FIRST_MEET).length}</span></summary>${meetHtml}</details>` : ''}
      ${monoRows.length ? `<details><summary><b>혼잣말</b> <span class="muted small f-num">${monoGot}/${monoAll}</span></summary>${monoHtml}</details>` : ''}
      ${askRows.length ? `<details><summary><b>알게 된 것</b> <span class="muted small f-num">${askGot}/${askAll}</span></summary>${knowHtml}</details>` : ''}
      ${talkRows.length ? `<details><summary><b>단원 이야기</b> <span class="muted small f-num">${talkRows.length}/${talkAll}</span></summary>
        ${talkRows.map(({ id, x }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} · ${esc(x.label)}</h3>${scriptLines(id, x.lines)}</section>`).join('')}</details>` : ''}
      ${frameRows.length ? `<details><summary><b>끼어들기 만담</b> <span class="muted small f-num">${frameRows.length}/${FRAMES.length}</span></summary>${frameRows.map((r) => frameHtml(r.f, r.keys)).join('')}</details>` : ''}
      ${byTopic.filter((g) => g.got.length).map((g) => `<details><summary><b>${esc(g.title)}</b> <span class="muted small f-num">${g.got.length}/${g.all.length}</span></summary>
        ${g.got.map((b) => `<section class="bar-rec-b"><h3>${b.cast.map((id) => esc(nameOf(id))).join(' × ')} <span class="muted small">— ${esc(b.sit)}</span></h3>${b.lines.map(([w, t, nm]) => line(w, t, nm)).join('')}</section>`).join('')}</details>`).join('')}
      ${!seen.size && !talkRows.length && !askRows.length && !monoRows.length ? '<p class="muted small">아직 바에 들르지 않았습니다. 타이틀이나 메뉴에서 「에란테스 바」로 갈 수 있습니다.</p>' : ''}
    </div>`;
}
