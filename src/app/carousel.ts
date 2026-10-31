// 시작 기물 캐러셀 · 탭 넘기기 · 카드 공개 (main.ts 에서 분리)
import { loadArt } from '../ui/portraits';
import { app, root } from './state';
import { blockClicks } from './drag';

// ───────────────────────── 시작 기물 캐러셀 (무한 순환)
export let carX: number | null = null;
export function setCarX(v: number | null) { carX = v; }
export function carSet(track: HTMLElement) {
  const cards = track.querySelectorAll<HTMLElement>(':scope > *');
  const n = cards.length / 3;
  return n ? cards[n].offsetLeft - cards[0].offsetLeft : 0;
}
/** 가운데 묶음 밖으로 나가면 같은 위치의 가운데 묶음으로 옮긴다 */
export function carWrap(track: HTMLElement) {
  const w = carSet(track);
  if (!w) return;
  if (track.scrollLeft < w * 0.5) track.scrollLeft += w;
  else if (track.scrollLeft > w * 1.5) track.scrollLeft -= w;
  carX = track.scrollLeft;
}
export function syncCardOpen() {
  root.querySelectorAll<HTMLElement>('.pcard').forEach((c) => {
    const on = !c.hasAttribute('aria-hidden') && c.dataset.v === app.cardOpen;
    c.classList.toggle('open', on);
    const b = c.querySelector('.pc-more');
    if (b) b.textContent = on ? '접기 ▼' : '상세 보기 ▲';
  });
}
/** 메인 화면 우측 탭: 좌우로 끌어 넘긴다 (손가락 · 마우스). 끄는 동안 트랙이 따라오고, 폭의 18% 이상 밀면 옆 탭으로 */
export function setMapTab(i: number) {
  app.mapTab = Math.max(0, Math.min(2, i));
  document.querySelectorAll<HTMLElement>('.st-track, .st-ink').forEach((el) => el.style.setProperty('--i', String(app.mapTab)));
  document.querySelectorAll('.st-tab').forEach((el, k) => el.setAttribute('aria-selected', String(k === app.mapTab)));
}
export function bindTabSwipe(view: HTMLElement) {
  const track = view.querySelector<HTMLElement>('.st-track')!;
  let g: { x: number; y: number; id: number; on: boolean } | null = null;
  let moved = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('input, .log')) { g = null; return; }
    g = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; moved = false;
  });
  view.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; } // 세로 스크롤은 그대로
      if (Math.abs(dx) < 10) return;
      g.on = true; moved = true;
      view.setPointerCapture(e.pointerId);
      track.style.transition = 'none';
    }
    const edge = (app.mapTab === 0 && dx > 0) || (app.mapTab === 2 && dx < 0) ? 0.3 : 1; // 끝 탭은 고무줄처럼
    track.style.transform = `translateX(calc(${-app.mapTab * 100}% + ${dx * edge}px))`;
  });
  const end = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, on = g.on;
    g = null;
    if (!on) return;
    track.style.transition = ''; track.style.transform = '';
    if (Math.abs(dx) > view.clientWidth * 0.18) setMapTab(app.mapTab + (dx < 0 ? 1 : -1));
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  // 끌어 넘긴 직후의 클릭은 무시 (기물 아이콘이 눌리지 않게)
  view.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
export let greatBusy = false; // 마이너 대성공 연출 중 (확정 연타 막기)
export function setGreatBusy(v: boolean) { greatBusy = v; }
export let artWarmed = false;
export function setArtWarmed(v: boolean) { artWarmed = v; }
/** 카드 공개: 뒷면으로 깔고, 안의 일러스트가 다 받아질 때까지(최대 4초) 기다렸다가 한 장씩 뒤집는다 */
export function revealCards(box: HTMLElement) {
  box.classList.add('deal-box');
  const urls = [...new Set(Array.from(box.querySelectorAll<HTMLImageElement>('img')).map((im) => im.getAttribute('src')!).filter(Boolean))];
  const t0 = performance.now();
  Promise.race([Promise.all(urls.map(loadArt)), new Promise((r) => setTimeout(r, 4000))]).then(() => {
    setTimeout(() => box.classList.add('flip'), Math.max(0, 380 - (performance.now() - t0)));
  });
}
export function setupCarousel() {
  const track = root.querySelector<HTMLElement>('.car-track');
  if (!track) return;
  track.style.scrollSnapType = 'none';
  track.scrollLeft = carX ?? carSet(track);
  track.style.scrollSnapType = '';
  let t: ReturnType<typeof setTimeout> | 0 = 0;
  track.addEventListener('scroll', () => { carX = track.scrollLeft; if (t) clearTimeout(t); t = setTimeout(() => carWrap(track), 120); }, { passive: true });
  bindCardDrag(track);
  let lock = 0;
  track.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 가로 스크롤은 그대로
    const desc = (e.target as HTMLElement).closest('.pc-desc') as HTMLElement | null;
    if (desc && desc.scrollHeight > desc.clientHeight + 2) return; // 설명 스크롤 우선
    e.preventDefault();
    const now = Date.now();
    if (now - lock < 250) return;
    lock = now;
    carStep(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}
/** 터치: 카드 하단(이름 · 시너지)을 위로 끌어올리면 설명 펼치기, 아래로 내리면 접기 */
export function bindCardDrag(track: HTMLElement) {
  let drag: { id: string; y: number; x: number } | null = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const top = (e.target as HTMLElement).closest('.pc-top');
    const card = top?.closest('.pcard') as HTMLElement | null;
    if (card?.dataset.v) drag = { id: card.dataset.v, y: e.clientY, x: e.clientX };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
    const open = dy < 0;
    if ((app.cardOpen === drag.id) !== open) { app.cardOpen = open ? drag.id : null; syncCardOpen(); }
    blockClicks(350);
    drag = null;
  });
  const end = () => { drag = null; };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
}
export function carStep(dir: number) {
  const track = root.querySelector<HTMLElement>('.car-track');
  const card = track?.querySelector<HTMLElement>(':scope > *');
  if (!track || !card) return;
  carWrap(track);
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  track.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
}
