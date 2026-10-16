// 테마 연출 (설정 → 테마 연출: 켜기 · 줄이기 · 끄기). 외부 이미지 없이 canvas · CSS 로만 그린다.
//   · 갤럭시: 화면 뒤(본문 아래) 별빛 층 — 천천히 흐르는 별 3층 · 반짝임 · 가끔 유성
//   · 호이슌: 화면 앞 벚꽃잎 — 흩날리는 꽃잎 · 1~2분마다 벚꽃 폭풍 · 누른 자리에서 흩날림 (꽃잎 상한 80)
//   · 이타카: 큰 화면 전환에 물결이 쓸고 지나가며 다음 화면이 드러난다 (런 시작 룰렛 · 특권 선택은 CSS 쪽)
//   · 빈티지: CSS 만 (가죽 결 · 스티치, style.css [data-ui-theme="vintage"][data-tfx])
// 움직임은 모두 Web Animations 의 transform · opacity 라 합성기에서 돌고 메인 스레드는 거의 쓰지 않는다
// (별 타일은 시작할 때 canvas 로 한 번만 그린다). 모든 층은 pointer-events: none 이라 입력을 막지 않는다.
// 움직임 줄이기 설정이면 정지 화면. 전투 중에는 별빛 층을 내리고, 꽃잎은 절반으로 줄인다 (onScreen).

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
/** render() 가 화면을 그린 뒤: 전투 여부 · (이타카) 큰 화면 전환 물결 */
export function onScreen(prev: string, next: string) {
  const b = next === 'battle';
  if (b !== busy) { busy = b; cur.layer?.setBusy(b); }
  if (cur.theme !== 'ithaca' || cur.level === 'off' || !prev || prev === next) return;
  // 전투 진입은 '전투 개시' 배너, 출격 연출 · 바는 그림 연출이 따로 있으므로 큰 화면끼리만
  if (!BIG.has(next) || !BIG.has(prev)) return;
  if (document.querySelector('.adv, .pv-bg:not(.played)')) return; // 사건 장면은 그림 연출이, 특권 선택은 자체 물결 막이 있다
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
const PETAL_CAP = 80;
const PETAL_C = ['#ffc3d9', '#ff9ec4', '#fff0f6'];
function petalLayer(level: FxLevel): Layer {
  const el = layerEl('tfx-petals');
  let isBusy = false, stopStorm = () => {}, rz = 0;
  const still = reduced();
  const count = () => el.childElementCount;
  const mark = () => { el.dataset.n = String(count()); }; // 측정용: 지금 떠 있는 꽃잎 수
  const base = () => Math.round((level === 'low' ? 12 : 30) * (isBusy ? 0.5 : 1));
  /** 꽃잎 하나 (요소 하나 = 합성 레이어 하나) */
  const petal = (cls = '') => {
    const o = document.createElement('b'), t = Math.random();
    if (cls) o.className = cls;
    o.style.cssText = `--s:${rnd(5, 9).toFixed(1)}px;--c:${PETAL_C[t < 0.55 ? 0 : t < 0.85 ? 1 : 2]};--a:${rnd(0.55, 0.85).toFixed(2)}`;
    el.appendChild(o);
    return o;
  };
  const tf = (x: number, y: number, r: number) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(0)}deg)`;
  // 평소 꽃잎: 좌우로 하늘거리며 위에서 아래로 천천히, 끝나면 처음부터 되풀이 (시작 지점은 제각각)
  const ambient = () => {
    const o = petal('amb'), W = innerWidth, H = innerHeight;
    const x = rnd(-20, W), vx = rnd(8, 26), vy = rnd(22, 48), dur = (H + 60) / vy, ph = rnd(0, 6.28), sw = rnd(1.8, 3.6), r0 = rnd(0, 360), spin = rnd(-60, 60);
    if (still) { o.style.transform = tf(x, rnd(0, H), r0); return; }
    const K = Math.ceil(dur / sw) * 2; // 흔들림 반 주기마다 한 점
    o.animate(Array.from({ length: K + 1 }, (_, k) => { const t = (k / K) * dur; return { transform: tf(x + vx * t + 7 * Math.sin(ph + (t / sw) * Math.PI), -30 + vy * t, r0 + spin * t + 40 * Math.sin(ph + (t / sw) * Math.PI)) }; }),
      { duration: dur * 1000, iterations: Infinity, iterationStart: Math.random(), easing: 'linear' });
  };
  const fillAmbient = () => {
    const a = el.querySelectorAll('.amb');
    for (let k = a.length - 1; k >= base(); k--) a[k].remove();
    for (let k = a.length; k < base(); k++) ambient();
    mark();
  };
  /** 한 번 날아가고 사라지는 꽃잎 (폭풍 · 누른 자리). 상한을 넘으면 만들지 않는다 */
  const fling = (pts: [number, number][], dur: number) => {
    if (count() >= PETAL_CAP) return;
    const o = petal(), r0 = rnd(0, 360), al = +o.style.getPropertyValue('--a');
    const a = o.animate(pts.map(([x, y], i) => ({ transform: tf(x, y, r0 + i * 35), opacity: i === pts.length - 1 ? 0 : al })), { duration: dur });
    a.onfinish = () => { o.remove(); mark(); };
  };
  // 누른 자리에서 흩날림: 위로 튀었다가 떨어지며 흩어진다 (클릭은 그대로 통과)
  const burst = (cx: number, cy: number) => {
    let x = cx + rnd(-6, 6), y = cy + rnd(-6, 6), vx = rnd(-140, 140), vy = rnd(-160, -40), b = rnd(0.5, 0.9);
    const pts: [number, number][] = [[x, y]];
    for (let s = 1; s <= 48; s++) { // 0.05초씩 2.4초
      if (b > 0) { vy += 13; vx *= 0.92; b -= 0.05; if (b <= 0) vy = Math.min(vy, rnd(30, 50)); }
      x += (vx + Math.sin(s * 0.065 + cx) * 14) * 0.05; y += vy * 0.05;
      if (s % 6 === 0) pts.push([x, y]);
    }
    fling(pts, 2400);
  };
  const indoor = () => !!document.querySelector('.bar, .adv'); // 바(실내) · 사건 장면: 꽃잎 층을 내리므로 터짐 · 폭풍도 쉰다
  const onDown = (e: PointerEvent) => {
    if (indoor()) return;
    const n = Math.min(level === 'low' ? 5 : 10, PETAL_CAP - count());
    for (let k = 0; k < n; k++) burst(e.clientX, e.clientY);
    mark();
  };
  // 벚꽃 폭풍: 켜기에서 무작위 1~2분마다 4초, 바람이 꽃잎을 몰고 지나간다 (전투 중엔 약하게)
  const storm = () => {
    if (indoor()) return;
    const W = innerWidth, H = innerHeight, extra = isBusy ? 20 : 45;
    el.animate([{ transform: 'none' }, { transform: 'translateX(110px)', offset: 0.5 }, { transform: 'none' }], { duration: 4000, easing: 'ease-in-out' });
    let k = 0;
    const tick = window.setInterval(() => {
      if (++k > 30) { clearInterval(tick); return; }
      for (let j = 0; j < 2 && count() < Math.min(PETAL_CAP, base() + extra); j++) {
        const x = rnd(-W * 0.25, W * 0.5), y = rnd(-60, H * 0.7), dx = rnd(900, 1400), dy = rnd(120, 300);
        fling([[x, y], [x + dx * 0.5, y + dy * 0.25], [x + dx, y + dy]], rnd(2600, 3800));
      }
      mark();
    }, 100);
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
