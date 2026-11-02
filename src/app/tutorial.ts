// 튜토리얼 「당직 근무 중 승계」 진행 (main.ts 에서 분리)
import { isEmblem } from '../data/items';
import { UNIT_BY_ID } from '../data/units';
import * as ACH from '../ui/achieve';
import { deployed } from '../engine/build';
import * as R from '../engine/run';
import { type RunState } from '../types';
import { deleteSave, loadRun } from '../ui/save';
import { loadMeta, metaTutEnd, metaTutSeen, tutMeta, tutOver } from '../ui/meta';
import { iconURL } from '../ui/portraits';
import { advKey, closeAdv, playAdv } from '../ui/adv';
import { closeCoach, coachKey, startCoach, type CoachStep } from '../ui/coach';
import { TUTORIAL_FLOW, TUTORIAL_SCENES, TUTORIAL_TIPS } from '../data/scenes/tutorial';
import { BAR_GLOSS_KEY, GLOSSARY, GLOSSARY_COUNT } from '../data/glossary';
import * as TUT from '../engine/tutorial';
import { Screen, TUT_SLOT, app, esc, persist, toast } from './state';
import { sprite } from './common';
import { ic } from './map';
import { applySpeed } from './battle';
import { advSpeaker, speakerOf } from './modals';
import { setMapTab } from './carousel';
import { goPrepOrMap } from './battlecam';
import { render } from '../main';

/** 저장된 튜토리얼 런 (타이틀 버튼: 이어서) */
export function listTutSave(): { step: number } | null {
  const r = loadRun(TUT_SLOT);
  return r?.tutorial ? { step: r.step } : null;
}
export const tutRun = () => (app.run?.tutorial && !app.run.over ? app.run : null);
export let tutLock = false; // tutSync 재진입 방지
export let tutPaused = false; // 안내 때문에 멈춘 전투
export let tutEpi = false; // 종장 뒤 타이틀에서 마지막 안내를 띄울 차례
export function setTutEpi(v: boolean) { tutEpi = v; }
/** 전투 화면은 다시 그리면 전투 보드가 초기화되므로 그리지 않는다 (전투 중 상태는 뷰가 직접 갱신) */
export const tutRender = () => { if (app.screen !== 'battle') render(); };

// 장면이 뜰 수 있는 최소 칸 (지도 화면 · 대기 창 없음)
export const SCENE_STEP: Record<string, number> = { prologue: 0, ch1_intro: 0, ch1_after: 1, ch1b_intro: 1, ch2_intro: 2, ch3_intro: 4, ch3_recruit: 4, ch4_intro: 6, ch4_boss: 8, epilogue: 9 };
// 안내가 속한 칸: 이 칸을 지나쳤는데 (전투 화면 밖) 아직 안 띄웠으면 건너뛴다 (전투를 '결과로'로 넘긴 경우 등)
export const TIP_STEP: Record<string, number> = { ch1_place: 0, ch1_battle: 0, ch1b_detail: 1, ch1b_battle: 1, ch2_map: 2, ch2_supply: 3, ch2_shop: 3, ch2_xp: 4, ch3_recruit: 5, ch3_equip: 5, ch3_emblem: 5, ch3_battle: 5, ch3_result: 5, ch4_map: 6, ch4_brief: 6, ch4_deploy: 6, ch4_event: 7, ch4_adversity: 7, ch4_boss: 8 };
/** 불러온 직후처럼 지도에 있으면 편성 화면으로 옮겨 띄우는 안내 */
export const TIP_PREP = ['ch3_equip', 'ch3_emblem', 'ch4_deploy'];

export const unitOf = (run: RunState, id: string) => run.units.find((u) => u.defId === id);
export const q1 = (sel: string) => document.querySelector(sel);
export const btT = () => app.view?.b.t ?? 0;
export const inBattle = (t: number) => app.screen === 'battle' && !!app.view && !app.view.b.over && btT() >= t;
/** 편성 보드 위 아군 토큰 */
export const prepTok = (run: RunState, id: string) => () => { const u = unitOf(run, id); return u ? q1(`.prep .board .u.side0[data-v="${u.uid}"]`) : null; };
/** 편성 보드 위 적 토큰 (적 id) */
export const foeTok = (run: RunState, ...ids: string[]) => () => (run.node?.enc?.enemies || []).flatMap((s, i) => (ids.includes(s.defId) ? Array.from(document.querySelectorAll(`.prep .board .u.side1[data-v="${i}"]`)) : []));
/** 전투 보드 위 기물 (side 0 아군 기물 id · side 1 적 id, 비우면 그 편 전부) */
export const bTok = (side: 0 | 1, ...ids: string[]) => () => (app.view?.b.units || []).filter((c) => c.side === side && !c.isSummon && c.alive && (!ids.length || ids.includes(c.defId)))
  .map((c) => q1(`#bboard .u[data-v="${c.id}"]`)).filter((x): x is Element => !!x);
export const bPart = (part: string) => () => bTok(0)().map((e) => e.querySelector(part)).filter((x): x is Element => !!x);
/** 시너지 토큰 (넓은 화면은 왼쪽 패널, 좁은 화면은 상단 띠) */
export const synTok = (id: string, sub = '') => [`.side.left .syn-tk:has([data-syn="${id}"])${sub}`, `.top-syns .syn-tk:has([data-syn="${id}"])${sub}`];
/** 결과 창 보상 줄 */
export const rsLine = (re: RegExp) => () => Array.from(document.querySelectorAll('.rs-lines li')).filter((li) => re.test(li.textContent || ''));
/** 편성 보드 + 대기석 (끌어다 놓기 안내) */
export const boardAnd = (...more: string[]) => () => ['.prep .board', ...more].map(q1).filter((x): x is Element => !!x);
export function selUnit(run: RunState, id: string) {
  const u = unitOf(run, id);
  if (!u || (app.sel?.k === 'unit' && app.sel.uid === u.uid)) return;
  app.sel = { k: 'unit', uid: u.uid }; app.abilPop = null; app.statPop = false;
  tutRender();
}
export function selFoe(run: RunState, id: string) {
  const i = (run.node?.enc?.enemies || []).findIndex((s) => s.defId === id);
  if (i < 0 || (app.sel?.k === 'enemy' && app.sel.i === i)) return;
  app.sel = { k: 'enemy', i }; app.abilPop = null;
  tutRender();
}
export const hasGear = (run: RunState, re: RegExp) => run.units.some((u) => u.items.some((x) => !!x && re.test(x)));

/** 안내가 처음 뜨는 조건 (화면 · 노드 · 대기 창) */
export const TIP_GATE: Record<string, (r: RunState) => boolean> = {
  prologue: () => advKey() === 'tu:prologue',
  ch1_place: (r) => app.screen === 'prep' && r.node?.type === 'battle' && r.step === 0,
  ch1_battle: () => inBattle(2.5),
  ch1b_detail: (r) => app.screen === 'prep' && r.node?.type === 'battle' && r.step === 1,
  ch1b_battle: () => inBattle(3.5),
  ch2_map: (r) => app.screen === 'map' && !r.node && r.step === 2,
  ch2_supply: (r) => r.pending[0]?.t === 'supply',
  ch2_shop: () => app.screen === 'shop',
  ch2_xp: (r) => app.screen === 'map' && !r.node && r.step === 4,
  ch3_recruit: (r) => r.pending[0]?.t === 'recruit',
  ch3_equip: (r) => app.screen === 'prep' && !r.node,
  ch3_emblem: (r) => app.screen === 'prep' && !r.node,
  ch3_battle: (r) => app.screen === 'prep' && r.node?.type === 'battle' && r.step === 5,
  ch3_result: () => app.screen === 'battle' && !!app.summary?.won && !!q1('.modal.result'),
  ch4_map: (r) => app.screen === 'map' && !r.node && r.step === 6,
  ch4_brief: (r) => app.screen === 'map' && !r.node && r.step === 6,
  ch4_deploy: (r) => app.screen === 'prep' && !r.node && !!unitOf(r, 'rachel'),
  ch4_event: (r) => r.pending[0]?.t === 'event' && !!advKey()?.startsWith('ev:'),
  ch4_adversity: (r) => app.screen === 'prep' && r.node?.type === 'adversity',
  ch4_boss: (r) => app.screen === 'prep' && r.node?.type === 'boss',
};

/** 안내 단계별 대상 UI · 진행 조건 (TUTORIAL_TIPS[key] 와 같은 순서) */
export function tipSteps(key: string, run: RunState | null): Partial<CoachStep>[] {
  const r = run!;
  const fight: Partial<CoachStep> = { target: '.prep [data-a="fight"]', need: true, until: () => app.screen === 'battle' };
  switch (key) {
    case 'prologue': return [{ target: '.adv .adv-box', pend: true }, { target: '.adv [data-x="log"]', pend: true }, { target: '.adv [data-x="auto"]', pend: true }, { target: '.adv [data-x="skip"]', pend: true }];
    case 'ch1_place': return [
      { target: '.prep .board .cell.mine' },
      { target: boardAnd('.prep .bench'), until: () => unitOf(r, 'temur')?.pos?.r === 2 },
      { target: boardAnd('.prep .bench'), until: () => unitOf(r, 'vivian')?.pos?.r === 0 },
      { target: '.prep .dep-pill' },
      { target: ['.prep [data-a="autofill"]', '.prep .board-head'] },
      { ...fight, enter: () => { if (!deployed(r).length) { R.autoFill(r); persist(); render(); } } },
    ];
    case 'ch1_battle': return [{ target: '#btime' }, { target: bPart('.bars') }, { target: bTok(0) }, { target: bPart('.cd') }, { target: '.battle .speed' }, { target: ['.battle #meter', '.battle .side.left'] }].map((x) => ({ ...x, pend: true }));
    case 'ch1b_detail': return [
      { target: foeTok(r, 'drone'), until: () => app.sel?.k === 'enemy' && r.node?.enc?.enemies[app.sel.i]?.defId === 'drone' },
      { target: '.prep .side.right .detail > .small.muted', enter: () => selFoe(r, 'drone') },
      { target: '.prep .side.right .abils .ab-weapon', enter: () => selUnit(r, 'nadir') },
      { target: '.prep .side.right .dh-types' },
      { target: ['.prep .side.right .d-mag', '.prep [data-a="toggle-detail"]'] },
      fight,
    ];
    case 'ch1b_battle': return [{ target: bTok(1, 'drone') }, { target: bTok(1) }, { target: bTok(0, 'temur') }, { target: bTok(0, 'vivian') }].map((x) => ({ ...x, pend: true }));
    case 'ch2_map': return [{ target: '.map .tl-track' }, { target: '.top .stat-row' }, { target: '.map .tl-go', need: true, until: () => r.step > 2 || r.pending[0]?.t === 'supply' }];
    case 'ch2_supply': {
      const sp = () => r.pending[0]?.t === 'supply' ? r.pending[0] : null;
      return [{ target: '.modal .sup-cards', pend: true }, { target: '.modal [data-a="supply-all"]', pend: true, until: () => !sp()?.options.some((c) => !c.open) },
        { target: '.modal [data-a="supply-done"]', pend: true, until: () => !sp() }];
    }
    case 'ch2_shop': return [ // 상인 상점 (ui/shop.ts): 재료 칸 · 희귀 칸 → 재료 가격표 (누르면 아래에 ✕ / ✓ 확인) → 이자 지키며 쓸 수 있음 · 보관함 칩 → 떠나기
      { target: '.sg .sg-card.tC' }, { target: '.sg .sg-card.tA' },
      { target: '.sg .sg-card.tC .sg-tag', need: true, until: () => !!r.node?.shop?.some((x) => x.sold) }, // 확인 팝업이 뜨면 안내는 잠시 숨는다 (tutCoach hold)
      { target: ['.shop-ov .kv-keep', '.top .pill.cr'] }, { target: '.shop-ov .kv-inv' },
      { target: '.shop-ov [data-a="leave-shop"]', need: true, until: () => app.screen !== 'shop' },
    ];
    case 'ch2_xp': {
      let c0 = r.credits;
      return [
        { target: '.map .party .rt', until: () => !!app.bigUnit },
        { target: '.um-a > .um-rank [data-a="buyxp"]', need: true, until: () => r.credits < c0, enter: () => { c0 = r.credits; if (!app.bigUnit) { app.bigUnit = r.units[0].uid; app.sel = { k: 'unit', uid: r.units[0].uid }; render(); } } },
        { target: '.um .um-rank' },
        { target: '.um .d-focus' }, // 집중 육성 단추 (전체 상세 머리)
        { target: '.map .ship-btn[data-a="fleet"]', need: true, until: () => (r.fleet || 0) >= 1, enter: () => {
          // 린디웨 예산(20)으로 반드시 살 수 있게: 다른 데 썼으면 모자란 만큼 채운다
          const cost = R.fleetCost(r) ?? 0;
          if (!r.fleet && r.credits < cost) r.credits = cost;
          app.bigUnit = null; app.sel = null; app.abilPop = null; persist(); render();
        } },
      ];
    }
    case 'ch3_recruit': return [
      { target: '.modal.recruit', pend: true, need: true, until: () => r.pending[0]?.t !== 'recruit' }, // 필리스는 메이저라 합류 증강 창 없음
      { target: synTok('VOYAGE') },
    ];
    case 'ch3_equip': return [
      { target: boardAnd('.prep .inv-rail'), until: () => hasGear(r, /^[CGA]_/) },
      { target: '.prep .side.right .d-eqbox', enter: () => { const u = r.units.find((x) => x.items.some((y) => !!y && /^[CGA]_/.test(y))) || r.units[0]; if (u) selUnit(r, u.defId); } },
      { target: boardAnd('.prep .inv-rail'), until: () => hasGear(r, /^[GA]_/) },
      { target: '.prep .inv-rail', until: () => r.inventory.some((x) => /^[GA]_/.test(x)) },
      { target: ['.prep .board .tk-it .item.tA', '.prep .board .tk-it .item.tG', '.prep .inv-rail .item.tA', '.prep .inv-rail .item.tG'] },
      { target: '.prep .side.right .reco-btn' },
    ];
    case 'ch3_emblem': return [
      { target: '.prep .inv-rail .item.tM' },
      { target: boardAnd('.prep .inv-rail'), until: () => r.units.some((u) => !!u.mod && isEmblem(u.mod)) },
      { target: synTok('KAL') },
      { target: synTok('KAL', ' .syn-b') },
    ];
    case 'ch3_battle': return [{ target: synTok('VOYAGE') }, { target: prepTok(r, 'phyllis') }, fight];
    case 'ch3_result': return [{ target: rsLine(/이자/) }, { target: rsLine(/승리 보상|연승/) }, { target: ['.rs-xp', '.rs-reward'] }].map((x) => ({ ...x, pend: true }));
    case 'ch4_map': return [{ target: '.map .tl-track' }, { target: '.map .tl-step.cur .tl-node' }, { target: '.map .tl-node.n-council' }, { target: '.map .tl-node.n-shop' }, { target: '.map .tl-info' }, { target: '.top .stat-row .pill:first-child' }, {}];
    case 'ch4_brief': return [
      { target: '.map .st-tab[data-v="1"]', until: () => app.mapTab === 1 },
      { target: '.map .field-btn .fc-rules', enter: () => { if (app.mapTab !== 1) setMapTab(1); } },
      { target: '.map .field-btn .fc-rules li:last-child' },
      { target: '.map .field-btn' },
    ];
    case 'ch4_deploy': return [
      { target: '.modal.rankup', pend: true, until: () => !r.pending.some((p) => p.t === 'rankup' && p.kind === 'school') },
      { target: '.prep .dep-pill' },
      { target: ['.prep .side.right .ps-reason', '.prep .side.right .tt-sec'], enter: () => selUnit(r, 'rachel') },
      { target: prepTok(r, 'rachel') },
      { target: synTok('VOYAGE') },
    ];
    case 'ch4_event': return [
      { target: '.adv .adv-box', pend: true },
      { target: '.adv .adv-end:not([hidden]) .adv-choice:not([disabled]) span', pend: true, wait: true },
      { target: '.adv .adv-end:not([hidden]) .adv-choice[disabled]', pend: true, wait: true },
    ];
    case 'ch4_adversity': return [
      { target: '.prep .board-head .bh-title' }, { target: foeTok(r, 'warlord') }, { target: foeTok(r, 'wraith') }, { target: foeTok(r, 'turret') },
      { target: foeTok(r, 'warlord', 'wraith', 'turret'), until: () => app.sel?.k === 'enemy' },
    ];
    case 'ch4_boss': return [
      { target: foeTok(r, 'varga') }, { target: foeTok(r, 'raider', 'gunner') },
      { target: '.prep .side.right .ab-ace-wrap', enter: () => selUnit(r, 'rachel') },
      { target: '#btime', gate: () => inBattle(3), pend: true },
      { gate: () => inBattle(3), pend: true },
    ];
    case 'epilogue': return [{}, { target: '[data-a="newrun"]' }, { target: '[data-a="newrun"]' }, { target: '[data-a="newrun"]' }, { target: '[data-a="codex"]' }, { target: '[data-a="tutorial"]' }];
  }
  return [];
}

/** 안내 묶음 띄우기 (run 이 없으면 타이틀의 종장 안내) */
export function tutCoach(key: string, run: RunState | null) {
  const cfg = tipSteps(key, run);
  const steps: CoachStep[] = TUTORIAL_TIPS[key].map(([who, , text], i) => {
    const d = UNIT_BY_ID[who];
    return { name: d?.name || who, icon: d ? iconURL(d) : '', color: speakerOf(who).color, text, ...cfg[i] };
  });
  startCoach({
    key: `tu:${key}`, steps,
    skipLabel: run ? '튜토리얼 건너뛰기' : null,
    // 선택 창 · 미연시 · 메뉴가 떠 있으면 숨겨 둔다 (그 창을 가리키는 단계는 pend)
    hold: (st) => !st.pend && (!!app.menu || !!q1('.modal-bg, .adv, .stand-view, .um-pop, .ask-pop')),
    onShow: () => {
      if (app.screen === 'battle' && app.view && !app.view.b.over) { app.paused = true; applySpeed(); tutPaused = true; }
    },
    onHide: () => tutResume(),
    onDone: () => { tutResume(); tutTipsDone(key); },
    onSkip: () => { tutResume(); tutFinish('skipped'); },
  });
}
/** 안내 때문에 멈춘 전투를 다시 */
export function tutResume() {
  if (!tutPaused) return;
  tutPaused = false;
  if (app.screen === 'battle' && app.paused) { app.paused = false; applySpeed(); }
}

export function tutSync() {
  if (tutLock) return;
  const run = tutRun();
  if (!run) {
    if (coachKey()?.startsWith('tu:') && coachKey() !== 'tu:epilogue') closeCoach(); // 다른 런을 불러왔다
    if (advKey()?.startsWith('tu:')) closeAdv();
    if (tutEpi && app.screen === 'title' && !app.run && !coachKey() && !app.tutAsk && !app.menu) { tutEpi = false; tutCoach('epilogue', null); }
    return;
  }
  const item = TUTORIAL_FLOW[run.tutorial!.i];
  if (!item) return;
  const [kind, key] = item;
  tutLock = true;
  try {
    if (kind === 'scene') {
      if (advKey() || coachKey() || app.screen !== 'map' || run.node || run.pending.length || app.summary || app.menu || app.bigUnit || q1('.modal-bg')) return;
      if (run.step < (SCENE_STEP[key] ?? 0)) return;
      const sc = TUTORIAL_SCENES[key];
      playAdv(`tu:${key}`, sc.beats, { title: sc.title, speaker: advSpeaker, fmt: (x) => ic(esc(x)), onDone: () => tutSceneDone(key) });
      if (key === 'prologue') tutCoach('prologue', run); // 서장 첫 줄 위에 겹쳐서
      return;
    }
    if (coachKey()) return;
    // 이미 지나친 칸의 안내는 건너뛴다
    if (TIP_STEP[key] !== undefined && run.step > TIP_STEP[key] && app.screen !== 'battle') { tutNext(run, key); persist(); render(); return; }
    if (TIP_PREP.includes(key) && app.screen === 'map' && !run.node && !run.pending.length && (key !== 'ch4_deploy' || unitOf(run, 'rachel'))) { app.screen = 'prep'; render(); return; }
    if (TIP_GATE[key]?.(run)) tutCoach(key, run);
  } finally { tutLock = false; }
}
/** 진행 한 칸 (본 것으로 기록 → 교범 해금) */
export function tutNext(run: RunState, key: string) {
  metaTutSeen(key);
  if (TUTORIAL_FLOW[run.tutorial!.i]?.[1] === key) run.tutorial!.i++;
}
export function tutSceneDone(key: string) {
  const run = tutRun();
  if (!run || TUTORIAL_FLOW[run.tutorial!.i]?.[1] !== key) return;
  tutNext(run, key);
  if (key === 'prologue') { // 서장 안내는 장면과 함께 끝난다
    if (coachKey() === 'tu:prologue') closeCoach();
    tutNext(run, 'prologue');
  }
  const at = (step: number) => run.step === step && !run.node;
  if (key === 'ch1_intro' && at(0)) TUT.tutEnterNode(run, 'battle');
  if (key === 'ch1b_intro' && at(1)) { TUT.tutJoin(run, 'nadir', true); TUT.tutEnterNode(run, 'battle'); }
  if (key === 'ch2_intro') TUT.tutGrant(run, 'budget');
  if (key === 'ch3_recruit' && at(4)) TUT.tutEnterNode(run, 'recruit');
  if (key === 'ch4_boss' && at(8)) TUT.tutEnterNode(run, 'boss');
  if (key === 'epilogue') { tutFinish('done'); return; }
  app.sel = null; app.abilPop = null;
  goPrepOrMap();
  persist();
  tutRender();
}
export function tutTipsDone(key: string) {
  metaTutSeen(key);
  const run = tutRun();
  if (!run || key === 'prologue' || TUTORIAL_FLOW[run.tutorial!.i]?.[1] !== key) { tutRender(); return; }
  tutNext(run, key);
  if (key === 'ch3_recruit') { TUT.tutGrant(run, 'storeroom'); app.screen = 'prep'; app.sel = null; }
  if (key === 'ch3_emblem' && run.step === 5 && !run.node) { TUT.tutEnterNode(run, 'battle'); app.screen = 'prep'; app.sel = null; }
  if (key === 'ch4_brief') { app.mapTab = 0; TUT.tutJoin(run, 'rachel'); app.screen = 'prep'; app.sel = null; }
  if (key === 'ch4_deploy') { app.screen = 'map'; app.sel = null; }
  persist();
  tutRender();
}
/** 튜토리얼 끝 (종장까지 봄 · 건너뜀): 저장을 지우고 교범을 모두 열고 타이틀로 */
export function tutFinish(kind: 'done' | 'skipped') {
  closeCoach();
  if (advKey()?.startsWith('tu:')) closeAdv();
  if (app.view) { app.view.destroy(); app.view = null; }
  deleteSave(TUT_SLOT);
  metaTutEnd(kind);
  ACH.achTutorial(app.run, kind); // 업적: 장면 건너뛰기 없이 끝까지
  tutPaused = false;
  Object.assign(app, { run: null, summary: null, sel: null, bigUnit: null, menu: null, abilPop: null, statPop: false, paused: false, screen: 'title' as Screen, tutAsk: false });
  if (kind === 'done') tutEpi = true;
  else toast('튜토리얼을 건너뛰었습니다. 교범이 모두 열렸습니다.');
  render();
}
/** 타이틀로 나갈 때: 튜토리얼은 저장해 두고 화면만 정리 */
export function tutAway() {
  if (coachKey()?.startsWith('tu:')) closeCoach();
  if (advKey()?.startsWith('tu:')) closeAdv();
  tutPaused = false;
}

/** 도감 · 교범: 튜토리얼에서 배운 용어 (장 · 담당 인물별). 아직 안 배운 항목은 ??? — 바 운영 장은 바 첫 영업 보조를 하나라도 보면 열린다 */
export function codexManual() {
  const all = tutOver();
  const seen = new Set(tutMeta().seen || []);
  const barOpen = !!loadMeta().bar?.tut?.length || !!loadMeta().bar?.served;
  const open = (k: string) => all || seen.has(k) || (k === BAR_GLOSS_KEY && barOpen);
  const n = GLOSSARY.reduce((s2, c) => s2 + c.entries.filter((e) => open(e.key)).length, 0);
  return `<p class="muted small">튜토리얼 「당직 근무」 · 바 첫 영업에서 배운 용어 <b>${n}</b> / ${GLOSSARY_COUNT}. ${all ? '' : '튜토리얼을 진행하면 항목이 열리고, 끝내거나 건너뛰면 모두 열립니다.'}</p>`
    + GLOSSARY.map((c) => {
      const d = UNIT_BY_ID[c.who];
      return `<section class="gl-ch" style="--c:${speakerOf(c.who).color}"><h2 class="gl-h">${d ? sprite(d, 'spr gl-pt') : ''}<span>${esc(c.title)}</span><small class="muted">${esc(d?.name || c.who)}</small></h2>
        <div class="gl-list">${c.entries.map((e) => (open(e.key)
          ? `<div class="gl-row"><b>${esc(e.term)}</b><p class="small">${ic(esc(e.text))}</p></div>`
          : '<div class="gl-row locked"><b>???</b><p class="small muted">아직 배우지 않은 항목입니다.</p></div>')).join('')}</div></section>`;
    }).join('');
}
