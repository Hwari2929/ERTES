// 안내 말풍선 (코치 마크): 대상 UI 만 밝게 뚫고 나머지는 어둡게 막는다. 담당 인물 초상화 · 이름 · 말풍선 · [다음] · [튜토리얼 건너뛰기].
// render() 가 #app 을 통째로 다시 그려도 살아남도록 document.body 위에 따로 떠 있고, 매 프레임 대상을 다시 찾아 위치를 맞춘다.
// 대상이 없으면 말풍선을 가운데에 띄운다. 좁은 화면(≤700px)은 말풍선을 아래(대상이 아래쪽이면 위)에 붙인다.

export type CoachTarget = string | string[] | (() => Element | Element[] | null | undefined);
export interface CoachStep {
  /** 담당 인물 이름 · 초상화 · 이름표 색 */
  name: string; icon: string; color?: string;
  text: string;
  /** 강조할 요소. 선택자 배열은 앞에서부터 '보이는' 요소가 있는 첫 선택자 (선택자 하나에 여러 요소면 합친 영역) */
  target?: CoachTarget;
  /** 이 조건이 참일 때만 보인다 (아니면 숨겨 두고 기다림) */
  gate?: () => boolean;
  /** 대상이 나타날 때까지 숨긴다 */
  wait?: boolean;
  /** 참이 되면 다음 단계로 (처음부터 참이면 건너뜀) */
  until?: () => boolean;
  /** 직접 해야 넘어간다: [다음] 대신 안내 문구 (대상이 없으면 [다음]) */
  need?: boolean;
  /** 대기 중인 선택 창 위에서도 보인다 (기본은 창이 닫힐 때까지 숨김) */
  pend?: boolean;
  /** 처음 보일 때 한 번 */
  enter?: () => void;
}
export interface CoachOpts {
  key: string;
  steps: CoachStep[];
  /** 참이면 잠시 숨김 (step 은 지금 단계) */
  hold?: (s: CoachStep) => boolean;
  /** 숨겨져 있다가 보일 때 · 단계가 바뀌어 다시 보일 때 */
  onShow?: (i: number) => void;
  /** 보이다가 숨을 때 */
  onHide?: () => void;
  onDone: () => void;
  onSkip: () => void;
  /** 건너뛰기 링크 문구 (없으면 숨김) */
  skipLabel?: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PAD = 6;

let cur: {
  o: CoachOpts; el: HTMLElement; i: number; shown: boolean; entered: number; raf: number; sig: string; armed: boolean;
} | null = null;

export const coachKey = () => cur?.o.key ?? null;
/** 지금 말풍선이 화면에 보이는지 */
export const coachVisible = () => !!cur?.shown;

export function closeCoach() {
  if (!cur) return;
  cancelAnimationFrame(cur.raf);
  const wasShown = cur.shown, o = cur.o;
  cur.el.remove();
  cur = null;
  document.body.classList.remove('coaching');
  if (wasShown) o.onHide?.();
}

/** 보이는 요소만 (크기 0 · display:none 제외) */
function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function resolve(t: CoachTarget | undefined): Element[] {
  if (!t) return [];
  if (typeof t === 'function') {
    const v = t();
    return (Array.isArray(v) ? v : v ? [v] : []).filter(visible);
  }
  for (const q of Array.isArray(t) ? t : [t]) {
    let els: Element[] = [];
    try { els = Array.from(document.querySelectorAll(q)).filter(visible); } catch { /* 잘못된 선택자 */ }
    if (els.length) return els;
  }
  return [];
}
function unionRect(els: Element[]) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const e of els) {
    const x = e.getBoundingClientRect();
    l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
  }
  // 화면 안으로 자른다
  l = Math.max(0, l - PAD); t = Math.max(0, t - PAD); r = Math.min(innerWidth, r + PAD); b = Math.min(innerHeight, b + PAD);
  if (r - l < 8 || b - t < 8) return null;
  return { l, t, r, b };
}

export function startCoach(o: CoachOpts) {
  closeCoach();
  const el = document.createElement('div');
  el.className = 'coach';
  el.dataset.key = o.key;
  el.hidden = true;
  el.innerHTML = `<div class="co-dim" data-d="t"></div><div class="co-dim" data-d="b"></div><div class="co-dim" data-d="l"></div><div class="co-dim" data-d="r"></div>
    <div class="co-ring" aria-hidden="true"></div>
    <section class="co-bub" role="dialog" aria-live="polite" aria-label="안내">
      <header class="co-head"><img class="co-pt" alt=""><b class="co-nm"></b><span class="co-n"></span></header>
      <p class="co-tx"></p>
      <footer class="co-foot">${o.skipLabel === null ? '' : `<button type="button" class="co-skip">${esc(o.skipLabel || '튜토리얼 건너뛰기')}</button>`}<span class="co-hint"></span><button type="button" class="btn primary co-next">다음</button></footer>
    </section>`;
  document.body.appendChild(el);
  cur = { o, el, i: 0, shown: false, entered: -1, raf: 0, sig: '', armed: false };
  const c = cur;
  el.querySelector('.co-next')!.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  el.querySelector('.co-skip')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.currentTarget as HTMLButtonElement;
    if (!c.armed) { c.armed = true; b.textContent = '정말 건너뛸까요? 한 번 더 누르면 종료'; b.classList.add('armed'); setTimeout(() => { if (cur === c) { c.armed = false; b.textContent = o.skipLabel || '튜토리얼 건너뛰기'; b.classList.remove('armed'); } }, 4000); return; }
    closeCoach();
    o.onSkip();
  });
  // 어두운 곳을 누르면 말풍선을 살짝 흔들어 알려 준다
  el.querySelectorAll('.co-dim').forEach((d) => d.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    const bub = el.querySelector<HTMLElement>('.co-bub')!;
    bub.classList.remove('nudge'); void bub.offsetWidth; bub.classList.add('nudge');
  }));
  const loop = () => { if (cur !== c) return; tick(); c.raf = requestAnimationFrame(loop); };
  c.raf = requestAnimationFrame(loop);
}

function next() {
  const c = cur;
  if (!c) return;
  c.i++;
  c.sig = '';
  if (c.i >= c.o.steps.length) { closeCoach(); c.o.onDone(); return; }
  // 다음 단계는 다음 프레임에 채운다 (보이는 상태 유지: 전투 일시정지가 끊기지 않게)
}

function tick() {
  const c = cur!;
  const st = c.o.steps[c.i];
  // 이미 해냈으면 넘어간다 (처음부터 참이어도)
  if (st.until?.()) { next(); return; }
  let held = !!c.o.hold?.(st) || (st.gate ? !st.gate() : false);
  let tg = held ? [] : resolve(st.target);
  if (!held && st.wait && !tg.length) held = true;
  if (held) {
    if (c.shown) { c.shown = false; c.el.hidden = true; document.body.classList.remove('coaching'); c.o.onHide?.(); }
    return;
  }
  if (c.entered !== c.i) {
    c.entered = c.i;
    st.enter?.();
    tg = resolve(st.target);
    reveal(tg[0]);
    fill(c, st, tg.length > 0);
    if (c.shown) c.o.onShow?.(c.i);
  } else if (!c.shown) reveal(tg[0]); // 메뉴 · 창을 닫고 다시 보일 때: 그사이 굴러간 화면을 대상 쪽으로
  if (!c.shown) { c.shown = true; c.el.hidden = false; document.body.classList.add('coaching'); c.o.onShow?.(c.i); fill(c, st, tg.length > 0); }
  place(c, tg);
}

/** 대상을 화면 안으로 굴린다. 가까운 쪽으로 굴렸는데도 화면 밖이거나 고정 · 끈끈한 층(상단 바 등)에 덮여 있으면 가운데로.
 *  (좁은 화면은 한 줄로 길어져, 상단 바 밑에 숨은 대상을 '보인다'고 여기면 구멍 자리에 메뉴 버튼이 걸린다)
 *  사용자가 굴릴 수 없는 overflow: hidden 조상(탭 트랙 등)은 scrollIntoView 가 굴린 만큼 되돌린다 */
function reveal(t: Element | undefined) {
  if (!t?.scrollIntoView) return;
  const keep: [Element, number | null, number | null][] = [];
  for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.overflowX === 'hidden' || s.overflowY === 'hidden') keep.push([p, s.overflowX === 'hidden' ? p.scrollLeft : null, s.overflowY === 'hidden' ? p.scrollTop : null]);
  }
  t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (obscured(t)) t.scrollIntoView({ block: 'center', inline: 'nearest' });
  for (const [p, x, y] of keep) { if (x !== null) p.scrollLeft = x; if (y !== null) p.scrollTop = y; }
}
/** 대상이 화면 밖이거나, 보이는 부분 가운데를 고정 · 끈끈한 층(대상을 품지 않은)이 덮고 있는지 */
function obscured(t: Element) {
  const r = t.getBoundingClientRect();
  const l = Math.max(0, r.left), tp = Math.max(0, r.top), rr = Math.min(innerWidth, r.right), b = Math.min(innerHeight, r.bottom);
  if (rr - l < 4 || b - tp < 4) return true;
  for (const e of document.elementsFromPoint((l + rr) / 2, (tp + b) / 2)) {
    if (cur?.el.contains(e)) continue; // 안내 자신 (어두운 막 · 말풍선)
    if (e === t || t.contains(e)) return false;
    for (let p: Element | null = e; p && p !== document.body; p = p.parentElement) {
      if (p.contains(t)) return false;
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  }
  return false;
}

function fill(c: NonNullable<typeof cur>, st: CoachStep, hasTarget: boolean) {
  const el = c.el;
  const pt = el.querySelector<HTMLImageElement>('.co-pt')!;
  if (pt.getAttribute('src') !== st.icon) pt.src = st.icon;
  const nm = el.querySelector<HTMLElement>('.co-nm')!;
  nm.textContent = st.name;
  el.style.setProperty('--cc', st.color || 'var(--accent)');
  el.querySelector('.co-n')!.textContent = `${c.i + 1} / ${c.o.steps.length}`;
  el.querySelector('.co-tx')!.textContent = st.text;
  const needNow = !!st.need && hasTarget;
  const nb = el.querySelector<HTMLButtonElement>('.co-next')!;
  nb.hidden = needNow;
  nb.textContent = c.i === c.o.steps.length - 1 ? '확인' : '다음';
  el.querySelector('.co-hint')!.textContent = needNow ? '밝게 표시된 곳을 직접 눌러 보세요' : '';
}

/** 대상 안에서 누를 수 있는 것들 (말풍선이 가리면 안 되는 것) */
function clickables(tg: Element[]) {
  const out: DOMRect[] = [];
  for (const t of tg) for (const e of [t, ...Array.from(t.querySelectorAll('button:not([disabled]), [data-a], [data-drag], [data-drop], a[href]'))]) {
    if (e === t && !e.matches('button, [data-a], [data-drag], [data-drop], a[href]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push(r);
  }
  return out;
}
/** 말풍선 자리 (x, y, 폭, 높이) 가 가리는 정도: 누를 것 하나당 큰 점수 + 대상과 겹친 넓이 */
function cost(x: number, y: number, w: number, h: number, hot: DOMRect[], rect: { l: number; t: number; r: number; b: number } | null) {
  let n = 0;
  for (const r of hot) if (r.right > x && r.left < x + w && r.bottom > y && r.top < y + h) n++;
  const ov = rect ? Math.max(0, Math.min(rect.r, x + w) - Math.max(rect.l, x)) * Math.max(0, Math.min(rect.b, y + h) - Math.max(rect.t, y)) : 0;
  return n * 1e7 + ov;
}

function place(c: NonNullable<typeof cur>, tg: Element[]) {
  const rect = tg.length ? unionRect(tg) : null;
  const W = innerWidth, H = innerHeight;
  const bub = c.el.querySelector<HTMLElement>('.co-bub')!;
  const bw = bub.offsetWidth, bh = bub.offsetHeight;
  const mobile = W <= 700;
  // 대상 영역 · 화면 · 말풍선 크기가 그대로면 다시 계산하지 않는다
  const sig = `${rect ? `${rect.l | 0},${rect.t | 0},${rect.r | 0},${rect.b | 0}` : '-'}|${W}x${H}|${bw}x${bh}`;
  if (sig === c.sig) return;
  c.sig = sig;
  let bx = 0, by = 0, mode = 'center';
  const hot = rect ? clickables(tg) : [];
  if (mobile) {
    // 아래에 붙이되, 누를 것을 덜 가리는 쪽 (같으면 아래)
    mode = rect && cost(8, 8, W - 16, bh, hot, rect) < cost(8, H - bh - 8, W - 16, bh, hot, rect) ? 'top' : 'bottom';
  } else if (rect) {
    const gap = 12;
    const cx = (rect.l + rect.r) / 2 - bw / 2;
    if (rect.b + gap + bh <= H - 8) { by = rect.b + gap; bx = cx; mode = 'below'; }
    else if (rect.t - gap - bh >= 8) { by = rect.t - gap - bh; bx = cx; mode = 'above'; }
    else if (rect.r + gap + bw <= W - 8) { bx = rect.r + gap; by = (rect.t + rect.b) / 2 - bh / 2; mode = 'side'; }
    else if (rect.l - gap - bw >= 8) { bx = rect.l - gap - bw; by = (rect.t + rect.b) / 2 - bh / 2; mode = 'side'; }
    else { // 대상이 화면을 거의 덮으면 누를 것을 가장 덜 가리는 구석에
      const opts: [number, number][] = [[W - bw - 16, 16], [16, 16], [W - bw - 16, H - bh - 16], [16, H - bh - 16], [(W - bw) / 2, 16], [(W - bw) / 2, H - bh - 16]];
      [bx, by] = opts.reduce((best, o) => (cost(o[0], o[1], bw, bh, hot, rect) < cost(best[0], best[1], bw, bh, hot, rect) ? o : best));
      mode = 'corner';
    }
    bx = Math.max(8, Math.min(W - bw - 8, bx));
    by = Math.max(8, Math.min(H - bh - 8, by));
  }
  const d = (k: string) => c.el.querySelector<HTMLElement>(`.co-dim[data-d="${k}"]`)!.style;
  const ring = c.el.querySelector<HTMLElement>('.co-ring')!;
  if (rect) {
    Object.assign(d('t'), { left: '0px', top: '0px', width: `${W}px`, height: `${rect.t}px` });
    Object.assign(d('b'), { left: '0px', top: `${rect.b}px`, width: `${W}px`, height: `${Math.max(0, H - rect.b)}px` });
    Object.assign(d('l'), { left: '0px', top: `${rect.t}px`, width: `${rect.l}px`, height: `${rect.b - rect.t}px` });
    Object.assign(d('r'), { left: `${rect.r}px`, top: `${rect.t}px`, width: `${Math.max(0, W - rect.r)}px`, height: `${rect.b - rect.t}px` });
    Object.assign(ring.style, { left: `${rect.l}px`, top: `${rect.t}px`, width: `${rect.r - rect.l}px`, height: `${rect.b - rect.t}px` });
    ring.hidden = false;
  } else {
    Object.assign(d('t'), { left: '0px', top: '0px', width: `${W}px`, height: `${H}px` });
    for (const k of ['b', 'l', 'r']) Object.assign(d(k), { width: '0px', height: '0px' });
    ring.hidden = true;
  }
  bub.dataset.mode = mode;
  if (mode === 'center' || mobile) { bub.style.left = ''; bub.style.top = ''; }
  else { bub.style.left = `${bx}px`; bub.style.top = `${by}px`; }
}

// 말풍선이 떠 있는 동안 키보드: Enter · Space · → 는 [다음], 나머지 단축키는 막는다 (직접 해 보는 단계는 그대로 통과)
addEventListener('keydown', (e) => {
  if (!cur?.shown) return;
  const st = cur.o.steps[cur.i];
  const nb = cur.el.querySelector<HTMLButtonElement>('.co-next')!;
  if (st.need && nb.hidden) return;
  if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) next(); return; }
  if (e.key === 'Tab') return;
  e.stopImmediatePropagation();
}, true);
