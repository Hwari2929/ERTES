// 드래그 앤 드롭 · 바리케이드 직접 조작 (main.ts 에서 분리)
import { CFG } from '../config';
import { CONSUMABLES, isConsumable } from '../data/items';
import { runGeo, deployed, layout, PAD, toPos, turretCells, turretSavePos } from '../engine/build';
import * as R from '../engine/run';
import { type RunState } from '../types';
import { fromScr } from '../engine/build';
import { DEV, type Device, deviceCells, isPlaceable } from '../data/devices';
import { RELIC_BY_ID } from '../data/relics';
import * as SND from '../ui/sound';
import { app, persist, root, toast } from './state';
import { boardBox, devPv, devPvShow, devZone, dragTool, placeAt, prepFrame, setDevPv, toolMark, toolMarkAt } from './prep';
import { askCombineInv, equipAsk, moveEq, tryUse } from './popups';
import { render } from '../main';

// ───────────────────────── 드래그 앤 드롭 (마우스 + 터치 공용)
/** data-hold 요소는 길게 눌러야(HOLD_MS) 끌기가 시작된다. 그 전에 움직이면 끌기 취소 */
export const HOLD_MS = 220;
export let drag: { src: string; x: number; y: number; ghost: HTMLElement | null; el: HTMLElement; t0: number; hold: boolean; marked?: boolean } | null = null;
export let suppressClick = false;
/** 끌기 · 두 손가락 확대가 끝난 직후 잠깐 클릭을 무시한다 (손을 뗀 자리의 단추가 눌리지 않게) */
export function blockClicks(ms: number) { suppressClick = true; setTimeout(() => { suppressClick = false; }, ms); }
/** 진행 중인 끌기를 멈춘다 (두 손가락 확대가 시작될 때) */
export function cancelDrag() { if (drag?.ghost) { drag.ghost.remove(); drag.el.classList.remove('dragging'); } drag = null; wallDrag = null; dragPt = null; }
/** 끄는 동안 손가락 · 커서가 화면 위 · 아래 가장자리에 머물면 창을 스크롤한다 (휴대폰 세로: 아래쪽 기물 상세의 장비를 보드 · 보관함까지 끌고 올라가기). 보드에서 끄는 것은 페이지를 굴리지 않는다 (아래 dragAutoScroll) */
export const DRAG_EDGE = 56, DRAG_SCROLL_MAX = 18, VP_EDGE = 36; // VP_EDGE = 확대한 보드 창 가장자리 폭
export let dragPt: { x: number; y: number } | null = null, dragScrollRaf = 0;
export function dragAutoScroll() {
  dragScrollRaf = 0;
  if ((!drag?.ghost && !wallDrag?.moved) || !dragPt) return; // 장비 · 기물 끌기 · 바리케이드 끌기 (긴 보드)
  // 확대한 편성 보드 창 (.board-vp): 창 가장자리에 머물면 창 안을 민다 (화면 아래 대기석 놓을 자리 위는 제외)
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), r = vp?.getBoundingClientRect(), p = dragPt;
  const dock = root.querySelector<HTMLElement>('.prep .bench-dock'), dr = dock && dock.offsetParent ? dock.getBoundingClientRect() : null;
  const onDock = !!dr && p.x >= dr.left && p.x < dr.right && p.y >= dr.top && p.y < dr.bottom;
  let vpMoved = false;
  if (vp && r && !onDock && p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom) {
    const E = Math.min(VP_EDGE, r.width / 4, r.height / 4), sp = (d: number) => Math.min(DRAG_SCROLL_MAX, Math.ceil((E - d) / 2));
    const vx = p.x - r.left < E ? -sp(p.x - r.left) : r.right - p.x < E ? sp(r.right - p.x) : 0;
    const vy = p.y - r.top < E ? -sp(p.y - r.top) : r.bottom - p.y < E ? sp(r.bottom - p.y) : 0;
    if (vx || vy) { const l0 = vp.scrollLeft, t0 = vp.scrollTop; vp.scrollBy(vx, vy); vpMoved = vp.scrollLeft !== l0 || vp.scrollTop !== t0; }
  }
  // 보드에서 끄는 것 (기물 · 소환물 · 포탑 · 바리케이드)은 페이지를 굴리지 않는다: 대기석은 화면 아래 놓을 자리로, 보드 안은 창 가장자리로 (빠르게 아래로 끌어도 화면이 밀리지 않게)
  const fromBoard = !!wallDrag || !!drag?.el.closest('.board');
  if (fromBoard) { if (vpMoved) dragScrollRaf = requestAnimationFrame(dragAutoScroll); return; }
  const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 0;
  const up = topH + DRAG_EDGE - dragPt.y, down = dragPt.y - (innerHeight - DRAG_EDGE);
  const dy = up > 0 ? -Math.min(DRAG_SCROLL_MAX, Math.ceil(up / 3)) : down > 0 ? Math.min(DRAG_SCROLL_MAX, Math.ceil(down / 3)) : 0;
  const y0 = scrollY;
  if (dy) scrollBy(0, dy);
  if (scrollY !== y0 || vpMoved) dragScrollRaf = requestAnimationFrame(dragAutoScroll);
}

// ───────── 바리케이드 직접 조작 (편성 화면): 몸통을 끌면 옮기기, 끝단 화살표를 끌면 그 방향으로 늘리기 · 줄이기 (최대 DEV.wall.maxN칸).
// 끄는 동안 모양을 바로 보여 주고 (놓을 수 없으면 붉게), 놓으면 확정. 움직이지 않고 떼면 보통 누름 (회수 확인)
export let wallDrag: null | { i: number; side: '' | 't' | 'r' | 'b' | 'l'; d0: Device; kx: number; ky: number; x: number; y: number; box: HTMLElement; board: HTMLElement; moved: boolean; cand: Device | null; err: string | null } = null;
/** 편성 보드 위 화면 점 → 전장 칸 (확대 · 스크롤 · 가로 지형 모두: 보드의 실제 화면 사각형에서 화면 칸을 구해 전장 좌표로 되짚는다) */
export const wallCellAt = (board: HTMLElement, cx: number, cy: number) => {
  const r = board.getBoundingClientRect(), g = runGeo(app.run!), f = prepFrame(g, +board.dataset.ex!);
  return fromScr(g, Math.floor(((cx - r.left) / r.width) * f.bw) + f.ox, Math.floor(((cy - r.top) / r.height) * f.bh) + f.oy);
};
/** 끄는 위치 → 새 바리케이드 모양: 옮기기는 잡은 칸 기준, 늘리기는 반대쪽 끝을 고정하고 끄는 쪽 끝이 그 칸까지 (축은 화살표 방향) */
export function wallShape(w: NonNullable<typeof wallDrag>, cx: number, cy: number): Device {
  const d = w.d0, n = d.n || 1, M = DEV.wall.maxN;
  if (!w.side) return { ...d, x: cx - w.kx, y: cy - w.ky };
  const horiz = w.side === 'l' || w.side === 'r';
  const a0 = horiz ? d.x : d.y, a1 = a0 + n - 1; // 화살표는 바리케이드 축 방향에만 있다 (1칸이면 네 방향)
  const p = horiz ? cx : cy;
  let lo = a0, hi = a1;
  if (w.side === 'r' || w.side === 'b') hi = Math.max(lo, Math.min(lo + M - 1, p)); else lo = Math.min(hi, Math.max(hi - M + 1, p));
  return { ...d, x: horiz ? lo : d.x, y: horiz ? d.y : lo, dir: horiz ? 'h' : 'v', n: hi - lo + 1 };
}
/** 보관함에서 끄는 것이 배치형 소모품이면 그 보관함 순번 (편성 화면 · 전투 조우 중), 아니면 -1 */
export function dragPlaceIdx() {
  const run = app.run, m = drag ? /^item:(\d+)$/.exec(drag.src) : null;
  return m && app.screen === 'prep' && run?.node?.enc && isPlaceable(run.inventory[+m[1]]) ? +m[1] : -1;
}
/** 배치형 소모품을 끄는 동안: 놓을 수 있는 칸 표시 (처음 한 번) + 가리킨 칸 미리보기 */
export function dragPv(cx: number, cy: number) {
  const i = dragPlaceIdx(), run = app.run, board = root.querySelector<HTMLElement>('.prep .board');
  if (i < 0 || !run || !board) return;
  if (board.dataset.pidx !== String(i)) { // 놓을 수 있는 칸 표시는 끄는 그 물품 기준으로 (다른 물품을 고른 채 끌어도)
    board.classList.add('placing'); board.dataset.pidx = String(i);
    const z = devZone(run, i, +board.dataset.ex!);
    board.querySelector('.dev-zone')?.remove();
    board.querySelector('.cells')?.insertAdjacentHTML('afterend', z.html);
    board.querySelectorAll<HTMLElement>('.cell[data-drop]').forEach((el) => { const [k, x, y] = el.dataset.drop!.split(':'); if (k === 'cell' || k === 'xcell') el.classList.toggle('dev-ok', z.ok.has(`${x},${y}`)); });
  }
  const r = board.getBoundingClientRect();
  if (cx < r.left || cx >= r.right || cy < r.top || cy >= r.bottom) { devPvShow(board, null); return; }
  const c = wallCellAt(board, cx, cy);
  devPvShow(board, { idx: i, id: run.inventory[i], x: c.x, y: c.y });
}
/** 끌기 · 바리케이드 직접 조작 · 배치형 소모품 미리보기 이벤트를 등록한다 (main.ts 가 원래 자리에서 한 번 부른다) */
export function initDrag() {
root.addEventListener('pointerdown', (ev) => {
  const h = (ev.target as HTMLElement).closest('[data-wall]') as HTMLElement | null, run = app.run;
  if (!h || ev.button > 0 || !run?.node?.enc?.devices) return;
  const [kind, i, side] = h.dataset.wall!.split(':'), d0 = run.node.enc.devices[+i];
  const board = h.closest('.board') as HTMLElement | null, box = h.closest('[data-wallbox]') as HTMLElement | null;
  if (!d0 || !board || !box) return;
  const c = wallCellAt(board, ev.clientX, ev.clientY);
  wallDrag = { i: +i, side: kind === 'ext' ? (side as 't' | 'r' | 'b' | 'l') : '', d0, kx: c.x - d0.x, ky: c.y - d0.y, x: ev.clientX, y: ev.clientY, box, board, moved: false, cand: null, err: null };
  h.setPointerCapture?.(ev.pointerId);
  ev.stopPropagation();
}, true);
window.addEventListener('pointermove', (ev) => {
  const w = wallDrag, run = app.run;
  if (!w || !run) return;
  if (!w.moved && Math.hypot(ev.clientX - w.x, ev.clientY - w.y) < 6) return;
  w.moved = true;
  w.box.classList.add('dragging');
  dragPt = { x: ev.clientX, y: ev.clientY };
  if (!dragScrollRaf) dragScrollRaf = requestAnimationFrame(dragAutoScroll);
  const c = wallCellAt(w.board, ev.clientX, ev.clientY), cand = wallShape(w, c.x, c.y);
  if (w.cand && cand.x === w.cand.x && cand.y === w.cand.y && cand.n === w.cand.n && cand.dir === w.cand.dir) return;
  w.cand = cand; w.err = R.deviceErr(run, cand, w.d0);
  const g = runGeo(run), n = cand.n || 1, v = cand.dir === 'v';
  w.box.style.cssText = boardBox(g, +w.board.dataset.ex!)(cand.x, cand.y, v ? 1 : n, v ? n : 1);
  w.box.classList.toggle('v', n > 1 && v !== !!g.rot); // 화면에서 세로인지 (가로 지형은 돌려서)
  w.box.classList.toggle('bad', !!w.err);
  const body = w.box.querySelector('.dw-body');
  if (body) { const cell = body.querySelector('.dw-cell'); body.querySelectorAll('.dw-cell').forEach((x, k) => { if (k) x.remove(); }); for (let k = 1; k < n && cell; k++) body.insertBefore(cell.cloneNode(true), cell.nextSibling); }
  ev.preventDefault();
}, { passive: false });
window.addEventListener('pointerup', () => {
  const w = wallDrag, run = app.run;
  wallDrag = null;
  if (!w || !w.moved || !run) return;
  dragPt = null;
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 50);
  if (w.cand && !w.err) { R.setDevice(run, w.i, w.cand); persist(); }
  else if (w.err) toast(`${w.err}.`);
  render();
});
root.addEventListener('pointerdown', (ev) => {
  const el = (ev.target as HTMLElement).closest('[data-drag]') as HTMLElement | null;
  if (!el || ev.button > 0) return;
  drag = { src: el.dataset.drag!, x: ev.clientX, y: ev.clientY, ghost: null, el, t0: performance.now(), hold: el.hasAttribute('data-hold') };
  if (drag.hold) ev.stopPropagation();
});
window.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (!drag.ghost) {
    if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
    if (drag.hold && performance.now() - drag.t0 < HOLD_MS) { drag = null; return; }
    const g = document.createElement('div');
    g.className = 'drag-ghost';
    const img = drag.el.querySelector('img');
    g.innerHTML = img ? `<img alt="" src="${img.src}">` : drag.el.innerHTML;
    document.body.appendChild(g);
    drag.ghost = g;
    drag.el.classList.add('dragging');
    // 끄는 것이 장비 · 소모품 · 성유물이면 누를 때와 같은 표시: 받을 수 없는 것을 흐리고, 끌어 올린 대상에만 결과 이름표 (docs/UI.md 14)
    const run = app.run, t = run && app.screen === 'prep' ? dragTool(run, drag.src) : null;
    if (run && t) { toolMark(run, t); drag.marked = true; }
  }
  if (drag.marked) toolMarkAt(ev.clientX, ev.clientY);
  drag.ghost.style.left = `${ev.clientX}px`;
  drag.ghost.style.top = `${ev.clientY}px`;
  dragPt = { x: ev.clientX, y: ev.clientY };
  if (!dragScrollRaf) dragScrollRaf = requestAnimationFrame(dragAutoScroll);
  dragPv(ev.clientX, ev.clientY);
  ev.preventDefault();
}, { passive: false });
window.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  const d = drag, pi = d.ghost ? dragPlaceIdx() : -1;
  drag = null; dragPt = null;
  if (!d.ghost) return;
  d.ghost.remove();
  const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null; // 끄는 동안만 펼쳐지는 놓을 자리 (숨긴 대기석)가 접히기 전에 잰다
  d.el.classList.remove('dragging');
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 50);
  // 배치형 소모품을 보드 위에 놓으면: 가리킨 칸 그대로 (미리보기와 같은 판정, 막히면 칸 옆에 이유)
  const board = pi >= 0 ? root.querySelector<HTMLElement>('.prep .board') : null, br = board?.getBoundingClientRect();
  if (app.run && board && br && ev.clientX >= br.left && ev.clientX < br.right && ev.clientY >= br.top && ev.clientY < br.bottom) {
    const c = wallCellAt(board, ev.clientX, ev.clientY);
    SND.uiAct('drop'); app.ask = null;
    placeAt(app.run, pi, c.x, c.y, true);
    render(); return;
  }
  if (pi >= 0) setDevPv(null);
  const tgt = under?.closest('[data-drop]') as HTMLElement | null;
  if (tgt) onDrop(d.src, tgt.dataset.drop!);
  else if (pi >= 0) render(); // 끄는 동안 붙인 미리보기 · 놓을 수 있는 칸 표시 지우기
  else if (d.marked && app.run && app.screen === 'prep') toolMark(app.run); // 끄는 동안의 흐림 → 고른 도구 기준 (없으면 지움)
});
window.addEventListener('pointercancel', () => {
  const pi = drag?.ghost ? dragPlaceIdx() : -1, marked = !!drag?.marked;
  if (drag?.ghost) { drag.ghost.remove(); drag.el.classList.remove('dragging'); }
  drag = null;
  if (pi >= 0) { setDevPv(null); render(); } else if (marked && app.run && app.screen === 'prep') toolMark(app.run);
});
/** 배치형 소모품을 고른 채 마우스로 보드 위를 가리키면 미리보기 (터치는 누른 칸에 이유 표시) */
root.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse' || drag || wallDrag) return;
  const run = app.run, sel = app.sel;
  if (app.screen !== 'prep' || sel?.k !== 'item' || !run?.node?.enc || !isPlaceable(run.inventory[sel.idx])) return;
  const board = (ev.target as HTMLElement).closest<HTMLElement>('.prep .board');
  if (!board) { const b = root.querySelector<HTMLElement>('.prep .board'); if (b && devPv) devPvShow(b, null); return; }
  const c = wallCellAt(board, ev.clientX, ev.clientY);
  devPvShow(board, { idx: sel.idx, id: run.inventory[sel.idx], x: c.x, y: c.y });
});
}
/** 배치형 소모품을 고른 채 편성 보드를 누르면: 누른 자리의 칸에 놓기 (기물 · 적 · 지형 · 장치 위를 눌러도 같은 칸 판정, 막히면 칸 옆에 이유) */
export function boardPlaceTap(ev: MouseEvent) {
  const run = app.run, sel = app.sel, t = ev.target as HTMLElement;
  if (app.screen !== 'prep' || sel?.k !== 'item' || !run?.node?.enc || !isPlaceable(run.inventory[sel.idx])) return false;
  const board = t.closest<HTMLElement>('.prep .board');
  if (!board) return false;
  const c = wallCellAt(board, ev.clientX, ev.clientY);
  SND.uiAct('dev-cell'); app.ask = null;
  placeAt(run, sel.idx, c.x, c.y);
  render();
  return true;
}

export function onDrop(src: string, dst: string) {
  const run = app.run;
  if (!run) return;
  app.ask = null; // 새로 끌어 놓으면 열려 있던 확인 팝업은 취소
  SND.uiAct('drop'); // 효과음: 배치 · 장착 (오류 알림이 뜨면 오류음)
  const [sk, ...sv] = src.split(':');
  const [dk, ...dv] = dst.split(':');
  const n = run.node?.enc?.n || CFG.bossBoard, G = runGeo(run, n);
  // 편성 화면에 놓은 장치 칸에는 기물 · 포탑 · 소환물을 옮길 수 없다 (장치를 눌러 회수한 뒤)
  if ((dk === 'cell' || dk === 'tcell') && sk !== 'item' && run.node?.enc?.devices?.some((d) => deviceCells(d).some((c) => c.x === +dv[0] && c.y === +dv[1]))) { toast('장치가 있는 칸입니다. 장치를 눌러 회수한 뒤 옮기세요.'); render(); return; }
  // 포탑에는 장비 · 소모품을 쓸 수 없다 (포탑 장비는 엔지니어 단계에서 골라 모든 포탑에 공통 적용)
  if (sk === 'item' && dk === 'turret') { toast(isConsumable(run.inventory[+sv[0]]) ? '소모품은 포탑에 쓸 수 없습니다.' : TURRET_NO_GEAR); render(); return; }
  if ((sk === 'eq' || sk === 'relic') && dk === 'turret') { toast(TURRET_NO_GEAR); render(); return; }
  if (sk === 'comp') { // 소환물 · 무휼 시작 칸: 배치 구역 빈칸으로만 (기물 · 포탑 칸 위는 그대로)
    const key = sv.join(':');
    if (dk === 'cell') { (run.summonPos ||= {})[key] = toPos(+dv[0], +dv[1], G); persist(); }
    else if (dk !== 'bench') toast('소환물 · 무휼은 배치 구역의 빈칸으로만 옮길 수 있습니다.');
    render(); return;
  }
  if (sk === 'turret' || (dk === 'turret' && sk !== 'unit')) { turretDrop(run, n, sk === 'turret' ? +sv[0] : -1, dk, dv); persist(); render(); return; }
  if (sk === 'unit' && dk === 'tcell') { toast('가장자리 칸에는 포탑만 둘 수 있습니다.'); render(); return; }
  if (sk === 'unit' && dk === 'turret') {
    // 기물을 포탑 칸에 놓으면: 기물이 그 칸으로, 포탑은 기물이 있던 칸으로 (대기석에서 왔으면 빈칸으로)
    const u = run.units.find((x) => x.uid === sv[0]);
    const tcs = turretCells(run, n), j = +dv[0], q = tcs[j];
    if (!u || !q) return;
    if (q.x < PAD || q.x >= PAD + n) { toast('가장자리 칸에는 포탑만 둘 수 있습니다.'); render(); return; }
    if (!R.canDeploy(run, u)) { toast('이번 페이즈에는 배치할 수 없는 기물입니다.'); render(); return; }
    if (!u.pos) { const e = R.deployBlock(run); if (e) { toast(`${e}.`); render(); return; } }
    const from = layout(run, n).get(u.uid);
    const tp = tcs.map((c) => turretSavePos(c.x, c.y, n, G));
    if (from) tp[j] = turretSavePos(from.x, from.y, n, G);
    else tp.splice(j, 1); // 자리를 잃은 포탑은 보이는 포탑의 맨 뒤로
    run.turretPos = tp;
    u.pos = toPos(q.x, q.y, G);
    if (!from) run.turretPos = turretCells(run, n).map((c) => turretSavePos(c.x, c.y, n, G));
    app.sel = { k: 'unit', uid: u.uid };
    persist(); render(); return;
  }
  if (sk === 'unit') {
    const u = run.units.find((x) => x.uid === sv[0]);
    if (!u) return;
    const lay = layout(run, n);
    // 탐험가는 정해진 페이즈 전에는 보드에 올릴 수 없다
    const other0 = dk === 'unit' ? run.units.find((x) => x.uid === dv[0]) : null;
    const blocked = (dk === 'cell' && !R.canDeploy(run, u)) || (dk === 'unit' && other0 && ((other0.pos && !R.canDeploy(run, u)) || (u.pos && !R.canDeploy(run, other0))));
    if (blocked) { toast('이번 페이즈에는 배치할 수 없는 기물입니다.'); render(); return; }
    // 반려 돌 (절망 증강)은 늘 출전: 반려 돌이 대기석으로 내려가는 이동은 막는다 (자리 바꾸기는 된다)
    const cellOf = dk === 'cell' ? deployed(run).find((o) => { const p = lay.get(o.uid); return p && p.x === +dv[0] && p.y === +dv[1]; }) : null;
    if ((R.isRock(u) && (dk === 'bench' || (dk === 'unit' && !other0?.pos))) || (!u.pos && ((cellOf && R.isRock(cellOf)) || (other0 && R.isRock(other0))))) { toast('반려 돌은 늘 출전합니다. 대기석으로 옮길 수 없습니다.'); render(); return; }
    if (dk === 'cell') {
      const x = +dv[0], y = +dv[1];
      const other = deployed(run).find((o) => { const p = lay.get(o.uid); return p && p.x === x && p.y === y; });
      if (other === u) return;
      if (other) {
        const mine = lay.get(u.uid);
        other.pos = mine ? toPos(mine.x, mine.y, G) : null;
      } else if (!u.pos) { const e = R.deployBlock(run); if (e) { toast(`${e}.`); render(); return; } }
      u.pos = toPos(x, y, G);
    } else if (dk === 'bench') {
      u.pos = null;
    } else if (dk === 'unit') {
      const o = run.units.find((x) => x.uid === dv[0]);
      if (!o || o === u) return;
      const pu = lay.get(u.uid), po = lay.get(o.uid);
      u.pos = po ? toPos(po.x, po.y, G) : null;
      o.pos = pu ? toPos(pu.x, pu.y, G) : null;
    }
    app.sel = { k: 'unit', uid: u.uid };
  } else if (sk === 'relic') {
    if (dk === 'unit' || dk === 'eqitem') { const e = R.equipRelic(run, dv[0], sv[0]); if (e) toast(e); else { toast(`성유물 장착: ${RELIC_BY_ID[sv[0]].name}`); app.sel = { k: 'unit', uid: dv[0] }; } }
  } else if (sk === 'item' && isConsumable(run.inventory[+sv[0]])) {
    // 소모품: 기물 · 장비에 끌어다 놓으면 확인 창
    const i = +sv[0];
    const ct = CONSUMABLES[run.inventory[i]].target;
    const tg: R.UseTarget | null = (dk === 'cell' || dk === 'xcell') ? (ct === 'place' ? { k: 'cell', x: +dv[0], y: +dv[1] } : null) : dk === 'foe' ? { k: 'foe', i: +dv[0] } : ct === 'run' && (dk === 'unit' || dk === 'eqitem' || (dk === 'invitem' && +dv[0] !== i)) ? { k: 'run' }
      : dk === 'unit' ? { k: 'unit', uid: dv[0] } : dk === 'invitem' && +dv[0] !== i ? { k: 'inv', i: +dv[0] }
      : dk === 'eqitem' ? (ct === 'unit' && !CONSUMABLES[run.inventory[i]].alsoItem ? { k: 'unit', uid: dv[0] } : { k: 'eq', uid: dv[0], slot: +dv[1] }) : null;
    if (tg) tryUse(run, i, tg);
  } else if (sk === 'item') {
    const idx = +sv[0];
    if (dk === 'eqitem' || dk === 'unit') app.sel = equipAsk(run, idx, dv[0], dk === 'eqitem' ? +dv[1] : undefined);
    else if (dk === 'invitem') {
      if (!askCombineInv(run, idx, +dv[0])) { if (idx !== +dv[0]) toast('조합할 수 없는 장비입니다.'); app.sel = null; }
    }
  } else if (sk === 'eq') {
    // 장착 장비 → 보관함 · 다른 기물 (기물 상세 패널의 장비 끌기 포함). 분리 용제 규칙 · 조합 확인은 moveEq
    const [uid, slot] = sv;
    if (dk === 'inv' || dk === 'invitem') moveEq(run, uid, +slot, null);
    else if ((dk === 'unit' || dk === 'eqitem') && dv[0] !== uid) moveEq(run, uid, +slot, dv[0], dk === 'eqitem' ? +dv[1] : undefined);
  }
  persist();
  render();
}

/** 포탑에 장비를 놓으려 할 때 (포탑 장비는 엔지니어 단계에서 고른다) */
export const TURRET_NO_GEAR = '포탑에는 장비를 장착할 수 없습니다 (포탑 장비는 엔지니어 단계에서 고릅니다).';
/** 감시 포탑 끌어 옮기기: 기물이 없는 아군 칸 · 가장자리 칸으로만. 다른 포탑 위면 자리 교환. 판매 · 대기석 · 장비는 불가 */
export function turretDrop(run: RunState, n: number, i: number, dk: string, dv: string[]) {
  const G = runGeo(run, n);
  if (i < 0) { toast(TURRET_NO_GEAR); return; }
  const tcs = turretCells(run, n);
  if (!tcs[i]) return;
  const tp = tcs.map((c) => turretSavePos(c.x, c.y, n, G));
  if (dk === 'turret') {
    const j = +dv[0];
    if (j === i || !tp[j]) return;
    [tp[i], tp[j]] = [tp[j], tp[i]];
  } else if (dk === 'cell' || dk === 'tcell') {
    const x = +dv[0], y = +dv[1];
    if ([...layout(run, n).values()].some((p) => p.x === x && p.y === y)) { toast('기물이 있는 칸에는 포탑을 둘 수 없습니다.'); return; }
    const j = tcs.findIndex((c) => c.x === x && c.y === y);
    if (j >= 0) [tp[i], tp[j]] = [tp[j], tp[i]];
    else tp[i] = turretSavePos(x, y, n, G);
  } else if (dk === 'bench' || dk === 'inv' || dk === 'invitem') { toast('포탑은 대기석으로 옮기거나 판매할 수 없습니다.'); return; }
  else if (dk === 'unit' || dk === 'eqitem') { toast('기물이 있는 칸에는 포탑을 둘 수 없습니다.'); return; }
  else return;
  run.turretPos = tp;
}
