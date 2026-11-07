// 테마 연출 (설정 → 테마 연출: 켜기 · 줄이기 · 끄기). 외부 이미지 없이 canvas · CSS 로만 그린다.
//   · 갤럭시: 화면 뒤(본문 아래) 별빛 층 — 천천히 흐르는 별 3층 · 반짝임 · 가끔 유성
//   · 메트로 인피니티 패스: 화면 뒤 '창밖 별빛' — 달리는 열차 창밖처럼 별이 오른쪽에서 왼쪽으로 흐르는 3층 · 가끔 지나가는 빛 열차.
//     큰 화면 전환은 세 곳에서만 화면을 덮는다 (새 화면의 그림이 다 받아질 때까지 · 받은 그림 수 = 역 점): 런 출발 = 바코드 게이트,
//     보스 노드 = 빨간 급행(차창 너머 보스 실루엣 · 경고 패널), 상점 = MARKET 패널.
//     전투 진입은 노선색 사선 패널이 덮고 신호등이 켜졌다 꺼지면(출발) 걷히며 전투가 시작된다 (banner).
// 움직임은 모두 Web Animations 의 transform · opacity (판독기 열림만 clip-path) 라 합성기에서 돌고 메인 스레드는 거의 쓰지 않는다
// (별 타일은 시작할 때 canvas 로 한 번만 그린다). 배경 층은 pointer-events: none 이라 입력을 막지 않는다 (전환이 덮는 동안만 막는다).
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

// ───────────────────────── 메트로: 큰 화면 전환 (런 출발 · 보스 · 상점)
// 인게임 화면끼리만 (바 · 계약 · 타이틀 · 도감은 제외). 전투 진입은 banner 가 맡는다
/** 큰 전환이 서는 정거장 (main.ts render 의 mtStop 이 정한다, 나머지 화면 전환은 그대로 컷):
 *  depart = 런 출발(명부 → 지도) 바코드 게이트 · boss = 보스 노드 진입 빨간 급행 · market = 상점 진입 MARKET 패널.
 *  머리표(영문 대문자 모노) · 이름(그 순간의 대상: 전장 · 보스 이름 · 상점) · 영문 부제 · img = 보스 스탠딩 (급행 차창 너머 실루엣) */
export interface Stop { kick: string; name: string; en: string; tone: 'depart' | 'boss' | 'market'; img?: string }
let lastStop: Stop | null = null;
/** 전투 진입 직전 화면의 얼린 사본 (패널이 다 덮으면 걷는다) · 이번 세션 전투 진입 횟수 (반복되면 연출을 줄인다, UI.md 22) */
let goGhost: HTMLElement | null = null;
let goSeen = 0;
/** 새 화면 그림을 기다리는 최대 시간 (ms) */
const CAP = 4000;
/** 큰 전환 하나: 덮개(el) · 얼린 화면(ghost) · 다 덮인 때(covered) · 덮인 뒤 최소로 머무는 시간(hold) · 걷기(leave) · 덮개가 걷힐 때까지 멈춰 둔 아래 화면 등장 연출(held) */
type Ride = { el: HTMLElement; ghost: HTMLElement | null; fresh: boolean; covered: Promise<void>; anims: Animation[]; gone: boolean; hold: number; leave: (r: Ride) => void; held: Animation[]; quick?: boolean };
let ride: Ride | null = null;

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
  // 전투 진입 (켜기): 화면이 먼저 바뀌고 패널이 나중에 덮지 않게, 지금 화면을 얼려 두었다가 패널이 다 덮으면 걷는다 (banner → goFull)
  if (next === 'battle' && prev && prev !== 'battle' && metroOn() && cur.level === 'on' && !reduced()) {
    goGhost?.remove();
    const g = freeze(app);
    goGhost = g;
    setTimeout(() => { if (goGhost === g) { g.remove(); goGhost = null; } }, 1500); // 진입 연출이 오지 않으면 (전투 아닌 진입 등) 그대로 걷는다
  }
  lastStop = metroOn() && prev && prev !== next ? stop : null;
  if (!lastStop || cur.level !== 'on' || reduced()) return;
  endRide();
  const ghost = freeze(app);
  const r = (lastStop.tone === 'market' ? marketIn : lastStop.tone === 'boss' ? expressIn : gateIn)(ghost, lastStop);
  ride = r;
  void r.covered.then(() => { r.ghost?.remove(); r.ghost = null; }); // 다 덮이면 얼린 사본을 걷는다 (안 걷으면 사본이 입력을 막는다)
}
/** 새 화면의 그림이 다 받아지면(최대 4초, 덮인 뒤 최소 hold) 덮개가 걷힌다. 역 점 = 기다리는 그림 하나씩 (받으면 채워진다) */
function rideTrack(r: Ride) {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#app img')).filter((im) => !im.complete).slice(0, 12);
  const stops = r.el.querySelector<HTMLElement>('.mt-bd-stops');
  if (stops) { stops.innerHTML = imgs.map(() => '<i></i>').join(''); stops.hidden = !imgs.length; }
  let n = 0;
  const loads = imgs.map((im) => new Promise<void>((res) => {
    const done = () => { stops?.children[n++]?.classList.add('on'); res(); };
    im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true });
  }));
  const minHold = r.covered.then(() => new Promise((res) => setTimeout(res, r.hold)));
  void Promise.race([Promise.all([Promise.all(loads), minHold]), new Promise((res) => setTimeout(res, CAP))]).then(() => r.leave(r));
}
/** 덮개 아래에서 먼저 돌아 버리면 안 보이는 등장 연출(런 출발 특권 창의 머리 글씨 · 카드 세 장)은 멈춰 두었다가, 덮개가 걷히기 시작할 때 이어서 돈다.
 *  막(메트로 = 행선 안내판 플립)도 덮인 동안 멈춰 둔다 → 걷히면 글자판이 넘어가며 카드가 놓인다. at = 멈춘 연출을 이 시각(ms)부터 잇는다 (지연을 그만큼 건너뛴다) */
function holdUnder(r: Ride) {
  r.held = Array.from(document.querySelectorAll('.pv-bg:not(.played) .pv-body')).flatMap((e) => e.getAnimations({ subtree: true })); // 머리 글씨 + 카드 줄 전체 (칸 · 뒷면 · 스캔 줄 · 삑 고리)
  r.held.forEach((a) => a.pause());
}
function release(r: Ride, at = 0) {
  for (const a of r.held) { try { a.currentTime = Math.max(Number(a.currentTime) || 0, at); a.play(); } catch { /* 이미 끝난 연출 */ } }
  r.held = [];
}
function endRide() { if (!ride) return; release(ride); ride.anims.forEach((x) => x.cancel()); ride.el.remove(); ride.ghost?.remove(); ride = null; }
const done = (r: Ride, ms: number, after?: () => void) => setTimeout(() => { r.el.remove(); if (ride === r) ride = null; after?.(); }, ms);

/** 런 출발 = 바코드 게이트 (디자인 시스템 barcode 전환 — '메뉴에서 게임으로 진입'). 잉크 · 보라 · 민트 막대 24개(디자인 시스템 굵기 비율)가
 *  왼쪽부터 차례로 떨어져 화면을 덮고(막대 지연 i × 덮기 × .022 · 길이 덮기 × .55 · ease-slam), 복숭아 판독선이 위에서 아래로 한 번 훑는다.
 *  가운데 잉크 판독기(굵은 종이 윤곽 · 단단한 민트 그림자 = 브루탈리즘 판)가 위아래로 열리고 DEPARTURE 탑승권(전장 이름 · PHASE)이 도장처럼 찍힌다 (판이 덜컥 흔들린다).
 *  아래 칸 = 역 점 (새 화면 그림 하나씩). 그림이 받아지면 표에 구멍이 뚫리고(GATE OPEN) 판독기가 내려가며 막대가 왼쪽부터 아래로 빠져 지도가 드러난다 → 오른쪽 위 반짝 */
const BARS = [2, 1, 1, 3, 3, 1, 1, 2, 1, 3, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 1, 2, 3, 1];
const GT = { cover: 420, hold: 800, reveal: 480 };
function gateIn(ghost: HTMLElement, st: Stop): Ride {
  const el = document.createElement('div');
  el.className = 'mt-gate';
  el.setAttribute('aria-hidden', 'true');
  const bTot = BARS.reduce((a, g) => a + g, 0);
  let bAcc = 0;
  const bars = BARS.map((g) => { const x = (bAcc / bTot) * 100; bAcc += g; return `<i style="flex-grow:${g};--bx:${x.toFixed(3)}vw"></i>`; }).join(''); // --bx = 막대 왼쪽 위치 → 별 하늘이 막대를 건너 이어진다
  el.innerHTML = `<div class="gt-bars">${bars}</div><i class="gt-scan"></i>
    <div class="gt-rd"><span class="gt-row"><b class="gt-gate">GATE ∞</b><span class="gt-st">SCANNING</span></span>${tkHtml(st.kick, st.name, st.en)}<span class="mt-bd-stops"></span></div>`;
  document.body.appendChild(el);
  const $ = (q: string) => el.querySelector<HTMLElement>(q)!;
  const C = GT.cover, T = 1600;
  const anims: Animation[] = [];
  el.querySelectorAll('.gt-bars i').forEach((b, i) => anims.push(b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: C * 0.55, delay: i * C * 0.022, easing: SLAM, fill: 'both' })));
  anims.push(tl($('.gt-scan'), T, [[C * 0.85, { transform: 'translateY(-72px)', opacity: 0 }, 'cubic-bezier(.45, 0, .55, 1)'], [C * 0.85 + 1, { opacity: 1 }], [C * 0.85 + 440, { transform: 'translateY(100vh)', opacity: 1 }], [C * 0.85 + 450, { opacity: 0 }]]));
  anims.push(tl($('.gt-rd'), T, [[C, { clipPath: 'inset(50% -24px 50% -24px)', opacity: 0 }], [C + 1, { opacity: 1 }, SLAM], [C + 190, { clipPath: 'inset(-24px -24px -24px -24px)', opacity: 1 }]]));
  anims.push(tl($('.mg-tk'), T, [[C + 150, { transform: 'scale(1.3) rotate(-2deg)', opacity: 0 }, POP], [C + 350, { transform: 'scale(1) rotate(-2deg)', opacity: 1 }]]));
  anims.push($('.gt-rd').animate([{ translate: '0 0' }, { translate: '-5px 3px' }, { translate: '4px -3px' }, { translate: '-2px 2px' }, { translate: '0 0' }], { duration: 240, delay: C + 340, easing: 'steps(4)' })); // 도장이 찍히는 순간 판이 덜컥 (디자인 시스템 shake)
  return { el, ghost, fresh: true, covered: new Promise<void>((res) => setTimeout(res, (BARS.length - 1) * C * 0.022 + C * 0.55)), anims, gone: false, hold: GT.hold, leave: gateLeave, held: [] };
}
function gateLeave(r: Ride) {
  if (r.gone) return;
  r.gone = true;
  const el = r.el, R = GT.reveal, T = 720;
  el.classList.add('open'); // 걷히기 시작하면 누름은 아래 화면으로
  el.querySelector('.gt-st')!.textContent = 'GATE OPEN';
  release(r, 600);
  r.anims.push(tl(el.querySelector('.mg-punch')!, T, [[0, { transform: 'scale(0)' }, POP], [100, { transform: 'scale(1)' }]]));
  r.anims.push(tl(el.querySelector('.gt-rd')!, T, [[110, { transform: 'translateY(0)', opacity: 1 }, OUTE], [300, { transform: 'translateY(16vh)', opacity: 0 }]]));
  el.querySelectorAll<HTMLElement>('.gt-bars i').forEach((b, i) => {
    b.style.transformOrigin = '50% 100%';
    r.anims.push(b.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: R * 0.55, delay: 120 + i * R * 0.022, easing: SLAM, fill: 'both' }));
  });
  done(r, 120 + (BARS.length - 1) * R * 0.022 + R * 0.55 + 30, glint);
}
/** 전환이 끝나면 오른쪽 위에 네 갈래 반짝이가 잠깐 뜬다 (디자인 시스템 glint) */
function glint() {
  const g = document.createElement('i');
  g.className = 'mt-glint';
  g.setAttribute('aria-hidden', 'true');
  document.body.appendChild(g);
  g.animate([{ transform: 'scale(.2) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1.1) rotate(0deg)', opacity: 1, offset: 0.45 }, { transform: 'scale(.9) rotate(12deg)', opacity: 0 }], { duration: 420, easing: POP, fill: 'both' });
  setTimeout(() => g.remove(), 460);
}

/** 보스 노드 = 빨간 급행 (EXPRESS): 전투 진입처럼 사선 면 셋(복숭아 → 빨강 → 잉크)이 먼저 화면을 쓸고, 바로 뒤를 신호 빨강 급행 차체가 오른쪽 밖에서 거세게 들어와 덮고 멈추며 한 번 덜컥인다 (비스듬히 깎인 앞코는 멈추면 화면 왼쪽 밖).
 *  차창 띠 너머 = 경보로 밝은 하늘 · 보스 실루엣 — 실루엣은 그 자리에 서 있고 창틀만 지나간다 (차체와 반대로 같은 거리를 움직여 상쇄), 멈춘 동안 천천히 다가온다.
 *  안내판 대신 큰 경고 패널: 종이 판 · 굵은 잉크 윤곽 · 단단한 잉크 그림자 · 흐르는 경고 빗금 · ! 판 · 보스 이름(흔들림) · PHASE · TERMINAL · 역 점.
 *  새 화면 그림이 받아지면 한 번 덜컥 물러섰다가 왼쪽으로 가속해 빠지고, 꼬리 뒤로 사선 면이 잉크 → 빨강 → 복숭아 순서로 따라 쓸려 나가며 편성 화면이 드러난다 */
const EX = { lead: 260, in: 420, hold: 1000, out: 560, wake: 360 };
function expressIn(ghost: HTMLElement, st: Stop): Ride {
  const el = document.createElement('div');
  el.className = 'mt-ex';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<i class="mg-pan p1"></i><i class="mg-pan p2"></i><i class="mg-pan p3"></i><div class="ex-car" data-k="EXPRESS ∞ METRO · NON-STOP · TERMINAL"><div class="ex-win"><div class="ex-view">${st.img ? `<i class="ex-boss"><img alt="" decoding="async" src="${esc(st.img)}" onerror="this.remove()"></i>` : ''}</div></div>
    <i class="ex-lv"></i><b class="ex-word">${'EXPRESS ∞ NON-STOP · '.repeat(4)}</b><i class="ex-skirt"></i><i class="ex-tail"></i>
    <div class="ex-panel"><i class="ex-hz"><i></i></i><b class="ex-ic">!</b><span class="ex-k">${esc(st.kick)}</span><b class="ex-t">${esc(st.name)}</b><span class="ex-en">${esc(st.en)}</span><span class="mt-bd-stops"></span></div></div>`;
  document.body.appendChild(el);
  const $ = (q: string) => el.querySelector<HTMLElement>(q)!;
  const boss = el.querySelector<HTMLElement>('.ex-boss');
  const anims: Animation[] = [];
  const L = EX.lead, A = L + EX.in, T = A + 170, SK = 'skewX(-14deg)';
  // 사선 면 셋: 전투 진입과 같은 쓸기 (복숭아 · 빨강 · 잉크 순서로 들어와 덮는다)
  el.querySelectorAll('.mg-pan').forEach((p, k) => anims.push(tl(p, T, [[k * 60, { transform: `translateX(118vw) ${SK}` }, SLAM], [260 + k * 70, { transform: `translateX(-44vw) ${SK}` }]])));
  // 차체(vw): 면 바로 뒤에서 오른쪽 밖 → 0 (거세게 들어와 멈춘다) → 한 번 덜컥. 실루엣은 같은 시각에 반대로 움직여 제자리
  const pts: [number, number, string?][] = [[L, 110, 'cubic-bezier(.12, .72, .28, 1)'], [A, -1.2, 'ease-out'], [A + 90, 0.5, 'ease-in-out'], [T, 0]];
  anims.push(tl($('.ex-car'), T, pts.map(([t, x, ez]) => [t, { transform: `translateX(${x}vw)` }, ez])));
  if (boss) {
    anims.push(tl(boss, T, pts.map(([t, x, ez]) => [t, { translate: `${-x}vw 0` }, ez])));
    anims.push(boss.animate([{ scale: '1' }, { scale: '1.07' }], { duration: 2600, delay: A, easing: 'cubic-bezier(.2, .6, .3, 1)', fill: 'both' })); // 멈춘 동안 천천히 다가온다
  }
  anims.push(tl($('.ex-panel'), 1800, [[A - 60, { transform: 'scale(1.25) rotate(-1.5deg)', opacity: 0 }, POP], [A + 150, { transform: 'scale(1) rotate(-1.5deg)', opacity: 1 }]]));
  anims.push(tl($('.ex-t'), 1800, [[A + 200, { transform: 'none' }], [A + 240, { transform: 'translateX(-6px)' }], [A + 280, { transform: 'translateX(6px)' }], [A + 320, { transform: 'translateX(-3px)' }], [A + 360, { transform: 'none' }]]));
  anims.push($('.ex-hz > i').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-24px)' }], { duration: 420, iterations: Infinity })); // 경고 빗금이 계속 흐른다 (빗금 한 칸 = 24px)
  return { el, ghost, fresh: true, covered: new Promise<void>((res) => setTimeout(res, 400)), anims, gone: false, hold: EX.hold, leave: expressLeave, held: [] }; // 잉크 면이 다 덮는 때 (260 + 2 × 70)
}
function expressLeave(r: Ride) {
  if (r.gone) return;
  r.gone = true;
  const el = r.el, O = EX.out, boss = el.querySelector<HTMLElement>('.ex-boss');
  el.classList.add('open');
  release(r, 600);
  const pts: [number, number, string?][] = [[0, 0, 'ease-out'], [90, 0.8, 'cubic-bezier(.5, 0, .9, .45)'], [O, -126]]; // 한 번 물러섰다가 가속해서 빠진다 (차체 130vw)
  r.anims.push(tl(el.querySelector('.ex-car')!, O, pts.map(([t, x, ez]) => [t, { transform: `translateX(${x}vw)` }, ez])));
  if (boss) r.anims.push(tl(boss, O, pts.map(([t, x, ez]) => [t, { translate: `${-x}vw 0` }, ez])));
  // 꼬리 뒤 사선 면: 꼬리가 화면을 반쯤 지날 때부터 잉크 → 빨강 → 복숭아 순서로 따라 쓸려 나간다 (지나간 열차의 바람)
  const SK = 'skewX(-14deg)', W0 = 330, T = W0 + 2 * 55 + EX.wake;
  el.querySelectorAll('.mg-pan').forEach((p, k) => { const at = W0 + (2 - k) * 55; r.anims.push(tl(p, T, [[at, { transform: `translateX(-44vw) ${SK}` }, OUTE], [at + EX.wake, { transform: `translateX(-250vw) ${SK}` }]])); });
  done(r, T + 40);
}

/** 상점 = 전투 진입과 같은 밀도의 큰 면 전환 (MARKET): 복숭아 · 민트 · 잉크 사선 패널이 덮고, 잉크 위에 큰 동전 원판(∞) · 가격표 · 흘러가는 MARKET 글자 띠 두 줄 ·
 *  망점 · 바코드 기둥 · 진열칸 5개(하나씩 불이 들어온다) + 다음 역 탑승권. 새 화면 그림이 받아지면(최소 MK.hold) 패널이 같은 방향으로 빠지며 상점이 드러난다 */
const MK = { cover: 400, hold: 760, run: 5200, holdQuick: 120 };
/** 이번 접속에서 지난 상점 전환 수 — 상점은 런 한 번에 20번 넘게 지나는 가장 잦은 전환이라, 첫 번만 다 보여 주고(덮인 뒤 0.76초) 다음부터는 짧게 지난다
 *  (덮인 뒤 0.12초 + 빠른 걷기 → 약 0.8초, 2026-11-06 피드백: 매번 1.25초) */
let mkCount = 0;
function marketIn(ghost: HTMLElement, st: Stop): Ride {
  const el = document.createElement('div');
  el.className = 'mt-go mt-go-market';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<i class="mg-pan p1"></i><i class="mg-pan p2"></i><i class="mg-pan p3"></i>
    <div class="mg-stage">
      <div class="mg-shapes"><b class="mk-word w1">${'MARKET · '.repeat(10)}</b><b class="mk-word w2">${'OPEN ∞ 상점 · '.repeat(10)}</b>
        <i class="mk-dots"></i><i class="mk-coin"><b>∞</b></i><i class="mk-tag"></i><i class="mg-bars"></i></div>
      <div class="mk-shelf">${'<i><b></b></i>'.repeat(5)}</div>
      ${tkHtml(st.kick, st.name, st.en)}
    </div>`;
  document.body.appendChild(el);
  const $ = (q: string) => el.querySelector<HTMLElement>(q)!;
  const T = MK.run, SK = 'skewX(-14deg)';
  const anims: Animation[] = [];
  const pans = Array.from(el.querySelectorAll('.mg-pan'));
  pans.forEach((p, k) => anims.push(tl(p, T, [[k * 60, { transform: `translateX(118vw) ${SK}` }, SLAM], [260 + k * 70, { transform: `translateX(-44vw) ${SK}` }]])));
  anims.push(tl($('.mg-stage'), T, [[300, { opacity: 0 }], [360, { opacity: 1 }]]));
  anims.push(tl($('.mk-coin'), T, [[300, { transform: 'scale(.5) rotate(-40deg)' }, POP], [580, { transform: 'scale(1) rotate(0deg)' }, 'linear'], [T, { transform: 'scale(1) rotate(30deg)' }]]));
  anims.push(tl($('.mk-tag'), T, [[340, { transform: 'translate(30vw, -20vh) rotate(40deg)' }, SLAM], [600, { transform: 'translate(0, 0) rotate(14deg)' }, 'linear'], [T, { transform: 'translate(-2vw, 1vh) rotate(10deg)' }]]));
  anims.push(tl($('.mk-word.w1'), T, [[300, { transform: 'translateX(0)' }, 'linear'], [T, { transform: 'translateX(-55%)' }]])); // 글자 띠는 덮인 동안 계속 흐른다 (속도감)
  anims.push(tl($('.mk-word.w2'), T, [[300, { transform: 'translateX(-55%)' }, 'linear'], [T, { transform: 'translateX(0)' }]]));
  anims.push(tl($('.mk-dots'), T, [[320, { transform: 'scale(.6)', opacity: 0 }, SLAM], [560, { transform: 'scale(1)', opacity: 1 }]]));
  anims.push(tl($('.mg-bars'), T, [[380, { transform: 'scaleY(0)' }, SLAM], [600, { transform: 'scaleY(1)' }]]));
  anims.push(tl($('.mg-tk'), T, [[340, { transform: 'scale(1.22) rotate(-2deg)', opacity: 0 }, POP], [540, { transform: 'scale(1) rotate(-2deg)', opacity: 1 }]]));
  el.querySelectorAll('.mk-shelf b').forEach((b, k) => anims.push(tl(b, T, [[440 + k * 70, { opacity: 0, transform: 'scale(.3) rotate(-45deg)' }, POP], [540 + k * 70, { opacity: 1, transform: 'scale(1) rotate(0deg)' }]])));
  const quick = mkCount++ > 0;
  return { el, ghost, fresh: true, covered: anims[pans.length - 1].ready.then(() => new Promise<void>((res) => setTimeout(res, MK.cover))), anims, gone: false, hold: quick ? MK.holdQuick : MK.hold, leave: marketLeave, held: [], quick };
}
/** 상점 전환 걷기: 표에 구멍이 뚫리고(펀치) 잉크 · 민트 · 복숭아 순서로 패널이 왼쪽으로 빠진다 */
function marketLeave(r: Ride) {
  if (r.gone) return;
  r.gone = true;
  const el = r.el;
  el.classList.add('open');
  const q = r.quick ? .6 : 1; // 짧은 걷기 (두 번째 상점부터): 같은 순서 · 6할 시간
  const T = Math.round(620 * q), SK = 'skewX(-14deg)';
  r.anims.push(tl(el.querySelector('.mg-punch')!, T, [[0, { transform: 'scale(0)' }, POP], [100 * q, { transform: 'scale(1)' }]]));
  r.anims.push(tl(el.querySelector('.mg-tk')!, T, [[110 * q, { transform: 'scale(1) rotate(-2deg)', opacity: 1 }, OUTE], [330 * q, { transform: 'translateX(-46vw) skewX(18deg) rotate(-2deg)', opacity: 0 }]]));
  r.anims.push(tl(el.querySelector('.mg-stage')!, T, [[150 * q, { opacity: 1 }], [250 * q, { opacity: 0 }]]));
  el.querySelectorAll('.mg-pan').forEach((p, k) => { const at = (120 + (2 - k) * 55) * q; r.anims.push(tl(p, T, [[at, { transform: `translateX(-44vw) ${SK}` }, OUTE], [at + 360 * q, { transform: `translateX(-250vw) ${SK}` }]])); });
  release(r, 600);
  done(r, T + 40);
}

/** render() 가 화면을 그린 뒤: 전투 여부 · (메트로) 큰 화면 전환 */
export function onScreen(prev: string, next: string) {
  const b = next === 'battle';
  if (b !== busy) { busy = b; cur.layer?.setBusy(b); }
  if (ride?.fresh) {
    ride.fresh = false;
    // 사건 장면 · 역경 선택은 제 막 연출이 있다 → 덮개는 그리기 전에 거둔다.
    // 런 출발의 특권 막(메트로 = 행선 안내판)은 그대로 둔다: 덮인 동안 멈춰 두었다가, 걷히면 글자판이 넘어가며 카드가 놓인다 (holdUnder)
    if (document.querySelector('.adv, .dp-bg:not(.played)')) { endRide(); return; }
    holdUnder(ride);
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
const KICK: Record<BannerKind, string> = { battle: 'DEPARTURE', adversity: 'TURBULENCE', boss: 'EXPRESS · NON-STOP', phase: 'COURSE CHANGE' }; // 성간 여행 어휘 (2026-11-07 사용자 결정 C1 — 지하철 말 대신: RAPID → TURBULENCE · NO STOP → NON-STOP · LINE CHANGE → COURSE CHANGE)
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
/** 탑승권 (전투 진입 · 상점 · 런 출발 게이트): ADMIT ONE · 머리표 / 이름 / TO 부제 · 세로 바코드 · 걷힐 때 뚫리는 구멍 */
const tkHtml = (kick: string, title: string, sub: string) => `<div class="mg-tk"><div class="mg-tk-a"><span class="mg-k"><b>ADMIT ONE</b><i></i><span>${esc(kick)}</span></span><b class="mg-t">${esc(title)}</b>${sub ? `<span class="mg-r"><span>TO</span><b>${esc(sub)}</b><i></i></span>` : ''}</div><span class="mg-code"></span><i class="mg-punch"></i></div>`;
function goFull(kind: BannerKind, title: string, sub: string) {
  const boss = kind === 'boss', phase = kind === 'phase', warn = boss || kind === 'adversity';
  const short = !boss && !phase && ++goSeen > 2; // 반복되는 의식은 처음에만 길다: 세 번째 전투부터 짧게 (보스 · 페이즈는 그대로)
  const T = boss ? 1900 : phase ? 1350 : short ? 1060 : 1500;
  const OUT = boss ? 1340 : phase ? 900 : short ? 600 : 1000; // 패널이 걷히기 시작하는 때 (= 출발)
  const el = document.createElement('div');
  el.className = `mt-go mt-go-${kind}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const num = phase ? (title.match(/\d+/)?.[0] || '1').padStart(2, '0') : '';
  el.innerHTML = `<i class="mg-pan p1"></i><i class="mg-pan p2"></i><i class="mg-pan p3"></i>
    <div class="mg-stage">
      <div class="mg-shapes" aria-hidden="true"><i class="mg-disc"></i><i class="mg-quarter"></i><i class="mg-chev"></i><i class="mg-dots"></i><i class="mg-bars"></i>${warn ? '<i class="mg-hz t"></i><i class="mg-hz b"></i>' : ''}</div>
      ${phase ? `<b class="mg-num" aria-hidden="true">${num}</b>` : `<div class="mg-lights" aria-hidden="true">${'<i><b></b></i>'.repeat(5)}</div>`}
      ${tkHtml(KICK[kind], title, sub)}
    </div>`;
  document.body.appendChild(el);
  if (goGhost) { const g = goGhost; goGhost = null; setTimeout(() => g.remove(), 420); } // 패널 3장이 다 덮은 뒤 얼린 화면을 걷는다
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
    const step = boss ? 140 : short ? 55 : 95, first = boss ? 560 : short ? 260 : 430; // 짧은 판: 마지막 불이 출발(OUT) 전에 다 켜지게
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
  el.innerHTML = `<div class="mg-band"></div>${tkHtml(KICK[kind], title, sub)}`;
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
// 켜기에서는 가끔 먼 선로 위로 빛 열차(노선색 칸이 이어진 점선)가 지나간다. 전투 중엔 어둡게 · 느리게 (멈추지 않는다)
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
    setBusy(b) { isBusy = b; el.classList.toggle('busy', b); anims.forEach((x) => x.updatePlaybackRate(b ? 0.25 : 1)); }, // 전투 중 (일시 정지 포함): 숨기지 않고 어둡게 · 4분의 1 빠르기로 계속 흐른다 (보드 둘레에도 별 — 2026-11-06 피드백)
  };
}
