// 테마 연출 (설정 → 테마 연출: 켜기 · 줄이기 · 끄기). 외부 이미지 없이 canvas · CSS 로만 그린다.
//   · 갤럭시: 화면 뒤(본문 아래) 별빛 층 — 천천히 흐르는 별 3층 · 반짝임 · 가끔 유성
//   · 메트로 인피니티 패스: 화면 뒤 '창밖 별빛' — 달리는 열차 창밖처럼 별이 오른쪽에서 왼쪽으로 흐르는 3층 · 가끔 지나가는 빛 열차.
//     런 출발 · 보스 · 상점에 들어갈 때만 열차가 들어와 화면을 덮고, 다음 역 안내판(새 화면의 그림이 다 받아질 때까지 · 받은 그림 수 = 역 점)을 보인 뒤 떠나며 다음 화면을 드러낸다.
//     전투 진입은 속도선 · 도형 · 별빛 꼬리가 띠 안을 질주하고 탑승권이 미끄러져 들어와 펀치된다 (banner).
// 움직임은 모두 Web Animations 의 transform · opacity 라 합성기에서 돌고 메인 스레드는 거의 쓰지 않는다
// (별 타일은 시작할 때 canvas 로 한 번만 그린다). 배경 층은 pointer-events: none 이라 입력을 막지 않는다 (열차가 덮는 동안만 막는다).
// 움직임 줄이기 설정이면 정지 화면 · 기본 배너. 전투 중에는 배경 층을 내린다 (onScreen).

export type FxLevel = 'on' | 'low' | 'off';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

interface Layer { start(): void; stop(): void; setBusy(b: boolean): void }

let cur: { theme: string; level: FxLevel; layer: Layer | null } = { theme: '', level: 'off', layer: null };
let busy = false; // 전투 중

/** 테마 · 연출 단계가 바뀔 때 (applyTheme) */
export function setThemeFx(theme: string, level: FxLevel) {
  if (cur.theme === theme && cur.level === level) return;
  cur.layer?.stop();
  endRide();
  cur = { theme, level, layer: null };
  if (level === 'off') return;
  if (theme === 'galaxy') cur.layer = starLayer(level);
  else if (theme === 'metro') cur.layer = metroLayer(level);
  cur.layer?.setBusy(busy);
  cur.layer?.start();
}
const metroOn = () => cur.theme === 'metro' && cur.level !== 'off';

// ───────────────────────── 메트로: 큰 화면 전환 (열차 · 다음 역 안내판)
// 인게임 화면끼리만 (바 · 계약 · 타이틀 · 도감은 제외). 명부 → 지도 = 런 출발. 전투 진입은 banner 가 맡는다
/** 열차가 서는 정거장: 런 출발(명부 → 지도) · 보스 노드 진입 · 상점 진입만 (main.ts render 의 mtStop 이 정한다, 나머지 전환은 그대로 컷).
 *  안내판: 머리표(영문 대문자 모노) · 역 이름(그 순간의 대상: 전장 · 보스 이름 · 상점) · 영문 부제 */
export interface Stop { kick: string; name: string; en: string; tone?: 'boss' }
let lastStop: Stop | null = null;
/** 열차 시간 (ms): 들어옴 · 안내판을 읽을 최소 시간 · 떠남 · 그림을 기다리는 최대 시간 */
const RIDE = { in: 300, hold: 170, out: 360, cap: 4000 };
let ride: { el: HTMLElement; ghost: HTMLElement | null; fresh: boolean; covered: Promise<void>; anims: Animation[]; gone: boolean } | null = null;

/** 지금 화면을 얼려 둔 사본 (열차가 다 덮으면 걷는다) */
function freeze(app: HTMLElement) {
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
  for (const a of ghost.getAnimations({ subtree: true })) { try { a.finish(); } catch { a.pause(); } } // 사본에서 등장 애니메이션이 다시 돌지 않게
  return ghost;
}
/** render() 가 화면을 바꾸기 직전 (메트로 켜기): 지금 화면을 얼려 두고 그 위로 열차가 들어온다.
 *  render 는 그대로 바로 새 화면을 그리므로 게임 흐름은 기다리지 않는다 (열차가 덮는 동안 입력만 막힌다) */
export function beforeScreen(prev: string, next: string, app: HTMLElement, stop: Stop | null = null) {
  lastStop = metroOn() && prev && prev !== next ? stop : null;
  if (!lastStop || cur.level !== 'on' || reduced()) return;
  endRide();
  const ghost = freeze(app);
  const el = document.createElement('div');
  el.className = `mt-ride${lastStop.tone ? ` ${lastStop.tone}` : ''}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="mt-car"><i class="mt-car-win"></i><i class="mt-car-lv"></i><span class="mt-car-id">ERRANTES METRO · INFINITY PASS</span>
    <div class="mt-board"><span class="mt-bd-k"><i class="mt-bd-line">∞</i><span>${esc(lastStop.kick)}</span></span>
      <b class="mt-bd-name">${esc(lastStop.name)}</b><span class="mt-bd-en">${esc(lastStop.en)}</span><span class="mt-bd-stops"></span></div></div>`;
  document.body.appendChild(el);
  const car = el.firstElementChild as HTMLElement;
  const a = car.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: RIDE.in, easing: 'cubic-bezier(.2, .75, .25, 1)', fill: 'both' });
  const r = { el, ghost: ghost as HTMLElement | null, fresh: true, covered: a.finished.then(() => {}, () => {}), anims: [a], gone: false };
  ride = r;
  void r.covered.then(() => { r.ghost?.remove(); r.ghost = null; });
}
/** 새 화면의 그림이 다 받아지면(최대 4초) 열차가 떠난다. 역 점 = 기다리는 그림 하나씩 (받으면 채워진다) */
function rideTrack(r: NonNullable<typeof ride>) {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#app img')).filter((im) => !im.complete).slice(0, 12);
  const stops = r.el.querySelector<HTMLElement>('.mt-bd-stops')!;
  stops.innerHTML = imgs.map(() => '<i></i>').join('');
  stops.hidden = !imgs.length;
  let n = 0;
  const loads = imgs.map((im) => new Promise<void>((res) => {
    const done = () => { stops.children[n++]?.classList.add('on'); res(); };
    im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true });
  }));
  const minHold = r.covered.then(() => new Promise((res) => setTimeout(res, RIDE.hold)));
  void Promise.race([Promise.all([Promise.all(loads), minHold]), new Promise((res) => setTimeout(res, RIDE.cap))]).then(() => rideLeave(r));
}
function rideLeave(r: NonNullable<typeof ride>) {
  if (r.gone) return;
  r.gone = true;
  r.el.classList.add('open'); // 떠나기 시작하면 누름은 아래 화면으로
  const car = r.el.firstElementChild as HTMLElement;
  const a = car.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-104%)' }], { duration: RIDE.out, easing: 'cubic-bezier(.55, 0, .8, .35)', fill: 'both' });
  r.anims.push(a);
  void a.finished.then(() => { r.el.remove(); if (ride === r) ride = null; }, () => {});
}
function endRide() { if (!ride) return; ride.anims.forEach((x) => x.cancel()); ride.el.remove(); ride.ghost?.remove(); ride = null; }

/** render() 가 화면을 그린 뒤: 전투 여부 · (메트로) 큰 화면 전환 */
export function onScreen(prev: string, next: string) {
  const b = next === 'battle';
  if (b !== busy) { busy = b; cur.layer?.setBusy(b); }
  if (ride?.fresh) {
    ride.fresh = false;
    // 사건 장면 · 역경 선택은 제 막 연출이 있다 → 열차는 그리기 전에 거둔다.
    // 런 출발의 특권 막(메트로 = 닫히는 열차 문)은 그대로 둔다: 열차가 떠나면 문이 닫힌 승강장에서 카드가 놓인다
    if (document.querySelector('.adv, .dp-bg:not(.played)')) { endRide(); return; }
    rideTrack(ride);
    return;
  }
  const st = lastStop;
  lastStop = null;
  if (!st || !metroOn() || reduced() || cur.level !== 'low') return;
  if (document.querySelector('.adv, .dp-bg:not(.played)')) return;
  sweep();
}
/** 줄이기: 노선색 띠 세 줄이 새 화면 위를 한 번 쓸고 지나간다 (덮지 않는다) */
function sweep() {
  document.querySelector('.mt-sweep')?.remove();
  const el = document.createElement('div');
  el.className = 'mt-sweep';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><i></i><i></i>';
  document.body.appendChild(el);
  Array.from(el.children).forEach((c, k) => (c as HTMLElement).animate([{ transform: 'translateX(110vw) skewX(-24deg)' }, { transform: 'translateX(-60vw) skewX(-24deg)' }], { duration: 420, delay: k * 50, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'both' }));
  setTimeout(() => el.remove(), 620);
}

// ───────────────────────── 메트로: 전투 진입 (main.ts banner 대신)
// 띠 = 비스듬한 잉크 띠 (켜질 때 위아래로 열리고 끝에 닫힌다). 띠 안: 속도선(노선색 · 길이 · 속도 제각각) · 도형(고리 · 마름모 · 원 · 갈매기표 · 반짝이)이 오른쪽에서 왼쪽으로 질주,
// 바닥에 선로가 흐른다. 가운데 탑승권이 앞으로 기울어 미끄러져 들어와 멈추고 펀치 → 다시 기울어 왼쪽으로 빠진다. 줄이기: 속도선 몇 줄 · 도형 없음
type BannerKind = 'battle' | 'boss' | 'phase' | 'adversity';
const KICK: Record<BannerKind, string> = { battle: 'DEPARTURE', adversity: 'RAPID', boss: 'EXPRESS · NO STOP', phase: 'LINE CHANGE' };
const SHAPES = ['ring', 'dia', 'disc', 'chev', 'spk'] as const;
/** 전투 개시 · 보스 · 역경 · 페이즈 연출. 메트로 테마(연출 켜기 · 줄이기)가 맡았으면 true (아니면 기본 배너) */
export function banner(kind: BannerKind, title: string, sub = ''): boolean {
  if (!metroOn() || reduced()) return false;
  document.querySelector('.mt-go')?.remove();
  const low = cur.level === 'low';
  const T = kind === 'boss' ? 2200 : 1700;
  const el = document.createElement('div');
  el.className = `mt-go mt-go-${kind}${low ? ' low' : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="mt-go-band"><div class="mt-go-fx"></div><i class="mt-go-rail"></i></div>
    <div class="mt-go-tk"><span class="mt-go-k"><b>ADMIT ONE</b><i></i><span>${KICK[kind]}</span></span><b class="mt-go-t">${esc(title)}</b>${sub ? `<span class="mt-go-r"><span>TO</span><b>${esc(sub)}</b><i></i></span>` : ''}<span class="mt-go-code"></span><i class="mt-go-punch"></i></div>`;
  document.body.appendChild(el);
  const band = el.querySelector<HTMLElement>('.mt-go-band')!, fx = el.querySelector<HTMLElement>('.mt-go-fx')!, tk = el.querySelector<HTMLElement>('.mt-go-tk')!;
  const o = (ms: number) => ms / T; // 시간(ms) → 키프레임 위치
  const tilt = kind === 'boss' ? 'rotate(-5deg)' : 'rotate(-3deg)'; // 띠는 비스듬히 (달리는 쪽이 살짝 내려간다)
  // 구간마다 easing (전체 easing 은 시간축 자체를 휘게 해 들어오고 나가는 때가 어긋난다)
  const IN = 'cubic-bezier(.2, .8, .3, 1)', OUT = 'cubic-bezier(.6, 0, .9, .4)';
  band.animate([{ transform: `${tilt} scaleY(0)`, easing: IN }, { transform: `${tilt} scaleY(1)`, offset: o(200) }, { transform: `${tilt} scaleY(1)`, offset: o(T - 260), easing: OUT }, { transform: `${tilt} scaleY(0)` }], { duration: T, fill: 'both' });
  // 속도선: 길이 · 굵기 · 높이 · 속도가 제각각, 띠가 열려 있는 동안 되풀이
  const W = innerWidth;
  for (let k = 0, n = low ? 7 : 26; k < n; k++) {
    const i = document.createElement('i');
    i.className = `sl c${1 + Math.floor(Math.random() * 4)}`;
    const w = rnd(0.08, 0.42) * W, d = rnd(240, 620);
    i.style.cssText = `top:${rnd(4, 94).toFixed(1)}%;width:${w.toFixed(0)}px;height:${pick([1, 1, 2, 2, 3, 5])}px`;
    fx.appendChild(i);
    i.animate([{ transform: `translateX(${W + 20}px)` }, { transform: `translateX(${-w - 20}px)` }], { duration: d, delay: rnd(60, 420), iterations: Math.ceil((T - 500) / d), easing: 'linear' });
  }
  // 도형: 띠 위아래로 조금 넘쳐 지나간다 (가까운 것은 크고 빠르다), 반짝이는 늘어진 별빛 꼬리
  if (!low) for (let k = 0; k < 11; k++) {
    const s = document.createElement('s'), z = Math.random(), size = 10 + 54 * z, kind2 = pick(SHAPES);
    s.className = `sh ${kind2} c${1 + Math.floor(Math.random() * 4)}`;
    s.style.cssText = `top:calc(${rnd(-14, 100).toFixed(0)}%);width:${size.toFixed(0)}px;height:${size.toFixed(0)}px`;
    band.appendChild(s);
    const rot = rnd(90, 260) * (Math.random() < 0.5 ? -1 : 1), stretch = kind2 === 'spk' ? 'scaleX(2.6)' : '';
    s.animate([{ transform: `translateX(${W + 80}px) ${stretch} rotate(0deg)` }, { transform: `translateX(-120px) ${stretch} rotate(${rot}deg)` }],
      { duration: 900 - 520 * z, delay: rnd(80, T - 900), easing: 'cubic-bezier(.3, 0, .7, 1)', fill: 'both' });
  }
  // 선로: 침목이 흐른다
  const rail = el.querySelector<HTMLElement>('.mt-go-rail')!;
  rail.animate([{ backgroundPosition: '0 0' }, { backgroundPosition: '-96px 0' }], { duration: low ? 260 : 160, iterations: Infinity });
  // 탑승권: 앞으로 기울어 들어와 살짝 넘쳤다 서고, 펀치, 다시 기울어 왼쪽으로
  tk.animate([
    { transform: 'translateX(60vw) skewX(18deg)', opacity: 0, easing: 'cubic-bezier(.15, .7, .3, 1)' },
    { transform: 'translateX(-14px) skewX(-5deg)', opacity: 1, offset: o(300), easing: 'ease-out' },
    { transform: 'translateX(0) skewX(0deg)', opacity: 1, offset: o(420) },
    { transform: 'translateX(0) skewX(0deg)', opacity: 1, offset: o(T - 320), easing: 'cubic-bezier(.55, 0, .85, .3)' },
    { transform: 'translateX(-70vw) skewX(22deg)', opacity: 0 },
  ], { duration: T, fill: 'both' });
  const punch = el.querySelector<HTMLElement>('.mt-go-punch')!;
  punch.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(0)', opacity: 0, offset: o(560) }, { transform: 'scale(1.35)', opacity: 1, offset: o(640) }, { transform: 'scale(1)', opacity: 1, offset: o(720) }, { transform: 'scale(1)', opacity: 1 }], { duration: T, fill: 'both' });
  if (kind === 'boss') tk.querySelector<HTMLElement>('.mt-go-t')!.animate([{ transform: 'none' }, { transform: 'none', offset: o(640) }, { transform: 'translateX(-5px)', offset: o(680) }, { transform: 'translateX(5px)', offset: o(720) }, { transform: 'translateX(-3px)', offset: o(760) }, { transform: 'none', offset: o(800) }, { transform: 'none' }], { duration: T });
  setTimeout(() => el.remove(), T + 60);
  return true;
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
/** 갤럭시 별무리를 el 안에 깐다 (계약 그늘 장면처럼 테마 연출 설정과 상관없이 갤럭시 배경이 필요한 곳). 별빛 층과 같은 타일 · 같은 흐름 · 같은 반짝임 */
export function starField(el: HTMLElement) {
  const still = reduced();
  for (const [w, h, ns, v, tw] of STAR_TILES) {
    const i = document.createElement('i');
    i.style.cssText = `position:absolute;left:${-w}px;top:${-h}px;width:calc(100% + ${w}px);height:calc(100% + ${h}px);background:url(${starTile(w, h, ns, tw > 0)}) 0 0/${w}px ${h}px`;
    el.appendChild(i);
    if (still) continue;
    i.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${w}px, ${h}px)` }], { duration: (w / v) * 1000, iterations: Infinity });
    if (tw) i.animate([{ opacity: 0.1 }, { opacity: 1 }], { duration: tw, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  }
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


// ───────────────────────── 메트로: 창밖 별빛 (본문 뒤)
// 달리는 열차의 창밖처럼 별이 오른쪽에서 왼쪽으로 흐른다 (먼 별은 느리고 가까운 별은 빠르다). 가까운 층은 네 갈래 반짝이 별(보라 · 민트 · 흰).
// 켜기에서는 가끔 먼 선로 위로 빛 열차(노선색 칸이 이어진 점선)가 지나간다. 전투 중엔 층을 내린다
// [타일 폭, 높이, [점 · 작은 점 · 반짝이 수], 흐름 속도 px/s, 반짝임 주기 ms]
const WIN_TILES: [number, number, number[], number, number][] = [[560, 300, [12, 5, 0], 9, 0], [720, 400, [0, 7, 2], 24, 0], [640, 420, [0, 0, 4], 15, 2600]];
const WIN_C = ['#d9d4ff', '#c4f2e4', '#fff6dc'];
function winTile(w: number, h: number, ns: number[], glint: boolean) {
  const k = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d')!;
  x.scale(k, k);
  const sparkle = (px: number, py: number, r: number) => { // 네 갈래 별 (둥근 오목 변)
    x.beginPath(); x.moveTo(px, py - r);
    x.quadraticCurveTo(px, py, px + r, py); x.quadraticCurveTo(px, py, px, py + r); x.quadraticCurveTo(px, py, px - r, py); x.quadraticCurveTo(px, py, px, py - r);
    x.fill();
  };
  ns.forEach((n, z) => { for (let i = 0; i < n; i++) {
    const px = rnd(0, w), py = rnd(0, h);
    x.globalAlpha = (glint ? 0.7 : [0.24, 0.36, 0.55][z]) * rnd(0.7, 1.1);
    x.fillStyle = pick(WIN_C);
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      if (z === 2 || glint) sparkle(px + dx, py + dy, (glint ? 6 : 4.5) * rnd(0.7, 1.2));
      else { x.beginPath(); x.arc(px + dx, py + dy, [0.55, 0.9][z] * rnd(0.8, 1.2), 0, 6.283); x.fill(); }
    }
  } });
  return c.toDataURL();
}
function metroLayer(level: FxLevel): Layer {
  const el = layerEl('tfx-stars mt-win');
  const anims: Animation[] = [];
  let isBusy = false, stopTrain = () => {};
  const still = reduced();
  const scale = level === 'low' ? 0.55 : 1;
  const lt = document.createElement('b');
  lt.className = 'mt-lt';
  const pass = () => { // 빛 열차: 먼 선로 위를 한 번 지나간다
    if (isBusy) return;
    const y = rnd(innerHeight * 0.55, innerHeight * 0.92), len = rnd(180, 320);
    lt.style.width = `${len.toFixed(0)}px`;
    lt.animate([{ transform: `translate(${innerWidth + 20}px, ${y}px)`, opacity: 0 }, { opacity: 0.55, offset: 0.12 }, { opacity: 0.55, offset: 0.85 }, { transform: `translate(${-len - 20}px, ${y}px)`, opacity: 0 }], { duration: rnd(2400, 3400), easing: 'linear' });
  };
  return {
    start() {
      for (const [w, h, ns, v, tw] of WIN_TILES) {
        const i = document.createElement('i');
        i.style.cssText = `left:0;top:0;width:calc(100% + ${w}px);height:100%;background:url(${winTile(w, h, ns.map((n) => Math.round(n * scale)), tw > 0)}) 0 0/${w}px ${h}px`;
        el.appendChild(i);
        if (still) continue;
        anims.push(i.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }], { duration: (w / v) * 1000, iterations: Infinity }));
        if (tw) anims.push(i.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: tw, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      }
      el.appendChild(lt);
      document.body.appendChild(el);
      this.setBusy(isBusy);
      if (level === 'on' && !still) {
        const first = window.setTimeout(pass, rnd(5, 12) * 1000), st = every(14, 30, pass);
        stopTrain = () => { clearTimeout(first); st(); };
      }
    },
    stop() { stopTrain(); anims.forEach((x) => x.cancel()); el.remove(); },
    setBusy(b) { isBusy = b; el.hidden = b; anims.forEach((x) => (b ? x.pause() : x.play())); },
  };
}
