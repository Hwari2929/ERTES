// 단축키 · 반복 줄이기 설정 · 결과 자동 넘김 (main.ts 에서 분리)
import { deployed } from '../engine/build';
import * as R from '../engine/run';
import { type RunState } from '../types';
import { SPEEDS, app, esc, loadPrefs, root } from './state';
import { setSynHl, synFocus, synHl } from './hover';
import { act } from '../main';

// ───────────────────────── 단축키
export const CONFIRM_ACTS = ['alloc-ok', 'pick-aug', 'after-battle', 'field-ok', 'notice-ok', 'skip-aug', 'menu-close', 'pick-recruit', 'supply-all', 'supply-done'];
export function clickFirst(sel: string) {
  const el = Array.from(document.querySelectorAll<HTMLButtonElement>(sel)).find((b) => !b.disabled);
  if (!el) return false;
  el.click();
  return true;
}
/** 단축키 표: 키 처리(keydown) · 버튼 모서리 키캡(keyHints) · 메뉴의 단축키 목록(keyList)이 모두 이 표를 읽는다 */
export type KeyScope = 'modal' | 'battle' | 'prep' | 'map' | 'newrun' | 'any';
export interface HotKey {
  scope: KeyScope;
  /** e.key (글자는 소문자) */
  keys: string[];
  /** 키캡 글자. '#' = 숫자키 (선택지 · 노드 · 속도 순서) */
  cap: string;
  /** 누를 버튼: 앞에서부터 찾아 처음 누를 수 있는 것 (키캡도 그 버튼에) */
  sel: string[];
  /** 버튼을 누르는 대신 할 일 (n = 숫자키). 이때 키캡은 sel 의 버튼 모두에 */
  run?: (n: number) => void;
  /** 누를 버튼이 없어도 브라우저 기본 동작(스크롤 등)을 막는다 */
  always?: boolean;
  desc: string;
}
export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** 창의 선택지 (숫자키 순서). 영입은 카드가 선택지 ('영입' 버튼은 확정) */
export const PICK_SEL = '[data-a^="pick-"]:not(.aug-ok):not([data-a="pick-recruit"]), [data-a="event-choice"], [data-a="alloc-pick"], .rc-track .pcard[data-a="rc-tap"]';
export const HOTKEYS: HotKey[] = [
  { scope: 'any', keys: ['d'], cap: 'D', sel: ['[data-a="toggle-detail"]'], run: () => act('toggle-detail', ''), desc: '상세 보기 켜기 · 끄기' },
  { scope: 'modal', keys: DIGITS, cap: '#', sel: [PICK_SEL], desc: '선택지 고르기 (증강 · 전공 · 영입은 숫자키로 고르면 바로 확정)' },
  { scope: 'modal', keys: ['Enter', ' '], cap: 'Enter', sel: [CONFIRM_ACTS.map((a) => `.modal [data-a="${a}"]`).join(', ')], desc: '확인 · 계속' },
  { scope: 'modal', keys: ['r'], cap: 'R', sel: ['.modal [data-a="reroll"], .modal [data-a="reroll-privilege"], .modal [data-a="reroll-despair"]'], desc: '새로고침' },
  { scope: 'map', keys: DIGITS, cap: '#', sel: ['.tl-step.cur .tl-node', '.rt-n.cur'], desc: '다음 노드 고르기' },
  { scope: 'map', keys: ['Enter', ' '], cap: 'Enter', sel: ['.tl-go'], desc: '노드 진입' },
  { scope: 'map', keys: ['m'], cap: 'M', sel: [], run: () => act('manage', ''), desc: '편성 관리 (단추 없이 키로만)' },
  { scope: 'newrun', keys: ['r'], cap: 'R', sel: ['[data-a="reroll-starters"]'], desc: '후보 새로고침' },
  { scope: 'prep', keys: [' ', 'Enter'], cap: 'Space', sel: ['[data-a="fight"]'], desc: '전투 시작' },
  { scope: 'prep', keys: ['a'], cap: 'A', sel: ['[data-a="autofill"]'], run: () => act('autofill', ''), desc: '자동 배치' },
  { scope: 'battle', keys: DIGITS.slice(0, SPEEDS.length), cap: '#', sel: ['.speed [data-a="speed"]'], run: (n) => act('speed', String(SPEEDS[n - 1])), desc: `속도 ${SPEEDS.join(' · ')}배` },
  { scope: 'battle', keys: ['Enter'], cap: 'Enter', sel: ['[data-a="after-battle"]', '[data-a="skip"]'], always: true, desc: '결과로 · 결과 창 닫기' },
  { scope: 'battle', keys: [' ', 'p'], cap: 'Space', sel: ['[data-a="after-battle"]', '.speed [data-a="pause"]'], always: true, desc: '일시 정지 · 계속' },
];
/** 지금 단축키가 듣는 곳: 창(전투 화면 밖) · 전투 · 편성 · 지도 */
export function keyScope(): { scope: KeyScope; box: ParentNode } | null {
  const modal = document.querySelector('.modal-bg .modal');
  if (modal && app.screen !== 'battle') return { scope: 'modal', box: modal };
  return app.screen === 'battle' || app.screen === 'prep' || app.screen === 'map' || app.screen === 'newrun' ? { scope: app.screen, box: document } : null;
}
export function firstOn(sels: string[]) {
  for (const s of sels) { const el = Array.from(document.querySelectorAll<HTMLButtonElement>(s)).find((b) => !b.disabled); if (el) return el; }
  return null;
}
/** 버튼 모서리 키캡: 지금 화면에서 단축키가 누를 버튼에 data-key (CSS ::before 가 그린다). 설정에서 끄면 달지 않고, 터치 화면은 CSS 가 숨긴다 */
export function keyHints() {
  root.querySelectorAll('[data-key]').forEach((x) => x.removeAttribute('data-key'));
  if (!uxPrefs().keyHints || (typeof matchMedia !== 'undefined' && matchMedia('(hover: none), (pointer: coarse)').matches)) return;
  const ks = keyScope();
  const mark = (el: Element | null | undefined, cap: string) => { if (el instanceof HTMLElement && !el.dataset.key && !el.querySelector('kbd')) el.dataset.key = cap; };
  for (const h of HOTKEYS) {
    if (h.scope !== 'any' && h.scope !== ks?.scope) continue;
    if (h.cap === '#') Array.from((ks?.box || document).querySelectorAll(h.sel[0])).slice(0, h.keys.length).forEach((el, i) => mark(el, String(i + 1)));
    else if (h.run) h.sel.forEach((s) => document.querySelectorAll(s).forEach((el) => mark(el, h.cap)));
    else mark(firstOn(h.sel), h.cap);
  }
}
/** 메뉴의 단축키 목록 (단축키 표에서) */
export function keyList() {
  const NAME: Record<KeyScope, string> = { modal: '선택 창', map: '지도', prep: '편성', battle: '전투', newrun: '계약 기물 선택', any: '어디서나' };
  const cap = (k: string) => `<kbd>${k === ' ' ? 'Space' : k === 'Escape' ? 'Esc' : k.length === 1 ? k.toUpperCase() : k}</kbd>`;
  const keys = (h: HotKey) => (h.cap === '#' ? `${cap(h.keys[0])}~${cap(h.keys[h.keys.length - 1])}` : h.keys.map(cap).join(' '));
  return `<ul class="keys small">${(['modal', 'newrun', 'map', 'prep', 'battle', 'any'] as const).map((s) => `<li><b>${NAME[s]}</b> ${[...HOTKEYS.filter((h) => h.scope === s).map((h) => `${keys(h)} ${esc(h.desc)}`), ...(s === 'any' ? [`${cap('Escape')} 닫기 · 선택 해제`] : [])].join(' / ')}</li>`).join('')}</ul>`;
}

// ───────────────────────── 반복 줄이기 설정 (이 브라우저에만): 결과 창 자동 닫기(초, 0 = 끔) · 편성 그대로 바로 전투 · 단축키 키캡. 기본값은 모두 꺼짐 (키캡만 켜짐)
export const AUTO_RESULT = [0, 3, 5, 8];
export function uxPrefs() {
  const p: Record<string, unknown> = loadPrefs();
  return { autoResult: AUTO_RESULT.includes(p.autoResult as number) ? (p.autoResult as number) : 0, autoFight: p.autoFight === true, keyHints: p.keyHints !== false };
}
export function uxSettings() {
  const u = uxPrefs();
  return `<h3>진행 · 단축키</h3>
      <div class="pref pref-wrap"><span><b>결과 창 자동으로 닫기</b><br><span class="muted small">전투 결과 창을 정한 시간 뒤 저절로 닫습니다. 창을 누르거나 스크롤하면 멈춥니다. 런이 끝난 결과는 닫지 않고, 보상 · 증강 · 영입 · 상점처럼 고를 것이 있는 창은 언제나 기다립니다.</span></span>
        <span class="seg">${AUTO_RESULT.map((s) => `<button class="btn tiny ${u.autoResult === s ? 'on' : ''}" data-a="pref-autores" data-v="${s}" aria-pressed="${u.autoResult === s}">${s ? `${s}초` : '끄기'}</button>`).join('')}</span></div>
      <label class="pref"><input type="checkbox" data-a="pref-autofight" ${u.autoFight ? 'checked' : ''}><span><b>편성 그대로 바로 전투</b><br><span class="muted small">지도에서 일반 전투 · 역경에 진입하면 편성 화면을 건너뛰고 지금 편성으로 바로 전투를 시작합니다. 보스 · 도전 전투, 빈 자리에 넣을 대기 기물이 있을 때, 고를 것이 남아 있을 때는 편성 화면에서 멈춥니다.</span></span></label>
      <label class="pref"><input type="checkbox" data-a="pref-keyhints" ${u.keyHints ? 'checked' : ''}><span><b>단축키 표시</b><br><span class="muted small">버튼 모서리에 키보드 단축키(Space · Enter · 1 등)를 작게 표시합니다. 터치 화면에서는 표시하지 않습니다. 전체 목록은 메뉴 탭에 있습니다.</span></span></label>`;
}
/** 편성 그대로 바로 전투: 일반 · 역경만, 고를 것이 없고 빈 자리에 넣을 대기 기물이 없을 때 */
export function autoFightOk(run: RunState) {
  const t = run.node?.type;
  if (!uxPrefs().autoFight || run.tutorial || run.pending.length || app.screen !== 'prep' || !run.node?.enc || (t !== 'battle' && t !== 'adversity')) return false;
  const dep = deployed(run);
  return dep.length > 0 && !(R.deployCap(run) > dep.length && run.units.some((u) => !u.pos && R.canDeploy(run, u)));
}
/** 결과 창: 다시 그리지 않고 끼워 넣으므로 뜨는 순간을 지켜보다가 키캡을 다시 달고 자동 닫기를 건다 */
export let autoResFor: unknown = null;
export let autoResT = 0;
export const resultObs = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { if (app.summary && app.summary !== autoResFor && root.querySelector('.modal.result')) resultShown(); });
export function resultShown() {
  keyHints();
  const s = app.summary, box = root.querySelector<HTMLElement>('.modal.result');
  if (!s || !box || autoResFor === s) return;
  autoResFor = s;
  resultObs?.disconnect();
  const sec = uxPrefs().autoResult;
  const btn = box.querySelector<HTMLButtonElement>('[data-a="after-battle"]');
  if (!sec || !btn || s.gameOver || app.run?.tutorial) return; // 런이 끝난 결과 · 튜토리얼은 기다린다
  const tag = document.createElement('span');
  tag.className = 'auto-cd';
  btn.before(tag);
  let left = sec;
  const show = () => { tag.textContent = `${left}초 뒤 자동으로 닫힘`; };
  show();
  clearInterval(autoResT);
  autoResT = window.setInterval(() => {
    if (!btn.isConnected || app.summary !== s) { clearInterval(autoResT); autoResT = 0; return; }
    if (--left > 0) { show(); return; }
    clearInterval(autoResT); autoResT = 0;
    btn.click();
  }, 1000);
  const hold = () => { if (!autoResT) return; clearInterval(autoResT); autoResT = 0; tag.textContent = '자동 닫기 멈춤'; };
  for (const ev of ['pointerdown', 'wheel', 'touchstart'] as const) box.addEventListener(ev, hold, { once: true, passive: true });
}
/** 다시 그린 뒤: 키캡 · 결과 창 감시 · 시너지 강조 되살리기 */
export function uxAfterRender() {
  document.querySelector('.tl-pop')?.remove();
  keyHints();
  resultObs?.disconnect();
  if (app.screen === 'battle') {
    if (root.querySelector('.modal.result')) resultShown();
    else resultObs?.observe(root, { childList: true, subtree: true });
  }
  if (synHl && synHl.how !== 'hover') synFocus(synHl.id, synHl.how); else setSynHl(null);
  tlOver();
}
/** 지도 트랙이 넘쳐 가로로 밀리면 보스 칸을 오른쪽 끝에 붙인다 (.tl.over) */
export function tlOver() {
  const tl = root.querySelector<HTMLElement>('.tl');
  if (tl) tl.classList.toggle('over', tl.scrollWidth > tl.clientWidth + 1);
}
