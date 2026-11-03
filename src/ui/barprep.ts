// 에란테스 바 제조대 (후면): 주문을 누르면 카메라가 180° 돌아 여기를 본다 (docs/BAR_OPS.md 2 · 7절). 만드는 동안 손님 반응은 없다.
// 네 자리가 작업대를 따라 가로로 이어지고, 카메라가 한 자리씩 오른쪽으로 옮겨 간다 (docs/UI.md 27 — 이어 움직인다):
//   1 영수증 (맨 왼쪽 출력기에서 영수증이 밀려 나온다) → 2 잔 · 얼음 → 3 진열장 (층마다 병, 병에는 전체 이름) → 4 가니쉬 · 탁상 벨 (누르면 내준다).
// 영수증은 다음 단계부터 오른쪽 위에 꽂혀 따라오고, 그 아래 맛 막대 3개 (진열장부터). 영수증 · 레시피북 · 메모는 종이 사물(레터프레스, docs/UI.md 19), 칸 · 단추는 게임 토큰.
// 레시피북(에이든 공략집)은 종이 덮개: 메뉴 · 단골 장부 · 에이든의 메모 (바 운영 첫 영업 보조를 다시 보는 쪽).
// 처음 연 제조대에는 출력기 왼쪽에 에이든의 메모가 놓여 있다 (순서 · 자리별 한 줄, ✕ 로 뗀다 — 막지 않는다).
import {
  AXES, AXIS_NAME, GARNISH_BY_ID, GARNISH_MAX, GARNISHES, GLASS_BY_ID, GLASS_KIND_NAME, GLASSES, ICE_NAME, ING_BY_ID, ING_KIND_NAME, INGREDIENTS, RECIPES,
  tasteOf, tasteText, type Drink, type Ice, type IngKind,
} from '../data/bar/drinks';
import { ORDER_STYLE_NAME } from '../data/bar/drinks';
import { axisTargets, COIN_NAME, recipeName, type Order } from '../data/bar/orders';
import { OPS_MEMO } from '../data/bar/opstut';
import { fillText as fillVars } from '../data/scene';
import { BAR_ITEM_ART } from './baritems.gen';
import { drinkSvg } from './drinkart';
import { loadMeta } from './meta';
import { artURL } from './portraits';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** 지금 만드는 잔 (잔을 고르기 전엔 glass = '') */
export interface Prep { k: string; who: string; name: string; order: Order; glass: string; fill: string[]; ice: Ice; garnish: string[]; book: '' | 'menu' | 'ledger' | 'memo'; hintText?: string;
  /** 지금 보는 단계 (PREP_STEPS) */
  step: PrepStep;
  /** 영수증을 다 뽑았다 (처음 그릴 때만 출력기에서 밀려 나온다) */
  printed?: boolean;
  /** 진열장에서 고친 층 (다음 병이 이 층을 바꾼다) */
  sel?: number;
  /** 처음 연 제조대: 에이든의 메모가 붙어 있다 (✕ 로 떼면 false) */
  memo?: boolean }
export const newPrep = (k: string, who: string, name: string, order: Order, hintText?: string): Prep => ({ k, who, name, order, glass: '', fill: [], ice: 'none', garnish: [], book: '', hintText, step: 0 });
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
/** 재료 · 가니쉬 그림 (빈티지 판화 · 투명 배경, scripts/bar_items_build.py) — 없으면 코드 그림 */
const itemImg = (key: string, cls: string) => (BAR_ITEM_ART[key] ? `<img class="${cls}" src="${BAR_ITEM_ART[key]}" alt="" draggable="false">` : '');
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

// ───────── 에이든의 메모 (종이, 바 운영 첫 영업 보조 — src/data/bar/opstut.ts)
const memoText = (s: string) => esc(fillVars(s, { coin: COIN_NAME }));
const memoPara = (ls: string[]) => ls.map((l) => `<p>${memoText(l)}</p>`).join('');
/** 제조대 순서 (잔 → 붓기 → …) · 자리별 한 줄 */
const memoSteps = () => `<p class="ops-steps">${OPS_MEMO.steps.map((x) => `<b>${esc(x)}</b>`).join('<i aria-hidden="true">→</i>')}</p>`;
const memoPrep = () => `<dl class="ops-dl">${OPS_MEMO.prep.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${memoText(v)}</dd></div>`).join('')}</dl>`;
const memoSign = () => `<span class="ops-sign">${esc(OPS_MEMO.sign)}</span>`;
/** 메모 머리: 받는 사람 (펜 글씨) + 닫기 ✕ (머리 오른쪽 끝, docs/UI.md 30) */
const memoHead = (close: string, label: string) => `<header class="ops-head"><span class="ops-to">${esc(OPS_MEMO.to)}</span><button class="bp-x" data-a="bar-x" data-v="${close}" aria-label="${label}">✕</button></header>`;
/** 카운터 위 메모 (밤 첫 주문): 주문 받는 법 + 추신 */
export const counterMemoHtml = (close: string) => `${memoHead(close, '메모 닫기')}${memoPara([...OPS_MEMO.order, OPS_MEMO.night])}${memoSign()}`;
/** 제조대에 붙은 메모 (처음 연 제조대) */
const prepMemoHtml = () => `<aside class="bp-memo" aria-label="에이든의 메모">${memoHead('prep:memo', '메모 떼기')}${memoSteps()}${memoPrep()}${memoSign()}</aside>`;
/** 레시피북 '에이든의 메모' 쪽: 주문 · 제조대 · 주화 (다시 보기) */
const bookMemoHtml = () => `<div class="bp-recs bp-memo-page"><section><h4>주문</h4>${memoPara(OPS_MEMO.order)}</section>
  <section><h4>제조대</h4>${memoSteps()}${memoPrep()}</section><section><h4>${esc(COIN_NAME)}</h4>${memoPara(OPS_MEMO.coin)}</section>${memoSign()}</div>`;

// ───────── 레시피북 (에이든 공략집): 메뉴 · 단골 장부 · 에이든의 메모
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
  const tab = (k: 'menu' | 'ledger' | 'memo', label: string) => `<button class="bp-tab${p.book === k ? ' on' : ''}" data-a="bar-x" data-v="prep:book:${k}" aria-pressed="${p.book === k}">${label}</button>`;
  const list = p.book === 'ledger'
    ? (ledger.length ? ledger.map(([id, d]) => recipeRow(d, `${names(id)} — ${d.name || recipeName(d) || '이름 없는 잔'}`)).join('') : '<li class="bp-empty">아직 적힌 손님이 없습니다. 좋아함을 받은 잔이 여기에 적힙니다.</li>')
    : RECIPES.map((r) => recipeRow(r, r.name, r.desc)).join('');
  return `<div class="bp-book" role="dialog" aria-label="레시피북"><header><h3>에이든 공략집</h3>${tab('menu', `메뉴 ${RECIPES.length}`)}${tab('ledger', `단골 장부 ${ledger.length}`)}${tab('memo', '에이든의 메모')}
    <button class="bp-x" data-a="bar-x" data-v="prep:book:" aria-label="닫기">✕</button></header>${p.book === 'memo' ? bookMemoHtml() : `<ul class="bp-recs">${list}</ul>`}</div>`;
}

/** 단계: 0 영수증 (출력기, 맨 왼쪽) → 1 잔 · 얼음 → 2 진열장 (층마다 병) → 3 가니쉬 · 벨. 카메라가 작업대를 따라 오른쪽으로 옮겨 간다 */
export const PREP_STEPS = ['영수증', '잔 · 얼음', '진열장', '가니쉬'] as const;
export type PrepStep = 0 | 1 | 2 | 3;
/** 그 단계로 갈 수 있나 (진열장 = 잔을 골랐다 · 가니쉬 = 층을 다 채웠다) */
export const prepCan = (p: Prep, st: number) => st <= 1 || (st === 2 ? !!p.glass : st === 3 ? prepReady(p) : false);
const WHY: Record<number, string> = { 2: '잔을 먼저 고르세요', 3: '층을 다 채우세요' };

/** 영수증 (카본지, 출력기에서 나온다 → 다음 단계부터 오른쪽 위에 꽂혀 따라온다) */
function receiptHtml(p: Prep) {
  const o = p.order;
  let body = '';
  if (o.style === 'vague') body = `<ul class="bp-conds">${(o.conds || []).map((c) => `<li>${esc(c.label)}</li>`).join('')}</ul>`;
  else if (o.style === 'photo') body = `<figure class="bp-photo">${drinkSvg(o.target!, 1, 'drink bp-pic')}</figure>`;
  else if (o.style === 'name') body = `<p class="bp-menu">${esc(o.name || '')}</p>`;
  else body = o.hint === 'aiden' ? `<p class="bp-note"><b>에이든</b> ${esc(o.name ? `${o.name}입니다.` : '지난번 그 잔입니다.')}</p>${!o.name || o.ledger ? `<figure class="bp-photo">${drinkSvg(o.target!, 1, 'drink bp-pic')}</figure>` : ''}`
    : o.hint === 'guest' ? `<p class="bp-note">${esc(p.hintText || '')}</p>` : '<p class="bp-note">단골 장부를 보세요.</p>';
  const no = (loadMeta().bar?.served || 0) + 1; // 전표 번호 = 지금까지 내준 잔 + 1 (기록이 쌓인다, docs/UI.md 22)
  return `<aside class="bp-rc lp-carbon" aria-label="영수증"><header class="bp-rc-h"><span class="f-num">No.${no}</span><span>${esc(ORDER_STYLE_NAME[o.style])}</span></header>
    <b class="bp-rc-who">${esc(p.name)}</b>${body}</aside>`;
}

/** 큰 잔 (붓는 대로 아래부터 층) — 잔을 고르기 전엔 빈 자리 */
const cupHtml = (p: Prep, cls = '') => {
  const n = slotsOf(p);
  return p.glass ? `<div class="bp-cup${cls}">${drinkSvg(prepDrink(p), n ? p.fill.length / n : 0, 'drink bp-big')}</div>` : `<div class="bp-cup bp-cup-empty${cls}" aria-hidden="true"></div>`;
};

/** 1 잔 · 얼음: 잔 선반 (텀블러 3 · 스템 잔 3, 잔 아래 칸 수 점) · 고른 잔 · 얼음 3 */
function glassStation(p: Prep) {
  const glasses = (['tumbler', 'stem'] as const).map((k) => `<div class="bp-glass-row"><span class="bp-grp-l">${GLASS_KIND_NAME[k]}</span>${GLASSES.filter((g) => g.kind === k).map((g) =>
    `<button class="bp-glass${p.glass === g.id ? ' on' : ''}" data-a="bar-x" data-v="prep:glass:${g.id}" aria-pressed="${p.glass === g.id}">${drinkSvg({ glass: g.id, fill: [], ice: 'none', garnish: [] }, 0, 'drink')}<span>${esc(g.name)}</span><i class="bp-pips" aria-label="${g.slots}칸">${'<b></b>'.repeat(g.slots)}</i></button>`).join('')}</div>`).join('');
  const ices = (Object.keys(ICE_NAME) as Ice[]).map((k) => `<button class="bp-ice${p.ice === k ? ' on' : ''}" data-a="bar-x" data-v="prep:ice:${k}" aria-pressed="${p.ice === k}">${ICE_ICON[k]}<span>${ICE_NAME[k]}</span></button>`).join('');
  return `<div class="bp-glasses">${glasses}</div>${cupHtml(p)}<div class="bp-grp bp-icebox"><span class="bp-grp-l">얼음</span><div class="bp-ices">${ices}</div></div>`;
}

/** 2 진열장: 술 · 음료 · 분말 선반 (병마다 전체 이름 + 종류) · 잔 옆 층 목록 (위층이 위, 누른 층 = 다음 병이 들어갈 층) */
function cabinetStation(p: Prep) {
  const n = slotsOf(p);
  const at = p.sel ?? (p.fill.length < n ? p.fill.length : -1); // 다음 병이 들어갈 층 (-1 = 다 찼고 고친 층 없음)
  const groups: [string, IngKind[]][] = [['술', ['spirit', 'brew', 'liqueur']], [ING_KIND_NAME.mixer, ['mixer']], [ING_KIND_NAME.powder, ['powder']]];
  const shelves = groups.map(([label, kinds]) => `<div class="bp-shelf"><span class="bp-grp-l">${label}</span><div class="bp-bottles">${INGREDIENTS.filter((x) => kinds.includes(x.kind)).map((x) =>
    `<button class="bp-btl" data-a="bar-x" data-v="prep:pour:${x.id}"${at < 0 ? ' aria-disabled="true"' : ''} title="${esc(x.desc)}"><span class="bp-btl-art">${itemImg(`ing.${x.id}`, 'bp-art') || bottleSvg(x.id)}</span><b>${esc(x.name)}</b><small>${esc(x.type)}</small></button>`).join('')}</div></div>`).join('');
  const rows = Array.from({ length: n }, (_, j) => n - 1 - j).map((i) => {
    const x = ING_BY_ID[p.fill[i]];
    const can = i <= p.fill.length && i < n; // 빈 층은 맨 아래 빈 층만 고를 수 있다 (아래부터 붓는다)
    return `<li><button class="bp-ly${i === at ? ' on' : ''}${x ? '' : ' empty'}" data-a="bar-x" data-v="prep:ly:${i}"${can ? '' : ' aria-disabled="true"'} aria-pressed="${i === at}"><b class="f-num">${i + 1}층</b>${x ? `${dot(x.color)}<span>${esc(x.name)}</span>` : '<span class="bp-ly-none">—</span>'}</button></li>`;
  }).join('');
  return `<div class="bp-cab">${shelves}</div>
    <div class="bp-layers">${cupHtml(p, ' sm')}<ol class="bp-lys">${rows}</ol>
      <div class="bp-acts"><button class="bp-btn" data-a="bar-x" data-v="prep:undo"${p.fill.length ? '' : ' aria-disabled="true"'}>한 층 빼기</button><button class="bp-btn" data-a="bar-x" data-v="prep:clear"${p.fill.length ? '' : ' aria-disabled="true"'}>비우기</button></div></div>`;
}

/** 3 가니쉬 · 벨: 가니쉬 10 (최대 3) · 완성 잔 · 탁상 벨 (누르면 내준다) */
function garnishStation(p: Prep) {
  const gars = GARNISHES.map((g) => { const on = p.garnish.includes(g.id); return `<button class="bp-gar${on ? ' on' : ''}" data-a="bar-x" data-v="prep:gar:${g.id}" aria-pressed="${on}"${!on && p.garnish.length >= GARNISH_MAX ? ' aria-disabled="true"' : ''} title="${esc(g.desc)}">${itemImg(`gar.${g.id}`, 'bp-art') || dot(GARNISH_COLOR[g.id] || '#999999')}<span>${esc(g.name)}</span></button>`; }).join('');
  const ready = prepReady(p);
  return `<div class="bp-grp bp-garbox"><span class="bp-grp-l">가니쉬 <b class="f-num">${p.garnish.length}</b> / ${GARNISH_MAX}</span><div class="bp-gars">${gars}</div></div>
    ${cupHtml(p)}
    <button class="bp-bell" data-a="bar-x" data-v="prep:serve" aria-label="벨을 눌러 내주기"${ready ? '' : ' aria-disabled="true"'}><img src="${artURL('ct_bell.webp')}" alt="" draggable="false"></button>`;
}

/** 제조대 전체: 머리 (제목 · 단계 칩 · 레시피북) · 작업대 (네 자리가 가로로 이어져 카메라가 옮겨 간다) · 영수증 · 맛 막대 · 이전 / 다음 */
export function prepHtml(p: Prep, names: (id: string) => string): string {
  const d = prepDrink(p);
  const st = p.step;
  const chips = PREP_STEPS.map((label, i) => { const can = prepCan(p, i); return `<li><button class="bp-chip${i === st ? ' on' : ''}" data-a="bar-x" data-v="prep:step:${i}"${can ? '' : ' aria-disabled="true"'} aria-current="${i === st ? 'step' : 'false'}"><b class="f-num">${i + 1}</b>${label}</button></li>`; }).join('');
  const station = (i: number, label: string, html: string) => `<section class="bp-st bp-st${i}" aria-label="${label}"${i === st ? '' : ' inert'}>${html}</section>`;
  const nextOk = st < 3 && prepCan(p, st + 1);
  const tags = p.fill.length ? tasteText(d) : '';
  return `<header class="bp-head"><h2>${esc(p.name)}의 주문</h2><ol class="bp-chips" aria-label="제조 단계">${chips}</ol>
      <button class="bp-bookbtn" data-a="bar-x" data-v="prep:book:menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5 Q8 3.5 12 5.5 Q16 3.5 20 5 V19 Q16 17.5 12 19.5 Q8 17.5 4 19 Z M12 5.5 V19.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>레시피북</button></header>
    <button class="bp-back" data-a="bar-x" data-v="prep:back">카운터로</button>
    <div class="bp-view" style="--st:${st}">
      <div class="bp-belt" style="--tex:url('${artURL('ct_table.webp')}')">
        ${station(0, PREP_STEPS[0], `${p.memo ? prepMemoHtml() : ''}<div class="bp-printer" aria-hidden="true"><img src="${artURL('ct_printer.webp')}" alt="" draggable="false"></div>`)}
        ${station(1, PREP_STEPS[1], glassStation(p))}
        ${station(2, PREP_STEPS[2], cabinetStation(p))}
        ${station(3, PREP_STEPS[3], garnishStation(p))}
      </div>
      <div class="bp-rail${st ? ' pin' : ''}${p.printed ? '' : ' new'}">${receiptHtml(p)}</div>
      <div class="bp-taste"${st >= 2 ? '' : ' hidden'}>${tasteBars(d, p.order)}<p class="bp-tt">${esc(tags)}</p></div>
    </div>
    <nav class="bp-nav" aria-label="제조 단계 이동">
      <button class="bp-btn bp-prev" data-a="bar-x" data-v="prep:prev"${st ? '' : ' hidden'}><span aria-hidden="true">←</span>${st ? PREP_STEPS[st - 1] : ''}</button>
      ${st < 3 ? `${nextOk ? '' : `<span class="bp-why">${WHY[st + 1]}</span>`}<button class="bp-btn bp-next" data-a="bar-x" data-v="prep:next"${nextOk ? '' : ' aria-disabled="true"'}>${PREP_STEPS[st + 1]}<span aria-hidden="true">→</span></button>` : ''}
    </nav>
    ${p.book ? bookHtml(p, names) : ''}`;
}

/** 제조대 조작. 'serve' = 내주기 (벨) · 'back' = 카운터로 · 'draw' = 다시 그리기 · null = 아무것도 */
export function prepAct(p: Prep, v: string): 'serve' | 'back' | 'draw' | null {
  const [k, x = ''] = v.split(':');
  const n = slotsOf(p);
  const go = (st: number) => { if (st < 0 || st > 3 || st === p.step || !prepCan(p, st)) return null; p.step = st as PrepStep; p.sel = undefined; return 'draw' as const; };
  if (k === 'back') return 'back';
  if (k === 'serve') return prepReady(p) ? 'serve' : null;
  if (k === 'step') return go(+x);
  if (k === 'next') return go(p.step + 1);
  if (k === 'prev') return go(p.step - 1);
  if (k === 'book') { p.book = x === 'menu' || x === 'ledger' || x === 'memo' ? x : ''; return 'draw'; }
  if (k === 'memo') { p.memo = false; return 'draw'; }
  if (k === 'glass' && GLASS_BY_ID[x]) { p.glass = p.glass === x ? '' : x; const m = GLASS_BY_ID[p.glass]?.slots || 0; if (p.fill.length > m) p.fill = p.fill.slice(0, m); p.sel = undefined; return 'draw'; }
  if (k === 'pour' && ING_BY_ID[x] && p.glass) { // 고른 층이 있으면 그 층을 바꾸고, 아니면 맨 아래 빈 층에 붓는다
    if (p.sel !== undefined && p.sel < p.fill.length) { p.fill[p.sel] = x; p.sel = undefined; return 'draw'; }
    if (p.fill.length < n) { p.fill.push(x); p.sel = undefined; return 'draw'; }
    return null;
  }
  if (k === 'ly') { const i = +x; if (!(i >= 0 && i < n && i <= p.fill.length)) return null; p.sel = p.sel === i || i >= p.fill.length ? undefined : i; return 'draw'; }
  if (k === 'undo' && p.fill.length) { p.fill.pop(); p.sel = undefined; return 'draw'; }
  if (k === 'clear' && p.fill.length) { p.fill = []; p.sel = undefined; return 'draw'; }
  if (k === 'ice' && x in ICE_NAME) { p.ice = x as Ice; return 'draw'; }
  if (k === 'gar' && GARNISH_BY_ID[x]) {
    if (p.garnish.includes(x)) p.garnish = p.garnish.filter((g) => g !== x);
    else if (p.garnish.length < GARNISH_MAX) p.garnish.push(x);
    else return null;
    return 'draw';
  }
  return null;
}
