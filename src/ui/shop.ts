// 상인 상점 덮개 (상단 바 아래 전체, docs/UI.md): 왼쪽 30% 상인 (스탠딩 · 이름 · 말풍선 · 고르곤 교환), 오른쪽 70% 진열대
// (머리 = 상점 이름 + 상태 칩, 3×3 진열 · 고른 물품 상세 · 새로고침 · 편성 / 닫기 / 떠나기). 좁은 화면은 상인이 위쪽 띠, 상세는 하단 시트.
// 지정 소집 티켓을 들고 지도를 열면 지정 소집 단추 위에 페트라 광고판 (adHtml · adMount).
// 엔진 규칙 (진열 · 할인 · 새로고침 · 교환 · 티켓)은 engine/run.ts, 상인 · 대사는 data/merchants.ts 에서 읽는다.
import { CFG } from '../config';
import * as R from '../engine/run';
import { CONSUMABLES, itemInfo } from '../data/items';
import { CATWHEEL } from '../data/despair';
import { isPlaceable } from '../data/devices';
import { MERCHANT_BY_ID, PETRA_AD, PETRA_ADS, type MerchantDef, type TalkKey } from '../data/merchants';
import type { RunState, ShopSlot } from '../types';
import { artURL, standURL } from './portraits';
import { lineIcon } from './synicons';

export interface ShopDeps {
  run(): RunState | null;
  itemIcon(id: string | null, attrs?: string): string;
  itemBrief(id: string): { stats: string; eff: string };
  statIc(html: string): string;
  devicePop(run: RunState, id: string): string;
  kvChip(label: string, val: string, title?: string, cls?: string): string;
  /** 크레딧 아이콘 */
  CR: string;
  /** 대상 옆 ✕ / ✓ 확인 팝업 (main.ts askPop) */
  ask(anchor: string[], html: string, okLabel: string, ok: () => void): void;
  toast(msg: string): void;
  persist(): void;
  sfx(name: string): void;
}
let D: ShopDeps;
export function shopInit(d: ShopDeps) { D = d; }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 화면 상태 (저장하지 않음): 상세를 보는 칸 · 가격표 옆 오류 · 말풍선 · 교환 고르기 · 새로고침 오류 */
export const SHOP = {
  key: '',
  sel: null as number | null,
  err: null as { i: number; msg: string } | null,
  rfErr: '',
  tradeMsg: '',
  talk: { text: '', n: 0 },
  shown: -1,
  trade: null as null | { pick: number | null },
  pitched: false,
  last: {} as Record<string, number>,
  idleT: 0,
};

/** 상인이 있는 상점 노드 (정비 · 합성 공방은 예전 진열대) */
export const merchantOf = (run: RunState | null): MerchantDef | null => (run?.node?.type === 'shop' && run.node.merchant ? MERCHANT_BY_ID[run.node.merchant] || null : null);
const nodeKey = (run: RunState) => `${run.phase}:${run.step}:${run.node?.merchant}`;
function sync(run: RunState) {
  const k = nodeKey(run);
  if (k === SHOP.key) return;
  Object.assign(SHOP, { key: k, sel: null, err: null, rfErr: '', tradeMsg: '', trade: null, pitched: false });
}
/** 대사 한 줄 고르기 (같은 상황에서 바로 앞 줄은 피한다) */
export function line(m: MerchantDef, k: TalkKey): string {
  const ls = m.lines[k]?.length ? m.lines[k] : m.lines.idle;
  if (!ls.length) return '';
  const prev = SHOP.last[`${m.id}:${k}`] ?? -1;
  let i = Math.floor(Math.random() * ls.length);
  if (ls.length > 1 && i === prev) i = (i + 1) % ls.length;
  SHOP.last[`${m.id}:${k}`] = i;
  return ls[i];
}
export function say(run: RunState, k: TalkKey) {
  const m = merchantOf(run);
  if (!m) return;
  const t = line(m, k);
  if (t) SHOP.talk = { text: t, n: SHOP.talk.n + 1 };
}
/** 닫기 · 떠나기: 덮개가 사라지므로 상인의 마지막 말은 알림으로 */
export function farewell(run: RunState, k: 'close' | 'leave') {
  const m = merchantOf(run);
  if (m) D.toast(`${m.name}: ${line(m, k)}`);
}
/** 상점 화면을 열 때 (render 가 다른 화면에서 넘어올 때 · 불러올 때): 처음이면 인사, 다시 열면 재방문 인사. 처음 연 것이면 true (저장할 것) */
export function onOpen(run: RunState): boolean {
  const m = merchantOf(run);
  if (!m || !run.node) return false;
  sync(run);
  SHOP.trade = null;
  const first = !run.node.met;
  say(run, first ? 'greet' : 'again');
  run.node.met = true;
  return first;
}

// ───────── 진열 분류 · 표시
const KIND: Record<string, string> = { L: '전설', A: '희귀', G: '고급', M: '문장', C: '재료', KL: '전설 소모품', K: '소모품' };
export const kindName = (id: string) => (isPlaceable(id) ? '배치 소모품' : KIND[R.shopKind(id)]);
/** 고른 칸에 맞는 말: 품절 · 전용 · 전설 · 할인 · 분류 */
function selTalk(s: ShopSlot): TalkKey {
  if (s.sold) return 'sold';
  if (s.ex) return 'ex';
  const k = R.shopKind(s.item);
  if (k === 'L') return 'selL';
  if (s.off) return 'sale';
  return k === 'KL' ? 'selK' : (`sel${k}` as TalkKey);
}
const tierCls = (id: string) => (CONSUMABLES[id]?.legend ? 'L' : itemInfo(id).tier);
/** 칸의 짧은 성질 한 줄 (넓은 화면만): 능력치 줄이 있으면 그것, 없으면 효과 문장 */
function cardEff(id: string) {
  const { stats, eff } = D.itemBrief(id);
  return stats ? `<span class="sg-eff">${stats}</span>` : eff ? `<span class="sg-eff tx">${D.statIc(esc(eff))}</span>` : '';
}
/** 가격표 (진열 칸 · 상세 공용). src: c = 칸 · d = 상세 (확인 팝업이 누른 쪽 옆에 뜨게) */
function tag(run: RunState, s: ShopSlot, i: number, src: 'c' | 'd') {
  if (s.sold) return '<span class="sg-sold">품절</span>';
  const poor = run.credits < s.price;
  const tip = `${s.base ? `원래 ${s.base} → ` : ''}${s.price} 크레딧${poor ? ' · 크레딧 부족' : ''} — 누르면 구매 확인`;
  return `<button class="sg-tag${poor ? ' poor' : ''}${s.off ? ' sale' : ''}" data-a="shop-buy" data-v="${i}:${src}" data-tag="${src}${i}" title="${esc(tip)}" aria-label="${esc(`${itemInfo(s.item).name} 구매 — ${tip}`)}">${D.CR}${s.base ? `<s>${s.base}</s>` : ''}<b>${s.price}</b></button>`;
}
const silhouette = '<svg class="so-sil" viewBox="0 0 100 160" aria-hidden="true"><circle cx="50" cy="34" r="20"/><path d="M14 160c0-46 14-82 36-82s36 36 36 82z"/></svg>';
function artHtml(m: MerchantDef) {
  const url = standURL(m.art); // 그림이 없거나 못 불러오면 실루엣
  return `<div class="so-art${url ? '' : ' sil'}">${silhouette}${url ? `<picture><source media="(max-width: 700px)" srcset="${artURL(`${m.art}.bust.webp`)}"><img alt="${esc(m.name)}" decoding="async" src="${url}" onerror="this.closest('.so-art').classList.add('sil')"></picture>` : ''}</div>`;
}

// ───────── 덮개
export function shopOverlay(run: RunState): string {
  const m = merchantOf(run);
  const stock = run.node?.shop || [];
  if (!m) return '';
  sync(run);
  if (!SHOP.talk.text) say(run, run.node?.met ? 'again' : 'greet');
  if (SHOP.sel !== null && !stock[SHOP.sel]) SHOP.sel = null;
  const k = R.interestKeep(run), I = R.interestInfo(run);
  const chips = [
    D.kvChip('보유', `${D.CR}<b>${run.credits}</b>`, '에너지 크레딧', 'cr'),
    D.kvChip('이자 지키며 쓸 수 있음', `${D.CR}<b>${k.spend}</b>`, `지금 이자(크레딧 ${k.per}당 1, 상한 ${I.cap})를 줄이지 않고 쓸 수 있는 크레딧 = 보유 ${run.credits} − ${k.per} × ${I.direct ? 0 : I.raw}`, `cr kv-keep${k.spend ? '' : ' zero'}`),
    D.kvChip('이자', `<b>+${k.keep}</b><small>유지</small>`, '위 금액까지만 쓰면 다음 전투를 마칠 때 받는 이자', 'kv-int'),
    D.kvChip('보관함', `<b>${run.inventory.length}</b>/${CFG.inventoryMax}`, '산 물품이 들어가는 곳', `kv-inv${run.inventory.length >= CFG.inventoryMax ? ' full' : ''}`),
  ].join('');
  const sold = stock.filter((s) => s.sold).length;
  const rf = R.refreshInfo(run), rfOff = rf.used || !!run.tutorial;
  const rfWhy = run.tutorial ? '튜토리얼' : rf.used ? `이번 페이즈 사용함 · 다음 ${rf.cost ? `${rf.cost}` : '무료'}` : '';
  const rfBtn = `<button class="btn small so-rf" data-a="shop-refresh"${rfOff ? ' aria-disabled="true"' : ''} title="${esc(`진열 9칸 · 할인을 모두 새로 (품절 칸 포함, 상인 그대로). 페이즈마다 1번 · 의뢰 첫 번 무료, 그다음 ${CFG.shop.refresh.base}부터 +${CFG.shop.refresh.step}`)}">${lineIcon('a.cd', 'li')}<span>새로고침</span>${rf.cost ? `<b>${D.CR}${rf.cost}</b>` : '<b class="free">무료</b>'}</button>`;
  const cards = stock.map((s, i) => {
    const id = s.item, on = SHOP.sel === i;
    const err = SHOP.err?.i === i ? `<em class="sg-err" role="status">${esc(SHOP.err.msg)}</em>` : '';
    return `<div class="sg-card t${tierCls(id)}${on ? ' on' : ''}${s.sold ? ' sold' : ''}${s.ex ? ' ex' : ''}" data-a="shop-sel" data-v="${i}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${esc(`${itemInfo(id).name} · ${kindName(id)}${s.sold ? ' · 품절' : ` · ${s.price} 크레딧`}`)}">
      <span class="sg-top">${D.itemIcon(id)}<span class="sg-kind">${s.ex ? `<i class="sg-ex">전용</i>` : ''}${esc(kindName(id))}</span></span>
      <b class="sg-name">${esc(itemInfo(id).name)}</b>${cardEff(id)}
      <span class="sg-foot">${tag(run, s, i, 'c')}${s.off && !s.sold ? `<i class="sg-off" title="할인">−${s.off}%</i>` : ''}</span>${err}
    </div>`;
  }).join('');
  return `<div class="shop-ov" style="--c:${m.color}" role="region" aria-label="${esc(m.shop)}">
    <section class="so-npc" aria-label="${esc(m.name)}">
      ${artHtml(m)}
      <div class="so-bub" role="status" aria-live="polite"><b>${esc(m.name)}</b><span>${esc(SHOP.talk.text)}</span></div>
      <div class="so-plate"><h2>${esc(m.name)}</h2><small>${esc(m.title)}</small>${m.trade ? tradeBtn(run) : ''}</div>
    </section>
    ${m.trade && SHOP.trade ? tradePop(run) : ''}
    <section class="so-main">
      <div class="so-hd"><h1>${esc(m.shop)}</h1><div class="sh-row">${chips}</div></div>
      <div class="so-body">
        <div class="so-shelf">
          <div class="so-tools"><span class="so-cnt">진열 <b>${stock.length - sold}</b>/${stock.length}${sold ? ` · 품절 ${sold}` : ''}</span><span class="so-rfw">${rfWhy || SHOP.rfErr ? `<span class="so-why">${esc(SHOP.rfErr || rfWhy)}</span>` : ''}${rfBtn}</span></div>
          <div class="sg">${cards}</div>
        </div>
        ${detail(run, stock)}
      </div>
      <div class="so-foot"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn" data-a="shop-close" title="상점을 닫고 지도로 (이 칸은 그대로 — 지도에서 다시 열 수 있음)">닫기</button><button class="btn primary" data-a="leave-shop" title="이 상점을 떠나 다음 칸으로">떠나기</button></div>
    </section>
  </div>`;
}

/** 고른 칸 상세 (진열대를 가리지 않는 오른쪽 칸 · 좁은 화면은 하단 시트): 이름 · 분류 → 성질 → 구매 → 세부 규칙 (docs/UI.md 12) */
function detail(run: RunState, stock: ShopSlot[]) {
  const i = SHOP.sel, s = i === null ? null : stock[i];
  if (!s || i === null) return '<aside class="sd empty" aria-label="물품 상세"><p>물품을 누르면 여기에 설명이 나옵니다.</p></aside>';
  const id = s.item, it = itemInfo(id), { stats, eff } = D.itemBrief(id);
  const own = run.inventory.filter((x) => x === id).length;
  const k = R.interestKeep(run), after = s.sold || run.credits < s.price ? k.keep : k.after(s.price); // 살 수 없는 칸은 이자 변화를 보이지 않는다
  const st = [
    s.ex ? D.kvChip('상인 전용', '<b>늘 진열</b>', '이 상인의 상점에만 늘 진열되는 상품', 'kv-ex') : '',
    own ? D.kvChip('보유', `<b>${own}</b>`) : '',
    s.off && !s.sold ? D.kvChip('할인', `<b>−${s.off}%</b>`, `원래 ${s.base}`, 'kv-sale') : '',
  ].filter(Boolean).join('');
  const intNote = !s.sold && after !== k.keep ? `<span class="sd-int">이자 <b>+${k.keep} → +${after}</b></span>` : '';
  const rules = id === R.TICKET ? ticketRules(run) : isPlaceable(id) ? D.devicePop(run, id) : '';
  return `<aside class="sd" aria-label="${esc(it.name)} 상세">
    <div class="sd-head">${D.itemIcon(id)}<div><span class="sd-kind">${esc(kindName(id))}</span><b class="sd-name t${tierCls(id)}">${esc(it.name)}</b></div><button class="btn tiny sd-x" data-a="shop-sel" data-v="${i}" aria-label="상세 닫기">×</button></div>
    ${st ? `<div class="sd-st">${st}</div>` : ''}
    ${stats}${eff ? `<p class="ip-eff">${D.statIc(esc(eff))}</p>` : ''}
    <div class="sd-buy">${tag(run, s, i, 'd')}${intNote}${SHOP.err?.i === i ? `<em class="sg-err">${esc(SHOP.err.msg)}</em>` : ''}</div>
    ${rules ? `<div class="sd-rules">${rules}</div>` : ''}
  </aside>`;
}
/** 지정 소집 티켓 규칙 (이름 + 값) */
function ticketRules(run: RunState) {
  const rows: [string, string][] = [
    ['쓰는 곳', '지도 · 함선 관리의 지정 소집'],
    ['소집 비용', `${R.musterCost(run)} → 0 (티켓 1장)`],
    ['광고', `지도를 열 때마다 ${AD.ms / 1000}초 · ${AD.skip / 1000}초 뒤 건너뛰기`],
    ['직접 사용', '불가 · 판매 가능'],
  ];
  return `<dl class="dev-spec">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
}

// ───────── 고르곤 교환 (상점 칸이 아닌 서비스): 보관함 고급 · 희귀 1개 → 재료 3개, 상점마다 1번
function tradeBtn(run: RunState) {
  const used = !!run.node?.traded;
  return `<span class="so-tr"><button class="btn small so-trade-b${SHOP.trade ? ' on' : ''}" data-a="shop-trade"${used ? ' aria-disabled="true"' : ''} aria-expanded="${!!SHOP.trade}" title="보관함의 고급 · 희귀 장비 1개를 녹여 재료 3개로 (상점마다 1번)">${lineIcon('a.reload', 'li')}<span>${used ? '교환함' : '교환'}</span>${used ? '' : '<b>1회</b>'}</button>${SHOP.tradeMsg ? `<span class="so-why">${esc(SHOP.tradeMsg)}</span>` : ''}</span>`;
}
const askIt = (html: string, name: string) => `<span class="ask-it">${html}<span>${esc(name)}</span></span>`;
function tradePop(run: RunState) {
  const opts = R.tradeOptions(run), pick = SHOP.trade?.pick ?? null;
  const id = pick !== null ? run.inventory[pick] : null;
  const y = id ? R.tradeYield(id) : null;
  const q = '<span class="item tC so-q" title="무작위 재료 — 녹인 뒤 공개">?</span>';
  const eq = id && y ? `<div class="ask-eq">${askIt(D.itemIcon(id), itemInfo(id).name)}<b>→</b>${y.fixed.map((c) => askIt(D.itemIcon(c), itemInfo(c).name)).join('')}${[...Array(y.rand)].map(() => askIt(q, '무작위')).join('')}</div>` : '';
  const err = pick !== null ? R.tradeErr(run, pick) : null;
  return `<div class="so-trade" role="dialog" aria-label="장비 녹이기">
    <b class="ask-t">${lineIcon('a.reload', 'li')} 장비 녹이기 <small>상점마다 1번</small></b>
    <div class="st-pick">${opts.map((i) => D.itemIcon(run.inventory[i], `data-a="shop-trade-pick" data-v="${i}" role="button" tabindex="0"`).replace('class="item', `class="item${i === pick ? ' sel' : ''}`)).join('')}</div>
    ${eq || '<p class="ask-note muted">녹일 고급 · 희귀 장비를 고르세요 (장착한 장비 제외)</p>'}
    ${y && y.rand ? `<p class="ask-note muted">? = 무작위 재료 — 녹인 뒤 공개${y.fixed.length ? '' : ' (조합법이 없는 장비)'}</p>` : ''}
    ${err ? `<p class="ask-note warn">${esc(err)}</p>` : ''}
    <div class="ask-btns"><button class="btn ask-x" data-a="shop-trade-x" title="취소 (Esc)" aria-label="취소"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><button class="btn primary ask-v" data-a="shop-trade-ok" title="녹이기" aria-label="녹이기" ${id && !err ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg></button></div>
  </div>`;
}

// ───────── 동작 (main.ts act 가 먼저 넘긴다): 처리했으면 true (그 뒤 main 이 다시 그린다)
export function shopAct(run: RunState | null, a: string, v: string): boolean {
  if (!run || !a.startsWith('shop-') || a === 'shop-close') return false;
  const m = merchantOf(run), stock = run.node?.shop;
  if (!m || !stock) return true;
  sync(run);
  switch (a) {
    case 'shop-sel': {
      const i = +v;
      if (!stock[i]) break;
      SHOP.err = null; SHOP.rfErr = '';
      if (SHOP.sel === i) { SHOP.sel = null; break; }
      SHOP.sel = i;
      say(run, selTalk(stock[i]));
      break;
    }
    case 'shop-buy': {
      const [si, src] = v.split(':'), i = +si, s = stock[i];
      if (!s) break;
      SHOP.sel = i; SHOP.rfErr = '';
      if (s.sold) { say(run, 'sold'); break; }
      if (run.credits < s.price) { SHOP.err = { i, msg: '크레딧 부족' }; say(run, 'poor'); D.sfx('error'); break; }
      if (run.inventory.length >= CFG.inventoryMax) { SHOP.err = { i, msg: '보관함 가득' }; say(run, 'full'); D.sfx('error'); break; }
      SHOP.err = null;
      say(run, selTalk(s));
      const k = R.interestKeep(run), after = k.after(s.price);
      const html = `<b class="ask-t">${D.itemIcon(s.item)} ${esc(itemInfo(s.item).name)}</b>
        <div class="sb-pay">${D.CR}${s.base ? `<s>${s.base}</s>` : ''}<b>${s.price}</b><span class="muted">→ 남는 크레딧 <b>${run.credits - s.price}</b></span></div>
        ${after !== k.keep ? `<p class="ask-note warn">이자 +${k.keep} → +${after}</p>` : ''}`;
      D.ask([`.shop-ov [data-tag="${src}${i}"]`, `.shop-ov [data-tag="c${i}"]`], html, '구매', () => {
        const it = s.item, e = R.buyShop(run, i);
        if (e) { SHOP.err = { i, msg: e === '크레딧 부족' ? e : e === '인벤토리 가득 참' ? '보관함 가득' : e }; say(run, e === '크레딧 부족' ? 'poor' : 'full'); return; }
        SHOP.err = null;
        say(run, 'buy');
        D.sfx('buy');
        if (it !== CATWHEEL && run.inventory[run.inventory.length - 1] === CATWHEEL) D.toast(`유닉스제 대량 생산 — ${itemInfo(it).name} 대신 캣휠이 들어왔습니다.`);
        D.persist();
      });
      break;
    }
    case 'shop-refresh': {
      const e = R.refreshShop(run);
      if (e) { SHOP.rfErr = e === '크레딧 부족' ? '크레딧 부족' : ''; say(run, e === '크레딧 부족' ? 'poor' : 'norefresh'); D.sfx('error'); break; }
      SHOP.sel = null; SHOP.err = null; SHOP.rfErr = '';
      say(run, 'refresh');
      D.sfx('reroll');
      D.persist();
      break;
    }
    case 'shop-trade': {
      SHOP.tradeMsg = '';
      if (SHOP.trade) { SHOP.trade = null; break; }
      if (run.node?.traded) { SHOP.tradeMsg = '이 상점에서 교환함'; say(run, 'tradeUsed'); break; }
      if (!R.tradeOptions(run).length) { SHOP.tradeMsg = '녹일 고급 · 희귀 없음'; say(run, 'tradeNone'); break; }
      SHOP.trade = { pick: null };
      say(run, 'tradeOffer');
      break;
    }
    case 'shop-trade-pick': if (SHOP.trade) SHOP.trade.pick = +v; break;
    case 'shop-trade-x': SHOP.trade = null; break;
    case 'shop-trade-ok': {
      const pick = SHOP.trade?.pick;
      if (pick === null || pick === undefined) break;
      const id = run.inventory[pick], r = R.gorgonTrade(run, pick);
      if (r.err) { D.toast(`${r.err}.`); break; }
      SHOP.trade = null; SHOP.tradeMsg = '';
      say(run, 'tradeDone');
      D.sfx('buy');
      D.toast(`교환: ${itemInfo(id).name} → ${r.got!.map((x) => itemInfo(x).name).join(' · ')}`);
      D.persist();
      break;
    }
  }
  return true;
}
/** Esc: 교환 창 → 상세 순서로 닫는다. 닫은 것이 있으면 true */
export function shopEscape(): boolean {
  if (SHOP.trade) { SHOP.trade = null; return true; }
  if (SHOP.sel !== null) { SHOP.sel = null; SHOP.err = null; return true; }
  return false;
}

/** 그린 뒤: 말풍선이 바뀌었으면 짧게 튀어나오고, 가만히 있으면 12초 뒤부터 혼잣말 (전용 상품 · 교환 권유 먼저) */
export function shopMount(root: HTMLElement) {
  clearTimeout(SHOP.idleT);
  const bub = root.querySelector<HTMLElement>('.shop-ov .so-bub');
  if (!bub) return;
  if (SHOP.shown !== SHOP.talk.n) { SHOP.shown = SHOP.talk.n; pop(bub); }
  let n = 0;
  const idle = () => {
    const run = D.run(), m = merchantOf(run), b = document.querySelector<HTMLElement>('.shop-ov .so-bub span');
    if (!run || !m || !b) return;
    const ex = m.ex && run.node?.shop?.some((s) => s.item === m.ex && !s.sold), tr = m.trade && !run.node?.traded;
    say(run, !SHOP.pitched && (ex || tr) ? 'pitch' : 'idle');
    SHOP.pitched = true;
    b.textContent = SHOP.talk.text;
    SHOP.shown = SHOP.talk.n;
    pop(b.parentElement!);
    if (++n < 3) SHOP.idleT = window.setTimeout(idle, 15000);
  };
  SHOP.idleT = window.setTimeout(idle, 12000);
}
function pop(el: HTMLElement) {
  if (reduced()) return;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

// ───────── 페트라 광고판 (지정 소집 티켓): 지도를 열 때마다 지정 소집 단추 위에 AD.ms 동안, AD.skip 뒤 [광고 건너뛰기]
export const AD = PETRA_AD;
const ad = { at: 0, first: 0, timer: 0 };
/** 지도 화면이 열릴 때 (티켓을 들고 있으면) */
export function adStart() { ad.at = performance.now(); ad.first = Math.floor(Math.random() * PETRA_ADS.length); }
export function adStop() { ad.at = 0; clearInterval(ad.timer); document.querySelector('.ad-led')?.remove(); }
const adLeft = () => (ad.at ? AD.ms - (performance.now() - ad.at) : 0);
export function adHtml(run: RunState): string {
  if (!R.ticketCount(run) || adLeft() <= 0) return '';
  const el = performance.now() - ad.at;
  const ls = [...PETRA_ADS.slice(ad.first), ...PETRA_ADS.slice(0, ad.first)];
  const run1 = ls.map((t) => `<span>${esc(t)}</span>`).join('<i>◆</i>');
  const chars = ls.join('').length;
  const cur = ls[Math.floor(el / 4000) % ls.length];
  return `<div class="ad-led" role="status" aria-label="페트라 광고" style="--d:${Math.round(chars * 0.2)}s">
    <div class="ad-top"><b>PETRA</b><small>협찬 광고 · 지정 소집 티켓 ${R.ticketCount(run)}장</small><span class="ad-skip">${skipHtml(el)}</span></div>
    <div class="ad-scr"><div class="ad-track" style="animation-delay:-${Math.round(el)}ms">${run1}<i>◆</i>${run1}<i>◆</i></div><p class="ad-one">${esc(cur)}</p></div>
  </div>`;
}
const skipHtml = (el: number) => (el >= AD.skip ? '<button class="btn tiny ad-skip-b" data-a="ad-skip">광고 건너뛰기</button>' : `<span class="ad-cnt" title="${AD.skip / 1000}초 뒤 건너뛸 수 있음">${Math.ceil((AD.skip - el) / 1000)}</span>`);
/** 그린 뒤: 건너뛰기 초읽기 · 시간이 다 되면 스스로 닫힌다 (다시 그리지 않고 그 자리만 바꾼다) */
export function adMount(root: HTMLElement) {
  clearInterval(ad.timer);
  if (!root.querySelector('.ad-led')) return;
  ad.timer = window.setInterval(() => {
    const box = document.querySelector<HTMLElement>('.ad-led');
    if (!box || adLeft() <= 0) { adStop(); return; }
    const el = performance.now() - ad.at, sk = box.querySelector<HTMLElement>('.ad-skip');
    const want = el >= AD.skip ? 'b' : String(Math.ceil((AD.skip - el) / 1000));
    if (sk && sk.dataset.st !== want) { sk.dataset.st = want; sk.innerHTML = skipHtml(el); }
    const one = box.querySelector<HTMLElement>('.ad-one'), ls = [...PETRA_ADS.slice(ad.first), ...PETRA_ADS.slice(0, ad.first)];
    if (one) one.textContent = ls[Math.floor(el / 4000) % ls.length];
  }, 250);
}
export const adOn = () => adLeft() > 0;
