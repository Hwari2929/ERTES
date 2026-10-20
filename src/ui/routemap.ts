// 지도 화면 항로도 (전술 스코프): 리빈 낙원동 = 구체 내벽 회전, 베르타–산노디스 물류망 = 대각 진행 원 궤도.
// 시안: claude.ai 아티팩트 '전장별 항로 시안' (리빈 = 스코프, 물류망 = 스코프 · 대각).
// 렌더마다 화면이 통째로 다시 그려지므로, 항로도 DOM 은 이 모듈이 들고 있다가 자리(.rmap-host)에 다시 끼운다.
// 그래서 진행(노드 완료 뒤 지도로 돌아옴)마다 끝낸 노드가 옅어지고 다음 노드가 밝아지는 전환을 이어서 보여 줄 수 있다.
import { NODE_NAME, type NodeType, type RunState } from '../types';
import { lineIcon } from './synicons';

const FIELDS = { livin: 'ring', swarm: 'orbit' } as const;
type Kind = (typeof FIELDS)[keyof typeof FIELDS];
const CODE: Partial<Record<NodeType, string>> = { supply: 'SUP', battle: 'BTL', council: 'CNL', event: 'EVT', shop: 'BRN', adversity: 'ADV', boss: 'BOS', recruit: 'RCT', fork: 'FRK', news: 'NWS', invest: 'INV', pilgrim: 'PLG', challenge: 'CHL', maint: 'MNT' };
// 프리버드(공룡) 실루엣 — 오른쪽을 보고 발이 y=0
const DINO = {
  sauro: 'M-14 -3Q-9 -5-5 -8Q0 -10 5 -8L9 -15Q10 -17 13 -16L13 -15L10 -14L7 -6Q6 -3 4 -3V0H2V-3H-3V0H-5V-3Q-9 -2-14 -3Z',
  thero: 'M-11 -8Q-5 -9-1 -10Q2 -12 5 -12L9 -11V-9L5 -9L3 -7L2 -4L3 0H1L0 -4L-2 -5L-3 0H-5L-4 -5Q-7 -7-11 -8Z',
  ptero: 'M-11 0Q-5 -6 0 -1Q5 -6 11 0Q5 -2 1 2L5 3L0 3Q-5 -2-11 0Z',
};

/** 이 런의 지도에 항로도를 쓰는가: 두 전장 · 튜토리얼 아님 · 모든 칸이 선택지 1개 (분기 고르기는 기존 타임라인) */
export function routeMapOn(run: RunState): boolean {
  return run.field in FIELDS && !run.tutorial && run.map.every((o) => o.length === 1);
}

// ── 색: 테마 토큰을 읽어 #rrggbb 로 (섞기 · 보간용)
type Pal = { bg: string; panel: string; panel2: string; line: string; soft: string; text: string; t2: string; t3: string; sel: string; streak: string; bad: string; divine: string };
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
  return { bg, panel: t('--panel'), panel2: t('--panel-2'), line, soft: mix(line, bg, .4), text: t('--c-text'), t2, t3: mix(t2, bg, .38), sel: t('--c-select'), streak: t('--c-streak'), bad: t('--c-bad'), divine: t('--c-divine') };
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

/** render() 뒤에 부른다: host 가 없으면(지도 화면이 아님) 움직임만 멈춘다 */
export function mountRouteMap(host: HTMLElement | null, run: RunState | null, onNode: (el: HTMLElement) => void) {
  if (!host || !run || !routeMapOn(run)) { S?.sleep(); return; }
  const narrow = matchMedia('(max-width: 600px)').matches;
  const types = run.map.map((o, i) => run.picked[i] || o[0]);
  const key = [run.seed, run.phase, run.field, document.documentElement.dataset.uiTheme, narrow, types.join()].join('|');
  if (!S || S.key !== key) { S?.destroy(); S = build(host, run, key, types, narrow, onNode); }
  else host.appendChild(S.el);
  S.wake();
  S.sync(run.step);
}

function build(host: HTMLElement, run: RunState, key: string, types: NodeType[], narrow: boolean, onNode: (el: HTMLElement) => void): Scene {
  const C = palette();
  const N = types.length, kind: Kind = FIELDS[run.field as keyof typeof FIELDS];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = document.createElement('div');
  box.className = `rmap rmap-${kind}`;
  box.innerHTML = '<svg class="rm-stage" role="img" aria-label="항로도 — 좌우로 끌어서 둘러보기, 노드를 누르면 설명"></svg><button class="btn tiny rm-recenter" type="button" hidden>현재 노드로</button>';
  host.appendChild(box); // 길이 계산(getTotalLength)은 문서에 붙은 뒤에
  const stage = box.querySelector('svg')!, recenterBtn = box.querySelector<HTMLButtonElement>('.rm-recenter')!;
  let cur = Math.min(run.step, N - 1), raf = 0, praf = 0, amb = 0, idleT = 0, homing = false, awake = false;
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

  // ── 끌기 · 관성. 손을 떼고 잠시 두면 현재 노드로. 거의 안 움직인 누름은 노드 설명 (기존 타임라인 팝오버)
  let goNow = () => {};
  const armReturn = () => { clearTimeout(idleT); idleT = window.setTimeout(() => { if (!recenterBtn.hidden) goNow(); }, 2200); };
  let moved = 0, downNode: SVGElement | null = null; // 누른 노드 (포인터 캡처 뒤 click 대상은 무대 자체라 누를 때 기억)
  function dragger(onDelta: (dx: number) => void) {
    let id = -1, lx = 0, v = 0, lt = 0, inert = 0;
    const scale = () => stage.viewBox.baseVal.width / stage.getBoundingClientRect().width;
    const down = (e: PointerEvent) => { if (e.button !== 0) return; downNode = (e.target as Element).closest<SVGElement>('.rm-node'); clearTimeout(idleT); homing = false; cancelAnimationFrame(raf); cancelAnimationFrame(inert); id = e.pointerId; lx = e.clientX; lt = performance.now(); v = 0; moved = 0; stage.setPointerCapture(id); box.classList.add('drag'); };
    const move = (e: PointerEvent) => { if (e.pointerId !== id) return; const now = performance.now(), dx = (e.clientX - lx) * scale(); moved += Math.abs(e.clientX - lx); lx = e.clientX; v = dx / Math.max(1, now - lt); lt = now; onDelta(dx); };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return; id = -1; box.classList.remove('drag');
      if (reduce || moved < 6) { armReturn(); return; }
      let last = performance.now();
      const glide = (now: number) => { const dt = now - last; last = now; v *= Math.pow(.992, dt); if (Math.abs(v) < .02) { armReturn(); return; } onDelta(v * dt); inert = requestAnimationFrame(glide); };
      inert = requestAnimationFrame(glide);
    };
    stage.addEventListener('pointerdown', down); stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    return () => cancelAnimationFrame(inert);
  }
  stage.addEventListener('click', (e) => {
    const n = (e.target as Element).closest<SVGElement>('.rm-node') || downNode;
    if (n && moved < 6) onNode(n as unknown as HTMLElement);
    downNode = null;
  });
  stage.addEventListener('keydown', (e) => { const n = (e.target as Element).closest<SVGElement>('.rm-node'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onNode(n as unknown as HTMLElement); } });
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

  const sc = kind === 'ring' ? ringScene() : orbitScene();
  goNow = sc.go;
  return {
    key, el: box,
    sync(step: number) { const c = Math.min(step, N - 1); if (c === cur) return; cur = c; sc.go(); },
    sleep() { stopAmb(); clearTimeout(idleT); },
    wake() { if (!awake || !amb) { awake = true; startAmb(); } },
    destroy() { stopAmb(); cancelAnimationFrame(raf); cancelAnimationFrame(praf); clearTimeout(idleT); sc.stop(); box.remove(); },
  };

  // ── 리빈 낙원동: 속 빈 구체의 내벽 단면. 인공 태양(중심)은 화면 위 바깥
  function ringScene() {
    const W = 800, H = 450, R = 600, CX = 400, CY = 372 - R, STEP = 21; // 노드 간격 21° ≈ 220px
    const VB = narrow ? [180, 120, 440, 320] : [0, 92, W, 350], T0 = VB[1];
    stage.setAttribute('viewBox', VB.join(' ')); stage.style.aspectRatio = `${VB[2]} / ${VB[3]}`;
    el('rect', { x: -200, y: -200, width: W + 400, height: H + 400, fill: C.bg }, stage);
    const back = el('g', {}, stage), rotG = el('g', {}, stage), nodesG = el('g', {}, stage), top = el('g', {}, stage);
    const rnd = rng(7 + run.phase);
    const span0 = -50, span1 = (N - 1) * STEP + 50;
    const P = (deg: number, r: number) => [CX - r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)]; // 좌우 반전: 앞으로 올 노드가 오른쪽
    // 벽에 붙은 것은 회전 0 기준으로 놓고 rotG 전체를 돌린다 (지역 좌표: x = 벽을 따라, -y = 중심 쪽)
    const place = (g: Element, a: number, r = R) => { const [x, y] = P(90 + a, r); g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(-a).toFixed(2)})`); };
    const rig = sweepRig(back, [90, 180, 270, 360], (r) => `${r * 10}m`); rig.g.setAttribute('transform', `translate(${CX} 372)`);
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
      if (type === 'mountain') { const g = at(a); mountain(g, 80 + rnd() * 30, 54 + rnd() * 22, ++kM); forest(g, 30, 4); }
      else if (type === 'village') { const g = at(a); village(g, 4 + Math.floor(rnd() * 4), ++kV); farm(g, 36, 26); }
      else if (type === 'forest') forest(at(a), -40, 11);
      else if (type === 'post') { const g = at(a); post(g, ++kQ); forest(g, 26, 3); }
      else { lake(at(a, R, lakeG), 64); forest(at(a), -46, 3); }
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
    const walkers: { g: SVGElement; body: SVGElement; sc: number; a0: number; amp: number; w: number; ph: number; step: number }[] = [];
    const flyers: { g: SVGElement; body: SVGElement; a0: number; v: number; h: number; ph: number }[] = [];
    const WALK: [number, 'sauro' | 'thero', number][] = [[-1.55, 'sauro', 1], [-1.36, 'sauro', .58], [1.45, 'thero', .9], [3.42, 'thero', .85], [3.6, 'thero', .7], [5.55, 'sauro', 1], [7.45, 'thero', .9], [9.45, 'sauro', 1], [9.62, 'sauro', .55], [11.5, 'thero', .9], [12.65, 'sauro', 1]];
    WALK.filter(([u]) => u < N).forEach(([u, k, s], j) => {
      const g = el('g', {}, lifeG), body = el('g', {}, g);
      el('path', { d: DINO[k], fill: C.t2 }, body);
      contact(g, `FB-${pad2(j + 1)}`, -20 * s - 4);
      const prev = walkers[walkers.length - 1], baby = s < .65 && prev; // 새끼는 앞 개체를 바짝 따라간다
      walkers.push({ g, body, sc: s, a0: u * STEP, amp: baby ? prev.amp : 2 + rnd() * 2.5, w: baby ? prev.w : (k === 'sauro' ? .00008 : .00015) * (.8 + rnd() * .4), ph: baby ? prev.ph - .22 : rnd() * 6.28, step: k === 'sauro' ? .0035 : .0065 });
    });
    for (let j = 0; j < 6; j++) {
      const g = el('g', {}, lifeG), body = el('g', {}, g);
      el('path', { d: DINO.ptero, fill: C.t2 }, body);
      contact(g, `FB-${pad2(20 + j)}`, -14);
      flyers.push({ g, body, a0: span0 + rnd() * (span1 - span0), v: (rnd() < .5 ? -1 : 1) * (.0005 + rnd() * .0005), h: 100 + rnd() * 60, ph: rnd() * 6.28 });
    }
    tick = (t) => {
      for (const c of clouds) place(c.g, span0 + mod(c.a0 - span0 + t * c.v, span1 - span0), R - c.h);
      for (const d of walkers) {
        const ph = t * d.w + d.ph, a = d.a0 + d.amp * Math.sin(ph), dir = Math.cos(ph) >= 0 ? 1 : -1;
        place(d.g, a, R - Math.abs(Math.sin(t * d.step)) * .9);
        d.body.setAttribute('transform', `scale(${dir * d.sc} ${d.sc})`);
      }
      for (const f of flyers) {
        place(f.g, span0 + mod(f.a0 - span0 + t * f.v, span1 - span0), R - f.h - 10 * Math.sin(t * .0006 + f.ph));
        f.body.setAttribute('transform', `scale(${Math.sign(f.v)} ${.35 + .65 * Math.abs(Math.sin(t * .005 + f.ph))})`);
      }
      rig.set(mod(t * .045, 360));
      const nx = segs[Math.floor(pos)]; if (nx) nx.base.setAttribute('stroke-dashoffset', (-t * .012).toFixed(1));
    };

    const tokens = tokensFor(nodesG);
    const crew = el('g', {}, nodesG);
    el('path', { d: 'M0 -7 6 3H-6Z', fill: C.sel }, crew);
    txt(crew, 0, 16, '용병단', { 'text-anchor': 'middle', fill: C.sel, 'font-size': 10, 'font-weight': 800, class: 'rm-ko' });
    corners(top, VB);
    titleBlock(top, VB, 'RV-1 PRESERVATION SPHERE · 內壁 단면 · SECTOR RIVIN', [`리빈-1 낙원동 · 페이즈 ${run.phase}`, `${N} NODES`, '거리환 900m 간격', 'REV.05 · 스코프']);

    let rot = -cur * STEP; // 노드 i 의 각 = 90 + i·STEP + rot
    const draw = () => {
      rotG.setAttribute('transform', `rotate(${(-rot).toFixed(3)} ${CX} ${CY})`);
      tokens.forEach((k, i) => { const [x, y] = P(90 + i * STEP + rot, RN); k.g.setAttribute('transform', `translate(${x} ${y})`); });
      const [cx, cy] = P(90 + cur * STEP + rot, R + 16); crew.setAttribute('transform', `translate(${cx} ${cy})`);
      recenterBtn.hidden = homing || Math.abs(rot + cur * STEP) < 1.5;
    };
    draw(); drawSegs(); paint(tokens, false);
    const lo = -(N - 1) * STEP - 18, hi = 18;
    const off = dragger((dx) => { rot = Math.max(lo, Math.min(hi, rot + (dx / R) * 180 / Math.PI)); draw(); });
    return {
      go() {
        const from = rot, to = -cur * STEP, p0 = pos; paint(tokens, true); homing = true;
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
    const VB = narrow ? [180, 10, 440, 440] : [0, 0, W, H];
    stage.setAttribute('viewBox', VB.join(' ')); stage.style.aspectRatio = `${VB[2]} / ${VB[3]}`;
    el('rect', { x: -200, y: -200, width: W + 400, height: H + 400, fill: C.bg }, stage);
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
      go() {
        paint(tokens, true);
        const s0 = sp, s1 = sAt(cur), u0 = uc; homing = true;
        if (s1 < s0) syncBeacons(false);
        tween(1100, (k) => { sp = s0 + (s1 - s0) * k; drawShip(); syncBeacons(true); const want = ucFor(sp); uc = u0 + (want - u0) * Math.min(1, k * 1.3); drawCam(); }, () => { homing = false; syncBeacons(true); drawCam(); });
      },
      stop: off,
    };
  }
}
