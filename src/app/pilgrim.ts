// 순례 성소 덮개 (상단 바 아래 전체, docs/UI.md): 인물 없이 촛불 제단 · 봉헌함 · 성유물 진열장으로 이루어진 성소.
//   머리 = 제목 + 상태 칩 (권능 · 고르기 · 이번 페이즈 축복) + [순례 마치기]
//   제단 = 고르기 카드 3장 (제례 · 나눔, 무료로 1장) — 카드 위 촛불은 받은 카드만 켜져 남는다
//   봉헌함 = 보유 디바인의 봉헌 게이지 ('지금 → 다음' 칩) · 축성 단추. 제례 카드를 누르면 받을 몫이 게이지에 미리 보이고, 받으면 그 자리에서 차오른다
//   진열장 = 권능으로 사는 성유물 (가격표 = 구매 단추) · 개종
// 받기 · 구매 · 개종 · 그냥 떠나기 확인은 대상 옆 ✕ / ✓ (app.ask, app/popups.ts). 엔진 규칙은 engine/run.ts (genPilgrim · pilgrimTake · pilgrimRelic · pilgrimConvert · consecrate), 수치는 CFG.rite · alms · pilgrim · offer · consecrate
import { CFG } from '../config';
import { BLESSING_BY_ID } from '../data/globals';
import { itemInfo, tierKey } from '../data/items';
import { offerNeed, offerStage, RELIC_BY_ID } from '../data/relics';
import { FAITH_DEF } from '../data/rework';
import { UNIT_BY_ID } from '../data/units';
import * as R from '../engine/run';
import { FAITH_NAME, type FaithId, type Pending, type PilOffer, type RunState, type UnitState } from '../types';
import { lineIcon } from '../ui/synicons';
import { abTok } from './abilities';
import { itemIcon, sprite, statIc } from './common';
import { CR } from './map';
import { kvChip } from './modals';
import { app, esc, persist, toast } from './state';
import { consBtn, offerGauge, relicTok } from './unitparts';

type Pil = Extract<Pending, { t: 'pilgrim' }>;
/** 화면 상태 (저장하지 않음): 확인을 기다리는 고르기 카드 (봉헌함 미리보기) · 그냥 떠나기 확인 중 · 방금 받은 봉헌 (게이지가 차오를 기물 → 받기 전 봉헌 누계).
 *  확인 팝업이 떠 있는 채로 같은 카드 · 같은 [순례 마치기]를 다시 누르면 ✓ 와 같다 (docs/UI.md 11: 첫 누름 = 후보, 같은 자리 다시 누름 = 확정) */
const PIL = { key: '', ask: null as number | null, leaving: false, grow: {} as Record<string, number> };
const pilKey = (run: RunState) => `${run.seed}:${run.phase}:${run.step}`;
function sync(run: RunState) {
  const k = pilKey(run);
  if (k !== PIL.key) Object.assign(PIL, { key: k, ask: null, leaving: false, grow: {} });
  if (!app.ask) { PIL.ask = null; PIL.leaving = false; } // 확인 팝업이 닫히면 미리보기 · 떠나기 확인도 끈다
}
const faithOf = (u: UnitState) => u.faith || UNIT_BY_ID[u.defId].faith;
const faithTok = (f: FaithId) => abTok(`faith.${f}`) || lineIcon('a.divact', 'li');
const powIc = () => lineIcon('a.power', 'li pw');

// ───────── 제단: 고르기 카드
/** 카드 위 촛불 (켜짐 = 아직 고를 수 있거나 받은 카드, 꺼짐 = 받지 않은 카드) */
const candle = (lit: boolean) => `<svg class="pil-cand${lit ? ' lit' : ''}" viewBox="0 0 40 60" aria-hidden="true"><path class="fl" d="M20 4c-3.5 5-4.6 8.6-2.2 12.2a2.6 2.6 0 0 0 4.4 0C24.6 12.6 23.5 9 20 4z"/><path class="wk" d="M20 17.5v3.5"/><rect class="wx" x="14" y="21" width="12" height="31"/><path class="bs" d="M7 54h26"/></svg>`;
function riteBody(run: RunState, o: Extract<PilOffer, { k: 'rite' }>) {
  const us = R.riteUnits(run, o.faith);
  const who = us.length ? us.map((u) => {
    const d = UNIT_BY_ID[u.defId], st = offerStage(u.offer), st2 = offerStage((u.offer || 0) + o.gain);
    return `<li>${sprite(d)}<b>${esc(d.name)}</b>${u.pos ? '' : '<small class="pil-bench">대기</small>'}<span class="pil-st">${st2 > st ? `${st}<i>→</i><b>${st2}단계</b>` : `${st}단계`}</span></li>`;
  }).join('') : '<li class="muted small">이 신앙의 디바인이 없습니다</li>';
  const bl = o.bless ? BLESSING_BY_ID[o.bless] : null;
  return `<div class="pil-ch">${faithTok(o.faith)}<span><small>제례</small><b>${esc(FAITH_NAME[o.faith])}</b></span></div>
    <ul class="pil-who">${who}</ul>
    <div class="pil-vs"><span class="pil-v"><small>봉헌</small><b>+${o.gain}</b></span><span class="pil-v"><small>대상</small><b>${us.length}명</b></span></div>
    ${bl ? `<div class="pil-bl"><span class="pil-bk">${lineIcon('a.divact', 'li')}축복 · 이번 페이즈</span><b>${esc(bl.name)}</b><small>${statIc(esc(bl.desc))}</small></div>` : ''}`;
}
function almsBody(o: Extract<PilOffer, { k: 'alms' }>) {
  return `<div class="pil-ch"><span class="pil-ic">${lineIcon('n.supply', 'li')}</span><span><small>나눔</small><b>재료 ${o.items.length}개</b></span></div>
    <ul class="pil-items">${o.items.map((id) => `<li>${itemIcon(id)}<span class="t${tierKey(id)}">${esc(itemInfo(id).name)}</span></li>`).join('')}</ul>
    <div class="pil-vs"><span class="pil-v"><small>가치</small><b>${CR}${o.value}</b></span></div>`;
}
function card(run: RunState, p: Pil, o: PilOffer, i: number) {
  const took = p.took !== undefined, mine = p.took === i, asking = PIL.ask === i && !!app.ask;
  const body = o.k === 'rite' ? riteBody(run, o) : almsBody(o);
  const cls = `pil-card k-${o.k}${mine ? ' took' : took ? ' off' : ''}${asking ? ' on' : ''}`;
  const foot = mine ? '<span class="pil-stamp">받음</span>' : took ? '' : '<span class="pil-free">무료</span>';
  const attrs = took ? 'aria-disabled="true"' : `data-a="pil-take" data-v="${i}" role="button" tabindex="0" aria-pressed="${asking}"`;
  return `<div class="${cls}" data-i="${i}" ${attrs}>${candle(!took || mine)}<div class="pil-cb">${body}</div>${foot}</div>`;
}

// ───────── 봉헌함
function boxRow(run: RunState, p: Pil, u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  const o = PIL.ask !== null && app.ask ? p.offers[PIL.ask] : null;
  const plus = o?.k === 'rite' && o.faith === faithOf(u) ? o.gain : 0;
  const from = PIL.grow[u.uid];
  let g = offerGauge(d, u.offer, plus);
  if (from !== undefined) { // 방금 받은 봉헌: 받기 전 자리에서 차오른다 (같은 단계 안일 때만, 단계가 오르면 새 단계 게이지 그대로)
    const st0 = offerStage(from), st1 = offerStage(u.offer);
    if (st0 === st1) g = g.replace('<div class="of-bar"', `<div class="of-bar grow" style="--from:${gaugePct(from)}%"`);
    else g = g.replace('class="of-g', 'class="of-g up');
  }
  return `<li class="pil-row${plus ? ' hl' : ''}"><span class="pil-u">${sprite(d)}<span><b>${esc(d.name)}</b><small>${faithTok(faithOf(u))}${esc(FAITH_NAME[faithOf(u)])}${u.pos ? '' : ' · 대기'}</small></span></span>${g}${consBtn(run, u, 'pil-cons')}</li>`;
}
/** 같은 단계 안에서의 게이지 비율 (%) — offerGauge 와 같은 식 */
function gaugePct(offer: number) {
  const st = offerStage(offer);
  if (st >= CFG.offer.max) return 100;
  const lo = offerNeed(st), hi = offerNeed(st + 1);
  return Math.max(0, Math.min(100, ((offer - lo) / (hi - lo)) * 100));
}

// ───────── 진열장: 성유물 · 개종
function relicShelf(run: RunState, p: Pil) {
  const items = p.relics.map((o, i) => {
    const r = RELIC_BY_ID[o.id];
    if (!r) return '';
    const poor = run.power < o.cost;
    const tag = o.sold ? '<span class="pil-sold">판매됨</span>'
      : `<button class="btn pil-tag" data-a="pil-relic" data-v="${i}" ${poor ? 'disabled' : ''} title="권능 ${o.cost}으로 사서 보관함에 넣습니다">${powIc()}${o.cost}</button>${poor ? '<small class="pil-why">권능 부족</small>' : ''}`;
    return `<li class="pil-rl${o.sold ? ' sold' : ''}" data-i="${i}">${relicTok(o.id)}<span class="pil-rn"><b>${esc(r.name)}</b><small>${esc(r.brief)}</small></span><span class="pil-pr">${tag}</span></li>`;
  }).join('');
  return `<ul class="pil-shelf">${items || '<li class="muted small">진열된 성유물이 없습니다.</li>'}</ul>`;
}
function convertBlock(run: RunState, p: Pil) {
  const c = p.convert;
  if (!c) return '';
  const fd = FAITH_DEF[c.faith], poor = run.power < c.cost;
  const us = R.divines(run).map((u) => {
    const d = UNIT_BY_ID[u.defId], same = faithOf(u) === c.faith;
    return `<button class="btn pil-cvu" data-a="pil-conv" data-v="${u.uid}" ${c.sold || same || poor ? 'disabled' : ''} title="${esc(same ? '이미 그 신앙입니다' : `${d.name}: ${FAITH_NAME[faithOf(u)]} → ${FAITH_NAME[c.faith]}`)}">${sprite(d)}<span>${esc(d.name)}</span><small>${faithTok(faithOf(u))}</small></button>`;
  }).join('');
  return `<div class="pil-cv${c.sold ? ' sold' : ''}"><div class="pil-cvh">${faithTok(c.faith)}<span><small>개종</small><b>${esc(FAITH_NAME[c.faith])}</b></span>${c.sold ? '<span class="pil-sold">마침</span>' : `<span class="pil-price">${powIc()}${c.cost}</span>`}</div>
    <dl class="pil-cvd"><dt>상시</dt><dd>${statIc(esc(fd.buff))}</dd><dt>신성력</dt><dd>${esc(fd.gain)}</dd></dl>
    <div class="pil-cvus">${us}</div>${poor && !c.sold ? '<small class="pil-why">권능 부족</small>' : ''}</div>`;
}

/** 순례 성소 덮개 (pendingModal 이 부른다) */
export function pilgrimScreen(run: RunState, p: Pil): string {
  sync(run);
  const dv = R.divines(run);
  const took = p.took !== undefined;
  const bless = run.blessing ? BLESSING_BY_ID[run.blessing]?.name : '';
  const head = `<header class="pil-head mt-hd hd-row" style="--hdc:var(--c-divine)"><h1 data-k="PILGRIM · SANCTUARY">${lineIcon('n.pilgrim', 'li')}순례</h1>
    <div class="pil-chips">${kvChip('권능', `<b>${run.power}</b>`, '디바인이 전투에서 모은 신성력으로 얻는다 · 성유물 · 개종 · 축성에 쓴다', 'pil-pw')}${kvChip('고르기', `<b>${took ? 1 : 0}</b>/1`, '제단의 카드 중 1장을 무료로 받는다')}${kvChip('축복', bless ? `<b>${esc(bless)}</b>` : '없음', '이번 페이즈 동안 모든 아군에게 (제례를 받으면 그 신앙의 축복)')}</div>
    <button class="btn primary pil-done" data-a="pilgrim-done">순례 마치기</button></header>`;
  // 제단 뒤 벽: 아치 · 촛대 선반 · 작은 봉헌 촛불 (정적, 명암 없음)
  const wall = `<svg class="pil-wall" viewBox="0 0 600 80" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path class="ar" d="M120 80V44a180 40 0 0 1 360 0v36"/><path class="ar" d="M150 80V48a150 32 0 0 1 300 0v32"/><path class="sh" d="M40 78h520"/>${[60, 90, 510, 540].map((x, i) => `<g class="vt"><rect x="${x - 5}" y="${62 - (i % 2) * 6}" width="10" height="${16 + (i % 2) * 6}"/><path class="fl" d="M${x} ${52 - (i % 2) * 6}c-2.4 3.2-3 5.6-1.4 7.8a1.7 1.7 0 0 0 2.8 0c1.6-2.2 1-4.6-1.4-7.8z"/></g>`).join('')}</svg>`;
  const altar = `<section class="pil-altar" aria-label="촛불 제단">${wall}<div class="pil-cards">${p.offers.map((o, i) => card(run, p, o, i)).join('')}</div><div class="pil-cloth" aria-hidden="true"></div></section>`;
  const box = `<section class="pil-box" aria-label="봉헌함"><h2>${lineIcon('k.offer', 'li')}봉헌함<small>${dv.length}명</small></h2>${dv.length ? `<ul class="pil-rows">${dv.map((u) => boxRow(run, p, u)).join('')}</ul>` : '<p class="muted small">디바인 기물이 없습니다.</p>'}</section>`;
  const cabinet = `<aside class="pil-case" aria-label="성유물 진열장"><h2>${lineIcon('k.relic', 'li')}성유물 진열장</h2>${relicShelf(run, p)}${convertBlock(run, p)}</aside>`;
  PIL.grow = {}; // 차오르는 연출은 받은 직후 한 번만
  return `<div class="pil-ov" role="dialog" aria-label="순례">${head}<div class="pil-body"><div class="pil-main">${altar}${box}</div>${cabinet}</div></div>`;
}

/** 순례 조작 (main.ts act 가 먼저 부른다). 처리했으면 true */
export function pilgrimAct(run: RunState | null, a: string, v: string): boolean {
  const p = run?.pending.find((x): x is Pil => x.t === 'pilgrim');
  if (!run || !p) return false;
  if (a === 'pil-relic' || a === 'pil-conv' || a === 'consecrate') { PIL.ask = null; PIL.leaving = false; } // 다른 확인으로 넘어가면 카드 · 떠나기 확인은 끝
  if (a === 'consecrate') { // 봉헌함의 축성: 게이지가 그 자리에서 차오른다 (main.ts 의 축성과 같은 동작)
    const u = run.units.find((x) => x.uid === v), from = u?.offer || 0;
    const e = R.consecrate(run, v);
    if (!e && u) PIL.grow = { [u.uid]: from };
    toast(e || `축성: 봉헌 +${CFG.consecrate.gain}`);
    persist();
    return true;
  }
  if (a === 'pil-take') {
    const i = +v, o = p.offers[i];
    if (!o || p.took !== undefined) return true;
    const again = PIL.ask === i; // 확인 중인 카드를 다시 누름 = 받기
    PIL.ask = i; PIL.leaving = false;
    const html = o.k === 'rite'
      ? `<b class="ask-t">${faithTok(o.faith)} 제례 · ${esc(FAITH_NAME[o.faith])}</b><p class="ask-note">${esc(R.riteUnits(run, o.faith).map((u) => UNIT_BY_ID[u.defId].name).join(' · ') || '대상 없음')} 봉헌 +${o.gain}${o.bless ? ` · 축복 ${esc(BLESSING_BY_ID[o.bless]?.name || '')}` : ''}</p><p class="ask-note">다른 카드는 받을 수 없게 됩니다.</p>`
      : `<b class="ask-t">${lineIcon('n.supply', 'li')} 나눔</b><div class="ask-eq">${o.items.map((id) => `<span class="ask-it">${itemIcon(id)}<span>${esc(itemInfo(id).name)}</span></span>`).join('')}</div><p class="ask-note">다른 카드는 받을 수 없게 됩니다.</p>`;
    const take = () => {
      const before: Record<string, number> = Object.fromEntries(R.divines(run).map((u) => [u.uid, u.offer || 0]));
      const r = R.pilgrimTake(run, i);
      if (r.err) { toast(r.err); return; }
      PIL.grow = Object.fromEntries(R.divines(run).filter((u) => (u.offer || 0) > before[u.uid]).map((u) => [u.uid, before[u.uid]]));
      PIL.ask = null;
      if (r.msg) toast(r.msg);
      persist();
    };
    if (again) { app.ask = null; take(); return true; }
    app.ask = { anchor: [`.pil-card[data-i="${i}"]`], at: 'below', okLabel: '받기', html, ok: take };
    return true;
  }
  if (a === 'pil-relic') {
    const o = p.relics[+v], r = o ? RELIC_BY_ID[o.id] : null;
    if (!o || !r || o.sold) return true;
    app.ask = { anchor: [`.pil-rl[data-i="${v}"] .pil-tag`, `.pil-rl[data-i="${v}"]`], at: 'below', okLabel: '구매',
      html: `<b class="ask-t">${relicTok(r.id)} ${esc(r.name)}</b><p class="ask-note">권능 ${o.cost} → 남은 권능 ${run.power - o.cost}. 보관함에 넣고, 디바인에게 끌어다 놓아 장착합니다.</p>`,
      ok: () => { const e = R.pilgrimRelic(run, +v); toast(e || '성유물을 보관함에 넣었습니다'); persist(); } };
    return true;
  }
  if (a === 'pil-conv') {
    const c = p.convert, u = run.units.find((x) => x.uid === v);
    if (!c || !u) return true;
    const d = UNIT_BY_ID[u.defId];
    app.ask = { anchor: [`.pil-cvu[data-v="${v}"]`], at: 'below', okLabel: '개종',
      html: `<b class="ask-t">개종 · ${esc(d.name)}</b><p class="ask-note">${esc(FAITH_NAME[faithOf(u)])} → ${esc(FAITH_NAME[c.faith])} · 권능 ${c.cost}</p>`,
      ok: () => { const e = R.pilgrimConvert(run, v); toast(e || `${d.name}의 신앙이 ${FAITH_NAME[c.faith]}(으)로 바뀌었습니다`); persist(); } };
    return true;
  }
  if (a === 'pilgrim-done') {
    const leave = () => { PIL.leaving = false; run.pending = run.pending.filter((x) => x.t !== 'pilgrim'); persist(); };
    if (p.took !== undefined || PIL.leaving) { app.ask = null; leave(); return true; }
    PIL.leaving = true; PIL.ask = null;
    app.ask = { anchor: ['.pil-done'], at: 'below', okLabel: '떠나기', html: '<b class="ask-t">그대로 떠날까요?</b><p class="ask-note">제단의 카드를 받지 않았습니다. 떠나면 이번 순례의 카드는 사라집니다.</p>', ok: leave };
    return true;
  }
  return false;
}
