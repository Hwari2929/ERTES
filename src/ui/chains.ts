// 그늘 연출의 체인 · 회중시계 (ui/contract.ts 그늘 단계): 고리를 점으로 이은 간단한 물리 (베를레 적분 + 고리 길이 제약).
// 체인마다 나타나는 순서 · 시각과 사라지는 시각이 무작위다. 고리는 늘어나지 않고 이음새만 관절처럼 꺾인다. 떨어지듯 내려와 멈추는 순간 곧은 체인은 살짝 되튀고, 그 뒤로 바람에 살랑살랑 흔들린다.
// 원근 여섯 겹: 멀수록 작고 옅게, 맨 앞 겹은 화면 앞을 지나는 크고 흐린 체인 (따로 앞 캔버스 + CSS blur, 시계보다 위).
// 회중시계는 무거운 끝점에 매달려 내려오는 순간부터 진자 운동을 한다 (팽팽한 곧은 줄 끝의 진자. .ct-watch 를 끝점 위치 · 줄 각도에 맞춰 돌린다).

interface Pt { x: number; y: number; px: number; py: number; w: number } // w = 1 / 질량 (0 = 고정점)
interface Anchor { i: number; x: number; y0: number; y1: number }
interface Chain { pts: Pt[]; L: number; alpha: number; front: boolean; anchors: Anchor[]; tIn: number; inDur: number; tOut: number; outDur: number; wind: number; wf: number; ph: number; damp: number; bounce: number; vy?: number }

export interface ChainOpts {
  /** 체인이 나타나는 시각 범위 · 사라지는 시각 범위 (초) */
  win: [number, number]; wout: [number, number];
  /** 회중시계가 내려오는 시각 · 끌려 올라가는 시각 (초) */
  watchIn: number; watchOut: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeIn = (k: number) => k * k * k; // 천천히 들리다 끌려 올라간다
const fall = (k: number) => k ** 1.6; // 떨어지듯 점점 빨라지다 끝에서 탁 멈춘다 (체인은 그 기세로 아래로 쏠렸다가 걸린다)
const G = 3600; // 중력 (px/s²): 묵직하게
const STEP = 1 / 120;
const ITER = 6; // 거리 제약 반복 수: 적을수록 이음이 늘었다 줄었다 하는 탄성이 생긴다
const STRETCH = 1.1; // 고리 이음이 늘어날 수 있는 한도 (넘으면 바로 당긴다: 고리 사이가 벌어져 보이지 않게)
const BEND = 1.93; // 이음새가 접힐 수 있는 한계 (1.93 L ≈ 이음새 하나가 최대 약 30° 꺾임: 고리가 지그재그로 꼬이지 않고 부드러운 곡선으로 휜다)

/** 그늘 장면을 시작한다. 반환값: pulse() = 심장 박동에 맞춰 모든 체인이 한 번 출렁인다 */
export function chainScene(cv: HTMLCanvasElement, fcv: HTMLCanvasElement | null, watch: HTMLElement | null, o: ChainOpts, onEnd?: () => void) {
  const ctx0 = cv.getContext('2d'), fctx = fcv?.getContext('2d') || null;
  if (!ctx0) { onEnd?.(); return { pulse: () => {}, lift: () => {} }; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  for (const c of [cv, fcv]) if (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const AU = getComputedStyle(cv).getPropertyValue('--c-brand').trim(); // 런의 강조 호박색 (의식 연출 = 브랜드 호박)
  const k = Math.max(0.6, Math.min(1.25, H / 900)); // 화면 크기에 맞춘 고리 크기

  const chains: Chain[] = [];
  const base = (L: number, alpha: number, front: boolean): Omit<Chain, 'pts' | 'anchors'> => ({ L, alpha, front, tIn: rnd(o.win[0], o.win[1]), inDur: rnd(0.38, 0.55), tOut: rnd(o.wout[0], o.wout[1]), outDur: rnd(0.8, 1.1), wind: rnd(220, 320) * Math.min(1, Math.max(0.35, L / (14 * k) / 0.9)), wf: rnd(0.6, 1.0), ph: rnd(0, Math.PI * 2), damp: 0.995, bounce: 0.5 });
  /** 체인 절반쯤은 화면 위 밖으로 길게 이어진다 (보이는 만큼 더 길게 숨긴다): 천장이 고정점이 아니라 더 위에 걸려 있어, 보이는 윗부분까지 흔들림이 전해진다 */
  const hidden = (len: number) => (Math.random() < 0.5 ? len * rnd(0.8, 1.1) : 0);
  /** 곧게 드리운 체인: 위 끝 하나가 고정점 (hide = 화면 위 밖에 숨은 길이) */
  const drop = (x: number, vis: number, s: number, alpha: number, front: boolean, hide = hidden(vis)) => {
    const L = 14 * s * k, len = vis + hide, n = Math.max(3, Math.round(len / L)), y0 = -n * L - 60;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const px = x + rnd(-1, 1) * i * 0.2; return { x: px, y: y0 + i * L, px, py: y0 + i * L, w: i ? 1 : 0 }; });
    chains.push({ ...base(L, alpha, front), pts, anchors: [{ i: 0, x, y0, y1: -hide - L * 0.5 }] });
  };
  /** 늘어진 U자 체인: 양 끝이 화면 위 밖의 고정점. 숨은 길이가 있으면 더 깊고 넓은 U자의 바닥만 보인다 (보이는 폭은 그대로).
   *  처음 모양은 현수선 (체인이 실제로 늘어지는 모양): 포물선 따위로 놓으면 남는 길이가 바닥에 몰려, 이음새 한계(BEND) 때문에 동그랗게 매듭진 채 굳는다 */
  const swag = (x1: number, x2: number, vis: number, s: number, alpha: number, front: boolean, hide = hidden(vis)) => {
    const sag = vis + hide, wide = Math.sqrt(sag / vis), mid = (x1 + x2) / 2;
    x1 = mid - (mid - x1) * wide; x2 = mid + (x2 - mid) * wide;
    const L = 14 * s * k, hs = (x2 - x1) / 2;
    /** 단조 함수 f(a) = want 를 만족하는 현수선 매개변수 a (f 는 a 가 클수록 작아진다) */
    const solve = (f: (a: number) => number, want: number) => { let lo = hs / 40, hi = hs * 1e4; for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi); if (f(m) > want) lo = m; else hi = m; } return Math.sqrt(lo * hi); };
    const a0 = solve((a) => a * (Math.cosh(hs / a) - 1), sag), len0 = 2 * a0 * Math.sinh(hs / a0); // 바라는 깊이의 현수선 길이
    const n = Math.max(4, Math.round(len0 / L)), c = solve((a) => 2 * a * Math.sinh(hs / a), n * L), depth = c * (Math.cosh(hs / c) - 1);
    const y0 = -depth - 90;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const t = -n * L / 2 + i * L, x = mid + c * Math.asinh(t / c), y = y0 + depth - (Math.sqrt(c * c + t * t) - c); return { x, y, px: x, py: y, w: i && i < n ? 1 : 0 }; });
    pts[0].x = x1; pts[n].x = x2; pts[0].y = pts[n].y = y0; pts[0].px = x1; pts[n].px = x2; pts[0].py = pts[n].py = y0;
    chains.push({ ...base(L, alpha, front), pts, anchors: [{ i: 0, x: x1, y0, y1: -hide - L * 0.5 }, { i: n, x: x2, y0, y1: -hide - L * 0.5 }] });
  };
  /** 원근 여섯 겹: [고리 크기, 줄 수, 진하기]. 멀수록 작고 옅게 (그만큼 짧게), 맨 앞 겹은 앞 캔버스에 크고 흐리게 가장자리로만 (시계 · 가운데를 가리지 않게) */
  const DEPTH: [number, number, number][] = [[0.3, 5, 0.18], [0.42, 4, 0.28], [0.58, 3, 0.42], [0.8, 3, 0.62], [1.05, 2, 0.88]];
  for (const [s, cnt, a] of DEPTH) {
    for (let i = 0; i < cnt; i++) {
      const cx = ((i + rnd(0.15, 0.85)) / cnt) * W * 1.2 - W * 0.1, near = s > 0.7;
      if (near && Math.abs(cx - W / 2) < W * 0.14) continue; // 가까운 체인은 시계 자리를 비운다
      const reach = H * (0.25 + 0.55 * Math.min(1, s)) * rnd(0.6, 1.05);
      if (Math.random() < 0.55) { const span = W * rnd(0.18, 0.34) * (0.6 + s * 0.5); swag(cx - span / 2, cx + span / 2, reach * rnd(0.45, 0.75), s, a, false); }
      else drop(cx, reach, s, a, false);
    }
  }
  if (fctx) { // 맨 앞: 화면 앞을 지나는 크고 흐린 체인 두 줄 (왼쪽 · 오른쪽 가장자리)
    const s = 2.2;
    if (Math.random() < 0.5) swag(-W * 0.2, W * rnd(0.12, 0.2), H * rnd(0.35, 0.5), s, 0.9, true); else drop(W * rnd(0.03, 0.09), H * rnd(0.6, 0.9), s, 0.9, true);
    if (Math.random() < 0.5) swag(W * rnd(0.8, 0.88), W * 1.2, H * rnd(0.3, 0.45), s, 0.9, true); else drop(W * rnd(0.91, 0.97), H * rnd(0.55, 0.85), s, 0.9, true);
  }

  // 회중시계: 무거운 끝점에 매달린 체인. 비스듬히 들린 채 내려와 처음부터 크게 흔들린다
  let wc: Chain | null = null;
  const ww = 150 * k, bx = ww * (70 / 140), by = ww * (10 / 140);
  if (watch) {
    const L = 13 * k, n = Math.round((H * 0.42) / L), th = rnd(18, 24) * (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 180), x = W / 2, y0 = -n * L * Math.cos(th) - 160;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const px = x + Math.sin(th) * i * L, py = y0 + Math.cos(th) * i * L; return { x: px, y: py, px, py, w: i === 0 ? 0 : i === n ? 0.05 : 1 }; });
    wc = { L, alpha: 1, front: false, tIn: o.watchIn, inDur: 0.5, tOut: o.watchOut, outDur: 0.9, wind: 0, wf: 0, ph: 0, damp: 0.9993, bounce: 0.6, pts, anchors: [{ i: 0, x, y0, y1: -L * 0.5 }] };
    watch.style.width = `${ww}px`;
    watch.style.transformOrigin = `${bx}px ${by}px`;
  }
  const all = wc ? [...chains, wc] : chains;

  /** 위 끝: 떨어지듯 빨라지며 내려와 탁 멈추고, 나갈 때는 천천히 들리다 끌려 올라간다. 내려오는 동안 체인 전체를 같이 싣고 내려온다 (step) */
  const anchorY = (c: Chain, a: Anchor, t: number) => {
    if (t >= c.tOut) return a.y1 + (a.y0 - 400 - a.y1) * easeIn(Math.min(1, (t - c.tOut) / c.outDur));
    if (t <= c.tIn) return a.y0;
    return a.y0 + (a.y1 - a.y0) * fall(Math.min(1, (t - c.tIn) / c.inDur));
  };
  /** 회중시계: 무거운 시계가 체인을 팽팽히 당기는 진자. 시계(끝점)만 움직이고 고리는 위 끝 ~ 시계 사이 곧은 줄 위에 놓는다
   *  (고리마다 따로 움직이면 가벼운 체인이 시계보다 먼저 휘둘려 채찍처럼 휘고, 시계가 체인과 따로 꺾여 보인다) */
  const stepWatch = (c: Chain, t: number) => {
    const n = c.pts.length - 1, a = c.pts[0], e = c.pts[n], R = n * c.L, stop = c.tIn + c.inDur;
    const ay = anchorY(c, c.anchors[0], t), dy = ay - a.y;
    if (t > c.tIn && t < stop && dy > 0) { e.y += dy; e.py += dy; c.vy = dy; } // 내려오는 동안 같이 실어 내린다 (비스듬히 들린 채 → 처음부터 크게 흔들린다)
    else if (c.vy) { e.py -= c.vy * c.bounce; c.vy = 0; } // 멈추는 순간 그 기세로 아래로 쏠렸다가 줄에 걸려 튄다
    a.x = c.anchors[0].x; a.y = ay;
    const vx = (e.x - e.px) * c.damp, vy = (e.y - e.py) * c.damp;
    e.px = e.x; e.py = e.y; e.x += vx; e.y += vy + G * STEP * STEP;
    const dx = e.x - a.x, dyy = e.y - a.y, d = Math.hypot(dx, dyy);
    if (d > R) { const k2 = d > R * 1.08 ? 1 : 0.18; e.x -= (dx * (d - R) / d) * k2; e.y -= (dyy * (d - R) / d) * k2; } // 줄은 단단한 용수철: 늘어난 만큼 조금씩 되돌린다 (8% 넘게는 늘지 않는다)
    for (let i = 1; i < n; i++) { const p = c.pts[i]; p.x = p.px = a.x + ((e.x - a.x) * i) / n; p.y = p.py = a.y + ((e.y - a.y) * i) / n; }
  };
  const step = (c: Chain, t: number) => {
    if (c === wc) { stepWatch(c, t); return; }
    // 바람: 느린 두 물결을 겹쳐 살랑살랑 (아래쪽 · U자 가운데일수록 크게)
    const n = c.pts.length - 1, wx = c.wind * (Math.sin(t * c.wf + c.ph) + 0.25 * Math.sin(t * c.wf * 2.1 + c.ph * 1.7)), dt2 = STEP * STEP, two = c.anchors.length > 1;
    const stop = c.tIn + c.inDur, damp = t < c.tIn ? 0.95 : c.damp; // 나타나기 전 (화면 위 밖)에는 늘어진 모양으로 얌전히 가라앉혀 둔다
    // 위 끝이 내려오는 만큼 체인 전체를 같이 실어 내린다 (위 끝이 고리를 밀어 뭉치지 않게). 옮기기만 하고 속도는 건드리지 않다가
    // 위 끝이 멈추는 순간 그때 빠르기를 고리들에 한 번 넘긴다 → 곧게 드리운 체인 · 시계는 그 기세로 아래로 쏠렸다가 늘어나지 않는 고리에 걸려 묵직하게 선다
    const a0 = c.anchors[0], dy = anchorY(c, a0, t) - c.pts[a0.i].y;
    if (t > c.tIn && t < stop && dy > 0) { for (const p of c.pts) if (p.w) { p.y += dy; p.py += dy; } c.vy = dy; }
    else if (c.vy) { const v = two ? 0 : c.vy * c.bounce; c.pts.forEach((p, i) => { if (p.w) p.py -= v * (i / n); }); c.vy = 0; } // 곧은 체인은 그 기세로 아래로 쏠려 늘었다가 되튄다. U자는 넘기지 않는다 (느슨해진 바닥이 접혀 뭉친다)
    for (let i = 0; i <= n; i++) {
      const p = c.pts[i];
      if (!p.w) continue;
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      // 곧은 체인은 끝만이 아니라 위쪽까지 바람을 받는다. U자는 약하게 (바닥이 옆으로 크게 쏠리면 한쪽 팔이 느슨해져 고리가 엉킨다)
      p.x += vx + wx * (two ? 0.75 * Math.sin((Math.PI * i) / n) : Math.sqrt(i / n)) * dt2;
      p.y += vy + G * dt2;
    }
    for (const a of c.anchors) { const p = c.pts[a.i]; p.px = p.x; p.py = p.y; p.x = a.x; p.y = anchorY(c, a, t); }
    for (let it = 0; it < ITER; it++) {
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
    // 늘어남 한도: 위 끝(고정점)부터 차례로 한도(STRETCH)보다 멀어진 점을 끌어당긴다 (그 안에서는 탄성으로 늘었다 줄었다 한다)
    // U자는 왼쪽 → 오른쪽, 오른쪽 → 왼쪽을 번갈아 몇 번 (한 번씩 가운데까지만 당기면 늘어난 길이가 가운데 한 칸에 몰려 고리 하나가 떨어져 떠 보인다)
    const pull = (a: Pt, b: Pt) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d > c.L * STRETCH) { const f = (c.L * STRETCH) / d, nx = a.x + dx * f, ny = a.y + dy * f; b.px += (nx - b.x) * 0.9; b.py += (ny - b.y) * 0.9; b.x = nx; b.y = ny; } }; // 당긴 만큼 속도에 더하지 않는다 (진자가 점점 커지지 않게)
    if (!two) for (let i = 1; i <= n; i++) pull(c.pts[i - 1], c.pts[i]);
    else for (let r = 0; r < 30; r++) { // 남는 늘어남이 없어질 때까지 (보통 한두 번, 떨어진 기세가 걸리는 순간만 여러 번)
      for (let i = 1; i < n; i++) pull(c.pts[i - 1], c.pts[i]);
      for (let i = n - 1; i > 0; i--) pull(c.pts[i + 1], c.pts[i]);
      const a = c.pts[0], b = c.pts[1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < c.L * STRETCH * 1.02) break;
    }
  };
  /** 고리: 이음새마다 정면 고리(타원 테)와 옆면 고리(막대)가 번갈아 이어진다. 한 색, 명암 없음 */
  const draw = (c: Chain) => {
    const L = c.L, n = c.pts.length - 1, ctx = c.front && fctx ? fctx : ctx0;
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
        // 명암 없이 한 색 (밝은 줄 · 어두운 줄 두 겹으로 반을 가르지 않는다): 정면 고리 = 타원 테, 옆면 고리 = 막대
        ctx.strokeStyle = AU;
        if (pass === 0) { ctx.beginPath(); ctx.ellipse(0, 0, L * 0.62, L * 0.32, 0, 0, Math.PI * 2); ctx.lineWidth = L * 0.18; ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(-L * 0.58, 0); ctx.lineTo(L * 0.58, 0); ctx.lineWidth = L * 0.17; ctx.stroke(); }
      }
    }
    ctx.restore();
  };
  const placeWatch = () => {
    if (!wc || !watch) return;
    const e = wc.pts[wc.pts.length - 1], p = wc.pts[0];
    const ang = -Math.atan2(e.x - p.x, e.y - p.y);
    watch.style.transform = `translate(${e.x - bx}px, ${e.y - by}px) rotate(${ang}rad)`;
    watch.style.visibility = t >= wc.tIn - 0.02 ? '' : 'hidden'; // 내려올 차례 전에는 위 끝에 비치지 않게
  };

  const t0 = performance.now(), end = Math.max(o.watchOut, o.wout[1]) + 1.5;
  let acc = 0, last = t0, t = 0, c0lift = 1e9; // t = 물리 시계: 한 칸(STEP)씩만 간다. 프레임이 밀려도(탭 전환 · GC) 위 끝이 한 번에 건너뛰지 않게 (건너뛰면 고리가 접혀 뭉친다)
  const frame = (now: number) => {
    if (!cv.isConnected) { onEnd?.(); return; }
    acc += Math.min(0.2, (now - last) / 1000); last = now; // 밀린 프레임은 한 칸씩 따라잡는다 (연출 시각표와 어긋나지 않게)
    while (acc >= STEP) { t += STEP; for (const c of all) if (c !== wc || t >= c.tIn) step(c, t); acc -= STEP; } // 시계는 내려오기 전까지 처음 모양 그대로 (비스듬히 들린 채 내려와야 크게 흔들린다). 체인은 위 밖에서 미리 늘어진 모양을 잡는다
    for (const x of [ctx0, fctx]) if (x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); }
    const shown = (c: Chain) => t >= c.tIn - 0.02; // 나타날 시각 전에는 그리지 않는다 (위 밖에 걸려 있어도 끝이 비치지 않게)
    for (const c of chains.filter((x) => !x.front && shown(x)).sort((a, b) => a.L - b.L)) draw(c); // 먼 것부터
    for (const c of chains.filter((x) => x.front && shown(x))) draw(c);
    if (wc) draw(wc);
    placeWatch();
    const gone = t > c0lift && all.every((c) => t > c.tOut + c.outDur);
    if (t < end && !gone) requestAnimationFrame(frame); else onEnd?.();
  };
  placeWatch();
  requestAnimationFrame(frame);
  return {
    /** 심장 박동: 모든 체인을 위로 한 번 툭 친다 */
    pulse: () => { for (const c of all) for (const p of c.pts) if (p.w) p.py += 1.6 * (c === wc ? 0.5 : 1); },
    /** 지금 바로 끌려 올라가기 시작한다 (넘기기 · 명부로 넘어갈 때). 아직 안 내려온 체인은 그대로 둔다 (그리지 않는다) */
    lift: () => { c0lift = t; for (const c of all) { if (t < c.tIn) { c.alpha = 0; c.tOut = c.tIn; continue; } c.tOut = Math.min(c.tOut, t + Math.random() * 0.25); c.outDur = Math.min(c.outDur, 0.8); } },
  };
}

