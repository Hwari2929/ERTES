// 테마 연출 (설정 → 테마 연출: 켜기 · 줄이기 · 끄기). 외부 이미지 없이 canvas · CSS 로만 그린다.
//   · 갤럭시: 화면 뒤(본문 아래) 별빛 층 — 천천히 흐르는 별 3층 · 반짝임 · 가끔 유성
//   · 호이슌: 화면 앞 벚꽃잎 — 흩날리는 꽃잎 · 1~2분마다 벚꽃 폭풍 · 누른 자리에서 흩날림 (꽃잎 상한 80)
//   · 이타카: 큰 화면 전환에 바다가 차올라 덮었다가 내려가며 다음 화면이 드러난다 (seatrans.ts, 줄이기는 물결 한 번 쓸기 · 런 시작 룰렛 · 특권 선택은 CSS 쪽)
//   · 빈티지: CSS 만 (가죽 결 · 스티치, style.css [data-ui-theme="vintage"][data-tfx])
// 움직임은 모두 Web Animations 의 transform · opacity 라 합성기에서 돌고 메인 스레드는 거의 쓰지 않는다
// (별 타일은 시작할 때 canvas 로 한 번만 그린다). 모든 층은 pointer-events: none 이라 입력을 막지 않는다.
// 움직임 줄이기 설정이면 정지 화면. 전투 중에는 별빛 층을 내리고, 꽃잎은 절반으로 줄인다 (onScreen).

import { seaTransition, type SeaHandle } from './seatrans';

export type FxLevel = 'on' | 'low' | 'off';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Layer { start(): void; stop(): void; setBusy(b: boolean): void }

let cur: { theme: string; level: FxLevel; layer: Layer | null } = { theme: '', level: 'off', layer: null };
let busy = false; // 전투 중

/** 테마 · 연출 단계가 바뀔 때 (applyTheme) */
export function setThemeFx(theme: string, level: FxLevel) {
  if (cur.theme === theme && cur.level === level) return;
  cur.layer?.stop();
  cur = { theme, level, layer: null };
  if (level === 'off') return;
  if (theme === 'galaxy') cur.layer = starLayer(level);
  else if (theme === 'hoishun') cur.layer = petalLayer(level);
  cur.layer?.setBusy(busy);
  cur.layer?.start();
}

const BIG = new Set(['title', 'diffsel', 'newrun', 'map', 'prep', 'shop', 'news', 'invest', 'over', 'codex']);
// 전투 진입은 '전투 개시' 배너, 출격 연출 · 바는 그림 연출이 따로 있으므로 큰 화면끼리만
const bigMove = (prev: string, next: string) => cur.theme === 'ithaca' && cur.level !== 'off' && !!prev && prev !== next && BIG.has(next) && BIG.has(prev);
let sea: { h: SeaHandle; ghost: HTMLElement | null; fresh: boolean } | null = null;
/** render() 가 화면을 바꾸기 직전 (이타카 켜기): 지금 화면을 얼려 둔 사본 위로 바다가 차오르고, 다 덮으면 사본을 걷는다.
 *  render 는 그대로 바로 새 화면을 그리므로 게임 흐름은 기다리지 않는다 (바다가 덮는 동안 입력만 막힌다) */
export function beforeScreen(prev: string, next: string, app: HTMLElement) {
  if (!bigMove(prev, next) || cur.level !== 'on' || reduced()) return;
  endSea();
  const ghost = document.createElement('div');
  ghost.className = 'tfx-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  const copy = app.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  copy.className = 'tfx-ghost-in';
  copy.style.top = `${-scrollY}px`;
  ghost.appendChild(copy);
  const from = app.querySelectorAll('*'), to = copy.querySelectorAll('*');
  document.body.appendChild(ghost);
  from.forEach((el, k) => { if (el.scrollTop || el.scrollLeft) { to[k].scrollTop = el.scrollTop; to[k].scrollLeft = el.scrollLeft; } }); // 스크롤된 목록도 그 자리 그대로
  const h = seaTransition();
  sea = { h, ghost, fresh: true };
  const mine = sea;
  void h.covered.then(() => { mine.ghost?.remove(); mine.ghost = null; });
  void h.done.then(() => { if (sea === mine) sea = null; });
}
function endSea() { if (!sea) return; sea.h.destroy(); sea.ghost?.remove(); sea = null; }
/** render() 가 화면을 그린 뒤: 전투 여부 · (이타카) 큰 화면 전환 물결 */
export function onScreen(prev: string, next: string) {
  const b = next === 'battle';
  if (b !== busy) { busy = b; cur.layer?.setBusy(b); }
  if (sea?.fresh) {
    sea.fresh = false;
    // 사건 장면은 그림 연출이, 특권 선택은 자체 물결 막이 있다 → 바다는 그리기 전에 거둔다
    if (document.querySelector('.adv, .pv-bg:not(.played)')) { endSea(); return; }
    // 로딩 = 새 화면의 그림이 다 받아질 때까지 (최대 4초)
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#app img')).filter((im) => !im.complete);
    const h = sea.h;
    void Promise.race([Promise.all(imgs.map((im) => new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }))), new Promise((r) => setTimeout(r, 4000))]).then(() => h.ready());
    return;
  }
  if (!bigMove(prev, next)) return;
  if (document.querySelector('.adv, .pv-bg:not(.played)')) return;
  wash(cur.level === 'low' || reduced());
}

// ───────────────────────── 공통
function layerEl(cls: string) {
  const el = document.createElement('div');
  el.className = `tfx-cv ${cls}`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}
/** 무작위 간격으로 되풀이 (탭이 숨어 있으면 그 회차는 건너뛴다). 멈추는 함수를 돌려준다 */
function every(min: number, max: number, fn: () => void) {
  let t = 0;
  const go = () => { t = window.setTimeout(() => { if (!document.hidden) fn(); go(); }, rnd(min, max) * 1000); };
  go();
  return () => clearTimeout(t);
}

// ───────────────────────── 갤럭시: 별빛 층 (본문 뒤)
// 층마다 별을 흩뿌린 타일 한 장을 깔고, 타일 한 칸만큼 오른쪽 아래로 끝없이 흘린다 (이음매 없이 되풀이).
// 층(합성 레이어)이 많을수록 화면 합성이 무거워지므로 먼 별 · 가까운 별 · 반짝이는 별 3층만 둔다
// [타일 폭, 높이, [크기 단계별 별 수], 흐름 속도 px/s, 반짝임 주기 ms]
const STAR_TILES: [number, number, number[], number, number][] = [[512, 256, [9, 4, 0], 3, 0], [640, 320, [0, 0, 3], 7, 0], [700, 460, [0, 8, 0], 4, 3000]];
function starTile(w: number, h: number, ns: number[], glint: boolean) {
  const k = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d')!;
  x.scale(k, k);
  ns.forEach((n, z) => { for (let i = 0; i < n; i++) {
    const px = rnd(0, w), py = rnd(0, h), r = (glint ? 1.3 : [0.5, 0.8, 1.15][z]) * rnd(0.8, 1.2);
    x.globalAlpha = (glint ? 0.6 : [0.22, 0.32, 0.42][z]) * rnd(0.7, 1.1);
    x.fillStyle = z === 2 || glint ? '#fff4dc' : '#dfe8ff';
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { x.beginPath(); x.arc(px + dx, py + dy, r, 0, 6.283); x.fill(); } // 가장자리 별도 이어지게
  } });
  return c.toDataURL();
}
function starLayer(level: FxLevel): Layer {
  const el = layerEl('tfx-stars');
  const anims: Animation[] = [];
  let isBusy = false, stopMeteor = () => {};
  const still = reduced();
  const drift = (w: number, h: number, ns: number[], speed: number, twinkle: number) => {
    const i = document.createElement('i');
    i.style.cssText = `left:${-w}px;top:${-h}px;width:calc(100% + ${w}px);height:calc(100% + ${h}px);background:url(${starTile(w, h, ns, twinkle > 0)}) 0 0/${w}px ${h}px`;
    el.appendChild(i);
    if (still) return;
    anims.push(i.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${w}px, ${h}px)` }], { duration: (w / speed) * 1000, iterations: Infinity }));
    // 반짝임: 밝은 별 몇 개만 따로 깔고 그 층의 투명도를 천천히 오르내린다
    if (twinkle) anims.push(i.animate([{ opacity: 0.1 }, { opacity: 1 }], { duration: twinkle, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
  };
  const scale = level === 'low' ? 0.55 : 1;
  // 유성: 켜기에서만, 무작위 간격 (전투 중엔 쉰다)
  const met = document.createElement('b');
  const shoot = () => {
    if (isBusy) return;
    const a = rnd(0.35, 0.6), d = rnd(400, 700), x = rnd(innerWidth * 0.1, innerWidth * 0.8), y = rnd(-20, innerHeight * 0.25);
    const tf = (s: number) => `translate(${x}px, ${y}px) rotate(${a}rad) translateX(${s}px)`;
    met.animate([{ transform: tf(0), opacity: 0 }, { opacity: 0.55, offset: 0.15 }, { transform: tf(d), opacity: 0 }], { duration: rnd(700, 1100) });
  };
  return {
    start() {
      for (const [w, h, ns, v, tw] of STAR_TILES) drift(w, h, ns.map((n) => Math.round(n * scale)), v, tw);
      el.appendChild(met);
      document.body.appendChild(el);
      this.setBusy(isBusy);
      if (level === 'on' && !still) {
        const first = window.setTimeout(shoot, rnd(8, 20) * 1000), st = every(10, 26, shoot);
        stopMeteor = () => { clearTimeout(first); st(); };
      }
    },
    stop() { stopMeteor(); anims.forEach((x) => x.cancel()); el.remove(); },
    // 전투 중엔 별빛 층을 내린다: 보드 · 패널 밑에 거의 가려지고, 화면 합성 부담도 없앤다
    setBusy(b) { isBusy = b; el.hidden = b; anims.forEach((x) => (b ? x.pause() : x.play())); },
  };
}

// ───────────────────────── 호이슌: 벚꽃잎 (화면 앞, 창보다는 아래)
// 한 장 한 장이 진짜 꽃잎처럼: 천천히(꽃잎마다 다른 속도) 떨어지며 진자처럼 좌우로 살랑이고(흔들리는 쪽으로 기울고,
// 가운데서 빨라지고 끝에서 느려진다), 3D 로 뒤집히며 앞면(진한 분홍) · 뒷면(옅은 분홍)이 번갈아 보인다.
// 깊이 z(0 먼 ~ 1 가까운)에 따라 멀수록 작고 느리고 흐리다. 움직임은 꽃잎마다 미리 계산한 자세들을 잇는 Web Animations (합성기)
const PETAL_CAP = 80;
const PETAL_C = ['#ffc3d9', '#ff9ec4', '#ffd6e6'];
type Flight = { x: number; y: number; z: number; vy: number; amp: number; per: number; ph: number; drift: number; spin: number; ax: number; ay: number; r0: number };
const flight = (x: number, y: number, z: number): Flight => ({
  x, y, z, vy: (9 + 17 * z) * rnd(0.8, 1.2), amp: (12 + 26 * z) * rnd(0.7, 1.2), per: rnd(3.2, 6.2), ph: rnd(0, 6.28), drift: rnd(3, 12),
  spin: rnd(30, 150) * (Math.random() < 0.5 ? -1 : 1), ax: rnd(0.2, 1), ay: rnd(0.2, 1), r0: rnd(0, 360),
});
/** 시각 t(초)의 자세. wx · wy 는 바람 · 튀어 오름으로 더해지는 이동 */
const pose = (f: Flight, t: number, wx = 0, wy = 0, spinMul = 1) => {
  const w = (2 * Math.PI) / f.per, a = w * t + f.ph;
  const x = f.x + f.drift * t + wx + f.amp * Math.sin(a);
  const y = f.y + f.vy * t + wy + ((f.vy * 0.28) / w) * Math.sin(2 * a); // 낙하 속도 = vy(1 + 0.56cos2a): 흔들림 가운데서 빠르고 끝에서 느리다
  const rz = f.r0 + 32 * Math.cos(a); // 흔들리는 쪽으로 기운다
  const th = f.spin * spinMul * t + 50 * Math.sin(2 * a); // 뒤집힘 (천천히 돌며 팔랑인다)
  return `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rz.toFixed(0)}deg) rotate3d(${f.ax.toFixed(2)}, ${f.ay.toFixed(2)}, 0.3, ${th.toFixed(0)}deg)`;
};
const STEP = 0.4; // 자세 간격 (초): 사이는 선형으로 잇는다
function petalLayer(level: FxLevel): Layer {
  const el = layerEl('tfx-petals');
  let isBusy = false, stopStorm = () => {}, rz = 0;
  const still = reduced();
  const count = () => el.childElementCount;
  const mark = () => { el.dataset.n = String(count()); }; // 측정용: 지금 떠 있는 꽃잎 수
  const base = () => Math.round((level === 'low' ? 12 : 30) * (isBusy ? 0.35 : 1)); // 전투 중엔 3분의 1
  /** 꽃잎 하나 (요소 하나 = 합성 레이어 하나, 앞뒷면은 ::before · ::after) */
  const petal = (z: number, cls = '') => {
    const o = document.createElement('b'), t = Math.random();
    if (cls) o.className = cls;
    o.style.cssText = `--s:${(4 + 6 * z).toFixed(1)}px;--c:${PETAL_C[t < 0.5 ? 0 : t < 0.8 ? 1 : 2]};--a:${(0.4 + 0.45 * z).toFixed(2)}`;
    el.appendChild(o);
    return o;
  };
  /** 자세들을 이어 한 번(또는 끝없이) 날린다 */
  const fly = (o: HTMLElement, dur: number, at: (t: number) => string, opt: KeyframeAnimationOptions, fade = 0) => {
    const K = Math.max(2, Math.ceil(dur / STEP));
    // 사라질 때는 투명도 대신 작아지며 멀어진다 (투명도를 움직이면 3D 앞뒷면이 납작해진다)
    return o.animate(Array.from({ length: K + 1 }, (_, k) => { const t = (k / K) * dur; return { transform: fade ? `${at(t)} scale(${Math.min(1, (dur - t) / (dur * fade)).toFixed(2)})` : at(t) }; }),
      { duration: dur * 1000, easing: 'linear', ...opt });
  };
  // 평소 꽃잎: 위에서 아래로, 끝나면 처음부터 되풀이 (시작 지점은 제각각). 먼 꽃잎부터 깔아 가까운 꽃잎이 앞에 온다
  const ambient = (z: number) => {
    const o = petal(z, 'amb'), W = innerWidth, H = innerHeight;
    const f = flight(rnd(-40, W), -30, z), dur = (H + 60) / f.vy;
    if (still) { o.style.transform = pose(f, rnd(0, dur)); return; }
    fly(o, dur, (t) => pose(f, t), { iterations: Infinity, iterationStart: Math.random() });
  };
  const fillAmbient = () => {
    const a = el.querySelectorAll('.amb');
    for (let k = a.length - 1; k >= base(); k--) a[k].remove();
    const add = Array.from({ length: Math.max(0, base() - a.length) }, () => Math.random()).sort();
    for (const z of add) ambient(z);
    mark();
  };
  /** 한 번 날아가고 사라지는 꽃잎 (폭풍 · 누른 자리). 상한을 넘으면 만들지 않는다 */
  const once = (z: number, dur: number, at: (f: Flight, t: number) => string, x: number, y: number) => {
    if (count() >= PETAL_CAP) return;
    const o = petal(z), f = flight(x, y, z);
    fly(o, dur, (t) => at(f, t), {}, 0.3).onfinish = () => { o.remove(); mark(); };
  };
  // 누른 자리에서 흩날림: 살짝 튀어 올랐다가 감속하며 흩어지고, 이내 살랑이며 내려앉는다 (클릭은 그대로 통과)
  const burst = (cx: number, cy: number) => {
    const vx = rnd(-130, 130), vy = rnd(60, 150), tau = rnd(0.35, 0.6);
    once(rnd(0.55, 1), rnd(2.6, 3.4), (f, t) => { const e = tau * (1 - Math.exp(-t / tau)); return pose({ ...f, amp: f.amp * Math.min(1, t / 1.2) }, t, vx * e, -vy * e); }, cx + rnd(-6, 6), cy + rnd(-6, 6));
  };
  const indoor = () => !!document.querySelector('.bar, .adv'); // 바(실내) · 사건 장면: 꽃잎 층을 내리므로 터짐 · 폭풍도 쉰다
  const onDown = (e: PointerEvent) => {
    if (indoor()) return;
    const n = Math.min(level === 'low' ? 5 : 10, PETAL_CAP - count());
    for (let k = 0; k < n; k++) burst(e.clientX, e.clientY);
    mark();
  };
  // 벚꽃 폭풍: 켜기에서 무작위 1~2분마다. 바람이 일었다가 잦아들며 꽃잎을 비스듬히 실어 나른다 (전투 중엔 약하게)
  const storm = () => {
    if (indoor()) return;
    const W = innerWidth, H = innerHeight, extra = isBusy ? 20 : 45;
    el.animate([{ transform: 'none' }, { transform: 'translateX(60px)', offset: 0.35 }, { transform: 'none' }], { duration: 5000, easing: 'ease-in-out' });
    let k = 0;
    const tick = window.setInterval(() => {
      if (++k > 30) { clearInterval(tick); return; }
      for (let j = 0; j < 2 && count() < Math.min(PETAL_CAP, base() + extra); j++) {
        const wmax = rnd(220, 340), tr = rnd(0.6, 1), tau = rnd(1.2, 2); // 바람: tr 초 동안 일었다가 tau 로 잦아든다
        const gust = (t: number) => wmax * (t < tr ? (t * t) / (2 * tr) : tr / 2 + tau * (1 - Math.exp(-(t - tr) / tau)));
        once(rnd(0.3, 1), rnd(4.5, 6.5), (f, t) => pose(f, t, gust(t), 0, 1.8), rnd(-W * 0.35, W * 0.35), rnd(-60, H * 0.55));
      }
      mark();
    }, 110);
  };
  const onResize = () => { clearTimeout(rz); rz = window.setTimeout(() => { el.querySelectorAll('.amb').forEach((x) => x.remove()); fillAmbient(); }, 300); };
  return {
    start() {
      document.body.appendChild(el);
      fillAmbient();
      if (still) return; // 정지 화면
      addEventListener('resize', onResize);
      addEventListener('pointerdown', onDown, { capture: true, passive: true });
      if (level === 'on') stopStorm = every(60, 120, storm);
    },
    stop() { stopStorm(); clearTimeout(rz); removeEventListener('resize', onResize); removeEventListener('pointerdown', onDown, { capture: true }); el.remove(); },
    setBusy(b) { if (b === isBusy) return; isBusy = b; if (el.isConnected) fillAmbient(); },
  };
}

// ───────────────────────── 이타카: 큰 화면 전환 물결 (다음 화면 위를 물이 덮었다가 쓸려 나가며 드러낸다)
function wash(light: boolean) {
  document.querySelector('.tfx-wash')?.remove();
  const el = document.createElement('div');
  el.className = `tfx-wash${light ? ' fade' : ''}`;
  el.setAttribute('aria-hidden', 'true');
  if (!light) el.innerHTML = '<i class="tfx-foam"></i>';
  document.body.appendChild(el);
  el.addEventListener('animationend', (e) => { if (e.target === el) el.remove(); });
  setTimeout(() => el.remove(), 1600);
}
