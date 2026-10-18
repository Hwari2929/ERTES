// 이타카 테마: 바다 화면 전환 (themefx.ts 가 큰 화면 전환에 부른다). 게임 코드와 독립된 SVG 오버레이.
//   등장   물결 N겹이 아래에서 차례로 차올라 화면을 덮는다. 먼저 오는 물결일수록 낮게 멈추고 앞에 그린다 (원근: 앞 = 아래).
//          물결은 무대 소품 골판지처럼 모양이 고정된 판이고, 판째로 좌우로 흔들리고 살짝 기울며 오르내린다.
//          판마다 위 → 아래 그라디언트 + 가장자리 위로 번지는 같은 색의 밝은 빛 띠 (드롭 섀도를 한 번 구워 붙인 이미지, 흰 선 없이 깊이감). 판 색은 전환마다 노랑 ~ 에메랄드 파스텔에서 무작위.
//          섬은 1번 물결 뒤 · 배는 2번 물결 뒤에 끼어 있다가 그 물결이 닿으면 물 위로 솟는다 (아랫부분은 앞 물결에 가린다)
//   대기   판들이 제각각 흔들리고, 배 · 섬은 자기 물결 수면을 타고 떠 있다. 오래 걸리면 갈매기 3마리가 내려온다
//   출항   ready() 뒤: 배(이타카제 왕복선) 뒤에서 제트 엔진이 튀어나와 점화 → 거의 수평으로 가속하다 기수가 들리며 오른쪽 위로 솟구쳐 사라진다.
//          단, 배가 다 떠오르기도 전에 로딩이 끝났으면 출항 없이 제자리에 떠 있다가, 맨 앞 판이 내려가기 시작한 조금 뒤 쫀득하게 떨어진다 (빠른 전환).
//          물결은 등장 역순으로 내려가며 다음 화면을 드러내고, 섬은 1번 물결을 따라 물속으로 잠긴다. 갈매기는 위로 날아간다
//   이스터에그  날고 있는 배를 누르면 엔진이 꺼지고 연기를 뿜으며 곤두박질친다. 전환 흐름과는 완전히 따로 돈다
// 상태: 전환 entering → waiting → exiting → completed, 배 hidden → floating → (launching → flying → crashing | sinking) → gone.
// 물결 판의 모양 · 빛 띠는 크기가 바뀔 때만 다시 만들고, 매 프레임에는 판의 transform 만 바꾼다 (requestAnimationFrame 한 줄기, 필터 없음).
// 수치는 아래 SEA 설정에서 조절한다. 크기는 화면 짧은 변 기준 배율(unit)로 맞춰 휴대폰 · 데스크톱 모두 같은 구도.

export type SeaPhase = 'entering' | 'waiting' | 'exiting' | 'completed';
export type BoatPhase = 'hidden' | 'floating' | 'launching' | 'flying' | 'crashing' | 'sinking' | 'gone';

export const SEA = {
  /** 물결 판 (앞 → 뒤 = 등장 순서). top: 멈추는 높이 (화면 높이 비율, 마지막 판은 화면 위 끝을 넘겨 빈틈이 없게), amp: 물마루 높이 px, len: 물결 길이 (화면 폭 비율) */
  waves: [
    { top: 0.8, amp: 13, len: 0.36 },
    { top: 0.645, amp: 12, len: 0.42 },
    { top: 0.495, amp: 11, len: 0.33 },
    { top: 0.35, amp: 10, len: 0.45 },
    { top: 0.205, amp: 9, len: 0.38 },
    { top: -0.08, amp: 8, len: 0.5 },
  ],
  /** 판 색: 전환마다 판마다 무작위 (HSL 파스텔). 색 띠는 [hue 범위, 뽑힐 비중] — 민트 · 하늘색 위주, 에메랄드는 가끔 (노랑은 섬 모래색과 겹쳐 뺀다).
   *  이웃 판과는 hueGap 도 · lightGap %p 중 하나 이상 벌어지게. 판 안은 위가 밝고 아래가 deep 만큼 짙은 그라디언트
   *  (가장자리 위로 번지는 빛 띠는 glow) */
  palette: { zones: [[[156, 176], 0.5], [[180, 198], 0.36], [[142, 154], 0.14]] as [number[], number][], sat: [64, 82], light: [84, 91], hueGap: 12, lightGap: 3, deep: 5 },
  glow: { alpha: 0.15, reach: 34, blur: 13, light: 13 }, // 판 가장자리 위로 번지는 빛 띠 (드롭 섀도): 불투명도 · 수면 위로 뻗는 높이 px · 번짐 px · 판 색보다 밝게 %p.
  // 빛 띠는 판 모양을 만들 때 캔버스에 한 번만 그려 이미지로 붙인다 (매 프레임 필터 계산 없이 판과 함께 움직일 뿐)
  sway: { x: 14, y: 5, tilt: 0.7 }, // 판 흔들림: 좌우 px · 위아래 px · 기울기 도
  stars: { count: 6, size: [5.5, 10], period: [1.6, 3] }, // 판마다 반짝이는 흰 별 수 · 크기 px · 점멸 주기 초
  enter: { dur: 560, gap: 62 }, // 판 하나가 차오르는 시간 · 다음 판까지 간격 (ms)
  exit: { dur: 620, gap: 70, delay: 230, fastDelay: 60 }, // 내려가는 시간 · 간격 · 출항 시작 뒤 첫 판이 움직이기까지 (가라앉기면 fastDelay)
  minHold: 260, // 출항할 때: 다 덮은 뒤 최소 대기 (배가 잠깐 떠 있게)
  fastHold: 90, // 가라앉기일 때: 다 덮은 뒤 대기
  pop: { island: 140, boat: 60, dur: 640, bounce: 2.8 }, // 섬 · 배가 솟는 시점 (그 물결이 닿은 뒤 ms) · 솟는 시간 · 출렁임 (튀어 올랐다 가라앉는 정도)
  sink: { bounce: 2.2 }, // 물결과 함께 잠길 때 먼저 살짝 떠올랐다 가라앉는 정도
  /** 출항 못 한 배: 2번 판이 내려가도 그 자리에 떠 있다가, 맨 앞(아래) 판이 내려가기 시작하고 delay 뒤에 쫀득하게 (움찔 → 가속) 떨어진다 */
  drop: { delay: 350, dur: 720, bounce: 2.4 },
  gulls: { count: 3, delay: 1500 }, // 다 덮은 뒤 이만큼 로딩이 길어지면 갈매기
  launch: { pop: 200, ignite: 140 }, // 엔진이 튀어나오는 시간 · 점화 뒤 출발까지
  /** 비행 궤적: dur 동안 진행도 p = (t/dur)^accel, x 는 앞쪽에서 빨리 나아가다 둔해지고 (turn), y 는 지수로 뒤로 갈수록 급상승 (climb) */
  flight: { dur: 1350, accel: 1.7, turn: 2.2, climb: 4.2, reach: 0.66 },
  crash: { gravity: 1500, drag: 0.3, hop: 360 }, // 추락 중력 px/s² · 누른 순간 남는 속도 비율 · 털썩 튀어 오르는 속도
  objScale: 0.98, // 섬 · 배 크기 배율 (화면 짧은 변 기준 배율에 곱한다)
  gullScale: 1.3, // 갈매기 크기 배율
  maxLife: 7000, // 전환이 끝난 뒤 배 · 갈매기를 기다리는 최대 시간
};

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const outQuart = (t: number) => 1 - (1 - t) ** 4;
const inCubic = (t: number) => t * t * t;
const inBack = (t: number, k = 1.7) => (k + 1) * t ** 3 - k * t * t; // 살짝 뒤로(위로) 움찔했다가 가속
const outBack = (t: number, k = 1.6) => 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, html = '') => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (html) el.innerHTML = html;
  return el;
};
let uid = 0;

// ───────────────────────── 그림 (단위 좌표: 배 · 섬은 수면 가운데가 원점, 오른쪽이 뱃머리)
/** 이타카제 하이엔드 왕복선 (테두리 없이 둥글고 통통하게, 면 음영 · 하이라이트만): 흰 콩꼴 선체 (아래는 옅은 청회색 음영) · 민트 띠 · 동그란 창 · 물방울 캐노피 ·
 *  통통한 날개 돛 · 안테나 구슬 · 항해등. 엔진(.ts-jet)은 고물 안에 숨어 있다 */
const BOAT_ART = `
  <g class="ts-jet" transform="translate(-56 -12) scale(0)">
    <g class="ts-flame"><path d="M-34 0 Q-64 -14 -80 0 Q-64 14 -34 0Z" fill="#ffa48c"/><path d="M-34 0 Q-55 -9 -67 0 Q-55 9 -34 0Z" fill="#ffc27a"/><path d="M-34 0 Q-46 -5 -53 0 Q-46 5 -34 0Z" fill="#fff0a6"/></g>
    <path d="M-37 -8 Q-37 -11 -33 -11 L-25 -11 V11 L-33 11 Q-37 11 -37 8Z" fill="#7d8c9a"/>
    <rect x="-28" y="-13" width="38" height="26" rx="13" fill="#56708a"/>
    <rect x="-24" y="-13" width="30" height="9" rx="4.5" fill="#6d88a2"/>
    <rect x="-19" y="-13" width="6" height="26" fill="#8fe6d4"/>
    <circle cx="1" cy="0" r="4" fill="#ffd2c4"/>
  </g>
  <path d="M-64 -8 Q-66 20 -30 21 L44 21 Q80 20 82 -8Z" fill="#ffffff"/>
  <path d="M-58 10 Q-44 21 -28 21 L44 21 Q72 20 79 4 Q40 15 -58 10Z" fill="#e3edf2"/>
  <path d="M-66 -9 Q-68 -27 -48 -27 L52 -27 Q84 -27 86 -11 Q86 -6 80 -6 L-61 -6 Q-66 -6 -66 -9Z" fill="#ffffff"/>
  <path d="M-52 -11 L70 -11" stroke="#eef3f6" stroke-width="3" stroke-linecap="round"/>
  <rect x="-64" y="-10" width="148" height="6" rx="3" fill="#9de8d6"/>
  <g fill="#5d84a0"><circle cx="-34" cy="-16" r="5.5"/><circle cx="-16" cy="-16" r="5.5"/><circle cx="2" cy="-16" r="5.5"/></g>
  <g fill="#e6f6fb"><circle cx="-35.5" cy="-17.5" r="1.8"/><circle cx="-17.5" cy="-17.5" r="1.8"/><circle cx="0.5" cy="-17.5" r="1.8"/></g>
  <circle cx="81" cy="-15" r="3.2" fill="#ffb199"/><circle cx="-62" cy="-17" r="3.2" fill="#8de9d6"/>
  <rect x="-3.5" y="-104" width="7" height="80" rx="3.5" fill="#a9b5c1"/>
  <circle cx="0" cy="-107" r="5" fill="#ff9f86"/><circle cx="-1.5" cy="-108.5" r="1.6" fill="#ffe1d8"/>
  <path d="M-7 -92 Q-36 -66 -40 -44 Q-40 -38 -34 -38 L-7 -38Z" fill="#f4f8fa"/>
  <path d="M-7 -92 Q-22 -78 -28 -64 L-7 -64Z" fill="#c9f1e3"/>
  <path d="M7 -100 Q50 -78 52 -46 Q52 -38 45 -38 L7 -38Z" fill="#ffffff"/>
  <path d="M7 -100 Q26 -90 35 -80 L7 -80Z" fill="#ffab95"/>
  <path d="M7 -64 L46 -64 Q48 -60 49 -57 L7 -57Z" fill="#eaf1f5"/>
  <path d="M-24 -27 Q-22 -50 8 -50 Q36 -50 40 -27Z" fill="#a9e6f2"/>
  <path d="M-10 -40 Q-6 -46 6 -46" stroke="#f2fcff" stroke-width="4" stroke-linecap="round" fill="none"/>`;
const ISLAND_ART = `
  <path d="M-88 16 Q-86 -30 -32 -37 Q0 -60 36 -45 Q86 -35 88 16Z" fill="#fbe7bc"/>
  <path d="M-88 16 Q-60 2 0 5 Q60 2 88 16Z" fill="#f2d6a1"/>
  <ellipse cx="-34" cy="-25" rx="20" ry="6" fill="#fff4da"/>
  <path d="M-54 -26 Q-34 -60 6 -54 Q34 -50 30 -38 Q-8 -44 -54 -26Z" fill="#aee6c6"/>
  <path d="M12 -44 Q4 -84 30 -108" stroke="#d3a273" stroke-width="11" stroke-linecap="round" fill="none"/>
  <path d="M10 -58 Q8 -84 26 -102" stroke="#e3b88a" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <g fill="#72c9a1">
    <path d="M30 -108 Q2 -132 -22 -110 Q-24 -102 -14 -102 Q6 -114 30 -108Z"/><path d="M30 -108 Q62 -134 80 -106 Q80 -98 70 -100 Q52 -114 30 -108Z"/>
    <path d="M30 -108 Q4 -102 -6 -78 Q-2 -70 6 -76 Q14 -96 30 -108Z"/><path d="M30 -108 Q60 -102 66 -76 Q62 -68 54 -76 Q48 -96 30 -108Z"/></g>
  <g fill="#94dcb8"><path d="M30 -108 Q8 -124 -10 -110 Q8 -116 30 -108Z"/><path d="M30 -108 Q56 -126 70 -106 Q52 -118 30 -108Z"/></g>
  <circle cx="25" cy="-101" r="5.5" fill="#c08d62"/><circle cx="35" cy="-100" r="5.5" fill="#c08d62"/><circle cx="23.5" cy="-102.5" r="1.7" fill="#e2b791"/>
  <g fill="#ffb3a8"><circle cx="-56" cy="-14" r="5"/><circle cx="-47" cy="-20" r="3.6"/><circle cx="60" cy="-12" r="4.2"/></g>`;
/** 갈매기 날개: f = 날갯짓 (-1 아래 ~ 1 위) */
const gullPath = (f: number) => { const y = -6 - 7 * f, c = -12 - 9 * f; return `M-20 ${y} Q-10 ${c} 0 0 Q10 ${c} 20 ${y}`; };

/** 물결 판 하나: 모양(로컬 좌표, 수면 기준 y=0)은 고정, 매 프레임 판의 위치 · 흔들림만 바뀐다 */
interface Wave { g: SVGGElement; fill: SVGPathElement; shade: SVGImageElement | null; glow: string; glints: SVGGElement; grad: SVGLinearGradientElement;
  ph: [number, number, number]; k: [number, number]; y: number; tx: number; ty: number; rot: number }
interface Puff { el: SVGCircleElement; x: number; y: number; vx: number; vy: number; r0: number; r1: number; t: number; life: number }
interface Gull { el: SVGPathElement; x: number; y: number; tx: number; ty: number; t0: number; ph: number; rate: number; vx: number; vy: number; leaving: boolean }

export interface SeaHandle {
  /** 화면을 다 덮었을 때 (이때 아래 화면을 바꾼다) */
  covered: Promise<void>;
  /** 물결이 다 내려가 다음 화면이 드러났을 때 */
  done: Promise<void>;
  /** 로딩 완료 신호: 언제 불러도 된다 (덮기 전이면 다 덮은 뒤 내려간다) */
  ready(): void;
  /** 즉시 정리 (다른 전환이 시작될 때 등) */
  destroy(): void;
  readonly phase: SeaPhase;
  readonly boat: BoatPhase;
}

/** 바다 전환 시작. 오버레이는 document.body 에 붙고, 끝나면 스스로 사라진다 */
export function seaTransition(): SeaHandle {
  const C = SEA, N = C.waves.length, id = `ts${++uid}`;
  let W = innerWidth, H = innerHeight, U = 1;
  const root = svg('svg', { class: 'tfx-sea', 'aria-hidden': 'true' });
  const defs = svg('defs');
  root.appendChild(defs);
  const waves: Wave[] = [];
  const boatSlot = svg('g'), islandG = svg('g', {}, ISLAND_ART), boatG = svg('g', { class: 'ts-boat' }, BOAT_ART);
  const fx = svg('g'), gullG = svg('g', { fill: 'none', stroke: '#7d8c96', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const hit = svg('circle', { class: 'ts-hit', r: 50, fill: 'transparent' });
  boatSlot.appendChild(boatG);
  // 뒤 판부터 쌓는다: 배는 2번 판 바로 뒤, 섬은 1번 판 바로 뒤
  // 판 색: 범위 안에서 무작위, 이웃 판과 너무 비슷하면 다시 뽑는다
  const P = C.palette, rr = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);
  const hue = () => { let q = Math.random() * P.zones.reduce((a, z) => a + z[1], 0); for (const [r, w] of P.zones) { if ((q -= w) <= 0) return rr(r); } return rr(P.zones[0][0]); };
  const hues: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    let c: [number, number, number] = [hue(), rr(P.sat), rr(P.light)];
    for (let k = 0; k < 12 && i > 0; k++) {
      const q = hues[i - 1];
      if (Math.abs(c[0] - q[0]) >= P.hueGap || Math.abs(c[2] - q[2]) >= P.lightGap) break;
      c = [hue(), rr(P.sat), rr(P.light)];
    }
    hues.push(c);
  }
  const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${Math.min(96, l).toFixed(0)}%)`;
  for (let i = N - 1; i >= 0; i--) {
    if (i === 1) root.appendChild(boatSlot);
    if (i === 0) root.appendChild(islandG);
    const [h, sa, l] = hues[i], g = svg('g');
    const grad = svg('linearGradient', { id: `${id}g${i}`, gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0 }, `<stop offset="0" stop-color="${hsl(h, sa, l)}"/><stop offset="1" stop-color="${hsl(h + 4, sa + 4, l - P.deep)}"/>`);
    defs.appendChild(grad);
    // 빛 띠: 수면을 따라 위로 뻗은 얇은 띠를 흐려서 뒤 판 위로 부드럽게 번지게 (맨 뒤 판은 이전 화면 위로 번지지 않게 없음)
    let shade: SVGImageElement | null = null;
    if (i < N - 1) {
      shade = svg('image', { preserveAspectRatio: 'none', opacity: C.glow.alpha });
      g.appendChild(shade);
    }
    const fill = svg('path', { fill: `url(#${id}g${i})` });
    const glints = svg('g', { fill: '#ffffff' });
    g.append(fill, glints);
    root.appendChild(g);
    const r = () => Math.random() * 6.283;
    waves[i] = { g, fill, shade, glow: `hsl(${h.toFixed(0)}, ${Math.max(0, sa - 6).toFixed(0)}%, ${Math.min(97, l + C.glow.light).toFixed(0)}%)`, glints, grad, ph: [r(), r(), r()], k: [0.8 + Math.random() * 0.5, 0.6 + Math.random() * 0.5], y: 0, tx: 0, ty: 0, rot: 0 };
  }
  root.append(fx, gullG, hit);
  const jet = boatG.querySelector<SVGGElement>('.ts-jet')!, flame = boatG.querySelector<SVGGElement>('.ts-flame')!;
  flame.style.display = 'none';

  /** i 번 판의 수면 모양 (로컬 x → y, 물마루가 위 = 음수) */
  const curve = (i: number, x: number) => {
    const w = C.waves[i], wv = waves[i], L = Math.max(200, w.len * W), a = w.amp * U;
    return -a * (0.65 * Math.sin((x / L) * 6.283 + wv.ph[0]) + 0.35 * Math.sin((x / (L * 0.47)) * 6.283 + wv.ph[1]));
  };
  /** 빛 띠 굽기: 수면을 따라 위로 reach 만큼 뻗은 띠를 캔버스에 드롭 섀도(shadowBlur)로 한 번 그려 이미지로 만든다.
   *  도형은 캔버스 밖으로 밀어 두고 그림자만 캔버스 안에 떨어뜨린다. 흐린 그림이라 해상도는 절반이면 충분 */
  const bakeGlow = (wv: Wave, pts: [number, number][], pad: number) => {
    const sh = C.glow.reach * U, bl = C.glow.blur * U, ys = pts.map((p) => p[1]);
    const x0 = -pad, y0 = Math.min(...ys) - sh - bl * 2.5, w = W + pad * 2, h = Math.max(...ys) + 6 + bl * 2.5 - y0;
    const k = Math.min(2, devicePixelRatio || 1) * 0.5, cv = document.createElement('canvas');
    cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
    const cx = cv.getContext('2d');
    if (!cx || !wv.shade) return;
    const OFF = 100000; // 도형은 캔버스 밖으로, 그림자만 제자리에 (그림자 오프셋 · 번짐은 변환과 무관하게 장치 픽셀 단위)
    cx.setTransform(k, 0, 0, k, (-x0 - OFF) * k, -y0 * k);
    cx.shadowColor = wv.glow; cx.shadowBlur = bl * 2 * k; cx.shadowOffsetX = OFF * k;
    cx.fillStyle = '#000';
    cx.beginPath();
    pts.forEach(([x, y], j) => (j ? cx.lineTo(x, y - sh) : cx.moveTo(x, y - sh)));
    for (let j = pts.length - 1; j >= 0; j--) cx.lineTo(pts[j][0], pts[j][1] + 6);
    cx.closePath(); cx.fill();
    wv.shade.setAttribute('href', cv.toDataURL());
    wv.shade.setAttribute('x', x0.toFixed(1)); wv.shade.setAttribute('y', y0.toFixed(1));
    wv.shade.setAttribute('width', w.toFixed(1)); wv.shade.setAttribute('height', h.toFixed(1));
  };
  /** 판 모양 만들기 (처음 · 화면 크기가 바뀔 때). 흔들려도 가장자리가 드러나지 않게 양옆으로 넉넉히 */
  const shapeWaves = () => {
    W = innerWidth; H = innerHeight; U = clamp(Math.min(W, H) / 720, 0.62, 1.2);
    const pad = W * 0.12 + 40, n = Math.max(16, Math.ceil((W + pad * 2) / 40)), step = (W + pad * 2) / n, deep = H * 1.3 + 300;
    for (let i = 0; i < N; i++) {
      const w = C.waves[i], wv = waves[i], pts: [number, number][] = [];
      for (let k = 0; k <= n; k++) { const x = -pad + k * step; pts.push([x, curve(i, x)]); }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let k = 0; k < n; k++) {
        const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(n, k + 2)];
        d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      const close = `L${(W + pad).toFixed(1)} ${deep.toFixed(1)}L${(-pad).toFixed(1)} ${deep.toFixed(1)}Z`;
      wv.fill.setAttribute('d', d + close);
      // 그라디언트: 물마루(위)에서 다음 판이 덮는 곳까지
      const a = w.amp * U, span = i ? (C.waves[i - 1].top - w.top) * H : H * 0.2;
      wv.grad.setAttribute('y1', (-a).toFixed(1)); wv.grad.setAttribute('y2', Math.max(40, span).toFixed(1));
      if (wv.shade) bakeGlow(wv, pts, pad);
      // 반짝이는 별: 판 위 고정 자리에 콕콕 (판과 함께 흔들리고, 제각각 점멸 — style.css .ts-star)
      wv.glints.textContent = '';
      const SR = C.stars;
      for (let k = 0; k < SR.count; k++) {
        const x = (k + 0.15 + Math.random() * 0.7) / SR.count * W, y = curve(i, x) + Math.max(14, Math.max(30, span) * (0.18 + Math.random() * 0.64)), r = (SR.size[0] + Math.random() * (SR.size[1] - SR.size[0])) * U;
        // 자리는 바깥 그룹(판 좌표에 고정), 반짝임(크기 · 투명도)은 안쪽 별 모양에만 — 반짝임 애니메이션이 자리 지정을 덮지 않게
        const pin = svg('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
        const star = svg('path', { class: 'ts-star', d: `M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z` });
        star.style.setProperty('--d', `${(SR.period[0] + Math.random() * (SR.period[1] - SR.period[0])).toFixed(2)}s`);
        star.style.setProperty('--dl', `${(-Math.random() * 3).toFixed(2)}s`);
        pin.appendChild(star);
        wv.glints.appendChild(pin);
      }
    }
  };
  shapeWaves();

  let phase: SeaPhase = 'entering', boat: BoatPhase = 'hidden';
  let readyAt = -1, coveredAt = -1, exitAt = -1, doneAt = -1, raf = 0, dead = false, sinkBoat = false;
  const t0 = performance.now();
  let resolveCovered!: () => void, resolveDone!: () => void;
  const covered = new Promise<void>((r) => { resolveCovered = r; });
  const done = new Promise<void>((r) => { resolveDone = r; });

  const restY = (i: number) => C.waves[i].top * H;
  const below = () => H + 250 * U * C.objScale; // 화면 아래 (섬 · 배까지 다 가려지는 깊이)
  const enterEnd = (i: number) => i * C.enter.gap + C.enter.dur;
  const exitDelay = () => (sinkBoat ? C.exit.fastDelay : C.exit.delay);
  /** i 번 판의 퇴장 진행도 (0 ~ 1) */
  const exitK = (i: number, t: number) => (exitAt < 0 ? 0 : clamp((t - exitAt - exitDelay() - (N - 1 - i) * C.exit.gap) / C.exit.dur));
  const waveBase = (i: number, t: number) => {
    if (exitAt >= 0 && t >= exitAt) return restY(i) + (below() - restY(i)) * inCubic(exitK(i, t));
    const k = clamp((t - i * C.enter.gap) / C.enter.dur);
    return below() + (restY(i) - below()) * outQuart(k);
  };
  /** 판 흔들기: 골판지를 손으로 흔들 듯 좌우로 밀리며 같은 박자로 살짝 기울고, 따로 천천히 오르내린다 */
  const sway = (i: number, t: number) => {
    const wv = waves[i], s = t / 1000, S = C.sway, side = Math.sin(s * 1.25 * wv.k[0] + wv.ph[2]);
    wv.tx = side * S.x * U; wv.rot = side * S.tilt; wv.ty = wv.y + Math.sin(s * 1.6 * wv.k[1] + wv.ph[0]) * S.y * U;
    wv.g.setAttribute('transform', `translate(${wv.tx.toFixed(1)} ${wv.ty.toFixed(1)}) rotate(${wv.rot.toFixed(3)} ${(W / 2).toFixed(0)} 0)`);
  };
  /** 화면 x 에서 i 번 판의 수면 높이 (기울기 근사) */
  const surface = (i: number, x: number) => {
    const wv = waves[i], xl = x - wv.tx;
    return wv.ty + curve(i, xl) + (xl - W / 2) * Math.sin((wv.rot * Math.PI) / 180);
  };
  const slope = (i: number, x: number) => (surface(i, x + 8) - surface(i, x - 8)) / 16;

  // ───────── 섬 · 배 (수면을 탄다)
  let bx = 0, by = 0, ba = 0, bvx = 0, bvy = 0; // 배 화면 위치 · 각도(도) · 속도 (비행 · 추락 중)
  let flyT = -1, crashT = -1, launchT = -1, holdY = 0, fly0: readonly [number, number] = [0, 0];
  const boatX = () => W * (W < 600 ? 0.27 : 0.24), islandX = () => W * (W < 600 ? 0.74 : 0.77);
  const afloatAt = () => enterEnd(1) + C.pop.boat + C.pop.dur; // 배가 다 떠오른 시점
  const place = (g: SVGGElement, x: number, y: number, a: number, s: number) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(2)}) scale(${s.toFixed(3)})`);
  /** 배 단위 좌표 → 화면 좌표 */
  const toScreen = (lx: number, ly: number) => { const r = (ba * Math.PI) / 180, s = U * C.objScale; return [bx + (lx * Math.cos(r) - ly * Math.sin(r)) * s, by + (lx * Math.sin(r) + ly * Math.cos(r)) * s] as const; };
  /** 그 판이 내려갈 때 물체가 물속으로 잠기는 정도 (판보다 조금 빨리) */
  const sinkOf = (i: number, t: number) => (exitAt < 0 ? 0 : inBack(clamp((t - exitAt - exitDelay() - (N - 1 - i) * C.exit.gap) / (C.exit.dur * 0.7)), C.sink.bounce));

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
    const [ex, ey] = toScreen(-90, -12);
    for (let k = 0; k < 8; k++) puff(ex, ey, k % 2 ? '#b9bfc2' : '#8f989d', 6 * U, 24 * U, 800, (Math.random() - 0.5) * 260, (Math.random() - 0.7) * 200); // 펑
  };
  hit.addEventListener('pointerdown', onHit);
  let rz = 0;
  const onResize = () => { clearTimeout(rz); rz = window.setTimeout(shapeWaves, 120); };
  addEventListener('resize', onResize);

  let prev = 0;
  const frame = (now: number) => {
    if (dead) return;
    const t = now - t0, dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;
    // 물결 판
    for (let i = 0; i < N; i++) { waves[i].y = waveBase(i, t); sway(i, t); }
    if (phase === 'entering' && t >= enterEnd(N - 1)) { phase = 'waiting'; coveredAt = t; resolveCovered(); }
    if (phase === 'waiting' && readyAt >= 0) {
      // 배가 다 떠오르기 전에 로딩이 끝났으면 출항 없이 가라앉기 (짧게 머문다)
      sinkBoat = readyAt < afloatAt();
      if (t >= coveredAt + (sinkBoat ? C.fastHold : C.minHold)) { phase = 'exiting'; exitAt = t; root.classList.add('open'); }
    }
    if (phase === 'waiting' && !gulls.length && t >= coveredAt + C.gulls.delay) spawnGulls(t);
    if (phase === 'exiting' && t >= exitAt + exitDelay() + (N - 1) * C.exit.gap + C.exit.dur) { phase = 'completed'; doneAt = t; resolveDone(); }

    // 섬: 1번 판 수면 위로 솟았다가 그 판과 함께 물속으로 잠긴다
    const ix = islandX(), ipop = clamp((t - enterEnd(0) - C.pop.island) / C.pop.dur);
    place(islandG, ix, surface(0, ix) + 14 * U + ((1 - outBack(ipop, C.pop.bounce)) + sinkOf(0, t)) * 220 * U * C.objScale, slope(0, ix) * 8, U * C.objScale * (W < 600 ? 0.85 : 1));

    // 배
    if (boat === 'hidden' && t >= enterEnd(1) + C.pop.boat) boat = 'floating';
    if (boat === 'floating' || boat === 'launching' || boat === 'sinking') {
      const x = boatX(), bpop = clamp((t - enterEnd(1) - C.pop.boat) / C.pop.dur);
      bx = x; by = surface(1, x) - 3 * U + (1 - outBack(bpop, C.pop.bounce)) * 200 * U * C.objScale;
      ba = (Math.atan(slope(1, x)) * 180) / Math.PI * 0.9 + Math.sin(t / 620) * 2.2;
      if (boat === 'floating' && exitAt >= 0 && t >= exitAt) { boat = sinkBoat ? 'sinking' : 'launching'; launchT = t; }
      if (boat === 'sinking') {
        // 2번 판이 움직이기 전까지는 수면을 타다가, 그 뒤로는 제자리에 떠 있고 (판을 따라가지 않음), 맨 앞 판 출발 + delay 뒤 쫀득하게 떨어진다
        if (exitK(1, t) <= 0) holdY = by;
        else { by = holdY + Math.sin(t / 260) * 2 * U; ba = Math.sin(t / 300) * 3; }
        const dropAt = exitAt + exitDelay() + (N - 1) * C.exit.gap + C.drop.delay, k = clamp((t - dropAt) / C.drop.dur);
        if (k > 0) { by = holdY + inBack(k, C.drop.bounce) * (H - holdY + 320 * U * C.objScale); ba += 14 * k; }
        if (k >= 1) boat = 'gone';
      }
      if (boat === 'launching') {
        const k = (t - launchT) / C.launch.pop;
        jet.setAttribute('transform', `translate(${-56 - 6 * clamp(k)} -12) scale(${outBack(clamp(k), 3).toFixed(3)})`);
        by -= 10 * U * outBack(clamp(k), 2); // 엔진이 튀어나오며 배가 들썩
        if (k >= 0.5) flame.style.display = '';
        ba += Math.sin(t / 22) * 1.5 * clamp(k); // 시동 떨림
        if (t >= launchT + C.launch.pop + C.launch.ignite) { boat = 'flying'; flyT = t; root.appendChild(boatG); root.appendChild(hit); hit.classList.add('on'); fly0 = [bx, by]; }
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
      if (now - lastPuff > 34) { lastPuff = now; const [ex, ey] = toScreen(-122, -12); puff(ex, ey, Math.random() < 0.5 ? '#fbe08a' : '#f7c3a6', 5 * U * C.objScale, 13 * U * C.objScale, 520); }
      flame.setAttribute('transform', `scale(${(0.8 + 0.6 * clamp(k * 2) + Math.random() * 0.25).toFixed(2)} ${(0.85 + Math.random() * 0.3).toFixed(2)})`);
      if (k >= 1 || bx > W + 200 * U || by < -200 * U) { boat = 'gone'; hit.classList.remove('on'); }
    }
    if (boat === 'crashing') {
      const s = (t - crashT) / 1000;
      bvy += C.crash.gravity * U * dt; bx += bvx * dt; by += bvy * dt;
      // 털썩 튀어 오르며 휘청이다가 (0.35초) 기수부터 곤두박질
      const wob = 26 * Math.sin(s * 30) * Math.exp(-s * 5);
      ba += ((s < 0.35 ? ba : 80) - ba) * clamp(dt * 3.4) + wob * dt * 9;
      if (now - lastPuff > 40) { lastPuff = now; const [ex, ey] = toScreen(-90, -12); puff(ex, ey, Math.random() < 0.6 ? '#aab1b5' : '#cdd1d3', 6 * U, 26 * U, 1000, -bvx * 0.1 + (Math.random() - 0.5) * 40, -70); }
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
    // 갈매기: 내려와 맴돌다가, 물결이 내려가기 시작하면 위로 날아간다
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
      g.el.setAttribute('transform', `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) scale(${(U * C.gullScale).toFixed(3)})`);
    }
    // 정리: 전환이 끝나고 배 · 갈매기 · 입자가 다 사라지면 (최대 maxLife)
    const gullsOut = gulls.every((g) => g.y < -80 || t < g.t0);
    if (phase === 'completed' && (((boat === 'gone' || boat === 'hidden') && gullsOut && !puffs.length) || t > doneAt + C.maxLife)) { destroy(); return; }
    raf = requestAnimationFrame(frame);
  };

  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(rz);
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
