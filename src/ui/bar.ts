// 에란테스 바 허브: 지상의 진짜 바. 런 사이에 들러 단원 · 손님의 잡담을 구경하고 말을 건다.
// - 구경: 무대에 인물이 최대 3명(에이든 · 손님 포함) 허리 위로 서 있고, 말풍선이 하나씩 돌며 만담(docs/banter → banter.gen.ts)을 보여 준다.
//   레이첼(지휘관)은 무대에 서지 않는다. 레이첼 대사는 화면 아래쪽 '무대 밖' 말풍선으로 (플레이어 목소리처럼).
//   에이든은 자기가 나오는 장면에서만 카운터 뒤에서 나온다 (만담 출연 인원 분포 → 3석을 단원과 나눠 쓰는 쪽이 재생 가능한 장면이 많다).
// - 입퇴장: 장면이 끝나면 일정 확률로 한 사람이 작별 인사(data/bar/leave.ts)를 하고 나간다 → 10~30초 빈자리 (남은 사람끼리 장면 · 대기)
//   → 새 인물이 들어와 합류 장면 (남아 있던 사람과 새 사람이 함께 나오는 장면 우선). 무대는 0명이 되지 않는다.
// - 말 걸기: 인물을 누르면 미연시 화면(playAdv). 직전 런 기록에 맞는 반응 대사가 먼저, 그다음 화제 선택지.
// - 통신 기록: 바 밖(전장 · 함선) 만담은 '지난 의뢰 통신 기록'으로 재생한다.
// 보상은 없다. 본 만담 · 들은 이야기는 도감 '기록' 탭에 모인다 (meta.bar).
import { BANTER, BANTER_TOPICS, type Banter } from '../data/bar/banter.gen';
import { REACT_RULES, type ReactCtx } from '../data/bar/react';
import { FRAME_THEME, FRAMES, type Frame } from '../data/bar/frames';
import { ASK, ASK_MID, ASK_Q, askLines, type AskKey } from '../data/bar/ask';
import { BAR_GUEST, BAR_IDLE, BAR_TALK, DEEP_TOPICS, FIELD_SHORT, GENERIC_REACT } from '../data/bar/talk';
import { AIDEN_BACK, BAR_ENTER, BAR_WAIT, LEAVE_GENERIC, LEAVE_LINES } from '../data/bar/leave';
import { ERANTES_CREW, MONO, MONO_KIND_NAME, MONO_KINDS, MONO_LEAD, MONO_TAG } from '../data/bar/mono';
import { FIELDS, fieldOf } from '../data/battlefields';
import { EVENT_BY_ID } from '../data/events';
import { BGS, fillText, NPCS, type Beat } from '../data/scene';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, UNITS } from '../data/units';
import { advKey, closeAdv, playAdv } from './adv';
import { barShowcaseHtml } from './achieve';
import { loadMeta, metaBar, metaBarBond } from './meta';
import { bgURL, standURL } from './portraits';
import { STAND_FACE } from './standface.gen';
import { listSaves, loadRun } from './save';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const shuffle = <T>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
/** 바에서는 지휘관을 레이첼로 부른다 */
const PC = '레이첼';
/** 튜토리얼(당직 근무)에서 만나는 단원: 튜토리얼을 봤으면 바에 나온다 */
const TUT_CAST = ['yelena', 'franze', 'lindiwe', 'vivian', 'phyllis', 'temur', 'nadir'];
/** 바에 늘 있는 인물: 바텐더 · 지휘관 */
const BASE = ['aiden', 'rachel'];
/** 무대 인원 상한 (에이든 · 손님 포함). 레이첼은 무대에 서지 않고 화면 아래쪽 말풍선으로만 말한다 */
export const STAGE_MAX = 3;
/** 입퇴장 · 쉬는 시간 (ms · 확률). 확인용 주소(?bartest)의 __barTune 으로만 바꾼다.
 *  leave: 장면 · 혼잣말이 끝난 뒤 다 머문 사람이 인사하고 나갈 확률 (무대가 꽉 찼을 때, 빈자리가 있으면 절반). 정규 단원 · 다른 단원 · 에이든(카운터 뒤로 잠깐)
 *  stay: 들어온 뒤 적어도 이만큼은 머문다 · vacant: 퇴장(입장) 뒤 다음 단원이 들어오기까지 · rest: 장면 사이 말 없이 쉬는 시간
 *  quiet: 무대가 꽉 찬 채 볼 장면 없이 이만큼 조용하면 한 사람이 일어난다 · aidenBack: 카운터 뒤로 간 에이든이 다시 나오기까지
 *  mono · monoGap: 볼 장면이 없을 때 혼잣말이 나올 확률 · 혼잣말 사이 최소 간격 · crewBonus: 정규 단원이 새로 들어오는 장면의 가산점
 *  (정규 단원은 오래 머물고 덜 나가므로 가산점은 작게: 모의 실행 기준 단원 시간의 약 94%가 정규 단원) */
export const BAR_TUNE = {
  leave: { crew: 0.07, other: 0.18, aiden: 0.03 },
  stay: { crew: 150_000, other: 90_000, aiden: 120_000 },
  vacant: [40_000, 80_000] as [number, number],
  rest: [4_000, 9_000] as [number, number],
  quiet: 40_000,
  aidenBack: [20_000, 45_000] as [number, number],
  mono: 0.3,
  monoGap: 50_000,
  crewBonus: 1,
};
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
const nameOf = (id: string) => (id === 'cesare' ? '체사레' : id === 'guest' ? '손님' : UNIT_BY_ID[id]?.name || NPCS[id]?.name || id);
/** 무대에 세우는 그림 (체사레 = 조슈아) */
const figOf = (id: string) => (id === 'cesare' ? 'joshua' : id);
const colorOf = (id: string) => {
  const d = UNIT_BY_ID[figOf(id)];
  return (d && SYN_BY_ID[(d.factions[0] || d.traits[0]) as keyof typeof SYN_BY_ID]?.color) || NPCS[id]?.color || 'var(--c-text-2)';
};
function speaker(id: string) {
  const f = figOf(id);
  return { name: nameOf(id), color: colorOf(id), stand: UNIT_BY_ID[f] && standURL(f) ? f : null };
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
let resumeCache: { t: number; v: ReactCtx['resume'] | null } = { t: 0, v: null };
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
/** 무대에 선 인물. guest = 해금 안 된 인물의 실루엣(손님) · since = 들어온 시각 · n = 들어온 뒤 말한 장면 수 */
interface Seat { id: string; guest?: boolean; since: number; n: number }
/** 장면 줄: [화자 id ('' = 서술), 대사, 이름표?] */
type Line = [string, string, string?];
/** kind: scene 만담 · idle 바텐더와 손님 · mono 정규 단원 혼잣말 · leave 작별 인사 (끝나면 exit 가 나간다, 에이든은 카운터 뒤로) · wait 대기 (hold 동안)
 *  mono = 들은 혼잣말 기록 키 (도감 '기록' 탭) */
interface Scene { key: string; sit: string; lines: Line[]; layer?: 's' | 'i' | 'r'; kind: 'scene' | 'idle' | 'mono' | 'leave' | 'wait'; exit?: string; hold?: number; mono?: string; idle?: number }
/** 장면을 시작하기 전의 무대 변화 (무대 키): add 들어오는 사람 · drop 카운터 뒤로 비켜 주는 에이든 · 나가는 손님 */
interface Plan { add: string[]; drop: string[] }
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
  /** 새 인물이 들어올 수 있는 시각: 자리가 빈 뒤 BAR_TUNE.vacant */
  enterAt: 0,
  /** 이번 방문에 인사하고 나간 사람 (다른 사람이 있으면 다시 들어오지 않는다) */
  gone: new Set<string>(),
  /** 카운터 뒤로 간 에이든이 다시 나올 수 있는 시각 */
  aidenAt: 0,
  /** 마지막으로 대화(만담 · 손님 대화)가 끝난 시각: 오래 조용하면 한 사람이 일어난다 */
  talkAt: 0,
  /** 마지막 혼잣말 시각 · 이번 방문에 나온 혼잣말 */
  monoAt: -Infinity,
  monoUsed: new Set<string>(),
};
const BAR_SEL = 'main.bar';
/** 바 안에 늘 있는 사람: 기다리지 않고 바로 나온다 (에이든은 카운터 뒤에서, 손님은 문가에서) */
const BAR_FOLK = new Set(['aiden', 'guest']);
/** 정규 에란테스 단원 (lore/_틀/틀-에란테스.md, 레이첼 제외): 바에 들어올 가중치가 크고 오래 머문다 */
const CREW = new Set(ERANTES_CREW);
const keyOf = (s: Seat) => (s.guest ? 'guest' : s.id);
const regulars = () => S.stage.filter((s) => !s.guest && s.id !== 'aiden');
/** 장면에 필요한 무대 인원 (레이첼 제외 · 체사레 = 조슈아 그림 · 손님 = 'guest') */
const needOf = (ids: string[]) => [...new Set(ids.filter((id) => id && id !== 'rachel').map(figOf))];
/** 시계 (검사용 모의 실행이 바꿔 끼운다) */
const clock = { now: () => performance.now() };
const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);
const weighted = <T>(xs: T[], w: (x: T) => number): T => { let r = Math.random() * xs.reduce((a, x) => a + w(x), 0); return xs.find((x) => (r -= w(x)) < 0) ?? xs[xs.length - 1]; };

function eligibleAmbient(): Banter[] {
  const k = S.known;
  return BANTER.filter((b) => b.place !== 2 && b.cast.every((id) => k.has(id)) && needOf(b.cast).length <= STAGE_MAX);
}
/** 들어올 수 있는 단원: 해금됐고 무대에 없는 사람 (이번 방문에 나간 사람은 다른 사람이 없을 때만) */
function entrants(): string[] {
  const on = new Set(S.stage.map(keyOf));
  const all = [...S.known].filter((id) => !BASE.includes(id) && UNIT_BY_ID[id] && !on.has(id));
  const fresh = all.filter((id) => !S.gone.has(id));
  return fresh.length ? fresh : all;
}
/** 무대에 빈자리가 없다 (손님은 곧 나가므로 세지 않는다) */
const isFull = () => S.stage.filter((s) => !s.guest).length >= STAGE_MAX;
/** 빈자리가 있고 대기가 끝났나 (새 인물 1명이 들어올 수 있다) */
const canEnter = (now: number) => !isFull() && now >= S.enterAt && entrants().length > 0;
/** 이 장면을 지금 무대로 재생할 수 있나. 에이든 · 손님은 바로 나오고, 단원은 fresh 명까지만 새로 들어온다 (ok = 들어올 수 있는 단원).
 *  손님은 자기 장면이 끝나면 나간다. 에이든은 장면 때문에 밀려나지 않는다 (거의 늘 무대에: 3자리가 모자란 장면은 에이든이 쉬러 들어갔을 때만).
 *  무대가 비지 않게 한 명은 남긴다. 재생할 수 없으면 null */
function planFor(need: string[], fresh: number, ok: Set<string>): Plan | null {
  const on = S.stage.map(keyOf);
  const want = new Set(need);
  const add = need.filter((k) => !on.includes(k));
  const newbie = add.filter((k) => !BAR_FOLK.has(k));
  if (newbie.length > fresh || !newbie.every((k) => ok.has(k))) return null;
  const drop = on.filter((k) => k === 'guest' && !want.has(k));
  let size = on.length - drop.length + add.length;
  if (size === 0 && drop.length) { drop.pop(); size++; }
  return size <= STAGE_MAX ? { add, drop } : null;
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
  return { key: `${f.id}+${ints.filter(Boolean).join('+') || '-'}`, sit: f.sit, lines, layer: f.layer, kind: 'scene' };
}
/** 확장 틀의 핵심 대화에 필요한 무대 인원 (핵심 인물 + 핵심 줄에서 말하는 사람: '손님:' 줄이 있으면 손님 자리) */
const frameNeed = (f: Frame) => needOf([...f.cast, ...f.lines.filter((l) => !/^@\d$/.test(l)).map((l) => parseLine(l, f.cast[0])[0])]);
/** 확장 틀을 지금 무대로: 끼어드는 자리는 무대에 있는 사람 → 무대 밖 레이첼 · 자리가 있으면 카운터의 에이든 · 합류할 수 있으면 새 인물 */
function stageFrame(f: Frame, plan: Plan, fresh: number, ok: Set<string>): Scene {
  const on = new Set([...S.stage.map(keyOf), ...plan.add]);
  const size = () => S.stage.length - plan.drop.length + plan.add.length;
  const seated = (k: string) => on.has(k) && !plan.drop.includes(k);
  const canCall = (id: string) => {
    const k = figOf(id);
    if (k === 'rachel' || seated(k)) return true;
    if (size() >= STAGE_MAX) return false;
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
/** 다음 장면: 지금 무대로 재생할 수 있는 것만 (빈자리 대기가 끝났으면 새 인물 fresh 명까지).
 *  층을 먼저 고르고 (실재 10% · 이상 25%), 그 안에서 합류 장면 · 안 본 것 · 확장 틀 · 무대에 있는 사람이 나오는 것 우선.
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
  const offer = (layer: Item['layer'], base: number, need: string[], make: Item['make']) => {
    avail++;
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
    offer(b.layer, seen.has(b.id) ? 0 : 4, needOf([...b.cast, ...b.lines.map((l) => l[0])]), () => ({ key: b.id, sit: b.sit, layer: b.layer, kind: 'scene', lines: b.lines.map((l) => [l[0], fillText(l[1], { pc: PC }), l[2]] as Line) }));
  }
  for (const f of FRAMES) {
    if (!f.cast.every((id) => S.known.has(id)) || !deepOpen(f.deep) || (!repeat && [...S.session].some((k) => k.startsWith(f.id + '+')))) continue;
    offer(f.layer, seenFrame.has(f.id) ? 2 : 6, frameNeed(f), (p) => stageFrame(f, p, fresh, ok));
  }
  // 빈자리 대기가 끝났으면 합류 장면부터
  const pool = fresh === 1 && items.some((x) => x.join) ? items.filter((x) => x.join) : items;
  const roll = Math.random();
  const by = (l: string) => pool.filter((x) => x.layer === l);
  const layerPool = roll < DEEP_SHARE && by('r').length ? by('r') : roll < DEEP_SHARE + IDEAL_SHARE && by('i').length ? by('i') : by('s').length ? by('s') : pool;
  const best = layerPool.map((x) => ({ x, sc: x.score + Math.random() * 2 })).sort((a, b) => b.sc - a.sc)[0]?.x;
  // 바텐더 · 손님 대화: 해금한 단원이 적으면 번갈아, 아니면 볼 장면이 없을 때 가끔 (손님은 드물게 · 같은 대화는 방문마다 한 번)
  const idleTurn = !(fresh === 1 && pool !== items) && avail < 8 && (S.idleI + S.session.size) % 2 === 1;
  if (idleTurn || (!best && (avail < 8 || repeat || Math.random() < 0.2))) {
    const left = BAR_IDLE.map((_, i) => (S.idleI + i) % BAR_IDLE.length).filter((i) => repeat || !S.session.has(`idle:${i}`));
    const i = left[0];
    const it = i === undefined ? null : BAR_IDLE[i];
    const lines = it ? it.lines.map((l) => parseLine(l, 'aiden')) : [];
    const plan = it && planFor(needOf(lines.map(([w]) => w)), 0, ok);
    if (it && plan) { S.idleI = i! + 1; return { scene: { key: '', sit: it.sit, lines, kind: 'idle', idle: i }, plan }; }
  }
  return best ? { scene: best.make(best.plan), plan: best.plan } : null;
}
/** 다 머물렀나: 들어온 뒤 BAR_TUNE.stay 만큼은 (정규 단원이 가장 오래) */
const stayed = (s: Seat, now: number) => now - s.since >= (s.id === 'aiden' ? BAR_TUNE.stay.aiden : CREW.has(s.id) ? BAR_TUNE.stay.crew : BAR_TUNE.stay.other);
/** 작별 인사: 무대의 단원 한 명이 인사하고 나간다 (단원이 2명 이상일 때만, 다른 단원 · 오래 있던 사람일수록 먼저).
 *  force = 오래 조용해서 자리를 돌릴 때 (확률 없이). 에이든은 아주 가끔 카운터 뒤로 돌아간다 (작별이 아니라 잠깐) */
function leaveScene(now: number, force = false): Pick | null {
  const regs = regulars();
  const half = isFull() ? 1 : 0.5;
  const cand = regs.length >= 2 ? regs.filter((s) => (force || s.n >= 1) && stayed(s, now)) : [];
  const goes = force ? cand : cand.filter((s) => Math.random() < (CREW.has(s.id) ? BAR_TUNE.leave.crew : BAR_TUNE.leave.other) * half);
  if (goes.length) {
    const s = weighted(goes, (x) => (CREW.has(x.id) ? 1 : 3) * (1 + (now - x.since) / 120_000));
    const vars = { name: nameOf(s.id) };
    const line = parseLine(fillText(pick(LEAVE_LINES[s.id] || LEAVE_GENERIC), vars), s.id);
    return { scene: { key: '', sit: fillText('{name}이 자리에서 일어난다', vars), lines: [line], kind: 'leave', exit: s.id }, plan: { add: [], drop: [] } };
  }
  const aiden = S.stage.find((s) => s.id === 'aiden');
  if (!force && aiden && S.stage.length > 1 && stayed(aiden, now) && Math.random() < BAR_TUNE.leave.aiden) {
    return { scene: { key: '', sit: '', lines: [['aiden', fillText(pick(AIDEN_BACK), { pc: PC })]], kind: 'leave', exit: 'aiden' }, plan: { add: [], drop: [] } };
  }
  return null;
}
/** 대기: 볼 장면이 없으면 몸짓 서술 한 줄 또는 잠깐의 정적 (손님은 나간다). 빈자리가 있으면 새 사람이 올 때까지 몇 번에 나눠 */
function waitScene(now: number): Pick {
  const regs = regulars();
  const who = regs.length ? pick(regs).id : 'aiden';
  const hold = !isFull() && S.enterAt > now ? Math.max(4000, Math.min(10_000, S.enterAt - now)) : rand([5000, 9000]);
  const lines: Line[] = Math.random() < 0.5 ? [['', fillText(pick(BAR_WAIT), { name: nameOf(who), pc: PC })]] : [];
  return { scene: { key: '', sit: '', lines, kind: 'wait', hold }, plan: planFor([], 0, new Set()) || { add: [], drop: [] } };
}
/** 혼잣말: 볼 장면이 없을 때 가끔, 무대의 정규 단원 한 명이 말풍선 하나 (이번 방문에 나온 줄은 다시 안 나오고, 안 들은 줄 먼저).
 *  잠꼬대 · 술주정은 앞에 짧은 서술 */
function monoScene(now: number): Pick | null {
  if (now - S.monoAt < BAR_TUNE.monoGap || Math.random() >= BAR_TUNE.mono) return null;
  const heard = new Set(loadMeta().bar?.talk || []);
  const opts = S.stage.filter((s) => !s.guest && MONO[s.id]).flatMap((s) => MONO_KINDS.filter((k) => !S.monoUsed.has(`${s.id}.${k}`)).map((k) => ({ id: s.id, k, key: `mono:${s.id}.${k}` })));
  if (!opts.length) return null;
  const fresh = opts.filter((o) => !heard.has(o.key));
  const o = pick(fresh.length ? fresh : opts);
  S.monoUsed.add(`${o.id}.${o.k}`);
  S.monoAt = now;
  const vars = { name: nameOf(o.id), pc: PC };
  const lead = MONO_LEAD[o.k];
  const lines: Line[] = [...(lead ? [['', fillText(lead, vars)] as Line] : []), [o.id, fillText(MONO[o.id][o.k], vars), `${nameOf(o.id)} (${MONO_TAG[o.k]})`]];
  return { scene: { key: '', sit: '', lines, kind: 'mono', mono: o.key }, plan: planFor([], 0, new Set()) || { add: [], drop: [] } };
}
/** 조용한 한때: 가끔 혼잣말, 아니면 대기 */
const quietBeat = (now: number) => monoScene(now) || waitScene(now);
/** 장면이 끝난 뒤 할 일: 작별 인사 · 다음 장면 (빈자리 대기가 끝났으면 합류) · 혼잣말 · 대기. 에이든은 자리가 있으면 카운터에서 다시 나온다 */
function decide(prev: Scene | null): Pick {
  const now = clock.now();
  const p = decideInner(prev, now);
  // 에이든: 카운터 뒤에서 쉬었으면 빈자리로 다시 나온다 (거의 늘 무대에 있게)
  const size = S.stage.length - p.plan.drop.length + p.plan.add.length;
  if (p.scene.kind !== 'leave' && !S.stage.some((s) => s.id === 'aiden') && !p.plan.add.includes('aiden') && !p.plan.drop.includes('aiden') && size < STAGE_MAX && now >= S.aidenAt) p.plan.add.push('aiden');
  return p;
}
function decideInner(prev: Scene | null, now: number): Pick {
  // 1) 장면 · 혼잣말이 끝나면 다 머문 사람이 일정 확률로 인사하고 나간다
  if (prev && prev.kind !== 'wait' && prev.kind !== 'leave') {
    const l = leaveScene(now);
    if (l) return l;
  }
  // 2) 지금 무대로 재생할 수 있는 장면
  const fresh = canEnter(now) ? 1 : 0;
  const nx = nextScene(fresh);
  if (nx) return nx;
  // 3) 볼 장면이 없다: 꽉 찬 채 오래 조용하면 한 사람이 일어나 자리를 돌리고, 곧 누가 올 거면 혼잣말 · 대기, 더 올 사람이 없으면 본 장면을 다시
  const others = entrants().length > 0;
  if (isFull() && others) return (now - S.talkAt >= BAR_TUNE.quiet && leaveScene(now, true)) || quietBeat(now);
  if (others && !fresh) return quietBeat(now);
  return nextScene(fresh, true) || quietBeat(now);
}
function guestSeat(): { id: string; guest: true } {
  const pool = UNITS.filter((d) => !S.known.has(d.id) && standURL(d.id) && !d.inert && !d.noBar);
  return { id: pool.length ? pick(pool).id : 'guest', guest: true };
}
/** 무대 계획 반영: 물러날 사람을 빼고, 에이든은 카운터 쪽(왼쪽) · 나머지는 문 쪽(오른쪽)에 세운다 */
function applyPlan(plan: Plan, now: number) {
  if (plan.drop.length) S.stage = S.stage.filter((s) => !plan.drop.includes(keyOf(s)));
  if (plan.drop.includes('aiden')) S.aidenAt = now + rand(BAR_TUNE.aidenBack);
  for (const k of plan.add) {
    if (S.stage.some((s) => keyOf(s) === k)) continue;
    if (k === 'aiden') S.stage.unshift({ id: k, since: now, n: 0 });
    else S.stage.push(k === 'guest' ? { ...guestSeat(), since: now, n: 0 } : { id: k, since: now, n: 0 });
  }
}
/** 작별 인사를 마친 사람이 나간다: 빈자리는 BAR_TUNE.vacant 동안 비워 둔다 (에이든은 카운터 뒤로 잠깐) */
function leaveStage(id: string, now: number) {
  S.stage = S.stage.filter((s) => keyOf(s) !== id);
  if (id === 'aiden') { S.aidenAt = now + rand(BAR_TUNE.aidenBack); return; }
  S.gone.add(id);
  S.enterAt = Math.max(S.enterAt, now + rand(BAR_TUNE.vacant));
}
/** 장면 · 혼잣말이 끝났을 때의 기록 (본 장면 · 들은 혼잣말 · 마지막 대화 시각). save = 메타에 남긴다 (모의 실행은 안 남김) */
function finishScene(cur: Scene | null, now: number, save: boolean) {
  if (!cur) return;
  if (cur.key) { if (save) metaBar('seen', cur.key); S.session.add(cur.key); }
  else if (cur.kind === 'idle') S.session.add(`idle:${cur.idle}`);
  if (cur.mono && save) metaBar('talk', cur.mono);
  if (cur.kind === 'scene' || cur.kind === 'idle') S.talkAt = now;
}
/** 장면 시작: 무대를 바꾸고 (새 인물이 들어오면 위쪽에 들어오는 서술), 첫 줄까지 기다릴 시간을 돌려준다.
 *  앞 장면 · 혼잣말 뒤에는 BAR_TUNE.rest 만큼 말 없이 쉰다 */
function startScene(p: Pick, root: HTMLElement | null, prev: Scene | null = null): number {
  const now = clock.now();
  const before = new Set(regulars().map((s) => s.id));
  applyPlan(p.plan, now);
  const fresh = regulars().filter((s) => !before.has(s.id));
  const enter = fresh.length ? fillText(pick(BAR_ENTER), { name: nameOf(fresh[0].id) }) : '';
  if (fresh.length) S.enterAt = now + rand(BAR_TUNE.vacant); // 자리가 또 비어도 다음 사람은 다시 한참 뒤
  const speak = new Set(p.scene.lines.map(([w]) => figOf(w)));
  for (const s of S.stage) if (speak.has(keyOf(s))) s.n++;
  S.cur = p.scene; S.li = 0;
  const rest = prev && prev.kind !== 'wait' && prev.kind !== 'leave' ? rand(BAR_TUNE.rest) : 0;
  const silent = p.scene.kind === 'wait' && !p.scene.lines.length ? p.scene.hold || 2500 : 0;
  if (!root) return rest + (silent || (enter ? 2600 : 1200));
  const sit = root.querySelector<HTMLElement>('.bar-sit');
  if (sit) sit.textContent = enter || (p.scene.sit ? `— ${p.scene.sit}` : '');
  root.classList.toggle('late', p.scene.layer === 'r'); // 실재 층: 심야 조명
  const moved = syncFloor(root);
  return rest + (silent || (enter ? 2600 : moved && !reduced() ? 1800 : 1200));
}
/** 처음 들어올 때: 첫 장면의 출연자가 이미 앉아 있다 (혼자면 말없이 잔을 든 단원 한 명 더 — 정규 단원일 때가 많다), 자리가 있으면 에이든도 */
function firstStage() {
  const now = clock.now();
  S.stage = []; S.enterAt = 0; S.talkAt = now; S.aidenAt = 0;
  const p = nextScene(STAGE_MAX) || waitScene(now);
  applyPlan(p.plan, now);
  if (regulars().length < 2 && S.stage.length < STAGE_MAX) { const e = entrants(); if (e.length) S.stage.push({ id: weighted(e, (id) => (CREW.has(id) ? 6 : 1)), since: now, n: 0 }); }
  if (S.stage.length < STAGE_MAX && !S.stage.some((s) => s.id === 'aiden')) S.stage.unshift({ id: 'aiden', since: now, n: 0 });
  S.enterAt = now + rand(BAR_TUNE.vacant);
  const speak = new Set(p.scene.lines.map(([w]) => figOf(w)));
  for (const s of S.stage) if (speak.has(keyOf(s))) s.n++;
  S.cur = p.scene; S.li = 0;
}

// ───────── 그리기
/** 무대 위치 (0~1): 인원에 맞춰 가운데로 모은다 */
const SPOTS = [[0.5], [0.3, 0.7], [0.17, 0.5, 0.83]];
const spotOf = (i: number, n: number) => SPOTS[Math.min(Math.max(n, 1), 3) - 1][i] ?? 0.5;
/** 허리 위 구도: 스탠딩은 전신이라 얼굴 위치표(standface.gen.ts)로 맞춘다. 얼굴 가운데를 자리 가운데에, 턱을 칸 위에서 CHIN_AT 높이에,
 *  얼굴(눈썹~턱)을 칸 높이의 FACE_AT 로 (그림마다 얼굴 크기 · 위치가 조금씩 달라서). 칸 아래(허리)부터는 마스크로 흐려 자른다 */
const CHIN_AT = 0.36, FACE_AT = 0.126;
function figStyle(f: string) {
  const [fx, brow, chin] = STAND_FACE[f] || [0.5, 0.099, 0.152];
  const r = Math.min(2.8, Math.max(1.9, FACE_AT / Math.max(0.01, chin - brow))); // 그림 높이 ÷ 칸 높이
  return `--fx:${fx};--fy:${(CHIN_AT / r - chin).toFixed(3)};--fr:${r.toFixed(3)};--cut:${(chin + (1 - CHIN_AT) / r).toFixed(3)}`;
}
function seatHtml(s: Seat, x: number) {
  const f = figOf(s.id);
  const url = UNIT_BY_ID[f] ? standURL(f) : null;
  const nm = s.guest ? '낯선 손님' : nameOf(s.id);
  const tag = `<span class="bar-tag f-ui">${esc(nm)}</span>`;
  const art = url ? `<img alt="" src="${url}" style="${figStyle(f)}" decoding="async" onerror="this.remove()">` : '<i class="bar-sil" aria-hidden="true"></i>';
  return `<div class="bar-seat" data-seat="${keyOf(s)}" style="--x:${x}"><button class="bar-fig${s.guest ? ' is-guest' : ''}" data-a="bar-x" data-v="talk:${s.guest ? 'guest' : s.id}" aria-label="${esc(nm)}에게 말 걸기">${art}${tag}</button></div>`;
}
/** 무대: 인물들 + 말풍선 하나 (말풍선은 늘 인물 그림 위 층) */
function floorHtml() { return `${S.stage.map((s, i) => seatHtml(s, spotOf(i, S.stage.length))).join('')}<div class="bar-bub" hidden></div>`; }
/** 무대 DOM 을 S.stage 에 맞춘다: 나간 사람은 옆으로 걸어 나가고 (에이든은 카운터 뒤로), 들어온 사람은 옆에서 걸어 들어오고, 남은 사람은 자리를 고쳐 선다.
 *  움직임이 있었으면 true */
function syncFloor(root: HTMLElement): boolean {
  const fl = root.querySelector<HTMLElement>('.bar-floor');
  if (!fl) return false;
  const want = S.stage.map(keyOf);
  let moved = false;
  fl.querySelectorAll<HTMLElement>('.bar-seat:not(.out)').forEach((el) => { if (!want.includes(el.dataset.seat!)) { exitSeat(el); moved = true; } });
  const bub = fl.querySelector('.bar-bub');
  S.stage.forEach((s, i) => {
    const x = String(spotOf(i, S.stage.length));
    const el = fl.querySelector<HTMLElement>(`.bar-seat[data-seat="${keyOf(s)}"]:not(.out)`);
    if (el) { if (el.style.getPropertyValue('--x') !== x) { el.style.setProperty('--x', x); moved = true; } return; }
    const t = document.createElement('template');
    t.innerHTML = seatHtml(s, +x);
    const nw = t.content.firstElementChild as HTMLElement;
    // 옆에서 몇 걸음 걸어 들어오며 또렷해진다 (에이든은 카운터 뒤에서 올라온다 · 움직임 줄이기: 제자리에서 짧게 페이드)
    const from = s.id === 'aiden' ? 'b' : +x < 0.5 ? 'l' : 'r';
    nw.dataset.from = from;
    nw.classList.add('off');
    if (from !== 'b' && !reduced()) nw.style.setProperty('--x', String(+x + (from === 'l' ? -0.14 : 0.14)));
    fl.insertBefore(nw, bub);
    moved = true;
    void nw.offsetWidth;
    nw.classList.remove('off');
    nw.style.setProperty('--x', x);
  });
  fl.dataset.n = String(S.stage.length);
  return moved;
}
/** 나가는 사람: 가까운 쪽으로 몇 걸음 걸어가며 천천히 흐려진다 (에이든은 카운터 뒤로 내려가며). 움직임 줄이기 설정이면 제자리에서 짧게 흐려진다.
 *  흐려짐이 끝난 뒤에 지운다 (transitionend, 늦어도 2.8초) */
function exitSeat(el: HTMLElement) {
  el.classList.remove('talking');
  el.classList.add('out');
  const x = parseFloat(el.style.getPropertyValue('--x')) || 0.5;
  const to = el.dataset.seat === 'aiden' ? 'b' : x < 0.5 ? 'l' : 'r';
  el.dataset.from = to;
  if (to !== 'b' && !reduced()) el.style.setProperty('--x', String(x + (to === 'l' ? -0.14 : 0.14)));
  el.classList.add('off');
  let done = false;
  const rm = () => { if (!done) { done = true; el.remove(); } };
  el.addEventListener('transitionend', (e) => { if (e.target === el && e.propertyName === 'opacity') rm(); });
  window.setTimeout(rm, reduced() ? 800 : 2800);
}

export function barScreen(): string {
  S.known = knownSet();
  if (!S.stage.length) firstStage();
  const res = resumeInfo();
  const auto = listSaves().find((x) => x.slot === 'auto');
  const m = loadMeta();
  const seenN = m.bar?.seen?.length || 0;
  const hasLog = !!awayPool().length || !!m.bar?.last;
  return `<main class="bar${S.cur?.layer === 'r' ? ' late' : ''}" aria-label="에란테스 바">
    <div class="bar-bg" style="background-image:url('${bgURL('erantes_bar')}')"></div><div class="bar-shade"></div>
    ${barShowcaseHtml()}
    <header class="bar-top"><h1 class="f-title">에란테스 바</h1><p class="bar-sit f-ui" aria-live="polite">${S.cur?.sit ? `— ${esc(S.cur.sit)}` : ''}</p></header>
    <div class="bar-floor" data-n="${S.stage.length}">${floorHtml()}</div>
    <nav class="bar-acts" aria-label="바 메뉴">
      ${res && auto ? `<button class="btn primary" data-a="load" data-v="auto"><b>이어서 출격</b><small class="f-num">${esc(fieldName(res.field))} · 페이즈 ${auto.phase}</small></button>` : '<button class="btn primary" data-a="newrun"><b>새 계약</b></button>'}
      <button class="btn" data-a="bar-x" data-v="log" ${hasLog ? '' : 'disabled title="의뢰를 한 번 마치면 열립니다"'}><b>통신 기록</b></button>
      <button class="btn ghost" data-a="codex"><b>도감</b>${seenN ? `<small class="f-num">만담 ${seenN}</small>` : ''}</button>
      <button class="btn ghost" data-a="to-title"><b>타이틀</b></button>
    </nav>
    <p class="bar-hint muted small">인물을 누르면 말을 겁니다. 빈 곳을 누르면 다음 대사로.</p>
  </main>`;
}

// ───────── 구경 모드 진행 (다시 그리지 않고 말풍선 · 무대만 바꾼다)
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function stop() { clearTimeout(S.timer); S.timer = 0; }
function schedule(ms: number) { clearTimeout(S.timer); S.timer = window.setTimeout(tick, ms); }
function hideBub(root: HTMLElement) {
  const bub = root.querySelector<HTMLElement>('.bar-bub');
  if (bub) { bub.hidden = true; bub.classList.remove('on'); }
  root.querySelectorAll('.bar-seat.talking').forEach((s) => s.classList.remove('talking'));
}
/** 지금 줄을 보여 주고 보여 줄 시간을 돌려준다: 서술은 위쪽 상황 줄, 무대에 선 사람은 그 머리 위 말풍선, 무대 밖(레이첼)은 아래쪽 말풍선 */
/** 한 줄을 보여 주는 시간: 서술은 짧게, 대사는 글자 수에 맞춰 (대기 서술은 대기 시간만큼) */
function lineMs(sc: Scene, [who, text]: Line) {
  if (!who) { const ms = Math.min(5000, Math.max(1800, 900 + [...text].length * 55)); return sc.kind === 'wait' ? Math.max(ms, sc.hold || 0) : ms; }
  return Math.min(6000, Math.max(2200, 1300 + [...text].length * 70));
}
function showLine() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root || !S.cur) return 0;
  hideBub(root);
  const [who, text, nm] = S.cur.lines[S.li];
  const sitEl = root.querySelector<HTMLElement>('.bar-sit');
  if (!who) {
    if (sitEl) sitEl.textContent = text;
    return lineMs(S.cur, S.cur.lines[S.li]);
  }
  if (sitEl && S.cur.sit) sitEl.textContent = `— ${S.cur.sit}`;
  const k = figOf(who);
  const i = k === 'rachel' ? -1 : S.stage.findIndex((s) => keyOf(s) === k);
  const seat = i >= 0 ? root.querySelector<HTMLElement>(`.bar-seat[data-seat="${k}"]:not(.out)`) : null;
  const bub = root.querySelector<HTMLElement>('.bar-bub');
  if (!bub) return 0;
  bub.innerHTML = `<b class="f-ui" style="--c:${colorOf(who)}">${esc(nm || nameOf(who))}</b><span>${esc(text)}</span>`;
  bub.classList.toggle('off-stage', !seat);
  bub.style.setProperty('--x', String(seat ? spotOf(i, S.stage.length) : 0.5));
  bub.hidden = false;
  seat?.classList.add('talking');
  if (!reduced()) { void bub.offsetWidth; bub.classList.add('on'); }
  return lineMs(S.cur, S.cur.lines[S.li]);
}
function tick() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root) { stop(); return; }
  if (advKey()) { schedule(700); return; } // 말 거는 중에는 멈춘다
  if (!S.cur || S.li >= S.cur.lines.length) { endScene(root); return; }
  const ms = showLine();
  S.li++;
  schedule(ms || 600);
}
function endScene(root: HTMLElement) {
  const cur = S.cur;
  hideBub(root);
  finishScene(cur, clock.now(), true);
  if (cur?.exit) { // 인사를 마친 사람이 걸어 나가며 흐려진다 → 빈자리 (에이든은 카운터 뒤로)
    leaveStage(cur.exit, clock.now());
    S.cur = null; S.li = 0;
    const sit = root.querySelector<HTMLElement>('.bar-sit');
    if (sit) sit.textContent = '';
    syncFloor(root);
    schedule(EXIT_MS);
    return;
  }
  schedule(startScene(decide(cur), root, cur));
}
/** 퇴장 뒤 다음 일까지 (걸어 나가며 흐려지는 동안) */
const EXIT_MS = 2400;
const testHook = globalThis as unknown as Record<string, unknown>;
/** 확인용 (주소에 ?bartest): 특정 틀을 정한 끼어들기로 바로 재생 · 입퇴장 시간 바꾸기 · 무대 상태 보기.
 *  window.__barFrame('g01', ['temur']) · window.__barTune({ leave: { crew: 1, other: 1, aiden: 0 }, stay: { crew: 0, other: 0, aiden: 0 }, vacant: [1500, 2500] }) · window.__barState() */
if (typeof location !== 'undefined' && location.search.includes('bartest')) {
  testHook.__barFrame = (id: string, ints: string[]) => {
    const f = FRAMES.find((x) => x.id === id);
    if (!f) return;
    const here = new Set(ints);
    const sc = buildFrame({ ...f, slots: f.slots.map((sl, i) => (ints[i] && sl[ints[i]] ? { [ints[i]]: sl[ints[i]] } : {})) }, here, here);
    const now = clock.now();
    S.stage = needOf([...f.cast, ...ints]).slice(0, STAGE_MAX).map((k) => (k === 'guest' ? { ...guestSeat(), since: now, n: 0 } : { id: k, since: now, n: 0 }));
    S.cur = sc; S.li = 0;
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    if (root) { syncFloor(root); root.classList.toggle('late', f.layer === 'r'); }
    stop(); tick();
  };
  testHook.__barTune = (t: Partial<typeof BAR_TUNE>) => Object.assign(BAR_TUNE, t);
  testHook.__barState = () => ({ stage: S.stage.map(keyOf), kind: S.cur?.kind, key: S.cur?.key || S.cur?.mono, li: S.li, enterIn: Math.round(S.enterAt - clock.now()) });
}
/** 화면을 그린 뒤 (render 끝): 말풍선 진행을 이어 간다 */
export function barMount() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root) return;
  if (!root.dataset.bound) {
    root.dataset.bound = '1';
    root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button, a')) barNext(); });
  }
  // 다시 그려졌으면 지금 줄부터 다시 보여 준다
  if (S.li > 0) S.li--;
  schedule(S.timer ? 300 : 900);
}
/** 다음 대사로 넘기기 */
function barNext() { if (!advKey()) { stop(); tick(); } }
/** 바에 들어올 때: 자리를 새로 채운다 */
export function barEnter() { stop(); S.stage = []; S.cur = null; S.li = 0; S.session.clear(); S.gone.clear(); S.enterAt = 0; S.aidenAt = 0; S.monoAt = -Infinity; S.monoUsed.clear(); resumeCache.t = 0; }

/** 검사용 (tests/bar_check.ts): 화면 없이 구경 모드를 n 단계 돌린 기록. known = 해금된 단원. 시간은 화면과 같은 규칙 (줄마다 lineMs · 첫 줄까지 · 퇴장) */
export function barSimulate(n: number, known: string[]) {
  type Rec = { t: number; kind: string; key: string; stage: string[]; add: string[]; drop: string[]; exit?: string; speakers: string[]; mono?: string };
  const log: Rec[] = [];
  const real = clock.now;
  let t = 0;
  clock.now = () => t;
  const rec = (kind: string, plan?: Plan, exit?: string) => log.push({
    t, kind, key: S.cur?.key || '', stage: S.stage.map(keyOf), add: plan?.add || [], drop: plan?.drop || [], exit, mono: exit ? undefined : S.cur?.mono,
    speakers: exit ? [] : [...new Set((S.cur?.lines || []).map(([w]) => figOf(w)).filter((w) => w && w !== 'rachel'))],
  });
  try {
    barEnter();
    S.known = new Set([...BASE, ...known]);
    if (S.known.has('joshua')) S.known.add('cesare');
    firstStage();
    rec('first');
    t += 1500;
    for (let i = 0; i < n; i++) {
      const cur = S.cur!;
      t += cur.lines.reduce((a, l) => a + lineMs(cur, l), 0);
      finishScene(cur, t, false);
      if (cur.exit) { leaveStage(cur.exit, t); rec('exit', undefined, cur.exit); t += EXIT_MS; }
      const prev = cur.exit ? null : cur;
      const p = decide(prev);
      const wait = startScene(p, null, prev);
      rec(p.scene.kind, p.plan);
      t += wait; // 첫 줄까지 (말 없는 대기는 대기 시간 전체)
    }
  } finally { clock.now = real; barEnter(); }
  return log;
}

// ───────── 말 걸기
const advOpts = { speaker, fmt };
/** 장면 첫 줄에 바 배경 · 그 인물 자리 */
const atBar = (id: string, beats: Beat[]): Beat[] => (beats.length ? [{ ...beats[0], bg: 'erantes_bar', stage: [{ id: figOf(id), at: 'R' as const }] }, ...beats.slice(1)] : beats);
/** 메뉴로 돌아올 때 한 줄 (빈 장면이면 배경이 없으므로) */
const backBeat = (id: string): Beat[] => atBar(id, [{ text: fillText('{name}이 잔을 다시 든다.', { name: nameOf(id) }) }]);
function talk(id: string) {
  const t = BAR_TALK[id];
  if (id === 'guest') { playAdv('bar:guest', toBeats('aiden', pick(BAR_GUEST), { pc: PC }).map((b, i) => (i ? b : { ...b, bg: 'erantes_bar' })), { ...advOpts, title: '에란테스 바', onDone: () => {} }); return; }
  metaBarBond(id);
  const r = reactFor(id);
  if (r) metaBar('heard', r.key);
  if (!t) { plainMenu(id, atBar(id, r ? toBeats(id, r.lines, r.vars) : [{ text: fillText('{name}이 잔을 들어 보인다. 옆자리가 비어 있다.', { name: nameOf(id) }) }]), true); return; }
  const open = toBeats(id, [t.at, ...(r ? r.lines : pick(t.hello))], r?.vars || { pc: PC, name: nameOf(id) });
  topicMenu(id, atBar(id, open), []);
}
const ASK_CHOICE = { label: '물어보기…', desc: '누구에게나 묻는 질문' };
function topicMenu(id: string, beats: Beat[], done: string[]) {
  const t = BAR_TALK[id];
  const heard = new Set(loadMeta().bar?.talk || []);
  const deep = DEEP_TOPICS[id];
  const open = deepOpen(id);
  const tops = [...t.topics, ...(deep && open ? [{ ...deep, label: `(심야) ${deep.label}` }] : [])].filter((x) => !done.includes(x.key));
  const locked = deep && !open ? [{ label: '(심야) …', desc: '더 가까워지면 들을 수 있는 이야기', why: `관계 ${bondOf(id)} / ${DEEP_BOND} (말 걸기 + 함께 출전한 런)` }] : [];
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
  const mine = BANTER.filter((b) => b.place === 2 && b.cast.every((id) => crew.has(figOf(id)) || id === 'max'));
  return mine.length ? mine : BANTER.filter((b) => b.place === 2 && b.cast.every((id) => k.has(id)));
}
const SHIP_TOPICS = new Set(['05_travel', '13_shiplife']);
// 통신 기록 배경: 전장 일러스트 (장소 표시는 전장 이름)
for (const f of FIELDS) BGS[`field_${f.id}`] ??= f.name;
/** 통신 기록: 확장 틀을 바에서 재생하고, 끼어드는 자리는 지난 의뢰에 나간 단원이 홀로그램으로 */
function playFrameLog(): boolean {
  const last = loadMeta().bar?.last;
  if (!last) return false;
  const crew = new Set(last.units);
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

/** 바 화면 버튼 (data-a="bar-x"). 다시 그려야 하면 true */
export function barAct(v: string): boolean {
  const [k, id] = v.split(':');
  if (k === 'talk' && id) { stop(); talk(id); return false; }
  if (k === 'log') { stop(); playLog(); return false; }
  if (k === 'next') { barNext(); return false; }
  return false;
}
/** 다른 화면이 열 때 바 장면이 떠 있으면 닫는다 */
export function barCloseAdv() { if (advKey()?.startsWith('bar:')) closeAdv(); }

// ───────── 도감 '기록' 탭: 바에서 본 만담 · 들은 이야기
export function barRecordsHtml(): string {
  const m = loadMeta();
  const seen = new Set(m.bar?.seen || []);
  const talk = new Set(m.bar?.talk || []);
  const byTopic = BANTER_TOPICS.map(([, title], t) => ({ title, all: BANTER.filter((b) => b.t === t), got: BANTER.filter((b) => b.t === t && seen.has(b.id)) }));
  const banterN = BANTER.filter((b) => seen.has(b.id)).length;
  const line = (who: string, text: string, nm?: string) => (who ? `<p><b style="--c:${colorOf(who)}">${esc(nm || nameOf(who))}</b> ${esc(fillText(text, { pc: PC }))}</p>` : `<p class="muted">${esc(text)}</p>`);
  const scriptLines = (owner: string, ls: string[]) => ls.map((l) => { const [w, t, nm] = parseLine(l, owner); return line(w, t, nm); }).join('');
  const topicsOf = (id: string) => [...BAR_TALK[id].topics, ...(DEEP_TOPICS[id] ? [{ ...DEEP_TOPICS[id], label: `(심야) ${DEEP_TOPICS[id].label}` }] : [])];
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
    return `<section class="bar-rec-b"><h3>${esc(FRAME_THEME[f.theme])} · ${esc(f.sit)} <span class="muted small f-num">${ints.size}/${total}</span>${f.layer === 'r' ? ' <span class="muted small">심야</span>' : ''}</h3>${core}${slots}</section>`;
  };
  // 알게 된 것: 물어보기로 들은 답 (인물별, 질문 · 깊이별)
  const askRows = Object.keys(ASK).map((id) => ({ id, got: ASK_Q.flatMap((q) => [0, 1, 2].filter((t) => talk.has(`ask:${id}.${q.key}.${t}`)).map((t) => ({ q, t }))) })).filter((r) => r.got.length);
  const askAll = Object.values(ASK).reduce((n, a) => n + ASK_Q.reduce((m, q) => { const v = a[q.key]; return m + (Array.isArray(v) ? (v[2] ? 3 : 2) : 1); }, 0), 0);
  const askGot = askRows.reduce((n, r) => n + r.got.length, 0);
  // 혼잣말: 구경하다 들은 정규 단원의 혼잣말 (인물별, 종류 표시)
  const monoRows = ERANTES_CREW.filter((id) => MONO[id]).map((id) => ({ id, got: MONO_KINDS.filter((k) => talk.has(`mono:${id}.${k}`)) })).filter((r) => r.got.length);
  const monoAll = ERANTES_CREW.reduce((n, id) => n + (MONO[id] ? MONO_KINDS.length : 0), 0);
  const monoGot = monoRows.reduce((n, r) => n + r.got.length, 0);
  const monoHtml = monoRows.map(({ id, got }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} <span class="muted small f-num">${got.length}/${MONO_KINDS.length}</span></h3>${got.map((k) => `<p><b style="--c:${colorOf(id)}">${esc(MONO_KIND_NAME[k])}</b> ${esc(fillText(MONO[id][k], { pc: PC }))}</p>`).join('')}</section>`).join('');
  const knowHtml = askRows.map(({ id, got }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} <span class="muted small f-num">${got.length}</span></h3>${got.map(({ q, t }) => `<div class="bar-rec-v"><span class="muted small">${esc(q.note)}${Array.isArray(ASK[id][q.key]) ? ` · ${TIER_NAME[t]}` : ''}</span>${scriptLines(id, askLines(askText(id, q.key, t)))}</div>`).join('')}</section>`).join('');
  return `<h2>에란테스 바</h2>
    <p class="muted small">본 만담 <b class="f-num">${banterN}</b> / ${BANTER.length}편 · 끼어들기 만담 <b class="f-num">${frameRows.length}</b> / ${FRAMES.length}편 (버전 <b class="f-num">${fseen.length}</b> / ${variants}) · 단원에게 들은 이야기 <b class="f-num">${talkRows.length}</b> / ${talkAll}편 · 알게 된 것 <b class="f-num">${askGot}</b> / ${askAll} · 들은 혼잣말 <b class="f-num">${monoGot}</b> / ${monoAll}.
      심야 이야기는 그 단원과 가까워지면(말 걸기 + 함께 출전한 런 ${DEEP_BOND}) 열립니다.</p>
    <div class="bar-rec">
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
