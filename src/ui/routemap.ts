// 지도 화면 항로도 (전술 스코프): 리빈 낙원동 = 구체 내벽 회전, 베르타–산노디스 물류망 = 대각 진행 원 궤도,
// 라이덴 제34블록 = 고저 단면 (기둥 위 보행 데크 · 아래 거리의 다층 상가 · 여우 신사), 카운티폴 세피아 교외 = 등각 교외 길 안내 (핀 · 헤드업 내비),
// 금고선 히페리온호 = 순찰 스코프 (궤도에서 내려다본 선체 · 대각 진행축 · 탐지선이 쓸 때만 드러나는 경비 접촉),
// 크레타 백원 = 탐지 야경 (촛불 점 들판 · 탐지선이 지난 자리의 촛불이 꺼지고 망령 진형이 불투명도만으로 나타남).
// 시안: claude.ai 아티팩트 '전장별 항로 시안' (리빈 = 스코프, 물류망 = 스코프 · 대각, 라이덴 = ① 다층 상가, 카운티폴 = A′-2 핀) ·
//       '히페리온 · 크레타 항로 시안' (히페리온 = H3 순찰 스코프, 크레타 = C9b 꺼진 촛불에서 일어남).
// 렌더마다 화면이 통째로 다시 그려지므로, 항로도 DOM 은 이 모듈이 들고 있다가 자리(.rmap-host)에 다시 끼운다.
// 그래서 진행(노드 완료 뒤 지도로 돌아옴)마다 끝낸 노드가 옅어지고 다음 노드가 밝아지는 전환을 이어서 보여 줄 수 있다.
// 조작: 가로로 끌기 · 가로 휠 = 항로만 이동 (페이지는 그대로), 세로로 끄는 터치 = 페이지 스크롤. 전체 화면 = 넓은 시야 + 노드 목록 · 범례 패널.
import { NODE_NAME, type NodeType, type RunState } from '../types';
import { lineIcon } from './synicons';

const FIELDS = { livin: 'ring', swarm: 'orbit', raiden: 'stairs', county: 'grid', hyperion: 'patrol', crete: 'vigil' } as const;
type Kind = (typeof FIELDS)[keyof typeof FIELDS];
const CODE: Partial<Record<NodeType, string>> = { supply: 'SUP', battle: 'BTL', council: 'CNL', event: 'EVT', shop: 'BRN', adversity: 'ADV', boss: 'BOS', recruit: 'RCT', fork: 'FRK', news: 'NWS', invest: 'INV', pilgrim: 'PLG', challenge: 'CHL' };
// 프리버드(공룡) 실루엣 — 오른쪽을 보고 발이 y=0
const DINO = {
  sauro: 'M-14 -3Q-9 -5-5 -8Q0 -10 5 -8L9 -15Q10 -17 13 -16L13 -15L10 -14L7 -6Q6 -3 4 -3V0H2V-3H-3V0H-5V-3Q-9 -2-14 -3Z',
  thero: 'M-11 -8Q-5 -9-1 -10Q2 -12 5 -12L9 -11V-9L5 -9L3 -7L2 -4L3 0H1L0 -4L-2 -5L-3 0H-5L-4 -5Q-7 -7-11 -8Z',
  ptero: 'M-11 0Q-5 -6 0 -1Q5 -6 11 0Q5 -2 1 2L5 3L0 3Q-5 -2-11 0Z',
};

/** 이 런의 지도에 항로도를 쓰는가: 항로도가 있는 전장 · 튜토리얼 아님 · 한 줄 항로 (모든 칸이 선택지 1개). 분기 항로는 분기형 항로도가 있는 전장만 (물류망 · 카운티폴) — 나머지는 공용 분기 지도 */
const BRANCH_KINDS: Kind[] = ['orbit', 'grid'];
export function routeMapOn(run: RunState): boolean {
  if (!(run.field in FIELDS) || run.tutorial || run.lab) return false;
  return run.links ? BRANCH_KINDS.includes(FIELDS[run.field as keyof typeof FIELDS]) : run.map.every((o) => o.length === 1);
}

// ── 색: 테마 토큰을 읽어 #rrggbb 로 (섞기 · 보간용)
type Pal = { bg: string; panel: string; panel2: string; line: string; soft: string; text: string; t2: string; t3: string; sel: string; streak: string; bad: string; divine: string; info: string };
function hexOf(v: string): string {
  const p = document.createElement('i');
  p.style.color = v; p.style.display = 'none';
  document.body.appendChild(p);
  const c = getComputedStyle(p).color; p.remove();
  const n = (c.match(/[\d.]+/g) || ['0', '0', '0']).map(Number);
  const k = c.startsWith('color(') ? 255 : 1; // color(srgb r g b) 는 0~1
  return '#' + n.slice(0, 3).map((x) => Math.round(Math.max(0, Math.min(255, x * k))).toString(16).padStart(2, '0')).join('');
}
const rgb = (c: string) => [1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16));
const mix = (a: string, b: string, k: number) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, j) => Math.round(v + (B[j] - v) * k).toString(16).padStart(2, '0')).join(''); };
function palette(): Pal {
  const cs = getComputedStyle(document.documentElement), t = (n: string) => hexOf(cs.getPropertyValue(n).trim() || 'currentColor');
  const bg = t('--bg'), line = t('--line'), t2 = t('--c-text-2');
  return { bg, panel: t('--panel'), panel2: t('--panel-2'), line, soft: mix(line, bg, .4), text: t('--c-text'), t2, t3: mix(t2, bg, .38), sel: t('--c-select'), streak: t('--c-streak'), bad: t('--c-bad'), divine: t('--c-divine'), info: t('--c-info') };
}

// ── SVG 도우미
const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number | null | undefined>;
function el(tag: string, a: Attrs = {}, parent?: Element): SVGElement {
  const e = document.createElementNS(NS, tag) as SVGElement;
  for (const k in a) if (a[k] != null) e.setAttribute(k, String(a[k]));
  if (parent) parent.appendChild(e);
  return e;
}
const pad2 = (n: number) => String(n).padStart(2, '0');
const pts = (a: number[][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const mod = (a: number, n: number) => ((a % n) + n) % n;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function rng(seed: number) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Scene { key: string; el: HTMLElement; sync(step: number): void; sleep(): void; wake(): void; destroy(): void;
  /** 전체 화면 전환 연출: rect = 지도 창 자리 (화면 좌표), vb = 그 자리의 시야. opening = 지도 자리 → 전체 화면 */
  morph(rect: DOMRect, vb: number[], opening: boolean, done: () => void): void;
  /** 지도 창 크기일 때의 시야 · 이동 연출이 끝나는 시각 */
  baseVB(): number[]; busyUntil(): number }
let S: Scene | null = null;
/** 노드 설명 (HTML): 전체 화면 옆 패널에 쓴다 — 문구는 main 의 기존 팝오버와 같은 것 */
type Hint = (t: NodeType, i: number) => string;
/** 분기 항로: 지금 고른 노드 종류 (main 의 app.nodePick) · 고르기 (지도 노드를 누르면) */
type Pick = { get(): NodeType | undefined; set(t: NodeType): void; go?(t: NodeType): void; /** 지금 전체 화면을 저절로 열어도 되는가 (지도 위에 다른 창이 없다) */ auto?(): boolean };
/** 갈림길에 오면 항로도 전체 화면을 저절로 연다 (칸마다 한 번 — 닫으면 그 칸에서는 다시 열지 않는다). 칸을 넘어오는 이동 연출이 끝난 뒤에 */
let autoKey = '', autoT = 0;
const choiceCount = (run: RunState) => (run.step === 0 ? run.map[0]?.length ?? 0 : run.links?.[run.step - 1]?.[run.path?.[run.step - 1] ?? 0]?.length ?? 0);
let last: { host: HTMLElement; run: RunState; onNode: (el: HTMLElement) => void; hint: Hint; pick?: Pick } | null = null;
// 전체 화면: 항로도를 body 위 덮개로 옮기고, 더 넓은 시야 + 옆 패널 (노드 목록 · 범례). 열고 닫을 때 지도 창이 화면을 채우며 커지고 · 제자리로 줄어든다 (morph)
let fs = false, fsResize = 0, morphing = false;
function setFs(on: boolean, remount = true) {
  if (fs === on) return;
  fs = on;
  if (!on) { morphing = false; if (last) last.host.style.minHeight = ''; }
  document.documentElement.classList.toggle('rmap-fs-on', on);
  S?.destroy(); S = null;
  if (remount && last) mountRouteMap(last.host, last.run, last.onNode, last.hint, last.pick);
}
/** 전체 화면 열기: 지도 창 자리에서 화면 가득으로 커진다 (지도 자리는 비워 두지 않고 높이를 지킨다 — 닫을 때 돌아올 자리) */
function openFs(anim: boolean) {
  if (fs || morphing || !last || !S) return;
  const from = S.el.getBoundingClientRect(), base = S.baseVB();
  if (from.height > 0) last.host.style.minHeight = `${from.height}px`;
  setFs(true);
  if (anim && S && from.width > 0) { morphing = true; S.morph(from, base, true, () => { morphing = false; }); }
}
/** 전체 화면 닫기: 지도 창 자리로 줄어든 뒤 원래 크기 항로도로 (then = 닫은 뒤 할 일) */
function closeFs(anim: boolean, then?: () => void) {
  if (!fs) { then?.(); return; }
  if (morphing) return;
  const host = last?.host, base = S?.baseVB();
  if (!anim || !S || !host?.isConnected || !base) { setFs(false); then?.(); return; }
  const hr = host.getBoundingClientRect();
  morphing = true;
  S.morph(new DOMRect(hr.left, hr.top, hr.width, (hr.width * base[3]) / base[2]), base, false, () => { setFs(false); then?.(); });
}
addEventListener('keydown', (e) => { if (fs && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFs(true); } }, true);
addEventListener('resize', () => { if (!fs) return; clearTimeout(fsResize); fsResize = window.setTimeout(() => { if (fs && last) { S?.destroy(); S = null; mountRouteMap(last.host, last.run, last.onNode, last.hint, last.pick); } }, 200); });

/** render() 뒤에 부른다: host 가 없으면(지도 화면이 아님) 움직임만 멈춘다 */
export function mountRouteMap(host: HTMLElement | null, run: RunState | null, onNode: (el: HTMLElement) => void, hint: Hint = () => '', pick?: Pick) {
  if (!host || !run || !routeMapOn(run)) { clearTimeout(autoT); if (fs) { if (last) last.host.style.minHeight = ''; setFs(false, false); } S?.sleep(); return; }
  last = { host, run, onNode, hint, pick };
  const narrow = matchMedia('(max-width: 600px)').matches;
  const types = run.links ? branchTypes(run, pick?.get()) : run.map.map((o, i) => run.picked[i] || o[0]);
  const key = [run.seed, run.phase, run.field, document.documentElement.dataset.uiTheme, narrow, run.links ? run.map.map((r) => r.join('/')).join() : types.join(), fs].join('|'); // 분기 항로: 지도가 같으면 진행 · 고르기는 sync 로
  const parent = fs ? document.body : host;
  if (!S || S.key !== key) { S?.destroy(); S = build(parent, run, key, types, narrow, onNode, hint); }
  else if (S.el.parentElement !== parent) parent.appendChild(S.el);
  S.wake();
  S.sync(run.step);
  clearTimeout(autoT);
  const ak = `${run.seed}|${run.phase}|${run.step}`;
  if (run.links && !fs && !run.node && ak !== autoKey && choiceCount(run) > 1 && (pick?.auto?.() ?? true)) { // 칸을 넘어오는 이동 연출이 끝나면 바로 이어서
    autoT = window.setTimeout(() => { if (last?.run === run && !fs && !run.node && `${run.seed}|${run.phase}|${run.step}` === ak && (last.pick?.auto?.() ?? true)) { autoKey = ak; openFs(true); } }, Math.max(250, S.busyUntil() - performance.now() + 120));
  }
}

/** 분기 항로의 칸별 대표 노드 (전체 화면 목록 · 칸 수): 지난 칸 = 지나간 노드, 지금 칸 = 고른 노드, 앞 칸 = 고른 노드에서 이어지는 첫 노드 */
function branchTypes(run: RunState, pick?: NodeType): NodeType[] {
  const L = run.links!, out: NodeType[] = [];
  let j = 0;
  run.map.forEach((row, i) => {
    if (i < run.step) j = run.path?.[i] ?? 0;
    else if (i === run.step) { const opts = i === 0 ? row.map((_, k) => k) : L[i - 1]?.[run.path?.[i - 1] ?? 0] || [0]; j = run.node ? run.path?.[i] ?? opts[0] : opts.find((k) => row[k] === pick) ?? opts[0]; }
    else j = L[i - 1]?.[j]?.[0] ?? 0;
    out.push(row[j] ?? row[0]);
  });
  return out;
}
function build(host: HTMLElement, run: RunState, key: string, types: NodeType[], narrow: boolean, onNode: (el: HTMLElement) => void, hint: Hint): Scene {
  const C = palette();
  const N = types.length, kind: Kind = FIELDS[run.field as keyof typeof FIELDS] as Kind;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = document.createElement('div');
  box.className = `rmap rmap-${kind}${fs ? ' fs' : ''}`;
  box.innerHTML = `<div class="rm-view"><svg class="rm-stage" role="img" aria-label="항로도 — 좌우로 끌어서 둘러보기, 노드를 누르면 설명"></svg><button class="btn tiny rm-recenter" type="button" hidden>현재 노드로</button><button class="btn tiny rm-fs" type="button" aria-pressed="${fs}">${lineIcon(fs ? 'u.shrink' : 'u.expand', 'li')}${fs ? '닫기' : '전체 화면'}</button><div class="rm-guide" role="status" hidden><small></small><h2>경로를 선택하세요</h2></div><div class="rm-cards" hidden></div></div>${fs ? '<aside class="rm-panel" aria-label="항로 상세"></aside>' : ''}`;
  host.appendChild(box); // 길이 계산(getTotalLength)은 문서에 붙은 뒤에
  const stage = box.querySelector('svg')!, recenterBtn = box.querySelector<HTMLButtonElement>('.rm-recenter')!, panelEl = box.querySelector<HTMLElement>('.rm-panel'), guideEl = box.querySelector<HTMLElement>('.rm-guide')!, cardsEl = box.querySelector<HTMLElement>('.rm-cards')!, viewEl = box.querySelector<HTMLElement>('.rm-view')!;
  /** 전체 화면이 다 펼쳐진 뒤에만 보이는 것 (갈림길 안내 · 노드 카드): 펼쳐지는 동안에는 숨기고, 다 펼쳐지면 등장한다 */
  let fxOn = false, morphBusy = false, fxHook: (() => void) | null = null;
  const reveal = (on: boolean) => { fxOn = on; fxHook?.(); };
  const replay = (e: HTMLElement) => { e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); };
  box.querySelector('.rm-fs')!.addEventListener('click', () => (fs ? closeFs(true) : openFs(true)));
  // 전체 화면 시야: 무대 칸의 비율에 맞춰 원래 시야보다 넓고 높게 (가운데는 그대로)
  const sr = stage.getBoundingClientRect(), aspect = sr.height > 0 ? sr.width / sr.height : 0;
  let baseVB = [0, 0, 800, 450], busyUntil = 0;
  const fit = (v: number[]) => {
    baseVB = v;
    if (!fs || !aspect) return v;
    const w = Math.min(Math.max(v[3] * 1.3 * aspect, v[2] * 1.2), v[2] * 2.2), h = Math.min(Math.max(w / aspect, v[3] * 1.15), v[3] * 2);
    return [v[0] + v[2] / 2 - w / 2, v[1] + v[3] / 2 - h / 2, w, h];
  };
  let cur = Math.min(run.step, N - 1), raf = 0, praf = 0, amb = 0, idleT = 0, homing = false, awake = false, sel = cur;
  const colOf = (t: NodeType) => (t === 'council' || t === 'pilgrim' ? C.divine : t === 'adversity' || t === 'fork' ? C.streak : t === 'boss' || t === 'challenge' ? C.bad : C.text);
  const txt = (parent: Element, x: number, y: number, s: string, a: Attrs = {}) => { const t = el('text', { x, y, 'font-size': 9, fill: C.t3, ...a }, parent); t.textContent = s; return t; };
  const tween = (ms: number, step: (k: number) => void, done?: () => void) => {
    cancelAnimationFrame(raf);
    if (reduce) { step(1); done?.(); return; }
    const t0 = performance.now();
    busyUntil = t0 + ms;
    const f = (now: number) => { const t = Math.min(1, (now - t0) / ms); step(ease(t)); if (t < 1) raf = requestAnimationFrame(f); else done?.(); };
    raf = requestAnimationFrame(f);
  };

  // ── 노드 토큰: 현재 = 굵은 강조색 · 살짝 큼 · 조준 괄호가 벌어지며 45° / 앞 = 얇은 유형 색 / 지난 = 흐린 회색 (배경 불투명)
  type St = { kind: 'cur' | 'next' | 'past'; r: number; sw: number; isw: number; sc: number; ny: number; op: number; bs: number; ba: number; bo: number; col: string; ncol: string; bcol: string };
  type Tok = { g: SVGElement; sg: SVGElement; ring: SVGElement; ic: SVGElement; num: SVGElement; call: SVGElement; brk: SVGElement; t: NodeType; st: St | null };
  const STATE = {
    cur: { r: 23, sw: 3, isw: 2.3, sc: 1.08, ny: -32, op: 1, bs: 1.22, ba: 45, bo: 1 },
    next: { r: 19, sw: 1.25, isw: 1.5, sc: 1, ny: -28, op: 1, bs: 1, ba: 0, bo: 1 },
    past: { r: 19, sw: 1, isw: 1.3, sc: .92, ny: -28, op: .45, bs: .9, ba: 0, bo: .45 },
  };
  function token(parent: Element, i: number, t = types[i]): Tok {
    const g = el('g', { class: 'rm-node', 'data-step': i, 'data-node': t, tabindex: 0, role: 'button', 'aria-label': `${i + 1}번째 칸 ${NODE_NAME[t]}` }, parent), sg = el('g', {}, g);
    const ring = el('circle', { r: 19, fill: C.bg }, sg);
    const ic = el('g', { transform: 'translate(-11.5 -11.5) scale(.96)' }, sg);
    ic.innerHTML = lineIcon(`n.${t}`);
    const isv = ic.firstElementChild; if (isv) { isv.setAttribute('width', '24'); isv.setAttribute('height', '24'); }
    const num = txt(g, 0, -29, pad2(i + 1), { 'text-anchor': 'middle', 'font-size': 10 });
    const call = el('g', {}, g);
    txt(call, 40, -26, `N${pad2(i + 1)}·${CODE[t] || t.slice(0, 3).toUpperCase()}`, { 'font-size': 8, fill: C.t2 });
    txt(call, 40, -15, NODE_NAME[t], { 'font-size': 8.5, class: 'rm-ko' });
    const brk = el('path', { d: 'M-30 -22v-8h8M30 -22v-8h-8M-30 22v8h8M30 22v8h-8', fill: 'none', 'stroke-width': 1.1, 'vector-effect': 'non-scaling-stroke' }, g);
    return { g, sg, ring, ic, num, call, brk, t, st: null };
  }
  function target(k: Tok, i: number): St {
    const kd = i === cur ? 'cur' : i < cur ? 'past' : 'next';
    return { kind: kd, ...STATE[kd], col: kd === 'cur' ? C.sel : kd === 'past' ? C.t3 : colOf(k.t), ncol: kd === 'cur' ? C.sel : C.t3, bcol: kd === 'cur' ? C.sel : C.t3 };
  }
  function lerp(a: St, b: St, k: number): St {
    const o = { ...b, col: mix(a.col, b.col, k), ncol: mix(a.ncol, b.ncol, k), bcol: mix(a.bcol, b.bcol, k) };
    for (const f of ['r', 'sw', 'isw', 'sc', 'ny', 'op', 'bs', 'ba', 'bo'] as const) o[f] = a[f] + (b[f] - a[f]) * k;
    return o;
  }
  function apply(k: Tok, v: St) {
    k.ring.setAttribute('r', String(v.r)); k.ring.setAttribute('stroke', v.col); k.ring.setAttribute('stroke-width', String(v.sw));
    k.ic.style.color = v.col; k.ic.firstElementChild?.setAttribute('stroke-width', String(v.isw));
    k.sg.setAttribute('transform', `scale(${v.sc})`);
    k.num.setAttribute('y', String(v.ny)); k.num.setAttribute('fill', v.ncol); k.num.style.opacity = String(v.op);
    k.call.style.opacity = String(v.op);
    k.brk.setAttribute('transform', `rotate(${v.ba.toFixed(2)}) scale(${v.bs.toFixed(3)})`); k.brk.setAttribute('stroke', v.bcol); k.brk.style.opacity = String(v.bo);
  }
  // anim: 끝낸 노드가 먼저 옅어지고(0~55%), 이어서 새 현재 노드가 밝아지며 커진다(35~100%)
  function paint(tokens: Tok[], anim: boolean) {
    cancelAnimationFrame(praf);
    const jobs = tokens.map((k, i) => { const to = target(k, i); return { k, from: k.st || to, to, w: to.kind === 'past' ? [0, .55] : to.kind === 'cur' ? [.35, 1] : [0, 1] }; });
    const set = (T: number) => jobs.forEach((j) => { const u = Math.min(1, Math.max(0, (T - j.w[0]) / (j.w[1] - j.w[0]))); const v = u >= 1 ? j.to : lerp(j.from, j.to, ease(u)); apply(j.k, v); j.k.st = v; });
    if (!anim || reduce) { set(1); return; }
    const t0 = performance.now();
    const f = (now: number) => { const T = Math.min(1, (now - t0) / 1100); set(T); if (T < 1) praf = requestAnimationFrame(f); };
    praf = requestAnimationFrame(f);
  }

  // ── 끌기 · 관성. 손을 떼고 잠시 두면 현재 노드로 (전체 화면에서는 둘러보는 중이라 돌아가지 않는다). 거의 안 움직인 누름은 노드 설명
  // 스크롤 잠금: 가로로 끄는 동안은 페이지가 위아래로 움직이지 않는다. 세로로 시작한 터치는 페이지 스크롤로 넘기고, 가로 휠 · Shift+휠은 항로만 민다
  let goNow = () => {};
  const armReturn = () => { clearTimeout(idleT); if (fs) return; idleT = window.setTimeout(() => { if (!recenterBtn.hidden) goNow(); }, 2200); };
  let moved = 0, downNode: SVGElement | null = null, downTouch = false;
  /** 지금 고를 수 있는 노드를 누름 (분기 항로가 바꿔 끼운다): click = 마우스 · tap = 터치 · key = Enter */
  let onPick = (t: NodeType, _how: 'click' | 'tap' | 'key') => { last?.pick?.set(t); }; // 누른 노드 (포인터 캡처 뒤 click 대상은 무대 자체라 누를 때 기억)
  function dragger(onDelta: (dx: number) => void) {
    let id = -1, lx = 0, ly = 0, v = 0, lt = 0, inert = 0, axis: '' | 'x' | 'y' = '', touch = false, wheelT = 0;
    const scale = () => stage.viewBox.baseVal.width / stage.getBoundingClientRect().width;
    const halt = () => { clearTimeout(idleT); homing = false; cancelAnimationFrame(raf); cancelAnimationFrame(inert); };
    const down = (e: PointerEvent) => { if (e.button !== 0) return; downNode = (e.target as Element).closest<SVGElement>('.rm-node'); downTouch = e.pointerType !== 'mouse'; halt(); id = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now(); v = 0; moved = 0; axis = ''; touch = e.pointerType !== 'mouse'; try { stage.setPointerCapture(id); } catch { /* 합성 이벤트 */ } };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const ddx = e.clientX - lx, ddy = e.clientY - ly;
      moved += Math.abs(ddx) + Math.abs(ddy);
      if (!axis && moved >= 6) { axis = Math.abs(ddx) >= Math.abs(ddy) ? 'x' : 'y'; if (axis === 'x') box.classList.add('drag'); }
      if (!axis) return;
      lx = e.clientX; ly = e.clientY;
      if (axis === 'y') { if (touch && !fs) window.scrollBy(0, -ddy); return; }
      const now = performance.now(), dx = ddx * scale(); v = dx / Math.max(1, now - lt); lt = now; onDelta(dx);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return; id = -1; box.classList.remove('drag');
      if (reduce || axis !== 'x') { armReturn(); return; }
      let last = performance.now();
      const glide = (now: number) => { const dt = now - last; last = now; v *= Math.pow(.992, dt); if (Math.abs(v) < .02) { armReturn(); return; } onDelta(v * dt); inert = requestAnimationFrame(glide); };
      inert = requestAnimationFrame(glide);
    };
    const wheel = (e: WheelEvent) => {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      if (!fs && Math.abs(dx) <= Math.abs(e.deltaY) && !e.shiftKey) return; // 세로 휠은 페이지 몫
      e.preventDefault(); halt();
      onDelta(-(fs && Math.abs(dx) < Math.abs(e.deltaY) ? e.deltaY : dx) * (e.deltaMode === 1 ? 16 : 1) * scale());
      clearTimeout(wheelT); wheelT = window.setTimeout(armReturn, 120);
    };
    stage.addEventListener('pointerdown', down); stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(inert); clearTimeout(wheelT); };
  }
  stage.addEventListener('click', (e) => {
    const n = (e.target as Element).closest<SVGElement>('.rm-node') || downNode;
    if (n && moved < 6) { if (n.dataset.pick && last?.pick) onPick(n.dataset.pick as NodeType, downTouch ? 'tap' : 'click'); else if (fs) pick(+(n.dataset.step ?? cur)); else onNode(n as unknown as HTMLElement); } // 분기 항로: 지금 고를 수 있는 노드는 누르면 고른다
    downNode = null;
  });
  stage.addEventListener('keydown', (e) => { const n = (e.target as Element).closest<SVGElement>('.rm-node'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (n.dataset.pick && last?.pick) onPick(n.dataset.pick as NodeType, 'key'); else if (fs) pick(+(n.dataset.step ?? cur)); else onNode(n as unknown as HTMLElement); } });
  recenterBtn.addEventListener('click', () => goNow());

  // ── 공통 장식
  function corners(p: Element, [x, y, w, h]: number[]) {
    const m = 7, L = 18;
    for (const [cx, cy, sx, sy] of [[x + m, y + m, 1, 1], [x + w - m, y + m, -1, 1], [x + m, y + h - m, 1, -1], [x + w - m, y + h - m, -1, -1]]) el('path', { d: `M${cx} ${cy + sy * L}V${cy}H${cx + sx * L}`, fill: 'none', stroke: C.t2, 'stroke-width': 1.3 }, p);
  }
  function sweepRig(p: Element, radii: number[], unit: (r: number) => string) {
    const g = el('g', {}, p), R = radii[radii.length - 1];
    radii.forEach((r, k) => { el('circle', { r, fill: 'none', stroke: C.line, 'stroke-dasharray': k === radii.length - 1 ? null : '2 4' }, g); txt(g, 4, -r - 3, unit(r), { 'font-size': 7 }); });
    for (let a = 0; a < 360; a += 5) {
      const big = a % 30 === 0, rad = a * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
      el('line', { x1: c * R, y1: s * R, x2: c * (R - (big ? 9 : 4)), y2: s * (R - (big ? 9 : 4)), stroke: big ? C.t3 : C.line }, g);
      if (big) txt(g, c * (R + 12), s * (R + 12) + 3, String(mod(a + 90, 360)).padStart(3, '0'), { 'text-anchor': 'middle', 'font-size': 7 });
    }
    el('path', { d: 'M-6 0h12M0 -6v12', stroke: C.t2 }, g);
    const arm = el('g', {}, g);
    for (let k = 5; k >= 0; k--) el('line', { x1: 0, y1: 0, x2: R, y2: 0, stroke: C.t2, 'stroke-opacity': k ? .3 - k * .05 : .8, 'stroke-width': k ? 1 : 1.3, transform: `rotate(${-k * 2.5})` }, arm);
    return { g, set(a: number) { arm.setAttribute('transform', `rotate(${a})`); } };
  }
  function titleBlock(p: Element, [x, y, w, h]: number[], head: string, cells: string[]) {
    if (narrow) return;
    const bw = 262, bh = 58, g = el('g', { transform: `translate(${x + w - bw - 10} ${y + h - bh - 10})` }, p);
    el('rect', { width: bw, height: bh, fill: C.bg, stroke: C.line }, g);
    el('line', { x1: 0, y1: 18, x2: bw, y2: 18, stroke: C.line }, g); el('line', { x1: 134, y1: 18, x2: 134, y2: bh, stroke: C.line }, g);
    txt(g, 6, 12, head, { 'font-size': 8.5, fill: C.t2 });
    txt(g, 6, 33, cells[0], { 'font-size': 8.5 }); txt(g, 6, 48, cells[1], { 'font-size': 8.5 });
    txt(g, 140, 33, cells[2], { 'font-size': 8.5 }); txt(g, 140, 48, cells[3], { 'font-size': 8.5 });
  }
  function contact(g: Element, lab: string, y = -16, col = C.t2) {
    el('path', { d: `M-10 ${y + 4}v-4h4M10 ${y + 4}v-4h-4`, fill: 'none', stroke: col, 'stroke-width': .8 }, g);
    txt(g, 12, y + 2, lab, { 'font-size': 7, fill: col });
  }
  const tokensFor = (parent: Element) => types.map((_, i) => token(parent, i));
  const stopAmb = () => { cancelAnimationFrame(amb); amb = 0; };
  let tick: (t: number) => void = () => {};
  const t0 = performance.now();
  const startAmb = () => { if (amb) return; const f = (now: number) => { tick(reduce ? 0 : now - t0); amb = requestAnimationFrame(f); }; amb = requestAnimationFrame(f); };

  const sc: { go(): void; stop(): void; look?(i: number): void; update?(): void; panel?(): string; name?: string; legend?: string[][] } = kind === 'ring' ? ringScene() : kind === 'orbit' ? orbitScene() : kind === 'stairs' ? stairsScene() : kind === 'patrol' ? patrolScene() : kind === 'vigil' ? vigilScene() : gridScene();
  goNow = () => { sel = cur; sc.go(); panel(); };
  if (fs) queueMicrotask(() => { if (!morphBusy) reveal(true); }); // 펼치는 연출 없이 연 전체 화면 (창 크기 변경 등)
  // ── 전체 화면 옆 패널: 노드 목록 (상태 · 고른 노드의 설명) + 범례. 노드를 고르면 지도도 그 노드로
  function pick(i: number) { sel = Math.max(0, Math.min(N - 1, i)); if (sel === cur) sc.go(); else sc.look?.(sel); panel(); }
  function panel() {
    if (!panelEl) return;
    if (sc?.panel) { panelEl.innerHTML = sc.panel(); return; } // 분기 항로: 고를 수 있는 길 목록
    const left = N - 1 - cur, rows = types.map((t, i) => {
      const far = i - cur, st = far < 0 ? '지남' : far === 0 ? '현재' : far === 1 ? '다음' : `${far}칸 뒤`, h = i === sel ? hint(t, i) : '';
      return `<li class="${far < 0 ? 'past' : far === 0 ? 'cur' : 'next'}${i === sel ? ' on' : ''}"><button type="button" data-i="${i}" aria-pressed="${i === sel}"><span class="mono rp-n">${pad2(i + 1)}</span>${lineIcon(`n.${t}`, 'li')}<b>${NODE_NAME[t]}</b><small>${st}</small></button>${h ? `<p>${h}</p>` : ''}</li>`;
    }).join('');
    panelEl.innerHTML = `<header><b>${sc.name || ''}</b><span class="chip" style="--c:var(--c-bad)">보스까지 <b class="mono">${left}</b>칸</span></header>
      <div class="rp-nav"><button class="btn tiny" type="button" data-go="-1"${sel ? '' : ' disabled'}>◀ 이전</button><button class="btn tiny" type="button" data-go="0">현재 노드</button><button class="btn tiny" type="button" data-go="1"${sel < N - 1 ? '' : ' disabled'}>다음 ▶</button></div>
      <ol class="rp-list">${rows}</ol>
      ${sc.legend ? `<h4>범례</h4><dl class="rp-legend">${sc.legend.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
      <p class="rp-keys"><kbd>Esc</kbd> 닫기 · 끌기 · 휠로 둘러보기</p>`;
    panelEl.querySelector<HTMLElement>('li.on')?.scrollIntoView({ block: 'nearest' });
  }
  panelEl?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b) return;
    if (b.dataset.pick) onPick(b.dataset.pick as NodeType, 'tap'); // 길 고르기 (고른 길을 다시 누르면 진행)
    else if (b.dataset.enter) onPick(b.dataset.enter as NodeType, 'click');
    else if (b.dataset.i) pick(+b.dataset.i);
    else if (b.dataset.go) pick(b.dataset.go === '0' ? cur : sel + +b.dataset.go);
  });
  panel();
  return {
    key, el: box,
    sync(step: number) { const c = Math.min(step, N - 1); if (sc.update) { cur = c; sc.update(); panel(); return; } if (c === cur) return; cur = c; goNow(); }, // 분기 항로: 고른 노드가 바뀌어도 다시 칠한다
    sleep() { stopAmb(); clearTimeout(idleT); },
    wake() { if (!awake || !amb) { awake = true; startAmb(); } },
    destroy() { stopAmb(); cancelAnimationFrame(raf); cancelAnimationFrame(praf); clearTimeout(idleT); sc.stop(); box.remove(); },
    baseVB: () => baseVB, busyUntil: () => busyUntil,
    morph(r0: DOMRect, vb0: number[], opening: boolean, done: () => void) {
      // 지도 창 자리(r0)에 그 시야(vb0)가 그대로 보이게 하는 전체 화면 시야(V0)에서 출발해, 잘라 보이는 창(clip-path)과 시야를 함께 넓힌다
      const sr = stage.getBoundingClientRect(), bv = stage.viewBox.baseVal, V1 = [bv.x, bv.y, bv.width, bv.height], s = vb0[2] / Math.max(1, r0.width);
      const V0 = [vb0[0] - (r0.left - sr.left) * s, vb0[1] - (r0.top - sr.top) * s, sr.width * s, sr.height * s];
      const I0 = [r0.top, innerWidth - r0.right, innerHeight - r0.bottom, r0.left];
      const set = (k: number) => {
        stage.setAttribute('viewBox', V0.map((v, i) => (v + (V1[i] - v) * k).toFixed(2)).join(' '));
        box.style.clipPath = `inset(${I0.map((v) => `${(v * (1 - k)).toFixed(1)}px`).join(' ')} round ${(12 * (1 - k)).toFixed(1)}px)`;
        if (panelEl) panelEl.style.opacity = Math.max(0, (k - 0.35) / 0.65).toFixed(3);
      };
      const finish = () => { stage.setAttribute('viewBox', V1.join(' ')); box.style.clipPath = ''; if (panelEl) panelEl.style.opacity = ''; morphBusy = false; if (opening) reveal(true); done(); };
      morphBusy = true;
      if (!opening) reveal(false);
      if (reduce) { finish(); return; }
      set(opening ? 0 : 1);
      const t0 = performance.now(), ms = opening ? 560 : 440;
      const f = (now: number) => { const t = Math.min(1, (now - t0) / ms), e = ease(t); set(opening ? e : 1 - e); if (t < 1) requestAnimationFrame(f); else finish(); };
      requestAnimationFrame(f);
    },
  };

  // ── 리빈 낙원동: 속 빈 구체의 내벽 단면. 인공 태양(중심)은 화면 위 바깥
  function ringScene() {
    const W = 800, H = 450, R = 600, CX = 400, CY = 372 - R, STEP = 17; // 노드 간격 17° ≈ 165px
    const VB = fit(narrow ? [180, 120, 440, 320] : [0, 92, W, 350]), T0 = VB[1];
    stage.setAttribute('viewBox', VB.join(' ')); stage.style.aspectRatio = fs ? '' : `${VB[2]} / ${VB[3]}`;
    el('rect', { x: -1200, y: -800, width: W + 2400, height: H + 1600, fill: C.bg }, stage);
    const back = el('g', {}, stage), rotG = el('g', {}, stage), nodesG = el('g', {}, stage), top = el('g', {}, stage);
    const rnd = rng(7 + run.phase);
    const span0 = -50, span1 = (N - 1) * STEP + 70;
    const P = (deg: number, r: number) => [CX - r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)]; // 좌우 반전: 앞으로 올 노드가 오른쪽
    // 벽에 붙은 것은 회전 0 기준으로 놓고 rotG 전체를 돌린다 (지역 좌표: x = 벽을 따라, -y = 중심 쪽)
    const place = (g: Element, a: number, r = R) => { const [x, y] = P(90 + a, r); g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(-a).toFixed(2)})`); };
    const rig = sweepRig(back, [90, 180, 270, 360], (r) => `${r * 10}m`); // 현재 노드 자리: 가운데가 아니라 화면 왼쪽에서 30% (앞으로 갈 길이 더 보이게). A0 = 그 자리의 벽 각도
    const A0 = Math.asin((VB[0] + VB[2] * .3 - CX) / (R - 46)) * 180 / Math.PI;
    { const [gx, gy] = [CX + R * Math.sin(A0 * Math.PI / 180), CY + R * Math.cos(A0 * Math.PI / 180)]; rig.g.setAttribute('transform', `translate(${gx.toFixed(1)} ${gy.toFixed(1)})`); }
    el('line', { x1: CX, y1: T0, x2: CX, y2: T0 + 24, stroke: C.t3, 'stroke-width': 1 }, back);
    txt(back, CX + 6, T0 + 36, '↑ ZENITH 000 · 인공 태양', { fill: C.t2, 'font-size': 9.5 });

    // 구름 (대기층을 따라 천천히)
    const cloudG = el('g', {}, rotG), clouds: { g: SVGElement; a0: number; v: number; h: number }[] = [];
    for (let j = 0; j < 8; j++) {
      const g = el('g', {}, cloudG), w = 26 + rnd() * 32;
      el('path', { d: `M${-w / 2 + 4} 0h${w - 8}a4 4 0 0 0 0-8h-${w * .22}a6 6 0 0 0-${w * .4} 0h-${w * .38 - 8}a4 4 0 0 0 0 8Z`, fill: C.panel }, g);
      clouds.push({ g, a0: span0 + rnd() * (span1 - span0), v: (.00025 + rnd() * .0003) * (j % 2 ? 1 : -1), h: 185 + rnd() * 75 });
    }
    // 지물 (띠 아래층: 바닥을 뚫고 나온 부분은 내벽 띠가 덮는다)
    const featG = el('g', {}, rotG);
    el('circle', { cx: CX, cy: CY, r: R + 31, fill: 'none', stroke: C.panel2, 'stroke-width': 62 }, rotG);
    el('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: C.t2, 'stroke-width': 1.5 }, rotG);
    el('circle', { cx: CX, cy: CY, r: R + 62, fill: 'none', stroke: C.line, 'stroke-width': 1 }, rotG);
    if (fs) { // 전체 화면의 높은 시야: 띠 바깥 = 구체 외피 (장갑층 · 배관층 단면)
      el('circle', { cx: CX, cy: CY, r: R + 63 + 160, fill: 'none', stroke: C.panel, 'stroke-width': 320 }, rotG);
      for (const [dr, w, dash] of [[30, 1, null], [34, 1, null], [78, 6, '2 10'], [120, 1, '6 4'], [170, 1, null]] as const) el('circle', { cx: CX, cy: CY, r: R + 62 + dr, fill: 'none', stroke: C.line, 'stroke-width': w, 'stroke-dasharray': dash }, rotG);
      for (let k = 0, a = span0; a <= span1; k++, a += 12) { // 늑재 · 구획 번호
        const [x0, y0] = P(90 + a, R + 92), [x1, y1] = P(90 + a, R + 232); el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: C.line, 'stroke-width': .8 }, rotG);
        if (k % 2) place(txt(rotG, 0, 0, `HULL-${pad2(k)}`, { 'font-size': 7, 'text-anchor': 'middle' }), a + 6, R + 104);
      }
      place(txt(rotG, 0, 0, '外殼 단면 · 장갑층 → 배관층 → 진공', { 'font-size': 8, fill: C.t2, 'text-anchor': 'middle', class: 'rm-ko' }), cur * STEP + 6, R + 150);
    }
    for (let a = span0; a <= span1; a += 4) {
      const big = Math.round(a) % 20 === 0, len = big ? 14 : 7, [x0, y0] = P(90 + a, R), [x1, y1] = P(90 + a, R + len);
      el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: big ? C.t2 : C.line, 'stroke-width': big ? 1.2 : 1 }, rotG);
      if (big) { const t = txt(rotG, 0, 0, `B${String(mod(a, 360)).padStart(3, '0')}`, { 'font-size': 8, 'text-anchor': 'middle' }); place(t, a, R + 30); }
    }
    const lakeG = el('g', {}, rotG);
    const at = (a: number, r = R, layer = featG) => { const g = el('g', {}, layer); place(g, a, r); return g; };
    const solid = { fill: C.panel2 }, far = { fill: C.line };
    const flab = (g: Element, x: number, y: number, s: string) => txt(g, x, y - 4, s, { 'text-anchor': 'middle', 'font-size': 7 });
    const ridge = (w: number, h: number, n: number) => { // 산 모양 포락선 위 봉우리 n개
      const Q = [[-w / 2, 3]], peak = Math.floor(n / 2) + (rnd() < .5 ? 0 : 1) - (n % 2 ? 0 : 1);
      for (let k = 1; k <= 2 * n - 1; k++) {
        const x = -w / 2 + w * k / (2 * n) + (rnd() - .5) * w / n * .25, env = 1 - Math.pow(Math.abs(x) / (w / 2), 1.4);
        Q.push([x, k % 2 ? -h * env * (k === 2 * peak + 1 ? 1 : .7 + .2 * rnd()) : -h * env * (.45 + .2 * rnd())]);
      }
      Q.push([w / 2, 3]); return Q;
    };
    const mountain = (g: Element, w: number, h: number, k: number) => { // 색은 거리로만: 뒤 능선 · 앞 능선
      el('polygon', { points: pts(ridge(w * 1.25, h * .74, 3).map(([x, y]) => [x + w * .22, y])), ...far }, g);
      const front = ridge(w, h, 3), pk = front.reduce((a, b) => (b[1] < a[1] ? b : a));
      el('polygon', { points: pts(front), ...solid }, g);
      flab(g, pk[0], pk[1] - 4, `TRN-${pad2(k)}`);
    };
    const forest = (g: Element, x0: number, n: number) => {
      for (let j = 0; j < n; j++) {
        const x = x0 + j * 7 + rnd() * 3, h = 9 + rnd() * 9;
        el('line', { x1: x, y1: 1, x2: x, y2: -h * .4, stroke: C.line, 'stroke-width': 1 }, g);
        if (rnd() < .55) el('path', { d: `M${x - 3.5} ${-h * .35}L${x} ${-h}L${x + 3.5} ${-h * .35}Z`, ...far }, g);
        else el('circle', { cx: x, cy: -h * .62, r: h * .3, ...far }, g);
      }
    };
    const farm = (g: Element, x0: number, w: number) => { for (let x = x0; x < x0 + w; x += 5) el('line', { x1: x, y1: 0, x2: x + 3, y2: -2.5, stroke: C.line, 'stroke-width': .7 }, g); };
    const village = (g: Element, n: number, k: number) => { // 공동체: 집 · 급수탑
      const x0 = -n * 6.5; let x = x0;
      for (let j = 0; j < n; j++) {
        const w = 7 + rnd() * 3, h = 5 + rnd() * 6;
        el('path', { d: `M${x} 1V${-h}L${x + w / 2} ${-h - 4}L${x + w} ${-h}V1Z`, ...solid }, g);
        if (rnd() < .6) el('rect', { x: x + w / 2 - 1, y: -h / 2 - 1, width: 2, height: 2, fill: C.t2 }, g);
        x += w + 2 + rnd() * 3;
      }
      const tx = x + 3;
      el('path', { d: `M${tx} 1V-16M${tx + 6} 1V-16M${tx} -8H${tx + 6}`, stroke: C.line, 'stroke-width': 1, fill: 'none' }, g);
      el('rect', { x: tx - 2, y: -24, width: 10, height: 8, rx: 1, ...solid }, g);
      flab(g, (x0 + tx) / 2, -26, `STR-${pad2(k)}`);
    };
    const post = (g: Element, k: number) => { // 방역 초소: 안테나 탑 · 깃발 · 초소 · 방역 울타리
      el('path', { d: 'M0 1V-34M-6 -28H6M-4 -22H4', stroke: C.line, 'stroke-width': 1, fill: 'none' }, g);
      el('path', { d: 'M0 -34l7 3-7 3Z', fill: C.line }, g);
      el('rect', { x: 6, y: -8, width: 14, height: 9, ...solid }, g);
      el('path', { d: 'M-26 1v-6M-20 1v-6M-14 1v-6M-8 1v-6M-27 -3.5H-7', stroke: C.t3, 'stroke-width': .7, fill: 'none' }, g);
      flab(g, 0, -36, `QRT-${pad2(k)}`);
    };
    const lake = (g: Element, w: number) => {
      el('ellipse', { cx: 0, cy: 6, rx: w / 2, ry: 4.5, fill: C.panel }, g);
      for (const dx of [-w / 5, w / 8]) el('path', { d: `M${dx - 5} 6q2.5 -2 5 0t5 0`, fill: 'none', stroke: C.t3, 'stroke-width': .6 }, g);
      flab(g, w / 2 - 6, 2, 'H2O');
    };
    const GAP = ['mountain', 'village', 'forest', 'post', 'mountain', 'village', 'lake', 'mountain', 'village', 'forest', 'post', 'mountain', 'village', 'lake', 'mountain', 'village'];
    let kV = 0, kM = 0, kQ = 0;
    for (let i = -3; i <= N + 1; i++) {
      const a = (i + .5) * STEP + (rnd() - .5) * 3, type = GAP[(i + 3) % GAP.length];
      if (type === 'mountain') { const g = at(a); mountain(g, 66 + rnd() * 22, 48 + rnd() * 18, ++kM); forest(g, 26, 3); }
      else if (type === 'village') { const g = at(a); village(g, 3 + Math.floor(rnd() * 3), ++kV); farm(g, 30, 20); }
      else if (type === 'forest') forest(at(a), -34, 9);
      else if (type === 'post') { const g = at(a); post(g, ++kQ); forest(g, 26, 3); }
      else { lake(at(a, R, lakeG), 52); forest(at(a), -40, 3); }
    }
    for (let i = 0; i < N; i++) if (rnd() < .6) farm(at(i * STEP + (rnd() - .5) * 4), -18, 36);

    // 진행 항로: 지난 구간 강조색으로 차오름 · 다음 구간 흐르는 점선 · 남은 구간 가운데 진행 방향 화살표
    const pathG = el('g', {}, rotG), RN = R - 46;
    const segs: { base: SVGElement; fillP: SVGGeometryElement; len: number; ch: SVGElement }[] = [];
    for (let i = 0; i < N - 1; i++) {
      let d = ''; for (let k = 0; k <= 12; k++) { const [x, y] = P(90 + (i + k / 12) * STEP, RN); d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
      const base = el('path', { d, fill: 'none', stroke: C.t3, 'stroke-width': 1.2, 'stroke-dasharray': '2 5' }, pathG);
      const fillP = el('path', { d, fill: 'none', stroke: C.sel, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, pathG) as SVGGeometryElement;
      const len = fillP.getTotalLength(); fillP.setAttribute('stroke-dasharray', `${len} ${len}`);
      const chev = el('g', {}, pathG); place(chev, (i + .5) * STEP, RN);
      const ch = el('path', { d: 'M-4 -5 2 0-4 5M2 -5 8 0 2 5', fill: 'none', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, chev);
      segs.push({ base, fillP, len, ch });
    }
    let pos = cur;
    const drawSegs = () => segs.forEach((g, i) => {
      const f = Math.min(1, Math.max(0, pos - i));
      g.fillP.setAttribute('stroke-dashoffset', (g.len * (1 - f)).toFixed(1));
      g.ch.setAttribute('stroke', i === Math.floor(pos) ? C.text : C.t3);
      g.ch.style.opacity = Math.max(0, 1 - f * 2).toFixed(2); // 지나온 구간의 화살표는 사라진다
      g.base.setAttribute('stroke', i === Math.floor(pos) && f < 1 ? C.t2 : C.t3);
    });

    // 프리버드: 걷는 무리(어른 + 새끼) · 나는 것
    const lifeG = el('g', {}, rotG);
    const walkers: { g: SVGElement; body: SVGElement; cg: SVGElement; cy: number; sc: number; a0: number; amp: number; w: number; ph: number; step: number }[] = [];
    const flyers: { g: SVGElement; body: SVGElement; cg: SVGElement; a0: number; v: number; h: number; ph: number }[] = [];
    const WALK: [number, 'sauro' | 'thero', number][] = [[-1.55, 'sauro', 1], [-1.36, 'sauro', .58], [1.45, 'thero', .9], [3.42, 'thero', .85], [3.6, 'thero', .7], [5.55, 'sauro', 1], [7.45, 'thero', .9], [9.45, 'sauro', 1], [9.62, 'sauro', .55], [11.5, 'thero', .9], [12.65, 'sauro', 1]];
    WALK.filter(([u]) => u < N).forEach(([u, k, s], j) => {
      const g = el('g', {}, lifeG), body = el('g', {}, g);
      el('path', { d: DINO[k], fill: C.t2 }, body);
      const cg = el('g', {}, g), cy = -20 * s - 4; contact(cg, `FB-${pad2(j + 1)}`, 0); // 접촉 표지는 벽 각도와 상관없이 똑바로 (tick 에서 역회전)
      const prev = walkers[walkers.length - 1], baby = s < .65 && prev; // 새끼는 앞 개체를 바짝 따라간다
      walkers.push({ g, body, cg, cy, sc: s, a0: u * STEP, amp: baby ? prev.amp : 2 + rnd() * 2.5, w: baby ? prev.w : (k === 'sauro' ? .00008 : .00015) * (.8 + rnd() * .4), ph: baby ? prev.ph - .22 : rnd() * 6.28, step: k === 'sauro' ? .0035 : .0065 });
    });
    for (let j = 0; j < 6; j++) {
      const g = el('g', {}, lifeG), body = el('g', {}, g);
      el('path', { d: DINO.ptero, fill: C.t2 }, body);
      const cg = el('g', {}, g); contact(cg, `FB-${pad2(20 + j)}`, 0);
      flyers.push({ g, body, cg, a0: span0 + rnd() * (span1 - span0), v: (rnd() < .5 ? -1 : 1) * (.0005 + rnd() * .0005), h: 100 + rnd() * 60, ph: rnd() * 6.28 });
    }
    tick = (t) => {
      for (const c of clouds) place(c.g, span0 + mod(c.a0 - span0 + t * c.v, span1 - span0), R - c.h);
      for (const d of walkers) {
        const ph = t * d.w + d.ph, a = d.a0 + d.amp * Math.sin(ph), dir = Math.cos(ph) >= 0 ? 1 : -1;
        place(d.g, a, R - Math.abs(Math.sin(t * d.step)) * .9);
        d.cg.setAttribute('transform', `translate(0 ${d.cy.toFixed(1)}) rotate(${(a + rot).toFixed(2)})`);
        d.body.setAttribute('transform', `scale(${dir * d.sc} ${d.sc})`);
      }
      for (const f of flyers) {
        const fa = span0 + mod(f.a0 - span0 + t * f.v, span1 - span0);
        place(f.g, fa, R - f.h - 10 * Math.sin(t * .0006 + f.ph));
        f.cg.setAttribute('transform', `translate(0 -14) rotate(${(fa + rot).toFixed(2)})`);
        f.body.setAttribute('transform', `scale(${Math.sign(f.v)} ${.35 + .65 * Math.abs(Math.sin(t * .005 + f.ph))})`);
      }
      rig.set(mod(t * .045, 360));
      const ph = Math.sin(t * .0035);
      crewIn.setAttribute('transform', `translate(0 ${(ph * 2.5).toFixed(2)})`); crewIn.setAttribute('opacity', (.72 + .28 * ph).toFixed(2));
      const nx = segs[Math.floor(pos)]; if (nx) nx.base.setAttribute('stroke-dashoffset', (-t * .012).toFixed(1));
    };

    const tokens = tokensFor(nodesG);
    // 위치 표시자: 현재 노드의 45° 조준 괄호 아래 꼭짓점(중심에서 30·√2·1.22 ≈ 52) 바로 밑에서 위를 가리키고, 살짝 오르내리며 숨쉰다
    const crew = el('g', {}, nodesG), crewIn = el('g', {}, crew);
    el('path', { d: 'M0 -5 6 5H-6Z', fill: C.sel }, crewIn);
    corners(top, VB);
    titleBlock(top, VB, 'RV-1 PRESERVATION SPHERE · 內壁 단면 · SECTOR RIVIN', [`리빈-1 낙원동 · 페이즈 ${run.phase}`, `${N} NODES`, '거리환 900m 간격', 'REV.05 · 스코프']);

    let rot = A0 - cur * STEP; // 노드 i 의 각 = 90 + i·STEP + rot (현재 노드는 A0)
    const draw = () => {
      rotG.setAttribute('transform', `rotate(${(-rot).toFixed(3)} ${CX} ${CY})`);
      tokens.forEach((k, i) => { const [x, y] = P(90 + i * STEP + rot, RN); k.g.setAttribute('transform', `translate(${x} ${y})`); });
      const [cx, cy] = P(90 + cur * STEP + rot, RN); crew.setAttribute('transform', `translate(${cx.toFixed(1)} ${(cy + 62).toFixed(1)})`);
      recenterBtn.hidden = homing || Math.abs(rot - (A0 - cur * STEP)) < 1.5;
    };
    draw(); drawSegs(); paint(tokens, false);
    const lo = A0 - (N - 1) * STEP - 18, hi = A0 + 18;
    const off = dragger((dx) => { rot = Math.max(lo, Math.min(hi, rot + (dx / R) * 180 / Math.PI)); draw(); });
    return {
      name: '리빈-1 낙원동 · 내벽 단면',
      legend: [['항로', '내벽을 따라 도는 점선 · 지난 구간은 강조색'], ['TRN', '산지'], ['STR', '공동체 (집 · 급수탑)'], ['QRT', '방역 초소'], ['H2O', '호수'], ['FB', '프리버드 접촉 (걷는 무리 · 익룡)'], ['B000', '내벽 방위 (20° 마다)'], ['ZENITH', '인공 태양 방향 (화면 위 바깥)']],
      look(i: number) { const from = rot, to = A0 - i * STEP; tween(700, (k) => { rot = from + (to - from) * k; draw(); }); },
      go() {
        const from = rot, to = A0 - cur * STEP, p0 = pos; paint(tokens, true); homing = true;
        segs.forEach((g) => g.base.setAttribute('stroke-dashoffset', '0'));
        tween(900, (k) => { rot = from + (to - from) * k; pos = p0 + (cur - p0) * k; draw(); drawSegs(); }, () => { homing = false; pos = cur; draw(); drawSegs(); });
      },
      stop: off,
    };
  }

  // ── 베르타–산노디스 물류망: 크고 작은 원 궤도를 반 바퀴씩 감는 항로, 진행축 24° (u = 축 방향, v = 축 수직)
  function orbitScene() {
    const W = 800, H = 450, CY = 228, PAR = .35, TH = 24 * Math.PI / 180;
    const ax = [Math.cos(TH), Math.sin(TH)], nv = [-Math.sin(TH), Math.cos(TH)], THd = TH * 180 / Math.PI;
    const O = [120, 120];
    const L2W = (u: number, v: number) => [O[0] + u * ax[0] + v * nv[0], O[1] + u * ax[1] + v * nv[1]];
    const proj = (x: number, y: number) => (x - O[0]) * ax[0] + (y - O[1]) * ax[1];
    const VB = fit(narrow ? [180, 10, 440, 440] : [0, 0, W, H]);
    stage.setAttribute('viewBox', VB.join(' ')); stage.style.aspectRatio = fs ? '' : `${VB[2]} / ${VB[3]}`;
    el('rect', { x: -1200, y: -800, width: W + 2400, height: H + 1600, fill: C.bg }, stage);
    const defs = el('defs', {}, stage);
    const para = el('g', {}, stage), world = el('g', {}, stage), fixed = el('g', {}, stage);
    const rnd = rng(23 + run.phase);
    // 수도 베르타-4 (네 겹 링월드) · 환적 정거장 · 광석 소행성 · 산-노디스 (펄서) · 침식 구역 중계 위성
    const BOD = [
      { kind: 'planet', name: '베르타-4', code: 'B-4', sub: '연합 수도 · 네 겹 링월드', R: 28, r: 140, rings: 4 },
      { kind: 'port', name: '환적 정거장', code: 'TS-7', sub: '수도 물류망 거점', R: 13, r: 105 },
      { kind: 'rock', name: '광석 소행성', code: 'A-117', sub: '하역장', R: 12, r: 150 },
      { kind: 'planet', name: '산-노디스', code: 'SN', sub: '제31시 · 8년 주기 펄서', R: 21, r: 92, pulsar: true },
      { kind: 'planet', name: '중계 위성', code: 'RL-2', sub: '군체 침식 구역', R: 17, r: 158, moon: true },
    ].map((b, k) => ({ ...b, half: k % 2 ? 'hi' : 'lo', u: 0, v: 0, cx: 0, cy: 0 }));
    // 분기 항로: 기준 항로는 천체 사이를 완만하게 누비고 (진폭 AW), 천체는 갈래 다발 (LANE 간격) 이 지나갈 자리 밖으로 비켜 놓는다 ('lo' = 항로가 +v 쪽)
    const AW = 18, LANE = 128, extOf = (b: (typeof BOD)[number]) => (b.rings ? b.R + 6 + (b.rings - 1) * 4.5 : b.kind === 'port' ? 47 : b.moon ? 44 : b.R + 8);
    let U = 0;
    const RS = run.links ? 1.45 : 1; // 분기 항로: 갈래 사이가 넓어 칸 사이도 넓힌다 (옆 갈래 곡선이 반원처럼 휘지 않게)
    for (const b of BOD) { b.u = U + b.r * RS; U += 2 * b.r * RS; if (run.links) b.v = (b.half === 'lo' ? -1 : 1) * (LANE + 36 + extOf(b) - AW); [b.cx, b.cy] = L2W(b.u, b.v); }
    const away = (b: (typeof BOD)[number]) => Math.sign(b.v); // 천체에서 항로 반대쪽
    const camAt = (u: number) => [O[0] + u * ax[0] - 400, O[1] + u * ax[1] - CY];
    const spin: { g: SVGElement; w: number; a: number }[] = [], blink: { e: SVGElement; ph: number }[] = [];
    const orbiters: { g: SVGElement; body?: SVGElement; cx: number; cy: number; r: number; w: number }[] = [];
    const convoys: { g: SVGElement; body: SVGElement; v: number; dir: number; off: number }[] = [];

    // 원경 (시차): 별 · 가스 거성 · 먼 고리 행성
    const pa = camAt(-200).map((v) => v * PAR), pb = camAt(U + 200).map((v) => v * PAR);
    for (let j = 0; j < 220; j++) { const big = rnd() < .12; el('circle', { cx: pa[0] - 100 + rnd() * (pb[0] - pa[0] + 1000), cy: Math.min(pa[1], pb[1]) - 100 + rnd() * (Math.abs(pb[1] - pa[1]) + 650), r: big ? 1.1 : .6, fill: big ? C.t2 : C.t3 }, para); }
    const gp = camAt(U * .42).map((v) => v * PAR), gx = gp[0] + 700, gy = gp[1] + 640, gr = 250;
    const clip = el('clipPath', { id: 'rm-gclip' }, defs); el('circle', { cx: gx, cy: gy, r: gr }, clip);
    el('circle', { cx: gx, cy: gy, r: gr, fill: C.panel }, para);
    const bands = el('g', { 'clip-path': 'url(#rm-gclip)' }, para);
    for (let y = gy - gr + 14; y < gy; y += 11 + rnd() * 9) el('path', { d: `M${gx - gr} ${y}Q${gx} ${y + 7} ${gx + gr} ${y}`, stroke: C.panel2, 'stroke-width': 1.5 + rnd() * 4, fill: 'none' }, bands);
    txt(para, gx, gy - gr - 8, 'BODY-X1 · 원경', { 'text-anchor': 'middle', 'font-size': 8 });
    const fp = camAt(U * .78).map((v) => v * PAR), fx = fp[0] + 560, fy = fp[1] + 70;
    el('circle', { cx: fx, cy: fy, r: 9, fill: C.panel2 }, para);
    el('ellipse', { cx: fx, cy: fy, rx: 17, ry: 4, fill: 'none', stroke: C.t3, transform: `rotate(-14 ${fx} ${fy})` }, para);
    txt(para, fx + 22, fy + 3, 'BODY-X2', { 'font-size': 7.5 });

    // 진행축 거리 눈금 (축 선은 긋지 않는다)
    for (let u = 0; u <= U; u += 200) { const [x, y] = L2W(u, 0); el('path', { d: `M${x} ${y - 4}v8`, stroke: C.t3, transform: `rotate(${THd} ${x} ${y})` }, world); txt(world, x + 4, y - 5, `${(u / 1000).toFixed(1)}AU`, { 'font-size': 7 }); }
    // 수송선단 (진행축 양쪽 가장자리)
    for (const L of [{ v: run.links ? -310 : -182, dir: 1, code: 'CVY-12' }, { v: run.links ? 310 : 188, dir: -1, code: 'CVY-07' }]) {
      const [a, b] = [L2W(-300, L.v), L2W(U + 300, L.v)];
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.line, 'stroke-dasharray': '1 6' }, world);
      for (let c = 0; c < 2; c++) {
        const g = el('g', {}, world), body = el('g', {}, g);
        for (let k = 0; k < 3; k++) el('path', { d: `M${-k * 13 - 4} -3 ${-k * 13 + 4} 0 ${-k * 13 - 4} 3Z`, fill: C.t2 }, body);
        txt(g, -6, -8, `${L.code}${c ? 'B' : 'A'}`, { 'font-size': 7, fill: C.t2 });
        convoys.push({ g, body, v: L.v, dir: L.dir, off: rnd() * (U + 600) + c * (U + 600) / 2 });
      }
    }
    // 소행성대: 진행축을 비스듬히 가로지르는 띠
    const ub = BOD[2].u - 30, bu = (v: number) => ub + v * .55;
    const beltG = el('g', {}, world);
    for (let j = 0; j < 320; j++) { const v = -300 + rnd() * 600, [x, y] = L2W(bu(v) + (rnd() + rnd() + rnd() - 1.5) * 55, v); el('circle', { cx: x, cy: y, r: .5 + rnd() * rnd() * 1.9, fill: C.line }, beltG); }
    const blob = (r: number, n: number) => { const a: number[][] = []; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2, rr = r * (.72 + rnd() * .4); a.push([Math.cos(t) * rr, Math.sin(t) * rr]); } return a; };
    for (let j = 0; j < 16; j++) {
      const v = -280 + rnd() * 560, [x, y] = L2W(bu(v) + (rnd() - .5) * 120, v), g = el('g', { transform: `translate(${x} ${y})` }, beltG), rg = el('g', {}, g);
      el('polygon', { points: pts(blob(3 + rnd() * 4, 7)), fill: C.panel2 }, rg);
      spin.push({ g: rg, w: (rnd() - .5) * .02, a: rnd() * 360 });
    }
    { const [x, y] = L2W(bu(150) + 106, 150); txt(beltG, 0, 0, 'DEBRIS FIELD β', { 'font-size': 8, fill: C.t2, transform: `translate(${x} ${y}) rotate(${THd + Math.atan2(1, .55) * 180 / Math.PI})` }); }

    // 천체
    for (const b of BOD) {
      const g = el('g', {}, world), { cx, cy } = b;
      if (b.kind === 'rock') {
        const inner = el('g', {}, el('g', { transform: `translate(${cx} ${cy})` }, g));
        el('polygon', { points: pts(blob(b.R, 11)), fill: C.panel2 }, inner);
        for (const [x, y, r] of [[-4, -3, 2.2], [4, 3, 1.6], [2, -6, 1.1]]) el('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.line, 'stroke-width': .7 }, inner);
        spin.push({ g: inner, w: .006, a: 0 });
        el('path', { d: `M${cx + 9} ${cy - 9}l7 -9M${cx + 13} ${cy - 18}h6`, stroke: C.t3, 'stroke-width': .8 }, g); // 하역 크레인
      } else {
        el('circle', { cx, cy, r: b.R, fill: C.panel2 }, g);
        for (const k of [-.45, .1, .5]) { const yy = cy + k * b.R, hw = Math.sqrt(b.R * b.R - (k * b.R) ** 2) - 1.5; el('line', { x1: cx - hw, y1: yy, x2: cx + hw, y2: yy, stroke: C.line, 'stroke-width': .8 }, g); }
      }
      if (b.rings) for (let k = 0; k < b.rings; k++) el('circle', { cx, cy, r: b.R + 6 + k * 4.5, fill: 'none', stroke: k % 2 ? C.line : C.t3, 'stroke-width': k === 1 ? 2 : 1 }, g); // 네 겹 고리 (위에서 본 동심원)
      if (b.kind === 'port') {
        el('circle', { cx, cy, r: 32, fill: 'none', stroke: C.line, 'stroke-dasharray': '1 3' }, g);
        const st = el('g', {}, g), sb = el('g', {}, st);
        el('rect', { x: -15, y: -2.5, width: 8, height: 5, fill: C.line }, sb); el('rect', { x: 7, y: -2.5, width: 8, height: 5, fill: C.line }, sb);
        el('circle', { r: 5.5, fill: C.t3 }, sb);
        el('path', { d: 'M-7 0h14M0 -5.5v11', stroke: C.bg, 'stroke-width': .7 }, sb);
        contact(st, 'STN-07', -12);
        orbiters.push({ g: st, body: sb, cx, cy, r: 32, w: .00035 });
      }
      if (b.moon) {
        el('circle', { cx, cy, r: 40, fill: 'none', stroke: C.line, 'stroke-dasharray': '1 3' }, g);
        const m = el('g', {}, g); el('circle', { r: 4, fill: C.line }, m);
        orbiters.push({ g: m, cx, cy, r: 40, w: -.00022 });
        const [wx, wy] = L2W(b.u + 62, b.v ? b.v + away(b) * 30 : -b.r * .45); // 침식된 난파선
        el('path', { d: `M${wx - 14} ${wy}l9 -5h12l-3 4 5 2-6 3h-10Z M${wx + 9} ${wy - 6}l5 -4`, fill: C.panel2 }, g);
        txt(g, wx, wy + 14, 'WRK-02', { 'text-anchor': 'middle', 'font-size': 7 });
      }
      if (b.pulsar) {
        const [px, py] = b.v ? L2W(b.u + 70, b.v + away(b) * 40) : L2W(b.u + b.r + 70, -120), q = el('g', { transform: `translate(${px} ${py})` }, g);
        el('circle', { r: 5, fill: C.t2 }, q);
        for (const r of [12, 20, 28]) blink.push({ e: el('circle', { r, fill: 'none', stroke: C.t3 }, q), ph: r / 9 });
        txt(q, 0, 42, 'PSR · P=8y', { 'text-anchor': 'middle', fill: C.t2, 'font-size': 9 });
      }
      const [lx, ly] = L2W(b.u, b.v ? b.v + away(b) * (extOf(b) + (away(b) < 0 ? 22 : 24)) : b.half === 'lo' ? -b.r - 22 : b.r + 24); // 이름은 항로 반대편
      txt(g, lx, ly, b.code, { 'text-anchor': 'middle', fill: C.text, 'font-size': 11 });
      txt(g, lx, ly + 14, `${b.name} · ${b.sub}`, { 'text-anchor': 'middle', 'font-size': 8.5, class: 'rm-ko' });
    }

    if (run.links) return orbitBranch();
    /** 분기 항로 (궤도 다발): 기준 항로 = 천체 사이를 완만하게 누비는 곡선, 칸 = 진행축 위 같은 간격, 갈래 = 기준 항로의 법선으로 LANE 씩.
     *  노드마다 진행 방향 = 그 칸의 기준 항로 방향. 같은 갈래로 잇는 길 = 두 노드의 진행 방향을 잇는 매끄러운 곡선 (갈림길의 가운데 길은 갈림 노드의 기울기를 그대로 이어 간다),
     *  옆 갈래로 갈라지는 길 = 갈림 노드에서 비스듬히 벌어졌다가 도착 노드의 진행 방향으로 펴지는 원호, 합쳐지는 길 = 그 반대 (나란히 나와 모여든다).
     *  지나간 길 = 강조색 · 고른 노드에서 이어지는 길 = 밝게 · 갈 수 없는 길 = 흐리게. 지금 고를 수 있는 노드는 누르면 고른다 (main 의 노드 고르기와 같다) */
    function orbitBranch() {
      const rows = run.map, L = run.links!, R = rows.length;
      const WP = BOD.map((b) => [b.u, (b.half === 'lo' ? 1 : -1) * AW]);
      const vs = (u: number) => {
        if (u <= WP[0][0]) return WP[0][1];
        for (let k = 0; k < WP.length - 1; k++) if (u <= WP[k + 1][0]) { const t = (u - WP[k][0]) / (WP[k + 1][0] - WP[k][0]); return WP[k][1] + (WP[k + 1][1] - WP[k][1]) * (1 - Math.cos(Math.PI * t)) / 2; }
        return WP[WP.length - 1][1];
      };
      const u0 = BOD[0].u - BOD[0].r, uRow = (i: number) => u0 + ((U - u0) * i) / (R - 1);
      const tan = (u: number) => { const a = L2W(u - 1, vs(u - 1)), b = L2W(u + 1, vs(u + 1)), n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / n, (b[1] - a[1]) / n]; };
      const dOf = (i: number, j: number) => (j - (rows[i].length - 1) / 2) * LANE;
      const nodeAt = (i: number, j: number) => { const u = uRow(i), [x, y] = L2W(u, vs(u)), [tx, ty] = tan(u), dl = dOf(i, j); return [x - ty * dl, y + tx * dl]; };
      { const pts: number[][] = []; for (let u = u0; u <= U; u += 12) pts.push(L2W(u, vs(u))); el('polyline', { points: pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: C.line, 'stroke-width': .8, 'stroke-dasharray': '1 6' }, world); } // 기준 항로 (흐린 안내선)
      /** A 에서 T 방향으로 나가 B 에 닿는 원호 (점 29개) */
      const arc = (A: number[], B: number[], T: number[]) => {
        const cx = B[0] - A[0], cy = B[1] - A[1], ph = Math.atan2(T[0] * cy - T[1] * cx, T[0] * cx + T[1] * cy), out: number[][] = [];
        if (Math.abs(ph) < 1e-3) { for (let q = 0; q <= 28; q++) out.push([A[0] + (cx * q) / 28, A[1] + (cy * q) / 28]); return out; }
        const r = Math.hypot(cx, cy) / (2 * Math.sin(ph)), O2 = [A[0] - T[1] * r, A[1] + T[0] * r], v0 = [A[0] - O2[0], A[1] - O2[1]];
        for (let q = 0; q <= 28; q++) { const th = (2 * ph * q) / 28, c = Math.cos(th), sn = Math.sin(th); out.push([O2[0] + v0[0] * c - v0[1] * sn, O2[1] + v0[0] * sn + v0[1] * c]); }
        return out;
      };
      /** A → B 를 두 끝의 진행 방향 TA · TB 로 잇는 3차 베지어 (점 29개) */
      const hermite = (A: number[], B: number[], TA: number[], TB: number[]) => {
        const h = Math.hypot(B[0] - A[0], B[1] - A[1]) / 3, P1 = [A[0] + TA[0] * h, A[1] + TA[1] * h], P2 = [B[0] - TB[0] * h, B[1] - TB[1] * h], out: number[][] = [];
        for (let q = 0; q <= 28; q++) { const t = q / 28, m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t; out.push([a * A[0] + b * P1[0] + c * P2[0] + d * B[0], a * A[1] + b * P1[1] + c * P2[1] + d * B[1]]); }
        return out;
      };
      // 연결선: 갈라지는 옆 갈래 = 도착 방향에 맞춘 원호 · 나머지 (같은 갈래 · 합쳐지는 갈래) = 두 노드의 진행 방향을 잇는 매끄러운 곡선
      const edgeLayer = el('g', {}, world), beaconLayer = el('g', {}, world), nodeLayer = el('g', {}, world);
      const ship = el('g', {}, world);
      el('path', { d: 'M-11 -5 11 0-11 5-7 0Z', fill: C.sel, stroke: C.bg, 'stroke-width': 2, 'paint-order': 'stroke' }, ship);
      const rig = sweepRig(world, [70, 140, 210], (r) => `${(r / 1000).toFixed(2)}AU`);
      corners(fixed, VB);
      titleBlock(fixed, VB, 'BERTHA–SAN-NODIS 물류망 · 궤도 다발 항로도', [`페이즈 ${run.phase} · ${R} ROWS`, '군체 침식 전선 561', `진행축 방위 ${Math.round(90 + THd)}°`, 'REV.06 · 분기 궤도']);
      return branchKit({
        name: '베르타–산노디스 물류망',
        legend: [['궤도', '갈림길 = 왼쪽 · 가운데 · 오른쪽으로 갈라지는 궤도'], ['연결선', '지나간 길 = 강조색 · 고른 노드에서 이어지는 길 = 밝게 · 갈 수 없는 길 = 점선'], ['화물선', '지금 위치'], ['NAV', '항로 표지 — 화물선이 지나면 복구'], ['천체', 'B-4 · TS-7 · A-117 · SN · RL-2'], ['CVY', '수송선단 (진행축 양쪽)'], ['DEBRIS β', '소행성대'], ['PSR', '산-노디스 펄서 (8년 주기)']],
        edgeLayer, nodeLayer, beaconLayer, beacon: (i) => `NAV-${pad2(i + 1)} ONLINE`,
        nodeAt, dirAt: (i) => tan(uRow(i)),
        // 연결선: 갈라지는 옆 갈래 = 도착 방향에 맞춘 원호 · 나머지 (같은 갈래 · 합쳐지는 갈래) = 두 노드의 진행 방향을 잇는 매끄러운 곡선
        edgePts(i, j, k, kids) {
          const A = nodeAt(i, j), B = nodeAt(i + 1, k), tb = tan(uRow(i + 1)), ta = tan(uRow(i)), side = Math.abs(dOf(i + 1, k) - dOf(i, j)) > 1;
          const g0 = L2W(uRow(i), vs(uRow(i))), g1 = L2W(uRow(i + 1), vs(uRow(i + 1))), gl = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]) || 1, g = [(g1[0] - g0[0]) / gl, (g1[1] - g0[1]) / gl]; // 두 칸 사이 기준 항로 방향 (옆 갈래가 좌우 대칭으로 휘게)
          return side && kids.length >= 2 ? arc(B, A, [-g[0], -g[1]]).reverse() : hermite(A, B, ta, tb);
        },
        style: { taken: [C.sel, 2.5, 1, ''], toPick: [C.sel, 1.8, .9, '6 4'], mine: [C.t2, 1.6, 1, ''], alt: [C.t3, 1.3, .9, ''], none: [C.line, .9, .55, '1 4'] },
        camU: proj, camRange: [-40, U + 40], ahead: [60, 40], camEps: 4, dragPer: ax[0],
        drawCam(uc) { const P = L2W(uc, 0), [cx, cy] = camAt(uc); world.setAttribute('transform', `translate(${(400 - P[0]).toFixed(1)} ${(CY - P[1]).toFixed(1)})`); para.setAttribute('transform', `translate(${-cx * PAR} ${-cy * PAR})`); },
        marker(x, y, a) { ship.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a * 180 / Math.PI).toFixed(1)})`); rig.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); },
        tick(t) {
          for (const k of spin) k.g.setAttribute('transform', `rotate(${(k.a + t * k.w).toFixed(2)})`);
          for (const m of orbiters) { const a = t * m.w + 1; m.g.setAttribute('transform', `translate(${m.cx + Math.cos(a) * m.r} ${m.cy + Math.sin(a) * m.r})`); m.body?.setAttribute('transform', `rotate(${t * .02})`); }
          for (const c of convoys) { const u = mod(c.off + c.dir * t * .018, U + 600) - 300, [x, y] = L2W(u, c.v); c.g.setAttribute('transform', `translate(${x} ${y})`); c.body.setAttribute('transform', `rotate(${THd + (c.dir < 0 ? 180 : 0)})`); }
          for (const b of blink) b.e.setAttribute('stroke-opacity', (Math.max(0, Math.sin(t / 380 - b.ph)) * .9 + .1).toFixed(2));
          rig.set(mod(t * .05, 360));
        },
      });
    }
    // 항로: 첫 노드에서 시작해 마지막(보스) 노드에서 끝난다. 반원 끝 접선이 같아 이음매가 매끄럽다
    const rig = sweepRig(world, [70, 140, 210], (r) => `${(r / 1000).toFixed(2)}AU`);
    const st0 = L2W(BOD[0].u - BOD[0].r, 0);
    let d = `M${st0[0]} ${st0[1]}`;
    for (const b of BOD) { const e = L2W(b.u + b.r, 0); d += ` A${b.r} ${b.r} 0 0 ${b.half === 'lo' ? 0 : 1} ${e[0]} ${e[1]}`; }
    const route = el('path', { d, fill: 'none', stroke: C.t3, 'stroke-width': 1.5 }, world) as SVGGeometryElement;
    const done = el('path', { d, fill: 'none', stroke: C.sel, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, world);
    const total = route.getTotalLength(), sAt = (i: number) => total * i / (N - 1);
    done.setAttribute('stroke-dasharray', `${total} ${total}`);
    // 항로 표지: 화물선이 지나는 순간 복구되어 강조색으로 켜진다 (파문 + 짧은 알림)
    const beacons: { i: number; s: number; wave: SVGElement; dia: SVGElement; dot: SVGElement; lab: SVGElement; on: boolean | null; at: number }[] = [];
    for (let i = 0; i < N - 1; i++) {
      const bs = (sAt(i) + sAt(i + 1)) / 2, pt = route.getPointAtLength(bs), g = el('g', { transform: `translate(${pt.x} ${pt.y})` }, world);
      const wave = el('circle', { r: 4, fill: 'none', stroke: C.sel, 'stroke-width': 1.2, opacity: 0 }, g);
      const dia = el('path', { d: 'M0 -4.5 4.5 0 0 4.5-4.5 0Z', 'stroke-width': .9 }, g);
      const dot = el('circle', { r: 1.2, fill: C.t2 }, g);
      const lab = txt(g, 8, -8, `NAV-${pad2(i + 1)} ONLINE`, { 'font-size': 7.5, fill: C.sel, opacity: 0 });
      beacons.push({ i, s: bs, wave, dia, dot, lab, on: null, at: 0 });
    }
    let sp = sAt(cur), uc = 0; const LAG = 42; // 화물선은 항로 위, 노드 바로 뒤
    const setBeacon = (b: (typeof beacons)[number], on: boolean, fx: boolean) => {
      if (b.on === on) return; b.on = on;
      b.dia.setAttribute('fill', on ? C.sel : C.bg); b.dia.setAttribute('stroke', on ? C.sel : C.t2);
      b.dot.setAttribute('fill', on ? C.bg : C.t2);
      b.at = on && fx && !reduce ? performance.now() : 0;
      if (!b.at) { b.wave.setAttribute('opacity', '0'); b.lab.setAttribute('opacity', '0'); }
    };
    const syncBeacons = (fx: boolean) => beacons.forEach((b) => setBeacon(b, b.i < cur && sp >= b.s - 1, fx));
    const ship = el('g', {}, world);
    el('path', { d: 'M-11 -5 11 0-11 5-7 0Z', fill: C.sel, stroke: C.bg, 'stroke-width': 2, 'paint-order': 'stroke' }, ship);
    const tokens = tokensFor(world);
    tokens.forEach((k, i) => { const pt = route.getPointAtLength(sAt(i)); k.g.setAttribute('transform', `translate(${pt.x} ${pt.y})`); });
    corners(fixed, VB);
    titleBlock(fixed, VB, 'BERTHA–SAN-NODIS 물류망 · 대각 진행 항로도', [`페이즈 ${run.phase} · ${N} NODES`, '군체 침식 전선 561', `진행축 방위 ${Math.round(90 + THd)}°`, 'REV.05 · 스코프']);

    const loU = -40, hiU = U + 40, clampU = (u: number) => Math.max(loU, Math.min(hiU, u));
    const ucFor = (s1: number) => { const p = route.getPointAtLength(s1); return clampU(proj(p.x, p.y)); };
    const drawShip = () => {
      const s0 = Math.max(0, sp - LAG), p = route.getPointAtLength(s0), q = route.getPointAtLength(Math.min(total, s0 + 2));
      const ang = Math.atan2(q.y - p.y, q.x - p.x), bk = Math.max(0, LAG - sp); // 출발 노드에서는 시작 접선 뒤쪽에 대기
      ship.setAttribute('transform', `translate(${p.x - Math.cos(ang) * bk} ${p.y - Math.sin(ang) * bk}) rotate(${ang * 180 / Math.PI})`);
      done.setAttribute('stroke-dashoffset', `${total - sp}`);
      rig.g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    };
    const drawCam = () => {
      const [cx, cy] = camAt(uc);
      world.setAttribute('transform', `translate(${-cx} ${-cy})`); para.setAttribute('transform', `translate(${-cx * PAR} ${-cy * PAR})`);
      recenterBtn.hidden = homing || Math.abs(uc - ucFor(sAt(cur))) < 4;
    };
    uc = ucFor(sp);
    drawShip(); drawCam(); paint(tokens, false); syncBeacons(false);
    tick = (t) => {
      for (const k of spin) k.g.setAttribute('transform', `rotate(${(k.a + t * k.w).toFixed(2)})`);
      for (const m of orbiters) { const a = t * m.w + 1; m.g.setAttribute('transform', `translate(${m.cx + Math.cos(a) * m.r} ${m.cy + Math.sin(a) * m.r})`); m.body?.setAttribute('transform', `rotate(${t * .02})`); }
      for (const c of convoys) { const u = mod(c.off + c.dir * t * .018, U + 600) - 300, [x, y] = L2W(u, c.v); c.g.setAttribute('transform', `translate(${x} ${y})`); c.body.setAttribute('transform', `rotate(${THd + (c.dir < 0 ? 180 : 0)})`); }
      for (const b of blink) b.e.setAttribute('stroke-opacity', (Math.max(0, Math.sin(t / 380 - b.ph)) * .9 + .1).toFixed(2));
      const now = performance.now();
      for (const b of beacons) {
        if (!b.on) { b.dot.setAttribute('fill-opacity', Math.sin(t / 260 - b.i * 1.7) > .3 ? '1' : '.15'); continue; } // 꺼진 표지: 느린 점멸
        b.dot.setAttribute('fill-opacity', '1');
        if (!b.at) continue;
        const k = (now - b.at) / 900, k2 = (now - b.at) / 2200;
        b.wave.setAttribute('r', String(4 + 20 * Math.min(1, k))); b.wave.setAttribute('opacity', Math.max(0, 1 - k).toFixed(2));
        b.lab.setAttribute('opacity', (k2 < .7 ? Math.min(1, k2 * 6) : Math.max(0, (1 - k2) / .3)).toFixed(2));
        if (k2 >= 1) { b.at = 0; b.wave.setAttribute('opacity', '0'); b.lab.setAttribute('opacity', '0'); }
      }
      rig.set(mod(t * .05, 360));
    };
    const off = dragger((dx) => { uc = clampU(uc - dx / ax[0]); drawCam(); });
    return {
      name: '베르타–산노디스 물류망',
      legend: [['항로', '천체를 반 바퀴씩 감는 궤도 · 지난 구간은 강조색'], ['화물선', '항로 위 현재 위치'], ['NAV', '항로 표지 — 화물선이 지나면 복구'], ['천체', 'B-4 · TS-7 · A-117 · SN · RL-2 (이름은 항로 반대편)'], ['CVY', '수송선단 (진행축 양쪽)'], ['DEBRIS β', '소행성대'], ['PSR', '산-노디스 펄서 (8년 주기)'], ['AU', '진행축 거리 눈금']],
      look(i: number) { const u0 = uc, want = ucFor(sAt(i)); tween(700, (k) => { uc = u0 + (want - u0) * k; drawCam(); }); },
      go() {
        paint(tokens, true);
        const s0 = sp, s1 = sAt(cur), u0 = uc; homing = true;
        if (s1 < s0) syncBeacons(false);
        tween(1100, (k) => { sp = s0 + (s1 - s0) * k; drawShip(); syncBeacons(true); const want = ucFor(sp); uc = u0 + (want - u0) * Math.min(1, k * 1.3); drawCam(); }, () => { homing = false; syncBeacons(true); drawCam(); });
      },
      stop: off,
    };
  }
  // ── 경로형 장면 공용 (라이덴 · 카운티폴): 구간 경로를 이어 붙이고, 노드 자리 = 구간 경계까지의 누적 길이
  // 카메라 c: 기본 = 화면 왼쪽 30% 자리의 세계 x (세로는 노드 높이를 따라감) · line = 첫 노드 → 보스 노드 직선 위 비율 (구불구불한 길을 따라 툭툭 끊기지 않게)
  type RunOpt = {
    VB: number[]; world: SVGElement; routeLayer: SVGElement; nodeLayer?: SVGElement; start: number[]; segs: string[]; pos(i: number): number[];
    dir?: boolean; line?: boolean; follow?: number; look?: number; focus?: number; midY?: number; para?: [SVGElement, number, number][];
    casing?: Attrs; routeAttr?: Attrs; doneAttr?: Attrs;
    onRoute?(route: SVGGeometryElement, total: number, S: number[]): void; onMarker?(p: DOMPoint, s: number): void; tick?(t: number): void;
  };
  function stageBase(v: number[]) {
    const VB = fit(v);
    stage.setAttribute('viewBox', VB.join(' ')); stage.style.aspectRatio = fs ? '' : `${VB[2]} / ${VB[3]}`;
    el('rect', { x: VB[0] - 1200, y: VB[1] - 800, width: VB[2] + 2400, height: VB[3] + 1600, fill: C.bg }, stage);
    return VB;
  }
  /** 분기 항로 공용 (물류망 · 카운티폴): 지도 모양은 장면이 (노드 자리 · 연결선 점 · 카메라 · 표시기), 나머지는 여기서.
   *  상태 (지금 칸 · 지나간 노드 · 고를 수 있는 노드 · 고른 노드 · 그 앞으로 갈 수 있는 노드), 칸을 넘을 때 표시기가 지나온 길을 칠하며 움직이는 연출,
   *  노드 색 전환, 갈림길 안내 · 노드 카드 · 전체 화면 패널, 마우스 · 누름 · 터치로 고르고 진행하기 */
  type EdgeSt = [string, number, number, string]; // 선 색 · 굵기 · 불투명도 · 점선
  interface BranchOpt {
    name: string; legend: string[][];
    edgeLayer: Element; nodeLayer: Element; casingLayer?: Element; beaconLayer?: Element;
    /** 노드 토큰 자리 · 칸의 진행 방향 (화면 방향 단위 벡터) */
    nodeAt(i: number, j: number): number[]; dirAt(i: number): number[];
    /** 연결선 점 (kids = 출발 노드에서 이어지는 다음 노드들) */
    edgePts(i: number, j: number, k: number, kids: number[]): number[][];
    style: Record<'taken' | 'toPick' | 'mine' | 'alt' | 'none', EdgeSt>;
    /** 연결선 테두리 (선 굵기에 더할 폭) — 길 안내처럼 */
    casing?: number;
    /** 항로 표지 이름표 (있으면 지나간 연결선 가운데에 표지) */
    beacon?(i: number): string;
    /** 카메라: 월드 점 → 카메라 값 · 범위 · 그리기 · 끌기 1단위 (화면 좌표 / 카메라 값) · 앞서 보기 (고르는 중 · 아닐 때) · 첫 노드 뒤 거리 */
    camU(x: number, y: number): number; camRange: number[]; drawCam(u: number): void; dragPer: number; ahead: number[]; camEps: number;
    /** 표시기 (배 · 차) 를 그린다: 자리 · 방향 (라디안) · 지금 연결선 (없으면 출발 전) */
    marker(x: number, y: number, a: number, ed: { i: number; j: number; k: number; pts: number[][] } | null, t: number): void;
    /** 노드 상태가 바뀔 때 (핀 · 그림자 등 장면 소품을 맞춘다) */
    nodeState?(i: number, j: number, kind: string): void;
    tick?(t: number): void;
  }
  function branchKit(o: BranchOpt) {
    const rows = run.map, L = run.links!, R = rows.length;
    type Edge = { i: number; j: number; k: number; pts: number[][]; e: SVGElement; c?: SVGElement; mid: number[] };
    const line = (p: number[][]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
    const edges: Edge[] = [];
    for (let i = 0; i < R - 1; i++) rows[i].forEach((_, j) => (L[i]?.[j] || []).forEach((k, _n, kids) => {
      const pts = o.edgePts(i, j, k, kids), at = { points: line(pts), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      const c = o.casing && o.casingLayer ? el('polyline', { ...at, stroke: C.bg }, o.casingLayer) : undefined, e = el('polyline', at, o.edgeLayer);
      if (!reduce) for (const x of [e, c]) if (x) x.style.transition = 'stroke .5s, stroke-width .5s, opacity .5s';
      edges.push({ i, j, k, pts, e, c, mid: pts[Math.floor(pts.length / 2)] });
    }));
    const ptOn = (ed: Edge, t: number) => {
      const seg = ed.pts.slice(1).map((b, q) => Math.hypot(b[0] - ed.pts[q][0], b[1] - ed.pts[q][1])), tot = seg.reduce((a, b) => a + b, 0) || 1;
      let d = Math.max(0, Math.min(1, t)) * tot, q = 0;
      while (q < seg.length - 1 && d > seg[q]) { d -= seg[q]; q++; }
      const a = ed.pts[q], b = ed.pts[q + 1] || a, r = seg[q] ? d / seg[q] : 0;
      return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, Math.atan2(b[1] - a[1], b[0] - a[0]), q];
    };
    const [tS, tW] = o.style.taken;
    const trailC = o.casing && o.casingLayer ? el('polyline', { fill: 'none', stroke: C.bg, 'stroke-width': tW + o.casing, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o.casingLayer) : null;
    const trailEl = el('polyline', { fill: 'none', stroke: tS, 'stroke-width': tW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o.edgeLayer); // 표시기가 지나며 칠하는 길
    const toks = rows.map((row, i) => row.map((t, j) => { const k = token(o.nodeLayer, i, t); k.g.dataset.j = String(j); if (!reduce) k.g.style.transition = 'opacity .5s'; const [x, y] = o.nodeAt(i, j); k.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); return k; }));
    // 항로 표지: 지나간 연결선 가운데에 하나씩 (지나면 켜진다) + 고른 노드로 가는 연결선 (꺼진 채 점멸)
    const beacons = new Map<Edge, { wave: SVGElement; dia: SVGElement; dot: SVGElement; lab: SVGElement; on: boolean; at: number; g: SVGElement }>();
    const beacon = (ed: Edge) => {
      let b = beacons.get(ed);
      if (b || !o.beacon || !o.beaconLayer) return b;
      const g = el('g', { transform: `translate(${ed.mid[0].toFixed(1)} ${ed.mid[1].toFixed(1)})` }, o.beaconLayer);
      b = { g, wave: el('circle', { r: 4, fill: 'none', stroke: C.sel, 'stroke-width': 1.2, opacity: 0 }, g), dia: el('path', { d: 'M0 -4.5 4.5 0 0 4.5-4.5 0Z', 'stroke-width': .9, fill: C.bg, stroke: C.t2 }, g), dot: el('circle', { r: 1.2, fill: C.t2 }, g), lab: txt(g, 8, -8, o.beacon(ed.i), { 'font-size': 7.5, fill: C.sel, opacity: 0 }), on: false, at: 0 };
      beacons.set(ed, b);
      return b;
    };
    const live = () => last?.run ?? run;
    let shipEdge: Edge | null = null, shipT = 0, uc = 0, hov: NodeType | null = null, trail: Edge | null = null, camKey = '', homeU = 0;
    const shipTo: { edge: Edge | null; t: number } = { edge: null, t: 0 };
    const stateNow = () => {
      const r = live(), step = Math.min(r.step, R - 1), path = r.path || [], prev = step > 0 ? path[step - 1] ?? 0 : -1;
      const opts = step === 0 ? rows[0].map((_, k) => k) : L[step - 1]?.[prev] || [0];
      const want = hov && opts.some((k) => rows[step][k] === hov) ? hov : last?.pick?.get();
      const pj = r.node ? path[step] ?? opts[0] : opts.find((k) => rows[step][k] === want) ?? opts[0];
      const fwd = (from: number[]) => { const out = rows.map(() => new Set<number>()); from.forEach((j) => out[step].add(j)); for (let i = step; i < R - 1; i++) for (const j of out[i]) for (const k of L[i]?.[j] || []) out[i + 1].add(k); return out; };
      return { r, step, path, prev, opts: r.node ? [pj] : opts, pj, all: fwd(r.node ? [pj] : opts), mine: fwd([pj]), choosing: !r.node && opts.length > 1 };
    };
    type Now = ReturnType<typeof stateNow>;
    const ST_OPT = { ...STATE.next, sw: 1.8, bs: 1, ba: 0, bo: .8 };
    const clampU = (u: number) => Math.max(o.camRange[0], Math.min(o.camRange[1], u));
    const ucOf = (x: number, y: number) => clampU(o.camU(x, y));
    const placeShip = () => {
      if (!shipEdge) { const [x, y] = o.nodeAt(0, 0), [dx, dy] = o.dirAt(0); o.marker(x - dx * 30, y - dy * 30, Math.atan2(dy, dx), null, 0); return; }
      const [x, y, a] = ptOn(shipEdge, shipT);
      o.marker(x, y, a, shipEdge, shipT);
    };
    const drawCam = () => { o.drawCam(uc); recenterBtn.hidden = homing || Math.abs(uc - homeU) < o.camEps; placeCards(); };
    /** 카메라 자리: 고르는 중 = 지나온 노드와 고를 노드 사이 (고른 노드 · 마우스와 상관없이 고정), 아니면 지금 노드 조금 앞 */
    const camOf = (S0: Now): number => {
      const { step, prev, pj } = S0;
      if (S0.choosing) { const b = o.nodeAt(step, S0.opts[0]), [dx, dy] = o.dirAt(step), a = step > 0 ? o.nodeAt(step - 1, prev) : [b[0] - dx * 110, b[1] - dy * 110]; return clampU((o.camU(a[0], a[1]) + o.camU(b[0], b[1])) / 2 + o.ahead[0]); }
      const [x, y] = o.nodeAt(step, pj); return clampU(o.camU(x, y) + o.ahead[1]);
    };
    /** 노드 칠하기: ms 동안 (끝낸 노드가 먼저 옅어지고 새 현재 노드가 밝아진다 — 한 줄 항로와 같은 순서) */
    const paintJobs = (jobs: { k: Tok; from: St; to: St; w: number[] }[], ms: number) => {
      cancelAnimationFrame(praf);
      const set = (T: number) => jobs.forEach((j) => { const u = Math.min(1, Math.max(0, (T - j.w[0]) / (j.w[1] - j.w[0]))); const v = u >= 1 ? j.to : lerp(j.from, j.to, ease(u)); apply(j.k, v); j.k.st = v; });
      if (!ms || reduce) { set(1); return; }
      const t0 = performance.now();
      const f = (now: number) => { const T = Math.min(1, (now - t0) / ms); set(T); if (T < 1) praf = requestAnimationFrame(f); };
      praf = requestAnimationFrame(f);
    };
    /** 연결선 칠하기 · 항로 표지 (lit = 표지가 켜지는 시각). 겹치는 연결선은 중요한 것이 위로 */
    const styleEdges = (S0: Now, lit: number) => {
      const { step, path, prev, pj } = S0;
      let pickEdge: Edge | null = null;
      const pri: [Edge, number][] = [];
      for (const ed of edges) {
        const taken = ed !== trail && (ed.i + 1 < step ? path[ed.i] === ed.j && path[ed.i + 1] === ed.k : ed.i + 1 === step && path[ed.i] === ed.j && ed.k === pj && !!S0.r.node);
        const toPick = ed.i + 1 === step && ed.j === prev && ed.k === pj && !S0.r.node;
        if (ed.i + 1 === step && ed.j === prev && ed.k === pj) pickEdge = ed;
        const mine = ed === trail || (ed.i >= step && S0.mine[ed.i].has(ed.j) && S0.mine[ed.i + 1].has(ed.k)), alt = ed.i >= step ? S0.all[ed.i].has(ed.j) && S0.all[ed.i + 1].has(ed.k) : ed.i + 1 === step && ed.j === prev && S0.opts.includes(ed.k);
        const kind = taken ? 'taken' : toPick ? 'toPick' : mine ? 'mine' : alt ? 'alt' : 'none', [stroke, sw, op, dash] = o.style[kind];
        ed.e.style.stroke = stroke; ed.e.style.strokeWidth = String(sw); ed.e.style.opacity = String(op);
        if (ed.c) { ed.c.style.strokeWidth = String(sw + (o.casing || 0)); ed.c.style.opacity = String(op); }
        if (dash) ed.e.setAttribute('stroke-dasharray', dash); else ed.e.removeAttribute('stroke-dasharray');
        pri.push([ed, ['none', 'alt', 'mine', 'taken', 'toPick'].indexOf(kind)]);
        if (taken || toPick) { const b = beacon(ed); if (b) { if (b.on !== taken) { b.on = taken; b.dia.setAttribute('fill', taken ? C.sel : C.bg); b.dia.setAttribute('stroke', taken ? C.sel : C.t2); b.dot.setAttribute('fill', taken ? C.bg : C.t2); b.at = taken && lit && !reduce ? lit : 0; } b.g.style.display = ''; } }
        else { const b = beacons.get(ed); if (b) b.g.style.display = 'none'; }
      }
      pri.sort((a, b) => a[1] - b[1]).forEach(([ed]) => { if (ed.c) ed.c.parentNode!.appendChild(ed.c); ed.e.parentNode!.appendChild(ed.e); });
      if (trailC) trailC.parentNode!.appendChild(trailC);
      trailEl.parentNode!.appendChild(trailEl);
      return pickEdge;
    };
    const drawTrail = () => {
      if (!trail || shipEdge !== trail) return;
      const [x, y, , q] = ptOn(trail, shipT), p = line([...trail.pts.slice(0, q + 1), [x, y]]);
      trailEl.setAttribute('points', p); trailC?.setAttribute('points', p);
    };
    const clearTrail = () => { trail = null; trailEl.setAttribute('points', ''); trailC?.setAttribute('points', ''); };
    /** 다시 칠하기. anim = 칸이 바뀌면 표시기가 지나온 연결선을 따라 움직이며 길을 칠하고 카메라가 따라간다 (한 줄 항로의 이동 연출).
     *  같은 칸에서 고른 노드만 바뀌면 (누름 · 마우스) 카메라는 그대로, 노드 · 연결선만 짧게 바뀐다 */
    const update = (anim: boolean) => {
      const S0 = stateNow(), { step, path } = S0, pj = S0.pj;
      const key = `${step}|${S0.choosing}|${S0.r.node ? 1 : 0}`, big = key !== camKey;
      camKey = key;
      const jobs: { k: Tok; from: St; to: St; w: number[] }[] = [];
      rows.forEach((row, i) => row.forEach((t, j) => {
        const k = toks[i][j];
        const kind = i < step ? (path[i] === j ? 'past' : 'gone') : i === step ? (j === pj ? 'cur' : S0.opts.includes(j) ? 'opt' : 'gone') : S0.mine[i].has(j) ? 'next' : S0.all[i].has(j) ? 'alt' : 'gone';
        const v: St = kind === 'cur' ? { kind: 'cur', ...STATE.cur, col: C.sel, ncol: C.sel, bcol: C.sel }
          : kind === 'opt' ? { kind: 'next', ...ST_OPT, col: C.sel, ncol: C.sel, bcol: C.sel }
          : kind === 'past' ? { kind: 'past', ...STATE.past, col: C.t3, ncol: C.t3, bcol: C.t3 }
          : kind === 'next' ? { kind: 'next', ...STATE.next, col: colOf(t), ncol: C.t3, bcol: C.t3 }
          : kind === 'alt' ? { kind: 'next', ...STATE.next, op: .75, col: mix(colOf(t), C.bg, .35), ncol: C.t3, bcol: C.t3, bo: .4 }
          : { kind: 'past', ...STATE.past, op: .22, col: C.t3, ncol: C.t3, bcol: C.t3, bo: .15 };
        jobs.push({ k, from: k.st || v, to: v, w: kind === 'past' || kind === 'gone' ? [0, .55] : kind === 'cur' ? [.35, 1] : [0, 1] });
        k.g.style.opacity = kind === 'gone' ? '.28' : kind === 'alt' ? '.8' : '1';
        const keyNode = kind === 'cur' || kind === 'opt' || kind === 'next' || row.length === 1; // 고른 길에서 갈 수 있는 노드는 칸 번호를 보인다 (몇 번째 칸까지 이어지는지)
        k.num.style.display = keyNode ? '' : 'none';
        k.call.style.display = kind === 'cur' || kind === 'opt' || t === 'boss' || (row.length === 1 && i >= step) ? '' : 'none';
        if ((kind === 'opt' || kind === 'cur') && !S0.r.node) k.g.dataset.pick = t; else delete k.g.dataset.pick;
        o.nodeState?.(i, j, kind);
      }));
      paintJobs(jobs, anim ? (big ? 1100 : 240) : 0);
      // 표시기: 고르는 중이면 지나온 노드에서 고른 노드 쪽으로 막 출발한 자리, 들어간 노드면 그 노드 바로 앞
      const hu = camOf(S0), entered = step >= 2 ? edges.find((ed) => ed.i === step - 2 && ed.j === path[step - 2] && ed.k === path[step - 1]) : undefined;
      const moving = anim && big && !reduce && !!entered && shipEdge?.i === step - 2; // 지난 칸에서 들어간 연결선 → 이번 칸 연결선
      const from = moving ? entered! : shipEdge, fromT = moving && shipEdge !== entered ? .16 : shipT;
      if (moving) trail = from;
      const toEdge = styleEdges(S0, moving ? performance.now() + 320 : anim ? performance.now() : 0);
      shipTo.edge = toEdge; shipTo.t = S0.r.node ? .86 : .16;
      homeU = hu;
      fx();
      if (!big) { if (!homing) { shipEdge = shipTo.edge; shipT = shipTo.t; placeShip(); } return; } // 고른 노드만 바뀜: 카메라는 그대로
      if (anim && !reduce) {
        const u0 = uc; homing = true;
        tween(moving ? 1100 : 700, (q) => {
          if (moving && from) { if (q < .5) { shipEdge = from; shipT = fromT + (1 - fromT) * (q / .5); } else { shipEdge = shipTo.edge; shipT = shipTo.t * ((q - .5) / .5); } drawTrail(); }
          else if (from && from === shipTo.edge) { shipEdge = from; shipT = fromT + (shipTo.t - fromT) * q; } // 같은 연결선 위 (고른 노드로 들어감)
          else { shipEdge = shipTo.edge; shipT = shipTo.t; }
          placeShip(); uc = u0 + (homeU - u0) * q; drawCam();
        }, () => {
          homing = false; shipEdge = shipTo.edge; shipT = shipTo.t; placeShip(); uc = homeU; drawCam();
          if (trail) { clearTrail(); styleEdges(stateNow(), 0); }
        });
      } else { clearTrail(); shipEdge = shipTo.edge; shipT = shipTo.t; placeShip(); uc = homeU; drawCam(); }
    };
    // 마우스를 올린 노드: 그 노드로 가는 길을 미리 밝힌다 (카메라는 그대로). 누르면 바로 진행 — 터치는 한 번 누르면 고르고 고른 노드를 다시 누르면 진행
    o.nodeLayer.addEventListener('pointerover', (e) => { if ((e as PointerEvent).pointerType !== 'mouse') return; const t = (e.target as Element).closest<SVGElement>('.rm-node')?.dataset.pick as NodeType | undefined; if (t && t !== hov) { hov = t; update(true); panel(); } });
    o.nodeLayer.addEventListener('pointerout', (e) => { const pe = e as PointerEvent; if (pe.pointerType !== 'mouse' || !hov || pe.buttons) return; const to = (pe.relatedTarget as Element | null)?.closest?.('.rm-node') as SVGElement | null; if (to?.dataset.pick === hov) return; hov = null; update(true); panel(); }); // 누르는 순간 (포인터 캡처) 은 떠난 것이 아니다
    onPick = (t, how) => { const p = last?.pick; if (!p) return; if (how === 'tap' && p.get() !== t) { p.set(t); return; } hov = null; const go = () => (p.go ? p.go(t) : p.set(t)); if (fs) closeFs(true, go); else go(); }; // 진행: 전체 화면은 지도 자리로 줄인 뒤 (미뤄 둔 보상 창 · 다음 화면이 보이게)
    /** 노드 j 를 고르면 이어지는 칸들: 칸 번호 · 갈 수 있는 노드 · 끝 표시 (고르는 중 = 모든 길이 만나는 칸까지, 아니면 4칸) */
    const aheadRows = (j: number, S0: Now) => {
      const { step } = S0, me = rows.map(() => new Set<number>()), out: { i: number; ks: number[]; end: '' | '합류' | '보스' }[] = [];
      me[step].add(j);
      for (let i = step; i < R - 1; i++) for (const a of me[i]) for (const k of L[i]?.[a] || []) me[i + 1].add(k);
      for (let i = step + 1; i < R; i++) {
        const ks = [...me[i]].sort((a, b) => a - b), join = S0.choosing ? ks.length === 1 && S0.all[i].size === 1 : i >= step + 4 || i === R - 1;
        out.push({ i, ks, end: join && S0.choosing ? (i === R - 1 ? '보스' : '합류') : '' });
        if (join) break;
      }
      return out;
    };
    // 전체 화면 옆 패널: 고를 수 있는 길마다 그 길로 몇 번째 칸의 어느 노드까지 갈 수 있는지 (모든 길이 만나는 칸까지)
    const branchPanel = () => {
      const S0 = stateNow(), { step } = S0, ic = (t: NodeType) => `<span class="rp-ic" title="${NODE_NAME[t]}">${lineIcon(`n.${t}`, 'li')}</span>`;
      const ahead = (j: number) => `<ol class="rp-ahead">${aheadRows(j, S0).map((r) => `<li${r.end ? ' class="rp-join"' : ''}><span class="mono rp-n">${pad2(r.i + 1)}</span>${r.ks.map((k) => ic(rows[r.i][k])).join('')}${r.end ? `<small>${r.end}</small>` : ''}</li>`).join('')}</ol>`;
      const opts = S0.choosing ? S0.opts : [S0.pj], pt = rows[step][S0.pj];
      const items = opts.map((j) => { const t = rows[step][j], on = j === S0.pj; return `<li class="rp-route${on ? ' on' : ''}"><button type="button" data-pick="${t}" aria-pressed="${on}"><span class="mono rp-n">${pad2(step + 1)}</span>${ic(t)}<b>${NODE_NAME[t]}</b>${on && S0.choosing ? '<small>고름</small>' : ''}</button>${ahead(j)}</li>`; }).join('');
      return `<header><b>${o.name}</b><span class="chip" style="--c:var(--c-bad)">보스까지 <b class="mono">${R - 1 - step}</b>칸</span></header>
        <h4>${S0.choosing ? '고를 수 있는 길' : '지금 길'}</h4><ol class="rp-routes">${items}</ol>
        ${S0.choosing ? `<button class="btn primary rp-go" type="button" data-enter="${pt}">${pad2(step + 1)} ${NODE_NAME[pt]} 진입</button>` : ''}
        <h4>범례</h4><dl class="rp-legend">${o.legend.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p class="rp-keys"><kbd>Esc</kbd> 닫기 · 끌기 · 휠로 둘러보기</p>`;
    };
    // 갈림길 (전체 화면이 다 펼쳐진 뒤): 위쪽 가운데 제목 '경로를 선택하세요' + 고를 노드마다 옆 카드 (노드 이름 · 그 뒤로 이어지는 칸)
    const cardHtml = (j: number, S0: Now) => {
      const t = rows[S0.step][j], on = j === S0.pj, nm = (k: NodeType) => `${lineIcon(`n.${k}`, 'li')}${NODE_NAME[k]}`;
      const ahead = aheadRows(j, S0).map((r) => `<span class="rmc-row"><i class="mono">${pad2(r.i + 1)}</i>${r.ks.map((k) => `<span>${nm(rows[r.i][k])}</span>`).join('<span class="rmc-or">·</span>')}${r.end ? `<em>${r.end}</em>` : ''}</span>`).join('');
      return `<button type="button" class="rm-card${on ? ' on' : ''}" data-pick="${t}" data-j="${j}" aria-pressed="${on}" style="--c:${colOf(t)}"><span class="rmc-head"><i class="mono">${pad2(S0.step + 1)}</i>${lineIcon(`n.${t}`, 'li')}<b>${NODE_NAME[t]}</b></span><span class="rmc-ahead">${ahead}</span></button>`;
    };
    /** 카드 자리: 고를 노드마다 후보 자리 (바깥쪽 → 진행 방향 → 뒤 → 위 · 아래 · 좌우) 중에서 보이는 노드 · 다른 카드 · 안내 제목을 가장 덜 가리는 곳 */
    function placeCards() {
      if (cardsEl.hidden || !cardsEl.children.length) return;
      const vr = viewEl.getBoundingClientRect(), step = stateNow().step, [tx, ty] = o.dirAt(step), top = guideEl.hidden ? 8 : guideEl.offsetTop + guideEl.offsetHeight + 8;
      type Box = { l: number; t: number; r: number; b: number };
      const rel = (r: DOMRect, pad: number): Box => ({ l: r.left - vr.left - pad, t: r.top - vr.top - pad, r: r.right - vr.left + pad, b: r.bottom - vr.top + pad });
      const obst: Box[] = [];
      toks.forEach((row) => row.forEach((k) => { if (k.g.style.opacity !== '.28') obst.push(rel(k.ring.getBoundingClientRect(), 8)); })); // 흐린 (갈 수 없는) 노드는 가려도 된다
      const over = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      const ps = Array.from(cardsEl.children).map((c) => { const r = toks[step][+(c as HTMLElement).dataset.j!].ring.getBoundingClientRect(); return { c: c as HTMLElement, x: r.x + r.width / 2 - vr.left, y: r.y + r.height / 2 - vr.top, rad: r.width / 2 }; });
      const mx = ps.reduce((a, p) => a + p.x, 0) / ps.length, my = ps.reduce((a, p) => a + p.y, 0) / ps.length;
      const placed: Box[] = [];
      for (const p of ps) {
        let ox = p.x - mx, oy = p.y - my; const n = Math.hypot(ox, oy);
        if (n < 8) { ox = tx; oy = ty; } else { ox /= n; oy /= n; }
        const w = p.c.offsetWidth, h = p.c.offsetHeight, gap = p.rad + 26;
        const dirs = [[ox, oy], [tx, ty], [-tx, -ty], [0, Math.sign(oy) || -1], [0, -(Math.sign(oy) || -1)], [1, 0], [-1, 0]];
        let best: Box | null = null, bestS = Infinity;
        dirs.forEach(([dx, dy], i) => {
          let l: number, t: number;
          if (Math.abs(dx) >= Math.abs(dy)) { l = dx > 0 ? p.x + gap : p.x - gap - w; t = p.y - h / 2; } else { t = dy > 0 ? p.y + gap : p.y - gap - h; l = p.x - w / 2; }
          l = Math.max(8, Math.min(vr.width - w - 8, l)); t = Math.max(top, Math.min(vr.height - h - 8, t));
          const bx = { l, t, r: l + w, b: t + h };
          const sc = obst.reduce((a, q) => a + over(bx, q), 0) + placed.reduce((a, q) => a + 2 * over(bx, q), 0) + i * 40; // 앞 후보일수록 조금 유리
          if (sc < bestS) { bestS = sc; best = bx; }
        });
        placed.push(best!);
        p.c.style.transform = `translate(${best!.l.toFixed(0)}px, ${best!.t.toFixed(0)}px)`;
      }
    }
    const fx = () => {
      const S0 = stateNow(), show = fs && fxOn && S0.choosing;
      for (const j of S0.opts) toks[S0.step][j].call.style.display = show ? 'none' : ''; // 카드가 이름을 보이면 작은 호출 부호는 숨긴다
      if (!show) { guideEl.hidden = true; cardsEl.hidden = true; cardsEl.innerHTML = ''; cardsEl.dataset.k = ''; return; }
      guideEl.querySelector('small')!.textContent = `갈림길 · ${S0.opts.length}갈래`;
      if (guideEl.hidden) { guideEl.hidden = false; replay(guideEl); }
      const k = `${S0.r.seed}|${S0.r.phase}|${S0.step}`; // 카드는 칸마다 한 번 만든다 — 고른 노드 · 마우스가 바뀌면 표시만 바꾼다 (다시 그리면 등장 연출이 되풀이된다)
      if (cardsEl.dataset.k !== k) { cardsEl.innerHTML = S0.opts.map((j) => cardHtml(j, S0)).join(''); cardsEl.dataset.k = k; }
      for (const c of Array.from(cardsEl.children) as HTMLElement[]) { const on = +c.dataset.j! === S0.pj; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); }
      if (cardsEl.hidden) { cardsEl.hidden = false; replay(cardsEl); }
      placeCards();
    };
    fxHook = fx;
    cardsEl.addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLElement>('.rm-card'); if (b?.dataset.pick) onPick(b.dataset.pick as NodeType, (e as PointerEvent).pointerType === 'touch' ? 'tap' : 'click'); });
    cardsEl.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const t = (e.target as Element).closest<HTMLElement>('.rm-card')?.dataset.pick as NodeType | undefined; if (t && t !== hov) { hov = t; update(true); panel(); } });
    cardsEl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && hov) { hov = null; update(true); panel(); } });
    // 패널의 길에 마우스를 올리면 지도에서도 그 길을 미리 밝힌다
    panelEl?.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const t = (e.target as Element).closest<HTMLElement>('[data-pick]')?.dataset.pick as NodeType | undefined; if (t && t !== hov && stateNow().choosing) { hov = t; update(true); panel(); } });
    panelEl?.addEventListener('pointerleave', () => { if (hov) { hov = null; update(true); panel(); } });
    update(false);
    tick = (t) => {
      o.tick?.(t);
      const now = performance.now();
      for (const [ed, b] of beacons) {
        if (!b.on) { b.dot.setAttribute('fill-opacity', Math.sin(t / 260 - ed.i * 1.7) > .3 ? '1' : '.15'); continue; }
        b.dot.setAttribute('fill-opacity', '1');
        if (!b.at || now < b.at) continue;
        const k = (now - b.at) / 900, k2 = (now - b.at) / 2200;
        b.wave.setAttribute('r', String(4 + 20 * Math.min(1, k))); b.wave.setAttribute('opacity', Math.max(0, 1 - k).toFixed(2));
        b.lab.setAttribute('opacity', (k2 < .7 ? Math.min(1, k2 * 6) : Math.max(0, (1 - k2) / .3)).toFixed(2));
        if (k2 >= 1) { b.at = 0; b.wave.setAttribute('opacity', '0'); b.lab.setAttribute('opacity', '0'); }
      }
    };
    const off = dragger((dx) => { uc = clampU(uc - dx / o.dragPer); drawCam(); });
    return {
      name: o.name, legend: o.legend, panel: branchPanel,
      look(i: number) { const [x, y] = o.nodeAt(i, 0), u0 = uc, want = ucOf(x, y); tween(700, (k) => { uc = u0 + (want - u0) * k; drawCam(); }); },
      go() { const u0 = uc; homing = true; tween(600, (k) => { uc = u0 + (homeU - u0) * k; drawCam(); }, () => { homing = false; drawCam(); }); },
      update() { update(true); },
      stop: off,
      /** 지금 표시기가 있는 연결선 · 고른 노드 (장면의 길 안내 표시용) */
      now: () => ({ S0: stateNow(), shipEdge, shipT, edges }),
    };
  }
  function trackRun(o: RunOpt) {
    const RL = o.routeLayer, tmp = el('path', { fill: 'none' }, RL) as SVGGeometryElement, S = [0];
    let d = `M${o.start[0]} ${o.start[1]}`;
    for (const sg of o.segs) { d += sg; tmp.setAttribute('d', d); S.push(tmp.getTotalLength()); }
    tmp.remove();
    const LN: Attrs = { d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (o.casing) el('path', { ...LN, ...o.casing }, RL); // 길 안내: 테두리
    const route = el('path', { ...LN, stroke: C.t3, 'stroke-width': 1.4, 'stroke-dasharray': '3 4', ...o.routeAttr }, RL) as SVGGeometryElement;
    const done = el('path', { ...LN, stroke: C.sel, 'stroke-width': 2.6, ...o.doneAttr }, RL);
    const total = S[S.length - 1]; done.setAttribute('stroke-dasharray', `${total} ${total}`);
    o.onRoute?.(route, total, S);
    const marker = el('g', {}, RL);
    el('path', { d: o.dir ? 'M-7 -4 7 0-7 4-4 0Z' : 'M0 -7 5 1H-5Z', fill: C.sel, stroke: C.bg, 'stroke-width': 1.5, 'paint-order': 'stroke' }, marker);
    const P = types.map((_, i) => o.pos(i)), tokens = tokensFor(o.nodeLayer || o.world);
    tokens.forEach((k, i) => k.g.setAttribute('transform', `translate(${P[i][0]} ${P[i][1]})`));
    const { VB } = o, FOC = VB[0] + VB[2] * (o.focus ?? .3), MIDY = VB[1] + VB[3] * (o.midY ?? .55);
    const LA = P[0], LV = [P[N - 1][0] - LA[0], P[N - 1][1] - LA[1]], LL = LV[0] ** 2 + LV[1] ** 2 || 1, per = o.line ? LV[0] || 1 : 1;
    const camFor = (i: number) => (o.line ? ((P[i][0] - LA[0]) * LV[0] + (P[i][1] - LA[1]) * LV[1]) / LL : P[i][0]);
    const pad = 60 / Math.abs(per), lo = camFor(0) - pad, hi = camFor(N - 1) + pad, clampC = (c: number) => Math.max(lo, Math.min(hi, c));
    const yAt = (x: number) => { if (x <= P[0][0]) return P[0][1]; for (let i = 0; i < N - 1; i++) if (x <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / Math.max(1, P[i + 1][0] - P[i][0]); return P[N - 1][1]; };
    let sp = S[cur], c = clampC(camFor(cur));
    const drawMarker = () => {
      const s1 = Math.max(0, Math.min(total, sp)), s0 = o.dir ? Math.max(0, s1 - 16) : s1, p = route.getPointAtLength(s0);
      if (o.dir) { const q = route.getPointAtLength(Math.min(total, s0 + 2)); marker.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI).toFixed(1)})`); }
      else marker.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.y - 3).toFixed(1)})`);
      done.setAttribute('stroke-dashoffset', `${total - sp}`);
      o.onMarker?.(p, s1);
    };
    const drawCam = () => {
      const cx = o.line ? LA[0] + LV[0] * c - FOC : c - FOC;
      const cy = o.line ? LA[1] + LV[1] * c - MIDY : ((yAt(c) + yAt(c + (o.look || 0))) / 2 - MIDY) * (o.follow ?? .8);
      o.world.setAttribute('transform', `translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
      for (const [g, kx, ky] of o.para || []) g.setAttribute('transform', `translate(${(-cx * kx).toFixed(1)} ${(-cy * ky).toFixed(1)})`);
      recenterBtn.hidden = homing || Math.abs(c - clampC(camFor(cur))) * Math.abs(per) < 4;
    };
    drawMarker(); drawCam(); paint(tokens, false);
    tick = (t) => o.tick?.(t);
    const off = dragger((dx) => { c = clampC(c - dx / per); drawCam(); });
    return {
      look(i: number) { const c0 = c, c1 = clampC(camFor(i)); tween(700, (k) => { c = c0 + (c1 - c0) * k; drawCam(); }); },
      go() {
        paint(tokens, true);
        const s0 = sp, s1 = S[cur], c0 = c, c1 = clampC(camFor(cur)); homing = true;
        tween(1150, (k) => { sp = s0 + (s1 - s0) * k; drawMarker(); c = c0 + (c1 - c0) * k; drawCam(); }, () => { homing = false; drawCam(); });
      },
      stop: off,
    };
  }
  function ko(a: Attrs = {}): Attrs { return { ...a, class: 'rm-ko' }; } // 한글 글꼴
  function torii(g: Element, x: number, y: number, s: number, col = C.t2) {
    el('path', { d: `M${x - 9 * s} ${y}V${y - 19 * s}M${x + 9 * s} ${y}V${y - 19 * s}`, stroke: col, 'stroke-width': 1.6 * s }, g);
    el('path', { d: `M${x - 14 * s} ${y - 22 * s}Q${x} ${y - 25 * s} ${x + 14 * s} ${y - 22 * s}`, stroke: col, 'stroke-width': 2.4 * s, fill: 'none' }, g);
    el('path', { d: `M${x - 11 * s} ${y - 16 * s}H${x + 11 * s}`, stroke: col, 'stroke-width': 1.1 * s }, g);
  }

  // ── 라이덴 제34블록 봉쇄선: 고저 단면. 노드는 기둥 위 보행 데크(계단 · 층계참)에 있고, 아래 거리에는 높이가 제각각인 다층 상가 건물이 따로 선다.
  // 시작 앞 = 봉쇄 바리케이드 · 폐쇄된 역, 마지막 계단 = 도리이, 옥상 = 여우 신사. 하늘엔 데스 스트리밍 비행선 · 촬영 드론 (CAM-07 은 우리를 따라온다)
  function stairsScene() {
    const VB = stageBase(narrow ? [180, 20, 440, 380] : [0, 10, 800, 400]);
    const STEP = 156, LH = 26, LAND = 32, EL = 8, rnd = rng(71 + run.phase), lr = rng(41 + run.phase);
    const lv: number[] = []; // 층: 칸마다 1~3층씩 크게 오르내리고, 마지막(보스)은 바로 앞보다 3층 위 신사
    for (let i = 0, L = 0; i < N; i++) {
      if (i === N - 1) L = Math.min(lv[i - 1] + 3, 6);
      else if (i) { let dl = 0; while (!dl) dl = Math.round((lr() * 2 - 1) * 3); L = Math.max(-3, Math.min(4, L + dl)); }
      lv.push(L);
    }
    const lo = Math.min(...lv), BASE = 250 + Math.min(0, lo + 2) * LH; // 가장 낮은 칸도 거리보다 충분히 위
    const X = (i: number) => 150 + i * STEP, Y = (i: number) => BASE - lv[i] * LH, XN = X(N - 1);
    const FLOOR = BASE - lo * LH + 74; // 아래 거리 (상가가 서는 땅)
    const para = el('g', {}, stage), mid = el('g', {}, stage), world = el('g', {}, stage), fixed = el('g', {}, stage);
    type Blink = { e: SVGElement; ph: number; w: number; broken?: boolean };
    const blink: Blink[] = [], neon: Blink[] = [], lanterns: SVGElement[] = [];
    // 원경: 마천루 숲 · 꺼지지 않는 세로 간판
    const SKY = ['TENGAI', 'NEKOMATSURI', 'AYAKASHI', '24H', 'HOISHUN', 'KAGEROU'];
    for (let x = -260; x < XN * .3 + 900; x += 26 + rnd() * 40) {
      const w = 24 + rnd() * 46, h = 150 + rnd() * 230, top = FLOOR * .9 - h;
      el('rect', { x, y: top, width: w, height: h + 300, fill: rnd() < .5 ? mix(C.panel, C.bg, .5) : mix(C.panel2, C.bg, .6) }, para);
      if (rnd() < .3) el('path', { d: `M${x + w / 2} ${top}v-${10 + rnd() * 22}`, stroke: C.line }, para);
      for (let wy = top + 8; wy < FLOOR * .9 + 20; wy += 9) for (let wx = x + 4; wx < x + w - 3; wx += 7) if (rnd() < .15) el('rect', { x: wx, y: wy, width: 2.2, height: 3, fill: C.line }, para);
      if (rnd() < .28) {
        const sx = x + w - 6, sy = top + 20 + rnd() * 60, word = SKY[Math.floor(rnd() * SKY.length)], g = el('g', {}, para);
        el('rect', { x: sx - 1, y: sy - 4, width: 10, height: word.length * 7 + 6, fill: 'none', stroke: C.t3, 'stroke-width': .8 }, g);
        word.split('').forEach((ch, k) => txt(g, sx + 4, sy + 6 + k * 7, ch, { 'text-anchor': 'middle', 'font-size': 6.5, fill: C.t2 }));
        blink.push({ e: g, ph: rnd() * 6.28, w: .0012 + rnd() * .002 });
      }
    }
    // 데스 스트리밍 비행선 · 촬영 드론 · 모노레일
    const ship = el('g', {}, para);
    el('ellipse', { cx: 0, cy: 0, rx: 74, ry: 17, fill: C.panel2, stroke: C.t3 }, ship);
    el('path', { d: 'M62 -6l18 -10v32l-18 -10ZM-20 15h40l-6 8h-28Z', fill: C.panel2, stroke: C.t3, 'stroke-width': .8 }, ship);
    el('rect', { x: -44, y: -12, width: 76, height: 24, rx: 2, fill: C.bg, stroke: C.t2, 'stroke-width': .8 }, ship);
    const liveDot = el('circle', { cx: -38, cy: -5, r: 2.6, fill: C.bad }, ship);
    txt(ship, -33, -2.5, 'LIVE · DEATH STREAM', { 'font-size': 6.5, fill: C.text });
    const viewers = txt(ship, -38, 8, '', ko({ 'font-size': 6.5, fill: C.t2 }));
    const RAIL = 70, train = el('g', {}, mid);
    el('line', { x1: -400, y1: RAIL, x2: XN * .6 + 1200, y2: RAIL, stroke: C.line, 'stroke-width': 2 }, mid);
    for (let k = 0; k < 4; k++) el('rect', { x: k * 25, y: RAIL - 9, width: 23, height: 8, rx: 2, fill: C.t3 }, train);
    const drone = (p: Element, lab: string, anchor = 'start') => { const g = el('g', {}, p); el('path', { d: 'M-9 -2h18M-7 -2v-2M7 -2v-2M-3 -2h6v5h-6Z', stroke: C.t2, fill: C.t3 }, g); const rec = el('circle', { cx: 0, cy: 5, r: 1.7, fill: C.bad }, g); txt(g, anchor === 'end' ? -12 : 11, 2, lab, ko({ 'font-size': 6.5, fill: C.t2, 'text-anchor': anchor })); return { g, rec }; };
    const drones = [0, 1, 2].map((k) => ({ ...drone(mid, `CAM-0${k + 3}`), x0: rnd() * 1400 - 200, y: 100 + k * 30, v: (k % 2 ? -1 : 1) * (.02 + rnd() * .02), ph: rnd() * 6 }));

    const district = el('g', {}, world), deckG = el('g', {}, world), back = el('g', {}, world), routeG = el('g', {}, world), front = el('g', {}, world);
    // 아래 거리 · 그 아래 단면 (차도 · 배관 · 운행 중지된 지하철 — 전체 화면의 높은 시야에서 보인다)
    { const L = X(0) - 600, R = XN + 700, F = FLOOR;
      el('rect', { x: L, y: F, width: R - L, height: 600, fill: C.panel }, district);
      el('line', { x1: L, y1: F, x2: R, y2: F, stroke: C.t3 }, district);
      el('rect', { x: L, y: F + 1, width: R - L, height: 16, fill: mix(C.panel2, C.bg, .4) }, district);
      el('line', { x1: L, y1: F + 9, x2: R, y2: F + 9, stroke: C.t3, 'stroke-dasharray': '14 12', opacity: .6 }, district);
      el('line', { x1: L, y1: F + 17, x2: R, y2: F + 17, stroke: C.t3, 'stroke-width': 1.4 }, district);
      for (const [dy, w] of [[34, 5], [44, 3], [52, 7]]) el('line', { x1: L, y1: F + dy, x2: R, y2: F + dy, stroke: C.line, 'stroke-width': w }, district);
      for (let x = L + 40; x < R; x += 160 + rnd() * 120) { // 맨홀 · 사다리
        el('rect', { x, y: F + 1, width: 12, height: 3, fill: C.t3 }, district);
        el('path', { d: `M${x + 2} ${F + 17}V${F + 76}M${x + 10} ${F + 17}V${F + 76}`, stroke: C.line }, district);
        for (let k = F + 22; k < F + 76; k += 7) el('line', { x1: x + 2, y1: k, x2: x + 10, y2: k, stroke: C.line, 'stroke-width': .8 }, district);
      }
      const T0 = F + 76, T1 = F + 132;
      el('rect', { x: L, y: T0, width: R - L, height: T1 - T0, fill: C.bg, stroke: C.t3, 'stroke-width': .8 }, district);
      for (let x = L; x < R; x += 46) el('path', { d: `M${x} ${T1}V${T0 + 12}Q${x + 23} ${T0 - 2} ${x + 46} ${T0 + 12}`, fill: 'none', stroke: C.line, 'stroke-width': .8 }, district);
      el('line', { x1: L, y1: T1 - 4, x2: R, y2: T1 - 4, stroke: C.t3, 'stroke-width': 1.2 }, district);
      const tx = X(Math.floor(N / 2));
      for (let k = 0; k < 3; k++) { el('rect', { x: tx - 120 + k * 64, y: T1 - 30, width: 60, height: 24, rx: 3, fill: C.panel2, stroke: C.t3, 'stroke-width': .7 }, district); for (let w = 0; w < 4; w++) el('rect', { x: tx - 114 + k * 64 + w * 14, y: T1 - 25, width: 9, height: 7, fill: C.bg }, district); }
      el('rect', { x: X(1) - 70, y: T0 + 8, width: 140, height: T1 - T0 - 12, fill: C.panel2, stroke: C.t3, 'stroke-width': .7 }, district);
      txt(district, X(1), T0 + 24, '地下鉄 34番駅 · 운행 중지', ko({ 'text-anchor': 'middle', 'font-size': 8, fill: C.t2 }));
      for (let k = 0; k < 7; k++) el('line', { x1: X(1) - 60 + k * 20, y1: T0 + 32, x2: X(1) - 50 + k * 20, y2: T1 - 6, stroke: C.sel, 'stroke-width': 2, opacity: .5 }, district);
      el('rect', { x: L, y: T1, width: R - L, height: 600, fill: mix(C.panel, C.bg, .5) }, district); // 암반
      for (let i = 0; i < 40; i++) el('circle', { cx: L + rnd() * (R - L), cy: T1 + 12 + rnd() * 180, r: 1 + rnd() * 2.5, fill: C.line }, district);
    }
    const SIGNS = ['ラーメン', '質屋', 'IMPLANT', '修理', 'BAR 34', 'カラオケ', '24H', '薬', 'NOODLE', '貸', 'パチ', '整体'];
    const sign = (g: Element, x: number, y: number, w: number, vert = false) => { // 간판 (일부는 지직거림)
      const word = SIGNS[Math.floor(rnd() * SIGNS.length)];
      if (vert) { el('rect', { x, y, width: 10, height: word.length * 7 + 6, fill: C.bg, stroke: C.t3, 'stroke-width': .7 }, g); const t = el('g', {}, g); word.split('').forEach((ch, k) => txt(t, x + 5, y + 9 + k * 7, ch, { 'text-anchor': 'middle', 'font-size': 6.5, fill: C.t2 })); if (rnd() < .6) neon.push({ e: t, ph: rnd() * 6, w: .002 + rnd() * .004, broken: rnd() < .4 }); return; }
      el('rect', { x, y, width: w, height: 9, fill: C.bg, stroke: C.t3, 'stroke-width': .6 }, g);
      const t = txt(g, x + w / 2, y + 7, word, { 'text-anchor': 'middle', 'font-size': 6.5, fill: C.t2 });
      if (rnd() < .5) neon.push({ e: t, ph: rnd() * 6, w: .002 + rnd() * .004, broken: rnd() < .4 });
    };
    const shutter = (g: Element, x: number, y: number, w: number, h: number) => { // 내려진 셔터 (가끔 반쯤 열림 · 출입 금지 테이프)
      el('rect', { x, y, width: w, height: h, fill: mix(C.panel2, C.text, .07), stroke: C.t3, 'stroke-width': .6 }, g);
      for (let yy = y + 3; yy < y + h; yy += 3) el('line', { x1: x + 1, y1: yy, x2: x + w - 1, y2: yy, stroke: C.line, 'stroke-width': .6 }, g);
      if (rnd() < .25) el('rect', { x: x + 1, y: y + h - 5, width: w - 2, height: 5, fill: C.bg }, g);
      if (rnd() < .3) el('path', { d: `M${x} ${y + 3}L${x + w} ${y + h - 3}`, stroke: C.divine, 'stroke-width': 2, 'stroke-dasharray': '5 3', opacity: .7 }, g);
    };
    const trash = (g: Element, x0: number, w: number, y: number) => { for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) el('ellipse', { cx: x0 + rnd() * w, cy: y - 2, rx: 3 + rnd() * 2, ry: 2.4, fill: C.line }, g); };
    let shops = 0;
    for (let x = X(0) - 140; x < XN + 30; x += 64 + rnd() * 50) { // 다층 상가 건물: 2~6층, 높이는 데크와 상관없이 제각각
      const w = 58 + rnd() * 44, fl = 2 + Math.floor(rnd() * 5), FH = 22, top = FLOOR - fl * FH, g = el('g', {}, district);
      el('rect', { x, y: top, width: w, height: FLOOR - top, fill: mix(C.panel2, C.bg, .25), stroke: C.t3, 'stroke-width': .6 }, g);
      for (let f = 1; f < fl; f++) el('line', { x1: x, y1: FLOOR - f * FH, x2: x + w, y2: FLOOR - f * FH, stroke: C.line }, g);
      for (let f = 1; f < fl; f++) for (let wx = x + 5; wx < x + w - 8; wx += 11) { const lit = rnd() < .18; el('rect', { x: wx, y: FLOOR - (f + 1) * FH + 6, width: 7, height: 9, fill: lit ? C.t2 : C.bg, opacity: lit ? .7 : 1 }, g); }
      shutter(g, x + 4, FLOOR - 18, w - 8, 18); sign(g, x + 4, FLOOR - FH + 1, w - 8); shops++;
      if (rnd() < .6) sign(g, x + w - 2, top + 8, 0, true);
      if (rnd() < .5) for (let f = 1; f < fl; f++) el('path', { d: `M${x - 6} ${FLOOR - f * FH}h6M${x - 6} ${FLOOR - f * FH}l6 -${FH}`, stroke: C.t3, 'stroke-width': .7, fill: 'none' }, g); // 비상계단
      if (rnd() < .6) { el('rect', { x: x + w * .6, y: top - 10, width: 12, height: 10, fill: C.panel2, stroke: C.t3, 'stroke-width': .6 }, g); el('path', { d: `M${x + w * .6 + 2} ${top}v-14`, stroke: C.t3 }, g); } // 물탱크
      else el('path', { d: `M${x + 8} ${top}v-${14 + rnd() * 18}`, stroke: C.t3 }, g); // 안테나
      trash(g, x, w, FLOOR);
    }
    // 보행 데크: 계단 · 층계참은 기둥 위 (상가와 높이를 공유하지 않는다)
    const segs: string[] = [], stairs: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (let i = 0; i < N - 1; i++) {
      const x0 = X(i) + LAND, x1 = X(i + 1) - LAND, y0 = Y(i), y1 = Y(i + 1), n = Math.max(2, Math.round(Math.abs(y1 - y0) / 7)), tr = (x1 - x0) / n, rs = (y1 - y0) / n;
      let sg = ` H${x0}`;
      for (let k = 0; k < n; k++) sg += rs < 0 ? ` v${rs.toFixed(2)} h${tr.toFixed(2)}` : ` h${tr.toFixed(2)} v${rs.toFixed(2)}`; // 오를 땐 챌면 먼저, 내릴 땐 디딤면 먼저
      segs.push(sg + ` H${X(i + 1)}`); stairs.push({ x0, x1, y0, y1 });
    }
    const deckD = `M${X(0) - 60} ${Y(0)} H${X(0)}${segs.join('')} H${XN + 60}`;
    for (let i = 0; i < N; i++) for (const dx of [-LAND + 6, LAND - 6]) el('path', { d: `M${X(i) + dx} ${Y(i) + 5}V${FLOOR}`, stroke: C.line, 'stroke-width': 3 }, deckG);
    for (const t of stairs) el('path', { d: `M${(t.x0 + t.x1) / 2} ${(t.y0 + t.y1) / 2 + 6}V${FLOOR}`, stroke: C.line, 'stroke-width': 2 }, deckG);
    el('path', { d: deckD, fill: 'none', stroke: C.panel2, 'stroke-width': 7, 'stroke-linejoin': 'round' }, deckG);
    el('path', { d: deckD, fill: 'none', stroke: C.t2, 'stroke-width': 1.1 }, deckG);
    el('path', { d: deckD, fill: 'none', stroke: C.line, 'stroke-width': .7, transform: 'translate(0 -10)' }, deckG); // 난간
    for (let i = 0; i < N; i++) txt(deckG, X(i), Y(i) + 14, `${lv[i] >= 0 ? '+' : ''}${lv[i] * EL}m`, { 'text-anchor': 'middle', 'font-size': 6.5 });
    // 출발점 앞: 데크 입구 봉쇄 바리케이드 + 아래 거리의 폐쇄된 역 입구 · 자판기 · 경트럭 · 증기
    { const bar = el('g', { transform: `translate(${X(0) - 46} ${Y(0)})` }, front);
      el('rect', { x: -22, y: -14, width: 44, height: 9, fill: C.bg, stroke: C.t2, 'stroke-width': .8 }, bar);
      for (let k = -20; k < 22; k += 7) el('path', { d: `M${k} -5l4 -9`, stroke: C.divine, 'stroke-width': 1.6 }, bar);
      const holo = el('g', {}, bar); el('rect', { x: -40, y: -42, width: 80, height: 18, fill: 'none', stroke: C.bad, 'stroke-width': .9 }, holo);
      txt(holo, 0, -30, 'LOCKDOWN 封鎖 · BLK-34', { 'text-anchor': 'middle', 'font-size': 6.8, fill: C.bad }); neon.push({ e: holo, ph: 0, w: .006, broken: true });
      const g = el('g', {}, district), F = FLOOR, x0 = X(0);
      el('rect', { x: x0 - 250, y: F - 44, width: 96, height: 44, fill: C.panel2, stroke: C.t3, 'stroke-width': .7 }, g);
      el('rect', { x: x0 - 242, y: F - 38, width: 80, height: 10, fill: C.bg }, g); txt(g, x0 - 202, F - 30.5, 'LINE-K 34丁目', { 'text-anchor': 'middle', 'font-size': 6.5, fill: C.t2 });
      shutter(g, x0 - 240, F - 24, 76, 24); txt(g, x0 - 202, F + 10, '역 폐쇄 · 운행 중지', ko({ 'text-anchor': 'middle', 'font-size': 6.5 }));
      for (const vx of [x0 - 146, x0 - 132]) { el('rect', { x: vx, y: F - 26, width: 12, height: 26, fill: C.bg, stroke: C.t3, 'stroke-width': .6 }, g); neon.push({ e: el('rect', { x: vx + 2, y: F - 23, width: 8, height: 9, fill: C.t2 }, g), ph: rnd() * 6, w: .003, broken: vx > x0 - 140 }); }
      el('path', { d: `M${x0 - 108} ${F}v-12l6 -8h20v20M${x0 - 108} ${F - 10}h-12v10`, fill: C.t3, stroke: C.bg, 'stroke-width': .6 }, g);
      el('circle', { cx: x0 - 113, cy: F, r: 3, fill: C.bg }, g); el('circle', { cx: x0 - 90, cy: F, r: 3, fill: C.bg }, g); }
    const steam = [0, 1, 2, 3, 4].map((k) => ({ e: el('circle', { r: 4, fill: C.t3, opacity: 0 }, front), ph: k / 5 }));
    // 전봇대 · 전선 (데크 위)
    const poles: number[][] = [];
    for (let i = 0; i < N - 1; i++) { const x = X(i) + LAND - 5, y = Y(i); el('path', { d: `M${x} ${y}V${y - 46}M${x - 8} ${y - 40}h16`, stroke: C.t3, 'stroke-width': 1.2 }, front); poles.push([x, y - 40]); }
    for (let k = 0; k < poles.length - 1; k++) { const [a, b] = [poles[k], poles[k + 1]]; el('path', { d: `M${a[0]} ${a[1]}Q${(a[0] + b[0]) / 2} ${Math.max(a[1], b[1]) + 16} ${b[0]} ${b[1]}`, fill: 'none', stroke: C.line, 'stroke-width': .8 }, front); }
    // 도리이 (신사로 오르는 마지막 계단) · 여우 신사 (옥상)
    const last = stairs[stairs.length - 1], tn = Math.max(4, Math.round((last.x1 - last.x0) / 11));
    for (let k = 0; k <= tn; k++) { const t = k / tn; torii(back, last.x0 + (last.x1 - last.x0) * t, last.y0 + (last.y1 - last.y0) * t, .66 + .1 * t, k % 2 ? C.t3 : C.t2); }
    el('rect', { x: XN - 20, y: Y(N - 1), width: 150, height: FLOOR - Y(N - 1), fill: mix(C.panel2, C.bg, .2), stroke: C.t3, 'stroke-width': .6 }, district); // 신사를 이고 선 건물
    { const sh = el('g', { transform: `translate(${XN + 64} ${Y(N - 1)})` }, world);
      el('path', { d: 'M-40 -34H40L30 -44H-30Z', fill: C.panel, stroke: C.t2, 'stroke-width': .8 }, sh);
      el('rect', { x: -26, y: -34, width: 52, height: 34, fill: C.bg, stroke: C.t2, 'stroke-width': .8 }, sh);
      el('path', { d: 'M-20 -26h40M-20 -18h40', stroke: C.line }, sh);
      for (const lx of [-34, 34]) { el('path', { d: `M${lx} 0v-10`, stroke: C.t3 }, sh); lanterns.push(el('rect', { x: lx - 3, y: -16, width: 6, height: 7, rx: 1, fill: C.divine, opacity: .7 }, sh)); }
      const FOX = 'M0 0H10V-4Q10 -10 6 -12L7 -18L4 -15L2 -16L1 -19L-1 -14Q-3 -10-2 -4Q-6 -3-7 0Z'; // 앉은 여우 (돌 · 크롬 한 쌍)
      for (const [fx, flip, fill, lab] of [[-50, 1, C.panel, '石 STONE'], [50, -1, C.t2, 'CHROME']] as const) {
        const f = el('g', { transform: `translate(${fx} 0) scale(${flip * 1.2} 1.2)` }, sh);
        el('rect', { x: -2, y: 0, width: 13, height: 4, fill: C.line }, f);
        el('path', { d: FOX, fill, stroke: C.t2, 'stroke-width': .6 }, f);
        txt(sh, fx, -25, lab, { 'text-anchor': 'middle', 'font-size': 6.5 });
      }
      txt(sh, 0, 18, '옥상 稲荷 · 여우 신사', ko({ 'text-anchor': 'middle', 'font-size': 8, fill: C.t2 })); }
    const cam = drone(front, 'CAM-07 · 우리를 생중계 중', 'end');
    const rain = Array.from({ length: 30 }, () => ({ e: el('line', { x1: 0, y1: 0, x2: -3, y2: 9, stroke: C.t3, 'stroke-width': .6, opacity: .55 }, fixed), x: VB[0] + rnd() * (VB[2] + 40), y: VB[1] + rnd() * VB[3], v: .18 + rnd() * .12 }));
    corners(fixed, VB);
    titleBlock(fixed, VB, 'RAIDEN · 제34블록 계단 옆 다층 상가', [`라이덴 제34블록 · 페이즈 ${run.phase}`, `${N} NODES`, `건물 2~6층 · 폐쇄 ${shops}곳`, 'REV.04 · 고저 단면']);
    let mk = [X(0), Y(0)], camP = [X(0), Y(0) - 80];
    const sc = trackRun({
      VB, world, routeLayer: routeG, start: [X(0), Y(0)], segs, pos: (i) => [X(i), Y(i) - 32], look: STEP, follow: .7, midY: .45, para: [[para, .3, .25], [mid, .6, .5]],
      onMarker(p) { mk = [p.x, p.y]; },
      tick(t) {
        for (const b of blink) b.e.setAttribute('opacity', Math.sin(t * b.w + b.ph) > -.6 ? '1' : '.25');
        for (const s of neon) s.e.setAttribute('opacity', s.broken ? (Math.sin(t * .03 + s.ph) > .3 && Math.sin(t * s.w + s.ph) > -.2 ? '1' : '.15') : (.75 + .25 * Math.sin(t * s.w + s.ph)).toFixed(2));
        train.setAttribute('transform', `translate(${(mod(t * .05, XN * .6 + 1500) - 400).toFixed(1)} 0)`);
        ship.setAttribute('transform', `translate(${(mod(t * .012, 1900) - 300).toFixed(1)} ${(46 + 4 * Math.sin(t * .0008)).toFixed(1)})`);
        liveDot.setAttribute('opacity', Math.sin(t * .006) > 0 ? '1' : '.2');
        viewers.textContent = `봉쇄 34블록 · ${(1.2 + .3 * Math.sin(t * .0004)).toFixed(2)}M 시청`;
        for (const d of drones) { d.g.setAttribute('transform', `translate(${(mod(d.x0 + t * d.v, 1700) - 300).toFixed(1)} ${(d.y + 4 * Math.sin(t * .003 + d.ph)).toFixed(1)})`); d.rec.setAttribute('opacity', Math.sin(t * .008 + d.ph) > 0 ? '1' : '.2'); }
        camP = [camP[0] + (mk[0] - 24 - camP[0]) * .04, camP[1] + (mk[1] - 86 - camP[1]) * .04];
        cam.g.setAttribute('transform', `translate(${camP[0].toFixed(1)} ${(camP[1] + 3 * Math.sin(t * .004)).toFixed(1)})`); cam.rec.setAttribute('opacity', Math.sin(t * .008) > 0 ? '1' : '.2');
        for (const s of steam) { const k = mod(t * .0004 + s.ph, 1); s.e.setAttribute('transform', `translate(${(X(0) - 120 + 6 * Math.sin(k * 6)).toFixed(1)} ${(FLOOR - 4 - k * 40).toFixed(1)}) scale(${(.6 + k * 1.6).toFixed(2)})`); s.e.setAttribute('opacity', (.35 * (1 - k)).toFixed(2)); }
        for (const r of rain) { const y = mod(r.y + t * r.v, VB[3] + 20) + VB[1] - 10, x = mod(r.x - (y - VB[1]) * .33, VB[2] + 40) + VB[0] - 20; r.e.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); }
        lanterns.forEach((l, k) => l.setAttribute('opacity', (.5 + .4 * Math.abs(Math.sin(t * .003 + k))).toFixed(2)));
      },
    });
    return {
      ...sc, name: '라이덴 제34블록 봉쇄선',
      legend: [['데크', '계단 · 층계참 = 노드 (기둥 위)'], ['+24m', '층계참 표고'], ['상가', '노드와 별개의 높이 · 셔터 = 폐쇄 점포'], ['노란 사선', '출입 금지 테이프 · 바리케이드'], ['CAM · 비행선', '데스 스트리밍 생중계 (CAM-07 은 우리를 따라옴)'], ['도리이 · 稲荷', '마지막 계단 · 꼭대기 여우 신사']],
    };
  }

  // ── 금고선 히페리온호: 궤도에서 내려다본 유람 금고선. 진행축은 16° 기울어 뱃머리(금고)로 오르고, 노드는 갑판 위 순찰 항로.
  // 현재 위치에 붙은 거리환 · 회전 탐지선이 경비 접촉(GRD)을 쓸고 지나갈 때만 드러내며 서서히 사라진다. 순찰정 2척이 선체를 돌고, 뱃머리 금고는 보호막 13겹
  function patrolScene() {
    const VB = stageBase(narrow ? [180, 10, 440, 430] : [0, 0, 800, 450]);
    const rnd = rng(31 + run.phase), TH = -16 * Math.PI / 180, ax = [Math.cos(TH), Math.sin(TH)], nv = [-Math.sin(TH), Math.cos(TH)], THd = TH * 180 / Math.PI;
    const O = [140, 300], STEP = 182, L2W = (u: number, v: number) => [O[0] + u * ax[0] + v * nv[0], O[1] + u * ax[1] + v * nv[1]];
    const V = (i: number) => (i === 0 || i === N - 1 ? 0 : Math.floor((i + 1) / 2) % 2 ? -32 : 32); // 갑판 위 순찰 항로: 좌현 · 우현을 두 칸씩 번갈아
    const UL = (N - 1) * STEP, P = types.map((_, i) => L2W(i * STEP, V(i)));
    const sky = el('g', {}, stage), world = el('g', {}, stage), fixed = el('g', {}, stage);
    for (let j = 0; j < 260; j++) { const big = rnd() < .1; el('circle', { cx: -400 + rnd() * (UL + 1400), cy: -500 + rnd() * 1200, r: big ? 1 : .55, fill: big ? C.t2 : C.t3 }, sky); }
    // 선체 (위에서): 긴 캡슐 · 갑판 구획 · 구명정 · 수영장 · 헬기장
    const hull = el('g', { transform: `translate(${O[0]} ${O[1]}) rotate(${THd})` }, world);
    el('path', { d: `M-160 -84H${UL + 120}Q${UL + 300} 0 ${UL + 120} 84H-160Q-210 0 -160 -84Z`, fill: C.panel }, hull);
    el('path', { d: `M-130 -60H${UL + 100}Q${UL + 230} 0 ${UL + 100} 60H-130Z`, fill: C.panel2 }, hull);
    for (let u = -100; u < UL; u += STEP / 2) el('line', { x1: u, y1: -60, x2: u, y2: 60, stroke: C.line }, hull);
    for (let u = -120; u < UL + 60; u += 26) for (const v of [-76, 70]) el('rect', { x: u, y: v, width: 18, height: 6, rx: 3, fill: C.line }, hull);
    const pools = [Math.min(3, N - 2), Math.min(7, N - 2)].map((i) => { const u = i * STEP + 70; el('rect', { x: u, y: -14, width: 60, height: 28, rx: 6, fill: mix(C.panel, C.bg, .5) }, hull); return el('ellipse', { cx: u + 30, cy: 0, rx: 4, ry: 2, fill: 'none', stroke: C.t3 }, hull); });
    el('circle', { cx: STEP + 90, cy: 40, r: 16, fill: 'none', stroke: C.line, 'stroke-width': 2 }, hull);
    txt(hull, STEP + 84, 44, 'H', { 'font-size': 10, fill: C.line });
    const vault = el('g', { transform: `translate(${UL + 60} 0)` }, hull);
    for (let k = 13; k >= 1; k--) el('circle', { r: 20 + k * 5, fill: 'none', stroke: k % 4 === 0 ? C.t3 : C.line, 'stroke-width': .8 }, vault);
    el('circle', { r: 18, fill: C.panel2, stroke: C.t2 }, vault);
    { const [x, y] = L2W(UL + 60, -100); txt(world, x, y, 'Ω01–13 · ZODIAC VAULT', { 'font-size': 7, fill: C.t2 }); }
    // 경비 접촉 · 순찰정
    const guards = Array.from({ length: Math.max(4, Math.min(9, N - 3)) }, (_, k) => {
      const g = el('g', {}, world); el('path', { d: 'M0 -3 3 0 0 3-3 0Z', fill: C.t2 }, g); contact(g, `GRD-${pad2(k + 1)}`, -8);
      return { g, u: (1 + k) * STEP + 40 + rnd() * 60, v: (rnd() - .5) * 90, span: 30 + rnd() * 30, w: .0005 + rnd() * .0004, ph: rnd() * 6 };
    });
    const craft = [0, 1].map((k) => { const g = el('g', {}, world), a = el('path', { d: 'M-8 -4 9 0-8 4-5 0Z', fill: C.t2 }, g); txt(g, -8, -9, `PTL-${k + 1}`, { 'font-size': 6.5, fill: C.t2 }); return { g, a, ph: k * Math.PI }; });
    const routeG = el('g', {}, world), rigG = el('g', {}, world), nodeG = el('g', {}, world);
    const rig = sweepRig(rigG, [60, 120, 180], (r) => `${r}m`);
    corners(fixed, VB);
    titleBlock(fixed, VB, 'HYPERION · 부감 순찰 스코프', [`금고선 히페리온호 · 페이즈 ${run.phase}`, `${N} NODES`, `진행축 방위 ${Math.round(90 + THd)}°`, '거리환 60m · HYP-30']);
    let mk = P[cur];
    const sc = trackRun({
      VB, world, routeLayer: routeG, nodeLayer: nodeG, start: P[0], segs: P.slice(1).map((p) => ` L${p[0].toFixed(1)} ${p[1].toFixed(1)}`), pos: (i) => P[i],
      dir: true, line: true, focus: .32, midY: .58, para: [[sky, .2, .2]],
      onMarker(p) { mk = [p.x, p.y]; rig.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); },
      tick(t) {
        const sa = mod(t * .06, 360); rig.set(sa);
        for (const g of guards) { // 탐지선이 지나간 뒤로 서서히 사라진다 (거리환 밖은 흐리게)
          const [x, y] = L2W(g.u + g.span * Math.sin(t * g.w + g.ph), g.v);
          g.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
          const dx = x - mk[0], dy = y - mk[1], lag = mod(sa - mod(Math.atan2(dy, dx) * 180 / Math.PI, 360), 360);
          g.g.setAttribute('opacity', Math.hypot(dx, dy) > 180 ? '.12' : Math.max(.12, 1 - lag / 300).toFixed(2));
        }
        pools.forEach((e, k) => { const q = mod(t * .0007 + k * .5, 1); e.setAttribute('rx', (3 + q * 22).toFixed(1)); e.setAttribute('ry', (2 + q * 10).toFixed(1)); e.setAttribute('opacity', (1 - q).toFixed(2)); });
        for (const c of craft) {
          const pt = (a: number) => L2W(UL / 2 + Math.cos(a) * (UL / 2 + 320), Math.sin(a) * 150), a = t * .00012 + c.ph, [x, y] = pt(a), [x2, y2] = pt(a + .01);
          c.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); c.a.setAttribute('transform', `rotate(${(Math.atan2(y2 - y, x2 - x) * 180 / Math.PI).toFixed(1)})`);
        }
      },
    });
    return {
      ...sc, name: '금고선 히페리온호 · 순찰 스코프',
      legend: [['항로', '갑판 위 순찰 항로 · 지난 구간은 강조색'], ['거리환', '현재 위치 60m 간격 · 탐지선이 돈다'], ['GRD', '경비 접촉 — 탐지선이 쓸 때 드러남'], ['PTL', '선체를 도는 순찰정'], ['Ω01–13', '뱃머리 금고 보호막 13겹 · 보스']],
    };
  }

  // ── 크레타 백원: 대령제 전야의 야간 위성 사진. 들판 = 촛불 점 (정적, 색마다 path 하나), 노드는 위아래로 굽이치는 곡선 항로.
  // 현재 위치의 거리환 · 탐지선이 노드 사이 진형 자리를 쓸고 지나가면 그 자리의 촛불이 어둡게 꺼지고 망령 6기(k.soul 아이콘)가
  // 불투명도만으로 나타났다 사라진다 (아이콘 비율 그대로). 등불 행렬 3줄 · 구름 그림자 · 끝의 불 꺼진 장군 묘 = 레가투스 (보스)
  function vigilScene() {
    const VB = stageBase(narrow ? [180, 10, 440, 430] : [0, 0, 800, 450]);
    const rnd = rng(67 + run.phase), X = (i: number) => 140 + i * 190, Y = (i: number) => (i === N - 1 ? 225 : [225, 150, 150, 300, 300][i % 5]);
    const P = types.map((_, i) => [X(i), Y(i)]), XE = X(N - 1), TB = [XE + 100, 225];
    const SOUL = 'M-6 8V-2a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2zM-2 -2h.01M2 -2h.01'; // ui/synicons.ts 'k.soul' 을 중심 (0,0) 으로
    const soul = (p: Element, d: string, col: string) => el('path', { d, fill: col, 'fill-opacity': .14, stroke: col, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, p);
    const world = el('g', {}, stage), fixed = el('g', {}, stage);
    // 촛불 점: 노드 주변 · 행렬 길 · 세로 고랑 · 묘 자리는 비운다
    let da = '', db = '';
    for (let x = -600; x < XE + 500; x += 14) for (let y = 34; y < 430; y += 14) {
      if (P.some(([px, py]) => Math.abs(x - px) < 36 && Math.abs(y - py) < 36)) continue;
      if ((y > 180 && y < 196) || (y > 254 && y < 270) || mod(x - 140, 95) < 12 || (Math.abs(x - TB[0]) < 60 && Math.abs(y - TB[1]) < 55) || rnd() > .6) continue;
      const q = (rnd() < .3 ? 1.6 : 1).toFixed(1), d = `M${(x + rnd() * 5).toFixed(0)} ${(y + rnd() * 5).toFixed(0)}h${q}v${q}h-${q}z`;
      if (rnd() < .15) db += d; else da += d;
    }
    el('path', { d: da, fill: C.t3, 'fill-opacity': .4 }, world); el('path', { d: db, fill: C.t2, 'fill-opacity': .32 }, world);
    el('rect', { x: TB[0] - 56, y: TB[1] - 50, width: 112, height: 100, fill: C.bg, stroke: C.line }, world);
    const clouds = [0, 1].map((k) => ({ g: el('ellipse', { rx: 200 + k * 40, ry: 60, fill: C.bg, 'fill-opacity': .5 }, world), o: k * 900, y: 120 + k * 170, v: .012 + k * .004 }));
    // 망령 진형 (노드 사이, 곡선 바깥쪽): 어두운 얼룩 + 아이콘 6기 + 이름표
    const ghostG = el('g', {}, world);
    const forms = types.slice(1).map((_, i) => {
      const fx = (X(i) + X(i + 1)) / 2, my = (Y(i) + Y(i + 1)) / 2, fy = my > 225 ? my - 98 : my + 96;
      const g = el('g', { transform: `translate(${fx} ${fy})` }, ghostG);
      const dark = el('ellipse', { rx: 58, ry: 26, fill: C.bg, opacity: 0 }, g);
      const men = el('g', { opacity: 0 }, g);
      for (let k = 0; k < 6; k++) soul(men, SOUL, C.t2).setAttribute('transform', `translate(${(k - 2.5) * 17} ${(k % 2) * 8})`);
      const tag = el('g', { transform: 'translate(-40 -30)', opacity: .1 }, g); contact(tag, `LOCHOS-${pad2(i + 1)}`, 0);
      return { dark, men, tag, fx, fy, r: 0, on: -1 };
    });
    const leg = el('g', { transform: `translate(${TB[0]} ${TB[1]})` }, ghostG), legI = el('g', {}, leg);
    soul(legI, SOUL + 'M10 9V-12M8.5 -9 10 -13 11.5 -9', C.bad).setAttribute('transform', 'scale(2.6)');
    contact(leg, 'LEGATUS · 접수 거부', -70, C.bad);
    const routeG = el('g', {}, world);
    const procs = [0, 1, 2].map((k) => { let d = ''; for (let j = 0; j < 9; j++) d += `M${-j * 6 - 1.2} -1.2h2.4v2.4h-2.4z`; return { g: el('path', { d, fill: C.divine, 'fill-opacity': .55 }, world), y: [188, 262, 188][k], o: k * 800, v: (k % 2 ? -1 : 1) * .012 }; });
    const rigG = el('g', {}, world), nodeG = el('g', {}, world);
    const rig = sweepRig(rigG, [80, 160, 240], (r) => `${Math.round(r / 8) * 5}m`);
    corners(fixed, VB);
    titleBlock(fixed, VB, 'CRETE · 대령제 전야 · 탐지 야경', [`크레타 백원 · 페이즈 ${run.phase}`, `${N} NODES`, '점 = 촛불 · 줄 = 행렬', '사각 = 장군의 묘']);
    let mk = P[cur], sa = 0;
    const sc = trackRun({
      VB, world, routeLayer: routeG, nodeLayer: nodeG, start: P[0], pos: (i) => P[i],
      segs: P.slice(1).map((q, i) => { const p = P[i], mx = (p[0] + q[0]) / 2; return ` C${mx} ${p[1]} ${mx} ${q[1]} ${q[0]} ${q[1]}`; }),
      dir: true, follow: .4, midY: .52,
      onMarker(p) { mk = [p.x, p.y]; rig.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); },
      tick(t) {
        sa = mod(t * .06, 360); rig.set(sa);
        for (const f of forms) { // 탐지선이 쓸고 지난 직후(140° 안)만 켜짐 → 불투명도만 부드럽게 따라감
          const dx = f.fx - mk[0], dy = f.fy - mk[1], on = Math.hypot(dx, dy) < 280 && mod(sa - mod(Math.atan2(dy, dx) * 180 / Math.PI, 360), 360) < 140 ? 1 : 0;
          if (f.on !== on) { f.on = on; f.tag.setAttribute('opacity', on ? '.9' : '.1'); }
          if (!on && f.r < .01) { if (f.r) { f.r = 0; f.dark.setAttribute('opacity', '0'); f.men.setAttribute('opacity', '0'); } continue; }
          f.r += (on - f.r) * .08;
          f.dark.setAttribute('opacity', (.8 * f.r).toFixed(2)); f.men.setAttribute('opacity', (.95 * f.r).toFixed(2));
          f.men.setAttribute('transform', `translate(0 ${(-2 * Math.sin(t * .0012 + f.fx)).toFixed(1)})`); // 제자리에서 아주 작게 떠 있음
        }
        for (const p of procs) p.g.setAttribute('transform', `translate(${(mod(p.o + t * p.v, XE + 800) - 400).toFixed(1)} ${p.y}) scale(${Math.sign(p.v)} 1)`);
        for (const c of clouds) c.g.setAttribute('transform', `translate(${(mod(c.o + t * c.v, XE + 1400) - 600).toFixed(1)} ${c.y})`);
        legI.setAttribute('transform', `translate(0 ${(4 * Math.sin(t * .0012)).toFixed(1)})`);
      },
    });
    return {
      ...sc, name: '크레타 백원 · 탐지 야경',
      legend: [['항로', '굽이치는 곡선 항로 · 지난 구간은 강조색'], ['거리환', '현재 위치 50m 간격 · 탐지선이 돈다'], ['LOCHOS', '망령 진형 — 탐지선이 쓸면 촛불이 꺼지고 나타남'], ['등불 행렬', '대령제 순례 행렬'], ['LEGATUS', '불 꺼진 장군의 묘 · 보스']],
    };
  }

  // ── 카운티폴 세피아 교외: 등각으로 내려다본 계획 도시. 같은 크기 구획 · 직각 가로망 · 표준 주택, 항로는 내비 경로처럼 안내된다
  // (왼쪽 위 회전 안내 · 아래 진행 막대). 노드는 일정한 높이에 띄운 핀 (줄기 · 땅 위 고리 · 아래 화살촉). 카메라는 첫 노드 → 보스 직선 위로만
  function gridScene() {
    const VB = stageBase(narrow ? [180, 30, 440, 400] : [0, 0, 800, 450]);
    const rnd = rng(54 + run.phase), rr = rng(58 + run.phase), SZ = 26, OX = 150, OY = 205, M_PER = 20, PIN = 58; // 격자 1칸 = 20m (구획 3칸 = 60m)
    const iso = (gx: number, gy: number, z = 0) => [OX + (gx - gy) * SZ * .866, OY + (gx + gy) * SZ * .5 - z];
    const world = el('g', {}, stage), sky = el('g', {}, stage), fixed = el('g', {}, stage);
    const ground = el('g', {}, world), routeG = el('g', {}, world), bldg = el('g', {}, world), over = el('g', {}, world); // 안내 경로는 땅 위 · 집 아래 (앞에 선 집 지붕에 가려진다), 핀 · 표시기는 집 위 (늘 보이게)
    const poly = (a: number[][], fill: string, stroke?: string, p: Element = bldg) => el('polygon', { points: pts(a), fill, stroke: stroke || 'none', 'stroke-width': .6 }, p);
    /** 교외 격자: 땅 · 도로 (3칸마다) · 집 · 공원 · 행정 구역 (보스 노드 옆 구획). diag = 구획을 가로지르는 대각 도로 (격자 좌표 두 점) —
     *  지나는 구획은 도로를 따라 잘린 택지가 된다 (도로에서 떨어진 모서리에만 집, 도로 양옆은 가로수) */
    const city = (gx0: number, gx1: number, gy0: number, gy1: number, civ: number[], diag: number[][][] = []) => {
      poly([iso(gx0, gy0), iso(gx1, gy0), iso(gx1, gy1), iso(gx0, gy1)], C.panel, undefined, ground);
      for (let g = gx0; g <= gx1; g += 3) poly([iso(g - .3, gy0), iso(g + .3, gy0), iso(g + .3, gy1), iso(g - .3, gy1)], C.panel2, undefined, ground);
      for (let g = gy0; g <= gy1; g += 3) poly([iso(gx0, g - .3), iso(gx1, g - .3), iso(gx1, g + .3), iso(gx0, g + .3)], C.panel2, undefined, ground);
      const items0: { k: number; f(): void }[] = [];
      const cutB = new Set<string>(), dmin = (x: number, y: number) => Math.min(9, ...diag.map(([a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y); }));
      const inLot = (v: number) => { const f = mod(v, 3); return f > .45 && f < 2.55; }; // 구획 안쪽 (둘레 도로 위가 아닌 곳)
      const verge: number[][] = [];
      for (const [a, b] of diag) {
        const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / n, uy = (b[1] - a[1]) / n;
        for (let q = 0; q <= 60; q++) { const x = a[0] + (b[0] - a[0]) * q / 60, y = a[1] + (b[1] - a[1]) * q / 60; if (inLot(x) || inLot(y)) cutB.add(`${Math.floor((x - gx0) / 3)},${Math.floor((y - gy0) / 3)}`); }
        poly([iso(a[0] - uy * .3, a[1] + ux * .3), iso(b[0] - uy * .3, b[1] + ux * .3), iso(b[0] + uy * .3, b[1] - ux * .3), iso(a[0] + uy * .3, a[1] - ux * .3)], C.panel2, undefined, ground); // 대각 도로 (격자 도로와 같은 폭)
        for (let d = .5; d < n - .3; d += .85) for (const sd of [1, -1]) { const x = a[0] + ux * d - uy * .7 * sd, y = a[1] + uy * d + ux * .7 * sd; if (inLot(x) && inLot(y) && dmin(x, y) > .6) verge.push([x, y]); } // 가로수
      }
      for (const [tx, ty] of verge) items0.push({ k: tx + ty, f: () => { const [x, y] = iso(tx, ty); el('rect', { x: x - 1, y: y - 4, width: 2, height: 4, fill: C.t3 }, bldg); el('path', { d: `M${x - 6} ${y - 4}a3.4 3.4 0 0 1 .6 -5.6a4.4 4.4 0 0 1 8 -1.6a3.6 3.6 0 0 1 3.4 5.4a3 3 0 0 1 -2.4 1.8Z`, fill: C.line }, bldg); } });
      const isoBox = (x: number, y: number, w: number, d: number, h: number) => {
        const a = iso(x, y + d), b = iso(x + w, y + d), c = iso(x + w, y), A = iso(x, y + d, h), B = iso(x + w, y + d, h), Cc = iso(x + w, y, h), D = iso(x, y, h);
        poly([a, b, B, A], C.panel2, C.line); poly([b, c, Cc, B], mix(C.panel2, C.bg, .3), C.line); poly([A, B, Cc, D], C.line, C.line);
      };
      const isoHouse = (x: number, y: number) => {
        const w = .8, d = .7, h = 10, rh = 8;
        const a = iso(x, y + d), b = iso(x + w, y + d), c = iso(x + w, y), A = iso(x, y + d, h), B = iso(x + w, y + d, h), Cc = iso(x + w, y, h), D = iso(x, y, h);
        poly([a, b, B, A], C.panel2, C.line); poly([b, c, Cc, B], mix(C.panel2, C.bg, .35), C.line);
        const R1 = iso(x, y + d / 2, h + rh), R2 = iso(x + w, y + d / 2, h + rh);
        poly([A, B, R2, R1], C.t3, C.line); poly([D, Cc, R2, R1], mix(C.t3, C.bg, .3), C.line);
      };
      const items = items0;
      for (let bx = gx0; bx < gx1; bx += 3) for (let by = gy0; by < gy1; by += 3) {
        if (bx === civ[0] && by === civ[1]) { items.push({ k: bx + by + 3, f: () => { isoBox(bx + .6, by + .6, 1.8, 1.8, 30); const [x, y] = iso(bx + 1.5, by + 1.5, 46); txt(bldg, x, y, 'CIV-01 행정 구역', ko({ 'text-anchor': 'middle', 'font-size': 7, fill: C.t2 })); } }); continue; }
        if (cutB.has(`${(bx - gx0) / 3},${(by - gy0) / 3}`)) { // 대각 도로가 지나는 구획: 잘린 택지 — 도로에서 떨어진 자리에만 집, 집이 못 들어가는 자투리 땅은 나무
          const homes: number[][] = [];
          for (const dx of [.4, 1.15, 1.9]) for (const dy of [.4, 1.15, 1.9]) if (dmin(bx + dx + .4, by + dy + .35) > .95) { homes.push([bx + dx + .4, by + dy + .35]); items.push({ k: bx + dx + by + dy + 1.5, f: () => isoHouse(bx + dx, by + dy) }); }
          for (let q = 0; q < 10; q++) {
            const tx = bx + .55 + rnd() * 1.9, ty = by + .55 + rnd() * 1.9, round = rnd() < .55;
            if (dmin(tx, ty) < .62 || homes.some(([hx, hy]) => Math.abs(hx - tx) < .7 && Math.abs(hy - ty) < .65)) continue;
            items.push({ k: tx + ty, f: () => {
              const [x, y] = iso(tx, ty);
              el('rect', { x: x - 1, y: y - 4, width: 2, height: 4, fill: C.t3 }, bldg);
              if (round) el('path', { d: `M${x - 6} ${y - 4}a3.4 3.4 0 0 1 .6 -5.6a4.4 4.4 0 0 1 8 -1.6a3.6 3.6 0 0 1 3.4 5.4a3 3 0 0 1 -2.4 1.8Z`, fill: C.line }, bldg);
              else el('path', { d: `M${x - 5.5} ${y - 3}L${x - 2} ${y - 8}H${x - 4}L${x} ${y - 16}L${x + 4} ${y - 8}H${x + 2}L${x + 5.5} ${y - 3}Z`, fill: C.line }, bldg);
            } });
          }
          continue;
        }
        if (rnd() < .1) { // 공원: 나무 (짧은 줄기 + 단색 수관 — 둥근 활엽수 · 두 단 침엽수)
          const trees = Array.from({ length: 7 }, () => [bx + .5 + rnd() * 2, by + .5 + rnd() * 2, rnd() < .55 ? 1 : 0]).sort((a, b) => a[0] + a[1] - b[0] - b[1]);
          for (const [tx, ty, round] of trees) items.push({ k: tx + ty, f: () => {
            const [x, y] = iso(tx, ty);
            el('rect', { x: x - 1, y: y - 4, width: 2, height: 4, fill: C.t3 }, bldg);
            if (round) el('path', { d: `M${x - 6} ${y - 4}a3.4 3.4 0 0 1 .6 -5.6a4.4 4.4 0 0 1 8 -1.6a3.6 3.6 0 0 1 3.4 5.4a3 3 0 0 1 -2.4 1.8Z`, fill: C.line }, bldg);
            else el('path', { d: `M${x - 5.5} ${y - 3}L${x - 2} ${y - 8}H${x - 4}L${x} ${y - 16}L${x + 4} ${y - 8}H${x + 2}L${x + 5.5} ${y - 3}Z`, fill: C.line }, bldg);
          } });
          continue;
        }
        for (const [dx, dy] of [[.55, .55], [1.55, .55], [.55, 1.55], [1.55, 1.55]]) items.push({ k: bx + dx + by + dy + 1.5, f: () => isoHouse(bx + dx, by + dy) }); // 집 그리는 순서 = 앞 모서리 (x + 0.8, y + 0.7) 깊이 — 뒤에 선 나무가 집 위에 그려지지 않게;
      }
      items.sort((p, q) => p.k - q.k).forEach((h) => h.f());
    };
    // 핀: 토큰 아래 줄기 · 아래를 가리키는 화살촉 · 땅 위 고리
    const pin = (gx: number, gy: number) => {
      const [x, y] = iso(gx, gy), g = el('g', {}, over);
      el('line', { x1: x, y1: y - PIN + 21, x2: x, y2: y - 7, stroke: C.t2, 'stroke-width': 1.2 }, g);
      el('path', { d: `M${x - 4} ${y - 11}L${x} ${y - 5}L${x + 4} ${y - 11}`, fill: 'none', stroke: C.t2, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      el('ellipse', { cx: x, cy: y, rx: 9, ry: 5, fill: 'none', stroke: C.t2, 'stroke-width': 1.2 }, g);
      return g;
    };
    const ST = ['너도밤나무로', '느릅나무로', '단풍나무로', '중앙대로', '참나무로', '자작나무로', '버드나무로'];
    const meters = (s: number) => Math.round(s / SZ * M_PER);
    const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.max(0, Math.round(m / 10) * 10)}m`);
    // 차 · 비행기 (그림자) · 흐르는 진행 화살표 (남은 경로 위)
    const carsIn = (gx0: number, gx1: number, gy0: number, gy1: number, n: number) => Array.from({ length: n }, () => { const g = el('g', {}, bldg); el('rect', { x: -4, y: -2.5, width: 8, height: 5, rx: 1.5, fill: C.t2 }, g); return { g, along: rnd() < .6, lane: (Math.floor(rnd() * ((gy1 - gy0) / 3)) + gy0 / 3) * 3, cross: (Math.floor(rnd() * ((gx1 - gx0) / 3)) + gx0 / 3) * 3, o: rnd() * 40, v: (rnd() < .5 ? 1 : -1) * .0016, gx0, gx1, gy0, gy1 }; });
    type Car = ReturnType<typeof carsIn>[number];
    const moveCars = (cars: Car[], t: number) => { for (const c of cars) { const p = c.along ? iso(mod(c.o + t * c.v, c.gx1 - c.gx0) + c.gx0, c.lane + .15) : iso(c.cross + .15, mod(c.o + t * c.v, c.gy1 - c.gy0) + c.gy0); c.g.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${c.along ? 30 : -30})`); } };
    const PL = 'M14 0L4 -2L-2 -12H-5L-1 -2H-9L-12 -6H-14L-12 0L-14 6H-12L-9 2H-1L-5 12H-2L4 2Z';
    const shadow = el('path', { d: PL, fill: C.line, opacity: .5 }, sky), plane = el('path', { d: PL, fill: C.t2 }, sky);
    const flyPlane = (t: number) => {
      const k = mod(t, 22000) / 22000, px = VB[0] - 60 + k * (VB[2] + 160), py = VB[1] + VB[3] * .82 - k * VB[3] * .6; // 22초마다 한 번, 화면을 비스듬히
      plane.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(-28)`);
      shadow.setAttribute('transform', `translate(${(px + 26).toFixed(1)} ${(py + 34).toFixed(1)}) rotate(-28)`);
    };
    const flow = Array.from({ length: 16 }, () => el('path', { d: 'M-3 -3 1 0-3 3', fill: 'none', stroke: C.bg, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, over));
    // 헤드업 안내: 왼쪽 위 회전 안내 (화살표 · 남은 거리 · 길 이름), 아래 진행 막대 (다음 노드 · 보스까지)
    const ARROW = { R: 'M-5 9V1Q-5 -5 1 -5H6M2 -9 6 -5 2 -1', L: 'M5 9V1Q5 -5 -1 -5H-6M-2 -9 -6 -5 -2 -1', F: 'M-4 9V-9M-4 -9H6L3 -5 6 -1H-4' };
    const L0 = VB[0] + 14, hud = el('g', { transform: `translate(${L0} ${VB[1] + 46})` }, fixed);
    el('rect', { width: 196, height: 70, rx: 8, fill: C.panel, stroke: C.line }, hud);
    el('rect', { x: 8, y: 8, width: 54, height: 54, rx: 6, fill: C.info }, hud);
    const arrow = el('path', { d: ARROW.F, fill: 'none', stroke: C.bg, 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: 'translate(35 35) scale(2)' }, hud);
    const dist = txt(hud, 72, 32, '', { 'font-size': 20, fill: C.text, 'font-weight': 700 });
    const road = txt(hud, 72, 52, '', ko({ 'font-size': 10, fill: C.t2 }));
    const BW = 250, bar = el('g', { transform: `translate(${L0} ${VB[1] + VB[3] - (narrow ? 46 : 92)})` }, fixed);
    el('rect', { width: BW, height: 40, rx: 8, fill: C.panel, stroke: C.line }, bar);
    const b1 = txt(bar, 10, 16, '', ko({ 'font-size': 9.5, fill: C.text })), b2 = txt(bar, 10, 31, '', ko({ 'font-size': 8.5, fill: C.t2 }));
    el('rect', { x: 0, y: 37, width: BW, height: 3, fill: C.line }, bar);
    const pb = el('rect', { x: 0, y: 37, width: 0, height: 3, fill: C.info }, bar);
    corners(fixed, VB);
    if (run.links) return gridBranch();

    const rows: number[] = []; // 노드마다 가로 몇 줄 위 · 아래로 꺾이는가 (보스는 첫 노드와 같은 줄)
    for (let i = 0, x = 0; i < N; i++) { if (i === N - 1) x = 0; else if (i && rr() < .7) x = Math.max(-2, Math.min(2, x + (rr() < .5 ? -1 : 1))); rows.push(x); }
    const GX = (i: number) => i * 3, GY = (i: number) => rows[i] * 3;
    const gx0 = -6, gx1 = GX(N - 1) + 8, gy0 = -9, gy1 = 9;
    city(gx0, gx1, gy0, gy1, [GX(N - 1), -6]);
    // 경유점 (격자) → 화면 경로 · 회전 안내
    type Wp = { gx: number; gy: number; node?: number; x: number; y: number; s: number };
    const wps: Wp[] = [];
    for (let i = 0; i < N; i++) { wps.push({ gx: GX(i), gy: GY(i), node: i, x: 0, y: 0, s: 0 }); if (i < N - 1) { wps.push({ gx: GX(i) + 1.5, gy: GY(i), x: 0, y: 0, s: 0 }); wps.push({ gx: GX(i) + 1.5, gy: GY(i + 1), x: 0, y: 0, s: 0 }); } }
    let acc = 0;
    wps.forEach((w, k) => { [w.x, w.y] = iso(w.gx, w.gy); if (k) acc += Math.hypot(w.gx - wps[k - 1].gx, w.gy - wps[k - 1].gy) * SZ; w.s = acc; });
    const turns: { s: number; dir: 'R' | 'L'; street: string }[] = [];
    for (let k = 1; k < wps.length - 1; k++) {
      const a = wps[k - 1], b = wps[k], c = wps[k + 1], ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
      if (Math.hypot(ux, uy) < 1 || Math.hypot(vx, vy) < 1) continue;
      const cr = ux * vy - uy * vx;
      if (Math.abs(cr) < 1) continue;
      const street = Math.abs(c.gy - b.gy) > .1 ? `AVE ${String.fromCharCode(65 + Math.round((b.gx - gx0) / 3))}` : ST[Math.max(0, Math.min(6, Math.round(b.gy / 3) + 3))];
      turns.push({ s: b.s, dir: cr > 0 ? 'R' : 'L', street });
    }
    const segs: string[] = []; { let buf = ''; for (let k = 1; k < wps.length; k++) { buf += ` L${wps[k].x.toFixed(1)} ${wps[k].y.toFixed(1)}`; if (wps[k].node != null) { segs.push(buf); buf = ''; } } }
    types.forEach((_, i) => pin(GX(i), GY(i)));
    const cars = carsIn(gx0, gx1, -9, 9, 14);
    titleBlock(fixed, VB, 'COUNTYFALL · 세피아 교외 길 안내', [`카운티폴 세피아 교외 · 페이즈 ${run.phase}`, `${N} NODES`, '표준 주택 모듈 R-1', `격자 1칸 ${M_PER}m · 회전 ${turns.length}곳`]);
    let route: SVGGeometryElement | null = null, total = 0, S: number[] = [], sp = 0;
    const sc = trackRun({
      VB, world, routeLayer: routeG, nodeLayer: over, start: [wps[0].x, wps[0].y], segs, pos: (i) => { const p = iso(GX(i), GY(i)); return [p[0], p[1] - PIN]; },
      dir: true, line: true, focus: .4, midY: .5,
      casing: { stroke: C.bg, 'stroke-width': 11 }, routeAttr: { stroke: C.info, 'stroke-width': 5.5, 'stroke-dasharray': null }, doneAttr: { stroke: C.t3, 'stroke-width': 5.5 },
      onRoute(r, tot, s) { route = r; total = tot; S = s; },
      onMarker(_p, s) {
        sp = s;
        const m = turns.find((x) => x.s > s + 1), dm = m ? meters(m.s - s) : meters(total - s);
        arrow.setAttribute('d', ARROW[m ? m.dir : 'F']);
        dist.textContent = fmtM(dm); road.textContent = m ? `${m.street} 방면 ${m.dir === 'R' ? '우회전' : '좌회전'}` : '목적지 · 행정 구역';
        let ni = N - 1; for (let i = 0; i < N; i++) if (S[i] > s + 1) { ni = i; break; }
        const left = meters(total - s);
        b1.textContent = `다음 · N${pad2(ni + 1)} ${NODE_NAME[types[ni]]} ${fmtM(meters(S[ni] - s))}`;
        b2.textContent = `보스까지 ${fmtM(left)} · 도착 예정 ${Math.max(1, Math.round(left / 500))}분 (30km/h)`;
        pb.setAttribute('width', (BW * s / (total || 1)).toFixed(1));
      },
      tick(t) {
        moveCars(cars, t); flyPlane(t);
        if (!route) return;
        for (let j = 0; j < flow.length; j++) {
          const s = sp + 12 + mod(t * .03, 22) + j * 22;
          if (s >= total) { flow[j].setAttribute('opacity', '0'); continue; }
          const p = route.getPointAtLength(s), q = route.getPointAtLength(Math.min(total, s + 2));
          flow[j].setAttribute('opacity', '.9'); flow[j].setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI).toFixed(1)})`);
        }
      },
    });
    return {
      ...sc, name: '카운티폴 세피아 교외',
      legend: [['파란 길', '남은 경로 (흐르는 화살표 = 진행 방향)'], ['회색 길', '지나온 경로'], ['핀', '노드 자리 (땅 위 고리가 정확한 지점)'], ['회전 안내', '다음 회전 · 남은 거리 (격자 1칸 20m)'], ['CIV-01', '행정 구역 · 보스'], ['나무', '공원 구획']],
    };

    /** 분기 항로 (교외 격자): 칸 사이 = 2구획 (6칸), 갈래 사이 = 2구획. 갈래 = 나란한 도로, 같은 갈래 연결선 = 도로를 따라 직진,
     *  옆 갈래 연결선 = 도로를 따라 꺾는 길 또는 구획을 비스듬히 가르는 대각 도로 (지나는 구획은 도로를 따라 잘린 택지 · 자투리는 나무). 지나온 길 = 회색 굵은 길, 고른 노드에서 이어지는 길 = 파란 안내 경로, 갈 수 있는 다른 길 = 옅게 */
    function gridBranch() {
      const R = run.map.length, D = 6, LG = 6;
      const GXb = (i: number) => i * D, GYb = (i: number, j: number) => (j - (run.map[i].length - 1) / 2) * LG;
      const gx0 = -6, gx1 = GXb(R - 1) + 9, gy0 = -12, gy1 = 12;
      // 연결선 모양: 같은 줄 = 직진. 옆 갈래 = 도로를 따라 꺾는 길 또는 구획을 비스듬히 가르는 대각 도로 — 한 노드에서 옆으로 갈라지는 길이 둘이면 하나씩 (두 갈래 = 꺾기 + 대각, 세 갈래 = 직진 · 꺾기 + 대각),
      //   하나뿐이면 곧은 갈래가 따로 있을 때 대각, 아니면 무작위
      const shape = new Map<string, 'line' | 'turn' | 'diag'>(), diag: number[][][] = [];
      for (let i = 0; i < R - 1; i++) run.map[i].forEach((_, j) => {
        const kids = run.links![i]?.[j] || [], side = kids.filter((k) => Math.abs(GYb(i + 1, k) - GYb(i, j)) > .1), first = rr() < .5 ? 'turn' : 'diag';
        for (const k of kids) {
          const n = side.indexOf(k), sh = n < 0 ? 'line' : side.length >= 2 ? (n % 2 ? (first === 'turn' ? 'diag' : 'turn') : first) : side.length < kids.length ? 'diag' : rr() < .5 ? 'diag' : 'turn';
          shape.set(`${i},${j},${k}`, sh);
          if (sh === 'diag') diag.push([[GXb(i), GYb(i, j)], [GXb(i + 1), GYb(i + 1, k)]]);
        }
      });
      city(gx0, gx1, gy0, gy1, [GXb(R - 1), -6], diag);
      const pins = run.map.map((row, i) => row.map((_, j) => pin(GXb(i), GYb(i, j))));
      const casingG = el('g', {}, routeG), edgeG = el('g', {}, routeG);
      const cars = carsIn(gx0, gx1, gy0, gy1, 24);
      const fwd = (() => { const a = iso(0, 0), b = iso(1, 0), n = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / n, (b[1] - a[1]) / n]; })();
      const puck = el('g', {}, over);
      el('circle', { r: 9, fill: C.info, stroke: C.bg, 'stroke-width': 2.5 }, puck);
      const puckDir = el('path', { d: 'M-4 -4.5 6 0-4 4.5-1.5 0Z', fill: C.bg }, puck);
      titleBlock(fixed, VB, 'COUNTYFALL · 세피아 교외 길 안내', [`세피아 교외 · 페이즈 ${run.phase}`, `${R} ROWS · 2구획 간격`, '표준 주택 모듈 R-1', `격자 1칸 ${M_PER}m · 대각 도로 ${diag.length}곳`]);
      /** 연결선 (i, j) → (i+1, k) 의 길 안내: 꺾는 길 = 1구획 가서 AVE 로 꺾고 다음 칸 줄에서 다시 꺾는다, 대각 도로 = 비스듬히 (bear), 직진 */
      type Turn = { s: number; dir: 'R' | 'L'; street: string };
      const side = (p: number[], q: number[], r: number[]): 'R' | 'L' => ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) > 0 ? 'R' : 'L');
      const legs = (i: number, j: number, k: number) => {
        const ga = GXb(i), ya = GYb(i, j), yb = GYb(i + 1, k), sh = shape.get(`${i},${j},${k}`) || 'line';
        if (sh === 'line') return { len: D, bear: null, turns: [] as Turn[] };
        if (sh === 'diag') return { len: Math.hypot(D, yb - ya), bear: side(iso(ga - 1, ya), iso(ga, ya), iso(ga + D, yb)), turns: [] as Turn[] };
        const a = iso(ga, ya), b = iso(ga + 3, ya), c = iso(ga + 3, yb), d = iso(ga + D, yb);
        return { len: D + Math.abs(yb - ya), bear: null, turns: [{ s: 3, dir: side(a, b, c), street: `AVE ${String.fromCharCode(65 + Math.round((ga + 3 - gx0) / 3))}` }, { s: 3 + Math.abs(yb - ya), dir: side(b, c, d), street: ST[Math.max(0, Math.min(6, Math.round(yb / 3) + 3))] }] as Turn[] };
      };
      let shipEdge: { i: number; j: number; k: number; pts: number[][] } | null = null, shipT = 0;
      const kit = branchKit({
        name: '카운티폴 세피아 교외',
        legend: [['파란 길', '고른 노드에서 이어지는 길 (점선 = 지금 고른 다음 구간 · 흐르는 화살표 = 진행 방향)'], ['회색 굵은 길', '지나온 길'], ['옅은 길', '갈 수 있는 다른 길'], ['옆 갈래', '교차로에서 꺾는 길 또는 구획을 비스듬히 가르는 대각 도로 (양옆 가로수)'], ['핀', '노드 자리 (땅 위 고리가 정확한 지점)'], ['회전 안내', '다음 회전 · 남은 거리 (격자 1칸 20m)'], ['CIV-01', '행정 구역 · 보스'], ['나무', '공원 구획']],
        edgeLayer: edgeG, casingLayer: casingG, nodeLayer: over, casing: 5,
        nodeAt: (i, j) => { const p = iso(GXb(i), GYb(i, j)); return [p[0], p[1] - PIN]; },
        dirAt: () => fwd,
        edgePts(i, j, k) {
          const ga = GXb(i), ya = GYb(i, j), yb = GYb(i + 1, k);
          return shape.get(`${i},${j},${k}`) === 'turn' ? [iso(ga, ya), iso(ga + 3, ya), iso(ga + 3, yb), iso(ga + D, yb)] : [iso(ga, ya), iso(ga + D, yb)]; // 꺾는 길 · 대각 도로 (같은 줄은 직진)
        },
        style: { taken: [C.t3, 5.5, 1, ''], toPick: [C.info, 5.5, 1, '9 6'], mine: [C.info, 4.5, .9, ''], alt: [C.t2, 3, .5, ''], none: [C.line, 2, .45, '2 5'] },
        camU: (x, y) => ((x - OX) / (SZ * .866) + (y + PIN - OY) / (SZ * .5)) / 2, camRange: [-2, GXb(R - 1) + 2], ahead: [1, 1.5], camEps: .3, dragPer: SZ * .866,
        drawCam(u) { const P = iso(u, 0, PIN * .5); world.setAttribute('transform', `translate(${(VB[0] + VB[2] / 2 - P[0]).toFixed(1)} ${(VB[1] + VB[3] / 2 - P[1]).toFixed(1)})`); },
        marker(x, y, a, ed, t) {
          puck.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); puckDir.setAttribute('transform', `rotate(${(a * 180 / Math.PI).toFixed(1)})`);
          shipEdge = ed; shipT = t;
          // 길 안내: 이 연결선에서 다음 회전 · 남은 거리, 다음 노드 · 보스까지
          if (!ed) { arrow.setAttribute('d', ARROW.F); dist.textContent = '출발'; road.textContent = `N01 ${NODE_NAME[run.map[0][0]]}`; b1.textContent = ''; b2.textContent = ''; pb.setAttribute('width', '0'); return; }
          const g = legs(ed.i, ed.j, ed.k), s = t * g.len, nt = run.map[ed.i + 1][ed.k], m = g.turns.find((x) => x.s > s + .05);
          arrow.setAttribute('d', ARROW[m ? m.dir : g.bear || 'F']);
          dist.textContent = fmtM(((m ? m.s : g.len) - s) * M_PER);
          road.textContent = m ? `${m.street} 방면 ${m.dir === 'R' ? '우회전' : '좌회전'}` : `${g.bear ? `대각 도로 ${g.bear === 'R' ? '오른쪽' : '왼쪽'}` : '직진'} · N${pad2(ed.i + 2)} ${NODE_NAME[nt]}`;
          const left = ((R - 2 - ed.i) * D + g.len - s) * M_PER;
          b1.textContent = `다음 · N${pad2(ed.i + 2)} ${NODE_NAME[nt]} ${fmtM((g.len - s) * M_PER)}`;
          b2.textContent = `보스까지 ${fmtM(left)} · 도착 예정 ${Math.max(1, Math.round(left / 500))}분 (30km/h)`;
          pb.setAttribute('width', (BW * Math.min(1, (ed.i + t) / (R - 1))).toFixed(1));
        },
        nodeState(i, j, kind) { pins[i][j].style.opacity = kind === 'gone' ? '.22' : kind === 'alt' ? '.6' : '1'; },
        tick(t) {
          moveCars(cars, t); flyPlane(t);
          // 흐르는 진행 화살표: 표시기가 있는 연결선의 남은 구간
          const pts0 = shipEdge?.pts;
          const seg = pts0 ? pts0.slice(1).map((b, q) => Math.hypot(b[0] - pts0[q][0], b[1] - pts0[q][1])) : [], tot = seg.reduce((a, b) => a + b, 0);
          for (let j = 0; j < flow.length; j++) {
            const d0 = shipT * tot + 12 + mod(t * .03, 22) + j * 22;
            if (!pts0 || d0 >= tot) { flow[j].setAttribute('opacity', '0'); continue; }
            let d = d0, q = 0; while (q < seg.length - 1 && d > seg[q]) { d -= seg[q]; q++; }
            const a = pts0[q], b = pts0[q + 1], r = seg[q] ? d / seg[q] : 0;
            flow[j].setAttribute('opacity', '.9'); flow[j].setAttribute('transform', `translate(${(a[0] + (b[0] - a[0]) * r).toFixed(1)} ${(a[1] + (b[1] - a[1]) * r).toFixed(1)}) rotate(${(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI).toFixed(1)})`);
          }
        },
      });
      return kit;
    }
  }
}
