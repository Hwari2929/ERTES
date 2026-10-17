import { CFG, encDmgMult, phaseAmpMult, phaseHpMult } from './config';
import { AUG_BY_ID, augDesc } from './data/augments';
import { ENEMIES, ENEMY_BY_ID, type EnemyDef } from './data/enemies';
import { ENEMY_DESC } from './data/enemyText';
import { DIFF_PRESETS, DIFFS, MAX_DIFF, diffAddCount, diffAddEvery, diffAddRule, diffLabel, diffName, effDiffLabel, runHeat } from './data/difficulty';
import { CATWHEEL, DESPAIR_BY_ID, DESPAIRS, despairDiff, despairPhases, despairsOf, type DespairDef } from './data/despair';
import { BOONS, EVENT_BY_ID, EVENTS } from './data/events';
import { STORIES } from './data/stories';
import { FIELDS, fieldOf } from './data/battlefields';
import { BLESSING_BY_ID, GLOBAL_BY_ID } from './data/globals';
import { combine, CONSUMABLES, emblemOf, isConsumable, isEmblem, isLegendConsumable, isLocked, isMod, isOccultMod, isTurretGear, itemInfo, TURRET_GEAR, turretSlots } from './data/items';
import { aceTargetUid, rankTitle, SYN_BY_ID, SYNERGIES, TITLE_NAME, tierOf, VOYAGE_SPECIAL } from './data/synergies';
import { RECRUITABLE, UNIT_BY_ID, UNITS, type UnitDef } from './data/units';
import { withEmblemSummon } from './data/emblems';
import { DIVINE_ACT, FAITH_DEF, MAJOR_AUGS, MINOR_TRAIT_GROW, recMajors } from './data/rework';
import { type AugList, cantripView, passiveView, SCHOOL_LINE, transformPreview } from './data/psiinfo';
import { augReqState } from './data/augreq';
import { GROUPS, SCHOOL_BY_ID, SCHOOL_PASSIVES, UNIT_GROUP, augMark, psiAugId, schoolOf, type SchoolId } from './data/schools';
import { BRIEF, PSI_BRIEF, unitBlurb } from './data/brief';
import { ABIL, augAbilText, ENEMY_ABIL, GLOSS } from './data/abiltext';
import * as AB from './ui/abil';
import * as CX2 from './ui/codex2';
import * as BAR from './ui/bar';
import * as ACH from './ui/achieve';
import * as TFX from './ui/themefx';
import {
  activeTiers, ALLY_Y0, ALLY_Y1, boardDims, buildAlly, buildBattle, buildEnemy, chrTier, deployed, kingCell, kingOn, kingState, enemyBaseMoveSpd, enemyCell, layout, memberships, PAD, synergyCounts, toPos, totalMajors, turretCells, turretCount, turretSavePos, TURRET_PAL, unitEffects, ZONE,
} from './engine/build';
import { Battle, controlNames, type CUnit, PROV, provMult, REASON_HI, REASON_LO, type Status, STATUS_NAME, TEND_NAME, zocHoldFormula, zocHoldOf, zocRule, zocShort } from './engine/combat';
import * as R from './engine/run';
import { CAUSAL, causalGain, causalLeft, causalNeed, causalStage, gearScore, KING, KING_GEAR, KING_GEAR_NAME, KING_MS_TEXT, kingStageText } from './data/chungra';
import { BGS, NPCS, PC_NAME, type Beat } from './data/scene';
import { Rng } from './rng';
import { type Category, CATEGORY_NAME, CATEGORY_RULE, categoryOf, type CType, type Elem, type TType, type DmgTag, type StatKey, type Weapon, CTYPE_NAME, ELEM_NAME, type FaithId, FAITH_NAME, FAITHS, MAJOR_NAME, TTYPE_NAME, MAJORS, NODE_NAME, type Major, type NodeType, type Pending, type RunState, type SynergyId, type UnitState } from './types';
import { encounterMatchup, matchupLines, matchupShort, schoolWarnings } from './ui/matchup';
import { computeStats, makeSummons, type SummonMade } from './engine/build';
import { gradeCards } from './ui/revealfx';
import { BattleView, DEATH_STYLES, fmt, FX, FX_DEFAULT, isDeathStyle, previewDeath, type DeathStyle, type MotionPreset, type UltCut } from './ui/battleview';
import { ULTS } from './data/ults';
import { VOICE, voicePick } from './data/voicelines';
import { DEFAULT_RELIC, RELIC_BY_ID } from './data/relics';
import { deleteSave, exportCode, importCode, listSaves, loadRun, saveRun, SLOT_NAME } from './ui/save';
import { loadMeta, metaBarMvp, metaBattle, metaClear, metaEvent, metaRunEnd, metaTutEnd, metaTutSeen, tutMeta, tutOver } from './ui/meta';
import { bgURL, hasPortrait, iconURL, loadArt, prefetchArt, standImg, standURL } from './ui/portraits';
import { advKey, closeAdv, playAdv } from './ui/adv';
import * as SND from './ui/sound';
import * as OATH from './ui/oath';
import * as REPORT from './ui/report';
import { recEnd, recReroll } from './engine/report';
import { ABIL_ICONS } from './ui/abilicons.gen';
import { augKey, lineIcon, synIcon, typeIcon } from './ui/synicons';
import { closeCoach, coachKey, startCoach, type CoachStep } from './ui/coach';
import { TUTORIAL_FLOW, TUTORIAL_SCENES, TUTORIAL_TIPS } from './data/scenes/tutorial';
import { fieldIntroPending } from './data/scenes/fields';
import { GLOSSARY, GLOSSARY_COUNT } from './data/glossary';
import { NODE_DESC } from './data/nodes';
import * as TUT from './engine/tutorial';
import { fieldSyn, starterFavNeed, starterPool } from './engine/starters';

// 편의 설정 (이 브라우저에만 저장): 전투 속도, 진형 속도 등
const PREF_KEY = 'errantes.prefs.v1';
/** 전투 배속 (단축키 1~6, Space 정지) */
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
function loadPrefs(): { speed?: number; detail?: boolean; slowDetail?: boolean; zoomOut?: boolean; fxMs?: number; skillMs?: number; motion?: MotionPreset; death?: DeathStyle; ultCut?: UltCut; uiTheme?: string; uiFx?: string } {
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

type Screen = 'title' | 'intro' | 'diffsel' | 'newrun' | 'map' | 'prep' | 'battle' | 'shop' | 'news' | 'invest' | 'over' | 'codex' | 'bar' | 'oath';
type Sel = { k: 'unit'; uid: string } | { k: 'turret'; i: number } | { k: 'king' } | { k: 'item'; idx: number } | { k: 'relic'; id: string } | { k: 'enemy'; i: number } | { k: 'def'; id: string } | null;

const app = {
  screen: 'title' as Screen,
  tacOpen: false, // 편성 표: 전술 위력 내역 펼침
  mapTab: 0, // 메인 화면 우측 패널 탭: 0 파티 · 1 환경 · 2 기록
  musterSel: [] as string[], // 지정 소집에서 고른 시너지
  run: null as RunState | null,
  sel: null as Sel,
  starters: [] as string[],
  pool: [] as string[], // 시작 기물 후보 (CFG.starterPool 명, engine/starters.ts)
  poolRerolls: 0, // 시작 기물 후보 새로고침 남은 횟수
  detail: !!loadPrefs().detail, // 상세 보기: 계수 · 메커니즘 표시
  recruitPick: null as string | null, // 영입 창에서 고른 기물 (확정 전)
  recoFor: null as string | null, // 추천 장비 창을 연 기물 uid
  useK: null as null | { i: number; tg: R.UseTarget }, // 소모품 사용 확인 창
  nodePick: null as string | null, // 지도: 이번 칸에서 고른 노드 (진입 전)
  bigUnit: null as string | null, // 기물 전체 상세 팝업 (대기실 · 편성 확대)
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
  introDone: false, // 출격 연출을 끝까지 봤는지 (다시 그릴 때 연출 생략)
  introFoe: null as string | null, // 전장 브리핑에서 연 적 상세
  dsInfo: null as number | null, // 난이도 카드에서 펼친 세부 조건
  codexTab: 'units' as 'units' | CX2.Cx2Tab | 'enemies' | 'events' | 'manual' | 'records' | 'ach',
  tutAsk: false, // 첫 실행: 새 계약을 누르면 튜토리얼부터 볼지 묻는다
  codexGroup: 'none' as 'none' | 'faction' | 'trait' | 'ctype' | 'ttype', // 도감 기물: 모아보기 기준
  codexSel: null as string | null, // 도감 기물: 상세를 펼친 기물
  meterTab: 'dmg' as 'dmg' | 'taken' | 'support' | 'kills',
  battleSel: null as number | null, // 전투 중 선택한 기물 (아군 · 적)
  bPick: null as string | null, // 상세 정보에서 고른 효과 (st:key) · 장비 (it:id)
  releaseConfirm: null as string | null,
  lastBattle: null as Battle | null,
};

const root = document.getElementById('app')!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pctTxt = (x: number) => `${Math.round(x * 100)}%`;

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
    // 엔지니어 단계가 바뀌면 포탑 장비 칸을 맞추고, 시너지가 꺼지면 포탑 회수 (장비는 보관함으로)
    const back = R.syncTurrets(app.run);
    if (back.length) toast(turretCount(app.run) ? `포탑 장비 칸이 줄어 장비 ${back.length}개를 보관함으로 돌려보냈습니다.` : `엔지니어 시너지가 꺼져 포탑을 회수했습니다. 장비 ${back.length}개는 보관함으로.`);
  }
  if (app.run && !app.run.over) saveRun(app.run, app.run.tutorial ? TUT_SLOT : 'auto'); // 튜토리얼 런은 이어하기(자동 저장)를 덮지 않게 따로
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
  const hue = a?.pool === 'special' ? 42 : a?.pool === 'psionic' ? 275 : a?.pool === 'major' ? 210 : h % 360;
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
function itemIcon(id: string | null, attrs = '', note = '') { // note: 툴팁 덧붙임 (갓 구운 빵의 남은 전투 등)
  if (!id) return `<span class="item empty" ${attrs}></span>`;
  const it = itemInfo(id);
  const sc = isEmblem(id) ? SYN_BY_ID[emblemOf(id)]?.color : isOccultMod(id) ? SYN_BY_ID.OCCULT.color : ''; // 문장: 시너지 색 · 신비 부품: 신비학자 색
  const hx = isConsumable(id) ? ` hex" style="--hc:${consColor(id)}` : ''; // 소모품: 육각형 (합성품 보라 · 전투 보상 청록 · 전설급 금색 · 셰프 주황)
  return `<span class="item t${it.tier}${hx}"${sc ? ` style="--sc:${sc}"` : ''} title="${esc(it.name + ' — ' + it.desc + (note ? ` (${note})` : ''))}" ${attrs}>${itemGlyph(id) || it.icon}</span>`;
}
/** 보관함 칸 i 가 갓 구운 빵이면 '전투 n회 뒤 식음' (engine/run.ts breadLeft, 셰프 6명이 켜져 있으면 덧붙임) */
function breadNote(run: RunState, i: number) {
  if (run.inventory[i] !== 'K_bread') return '';
  const left = R.breadLeft(run)[run.inventory.slice(0, i).filter((x) => x === 'K_bread').length];
  return `전투 ${left}회 뒤 식음${tierOf('CHEF', synergyCounts(deployed(run), run).CHEF || 0) >= CFG.chef.noStaleTier ? ' · 지금은 셰프 덕에 식지 않음' : ''}`;
}
/** 소모품 육각형 테두리 색: 전설급 = 전설 장비 색 · 셰프 = 셰프 시너지 색 · 합성품 = 신비학자 색 · 그 밖 (전투 보상 · 상점) 청록 */
const consColor = (id: string) => (isLegendConsumable(id) ? 'var(--g-L)' : id === 'K_bread_stale' ? '#8c8478' : CONSUMABLES[id]?.chef ? SYN_BY_ID.CHEF.color : CONSUMABLES[id]?.drop ? '#6fc3df' : SYN_BY_ID.OCCULT.color);
/** 신비 개조부품 · 소모품 아이콘 */
const SPECIAL_GLYPH: Record<string, string> = {
  O_reach: 'a.range', O_feast: 'a.heal', O_ward_phys: 'e.phys', O_ward_psy: 'e.psy', O_ward_chem: 'e.chem', O_ward_elec: 'e.elec', O_ward_holy: 'e.holy',
  O_mirror: 'a.shield', O_echo: 'a.cd', O_soul: 'a.dmg', O_aegis: 'r.hp', O_void: 'a.crit',
  K_rank: 'r.res', K_morph: 'a.summon', K_legend: 'a.power', K_copy: 'a.reload', K_strip: 'u.area', K_reroll: 'a.cd', K_xp: 'k.inj1', K_xp2: 'k.inj2', K_xp3: 'k.inj3',
  K_seize: 'k.seize', K_rank3: 'k.rank3', K_bread: 'k.bread', K_bread_stale: 'k.bread_stale',
  T_cal: 'a.dmg', T_plate: 'a.hp', T_cryo: 's.chrono', T_ammo: 'u.mag', T_barrier: 'a.shield', T_selfd: 'u.area', T_rapid: 'a.speed', T_tesla: 'e.elec', T_flame: 's.pyro', T_snipe: 'a.snipe', T_mark: 'u.target',
};
/** 장비 아이콘: 재료 · 고급 = 메이저 아이콘, 희귀 · 전설 = 고유 아이콘, 문장 = 시너지 아이콘 */
function itemGlyph(id: string) {
  if (isEmblem(id)) return synIcon(emblemOf(id), 'ii');
  if (isMod(id) || isConsumable(id) || isTurretGear(id)) return lineIcon(SPECIAL_GLYPH[id] || 'a.power', 'ii');
  if (id.startsWith('U_')) return lineIcon(`i.${id}`, 'ii');
  if (id.startsWith('C_') || id.startsWith('G_')) return majorIcon(id.slice(2) as Major, 'ii mi');
  return lineIcon(`i.${id.slice(2)}`, 'ii');
}

/** 예상 이자 (상단 바 크레딧 · 투자 창구): 다음 전투를 마치면 받는 이자. R.interestInfo = 전투 정산(resolveBattle)과 같은 식 · 같은 상한 */
function interestLines(r: RunState) {
  const i = R.interestInfo(r);
  const n = Math.floor(r.credits / i.per), next = r.credits >= 0 && n < i.cap ? i.per - (r.credits % i.per) : 0;
  return {
    i,
    /** 한 줄 (투자 창구 · 눌렀을 때 알림) */
    short: `다음 전투를 마치면 이자 +${i.interest} (크레딧 ${i.per}당 1, 상한 ${i.cap}${i.myopic ? ` · [${i.myopic}] −${Math.round(CFG.despair.interest * 100)}%` : ''})`,
    /** 툴팁: 계산식 · 상한 내역 · 다음 1까지 */
    tip: [
      `다음 전투를 마치면 이자 +${i.interest} — 승패와 상관없이, 정산 전 보유 크레딧 기준`,
      `계산: 크레딧 ${i.per}당 1, 상한 ${i.cap} → ${r.credits} ÷ ${i.per} = ${n}${n > i.cap ? ` → 상한 ${i.cap}` : ''}`,
      `상한 ${i.cap}: ${i.parts.map(([k, v], j) => `${k} ${j && v > 0 ? '+' : ''}${v}`).join(' · ')}${i.floor ? ' (줄어드는 몫은 0 에서 멈춤)' : ''}`,
      i.myopic ? `절망 증강 [${i.myopic}]: 이자 −${Math.round(CFG.despair.interest * 100)}% (내림) → +${i.interest}` : '',
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
  const syns = SYNERGIES.filter((s) => (counts[s.id] || 0) > 0).sort((a, b) => tierOf(b.id, counts[b.id] || 0) - tierOf(a.id, counts[a.id] || 0) || (counts[b.id] || 0) - (counts[a.id] || 0));
  const it = interestLines(r);
  return `<header class="top">
    <div class="brand">ERRANTEs</div>
    <div class="stat-row">
      <span class="pill" title="페이즈 · 노드">P<b>${r.phase}</b> · ${Math.min(r.step + 1, r.map.length)}/${r.map.length}</span>
      <span class="pill hp" title="체력">${lineIcon('r.hp', 'li')}<b>${r.hp}</b>/${r.maxHp}</span>
      <button class="pill cr" data-a="interest-info" title="${esc(`에너지 크레딧 ${r.credits}\n${it.tip}`)}">${CR}<b>${r.credits}</b>${r.over ? '' : `<span class="cr-int${it.i.interest ? '' : ' zero'}${it.i.raw >= it.i.cap ? ' max' : ''}">+${it.i.interest}<span class="cr-int-tx"> 이자</span></span>`}</button>
      ${despairPill(r)}${OATH.oathPill(r)}${kingPill(r)}
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
  if (run) {
    const counts = synergyCounts(deployed(run), run);
    const raw = synergyCounts(deployed(run));
    c = counts[id] || 0;
    const t = tierOf(id, c);
    const next = sd.tiers.find((need) => need > c);
    const bonus = c - (raw[id] || 0);
    head = `<span class="small">출전 <b>${c}</b>명${bonus > 0 ? ` <span class="accent">(문장 +${bonus})</span>` : ''} · ${t ? `${t}단계 활성` : '비활성'} · ${next ? `다음 단계까지 ${next - c}명` : '최고 단계'}</span>`;
  }
  // 소속 기물 초상화: 출전 · 대기 · 미보유 (문장으로 합류한 보유 기물 포함)
  const own = new Map<string, boolean>();
  for (const u of run?.units || []) if (memberships(u).includes(id)) own.set(u.defId, own.get(u.defId) || !!u.pos);
  const pool = UNITS.filter((d) => own.has(d.id) || (([...d.factions, ...d.traits] as string[]).includes(id) && (!d.eventOnly || loadMeta().units[d.id])));
  const st = (d: UnitDef) => (own.get(d.id) ? 0 : own.has(d.id) ? 1 : 2);
  pool.sort((x, y) => st(x) - st(y));
  const TAG = ['출전', '대기', '미보유'];
  mem = `<div class="sp-units">${pool.map((d) => `<span class="sp-u s${st(d)}" title="${esc(d.name)} · ${TAG[st(d)]}">${sprite(d, 'spr')}<i>${esc(d.name)}</i></span>`).join('')}</div>
    <div class="sp-legend small"><span class="s0">출전</span><span class="s1">대기</span><span class="s2">미보유</span></div>`;
  const t = tierOf(id, c);
  const focus = run && (app.screen === 'prep' || app.screen === 'map') ? `<button class="btn tiny sp-focus" type="button" data-synfocus="${id}">${app.screen === 'map' ? '파티에서' : '보드에서'} 강조</button>` : '';
  return `<b class="sp-t">${synIcon(id) || sd.icon}${esc(sd.name)}<small>${sd.kind === 'faction' ? '세력' : '특성'}</small></b>${head}${focus}<p>${esc(sd.desc).replace(/\n/g, '<br>')}</p>${mem}
    <ol class="sp-tiers">${sd.tierDesc.map((d, i) => `<li class="${i === t - 1 ? 'cur' : ''}${c >= sd.tiers[i] ? ' on' : ''}"><b>${sd.tiers[i]}</b><span>${esc(d)}</span></li>`).join('')}</ol>`;
}
function synergyPanel(run: RunState) {
  const counts = synergyCounts(deployed(run), run);
  const benchN: Record<string, number> = {}; // 시너지별 대기 기물 수
  for (const u of run.units) if (!u.pos) for (const sid of memberships(u)) benchN[sid] = (benchN[sid] || 0) + 1;
  const list = SYNERGIES.filter((s) => counts[s.id] || benchN[s.id])
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
    <div class="ts-bg" style="background-image:url('${bgURL('title')}')"></div><div class="ts-shade"></div>
    <div class="ts-stars" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 53) % 100}%;--d:${(i % 9) * 0.5}s;--s:${2.5 + (i % 5)}s"></i>`).join('')}</div>
    <div class="ts-mid">
      <span class="ts-kicker">에란테스 용병단 · 은하 순회 의뢰</span>
      <div class="logo">ERRANTEs</div>
      <p class="tagline">은하 용병단 오토배틀러 · 증강 도파민 MAX</p>
      <nav class="title-actions" aria-label="메뉴">
        <div class="ts-main">${auto ? `<button class="btn primary ts-btn ts-hero" data-a="load" data-v="auto"><b>이어하기</b><small>페이즈 ${auto.phase} · 체력 ${auto.hp}</small></button>` : ''}
          <button class="btn ${auto ? '' : 'primary ts-hero'} ts-btn" data-a="newrun"><b>새 계약</b>${auto ? '<small>진행 중인 의뢰는 덮어씁니다</small>' : '<small>전장 추첨 · 난이도 · 계약 기물 4명</small>'}</button></div>
        <div class="ts-grid" role="group" aria-label="둘러보기">${tutButton()}
          <button class="btn ts-btn ts-tile" data-a="bar"><b>에란테스 바</b><small>${auto ? '들렀다가 이어서 출격' : '단원 · 손님들의 잡담'}</small></button>
          <button class="btn ts-btn ts-tile" data-a="codex"><b>도감 · 기록</b><small>교범 · 기록 · 업적</small></button>
          <button class="btn ts-btn ts-tile ts-oath" data-a="oath"><b>절망 서약</b><small>${diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`} 조건 · 절망 ${OATH.heatNow()}${OATH.effNow() > CFG.oathFrom ? ` (위험 ${OATH.effNow()})` : ''}</small></button></div>
        <div class="ts-util" role="group" aria-label="저장 · 설정">${listTutSave() ? '<button class="btn ghost tiny" data-a="tutorial-restart">튜토리얼 처음부터</button>' : ''}<button class="btn ghost tiny" data-a="menu-import">저장 코드 불러오기</button><button class="btn ghost tiny" data-a="menu-tab" data-v="settings">설정 · 테마</button></div>
      </nav>
      ${slots.length ? `<div class="slots">${slots.map((s) => `<button class="btn ghost" data-a="load" data-v="${s.slot}">${SLOT_NAME[s.slot]} · 페이즈 ${s.phase} · 기물 ${s.units}</button>`).join('')}</div>` : ''}
      ${m.runs ? `<p class="ts-meta"><span>의뢰 <b>${m.runs}</b></span><span>성공 <b>${m.clears}</b></span><span>위험 등급 <b>${m.maxDiff}</b></span></p>` : ''}
    </div>
    <p class="ts-foot">싱글 PvE · 오프라인 플레이 · 진행은 이 브라우저에 자동 저장됩니다.</p>
    ${app.tutAsk ? tutAskModal() : ''}
  </main>`;
}
/** 타이틀: 튜토리얼 칸 (끝내기 전에는 NEW, 진행 중이면 이어서 — '처음부터'는 아래 보조 줄) */
function tutButton() {
  const saved = listTutSave();
  return `<button class="btn ts-btn ts-tile ts-tut" data-a="tutorial" title="튜토리얼 — 당직 근무: 새벽 두 시, 에란테스 바에서 지휘를 배운다"><b>튜토리얼</b>${saved ? `<small>이어서 · 항로 ${Math.min(saved.step + 1, TUT.TUT_MAP.length)}/${TUT.TUT_MAP.length}칸</small>` : '<small>당직 근무 · 지휘 배우기</small>'}${tutMeta().done ? '' : '<span class="ts-new">NEW</span>'}</button>`;
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
const CTYPE_DESC: Record<string, [string, string]> = {
  MARK: ['사격으로 싸운다. 1초마다 사거리 안에서 체력 비율이 가장 낮은 적을 다시 노린다. 사격 위력 · 공격 속도 · 재장전 · 명중 · 치명타가 중요하다.', '마무리 사격: 1초마다 사거리 안에서 체력 비율이 가장 낮은 적으로 대상을 바꾼다. 주력: 사격 위력, 사격 속도, 재장전 속도, 명중, 치명 확률 · 피해. 탄창을 다 쓰면 재장전하는 동안 기본 공격을 못 한다 (스킬은 가능).'],
  VAN: [`근접 타격으로 싸운다. 타격 위력 · 콤보와 피니쉬 · 치명타가 중요하다. 주변 ${CFG.zoc.r}칸은 경계 — 들어온 적이 ${zocHoldFormula()} 멈춰 선다 (암살형 제외).`, `주력: 타격 위력, 타격 속도, 명중, 콤보 · 피니쉬 피해량, 치명 확률 · 피해. 무기별 N번째 공격이 피니쉬 (×${CFG.finishMult}). ${zocRule()}`],
  SPEC: ['기술로 싸운다. 기술 위력 · 효과 명중 · 쿨다운이 중요하다.', '주력: 기술 위력, 효과 명중, 쿨다운 감소 속도, 기술 범위. 기술 피해는 치명타가 없다 (일부 특성 예외).'],
  CMD: ['아군이 함께 쓰는 전술 위력으로 스킬을 쓴다. 출전 인원이 많을수록, 지휘관이 많고 정신력이 높을수록 강하다.', `스킬은 전술 위력으로 계산한다. 전술 위력 = ${CFG.tacBase} (출전 4명 · 지휘관 1명 기준) + 출전 기물 1명당 ${CFG.tacPerUnit} + 지휘관 1명 추가당 ${CFG.tacPerCmd} + 지휘관 정신력 1당 ${CFG.tacPerMnd}.`],
};
/** 전술 유형 공통 규칙: 공명 등급마다 모든 능력치 +1, 이정표 보상은 유형별 */
const TTYPE_RULE: Record<TType, string> = {
  major: `공명 등급마다 모든 주요 능력치 +1. 4등급마다 메이저 증강 1개. 고유 궁극기는 시간이 지나면 저절로 차오르며 (기본 약 ${CFG.ultTime}초, 전투 시작 ${Math.round(CFG.ultStart * 100)}%) 한 전투에 여러 번 쓸 수 있다.`,
  minor: '공명 등급마다 모든 주요 능력치 +1. 3등급마다 주요 능력치 2종 +3. 기술 계수와 특성 수치가 등급에 따라 자란다 (10등급 ×2, 20등급 ×3).',
  special: '공명 등급마다 모든 주요 능력치 +1. 합류 · 5 · 10 · 15등급에 전용 증강 (최대 4개).',
  psionic: '공명 등급마다 모든 주요 능력치 +1. 기물마다 학파가 정해져 있고, 합류할 때 그 학파의 전공을 고른다 (비술 + 지속 능력). 4 · 8 · 12 · 16등급에 전공 증강 (최대 4개, 16등급에 완성).',
  divine: '공명 등급마다 모든 주요 능력치 +1. 고유 신앙이 깨어 있어 신성력을 모으고, 가득 차면 장착한 성유물의 신권 대행을 전투당 한 번 쓴다. 모은 신성력은 전투 후 권능 포인트가 된다.',
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
    if (tt === 'major' && CFG.growth.major(tt, r)) return r;
    if (tt === 'minor' && CFG.growth.pick(tt, r)) return r;
    if (tt === 'special' && CFG.growth.special(tt, r)) return r;
    if (tt === 'psionic' && CFG.growth.psionic(tt, r)) return r;
  }
  return null;
}
const PILGRIM_FLAVOR = ['향 연기가 낮게 깔린 성소. 순례자들이 조용히 무릎을 꿇는다.', '닳은 돌계단 끝에 작은 제단이 있다. 누군가 두고 간 등불이 아직 따뜻하다.', '성가대의 노래가 끊겼다 이어진다. 사제가 권능의 값을 매긴다.'];
/** 순례: 참배 카드 3장 + 성유물 2종 + 디바인 성유물 관리 */
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
function ttSection(d: UnitDef, u: UnitState | null, run: RunState | null, b: Battle | null = null, c: CUnit | null = null, live = false) {
  const tt = d.ttype;
  const rank = u?.rank || 1;
  const nx = u ? nextMilestone(tt, rank) : null;
  const f = u?.faith || d.faith;
  const owned = u?.augments || [];
  const body: string[] = [];
  if (tt === 'major') {
    if (live && c) body.push(`<div class="tt-row"><span class="tt-k">${lineIcon('a.battery', 'li')} 궁극기 게이지</span><b class="tt-big">${Math.round((c.ultG || 0) * 100)}%</b></div>`);
    const mine = owned.filter((a) => MAJOR_AUGS.some((m) => m.id === a.id));
    body.push(`<div class="tt-row"><span class="tt-k">메이저 증강</span><b>${mine.length}</b>${nx ? `<span class="muted small">다음 ${nx}등급</span>` : ''}</div>`);
    body.push(mine.length ? `<div class="tt-icons">${mine.map((a) => `<button class="tt-ic ab-click${abilOn(`aug:${a.id}`)}" data-a="abil-pop" data-v="aug:${esc(a.id)}" title="${esc(AUG_BY_ID[a.id]?.name || a.id)}">${augIcon(a.id)}</button>`).join('')}</div>`
      : `<p class="muted small">${u ? '4등급에 첫 메이저 증강을 고릅니다.' : `공용 풀 ${MAJOR_AUGS.length}종: 주요 · 상세 능력치 상승.`}</p>`);
  } else if (tt === 'minor') {
    const g = CFG.minorGrow(rank);
    const tl = MINOR_TRAIT_GROW[d.id];
    body.push(`<div class="tt-row"><span class="tt-k">성장 배율</span><b class="tt-big">×${g.toFixed(2)}</b><span class="muted small">${u ? `${rank}등급` : '1등급'} · 10등급 ×2 · 20등급 ×3</span></div>`);
    body.push(`<ul class="tt-list"><li>${lineIcon('p.tech', 'li')}기술 계수 ×${g.toFixed(2)}</li>${tl ? `<li>${lineIcon('a.power', 'li')}${esc(tl(g))}</li>` : ''}</ul>`);
    if (nx) body.push(`<p class="muted small">다음 능력치 선택: ${nx}등급</p>`);
  } else if (tt === 'special') {
    const pool = d.specialAugs || [];
    const mine = owned.filter((a) => pool.some((p) => p.id === a.id));
    body.push(`<div class="tt-row"><span class="tt-k">전용 증강</span><b class="tt-big">${mine.length}<small>/4</small></b>${nx && mine.length < 4 ? `<span class="muted small">다음 ${nx}등급</span>` : ''}</div>`);
    if (mine.length) body.push(`<ul class="augs">${mine.map((a) => augRow(a.id, a.param, b, c)).join('')}</ul>`);
    if (!u) body.push(`<ul class="augs">${pool.map((a) => augRow(a.id, undefined, b, c)).join('')}</ul>`);
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
      body.push(`<div class="ps-cards" style="--sc:${sc.color}">
        <div class="ps-card ab-click${abilOn('cantrip')} has-tok" data-a="abil-pop" data-v="cantrip" role="button" tabindex="0">${abTok(`cantrip.${sc.id}`)}<div class="ab-head"><span class="ab-kind">비술</span><b>${esc(cv.name)}</b>${psiTfTag(cv.transform)}</div><div class="ab-chips">${chips}</div></div>
        <div class="ps-card ab-click${abilOn('psipass')} has-tok" data-a="abil-pop" data-v="psipass" role="button" tabindex="0">${abTok(`passive.${sc.id}`)}<div class="ab-head"><span class="ab-kind">지속</span><b>${esc(sc.passive.name)}</b>${psiTfTag(pv.transform)}</div><span class="small">${esc(pv.brief)}</span></div>
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
      if (!u || app.detail) {
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
  }
  void f;
  return `<section class="abil tt-sec tt-${tt}"><div class="ab-head"><span class="ab-kind">전술 유형</span><b class="tt-name"><i class="tt-${tt}">${TTYPE_ICON(tt)}</i>${TTYPE_NAME[tt]}</b></div>
    ${tt !== 'psionic' || app.detail ? `<p class="tt-rule small muted">${esc(TTYPE_RULE[tt])}</p>` : ''}${body.join('')}</section>`;
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
  const ct = CTYPE_DESC[d.ctype];
  void u; void run;
  const tok = abTok(`trait.${d.id}`);
  return `<div class="abil ab-trait"><div class="ab-click${abilOn('trait')}${tok ? ' has-tok' : ''}" data-a="abil-pop" data-v="trait" role="button" tabindex="0">${tok}<div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div>${traitHtml(d, b, c)}</div>
    <div class="subs">
      ${sub(k('ct'), CTYPE_ICON(d.ctype), `ct-${d.ctype}`, CTYPE_NAME[d.ctype], '전투 유형', `<p>${esc(app.detail ? ct[1] : ct[0])}</p>`)}
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
  if (!app.detail) return BRIEF[d.id]?.skill || d.skill.desc(sk);
  const t = d.skill.desc(sk);
  return d.ctype === 'CMD' ? t.replace(/기술 위력/g, '전술 위력') : t;
}
const traitText = (d: UnitDef) => (app.detail ? d.trait.desc : BRIEF[d.id]?.trait || d.trait.desc);
/** 상세 창 상단 고정 바: 닫기(←) · [추가 버튼] · 상세 보기(돋보기) */
function dBar(back: string, extra = '') {
  return `<div class="d-bar"><button class="btn d-back" data-a="${back}" data-v="" aria-label="상세 닫기" title="닫기 (Esc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <span class="d-bar-r">${extra}<button class="btn d-mag${app.detail ? ' on' : ''}" data-a="toggle-detail" aria-pressed="${app.detail}" aria-label="상세 보기 ${app.detail ? '끄기' : '켜기'}" title="상세 보기: 계수 · 세부 규칙 표시 (단축키 D) · ${app.detail ? 'ON' : 'OFF'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg></button></span></div>`;
}
function detailToggle() {
  return `<button class="btn tiny dtoggle ${app.detail ? 'on' : ''}" data-a="toggle-detail" aria-pressed="${app.detail}" title="계수 · 세부 규칙 표시 (단축키 D)">상세 보기 ${app.detail ? 'ON' : 'OFF'}</button>`;
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
    ${abil('skill', d.skill.name, app.detail ? `${d.skill.cd}초` : '', skillText(d))}
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
    ${on ? `<span class="pc-check">✓${o.badge ? ` ${o.badge}` : ''}</span>` : ''}
    <div class="pc-syn">${[...d.factions, ...d.traits].map((id) => synToken(id, o.synCount ? o.synCount(id) : 0)).join('')}</div>
    <div class="pc-panel">
      <div class="pc-top"><div class="pc-nm"><b class="pc-name">${esc(d.name)}</b>${o.nameExtra || ''}</div>${roleTag(d)}${o.extra || ''}
        <div class="chips">${[...d.factions, ...d.traits].map(o.chipFn || chip).join('')}</div>
        <button class="pc-more" data-a="card-open" data-v="${d.id}" ${clone ? 'tabindex="-1"' : ''}>${app.cardOpen === d.id && !clone ? '접기 ▼' : '상세 보기 ▲'}</button></div>
      <div class="pc-desc" data-a="noop">${unitInfo(d)}
        <button class="btn ${on ? '' : 'primary'} pc-pick" data-a="${o.tapAct}" data-v="${d.id}" ${full ? 'disabled' : ''} ${clone ? 'tabindex="-1"' : ''}>${on ? '선택 해제' : full ? o.fullLabel || '선택 불가' : '선택'}</button></div>
    </div>
  </div></div>`;
}
const CAN_HOVER = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;

// ───────────────────────── 출격 연출: 전장 추첨 → 난이도 → 계약 기물
/** 전장 상성 요약 (적 풀 · 분류 규칙에서 자동 집계) */
function matchupHtml(fid: string) {
  const ls = matchupLines(fid);
  return ls.length ? `<div class="mu-box"><span class="mu-k">이 전장의 주요 적</span>${ls.map((l) => `<span class="mu-l ${l.cls}">${esc(l.text)}</span>`).join('')}</div>` : '';
}
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
function introScreen() {
  const f = fieldOf(app.introField);
  const done = app.introDone ? ' landed opened' : '';
  return `<main class="intro${done}" style="--c:${f.color}">
    <div class="in-bg" style="background-image:url('${bgURL(`field_${f.id}`)}'), linear-gradient(165deg, color-mix(in srgb, ${f.color} 40%, #0b0d14), #0b0d14 75%)"></div><div class="in-shade"></div>
    <div class="in-stars" aria-hidden="true">${Array.from({ length: 40 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.6}s;--s:${3 + (i % 5)}s"></i>`).join('')}</div>
    <div class="in-curtain l" aria-hidden="true"></div><div class="in-curtain r" aria-hidden="true"></div>
    <div class="in-slot"><span class="in-kicker">이번 의뢰의 전장</span><b class="in-name">${app.introDone ? esc(f.name) : '???'}</b><span class="in-region">${esc(f.region)}</span></div>
    <section class="in-info" aria-live="polite">
      <p class="in-desc">${esc(f.desc)}</p>
      ${fieldBrief(f.id)}
      <div class="in-act"><button class="btn ghost" data-a="to-title">돌아가기</button><button class="btn primary" data-a="intro-ok">확인</button></div>
    </section>
    ${app.introFoe ? foeModal(app.introFoe) : ''}
  </main>`;
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
/** 출격 연출 동안 전장 · 난이도 배경을 미리 받아 둔다 */
let bgWarm = false;
/** 특권 커튼 연출을 이미 보여 준 런 (시드) */
let pvPlayed: number | null = null;
/** 절망 증강 막을 이미 보여 준 선택 (시드:이미 고른 수) */
let dpPlayed: string | null = null;
function preloadBgs() {
  if (bgWarm) return;
  bgWarm = true;
  for (const k of [...FIELDS.map((f) => `field_${f.id}`), 'diff_easy', 'diff_adventure', 'diff_challenge']) { const im = new Image(); im.decoding = 'async'; im.src = bgURL(k); }
}
/** 별 무리 → 커튼 갈라짐 → 슬롯 회전 → 착지 (DOM 만 조작하고 끝나면 introDone) */
let introTimer = 0;
function introAnim() {
  const el = root.querySelector<HTMLElement>('.intro');
  const name = el?.querySelector<HTMLElement>('.in-name'), region = el?.querySelector<HTMLElement>('.in-region');
  if (!el || !name || !region) return;
  clearTimeout(introTimer);
  const target = fieldOf(app.introField);
  const names = FIELDS.map((f) => f);
  let i = 0, delay = 60, elapsed = 0;
  const spin = () => {
    const f = names[i++ % names.length];
    name.textContent = f.name; region.textContent = f.region;
    el.style.setProperty('--c', f.color);
    elapsed += delay;
    if (elapsed > 1900 && f.id === target.id) {
      el.classList.add('landed');
      app.introDone = true;
      return;
    }
    if (elapsed > 1100) delay = Math.min(320, delay * 1.18);
    introTimer = window.setTimeout(spin, delay);
  };
  introTimer = window.setTimeout(() => { el.classList.add('opened'); introTimer = window.setTimeout(spin, 650); }, 900);
}
/** 난이도 카드: 등급 · 이름은 difficulty.ts DIFF_PRESETS (쉬움 3 · 모험 6 · 고난 7), 증원 간격 · 보상 배율 · 절망 증강 횟수는 설정값에서 읽는다.
 *  배경 키(diff_easy · diff_adventure · diff_challenge)는 그림 파일 이름이라 카드 순서대로 그대로 쓴다 */
const DIFF_BG = ['diff_easy', 'diff_adventure', 'diff_challenge'];
const diffLine = (lvl: number) => {
  const add = diffAddEvery(lvl), cr = `승리 크레딧 ×${CFG.diffWinMul(lvl)}`;
  const foes = add ? `적은 ${add}페이즈마다 1기씩 늘어납니다` : '적이 장비를 챙기지만 수는 늘지 않습니다';
  if (despairDiff(lvl)) return `함대 체력이 줄고 절망 증강이 ${CFG.despair.every}페이즈마다 쌓이며, ${foes}. ${cr}, 베테랑 전용.`;
  return lvl >= 6 ? `처음부터 모든 적이 장비를 갖추고, ${foes}. ${cr}.` : `처음 출격하는 용병단을 위한 항로. ${foes}. ${cr}.`;
};
const DIFF_PICKS = DIFF_PRESETS.map((x, i) => ({ lvl: x.lvl, name: x.name, sub: `위험 등급 ${x.lvl}`, bg: DIFF_BG[i] || DIFF_BG[DIFF_BG.length - 1], line: diffLine(x.lvl) }));
/** 절망 증강 안내 (고난 카드 위 띠): 고르는 횟수만 짧게. 자세한 방식은 ⓘ 세부 조건 (difficulty.ts 위험 7) */
function despairNote(lvl: number) {
  if (!despairDiff(lvl)) return '';
  const ph = despairPhases();
  return `절망 증강: 출격 때 1개${ph.length ? ` + ${ph.map((p) => `${p}페이즈`).join(' · ')} 시작 때 1개씩` : ''} (의뢰 중 ${1 + ph.length}개)`;
}
function diffScreen() {
  return `<main class="diffsel"><h1 class="ds-title">난이도 설정</h1>
    <div class="ds-row">${DIFF_PICKS.map((d) => {
      const on = app.diff === d.lvl;
      const conds = DIFFS.filter((x) => x.lvl >= 1 && x.lvl <= d.lvl).map((x) => x.desc).concat(OATH.applies(d.lvl) ? OATH.oathConds() : []);
return `<button class="ds-card${on ? ' on' : ''}${app.dsInfo === d.lvl ? ' info' : ''}" data-a="diff" data-v="${d.lvl}" aria-pressed="${on}">
        <span class="ds-bg" style="background-image:url('${bgURL(d.bg)}')"></span><span class="ds-shade"></span>
        <span class="ds-info-btn" data-a="ds-info" data-v="${d.lvl}" role="button" aria-label="${d.name} 세부 조건" title="세부 조건">i</span>
        <span class="ds-pop">${conds.length ? `<b>세부 조건</b><ul>${conds.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '<b>세부 조건</b><span>추가 조건 없음</span>'}</span>
        <span class="ds-body"><span class="ds-sub">${(() => { const e = OATH.applies(d.lvl) ? OATH.effNow(d.lvl) : d.lvl; return e > d.lvl ? `위험 등급 ${e}<span class="ds-sub-x" title="${esc(OATH.effRule())}"> (${d.lvl} + 절망 서약 ${e - d.lvl})</span>` : d.sub; })()}</span><b class="ds-name">${d.name}</b><span class="ds-line">${d.line}</span></span>
        ${despairDiff(d.lvl) || OATH.applies(d.lvl) ? `<span class="ds-despair open">${despairDiff(d.lvl) ? `${lineIcon('k.soul', 'li')}<span>${esc(despairNote(d.lvl))}</span>` : ''}${OATH.applies(d.lvl) ? OATH.oathCardNote() : ''}</span>` : ''}</button>`; // 고난: 절망 증강 + 절망 서약 (지금 절망 수치)
    }).join('')}</div>
    <div class="ds-act"><button class="btn ghost" data-a="intro-back">전장 다시 보기</button><button class="btn primary" data-a="diff-ok">출격 준비</button></div>
  </main>`;
}

function newRunScreen() {
  const n = app.starters.length;
  return `<main class="wrap nr">
    <div class="nr-head">
      <div><h1>계약 기물 선택</h1><p class="muted small">이번 출격에 응한 ${app.pool.length}명 중 ${CFG.startUnits}명을 고르세요.${(() => { const syn = fieldSyn(app.introField), k = starterFavNeed(app.introField); return syn && k ? ` 전장 [${esc(fieldOf(app.introField).name)}]의 우세 시너지 ${chip(syn)} 기물이 ${k}명 이상 섞여 있습니다.` : ''; })()} ${CAN_HOVER ? '카드에 마우스를 올리면 설명이 나오고, 누르면 선택합니다.' : '카드를 누르면 선택합니다. 하단을 위로 끌어올리거나 [상세 보기]를 누르면 설명이 나옵니다.'}</p></div>
      ${detailToggle()}
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
      <button class="btn ghost" data-a="to-title">뒤로</button>
      <button class="btn ghost" data-a="random-starters">무작위</button>
      <button class="btn ghost" data-a="reroll-starters" title="고른 기물을 모두 해제하고 후보 ${app.pool.length}명을 새로 뽑습니다. 직전 후보와 겹치지 않게 뽑고, 우세 시너지 기물 보장은 그대로입니다 (단축키 R)" ${app.poolRerolls > 0 ? '' : 'disabled'}>새로고침 (${app.poolRerolls}회)</button>
      <button class="btn primary" data-a="start-run" ${n === CFG.startUnits ? '' : 'disabled'}>출격 (${n}/${CFG.startUnits})</button>
    </div>
  </main>`;
}

// ───────────────────────── 화면: 맵
function mapScreen(run: RunState) {
  const p = run.phase;
  const scale = `적 체력 ×${fmt(phaseHpMult(p))} (이번 페이즈 ×${p > 1 ? CFG.phaseHpFactor(p).toFixed(2) : '1'}) · 방어도 ×${Math.pow(CFG.phaseArmor, p - 1).toFixed(2)} · 피해 ×${phaseAmpMult(p).toFixed(2)}`;
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
  const enter = run.node
    ? `<button class="btn primary tl-go" data-a="resume" title="${esc(NODE_NAME[run.node.type])} 계속하기">계속하기</button>`
    : pick ? `<button class="btn primary tl-go" data-a="enter" data-v="${pick}" title="단축키 Enter">${FIGHT_NODES.includes(pick) ? (pick === 'boss' ? '보스전 진입' : '전투 진입') : `${esc(NODE_NAME[pick])} 진입`}</button>`
    : '<button class="btn primary tl-go" disabled>항로 끝</button>'; // 튜토리얼: 보스 뒤
  const f = fieldOf(run.field);
  const pet = tierOf('PET', synergyCounts(deployed(run), run).PET || 0);
  return `<main class="wrap map">
    <aside class="side left">
      <h2>시너지</h2><div class="syn-list">${synergyPanel(run)}</div>
    </aside>
    <section class="map-main">
      <div class="screen-head map-head"><h1>페이즈 ${p}</h1>${bossGoal(run)}</div>
      <div class="tl"><ol class="tl-track">${track}</ol></div>
      <p class="map-scale" title="이번 페이즈 적 강도 (페이즈마다 누적)">${scale}</p>
      ${mapAhead(run, pick, enter)}
      ${shipPanel(run, pet >= 2 ? `<button class="btn ship-loan" data-a="loan" ${run.loan ? 'disabled' : ''}>페트라 대출 ${CR}+25 · 상환 30</button>` : '')}
    </section>
    <aside class="side side-tabs${app.sel?.k === 'unit' || app.sel?.k === 'king' ? ' has-detail' : ''}">${mapDetail(run)}
      <div class="st-tabs" role="tablist">${['파티', '환경', '기록'].map((t, i) => `<button role="tab" class="st-tab" data-a="map-tab" data-v="${i}" aria-selected="${app.mapTab === i}">${t}</button>`).join('')}<span class="st-ink" style="--i:${app.mapTab}"></span></div>
      <div class="st-view"><div class="st-track" style="--i:${app.mapTab}">
      <section class="st-pane" role="tabpanel" aria-label="파티">
      <h2>파티 <span class="muted small">출전 ${deployed(run).length}/${R.deployCap(run)} · 보유 ${run.units.length}/${CFG.maxParty}</span></h2>
      <div class="party">${run.units.map(rosterTile).join('')}</div>
      <h2>보관함 <span class="muted small">${run.inventory.length}개</span></h2>
      ${run.inventory.length ? `<div class="inv-strip">${run.inventory.map((id) => itemIcon(id)).join('')}</div>` : '<p class="muted small">보관 중인 장비가 없습니다.</p>'}
      </section>
      <section class="st-pane" role="tabpanel" aria-label="환경">
      <div class="env-hero" style="--c:${fieldOf(run.field).color};background-image:url('${bgURL(`field_${fieldOf(run.field).id}`)}'), linear-gradient(165deg, color-mix(in srgb, ${fieldOf(run.field).color} 40%, #0b0d14), #0b0d14 75%)"><span class="env-kicker">현재 전장</span><b>${esc(fieldOf(run.field).name)}</b><span>${esc(fieldOf(run.field).region)}</span></div>
      <button class="field-btn" data-a="field-info" title="전장 브리핑 다시 보기">${fieldCard(run, true)}</button>
      ${kingEnv(run)}
      ${run.quests.length ? `<h2>헬레니우스 퀘스트</h2><ul class="quests">${run.quests.map((q) =>
        `<li class="${q.done ? 'done' : ''}">${esc(R.questText(q))} <span class="muted">${Math.min(q.progress, q.target)}/${q.target} · 보상 ${R.questRewardText(q)}</span></li>`).join('')}</ul>` : ''}
      ${run.privilege ? `<h2>특권</h2><ul class="globals"><li><b>${esc(R.privilegeName(run.privilege))}</b> <span class="muted">${esc(R.privilegeDesc(run.privilege))}</span></li></ul>` : ''}
      ${despairEnv(run)}${OATH.oathEnv(run)}
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
/** 함선 관리: 함대 확장 (출전 인원) · 지정 소집 (시너지 지정 영입) */
function shipPanel(run: RunState, extra = '') {
  const fc = R.fleetCost(run), mc = R.musterCost(run), busy = !!run.node || run.pending.length > 0;
  const full = run.units.length >= CFG.maxParty;
  return `<section class="ship" aria-labelledby="ship-h"><h2 id="ship-h">함선 관리</h2><div class="ship-grid">
    <button class="ship-btn" data-a="fleet" ${fc === null || run.credits < fc || busy ? 'disabled' : ''}>
      <span class="sb-ic">${NODE_ICON.supply}</span><b>함대 확장</b>
      <span class="small muted">출전 인원 ${R.deployCap(run)} → ${fc === null ? '최대' : R.deployCap(run) + 1}명</span>
      <span class="sb-cost">${fc === null ? '최대 규모' : `${CR}${fc}`}</span></button>
    <button class="ship-btn" data-a="muster-open" ${run.credits < mc || busy || full ? 'disabled' : ''}>
      <span class="sb-ic">${NODE_ICON.recruit}</span><b>지정 소집</b>
      <span class="small muted">${full ? `보유 한도 ${CFG.maxParty}명` : `시너지 ${CFG.musterPicks}개를 골라 그 안에서 영입`}</span>
      <span class="sb-cost">${CR}${mc}</span></button>
  </div>${extra}</section>`;
}
function musterModal(run: RunState) {
  const sel = app.musterSel;
  const pool = sel.length ? R.musterPool(run, sel) : [];
  const ok = R.musterSyns();
  const owned = new Set(run.units.flatMap((u) => [...UNIT_BY_ID[u.defId].factions, ...UNIT_BY_ID[u.defId].traits]));
  const group = (kind: string, title: string) => `<h3>${title}</h3><div class="ms-grid">${SYNERGIES.filter((s) => s.kind === kind && ok.includes(s.id) && R.musterPool(run, [s.id]).length).map((s) => {
    const on = sel.includes(s.id), n = R.musterPool(run, [s.id]).length;
    return `<button class="ms-syn${on ? ' on' : ''}${owned.has(s.id) ? ' own' : ''}" style="--c:${s.color}" data-a="muster-tog" data-v="${s.id}" aria-pressed="${on}" title="${esc(s.name)}" aria-label="${esc(s.name)} ${n}명" ${!on && sel.length >= CFG.musterPicks ? 'disabled' : ''}>
      <span class="syn-dia"><i>${synIcon(s.id) || s.icon}</i></span><span class="ms-n">${n}</span></button>`;
  }).join('')}</div>`;
  const full = sel.length === CFG.musterPicks;
  return `<h1>지정 소집</h1><p class="muted small">세력 · 특성 시너지를 정확히 ${CFG.musterPicks}개 고르면, 그중 하나라도 가진 기물만 후보로 나옵니다. 숫자는 후보 수, 밝은 테두리는 보유 중인 시너지.</p>
    ${group('faction', '세력')}${group('trait', '특성')}
    <div class="row-btns ms-foot"><span class="muted small">${sel.length}/${CFG.musterPicks} 선택${full ? ` · 후보 풀 ${pool.length}명` : ''}</span>
      <button class="btn" data-a="muster-cancel">취소</button>
      <button class="btn primary" data-a="muster-ok" ${full && pool.length ? '' : 'disabled'}>소집 ${CR}${R.musterCost(run)}</button></div>`;
}
function nodeHint(o: NodeType) {
  return ({
    battle: '공명도 · 크레딧 · 재료 확률', adversity: `적 ×${CFG.adversityMult} · 보상 ${CFG.adversityReward}배 + 장비 재료 ${CFG.drop.advParts}개 확정`,
    council: `전역 증강 3장 중 택1 · 새로고침 ${CFG.globalRerolls}회`, shop: `분기점 — 상점 / 보급 / 모집 (+ ${SYN_BY_ID.STAR.name} 속보 · 호이슌 투자 · 순례)`,
    supply: '보급품 3종 중 택1', recruit: '새 동료 3명 중 택1', boss: `${app.run && R.bossMustWin(app.run) ? '의뢰의 마지막 보스 · 이길 때까지 다시 싸운다' : `승리 시 페이즈 클리어 · 패배해도 다음 페이즈로 (체력 -${CFG.bossLossDamage(app.run?.phase || 1)})`} · ${CFG.drop.bossAdvEvery}페이즈마다 희귀 장비`,
    pilgrim: '신앙 획득 + 이번 페이즈 축복 선택', news: '명성을 보상으로 교환', invest: '호이슌 투자 상품 · 크레딧으로 문장 · 증강 · 다음 페이즈 수익', event: '전장에 얽힌 사건 · 선택에 따라 판이 바뀝니다',
    fork: `갈림길 — 휴식(체력 +${CFG.forkRestHp} + 잃은 체력 ${Math.round(CFG.forkRestLost * 100)}%) 또는 도전(다음 페이즈 역경급 전투, 승리 시 다음 페이즈로)`,
    challenge: '다음 페이즈 역경 수준의 전투 · 승리 시 남은 노드 보상을 받고 다음 페이즈로',
  } as Record<NodeType, string>)[o] || '';
}
/** 이번 페이즈 보스: 전장의 보스는 페이즈마다 순환한다 (조우 생성과 같은 규칙) */
const phaseBoss = (run: RunState): EnemyDef | undefined => { const f = fieldOf(run.field); return ENEMY_BY_ID[f.bosses[(run.phase - 1) % f.bosses.length]]; };
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
  for (let i = run.step + 1; i < Math.min(run.map.length, run.step + 3); i++) if (!tb || i <= tb.bi) idx.push(i);
  const f = fieldOf(run.field);
  const PART = lineIcon('r.part', 'li'), CONS = lineIcon('r.cons', 'li');
  // 모디파이어 (현재 칸만, 둥근 칸 · 아이콘 + 값, 설명은 툴팁): 규칙 수치만 — 적 강화 배율 · 보상 배율 (설정값) · 위험 등급 적 증원 (해골 +n) · 정예 확정 (역경 · 도전). 적 개체(초상 · 이름)는 넣지 않는다
  const mod = (icon: string, val: string, title: string, cls = '') => `<span class="ah-md ${cls}" title="${esc(title)}">${icon}${val ? `<b>${val}</b>` : ''}</span>`;
  const mods = (o: NodeType) => {
    if (!FIGHT_NODES.includes(o)) return '';
    const m: string[] = [];
    const ph = o === 'challenge' ? run.phase + 1 : run.phase;
    if (o === 'adversity' || o === 'challenge') m.push(mod(lineIcon('m.up', 'li'), `×${CFG.adversityMult}`, `적 강화: 체력 ×${CFG.adversityMult} · 피해 ×${+encDmgMult(CFG.adversityMult).toFixed(2)}`, 'bad'));
    const add = diffAddCount(run.diff, ph) + OATH.hordeAdd(run); // 위험 등급 증원 + 군세의 서약
    if (add > 0) m.push(mod(lineIcon('m.skull', 'li'), `+${add}`, `적 수량 +${add} — ${[diffAddRule(run.diff) && `위험 등급 ${run.diff} 적 증원: ${diffAddRule(run.diff)}`, OATH.hordeAdd(run) && `군세의 서약 +${OATH.hordeAdd(run)}`].filter(Boolean).join(' · ')}`, 'bad'));
    if ((o === 'adversity' || o === 'challenge') && f.elite) m.push(mod(lineIcon('m.elite', 'li'), '정예', `정예 확정: ${NODE_NAME[o]} 전투에는 이 전장의 정예가 반드시 나온다`, 'bad tx'));
    if (o === 'adversity') m.push(mod(lineIcon('m.gift', 'li'), `×${CFG.adversityReward}`, `보상 강화: 승리 크레딧 · 공명도 ×${CFG.adversityReward}`, 'good'));
    for (const dsp of despairsOf(run)) { const dv = dsp.mod?.(o === 'boss'); if (dv) m.push(mod(lineIcon(dsp.icon, 'li'), dv, `절망 증강 [${dsp.name}]: ${dsp.desc()}`, 'bad despair')); } // 절망 증강 (이 전투에 걸리는 것만, 고른 순서)
    return m.length ? `<div class="ah-mods" aria-label="모디파이어"><span class="ah-sec">모디파이어</span>${m.join('')}</div>` : '';
  };
  // 예상 수입 (현재 칸만, 네모 칸 · 아이콘 + 숫자): 승리 시 공명도 풀 · 크레딧 (엔진의 보상 계산 battleRewardPreview) + 장비 · 재료 · 소모품 (×n = 확정, % = 확률, 설정값 · 전장 배율)
  const inc = (icon: string, val: string, title: string, cls = '') => `<span class="ah-in ${cls}" title="${esc(title)}">${icon}<b>${val}</b></span>`;
  const income = (o: NodeType) => {
    if (!FIGHT_NODES.includes(o)) return '';
    const t: NodeType = o === 'challenge' ? 'adversity' : o; // 도전은 보상 · 전리품을 역경 기준으로
    const r = R.battleRewardPreview(run, o);
    const out = [inc(RES, String(r.xp.win), '공명도 풀 (승리 시) — 출전 · 대기 기물에게 나눠 줌'), inc(CR, `+${r.credits.win}`, `크레딧 수입 (승리 시) — 승리 보상 · 연승 · 이자 +${r.credits.interest} 등`)];
    if (t === 'battle') out.push(inc(PART, pctTxt(Math.min(1, CFG.drop.battle * (f.dropMul || 1))), '무작위 장비 재료 1개 — 확률', 'g-C'));
    if (t === 'adversity') out.push(inc(PART, `×${CFG.drop.advParts}`, '무작위 장비 재료 — 확정', 'g-C'));
    if (t === 'boss') out.push(run.phase % CFG.drop.bossAdvEvery === 0 ? inc(PART, '×1', '희귀 장비 3개 중 1개 선택 — 확정', 'g-A') : inc(PART, pctTxt(CFG.drop.bossPart), '장비 재료 3개 중 1개 선택 — 확률', 'g-C'));
    if (CFG.drop.utility[t]) out.push(inc(CONS, pctTxt(CFG.drop.utility[t]), '전투 보상 소모품 1개 — 확률', 'cons'));
    return `<div class="ah-inc" aria-label="예상 수입"><span class="ah-sec">예상 수입</span>${out.join('')}</div>`;
  };
  // 순서 배지: 현재 · 노드 아이콘 + 몇 칸 뒤 (몇 번째 칸인지는 툴팁)
  const step = (i: number) => (i === run.step ? '<span class="ah-step now">현재</span>' : `<span class="ah-step" title="${i - run.step}칸 뒤 (${i + 1}번째 칸)">${lineIcon('r.node', 'li')}${i - run.step}</span>`);
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
    const cat = enemyCategory(e), td = TEND_NAME[e.tend], rk = foeRank(run, e, run.phase, R.encounterMult('boss', i));
    return `<li class="ah-card ah-boss n-boss${cur ? ' cur tl-info' : ''}" title="${esc(`${e.name} — ${ENEMY_DESC[e.id] || ''}`)}">${act(cur)}<span class="ah-lead"><span class="ah-port">${sprite(e, 'spr big')}<i class="ah-ic">${NODE_ICON.boss}</i></span>${step(i)}</span>
      <div class="ah-body"><b>${esc(e.name)}</b>${cur ? about('boss') : desc(`${NODE_NAME.boss} · ${nodeHint('boss')}`)}<div class="ah-chips">${rankChip(rk)}${R.bossMustWin(run) ? tchip(lineIcon('m.elite', 'li'), '최종 보스', 'bad', '의뢰의 마지막 보스: 이길 때까지 다시 싸운다 (다른 보스는 져도 다음 페이즈로)') : ''}${tchip(lineIcon(`k.${cat}`, 'li'), CATEGORY_NAME[cat], `cat-${cat}`, `${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}`)}${td ? tchip(lineIcon(`t.${e.tend}`, 'li'), td.name, '', `${td.name}: ${td.desc}`) : ''}</div>${cur ? `${income('boss')}${mods('boss')}` : ''}</div></li>`;
  };
  const nodeCard = (i: number, o: NodeType, cur: boolean) => {
    const e = o === 'boss' ? phaseBoss(run) : undefined;
    if (e) return bossCard(i, e, cur);
    const note = cur && run.node ? '<span class="ah-hint">진행 중</span>' : '';
    return `<li class="ah-card n-${o}${cur ? ' cur tl-info' : ''}">${act(cur)}<span class="ah-lead"><i class="ah-ic">${NODE_ICON[o]}</i>${step(i)}</span><div class="ah-body"><b>${esc(NODE_NAME[o])}</b>${cur ? `${about(o)}${income(o)}${mods(o)}` : desc(nodeHint(o))}${note}</div></li>`;
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
  return unitRank(e, buildEnemy(new Battle(9, 9, new Rng(1), { phase, credits: 0, field: run.field, diff: run.diff, despairs: run.despairs, oaths: run.oaths }), e, phase, mult, s));
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
const CR = lineIcon('r.cr', 'li cr'), RES = lineIcon('r.res', 'li res');
/** 문장 속 '크레딧' · '공명도' 앞에 아이콘 (이미 escape 된 HTML 에만) */
const ic = (html: string) => html.replace(/(에너지 크레딧|크레딧)/g, `${CR}$1`).replace(/공명도/g, `${RES}공명도`);
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
  return `<button class="rt${u.pos ? '' : ' rt-off'}${on ? ' on' : ''}" data-a="${app.screen === 'map' ? 'map-unit' : 'manage'}" data-v="${u.uid}" data-syns="${memberships(u, run).join(' ')}" aria-pressed="${on}" title="${esc(tip)}" aria-label="${esc(tip)}">
    <span class="rt-art">${sprite(d)}${u.mod ? `<span class="rt-mod">${itemIcon(u.mod)}</span>` : ''}
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
  const scheme = tierOf('SCHEME', sc.SCHEME || 0) > 0 || tierOf('ENG', sc.ENG || 0) > 0; // [암운] 피해 · 포탑 사격 위력이 전술 위력 비례
  const b = dep.length ? buildBattle(run, run.node?.enc ? { ...run.node.enc, enemies: [] } : { n: CFG.bossBoard, env: '', enemies: [], mult: 1, seed: 1 }, false) : null;
  const allies = b ? b.units.filter((u) => u.side === 0 && !u.isSummon) : [];
  const cmds = allies.filter((u) => u.ctype === 'CMD');
  const show = !!b && (cmds.length > 0 || scheme || allies.some((u) => u.weapon?.tactical));
  const pop = show && !tacShownPrev;
  tacShownPrev = show;
  if (!b || !show) return '';
  const lines = [`기본 ${CFG.tacBase} (출전 4명 · 지휘관 1명 기준)`, `출전 ${allies.length}명: ${allies.length >= 4 ? '+' : ''}${CFG.tacPerUnit * (allies.length - 4)}`];
  if (cmds.length !== 1) lines.push(`지휘관 ${cmds.length}명: ${cmds.length > 1 ? '+' : ''}${CFG.tacPerCmd * (cmds.length - 1)}`);
  for (const c of cmds) lines.push(`${c.name} 정신력 ${c.mem.mnd || 0}: +${CFG.tacPerMnd * (c.mem.mnd || 0)}`);
  const extra = allies.reduce((sum, u) => sum + (u.mem.tacBonus || 0), 0);
  if (extra) lines.push(`기타 보정 +${extra}`);
  const v = b.tac[0];
  const title = `전술 위력 ${v}\n${lines.join('\n')}\n지휘관의 스킬 · 전술 무기 · [암운] · 감시 포탑은 이 값을 위력으로 씁니다.`;
  return `<span class="tac-wrap"><button class="pill tac-pill${pop ? ' pop' : ''}" data-a="tac-info" title="${esc(title)}" aria-label="${esc(title)}" aria-expanded="${app.tacOpen}">${lineIcon('p.tac', 'li')}<b>${v}</b></button>${cmds.length ? `<span class="tac-cmd" title="출전 지휘관 수">지휘관 ${cmds.length}</span>` : ''}${app.tacOpen ? `<span class="tac-pop" role="note"><b>전술 위력 ${v}</b>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}<span class="muted">지휘관의 스킬 · 전술 무기 · [암운] · 감시 포탑은 이 값을 위력으로 씁니다.</span></span>` : ''}</span>`;
}
function prepScreen(run: RunState) {
  const node = run.node;
  const isBattle = !!node?.enc;
  const n = node?.enc?.n || CFG.bossBoard;
  const lay = layout(run, n);
  const cap = R.deployCap(run);
  // 편성 화면은 배치 구역만 보여준다 (바깥 테두리 칸 제외). 좌표는 전장 좌표 그대로
  const { w: fw, h: fh } = boardDims(n);
  // 엔지니어 감시 포탑이 있으면 양옆 가장자리 열(포탑 전용)까지 보여 준다
  const tcs = turretCells(run, n);
  const kc = kingCell(run, n); // 청라공국: 공왕 무휼 (출전 칸 밖, 포탑처럼 끌어 옮긴다)
  const ex = tcs.length || kc ? PAD : 0;
  const bw = fw - 2 * PAD + 2 * ex, bh = fh - 2 * PAD;
  const cellBox = (x: number, y: number) => `left:${((x - PAD + ex) / bw) * 100}%;top:${((y - PAD) / bh) * 100}%;width:${100 / bw}%;height:${100 / bh}%`;
  // 돌격가 경계 (편성 화면에서만 표시): 출전한 아군 돌격가 주변 CFG.zoc.r 칸. 칸 툴팁 = 그 돌격가의 도발 배율로 계산한 교전 시간 (겹치면 긴 쪽)
  const zocCells = new Map<string, number>();
  const zocB = new Battle(fw, fh, new Rng(1), { phase: run.phase, credits: run.credits }), zocCounts = synergyCounts(deployed(run), run);
  zocB.keepEvents = false;
  for (const u of deployed(run)) {
    const p = lay.get(u.uid), d = UNIT_BY_ID[u.defId];
    if (!p || d.ctype !== 'VAN' || d.inert) continue;
    const hold = zocHoldOf(provMult(null, buildAlly(zocB, run, u, zocCounts)));
    for (let dy = -CFG.zoc.r; dy <= CFG.zoc.r; dy++) for (let dx = -CFG.zoc.r; dx <= CFG.zoc.r; dx++) if (dx || dy) { const k = `${p.x + dx},${p.y + dy}`; zocCells.set(k, Math.max(zocCells.get(k) || 0, hold)); }
  }
  const zocTip = (x: number, y: number) => ` title="${esc(zocShort(zocCells.get(`${x},${y}`)))}"`;
  let cells = '';
  for (let y = PAD; y < fh - PAD; y++)
    for (let x = PAD - ex; x < fw - PAD + ex; x++) {
      const mine = y >= ALLY_Y0 && y <= ALLY_Y1;
      const enemyZone = y < PAD + ZONE;
      const zc = zocCells.has(`${x},${y}`);
      if (x < PAD || x >= fw - PAD) { cells += mine ? `<div class="cell tpad${zc ? ' zoc' : ''}" data-drop="tcell:${x}:${y}" title="포탑 · 공왕 전용 칸${zc ? ` · ${esc(zocShort(zocCells.get(`${x},${y}`)))}` : ''}"></div>` : `<div class="cell edge${zc ? ' zoc' : ''}"${zc ? zocTip(x, y) : ''}></div>`; continue; }
      cells += `<div class="cell ${mine ? 'mine' : enemyZone ? 'foe' : 'mid'}${zc ? ' zoc' : ''}" ${mine ? `data-drop="cell:${x}:${y}"` : ''}${zc ? zocTip(x, y) : ''}></div>`;
    }
  let units = '';
  for (const u of deployed(run)) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const d = UNIT_BY_ID[u.defId];
    const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
    units += `<div class="u side0 tk placed ${sel ? 'sel' : ''}" style="${cellBox(p.x, p.y)}"
      data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}" data-syns="${memberships(u, run).join(' ')}">
      <div class="tk-card"><div class="tk-art">${sprite(d, '')}${u.mod ? `<span class="tk-mod" data-a="item-info" data-v="${u.uid}:-1" data-drag="eq:${u.uid}:-1" data-drop="eqitem:${u.uid}:-1" data-hold>${itemIcon(u.mod)}</span>` : ''}</div>
        <span class="tk-side"><b class="tk-rank" title="공명 등급 ${u.rank}">${u.rank}</b><i class="tt-${d.ttype}" title="${TTYPE_NAME[d.ttype]}">${typeIcon(d.ttype)}</i><i class="ct-${d.ctype}" title="${CTYPE_NAME[d.ctype]}">${typeIcon(d.ctype)}</i></span>
        <span class="tk-items">${u.items.map((it, k) => (it ? `<span class="tk-it" data-a="item-info" data-v="${u.uid}:${k}" data-drag="eq:${u.uid}:${k}" data-drop="eqitem:${u.uid}:${k}" data-hold>${itemIcon(it)}</span>` : itemIcon(null))).join('')}</span></div></div>`;
  }
  const tSlots = turretSlots(tcs.length);
  tcs.forEach((p, i) => {
    const sel = app.sel?.k === 'turret' && app.sel.i === i;
    const g = run.turretGear?.[i] || [];
    const slots = [...Array(tSlots).keys()].map((k) => {
      const it = g[k];
      return it ? `<span class="tk-it" data-drag="tgear:${i}:${k}" data-drop="tgear:${i}:${k}" data-hold title="${esc(itemInfo(it).name + ' — ' + itemInfo(it).desc)}">${itemIcon(it)}</span>` : itemIcon(null, `data-drop="tgear:${i}:${k}" title="포탑 장비 칸 — 포탑 전용 장비를 끌어 장착"`);
    }).join('');
    units += `<div class="u side0 tk placed turret-tk${sel ? ' sel' : ''}" style="${cellBox(p.x, p.y)}" data-drag="turret:${i}" data-drop="turret:${i}" data-a="sel-turret" data-v="${i}" data-syns="" title="감시 포탑 ${i + 1} · 기계 — 끌어서 옮기기 · 포탑 전용 장비를 끌어 장착 (판매 · 대기석 불가)">
      <div class="tk-card"><div class="tk-art">${sprite(TURRET_SPR, '')}</div>
        <span class="tk-side"><i class="cat-mech" title="기계 · 구조물: ${esc(CATEGORY_RULE.struct)}">${lineIcon('k.mech', 'li')}</i></span>
        <span class="tk-items">${slots}</span></div></div>`;
  });
  if (kc) {
    const kd = UNIT_BY_ID.muhyul, ks = kingState(run), st = causalStage(run.causal || 0);
    units += `<div class="u side0 tk placed turret-tk king-tk${app.sel?.k === 'king' ? ' sel' : ''}" style="${cellBox(kc.x, kc.y)}" data-drag="king" data-drop="king" data-a="sel-king" data-syns="KING" title="${esc(`공왕 무휼 · 인과 ${st}단계 — 청라공국이 소환 (출전 칸 밖). 끌어서 옮기기 (판매 · 대기석 불가, 전용 장비 자동 장착)`)}">
      <div class="tk-card"><div class="tk-art">${sprite(kd, '')}</div>
        <span class="tk-side"><b class="tk-rank" title="인과 ${st}단계">${st}</b><i class="tt-${kd.ttype}" title="${TTYPE_NAME[kd.ttype]}">${typeIcon(kd.ttype)}</i><i class="ct-${kd.ctype}" title="${CTYPE_NAME[kd.ctype]}">${typeIcon(kd.ctype)}</i></span>
        <span class="tk-items">${[0, 1, 2].map((k) => (ks.items[k] ? `<span class="tk-it" title="${esc(itemInfo(ks.items[k]!).name)}">${itemIcon(ks.items[k]!)}</span>` : itemIcon(null))).join('')}</span></div></div>`;
  }
  if (node?.enc) node.enc.enemies.forEach((s, i) => {
    const e = ENEMY_BY_ID[s.defId];
    const sel = app.sel?.k === 'enemy' && app.sel.i === i;
    units += `<div class="u side1 placed${hasPortrait(e) ? ' tk' : ''} ${e.tier !== 'minion' && !hasPortrait(e) ? 'big' : ''} ${sel ? 'sel' : ''}" style="${(() => { const ec = enemyCell(s.c, s.row, n); return cellBox(ec.x, ec.y); })()}"
      data-a="sel-enemy" data-v="${i}" data-drop="foe:${i}" title="${esc(`${e.name} — ${ENEMY_DESC[e.id] || ''} · ${tendText(e)}`)}">${hasPortrait(e)
        ? (() => { const cat = enemyCategory(e), td = TEND_NAME[e.tend], mod = s.mod || (s.stripped ? null : e.mod), its = [...(s.stripped ? [] : (e.items || []).filter((x): x is string => !!x)), ...(s.items || [])]; return `<div class="tk-card"><div class="tk-art">${sprite(e, '')}${mod ? `<span class="tk-mod">${itemIcon(mod, `data-a="foe-item" data-v="${mod}"`)}</span>` : ''}</div><span class="tk-side">${e.tier === 'minion' ? '' : `<b class="tk-rank tier-${e.tier}" title="${tierKo(e)}">${e.tier === 'boss' ? 'B' : 'E'}</b>`}<i class="cat-${cat}" title="${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}">${lineIcon(`k.${cat}`, 'li')}</i>${td ? `<i class="tk-tend" title="${esc(`${td.name}: ${td.desc}`)}">${lineIcon(`t.${e.tend}`, 'li')}</i>` : ''}</span><span class="tk-items">${[0, 1, 2].map((k) => (its[k] ? itemIcon(its[k], `data-a="foe-item" data-v="${its[k]}"`) : itemIcon(null))).join('')}</span></div>`; })()
        : sprite(e, '')}</div>`;
  });
  const bench = run.units.filter((u) => !u.pos);
  const free = cap - deployed(run).length;
  const canFill = bench.some((u) => R.canDeploy(run, u));
  const env = node?.enc ? `${node.enc.env} · 폭 ${n}칸${node.type === 'adversity' ? ' · 역경' : ''}${node.type === 'challenge' ? ` · 도전 (P${node.enc.phase} 역경급)` : ''}${node.type === 'boss' ? ' · 보스전' : ''}` : '편성 관리';
  return `<main class="wrap prep">
    <aside class="side left">
      <h2>시너지</h2><div class="syn-list">${synergyPanel(run)}</div>
    </aside>
    <section class="board-col">
      <div class="board-head"><b>${esc(env)}</b><span class="pill dep-pill" title="출전 인원 / 출전 한도">출전 <b>${deployed(run).length}</b>/${cap}</span>${tacPill(run)}<span class="muted small">아래 ${ZONE}줄에 배치</span>
        ${free > 0 && canFill ? `<span class="small warn">빈 자리 ${free}</span><button class="btn tiny" data-a="autofill" title="단축키 A">자동 배치</button>` : ''}</div>
      <div class="board-row"><div class="board" style="--w:${bw};--h:${bh}"><div class="cells">${cells}</div>${units}</div>${invRail(run)}</div>
      <div class="bench" data-drop="bench">
        <span class="bench-label">대기 <b>${bench.length}</b></span>
        ${bench.length ? bench.map((u) => {
          const d = UNIT_BY_ID[u.defId];
          const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
          return `<div class="bench-u ${sel ? 'sel' : ''}" data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}" data-syns="${memberships(u, run).join(' ')}">${sprite(d, '')}<span class="ubadge">${rankLabel(u.rank)}</span></div>`;
        }).join('') : '<span class="muted small">기물을 여기로 끌어 출전에서 뺄 수 있습니다.</span>'}
      </div>
      ${invDetail(run)}
      <div class="sticky-actions">
        ${isBattle ? `<button class="btn ghost" data-a="to-map">맵으로</button><button class="btn primary" data-a="fight" title="단축키 Space" ${deployed(run).length ? '' : 'disabled'}>전투 시작</button>`
          : `<button class="btn primary" data-a="to-map">완료</button>`}
      </div>
    </section>
    <aside class="side right">${detailPanel(run)}</aside>
    ${statPopHtml(run)}
  </main>`;
}

const TURRET_SPR = { sprite: 'turret', palette: TURRET_PAL, art: 'sm_turret' };
/** 감시 포탑 상세: 미리보기 전투에서 실제 포탑 능력치를 읽는다 */
function turretDetail(run: RunState, i: number, bar: string) {
  const n = run.node?.enc?.n || CFG.bossBoard;
  const b = buildBattle(run, { n, env: '', enemies: [], mult: 1, seed: 1 }, false);
  const t = b.units.find((u) => u.defId === 'turret' && u.mem.turretIdx === i);
  const g = run.turretGear?.[i] || [];
  const slots = turretSlots(turretCount(run));
  const row = (k: string, v: string) => `<dt>${k}</dt><dd>${v}</dd>`;
  return `<div class="detail">${bar}
    ${heroHead('', sprite(TURRET_SPR, 'spr big'), `감시 포탑 ${i + 1}`, `<span class="tag cat-mech">${lineIcon('k.mech', 'li')}기계</span><span class="tag">구조물</span><span class="tag">엔지니어 소환물</span>`)}
    <div class="small muted">기계: ${esc(CATEGORY_RULE.mech)}<br>구조물: ${esc(CATEGORY_RULE.struct)}</div>
    ${t ? `<dl class="stats">${row('최대 내구도', fmt(t.st.maxHp))}${row('사격 위력', fmt(t.st.shoot))}${row('방어도', fmt(t.st.armor))}${row('공격 속도', `+${Math.round(t.st.atkSpd * 100)}%`)}${row('사거리', String(t.st.range))}${row('피해 속성', ELEM_NAME[t.atk.elem])}</dl>` : '<p class="muted small">엔지니어가 출전해야 포탑이 설치됩니다.</p>'}
    <h3>포탑 장비 <span class="muted small" title="엔지니어 2명 1칸 · 4명 2칸 · 6명 이상 3칸">${slots}칸 · 포탑 전용</span></h3>
    <div class="t-gear">${[...Array(slots).keys()].map((k) => { const it = g[k]; return it
      ? `<div class="t-slot">${itemIcon(it, `data-drag="tgear:${i}:${k}" data-drop="tgear:${i}:${k}"`)}<div><b>${esc(itemInfo(it).name)}</b><div class="small muted">${esc(TURRET_GEAR[it].desc)}</div></div><button class="btn tiny" data-a="tunequip" data-v="${i}:${k}">해제</button></div>`
      : `<div class="t-slot empty">${itemIcon(null, `data-drop="tgear:${i}:${k}"`)}<span class="muted small">빈 칸 — 보관함의 포탑 전용 장비를 끌어 놓거나, 장비를 고른 뒤 포탑을 누르세요.</span></div>`; }).join('')}</div>
    <p class="muted small">장비 칸: 엔지니어 2명 1칸 · 4명 2칸 · 6명 이상 3칸. 포탑 전용 장비는 분기점의 [정비]에서 삽니다. 일반 기물에게는 장착할 수 없고, 칸이 줄거나 엔지니어 시너지가 꺼지면 넘치는 장비는 보관함으로 돌아옵니다.</p>
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
    <p class="small muted">누적 인과율 <b>${pts}</b> · 청라공국 ${counts.CHR || 0}명 (수집 ×${CAUSAL.mult[t] || 0})${t ? ` · 다음 승리 예상 +${g.total} (장비 점수 ${g.score} → +${g.gear})` : ' · 3명 이상이면 소환 · 수집'}</p>
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
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  return `<div class="inv-rail" data-drop="inv" title="기물에게 끌어다 장착 · 재료끼리 겹치면 조합">
    <span class="ir-count">${run.inventory.length}/${CFG.inventoryMax}</span>
    <div class="ir-items">${run.inventory.map((id, i) => itemIcon(id, `data-drag="item:${i}" data-drop="invitem:${i}" data-a="sel-item" data-v="${i}"`, breadNote(run, i)).replace('class="item', `class="item${i === selIdx ? ' sel' : ''}`)).join('')}${run.inventory.length ? '' : '<span class="ir-empty muted">비어 있음</span>'}${relicInv(run)}</div>
  </div>`;
}
/** 상점 등: 가로 보관 칸 */
function inventoryPanel(run: RunState) {
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  return `<div class="inv" data-drop="inv" title="재료끼리 겹치면 조합"><span class="ir-count">${run.inventory.length}/${CFG.inventoryMax}</span>
    <div class="inv-items">${run.inventory.map((id, i) => itemIcon(id, `data-drag="item:${i}" data-drop="invitem:${i}" data-a="sel-item" data-v="${i}"`, breadNote(run, i)).replace('class="item', `class="item${i === selIdx ? ' sel' : ''}`)).join('') || '<span class="muted small">비어 있음</span>'}${relicInv(run)}</div></div>${invDetail(run)}`;
}
/** 보관 중인 성유물: 소모품처럼 보관 칸에 항상 표시. 디바인에게 끌어다 놓거나 선택 후 디바인을 누르면 장착 */
function relicInv(run: RunState) {
  const rs = run.relics || [];
  if (!rs.length) return '';
  const sel = app.sel?.k === 'relic' ? app.sel.id : null;
  return `<span class="ir-sep" title="성유물"></span>${rs.map((id) => relicTok(id, `data-drag="relic:${id}" data-a="sel-relic" data-v="${id}"`, id === sel)).join('')}`;
}
/** 고른 보관 물품: 설명 · 판매 */
function invDetail(run: RunState) {
  const pop = (icon: string, kind: string, name: string, stats: string, eff: string, foot: string) =>
    `<div class="inv-pop" role="dialog" aria-label="${esc(name)}"><div class="ip-head">${icon}<div><span class="ip-kind">${kind}</span><b>${esc(name)}</b></div><button class="btn tiny ip-x" data-a="sel-clear" aria-label="닫기">×</button></div>${stats}${eff ? `<p class="ip-eff">${eff}</p>` : ''}${foot ? `<div class="ip-foot">${foot}</div>` : ''}</div>`;
  if (app.sel?.k === 'relic') {
    const r = RELIC_BY_ID[app.sel.id];
    if (!r) return '';
    return pop(relicTok(r.id), '성유물', r.name, `<div class="ip-stats"><span>${lineIcon('a.divact', 'li')}신권 대행 · 강화 권능 ${r.enh}</span></div>`, statIc(esc(r.desc(1))),
      '<span class="muted small">디바인 기물에 끌어다 놓거나, 선택한 채로 디바인을 누르면 장착합니다.</span>');
  }
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  const sel = selIdx >= 0 ? run.inventory[selIdx] : null;
  if (!sel) return '';
  const it = itemInfo(sel);
  const TIER: Record<string, string> = { C: '재료', G: '고급', A: '희귀', L: '전설', M: '개조부품', K: isLegendConsumable(sel) ? '전설 소모품' : '소모품', U: '고유' };
  const ms = Object.entries(it.majors || {}) as [Major, number][];
  const stats = ms.length ? `<div class="ip-stats">${ms.map(([m, v]) => `<span>${majorIcon(m)}${MAJOR_NAME[m]} <b>+${v}</b></span>`).join('')}</div>` : '';
  // 능력치 줄(ip-stats)로 따로 보여 주는 '생명력 +6, 방어력 +6.' 접두어만 뗀다 — 능력치가 없는 소모품 · 개조부품 · 포탑 장비는 설명 전체 ('공명도 +8.' 등)
  const eff0 = it.desc.replace(/^\[[^\]]+\]\s*/, ''), eff = (ms.length ? eff0.replace(/^([^.,]+ \+\d+(, )?)+\.?\s*/, '') : eff0) + (breadNote(run, selIdx) ? ` — 이 빵: ${breadNote(run, selIdx)}` : '');
  const ct = isConsumable(sel) ? CONSUMABLES[sel].target : null;
  const hint = ct === 'run' ? `<button class="btn small primary" data-a="use-self" data-v="${selIdx}">사용</button>`
    : ct === 'foe' ? `<span class="muted small">${run.node?.enc ? '이번 전투의 적에게 끌어다 놓거나, 선택한 채로 적을 누르면 사용' : '전투를 앞둔 편성 화면에서 적에게 끌어다 놓아 사용'}</span>`
    : ct ? `<span class="muted small">${ct === 'unit' ? '기물' : '장비'}에 끌어다 놓거나, 선택한 채로 ${ct === 'unit' ? '기물' : '보관함의 장비'}을 누르면 사용</span>`
    : run.inventory.some((x, j) => j !== selIdx && combine(sel, x)) ? '<span class="muted small">조합 가능한 장비를 누르면 조합</span>' : '';
  return pop(itemIcon(sel), TIER[sel.startsWith('U_') ? 'U' : it.tier] || '', it.name, stats, eff ? statIc(esc(eff)) : '', `<button class="btn small" data-a="sell" data-v="${selIdx}">판매 +${R.sellPrice(run, sel)}</button>${hint}`);
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
  const sec = CFG.ultTime / (ul.charge * Math.max(0.1, 1 + eff));
  const chips = `<div class="ab-chips"><span class="abc" title="자연 충전 주기">${lineIcon('a.cd', 'li')}${sec.toFixed(0)}초</span><span class="abc" title="전투 시작 게이지">${lineIcon('a.battery', 'li')}시작 ${Math.round((CFG.ultStart + (c?.mem.ultStart || 0)) * 100)}%</span>${live && c ? `<span class="abc v">${Math.round((c.ultG || 0) * 100)}%</span>` : ''}</div>`;
  return abilCard('ult', 'ult', ul.name, `약 ${sec.toFixed(0)}초`, `${chips}<p>${statIc(esc(ul.desc))}</p>`, '', `ult.${d.id}`);
}
/** 디바인 신권 대행 카드: 장착한 성유물 */
/** 성유물 섹션: 장착 슬롯 + 종속 하위 능력(신권 대행) */
function relicSection(d: UnitDef, u: UnitState | null, run: RunState | null, c: CUnit | null, live = false) {
  if (d.ttype !== 'divine') {
    // 성찬(도로스)으로 깨어난 기물: 성유물이 없으므로 전투 유형 기본형 신권 대행 (전투 중) · 깨어날 수 있으면 미리보기 (편성)
    const woke = live && awakened(d, c);
    if (!woke && !dorosReady(d, run)) return '';
    const da = DIVINE_ACT[d.ctype];
    const chips = `<div class="ab-chips"><span class="abc" title="신성력이 가득 차면 발동">${lineIcon('a.divact', 'li')}신성력 100</span><span class="abc">전투당 1회</span>${woke && c ? `<span class="abc v">${c.divUsed ? '발동함' : Math.round(c.div || 0)}</span>` : '<span class="abc">성찬을 받으면</span>'}</div>`;
    return `<section class="abil ab-relic"><div class="rl-act ab-click${abilOn('divact')}" data-a="abil-pop" data-v="divact" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">신권 대행 · 성찬</span><b>${lineIcon('a.divact', 'li ab-ic')}${esc(da.name)}</b></div>${chips}<p>${esc(da.desc)}. 성유물이 없어 ${esc(CTYPE_NAME[d.ctype])} 기본형을 쓴다.</p></div></section>`;
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
    act = `<div class="rl-act ab-click${abilOn('divact')}" data-a="abil-pop" data-v="divact" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">신권 대행</span><b>${lineIcon('a.divact', 'li ab-ic')}${esc(rel.name)}</b></div>${chips}<p>${statIc(esc(rel.desc(k)))}</p></div>`;
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
  const k = (m.extra ? CFG.bond.extra : 1) * (m.sd.rate || 1);
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
    // 이름은 소환물이 여러 종류일 때만 (한 종류면 섹션 머리에 이미 있다)
    const head = `<div class="sm-id">${sprite(s, 'spr sm-face')}<span class="sm-nm">${kinds.length > 1 ? `<b>${esc(sd.name)}</b>` : ''}${ms.length > 1 ? `<span class="sm-n" title="전투 시작 시 불려 나오는 수">${ms.length}기</span>` : ''}<span class="dh-types">${ct ? `<i>${typeIcon(ct)}${CTYPE_NAME[ct]}</i>` : ''}${categoryTag(s.category)}</span></span></div>`;
    const chips = `<div class="ab-chips"><span class="abc sm-bond" title="${esc(`스탯 상속률: 주인의 체력 · 위력 · 방어도를 물려받는 비율 (명중 · 치명타 · 효과 명중 · 효과 저항 · 회피는 주인 값 그대로). ${bondNote(c, m)}`)}">${lineIcon('a.summon', 'li')}상속률 <b>${sumPc(m.rate)}</b></span>`
      + (ex.length ? `<span class="abc" title="${esc(`추가로 불린 소환물 ${ex.length}기: 상속률 ×${CFG.bond.extra}`)}">추가 ${ex.length}기 <b>${sumPc(ex[0].rate)}</b></span>` : '')
      + `<span class="abc" title="${hpLabel(s)}">${lineIcon('a.hp', 'li')}${fmt(sumS(b, s, 'maxHp'))}</span>`
      + `<span class="abc" title="${pow === 'shoot' ? '사격' : '타격'} 위력">${lineIcon(`p.${pow}`, 'li')}${fmt(sumS(b, s, pow))}</span>`
      + `<span class="abc" title="${esc(`도발 배율: 적이 이 소환물에게 쌓는 도발 수치에 곱해지는 값 (${ct ? `${CTYPE_NAME[ct]} 소환물` : '소환물'}). 돌격가 경계는 소환물에게 없다.`)}">${lineIcon('p.prov', 'li')}×${+pv.toFixed(2)}</span></div>`;
    const atk = `<div class="ps-card ab-click${abilOn(`summon:atk:${k}`)}" data-a="abil-pop" data-v="summon:atk:${k}" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">기본 공격</span><b>${WPOS(range)}</b></div><div class="ab-chips">${AB.chip('u.range', `${range}칸`, '사거리')}${AB.powNum(ctx, pow, sd.basicMult || 1, false, false, s.atk.elem)}${AB.chip('a.speed', `${s.atk.interval}초`, '공격 간격')}</div></div>`;
    const sk = info ? `<div class="ps-card ab-click${abilOn(`summon:skill:${k}`)}" data-a="abil-pop" data-v="summon:skill:${k}" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">기술 · 연계</span><b>${esc(d.skill.name)}</b></div><div class="ab-chips">${AB.skillChips(info, ctx, range, c.cdMax)}</div></div>` : '';
    return `<div class="sm-unit">${head}${chips}<div class="ps-cards">${atk}${sk}</div></div>`;
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
  return abilCard('skill', 'skill', d.skill.name, info ? '' : `${cd.toFixed(1)}초`, info ? `<div class="ab-chips">${AB.skillChips(info, actx(b, c, true), range, cd)}</div>` : `<p>${esc(skillText(d, p))}</p>`, '', `skill.${d.id}`);
}
const traitHtml = (d: UnitDef, b: Battle | null, c: CUnit | null) => {
  const t = ABIL[d.id]?.trait;
  return t ? `<p>${statIc(AB.tok(t, actx(b, c, false, d), new Set()))}</p>` : `<p>${esc(traitText(d))}</p>`;
};
function augText(id: string, param: string | undefined, b: Battle | null, c: CUnit | null, gl = new Set<string>()) {
  const t = augAbilText(id);
  return t ? statIc(AB.tok(t, actx(b, c, AUG_BY_ID[id]?.pool === 'unit'), gl)) : esc(augDesc(id, param)); // 기물 전용 증강은 대부분 스킬 강화
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
    body = info ? AB.skillBody(info, actx(b, c, true), b && c ? b.S(c, 'range') : d.range, cd, gl) : `<p>${esc(d.skill.desc(p))}</p><p class="muted small">쿨다운 ${cd.toFixed(1)}초</p>`;
  } else if (key === 'ult' && ULTS[d.id]) {
    const ul = ULTS[d.id];
    const sec = CFG.ultTime / (ul.charge * Math.max(0.1, 1 + (c && b ? b.S(c, 'ultCharge') : 0)));
    kind = '궁극기'; name = ul.name; mech = `시간이 지나면 저절로 차오른다 (약 ${sec.toFixed(0)}초, 전투 시작 ${Math.round(CFG.ultStart * 100)}%). 가득 차면 다음 행동에 기술보다 먼저 발동하고, 한 전투에 여러 번 쓸 수 있다. 충전 효율이 높을수록 빨리 찬다.`;
    body = `<p>${statIc(esc(ul.desc))}</p><p class="muted small">“${esc(ul.line)}”</p>`;
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
      body = psiTfNote(cv.transform, cv.mods, sc.cantrip.name) + AB.skillBody(cv.info, ctx, b && c ? b.S(c, 'range') : d.range, cd, gl) + AB.rowsHtml([['이성 소모', `${lineIcon('a.reason', 'li')}-${cv.cost}`]]);
    }
  } else if (key === 'psipass') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = forcedSchool || cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '지속 능력'; name = sc?.passive.name || '지속 능력';
    mech = '전투 내내 적용된다. 확률 발동은 평타 · 전투 스킬 · 비술이 적중할 때만 판정하고, 지속 피해 · 소환물 공격은 판정하지 않는다.';
    const pv = sc ? passiveView(sc.id, forcedSchool ? [] : psiAugsFor(d, c)) : null;
    body = sc && pv ? psiTfNote(pv.transform, pv.mods, sc.passive.name) + AB.rowsHtml(pv.rows.map(([k, v]) => [k, statIc(AB.tok(v, ctx, gl))] as [string, string])) : '';
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
    body = rel ? `<p>${statIc(esc(rel.desc(c?.mem.enh || 1)))}</p><p class="muted small">강화 비용 권능 ${rel.enh}</p>` : `<p>${esc(da.desc)}.</p>`;
  } else if (key === 'trait') {
    kind = '특성'; name = d.trait.name; mech = '전투 내내 적용되는 이 기물의 고유 효과.';
    const t = ABIL[d.id]?.trait;
    body = `<p>${t ? statIc(AB.tok(t, ctx, gl)) : esc(d.trait.desc)}</p>`;
  } else if (key === 'ace' && d.ace) {
    kind = '에이스'; name = d.ace.name; mech = '항해자 시너지 활성 시, 에이스 파일럿으로 지정한 출전 기물에게만 발동. 항해자 단계가 오를수록 강해짐.';
    const t = ABIL[d.id]?.ace?.(aceK);
    body = `<p>${t ? statIc(AB.tok(t, ctx, gl)) : esc(d.ace.desc(aceK))}</p>`;
  } else if (key === 'voy' && VOYAGE_SPECIAL[d.id]) {
    const v = VOYAGE_SPECIAL[d.id];
    kind = '출항'; name = v.name; mech = '우리의 출항기! 구성원이 정확히 1명 또는 5명 출전하면, 출전한 구성원 전원에게 발동.';
    body = `<p>${statIc(esc(v.text))}</p>`;
  } else if (key.startsWith('aug:')) {
    const id = key.slice(4);
    kind = '증강'; name = AUG_BY_ID[id]?.name || id;
    const pool = AUG_BY_ID[id]?.pool;
    mech = pool === 'unit' ? '이 기물 전용 증강. 획득하면 영구 적용.' : pool === 'special' ? '스페셜 기물 합류 시 고르는 증강. 영구 적용.' : pool === 'psionic' ? '사이오닉 증강. 이성 규칙을 바꾼다. 영구 적용.' : '공용 증강. 영구 적용.';
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
  const trait = ab?.trait ? abilCard('trait', 'trait', '특성', '', `<p>${statIc(AB.tok(ab.trait, actx(b, c), new Set()))}</p>`) : '';
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
    body = `<p>${statIc(AB.tok(ab.trait, ctx, gl))}</p>`;
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
  return `<div class="ab-ace-wrap${on ? ' on' : ''}">${abilCard('ace', 'skill', d.ace.name, on ? '활성' : '비활성', `<p>${t ? statIc(AB.tok(t, actx(null, null), new Set())) : esc(d.ace.desc(k))}</p>`).replace('ab-skill', 'ab-ace')}${ctl}</div>`;
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
  const zoc = c.side === 0 && c.ctype === 'VAN' && !c.isSummon ? ` 돌격가 경계 교전 시간 ${+zocHoldOf(m).toFixed(3)}초 (${zocHoldFormula()}).` : '';
  return `<span class="d-pow pw-prov" title="도발 배율: 적이 이 기물에게 쌓는 도발 수치에 곱해지는 값 (${rule}).${zoc}">${lineIcon('p.prov', 'li')}<span>도발 배율</span><b>×${+m.toFixed(2)}</b></span>`;
}
/** 확대 버튼 (전체 상세 팝업): 상세 창 위쪽 바 (자세히 보기 옆) */
const maxBtn = (uid: string) => `<button class="btn d-mag d-max" data-a="big-open" data-v="${uid}" title="전체 상세 (확대)" aria-label="전체 상세 열기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg></button>`;
/** 기물 전체 상세 팝업: 장비 · 주요 · 상세 능력치 · 능력 구성 · 유형 특성을 한 화면에 */
/** 전체 상세 머리 요약: 한 줄 설명 (brief.ts BLURB, 능력 이름은 데이터에서) → 이번 빌드에서 달라진 점 (변형 증강이면 그 변화를 먼저) */
function unitSummary(run: RunState, u: UnitState, d: UnitDef, b: Battle, c: CUnit) {
  const blurb = unitBlurb(d);
  const sc = schoolOf(u);
  const cv = sc ? cantripView(sc, u.augments) : null, pv = sc ? passiveView(sc, u.augments) : null;
  const changes: string[] = [];
  if (cv?.transform) changes.push(`<b>◆ 현재 비술은 「${esc(cv.transform)}」으로 변형됨</b>`);
  if (pv?.transform) changes.push(`<b>◆ 지속 능력이 「${esc(pv.transform)}」으로 변형됨</b>`);
  const mods = [...new Set([...(cv?.mods || []), ...(pv?.mods || [])])];
  if (mods.length) changes.push(`전공 증강 반영: ${mods.map(esc).join(' · ')}`);
  const augs = (u.augments.filter((a) => !a.id.startsWith('school.')).map((a) => AUG_BY_ID[a.id]?.name).filter(Boolean) as string[]).filter((n) => !mods.includes(n) && n !== cv?.transform && n !== pv?.transform);
  if (augs.length) changes.push(`증강 ${augs.length}개: ${augs.slice(0, 4).map(esc).join(' · ')}${augs.length > 4 ? ' …' : ''}`);
  const items = u.items.filter(Boolean).length + (u.mod ? 1 : 0);
  if (items) changes.push(`장비 ${items}개 장착`);
  void run; void b; void c;
  return `<section class="um-sum" aria-label="요약">
    ${blurb ? `<p class="us-blurb">${esc(blurb).replace(/「([^」]*)」/g, '<b>「$1」</b>')}</p>` : ''}
    <div class="us-row us-build"><span class="us-k">이번 빌드</span><p>${changes.length ? changes.join('<br>') : '<span class="muted">기본 상태 (증강 · 장비 없음)</span>'}</p></div>
  </section>`;
}
function unitModal(run: RunState) {
  const u = run.units.find((x) => x.uid === app.bigUnit);
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
  const rankRow = `<div class="um-rank">${rankLabel(u.rank)}${xpBar(u)}<button class="btn tiny" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost || R.isRock(u) ? 'disabled' : ''}>경험치 +${cost}c</button></div>`;
  const synRow = `<div class="pc-syn">${memberships(u, run).map((id) => synToken(id, cnt[id] || 0)).join('')}</div>`;
  return `<div class="um-back" data-a="big-close"></div>
  <section class="um" role="dialog" aria-modal="true" aria-label="${esc(d.name)} 전체 상세">
    <header class="um-head">
      <div class="um-id"><b>${esc(d.name)}</b><span class="muted small">${esc(d.title || '')}</span></div>
      <span class="dh-types"><i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i>${categoryTag(cat)}</span>
      <span class="um-tools">${detailToggle()}<button class="btn small danger-ghost" data-a="release" data-v="${u.uid}" ${run.units.length <= 1 ? 'disabled title="마지막 남은 기물은 방출할 수 없습니다"' : 'title="기물 방출 (확인 후 진행)"'} aria-expanded="${app.releaseConfirm === u.uid}">기물 방출</button><button class="btn" data-a="big-close" aria-label="닫기" title="닫기 (Esc)">✕</button></span>
    </header>
    ${app.releaseConfirm === u.uid ? `<div class="um-release">${releaseBlock(run, u)}</div>` : ''}
    <div class="um-grid">
      <div class="um-col um-a">
        <div class="um-sticky"><div class="um-sc" aria-hidden="true">${sprite(d, 'um-face')}<div class="um-sc-main">${rankRow}${synRow}</div></div></div>
        <div class="um-art">${hero(d.id) || sprite(d, 'spr big')}</div>
        <div class="um-idblk">${rankRow}
        ${synRow}</div>
        <h3>장비</h3>${eqBox(u)}
        ${rel ? `<div class="um-relic">${relicTok(rel.id)}<span><b>${esc(rel.name)}</b><br><span class="muted small">성유물 · 신권 대행</span></span></div>` : ''}
        <h3>주요 능력치</h3>${majors}
        ${powRow(b, c, d, !!u.pos)}
        <h3>상세 능력치</h3>${statLines(c, b)}
      </div>
      <div class="um-main">
        ${unitSummary(run, u, d, b, c)}
        <div class="um-col um-c">
          <h3>전투 유형</h3>
          <dl class="um-types">
            <dt>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</dt><dd>${esc(CTYPE_DESC[d.ctype]?.[app.detail ? 1 : 0] || '')}</dd>
            <dt>${CATEGORY_NAME[cat]}</dt><dd>${esc(CATEGORY_RULE[cat])}</dd>
          </dl>
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
          <h3>신앙</h3>
          <div class="abils">${faithAbil(d, u, run)}</div>
          <h3>전술 유형</h3>
          <dl class="um-types">
            <dt>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</dt><dd>${esc(TTYPE_RULE[d.ttype])}</dd>
          </dl>
          <div class="abils">
            ${ultCard(d, b, c)}
            ${ttSection(d, u, run, b, c)}${relicSection(d, u, run, c)}
          </div>
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
  if (!enc) return `<div class="detail pb"><h3>이 전장의 주요 적</h3>${matchupHtml(run.field) || '<p class="small muted">특별한 면역 · 취약 없음</p>'}${PREP_TIPS}</div>`;
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
  const row = (icon: string, name: string, n: number, tags: string, cls = '', st = '') => `<li class="pb-row"><i class="pb-ri ${cls}"${st ? ` style="${st}"` : ''}>${icon}</i><b>${esc(name)}</b><span class="pb-cnt">${n}명</span><span class="pb-tags">${tags}</span></li>`;
  const tag = (txt: string, tone: 'good' | 'bad' | 'mute') => tchip('', esc(txt), tone);
  const muRows = [
    ...mu.cats.map((x) => row(lineIcon(`k.${x.c}`, 'li'), CATEGORY_NAME[x.c], x.n, [x.weak.length ? tag(`${x.weak.join('·')} 취약`, 'good') : '', x.resist.length ? tag(`${x.resist.join('·')} 저항`, 'bad') : '', x.immune.length ? tag(`${x.immune.join('·')} 면역`, 'mute') : ''].join(''), `cat-${x.c}`)),
    mu.bosses ? row(NODE_ICON.boss, NODE_NAME.boss, mu.bosses, tag(`${mu.bossImmune.join('·')} 면역`, 'mute'), '', '--c:var(--c-bad)') : '',
  ].join('');
  const elRows = mu.elems.map((x) => row(lineIcon(`e.${x.e}`, 'li'), x.name, x.allies, `${x.weak ? tag(`적 ${x.weak}명 취약`, 'good') : ''}${x.resist ? tag(`적 ${x.resist}명 저항`, 'bad') : ''}`, '', `--c:var(--el-${x.e})`)).join('');
  return `<div class="detail pb" aria-label="이번 전투 적 구성">
    <div class="pb-head"><h3>이번 전투</h3><span class="pb-kind n-${type}">${esc(kind)}</span><span class="muted small">적 ${mu.foes}명 · 체력 ×${+enc.mult.toFixed(2)}</span>${diffAddChip(run, enc.phase ?? run.phase, enc.add || 0)}</div>
    <ul class="pb-foes">${rows.map(foe).join('')}</ul>
    <h3>상성</h3>
    <ul class="pb-rows">${muRows || '<li class="pb-row muted">특별한 면역 · 취약 없음</li>'}</ul>
    ${elRows ? `<h3>아군 공격 속성 <span class="muted small">출전 ${allies.length}명</span></h3><ul class="pb-rows">${elRows}</ul>` : ''}
    ${PREP_TIPS}
  </div>`;
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
  tip.className = `item-tip tip-${id.startsWith('U_') ? 'U' : it.tier}`;
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
  if (sel?.k === 'enemy' && run.node?.enc) {
    const s = run.node.enc.enemies[sel.i];
    if (!s) return '';
    const e = ENEMY_BY_ID[s.defId];
    const ph = run.node.enc.phase ?? run.phase; // 도전은 다음 페이즈 적
    const b = new Battle(9, 9, new Rng(1), { phase: ph, credits: 0, field: run.field, diff: run.diff, despairs: run.despairs, oaths: run.oaths }); // 실제 전투와 같은 전장 · 위험 등급 · 절망 증강 · 절망 서약 (체력 · 피해 배율)
    const c = buildEnemy(b, e, ph, run.node.enc.mult, s);
    const ms = battleMajors(c)!;
    const eq = foeGear(e, s);
    return `<div class="detail">${bar}
      ${foeHead(e, sprite(e, 'spr big'), unitRank(e, c))}
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
  return `<div class="detail dp-unit">${dBar('desel', maxBtn(u.uid) + extra)}
    <div class="um-sticky dp-sticky"><div class="um-sc" aria-hidden="true">${sprite(d, 'um-face')}<div class="um-sc-main"><div class="um-rank">${rankLabel(u.rank)}${xpBar(u)}</div><div class="pc-syn">${synTok}</div></div></div></div>
    <div class="d-hero">${hero(d.id) || `<div class="hero none">${sprite(d, 'spr big')}</div>`}
      <div class="pc-syn dh-syn">${synTok}</div>
      <div class="dh-name"><b>${esc(d.name)}</b><span class="dh-types"><i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i></span></div></div>
    <div class="dh-rank"><span class="dh-r">${rankLabel(u.rank)}</span>${xpBar(u)}<button class="btn tiny dh-buy" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost || R.isRock(u) ? 'disabled' : ''} title="공명도 +${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)} 구입 (에너지 크레딧 ${cost})">${lineIcon('r.res', 'li res')}+${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)}<span class="dh-cost">${lineIcon('r.cr', 'li cr')}${cost}</span></button></div>
    ${powRow(b, c, d, !!u.pos)}
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
      ${faithAbil(d, u, run)}
      ${ttSection(d, u, run, b, c)}${relicSection(d, u, run, c)}
    </div>
    <p class="lore">${esc(d.lore)}</p>
    ${releaseBlock(run, u)}
  </div>`;
}

// ───────────────────────── 화면: 전투
/** 전투 보드 칸 (테두리 · 적 진형 · 간격 · 아군 진형 색 구분) */
function battleCells(W: number) {
  const { w, h } = boardDims(W);
  let out = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const pad = x < PAD || x >= w - PAD || y < PAD || y >= h - PAD;
    out += `<div class="cell ${pad ? 'pad' : y >= ALLY_Y0 && y <= ALLY_Y1 ? 'mine' : y < PAD + ZONE ? 'foe' : 'mid'}"></div>`;
  }
  return out;
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
const bviewEx = (run: RunState) => (!app.zoomOut && (turretCount(run) > 0 || kingOn(run)) ? PAD : 0);
function battleScreen(run: RunState) {
  const enc = run.node!.enc!;
  return `<main class="wrap battle">
    <aside class="side left">
      <div class="meter-tabs">${([['dmg', '준 피해'], ['taken', '받은 피해'], ['support', '회복 · 보호막'], ['kills', '결정타']] as const).map(([k, l]) => `<button class="btn tiny ${app.meterTab === k ? 'on' : ''}" data-a="meter-tab" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="meter" class="meter"></div>
      <section class="bf-wrap bf-sk" aria-label="스킬 사용"><h4 class="bf-h">스킬 사용</h4><ol id="bf-skill" class="bfeed"></ol></section>
    </aside>
    <section class="board-col">
      <div class="board-head"><b>${esc(enc.env)}</b><span id="btime" class="mono">0.0초</span><span id="bslow" class="bslow" hidden title="상세 정보를 보는 중 · 설정에서 끌 수 있습니다">상세 보기 ×0.25</span>
        <span class="speed"><button class="btn tiny pause${app.paused ? ' on' : ''}" data-a="pause" title="일시 정지 (Space)" aria-label="일시 정지">${app.paused ? '▶' : '❚❚'}</button>${SPEEDS.map((s) => `<button class="btn tiny ${app.speed === s ? 'on' : ''}" data-a="speed" data-v="${s}">${s}×</button>`).join('')}
        <button class="btn tiny" data-a="skip">결과로</button></span></div>
      <div class="board bview${app.zoomOut ? ' full' : ''}" data-a="bdesel" data-ex="${bviewEx(run)}" style="--ox:${PAD - bviewEx(run)};--w:${boardDims(enc.n).w - (app.zoomOut ? 0 : 2 * PAD - 2 * bviewEx(run))};--h:${boardDims(enc.n).h - (app.zoomOut ? 0 : 2 * PAD)};--fw:${boardDims(enc.n).w};--fh:${boardDims(enc.n).h}"><div class="board-in" id="bboard"><div class="cells">${battleCells(enc.n)}</div></div></div>
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
  m.innerHTML = rows.map((a) => `<div class="mrow ${a.u.alive ? '' : 'dead'} ${app.battleSel === a.u.id ? 'sel' : ''}" data-a="bsel" data-v="${a.u.id}">${sprite(a.u)}<span class="mname">${esc(a.u.name)}</span>
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
  const rows = aggAllies(b);
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
function shopScreen(run: RunState) {
  const stock = run.node?.shop || [];
  return `<main class="wrap">
    <div class="screen-head">${run.node?.maint ? `<h1>정비</h1><p class="muted">엔지니어의 정비 창고입니다. 포탑 전용 장비는 감시 포탑에만 장착할 수 있습니다 (일반 기물 장착 불가). 보급형 1개는 무료입니다. 보관함의 장비를 아래 포탑 칸에 끌어 놓거나, 편성 화면의 포탑에 끌어 놓으세요.</p>` : run.node?.synth ? `<h1>합성 공방</h1><p class="muted">신비학자의 비밀 공방입니다. 소모품은 보관함에 들어가며, 보관함에서 기물이나 장비에 끌어다 놓아 사용합니다.</p>` : `<h1>암시장 상점</h1><p class="muted">재료 2개를 같은 기물에 장착하거나 보관함에서 겹치면 합성됩니다. 같은 재료 → 고급 장비(능력치 +12), 서로 다른 재료 → 희귀 장비(능력치 +6 + 고유 효과). 전설 장비는 합성할 수 없습니다. 가끔 소모품이, 드물게 문장이 들어오고, ${CFG.shop.gearFrom}페이즈부터는 고급 · 희귀 장비가 1개 이상 늘 진열됩니다.</p>`}</div>
    <div class="shop">${stock.map((s, i) => {
      const it = itemInfo(s.item);
      return `<div class="shop-item t${isLegendConsumable(s.item) ? 'L' : it.tier} ${s.sold ? 'sold' : ''}">${itemIcon(s.item)}<div><b>${esc(it.name)}</b><div class="small muted">${statIc(esc(it.desc))}</div></div>
        <button class="btn small" data-a="buy" data-v="${i}" ${s.sold || run.credits < s.price ? 'disabled' : ''}>${s.sold ? '판매됨' : s.price ? `${CR}${s.price}` : '무료'}</button></div>`;
    }).join('')}</div>
    ${run.node?.maint ? maintTurrets(run) : ''}
    ${inventoryPanel(run)}
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">떠나기</button></div>
  </main>`;
}
/** 정비: 포탑별 장비 칸 (끌어 놓아 장착 · 보관함으로 끌어 해제) */
function maintTurrets(run: RunState) {
  const n = turretCount(run), slots = turretSlots(n);
  if (!n) return '<p class="muted small">엔지니어가 출전하지 않아 설치된 포탑이 없습니다.</p>';
  return `<div class="maint-tur"><h3>감시 포탑 <span class="muted small">${n}기 · 포탑마다 ${slots}칸</span></h3><div class="mt-list">${[...Array(n).keys()].map((i) => {
    const g = run.turretGear?.[i] || [];
    return `<div class="mt-row" data-drop="turret:${i}">${sprite(TURRET_SPR)}<b>포탑 ${i + 1}</b><span class="tag cat-mech">${lineIcon('k.mech', 'li')}기계</span><span class="mt-slots">${[...Array(slots).keys()].map((k) => g[k] ? itemIcon(g[k], `data-drag="tgear:${i}:${k}" data-drop="tgear:${i}:${k}"`) : itemIcon(null, `data-drop="tgear:${i}:${k}"`)).join('')}</span></div>`;
  }).join('')}</div></div>`;
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
    <div class="screen-head"><h1>호이슌 투자 창구</h1><p class="muted">호이슌 홀딩스가 특별 상품을 내밀었습니다. 보유 ${CR}<b class="accent">${run.credits}</b> <span class="small" title="${esc(interestLines(run).tip)}">(다음 전투 이자 +${R.interestInfo(run).interest})</span>${run.fund ? ` · 다음 페이즈 정산 예정 <b>${run.fund}</b>` : ''}</p></div>
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
    actions: '<button class="btn primary" data-a="newrun">새 계약</button><button class="btn" data-a="bar">에란테스 바</button><button class="btn" data-a="codex">도감</button><button class="btn" data-a="to-title">타이틀</button>',
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
    playAdv(`ev:${p.id}:${run.pending.length}`, R.eventScene(p), {
      title: ev.title, speaker: advSpeaker, fmt: (x) => ic(esc(x)),
      choices: ev.choices.map((c) => ({ label: c.label, desc: c.desc, why: c.block?.(run) || undefined })),
      onDone: (k) => act('event-choice', String(k)),
    });
  } else if (live && p.t === 'notice' && p.scene?.length) {
    playAdv(`nt:${p.title}:${run.pending.length}`, p.scene, { title: p.title, result: p.body, speaker: advSpeaker, fmt: (x) => ic(esc(x)), onDone: () => act('notice-ok', '') });
  } else if (advKey() && !advKey()!.startsWith('tu:') && !(app.screen === 'bar' && advKey()!.startsWith('bar:'))) closeAdv(); // 튜토리얼 장면은 튜토리얼이, 바 장면은 바가 닫는다
}
// ───────────────────────── 모달: 대기 중인 선택
function pendingModal(run: RunState): string {
  const p = run.pending[0];
  if (!p || app.screen === 'battle' || app.screen === 'over') return '';
  let body = '', mcls = '';
  if (p.t === 'global') {
    mcls = 'global';
    body = `<h1>${p.rerolls !== undefined ? '항로 회의 — ' : ''}전역 증강</h1><p class="muted small">런 끝까지 함대 전체에 적용됩니다. 한 장을 고르세요.</p>
      <div class="gc-row">${p.options.map((id, i) => { const g = GLOBAL_BY_ID[id]; const h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7); return `<button class="gcard" style="--i:${i};--h:${h}" data-a="pick-global" data-v="${id}">
        <i class="cback" aria-hidden="true"></i><span class="gc-sigil" aria-hidden="true">✦</span>
        <span class="gc-kind">${g.unique ? '고유 · ' : ''}전역</span><b>${esc(g.name)}</b><span class="gc-desc">${ic(esc(g.desc))}</span></button>`; }).join('')}</div>
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
        <div class="ru-head"><h1>${p.round ? `${p.rank}등급 달성 보상 · <b class="accent">대성공!</b>` : `${p.rank}등급 달성 보상 · 능력치`}</h1></div>
        ${p.round
          ? `<p class="small"><b class="accent">대성공 — 주요 능력치를 한 번 더 고릅니다.</b> 서로 다른 ${CFG.rankPicks}개를 골라 각각 <b class="accent">+${p.points}</b> (방금 고른 능력치를 다시 고르면 그 능력치는 +${p.points * 2})</p>`
          : `<p class="muted small">마이너 기물이 공명 등급 3의 배수마다 받는 보상입니다. 서로 다른 주요 능력치 ${CFG.rankPicks}개를 골라 각각 <b class="accent">+${p.points}</b>${p.options?.length === 0 ? '' : ` · 이어서 ${p.rank}등급 증강`}<br>확정할 때 ${Math.round(CFG.greatChance * 100)}% 확률로 <b>대성공</b>: 한 번 더 고른다 (상승량 2배) · (등급이 오를 때마다 모든 스탯 +${CFG.rankAll}은 이미 반영됨)</p>`}
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
        <div class="ru-head"><h1>${p.kind === 'school' ? '합류 · 사이오닉 전공' : p.kind === 'special' ? (p.join ? '합류 보상 · 전용 증강' : `${p.rank}등급 달성 · 전용 증강`) : p.kind === 'psionic' ? `${p.rank}등급 달성 · 전공 증강` : `${p.rank}등급 달성 · 메이저 증강`}</h1>
          <span class="muted small">${p.kind === 'school' ? `${UNIT_GROUP[d.id] ? GROUPS[UNIT_GROUP[d.id]].name + '의 ' : ''}전공을 하나 고르세요. 비술과 지속 능력이 바로 붙고, 4 · 8 · 12 · 16등급에 전공 증강을 고릅니다.${d.id === 'rachel' ? ' 레이첼은 모든 학파의 전공을 고를 수 있습니다.' : ''}` : p.kind === 'special' ? '스페셜 기물은 합류할 때와 5 · 10 · 15등급에 전용 증강을 고릅니다 (최대 4개).' : p.kind === 'psionic' ? `사이오닉 기물은 4 · 8 · 12 · 16등급에 전공 증강을 고릅니다 (최대 4개). 이번 ★ 전설 출현 확률 ${Math.round(R.psiLegendChance(u) * 100)}% (전설을 얻기 전까지 선택마다 +${Math.round(CFG.psiLegend.pity * 100)}%p)` : '메이저 기물은 4등급마다 메이저 증강을 고릅니다.'}</span>
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
  } else if (p.t === 'itemPick') {
    body = `<h1>${esc(p.title)}</h1><div class="cards">${p.options.map((id, i) => { const it = itemInfo(id); return `<button class="card" data-a="pick-item" data-v="${i}">${itemIcon(id)}<b>${esc(it.name)}</b><span>${statIc(esc(it.desc))}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'recruit') {
    const rank = Math.min(CFG.maxRank, R.joinRank(run) + (R.hasGlobal(run, 'G.scout') ? 1 : 0));
    const rr = p.rerolls ?? 1;
    mcls = 'recruit';
    const pick = app.recruitPick && p.options.includes(app.recruitPick) ? app.recruitPick : null;
    body = `<div class="rc-head"><div><h1>${p.syns ? '지정 소집' : '기물 영입'}</h1><p class="muted small">${p.syns ? `${p.syns.map((s) => esc(SYN_BY_ID[s as SynergyId]?.name || s)).join(' · ')} 중에서 ` : ''}새 동료 한 명을 고르세요. 공명 등급 ${rank}로 합류합니다. 보유 ${run.units.length}/${CFG.maxParty} (출전 최대 ${R.deployCap(run)}명)</p><p class="mu-short small" title="사이오닉 전공은 합류할 때 정해집니다">이 전장의 주요 적: ${esc(matchupShort(run.field))}</p></div>${detailToggle()}</div>
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
      shop: `재료 ${CFG.drop.shopParts}개 확정 · 희귀 / 고급 장비${run.phase >= CFG.shop.gearFrom ? ' 1개 이상 확정' : ''} · 가끔 소모품 · 드물게 문장 · 전설`, supply: '보급품 3종 중 택1',
      news: `은하 속보: 명성 ${run.fame}을 보상으로 교환`, recruit: '기물 영입 기회 (후보 중 1명)',
      invest: '호이슌 투자 상품 (페이즈당 1회)', maint: '엔지니어 정비: 포탑 전용 장비 구매 (보급형 1개 무료)', pilgrim: `권능 +1 후 순례 (페이즈당 1회) · 보유 권능 ${run.power}`,
    };
    body = `<h1>분기점</h1><p class="muted small">어디로 향할지 고르세요.</p><div class="cards">${p.options.map((o, i) => `<button class="card br-card n-${o}" data-a="pick-branch" data-v="${o}" title="단축키 ${i + 1}"><span class="br-ic">${NODE_ICON[o]}</span><b>${esc(NODE_NAME[o])}</b><span class="small muted">${ic(esc(BR[o] || ''))}</span></button>`).join('')}</div>`;
  } else if (p.t === 'muster') {
    body = musterModal(run);
  } else if (p.t === 'fork') {
    const xp = Math.round(CFG.xpPool(run.phase) * CFG.forkRestXp);
    body = `<h1>전환</h1><p class="muted small">페이즈의 갈림길입니다. 숨을 고를지, 한 걸음 앞서 나갈지 고르세요.</p><div class="cards">
      <button class="card br-card n-supply" data-a="pick-fork" data-v="rest"><span class="br-ic">${NODE_ICON.supply}</span><b>휴식</b><span class="small muted">${ic(`체력 +${CFG.forkRestHp + Math.floor((run.maxHp - run.hp) * CFG.forkRestLost)} (기본 ${CFG.forkRestHp} + 잃은 체력 ${Math.round(CFG.forkRestLost * 100)}%) · 공명도 풀 ${xp} 분배`)}</span></button>
      <button class="card br-card n-adversity" data-a="pick-fork" data-v="challenge"><span class="br-ic">${NODE_ICON.challenge}</span><b>도전</b><span class="small muted">${ic(`다음 페이즈(${run.phase + 1}) 역경 수준의 전투. 승리하면 대량의 공명도와 남은 역경 · 사건 · 보급 · 보스 보상을 한꺼번에 받고 ${run.phase >= CFG.victoryPhase ? '곧바로 보스로 향합니다' : '바로 다음 페이즈로 넘어갑니다'}. 패배하면 역경 패배와 같은 체력 피해.`)}</span></button>
      ${R.occultTier(run) ? `<button class="card br-card n-shop" data-a="pick-fork" data-v="synth" style="--c:${SYN_BY_ID.OCCULT.color}"><span class="br-ic">${synIcon('OCCULT') || '✶'}</span><b>합성</b><span class="small muted">신비학자의 비밀 공방. 공명 촉매 · 변성 촉매 · 전설 주조액 · 복제 배양조 같은 전용 소모품을 크레딧으로 삽니다 (상품 ${2 + R.occultTier(run)}개${R.occultTier(run) >= 3 ? ', 가격 -30%' : ''}).</span></button>` : ''}
    </div>`;
  } else if (p.t === 'supply') {
    body = `<h1>보급</h1><div class="cards">${p.options.map((o) => `<button class="card" data-a="pick-supply" data-v="${o}"><b>${ic(esc(R.SUPPLY_TEXT[o]))}</b></button>`).join('')}</div>`;
  } else if (p.t === 'pilgrim') {
    body = pilgrimHtml(run, p);
  } else if (p.t === 'blessing') {
    body = `<h1>순례 — 축복 선택</h1><p class="muted">축복은 이번 페이즈가 끝날 때까지 유지됩니다.</p>
      <div class="cards">${p.options.map((id) => { const d = BLESSING_BY_ID[id]; return `<button class="card" data-a="pick-blessing" data-v="${id}"><b>${esc(d.name)}</b><span>${ic(esc(d.desc))}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'notice') {
    body = `<h1>${esc(p.title)}</h1>${p.scene?.length ? sceneHtml(p.scene) : ''}<p class="${p.scene?.length ? 'sc-result' : ''}">${ic(esc(p.body))}</p><button class="btn primary" data-a="notice-ok">확인</button>`;
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
    const b = new Battle(9, 9, new Rng(1), { phase: ph, credits: 0 });
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
/** 추천 장비 창: 추천 목록 + 보관함 보유 · 아군 장착 현황 */
function recoModal(run: RunState) {
  const u = app.recoFor ? run.units.find((x) => x.uid === app.recoFor) : null;
  if (!u) return '';
  const d = UNIT_BY_ID[u.defId];
  const name = (uid: string) => UNIT_BY_ID[run.units.find((x) => x.uid === uid)!.defId].name;
  const rows = (RECO[d.ctype] || []).map((key) => {
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
    <p class="muted small">전투 유형에 맞는 희귀 장비입니다. 서로 다른 재료 2개를 겹치면 만들 수 있습니다 (같은 유형 조합처럼 조합식이 없는 장비는 상점 · 보급 · 사건에서만).</p>
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

/** 상단 바 높이 → 옆 패널 sticky 기준, 상세 능력치 창을 상세 보기 패널 왼쪽에 고정 */
/** 보관 물품 정보 팝업: 고른 물품의 왼쪽에 붙인다 (좁은 화면은 아래 시트) */
function placeInvPop() {
  const p = root.querySelector<HTMLElement>('.inv-pop');
  if (!p) return;
  const a = root.querySelector<HTMLElement>('.inv-rail .item.sel, .inv-rail .relic-tok.on, .inv .item.sel, .inv .relic-tok.on');
  // 좁은 화면: 하단 시트. 누른 칸이 시트에 가려지는 높이면 위쪽(상단 바 밑)에 띄운다
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
  const r = a.getBoundingClientRect(), box = a.closest<HTMLElement>('.inv-rail, .inv')?.getBoundingClientRect() || r;
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
function layoutPanels() {
  const top = root.querySelector<HTMLElement>('.top');
  document.documentElement.style.setProperty('--top-h', `${(top?.offsetHeight || 0) + 10}px`);
  placeInvPop();
  placeUmPop();
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
window.addEventListener('resize', () => layoutPanels());
window.addEventListener('scroll', () => { if (root.querySelector('.stat-pop')) layoutPanels(); }, { passive: true });

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
  let body = '';
  if (app.screen === 'codex') body = codexScreen();
  else if (app.screen === 'bar') body = BAR.barScreen();
  else if (app.screen === 'intro') body = introScreen();
  else if (app.screen === 'diffsel') body = diffScreen();
  else if (app.screen === 'oath') body = OATH.oathScreen();
  else if (app.screen === 'title' || !run) body = app.screen === 'newrun' ? newRunScreen() : titleScreen();
  else if (app.screen === 'newrun') body = newRunScreen();
  else if (app.screen === 'map') body = mapScreen(run);
  else if (app.screen === 'prep') body = prepScreen(run);
  else if (app.screen === 'battle') body = battleScreen(run);
  else if (app.screen === 'shop') body = shopScreen(run);
  else if (app.screen === 'news') body = newsScreen(run);
  else if (app.screen === 'invest') body = investScreen(run);
  else if (app.screen === 'over') body = overScreen(run);
  const showTop = run && app.screen !== 'title' && app.screen !== 'newrun' && app.screen !== 'codex';
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
  const KEEP = ['.um-grid', '.um-a', '.um-c', '.um-r', '.um-main', '.side.right', '.map-detail', '.detail'];
  const kept = KEEP.map((q) => root.querySelector<HTMLElement>(q)?.scrollTop ?? 0);
  const media = app.screen === 'battle' || app.screen === 'bar' ? null : keepMedia();
  root.innerHTML = `${showTop ? topbar() : ''}${body}${run && app.screen !== 'codex' ? pendingModal(run) : ''}${run && (app.screen === 'prep' || app.screen === 'map') ? recoModal(run) : ''}${run ? useModal(run) : ''}${run && app.bigUnit && (app.screen === 'map' || app.screen === 'prep') ? unitModal(run) : ''}${menuModal(run)}<div id="toast" class="toast" ${app.toast ? '' : 'hidden'}>${esc(app.toast)}</div>`;
  media?.();
  KEEP.forEach((q, k) => { const el = root.querySelector<HTMLElement>(q); if (el && kept[k]) el.scrollTop = kept[k]; });
  umCompactBind();
  detailHeadBind();
  // 창 내용은 첫 그리기에서 채워질 수 있으므로 (선택지 생성 등) 그린 뒤의 키를 기억한다
  lastView.modal = modalKeyOf();
  scrollRestore(scrolled, newModal);
  restoredAt = performance.now();
  layoutPanels();
  advSync(run ?? null);
  TFX.onScreen(prevScreen, app.screen); // 테마 연출: 전투 중 강도 낮춤 · (이타카) 큰 화면 전환 물결 (사건 장면이 떴는지 본 뒤)
  if (app.screen === 'bar') BAR.barMount();
  if (app.screen === 'intro' && !app.introDone) introAnim();
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
  }
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

/** 전투 카메라: 가장 아래쪽 기물이 화면 맨 아래 줄에 오도록 세로 위치를 맞춘다 (사거리 최대 4칸이라 교전은 화면 안) */
function followCamera(b: Battle) {
  const inner = document.querySelector<HTMLElement>('.bview:not(.full) .board-in');
  if (!inner) return;
  const alive = b.units.filter((u) => u.alive);
  if (!alive.length) return;
  const ex = +(inner.parentElement?.dataset.ex || 0); // 포탑 가장자리 열을 함께 보이는 만큼
  const viewH = b.h - 2 * PAD, viewW = b.w - 2 * PAD + 2 * ex;
  const maxY = Math.max(...alive.map((u) => u.y));
  const top = Math.max(0, Math.min(b.h - viewH, maxY - (viewH - 1)));
  // 가로: 좌우 끝 기물을 따라가되, 양쪽에 다 있으면 더 많은 기물이 보이는 위치 (같으면 가운데)
  let left = PAD - ex, best = -1;
  for (const c of [PAD - ex, 0, b.w - viewW]) {
    const seen = alive.filter((u) => u.x >= c && u.x < c + viewW).length;
    if (seen > best) { best = seen; left = c; }
  }
  inner.style.top = `calc(${-top} * 100% / var(--h))`;
  inner.style.left = `calc(${-left} * 100% / var(--w))`;
}
/** 전투 보드 끌어서 보기: 배치 구역이 기본 화면, 놓으면 가운데로 돌아온다 */
function initBoardPan(view: HTMLElement) {
  const inner = view.querySelector<HTMLElement>('.board-in');
  if (!inner || view.classList.contains('full')) return;
  let sx = 0, sy = 0, id = -1, moved = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
    inner.style.transition = 'top .6s cubic-bezier(.4, 0, .2, 1), left .6s cubic-bezier(.4, 0, .2, 1)';
  });
  view.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; view.setPointerCapture(id); view.classList.add('panning'); }
    // 테두리 한 칸 + 조금 더까지만
    const r = view.getBoundingClientRect();
    const mx = (r.width / +getComputedStyle(view).getPropertyValue('--w')) * 1.3, my = (r.height / +getComputedStyle(view).getPropertyValue('--h')) * 1.3;
    inner.style.transform = `translate(${Math.max(-mx, Math.min(mx, dx))}px, ${Math.max(-my, Math.min(my, dy))}px)`;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    inner.style.transition = 'transform .35s cubic-bezier(.2, .8, .3, 1), top .6s cubic-bezier(.4, 0, .2, 1), left .6s cubic-bezier(.4, 0, .2, 1)';
    inner.style.transform = '';
    view.classList.remove('panning');
    if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 60); }
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}
function mountBattleView(board: HTMLElement) {
  const run = app.run!;
  const nt = run.node?.type;
  const enc = run.node!.enc!;
  if (nt === 'boss') banner('boss', 'BOSS', ENEMY_BY_ID[enc.enemies.find((e) => ENEMY_BY_ID[e.defId].tier === 'boss')?.defId || '']?.name || '보스전');
  else if (nt === 'challenge') banner('adversity', '도전', `페이즈 ${enc.phase} 역경 수준`);
  else banner(nt === 'adversity' ? 'adversity' : 'battle', nt === 'adversity' ? '역경 전투' : '전투 개시', enc.env);
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
    if (!run.tutorial) metaBattle(b); // 튜토리얼 전투는 도감 기록에서 뺀다
    if (!run.tutorial && app.summary?.won) { const mv = pickMvp(b); if (mv) metaBarMvp(run.seed, mv.a.u.defId); } // 바 반응: 직전 런 MVP
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
  if (run.over) { app.screen = 'over'; metaRunEnd(run); recEnd(run); }
  else if (run.node?.enc) app.screen = 'prep';
  else if (run.node?.type === 'shop') app.screen = 'shop';
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
/** 한 줄 위험 등급 선택 (조건은 툴팁) */
function diffMini() {
  const max = MAX_DIFF; // 모든 위험 등급을 처음부터 고를 수 있다
  const d = Math.min(app.diff, max);
  const conds = DIFFS.filter((x) => x.lvl >= 1 && x.lvl <= d).map((x) => x.desc);
  return `<div class="diff-mini"><b>위험 등급</b><div class="diff-row">${DIFFS.map((x) => `<button class="btn tiny ${x.lvl === d ? 'on' : ''}" data-a="diff" data-v="${x.lvl}" ${x.lvl > max ? 'disabled' : ''}>${x.lvl === 0 ? '표준' : x.lvl}</button>`).join('')}</div>
    <span class="small muted" title="${esc(conds.join('\n') || '추가 조건 없음')}">${d ? `추가 조건 ${conds.length}개 ⓘ` : `${CFG.victoryPhase}페이즈 보스 격파 시 의뢰 성공`}</span></div>`;
}
function diffPicker() {
  const max = MAX_DIFF; // 모든 위험 등급을 처음부터 고를 수 있다
  const d = Math.min(app.diff, max);
  return `<div class="diff-picker"><b>위험 등급</b>
    <div class="diff-row">${DIFFS.map((x) => `<button class="btn tiny ${x.lvl === d ? 'on' : ''}" data-a="diff" data-v="${x.lvl}" ${x.lvl > max ? 'disabled' : ''}>${x.lvl === 0 ? '표준' : x.lvl}</button>`).join('')}</div>
    <ul class="small muted">${d === 0 ? '<li>추가 조건 없음.</li>' : DIFFS.filter((x) => x.lvl >= 1 && x.lvl <= d).map((x) => `<li>${esc(x.desc)}</li>`).join('')}</ul>
    <p class="small muted">${CFG.victoryPhase}페이즈 보스를 이기면 의뢰 성공. 성공하면 다음 위험 등급이 해금됩니다.</p></div>`;
}

// ───────────────────────── 기물 방출
function releaseBlock(run: RunState, u: UnitState) {
  const v = R.releaseValue(run, u);
  const name = UNIT_BY_ID[u.defId].name;
  const lines = R.isRock(u) ? ['반려 돌은 보상 없이 사라집니다. 절망 증강이 걸려 있으면 다시 영입 선택지에 섞여 나옵니다.'] : [
    `${CR}<b>+${v.credits}</b> (3 + 공명 등급 ${u.rank} × 2)`,
    `${RES}<b>${v.xp}</b> — 이 기물에 쌓인 공명도 ${v.invested}의 60%를 남은 파티에 분배 (출전 기물 우선)`,
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
type Agg = { u: CUnit; dmg: number; taken: number; healed: number; shield: number; kills: number; elem: Record<string, number> };
/** 아군 기물별 집계 (소환물은 주인에게 합산) */
/** 시너지 자체 효과 집계 (아군 진영): 기물 몫과 따로 */
/** 시너지 소환물 → 기록을 받을 시너지 (엔지니어 감시 포탑 · 칼리토 근위기사). 최고의 친구 · 사이오닉 소환물은 주인 기물 몫 (aggAllies) */
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
function aggAllies(b: Battle): Agg[] {
  return b.units.filter((u) => u.side === 0 && (!u.isSummon || u.mem.king)).map((u) => { // 공왕 무휼: 시너지가 부르지만 기물 정의가 있어 자기 줄
    const parts = [u, ...b.units.filter((s) => s.owner === u)];
    const elem: Record<string, number> = {};
    for (const p of parts) for (const [k, x] of Object.entries(p.counters.elem)) elem[k] = (elem[k] || 0) + (x || 0);
    const sum = (k: 'dmg' | 'taken' | 'healed' | 'shield' | 'kills') => parts.reduce((s, p) => s + p.counters[k], 0);
    return { u, dmg: sum('dmg'), taken: sum('taken'), healed: sum('healed'), shield: sum('shield'), kills: sum('kills'), elem };
  });
}
function elemBar(a: Agg) {
  const tot = Math.max(1, a.dmg);
  return `<span class="ebar" title="${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `${ELEM_NAME[k as keyof typeof ELEM_NAME]} ${Math.round((x / tot) * 100)}%`).join(' · ')}">${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `<i style="width:${(x / tot) * 100}%;background:${ELEM_COLOR[k]}"></i>`).join('')}</span>`;
}
function battleTable(b: Battle) {
  const rows = aggAllies(b).sort((x, y) => y.dmg - x.dmg);
  return `<div class="btable-wrap"><table class="btable"><thead><tr><th>기물</th><th>준 피해</th><th>속성 비중</th><th>받은 피해</th><th>회복</th><th>보호막</th><th>결정타</th></tr></thead><tbody>
    ${rows.map((a) => `<tr class="${a.u.alive ? '' : 'dead'}"><td>${sprite(a.u)} ${esc(a.u.name)}</td><td class="mono">${fmt(a.dmg)}</td><td>${elemBar(a)}</td><td class="mono">${fmt(a.taken)}</td><td class="mono">${fmt(a.healed)}</td><td class="mono">${fmt(a.shield)}</td><td class="mono">${a.kills}</td></tr>`).join('')}
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
    abils = `${weaponCard(u.weapon || d.weapon, b, u, u.atk.elem, d.id)}<div class="abil ab-trait ab-click${abilOn('trait')} has-tok" data-a="abil-pop" data-v="trait" role="button" tabindex="0">${abTok(`trait.${d.id}`)}<div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div>${traitHtml(d, b, u)}</div>${skillCard(d, b, u)}${summonSection(d, b, u, '이번 전투')}${ultCard(d, b, u, true)}${faithAbil(d, u.src || null, app.run, u)}${ttSection(d, u.src || null, app.run, b, u, true)}${relicSection(d, u.src || null, app.run, u, true)}`;
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
  const reco = (RECO[d.ctype] || []).map((key) => { const it = itemInfo(`A_${key}`); const [ca, cb] = it.recipe || []; return `<li class="rc-row">${itemIcon(`A_${key}`)}<div class="rc-main"><b>${esc(it.name)}</b><span class="small muted">${statIc(esc(it.desc))}</span></div><div class="rc-parts" title="조합 재료">${[ca, cb].filter(Boolean).map((x) => itemIcon(x!)).join('')}</div></li>`; }).join('');
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
    <h3>능력 <span class="cx-hn">1등급 · 장비 없음 기준</span></h3>
    <div class="cx-ud-abil"><div class="abils">${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}${traitGroup(d, null, null, b, c)}${skillCard(d, b, c)}${summonSection(d, b, c, sumScope(null))}${voyAbil(d, null, null)}</div>
    <div class="abils">${ultCard(d, b, c)}${faithAbil(d, null, null)}${ttSection(d, null, null, b, c)}${relicSection(d, null, null, c)}</div></div>
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
    case 'ch2_supply': return [{ target: '.modal .cards', pend: true }, { target: '.modal [data-a="pick-supply"][data-v="parts"]', pend: true, until: () => r.pending[0]?.t !== 'supply' }];
    case 'ch2_shop': return [
      { target: '.shop .shop-item.tC' }, { target: '.shop .shop-item.tA' },
      { target: '.shop .shop-item.tC', need: true, until: () => !!r.node?.shop?.some((x) => x.sold) },
      { target: '.top .pill.cr' }, { target: '.inv' },
      { target: '[data-a="leave-shop"]', need: true, until: () => app.screen !== 'shop' },
    ];
    case 'ch2_xp': {
      let c0 = r.credits;
      return [
        { target: '.map .party .rt', until: () => !!app.bigUnit },
        { target: '.um-a > .um-rank [data-a="buyxp"]', need: true, until: () => r.credits < c0, enter: () => { c0 = r.credits; if (!app.bigUnit) { app.bigUnit = r.units[0].uid; app.sel = { k: 'unit', uid: r.units[0].uid }; render(); } } },
        { target: '.um .um-rank' },
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
      { target: '.prep .board-head b' }, { target: foeTok(r, 'warlord') }, { target: foeTok(r, 'wraith') }, { target: foeTok(r, 'turret') },
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
    hold: (st) => !st.pend && (!!app.menu || !!q1('.modal-bg, .adv, .stand-view, .um-pop')),
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
  // 전투 중에는 속도 조절 / 결과 보기 / 계속만 받는다 (재렌더하면 전투 화면이 초기화됨)
  if (app.screen === 'battle' && !['speed', 'pause', 'skip', 'after-battle', 'meter-tab', 'bsel', 'bdesel', 'bpick', 'stat-pop', 'abil-pop', 'toggle-detail'].includes(a)) return;
  if (a === 'map-tab') {
    // 슬라이드 전환: 다시 그리지 않고 트랙만 옮긴다
    setMapTab(+v || 0);
    return;
  }
  switch (a) {
    case 'newrun': // 출격: 전장 추첨 연출부터
      if (app.screen === 'title' && !app.tutAsk && !tutOver() && !loadMeta().runs && !listTutSave()) { app.tutAsk = true; break; } // 첫 실행: 튜토리얼부터 볼지
      app.tutAsk = false;
      app.screen = 'intro'; app.menu = null; app.introDone = false; app.introFoe = null; app.abilPop = null; preloadBgs();
      app.introField = FIELDS[Math.floor(Math.random() * FIELDS.length)].id;
      break;
    case 'intro-back': app.screen = 'intro'; app.introDone = true; break;
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
    case 'ds-info': { // 난이도 세부 조건: 다시 그리지 않고 펼침만
      app.dsInfo = app.dsInfo === +v ? null : +v;
      root.querySelectorAll<HTMLElement>('.ds-card').forEach((c) => c.classList.toggle('info', +(c.dataset.v || 0) === app.dsInfo));
      return;
    }
    case 'intro-ok': app.screen = 'diffsel'; if (!DIFF_PRESETS.some((x) => x.lvl === app.diff)) app.diff = DIFF_PRESETS[0].lvl; break;
    case 'diff-ok':
      app.starters = []; app.screen = 'newrun'; app.menu = null; carX = null; app.cardOpen = null;
      app.pool = starterPool(new Rng((Date.now() ^ (Math.random() * 1e9)) | 0), app.introField); app.poolRerolls = CFG.starterRerolls; // 전장 우세 시너지 기물 보장
      break;
    case 'car-prev': case 'car-next': carStep(a === 'car-next' ? 1 : -1); return;
    case 'syn-peek': return; // 시너지 아이콘 탭: 이름만 보여준다 (클릭 핸들러에서 처리)
    case 'card-tap': return act('pick-starter', v); // 카드를 누르면 선택 · 해제
    case 'card-open': app.cardOpen = app.cardOpen === v ? null : v; syncCardOpen(); return; // 터치: 설명 펼치기 · 접기
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
      { const fi = fieldIntroPending(app.run); if (fi) app.run.pending.unshift(fi); } // 전장 도입 이야기 → 특권 증강 → (고난) 절망 증강
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
      if (run && u && v === 'ok') { const k = run.inventory[u.i]; const r = R.useConsumable(run, u.i, u.tg); if (r.ok) ACH.achUse(run, k, u.tg); toast(r.msg); app.sel = null; persist(); }
      break;
    }
    case 'field-info': if (run) run.pending.unshift({ t: 'field' }); break;
    case 'enter': {
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
    case 'autofill': {
      if (!run) return;
      const n = R.autoFill(run);
      toast(n ? `${n}명을 배치했습니다.` : '배치할 수 있는 대기 기물이 없습니다.');
      if (n) persist();
      break;
    }
    case 'tac-info': app.tacOpen = !app.tacOpen; break;
    case 'map-unit': app.sel = v ? { k: 'unit', uid: v } : null; app.bigUnit = v || null; app.statPop = false; app.abilPop = null; break;
    case 'big-open': app.bigUnit = v; app.sel = { k: 'unit', uid: v }; app.statPop = false; app.abilPop = null; break;
    case 'big-close': app.bigUnit = null; app.abilPop = null; app.releaseConfirm = null; if (app.screen === 'map') app.sel = null; break;
    case 'manage': app.screen = 'prep'; app.sel = v ? { k: 'unit', uid: v } : null; break;
    case 'to-map': app.screen = run?.node?.type === 'shop' ? 'shop' : run?.node?.type === 'news' ? 'news' : run?.node?.type === 'invest' ? 'invest' : 'map'; break;
    case 'fight':
      if (!run || !deployed(run).length) return;
      persist();
      app.summary = null;
      app.screen = 'battle';
      app.needMount = true; // render() 가 보드를 그린 뒤 전투 뷰를 붙인다
      break;
    case 'pause': app.paused = !app.paused; applySpeed(); return;
    case 'speed': app.paused = false; app.speed = +v; savePref('speed', app.speed); applySpeed(); document.querySelectorAll('.speed .btn').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.v === v)); return;
    case 'skip': app.view?.skip?.(); return;
    case 'after-battle': app.summary = null; app.sel = null; app.abilPop = null; app.statPop = false; // 전투 전 선택이 상세 창으로 남지 않게
      if (app.view) { app.view.destroy(); app.view = null; } goPrepOrMap(); break;
    case 'sel-unit':
      app.abilPop = null;
      if (app.sel?.k === 'relic' && run) { const e = R.equipRelic(run, v, app.sel.id); if (e) toast(e); else toast(`성유물 장착: ${RELIC_BY_ID[app.sel.id].name}`); app.sel = { k: 'unit', uid: v }; persist(); break; }
      if (app.sel?.k === 'item' && run && isConsumable(run.inventory[app.sel.idx])) { app.useK = { i: app.sel.idx, tg: CONSUMABLES[run.inventory[app.sel.idx]].target === 'run' ? { k: 'run' } : { k: 'unit', uid: v } }; break; } // 탭: 소모품 → 기물 (바로 쓰는 소모품은 함대)
      app.sel = app.sel?.k === 'item' && run ? equipSel(run, app.sel.idx, v) : { k: 'unit', uid: v }; break;
    case 'sel-king': app.abilPop = null; if (app.sel?.k === 'item') toast('무휼은 일반 장비를 장착할 수 없습니다 (청라공국 전용 장비 자동 장착).'); app.sel = { k: 'king' }; break;
    case 'king-info': app.abilPop = null; app.sel = { k: 'king' }; if (app.screen !== 'prep' && app.screen !== 'map') app.screen = 'prep'; break;
    case 'sel-turret': {
      if (!run) return;
      app.abilPop = null;
      if (app.sel?.k === 'item') {
        const e = R.equipTurret(run, app.sel.idx, +v);
        toast(e || '포탑에 장착했습니다.');
        if (!e) persist();
      }
      app.sel = { k: 'turret', i: +v };
      break;
    }
    case 'tunequip': if (run) { const [i, k] = v.split(':'); const e = R.unequipTurret(run, +i, +k); if (e) toast(e); persist(); } break;
    case 'sel-clear': app.sel = null; break;
    case 'sel-relic': app.sel = app.sel?.k === 'relic' && app.sel.id === v ? null : { k: 'relic', id: v }; break;
    case 'sel-enemy':
      app.abilPop = null;
      if (app.sel?.k === 'item' && run && CONSUMABLES[run.inventory[app.sel.idx]]?.target === 'foe') { app.useK = { i: app.sel.idx, tg: { k: 'foe', i: +v } }; break; } // 탭: 강제 징수기 → 적
      app.sel = { k: 'enemy', i: +v }; break;
    case 'sel-item': {
      if (!run) return;
      if (app.sel?.k === 'item' && app.sel.idx !== +v && isConsumable(run.inventory[app.sel.idx]) && !['run', 'foe'].includes(CONSUMABLES[run.inventory[app.sel.idx]].target)) { app.useK = { i: app.sel.idx, tg: { k: 'inv', i: +v } }; break; } // 탭: 소모품 → 장비 (바로 쓰는 · 적에게 쓰는 소모품은 선택만 바꾼다)
      if (app.sel?.k === 'item' && app.sel.idx !== +v) {
        const res = R.combineInv(run, app.sel.idx, +v);
        if (res) { toast(`조합 완료: ${itemInfo(res).name}`); app.sel = null; persist(); break; }
      }
      app.sel = app.sel?.k === 'item' && app.sel.idx === +v ? null : { k: 'item', idx: +v };
      break;
    }
    case 'sell': if (run) { R.sellItem(run, +v); app.sel = null; persist(); } break;
    case 'unequip': if (run) { const [uid, s] = v.split(':'); const e = R.unequip(run, uid, +s); if (e) toast(e); persist(); } break;
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
    case 'leave-shop': if (run) { R.leaveShop(run); app.screen = 'map'; persist(); } break;
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
    case 'victory-endless': if (run) { run.pending.shift(); metaClear(run); ACH.achClear(run); run.endless = true; toast('무한 모드: 적은 계속 강해집니다.'); persist(); } break;
    case 'diff':
      app.diff = +v;
      if (app.screen === 'diffsel') { // 다시 그리지 않고 클래스만 바꿔 폭 변화가 부드럽게 이어지게
        root.querySelectorAll<HTMLElement>('.ds-card').forEach((c) => { const on = +(c.dataset.v || 0) === app.diff; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
        return;
      }
      break;
    case 'codex': codexFrom = app.screen === 'bar' ? 'bar' : ''; app.screen = 'codex'; app.menu = null; break;
    case 'oath': app.screen = 'oath'; app.menu = null; break; // 절망 서약 화면 (ui/oath.ts)
    case 'oath-back': app.screen = 'title'; break;
    case 'oath-set': case 'oath-clear': OATH.oathAct(a, v); break;
    case 'oath-info': { const t = OATH.oathToast(run); if (t) toast(t); if (t && app.screen === 'map') setMapTab(1); return; }
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
    case 'bsel': app.bPick = null; app.abilPop = null; app.battleSel = app.battleSel === +v ? null : +v; applySpeed(); updateMeter(true); return;
    case 'bdesel': if (app.battleSel !== null) { app.battleSel = null; app.bPick = null; app.abilPop = null; app.statPop = false; applySpeed(); updateMeter(true); } return;
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
      if (!run || p?.t !== 'rankup') return;
      const done = R.allocRank(run, p, app.picks);
      if (!done) return;
      app.picks = [];
      if (done === 'again') { persist(); break; } // 대성공: 같은 창에서 한 번 더 고른다 (전설 연출 · 공개음)
      if (p.options && !p.options.length) run.pending.shift(); // 이번 등급은 능력치만
      persist();
      break;
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
    case 'pick-item': { const p = run?.pending[0]; if (run && p?.t === 'itemPick') { const got = R.gainItem(run, p.options[+v]); if (got === CATWHEEL && p.options[+v] !== CATWHEEL) toast(`유닉스제 대량 생산 — ${itemInfo(p.options[+v]).name} 대신 캣휠이 들어왔습니다.`); run.pending.shift(); persist(); } break; }
    case 'rc-tap': app.recruitPick = app.recruitPick === v ? null : v; break;
    case 'pick-recruit': if (run && v && run.pending[0]?.t === 'recruit') { R.recruit(run, v); run.pending.shift(); app.recruitPick = null; app.cardOpen = null; persist(); } break;
    case 'pick-branch': if (run && run.pending[0]?.t === 'branch') { R.pickBranch(run, v as NodeType); goPrepOrMap(); persist(); } break;
    case 'fleet': if (run) { const err = R.buyFleet(run); toast(err || `함대 확장 — 출전 인원 ${R.deployCap(run)}명`); persist(); } break;
    case 'muster-open': if (run) { const err = R.openMuster(run); if (err) toast(err); else app.musterSel = []; persist(); } break;
    case 'muster-tog': if (v) { const i = app.musterSel.indexOf(v); if (i >= 0) app.musterSel.splice(i, 1); else if (app.musterSel.length < CFG.musterPicks) app.musterSel.push(v); } break;
    case 'muster-ok': if (run) { const err = R.confirmMuster(run, app.musterSel); if (err) toast(err); else { app.musterSel = []; app.recruitPick = null; } persist(); } break;
    case 'muster-cancel': if (run) { R.cancelMuster(run); app.musterSel = []; persist(); } break;
    case 'pick-fork': if (run && run.pending[0]?.t === 'fork') { R.pickFork(run, v as 'rest' | 'challenge' | 'synth'); if (run.node?.synth) app.screen = 'shop'; else goPrepOrMap(); persist(); } break;
    case 'reroll-recruit': if (run) { R.rerollRecruit(run); app.recruitPick = null; persist(); } break;
    case 'pick-supply': if (run && run.pending[0]?.t === 'supply') { run.pending.shift(); R.takeSupply(run, v); persist(); } break;
    case 'notice-ok': run?.pending.shift(); persist(); break;
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
  const tier = id.startsWith('U_') ? 'U' : it.tier;
  const TIER_NAME: Record<string, string> = { C: '재료', G: '고급', A: '희귀', L: '전설', M: '개조부품', U: '고유' };
  const tip = document.createElement('div');
  tip.className = `item-tip tip-${tier}`;
  tip.innerHTML = `<span class="tip-tier">${TIER_NAME[tier] || ''}</span><b>${esc(it.name)}</b><span>${statIc(esc(it.desc))}</span>
    <div class="tip-foot"><small>길게 눌러 다른 기물에게 옮기기</small>${isLocked(id) ? '' : '<button class="btn tiny" type="button">해제</button>'}</div>`;
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
let drag: { src: string; x: number; y: number; ghost: HTMLElement | null; el: HTMLElement; t0: number; hold: boolean } | null = null;
let suppressClick = false;

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
  }
  drag.ghost.style.left = `${ev.clientX}px`;
  drag.ghost.style.top = `${ev.clientY}px`;
  ev.preventDefault();
}, { passive: false });
window.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.ghost) return;
  d.ghost.remove();
  d.el.classList.remove('dragging');
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 50);
  const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
  const tgt = under?.closest('[data-drop]') as HTMLElement | null;
  if (tgt) onDrop(d.src, tgt.dataset.drop!);
});
window.addEventListener('pointercancel', () => { if (drag?.ghost) { drag.ghost.remove(); drag.el.classList.remove('dragging'); } drag = null; });

function onDrop(src: string, dst: string) {
  const run = app.run;
  if (!run) return;
  SND.uiAct('drop'); // 효과음: 배치 · 장착 (오류 알림이 뜨면 오류음)
  const [sk, ...sv] = src.split(':');
  const [dk, ...dv] = dst.split(':');
  const n = run.node?.enc?.n || CFG.bossBoard;
  // 포탑 장비: 보관함 → 포탑 · 포탑 칸 → 보관함 / 다른 포탑 칸
  if (sk === 'king' || dk === 'king') { kingDrop(run, n, sk, sv, dk, dv); persist(); render(); return; }
  if (sk === 'item' && (dk === 'turret' || dk === 'tgear')) {
    const id = run.inventory[+sv[0]];
    if (isConsumable(id)) { toast('소모품은 포탑에 쓸 수 없습니다.'); render(); return; }
    const e = R.equipTurret(run, +sv[0], +dv[0], dk === 'tgear' ? +dv[1] : undefined);
    toast(e || '포탑에 장착했습니다.');
    app.sel = { k: 'turret', i: +dv[0] };
    persist(); render(); return;
  }
  if (sk === 'tgear') {
    const i = +sv[0], k = +sv[1];
    if (dk === 'inv' || dk === 'invitem') { const e = R.unequipTurret(run, i, k); if (e) toast(e); }
    else if (dk === 'tgear') R.moveTurretGear(run, [i, k], [+dv[0], +dv[1]]);
    else if (dk === 'turret' && +dv[0] !== i) R.moveTurretGear(run, [i, k], [+dv[0], 0]);
    else if (dk === 'unit' || dk === 'eqitem') toast('포탑 전용 장비는 기물에게 장착할 수 없습니다.');
    persist(); render(); return;
  }
  if (sk === 'item' && isTurretGear(run.inventory[+sv[0]]) && (dk === 'unit' || dk === 'eqitem')) { toast('포탑 전용 장비는 감시 포탑에만 장착할 수 있습니다.'); render(); return; }
  if ((sk === 'eq' || sk === 'relic') && (dk === 'turret' || dk === 'tgear')) { toast('포탑에는 포탑 전용 장비만 장착할 수 있습니다.'); render(); return; }
  if (sk === 'turret' || (dk === 'turret' && sk !== 'unit')) { turretDrop(run, n, sk === 'turret' ? +sv[0] : -1, dk, dv); persist(); render(); return; }
  if (dk === 'tgear') { if (sk === 'unit') toast('포탑 장비 칸입니다.'); render(); return; }
  if (sk === 'unit' && dk === 'tcell') { toast('가장자리 칸에는 포탑만 둘 수 있습니다.'); render(); return; }
  if (sk === 'unit' && dk === 'turret') {
    // 기물을 포탑 칸에 놓으면: 기물이 그 칸으로, 포탑은 기물이 있던 칸으로 (대기석에서 왔으면 빈칸으로)
    const u = run.units.find((x) => x.uid === sv[0]);
    const tcs = turretCells(run, n), j = +dv[0], q = tcs[j];
    if (!u || !q) return;
    if (q.x < PAD || q.x >= PAD + n) { toast('가장자리 칸에는 포탑만 둘 수 있습니다.'); render(); return; }
    if (!R.canDeploy(run, u)) { toast('이번 페이즈에는 배치할 수 없는 기물입니다.'); render(); return; }
    if (!u.pos && deployed(run).length >= R.deployCap(run)) { toast(`출전 인원이 가득 찼습니다 (${R.deployCap(run)}명).`); render(); return; }
    const from = layout(run, n).get(u.uid);
    const tp = tcs.map((c) => turretSavePos(c.x, c.y, n));
    if (from) tp[j] = turretSavePos(from.x, from.y, n);
    else { tp.splice(j, 1); const g = run.turretGear; if (g?.[j]) g.push(...g.splice(j, 1)); } // 자리를 잃은 포탑은 맨 뒤로 (장비도 함께)
    run.turretPos = tp;
    u.pos = toPos(q.x, q.y);
    if (!from) run.turretPos = turretCells(run, n).map((c) => turretSavePos(c.x, c.y, n));
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
        other.pos = mine ? toPos(mine.x, mine.y) : null;
      } else if (!u.pos && deployed(run).length >= R.deployCap(run)) { toast(`출전 인원이 가득 찼습니다 (${R.deployCap(run)}명).`); render(); return; }
      u.pos = toPos(x, y);
    } else if (dk === 'bench') {
      u.pos = null;
    } else if (dk === 'unit') {
      const o = run.units.find((x) => x.uid === dv[0]);
      if (!o || o === u) return;
      const pu = lay.get(u.uid), po = lay.get(o.uid);
      u.pos = po ? toPos(po.x, po.y) : null;
      o.pos = pu ? toPos(pu.x, pu.y) : null;
    }
    app.sel = { k: 'unit', uid: u.uid };
  } else if (sk === 'relic') {
    if (dk === 'unit' || dk === 'eqitem') { const e = R.equipRelic(run, dv[0], sv[0]); if (e) toast(e); else { toast(`성유물 장착: ${RELIC_BY_ID[sv[0]].name}`); app.sel = { k: 'unit', uid: dv[0] }; } }
  } else if (sk === 'item' && isConsumable(run.inventory[+sv[0]])) {
    // 소모품: 기물 · 장비에 끌어다 놓으면 확인 창
    const i = +sv[0];
    const ct = CONSUMABLES[run.inventory[i]].target;
    const tg: R.UseTarget | null = dk === 'foe' ? { k: 'foe', i: +dv[0] } : ct === 'run' && (dk === 'unit' || dk === 'eqitem' || (dk === 'invitem' && +dv[0] !== i)) ? { k: 'run' }
      : dk === 'unit' ? { k: 'unit', uid: dv[0] } : dk === 'invitem' && +dv[0] !== i ? { k: 'inv', i: +dv[0] }
      : dk === 'eqitem' ? (ct === 'unit' ? { k: 'unit', uid: dv[0] } : { k: 'eq', uid: dv[0], slot: +dv[1] }) : null;
    if (tg) app.useK = { i, tg };
  } else if (sk === 'item') {
    const idx = +sv[0];
    if (dk === 'eqitem') app.sel = equipSel(run, idx, dv[0]);
    else if (dk === 'unit') app.sel = equipSel(run, idx, dv[0]);
    else if (dk === 'invitem') {
      const res = R.combineInv(run, idx, +dv[0]);
      if (res) toast(`조합 완료: ${itemInfo(res).name}`); else if (idx !== +dv[0]) toast('조합할 수 없는 장비입니다.');
      app.sel = null;
    }
  } else if (sk === 'eq') {
    const [uid, slot] = sv;
    if (dk === 'inv' || dk === 'invitem') { const e = R.unequip(run, uid, +slot); if (e) toast(e); }
    else if ((dk === 'unit' || dk === 'eqitem') && dv[0] !== uid) {
      const e = R.unequip(run, uid, +slot);
      if (e) toast(e); else app.sel = equipSel(run, run.inventory.length - 1, dv[0]);
    }
  }
  persist();
  render();
}

/** 공왕 무휼 끌어 옮기기 (포탑과 같은 규칙: 빈 아군 칸 · 가장자리 칸, 포탑 위면 자리 교환) · 무휼 칸에 기물을 놓으면 기물이 그 칸, 무휼은 기물이 있던 칸으로 */
function kingDrop(run: RunState, n: number, sk: string, sv: string[], dk: string, dv: string[]) {
  const kc = kingCell(run, n);
  if (!kc) return;
  const save = (c: { x: number; y: number }) => turretSavePos(c.x, c.y, n);
  if (sk === 'king') {
    if (dk === 'cell' || dk === 'tcell') {
      const x = +dv[0], y = +dv[1];
      if ([...layout(run, n).values()].some((p) => p.x === x && p.y === y)) { toast('기물이 있는 칸에는 무휼을 둘 수 없습니다.'); return; }
      run.kingPos = { c: save({ x, y }).c, r: save({ x, y }).r };
    } else if (dk === 'turret') {
      const tcs = turretCells(run, n), j = +dv[0];
      if (!tcs[j]) return;
      const tp = tcs.map(save);
      tp[j] = save(kc);
      run.kingPos = save(tcs[j]);
      run.turretPos = tp;
    } else if (dk === 'bench' || dk === 'inv' || dk === 'invitem') toast('무휼은 대기석으로 옮기거나 판매할 수 없습니다 (청라공국 3명 이상이면 늘 소환).');
    else if (dk === 'unit' || dk === 'eqitem') toast('기물이 있는 칸에는 무휼을 둘 수 없습니다.');
    return;
  }
  // 무휼 칸에 놓기
  if (sk === 'unit') {
    const u = run.units.find((x) => x.uid === sv[0]);
    if (!u) return;
    if (kc.x < PAD || kc.x >= PAD + n) { toast('가장자리 칸에는 포탑 · 무휼만 둘 수 있습니다.'); return; }
    if (!R.canDeploy(run, u)) { toast('이번 페이즈에는 배치할 수 없는 기물입니다.'); return; }
    if (!u.pos && deployed(run).length >= R.deployCap(run)) { toast(`출전 인원이 가득 찼습니다 (${R.deployCap(run)}명).`); return; }
    const from = layout(run, n).get(u.uid);
    u.pos = toPos(kc.x, kc.y);
    run.kingPos = from ? save(from) : undefined;
    app.sel = { k: 'unit', uid: u.uid };
  } else if (sk === 'turret') {
    const tcs = turretCells(run, n), i = +sv[0];
    if (!tcs[i]) return;
    const tp = tcs.map(save);
    tp[i] = save(kc);
    run.kingPos = save(tcs[i]);
    run.turretPos = tp;
  } else if (sk === 'item' || sk === 'eq' || sk === 'relic' || sk === 'tgear') toast('무휼은 일반 장비를 장착할 수 없습니다. 전용 장비는 청라공국 3 · 5 · 7명에 해금되어 자동으로 장착됩니다.');
}

/** 감시 포탑 끌어 옮기기: 기물이 없는 아군 칸 · 가장자리 칸으로만. 다른 포탑 위면 자리 교환. 판매 · 대기석 · 장비는 불가 */
function turretDrop(run: RunState, n: number, i: number, dk: string, dv: string[]) {
  if (i < 0) { toast('포탑에는 포탑 전용 장비만 장착할 수 있습니다.'); return; }
  const tcs = turretCells(run, n);
  if (!tcs[i]) return;
  const tp = tcs.map((c) => turretSavePos(c.x, c.y, n));
  if (dk === 'turret') {
    const j = +dv[0];
    if (j === i || !tp[j]) return;
    [tp[i], tp[j]] = [tp[j], tp[i]];
  } else if (dk === 'cell' || dk === 'tcell') {
    const x = +dv[0], y = +dv[1];
    if ([...layout(run, n).values()].some((p) => p.x === x && p.y === y)) { toast('기물이 있는 칸에는 포탑을 둘 수 없습니다.'); return; }
    const j = tcs.findIndex((c) => c.x === x && c.y === y);
    if (j >= 0) [tp[i], tp[j]] = [tp[j], tp[i]];
    else tp[i] = turretSavePos(x, y, n);
  } else if (dk === 'bench' || dk === 'inv' || dk === 'invitem') { toast('포탑은 대기석으로 옮기거나 판매할 수 없습니다.'); return; }
  else if (dk === 'tgear') {
    const j = +dv[0];
    if (j === i || !tp[j]) return;
    [tp[i], tp[j]] = [tp[j], tp[i]];
  }
  else if (dk === 'unit' || dk === 'eqitem') { toast('기물이 있는 칸에는 포탑을 둘 수 없습니다.'); return; }
  else return;
  run.turretPos = tp;
}

// ───────────────────────── 단축키
const CONFIRM_ACTS = ['alloc-ok', 'pick-aug', 'after-battle', 'field-ok', 'notice-ok', 'skip-aug', 'menu-close', 'pick-recruit'];
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
    else if (app.cardOpen) { app.cardOpen = null; render(); }
    else if (app.bigUnit && app.abilPop) { app.abilPop = null; render(); }
    else if (app.bigUnit && app.releaseConfirm) act('release-cancel', '');
    else if (app.bigUnit) act('big-close', '');
    else if (app.menu) act('menu-close', '');
    else if (app.releaseConfirm) act('release-cancel', '');
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
  if (app.bigUnit && app.abilPop && !(ev.target as HTMLElement).closest('.um-pop, [data-a="abil-pop"]')) closeUmPop();
  const el = (ev.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return;
  if (el.classList.contains('modal-bg') && (ev.target as HTMLElement).closest('.modal')) return; // 창 안쪽을 눌러도 닫지 않음
  if (el.dataset.a === 'item-info') { itemTip(el, el.dataset.v || ''); return; }
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
SND.init({ prefs: loadPrefs, save: savePref, ranks: () => Object.fromEntries(app.run?.units.map((u) => [u.uid, u.rank]) ?? []) }); // 효과음 설정 (errantes.prefs.v1) · 등급 상승 판정
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
