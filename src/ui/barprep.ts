// 에란테스 바 제조대 (후면): 주문을 누르면 카메라가 180° 돌아 여기를 본다 (docs/BAR_OPS.md 2 · 7절). 만드는 동안 손님 반응은 없다.
// 위 선반 = 술 10 · 음료 6 · 분말 3 (누르면 지금 잔에 1칸) · 왼쪽 = 잔 6 · 가운데 = 만드는 잔 · 오른쪽 = 얼음 · 가니쉬 · 아래 = 맛 막대 3개.
// 주문서는 종이 사물(레터프레스, docs/UI.md 19), 맛 막대 · 칸 · 단추는 게임 토큰. 배경은 당분간 빈 배경 (단색 + 카운터 나무결 작업대).
// 레시피북(에이든 공략집)은 종이 덮개: 메뉴 · 단골 장부.
import {
  AXES, AXIS_NAME, GARNISH_BY_ID, GARNISH_MAX, GARNISHES, GLASS_BY_ID, GLASS_KIND_NAME, GLASSES, ICE_NAME, ING_BY_ID, ING_KIND_NAME, INGREDIENTS, RECIPES,
  tagsOf, tasteOf, tasteText, type Drink, type Ice, type IngKind,
} from '../data/bar/drinks';
import { ORDER_STYLE_NAME } from '../data/bar/drinks';
import { axisTargets, recipeName, type Order } from '../data/bar/orders';
import { drinkSvg } from './drinkart';
import { loadMeta } from './meta';
import { artURL } from './portraits';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** 지금 만드는 잔 (잔을 고르기 전엔 glass = '') */
export interface Prep { k: string; who: string; name: string; order: Order; glass: string; fill: string[]; ice: Ice; garnish: string[]; book: '' | 'menu' | 'ledger'; hintText?: string }
export const newPrep = (k: string, who: string, name: string, order: Order, hintText?: string): Prep => ({ k, who, name, order, glass: '', fill: [], ice: 'none', garnish: [], book: '', hintText });
export const prepDrink = (p: Prep): Drink => ({ glass: p.glass, fill: [...p.fill], ice: p.ice, garnish: [...p.garnish] });
const slotsOf = (p: Prep) => GLASS_BY_ID[p.glass]?.slots || 0;
export const prepReady = (p: Prep) => !!p.glass && p.fill.length === slotsOf(p);

// ───────── 그림: 재료 병 · 분말 통 (한 색 면 · 선, docs/UI.md 26). 보기 상자 32 × 48
const BOTTLE: Record<IngKind, (c: string) => string> = {
  spirit: (c) => `<path d="M13 3 H19 V12 Q25 14 25 20 V44 Q25 46 23 46 H9 Q7 46 7 44 V20 Q7 14 13 12 Z" fill="${c}" stroke="currentColor" stroke-width="1.2"/><path d="M7 26 H25 V36 H7 Z" fill="currentColor" fill-opacity=".18"/>`,
  brew: (c) => `<path d="M14 3 H18 V15 Q24 19 24 25 V44 Q24 46 22 46 H10 Q8 46 8 44 V25 Q8 19 14 15 Z" fill="${c}" stroke="currentColor" stroke-width="1.2"/><path d="M8 29 H24 V37 H8 Z" fill="currentColor" fill-opacity=".18"/>`,
  liqueur: (c) => `<path d="M13 3 H19 V14 Q28 18 28 30 Q28 46 16 46 Q4 46 4 30 Q4 18 13 14 Z" fill="${c}" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="31" r="6" fill="currentColor" fill-opacity=".18"/>`,
  mixer: (c) => `<path d="M10 8 H22 L23 12 V44 Q23 46 21 46 H11 Q9 46 9 44 V12 Z" fill="${c}" stroke="currentColor" stroke-width="1.2"/><path d="M11 4 H21 V8 H11 Z" fill="currentColor" fill-opacity=".5"/><path d="M9 22 H23 V32 H9 Z" fill="currentColor" fill-opacity=".18"/>`,
  powder: (c) => `<path d="M6 16 H26 V44 Q26 46 24 46 H8 Q6 46 6 44 Z" fill="${c}" stroke="currentColor" stroke-width="1.2"/><path d="M5 11 H27 V16 H5 Z" fill="currentColor" fill-opacity=".55"/><path d="M6 26 H26 V36 H6 Z" fill="currentColor" fill-opacity=".18"/>`,
};
export const bottleSvg = (id: string) => { const x = ING_BY_ID[id]; return x ? `<svg viewBox="0 0 32 48" aria-hidden="true">${BOTTLE[x.kind](x.color)}</svg>` : ''; };
/** 얼음 아이콘 */
const ICE_ICON: Record<Ice, string> = {
  none: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 17 L17 7" stroke="currentColor" stroke-width="1.4"/></svg>',
  rocks: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4" transform="rotate(-10 8 12)"/><rect x="12" y="10" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4" transform="rotate(12 16 14)"/></svg>',
  frozen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 V21 M4.2 7.5 L19.8 16.5 M4.2 16.5 L19.8 7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
};
const GARNISH_COLOR: Record<string, string> = { citrus: '#f6b23c', lime: '#8cc63f', salt: '#e9eef2', cardia: '#7a2d1e', mint: '#5aa65a', petal: '#e89ab0', bean: '#3a2214', marsh: '#fbf6ee', cream: '#f4ead8', crystal: '#bfe3f5' };
const dot = (c: string) => `<i class="bp-dot" style="--ing:${c}" aria-hidden="true"></i>`;

// ───────── 맛 막대: −10 ~ +10 (넘으면 끝에 붙인다), 목표 범위는 옅은 면 + 양 끝 눈금
const BAR_MIN = -10, BAR_MAX = 12;
const pos = (v: number) => ((Math.max(BAR_MIN, Math.min(BAR_MAX, v)) - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100;
function tasteBars(d: Drink, o: Order) {
  const t = tasteOf(d);
  const tg = axisTargets(o.conds);
  return AXES.map((a) => {
    const r = tg[a];
    const lo = r ? pos(r.min ?? (a === 'strength' ? 0 : BAR_MIN)) : 0, hi = r ? Math.max(pos(r.max ?? BAR_MAX), lo + 1.5) : 0; // 강도는 0 아래가 없다 (강도 0 = 0 자리 눈금)
    const ok = r && (r.min === undefined || t[a] >= r.min) && (r.max === undefined || t[a] <= r.max);
    const sgn = t[a] > 0 ? `+${t[a]}` : String(t[a]).replace('-', '−');
    return `<div class="bp-axis${r ? (ok ? ' ok' : ' no') : ''}"><span class="bp-an">${AXIS_NAME[a]}</span><b class="f-num">${sgn}</b>
      <span class="bp-track">${r ? `<i class="bp-goal" style="--lo:${lo};--hi:${hi}"></i>` : ''}<i class="bp-zero" style="--at:${pos(0)}"></i><i class="bp-val" style="--at:${pos(t[a])}"></i></span></div>`;
  }).join('');
}

// ───────── 주문서 (종이)
function slipHtml(p: Prep) {
  const o = p.order;
  let body = '';
  if (o.style === 'vague') body = `<ul class="bp-conds">${(o.conds || []).map((c) => `<li>${esc(c.label)}</li>`).join('')}</ul>`;
  else if (o.style === 'photo') body = `<figure class="bp-photo">${drinkSvg(o.target!, 1, 'drink bp-pic')}</figure>`;
  else if (o.style === 'name') body = `<p class="bp-menu">${esc(o.name || '')}</p>`;
  else {
    const note = o.hint === 'aiden' ? `<p class="bp-note"><b>에이든</b> ${esc(o.name ? `${o.name}입니다.` : '지난번 그 잔입니다.')}</p>${!o.name || o.ledger ? `<figure class="bp-photo">${drinkSvg(o.target!, 1, 'drink bp-pic')}</figure>` : ''}`
      : o.hint === 'guest' ? `<p class="bp-note">${esc(p.hintText || '')}</p>` : '<p class="bp-note">단골 장부를 보세요.</p>';
    body = note;
  }
  return `<aside class="bp-slip" aria-label="주문서"><span class="bp-slip-who">${esc(p.name)}</span><span class="bp-slip-style">${esc(ORDER_STYLE_NAME[o.style])}</span>${body}</aside>`;
}

// ───────── 레시피북 (에이든 공략집): 메뉴 · 단골 장부
const fillText = (d: Drink) => { const m = new Map<string, number>(); for (const x of d.fill) m.set(x, (m.get(x) || 0) + 1); return [...m].map(([x, n]) => `${ING_BY_ID[x]?.name || x}${n > 1 ? ` ×${n}` : ''}`).join(' · '); };
function recipeRow(d: Drink, name: string, desc = '') {
  const g = GLASS_BY_ID[d.glass];
  return `<li class="bp-rec">${drinkSvg(d, 1, 'drink bp-rec-pic')}<div><b>${esc(name)}</b>
    <span class="bp-rec-l"><em>잔</em> ${esc(g?.name || '')} · ${g?.slots}칸</span><span class="bp-rec-l"><em>재료</em> ${esc(fillText(d))}</span>
    <span class="bp-rec-l"><em>얼음</em> ${esc(ICE_NAME[d.ice])}${d.garnish.length ? ` · <em>가니쉬</em> ${esc(d.garnish.map((x) => GARNISH_BY_ID[x]?.name || x).join(' · '))}` : ''}</span>
    ${desc ? `<small>${esc(desc)}</small>` : ''}</div></li>`;
}
function bookHtml(p: Prep, names: (id: string) => string) {
  const ledger = Object.entries(loadMeta().bar?.usual || {});
  const tab = (k: 'menu' | 'ledger', label: string) => `<button class="bp-tab${p.book === k ? ' on' : ''}" data-a="bar-x" data-v="prep:book:${k}" aria-pressed="${p.book === k}">${label}</button>`;
  const list = p.book === 'ledger'
    ? (ledger.length ? ledger.map(([id, d]) => recipeRow(d, `${names(id)} — ${d.name || recipeName(d) || '이름 없는 잔'}`)).join('') : '<li class="bp-empty">아직 적힌 손님이 없습니다. 좋아함을 받은 잔이 여기에 적힙니다.</li>')
    : RECIPES.map((r) => recipeRow(r, r.name, r.desc)).join('');
  return `<div class="bp-book" role="dialog" aria-label="레시피북"><header><h3>에이든 공략집</h3>${tab('menu', `메뉴 ${RECIPES.length}`)}${tab('ledger', `단골 장부 ${ledger.length}`)}
    <button class="bp-x" data-a="bar-x" data-v="prep:book:" aria-label="닫기">✕</button></header><ul class="bp-recs">${list}</ul></div>`;
}

/** 제조대 전체 */
export function prepHtml(p: Prep, names: (id: string) => string): string {
  const d = prepDrink(p);
  const n = slotsOf(p);
  const groups: [string, IngKind[]][] = [['술', ['spirit', 'brew', 'liqueur']], [ING_KIND_NAME.mixer, ['mixer']], [ING_KIND_NAME.powder, ['powder']]];
  const full = !!p.glass && p.fill.length >= n;
  const shelf = groups.map(([label, kinds]) => `<div class="bp-grp"><span class="bp-grp-l">${label}</span><div class="bp-bottles">${INGREDIENTS.filter((x) => kinds.includes(x.kind)).map((x) =>
    `<button class="bp-btl" data-a="bar-x" data-v="prep:pour:${x.id}"${!p.glass || full ? ' aria-disabled="true"' : ''} title="${esc(`${x.name} (${x.type})`)}">${bottleSvg(x.id)}<span>${esc(x.name)}</span></button>`).join('')}</div></div>`).join('');
  const glasses = (['tumbler', 'stem'] as const).map((k) => `<div class="bp-glass-row"><span class="bp-grp-l">${GLASS_KIND_NAME[k]}</span>${GLASSES.filter((g) => g.kind === k).map((g) =>
    `<button class="bp-glass${p.glass === g.id ? ' on' : ''}" data-a="bar-x" data-v="prep:glass:${g.id}" aria-pressed="${p.glass === g.id}">${drinkSvg({ glass: g.id, fill: [], ice: 'none', garnish: [] }, 0, 'drink')}<span>${esc(g.name)}</span><i class="bp-pips" aria-label="${g.slots}칸">${'<b></b>'.repeat(g.slots)}</i></button>`).join('')}</div>`).join('');
  const work = p.glass
    ? `<div class="bp-cup">${drinkSvg(d, n ? p.fill.length / n : 0, 'drink bp-big')}</div><p class="bp-count f-num"><b>${p.fill.length}</b> / ${n}칸</p>`
    : '<div class="bp-cup bp-cup-empty" aria-hidden="true"></div><p class="bp-count">잔을 고르세요</p>';
  const ices = (Object.keys(ICE_NAME) as Ice[]).map((k) => `<button class="bp-ice${p.ice === k ? ' on' : ''}" data-a="bar-x" data-v="prep:ice:${k}" aria-pressed="${p.ice === k}">${ICE_ICON[k]}<span>${ICE_NAME[k]}</span></button>`).join('');
  const gars = GARNISHES.map((g) => { const on = p.garnish.includes(g.id); return `<button class="bp-gar${on ? ' on' : ''}" data-a="bar-x" data-v="prep:gar:${g.id}" aria-pressed="${on}"${!on && p.garnish.length >= GARNISH_MAX ? ' aria-disabled="true"' : ''} title="${esc(g.desc)}">${dot(GARNISH_COLOR[g.id] || '#999999')}<span>${esc(g.name)}</span></button>`; }).join('');
  const ready = prepReady(p);
  const tags = p.fill.length ? tagsOf(d).slice(0, 4) : [];
  return `<header class="bp-head"><h2>${esc(p.name)}의 주문</h2><button class="bp-bookbtn" data-a="bar-x" data-v="prep:book:menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5 Q8 3.5 12 5.5 Q16 3.5 20 5 V19 Q16 17.5 12 19.5 Q8 17.5 4 19 Z M12 5.5 V19.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>레시피북</button>
      <button class="bp-back" data-a="bar-x" data-v="prep:back">카운터로</button></header>
    <div class="bp-shelf">${shelf}</div>
    <div class="bp-glasses">${glasses}</div>
    <div class="bp-work">${work}
      <div class="bp-acts"><button class="bp-btn" data-a="bar-x" data-v="prep:undo"${p.fill.length ? '' : ' aria-disabled="true"'}>한 칸 빼기</button><button class="bp-btn" data-a="bar-x" data-v="prep:clear"${p.fill.length || p.garnish.length || p.ice !== 'none' ? '' : ' aria-disabled="true"'}>비우기</button>
        <button class="bp-btn bp-serve" data-a="bar-x" data-v="prep:serve"${ready ? '' : ' aria-disabled="true"'}>내주기</button></div></div>
    <div class="bp-side"><div class="bp-grp"><span class="bp-grp-l">얼음</span><div class="bp-ices">${ices}</div></div>
      <div class="bp-grp"><span class="bp-grp-l">가니쉬 <b class="f-num">${p.garnish.length}</b> / ${GARNISH_MAX}</span><div class="bp-gars">${gars}</div></div></div>
    <div class="bp-taste">${tasteBars(d, p.order)}<p class="bp-tt">${p.fill.length ? esc(tasteText(d)) : ''}${tags.length ? '' : ''}</p></div>
    ${slipHtml(p)}
    ${p.book ? bookHtml(p, names) : ''}
    <div class="bp-bench" style="--tex:url('${artURL('ct_table.webp')}')" aria-hidden="true"></div>`;
}

/** 제조대 조작. 'serve' = 내주기 · 'back' = 카운터로 · 'draw' = 다시 그리기 · null = 아무것도 */
export function prepAct(p: Prep, v: string): 'serve' | 'back' | 'draw' | null {
  const [k, x = ''] = v.split(':');
  const n = slotsOf(p);
  if (k === 'back') return 'back';
  if (k === 'serve') return prepReady(p) ? 'serve' : null;
  if (k === 'book') { p.book = x === 'menu' || x === 'ledger' ? x : ''; return 'draw'; }
  if (k === 'glass' && GLASS_BY_ID[x]) { p.glass = p.glass === x ? '' : x; const m = GLASS_BY_ID[p.glass]?.slots || 0; if (p.fill.length > m) p.fill = p.fill.slice(0, m); return 'draw'; }
  if (k === 'pour' && ING_BY_ID[x] && p.glass && p.fill.length < n) { p.fill.push(x); return 'draw'; }
  if (k === 'undo' && p.fill.length) { p.fill.pop(); return 'draw'; }
  if (k === 'clear') { p.fill = []; p.garnish = []; p.ice = 'none'; return 'draw'; }
  if (k === 'ice' && x in ICE_NAME) { p.ice = x as Ice; return 'draw'; }
  if (k === 'gar' && GARNISH_BY_ID[x]) {
    if (p.garnish.includes(x)) p.garnish = p.garnish.filter((g) => g !== x);
    else if (p.garnish.length < GARNISH_MAX) p.garnish.push(x);
    else return null;
    return 'draw';
  }
  return null;
}
