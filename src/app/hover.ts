// 시너지 강조 · 지도 타임라인 팝업 · 키워드 설명 팝업 (main.ts 에서 분리)
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID } from '../data/units';
import { GLOSS } from '../data/abiltext';
import * as AB from '../ui/abil';
import { NODE_NAME, type NodeType, type SynergyId } from '../types';
import { app, esc, root } from './state';
import { NODE_ICON, setSynMore, synPopHtml } from './common';
import { ic, nodeHint, phaseBoss } from './map';

// ───────────────────────── 시너지 강조: 시너지 목록에 마우스를 올리면(누르면 시너지 창이 열려 있는 동안) 보드 · 대기열 · 파티에서 그 시너지 기물만 밝게
// 시너지 창의 '보드에서 강조' 버튼: 창을 닫고 강조만 남긴다 (터치 화면 · 창이 보드를 가릴 때). 다음에 어디든 누르면 풀린다
export let synHl: { id: string; how: 'hover' | 'pin' | 'stick' } | null = null;
export function setSynHl(v: typeof synHl) { synHl = v; }
export function synFocus(id: string | null, how: 'hover' | 'pin' | 'stick' = 'hover') {
  synHl = id ? { id, how } : null;
  root.querySelectorAll<HTMLElement>('.syn-hl').forEach((x) => { x.classList.remove('syn-hl'); x.style.removeProperty('--c'); });
  root.querySelectorAll('.syn-tk.syn-on').forEach((x) => x.classList.remove('syn-on'));
  const main = root.querySelector('main');
  const on = !!id && !!main?.querySelector('[data-syns]');
  main?.classList.toggle('syn-focus', on);
  if (!id || !on) return;
  const c = SYN_BY_ID[id as SynergyId]?.color;
  root.querySelectorAll<HTMLElement>('[data-syns]').forEach((el) => {
    if (!el.dataset.syns!.split(' ').includes(id)) return;
    el.classList.add('syn-hl');
    if (c) el.style.setProperty('--c', c);
  });
  root.querySelectorAll<HTMLElement>('.syn-tk [data-syn]').forEach((b) => { if (b.dataset.syn === id) b.closest('.syn-tk')!.classList.add('syn-on'); });
}

// ───────────────────────── 지도 타임라인: 노드를 누르면 유형 · 간단한 설명 팝오버 (터치 포함). 바깥을 누르거나 스크롤하면 닫힌다
export function tlPop(el: HTMLElement) {
  document.querySelector('.tl-pop')?.remove();
  const run = app.run, i = +(el.dataset.step ?? -1), o = el.dataset.node as NodeType | undefined;
  if (!run || i < 0 || !o || !NODE_NAME[o]) return;
  const far = i - run.step;
  const boss = o === 'boss' ? phaseBoss(run) : undefined;
  const who = o === 'recruit' && far < 0 && run.nodeUnits?.[i] ? UNIT_BY_ID[run.nodeUnits[i]]?.name : '';
  const tip = document.createElement('div');
  tip.className = `tl-pop n-${o}`;
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = `<b>${NODE_ICON[o]}${esc(NODE_NAME[o])}${who ? ` · ${esc(who)}` : ''}</b><small>${i + 1}번째 칸 · ${far < 0 ? '지난 칸' : far ? `${far}칸 뒤` : '지금'}</small>${boss ? `<span class="tp-boss">${esc(boss.name)}</span>` : ''}<span>${ic(esc(nodeHint(o)))}</span>`;
  document.body.appendChild(tip);
  const r = el.getBoundingClientRect(), w = Math.min(260, innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.bottom + 8 + tip.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - tip.offsetHeight - 8) : r.bottom + 8}px`;
}
// ───────────────────────── 미니 카드 상세 팝오버 (디자인 시스템 MiniCard — 카드에는 이름 · 설명 한 줄만, 전체 = 팝오버. 메트로만: 갤럭시 카드는 설명 전문을 그대로 싣는다).
//  마우스 = 가리키면 (떠나면 닫힘), 터치 = 첫 탭에 띄우고 카드를 고름 표시 · 같은 카드를 다시 탭 = 실행 (UI.md 11). 바깥 탭 · 스크롤 · Esc = 닫힘
let mnArmed = '';
const mnKey = (c: HTMLElement) => `${c.dataset.a}|${c.dataset.v}`;
export const mnOn = () => document.documentElement.dataset.uiTheme === 'metro';
export function mnTip(card: HTMLElement, pin = false) {
  const more = card.querySelector<HTMLElement>('.mn-more');
  if (!more) return;
  let tip = document.querySelector<HTMLElement>('.mn-tip');
  if (tip?.dataset.k === mnKey(card) && tip.classList.contains('pin') === pin) return;
  if (!tip) { tip = document.createElement('div'); tip.className = 'mn-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  tip.dataset.k = mnKey(card);
  tip.classList.toggle('pin', pin);
  tip.style.setProperty('--tc', getComputedStyle(card).getPropertyValue('--tc'));
  tip.innerHTML = more.innerHTML;
  const r = card.getBoundingClientRect(), w = Math.min(280, innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  const below = r.bottom + 10;
  tip.style.top = `${below + tip.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - tip.offsetHeight - 10) : below}px`;
}
export function mnHide() {
  document.querySelector('.mn-tip')?.remove();
  document.querySelectorAll('.card.mn.mn-armed').forEach((c) => c.classList.remove('on', 'mn-armed'));
  mnArmed = '';
}
/** 터치로 누른 미니 카드: 첫 탭 = 상세 팝오버 + 고름 표시 (true — 실행하지 않음), 같은 카드 다시 탭 = 닫고 실행 (false) */
export function mnTap(card: HTMLElement): boolean {
  const k = mnKey(card);
  if (mnArmed === k) { mnHide(); return false; }
  mnHide();
  mnArmed = k;
  card.classList.add('on', 'mn-armed');
  mnTip(card, true);
  return true;
}
// ───────────────────────── 키워드 설명 팝업 (PC 호버 · 모바일 탭)
export let kwPinned: HTMLElement | null = null;
export function pinKw(el: HTMLElement) { showKw(el); kwPinned = el; }
export function showKw(el: HTMLElement) {
  const k = el.dataset.kw!;
  const g = GLOSS[k] || (el.dataset.td ? { name: el.dataset.tt || '', desc: el.dataset.td } : undefined);
  if (!g) return;
  let tip = document.querySelector<HTMLElement>('.kw-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'kw-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  tip.innerHTML = `<b>${GLOSS[k] ? AB.kwIcon(k) : el.querySelector('.li')?.outerHTML || ''}${esc(g.name)}</b><span>${esc(g.desc)}</span>`;
  const r = el.getBoundingClientRect();
  const w = Math.min(260, innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const below = r.bottom + 6;
  tip.style.top = `${below + tip.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - tip.offsetHeight - 6) : below}px`;
}
export function hideKw() { document.querySelector('.kw-tip')?.remove(); kwPinned = null; if (synHl?.how === 'pin') synFocus(null); }
/** 시너지 상세 팝업: 마름모 옆에 띄운다 */
export function showSyn(el: HTMLElement) {
  hideKw();
  const tip = document.createElement('div');
  tip.className = 'kw-tip syn-pop';
  tip.style.setProperty('--c', SYN_BY_ID[el.dataset.syn as SynergyId]?.color || 'var(--accent)');
  tip.innerHTML = synPopHtml(el.dataset.syn!);
  document.body.appendChild(tip);
  placeSyn(tip, el);
  tip.querySelector('details.sp-more')?.addEventListener('toggle', (e) => { if (app.run) setSynMore((e.target as HTMLDetailsElement).open); placeSyn(tip, el); });
  kwPinned = el;
  synFocus(el.dataset.syn!, 'pin');
}
export function placeSyn(tip: HTMLElement, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const w = Math.min(300, innerWidth - 16);
  tip.style.width = `${w}px`;
  const right = r.right + 8 + w <= innerWidth - 8;
  tip.style.left = `${right ? r.right + 8 : Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const top = right ? r.top - 4 : r.bottom + 6;
  tip.style.top = `${Math.max(8, Math.min(top, innerHeight - tip.offsetHeight - 8))}px`;
}

// 전체 상세 팝업: 능력 상세는 스크롤하거나 바깥을 누르면 닫힘 (다시 그리지 않고 지움)
export let restoredAt = 0;
export function setRestoredAt(v: number) { restoredAt = v; }
export function closeUmPop() {
  if (!app.bigUnit || !app.abilPop) return;
  app.abilPop = null;
  root.querySelector('.um-pop')?.remove();
  root.querySelectorAll('.um .ab-click.on').forEach((x) => x.classList.remove('on'));
}
