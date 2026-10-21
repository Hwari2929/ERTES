// 지도 화면 항로도 (전술 스코프): 리빈 낙원동 = 구체 내벽 회전, 베르타–산노디스 물류망 = 대각 진행 원 궤도,
// 라이덴 제34블록 = 고저 단면 (기둥 위 보행 데크 · 아래 거리의 다층 상가 · 여우 신사), 카운티폴 세피아 교외 = 등각 교외 길 안내 (핀 · 헤드업 내비).
// 시안: claude.ai 아티팩트 '전장별 항로 시안' (리빈 = 스코프, 물류망 = 스코프 · 대각, 라이덴 = ① 다층 상가, 카운티폴 = A′-2 핀).
// 렌더마다 화면이 통째로 다시 그려지므로, 항로도 DOM 은 이 모듈이 들고 있다가 자리(.rmap-host)에 다시 끼운다.
// 그래서 진행(노드 완료 뒤 지도로 돌아옴)마다 끝낸 노드가 옅어지고 다음 노드가 밝아지는 전환을 이어서 보여 줄 수 있다.
// 조작: 가로로 끌기 · 가로 휠 = 항로만 이동 (페이지는 그대로), 세로로 끄는 터치 = 페이지 스크롤. 전체 화면 = 넓은 시야 + 노드 목록 · 범례 패널.
import { NODE_NAME, type NodeType, type RunState } from '../types';
import { lineIcon } from './synicons';

const FIELDS = { livin: 'ring', swarm: 'orbit', raiden: 'stairs', county: 'grid' } as const;
type Kind = (typeof FIELDS)[keyof typeof FIELDS];
const CODE: Partial<Record<NodeType, string>> = { supply: 'SUP', battle: 'BTL', council: 'CNL', event: 'EVT', shop: 'BRN', adversity: 'ADV', boss: 'BOS', recruit: 'RCT', fork: 'FRK', news: 'NWS', invest: 'INV', pilgrim: 'PLG', challenge: 'CHL', maint: 'MNT' };
// 프리버드(공룡) 실루엣 — 오른쪽을 보고 발이 y=0
const DINO = {
  sauro: 'M-14 -3Q-9 -5-5 -8Q0 -10 5 -8L9 -15Q10 -17 13 -16L13 -15L10 -14L7 -6Q6 -3 4 -3V0H2V-3H-3V0H-5V-3Q-9 -2-14 -3Z',
  thero: 'M-11 -8Q-5 -9-1 -10Q2 -12 5 -12L9 -11V-9L5 -9L3 -7L2 -4L3 0H1L0 -4L-2 -5L-3 0H-5L-4 -5Q-7 -7-11 -8Z',
  ptero: 'M-11 0Q-5 -6 0 -1Q5 -6 11 0Q5 -2 1 2L5 3L0 3Q-5 -2-11 0Z',
};

/** 이 런의 지도에 항로도를 쓰는가: 항로도가 있는 전장 · 튜토리얼 아님 · 모든 칸이 선택지 1개 (분기 고르기는 기존 타임라인) */
export function routeMapOn(run: RunState): boolean {
  return run.field in FIELDS && !run.tutorial && run.map.every((o) => o.length === 1);
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

interface Scene { key: string; el: HTMLElement; sync(step: number): void; sleep(): void; wake(): void; destroy(): void }
let S: Scene | null = null;
/** 노드 설명 (HTML): 전체 화면 옆 패널에 쓴다 — 문구는 main 의 기존 팝오버와 같은 것 */
type Hint = (t: NodeType, i: number) => string;
let last: { host: HTMLElement; run: RunState; onNode: (el: HTMLElement) => void; hint: Hint } | null = null;
// 전체 화면: 항로도를 body 위 덮개로 옮기고(브라우저 전체 화면은 되면 덤), 더 넓은 시야 + 옆 패널 (노드 목록 · 범례)
let fs = false, fsNative = false, fsResize = 0;
function setFs(on: boolean, remount = true) {
  if (fs === on) return;
  fs = on; fsNative = false;
  document.documentElement.classList.toggle('rmap-fs-on', on);
  if (on) document.documentElement.requestFullscreen?.().then(() => { fsNative = true; }, () => {});
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  S?.destroy(); S = null;
  if (remount && last) mountRouteMap(last.host, last.run, last.onNode, last.hint);
}
addEventListener('keydown', (e) => { if (fs && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setFs(false); } }, true);
document.addEventListener('fullscreenchange', () => { if (fs && fsNative && !document.fullscreenElement) setFs(false); }); // 브라우저 Esc 는 전체 화면만 끄고 키는 넘겨 주지 않는다
addEventListener('resize', () => { if (!fs) return; clearTimeout(fsResize); fsResize = window.setTimeout(() => { if (fs && last) { S?.destroy(); S = null; mountRouteMap(last.host, last.run, last.onNode, last.hint); } }, 200); });

/** render() 뒤에 부른다: host 가 없으면(지도 화면이 아님) 움직임만 멈춘다 */
export function mountRouteMap(host: HTMLElement | null, run: RunState | null, onNode: (el: HTMLElement) => void, hint: Hint = () => '') {
  if (!host || !run || !routeMapOn(run)) { if (fs) setFs(false, false); S?.sleep(); return; }
  last = { host, run, onNode, hint };
  const narrow = matchMedia('(max-width: 600px)').matches;
  const types = run.map.map((o, i) => run.picked[i] || o[0]);
  const key = [run.seed, run.phase, run.field, document.documentElement.dataset.uiTheme, narrow, types.join(), fs].join('|');
  const parent = fs ? document.body : host;
  if (!S || S.key !== key) { S?.destroy(); S = build(parent, run, key, types, narrow, onNode, hint); }
  else if (S.el.parentElement !== parent) parent.appendChild(S.el);
  S.wake();
  S.sync(run.step);
}

function build(host: HTMLElement, run: RunState, key: string, types: NodeType[], narrow: boolean, onNode: (el: HTMLElement) => void, hint: Hint): Scene {
  const C = palette();
  const N = types.length, kind: Kind = FIELDS[run.field as keyof typeof FIELDS] as Kind;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = document.createElement('div');
  box.className = `rmap rmap-${kind}${fs ? ' fs' : ''}`;
  box.innerHTML = `<div class="rm-view"><svg class="rm-stage" role="img" aria-label="항로도 — 좌우로 끌어서 둘러보기, 노드를 누르면 설명"></svg><button class="btn tiny rm-recenter" type="button" hidden>현재 노드로</button><button class="btn tiny rm-fs" type="button" aria-pressed="${fs}">${lineIcon(fs ? 'u.shrink' : 'u.expand', 'li')}${fs ? '닫기' : '전체 화면'}</button></div>${fs ? '<aside class="rm-panel" aria-label="항로 상세"></aside>' : ''}`;
  host.appendChild(box); // 길이 계산(getTotalLength)은 문서에 붙은 뒤에
  const stage = box.querySelector('svg')!, recenterBtn = box.querySelector<HTMLButtonElement>('.rm-recenter')!, panelEl = box.querySelector<HTMLElement>('.rm-panel');
  box.querySelector('.rm-fs')!.addEventListener('click', () => setFs(!fs));
  // 전체 화면 시야: 무대 칸의 비율에 맞춰 원래 시야보다 넓고 높게 (가운데는 그대로)
  const sr = stage.getBoundingClientRect(), aspect = sr.height > 0 ? sr.width / sr.height : 0;
  const fit = (v: number[]) => {
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
  function token(parent: Element, i: number): Tok {
    const t = types[i], g = el('g', { class: 'rm-node', 'data-step': i, 'data-node': t, tabindex: 0, role: 'button', 'aria-label': `${i + 1}번째 칸 ${NODE_NAME[t]}` }, parent), sg = el('g', {}, g);
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
  let moved = 0, downNode: SVGElement | null = null; // 누른 노드 (포인터 캡처 뒤 click 대상은 무대 자체라 누를 때 기억)
  function dragger(onDelta: (dx: number) => void) {
    let id = -1, lx = 0, ly = 0, v = 0, lt = 0, inert = 0, axis: '' | 'x' | 'y' = '', touch = false, wheelT = 0;
    const scale = () => stage.viewBox.baseVal.width / stage.getBoundingClientRect().width;
    const halt = () => { clearTimeout(idleT); homing = false; cancelAnimationFrame(raf); cancelAnimationFrame(inert); };
    const down = (e: PointerEvent) => { if (e.button !== 0) return; downNode = (e.target as Element).closest<SVGElement>('.rm-node'); halt(); id = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now(); v = 0; moved = 0; axis = ''; touch = e.pointerType !== 'mouse'; try { stage.setPointerCapture(id); } catch { /* 합성 이벤트 */ } };
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
    if (n && moved < 6) { if (fs) pick(+(n.dataset.step ?? cur)); else onNode(n as unknown as HTMLElement); }
    downNode = null;
  });
  stage.addEventListener('keydown', (e) => { const n = (e.target as Element).closest<SVGElement>('.rm-node'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (fs) pick(+(n.dataset.step ?? cur)); else onNode(n as unknown as HTMLElement); } });
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
  function contact(g: Element, lab: string, y = -16) {
    el('path', { d: `M-10 ${y + 4}v-4h4M10 ${y + 4}v-4h-4`, fill: 'none', stroke: C.t2, 'stroke-width': .8 }, g);
    txt(g, 12, y + 2, lab, { 'font-size': 7, fill: C.t2 });
  }
  const tokensFor = (parent: Element) => types.map((_, i) => token(parent, i));
  const stopAmb = () => { cancelAnimationFrame(amb); amb = 0; };
  let tick: (t: number) => void = () => {};
  const t0 = performance.now();
  const startAmb = () => { if (amb) return; const f = (now: number) => { tick(reduce ? 0 : now - t0); amb = requestAnimationFrame(f); }; amb = requestAnimationFrame(f); };

  const sc: { go(): void; stop(): void; look?(i: number): void; name?: string; legend?: string[][] } = kind === 'ring' ? ringScene() : kind === 'orbit' ? orbitScene() : kind === 'stairs' ? stairsScene() : gridScene();
  goNow = () => { sel = cur; sc.go(); panel(); };
  // ── 전체 화면 옆 패널: 노드 목록 (상태 · 고른 노드의 설명) + 범례. 노드를 고르면 지도도 그 노드로
  function pick(i: number) { sel = Math.max(0, Math.min(N - 1, i)); if (sel === cur) sc.go(); else sc.look?.(sel); panel(); }
  function panel() {
    if (!panelEl) return;
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
    if (b.dataset.i) pick(+b.dataset.i);
    else if (b.dataset.go) pick(b.dataset.go === '0' ? cur : sel + +b.dataset.go);
  });
  panel();
  return {
    key, el: box,
    sync(step: number) { const c = Math.min(step, N - 1); if (c === cur) return; cur = c; goNow(); },
    sleep() { stopAmb(); clearTimeout(idleT); },
    wake() { if (!awake || !amb) { awake = true; startAmb(); } },
    destroy() { stopAmb(); cancelAnimationFrame(raf); cancelAnimationFrame(praf); clearTimeout(idleT); sc.stop(); box.remove(); },
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
    ].map((b, k) => ({ ...b, half: k % 2 ? 'hi' : 'lo', u: 0, cx: 0, cy: 0 }));
    let U = 0;
    for (const b of BOD) { b.u = U + b.r; U += 2 * b.r; [b.cx, b.cy] = L2W(b.u, 0); }
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

    // 진행축 · 거리 눈금
    { const [a, b] = [L2W(-300, 0), L2W(U + 300, 0)]; el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.line, 'stroke-width': .8 }, world); }
    for (let u = 0; u <= U; u += 200) { const [x, y] = L2W(u, 0); el('path', { d: `M${x} ${y - 4}v8`, stroke: C.t3, transform: `rotate(${THd} ${x} ${y})` }, world); txt(world, x + 4, y - 5, `${(u / 1000).toFixed(1)}AU`, { 'font-size': 7 }); }
    // 수송선단 (진행축 양쪽 가장자리)
    for (const L of [{ v: -182, dir: 1, code: 'CVY-12' }, { v: 188, dir: -1, code: 'CVY-07' }]) {
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
        const [wx, wy] = L2W(b.u + 62, -b.r * .45); // 침식된 난파선
        el('path', { d: `M${wx - 14} ${wy}l9 -5h12l-3 4 5 2-6 3h-10Z M${wx + 9} ${wy - 6}l5 -4`, fill: C.panel2 }, g);
        txt(g, wx, wy + 14, 'WRK-02', { 'text-anchor': 'middle', 'font-size': 7 });
      }
      if (b.pulsar) {
        const [px, py] = L2W(b.u + b.r + 70, -120), q = el('g', { transform: `translate(${px} ${py})` }, g);
        el('circle', { r: 5, fill: C.t2 }, q);
        for (const r of [12, 20, 28]) blink.push({ e: el('circle', { r, fill: 'none', stroke: C.t3 }, q), ph: r / 9 });
        txt(q, 0, 42, 'PSR · P=8y', { 'text-anchor': 'middle', fill: C.t2, 'font-size': 9 });
      }
      const [lx, ly] = L2W(b.u, b.half === 'lo' ? -b.r - 22 : b.r + 24); // 이름은 항로 반대편
      txt(g, lx, ly, b.code, { 'text-anchor': 'middle', fill: C.text, 'font-size': 11 });
      txt(g, lx, ly + 14, `${b.name} · ${b.sub}`, { 'text-anchor': 'middle', 'font-size': 8.5, class: 'rm-ko' });
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

  // ── 카운티폴 세피아 교외: 등각으로 내려다본 계획 도시. 같은 크기 구획 · 직각 가로망 · 표준 주택, 항로는 내비 경로처럼 안내된다
  // (왼쪽 위 회전 안내 · 아래 진행 막대). 노드는 일정한 높이에 띄운 핀 (줄기 · 땅 위 고리 · 아래 화살촉). 카메라는 첫 노드 → 보스 직선 위로만
  function gridScene() {
    const VB = stageBase(narrow ? [180, 30, 440, 400] : [0, 0, 800, 450]);
    const rnd = rng(54 + run.phase), rr = rng(58 + run.phase), SZ = 26, OX = 150, OY = 205, M_PER = 20, PIN = 58; // 격자 1칸 = 20m (구획 3칸 = 60m)
    const rows: number[] = []; // 노드마다 가로 몇 줄 위 · 아래로 꺾이는가 (보스는 첫 노드와 같은 줄)
    for (let i = 0, x = 0; i < N; i++) { if (i === N - 1) x = 0; else if (i && rr() < .7) x = Math.max(-2, Math.min(2, x + (rr() < .5 ? -1 : 1))); rows.push(x); }
    const iso = (gx: number, gy: number, z = 0) => [OX + (gx - gy) * SZ * .866, OY + (gx + gy) * SZ * .5 - z];
    const world = el('g', {}, stage), sky = el('g', {}, stage), fixed = el('g', {}, stage);
    const GX = (i: number) => i * 3, GY = (i: number) => rows[i] * 3;
    const gx0 = -6, gx1 = GX(N - 1) + 8, gy0 = -9, gy1 = 9;
    const ground = el('g', {}, world), bldg = el('g', {}, world), routeG = el('g', {}, world), over = el('g', {}, world); // 안내 경로 · 핀은 집 위 (늘 보이게)
    const poly = (a: number[][], fill: string, stroke?: string, p: Element = bldg) => el('polygon', { points: pts(a), fill, stroke: stroke || 'none', 'stroke-width': .6 }, p);
    poly([iso(gx0, gy0), iso(gx1, gy0), iso(gx1, gy1), iso(gx0, gy1)], C.panel, undefined, ground);
    for (let g = gx0; g <= gx1; g += 3) poly([iso(g - .3, gy0), iso(g + .3, gy0), iso(g + .3, gy1), iso(g - .3, gy1)], C.panel2, undefined, ground);
    for (let g = gy0; g <= gy1; g += 3) poly([iso(gx0, g - .3), iso(gx1, g - .3), iso(gx1, g + .3), iso(gx0, g + .3)], C.panel2, undefined, ground);
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
    const items: { k: number; f(): void }[] = [], civGX = GX(N - 1);
    for (let bx = gx0; bx < gx1; bx += 3) for (let by = gy0; by < gy1; by += 3) {
      if (bx === civGX && by === -6) { items.push({ k: bx + by + 3, f: () => { isoBox(bx + .6, by + .6, 1.8, 1.8, 30); const [x, y] = iso(bx + 1.5, by + 1.5, 46); txt(bldg, x, y, 'CIV-01 행정 구역', ko({ 'text-anchor': 'middle', 'font-size': 7, fill: C.t2 })); } }); continue; }
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
      for (const [dx, dy] of [[.55, .55], [1.55, .55], [.55, 1.55], [1.55, 1.55]]) items.push({ k: bx + dx + by + dy, f: () => isoHouse(bx + dx, by + dy) });
    }
    items.sort((p, q) => p.k - q.k).forEach((h) => h.f());
    // 경유점 (격자) → 화면 경로 · 회전 안내
    type Wp = { gx: number; gy: number; node?: number; x: number; y: number; s: number };
    const wps: Wp[] = [];
    for (let i = 0; i < N; i++) { wps.push({ gx: GX(i), gy: GY(i), node: i, x: 0, y: 0, s: 0 }); if (i < N - 1) { wps.push({ gx: GX(i) + 1.5, gy: GY(i), x: 0, y: 0, s: 0 }); wps.push({ gx: GX(i) + 1.5, gy: GY(i + 1), x: 0, y: 0, s: 0 }); } }
    let acc = 0;
    wps.forEach((w, k) => { [w.x, w.y] = iso(w.gx, w.gy); if (k) acc += Math.hypot(w.gx - wps[k - 1].gx, w.gy - wps[k - 1].gy) * SZ; w.s = acc; });
    const ST = ['느릅나무로', '단풍나무로', '중앙대로', '참나무로', '자작나무로'];
    const turns: { s: number; dir: 'R' | 'L'; street: string }[] = [];
    for (let k = 1; k < wps.length - 1; k++) {
      const a = wps[k - 1], b = wps[k], c = wps[k + 1], ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
      if (Math.hypot(ux, uy) < 1 || Math.hypot(vx, vy) < 1) continue;
      const cr = ux * vy - uy * vx;
      if (Math.abs(cr) < 1) continue;
      const street = Math.abs(c.gy - b.gy) > .1 ? `AVE ${String.fromCharCode(65 + Math.round((b.gx - gx0) / 3))}` : ST[Math.max(0, Math.min(4, Math.round(b.gy / 3) + 2))];
      turns.push({ s: b.s, dir: cr > 0 ? 'R' : 'L', street });
    }
    const segs: string[] = []; { let buf = ''; for (let k = 1; k < wps.length; k++) { buf += ` L${wps[k].x.toFixed(1)} ${wps[k].y.toFixed(1)}`; if (wps[k].node != null) { segs.push(buf); buf = ''; } } }
    const meters = (s: number) => Math.round(s / SZ * M_PER);
    const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.max(0, Math.round(m / 10) * 10)}m`);
    // 핀: 토큰 아래 줄기 · 아래를 가리키는 화살촉 · 땅 위 고리
    types.forEach((_, i) => {
      const [x, y] = iso(GX(i), GY(i)), g = el('g', {}, over);
      el('line', { x1: x, y1: y - PIN + 21, x2: x, y2: y - 7, stroke: C.t2, 'stroke-width': 1.2 }, g);
      el('path', { d: `M${x - 4} ${y - 11}L${x} ${y - 5}L${x + 4} ${y - 11}`, fill: 'none', stroke: C.t2, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      el('ellipse', { cx: x, cy: y, rx: 9, ry: 5, fill: 'none', stroke: C.t2, 'stroke-width': 1.2 }, g);
    });
    // 차 · 비행기 (그림자)
    const cars = Array.from({ length: 14 }, () => { const g = el('g', {}, bldg); el('rect', { x: -4, y: -2.5, width: 8, height: 5, rx: 1.5, fill: C.t2 }, g); return { g, along: rnd() < .6, lane: (Math.floor(rnd() * 6) - 3) * 3, o: rnd() * 40, v: (rnd() < .5 ? 1 : -1) * .0016 }; });
    const PL = 'M14 0L4 -2L-2 -12H-5L-1 -2H-9L-12 -6H-14L-12 0L-14 6H-12L-9 2H-1L-5 12H-2L4 2Z';
    const shadow = el('path', { d: PL, fill: C.line, opacity: .5 }, sky), plane = el('path', { d: PL, fill: C.t2 }, sky);
    // 흐르는 진행 화살표 (남은 경로 위)
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
        for (const c of cars) { const p = c.along ? iso(mod(c.o + t * c.v, gx1 - gx0) + gx0, c.lane + .15) : iso(c.lane + .15, mod(c.o + t * c.v, gy1 - gy0) + gy0); c.g.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${c.along ? 30 : -30})`); }
        const k = mod(t, 22000) / 22000, px = VB[0] - 60 + k * (VB[2] + 160), py = VB[1] + VB[3] * .82 - k * VB[3] * .6; // 22초마다 한 번, 화면을 비스듬히
        plane.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(-28)`);
        shadow.setAttribute('transform', `translate(${(px + 26).toFixed(1)} ${(py + 34).toFixed(1)}) rotate(-28)`);
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
  }
}
