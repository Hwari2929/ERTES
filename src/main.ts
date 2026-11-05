// 진입점: 화면 그리기(render) · 조작(act) · 시작(boot) 과 전역 이벤트 등록. 화면별 코드는 src/app/*.ts.
// 원래 import 는 순서 그대로 둔다 (데이터 · 엔진 모듈 평가 순서를 지킨다 — 이 파일에서 안 쓰는 것은 불러오기만).
import './engine/preview';
import { CFG } from './config';
import './data/augments';
import './data/enemies';
import './data/squads';
import './data/enemyText';
import { MAX_DIFF } from './data/difficulty';
import { CATWHEEL, despairsOf } from './data/despair';
import './data/events';
import './data/stories';
import { fieldOf } from './data/battlefields';
import './data/globals';
import { CONSUMABLES, isConsumable, isInjector, itemInfo } from './data/items';
import './data/synergies';
import './ui/tierdiff';
import { RECRUITABLE, UNIT_BY_ID } from './data/units';
import './data/emblems';
import './data/rework';
import './data/psiinfo';
import './data/augreq';
import './data/schools';
import './data/brief';
import './data/abiltext';
import * as AB from './ui/abil';
import * as CX2 from './ui/codex2';
import * as BAR from './ui/bar';
import * as CTR from './ui/contract';
import * as BRF from './ui/briefing';
import * as ACH from './ui/achieve';
import * as TFX from './ui/themefx';
import { activeTiers, runGeo, deployed } from './engine/build';
import './engine/combat';
import * as R from './engine/run';
import './data/chungra';
import './data/scene';
import { Rng } from './rng';
import { type Major, type NodeType, type RunState } from './types';
import './ui/matchup';
import './engine/build';
import { isPlaceable } from './data/devices';
import './data/maps';
import './ui/terrainlive';
import { newCampaignRun } from './engine/campaignrun';
import './engine/campaign';
import './data/campaign';
import { gradeCards, greatFlash } from './ui/revealfx';
import { FX, FX_DEFAULT, previewDeath } from './ui/battleview';
import './data/ults';
import './data/voicelines';
import { RELIC_BY_ID } from './data/relics';
import { deleteSave, importCode, loadRun, saveRun, SLOT_NAME } from './ui/save';
import { loadMeta, metaClear, metaDeed, metaEvent, metaTutEnd, tutOver } from './ui/meta';
import { loadArtPack, prefetchArt, standImg } from './ui/portraits';
import './ui/adv';
import * as SND from './ui/sound';
import * as OATH from './ui/oath';
import './ui/report';
import { recReroll } from './engine/report';
import './ui/abilicons.gen';
import './ui/synicons';
import { closeCoach, coachKey } from './ui/coach';
import { TUTORIAL_FLOW } from './data/scenes/tutorial';
import './data/glossary';
import './data/nodes';
import * as TUT from './engine/tutorial';
import { starterPool } from './engine/starters';
import * as RM from './ui/routemap';
import * as LAB from './ui/lab';
import * as SHOP from './ui/shop';
import { CAMP_SLOT, Screen, TUT_SLOT, app, applyFxPrefs, applyTheme, canFullscreen, enterFullscreen, esc, isFullscreen, loadPrefs, openContract, persist, root, savePref, toast, toggleFullscreen } from './app/state';
import { banner, interestLines, itemIcon, itemTip, statIc, topbar } from './app/common';
import { fieldBrief, foeModal, newRunScreen, titleScreen } from './app/title';
import { CAN_HOVER, relicTok } from './app/unitparts';
import { pilgrimAct } from './app/pilgrim';
import { CR, ic, mapScreen, nodeHint, phaseBoss } from './app/map';
import { devicePop, itemBrief, placeAt, placingSel, popKey, prepScreen, setTacShownPrev, setTouchPtr, tgTip, toolMark } from './app/prep';
import { detailHeadBind, foeItemTip, umCompactBind, unitModal } from './app/abilities';
import { animateResult, applySpeed, battleScreen, craneOn, crateGroup, updateMeter } from './app/battle';
import { advSync, goAfterOk, injectFx, investScreen, kvChip, menuModal, newsScreen, overScreen, pendingModal, recoModal, routeHold, setInjHold, shopScreen, useModal } from './app/modals';
import { askCombineInv, askPop, equipAsk, layoutPanels, moveEq, prepVpMid, topHSync, tryUse } from './app/popups';
import { battleZoomAct, keepMedia, pinch, pinchEnd, prepCenterOn, prepViewInit, prepZoomAct, prepZoomSync, scrollRestore, scrollSnapshot, setPinch, touchMid, zoomBy, zoomHost } from './app/zoom';
import { artWarmed, bindCardDrag, bindTabSwipe, carStep, greatBusy, revealCards, setArtWarmed, setCarX, setGreatBusy, setMapTab, setupCarousel, syncCardOpen } from './app/carousel';
import { clampN, followCamera, goPrepOrMap, initBoardPan, mountBattleView, panStop } from './app/battlecam';
import { codexScreen, cxScroll, setCxScroll } from './app/codex';
import { listTutSave, setTutEpi, tutAway, tutEpi, tutFinish, tutSync } from './app/tutorial';
import { TURRET_NO_GEAR, boardPlaceTap, cancelDrag, drag, initDrag, suppressClick } from './app/drag';
import { HOTKEYS, autoFightOk, firstOn, keyScope, tlOver, uxAfterRender, uxPrefs } from './app/hotkeys';
import { closeUmPop, hideKw, kwPinned, pinKw, placeSyn, restoredAt, setRestoredAt, showKw, showSyn, synFocus, synHl, tlPop } from './app/hover';

/** '전체 화면 유지'가 켜져 있으면 페이지를 연 뒤 첫 터치 · 클릭에서 다시 켠다 (한 번만) */
if (typeof window !== 'undefined' && loadPrefs().fullscreen && canFullscreen()) {
  const once = (e: Event) => { if ((e.target as Element | null)?.closest?.('[data-a="fullscreen"]')) return; window.removeEventListener('pointerup', once, true); if (!isFullscreen()) enterFullscreen(true); };
  window.addEventListener('pointerup', once, true);
}
window.addEventListener('pointerdown', (e) => { setTouchPtr(e.pointerType === 'touch'); }, { capture: true, passive: true });
// 마우스로 가리키면 그 대상의 결과 이름표 (끄는 동안은 toolMarkAt 이 맡는다)
root.addEventListener('pointerover', (ev) => {
  if (ev.pointerType !== 'mouse' || drag?.ghost) return;
  tgTip((ev.target as HTMLElement).closest<HTMLElement>('.prep :is(.tg-ok, .tg-no[data-tgl])'));
});
root.addEventListener('pointerleave', () => { if (!drag?.ghost) tgTip(null); });

// ───────────────────────── 렌더
const lastView = { screen: '' as string, modal: '' };
/** 대기석을 접는 그리기 (benchKeep = 접기 전 단추 화면 높이 · 대기석 높이): 페이지를 내려 둔 채 접으면 문서가 짧아져 스크롤이 끌려 올라가거나
 *  (넓은 화면) 보드 열이 sticky 로 붙어 단추가 밀린다 → 단추가 움직였으면 접힌 만큼 보드 열 아래에 빈 여백 (benchPadB)을 두어 높이를 그대로 둔다.
 *  다시 펼치면 대기석이 그만큼 자라므로 여백을 지운다 (docs/UI.md 9 · 16) */
export let benchKeep: { y: number; h: number } | null = null, benchPadB = 0;
let lastPhase = 0;
window.addEventListener('resize', () => { layoutPanels(); prepZoomSync(undefined, prepVpMid()); if (app.view) followCamera(app.view.b); });
root.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const host = zoomHost(e.target);
  if (!host) return;
  e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  zoomBy(host, clampN(Math.exp(-dy * 0.0025), 0.7, 1.4), { x: e.clientX, y: e.clientY });
}, { passive: false });
root.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  const host = zoomHost(e.touches[0].target) || zoomHost(e.touches[1].target);
  if (!host) return;
  const m = touchMid(e);
  setPinch({ host, d: Math.max(1, m.d), mx: m.x, my: m.y });
  // 한 손가락으로 시작한 끌기 (기물 · 장비 · 바리케이드 · 전투 창 끌어 보기)는 멈춘다
  cancelDrag();
  panStop?.();
}, { passive: true });
root.addEventListener('touchmove', (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const m = touchMid(e);
  if (pinch.host === 'prep') { const vp = root.querySelector<HTMLElement>('.prep .board-vp'); if (vp) { vp.scrollLeft -= m.x - pinch.mx; vp.scrollTop -= m.y - pinch.my; } }
  zoomBy(pinch.host, Math.max(1, m.d) / pinch.d, { x: m.x, y: m.y });
  pinch.d = Math.max(1, m.d); pinch.mx = m.x; pinch.my = m.y;
}, { passive: false });
root.addEventListener('touchend', pinchEnd);
root.addEventListener('touchcancel', pinchEnd);
// ───────── 브라우저 확대 막기: 화면(페이지) 배율은 늘 1 — 확대는 맵 창 안에서만 (위 제스처). 뷰포트 메타 (scripts/build.mjs) + 키 · 휠 · 사파리 제스처 · 두 손가락
if (typeof document !== 'undefined') {
  const vm = document.querySelector<HTMLMetaElement>('meta[name="viewport"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'viewport' }));
  vm.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'; // 아티팩트 게시본(문서 뼈대 없음)에도
  document.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (['+', '=', '-', '_', '0'].includes(e.key) || ['NumpadAdd', 'NumpadSubtract', 'Numpad0', 'Equal', 'Minus', 'Digit0'].includes(e.code)) e.preventDefault();
  }, true);
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}
// 전체 화면이 켜지거나 꺼지면 (뒤로 가기 · Esc 포함) 단추 글씨를 맞춘다 — 전투 중에는 다시 그리지 않는다
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { if (app.screen === 'title' || app.menu) render(); });
window.addEventListener('scroll', () => { if (root.querySelector('.stat-pop, .ask-pop')) layoutPanels(); }, { passive: true });

export function render() {
  AB.ABOPT.coef = app.detail; // 상세 보기: 피해 · 회복을 계수로
  if (app.screen !== 'battle' && app.view) { app.view.destroy(); app.view = null; }
  const run = app.run;
  if (app.goAfter && (!run || !goAfterOk(run))) app.goAfter = null; // 다른 칸 · 다른 런: 미뤄 둔 진입은 버린다
  else if (run && app.goAfter && !run.pending.length && app.screen === 'map') { const g = app.goAfter.t; app.goAfter = null; queueMicrotask(() => act('enter', g)); } // 미뤄 둔 창을 다 닫음: 고른 노드로
  if (app.popOff && !(run && placingSel(run) && app.popOff === popKey(run))) app.popOff = ''; // 놓기가 끝나거나 다른 것을 고르면 닫아 둔 팝업 기록을 지운다
  if (run && app.screen === 'shop' && lastView.screen !== 'shop' && SHOP.onOpen(run)) // 상인 상점을 열 때 인사 (처음 · 다시 열 때). 처음 연 표시(met)는 바로 저장 (불러와도 재방문 인사)
    queueMicrotask(() => { if (app.run === run && !run.over) saveRun(run, run.lab ? LAB.LAB_SLOT : run.tutorial ? TUT_SLOT : run.campaign ? CAMP_SLOT : 'auto'); });
  if (run && app.screen === 'map' && lastView.screen !== 'map' && R.ticketCount(run)) SHOP.adStart(); // 지정 소집 티켓: 지도를 열 때마다 페트라 광고판
  let body = '';
  if (app.screen === 'codex') body = codexScreen();
  else if (app.screen === 'bar') body = BAR.barScreen();
  else if (app.screen === 'oath') body = OATH.oathScreen();
  else if (app.screen === 'contract') body = CTR.contractScreen();
  else if (app.screen === 'title' || !run) body = app.screen === 'newrun' ? newRunScreen() : titleScreen();
  else if (app.screen === 'newrun') body = newRunScreen();
  else if (app.screen === 'map') body = mapScreen(run);
  else if (app.screen === 'prep') body = prepScreen(run);
  else if (app.screen === 'battle') body = battleScreen(run);
  else if (app.screen === 'shop') body = shopScreen(run);
  else if (app.screen === 'news') body = newsScreen(run);
  else if (app.screen === 'invest') body = investScreen(run);
  else if (app.screen === 'over') body = overScreen(run);
  const showTop = run && app.screen !== 'title' && app.screen !== 'contract' && app.screen !== 'newrun' && app.screen !== 'codex';
  // 다시 그려도 같은 화면 · 같은 창이면 스크롤 위치를 유지한다
  const modalKeyOf = () => (run?.pending[0] ? JSON.stringify([run.pending[0].t, (run.pending[0] as { uid?: string }).uid, (run.pending[0] as { allocDone?: boolean }).allocDone, (run.pending[0] as { options?: unknown }).options, (run.pending[0] as { round?: number }).round]) : app.menu || '');
  const modalKey = modalKeyOf();
  const sameView = lastView.screen === app.screen;
  const newModal = lastView.modal !== modalKey;
  // 스크롤된 모든 요소 기억 (같은 화면을 다시 그릴 때 복원: 증강 · 학파 고르기, 탭 전환 등)
  const scrolled = sameView ? scrollSnapshot() : [];
  const keep = ['.side.left', '.side.right', 'aside.side', '.codex-grid', '.map-detail', '.cx-detail', '.cx-list'].map((sel) => [sel, root.querySelector(sel)?.scrollTop || 0] as const);
  const modalTop = lastView.modal === modalKey ? root.querySelector('.modal')?.scrollTop || 0 : 0;
  const winY = window.scrollY;
  const prevScreen = lastView.screen;
  lastView.screen = app.screen;
  // 다시 그려도 스크롤 위치 유지 (상세 패널 · 전체 상세 팝업)
  const KEEP = ['.um-grid', '.um-a', '.um-c', '.um-r', '.um-main', '.side.right', '.map-detail', '.detail', '.shop-ov', '.so-body', '.shop-ov .sd', '.pil-ov'];
  const kept = KEEP.map((q) => root.querySelector<HTMLElement>(q)?.scrollTop ?? 0);
  const media = app.screen === 'battle' || app.screen === 'bar' ? null : keepMedia();
  TFX.beforeScreen(prevScreen, app.screen, root); // 메트로: 바뀌기 전 화면을 덮는 열차 (그리기 전에 지금 화면을 얼려 둔다)
  root.innerHTML = `${showTop ? topbar() : ''}${body}${run && app.screen !== 'codex' ? pendingModal(run) : ''}${run && (app.screen === 'prep' || app.screen === 'map') ? recoModal(run) : ''}${run ? useModal(run) : ''}${run ? askPop() : ''}${run ? LAB.labHtml(run, app.screen) : ''}${run && app.bigUnit && (app.screen === 'map' || app.screen === 'prep') ? unitModal(run) : ''}${app.preview ? unitModal(app.preview.run, true) : ''}${menuModal(run)}<div id="toast" class="toast" ${app.toast ? '' : 'hidden'}>${esc(app.toast)}</div>`;
  media?.();
  KEEP.forEach((q, k) => { const el = root.querySelector<HTMLElement>(q); if (el && kept[k]) el.scrollTop = kept[k]; });
  umCompactBind();
  detailHeadBind();
  RM.mountRouteMap(root.querySelector<HTMLElement>('.rmap-host'), app.screen === 'map' ? run : null, (el) => setTimeout(() => tlPop(el), 0), (o) => { const boss = o === 'boss' && run ? phaseBoss(run) : undefined; return `${boss ? `<b>${esc(boss.name)}</b><br>` : ''}${ic(esc(nodeHint(o)))}`; },
    { get: () => { if (!run) return undefined; const o = R.currentOptions(run); return o.includes(app.nodePick as NodeType) ? (app.nodePick as NodeType) : o[0]; }, set: (t) => act('tl-pick', t), go: (t) => act('route-go', t), auto: () => !!app.run && app.screen === 'map' && (!app.run.pending.length || routeHold(app.run)) && !app.menu }); // 분기 항로: 고른 노드 · 지도에서 고르기 — 항로도 (리빈 · 물류망). 팝오버는 누름으로 다시 그린 뒤에 연다 (항로도 DOM 은 그대로 옮겨지므로 el 이 유지된다)
  // 창 내용은 첫 그리기에서 채워질 수 있으므로 (선택지 생성 등) 그린 뒤의 키를 기억한다
  lastView.modal = modalKeyOf();
  topHSync();
  prepZoomSync(); // 보드 크기를 먼저 (창 안 스크롤 위치를 되살리려면 보드가 제 크기여야 한다)
  if (app.screen === 'prep' && run) toolMark(run); else tgTip(null); // 쥔 도구: 받을 수 없는 것을 흐리고, 받는 대상에 다음 누름 결과 (가리키면 보임)
  scrollRestore(scrolled, newModal);
  if (app.screen === 'prep') prepViewInit(sameView); // 조우를 처음 열면 아군 진형부터 · 창 가장자리 길잡이
  setRestoredAt(performance.now());
  layoutPanels();
  advSync(run ?? null);
  SHOP.shopMount(root); // 상인 말풍선 연출 · 혼잣말 시계
  SHOP.adMount(root); // 페트라 광고판 초읽기 · 자동 닫힘
  TFX.onScreen(prevScreen, app.screen); // 테마 연출: 전투 중 강도 낮춤 · (메트로) 큰 화면 전환 열차 (사건 장면이 떴는지 본 뒤)
  if (app.screen === 'bar') BAR.barMount();
  if (app.screen === 'contract') CTR.contractMount(root);
  if (app.screen === 'newrun') BRF.briefMount(root);
  // 리본 시너지 줄: 넘치면 오른쪽 끝에 '더 있음' 표시 (끝까지 밀면 사라짐)
  const ts = root.querySelector<HTMLElement>('.top-syns');
  if (ts) {
    const upd = () => ts.parentElement!.classList.toggle('more', ts.scrollLeft + ts.clientWidth < ts.scrollWidth - 4);
    upd();
    ts.addEventListener('scroll', upd, { passive: true });
  }
  // 노드 타임라인: 현재 단계를 가운데로 (다음 노드가 보이도록)
  const tl = root.querySelector<HTMLElement>('.tl');
  const cur = tl?.querySelector<HTMLElement>('.tl-step.cur, .rt-num.cur'); // 분기 항로 지도는 지금 칸 번호 칸
  if (tl && cur) tl.scrollLeft = Math.max(0, cur.offsetLeft - (tl.clientWidth - cur.offsetWidth) / 2);
  if (sameView) {
    for (const [sel, top] of keep) { const el = root.querySelector(sel); if (el && top) el.scrollTop = top; }
    if (winY) window.scrollTo(0, winY);
    const col = benchKeep && app.screen === 'prep' ? root.querySelector<HTMLElement>('.prep > .board-col') : null, tg = col?.querySelector<HTMLElement>('.bench-tog'), bn = col?.querySelector<HTMLElement>('.bench');
    if (benchKeep && col && tg && bn && Math.abs(tg.getBoundingClientRect().top - benchKeep.y) > 0.5) {
      benchPadB = Math.max(0, Math.round(benchKeep.h - bn.offsetHeight));
      col.style.paddingBottom = `${benchPadB}px`;
      window.scrollTo(0, winY);
      const d = tg.getBoundingClientRect().top - benchKeep.y;
      if (Math.abs(d) > 0.5) window.scrollBy(0, d);
    }
  }
  benchKeep = null;
  if (app.screen !== 'prep' || !loadPrefs().benchOff) benchPadB = 0;
  const md = root.querySelector('.modal');
  if (md && modalTop) md.scrollTop = modalTop;
  if (md && newModal) md.classList.add('enter');
  if (app.screen !== 'prep') setTacShownPrev(false);
  const deal = (newModal && md?.querySelector<HTMLElement>('.rc-track, .gc-row')) || (app.screen === 'newrun' && !sameView && root.querySelector<HTMLElement>('.car-track'));
  if (deal) revealCards(deal);
  if (md && run && app.screen !== 'battle') gradeCards(md as HTMLElement, run.pending[0], newModal); // 증강 · 보상 카드 등급 연출 (공개음과 같은 3단계)
  if (!artWarmed) { setArtWarmed(true); setTimeout(() => prefetchArt(RECRUITABLE.map((d) => d.id)), 1500); }
  // 페이즈 전환 연출
  if (run && run.phase !== lastPhase) { if (lastPhase && run.phase > lastPhase) banner('phase', `PHASE ${run.phase}`, `${fieldOf(run.field).name} · 적이 강해집니다`); lastPhase = run.phase; }
  if (!run) lastPhase = 0;
  if (cxScroll) { // 도감: 상세를 맨 위로. 좁은 화면은 상세 ↔ 목록이 번갈아 보이므로 상세 머리나, 돌아온 목록의 그 항목으로
    setCxScroll(false);
    const det = root.querySelector<HTMLElement>('.cx-detail'), wrapEl = root.querySelector<HTMLElement>('.cx-wrap');
    if (det) det.scrollTop = 0;
    if (innerWidth <= 860 && wrapEl) {
      const f = CX2.CX2.focus ? Array.from(root.querySelectorAll<HTMLElement>('.cx-list [data-v]')).find((el) => el.dataset.v === CX2.CX2.focus) : null;
      if (wrapEl.classList.contains('has-sel')) wrapEl.scrollIntoView({ block: 'start' }); else if (f) f.scrollIntoView({ block: 'center' });
    }
    CX2.CX2.focus = null;
  }
  if (app.screen === 'codex') { // 좁은 화면의 한 줄 탭 막대: 고른 탭이 보이게 가로로 민다
    const tb = root.querySelector<HTMLElement>('.cx-tabs'), on = tb?.querySelector<HTMLElement>('.cx-tab.on');
    if (tb && on && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, on.offsetLeft - 16);
  }
  animateResult(root);
  if (app.screen === 'newrun') setupCarousel();
  const stv = root.querySelector<HTMLElement>('.st-view');
  if (stv) bindTabSwipe(stv);
  const rc = root.querySelector<HTMLElement>('.rc-track');
  if (rc) bindCardDrag(rc);
  if (app.screen === 'battle' && app.needMount) {
    app.needMount = false;
    mountBattleView(document.getElementById('bboard')!);
    initBoardPan(root.querySelector<HTMLElement>('.bview')!);
  }
  uxAfterRender();
  tutSync();
  const fi = document.getElementById('import-file') as HTMLInputElement | null;
  if (fi) fi.onchange = () => {
    const f = fi.files?.[0];
    if (!f) return;
    f.text().then((t) => { (document.getElementById('import-code') as HTMLTextAreaElement).value = t; });
  };
}
/** 다시 그리지 않고 펼침 상태만 바꾼다 (트랜지션 유지) */
// 카드 설명을 스크롤하면 한 줄 역할(.pc-blurb)을 접는다 (맨 위로 돌아오면 다시 펼침)
if (typeof document !== 'undefined') document.addEventListener('scroll', (e) => {
  const el = e.target as HTMLElement | null;
  if (el?.classList?.contains('pc-desc')) el.closest('.pcard')?.classList.toggle('scrolled', el.scrollTop > 6);
}, { capture: true, passive: true });
setInterval(() => { if (app.run?.tutorial || tutEpi || coachKey()) tutSync(); }, 300);

// ───────────────────────── 액션
let codexFrom = ''; // 도감을 연 화면 (바에서 열었으면 바로 돌아간다)
export function act(a: string, v: string) {
  const run = app.run;
  const ask = app.ask;
  if (ask && a !== 'ask') app.ask = null; // 다른 동작을 하면 확인 팝업은 취소
  // 전투 중에는 속도 조절 / 결과 보기 / 계속만 받는다 (재렌더하면 전투 화면이 초기화됨)
  if (app.screen === 'battle' && !['speed', 'pause', 'skip', 'after-battle', 'meter-tab', 'bsel', 'bterrain', 'bdesel', 'bpick', 'stat-pop', 'abil-pop', 'toggle-detail'].includes(a)) return;
  if (a === 'map-tab') {
    // 슬라이드 전환: 다시 그리지 않고 트랙만 옮긴다
    setMapTab(+v || 0);
    return;
  }
  if (SHOP.shopAct(run, a, v)) { render(); return; } // 상인 상점 (ui/shop.ts): 고르기 · 구매 확인 · 새로고침 · 고르곤 교환
  if (pilgrimAct(run, a, v)) { render(); return; } // 순례 성소 (app/pilgrim.ts): 제례 · 나눔 받기 · 성유물 · 개종 · 마치기 (확인은 대상 옆 ✕ / ✓)
  if (a.startsWith('ct-') && a !== 'ct-back') { if (CTR.contractAct(a, v)) render(); return; } // 출격 계약 (ui/contract.ts)
  switch (a) {
    case 'newrun': // 출격 계약: 에란테스 바 카운터의 의뢰 차림표부터 (ui/contract.ts)
      if (app.screen === 'title' && !app.tutAsk && !tutOver() && !loadMeta().runs && !listTutSave()) { app.tutAsk = true; break; } // 첫 실행: 튜토리얼부터 볼지
      openContract(false); break;
    case 'newrun-custom': openContract(true); break; // 옛 '지정 의뢰' (타이틀 단추는 없어졌다): 차림표의 '메뉴에 없는 의뢰' 목록을 펼친 채로
    case 'campaign': { // 캠페인 「회수 계약」: 저장이 있으면 이어서, 없으면 1장부터 (검증판 · 쉬움 고정)
      if (app.view) { app.view.destroy(); app.view = null; }
      const saved = loadRun(CAMP_SLOT);
      app.tutAsk = false; app.menu = null; app.summary = null; app.sel = null; app.bigUnit = null; app.abilPop = null; app.mapTab = 0;
      if (saved?.campaign && !saved.over) { app.run = saved; goPrepOrMap(); }
      else { app.run = newCampaignRun(3); app.screen = 'map'; persist(); }
      break;
    }
    case 'lab-enter': // 에란테스 훈련장: 저장이 있으면 이어서, 없으면 새로 (ui/lab.ts)
      if (app.view) { app.view.destroy(); app.view = null; }
      app.tutAsk = false; app.menu = null; app.summary = null; app.sel = null; app.bigUnit = null; app.abilPop = null; app.mapTab = 0;
      app.run = LAB.labStart(); goPrepOrMap(); persist(); break;
    case 'lab': if (run) { const r = LAB.labAct(run, v); if (r.run) { app.run = r.run; goPrepOrMap(); } if (r.msg) toast(r.msg); if (r.dirty || r.run) { app.sel = null; persist(); } } break;
    case 'tutorial': case 'tutorial-restart': { // 튜토리얼: 저장이 있으면 이어서, 아니면 새로
      const saved = a === 'tutorial' ? loadRun(TUT_SLOT) : null;
      if (app.view) { app.view.destroy(); app.view = null; }
      closeCoach(); setTutEpi(false);
      app.tutAsk = false; app.menu = null; app.summary = null; app.sel = null; app.bigUnit = null; app.abilPop = null; app.mapTab = 0;
      if (saved?.tutorial) { app.run = saved; goPrepOrMap(); }
      else { deleteSave(TUT_SLOT); app.run = TUT.newTutorialRun(); app.screen = 'map'; persist(); }
      break;
    }
    case 'tut-ask-skip': app.tutAsk = false; metaTutEnd('skipped'); toast('튜토리얼을 건너뛰었습니다. 교범이 모두 열렸습니다.'); return act('newrun', '');
    case 'tut-ask-close': app.tutAsk = false; break;
    case 'tut-quit': tutFinish('skipped'); return;
    case 'intro-foe': app.introFoe = v || null; app.abilPop = null; break;
    case 'ct-back': CTR.contractBack(); app.screen = 'contract'; break; // 명부 '뒤로' → 차림표 (서명은 무른다)
    case 'car-prev': case 'car-next': carStep(a === 'car-next' ? 1 : -1); return;
    case 'syn-peek': return; // 시너지 아이콘 탭: 이름만 보여준다 (클릭 핸들러에서 처리)
    case 'card-tap': return act('pick-starter', v); // 카드를 누르면 선택 · 해제
    case 'card-open': app.cardOpen = app.cardOpen === v ? null : v; syncCardOpen(); return; // 터치: 설명 펼치기 · 접기
    case 'card-max': { // 영입 · 계약 카드의 최대화: 런(없으면 임시 런)을 복제해 그 기물을 합류시킨 모습으로 전체 상세
      const tmp = app.run ? structuredClone(app.run) : R.newRun(1, [v], app.introField || undefined, app.diff);
      const pu = app.run ? R.addUnit(tmp, v, UNIT_BY_ID[v].inert ? 1 : R.recruitRank(app.run)) : tmp.units[0];
      if (pu) { app.preview = { defId: v, run: tmp, uid: pu.uid }; app.abilPop = null; }
      break;
    }
    case 'toggle-detail': app.detail = !app.detail; savePref('detail', app.detail); if (app.screen === 'battle') { updateMeter(true); return; } break;
    case 'toggle-sub': if (app.subOpen.has(v)) app.subOpen.delete(v); else app.subOpen.add(v); break;
    case 'to-title': if (app.view) { app.view.destroy(); app.view = null; } tutAway(); app.screen = 'title'; app.menu = null; app.run = null; break;
    case 'pick-starter': {
      const i = app.starters.indexOf(v);
      if (i >= 0) app.starters.splice(i, 1);
      else if (app.starters.length < CFG.startUnits) app.starters.push(v);
      else toast(`${CFG.startUnits}명까지 고를 수 있습니다.`);
      break;
    }
    case 'random-starters': app.starters = new Rng(Date.now() | 0).sample(app.pool, CFG.startUnits); break;
    case 'reroll-starters': // 후보 새로고침: 고른 기물을 모두 해제하고 후보 전체를 새로 (직전 후보와 되도록 겹치지 않게, 우세 시너지 보장 유지)
      if (app.poolRerolls <= 0) return;
      app.poolRerolls--; app.starters = []; app.pool = starterPool(new Rng((Date.now() ^ (Math.random() * 1e9)) | 0), app.introField, [], app.pool); setCarX(null); app.cardOpen = null;
      break;
    case 'start-run':
      if (app.starters.length !== CFG.startUnits) return;
      app.run = R.newRun((Date.now() ^ (Math.random() * 1e9)) | 0, app.starters, app.introField || undefined, Math.min(app.diff, MAX_DIFF), OATH.sel()); // 절망 서약: 고난 이상일 때만 옮긴다
      { const sc = CTR.signedContract(); if (sc && sc.field === app.introField) { app.run.contract = sc.contract; metaDeed(sc.field, sc.diff); } } // 영수 증서 (상단 바 칩 · 보수 가감) · 전표 번호 · 늘 하던 대로
      app.screen = 'map'; app.sel = null; persist(); break;
    case 'load': {
      const r = loadRun(v);
      if (!r) { toast('저장 데이터를 읽을 수 없습니다.'); return; }
      if (app.view) { app.view.destroy(); app.view = null; }
      app.run = r; app.menu = null; app.summary = null; app.sel = null;
      goPrepOrMap();
      toast(`${SLOT_NAME[v]} 불러옴`);
      break;
    }
    case 'save': if (run) { toast(saveRun(run, v) ? `${SLOT_NAME[v]}에 저장했습니다.` : '이 브라우저에서는 저장소를 쓸 수 없습니다. 저장 코드를 이용하세요.'); } break;
    case 'menu': app.menu = 'menu'; break;
    case 'menu-tab': app.menu = v as 'menu' | 'settings'; break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'pref-zoom': app.zoomOut = !app.zoomOut; savePref('zoomOut', app.zoomOut); break;
    case 'pref-barreceipt': savePref('barReceiptManual', !loadPrefs().barReceiptManual); break;
    case 'pref-motion': savePref('motion', v); applyFxPrefs(); break;
    case 'pref-death': savePref('death', v); applyFxPrefs(); render(); { const h = document.querySelector<HTMLElement>('.dpv'); if (h) previewDeath(h, FX.death); } return;
    case 'death-preview': { const h = document.querySelector<HTMLElement>('.dpv'); if (h) previewDeath(h, FX.death); } return;
    case 'pref-theme': savePref('uiTheme', v); applyTheme(); break;
    case 'pref-uifx': savePref('uiFx', v); applyTheme(); break;
    case 'pref-ultcut': savePref('ultCut', v); applyFxPrefs(); break;
    case 'pref-fx-reset': savePref('fxMs', FX_DEFAULT.fxMs); savePref('skillMs', FX_DEFAULT.skillMs); savePref('motion', FX_DEFAULT.motion); savePref('death', FX_DEFAULT.death); savePref('ultCut', FX_DEFAULT.ultCut); applyFxPrefs(); break;
    case 'pref-slow': app.slowDetail = !app.slowDetail; savePref('slowDetail', app.slowDetail); applySpeed(); break;
    case 'pref-autores': savePref('autoResult', +v || 0); break;
    case 'pref-autofight': savePref('autoFight', !uxPrefs().autoFight); break;
    case 'pref-keyhints': savePref('keyHints', !uxPrefs().keyHints); break;
    case 'menu-close': app.menu = null; app.importErr = ''; break;
    case 'menu-export': app.menu = 'export'; break;
    case 'menu-import': app.menu = 'import'; app.importErr = ''; break;
    case 'copy-code': {
      const ta = document.getElementById('export-code') as HTMLTextAreaElement;
      const done = () => toast('복사했습니다.');
      try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast('코드를 선택했습니다. 직접 복사하세요.'); }); } catch { ta.select(); }
      return;
    }
    case 'import-go': {
      const code = (document.getElementById('import-code') as HTMLTextAreaElement).value;
      const r = importCode(code);
      if (!r) { app.importErr = '올바른 저장 코드가 아닙니다. ERR1: 로 시작하는 코드 전체를 붙여 넣으세요.'; break; }
      if (app.view) { app.view.destroy(); app.view = null; }
      app.run = r; app.menu = null; app.summary = null; app.sel = null; persist();
      goPrepOrMap();
      toast('불러왔습니다.');
      break;
    }
    case 'tl-pick': app.nodePick = v; break;
    case 'route-go': app.nodePick = v; act('enter', v); return; // 항로도에서 노드를 눌러 바로 진행
    case 'abil-pop': app.abilPop = !v || app.abilPop === v ? null : v; app.statPop = false; if (app.screen === 'battle') { updateMeter(true); return; } break;
    case 'stat-pop': app.statPop = !app.statPop; app.abilPop = null; if (app.screen === 'battle') { updateMeter(true); return; } break;
    case 'reco': app.recoFor = v || null; break;
    case 'desel': app.sel = null; app.abilPop = null; app.statPop = false; break;
    case 'use-self': if (run) { const r = R.useConsumable(run, +v, { k: 'run' }); toast(r.msg); if (r.ok) { app.sel = null; persist(); } } break;
    case 'use-k': {
      const u = app.useK;
      app.useK = null;
      if (run && u && v === 'ok') {
        const k = run.inventory[u.i], tu = u.tg.k === 'unit' ? run.units.find((x) => x.uid === (u.tg as { uid: string }).uid) : undefined;
        const r0 = tu?.rank ?? 0, x0 = tu?.xp ?? 0;
        const r = R.useConsumable(run, u.i, u.tg);
        if (r.ok) ACH.achUse(run, k, u.tg);
        // 공명 주입기: 편성 화면이면 기물 위 작은 알림으로 (등급 상승 창은 연출 뒤로 미룬다), 아니면 보통 알림
        if (r.ok && tu && isInjector(k) && app.screen === 'prep') { setInjHold(tu.rank > r0); requestAnimationFrame(() => injectFx(tu.uid, r0, x0, tu.xp, tu.rank)); } else toast(r.msg);
        app.sel = null; persist();
      }
      break;
    }
    case 'ask': app.ask = null; if (v === 'ok' && ask?.ok) ask.ok(); else app.sel = null; break; // ✓ 확인 · ✕ 취소 (선택도 푼다)
    case 'use-eq': { // 소모품을 고른 채로 기물의 장착 장비를 누름: 끌어 놓기와 같은 대상 (기물용 소모품은 그 기물, 재구성 회로 · 장비용은 그 장비)
      if (!run || app.sel?.k !== 'item' || !isConsumable(run.inventory[app.sel.idx])) return;
      const [uid, sl] = v.split(':'), c = CONSUMABLES[run.inventory[app.sel.idx]];
      tryUse(run, app.sel.idx, c.target === 'unit' && !c.alsoItem ? { k: 'unit', uid } : { k: 'eq', uid, slot: +sl });
      break;
    }
    case 'field-info': if (run) run.pending.unshift({ t: 'field' }); break;
    case 'enter': { app.sqSel = null; // 새 조우: 고른 분대 풀기
      if (!run) return;
      if (!run.tutorial && !run.node && !R.currentOptions(run).includes(v as NodeType)) { app.goAfter = null; return; } // 이 칸에서 갈 수 없는 노드
      if (run.pending.length) { if (routeHold(run)) { app.goAfter = { t: v as NodeType, step: run.step, phase: run.phase }; app.nodePick = v; render(); } return; } // 갈림길에서 고름: 미뤄 둔 창을 띄우고, 다 닫으면 들어간다
      app.goAfter = null;
      if (run.tutorial && TUTORIAL_FLOW[run.tutorial.i]?.[0] === 'scene') return; // 튜토리얼: 장면이 먼저 (장면 뒤에 노드로 들어간다)
      if (run.tutorial) TUT.tutEnterNode(run, v as NodeType); else R.enterNode(run, v as NodeType);
      app.sel = null;
      app.nodePick = null;
      goPrepOrMap();
      persist();
      if (autoFightOk(run)) return act('fight', ''); // 설정: 편성 그대로 바로 전투
      break;
    }
    case 'resume': goPrepOrMap(); break;
    case 'shop-close': if (run) { SHOP.farewell(run, 'close'); app.shopShut = true; app.screen = 'map'; app.sel = null; persist(); } break; // 상인 상점 닫기: 이 칸은 그대로 (지도의 [상점 열기] · [떠나기])
    case 'ad-skip': SHOP.adStop(); return;
    case 'autofill': {
      if (!run) return;
      const n = R.autoFill(run), full = R.deployBlock(run), left = run.units.some((u) => !u.pos && R.canDeploy(run, u));
      toast(n ? `${n}명을 배치했습니다.${full === R.ROOM_ERR && left ? ` ${full}.` : ''}` : left && full ? `${full}.` : '배치할 수 있는 대기 기물이 없습니다.');
      if (n) persist();
      break;
    }
    case 'tac-info': app.tacOpen = !app.tacOpen; break;
    case 'focus': if (run) { const f = new Set(run.focus || []); if (f.has(v)) f.delete(v); else f.add(v); run.focus = [...f].filter((id) => run.units.some((u) => u.uid === id)); persist(); } break; // 집중 육성 지정 · 해제
    case 'map-unit': app.sel = v ? { k: 'unit', uid: v } : null; app.bigUnit = v || null; app.statPop = false; app.abilPop = null; break;
    case 'big-open': app.bigUnit = v; app.sel = { k: 'unit', uid: v }; app.statPop = false; app.abilPop = null; break;
    case 'big-close': app.preview = null; app.bigUnit = null; app.abilPop = null; app.releaseConfirm = null; if (app.screen === 'map') app.sel = null; break;
    case 'manage': app.screen = 'prep'; app.sel = v ? { k: 'unit', uid: v } : null; break;
    case 'to-map': app.screen = run?.node?.type === 'shop' && !app.shopShut ? 'shop' : run?.node?.type === 'news' ? 'news' : run?.node?.type === 'invest' ? 'invest' : 'map'; break; // 상점에서 편성에 갔다 돌아오면 같은 상점 (닫고 나왔으면 지도)
    case 'fight': {
      if (!run || !deployed(run).length) return;
      const benched = R.fitDeploy(run); // 안전장치: 설 자리가 없는 출전 기물은 대기석으로 (전투에서 조용히 빠지지 않게) — 편성을 다시 보여 준다
      if (benched.length) { run.pending.push(R.roomNotice(run, benched)); persist(); break; } // 까닭 (아군 진형 크기 · 장치 칸 · 출전 인원)을 알림 창으로
      persist();
      app.summary = null;
      app.screen = 'battle';
      app.needMount = true; // render() 가 보드를 그린 뒤 전투 뷰를 붙인다
      break;
    }
    case 'pause': app.paused = !app.paused; applySpeed(); return;
    case 'speed': app.paused = false; app.speed = +v; savePref('speed', app.speed); applySpeed(); document.querySelectorAll('.speed .btn').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.v === v)); return;
    case 'skip': app.view?.skip?.(); return;
    case 'after-battle': app.summary = null; app.sel = null; app.abilPop = null; app.statPop = false; // 전투 전 선택이 상세 창으로 남지 않게
      if (app.view) { app.view.destroy(); app.view = null; } goPrepOrMap(); break;
    case 'sel-unit':
      app.abilPop = null;
      if (app.sel?.k === 'relic' && run) { const e = R.equipRelic(run, v, app.sel.id); if (e) toast(e); else toast(`성유물 장착: ${RELIC_BY_ID[app.sel.id].name}`); app.sel = { k: 'unit', uid: v }; persist(); break; }
      if (app.sel?.k === 'item' && run && isConsumable(run.inventory[app.sel.idx])) { tryUse(run, app.sel.idx, CONSUMABLES[run.inventory[app.sel.idx]].target === 'run' ? { k: 'run' } : { k: 'unit', uid: v }); break; } // 탭: 소모품 → 기물 (바로 쓰는 소모품은 함대)
      app.sel = app.sel?.k === 'item' && run ? equipAsk(run, app.sel.idx, v) : { k: 'unit', uid: v }; break;
    case 'sel-king': app.abilPop = null;
      if (app.sel?.k === 'item' && run && isConsumable(run.inventory[app.sel.idx])) { toast(`${R.WRONG_TARGET}.`); app.sel = null; break; }
      if (app.sel?.k === 'item') toast('무휼은 일반 장비를 장착할 수 없습니다 (청라공국 전용 장비 자동 장착).'); app.sel = { k: 'king' }; break;
    case 'king-info': app.abilPop = null; app.sel = { k: 'king' }; if (app.screen !== 'prep' && app.screen !== 'map') app.screen = 'prep'; break;
    case 'sel-turret': {
      if (!run) return;
      app.abilPop = null;
      if (app.sel?.k === 'item' && isConsumable(run.inventory[app.sel.idx])) { toast(`${R.WRONG_TARGET}.`); app.sel = null; break; }
      if (app.sel?.k === 'item') toast(TURRET_NO_GEAR);
      app.sel = { k: 'turret', i: +v };
      break;
    }
    case 'sel-clear': app.sel = null; break;
    case 'sel-squad': app.sqSel = app.sqSel === +v ? null : +v; break; // 이번 전투 분대: 보드에서 그 분대만 강조
    case 'gate-start': if (run?.node?.enc) { run.node.enc.gateOpen = v === '1' || undefined; persist(); } break; // 수문 시작 상태 (편성 화면 지형 상세)
    case 'map-opt': if (run?.node?.enc) { // 스프링클러 첫 살수 · 레이저 먼저 켤 줄 · 차단기 (편성 화면 지형 상세, 전투 전에만)
      const e = run.node.enc, [key, val] = v.split(':');
      if (key === 'spr') { if (val === '1') e.sprLate = true; else delete e.sprLate; }
      else if (key === 'laser') { if (val === '1') e.laserB = true; else delete e.laserB; }
      else if (key === 'breaker') { if (val === '0' || val === '1') e.breaker = +val as 0 | 1; else delete e.breaker; }
      persist();
    } break;
    case 'sel-terrain':
      if (app.sel?.k === 'item' && run && isConsumable(run.inventory[app.sel.idx])) { toast(isPlaceable(run.inventory[app.sel.idx]) ? '지형 칸에는 놓을 수 없습니다.' : `${R.WRONG_TARGET}.`); app.sel = null; break; }
      app.abilPop = null; app.crane = null; app.sel = app.sel?.k === 'terrain' && app.sel.g === +v ? null : { k: 'terrain', g: +v }; break;
    // 전투 전 지형 선택 (편성 화면 지형 상세): 연결교 접기 · 크레인 — 전투 중에는 받지 않는다 (위 battle 허용 목록에 없음)
    case 'bridge-fold': if (run) { const e = R.setBridgeFold(run, v === '1'); if (e) toast(`${e}.`); else persist(); } break;
    case 'crane-pick': app.crane = app.crane === +v ? null : +v; break;
    case 'crane-drop': if (run && app.crane !== null) {
      const c = app.crane, e = R.craneMove(run, c, +v);
      if (e) { toast(`${e}.`); break; }
      app.crane = null; app.sel = { k: 'terrain', g: crateGroup(runGeo(run), c) }; persist();
    } break;
    case 'crane-home': if (run) { const e = R.craneMove(run, +v, null); if (e) toast(`${e}.`); else { app.crane = null; app.sel = { k: 'terrain', g: crateGroup(runGeo(run), +v) }; persist(); } } break;
    case 'dev-cell': if (run && app.sel?.k === 'item') { const [x, y] = v.split(':').map(Number); placeAt(run, app.sel.idx, x, y); } break;
    case 'fold-r': savePref('prepFold', !loadPrefs().prepFold); break;
    case 'bench-tog': {
      const off = !loadPrefs().benchOff, tg = root.querySelector<HTMLElement>('.prep .bench-tog'), bn = root.querySelector<HTMLElement>('.prep .bench');
      savePref('benchOff', off);
      benchKeep = off && tg && bn ? { y: tg.getBoundingClientRect().top, h: bn.offsetHeight } : null;
      if (!off) benchPadB = 0;
      break;
    }
    case 'board-fit': prepZoomAct('fit'); return;
    case 'bzoom': prepZoomAct(v); return;
    case 'vp-cue': prepCenterOn(v, true); return;
    case 'bzoom-b': battleZoomAct(v); return;
    case 'dev-sel': if (run?.node?.enc?.devices?.[+v]) {
      if (app.sel?.k === 'item' && isConsumable(run.inventory[app.sel.idx])) { toast('다른 장치가 있는 칸입니다.'); app.sel = null; break; }
      const d = run.node.enc.devices[+v], nm = d.id === 'K_scope' ? (d.mode === 'strike' ? '지정 포격' : '항공 보급') : CONSUMABLES[d.id].name;
      app.ask = { anchor: [`[data-dev="${v}"]`, '.board'], at: 'beside', okLabel: '회수', html: `<b class="ask-t">${itemIcon(d.id)} ${esc(nm)}</b><p class="ask-note">${d.id === 'K_scope' ? '지정을 거두고 망원경 사용 횟수를 돌려받습니다.' : '장치를 거두어 보관함으로 돌려받습니다.'}</p>`,
        ok: () => { const m = R.recallDevice(run, +v); if (m) { toast(m); persist(); } } };
    } break;
    case 'sel-relic': app.sel = app.sel?.k === 'relic' && app.sel.id === v ? null : { k: 'relic', id: v }; break;
    case 'sel-enemy':
      app.abilPop = null;
      if (app.sel?.k === 'item' && run && isConsumable(run.inventory[app.sel.idx])) { tryUse(run, app.sel.idx, { k: 'foe', i: +v }); break; } // 탭: 강제 징수기 → 적 (다른 소모품은 알림 후 선택 해제)
      app.sel = { k: 'enemy', i: +v }; break;
    case 'pop-off': if (run && placingSel(run)) app.popOff = popKey(run); break; // 놓는 중 팝업만 닫기 (칩이 대신 보인다)
    case 'sel-item': {
      if (!run) return;
      if (app.sel?.k === 'item' && app.sel.idx === +v && app.popOff && app.popOff === popKey(run)) { app.popOff = ''; break; } // 닫아 둔 팝업 다시 열기 (놓기는 그대로)
      app.popOff = '';
      if (app.sel?.k === 'item' && app.sel.idx !== +v && isPlaceable(run.inventory[app.sel.idx])) { app.sel = { k: 'item', idx: +v }; break; } // 배치형 소모품은 칸에만 쓰므로 다른 물품을 누르면 그 물품으로 바꿔 고른다
      if (app.sel?.k === 'item' && app.sel.idx !== +v && isConsumable(run.inventory[app.sel.idx])) { tryUse(run, app.sel.idx, { k: 'inv', i: +v }); break; } // 탭: 소모품 → 장비 (맞지 않는 물품이면 알림 후 선택 해제)
      if (app.sel?.k === 'item' && app.sel.idx !== +v && askCombineInv(run, app.sel.idx, +v)) break; // 탭: 장비 → 조합되는 장비 = 조합 확인 팝업
      app.sel = app.sel?.k === 'item' && app.sel.idx === +v ? null : { k: 'item', idx: +v };
      break;
    }
    case 'sell': if (run) { R.sellItem(run, +v); app.sel = null; persist(); } break;
    case 'unequip': if (run) { const [uid, s] = v.split(':'); moveEq(run, uid, +s, null); } break;
    case 'buyxp': if (run) { if (!R.buyXp(run, v)) toast('크레딧이 부족합니다.'); persist(); } break;
    case 'buy': if (run) { const it = run.node?.shop?.[+v]?.item; const e = R.buyShop(run, +v); if (e) toast(e); else if (it && it !== CATWHEEL && run.inventory[run.inventory.length - 1] === CATWHEEL) toast(`유닉스제 대량 생산 — ${itemInfo(it).name} 대신 캣휠이 들어왔습니다.`); persist(); } break;
    case 'pick-blessing': if (run && run.pending[0]?.t === 'blessing') { R.pickBlessing(run, v); run.pending.shift(); persist(); } break;
    case 'buy-news': if (run) { const e = R.buyNews(run, +v); if (e) toast(e); persist(); } break;
    case 'buy-invest': if (run) { const e = R.buyInvest(run, +v); if (e) toast(e); persist(); } break;
    case 'ace-target': if (run) { run.aceTarget = v; toast('에이스 파일럿으로 지정했습니다.'); persist(); } break;
    case 'relic-pick': app.relicPick = app.relicPick === v ? null : v; break;
    case 'relic-equip': if (run) { const [uid, id] = v.split(':'); const e = R.equipRelic(run, uid, id); if (e) toast(e); persist(); } break;
    case 'consecrate': if (run) { const e = R.consecrate(run, v); toast(e || `축성: 봉헌 +${CFG.consecrate.gain}`); persist(); } break; // 축성 (성유물 칸 · 상세 창 머리 · 순례 봉헌함)
    case 'leave-shop': if (run) { if (run.node?.type === 'shop') SHOP.farewell(run, 'leave'); R.leaveShop(run); app.shopShut = false; app.screen = 'map'; persist(); } break;
    case 'loan': if (run) { toast(R.takeLoan(run) ? '대출 실행: 크레딧 +25' : '대출할 수 없습니다.'); persist(); } break;
    // 대기 선택
    case 'reroll-global': if (run) { R.rerollGlobal(run); persist(); } break;
    case 'pick-global': if (run) { R.pickGlobal(run, v); run.pending.shift(); persist(); } break;
    case 'field-ok': run?.pending.shift(); persist(); break;
    case 'event-choice': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'event') return;
      const err = R.chooseEvent(run, +v);
      if (err) { toast(err); return; }
      if (!run.tutorial) metaEvent(p.id, run.seed);
      ACH.achEvent(run, p.id, +v);
      persist();
      break;
    }
    case 'victory-end': if (run) { run.pending.shift(); metaClear(run); ACH.achClear(run); run.over = true; goPrepOrMap(); } break;
    case 'victory-endless': if (run) { metaClear(run); ACH.achClear(run); R.continueEndless(run); toast('무한 모드: 적은 계속 강해집니다.'); persist(); } break;
    case 'codex': codexFrom = app.screen === 'bar' ? 'bar' : ''; app.screen = 'codex'; app.menu = null; if (v) app.codexTab = v as typeof app.codexTab; break; // 바 세로 띠: 라운지 = 기물 · 발코니 = 업적
    case 'oath': app.screen = 'oath'; app.menu = null; break; // 절망 서약 화면 (ui/oath.ts)
    case 'oath-back': app.screen = 'title'; break;
    case 'oath-set': case 'oath-clear': OATH.oathAct(a, v); break;
    case 'oath-info': { const t = OATH.oathToast(run); if (t) toast(t); if (t && app.screen === 'map') setMapTab(1); return; }
    case 'ret-bar': // 런 결과 → 에란테스 바: 태블릿 화면에서 줌 아웃해 테이블로 빠져나온 뒤 바로 (ui/contract.ts contractReturn). 의뢰를 마친 밤이다
      if (app.view) { app.view.destroy(); app.view = null; }
      BAR.barAfterRun();
      Object.assign(app, { run: null, menu: null, summary: null, sel: null, bigUnit: null, abilPop: null, statPop: false, introFoe: null });
      CTR.contractReturn(); app.screen = 'contract'; break;
    case 'bar': // 에란테스 바: 진행 중인 런은 자동 저장해 두고 나온다 (바에서 '이어서 출격')
      if (run && !run.over && !run.tutorial) persist();
      if (run?.tutorial) tutAway();
      if (app.view) { app.view.destroy(); app.view = null; }
      Object.assign(app, { run: null, menu: null, summary: null, sel: null, bigUnit: null, abilPop: null, statPop: false, screen: 'bar' as Screen });
      BAR.barEnter();
      break;
    case 'bar-x': if (!BAR.barAct(v)) return; break;
    case 'codex-tab': app.codexTab = v as typeof app.codexTab; break;
    case 'cx2': { const r = CX2.codex2Act(v); if (r.tab) app.codexTab = r.tab as typeof app.codexTab; if (r.unit) app.codexSel = r.unit; app.abilPop = null; setCxScroll(r.scroll); if (r.tab) window.scrollTo(0, 0); break; }
    case 'codex-group': app.codexGroup = v as typeof app.codexGroup; break;
    case 'codex-sel': if (app.codexSel === v) CX2.CX2.focus = v; app.codexSel = app.codexSel === v ? null : v; app.abilPop = null; setCxScroll(true); break;
    case 'codex-back': app.screen = app.run ? (app.run.over ? 'over' : 'map') : codexFrom === 'bar' ? 'bar' : 'title'; if (app.run && !app.run.over) goPrepOrMap(); break;
    case 'meter-tab': app.meterTab = v as typeof app.meterTab; document.querySelectorAll('.meter-tabs .btn').forEach((e) => e.classList.toggle('on', (e as HTMLElement).dataset.v === v)); updateMeter(true); return;
    case 'bsel': app.bPick = null; app.abilPop = null; app.battleTerrain = null; app.battleSel = app.battleSel === +v ? null : +v; applySpeed(); updateMeter(true); return;
    case 'bterrain': app.bPick = null; app.abilPop = null; app.battleSel = null; app.battleTerrain = app.battleTerrain === +v ? null : +v; applySpeed(); updateMeter(true); return;
    case 'bdesel': if (app.battleSel !== null || app.battleTerrain !== null) { app.battleSel = null; app.battleTerrain = null; app.bPick = null; app.abilPop = null; app.statPop = false; applySpeed(); updateMeter(true); } return;
    case 'bpick': app.bPick = app.bPick === v ? null : v; updateMeter(true); return;
    case 'release': app.releaseConfirm = app.releaseConfirm === v ? null : v; break; // 전체 상세 머리줄 버튼은 열고 닫기
    case 'release-cancel': app.releaseConfirm = null; break;
    case 'release-confirm': {
      if (!run) return;
      const err = R.releaseUnit(run, v);
      app.releaseConfirm = null;
      if (err) { toast(err); return; }
      app.sel = null;
      if (app.bigUnit === v) { app.bigUnit = null; app.abilPop = null; }
      toast('기물을 방출했습니다.');
      persist();
      break;
    }
    case 'pick-privilege': if (run) { R.pickPrivilege(run, +v); persist(); } break;
    case 'reroll-privilege': if (run) { R.rerollPrivilege(run); persist(); } break;
    case 'pick-despair': if (run) { R.pickDespair(run, +v); persist(); } break;
    case 'reroll-despair': if (run) { R.rerollDespair(run); persist(); } break;
    case 'interest-info': if (run) toast(interestLines(run).short); return; // 상단 바 크레딧: 예상 이자 (터치 화면은 툴팁이 없어 알림으로)
    case 'despair-info': { // 1개면 효과까지, 여러 개면 이름만 (효과는 지도 환경 탭으로 넘긴다)
      const ds = despairsOf(run);
      if (ds.length === 1) toast(`절망 증강 [${ds[0].name}] ${ds[0].desc()}`);
      else if (ds.length) { toast(`절망 증강 ${ds.length}개: ${ds.map((d) => `[${d.name}]`).join(' ')} — 효과는 지도 [환경] 탭`); if (app.screen === 'map') setMapTab(1); }
      return;
    }
    case 'alloc-pick': {
      const m = v as Major;
      if (app.picks.includes(m)) app.picks = app.picks.filter((x) => x !== m);
      else if (app.picks.length < CFG.rankPicks) app.picks.push(m);
      break;
    }
    case 'alloc-ok': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'rankup' || p.allocDone || greatBusy || app.picks.length !== CFG.rankPicks) return;
      const finish = () => {
        setGreatBusy(false);
        if (run.pending[0] !== p || !R.allocRank(run, p, app.picks)) return;
        app.picks = [];
        if (p.options && !p.options.length) run.pending.shift(); // 이번 등급은 능력치만
        persist();
        render();
      };
      if (!p.great) { finish(); return; }
      // 대성공: 창을 새로 띄우지 않고, 고른 능력치 칸에만 황금 광 · 상승값 2배 표시 · '대성공' 제목을 잠깐 보여 준 뒤 그대로 확정
      setGreatBusy(true);
      const md = root.querySelector<HTMLElement>('.modal.rankup');
      const els = app.picks.map((m) => md?.querySelector<HTMLElement>(`[data-a="alloc-pick"][data-v="${m}"]`)).filter((x): x is HTMLElement => !!x);
      for (const el of els) { const b = el.querySelector('.sp-val b'); if (b) b.textContent = String(+(b.textContent || 0) + p.points); }
      md?.querySelector('.ru-head h1')?.insertAdjacentHTML('beforeend', ' · <b class="accent ru-great">대성공! 상승량 ×2</b>');
      md?.querySelector<HTMLButtonElement>('.alloc-ok')?.setAttribute('disabled', '');
      greatFlash(els);
      SND.sfx('reveal3');
      setTimeout(finish, 1400);
      return;
    }
    case 'reroll': { const p = run?.pending[0]; if (run && p?.t === 'rankup' && p.rerolls > 0) { p.rerolls--; p.options = null; app.augPick = null; recReroll(run); } break; }
    case 'pick-augsel': app.augPick = +v; break;
    case 'pick-aug': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'rankup' || !p.options || v === '' || !p.options[+v]) return;
      app.abilPop = null;
      R.chooseAug(run, p.uid, p.options[+v]);
      app.augPick = null;
      run.pending.shift(); persist(); break;
    }
    case 'skip-aug': app.augPick = null; run?.pending.shift(); persist(); break;
    case 'pick-turret': { const p = run?.pending[0]; if (run && p?.t === 'turretPick') { const e = R.pickTurretMod(run, p.options[+v]); if (e) toast(e); persist(); } break; }
    case 'pick-item': { const p = run?.pending[0]; if (run && p?.t === 'itemPick') { const got = R.gainItem(run, p.options[+v]); if (got === CATWHEEL && p.options[+v] !== CATWHEEL) toast(`유닉스제 대량 생산 — ${itemInfo(p.options[+v]).name} 대신 캣휠이 들어왔습니다.`); run.pending.shift(); persist(); } break; }
    case 'rc-tap': app.recruitPick = app.recruitPick === v ? null : v; break;
    case 'rc-away': { const p = run?.pending[0]; if (p?.t === 'recruit') app.recruitAway = p.options.join(','); app.cardOpen = null; break; }
    case 'rc-back': app.recruitAway = null; break;
    case 'pick-recruit': if (run && v && run.pending[0]?.t === 'recruit') { R.recruit(run, v); run.pending.shift(); app.recruitPick = null; app.recruitAway = null; app.cardOpen = null; persist(); } break;
    case 'pick-branch': if (run && run.pending[0]?.t === 'branch') { R.pickBranch(run, v as NodeType); goPrepOrMap(); persist(); } break;
    case 'fleet': if (run) { const err = R.buyFleet(run); toast(err || `함대 확장 — 출전 인원 ${R.deployCap(run)}명`); persist(); } break;
    case 'muster-open': if (run) { const err = R.openMuster(run); if (err) toast(err); else app.musterSel = []; persist(); } break;
    case 'muster-tog': if (v) { const i = app.musterSel.indexOf(v); if (i >= 0) app.musterSel.splice(i, 1); else if (app.musterSel.length < CFG.musterPicks) app.musterSel.push(v); } break;
    case 'muster-ok': if (run) { const err = R.confirmMuster(run, app.musterSel); if (err) toast(err); else { app.musterSel = []; app.recruitPick = null; } persist(); } break;
    case 'muster-cancel': if (run) { R.cancelMuster(run); app.musterSel = []; persist(); } break;
    case 'pick-fork': if (run && run.pending[0]?.t === 'fork') { R.pickFork(run, v as 'rest' | 'challenge' | 'synth'); if (run.node?.synth) app.screen = 'shop'; else goPrepOrMap(); persist(); } break;
    case 'reroll-recruit': if (run) { R.rerollRecruit(run); app.recruitPick = null; persist(); } break;
    case 'pick-supply': case 'supply-all': { const p = run?.pending[0]; if (run && p?.t === 'supply') { if (a === 'supply-all') R.flipAllSupply(run, p); else R.flipSupply(run, p, +v); persist(); } break; }
    case 'supply-done': { const p = run?.pending[0]; if (run && p?.t === 'supply' && p.options.every((c) => c.open)) { run.pending.shift(); persist(); } break; }
    case 'notice-ok': { const p = run?.pending.shift(); if (run && p?.t === 'notice' && p.end) { run.over = true; goPrepOrMap(); } persist(); break; } // 캠페인 마지막 알림을 닫으면 런 끝
    default: return;
  }
  render();
}
initDrag();
addEventListener('resize', tlOver, { passive: true });
root.addEventListener('mouseover', (e) => {
  if (!CAN_HOVER || kwPinned || synHl?.how === 'stick') return;
  const tk = (e.target as HTMLElement).closest<HTMLElement>('.syn-list .syn-tk, .top-syns .syn-tk');
  const id = tk?.querySelector<HTMLElement>('[data-syn]')?.dataset.syn || null;
  if (id !== (synHl?.id ?? null)) synFocus(id);
});
root.addEventListener('mouseleave', () => { if (synHl?.how === 'hover') synFocus(null); });
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-synfocus]');
  if (!b) return;
  hideKw();
  synFocus(b.dataset.synfocus!, 'stick');
}, true);
document.addEventListener('pointerdown', (e) => { if (synHl?.how === 'stick' && !(e.target as HTMLElement).closest('[data-synfocus]')) synFocus(null); }, true);
root.addEventListener('click', (e) => {
  const n = (e.target as HTMLElement).closest<HTMLElement>('.tl .tl-node');
  if (!n) return;
  const k = `.tl-node[data-step="${n.dataset.step}"][data-node="${n.dataset.node}"]`;
  setTimeout(() => { const el = root.querySelector<HTMLElement>(k); if (el) tlPop(el); }, 0); // 지금 칸 노드는 고르기(다시 그림) 뒤에 연다
});
document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('.tl-pop')) document.querySelector('.tl-pop')?.remove(); }, true);
addEventListener('scroll', () => document.querySelector('.tl-pop')?.remove(), { passive: true, capture: true });
document.addEventListener('mouseover', (e) => {
  if (!CAN_HOVER || kwPinned) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-kw]');
  if (el) showKw(el); else if (document.querySelector('.kw-tip')) hideKw();
});
// 탭 · 클릭: 고정 표시 (능력 카드 클릭으로 번지지 않게 캡처 단계에서 처리)
document.addEventListener('click', (e) => {
  const se = (e.target as HTMLElement).closest<HTMLElement>('[data-syn]');
  if (se) { e.preventDefault(); e.stopPropagation(); if (kwPinned === se) hideKw(); else showSyn(se); return; }
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-kw]');
  if (!el) { if (kwPinned && !(e.target as HTMLElement).closest('.kw-tip')) hideKw(); return; }
  e.preventDefault(); e.stopPropagation();
  if (kwPinned === el) { hideKw(); return; }
  pinKw(el);
}, true);
addEventListener('scroll', (e) => {
  const tip = document.querySelector<HTMLElement>('.kw-tip');
  if (!tip) return;
  if (e.target instanceof Node && tip.contains(e.target)) return; // 팝업 안쪽 스크롤
  // 시너지 팝업: 목록을 스크롤해도 닫지 않고 마름모를 따라간다 (화면 밖으로 나가면 닫음)
  if (tip.classList.contains('syn-pop') && kwPinned?.isConnected) {
    const r = kwPinned.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) { placeSyn(tip, kwPinned); return; }
  }
  hideKw();
}, { passive: true, capture: true });

document.addEventListener('keydown', (e) => {
  if (document.querySelector('.adv')) return; // 미연시 화면은 자체 처리
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if ((e.target as HTMLElement).closest('input, textarea, select')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const sv = document.querySelector('.stand-view');
  if (k === 'Escape') {
    if (sv) sv.remove();
    else if (app.ask) act('ask', 'no');
    else if (app.preview) act('big-close', '');
    else if (app.cardOpen) { app.cardOpen = null; render(); }
    else if (app.bigUnit && app.abilPop) { app.abilPop = null; render(); }
    else if (app.bigUnit && app.releaseConfirm) act('release-cancel', '');
    else if (app.bigUnit) act('big-close', '');
    else if (app.menu) act('menu-close', '');
    else if (app.releaseConfirm) act('release-cancel', '');
    else if (app.screen === 'prep' && app.run && craneOn(app.run) !== null) { app.crane = null; render(); } // 크레인만 내려놓고 컨테이너 상세는 그대로
    else if (app.screen === 'shop' && SHOP.shopEscape()) render(); // 상인 상점: 교환 창 · 물품 상세
    else if (app.sel && app.screen !== 'battle') { app.sel = null; render(); }
    else if (app.screen === 'battle' && app.battleSel !== null) { app.battleSel = null; app.bPick = null; applySpeed(); updateMeter(true); }
    return;
  }
  if (sv) return;
  if (app.screen === 'newrun' && (k === 'ArrowLeft' || k === 'ArrowRight')) { carStep(k === 'ArrowRight' ? 1 : -1); e.preventDefault(); return; }
  // 나머지는 단축키 표(HOTKEYS)대로
  const ks = keyScope();
  const h = HOTKEYS.find((x) => (x.scope === 'any' || x.scope === ks?.scope) && x.keys.includes(k));
  if (!h) return;
  if (h.always) e.preventDefault();
  const n = /^[1-9]$/.test(k) ? +k : 0;
  if (h.run) { h.run(n); return; }
  if (h.cap === '#') {
    const el = Array.from((ks?.box || document).querySelectorAll<HTMLElement>(h.sel[0]))[n - 1];
    if (!el || (el as HTMLButtonElement).disabled) return;
    e.preventDefault();
    // 증강 · 전공 · 영입: 숫자키는 고르기 + 확정 한 번에 (마우스는 그대로 고른 뒤 확정)
    if (el.dataset.a === 'pick-augsel') act('pick-aug', el.dataset.v || '');
    else if (el.dataset.a === 'rc-tap') act('pick-recruit', el.dataset.v || '');
    else el.click();
    return;
  }
  const el = firstOn(h.sel);
  if (el) { e.preventDefault(); el.click(); }
});
// 스탠딩 전신 보기 (카드 버튼 안의 배너는 카드 선택이 우선)
document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const open = document.querySelector('.stand-view');
  if (open) { open.remove(); return; }
  const h = t.closest('[data-stand]') as HTMLElement | null;
  if (!h || h.closest('[data-a]')) return;
  const d = UNIT_BY_ID[h.dataset.stand!];
  const v = document.createElement('div');
  v.className = 'stand-view';
  v.innerHTML = `${standImg(d.id, 'stand full')}<div class="stand-cap"><b>${esc(d.name)}</b> <span class="muted">${esc(d.title)}</span></div>`;
  document.body.appendChild(v);
});
addEventListener('scroll', (e) => {
  if (!app.bigUnit || !app.abilPop || performance.now() - restoredAt < 200) return; // 다시 그린 직후 스크롤 복원은 무시
  const t = e.target as HTMLElement;
  if (t instanceof HTMLElement && t.closest('.um') && !t.closest('.um-pop')) closeUmPop();
}, { passive: true, capture: true });
root.addEventListener('click', (ev) => {
  if (suppressClick) return;
  if (boardPlaceTap(ev)) return;
  if (app.bigUnit && app.abilPop && !(ev.target as HTMLElement).closest('.um-pop, [data-a="abil-pop"]')) closeUmPop();
  const el = (ev.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return;
  if (el.classList.contains('modal-bg') && (ev.target as HTMLElement).closest('.modal')) return; // 창 안쪽을 눌러도 닫지 않음
  if (el.dataset.a === 'item-info') { // 소모품을 고른 채로 장착 장비를 누르면 그 장비(또는 기물)에 사용, 아니면 장비 설명 말풍선
    if (app.sel?.k === 'item' && app.run && isConsumable(app.run.inventory[app.sel.idx])) act('use-eq', el.dataset.v || ''); else itemTip(el, el.dataset.v || '');
    return;
  }
  if (el.dataset.a === 'ip-more') { const p = el.closest('.inv-pop'); el.setAttribute('aria-expanded', String(!!p?.classList.toggle('more'))); layoutPanels(); return; } // 좁은 화면 배치 중: 소모품 성질 펼치기
  if (el.dataset.a === 'ask-info') { el.closest('.ask-pop')?.classList.toggle('info'); layoutPanels(); return; } // 조합 결과 아이콘: 능력치 · 효과 펼치기
  if (el.dataset.a === 'foe-item') { foeItemTip(el, el.dataset.v || ''); return; }
  if (el.dataset.a === 'syn-peek') {
    const on = !el.classList.contains('peek');
    root.querySelectorAll('.syn-b.peek').forEach((x) => x.classList.remove('peek'));
    if (on) { el.classList.add('peek'); setTimeout(() => el.classList.remove('peek'), 1800); }
    return;
  }
  SND.uiAct(el.dataset.a!); // 효과음: 동작이 끝난 뒤 결과에 맞춰 (클릭 · 구매 · 판매 · 리롤 · 확정 · 오류)
  act(el.dataset.a!, el.dataset.v || '');
});
// 출격 계약 (ui/contract.ts) 연결: 전장 브리핑 · 적 상세 창 · 서명 뒤 계약 기물 명부 · 나가기
Object.assign(CTR.hooks, {
  receipt: (n: number) => ACH.achReceipt(n), // 전표가 화면 위로 넘어가면 업적
  render, toast,
  brief: (fid: string) => fieldBrief(fid),
  foe: () => (app.introFoe ? foeModal(app.introFoe) : ''),
  roster: (s: CTR.Signed) => { // 그늘 연출 끝: 서명한 의뢰의 전장 · 약관으로 후보를 뽑고 명부를 연다 (전장 우세 시너지 기물 보장)
    app.introField = s.field; app.diff = s.diff; app.introFoe = null;
    app.starters = []; app.screen = 'newrun'; app.menu = null; setCarX(null); app.cardOpen = null;
    app.pool = starterPool(new Rng((Date.now() ^ (Math.random() * 1e9)) | 0), app.introField); app.poolRerolls = CFG.starterRerolls;
    BRF.briefBegin(app.pool, CTR.contractVet(), CTR.takeSealGrid(), CTR.takeSealNote()); // 태블릿 속 브리핑 수신: 상태문의 인물 = 이번 후보 (곧 떨어질 카드)
    render();
  },
  leave: (to: string) => act(to === 'bar' ? 'bar' : 'to-title', ''),
});
SND.init({ prefs: loadPrefs, save: savePref, ranks: () => Object.fromEntries(app.run?.units.map((u) => [u.uid, u.rank]) ?? []) }); // 효과음 설정 (errantes.prefs.v1) · 등급 상승 판정
LAB.labInit({ act: (v) => act('lab', v), itemIcon: (id) => itemIcon(id), relicTok: (id) => relicTok(id) }); // 훈련장 패널: 숫자 칸 · 고르기 입력 → 동작
SHOP.shopInit({ // 상인 상점 덮개 (ui/shop.ts): main 의 그림 조각 · 확인 팝업 · 알림
  run: () => app.run, itemIcon: (id, attrs) => itemIcon(id, attrs), itemBrief, statIc, devicePop, kvChip, CR,
  ask: (anchor, html, okLabel, ok) => { app.ask = { anchor, at: 'below', html, okLabel, ok }; },
  toast: (m) => toast(m), persist: () => persist(), sfx: (n) => SND.sfx(n),
});
ACH.achBind(() => app.run); // 업적: 장면 건너뛰기 · 메타 기록 변화 지켜보기 · 도감 · 바 진열장 입력

// 순례: 신앙 변경
root.addEventListener('change', (ev) => {
  const el = ev.target as HTMLSelectElement;
  const pk = (el as HTMLElement).dataset?.pref;
  if (pk === 'fxMs' || pk === 'skillMs') {
    const v = Math.round(Math.max(pk === 'fxMs' ? 300 : 500, Math.min(pk === 'fxMs' ? 4000 : 5000, +el.value || FX_DEFAULT[pk])));
    el.value = String(v);
    savePref(pk, v); applyFxPrefs();
    return;
  }
});

applyFxPrefs();
applyTheme();

// 아티팩트 뷰어 업데이트 시 진행 상황 유지
type Hot = { snapshot?: (f: () => unknown) => void; ready?: (f: (d: unknown) => void) => void; data?: unknown };
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ run: app.run }));
function boot(data: unknown) {
  const r = (data as { run?: RunState } | null)?.run;
  if (r) { app.run = r; goPrepOrMap(); }
  else if (barHome()) { app.screen = 'bar'; BAR.barEnter(); } // 접속하면 바로 에란테스 바 (처음 온 사람은 튜토리얼이 있는 타이틀)
  render();
}
/** 바가 첫 화면인가: 튜토리얼을 봤거나 런을 한 번이라도 했으면 */
function barHome() { const m = loadMeta(); return !!(m.tut?.done || m.tut?.seen?.length || m.runs); }
loadArtPack();
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? null);
void activeTiers;
