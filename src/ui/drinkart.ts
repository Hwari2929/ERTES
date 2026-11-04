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
/** 거품 · 기포 텍스처 (public/art/bar_foam_<번호>.webp — 2026-11-04 사용자가 3 · 7 · 8 을 골라 배경을 지움, 뒤집어 붙인 이음매 없는 타일).
 *  bubble = 탄산 층 기포 (3 방울 테두리), spark = 탄산 층 반짝임 (8), head = 맥주 거품 띠의 결 (7). blend = 혼합 모드, tile = 48 × 72 상자 단위 타일 한 변. on = false 면 예전 SVG 기포 */
export const FOAM_FX = {
  on: false,
  bubble: { tex: 'bar_foam_3', tile: 44, op: 0.8, blend: 'screen' },
  spark: { tex: 'bar_foam_8', tile: 40, op: 1, blend: 'screen' },
  head: { tex: 'bar_foam_7', tile: 28, op: 0.9, blend: 'multiply' },
};
let uid = 0;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
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
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 0.8, ry = rx * lerp(ga.k[0], ga.k[1], Math.max(0, Math.min(1, (y - ga.top) / (ga.bot - ga.top))));
  const pts: string[] = [];
  for (let i = 0; i <= 16; i++) { const t = -1 + i / 8; pts.push(`${(cx + rx * t).toFixed(2)} ${(y + (front ? 1 : -1) * ry * Math.sqrt(1 - t * t)).toFixed(2)}`); }
  return pts.join(' L');
};
/** 호 아래 전부 (잔 밖은 안쪽 영역으로 잘린다) */
const below = (ga: Art, y: number, front: boolean) => `M-2 ${y.toFixed(2)} L${arc(ga, y, front)} L50 ${y.toFixed(2)} L50 80 L-2 80 Z`;
/** 잔 그림의 안쪽 영역: 테두리 높이에서 벽을 따라 내려가 바닥은 바닥 타원의 앞쪽 호. 위는 테두리까지 열어 둔다 — 가득 찬 액면(단면 타원 뒤쪽 호)과 수면 위로 나온 얼음이 직선으로 잘리지 않게 (2026-11-04) */
const inner = (ga: Art) => { const r0 = ga.rows[0], ty = Math.min(ga.rim[2], r0[0] - 1.5); return `M${r0[1]} ${ty} L${ga.rows.map((r) => `${r[1]} ${r[0]}`).join(' L')} L${arc(ga, ga.bot, true)} L${[...ga.rows].reverse().map((r) => `${r[2]} ${r[0]}`).join(' L')} L${r0[2]} ${ty} Z`; };

/** 한 잔 SVG. left = 남은 양 (0~1) · art = 잔 일러스트: true = 잔 그림을 따로 한 겹으로 배경과 섞는다 (color-dodge 0.6, 어두운 바탕 — 제조대 · 완성 장면 · 카운터 · 잔 진열), 'plain' = 섞지 않는다 (종이 위 — 영수증 사진 · 레시피북) */
export function drinkSvg(d: Drink, left = 1, cls = 'drink', art: boolean | 'plain' = false): string {
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
      const layers = frozen || segs.length <= 1
        ? `<rect x="-2" y="-10" width="52" height="90" fill="${fill}" fill-opacity="${alpha}"/>`
        : segs.map((sg) => `<path d="${sg.b < 1 ? below(ga, yAt(sg.b), true) : 'M-2 -10 L50 -10 L50 80 L-2 80 Z'}${sg.a > 0 ? ` ${below(ga, yAt(sg.a), true)}` : ''}" fill-rule="evenodd" fill="${colorOf(sg.ing)}" fill-opacity="${alphaOf(sg.ing)}"/>`).join('');
      const blur = !frozen && segs.length > 1;
      if (blur) parts.push(`<filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(0.09 / n * 2 * H * 0.6).toFixed(2)}"/></filter>`);
      parts.push(`<clipPath id="${id}t"><path d="${below(ga, yTop, false)}"/></clipPath>`);
      const [x0, x1] = wallsAt(ga, yTop), ecx = (x0 + x1) / 2, erx = (x1 - x0) / 2 + 0.8, ery = erx * lerp(ga.k[0], ga.k[1], Math.max(0, Math.min(1, (yTop - ga.top) / (ga.bot - ga.top))));
      // 윗면 (조명을 받아 몸통보다 밝다): 맨 위 층 색에 흰색 35% 를 섞고 불투명도 +0.12 (2026-11-04 사용자)
      const topC = frozen ? fill : colorOf(topIng), topA = frozen ? alpha : alphaOf(topIng);
      // 텍스처 층 (FOAM_FX): 타일 무늬 하나를 영역에 채우고 혼합 모드로 얹는다
      const fx = FOAM_FX.on;
      const pat = (key: 'bubble' | 'spark' | 'head') => { const t = FOAM_FX[key], pid = `${id}${key}`; parts.push(`<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${t.tile}" height="${t.tile}"><image href="${artURL(`${t.tex}.webp`)}" width="${t.tile}" height="${t.tile}" preserveAspectRatio="none"/></pattern>`); return `url(#${pid})`; };
      const texed = (key: 'bubble' | 'spark' | 'head', d: string) => `<path d="${d}" fill-rule="evenodd" fill="${pat(key)}" opacity="${FOAM_FX[key].op}" style="mix-blend-mode:${FOAM_FX[key].blend}"/>`;
      const headD = `${below(ga, yTop, false)} ${below(ga, Math.min(s.bot, yTop + Math.min(3, H * 0.12)), true)}`;
      let fizzFx = '';
      if (fx && !frozen) segs.forEach((sg) => {
        if (!ING_BY_ID[sg.ing]?.fizz) return;
        const d = `${sg.b < 1 ? below(ga, yAt(sg.b), true) : 'M-2 -10 L50 -10 L50 80 L-2 80 Z'}${sg.a > 0 ? ` ${below(ga, yAt(sg.a), true)}` : ''}`;
        fizzFx += texed('bubble', d) + texed('spark', d);
      });
      const face = foam
        ? `<path d="${headD}" fill-rule="evenodd" fill="#efe6d2" fill-opacity=".9"/>${fx ? texed('head', headD) : ''}`
        : `<ellipse cx="${ecx.toFixed(2)}" cy="${yTop.toFixed(2)}" rx="${erx.toFixed(2)}" ry="${ery.toFixed(2)}" fill="${tint(topC, 0.35)}" fill-opacity="${Math.min(0.95, topA + 0.12).toFixed(2)}"/>`;
      body.push(`<g class="liq" data-h="${(s.bot - yTop + 1).toFixed(2)}"><g clip-path="url(#${id}t)">${blur ? `<g filter="url(#${id}b)">${layers}</g>` : layers}${fizzFx}${face}</g></g>`);
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
    return `<span class="${cls} art dk" aria-hidden="true"><svg class="dk-liq" ${vb}><defs>${parts.join('')}</defs>${shadow}<g clip-path="url(#${id}c)">${body.join('')}</g></svg><svg class="dk-glass" ${vb}>${img}</svg>${over.length ? `<svg class="dk-over" ${vb}>${over.join('')}</svg>` : ''}</span>`;
  }
  const glass = `<path d="${s.out}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>${s.stem ? `<path d="${s.stem}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>` : ''}`;
  const back = `<path d="${s.liq}" fill="currentColor" fill-opacity=".07"/>`;
  return `<svg class="${cls}" viewBox="0 0 48 72" aria-hidden="true"><defs>${parts.join('')}</defs>${back}<g clip-path="url(#${id}c)">${body.join('')}</g>${glass}${over.join('')}</svg>`;
}
