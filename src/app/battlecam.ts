// 전투 카메라 · 전투 보드 확대 · 끌어 옮기기 · 전투 화면 붙이기 (main.ts 에서 분리)
import { CFG } from '../config';
import { ENEMY_BY_ID } from '../data/enemies';
import * as ACH from '../ui/achieve';
import { buildBattle, PAD } from '../engine/build';
import { Battle, type CUnit } from '../engine/combat';
import * as R from '../engine/run';
import { rectScr, toScr } from '../engine/build';
import { BattleView } from '../ui/battleview';
import { metaBarMvp, metaBattle, metaRunEnd } from '../ui/meta';
import * as SND from '../ui/sound';
import { recEnd } from '../engine/report';
import { app, loadPrefs, persist, root, savePref } from './state';
import { banner, itemIcon, topbar } from './common';
import { animateResult, applySpeed, encName, majorCache, pickMvp, setBunitFor, summaryModal, updateMeter } from './battle';
import { pinch } from './zoom';
import { blockClicks } from './drag';

/** 카메라 가로 위치를 고를 때 적 1기의 무게 (아군 1) */
export const CAM_FOE_W = 1.01;
/** 전투 카메라 (화면 칸 좌표, 가로 지형도 화면 기준): 창 왼쪽 위 칸 (x, y) · 확대 배율 bz (1 = 배치 구역 크기) · 수동 시점을 유지할 시각 hold (끌기 · 확대 뒤 잠깐 그 자리) */
export const bcam = { x: 0, y: 0, bz: 1, hold: 0 };
export const CAM_HOLD_MS = 4000;
/** 전투 창 치수 (화면 칸): 배율 1 의 창 W × H · 전장 FW × FH · 기본 창 원점 */
export function bviewDims(view: HTMLElement) {
  const v = (k: string) => +view.style.getPropertyValue(k) || 0;
  return { W: v('--w'), H: v('--h'), FW: v('--fw'), FH: v('--fh'), ox: v('--ox'), oy: v('--oy') };
}
/** 전투 창: 칸 최소 크기 (CSS --cell-min) 의 BZ_MAX 배까지 확대 (편성 보드는 prepZoomRange · PREP_CELL_MAX) */
export const BZ_MAX = 2;
export const cellMinOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue('--cell-min')) || 52;
/** 전투 창 최대 배율: 칸이 최소 칸 크기의 BZ_MAX 배가 될 때까지 (작은 창 · 긴 가로 지형일수록 더 확대) */
export function battleZoomMax(view: HTMLElement) {
  const d = bviewDims(view), c1 = view.clientWidth / Math.max(1, d.W);
  return c1 > 0 ? Math.max(1, (BZ_MAX * cellMinOf(view)) / c1) : 1;
}
export const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v));
/** 지금 배율의 창 크기 (px) · 칸 크기 · 보이는 칸 수. 창은 늘 정사각이고, 확대하면 그 안에서 잘라서 보인다 */
export function camFrame(view: HTMLElement) {
  const d = bviewDims(view), wpx = view.clientWidth, base = (wpx * d.H) / Math.max(1, d.W), cell = (wpx * bcam.bz) / Math.max(1, d.W);
  const hpx = base; // 창은 확대해도 정사각 그대로 (bviewHtml): 확대는 창 안을 잘라 보일 뿐
  return { d, cell, hpx, vw: d.W / bcam.bz, vh: hpx / cell };
}
/** 카메라를 창에 반영: 창 높이 · 창 안 보드(.board-in) 크기 = 전장 × 칸 크기, 위치 = -카메라 칸 (px) */
export function camApply(view: HTMLElement, inner: HTMLElement) {
  const f = camFrame(view), { d, cell } = f;
  bcam.x = d.FW >= f.vw ? clampN(bcam.x, 0, d.FW - f.vw) : (d.FW - f.vw) / 2; // 전장이 창보다 좁은 쪽은 가운데 (정사각 창)
  bcam.y = d.FH >= f.vh ? clampN(bcam.y, 0, d.FH - f.vh) : (d.FH - f.vh) / 2;
  view.style.height = bcam.bz <= 1.001 ? '' : `${f.hpx}px`;
  view.classList.toggle('zoomed', bcam.bz > 1.001);
  Object.assign(inner.style, { width: `${d.FW * cell}px`, height: `${d.FH * cell}px`, left: `${-bcam.x * cell}px`, top: `${-bcam.y * cell}px` });
  const ctl = view.querySelector<HTMLElement>('.bz-bat');
  if (ctl) {
    const mx = battleZoomMax(view);
    ctl.hidden = mx <= 1.01;
    ctl.querySelector<HTMLButtonElement>('[data-v="out"]')!.disabled = bcam.bz <= 1.001;
    ctl.querySelector<HTMLButtonElement>('[data-v="in"]')!.disabled = bcam.bz >= mx - 0.001;
  }
  return f;
}
/** 전투 카메라: 배율 1 이면 가장 뒤쪽 기물이 창 끝 줄에 오도록 (사거리 최대 4칸이라 교전은 창 안), 확대 중이면 기물들의 무게중심을 따라간다 (긴 가로 지형은 가로로).
 *  계산은 전장 좌표, 반영은 화면 좌표 (rectScr). 끌거나 확대한 뒤 CAM_HOLD_MS 동안은 그 자리 */
export function followCamera(b: Battle) {
  const inner = document.querySelector<HTMLElement>('.bview:not(.full) .board-in');
  if (!inner) return;
  const view = inner.parentElement!;
  // 중립 지형물 (유닉스 답례 투하의 반려 돌 · 묘석 = 적 쪽 장애물)은 카메라가 따라가지도, 세지도 않는다. 아군 반려 돌(인화성)은 아군이라 센다
  const alive = b.units.filter((u) => u.alive && !(u.side === 1 && u.mem.inert));
  if (!alive.length) return;
  const ex = +(view.dataset.ex || 0); // 포탑 가장자리 열을 함께 보이는 만큼
  const viewH = b.h - 2 * PAD, viewW = b.w - 2 * PAD + 2 * ex;
  const f0 = camFrame(view), rot = !!b.geo?.rot;
  let left = PAD - ex, top = 0, vw = viewW, vh = viewH;
  if (bcam.bz <= 1.001) {
    // 정사각 창 (bviewHtml): 한 변 sq 칸. 전장보다 넓은 쪽은 가운데, 좁은 쪽은 기물을 따라간다
    const sq = Math.max(viewW, viewH);
    vw = vh = sq;
    const maxY = Math.max(...alive.map((u) => u.y));
    top = sq >= b.h ? (b.h - sq) / 2 : Math.max(0, Math.min(b.h - sq, maxY - (sq - 1)));
    // 가로: 좌우 끝 기물을 따라가되, 양쪽에 다 있으면 더 많은 기물이 보이는 위치 (같으면 가운데). 적은 아군보다 살짝 무겁게 (같은 수면 적이 있는 쪽)
    if (sq >= b.w) left = (b.w - sq) / 2;
    else {
      let best = -1;
      for (const c of [(b.w - sq) / 2, 0, b.w - sq]) {
        const seen = alive.filter((u) => u.x >= c && u.x < c + sq).reduce((a, u) => a + (u.side === 1 ? CAM_FOE_W : 1), 0);
        if (seen > best + 1e-9) { best = seen; left = c; }
      }
    }
  } else {
    vw = rot ? f0.vh : f0.vw; vh = rot ? f0.vw : f0.vh; // 보이는 칸 수 (전장 방향)
    let sx = 0, sy = 0, sw = 0;
    for (const u of alive) { const k = u.side === 1 ? CAM_FOE_W : 1; sx += (u.x + 0.5) * k; sy += (u.y + 0.5) * k; sw += k; }
    let cx = sx / sw, cy = sy / sw;
    // 아군 · 적이 멀리 떨어져 무게중심 창에 아군이 하나도 없으면 (긴 통로 개전 등) 빈 사이를 비추지 말고 아군 쪽에서 가장 가까운 적 방향으로 창 끝까지만 민다
    const ally = alive.filter((u) => u.side === 0), foes = alive.filter((u) => u.side === 1);
    if (ally.length && !ally.some((u) => Math.abs(u.x + 0.5 - cx) < vw / 2 && Math.abs(u.y + 0.5 - cy) < vh / 2)) {
      const ax = ally.reduce((t, u) => t + u.x + 0.5, 0) / ally.length, ay = ally.reduce((t, u) => t + u.y + 0.5, 0) / ally.length;
      const e = foes.sort((p, q) => Math.hypot(p.x - ax, p.y - ay) - Math.hypot(q.x - ax, q.y - ay))[0];
      const mx = Math.max(0, vw / 2 - 1.5), my = Math.max(0, vh / 2 - 1.5);
      cx = ax + (e ? clampN(e.x + 0.5 - ax, -mx, mx) : 0); cy = ay + (e ? clampN(e.y + 0.5 - ay, -my, my) : 0);
    }
    left = clampN(cx - vw / 2, 0, b.w - vw);
    top = clampN(cy - vh / 2, 0, b.h - vh);
  }
  if (performance.now() >= bcam.hold) { const r = rectScr(b.geo, left, top, vw, vh); bcam.x = r.x; bcam.y = r.y; }
  const f = camApply(view, inner);
  offIndicators(view, alive, b, bcam.x, bcam.y, f.vw, f.vh);
}
/** 화면 밖 기물 표시: 카메라 창 밖에 있는 아군 · 적의 방향을 창 가장자리 삼각형으로 (진영 색 · 인원 수). 장애물(반려 돌 등)은 세지 않는다.
 *  위치는 그 방향 기물들의 평균 칸 (가장자리를 따라), 모서리 방향은 모서리에. 바뀔 때만 다시 그린다. 창 · 좌표는 화면 칸 (가로 지형은 돌려서) */
export function offIndicators(view: HTMLElement, alive: CUnit[], b: Battle, left: number, top: number, viewW: number, viewH: number) {
  let box = view.querySelector<HTMLElement>(':scope > .off-ind');
  if (!box) { box = document.createElement('div'); box.className = 'off-ind'; box.setAttribute('aria-hidden', 'true'); view.appendChild(box); }
  const groups = new Map<string, { side: number; dx: number; dy: number; xs: number[]; ys: number[] }>();
  for (const u of alive) {
    if (u.mem.inert) continue;
    const s = toScr(b.geo, u.x, u.y), cx = s.x + 0.5, cy = s.y + 0.5;
    const dx = cx < left ? -1 : cx > left + viewW ? 1 : 0, dy = cy < top ? -1 : cy > top + viewH ? 1 : 0;
    if (!dx && !dy) continue;
    const side = u.side === 0 ? 0 : 1, k = `${side}:${dx}:${dy}`;
    const g = groups.get(k) || { side, dx, dy, xs: [], ys: [] };
    g.xs.push(s.x); g.ys.push(s.y); groups.set(k, g);
  }
  const clamp = (v: number) => Math.max(6, Math.min(94, v));
  const avg = (l: number[]) => l.reduce((a, c) => a + c, 0) / l.length;
  const html = [...groups.values()].map((g) => {
    const px = g.dx ? (g.dx < 0 ? 0 : 100) : clamp(((avg(g.xs) - left + 0.5) / viewW) * 100);
    const py = g.dy ? (g.dy < 0 ? 0 : 100) : clamp(((avg(g.ys) - top + 0.5) / viewH) * 100);
    const deg = Math.round((Math.atan2(g.dy, g.dx) * 180) / Math.PI);
    // 같은 가장자리 · 같은 자리에 아군 · 적이 겹치면 진영별로 조금 비켜 둔다
    const nudge = g.side ? 7 : -7, ox = g.dx ? 0 : nudge, oy = g.dx && !g.dy ? nudge : 0;
    return `<i class="oi s${g.side}" style="left:calc(${px}% + ${ox}px);top:calc(${py}% + ${oy}px);--oi-r:${deg}deg"><b>${g.xs.length}</b></i>`;
  }).join('');
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}
/** 전투 창 확대 · 축소 (Ctrl + 휠 · 두 손가락 · ± 단추): 가리킨 점(없으면 창 가운데)이 그 자리에 머물게. 보는 사람마다 errantes.prefs.v1 battleZoom = 칸 크기 / 최소 칸 크기 (0 = 배율 1) */
export let bzSaveT = 0;
export function battleZoomTo(bz: number, at?: { x: number; y: number }) {
  const view = document.querySelector<HTMLElement>('.bview:not(.full)'), inner = view?.querySelector<HTMLElement>('.board-in');
  if (!view || !inner) return;
  const r = view.getBoundingClientRect(), f0 = camFrame(view);
  const z1 = clampN(bz, 1, battleZoomMax(view));
  if (Math.abs(z1 - bcam.bz) < 1e-4) return;
  const ax = at ? at.x - r.left : r.width / 2, ay = at ? at.y - r.top : r.height / 2;
  const cx = bcam.x + ax / f0.cell, cy = bcam.y + ay / f0.cell; // 가리킨 화면 칸
  bcam.bz = z1;
  const cell1 = (r.width * z1) / Math.max(1, f0.d.W);
  bcam.x = cx - ax / cell1;
  bcam.y = cy - ay / cell1;
  bcam.hold = performance.now() + CAM_HOLD_MS;
  zoomingFlag(view);
  const f = camApply(view, inner);
  if (app.view) offIndicators(view, app.view.b.units.filter((u) => u.alive && !(u.side === 1 && u.mem.inert)), app.view.b, bcam.x, bcam.y, f.vw, f.vh);
  clearTimeout(bzSaveT);
  bzSaveT = window.setTimeout(() => savePref('battleZoom', z1 <= 1.001 ? 0 : +(cell1 / cellMinOf(view)).toFixed(3)), 250);
}
/** 확대 중에는 창 안 보드의 이동 애니메이션을 끈다 (크기와 위치가 같이 바뀌어야 가리킨 점이 흔들리지 않는다) */
export const zoomingT = new WeakMap<HTMLElement, number>();
export function zoomingFlag(el: HTMLElement) {
  el.classList.add('zooming');
  clearTimeout(zoomingT.get(el));
  zoomingT.set(el, window.setTimeout(() => el.classList.remove('zooming'), 220));
}
/** 전투 보드 끌어서 보기: 배율 1 이면 놓을 때 제자리로 (배치 구역이 기본 화면), 확대 중이면 카메라를 옮기고 CAM_HOLD_MS 동안 그 자리 */
export let panStop: (() => void) | null = null;
export function initBoardPan(view: HTMLElement) {
  const inner = view.querySelector<HTMLElement>('.board-in');
  if (!inner || view.classList.contains('full')) return;
  // 시작 시점: 기본 창 + 저장한 배율 (칸 크기 기준이라 지형 · 화면 크기가 달라도 같은 칸 크기)
  const d0 = bviewDims(view), pz = loadPrefs().battleZoom || 0;
  bcam.x = d0.ox; bcam.y = d0.oy; bcam.hold = 0;
  const c1 = view.clientWidth / Math.max(1, d0.W), cmin = cellMinOf(view);
  // 저장한 배율이 없으면 1, 다만 칸이 아주 작으면 (휴대폰의 긴 가로 지형) 최소 칸 크기까지 키워서 시작
  bcam.bz = clampN(pz > 0 ? (pz * cmin) / c1 : c1 < cmin * 0.6 ? cmin / c1 : 1, 1, battleZoomMax(view));
  camApply(view, inner);
  if (app.view) followCamera(app.view.b);
  let sx = 0, sy = 0, id = -1, moved = false, manual = false, x0 = 0, y0 = 0;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || pinch || (e.target as HTMLElement).closest('.bz-ctl')) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
    manual = bcam.bz > 1.001; x0 = bcam.x; y0 = bcam.y;
    inner.style.transition = manual ? 'none' : 'top .6s cubic-bezier(.4, 0, .2, 1), left .6s cubic-bezier(.4, 0, .2, 1)';
  });
  view.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; view.setPointerCapture(id); view.classList.add('panning'); }
    const f = camFrame(view);
    if (manual) { // 확대 중: 카메라를 손가락만큼 옮긴다
      bcam.x = x0 - dx / f.cell;
      bcam.y = y0 - dy / f.cell;
      bcam.hold = performance.now() + CAM_HOLD_MS;
      camApply(view, inner);
      return;
    }
    // 테두리 한 칸 + 조금 더까지만
    const mx = f.cell * 1.3, my = f.cell * 1.3;
    inner.style.transform = `translate(${Math.max(-mx, Math.min(mx, dx))}px, ${Math.max(-my, Math.min(my, dy))}px)`;
  });
  const end = (e: PointerEvent | null) => {
    if (e && e.pointerId !== id) return;
    id = -1;
    inner.style.transition = manual ? '' : 'transform .35s cubic-bezier(.2, .8, .3, 1), top .6s cubic-bezier(.4, 0, .2, 1), left .6s cubic-bezier(.4, 0, .2, 1)';
    inner.style.transform = '';
    view.classList.remove('panning');
    if (manual && moved) bcam.hold = performance.now() + CAM_HOLD_MS;
    if (moved) blockClicks(60);
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  panStop = () => { if (id >= 0) end(null); }; // 두 손가락 확대가 시작되면 끌기를 멈춘다
}
export function mountBattleView(board: HTMLElement) {
  const run = app.run!;
  const nt = run.node?.type;
  const enc = run.node!.enc!;
  if (nt === 'boss') banner('boss', 'BOSS', ENEMY_BY_ID[enc.enemies.find((e) => ENEMY_BY_ID[e.defId].tier === 'boss')?.defId || '']?.name || '보스전');
  else if (nt === 'challenge') banner('adversity', '도전', `페이즈 ${enc.phase} 역경 수준`);
  else banner(nt === 'adversity' ? 'adversity' : 'battle', nt === 'adversity' ? '역경 전투' : '전투 개시', encName(enc));
  SND.sfx('start', { boss: nt === 'boss' }); // 전투 개시음 (보스는 낮게)
  const b = buildBattle(run, run.node!.enc!);
  app.lastBattle = b;
  app.battleSel = null;
  app.bPick = null;
  majorCache.clear();
  setBunitFor('');
  app.paused = false;
  app.view = new BattleView(board, b, updateMeter, () => {
    ACH.achBattle(run, b); // 업적: 보상 처리 전 (이 전투의 노드 · 페이즈 · 연승)
    app.summary = R.resolveBattle(run, b);
    if (!run.tutorial && !run.lab) metaBattle(b); // 튜토리얼 · 훈련장 전투는 도감 기록에서 뺀다
    if (!run.tutorial && !run.lab && app.summary?.won) { const mv = pickMvp(b); if (mv) metaBarMvp(run.seed, mv.a.u.defId); } // 바 반응: 직전 런 MVP
    persist();
    // 보드는 그대로 두고 상단 바와 결과 창만 갱신
    const top = root.querySelector('header.top');
    if (top) top.outerHTML = topbar();
    // 마지막 장면을 잠깐 보여 준 뒤 결과 창을 띄운다
    setTimeout(() => {
      if (!app.summary || app.screen !== 'battle' || root.querySelector('.modal.result')) return;
      root.querySelector('main.battle')?.insertAdjacentHTML('beforeend', summaryModal(run));
      animateResult(root);
      SND.sfx(app.summary.won ? 'win' : 'lose'); // 결과 창이 뜰 때 승리 · 패배음
    }, CFG.resultDelay * 1000);
  });
  app.view.itemHtml = (id) => itemIcon(id);
  applySpeed();
  // 개시 연출이 지나간 뒤 전투 시작
  const v = app.view;
  setTimeout(() => { if (app.view === v) v.start(); }, nt === 'boss' ? 1300 : 800);
}

export function goPrepOrMap() {
  const run = app.run!;
  if (!run.over && run.campaign?.done && !run.pending.length) run.over = true; // 캠페인 끝 알림을 다 닫은 뒤 다시 불러온 저장
  if (run.over) { app.screen = 'over'; metaRunEnd(run); recEnd(run); }
  else if (run.node?.enc) app.screen = 'prep';
  else if (run.node?.type === 'shop') { app.screen = 'shop'; app.shopShut = false; } // 상점을 다시 연다 (닫기 기록 지움)
  else if (run.node?.type === 'news') app.screen = 'news';
  else if (run.node?.type === 'invest') app.screen = 'invest';
  else app.screen = 'map';
}
