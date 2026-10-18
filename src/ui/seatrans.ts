// 이타카 테마: 바다 화면 전환 (themefx.ts 가 큰 화면 전환에 부른다). 게임 코드와 독립된 SVG 오버레이.
//   등장   물결 N겹이 아래에서 차례로 차올라 화면을 덮는다. 먼저 오는 물결일수록 낮게 멈추고 앞에 그린다 (원근: 앞 = 아래).
//          섬은 1번 물결 뒤 · 배는 2번 물결 뒤에 끼어 있다가 그 물결이 닿으면 물 위로 솟는다 (아랫부분은 앞 물결에 가린다)
//   대기   물결 곡선이 천천히 흐르며 출렁이고, 배 · 섬은 자기 물결 수면을 타고 떠 있다. 오래 걸리면 갈매기 3마리가 내려온다
//   출항   ready() 뒤: 배 뒤에서 제트 엔진이 튀어나와 점화 → 거의 수평으로 가속하다 기수가 들리며 오른쪽 위로 솟구쳐 사라진다.
//          물결은 등장 역순으로 내려가며 다음 화면을 드러내고, 섬은 1번 물결을 따라 함께 가라앉는다. 갈매기는 위로 날아간다
//   이스터에그  날고 있는 배를 누르면 엔진이 꺼지고 연기를 뿜으며 곤두박질친다. 전환 흐름과는 완전히 따로 돈다
// 상태: 전환 entering → waiting → exiting → completed, 배 hidden → floating → launching → flying → (crashing) → gone.
// 모든 움직임은 requestAnimationFrame 한 줄기에서 시간으로 계산한다 (물결 곡선을 매 프레임 다시 그리므로 WAAPI 대신).
// 수치는 아래 SEA 설정에서 조절한다. 크기는 화면 짧은 변 기준 배율(unit)로 맞춰 휴대폰 · 데스크톱 모두 같은 구도.

export type SeaPhase = 'entering' | 'waiting' | 'exiting' | 'completed';
export type BoatPhase = 'hidden' | 'floating' | 'launching' | 'flying' | 'crashing' | 'gone';

export const SEA = {
  /** 물결 (앞 → 뒤 = 등장 순서). top: 멈추는 높이 (화면 높이 비율, 마지막 물결은 화면 위 끝을 넘겨 빈틈이 없게), amp: 출렁임 px, len: 물결 길이 (화면 폭 비율) */
  waves: [
    { top: 0.8, amp: 9, len: 0.55, speed: 0.55 },
    { top: 0.645, amp: 8, len: 0.62, speed: -0.45 },
    { top: 0.495, amp: 7, len: 0.5, speed: 0.4 },
    { top: 0.35, amp: 6, len: 0.66, speed: -0.35 },
    { top: 0.205, amp: 5, len: 0.58, speed: 0.3 },
    { top: -0.05, amp: 4, len: 0.7, speed: -0.25 },
  ],
  /** 물결 색은 style.css .tfx-sea 의 --sw1 ~ --sw6 (앞 → 뒤) */
  enter: { dur: 560, gap: 62 }, // 물결 하나가 차오르는 시간 · 다음 물결까지 간격 (ms)
  exit: { dur: 620, gap: 70, delay: 230 }, // 내려가는 시간 · 간격 · 출항 시작 뒤 첫 물결이 움직이기까지
  bob: 1, // 대기 중 출렁임 세기 배율
  minHold: 260, // 다 덮은 뒤 최소 대기 (로딩이 일러도 배가 잠깐 떠 있게)
  pop: { island: 140, boat: 60, dur: 520 }, // 섬 · 배가 솟는 시점 (그 물결이 닿은 뒤 ms) · 솟는 시간
  gulls: { count: 3, delay: 1500 }, // 다 덮은 뒤 이만큼 로딩이 길어지면 갈매기
  launch: { pop: 200, ignite: 140 }, // 엔진이 튀어나오는 시간 · 점화 뒤 출발까지
  /** 비행 궤적: dur 동안 진행도 p = (t/dur)^accel, x 는 앞쪽에서 빨리 나아가다 둔해지고 (turn), y 는 지수로 뒤로 갈수록 급상승 (climb) */
  flight: { dur: 1350, accel: 1.7, turn: 2.2, climb: 4.2, reach: 0.66 },
  crash: { gravity: 1500, drag: 0.3, hop: 360 }, // 추락 중력 px/s² · 누른 순간 남는 속도 비율 · 털썩 튀어 오르는 속도
  objScale: 1.3, // 섬 · 배 · 갈매기 크기 배율 (화면 짧은 변 기준 배율에 곱한다)
  glints: 3, // 물결마다 반짝이는 물비늘 수
  maxLife: 7000, // 전환이 끝난 뒤 배 · 갈매기를 기다리는 최대 시간
};

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const outQuart = (t: number) => 1 - (1 - t) ** 4;
const inCubic = (t: number) => t * t * t;
const outBack = (t: number, k = 1.6) => 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, html = '') => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (html) el.innerHTML = html;
  return el;
};

// ───────────────────────── 그림 (단위 좌표: 배 · 섬은 수면 가운데가 원점, 오른쪽이 뱃머리)
const BOAT_ART = `
  <g class="ts-jet" transform="translate(-50 -6) scale(0)">
    <g class="ts-flame"><path d="M-30 0 Q-58 -11 -72 0 Q-58 11 -30 0Z" fill="#f2846b"/><path d="M-30 0 Q-50 -7 -60 0 Q-50 7 -30 0Z" fill="#f7a85a"/><path d="M-30 0 Q-42 -4 -48 0 Q-42 4 -30 0Z" fill="#fbe08a"/></g>
    <path d="M-31 -8 L-22 -11 V11 L-31 8Z" fill="#6f7f8a"/>
    <rect x="-24" y="-12" width="30" height="24" rx="11" fill="#dcebf0" stroke="#8fa7b3" stroke-width="2"/>
    <rect x="-12" y="-12" width="5" height="24" fill="#ee8f78"/><circle cx="0" cy="0" r="2.4" fill="#8fa7b3"/>
  </g>
  <path d="M-55 -15 H55 Q51 13 31 18 H-34 Q-51 12 -55 -15Z" fill="#ee8f78" stroke="#c96c57" stroke-width="2" stroke-linejoin="round"/>
  <path d="M-53 -8 H53" stroke="#fbf3e2" stroke-width="5"/>
  <g fill="#fbf3e2" stroke="#c96c57" stroke-width="1.6"><circle cx="-18" cy="3" r="3.6"/><circle cx="0" cy="3" r="3.6"/><circle cx="18" cy="3" r="3.6"/></g>
  <rect x="-3" y="-86" width="5" height="72" rx="2.5" fill="#8b6b55"/>
  <path d="M1 -84 L19 -78 L1 -72Z" fill="#ee8f78"/>
  <path d="M5 -76 Q37 -52 42 -20 H5Z" fill="#fbf3e2" stroke="#e2cfb1" stroke-width="2" stroke-linejoin="round"/>
  <path d="M5 -46 H33 Q37 -38 39 -31 H5Z" fill="#f4b3a2"/>
  <path d="M-5 -68 Q-27 -46 -33 -20 H-5Z" fill="#c9ead9" stroke="#a9d3c1" stroke-width="2" stroke-linejoin="round"/>`;
const ISLAND_ART = `
  <path d="M-84 14 Q-70 -26 -30 -30 Q-8 -50 26 -40 Q66 -34 84 14Z" fill="#f2deb4" stroke="#e1c48f" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M-46 -24 Q-14 -54 22 -42 Q-4 -40 -24 -26Z" fill="#9fd4bd"/>
  <path d="M14 -40 Q10 -78 30 -104" stroke="#b98557" stroke-width="7" stroke-linecap="round" fill="none"/>
  <g fill="#5daf93" stroke="#4c9a80" stroke-width="1.5" stroke-linejoin="round">
    <path d="M30 -104 Q4 -122 -18 -104 Q4 -110 30 -104Z"/><path d="M30 -104 Q58 -124 74 -100 Q52 -108 30 -104Z"/>
    <path d="M30 -104 Q8 -96 -2 -76 Q14 -92 30 -104Z"/><path d="M30 -104 Q56 -98 62 -74 Q46 -92 30 -104Z"/><path d="M30 -104 Q30 -128 46 -136 Q36 -120 30 -104Z"/></g>
  <circle cx="26" cy="-98" r="4" fill="#a5764e"/><circle cx="34" cy="-97" r="4" fill="#a5764e"/>
  <g fill="#ee8f78"><circle cx="-52" cy="-14" r="4"/><circle cx="-45" cy="-19" r="3"/><circle cx="58" cy="-12" r="3.4"/></g>`;
/** 갈매기 날개: f = 날갯짓 (-1 아래 ~ 1 위) */
const gullPath = (f: number) => { const y = -6 - 7 * f, c = -12 - 9 * f; return `M-20 ${y} Q-10 ${c} 0 0 Q10 ${c} 20 ${y}`; };

interface Wave { g: SVGGElement; fill: SVGPathElement; foam: SVGPathElement; ph: number; y: number }
interface Puff { el: SVGCircleElement; x: number; y: number; vx: number; vy: number; r0: number; r1: number; t: number; life: number }
interface Gull { el: SVGPathElement; x: number; y: number; tx: number; ty: number; t0: number; ph: number; rate: number; vx: number; vy: number; leaving: boolean }

export interface SeaHandle {
  /** 화면을 다 덮었을 때 (이때 아래 화면을 바꾼다) */
  covered: Promise<void>;
  /** 물결이 다 내려가 다음 화면이 드러났을 때 */
  done: Promise<void>;
  /** 로딩 완료 신호: 언제 불러도 된다 (덮기 전이면 다 덮고 minHold 뒤 출항) */
  ready(): void;
  /** 즉시 정리 (다른 전환이 시작될 때 등) */
  destroy(): void;
  readonly phase: SeaPhase;
  readonly boat: BoatPhase;
}

/** 바다 전환 시작. 오버레이는 document.body 에 붙고, 끝나면 스스로 사라진다 */
export function seaTransition(): SeaHandle {
  const C = SEA, N = C.waves.length;
  let W = innerWidth, H = innerHeight, U = 1;
  const measure = () => { W = innerWidth; H = innerHeight; U = clamp(Math.min(W, H) / 720, 0.62, 1.2); };
  measure();
  const root = svg('svg', { class: 'tfx-sea', 'aria-hidden': 'true' });
  const waves: Wave[] = [];
  const glintG: SVGGElement[] = [];
  const boatSlot = svg('g'), islandG = svg('g', {}, ISLAND_ART), boatG = svg('g', { class: 'ts-boat' }, BOAT_ART);
  const fx = svg('g'), gullG = svg('g', { fill: 'none', stroke: '#6b7b85', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const hit = svg('circle', { class: 'ts-hit', r: 50, fill: 'transparent' });
  boatSlot.appendChild(boatG);
  // 뒤 물결부터 쌓는다: 배는 2번 물결 바로 뒤, 섬은 1번 물결 바로 뒤
  for (let i = N - 1; i >= 0; i--) {
    if (i === 1) root.appendChild(boatSlot);
    if (i === 0) root.appendChild(islandG);
    const g = svg('g'), fill = svg('path', { fill: `var(--sw${i + 1})` }), foam = svg('path', { fill: 'none', stroke: 'var(--sw-foam)', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0.8 });
    const gl = svg('g', { fill: 'none', stroke: 'var(--sw-foam)', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0.45 });
    for (let k = 0; k < C.glints; k++) gl.appendChild(svg('path', { 'data-x': Math.random(), 'data-d': 0.3 + Math.random() * 0.5 }));
    g.append(fill, foam, gl);
    glintG[i] = gl;
    root.appendChild(g);
    waves[i] = { g, fill, foam, ph: Math.random() * 6.28, y: 0 };
  }
  root.append(fx, gullG, hit);
  const jet = boatG.querySelector<SVGGElement>('.ts-jet')!, flame = boatG.querySelector<SVGGElement>('.ts-flame')!;
  flame.style.display = 'none';

  let phase: SeaPhase = 'entering', boat: BoatPhase = 'hidden';
  let readyAt = -1, coveredAt = -1, exitAt = -1, doneAt = -1, raf = 0, dead = false;
  const t0 = performance.now();
  let resolveCovered!: () => void, resolveDone!: () => void;
  const covered = new Promise<void>((r) => { resolveCovered = r; });
  const done = new Promise<void>((r) => { resolveDone = r; });

  /** i 번 물결의 멈춤 높이 · 지금 기준 높이 (px) */
  const restY = (i: number) => C.waves[i].top * H;
  const below = () => H + 250 * U * C.objScale; // 화면 아래 (섬 · 배까지 다 가려지는 깊이)
  const enterEnd = (i: number) => i * C.enter.gap + C.enter.dur;
  const waveBase = (i: number, t: number) => {
    if (exitAt >= 0 && t >= exitAt) {
      const k = clamp((t - exitAt - C.exit.delay - (N - 1 - i) * C.exit.gap) / C.exit.dur);
      return restY(i) + (below() - restY(i)) * inCubic(k);
    }
    const k = clamp((t - i * C.enter.gap) / C.enter.dur);
    return below() + (restY(i) - below()) * outQuart(k);
  };
  /** 물결 수면 높이 (x 에서): 두 사인 겹침이 흐르며 · 전체가 살짝 오르내린다 */
  const surface = (i: number, x: number, t: number) => {
    const w = C.waves[i], wv = waves[i], s = t / 1000, a = w.amp * U * C.bob, L = Math.max(240, w.len * W);
    return wv.y + a * Math.sin((x / L) * 6.283 + wv.ph + s * w.speed * 2.2) + a * 0.45 * Math.sin((x / (L * 0.53)) * 6.283 - wv.ph * 1.7 - s * w.speed * 3.1) + a * 0.35 * Math.sin(s * 1.3 + wv.ph);
  };
  /** 수면 곡선 → 부드러운 경로 (Catmull-Rom → 3차 베지어) */
  const drawWave = (i: number, t: number) => {
    const n = Math.max(12, Math.ceil(W / 60)), step = (W + 80) / n, pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) { const x = -40 + k * step; pts.push([x, surface(i, x, t)]); }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let k = 0; k < n; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(n, k + 2)];
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    waves[i].foam.setAttribute('d', d);
    waves[i].fill.setAttribute('d', `${d}L${W + 40} ${H + 400}L-40 ${H + 400}Z`);
    // 물비늘: 수면 조금 아래에서 물결을 따라 천천히 흐르는 짧은 곡선
    const gap = i ? (C.waves[i - 1].top - C.waves[i].top) * H : H * 0.2;
    glintG[i].querySelectorAll('path').forEach((g, k) => {
      const fx = (+g.dataset.x! + (t / 1000) * 0.012 * (k % 2 ? 1 : -1) * Math.sign(C.waves[i].speed || 1) + 1) % 1, x = -20 + fx * (W + 40);
      const y = surface(i, x, t) + Math.max(14, gap * +g.dataset.d!), l = 9 * U;
      g.setAttribute('d', `M${(x - l).toFixed(1)} ${y.toFixed(1)}q${l / 2} ${-4 * U} ${l} 0t${l} 0`);
    });
  };
  const slope = (i: number, x: number, t: number) => (surface(i, x + 8, t) - surface(i, x - 8, t)) / 16;

  // ───────── 섬 · 배 (수면을 탄다)
  let bx = 0, by = 0, ba = 0, bvx = 0, bvy = 0; // 배 화면 위치 · 각도(도) · 속도 (비행 · 추락 중)
  let flyT = -1, crashT = -1, launchT = -1, fly0: readonly [number, number] = [0, 0];
  const boatX = () => W * (W < 600 ? 0.27 : 0.24), islandX = () => W * (W < 600 ? 0.74 : 0.77);
  const place = (g: SVGGElement, x: number, y: number, a: number, s: number) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(2)}) scale(${s.toFixed(3)})`);
  /** 배 단위 좌표 → 화면 좌표 */
  const toScreen = (lx: number, ly: number) => { const r = (ba * Math.PI) / 180, s = U * C.objScale; return [bx + (lx * Math.cos(r) - ly * Math.sin(r)) * s, by + (lx * Math.sin(r) + ly * Math.cos(r)) * s] as const; };

  // ───────── 연기 · 불똥 입자
  const puffs: Puff[] = [];
  const puff = (x: number, y: number, color: string, r0: number, r1: number, life: number, vx = 0, vy = 0) => {
    const el = svg('circle', { fill: color, r: r0 });
    fx.appendChild(el);
    puffs.push({ el, x, y, vx, vy, r0, r1, t: 0, life });
  };
  let lastPuff = 0;

  // ───────── 갈매기
  const gulls: Gull[] = [];
  const spawnGulls = (t: number) => {
    for (let k = 0; k < C.gulls.count; k++) {
      const el = svg('path');
      gullG.appendChild(el);
      const tx = W * (0.36 + k * 0.17 + (Math.random() - 0.5) * 0.06), ty = H * (0.2 + Math.random() * 0.13);
      gulls.push({ el, x: tx + (k - 1) * 40 * U, y: -50 - k * 30, tx, ty, t0: t + k * 260, ph: Math.random() * 6.28, rate: 7 + Math.random() * 2.5, vx: 0, vy: 0, leaving: false });
    }
  };

  // ───────── 누르면 추락
  const onHit = (e: Event) => {
    if (boat !== 'flying') return;
    e.preventDefault(); e.stopPropagation();
    boat = 'crashing'; crashT = performance.now() - t0;
    bvx *= C.crash.drag; bvy = -C.crash.hop * U;
    flame.style.display = 'none';
    hit.classList.remove('on');
    const [ex, ey] = toScreen(-80, -6);
    for (let k = 0; k < 8; k++) puff(ex, ey, k % 2 ? '#b9bfc2' : '#8f989d', 6 * U, 24 * U, 800, (Math.random() - 0.5) * 260, (Math.random() - 0.7) * 200); // 펑
  };
  hit.addEventListener('pointerdown', onHit);
  const onResize = () => measure();
  addEventListener('resize', onResize);

  let prev = 0;
  const frame = (now: number) => {
    if (dead) return;
    const t = now - t0, dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;
    // 물결
    for (let i = 0; i < N; i++) { waves[i].y = waveBase(i, t); drawWave(i, t); }
    if (phase === 'entering' && t >= enterEnd(N - 1)) { phase = 'waiting'; coveredAt = t; resolveCovered(); }
    if (phase === 'waiting' && readyAt >= 0 && t >= coveredAt + C.minHold) { phase = 'exiting'; exitAt = t; root.classList.add('open'); }
    if (phase === 'waiting' && !gulls.length && t >= coveredAt + C.gulls.delay) spawnGulls(t);
    if (phase === 'exiting' && t >= exitAt + C.exit.delay + (N - 1) * C.exit.gap + C.exit.dur) { phase = 'completed'; doneAt = t; resolveDone(); }

    // 섬: 1번 물결 수면 위로 솟았다가 그 물결과 함께 가라앉는다
    const ix = islandX(), ipop = clamp((t - enterEnd(0) - C.pop.island) / C.pop.dur);
    const isink = exitAt >= 0 ? inCubic(clamp((t - exitAt - C.exit.delay - (N - 1) * C.exit.gap) / (C.exit.dur * 0.7))) : 0; // 1번 물결이 내려갈 때 물속으로 잠긴다
    place(islandG, ix, surface(0, ix, t) + 14 * U + ((1 - outBack(ipop, 1.2)) + isink) * 220 * U * C.objScale, slope(0, ix, t) * 8, U * C.objScale * (W < 600 ? 0.85 : 1));

    // 배
    if (boat === 'hidden' && t >= enterEnd(1) + C.pop.boat) boat = 'floating';
    if (boat === 'floating' || boat === 'launching') {
      const x = boatX(), bpop = clamp((t - enterEnd(1) - C.pop.boat) / C.pop.dur);
      bx = x; by = surface(1, x, t) + 10 * U + (1 - outBack(bpop)) * 200 * U;
      ba = (Math.atan(slope(1, x, t)) * 180) / Math.PI * 0.9 + Math.sin(t / 620) * 2.2;
      if (boat === 'floating' && exitAt >= 0 && t >= exitAt) { boat = 'launching'; launchT = t; }
      if (boat === 'launching') {
        const k = (t - launchT) / C.launch.pop;
        jet.setAttribute('transform', `translate(${-50 - 6 * clamp(k)} -6) scale(${outBack(clamp(k), 3).toFixed(3)})`);
        by -= 10 * U * outBack(clamp(k), 2); // 엔진이 튀어나오며 배가 들썩
        if (k >= 0.5) flame.style.display = '';
        if (t >= launchT + C.launch.pop + C.launch.ignite) { boat = 'flying'; flyT = t; root.appendChild(boatG); root.appendChild(hit); hit.classList.add('on'); fly0 = [bx, by]; }
        ba += Math.sin(t / 22) * 1.5 * clamp(k); // 시동 떨림
      }
    }
    if (boat === 'flying') {
      const F = C.flight, k = (t - flyT) / F.dur, p = clamp(k) ** F.accel;
      const [x0, y0] = fly0, dx = W * F.reach + 120 * U, dy = y0 + 220 * U;
      const xs = (q: number) => x0 + dx * (1 - Math.exp(-F.turn * q)) / (1 - Math.exp(-F.turn));
      const ys = (q: number) => y0 - dy * (Math.exp(F.climb * q) - 1) / (Math.exp(F.climb) - 1);
      const nx = xs(p), ny = ys(p), q2 = clamp((t + 16 - flyT) / F.dur) ** F.accel;
      bvx = (xs(q2) - nx) / 0.016; bvy = (ys(q2) - ny) / 0.016;
      bx = nx; by = ny;
      if (Math.hypot(bvx, bvy) > 1) ba = (Math.atan2(bvy, bvx) * 180) / Math.PI;
      if (now - lastPuff > 34) { lastPuff = now; const [ex, ey] = toScreen(-104, -6); puff(ex, ey, Math.random() < 0.5 ? '#fbe08a' : '#f7c3a6', 5 * U * C.objScale, 13 * U * C.objScale, 520); }
      flame.setAttribute('transform', `scale(${(0.8 + 0.6 * clamp(k * 2) + Math.random() * 0.25).toFixed(2)} ${(0.85 + Math.random() * 0.3).toFixed(2)})`);
      if (k >= 1 || bx > W + 200 * U || by < -200 * U) { boat = 'gone'; hit.classList.remove('on'); }
    }
    if (boat === 'crashing') {
      const s = (t - crashT) / 1000;
      bvy += C.crash.gravity * U * dt; bx += bvx * dt; by += bvy * dt;
      // 털썩 튀어 오르며 휘청이다가 (0.35초) 기수부터 곤두박질
      const wob = 26 * Math.sin(s * 30) * Math.exp(-s * 5);
      ba += ((s < 0.35 ? ba : 80) - ba) * clamp(dt * 3.4) + wob * dt * 9;
      if (now - lastPuff > 40) { lastPuff = now; const [ex, ey] = toScreen(-78, -6); puff(ex, ey, Math.random() < 0.6 ? '#aab1b5' : '#cdd1d3', 6 * U, 26 * U, 1000, -bvx * 0.1 + (Math.random() - 0.5) * 40, -70); }
      if (by > H + 200 * U) boat = 'gone';
    }
    boatG.style.display = boat === 'hidden' || boat === 'gone' ? 'none' : '';
    if (boat !== 'hidden' && boat !== 'gone') place(boatG, bx, by, ba, U * C.objScale);
    const [hx, hy] = toScreen(0, -30);
    hit.setAttribute('cx', hx.toFixed(1)); hit.setAttribute('cy', hy.toFixed(1)); hit.setAttribute('r', (64 * U * C.objScale).toFixed(1));

    // 입자
    for (let k = puffs.length - 1; k >= 0; k--) {
      const p = puffs[k];
      p.t += dt * 1000; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy = p.vy * 0.94 - 30 * dt;
      const q = p.t / p.life;
      if (q >= 1) { p.el.remove(); puffs.splice(k, 1); continue; }
      p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('r', (p.r0 + (p.r1 - p.r0) * outQuart(q)).toFixed(1)); p.el.setAttribute('opacity', (0.85 * (1 - q)).toFixed(2));
    }
    // 갈매기: 내려와 맴돌다가, 출항하면 위로 날아간다
    for (const g of gulls) {
      if (t < g.t0) { g.el.setAttribute('d', ''); continue; }
      const s = (t - g.t0) / 1000;
      if (exitAt >= 0 && !g.leaving) { g.leaving = true; g.vx = 80 + Math.random() * 120; g.vy = -60; }
      if (g.leaving) { g.vy -= 520 * dt; g.x += g.vx * U * dt; g.y += g.vy * U * dt; }
      else {
        const k = outQuart(clamp(s / 1.6));
        g.x += (g.tx + Math.sin(s * 0.9 + g.ph) * 36 * U - g.x) * clamp(dt * 2.4);
        g.y = -60 + (g.ty + Math.sin(s * 1.4 + g.ph) * 10 * U + 60) * k;
      }
      const flap = Math.sin(s * (g.leaving ? g.rate * 1.5 : g.rate) + g.ph);
      g.el.setAttribute('d', gullPath(flap));
      g.el.setAttribute('transform', `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) scale(${(U * C.objScale).toFixed(3)})`);
    }
    // 정리: 전환이 끝나고 배 · 갈매기 · 입자가 다 사라지면 (최대 maxLife)
    const gullsOut = gulls.every((g) => g.y < -80 || t < g.t0);
    if (phase === 'completed' && ((boat === 'gone' || boat === 'hidden') && gullsOut && !puffs.length || t > doneAt + C.maxLife)) { destroy(); return; }
    raf = requestAnimationFrame(frame);
  };

  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', onResize);
    hit.removeEventListener('pointerdown', onHit);
    root.remove();
    resolveCovered(); resolveDone();
  }
  document.body.appendChild(root);
  raf = requestAnimationFrame(frame);
  return {
    covered, done, destroy,
    ready() { if (readyAt < 0) readyAt = performance.now() - t0; },
    get phase() { return phase; },
    get boat() { return boat; },
  };
}
