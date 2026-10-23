// 브리핑 수신 (계약 서명 → 명부): 카메라가 태블릿 화면 속으로 들어간 뒤의 화면. 흐린 전장 그림 · 의뢰 제목 · 진행 바 · 상태문 티커.
// 진행 바는 시간이 아니라 상태문 줄 수에 묶는다 — 줄마다 한 칸, 마지막 줄이 끝나면 100% (누르면 남은 줄이 한꺼번에 찬다).
// 상태문의 인물 = 이번 후보 기물(app.pool) = 곧 떨어질 카드. 끝나면 전장 그림이 위로 올라가 명부 머리 띠가 되고(도킹) 카드가 떨어진다.
// 전장 그림은 확산 모델이 단계를 밟아 그림을 추정하듯 노이즈가 걷히며 드러난다 (브리핑 줄마다 몇 단계, 도킹하며 끝까지).
// 첫 계약 3초 안쪽 (5줄), 단골 1줄 1초. 태블릿 모눈과 같은 간격 · 같은 자리에서 시작해 16px 로 가라앉는다 (카메라 컷의 이음새).
import { BRIEF_LINES } from '../data/briefing';
import { UNIT_BY_ID } from '../data/units';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 태블릿 모눈이 컷 순간 화면에 놓인 자리 (원점 · 간격 px) */
export interface Grid { x: number; y: number; s: number }
/** 지금 브리핑: 켜짐 · 상태문 · 보인 줄 수 · 모눈 · 단골 · 타이머 시작 여부 */
export const BR = { on: false, lines: [] as string[], shown: 0, grid: null as Grid | null, vet: false, started: false };
const timers: number[] = [];
/** 노이즈 해소: 전체 단계 · 브리핑이 끝날 때까지 밟는 단계 · 한 단계 간격(ms) */
const DN = { n: 20, brief: 4, ms: 90 };
let dn: { cv: HTMLCanvasElement; img: HTMLImageElement; k: number; goal: number; tick: number } | null = null;
const T = { first: 380, step: 520, tail: 420, vetFirst: 150, vetTail: 850, dock: 720 }; // ms

/** 브리핑을 준비한다 (명부를 그리기 전에): 후보 기물마다 상태문 한 줄씩, 같은 브리핑에서 같은 줄 · 같은 인물을 되풀이하지 않는다 */
export function briefBegin(pool: string[], vet: boolean, grid: Grid | null) {
  const ids = [...pool];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const n = vet ? 1 : Math.min(5, ids.length), lines: string[] = [];
  for (const id of ids) {
    if (lines.length >= n) break;
    const u = UNIT_BY_ID[id], opts = BRIEF_LINES[id] || [];
    if (!u || !opts.length) continue;
    lines.push(`${u.name} — ${opts[Math.floor(Math.random() * opts.length)]}`);
  }
  timers.forEach((t) => clearTimeout(t));
  timers.length = 0;
  dnStop();
  Object.assign(BR, { on: lines.length > 0, lines, shown: 0, grid: reduced() ? null : grid, vet, started: false });
}

/** 명부 머리 띠 (전장 그림 · 의뢰 제목 · 자주 나오는 적 · 유리한 시너지). 머리 줄 오른쪽 칸. 브리핑 중이면 화면을 가득 채운 '태블릿 속' 이고, 끝나면 이 자리로 올라와 붙는다 */
export function bandHtml(o: { art: string; color: string; title: string; place: string; info: string }) {
  const g = BR.on && BR.grid ? `;--gx:${BR.grid.x.toFixed(1)}px;--gy:${BR.grid.y.toFixed(1)}px;--gs:${BR.grid.s.toFixed(2)}px` : '';
  const n = BR.lines.length;
  const brief = BR.on
    ? `<div class="nr-brief" role="status" aria-live="polite">
        <div class="nr-brief-bar" aria-label="브리핑 ${BR.shown}/${n}줄"><i style="--p:${n ? BR.shown / n : 0}"></i></div>
        <ol class="nr-brief-tk">${BR.lines.map((l, i) => `<li${i < BR.shown ? ' class="on"' : ''}>${esc(l)}</li>`).join('')}</ol>
      </div>`
    : '';
  return `<div class="nr-bandslot"><header class="nr-band" style="--fc:${o.color}${g}">
    <i class="nr-band-art" style="background-image:url('${o.art}')" aria-hidden="true"></i><i class="nr-band-shade" aria-hidden="true"></i><i class="nr-band-bp" aria-hidden="true"></i>
    <div class="nr-band-info">${o.info}</div>
    <div class="nr-band-tx">${BR.on ? '<span class="nr-band-k">브리핑 수신</span>' : ''}<h2 class="nr-band-t">「${esc(o.title)}」 <small>${esc(o.place)}</small></h2></div>
    ${brief}
  </header></div>`;
}

/** 그린 뒤: 브리핑이면 상태문을 한 줄씩 흘리고(진행 바 = 줄 수), 다 흐르면 도킹한다. 다시 그려져도 이어 간다 (DOM 은 그때그때 찾는다) */
export function briefMount(root: HTMLElement) {
  const nr = root.querySelector<HTMLElement>('main.nr.brief');
  if (!nr || !BR.on) return;
  nr.addEventListener('click', skip);
  requestAnimationFrame(() => nr.classList.add('settle')); // 태블릿 모눈 간격에서 16px 로 가라앉고, 흐린 전장 그림이 비쳐 든다
  dnAttach(nr);
  if (BR.started) { paint(); return; }
  BR.started = true;
  const n = BR.lines.length, first = BR.vet ? T.vetFirst : T.first, step = BR.vet ? 0 : T.step;
  for (let k = 1; k <= n; k++) timers.push(window.setTimeout(() => show(k), first + (k - 1) * step));
  timers.push(window.setTimeout(dock, first + (n - 1) * step + (BR.vet ? T.vetTail : T.tail)));
}
/** k 줄까지 보이기 (진행 바도 k/n) */
function show(k: number) { BR.shown = k; paint(); }
function paint() {
  const nr = document.querySelector<HTMLElement>('main.nr.brief');
  if (!nr) return;
  const n = BR.lines.length;
  nr.querySelectorAll('.nr-brief-tk li').forEach((li, i) => li.classList.toggle('on', i < BR.shown));
  const bar = nr.querySelector<HTMLElement>('.nr-brief-bar');
  bar?.querySelector('i')?.style.setProperty('--p', String(n ? BR.shown / n : 0));
  bar?.setAttribute('aria-label', `브리핑 ${BR.shown}/${n}줄`);
  if (BR.vet) bar?.classList.add('slow'); // 단골: 한 줄을 1초에 걸쳐 채운다
  if (dn) dn.goal = Math.max(dn.goal, Math.round((n ? BR.shown / n : 1) * DN.brief));
}
/** 누르면 남은 줄이 한꺼번에 차고 곧 도킹한다 */
function skip() {
  if (!BR.on || document.querySelector('main.nr.docking')) return;
  timers.forEach((t) => clearTimeout(t));
  timers.length = 0;
  show(BR.lines.length);
  timers.push(window.setTimeout(dock, 260));
}
/** 도킹: 화면을 채운 띠가 명부 머리 자리로 올라와 붙는다 (노이즈가 걷히고 폭이 준다) → 카드가 떨어진다 */
function dock() {
  const nr = document.querySelector<HTMLElement>('main.nr.brief');
  if (!nr) { BR.on = false; return; }
  const band = nr.querySelector<HTMLElement>('.nr-band'), slot = nr.querySelector<HTMLElement>('.nr-bandslot');
  if (dn) dn.goal = DN.n; // 남은 단계를 마저 밟는다 (도킹 · 카드 낙하와 함께, 끝나면 스스로 걷힌다)
  const done = () => {
    BR.on = false;
    nr.classList.remove('brief', 'settle', 'docking');
    nr.classList.add('drop');
    if (band) Object.assign(band.style, { top: '', left: '', width: '', height: '' });
    nr.querySelector('.nr-brief')?.remove();
    nr.querySelector('.nr-band-k')?.remove();
  };
  if (!band || !slot || reduced()) { done(); return; }
  const r = slot.getBoundingClientRect();
  nr.classList.add('docking');
  Object.assign(band.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  timers.push(window.setTimeout(done, T.dock));
}

/** 노이즈 해소 캔버스를 띠의 전장 그림 바로 위에 붙인다 (다시 그려져도 같은 캔버스 · 같은 단계로 이어 간다) */
function dnAttach(nr: HTMLElement) {
  const art = nr.querySelector<HTMLElement>('.nr-band-art');
  if (!art || reduced()) return;
  if (!dn) {
    const url = /url\(["']?(.*?)["']?\)/.exec(art.style.backgroundImage)?.[1];
    if (!url) return;
    const cv = document.createElement('canvas'), img = new Image();
    cv.className = 'nr-band-dn';
    cv.setAttribute('aria-hidden', 'true');
    dn = { cv, img, k: 0, goal: 0, tick: 0 };
    img.onload = () => dn?.img === img && dnDraw();
    img.src = url;
    dn.tick = window.setInterval(dnStep, DN.ms);
  }
  if (!dn.cv.isConnected) art.after(dn.cv);
}
/** 한 단계: 목표 단계까지 하나씩 밟고, 끝 단계를 그린 뒤에는 옅어지며 걷힌다 */
function dnStep() {
  if (!dn || !dn.img.complete || !dn.img.naturalWidth) return;
  if (dn.k < dn.goal) { dn.k++; dnDraw(); return; }
  if (dn.k >= DN.n) {
    const cv = dn.cv;
    dnStop();
    cv.classList.add('gone');
    window.setTimeout(() => cv.remove(), 300);
  }
}
function dnStop() {
  if (!dn) return;
  clearInterval(dn.tick);
  dn = null;
}
const scratch = typeof document !== 'undefined' ? [document.createElement('canvas'), document.createElement('canvas')] : [];
/** k 단계 그림 = 추정 그림(단계가 오를수록 해상도가 오른다 → 처음엔 흐린 색 덩어리) + 새 노이즈(단계가 오를수록 옅어진다) */
function dnDraw() {
  if (!dn) return;
  const { cv, img, k } = dn, p = k / DN.n, sig = Math.pow(1 - p, 1.4);
  const r = cv.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  const W = Math.round(Math.min(r.width, 760)), H = Math.max(2, Math.round((W * r.height) / r.width));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'), [lo, nz] = scratch;
  if (!g) return;
  // 전장 그림과 같은 자르기 (cover · 세로 42%)
  const iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(W / iw, H / ih), sw = W / sc, sh = H / sc;
  const f = 0.025 + 0.975 * p * p, lw = Math.max(3, Math.round(W * f)), lh = Math.max(2, Math.round(H * f));
  lo.width = lw; lo.height = lh;
  lo.getContext('2d')?.drawImage(img, (iw - sw) / 2, (ih - sh) * 0.42, sw, sh, 0, 0, lw, lh);
  g.globalAlpha = 1;
  g.imageSmoothingEnabled = true;
  g.drawImage(lo, 0, 0, W, H);
  if (sig < 0.01) return;
  const nw = Math.ceil(W / 2), nh = Math.ceil(H / 2), ng = nz.getContext('2d');
  if (!ng) return;
  nz.width = nw; nz.height = nh;
  const d = ng.createImageData(nw, nh), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    a[i] = (Math.random() + Math.random() + Math.random()) * 85;
    a[i + 1] = (Math.random() + Math.random() + Math.random()) * 85;
    a[i + 2] = (Math.random() + Math.random() + Math.random()) * 85;
    a[i + 3] = 255;
  }
  ng.putImageData(d, 0, 0);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = Math.min(1, sig * 1.1);
  g.drawImage(nz, 0, 0, W, H);
  g.globalAlpha = 1;
}
