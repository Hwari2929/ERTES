// 에란테스 바 허브: 지상의 진짜 바. 런 사이에 들러 단원 · 손님의 잡담을 구경하고 말을 건다.
// - 구경: 바에 있는 인물(2~4명) 위로 말풍선이 하나씩 돌며 만담(docs/banter → banter.gen.ts)을 보여 준다.
// - 말 걸기: 인물을 누르면 미연시 화면(playAdv). 직전 런 기록에 맞는 반응 대사가 먼저, 그다음 화제 선택지.
// - 통신 기록: 바 밖(전장 · 함선) 만담은 '지난 의뢰 통신 기록'으로 재생한다.
// 보상은 없다. 본 만담 · 들은 이야기는 도감 '기록' 탭에 모인다 (meta.bar).
import { BANTER, BANTER_TOPICS, type Banter } from '../data/bar/banter.gen';
import { REACT_RULES, type ReactCtx } from '../data/bar/react';
import { FRAME_THEME, FRAMES, type Frame } from '../data/bar/frames';
import { ASK, ASK_MID, ASK_Q, askLines, type AskKey } from '../data/bar/ask';
import { BAR_GUEST, BAR_IDLE, BAR_TALK, DEEP_TOPICS, FIELD_SHORT, GENERIC_REACT } from '../data/bar/talk';
import { FIELDS, fieldOf } from '../data/battlefields';
import { EVENT_BY_ID } from '../data/events';
import { BGS, fillText, NPCS, type Beat } from '../data/scene';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, UNITS } from '../data/units';
import { advKey, closeAdv, playAdv } from './adv';
import { loadMeta, metaBar, metaBarBond } from './meta';
import { bgURL, standURL } from './portraits';
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
/** 바텐더를 빼고 바에 앉는 최대 인원 (손님 포함) */
const SEATS = 3;
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
interface Seat { id: string; guest?: boolean }
/** 지금 재생 중인 장면: 줄 = [화자 id ('' = 서술), 대사, 이름표?] */
type Line = [string, string, string?];
interface Scene { key: string; sit: string; lines: Line[]; layer?: 's' | 'i' | 'r' }
const S = {
  seats: [] as Seat[],
  cur: null as null | Scene,
  li: 0,
  timer: 0,
  known: new Set<string>(),
  session: new Set<string>(), // 이번 방문에 본 장면 키
  idleI: 0,
  entered: 0,
};
const BAR_SEL = 'main.bar';

function eligibleAmbient(): Banter[] {
  const k = S.known;
  return BANTER.filter((b) => b.place !== 2 && b.cast.every((id) => k.has(id)) && b.cast.filter((id) => id !== 'aiden').length <= SEATS);
}
/** 대본 줄 → 장면 줄 ('이름: 대사' · '* 서술', 이름이 없으면 owner) */
function parseLine(l: string, owner: string, suffix = ''): Line {
  if (l.startsWith('* ')) return ['', l.slice(2)];
  const m = l.match(/^([^:\s]{1,8}): (.*)$/);
  if (m && NAME_ID[m[1]]) return [NAME_ID[m[1]], fillText(m[2], { pc: PC })];
  return [owner, fillText(l, { pc: PC }), suffix ? nameOf(owner) + suffix : undefined];
}
/** 확장 틀 펼치기: 슬롯마다 후보 중 바에 앉아 있는 사람 → 없으면 해금된 후보를 불러 앉힌다 (70%) → 없으면 건너뜀.
 *  comm: 통신 기록 (끼어드는 사람은 현장에서 홀로그램으로) */
function buildFrame(f: Frame, pool: Set<string>, here: Set<string>, comm = false): Scene {
  const ints: string[] = [];
  const onStage = new Set(f.cast.filter((id) => id !== 'aiden'));
  for (const slot of f.slots) {
    const cands = Object.keys(slot).filter((id) => pool.has(id) && !f.cast.includes(id) && !ints.includes(id));
    const seated = cands.filter((id) => here.has(id));
    let c: string | null = seated.length ? pick(seated) : cands.length && Math.random() < 0.7 ? pick(cands) : null;
    if (c && !comm && c !== 'aiden' && !onStage.has(c) && onStage.size >= SEATS) c = seated.includes(c) ? c : null; // 자리가 꽉 찼으면 새로 부르지 않는다
    if (c) { ints.push(c); if (c !== 'aiden') onStage.add(c); } else ints.push('');
  }
  const lines: Line[] = [];
  for (const l of f.lines) {
    const sm = l.match(/^@(\d)$/);
    if (sm) { const c = ints[+sm[1]]; if (c) lines.push(...f.slots[+sm[1]][c].map((x) => parseLine(x, c, comm ? ' (통신)' : ''))); continue; }
    lines.push(parseLine(l, f.cast[0]));
  }
  return { key: `${f.id}+${ints.filter(Boolean).join('+') || '-'}`, sit: f.sit, lines, layer: f.layer };
}
const frameOf = (key: string) => FRAMES.find((f) => f.id === key.split('+')[0]);
/** 다음 장면: 층을 먼저 고르고 (실재 10% · 이상 25%), 그 안에서 안 본 것 · 확장 틀 · 지금 앉은 사람과 겹치는 것 우선 */
function nextScene(): Scene {
  const m = loadMeta();
  const seen = new Set(m.bar?.seen || []);
  const seenFrame = new Set([...seen].filter((k) => k.includes('+')).map((k) => k.split('+')[0]));
  const here = new Set(S.seats.map((s) => s.id));
  type Item = { layer: 's' | 'i' | 'r'; score: number; make: () => Scene };
  const items: Item[] = [];
  for (const b of eligibleAmbient()) {
    if (S.session.has(b.id)) continue;
    if (b.layer === 'r' && !b.cast.filter((id) => !BASE.includes(id)).every((id) => deepOpen(id))) continue; // 실재 층: 출연자 모두와 가까워야
    items.push({ layer: b.layer, score: (seen.has(b.id) ? 0 : 4) + b.cast.filter((id) => here.has(id)).length * 1.5, make: () => ({ key: b.id, sit: b.sit, layer: b.layer, lines: b.lines.map((l) => [l[0], fillText(l[1], { pc: PC }), l[2]] as Line) }) });
  }
  for (const f of FRAMES) {
    if (!f.cast.every((id) => S.known.has(id)) || !deepOpen(f.deep) || [...S.session].some((k) => k.startsWith(f.id + '+'))) continue;
    items.push({ layer: f.layer, score: (seenFrame.has(f.id) ? 2 : 6) + f.cast.filter((id) => here.has(id)).length * 1.5, make: () => buildFrame(f, S.known, here) });
  }
  const roll = Math.random();
  const by = (l: string) => items.filter((x) => x.layer === l);
  const layerPool = roll < DEEP_SHARE && by('r').length ? by('r') : roll < DEEP_SHARE + IDEAL_SHARE && by('i').length ? by('i') : by('s').length ? by('s') : items;
  const best = layerPool.map((x) => ({ x, sc: x.score + Math.random() * 2 })).sort((a, b) => b.sc - a.sc)[0]?.x;
  // 해금한 단원이 적으면 바텐더 · 손님 대화와 번갈아
  const idleTurn = items.length < 8 && (S.idleI + S.session.size) % 2 === 1;
  if (!best || idleTurn) {
    const it = BAR_IDLE[S.idleI++ % BAR_IDLE.length];
    return { key: '', sit: it.sit, lines: it.lines.map((l) => parseLine(l, 'aiden')) };
  }
  return best.make();
}
/** 무대 인원 갱신: 만담 출연자가 앉고, 넘치면 오래 앉아 있던 사람부터 일어난다. 빈자리는 손님 (실루엣) */
function seatFor(cast: string[]) {
  const need = [...new Set(cast.map(figOf))].filter((id) => id !== 'aiden' && id !== 'guest');
  let seats = S.seats.filter((s) => s.id !== 'aiden');
  const has = (id: string) => seats.some((s) => s.id === id);
  for (const id of need) if (!has(id)) seats.push({ id });
  while (seats.length > SEATS) {
    const i = seats.findIndex((s) => !need.includes(s.id));
    if (i < 0) break;
    seats.splice(i, 1);
  }
  // 손님 자리: 해금 안 된 인물의 실루엣 (말이 없는 만담 · 손님 만담에 쓰인다)
  if (cast.includes('guest') && !seats.some((s) => s.guest)) {
    const out = seats.findIndex((s) => !need.includes(s.id));
    if (seats.length >= SEATS && out >= 0) seats.splice(out, 1);
    if (seats.length < SEATS) seats.push(guestSeat());
  }
  if (seats.length < 2 && !seats.some((s) => s.guest)) seats.push(guestSeat());
  S.seats = [{ id: 'aiden' }, ...seats];
}
function guestSeat(): Seat {
  const pool = UNITS.filter((d) => !S.known.has(d.id) && standURL(d.id));
  return { id: pool.length ? pick(pool).id : 'guest', guest: true };
}

// ───────── 그리기
function seatHtml(s: Seat, i: number) {
  const f = figOf(s.id);
  const url = UNIT_BY_ID[f] ? standURL(f) : null;
  const nm = s.guest ? '낯선 손님' : nameOf(s.id);
  const pc = s.id === 'rachel';
  const tag = `<span class="bar-tag f-ui">${esc(nm)}</span>`;
  const art = url ? `<img alt="" src="${url}" loading="lazy" decoding="async" onerror="this.remove()">` : '<i class="bar-sil" aria-hidden="true"></i>';
  const inner = `${art}${tag}`;
  const body = pc
    ? `<div class="bar-fig is-pc">${inner}</div>`
    : `<button class="bar-fig${s.guest ? ' is-guest' : ''}" data-a="bar-x" data-v="talk:${s.guest ? 'guest' : s.id}" aria-label="${esc(nm)}에게 말 걸기">${inner}</button>`;
  return `<div class="bar-seat" data-seat="${s.guest ? 'guest' : s.id}" style="--i:${i}"><div class="bar-bub" hidden></div>${body}</div>`;
}
function floorHtml() { return S.seats.map(seatHtml).join(''); }

export function barScreen(): string {
  S.known = knownSet();
  if (!S.seats.length) { const b = nextScene(); S.cur = b; S.li = 0; seatFor(b.lines.map(([w]) => w).filter(Boolean)); }
  const res = resumeInfo();
  const auto = listSaves().find((x) => x.slot === 'auto');
  const m = loadMeta();
  const seenN = m.bar?.seen?.length || 0;
  const hasLog = !!awayPool().length || !!m.bar?.last;
  return `<main class="bar" aria-label="에란테스 바">
    <div class="bar-bg" style="background-image:url('${bgURL('erantes_bar')}')"></div><div class="bar-shade"></div>
    <header class="bar-top"><h1 class="f-title">에란테스 바</h1><p class="bar-sit f-ui" aria-live="polite">${S.cur?.sit ? `— ${esc(S.cur.sit)}` : ''}</p></header>
    <div class="bar-floor" data-n="${S.seats.length}">${floorHtml()}</div>
    <nav class="bar-acts" aria-label="바 메뉴">
      ${res && auto ? `<button class="btn primary" data-a="load" data-v="auto"><b>이어서 출격</b><small class="f-num">${esc(fieldName(res.field))} · 페이즈 ${auto.phase}</small></button>` : '<button class="btn primary" data-a="newrun"><b>새 계약</b></button>'}
      <button class="btn" data-a="bar-x" data-v="log" ${hasLog ? '' : 'disabled title="의뢰를 한 번 마치면 열립니다"'}><b>통신 기록</b></button>
      <button class="btn ghost" data-a="codex"><b>도감</b>${seenN ? `<small class="f-num">만담 ${seenN}</small>` : ''}</button>
      <button class="btn ghost" data-a="to-title"><b>타이틀</b></button>
    </nav>
    <p class="bar-hint muted small">인물을 누르면 말을 겁니다. 빈 곳을 누르면 다음 대사로.</p>
  </main>`;
}

// ───────── 구경 모드 진행 (다시 그리지 않고 말풍선만 바꾼다)
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function stop() { clearTimeout(S.timer); S.timer = 0; }
function schedule(ms: number) { clearTimeout(S.timer); S.timer = window.setTimeout(tick, ms); }
function showLine() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root || !S.cur) return 0;
  root.querySelectorAll<HTMLElement>('.bar-bub').forEach((b) => { b.hidden = true; b.classList.remove('on'); });
  root.querySelectorAll('.bar-seat').forEach((s) => s.classList.remove('talking'));
  const [who, text, nm] = S.cur.lines[S.li];
  if (!who) { // 서술: 위쪽 상황 줄에 잠깐
    const sit = root.querySelector<HTMLElement>('.bar-sit');
    if (sit) sit.textContent = text;
    return Math.min(5000, Math.max(1800, 900 + [...text].length * 55));
  }
  const sitEl = root.querySelector<HTMLElement>('.bar-sit');
  if (sitEl && S.cur.sit) sitEl.textContent = `— ${S.cur.sit}`;
  const seat = root.querySelector<HTMLElement>(`.bar-seat[data-seat="${figOf(who) === 'guest' || !S.seats.some((s) => s.id === figOf(who)) ? 'guest' : figOf(who)}"]`) || root.querySelector<HTMLElement>('.bar-seat[data-seat="aiden"]');
  const bub = seat?.querySelector<HTMLElement>('.bar-bub');
  if (!seat || !bub) return 0;
  const name = nm || (seat.dataset.seat === 'guest' && who !== 'guest' ? nameOf(who) : nameOf(who));
  bub.innerHTML = `<b class="f-ui" style="--c:${colorOf(who)}">${esc(name)}</b><span>${esc(text)}</span>`;
  bub.hidden = false;
  seat.classList.add('talking');
  if (!reduced()) { void bub.offsetWidth; bub.classList.add('on'); }
  return Math.min(6000, Math.max(2200, 1300 + [...text].length * 70));
}
function tick() {
  const root = document.querySelector<HTMLElement>(BAR_SEL);
  if (!root) { stop(); return; }
  if (advKey()) { schedule(700); return; } // 말 거는 중에는 멈춘다
  if (!S.cur || S.li >= S.cur.lines.length) {
    if (S.cur?.key) { metaBar('seen', S.cur.key); S.session.add(S.cur.key); }
    else if (S.cur) S.session.add(`idle${S.idleI}`);
    root.querySelectorAll<HTMLElement>('.bar-bub').forEach((b) => { b.hidden = true; });
    root.querySelectorAll('.bar-seat').forEach((s) => s.classList.remove('talking'));
    const b = nextScene();
    S.cur = b; S.li = 0;
    const before = S.seats.map((s) => s.id).join();
    seatFor(b.lines.map(([w]) => w).filter(Boolean));
    const sit = root.querySelector<HTMLElement>('.bar-sit');
    if (sit) sit.textContent = b.sit ? `— ${b.sit}` : '';
    root.classList.toggle('late', b.layer === 'r'); // 실재 층: 심야 조명
    if (S.seats.map((s) => s.id).join() !== before) {
      const prev = new Set(before.split(','));
      const fl = root.querySelector<HTMLElement>('.bar-floor')!;
      fl.innerHTML = floorHtml();
      fl.dataset.n = String(S.seats.length);
      fl.querySelectorAll<HTMLElement>('.bar-seat').forEach((el) => { if (!prev.has(el.dataset.seat!) && !reduced()) el.classList.add('enter'); });
    }
    schedule(1400);
    return;
  }
  const ms = showLine();
  S.li++;
  schedule(ms || 600);
}
/** 확인용 (주소에 ?bartest): 특정 틀을 정한 끼어들기로 바로 재생. window.__barFrame('g01', ['temur']) */
if (typeof location !== 'undefined' && location.search.includes('bartest')) {
  (globalThis as unknown as { __barFrame: (id: string, ints: string[]) => void }).__barFrame = (id, ints) => {
    const f = FRAMES.find((x) => x.id === id);
    if (!f) return;
    const here = new Set(ints);
    S.cur = buildFrame({ ...f, slots: f.slots.map((sl, i) => (ints[i] && sl[ints[i]] ? { [ints[i]]: sl[ints[i]] } : {})) }, here, here);
    S.cur.key = `${f.id}+${ints.filter(Boolean).join('+') || '-'}`;
    S.li = 0;
    seatFor(S.cur.lines.map(([w]) => w).filter(Boolean));
    const root = document.querySelector<HTMLElement>(BAR_SEL);
    const fl = root?.querySelector<HTMLElement>('.bar-floor');
    if (fl) fl.innerHTML = floorHtml();
    root?.classList.toggle('late', f.layer === 'r');
    stop(); tick();
  };
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
export function barEnter() { stop(); S.seats = []; S.cur = null; S.li = 0; S.session.clear(); resumeCache.t = 0; }

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
  const knowHtml = askRows.map(({ id, got }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} <span class="muted small f-num">${got.length}</span></h3>${got.map(({ q, t }) => `<div class="bar-rec-v"><span class="muted small">${esc(q.note)}${Array.isArray(ASK[id][q.key]) ? ` · ${TIER_NAME[t]}` : ''}</span>${scriptLines(id, askLines(askText(id, q.key, t)))}</div>`).join('')}</section>`).join('');
  return `<h2>에란테스 바</h2>
    <p class="muted small">본 만담 <b class="f-num">${banterN}</b> / ${BANTER.length}편 · 끼어들기 만담 <b class="f-num">${frameRows.length}</b> / ${FRAMES.length}편 (버전 <b class="f-num">${fseen.length}</b> / ${variants}) · 단원에게 들은 이야기 <b class="f-num">${talkRows.length}</b> / ${talkAll}편 · 알게 된 것 <b class="f-num">${askGot}</b> / ${askAll}.
      심야 이야기는 그 단원과 가까워지면(말 걸기 + 함께 출전한 런 ${DEEP_BOND}) 열립니다.</p>
    <div class="bar-rec">
      ${askRows.length ? `<details><summary><b>알게 된 것</b> <span class="muted small f-num">${askGot}/${askAll}</span></summary>${knowHtml}</details>` : ''}
      ${talkRows.length ? `<details><summary><b>단원 이야기</b> <span class="muted small f-num">${talkRows.length}/${talkAll}</span></summary>
        ${talkRows.map(({ id, x }) => `<section class="bar-rec-b"><h3>${esc(nameOf(id))} · ${esc(x.label)}</h3>${scriptLines(id, x.lines)}</section>`).join('')}</details>` : ''}
      ${frameRows.length ? `<details><summary><b>끼어들기 만담</b> <span class="muted small f-num">${frameRows.length}/${FRAMES.length}</span></summary>${frameRows.map((r) => frameHtml(r.f, r.keys)).join('')}</details>` : ''}
      ${byTopic.filter((g) => g.got.length).map((g) => `<details><summary><b>${esc(g.title)}</b> <span class="muted small f-num">${g.got.length}/${g.all.length}</span></summary>
        ${g.got.map((b) => `<section class="bar-rec-b"><h3>${b.cast.map((id) => esc(nameOf(id))).join(' × ')} <span class="muted small">— ${esc(b.sit)}</span></h3>${b.lines.map(([w, t, nm]) => line(w, t, nm)).join('')}</section>`).join('')}</details>`).join('')}
      ${!seen.size && !talkRows.length && !askRows.length ? '<p class="muted small">아직 바에 들르지 않았습니다. 타이틀이나 메뉴에서 「에란테스 바」로 갈 수 있습니다.</p>' : ''}
    </div>`;
}
