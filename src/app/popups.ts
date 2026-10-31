// 확인 팝업 · 장비 팝업 자리 잡기 (main.ts 에서 분리)
import { CFG } from '../config';
import { diffName } from '../data/difficulty';
import { CATWHEEL, DESPAIR_BY_ID } from '../data/despair';
import { CONSUMABLES, isLocked, potsOf, potSlots, potPool, POTS, CRYSTAL, itemInfo } from '../data/items';
import { UNIT_BY_ID } from '../data/units';
import * as ACH from '../ui/achieve';
import * as R from '../engine/run';
import { type RunState } from '../types';
import { isPlaceable } from '../data/devices';
import { Sel, app, esc, pctTxt, persist, root, toast } from './state';
import { POT_PIP, equipSel, itemIcon, statIc } from './common';
import { itemBrief } from './prep';

// ───────────────────────── 확인 팝업 (화면을 가리지 않음): 장비 조합 · 재구성 회로 · 분리 용제. ✕ = 취소 (Esc) · ✓ = 확인
export const ASK_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const ASK_V = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
export function askPop() {
  const q = app.ask;
  if (!q) return '';
  return `<div class="ask-pop" role="dialog" aria-label="확인">${q.html}<div class="ask-btns">${q.ok
    ? `<button class="btn ask-x" data-a="ask" data-v="no" title="취소 (Esc)" aria-label="취소">${ASK_X}</button><button class="btn primary ask-v" data-a="ask" data-v="ok" title="${esc(q.okLabel || '확인')}" aria-label="${esc(q.okLabel || '확인')}">${ASK_V}</button>`
    : `<button class="btn ask-x" data-a="ask" data-v="no" title="닫기 (Esc)" aria-label="닫기">${ASK_X}</button>`}</div></div>`;
}
export const askItem = (id: string) => `<span class="ask-it">${itemIcon(id)}<span>${esc(itemInfo(id).name)}</span></span>`;
export const INV_BOX = ['.inv-rail', '.inv'];
export const invCell = (i: number) => [`.inv-rail [data-drag="item:${i}"]`, `.inv [data-drag="item:${i}"]`, ...INV_BOX];
/** 조합 결과 알림: 유닉스제 대량 생산으로 바뀌었으면 그 사실도 */
export const combinedToast = (res: string, got: string | null | undefined) => toast(!got ? '조합할 수 없습니다.'
  : potsOf(res).includes('?') ? `잠재능력: ${potsOf(got).map((k) => POTS[k]?.name || k).join(' · ')} (${itemInfo(got).name})` // 백수정 조각: 굴린 결과를 공개
  : got === res ? `조합 완료: ${itemInfo(got).name}` : `유닉스제 대량 생산 — ${itemInfo(res).name} 대신 ${itemInfo(got).name}이 들어왔습니다.`);
/** 조합 확인: [A] + [B] = [결과] · 결과 능력치 · 효과 (보관함 왼쪽). 유닉스제 대량 생산은 확률만 알리고 합성할 때 정한다 (미리 굴리지 않음). extra = 덧붙일 안내 */
export function combineAsk(run: RunState, a: string, b: string, res: string, anchor: string[], ok: () => void, extra = '') {
  const gear = a === CRYSTAL ? b : b === CRYSTAL ? a : null;
  if (gear) { // 백수정 조각: 결과는 무작위라 합성한 뒤에 공개 (후보만 보여 준다). 다 열린 장비면 다시 뽑기 경고
    const have = potsOf(gear), full = have.length >= potSlots(gear);
    const cand = potPool(gear).filter((k) => full || !have.includes(k));
    const chip = (k: string) => `<span class="ip-pot">${POT_PIP}<b>${esc(POTS[k].name)}</b>${esc(POTS[k].desc)}</span>`;
    app.ask = { anchor, at: 'inv', okLabel: full ? '다시 뽑기' : '개방', ok,
      html: `<b class="ask-t">${full ? '잠재능력 다시 뽑기' : '잠재능력 개방'}</b><div class="ask-eq cb">${askItem(a)}<b>+</b>${askItem(b)}</div>`
        + (full ? `<p class="ask-note warn">잠재능력이 모두 열려 있습니다. 합성하면 ${have.length > 1 ? `붙어 있는 잠재능력 ${have.length}개를 모두 다시 뽑습니다 (적어도 하나는 바뀝니다)` : '붙어 있는 잠재능력을 다른 것으로 다시 뽑습니다'}.</p><div class="ip-pots">${have.map(chip).join('')}</div>`
          : `<p class="ask-note">아래 후보 중 1개가 무작위로 열립니다 (${have.length + 1}/${potSlots(gear)}칸).</p><div class="ip-pots cand">${cand.map(chip).join('')}</div>`)
        + extra };
    return;
  }
  const { stats, eff } = itemBrief(res);
  const ux = R.unixChance(run, res);
  app.ask = { anchor, at: 'inv', okLabel: '합성', ok,
    html: `<b class="ask-t">장비 조합</b><div class="ask-eq cb">${askItem(a)}<b>+</b>${askItem(b)}<b>=</b><span class="ask-it ask-res" data-a="ask-info" role="button" tabindex="0" title="눌러서 설명 보기">${itemIcon(res)}<span>${esc(itemInfo(res).name)}</span></span></div><div class="ask-more">${stats}${eff ? `<p class="ip-eff">${statIc(esc(eff))}</p>` : ''}</div>${ux ? `<p class="ask-note warn">절망 증강 [${esc(DESPAIR_BY_ID['D.unix']?.name || '')}]: 합성하는 순간 ${pctTxt(ux)} 확률로 ${esc(itemInfo(CATWHEEL).name)}이 됩니다.</p>` : ''}${extra}` };
}
/** 보관함 장비 둘: 조합되면 확인 팝업 (V = 조합). 조합할 수 없으면 false */
export function askCombineInv(run: RunState, i: number, j: number): boolean {
  const res = R.combinePreview(run, i, j);
  if (!res) return false;
  const a = run.inventory[i], b = run.inventory[j];
  combineAsk(run, a, b, res, invCell(j), () => {
    if (run.inventory[i] !== a || run.inventory[j] !== b) return;
    combinedToast(res, R.combineInv(run, i, j));
    app.sel = null; persist();
  });
  app.ask!.hl = [i, j]; // 고른 두 장비 모두 선택 표시
  return true;
}
/** 보관함 장비 → 기물: 조합되면 확인 팝업 (보관함 왼쪽), 아니면 바로 장착. 다음 선택 상태 */
/** slot = 끌어다 놓은 장비 칸 (그 칸의 장비와 조합되면 그 칸으로) */
export function equipAsk(run: RunState, idx: number, uid: string, slot?: number): Sel {
  const id = run.inventory[idx], cb = id && !R.equipCheck(run, id, uid, slot) ? R.equipCombo(run, id, uid, slot) : null;
  const u = run.units.find((x) => x.uid === uid);
  if (!cb || !u) return equipSel(run, idx, uid);
  combineAsk(run, u.items[cb.slot]!, id, cb.res, invCell(idx), () => {
    if (run.inventory[idx] !== id) return;
    const e = R.equip(run, idx, uid, cb.slot);
    if (e) toast(e); else { combinedToast(cb.res, u.items[cb.slot]); persist(); }
    app.sel = { k: 'unit', uid };
  }, `<p class="ask-note muted">${esc(UNIT_BY_ID[u.defId].name)}에게 장착한 장비와 합칩니다.</p>`);
  return app.sel;
}
/** 장착 장비 옮기기 (보관함 · 다른 기물): 끌기 · 말풍선 [해제] · 기물 상세 패널의 장비 끌기가 모두 여기로 온다.
 *  분리 용제 규칙 (CFG.solventFrom 이상, 개조부품 제외): 용제 1개를 쓸지 묻고 (R.unequip 이 소모), 없으면 옮길 수 없다고 알린다. 다른 기물에서 조합되면 조합 확인 하나로 */
export function moveEq(run: RunState, uid: string, slot: number, to: string | null, toSlot?: number) {
  const u = run.units.find((x) => x.uid === uid);
  const id = u ? (slot < 0 ? u.mod : u.items[slot]) : null;
  if (!u || !id || to === uid) return;
  if (isLocked(id)) { toast('고유 장비는 해제할 수 없습니다.'); return; }
  if (to) { const e = R.equipCheck(run, id, to, toSlot); if (e) { toast(`${e}.`); return; } }
  const pay = R.solventNeed(run, uid, slot), left = R.solventLeft(run), sv = CONSUMABLES.K_strip.name;
  const here = [`.board [data-drag="eq:${uid}:${slot}"]`, `[data-drag="eq:${uid}:${slot}"]`, ...INV_BOX];
  const rule = `${esc(diffName(CFG.solventFrom) || `위험 ${CFG.solventFrom}`)} 이상에서는 장착한 장비를 옮길 때마다 ${esc(sv)} 1개가 필요합니다.`;
  if (pay && !left) {
    app.ask = { anchor: here, at: 'beside', html: `<b class="ask-t">${itemIcon('K_strip')} ${esc(sv)} 없음</b><div class="ask-eq">${askItem(id)}</div><p class="ask-note">남은 ${esc(sv)}가 없어 옮길 수 없습니다. ${rule}</p>` };
    return;
  }
  const cb = to ? R.equipCombo(run, id, to, toSlot) : null;
  const go = () => {
    if ((slot < 0 ? u.mod : u.items[slot]) !== id) return;
    const e = R.unequip(run, uid, slot);
    if (e) { toast(`${e}.`); return; }
    if (app.sel?.k === 'item') app.sel = null; // 분리 용제가 빠지면 보관함 칸 번호가 바뀐다
    if (to) {
      const e2 = R.equip(run, run.inventory.length - 1, to, cb?.slot);
      if (e2) toast(e2); else if (cb) combinedToast(cb.res, run.units.find((x) => x.uid === to)?.items[cb.slot]); else toast(pay ? `${sv} 1개를 써서 옮겼습니다.` : '장착했습니다.');
      app.sel = { k: 'unit', uid: to };
    } else if (pay) toast(`${sv} 1개를 써서 보관함으로 옮겼습니다.`);
    persist();
  };
  const payNote = pay ? `<p class="ask-note">${itemIcon('K_strip')} ${esc(sv)} 1개 소모 (남은 ${left}개)</p>` : '';
  if (cb && to) { combineAsk(run, run.units.find((x) => x.uid === to)!.items[cb.slot]!, id, cb.res, INV_BOX, go, payNote); return; }
  if (pay) {
    app.ask = { anchor: here, at: 'beside', okLabel: '옮기기', ok: go,
      html: `<div class="ask-eq">${askItem(id)}<b>→</b><span class="ask-it">${to ? esc(UNIT_BY_ID[run.units.find((x) => x.uid === to)!.defId].name) : '보관함'}</span></div><p>${esc(sv)}를 1개 소모해 옮길까요? (남은 ${left}개)</p>` };
    return;
  }
  go();
}
/** 소모품 사용 시도 (끌어 놓기 · 선택 후 누르기 공용): 쓸 수 없는 대상이면 알림만 띄우고 선택을 바로 푼다. 재구성 회로는 대상 옆 확인 팝업, 나머지는 확인 창 */
export function tryUse(run: RunState, i: number, tg: R.UseTarget) {
  const err = R.useCheck(run, i, tg);
  if (err) { toast(`${err}.`); app.sel = null; app.useK = null; return; }
  if (run.inventory[i] === 'K_reroll') rerollAsk(run, i, tg);
  else if (isPlaceable(run.inventory[i])) { const r = R.useConsumable(run, i, tg); toast(r.msg); app.sel = null; if (r.ok) persist(); } // 배치형: 바로 놓는다 (놓은 장치를 누르면 회수)
  else app.useK = { i, tg };
}
/** 재구성 회로 확인 팝업: 기물이면 기물 위, 장착 장비면 그 칸 옆, 보관함 장비면 보관함 왼쪽. 결과는 V 를 누른 뒤에 공개 (미리 보고 고를 수 없음) */
export function rerollAsk(run: RunState, i: number, tg: R.UseTarget) {
  const k = run.inventory[i], c = CONSUMABLES[k];
  const u = tg.k === 'unit' || tg.k === 'eq' ? run.units.find((x) => x.uid === tg.uid) : undefined;
  const x = tg.k === 'inv' ? run.inventory[tg.i] : tg.k === 'eq' ? u?.items[tg.slot] : null;
  if ((tg.k === 'unit' && !u) || (tg.k !== 'unit' && !x)) return;
  const gear = tg.k === 'unit' ? u!.items.filter((y): y is string => R.canReroll(y)) : [x!];
  const anchor = tg.k === 'unit' ? [`.board [data-drop="unit:${tg.uid}"]`, `.bench [data-drop="unit:${tg.uid}"]`, `[data-drop="unit:${tg.uid}"]`]
    : tg.k === 'eq' ? [`.board [data-drag="eq:${tg.uid}:${tg.slot}"]`, `[data-drag="eq:${tg.uid}:${tg.slot}"]`] : tg.k === 'inv' ? invCell(tg.i) : [];
  const what = tg.k === 'unit' ? `장착한 장비 ${gear.length}개를 같은 등급의 다른 무작위 장비로 바꾸고 보관함으로 해제합니다.` : `같은 등급의 다른 무작위 장비로 바꿉니다${tg.k === 'eq' ? ' (바꾼 장비는 보관함으로 해제)' : ''}.`;
  app.ask = { anchor: [...anchor, ...INV_BOX], at: tg.k === 'unit' ? 'above' : tg.k === 'eq' ? 'beside' : 'inv', okLabel: '사용',
    html: `<b class="ask-t">${itemIcon(k)} ${esc(c.name)} → ${esc(u && tg.k === 'unit' ? UNIT_BY_ID[u.defId].name : itemInfo(x!).name)}</b><div class="ask-eq">${gear.map(askItem).join('')}</div><p class="ask-note">${what} 결과는 사용한 뒤에 공개됩니다.</p>`,
    ok: () => {
      if (run.inventory[i] !== k) return;
      const r = R.useConsumable(run, i, tg);
      if (r.ok) ACH.achUse(run, k, tg);
      toast(r.msg);
      // 장비 1개를 바꿨으면 새 장비를 보관함에서 골라 정보 팝업으로 보여 준다
      app.sel = r.ok && tg.k !== 'unit' ? { k: 'item', idx: tg.k === 'inv' ? (tg.i > i ? tg.i - 1 : tg.i) : run.inventory.length - 1 } : null;
      if (r.ok) persist();
    } };
}
/** 확인 팝업 위치: anchor 중 처음 보이는 요소 기준 (inv = 편성 보관함은 상자 오른쪽 · 보드 반대쪽, 가로 보관함은 상자 왼쪽 → 오른쪽 · 아래 / above = 위 / beside = 왼쪽 · 오른쪽). 좁은 화면은 하단 시트 */
export function placeAskPop() {
  const p = root.querySelector<HTMLElement>('.ask-pop'), q = app.ask;
  if (!p || !q) return;
  const vis = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const a = q.anchor.map((sel) => Array.from(root.querySelectorAll<HTMLElement>(sel)).find((el) => vis(el) && !el.closest('.ask-pop'))).find(Boolean);
  const side = a && q.at === 'inv' ? invRailSide(a, p.offsetWidth) : null;
  const dock = a && q.at === 'inv' && a.closest('.inv-rail') && !side ? railTopDock(a) : null;
  p.style.maxHeight = '';
  if (dock) { // 태블릿 세로: 보관 물품 팝업과 같은 머리 자리 (보관함 쪽 오른쪽 맞춤)
    p.classList.remove('sheet'); p.classList.add('dock-top');
    Object.assign(p.style, { left: 'auto', right: '8px', top: '8px', bottom: 'auto', maxHeight: `${dock.h}px` });
    return;
  }
  p.classList.remove('dock-top');
  if (!a || innerWidth <= 700 || (q.at === 'inv' && a.closest('.inv-rail') && !side)) {
    p.classList.add('sheet');
    Object.assign(p.style, { left: '8px', right: '8px', top: 'auto', bottom: '8px' });
    if (q.at === 'inv') sheetReveal(a || null, p, `ask:${q.anchor[0]}`);
    return;
  }
  p.classList.remove('sheet');
  Object.assign(p.style, { right: 'auto', bottom: 'auto' });
  const w = p.offsetWidth, h = p.offsetHeight, r = a.getBoundingClientRect();
  if (side) { p.style.left = `${Math.max(8, Math.min(side.left, innerWidth - w - 8))}px`; p.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, r.top - 12))}px`; return; }
  let left: number, top: number;
  if (q.at === 'above') {
    left = r.left + r.width / 2 - w / 2; top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
  } else if (q.at === 'below') { // 대상 바로 아래, 왼쪽 맞춤 (상점 가격표: 고른 칸을 가리지 않게). 아래 자리가 없으면 위
    left = r.left; top = r.bottom + 6;
    if (top + h > innerHeight - 8) top = r.top - h - 6;
  } else {
    const box = (q.at === 'inv' ? a.closest<HTMLElement>('.inv-rail, .inv') || a : a).getBoundingClientRect();
    left = box.left - w - 10; top = r.top;
    if (left < 8) left = box.right + 10 + w <= innerWidth - 8 ? box.right + 10 : -1;
    if (left < 0) { left = r.left; top = box.bottom + 8 + h <= innerHeight - 8 ? box.bottom + 8 : box.top - h - 8; }
  }
  p.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, left))}px`;
  p.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, top))}px`;
}

/** 상단 바 높이 → 옆 패널 sticky 기준, 상세 능력치 창을 상세 보기 패널 왼쪽에 고정 */
/** 편성 보관함 (세로 줄, 보드 오른쪽) 옆 팝업 자리 (docs/UI.md 15): 상자 바깥 오른쪽 = 보드 반대쪽 (상세 패널 위)이라 보드 칸을 가리지 않는다.
 *  자리가 모자라거나 (좁은 화면 · 보관함이 보드 아래 가로 줄) 세로 줄이 아니면 null → 화면 아래 시트 */
export const railVertical = (rail: HTMLElement | null) => !!rail && getComputedStyle(rail).flexDirection === 'column'; // 물품이 몇 개 없어 상자가 낮아도 세로 줄
export function invRailSide(a: HTMLElement, w: number) {
  const rail = a.closest<HTMLElement>('.inv-rail'), box = rail?.getBoundingClientRect();
  if (!box || innerWidth <= 700 || !railVertical(rail)) return null;
  const room = innerWidth - 8 - (box.right + 10);
  return room >= Math.min(w, 220) ? { left: box.right + 10, w: Math.min(w, room) } : null;
}
/** 태블릿 세로 (보관함이 보드 옆 세로 줄인데 오른쪽 자리가 없을 때): 보드 위 머리 자리 (상단 바 · 보드 머리줄 — 둘 다 sticky · 불투명) 에 겹쳐 띄운다.
 *  보드 칸을 가리지 않고, 보관함 바로 위라 누른 물품 옆이다. 높이 = 보드 창 위끝 (스크롤로 보드가 머리 밑에 들어가면 머리 아래끝) 까지 → 넘치면 팝업 안 스크롤.
 *  세로 화면만 (가로 폰은 머리 자리가 낮아 예전처럼 하단 시트). 자리가 너무 낮으면 null */
export function railTopDock(a: HTMLElement): { h: number } | null {
  const rail = a.closest<HTMLElement>('.inv-rail');
  if (!railVertical(rail) || innerHeight <= innerWidth) return null;
  const vp = root.querySelector<HTMLElement>('.prep .board-vp')?.getBoundingClientRect();
  if (!vp) return null;
  const tb = root.querySelector<HTMLElement>('header.top')?.getBoundingClientRect().bottom ?? 0, hb = root.querySelector<HTMLElement>('.prep .board-head')?.getBoundingClientRect().bottom ?? 0;
  const h = Math.floor(Math.max(tb, hb, vp.top - 6)) - 8;
  return h >= 96 ? { h } : null;
}
/** 하단 시트가 고른 칸을 가리면 페이지를 그만큼 올린다 (시트를 위로 옮겨 보드를 덮지 않는다). 같은 물품에 한 번만 (사용자 스크롤과 다투지 않게) */
export let sheetKey = '';
export function sheetReveal(a: HTMLElement | null, p: HTMLElement, key: string) {
  if (key === sheetKey) return;
  sheetKey = key;
  const over = a ? a.getBoundingClientRect().bottom - (innerHeight - p.offsetHeight - 16) : 0;
  if (over > 0) scrollBy(0, over);
}
/** 보관 물품 정보 팝업: 편성 보관함은 상자 오른쪽 (보드 반대쪽), 상점 등 가로 보관함은 상자 왼쪽 · 오른쪽 · 아래. 자리가 없거나 좁은 화면은 아래 시트 */
export function placeInvPop() {
  const p = root.querySelector<HTMLElement>('.inv-pop');
  if (!p) { sheetKey = ''; return; }
  const a = root.querySelector<HTMLElement>('.inv-rail .item.sel, .inv-rail .relic-tok.on, .inv .item.sel, .inv .relic-tok.on');
  const key = `${app.sel?.k === 'item' ? app.sel.idx : app.sel?.k === 'relic' ? app.sel.id : ''}`;
  if (a?.closest('.inv-rail')) {
    const side = invRailSide(a, 260), dock = side ? null : railTopDock(a);
    if (dock) { p.classList.remove('sheet'); p.classList.add('dock-top'); p.style.cssText = `left:8px;right:8px;top:8px;bottom:auto;width:auto;max-height:${dock.h}px`; sheetKey = key; return; } // 태블릿 세로: 보드 위 머리 자리
    p.classList.remove('dock-top');
    if (!side) { p.classList.add('sheet'); p.style.cssText = ''; sheetReveal(a, p, key); return; }
    p.classList.remove('sheet');
    p.style.cssText = `width:${side.w}px`;
    const r = a.getBoundingClientRect(), h = p.offsetHeight;
    p.style.left = `${side.left}px`;
    p.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, r.top - 12))}px`;
    return;
  }
  // 가로 보관함 (상점 등) · 좁은 화면: 하단 시트. 누른 칸이 시트에 가려지는 높이면 위쪽(상단 바 밑)에 띄운다
  if (!a || innerWidth <= 700) {
    p.classList.add('sheet'); p.style.cssText = '';
    if (a && a.getBoundingClientRect().bottom > innerHeight - p.offsetHeight - 16) {
      p.style.setProperty('top', `${Math.max(8, (root.querySelector('header.top')?.getBoundingClientRect().bottom ?? 0) + 8)}px`, 'important');
      p.style.bottom = 'auto';
    }
    return;
  }
  // 넓은 화면: 보관함 상자 바깥 왼쪽에 (같은 보관함의 다른 칸 · 누른 칸을 가리지 않게). 자리가 없으면 오른쪽, 그래도 없으면 상자 아래 · 위
  p.classList.remove('sheet');
  const r = a.getBoundingClientRect(), box = a.closest<HTMLElement>('.inv')?.getBoundingClientRect() || r;
  const w = p.offsetWidth, h = p.offsetHeight;
  let left = box.left - w - 10, top = Math.min(innerHeight - h - 8, Math.max(8, r.top));
  if (left < 8) left = box.right + 10 + w <= innerWidth - 8 ? box.right + 10 : -1;
  if (left < 0) { left = Math.max(8, Math.min(innerWidth - w - 8, r.left)); top = box.bottom + 8 + h <= innerHeight - 8 ? box.bottom + 8 : Math.max(8, box.top - h - 8); }
  p.style.left = `${left}px`;
  p.style.top = `${top}px`;
}
/** 전체 상세 팝업 안의 능력 상세: 누른 카드의 왼쪽에 (자리가 없으면 오른쪽) */
export function placeUmPop() {
  const pop = root.querySelector<HTMLElement>('.um-pop');
  const um = root.querySelector<HTMLElement>('.um');
  const card = root.querySelector<HTMLElement>('.um .ab-click.on, .um .tt-ic.ab-click.on');
  if (!pop || !um) return;
  if (!card || innerWidth <= 700) { pop.classList.add('sheet'); return; }
  pop.classList.remove('sheet');
  const R0 = um.getBoundingClientRect(), r = card.getBoundingClientRect();
  const w = pop.offsetWidth;
  let left = r.left - R0.left - w - 10;
  if (left < 8) left = Math.min(R0.width - w - 8, r.right - R0.left + 10);
  const top = Math.max(56, Math.min(r.top - R0.top, R0.height - pop.offsetHeight - 8));
  pop.style.left = `${Math.max(8, left)}px`; pop.style.top = `${top}px`; pop.style.right = 'auto';
}
/** 상단 바 높이 (CSS --top-h): 보드 · 패널 높이 계산의 기준 */
export function topHSync() {
  const top = root.querySelector<HTMLElement>('.top');
  document.documentElement.style.setProperty('--top-h', `${(top?.offsetHeight || 0) + 10}px`);
}
export function layoutPanels() {
  const top = root.querySelector<HTMLElement>('.top');
  topHSync();
  placeInvPop();
  placeUmPop();
  placeAskPop();
  const pop = root.querySelector<HTMLElement>('.stat-pop');
  const det = root.querySelector<HTMLElement>('.detail');
  if (!pop || !det) return;
  if (innerWidth <= 1100) { pop.style.cssText = ''; pop.classList.add('sheet'); return; }
  pop.classList.remove('sheet');
  const r = det.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.right = 'auto';
  pop.style.left = `${Math.max(8, r.left - pop.offsetWidth - 16)}px`;
  pop.style.top = `${Math.max(r.top, (top?.offsetHeight || 0) + 10)}px`;
}
/** 편성 보드 창 가운데 화면 점 (창 크기가 바뀌어도 보던 칸이 가운데에 남게) */
export function prepVpMid() { const r = root.querySelector<HTMLElement>('.prep .board-vp')?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height, innerHeight - r.top) / 2 } : undefined; }
