// 그늘 연출의 체인 · 회중시계 (ui/contract.ts 그늘 단계): 고리를 점으로 이은 간단한 물리 (베를레 적분 + 고리 길이 제약).
// 체인마다 나타나는 순서 · 시각과 사라지는 시각이 무작위다. 고리는 늘어나지 않고(스프링 느낌 없이) 이음새만 관절처럼 꺾이며, 멈춘 뒤에도 바람에 날리듯 조금씩 흔들린다.
// 원근 여섯 겹: 멀수록 작고 옅게, 맨 앞 겹은 화면 앞을 지나는 크고 흐린 체인 (따로 앞 캔버스 + CSS blur, 시계보다 위).
// 회중시계는 무거운 끝점에 매달려 내려오는 순간부터 진자 운동을 한다 (.ct-watch 를 끝점 위치 · 마지막 고리 각도에 맞춰 돌린다).

interface Pt { x: number; y: number; px: number; py: number; w: number } // w = 1 / 질량 (0 = 고정점)
interface Anchor { i: number; x: number; y0: number; y1: number }
interface Chain { pts: Pt[]; L: number; alpha: number; front: boolean; anchors: Anchor[]; tIn: number; tOut: number; outDur: number; wind: number; ph: number; damp: number }

export interface ChainOpts {
  /** 체인이 나타나는 시각 범위 · 사라지는 시각 범위 (초) */
  win: [number, number]; wout: [number, number];
  /** 회중시계가 내려오는 시각 · 끌려 올라가는 시각 (초) */
  watchIn: number; watchOut: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeIn = (k: number) => k * k * k; // 천천히 들리다 확 끌려 올라간다
const G = 2000; // 중력 (px/s²)
const STEP = 1 / 120;
const VMAX = 1100; // 떨어지는 최고 속도 (px/s, 공기 저항): 너무 빨리 떨어지다 멈추면 채찍처럼 휘청인다
const BEND = 1.6; // 이음새가 접힐 수 있는 한계 (1.6 L ≈ 이음새 하나가 최대 약 75° 꺾임)

/** 그늘 장면을 시작한다. 반환값: pulse() = 심장 박동에 맞춰 모든 체인이 한 번 출렁인다 */
export function chainScene(cv: HTMLCanvasElement, fcv: HTMLCanvasElement | null, watch: HTMLElement | null, o: ChainOpts) {
  const ctx0 = cv.getContext('2d'), fctx = fcv?.getContext('2d') || null;
  if (!ctx0) return { pulse: () => {} };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  for (const c of [cv, fcv]) if (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const css = getComputedStyle(cv), AU = css.getPropertyValue('--lp-au').trim(), LO = css.getPropertyValue('--lp-au-lo').trim();
  const k = Math.max(0.6, Math.min(1.25, H / 900)); // 화면 크기에 맞춘 고리 크기

  const chains: Chain[] = [];
  const base = (L: number, alpha: number, front: boolean): Omit<Chain, 'pts' | 'anchors'> => ({ L, alpha, front, tIn: rnd(o.win[0], o.win[1]), tOut: rnd(o.wout[0], o.wout[1]), outDur: rnd(0.6, 0.9), wind: rnd(10, 22), ph: rnd(0, Math.PI * 2), damp: 0.99 });
  /** 곧게 드리운 체인: 위 끝 하나가 고정점 */
  const drop = (x: number, len: number, s: number, alpha: number, front: boolean) => {
    const L = 14 * s * k, n = Math.max(3, Math.round(len / L)), y0 = -n * L - 60;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const px = x + rnd(-1, 1) * i * 0.2; return { x: px, y: y0 + i * L, px, py: y0 + i * L, w: i ? 1 : 0 }; });
    chains.push({ ...base(L, alpha, front), pts, anchors: [{ i: 0, x, y0, y1: -L * 0.5 }] });
  };
  /** 늘어진 U자 체인: 양 끝이 화면 위 밖의 고정점 */
  const swag = (x1: number, x2: number, sag: number, s: number, alpha: number, front: boolean) => {
    const L = 14 * s * k, span = x2 - x1;
    const len = span + (8 / 3) * (sag * sag) / span, n = Math.max(4, Math.round(len / L)), y0 = -sag - 90;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = x1 + span * t, y = y0 + 4 * sag * t * (1 - t); return { x, y, px: x, py: y, w: i && i < n ? 1 : 0 }; });
    chains.push({ ...base(L, alpha, front), pts, anchors: [{ i: 0, x: x1, y0, y1: -L * 0.5 }, { i: n, x: x2, y0, y1: -L * 0.5 }] });
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
    const L = 13 * k, n = Math.round((H * 0.42) / L), th = rnd(26, 34) * (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 180), x = W / 2, y0 = -n * L * Math.cos(th) - 160;
    const pts = Array.from({ length: n + 1 }, (_, i) => { const px = x + Math.sin(th) * i * L, py = y0 + Math.cos(th) * i * L; return { x: px, y: py, px, py, w: i === 0 ? 0 : i === n ? 0.12 : 1 }; });
    wc = { L, alpha: 1, front: false, tIn: o.watchIn, tOut: o.watchOut, outDur: 0.75, wind: 0, ph: 0, damp: 0.9993, pts, anchors: [{ i: 0, x, y0, y1: -L * 0.5 }] };
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
    const st = stops.get(c) ?? 0, damp = c !== wc && t > st && t < st + 1.2 ? 0.975 : c.damp; // 멈춘 직후 1.2초는 더 무겁게 가라앉힌다
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
    // 늘어나지 않는 고리: 위 끝(고정점)부터 차례로 고리 길이보다 멀어진 점을 끌어당긴다 (끈적한 스프링 반동 없이 체인처럼 무겁게)
    if (c.anchors.length === 1) {
      for (let i = 1; i <= n; i++) {
        const a = c.pts[i - 1], b = c.pts[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d > c.L) { const f = c.L / d, nx = a.x + dx * f, ny = a.y + dy * f; b.px += (nx - b.x) * 0.9; b.py += (ny - b.y) * 0.9; b.x = nx; b.y = ny; } // 당긴 만큼 속도에 더하지 않는다 (진자가 점점 커지지 않게)
      }
    }
  };
  /** 고리: 이음새마다 정면 고리(구멍 뚫린 타원)와 옆면 고리(막대)가 번갈아 이어진다 */
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
    for (const x of [ctx0, fctx]) if (x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); }
    const shown = (c: Chain) => t >= c.tIn - 0.02; // 나타날 시각 전에는 그리지 않는다 (위 밖에 걸려 있어도 끝이 비치지 않게)
    for (const c of chains.filter((x) => !x.front && shown(x)).sort((a, b) => a.L - b.L)) draw(c); // 먼 것부터
    for (const c of chains.filter((x) => x.front && shown(x))) draw(c);
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

/** 그늘 장면의 은하 하늘: 에란테스 갤럭시(기본 테마) 바탕색에 옅은 성운 몇 덩이와 별을 한 번만 그린다 (테마를 바꿔도 이 장면은 갤럭시 색) */
export function paintSky(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const probe = document.createElement('i');
  probe.setAttribute('data-ui-theme', 'galaxy');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe), v = (n: string) => cs.getPropertyValue(n).trim();
  const bg = v('--bg'), info = v('--c-info'), brand = v('--c-brand'), chalk = v('--c-chalk');
  probe.remove();
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 성운: 정보 파랑 · 브랜드 호박을 아주 옅게 (가운데 띠를 따라)
  for (let i = 0; i < 7; i++) {
    const x = rnd(0.05, 0.95) * W, y = H * (0.25 + 0.5 * (x / W)) + rnd(-0.18, 0.18) * H, r = rnd(0.18, 0.42) * Math.max(W, H);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    ctx.globalAlpha = rnd(0.05, 0.11);
    g.addColorStop(0, i % 3 === 2 ? brand : info); g.addColorStop(1, bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // 별: 작은 별 다수 + 밝은 별 몇 개 (십자 반짝임)
  ctx.fillStyle = chalk;
  for (let i = 0; i < Math.round((W * H) / 2600); i++) {
    ctx.globalAlpha = rnd(0.15, 0.75);
    ctx.beginPath(); ctx.arc(rnd(0, W), rnd(0, H), rnd(0.35, 1.1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = chalk; ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = rnd(0, W), y = rnd(0, H), r = rnd(4, 9);
    ctx.globalAlpha = rnd(0.35, 0.8); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
