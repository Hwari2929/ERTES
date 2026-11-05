// 음료 그림 (SVG): 잔 6종 · 칸마다 재료 색 층 (아래부터 붓는 순서, 경계는 살짝 섞임) · 얼음 · 가니쉬 · 남은 양.
// docs/UI.md 26: 명암 · 유리 반사 없이 한 색 면 · 선으로. 잔 테두리는 글자색(currentColor, CSS 가 토큰으로 준다).
// 남은 양 left (0~1): 위층부터 줄어든다 (잔 가장자리로 마시므로). 프로즌은 층이 섞여 한 색 + 얼음 결.
// art: 선 잔 대신 잔 일러스트(public/art/bar_glass_<잔 id>.webp, scripts/bar_props_build.py 가 굽는다)를 액체 '위'에 얹는다 — 안쪽 유리를 투명하게 구워 음료가 비친다.
//   잔 그림은 조금 위에서 본 모습이라 층 경계 · 액면을 단면 타원의 호로 그린다 (2026-11-04 사용자 요청). true = 잔 그림을 color-dodge 0.6 으로 배경과 섞는다 (사용자 선택, 어두운 바탕), 'plain' = 섞지 않음 (종이 위)
import { GLASS_BY_ID, ING_BY_ID, type Drink, type Glass } from '../data/bar/drinks';
import { GLASS_ART, ICE_ART, PROP_ART } from './glassart.gen';
import { artURL } from './portraits';

/** 잔 모양 (보기 상자 48 × 72, 바닥 y = 70). out = 잔 테두리 경로, liq = 액체가 차는 안쪽 경로, top · bot = 가득 찼을 때 액면 · 바닥 높이, rim = 테두리 윗선 [x0, x1, y] */
interface Shape { out?: string; liq: string; top: number; bot: number; rim: [number, number, number]; stem?: string }
const SHAPES: Record<string, Shape> = {
  rock: { out: 'M10 44 L10 70 L38 70 L38 44', liq: 'M11.5 46 L11.5 68.5 L36.5 68.5 L36.5 46 Z', top: 48, bot: 68.5, rim: [10, 38, 44] },
  highball: { out: 'M14 20 L14 70 L34 70 L34 20', liq: 'M15.5 22 L15.5 68.5 L32.5 68.5 L32.5 22 Z', top: 24, bot: 68.5, rim: [14, 34, 20] },
  pint: { out: 'M10 12 L14 70 L34 70 L38 12', liq: 'M11.6 14 L15.4 68.5 L32.6 68.5 L36.4 14 Z', top: 16, bot: 68.5, rim: [10, 38, 12] },
  coupe: { out: 'M5 36 Q24 60 43 36', liq: 'M6.5 37.5 Q24 58 41.5 37.5 Z', top: 38.5, bot: 47.5, rim: [5, 43, 36], stem: 'M24 48 L24 68 M15 70 L33 70 Q24 66 15 70' },
  wine: { out: 'M13 18 Q8 34 16 42 Q24 48 32 42 Q40 34 35 18', liq: 'M14.2 20 Q9.8 34 17 41 Q24 46.4 31 41 Q38.2 34 33.8 20 Z', top: 22, bot: 45.5, rim: [13, 35, 18], stem: 'M24 47 L24 68 M15 70 L33 70 Q24 66 15 70' },
  goblet: { out: 'M8 12 Q6 36 24 44 Q42 36 40 12', liq: 'M9.6 14 Q8 35 24 42.4 Q40 35 38.4 14 Z', top: 16, bot: 42, rim: [8, 40, 12], stem: 'M24 44 L24 68 M14 70 L34 70 Q24 65 14 70' },
};

/** 잔 속 얼음 그림 불투명도 (2026-11-04 사용자 결정 0.75 — 얼음 그림 4종을 번갈아) */
export const ICE_OPACITY = 0.75;
/** 떠오른 얼음 중 맨 위 얼음이 수면 위로 나오는 몫 (그 얼음 높이에 대한 비율, 2026-11-04 사용자: 수면을 살짝 — 록 글라스는 조금, 하이볼은 많이 내림) */
const ICE_RISE: Record<string, number> = { highball: 0.05 };
const ICE_RISE_DEF = 0.15;
/** 얼음 한 변 (잔마다 같은 크기 — 2026-11-04 사용자: 크기는 균일하게). 잔 안쪽 폭(위 → 아래)을 보고 정했다: 록 18.9 → 15.4 · 하이볼 15.2 → 10.2 · 파인트 24.6 → 14.5 · 쿠페 27 → 6.9 · 와인 잔 13.5 ~ 17.5 → 10 · 고블릿 24.7 → 12.3 */
const ICE_SIZE: Record<string, number> = { rock: 11, highball: 8, pint: 10, coupe: 8, wine: 8.5, goblet: 10 };
/** 얼음 개수 [조금, 많이] 예외 (기본: 3칸 잔 1 · 2, 4 · 5칸 잔 2 · 3) — 와인 잔은 볼이 좁아 1 · 2 (사용자) */
const ICE_N: Record<string, [number, number]> = { wine: [1, 2] };
/** 거품 · 기포 텍스처 (public/art/bar_foam_<번호>.webp — 2026-11-04 사용자가 3 · 7 · 8 을 골라 배경을 지움, 뒤집어 붙인 이음매 없는 타일 · 흐림 0.15 를 미리 구움, scripts/bar_props_build.py).
 *  사용자 선택: 기포 plus-lighter · 거품 screen · 흐림 0.15. fizz = 탄산 층 기포 겹 (겹마다 크기 · 속도 · 옆 흔들림이 달라 여러 겹이 조금씩 떠오른다 — dur 초에 한 타일),
 *  head = 맥주 거품 띠의 결. tile = 48 × 72 상자 단위 타일 한 변. on = false 면 예전 SVG 기포 */
export const FOAM_FX = {
  on: true,
  blend: 'plus-lighter',
  fizz: [
    // 진하기 (op): 처음 0.75 · 0.45 · 1 → 절반 → 그 80% (2026-11-04 ~ 05 사용자)
    { tex: 'bar_foam_3', tile: 44, op: 0.3, dur: 17, sway: 1.2, x: 0 },
    { tex: 'bar_foam_3', tile: 27, op: 0.18, dur: 10, sway: 0.8, x: 9 },
    { tex: 'bar_foam_8', tile: 40, op: 0.4, dur: 13, sway: 1.6, x: 5 },
  ],
  /** 기포 무늬 진하기 배율 (2026-11-05 사용자): 평소 fizz op 의 base 배, 갓 따르면 fresh 배에서 시작해 rise.fade 초에 걸쳐 base 배로 */
  fizzK: { base: 0.5, fresh: 0.75 },
  head: { tex: 'bar_foam_7', tile: 28, op: 0.9, blend: 'screen' },
  /** rise = 바닥에서 생겨 커지며 떠오르는 큰 방울 (켬, tex 가 비면 선 그림 방울). 시험 (2026-11-05, 꺼 둠): ring = 탄산 수면 가장자리 기포 고리 + 톡 터지는 방울, bumpy = 맥주 거품 윗면을 몽글몽글하게 + 위는 희고 아래는 누런 거품 띠 */
  // 큰 방울 그림 = 시안 1번 (2026-11-05 사용자). size = 그림 한 변 (처음 2.6 의 40%, 사용자). 갓 따랐을 때 (drinkSvg fresh) 는 n × burst 개로 생기다가 fade 초에 걸쳐 n 개로 줄어든다
  rise: { on: true, n: 5, speed: 7, tex: 'bar_bubble', size: 1.04, burst: 3, fade: 6 },
  ring: { on: false, op: 0.9, pops: 4 },
  bumpy: { on: false, amp: 0.9 },
};
/** 잔 조명 (2026-11-05 사용자: 4단계 모두 켬): 장면 (drinkSvg scene — 제조대 prep · 카운터 낮 day · 밤 night) 마다 역광 색 · 방향.
 *  glow = 투과광 (음료가 역광을 머금어 빛남 — 맑을수록 세게, 제조대는 벽 백라이트 줄 높이의 띠 — placeGlowBand 가 화면 배치로 맞춘다),
 *  rim = 빛 오는 쪽 실루엣 가장자리 빛 (public/art/bar_glass_<잔 id>_rim.webp), amb = 환경광 (장면 색 soft-light + 반대쪽 차가운 보조색),
 *  caustic = 역광이 음료를 지나 테이블에 은은하게 퍼진 색, shadow = 빛 반대쪽으로 지는 그림자 */
export type LightScene = 'prep' | 'day' | 'night';
export const GLASS_LIGHT = { on: true, glow: true, rim: true, amb: true, caustic: true, shadow: true };
/** 수면 표현 (2026-11-05 시험): flat = 지금 (흰색 35% 섞은 한 색), deep = 음료 색 그대로 조금 짙게 (위에서 내려다보면 깊이만큼 진하다) + 메니스커스 (잔 벽에 닿는 가장자리의 얇은 밝은 고리, 빛 쪽이 밝음),
 *  reflect = deep + 장면 빛의 가로 반사띠 (수면 뒤쪽, 빛 방향으로 치우침), full = reflect + 앞쪽 가장자리 굴절 어둠 + 작은 반짝임 */
export const SURFACE = { mode: 'flat' as 'flat' | 'deep' | 'reflect' | 'full' };
/** 역광 테두리 진하기 rimOp 는 처음 값의 60% (2026-11-05 사용자: 0.9 · 0.75 · 0.8 → 0.54 · 0.45 · 0.48) */
export const LIGHTS = {
  // 제조대: 벽 아래쪽 호박색 백라이트 줄이 잔 뒤를 지난다 (band = 48 × 72 상자 y · 반폭)
  // sh = 그림자 [옆 (잔 폭 배), 앞 (상자 단위), 길이 (잔 폭 배), 두께, 진하기] — 빛 반대쪽으로 진다 (제조대: 뒤에서 오는 빛 → 앞 = 화면 아래로)
  prep: { back: '#ffb24a', band: [45, 6] as [number, number] | null, glow: 0.6, rim: 'up' as 'up' | 'left' | 'right', rimOp: 0.54, amb: '#ffcf8a', ambOp: 0.22, cool: '#6f8fc0', coolOp: 0.22, sh: [0, 1.5, 0.72, 2.0, 0.55] },
  // 카운터 낮: 뒤 선반의 따뜻한 흰빛 · 왼쪽 위
  day: { back: '#fff0cf', band: null, glow: 0.35, rim: 'left' as const, rimOp: 0.45, amb: '#ffe2ae', ambOp: 0.18, cool: '#7f9cc6', coolOp: 0.2, sh: [0.5, 0.3, 0.95, 1.4, 0.5] },
  // 카운터 밤: 창밖 푸른빛 · 오른쪽
  night: { back: '#a6c4ff', band: null, glow: 0.3, rim: 'right' as const, rimOp: 0.48, amb: '#93b2ea', ambOp: 0.2, cool: '#2f3d5c', coolOp: 0.28, sh: [-0.5, 0.3, 0.95, 1.4, 0.55] },
};
/** 제조대 투과광 띠를 화면의 백라이트 줄 높이 (screenY, px) 에 맞춘다 — root 안 잔 SVG 마다 (그린 뒤 부른다) */
export function placeGlowBand(root: ParentNode, screenY: number) {
  root.querySelectorAll<SVGRectElement>('rect.glow-band').forEach((r) => {
    const svg = r.ownerSVGElement, m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const pt = svg.createSVGPoint(); pt.x = 0; pt.y = screenY;
    const y = pt.matrixTransform(m.inverse()).y, hw = Number(r.dataset.hw) || 6;
    r.setAttribute('y', (y - hw * 2).toFixed(2)); r.setAttribute('height', (hw * 4).toFixed(2));
    const g = svg.querySelector(`#${r.dataset.g}`);
    if (g) { g.setAttribute('y1', (y - hw * 2).toFixed(2)); g.setAttribute('y2', (y + hw * 2).toFixed(2)); }
  });
}
/** 수면 (SURFACE.mode ≠ flat): 타원 (cx, cy, rx, ry), 맨 위 층 색 c · 불투명도 a, 장면 빛 (없으면 흰빛 위에서) */
function surfaceHtml(id: string, parts: string[], cx: number, cy: number, rx: number, ry: number, c: string, a: number, sc?: LightScene): string {
  const L = sc ? LIGHTS[sc] : undefined, light = L?.back ?? '#ffffff', dx = L?.rim === 'left' ? -1 : L?.rim === 'right' ? 1 : 0;
  const E = (k: number, kx = 1, ky = 1, ox = 0, oy = 0) => `cx="${(cx + ox).toFixed(2)}" cy="${(cy + oy).toFixed(2)}" rx="${(rx * kx * k).toFixed(2)}" ry="${(ry * ky * k).toFixed(2)}"`;
  // 깊은 수면: 음료 색 그대로 조금 짙게 · 살짝 진하게
  let h = `<ellipse ${E(1)} fill="${shade(c, 0.1)}" fill-opacity="${Math.min(0.95, a + 0.08).toFixed(2)}"/>`;
  // 반사띠: 수면 뒤쪽 (위쪽) 에 장면 빛 — 흐린 가로 띠
  if (SURFACE.mode === 'reflect' || SURFACE.mode === 'full') {
    parts.push(`<filter id="${id}sr" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="${(ry * 0.25).toFixed(2)}"/></filter>`);
    h += `<ellipse ${E(1, 0.72, 0.32, dx * rx * 0.18, -ry * 0.45)} fill="${light}" opacity=".42" filter="url(#${id}sr)" style="mix-blend-mode:screen"/>`;
  }
  // 메니스커스: 가장자리 얇은 고리, 뒤쪽 (위) 이 밝고 앞쪽 (아래) 은 옅게
  parts.push(`<linearGradient id="${id}mn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint(c, 0.75)}" stop-opacity=".95"/><stop offset=".55" stop-color="${tint(c, 0.5)}" stop-opacity=".35"/><stop offset="1" stop-color="${tint(c, 0.4)}" stop-opacity=".6"/></linearGradient>`);
  h += `<ellipse ${E(1)} fill="none" stroke="url(#${id}mn)" stroke-width="${Math.max(0.22, ry * 0.18).toFixed(2)}"/>`;
  if (SURFACE.mode === 'full') {
    // 앞쪽 가장자리 굴절 어둠 (수면이 잔 앞 벽에 닿는 선 바로 안쪽) + 빛 쪽 작은 반짝임 2점
    h += `<path d="M${(cx - rx * 0.92).toFixed(2)} ${(cy + ry * 0.2).toFixed(2)} A${(rx * 0.92).toFixed(2)} ${(ry * 0.8).toFixed(2)} 0 0 0 ${(cx + rx * 0.92).toFixed(2)} ${(cy + ry * 0.2).toFixed(2)}" fill="none" stroke="${shade(c, 0.45)}" stroke-opacity=".35" stroke-width="${(ry * 0.22).toFixed(2)}"/>`;
    for (const [fx, fy, r] of [[0.42, -0.3, 0.09], [0.6, -0.12, 0.06]]) h += `<circle cx="${(cx + (dx || 1) * rx * fx * (dx ? 1 : 0.6)).toFixed(2)}" cy="${(cy + ry * fy).toFixed(2)}" r="${(rx * r).toFixed(2)}" fill="#ffffff" opacity=".8"/>`;
  }
  return h;
}
/** 움직임 줄이기면 기포가 멈춰 있다 */
const stillFx = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid = 0;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** 검정을 w 만큼 섞은 색 */
const shade = (c: string, w: number) => `#${hex(c).map((v) => Math.round(v * (1 - w)).toString(16).padStart(2, '0')).join('')}`;
/** 층 안 세로 그라데이션 (2026-11-05 사용자): 같은 재료가 이어진 층은 아래가 짙고 위가 살짝 연하다 */
const LAYER_SHADE = { bot: 0.21, top: 0.07, topA: 0.85 }; // 사용자: 0.16 · 0.1 → 0.21 · 0.07, 위쪽은 밀도가 낮아 불투명도 85% (2026-11-05)
/** 짙게: 채도를 높이고 명도를 내린 색 (HSL). 무색에 가까운 음료 (채도 0.2 미만 — 소다 · 토닉 · 진 · 우유) 는 채도를 올리지 않는다 (2026-11-05 사용자) */
const deep = (c: string, ks = 1.35, kl = 0.58) => {
  const [r, g, b] = hex(c).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
  let h = 0, s = 0;
  if (dd) { s = dd / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; if (h < 0) h += 360; }
  const S = s < 0.2 ? s : Math.min(1, s * ks + 0.08), L = l * kl, C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - C / 2;
  const [R, G, B] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return `#${[R, G, B].map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0')).join('')}`;
};
/** 수면 · 음료 가장자리 (2026-11-05 사용자 방향): faceTint = 수면에 섞는 흰색 (처음 0.35 → 그 80% 는 0.28), nearGlow = 수면 앞 (아래) 끝에서 안쪽으로 밝게 퍼짐 (시안 0.675),
 *  farDark = 수면 뒤 (위) 끝에서 안쪽으로 짙게 (채도 ↑ 명도 ↓ · 무색 음료는 채도 그대로) 퍼짐 (시안 0.85) — 둘 다 수면 타원에 딱 맞는 원형 고리 + 수면 중심 쪽으로 옅어지는 직선 마스크,
 *  edgeDark = 음료 몸통이 잔 벽에서 안쪽으로 짙어지는 그라데이션 진하기 (역광 아래 층, 시안 0.5), blur = 음료 뒤 배경 흐림 (backdrop-filter, --dk-blur) */
/** 잔 그림 겹 (color-dodge) 진하기 — 2026-11-05 사용자: 록 글라스만 벽이 불투명한 굵은 선이라 혼자 밝다 → 나머지 잔은 0.6 → 0.9 (시안 A, 파인트 0.8 · 고블릿 0.7), 록 글라스는 0.6 의 90% */
export const GLASS_OPACITY: Record<string, number> = { rock: 0.54, highball: 0.9, pint: 0.8, coupe: 0.9, wine: 0.9, goblet: 0.7 };
export const SURF2 = { faceTint: 0.28, nearGlow: 0.675, farDark: 0.85, edgeDark: 0.5, blur: true }; // 2026-11-05 사용자: 시안 5단계 모두 켬
/** 흰색을 w 만큼 섞은 색 */
const tint = (c: string, w: number) => `#${hex(c).map((v) => Math.round(v + (255 - v) * w).toString(16).padStart(2, '0')).join('')}`;
const mix = (cs: string[]) => { const a = cs.map(hex); const m = [0, 1, 2].map((k) => Math.round(a.reduce((s, x) => s + x[k], 0) / a.length)); return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`; };
/** 0~1 고정 난수 (같은 잔은 늘 같은 기포 · 얼음 자리) */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

type Art = (typeof GLASS_ART)[string];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 잔 그림 안쪽 높이 y 의 왼쪽 · 오른쪽 벽 x */
const wallsAt = (ga: Art, y: number): [number, number] => {
  const r = ga.rows;
  if (y <= r[0][0]) return [r[0][1], r[0][2]];
  for (let i = 1; i < r.length; i++) if (y <= r[i][0]) { const t = (y - r[i - 1][0]) / (r[i][0] - r[i - 1][0] || 1); return [lerp(r[i - 1][1], r[i][1], t), lerp(r[i - 1][2], r[i][2], t)]; }
  const l = r[r.length - 1]; return [l[1], l[2]];
};
/** 높이 y 의 수평 단면 타원 호 (잔 그림은 조금 위에서 본 모습): front = 앞쪽 호 (가운데가 아래로 처짐), 아니면 뒤쪽 호. 왼쪽 → 오른쪽 점 */
const arc = (ga: Art, y: number, front: boolean): string => {
  const [x0, x1] = wallsAt(ga, y);
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = rx * lerp(ga.k[0], ga.k[1], Math.max(0, Math.min(1, (y - ga.top) / (ga.bot - ga.top)))); // 타원 양 끝 = 그 높이의 벽 (안쪽 영역 마스크) — 2026-11-05 사용자: 수면 타원이 마스크보다 넓었다
  const pts: string[] = [];
  for (let i = 0; i <= 16; i++) { const t = -1 + i / 8; pts.push(`${(cx + rx * t).toFixed(2)} ${(y + (front ? 1 : -1) * ry * Math.sqrt(1 - t * t)).toFixed(2)}`); }
  return pts.join(' L');
};
/** 호 아래 전부 (잔 밖은 안쪽 영역으로 잘린다) */
const below = (ga: Art, y: number, front: boolean) => `M-2 ${y.toFixed(2)} L${arc(ga, y, front)} L50 ${y.toFixed(2)} L50 80 L-2 80 Z`;
/** 잔 그림의 안쪽 영역: 테두리 높이에서 벽을 따라 내려가 바닥은 바닥 타원의 앞쪽 호. 위는 테두리까지 열어 둔다 — 가득 찬 액면(단면 타원 뒤쪽 호)과 수면 위로 나온 얼음이 직선으로 잘리지 않게 (2026-11-04) */
const inner = (ga: Art) => { const r0 = ga.rows[0], ty = Math.min(ga.rim[2], r0[0] - 1.5); return `M${r0[1]} ${ty} L${ga.rows.map((r) => `${r[1]} ${r[0]}`).join(' L')} L${arc(ga, ga.bot, true)} L${[...ga.rows].reverse().map((r) => `${r[2]} ${r[0]}`).join(' L')} L${r0[2]} ${ty} Z`; };

/** 한 잔 SVG. left = 남은 양 (0~1) · art = 잔 일러스트: true = 잔 그림을 따로 한 겹으로 배경과 섞는다 (color-dodge 0.6, 어두운 바탕 — 제조대 · 완성 장면 · 카운터 · 잔 진열), 'plain' = 섞지 않는다 (종이 위 — 영수증 사진 · 레시피북).
 *  fresh = 갓 따른 시각 (Date.now() ms, 0 = 아님) — 탄산 잔이면 큰 방울이 잔뜩 생겼다가 줄어든다. scene = 잔 조명 장면 (없으면 조명 없음, GLASS_LIGHT) */
export function drinkSvg(d: Drink, left = 1, cls = 'drink', art: boolean | 'plain' = false, fresh = 0, scene?: LightScene): string {
  const lsc = GLASS_LIGHT.on && art === true ? scene : undefined;
  const g: Glass | undefined = GLASS_BY_ID[d.glass];
  const ga = art ? GLASS_ART[d.glass] || GLASS_ART.rock : undefined;
  const s: Shape = ga || SHAPES[d.glass] || SHAPES.rock;
  const id = `dk${++uid}`;
  const n = d.fill.length || g?.slots || 3;
  const H = s.bot - s.top; // 가득 찬 액체 높이
  const lv = Math.max(0, Math.min(1, left));
  const yTop = s.bot - H * lv; // 지금 액면
  const parts: string[] = [];
  // 층: 연달아 같은 재료는 한 층으로, 경계는 칸 높이의 18% 안에서 섞인다
  const segs: { ing: string; a: number; b: number }[] = [];
  d.fill.forEach((ing, i) => { const last = segs[segs.length - 1]; if (last && last.ing === ing) last.b = (i + 1) / n; else segs.push({ ing, a: i / n, b: (i + 1) / n }); });
  const frozen = d.ice === 'frozen';
  const colorOf = (ing: string) => ING_BY_ID[ing]?.color || '#999999';
  const alphaOf = (ing: string) => ING_BY_ID[ing]?.alpha ?? 0.6;
  let fill: string;
  // 불투명도: 재료마다 0.3 ~ 0.95 (drinks.ts alpha). 층마다 따로, 프로즌은 갈린 얼음이라 평균 + 0.3 (최대 0.95)
  let alpha = 1;
  if (frozen || segs.length <= 1) {
    fill = segs.length ? (frozen ? mix(d.fill.map(colorOf)) : colorOf(segs[0].ing)) : 'none';
    if (segs.length) alpha = frozen ? Math.min(0.95, d.fill.reduce((t, x) => t + alphaOf(x), 0) / d.fill.length + 0.3) : alphaOf(segs[0].ing);
  } else {
    const bl = 0.09 / n * 2;
    const stops = segs.flatMap((sg, i) => {
      const c = colorOf(sg.ing), o = alphaOf(sg.ing);
      const a = i === 0 ? 0 : sg.a + bl, b = i === segs.length - 1 ? 1 : sg.b - bl;
      return [`<stop offset="${a.toFixed(3)}" stop-color="${c}" stop-opacity="${o}"/>`, `<stop offset="${b.toFixed(3)}" stop-color="${c}" stop-opacity="${o}"/>`];
    }).join('');
    parts.push(`<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${s.bot}" x2="0" y2="${s.top}">${stops}</linearGradient>`);
    fill = `url(#${id}g)`;
  }
  parts.push(`<clipPath id="${id}c"><path d="${ga ? inner(ga) : s.liq}"/></clipPath>`);
  const body: string[] = [];
  if (lv > 0 && segs.length) {
    const topIng = segs[segs.length - 1].ing;
    const foam = !frozen && (topIng === 'ringside' || topIng === 'darkringer') && lv > 0.12;
    if (ga) {
      // 잔 그림: 층마다 제 영역 (위 경계 호 아래 − 아래 경계 호 아래), 경계는 흐림으로 섞는다. 액면 = 단면 타원 뒤쪽 호 + 윗면. 붓기 연출(bar.ts prepFx)은 .liq 묶음을 올린다
      const yAt = (f: number) => s.bot - H * f;
      // 층마다 아래 (짙게) → 위 (살짝 연하게) 그라데이션. 위 끝은 그 층의 보이는 윗부분 (마셔서 줄면 지금 수면)
      const grad = (gid: string, c: string, y0: number, y1: number) => { parts.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0.toFixed(2)}" x2="0" y2="${Math.min(y0 - 0.5, y1).toFixed(2)}"><stop offset="0" stop-color="${shade(c, LAYER_SHADE.bot)}"/><stop offset="1" stop-color="${tint(c, LAYER_SHADE.top)}" stop-opacity="${LAYER_SHADE.topA}"/></linearGradient>`); return `url(#${gid})`; };
      const layers = frozen || segs.length <= 1
        ? `<rect x="-2" y="-10" width="52" height="90" fill="${grad(`${id}l0`, frozen ? fill : colorOf(segs[0].ing), s.bot, yTop)}" fill-opacity="${alpha}"/>`
        : segs.map((sg, i) => `<path d="${sg.b < 1 ? below(ga, yAt(sg.b), true) : 'M-2 -10 L50 -10 L50 80 L-2 80 Z'}${sg.a > 0 ? ` ${below(ga, yAt(sg.a), true)}` : ''}" fill-rule="evenodd" fill="${grad(`${id}l${i}`, colorOf(sg.ing), yAt(sg.a), Math.max(yAt(sg.b), yTop))}" fill-opacity="${alphaOf(sg.ing)}"/>`).join('');
      const blur = !frozen && segs.length > 1;
      if (blur) parts.push(`<filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(0.09 / n * 2 * H * 0.6).toFixed(2)}"/></filter>`);
      parts.push(`<clipPath id="${id}t"><path d="${below(ga, yTop, false)}"/></clipPath>`);
      const [x0, x1] = wallsAt(ga, yTop), ecx = (x0 + x1) / 2, erx = (x1 - x0) / 2, ery = erx * lerp(ga.k[0], ga.k[1], Math.max(0, Math.min(1, (yTop - ga.top) / (ga.bot - ga.top))));
      // 윗면 (조명을 받아 몸통보다 밝다): 맨 위 층 색에 흰색 35% 를 섞고 불투명도 +0.12 (2026-11-04 사용자)
      const topC = frozen ? fill : colorOf(topIng), topA = frozen ? alpha : alphaOf(topIng);
      // 텍스처 층 (FOAM_FX): 타일 무늬 하나를 영역에 채우고 혼합 모드로 얹는다
      const fx = FOAM_FX.on;
      // 타일 무늬: 기포 겹은 아래에서 위로 한 타일씩 돈다 (옆으로 살짝 흔들림). 시작 위상을 시계에서 잡아 다시 그려도 (카운터 잔이 줄어들 때) 이어서 움직인다
      const still = stillFx(), now = Date.now() / 1000;
      const pat = (pid: string, t: { tex: string; tile: number; dur?: number; sway?: number; x?: number }) => {
        const x = t.x ?? 0, anim = t.dur && !still ? `<animateTransform attributeName="patternTransform" type="translate" values="${x} 0; ${x + (t.sway ?? 0)} ${-t.tile / 2}; ${x} ${-t.tile}" keyTimes="0; .5; 1" dur="${t.dur}s" begin="${(-(now % t.dur)).toFixed(2)}s" repeatCount="indefinite"/>` : '';
        parts.push(`<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${t.tile}" height="${t.tile}" patternTransform="translate(${x} 0)"><image href="${artURL(`${t.tex}.webp`)}" width="${t.tile}" height="${t.tile}" preserveAspectRatio="none"/>${anim}</pattern>`);
        return `url(#${pid})`;
      };
      const texed = (fillUrl: string, d: string, op: number, blend: string) => `<path d="${d}" fill-rule="evenodd" fill="${fillUrl}" opacity="${op}" style="mix-blend-mode:${blend}"/>`;
      const headD = `${below(ga, yTop, false)} ${below(ga, Math.min(s.bot, yTop + Math.min(3, H * 0.12)), true)}`;
      let fizzFx = '';
      if (fx && !frozen && segs.some((sg) => ING_BY_ID[sg.ing]?.fizz)) {
        const urls = FOAM_FX.fizz.map((t, i) => pat(`${id}f${i}`, t));
        segs.forEach((sg) => {
          if (!ING_BY_ID[sg.ing]?.fizz) return;
          const d = `${sg.b < 1 ? below(ga, yAt(sg.b), true) : 'M-2 -10 L50 -10 L50 80 L-2 80 Z'}${sg.a > 0 ? ` ${below(ga, yAt(sg.a), true)}` : ''}`;
          fizzFx += FOAM_FX.fizz.map((t, i) => {
            const k = FOAM_FX.fizzK, lo = +(t.op * k.base).toFixed(3), since = fresh ? (Date.now() - fresh) / 1000 : Infinity, fade = FOAM_FX.rise.fade;
            if (since >= fade || still) return texed(urls[i], d, lo, FOAM_FX.blend);
            const hi = +(t.op * k.fresh).toFixed(3); // 갓 따름: 진하게 시작해 fade 초에 걸쳐 평소로
            return texed(urls[i], d, lo, FOAM_FX.blend).replace('/>', `><animate attributeName="opacity" values="${hi}; ${lo}" dur="${fade}s" begin="${(-since).toFixed(2)}s" fill="freeze"/></path>`);
          }).join('');
        });
      }
      // 시험 효과 (FOAM_FX.rise · ring · bumpy)
      const fizzTop = !frozen && !!ING_BY_ID[topIng]?.fizz, ph = (dur: number, k: number) => `${(-((now + k * 1.37) % dur)).toFixed(2)}s`;
      let extra = '', over2 = '';
      if (fx && FOAM_FX.rise.on && !frozen && !still && lv > 0.05 && segs.some((sg) => ING_BY_ID[sg.ing]?.fizz)) {
        const r = FOAM_FX.rise, yb = s.bot - 0.8, ye = yTop + 0.7, [b0, b1] = wallsAt(ga, yb - 2), span = b1 - b0;
        const spots = [b0 + span * 0.28, b0 + span * 0.62, b0 + span * 0.45];
        // 갓 따랐으면 n × burst 개: 넘는 방울은 따른 직후 조금씩 엇갈려 바닥에서 생겨 1.6배 빨리 오르고, 따른 뒤 1.5초 ~ fade 초 사이에 하나씩 옅어지며 그친다 → 개수가 서서히 n 으로
        const since = fresh ? (Date.now() - fresh) / 1000 : Infinity, total = since < r.fade ? r.n * r.burst : r.n, hs = r.size / 2;
        for (let k = 0; k < total; k++) {
          const x = spots[k % spots.length] + (rnd(k + 91) - 0.5) * 1.2, sw = (rnd(k + 13) - 0.5) * 2.2;
          let dur = Math.max(1.2, (yb - ye) / (r.speed * (0.8 + rnd(k + 5) * 0.5))), begin = ph(dur, k), fadeOut = '';
          if (k >= r.n) {
            const j = k - r.n, E = total - r.n, stopAt = 1.5 + (r.fade - 1.5) * (j + 1) / E; // 따른 시각 기준 초 (이 SVG 가 생긴 때 = 0 은 따른 뒤 since 초)
            if (since >= stopAt) continue; // 이미 그친 방울
            dur /= 1.6; begin = `${(-since + (j % 8) * 0.2).toFixed(2)}s`;
            fadeOut = `<animate attributeName="opacity" values="1; 1; 0" keyTimes="0; ${((stopAt - 1) / stopAt).toFixed(3)}; 1" dur="${stopAt.toFixed(2)}s" begin="${(-since).toFixed(2)}s" fill="freeze"/>`;
          }
          const bub = r.tex ? `<image href="${artURL(`${r.tex}.webp`)}" x="${-hs}" y="${-hs}" width="${r.size}" height="${r.size}" style="mix-blend-mode:plus-lighter"/><image href="${artURL(`${r.tex}.webp`)}" x="${-hs}" y="${-hs}" width="${r.size}" height="${r.size}" style="mix-blend-mode:plus-lighter"/>` : `<circle r="${hs}" fill="#ffffff" fill-opacity=".07" stroke="#ffffff" stroke-opacity=".7" stroke-width=".1"/>`;
          const t = `dur="${dur.toFixed(2)}s" begin="${begin}" repeatCount="indefinite"`;
          const one = `<g opacity="0"><animate attributeName="opacity" values="0; .95; .95; 0" keyTimes="0; .1; .88; 1" ${t}/><g transform="translate(-50 0)"><animateTransform attributeName="transform" type="translate" values="${x.toFixed(2)} ${yb.toFixed(2)}; ${(x + sw).toFixed(2)} ${((yb + ye) / 2).toFixed(2)}; ${(x - sw * 0.4).toFixed(2)} ${ye.toFixed(2)}" ${t}/><g><animateTransform attributeName="transform" type="scale" values=".4; .85; 1.35" ${t}/>${bub}</g></g></g>`;
          extra += fadeOut ? `<g class="burst">${fadeOut}${one}</g>` : one;
        }
      }
      if (fx && FOAM_FX.ring.on && fizzTop && !foam) {
        const urls = FOAM_FX.fizz.map((t, i) => pat(`${id}r${i}`, t)), ell = (sx: number, sy: number) => `M${(ecx - erx * sx).toFixed(2)} ${yTop.toFixed(2)} a${(erx * sx).toFixed(2)} ${(ery * sy).toFixed(2)} 0 1 0 ${(erx * sx * 2).toFixed(2)} 0 a${(erx * sx).toFixed(2)} ${(ery * sy).toFixed(2)} 0 1 0 ${(-erx * sx * 2).toFixed(2)} 0 Z`;
        // 가장자리 기포 고리: 바깥 두 겹 (얇은 고리 + 그 안쪽 옅은 고리) 에 기포 무늬만 — 흰 바탕 없이
        const ringD = `${ell(1, 1)} ${ell(0.9, 0.82)}`, ring2 = `${ell(0.9, 0.82)} ${ell(0.8, 0.66)}`;
        over2 += FOAM_FX.fizz.map((t, i) => texed(urls[i], ringD, Math.min(1, t.op * 2.4) * FOAM_FX.ring.op, FOAM_FX.blend) + texed(urls[i], ring2, Math.min(1, t.op * 1.2) * FOAM_FX.ring.op, FOAM_FX.blend)).join('');
        if (!still) for (let k = 0; k < FOAM_FX.ring.pops; k++) {
          const a = rnd(k + 61) * Math.PI * 2, px = ecx + Math.cos(a) * erx * 0.88, py = yTop + Math.sin(a) * ery * 0.82, dur = 1.8 + rnd(k + 3) * 1.6;
          over2 += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0" fill="none" stroke="#ffffff" stroke-width=".14" opacity="0"><animate attributeName="r" values="0; .55; .85" keyTimes="0; .7; 1" dur="${dur.toFixed(2)}s" begin="${ph(dur, k + 7)}" repeatCount="indefinite"/><animate attributeName="opacity" values="0; .9; 0" keyTimes="0; .7; 1" dur="${dur.toFixed(2)}s" begin="${ph(dur, k + 7)}" repeatCount="indefinite"/></circle>`;
        }
      }
      let bumpyTop = '';
      if (fx && FOAM_FX.bumpy.on && foam) {
        // 거품 윗면: 단면 타원에 둥근 혹 (뒤쪽 위로 크게, 앞쪽은 작게) · 띠는 위가 희고 아래 (액체와 닿는 쪽) 가 누렇다
        const N = 48, amp = FOAM_FX.bumpy.amp, pts: string[] = [];
        for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2, back = Math.sin(t) < 0, bump = Math.abs(Math.sin(t * 7 + 0.6)) * (back ? amp : amp * 0.35); pts.push(`${(ecx + Math.cos(t) * erx).toFixed(2)} ${(yTop + Math.sin(t) * ery - bump).toFixed(2)}`); }
        const th = Math.min(3, H * 0.12);
        parts.push(`<linearGradient id="${id}hg" gradientUnits="userSpaceOnUse" x1="0" y1="${(yTop - ery).toFixed(2)}" x2="0" y2="${(yTop + ery + th).toFixed(2)}"><stop offset="0" stop-color="#f7f2e6"/><stop offset=".55" stop-color="#ece0c0"/><stop offset="1" stop-color="#cdb478"/></linearGradient>`);
        bumpyTop = `<path d="${below(ga, yTop, true)} ${below(ga, yTop + th, true)}" fill-rule="evenodd" fill="url(#${id}hg)" fill-opacity=".95"/><path d="M${pts.join(' L')} Z" fill="#f6f0e2"/>${texed(pat(`${id}hb`, FOAM_FX.head), `M${pts.join(' L')} Z`, FOAM_FX.head.op, FOAM_FX.head.blend)}`;
      }
      const face = foam && bumpyTop ? ''
        : foam
        ? `<path d="${headD}" fill-rule="evenodd" fill="#efe6d2" fill-opacity=".9"/>${fx ? texed(pat(`${id}h`, FOAM_FX.head), headD, FOAM_FX.head.op, FOAM_FX.head.blend) : ''}`
        : SURFACE.mode === 'flat' ? (() => {
          const E = `cx="${ecx.toFixed(2)}" cy="${yTop.toFixed(2)}" rx="${erx.toFixed(2)}" ry="${ery.toFixed(2)}"`;
          let f = `<ellipse ${E} fill="${tint(topC, SURF2.faceTint)}" fill-opacity="${Math.min(0.95, topA + 0.12).toFixed(2)}"/>`;
          // 수면 앞 (아래) 끝: 밝게 안쪽으로 · 뒤 (위) 끝: 짙게 안쪽으로
          // 테두리에 딱 맞는 원형 (타원) 그라데이션 고리 × 그 끝에서 수면 가운데로 갈수록 옅어지는 선형 마스크 (2026-11-05 사용자)
          const ring = (gid: string, c0: string, c1: string, op: number, near: boolean) => {
            parts.push(`<radialGradient id="${gid}r" cx=".5" cy=".5" r=".5"><stop offset=".42" stop-color="${c1}" stop-opacity="0"/><stop offset=".78" stop-color="${c1}" stop-opacity="${(op * 0.45).toFixed(2)}"/><stop offset="1" stop-color="${c0}" stop-opacity="${op}"/></radialGradient>`
              + `<linearGradient id="${gid}l" x1="0" y1="${near ? 1 : 0}" x2="0" y2="${near ? 0 : 1}"><stop offset="0" stop-color="#ffffff"/><stop offset=".58" stop-color="#000000"/></linearGradient><mask id="${gid}k" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${gid}l)"/></mask>`);
            return `<ellipse ${E} fill="url(#${gid}r)" mask="url(#${gid}k)"/>`;
          };
          if (SURF2.nearGlow) f += ring(`${id}sn`, tint(topC, 0.78), tint(topC, 0.65), SURF2.nearGlow, true);
          if (SURF2.farDark) f += ring(`${id}sd`, deep(topC, 1.5, 0.45), deep(topC, 1.4, 0.55), SURF2.farDark, false);
          return f;
        })()
        : surfaceHtml(id, parts, ecx, yTop, erx, ery, topC, topA, lsc);
      // 투과광: 역광이 음료를 지나며 빛난다 — 맑을수록 (재료 불투명도가 낮을수록) 세게, screen
      let glowFx = '';
      if (lsc && GLASS_LIGHT.glow) {
        const L = LIGHTS[lsc], trans = 1 - d.fill.reduce((t, x) => t + alphaOf(x), 0) / Math.max(1, d.fill.length), op = L.glow * (0.3 + trans);
        const g0 = L.band ? L.band[0] - L.band[1] * 2 : yTop, g1 = L.band ? L.band[0] + L.band[1] * 2 : s.bot;
        parts.push(L.band
          ? `<linearGradient id="${id}gl" gradientUnits="userSpaceOnUse" x1="0" y1="${g0}" x2="0" y2="${g1}"><stop offset="0" stop-color="${L.back}" stop-opacity="0"/><stop offset=".5" stop-color="${L.back}" stop-opacity="1"/><stop offset="1" stop-color="${L.back}" stop-opacity="0"/></linearGradient>`
          : `<linearGradient id="${id}gl" gradientUnits="userSpaceOnUse" x1="0" y1="${g0.toFixed(2)}" x2="0" y2="${g1.toFixed(2)}"><stop offset="0" stop-color="${L.back}" stop-opacity="1"/><stop offset="1" stop-color="${L.back}" stop-opacity=".15"/></linearGradient>`);
        glowFx = `<rect${L.band ? ` class="glow-band" data-g="${id}gl" data-hw="${L.band[1]}"` : ''} x="-2" y="${(L.band ? g0 : yTop - 2).toFixed(2)}" width="52" height="${(L.band ? g1 - g0 : s.bot - yTop + 4).toFixed(2)}" fill="url(#${id}gl)" opacity="${op.toFixed(2)}" style="mix-blend-mode:screen"/>`;
        if (GLASS_LIGHT.amb) glowFx += `<rect x="-2" y="-10" width="52" height="90" fill="${L.amb}" opacity="${(L.ambOp * 0.6).toFixed(2)}" style="mix-blend-mode:soft-light"/>`;
      }
      // 음료 몸통 가장자리: 잔 벽 (안쪽 영역 테두리) 에서 안쪽으로 짙게 — 안쪽 영역을 흐려 테두리 띠만 남기는 필터 (역광 아래 층)
      let edgeFx = '';
      if (SURF2.edgeDark) {
        const r0 = ga.rows[0], tall = `M${r0[1]} -20 L${ga.rows.map((r) => `${r[1]} ${r[0]}`).join(' L')} L${arc(ga, ga.bot, true)} L${[...ga.rows].reverse().map((r) => `${r[2]} ${r[0]}`).join(' L')} L${r0[2]} -20 Z`;
        parts.push(`<filter id="${id}ie" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b"/><feComposite in="SourceAlpha" in2="b" operator="arithmetic" k2="2" k3="-2" result="e"/><feFlood flood-color="${deep(mix(d.fill.map(colorOf)), 1.5, 0.45)}" flood-opacity="1"/><feComposite in2="e" operator="in"/></filter>`);
        edgeFx = `<path d="${tall}" fill="#000000" filter="url(#${id}ie)" opacity="${SURF2.edgeDark}"/>`;
      }
      body.push(`<g class="liq" data-h="${(s.bot - yTop + 1).toFixed(2)}"><g clip-path="url(#${id}t)">${blur ? `<g filter="url(#${id}b)">${layers}</g>` : layers}${edgeFx}${glowFx}${fizzFx}${extra}${face}${over2}</g>${bumpyTop}</g>`);
    } else {
      body.push(`<rect class="liq" x="0" y="${yTop.toFixed(2)}" width="48" height="${(s.bot - yTop + 1).toFixed(2)}" fill="${fill}" fill-opacity="${alpha}"/>`);
      // 맥주 거품: 맨 위층이 맥주면 액면에 얇은 거품
      if (foam) body.push(`<rect x="0" y="${(yTop - 0.4).toFixed(2)}" width="48" height="${Math.min(3, H * 0.12).toFixed(2)}" fill="#efe6d2" fill-opacity=".9"/>`);
    }
    // 기포: 탄산 층 안에만 (프로즌은 얼음 결)
    if (frozen) for (let k = 0; k < 14; k++) { const y = s.bot - H * lv * rnd(k + 7); body.push(`<circle cx="${(8 + 32 * rnd(k)).toFixed(1)}" cy="${y.toFixed(1)}" r="0.8" fill="#ffffff" fill-opacity=".45"/>`); }
    else if (!(ga && FOAM_FX.on)) segs.forEach((sg, si) => {
      if (!ING_BY_ID[sg.ing]?.fizz) return;
      for (let k = 0; k < Math.ceil((sg.b - sg.a) * 10); k++) {
        const y = s.bot - H * (sg.a + (sg.b - sg.a) * rnd(si * 31 + k));
        if (y < yTop + 1) continue;
        body.push(`<circle cx="${(10 + 28 * rnd(si * 17 + k * 3)).toFixed(1)}" cy="${y.toFixed(1)}" r=".7" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width=".5"/>`);
      }
    });
  }
  // 얼음 (2026-11-04 사용자 요청): 조금 = 1 · 2개, 많이 = 2 · 3개 (작은 잔 3칸 / 큰 잔 4 · 5칸). 큰 얼음(잔 안쪽 폭의 62%, 최대 12)을 좌우로 조금씩 엇갈려 층으로 쌓는다.
  //   액면이 쌓인 맨 위보다 높으면 떠오른다 (맨 위 얼음이 4분의 1쯤 액면 위로), 아니면 바닥에 가라앉아 있다. 잔 그림 모드는 얼음 그림 (불투명도 ICE_OPACITY)
  const iceN = ICE_N[d.glass] ?? ((g?.slots ?? 3) >= 4 ? [2, 3] : [1, 2]);
  const nIce = d.ice === 'little' ? iceN[0] : d.ice === 'lots' ? iceN[1] : 0;
  if (nIce) {
    const wAt = (y: number): [number, number] => (ga ? wallsAt(ga, y) : [s.rim[0] + 1.5, s.rim[1] - 1.5]);
    // 얼음 그림은 얼음마다 무작위 (같은 잔은 늘 같게 — 다시 그릴 때 바뀌지 않도록 잔 내용으로 고정 난수)
    const seed = [...`${d.glass}${d.fill.join('')}${d.garnish.join('')}${d.ice}`].reduce((t, ch) => (t * 31 + ch.charCodeAt(0)) % 9973, 7);
    const vOf = (k: number) => Math.floor(rnd(seed + k * 17) * ICE_ART.length) % ICE_ART.length;
    // 잔마다 같은 크기 (정사각 상자, 그림 비율 차이는 무시). 아래에서부터, 그 높이에 들어가는 가장 낮은 자리에 놓는다 (좁은 바닥 · 스템 잔 볼)
    const sz = ga ? ICE_SIZE[d.glass] ?? 9 : Math.min(12, (s.rim[1] - s.rim[0] - 3) * 0.62), h = sz;
    const fitW = (yb: number) => { const a = wAt(yb - 0.3), b = wAt(yb - h); return Math.min(a[1] - a[0], b[1] - b[0]); };
    const stack = () => {
      const out: { cx: number; y: number; sz: number; h: number; k: number }[] = [];
      let y = s.bot;
      for (let k = 0; k < nIce; k++) {
        let yb = y;
        while (yb > s.top && fitW(yb) < sz + 0.8) yb -= 0.25;
        const [x0, x1] = wAt(yb - h / 2), room = Math.max(0, (x1 - x0 - sz - 0.8) / 2);
        out.push({ cx: (x0 + x1) / 2 + (k % 2 ? 1 : -1) * Math.min(room, (x1 - x0) * 0.12), y: yb, sz, h, k });
        y = yb - h * 0.86;
      }
      return out;
    };
    // 바닥에 쌓은 그대로 떠오른다 (위치만 옮김 — 다시 쌓으면 얼음 수 · 크기가 바뀌어 툭 사라진다)
    let cubes = stack();
    const last = cubes[cubes.length - 1];
    if (last && lv > 0) { const want = yTop - last.h * (ICE_RISE[d.glass] ?? ICE_RISE_DEF), top = last.y - last.h; if (want < top) cubes = cubes.map((c) => ({ ...c, y: c.y - (top - want) })); }
    for (const c of cubes) {
      if (ga) { const rot = (c.k % 2 ? 4 : -3) + (rnd(seed + c.k + 41) - 0.5) * 4; body.push(`<image class="ice" href="${artURL(`bar_ice_${vOf(c.k)}.webp`)}" x="${(c.cx - c.sz / 2).toFixed(2)}" y="${(c.y - c.h).toFixed(2)}" width="${c.sz.toFixed(2)}" height="${c.h.toFixed(2)}" opacity="${ICE_OPACITY}" preserveAspectRatio="none" transform="rotate(${rot.toFixed(1)} ${c.cx.toFixed(2)} ${(c.y - c.h / 2).toFixed(2)})"/>`); }
      else { const rot = (c.k % 2 ? 9 : -7) + (rnd(c.k + 41) - 0.5) * 8, cy = c.y - c.sz / 2; body.push(`<rect x="${(c.cx - c.sz / 2).toFixed(2)}" y="${(cy - c.sz / 2).toFixed(2)}" width="${c.sz.toFixed(2)}" height="${c.sz.toFixed(2)}" rx="${(c.sz * 0.17).toFixed(2)}" fill="#ffffff" fill-opacity=".22" stroke="#ffffff" stroke-opacity=".7" stroke-width="${(c.sz * 0.085).toFixed(2)}" transform="rotate(${rot.toFixed(1)} ${c.cx.toFixed(2)} ${cy.toFixed(2)})"/>`); }
    }
  }
  // 액면에 뜨는 가니쉬
  const cx = (s.rim[0] + s.rim[1]) / 2;
  const float = lv > 0.04 ? yTop : s.bot - 1.5;
  const over: string[] = [];
  // 잔 그림 모드 + 고른 가니쉬 그림이 있으면 그림 (public/art/bar_ong_<가니쉬 id>.webp, 2026-11-04 사용자 선택) — w = 너비, (x, y) = 왼쪽 위, rot = (ox, oy) 기준 회전
  const gArt = (gid: string) => (ga && PROP_ART[`ong_${gid}`] ? PROP_ART[`ong_${gid}`] : 0);
  const gImg = (gid: string, x: number, y: number, w: number, rot = 0, ox = x + w / 2, oy = y, clip = '') => `<image href="${artURL(`bar_ong_${gid}.webp`)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${(w * gArt(gid)).toFixed(2)}" preserveAspectRatio="none"${rot ? ` transform="rotate(${rot} ${ox.toFixed(2)} ${oy.toFixed(2)})"` : ''}${clip ? ` clip-path="url(#${clip})"` : ''}/>`;
  for (const gid of d.garnish) {
    if (gid === 'bean' && gArt('bean')) for (let k = 0; k < 3; k++) { const w = 2.3, hh = w * gArt('bean'), x = cx - 4.6 + k * 4.6 - w / 2; body.push(gImg('bean', x, float - hh * 0.5, w, 78 + k * 21, x + w / 2, float)); }
    else if (gid === 'cardia' && gArt('cardia')) for (let k = 0; k < 3; k++) { const w = 1.8, x = cx - 4 + k * 4 - w / 2; body.push(gImg('cardia', x, float - w * gArt('cardia') * 0.55 + (k % 2) * 0.5, w, k * 40 - 30, x + w / 2, float)); }
    else if (gid === 'marsh' && gArt('marsh') && lv > 0.04) for (let k = 0; k < 2; k++) { const w = 4, hh = w * gArt('marsh'), x = cx - 4.8 + k * 5.2; over.push(gImg('marsh', x, float - hh * 0.72 + k * 0.5, w, k ? 9 : -7, x + w / 2, float)); }
    else if (gid === 'petal' && gArt('petal')) { const w = 5.2; body.push(gImg('petal', cx + 0.5, float - w * gArt('petal') * 0.55, w, -14, cx + 3, float)); }
    else if (gid === 'cardia') for (let k = 0; k < 3; k++) body.push(`<circle cx="${(cx - 4 + k * 4).toFixed(1)}" cy="${(float + 0.6 + (k % 2)).toFixed(1)}" r=".9" fill="#7a2d1e"/>`);
    else if (gid === 'bean') for (let k = 0; k < 3; k++) body.push(`<ellipse cx="${(cx - 4 + k * 4).toFixed(1)}" cy="${(float + 0.8).toFixed(1)}" rx="1.4" ry=".9" fill="#3a2214"/>`);
    else if (gid === 'petal') body.push(`<ellipse cx="${(cx + 3).toFixed(1)}" cy="${(float + 0.6).toFixed(1)}" rx="2.2" ry="1" fill="#e89ab0" transform="rotate(-18 ${cx + 3} ${float})"/>`);
    else if (gid === 'marsh' && lv > 0.04) for (let k = 0; k < 2; k++) over.push(`<rect x="${(cx - 5 + k * 5).toFixed(1)}" y="${(float - 2.6 + k * 0.6).toFixed(1)}" width="4.4" height="3.4" rx="1.2" fill="#fbf6ee" stroke="#d9cfc0" stroke-width=".4"/>`);
    else if (gid === 'cream' && lv > 0.35) over.push(`<path d="M${cx - 7} ${float + 0.5} Q${cx - 7} ${float - 4} ${cx - 3} ${float - 3.4} Q${cx} ${float - 7} ${cx + 3} ${float - 3.4} Q${cx + 7} ${float - 4} ${cx + 7} ${float + 0.5} Z" fill="#fbf6ee" stroke="#d9cfc0" stroke-width=".4"/>`);
  }
  // 테두리에 거는 가니쉬
  const [rx0, rx1, ry] = s.rim;
  for (const gid of d.garnish) {
    if (gArt(gid) && (gid === 'salt' || gid === 'citrus' || gid === 'mint' || gid === 'crystal')) {
      if (gid === 'salt') { const w = rx1 - rx0 + 1; over.push(gImg('salt', rx0 - 0.5, ry + 0.4 - w * gArt('salt') / 2, w)); }
      // 시트러스: 통째가 아니라 반으로 잘라 (사용자 요청) 자른 면을 위로 테두리 오른쪽에 건다
      else if (gid === 'citrus') { const D = 11, ccx = rx1 - 1.2, ccy = ry + 0.2, cid = `${id}h`; over.push(`<clipPath id="${cid}"><rect x="${(ccx - D / 2 - 1).toFixed(2)}" y="${ccy.toFixed(2)}" width="${(D + 2).toFixed(2)}" height="${(D / 2 + 1).toFixed(2)}"/></clipPath>${gImg('citrus', ccx - D / 2, ccy - D * gArt('citrus') / 2, D, 0, ccx, ccy, cid)}`); }
      else if (gid === 'mint') { const h = 11, w = h / gArt('mint'); over.push(gImg('mint', rx0 + 4 - w / 2, ry + 1.6 - h, w, -14, rx0 + 4, ry + 1.6)); }
      else { const h = 7, w = h / gArt('crystal'); over.push(gImg('crystal', rx0 + 7.5 - w / 2, ry + 1.4 - h, w, 10, rx0 + 7.5, ry + 1.4)); }
      continue;
    }
    if (gid === 'salt') over.push(`<line x1="${rx0}" y1="${ry + 0.6}" x2="${rx1}" y2="${ry + 0.6}" stroke="#ffffff" stroke-width="1.6" stroke-dasharray=".6 .7"/>`);
    else if (gid === 'citrus') over.push(`<g transform="translate(${rx1 - 1} ${ry})"><circle r="5" fill="#f6b23c" stroke="#fbe3a4" stroke-width=".8"/><path d="M-4 0 H4 M0 -4 V4 M-2.8 -2.8 L2.8 2.8 M-2.8 2.8 L2.8 -2.8" stroke="#fbe3a4" stroke-width=".5"/></g>`);
    else if (gid === 'lime') over.push(`<path d="M${rx1 - 5} ${ry - 1} L${rx1 + 3} ${ry - 1} Q${rx1 - 1} ${ry + 7} ${rx1 - 5} ${ry - 1} Z" fill="#8cc63f" stroke="#d6eba6" stroke-width=".6"/>`);
    else if (gid === 'mint') over.push(`<path d="M${rx0 + 3} ${ry} q-3 -5 1 -8 q2 4 -1 8 Z M${rx0 + 4} ${ry} q3 -4 6 -3 q-2 4 -6 3 Z" fill="#5aa65a"/>`);
    else if (gid === 'crystal') over.push(`<path d="M${rx0 + 6} ${ry - 5} l2.4 3 l-2.4 3 l-2.4 -3 Z" fill="#bfe3f5" stroke="#ffffff" stroke-width=".4"/>`);
  }
  if (ga) {
    const [x, y, w, h] = ga.img;
    const img = `<image href="${artURL(`bar_glass_${d.glass in GLASS_ART ? d.glass : 'rock'}.webp`)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
    const vb = 'viewBox="0 0 48 72" preserveAspectRatio="xMidYMax meet"';
    if (art === 'plain') return `<svg class="${cls} art" ${vb} aria-hidden="true"><defs>${parts.join('')}</defs><g clip-path="url(#${id}c)">${body.join('')}</g>${img}${over.join('')}</svg>`;
    // 섞는 잔: 음료 · 잔 그림 · 테두리 가니쉬를 세 겹으로 (잔 그림 겹만 배경과 섞인다 — 묶음 .dk 는 고립 묶음을 만들지 않아야 한다: filter · transform · z-index 금지, 그림자는 음료 겹에)
    parts.push(`<filter id="${id}s" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation=".8"/></filter>`);
    const shadow = `<ellipse cx="24" cy="69.4" rx="${(w * 0.42).toFixed(2)}" ry="1.3" fill="#000000" fill-opacity=".45" filter="url(#${id}s)"/>`;
    // 잔 조명 (GLASS_LIGHT): 테이블 색 그림자 · 역광 테두리 · 환경광 — 겹마다 제 혼합 모드로 (svg 한 장 = 한 혼합 모드)
    let caustic = '', lightSvg = '';
    if (lsc) {
      const L = LIGHTS[lsc], gid = d.glass in GLASS_ART ? d.glass : 'rock', [sx, sy, sl, sth, sop] = L.sh;
      const scx = 24 + sx * w, scy = 69.6 + sy; // 그림자 가운데 (잔 밑에서 빛 반대쪽으로)
      if (GLASS_LIGHT.shadow) {
        parts.push(`<filter id="${id}sh" x="-40%" y="-400%" width="180%" height="900%"><feGaussianBlur stdDeviation="1"/></filter>`);
        caustic += `<ellipse cx="${scx.toFixed(2)}" cy="${scy.toFixed(2)}" rx="${(w * sl / 2 + 2).toFixed(2)}" ry="${sth.toFixed(2)}" fill="#000000" opacity="${sop}" filter="url(#${id}sh)"/>`;
      }
      // 색 그림자: 음료 색이 그림자 안쪽 끝에 은은하게 넓게 퍼진다 (2026-11-05 사용자: 너무 밝음 → 옅고 넓게)
      if (GLASS_LIGHT.caustic && lv > 0.05 && segs.length) {
        parts.push(`<filter id="${id}cs" x="-60%" y="-600%" width="220%" height="1300%"><feGaussianBlur stdDeviation="2.6"/></filter>`);
        const c = tint(mix(d.fill.map(colorOf)), 0.15), trans = 1 - d.fill.reduce((t, x) => t + alphaOf(x), 0) / Math.max(1, d.fill.length);
        caustic += `<ellipse cx="${(24 + sx * w * 1.25).toFixed(2)}" cy="${(69.6 + sy * 1.25).toFixed(2)}" rx="${(w * 0.62).toFixed(2)}" ry="2.6" fill="${c}" opacity="${(0.12 + trans * 0.22).toFixed(2)}" filter="url(#${id}cs)" style="mix-blend-mode:screen"/>`;
      }
      if (GLASS_LIGHT.rim) {
        const dir = L.rim === 'up' ? 'x1="0" y1="1" x2="0" y2="0"' : L.rim === 'left' ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="1" y1="0" x2="0" y2="0"';
        lightSvg += `<svg class="dk-rim" ${vb} style="mix-blend-mode:screen"><defs><mask id="${id}rm" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="72"><image href="${artURL(`bar_glass_${gid}_rim.webp`)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/></mask><linearGradient id="${id}rg" ${dir}><stop offset="0" stop-color="${L.back}" stop-opacity="${L.rimOp}"/><stop offset=".55" stop-color="${L.back}" stop-opacity="${(L.rimOp * 0.35).toFixed(2)}"/><stop offset="1" stop-color="${L.back}" stop-opacity="0"/></linearGradient></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}rg)" mask="url(#${id}rm)"/></svg>`;
      }
      if (GLASS_LIGHT.amb) {
        const cdir = L.rim === 'left' ? 'x1="1" y1="0" x2="0" y2="0"' : L.rim === 'right' ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"';
        lightSvg += `<svg class="dk-amb" ${vb} style="mix-blend-mode:soft-light"><defs><mask id="${id}am" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="72">${img}</mask><linearGradient id="${id}cg" ${cdir}><stop offset="0" stop-color="${L.cool}" stop-opacity="${L.coolOp}"/><stop offset=".6" stop-color="${L.cool}" stop-opacity="0"/></linearGradient></defs><g mask="url(#${id}am)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${L.amb}" opacity="${L.ambOp}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}cg)"/></g></svg>`;
      }
    }
    // 음료에 비치는 배경 흐림 (2026-11-05 사용자): 음료가 찬 영역 (벽 · 바닥 · 수면 뒤쪽 호) 만 잘라 HTML 겹에 backdrop-filter — SVG 안에서는 뒤 배경을 흐릴 수 없다
    let blurDiv = '';
    if (SURF2.blur && lv > 0.02 && segs.length) {
      const [t0, t1] = wallsAt(ga, yTop), down = ga.rows.filter((r) => r[0] > yTop);
      const back = arc(ga, yTop, false).split(' L').reverse().join(' L');
      const liqD = `M${t0.toFixed(2)} ${yTop.toFixed(2)} L${down.map((r) => `${r[1]} ${r[0]}`).join(' L')}${down.length ? ' L' : ''}${arc(ga, ga.bot, true)} L${[...down].reverse().map((r) => `${r[2]} ${r[0]}`).join(' L')}${down.length ? ' L' : ''}${t1.toFixed(2)} ${yTop.toFixed(2)} L${back} Z`;
      parts.push(`<clipPath id="${id}bl" clipPathUnits="objectBoundingBox"><path d="${liqD}" transform="scale(${1 / 48} ${1 / 72})"/></clipPath>`);
      blurDiv = `<i class="dk-blur" style="clip-path:url(#${id}bl)"></i>`;
    }
    return `<span class="${cls} art dk" aria-hidden="true">${blurDiv}<svg class="dk-liq" ${vb}><defs>${parts.join('')}</defs>${shadow}${caustic}<g clip-path="url(#${id}c)">${body.join('')}</g></svg><svg class="dk-glass" ${vb} style="opacity:${GLASS_OPACITY[d.glass in GLASS_ART ? d.glass : 'rock'] ?? 0.6}">${img}</svg>${lightSvg}${over.length ? `<svg class="dk-over" ${vb}>${over.join('')}</svg>` : ''}</span>`;
  }
  const glass = `<path d="${s.out}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>${s.stem ? `<path d="${s.stem}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>` : ''}`;
  const back = `<path d="${s.liq}" fill="currentColor" fill-opacity=".07"/>`;
  return `<svg class="${cls}" viewBox="0 0 48 72" aria-hidden="true"><defs>${parts.join('')}</defs>${back}<g clip-path="url(#${id}c)">${body.join('')}</g>${glass}${over.join('')}</svg>`;
}
