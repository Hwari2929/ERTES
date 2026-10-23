// 브리핑 수신 (계약 서명 → 명부): 카메라가 태블릿 화면 속으로 들어간 뒤의 화면. 흐린 전장 그림 · 의뢰 제목 · 진행 바 · 상태문 티커.
// 진행 바는 시간이 아니라 상태문 줄 수에 묶는다 — 줄마다 한 칸, 마지막 줄이 끝나면 100% (누르면 남은 줄이 한꺼번에 찬다).
// 상태문의 인물 = 이번 후보 기물(app.pool) = 곧 떨어질 카드. 끝나면 전장 그림이 위로 올라가 명부 머리 띠가 되고(도킹) 영수 증서 칩이 찍히며 카드가 떨어진다.
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
  Object.assign(BR, { on: lines.length > 0, lines, shown: 0, grid: reduced() ? null : grid, vet, started: false });
}

/** 명부 머리 띠 (전장 그림 · 의뢰 제목 · 영수 증서 칩 · 자주 나오는 적 · 유리한 시너지). 머리 줄 오른쪽 칸. 브리핑 중이면 화면을 가득 채운 '태블릿 속' 이고, 끝나면 이 자리로 올라와 붙는다 */
export function bandHtml(o: { art: string; color: string; title: string; place: string; deed: string; info: string }) {
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
    <div class="nr-band-tx">${BR.on ? '<span class="nr-band-k">브리핑 수신</span>' : ''}<h2 class="nr-band-t">「${esc(o.title)}」 <small>${esc(o.place)}</small></h2>${o.deed}</div>
    ${brief}
  </header></div>`;
}

/** 그린 뒤: 브리핑이면 상태문을 한 줄씩 흘리고(진행 바 = 줄 수), 다 흐르면 도킹한다. 다시 그려져도 이어 간다 (DOM 은 그때그때 찾는다) */
export function briefMount(root: HTMLElement) {
  const nr = root.querySelector<HTMLElement>('main.nr.brief');
  if (!nr || !BR.on) return;
  nr.addEventListener('click', skip);
  requestAnimationFrame(() => nr.classList.add('settle')); // 태블릿 모눈 간격에서 16px 로 가라앉고, 흐린 전장 그림이 비쳐 든다
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
}
/** 누르면 남은 줄이 한꺼번에 차고 곧 도킹한다 */
function skip() {
  if (!BR.on || document.querySelector('main.nr.docking')) return;
  timers.forEach((t) => clearTimeout(t));
  timers.length = 0;
  show(BR.lines.length);
  timers.push(window.setTimeout(dock, 260));
}
/** 도킹: 화면을 채운 띠가 명부 머리 자리로 올라와 붙는다 (흐림이 걷히고 폭이 준다) → 영수 증서 칩이 찍히고 카드가 떨어진다 */
function dock() {
  const nr = document.querySelector<HTMLElement>('main.nr.brief');
  if (!nr) { BR.on = false; return; }
  const band = nr.querySelector<HTMLElement>('.nr-band'), slot = nr.querySelector<HTMLElement>('.nr-bandslot');
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
