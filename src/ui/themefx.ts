// 테마 연출 (설정 → 테마 연출: 켜기 · 줄이기 · 끄기). 외부 이미지 없이 canvas · CSS 로만 그린다.
//   · 갤럭시: 화면 뒤(본문 아래) 별빛 층 — 천천히 흐르는 별 3층 · 반짝임 · 가끔 유성
//   · 메트로 인피니티 패스: 화면 뒤 '창밖 별빛' — 달리는 열차 창밖처럼 별이 오른쪽에서 왼쪽으로 흐르는 3층 · 가끔 지나가는 빛 열차.
//     런 출발 · 보스 · 상점에 들어갈 때만 열차가 들어와 화면을 덮고, 다음 역 안내판(새 화면의 그림이 다 받아질 때까지 · 받은 그림 수 = 역 점)을 보인 뒤 떠나며 다음 화면을 드러낸다.
//     전투 진입은 노선색 사선 패널이 덮고 신호등이 켜졌다 꺼지면(출발) 걷히며 전투가 시작된다 (banner).
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

// ───────────────────────── 메트로: 전투 진입 · 페이즈 전환 (app/common.ts banner 대신)
// 큰 면 위주 (선 장식 대신): 노선색 사선 패널 3장(민트 → 보라 → 잉크)이 F1 중계 화면처럼 오른쪽에서 겹쳐 쓸고 들어와 화면을 덮는다.
// 잉크 패널 위: 큰 원판 · 사분원 · 갈매기표 묶음 · 망점 띠 · 바코드 기둥(디자인 시스템 표식을 크게) + 탑승권(도장처럼 찍힌다) + 신호등 5개.
// 신호등이 하나씩 켜졌다가 한꺼번에 꺼지는 순간(출발) 패널이 같은 방향으로 빠지며 보드가 드러나고, 그때 전투가 시작한다 (돌려주는 값).
// 보스 = 신호 주황 패널 · 위아래 경고 빗금 띠 · 느린 신호등, 역경 = 복숭아 경고 띠, 페이즈 = 신호등 대신 큰 노선 번호 (전투 아님 → 기다리지 않는다).
// 줄이기: 패널 없이 띠 + 탑승권만 (기다리지 않는다). 움직임 줄이기: 기본 배너
type BannerKind = 'battle' | 'boss' | 'phase' | 'adversity';
const KICK: Record<BannerKind, string> = { battle: 'DEPARTURE', adversity: 'RAPID', boss: 'EXPRESS · NO STOP', phase: 'LINE CHANGE' };
const SLAM = 'cubic-bezier(.7, 0, .2, 1)', POP = 'cubic-bezier(.3, 1.5, .5, 1)', OUTE = 'cubic-bezier(.6, 0, .9, .35)';
/** 시각(ms) 기준 키프레임 → 한 애니메이션 (마지막 상태 유지). pts: [시각, 속성들, 그 구간 easing] */
function tl(el: Element, T: number, pts: [number, Keyframe, string?][]) {
  const fr = pts.map(([t, k, ez]) => ({ ...k, offset: Math.max(0, Math.min(1, t / T)), ...(ez ? { easing: ez } : {}) }));
  if (fr[0].offset !== 0) fr.unshift({ ...pts[0][1], offset: 0 });
  if (fr[fr.length - 1].offset !== 1) fr.push({ ...pts[pts.length - 1][1], offset: 1 });
  return el.animate(fr, { duration: T, fill: 'both' });
}
/** 전투 개시 · 보스 · 역경 · 페이즈 연출. 메트로(켜기 · 줄이기)가 맡았으면 전투를 시작할 때까지 기다릴 시간(ms, 0 = 기다리지 않음), 아니면 -1 (기본 배너) */
export function banner(kind: BannerKind, title: string, sub = ''): number {
  if (!metroOn() || reduced()) return -1;
  document.querySelector('.mt-go')?.remove();
  return cur.level === 'low' ? goLow(kind, title, sub) : goFull(kind, title, sub);
}
const tkHtml = (kind: BannerKind, title: string, sub: string) => `<div class="mg-tk"><div class="mg-tk-a"><span class="mg-k"><b>ADMIT ONE</b><i></i><span>${KICK[kind]}</span></span><b class="mg-t">${esc(title)}</b>${sub ? `<span class="mg-r"><span>TO</span><b>${esc(sub)}</b><i></i></span>` : ''}</div><span class="mg-code"></span><i class="mg-punch"></i></div>`;
function goFull(kind: BannerKind, title: string, sub: string) {
  const boss = kind === 'boss', phase = kind === 'phase', warn = boss || kind === 'adversity';
  const T = boss ? 1900 : phase ? 1350 : 1500;
  const OUT = boss ? 1340 : phase ? 900 : 1000; // 패널이 걷히기 시작하는 때 (= 출발)
  const el = document.createElement('div');
  el.className = `mt-go mt-go-${kind}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const num = phase ? (title.match(/\d+/)?.[0] || '1').padStart(2, '0') : '';
  el.innerHTML = `<i class="mg-pan p1"></i><i class="mg-pan p2"></i><i class="mg-pan p3"></i>
    <div class="mg-stage">
      <div class="mg-shapes" aria-hidden="true"><i class="mg-disc"></i><i class="mg-quarter"></i><i class="mg-chev"></i><i class="mg-dots"></i><i class="mg-bars"></i>${warn ? '<i class="mg-hz t"></i><i class="mg-hz b"></i>' : ''}</div>
      ${phase ? `<b class="mg-num" aria-hidden="true">${num}</b>` : `<div class="mg-lights" aria-hidden="true">${'<i><b></b></i>'.repeat(5)}</div>`}
      ${tkHtml(kind, title, sub)}
    </div>`;
  document.body.appendChild(el);
  const $ = (q: string) => el.querySelector<HTMLElement>(q)!;
  const SK = 'skewX(-14deg)';
  // 패널: 민트 · 보라 · 잉크 순서로 들어오고, 출발 때 잉크 · 보라 · 민트 순서로 빠진다
  el.querySelectorAll('.mg-pan').forEach((p, k) => {
    const inEnd = 260 + k * 70, outAt = OUT + (2 - k) * 55;
    tl(p, T, [[k * 60, { transform: `translateX(118vw) ${SK}` }, SLAM], [inEnd, { transform: `translateX(-44vw) ${SK}` }], [outAt, { transform: `translateX(-44vw) ${SK}` }, OUTE], [outAt + 360, { transform: `translateX(-250vw) ${SK}` }]]);
  });
  // 무대(잉크 패널 위 내용): 덮인 뒤 나타나고 출발 직후 사라진다
  tl($('.mg-stage'), T, [[300, { opacity: 0 }], [360, { opacity: 1 }], [OUT + 40, { opacity: 1 }], [OUT + 140, { opacity: 0 }]]);
  tl($('.mg-disc'), T, [[300, { transform: 'scale(.55)' }, POP], [560, { transform: 'scale(1)' }], [OUT, { transform: 'scale(1)' }]]);
  tl($('.mg-quarter'), T, [[320, { transform: 'translate(-30%, 30%)' }, SLAM], [560, { transform: 'translate(0, 0)' }]]);
  tl($('.mg-chev'), T, [[330, { transform: 'translateX(40vw)' }], [OUT + 140, { transform: 'translateX(-60vw)' }]]); // 갈매기표 묶음이 계속 지나간다 (속도감)
  tl($('.mg-dots'), T, [[330, { transform: 'translateX(18vw)' }], [OUT + 140, { transform: 'translateX(-18vw)' }]]);
  tl($('.mg-bars'), T, [[380, { transform: 'scaleY(0)' }, SLAM], [600, { transform: 'scaleY(1)' }]]);
  el.querySelectorAll('.mg-hz').forEach((h, k) => tl(h, T, [[330, { transform: `translateX(${k ? '-' : ''}30vw)` }], [OUT + 140, { transform: `translateX(${k ? '' : '-'}30vw)` }]]));
  // 탑승권: 도장처럼 크게 찍혔다가, 출발 때 앞으로 기울며 빠진다
  tl($('.mg-tk'), T, [[340, { transform: 'scale(1.22) rotate(-2deg)', opacity: 0 }, POP], [540, { transform: 'scale(1) rotate(-2deg)', opacity: 1 }], [OUT, { transform: 'scale(1) rotate(-2deg)', opacity: 1 }, OUTE],
    [OUT + 220, { transform: 'translateX(-46vw) skewX(18deg) rotate(-2deg)', opacity: 0 }]]);
  tl($('.mg-punch'), T, [[OUT - 160, { transform: 'scale(0)' }, POP], [OUT - 60, { transform: 'scale(1)' }]]);
  if (phase) tl($('.mg-num'), T, [[340, { transform: 'translateX(12vw) scale(1.1)', opacity: 0 }, SLAM], [620, { transform: 'none', opacity: 1 }], [OUT, { transform: 'none', opacity: 1 }]]);
  else {
    // 신호등: 하나씩 켜지고 출발 때 한꺼번에 꺼진다 (보스는 느리게)
    const step = boss ? 140 : 95, first = boss ? 560 : 430;
    el.querySelectorAll('.mg-lights b').forEach((b, k) => tl(b, T, [[first + k * step, { opacity: 0, transform: 'scale(.4)' }, POP], [first + k * step + 90, { opacity: 1, transform: 'scale(1)' }], [OUT - 20, { opacity: 1, transform: 'scale(1)' }], [OUT, { opacity: 0, transform: 'scale(1)' }]]));
  }
  if (boss) tl($('.mg-t'), T, [[700, { transform: 'none' }], [740, { transform: 'translateX(-6px)' }], [780, { transform: 'translateX(6px)' }], [820, { transform: 'translateX(-3px)' }], [860, { transform: 'none' }]]);
  setTimeout(() => el.remove(), T + 80);
  return phase ? 0 : OUT + 40;
}
/** 줄이기: 화면을 덮지 않는다. 잉크 띠 하나에 탑승권이 들어왔다 나간다 (기다리지 않는다) */
function goLow(kind: BannerKind, title: string, sub: string) {
  const T = kind === 'boss' ? 1500 : 1150;
  const el = document.createElement('div');
  el.className = `mt-go mt-go-${kind} low`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="mg-band"></div>${tkHtml(kind, title, sub)}`;
  document.body.appendChild(el);
  tl(el.querySelector('.mg-band')!, T, [[0, { transform: 'scaleY(0)' }, SLAM], [180, { transform: 'scaleY(1)' }], [T - 220, { transform: 'scaleY(1)' }, OUTE], [T, { transform: 'scaleY(0)' }]]);
  tl(el.querySelector('.mg-tk')!, T, [[60, { transform: 'translateX(40vw)', opacity: 0 }, SLAM], [300, { transform: 'none', opacity: 1 }], [T - 260, { transform: 'none', opacity: 1 }, OUTE], [T - 40, { transform: 'translateX(-40vw)', opacity: 0 }]]);
  setTimeout(() => el.remove(), T + 60);
  return 0;
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
