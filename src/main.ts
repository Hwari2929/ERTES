import { PREVIEW_SECS, foeKey, startPreview } from './engine/preview';
import { CFG, encDmgMult, phaseAmpMult, phaseHpMult, scalePhase } from './config';
import { AUG_BY_ID, augDesc } from './data/augments';
import { ENEMIES, ENEMY_BY_ID, type EnemyDef } from './data/enemies';
import { SQUAD_KIND, type SquadKind } from './data/squads';
import { ENEMY_DESC } from './data/enemyText';
import { DIFF_PRESETS, DIFFS, MAX_DIFF, diffAddCount, diffAddEvery, diffAddRule, diffLabel, diffName, effDiffLabel, runHeat } from './data/difficulty';
import { CATWHEEL, DESPAIR_BY_ID, DESPAIRS, despairDiff, despairPhases, despairsOf, type DespairDef } from './data/despair';
import { BOONS, EVENT_BY_ID, EVENTS } from './data/events';
import { STORIES } from './data/stories';
import { FIELDS, fieldOf } from './data/battlefields';
import { BLESSING_BY_ID, GLOBAL_BY_ID, GLOBAL_TIER_NAME } from './data/globals';
import { tierKey, combine, CONSUMABLES, emblemOf, isConsumable, isEmblem, isInjector, isLegendConsumable, isLocked, isMat, isMod, refineLv, refineBase, potsOf, potSlots, potPool, POTS, DUST, SHARD, CRYSTAL, isOccultMod, isTurretGear, itemInfo, TURRET_GEAR } from './data/items';
import { aceTargetUid, ENG_TUR, OCCULT_SYNTH, rankTitle, SYN_BY_ID, SYNERGIES, TITLE_NAME, tierOf, VOYAGE_SPECIAL } from './data/synergies';
import { rowHtml, tierCmp } from './ui/tierdiff';
import { RECRUITABLE, UNIT_BY_ID, UNITS, type UnitDef } from './data/units';
import { withEmblemSummon } from './data/emblems';
import { DIVINE_ACT, FAITH_DEF, MINOR_TRAIT_GROW, recMajors } from './data/rework';
import { OATH_AUGS } from './data/oathaugs';
import { type AugList, cantripView, passiveView, SCHOOL_LINE, transformPreview } from './data/psiinfo';
import { augReqState } from './data/augreq';
import { GROUPS, SCHOOL_BY_ID, SCHOOL_PASSIVES, UNIT_GROUP, augMark, psiAugId, schoolOf, type SchoolId } from './data/schools';
import { BRIEF, PSI_BRIEF, unitBlurb } from './data/brief';
import { ABIL, augAbilText, ENEMY_ABIL, GLOSS } from './data/abiltext';
import * as AB from './ui/abil';
import * as CX2 from './ui/codex2';
import * as BAR from './ui/bar';
import * as CTR from './ui/contract';
import * as BRF from './ui/briefing';
import * as ACH from './ui/achieve';
import * as TFX from './ui/themefx';
import {
  activeTiers, allyRoom, type CompanionTok, encGeo, foeCell, runGeo, terrainCells, zoneAt, buildAlly, buildBattle, buildEnemy, chrTier, companionCells, deployed, kingOn, kingState, enemyBaseMoveSpd, layout, memberships, PAD, synergyCounts, synList, toPos, totalMajors, turretCells, turretCount, turretSavePos, TURRET_PAL, unitEffects, ZONE,
} from './engine/build';
import { Battle, controlNames, type CUnit, PROV, provMult, REASON_HI, REASON_LO, type Status, STATUS_NAME, TEND_NAME, fleeShort, VAN_LIKE, zocCapable, zocHoldFormula, zocHoldOf, zocRows, zocRule, zocShort } from './engine/combat';
import * as R from './engine/run';
import { CAUSAL, causalGain, causalLeft, causalNeed, causalStage, gearScore, KING, KING_GEAR, KING_GEAR_NAME, KING_MS_TEXT, kingStageText } from './data/chungra';
import { BGS, NPCS, PC_NAME, type Beat } from './data/scene';
import { Rng } from './rng';
import { type Category, type Encounter, type EnemySpawn, type Geo, CATEGORY_NAME, CATEGORY_RULE, categoryOf, type CType, type Elem, type TType, type DmgTag, type StatKey, type Weapon, CTYPE_NAME, ELEM_NAME, type FaithId, FAITH_NAME, FAITHS, MAJOR_NAME, TTYPE_NAME, MAJORS, NODE_NAME, type Major, type NodeType, type Pending, type RunState, type SupplyCard, type SynergyId, type UnitState } from './types';
import { encounterMatchup, fieldMatchup, matchupShort, schoolWarnings } from './ui/matchup';
import { computeStats, fromScr, gateGroupState, gateState, type GateState, makeSummons, rectScr, scrDims, type SummonMade, toScr } from './engine/build';
import { DEV, type Device, deviceCells, deviceRows, feastChain, feastHp, feastPct, isPlaceable, netCells, scopeR, wallHp } from './data/devices';
import { crateHomes, laserSets, mapOf, TERRAIN, terrainBlocks, type TerrainGroup, terrainGroups, type TerrainKind, terrainOf } from './data/maps';
import { dynLive, type DynLive } from './ui/terrainlive';
import { newCampaignRun } from './engine/campaignrun';
import { campBoss } from './engine/campaign';
import { chapterOf as campChapter, SETTLE as CAMP_SETTLE, TIME_COST as CAMP_TIME_COST } from './data/campaign';
import { gradeCards, greatFlash } from './ui/revealfx';
import { BattleView, DEATH_STYLES, fmt, FX, FX_DEFAULT, isDeathStyle, previewDeath, type DeathStyle, type MotionPreset, type UltCut } from './ui/battleview';
import { ULTS } from './data/ults';
import { VOICE, voicePick } from './data/voicelines';
import { DEFAULT_RELIC, RELIC_BY_ID } from './data/relics';
import { deleteSave, exportCode, importCode, listSaves, loadRun, saveRun, SLOT_NAME } from './ui/save';
import { loadMeta, metaBarMvp, metaBattle, metaClear, metaDeed, metaEvent, metaRunEnd, metaTutEnd, metaTutSeen, tutMeta, tutOver } from './ui/meta';
import { artURL, bgURL, hasPortrait, iconURL, loadArt, prefetchArt, standImg, standURL } from './ui/portraits';
import { advKey, closeAdv, playAdv } from './ui/adv';
import * as SND from './ui/sound';
import * as OATH from './ui/oath';
import * as REPORT from './ui/report';
import { recEnd, recReroll } from './engine/report';
import { ABIL_ICONS } from './ui/abilicons.gen';
import { augKey, lineIcon, synIcon, typeIcon } from './ui/synicons';
import { closeCoach, coachKey, startCoach, type CoachStep } from './ui/coach';
import { TUTORIAL_FLOW, TUTORIAL_SCENES, TUTORIAL_TIPS } from './data/scenes/tutorial';
import { GLOSSARY, GLOSSARY_COUNT } from './data/glossary';
import { NODE_DESC } from './data/nodes';
import * as TUT from './engine/tutorial';
import { fieldSyn, starterFavNeed, starterPool } from './engine/starters';
import * as RM from './ui/routemap';
import * as LAB from './ui/lab';
import * as SHOP from './ui/shop';

// 편의 설정 (이 브라우저에만 저장): 전투 속도, 진형 속도 등
const PREF_KEY = 'errantes.prefs.v1';
/** 전투 배속 (단축키 1~6, Space 정지) */
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
function loadPrefs(): { speed?: number; detail?: boolean; slowDetail?: boolean; zoomOut?: boolean; fxMs?: number; skillMs?: number; motion?: MotionPreset; death?: DeathStyle; ultCut?: UltCut; uiTheme?: string; uiFx?: string; fullscreen?: boolean; prepFold?: boolean; benchOff?: boolean; boardFit?: boolean; boardZoom?: number; boardZoomLast?: number; battleZoom?: number } {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
/** 연출 설정을 전투 화면에 반영 */
function applyFxPrefs() {
  const p = loadPrefs();
  const ms = (v: unknown, d: number) => (typeof v === 'number' && v >= 200 && v <= 5000 ? v : d);
  FX.fxMs = ms(p.fxMs, FX_DEFAULT.fxMs);
  FX.skillMs = ms(p.skillMs, FX_DEFAULT.skillMs);
  FX.motion = p.motion === 'fast' || p.motion === 'slow' || p.motion === 'mid' ? p.motion : FX_DEFAULT.motion;
  // 저장값이 없으면 기본값 (휘리릭). 예전에 고른 '스르륵' 은 직접 고른 것과 구분할 수 없어 그대로 둔다
  FX.death = isDeathStyle(p.death) ? p.death : FX_DEFAULT.death;
  FX.ultCut = p.ultCut === 'full' || p.ultCut === 'short' || p.ultCut === 'off' ? p.ultCut : FX_DEFAULT.ultCut;
}
/** UI 테마 (설정 → 테마). 색은 style.css 의 [data-ui-theme] 블록에 있고, 여기서는 <html data-ui-theme> 만 바꾼다. 첫 실행 기본값 = 에란테스 갤럭시 */
const UI_THEMES = [
  { id: 'galaxy', name: '에란테스 갤럭시', desc: '잉크빛 남색 · 미색 · 계약서 호박색 (기본)' },
  { id: 'vintage', name: '에란테스 퓨처리스틱 네이비 빈티지', desc: '짙은 네이비 · 빛바랜 종이 · 녹청 강조 · 바랜 황동' },
  { id: 'ithaca', name: '이타카 코랄 베이지 시-사이드', desc: '밝은 모래 바탕 · 코랄 강조 · 바다색 (라이트)' },
  { id: 'ithaca-port', name: '이타카 무역항', desc: '물안개 하늘빛 바탕 · 네이비 · 에메랄드 강조 · 바다색 (라이트)' },
  { id: 'hoishun', name: '호이슌 사쿠라 가든', desc: '자줏빛 네온 밤 · 벚꽃 분홍 · 네온 청록' },
  { id: 'calito', name: '칼리토 스타더스트 홀', desc: '황실 연회장 남보라 · 금색 · 별가루 은빛' },
] as const;
const uiTheme = () => { const t = loadPrefs().uiTheme; return UI_THEMES.some((x) => x.id === t) ? t! : 'galaxy'; };
/** 테마 연출 (설정): 켜기 · 줄이기 · 끄기. 첫 실행 기본값 = 켜기 */
const UI_FX = [['on', '켜기'], ['low', '줄이기'], ['off', '끄기']] as const;
const uiFx = (): TFX.FxLevel => { const v = loadPrefs().uiFx; return v === 'low' || v === 'off' ? v : 'on'; };
function applyTheme() {
  const t = uiTheme(), fx = uiFx(), h = document.documentElement;
  h.dataset.uiTheme = t; h.dataset.tfx = fx;
  TFX.setThemeFx(t, fx);
}
/** 설정: 테마 견본 (견본 칩은 data-ui-theme 로 그 테마의 토큰을 그대로 읽는다) */
function themePicker() {
  const cur = uiTheme();
  return `<div class="th-list" role="radiogroup" aria-label="테마">${UI_THEMES.map((t) => `<button class="th-opt${cur === t.id ? ' on' : ''}" data-a="pref-theme" data-v="${t.id}" role="radio" aria-checked="${cur === t.id}">
    <span class="th-sw" data-ui-theme="${t.id}" aria-hidden="true"><i class="sw-bg"></i><i class="sw-panel"></i><i class="sw-text"></i><i class="sw-sel"></i></span>
    <span class="th-tx"><b>${t.name}</b><span class="muted small">${t.desc}</span></span></button>`).join('')}</div>`;
}
function savePref(k: string, v: unknown) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPrefs(), [k]: v })); } catch { /* 저장 불가 환경 */ }
}

// ───────────────────────── 전체 화면 (휴대폰: 주소창 · 상태 표시줄 · 내비게이션 바를 숨긴다). 브라우저 규칙상 누르는 순간에만 켤 수 있다
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
const isFullscreen = () => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);
const canFullscreen = () => !!((document.documentElement as FsEl).requestFullscreen || (document.documentElement as FsEl).webkitRequestFullscreen);
function enterFullscreen(quiet = false) {
  const el = document.documentElement as FsEl;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : (el.webkitRequestFullscreen?.(), undefined);
    Promise.resolve(p).catch(() => { if (!quiet) toast('이 브라우저에서는 전체 화면을 켤 수 없습니다.'); });
  } catch { if (!quiet) toast('이 브라우저에서는 전체 화면을 켤 수 없습니다.'); }
}
function toggleFullscreen() {
  if (isFullscreen()) { const d = document as FsDoc; (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.()); savePref('fullscreen', false); return; }
  savePref('fullscreen', true);
  enterFullscreen();
}
/** '전체 화면 유지'가 켜져 있으면 페이지를 연 뒤 첫 터치 · 클릭에서 다시 켠다 (한 번만) */
if (typeof window !== 'undefined' && loadPrefs().fullscreen && canFullscreen()) {
  const once = (e: Event) => { if ((e.target as Element | null)?.closest?.('[data-a="fullscreen"]')) return; window.removeEventListener('pointerup', once, true); if (!isFullscreen()) enterFullscreen(true); };
  window.addEventListener('pointerup', once, true);
}
const FS_SVG = (on: boolean) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${on ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'}"/></svg>`;

type Screen = 'title' | 'contract' | 'newrun' | 'map' | 'prep' | 'battle' | 'shop' | 'news' | 'invest' | 'over' | 'codex' | 'bar' | 'oath';
/** 화면을 가리지 않는 확인 팝업: anchor 선택자 중 처음 보이는 요소 옆에 (inv = 보관함 상자 왼쪽 · above = 위 · beside = 옆). ok 가 없으면 안내만 (닫기 버튼 하나) */
type Ask = { html: string; anchor: string[]; at: 'inv' | 'above' | 'beside' | 'below'; ok?: () => void; okLabel?: string; hl?: number[] }; // hl: 함께 강조할 보관함 칸 (조합 재료 둘)
type Sel = { k: 'unit'; uid: string } | { k: 'terrain'; g: number } | { k: 'turret'; i: number } | { k: 'king' } | { k: 'item'; idx: number } | { k: 'relic'; id: string } | { k: 'enemy'; i: number } | { k: 'def'; id: string } | null;

const app = {
  screen: 'title' as Screen,
  tacOpen: false, // 편성 표: 전술 위력 내역 펼침
  mapTab: 0, // 메인 화면 우측 패널 탭: 0 파티 · 1 환경 · 2 기록
  musterSel: [] as string[], // 지정 소집에서 고른 시너지
  shopShut: false, // 상인 상점을 [닫기]로 닫고 지도에 있다 (편성에 갔다 돌아오면 지도로. 아니면 같은 상점으로)
  run: null as RunState | null,
  sel: null as Sel,
  popOff: '', // 배치형 소모품을 쥔 채 보관 물품 팝업만 닫음 ('칸 번호:물품 id', 쥔 도구는 그대로 → 보드 창 위 행동 칩이 대신 보인다). 같은 물품을 다시 누르면 팝업을 다시 연다
  starters: [] as string[],
  pool: [] as string[], // 시작 기물 후보 (CFG.starterPool 명, engine/starters.ts)
  poolRerolls: 0, // 시작 기물 후보 새로고침 남은 횟수
  detail: !!loadPrefs().detail, // 상세 보기: 계수 · 메커니즘 표시
  recruitPick: null as string | null, // 영입 창에서 고른 기물 (확정 전)
  recruitAway: null as string | null, // 영입 · 지정 소집 창에서 잠시 나감: 그 창의 후보 목록 (후보가 바뀌거나 영입하면 다시 열린다)
  recoFor: null as string | null, // 추천 장비 창을 연 기물 uid
  useK: null as null | { i: number; tg: R.UseTarget }, // 소모품 사용 확인 창
  ask: null as null | Ask, // 보관함 · 기물 옆 확인 팝업 (장비 조합 · 재구성 회로 · 분리 용제)
  nodePick: null as string | null, // 지도: 이번 칸에서 고른 노드 (진입 전)
  bigUnit: null as string | null, // 기물 전체 상세 팝업 (대기실 · 편성 확대)
  preview: null as { defId: string; run: RunState; uid: string } | null, // 영입 전 기물 전체 상세 (카드의 최대화 단추): 런을 복제해 합류시킨 모습
  statPop: false, // 상세 보기: 전투 스탯 펼침 (패널 왼쪽)
  abilPop: null as string | null, // 능력 상세 팝업 (weapon · skill · trait · ace · aug:<id>)
  cardOpen: null as string | null, // 터치 화면: 설명을 펼친 시작 기물 카드
  subOpen: new Set<string>(), // 특성 하위 항목(전투 · 전술 유형, 신앙) 펼침 상태
  menu: null as null | 'menu' | 'settings' | 'export' | 'import',
  zoomOut: !!loadPrefs().zoomOut, // 전투 화면: 테두리 포함 전장 전체를 축소해 보기
  slowDetail: loadPrefs().slowDetail !== false, // 전투 중 상세 정보를 보는 동안 속도 ×0.25
  view: null as BattleView | null,
  paused: false, // 전투 일시 정지
  relicPick: null as string | null, // 성유물 교체 창을 연 디바인 uid
  summary: null as R.BattleSummary | null,
  picks: [] as Major[],
  augPick: null as number | null, // 증강 창에서 고른 칸 (확정 전)
  speed: SPEEDS.includes(loadPrefs().speed || 0) ? loadPrefs().speed! : 1,
  toast: '',
  toastT: 0 as ReturnType<typeof setTimeout> | 0,
  importErr: '',
  needMount: false,
  diff: DIFF_PRESETS[0].lvl, // 새 런 난이도 = 위험 등급 (쉬움 3 · 모험 6 · 고난 7, data/difficulty.ts DIFF_PRESETS)
  introField: null as string | null, // 출격 연출: 이번 런 전장
  introFoe: null as string | null, // 전장 브리핑에서 연 적 상세
  codexTab: 'units' as 'units' | CX2.Cx2Tab | 'enemies' | 'events' | 'manual' | 'records' | 'ach',
  tutAsk: false, // 첫 실행: 새 계약을 누르면 튜토리얼부터 볼지 묻는다
  codexGroup: 'none' as 'none' | 'faction' | 'trait' | 'ctype' | 'ttype', // 도감 기물: 모아보기 기준
  codexSel: null as string | null, // 도감 기물: 상세를 펼친 기물
  meterTab: 'dmg' as 'dmg' | 'taken' | 'support' | 'kills',
  battleSel: null as number | null, // 전투 중 선택한 기물 (아군 · 적)
  battleTerrain: null as number | null, // 전투 중 선택한 지형 지물 (data/maps.ts terrainGroups 번호)
  crane: null as number | null,
  sqSel: null as number | null, // 편성 화면 '이번 전투': 고른 적 분대 번호 (보드에서 그 분대만 강조) // 편성 화면: 크레인으로 옮길 자리를 고르는 컨테이너 번호 (그 컨테이너를 고른 동안만)
  bPick: null as string | null, // 상세 정보에서 고른 효과 (st:key) · 장비 (it:id)
  releaseConfirm: null as string | null,
  lastBattle: null as Battle | null,
};

const root = document.getElementById('app')!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pctTxt = (x: number) => `${Math.round(x * 100)}%`;
/** 확률 표기 (소수 1자리): 2.5% · 8.8% */
const pct1 = (x: number) => `${+(x * 100).toFixed(1)}%`;
/** 보급 대박: 장마다 앞에서부터 굴려 처음 걸린 배율 (CFG.supply.jackpot) → 배율별 실제 확률 */
/** 보급 대박 카드 클래스: ×jackpotLegend 이상 = 빨강 (jp-hi), 그 밖의 대박 = 파랑 (jp-lo) */
const jpClass = (c: SupplyCard) => (c.mult >= CFG.supply.jackpotLegend ? ' jp jp-hi' : c.mult > 1 ? ' jp jp-lo' : '');
const jackpotTxt = () => { let left = 1; return CFG.supply.jackpot.map(([x, p]) => { const q = left * p; left *= 1 - p; return `×${x} ${pct1(q)}`; }).join(' · '); };

/** 출격 계약 차림표를 연다 (바 · 타이틀 · 결과 화면의 '새 계약'). list = 메뉴에 없는 의뢰 목록을 펼친 채로 */
function openContract(list: boolean) {
  app.tutAsk = false;
  CTR.contractStart(app.screen === 'bar' ? 'bar' : 'title', list, app.screen === 'bar' ? document.querySelector('main.bar')?.outerHTML || '' : ''); // 바 화면을 그대로 떠서 시선 전환에 쓴다 (인물 · 세로 띠가 갑자기 사라지지 않게)
  app.screen = 'contract'; app.menu = null; app.introFoe = null; app.abilPop = null;
}
function toast(msg: string) {
  SND.toastSfx(msg); // 입력 중에 뜬 오류 알림이면 그 입력의 소리를 오류음으로
  app.toast = msg;
  if (app.toastT) clearTimeout(app.toastT);
  app.toastT = setTimeout(() => { app.toast = ''; const t = document.getElementById('toast'); if (t) t.hidden = true; }, 2400);
  const t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.hidden = false; }
}
function persist() {
  if (app.run && !app.run.over && app.screen !== 'battle') {
    R.checkOccult(app.run); // 신비학자 새 단계 → 전용 개조부품 선택
    R.mergeCatwheels(app.run); // 캣휠 ZI존: 사건 등 다른 길로 캣휠이 모였을 때도 (알림은 대기 중인 선택으로)
    // 엔지니어 2 · 4 · 6명에 처음 닿으면 (편성 중에도) 포탑 장비 고르기를 바로 띄운다
    R.syncTurretPick(app.run);
    // 헬레니우스 · 신비학자 단계가 내려가면 그 단계 전용 장비 회수, 다시 닿으면 반환
    const sg = R.syncSynGear(app.run);
    if (sg.out.length) toast(`전용 장비 ${sg.out.length}개 회수 (시너지 단계 하락)`);
    else if (sg.back.length) toast(`전용 장비 ${sg.back.length}개 반환`);
  }
  if (app.run && !app.run.over) saveRun(app.run, app.run.lab ? LAB.LAB_SLOT : app.run.tutorial ? TUT_SLOT : app.run.campaign ? CAMP_SLOT : 'auto'); // 훈련장 · 튜토리얼 · 캠페인 런은 이어하기(자동 저장)를 덮지 않게 따로
}

// ───────────────────────── 공용 조각
const NODE_ICON = new Proxy({} as Record<NodeType, string>, { get: (_t, k: string) => lineIcon(`n.${k}`) });

function chip(id: string) {
  const s = SYN_BY_ID[id as keyof typeof SYN_BY_ID];
  return `<span class="chip" style="--c:${s.color}">${synIcon(id) || s.icon} ${esc(s.name)}</span>`;
}
function sprite(defOrUnit: Parameters<typeof iconURL>[0], cls = 'spr') {
  return `<img class="${cls}${hasPortrait(defOrUnit) ? ' pt' : ''}" alt="" src="${iconURL(defOrUnit)}">`;
}
/** 스탠딩 상단 배너 (클릭하면 전신 보기) */
function hero(id: string, cls = 'hero') {
  const img = standImg(id, 'stand', true);
  return img ? `<div class="${cls}" data-stand="${id}">${img}</div>` : '';
}
// 메이저 스탯 아이콘 (24×24 선 아이콘, 색은 CSS --c)
const MAJOR_ICON: Record<Major, string> = {
  // 메이저 능력치: 흰색 면 아이콘 (마이너 능력치 · 위력은 선 아이콘)
  vit: '<path d="M12 20.5s-7.6-4.6-9.6-9.2A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.6 5.3c-2 4.6-9.6 9.2-9.6 9.2z"/>',
  pow: '<path d="M20.5 3.5l-.8 4.6-8.1 8.1-3.8-3.8 8.1-8.1z"/><path d="M4.6 12.4l1.4-1.4 7 7-1.4 1.4z"/><path d="M6.6 16.6l.8.8-3.1 3.1a1.1 1.1 0 0 1-1.6-1.6z"/>',
  mnd: '<path fill-rule="evenodd" d="M12 5.2C5.9 5.2 2 12 2 12s3.9 6.8 10 6.8S22 12 22 12s-3.9-6.8-10-6.8zm0 2.6a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4z"/><circle cx="12" cy="12" r="2"/>',
  def: '<path d="M12 2.5l8.5 3.2v6.1c0 5-3.6 8.4-8.5 9.7-4.9-1.3-8.5-4.7-8.5-9.7V5.7z"/>',
  agi: '<path d="M13.6 2L4 13.8h6.6L9.4 22l10-12.2h-6.7z"/>',
};
function majorIcon(m: Major, cls = 'mi') {
  return `<svg class="${cls} mi-${m}" viewBox="0 0 24 24" aria-hidden="true">${MAJOR_ICON[m]}</svg>`;
}
/** 증강 임시 아이콘: id 로 정해지는 색 · 무늬 + 이름 첫 글자 (정식 아이콘이 생기면 교체) */
function augIcon(id: string, cls = 'aug-ic') {
  const a = AUG_BY_ID[id];
  // 학파 · 전공: 학파 아이콘 + 학파 색
  const sch = id.startsWith('school.') || id.startsWith('psi.') ? SCHOOL_BY_ID[id.split('.')[1] as SchoolId] : null;
  if (sch) return `<span class="${cls} sch" style="--sc:${sch.color}" aria-hidden="true">${lineIcon(`s.${sch.id}`)}</span>`;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  // 풀별 색: 스페셜 금 · 사이오닉 보라 · 메이저 회청 · 전용은 기물별
  const hue = a?.pool === 'special' ? 42 : a?.pool === 'psionic' ? 275 : a?.pool === 'major' ? 210 : a?.pool === 'oath' ? 52 : h % 360;
  return `<span class="${cls}" style="--h:${hue}" aria-hidden="true">${lineIcon(augKey(`${a?.name || ''} ${a?.desc || ''}`))}</span>`;
}

/** 능력치 추천: 기본 스탯 성향 + 스킬이 쓰는 위력 + 사거리로 2개 */
const recommendedMajors = (d: UnitDef): Major[] => recMajors(d);

function rankPips(rank: number) {
  return `<span class="rank" title="공명 등급 ${rank}">${rankLabel(rank)}</span>`;
}
function xpBar(u: UnitState) {
  if (u.rank >= CFG.maxRank) return `<div class="xp max"><i style="width:100%"></i><b>MAX</b></div>`;
  const need = CFG.xpToNext(u.rank);
  return `<div class="xp"><i style="width:${(u.xp / need) * 100}%"></i><b>${u.xp}/${need}</b></div>`;
}
function itemIcon(id: string | null, attrs = '', note = '', count = 1) { // note: 툴팁 덧붙임 (갓 구운 빵의 남은 전투 등) · count: 보관함에 겹친 같은 소모품 수
  if (!id) return `<span class="item empty" ${attrs}></span>`;
  const it = itemInfo(id);
  const sc = isEmblem(id) ? SYN_BY_ID[emblemOf(id)]?.color : isOccultMod(id) ? SYN_BY_ID.OCCULT.color : ''; // 문장: 시너지 색 · 신비 부품: 신비학자 색
  const hx = isConsumable(id) ? ` hex" style="--hc:${consColor(id)}` : ''; // 소모품: 육각형 (합성품 보라 · 전투 보상 청록 · 전설급 금색 · 셰프 주황)
  const uses = id === 'K_scope' && app.run?.scope ? `<b class="use-n" title="남은 사용 횟수">${app.run.scope.n}</b>` : count > 1 ? `<b class="use-n" title="보유 개수">${count}</b>` : ''; // 표시 망원경: 오른쪽 아래 원형 사용 횟수 · 겹친 소모품: 같은 자리에 개수
  const rf = refineLv(id);
  const refine = rf ? `<span class="rf-gem" title="제련 ${rf}단계" aria-label="제련 ${rf}단계">${'<i></i>'.repeat(rf)}</span>` : ''; // 제련 단계: 칸 안 우측 상단부터 아래로 마름모 n개
  const np = potsOf(id).length, ns = potSlots(id);
  const potPips = np ? `<span class="pot-st" title="잠재능력 ${np}/${ns}" aria-label="잠재능력 ${np}/${ns}">${POT_STAR.repeat(np)}</span>` : ''; // 잠재능력: 하나라도 열렸을 때만, 아이콘 위 가운데
  return `<span class="item t${tierKey(id)}${hx}"${sc ? ` style="--sc:${sc}"` : ''} title="${esc(it.name + ' — ' + it.desc + (note ? ` (${note})` : ''))}" ${attrs}>${itemGlyph(id) || it.icon}${uses}${refine}${potPips}</span>`;
}
/** 보관함 칸 i 가 갓 구운 빵이면 '전투 n회 뒤 식음' (engine/run.ts breadLeft, 셰프 6명 이상이 켜져 있으면 덧붙임) */
function breadNote(run: RunState, i: number) {
  if (run.inventory[i] !== 'K_bread') return '';
  const left = R.breadLeft(run)[run.inventory.slice(0, i).filter((x) => x === 'K_bread').length];
  return `전투 ${left}회 뒤 식음${tierOf('CHEF', synergyCounts(deployed(run), run).CHEF || 0) >= CFG.chef.noStaleTier ? ' · 지금은 셰프 덕에 식지 않음' : ''}`;
}
/** 소모품 육각형 테두리 색: 전설급 = 전설 장비 색 · 셰프 = 셰프 시너지 색 · 합성품 = 신비학자 색 · 그 밖 (전투 보상 · 상점) 청록 */
const consColor = (id: string) => (id === 'K_scope' ? SYN_BY_ID.NAV.color : isLegendConsumable(id) ? 'var(--g-L)' : id === 'K_bread_stale' ? '#8c8478' : CONSUMABLES[id]?.chef ? SYN_BY_ID.CHEF.color : CONSUMABLES[id]?.drop ? '#6fc3df' : SYN_BY_ID.OCCULT.color);
/** 신비 개조부품 · 소모품 아이콘 */
const SPECIAL_GLYPH: Record<string, string> = {
  O_reach: 'a.range', O_feast: 'a.heal', O_ward_phys: 'e.phys', O_ward_psy: 'e.psy', O_ward_chem: 'e.chem', O_ward_elec: 'e.elec', O_ward_holy: 'e.holy',
  O_mirror: 'a.shield', O_echo: 'a.cd', O_soul: 'a.dmg', O_aegis: 'r.hp', O_void: 'a.crit', O_abyss: 'e.psy', O_grail: 'a.heal', O_codex: 'a.power',
  K_rank: 'r.res', K_morph: 'a.summon', K_legend: 'a.power', K_copy: 'a.reload', K_strip: 'u.area', K_reroll: 'a.cd', K_xp: 'k.inj1', K_xp2: 'k.inj2', K_xp3: 'k.inj3',
  K_seize: 'k.seize', K_rank3: 'k.rank3', K_bread: 'k.bread', K_bread_stale: 'k.bread_stale',
  K_cp_purge: 'k.purge', K_cp_note: 'k.note', K_cp_tape: 'k.tape',
  K_barricade: 'k.barricade', K_decoy: 'k.decoy', K_mine: 'k.mine', K_net: 'k.net', K_scope: 'k.scope', K_feast: 'k.feast', K_muster_ticket: 'k.ticket',
  T_cal: 'a.dmg', T_plate: 'a.hp', T_cryo: 's.chrono', T_ammo: 'u.mag', T_barrier: 'a.shield', T_selfd: 'u.area', T_rapid: 'a.speed', T_tesla: 'e.elec', T_flame: 's.pyro', T_snipe: 'a.snipe', T_mark: 'u.target',
};
/** 잠재능력 별 (아이콘 아래 가운데, 열린 잠재능력마다 1개 · 빈 칸은 그리지 않는다) */
const POT_PIP = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 .3l1.3 3.4L9.7 5 6.3 6.3 5 9.7 3.7 6.3.3 5l3.4-1.3z"/></svg>'; // 잠재능력 줄 (팝업): 네 모서리 별
const POT_STAR = POT_PIP;
/** 제련 단계 칩 (팝업): 마름모 */
const RF_GEM = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1l4 4-4 4-4-4z"/></svg>';
/** 합성 재료 아이콘 */
const MAT_GLYPH: Record<string, string> = { S_dust: 'm.dust', S_shard: 'm.shard', S_crystal: 'm.crystal' };
/** 장비 아이콘: 재료 · 고급 = 메이저 아이콘, 희귀 · 전설 = 고유 아이콘, 문장 = 시너지 아이콘 */
function itemGlyph(id: string) {
  if (isEmblem(id)) return synIcon(emblemOf(id), 'ii');
  if (isMod(id) || isConsumable(id) || isTurretGear(id)) return lineIcon(SPECIAL_GLYPH[id] || 'a.power', 'ii');
  if (id.startsWith('U_')) return lineIcon(`i.${id}`, 'ii');
  if (isMat(id)) return lineIcon(MAT_GLYPH[id] || 'm.dust', 'ii');
  if (id.startsWith('C_') || id.startsWith('G_')) return majorIcon(id.slice(2).split('+')[0] as Major, 'ii mi'); // 고급 모듈: 제련 단계 '+n' 은 떼고
  return lineIcon(`i.${refineBase(id).slice(2)}`, 'ii'); // 전설: 제련 단계 '+n' 은 떼고
}

/** 예상 이자 (상단 바 크레딧 · 투자 창구): 다음 전투를 마치면 받는 이자. R.interestInfo = 전투 정산(resolveBattle)과 같은 식 · 같은 상한 */
function interestLines(r: RunState) {
  const i = R.interestInfo(r);
  const n = Math.floor(r.credits / i.per), next = r.credits >= 0 && n < i.cap ? i.per - (r.credits % i.per) : 0;
  return {
    i,
    /** 한 줄 (투자 창구 · 눌렀을 때 알림) */
    short: `다음 전투를 마치면 이자 +${i.interest} (크레딧 ${i.per}당 1, 상한 ${i.cap}${i.myopic ? ` · [${i.myopic}] −${Math.round(CFG.despair.interest * 100)}%` : ''}${i.direct ? ` · [${i.direct}] 이자 없음` : ''})`,
    /** 툴팁: 계산식 · 상한 내역 · 다음 1까지 */
    tip: [
      `다음 전투를 마치면 이자 +${i.interest} — 승패와 상관없이, 정산 전 보유 크레딧 기준`,
      `계산: 크레딧 ${i.per}당 1, 상한 ${i.cap} → ${r.credits} ÷ ${i.per} = ${n}${n > i.cap ? ` → 상한 ${i.cap}` : ''}`,
      `상한 ${i.cap}: ${i.parts.map(([k, v], j) => `${k} ${j && v > 0 ? '+' : ''}${v}`).join(' · ')}${i.floor ? ' (줄어드는 몫은 0 에서 멈춤)' : ''}`,
      i.myopic ? `절망 증강 [${i.myopic}]: 이자 −${Math.round(CFG.despair.interest * 100)}% (내림) → +${i.interest}` : '',
      i.direct ? `전설 전역 증강 [${i.direct}]: 이자 0 (대신 전투에 들어갈 때 페트라 기물 1명당 크레딧 +${CFG.globalAug.petraPer})` : '',
      next ? `크레딧 ${next}를 더 모으면 이자 +1` : `이자 상한 ${i.cap}에 닿음`,
    ].filter(Boolean).join('\n'),
  };
}
function topbar() {
  const r = app.run;
  if (!r) return '';
  // 기타 자원: 권능 · 명성 · 축복 (눌러서 펼침)
  const extra = [
    r.streak >= 2 ? `<li class="streak"><span>${lineIcon('r.streak', 'li')}연승</span><b>${r.streak}</b></li>` : '',
    r.power || R.hasDivine(r) ? `<li class="faith" title="권능 포인트: 디바인 기물이 전투에서 모은 신성력 ÷ ${CFG.powerPerDiv}. 순례에서 사용"><span>권능</span><b>${r.power}</b></li>` : '',
    r.fame ? `<li class="fame"><span>명성</span><b>${r.fame}</b></li>` : '',
    r.blessing ? `<li class="faith" title="${esc(BLESSING_BY_ID[r.blessing].desc)}"><span>축복</span><b>${esc(BLESSING_BY_ID[r.blessing].name)}</b></li>` : '',
    r.loan ? `<li><span>대출 상환</span><b>${r.loan}</b></li>` : '',
  ].filter(Boolean);
  // 활성 시너지 아이콘 줄 (모바일 전용, 아이콘만)
  const counts = synergyCounts(deployed(r), r);
  const syns = synList(r).filter((s) => (counts[s.id] || 0) > 0).sort((a, b) => tierOf(b.id, counts[b.id] || 0) - tierOf(a.id, counts[a.id] || 0) || (counts[b.id] || 0) - (counts[a.id] || 0));
  const it = interestLines(r);
  return `<header class="top">
    <div class="brand">ERRANTEs</div>
    <div class="top-chips">
    <div class="stat-row">
      ${r.campaign ? `<span class="pill" title="장 · 노드"><b>${r.campaign.ch}</b>장 · ${Math.min(r.step + 1, r.map.length)}/${r.map.length}</span>` : `<span class="pill" title="페이즈 · 노드">P<b>${r.phase}</b> · ${Math.min(r.step + 1, r.map.length)}/${r.map.length}</span>`}
      <span class="pill hp" title="체력">${lineIcon('r.hp', 'li')}<b>${r.hp}</b>/${r.maxHp}</span>
      <button class="pill cr" data-a="interest-info" title="${esc(`에너지 크레딧 ${r.credits}\n${it.tip}`)}">${CR}<b>${r.credits}</b>${r.over ? '' : `<span class="cr-int${it.i.interest ? '' : ' zero'}${it.i.raw >= it.i.cap ? ' max' : ''}">+${it.i.interest}<span class="cr-int-tx"> 이자</span></span>`}</button>
      ${CTR.contractPill(r)}${despairPill(r)}${OATH.oathPill(r)}${kingPill(r)}
    </div>
    ${extra.length ? `<details class="pill more"><summary title="기타 자원">${lineIcon('r.more', 'li')}<span class="more-tx">기타</span></summary><ul class="more-list">${extra.join('')}</ul></details>` : ''}
    </div>
    ${app.screen === 'battle' ? '' : `<button class="btn ghost menu-btn" data-a="menu" title="메뉴" aria-label="메뉴">${lineIcon('r.menu', 'li')}</button>`}
    ${syns.length && app.screen !== 'battle' ? `<div class="top-syns-wrap"><div class="top-syns pc-syn">${syns.map((s) => synToken(s.id, counts[s.id] || 0)).join('')}</div><span class="ts-more" aria-hidden="true">›</span></div>` : ''}
  </header>`;
}

/** 상단 바: 공왕 무휼 인과 단계 (인과율이 있거나 청라공국이 켜져 있을 때). 누르면 무휼 상세 */
function kingPill(r: RunState) {
  if (!r.causal && !kingOn(r)) return '';
  const st = causalStage(r.causal || 0), lf = causalLeft(r.causal || 0);
  return `<button class="pill king-pill" data-a="king-info" title="${esc(`공왕 무휼 · 누적 인과율 ${r.causal || 0}\n이긴 전투마다 (${CAUSAL.base} + 장비 점수 ÷ ${CAUSAL.gearDiv}) × 청라 단계 배율`)}">${lineIcon('a.power', 'li')}<span class="kp-tx">인과</span><b>${st}단계</b><span class="kp-next">${lf ? ` · 다음까지 ${lf}` : ' · 최고'}</span></button>`;
}
/** 시너지 토큰: 마름모 아이콘(누르면 상세) + 활성 단계 원 + 이름 · 구성 단계 (+ note: 목록의 보조 줄) */
function synToken(id: string, c: number, extra = '', note = '') {
  const sd = SYN_BY_ID[id as SynergyId];
  const t = tierOf(sd.id, c);
  const steps = sd.tiers.map((need, i) => `<span class="${c >= need ? 'on' : ''}${i === t - 1 ? ' cur' : ''}">${need}</span>`).join('');
  return `<div class="syn-tk${t ? ' active' : ''}${extra}" style="--c:${sd.color}">
    <button class="syn-b" type="button" data-syn="${sd.id}" aria-label="${esc(sd.name)} 상세"><span class="syn-dia">${synIcon(sd.id) || sd.icon}</span><span class="syn-lv" title="출전 ${c}명">${c}</span></button>
    <span class="syn-tx"><b>${esc(sd.name)}</b><span class="syn-steps">${steps}</span>${note}</span></div>`;
}
/** 시너지 상세 팝업 (마름모를 누르면) */
function synPopHtml(sid: string) {
  const id = sid as SynergyId;
  const sd = SYN_BY_ID[id];
  const run = app.run;
  let c = 0, head = '', mem = '';
  const t = run ? tierOf(id, (c = synergyCounts(deployed(run), run)[id] || 0)) : 0;
  const next = sd.tiers.find((need) => need > c);
  if (run) {
    // 머리 상태 줄: 출전 인원 · 단계 칸 · 지금 단계 · 다음 단계까지 (docs/UI.md 5. 상태 칩 1줄)
    const bonus = c - (synergyCounts(deployed(run))[id] || 0);
    const steps = sd.tiers.map((need, i) => `<span class="${c >= need ? 'on' : ''}${i === t - 1 ? ' cur' : ''}">${need}</span>`).join('');
    head = `<div class="sp-st"><span class="sp-n">출전 <b>${c}</b>명${bonus > 0 ? ` <span class="accent">(문장 +${bonus})</span>` : ''}</span><span class="syn-steps">${steps}</span>`
      + `<span class="sp-k${t ? ' on' : ''}">${t ? `${t}단계` : '미활성'}</span><span class="sp-k">${next ? `다음 단계까지 +${next - c}명` : '최대 단계'}</span></div>`;
  }
  // 지금 → 다음 비교 (src/ui/tierdiff.ts): 바뀐 숫자는 a → b, 한쪽에만 있는 효과는 지금 / 다음 표시
  const ni = next ? sd.tiers.indexOf(next) : -1;
  const cmp = tierCmp(t ? sd.tierDesc[t - 1] : undefined, run && ni >= 0 ? sd.tierDesc[ni] : run ? undefined : sd.tierDesc[0]);
  const lv = (k: string, need: number) => `<span class="sp-lv ${k === '지금' || k === '최대' ? 'cur' : 'nx'}">${k} <b>${need}</b></span>`;
  const tag = cmp.nextTag ?? cmp.curTag;
  const ch = t && ni >= 0 ? `${lv('지금', sd.tiers[t - 1])}<span class="td-ar">→</span>${lv('다음', next!)}` : t ? lv('최대', sd.tiers[t - 1]) : lv(run ? '다음' : '첫 단계', sd.tiers[0]);
  const lab: Record<string, string> = { cur: '지금', add: '다음' };
  const rows = cmp.rows.map((r) => `<li class="td-${r.k}">${lab[r.k] ? `<i class="td-l">${lab[r.k]}</i>` : ''}<span>${rowHtml(r, esc, statIc)}</span></li>`).join('');
  const cmpHtml = `<div class="sp-cmp${t ? ' live' : ''}"><div class="sp-ch">${ch}${tag ? `<span class="td-tag">${esc(tag)}</span>` : ''}</div><ul class="td-rows">${rows}</ul></div>`;
  // 소속 기물 초상화: 출전 · 대기 · 미보유 (문장으로 합류한 보유 기물 포함)
  const own = new Map<string, boolean>();
  for (const u of run?.units || []) if (memberships(u).includes(id)) own.set(u.defId, own.get(u.defId) || !!u.pos);
  const pool = UNITS.filter((d) => own.has(d.id) || (([...d.factions, ...d.traits] as string[]).includes(id) && (!d.eventOnly || loadMeta().units[d.id])));
  const st = (d: UnitDef) => (own.get(d.id) ? 0 : own.has(d.id) ? 1 : 2);
  pool.sort((x, y) => st(x) - st(y));
  const TAG = ['출전', '대기', '미보유'];
  mem = `<div class="sp-units">${pool.map((d) => `<span class="sp-u s${st(d)}" title="${esc(d.name)} · ${TAG[st(d)]}">${sprite(d, 'spr')}<i>${esc(d.name)}</i></span>`).join('')}</div>
    <div class="sp-legend small"><span class="s0">출전</span><span class="s1">대기</span><span class="s2">미보유</span></div>`;
  const focus = run && (app.screen === 'prep' || app.screen === 'map') ? `<button class="btn tiny sp-focus" type="button" data-synfocus="${id}">${app.screen === 'map' ? '파티에서' : '보드에서'} 강조</button>` : '';
  // 전체 단계표 · 설명은 접어서 아래에 (열림 상태는 이 세션 동안 기억)
  const tiers = `<ol class="sp-tiers">${sd.tierDesc.map((d, i) => `<li class="${i === t - 1 ? 'cur' : ''}${c >= sd.tiers[i] ? ' on' : ''}"><b>${sd.tiers[i]}</b><span>${statIc(esc(d))}</span></li>`).join('')}</ol>`;
  return `<b class="sp-t">${synIcon(id) || sd.icon}${esc(sd.name)}<small>${sd.kind === 'faction' ? '세력' : '특성'}</small></b>${head}${cmpHtml}${focus}${mem}
    <details class="sp-more"${synMore || !run ? ' open' : ''}><summary>전체 단계 · 설명</summary>${tiers}<p class="sp-desc">${esc(sd.desc).replace(/\n/g, '<br>')}</p></details>`;
}
/** 시너지 팝업의 '전체 단계 · 설명' 접힘 상태 */
let synMore = false;
function synergyPanel(run: RunState) {
  const counts = synergyCounts(deployed(run), run);
  const benchN: Record<string, number> = {}; // 시너지별 대기 기물 수
  for (const u of run.units) if (!u.pos) for (const sid of memberships(u, run)) benchN[sid] = (benchN[sid] || 0) + 1;
  const list = synList(run).filter((s) => counts[s.id] || benchN[s.id])
    .sort((a, b) => tierOf(b.id, counts[b.id] || 0) - tierOf(a.id, counts[a.id] || 0) || (counts[b.id] || 0) - (counts[a.id] || 0));
  if (!list.length) return `<div class="muted small">출전한 기물이 없습니다.</div>`;
  return list.map((s) => synToken(s.id, counts[s.id] || 0, counts[s.id] ? '' : ' benchonly')).join('');
}

// ───────────────────────── 화면: 타이틀
function titleScreen() {
  const saves = listSaves();
  const auto = saves.find((s) => s.slot === 'auto');
  const m = loadMeta();
  const slots = saves.filter((s) => s.slot !== 'auto');
  return `<main class="title-screen">
    <div class="ts-bg" style="background-image:url('${uiTheme().startsWith('ithaca') ? artURL('lore_ithaca.webp') : bgURL('title')}')"></div><div class="ts-shade"></div>
    <div class="ts-stars" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 53) % 100}%;--d:${(i % 9) * 0.5}s;--s:${2.5 + (i % 5)}s"></i>`).join('')}</div>
    <div class="ts-mid">
      <span class="ts-kicker">에란테스 용병단 · 은하 순회 의뢰</span>
      <div class="logo">ERRANTEs</div>
      <p class="tagline">은하 용병단 오토배틀러 · 증강 도파민 MAX</p>
      <div class="ts-body"><div class="ts-left">
      <nav class="title-actions" aria-label="메뉴">
        <div class="ts-main">${auto ? `<button class="btn primary ts-btn ts-hero" data-a="load" data-v="auto"><b>이어하기</b><small>페이즈 ${auto.phase} · 체력 ${auto.hp}</small></button>` : ''}
          <div class="ts-split one"><button class="btn ${auto ? '' : 'primary ts-hero'} ts-btn" data-a="newrun"><b>새 계약</b>${auto ? '<small>진행 중인 의뢰는 덮어씁니다</small>' : `<small>바 카운터 · 의뢰 · 약관 · 계약 기물 ${CFG.startUnits}명</small>`}</button></div></div>
        <div class="ts-grid" role="group" aria-label="둘러보기">${tutButton()}
          <button class="btn ts-btn ts-tile" data-a="bar"><b>에란테스 바</b><small>${auto ? '들렀다가 이어서 출격' : '단원 · 손님들의 잡담'}</small></button>
          <button class="btn ts-btn ts-tile" data-a="codex"><b>도감 · 기록</b><small>교범 · 기록 · 업적</small></button>
          <button class="btn ts-btn ts-tile ts-oath" data-a="oath"><b>절망 서약</b><small>${diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`} 조건 · 절망 ${OATH.heatNow()}${OATH.effNow() > CFG.oathFrom ? ` (위험 ${OATH.effNow()})` : ''}</small></button>
          ${(() => { const ls = LAB.labSaveInfo(); return `<button class="btn ts-btn ts-tile ts-lab" data-a="lab-enter"><b>에란테스 훈련장</b><small>${ls ? `이어서 · ${ls.step + 1}/${ls.len}칸` : '기물 · 장비 · 적을 불러 시험하는 실험실'}</small></button>`; })()}</div>
        <div class="ts-util" role="group" aria-label="저장 · 설정">${listTutSave() ? '<button class="btn ghost tiny" data-a="tutorial-restart">튜토리얼 처음부터</button>' : ''}<button class="btn ghost tiny" data-a="menu-import">저장 코드 불러오기</button><button class="btn ghost tiny" data-a="menu-tab" data-v="settings">설정 · 테마</button>${canFullscreen() ? `<button class="btn ghost tiny" data-a="fullscreen" title="전체 화면 (주소창 · 상태 표시줄 숨김)">${FS_SVG(isFullscreen())} ${isFullscreen() ? '전체 화면 끄기' : '전체 화면'}</button>` : ''}</div>
      </nav>
      ${slots.length ? `<div class="slots">${slots.map((s) => `<button class="btn ghost" data-a="load" data-v="${s.slot}">${SLOT_NAME[s.slot]} · 페이즈 ${s.phase} · 기물 ${s.units}</button>`).join('')}</div>` : ''}
      ${m.runs ? `<p class="ts-meta"><span>의뢰 <b>${m.runs}</b></span><span>성공 <b>${m.clears}</b></span><span>위험 등급 <b>${m.maxDiff}</b></span></p>` : ''}
      </div>
      ${(() => { const cs = loadRun(CAMP_SLOT); const go = cs?.campaign && !cs.over; return `<button class="btn ts-btn ts-campaign" data-a="campaign"><span class="ts-cp-kick">CAMPAIGN · 회수 계약</span><b>캠페인</b><small>${go ? `이어서 · ${esc(campChapter(cs!).name)} ${Math.min(cs!.step + 1, cs!.map.length)}/${cs!.map.length} · AH ${cs!.campaign!.time}` : '베르타–산노디스 물류망 · 라르스의 의뢰 · 1장 TS-7 환적 정거장'}</small><span class="ts-soon">1부 · 4장 완결</span></button>`; })()}
      </div>
    </div>
    <p class="ts-foot">싱글 PvE · 오프라인 플레이 · 진행은 이 브라우저에 자동 저장됩니다.</p>
    ${app.tutAsk ? tutAskModal() : ''}
  </main>`;
}
/** 타이틀: 튜토리얼 칸 (끝내기 전에는 NEW, 진행 중이면 이어서 — '처음부터'는 아래 보조 줄) */
function tutButton() {
  const saved = listTutSave();
  return `<button class="btn ts-btn ts-tile ts-tut" data-a="tutorial" title="튜토리얼 — 당직 근무: 새벽 2시, 에란테스 바에서 지휘를 배운다"><b>튜토리얼</b>${saved ? `<small>이어서 · 항로 ${Math.min(saved.step + 1, TUT.TUT_MAP.length)}/${TUT.TUT_MAP.length}칸</small>` : '<small>당직 근무 · 지휘 배우기</small>'}${tutMeta().done ? '' : '<span class="ts-new">NEW</span>'}</button>`;
}
/** 첫 실행: 튜토리얼부터 / 건너뛰기 */
function tutAskModal() {
  const d = UNIT_BY_ID.aiden;
  return `<div class="modal-bg"><div class="modal tut-ask" role="dialog" aria-label="튜토리얼 안내">
    <div class="ta-head">${d ? sprite(d, 'spr') : ''}<div><h1>처음 오셨군요</h1><p class="muted small">에이든 · 에란테스 바텐더</p></div></div>
    <p>지휘가 처음이시라면 튜토리얼 「당직 근무」부터 권합니다. 20분쯤 걸리고, 지는 일은 없습니다. 배운 용어는 도감의 교범 탭에 남습니다.</p>
    <p class="muted small">건너뛰면 교범이 모두 열리고, 튜토리얼은 타이틀에서 언제든 다시 할 수 있습니다.</p>
    <div class="row-btns"><button class="btn primary" data-a="tutorial">튜토리얼부터</button><button class="btn" data-a="tut-ask-skip">건너뛰기</button><button class="btn ghost" data-a="tut-ask-close">닫기</button></div>
  </div></div>`;
}

// ───────────────────────── 화면: 시작 기물 선택
/** 영입 카드용: 이 시너지를 가진 보유 기물 수 (출전 + 대기, 같은 기물은 1회) → 영입 후 */
function ownedChip(defId: string) {
  return (id: string) => {
    const run = app.run;
    if (!run) return chip(id);
    const owners = new Set(run.units.filter((u) => memberships(u).includes(id as SynergyId)).map((u) => u.defId));
    const n = owners.size, after = owners.has(defId) ? n : n + 1;
    return n ? chip(id).replace('</span>', ` <b class="own" title="보유 중인 ${esc(SYN_BY_ID[id as keyof typeof SYN_BY_ID].name)} 기물 ${n}명">${n}→${after}</b></span>`) : chip(id);
  };
}
const CTYPE_ICON = (k: string) => typeIcon(k);
const TTYPE_ICON = (k: string) => typeIcon(k);
const WPOS = (r: number) => (r <= 1 ? '근거리' : r <= 3 ? '중거리' : '원거리');
/** 이름 옆 유형 아이콘 (설명은 특성 아래) */
function typeIcons(d: UnitDef) {
  return `<span class="ticons"><i class="ct-${d.ctype}" title="전투 유형: ${CTYPE_NAME[d.ctype]}">${CTYPE_ICON(d.ctype)}</i><i class="tt-${d.ttype}" title="전술 유형: ${TTYPE_NAME[d.ttype]}">${TTYPE_ICON(d.ttype)}</i></span>`;
}
/** 이름 + 유형 아이콘, 그 아래 시너지 · 공명 등급 */
function nameBlock(d: UnitDef, syns: string[], rank: number | undefined, chipFn: (id: string) => string = chip, extra = '') {
  return `<div class="nb"><div class="nb-name"><b>${esc(d.name)}</b>${typeIcons(d)}</div>
    <div class="chips nb-syn">${rank ? rankPips(rank) : ''}${syns.map(chipFn).join('')}</div>${extra}</div>`;
}
/** 전투 유형 상세 설명 끝에 붙는 도주 규칙 (CFG.flee.ctypes 에 든 유형만) */
const fleeLine = (c: CType) => (CFG.flee.ctypes.includes(c) ? ` ${fleeShort()}.` : '');
const CTYPE_DESC: Record<string, [string, string]> = {
  MARK: [`사격으로 싸운다. 1초마다 사거리 안에서 체력 비율이 가장 낮은 적을 다시 노린다. 사격 위력 · 공격 속도 · 재장전 · 명중 · 치명타가 중요하다.`, `마무리 사격: 1초마다 사거리 안에서 체력 비율이 가장 낮은 적으로 대상을 바꾼다. 주력: 사격 위력, 사격 속도, 재장전 속도, 명중, 치명 확률 · 피해. 탄창을 다 쓰면 재장전하는 동안 기본 공격을 못 한다 (스킬은 가능).${fleeLine('MARK')}`],
  VAN: [`근접 타격으로 싸운다. 타격 위력 · 콤보와 피니쉬 · 치명타가 중요하다. 주변 ${CFG.zoc.r}칸은 경계 — 들어온 적이 ${zocHoldFormula()} 멈춰 선다 (암살형은 ×${+CFG.zoc.assassinMul.toFixed(2)}).`, `주력: 타격 위력, 타격 속도, 명중, 콤보 · 피니쉬 피해량, 치명 확률 · 피해. 무기별 N번째 공격이 피니쉬 (×${CFG.finishMult}). ${zocRule()}`],
  SPEC: ['기술로 싸운다. 기술 위력 · 효과 명중 · 쿨다운이 중요하다.', `주력: 기술 위력, 효과 명중, 쿨다운 감소 속도, 기술 범위. 기술 피해는 치명타가 없다 (일부 특성 예외).${fleeLine('SPEC')}`],
  CMD: ['아군이 함께 쓰는 전술 위력으로 스킬을 쓴다. 출전 인원이 많을수록, 지휘관이 많고 정신력이 높을수록 강하다.', `스킬은 전술 위력으로 계산한다. 전술 위력 = ${CFG.tacBase - CFG.tacPerCmd} + 출전 기물 1명당 ${CFG.tacPerUnit} (4명 기준) + 지휘관마다 (${CFG.tacPerCmd} + 정신력 × ${CFG.tacPerMnd}) 을 높은 순으로 100% · ${Math.round(CFG.tacDecay * 100)}% · ${Math.round(CFG.tacDecay ** 2 * 100)}% … 더한 값.${fleeLine('CMD')}`],
};
/** 전투 유형 공통 규칙 본문: 돌격가는 이름 + 값 표 (주력 · 피니쉬 · 경계), 나머지는 문장 */
function ctypeRuleHtml(ct: string, detail: boolean) {
  if (ct !== 'VAN') return `<p>${esc(CTYPE_DESC[ct]?.[detail ? 1 : 0] || '')}</p>`;
  const rows: [string, string][] = [
    ['주력', detail ? '타격 위력 · 타격 속도 · 명중 · 콤보 · 피니쉬 피해량 · 치명 확률 · 치명 피해' : '타격 위력 · 콤보와 피니쉬 · 치명타'],
    ['피니쉬', `무기별 N번째 공격 · 피해 ×${CFG.finishMult}`],
    ...(detail ? zocRows() : zocRows().filter(([k]) => k === '경계 범위' || k === '교전 시간' || k === '암살형 적')),
  ];
  return `<dl class="um-types ct-rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** 전술 유형 공통 규칙: 공명 등급마다 모든 능력치 +1, 이정표 보상은 유형별 */
const TTYPE_RULE: Record<TType, string> = {
  major: `공명 등급마다 모든 주요 능력치 +1. 4등급마다 기물 전용 증강 1개 (최대 ${CFG.majorAugMax}개, 일반 12 · ★ 전설 2 중에서). 고유 궁극기는 시간이 지나면 저절로 차오르고 (기본 약 ${Math.round(CFG.ultTime * CFG.ultNeed)}초, 전투 시작 ${Math.round(CFG.ultStart * 100)}%), 기본 공격 · 전투 스킬 · 피격 때도 조금씩 찬다. 한 전투에 여러 번 쓸 수 있다.`,
  minor: '공명 등급마다 모든 주요 능력치 +1. 3등급마다 주요 능력치 2종 +3. 기술 계수와 특성 수치가 등급에 따라 자란다 (10등급 ×2, 20등급 ×3).',
  special: `공명 등급마다 모든 주요 능력치 +1. 4등급마다 기물 전용 증강 1개 (최대 ${CFG.majorAugMax}개).`,
  psionic: '공명 등급마다 모든 주요 능력치 +1. 기물마다 학파가 정해져 있고, 합류할 때 그 학파의 전공을 고른다 (비술 + 지속 능력). 4 · 8 · 12 · 16등급에 전공 증강 (최대 4개, 16등급에 완성).',
  divine: '공명 등급마다 모든 주요 능력치 +1. 고유 신앙이 깨어 있어 신성력을 모으고, 가득 차면 장착한 성유물의 신권 대행을 쓴다. 5등급마다 서약 증강 1개 (디바인 공용 풀). 모은 신성력은 전투 후 권능 포인트가 된다.',
};
/** 특성 하위 항목 (접힘) */
function sub(key: string, icon: string, cls: string, name: string, kind: string, body: string) {
  const open = app.subOpen.has(key);
  return `<div class="sub ${open ? 'open' : ''}"><span class="sub-h" data-a="toggle-sub" data-v="${key}" aria-expanded="${open}"><i class="${cls}">${icon}</i><b>${esc(name)}</b><span class="muted">${kind}</span><span class="caret">${open ? '▾' : '▸'}</span></span>${open ? `<div class="sub-b">${body}</div>` : ''}</div>`;
}
/** 증강 한 줄 (이름 · 설명) */
function augRow(id: string, param?: string, b: Battle | null = null, c: CUnit | null = null, tag = '') {
  const ad = AUG_BY_ID[id];
  return `<li class="aug-li ab-click${abilOn(`aug:${id}`)}" data-a="abil-pop" data-v="aug:${esc(id)}" role="button" tabindex="0">${augIcon(id)}<span><b>${augMark(id)}${esc(ad?.name || id)}</b>${tag ? ` <span class="tag">${tag}</span>` : ''}<br><span class="muted">${b && c ? augText(id, param, b, c) : esc(augDesc(id, param))}</span></span></li>`;
}
/** 다음 이정표 등급 */
function nextMilestone(tt: TType, rank: number): number | null {
  for (let r = rank + 1; r <= Math.min(CFG.maxRank, rank + 30); r++) {
    if ((tt === 'major' || tt === 'special') && CFG.growth.special('major', r)) return r;
    if (tt === 'minor' && CFG.growth.pick(tt, r)) return r;
    if (tt === 'psionic' && CFG.growth.psionic(tt, r)) return r;
    if (tt === 'divine' && CFG.growth.oath(tt, r)) return r;
  }
  return null;
}
const PILGRIM_FLAVOR = ['향 연기가 낮게 깔린 성소. 순례자들이 조용히 무릎을 꿇는다.', '닳은 돌계단 끝에 작은 제단이 있다. 누군가 두고 간 등불이 아직 따뜻하다.', '성가대의 노래가 끊겼다 이어진다. 사제가 권능의 값을 매긴다.'];
/** 순례: 참배 카드 3장 + 성유물 2종 + 디바인 성유물 관리 */
/** 보급: 뒷면 카드를 뒤집어 모두 받는다 (카드 1장 = 크레딧 · 공명도 · 장비 하나, 대박이면 배율 띠). 공개 연출 · 공개음은 revealfx · sound (supplyGrade) */
function supplyHtml(p: Extract<Pending, { t: 'supply' }>) {
  const left = p.options.filter((c) => !c.open).length;
  const face = (c: SupplyCard, i: number) => {
    if (!c.open) return `<button class="card sup-card" data-a="pick-supply" data-v="${i}" aria-label="보급품 ${i + 1} 뒤집기"><i class="cback" aria-hidden="true"></i></button>`;
    const jp = c.mult > 1 ? `<span class="sup-jp">대박 ×${c.mult}</span>` : ''; // ×2 파랑 · ×4 빨강 (jpClass)
    const body = c.kind === 'credits' ? `<span class="sup-ic">${CR}</span><b>+${c.credits}</b><span>에너지 크레딧</span>`
      : c.kind === 'xp' ? `<span class="sup-ic">${RES}</span><b>+${c.xp}</b><span>공명도 — 파티에 분배</span>`
      : c.items.map((id) => `<span class="sup-ic">${itemIcon(id)}</span><b class="t${tierKey(id)}">${esc(itemInfo(id).name)}</b><span>${statIc(esc(itemInfo(id).desc))}</span>`).join('');
    return `<div class="card sup-card open sup-${c.kind}${jpClass(c)}" data-sup="${i}">${jp}${body}</div>`;
  };
  return `<h1>보급</h1><p class="muted small">보급품 ${p.options.length}장을 모두 받습니다. 뒤집기 전에는 무엇이 들었는지 모릅니다 · ${p.route ? '항로 보급: 첫 장은 장비 재료 확정, 대박 없음' : `장마다 대박 확률 ${jackpotTxt()} (가치 배율)`} · 마지막 장: ${app.run && R.solventOn(app.run) ? '분리 용제 또는 재구성 회로' : '재구성 회로 또는 공명도'}.</p>
    <div class="cards sup-cards">${p.options.map(face).join('')}</div>
    <div class="row-btns">${left ? `<button class="btn primary" data-a="supply-all">모두 뒤집기 (${left}장)</button>` : '<button class="btn primary" data-a="supply-done">계속</button>'}</div>`;
}
function pilgrimHtml(run: RunState, p: Extract<Pending, { t: 'pilgrim' }>) {
  const dv = R.divines(run);
  const card = (c: NonNullable<typeof p.cards>[number], i: number) => {
    const d = R.PILGRIM_CARDS[c.id];
    const poor = run.power < c.cost;
    const head = `<b>${esc(d.name)}${c.faith ? ` · ${FAITH_NAME[c.faith]}` : ''}</b><span class="small">${esc(c.faith ? `디바인 1명의 신앙을 ${FAITH_NAME[c.faith]}(으)로 바꾼다.` : d.desc)}</span><span class="accent small">권능 ${c.cost}</span>`;
    if (c.sold) return `<div class="card pil-card sold">${head}<span class="tag">받음</span></div>`;
    if (!d.target) return `<button class="card pil-card" data-a="pil-card" data-v="${i}" ${poor ? 'disabled' : ''}>${head}</button>`;
    return `<div class="card pil-card">${head}<div class="pil-who">${dv.map((u) => `<button class="btn tiny" data-a="pil-card" data-v="${i}:${u.uid}" ${poor ? 'disabled' : ''}>${esc(UNIT_BY_ID[u.defId].name)}</button>`).join('')}</div></div>`;
  };
  const relic = (o: NonNullable<typeof p.relics>[number], i: number) => {
    const r = RELIC_BY_ID[o.id];
    const head = `<b>${lineIcon('a.power', 'li')} ${esc(r.name)}</b><span class="small">${esc(r.desc(1))}</span><span class="accent small">권능 ${o.cost} · 강화 ${r.enh}</span>`;
    return o.sold ? `<div class="card pil-card sold">${head}<span class="tag">구매함</span></div>` : `<button class="card pil-card relic" data-a="pil-relic" data-v="${i}" ${run.power < o.cost ? 'disabled' : ''}>${head}</button>`;
  };
  return `<h1>순례</h1><p class="pil-flavor muted">${esc(PILGRIM_FLAVOR[(run.phase + run.step) % PILGRIM_FLAVOR.length])}</p>
    <p>권능 포인트 <b class="accent">${run.power}</b> <span class="muted small">· 디바인이 전투에서 모은 신성력으로 얻습니다</span></p>
    <h3>참배</h3><div class="cards">${(p.cards || []).map(card).join('')}</div>
    <h3>성유물 <span class="muted small">디바인 전용 장비 · 장착한 성유물이 신권 대행이 된다</span></h3><div class="cards">${(p.relics || []).map(relic).join('') || '<p class="muted small">남은 성유물이 없습니다.</p>'}</div>
    ${dv.length ? `<h3>디바인</h3>${dv.map((u) => relicPanel(run, u)).join('')}` : ''}
    <div class="row-btns"><button class="btn primary" data-a="pilgrim-done">순례 마치기</button></div>`;
}
/** 성유물 토큰 (원형) */
function relicTok(id: string | undefined, attrs = '', on = false) {
  const r = id ? RELIC_BY_ID[id] : null;
  return `<span class="relic-tok${r ? '' : ' empty'}${on ? ' on' : ''}" role="button" tabindex="0" ${attrs} title="${r ? esc(`성유물 · ${r.name} — ${r.desc(1)}`) : '성유물 칸'}">${lineIcon(r ? `r.${r.id}` : 'k.relic', 'li')}</span>`;
}
/** 성유물 교체: 보관함의 성유물 토큰을 눌러 장착 */
function relicPicker(run: RunState, u: UnitState) {
  const spare = run.relics || [];
  const cur = u.relic ? RELIC_BY_ID[u.relic] : null;
  return `<div class="relic-pick"><div class="small">${cur ? `<b class="accent">${esc(cur.name)}</b> 장착 중 · ` : ''}<span class="muted">보관함 성유물을 누르면 교체합니다</span></div>
    <div class="rp-list">${spare.length ? spare.map((id) => `<button class="rp-item" data-a="relic-equip" data-v="${u.uid}:${id}">${relicTok(id)}<span><b>${esc(RELIC_BY_ID[id].name)}</b><br><span class="muted small">${esc(RELIC_BY_ID[id].desc(1))}</span></span></button>`).join('') : '<span class="muted small">보관 중인 성유물이 없습니다. 순례에서 구할 수 있습니다.</span>'}</div></div>`;
}
/** 상세 창용: 강화 버튼 + 보관함 성유물 교체 */
function relicPanelLite(run: RunState, u: UnitState) {
  const r = u.relic ? RELIC_BY_ID[u.relic] : null;
  const spare = run.relics || [];
  return `<div class="rp-lite">${r ? `<button class="btn tiny${u.enh ? ' on' : ''}" data-a="relic-enh" data-v="${u.uid}" ${u.enh || run.power < r.enh ? 'disabled' : ''} title="다음 전투 한정 신권 대행 계수 ×3">${u.enh ? '다음 전투 강화됨' : `강화 (권능 ${r.enh})`}</button>` : ''}
    ${spare.map((id) => `<button class="btn tiny" data-a="relic-equip" data-v="${u.uid}:${id}" title="${esc(RELIC_BY_ID[id].desc(1))}">${esc(RELIC_BY_ID[id].name)} 장착</button>`).join('')}</div>`;
}
/** 디바인 성유물 관리: 장착 · 교체 · 강화 */
function relicPanel(run: RunState, u: UnitState) {
  const r = u.relic ? RELIC_BY_ID[u.relic] : null;
  const spare = run.relics || [];
  return `<div class="relic-panel"><div class="rp-head"><b>${esc(UNIT_BY_ID[u.defId].name)}</b>${r ? `<span>${lineIcon('a.power', 'li')} ${esc(r.name)}</span>` : '<span class="muted">성유물 없음</span>'}
    ${r ? `<button class="btn tiny${u.enh ? ' on' : ''}" data-a="relic-enh" data-v="${u.uid}" ${u.enh || run.power < r.enh ? 'disabled' : ''} title="다음 전투 한정 신권 대행 계수 ×3">${u.enh ? '강화됨' : `강화 · 권능 ${r.enh}`}</button>` : ''}</div>
    ${r ? `<p class="small">${esc(r.desc(u.enh ? 3 : 1))}</p>` : ''}
    ${spare.length ? `<div class="rp-swap"><span class="muted small">교체:</span>${spare.map((id) => `<button class="btn tiny" data-a="relic-equip" data-v="${u.uid}:${id}" title="${esc(RELIC_BY_ID[id].desc(1))}">${esc(RELIC_BY_ID[id].name)}</button>`).join('')}</div>` : ''}</div>`;
}
/** 고유 신앙 한 줄: 디바인만 활성 */
/** 능력 블록: 고유 신앙 (디바인만 활성, 그 외는 비활성 표시) */
/** 성찬(도로스)으로 신앙이 깨어난 디바인 아닌 기물인지 (전투 중) */
const awakened = (d: UnitDef, c: CUnit | null) => d.ttype !== 'divine' && !!c && c.div !== null;
/** 도로스가 출전 중이라 성찬으로 깨어날 수 있는지 (편성) */
const dorosReady = (d: UnitDef, run: RunState | null) => d.ttype !== 'divine' && d.id !== 'doros' && !!run?.units.some((x) => x.defId === 'doros' && x.pos);
function faithAbil(d: UnitDef, u: UnitState | null, run: RunState | null, c: CUnit | null = null) {
  const f = c?.faith || u?.faith || d.faith;
  const fd = FAITH_DEF[f];
  const woke = awakened(d, c);
  const on = d.ttype === 'divine' || woke;
  const tok = abTok(`faith.${f}`);
  const off = dorosReady(d, run) ? '디바인만 신앙의 힘을 쓴다. 도로스의 [성찬] 요리를 받으면 이번 전투 동안 깨어난다.' : '디바인만 신앙의 힘을 쓴다.';
  return `<div class="abil ab-faith${on ? '' : ' off'}${tok ? ' has-tok' : ''}">${tok}<div class="ab-head"><span class="ab-kind">신앙</span><b>${FAITH_NAME[f]}</b><span class="ab-meta">${woke ? '성찬 각성' : on ? '활성' : '비활성'}</span></div>
    <p>${on ? `${esc(fd.buff)}. 신성력: ${esc(fd.gain)}${app.detail ? `, 초당 +2 (수집 상한 ${CFG.divCap + (run?.divCap || 0)})` : ''}.${woke ? ' 도로스의 [성찬]으로 이번 전투 동안 깨어났다.' : ''}` : off}</p></div>`;
}
/** 능력 란의 전술 유형 섹션: 유형마다 구성이 다르다 (u 없으면 도감 미리보기, c 있으면 전투 중 실시간 값) */
/** 전공 선택 카드: 학파 · 비술 · 지속 능력 · 고이성 · 저이성 · 전공 증강 7종 */
function schoolOpt(id: string, i: number) {
  const sc = SCHOOL_BY_ID[id.split('.')[1] as SchoolId];
  if (!sc) return '';
  // 이름 · 핵심 한 줄 · 비술 / 지속 아이콘만. 기믹은 아이콘을 눌러 상세에서 본다
  const ic = (key: string, tok: string, kind: string, name: string) =>
    `<span class="so-ic ab-click${abilOn(key)}" data-a="abil-pop" data-v="${key}" role="button" tabindex="0" title="눌러서 자세히">${abTok(tok)}<span><small>${kind}</small><b>${esc(name)}</b></span></span>`;
  return `<div class="aug-opt sch-opt ${app.augPick === i ? 'on' : ''}" style="--sc:${sc.color}" data-a="pick-augsel" data-v="${i}" role="button" tabindex="0" aria-pressed="${app.augPick === i}">
    <span class="so-head">${augIcon(id)}<span><span class="muted small">${GROUPS[sc.group].name}</span><b>${sc.name}</b></span><kbd>${i + 1}</kbd></span>
    <p class="so-line">${esc(SCHOOL_LINE[sc.id])}</p>
    ${app.run ? schoolWarnings(sc.id, app.run.field).map((w) => `<p class="so-warn ${w.level}">${w.level === 'good' ? '▲' : '⚠'} ${esc(w.text)}</p>`).join('') : ''}
    <span class="so-ics">${ic(`cantrip:${sc.id}`, `cantrip.${sc.id}`, '비술', sc.cantrip.name)}${ic(`psipass:${sc.id}`, `passive.${sc.id}`, '지속', sc.passive.name)}</span></div>`;
}
/** 전투 기물의 학파 (엔진 필드) */
const cSchool = (c: CUnit | null): SchoolId | null => ((c as { school?: SchoolId | null } | null)?.school ?? null);
function ttSection(d: UnitDef, u: UnitState | null, run: RunState | null, b: Battle | null = null, c: CUnit | null = null, live = false, rule = true) { // rule: 유형 공통 규칙 문장 (전체 상세는 접힌 칸으로 따로 보여 주므로 false)
  const tt = d.ttype;
  const rank = u?.rank || 1;
  const nx = u ? nextMilestone(tt, rank) : null;
  const f = u?.faith || d.faith;
  const owned = u?.augments || [];
  const body: string[] = [];
  if (tt === 'major' || tt === 'special') {
    if (live && c) body.push(`<div class="tt-row"><span class="tt-k">${lineIcon('a.battery', 'li')} 궁극기 게이지</span><b class="tt-big">${Math.round((c.ultG || 0) * 100)}%</b></div>`);
    const pool = d.specialAugs || [];
    const mine = owned.filter((a) => pool.some((p) => p.id === a.id));
    const max = CFG.majorAugMax;
    body.push(`<div class="tt-row"><span class="tt-k">전용 증강</span><b class="tt-big">${mine.length}<small>/${max}</small></b>${nx && mine.length < max ? `<span class="muted small">다음 ${nx}등급</span>` : ''}</div>`);
    if (mine.length) body.push(`<ul class="augs">${mine.map((a) => augRow(a.id, a.param, b, c)).join('')}</ul>`);
    else if (u) body.push(`<p class="muted small">4등급에 첫 전용 증강을 고릅니다.</p>`);
    if (!u) body.push(`<ul class="augs">${pool.map((a) => augRow(a.id, undefined, b, c)).join('')}</ul>`);
  } else if (tt === 'minor') {
    const g = CFG.minorGrow(rank);
    const tl = MINOR_TRAIT_GROW[d.id];
    body.push(`<div class="tt-row"><span class="tt-k">성장 배율</span><b class="tt-big">×${g.toFixed(2)}</b><span class="muted small">${u ? `${rank}등급` : '1등급'} · 10등급 ×2 · 20등급 ×3</span></div>`);
    body.push(`<ul class="tt-list"><li>${lineIcon('p.tech', 'li')}기술 계수 ×${g.toFixed(2)}</li>${tl ? `<li>${lineIcon('a.power', 'li')}${esc(tl(g))}</li>` : ''}</ul>`);
    if (nx) body.push(`<p class="muted small">다음 능력치 선택: ${nx}등급</p>`);
  } else if (tt === 'psionic') {
    const sid = (u ? schoolOf(u) : null) || cSchool(c);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    const mine = owned.filter((a) => a.id.startsWith('psi.'));
    if (sc) {
      const g = GROUPS[sc.group];
      // 머리: 학파 · 전공 칩
      body.push(`<div class="ps-head" style="--sc:${sc.color}">${lineIcon(`s.${sc.id}`, 'li')}<span class="ps-grp">${g.name}</span><b>${sc.name}</b><span class="muted small">${sc.study}</span></div>`);
      // 비술 · 지속 능력: 두 장의 작은 카드 (누르면 상세)
      // 전공 증강(◆ 변형 포함)을 반영한 실제 비술 · 지속 능력
      const pa = c?.src?.augments || owned;
      const cv = cantripView(sc.id, pa), pv = passiveView(sc.id, pa);
      const cd = psiCd(b, c, cv.cd);
      const chips = AB.skillChips(cv.info, actx(b, c, true), b && c ? b.S(c, 'range') : d.range, cd) + AB.chip('a.reason', `-${cv.cost}`, '이성 소모');
      // 설명: 상세 보기 = 상세 문장 (docs/ABILITY_TEXT.md), 아니면 한 줄 (수치 없음)
      const psiTx = (text: string | undefined, brief: string) => (app.detail && text ? `<div class="small">${detailHtml(text, actx(b, c, true))}</div>` : `<span class="small">${esc(brief)}</span>`);
      body.push(`<div class="ps-cards${app.detail ? ' dt' : ''}" style="--sc:${sc.color}">
        <div class="ps-card ab-click${abilOn('cantrip')} has-tok" data-a="abil-pop" data-v="cantrip" role="button" tabindex="0">${abTok(`cantrip.${sc.id}`)}<div class="ab-head"><span class="ab-kind">비술</span><b>${esc(cv.name)}</b>${psiTfTag(cv.transform)}</div><div class="ab-chips">${chips}</div>${psiTx(cv.info.text, cv.brief)}</div>
        <div class="ps-card ab-click${abilOn('psipass')} has-tok" data-a="abil-pop" data-v="psipass" role="button" tabindex="0">${abTok(`passive.${sc.id}`)}<div class="ab-head"><span class="ab-kind">지속</span><b>${esc(sc.passive.name)}</b>${psiTfTag(pv.transform)}</div>${psiTx(pv.text, pv.brief)}</div>
      </div>`);
      // 이성: 양 끝에 효과, 가운데 0 (누르면 규칙 상세)
      const r = live && c && c.reason !== null ? c.reason : null;
      const fz = !!(c && (c.mem.frenzy || c.statuses.some((x) => x.key === 'frenzy')));
      body.push(`<div class="ps-reason ab-click${abilOn('reason')}" data-a="abil-pop" data-v="reason" role="button" tabindex="0" style="--sc:${sc.color}">
        <div class="pr-bar">${r !== null ? `<i style="left:${(r + 100) / 2}%"></i><b style="left:${(r + 100) / 2}%">${Math.round(r)}</b>` : ''}</div>
        <div class="pr-ends"><span class="lo">${lineIcon('a.power', 'li')}${esc(sc.low)}</span><span class="hi">${esc(sc.high)}${lineIcon('a.shield', 'li')}</span></div>
        ${fz ? '<span class="pr-fz">광폭</span>' : ''}</div>`);
      // 전공 증강: 4칸 슬롯
      const slots = [0, 1, 2, 3].map((i) => {
        const a = mine[i];
        if (a) return `<button class="tt-ic ab-click${abilOn(`aug:${a.id}`)}" data-a="abil-pop" data-v="aug:${esc(a.id)}" title="${esc(AUG_BY_ID[a.id]?.name || a.id)}">${augIcon(a.id)}</button>`;
        return `<span class="ps-slot" title="${[5, 10, 15, 20][i]}등급">${[5, 10, 15, 20][i]}</span>`;
      }).join('');
      body.push(`<div class="tt-row ps-augs"><span class="tt-k">전공 증강</span><div class="tt-icons">${slots}</div></div>`);
      if (!u) { // 보유 기물은 고른 증강만 (남은 후보 목록은 상세 보기에서도 띄우지 않는다)
        const rest = SCHOOL_PASSIVES[sc.id].filter(([k]) => !mine.some((m) => m.id === psiAugId(sc.id, k)));
        if (rest.length) body.push(`<div class="ps-rest">${rest.map(([k, n, dsc]) => `<span class="pill" title="${esc(dsc)}">${augMark(psiAugId(sc.id, k))}${esc(n)}</span>`).join('')}</div>`);
      }
    } else {
      const gid = UNIT_GROUP[d.id];
      const majors = gid ? GROUPS[gid].majors : (Object.keys(SCHOOL_BY_ID) as SchoolId[]);
      body.push(`<p class="small muted">${u ? '아직 전공을 고르지 않았습니다.' : `${gid ? `${GROUPS[gid].name} · ` : '모든 학파 · '}합류할 때 전공 하나를 고른다.`}</p>`);
      body.push(`<div class="ps-rest">${majors.map((m) => SCHOOL_BY_ID[m]).map((x) => `<span class="pill sch-pill" style="--sc:${x.color}" title="${esc(`${x.cantrip.name}: ${x.cantrip.desc}`)}">${lineIcon(`s.${x.id}`, 'li')}${x.name}</span>`).join('')}</div>`);
    }
  } else {
    if (live && c && c.div !== null) body.push(`<div class="tt-row"><span class="tt-k">신성력</span><b class="tt-big">${c.divUsed ? '발동함' : Math.round(c.div)}</b><span class="muted small">수집 ${Math.round(c.divGot)} / ${c.divCap}</span></div>`);
    if (run) body.push(`<div class="tt-row"><span class="tt-k">권능 포인트</span><b>${run.power}</b><span class="muted small">전투 후 디바인이 모은 신성력 ÷ ${CFG.powerPerDiv}</span></div>`);
    const vows = owned.filter((a) => AUG_BY_ID[a.id]?.pool === 'oath');
    body.push(`<div class="tt-row"><span class="tt-k">서약 증강</span><b>${vows.length}</b>${nx ? `<span class="muted small">다음 ${nx}등급</span>` : ''}</div>`);
    if (vows.length) body.push(`<ul class="augs">${vows.map((a) => augRow(a.id, a.param, b, c)).join('')}</ul>`);
    else if (!u) body.push(`<p class="muted small">5등급마다 디바인 공용 서약 증강 ${OATH_AUGS.length}종 중 하나를 고른다.</p>`);
  }
  void f;
  return `<section class="abil tt-sec tt-${tt}"><div class="ab-head"><span class="ab-kind">전술 유형</span><b class="tt-name"><i class="tt-${tt}">${TTYPE_ICON(tt)}</i>${TTYPE_NAME[tt]}</b></div>
    ${rule && (tt !== 'psionic' || app.detail) ? `<p class="tt-rule small muted">${esc(TTYPE_RULE[tt])}</p>` : ''}${body.join('')}</section>`;
}
/** 분류 표시 (아군 · 적 공통) */
function categoryTag(cat: Category) {
  return `<i class="cat cat-${cat}" title="${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}">${lineIcon(`k.${cat}`, 'li')}${CATEGORY_NAME[cat]}</i>`;
}
const unitCategory = (d: UnitDef) => categoryOf(d.keywords);
const enemyCategory = (e: EnemyDef) => categoryOf(e.keywords, !!e.immobile);
/** 특성 블록: 고유 특성 + 전투 유형 · 전술 유형 · 고유 신앙 (접힘) */
function traitGroup(d: UnitDef, u: UnitState | null, run: RunState | null, b: Battle | null = null, c: CUnit | null = null) {
  const k = (x: string) => `${d.id}:${x}`;
  void u; void run;
  const tok = abTok(`trait.${d.id}`);
  return `<div class="abil ab-trait"><div class="ab-click${abilOn('trait')}${tok ? ' has-tok' : ''}" data-a="abil-pop" data-v="trait" role="button" tabindex="0">${tok}<div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div>${traitHtml(d, b, c)}</div>
    <div class="subs">
      ${sub(k('ct'), CTYPE_ICON(d.ctype), `ct-${d.ctype}`, CTYPE_NAME[d.ctype], '전투 유형', ctypeRuleHtml(d.ctype, app.detail))}
    </div></div>`;
}
const AB_KIND = { weapon: '무기', trait: '특성', skill: '스킬', grow: '성장', psi: '이성', div: '신권', ult: '궁극기', act: '신권 대행' } as const;
/** 무기 · 특성 · 스킬 등을 같은 모양의 블록으로 */
function abil(kind: keyof typeof AB_KIND, name: string, meta: string, desc: string) {
  return `<div class="abil ab-${kind}"><div class="ab-head"><span class="ab-kind">${AB_KIND[kind]}</span><b>${name.startsWith('<svg') ? name.replace(/(<\/svg>)(.*)$/, (_m, a, t) => a + esc(t)) : esc(name)}</b>${meta ? `<span class="ab-meta">${meta}</span>` : ''}</div><p>${esc(desc)}</p></div>`;
}
function weaponAbil(w: Weapon, elem = w.elem) {
  const el = elem !== 'phys' ? `${ELEM_NAME[elem]} 피해 · ` : '';
  if (w.kind === 'none') return abil('weapon', w.name, '', '기본 공격을 하지 않는다.');
  const brief = w.kind === 'mag' ? `${el}탄창 ${w.mag}발, 다 쓰면 재장전한다.` : `${el}${w.combo}번째 공격마다 강력한 피니쉬.`;
  const pow = w.tactical ? '전술 위력' : w.type === 'shoot' ? '사격 위력' : '타격 위력';
  const full = `${ELEM_NAME[elem]} · ${pow} ${Math.round(w.mult * 100)}% · ${w.kind === 'mag' ? `탄 ${w.mag} · 재장전 ${w.reload}초` : `콤보 ${w.combo} (피니쉬 ×${CFG.finishMult})`} · 공격 간격 ${w.interval}초`;
  return abil('weapon', w.name, app.detail ? `${WPOS(w.range)} · 사거리 ${w.range}` : WPOS(w.range), app.detail ? full : brief);
}
/** 지휘관 스킬은 전술 위력으로 계산된다 */
function skillText(d: UnitDef, sk = d.skill.params) {
  if (!app.detail) return ABIL[d.id]?.brief?.skill || BRIEF[d.id]?.skill || d.skill.desc(sk);
  const t = d.skill.desc(sk);
  return d.ctype === 'CMD' ? t.replace(/기술 위력/g, '전술 위력') : t;
}
const traitText = (d: UnitDef) => (app.detail ? d.trait.desc : ABIL[d.id]?.brief?.trait || BRIEF[d.id]?.trait || d.trait.desc);
/** 상세 문장 (docs/ABILITY_TEXT.md): 줄마다 한 문장, 능력치 아이콘 치환 */
const detailHtml = (text: string, ctx: AB.AbilCtx, gl = new Set<string>()) => statIc(AB.detailText(text, ctx, gl));
/** 영입 · 계약 카드의 스킬 블록: 상세 보기 = 상세 문장 (없으면 옛 설명), 아니면 한 줄. 전투 기물이 없으니 전투 유형만 담은 자리표시로 위력 이름(지휘관 = 전술 위력)을 고른다 */
function unitSkillAbil(d: UnitDef) {
  const info = app.detail ? ABIL[d.id]?.skill?.(d.skill.params) : undefined;
  if (!info?.text) return abil('skill', d.skill.name, app.detail ? `${d.skill.cd}초` : '', skillText(d));
  return `<div class="abil ab-skill"><div class="ab-head"><span class="ab-kind">${AB_KIND.skill}</span><b>${esc(d.skill.name)}</b><span class="ab-meta">${d.skill.cd}초</span></div>${detailHtml(info.text, { b: null, c: { ctype: d.ctype, side: 0, isSummon: false, mem: {} } as unknown as CUnit, p: d.skill.params, skill: true, range: d.range })}</div>`;
}
/** 위쪽 바 축성 단추 (편성 중 디바인 · 성유물 장착 시): 권능을 써서 다음 전투의 신권 대행 계수 ×3 (성유물 칸의 축성과 같은 동작) */
function blessBtn(run: RunState, u: UnitState, d: UnitDef) {
  if (d.ttype !== 'divine') return '';
  const rel = u.relic ? RELIC_BY_ID[u.relic] : null;
  if (!rel) return '';
  return `<button class="btn tiny d-bless${u.enh ? ' done' : ''}" data-a="relic-enh" data-v="${u.uid}" title="권능 ${rel.enh}을 써서 다음 전투의 신권 대행 계수를 ×3으로 (보유 권능 ${run.power})" ${u.enh || run.power < rel.enh ? 'disabled' : ''}>${lineIcon('a.divact', 'li')}${u.enh ? '축성됨' : `축성 · 권능 ${rel.enh}`}</button>`;
}
/** 상세 창 상단 고정 바: 닫기(←) · [추가 버튼] · 상세 보기(돋보기) */
function dBar(back: string, extra = '') {
  return `<div class="d-bar"><button class="btn d-back" data-a="${back}" data-v="" aria-label="상세 닫기" title="닫기 (Esc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <span class="d-bar-r">${extra}${magToggle()}</span></div>`;
}
/** 상세 보기 단추 (돋보기 아이콘, 켜면 강조색): 상세 패널 머리 · 기물 선택 · 영입 · 전체 상세 공용 */
function magToggle(cls = '') {
  return `<button class="btn d-mag${cls}${app.detail ? ' on' : ''}" data-a="toggle-detail" aria-pressed="${app.detail}" aria-label="상세 보기 ${app.detail ? '끄기' : '켜기'}" title="상세 보기: 계수 · 세부 규칙 표시 (단축키 D) · ${app.detail ? 'ON' : 'OFF'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg></button>`;
}
function detailToggle() { return magToggle(' d-mag-solo'); }
/** 집중 육성 단추 (전체 상세 머리, 상세 보기 단추 옆): 파티 창 초상화의 표적 단추(.rt-focus)와 같은 동작 · 켜면 선택색 */
function focusBtn(run: RunState, u: UnitState) {
  if (R.isRock(u)) return '';
  const on = !!run.focus?.includes(u.uid);
  return `<button class="btn d-mag-solo d-focus${on ? ' on' : ''}" data-a="focus" data-v="${u.uid}" aria-pressed="${on}" aria-label="집중 육성 ${on ? '해제' : '지정'}" title="${on ? '집중 육성 해제' : `집중 육성 — 지정한 기물들이 공명도 풀의 ${Math.round(CFG.focusXpShare * 100)}%를 먼저 나눠 받고, 나머지는 모든 기물이 함께 나눕니다`}">${lineIcon('u.target', 'li')}</button>`;
}
function unitCard(d: UnitDef, opts: { selected?: boolean; action?: string; rank?: number; clone?: boolean } = {}) {
  return `<button class="ucard ${opts.selected ? 'sel' : ''}" ${opts.clone ? 'aria-hidden="true" tabindex="-1"' : ''} data-a="${opts.action || 'pick-starter'}" data-v="${d.id}">
    ${hero(d.id, 'hero sm')}<div class="ucard-head">${sprite(d, 'spr big')}${nameBlock(d, [...d.factions, ...d.traits], opts.rank, opts.action === 'pick-recruit' ? ownedChip(d.id) : chip)}</div>
    ${unitInfo(d)}
  </button>`;
}
/** 무기 · 특성 · 스킬 · 기본 능력치 */
function unitInfo(d: UnitDef) {
  return `${weaponAbil(d.weapon)}
    ${traitGroup(d, null, app.run)}
    ${unitSkillAbil(d)}
    <div class="majors-mini">${MAJORS.map((m) => `<span title="${MAJOR_NAME[m]}">${majorIcon(m)}<b>${d.base[m]}</b></span>`).join('')}</div>`;
}
/** 역할: 전투 유형 · 전술 유형 (아이콘 + 이름) */
function roleTag(d: UnitDef) {
  return `<span class="pc-role"><span class="ct-${d.ctype}">${CTYPE_ICON(d.ctype)} ${CTYPE_NAME[d.ctype]}</span><span class="tt-${d.ttype}">${TTYPE_ICON(d.ttype)} ${TTYPE_NAME[d.ttype]}</span></span>`;
}
/** 시작 기물 후보 카드: 스탠딩 + 이름 + 역할 + 시너지. 호버(터치는 탭)하면 카드 안에서 설명이 올라온다 */
interface PickOpts { nameExtra?: string; synCount?: (id: string) => number; clone?: boolean; on: boolean; badge?: string; tapAct: string; full?: boolean; fullLabel?: string; chipFn?: (id: string) => string; extra?: string; i?: number }
/** 이 기물이 합류했을 때 시너지별 기물 수 (같은 기물은 1회) */
function teamCount(ids: string[]) {
  const uniq = [...new Set(ids)];
  return (sid: string) => uniq.filter((x) => { const d = UNIT_BY_ID[x]; return d && ([...d.factions, ...d.traits] as string[]).includes(sid); }).length;
}
function pickCard(d: UnitDef, o: PickOpts) {
  const { clone, on, full } = o;
  return `<div class="pslot" style="--i:${Math.min(o.i ?? 0, 7)}"><div class="pcard ${on ? 'sel' : ''} ${app.cardOpen === d.id && !clone ? 'open' : ''}" data-a="${o.tapAct}" data-v="${d.id}" ${clone ? 'aria-hidden="true"' : 'tabindex="0" role="button"'} aria-label="${esc(d.name)}">
    <i class="cback" aria-hidden="true"></i>
    <div class="pc-art">${standImg(d.id, 'stand') || sprite(d, 'spr big')}</div>
    <button class="btn pc-full" data-a="card-max" data-v="${d.id}" ${clone ? 'tabindex="-1"' : ''} title="전체 상세 (확대)" aria-label="${esc(d.name)} 전체 상세 열기">${MAX_SVG}</button>
    ${on ? `<span class="pc-check">✓${o.badge ? ` ${o.badge}` : ''}</span>` : ''}
    <div class="pc-syn">${[...d.factions, ...d.traits].map((id) => synToken(id, o.synCount ? o.synCount(id) : 0)).join('')}</div>
    <div class="pc-panel">
      <div class="pc-top"><div class="pc-nm"><b class="pc-name">${esc(d.name)}</b>${o.nameExtra || ''}</div>${roleTag(d)}${unitBlurb(d) ? `<span class="pc-blurb">${esc(unitBlurb(d))}</span>` : ''}${o.extra || ''}
        <div class="chips">${[...d.factions, ...d.traits].map(o.chipFn || chip).join('')}</div>
        <button class="pc-more" data-a="card-open" data-v="${d.id}" ${clone ? 'tabindex="-1"' : ''}>${app.cardOpen === d.id && !clone ? '접기 ▼' : '상세 보기 ▲'}</button></div>
      <div class="pc-desc" data-a="noop">${unitInfo(d)}
        <button class="btn ${on ? '' : 'primary'} pc-pick" data-a="${o.tapAct}" data-v="${d.id}" ${full ? 'disabled' : ''} ${clone ? 'tabindex="-1"' : ''}>${on ? '선택 해제' : full ? o.fullLabel || '선택 불가' : '선택'}</button></div>
    </div>
  </div></div>`;
}
const CAN_HOVER = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;

// ───────────────────────── 출격 연출: 전장 추첨 → 난이도 → 계약 기물
/** 전장 상성 요약 (적 풀 · 분류 규칙에서 자동 집계): 편성 화면 '상성'과 같은 토큰 줄 (분류 아이콘 · 이름 · 비중 · 취약(초록) / 저항(빨강) / 면역 칩). head = 머리 글씨 */
function matchupHtml(fid: string, head = true) {
  const mu = fieldMatchup(fid);
  const rows = [
    ...mu.cats.map((x) => muRow(lineIcon(`k.${x.c}`, 'li'), CATEGORY_NAME[x.c], `${Math.round(x.share * 100)}%`, muTags(x), `cat-${x.c}`, '', `${CATEGORY_NAME[x.c]}: ${CATEGORY_RULE[x.c]} (적 풀 비중)`)),
    mu.bosses ? muRow(NODE_ICON.boss, NODE_NAME.boss, '', muTag(`${mu.bossImmune.join('·')} 면역`, 'mute'), '', '--c:var(--c-bad)') : '',
  ].join('');
  return rows ? `<div class="mu-box">${head ? '<span class="mu-k">이 전장의 주요 적</span>' : ''}<ul class="pb-rows">${rows}</ul></div>` : '';
}
/** 상성 토큰 줄 (편성 화면 '상성' · 전장 상세 공용): 아이콘 · 이름 · 인원(비중) · 칩들 */
function muRow(icon: string, name: string, cnt: string, tags: string, cls = '', st = '', title = '') {
  return `<li class="pb-row"${title ? ` title="${esc(title)}"` : ''}><i class="pb-ri ${cls}"${st ? ` style="${st}"` : ''}>${icon}</i><b>${esc(name)}</b><span class="pb-cnt">${cnt}</span><span class="pb-tags">${tags}</span></li>`;
}
const muTag = (txt: string, tone: 'good' | 'bad' | 'mute') => tchip('', esc(txt), tone);
/** 분류 하나의 취약 · 저항 · 면역 칩 */
const muTags = (x: { weak: string[]; resist: string[]; immune: string[] }) => [x.weak.length ? muTag(`${x.weak.join('·')} 취약`, 'good') : '', x.resist.length ? muTag(`${x.resist.join('·')} 저항`, 'bad') : '', x.immune.length ? muTag(`${x.immune.join('·')} 면역`, 'mute') : ''].join('');
/** 전장 정보: 적 유형 · 우세 속성 · 우세 시너지 */
function fieldBrief(fid: string) {
  const f = fieldOf(fid);
  const roster = [...f.pool.map((id) => [id, 1] as const), [f.elite, 2] as const, ...f.bosses.map((id) => [id, 3] as const)];
  const ct: Record<string, number> = {}, el: Record<string, number> = {};
  for (const [id, w] of roster) { const e = ENEMY_BY_ID[id]; if (!e) continue; const t = enemyCategory(e); ct[t] = (ct[t] || 0) + w; el[e.atk.elem] = (el[e.atk.elem] || 0) + w; }
  const top = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
  const syn = f.ally ? SYN_BY_ID[f.ally.syn] : null;
  return `<div class="fb-grid">
    <div class="fb-cell"><span class="fb-k">적 분류</span><span class="fb-v">${top(ct, 2).map((c) => `<i class="cat-${c}" title="${CATEGORY_RULE[c as Category]}">${lineIcon(`k.${c}`, 'li')}${CATEGORY_NAME[c as Category]}</i>`).join('')}</span></div>
    <div class="fb-cell"><span class="fb-k">우세 속성</span><span class="fb-v">${top(el, 2).map((e) => `<i>${lineIcon(`e.${e}`, 'li')}${ELEM_NAME[e as Elem]}</i>`).join('')}</span></div>
    <div class="fb-cell"><span class="fb-k">우세 시너지</span><span class="fb-v">${syn ? `<i style="--c:${syn.color}">${synIcon(syn.id) || syn.icon}${esc(syn.name)}</i>` : '<i>없음</i>'}</span></div>
  </div>
  ${matchupHtml(fid)}
  <ul class="fb-rules">${f.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <div class="fb-foes">${[...f.bosses, f.elite, ...f.pool].map((id) => {
    const e = ENEMY_BY_ID[id];
    if (!e) return '';
    const tag = e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '';
    return `<button class="fb-foe-ic tier-${e.tier}" data-a="intro-foe" data-v="${id}" title="${esc(e.name)}">${sprite(e, '')}${tag ? `<em>${tag}</em>` : ''}<i>${esc(e.name)}</i></button>`;
  }).join('')}</div>`;
}
/** 명부 머리 띠 위 전장 정보: 자주 나오는 적 (분류 · 얼굴) · 유리한 시너지 (후보 보장 수). 전장 그림 위에 얹는다 */
function fieldBandInfo(fid: string) {
  const f = fieldOf(fid), ct: Record<string, number> = {};
  for (const [id, w] of [...f.pool.map((id) => [id, 1] as const), [f.elite, 2] as const]) { const e = ENEMY_BY_ID[id]; if (e) ct[enemyCategory(e)] = (ct[enemyCategory(e)] || 0) + w; }
  const cats = Object.entries(ct).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0] as Category);
  const faces = f.pool.slice(0, 4).map((id) => ENEMY_BY_ID[id]).filter(Boolean).map((e) => `<i class="nr-bi-face" title="${esc(e.name)}">${sprite(e, '')}</i>`).join('');
  const syn = fieldSyn(fid), k = starterFavNeed(fid);
  return `<div class="nr-bi-row"><span class="nr-bi-k">자주 나오는 적</span><span class="nr-bi-v">${cats.map((c) => `<i class="nr-bi-cat cat-${c}" title="${esc(CATEGORY_RULE[c])}">${lineIcon(`k.${c}`, 'li')}${CATEGORY_NAME[c]}</i>`).join('')}${faces}</span></div>
    ${syn ? `<div class="nr-bi-row"><span class="nr-bi-k">유리한 시너지</span><span class="nr-bi-v">${chip(syn)}${k ? `<span class="nr-bi-n" title="${esc(`우세 시너지 기물이 후보에 ${k}명 이상 섞여 있습니다`)}">후보 <b>${k}명+</b></span>` : ''}</span></div>` : ''}`;
}
/** 전장 브리핑: 적 초상화를 누르면 1페이즈 기준 상세 (능력 카드 · 설명) */
function foeModal(id: string) {
  const e = ENEMY_BY_ID[id];
  if (!e) return '';
  const b = new Battle(9, 9, new Rng(1), { phase: 1, credits: 0 });
  const c = buildEnemy(b, e, 1, 1);
  return `<div class="modal-bg" data-a="intro-foe" data-v=""><div class="modal foe-modal">
    <div class="detail">${foeHead(e, sprite(e, 'spr big'), unitRank(e, c))}
      ${(() => { const eq = foeGear(e, {}), ms = battleMajors(c)!; return `${eq.length ? `<h3>장비</h3><div class="d-eqbox"><div class="d-eq">${eq.map((x) => `<span class="tk-it">${itemIcon(x, `data-a="foe-item" data-v="${x}"`)}</span>`).join('')}</div></div>` : ''}
      <div class="mj-wrap"><div class="mj-head"><h3>주요 능력치 <span class="muted small">1페이즈 기준 · 체력 ${fmt(b.S(c, 'maxHp'))}</span></h3></div>${majorsHtml(ms, foeAmp(ms, c))}</div>`; })()}
      <h3>능력 <span class="muted small">1페이즈 기준</span></h3><div class="abils">${enemyAbilCards(e, b, c)}</div></div>
    ${app.abilPop ? enemyAbilPop(app.abilPop, e, b, c) : ''}
    <div class="row-btns"><button class="btn primary" data-a="intro-foe" data-v="">닫기</button></div>
  </div></div>`;
}
/** 특권 커튼 연출을 이미 보여 준 런 (시드) */
let pvPlayed: number | null = null;
/** 절망 증강 막을 이미 보여 준 선택 (시드:이미 고른 수) */
let dpPlayed: string | null = null;

function newRunScreen() {
  const n = app.starters.length, sc = CTR.signedContract();
  const fld = fieldOf(app.introField);
  CTR.takeFromSeal();
  // 전장 그림 = 화면 위쪽을 가로지르는 배경 (브리핑 수신 중에는 화면을 채운 태블릿 속, 끝나면 높이가 줄어 이 자리에 내려앉는다 · ui/briefing.ts)
  const title = sc ? sc.contract.title : fld.name;
  return `<main class="wrap nr roster${BRF.BR.on ? ' brief' : ''}">
    ${BRF.bandHtml({ art: bgURL(`field_${fld.id}`), color: fld.color, title, place: fld.name })}
    <div class="nr-head">
      <div class="nr-title"><h2 class="nr-band-t nr-field">「${esc(title)}」 <small>${esc(fld.name)}</small></h2><h1>계약 기물 ${CFG.startUnits}명을 선택하세요</h1></div>
      <div class="nr-side"><div class="nr-band-info">${fieldBandInfo(fld.id)}</div></div>
    </div>
    <div class="carousel">
      <button class="car-btn prev" data-a="car-prev" aria-label="이전 기물">‹</button>
      <div class="car-track" aria-label="후보 기물 (좌우로 넘겨 보기)">${[0, 1, 2].map((k) => app.pool.map((id) => {
        const on = app.starters.includes(id);
        return pickCard(UNIT_BY_ID[id], { i: app.pool.indexOf(id), clone: k !== 1, on, badge: on ? String(app.starters.indexOf(id) + 1) : '', tapAct: 'card-tap', full: !on && app.starters.length >= CFG.startUnits, fullLabel: `이미 ${CFG.startUnits}명 선택` });
      }).join('')).join('')}</div>
      <button class="car-btn next" data-a="car-next" aria-label="다음 기물">›</button>
    </div>
    <div class="nr-foot">
      <div class="picked">${app.starters.map((id) => `<button class="picked-u" data-a="pick-starter" data-v="${id}" title="${esc(UNIT_BY_ID[id].name)} 빼기">${sprite(UNIT_BY_ID[id], 'spr')}</button>`).join('')}${'<span class="picked-u empty"></span>'.repeat(CFG.startUnits - n)}</div>
      <div class="nr-syn syn-list">${(() => { const cnt = teamCount(app.starters); const ids = SYNERGIES.map((x) => x.id).filter((id) => cnt(id) > 0).sort((x, y) => cnt(y) - cnt(x)); return ids.map((id) => synToken(id, cnt(id))).join(''); })()}</div>
      <button class="btn ghost" data-a="ct-back" title="차림표로 돌아가 의뢰 · 약관을 다시 고릅니다 (서명은 무릅니다)">뒤로</button>
      <button class="btn ghost" data-a="random-starters">무작위</button>
      <button class="btn ghost" data-a="reroll-starters" title="고른 기물을 모두 해제하고 후보 ${app.pool.length}명을 새로 뽑습니다. 직전 후보와 겹치지 않게 뽑고, 우세 시너지 기물 보장은 그대로입니다 (단축키 R)" ${app.poolRerolls > 0 ? '' : 'disabled'}>새로고침 (${app.poolRerolls}회)</button>
      <button class="btn primary" data-a="start-run" ${n === CFG.startUnits ? '' : 'disabled'}>출격 (${n}/${CFG.startUnits})</button>
    </div>
  </main>`;
}

// ───────────────────────── 화면: 맵
function mapScreen(run: RunState) {
  const p = run.phase;
  const ha = CFG.diffHpAdd(run.diff || 0), sp = scalePhase(p, !!run.campaign), sp0 = scalePhase(p - 1, !!run.campaign); // 적 성장 페이즈
  const scale = `적 체력 ×${fmt(phaseHpMult(sp, ha))} (이번 페이즈 ×${p > 1 ? (phaseHpMult(sp, ha) / phaseHpMult(sp0, ha)).toFixed(2) : '1'}) · 방어도 ×${Math.pow(CFG.phaseArmor, sp - 1).toFixed(2)} · 피해 ×${phaseAmpMult(sp).toFixed(2)}`;
  const opts = R.currentOptions(run);
  const pick: NodeType | undefined = run.node ? run.node.type : opts.includes(app.nodePick as NodeType) ? (app.nodePick as NodeType) : opts[0];
  const nodeIc = (o: NodeType, i: number) => {
    const uid = o === 'recruit' && i < run.step ? run.nodeUnits?.[i] : undefined;
    return uid && UNIT_BY_ID[uid] ? sprite(UNIT_BY_ID[uid], 'spr tl-pt') : NODE_ICON[o];
  };
  const track = run.map.map((opts2, i) => {
    const state = i < run.step ? 'done' : i === run.step ? 'cur' : 'next';
    const shown = i < run.step && run.picked[i] ? [run.picked[i]!] : opts2;
    const nodes = shown.map((o, k) => {
      const nm = o === 'recruit' && i < run.step && run.nodeUnits?.[i] ? `${NODE_NAME[o]} · ${UNIT_BY_ID[run.nodeUnits[i]]?.name}` : NODE_NAME[o];
      if (state === 'cur' && !run.node) return `<button class="tl-node n-${o}${o === pick ? ' on' : ''}" data-a="tl-pick" data-v="${o}" data-step="${i}" data-node="${o}" title="${esc(nm)} (단축키 ${k + 1})" aria-pressed="${o === pick}">${nodeIc(o, i)}</button>`;
      return `<span class="tl-node n-${o}${state === 'cur' ? ' on' : ''}" data-step="${i}" data-node="${o}" role="button" tabindex="0" title="${esc(nm)}">${nodeIc(o, i)}</span>`;
    }).join('');
    return `<li class="tl-step ${state}${opts2.includes('boss') ? ' tl-boss' : ''}"><span class="tl-num">${i + 1}</span><div class="tl-nodes">${nodes}</div></li>`;
  }).join('');
  const enter = run.node?.type === 'shop' // 상점 칸 진행 중 (닫고 나왔거나 불러옴): 다시 열기 · 이 칸 끝내기
    ? `<button class="btn primary tl-go" data-a="resume" title="같은 상인 · 같은 진열로 다시 엽니다">${run.node.synth ? '합성 공방 열기' : '상점 열기'}</button><button class="btn tl-leave" data-a="leave-shop" title="이 칸을 끝내고 다음 칸으로">떠나기</button>`
    : run.node
    ? `<button class="btn primary tl-go" data-a="resume" title="${esc(NODE_NAME[run.node.type])} 계속하기">계속하기</button>`
    : pick ? `<button class="btn primary tl-go" data-a="enter" data-v="${pick}" title="단축키 Enter">${FIGHT_NODES.includes(pick) ? (pick === 'boss' ? '보스전 진입' : '전투 진입') : `${esc(NODE_NAME[pick])} 진입`}</button>`
    : '<button class="btn primary tl-go" disabled>항로 끝</button>'; // 튜토리얼: 보스 뒤
  const f = fieldOf(run.field);
  const pet = tierOf('PET', synergyCounts(deployed(run), run).PET || 0);
  return `<main class="wrap map">
    <aside class="side left">
      <h2>시너지</h2><div class="syn-list">${synergyPanel(run)}</div>
    </aside>
    <section class="map-main${RM.routeMapOn(run) ? ' has-rmap' : ''}">
      <div class="screen-head map-head"><h1>${run.lab ? '에란테스 훈련장' : run.campaign ? esc(campChapter(run).name.split(' · ')[0]) : `페이즈 ${p}`}</h1>${run.campaign ? campTimeChip(run) : ''}${bossGoal(run)}</div>
      ${RM.routeMapOn(run) ? '<div class="rmap-host"></div>' : ''}<div class="tl"><ol class="tl-track">${track}</ol></div>
      <p class="map-scale" title="이번 페이즈 적 강도 (페이즈마다 누적)">${scale}</p>
      ${mapAhead(run, pick, enter)}
      ${run.lab ? '' : shipPanel(run, pet >= 2 ? `<button class="btn ship-loan" data-a="loan" ${run.loan ? 'disabled' : ''}>페트라 대출 ${CR}+25 · 상환 30</button>` : '')}
    </section>
    <aside class="side side-tabs${app.sel?.k === 'unit' || app.sel?.k === 'king' ? ' has-detail' : ''}">${mapDetail(run)}
      <div class="st-tabs" role="tablist">${['파티', '환경', '기록'].map((t, i) => `<button role="tab" class="st-tab" data-a="map-tab" data-v="${i}" aria-selected="${app.mapTab === i}">${t}</button>`).join('')}<span class="st-ink" style="--i:${app.mapTab}"></span></div>
      <div class="st-view"><div class="st-track" style="--i:${app.mapTab}">
      <section class="st-pane" role="tabpanel" aria-label="파티">
      <h2>파티 <span class="muted small">출전 ${deployed(run).length}/${R.deployCap(run)} · 보유 ${run.units.length}/${CFG.maxParty}</span></h2>
      <div class="party">${run.units.map(rosterTile).join('')}</div>
      <h2>보관함 <span class="muted small">${run.inventory.length}개</span></h2>
      ${run.inventory.length ? `<div class="inv-strip">${invGroups(run).map(({ i, all }) => itemIcon(run.inventory[i], '', '', all.length)).join('')}</div>` : '<p class="muted small">보관 중인 장비가 없습니다.</p>'}
      </section>
      <section class="st-pane" role="tabpanel" aria-label="환경">
      <div class="env-hero" style="--c:${fieldOf(run.field).color};background-image:url('${bgURL(`field_${fieldOf(run.field).id}`)}'), linear-gradient(165deg, color-mix(in srgb, ${fieldOf(run.field).color} 40%, #0b0d14), #0b0d14 75%)"><span class="env-kicker">현재 전장</span><b>${esc(fieldOf(run.field).name)}</b><span>${esc(fieldOf(run.field).region)}</span></div>
      <button class="field-btn" data-a="field-info" title="전장 브리핑 다시 보기">${fieldCard(run, true)}</button>
      ${kingEnv(run)}
      ${run.quests.length ? `<h2>헬레니우스 퀘스트</h2><ul class="quests">${run.quests.map((q) =>
        `<li class="${q.done ? 'done' : ''}">${esc(R.questText(q))} <span class="muted">${Math.min(q.progress, q.target)}/${q.target} · 보상 ${R.questRewardText(q)}</span></li>`).join('')}</ul>` : ''}
      ${run.privilege ? `<h2>특권</h2><ul class="globals"><li><b>${esc(R.privilegeName(run.privilege))}</b> <span class="muted">${esc(R.privilegeDesc(run.privilege))}</span></li></ul>` : ''}
      ${CTR.contractEnv(run)}${despairEnv(run)}${OATH.oathEnv(run)}
      ${run.boons.length || run.phaseBoons.length || run.mods.nodeIncome || run.mods.interestCap ? `<h2>사건 효과</h2><ul class="globals">${run.boons.map((id) => `<li><b>${esc(BOONS[id]?.name || id)}</b> <span class="muted">영구</span></li>`).join('')}${run.phaseBoons.map((id) => `<li><b>${esc(BOONS[id]?.name || id)}</b> <span class="muted">이번 페이즈</span></li>`).join('')}${run.mods.nodeIncome ? `<li><b>분할 정산</b> <span class="muted">노드마다 크레딧 +${run.mods.nodeIncome}, 이자 상한 ${run.mods.interestCap}</span></li>` : ''}</ul>` : ''}
      ${run.globals.length ? `<h2>전역 증강</h2><ul class="globals">${run.globals.map((g) => `<li><b>${esc(GLOBAL_BY_ID[g].name)}</b> <span class="muted">${ic(esc(GLOBAL_BY_ID[g].desc))}</span></li>`).join('')}</ul>` : ''}
      </section>
      <section class="st-pane" role="tabpanel" aria-label="기록">
      <h2>기록</h2>
      <ul class="log">${run.log.slice(0, 40).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      </section>
      </div></div>
    </aside>
    ${app.sel?.k === 'unit' ? statPopHtml(run) : ''}
  </main>`;
}
/** 캠페인 지도 머리: 남은 AH(접근시간) · 정산 구간 */
function campTimeChip(run: RunState) {
  const c = run.campaign!, ch = campChapter(run), st = CAMP_SETTLE[ch.ch] || [];
  const next = st.find((s) => c.time >= s.from);
  const tip = `AH(접근시간) ${c.time} / ${c.timeMax} — 고른 행동에만 든다. 장 정산: ${st.filter((s) => s.cr).map((s) => `${s.from} 이상 +${s.cr}`).join(' · ')}`;
  return `<span class="camp-time${c.time < 8 ? ' low' : ''}" title="${esc(tip)}">${lineIcon('r.ah', 'li')}<span>AH</span><b>${c.time}</b><small>/${c.timeMax}</small>${next?.cr ? `<em>정산 +${next.cr}</em>` : ''}</span>`;
}
/** 지도 환경 탭: 청라공국 · 인과율 (인과율이 있거나 청라가 켜져 있을 때) */
function kingEnv(run: RunState) {
  if (!run.causal && !kingOn(run)) return '';
  const pts = run.causal || 0, n = causalStage(pts), lf = causalLeft(pts), t = chrTier(run), g = causalGain(run, t);
  return `<h2>청라공국 · 인과율</h2><ul class="globals"><li><button class="pill-btn" data-a="king-info"><b>공왕 무휼 · 인과 ${n}단계</b></button> <span class="muted">${lf ? `다음까지 ${lf}` : '최고 단계'} · 누적 ${pts}</span></li>
    <li><b>수집</b> <span class="muted">청라 ${t ? `×${CAUSAL.mult[t]}` : '꺼짐 (3명부터)'} · 장비 점수 ${gearScore(run)}${t ? ` · 다음 승리 +${g.total} (장비 +${g.gear})` : ''}</span></li>
    <li><b>단계 효과</b> <span class="muted">${esc(kingStageText(n))}</span></li></ul>`;
}
/** 메인 화면 상세 보기: 파티 아이콘을 누르면 오른쪽 패널(파티 · 환경 · 기록 자리)에 기물 상세가 열린다 */
let lastMapDetail: string | null = null;
function mapDetail(run: RunState) {
  const sel = app.sel;
  if (sel?.k === 'king') {
    const fresh = lastMapDetail !== 'king';
    lastMapDetail = 'king';
    return `<aside class="map-detail${fresh ? ' in' : ''}" aria-label="무휼 상세">${kingDetail(run, dBar('map-unit'))}</aside>`;
  }
  const u = sel?.k === 'unit' ? run.units.find((x) => x.uid === sel.uid) : undefined;
  if (!u) { lastMapDetail = null; return ''; }
  const fresh = lastMapDetail !== u.uid;
  lastMapDetail = u.uid;
  return `<aside class="map-detail${fresh ? ' in' : ''}" aria-label="${esc(UNIT_BY_ID[u.defId].name)} 상세">
    ${detailPanel(run, `<button class="btn tiny" data-a="manage" data-v="${u.uid}">편성 화면에서 보기</button>`).replace('data-a="desel"', 'data-a="map-unit"')}
  </aside>`;
}
/** 함선 관리: 함대 확장 (출전 인원) · 지정 소집 (시너지 지정 영입).
 *  칸 진행 중이면 둘 다 막힌다 — 단, 상점 칸을 닫고 나온 동안의 지정 소집은 티켓으로 할 수 있다 (R.musterBlock, 상인 · 진열은 그대로) */
function shipPanel(run: RunState, extra = '') {
  const fc = R.fleetCost(run), mc = R.musterCost(run), busy = !!run.node || run.pending.length > 0, tk = R.ticketCount(run); // tk: 지정 소집 티켓 (유이 전용 상품) — 있으면 소집 비용 0
  const full = run.units.length >= CFG.maxParty, mBlock = R.musterBlock(run), inShop = run.node?.type === 'shop' && !run.pending.length;
  const mSub = full ? `보유 한도 ${CFG.maxParty}명` : inShop ? (tk ? '상점 중 · 티켓으로 소집' : '상점 중 · 티켓만 가능') : `시너지 ${CFG.musterPicks}개를 골라 그 안에서 영입`;
  return `<section class="ship" aria-labelledby="ship-h"><h2 id="ship-h">함선 관리</h2><div class="ship-grid">
    <button class="ship-btn" data-a="fleet" ${fc === null || run.credits < fc || busy ? 'disabled' : ''}${busy ? ` title="${esc(run.node ? '진행 중인 칸을 끝낸 뒤' : '진행 중인 선택을 먼저 끝내세요')}"` : ''}>
      <span class="sb-ic">${NODE_ICON.supply}</span><b>함대 확장</b>
      <span class="small muted">출전 인원 ${R.deployCap(run)} → ${fc === null ? '최대' : R.deployCap(run) + 1}명</span>
      <span class="sb-cost">${fc === null ? '최대 규모' : `${CR}${fc}`}</span></button>
    <div class="ship-cell">${SHOP.adHtml(run)}<button class="ship-btn" data-a="muster-open" ${mBlock ? `disabled title="${esc(mBlock)}"` : ''}>
      <span class="sb-ic">${NODE_ICON.recruit}</span><b>지정 소집</b>
      <span class="small muted">${mSub}</span>
      <span class="sb-cost${tk ? ' tk' : ''}"${tk ? ` title="${esc(`${CONSUMABLES[R.TICKET].name} ${tk}장 — 크레딧 대신 1장`)}"` : ''}>${tk ? `${CR}<s>${mc}</s><b>0</b><small>${itemIcon(R.TICKET)}×${tk}</small>` : `${CR}${mc}`}</span></button></div>
  </div>${extra}</section>`;
}
function musterModal(run: RunState) {
  const sel = app.musterSel;
  const pool = sel.length ? R.musterPool(run, sel) : [];
  const ok = R.musterSyns();
  const owned = new Set(run.units.flatMap((u) => [...UNIT_BY_ID[u.defId].factions, ...UNIT_BY_ID[u.defId].traits]));
  const group = (kind: string, title: string) => `<h3>${title}</h3><div class="ms-grid">${SYNERGIES.filter((s) => s.kind === kind && ok.includes(s.id) && R.musterPool(run, [s.id]).length).map((s) => {
    const on = sel.includes(s.id), n = R.musterPool(run, [s.id]).length;
    return `<button class="ms-syn${on ? ' on' : ''}${owned.has(s.id as never) ? ' own' : ''}" style="--c:${s.color}" data-a="muster-tog" data-v="${s.id}" aria-pressed="${on}" title="${esc(s.name)}" aria-label="${esc(s.name)} ${n}명" ${!on && sel.length >= CFG.musterPicks ? 'disabled' : ''}>
      <span class="syn-dia"><i>${synIcon(s.id) || s.icon}</i></span><span class="ms-n">${n}</span></button>`;
  }).join('')}</div>`;
  const full = sel.length === CFG.musterPicks;
  // 고른 시너지 칸 (musterPicks 칸, 누르면 빼기) + 후보 수: 아래 고정 줄에 둔다
  const picks = [...Array(CFG.musterPicks).keys()].map((i) => {
    const s = sel[i] ? SYN_BY_ID[sel[i] as SynergyId] : null;
    return s ? `<button class="ms-pick on" style="--c:${s.color}" data-a="muster-tog" data-v="${s.id}" title="${esc(s.name)} 빼기"><span class="syn-dia"><i>${synIcon(s.id) || s.icon}</i></span><b>${esc(s.name)}</b></button>`
      : `<span class="ms-pick" title="빈 칸 — 위에서 시너지를 고르세요"><span class="muted">${i + 1}</span></span>`;
  }).join('');
  return `<h1>지정 소집</h1>
    <div class="ms-legend small muted"><span><i class="ms-syn ms-demo"><span class="ms-n">5</span></i>후보 수</span><span><i class="ms-syn ms-demo own" style="--c:var(--c-text)"></i>보유 중인 시너지</span></div>
    ${group('faction', '세력')}${group('trait', '특성')}
    <div class="row-btns ms-foot"><div class="ms-state"><div class="ms-picks" aria-label="고른 시너지 ${sel.length}/${CFG.musterPicks}">${picks}</div>
      ${kvChip('후보', sel.length ? `<b>${pool.length}</b>명` : '<b>—</b>', `고른 시너지 중 하나라도 가진 기물이 후보 (${CFG.musterPicks}개를 모두 골라야 소집)`, full ? '' : 'zero')}</div>
      <button class="btn" data-a="muster-cancel">취소</button>
      <button class="btn primary" data-a="muster-ok" ${full && pool.length ? '' : 'disabled'}>소집 ${R.ticketCount(run) ? `${CR}<s>${R.musterCost(run)}</s> 0 · 티켓 1장` : `${CR}${R.musterCost(run)}`}</button></div>`;
}
/** 보급 미리보기: 카드 수 · 지금 기준 합계 가치 (run.ts supplyBase, 크레딧 환산) */
/** route: 항로에 놓인 보급 노드 (첫 장 재료 확정 · 대박 없음) / 아니면 분기점 보급 */
const supplyHint = (run: RunState | null, route = false) => `보급품 ${CFG.supply.cards}장 모두 받기 (${route ? '첫 장 장비 재료 확정, 나머지 ' : ''}크레딧 · 공명도 · 장비 무작위)${run ? ` · 합계 가치 약 ${Math.round(R.supplyBase(run))} 크레딧어치` : ''}${route ? ' · 대박 없음' : ` · 장마다 대박 ${jackpotTxt()}`}`;
function nodeHint(o: NodeType) {
  return ({
    battle: '공명도 · 크레딧 · 재료 확률', adversity: `적 ×${CFG.adversityMult} · 보상 ${CFG.adversityReward}배 + 장비 재료 ${CFG.drop.advParts}개 확정`,
    council: `전역 증강 3장 중 택1 · 새로고침 ${CFG.globalRerolls}회`, shop: `분기점 — 상점 / 보급 / 모집 (+ ${SYN_BY_ID.STAR.name} 속보 · 호이슌 투자 · 순례)`,
    supply: supplyHint(app.run, true), recruit: '새 동료 3명 중 택1', boss: `${app.run && R.bossMustWin(app.run) ? '의뢰의 마지막 보스 · 이길 때까지 다시 싸운다' : `승리 시 페이즈 클리어 · 패배해도 다음 페이즈로 (체력 -${CFG.bossLossDamage(app.run?.phase || 1)})`} · ${CFG.drop.bossAdvEvery}페이즈마다 희귀 장비`,
    pilgrim: '신앙 획득 + 이번 페이즈 축복 선택', news: '명성을 보상으로 교환', invest: '호이슌 투자 상품 · 크레딧으로 문장 · 증강 · 다음 페이즈 수익', event: '전장에 얽힌 사건 · 선택에 따라 판이 바뀝니다',
    fork: `갈림길 — 휴식(체력 +${CFG.forkRestHp} + 잃은 체력 ${Math.round(CFG.forkRestLost * 100)}%) 또는 도전(다음 페이즈 역경급 전투, 승리 시 다음 페이즈로)`,
    challenge: '다음 페이즈 역경 수준의 전투 · 승리 시 남은 노드 보상을 받고 다음 페이즈로',
  } as Record<NodeType, string>)[o] || '';
}
/** 이번 페이즈 보스: 전장의 보스는 페이즈마다 순환한다 (조우 생성과 같은 규칙) */
const phaseBoss = (run: RunState): EnemyDef | undefined => { if (run.campaign) return ENEMY_BY_ID[campBoss(run)]; const f = fieldOf(run.field); return ENEMY_BY_ID[f.bosses[(run.phase - 1) % f.bosses.length]]; };
const FIGHT_NODES: NodeType[] = ['battle', 'adversity', 'challenge', 'boss'];
/** 지도: 보스 칸까지 남은 전투 수 (지금 칸 포함, 보스 제외) · 남은 칸 · 전환 칸 수. 실제 지도(run.map)와 이미 고른 노드에서 센다 */
function toBoss(run: RunState) {
  const bi = run.map.findIndex((o, i) => i >= run.step && o.includes('boss'));
  if (bi < 0) return null;
  let fights = 0, forks = 0;
  for (let i = run.step; i < bi; i++) {
    const o = run.picked[i] ? [run.picked[i]!] : run.map[i];
    if (o.every((x) => FIGHT_NODES.includes(x))) fights++;
    else if (o.includes('fork')) forks++;
  }
  return { bi, fights, forks, steps: bi - run.step };
}
/** 지도 머리: 런의 목표(이번 페이즈 보스)까지 남은 전투 */
function bossGoal(run: RunState) {
  const t = toBoss(run);
  if (!t) return '';
  const e = phaseBoss(run);
  const txt = t.steps === 0 ? `<b>보스전</b>` : `보스까지 남은 노드 <b>${t.steps}</b>개`;
  return `<div class="boss-goal" title="${esc(`${t.bi + 1}번째 칸 · ${e?.name || NODE_NAME.boss} · 보스까지 전투 ${t.fights}회${t.forks ? ` (${NODE_NAME.fork}에서 ${NODE_NAME.challenge} 승리 시 지름길)` : ''}`)}"><span class="bg-ic">${e ? sprite(e, 'spr') : NODE_ICON.boss}</span><span class="bg-main">${txt}</span></div>`;
}
/** 지도 미리보기: 현재 칸 + 다음 2칸 (보스는 그 안에 들어올 때만 — 남은 노드 수는 페이즈 옆 보스 칩).
 *  현재 칸 설명은 노드 유형 설명(data/nodes.ts NODE_DESC), 다음 칸 설명은 nodeHint, 재료 확률은 설정 · 전장값, 보스는 적 데이터에서 읽는다 */
function mapAhead(run: RunState, pick: NodeType | undefined, buttons: string) {
  const tb = toBoss(run);
  const idx: number[] = [];
  for (let i = run.step + 1; i < Math.min(run.map.length, run.step + 2); i++) if (!tb || i <= tb.bi) idx.push(i); // 현재 칸 + 다음 칸만
  const f = fieldOf(run.field);
  const PART = lineIcon('r.part', 'li'), CONS = lineIcon('r.cons', 'li');
  // 모디파이어 (현재 칸만, 둥근 칸 · 아이콘 + 값, 설명은 툴팁): 규칙 수치만 — 적 강화 배율 · 보상 배율 (설정값) · 위험 등급 적 증원 (해골 +n) · 정예 확정 (역경 · 도전). 적 개체(초상 · 이름)는 넣지 않는다
  const mod = (icon: string, val: string, title: string, cls = '') => `<span class="ah-md ${cls}" title="${esc(title)}">${icon}${val ? `<b>${val}</b>` : ''}</span>`;
  const mods = (o: NodeType) => {
    const tc = run.campaign ? CAMP_TIME_COST[o] || 0 : 0; // 캠페인: 이 칸에 드는 AH
    const tChip = tc ? mod(lineIcon('r.ah', 'li'), `-${tc}`, `AH -${tc} (남은 ${run.campaign!.time} → ${run.campaign!.time - tc})`, 'bad') : '';
    if (!FIGHT_NODES.includes(o)) return tChip ? `<div class="ah-mods" aria-label="모디파이어"><span class="ah-sec">AH</span>${tChip}</div>` : '';
    const m: string[] = tChip ? [tChip] : [];
    const ph = o === 'challenge' ? run.phase + 1 : run.phase;
    if (o === 'adversity' || o === 'challenge') m.push(mod(lineIcon('m.up', 'li'), `×${CFG.adversityMult}`, `적 강화: 체력 ×${CFG.adversityMult} · 피해 ×${+encDmgMult(CFG.adversityMult).toFixed(2)}`, 'bad'));
    const add = run.campaign ? 0 : diffAddCount(run.diff, ph) + OATH.hordeAdd(run); // 위험 등급 증원 + 군세의 서약 (캠페인은 없음)
    if (add > 0) m.push(mod(lineIcon('m.skull', 'li'), `+${add}`, `적 수량 +${add} — ${[diffAddRule(run.diff) && `위험 등급 ${run.diff} 적 증원: ${diffAddRule(run.diff)}`, OATH.hordeAdd(run) && `군세의 서약 +${OATH.hordeAdd(run)}`].filter(Boolean).join(' · ')}`, 'bad'));
    if ((o === 'adversity' || o === 'challenge') && f.elite) m.push(mod(lineIcon('m.elite', 'li'), '정예', `정예 확정: ${NODE_NAME[o]} 전투에는 이 전장의 정예가 반드시 나온다`, 'bad tx'));
    if (o === 'adversity') m.push(mod(lineIcon('m.gift', 'li'), `×${CFG.adversityReward}`, `보상 강화: 승리 크레딧 · 공명도 ×${CFG.adversityReward}`, 'good'));
    for (const dsp of despairsOf(run)) { const dv = dsp.mod?.(o === 'boss'); if (dv) m.push(mod(lineIcon(dsp.icon, 'li'), dv, `절망 증강 [${dsp.name}]: ${dsp.desc()}`, 'bad despair')); } // 절망 증강 (이 전투에 걸리는 것만, 고른 순서)
    return m.length ? `<div class="ah-mods" aria-label="모디파이어"><span class="ah-sec">모디파이어</span>${m.join('')}</div>` : '';
  };
  // 예상 수입 (현재 칸만, 네모 칸 · 아이콘 + 숫자): 승리 시 공명도 풀 · 크레딧 (엔진의 보상 계산 battleRewardPreview) + 장비 · 재료 · 소모품 (×n = 확정, % = 확률, 설정값 · 전장 배율)
  const inc = (icon: string, val: string, title: string, cls = '') => `<span class="ah-in ${cls}" title="${esc(title)}">${icon}<b>${val}</b></span>`;
  const income = (o: NodeType) => {
    if (!FIGHT_NODES.includes(o) || run.lab) return ''; // 훈련장: 보상이 없다
    const t: NodeType = o === 'challenge' ? 'adversity' : o; // 도전은 보상 · 전리품을 역경 기준으로
    const r = R.battleRewardPreview(run, o);
    const out = [inc(RES, String(r.xp.win), '공명도 풀 (승리 시) — 출전 · 대기 기물에게 나눠 줌'), inc(CR, `+${r.credits.win}`, `크레딧 수입 (승리 시) — 승리 보상 · 연승 · 이자 +${r.credits.interest} 등`)];
    if (t === 'battle') out.push(inc(PART, pctTxt(Math.min(1, CFG.drop.battle * (f.dropMul || 1))), '무작위 장비 재료 1개 — 확률', 'g-C'));
    if (t === 'adversity') out.push(inc(PART, `×${CFG.drop.advParts}`, '무작위 장비 재료 — 확정', 'g-C'));
    if (t === 'boss') out.push(run.phase % CFG.drop.bossAdvEvery === 0 ? inc(PART, '×1', '희귀 장비 3개 중 1개 선택 — 확정', 'g-A') : inc(PART, pctTxt(CFG.drop.bossPart), '장비 재료 3개 중 1개 선택 — 확률', 'g-C'));
    if (CFG.drop.utility[t]) out.push(inc(CONS, pctTxt(CFG.drop.utility[t]), '전투 보상 소모품 1개 — 확률', 'cons'));
    return `<div class="ah-inc" aria-label="예상 수입"><span class="ah-sec">예상 수입</span>${out.join('')}</div>`;
  };
  // 순서 배지: 현재 · 다음 노드 (다음 노드는 그 노드 고유 색 --nc, 몇 번째 칸인지는 툴팁)
  const step = (i: number) => (i === run.step ? '<span class="ah-step now">현재</span>' : `<span class="ah-step nxt" title="${i + 1}번째 칸">다음 노드</span>`);
  // 다음 칸 카드의 이름 밑 설명 (작은 보조 글씨): nodeHint 원문을 가운데 점 ' · ' 기준으로 나눠 조각마다 한 줄 (괄호 안의 점은 그대로)
  const lines = (t: string) => {
    const out: string[] = [];
    let depth = 0, from = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') depth--;
      else if (!depth && t.startsWith(' · ', i)) { out.push(t.slice(from, i)); from = i + 3; i += 2; }
    }
    return [...out, t.slice(from)].filter((x) => x.trim());
  };
  const desc = (t: string) => `<span class="ah-desc">${lines(t).map((x) => `<span>${ic(esc(x))}</span>`).join('')}</span>`;
  // 현재 칸 카드의 이름 밑 설명 한 줄: 이 노드가 무엇인지 (노드 유형 설명, 수치 없음 — 수치는 아래 예상 수입 · 모디파이어 섹션)
  const about = (o: NodeType) => `<span class="ah-desc ah-about">${ic(esc(NODE_DESC[o]))}</span>`;
  // 현재 칸 단추: 카드 오른쪽 위에 고정 (내용 길이와 무관)
  const act = (cur: boolean) => (cur ? `<div class="ah-act">${buttons}</div>` : '');
  // 현재 칸 카드: 이름 → 노드 설명 한 줄 → (보스는 특징 칩) → 예상 수입 → 모디파이어. 다음 칸 카드: 이름 → nodeHint 여러 줄 (보스는 특징 칩)
  const bossCard = (i: number, e: EnemyDef, cur: boolean) => {
    const cat = enemyCategory(e), td = TEND_NAME[e.tend], rk = foeRank(run, e, run.phase, R.encounterMult('boss', i, !!run.campaign));
    return `<li class="ah-card ah-boss n-boss${cur ? ' cur tl-info' : ''}" title="${esc(`${e.name} — ${ENEMY_DESC[e.id] || ''}`)}">${act(cur)}<span class="ah-lead"><span class="ah-port">${sprite(e, 'spr big')}<i class="ah-ic">${NODE_ICON.boss}</i></span>${step(i)}</span>
      <div class="ah-body"><b>${esc(e.name)}</b>${cur ? about('boss') : desc(`${NODE_NAME.boss} · ${nodeHint('boss')}`)}<div class="ah-chips">${rankChip(rk)}${R.bossMustWin(run) ? tchip(lineIcon('m.elite', 'li'), '최종 보스', 'bad', '의뢰의 마지막 보스: 이길 때까지 다시 싸운다 (다른 보스는 져도 다음 페이즈로)') : ''}${tchip(lineIcon(`k.${cat}`, 'li'), CATEGORY_NAME[cat], `cat-${cat}`, `${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}`)}${td ? tchip(lineIcon(`t.${e.tend}`, 'li'), td.name, '', `${td.name}: ${td.desc}`) : ''}</div>${cur ? `${income('boss')}${mods('boss')}` : ''}</div></li>`;
  };
  const nodeCard = (i: number, o: NodeType, cur: boolean) => {
    const e = o === 'boss' ? phaseBoss(run) : undefined;
    if (e) return bossCard(i, e, cur);
    const note = cur && run.node ? '<span class="ah-hint">진행 중</span>' : '';
    const mc = cur ? SHOP.merchantOf(run) : null; // 진행 중인 상점: 상인 이름
    return `<li class="ah-card n-${o}${cur ? ' cur tl-info' : ''}">${act(cur)}<span class="ah-lead"><i class="ah-ic">${NODE_ICON[o]}</i>${step(i)}</span><div class="ah-body"><b>${esc(NODE_NAME[o])}${mc ? ` · ${esc(mc.name)}` : ''}</b>${cur ? `${about(o)}${income(o)}${mods(o)}` : desc(nodeHint(o))}${note}</div></li>`;
  };
  // 현재 칸 (진입 단추 포함, 강조) → 다음 칸들: 같은 카드 토큰으로 한 흐름
  const cur = pick ? nodeCard(run.step, pick, true)
    : `<li class="ah-card cur tl-info">${act(true)}<span class="ah-lead"><i class="ah-ic">${NODE_ICON.boss}</i>${step(run.step)}</span><div class="ah-body"><b>항로 끝</b><span class="ah-hint">이번 항로의 모든 칸을 지났습니다.</span></div></li>`;
  return `<section class="ahead" aria-label="현재 칸과 앞으로 올 칸"><ol class="ah-list">${cur}${idx.flatMap((i) => run.map[i].includes('boss') ? [nodeCard(i, 'boss', false)] : run.map[i].map((o) => nodeCard(i, o, false))).join('')}</ol></section>`;
}
// ───────── 적 스펙 ≈ 공명 등급: 적의 공격 위력을 '장비 · 시너지 · 증강 없는 아군(영입 가능 기물 평균)'의 등급별 위력과 비교해 가장 가까운 등급
//   위력 = 사격 · 타격 · 기술 중 큰 값 (적은 × 페이즈 피해 배율). 아군 등급 성장은 설정값 그대로 (모든 메이저 +rankAll, 마이너 추천 메이저 rankPoints, 위력 rankPowGrowth)
//   체력은 비교 기준에 넣지 않는다: 적 체력은 여럿이 한 적을 치는 전제로 페이즈마다 곱으로 커져 등급(한 기물 +1씩)과 맞지 않는다 → 같은 등급 아군 대비 배수로 따로 보여 준다
const allyRefs: { hp: number; pow: number }[] = [];
function allyRef(rank: number) {
  if (allyRefs[rank]) return allyRefs[rank];
  let hp = 0, pow = 0;
  for (const d of RECRUITABLE) {
    const alloc = Object.fromEntries(MAJORS.map((m) => [m, 0])) as Record<Major, number>;
    for (let r = 2; r <= rank; r++) {
      for (const m of MAJORS) alloc[m] += CFG.rankAll;
      if (CFG.growth.pick(d.ttype, r)) for (const m of recommendedMajors(d).slice(0, CFG.rankPicks)) alloc[m] += CFG.rankPoints;
    }
    const { st } = computeStats({ defId: d.id, rank, alloc, perm: Object.fromEntries(MAJORS.map((m) => [m, 0])) } as unknown as UnitState, []);
    hp += st.maxHp; pow += Math.max(st.shoot, st.strike, st.tech);
  }
  return (allyRefs[rank] = { hp: hp / RECRUITABLE.length, pow: pow / RECRUITABLE.length });
}
function foeRank(run: RunState, e: EnemyDef, phase: number, mult: number, s?: { items?: string[]; mod?: string }) {
  return unitRank(e, buildEnemy(new Battle(9, 9, new Rng(1), { phase, credits: 0, camp: !!run.campaign, field: run.field, diff: run.diff, despairs: run.despairs, oaths: run.oaths }), e, phase, mult, s));
}
/** 적 유닛(편성 미리보기 · 전투 중)의 공명 등급 추정 */
function unitRank(e: EnemyDef, c: CUnit) {
  const pow = Math.max(c.st.shoot, c.st.strike, c.st.tech) * c.phaseAmp;
  if (e.noAttack || !(pow > 0)) return null; // 공격하지 않는 장애물 · 지원 드론
  let lv = 1;
  while (lv < CFG.maxRank && allyRef(lv + 1).pow <= pow) lv++; // 위력은 등급에 따라 늘기만 한다
  if (lv < CFG.maxRank && allyRef(lv + 1).pow - pow < pow - allyRef(lv).pow) lv++; // 더 가까운 쪽
  return { lv, hpX: c.st.maxHp / allyRef(lv).hp };
}
const rankTip = (r: { lv: number; hpX: number }) => `공명 등급 ★${r.lv} 수준 (추정): 공격 위력이 장비 · 시너지 없는 ★${r.lv} 아군 평균과 비슷 · 체력은 그 아군의 ×${r.hpX >= 10 ? Math.round(r.hpX) : r.hpX.toFixed(1)}`;
const rankChip = (r: { lv: number; hpX: number } | null) => (r ? `<span class="rank foe-rank" title="${esc(rankTip(r))}">${rankLabel(r.lv)}</span>` : ''); // 아군 공명 등급과 같은 흰 배지
/** 자원 아이콘: 에너지 크레딧 · 공명도 */
const CR = lineIcon('r.cr', 'li cr'), RES = lineIcon('r.res', 'li res'), AH = lineIcon('r.ah', 'li ah');
/** 문장 속 '크레딧' · '공명도' 앞에 아이콘 (이미 escape 된 HTML 에만) */
const ic = (html: string) => html.replace(/(?<![A-Za-z])AH(?![A-Za-z])/g, `${AH}AH`).replace(/(에너지 크레딧|크레딧)/g, `${CR}$1`).replace(/공명도/g, `${RES}공명도`);
/** 공명 등급 표기: 별 아이콘 + 숫자 */
const RANK_STAR = '<svg class="rstar" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.4l-6.1 3.5 1.5-6.8-5.2-4.6 6.9-.7z"/></svg>';
const rankLabel = (rank: number) => `${RANK_STAR}${rank}`;
/** 파티 타일: 초상화(좌상단 문장 · 우상단 유형 · 좌하단 공명 등급) · 장비 */
function rosterTile(u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  const run = app.run;
  const locked = !!run && u.lock === run.phase;
  const tip = `${d.name} · 공명 등급 ${u.rank}${u.pos ? '' : ' · 대기'}${locked ? ' · 이번 페이즈 출전 불가' : ''}`;
  const on = app.screen === 'map' && app.sel?.k === 'unit' && app.sel.uid === u.uid;
  const fo = !!run?.focus?.includes(u.uid) && !R.isRock(u);
  // 집중 육성 단추 (초상화 왼쪽 위): 지정한 기물들이 공명도 풀의 CFG.focusXpShare 를 나눠 받는다 (run.ts distributeXp). 단추 안의 단추가 될 수 없어 span
  const fb = run && !R.isRock(u) ? `<span class="rt-focus${fo ? ' on' : ''}" role="button" tabindex="0" data-a="focus" data-v="${u.uid}" aria-pressed="${fo}" title="${fo ? '집중 육성 해제' : `집중 육성 — 지정한 기물들이 공명도 풀의 ${Math.round(CFG.focusXpShare * 100)}%를 먼저 나눠 받고, 나머지는 모든 기물이 함께 나눕니다`}" aria-label="집중 육성">${lineIcon('u.target', 'li')}</span>` : '';
  return `<button class="rt${u.pos ? '' : ' rt-off'}${on ? ' on' : ''}${fo ? ' rt-fo' : ''}" data-a="${app.screen === 'map' ? 'map-unit' : 'manage'}" data-v="${u.uid}" data-syns="${memberships(u, run).join(' ')}" aria-pressed="${on}" title="${esc(tip)}" aria-label="${esc(tip)}">
    <span class="rt-art">${sprite(d)}${fb}${u.mod ? `<span class="rt-mod">${itemIcon(u.mod)}</span>` : ''}
      <span class="rt-type" aria-hidden="true"><i title="${TTYPE_NAME[d.ttype]}">${typeIcon(d.ttype)}</i><i title="${CTYPE_NAME[d.ctype]}">${typeIcon(d.ctype)}</i></span>
      <span class="rt-rank">${rankLabel(u.rank)}</span>${locked ? '<span class="rt-lock" aria-hidden="true">⛓</span>' : ''}</span>
    <span class="rt-items">${u.items.map((i) => itemIcon(i)).join('')}</span>
  </button>`;
}
function rosterRow(u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  return `<button class="roster-row ${u.pos ? '' : 'bench'}" data-a="manage" data-v="${u.uid}">
    ${sprite(d)}<span class="rr-main"><b>${esc(d.name)}${app.run && u.lock === app.run.phase ? ' <small class="down">⛓ 이번 페이즈 출전 불가</small>' : ''}</b>${xpBar(u)}</span>${rankPips(u.rank)}
    <span class="rr-items">${u.items.map((i) => itemIcon(i)).join('')}${u.mod ? itemIcon(u.mod) : ''}</span>
  </button>`;
}

// ───────────────────────── 화면: 편성 (전투 준비 / 관리)
/** 편성 표: 전술 위력 알약 (지휘관 또는 전술 위력을 쓰는 시너지가 있을 때만). 숨어 있다가 나타나는 순간 튀어나오는 연출 */
let tacShownPrev = false;
function tacPill(run: RunState) {
  const dep = deployed(run);
  const sc = synergyCounts(dep, run);
  const scheme = tierOf('SCHEME', sc.SCHEME || 0) > 0; // [암운] 피해가 전술 위력 비례
  const b = dep.length ? buildBattle(run, run.node?.enc ? { ...run.node.enc, enemies: [] } : { n: CFG.bossBoard, env: '', enemies: [], mult: 1, seed: 1 }, false) : null;
  const allies = b ? b.units.filter((u) => u.side === 0 && !u.isSummon) : [];
  const cmds = allies.filter((u) => u.ctype === 'CMD');
  const show = !!b && (cmds.length > 0 || scheme || allies.some((u) => u.weapon?.tactical));
  const pop = show && !tacShownPrev;
  tacShownPrev = show;
  if (!b || !show) return '';
  const lines = [`기본 ${CFG.tacBase - CFG.tacPerCmd}`, `출전 ${allies.length}명: ${allies.length >= 4 ? '+' : ''}${CFG.tacPerUnit * (allies.length - 4)}`];
  // 지휘관 기여: 지휘관 몫 + 정신력 × 3, 높은 순으로 100% · 50% · 25% … (combat.ts computeTac 이 기록)
  for (const c of cmds.slice().sort((x, y) => (y.mem.tacW || 0) - (x.mem.tacW || 0))) {
    const w = c.mem.tacW ?? 1, k = CFG.tacPerCmd + CFG.tacPerMnd * (c.mem.mnd || 0);
    lines.push(`${c.name} (정신력 ${c.mem.mnd || 0}): +${Math.round(k * w)}${w < 1 ? ` (기여 ${Math.round(w * 100)}%)` : ''}`);
  }
  const extra = allies.reduce((sum, u) => sum + (u.mem.tacBonus || 0), 0);
  if (extra) lines.push(`기타 보정 +${extra}`);
  const v = b.tac[0];
  const title = `전술 위력 ${v}\n${lines.join('\n')}\n지휘관의 스킬 · 전술 무기 · [암운]은 이 값을 위력으로 씁니다.`;
  return `<span class="tac-wrap"><button class="pill tac-pill${pop ? ' pop' : ''}" data-a="tac-info" title="${esc(title)}" aria-label="${esc(title)}" aria-expanded="${app.tacOpen}">${lineIcon('p.tac', 'li')}<b>${v}</b></button>${cmds.length ? `<span class="tac-cmd" title="출전 지휘관 수">지휘관 ${cmds.length}</span>` : ''}${app.tacOpen ? `<span class="tac-pop" role="note"><b>전술 위력 ${v}</b>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}<span class="muted">지휘관의 스킬 · 전술 무기 · [암운]은 이 값을 위력으로 씁니다.</span></span>` : ''}</span>`;
}
/** 배치형 소모품 팝업 본문: 성질 줄 (이름 + 값). 망원경은 모드 2칸 · 효과 범위 도식 · 사용 횟수 단계 */
function devicePop(run: RunState, id: string) {
  const tiers = SYN_BY_ID.NAV.tiers;
  if (id === 'K_decoy' || id === 'K_mine') return id === 'K_decoy' ? decoyPop() : minePop();
  if (id === 'K_barricade') return wallPop(run);
  if (id === 'K_feast') return feastPop(run);
  if (id !== 'K_scope') return `<dl class="dev-spec">${deviceRows(id, tiers).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  const S = DEV.scope, sc = run.scope, r = scopeR(tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0));
  const steps: [string, boolean][] = [[`처음 +${S.base}`, true], ...tiers.slice(1).map((n, i) => [`${n}명 +${S.tierBonus[i + 1]}`, (sc?.nav || 0) >= i + 2] as [string, boolean]), [`페이즈마다 +${S.perPhase}`, true]];
  return `<div class="sc-modes">
      <div class="sc-mode strike"><span class="sc-tg">적</span><b>지정 포격</b><small>전술 위력 비례 피해</small></div>
      <div class="sc-mode drop"><span class="sc-tg">아군 · 빈칸</span><b>항공 보급</b><small>고급 장비 1개씩</small></div>
    </div>
    <div class="sc-row">${rangeGrid(r)}<span class="small">주변 <b>${r}칸</b>${r < S.r[2] ? ` <span class="muted">(항해자 ${tiers[2]}명부터 ${S.r[2]}칸)</span>` : ''}</span></div>
    <div class="sc-row"><b class="sc-n" title="남은 사용 횟수">${sc?.n ?? 0}</b><ol class="sc-steps">${steps.map(([t, on]) => `<li class="${on ? 'on' : ''}">${t}</li>`).join('')}</ol></div>`;
}
/** 놓을 수 있는 구역 도식: 적 진형 · 사이 · 아군 진형 세 띠 (놓을 수 있는 띠만 밝게) */
const zoneMini = (foe: boolean, mid = true) => `<span class="zm" title="놓을 수 있는 곳"><i class="${foe ? 'on' : ''}">적</i><i class="${mid ? 'on' : ''}">사이</i><i class="on">아군</i></span>`;
/** 효과 범위 격자 (가운데 = 장치) */
const rangeGrid = (r: number) => { const n = 2 * r + 1; return `<span class="sc-grid" style="--n:${n}">${[...Array(n * n).keys()].map((i) => `<i${i === (n * n - 1) / 2 ? ' class="c"' : ''}></i>`).join('')}</span>`; };
/** 바리케이드 팝업: 놓는 곳 · 모양별 칸당 내구도 (지금 페이즈) · 막는 것 (직선 사격 / 기술 따로) */
function wallPop(run: RunState) {
  const ph = scalePhase(run.node?.enc?.phase ?? run.phase, !!run.campaign), M = DEV.wall.maxN; // 장치 내구도: 적 성장 페이즈 기준
  const shapes = [...Array(M).keys()].map((k) => `<span class="dw-shape"><span class="dw-cells">${'<i></i>'.repeat(k + 1)}</span><b>${wallHp(ph, k + 1)}</b></span>`).join('');
  return `<div class="sc-row">${zoneMini(false)}<span class="small">적 진형 밖 빈칸</span></div>
    <div class="dw-shapes" title="칸당 내구도 (이번 페이즈)">${shapes}</div>
    <div class="dv-flow"><span class="hot">이동 막음</span><span class="hot">직선 사격 막음 · 양쪽</span></div>
    <div class="dv-flow"><span>기술</span><i>→</i><span class="t">틈 없이 갈라질 때만 막음</span></div>
    <div class="dv-flow"><span>길이 막히면</span><i>→</i><span class="hot">칸 단위로 부숨</span></div>`;
}
/** 유인 신호기 팝업: 놓는 곳 · 도발 배율 비교 막대 · 무적 → 체력 1 시간 띠 */
function decoyPop() {
  const D = DEV.decoy, span = D.invuln * 2;
  return `<div class="sc-row">${zoneMini(true)}<span class="small">아무 빈칸 · <b>적 진형도</b></span></div>
    <div class="dv-bars" title="도발 배율 — 적이 표적을 고를 때의 무게">
      <span>보통 기물</span><i style="--p:${100 / D.prov}%"></i><b>×1</b>
      <span>신호기</span><i class="hot" style="--p:100%"></i><b>×${D.prov}</b>
    </div>
    <div class="dv-tl" title="전투 시작부터"><span class="on" style="flex:${D.invuln}">무적 ${D.invuln}초</span><span style="flex:${span - D.invuln}">체력 1</span></div>`;
}
/** 만찬 백수정 팝업 (미리암 라일라 전용): 놓는 곳 (아군 진형만) · 연쇄 회복 도식 (수정 → 1 → 2 → 3, 최대 체력 대비) · 주기 · 내구도 (이번 페이즈) */
function feastPop(run: RunState) {
  const F = DEV.feast, ph = scalePhase(run.node?.enc?.phase ?? run.phase, !!run.campaign);
  const hop = feastChain().map((k, i) => `<i>→</i><span class="fc-hop" title="${i + 1}번째 대상"><b>${feastPct(k)}</b><small>${i + 1}</small></span>`).join('');
  return `<div class="sc-row">${zoneMini(false, false)}<span class="small">아군 진형 빈칸 · <b>아군 구조물</b></span></div>
    <div class="dv-chain" title="${F.every}초마다: 체력 비율이 가장 낮은 다친 아군부터 겹치지 않게">${lineIcon('k.feast', 'li fc-src')}${hop}</div>
    <div class="dv-flow"><span class="t">${F.every}초마다</span><span>체력 비율 낮은 아군부터 ${F.n}명</span></div>
    <div class="dv-bars" title="내구도 (이번 페이즈)"><span>내구도</span><i style="--p:100%"></i><b>${feastHp(ph)}</b></div>`;
}
/** 감전 지뢰 팝업: 놓는 곳 · 감지 · 폭발 범위 격자 · 발동 흐름 */
function minePop() {
  const M = DEV.mine;
  return `<div class="sc-row">${zoneMini(false)}<span class="small">적 진형 밖 빈칸 · <b>늘 은신</b></span></div>
    <div class="sc-row">${rangeGrid(M.r)}<span class="small">감지 · 폭발 <b>주변 ${M.r}칸</b></span></div>
    <div class="dv-flow">${[['', '적 접근'], ['t', `${M.delay}초`], ['hot', '폭발 · 전기 피해'], ['hot', `감전 ${M.shock[0]}~${M.shock[1]}초`]].map(([c, t]) => `<span class="${c}">${t}</span>`).join('<i>→</i>')}</div>`;
}
/** 전장 방향 (위 t · 오른쪽 r · 아래 b · 왼쪽 l) → 화면 방향. 가로 지형은 시계 방향 90° (위 → 오른쪽) */
const scrSide = (g: Geo, sd: string) => (g.rot ? ({ t: 'r', r: 'b', b: 'l', l: 't' } as Record<string, string>)[sd] || sd : sd);
/** 편성 화면에 놓은 장치: 바리케이드 · 신호기 · 지뢰는 칸 토큰, 그물 · 망원경은 효과 범위 테두리 + 누를 수 있는 표식 (누르면 회수 확인) */
function deviceTokens(run: RunState, n: number, box: (x: number, y: number, w?: number, h?: number) => string) {
  const enc = run.node?.enc;
  if (!enc?.devices?.length) return '';
  const g = runGeo(run, n), { w: fw, h: fh } = g;
  const navR = scopeR(tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0));
  const phase = scalePhase(enc.phase ?? run.phase, !!run.campaign); // 장치 내구도: 적 성장 페이즈 기준
  return enc.devices.map((d, i) => {
    const c = CONSUMABLES[d.id], ic = lineIcon(SPECIAL_GLYPH[d.id] || 'a.power', 'li');
    if (d.id === 'K_net' || d.id === 'K_scope') {
      const r = d.id === 'K_net' ? 0 : navR;
      const x0 = Math.max(PAD, d.x - r), y0 = Math.max(PAD, d.y - r), x1 = d.id === 'K_net' ? d.x + 1 : Math.min(fw - PAD - 1, d.x + r), y1 = d.id === 'K_net' ? d.y + 1 : Math.min(fh - PAD - 1, d.y + r);
      const kind = d.id === 'K_net' ? 'net' : d.mode === 'strike' ? 'strike' : 'drop';
      const label = d.id === 'K_net' ? c.name : d.mode === 'strike' ? '지정 포격' : '항공 보급';
      return `<div class="dev-area dev-${kind}" style="${box(x0, y0, x1 - x0 + 1, y1 - y0 + 1)}"></div><button class="dev-mark dev-${kind}" style="${box(d.x, d.y)}" data-a="dev-sel" data-v="${i}" data-dev="${i}" title="${esc(`${label} — 누르면 회수`)}">${ic}</button>`;
    }
    const cells = deviceCells(d);
    if (d.id === 'K_barricade') { // 몸통 (끌면 옮기기 · 누르면 회수) + 끝단 화살표 (끌면 그 방향으로 늘리기 · 줄이기)
      const n1 = cells.length, v = d.dir === 'v' && n1 > 1, hpW = wallHp(phase, n1);
      const sides = n1 === 1 ? ['t', 'r', 'b', 'l'] : v ? ['t', 'b'] : ['l', 'r']; // 전장 방향 (data-wall), 화살표 자리는 화면 방향 (scrSide)
      const canGrow = n1 < DEV.wall.maxN;
      return `<div class="dev-wall2${n1 > 1 && v !== !!g.rot ? ' v' : ''}" style="${box(d.x, d.y, v ? 1 : n1, v ? n1 : 1)}" data-wallbox="${i}">
        <button class="dw-body" data-wall="move:${i}" data-a="dev-sel" data-v="${i}" data-dev="${i}" title="${esc(`${c.name} · 칸당 내구도 ${hpW} — 끌어서 옮기기 · 누르면 회수`)}">${cells.map(() => `<span class="dw-cell">${ic}</span>`).join('')}<span class="dev-hp">${hpW}</span></button>
        ${sides.map((sd) => `<span class="dw-arr dw-${scrSide(g, sd)}${canGrow ? '' : ' max'}" data-wall="ext:${i}:${sd}" title="끌어서 늘리기 · 줄이기 (최대 ${DEV.wall.maxN}칸)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7-6 7 6M12 3v18"/></svg></span>`).join('')}
      </div>`;
    }
    const hp = d.id === 'K_feast' ? feastHp(phase) : 0;
    return cells.map((p) => `<button class="dev-tok dev-${d.id === 'K_barricade' ? 'wall' : d.id === 'K_decoy' ? 'decoy' : d.id === 'K_feast' ? 'feast' : 'mine'}" style="${box(p.x, p.y)}" data-a="dev-sel" data-v="${i}" data-dev="${i}" title="${esc(`${c.name}${d.id === 'K_feast' ? ` · 내구도 ${hp} · ${DEV.feast.every}초마다 연쇄 회복` : d.id === 'K_decoy' ? ` · 체력 1 · 도발 ×${DEV.decoy.prov}` : ' · 은신'} — 누르면 회수`)}">${ic}${hp ? `<span class="dev-hp">${hp}</span>` : ''}</button>`).join('');
  }).join('');
}
/** 편성 보드 화면 틀: 보이는 전장 칸 (바깥 테두리 제외 · 포탑 열 ex 포함)의 화면 원점 (ox, oy) · 화면 칸 수 (bw × bh). 가로 지형은 돌려서 (engine/build.ts toScr) */
const prepFrame = (g: Geo, ex: number) => { const r = rectScr(g, PAD - ex, PAD, g.w - 2 * PAD + 2 * ex, g.h - 2 * PAD); return { ox: r.x, oy: r.y, bw: r.w, bh: r.h }; };
/** 편성 보드: 전장 사각형 (x, y, 폭 w, 높이 h — 전장 좌표) → 절대 위치 (left · top · 크기 %). ex = .board 의 data-ex */
const boardBox = (g: Geo, ex: number) => {
  const f = prepFrame(g, ex);
  return (x: number, y: number, w = 1, h = 1) => { const r = rectScr(g, x, y, w, h); return `left:${((r.x - f.ox) / f.bw) * 100}%;top:${((r.y - f.oy) / f.bh) * 100}%;width:${(100 * r.w) / f.bw}%;height:${(100 * r.h) / f.bh}%`; };
};
/** 배치 미리보기 (편성 화면): 고르거나 끄는 배치형 소모품을 가리킨 칸 = 기준점 (장치 실루엣 + 조준 모서리) · 효과 범위 (점선 + 빗금) · 놓을 수 없으면 금지 + 이유.
 *  판정은 엔진 그대로 (R.placeDevice → deviceErr). once = 끌어 놓기가 막힌 뒤 한 번 그릴 때만 (선택 없이) · cand = 터치 첫 탭의 후보 (같은 칸을 다시 누르면 확정) */
let devPv: { idx: number; id: string; x: number; y: number; once?: boolean; cand?: boolean } | null = null;
/** 범위 · 모드가 중요한 배치형 소모품: 터치에서는 첫 탭 = 후보 표시, 같은 칸 재탭 = 확정 (docs/UI.md 11). 바리케이드는 옮기기 · 회수가 쉬워 바로 놓는다 */
const TWO_STEP = ['K_net', 'K_scope', 'K_decoy', 'K_mine'];
/** 마지막 누름이 손가락인지 (터치 두 단계 배치 판정) */
let touchPtr = false;
/** 지형 덩어리를 새로 고른 그리기에서만 짧은 전환 (prepScreen) */
let trSelLast = '';
/** 크레인으로 든 컨테이너 배지 (덩어리 아이콘 오른쪽 위): 지형 상세 선택 (선택색 경계 · 옅은 면)과 '옮기는 중' 을 나눈다. 보관함 물품 · 성유물은 호박색 실선만 (docs/UI.md 13) */
const ARM_BADGE = '<i class="arm-b" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg></i>';
window.addEventListener('pointerdown', (e) => { touchPtr = e.pointerType === 'touch'; }, { capture: true, passive: true });
/** 금지 표시 (놓을 수 없는 칸 · 받을 수 없는 대상) */
const NO_ICON = '<svg class="no-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/></svg>';
/** 엔진의 '놓을 수 없음' 문구 (run.ts placeDevice · deviceErr) → 짧은 이름표. 칸을 차지한 것은 장치 · 적 · 기물로 나눈다 */
function placeReason(run: RunState, err: string, x: number, y: number) {
  if (err === R.ROOM_ERR) return '출전 자리 부족'; // 장치를 놓으면 출전 기물이 설 칸이 모자라다
  if (err.includes('칸까지')) return `최대 ${DEV.wall.maxN}칸`;
  if (err.includes('전장')) return '전장 밖';
  if (err.includes('지형')) return '지형';
  if (err.includes('적 진형')) return '적 진형';
  if (err.includes('아군 진형에만')) return '아군 진형만';
  if (err.includes('횟수')) return '횟수 없음';
  if (err.includes('기물') || err.includes('장치')) {
    const enc = run.node?.enc, g = runGeo(run), at = (c: { x: number; y: number }) => c.x === x && c.y === y;
    if (enc?.devices?.some((d) => deviceCells(d).some(at))) return '장치 있음';
    if (enc?.enemies.some((s) => at(foeCell(s, g)))) return '적 있음';
    return '기물 있음';
  }
  return err;
}
/** 미리보기 HTML (prepScreen 과 끄는 · 가리키는 동안의 갱신 공용). docs/UI.md 10 — 세 겹을 서로 다른 표현으로:
 *  효과 범위 = 장치 색 점선 + 빗금 (그물 2×2 · 망원경 반경 · 지뢰 발동 반경) · 기준점 = 놓일 장치 모습 그대로 + 조준 모서리 · 놓을 수 없음 = 그 칸에 금지 + 짧은 이유 */
function devPvHtml(run: RunState, pv: NonNullable<typeof devPv>, ex: number) {
  const enc = run.node?.enc;
  if (!enc) return '';
  const g = runGeo(run), { id, x, y } = pv, box = boardBox(g, ex), fr = prepFrame(g, ex), sp = toScr(g, x, y);
  const r = R.placeDevice(run, id, { k: 'cell', x, y });
  const d: Device = r.dev ?? { id, x, y };
  const side = sp.x - fr.ox < fr.bw / 2 ? 'l' : 'r', below = sp.y - fr.oy < 1 ? ' below' : ''; // 이름표는 화면 기준 (가로 지형도)
  const label = (t: string) => `<span class="dev-pv-at" style="${box(x, y)}"><b class="dev-pv-lb ${side}${below}" role="status">${t}</b></span>`;
  if (r.err) return `<div class="dev-pv bad"><i class="pv-no" style="${box(x, y)}">${NO_ICON}</i>${label(esc(placeReason(run, r.err, x, y)))}</div>`;
  // 효과 범위 (전장 안으로 자른 사각형 하나)
  const rr = id === 'K_net' ? null : id === 'K_scope' ? scopeR(tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0)) : id === 'K_mine' ? DEV.mine.r : -1;
  const [x0, y0, x1, y1] = id === 'K_net' ? [x, y, x + 1, y + 1] : [x - (rr ?? 0), y - (rr ?? 0), x + (rr ?? 0), y + (rr ?? 0)];
  const cx0 = Math.max(PAD, x0), cy0 = Math.max(PAD, y0), cx1 = Math.min(g.w - PAD - 1, x1), cy1 = Math.min(g.h - PAD - 1, y1);
  const kind = id === 'K_net' ? 'net' : id === 'K_scope' ? (d.mode === 'strike' ? 'strike' : 'drop') : id === 'K_mine' ? 'mine' : id === 'K_decoy' ? 'decoy' : id === 'K_feast' ? 'feast' : 'wall';
  const range = rr !== -1 && cx1 >= cx0 && cy1 >= cy0 ? `<i class="pv-range dev-${kind}" style="${box(cx0, cy0, cx1 - cx0 + 1, cy1 - cy0 + 1)}"></i>` : '';
  // 기준점: 놓은 뒤와 같은 모습 (deviceTokens 와 같은 클래스, 누를 수 없음)
  const ic = lineIcon(SPECIAL_GLYPH[id] || 'a.power', 'li');
  const body = id === 'K_net' || id === 'K_scope' ? `<span class="dev-mark dev-${kind} pv-ghost" style="${box(x, y)}">${ic}</span>`
    : deviceCells(d).map((c) => `<span class="dev-tok dev-${kind} pv-ghost" style="${box(c.x, c.y)}">${ic}</span>`).join('');
  const aim = `<i class="pv-aim" style="${box(x, y)}"></i>`;
  const what = id === 'K_scope' ? (d.mode === 'strike' ? '지정 포격' : '항공 보급') : id === 'K_decoy' ? `도발 ×${DEV.decoy.prov} · 적 전체` : '';
  const lb = [what, pv.cand ? '다시 눌러 확정' : ''].filter(Boolean).join(' · ');
  return `<div class="dev-pv ok${pv.cand ? ' cand' : ''}">${range}${body}${aim}${lb ? label(esc(lb)) : ''}</div>`;
}
/** 배치형 소모품을 놓을 수 있는 칸 (편성 보드 화면 틀 안, 판정은 엔진 R.useCheck) → ok = 전장 좌표 'x,y' 집합 · html = 한 덩어리 약한 면 (정적)
 *  (칸마다 <i> 를 칸 간격 없이 이어 붙이고, 덩어리 바깥 변에만 가는 선 z-t/r/b/l — docs/UI.md 10: 놓을 수 있는 영역 = 약한 면, 정적) */
function devZone(run: RunState, idx: number, ex: number) {
  const g = runGeo(run), fr = prepFrame(g, ex), box = boardBox(g, ex), ok = new Set<string>(), on = new Set<string>(), at: { sx: number; sy: number; x: number; y: number }[] = [];
  for (let sy = 0; sy < fr.bh; sy++) for (let sx = 0; sx < fr.bw; sx++) {
    const { x, y } = fromScr(g, sx + fr.ox, sy + fr.oy);
    if (x < PAD || x >= g.w - PAD || R.useCheck(run, idx, { k: 'cell', x, y })) continue;
    ok.add(`${x},${y}`); on.add(`${sx},${sy}`); at.push({ sx, sy, x, y });
  }
  const has = (sx: number, sy: number) => on.has(`${sx},${sy}`);
  const html = `<div class="dev-zone" aria-hidden="true">${at.map(({ sx, sy, x, y }) => `<i class="${[!has(sx, sy - 1) && 'z-t', !has(sx + 1, sy) && 'z-r', !has(sx, sy + 1) && 'z-b', !has(sx - 1, sy) && 'z-l'].filter(Boolean).join(' ')}" style="${box(x, y)}"></i>`).join('')}</div>`;
  return { ok, html };
}
/** 쥔 도구 (docs/UI.md 11): 다음 누름에 쓰일 것 — 보관함에서 고른 장비 (장착) · 소모품 (사용 · 배치) · 성유물 (장착) · 크레인으로 든 컨테이너 (옮기기).
 *  상세를 보려고 고른 대상 (기물 · 적 · 지형 · 포탑)은 쥔 도구가 아니다 (app.sel 은 그대로 두고 여기서 가른다) */
type Tool = { k: 'place' | 'equip' | 'use'; idx: number; id: string } | { k: 'relic'; id: string } | { k: 'crane'; crate: number };
function toolOf(run: RunState | null): Tool | null {
  if (!run) return null;
  const s = app.sel;
  if (s?.k === 'relic') return { k: 'relic', id: s.id };
  if (s?.k === 'item') {
    const id = run.inventory[s.idx];
    if (!id) return null;
    if (isPlaceable(id)) return app.screen === 'prep' && run.node?.enc ? { k: 'place', idx: s.idx, id } : null; // 조우 밖에서는 놓을 곳이 없다 (보기만)
    return { k: isConsumable(id) ? 'use' : 'equip', idx: s.idx, id };
  }
  const c = app.screen === 'prep' ? craneOn(run) : null;
  return c === null ? null : { k: 'crane', crate: c };
}
/** 크레인으로 옮기는 지형의 이름 (이번 조우 지형 틀의 crateKind: 컨테이너 · 주차된 차 · 크레딧 셀 더미 · 회수 장치) + 번호 글자 */
const crateKind = (): TerrainKind => mapOf(app.run?.node?.enc?.map).crateKind ?? 'container';
const crateName = (c: number, k = crateKind()) => `${TERRAIN[k].name} ${String.fromCharCode(65 + c)}`;
/** 옮기는 수단 이름: 크레인 (컨테이너 · 차) · 자동 선반 (크레딧 셀) · 운반대 (회수 장치) */
const moverName = (k = crateKind()) => (k === 'cell' ? '자동 선반' : k === 'recovery' ? '운반대' : '크레인');
/** 쥔 도구 칩 (편성 보드 머리): 무엇을 쥐고 다음 누름이 무엇을 하는지 + 남은 수 + 취소 (Esc 와 같음).
 *  '감전 지뢰 배치 중 · 보유 1' · '장비 장착 중: 이름' · '크레인: 컨테이너 B 옮기는 중' */
function toolChip(run: RunState, t: Tool) {
  const dot = '<i class="tc-dot" aria-hidden="true">·</i>';
  const x = (a: string, v = '', tip = '취소 (Esc)') => `<button class="btn tiny plc-x" data-a="${a}"${v ? ` data-v="${v}"` : ''} title="${tip}">취소</button>`;
  const chip = (cls: string, inner: string, cancel: string) => `<span class="tool-chip tc-${cls}" role="status">${inner}${cancel}</span>`;
  if (t.k === 'crane') return chip('crane', `<span class="tc-ic">${lineIcon('tr.crane', 'li')}</span><span class="tc-do">${moverName()}:</span><b class="plc-name">${crateName(t.crate)}</b><span class="tc-do">옮기는 중</span>`, x('crane-pick', String(t.crate), '옮기기 취소 (Esc)'));
  if (t.k === 'relic') return chip('equip', `${relicTok(t.id)}<span class="tc-do">성유물 장착 중:</span><b class="plc-name">${esc(RELIC_BY_ID[t.id]?.name || '')}</b>`, x('sel-clear'));
  const it = itemInfo(t.id), have = run.inventory.filter((y) => y === t.id).length;
  if (t.k === 'equip') return chip('equip', `${itemIcon(t.id)}<span class="tc-do">${isMod(t.id) ? '개조부품' : '장비'} 장착 중:</span><b class="plc-name">${esc(it.name)}</b>`, x('sel-clear', '', '장착 취소 (Esc)'));
  const [k, n] = t.id === 'K_scope' && run.scope ? ['횟수', run.scope.n] : ['보유', have];
  const verb = t.k === 'place' ? (t.id === 'K_scope' ? '지정 중' : '배치 중') : '사용 중';
  return chip(t.k, `${itemIcon(t.id)}<b class="plc-name">${esc(it.name)}</b><span class="tc-do">${verb}</span>${dot}<span class="plc-n">${k} <b>${n}</b></span>`, x('sel-clear', '', `${t.k === 'place' ? '놓기' : '사용'} 취소 (Esc)`));
}
/** 엔진 오류 문구 → 대상 옆 짧은 이유 */
function whyShort(e: string) {
  if (e === R.WRONG_TARGET) return '대상 아님';
  for (const [k, v] of [['가득', '칸 가득'], ['반려 돌', '반려 돌'], ['문장', '이미 소속'], ['최고', '최고 등급'], ['포탑', '포탑 전용'], ['디바인', '디바인만'], ['공간', '보관함 부족'], ['장비가 없', '장비 없음'], ['바뀔 수 있는', '대상 없음']] as const) if (e.includes(k)) return v;
  return '불가';
}
/** 끄는 것 → 쥔 도구 (누르기와 같은 표현, docs/UI.md 14): 보관함 물품 · 성유물 · 기물에 단 장비. 기물 · 포탑 · 소환물 · 장치 끌기는 도구가 아니다 */
type HeldTool = Tool | { k: 'move'; uid: string; slot: number; id: string };
function dragTool(run: RunState, src: string): HeldTool | null {
  const [k, a, b] = src.split(':');
  if (k === 'relic') return { k: 'relic', id: a };
  if (k === 'item') {
    const id = run.inventory[+a];
    if (!id) return null;
    return isPlaceable(id) ? (run.node?.enc ? { k: 'place', idx: +a, id } : null) : { k: isConsumable(id) ? 'use' : 'equip', idx: +a, id };
  }
  if (k === 'eq') { const u = run.units.find((x) => x.uid === a), id = u ? (+b < 0 ? u.mod : u.items[+b]) : null; return u && id ? { k: 'move', uid: a, slot: +b, id } : null; }
  return null;
}
/** 쥔 도구가 받을 곳 표시 (편성 화면 · docs/UI.md 14): 누르기 (그린 뒤 한 번)와 끌기 (끌기 시작할 때)가 같은 함수.
 *  받을 수 없는 것 (적 · 받을 수 없는 아군 · 포탑 · 소환물 · 장치 · 지형 · 조합 안 되는 보관함 물품 · 소모품 · 성유물) = tg-no (포탑처럼 흐리게).
 *  받을 수 있는 것 = tg-ok (밝기 그대로, 새 테두리 없음) + data-tgl = 가리키거나 끌어 올렸을 때만 그 위에 보이는 결과 (장착 · 조합 → 이름 · 교체 · 사용).
 *  흐린 아군은 가리키면 '⊘ 이유'. 판정은 엔진 그대로 (equipCheck · equipCombo · combinePreview · useCheck) */
function toolMark(run: RunState, t: HeldTool | null = toolOf(run)) {
  toolMarkClear();
  if (!t || t.k === 'crane') return;
  const q = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(`.prep ${s}`));
  const mark = (el: Element, ok: boolean, lb = '') => { el.classList.add(ok ? 'tg-ok' : 'tg-no'); if (lb) el.setAttribute('data-tgl', lb); };
  const unitOf = (el: HTMLElement) => run.units.find((u) => u.uid === el.dataset.v);
  const allies = q('.u[data-a="sel-unit"]:not(.comp-tk)'), foes = q('.u[data-a="sel-enemy"]'), turrets = q('.u[data-a="sel-turret"]');
  const held = t.k === 'relic' ? -2 : t.k === 'move' ? -1 : t.idx; // 쥔 보관함 칸 (흐리지 않는다)
  const inv = q('.inv-rail .item[data-a="sel-item"]').filter((el) => +el.dataset.v! !== held), relics = q('.inv-rail .relic-tok[data-a="sel-relic"]').filter((el) => t.k !== 'relic' || el.dataset.v !== t.id);
  // 어느 도구도 받지 않는 것: 소환물 · 무휼 · 놓은 장치 · 지형 (배치형 소모품이 놓일 수 있는 걷는 지형 칸은 놓을 수 있는 영역 표시가 따로 있다)
  q('.u.comp-tk').forEach((el) => mark(el, false));
  q('.board :is(.dev-tok, .dev-mark, .dev-wall2)').forEach((el) => mark(el, false));
  q('.board .tr-ic').forEach((el) => mark(el, false));
  q('.board .cell.tr').forEach((el) => { if (!el.classList.contains('dev-ok')) mark(el, false); });
  relics.forEach((el) => mark(el, false));
  const combo = (res: string) => (res.includes('?') ? '잠재능력 개방' : `조합 → ${itemInfo(res).name}`); // 백수정 조각: 결과는 합성한 뒤 공개
  if (t.k === 'relic') {
    allies.forEach((el) => { const u = unitOf(el), div = !!u && UNIT_BY_ID[u.defId].ttype === 'divine'; mark(el, div, div ? (u!.relic ? '교체' : '장착') : '디바인만'); });
    [...foes, ...turrets, ...inv].forEach((el) => mark(el, false));
    return;
  }
  // 기물에 단 장비 하나하나: 그 칸에 놓으면 그 장비와 조합 (희귀 여럿에 백수정 · 고급 여럿에 성운 가루를 원하는 칸에, equipCombo slot)
  const slotMark = (id: string, skip?: string) => q(':is(.u[data-a="sel-unit"], .d-eq) .tk-it[data-drop^="eqitem:"]').forEach((el) => {
    const [, uid, k] = el.dataset.drop!.split(':');
    if (uid === skip || +k < 0 || R.equipCheck(run, id, uid, +k)) return;
    const cb = R.equipCombo(run, id, uid, +k);
    if (cb && cb.slot === +k) mark(el, true, combo(cb.res));
  });
  if (t.k === 'move') { // 기물에 단 장비를 다른 기물 · 보관함으로 (moveEq)
    slotMark(t.id, t.uid);
    allies.forEach((el) => { const u = unitOf(el); if (!u) return; if (u.uid === t.uid) return; const e = R.equipCheck(run, t.id, u.uid), cb = e ? null : R.equipCombo(run, t.id, u.uid); mark(el, !e, e ? whyShort(e) : cb ? combo(cb.res) : isMod(t.id) && u.mod ? '교체' : '장착'); });
    [...foes, ...turrets].forEach((el) => mark(el, false));
    inv.forEach((el) => mark(el, true, '해제'));
    return;
  }
  if (t.k === 'equip') {
    slotMark(t.id);
    allies.forEach((el) => { const u = unitOf(el); if (!u) return; const e = R.equipCheck(run, t.id, u.uid), cb = e ? null : R.equipCombo(run, t.id, u.uid); mark(el, !e, e ? whyShort(e) : cb ? combo(cb.res) : isMod(t.id) && u.mod ? '교체' : '장착'); });
    turrets.forEach((el) => mark(el, false, '포탑 불가'));
    foes.forEach((el) => mark(el, false));
    inv.forEach((el) => { const res = R.combinePreview(run, t.idx, +el.dataset.v!); mark(el, !!res, res ? combo(res) : ''); });
    return;
  }
  // 소모품: 배치형 = 칸에만 (놓을 수 있는 영역은 devZone), 함대 = 아군을 눌러도 쓴다 (sel-unit · onDrop), 그 밖 = 대상 판정 그대로
  const c = CONSUMABLES[t.id];
  const use = (tg: R.UseTarget) => R.useCheck(run, t.idx, tg);
  [...turrets, ...inv].forEach((el) => mark(el, false));
  if (!c || t.k === 'place') { [...allies, ...foes].forEach((el) => mark(el, false)); return; }
  if (c.target === 'run') { const e = use({ k: 'run' }); allies.forEach((el) => mark(el, !e, e ? whyShort(e) : '사용')); foes.forEach((el) => mark(el, false)); return; }
  if (c.target === 'item') { // 장비에 쓰는 소모품: 받을 수 있는 장착 장비 칸 · 보관함 장비는 밝게, 기물 카드는 그 칸만 남기고 흐리게 (재구성 회로는 기물도)
    const slotOk = (el: HTMLElement) => { const [uid, k] = el.dataset.v!.split(':'); return !use({ k: 'eq', uid, slot: +k }); };
    allies.forEach((el) => {
      const u = unitOf(el);
      if (u && c.alsoItem && !use({ k: 'unit', uid: u.uid })) { mark(el, true, '사용'); return; }
      const slots = Array.from(el.querySelectorAll<HTMLElement>('.tk-it[data-a="item-info"]'));
      slots.forEach((s) => { if (slotOk(s)) mark(s, true, '사용'); }); // 못 받는 칸은 카드와 함께 흐린다 (tg-part)
      el.classList.add(slots.some((s) => s.classList.contains('tg-ok')) ? 'tg-part' : 'tg-no');
    });
    inv.forEach((el) => { const ok = !use({ k: 'inv', i: +el.dataset.v! }); el.classList.remove('tg-no'); mark(el, ok, ok ? '사용' : ''); });
    foes.forEach((el) => mark(el, false));
    return;
  }
  allies.forEach((el) => { const u = unitOf(el); if (!u) return; const e = c.target === 'unit' ? use({ k: 'unit', uid: u.uid }) : R.WRONG_TARGET; mark(el, !e, e ? (c.target === 'unit' ? whyShort(e) : '') : '사용'); });
  foes.forEach((el) => { const e = use({ k: 'foe', i: +el.dataset.v! }); mark(el, !e, e ? (c.target === 'foe' ? whyShort(e) : '') : '사용'); });
}
function toolMarkClear() {
  root.querySelectorAll('.prep :is(.tg-ok, .tg-no, .tg-part, .tg-at)').forEach((el) => { el.classList.remove('tg-ok', 'tg-no', 'tg-part', 'tg-at'); el.removeAttribute('data-tgl'); });
  tgTip(null);
}
/** 끄는 동안 손가락 · 마우스 아래 받는 대상 (tg-at): 그 위에만 결과 이름표 (마우스로 가리킬 때와 같은 tgTip) */
function toolMarkAt(x: number, y: number) {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.tg-ok, .tg-no');
  const cur = root.querySelector('.prep .tg-at');
  if (cur === el) return;
  cur?.classList.remove('tg-at');
  el?.classList.add('tg-at');
  tgTip(el ?? null);
}
/** 쥔 도구 결과 이름표 (가리킨 · 끌어 올린 대상 하나 위에만): 화면에 떠 있는 한 장 (보관함 · 보드 창의 스크롤 영역에 잘리지 않게).
 *  받는 대상 = '장착' · '조합 → 이름' · '교체' · '사용', 흐린 아군 = '⊘ 이유' */
function tgTip(el: HTMLElement | null) {
  let tip = document.querySelector<HTMLElement>('body > .tg-tip');
  const lb = el && app.screen === 'prep' && el.isConnected ? el.dataset.tgl : '';
  if (!lb || !el) { if (tip) tip.hidden = true; return; }
  if (!tip) { tip = document.createElement('div'); tip.className = 'tg-tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
  const no = el.classList.contains('tg-no');
  tip.classList.toggle('no', no);
  tip.textContent = no ? `\u2298 ${lb}` : lb;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.round(Math.max(4, Math.min(innerWidth - w - 4, r.left + r.width / 2 - w / 2)))}px`;
  tip.style.top = `${Math.round(r.top - h - 4 >= 4 ? r.top - h - 4 : r.bottom + 4)}px`;
}
// 마우스로 가리키면 그 대상의 결과 이름표 (끄는 동안은 toolMarkAt 이 맡는다)
root.addEventListener('pointerover', (ev) => {
  if (ev.pointerType !== 'mouse' || drag?.ghost) return;
  tgTip((ev.target as HTMLElement).closest<HTMLElement>('.prep :is(.tg-ok, .tg-no[data-tgl])'));
});
root.addEventListener('pointerleave', () => { if (!drag?.ghost) tgTip(null); });
/** 가리키거나 끄는 칸이 바뀌면 보드의 미리보기만 다시 그린다 (화면 전체를 다시 그리지 않음) */
function devPvShow(board: HTMLElement, pv: typeof devPv) {
  const run = app.run, host = board.querySelector<HTMLElement>('.dev-pv-host');
  if (!run || !host) return;
  const same = devPv && pv && devPv.idx === pv.idx && devPv.x === pv.x && devPv.y === pv.y;
  devPv = pv;
  if (same && host.firstChild) return;
  host.innerHTML = pv ? devPvHtml(run, pv, +board.dataset.ex!) : '';
}
/** 배치형 소모품을 이 칸에 (누르기 · 끌어 놓기 공용): 놓을 수 있으면 놓고, 없으면 그 칸 옆에 이유를 띄우고 고른 상태는 그대로 둔다.
 *  터치로 누른 범위 · 모드 장치 (TWO_STEP): 첫 탭은 후보만 (기준점 · 범위 · 이유), 같은 칸을 다시 누르면 놓는다. 다른 칸을 누르면 후보가 옮겨 간다 */
function placeAt(run: RunState, idx: number, x: number, y: number, dragged = false) {
  const id = run.inventory[idx];
  if (!isPlaceable(id)) return;
  const err = R.useCheck(run, idx, { k: 'cell', x, y });
  const confirm = !!devPv?.cand && devPv.idx === idx && devPv.x === x && devPv.y === y;
  if (!err && !dragged && touchPtr && TWO_STEP.includes(id) && !confirm) { devPv = { idx, id, x, y, cand: true }; return; }
  if (!err) { devPv = null; tryUse(run, idx, { k: 'cell', x, y }); return; }
  devPv = { idx, id, x, y, once: dragged };
  SND.toastSfx(err); // 오류음 (알림 대신 칸 옆 이름표)
}
/** 오른쪽 상세 패널 접기 · 펼치기 (보는 사람마다 errantes.prefs.v1 prepFold). 접힌 채 무언가를 고르면 점으로 알린다 */
function foldTog(folded: boolean) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16${folded ? 'M10 9l-3 3 3 3' : 'M7 9l3 3-3 3'}"/></svg>`;
  return `<div class="side-fold-row"><button class="btn tiny side-fold" data-a="fold-r" aria-expanded="${!folded}" title="${folded ? '상세 패널 펼치기' : '상세 패널 접기 (보드를 넓게)'}">${icon}<span>${folded ? '상세' : '접기'}</span>${folded && app.sel ? '<i class="side-fold-dot" title="고른 대상의 상세가 있음"></i>' : ''}</button></div>`;
}
/** 대기석 숨기기 · 보이기 (보는 사람마다 errantes.prefs.v1 benchOff): 대기석 상자 오른쪽 위 테두리에 붙은 단추 하나 (docs/UI.md 16).
 *  docs/UI.md 9 — 숨기면 상자가 같은 자리에서 얇은 띠로 접히고, 단추는 같은 자리 · 같은 크기 (글자 수 같음, 화살표만 바뀜)라 누른 자리에서 다시 누르면 되돌아온다.
 *  숨겨도 보드 크기는 바꾸지 않는다 (바꾸면 띠 · 단추가 밀려난다) */
function benchTog(off: boolean) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${off ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}"/></svg>`;
  return `<button class="bench-tog" data-a="bench-tog" aria-expanded="${!off}" title="${off ? '대기석 보이기' : '대기석 숨기기'}">${off ? '보이기' : '숨기기'}${icon}</button>`;
}
/** 보드의 기물을 끄는 동안만 화면 아래에 붙는 대기석 놓을 자리 (대기석을 숨겼거나 스크롤로 화면 밖이어도 페이지를 굴리지 않고 놓는다) */
const BENCH_DOCK = `<div class="bench-dock" data-drop="bench" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><b>대기석으로</b></div>`;
function prepScreen(run: RunState) {
  const node = run.node;
  const isBattle = !!node?.enc;
  const n = node?.enc?.n || CFG.bossBoard;
  const lay = layout(run, n);
  const cap = R.deployCap(run);
  // 편성 화면은 배치 구역만 보여준다 (바깥 테두리 칸 제외). 좌표는 전장 좌표 그대로
  const geo = runGeo(run, n), { w: fw, h: fh } = geo;
  const land = terrainCells(geo), tLay = terrainLayer(geo); // 지형 칸 (물 · 온실 · 방벽 · 배양 탱크 · 수문)
  // 엔지니어 감시 포탑이 있으면 양옆 가장자리 열(포탑 전용)까지 보여 준다. 소환물 · 공왕 무휼은 시작 칸에 카드로 보이고 끌어서 옮긴다 (companionCells = 전투 시작 칸과 같음)
  const tcs = turretCells(run, n);
  const ex = tcs.length ? PAD : 0;
  const fr = prepFrame(geo, ex), bw = fr.bw, bh = fr.bh; // 화면 칸 수 (가로 지형은 돌려서)
  const box = boardBox(geo, ex), cellBox = (x: number, y: number) => box(x, y);
  // 돌격가 경계 (편성 화면에서만 표시): 출전한 아군 돌격가 주변 CFG.zoc.r 칸. 칸 툴팁 = 그 돌격가의 도발 배율로 계산한 교전 시간 (겹치면 긴 쪽)
  const zocCells = new Map<string, number>();
  const zocB = new Battle(fw, fh, new Rng(1), { phase: run.phase, credits: run.credits }), zocCounts = synergyCounts(deployed(run), run);
  zocB.keepEvents = false;
  for (const u of deployed(run)) {
    const p = lay.get(u.uid), d = UNIT_BY_ID[u.defId];
    if (!p || (d.ctype !== 'VAN' && !VAN_LIKE.includes(d.id)) || d.inert) continue; // 돌격가 · 돌격가처럼
    const hold = zocHoldOf(provMult(null, buildAlly(zocB, run, u, zocCounts)));
    for (let dy = -CFG.zoc.r; dy <= CFG.zoc.r; dy++) for (let dx = -CFG.zoc.r; dx <= CFG.zoc.r; dx++) if (dx || dy) { const k = `${p.x + dx},${p.y + dy}`; zocCells.set(k, Math.max(zocCells.get(k) || 0, hold)); }
  }
  const zocTip = (x: number, y: number) => ` title="${esc(zocShort(zocCells.get(`${x},${y}`)))}"`;
  let cells = '';
  const placeSel = app.sel?.k === 'item' && isBattle && isPlaceable(run.inventory[app.sel.idx]) ? app.sel.idx : -1; // 배치형 소모품을 고른 채: 칸을 누르면 설치, 놓을 수 있는 칸 표시
  const zone = placeSel >= 0 ? devZone(run, placeSel, ex) : null, devOk = (x: number, y: number) => !!zone?.ok.has(`${x},${y}`); // 놓을 수 있는 칸 (반투명 층 하나, 칸에는 누를 자리 표시만)
  const tool = toolOf(run), lift = tool?.k === 'crane' ? tool.crate : -1; // 쥔 도구 (팝업이 없으면 보드 창 위 칩) · 크레인으로 든 컨테이너
  const selG = app.sel?.k === 'terrain' ? app.sel.g : -1, selKey = selG >= 0 ? `${node?.enc?.seed ?? ''}:${selG}` : '';
  const trFresh = selKey !== trSelLast; // 지형 덩어리를 새로 고른 그리기에서만 짧은 전환 (다시 그릴 때마다 되풀이하지 않게)
  trSelLast = selKey;
  for (let sy = 0; sy < bh; sy++) // 화면 칸 순서 (줄 → 열)로 깔고, 칸마다 전장 좌표로 되짚는다
    for (let sx = 0; sx < bw; sx++) {
      const { x, y } = fromScr(geo, sx + fr.ox, sy + fr.oy);
      const mine = y >= geo.ay0 && y <= geo.ay1;
      const enemyZone = zoneAt(geo, x, y) === 'foe';
      const tk = land.get(`${x},${y}`);
      const zc = zocCells.has(`${x},${y}`);
      if (x < PAD || x >= fw - PAD) { cells += mine ? `<div class="cell tpad${zc ? ' zoc' : ''}" data-drop="tcell:${x}:${y}" title="포탑 전용 칸${zc ? ` · ${esc(zocShort(zocCells.get(`${x},${y}`)))}` : ''}"></div>` : `<div class="cell edge${zc ? ' zoc' : ''}"${zc ? zocTip(x, y) : ''}></div>`; continue; }
      if (tk) { // 지형 칸: 배치 불가, 누르면 지형 지물 상세. 걸어갈 수 있는 지형 (연결교 · 선로)에는 장치를 놓을 수 있다
        const walk = !(tk.bits & 1), gid = tLay.at.get(`${x},${y}`)!.gid;
        const cdir = tk.k === 'rail' && geo.opt?.cart ? (geo.opt.cart > 0 ? 'cdir-r' : 'cdir-l') : ''; // 선로: 운반차 첫 방향 화살표 (조우마다 무작위)
        const st = [cdir, gid === selG && trFresh ? 'tr-in' : '', lift >= 0 && tLay.groups[gid].crate === lift ? 'tr-lift' : ''].filter(Boolean).join(' '); // 고른 순간만 짧은 전환 · 크레인으로 든 컨테이너
        cells += walk && placeSel >= 0 ? terrainCell(tLay, x, y, `data-a="dev-cell" data-v="${x}:${y}"${isBattle ? ` data-drop="xcell:${x}:${y}"` : ''}`, selG, false, [devOk(x, y) ? 'dev-ok' : '', st].filter(Boolean).join(' '))
          : terrainCell(tLay, x, y, `data-a="sel-terrain" data-v="${gid}"${walk && mine ? ` data-drop="cell:${x}:${y}"` : walk && isBattle ? ` data-drop="xcell:${x}:${y}"` : ''}`, selG, !!node?.enc?.gateOpen, st); // 걸을 수 있는 지형이 아군 진형에 있으면 (단상) 기물을 세운다
        continue;
      }
      cells += `<div class="cell ${mine ? 'mine' : enemyZone ? 'foe' : 'mid'}${zc ? ' zoc' : ''}${devOk(x, y) ? ' dev-ok' : ''}" ${mine ? `data-drop="cell:${x}:${y}"` : isBattle ? `data-drop="xcell:${x}:${y}"` : ''}${placeSel >= 0 ? ` data-a="dev-cell" data-v="${x}:${y}"` : ''}${zc ? zocTip(x, y) : ''}></div>`;
    }
  let units = '';
  for (const u of deployed(run)) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
    units += `<div class="u side0 tk placed ${sel ? 'sel' : ''}" style="${cellBox(p.x, p.y)}"
      data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}" data-syns="${memberships(u, run).join(' ')}">${allyCard(u)}</div>`;
  }
  // 포탑 장비 (모든 포탑 공통, 엔지니어 단계에서 고름): 기물 장비 칸 자리에 작은 아이콘만 (끌기 · 놓기 없음). 빈 자리는 보이지 않는 칸으로 토큰 크기를 맞춘다
  const mods = run.turretMods || [];
  const modIcons = [...Array(ENG_TUR.picks).keys()].map((k) => (mods[k] ? itemIcon(mods[k]) : '<i class="tk-blank" aria-hidden="true"></i>')).join('');
  tcs.forEach((p, i) => {
    const sel = app.sel?.k === 'turret' && app.sel.i === i;
    units += `<div class="u side0 tk placed turret-tk${sel ? ' sel' : ''}" style="${cellBox(p.x, p.y)}" data-drag="turret:${i}" data-drop="turret:${i}" data-a="sel-turret" data-v="${i}" data-syns="" title="감시 포탑 ${i + 1} · 기계 — 끌어서 옮기기 (판매 · 대기석 불가)">
      <div class="tk-card"><div class="tk-art">${sprite(TURRET_SPR, '')}</div>
        <span class="tk-side"><i class="cat-mech" title="기계 · 구조물: ${esc(CATEGORY_RULE.struct)}">${lineIcon('k.mech', 'li')}</i></span>
        <span class="tk-items">${modIcons}</span></div></div>`;
  });
  const noRoom: CompanionTok[] = []; // 배치 구역에 빈칸이 없어 시작 칸을 못 잡은 소환물 · 무휼
  for (const t of companionCells(run, n, noRoom)) {
    const sel = t.king ? app.sel?.k === 'king' : app.sel?.k === 'unit' && app.sel.uid === t.owner;
    const owner = t.owner ? run.units.find((u) => u.uid === t.owner) : null;
    const tip = t.king ? `${t.name} · 청라공국 공왕 — 끌어서 시작 칸 옮기기` : t.syn ? `${t.name} · 칼리토 제국 시너지 소환물 — 끌어서 시작 칸 옮기기` : `${t.name} · ${owner ? UNIT_BY_ID[owner.defId].name : ''}의 소환물 — 끌어서 시작 칸 옮기기`;
    // 무휼 = 기물 토큰 그대로 (전용 장비 칸 포함, 장비는 옮길 수 없다) · 소환물 = 같은 기물 토큰에서 장비 칸만 뺀 것
    units += `<div class="u side0 tk placed comp-tk${t.king ? ' king-tk' : ''}${sel ? ' sel' : ''}" style="${cellBox(t.x, t.y)}" data-drag="comp:${t.key}" data-drop="cell:${t.x}:${t.y}" data-a="${t.king ? 'sel-king' : 'sel-unit'}" data-v="${t.owner || ''}" title="${esc(tip)}">
      ${t.king ? allyCard(kingState(run), true) : summonCard(t)}</div>`;
  }
  const sqSel = node?.enc?.squads && app.sqSel !== null && app.sqSel < node.enc.squads.length ? app.sqSel : null; // 고른 분대 (그 분대원만 강조, 나머지 적은 흐리게)
  if (node?.enc) node.enc.enemies.forEach((s, i) => {
    const e = ENEMY_BY_ID[s.defId];
    const sel = app.sel?.k === 'enemy' && app.sel.i === i;
    if (s.duo === 'b') { const ec = foeCell(s, geo), mate = node.enc!.enemies.find((o) => o.sq === s.sq && o.duo === 'f'), mc = mate && foeCell(mate, geo); if (mc) units += `<i class="duo-frame" style="${box(ec.x, Math.min(ec.y, mc.y), 1, 2)}" aria-hidden="true"></i>`; } // 포병 듀오: 두 칸을 한 기물로 두르는 틀
    const sqc = sqSel === null ? '' : s.sq === sqSel ? ' sq-on' : ' sq-off';
    units += `<div class="u side1 placed${hasPortrait(e) ? ' tk' : ''} ${e.tier !== 'minion' && !hasPortrait(e) ? 'big' : ''} ${sel ? 'sel' : ''}${s.duo ? ` duo duo-${s.duo}` : ''}${sqc}" style="${(() => { const ec = foeCell(s, geo); return cellBox(ec.x, ec.y); })()}"
      data-a="sel-enemy" data-v="${i}" data-drop="foe:${i}" title="${esc(`${e.name} — ${ENEMY_DESC[e.id] || ''} · ${tendText(e)}`)}">${hasPortrait(e)
        ? (() => { const cat = enemyCategory(e), td = TEND_NAME[e.tend], mod = s.mod || (s.stripped ? null : e.mod), its = [...(s.stripped ? [] : (e.items || []).filter((x): x is string => !!x)), ...(s.items || [])]; return `<div class="tk-card"><div class="tk-art">${sprite(e, '')}${mod ? `<span class="tk-mod">${itemIcon(mod, `data-a="foe-item" data-v="${mod}"`)}</span>` : ''}</div><span class="tk-side">${e.tier === 'minion' ? '' : `<b class="tk-rank tier-${e.tier}" title="${tierKo(e)}">${e.tier === 'boss' ? 'B' : 'E'}</b>`}<i class="cat-${cat}" title="${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}">${lineIcon(`k.${cat}`, 'li')}</i>${td ? `<i class="tk-tend" title="${esc(`${td.name}: ${td.desc}`)}">${lineIcon(`t.${e.tend}`, 'li')}</i>` : ''}</span><span class="tk-items">${[0, 1, 2].map((k) => (its[k] ? itemIcon(its[k], `data-a="foe-item" data-v="${its[k]}"`) : itemIcon(null))).join('')}</span></div>`; })()
        : sprite(e, '')}</div>`;
  });
  units += terrainIcons(tLay, cellBox, lift);
  units += craneLayer(run, geo, box); // 컨테이너 환적장: 빈 적재칸 (흐리게) · 크레인으로 옮길 자리
  units += deviceTokens(run, n, box);
  // 배치 미리보기: 고른 배치형 소모품 (또는 막힌 끌어 놓기 직후 한 번)
  const pv = devPv && isBattle && devPv.id === run.inventory[devPv.idx] && (placeSel === devPv.idx || devPv.once) ? devPv : null;
  if (devPv?.once) devPv.once = false; else if (!pv) devPv = null;
  units += `<div class="dev-pv-host">${pv ? devPvHtml(run, pv, ex) : ''}</div>`;
  // 창 가장자리 길잡이 (vpCueSync): 아군 진형 · 적 진형의 화면 사각형 (보이는 틀 기준 화면 칸) + 적 수. 아군 진형은 포탑 열까지
  const zoneScr = (x: number, y: number, w: number, h: number) => { const r = rectScr(geo, x, y, w, h); return [r.x - fr.ox, r.y - fr.oy, r.w, r.h]; };
  const foeN = (flip: boolean) => node?.enc?.enemies.filter((s) => !!s.flip === flip).length ?? 0;
  const zones = [{ k: 'ally', r: zoneScr(PAD - ex, geo.ay0, n + 2 * ex, geo.rows), n: deployed(run).length },
    ...(isBattle ? [{ k: 'foe0', r: zoneScr(PAD, PAD, n, ZONE), n: foeN(false) }] : []),
    ...(isBattle && geo.foe2 ? [{ k: 'foe1', r: zoneScr(PAD, geo.foe2, n, ZONE), n: foeN(true) }] : [])];
  const bench = run.units.filter((u) => !u.pos);
  const free = Math.min(cap, allyRoom(run, n)) - deployed(run).length; // 출전 한도와 아군 진형 칸 (장치 칸 제외) 중 작은 쪽
  const canFill = bench.some((u) => R.canDeploy(run, u));
  const pop = invDetail(run); // 보관 물품 팝업. 열려 있으면 쥔 도구 칩을 띄우지 않는다 (이름이 겹친다, docs/UI.md 15 — 놓기 취소는 팝업의 [취소] · Esc). 팝업을 닫고 계속 놓는 동안 · 크레인만 보드 창 위에 겹친 '하는 중' 칩
  const picked = !!app.sel && app.sel.k !== 'item' && app.sel.k !== 'relic'; // 상세가 있는 선택 (기물 · 적 · 지형 · 포탑 · 공왕)
  const foldR = !!loadPrefs().prepFold && !picked; // 접어 둔 패널도 무언가를 고르면 저절로 펼치고, 선택을 풀면 다시 접힌다
  const benchOff = !!loadPrefs().benchOff; // 대기석 숨김 (보는 사람마다): 대기석 상자 오른쪽 위 단추로 숨기기 · 보이기 (숨기면 같은 자리에 얇은 띠), 보드의 기물을 끄는 동안은 화면 아래 놓을 자리 (BENCH_DOCK)
  return `<main class="wrap prep${foldR ? ' fold-r' : ''}">
    <aside class="side left">
      <h2>시너지</h2><div class="syn-list">${synergyPanel(run)}</div>
    </aside>
    <section class="board-col"${benchOff && benchPadB ? ` style="padding-bottom:${benchPadB}px"` : ''}>
      <div class="board-head">${node?.enc ? boardTitle(node.enc, node.type) : '<span class="bh-title"><b class="bh-name">편성 관리</b></span>'}<span class="pill dep-pill" title="출전 인원 / 출전 한도">출전 <b>${deployed(run).length}</b>/${cap}</span>${tacPill(run)}<span class="muted small bh-rows">${geo.foe2 ? '가운데' : geo.rot ? '왼쪽' : '아래'} ${geo.rows}줄에 배치</span>${noRoom.length ? `<span class="small warn" title="${esc(`배치 구역에 빈칸이 없음: ${noRoom.map((t) => t.name).join(' · ')} — 전투에서 가까운 빈칸에 나온다`)}">소환 자리 없음 ${noRoom.length}</span>` : ''}
        ${free > 0 && canFill ? `<span class="small warn">빈 자리 ${free}</span><button class="btn tiny" data-a="autofill" title="단축키 A">자동 배치</button>` : ''}</div>
      <div class="board-wrap">${prepZoomCtl()}<div class="board-main">
      <div class="board-row"><div class="board-vp"><div class="board${geo.rot ? ' rot' : ''}${placeSel >= 0 ? ' placing' : ''}"${placeSel >= 0 ? ` data-pidx="${placeSel}"` : ''} style="--w:${bw};--h:${bh}" data-bw="${bw}" data-bh="${bh}" data-ex="${ex}" data-zones='${JSON.stringify(zones)}'><div class="cells">${cells}</div>${zone?.html ?? ''}${units}${startOverlay(run, geo, ex)}</div></div><div class="vp-cues"></div>${tool && !pop && (tool.k === 'place' || tool.k === 'crane' || !app.ask) ? `<div class="tool-ovl">${toolChip(run, tool)}</div>` : ''}${invRail(run)}</div>
      </div></div>
      <div class="bench${benchOff ? ' off' : ''}" data-drop="bench">
        <span class="bench-label">대기석 <b>${bench.length}</b></span>${benchTog(benchOff)}
        ${benchOff ? '' : bench.length ? bench.map((u) => {
          const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
          return `<div class="bench-u u side0 tk ${sel ? 'sel' : ''}" data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}" data-syns="${memberships(u, run).join(' ')}" title="${esc(UNIT_BY_ID[u.defId].name)} · 공명 등급 ${u.rank}">${allyCard(u)}</div>`;
        }).join('') : '<span class="muted small">기물을 여기로 끌어 출전에서 뺄 수 있습니다.</span>'}
      </div>
      <div class="sticky-actions">
        ${isBattle ? `<button class="btn ghost" data-a="to-map">맵으로</button><button class="btn primary" data-a="fight" title="단축키 Space" ${deployed(run).length ? '' : 'disabled'}>전투 시작</button>`
          : `<button class="btn primary" data-a="to-map">완료</button>`}
      </div>
    </section>
    <aside class="side right">${foldTog(foldR)}${foldR ? '' : detailPanel(run)}</aside>
    ${statPopHtml(run)}${BENCH_DOCK}${pop}
  </main>`;
}

/** 편성 아군 카드형 토큰 (보드 · 대기석 공용): [초상화 + 개조부품 / 장비 3칸] | [공명 등급 · 전술 유형 · 전투 유형]. 장비 · 개조부품은 꾹 눌러 끌기 */
/** 편성 보드 기물 토큰. fixed = 장비를 옮길 수 없는 기물 (공왕 무휼의 전용 장비: 칸은 보이되 끌기 · 놓기 없음) */
function allyCard(u: UnitState, fixed = false) {
  const d = UNIT_BY_ID[u.defId];
  const slot = (it: string | null, k: number) => (!it ? itemIcon(null) : fixed ? `<span class="tk-it" title="${esc(`${itemInfo(it).name} — ${itemInfo(it).desc}`)}">${itemIcon(it)}</span>`
    : `<span class="tk-it" data-a="item-info" data-v="${u.uid}:${k}" data-drag="eq:${u.uid}:${k}" data-drop="eqitem:${u.uid}:${k}" data-hold>${itemIcon(it)}</span>`);
  return `<div class="tk-card"><div class="tk-art">${sprite(d, '')}${u.mod && !fixed ? `<span class="tk-mod" data-a="item-info" data-v="${u.uid}:-1" data-drag="eq:${u.uid}:-1" data-drop="eqitem:${u.uid}:-1" data-hold>${itemIcon(u.mod)}</span>` : ''}</div>
        <span class="tk-side"><b class="tk-rank" title="공명 등급 ${u.rank}">${u.rank}</b><i class="tt-${d.ttype}" title="${TTYPE_NAME[d.ttype]}">${typeIcon(d.ttype)}</i><i class="ct-${d.ctype}" title="${CTYPE_NAME[d.ctype]}">${typeIcon(d.ctype)}</i></span>
        <span class="tk-items">${(fixed ? [...u.items, null, null, null].slice(0, Math.max(3, u.items.length)) : u.items).map((it, k) => slot(it, k)).join('')}</span></div>`; // 무휼: 해금 전 전용 장비 칸도 빈칸으로 (기물과 같은 3칸)
}
/** 편성 보드 소환물 토큰: 기물 토큰과 같은 틀 · 같은 높이, 장비 칸은 보이지 않는다 (공명 등급 칸 자리 = 소환물 표시) */
function summonCard(t: CompanionTok) {
  const ty = (k?: string) => (k && (TTYPE_NAME as Record<string, string>)[k] ? `<i class="tt-${k}" title="${(TTYPE_NAME as Record<string, string>)[k]}">${typeIcon(k as never)}</i>` : k && (CTYPE_NAME as Record<string, string>)[k] ? `<i class="ct-${k}" title="${(CTYPE_NAME as Record<string, string>)[k]}">${typeIcon(k as never)}</i>` : '');
  return `<div class="tk-card"><div class="tk-art">${sprite(t.spr, '')}</div>
        <span class="tk-side"><i class="tk-summon" title="소환물">${lineIcon('a.summon', 'li')}</i>${ty(t.ttype)}${ty(t.ctype)}</span>
        <span class="tk-items tk-none" aria-hidden="true">${itemIcon(null)}${itemIcon(null)}${itemIcon(null)}</span></div>`; // 장비 칸 자리는 비워 두되 높이는 기물 토큰과 같게
}
const TURRET_SPR = { sprite: 'turret', palette: TURRET_PAL, art: 'sm_turret' };
/** 개전 예측 (편성 화면, 선택한 출전 기물 · 적): 예상 이동 경로 · 병목 칸 · 첫 공격 목표를 보드 위에 (engine/preview.ts) */
function selPreview(run: RunState) {
  const sel = app.sel, enc = run.node?.enc;
  if (!enc) return null;
  if (sel?.k === 'enemy') return enc.enemies[sel.i] ? startPreview(run, enc).get(foeKey(sel.i)) || null : null;
  if (sel?.k !== 'unit') return null;
  const u = run.units.find((x) => x.uid === sel.uid);
  if (!u?.pos) return null;
  return startPreview(run, enc).get(u.uid) || null;
}
function startOverlay(run: RunState, g: Geo, ex: number) {
  const p = selPreview(run);
  if (!p) return '';
  const { ox, oy, bw, bh } = prepFrame(g, ex);
  const cx = (x: number, y: number) => toScr(g, x, y).x - ox + 0.5, cy = (x: number, y: number) => toScr(g, x, y).y - oy + 0.5; // 칸 중심 (화면 칸 단위)
  const pct = (x: number, y: number) => `left:${(cx(x, y) / bw) * 100}%;top:${(cy(x, y) / bh) * 100}%`;
  const pts = p.path.map((q) => `${cx(q.x, q.y)},${cy(q.x, q.y)}`);
  const last = p.path[p.path.length - 1];
  const box = (x: number, y: number, cls: string) => `<rect class="${cls}" x="${cx(x, y) - 0.42}" y="${cy(x, y) - 0.42}" width="0.84" height="0.84" vector-effect="non-scaling-stroke"/>`;
  const svg = `<svg class="fc-ovl" viewBox="0 0 ${bw} ${bh}" preserveAspectRatio="none" aria-hidden="true">
    ${p.path.length > 1 ? `<polyline class="fc-path" points="${pts.join(' ')}" vector-effect="non-scaling-stroke"/>` : ''}
    ${p.target ? `<line class="fc-aim" x1="${cx(last.x, last.y)}" y1="${cy(last.x, last.y)}" x2="${cx(p.target.x, p.target.y)}" y2="${cy(p.target.x, p.target.y)}" vector-effect="non-scaling-stroke"/>${box(p.target.x, p.target.y, 'fc-tgt')}` : ''}
    ${p.waits.map((w) => box(w.x, w.y, 'fc-wait')).join('')}
  </svg>`;
  const tags = [
    ...p.waits.map((w) => `<span class="fc-tag wait" style="${pct(w.x, w.y)}">병목 ${w.dur.toFixed(1)}초</span>`),
    ...(p.target ? [`<span class="fc-tag tgt" style="${pct(p.target.x, p.target.y)}">첫 목표${p.firstAtk !== undefined ? ` ${p.firstAtk.toFixed(1)}초` : ''}</span>`] : []),
  ].join('');
  return `<div class="fc-layer">${svg}${tags}</div>`;
}
/** 기물 상세의 개전 예측 칩 (이름 + 값) */
function startChips(run: RunState) {
  const p = selPreview(run);
  if (!p) return '';
  const moves = p.path.length - 1, worst = p.waits.reduce((m, w) => Math.max(m, w.dur), 0);
  const chip = (k: string, v: string, cls = '') => `<span class="fc-chip${cls ? ` ${cls}` : ''}"><small>${k}</small><b>${v}</b></span>`;
  return `<div class="fc-chips" title="실제 전투와 같은 시드로 첫 ${PREVIEW_SECS}초를 미리 돌린 결과 (보드에 경로 · 병목 · 첫 목표 표시)"><h3>개전 예측</h3>
    ${chip('첫 목표', p.target ? esc(p.target.name) : '없음', p.target ? 'tgt' : '')}${chip('첫 공격', p.firstAtk !== undefined ? `${p.firstAtk.toFixed(1)}초` : `${PREVIEW_SECS}초 안에 없음`)}${chip('이동', `${moves}칸`)}${chip('병목', p.waits.length ? `${p.waits.length}곳 · 최대 ${worst.toFixed(1)}초` : '없음', p.waits.length ? 'wait' : '')}</div>`;
}
/** 감시 포탑 상세: 미리보기 전투에서 실제 포탑 능력치를 읽는다 */
function turretDetail(run: RunState, i: number, bar: string) {
  const n = run.node?.enc?.n || CFG.bossBoard;
  const b = buildBattle(run, { n, env: '', enemies: [], mult: 1, seed: 1 }, false);
  const t = b.units.find((u) => u.defId === 'turret' && u.mem.turretIdx === i);
  const mods = run.turretMods || [];
  const row = (k: string, v: string) => `<dt>${k}</dt><dd>${v}</dd>`;
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  return `<div class="detail">${bar}
    ${heroHead('', sprite(TURRET_SPR, 'spr big'), `감시 포탑 ${i + 1}`, `<span class="tag cat-mech">${lineIcon('k.mech', 'li')}기계</span><span class="tag">구조물</span><span class="tag">엔지니어 소환물</span>`)}
    <div class="small muted">기계: ${esc(CATEGORY_RULE.mech)}<br>구조물: ${esc(CATEGORY_RULE.struct)}</div>
    ${t ? `<dl class="stats">${row('최대 내구도', fmt(t.st.maxHp))}${row('사격 위력', fmt(t.st.shoot))}${row('방어도', fmt(t.st.armor))}${row('공격 속도', `+${Math.round(t.st.atkSpd * 100)}%`)}${row('명중', pc(t.st.acc))}${row('치명타 확률', pc(t.st.crit))}${row('치명타 피해', pc(t.st.critDmg))}${row('사거리', String(t.st.range))}${row('피해 속성', ELEM_NAME[t.atk.elem])}${row('모든 주요 능력치', `+${t.mem.turretMaj || 0}`)}</dl>` : '<p class="muted small">엔지니어가 출전해야 포탑이 설치됩니다.</p>'}
    <h3>포탑 장비 ${kvChip('고름', `<b>${mods.length}</b>/${ENG_TUR.picks}`, '모든 포탑 공통')}</h3>
    <div class="t-gear">${mods.length ? mods.map((id) => `<div class="t-slot">${itemIcon(id)}<div><b>${esc(TURRET_GEAR[id]?.name || id)}</b><div class="small muted">${statIc(esc(TURRET_GEAR[id]?.desc || ''))}</div></div>${kvChip('모든 주요 능력치', `<b>+${ENG_TUR.modMaj}</b>`)}</div>`).join('') : '<p class="muted small">아직 고른 장비가 없습니다.</p>'}</div>
    <p class="muted small">${TURRET_RULES.map((x) => `${x[0]}: ${x[1]}`).join('. ')}.</p>
  </div>`;
}

/** 무휼 성장 칸: 성장 상태 (단계 · 누적) | 다음 승리 수집량 | 수집 근거 (기본 몫 · 장비 몫 · 청라 배율). 수치는 chungra.ts (causalGain) */
function kingCells(run: RunState, pts: number, n: number, hi: number, left: number, t: number, g: { total: number; gear: number; score: number }) {
  const m = CAUSAL.mult[Math.min(CAUSAL.mult.length - 1, t)] || 0, chr = synergyCounts(deployed(run), run).CHR || 0;
  const cell = (k: string, v: string, sub: string) => `<div class="kg-c"><span class="kg-k">${k}</span><b class="kg-v">${v}</b><span class="kg-s">${sub}</span></div>`;
  return `<div class="kg-cells">
    ${cell('성장 상태', n >= CAUSAL.max ? `${pts}` : `${pts}<small>/${hi}</small>`, n >= CAUSAL.max ? '누적 인과율 · 최고 단계' : `누적 인과율 · ${n + 1}단계까지 ${left}`)}
    ${cell('다음 승리 수집량', m ? `+${g.total}` : '—', m ? '예상 · 이긴 전투마다' : `${SYN_BY_ID.CHR.name} ${SYN_BY_ID.CHR.tiers[0]}명 이상 출전 시`)}
    <div class="kg-c kg-why"><span class="kg-k">수집 근거</span><div class="sh-row">
      ${kvChip('기본 몫', `<b>+${g.total - g.gear}</b>`, `기본 ${CAUSAL.base} × 청라 배율`)}
      ${kvChip('장비 몫', `<b>+${g.gear}</b>`, `출전 아군 장비 점수 ${g.score} ÷ ${CAUSAL.gearDiv} × 청라 배율 (재료 ${CAUSAL.gearPts.C} · 고급 ${CAUSAL.gearPts.G} · 희귀 ${CAUSAL.gearPts.A} · 전설 ${CAUSAL.gearPts.L})`)}
      ${kvChip('청라 배율', `<b>×${m}</b>`, `${SYN_BY_ID.CHR.name} ${chr}명 (단계별 ${CAUSAL.mult.slice(1).map((x) => `×${x}`).join(' · ')})`, m ? '' : 'zero')}
    </div></div>
  </div>`;
}
/** 공왕 무휼 상세 (기물 상세 형식): 인과 단계 · 인과율 · 능력치 · 전용 장비 · 능력. 미리보기 전투에서 실제 수치를 읽는다 */
function kingDetail(run: RunState, bar: string) {
  const d = UNIT_BY_ID.muhyul, vu = kingState(run);
  const counts = synergyCounts(deployed(run), run);
  const b = new Battle(9, 9, new Rng(1), { phase: run.phase, credits: run.credits });
  b.keepEvents = false;
  const c = buildAlly(b, run, vu, counts);
  c.isSummon = true; c.mem.tacOk = 1; c.mem.king = 1;
  for (const o of deployed(run)) b.add(buildAlly(b, run, o, counts));
  b.add(c);
  b.computeTac();
  const pts = run.causal || 0, n = causalStage(pts), left = causalLeft(pts), t = chrTier(run);
  const lo = causalNeed(n), hi = causalNeed(Math.min(CAUSAL.max, n + 1));
  const prog = n >= CAUSAL.max ? 100 : Math.round(((pts - lo) / Math.max(1, hi - lo)) * 100);
  const g = causalGain(run, t);
  const tm = totalMajors(vu, unitEffects(run, vu, counts, true));
  const gearRow = KING_GEAR.map((id, i) => vu.items.includes(id)
    ? `<div class="t-slot">${itemIcon(id)}<div><b>${esc(itemInfo(id).name)}</b><div class="small muted">${statIc(esc(itemInfo(id).desc))}</div></div></div>`
    : `<div class="t-slot empty">${itemIcon(null)}<span class="muted small">청라공국 ${[3, 5, 7][i]}명에 처음 닿으면 [${esc(KING_GEAR_NAME[id])}] 해금 · 자동 장착</span></div>`).join('');
  return `<div class="detail dp-unit dp-king">${bar}
    <div class="d-hero">${hero(d.id) || `<div class="hero none">${sprite(d, 'spr big')}</div>`}
      <div class="dh-name"><b>${esc(d.name)}</b><span class="dh-types"><i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i><i>공왕 · 소환</i></span></div></div>
    <div class="dh-rank king-rank"><span class="dh-r" title="공명 등급 대신 인과 단계">인과 ${n}단계</span><span class="xpbar" title="누적 인과율 ${pts}"><i style="width:${prog}%"></i></span><span class="small muted">${n >= CAUSAL.max ? '최고 단계' : `다음까지 ${left}`}</span></div>
    ${kingCells(run, pts, n, hi, left, t, g)}
    ${kingOn(run) ? '' : '<p class="small warn">청라공국 기물이 3명 이상 출전해야 전투에 소환됩니다. 쌓은 인과율은 그대로 남습니다.</p>'}
    ${powRow(b, c, d, true)}
    <h3>인과 단계 효과</h3><p class="small">${esc(kingStageText(n))}</p>
    <ul class="small king-ms">${KING_MS_TEXT.map((x, i) => `<li class="${n >= KING.ms[i] ? 'on' : 'muted'}">${esc(x)}</li>`).join('')}</ul>
    <h3>전용 장비 <span class="muted small">일반 장비는 장착할 수 없음 (장비 점수에는 셈)</span></h3><div class="t-gear">${gearRow}</div>
    <div class="mj-wrap"><div class="mj-head"><h3>주요 능력치</h3></div>
    <div class="majors">${MAJORS.map((m) => { const add = tm[m] - d.base[m]; return `<div class="major"><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`; }).join('')}</div></div>
    <dl class="stats"><dt>최대 내구도</dt><dd>${fmt(b.S(c, 'maxHp'))}</dd><dt>사격 위력</dt><dd>${fmt(b.S(c, 'shoot'))}</dd><dt>방어도</dt><dd>${fmt(b.S(c, 'armor'))}</dd><dt>사거리</dt><dd>${b.S(c, 'range')}</dd></dl>
    <h3>능력</h3>
    <div class="abils">
      ${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}
      ${traitGroup(d, null, run, b, c)}
      ${skillCard(d, b, c)}
      ${ultCard(d, b, c)}
    </div>
    <p class="lore">${esc(d.lore)}</p>
  </div>`;
}

/** 편성 표 오른쪽 세로 보관 칸 (장비 · 이후 소모품). 기물에게 끌어다 장착, 재료끼리 겹치면 조합 */
function invRail(run: RunState) {
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1; // 고른 (쥔) 물품 = 토큰에 붙은 호박색 실선 (docs/UI.md 13), 받을 수 없는 것은 toolMark 가 흐린다
  return `<div class="inv-rail" data-drop="inv" title="기물에게 끌어다 장착 · 재료끼리 겹치면 조합">
    <span class="ir-count">${R.invSlots(run)}/${CFG.inventoryMax}</span>
    <div class="ir-items">${invTokens(run, selIdx)}${run.inventory.length ? '' : '<span class="ir-empty muted">비어 있음</span>'}${relicInv(run)}</div>
  </div>`;
}
/** 상점 등: 가로 보관 칸 */
function inventoryPanel(run: RunState) {
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  return `<div class="inv" data-drop="inv" title="재료끼리 겹치면 조합"><span class="ir-count">${R.invSlots(run)}/${CFG.inventoryMax}</span>
    <div class="inv-items">${invTokens(run, selIdx) || '<span class="muted small">비어 있음</span>'}${relicInv(run)}</div></div>${invDetail(run)}`;
}
/** 보관함 칸: 같은 소모품은 첫 칸 하나로 겹치고 원형 토큰에 개수 (표시 망원경의 사용 횟수와 같은 자리). 고른 칸 · 강조 칸은 겹친 묶음 어느 칸이든 */
function invGroups(run: RunState): { i: number; all: number[] }[] {
  const first = new Map<string, { i: number; all: number[] }>(), out: { i: number; all: number[] }[] = [];
  run.inventory.forEach((id, i) => {
    const g = isConsumable(id) ? first.get(id) : undefined;
    if (g) { g.all.push(i); return; }
    const ng = { i, all: [i] };
    out.push(ng);
    if (isConsumable(id)) first.set(id, ng);
  });
  return out;
}
function invTokens(run: RunState, selIdx: number) {
  return invGroups(run).map(({ i, all }) => {
    const id = run.inventory[i], on = all.includes(selIdx) || all.some((k) => app.ask?.hl?.includes(k));
    return itemIcon(id, `data-drag="item:${i}" data-drop="invitem:${i}" data-a="sel-item" data-v="${i}"`, breadNote(run, i), all.length).replace('class="item', `class="item${on ? ' sel' : ''}`);
  }).join('');
}
/** 보관 중인 성유물: 소모품처럼 보관 칸에 항상 표시. 디바인에게 끌어다 놓거나 선택 후 디바인을 누르면 장착 */
function relicInv(run: RunState) {
  const rs = run.relics || [];
  if (!rs.length) return '';
  const sel = app.sel?.k === 'relic' ? app.sel.id : null;
  return `<span class="ir-sep" title="성유물"></span>${rs.map((id) => relicTok(id, `data-drag="relic:${id}" data-a="sel-relic" data-v="${id}"`, id === sel)).join('')}`; // 고른 성유물 = 쥔 도구 (디바인에게 장착): 장비와 같은 호박색 실선
}
/** 배치형 소모품을 놓는 중 (편성 화면 · 조우): 팝업의 ✕ 는 팝업만 닫고 (놓기는 계속, 행동 칩이 대신 보인다) 바닥 줄 [취소] = Esc = 놓기 취소 */
const placingSel = (run: RunState) => app.screen === 'prep' && app.sel?.k === 'item' && !!run.node?.enc && isPlaceable(run.inventory[app.sel.idx]);
const popKey = (run: RunState) => (app.sel?.k === 'item' ? `${app.sel.idx}:${run.inventory[app.sel.idx]}` : '');
/** 고른 보관 물품: 설명 · 판매 */
function invDetail(run: RunState) {
  const placing = placingSel(run);
  if (placing && app.popOff === popKey(run)) return ''; // 팝업만 닫아 둠 (쥔 배치 도구는 그대로)
  const xBtn = placing ? '<button class="btn tiny ip-x" data-a="pop-off" title="팝업 닫기 — 놓기는 계속 (취소는 Esc)" aria-label="팝업 닫기 (놓기는 계속)">×</button>'
    : '<button class="btn tiny ip-x" data-a="sel-clear" aria-label="닫기">×</button>';
  const pop = (icon: string, kind: string, name: string, stats: string, eff: string, foot: string) =>
    `<div class="inv-pop" role="dialog" aria-label="${esc(name)}"><div class="ip-head">${icon}<div><span class="ip-kind">${kind}</span><b>${esc(name)}</b></div>${xBtn}</div>${stats}${eff ? `<p class="ip-eff">${eff}</p>` : ''}${foot ? `<div class="ip-foot">${foot}</div>` : ''}</div>`;
  if (app.sel?.k === 'relic') {
    const r = RELIC_BY_ID[app.sel.id];
    if (!r) return '';
    return pop(relicTok(r.id), '성유물', r.name, `<div class="ip-stats"><span>${lineIcon('a.divact', 'li')}신권 대행 · 강화 권능 ${r.enh}</span></div>`, statIc(esc(r.desc(1))),
      '<span class="muted small">디바인 기물에 끌어다 놓거나, 선택한 채로 디바인을 누르면 장착합니다.</span>');
  }
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  const sel = selIdx >= 0 ? run.inventory[selIdx] : null;
  if (!sel) return '';
  if (app.ask) return ''; // 확인 팝업이 같은 자리(보관함 오른쪽)를 쓴다
  const it = itemInfo(sel);
  const TIER: Record<string, string> = { C: '재료', G: '고급', A: '희귀', L: '전설', S: '합성 재료', M: '개조부품', K: isLegendConsumable(sel) ? '전설 소모품' : '소모품', U: '고유' };
  const { stats: stats0, eff: eff1 } = itemBrief(sel);
  const stats = isPlaceable(sel) ? stats0 + devicePop(run, sel) : stats0; // 배치형: 성질 줄 (망원경은 모드 · 범위 · 횟수 도식)
  const eff = eff1 + (breadNote(run, selIdx) ? ` — 이 빵: ${breadNote(run, selIdx)}` : '');
  const ct = isConsumable(sel) ? CONSUMABLES[sel].target : null;
  // 놓는 중: 바닥 줄 = [판매] · [자세히] · [취소] 한 줄 + 조작 안내 한 줄 (ip-hint)
  const hint = ct === 'place' ? `${run.node?.enc ? '<button class="btn tiny ip-more" data-a="ip-more" aria-expanded="false">자세히</button>' : ''}${placing ? '<button class="btn small ip-cancel" data-a="sel-clear" title="놓기 취소 (Esc)">취소</button>' : ''}<span class="muted small${placing ? ' ip-hint' : ''}">${run.node?.enc ? (sel === 'K_barricade' ? '칸 누르기 · 끌어다 놓기 · 몸통 끌기 = 옮기기 · 화살표 끌기 = 늘리기 · 누르면 회수' : '칸 누르기 · 끌어다 놓기 · 놓은 뒤 누르면 회수') : '전투 편성 화면에서 사용'}</span>`
    : ct === 'run' ? `<button class="btn small primary" data-a="use-self" data-v="${selIdx}">사용</button>`
    : ct === 'foe' ? `<span class="muted small">${run.node?.enc ? '이번 전투의 적에게 끌어다 놓거나, 선택한 채로 적을 누르면 사용' : '전투를 앞둔 편성 화면에서 적에게 끌어다 놓아 사용'}</span>`
    : ct ? `<span class="muted small">${CONSUMABLES[sel].alsoItem ? '기물 · 장비' : ct === 'unit' ? '기물' : '장비'}에 끌어다 놓거나, 선택한 채로 ${CONSUMABLES[sel].alsoItem ? '기물 · 장비를' : ct === 'unit' ? '기물을' : '장비를'} 누르면 사용</span>`
    : run.inventory.some((x, j) => j !== selIdx && combine(sel, x)) ? '<span class="muted small">조합 가능한 장비를 누르면 조합</span>' : '';
  // 판매는 소모품만 (장비 · 개조부품은 팔 수 없다)
  const html = pop(itemIcon(sel), TIER[sel.startsWith('U_') ? 'U' : it.tier] || '', it.name, stats, eff ? statIc(esc(eff)) : '', `${ct && sel !== 'K_scope' ? `<button class="btn small" data-a="sell" data-v="${selIdx}">판매 +${R.sellPrice(run, sel)}</button>` : ''}${hint}`);
  return ct === 'place' && run.node?.enc ? html.replace('class="inv-pop"', 'class="inv-pop ip-placing"') : html; // 놓는 중: 좁은 화면 하단 시트는 머리 · 바닥 줄만 (보드를 덜 가리게)
}
/** 물품 요약: 주요 능력치 줄 + 효과 문장 (설명에서 능력치 접두어를 뗀 것). 보관함 정보 팝업 · 조합 확인 팝업 공용 */
function itemBrief(id: string) {
  const it = itemInfo(id);
  const ms = Object.entries(it.majors || {}) as [Major, number][];
  const rf = refineLv(id), pots = potsOf(id), slots = potSlots(id);
  const rfChip = rf ? `<span>${RF_GEM}제련 <b>${rf}</b>단계</span>` : ''; // 제련 단계: 능력치 줄 끝에
  const statRow = ms.length ? `<div class="ip-stats">${ms.map(([m, v]) => `<span>${majorIcon(m)}${MAJOR_NAME[m]} <b>+${v}</b></span>`).join('')}${rfChip}</div>` : '';
  // 잠재능력 칸: 열린 것 = 이름 + 값, 남은 칸 = 빈 칸 (희귀 · 전설만)
  const potRow = slots ? `<div class="ip-pots">${pots.map((k) => `<span class="ip-pot">${POT_PIP}<b>${esc(POTS[k]?.name || '?')}</b>${esc(POTS[k]?.desc || '합성할 때 결정')}</span>`).join('')}${slots > pots.length ? `<span class="ip-pot empty">${POT_PIP}<span>빈 잠재능력 칸 ${slots - pots.length}개 · ${esc(itemInfo(CRYSTAL).name)}로 개방</span></span>` : ''}</div>` : '';
  const stats = statRow + potRow;
  // 능력치 줄(ip-stats)로 따로 보여 주는 '생명력 +6, 방어력 +6.' 접두어 · 제련 단계 · 잠재능력만 뗀다 — 능력치가 없는 소모품 · 개조부품 · 포탑 장비는 설명 전체 ('공명도 +8.' 등)
  const eff0 = it.desc.replace(/^\[[^\]]+\]\s*/, '');
  const eff = ms.length ? eff0.replace(/^([^.,]+ \+\d+(, )?)+/, '').replace(/^\s*\(제련 \d+단계[^)]*\)/, '').replace(/^\.?\s*/, '').replace(/\s*잠재능력: .*$/, '') : eff0;
  return { stats, eff };
}

/** 체력 표기: 구조물(포탑 · 반려 돌(인화성) 등)은 '최대 내구도' */
const hpLabel = (c: CUnit) => (c.category === 'struct' ? '최대 내구도' : '최대 체력');
function statLines(c: CUnit, b: Battle) {
  const S = (k: keyof CUnit['st']) => b.S(c, k);
  const armor = S('armor');
  // 마이너 능력치: 흰색 선 아이콘 + 이름 + 값
  const lines: [string, string, string, string?][] = [
    ['r.hp', hpLabel(c), fmt(S('maxHp'))], ['a.heal', '회복 효율', '+' + pctTxt(S('healEff'))],
    ['p.shoot', '사격 위력', fmt(S('shoot'))], ['p.strike', '타격 위력', fmt(S('strike'))], ['p.tech', '기술 위력', fmt(S('tech'))],
    ...(c.ctype === 'CMD' && (!c.isSummon || c.mem.tacOk) ? [['p.tac', '전술 위력', fmt(b.tacPower(c))] as [string, string, string]] : []),
    ['u.target', '명중', '+' + pctTxt(S('acc'))], ['u.finish', '치명타', pctTxt(S('crit'))], ['a.power', '치명타 피해', pctTxt(S('critDmg'))], ['a.stun', '효과 명중', '+' + pctTxt(S('effHit'))],
    ['a.shield', '방어도', `${fmt(armor)} (물리 -${pctTxt(armor / (armor + CFG.armorK))})`], ['a.reason', '효과 저항', '+' + pctTxt(S('effRes'))],
    ['a.speed', '이동 속도', pctTxt(S('moveSpd')), moveRule(c)], ['a.evade', '회피', pctTxt(S('eva'))],
    ['u.combo', '공격 속도', `${(Math.max(0.2, 1 + S('atkSpd')) / c.atk.interval).toFixed(2)}/초`], ['a.cd', '쿨다운 감소', '+' + pctTxt(S('cdr'))], ['u.range', '사거리', String(S('range'))],
  ];
  if (S('armorPen')) lines.push(['a.snipe', '방어도 관통', pctTxt(S('armorPen'))]);
  if (S('lifesteal')) lines.push(['a.heal', '흡혈', pctTxt(S('lifesteal'))]);
  return `<dl class="stats">${lines.map(([ic, k, v, tip]) => `<dt${tip ? ` title="${esc(tip)}"` : ''}>${lineIcon(ic, 'li')}${k}</dt><dd${tip ? ` title="${esc(tip)}"` : ''}>${v}</dd>`).join('')}</dl>`;
}
/** 이동 속도 계산 규칙 (능력치 줄 툴팁 · 도감): 아군 기물 · 적 (데이터 CFG · enemyBaseMoveSpd 에서 읽는다) */
const agiMovePp = () => `${+(CFG.conv.agi.moveSpd * 100).toFixed(1)}%p`;
function enemyMoveRule(e: EnemyDef) {
  const mul = e.moveSpd ?? 1, base = e.tend === 'assassin' ? CFG.enemyMoveSpd.assassin : CFG.enemyMoveSpd.base;
  const why = [e.tend === 'assassin' ? `암살형 ${mul !== 1 ? pctTxt(base) : ''}`.trim() : mul !== 1 ? pctTxt(base) : '', mul !== 1 ? `이동 배율 ${mul}` : ''].filter(Boolean).join(' × ');
  return `기본 이동 속도 ${pctTxt(enemyBaseMoveSpd(e))}${why ? ` (${why})` : ''} + 기동력 1당 ${agiMovePp()}`;
}
function moveRule(c: CUnit): string {
  if (c.side === 1 && ENEMY_BY_ID[c.defId] && !c.mem.echoOf) return enemyMoveRule(ENEMY_BY_ID[c.defId]);
  if (c.side === 0 && c.src) return `기본 ${pctTxt(CFG.unitMoveSpd)} + 기동력 1당 ${agiMovePp()}`;
  return '';
}

function previewAlly(run: RunState, u: UnitState) {
  const b = new Battle(9, 9, new Rng(1), { phase: run.phase, credits: run.credits });
  b.keepEvents = false;
  const counts = synergyCounts(deployed(run), run);
  const tmp = { ...u, pos: u.pos || { c: 0, r: 0 } };
  const c = u.pos ? buildAlly(b, run, tmp, counts) : buildAlly(b, null, tmp, {});
  // 전술 위력: 출전 아군 구성으로 계산
  b.add(c);
  for (const o of deployed(run)) if (o.uid !== u.uid) b.add(buildAlly(b, run, o, counts));
  b.computeTac();
  return { b, c };
}

// ───────────────────────── 능력 (통일 형식 · 누르면 좌측 상세 팝업)
/** 능력 문장 계산 맥락. 전투 밖(도감 · 상세)에서는 기물 기본 스킬 파라미터로 @파라미터를 채운다 */
const actx = (b: Battle | null, c: CUnit | null, skill = false, d?: UnitDef | null): AB.AbilCtx => ({ b, c, p: c?.sk || d?.skill.params || {}, skill });
const abilOn = (k: string) => (app.abilPop === k ? ' on' : '');
/** 능력 아이콘 토큰 (없으면 빈 문자열). 키: skill.<기물> · trait.<기물> · ult.<기물> · weapon.<기물> · cantrip/passive.<전공> · faith.<신앙> */
function abTok(ic?: string) {
  const src = ic ? ABIL_ICONS[ic] : '';
  if (!src && ic?.startsWith('ult.')) return '<span class="ab-tok ab-tok-ph" aria-hidden="true">✦</span>'; // 아이콘을 아직 뽑지 않은 궁극기: 임시 자리표시
  return src ? `<img class="ab-tok" src="${src}" alt="" draggable="false">` : '';
}
function abilCard(key: string, kind: keyof typeof AB_KIND, name: string, meta: string, body: string, extra = '', ic?: string) {
  const tok = abTok(ic);
  return `<div class="abil ab-${kind} ab-click${abilOn(key)}${tok ? ' has-tok' : ''}" data-a="abil-pop" data-v="${esc(key)}" role="button" tabindex="0">${tok}<div class="ab-head"><span class="ab-kind">${AB_KIND[kind]}</span><b>${name.startsWith('<svg') ? name.replace(/(<\/svg>)(.*)$/, (_m, x, t) => x + esc(t)) : esc(name)}</b>${meta ? `<span class="ab-meta">${meta}</span>` : ''}</div>${body}${extra}</div>`;
}
function weaponCard(w: Weapon, b: Battle | null, c: CUnit | null, elem = w.elem, uid?: string) {
  const ic = uid ? `weapon.${uid}` : undefined;
  if (w.kind === 'none') return abilCard('weapon', 'weapon', w.name, '', '<p>기본 공격을 하지 않는다.</p>', '', ic);
  const range = b && c ? b.S(c, 'range') : w.range;
  return abilCard('weapon', 'weapon', w.name, WPOS(range), `<div class="ab-chips">${AB.weaponChips(w, actx(b, c), range, elem)}</div>`, '', ic);
}
/** 메이저 궁극기 카드 (스킬과 같은 모양) */
function ultCard(d: UnitDef, b: Battle | null, c: CUnit | null, live = false) {
  const ul = ULTS[d.id];
  if (!ul || d.ttype !== 'major') return '';
  const eff = c && b ? b.S(c, 'ultCharge') : 0;
  const sec = (CFG.ultTime * CFG.ultNeed) / (ul.charge * Math.max(0.1, 1 + eff));
  const chips = `<div class="ab-chips"><span class="abc" title="자연 충전 주기">${lineIcon('a.cd', 'li')}${sec.toFixed(0)}초</span><span class="abc" title="전투 시작 게이지">${lineIcon('a.battery', 'li')}시작 ${Math.round((CFG.ultStart + (c?.mem.ultStart || 0)) * 100)}%</span>${live && c ? `<span class="abc v">${Math.round((c.ultG || 0) * 100)}%</span>` : ''}</div>`;
  const body = app.detail ? (ul.text ? detailHtml(ul.text, actx(b, c, true)) : `<p>${statIc(esc(ul.desc))}</p>`) : `<p>${esc(ul.brief || ul.desc)}</p>`;
  return abilCard('ult', 'ult', ul.name, `약 ${sec.toFixed(0)}초`, `${chips}${body}`, '', `ult.${d.id}`);
}
/** 디바인 신권 대행 카드: 장착한 성유물 */
/** 성유물 섹션: 장착 슬롯 + 종속 하위 능력(신권 대행) */
function relicSection(d: UnitDef, u: UnitState | null, run: RunState | null, c: CUnit | null, live = false, b0: Battle | null = null) {
  if (d.ttype !== 'divine') {
    // 성찬(도로스)으로 깨어난 기물: 성유물이 없으므로 전투 유형 기본형 신권 대행 (전투 중) · 깨어날 수 있으면 미리보기 (편성)
    const woke = live && awakened(d, c);
    if (!woke && !dorosReady(d, run)) return '';
    const da = DIVINE_ACT[d.ctype];
    const chips = `<div class="ab-chips"><span class="abc" title="신성력이 가득 차면 발동">${lineIcon('a.divact', 'li')}신성력 100</span><span class="abc">전투당 1회</span>${woke && c ? `<span class="abc v">${c.divUsed ? '발동함' : Math.round(c.div || 0)}</span>` : '<span class="abc">성찬을 받으면</span>'}</div>`;
    return `<section class="abil ab-relic"><div class="rl-act ab-click${abilOn('divact')}" data-a="abil-pop" data-v="divact" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">신권 대행 · 성찬</span><b>${lineIcon('a.divact', 'li ab-ic')}${esc(da.name)}</b></div>${chips}${app.detail ? detailHtml(da.text, actx(b0, c)) : `<p>${esc(da.brief)}</p>`}<p class="small muted">성유물이 없어 ${esc(CTYPE_NAME[d.ctype])} 기본형을 쓴다.</p></div></section>`;
  }
  const rid = u?.relic || c?.relic || DEFAULT_RELIC[d.id];
  const rel = rid ? RELIC_BY_ID[rid] : null;
  const edit = !!(u && run && !live);
  const head = `<div class="ab-head"><span class="ab-kind">성유물</span><b>${esc(rel?.name || '없음')}</b>${u && run && rel ? `<button class="btn tiny rl-bless${u.enh ? ' done' : ''}" data-a="relic-enh" data-v="${u.uid}" title="권능 ${rel.enh}을 써서 다음 전투의 신권 대행 계수를 ×3으로" ${live || u.enh || run.power < rel.enh ? 'disabled' : ''}>${u.enh ? '축성됨' : `축성 · 권능 ${rel.enh}`}</button>` : ''}</div>`;
  const slot = `<div class="rl-slot">${relicTok(rel?.id || '', edit ? `data-a="relic-pick" data-v="${u!.uid}"` : '', edit && app.relicPick === u!.uid)}<p class="small muted">${rel ? '장착한 성유물이 신권 대행의 효과를 정한다.' : `성유물이 없으면 ${esc(CTYPE_NAME[d.ctype])} 기본형 신권 대행 [${esc(DIVINE_ACT[d.ctype].name)}]을 쓴다.`}</p></div>${edit && app.relicPick === u!.uid ? relicPicker(run!, u!) : ''}`;
  let act = '';
  if (rel) {
    const k = (live ? c?.mem.enh : u?.enh ? 3 : 1) || 1;
    const chips = `<div class="ab-chips"><span class="abc" title="신성력이 가득 차면 발동">${lineIcon('a.divact', 'li')}신성력 100</span><span class="abc">전투당 1회</span>${k > 1 ? '<span class="abc v">강화 ×3</span>' : ''}${live && c && c.div !== null ? `<span class="abc v">${c.divUsed ? '발동함' : Math.round(c.div)}</span>` : ''}</div>`;
    act = `<div class="rl-act ab-click${abilOn('divact')}" data-a="abil-pop" data-v="divact" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">신권 대행</span><b>${lineIcon('a.divact', 'li ab-ic')}${esc(rel.name)}</b></div>${chips}${app.detail ? detailHtml(rel.text(k), actx(b0, c)) : `<p>${esc(rel.brief)}</p>`}</div>`;
  }
  return `<section class="abil ab-relic">${head}${slot}${act ? `<hr class="rl-sep">${act}` : ''}</section>`;
}
// ───────── 소환물 (최고의 친구): 이름 · 초상 · 전투 유형 · 현재 상속률 + 기본 공격 · 기술 카드 (누르면 좌측 상세)
type SumDef = NonNullable<UnitDef['summon']>;
const sumKinds = (sd: SumDef): SumDef[] => [sd, ...(sd.also || [])];
/** 이 기물의 소환물: 전투에 이미 불려 나와 있으면 그 소환물, 아니면 build.ts makeSummons 로 만든 미리보기
 *  (상세용 전투의 기물 c 기준 = 지금 런의 시너지 · 특성 · 증강, 도감 · 대기석은 시너지 없이 기본값) */
function summonList(d: UnitDef, b: Battle | null, c: CUnit | null): SummonMade[] {
  const sd0 = d.summon;
  if (!sd0 || !c) return [];
  const real = b ? b.units.filter((s) => s.isSummon && s.owner === c && s.defId === 'summon') : [];
  if (real.length) return real.map((s) => ({ sd: sumKinds(sd0).find((k) => k.name === s.name) || sd0, unit: s, rate: s.mem.bondRate || 0, extra: !!s.mem.bondExtra }));
  return makeSummons(c, sd0);
}
const sumPc = (x: number) => `${Math.round(x * 100)}%`;
const sumPow = (s: CUnit): 'shoot' | 'strike' => (s.atk.type === 'shoot' ? 'shoot' : 'strike');
const sumS = (b: Battle | null, s: CUnit, k: StatKey) => (b ? b.S(s, k) : s.st[k]);
/** 상속률 구성: 시너지 단계 (꺼져 있으면 기본) + 특성 · 증강 가산 × 소환물 배율 */
function bondNote(c: CUnit, m: SummonMade) {
  const syn = c.mem.bond ? `최고의 친구 단계 ${sumPc(c.mem.bond)}` : `기본 ${sumPc(CFG.bond.base)} (최고의 친구 시너지 꺼짐)`;
  const bonus = c.mem.bondBonus ? ` + 특성 · 증강 ${sumPc(c.mem.bondBonus)}p` : '';
  const k = (m.extra ? c.mem.extraRate ?? CFG.bond.extra : 1) * (m.sd.rate || 1);
  return `${syn}${bonus}${k !== 1 ? ` × ${+k.toFixed(2)}${m.extra ? ' (추가 소환)' : ''}` : ''}`;
}
/** 소환물 기본 공격 예상 DPS (치명타 기대값 포함, 방어도 · 속성 보정 · 명중 제외) */
function sumDps(b: Battle | null, s: CUnit, sd: SumDef) {
  const ivl = s.atk.interval / Math.max(0.2, 1 + sumS(b, s, 'atkSpd'));
  const crit = 1 + Math.min(1, Math.max(0, sumS(b, s, 'crit'))) * Math.max(0, sumS(b, s, 'critDmg') - 1);
  return (sumS(b, s, sumPow(s)) * (sd.basicMult || 1) * crit) / ivl;
}
/** 소환물 상세 (기본 공격 팝업) 행 */
function summonRows(b: Battle | null, c: CUnit, m: SummonMade, ctx: AB.AbilCtx): [string, string][] {
  const s = m.unit, sd = m.sd, pow = sumPow(s), ct = s.ctype;
  const aps = Math.max(0.2, 1 + sumS(b, s, 'atkSpd')) / s.atk.interval;
  const amp = s.mods.reduce((a, x) => a + (x.kind === 'inc' && x.tag === 'all' ? x.v : 0), 0);
  const pv = provMult(b, s);
  return [
    ['전투 유형', ct ? `${typeIcon(ct)}${CTYPE_NAME[ct]}` : '소환물'],
    ['상속률', `${sumPc(m.rate)} <span class="muted small">${esc(bondNote(c, m))}</span>`],
    [hpLabel(s), `${fmt(sumS(b, s, 'maxHp'))}${sd.hpMul && sd.hpMul !== 1 ? ` <span class="muted small">(체력 ×${sd.hpMul})</span>` : ''}`],
    ['피해 유형', AB.powType(ctx, pow)],
    ['피해', AB.powNum(ctx, pow, sd.basicMult || 1, false, false, s.atk.elem)],
    ...(amp ? [['피해 증가', `+${sumPc(amp)} <span class="muted small">(최고의 친구 단계 · 특성 · 증강)</span>`] as [string, string]] : []),
    ['공격 속도', `${aps.toFixed(2)}회/초 <span class="muted">(${(1 / aps).toFixed(2)}초)</span>`],
    ['예상 DPS', `<span class="pw el-t-${s.atk.elem}">${lineIcon(`e.${s.atk.elem}`, 'li')}<b>${fmt(sumDps(b, s, sd))}</b></span><span class="muted small">/초</span>`],
    ['방어도', fmt(sumS(b, s, 'armor'))],
    ['도발 배율', `×${+pv.toFixed(2)} <span class="muted small">${ct === 'VAN' ? '돌격가 소환물 (경계는 없음)' : ct ? `${CTYPE_NAME[ct]} 소환물` : '소환물 기본'}</span>`],
  ];
}
/** 소환물 섹션: 소환물마다 초상 · 이름 · 유형 · 상속률 칩 + 기본 공격 · 기술(주인 스킬 연계) 카드. scope = 상속률 기준 (지금 런 · 대기석 · 기본값) */
function summonSection(d: UnitDef, b: Battle | null, c: CUnit | null, scope: string) {
  const sd0 = d.summon;
  if (!sd0 || !c) return '';
  const kinds = sumKinds(sd0), made = summonList(d, b, c);
  const names = kinds.map((k) => k.name).join(' · ');
  const body = made.length ? kinds.map((sd, k) => {
    const ms = made.filter((x) => x.sd === sd);
    const m = ms.find((x) => !x.extra) || ms[0];
    if (!m) return '';
    const s = m.unit, ex = ms.filter((x) => x.extra), ct = s.ctype, pow = sumPow(s);
    const ctx: AB.AbilCtx = { b, c: s, p: c.sk };
    const range = sumS(b, s, 'range');
    const info = ABIL[d.id]?.summon?.[sd.name]?.(c.sk);
    const pv = provMult(b, s);
    // 머리: 초상 (여러 기면 모서리에 수) | 이름 (여러 종류일 때만 — 한 종류면 섹션 머리에 이미 있다) · 전투 유형 · 분류 / 상속률 · 체력 · 위력 · 도발 칩
    const chips = `<div class="ab-chips sm-stats"><span class="abc sm-bond" title="${esc(`스탯 상속률: 주인의 체력 · 위력 · 방어도를 물려받는 비율 (명중 · 치명타 · 효과 명중 · 효과 저항 · 회피는 주인 값 그대로). ${bondNote(c, m)}`)}">${lineIcon('a.summon', 'li')}상속률 <b>${sumPc(m.rate)}</b></span>`
      + (ex.length ? `<span class="abc" title="${esc(`추가로 불린 소환물 ${ex.length}기: 상속률 ×${c.mem.extraRate ?? CFG.bond.extra}`)}">추가 ${ex.length}기 <b>${sumPc(ex[0].rate)}</b></span>` : '')
      + `<span class="abc" title="${hpLabel(s)}">${lineIcon('a.hp', 'li')}<b>${fmt(sumS(b, s, 'maxHp'))}</b></span>`
      + `<span class="abc" title="${pow === 'shoot' ? '사격' : '타격'} 위력">${lineIcon(`p.${pow}`, 'li')}<b>${fmt(sumS(b, s, pow))}</b></span>`
      + `<span class="abc" title="${esc(`도발 배율: 적이 이 소환물에게 쌓는 도발 수치에 곱해지는 값 (${ct ? `${CTYPE_NAME[ct]} 소환물` : '소환물'}). 돌격가 경계는 소환물에게 없다.`)}">${lineIcon('p.prov', 'li')}<b>×${+pv.toFixed(2)}</b></span></div>`;
    const head = `<div class="sm-id"><span class="sm-pic">${sprite(s, 'spr sm-face')}${ms.length > 1 ? `<b class="sm-n" title="전투 시작 시 불려 나오는 수">${ms.length}기</b>` : ''}</span><div class="sm-tx"><span class="sm-nm">${kinds.length > 1 ? `<b>${esc(sd.name)}</b>` : ''}<span class="dh-types">${ct ? `<i>${typeIcon(ct)}${CTYPE_NAME[ct]}</i>` : ''}${categoryTag(s.category)}</span></span>${chips}</div></div>`;
    const atk = `<div class="ps-card ab-click${abilOn(`summon:atk:${k}`)}" data-a="abil-pop" data-v="summon:atk:${k}" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">기본 공격</span><b>${WPOS(range)}</b></div><div class="ab-chips">${AB.chip('u.range', `${range}칸`, '사거리')}${AB.powNum(ctx, pow, sd.basicMult || 1, false, false, s.atk.elem)}${AB.chip('a.speed', `${s.atk.interval}초`, '공격 간격')}</div></div>`;
    const sk = info ? `<div class="ps-card ab-click${abilOn(`summon:skill:${k}`)}" data-a="abil-pop" data-v="summon:skill:${k}" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">기술 · 연계</span><b>${esc(d.skill.name)}</b></div><div class="ab-chips">${AB.skillChips(info, ctx, range, c.cdMax)}</div></div>` : '';
    return `<div class="sm-unit">${head}<div class="ps-cards">${atk}${sk}</div></div>`;
  }).join('') : `<p class="small muted">증강 효과로 이번 빌드에서는 소환물(${esc(names)})을 부르지 않는다.</p>`;
  return `<section class="abil sm-sec"><div class="ab-head"><span class="ab-kind">소환물</span><b>${esc(names)}</b><span class="ab-meta">${esc(scope)}</span></div>${body}</section>`;
}
/** 상세 창 위치별 상속률 기준 문구 */
const sumScope = (u: UnitState | null) => (!u ? '기본값 (런 밖)' : u.pos ? '지금 런 · 출전 기준' : '대기석 · 시너지 미적용');
function skillCard(d: UnitDef, b: Battle | null, c: CUnit | null) {
  const p = c?.sk || d.skill.params;
  const info = ABIL[d.id]?.skill?.(p);
  const cd = c?.cdMax ?? d.skill.cd;
  const range = b && c ? b.S(c, 'range') : d.range;
  // 칩(사거리 · 범위 · 쿨다운) + 설명: 상세 보기 = 문형 문장 (info.text), 아니면 한 줄 설명 (BRIEF) — docs/ABILITY_TEXT.md
  const body = app.detail && info?.text ? statIc(AB.detailText(info.text, { ...actx(b, c, true), range }, new Set())) : `<p>${esc(skillText(d, p))}</p>`;
  return abilCard('skill', 'skill', d.skill.name, info ? '' : `${cd.toFixed(1)}초`, `${info ? `<div class="ab-chips">${AB.skillChips(info, actx(b, c, true), range, cd)}</div>` : ''}${body}`, '', `skill.${d.id}`);
}
const traitHtml = (d: UnitDef, b: Battle | null, c: CUnit | null) => {
  const t = ABIL[d.id]?.trait;
  const bt = ABIL[d.id]?.brief?.trait || BRIEF[d.id]?.trait;
  if (!app.detail && bt) return `<p>${esc(bt)}</p>`; // 상세 보기 꺼짐: 한 줄 설명
  return t ? (t.includes('\n') ? statIc(AB.detailText(t, actx(b, c, false, d), new Set())) : `${statIc(AB.detailText(t, actx(b, c, false, d), new Set()))}`) : `<p>${esc(traitText(d))}</p>`;
};
function augText(id: string, param: string | undefined, b: Battle | null, c: CUnit | null, gl = new Set<string>()) {
  const t = augAbilText(id);
  return t ? statIc(AB.detailText(t, actx(b, c, AUG_BY_ID[id]?.pool === 'unit'), gl)) : esc(augDesc(id, param)); // 기물 전용 증강은 대부분 스킬 강화
}
/** 메커니즘 한 줄 설명 */
function weaponMech(w: Weapon, ctx: AB.AbilCtx) {
  const tac = w.tactical ? ' 피해는 전술 위력으로 계산.' : '';
  if (w.kind === 'none') return '기본 공격을 하지 않는다.';
  if (w.kind === 'mag') {
    const rs = ctx.b && ctx.c ? Math.max(0.2, 1 + ctx.b.S(ctx.c, 'reloadSpd')) : 1;
    return `사거리 안의 대상을 사격. 탄창 ${w.mag}발을 모두 쓰면 ${((w.reload || 1.5) / rs).toFixed(1)}초 동안 재장전 — 그동안 기술도 쓰지 않는다 (쿨다운은 계속 돈다). 재장전 중 제어 효과(${controlNames()})를 받으면 재장전이 처음부터 다시.${tac}`;
  }
  return `사거리 안의 대상을 타격. ${w.combo}번째 공격마다 피니쉬(×${CFG.finishMult})로 마무리.${tac}`;
}
function skillMech(range: 'unit' | number | null, cmd: boolean, mag = false) {
  const when = range === 'unit' ? '대상이 사거리 안에 있으면' : range === 0 ? '주변에 대상이 있으면' : '조건이 맞으면';
  return `쿨다운이 차고 ${when} 자동으로 시전.${mag ? ' 재장전 중에는 쓰지 않고 재장전이 끝나기를 기다린다.' : ''}${cmd ? ' 지휘관은 전술 위력으로 계산.' : ''}`;
}
/** 증강 카드 · 상세의 부가 줄: 조합 조건 (충족 못 하면 경고색). block = 상세 팝업용 문단 */
function augNotes(id: string, u: UnitState | null, block = false) {
  const rq = augReqState(id, u);
  const tag = block ? 'p' : 'span';
  return rq ? `<${tag} class="aug-req ${rq.ok === false ? 'bad' : rq.ok ? 'ok' : 'info'}">${rq.ok === false ? '⚠ ' : ''}조합 조건: ${esc(rq.hint)}. ${esc(rq.cur)}</${tag}>` : '';
}
/** 사이오닉 기물의 보유 증강 (전투 중이면 그 전투 기물의 원본, 아니면 런의 기물) */
const psiAugsFor = (d: UnitDef, c: CUnit | null): AugList => c?.src?.augments || app.run?.units.find((x) => x.defId === d.id)?.augments || [];
/** 비술 쿨다운: 전투 기물이면 엔진 계산 (열폭주 등 이성 반영), 아니면 증강 반영 기본값 */
const psiCd = (b: Battle | null, c: CUnit | null, base: number) => (b && c?.cantrip ? c.cantrip.cd(b, c) : base);
/** ◆ 변형 표시 (카드 머리) */
const psiTfTag = (tf: string | null) => (tf ? `<span class="psi-tf" title="◆ 변형 증강 「${esc(tf)}」이 적용된 모습">◆ ${esc(tf)}</span>` : '');
/** ◆ 변형 · 증강 반영 안내 (상세 팝업 첫 줄) */
function psiTfNote(tf: string | null, mods: string[], base: string) {
  const tfl = tf ? `<p class="psi-tfn"><b>◆ 변형됨: ${esc(tf)}</b> <span class="muted small">원래 「${esc(base)}」에서 바뀐 모습</span></p>` : '';
  const ml = mods.length ? `<p class="psi-mods muted small">증강 반영: ${mods.map(esc).join(' · ')}</p>` : '';
  return tfl + ml;
}
/** 좌측 능력 상세 팝업 */
function abilPopHtml(key: string, d: UnitDef, b: Battle | null, c: CUnit | null, aceK = 1) {
  // 'cantrip:<전공>' · 'psipass:<전공>': 아직 고르지 않은 전공 미리보기 (전공 선택 창)
  let forcedSchool: SchoolId | null = null;
  if (/^(cantrip|psipass):/.test(key)) { forcedSchool = key.split(':')[1] as SchoolId; key = key.split(':')[0]; }
  const ctx = actx(b, c);
  const gl = new Set<string>();
  let kind = '', name = '', body = '', mech = '', sumTok = '';
  if (key === 'weapon') {
    const w = c?.weapon || d.weapon;
    const range = b && c ? b.S(c, 'range') : w.range;
    kind = '무기'; name = w.name; mech = weaponMech(w, ctx);
    body = w.kind === 'none' ? '<p>기본 공격을 하지 않는다.</p>' : AB.popBody(range, { k: 'one' }, AB.weaponRows(w, ctx, c?.atk.elem || w.elem, gl));
  } else if (key === 'skill') {
    const p = c?.sk || d.skill.params;
    const info = ABIL[d.id]?.skill?.(p);
    const cd = c?.cdMax ?? d.skill.cd;
    kind = '스킬'; name = d.skill.name; mech = skillMech(info?.range ?? 'unit', d.ctype === 'CMD', (c?.weapon || d.weapon).kind === 'mag');
    const range = b && c ? b.S(c, 'range') : d.range;
    body = info ? (info.text ? detailHtml(info.text, { ...actx(b, c, true), range }, gl) : '') + AB.skillBody(info, actx(b, c, true), range, cd, gl) : `<p>${esc(d.skill.desc(p))}</p><p class="muted small">쿨다운 ${cd.toFixed(1)}초</p>`;
  } else if (key === 'ult' && ULTS[d.id]) {
    const ul = ULTS[d.id];
    const sec = (CFG.ultTime * CFG.ultNeed) / (ul.charge * Math.max(0.1, 1 + (c && b ? b.S(c, 'ultCharge') : 0)));
    kind = '궁극기'; name = ul.name; mech = `시간이 지나면 저절로 차오른다 (약 ${sec.toFixed(0)}초, 전투 시작 ${Math.round(CFG.ultStart * 100)}%). 가득 차면 다음 행동에 기술보다 먼저 발동하고, 한 전투에 여러 번 쓸 수 있다. 충전 효율이 높을수록 빨리 찬다.`;
    body = `${ul.text ? detailHtml(ul.text, actx(b, c, true), gl) : `<p>${statIc(esc(ul.desc))}</p>`}<p class="muted small">“${esc(ul.line)}”</p>`;
  } else if (key === 'cantrip') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = forcedSchool || cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '비술'; name = sc?.cantrip.name || '비술';
    mech = `${sc ? `${GROUPS[sc.group].name} ${sc.name}` : '전공'}의 비술. 전투 스킬과 별개로 쿨다운마다 자동으로 시전하고, 쓸 때마다 이성이 줄어든다. 광폭 중에는 쓰지 않는다.`;
    if (sc) {
      // 전공 선택 미리보기(forcedSchool)는 기본형, 그 밖에는 보유 증강을 반영한 실제 비술
      const cv = cantripView(sc.id, forcedSchool ? [] : psiAugsFor(d, c));
      const cd = psiCd(b, c, cv.cd);
      body = psiTfNote(cv.transform, cv.mods, sc.cantrip.name) + (cv.info.text ? detailHtml(cv.info.text, actx(b, c, true), gl) : '') + AB.skillBody(cv.info, ctx, b && c ? b.S(c, 'range') : d.range, cd, gl) + AB.rowsHtml([['이성 소모', `${lineIcon('a.reason', 'li')}-${cv.cost}`]]);
    }
  } else if (key === 'psipass') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = forcedSchool || cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '지속 능력'; name = sc?.passive.name || '지속 능력';
    mech = '전투 내내 적용된다. 확률 발동은 평타 · 전투 스킬 · 비술이 적중할 때만 판정하고, 지속 피해 · 소환물 공격은 판정하지 않는다.';
    const pv = sc ? passiveView(sc.id, forcedSchool ? [] : psiAugsFor(d, c)) : null;
    body = sc && pv ? psiTfNote(pv.transform, pv.mods, sc.passive.name) + detailHtml(pv.text, actx(b, c, true), gl) + AB.rowsHtml(pv.rows.map(([k, v]) => [k, statIc(AB.tok(v, ctx, gl))] as [string, string])) : '';
  } else if (key === 'reason') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '이성'; name = sc ? GROUPS[sc.group].name : '이성';
    mech = '-100 ~ 100. 비술을 쓰면 줄고, 기물마다 정해진 행동으로 오르내린다. 효과는 이성 값에 비례한다.';
    body = AB.rowsHtml([
      ...(sc ? [['고이성', esc(sc.high)], ['저이성', esc(sc.low)]] as [string, string][] : []),
      ...(d.psi ? [['이성 변화', esc(d.psi.desc)]] as [string, string][] : []),
      ['이성 0 미만', '초당 정신 피해 (이성에 비례, -50 이하 2배)'],
      ['광폭 (-100)', '피아 구분 없이 공격 (아군에게는 피해 50%), 비술 사용 불가. -60 위로 회복하면 해제'],
    ]);
  } else if (key === 'divact') {
    const rid = c?.relic || app.run?.units.find((x) => x.defId === d.id)?.relic || DEFAULT_RELIC[d.id];
    const rel = rid ? RELIC_BY_ID[rid] : null;
    const da = DIVINE_ACT[d.ctype];
    kind = '신권 대행'; name = rel?.name || da.name; mech = rel ? '고유 신앙에 맞는 행동으로 신성력을 모아 100이 되면 전투당 한 번 발동. 장착한 성유물에 따라 효과가 바뀌고, 지속 효과는 전투가 끝날 때까지 유지된다. 권능으로 강화하면 다음 전투 한정 계수 ×3.'
      : `고유 신앙에 맞는 행동으로 신성력을 모아 100이 되면 전투당 한 번 발동. 성유물이 없으면 (도로스의 [성찬]으로 깨어난 기물 등) ${CTYPE_NAME[d.ctype]} 기본형을 쓴다.`;
    body = rel ? `${detailHtml(rel.text(c?.mem.enh || 1), ctx, gl)}<p class="muted small">강화 비용 권능 ${rel.enh}</p>` : detailHtml(da.text, ctx, gl);
  } else if (key === 'trait') {
    kind = '특성'; name = d.trait.name; mech = '전투 내내 적용되는 이 기물의 고유 효과.';
    const t = ABIL[d.id]?.trait;
    body = `${t ? statIc(AB.detailText(t, ctx, gl)) : `<p>${esc(d.trait.desc)}</p>`}`;
  } else if (key === 'ace' && d.ace) {
    kind = '에이스'; name = d.ace.name; mech = '항해자 시너지 활성 시, 에이스 파일럿으로 지정한 출전 기물에게만 발동. 항해자 단계가 오를수록 강해짐.';
    const t = ABIL[d.id]?.ace?.(aceK);
    body = t ? statIc(AB.detailText(t, ctx, gl)) : `<p>${esc(d.ace.desc(aceK))}</p>`;
  } else if (key === 'voy' && VOYAGE_SPECIAL[d.id]) {
    const v = VOYAGE_SPECIAL[d.id];
    kind = '출항'; name = v.name; mech = '우리의 출항기! 구성원이 정확히 1명 또는 5명 출전하면, 출전한 구성원 전원에게 발동.';
    body = `<p>${statIc(esc(v.text))}</p>`;
  } else if (key.startsWith('aug:')) {
    const id = key.slice(4);
    kind = '증강'; name = AUG_BY_ID[id]?.name || id;
    const pool = AUG_BY_ID[id]?.pool;
    mech = pool === 'unit' ? '이 기물 전용 증강. 획득하면 영구 적용.' : pool === 'special' ? '메이저 기물이 4등급마다 고르는 전용 증강. 영구 적용.' : pool === 'oath' ? '디바인 기물이 5등급마다 고르는 서약 증강. 영구 적용.' : pool === 'psionic' ? '사이오닉 증강. 이성 규칙을 바꾼다. 영구 적용.' : '공용 증강. 영구 적용.';
    body = `<p>${augText(id, c?.src?.augments.find((a) => a.id === id)?.param, b, c, gl)}</p>${augNotes(id, c?.src || app.run?.units.find((x) => x.defId === d.id) || null, true)}`;
    // ◆ 변형 증강: 바뀐 비술 · 지속 능력을 함께 (이 기물의 다른 전공 증강까지 반영)
    const tp = transformPreview(id);
    if (tp) {
      const all = [...psiAugsFor(d, c), id], s2 = SCHOOL_BY_ID[tp.sid];
      const cv = cantripView(tp.sid, all), pv = passiveView(tp.sid, all);
      if (cv.transform) body += `<h4 class="psi-tfh">변형 후 비술 「${esc(cv.name)}」</h4>${AB.skillBody(cv.info, ctx, b && c ? b.S(c, 'range') : d.range, psiCd(b, c, cv.cd), gl)}`;
      if (pv.transform) body += `<h4 class="psi-tfh">변형 후 지속 「${esc(s2.passive.name)}」</h4>${AB.rowsHtml(pv.rows.map(([k, v]) => [k, statIc(AB.tok(v, ctx, gl))] as [string, string]))}`;
    }
  } else if (key.startsWith('summon:') && d.summon && c) {
    // 소환물 (최고의 친구): 'summon:atk:<n>' 기본 공격 · 'summon:skill:<n>' 기술 (n = 소환물 종류 순서)
    const [, part, ks] = key.split(':');
    const sd = sumKinds(d.summon)[+ks];
    const ms = sd ? summonList(d, b, c).filter((x) => x.sd === sd) : [];
    const m = ms.find((x) => !x.extra) || ms[0];
    if (!sd || !m) return '';
    const s = m.unit, sctx: AB.AbilCtx = { b, c: s, p: c.sk };
    const range = b ? b.S(s, 'range') : s.st.range;
    sumTok = sprite(s, 'ab-tok ap-tok');
    if (part === 'skill') {
      const info = ABIL[d.id]?.summon?.[sd.name]?.(c.sk);
      if (!info) return '';
      kind = '소환물 기술'; name = `${sd.name} · ${d.skill.name}`;
      mech = `${d.name}의 스킬 [${d.skill.name}]에 맞춰 움직이는 연계 기술 (쿨다운 = ${d.name}의 스킬 쿨다운). 피해 수치는 ${sd.name}의 위력으로 계산한다.`;
      body = AB.skillBody(info, sctx, range, c.cdMax, gl);
    } else {
      kind = '소환물 기본 공격'; name = `${sd.name}${ms.length > 1 ? ` ×${ms.length}` : ''}`;
      mech = `전투 시작 시 ${d.name} 곁에 불려 나와 스스로 움직이며 적을 기본 공격한다${sd.focusLow ? ' (사거리 안에서 체력 비율이 가장 낮은 적을 노림)' : ''}. 체력 · 위력 · 방어도는 ${d.name}의 능력치를 상속률만큼 물려받고, 주인이 쓰러지면 함께 사라진다.`;
      body = AB.popBody(range, { k: 'one' }, summonRows(b, c, m, sctx));
    }
  } else return '';
  // 머리에 능력 아이콘 (아군 기물의 무기 · 특성 · 스킬 · 궁극기 · 비술 · 지속 · 신앙)
  const sc = forcedSchool || (c ? cSchool(c) : (app.run?.units.find((x) => x.defId === d.id) as { school?: SchoolId } | undefined)?.school ?? null);
  const icKey = key === 'cantrip' && sc ? `cantrip.${sc}` : key === 'psipass' && sc ? `passive.${sc}` : ['weapon', 'trait', 'skill', 'ult'].includes(key) ? `${key}.${d.id}` : '';
  const tok = sumTok || (icKey && UNIT_BY_ID[d.id] ? abTok(icKey).replace('ab-tok', 'ab-tok ap-tok') : '');
  return `<div class="stat-pop abil-pop"><div class="sp-head">${tok}<span class="ab-kind">${kind}</span><b>${esc(name)}</b><button class="btn tiny" data-a="abil-pop" data-v="">닫기</button></div>${mech ? `<p class="ap-mech">${mech}</p>` : ''}${body}</div>`;
}

/** 적 능력: 무기 · 특성 · 스킬 카드 */
function enemyAbilCards(e: EnemyDef, b: Battle, c: CUnit) {
  const ab = ENEMY_ABIL[e.id];
  const w = { ...c.weapon!, name: '기본 공격' };
  const range = b.S(c, 'range');
  const trait = ab?.trait ? abilCard('trait', 'trait', '특성', '', `${statIc(AB.detailText(ab.trait, actx(b, c), new Set()))}`) : '';
  const skill = e.skill ? abilCard('skill', 'skill', e.skill.name, ab?.skill ? '' : `${e.skill.cd}초`,
    ab?.skill ? `<div class="ab-chips">${AB.skillChips(ab.skill, actx(b, c), range, e.skill.cd)}</div>` : `<p>${esc(e.skill.desc(c.sk))}</p>`) : '';
  return `${weaponCard(w, b, c, e.atk.elem)}${trait}${skill}`;
}
function enemyAbilPop(key: string, e: EnemyDef, b: Battle, c: CUnit) {
  const ab = ENEMY_ABIL[e.id];
  const ctx = actx(b, c);
  const gl = new Set<string>();
  let kind = '', name = '', body = '', mech = '';
  if (key === 'weapon') {
    kind = '무기'; name = '기본 공격'; mech = weaponMech(c.weapon!, ctx);
    body = AB.popBody(b.S(c, 'range'), { k: 'one' }, AB.weaponRows({ ...c.weapon!, name }, ctx, e.atk.elem, gl));
  } else if (key === 'skill' && e.skill) {
    kind = '스킬'; name = e.skill.name; mech = skillMech(ab?.skill?.range ?? 'unit', false, c.weapon?.kind === 'mag');
    body = ab?.skill ? AB.skillBody(ab.skill, ctx, b.S(c, 'range'), e.skill.cd, gl) : `<p>${esc(e.skill.desc(c.sk))}</p>`;
  } else if (key === 'trait' && ab?.trait) {
    kind = '특성'; name = '특성'; mech = '전투 내내 적용되는 이 적의 고유 효과.';
    body = `${statIc(AB.detailText(ab.trait, ctx, gl))}`;
  } else return '';
  return `<div class="stat-pop abil-pop"><div class="sp-head"><span class="ab-kind">${kind}</span><b>${esc(name)}</b><button class="btn tiny" data-a="abil-pop" data-v="">닫기</button></div>${mech ? `<p class="ap-mech">${mech}</p>` : ''}${body}</div>`;
}

/** 우리의 출항기! 고유 능력: 구성원이 정확히 1명 또는 5명 출전하면 발동 */
function voyAbil(d: UnitDef, run: RunState | null, u: UnitState | null) {
  const v = VOYAGE_SPECIAL[d.id];
  if (!v) return '';
  const n = run ? synergyCounts(deployed(run), run).VOYAGE || 0 : 0;
  const on = !!(run && u?.pos && (n === 1 || n >= 5));
  const st = run ? (on ? '활성' : `비활성 · 출전 ${n}명`) : '1명 · 5명 출전 시';
  return `<div class="ab-ace-wrap${on ? ' on' : ''}">${abilCard('voy', 'skill', v.name, st, `<p>${statIc(esc(v.text))}</p>`).replace('ab-skill', 'ab-ace')}</div>`;
}

/** 항해자 에이스 파일럿: 능력 란에 표시하고 여기서 지정 */
function aceAbil(run: RunState, u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  if (!d.ace) return '';
  const nav = tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0);
  const k = [1, 1, 1.6, 2.5][nav] ?? 1;
  const on = nav > 0 && !!u.pos && aceTargetUid(run) === u.uid;
  const ctl = !nav || !u.pos ? '<span class="muted small">항해자 시너지가 활성화된 출전 기물만 지정할 수 있습니다.</span>'
    : on ? '<span class="small staff-on">✈ 지정됨</span>' : `<button class="btn tiny" data-a="ace-target" data-v="${u.uid}">✈ 에이스 파일럿으로 지정</button>`;
  const t = ABIL[d.id]?.ace?.(k);
  return `<div class="ab-ace-wrap${on ? ' on' : ''}">${abilCard('ace', 'skill', d.ace.name, on ? '활성' : '비활성', (t ? statIc(AB.detailText(t, actx(null, null), new Set())) : `<p>${esc(d.ace.desc(k))}</p>`)).replace('ab-skill', 'ab-ace')}${ctl}</div>`;
}

/** 상세 보기: 전투 유형에 따른 주요 위력 (+ 무기가 다른 위력을 쓰면 함께). 전술 위력은 지금 출전 구성 기준 실시간 값 */
const POW_NAME = { shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력', tac: '전술 위력' } as const;
function powRow(b: Battle, c: CUnit, d: UnitDef, deployedNow: boolean) {
  type K = keyof typeof POW_NAME;
  const main: K = d.ctype === 'CMD' ? 'tac' : d.ctype === 'MARK' ? 'shoot' : d.ctype === 'VAN' ? 'strike' : 'tech';
  const keys: K[] = [main];
  const w = c.weapon;
  if (w && w.kind !== 'none') { const wk: K = w.tactical ? 'tac' : w.type === 'shoot' ? 'shoot' : 'strike'; if (!keys.includes(wk)) keys.push(wk); }
  const val = (k: K) => Math.round(k === 'tac' ? b.tacPower(c) : b.S(c, k));
  return `<div class="d-pows">${keys.map((k, i) => `<span class="d-pow pw-${k}${i ? ' sub' : ''}" title="${POW_NAME[k]}${k === 'tac' ? (deployedNow ? ' · 지금 출전 구성 기준' : ' · 이 기물이 출전했을 때 기준') : ''}">${lineIcon(`p.${k}`, 'li')}<span>${POW_NAME[k]}</span><b>${fmt(val(k))}</b></span>`).join('')}${provChip(null, c)}</div>`;
}
/** 도발 배율 칩 (위력 칩과 같은 모양): 정상값(×1)이 아닐 때만. 배율 규칙은 엔진 PROV 에서 읽는다 */
function provChip(b: Battle | null, c: CUnit) {
  const m = provMult(b, c);
  if (Math.abs(m - 1) < 0.05) return '';
  const rule = `돌격가 ×${PROV.van} · 수호자 시너지 +${PROV.guard}${c.mem.provPlus ? ` · 장비 +${c.mem.provPlus}` : ''} · 소환물 근접 ×${PROV.sumMelee} · 고정 ×${PROV.sumFixed} (전투 유형이 정해진 최고의 친구 소환물은 그 유형 값: 돌격가 ×${PROV.van} · 전문가 ×1) · 그 밖 ×1, 은신 · 기습 중 ×${PROV.hide}`;
  const zoc = c.side === 0 && zocCapable(c) && !c.isSummon ? ` 돌격가 경계 교전 시간 ${+zocHoldOf(m).toFixed(3)}초 (${zocHoldFormula()}).` : '';
  return `<span class="d-pow pw-prov" title="도발 배율: 적이 이 기물에게 쌓는 도발 수치에 곱해지는 값 (${rule}).${zoc}">${lineIcon('p.prov', 'li')}<span>도발 배율</span><b>×${+m.toFixed(2)}</b></span>`;
}
/** 확대 버튼 (전체 상세 팝업): 상세 창 위쪽 바 (자세히 보기 옆) */
const MAX_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const maxBtn = (uid: string) => `<button class="btn d-mag d-max" data-a="big-open" data-v="${uid}" title="전체 상세 (확대)" aria-label="전체 상세 열기">${MAX_SVG}</button>`;
/** 기물 전체 상세 팝업: 장비 · 주요 · 상세 능력치 · 능력 구성 · 유형 특성을 한 화면에 */
/** 전체 상세 머리 요약: 한 줄 설명 (brief.ts BLURB, 능력 이름은 데이터에서) → 이번 빌드에서 달라진 점 (변형 증강이면 그 변화를 먼저) */
function unitSummary(run: RunState, u: UnitState, d: UnitDef, b: Battle, c: CUnit) {
  const blurb = unitBlurb(d);
  const sc = schoolOf(u);
  const cv = sc ? cantripView(sc, u.augments) : null, pv = sc ? passiveView(sc, u.augments) : null;
  // 변형: 바뀐 능력 (상태 칩) · 증강: 아이콘 줄 (누르면 설명) · 장비: 작은 칸 줄 — 문장으로 잇지 않는다
  const tf = [cv?.transform ? ['비술', cv.transform] : null, pv?.transform ? ['지속 능력', pv.transform] : null].filter((x): x is [string, string] => !!x);
  const augs = u.augments.filter((a) => !a.id.startsWith('school.') && AUG_BY_ID[a.id]);
  const slots = [...u.items, ...(u.mod ? [u.mod] : [])];
  const gear = slots.some(Boolean);
  void run; void b; void c;
  const grp = (k: string, body: string) => `<div class="us-g"><span class="us-gk">${k}</span>${body}</div>`;
  return `<section class="um-sum" aria-label="요약">
    ${blurb ? `<p class="us-blurb">${esc(blurb).replace(/「([^」]*)」/g, '<b>「$1」</b>')}</p>` : ''}
    <div class="us-row us-build"><span class="us-k">이번 빌드</span>${tf.length || augs.length || gear ? `<div class="us-bd">
      ${tf.length ? grp('변형', tf.map(([k, n]) => tchip('<span aria-hidden="true">◆</span>', `${k} → ${esc(n)}`, 'tf', `${k}이 「${n}」으로 변형됨`)).join('')) : ''}
      ${augs.length ? grp(`증강 ${augs.length}`, `<div class="tt-icons">${augs.map((a) => `<button class="tt-ic ab-click${abilOn(`aug:${a.id}`)}" data-a="abil-pop" data-v="aug:${esc(a.id)}" title="${esc(augMark(a.id) + (AUG_BY_ID[a.id]?.name || a.id))}">${augIcon(a.id)}</button>`).join('')}</div>`) : ''}
      ${gear ? grp('장비', `<span class="us-gear">${slots.map((id) => itemIcon(id)).join('')}</span>`) : ''}
    </div>` : '<p class="muted">기본 상태 (증강 · 장비 없음)</p>'}</div>
  </section>`;
}
/** 기물 전체 상세 팝업. pv = 영입 전 미리보기 (복제한 런에 합류시킨 모습, 방출 · 경험치 구매 없음) */
function unitModal(run: RunState, pv = false) {
  const u = run.units.find((x) => x.uid === (pv ? app.preview?.uid : app.bigUnit));
  if (!u) return '';
  const d = withEmblemSummon(UNIT_BY_ID[u.defId], u.mod); // 최고의 친구 문장: 소환물 섹션에 반려 돌(인화성)
  const { b, c } = previewAlly(run, u);
  const cnt = synergyCounts(deployed(run), run) as Record<string, number>;
  const effects = unitEffects(run, u, cnt, !!u.pos);
  const tm = totalMajors(u, effects);
  const cost = R.xpCost(run);
  const cat = unitCategory(d);
  const rel = d.ttype === 'divine' && u.relic ? RELIC_BY_ID[u.relic] : null;
  const majors = `<div class="majors">${MAJORS.map((m) => {
    const add = tm[m] - d.base[m];
    return `<div class="major"><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`;
  }).join('')}</div>`;
  const pop = app.abilPop ? `<div class="um-pop">${abilPopHtml(app.abilPop, d, b, c)}</div>` : '';
  const rankRow = `<div class="um-rank">${rankLabel(u.rank)}${xpBar(u)}${pv ? '' : `<button class="btn tiny" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost || R.isRock(u) ? 'disabled' : ''}>경험치 +${cost}c</button>`}</div>`;
  const synRow = `<div class="pc-syn">${memberships(u, run).map((id) => synToken(id, cnt[id] || 0)).join('')}</div>`;
  return `<div class="um-back" data-a="big-close"></div>
  <section class="um" role="dialog" aria-modal="true" aria-label="${esc(d.name)} 전체 상세">
    <div class="um-grid">
      <div class="um-col um-a">
        <div class="um-sticky"><div class="um-sc" aria-hidden="true">${sprite(d, 'um-face')}<div class="um-sc-main"><b class="um-sc-name">${esc(d.name)}</b>${rankRow}${synRow}</div></div></div>
        <div class="um-art">${hero(d.id) || sprite(d, 'spr big')}</div>
        <div class="um-idblk"><div class="um-id"><b>${esc(d.name)}</b><span class="muted small">${esc(d.title || '')}</span></div>
        ${rankRow}
        ${synRow}</div>
        <h3>장비</h3>${eqBox(u)}
        ${rel ? `<div class="um-relic">${relicTok(rel.id)}<span><b>${esc(rel.name)}</b><br><span class="muted small">성유물 · 신권 대행</span></span></div>` : ''}
        <h3>주요 능력치</h3>${majors}
        ${powRow(b, c, d, !!u.pos)}
        <h3>상세 능력치</h3>${statLines(c, b)}
      </div>
      <div class="um-main">
        <div class="um-top">
          <header class="um-head">
            <span class="um-tools">${pv ? '<span class="um-pv">영입 전 미리보기</span>' : blessBtn(run, u, d)}${pv ? '' : focusBtn(run, u)}${detailToggle()}${pv ? '' : `<button class="btn small danger-ghost" data-a="release" data-v="${u.uid}" ${run.units.length <= 1 ? 'disabled title="마지막 남은 기물은 방출할 수 없습니다"' : 'title="기물 방출 (확인 후 진행)"'} aria-expanded="${app.releaseConfirm === u.uid}">기물 방출</button>`}<button class="btn" data-a="big-close" aria-label="닫기" title="닫기 (Esc)">✕</button></span>
          </header>
          ${app.releaseConfirm === u.uid ? `<div class="um-release">${releaseBlock(run, u)}</div>` : ''}
        </div>
        ${unitSummary(run, u, d, b, c)}
        <div class="um-col um-c">
          <h3>전투 유형</h3>
          <div class="subs um-rules">
            ${sub('um:ct', CTYPE_ICON(d.ctype), `ct-${d.ctype}`, CTYPE_NAME[d.ctype], '공통 규칙', ctypeRuleHtml(d.ctype, app.detail))}
            ${sub('um:cat', lineIcon(`k.${cat}`, 'li'), `cat-${cat}`, CATEGORY_NAME[cat], '분류 규칙', `<p>${esc(CATEGORY_RULE[cat])}</p>`)}
          </div>
          <h3>전투 능력</h3>
          <div class="abils">
            ${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}
            ${traitGroup(d, u, run, b, c)}
            ${skillCard(d, b, c)}
            ${aceAbil(run, u)}${voyAbil(d, run, u)}
            ${summonSection(d, b, c, sumScope(u))}
          </div>
        </div>
        <div class="um-col um-r">
          <h3>전술 유형</h3>
          <div class="subs um-rules">${sub('um:tt', TTYPE_ICON(d.ttype), `tt-${d.ttype}`, TTYPE_NAME[d.ttype], '공통 규칙', `<p>${esc(TTYPE_RULE[d.ttype])}</p>`)}</div>
          <div class="abils">
            ${ultCard(d, b, c)}
            ${ttSection(d, u, run, b, c, false, false)}${relicSection(d, u, run, c, false, b)}
          </div>
          <h3>신앙</h3>
          <div class="abils">${faithAbil(d, u, run)}</div>
        </div>
      </div>
    </div>${pop}
  </section>`;
}
/** 전체 상세 왼쪽 열: 스탠딩 일러스트를 일정 이상(일러스트 높이의 30%) 내려 보면 일러스트가 접히고 머리 초상화 · 공명 등급 · 시너지 머리줄이 위에 붙는다.
 *  넓은 화면은 왼쪽 열이, 좁은 화면(≤700px)은 팝업 전체(.um-grid)가 스크롤된다 */
let umIO: { disconnect(): void } | null = null;
function umCompactBind() {
  const a = root.querySelector<HTMLElement>('.um-a');
  const grid = root.querySelector<HTMLElement>('.um-grid');
  const blk = a?.querySelector<HTMLElement>('.um-idblk');
  if (!a || !grid || !blk) return;
  const scroller = () => (a.scrollHeight > a.clientHeight + 1 && getComputedStyle(a).overflowY !== 'visible' ? a : grid);
  umIO?.disconnect();
  umIO = compactHead(a, blk, () => { const r = scroller().getBoundingClientRect(); return [r.top, r.bottom]; }, [a, grid]);
}
/** 작은 고정 머리 (전체 상세 · 편성 기물 상세 공용): 본문의 초상 · 공명 등급 · 시너지 블록이 거의 다 가려지면 col 에 compact 를 켠다
 *  (보이는 높이 ≤ 블록의 25% 또는 ≤ 24px), 40% 이상 보이면 끈다 (히스테리시스). 켜진 동안 남은 블록 조각은 CSS 로 숨긴다.
 *  view = 지금 보이는 세로 범위 [위, 아래] (위쪽 고정 바 아래부터). 반환: 레이아웃 변화 감시 (다시 묶을 때 끊는다) */
function compactHead(col: HTMLElement, blk: HTMLElement, view: () => [number, number], scrollers: (HTMLElement | Window)[]) {
  const upd = (instant = false) => {
    if (!col.isConnected) return;
    const [top, bottom] = view(), br = blk.getBoundingClientRect();
    const h = Math.max(1, br.height);
    const vis = Math.max(0, Math.min(br.bottom, bottom) - Math.max(br.top, top));
    const was = col.classList.contains('compact');
    const on = was ? vis < h * 0.4 : vis <= h * 0.25 || vis <= 24;
    if (on === was) return;
    if (instant) { col.classList.add('um-instant'); requestAnimationFrame(() => requestAnimationFrame(() => col.classList.remove('um-instant'))); }
    col.classList.toggle('compact', on);
    col.querySelector('.um-sc')?.setAttribute('aria-hidden', String(!on));
  };
  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; upd(); }); };
  for (const s of scrollers) s.addEventListener('scroll', onScroll, { passive: true });
  // 크기 변화 · 레이아웃 변화로 블록이 가려지거나 드러날 때도 (스크롤 없이)
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(() => upd(), { root: null, threshold: [0, 1] }) : null;
  io?.observe(blk);
  upd(true);
  return { disconnect: () => { io?.disconnect(); for (const s of scrollers) s.removeEventListener('scroll', onScroll); } };
}
/** 편성 기물 상세의 작은 고정 머리: 위쪽 바(닫기 · 자세히 보기 · 확대) 바로 아래에 붙는다. 넓은 화면은 옆 패널이, 좁은 화면은 창이 스크롤된다 */
let dpHead: { disconnect(): void } | null = null;
function detailHeadBind() {
  dpHead?.disconnect(); dpHead = null;
  const det = root.querySelector<HTMLElement>('.detail.dp-unit'), bar = det?.querySelector<HTMLElement>('.d-bar'), st = det?.querySelector<HTMLElement>('.dp-sticky'), blk = det?.querySelector<HTMLElement>('.d-hero');
  if (!det || !bar || !st || !blk) return;
  st.style.top = `calc(${getComputedStyle(bar).top} + ${bar.offsetHeight}px)`; // 바 높이 · 바의 고정 위치를 그대로 따른다
  const side = det.closest<HTMLElement>('.side');
  const own = () => !!side && side.scrollHeight > side.clientHeight + 1 && getComputedStyle(side).overflowY !== 'visible';
  dpHead = compactHead(det, blk, () => [bar.getBoundingClientRect().bottom, own() ? side!.getBoundingClientRect().bottom : innerHeight], side ? [side, window] : [window]);
}
/** 장비 · 개조부품 칸 (끌어 놓기 지원) */
function eqBox(u: UnitState) {
  return `<div class="d-eqbox"><div class="d-eq" aria-label="장비 · 개조부품">${u.items.map((it, k) => (it ? `<span class="tk-it" data-a="item-info" data-v="${u.uid}:${k}" data-drag="eq:${u.uid}:${k}" data-drop="eqitem:${u.uid}:${k}" data-hold>${itemIcon(it)}</span>` : `<span data-drop="unit:${u.uid}">${itemIcon(null)}</span>`)).join('')}${u.mod ? `<span class="tk-it" data-a="item-info" data-v="${u.uid}:-1" data-drag="eq:${u.uid}:-1" data-drop="eqitem:${u.uid}:-1" data-hold>${itemIcon(u.mod)}</span>` : `<span data-drop="unit:${u.uid}" title="개조부품 칸 · 문장을 끌어다 장착"><span class="item empty tM"></span></span>`}</div><button class="reco-btn" data-a="reco" data-v="${u.uid}" title="추천 장비 · 보유 현황">${lineIcon('r.reco', 'li')}추천 장비</button></div>`;
}
/** 편성 화면 오른쪽 기본 패널 (아무것도 고르지 않았을 때): 이번 전투의 적 구성 + 상성 요약.
 *  기물 · 적을 고르면 그 상세로 바뀌고, 선택을 풀면 다시 이 패널. 전투 밖 편성 관리에서는 이 전장의 주요 적 */
const PREP_TIPS = '<p class="pb-tips small muted">기물을 누르면 스탯 · 스킬 · 증강 · 장비를 봅니다. 기물을 끌어 배치를 바꾸고(보드 ↔ 대기열), 장비를 기물에게 끌어 장착합니다.</p>';
function prepBrief(run: RunState) {
  const enc = run.node?.enc;
  if (!enc) return `<div class="detail pb"><h3>이 전장의 주요 적</h3>${matchupHtml(run.field, false) || '<p class="small muted">특별한 면역 · 취약 없음</p>'}${PREP_TIPS}</div>`;
  const type = run.node!.type;
  // 같은 적은 한 줄로 묶는다 (장비는 편성 보드의 적 카드에 보인다). 누르면 그 적의 첫 개체 상세
  const groups = new Map<string, { id: string; i: number; n: number; idx: number[] }>();
  enc.enemies.forEach((s, i) => {
    const g = groups.get(s.defId) || { id: s.defId, i, n: 0, idx: [] };
    g.n++;
    g.idx.push(i);
    groups.set(s.defId, g);
  });
  // 공명 등급 추정: 개체마다 (장비 · 개조부품이 다를 수 있다) 구해 평균, 올림
  const groupRank = (e: EnemyDef, idx: number[]) => {
    const rs = idx.map((i) => foeRank(run, e, enc.phase ?? run.phase, enc.mult, enc.enemies[i])).filter((r): r is NonNullable<typeof r> => !!r);
    return rs.length ? { lv: Math.ceil(rs.reduce((a, r) => a + r.lv, 0) / rs.length), hpX: rs.reduce((a, r) => a + r.hpX, 0) / rs.length } : null;
  };
  const rank = (e: EnemyDef) => (e.tier === 'boss' ? 0 : e.tier === 'elite' ? 1 : e.inert ? 3 : 2);
  const rows = [...groups.values()].map((g) => ({ e: ENEMY_BY_ID[g.id], ...g })).filter((x) => x.e).sort((a, b) => rank(a.e) - rank(b.e));
  // 아군 공격 속성: 미리보기 전투에서 실제 값을 읽는다 (장비 · 증강 반영)
  const b = deployed(run).length ? buildBattle(run, { ...enc, enemies: [] }, false) : null;
  const allies = b ? b.units.filter((u) => u.side === 0 && !u.isSummon) : [];
  const mu = encounterMatchup(enc.enemies.map((s) => s.defId), allies.map((u) => u.atk.elem));
  const kind = type === 'challenge' ? `${NODE_NAME.challenge} · P${enc.phase ?? run.phase}` : type === 'boss' ? '보스전' : NODE_NAME[type];
  const foe = (x: (typeof rows)[number]) => {
    const cat = enemyCategory(x.e), td = TEND_NAME[x.e.tend];
    const atk = x.e.noAttack ? '' : tchip(lineIcon(`e.${x.e.atk.elem}`, 'li'), '', '', `${ELEM_NAME[x.e.atk.elem]} ${x.e.atk.type === 'shoot' ? '사격' : '타격'}`, `--c:var(--el-${x.e.atk.elem})`);
    return `<li><button class="pb-foe tier-${x.e.tier}" data-a="sel-enemy" data-v="${x.i}" title="${esc(`${x.e.name} — ${ENEMY_DESC[x.e.id] || ''}`)}">${sprite(x.e, 'spr')}
      <span class="pb-nm"><b>${esc(x.e.name)}</b>${x.e.tier !== 'minion' ? `<em>${tierKo(x.e)}</em>` : ''}${x.e.inert ? '<em>장애물</em>' : ''}</span><span class="pb-n">${x.n > 1 ? `×${x.n}` : ''}</span>
      <span class="pb-sub">${rankChip(groupRank(x.e, x.idx))}${tchip(lineIcon(`k.${cat}`, 'li'), CATEGORY_NAME[cat], `cat-${cat}`, `${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}`)}${td ? tchip(lineIcon(`t.${x.e.tend}`, 'li'), td.name, '', `${td.name}: ${td.desc}`) : ''}${atk}</span></button></li>`;
  };
  // 상성 · 아군 공격 속성: 같은 줄 토큰 (아이콘 · 이름 · 인원 · 유리(초록) / 불리(빨강) / 면역 칩)
  const muRows = [
    ...mu.cats.map((x) => muRow(lineIcon(`k.${x.c}`, 'li'), CATEGORY_NAME[x.c], `${x.n}명`, muTags(x), `cat-${x.c}`)),
    mu.bosses ? muRow(NODE_ICON.boss, NODE_NAME.boss, `${mu.bosses}명`, muTag(`${mu.bossImmune.join('·')} 면역`, 'mute'), '', '--c:var(--c-bad)') : '',
  ].join('');
  const elRows = mu.elems.map((x) => muRow(lineIcon(`e.${x.e}`, 'li'), x.name, `${x.allies}명`, `${x.weak ? muTag(`적 ${x.weak}명 취약`, 'good') : ''}${x.resist ? muTag(`적 ${x.resist}명 저항`, 'bad') : ''}`, '', `--c:var(--el-${x.e})`)).join('');
  return `<div class="detail pb" aria-label="이번 전투 적 구성">
    <div class="pb-head"><h3>이번 전투</h3><span class="pb-kind n-${type}">${esc(kind)}</span><span class="muted small">적 ${mu.foes}명 · 체력 ×${+enc.mult.toFixed(2)}</span>${diffAddChip(run, enc.phase ?? run.phase, enc.add || 0)}</div>
    <div class="pb-map">${lineIcon('n.battle', 'li')}<b>${esc(encName(enc))}</b><span>${esc(mapOf(enc.map).desc)}</span></div>
    ${squadList(enc)}
    <ul class="pb-foes">${rows.map(foe).join('')}</ul>
    <h3>상성</h3>
    <ul class="pb-rows">${muRows || '<li class="pb-row muted">특별한 면역 · 취약 없음</li>'}</ul>
    ${elRows ? `<h3>아군 공격 속성 <span class="muted small">출전 ${allies.length}명</span></h3><ul class="pb-rows">${elRows}</ul>` : ''}
    ${PREP_TIPS}
  </div>`;
}
/** 포병 듀오 적 상세 (engine/build.ts linkDuo): 이 칸 (포병 · 부사수) · 두 칸 합친 체력 · 받는 피해 배율 · 움직이지 않음 */
function duoInfo(run: RunState, s: EnemySpawn, b: Battle, c: CUnit) {
  const enc = run.node?.enc, mate = s.duo && enc?.enemies.find((o) => o.sq === s.sq && o.duo !== s.duo);
  if (!s.duo || !enc || !mate) return '';
  const m = buildEnemy(b, ENEMY_BY_ID[mate.defId], enc.phase ?? run.phase, enc.mult, mate), D = CFG.squads.duo, back = s.duo === 'b';
  const rows: [string, string][] = [['이 칸', back ? '포병 (뒤 칸)' : '부사수 (앞 칸)'], ['짝', `${ENEMY_BY_ID[mate.defId].name} (${back ? '앞' : '뒤'} 칸)`], ['체력', `두 칸 합계 ${fmt(b.S(c, 'maxHp') + b.S(m, 'maxHp'))} · 나눠 씀`], ['받는 피해', `뒤 칸 ×${D.back} · 앞 칸 ×${D.front}`], ['이동', '움직이지 않음'], ['쓰러짐', '한 칸이 쓰러지면 둘 다']];
  return `<h3>포병 듀오 <span class="muted small">두 칸 한 기물</span></h3><dl class="um-types ct-rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** '이번 전투' 적 분대 (data/squads.ts): 분대마다 종류 아이콘 · 이름 · 인원 · 분대원 얼굴 (같은 적은 한 번). 누르면 보드에서 그 분대만 강조 (다시 누르면 해제).
 *  증원 분대는 '증원' 꼬리표. 포병 듀오는 두 칸 한 기물이라 '2칸' */
function squadList(enc: Encounter) {
  if (!enc.squads?.length) return '';
  const items = enc.squads.map((q, i) => {
    const mem = enc.enemies.filter((e) => e.sq === i);
    if (!mem.length) return '';
    const k = SQUAD_KIND[q.kind as SquadKind] || SQUAD_KIND.mixed, on = app.sqSel === i;
    const faces = [...new Set(mem.map((e) => e.defId))].slice(0, 3).map((id) => sprite(ENEMY_BY_ID[id], 'spr')).join('');
    const n = q.kind === 'duo' ? '2칸' : `${mem.length}명`;
    return `<li><button class="pb-sq sq-${q.kind}${on ? ' on' : ''}" data-a="sel-squad" data-v="${i}" aria-pressed="${on}" title="${esc(`${q.name} — ${k.name}${q.kind === 'duo' ? ` · 두 칸이 체력을 나눠 쓰는 한 기물 · 뒤 칸 받는 피해 ×${CFG.squads.duo.back}` : ''}`)}">
      <span class="pb-sq-ic">${lineIcon(k.icon, 'li')}</span><span class="pb-sq-nm"><b>${esc(q.name)}</b>${q.name !== k.name ? `<em>${esc(k.name)}</em>` : ''}${q.add ? '<em class="pb-sq-add">증원</em>' : ''}</span><span class="pb-sq-faces">${faces}</span><span class="pb-n">${n}</span></button></li>`;
  }).join('');
  return `<h3 class="pb-sq-h">분대 <span class="muted small">${enc.squads.length}개</span></h3><ul class="pb-sqs">${items}</ul>`;
}
/** 적이 단 장비: 적 정의의 장비 · 개조부품 + 이번 조우의 위험 등급 장비 (편성 보드 · 적 구성 · 적 상세 공용, 강제 징수기로 떼어 낸 적은 정의 장비도 없음) */
function foeGear(e: EnemyDef, s: { items?: string[]; mod?: string; stripped?: boolean }) {
  return [...(s.stripped ? [] : [...(e.items || []).filter((x): x is string => !!x), ...(e.mod ? [e.mod] : [])]), ...(s.items || []), ...(s.mod ? [s.mod] : [])];
}
/** 작은 칩: 아이콘 + 글씨. tone = good(유리) · bad(불리) · mute(면역 등), 그 밖 클래스 · --c(데이터 색) 지정 가능 */
function tchip(icon: string, txt: string, cls = '', title = '', st = '') {
  return `<span class="tchip ${cls}"${title ? ` title="${esc(title)}"` : ''}${st ? ` style="${st}"` : ''}>${icon}${txt}</span>`;
}
/** 적 장비 설명 (편성 적 구성 · 보드 · 적 상세): 누르면 이름 · 설명 (마우스는 title 로도 보인다) */
function foeItemTip(el: HTMLElement, id: string) {
  document.querySelector('.item-tip')?.remove();
  if (!id) return;
  const it = itemInfo(id);
  const tip = document.createElement('div');
  tip.className = `item-tip tip-${tierKey(id)}`;
  tip.innerHTML = `<span class="tip-tier">적 장비</span><b>${esc(it.name)}</b><span>${statIc(esc(it.desc))}</span>`;
  tip.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(tip);
  const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
  const top = r.top - tr.height - 6 < 8 ? r.bottom + 6 : r.top - tr.height - 6;
  tip.style.left = `${left + scrollX}px`; tip.style.top = `${top + scrollY}px`;
  setTimeout(() => window.addEventListener('pointerdown', () => tip.remove(), { once: true }), 0);
}
function detailPanel(run: RunState, extra = '') {
  const sel = app.sel;
  const bar = dBar('desel', extra);
  if (sel?.k === 'terrain') { const g = runGeo(run), grp = terrainGroups(g)[sel.g]; return grp ? terrainDetail(g, grp, 'desel', undefined, run.node?.enc ? run : undefined) : ''; }
  if (sel?.k === 'enemy' && run.node?.enc) {
    const s = run.node.enc.enemies[sel.i];
    if (!s) return '';
    const e = ENEMY_BY_ID[s.defId];
    const ph = run.node.enc.phase ?? run.phase; // 도전은 다음 페이즈 적
    const b = new Battle(9, 9, new Rng(1), { phase: ph, credits: 0, camp: !!run.campaign, field: run.field, diff: run.diff, despairs: run.despairs, oaths: run.oaths }); // 실제 전투와 같은 전장 · 위험 등급 · 절망 증강 · 절망 서약 (체력 · 피해 배율)
    const c = buildEnemy(b, e, ph, run.node.enc.mult, s);
    const ms = battleMajors(c)!;
    const eq = foeGear(e, s);
    return `<div class="detail">${bar}
      ${foeHead(e, sprite(e, 'spr big'), unitRank(e, c))}
      ${startChips(run)}
      ${duoInfo(run, s, b, c)}
      ${eq.length ? `<h3>장비</h3><div class="d-eqbox"><div class="d-eq">${eq.map((x) => `<span class="tk-it">${itemIcon(x, `data-a="foe-item" data-v="${x}"`)}</span>`).join('')}</div></div>` : ''}
      <div class="mj-wrap"><div class="mj-head"><h3>주요 능력치 <span class="muted small">페이즈 ${ph} · 체력 ${fmt(b.S(c, 'maxHp'))}</span></h3>${magBtn()}</div>${majorsHtml(ms, foeAmp(ms, c))}</div>
      <h3>능력</h3><div class="abils">${enemyAbilCards(e, b, c)}</div>
    </div>`;
  }
  if (sel?.k === 'turret') return turretDetail(run, sel.i, bar);
  if (sel?.k === 'king') return kingDetail(run, bar);
  if (sel?.k !== 'unit') return prepBrief(run);
  const u = run.units.find((x) => x.uid === sel.uid);
  if (!u) return '';
  const d = withEmblemSummon(UNIT_BY_ID[u.defId], u.mod); // 최고의 친구 문장: 소환물 섹션에 반려 돌(인화성)
  const { b, c } = previewAlly(run, u);
  const effects = unitEffects(run, u, synergyCounts(deployed(run), run), !!u.pos);
  const tm = totalMajors(u, effects);
  const title = rankTitle(u.rank + effects.reduce((s, e) => s + (e.rankBonus || 0), 0)) + effects.reduce((s, e) => s + (e.title || 0), 0);
  const cost = R.xpCost(run);
  const synTok = (() => { const cnt = synergyCounts(deployed(run), run) as Record<string, number>; return memberships(u, run).map((id) => synToken(id, cnt[id] || 0)).join(''); })();
  return `<div class="detail dp-unit">${dBar('desel', blessBtn(run, u, d) + maxBtn(u.uid) + extra)}
    <div class="um-sticky dp-sticky"><div class="um-sc" aria-hidden="true">${sprite(d, 'um-face')}<div class="um-sc-main"><div class="um-rank">${rankLabel(u.rank)}${xpBar(u)}</div><div class="pc-syn">${synTok}</div></div></div></div>
    <div class="d-hero">${hero(d.id) || `<div class="hero none">${sprite(d, 'spr big')}</div>`}
      <div class="pc-syn dh-syn">${synTok}</div>
      <div class="dh-name"><b>${esc(d.name)}</b><span class="dh-types"><i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i></span></div></div>
    <div class="dh-rank"><span class="dh-r">${rankLabel(u.rank)}</span>${xpBar(u)}<button class="btn tiny dh-buy" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost || R.isRock(u) ? 'disabled' : ''} title="공명도 +${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)} 구입 (에너지 크레딧 ${cost})">${lineIcon('r.res', 'li res')}+${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)}<span class="dh-cost">${lineIcon('r.cr', 'li cr')}${cost}</span></button></div>
    ${powRow(b, c, d, !!u.pos)}
    ${startChips(run)}
    ${memberships(u, run).includes('KAL') ? `<div class="small accent">작위: ${TITLE_NAME[Math.min(6, title)]}</div>` : ''}
    <h3>장비</h3>${eqBox(u)}

    <div class="mj-wrap">
    <div class="mj-head"><h3>주요 능력치</h3><button class="mag-btn${app.statPop ? ' on' : ''}" data-a="stat-pop" title="상세 능력치" aria-label="상세 능력치 ${app.statPop ? '닫기' : '보기'}" aria-pressed="${app.statPop}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l4.5 4.5"/></svg></button></div>
    <div class="majors">${MAJORS.map((m) => {
      const base = d.base[m], add = tm[m] - base;
      return `<div class="major"><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`;
    }).join('')}</div>
    </div>
    <h3>능력</h3>
    <div class="abils">
      ${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}
      ${traitGroup(d, u, run, b, c)}
      ${aceAbil(run, u)}${voyAbil(d, run, u)}
      ${skillCard(d, b, c)}
      ${summonSection(d, b, c, sumScope(u))}
      ${ultCard(d, b, c)}
      ${ttSection(d, u, run, b, c)}${relicSection(d, u, run, c, false, b)}
      ${faithAbil(d, u, run)}
    </div>
    <p class="lore">${esc(d.lore)}</p>
    ${releaseBlock(run, u)}
  </div>`;
}

// ───────────────────────── 화면: 전투
/** 전투 보드 칸 (테두리 · 적 진형 · 간격 · 아군 진형 색 구분) */
function battleCells(enc: Encounter) {
  const g = encGeo(enc), { w, h } = scrDims(g), tLay = terrainLayer(g); // 화면 칸 순서로 (가로 지형은 돌려서, BattleView.syncTerrain 도 이 순서)
  let out = '';
  for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) {
    const { x, y } = fromScr(g, sx, sy), z = zoneAt(g, x, y);
    const tc = tLay.at.get(`${x},${y}`);
    out += tc && !TERRAIN[tLay.groups[tc.gid].k].breakable ? terrainCell(tLay, x, y, 'data-a="bterrain"', -1) : `<div class="cell ${z === 'edge' ? 'pad' : z === 'ally' ? 'mine' : z}"></div>`; // 차 · 바리케이드는 전투에서 구조물 (칸은 빈칸)
  }
  return out + terrainIcons(tLay, (x, y) => { const s = toScr(g, x, y); return `left:${(s.x / w) * 100}%;top:${(s.y / h) * 100}%;width:${100 / w}%;height:${100 / h}%`; }, -1, true);
}
// ───────── 지형 지물 (data/maps.ts terrainGroups): 칸마다 종류 무늬 + 덩어리 테두리, 덩어리 가운데 칸에 아이콘. 누르면 덩어리 전체 강조 + 상세
interface TerrainLayer { groups: TerrainGroup[]; at: Map<string, { gid: number; edge: string; bits: number }>; mid: { x: number; y: number }[] }
function terrainLayer(g: Geo): TerrainLayer {
  const groups = terrainGroups(g), at = new Map<string, { gid: number; edge: string; bits: number }>();
  const bitsAt = new Map(terrainOf(g).map((c) => [`${c.x},${c.y}`, c.bits ?? TERRAIN[c.k].bits])); // 칸마다 처음 상태 (금고문 틈 · 꺼진 레이저 줄)
  for (const grp of groups) {
    const has = (x: number, y: number) => grp.cells.some((c) => c.x === x && c.y === y);
    for (const c of grp.cells) {
      const edge = [!has(c.x, c.y - 1) && 'e-t', !has(c.x + 1, c.y) && 'e-r', !has(c.x, c.y + 1) && 'e-b', !has(c.x - 1, c.y) && 'e-l'].filter(Boolean).join(' ');
      at.set(`${c.x},${c.y}`, { gid: grp.id, edge, bits: bitsAt.get(`${c.x},${c.y}`) ?? 0 });
    }
  }
  // 덩어리 아이콘 자리: 칸들의 무게중심 (2칸 방벽이면 두 칸 사이)
  const mid = groups.map((grp) => ({ x: grp.cells.reduce((a, c) => a + c.x, 0) / grp.cells.length, y: grp.cells.reduce((a, c) => a + c.y, 0) / grp.cells.length }));
  return { groups, at, mid };
}
/** act 에 data-v 가 없으면 덩어리 번호를 data-v 로 · 접은 연결교는 folded (진공 틈 무늬) · cls = 덧붙일 칸 클래스 */
function terrainCell(l: TerrainLayer, x: number, y: number, act: string, selG: number, gateOpen = false, cls = '') {
  const c = l.at.get(`${x},${y}`)!, grp = l.groups[c.gid], k = grp.k, t = TERRAIN[k], folded = k === 'bridge' && !!(grp.bits & 1);
  const open = (k === 'gate' && gateOpen) || (TERRAIN[k].dyn && k !== 'holo' && !c.bits); // 열린 수문 · 금고문 틈 · 꺼진 레이저 줄 (전투 중에는 BattleView.syncTerrain)
  return `<div class="cell tr tr-${k} ${c.edge}${c.gid === selG ? ' tr-sel' : ''}${open ? ' open' : ''}${grp.off ? ' off' : ''}${folded ? ' folded' : ''}${grp.crate !== undefined ? ` cr-${grp.crate % 3}` : ''}${cls ? ` ${cls}` : ''}" ${act}${act.includes('data-v=') ? '' : ` data-v="${c.gid}"`} data-tg="${c.gid}" title="${esc(`${t.name}${folded ? ' (접음)' : ''} — ${t.desc}`)}"></div>`;
}
/** 지형 지물 아이콘: 덩어리마다 1개, 무게중심에 (누름은 아래 칸이 받는다). box = 칸 1개 크기 자리 (소수 좌표 가능) */
const terrainIcons = (l: TerrainLayer, box: (x: number, y: number) => string, lift = -1, battle = false) => // lift = 크레인으로 든 컨테이너 번호 (쥔 도구 배지) · battle = 전투 보드 (구조물이 된 차 · 바리케이드는 빼고)
  l.groups.map((grp, i) => battle && TERRAIN[grp.k].breakable ? '' : `<i class="tr-ic${grp.crate !== undefined && grp.crate === lift ? ' armed' : ''}" style="${box(l.mid[i].x, l.mid[i].y)}">${lineIcon(TERRAIN[grp.k].icon, 'li')}${grp.crate !== undefined && grp.crate === lift ? ARM_BADGE : ''}</i>`).join('');
/** 전투 중 수문 덩어리 상태 (칸마다 실제 지형 비트에서): 상태 · 다음 전환까지 남은 초 (전투 시간) · 폐쇄 대기 칸 수 */
interface GateLive { state: GateState; left: number; pend: number }
function gateLive(b: Battle, grp: TerrainGroup): GateLive {
  return { state: gateGroupState(b, grp.cells), left: Math.max(0, Math.ceil((b.mem.gateNext ?? 0) - b.t - 1e-9)), pend: grp.cells.filter((c) => gateState(b, c.x, c.y) === 'pending').length };
}
const GATE_NAME: Record<GateState, string> = { open: '열림', shut: '닫힘', pending: '폐쇄 대기' };
/** 광석 운반차 (전투 중): 다음 통과까지 남은 초 · 방향 · 지나는 중 */
interface CartLive { left: number; dir: 1 | -1; run: boolean }
function cartLive(b: Battle): CartLive | undefined {
  if (b.mem.cartNext === undefined) return undefined;
  return { left: Math.max(0, Math.ceil(b.mem.cartNext - b.t - 1e-9)), dir: b.mem.cartDir > 0 ? 1 : -1, run: !!b.mem.cartRun };
}
const cartArrow = (d: number) => (d > 0 ? '→' : '←');
/** 운반차 통과 시각 (CFG.maps.cart): '6 · 16 · 26초, 이후 10초마다' */
const cartTimes = () => { const C = CFG.maps.cart; return `${[0, 1, 2].map((i) => C.first + i * C.period).join(' · ')}초, 이후 ${C.period}초마다`; };
/** 편성 화면 크레인: 고른 지형 지물이 컨테이너이고 그 컨테이너로 크레인을 켠 동안만 번호 (아니면 null) */
function craneOn(run: RunState): number | null {
  if (app.crane === null || app.sel?.k !== 'terrain' || !run.node?.enc) return null;
  return terrainGroups(runGeo(run))[app.sel.g]?.crate === app.crane ? app.crane : null;
}
/** 컨테이너 번호 → 지금 덩어리 번호 (옮겨도 그대로지만, 고른 상태를 다시 맞출 때) */
const crateGroup = (g: Geo, crate: number) => terrainGroups(g).findIndex((x) => x.crate === crate);
/** 컨테이너 환적장 보드 겹: 빈 적재칸 (흐린 점선, 편성 화면에서만) · 크레인을 켜면 그 컨테이너가 갈 수 있는 적재칸 (누르면 옮김) · 못 가는 칸 (이유 이름표) */
function craneLayer(run: RunState, g: Geo, box: (x: number, y: number, w?: number, h?: number) => string) {
  const enc = run.node?.enc, m = mapOf(enc?.map);
  if (!enc || !m.bays) return '';
  const pick = craneOn(run);
  if (pick === null) {
    const filled = new Set(terrainOf(g).filter((c) => c.crate !== undefined).map((c) => `${c.x},${c.y}`));
    const empty = (b: { x: number; y: number; w: number; h: number }) => ![...Array(b.w * b.h).keys()].some((i) => filled.has(`${b.x + (i % b.w)},${b.y + Math.floor(i / b.w)}`));
    const homes = crateHomes(m.terrain?.(g) || []).filter((h) => enc.crane?.[h.i] !== undefined && empty(h)); // 옮긴 컨테이너의 원래 자리 (원위치로 돌릴 곳)
    return `<div class="bay-host">${m.bays(g).filter(empty).map((b) => `<i class="bay" style="${box(b.x, b.y, b.w, b.h)}"></i>`).join('')}${homes.map((h) => `<i class="bay home" style="${box(h.x, h.y, h.w, h.h)}" title="원래 자리"></i>`).join('')}</div>`;
  }
  return `<div class="bay-host on">${R.craneSlots(run, pick).map((s) => s.err
    ? `<i class="bay bad" style="${box(s.at.x, s.at.y, s.at.w, s.at.h)}" title="${esc(s.err)}"><b class="bay-lb">${NO_ICON}${esc(s.err)}</b></i>`
    : `<button class="bay ok cr-${pick % 3}" data-a="crane-drop" data-v="${s.bay}" style="${box(s.at.x, s.at.y, s.at.w, s.at.h)}" title="여기로 옮기기" aria-label="${crateName(pick)}를 여기로 옮기기"><b class="bay-lb">여기로</b></button>`).join('')}</div>`; // 갈 수 있는 칸 = 약한 면 · 가리키면 컨테이너 모습 (다음 누름 결과)
}
/** 편성 화면 (전투 전) 바뀌는 지형의 시작 상태 칩: 홀로그램 · 레이저 · 금고문 · 전력선 · 스프링클러 · 금고 칸 */
function dynPrep(g: Geo, grp: TerrainGroup) {
  const M = CFG.maps, k = grp.k, st = (cls: string, label: string, tip: string) => `<span class="tchip tr-st ${cls}" title="${esc(tip)}">${esc(label)}</span>`;
  const first = (left: number, what: string) => st('mute', `${left}초 뒤 ${what}`, '전투 시작부터 첫 변화');
  if (k === 'holo') return st('', '켜짐', '전투 시작 때') + first(M.holo.on, '꺼짐');
  if (k === 'laser') { const on = !!grp.cells.length && !!(terrainOf(g).find((c) => c.x === grp.cells[0].x && c.y === grp.cells[0].y)?.bits); return st(on ? 'bad' : 'good', on ? '켜짐' : '꺼짐', '전투 시작 때') + first(M.laser.period, on ? '꺼짐' : '켜짐'); }
  if (k === 'vault') { const open = terrainOf(g).filter((c) => c.k === 'vault' && c.bits === 0).length; return st('', `틈 ${open}칸`, '전투 시작 때') + first(M.vault.period, '회전'); }
  if (k === 'power') return grp.off ? st('good', '차단', '차단기로 끔') : first(M.power.first, '전류');
  if (k === 'sprinkler') return first(g.opt?.sprLate ? M.sprinkler.late : M.sprinkler.early, '살수');
  if (k === 'vaultcell') return st('', `0/${M.vaultCell.need}초`, '아군이 합쳐 선 시간');
  return '';
}
/** 새 지형의 세부 규칙 (이름 + 값, CFG.maps 에서) */
function dynRows(g: Geo, grp: TerrainGroup, run?: RunState): [string, string][] {
  const M = CFG.maps, k = grp.k, ph = run?.node?.enc?.phase ?? run?.phase ?? 1;
  const times = (first: number, every: number) => `${[0, 1, 2].map((i) => first + i * every).join(' · ')}초, 이후 ${every}초마다`;
  const armor = `방어 ${Math.round(DEV.wall.armor * Math.pow(CFG.phaseArmor, ph - 1))}`;
  switch (k) {
    case 'holo': return [['주기', `켜짐 ${M.holo.on}초 → 꺼짐 ${M.holo.off}초`], ['켜진 동안', '직선 사격 막음 · 길은 열림']];
    case 'laser': return [['주기', `${M.laser.period}초마다 두 줄이 엇갈림`], ['켜진 동안', '통행 불가 · 탄은 넘어감'], ['예외', '기물이 선 칸은 비면 켜짐']];
    case 'vault': return [['회전', `${M.vault.period}초마다 틈이 한 칸 오른쪽으로`], ['끝에서', '처음 칸으로'], ['예외', '기물이 선 칸은 비면 닫힘']];
    case 'power': return grp.off ? [['차단기', '꺼짐 (전류 없음)']] : [['전류', `${times(M.power.first, M.power.period)} · ${M.power.live}초 동안`], ['예고', `${M.power.warn}초 전`], ['기절', `${M.power.stun}초`], ['기계 적', `광폭 ${M.power.rampage}초`], ['대상', '아군 · 적 모두 (구조물은 피해만)']];
    case 'sprinkler': return [['살수', times(g.opt?.sprLate ? M.sprinkler.late : M.sprinkler.early, M.sprinkler.period)], ['은신 해제', '전장 전체'], ['둔화 범위', `주변 ${M.sprinkler.r}칸`], ['둔화', `공격 · 이동 속도 −${pctTxt(M.sprinkler.slowAmt)} ${M.sprinkler.slow}초`], ['대상', '아군 · 적 모두']];
    case 'car': return [['체력', `칸마다 ${wallHp(ph, M.car.hpDiv)} · ${armor}`], ['폭발', `부서지고 ${M.car.delay}초 뒤 주변 ${M.car.r}칸`], ['대상', '아군 · 적 · 다른 차 모두 (이어 터진다)']];
    case 'barricade': return [['체력', `칸마다 ${wallHp(ph, M.barricade.hpDiv)} · ${armor}`], ['부서지면', '그 칸이 길이 된다']];
    case 'recovery': return [['범위', `주변 ${M.recovery.r}칸`], ['쓰러진 아군', '망령이 되지 않음'], ['영혼 적', `1초마다 최대 체력 ${pctTxt(M.recovery.soul)} 피해`]];
    case 'dais': return [['사거리', `+${M.dais.range} (기본 사거리 2 이상)`], ['대상', '아군 · 적 모두']];
    case 'vaultcell': return [['조건', `아군이 합쳐 ${M.vaultCell.need}초 서 있기`], ['보수', `승리 때 크레딧 +${M.vaultCell.credits} (전투마다 한 번)`]];
    default: return [];
  }
}
/** 지형 지물 상세 (편성 · 전투 오른쪽 패널, 기물 상세와 같은 틀). docs/UI.md 12 순서: 이름 + 지금 상태 칩 → 핵심 성질 칩 (이동 · 직선 사격 · 기술 · 위험) 한 번
 *  → 할 수 있는 행동 (수문 시작 상태 · 연결교 접기 · 크레인) → 세부 규칙 (주기 · 일정 · 예외 · 배치) → 소개 글. 같은 정보를 칩과 표로 되풀이하지 않는다.
 *  live = 전투 중 상태 (수문 · 운반차), prep = 편성 화면의 런 (전투 전 선택 단추). 둘 다 없으면 조우 밖 */
function terrainDetail(g: Geo, grp: TerrainGroup, back: string, live?: { gate?: GateLive; cart?: CartLive; dyn?: DynLive | null }, prep?: RunState) {
  const t = TERRAIN[grp.k], m = mapOf(g.map), k = grp.k, enc = prep?.node?.enc, M = CFG.maps;
  const gate = k === 'gate', start = !!enc?.gateOpen;
  const [shut, open] = m.gateCycle || [0, 0];
  const gs: GateState = live?.gate?.state ?? (start ? 'open' : 'shut');
  const folded = k === 'bridge' && !!(grp.bits & 1);
  const bl = gate && gs === 'open' ? { walk: false, shot: false } : terrainBlocks(k, gate || t.dyn ? undefined : grp.bits); // 바뀌는 지형 (홀로그램 · 레이저 · 금고문)은 켜진 · 닫힌 성질, 지금 상태는 이름 옆 칩
  const chip = (cls: string, icon: string, label: string, tip: string) => `<span class="tchip ${cls}" data-kw="foe" data-tt="${esc(label)}" data-td="${esc(tip)}" tabindex="0" role="button">${lineIcon(icon, 'li')}${label}</span>`;
  const C = CFG.maps.cart, cl = live?.cart;
  // 이름 옆: 지금 상태 (바뀌는 지형만) — 수문 · 연결교 · 컨테이너 · 선로
  const stChip = (cls: string, label: string, tip: string) => `<span class="tchip tr-st ${cls}" title="${esc(tip)}">${esc(label)}</span>`;
  const next = live?.gate ? live.gate.left : start ? open : shut; // 다음 전환까지 (편성 화면은 전투 시작 기준)
  const state = gate ? stChip(gs === 'open' ? 'good' : gs === 'pending' ? 'bad' : '', gs === 'pending' ? `${GATE_NAME.pending} · ${live!.gate!.pend}칸 열림` : GATE_NAME[gs], '수문 상태') + stChip('mute', `${next}초 뒤 ${gs === 'open' ? '닫힘' : '열림'}`, live ? '다음 전환' : '전투 시작부터 첫 전환')
    : k === 'bridge' ? stChip(folded ? 'bad' : '', folded ? '접음 (진공 틈)' : '펼침', '연결교 상태')
    : grp.crate !== undefined ? stChip('', `${crateName(grp.crate, k)} · ${g.opt?.crane?.[grp.crate] !== undefined ? '옮김' : '원위치'}`, moverName(k))
    : k === 'rail' ? (cl ? stChip(cl.run || cl.left <= C.warn ? 'bad' : '', cl.run ? `지나는 중 ${cartArrow(cl.dir)}` : `${cl.left}초 뒤 통과 ${cartArrow(cl.dir)}`, '광석 운반차') : stChip('', `첫 방향 ${cartArrow(g.opt?.cart ?? m.cartDir ?? 1)}`, '광석 운반차 첫 방향 (조우마다 무작위, 통과마다 반대로)'))
    : live?.dyn ? stChip(live.dyn.cls, live.dyn.st, '지금 상태') + (live.dyn.cd ? stChip(live.dyn.soon ? 'bad' : 'mute', `${live.dyn.cd.left}초 뒤 ${live.dyn.cd.what}`, '다음 변화') : '')
    : live ? '' : dynPrep(g, grp); // 편성 화면: 바뀌는 지형의 시작 상태
  // 핵심 성질: 한 번만 (칩)
  const core = (bl.walk ? chip('bad', 'u.area', '통행 불가', '들어가거나 지나갈 수 없다') : chip('', 'u.area', '통행 가능', '지금은 길이다'))
    + (bl.shot ? chip('bad', 'a.range', '사격 차단', '직선 사격이 막힌다') : chip('', 'a.range', '사격 통과', '너머로 쏠 수 있다'))
    + (bl.shot ? chip('bad', 'p.tech', '기술 일부 차단', '기술 · 상태이상은 틈 없이 갈라질 때만 막힌다') : chip('', 'p.tech', '기술 통과', '기술 · 상태이상이 넘어간다'))
    + (t.taken && !folded ? chip('bad', 'a.shield', `받는 피해 +${Math.round(t.taken * 100)}%`, '위에 선 기물 (엄폐 없음)') : '')
    + (k === 'rail' ? chip('bad', 'u.area', `운반차 피해 ${Math.round(C.dmg * 100)}%`, '최대 체력 비례 물리 피해 (선로 위 기물)') : '')
    + (k === 'power' && !grp.off ? chip('bad', 'u.area', `전류 피해 ${pctTxt(M.power.dmg)}`, '최대 체력 비례 전기 피해 + 기절 (전력선 위 기물)') : '')
    + (k === 'car' ? chip('bad', 'u.area', `폭발 ${pctTxt(M.car.dmg)}`, '부서지면 주변 기물 최대 체력 비례 화학 피해') : '')
    + (k === 'sprinkler' ? chip('', 'a.range', '은신 해제', '살수마다 전장 전체 · 아군 · 적 모두') : '')
    + (k === 'dais' ? chip('good', 'a.range', `사거리 +${M.dais.range}`, '위에 선 원거리 기물 (아군 · 적 모두)') : '')
    + (k === 'recovery' ? chip('good', 'a.shield', '망령 방지', `주변 ${M.recovery.r}칸에서 쓰러진 아군은 망령이 되지 않는다`) : '')
    + (k === 'vaultcell' ? chip('good', 'a.shield', `크레딧 +${M.vaultCell.credits}`, `아군이 합쳐 ${M.vaultCell.need}초 서 있으면 승리 때`) : '');
  // 세부 규칙 (이름 + 값)
  const rows: [string, string][] = [
    ['지형 틀', m.name],
    ['크기', `${grp.cells.length}칸`],
    ...(gate ? [
      ['주기', `닫힘 ${shut}초 → 열림 ${open}초`],
      ['예외', '통과 중에는 닫히지 않음'],
      ...(gs === 'pending' ? [['폐쇄 대기', '기물이 선 칸만 열림 · 비면 바로 닫힘']] : []),
    ] as [string, string][] : []),
    ...(k === 'rail' ? [
      ['운반차 통과', cartTimes()],
      ...(cl ? [['첫 방향', `${cartArrow(g.opt?.cart ?? m.cartDir ?? 1)} (조우마다 무작위)`]] : []),
      ['이후', '통과마다 반대로'],
      ['예고', `${C.warn}초 전`],
      ['기절', `${C.stun}초`],
      ['대상', '아군 · 적 모두 (구조물은 피해만)'],
      ['밀려남', '선로 밖 빈칸 (제 진형 쪽 먼저)'],
      ['지나는 동안', '운반차 칸 직선 사격 막음'],
    ] as [string, string][] : []),
    ...dynRows(g, grp, prep),
    ['배치', bl.walk || gate || t.dyn ? '불가' : k === 'rail' ? '장치 가능 (운반차에 맞음)' : k === 'power' ? '장치 가능 (전류에 맞음)' : zoneAt(g, grp.cells[0].x, grp.cells[0].y) === 'ally' ? '기물 · 장치 가능' : '장치 가능'],
  ];
  // 할 수 있는 행동 (편성 화면에서만): 수문 시작 상태 · 연결교 접기 · 크레인 — 세부 규칙보다 앞
  const segV = (label: string, opts: [string, string, boolean][]) => `<div class="gate-start"><span class="small muted">${label}</span><span class="seg">${opts.map(([v, l, on]) => `<button class="btn small${on ? ' on' : ''}" data-a="map-opt" data-v="${v}" aria-pressed="${on}">${l}</button>`).join('')}</span></div>`;
  const seg = (label: string, act: string, opts: [boolean, string][], cur: boolean, dis?: (o: boolean) => boolean) => `<div class="gate-start"><span class="small muted">${label}</span><span class="seg">${opts.map(([o, l]) => `<button class="btn small${o === cur ? ' on' : ''}" data-a="${act}" data-v="${o ? 1 : 0}" aria-pressed="${o === cur}"${dis?.(o) ? ' disabled' : ''}>${l}</button>`).join('')}</span></div>`;
  let ctl = '';
  if (enc && !live) {
    if (gate) ctl = seg('전투 시작 때', 'gate-start', [[false, '닫힘'], [true, '열림']], start);
    else if (k === 'bridge') {
      const err = folded ? null : R.bridgeFoldErr(prep!);
      ctl = seg('연결교', 'bridge-fold', [[false, '펼침'], [true, '접음']], folded, (o) => o && !!err) + (err ? `<p class="small warn gate-why">접을 수 없음: ${esc(err)}</p>` : '');
    } else if (k === 'sprinkler') ctl = segV('첫 살수', [['spr:0', `먼저 (${M.sprinkler.early}초)`, !enc.sprLate], ['spr:1', `늦게 (${M.sprinkler.late}초)`, !!enc.sprLate]]);
    else if (k === 'laser') { // 이 줄이 먼저 켜지게 · 꺼진 채 시작하게 (두 줄은 늘 엇갈린다)
      const set = laserSets(terrainOf(g)).get(grp.cells[0].y) ?? 0, on = (enc.laserB ? 1 : 0) === set;
      ctl = segV('전투 시작 때', [[`laser:${1 - set}`, '꺼짐', !on], [`laser:${set}`, '켜짐', on]]);
    } else if (k === 'power') { // 차단기: 한쪽만 끈다 (다른 쪽을 끄면 이쪽은 다시 켜진다)
      const side = grp.cells[0].x - g.x0 < g.n / 2 ? 0 : 1;
      ctl = segV('차단기', [['breaker:-', '켬', !grp.off], [`breaker:${side}`, '끔', !!grp.off]]) + '<p class="small muted gate-why">한쪽만 끌 수 있다</p>';
    } else if (grp.crate !== undefined) {
      const on = craneOn(prep!) === grp.crate, hErr = R.craneHomeErr(prep!, grp.crate), moved = hErr !== '이미 원위치', slots = R.craneSlots(prep!, grp.crate), n = slots.filter((s) => !s.err).length;
      ctl = `<div class="gate-start crane-ctl"><button class="btn small${on ? ' on' : ''}" data-a="crane-pick" data-v="${grp.crate}" aria-pressed="${on}"${!slots.length && !on ? ' disabled title="같은 크기의 빈 자리가 없음"' : ''}>${lineIcon('tr.crane', 'li')}${on ? '취소' : `${moverName(k)}${k === 'recovery' ? '로' : '으로'} 옮기기`}</button>${moved ? `<button class="btn small" data-a="crane-home" data-v="${grp.crate}"${hErr ? ' disabled' : ''}>원위치</button>` : ''}<span class="small muted">옮길 자리 <b>${n}</b>곳</span></div>`
        + (on ? '<p class="small muted gate-why">보드에서 빈 적재칸을 누르면 옮긴다</p>' : '') + (moved && hErr ? `<p class="small warn gate-why">원위치 불가: ${esc(hErr)}</p>` : '');
    }
  }
  return `<div class="detail dp-terrain">${dBar(back)}
    ${heroHead('', `<span class="tr-hero tr-${k}${folded ? ' folded' : ''}">${lineIcon(t.icon, 'li')}</span>`, t.name, state)}
    <div class="tr-core">${core}</div>
    ${ctl}
    <h3>세부 규칙</h3><dl class="um-types ct-rules">${rows.map(([kk, v]) => `<dt>${esc(kk)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <p class="small foe-line tr-lore">${esc(t.lore)}</p>
  </div>`;
}
/** 이름 없이 폭만 말하는 전장 이름 (config boardSizes · 좁은 지형 틀): 머리에 '폭 n칸' 이 따로 있어 쓰지 않는다 */
const PLAIN_ENV = new Set([...CFG.boardSizes.map((b) => b.env), '좁은 전장']);
/** 이번 전장 이름: 지형 틀 이름 (개활지 · 광석 운반차 선로 …). 개활지인데 조우가 따로 이름을 가지면 (보스 아레나 · 튜토리얼 장소) 그 이름 */
function encName(enc: Encounter) {
  const m = mapOf(enc.map);
  return m.id === 'open' && enc.env && !PLAIN_ENV.has(enc.env) ? enc.env : m.name;
}
/** 편성 · 전투 보드 머리 제목 (docs/UI.md 17): 전장 이름 = 제목 글자 + 흐린 '폭 n칸 · 역경'. 이름은 칩이 아니고, 같은 것을 두 번 쓰지 않는다 (지형 설명은 오른쪽 '이번 전투') */
function boardTitle(enc: Encounter, type?: string) {
  const name = encName(enc);
  const meta = [`폭 ${enc.n}칸`, type === 'adversity' ? '역경' : '', type === 'challenge' ? `도전 (P${enc.phase} 역경급)` : '', type === 'boss' && name !== '보스 아레나' ? '보스전' : ''].filter(Boolean).join(' · ');
  return `<span class="bh-title"><b class="bh-name">${esc(name)}</b><span class="bh-meta">${esc(meta)}</span></span>`;
}
/** 실제 진행 속도: 상세 정보를 보는 중이면 ×0.25 (설정) */
function applySpeed() {
  const slow = app.slowDetail && app.battleSel !== null && !app.view?.b.over;
  if (app.view) app.view.speed = app.paused ? 0 : app.speed * (slow ? 0.25 : 1);
  const pb = document.querySelector<HTMLElement>('.speed .pause');
  if (pb) { pb.classList.toggle('on', app.paused); pb.textContent = app.paused ? '▶' : '❚❚'; pb.title = app.paused ? '계속 (Space)' : '일시 정지 (Space)'; }
  document.getElementById('bboard')?.classList.toggle('paused', app.paused);
  const tag = document.getElementById('bslow');
  if (tag) tag.hidden = !slow;
}
/** 전투 화면 가로 여유 칸: 엔지니어 포탑이 있으면 편성 화면처럼 양옆 가장자리 열(포탑 칸)까지 보여 준다 */
const bviewEx = (run: RunState) => (!app.zoomOut && turretCount(run) > 0 ? PAD : 0);
/** 전투 보드 창: 기본 창 = 배치 구역 (테두리 제외 · 포탑 열 포함), 전체 보기면 전장 전체. 화면 칸 단위 (가로 지형은 돌려서):
 *  --w · --h = 창 칸 수 (배율 1), --fw · --fh = 전장 칸 수, --ox · --oy = 기본 창의 왼쪽 위 칸, --bz = 확대 배율 (bcam) */
function bviewHtml(run: RunState, enc: Encounter) {
  const g = encGeo(enc), ex = bviewEx(run), S = scrDims(g), full = app.zoomOut;
  const v0 = full ? { x: 0, y: 0, w: S.w, h: S.h } : rectScr(g, PAD - ex, PAD, g.w - 2 * PAD + 2 * ex, g.h - 2 * PAD);
  // 창은 언제나 정사각 (긴 지형도 크게 · 궁극기 컷인 등 창을 채우는 연출이 지형 비율에 따라 찌그러지지 않게): 긴 변 칸 수로 맞추고, 짧은 쪽은 가운데 두고 전장 밖은 빈 바탕
  const sq = Math.max(v0.w, v0.h), v = { x: v0.x - (sq - v0.w) / 2, y: v0.y - (sq - v0.h) / 2, w: sq, h: sq };
  const zb = (d: 'out' | 'in') => `<button class="btn tiny bz-b" data-a="bzoom-b" data-v="${d}" title="${d === 'in' ? '확대' : '축소'} (Ctrl + 휠 · 두 손가락)" aria-label="${d === 'in' ? '확대' : '축소'}">${lineIcon(d === 'in' ? 'u.zoomin' : 'u.zoomout', 'li')}</button>`;
  return `<div class="board bview${full ? ' full' : ''}${g.rot ? ' rot' : ''}" data-a="bdesel" data-ex="${ex}" style="--ox:${v.x};--oy:${v.y};--w:${v.w};--h:${v.h};--fw:${S.w};--fh:${S.h}"><div class="board-in" id="bboard"><div class="cells">${battleCells(enc)}</div></div>${full ? '' : `<span class="bz-ctl bz-bat" hidden>${zb('out')}${zb('in')}</span>`}</div>`;
}
function battleScreen(run: RunState) {
  const enc = run.node!.enc!;
  return `<main class="wrap battle">
    <aside class="side left">
      <div class="meter-tabs">${([['dmg', '준 피해'], ['taken', '받은 피해'], ['support', '회복 · 보호막'], ['kills', '결정타']] as const).map(([k, l]) => `<button class="btn tiny ${app.meterTab === k ? 'on' : ''}" data-a="meter-tab" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="meter" class="meter"></div>
      <section class="bf-wrap bf-sk" aria-label="스킬 사용"><h4 class="bf-h">스킬 사용</h4><ol id="bf-skill" class="bfeed"></ol></section>
    </aside>
    <section class="board-col">
      <div class="board-head">${boardTitle(enc, run.node?.type)}<span id="btime" class="mono">0.0초</span><span id="bslow" class="bslow" hidden title="상세 정보를 보는 중 · 설정에서 끌 수 있습니다">상세 보기 ×0.25</span>
        <span class="speed"><button class="btn tiny pause${app.paused ? ' on' : ''}" data-a="pause" title="일시 정지 (Space)" aria-label="일시 정지">${app.paused ? '▶' : '❚❚'}</button>${SPEEDS.map((s) => `<button class="btn tiny ${app.speed === s ? 'on' : ''}" data-a="speed" data-v="${s}">${s}×</button>`).join('')}
        <button class="btn tiny" data-a="skip">결과로</button></span></div>
      ${bviewHtml(run, enc)}
    </section>
    <aside class="side right">
      <section id="bf-ev-wrap" class="bf-wrap bf-ev" aria-label="전투 사건"><h4 class="bf-h">전투 사건<small>기물을 누르면 상세 정보</small></h4><ol id="bf-event" class="bfeed"></ol><p class="bf-empty muted small">궁극기 · 부활 · 쓰러짐 · 소환 · 시너지 발동이 여기에 쌓입니다.</p></section>
      <div id="bunit" class="bunit detail" hidden></div>
    </aside>
    ${app.summary ? summaryModal(run) : ''}
  </main>`;
}

let meterAt = 0;
function updateMeter(force = false) {
  const v = app.view;
  if (!v) return;
  // 매 프레임 다시 그리면 클릭이 씹히므로 0.25초 간격으로
  const now = performance.now();
  if (!force && now - meterAt < 250 && !v.b.over) return;
  meterAt = now;
  const t = document.getElementById('btime');
  if (t) t.textContent = `${v.b.t.toFixed(1)}초${v.b.t > CFG.overtimeStart - (v.b.ctx.otShift || 0) ? ' · 연장전' : ''}`; // 초침의 서약이면 연장전이 빠르다
  const m = document.getElementById('meter');
  if (!m) return;
  // 소환물 수치는 주인에게 합산. 탭: 준 피해(속성 비중) / 받은 피해 / 회복 · 보호막 / 결정타
  const tab = app.meterTab;
  const val = (a: Agg) => (tab === 'dmg' ? a.dmg : tab === 'taken' ? a.taken : tab === 'support' ? a.healed + a.shield : a.kills);
  const rows = aggAllies(v.b).sort((x, y) => val(y) - val(x));
  const max = Math.max(1, ...rows.map(val));
  m.innerHTML = rows.map((a) => `<div class="mrow ${a.u.alive ? '' : 'dead'}${a.n ? ' bond' : ''} ${app.battleSel === a.u.id ? 'sel' : ''}" data-a="bsel" data-v="${a.u.id}">${sprite(a.u)}<span class="mname">${aggName(a)}</span>
    ${tab === 'dmg' ? `<span class="mbar">${elemBar(a)}<i class="fill" style="width:${(a.dmg / max) * 100}%"></i></span>` : `<span class="mbar"><i style="width:${(val(a) / max) * 100}%"></i></span>`}
    <b class="mono">${tab === 'kills' ? a.kills : fmt(val(a))}</b>
    ${tab === 'support' ? `<small class="heal-t">회복 ${fmt(a.healed)} · 보호막 ${fmt(a.shield)}</small>` : ''}</div>`).join('')
    + (() => {
      if (tab === 'kills') return '';
      const sv = (x: SynAgg) => (tab === 'dmg' ? x.dmg : tab === 'taken' ? x.taken : x.healed + x.shield);
      const ss = aggSyn(v.b).filter((x) => sv(x) >= 1).sort((x, y) => sv(y) - sv(x));
      return ss.length ? `<div class="mrow-h">시너지 효과</div>${ss.map((x) => `<div class="mrow syn">${synBadge(x)}<span class="mname">${esc(x.name)}</span>
        ${tab === 'dmg' ? `<span class="mbar">${elemBar(x as unknown as Agg)}<i class="fill" style="width:${Math.min(100, (x.dmg / max) * 100)}%"></i></span>` : `<span class="mbar"><i style="width:${Math.min(100, (sv(x) / max) * 100)}%"></i></span>`}
        <b class="mono">${fmt(sv(x))}</b>${tab === 'support' ? `<small class="heal-t">회복 ${fmt(x.healed)} · 보호막 ${fmt(x.shield)}</small>` : ''}</div>`).join('')}` : '';
    })();
  followCamera(v.b);
  renderBattleUnit(v.b, force);
  v.select(app.battleSel);
}

/** 보상 줄: 종류별 아이콘 + 내용 + 수치 */
function resLine(l: string, i: number) {
  const STREAK = lineIcon('r.streak', 'li streak');
  const icon = /연승/.test(l) ? STREAK : /인과|청라공국/.test(l) ? lineIcon('a.power', 'li faith') : /공명도/.test(l) ? RES : /명성/.test(l) ? lineIcon('a.fame', 'li fame') : /권능/.test(l) ? lineIcon('n.pilgrim', 'li faith')
    : /승리 보상|이자|실적|정산|보험금|상환|판매|크레딧/.test(l) ? CR : /패배|체력/.test(l) ? lineIcon('r.hp', 'li bad') : lineIcon('r.more', 'li');
  const m = l.match(/^(.*?)\s*([+-]\d+)(.*)$/);
  const body = m ? `<span class="rl-t">${esc(m[1])}${m[3] ? ` <small>${esc(m[3].trim())}</small>` : ''}</span><b class="rl-v${m[2].startsWith('-') ? ' neg' : ''}">${esc(m[2])}</b>` : `<span class="rl-t">${esc(l)}</span>`;
  return `<li style="--i:${i}" class="${/연승/.test(l) ? 'streak' : ''}">${icon}${body}</li>`;
}
/** 결과 창 공명도 막대: 전투 전 → 후. 등급이 오르면 가득 찬 뒤 번쩍이며 등급 표시가 바뀌고 새 등급에서 다시 차오른다 */
function animateResult(scope: Element | Document) {
  const rows = Array.from(scope.querySelectorAll<HTMLElement>('.rs-xp li[data-from]:not([data-done])'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  rows.forEach((li, i) => {
    li.dataset.done = '1';
    const from = +li.dataset.from!, to = +li.dataset.to!, up = +li.dataset.up!;
    const bar = li.querySelector<HTMLElement>('.rx-new')!, old = li.querySelector<HTMLElement>('.rx-old')!, rank = li.querySelector<HTMLElement>('.rx-rank')!;
    const finish = () => { if (up) { old.style.width = '0%'; rank.innerHTML = rankLabel(+li.dataset.r1!); li.classList.add('ranked'); } bar.style.width = `${to}%`; };
    if (reduce) { finish(); return; }
    const delay = 700 + i * 160;
    if (!up) { setTimeout(() => { bar.style.transition = 'width .8s cubic-bezier(.2,.8,.3,1)'; bar.style.width = `${to}%`; }, delay); return; }
    setTimeout(() => { bar.style.transition = 'width .45s ease-in'; bar.style.width = '100%'; }, delay);
    setTimeout(() => {
      li.classList.add('ranked');
      SND.sfx('rankUp', { step: i }); // 등급 상승음 (아래 줄일수록 조금씩 높게)
      rank.innerHTML = rankLabel(+li.dataset.r1!);
      old.style.width = '0%';
      bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth;
      bar.style.transition = 'width .6s cubic-bezier(.2,.8,.3,1)'; bar.style.width = `${to}%`;
    }, delay + 520);
    void finish;
  });
}
/** MVP: 피해 · 지원(회복+보호막) · 받아낸 피해 · 결정타를 각각 아군 최고치 대비로 환산해 합산. 가장 큰 항목이 칭호가 된다 */
function pickMvp(b: Battle) {
  const rows = aggAllies(b, false);
  if (!rows.length) return null;
  const mx = (f: (a: Agg) => number) => Math.max(1, ...rows.map(f));
  const md = mx((a) => a.dmg), ms = mx((a) => a.healed + a.shield), mt = mx((a) => a.taken), mk = mx((a) => a.kills);
  const parts = (a: Agg) => [
    ['최다 피해', (a.dmg / md) * 1.0], ['최고의 지원', ((a.healed + a.shield) / ms) * 0.9], ['최전선', (a.taken / mt) * 0.6], ['마무리 일격', (a.kills / mk) * 0.4],
  ] as [string, number][];
  const best = rows.map((a) => ({ a, p: parts(a), sc: parts(a).reduce((x, [, v]) => x + v, 0) + (a.u.alive ? 0.15 : 0) })).sort((x, y) => y.sc - x.sc)[0];
  const title = best.p.slice().sort((x, y) => y[1] - x[1])[0][0];
  return { a: best.a, title };
}
function summaryModal(run: RunState) {
  const s = app.summary!;
  const b = app.lastBattle;
  const mvp = b ? pickMvp(b) : null;
  const d = mvp ? UNIT_BY_ID[mvp.a.u.defId] : null;
  // 대사: 승리 = MVP 대사, 패배 = 분투 대사, 전멸 = 패배 대사 (런 시드 · 단계로 고정 → 다시 그려도 그대로). 없으면 소개 문구
  const vs = d ? VOICE[d.id] : undefined;
  const quote = d ? voicePick(s.won ? vs?.mvp : s.gameOver ? vs?.lose : vs?.struggle, `${run.seed}|${run.step}|${d.id}`) || d.lore.replace(/^["“]|["”]$/g, '') : '';
  // 공명도: 전투 전 → 후 막대 (등급이 오르면 한 번 가득 찼다가 새 등급에서 다시 차오른다)
  const xp = s.xp.filter((x) => x.amount > 0).map((x, i) => {
    const u = run.units.find((y) => y.uid === x.uid);
    if (!u) return '';
    const r0 = x.rank0 ?? u.rank, x0 = x.xp0 ?? Math.max(0, u.xp - x.amount);
    const max = u.rank >= CFG.maxRank;
    const from = r0 >= CFG.maxRank ? 100 : Math.min(100, (x0 / CFG.xpToNext(r0)) * 100), to = max ? 100 : Math.min(100, (u.xp / CFG.xpToNext(u.rank)) * 100);
    const up = u.rank - r0;
    return `<li style="--i:${i}" class="${up ? 'up' : ''}" data-from="${from}" data-to="${to}" data-up="${up}" data-r0="${r0}" data-r1="${u.rank}">${sprite(UNIT_BY_ID[u.defId])}
      <span class="rx-n">${esc(UNIT_BY_ID[u.defId].name)}</span><span class="rx-rank">${rankLabel(r0)}</span>
      <span class="rx-bar"><i class="rx-old" style="width:${from}%"></i><i class="rx-new" style="width:${from}%"></i></span>
      <b>+${x.amount}</b>${up ? `<em class="rx-up">등급 상승${up > 1 ? ` ×${up}` : ''}</em>` : ''}</li>`;
  }).join('');
  const head = s.gameOver ? '용병단 전멸' : s.won ? '승리' : '패배';
  const mvpStat = mvp ? [['준 피해', mvp.a.dmg], ['지원', mvp.a.healed + mvp.a.shield], ['받은 피해', mvp.a.taken], ['결정타', mvp.a.kills]].filter(([, v]) => (v as number) > 0).map(([k, v]) => `<span><small>${k}</small><b>${fmt(v as number)}</b></span>`).join('') : '';
  return `<div class="modal-bg res-bg${s.won ? ' win' : ''}"><div class="modal result rs ${s.won ? 'win' : 'lose'}">
    <div class="rs-banner"><span class="rs-rays" aria-hidden="true"></span><b>${head}</b><small>${s.won ? 'MISSION COMPLETE' : s.gameOver ? 'MISSION FAILED' : 'RETREAT'}</small></div>
    <div class="rs-grid">
      ${d && mvp ? `<section class="rs-mvp" aria-label="MVP">
        <div class="rs-mvp-art">${standImg(d.id, 'stand', true) || sprite(d, 'spr big')}</div>
        <div class="rs-mvp-tag"><span class="rs-crown">${s.won ? 'MVP' : '분투'}</span><em>${mvp.title}</em></div>
        <div class="rs-mvp-name"><b>${esc(d.name)}</b><small>${esc(d.title)}</small></div>
        <blockquote class="rs-quote">${esc(quote)}</blockquote>
        <div class="rs-mvp-stats">${mvpStat}</div>
      </section>` : ''}
      <section class="rs-reward"><h3>${s.won ? '보상 일람' : '피해 보고 · 정산'}</h3>
        ${!s.won && s.hpLoss > 0 ? (() => { const after = Math.max(0, run.hp), before = Math.min(run.maxHp, after + s.hpLoss); return `<div class="rs-hp" data-before="${(before / run.maxHp) * 100}" data-after="${(after / run.maxHp) * 100}">
          <div class="rs-hp-top">${lineIcon('r.hp', 'li')}<span>함대 체력</span><b>${before} → ${after}</b><em>-${s.hpLoss}</em></div>
          <div class="rs-hp-bar"><i class="loss" style="left:${(after / run.maxHp) * 100}%;width:${(s.hpLoss / run.maxHp) * 100}%"></i><i class="left" style="width:${(after / run.maxHp) * 100}%"></i></div></div>`; })() : ''}
        <ul class="rs-lines">${s.lines.filter((l) => !l.startsWith('장비 획득:')).map((l, i) => resLine(l, i)).join('')}</ul>
        ${s.items?.length ? `<h4>장비 획득</h4><ul class="rs-items">${s.items.map((id, i) => `<li style="--i:${i}">${itemIcon(id)}<span class="it-n it-${isLegendConsumable(id) ? 'L' : itemInfo(id).tier}">${esc(itemInfo(id).name)}</span></li>`).join('')}</ul>` : ''}
        ${xp ? `<h4>${RES}공명도 획득</h4><ul class="rs-xp">${xp}</ul>` : ''}
      </section>
      <section class="rs-report"><h3>전투 보고서 <span class="muted small">${b ? `${b.t.toFixed(1)}초` : ''}</span></h3>${b ? battleTable(b) + reasonReport(b) : ''}</section>
    </div>
    <div class="rs-foot"><button class="btn primary" data-a="after-battle">${s.gameOver ? '결과 보기' : '계속'}</button></div>
  </div></div>`;
}

// ───────────────────────── 화면: 상점
/** 감시 포탑 장비 규칙 (포탑 상세 공용): [항목, 내용] */
const TURRET_RULES: [string, string][] = [
  ['고르기', `엔지니어 ${SYN_BY_ID.ENG.tiers.slice(0, ENG_TUR.picks).join(' · ')}명에 처음 닿을 때 ${ENG_TUR.offer}개 중 1개 (최대 ${ENG_TUR.picks}개)`],
  ['적용', '모든 포탑 공통 (특성 · 증강으로 더 놓인 포탑 포함)'],
  ['장비 능력치', `장비마다 모든 포탑 모든 주요 능력치 +${ENG_TUR.modMaj}`],
  ['유지', '엔지니어 단계가 내려가도 남음 · 포탑이 있을 때만 작동'],
];
/** 상태 칩 (이름 + 값): 지도 노드 미리보기의 예상 수입 칸(.ah-in)과 같은 모양. 화면 머리의 상태 줄 공용 */
const kvChip = (label: string, val: string, title = '', cls = '') => `<span class="ah-in kv ${cls}"${title ? ` title="${esc(title)}"` : ''}><small>${label}</small><span class="kv-v">${val}</span></span>`;
/** 조건 칩 (확정 · 전용 등 켜진 규칙): 지도 노드 미리보기의 모디파이어 칸(.ah-md)과 같은 모양 */
const modChip = (icon: string, txt: string, title = '', cls = '') => `<span class="ah-md tx ${cls}"${title ? ` title="${esc(title)}"` : ''}>${icon}<b>${txt}</b></span>`;
/** 장비 조합법 (상점 도움말): 재료 2개 = 희귀 · 성운 가루 + 재료 = 고급 모듈 · 성운 가루 + 고급 모듈 = 제련 · 성운 가루 2개 = 별무리 파편 · 별무리 파편 + 전설 = 제련 · 전설 합성 불가.
 *  예시 장비 · 능력치는 데이터(combine · itemInfo)에서 */
function combineHelp() {
  const a = `C_${MAJORS[1]}`, b = `C_${MAJORS[2]}`;
  const r = combine(a, b), rr = combine(a, a), g = combine(DUST, a), sh = combine(DUST, DUST), g1 = g && combine(DUST, g);
  const lg = r && `L_${r.slice(2)}`, lg1 = lg && combine(SHARD, lg);
  if (!g || !r || !rr || !sh || !g1 || !lg || !lg1) return '';
  const pts = (id: string) => Object.values(itemInfo(id).majors).reduce((x, y) => x + (y || 0), 0);
  const it = (id: string) => `<span class="ask-it">${itemIcon(id)}<span>${esc(itemInfo(id).name)}</span></span>`;
  const row = (t: string, k: string, eq: string, note: string) => `<div class="cmb-row t${t}"><span class="cmb-k">${k}</span><div class="ask-eq">${eq}</div><span class="cmb-v">${note}</span></div>`;
  return `<div class="cmb">
    ${row('A', '희귀', `${it(a)}<b>+</b>${it(b)}<b>=</b>${it(r)}`, `능력치 <b>+${pts(r)}</b> + 고유 효과`)}
    ${row('A', '희귀', `${it(a)}<b>+</b>${it(a)}<b>=</b>${it(rr)}`, '같은 재료 2개')}
    ${row('G', '고급', `${it(DUST)}<b>+</b>${it(a)}<b>=</b>${it(g)}`, `능력치 <b>+${pts(g)}</b>`)}
    ${row('G', '제련', `${it(DUST)}<b>+</b>${it(g)}<b>=</b>${it(g1)}`, `단계당 <b>+${pts(g1) - pts(g)}</b> · 최대 <b>${CFG.craft.refineMax}</b>단계`)}
    ${row('S', '파편', `${it(DUST)}<b>+</b>${it(DUST)}<b>=</b>${it(sh)}`, '')}
    ${row('L', '전설', `${it(SHARD)}<b>+</b>${it(lg)}<b>=</b>${it(lg1)}`, `합성 불가 · 파편으로 제련 (단계당 <b>+${CFG.craft.legendPts.focus}</b> 또는 각각 <b>+${CFG.craft.legendPts.split}</b>)`)}
    <p class="muted small">같은 기물에 장착하거나 보관함에서 겹치면 합성</p></div>`;
}
/** 상점 머리: 제목 + 상태 칩 한 줄 (규칙은 접힌 도움말로) */
function shopHead(run: RunState, stock: NonNullable<NonNullable<RunState['node']>['shop']>) {
  const PART = lineIcon('r.part', 'li'), CONS = lineIcon('r.cons', 'li');
  if (run.node?.synth) {
    const t = R.occultTier(run), disc = OCCULT_SYNTH.disc[t - 1] || 0;
    return `<div class="screen-head"><h1>합성 공방</h1><div class="sh-row">
      ${t ? kvChip(SYN_BY_ID.OCCULT.name, `<b>${t}단계</b>`, '', 'syn') : ''}
      ${kvChip('상품', `<b>${OCCULT_SYNTH.base + t}</b>`, `기본 ${OCCULT_SYNTH.base} + 신비학자 단계`)}
      ${disc ? modChip('', `가격 −${pctTxt(disc)}`, `신비학자 ${t}단계 할인`, 'good') : ''}
      <span class="muted small sh-hint">산 소모품은 보관함에서 기물 · 장비에 끌어 사용</span>
    </div></div>`;
  }
  const S = CFG.shop;
  return `<div class="screen-head"><h1>암시장 상점</h1><div class="sh-row">
    ${run.phase >= S.gearFrom ? modChip(PART, '고급 · 희귀 1개 이상 확정', `${S.gearFrom}페이즈부터 고급 · 희귀 장비가 1개 이상 늘 진열됩니다`, 'good') : ''}
    <span class="ah-in cons" title="소모품 1개 입고 확률">${CONS}<small>소모품</small><b>${pctTxt(S.cons)}</b></span>
    <span class="ah-in emb" title="문장 1개 입고 확률 (출전 기물의 시너지 위주)">${PART}<small>문장</small><b>${pctTxt(S.emblem)}</b></span>
  </div><div class="subs sh-help">${sub('help:combine', PART, 'g-C', '조합법', '', combineHelp())}</div></div>`;
}
function shopScreen(run: RunState) {
  if (SHOP.merchantOf(run)) return `<main class="wrap shop-host">${SHOP.shopOverlay(run)}</main>`; // 상인 상점: 상단 바 아래 전체를 덮는 상점 (ui/shop.ts). 합성 공방은 아래 진열대
  const stock = run.node?.shop || [];
  return `<main class="wrap">
    ${shopHead(run, stock)}
    <div class="shop">${stock.map((s, i) => {
      const it = itemInfo(s.item);
      return `<div class="shop-item t${isLegendConsumable(s.item) ? 'L' : it.tier} ${s.sold ? 'sold' : ''}">${itemIcon(s.item)}<div><b>${esc(it.name)}</b><div class="small muted">${statIc(esc(it.desc))}</div></div>
        <button class="btn small" data-a="buy" data-v="${i}" ${s.sold || run.credits < s.price ? 'disabled' : ''}>${s.sold ? '판매됨' : s.price ? `${CR}${s.price}` : '무료'}</button></div>`;
    }).join('')}</div>
    ${inventoryPanel(run)}
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">떠나기</button></div>
  </main>`;
}
function newsScreen(run: RunState) {
  const offers = run.node?.news || [];
  return `<main class="wrap">
    <div class="screen-head"><h1>은하 속보</h1><p class="muted">보스전을 앞두고 언론이 몰려왔습니다. 쌓아 둔 명성 <b class="accent">${run.fame}</b>을 보상으로 바꾸세요.</p></div>
    <div class="shop">${offers.map((o, i) => {
      const d = R.NEWS_OFFERS[o.id];
      return `<div class="shop-item ${o.sold ? 'sold' : ''}"><span class="item tA">✪</span><div><b>${esc(d.name)}</b><div class="small muted">${ic(esc(d.desc))}</div></div>
        <button class="btn small" data-a="buy-news" data-v="${i}" ${o.sold || run.fame < o.cost ? 'disabled' : ''}>${o.sold ? '교환함' : `명성 ${o.cost}`}</button></div>`;
    }).join('')}</div>
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">보스전으로</button></div>
  </main>`;
}

function investScreen(run: RunState) {
  const offers = run.node?.invest || [];
  return `<main class="wrap">
    <div class="screen-head"><h1>호이슌 투자 창구</h1><div class="sh-row">
      ${kvChip('보유', `${CR}<b>${run.credits}</b>`, '에너지 크레딧', 'cr')}
      ${kvChip('다음 전투 이자', `<b>+${R.interestInfo(run).interest}</b>`, interestLines(run).tip, 'cr')}
      ${kvChip('만기 정산', run.fund ? `${CR}<b>${run.fund}</b>` : '<b>—</b>', run.fund ? '다음 페이즈 시작에 돌려받는 크레딧 (호이슌 펀드)' : '맡긴 펀드 없음', run.fund ? 'cr' : 'zero')}
    </div><p class="muted small">호이슌 홀딩스가 특별 상품을 내밀었습니다.</p></div>
    <div class="shop">${offers.map((o, i) => {
      const d = R.INVEST_OFFERS[o.id];
      return `<div class="shop-item ${o.sold ? 'sold' : ''}"><span class="item tA">${synIcon('HOI')}</span><div><b>${esc(d.name)}</b><div class="small muted">${ic(esc(d.desc(run, o)))}</div></div>
        <button class="btn small" data-a="buy-invest" data-v="${i}" ${o.sold || run.credits < o.cost ? 'disabled' : ''}>${o.sold ? '계약함' : `${CR}${o.cost}`}</button></div>`;
    }).join('')}</div>
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">떠나기</button></div>
  </main>`;
}

/** 런 결과 화면: 전투 종료 보고서 (ui/report.ts). 위험 등급 표기는 여기 한 곳에서만 만든다 */
function overScreen(run: RunState) {
  const risk = effDiffLabel(run.diff, runHeat(run)); // 실효 위험 등급 (절망 서약 반영)
  const summary = `${run.cleared ? `${esc(fieldOf(run.field).name)} 의뢰 완료${run.endless ? ` · 무한 모드 페이즈 ${run.phase}에서 귀환 불가` : ''}.` : `ERRANTEs 는 페이즈 ${run.phase}에서 무너졌습니다.`}${run.diff ? ` ${esc(risk)}.` : ''}${despairsOf(run).length ? ` 절망 증강 ${despairNames(run)}.` : ''}${OATH.oathResult(run, false)}`;
  return REPORT.reportScreen(run, {
    risk, summary, rank: rankLabel, roster: run.units.map(rosterRow).join(''),
    actions: '<button class="btn primary" data-a="newrun">새 계약</button><button class="btn" data-a="ret-bar">에란테스 바</button><button class="btn" data-a="codex">도감</button><button class="btn" data-a="to-title">타이틀</button>',
  });
}

/** 전장 정보: 이름 · 지역 · 조건 · 출현 적 · 보스 */
function fieldCard(run: RunState, compact = false) {
  const f = fieldOf(run.field);
  const nm = (id: string) => esc(ENEMY_BY_ID[id]?.name || id);
  const bossNow = phaseBoss(run)?.id;
  return `<div class="field-card ${compact ? 'compact' : ''}" style="--c:${f.color}">
    <div class="fc-head"><span class="fc-ic">${f.icon}</span><div><b>${esc(f.name)}</b><div class="muted small">${esc(f.region)}</div></div></div>
    ${compact ? '' : `<p class="small">${esc(f.desc)}</p>`}
    <ul class="fc-rules">${f.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="small muted">출현: ${f.pool.map(nm).join(' · ')} · 정예 ${nm(f.elite)}</div>
    <div class="small"><span class="accent">보스</span> ${f.bosses.map((id) => (id === bossNow ? `<b>${nm(id)}</b>` : nm(id))).join(' → ')} <span class="muted">(페이즈마다 순환)</span></div>
    ${compact ? '' : matchupHtml(f.id)}
  </div>`;
}

// ───────────────────────── 사건 연출 (임시 표시: 미연시 UI 전까지 대본 형태로 이어 보여 준다)
function speakerOf(id: string): { name: string; color: string } {
  if (id === 'pc') return { name: PC_NAME, color: 'var(--accent)' };
  const d = UNIT_BY_ID[id];
  if (d) return { name: d.name, color: SYN_BY_ID[d.factions[0] || d.traits[0]]?.color || 'var(--accent)' };
  const n = NPCS[id];
  return { name: n?.name || id, color: n?.color || 'var(--dim)' };
}
function sceneHtml(beats: Beat[]): string {
  let bg = '';
  return `<div class="scene">${beats.map((b) => {
    let pre = '';
    if (b.bg && b.bg !== bg) { bg = b.bg; pre = `<div class="sc-bg">${esc((BGS[b.bg] || b.bg).split(' — ')[0])}</div>`; }
    if (!b.who) return `${pre}<p class="sc-narr">${esc(b.text)}</p>`;
    const sp = speakerOf(b.who);
    const name = b.name || sp.name;
    if (b.think) return `${pre}<p class="sc-think"><span class="sc-who" style="--c:${sp.color}">${esc(name)}</span>${esc(b.text)}</p>`;
    return `${pre}<div class="sc-say"><span class="sc-who" style="--c:${sp.color}">${esc(name)}</span><p>${esc(b.text)}</p></div>`;
  }).join('')}</div>`;
}

/** 미연시 화자: 기물 · NPC · 주인공(레이첼 스탠딩) */
function advSpeaker(id: string) {
  const sp = speakerOf(id);
  const stand = id === 'pc' ? 'rachel' : id; // 기물 · NPC 모두 스탠딩이 있으면 세운다
  return { ...sp, stand: standURL(stand) ? stand : null };
}
/** 사건 · 결과 장면은 전체 화면 미연시로 */
function advSync(run: RunState | null) {
  const p = run?.pending[0];
  const live = run && p && app.screen !== 'battle' && app.screen !== 'over';
  if (live && p.t === 'event') {
    const ev = EVENT_BY_ID[p.id];
    playAdv(`ev:${p.id}:${run.pending.length}`, R.eventScene(p, run.flags), {
      title: ev.title, speaker: advSpeaker, fmt: (x) => ic(esc(x)),
      choices: ev.choices.map((c) => ({ label: c.label, desc: c.desc, why: c.block?.(run) || undefined })),
      onDone: (k) => act('event-choice', String(k)),
    });
  } else if (live && p.t === 'notice' && p.scene?.length) {
    playAdv(`nt:${p.title}:${run.pending.length}`, p.scene, { title: p.title, result: p.body, speaker: advSpeaker, fmt: (x) => ic(esc(x)), onDone: () => act('notice-ok', '') });
  } else if (advKey() && !advKey()!.startsWith('tu:') && !(app.screen === 'bar' && advKey()!.startsWith('bar:'))) closeAdv(); // 튜토리얼 장면은 튜토리얼이, 바 장면은 바가 닫는다
}
// ───────────────────────── 공명 주입기 연출 (편성 화면): 기물 토큰 위 작은 알림. 공명도 막대가 차오르고,
//   등급이 오르면 막대가 끝에 닿는 순간 하얀 막이 왼쪽에서 밀려 들어오고 → 화살표 · 새 공명 등급이 반짝인 뒤 사라진다.
//   알림은 root 밖(body)에 두어 다시 그려도 끊기지 않는다. 등급 상승 창(pending)은 injHold 동안 미룬다
let injHold = false;
let injTimers: number[] = [];
function injectFx(uid: string, r0: number, x0: number, x1: number, r1: number) {
  injTimers.forEach(clearTimeout); injTimers = [];
  document.querySelector('.inj-fx')?.remove();
  const done = () => { document.querySelector('.inj-fx')?.remove(); if (injHold) { injHold = false; render(); } };
  const vis = (el: Element) => (el as HTMLElement).offsetParent !== null;
  const tok = Array.from(root.querySelectorAll<HTMLElement>(`.board [data-drop="unit:${uid}"], .bench [data-drop="unit:${uid}"]`)).find(vis);
  if (!tok) return done();
  const pct = (r: number, x: number) => (r >= CFG.maxRank ? 100 : Math.min(100, (x / CFG.xpToNext(r)) * 100));
  let gain = x1 - x0; // 오른 공명도 (등급이 오르면 지나간 등급의 필요량을 더한다)
  for (let r = r0; r < r1; r++) gain += CFG.xpToNext(r);
  const up = r1 > r0, amt = `+${gain}`;
  const el = document.createElement('div');
  el.className = 'inj-fx' + (up ? ' up' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="inj-wash" aria-hidden="true"></span><div class="inj-row"><span class="inj-rk">${rankLabel(r0)}</span><span class="inj-ar" aria-hidden="true">›</span><span class="inj-rk2">${rankLabel(r1)}</span><b class="inj-amt">공명도 ${amt}</b></div><div class="inj-bar"><i style="width:${pct(r0, x0)}%"></i></div>`;
  document.body.appendChild(el);
  const t = tok.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, t.left + t.width / 2 - w / 2))}px`;
  el.style.top = `${t.top - h - 8 >= 8 ? t.top - h - 8 : t.bottom + 8}px`;
  tok.classList.add('inj-glow');
  const at = (ms: number, f: () => void) => injTimers.push(window.setTimeout(f, ms));
  const bar = el.querySelector<HTMLElement>('.inj-bar i')!;
  at(30, () => { el.classList.add('in'); bar.style.width = `${up ? 100 : pct(r1, x1)}%`; });
  if (up) {
    at(30 + 620, () => el.classList.add('wash')); // 막대가 끝에 닿는 순간 하얀 막
    at(30 + 620 + 240, () => { el.classList.add('ranked'); SND.sfx('rankUp'); }); // 화살표 → 새 등급 반짝
    at(2300, () => el.classList.add('out'));
    at(2600, done);
  } else {
    at(1500, () => el.classList.add('out'));
    at(1800, done);
  }
}

// ───────────────────────── 모달: 대기 중인 선택
function pendingModal(run: RunState): string {
  const p = run.pending[0];
  if (!p || app.screen === 'battle' || app.screen === 'over' || injHold) return '';
  let body = '', mcls = '';
  if (p.t === 'global') {
    mcls = 'global';
    body = `<h1>${p.rerolls !== undefined ? '항로 회의 — ' : ''}전역 증강</h1><p class="muted small">런 끝까지 함대 전체에 적용됩니다. 한 장을 고르세요.</p>
      <div class="gc-row">${p.options.map((id, i) => { const g = GLOBAL_BY_ID[id]; const h = g.tier === 'L' ? 42 : g.tier === 'R' ? 212 : [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7); return `<button class="gcard${g.tier ? ` gt-${g.tier}` : ''}" style="--i:${i};--h:${h}" data-a="pick-global" data-v="${id}">
        <i class="cback" aria-hidden="true"></i><span class="gc-sigil" aria-hidden="true">${g.tier === 'L' ? '✹' : g.tier === 'R' ? '✧' : '✦'}</span>
        <span class="gc-kind">${g.tier ? `${GLOBAL_TIER_NAME[g.tier]} · ` : ''}${g.unique ? '고유 · ' : ''}전역</span><b>${esc(g.name)}</b><span class="gc-desc">${ic(esc(g.desc))}</span></button>`; }).join('')}</div>
      ${p.rerolls !== undefined ? `<div class="row-btns"><button class="btn" data-a="reroll-global" ${p.rerolls > 0 ? '' : 'disabled'}>새로고침 (${p.rerolls}회)</button></div>` : ''}`;
  } else if (p.t === 'event' || (p.t === 'notice' && p.scene?.length)) {
    return ''; // 미연시 화면 (advSync)
  } else if (p.t === 'victory') {
    body = `<h1>의뢰 성공</h1><p>페이즈 ${run.phase} 보스를 격파했습니다. ${esc(fieldOf(run.field).name)} 의뢰가 완료되었습니다${run.diff ? ` (${effDiffLabel(run.diff, runHeat(run))}${despairsOf(run).length ? ` · 절망 증강 ${despairNames(run)}` : ''}${OATH.oathResult(run, true)})` : ''}.</p>
      <p class="muted small">귀환하면 런이 끝나고 기록이 남습니다. 계속하면 무한 모드로 이어지며, 적은 계속 강해집니다. 어느 쪽이든 다음 위험 등급이 해금됩니다.</p>
      <div class="row-btns"><button class="btn primary" data-a="victory-end">귀환 (의뢰 완료)</button><button class="btn" data-a="victory-endless">무한 모드로 계속</button></div>`;
  } else if (p.t === 'field') {
    body = `<h1>전장 브리핑</h1><p class="muted">이번 런의 무대입니다. 전장에 따라 적 구성과 조건이 달라집니다.</p>
      ${fieldCard(run)}
      <div class="row-btns"><button class="btn primary" data-a="field-ok">출격 준비</button></div>`;
  } else if (p.t === 'privilege') {
    mcls = 'privilege';
    body = `<div class="pv-body"><span class="pv-kicker">출격 특권</span><h1>특권 증강</h1><p class="muted small">이번 런에만 적용되는 특권을 한 장 고르세요.</p>
      <div class="pv-row">${p.options.map((o, i) => `<button class="pv-card" style="--i:${i}" data-a="pick-privilege" data-v="${i}"><span class="pv-sigil" aria-hidden="true">♜</span><b>${esc(R.privilegeName(o))}</b><span class="pv-desc">${ic(esc(R.privilegeDesc(o)))}</span></button>`).join('')}</div>
      <div class="row-btns"><button class="btn" data-a="reroll-privilege" ${p.rerolls > 0 ? '' : 'disabled'}>새로고침 (${p.rerolls}회)</button></div></div>`;
  } else if (p.t === 'despair') {
    // 절망 증강: 어둡게 가라앉는 카드 (특권 · 등급 공개 연출과 따로, 소리는 낮은 음 하나 — sound.ts despair)
    mcls = 'despair';
    const rec = loadMeta().despair || {};
    const held = despairsOf(run); // 페이즈 시작 때 더 고르는 것: 이미 짊어진 절망을 함께 보여 준다
    body = `<div class="dp-body"><span class="dp-kicker">${p.phase ? `${p.phase}페이즈 · 깊어지는 절망` : `${esc(diffName(run.diff) || '고난')}의 대가`}</span><h1>절망 증강</h1><p class="small dp-sub">${p.phase ? `절망이 하나 더 쌓입니다. 의뢰가 끝날 때까지 이미 짊어진 절망과 함께 걸립니다. 고르지 않고는 나아갈 수 없습니다.` : '이번 의뢰 내내 짊어질 절망을 하나 고르세요. 고르지 않고는 출격할 수 없습니다.'}</p>
      ${held.length ? `<p class="dp-held"><span>짊어진 절망</span>${held.map((d) => `<b title="${esc(d.desc())}">${lineIcon(d.icon, 'li')}${esc(d.name)}</b>`).join('')}</p>` : ''}
      <div class="dp-row">${p.options.map((id, i) => { const d = DESPAIR_BY_ID[id]; const r = rec[id]; return `<button class="dp-card" style="--i:${i}" data-a="pick-despair" data-v="${i}"><span class="dp-sigil" aria-hidden="true">${lineIcon(d.icon, 'li')}</span><b>${esc(d.name)}</b><span class="dp-desc">${ic(esc(d.desc()))}</span><span class="dp-quip">${esc(d.quip)}</span><span class="dp-rec">${r?.clears ? `이 절망으로 성공 ${r.clears}회` : '아직 이 절망으로 성공한 적 없음'}</span></button>`; }).join('')}</div>
      <div class="row-btns"><button class="btn" data-a="reroll-despair" ${p.rerolls > 0 ? '' : 'disabled'}>새로고침 (${p.rerolls}회)</button></div></div>`;
  } else if (p.t === 'rankup') {
    const u = run.units.find((x) => x.uid === p.uid)!;
    const d = UNIT_BY_ID[u.defId];
    const art = standImg(d.id, 'stand full') + standImg(d.id, 'stand bust', true); // 넓은 화면은 전신, 좁은 화면은 얼굴 기준 상반신
    // 이름 · 등급은 일러스트 위에 (넓은 화면 좌하단, 좁은 화면 우상단)
    const side = `<div class="ru-art" data-stand="${d.id}">${art || sprite(d, 'spr big')}
      <div class="ru-tag"><b>${esc(d.name)}</b><span>${p.join ? `공명 등급 ${p.rank}로 합류` : `공명 등급 <b>${p.rank}</b> 달성`}</span></div></div>`;
    mcls = 'rankup';
    if (!p.allocDone) {
      const left = CFG.rankPicks - app.picks.length;
      const effects = unitEffects(run, u, synergyCounts(deployed(run), run), !!u.pos);
      const tm = totalMajors(u, effects);
      const rec = recommendedMajors(d);
      const conv = (m: Major) => Object.entries(CFG.conv[m]).map(([k, v]) => `${STAT_SHORT[k] || k} +${(v as number) < 1 ? +((v as number) * 100).toFixed(1) + '%' : v}`).join(', ');
      body = `${side}<div class="ru-main">
        <div class="ru-head"><h1>${p.rank}등급 달성 보상 · 능력치</h1></div>
        ${`<p class="muted small">마이너 기물이 공명 등급 3의 배수마다 받는 보상입니다. 서로 다른 주요 능력치 ${CFG.rankPicks}개를 골라 각각 <b class="accent">+${p.points}</b>${p.options?.length === 0 ? '' : ` · 이어서 ${p.rank}등급 증강`}<br>확정할 때 ${Math.round(CFG.greatChance * 100)}% 확률로 <b>대성공</b>: 고른 능력치 상승량 2배 · (등급이 오를 때마다 모든 스탯 +${CFG.rankAll}은 이미 반영됨)</p>`}
        <div class="alloc-grid">${MAJORS.map((m) => {
          const on = app.picks.includes(m);
          return `<button class="stat-pick ${on ? 'on' : ''} ${rec.includes(m) ? 'rec' : ''}" data-a="alloc-pick" data-v="${m}" aria-pressed="${on}" aria-label="${MAJOR_NAME[m]} ${on ? tm[m] + p.points : tm[m]}" ${on || left ? '' : 'disabled'}>
            ${majorIcon(m, 'mi big')}${rec.includes(m) ? '<span class="rec-tag">추천</span>' : ''}
            <span class="sp-val"><b>${on ? tm[m] + p.points : tm[m]}</b></span>
            <span class="tip" role="tooltip"><b>${MAJOR_NAME[m]}</b> 1pt당<br>${conv(m)}${rec.includes(m) ? '<br><span class="accent">이 기물의 공격 방식 · 기본 성향에 맞는 스탯</span>' : ''}</span></button>`;
        }).join('')}
        </div>
        <div class="ru-foot"><button class="btn primary alloc-ok" data-a="alloc-ok" ${left ? 'disabled' : ''}>${left ? `${left}개 더 고르세요` : '확정'}</button></div></div>`;
    } else {
      R.ensureRankupOptions(run, p);
      const opts = p.options || [];
      const pv = previewAlly(run, u);
      body = `${side}<div class="ru-main">
        <div class="ru-head"><h1>${p.kind === 'school' ? '합류 · 사이오닉 전공' : p.kind === 'special' ? (p.join ? '합류 보상 · 전용 증강' : `${p.rank}등급 달성 · 전용 증강`) : p.kind === 'psionic' ? `${p.rank}등급 달성 · 전공 증강` : p.kind === 'oath' ? `${p.rank}등급 달성 · 서약 증강` : `${p.rank}등급 달성 · 증강`}</h1>
          <span class="muted small">${p.kind === 'school' ? `${UNIT_GROUP[d.id] ? GROUPS[UNIT_GROUP[d.id]].name + '의 ' : ''}전공을 하나 고르세요. 비술과 지속 능력이 바로 붙고, 4 · 8 · 12 · 16등급에 전공 증강을 고릅니다.${d.id === 'rachel' ? ' 레이첼은 모든 학파의 전공을 고를 수 있습니다.' : ''}` : p.kind === 'special' ? `메이저 기물은 4등급마다 전용 증강을 고릅니다 (최대 ${CFG.majorAugMax}개). 이번 ★ 전설 출현 확률 ${Math.round(R.majorLegendChance(u) * 100)}% (전설을 얻기 전까지 선택마다 +${Math.round(CFG.majorLegend.pity * 100)}%p)` : p.kind === 'oath' ? '디바인 기물은 5등급마다 서약 증강을 고릅니다 (디바인 공용 풀).' : p.kind === 'psionic' ? `사이오닉 기물은 4 · 8 · 12 · 16등급에 전공 증강을 고릅니다 (최대 4개). 이번 ★ 전설 출현 확률 ${Math.round(R.psiLegendChance(u) * 100)}% (전설을 얻기 전까지 선택마다 +${Math.round(CFG.psiLegend.pity * 100)}%p)` : ''}</span>
          ${p.rerolls > 0 ? `<button class="btn small ru-reroll" data-a="reroll" title="단축키 R">새로고침 ${p.rerolls}</button>` : '<span class="muted small ru-reroll">새로고침 없음</span>'}</div>
        ${p.kind === 'school' ? `<p class="mu-short small">이 전장의 주요 적: ${esc(matchupShort(run.field))}</p>` : ''}
        <div class="aug-list${p.kind === 'school' ? ' sch-list' : ''}">${opts.map((a, i) => {
          const ad = AUG_BY_ID[a.id];
          if (p.kind === 'school') return schoolOpt(a.id, i);
          return `<button class="aug-opt ${app.augPick === i ? 'on' : ''}" data-a="pick-augsel" data-v="${i}" aria-pressed="${app.augPick === i}">${augIcon(a.id)}<span class="ao-txt"><b>${augMark(a.id)}${esc(ad.name)}</b><span>${augText(a.id, a.param, pv.b, pv.c)}</span>${augNotes(a.id, u)}</span><kbd>${i + 1}</kbd></button>`;
        }).join('') || '<p class="muted">고를 수 있는 증강이 없습니다.</p>'}</div>
        ${p.kind === 'school' && app.abilPop && /^(cantrip|psipass):/.test(app.abilPop) ? `<div class="ru-pop">${abilPopHtml(app.abilPop, d, pv.b, pv.c)}</div>` : ''}
        <div class="ru-foot">${opts.length
          ? `<button class="btn primary aug-ok" data-a="pick-aug" data-v="${app.augPick ?? ''}" ${app.augPick === null ? 'disabled' : ''}>${app.augPick === null ? '증강을 고르세요' : '확정'}</button>`
          : '<button class="btn primary" data-a="skip-aug">넘어가기</button>'}</div>
      </div>`;
    }
  } else if (p.t === 'turretPick') {
    // 엔지니어 포탑 장비: 3개 중 1개 → 모든 포탑 공통. 머리 = 제목 + 고른 수 칩, 카드 = 아이콘 · 이름 · 효과 (+ 모든 주요 능력치 칩)
    const had = run.turretMods?.length || 0;
    body = `<div class="tp-head"><h1>감시 포탑 장비 — 엔지니어 ${SYN_BY_ID.ENG.tiers[p.tier - 1] ?? ''}명</h1>${kvChip('장비', `<b>${had}</b>/${ENG_TUR.picks}`, '고른 포탑 장비 (모든 포탑 공통)')}</div>
      <div class="cards">${p.options.map((id, i) => { const g = TURRET_GEAR[id]; return `<button class="card tp-card" data-a="pick-turret" data-v="${i}" title="단축키 ${i + 1}">${itemIcon(id)}<b>${esc(g?.name || id)}</b><span>${statIc(esc(g?.desc || ''))}</span>${kvChip('모든 포탑 모든 주요 능력치', `<b>+${ENG_TUR.modMaj}</b>`)}</button>`; }).join('')}</div>`;
  } else if (p.t === 'itemPick') {
    body = `<h1>${esc(p.title)}</h1><div class="cards">${p.options.map((id, i) => { const it = itemInfo(id); return `<button class="card" data-a="pick-item" data-v="${i}">${itemIcon(id)}<b>${esc(it.name)}</b><span>${statIc(esc(it.desc))}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'recruit') {
    // 잠시 나감: 창을 접고 아래 화면(지도 · 파티 · 기물 상세)을 보다가 같은 자리 단추로 돌아온다 (고른 후보 · 새로고침 횟수 유지)
    if (app.recruitAway === p.options.join(',')) return `<button class="btn primary rc-back" data-a="rc-back">${p.syns ? '지정 소집' : '기물 영입'}으로 돌아가기</button>`;
    const rank = R.recruitRank(run);
    const rr = p.rerolls ?? 1;
    mcls = 'recruit';
    const pick = app.recruitPick && p.options.includes(app.recruitPick) ? app.recruitPick : null;
    body = `<div class="rc-head"><div><h1>${p.syns ? '지정 소집' : '기물 영입'}</h1><p class="muted small">${p.syns ? `${p.syns.map((s) => esc(SYN_BY_ID[s as SynergyId]?.name || s)).join(' · ')} 중에서 ` : ''}새 동료 한 명을 고르세요. 공명 등급 ${rank}로 합류합니다. 보유 ${run.units.length}/${CFG.maxParty} (출전 최대 ${R.deployCap(run)}명)</p><p class="mu-short small" title="사이오닉 전공은 합류할 때 정해집니다">이 전장의 주요 적: ${esc(matchupShort(run.field))}</p></div><span class="rc-tools"><button class="btn" data-a="rc-away" title="창을 접고 지도 · 파티를 확인합니다 (고른 후보는 그대로)">잠시 나가기</button>${detailToggle()}</span></div>
      <div class="rc-track">${p.options.map((id, i) => pickCard(UNIT_BY_ID[id], { i, on: pick === id, tapAct: 'rc-tap', chipFn: ownedChip(id), nameExtra: `<span class="rc-rank" title="공명 등급 ${rank}">${rankLabel(rank)}</span>` })).join('')}</div>
      <div class="rc-foot">${pick ? (() => {
        // 영입하면 바뀌는 시너지: 보유 기물 + 이 기물 기준 인원, 단계가 오르면 강조
        const d = UNIT_BY_ID[pick];
        const owned = run.units.map((x) => x.defId);
        const before = teamCount(owned), after = teamCount([...owned, pick]);
        return `<div class="rc-syn"><span class="small"><b>${esc(d.name)}</b> 영입 시</span><div class="nr-syn syn-list">${[...d.factions, ...d.traits].map((id) => synToken(id, after(id), tierOf(id as SynergyId, after(id)) > tierOf(id as SynergyId, before(id)) ? ' up' : '')).join('')}</div></div>`;
      })() : ''}<span class="muted small">${pick ? `${esc(UNIT_BY_ID[pick].name)} 선택됨` : CAN_HOVER ? '카드에 마우스를 올리면 설명, 누르면 선택' : '탭하면 선택 · 하단을 끌어올리면 설명'}</span>
        ${p.syns ? '' : `<button class="btn" data-a="reroll-recruit" ${rr > 0 ? '' : 'disabled'}>새로고침 (${rr}회)</button>`}
        <button class="btn primary" data-a="pick-recruit" data-v="${pick || ''}" ${pick ? '' : 'disabled'}>영입</button></div>`;
  } else if (p.t === 'branch') {
    const BR: Partial<Record<NodeType, string>> = {
      shop: `재료 ${CFG.drop.shopParts}개 확정 · ${run.phase >= CFG.shop.gearFrom ? '희귀 / 고급 1개 이상 확정' : `희귀 ${pct1(CFG.drop.shopAdv2 + (1 - CFG.drop.shopAdv2) * CFG.drop.shopAdv)} · 고급 ${pct1(CFG.drop.shopGraded)}`} · 소모품 ${pct1(CFG.shop.cons)} · 문장 ${pct1(CFG.shop.emblem)}${run.phase >= CFG.drop.shopLegendPhase ? ` · 전설 ${pct1(CFG.drop.shopLegend)}` : ''}`, supply: supplyHint(run),
      news: `은하 속보: 명성 ${run.fame}을 보상으로 교환`, recruit: '기물 영입 기회 (후보 중 1명)',
      invest: '호이슌 투자 상품 (페이즈당 1회)', pilgrim: `권능 +1 후 순례 (페이즈당 1회) · 보유 권능 ${run.power}`,
    };
    body = `<h1>분기점</h1><p class="muted small">어디로 향할지 고르세요.</p><div class="cards">${p.options.map((o, i) => `<button class="card br-card n-${o}" data-a="pick-branch" data-v="${o}" title="단축키 ${i + 1}"><span class="br-ic">${NODE_ICON[o]}</span><b>${esc(NODE_NAME[o])}</b><span class="small muted">${ic(esc(BR[o] || ''))}</span></button>`).join('')}</div>`;
  } else if (p.t === 'muster') {
    body = musterModal(run);
  } else if (p.t === 'fork') {
    const xp = Math.round(CFG.xpPool(run.phase) * CFG.forkRestXp);
    body = `<h1>전환</h1><p class="muted small">페이즈의 갈림길입니다. 숨을 고를지, 한 걸음 앞서 나갈지 고르세요.</p><div class="cards">
      <button class="card br-card n-supply" data-a="pick-fork" data-v="rest"><span class="br-ic">${NODE_ICON.supply}</span><b>휴식</b><span class="small muted">${ic(`체력 +${CFG.forkRestHp + Math.floor((run.maxHp - run.hp) * CFG.forkRestLost)} (기본 ${CFG.forkRestHp} + 잃은 체력 ${Math.round(CFG.forkRestLost * 100)}%) · 공명도 풀 ${xp} 분배`)}</span></button>
      <button class="card br-card n-adversity" data-a="pick-fork" data-v="challenge"><span class="br-ic">${NODE_ICON.challenge}</span><b>도전</b><span class="small muted">${ic(`다음 페이즈(${run.phase + 1}) 역경 수준의 전투. 승리하면 대량의 공명도와 남은 역경 · 사건 · 보급 · 보스 보상을 한꺼번에 받고 ${run.phase >= CFG.victoryPhase ? '곧바로 보스로 향합니다' : '바로 다음 페이즈로 넘어갑니다'}. 패배하면 역경 패배와 같은 체력 피해.`)}</span></button>
      ${R.occultTier(run) ? `<button class="card br-card n-shop" data-a="pick-fork" data-v="synth" style="--c:${SYN_BY_ID.OCCULT.color}"><span class="br-ic">${synIcon('OCCULT') || '✶'}</span><b>합성</b><span class="small muted">신비학자의 비밀 공방. 공명 촉매 · 변성 촉매 · 전설 주조액 · 복제 배양조 같은 전용 소모품을 크레딧으로 삽니다 (상품 ${OCCULT_SYNTH.base + R.occultTier(run)}개${OCCULT_SYNTH.disc[R.occultTier(run) - 1] ? `, 가격 -${Math.round(OCCULT_SYNTH.disc[R.occultTier(run) - 1] * 100)}%` : ''}).</span></button>` : ''}
    </div>`;
  } else if (p.t === 'supply') {
    body = supplyHtml(p);
    mcls = 'supply';
  } else if (p.t === 'pilgrim') {
    body = pilgrimHtml(run, p);
  } else if (p.t === 'blessing') {
    body = `<h1>순례 — 축복 선택</h1><p class="muted">축복은 이번 페이즈가 끝날 때까지 유지됩니다.</p>
      <div class="cards">${p.options.map((id) => { const d = BLESSING_BY_ID[id]; return `<button class="card" data-a="pick-blessing" data-v="${id}"><b>${esc(d.name)}</b><span>${ic(esc(d.desc))}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'notice') {
    body = `<h1>${esc(p.title)}</h1>${p.scene?.length ? sceneHtml(p.scene) : ''}<p class="${p.scene?.length ? 'sc-result' : ''}">${ic(esc(p.body))}</p>${p.rows?.length ? `<dl class="nt-rows">${p.rows.map(([k, v]) => `<dt>${ic(esc(k))}</dt><dd>${ic(esc(v))}</dd>`).join('')}</dl>` : ''}<button class="btn primary" data-a="notice-ok">확인</button>`;
  }
  SND.reveal(p); // 증강 · 보상 카드 공개음 (등급별 3단계, 같은 카드 묶음은 한 번)
  // 특권: 화면 전체를 덮는 막 (모달 바깥에 두어야 화면 기준으로 깔린다)
  // 별무리 커튼이 좌우에서 닫힌다. 런마다 한 번만 (새로고침으로 다시 그려도 커튼은 내려온 상태로)
  let pvCls = '';
  if (mcls === 'privilege') { pvCls = pvPlayed === run.seed ? ' pv-bg played' : ' pv-bg'; pvPlayed = run.seed; }
  // 절망 증강: 붉은 재가 천천히 가라앉는 어두운 막 (고를 때마다 한 번 내려온다 — 새로고침으로 다시 그려도 그대로)
  if (mcls === 'despair') { const k = `${run.seed}:${run.despairs?.length || 0}`; pvCls = dpPlayed === k ? ' dp-bg played' : ' dp-bg'; dpPlayed = k; } // 고를 때마다 (출격 · 페이즈 시작) 한 번씩
  const veil = mcls === 'despair' ? `<div class="dp-veil" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.7}s;--s:${6 + (i % 4)}s"></i>`).join('')}</div>` : '';
  const curtain = mcls === 'privilege' ? `<div class="pv-curtain" aria-hidden="true"><i class="pv-half l"></i><i class="pv-half r"></i><span class="pv-seam"></span>
    <span class="pv-stars">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 41) % 100}%;--d:${(i % 6) * 0.5}s;--s:${3 + (i % 5)}s"></i>`).join('')}</span></div>` : '';
  return `<div class="modal-bg${pvCls}">${curtain}${veil}<div class="modal ${mcls}">${body}</div></div>`;
}
const STAT_SHORT: Record<string, string> = {
  maxHp: '체력', healEff: '회복 효율', shoot: '사격', strike: '타격', tech: '기술', acc: '명중', crit: '치명', effHit: '효과 명중',
  armor: '방어도', effRes: '효과 저항', moveSpd: '이동', eva: '회피', atkSpd: '공격 속도', reloadSpd: '재장전',
};

function menuModal(run: RunState | null) {
  if (!app.menu) return '';
  if (app.menu === 'import') {
    return `<div class="modal-bg"><div class="modal">
      <h1>저장 코드 불러오기</h1>
      <p class="muted small">다른 기기에서 내보낸 저장 코드를 붙여 넣거나, 저장 파일(.txt)을 선택하세요.</p>
      <textarea id="import-code" rows="5" placeholder="ERR1:..."></textarea>
      <input id="import-file" type="file" accept=".txt,.json,text/plain">
      ${app.importErr ? `<p class="bad small">${esc(app.importErr)}</p>` : ''}
      <div class="row-btns"><button class="btn ghost" data-a="menu-close">닫기</button><button class="btn primary" data-a="import-go">불러오기</button></div>
    </div></div>`;
  }
  if (app.menu === 'export' && run) {
    return `<div class="modal-bg"><div class="modal">
      <h1>저장 코드</h1><p class="muted small">이 코드를 복사해 두면 어떤 브라우저에서든 그대로 이어서 할 수 있습니다.</p>
      <textarea id="export-code" rows="6" readonly>${exportCode(run)}</textarea>
      <div class="row-btns"><button class="btn ghost" data-a="menu">뒤로</button><button class="btn primary" data-a="copy-code">복사</button></div>
    </div></div>`;
  }
  const saves = listSaves();
  const meta = (slot: string) => { const s = saves.find((x) => x.slot === slot); return s ? `페이즈 ${s.phase} · ${new Date(s.time).toLocaleString()}` : '비어 있음'; };
  const tabs = `<div class="menu-tabs">${([['menu', '메뉴'], ['settings', '설정']] as const).map(([k, l]) => `<button class="btn small ${app.menu === k ? 'primary' : ''}" data-a="menu-tab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (app.menu === 'settings') {
    return `<div class="modal-bg"><div class="modal">
      ${tabs}
      <h3>테마</h3>
      ${themePicker()}
      <div class="pref"><span><b>테마 연출</b><br><span class="muted small">갤럭시 별빛 · 빈티지 가죽 결 · 이타카 물결 전환 · 호이슌 벚꽃. 줄이기: 입자를 줄이고 유성 · 폭풍 없이, 물결 대신 짧은 페이드</span></span>
        <span class="seg">${UI_FX.map(([k, l]) => `<button class="btn tiny ${uiFx() === k ? 'on' : ''}" data-a="pref-uifx" data-v="${k}" aria-pressed="${uiFx() === k}">${l}</button>`).join('')}</span></div>
      ${canFullscreen() ? `<h3>화면</h3>
      <div class="pref"><span><b>전체 화면</b><br><span class="muted small">주소창 · 휴대폰 상태 표시줄 · 내비게이션 바를 숨깁니다. 켜 두면 다음에 열 때 첫 터치에서 다시 전체 화면이 됩니다 (브라우저 규칙상 자동으로는 켜지지 않음). 뒤로 가기 · Esc 로 나옵니다.</span></span>
        <button class="btn tiny ${isFullscreen() ? 'on' : ''}" data-a="fullscreen" aria-pressed="${isFullscreen()}">${FS_SVG(isFullscreen())} ${isFullscreen() ? '끄기' : '켜기'}</button></div>` : ''}
      <h3>전투</h3>
      <label class="pref"><input type="checkbox" data-a="pref-slow" ${app.slowDetail ? 'checked' : ''}><span><b>상세 정보 볼 때 느리게</b><br><span class="muted small">전투 중 기물을 눌러 상세 정보를 보는 동안 진행 속도에 ×0.25 를 곱합니다. 빈 보드를 누르거나 Esc 로 선택을 풀면 원래 속도로 돌아갑니다.</span></span></label>
      <label class="pref"><input type="checkbox" data-a="pref-zoom" ${app.zoomOut ? 'checked' : ''}><span><b>넓은 전장 전체 보기</b><br><span class="muted small">전투 화면을 축소해 바깥 테두리 칸까지 전장 전체를 한 번에 보여 줍니다. 끄면 배치 구역 크기로 보고, 카메라가 끝 기물을 따라갑니다.</span></span></label>
      ${uxSettings()}
      <h3>전투 연출</h3>
      <label class="pref pref-num"><span><b>이펙트 · 숫자 지속 시간</b><br><span class="muted small">피해 · 회복 숫자, 상태 표시, 적중 · 범위 · 테두리 이펙트가 화면에 머무는 시간 (1배속 기준, 기본 ${FX_DEFAULT.fxMs}ms)</span></span><span class="pn"><input type="number" min="300" max="4000" step="100" data-pref="fxMs" value="${FX.fxMs}"> ms</span></label>
      <label class="pref pref-num"><span><b>스킬 사용 연출 시간</b><br><span class="muted small">스킬명 배너와 시전 테두리가 머무는 시간 (기본 ${FX_DEFAULT.skillMs}ms)</span></span><span class="pn"><input type="number" min="500" max="5000" step="100" data-pref="skillMs" value="${FX.skillMs}"> ms</span></label>
      <div class="pref"><span><b>모션 속도</b><br><span class="muted small">공격 · 피격 · 회피 · 이동 동작의 빠르기</span></span>
        <span class="seg">${([['fast', '날렵'], ['mid', '보통'], ['slow', '느긋']] as const).map(([k, l]) => `<button class="btn tiny ${FX.motion === k ? 'on' : ''}" data-a="pref-motion" data-v="${k}" aria-pressed="${FX.motion === k}">${l}</button>`).join('')}</span></div>
      <div class="pref pref-death"><span><b>사망 연출</b><br><span class="muted small">처형은 설정과 관계없이 항상 갈라짐 + 해골. 고르면 오른쪽에서 미리 봅니다.</span></span>
        <div class="dsel">${DEATH_STYLES.map((d) => `<button class="dopt${FX.death === d.id ? ' on' : ''}" data-a="pref-death" data-v="${d.id}" aria-pressed="${FX.death === d.id}"><b>${d.name}</b><span class="muted small">${d.desc}</span></button>`).join('')}</div>
        <div class="dpv" aria-hidden="true"><div class="dpv-card"><img alt="" src="${iconURL({ sprite: '', palette: [], id: 'rachel' })}"></div><button class="btn tiny dpv-btn" data-a="death-preview">미리보기</button></div></div>
      <div class="pref"><span><b>궁극기 컷인</b><br><span class="muted small">메이저 궁극기 발동 시 스탠딩 · 스킬명 · 대사 컷인과 감속. 짧게: 대사 없이 0.7초, 끄기: 스킬명 배너만</span></span>
        <span class="seg">${([['full', '전체'], ['short', '짧게'], ['off', '끄기']] as const).map(([k, l]) => `<button class="btn tiny ${FX.ultCut === k ? 'on' : ''}" data-a="pref-ultcut" data-v="${k}" aria-pressed="${FX.ultCut === k}">${l}</button>`).join('')}</span></div>
      ${SND.prefHtml()}
      <div class="row-btns"><button class="btn ghost" data-a="pref-fx-reset">연출 기본값</button><button class="btn primary" data-a="menu-close">닫기</button></div>
    </div></div>`;
  }
  return `<div class="modal-bg"><div class="modal">
    ${tabs}
    ${run?.tutorial ? `<h3>튜토리얼</h3><p class="muted small">튜토리얼 진행은 따로 저장되어, 타이틀의 [튜토리얼] 버튼으로 이어서 할 수 있습니다. 끝내면 교범이 모두 열립니다.</p>
      <div class="row-btns"><button class="btn primary" data-a="menu-close">튜토리얼 계속하기</button><button class="btn" data-a="tut-quit">튜토리얼 끝내기 (건너뛰기)</button></div>` : run ? `<h3>저장</h3><div class="slot-list">${['slot1', 'slot2', 'slot3'].map((s) => `<div class="slot"><span><b>${SLOT_NAME[s]}</b> <span class="muted small">${meta(s)}</span></span>
      <span><button class="btn tiny" data-a="save" data-v="${s}">저장</button><button class="btn tiny" data-a="load" data-v="${s}" ${saves.some((x) => x.slot === s) ? '' : 'disabled'}>불러오기</button></span></div>`).join('')}
      <div class="slot"><span><b>자동 저장</b> <span class="muted small">${meta('auto')}</span></span><span><button class="btn tiny" data-a="load" data-v="auto" ${saves.some((x) => x.slot === 'auto') ? '' : 'disabled'}>불러오기</button></span></div></div>` : ''}
    <div class="row-btns">
      ${run && !run.tutorial ? '<button class="btn" data-a="menu-export">저장 코드 내보내기</button>' : ''}
      <button class="btn" data-a="menu-import">저장 코드 불러오기</button>
      ${run && !run.tutorial ? '<button class="btn" data-a="bar">저장하고 바에 들르기</button>' : ''}
      <button class="btn" data-a="to-title">타이틀로</button>
      <button class="btn primary" data-a="menu-close">닫기</button>
    </div>
    <h3>단축키</h3>
    ${keyList()}
    <p class="muted small">진행 상황은 노드를 지날 때마다 자동 저장됩니다. 전투 도중 불러오면 전투 직전 편성 화면으로 돌아갑니다.</p>
  </div></div>`;
}

// ───────────────────────── 렌더
const lastView = { screen: '' as string, modal: '' };
/** 대기석을 접는 그리기 (benchKeep = 접기 전 단추 화면 높이 · 대기석 높이): 페이지를 내려 둔 채 접으면 문서가 짧아져 스크롤이 끌려 올라가거나
 *  (넓은 화면) 보드 열이 sticky 로 붙어 단추가 밀린다 → 단추가 움직였으면 접힌 만큼 보드 열 아래에 빈 여백 (benchPadB)을 두어 높이를 그대로 둔다.
 *  다시 펼치면 대기석이 그만큼 자라므로 여백을 지운다 (docs/UI.md 9 · 16) */
let benchKeep: { y: number; h: number } | null = null, benchPadB = 0;
let lastPhase = 0;
/** 화면 전환 연출: 전투 개시 · 보스전 · 페이즈 전환 */
function banner(kind: 'battle' | 'boss' | 'phase' | 'adversity', title: string, sub = '') {
  document.querySelector('.banner')?.remove();
  const el = document.createElement('div');
  el.className = `banner bn-${kind}`;
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="bn-band"><span class="bn-line"></span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}<span class="bn-line"></span></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), kind === 'boss' ? 2300 : 1800);
}
/** 상세 능력치 창 (상세 보기 패널 바깥, 위치는 layoutPanels 가 잡는다) */
function statPopHtml(run: RunState) {
  if (app.bigUnit) return ''; // 전체 상세 팝업이 열려 있으면 그 안에서 보여 준다
  const sel = app.sel;
  if (app.abilPop && sel?.k === 'unit') {
    const u = run.units.find((x) => x.uid === sel.uid);
    if (!u) return '';
    const { b, c } = previewAlly(run, u);
    const nav = tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0);
    return abilPopHtml(app.abilPop, withEmblemSummon(UNIT_BY_ID[u.defId], u.mod), b, c, [1, 1, 1.6, 2.5][nav] ?? 1);
  }
  if (!app.statPop && !app.abilPop) return '';
  if (sel?.k === 'enemy' && run.node?.enc) {
    const s = run.node.enc.enemies[sel.i];
    if (!s) return '';
    const ph = run.node.enc.phase ?? run.phase;
    const b = new Battle(9, 9, new Rng(1), { phase: ph, credits: 0, camp: !!run.campaign });
    const c = buildEnemy(b, ENEMY_BY_ID[s.defId], ph, run.node.enc.mult, s);
    if (app.abilPop) return enemyAbilPop(app.abilPop, ENEMY_BY_ID[s.defId], b, c);
    return `<div class="stat-pop"><div class="sp-head"><b>상세 능력치</b><span class="muted small">${esc(c.name)}</span><button class="btn tiny" data-a="stat-pop">닫기</button></div>${statLines(c, b)}</div>`;
  }
  if (sel?.k !== 'unit') return '';
  const u = run.units.find((x) => x.uid === sel.uid);
  if (!u) return '';
  const { b, c } = previewAlly(run, u);
  return `<div class="stat-pop"><div class="sp-head"><b>상세 능력치</b>${u.pos ? '' : '<span class="muted small">시너지 미적용</span>'}<button class="btn tiny" data-a="stat-pop">닫기</button></div>${statLines(c, b)}</div>`;
}

/** 전투 유형별 추천 희귀 장비 (재료 조합 id) */
const RECO: Record<string, string[]> = {
  MARK: ['pow_agi', 'pow_mnd', 'pow_pow', 'agi_agi', 'mnd_agi'],
  VAN: ['vit_pow', 'vit_def', 'pow_def', 'def_def', 'vit_vit', 'taunt'],
  SPEC: ['mnd_mnd', 'mnd_agi', 'mnd_def', 'vit_mnd', 'pow_mnd'],
  CMD: ['mnd_agi', 'mnd_mnd', 'def_def', 'vit_def', 'mnd_def'],
};
/** 기물별 추천 장비 키 (기물 정의 recItems 우선, 없으면 전투 유형 기본) */
const recoKeys = (d: UnitDef) => d.recItems?.length ? d.recItems : RECO[d.ctype] || [];
/** 추천 장비 창: 추천 목록 + 보관함 보유 · 아군 장착 현황 */
function recoModal(run: RunState) {
  const u = app.recoFor ? run.units.find((x) => x.uid === app.recoFor) : null;
  if (!u) return '';
  const d = UNIT_BY_ID[u.defId];
  const name = (uid: string) => UNIT_BY_ID[run.units.find((x) => x.uid === uid)!.defId].name;
  const rows = recoKeys(d).map((key) => {
    const ids = [`A_${key}`, `L_${key}`];
    const it = itemInfo(`A_${key}`);
    const mine = u.items.filter((x) => x && ids.includes(x)).length;
    const inv = run.inventory.filter((x) => ids.includes(x)).length;
    const allies = run.units.filter((o) => o !== u && o.items.some((x) => x && ids.includes(x))).map((o) => name(o.uid));
    const [ca, cb] = it.recipe || [];
    const need: Record<string, number> = {};
    const parts = [ca, cb].filter(Boolean).map((c) => {
      need[c!] = (need[c!] || 0) + 1;
      const have = run.inventory.filter((x) => x === c).length >= need[c!];
      return `${itemIcon(c!)}${have ? '<b class="up small">보유</b>' : '<span class="muted small">없음</span>'}`;
    }).join('');
    const st = [mine ? '<span class="rc-tag on">장착 중</span>' : '', inv ? `<span class="rc-tag rc-inv">보관함 ${inv}</span>` : '', ...allies.map((n) => `<span class="rc-tag ally">${esc(n)} 장착</span>`)].join('');
    return `<li class="rc-row">${itemIcon(`A_${key}`)}<div class="rc-main"><b>${esc(it.name)}</b><span class="small muted">${statIc(esc(it.desc))}</span>
      <div class="rc-st">${st || '<span class="muted small">보유하지 않음</span>'}</div></div><div class="rc-parts" title="조합 재료">${parts || '<span class="muted small">조합 불가</span>'}</div></li>`;
  }).join('');
  return `<div class="modal-bg" data-a="reco" data-v=""><div class="modal reco">
    <h1>추천 장비 <span class="muted small">${esc(d.name)} · ${CTYPE_NAME[d.ctype]}</span></h1>
    <p class="muted small">전투 유형에 맞는 희귀 장비입니다. 재료 2개를 겹치면 만들 수 있습니다 (조합식이 없는 장비는 상점 · 보급 · 사건에서만).</p>
    <ul class="rc-list">${rows}</ul>
    <div class="row-btns"><button class="btn primary" data-a="reco" data-v="">닫기</button></div>
  </div></div>`;
}

/** 소모품 사용 확인 */
function useModal(run: RunState) {
  const u = app.useK;
  if (!u) return '';
  const id = run.inventory[u.i];
  if (!id || !isConsumable(id)) return '';
  const c = CONSUMABLES[id];
  const tg = u.tg;
  const tgt = tg.k === 'unit' ? UNIT_BY_ID[run.units.find((x) => x.uid === tg.uid)?.defId || '']?.name || '?'
    : tg.k === 'foe' ? ENEMY_BY_ID[run.node?.enc?.enemies[tg.i]?.defId || '']?.name || '?'
    : tg.k === 'run' ? '함대'
    : (() => { const it = tg.k === 'inv' ? run.inventory[tg.i] : tg.k === 'eq' ? (tg.slot < 0 ? run.units.find((x) => x.uid === tg.uid)?.mod : run.units.find((x) => x.uid === tg.uid)?.items[tg.slot]) : null; return it ? itemInfo(it).name : '?'; })();
  const err = R.useCheck(run, u.i, tg);
  return `<div class="modal-bg" data-a="use-k" data-v="no"><div class="modal use-k">
    <h1>${itemIcon(id)} ${esc(c.name)}</h1>
    <p><b>${esc(tgt)}</b>에게 사용합니다.</p><p class="muted small">${esc(c.desc)}</p>
    ${err ? `<p class="down small">${esc(err)}</p>` : ''}
    <div class="row-btns"><button class="btn" data-a="use-k" data-v="no">취소</button><button class="btn primary" data-a="use-k" data-v="ok" ${err ? 'disabled' : ''}>사용</button></div>
  </div></div>`;
}

// ───────────────────────── 확인 팝업 (화면을 가리지 않음): 장비 조합 · 재구성 회로 · 분리 용제. ✕ = 취소 (Esc) · ✓ = 확인
const ASK_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ASK_V = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
function askPop() {
  const q = app.ask;
  if (!q) return '';
  return `<div class="ask-pop" role="dialog" aria-label="확인">${q.html}<div class="ask-btns">${q.ok
    ? `<button class="btn ask-x" data-a="ask" data-v="no" title="취소 (Esc)" aria-label="취소">${ASK_X}</button><button class="btn primary ask-v" data-a="ask" data-v="ok" title="${esc(q.okLabel || '확인')}" aria-label="${esc(q.okLabel || '확인')}">${ASK_V}</button>`
    : `<button class="btn ask-x" data-a="ask" data-v="no" title="닫기 (Esc)" aria-label="닫기">${ASK_X}</button>`}</div></div>`;
}
const askItem = (id: string) => `<span class="ask-it">${itemIcon(id)}<span>${esc(itemInfo(id).name)}</span></span>`;
const INV_BOX = ['.inv-rail', '.inv'];
const invCell = (i: number) => [`.inv-rail [data-drag="item:${i}"]`, `.inv [data-drag="item:${i}"]`, ...INV_BOX];
/** 조합 결과 알림: 유닉스제 대량 생산으로 바뀌었으면 그 사실도 */
const combinedToast = (res: string, got: string | null | undefined) => toast(!got ? '조합할 수 없습니다.'
  : potsOf(res).includes('?') ? `잠재능력: ${potsOf(got).map((k) => POTS[k]?.name || k).join(' · ')} (${itemInfo(got).name})` // 백수정 조각: 굴린 결과를 공개
  : got === res ? `조합 완료: ${itemInfo(got).name}` : `유닉스제 대량 생산 — ${itemInfo(res).name} 대신 ${itemInfo(got).name}이 들어왔습니다.`);
/** 조합 확인: [A] + [B] = [결과] · 결과 능력치 · 효과 (보관함 왼쪽). 유닉스제 대량 생산은 확률만 알리고 합성할 때 정한다 (미리 굴리지 않음). extra = 덧붙일 안내 */
function combineAsk(run: RunState, a: string, b: string, res: string, anchor: string[], ok: () => void, extra = '') {
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
function askCombineInv(run: RunState, i: number, j: number): boolean {
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
function equipAsk(run: RunState, idx: number, uid: string, slot?: number): Sel {
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
function moveEq(run: RunState, uid: string, slot: number, to: string | null, toSlot?: number) {
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
function tryUse(run: RunState, i: number, tg: R.UseTarget) {
  const err = R.useCheck(run, i, tg);
  if (err) { toast(`${err}.`); app.sel = null; app.useK = null; return; }
  if (run.inventory[i] === 'K_reroll') rerollAsk(run, i, tg);
  else if (isPlaceable(run.inventory[i])) { const r = R.useConsumable(run, i, tg); toast(r.msg); app.sel = null; if (r.ok) persist(); } // 배치형: 바로 놓는다 (놓은 장치를 누르면 회수)
  else app.useK = { i, tg };
}
/** 재구성 회로 확인 팝업: 기물이면 기물 위, 장착 장비면 그 칸 옆, 보관함 장비면 보관함 왼쪽. 결과는 V 를 누른 뒤에 공개 (미리 보고 고를 수 없음) */
function rerollAsk(run: RunState, i: number, tg: R.UseTarget) {
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
function placeAskPop() {
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
const railVertical = (rail: HTMLElement | null) => !!rail && getComputedStyle(rail).flexDirection === 'column'; // 물품이 몇 개 없어 상자가 낮아도 세로 줄
function invRailSide(a: HTMLElement, w: number) {
  const rail = a.closest<HTMLElement>('.inv-rail'), box = rail?.getBoundingClientRect();
  if (!box || innerWidth <= 700 || !railVertical(rail)) return null;
  const room = innerWidth - 8 - (box.right + 10);
  return room >= Math.min(w, 220) ? { left: box.right + 10, w: Math.min(w, room) } : null;
}
/** 태블릿 세로 (보관함이 보드 옆 세로 줄인데 오른쪽 자리가 없을 때): 보드 위 머리 자리 (상단 바 · 보드 머리줄 — 둘 다 sticky · 불투명) 에 겹쳐 띄운다.
 *  보드 칸을 가리지 않고, 보관함 바로 위라 누른 물품 옆이다. 높이 = 보드 창 위끝 (스크롤로 보드가 머리 밑에 들어가면 머리 아래끝) 까지 → 넘치면 팝업 안 스크롤.
 *  세로 화면만 (가로 폰은 머리 자리가 낮아 예전처럼 하단 시트). 자리가 너무 낮으면 null */
function railTopDock(a: HTMLElement): { h: number } | null {
  const rail = a.closest<HTMLElement>('.inv-rail');
  if (!railVertical(rail) || innerHeight <= innerWidth) return null;
  const vp = root.querySelector<HTMLElement>('.prep .board-vp')?.getBoundingClientRect();
  if (!vp) return null;
  const tb = root.querySelector<HTMLElement>('header.top')?.getBoundingClientRect().bottom ?? 0, hb = root.querySelector<HTMLElement>('.prep .board-head')?.getBoundingClientRect().bottom ?? 0;
  const h = Math.floor(Math.max(tb, hb, vp.top - 6)) - 8;
  return h >= 96 ? { h } : null;
}
/** 하단 시트가 고른 칸을 가리면 페이지를 그만큼 올린다 (시트를 위로 옮겨 보드를 덮지 않는다). 같은 물품에 한 번만 (사용자 스크롤과 다투지 않게) */
let sheetKey = '';
function sheetReveal(a: HTMLElement | null, p: HTMLElement, key: string) {
  if (key === sheetKey) return;
  sheetKey = key;
  const over = a ? a.getBoundingClientRect().bottom - (innerHeight - p.offsetHeight - 16) : 0;
  if (over > 0) scrollBy(0, over);
}
/** 보관 물품 정보 팝업: 편성 보관함은 상자 오른쪽 (보드 반대쪽), 상점 등 가로 보관함은 상자 왼쪽 · 오른쪽 · 아래. 자리가 없거나 좁은 화면은 아래 시트 */
function placeInvPop() {
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
function placeUmPop() {
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
function topHSync() {
  const top = root.querySelector<HTMLElement>('.top');
  document.documentElement.style.setProperty('--top-h', `${(top?.offsetHeight || 0) + 10}px`);
}
function layoutPanels() {
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
window.addEventListener('resize', () => { layoutPanels(); prepZoomSync(undefined, prepVpMid()); if (app.view) followCamera(app.view.b); });
/** 편성 보드 창 가운데 화면 점 (창 크기가 바뀌어도 보던 칸이 가운데에 남게) */
function prepVpMid() { const r = root.querySelector<HTMLElement>('.prep .board-vp')?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height, innerHeight - r.top) / 2 } : undefined; }
// ───────── 편성 보드 확대 · 축소: 보드는 .board-vp 창 안에서만 커지고 (가로 · 세로 스크롤), 화면(페이지) 배율은 그대로.
// 보는 사람마다 errantes.prefs.v1 boardZoom = 칸 크기 / 최소 칸 크기 (CSS --cell-min), 0 = 전체 보기 (창에 보드 전체), 없으면 최소 칸 크기 (폭은 창 안)
/** 보드 왼쪽 세로 확대 단추 줄 (위 → 아래): [+] [전체 ↔ 확대 (전체 보기 ↔ 마지막 확대)] [−]. 가운데 단추의 아이콘 · 이름 · 상태 · 보이기는 prepZoomSync 가 실제 크기를 재서 맞춘다 */
function prepZoomCtl() {
  return `<div class="bz-ctl bz-prep" role="group" aria-label="보드 확대" hidden>
    <button class="btn tiny bz-step" data-a="bzoom" data-v="in" title="확대 (Ctrl + 휠 · 두 손가락)" aria-label="확대">${lineIcon('u.zoomin', 'li')}</button>
    <button class="btn tiny bz-fit" data-a="board-fit">${lineIcon('u.zoomin', 'li')}<span>확대</span></button>
    <button class="btn tiny bz-step" data-a="bzoom" data-v="out" title="축소 (Ctrl + 휠 · 두 손가락)" aria-label="축소">${lineIcon('u.zoomout', 'li')}</button>
  </div>`;
}
/** 편성 보드 최대 칸 크기 (px): 기물 초상 · 장비 칸이 편히 읽히는 크기. 이보다 크면 한 화면에 보이는 칸만 줄어든다 */
const PREP_CELL_MAX = 96;
/** 긴 보드의 처음 칸 크기 상한 = 최소 칸 (CSS --cell-min) 의 이 배 (창에 여유가 있을 때만: 데스크톱 약 68px · 휴대폰 약 57px) */
const PREP_CELL_DEF = 1.3;
/** 편성 보드 창의 칸 크기 범위 (px): fit = 보드 전체가 창에 들어가는 크기 · min = CSS --cell-min
 *  max = min(PREP_CELL_MAX, 아군 진형 (포탑 열 포함) 전체가 창에 들어가는 크기) — 끝까지 확대해도 내 배치 구역은 한눈에 (휴대폰 세로에서 넓은 보드는 거의 확대 없음).
 *  단 max 는 min · fit 보다 작아지지 않는다 */
function prepZoomRange(vp: HTMLElement, b: HTMLElement) {
  const row = vp.parentElement!, rs = getComputedStyle(row), rail = row.querySelector<HTMLElement>(':scope > .inv-rail');
  const availW = Math.max(120, row.clientWidth - (rs.flexDirection.startsWith('row') && rail ? rail.offsetWidth + (parseFloat(rs.columnGap) || 0) : 0));
  const availH = Math.max(160, parseFloat(getComputedStyle(vp).maxHeight) || innerHeight);
  const bw = +b.dataset.bw! || 1, bh = +b.dataset.bh! || 1, min = cellMinOf(vp), fit = Math.min(availW / bw, availH / bh);
  const az = vpZones(b).find((z) => z.k === 'ally'), allyFit = az ? Math.min(availW / az.r[2], availH / az.r[3]) : Infinity;
  return { bw, bh, availW, availH, fit, min, max: Math.max(fit, min, Math.min(PREP_CELL_MAX, allyFit)) };
}
type PrepZoomRange = ReturnType<typeof prepZoomRange>;
/** 저장한 확대 → 칸 크기 (px) */
function prepCellOf(m: PrepZoomRange) {
  const p = loadPrefs(), z = p.boardZoom ?? (p.boardFit ? 0 : undefined); // 예전 '전체 보기' 설정 (boardFit) 도 읽는다
  // 기본: 보드가 최소 칸 크기로 창에 다 들어가면 전체 (fit). 아니면 (긴 통로 · 포위) 짧은 축이 창을 채우는 만큼 키우되 최소 칸의 PREP_CELL_DEF 배까지
  // (세로로 긴 보드는 폭, 가로로 긴 보드는 높이) — 긴 축은 창 안 스크롤, 처음 위치는 아군 진형 (prepViewInit)
  if (z === undefined) return m.fit >= m.min ? m.fit : clampN(m.bw > m.bh ? m.availH / m.bh : m.availW / m.bw, m.min, Math.min(m.max, PREP_CELL_DEF * m.min));
  return z <= 0 ? m.fit : clampN(z * m.min, m.fit, m.max);
}
/** 보드 크기를 칸 크기 cell (없으면 저장값) 로 맞추고 단추 상태를 고친다. at = 그 자리에 머물 화면 점 (확대 · 축소 기준) */
function prepZoomSync(cell?: number, at?: { x: number; y: number }) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board');
  if (!vp || !b) return;
  // 확대 단추 줄은 보드 왼쪽에 자리를 차지하므로, 단추 줄이 있는 폭으로 재서 확대할 여지가 있을 때만 남긴다 (없으면 숨기고 그 폭까지 보드에)
  const ctl = root.querySelector<HTMLElement>('.bz-prep');
  if (ctl) ctl.hidden = false;
  let m = prepZoomRange(vp, b);
  if (ctl && m.max - m.fit < 1) { ctl.hidden = true; m = prepZoomRange(vp, b); }
  const c = clampN(cell ?? prepCellOf(m), m.fit, m.max);
  const r0 = at ? b.getBoundingClientRect() : null;
  b.style.width = `${c * m.bw}px`;
  vp.classList.toggle('scroll', c * m.bw > m.availW + 0.5 || c * m.bh > m.availH + 0.5); // 창보다 크면 창 안 스크롤 (아니면 넘침 허용: 보드 가장자리 화살표 · 이름표가 잘리지 않게)
  vp.onscroll = () => { vpMoreSync(vp); if (prepView.key) { prepView.l = vp.scrollLeft; prepView.t = vp.scrollTop; } };
  if (at && r0) { // 가리킨 점 아래 칸이 그대로 있게 창을 민다
    const r1 = b.getBoundingClientRect(), fx = (at.x - r0.left) / r0.width, fy = (at.y - r0.top) / r0.height;
    vp.scrollLeft += r1.left + fx * r1.width - at.x;
    vp.scrollTop += r1.top + fy * r1.height - at.y;
  }
  vpMoreSync(vp);
  if (!ctl || ctl.hidden) return;
  const zoomed = c > m.fit + 0.5;
  ctl.querySelector<HTMLButtonElement>('[data-v="out"]')!.disabled = !zoomed;
  ctl.querySelector<HTMLButtonElement>('[data-v="in"]')!.disabled = c >= m.max - 0.5;
  // 가운데 단추: 확대해 둔 동안 = [축소 아이콘 · 전체] (전체 보기로) · 전체 보기 = [확대 아이콘 · 확대] (마지막 확대로). 보드가 최소 칸 크기로 창에 다 들어가고 돌아갈 확대도 없으면 꺼 둔다
  const fb = ctl.querySelector<HTMLButtonElement>('.bz-fit')!, last = (loadPrefs().boardZoomLast || 0) * m.min;
  fb.disabled = !zoomed && m.fit >= m.min - 0.5 && Math.min(last, m.max) <= m.fit + 0.5;
  if (fb.dataset.z !== String(zoomed)) { fb.dataset.z = String(zoomed); fb.innerHTML = `${lineIcon(zoomed ? 'u.zoomout' : 'u.zoomin', 'li')}<span>${zoomed ? '전체' : '확대'}</span>`; }
  fb.title = zoomed ? '전체: 보드 전체를 창에 맞춰 보기' : '확대: 마지막 확대로 (아군 진형부터)';
  fb.setAttribute('aria-label', fb.title);
  fb.setAttribute('aria-pressed', String(!zoomed));
}
/** 편성 보드 창 가장자리 흐림: 그쪽으로 더 볼 칸이 있으면 (가로로 긴 지형 · 확대) */
function vpMoreSync(vp: HTMLElement) {
  const l = vp.scrollLeft, t = vp.scrollTop, on = vp.classList.contains('scroll'); // 클래스 대신 data-more (다시 그릴 때 스크롤 위치 복원은 클래스 이름으로 요소를 찾는다)
  const more = on ? [l > 1 && 'l', l + vp.clientWidth < vp.scrollWidth - 1 && 'r', t > 1 && 't', t + vp.clientHeight < vp.scrollHeight - 1 && 'b'].filter(Boolean).join(' ') : '';
  if (vp.dataset.more !== more) vp.dataset.more = more;
  vpCueSync(vp);
}
// ───────── 편성 보드 창 길잡이: 처음에는 아군 진형을 보이고 (prepViewInit), 창 밖에 있는 적 진형은 창 가장자리 칩 [적 n →] 으로 알린다 (누르면 그쪽으로)
/** 진형 (prepScreen 의 .board data-zones): k = ally · foe0 (위 · 가로 지형은 오른쪽) · foe1 (포위의 아래 · 왼쪽), r = 보이는 틀 기준 화면 칸 [x, y, w, h], n = 기물 · 적 수 */
type VpZone = { k: string; r: [number, number, number, number]; n: number };
function vpZones(b: HTMLElement): VpZone[] { try { return JSON.parse(b.dataset.zones || '[]'); } catch { return []; } }
/** 진형 → 창 안 내용 좌표 사각형 (px, 스크롤 원점) */
function vpZoneRect(vp: HTMLElement, b: HTMLElement, z: VpZone) {
  const br = b.getBoundingClientRect(), vr = vp.getBoundingClientRect(), cw = br.width / (+b.dataset.bw! || 1), ch = br.height / (+b.dataset.bh! || 1);
  const ox = br.left - vr.left - vp.clientLeft + vp.scrollLeft, oy = br.top - vr.top - vp.clientTop + vp.scrollTop;
  return { l: ox + z.r[0] * cw, t: oy + z.r[1] * ch, w: z.r[2] * cw, h: z.r[3] * ch };
}
/** 첫 편성의 적 쪽 가장자리 깜빡임 길이 (ms) */
const VP_PULSE_MS = 2400;
/** 지금 조우의 편성 창: key = 조우 (런 · 조우 씨앗 · 지형 · 폭), t0 = 처음 연 시각, l · t = 마지막 창 스크롤 (맵에 다녀와도 그 자리로) */
let prepView = { key: '', t0: 0, l: 0, t: 0 };
const prepViewKey = (run: RunState | null) => { const e = run?.node?.enc; return run ? `${run.seed}:${e ? `${e.seed}:${e.map || ''}:${e.n}` : '-'}` : ''; };
/** 진형 하나를 창 가운데로 (창 끝에서 멈춘다) */
function prepCenterOn(k: string, smooth = false) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board'), z = b && vpZones(b).find((q) => q.k === k);
  if (!vp || !b || !z) return;
  const r = vpZoneRect(vp, b, z);
  const left = clampN(r.l + r.w / 2 - vp.clientWidth / 2, 0, vp.scrollWidth - vp.clientWidth), top = clampN(r.t + r.h / 2 - vp.clientHeight / 2, 0, vp.scrollHeight - vp.clientHeight);
  vp.scrollTo({ left, top, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
}
/** 그린 뒤 편성 창 위치: 조우가 바뀌어 처음 열면 아군 진형을 가운데로 · 같은 조우에 다른 화면에서 돌아오면 마지막 자리로 (같은 화면을 다시 그릴 때는 scrollRestore 가 둔다) */
function prepViewInit(sameView: boolean) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp');
  if (!vp) return;
  const key = prepViewKey(app.run);
  if (key !== prepView.key) { prepView = { key, t0: performance.now(), l: 0, t: 0 }; prepCenterOn('ally'); }
  else if (!sameView) { vp.scrollLeft = prepView.l; vp.scrollTop = prepView.t; }
  prepView.l = vp.scrollLeft; prepView.t = vp.scrollTop;
  vpMoreSync(vp);
}
const CUE_ARR: Record<string, string> = { l: 'M19 12H5M11 6l-6 6 6 6', r: 'M5 12h14M13 6l6 6-6 6', t: 'M12 19V5M6 11l6-6 6 6', b: 'M12 5v14M6 13l6 6 6-6' };
/** 창 가장자리 칩: 진형이 절반 넘게 창 밖이면 그쪽 가장자리에 [적 n →] · [아군 n ←] (적이 없는 진형은 빼고). 진형이 보이면 사라진다.
 *  포위 지형 (적 진형 2곳) 첫 편성의 깜빡이는 동안은 보이는 적 진형도 칩으로 (양쪽에서 적이 온다는 것을 수로). 칩 자리는 vpCuePlace */
function vpCueSync(vp: HTMLElement) {
  const host = vp.parentElement?.querySelector<HTMLElement>(':scope > .vp-cues'), b = vp.querySelector<HTMLElement>(':scope > .board');
  if (!host || !b) return;
  const st = `left:${vp.offsetLeft}px;top:${vp.offsetTop}px;width:${vp.offsetWidth}px;height:${vp.offsetHeight}px`;
  if (host.getAttribute('style') !== st) host.setAttribute('style', st);
  const ovl = vp.parentElement?.querySelector<HTMLElement>(':scope > .tool-ovl'), os = `left:${vp.offsetLeft}px;top:${vp.offsetTop + 6}px;width:${vp.offsetWidth}px;right:auto`; // 쥔 도구 칩: 보드 창 위쪽 가장자리 가운데
  if (ovl && ovl.getAttribute('style') !== os) ovl.setAttribute('style', os);
  const sides: Record<string, string[]> = { l: [], r: [], t: [], b: [] }, W = vp.clientWidth, H = vp.clientHeight, x0 = vp.scrollLeft, y0 = vp.scrollTop;
  const age = performance.now() - prepView.t0, pulse = age < VP_PULSE_MS && prepView.key === prepViewKey(app.run), delay = `animation-delay:-${Math.round(age)}ms`; // 다시 그려도 깜빡임은 이어서 (한 번만)
  const zones = vpZones(b), sur = pulse && zones.some((z) => z.k === 'foe1'); // 포위 첫 편성: 적 진형 양쪽 모두
  let key = '', edge = '';
  if (vp.classList.contains('scroll') || sur) for (const z of zones) {
    const ally = z.k === 'ally';
    if (!ally && !z.n) continue;
    const r = vpZoneRect(vp, b, z), ow = Math.max(0, Math.min(r.l + r.w, x0 + W) - Math.max(r.l, x0)), oh = Math.max(0, Math.min(r.t + r.h, y0 + H) - Math.max(r.t, y0));
    if ((ow * oh) / Math.max(1, r.w * r.h) >= 0.5 && !(sur && !ally)) continue;
    const dx = (r.l + r.w / 2 - (x0 + W / 2)) / W, dy = (r.t + r.h / 2 - (y0 + H / 2)) / H;
    const side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'l' : 'r') : dy < 0 ? 't' : 'b';
    const arr = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${CUE_ARR[side]}"/></svg>`, txt = `<b>${ally ? '아군' : '적'}</b>${z.n ? `<span>${z.n}</span>` : ''}`;
    const tip = ally ? `아군 진형으로 (출전 ${z.n})` : `적 진형으로 (적 ${z.n})`;
    const pz = !ally && pulse;
    sides[side][ally ? 'unshift' : 'push'](`<button class="vp-cue ${ally ? 'ally' : 'foe'}${pz ? ' pulse' : ''}" data-a="vp-cue" data-v="${z.k}" title="${tip}" aria-label="${tip}"${pz ? ` style="${delay}"` : ''}>${side === 'l' ? arr + txt : txt + arr}</button>`);
    if (pz) edge += `<i class="vp-edge s-${side}" style="${delay}"></i>`; // 첫 편성: 적 쪽 가장자리가 한 번 빛난다
    key += `${z.k}${side}${z.n};`;
  }
  if (pulse) key += 'p';
  if (host.dataset.ck !== key) {
    host.dataset.ck = key;
    host.innerHTML = edge + Object.entries(sides).filter(([, a]) => a.length).map(([sd, a]) => `<div class="vp-cs s-${sd}">${a.join('')}</div>`).join('');
    if (pulse) setTimeout(() => { const v = root.querySelector<HTMLElement>('.prep .board-vp'); if (v) vpCueSync(v); }, Math.max(0, VP_PULSE_MS - (performance.now() - prepView.t0)) + 30);
  }
  vpCuePlace(vp, host, b);
}
/** 칩이 피할 보드 위 대상: 기물 · 적 · 포탑 · 소환물 · 장치 (가중 100) · 지형 지물 칸 (가중 1) */
const VP_CUE_AVOID: [string, number][] = [[':scope > .u, .dev-mark, .dev-wall2', 100], ['.cell[data-a="sel-terrain"]', 1]];
/** 가장자리 칩 묶음을 그 가장자리를 따라 밀어, 덮는 기물 · 적 · 장치가 가장 적은 자리 (같으면 가운데에 가까운 자리)에 둔다.
 *  덮는 넓이는 칸 단위 (대상이 놓인 칸 전체) — 빈칸이 있으면 차 있는 칸 위에는 놓지 않는다. 스크롤 · 확대 · 다시 그리기마다 다시 잰다 */
function vpCuePlace(vp: HTMLElement, host: HTMLElement, b: HTMLElement) {
  const groups = host.querySelectorAll<HTMLElement>(':scope > .vp-cs');
  if (!groups.length) return;
  const hr = host.getBoundingClientRect(), br = b.getBoundingClientRect(), W = vp.clientWidth, H = vp.clientHeight, M = 4;
  const cw = br.width / (+b.dataset.bw! || 1), ch = br.height / (+b.dataset.bh! || 1);
  const snap = (v: number, o: number, c: number, up: boolean) => o + (up ? Math.ceil((v - o - 1) / c) : Math.floor((v - o + 1) / c)) * c;
  const obs: { l: number; t: number; r: number; b: number; w: number }[] = [];
  for (const [sel, w] of VP_CUE_AVOID) for (const e of Array.from(b.querySelectorAll<HTMLElement>(sel))) {
    const r = e.getBoundingClientRect();
    if (!r.width || r.right < hr.left || r.bottom < hr.top || r.left > hr.left + W || r.top > hr.top + H) continue;
    obs.push({ l: snap(r.left, br.left, cw, false) - hr.left, t: snap(r.top, br.top, ch, false) - hr.top, r: snap(r.right, br.left, cw, true) - hr.left, b: snap(r.bottom, br.top, ch, true) - hr.top, w });
  }
  for (const g of Array.from(groups)) {
    const sd = /s-([lrtb])/.exec(g.className)?.[1] || 't', horiz = sd === 't' || sd === 'b', gw = g.offsetWidth, gh = g.offsetHeight;
    const span = horiz ? W : H, len = horiz ? gw : gh, fix = sd === 't' ? M : sd === 'b' ? H - M - gh : sd === 'l' ? M : W - M - gw;
    const lo = M, hi = Math.max(lo, span - M - len), mid = clampN((span - len) / 2, lo, hi);
    let best = mid, bc = Infinity;
    const cost = (p: number) => {
      const l = horiz ? p : fix, t = horiz ? fix : p, r = l + gw, bt = t + gh;
      let c = Math.abs(p - mid) / Math.max(1, span); // 같으면 가운데 쪽
      for (const o of obs) { const ox = Math.min(r, o.r) - Math.max(l, o.l), oy = Math.min(bt, o.b) - Math.max(t, o.t); if (ox > 0 && oy > 0) c += o.w * (1 + (ox * oy) / (gw * gh)); }
      return c;
    };
    for (let p = lo; p <= hi + 0.5; p += 4) { const c = cost(Math.min(p, hi)); if (c < bc) { bc = c; best = Math.min(p, hi); } }
    if (cost(mid) <= bc) best = mid;
    const st = horiz ? `left:${Math.round(best)}px;top:${Math.round(fix)}px` : `left:${Math.round(fix)}px;top:${Math.round(best)}px`;
    if (g.getAttribute('style') !== st) g.setAttribute('style', st);
  }
}
/** 편성 보드 확대 바꾸기 + 저장 (끄는 동안은 저장을 모아서) */
let pzSaveT = 0;
function prepZoomTo(cell: number, at?: { x: number; y: number }) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board');
  if (!vp || !b) return;
  const m = prepZoomRange(vp, b), c = clampN(cell, m.fit, m.max);
  prepZoomSync(c, at ?? prepVpMid());
  clearTimeout(pzSaveT);
  pzSaveT = window.setTimeout(() => savePref('boardZoom', c <= m.fit + 0.5 ? 0 : +(c / m.min).toFixed(3)), 200);
}
/** 지금 편성 보드 칸 크기 (px) */
function prepCellNow() {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board');
  return vp && b ? { m: prepZoomRange(vp, b), c: b.getBoundingClientRect().width / (+b.dataset.bw! || 1) } : null;
}
/** ± 단추 · 전환 단추 */
const ZOOM_STEP = 1.25;
function prepZoomAct(kind: string) {
  const now = prepCellNow();
  if (!now) return;
  const { m, c } = now;
  if (kind === 'fit') {
    if (c > m.fit + 0.5) { savePref('boardZoomLast', +(c / m.min).toFixed(3)); prepZoomTo(m.fit); }
    else { prepZoomTo(Math.max(m.min, (loadPrefs().boardZoomLast || 1) * m.min, m.fit * ZOOM_STEP)); prepCenterOn('ally'); } // 확대하면 아군 진형부터
  } else prepZoomTo(kind === 'in' ? c * ZOOM_STEP : c / ZOOM_STEP);
}
/** 전투 창 ± 단추 */
function battleZoomAct(kind: string) { battleZoomTo(kind === 'in' ? bcam.bz * ZOOM_STEP : bcam.bz / ZOOM_STEP); }
// ───────── 확대 제스처: 편성 보드 창 · 전투 창 안에서만 (Ctrl/⌘ + 휠 · 트랙패드 핀치 · 두 손가락). 그 밖에서는 브라우저 확대를 막는다 (아래 '브라우저 확대 막기')
const zoomHost = (t: EventTarget | null) => {
  const el = t instanceof Element ? t : null;
  return el?.closest<HTMLElement>('.prep .board-vp') ? 'prep' : el?.closest<HTMLElement>('.bview:not(.full)') ? 'battle' : '';
};
function zoomBy(host: string, f: number, at: { x: number; y: number }) {
  if (host === 'prep') { const now = prepCellNow(); if (now) prepZoomTo(now.c * f, at); }
  else if (host === 'battle') battleZoomTo(bcam.bz * f, at);
}
root.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const host = zoomHost(e.target);
  if (!host) return;
  e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  zoomBy(host, clampN(Math.exp(-dy * 0.0025), 0.7, 1.4), { x: e.clientX, y: e.clientY });
}, { passive: false });
/** 두 손가락 확대 (터치): 두 손가락 사이 거리 비율만큼, 가운데 점 기준. 편성 보드는 가운데 점이 움직이면 창도 민다 */
let pinch: { host: string; d: number; mx: number; my: number } | null = null;
const touchMid = (e: TouchEvent) => { const [a, b] = [e.touches[0], e.touches[1]]; return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }; };
root.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  const host = zoomHost(e.touches[0].target) || zoomHost(e.touches[1].target);
  if (!host) return;
  const m = touchMid(e);
  pinch = { host, d: Math.max(1, m.d), mx: m.x, my: m.y };
  // 한 손가락으로 시작한 끌기 (기물 · 장비 · 바리케이드 · 전투 창 끌어 보기)는 멈춘다
  if (drag?.ghost) { drag.ghost.remove(); drag.el.classList.remove('dragging'); }
  drag = null; wallDrag = null; dragPt = null;
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
const pinchEnd = (e: TouchEvent) => { if (pinch && e.touches.length < 2) { pinch = null; suppressClick = true; setTimeout(() => (suppressClick = false), 60); } };
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

/** 스크롤된 요소 목록: [클래스 이름, 같은 클래스 중 순번, 위, 왼쪽, 창 안 여부] */
type ScrollMark = [string, number, number, number, boolean];
function scrollSnapshot(): ScrollMark[] {
  const out: ScrollMark[] = [];
  const seen = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (!(el instanceof HTMLElement) || !el.className || typeof el.className !== 'string') continue;
    const cls = el.className.replace(/\b(on|enter|sel|peek|dragging|played|landed|opened)\b/g, '').trim();
    const n = seen.get(cls) ?? 0;
    seen.set(cls, n + 1);
    if (el.scrollTop > 0 || el.scrollLeft > 0) out.push([cls, n, el.scrollTop, el.scrollLeft, !!el.closest('.modal')]);
  }
  return out;
}
function scrollRestore(marks: ScrollMark[], newModal: boolean) {
  if (!marks.length) return;
  const want = new Map(marks.filter((m) => !(newModal && m[4])).map((m) => [`${m[0]}#${m[1]}`, m]));
  if (!want.size) return;
  const seen = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (!(el instanceof HTMLElement) || !el.className || typeof el.className !== 'string') continue;
    const cls = el.className.replace(/\b(on|enter|sel|peek|dragging|played|landed|opened)\b/g, '').trim();
    const n = seen.get(cls) ?? 0;
    seen.set(cls, n + 1);
    const m = want.get(`${cls}#${n}`);
    if (m) { el.scrollTop = m[2]; el.scrollLeft = m[3]; }
  }
}
/** 다시 그릴 때 이미 해독된 그림 요소를 옮겨 심는다 (같은 src 의 <img>, 자식 없는 배경 그림 칸).
 *  화면 전체를 새로 그리면 데이터 URI 그림을 다시 해독하느라 한 프레임 비어 깜빡인다 (도감 항목 고르기 등). 속성은 새 요소 것으로 맞춘다 */
function keepMedia() {
  const Q = 'img[src], [style*="background-image"]';
  const keyOf = (el: Element) => (el.tagName === 'IMG' ? `i${el.getAttribute('src')}` : el.firstChild ? '' : `${el.tagName}${el.getAttribute('style')}`);
  const pool = new Map<string, Element[]>();
  root.querySelectorAll(Q).forEach((el) => { const k = keyOf(el); if (k) (pool.get(k) ?? pool.set(k, []).get(k)!).push(el); });
  return () => {
    if (!pool.size) return;
    root.querySelectorAll(Q).forEach((el) => {
      const k = keyOf(el), old = k ? pool.get(k)?.shift() : undefined;
      if (!old) return;
      for (const a of Array.from(old.attributes)) if (!el.hasAttribute(a.name)) old.removeAttribute(a.name);
      for (const a of Array.from(el.attributes)) if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
      el.replaceWith(old);
    });
  };
}

function render() {
  AB.ABOPT.coef = app.detail; // 상세 보기: 피해 · 회복을 계수로
  if (app.screen !== 'battle' && app.view) { app.view.destroy(); app.view = null; }
  const run = app.run;
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
  const KEEP = ['.um-grid', '.um-a', '.um-c', '.um-r', '.um-main', '.side.right', '.map-detail', '.detail', '.shop-ov', '.so-body', '.shop-ov .sd'];
  const kept = KEEP.map((q) => root.querySelector<HTMLElement>(q)?.scrollTop ?? 0);
  const media = app.screen === 'battle' || app.screen === 'bar' ? null : keepMedia();
  TFX.beforeScreen(prevScreen, app.screen, root); // 이타카: 바뀌기 전 화면을 덮는 바다 (그리기 전에 지금 화면을 얼려 둔다)
  root.innerHTML = `${showTop ? topbar() : ''}${body}${run && app.screen !== 'codex' ? pendingModal(run) : ''}${run && (app.screen === 'prep' || app.screen === 'map') ? recoModal(run) : ''}${run ? useModal(run) : ''}${run ? askPop() : ''}${run ? LAB.labHtml(run, app.screen) : ''}${run && app.bigUnit && (app.screen === 'map' || app.screen === 'prep') ? unitModal(run) : ''}${app.preview ? unitModal(app.preview.run, true) : ''}${menuModal(run)}<div id="toast" class="toast" ${app.toast ? '' : 'hidden'}>${esc(app.toast)}</div>`;
  media?.();
  KEEP.forEach((q, k) => { const el = root.querySelector<HTMLElement>(q); if (el && kept[k]) el.scrollTop = kept[k]; });
  umCompactBind();
  detailHeadBind();
  RM.mountRouteMap(root.querySelector<HTMLElement>('.rmap-host'), app.screen === 'map' ? run : null, (el) => setTimeout(() => tlPop(el), 0), (o) => { const boss = o === 'boss' && run ? phaseBoss(run) : undefined; return `${boss ? `<b>${esc(boss.name)}</b><br>` : ''}${ic(esc(nodeHint(o)))}`; }); // 항로도 (리빈 · 물류망). 팝오버는 누름으로 다시 그린 뒤에 연다 (항로도 DOM 은 그대로 옮겨지므로 el 이 유지된다)
  // 창 내용은 첫 그리기에서 채워질 수 있으므로 (선택지 생성 등) 그린 뒤의 키를 기억한다
  lastView.modal = modalKeyOf();
  topHSync();
  prepZoomSync(); // 보드 크기를 먼저 (창 안 스크롤 위치를 되살리려면 보드가 제 크기여야 한다)
  if (app.screen === 'prep' && run) toolMark(run); else tgTip(null); // 쥔 도구: 받을 수 없는 것을 흐리고, 받는 대상에 다음 누름 결과 (가리키면 보임)
  scrollRestore(scrolled, newModal);
  if (app.screen === 'prep') prepViewInit(sameView); // 조우를 처음 열면 아군 진형부터 · 창 가장자리 길잡이
  restoredAt = performance.now();
  layoutPanels();
  advSync(run ?? null);
  SHOP.shopMount(root); // 상인 말풍선 연출 · 혼잣말 시계
  SHOP.adMount(root); // 페트라 광고판 초읽기 · 자동 닫힘
  TFX.onScreen(prevScreen, app.screen); // 테마 연출: 전투 중 강도 낮춤 · (이타카) 큰 화면 전환 물결 (사건 장면이 떴는지 본 뒤)
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
  const cur = tl?.querySelector<HTMLElement>('.tl-step.cur');
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
  if (app.screen !== 'prep') tacShownPrev = false;
  const deal = (newModal && md?.querySelector<HTMLElement>('.rc-track, .gc-row')) || (app.screen === 'newrun' && !sameView && root.querySelector<HTMLElement>('.car-track'));
  if (deal) revealCards(deal);
  if (md && run && app.screen !== 'battle') gradeCards(md as HTMLElement, run.pending[0], newModal); // 증강 · 보상 카드 등급 연출 (공개음과 같은 3단계)
  if (!artWarmed) { artWarmed = true; setTimeout(() => prefetchArt(RECRUITABLE.map((d) => d.id)), 1500); }
  // 페이즈 전환 연출
  if (run && run.phase !== lastPhase) { if (lastPhase && run.phase > lastPhase) banner('phase', `PHASE ${run.phase}`, `${fieldOf(run.field).name} · 적이 강해집니다`); lastPhase = run.phase; }
  if (!run) lastPhase = 0;
  if (cxScroll) { // 도감: 상세를 맨 위로. 좁은 화면은 상세 ↔ 목록이 번갈아 보이므로 상세 머리나, 돌아온 목록의 그 항목으로
    cxScroll = false;
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

// ───────────────────────── 시작 기물 캐러셀 (무한 순환)
let carX: number | null = null;
function carSet(track: HTMLElement) {
  const cards = track.querySelectorAll<HTMLElement>(':scope > *');
  const n = cards.length / 3;
  return n ? cards[n].offsetLeft - cards[0].offsetLeft : 0;
}
/** 가운데 묶음 밖으로 나가면 같은 위치의 가운데 묶음으로 옮긴다 */
function carWrap(track: HTMLElement) {
  const w = carSet(track);
  if (!w) return;
  if (track.scrollLeft < w * 0.5) track.scrollLeft += w;
  else if (track.scrollLeft > w * 1.5) track.scrollLeft -= w;
  carX = track.scrollLeft;
}
/** 다시 그리지 않고 펼침 상태만 바꾼다 (트랜지션 유지) */
// 카드 설명을 스크롤하면 한 줄 역할(.pc-blurb)을 접는다 (맨 위로 돌아오면 다시 펼침)
if (typeof document !== 'undefined') document.addEventListener('scroll', (e) => {
  const el = e.target as HTMLElement | null;
  if (el?.classList?.contains('pc-desc')) el.closest('.pcard')?.classList.toggle('scrolled', el.scrollTop > 6);
}, { capture: true, passive: true });
function syncCardOpen() {
  root.querySelectorAll<HTMLElement>('.pcard').forEach((c) => {
    const on = !c.hasAttribute('aria-hidden') && c.dataset.v === app.cardOpen;
    c.classList.toggle('open', on);
    const b = c.querySelector('.pc-more');
    if (b) b.textContent = on ? '접기 ▼' : '상세 보기 ▲';
  });
}
/** 메인 화면 우측 탭: 좌우로 끌어 넘긴다 (손가락 · 마우스). 끄는 동안 트랙이 따라오고, 폭의 18% 이상 밀면 옆 탭으로 */
function setMapTab(i: number) {
  app.mapTab = Math.max(0, Math.min(2, i));
  document.querySelectorAll<HTMLElement>('.st-track, .st-ink').forEach((el) => el.style.setProperty('--i', String(app.mapTab)));
  document.querySelectorAll('.st-tab').forEach((el, k) => el.setAttribute('aria-selected', String(k === app.mapTab)));
}
function bindTabSwipe(view: HTMLElement) {
  const track = view.querySelector<HTMLElement>('.st-track')!;
  let g: { x: number; y: number; id: number; on: boolean } | null = null;
  let moved = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('input, .log')) { g = null; return; }
    g = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; moved = false;
  });
  view.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; } // 세로 스크롤은 그대로
      if (Math.abs(dx) < 10) return;
      g.on = true; moved = true;
      view.setPointerCapture(e.pointerId);
      track.style.transition = 'none';
    }
    const edge = (app.mapTab === 0 && dx > 0) || (app.mapTab === 2 && dx < 0) ? 0.3 : 1; // 끝 탭은 고무줄처럼
    track.style.transform = `translateX(calc(${-app.mapTab * 100}% + ${dx * edge}px))`;
  });
  const end = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, on = g.on;
    g = null;
    if (!on) return;
    track.style.transition = ''; track.style.transform = '';
    if (Math.abs(dx) > view.clientWidth * 0.18) setMapTab(app.mapTab + (dx < 0 ? 1 : -1));
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  // 끌어 넘긴 직후의 클릭은 무시 (기물 아이콘이 눌리지 않게)
  view.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
let greatBusy = false; // 마이너 대성공 연출 중 (확정 연타 막기)
let artWarmed = false;
/** 카드 공개: 뒷면으로 깔고, 안의 일러스트가 다 받아질 때까지(최대 4초) 기다렸다가 한 장씩 뒤집는다 */
function revealCards(box: HTMLElement) {
  box.classList.add('deal-box');
  const urls = [...new Set(Array.from(box.querySelectorAll<HTMLImageElement>('img')).map((im) => im.getAttribute('src')!).filter(Boolean))];
  const t0 = performance.now();
  Promise.race([Promise.all(urls.map(loadArt)), new Promise((r) => setTimeout(r, 4000))]).then(() => {
    setTimeout(() => box.classList.add('flip'), Math.max(0, 380 - (performance.now() - t0)));
  });
}
function setupCarousel() {
  const track = root.querySelector<HTMLElement>('.car-track');
  if (!track) return;
  track.style.scrollSnapType = 'none';
  track.scrollLeft = carX ?? carSet(track);
  track.style.scrollSnapType = '';
  let t: ReturnType<typeof setTimeout> | 0 = 0;
  track.addEventListener('scroll', () => { carX = track.scrollLeft; if (t) clearTimeout(t); t = setTimeout(() => carWrap(track), 120); }, { passive: true });
  bindCardDrag(track);
  let lock = 0;
  track.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 가로 스크롤은 그대로
    const desc = (e.target as HTMLElement).closest('.pc-desc') as HTMLElement | null;
    if (desc && desc.scrollHeight > desc.clientHeight + 2) return; // 설명 스크롤 우선
    e.preventDefault();
    const now = Date.now();
    if (now - lock < 250) return;
    lock = now;
    carStep(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}
/** 터치: 카드 하단(이름 · 시너지)을 위로 끌어올리면 설명 펼치기, 아래로 내리면 접기 */
function bindCardDrag(track: HTMLElement) {
  let drag: { id: string; y: number; x: number } | null = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const top = (e.target as HTMLElement).closest('.pc-top');
    const card = top?.closest('.pcard') as HTMLElement | null;
    if (card?.dataset.v) drag = { id: card.dataset.v, y: e.clientY, x: e.clientX };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
    const open = dy < 0;
    if ((app.cardOpen === drag.id) !== open) { app.cardOpen = open ? drag.id : null; syncCardOpen(); }
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    drag = null;
  });
  const end = () => { drag = null; };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
}
function carStep(dir: number) {
  const track = root.querySelector<HTMLElement>('.car-track');
  const card = track?.querySelector<HTMLElement>(':scope > *');
  if (!track || !card) return;
  carWrap(track);
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  track.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
}

/** 카메라 가로 위치를 고를 때 적 1기의 무게 (아군 1) */
const CAM_FOE_W = 1.01;
/** 전투 카메라 (화면 칸 좌표, 가로 지형도 화면 기준): 창 왼쪽 위 칸 (x, y) · 확대 배율 bz (1 = 배치 구역 크기) · 수동 시점을 유지할 시각 hold (끌기 · 확대 뒤 잠깐 그 자리) */
const bcam = { x: 0, y: 0, bz: 1, hold: 0 };
const CAM_HOLD_MS = 4000;
/** 전투 창 치수 (화면 칸): 배율 1 의 창 W × H · 전장 FW × FH · 기본 창 원점 */
function bviewDims(view: HTMLElement) {
  const v = (k: string) => +view.style.getPropertyValue(k) || 0;
  return { W: v('--w'), H: v('--h'), FW: v('--fw'), FH: v('--fh'), ox: v('--ox'), oy: v('--oy') };
}
/** 전투 창: 칸 최소 크기 (CSS --cell-min) 의 BZ_MAX 배까지 확대 (편성 보드는 prepZoomRange · PREP_CELL_MAX) */
const BZ_MAX = 2;
const cellMinOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue('--cell-min')) || 52;
/** 전투 창 최대 배율: 칸이 최소 칸 크기의 BZ_MAX 배가 될 때까지 (작은 창 · 긴 가로 지형일수록 더 확대) */
function battleZoomMax(view: HTMLElement) {
  const d = bviewDims(view), c1 = view.clientWidth / Math.max(1, d.W);
  return c1 > 0 ? Math.max(1, (BZ_MAX * cellMinOf(view)) / c1) : 1;
}
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v));
/** 지금 배율의 창 크기 (px) · 칸 크기 · 보이는 칸 수. 창은 늘 정사각이고, 확대하면 그 안에서 잘라서 보인다 */
function camFrame(view: HTMLElement) {
  const d = bviewDims(view), wpx = view.clientWidth, base = (wpx * d.H) / Math.max(1, d.W), cell = (wpx * bcam.bz) / Math.max(1, d.W);
  const hpx = base; // 창은 확대해도 정사각 그대로 (bviewHtml): 확대는 창 안을 잘라 보일 뿐
  return { d, cell, hpx, vw: d.W / bcam.bz, vh: hpx / cell };
}
/** 카메라를 창에 반영: 창 높이 · 창 안 보드(.board-in) 크기 = 전장 × 칸 크기, 위치 = -카메라 칸 (px) */
function camApply(view: HTMLElement, inner: HTMLElement) {
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
function followCamera(b: Battle) {
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
function offIndicators(view: HTMLElement, alive: CUnit[], b: Battle, left: number, top: number, viewW: number, viewH: number) {
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
let bzSaveT = 0;
function battleZoomTo(bz: number, at?: { x: number; y: number }) {
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
const zoomingT = new WeakMap<HTMLElement, number>();
function zoomingFlag(el: HTMLElement) {
  el.classList.add('zooming');
  clearTimeout(zoomingT.get(el));
  zoomingT.set(el, window.setTimeout(() => el.classList.remove('zooming'), 220));
}
/** 전투 보드 끌어서 보기: 배율 1 이면 놓을 때 제자리로 (배치 구역이 기본 화면), 확대 중이면 카메라를 옮기고 CAM_HOLD_MS 동안 그 자리 */
let panStop: (() => void) | null = null;
function initBoardPan(view: HTMLElement) {
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
    if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 60); }
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  panStop = () => { if (id >= 0) end(null); }; // 두 손가락 확대가 시작되면 끌기를 멈춘다
}
function mountBattleView(board: HTMLElement) {
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
  bunitFor = '';
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

function goPrepOrMap() {
  const run = app.run!;
  if (!run.over && run.campaign?.done && !run.pending.length) run.over = true; // 캠페인 끝 알림을 다 닫은 뒤 다시 불러온 저장
  if (run.over) { app.screen = 'over'; metaRunEnd(run); recEnd(run); }
  else if (run.node?.enc) app.screen = 'prep';
  else if (run.node?.type === 'shop') { app.screen = 'shop'; app.shopShut = false; } // 상점을 다시 연다 (닫기 기록 지움)
  else if (run.node?.type === 'news') app.screen = 'news';
  else if (run.node?.type === 'invest') app.screen = 'invest';
  else app.screen = 'map';
}


// ───────────────────────── 절망 증강 표시 (여러 개가 쌓일 수 있다, data/despair.ts)
/** 상단 바: 1개면 아이콘 + 이름, 여러 개면 아이콘을 나란히 + '절망 n' (좁은 화면은 아이콘만). 누르면 설명 */
function despairPill(r: RunState) {
  const ds = despairsOf(r);
  if (!ds.length) return '';
  const tip = `절망 증강 ${ds.length}개\n${ds.map((d) => `[${d.name}] ${d.desc()}`).join('\n')}`;
  return `<button class="pill despair" data-a="despair-info" title="${esc(tip)}"><span class="dp-ics">${ds.map((d) => lineIcon(d.icon, 'li')).join('')}</span><b>${ds.length === 1 ? esc(ds[0].name) : `절망 ${ds.length}`}</b></button>`;
}
/** 지도 환경 탭: 고른 순서대로 이름 · 효과, 고난이면 다음에 더 고르는 페이즈 */
function despairEnv(run: RunState) {
  const ds = despairsOf(run);
  const ev = OATH.despairEvery(run), nx = despairDiff(run.diff) ? Math.ceil((run.phase + 1) / ev) * ev : 0; // 간격: 심연의 서약이면 짧다
  const next = nx && (nx <= CFG.victoryPhase || run.endless) && DESPAIRS.length > ds.length ? nx : 0; // 의뢰 페이즈 밖(무한 모드 전)이거나 남은 증강이 없으면 표시 안 함
  if (!ds.length && !next) return '';
  const nextTxt = next ? `<li class="dp-next muted small">다음 절망 증강: ${next}페이즈 시작 때 1개 더</li>` : '';
  return `<h2>절망 증강${ds.length > 1 ? ` <span class="muted small">${ds.length}개</span>` : ''}</h2><ul class="globals despair">${ds.map((d: DespairDef) => `<li>${lineIcon(d.icon, 'li')}<b>${esc(d.name)}</b> <span class="muted">${ic(esc(d.desc()))}</span></li>`).join('')}${nextTxt}</ul>`;
}
/** 결과 문구: '[반려 돌] · [오버클럭]' */
const despairNames = (run: RunState) => despairsOf(run).map((d) => `[${esc(d.name)}]`).join(' · ');

// ───────────────────────── 난이도 선택
/** 위험 등급 적 증원 칩 (지도 미리보기 · 편성 적 구성): 그 페이즈 전투에 더해지는 적 수. n 을 주면 조우에 실제로 더한 수 (보드 칸 상한 반영) */
function diffAddChip(run: RunState, phase: number, n = diffAddCount(run.diff, phase)) {
  return n > 0 ? tchip('', `적 +${n}`, 'bad', `위험 등급 ${run.diff} 적 증원: ${diffAddRule(run.diff)} — 페이즈 ${phase} 전투마다 적 +${n}`) : '';
}

// ───────────────────────── 기물 방출
function releaseBlock(run: RunState, u: UnitState) {
  const v = R.releaseValue(run, u);
  const name = UNIT_BY_ID[u.defId].name;
  const lines = R.isRock(u) ? ['반려 돌은 보상 없이 사라집니다. 절망 증강이 걸려 있으면 다시 영입 선택지에 섞여 나옵니다.'] : [
    `${CR}<b>+${v.credits}</b> (${CFG.release.base} + 공명 등급 ${u.rank} × ${CFG.release.perRank})`,
    `${RES}<b>${v.xp}</b> — 이 기물에 쌓인 공명도 ${v.invested}의 ${Math.round(CFG.release.xpShare * 100)}%를 남은 파티에 분배 (출전 기물 우선)`,
    v.items.length ? `장비 · 개조부품 ${v.items.length}개는 보관함으로 (${v.items.map((x) => esc(itemInfo(x).name)).join(', ')})` : '장착한 장비 없음',
    ...(v.lost.length ? [`<span class="down">고유 장비 ${v.lost.map((x) => esc(itemInfo(x).name)).join(', ')}는 함께 사라짐</span>`] : []),
  ];
  const confirm = app.releaseConfirm === u.uid;
  return `<div class="release ${confirm ? 'confirm' : ''}">
    <h3>방출</h3>
    <ul class="small">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    ${confirm ? `<p class="small down">${esc(name)}을(를) 정말 방출할까요? 되돌릴 수 없습니다.</p>
      <div class="row-btns"><button class="btn danger" data-a="release-confirm" data-v="${u.uid}">방출 확정</button><button class="btn" data-a="release-cancel">취소</button></div>`
    : `<button class="btn small" data-a="release" data-v="${u.uid}" ${run.units.length <= 1 ? 'disabled' : ''}>방출하기</button>`}
  </div>`;
}

// ───────────────────────── 전투 기록 (진행 중 미터 · 결과 표)
const ELEM_COLOR: Record<string, string> = { phys: '#cfd3dc', chem: '#7fdc4a', elec: '#5ab8ff', psy: '#c07cff', holy: '#ffd866', true: '#ff6a6a' };
type Agg = { u: CUnit; dmg: number; taken: number; healed: number; shield: number; kills: number; elem: Record<string, number>; n?: number }; // n: 묶은 소환물 수 (최고의 친구 소환물 줄)
/** 시너지 자체 효과 집계 (아군 진영): 기물 몫과 따로 */
/** 시너지 소환물 → 기록을 받을 시너지 (엔지니어 감시 포탑 · 칼리토 근위기사). 사이오닉 등 기물 소환물은 주인 기물 몫, 최고의 친구 소환물은 종류별 자기 줄 (aggAllies) */
const SUMMON_SYN: Record<string, SynergyId> = { turret: 'ENG', kal_guard: 'KAL' };
type SynAgg = { id: string; name: string; color: string; icon: string; dmg: number; taken: number; healed: number; shield: number; elem: Record<string, number> };
function aggSyn(b: Battle): SynAgg[] {
  const mk = (id: string): SynAgg => { const sd = SYN_BY_ID[id as SynergyId]; return { id, name: sd?.name || id, color: sd?.color || 'var(--fg)', icon: synIcon(id) || sd?.icon || '◆', dmg: 0, taken: 0, healed: 0, shield: 0, elem: {} }; };
  const out = new Map<string, SynAgg>();
  for (const [k, x] of Object.entries(b.synStats)) {
    if (x.side !== 0) continue;
    const a = mk(k.slice(2));
    a.dmg = x.dmg; a.healed = x.healed; a.shield = x.shield; a.elem = { ...(x.elem as Record<string, number>) };
    out.set(a.id, a);
  }
  // 시너지가 부른 소환물 (주인 기물 없음): 준 · 받은 피해 · 회복 · 보호막을 그 시너지 몫으로
  for (const t of b.units) {
    const id = t.side === 0 && t.isSummon && !t.owner ? SUMMON_SYN[t.defId] : undefined;
    if (!id) continue;
    const a = out.get(id) || mk(id);
    a.dmg += t.counters.dmg; a.taken += t.counters.taken; a.healed += t.counters.healed; a.shield += t.counters.shield;
    for (const [e, v] of Object.entries(t.counters.elem)) a.elem[e] = (a.elem[e] || 0) + (v || 0);
    out.set(id, a);
  }
  return [...out.values()].filter((x) => x.dmg + x.taken + x.healed + x.shield >= 1);
}
const synBadge = (x: SynAgg) => `<span class="syn-src" style="color:${x.color}" title="시너지 효과">${x.icon}</span>`;
/** 최고의 친구 소환물 (기물 정의의 단짝 · 경호원 · 관료 등): 주인 줄에 합치지 않고 종류별 자기 줄 */
const isBond = (s: CUnit) => s.isSummon && s.defId === 'summon' && !!s.owner;
function aggOf(u: CUnit, parts: CUnit[], n?: number): Agg {
  const elem: Record<string, number> = {};
  for (const p of parts) for (const [k, x] of Object.entries(p.counters.elem)) elem[k] = (elem[k] || 0) + (x || 0);
  const sum = (k: 'dmg' | 'taken' | 'healed' | 'shield' | 'kills') => parts.reduce((s, p) => s + p.counters[k], 0);
  return { u, dmg: sum('dmg'), taken: sum('taken'), healed: sum('healed'), shield: sum('shield'), kills: sum('kills'), elem, ...(n ? { n } : {}) };
}
/** 아군 기물별 집계: 그 밖의 소환물(사이오닉 등)은 주인에게 합산, 최고의 친구 소환물은 주인 · 이름이 같은 것끼리 한 줄 (라라 · 맥스는 따로, 경호원 여럿은 한 줄) */
function aggAllies(b: Battle, bonds = true): Agg[] {
  const out: Agg[] = [];
  for (const u of b.units.filter((x) => x.side === 0 && (!x.isSummon || x.mem.king))) { // 공왕 무휼: 시너지가 부르지만 기물 정의가 있어 자기 줄
    out.push(aggOf(u, [u, ...b.units.filter((s) => s.owner === u && !isBond(s))]));
    if (!bonds) continue;
    const kinds = new Map<string, CUnit[]>();
    for (const s of b.units.filter((x) => x.owner === u && isBond(x))) kinds.set(s.name, [...(kinds.get(s.name) || []), s]);
    for (const l of kinds.values()) out.push(aggOf(l.find((x) => x.alive) || l[0], l, l.length));
  }
  return out;
}
/** 집계 줄 이름: 소환물 줄은 '이름 ×수 · 주인' */
const aggName = (a: Agg) => (a.n ? `${esc(a.u.name)}${a.n > 1 ? ` ×${a.n}` : ''}<small class="agg-own"> · ${esc(a.u.owner?.name || '')}</small>` : esc(a.u.name));
function elemBar(a: Agg) {
  const tot = Math.max(1, a.dmg);
  return `<span class="ebar" title="${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `${ELEM_NAME[k as keyof typeof ELEM_NAME]} ${Math.round((x / tot) * 100)}%`).join(' · ')}">${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `<i style="width:${(x / tot) * 100}%;background:${ELEM_COLOR[k]}"></i>`).join('')}</span>`;
}
function battleTable(b: Battle) {
  const rows = aggAllies(b).sort((x, y) => y.dmg - x.dmg);
  return `<div class="btable-wrap"><table class="btable"><thead><tr><th>기물</th><th>준 피해</th><th>속성 비중</th><th>받은 피해</th><th>회복</th><th>보호막</th><th>결정타</th></tr></thead><tbody>
    ${rows.map((a) => `<tr class="${a.u.alive ? '' : 'dead'}${a.n ? ' bond' : ''}"><td>${sprite(a.u)} ${aggName(a)}</td><td class="mono">${fmt(a.dmg)}</td><td>${elemBar(a)}</td><td class="mono">${fmt(a.taken)}</td><td class="mono">${fmt(a.healed)}</td><td class="mono">${fmt(a.shield)}</td><td class="mono">${a.kills}</td></tr>`).join('')}
    ${(() => { const ss = aggSyn(b).sort((x, y) => y.dmg + y.taken + y.healed + y.shield - (x.dmg + x.taken + x.healed + x.shield)); return ss.length ? `<tr class="bt-sep"><td colspan="7">시너지 효과</td></tr>${ss.map((x) => `<tr class="syn"><td>${synBadge(x)} ${esc(x.name)}</td><td class="mono">${fmt(x.dmg)}</td><td>${x.dmg >= 1 ? elemBar(x as unknown as Agg) : ''}</td><td class="mono${x.taken >= 1 ? '' : ' muted'}">${x.taken >= 1 ? fmt(x.taken) : '-'}</td><td class="mono">${fmt(x.healed)}</td><td class="mono">${fmt(x.shield)}</td><td class="mono muted">-</td></tr>`).join('')}` : ''; })()}
  </tbody></table></div>
  <div class="elegend small muted">${Object.entries(ELEM_COLOR).map(([k, c]) => `<span><i style="background:${c}"></i>${ELEM_NAME[k as keyof typeof ELEM_NAME]}</span>`).join('')}</div>`;
}
// ───────────────────────── 버프 · 디버프
const STAT_KO: Record<StatKey, string> = {
  maxHp: '최대 체력', healEff: '회복 효율', shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력', acc: '명중', crit: '치명타', effHit: '효과 명중',
  armor: '방어도', effRes: '효과 저항', moveSpd: '이동 속도', eva: '회피', critDmg: '치명타 피해', armorPen: '방어도 관통', cdr: '쿨다운 감소',
  atkSpd: '공격 속도', range: '사거리', lifesteal: '흡혈', reloadSpd: '재장전 속도', aoe: '범위', ultCharge: '궁극기 충전 효율',
};
const FLAT_STAT = new Set<StatKey>(['maxHp', 'shoot', 'strike', 'tech', 'armor', 'range']);
const TAG_KO: Record<DmgTag, string> = {
  all: '모든', phys: '물리', chem: '화학', elec: '전기', psy: '사이오닉', holy: '신성', true: '고정', basic: '기본 공격', skill: '스킬', dot: '지속',
  proc: '추가', shoot: '사격', strike: '타격', tech: '기술', combo: '콤보', finish: '피니쉬',
};
const sgn = (v: number, pct = true) => `${v >= 0 ? '+' : '-'}${pct ? pctTxt(Math.abs(v)) : fmt(Math.abs(v))}`;
function statusName(s: Status) {
  return s.label || STATUS_NAME[s.key] || STATUS_NAME[s.key.split('.')[0]] || STATUS_NAME[s.type] || (s.src?.skill?.name ?? '효과');
}
/** 효과 목록 + 좋고 나쁨 점수 */
function statusParts(u: CUnit, s: Status) {
  const out: string[] = [];
  let good = 0, bad = 0;
  const mark = (v: number) => { if (v > 0) good++; else if (v < 0) bad++; };
  if (s.type === 'stun') { out.push('행동 불가 · 재장전 정지'); bad++; }
  if (s.type === 'fear') { out.push('공포: 공격 · 기술 불가, 재장전 정지'); bad++; }
  if (s.type === 'shock') { out.push('감전: 쿨다운 · 재장전 정지'); bad++; }
  if (s.dps) { out.push(`초당 ${fmt(s.dps)} ${ELEM_NAME[s.elem || 'phys']} 피해`); bad++; }
  for (const [k, v] of Object.entries(s.delta || {}) as [StatKey, number][]) {
    if (!v) continue;
    out.push(`${STAT_KO[k] || k} ${sgn(v, !FLAT_STAT.has(k))}`);
    mark(v);
  }
  if (s.armorMul !== undefined && s.armorMul !== 1) { out.push(`방어도 ×${s.armorMul.toFixed(2)}`); mark(s.armorMul - 1); }
  // 용어: 이로운 피해량 경감 = 피해량 경감 / 해로운 주는 피해 감소 = 피해량 감소
  const tg = (t: DmgTag) => (t === 'all' ? '' : `${TAG_KO[t]} `);
  for (const m of s.mods || []) { out.push(m.v < 0 ? `${tg(m.tag)}피해량 감소 ${pctTxt(-m.v)}` : `${tg(m.tag)}피해 ${m.kind === 'amp' ? '증폭 ' : ''}${sgn(m.v)}`); mark(m.v); }
  for (const t of s.taken || []) { out.push(t.kind === 'red' ? `${tg(t.tag)}피해량 경감 ${pctTxt(t.v)}` : `받는 ${tg(t.tag)}피해 +${pctTxt(t.v)}`); mark(t.kind === 'red' ? t.v : -t.v); }
  if (s.reflect) { out.push(`받은 피해 ${pctTxt(s.reflect)} 반사`); good++; }
  if (s.share && s.share !== u) { out.push(`받는 피해 일부를 ${s.share.name}이(가) 나눠 받음`); good++; }
  if (s.share === u) out.push('다른 기물의 피해를 나눠 받는 중');
  if (s.stacks) out.push(`${s.stacks}중첩`);
  return { out, good, bad };
}
/** 버프(파랑) · 디버프(빨강) · 오묘한 효과(흰색) */
function statusKind(u: CUnit, s: Status): 'buff' | 'debuff' | 'odd' {
  const { good, bad } = statusParts(u, s);
  if (good && !bad) return 'buff';
  if (bad && !good) return 'debuff';
  if (good || bad) return 'odd';
  if (s.src && s.src !== u) return s.src.side === u.side ? 'buff' : 'debuff';
  return 'odd';
}
const durTxt = (d: number) => (d > 900 ? '전투 내내' : `${d.toFixed(1)}초 남음`);
function buffIcons(u: CUnit) {
  const all = u.statuses.filter((s) => s.dur > 0);
  if (!all.length) return '<p class="muted small bf-none">걸린 효과 없음</p>';
  // 한 줄 8개, 개수 제한 없이 모두 (필드 토큰은 줄여서 보이므로 여기서 전부 확인)
  return `<div class="bf-grid">${all.map((s) => {
    const nm = statusName(s);
    const on = app.bPick === `st:${s.key}`;
    return `<button class="bf bf-${statusKind(u, s)}${on ? ' on' : ''}" data-a="bpick" data-v="st:${esc(s.key)}" title="${esc(nm)}" aria-label="${esc(nm)}">${lineIcon(augKey(`${nm} ${statusParts(u, s).out.join(' ')}`))}${s.stacks ? `<b>${s.stacks}</b>` : ''}</button>`;
  }).join('')}</div>`;
}
/** 선택한 버프 · 장비 설명 (지속 시간은 실시간) */
function bpickInfo(u: CUnit) {
  const k = app.bPick;
  if (!k) return '';
  if (k.startsWith('st:')) {
    const s = u.statuses.find((x) => x.key === k.slice(3) && x.dur > 0);
    if (!s) return '<div class="bf-info muted small">효과가 끝났습니다.</div>';
    const kind = statusKind(u, s);
    const { out } = statusParts(u, s);
    return `<div class="bf-info bf-${kind}"><div class="bf-ih"><b>${esc(statusName(s))}</b><span class="small">${kind === 'buff' ? '버프' : kind === 'debuff' ? '디버프' : '특수'} · ${durTxt(s.dur)}</span></div>
      <span class="small">${out.length ? esc(out.join(' · ')) : '고유 효과'}</span>${s.src && s.src !== u ? `<span class="small muted">출처: ${esc(s.src.name)}</span>` : ''}</div>`;
  }
  if (k.startsWith('it:')) {
    const it = itemInfo(k.slice(3));
    return `<div class="bf-info it"><div class="bf-ih"><b>${esc(it.name)}</b></div><span class="small">${statIc(esc(it.desc))}</span></div>`;
  }
  return '';
}

// ───────────────────────── 전투 중 상세 정보 (아군 · 적 공용)
const magBtn = () => `<button class="mag-btn${app.statPop ? ' on' : ''}" data-a="stat-pop" title="상세 능력치" aria-label="상세 능력치 ${app.statPop ? '닫기' : '보기'}" aria-pressed="${app.statPop}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l4.5 4.5"/></svg></button>`;
function majorsHtml(ms: Record<Major, number>, amp?: { m: Major; x: number }) {
  return `<div class="majors">${MAJORS.map((m) => {
    const a = amp?.m === m ? amp : null, v = a ? Math.round(ms[m] * a.x) : ms[m];
    const pop = a ? ` data-kw="foe" data-tt="${MAJOR_NAME[m]} ${v}" data-td="기본 ${ms[m]} × 페이즈 피해 배율 ${a.x.toFixed(2)}" tabindex="0"` : '';
    return `<div class="major${a && v !== ms[m] ? ' amp' : ''}"${pop}><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, v * 3)}%"></i></span><b>${v}</b></div>`;
  }).join('')}</div>`;
}
/** 적의 주력 능력치 (전투력 · 정신력 중 큰 쪽) × 페이즈 피해 배율 (전장 · 위험 등급 포함, 엔진의 phaseAmp) */
const foeAmp = (ms: Record<Major, number>, c: CUnit) => ({ m: (ms.mnd > ms.pow ? 'mnd' : 'pow') as Major, x: c.phaseAmp });
/** 아군: 전술 유형 · 전투 유형 · 분류, 적: 분류 · 등급 */
function allyTags(d: UnitDef) { return `<i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i>${categoryTag(unitCategory(d))}`; }
/** 적 상세 머리 (편성 · 전장 브리핑 · 전투 공용): 초상 → 칩 줄 (공명 등급 · 분류 · 성향 · 정예 / 보스만 등급) → 한 줄 설명.
 *  칩은 편성 적 패널과 같은 토큰 (.rank.foe-rank · .tchip). 누르면(PC 호버) 설명 팝업 — 공명 등급 추정 · 분류 규칙 · 성향 · 용어집 '정예 · 보스' 데이터에서 읽는다 */
function foeHead(e: EnemyDef, fallback: string, rk: { lv: number; hpX: number } | null) {
  const cat = enemyCategory(e), td = TEND_NAME[e.tend];
  const pop = (t: string, d: string) => ` data-kw="foe" data-tt="${esc(t)}" data-td="${esc(d)}" tabindex="0" role="button"`;
  const tier = e.tier === 'minion' ? undefined : GLOSSARY.flatMap((c) => c.entries).find((x) => x.id === 'boss');
  const [rt, rd] = rk ? rankTip(rk).split(': ') : ['', ''];
  const chips = (rk ? `<span class="rank foe-rank"${pop(rt, rd)}>${rankLabel(rk.lv)}</span>` : '')
    + `<span class="tchip cat-${cat}"${pop(CATEGORY_NAME[cat], CATEGORY_RULE[cat])}>${lineIcon(`k.${cat}`, 'li')}${CATEGORY_NAME[cat]}</span>`
    + (td ? `<span class="tchip"${pop(td.name, td.desc)}>${lineIcon(`t.${e.tend}`, 'li')}${td.name}</span>` : '')
    + (tier ? `<span class="tchip bad"${pop(tier.term, tier.text)}>${lineIcon(e.tier === 'boss' ? 'n.boss' : 'm.elite', 'li')}${tierKo(e)}</span>` : '');
  const line = foeBlurb(e);
  return `${heroHead(`en_${e.id}`, fallback, e.name, chips)}${line ? `<p class="small foe-line">${esc(line)}</p>` : ''}`;
}
/** 적 한 줄 설명 (표시용): 설명 데이터(ENEMY_DESC)에서 칩과 겹치는 머리말(보스 · 정예)과 출현 페이즈('n페이즈부터')를 걸러 낸다 — 도감 · 툴팁은 원문 그대로 */
const foeBlurb = (e: EnemyDef) => (ENEMY_DESC[e.id] || '').replace(/^(보스|정예)(\. | · )/, '').replace(/\s*\d+페이즈부터\.?/g, '').trim();
/** 적 성향 한 줄 (툴팁 · 상세) */
const tendText = (e: EnemyDef) => `성향: ${TEND_NAME[e.tend].name} — ${TEND_NAME[e.tend].desc}`;
/** 적: 지금 표적 + 도발 수치 상위 3명 (전투 상세) */
function provInfo(b: Battle, u: CUnit) {
  if (!u.prov || !u.alive) return '';
  const top = b.provTop(u, 3);
  const tg = u.target?.alive ? u.target : null;
  return `<h3>표적 <span class="muted small">${u.tend ? esc(TEND_NAME[u.tend].name) : ''}</span></h3><p class="small">${tg ? `지금 표적: <b>${esc(tg.name)}</b>` : '표적 없음'}${(u.mem.provLock || 0) > b.t ? ' <span class="tag">도발 고정</span>' : ''}</p>${top.length ? `<ol class="as-log">${top.map((x) => `<li>${esc(x.u.name)} <span class="muted">도발 수치 ${Math.round(x.v)}</span></li>`).join('')}</ol>` : ''}`;
}
function heroHead(artId: string, fallback: string, name: string, tags: string) {
  const t = tags ? `<span class="dh-types">${tags}</span>` : '';
  return `<div class="d-hero">${hero(artId) || `<div class="hero none">${fallback}</div>`}<div class="dh-name"><b>${esc(name)}</b>${t}</div></div>`;
}
function enemyWeapon(e: EnemyDef, interval = e.interval) {
  return abil('weapon', '기본 공격', `${interval.toFixed(1)}초`, `${e.atk.type === 'shoot' ? '사격' : '타격'} · ${ELEM_NAME[e.atk.elem]} 피해 · 사거리 ${e.range}${e.immobile ? ' · 이동하지 않음' : ''}${e.melee ? ' · 근접' : ''}`);
}
const tierKo = (e: EnemyDef) => (e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '일반'); // 정예: 용어집 · 적 설명 · 도감과 같은 말
const majorCache = new Map<number, Record<Major, number>>();
function battleMajors(u: CUnit): Record<Major, number> | null {
  if (u.side === 1) return Object.fromEntries(MAJORS.map((m) => [m, u.mem[`M_${m}`] || 0])) as Record<Major, number>;
  if (!u.src || !app.run) return null;
  let m = majorCache.get(u.id);
  if (!m) {
    const run = app.run;
    m = totalMajors(u.src, unitEffects(run, u.src, synergyCounts(deployed(run), run), true));
    majorCache.set(u.id, m);
  }
  return m;
}
/** 고정부 (선택이 바뀔 때만 다시 그림) */
function battleUnitStatic(b: Battle, u: CUnit) {
  const items = u.side === 0 ? (u.src?.items || []) : (ENEMY_BY_ID[u.defId]?.items || []);
  const mod = u.side === 0 ? u.src?.mod : ENEMY_BY_ID[u.defId]?.mod;
  const temp = u.tempItems || [];
  const ic2 = (id: string, tag = '') => `<button class="tk-it${app.bPick === `it:${id}` ? ' on' : ''}" data-a="bpick" data-v="it:${id}" title="${esc(itemInfo(id).name)}${tag}">${itemIcon(id)}</button>`;
  const eq = [...items.filter((x): x is string => !!x).map((x) => ic2(x)), ...(mod ? [ic2(mod)] : []), ...temp.map((x) => ic2(x, u.side === 1 ? '' : ' (임시)'))];
  let head = '', abils = '', pop = '';
  if (u.side === 0 && (!u.isSummon || u.mem.king)) {
    const d = withEmblemSummon(UNIT_BY_ID[u.defId], u.src?.mod);
    const pv = provChip(b, u);
    head = heroHead(d.id, sprite(u, 'spr big'), d.name, allyTags(d)) + (pv ? `<div class="d-pows">${pv}</div>` : '');
    abils = `${weaponCard(u.weapon || d.weapon, b, u, u.atk.elem, d.id)}<div class="abil ab-trait ab-click${abilOn('trait')} has-tok" data-a="abil-pop" data-v="trait" role="button" tabindex="0">${abTok(`trait.${d.id}`)}<div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div>${traitHtml(d, b, u)}</div>${skillCard(d, b, u)}${summonSection(d, b, u, '이번 전투')}${ultCard(d, b, u, true)}${ttSection(d, u.src || null, app.run, b, u, true)}${relicSection(d, u.src || null, app.run, u, true, b)}${faithAbil(d, u.src || null, app.run, u)}`;
    if (app.abilPop) pop = abilPopHtml(app.abilPop, d, b, u);
  } else if (u.side === 1 && ENEMY_BY_ID[u.defId]) {
    const e = ENEMY_BY_ID[u.defId];
    head = foeHead(e, sprite(u, 'spr big'), unitRank(e, u));
    abils = enemyAbilCards(e, b, u);
    if (app.abilPop) pop = enemyAbilPop(app.abilPop, e, b, u);
  } else {
    const pv = u.side === 0 ? provChip(b, u) : '';
    head = heroHead(u.art || '', sprite(u, 'spr big'), u.name, `${u.ctype ? `<i>${typeIcon(u.ctype)}${CTYPE_NAME[u.ctype]}</i>` : ''}${categoryTag(u.category)}<i>${u.owner ? `${esc(u.owner.name)}의 소환물` : '소환물'}</i>`) + (pv ? `<div class="d-pows">${pv}</div>` : '');
    if (u.skill) abils = abil('skill', u.skill.name, `${u.cdMax.toFixed(1)}초`, u.skill.desc(u.sk));
  }
  const ms = battleMajors(u);
  return `${dBar('bdesel')}${head}
    <div class="bs-dyn"></div>
    ${eq.length ? `<h3>장비</h3><div class="d-eqbox"><div class="d-eq">${eq.join('')}</div></div>` : ''}
    ${ms ? `<div class="mj-wrap"><div class="mj-head"><h3>주요 능력치</h3>${magBtn()}</div>${majorsHtml(ms, u.side === 1 && ENEMY_BY_ID[u.defId] ? foeAmp(ms, u) : undefined)}</div>` : `<div class="mj-head"><h3>능력치</h3>${magBtn()}</div>`}
    ${app.statPop ? '<div class="bs-stats"></div>' : ''}
    ${abils ? `<h3>능력</h3><div class="abils">${abils}</div>` : ''}${pop}`;
}
/** 변하는 부분: 체력 · 버프 · 선택 설명 · 상세 능력치 */
function battleUnitDyn(b: Battle, u: CUnit) {
  const max = b.S(u, 'maxHp');
  return `<div class="bs-hp"><span class="bs-bar"><i style="width:${Math.max(0, (u.hp / max) * 100)}%"></i>${u.shield > 0 ? `<i class="sh" style="width:${Math.min(100, (u.shield / max) * 100)}%"></i>` : ''}</span><span class="mono small">${u.alive ? `${fmt(Math.max(0, u.hp))} / ${fmt(max)}${u.shield > 0 ? ` · 보호막 ${fmt(u.shield)}` : ''}` : '전투 불능'}</span></div>
    ${actState(b, u)}${provInfo(b, u)}${reasonTrend(b, u)}
    <h3>효과 <span class="muted small">${u.statuses.filter((s) => s.dur > 0).length}</span></h3>${buffIcons(u)}${bpickInfo(u)}`;
}
// ───────── 이성 추이 (사이오닉): 엔진 rlog 기록을 읽어 보여 준다 (표시 전용)
/** 이성 출처 태그 → 이름 (전공 증강은 'volt.store' 처럼 전공.키) */
function reasonTagName(tag: string) {
  if (tag === 'cantrip') return '비술';
  if (tag === 'frenzy') return '광폭 회복';
  if (tag === 'rule') return '고유 규칙';
  const [sc, k] = tag.split('.');
  return SCHOOL_PASSIVES[sc as SchoolId]?.find(([key]) => key === k)?.[1] || tag;
}
const sgnN = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1).replace(/\.0$/, '')}`;
/** 출처별 합계 줄: 큰 순서, 최대 n개 */
const tagSum = (m: Record<string, number>, n: number, sign = 1) => Object.entries(m).filter(([, v]) => Math.abs(v) >= 0.5).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, n).map(([k, v]) => `${esc(reasonTagName(k))} ${sgnN(v * sign)}`).join(' · ');
const secs = (v: number) => `${v.toFixed(1)}초`;
function reasonTrend(b: Battle, u: CUnit) {
  if (u.reason === null) return '';
  const L = u.rlog;
  const win: Record<string, number> = {};
  let net = 0;
  for (const r of L?.recent || []) if (r.t >= b.t - 5) { win[r.tag] = (win[r.tag] || 0) + r.d; net += r.d; }
  const arrow = net > 1 ? '<i class="rt-up" title="최근 5초 회복 중">↑</i>' : net < -1 ? '<i class="rt-down" title="최근 5초 떨어지는 중">↓</i>' : '<i class="rt-flat" title="최근 5초 거의 그대로">→</i>';
  const recent = tagSum(win, 4);
  const gain = L ? tagSum(L.gain, 4) : '';
  return `<h3>이성 <span class="rt-now">${Math.round(u.reason)} ${arrow}</span></h3>
    <dl class="rt-box">
      <dt>최근 5초</dt><dd>${recent || '<span class="muted">변화 없음</span>'}${recent ? ` <span class="muted">(합 ${sgnN(net)})</span>` : ''}</dd>
      <dt>구간 시간</dt><dd>고이성 ${secs(L?.hiT || 0)} · 저이성 ${secs(L?.loT || 0)} · 광폭 ${secs(L?.frzT || 0)}</dd>
      <dt>회복 기여</dt><dd>${gain || '<span class="muted">없음</span>'}</dd>
    </dl>`;
}
/** 결과 화면: 사이오닉 아군의 이성 관리 요약 */
function reasonReport(b: Battle) {
  const us = b.units.filter((u) => u.side === 0 && !u.isSummon && u.reason !== null && u.rlog);
  if (!us.length) return '';
  return `<div class="rt-report"><h4>이성 관리 <span class="muted small">고이성 &gt; +${REASON_HI} · 저이성 &lt; ${REASON_LO}</span></h4><div class="btable-wrap"><table class="btable"><thead><tr><th>기물</th><th>고이성</th><th>저이성</th><th>광폭</th><th>회복 기여</th><th>감소</th></tr></thead><tbody>
    ${us.map((u) => { const L = u.rlog!; return `<tr class="${u.alive ? '' : 'dead'}"><td>${sprite(u)} ${esc(u.name)}</td><td class="mono">${secs(L.hiT)}</td><td class="mono">${secs(L.loT)}</td><td class="mono${L.frzT ? ' down' : ''}">${secs(L.frzT)}</td><td class="small">${tagSum(L.gain, 3) || '-'}</td><td class="small muted">${tagSum(L.loss, 2, -1) || '-'}</td></tr>`; }).join('')}
  </tbody></table></div></div>`;
}
/** 행동 상태: 왜 지금 멈췄는지 + 기술 준비 · 재장전 · 다음 공격 진행도 + 최근 행동 3개 */
function actState(b: Battle, u: CUnit) {
  if (!u.alive) return '';
  const bar = (label: string, f: number, cls: string, note = '') => `<div class="as-row ${cls}"><span>${label}</span><span class="as-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></span><span class="mono small">${note}</span></div>`;
  const why = b.has(u, 'stun') ? '기절 — 행동 불가' : b.has(u, 'fear') ? '공포 — 공격 · 기술 불가' : u.reloadT > 0 && b.has(u, 'shock') ? '감전 — 쿨다운 · 재장전 정지' : u.moveT > 0 ? '이동 중' : (u.mem.zocUntil || 0) > b.t ? `돌격가 경계에 걸림 — ${((u.mem.zocUntil || 0) - b.t).toFixed(1)}초 뒤 이동` : u.reloadT > 0 ? (u.skill && u.cd <= 0 ? '재장전 중 — 기술 대기' : '재장전 중') : u.target && u.target.alive && b.dist(u, u.target) > b.S(u, 'range') ? '사거리 밖 — 접근 중' : '';
  const rows: string[] = [];
  if (u.skill) rows.push(bar('기술 준비', u.cdMax ? 1 - u.cd / u.cdMax : 1, 'sk', u.cd <= 0 ? (u.reloadT > 0 ? '재장전 대기' : '준비됨') : `${Math.max(0, u.cd).toFixed(1)}초`));
  if (u.weapon?.kind === 'mag') {
    const mag = u.weapon.mag || 1, rl = u.weapon.reload || 1.5;
    rows.push(u.reloadT > 0 ? bar('재장전', 1 - u.reloadT / rl, 'rl', `${u.reloadT.toFixed(1)}초`) : bar('탄창', u.ammo / mag, 'ammo', `${u.ammo}/${mag}`));
  }
  if (!u.noAttack) rows.push(bar('다음 공격', 1 - Math.max(0, u.atkTimer) / Math.max(0.01, u.atk.interval), 'atk', u.atkTimer <= 0 ? '대기' : ''));
  const rec = app.view?.recent(u.id) || [];
  return `<div class="act-state">${why ? `<p class="as-why${/기절|공포|감전/.test(why) ? ' bad' : ''}">${why}</p>` : ''}${rows.join('')}</div>
    ${rec.length ? `<h3>최근 행동</h3><ol class="as-log">${rec.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ol>` : ''}`;
}
let bunitFor = '';
function renderBattleUnit(b: Battle, force: boolean) {
  const bu = document.getElementById('bunit');
  if (!bu) return;
  const u = b.units.find((x) => x.id === app.battleSel);
  // 고른 기물이 없으면 사건 피드 (battleview 가 채움), 고르면 그 기물 상세
  const feed = document.getElementById('bf-ev-wrap');
  // 지형 지물: 덩어리 칸 강조 + 상세 (수문은 열림 · 닫힘이 바뀌면 다시 그린다)
  document.querySelectorAll<HTMLElement>('#bboard .cell[data-tg]').forEach((c) => { const on = +c.dataset.tg! === app.battleTerrain; if (on !== c.classList.contains('tr-sel')) c.classList.toggle('tr-in', on); c.classList.toggle('tr-sel', on); }); // 새로 고른 덩어리만 짧은 전환 (tr-in)
  const grp = app.battleTerrain !== null && b.geo ? terrainGroups(b.geo)[app.battleTerrain] : undefined;
  if (grp && b.geo) {
    const gate = grp.k === 'gate' && b.mem.gateNext !== undefined ? gateLive(b, grp) : undefined, cart = grp.k === 'rail' ? cartLive(b) : undefined, dyn = dynLive(b, b.geo, grp);
    const sig = `t${grp.id}:${gate ? `${gate.state}:${gate.left}:${gate.pend}` : ''}:${cart ? `${cart.left}:${cart.dir}:${cart.run}` : ''}:${dyn?.key ?? ''}`; // 수문 · 운반차 · 바뀌는 지형: 상태 · 남은 초가 바뀔 때만 다시 그린다
    if (force || sig !== bunitFor) { bu.hidden = false; if (feed) feed.hidden = true; bu.innerHTML = terrainDetail(b.geo, grp, 'bdesel', { gate, cart, dyn }); bunitFor = sig; layoutPanels(); }
    return;
  }
  if (!u) { if (bunitFor !== 'none' || force) { bu.innerHTML = ''; bu.hidden = true; if (feed) feed.hidden = false; bunitFor = 'none'; } return; }
  const sig = `${u.id}:${app.statPop}:${app.abilPop}:${app.bPick?.startsWith('it:') ? app.bPick : ''}`;
  if (force || sig !== bunitFor) { bu.hidden = false; if (feed) feed.hidden = true; bu.innerHTML = battleUnitStatic(b, u); bunitFor = sig; layoutPanels(); }
  const dyn = bu.querySelector('.bs-dyn');
  if (dyn) dyn.innerHTML = battleUnitDyn(b, u);
  const st = bu.querySelector('.bs-stats');
  if (st) st.innerHTML = statLines(u, b);
}

// ───────────────────────── 도감
let cxScroll = false;
/** 도감 그림 조각 (codex2.ts 로 넘김) */
const cxH = (): CX2.CxH => ({ itemIcon, augIcon, sprite: (d) => sprite(d), abTok, statIc, relicTok: (id) => relicTok(id), majorIcon: (m) => majorIcon(m), bust: (id) => standImg(id, 'cx-bust', true), typeIcon });
/** 도감 · 기물: 초상화 카드 목록 (묶기 · 정렬 · 검색은 codex2.ts) + 고른 기물의 큰 일러스트 · 요약 · 능력 · 시너지 */
function codexUnits(m: ReturnType<typeof loadMeta>) {
  const known = (d: UnitDef) => !d.eventOnly || !!d.king || !!m.units[d.id]; // 공왕 무휼은 늘 공개 (청라공국 시너지 설명의 일부)
  const { html, first } = CX2.unitsList(cxH(), { group: app.codexGroup, sel: app.codexSel, known });
  const d = UNIT_BY_ID[app.codexSel || first || ''];
  const detail = d && known(d) ? codexDetail(d, m) : `<div class="cx-empty muted small">기물을 고르면 시너지 · 능력 · 역할군 · 추천 장비 · 이야기를 볼 수 있습니다.</div>`;
  return CX2.cxWrap('cx-units', html, detail, app.codexSel ? `data-a="codex-sel" data-v="${esc(app.codexSel)}"` : null);
}
function codexDetail(d: UnitDef, m: ReturnType<typeof loadMeta>) {
  // 1등급 · 장비 없음 기준 미리보기 (시너지 미적용)
  const zero = { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 };
  const tmp: UnitState = { uid: 'codex', defId: d.id, rank: 1, xp: 0, alloc: { ...zero }, perm: { ...zero }, augments: [], items: [d.item || null, null, null], mod: null, pos: { c: 0, r: 0 }, faith: d.faith, grow: {} } as UnitState;
  const b = new Battle(9, 9, new Rng(1), { phase: 1, credits: 0 });
  b.keepEvents = false;
  const c = buildAlly(b, null, tmp, {});
  b.add(c); b.computeTac();
  if (d.ctype === 'CMD') b.tac[0] = CFG.tacBase + CFG.tacPerMnd * (c.mem.mnd || 0); // 전술 위력: 출전 4명 · 지휘관 1명 기준
  const r = m.units[d.id];
  const syn = [...d.factions, ...d.traits].map((id) => { const x = SYN_BY_ID[id as SynergyId]; if (!x) return ''; return `<button class="cx-syn-row" style="--c:${x.color}" data-a="cx2" data-v="go:syn:${x.id}" title="시너지 도감에서 보기"><span class="cx-syn-ic">${synIcon(x.id) || x.icon}</span><span><b>${esc(x.name)}</b> <span class="muted small">${x.kind === 'faction' ? '세력' : '특성'} · <span class="f-num">${x.tiers.join(' / ')}</span></span><p class="small muted">${esc(x.desc).replace(/\n/g, '<br>')}</p></span></button>`; }).join('');
  const reco = recoKeys(d).map((key) => { const it = itemInfo(`A_${key}`); const [ca, cb] = it.recipe || []; return `<li class="rc-row">${itemIcon(`A_${key}`)}<div class="rc-main"><b>${esc(it.name)}</b><span class="small muted">${statIc(esc(it.desc))}</span></div><div class="rc-parts" title="조합 재료">${[ca, cb].filter(Boolean).map((x) => itemIcon(x!)).join('')}</div></li>`; }).join('');
  const art = standImg(d.id, 'stand full') + standImg(d.id, 'stand bust', true);
  return `<div class="detail cx-d cx-ud">
    <div class="cx-ud-top">
      <div class="cx-ud-art${art ? '' : ' none'}"${art ? ` data-stand="${d.id}" title="전신 보기"` : ''}>${art || sprite(d, 'spr big')}</div>
      <div class="cx-ud-id">
        <h2 class="cx-ud-name f-title">${esc(d.name)}</h2>
        <p class="muted small">${esc(d.title)}</p>
        <span class="dh-types"><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i><i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i></span>
        <div class="cx-ud-pow">${powRow(b, c, d, false)}<div class="majors-mini">${MAJORS.map((mm) => `<span title="${MAJOR_NAME[mm]} (기본)">${majorIcon(mm)}<b class="f-num">${d.base[mm]}</b></span>`).join('')}</div></div>
        ${unitSummary(app.run as RunState, tmp, d, b, c)}
        <h3>시너지</h3><div class="cx-syns">${syn}</div>
      </div>
    </div>
    <h3 class="cx-ud-ab">능력 <span class="cx-hn">1등급 · 장비 없음 기준</span>${detailToggle()}</h3>
    <div class="cx-ud-abil"><div class="abils">${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}${traitGroup(d, null, null, b, c)}${skillCard(d, b, c)}${summonSection(d, b, c, sumScope(null))}${voyAbil(d, null, null)}</div>
    <div class="abils">${ultCard(d, b, c)}${ttSection(d, null, null, b, c)}${relicSection(d, null, null, c, false, b)}${faithAbil(d, null, null)}</div></div>
    ${d.king ? `<div class="cx-ud-king">${CX2.kingSection(cxH(), true)}</div>` : ''}
    <div class="cx-ud-more"><div><h3>${d.king ? '장비' : '추천 장비'} <span class="cx-hn">${d.king ? '일반 장비 장착 불가 (전용 장비 자동 장착)' : CTYPE_NAME[d.ctype]}</span></h3>${d.king ? '' : `<ul class="rc-list">${reco}</ul>`}</div>
    <div><h3>이야기</h3>${STORIES[d.id] ? `<p class="small">${esc(STORIES[d.id])}</p>` : ''}<p class="lore">${esc(d.lore)}</p>${CX2.loreLinks(d.id)}</div></div>
    <div class="codex-stats small">의뢰 <b class="f-num">${r?.runs || 0}</b>회 · 누적 공명 등급 <b class="f-num">${r?.ranks || 0}</b> · 최고 <b class="f-num">${r?.best || 0}</b> · 성공 <b class="f-num">${r?.clears || 0}</b></div>
  </div>${app.abilPop ? abilPopHtml(app.abilPop, d, b, c) : ''}`;
}
function codexScreen() {
  const m = loadMeta();
  // 탭: 자료 (기물 · 시너지 · 장비 · 증강 · 사이오닉 · 세계관) | 기록 (적 · 사건 · 교범 · 기록)
  const tb = ([k, l]: readonly [string, string]) => `<button class="cx-tab${app.codexTab === k ? ' on' : ''}" data-a="codex-tab" data-v="${k}" aria-pressed="${app.codexTab === k}">${l}</button>`;
  const tabs = `<div class="cx-tg">${([['units', '기물'], ...CX2.CX2_TABS] as const).map(tb).join('')}</div><div class="cx-tg cx-tg2">${([['enemies', '적'], ['events', '사건'], ['manual', '교범'], ['records', '기록'], ['ach', '업적']] as const).map(tb).join('')}</div>`;
  let body = '';
  if (app.codexTab === 'units') {
    body = codexUnits(m);
  } else if (app.codexTab === 'enemies') {
    body = FIELDS.map((f) => {
      const ids = [...f.pool, f.elite, ...f.bosses];
      return `<h2 style="color:${f.color}">${f.icon} ${esc(f.name)}</h2><div class="codex-list">${ids.map((id) => {
        const e = ENEMY_BY_ID[id];
        const r = m.enemies[id];
        return `<div class="codex-row ${r ? '' : 'unknown'}">${sprite(e)}<div><b>${r ? esc(e.name) : '???'}</b> <span class="muted small">${e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '일반'}</span>
          <div class="small">${r ? esc(ENEMY_DESC[id] || '') : '아직 만나지 못했습니다.'}</div>${r ? `<div class="small muted">${esc(tendText(e))}</div>${e.immobile ? '' : `<div class="small muted">${esc(enemyMoveRule(e))}</div>`}` : ''}</div><div class="small mono">조우 ${r?.seen || 0}<br>처치 ${r?.kills || 0}</div></div>`;
      }).join('')}</div>`;
    }).join('') + (() => { const extra = ENEMIES.filter((e) => !FIELDS.some((f) => [...f.pool, f.elite, ...f.bosses].includes(e.id)) && m.enemies[e.id]); return extra.length ? `<h2>기타</h2><div class="codex-list">${extra.map((e) => `<div class="codex-row">${sprite(e)}<div><b>${esc(e.name)}</b></div><div class="small mono">처치 ${m.enemies[e.id].kills}</div></div>`).join('')}</div>` : ''; })();
  } else if (app.codexTab === 'events') {
    const story = (p: string) => EVENTS.filter((e) => e.id.startsWith(p));
    const groups: [string, typeof EVENTS][] = [['공용', EVENTS.filter((e) => !e.fields && !/^s[a-d]_/.test(e.id))], ...FIELDS.map((f) => [f.name, EVENTS.filter((e) => e.fields?.includes(f.id))] as [string, typeof EVENTS]),
      ['함선 생활 · 엘베스타드 일가', story('sa_')], ['세력 정치 · 의뢰', story('sb_')], ['우주 기담 · 사이오닉 · 신앙', story('sc_')], ['변경 생존 · 도박 · 인양', story('sd_')]];
    const seenN = EVENTS.filter((e) => m.events[e.id]).length;
    body = `<p class="muted small">겪은 사건 ${seenN} / ${EVENTS.length}종. 연계 사건은 앞선 사건의 선택에 따라 열립니다.</p>` + groups.filter(([, l]) => l.length).map(([g, list]) => `<h2>${esc(g)} <span class="muted small">${list.filter((e) => m.events[e.id]).length}/${list.length}</span></h2><div class="codex-list">${list.map((e) => {
      const n = m.events[e.id] || 0;
      return `<div class="codex-row ${n ? '' : 'unknown'} ${e.rare ? 'rare' : ''}"><div><b>${n ? esc(e.title) : '???'}</b>${e.rare ? ' <span class="tag">희귀</span>' : ''}<div class="small">${n ? esc(e.text) : '아직 겪지 못한 사건입니다.'}</div></div><div class="small mono">${n}회</div></div>`;
    }).join('')}</div>`).join('');
  } else if (CX2.isCx2Tab(app.codexTab)) { // 장비 · 시너지 · 증강 · 사이오닉 (src/ui/codex2.ts)
    body = CX2.codex2Body(app.codexTab, cxH());
  } else if (app.codexTab === 'manual') {
    body = codexManual();
  } else if (app.codexTab === 'ach') { // 업적: 메달 · 달성 날짜 · 바 진열장 고르기 (src/ui/achieve.ts)
    body = ACH.achCodexHtml();
  } else {
    body = `<dl class="stats big"><dt>의뢰</dt><dd>${m.runs}</dd><dt>의뢰 성공</dt><dd>${m.clears}</dd><dt>최고 도달 페이즈</dt><dd>${m.bestPhase}</dd><dt>해금된 위험 등급</dt><dd>${m.maxDiff}</dd><dt>절망 증강</dt><dd>${DESPAIRS.filter((d) => m.despair?.[d.id]?.clears).length}/${DESPAIRS.length} 성공</dd><dt>최고 절망 수치 성공</dt><dd>${OATH.bestAll()}</dd></dl>
      <h2>전장별</h2><div class="codex-list">${FIELDS.map((f) => { const r = m.fields[f.id]; return `<div class="codex-row"><div><b style="color:${f.color}">${f.icon} ${esc(f.name)}</b><div class="small muted">${esc(f.region)}</div></div><div class="small mono">의뢰 ${r?.runs || 0} · 성공 ${r?.clears || 0}${r && r.bestDiff >= 0 ? ` · 최고 ${diffLabel(r.bestDiff)}` : ''}${OATH.oathBest(f.id)}</div></div>`; }).join('')}</div>
      <h2>절망 증강별</h2><p class="small muted">${esc(diffName(CFG.despair.from) || `위험 ${CFG.despair.from}`)} 의뢰에서 고른 절망 증강. 한 의뢰에 여러 개를 짊어지면 각각 셉니다.</p><div class="codex-list">${DESPAIRS.map((d) => { const r = m.despair?.[d.id]; return `<div class="codex-row"><div><b>${lineIcon(d.icon, 'li')} ${esc(d.name)}</b><div class="small muted">${esc(d.desc())}</div></div><div class="small mono">의뢰 ${r?.runs || 0} · 성공 ${r?.clears || 0}</div></div>`; }).join('')}</div>${BAR.barRecordsHtml()}`;
  }
  return `<main class="wrap codex"><div class="cx-top"><h1 class="f-title">도감 · 기록</h1><span class="muted small">이 브라우저에 저장됩니다.</span><button class="btn ghost small" data-a="codex-back">돌아가기</button></div>
    <nav class="cx-tabs" aria-label="도감 탭">${tabs}</nav>${body}</main>`;
}

// ───────────────────────── 튜토리얼 「당직 근무 중 승계」: 장면(미연시) · 안내 말풍선 진행
// 진행 위치는 run.tutorial.i (TUTORIAL_FLOW). 장면은 지도에서, 안내는 각 화면 조건(TIP_GATE)이 맞으면 띄운다.
// render() 끝과 0.3초 간격으로 tutSync() 를 불러 조건을 확인한다 (전투 시간 · 미연시 진행처럼 다시 그리지 않고 바뀌는 상태 때문)
const TUT_SLOT = 'tut';
const CAMP_SLOT = 'campaign'; // 캠페인 런 저장 칸 (일반 이어하기와 따로)
/** 저장된 튜토리얼 런 (타이틀 버튼: 이어서) */
function listTutSave(): { step: number } | null {
  const r = loadRun(TUT_SLOT);
  return r?.tutorial ? { step: r.step } : null;
}
const tutRun = () => (app.run?.tutorial && !app.run.over ? app.run : null);
let tutLock = false; // tutSync 재진입 방지
let tutPaused = false; // 안내 때문에 멈춘 전투
let tutEpi = false; // 종장 뒤 타이틀에서 마지막 안내를 띄울 차례
/** 전투 화면은 다시 그리면 전투 보드가 초기화되므로 그리지 않는다 (전투 중 상태는 뷰가 직접 갱신) */
const tutRender = () => { if (app.screen !== 'battle') render(); };

// 장면이 뜰 수 있는 최소 칸 (지도 화면 · 대기 창 없음)
const SCENE_STEP: Record<string, number> = { prologue: 0, ch1_intro: 0, ch1_after: 1, ch1b_intro: 1, ch2_intro: 2, ch3_intro: 4, ch3_recruit: 4, ch4_intro: 6, ch4_boss: 8, epilogue: 9 };
// 안내가 속한 칸: 이 칸을 지나쳤는데 (전투 화면 밖) 아직 안 띄웠으면 건너뛴다 (전투를 '결과로'로 넘긴 경우 등)
const TIP_STEP: Record<string, number> = { ch1_place: 0, ch1_battle: 0, ch1b_detail: 1, ch1b_battle: 1, ch2_map: 2, ch2_supply: 3, ch2_shop: 3, ch2_xp: 4, ch3_recruit: 5, ch3_equip: 5, ch3_emblem: 5, ch3_battle: 5, ch3_result: 5, ch4_map: 6, ch4_brief: 6, ch4_deploy: 6, ch4_event: 7, ch4_adversity: 7, ch4_boss: 8 };
/** 불러온 직후처럼 지도에 있으면 편성 화면으로 옮겨 띄우는 안내 */
const TIP_PREP = ['ch3_equip', 'ch3_emblem', 'ch4_deploy'];

const unitOf = (run: RunState, id: string) => run.units.find((u) => u.defId === id);
const q1 = (sel: string) => document.querySelector(sel);
const btT = () => app.view?.b.t ?? 0;
const inBattle = (t: number) => app.screen === 'battle' && !!app.view && !app.view.b.over && btT() >= t;
/** 편성 보드 위 아군 토큰 */
const prepTok = (run: RunState, id: string) => () => { const u = unitOf(run, id); return u ? q1(`.prep .board .u.side0[data-v="${u.uid}"]`) : null; };
/** 편성 보드 위 적 토큰 (적 id) */
const foeTok = (run: RunState, ...ids: string[]) => () => (run.node?.enc?.enemies || []).flatMap((s, i) => (ids.includes(s.defId) ? Array.from(document.querySelectorAll(`.prep .board .u.side1[data-v="${i}"]`)) : []));
/** 전투 보드 위 기물 (side 0 아군 기물 id · side 1 적 id, 비우면 그 편 전부) */
const bTok = (side: 0 | 1, ...ids: string[]) => () => (app.view?.b.units || []).filter((c) => c.side === side && !c.isSummon && c.alive && (!ids.length || ids.includes(c.defId)))
  .map((c) => q1(`#bboard .u[data-v="${c.id}"]`)).filter((x): x is Element => !!x);
const bPart = (part: string) => () => bTok(0)().map((e) => e.querySelector(part)).filter((x): x is Element => !!x);
/** 시너지 토큰 (넓은 화면은 왼쪽 패널, 좁은 화면은 상단 띠) */
const synTok = (id: string, sub = '') => [`.side.left .syn-tk:has([data-syn="${id}"])${sub}`, `.top-syns .syn-tk:has([data-syn="${id}"])${sub}`];
/** 결과 창 보상 줄 */
const rsLine = (re: RegExp) => () => Array.from(document.querySelectorAll('.rs-lines li')).filter((li) => re.test(li.textContent || ''));
/** 편성 보드 + 대기석 (끌어다 놓기 안내) */
const boardAnd = (...more: string[]) => () => ['.prep .board', ...more].map(q1).filter((x): x is Element => !!x);
function selUnit(run: RunState, id: string) {
  const u = unitOf(run, id);
  if (!u || (app.sel?.k === 'unit' && app.sel.uid === u.uid)) return;
  app.sel = { k: 'unit', uid: u.uid }; app.abilPop = null; app.statPop = false;
  tutRender();
}
function selFoe(run: RunState, id: string) {
  const i = (run.node?.enc?.enemies || []).findIndex((s) => s.defId === id);
  if (i < 0 || (app.sel?.k === 'enemy' && app.sel.i === i)) return;
  app.sel = { k: 'enemy', i }; app.abilPop = null;
  tutRender();
}
const hasGear = (run: RunState, re: RegExp) => run.units.some((u) => u.items.some((x) => !!x && re.test(x)));

/** 안내가 처음 뜨는 조건 (화면 · 노드 · 대기 창) */
const TIP_GATE: Record<string, (r: RunState) => boolean> = {
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
function tipSteps(key: string, run: RunState | null): Partial<CoachStep>[] {
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
      { target: '.modal.recruit', pend: true, need: true, until: () => r.pending[0]?.t !== 'recruit' },
      { target: '.modal.rankup .aug-list', pend: true, gate: () => r.pending[0]?.t === 'rankup' },
      { target: '.modal.rankup .ru-reroll', pend: true, gate: () => r.pending[0]?.t === 'rankup' },
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
function tutCoach(key: string, run: RunState | null) {
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
function tutResume() {
  if (!tutPaused) return;
  tutPaused = false;
  if (app.screen === 'battle' && app.paused) { app.paused = false; applySpeed(); }
}

function tutSync() {
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
function tutNext(run: RunState, key: string) {
  metaTutSeen(key);
  if (TUTORIAL_FLOW[run.tutorial!.i]?.[1] === key) run.tutorial!.i++;
}
function tutSceneDone(key: string) {
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
function tutTipsDone(key: string) {
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
function tutFinish(kind: 'done' | 'skipped') {
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
function tutAway() {
  if (coachKey()?.startsWith('tu:')) closeCoach();
  if (advKey()?.startsWith('tu:')) closeAdv();
  tutPaused = false;
}
setInterval(() => { if (app.run?.tutorial || tutEpi || coachKey()) tutSync(); }, 300);

/** 도감 · 교범: 튜토리얼에서 배운 용어 (장 · 담당 인물별). 아직 안 배운 항목은 ??? */
function codexManual() {
  const all = tutOver();
  const seen = new Set(tutMeta().seen || []);
  const open = (k: string) => all || seen.has(k);
  const n = GLOSSARY.reduce((s2, c) => s2 + c.entries.filter((e) => open(e.key)).length, 0);
  return `<p class="muted small">튜토리얼 「당직 근무」에서 배운 용어 <b>${n}</b> / ${GLOSSARY_COUNT}. ${all ? '' : '튜토리얼을 진행하면 항목이 열리고, 끝내거나 건너뛰면 모두 열립니다.'}</p>`
    + GLOSSARY.map((c) => {
      const d = UNIT_BY_ID[c.who];
      return `<section class="gl-ch" style="--c:${speakerOf(c.who).color}"><h2 class="gl-h">${d ? sprite(d, 'spr gl-pt') : ''}<span>${esc(c.title)}</span><small class="muted">${esc(d?.name || c.who)}</small></h2>
        <div class="gl-list">${c.entries.map((e) => (open(e.key)
          ? `<div class="gl-row"><b>${esc(e.term)}</b><p class="small">${ic(esc(e.text))}</p></div>`
          : '<div class="gl-row locked"><b>???</b><p class="small muted">아직 배우지 않은 항목입니다.</p></div>')).join('')}</div></section>`;
    }).join('');
}

// ───────────────────────── 액션
let codexFrom = ''; // 도감을 연 화면 (바에서 열었으면 바로 돌아간다)
function act(a: string, v: string) {
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
      closeCoach(); tutEpi = false;
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
      app.poolRerolls--; app.starters = []; app.pool = starterPool(new Rng((Date.now() ^ (Math.random() * 1e9)) | 0), app.introField, [], app.pool); carX = null; app.cardOpen = null;
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
        if (r.ok && tu && isInjector(k) && app.screen === 'prep') { injHold = tu.rank > r0; requestAnimationFrame(() => injectFx(tu.uid, r0, x0, tu.xp, tu.rank)); } else toast(r.msg);
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
      if (!run || run.pending.length) return;
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
    case 'pil-card': if (run) { const [i, uid] = v.split(':'); const e = R.pilgrimCard(run, +i, uid); if (e) toast(e); persist(); } break;
    case 'pil-relic': if (run) { const e = R.pilgrimRelic(run, +v); if (e) toast(e); else toast('성유물을 보관함에 넣었습니다'); persist(); } break;
    case 'relic-pick': app.relicPick = app.relicPick === v ? null : v; break;
    case 'relic-equip': if (run) { const [uid, id] = v.split(':'); const e = R.equipRelic(run, uid, id); if (e) toast(e); persist(); } break;
    case 'relic-enh': if (run) { const e = R.enhanceRelic(run, v); if (e) toast(e); else toast('다음 전투의 신권 대행이 강화됩니다 (계수 ×3)'); persist(); } break;
    case 'pilgrim-done': if (run?.pending.some((x) => x.t === 'pilgrim')) { run.pending = run.pending.filter((x) => x.t !== 'pilgrim'); persist(); } break;
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
    case 'ret-bar': // 런 결과 → 에란테스 바: 태블릿 화면에서 줌 아웃해 테이블로 빠져나온 뒤 바로 (ui/contract.ts contractReturn)
      if (app.view) { app.view.destroy(); app.view = null; }
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
    case 'cx2': { const r = CX2.codex2Act(v); if (r.tab) app.codexTab = r.tab as typeof app.codexTab; if (r.unit) app.codexSel = r.unit; app.abilPop = null; cxScroll = r.scroll; if (r.tab) window.scrollTo(0, 0); break; }
    case 'codex-group': app.codexGroup = v as typeof app.codexGroup; break;
    case 'codex-sel': if (app.codexSel === v) CX2.CX2.focus = v; app.codexSel = app.codexSel === v ? null : v; app.abilPop = null; cxScroll = true; break;
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
        greatBusy = false;
        if (run.pending[0] !== p || !R.allocRank(run, p, app.picks)) return;
        app.picks = [];
        if (p.options && !p.options.length) run.pending.shift(); // 이번 등급은 능력치만
        persist();
        render();
      };
      if (!p.great) { finish(); return; }
      // 대성공: 창을 새로 띄우지 않고, 고른 능력치 칸에만 황금 광 · 상승값 2배 표시 · '대성공' 제목을 잠깐 보여 준 뒤 그대로 확정
      greatBusy = true;
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

function equipSel(run: RunState, idx: number, uid: string): Sel {
  const e = R.equip(run, idx, uid);
  if (e) toast(e); else { toast('장착했습니다.'); persist(); }
  return { k: 'unit', uid };
}

/** 장비 설명의 메이저 능력치 이름을 아이콘으로 */
const statIc = (html: string) => MAJORS.reduce((h, m) => h.split(MAJOR_NAME[m]).join(majorIcon(m)), html);
/** 장비 설명 말풍선 (짧게 누르기). 다음 누르기에 닫힌다. 색은 장비 등급 */
function itemTip(el: HTMLElement, key: string) {
  document.querySelector('.item-tip')?.remove();
  const [uid, slot] = key.split(':');
  const u = app.run?.units.find((x) => x.uid === uid);
  const id = u ? (+slot < 0 ? u.mod : u.items[+slot]) : null;
  if (!id) return;
  const it = itemInfo(id);
  const tier = tierKey(id);
  const TIER_NAME: Record<string, string> = { C: '재료', G: '고급', A: '희귀', L: '전설', M: '개조부품', U: '고유' };
  const tip = document.createElement('div');
  tip.className = `item-tip tip-${tier}`;
  tip.innerHTML = `<span class="tip-tier">${TIER_NAME[tier] || ''}</span><b>${esc(it.name)}</b><span>${statIc(esc(it.desc))}</span>
    <div class="tip-foot"><small>길게 눌러 다른 기물에게 옮기기${app.run && R.solventNeed(app.run, uid, +slot) ? ` (${esc(CONSUMABLES.K_strip.name)} 1개)` : ''}</small>${isLocked(id) ? '' : '<button class="btn tiny" type="button">해제</button>'}</div>`;
  tip.querySelector('button')?.addEventListener('click', () => { tip.remove(); act('unequip', key); });
  tip.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(tip);
  const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
  const top = r.top - tr.height - 6 < 8 ? r.bottom + 6 : r.top - tr.height - 6;
  tip.style.left = `${left + scrollX}px`; tip.style.top = `${top + scrollY}px`;
  setTimeout(() => window.addEventListener('pointerdown', () => tip.remove(), { once: true }), 0);
}

// ───────────────────────── 드래그 앤 드롭 (마우스 + 터치 공용)
/** data-hold 요소는 길게 눌러야(HOLD_MS) 끌기가 시작된다. 그 전에 움직이면 끌기 취소 */
const HOLD_MS = 220;
let drag: { src: string; x: number; y: number; ghost: HTMLElement | null; el: HTMLElement; t0: number; hold: boolean; marked?: boolean } | null = null;
let suppressClick = false;
/** 끄는 동안 손가락 · 커서가 화면 위 · 아래 가장자리에 머물면 창을 스크롤한다 (휴대폰 세로: 아래쪽 기물 상세의 장비를 보드 · 보관함까지 끌고 올라가기). 보드에서 끄는 것은 페이지를 굴리지 않는다 (아래 dragAutoScroll) */
const DRAG_EDGE = 56, DRAG_SCROLL_MAX = 18, VP_EDGE = 36; // VP_EDGE = 확대한 보드 창 가장자리 폭
let dragPt: { x: number; y: number } | null = null, dragScrollRaf = 0;
function dragAutoScroll() {
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
let wallDrag: null | { i: number; side: '' | 't' | 'r' | 'b' | 'l'; d0: Device; kx: number; ky: number; x: number; y: number; box: HTMLElement; board: HTMLElement; moved: boolean; cand: Device | null; err: string | null } = null;
/** 편성 보드 위 화면 점 → 전장 칸 (확대 · 스크롤 · 가로 지형 모두: 보드의 실제 화면 사각형에서 화면 칸을 구해 전장 좌표로 되짚는다) */
const wallCellAt = (board: HTMLElement, cx: number, cy: number) => {
  const r = board.getBoundingClientRect(), g = runGeo(app.run!), f = prepFrame(g, +board.dataset.ex!);
  return fromScr(g, Math.floor(((cx - r.left) / r.width) * f.bw) + f.ox, Math.floor(((cy - r.top) / r.height) * f.bh) + f.oy);
};
/** 끄는 위치 → 새 바리케이드 모양: 옮기기는 잡은 칸 기준, 늘리기는 반대쪽 끝을 고정하고 끄는 쪽 끝이 그 칸까지 (축은 화살표 방향) */
function wallShape(w: NonNullable<typeof wallDrag>, cx: number, cy: number): Device {
  const d = w.d0, n = d.n || 1, M = DEV.wall.maxN;
  if (!w.side) return { ...d, x: cx - w.kx, y: cy - w.ky };
  const horiz = w.side === 'l' || w.side === 'r';
  const a0 = horiz ? d.x : d.y, a1 = a0 + n - 1; // 화살표는 바리케이드 축 방향에만 있다 (1칸이면 네 방향)
  const p = horiz ? cx : cy;
  let lo = a0, hi = a1;
  if (w.side === 'r' || w.side === 'b') hi = Math.max(lo, Math.min(lo + M - 1, p)); else lo = Math.min(hi, Math.max(hi - M + 1, p));
  return { ...d, x: horiz ? lo : d.x, y: horiz ? d.y : lo, dir: horiz ? 'h' : 'v', n: hi - lo + 1 };
}
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
  if (pi >= 0) devPv = null;
  const tgt = under?.closest('[data-drop]') as HTMLElement | null;
  if (tgt) onDrop(d.src, tgt.dataset.drop!);
  else if (pi >= 0) render(); // 끄는 동안 붙인 미리보기 · 놓을 수 있는 칸 표시 지우기
  else if (d.marked && app.run && app.screen === 'prep') toolMark(app.run); // 끄는 동안의 흐림 → 고른 도구 기준 (없으면 지움)
});
window.addEventListener('pointercancel', () => {
  const pi = drag?.ghost ? dragPlaceIdx() : -1, marked = !!drag?.marked;
  if (drag?.ghost) { drag.ghost.remove(); drag.el.classList.remove('dragging'); }
  drag = null;
  if (pi >= 0) { devPv = null; render(); } else if (marked && app.run && app.screen === 'prep') toolMark(app.run);
});
/** 보관함에서 끄는 것이 배치형 소모품이면 그 보관함 순번 (편성 화면 · 전투 조우 중), 아니면 -1 */
function dragPlaceIdx() {
  const run = app.run, m = drag ? /^item:(\d+)$/.exec(drag.src) : null;
  return m && app.screen === 'prep' && run?.node?.enc && isPlaceable(run.inventory[+m[1]]) ? +m[1] : -1;
}
/** 배치형 소모품을 끄는 동안: 놓을 수 있는 칸 표시 (처음 한 번) + 가리킨 칸 미리보기 */
function dragPv(cx: number, cy: number) {
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
/** 배치형 소모품을 고른 채 편성 보드를 누르면: 누른 자리의 칸에 놓기 (기물 · 적 · 지형 · 장치 위를 눌러도 같은 칸 판정, 막히면 칸 옆에 이유) */
function boardPlaceTap(ev: MouseEvent) {
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

function onDrop(src: string, dst: string) {
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
const TURRET_NO_GEAR = '포탑에는 장비를 장착할 수 없습니다 (포탑 장비는 엔지니어 단계에서 고릅니다).';
/** 감시 포탑 끌어 옮기기: 기물이 없는 아군 칸 · 가장자리 칸으로만. 다른 포탑 위면 자리 교환. 판매 · 대기석 · 장비는 불가 */
function turretDrop(run: RunState, n: number, i: number, dk: string, dv: string[]) {
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

// ───────────────────────── 단축키
const CONFIRM_ACTS = ['alloc-ok', 'pick-aug', 'after-battle', 'field-ok', 'notice-ok', 'skip-aug', 'menu-close', 'pick-recruit', 'supply-all', 'supply-done'];
function clickFirst(sel: string) {
  const el = Array.from(document.querySelectorAll<HTMLButtonElement>(sel)).find((b) => !b.disabled);
  if (!el) return false;
  el.click();
  return true;
}
/** 단축키 표: 키 처리(keydown) · 버튼 모서리 키캡(keyHints) · 메뉴의 단축키 목록(keyList)이 모두 이 표를 읽는다 */
type KeyScope = 'modal' | 'battle' | 'prep' | 'map' | 'newrun' | 'any';
interface HotKey {
  scope: KeyScope;
  /** e.key (글자는 소문자) */
  keys: string[];
  /** 키캡 글자. '#' = 숫자키 (선택지 · 노드 · 속도 순서) */
  cap: string;
  /** 누를 버튼: 앞에서부터 찾아 처음 누를 수 있는 것 (키캡도 그 버튼에) */
  sel: string[];
  /** 버튼을 누르는 대신 할 일 (n = 숫자키). 이때 키캡은 sel 의 버튼 모두에 */
  run?: (n: number) => void;
  /** 누를 버튼이 없어도 브라우저 기본 동작(스크롤 등)을 막는다 */
  always?: boolean;
  desc: string;
}
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** 창의 선택지 (숫자키 순서). 영입은 카드가 선택지 ('영입' 버튼은 확정) */
const PICK_SEL = '[data-a^="pick-"]:not(.aug-ok):not([data-a="pick-recruit"]), [data-a="event-choice"], [data-a="alloc-pick"], .rc-track .pcard[data-a="rc-tap"]';
const HOTKEYS: HotKey[] = [
  { scope: 'any', keys: ['d'], cap: 'D', sel: ['[data-a="toggle-detail"]'], run: () => act('toggle-detail', ''), desc: '상세 보기 켜기 · 끄기' },
  { scope: 'modal', keys: DIGITS, cap: '#', sel: [PICK_SEL], desc: '선택지 고르기 (증강 · 전공 · 영입은 숫자키로 고르면 바로 확정)' },
  { scope: 'modal', keys: ['Enter', ' '], cap: 'Enter', sel: [CONFIRM_ACTS.map((a) => `.modal [data-a="${a}"]`).join(', ')], desc: '확인 · 계속' },
  { scope: 'modal', keys: ['r'], cap: 'R', sel: ['.modal [data-a="reroll"], .modal [data-a="reroll-privilege"], .modal [data-a="reroll-despair"]'], desc: '새로고침' },
  { scope: 'map', keys: DIGITS, cap: '#', sel: ['.tl-step.cur .tl-node'], desc: '다음 노드 고르기' },
  { scope: 'map', keys: ['Enter', ' '], cap: 'Enter', sel: ['.tl-go'], desc: '노드 진입' },
  { scope: 'map', keys: ['m'], cap: 'M', sel: [], run: () => act('manage', ''), desc: '편성 관리 (단추 없이 키로만)' },
  { scope: 'newrun', keys: ['r'], cap: 'R', sel: ['[data-a="reroll-starters"]'], desc: '후보 새로고침' },
  { scope: 'prep', keys: [' ', 'Enter'], cap: 'Space', sel: ['[data-a="fight"]'], desc: '전투 시작' },
  { scope: 'prep', keys: ['a'], cap: 'A', sel: ['[data-a="autofill"]'], run: () => act('autofill', ''), desc: '자동 배치' },
  { scope: 'battle', keys: DIGITS.slice(0, SPEEDS.length), cap: '#', sel: ['.speed [data-a="speed"]'], run: (n) => act('speed', String(SPEEDS[n - 1])), desc: `속도 ${SPEEDS.join(' · ')}배` },
  { scope: 'battle', keys: ['Enter'], cap: 'Enter', sel: ['[data-a="after-battle"]', '[data-a="skip"]'], always: true, desc: '결과로 · 결과 창 닫기' },
  { scope: 'battle', keys: [' ', 'p'], cap: 'Space', sel: ['[data-a="after-battle"]', '.speed [data-a="pause"]'], always: true, desc: '일시 정지 · 계속' },
];
/** 지금 단축키가 듣는 곳: 창(전투 화면 밖) · 전투 · 편성 · 지도 */
function keyScope(): { scope: KeyScope; box: ParentNode } | null {
  const modal = document.querySelector('.modal-bg .modal');
  if (modal && app.screen !== 'battle') return { scope: 'modal', box: modal };
  return app.screen === 'battle' || app.screen === 'prep' || app.screen === 'map' || app.screen === 'newrun' ? { scope: app.screen, box: document } : null;
}
function firstOn(sels: string[]) {
  for (const s of sels) { const el = Array.from(document.querySelectorAll<HTMLButtonElement>(s)).find((b) => !b.disabled); if (el) return el; }
  return null;
}
/** 버튼 모서리 키캡: 지금 화면에서 단축키가 누를 버튼에 data-key (CSS ::before 가 그린다). 설정에서 끄면 달지 않고, 터치 화면은 CSS 가 숨긴다 */
function keyHints() {
  root.querySelectorAll('[data-key]').forEach((x) => x.removeAttribute('data-key'));
  if (!uxPrefs().keyHints || (typeof matchMedia !== 'undefined' && matchMedia('(hover: none), (pointer: coarse)').matches)) return;
  const ks = keyScope();
  const mark = (el: Element | null | undefined, cap: string) => { if (el instanceof HTMLElement && !el.dataset.key && !el.querySelector('kbd')) el.dataset.key = cap; };
  for (const h of HOTKEYS) {
    if (h.scope !== 'any' && h.scope !== ks?.scope) continue;
    if (h.cap === '#') Array.from((ks?.box || document).querySelectorAll(h.sel[0])).slice(0, h.keys.length).forEach((el, i) => mark(el, String(i + 1)));
    else if (h.run) h.sel.forEach((s) => document.querySelectorAll(s).forEach((el) => mark(el, h.cap)));
    else mark(firstOn(h.sel), h.cap);
  }
}
/** 메뉴의 단축키 목록 (단축키 표에서) */
function keyList() {
  const NAME: Record<KeyScope, string> = { modal: '선택 창', map: '지도', prep: '편성', battle: '전투', newrun: '계약 기물 선택', any: '어디서나' };
  const cap = (k: string) => `<kbd>${k === ' ' ? 'Space' : k === 'Escape' ? 'Esc' : k.length === 1 ? k.toUpperCase() : k}</kbd>`;
  const keys = (h: HotKey) => (h.cap === '#' ? `${cap(h.keys[0])}~${cap(h.keys[h.keys.length - 1])}` : h.keys.map(cap).join(' '));
  return `<ul class="keys small">${(['modal', 'newrun', 'map', 'prep', 'battle', 'any'] as const).map((s) => `<li><b>${NAME[s]}</b> ${[...HOTKEYS.filter((h) => h.scope === s).map((h) => `${keys(h)} ${esc(h.desc)}`), ...(s === 'any' ? [`${cap('Escape')} 닫기 · 선택 해제`] : [])].join(' / ')}</li>`).join('')}</ul>`;
}

// ───────────────────────── 반복 줄이기 설정 (이 브라우저에만): 결과 창 자동 닫기(초, 0 = 끔) · 편성 그대로 바로 전투 · 단축키 키캡. 기본값은 모두 꺼짐 (키캡만 켜짐)
const AUTO_RESULT = [0, 3, 5, 8];
function uxPrefs() {
  const p: Record<string, unknown> = loadPrefs();
  return { autoResult: AUTO_RESULT.includes(p.autoResult as number) ? (p.autoResult as number) : 0, autoFight: p.autoFight === true, keyHints: p.keyHints !== false };
}
function uxSettings() {
  const u = uxPrefs();
  return `<h3>진행 · 단축키</h3>
      <div class="pref pref-wrap"><span><b>결과 창 자동으로 닫기</b><br><span class="muted small">전투 결과 창을 정한 시간 뒤 저절로 닫습니다. 창을 누르거나 스크롤하면 멈춥니다. 런이 끝난 결과는 닫지 않고, 보상 · 증강 · 영입 · 상점처럼 고를 것이 있는 창은 언제나 기다립니다.</span></span>
        <span class="seg">${AUTO_RESULT.map((s) => `<button class="btn tiny ${u.autoResult === s ? 'on' : ''}" data-a="pref-autores" data-v="${s}" aria-pressed="${u.autoResult === s}">${s ? `${s}초` : '끄기'}</button>`).join('')}</span></div>
      <label class="pref"><input type="checkbox" data-a="pref-autofight" ${u.autoFight ? 'checked' : ''}><span><b>편성 그대로 바로 전투</b><br><span class="muted small">지도에서 일반 전투 · 역경에 진입하면 편성 화면을 건너뛰고 지금 편성으로 바로 전투를 시작합니다. 보스 · 도전 전투, 빈 자리에 넣을 대기 기물이 있을 때, 고를 것이 남아 있을 때는 편성 화면에서 멈춥니다.</span></span></label>
      <label class="pref"><input type="checkbox" data-a="pref-keyhints" ${u.keyHints ? 'checked' : ''}><span><b>단축키 표시</b><br><span class="muted small">버튼 모서리에 키보드 단축키(Space · Enter · 1 등)를 작게 표시합니다. 터치 화면에서는 표시하지 않습니다. 전체 목록은 메뉴 탭에 있습니다.</span></span></label>`;
}
/** 편성 그대로 바로 전투: 일반 · 역경만, 고를 것이 없고 빈 자리에 넣을 대기 기물이 없을 때 */
function autoFightOk(run: RunState) {
  const t = run.node?.type;
  if (!uxPrefs().autoFight || run.tutorial || run.pending.length || app.screen !== 'prep' || !run.node?.enc || (t !== 'battle' && t !== 'adversity')) return false;
  const dep = deployed(run);
  return dep.length > 0 && !(R.deployCap(run) > dep.length && run.units.some((u) => !u.pos && R.canDeploy(run, u)));
}
/** 결과 창: 다시 그리지 않고 끼워 넣으므로 뜨는 순간을 지켜보다가 키캡을 다시 달고 자동 닫기를 건다 */
let autoResFor: unknown = null;
let autoResT = 0;
const resultObs = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { if (app.summary && app.summary !== autoResFor && root.querySelector('.modal.result')) resultShown(); });
function resultShown() {
  keyHints();
  const s = app.summary, box = root.querySelector<HTMLElement>('.modal.result');
  if (!s || !box || autoResFor === s) return;
  autoResFor = s;
  resultObs?.disconnect();
  const sec = uxPrefs().autoResult;
  const btn = box.querySelector<HTMLButtonElement>('[data-a="after-battle"]');
  if (!sec || !btn || s.gameOver || app.run?.tutorial) return; // 런이 끝난 결과 · 튜토리얼은 기다린다
  const tag = document.createElement('span');
  tag.className = 'auto-cd';
  btn.before(tag);
  let left = sec;
  const show = () => { tag.textContent = `${left}초 뒤 자동으로 닫힘`; };
  show();
  clearInterval(autoResT);
  autoResT = window.setInterval(() => {
    if (!btn.isConnected || app.summary !== s) { clearInterval(autoResT); autoResT = 0; return; }
    if (--left > 0) { show(); return; }
    clearInterval(autoResT); autoResT = 0;
    btn.click();
  }, 1000);
  const hold = () => { if (!autoResT) return; clearInterval(autoResT); autoResT = 0; tag.textContent = '자동 닫기 멈춤'; };
  for (const ev of ['pointerdown', 'wheel', 'touchstart'] as const) box.addEventListener(ev, hold, { once: true, passive: true });
}
/** 다시 그린 뒤: 키캡 · 결과 창 감시 · 시너지 강조 되살리기 */
function uxAfterRender() {
  document.querySelector('.tl-pop')?.remove();
  keyHints();
  resultObs?.disconnect();
  if (app.screen === 'battle') {
    if (root.querySelector('.modal.result')) resultShown();
    else resultObs?.observe(root, { childList: true, subtree: true });
  }
  if (synHl && synHl.how !== 'hover') synFocus(synHl.id, synHl.how); else synHl = null;
  tlOver();
}
/** 지도 트랙이 넘쳐 가로로 밀리면 보스 칸을 오른쪽 끝에 붙인다 (.tl.over) */
function tlOver() {
  const tl = root.querySelector<HTMLElement>('.tl');
  if (tl) tl.classList.toggle('over', tl.scrollWidth > tl.clientWidth + 1);
}
addEventListener('resize', tlOver, { passive: true });

// ───────────────────────── 시너지 강조: 시너지 목록에 마우스를 올리면(누르면 시너지 창이 열려 있는 동안) 보드 · 대기열 · 파티에서 그 시너지 기물만 밝게
// 시너지 창의 '보드에서 강조' 버튼: 창을 닫고 강조만 남긴다 (터치 화면 · 창이 보드를 가릴 때). 다음에 어디든 누르면 풀린다
let synHl: { id: string; how: 'hover' | 'pin' | 'stick' } | null = null;
function synFocus(id: string | null, how: 'hover' | 'pin' | 'stick' = 'hover') {
  synHl = id ? { id, how } : null;
  root.querySelectorAll<HTMLElement>('.syn-hl').forEach((x) => { x.classList.remove('syn-hl'); x.style.removeProperty('--c'); });
  root.querySelectorAll('.syn-tk.syn-on').forEach((x) => x.classList.remove('syn-on'));
  const main = root.querySelector('main');
  const on = !!id && !!main?.querySelector('[data-syns]');
  main?.classList.toggle('syn-focus', on);
  if (!id || !on) return;
  const c = SYN_BY_ID[id as SynergyId]?.color;
  root.querySelectorAll<HTMLElement>('[data-syns]').forEach((el) => {
    if (!el.dataset.syns!.split(' ').includes(id)) return;
    el.classList.add('syn-hl');
    if (c) el.style.setProperty('--c', c);
  });
  root.querySelectorAll<HTMLElement>('.syn-tk [data-syn]').forEach((b) => { if (b.dataset.syn === id) b.closest('.syn-tk')!.classList.add('syn-on'); });
}
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

// ───────────────────────── 지도 타임라인: 노드를 누르면 유형 · 간단한 설명 팝오버 (터치 포함). 바깥을 누르거나 스크롤하면 닫힌다
function tlPop(el: HTMLElement) {
  document.querySelector('.tl-pop')?.remove();
  const run = app.run, i = +(el.dataset.step ?? -1), o = el.dataset.node as NodeType | undefined;
  if (!run || i < 0 || !o || !NODE_NAME[o]) return;
  const far = i - run.step;
  const boss = o === 'boss' ? phaseBoss(run) : undefined;
  const who = o === 'recruit' && far < 0 && run.nodeUnits?.[i] ? UNIT_BY_ID[run.nodeUnits[i]]?.name : '';
  const tip = document.createElement('div');
  tip.className = `tl-pop n-${o}`;
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = `<b>${NODE_ICON[o]}${esc(NODE_NAME[o])}${who ? ` · ${esc(who)}` : ''}</b><small>${i + 1}번째 칸 · ${far < 0 ? '지난 칸' : far ? `${far}칸 뒤` : '지금'}</small>${boss ? `<span class="tp-boss">${esc(boss.name)}</span>` : ''}<span>${ic(esc(nodeHint(o)))}</span>`;
  document.body.appendChild(tip);
  const r = el.getBoundingClientRect(), w = Math.min(260, innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.bottom + 8 + tip.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - tip.offsetHeight - 8) : r.bottom + 8}px`;
}
root.addEventListener('click', (e) => {
  const n = (e.target as HTMLElement).closest<HTMLElement>('.tl .tl-node');
  if (!n) return;
  const k = `.tl-node[data-step="${n.dataset.step}"][data-node="${n.dataset.node}"]`;
  setTimeout(() => { const el = root.querySelector<HTMLElement>(k); if (el) tlPop(el); }, 0); // 지금 칸 노드는 고르기(다시 그림) 뒤에 연다
});
document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('.tl-pop')) document.querySelector('.tl-pop')?.remove(); }, true);
addEventListener('scroll', () => document.querySelector('.tl-pop')?.remove(), { passive: true, capture: true });
// ───────────────────────── 키워드 설명 팝업 (PC 호버 · 모바일 탭)
let kwPinned: HTMLElement | null = null;
function showKw(el: HTMLElement) {
  const k = el.dataset.kw!;
  const g = GLOSS[k] || (el.dataset.td ? { name: el.dataset.tt || '', desc: el.dataset.td } : undefined);
  if (!g) return;
  let tip = document.querySelector<HTMLElement>('.kw-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'kw-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  tip.innerHTML = `<b>${GLOSS[k] ? AB.kwIcon(k) : el.querySelector('.li')?.outerHTML || ''}${esc(g.name)}</b><span>${esc(g.desc)}</span>`;
  const r = el.getBoundingClientRect();
  const w = Math.min(260, innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const below = r.bottom + 6;
  tip.style.top = `${below + tip.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - tip.offsetHeight - 6) : below}px`;
}
function hideKw() { document.querySelector('.kw-tip')?.remove(); kwPinned = null; if (synHl?.how === 'pin') synFocus(null); }
/** 시너지 상세 팝업: 마름모 옆에 띄운다 */
function showSyn(el: HTMLElement) {
  hideKw();
  const tip = document.createElement('div');
  tip.className = 'kw-tip syn-pop';
  tip.style.setProperty('--c', SYN_BY_ID[el.dataset.syn as SynergyId]?.color || 'var(--accent)');
  tip.innerHTML = synPopHtml(el.dataset.syn!);
  document.body.appendChild(tip);
  placeSyn(tip, el);
  tip.querySelector('details.sp-more')?.addEventListener('toggle', (e) => { if (app.run) synMore = (e.target as HTMLDetailsElement).open; placeSyn(tip, el); });
  kwPinned = el;
  synFocus(el.dataset.syn!, 'pin');
}
function placeSyn(tip: HTMLElement, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const w = Math.min(300, innerWidth - 16);
  tip.style.width = `${w}px`;
  const right = r.right + 8 + w <= innerWidth - 8;
  tip.style.left = `${right ? r.right + 8 : Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const top = right ? r.top - 4 : r.bottom + 6;
  tip.style.top = `${Math.max(8, Math.min(top, innerHeight - tip.offsetHeight - 8))}px`;
}
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
  showKw(el); kwPinned = el;
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

// 전체 상세 팝업: 능력 상세는 스크롤하거나 바깥을 누르면 닫힘 (다시 그리지 않고 지움)
let restoredAt = 0;
function closeUmPop() {
  if (!app.bigUnit || !app.abilPop) return;
  app.abilPop = null;
  root.querySelector('.um-pop')?.remove();
  root.querySelectorAll('.um .ab-click.on').forEach((x) => x.classList.remove('on'));
}
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
    app.starters = []; app.screen = 'newrun'; app.menu = null; carX = null; app.cardOpen = null;
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
  render();
}
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? null);
void activeTiers;
