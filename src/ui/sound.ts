// 효과음 (1단계): 오디오 파일 없이 WebAudio 합성(오실레이터 · 노이즈 · 엔벌로프 · 간단한 필터)만으로 낸다.
// - AudioContext 는 첫 사용자 입력(pointerdown · keydown · touchend)에서 만들거나 깨운다 (브라우저 자동 재생 제한).
// - iOS 17+: navigator.audioSession.type = 'ambient' → 무음 스위치를 따른다.
// - 탭이 숨겨지면 새 소리를 내지 않고 컨텍스트를 잠재운다.
// - node(tests · 밸런스 시뮬레이션)에는 window · AudioContext 가 없다 → 모든 함수가 아무 일도 하지 않는다.
// - 음색: 사인 · 삼각파 위주, 고음은 짧고 작게, 저음 '쿵'은 피한다. 마스터 = 고역 통과(45Hz) → 저역 통과(9kHz) → 컴프레서 → 음량 → 리미터.
// - 설정: errantes.prefs.v1 의 sndVol (0~100, 기본 60) · sndMute. 설정 화면 마크업은 prefHtml(), 입력은 여기서 직접 받는다 (data-snd).
// - 디버그: 주소에 ?soundtest 가 있으면 window.__sfx 에 호출 기록 · 합성 도구를 둔다.
import type { Pending } from '../types';
import { revealGrade } from '../data/items';
import { augGrade, supplyFaceAt, supplyGrade, supplySig } from './revealfx';

type Wave = 's' | 't' | 'q' | 'w' | 'n';
/** 소리 한 겹. o 파형(s 사인 · t 삼각 · q 사각 · w 톱니 · n 노이즈), f → e 음높이 미끄러짐(Hz), t 시작(초), a 어택 · h 유지 · d 감쇠, g 크기,
 *  p 필터(l 저역 · h 고역 · b 대역) c → c2 차단 주파수, q 공진, v 비브라토 깊이(비율) */
interface L { o: Wave; f?: number; e?: number; t?: number; a?: number; h?: number; d: number; g: number; p?: 'l' | 'h' | 'b'; c?: number; c2?: number; q?: number; v?: number }
export interface SfxOpts { pitch?: number; gain?: number; delay?: number; step?: number; boss?: boolean }

const HAS = typeof window !== 'undefined' && typeof document !== 'undefined';
const AC: (typeof AudioContext) | undefined = HAS ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;

// ───────── 합성 재료
let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const m = (n: number) => 440 * 2 ** ((n - 69) / 12); // MIDI 음 → Hz
const tone = (o: Wave, f: number, d: number, g: number, x: Partial<L> = {}): L => ({ o, f, d, g, ...x });
const noise = (d: number, g: number, p: 'l' | 'h' | 'b', c: number, x: Partial<L> = {}): L => ({ o: 'n', d, g, p, c, ...x });
const at = (t: number, ls: L[]) => ls.map((l) => ({ ...l, t: (l.t || 0) + t }));
/** 금속 막대 배음 (비정수 배) */
const bar = (f: number, g: number) => ([[1, 1, 0.35], [2.76, 0.6, 0.25], [5.4, 0.35, 0.15], [8.93, 0.2, 0.08]] as const).map(([r, k, d]) => tone('s', f * r, d, g * k));
const bell = (f: number, g: number) => ([[1, 1, 1], [2, 0.45, 0.6], [2.4, 0.3, 0.5], [3, 0.2, 0.4], [4.2, 0.12, 0.3]] as const).map(([r, k, d]) => tone('s', f * r, d, g * k));
const sparkle = (n: number, t0: number) => Array.from({ length: n }, (_, i) => tone('s', 1700 + rnd() * 1300, 0.12, 0.02, { t: t0 + i * 0.07 + rnd() * 0.04 }));
const woof = (t: number, k: number, far = false) => far
  ? [tone('w', 470 * k, 0.12, 0.07, { e: 280 * k, t, a: 0.01, p: 'l', c: 520 })]
  : [tone('w', 540 * k, 0.11, 0.11, { e: 300 * k, t, a: 0.008, p: 'b', c: 900, q: 1.2 }), tone('w', 560 * k, 0.1, 0.05, { e: 320 * k, t, p: 'b', c: 1800, q: 2 }), noise(0.05, 0.04, 'b', 1300, { t })];
const knock = (t = 0) => [tone('s', 250, 0.08, 0.14, { e: 150, a: 0.002, t }), noise(0.03, 0.06, 'b', 1200, { q: 1.5, a: 0.001, t })];

/** 소리 이름 → 겹 목록 (부를 때마다 무작위 요소를 새로 뽑는다) */
const R: Record<string, (o: SfxOpts) => L[]> = {
  // UI
  click: () => [tone('t', 1150, 0.035, 0.045, { e: 820, a: 0.002 }), noise(0.012, 0.015, 'b', 2600, { q: 1.5, a: 0.001 })],
  error: () => [tone('t', m(63), 0.08, 0.17, { p: 'l', c: 1400 }), tone('t', m(60), 0.13, 0.17, { t: 0.1, p: 'l', c: 1100 })],
  buy: () => [tone('t', m(83), 0.07, 0.1), tone('s', m(88), 0.28, 0.12, { t: 0.06 }), tone('s', m(100), 0.12, 0.02, { t: 0.06 }), noise(0.05, 0.025, 'b', 5000, { t: 0.06, q: 2 })],
  sell: () => [tone('t', m(76), 0.1, 0.12), tone('t', m(71), 0.22, 0.11, { t: 0.07 }), noise(0.05, 0.03, 'b', 3600, { t: 0.07, q: 3 })],
  reroll: () => [noise(0.14, 0.14, 'b', 450, { c2: 2400, a: 0.1, q: 1.3 }), tone('t', 1300, 0.03, 0.045, { t: 0.2, e: 1000 }), tone('t', 1500, 0.03, 0.04, { t: 0.26, e: 1150 })],
  place: () => [tone('s', 340, 0.075, 0.12, { e: 190, a: 0.002 }), noise(0.025, 0.04, 'b', 1700, { q: 2, a: 0.001 })],
  rankUp: (o) => { const k = 2 ** (Math.min(6, o.step || 0) / 6); return [...[72, 76, 79].map((n, i) => tone('t', m(n) * k, 0.2, 0.1, { t: i * 0.07 })), tone('s', m(84) * k, 0.45, 0.07, { t: 0.21 }), tone('s', m(91) * k, 0.25, 0.018, { t: 0.24 })]; },
  reveal1: () => [tone('s', m(81), 0.4, 0.1), tone('s', m(93), 0.16, 0.02)],
  reveal2: () => [tone('t', m(76), 0.5, 0.08), tone('t', m(83), 0.5, 0.07, { t: 0.06 }), tone('s', m(88), 0.3, 0.04, { t: 0.14 }), ...sparkle(2, 0.14)],
  reveal3: () => [...[72, 76, 79, 84].map((n, i) => tone('t', m(n), 0.7, 0.075, { t: i * 0.06 })), tone('w', m(48), 1, 0.03, { a: 0.18, p: 'l', c: 700, c2: 1600 }), tone('w', m(55), 1, 0.026, { a: 0.18, p: 'l', c: 700, c2: 1600 }), ...sparkle(6, 0.2)],
  // 절망 증강 공개: 낮은 음 하나가 천천히 차올랐다 가라앉는다 (작은 스피커에서도 들리게 한 옥타브 위를 옅게)
  despair: () => [tone('s', m(43), 1.7, 0.15, { a: 0.09, h: 0.25, p: 'l', c: 420 }), tone('t', m(55), 1.4, 0.035, { a: 0.12, h: 0.2, p: 'l', c: 600, v: 0.004 })],
  confirm: () => [tone('t', m(79), 0.12, 0.11), tone('s', m(86), 0.3, 0.11, { t: 0.06 }), tone('s', m(91), 0.15, 0.018, { t: 0.06 })],
  // 전투
  start: (o) => { const k = o.boss ? 0.75 : 1, n2 = o.boss ? 65 : 69; return [tone('w', m(62) * k, 0.45, 0.055, { a: 0.03, h: 0.12, p: 'l', c: 500, c2: 2200, q: 1 }), tone('w', m(n2) * k, 0.45, 0.045, { a: 0.03, h: 0.12, p: 'l', c: 500, c2: 2200, q: 1, t: 0.005 }), tone('s', 150, 0.22, 0.1, { e: 75 }), noise(0.12, 0.035, 'b', 1100, { q: 0.8 })]; },
  crit: () => [noise(0.07, 0.07, 'b', 2600, { c2: 1100, q: 1.2 }), tone('t', 640, 0.09, 0.08, { e: 300 }), tone('s', 1480, 0.13, 0.025, { t: 0.004 })],
  finish: () => [noise(0.13, 0.11, 'b', 3000, { c2: 650, q: 0.9, a: 0.012 }), tone('s', 170, 0.14, 0.13, { e: 82, t: 0.02 }), tone('t', 460, 0.08, 0.05, { e: 220, t: 0.02 })],
  kill: () => [tone('t', 820, 0.16, 0.13, { e: 300 }), noise(0.17, 0.1, 'l', 1500, { c2: 300 }), tone('s', m(84), 0.22, 0.045, { t: 0.06 })],
  down: () => [tone('t', 440, 0.25, 0.09, { e: 196 }), noise(0.15, 0.05, 'l', 700, { c2: 200 })],
  ult: () => [noise(0.2, 0.06, 'b', 300, { c2: 2800, a: 0.32, q: 1.2 }), tone('w', m(57), 0.6, 0.035, { a: 0.3, p: 'l', c: 400, c2: 2600 }), tone('w', m(64), 0.6, 0.03, { a: 0.3, p: 'l', c: 400, c2: 2600 }), tone('s', m(84), 0.7, 0.09, { t: 0.32 }), tone('s', m(84) * 2.01, 0.35, 0.022, { t: 0.32 }), tone('s', m(79), 0.6, 0.055, { t: 0.36 })],
  win: () => [...[72, 76, 79].map((n, i) => tone('t', m(n), 0.22, 0.11, { t: i * 0.11 })), tone('t', m(84), 0.8, 0.11, { t: 0.36 }), tone('s', m(88), 0.8, 0.06, { t: 0.36 }), tone('s', m(79), 0.8, 0.055, { t: 0.36 }), tone('w', m(60), 1, 0.026, { t: 0.33, a: 0.1, p: 'l', c: 900 })],
  lose: () => [...[69, 65, 62].map((n, i) => tone('t', m(n), 0.4, 0.1, { t: i * 0.22, p: 'l', c: 1500 })), tone('s', m(50), 0.9, 0.08, { t: 0.66 }), tone('s', m(57), 0.9, 0.04, { t: 0.66 })],
  // 사건 장면 (SFXS)
  clank: () => [...bar(420, 0.07), noise(0.02, 0.06, 'b', 3000, { q: 1 }), ...at(0.11, bar(450, 0.04))],
  scrape: () => [noise(0.2, 0.09, 'b', 1700, { a: 0.05, h: 0.28, q: 3 }), noise(0.2, 0.055, 'b', 900, { a: 0.05, h: 0.28, q: 4, c2: 1300 }), tone('w', 85, 0.2, 0.022, { a: 0.05, h: 0.28, p: 'l', c: 600 })],
  bark: () => [...woof(0, 1), ...woof(0.2, 0.94)],
  bark_far: () => woof(0, 0.9, true),
  rustle: () => Array.from({ length: 9 }, () => noise(0.02 + rnd() * 0.04, 0.03 + rnd() * 0.035, 'h', 2400, { t: rnd() * 0.35, a: 0.003 })),
  whistle: () => [tone('s', 1050, 0.08, 0.07, { e: 1550, a: 0.04, h: 0.08, v: 0.012 }), tone('s', 1550, 0.15, 0.065, { e: 1200, t: 0.22, a: 0.02, h: 0.05, v: 0.012 })],
  servo: () => [tone('w', 140, 0.1, 0.055, { e: 210, a: 0.03, h: 0.26, p: 'b', c: 700, q: 2 }), tone('s', 620, 0.1, 0.022, { e: 900, a: 0.03, h: 0.26 }), noise(0.02, 0.05, 'b', 2500, { t: 0.4 })],
  static: () => [noise(0.15, 0.045, 'b', 2200, { a: 0.02, h: 0.35, q: 0.6 }), ...Array.from({ length: 10 }, () => noise(0.006, 0.06, 'b', 4000, { t: rnd() * 0.5, q: 1, a: 0.001 }))],
  tick: () => [noise(0.008, 0.1, 'b', 3000, { q: 4, a: 0.001 }), tone('s', 1800, 0.015, 0.035), noise(0.008, 0.085, 'b', 2400, { t: 0.5, q: 4, a: 0.001 }), tone('s', 1450, 0.015, 0.03, { t: 0.5 })],
  dice: () => { let t = 0; return Array.from({ length: 6 }, (_, i) => { const r = at(t, [noise(0.015, 0.09, 'b', 1800 + rnd() * 900, { q: 3, a: 0.001 }), tone('t', 800 + rnd() * 500, 0.02, 0.035)]); t += 0.05 + i * 0.012 + rnd() * 0.05; return r; }).flat(); },
  crowd: () => [noise(0.6, 0.045, 'b', 500, { a: 0.25, h: 0.45, q: 1.5 }), noise(0.6, 0.04, 'b', 1100, { a: 0.25, h: 0.45, q: 1.8 }), noise(0.6, 0.026, 'b', 2400, { a: 0.25, h: 0.45, q: 2 }), ...[310, 370, 440].map((f) => tone('w', f, 0.6, 0.011, { e: f * 1.12, a: 0.2, h: 0.4, p: 'l', c: 1100, v: 0.02, t: rnd() * 0.1 }))],
  coin: () => [tone('s', 1500, 0.28, 0.055), tone('s', 3500, 0.12, 0.018), tone('s', 1550, 0.2, 0.032, { t: 0.13 }), tone('s', 3620, 0.08, 0.01, { t: 0.13 })],
  blast: () => [noise(0.9, 0.18, 'l', 2200, { c2: 160, a: 0.005 }), tone('s', 95, 0.35, 0.14, { e: 45 }), noise(0.12, 0.06, 'b', 900, { q: 0.8 })],
  // 묶음별 추가 효과음의 바탕 (SCENE 표에서 음높이 · 크기만 바꿔 쓴다)
  hum: () => [tone('w', 110, 0.5, 0.035, { a: 0.3, h: 0.7, p: 'l', c: 320 }), tone('w', 111.5, 0.5, 0.028, { a: 0.3, h: 0.7, p: 'l', c: 320 }), tone('s', 220, 0.5, 0.018, { a: 0.3, h: 0.7 })],
  bell: () => [...bell(880, 0.08), ...at(0.45, bell(880, 0.05))],
  knock: () => [...knock(), ...knock(0.16)],
  hiss: () => [noise(0.3, 0.055, 'h', 3000, { a: 0.03, h: 0.3 })],
  alarm: () => [0, 0.3, 0.6].flatMap((t) => [tone('t', 660, 0.12, 0.06, { t, h: 0.02 }), tone('t', 880, 0.12, 0.06, { t: t + 0.15, h: 0.02 })]),
  strum: () => [52, 57, 62, 67, 71].map((n, i) => tone('w', m(n), 0.7, 0.04, { t: i * 0.028, p: 'l', c: 2200, c2: 700, a: 0.003 })),
  twang: () => [tone('t', 180, 0.25, 0.11, { e: 150, a: 0.003 }), ...knock(0.22)],
  print: () => [...Array.from({ length: 8 }, (_, i) => noise(0.01, 0.05, 'b', 2100 + rnd() * 700, { t: i * 0.032, q: 3, a: 0.001 })), tone('q', 140, 0.24, 0.012, { p: 'l', c: 500 })], // 전표 인쇄기 (도트)
  heart: () => [tone('s', 64, 0.16, 0.24, { e: 42, a: 0.006 }), noise(0.05, 0.05, 'l', 220, { a: 0.002 }), tone('s', 58, 0.22, 0.19, { e: 38, t: 0.26, a: 0.006 }), noise(0.05, 0.04, 'l', 200, { t: 0.26, a: 0.002 })], // 심장 박동 2번 (그늘)
  chain: () => Array.from({ length: 7 }, (_, i) => at(i * 0.08 + rnd() * 0.05, bar(1100 + rnd() * 600, 0.012))).flat(), // 금 체인이 흔들리는 소리
  tear: () => [noise(0.32, 0.09, 'b', 1700, { c2: 3800, a: 0.02, q: 0.9 }), noise(0.08, 0.05, 'h', 4200, { t: 0.24 })], // 종이 찢기
  paper: () => [noise(0.12, 0.06, 'b', 2600, { a: 0.03, q: 1.2, c2: 1800 }), noise(0.05, 0.04, 'h', 4000, { t: 0.1 })],
  bubble: () => Array.from({ length: 10 }, () => { const f = 300 + rnd() * 400; return tone('s', f, 0.04, 0.045, { e: f * 1.7, t: rnd() * 0.8 }); }),
  beep: () => [tone('q', 880, 0.05, 0.03, { h: 0.04, p: 'l', c: 2200 }), tone('q', 1175, 0.05, 0.026, { t: 0.12, h: 0.04, p: 'l', c: 2200 })],
  cards: () => [...Array.from({ length: 12 }, (_, i) => noise(0.012, 0.08, 'b', 2500 + rnd() * 1000, { t: i * 0.025, q: 2, a: 0.001 })), noise(0.08, 0.08, 'b', 1200, { t: 0.32 })],
  squeal: () => [tone('w', 1250, 0.25, 0.022, { a: 0.05, h: 0.5, v: 0.015, p: 'b', c: 1300, q: 4 }), noise(0.3, 0.035, 'b', 2500, { a: 0.05, h: 0.4 })],
  creak: () => [tone('w', 95, 0.2, 0.13, { e: 150, a: 0.1, h: 0.4, p: 'b', c: 900, q: 6, v: 0.08 })],
  gun: () => [noise(0.03, 0.1, 'h', 2000), noise(0.3, 0.14, 'l', 3000, { c2: 350 }), tone('s', 150, 0.12, 0.1, { e: 60 })],
  rift: () => [...[900, 1350, 2100].map((f) => tone('s', f, 0.05, 0.035, { a: 0.6, e: f * 1.06 })), noise(0.05, 0.035, 'h', 3000, { a: 0.6 })],
  gurgle: () => [tone('s', 140, 0.2, 0.11, { a: 0.05, h: 0.4, v: 0.25, e: 110, p: 'l', c: 600 })],
};
/** 사건 장면 sfx 키 → [바탕 소리, 음높이 배율, 크기 배율]. 바탕 13종(SFXS)은 이름 그대로, 묶음별 추가 키는 가까운 소리로 근사 */
const SCENE: Record<string, [string, number?, number?]> = {
  a_hum: ['hum'], a_strum: ['strum'], a_snap: ['clank', 1.8, 0.6], a_ping: ['reveal1', 1.2], a_door: ['reroll', 0.5, 1.2], a_tambourine: ['rustle', 1.6],
  a_beep: ['beep'], a_simmer: ['bubble'], a_ladle: ['clank', 1.4], a_pen: ['paper', 1.3, 0.7], a_glass: ['bubble', 1.5, 0.8], a_cards: ['cards'],
  a_fridge: ['hum', 1.3, 0.8], a_knock: ['knock', 0.45, 1.2], a_steam: ['hiss'], a_marker: ['whistle', 1.2, 0.5], a_spray: ['hiss', 1.3, 0.8], a_brake: ['squeal'],
  b_alarm: ['alarm'], b_paper: ['paper'], b_sword: ['clank', 1.6], b_stamp: ['knock', 0.8, 1.2], b_dock: ['clank', 0.55], b_hum: ['hum', 0.8],
  b_gavel: ['knock', 1.1], b_bow: ['twang'], b_cup: ['coin', 1.25, 0.8], c_hum: ['whistle', 0.38, 0.9], c_page: ['paper'], c_creak: ['creak'],
  d_alarm: ['alarm', 0.85], d_hum: ['hum', 0.7], d_hiss: ['hiss', 0.8], d_gun: ['gun'], d_cards: ['cards'], d_gavel: ['knock', 1.1], d_bell: ['bell'],
  tu_rift: ['rift'], tu_crystal: ['bell', 1.8, 0.7], tu_stomach: ['gurgle'],
};

// ───────── 소리 그래프
const WAVE = { s: 'sine', t: 'triangle', q: 'square', w: 'sawtooth' } as const;
const FILT = { l: 'lowpass', h: 'highpass', b: 'bandpass' } as const;
const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuf(ctx: BaseAudioContext) {
  let b = noiseBufs.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    noiseBufs.set(ctx, b);
  }
  return b;
}
const endOf = (l: L) => (l.t || 0) + (l.a ?? 0.004) + (l.h || 0) + l.d;
/** 겹 하나를 ctx 에 예약한다 (t0 = 컨텍스트 시각, pm = 음높이 배율, gm = 크기 배율) */
function put(ctx: BaseAudioContext, out: AudioNode, l: L, t0: number, pm: number, gm: number) {
  const t = t0 + (l.t || 0), a = l.a ?? 0.004, h = l.h || 0, end = t + a + h + l.d;
  const g = ctx.createGain(), peak = l.g * gm;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (h) g.gain.setValueAtTime(peak, t + a + h);
  g.gain.exponentialRampToValueAtTime(1e-4, end);
  let src: AudioScheduledSourceNode;
  if (l.o === 'n') {
    const b = ctx.createBufferSource();
    b.buffer = noiseBuf(ctx); b.loop = true;
    b.start(t, rnd() * 0.9);
    src = b;
  } else {
    const o = ctx.createOscillator();
    o.type = WAVE[l.o];
    o.frequency.setValueAtTime(l.f! * pm, t);
    if (l.e) o.frequency.exponentialRampToValueAtTime(l.e * pm, end);
    if (l.v) { // 비브라토 6Hz
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = l.f! * pm * l.v;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(end + 0.03);
    }
    o.start(t);
    src = o;
  }
  let node: AudioNode = src;
  if (l.p) {
    const f = ctx.createBiquadFilter();
    f.type = FILT[l.p];
    f.frequency.setValueAtTime(l.c! * pm, t);
    if (l.c2) f.frequency.exponentialRampToValueAtTime(l.c2 * pm, end);
    f.Q.value = l.q ?? (l.p === 'b' ? 1 : 0.7);
    node.connect(f); node = f;
  }
  node.connect(g); g.connect(out);
  src.stop(end + 0.03);
}
/** 소리 하나를 예약하고 길이(초)를 돌려준다 */
function schedule(ctx: BaseAudioContext, out: AudioNode, name: string, t0: number, o: SfxOpts = {}, pm = 1, gm = 1) {
  const ls = R[name]?.(o);
  if (!ls) return 0;
  for (const l of ls) put(ctx, out, l, t0, pm * (o.pitch || 1), gm * (o.gain ?? 1));
  return Math.max(...ls.map(endOf));
}
/** 마스터: 입력 → 고역 통과 45Hz → 저역 통과 9kHz → 컴프레서 → 음량 → 리미터 → 출력. [입력, 음량 노드] */
function master(ctx: BaseAudioContext, vol: number): [AudioNode, GainNode] {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  const v = ctx.createGain(); v.gain.value = vol;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  hp.connect(lp); lp.connect(comp); comp.connect(v); v.connect(lim); lim.connect(ctx.destination);
  return [hp, v];
}

// ───────── 설정
let save: (k: string, v: unknown) => void = () => {};
let ranks: () => Record<string, number> = () => ({});
let vol = 60, mute = false;
/** main 이 넘겨주는 설정 읽기 · 쓰기 (errantes.prefs.v1) · 보유 기물 uid → 등급 (UI 동작 뒤 등급 상승 판정: 새로 들어온 기물은 제외) */
export function init(o: { prefs: () => object; save: (k: string, v: unknown) => void; ranks: () => Record<string, number> }) {
  const p = o.prefs() as { sndVol?: unknown; sndMute?: unknown };
  vol = typeof p.sndVol === 'number' && p.sndVol >= 0 && p.sndVol <= 100 ? Math.round(p.sndVol) : 60;
  mute = p.sndMute === true;
  save = o.save; ranks = o.ranks;
  applyVol();
}
/** 들리는 크기는 대략 제곱에 비례하게 (60 → 0.36) */
const gainOf = () => (mute ? 0 : (vol / 100) ** 2);

// ───────── 재생 상태
let ctx: AudioContext | null = null;
let bus: AudioNode | null = null, volNode: GainNode | null = null;
const DEBUG = HAS && /[?&#]soundtest\b/.test(location.search + location.hash);
const LOG: { t: number; n: string; ok: boolean; why?: string; k: 'ui' | 'battle' | 'scene' }[] = [];
const last = new Map<string, number>();
let active: number[] = []; // 울리는 중인 소리의 끝 시각 (ms)
let bwin: number[] = [], mwin: number[] = []; // 최근 1초 동안 낸 전투 소리 · 그중 치명타 · 피니쉬 (ms)
const MAX_VOICES = 6;
const COOL: Record<string, number> = { click: 40, crit: 90, finish: 90, kill: 110, down: 140, ult: 300 };
/** 동시 재생 상한을 넘어도 내는 소리 (큰 사건 · 화면 전환) */
const BIG = new Set(['ult', 'win', 'lose', 'start', 'rankUp', 'reveal3', 'error']);
/** 같은 입력 안에서 기본 클릭음을 대신하지 않는 소리 */
const SIDE = new Set(['reveal1', 'reveal2', 'reveal3', 'despair']);

function applyVol() { if (volNode && ctx) volNode.gain.setTargetAtTime(gainOf(), ctx.currentTime, 0.02); }
function unlock() {
  if (!AC || mute) return;
  try {
    if (!ctx) {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'ambient'; // iOS 17+: 무음 스위치 존중 · 다른 앱 소리와 섞임
      ctx = new AC({ latencyHint: 'interactive' });
      [bus, volNode] = master(ctx, gainOf());
    }
    if (ctx.state !== 'running' && !document.hidden) void ctx.resume().catch(() => {});
  } catch { ctx = null; }
}
if (HAS && AC) {
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else void ctx.resume().catch(() => {});
  });
}

function note(n: string, ok: boolean, k: 'ui' | 'battle' | 'scene', why?: string) {
  if (DEBUG) LOG.push({ t: Math.round(performance.now()), n, ok, why, k });
  return ok;
}
/** 재생 판정 + 재생. 재생했으면 true */
function play(name: string, o: SfxOpts, k: 'ui' | 'battle' | 'scene', jit: number, pm = 1, gm = 1): boolean {
  if (!HAS || !R[name]) return false;
  if (gest && k === 'ui' && !SIDE.has(name)) gest.claimed = true;
  if (mute || !vol) return note(name, false, k, 'muted');
  if (document.hidden) return note(name, false, k, 'hidden');
  const now = performance.now();
  if (now - (last.get(name) ?? -1e9) < (COOL[name] ?? 60)) return note(name, false, k, 'cool');
  active = active.filter((e) => e > now);
  if (active.length >= MAX_VOICES + (BIG.has(name) ? 2 : 0)) return note(name, false, k, 'voices');
  last.set(name, now);
  seed = 1 + Math.floor(Math.random() * 2147483000);
  const p = pm * (1 + (rnd() * 2 - 1) * jit);
  let len = 0.3;
  const live = !!(ctx && bus && ctx.state === 'running');
  if (live) {
    try { len = schedule(ctx!, bus!, name, ctx!.currentTime + 0.005 + (o.delay || 0), o, p, gm); } catch { /* 노드 생성 실패: 조용히 넘어간다 */ }
  } else if (!DEBUG) return note(name, false, k, 'locked');
  active.push(now + ((o.delay || 0) + len) * 1000);
  return note(name, true, k, live ? undefined : 'nosound'); // 디버그: 컨텍스트가 없어도 판정은 기록
}

// ───────── 공개 API
/** UI · 결과 화면 효과음 */
export function sfx(name: string, o: SfxOpts = {}) { play(name, o, 'ui', 0.02); }

/** 사건 장면(ADV) 대사 줄의 sfx 태그 */
export function scene(key: string) {
  const [n, p, g] = SCENE[key] || [key];
  if (!R[n]) { note(key, false, 'scene', 'unknown'); return; }
  play(n, {}, 'scene', 0.03, p ?? 1, g ?? 1);
}

/** 전투 사건: 치명타 · 피니쉬 · 처치 · 궁극기. speed = 화면 배속, live = 연출 중(결과로 건너뛰기 · 시뮬레이션이면 false),
 *  bad = 플레이어에게 나쁜 사건 (적의 치명타 · 피니쉬, 아군이 쓰러짐 → 처치 대신 낮고 작은 down)
 *  - 8배속 · 건너뛰기 · 정지: 소리 없음 / 4배속 이상: 처치 · 궁극기만 / 적의 치명타 · 피니쉬는 내지 않는다
 *  - 치명타 · 피니쉬는 1초에 4번까지, 전투 소리 전체는 1초에 8번까지 */
export function battle(kind: 'crit' | 'finish' | 'kill' | 'ult', speed: number, live: boolean, bad = false) {
  if (!HAS || !live || !(speed > 0) || speed >= 8) return;
  const name = kind === 'kill' && bad ? 'down' : kind;
  const minor = kind === 'crit' || kind === 'finish';
  if (minor && (bad || speed >= 4)) { note(name, false, 'battle', bad ? 'foe' : 'speed'); return; }
  const now = performance.now();
  bwin = bwin.filter((x) => now - x < 1000);
  mwin = mwin.filter((x) => now - x < 1000);
  if (bwin.length >= 8 || (minor && mwin.length >= 4)) { note(name, false, 'battle', 'rate'); return; }
  if (play(name, {}, 'battle', 0.05)) { bwin.push(now); if (minor) mwin.push(now); }
}

// 같은 입력(클릭 · 끌어 놓기) 안에서: 따로 소리를 낸 동작이 없으면 동작에 맞는 기본음, 오류 알림이 떴으면 오류음, 등급이 올랐으면 등급 상승음
let gest: { claimed: boolean; err: boolean; rank: Record<string, number> } | null = null;
const ACT: Record<string, string> = {};
for (const [s, as] of Object.entries({
  buy: 'buy buy-news buy-invest buyxp pil-card pil-relic fleet loan muster-open',
  sell: 'sell release-confirm',
  reroll: 'reroll reroll-recruit reroll-global reroll-privilege',
  confirm: 'pick-aug pick-global pick-privilege pick-item pick-recruit pick-blessing supply-done alloc-ok muster-ok pick-branch pick-fork start-run diff-ok enter victory-end victory-endless relic-equip relic-enh event-choice',
  place: 'drop autofill',
  '': 'bdesel syn-peek item-info fight pick-supply supply-all ct-job ct-plan ct-rider ct-usual ct-bell ct-sign ct-back-board ct-skip', // 소리 없음 (전투 시작은 개시 연출에서 · 보급 뒤집기는 공개음 reveal)
})) for (const a of as.split(' ')) ACT[a] = s;
/** UI 동작 직전에 부른다 (data-a 이름). 동작이 끝난 뒤(마이크로태스크) 결과에 맞는 소리를 낸다 */
export function uiAct(a: string) {
  if (!HAS) return;
  const g = { claimed: false, err: false, rank: ranks() };
  gest = g;
  queueMicrotask(() => {
    if (gest === g) gest = null;
    if (g.err) { play('error', {}, 'ui', 0.02); return; }
    const r = ranks();
    if (Object.keys(g.rank).some((k) => (r[k] ?? 0) > g.rank[k])) { play('rankUp', {}, 'ui', 0.02); return; }
    const s = ACT[a] ?? 'click';
    if (!g.claimed && s) play(s, {}, 'ui', 0.02);
  });
}
/** 알림(토스트) 문구: 입력 중에 뜬 오류 문구면 그 입력의 소리를 오류음으로 바꾼다 */
export function toastSfx(msg: string) {
  if (gest && /수 없|부족|가득|없습니다|없음|이미 |먼저|아닙니다|고르세요|칸입니다|소모품입니다/.test(msg) && !/했습니다|완료|실행|장착:|확장/.test(msg)) gest.err = true;
}

/** 증강 · 보상 카드가 처음 펼쳐질 때 (같은 카드 묶음은 한 번). 등급: 1 일반 · 2 희귀 · 3 최상
 *  증강 = 카드 중 가장 높은 revealfx.augGrade (★ 전설 전공 증강 3, ◆ 변형 2, 학파 선택 2, 그 밖에는 달성 등급 12+ → 3 · 8+ → 2, 전공 증강은 2까지)
 *  (마이너 능력치 대성공은 main.ts 가 확정 때 reveal3 을 직접 낸다) / 장비 = 전설 · 전설급 소모품 3 · 희귀 2 / 전역 · 특권 2 / 영입 · 축복 1 */
let revealKey = '';
export function reveal(p: Pending | undefined) {
  if (!HAS || !p) return;
  if (p.t === 'despair') { const k = `despair:${p.options.join()}`; if (k !== revealKey) { revealKey = k; play('despair', { delay: 0.35 }, 'ui', 0.01); } return; } // 절망 증강: 등급 공개음 대신 낮은 음 하나
  let key = '', g = 1;
  if (p.t === 'rankup' && p.allocDone && p.options?.length) {
    key = `ru:${p.uid}:${p.rank}:${p.options.map((x) => x.id).join()}`;
    g = Math.max(...p.options.map((x) => augGrade(p, x.id)));
  } else if (p.t === 'global' || p.t === 'privilege') { key = `${p.t}:${p.options.map((x) => (typeof x === 'string' ? x : x.id)).join()}`; g = 2; }
  else if (p.t === 'itemPick') { key = `it:${p.options.join()}`; g = Math.max(...p.options.map(revealGrade)); } // 전설 장비 · 전설급 소모품 3, 희귀 2
  else if (p.t === 'recruit' || p.t === 'blessing') { key = `${p.t}:${p.options.join()}`; g = 1; }
  else if (p.t === 'supply') { // 보급: 카드를 뒤집을 때마다, 이번에 뒤집힌 카드 중 가장 높은 등급 (대박 ×2 이상 3 · 대박 · 희귀 장비 2)
    const sig = supplySig(p), open = p.options.map((c, i) => (c.open ? i : -1)).filter((i) => i >= 0);
    const before = revealKey.startsWith(`sup:${sig}:`) ? revealKey.slice(sig.length + 5).split(',').filter(Boolean).map(Number) : [];
    const now = open.filter((i) => !before.includes(i));
    if (!now.length) return;
    key = `sup:${sig}:${open.join(',')}`; g = Math.max(...now.map((i) => supplyGrade(p.options[i])));
    // 공개음은 가장 높은 등급 카드의 앞면이 드러날 때 (revealfx 공개 대기 · 뒤집기 시간)
    const cs = now.map((i) => p.options[i]), k = cs.findIndex((c) => supplyGrade(c) === g);
    if (key !== revealKey) { revealKey = key; play(`reveal${g}`, { delay: supplyFaceAt(cs, k) / 1000 }, 'ui', 0.01); }
    return;
  }
  if (!key || key === revealKey) return;
  revealKey = key;
  play(`reveal${g}`, { delay: 0.12 }, 'ui', 0.01);
}

/** 설정 화면 '소리' 항목 (입력은 아래 리스너가 직접 받는다) */
export function prefHtml() {
  const v = vol, mu = mute;
  return `<h3>소리</h3>
      <div class="pref"><span><b>효과음</b><br><span class="muted small">버튼 · 상점 · 증강 · 전투 · 사건 장면의 합성음. 4배속 이상에서는 큰 사건만, 8배속 · 결과로 건너뛰기에서는 울리지 않습니다.</span></span>
        <span class="seg"><input type="range" min="0" max="100" step="5" value="${v}" data-snd="vol" aria-label="효과음 음량" style="width:110px;height:auto;margin:0"><b class="mono small" data-snd-out style="min-width:2.2em;text-align:right">${v}</b><button class="btn tiny${mu ? ' on' : ''}" data-snd="mute" aria-pressed="${mu}">음소거</button></span></div>`;
}
if (HAS) {
  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset?.snd !== 'vol') return;
    const out = el.parentElement?.querySelector('[data-snd-out]');
    if (out) out.textContent = el.value;
    vol = +el.value; save('sndVol', vol); applyVol();
  });
  document.addEventListener('change', (e) => { if ((e.target as HTMLElement).dataset?.snd === 'vol') { unlock(); sfx('confirm'); } });
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-snd="mute"]');
    if (!b) return;
    const mu = (mute = !mute);
    save('sndMute', mu); applyVol();
    b.classList.toggle('on', mu); b.setAttribute('aria-pressed', String(mu));
    if (!mu) { unlock(); sfx('click'); }
  });
}

if (DEBUG) {
  (window as unknown as { __sfx: unknown }).__sfx = {
    log: LOG, names: Object.keys(R), scene: SCENE,
    /** 오프라인 렌더용: 마스터 체인 · 소리 예약 (Playwright 에서 OfflineAudioContext 로 WAV 를 뽑는다) */
    master, schedule: (c: BaseAudioContext, out: AudioNode, name: string, t0: number, o?: SfxOpts, s = 1) => { seed = s; return schedule(c, out, name, t0, o); },
    sceneOf: (key: string) => SCENE[key] || [key],
  };
}
