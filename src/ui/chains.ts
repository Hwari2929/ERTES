// 그늘 연출의 체인 · 회중시계 (ui/contract.ts 그늘 단계): 고리를 점으로 이은 간단한 물리 (베를레 적분 + 고리 길이 제약).
// 체인마다 나타나는 순서 · 시각과 사라지는 시각이 무작위다. 이음새가 관절처럼 꺾여 떨어질 때 휘청이고, 멈춘 뒤에도 바람에 날리듯 조금씩 흔들린다.
// 회중시계는 무거운 끝점에 매달려 내려오는 순간부터 진자 운동을 한다 (.ct-watch 를 끝점 위치 · 마지막 고리 각도에 맞춰 돌린다).

interface Pt { x: number; y: number; px: number; py: number; w: number } // w = 1 / 질량 (0 = 고정점)
interface Anchor { i: number; x: number; y0: number; y1: number }
interface Chain { pts: Pt[]; L: number; alpha: number; blur: boolean; anchors: Anchor[]; tIn: number; tOut: number; outDur: number; wind: number; ph: number; damp: number }

export interface ChainOpts {
  /** 체인이 나타나는 시각 범위 · 사라지는 시각 범위 (초) */
  win: [number, number]; wout: [number, number];
  /** 회중시계가 내려오는 시각 · 끌려 올라가는 시각 (초) */
  watchIn: number; watchOut: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeIn = (k: number) => k * k * k; // 천천히 들리다 확 끌려 올라간다
const G = 2400; // 중력 (px/s²)
const STEP = 1 / 120;
const VMAX = 1500; // 떨어지는 최고 속도 (px/s, 공기 저항): 너무 빨리 떨어지다 멈추면 채찍처럼 휘청인다
const BEND = 1.6; // 이음새가 접힐 수 있는 한계 (1.6 L ≈ 이음새 하나가 최대 약 75° 꺾임)

/** 그늘 장면을 시작한다. 반환값: pulse() = 심장 박동에 맞춰 모든 체인이 한 번 출렁인다 */
export function chainScene(cv: HTMLCanvasElement, watch: HTMLElement | null, o: ChainOpts) {
  const ctx = cv.getContext('2d');
  if (!ctx) return { pulse: () => {} };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const css = getComputedStyle(cv), AU = css.getPropertyValue('--lp-au').trim(), LO = css.getPropertyValue('--lp-au-lo').trim();
  const k = Math.max(0.6, Math.min(1.25, H / 900)); // 화면 크기에 맞춘 고리 크기

  const chains: Chain[] = [];
  const base = (L: number, alpha: number, blur: boolean): Omit<Chain, 'pts' | 'anchors'> => ({ L, alpha, blur, tIn: rnd(o.win[0], o.win[1]), tOut: rnd(o.wout[0], o.wout[1]), outDur: rnd(0.5, 0.8), wind: rnd(18, 34), ph: rnd(0, Math.PI * 2), damp: 0.994 });
  /** 곧게 드리운 체인: 위 끝 하나가 고정점 */
  const drop = (fx: number, flen: number, s: number, alpha: number, blur: boolean) => {
    const L = 14 * s * k, n = Math.max(3, Math.round((flen * H) / L)), x = fx * W, y0 = -n * L - 60;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const px = x + rnd(-2, 2) * i * 0.3; return { x: px, y: y0 + i * L, px, py: y0 + i * L, w: i ? 1 : 0 }; });
    chains.push({ ...base(L, alpha, blur), pts, anchors: [{ i: 0, x, y0, y1: -L * 0.5 }] });
  };
  /** 늘어진 U자 체인: 양 끝이 화면 위 밖의 고정점 */
  const swag = (fx1: number, fx2: number, fsag: number, s: number, alpha: number, blur: boolean) => {
    const L = 14 * s * k, x1 = fx1 * W, x2 = fx2 * W, span = x2 - x1, sag = fsag * H;
    const len = span + (8 / 3) * (sag * sag) / span, n = Math.max(4, Math.round(len / L)), y0 = -sag - 90;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = x1 + span * t, y = y0 + 4 * sag * t * (1 - t); return { x, y, px: x, py: y, w: i && i < n ? 1 : 0 }; });
    chains.push({ ...base(L, alpha, blur), pts, anchors: [{ i: 0, x: x1, y0, y1: -L * 0.5 }, { i: n, x: x2, y0, y1: -L * 0.5 }] });
  };
  // 세 겹 원근: 먼 겹은 작고 옅게, 가까운 겹은 크게 (캔버스 blur 는 획마다 걸려 너무 무거워 쓰지 않는다). 자리도 조금씩 흔든다
  const j = () => rnd(-0.02, 0.02);
  swag(0.05 + j(), 0.37 + j(), 0.26, 0.5, 0.36, true); swag(0.62 + j(), 0.95 + j(), 0.23, 0.5, 0.36, true);
  drop(0.29 + j(), 0.38, 0.5, 0.36, true); drop(0.71 + j(), 0.32, 0.5, 0.36, true);
  swag(-0.04 + j(), 0.35 + j(), 0.35, 0.75, 0.75, false); swag(0.66 + j(), 1.05 + j(), 0.32, 0.75, 0.75, false);
  drop(0.19 + j(), 0.56, 0.75, 0.75, false); drop(0.83 + j(), 0.48, 0.75, 0.75, false);
  swag(-0.14 + j(), 0.24 + j(), 0.45, 1.15, 1, false); drop(0.93 + j(), 0.76, 1.15, 1, false);

  // 회중시계: 무거운 끝점에 매달린 체인. 비스듬히 들린 채 내려와 처음부터 크게 흔들린다
  let wc: Chain | null = null;
  const ww = 150 * k, bx = ww * (70 / 140), by = ww * (10 / 140);
  if (watch) {
    const L = 13 * k, n = Math.round((H * 0.42) / L), th = rnd(26, 34) * (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 180), x = W / 2, y0 = -n * L * Math.cos(th) - 160;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const px = x + Math.sin(th) * i * L, py = y0 + Math.cos(th) * i * L; return { x: px, y: py, px, py, w: i === 0 ? 0 : i === n ? 0.12 : 1 }; });
    wc = { L, alpha: 1, blur: false, tIn: o.watchIn, tOut: o.watchOut, outDur: 0.75, wind: 0, ph: 0, damp: 0.9993, pts, anchors: [{ i: 0, x, y0, y1: -L * 0.5 }] };
    watch.style.width = `${ww}px`;
    watch.style.transformOrigin = `${bx}px ${by}px`;
  }
  const all = wc ? [...chains, wc] : chains;

  const anchorY = (c: Chain, a: Anchor, t: number) => {
    if (t >= c.tOut) return a.y1 + (a.y0 - 400 - a.y1) * easeIn(Math.min(1, (t - c.tOut) / c.outDur));
    if (t <= c.tIn) return a.y0;
    // 위 끝도 체인과 같이 (중력 + 최고 속도) 떨어지다가 제자리에서 멈춘다: 체인이 밀려 뭉치지 않고, 멈출 때 끝까지 당겨지며 흔들린다
    const dt = t - c.tIn, t1 = VMAX / G, d = dt < t1 ? 0.5 * G * dt * dt : 0.5 * G * t1 * t1 + VMAX * (dt - t1);
    return Math.min(a.y1, a.y0 + d);
  };
  /** 위 끝이 제자리에 닿는 시각 (닿은 뒤 잠깐 더 감쇠해서 휘청임을 가라앉힌다) */
  const stopAt = (c: Chain) => { const h = c.anchors[0].y1 - c.anchors[0].y0, t1 = VMAX / G, d1 = 0.5 * G * t1 * t1; return c.tIn + (h <= d1 ? Math.sqrt((2 * h) / G) : t1 + (h - d1) / VMAX); };
  const stops = new Map(all.map((c) => [c, stopAt(c)] as const));
  const step = (c: Chain, t: number) => {
    const n = c.pts.length - 1, wx = c.wind * Math.sin(t * 0.9 + c.ph), dt2 = STEP * STEP, vm = VMAX * STEP;
    const st = stops.get(c) ?? 0, damp = c !== wc && t > st && t < st + 0.8 ? 0.982 : c.damp;
    for (let i = 0; i <= n; i++) {
      const p = c.pts[i];
      if (!p.w) continue;
      const vx = (p.x - p.px) * damp, vy = Math.min(vm, (p.y - p.py) * damp);
      p.px = p.x; p.py = p.y;
      p.x += vx + wx * (i / n) * dt2; p.y += vy + G * dt2;
    }
    for (const a of c.anchors) { const p = c.pts[a.i]; p.px = p.x; p.py = p.y; p.x = a.x; p.y = anchorY(c, a, t); }
    for (let it = 0; it < 16; it++) {
      for (let i = 0; i < n; i++) {
        const a = c.pts[i], b = c.pts[i + 1], ws = a.w + b.w;
        if (!ws) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - c.L) / d / ws;
        a.x += dx * f * a.w; a.y += dy * f * a.w; b.x -= dx * f * b.w; b.y -= dy * f * b.w;
      }
      // 관절: 이음새는 일정 각도 넘게 접히지 않는다 (한 칸 건너 고리끼리 BEND · L 보다 가까워지지 않게) → 꼬임 · 뭉침 없이 휘어진다
      for (let i = 0; i < n - 1; i++) {
        const a = c.pts[i], b = c.pts[i + 2], ws = a.w + b.w;
        if (!ws) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = BEND * c.L;
        if (d >= min) continue;
        const f = (d - min) / d / ws;
        a.x += dx * f * a.w; a.y += dy * f * a.w; b.x -= dx * f * b.w; b.y -= dy * f * b.w;
      }
    }
  };
  /** 고리: 이음새마다 정면 고리(구멍 뚫린 타원)와 옆면 고리(막대)가 번갈아 이어진다 */
  const draw = (c: Chain) => {
    const L = c.L, n = c.pts.length - 1;
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (let i = 0; i < n; i++) {
        if ((i % 2) !== pass) continue;
        const a = c.pts[i], b = c.pts[i + 1];
        if (a.y < -L * 2 && b.y < -L * 2) continue;
        ctx.setTransform(dpr, 0, 0, dpr, ((a.x + b.x) / 2) * dpr, ((a.y + b.y) / 2) * dpr);
        ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        if (pass === 0) {
          ctx.beginPath(); ctx.ellipse(0, 0, L * 0.64, L * 0.34, 0, 0, Math.PI * 2);
          ctx.lineWidth = L * 0.22; ctx.strokeStyle = LO; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(0, -L * 0.03, L * 0.6, L * 0.3, 0, Math.PI * 1.05, Math.PI * 1.95);
          ctx.lineWidth = L * 0.08; ctx.strokeStyle = AU; ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(-L * 0.6, 0); ctx.lineTo(L * 0.6, 0);
          ctx.lineWidth = L * 0.2; ctx.strokeStyle = LO; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-L * 0.52, -L * 0.03); ctx.lineTo(L * 0.52, -L * 0.03);
          ctx.lineWidth = L * 0.08; ctx.strokeStyle = AU; ctx.stroke();
        }
      }
    }
    ctx.restore();
  };
  const placeWatch = () => {
    if (!wc || !watch) return;
    const e = wc.pts[wc.pts.length - 1], p = wc.pts[wc.pts.length - 2];
    const ang = -Math.atan2(e.x - p.x, e.y - p.y);
    watch.style.transform = `translate(${e.x - bx}px, ${e.y - by}px) rotate(${ang}rad)`;
  };

  const t0 = performance.now(), end = Math.max(o.watchOut, o.wout[1]) + 1.5;
  let acc = 0, last = t0;
  const frame = (now: number) => {
    if (!cv.isConnected) return;
    const t = (now - t0) / 1000;
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    while (acc >= STEP) { const ts = t - acc; for (const c of all) step(c, ts); acc -= STEP; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    for (const c of chains) draw(c);
    if (wc) draw(wc);
    placeWatch();
    if (t < end) requestAnimationFrame(frame);
  };
  placeWatch();
  requestAnimationFrame(frame);
  return {
    /** 심장 박동: 모든 체인을 위로 한 번 툭 친다 */
    pulse: () => { for (const c of all) for (const p of c.pts) if (p.w) p.py += 5 * (c === wc ? 0.5 : 1); },
  };
}
