// 증강 · 보상 카드 공개 연출 (소리 없음 — 공개음은 sound.ts reveal). 등급은 공개음과 같은 3단계 판정:
//   1 일반 — 조용히 (창 · 카드의 기존 등장만)
//   2 희귀 — 테두리 광 + 빛 훑기 + 살짝 튀어나옴 (희귀 장비 · 전역 · 특권 증강 · 8등급 이상 · 학파 선택)
//   3 최상 — 위 + 카드 뒤 빛 줄기 + 화면 플래시 (창 하나에 한 번) + 카드 흔들림 (전설 장비 · ◆ 변형 증강 · 12등급 이상)
// 카드의 기존 등장 애니메이션(이타카 물결 등장 · 전역 증강 뒤집기 · 특권 막)이 끝난 뒤에 시작하고,
// 그 애니메이션의 transform 을 건드리지 않도록 개별 속성(translate · scale)과 덧붙인 요소로만 움직인다. 입력은 막지 않는다
// (숫자키 즉시 확정으로 창이 닫히면 연출도 그대로 끝남). 움직임 줄이기에서는 정적인 등급 테두리만 남긴다.
import type { Pending } from '../types';
import { itemInfo } from '../data/items';
import { isTransformAug } from '../data/schools';

type Grade = 1 | 2 | 3;
const tierGrade = (id: string): Grade => { const t = itemInfo(id).tier; return t === 'L' ? 3 : t === 'A' ? 2 : 1; };
/** 증강 묶음의 달성 등급 몫 (sound.ts reveal 과 같은 기준: 12등급 이상 3 · 8등급 이상 또는 학파 선택 2) */
const rankGrade = (p: Extract<Pending, { t: 'rankup' }>): Grade => (p.rank >= 12 ? 3 : p.kind === 'school' || p.rank >= 8 ? 2 : 1);

/** 선택지 하나의 등급: 장비는 제 등급, 증강은 ◆ 변형이면 3 · 아니면 달성 등급 몫, 전역 · 특권은 2 */
function gradeOf(p: Pending, i: number): Grade {
  if (p.t === 'itemPick') return tierGrade(p.options[i]);
  if (p.t === 'global' || p.t === 'privilege') return 2;
  if (p.t === 'rankup') return isTransformAug(p.options?.[i]?.id || '') ? 3 : rankGrade(p);
  return 1;
}
/** 창 안의 선택 카드 (선택지 순서대로). 영입 · 축복은 등급 1 이라 연출 없음 */
function cardsOf(md: HTMLElement, p: Pending): HTMLElement[] {
  const q = (a: string) => Array.from(md.querySelectorAll<HTMLElement>(`[data-a="${a}"]`));
  if (p.t === 'itemPick') return q('pick-item');
  if (p.t === 'global') { const els = q('pick-global'); return p.options.map((id) => els.find((e) => e.dataset.v === id)).filter((e): e is HTMLElement => !!e); }
  if (p.t === 'privilege') return q('pick-privilege');
  if (p.t === 'rankup' && p.allocDone && p.options?.length) return q('pick-augsel');
  return [];
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** 이 요소의 유한한 애니메이션이 모두 끝날 때까지 (무한 반복은 제외) */
const settle = (el: Element) => Promise.all(el.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number)).map((a) => a.finished.catch(() => undefined)));
/** 카드 뒤집기 (전역 증강의 deal-box): 뒤집기가 시작될 때까지 */
function flipped(box: Element | null) {
  if (!box || !box.classList.contains('deal-box') || box.classList.contains('flip')) return Promise.resolve();
  return new Promise<void>((res) => {
    const mo = new MutationObserver(() => { if (box.classList.contains('flip')) { mo.disconnect(); res(); } });
    mo.observe(box, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { mo.disconnect(); res(); }, 5000);
  });
}

/** 그릴 때마다 부른다: 등급 표식 (rv-2 · rv-3). fresh = 새로 뜬 창이면 카드가 다 나타난 뒤 공개 연출, 아니면 공개된 상태로 */
export function gradeCards(md: HTMLElement, p: Pending | undefined, fresh: boolean) {
  if (!p) return;
  const cards = cardsOf(md, p).map((el, i) => [el, gradeOf(p, i)] as const).filter(([, g]) => g > 1);
  for (const [el, g] of cards) el.classList.add(`rv-${g}`, ...(fresh ? [] : ['rv-on']));
  if (!fresh || !cards.length) return;
  if (reduced()) { for (const [el] of cards) el.classList.add('rv-on'); return; }
  void reveal(md, cards);
}
async function reveal(md: HTMLElement, cards: (readonly [HTMLElement, Grade])[]) {
  await frame(); // 같은 그리기에서 붙는 카드 뒤집기(deal-box) · 창 등장 클래스가 먼저 걸리게
  await settle(md);
  let flashed = false;
  cards.forEach(async ([el, g], i) => {
    await flipped(el.parentElement);
    await frame();
    await settle(el);
    await wait(i * 70);
    if (!el.isConnected) return;
    el.classList.add('rv-on');
    burst(el, g, g === 3 && !flashed);
    if (g === 3) flashed = true;
  });
}

/** 공개 순간 한 번 */
function burst(el: HTMLElement, g: Grade, flash: boolean) {
  const add = (cls: string, host: Element) => { const d = document.createElement('i'); d.className = `${cls} rv-${g}`; d.setAttribute('aria-hidden', 'true'); host.appendChild(d); return d; };
  const gone = (a: Animation, d: Element) => a.finished.then(() => d.remove(), () => d.remove());
  // 빛 훑기 (카드 안) · 살짝 튀어나옴 · 테두리 광 맥동
  const sh = add('rv-shine', el);
  gone(sh.animate([{ backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0' }], { duration: g === 3 ? 900 : 700, easing: 'ease-out' }), sh);
  el.animate([{ scale: '1' }, { scale: g === 3 ? '1.05' : '1.025', offset: 0.3 }, { scale: '1' }], { duration: 420, easing: 'cubic-bezier(.2, .9, .3, 1.2)' });
  el.animate([{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: `0 0 ${g === 3 ? 34 : 18}px ${g === 3 ? 6 : 2}px var(--rv-glow)`, offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], { duration: g === 3 ? 1400 : 1000, easing: 'ease-out' });
  if (g < 3) return;
  // 카드 흔들림 (개별 translate: 테마 등장 애니메이션의 transform 과 겹치지 않음)
  el.animate([{ translate: '0 0' }, { translate: '-5px 2px' }, { translate: '5px -2px' }, { translate: '-4px 1px' }, { translate: '3px -1px' }, { translate: '-1px 0' }, { translate: '0 0' }], { duration: 420, delay: 80, easing: 'ease-out' });
  // 카드 뒤 빛 줄기: 카드가 든 줄(격자) 안, 카드 밑에 깐다. 가로로 긴 증강 줄은 왼쪽 아이콘 쪽에서
  const host = el.parentElement;
  if (host) {
    host.classList.add('rv-host');
    const ray = add('rv-rays', host);
    const wide = el.offsetWidth > el.offsetHeight * 2.5;
    const s = wide ? Math.max(260, el.offsetHeight * 3.2) : Math.max(el.offsetWidth, el.offsetHeight) * 2.1;
    ray.style.left = `${el.offsetLeft + (wide ? 44 : el.offsetWidth / 2)}px`; ray.style.top = `${el.offsetTop + el.offsetHeight / 2}px`;
    ray.style.width = ray.style.height = `${s}px`;
    gone(ray.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(30deg)', offset: 0.25 }, { opacity: 0.75, transform: 'translate(-50%, -50%) scale(1.05) rotate(70deg)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.1) rotate(95deg)' }], { duration: 2200, easing: 'cubic-bezier(.2, .7, .3, 1)' }), ray);
  }
  // 화면 플래시 (창 하나에 한 번, 카드 위치에서 퍼짐)
  const bg = flash && el.closest('.modal-bg');
  if (!bg) return;
  const b = el.getBoundingClientRect();
  const f = add('rv-flash', bg);
  f.style.setProperty('--x', `${b.left + b.width / 2}px`); f.style.setProperty('--y', `${b.top + b.height / 2}px`);
  gone(f.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' }), f);
}
