// 업적 화면 조각: 달성 배너(화면 하단) · 메달 SVG · 도감 '업적' 탭 · 바 카운터 뒤 진열장.
// 이름 · 설명 · 등급 · 문양은 그릴 때마다 data/achievements.ts 에서 읽는다. 판정은 순수 함수(judge)에 사실 하나를 넘겨서 한다.
//   배너: 전설 증강 공개 연출과 같은 색 토큰(--g-L, revealfx 의 .rv-3 → --rv-c) · 공개음 reveal3 (sound.ts). 입력은 막지 않는다 (pointer-events: none)
//   여러 개가 한꺼번에 달성되면 차례로 하나씩 띄운다. 움직임 줄이기면 미끄러짐 · 빛 줄기 · 빛 훑기 없이 나타났다 사라진다.
//   메달: 등급별 금속 테두리(동 · 은 · 금 · 전설) + 업적별 문양 (synicons 선 아이콘 재사용 + 업적 전용 몇 개). 금속 색은 style.css :root 의 --ach-* 토큰
//   저장: 메타(meta.ts) achieved { id: 날짜 } · showcase [id × 최대 3]
import { ACH_BY_ID, ACH_GRADES, ACHIEVEMENTS, type AchDef, type AchFact, type AchGrade, GRADE_NAME, judge, SHOWCASE_MAX } from '../data/achievements';
import { battleFact, clearFact, countSkip, eventFact, metaFact, tutorialFact, useFact } from '../engine/achieve';
import type { Battle } from '../engine/combat';
import { recAch } from '../engine/report';
import { lastOutcome, type UseTarget } from '../engine/run';
import type { RunState } from '../types';
import { loadMeta, metaAchieve, metaShowcase, metaWatch } from './meta';
import * as SND from './sound';
import { lineIcon, synIcon, typeIcon } from './synicons';

const HAS = typeof document !== 'undefined';
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const got = () => loadMeta().achieved || {};
const reduced = () => HAS && typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ───────── 판정 훅 (main.ts 가 부른다)
let runOf: () => RunState | null = () => null;
/** 처음 한 번: 장면 건너뛰기 · 메타 기록 변화를 지켜보고, 이미 남은 기록으로 달성한 업적을 확인한다 */
export function achBind(getRun: () => RunState | null) {
  runOf = getRun;
  if (!HAS) return;
  document.addEventListener('adv-skip', (e) => countSkip(runOf(), String((e as CustomEvent).detail || '')));
  metaWatch(() => sweep());
  bindUi();
  setTimeout(sweep, 600); // 예전 기록(의뢰 성공 · 위험 등급 · 사건 · 만담)으로 이미 달성한 업적
}
/** 사실 하나를 판정해 새로 달성한 업적을 저장하고 배너를 띄운다 */
function unlock(f: AchFact) {
  if (runOf()?.lab) return; // 훈련장: 업적 판정 없음
  const ids = judge(f, got());
  if (!ids.length) return;
  const fresh = metaAchieve(ids, today());
  const run = runOf();
  if (run && fresh.length) recAch(run, fresh); // 전투 종료 보고서: 이번 런에 달성한 업적
  for (const id of fresh) enqueue(id);
}
let sweeping = false;
/** 메타 기록으로 판정하는 업적 (메타가 저장될 때마다) */
function sweep() {
  if (sweeping) return;
  sweeping = true;
  try { unlock(metaFact(loadMeta())); } finally { sweeping = false; }
}
/** 전투가 끝났을 때 (보상 처리 전) */
export const achBattle = (run: RunState, b: Battle) => unlock(battleFact(run, b));
/** 사건 선택지를 확정한 뒤 */
export const achEvent = (run: RunState, id: string, choice: number) => unlock(eventFact(run, id, choice, lastOutcome));
/** 의뢰 성공 (귀환 · 무한 모드 선택, metaClear 뒤) */
export const achClear = (run: RunState) => unlock(clearFact(run));
/** 튜토리얼이 끝났을 때 (종장까지 · 건너뜀) */
export const achTutorial = (run: RunState | null, kind: 'done' | 'skipped') => unlock(tutorialFact(run, kind === 'done'));
/** 소모품을 썼을 때 (성공한 경우만). item = 쓴 소모품 id */
export function achUse(run: RunState, item: string, tg: UseTarget) {
  const foe = tg.k === 'foe' ? tg.i : null;
  unlock(useFact(run, item, foe, foe !== null ? run.inventory[run.inventory.length - 1] ?? null : null));
}

// ───────── 메달 SVG (64 × 64). 그라디언트는 문서에 한 번만 깔고 (#ach-defs) 등급별로 같이 쓴다
const CX: Record<string, string> = {
  glass: '<path d="M4 4h16l-8 9z"/><path d="M12 13v7"/><path d="M8 20.5h8"/><path d="M15.5 4 18 1.5"/><circle cx="10" cy="7" r="1.2"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8.5 8h.01M8.5 12h.01M8.5 16h.01M15.5 8h.01M15.5 12h.01M15.5 16h.01" stroke-width="2.6"/>',
  cat: '<path d="M5 3.5l3.6 4h6.8L19 3.5V13a7 7 0 0 1-14 0z"/><path d="M9.3 12h.01M14.7 12h.01" stroke-width="2.6"/><path d="M10.5 15.5l1.5 1 1.5-1"/><path d="M2.5 14.5 6 15M2.5 17.5 6 16.5M21.5 14.5 18 15M21.5 17.5 18 16.5"/>',
  mask: '<path d="M4 8.5h16"/><path d="M7.5 8.5 8.3 3.5h7.4l.8 5"/><path d="M12 11c3 0 4.8 2 4.8 4.8 0 3.3-2.2 6-4.8 6s-4.8-2.7-4.8-6C7.2 13 9 11 12 11z"/>', // 얼굴 없는 중개인: 모자 아래 이목구비 없는 얼굴
  secret: '<path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1.1-1.2 2v.7"/><path d="M12 18h.01" stroke-width="2.8"/>',
};
const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
/** 문양 → [안쪽 SVG, 채움 여부] (24 × 24 격자) */
function motif(m: string): [string, 'line' | 'fill' | 'num'] {
  const [k, v] = [m.slice(0, m.indexOf(':')), m.slice(m.indexOf(':') + 1)];
  if (k === 'li') return [inner(lineIcon(v)), 'line'];
  if (k === 'syn') return [inner(synIcon(v)), 'line'];
  if (k === 'ty') return [inner(typeIcon(v)), 'fill'];
  if (k === 'num') return [`<text class="am-num" x="12" y="17.2" text-anchor="middle" font-size="14.5" font-weight="900" stroke="currentColor" stroke-width=".5" stroke-linejoin="round">${esc(v)}</text>`, 'num'];
  return [CX[v] || CX.secret, 'line'];
}
/** 문양이 실제로 그려지는지 (검사용) */
export const motifOk = (m: string) => !!motif(m)[0] && (m.startsWith('cx:') ? !!CX[m.slice(3)] : !m.startsWith('num:') || /^num:\d+$/.test(m));
const METAL: Record<AchGrade, string> = { bronze: 'bz', silver: 'ag', gold: 'au', legend: 'lg' };
function defsHtml() {
  const st = (o: string, v: string) => `<stop offset="${o}" style="stop-color:var(${v})"/>`;
  return `<svg id="ach-defs" class="ach-defs" aria-hidden="true" focusable="false"><defs>${ACH_GRADES.map((g) => {
    const t = `--ach-${METAL[g]}`;
    return `<linearGradient id="ach-rim-${g}" x1="0" y1="0" x2="1" y2="1">${st('0', `${t}-1`)}${st('.45', `${t}-2`)}${st('1', `${t}-3`)}</linearGradient>`
      + (g === 'legend'
        ? `<radialGradient id="ach-face-${g}" cx=".4" cy=".35" r=".75">${st('0', '--ach-en-1')}${st('1', '--ach-en-2')}</radialGradient>`
        : `<linearGradient id="ach-face-${g}" x1="0" y1="0" x2="1" y2="1">${st('0', `${t}-3`)}${st('.55', `${t}-2`)}${st('1', `${t}-1`)}</linearGradient>`);
  }).join('')}</defs></svg>`;
}
function ensureDefs() {
  if (!HAS || document.getElementById('ach-defs')) return;
  document.body?.insertAdjacentHTML('beforeend', defsHtml());
}
/** 별빛 테 (전설): 12갈래 */
const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) { const r = i % 2 ? 26.5 : 31.5, a = (Math.PI * i) / 12 - Math.PI / 2; pts.push(`${(32 + r * Math.cos(a)).toFixed(2)} ${(32 + r * Math.sin(a)).toFixed(2)}`); }
  return `M${pts.join('L')}z`;
})();
/** 메달 하나. locked = 아직 달성하지 않음 (흐리게), secret = 숨김 업적이라 문양도 가린다 */
export function medalSvg(a: AchDef, o: { locked?: boolean; secret?: boolean; cls?: string } = {}): string {
  ensureDefs();
  const g = a.grade;
  const [mo, kind] = motif(o.secret ? 'cx:secret' : a.motif);
  const paint = kind === 'line' ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"';
  return `<svg class="ach-medal g-${g}${o.locked ? ' locked' : ''}${o.cls ? ` ${o.cls}` : ''}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">`
    + (g === 'legend' ? `<path class="am-star" d="${STAR}"/>` : '')
    + `<circle class="am-rim" cx="32" cy="32" r="27.5" fill="url(#ach-rim-${g})"/>`
    + `<circle class="am-beads" cx="32" cy="32" r="24.8"/>`
    + `<circle class="am-face" cx="32" cy="32" r="21.6" fill="url(#ach-face-${g})"/>`
    + `<g transform="translate(32 32) scale(1.08) translate(-12 -12)"><g class="am-hl" transform="translate(.45 .6)" ${paint}>${mo}</g><g class="am-ink" ${paint}>${mo}</g></g>`
    + '<path class="am-gloss" d="M12.5 27.5a20 20 0 0 1 19-15.5"/></svg>';
}

// ───────── 달성 배너 (화면 하단, 차례로)
const queue: string[] = [];
let showing = false;
function host(): HTMLElement {
  let h = document.querySelector<HTMLElement>('.ach-toasts');
  if (!h) {
    h = document.createElement('div');
    h.className = 'ach-toasts';
    h.setAttribute('role', 'status');
    h.setAttribute('aria-live', 'polite');
    document.body.appendChild(h);
  }
  return h;
}
function enqueue(id: string) {
  if (!HAS || !ACH_BY_ID[id]) return;
  queue.push(id);
  if (!showing) showNext();
}
/** 배너 하나: 등장(미끄러져 올라옴 · 메달 회전 · 빛 줄기 · 빛 훑기) → 머묾 → 퇴장 */
function showNext() {
  const id = queue.shift();
  if (!id) { showing = false; return; }
  showing = true;
  const a = ACH_BY_ID[id];
  const el = document.createElement('div');
  el.className = `ach-toast g-${a.grade}`;
  el.innerHTML = `<div class="ach-t-medal"><i class="ach-t-rays" aria-hidden="true"></i>${medalSvg(a)}</div>
    <div class="ach-t-tx"><span class="ach-t-kick f-ui">업적 달성 · ${GRADE_NAME[a.grade]}</span><b class="ach-t-name f-title">${esc(a.name)}</b><span class="ach-t-desc">${esc(a.desc())}</span></div>
    <i class="ach-t-shine" aria-hidden="true"></i>`;
  host().appendChild(el);
  SND.sfx('reveal3'); // 전설 등급 공개음 (sound.ts)
  void el.offsetWidth;
  el.classList.add('in');
  const still = reduced();
  const hold = (a.grade === 'legend' ? 5600 : 4600) + (queue.length ? 0 : 400);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => { el.remove(); setTimeout(showNext, 160); }, still ? 260 : 520);
  }, hold);
}
/** 확인용 (주소에 ?achtest): window.__ach('vault', 'catwheel') 로 배너를 띄운다 (저장하지 않음) */
if (HAS && typeof location !== 'undefined' && /achtest/.test(location.search)) {
  (globalThis as unknown as Record<string, unknown>).__ach = (...ids: string[]) => ids.forEach(enqueue);
}

// ───────── 도감 '업적' 탭
let msg = '';
export function achCodexHtml(): string {
  const g = got(), m = loadMeta();
  const show = (m.showcase || []).filter((id) => g[id] && ACH_BY_ID[id]);
  const total = ACHIEVEMENTS.length, n = ACHIEVEMENTS.filter((a) => g[a.id]).length;
  const byGrade = (gr: AchGrade) => ACHIEVEMENTS.filter((a) => a.grade === gr);
  const slot = (i: number) => {
    const a = ACH_BY_ID[show[i]];
    return a ? `<button class="ach-slot on" data-ach-show="${a.id}" title="진열장에서 내리기">${medalSvg(a)}<span class="small">${esc(a.name)}</span></button>`
      : `<span class="ach-slot"><i aria-hidden="true"></i><span class="small muted">빈 칸</span></span>`;
  };
  const card = (a: AchDef) => {
    const on = g[a.id], secret = !!a.hidden && !on, shown = show.includes(a.id);
    return `<article class="ach-card g-${a.grade}${on ? ' got' : ''}${secret ? ' secret' : ''}">${medalSvg(a, { locked: !on, secret })}
      <div class="ach-card-tx"><b class="f-ui">${secret ? '???' : esc(a.name)}</b>
        <p class="small">${secret ? '숨겨진 업적입니다.' : esc(a.desc())}</p>${secret && a.hint ? `<p class="ach-hint small">${esc(a.hint)}</p>` : ''}
        <p class="ach-meta small"><span class="ach-gr">${GRADE_NAME[a.grade]}</span>${a.hidden ? ' · 숨김' : ''} · ${on ? `<span class="f-num">${esc(on)}</span> 달성` : '미달성'}</p></div>
      ${on ? `<button class="btn tiny ach-show${shown ? ' on' : ''}" data-ach-show="${a.id}" aria-pressed="${shown}">${shown ? '전시 중' : '전시'}</button>` : ''}</article>`;
  };
  return `<section class="ach-cx" data-ach-root>
    <div class="ach-cx-head"><p class="ach-cx-prog"><b class="f-num">${n}</b> / <span class="f-num">${total}</span> 달성</p>
      <ul class="ach-cx-grades">${ACH_GRADES.map((gr) => `<li class="g-${gr}">${medalSvg(byGrade(gr)[0], { cls: 'ach-mini' })}<span>${GRADE_NAME[gr]}</span> <b class="f-num">${byGrade(gr).filter((a) => g[a.id]).length}/${byGrade(gr).length}</b></li>`).join('')}</ul>
      <p class="muted small">업적은 메달과 전시만 남깁니다. 게임 진행에는 영향이 없습니다. 숨겨진 업적은 달성하기 전까지 이름과 조건이 가려집니다.</p></div>
    <div class="ach-cx-case"><h2>바 진열장 <span class="muted small f-num">${show.length}/${SHOWCASE_MAX}</span></h2>
      <p class="muted small">달성한 업적의 '전시'를 누르면 에란테스 바 카운터 뒤 진열장에 메달이 놓입니다 (최대 ${SHOWCASE_MAX}개). 놓인 메달을 누르면 내립니다.</p>
      <div class="ach-slots">${Array.from({ length: SHOWCASE_MAX }, (_, i) => slot(i)).join('')}</div><p class="ach-msg small" aria-live="polite">${esc(msg)}</p></div>
    ${ACH_GRADES.map((gr) => `<h2 class="ach-gh g-${gr}">${GRADE_NAME[gr]} <span class="muted small f-num">${byGrade(gr).filter((a) => g[a.id]).length}/${byGrade(gr).length}</span></h2>
      <div class="ach-list">${byGrade(gr).map(card).join('')}</div>`).join('')}
  </section>`;
}
/** 전시 켜고 끄기 (가득 차면 알림만) */
function toggleShow(id: string) {
  const m = loadMeta();
  const cur = (m.showcase || []).filter((x) => m.achieved?.[x]);
  msg = '';
  if (cur.includes(id)) metaShowcase(cur.filter((x) => x !== id), SHOWCASE_MAX);
  else if (cur.length >= SHOWCASE_MAX) msg = `진열장은 ${SHOWCASE_MAX}칸입니다. 먼저 놓인 메달 하나를 내리세요.`;
  else metaShowcase([...cur, id], SHOWCASE_MAX);
  const root = document.querySelector('[data-ach-root]');
  if (root) root.outerHTML = achCodexHtml();
  msg = '';
}

// ───────── 바: 카운터 뒤 진열장 (bar.ts barScreen 이 무대 배경 위에 끼워 넣는다)
/** 진열장 (놓인 메달이 없으면 빈 문자열). 위치는 배경 그림(1216 × 832, cover · 가로 가운데 · 세로 40%)의 오른쪽 끝 선반 기둥에 맞춘다 */
export function barShowcaseHtml(): string {
  const g = got();
  const show = (loadMeta().showcase || []).filter((id) => g[id] && ACH_BY_ID[id]).slice(0, SHOWCASE_MAX);
  if (!show.length) return '';
  const tier = (id: string | undefined) => {
    const a = id ? ACH_BY_ID[id] : null;
    return `<div class="bar-vitrine-tier">${a ? `<button class="bar-vitrine-m g-${a.grade}" data-ach-pop="${a.id}" aria-label="${esc(a.name)} — 업적 메달 설명">${medalSvg(a)}</button>` : ''}</div>`;
  };
  return `<div class="bar-vitrine-layer"><div class="bar-vitrine" role="group" aria-label="업적 진열장">${Array.from({ length: SHOWCASE_MAX }, (_, i) => tier(show[i])).join('')}</div></div>`;
}
function popFor(btn: HTMLElement) {
  const v = btn.closest('.bar-vitrine');
  const old = v?.querySelector('.bar-vitrine-pop');
  const id = btn.dataset.achPop!;
  old?.remove();
  v?.querySelectorAll('.bar-vitrine-m.on').forEach((x) => x.classList.remove('on'));
  if (!v || old?.getAttribute('data-for') === id) return; // 같은 메달을 다시 누르면 닫기
  const a = ACH_BY_ID[id], on = got()[id];
  btn.classList.add('on');
  const top = (btn.parentElement as HTMLElement).offsetTop;
  v.insertAdjacentHTML('beforeend', `<div class="bar-vitrine-pop g-${a.grade}" data-for="${id}" role="dialog" aria-label="${esc(a.name)}" style="--y:${top}px">
    ${medalSvg(a)}<div><span class="ach-t-kick f-ui">업적 · ${GRADE_NAME[a.grade]}</span><b class="f-ui">${esc(a.name)}</b><p class="small">${esc(a.desc())}</p>${on ? `<p class="small muted"><span class="f-num">${esc(on)}</span> 달성</p>` : ''}</div></div>`);
}
const closePops = () => document.querySelectorAll('.bar-vitrine-pop').forEach((p) => { p.remove(); });

// ───────── 입력: 도감 전시 단추 · 진열장 메달 (main.ts 의 data-a 처리와 따로, 다시 그리지 않고 이 조각만 바꾼다)
let bound = false;
function bindUi() {
  if (bound) return;
  bound = true;
  // 바 무대의 클릭(다음 대사로)까지 가지 않게 잡는 단계에서 처리한다
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pop = t.closest<HTMLElement>('[data-ach-pop]');
    if (pop) { e.stopPropagation(); popFor(pop); SND.sfx('click'); return; }
    if (t.closest('.bar-vitrine-pop')) { e.stopPropagation(); closePops(); document.querySelectorAll('.bar-vitrine-m.on').forEach((x) => x.classList.remove('on')); return; }
    if (document.querySelector('.bar-vitrine-pop')) { closePops(); document.querySelectorAll('.bar-vitrine-m.on').forEach((x) => x.classList.remove('on')); }
    const sh = t.closest<HTMLElement>('[data-ach-show]');
    if (sh) { e.stopPropagation(); toggleShow(sh.dataset.achShow!); SND.sfx('click'); }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.querySelector('.bar-vitrine-pop')) { closePops(); document.querySelectorAll('.bar-vitrine-m.on').forEach((x) => x.classList.remove('on')); } });
}
