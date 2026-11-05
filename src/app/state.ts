// 앱 상태 · 설정 · 테마 · 전체 화면 · 공용 알림 · 저장 칸 이름 (main.ts 에서 분리)
import { CFG } from '../config';
import { DIFF_PRESETS } from '../data/difficulty';
import * as CX2 from '../ui/codex2';
import * as CTR from '../ui/contract';
import * as TFX from '../ui/themefx';
import { Battle } from '../engine/combat';
import * as R from '../engine/run';
import { type Major, type NodeType, type RunState, type SupplyCard } from '../types';
import { BattleView, FX, FX_DEFAULT, isDeathStyle, type DeathStyle, type MotionPreset, type UltCut } from '../ui/battleview';
import { saveRun } from '../ui/save';
import * as SND from '../ui/sound';
import * as LAB from '../ui/lab';

// 편의 설정 (이 브라우저에만 저장): 전투 속도, 진형 속도 등
export const PREF_KEY = 'errantes.prefs.v1';
/** 전투 배속 (단축키 1~6, Space 정지) */
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
export function loadPrefs(): { speed?: number; detail?: boolean; slowDetail?: boolean; zoomOut?: boolean; fxMs?: number; skillMs?: number; motion?: MotionPreset; death?: DeathStyle; ultCut?: UltCut; uiTheme?: string; uiFx?: string; fullscreen?: boolean; prepFold?: boolean; benchOff?: boolean; boardFit?: boolean; boardZoom?: number; boardZoomLast?: number; battleZoom?: number; barReceiptManual?: boolean } {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
/** 연출 설정을 전투 화면에 반영 */
export function applyFxPrefs() {
  const p = loadPrefs();
  const ms = (v: unknown, d: number) => (typeof v === 'number' && v >= 200 && v <= 5000 ? v : d);
  FX.fxMs = ms(p.fxMs, FX_DEFAULT.fxMs);
  FX.skillMs = ms(p.skillMs, FX_DEFAULT.skillMs);
  FX.motion = p.motion === 'fast' || p.motion === 'slow' || p.motion === 'mid' ? p.motion : FX_DEFAULT.motion;
  // 저장값이 없으면 기본값 (휘리릭). 예전에 고른 '스르륵' 은 직접 고른 것과 구분할 수 없어 그대로 둔다
  FX.death = isDeathStyle(p.death) ? p.death : FX_DEFAULT.death;
  FX.ultCut = p.ultCut === 'full' || p.ultCut === 'short' || p.ultCut === 'off' ? p.ultCut : FX_DEFAULT.ultCut;
}
/** UI 테마 (설정 → 테마). 색은 src/ui/css/01-themes.css 의 [data-ui-theme] 블록에 있고, 여기서는 <html data-ui-theme> 만 바꾼다. 첫 실행 기본값 = 에란테스 갤럭시 */
export const UI_THEMES = [
  { id: 'galaxy', name: '에란테스 갤럭시', desc: '잉크빛 남색 · 미색 · 계약서 호박색 (기본)' },
  { id: 'metro', name: '메트로 인피니티 패스', desc: '심야 노선 남색 · 보라 · 민트 노선색 · 승강장 안전선 노랑 · 탑승권' },
] as const;
export const uiTheme = () => { const t = loadPrefs().uiTheme; return UI_THEMES.some((x) => x.id === t) ? t! : 'galaxy'; };
/** 테마 연출 (설정): 켜기 · 줄이기 · 끄기. 첫 실행 기본값 = 켜기 */
export const UI_FX = [['on', '켜기'], ['low', '줄이기'], ['off', '끄기']] as const;
export const uiFx = (): TFX.FxLevel => { const v = loadPrefs().uiFx; return v === 'low' || v === 'off' ? v : 'on'; };
export function applyTheme() {
  const t = uiTheme(), fx = uiFx(), h = document.documentElement;
  h.dataset.uiTheme = t; h.dataset.tfx = fx;
  TFX.setThemeFx(t, fx);
}
/** 설정: 테마 견본 (견본 칩은 data-ui-theme 로 그 테마의 토큰을 그대로 읽는다) */
export function themePicker() {
  const cur = uiTheme();
  return `<div class="th-list" role="radiogroup" aria-label="테마">${UI_THEMES.map((t) => `<button class="th-opt${cur === t.id ? ' on' : ''}" data-a="pref-theme" data-v="${t.id}" role="radio" aria-checked="${cur === t.id}">
    <span class="th-sw" data-ui-theme="${t.id}" aria-hidden="true"><i class="sw-bg"></i><i class="sw-panel"></i><i class="sw-text"></i><i class="sw-sel"></i></span>
    <span class="th-tx"><b>${t.name}</b><span class="muted small">${t.desc}</span></span></button>`).join('')}</div>`;
}
export function savePref(k: string, v: unknown) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPrefs(), [k]: v })); } catch { /* 저장 불가 환경 */ }
}

// ───────────────────────── 전체 화면 (휴대폰: 주소창 · 상태 표시줄 · 내비게이션 바를 숨긴다). 브라우저 규칙상 누르는 순간에만 켤 수 있다
export type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
export type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
export const isFullscreen = () => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);
export const canFullscreen = () => !!((document.documentElement as FsEl).requestFullscreen || (document.documentElement as FsEl).webkitRequestFullscreen);
export function enterFullscreen(quiet = false) {
  const el = document.documentElement as FsEl;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : (el.webkitRequestFullscreen?.(), undefined);
    Promise.resolve(p).catch(() => { if (!quiet) toast('이 브라우저에서는 전체 화면을 켤 수 없습니다.'); });
  } catch { if (!quiet) toast('이 브라우저에서는 전체 화면을 켤 수 없습니다.'); }
}
export function toggleFullscreen() {
  if (isFullscreen()) { const d = document as FsDoc; (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.()); savePref('fullscreen', false); return; }
  savePref('fullscreen', true);
  enterFullscreen();
}
export const FS_SVG = (on: boolean) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${on ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'}"/></svg>`;

export type Screen = 'title' | 'contract' | 'newrun' | 'map' | 'prep' | 'battle' | 'shop' | 'news' | 'invest' | 'over' | 'codex' | 'bar' | 'oath';
/** 화면을 가리지 않는 확인 팝업: anchor 선택자 중 처음 보이는 요소 옆에 (inv = 보관함 상자 왼쪽 · above = 위 · beside = 옆). ok 가 없으면 안내만 (닫기 버튼 하나) */
export type Ask = { html: string; anchor: string[]; at: 'inv' | 'above' | 'beside' | 'below'; ok?: () => void; okLabel?: string; hl?: number[] }; // hl: 함께 강조할 보관함 칸 (조합 재료 둘)
export type Sel = { k: 'unit'; uid: string } | { k: 'terrain'; g: number } | { k: 'turret'; i: number } | { k: 'king' } | { k: 'item'; idx: number } | { k: 'relic'; id: string } | { k: 'enemy'; i: number } | { k: 'def'; id: string } | null;

export const app = {
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
  goAfter: null as { t: NodeType; step: number; phase: number } | null, // 분기 항로: 갈림길에서 고른 노드 — 미뤄 둔 증강 · 보상 창을 다 닫으면 바로 들어간다 (routeHold). 그 칸에서만 유효
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
  codexTab: 'units' as 'units' | CX2.Cx2Tab | 'enemies' | 'events' | 'manual' | 'records' | 'guests' | 'ach',
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

export const root = document.getElementById('app')!;
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const pctTxt = (x: number) => `${Math.round(x * 100)}%`;
/** 확률 표기 (소수 1자리): 2.5% · 8.8% */
export const pct1 = (x: number) => `${+(x * 100).toFixed(1)}%`;
/** 보급 대박: 장마다 앞에서부터 굴려 처음 걸린 배율 (CFG.supply.jackpot) → 배율별 실제 확률 */
/** 보급 대박 카드 클래스: ×jackpotLegend 이상 = 빨강 (jp-hi), 그 밖의 대박 = 파랑 (jp-lo) */
export const jpClass = (c: SupplyCard) => (c.mult >= CFG.supply.jackpotLegend ? ' jp jp-hi' : c.mult > 1 ? ' jp jp-lo' : '');
export const jackpotTxt = () => { let left = 1; return CFG.supply.jackpot.map(([x, p]) => { const q = left * p; left *= 1 - p; return `×${x} ${pct1(q)}`; }).join(' · '); };

/** 출격 계약 차림표를 연다 (바 · 타이틀 · 결과 화면의 '새 계약'). list = 메뉴에 없는 의뢰 목록을 펼친 채로 */
export function openContract(list: boolean) {
  app.tutAsk = false;
  CTR.contractStart(app.screen === 'bar' ? 'bar' : 'title', list, app.screen === 'bar' ? document.querySelector('main.bar')?.outerHTML || '' : ''); // 바 화면을 그대로 떠서 시선 전환에 쓴다 (인물 · 세로 띠가 갑자기 사라지지 않게)
  app.screen = 'contract'; app.menu = null; app.introFoe = null; app.abilPop = null;
}
export function toast(msg: string) {
  SND.toastSfx(msg); // 입력 중에 뜬 오류 알림이면 그 입력의 소리를 오류음으로
  app.toast = msg;
  if (app.toastT) clearTimeout(app.toastT);
  app.toastT = setTimeout(() => { app.toast = ''; const t = document.getElementById('toast'); if (t) t.hidden = true; }, 2400);
  const t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.hidden = false; }
}
export function persist() {
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

// ───────────────────────── 튜토리얼 「당직 근무 중 승계」: 장면(미연시) · 안내 말풍선 진행
// 진행 위치는 run.tutorial.i (TUTORIAL_FLOW). 장면은 지도에서, 안내는 각 화면 조건(TIP_GATE)이 맞으면 띄운다.
// render() 끝과 0.3초 간격으로 tutSync() 를 불러 조건을 확인한다 (전투 시간 · 미연시 진행처럼 다시 그리지 않고 바뀌는 상태 때문)
export const TUT_SLOT = 'tut';
export const CAMP_SLOT = 'campaign'; // 캠페인 런 저장 칸 (일반 이어하기와 따로)
