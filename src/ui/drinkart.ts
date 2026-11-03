// 음료 그림 (SVG): 잔 6종 · 칸마다 재료 색 층 (아래부터 붓는 순서, 경계는 살짝 섞임) · 얼음 · 가니쉬 · 남은 양.
// docs/UI.md 26: 명암 · 유리 반사 없이 한 색 면 · 선으로. 잔 테두리는 글자색(currentColor, CSS 가 토큰으로 준다).
// 남은 양 left (0~1): 위층부터 줄어든다 (잔 가장자리로 마시므로). 프로즌은 층이 섞여 한 색 + 얼음 결.
import { GLASS_BY_ID, ING_BY_ID, type Drink, type Glass } from '../data/bar/drinks';

/** 잔 모양 (보기 상자 48 × 72, 바닥 y = 70). out = 잔 테두리 경로, liq = 액체가 차는 안쪽 경로, top · bot = 가득 찼을 때 액면 · 바닥 높이, rim = 테두리 윗선 [x0, x1, y] */
interface Shape { out: string; liq: string; top: number; bot: number; rim: [number, number, number]; stem?: string }
const SHAPES: Record<string, Shape> = {
  rock: { out: 'M10 44 L10 70 L38 70 L38 44', liq: 'M11.5 46 L11.5 68.5 L36.5 68.5 L36.5 46 Z', top: 48, bot: 68.5, rim: [10, 38, 44] },
  highball: { out: 'M14 20 L14 70 L34 70 L34 20', liq: 'M15.5 22 L15.5 68.5 L32.5 68.5 L32.5 22 Z', top: 24, bot: 68.5, rim: [14, 34, 20] },
  pint: { out: 'M10 12 L14 70 L34 70 L38 12', liq: 'M11.6 14 L15.4 68.5 L32.6 68.5 L36.4 14 Z', top: 16, bot: 68.5, rim: [10, 38, 12] },
  coupe: { out: 'M5 36 Q24 60 43 36', liq: 'M6.5 37.5 Q24 58 41.5 37.5 Z', top: 38.5, bot: 47.5, rim: [5, 43, 36], stem: 'M24 48 L24 68 M15 70 L33 70 Q24 66 15 70' },
  wine: { out: 'M13 18 Q8 34 16 42 Q24 48 32 42 Q40 34 35 18', liq: 'M14.2 20 Q9.8 34 17 41 Q24 46.4 31 41 Q38.2 34 33.8 20 Z', top: 22, bot: 45.5, rim: [13, 35, 18], stem: 'M24 47 L24 68 M15 70 L33 70 Q24 66 15 70' },
  goblet: { out: 'M8 12 Q6 36 24 44 Q42 36 40 12', liq: 'M9.6 14 Q8 35 24 42.4 Q40 35 38.4 14 Z', top: 16, bot: 42, rim: [8, 40, 12], stem: 'M24 44 L24 68 M14 70 L34 70 Q24 65 14 70' },
};

let uid = 0;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (cs: string[]) => { const a = cs.map(hex); const m = [0, 1, 2].map((k) => Math.round(a.reduce((s, x) => s + x[k], 0) / a.length)); return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`; };
/** 0~1 고정 난수 (같은 잔은 늘 같은 기포 · 얼음 자리) */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** 한 잔 SVG. left = 남은 양 (0~1) */
export function drinkSvg(d: Drink, left = 1, cls = 'drink'): string {
  const g: Glass | undefined = GLASS_BY_ID[d.glass];
  const s = SHAPES[d.glass] || SHAPES.rock;
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
  let fill: string;
  if (frozen || segs.length <= 1) fill = segs.length ? (frozen ? mix(d.fill.map(colorOf)) : colorOf(segs[0].ing)) : 'none';
  else {
    const bl = 0.09 / n * 2;
    const stops = segs.flatMap((sg, i) => {
      const c = colorOf(sg.ing);
      const a = i === 0 ? 0 : sg.a + bl, b = i === segs.length - 1 ? 1 : sg.b - bl;
      return [`<stop offset="${a.toFixed(3)}" stop-color="${c}"/>`, `<stop offset="${b.toFixed(3)}" stop-color="${c}"/>`];
    }).join('');
    parts.push(`<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${s.bot}" x2="0" y2="${s.top}">${stops}</linearGradient>`);
    fill = `url(#${id}g)`;
  }
  parts.push(`<clipPath id="${id}c"><path d="${s.liq}"/></clipPath>`);
  const body: string[] = [];
  if (lv > 0 && segs.length) {
    const opaque = d.fill.some((x) => ING_BY_ID[x]?.opaque);
    body.push(`<rect class="liq" x="0" y="${yTop.toFixed(2)}" width="48" height="${(s.bot - yTop + 1).toFixed(2)}" fill="${fill}" fill-opacity="${opaque || frozen ? 1 : 0.88}"/>`);
    // 맥주 거품: 맨 위층이 맥주면 액면에 얇은 거품
    const topIng = segs[segs.length - 1].ing;
    if (!frozen && (topIng === 'ringside' || topIng === 'darkringer') && lv > 0.12) body.push(`<rect x="0" y="${(yTop - 0.4).toFixed(2)}" width="48" height="${Math.min(3, H * 0.12).toFixed(2)}" fill="#efe6d2"/>`);
    // 기포: 탄산 층 안에만 (프로즌은 얼음 결)
    if (frozen) for (let k = 0; k < 14; k++) { const y = s.bot - H * lv * rnd(k + 7); body.push(`<circle cx="${(8 + 32 * rnd(k)).toFixed(1)}" cy="${y.toFixed(1)}" r="0.8" fill="#ffffff" fill-opacity=".45"/>`); }
    else segs.forEach((sg, si) => {
      if (!ING_BY_ID[sg.ing]?.fizz) return;
      for (let k = 0; k < Math.ceil((sg.b - sg.a) * 10); k++) {
        const y = s.bot - H * (sg.a + (sg.b - sg.a) * rnd(si * 31 + k));
        if (y < yTop + 1) continue;
        body.push(`<circle cx="${(10 + 28 * rnd(si * 17 + k * 3)).toFixed(1)}" cy="${y.toFixed(1)}" r=".7" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width=".5"/>`);
      }
    });
  }
  // 온더록 얼음: 액면 근처에 뜬다 (거의 비면 바닥에)
  if (d.ice === 'rocks') {
    const cy = lv > 0.15 ? yTop + 1 : s.bot - 7.5;
    const w = s.rim[1] - s.rim[0];
    for (let k = 0; k < 2; k++) body.push(`<rect x="${(s.rim[0] + w * (0.2 + 0.36 * k)).toFixed(1)}" y="${(cy + k * 1.6).toFixed(1)}" width="7" height="7" rx="1.2" fill="#ffffff" fill-opacity=".22" stroke="#ffffff" stroke-opacity=".7" stroke-width=".6" transform="rotate(${k ? 12 : -8} ${(s.rim[0] + w * (0.2 + 0.36 * k) + 3.5).toFixed(1)} ${(cy + 3.5).toFixed(1)})"/>`);
  }
  // 액면에 뜨는 가니쉬
  const cx = (s.rim[0] + s.rim[1]) / 2;
  const float = lv > 0.04 ? yTop : s.bot - 1.5;
  const over: string[] = [];
  for (const gid of d.garnish) {
    if (gid === 'cardia') for (let k = 0; k < 3; k++) body.push(`<circle cx="${(cx - 4 + k * 4).toFixed(1)}" cy="${(float + 0.6 + (k % 2)).toFixed(1)}" r=".9" fill="#7a2d1e"/>`);
    else if (gid === 'bean') for (let k = 0; k < 3; k++) body.push(`<ellipse cx="${(cx - 4 + k * 4).toFixed(1)}" cy="${(float + 0.8).toFixed(1)}" rx="1.4" ry=".9" fill="#3a2214"/>`);
    else if (gid === 'petal') body.push(`<ellipse cx="${(cx + 3).toFixed(1)}" cy="${(float + 0.6).toFixed(1)}" rx="2.2" ry="1" fill="#e89ab0" transform="rotate(-18 ${cx + 3} ${float})"/>`);
    else if (gid === 'marsh' && lv > 0.04) for (let k = 0; k < 2; k++) over.push(`<rect x="${(cx - 5 + k * 5).toFixed(1)}" y="${(float - 2.6 + k * 0.6).toFixed(1)}" width="4.4" height="3.4" rx="1.2" fill="#fbf6ee" stroke="#d9cfc0" stroke-width=".4"/>`);
    else if (gid === 'cream' && lv > 0.35) over.push(`<path d="M${cx - 7} ${float + 0.5} Q${cx - 7} ${float - 4} ${cx - 3} ${float - 3.4} Q${cx} ${float - 7} ${cx + 3} ${float - 3.4} Q${cx + 7} ${float - 4} ${cx + 7} ${float + 0.5} Z" fill="#fbf6ee" stroke="#d9cfc0" stroke-width=".4"/>`);
  }
  // 테두리에 거는 가니쉬
  const [rx0, rx1, ry] = s.rim;
  for (const gid of d.garnish) {
    if (gid === 'salt') over.push(`<line x1="${rx0}" y1="${ry + 0.6}" x2="${rx1}" y2="${ry + 0.6}" stroke="#ffffff" stroke-width="1.6" stroke-dasharray=".6 .7"/>`);
    else if (gid === 'citrus') over.push(`<g transform="translate(${rx1 - 1} ${ry})"><circle r="5" fill="#f6b23c" stroke="#fbe3a4" stroke-width=".8"/><path d="M-4 0 H4 M0 -4 V4 M-2.8 -2.8 L2.8 2.8 M-2.8 2.8 L2.8 -2.8" stroke="#fbe3a4" stroke-width=".5"/></g>`);
    else if (gid === 'lime') over.push(`<path d="M${rx1 - 5} ${ry - 1} L${rx1 + 3} ${ry - 1} Q${rx1 - 1} ${ry + 7} ${rx1 - 5} ${ry - 1} Z" fill="#8cc63f" stroke="#d6eba6" stroke-width=".6"/>`);
    else if (gid === 'mint') over.push(`<path d="M${rx0 + 3} ${ry} q-3 -5 1 -8 q2 4 -1 8 Z M${rx0 + 4} ${ry} q3 -4 6 -3 q-2 4 -6 3 Z" fill="#5aa65a"/>`);
    else if (gid === 'crystal') over.push(`<path d="M${rx0 + 6} ${ry - 5} l2.4 3 l-2.4 3 l-2.4 -3 Z" fill="#bfe3f5" stroke="#ffffff" stroke-width=".4"/>`);
  }
  const glass = `<path d="${s.out}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>${s.stem ? `<path d="${s.stem}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>` : ''}`;
  const back = `<path d="${s.liq}" fill="currentColor" fill-opacity=".07"/>`;
  return `<svg class="${cls}" viewBox="0 0 48 72" aria-hidden="true"><defs>${parts.join('')}</defs>${back}<g clip-path="url(#${id}c)">${body.join('')}</g>${glass}${over.join('')}</svg>`;
}
