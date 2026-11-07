// 화면: 편성 (전투 준비 / 관리) (main.ts 에서 분리)
import { PREVIEW_SECS, foeKey, startPreview } from '../engine/preview';
import { CFG, scalePhase } from '../config';
import { ENEMY_BY_ID, type EnemyDef } from '../data/enemies';
import { ENEMY_DESC } from '../data/enemyText';
import { combine, CONSUMABLES, isConsumable, isLegendConsumable, isMod, refineLv, potsOf, potSlots, POTS, CRYSTAL, itemInfo, TURRET_GEAR } from '../data/items';
import { ENG_TUR, SYN_BY_ID, tierOf } from '../data/synergies';
import { UNIT_BY_ID } from '../data/units';
import { allyRoom, type CompanionTok, foeCell, runGeo, terrainCells, zoneAt, buildAlly, buildBattle, chrTier, companionCells, deployed, kingOn, kingState, enemyBaseMoveSpd, layout, memberships, PAD, synergyCounts, totalMajors, turretCells, TURRET_PAL, unitEffects, ZONE } from '../engine/build';
import { Battle, type CUnit, provMult, TEND_NAME, VAN_LIKE, zocHoldOf, zocShort } from '../engine/combat';
import * as R from '../engine/run';
import { CAUSAL, causalGain, causalLeft, causalNeed, causalStage, KING, KING_GEAR, KING_GEAR_NAME, KING_MS_TEXT, kingStageText } from '../data/chungra';
import { Rng } from '../rng';
import { type Geo, CATEGORY_NAME, CATEGORY_RULE, CTYPE_NAME, ELEM_NAME, MAJOR_NAME, TTYPE_NAME, MAJORS, type Major, type RunState, type UnitState } from '../types';
import { fromScr, rectScr, toScr } from '../engine/build';
import { DEV, type Device, deviceCells, deviceRows, feastChain, feastHp, feastPct, isPlaceable, scopeR, wallHp } from '../data/devices';
import { mapOf, TERRAIN, type TerrainKind } from '../data/maps';
import { fmt } from '../ui/battleview';
import { RELIC_BY_ID } from '../data/relics';
import { hasPortrait } from '../ui/portraits';
import * as SND from '../ui/sound';
import { lineIcon, typeIcon } from '../ui/synicons';
import { app, esc, loadPrefs, pctTxt, root } from './state';
import { POT_PIP, RF_GEM, SPECIAL_GLYPH, breadNote, hero, itemIcon, majorIcon, sprite, statIc, statPopHtml, synergyPanel } from './common';
import { enemyCategory, relicTok, traitGroup } from './unitparts';
import { detailPanel, powRow, skillCard, ultCard, weaponCard } from './abilities';
import { boardTitle, craneLayer, craneOn, heroHead, tendOf, tendText, terrainCell, terrainIcons, terrainLayer, tierKo } from './battle';
import { TURRET_RULES, kvChip } from './modals';
import { tryUse } from './popups';
import { prepZoomCtl } from './zoom';
import { benchPadB } from '../main';

// ───────────────────────── 화면: 편성 (전투 준비 / 관리)
/** 편성 표: 전술 위력 알약 (지휘관 또는 전술 위력을 쓰는 시너지가 있을 때만). 숨어 있다가 나타나는 순간 튀어나오는 연출 */
export let tacShownPrev = false;
export function setTacShownPrev(v: boolean) { tacShownPrev = v; }
export function tacPill(run: RunState) {
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
export function devicePop(run: RunState, id: string) {
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
export const zoneMini = (foe: boolean, mid = true) => `<span class="zm" title="놓을 수 있는 곳"><i class="${foe ? 'on' : ''}">적</i><i class="${mid ? 'on' : ''}">사이</i><i class="on">아군</i></span>`;
/** 효과 범위 격자 (가운데 = 장치) */
export const rangeGrid = (r: number) => { const n = 2 * r + 1; return `<span class="sc-grid" style="--n:${n}">${[...Array(n * n).keys()].map((i) => `<i${i === (n * n - 1) / 2 ? ' class="c"' : ''}></i>`).join('')}</span>`; };
/** 바리케이드 팝업: 놓는 곳 · 모양별 칸당 내구도 (지금 페이즈) · 막는 것 (직선 사격 / 기술 따로) */
export function wallPop(run: RunState) {
  const ph = scalePhase(run.node?.enc?.phase ?? run.phase, !!run.campaign), M = DEV.wall.maxN; // 장치 내구도: 적 성장 페이즈 기준
  const shapes = [...Array(M).keys()].map((k) => `<span class="dw-shape"><span class="dw-cells">${'<i></i>'.repeat(k + 1)}</span><b>${wallHp(ph, k + 1)}</b></span>`).join('');
  return `<div class="sc-row">${zoneMini(false)}<span class="small">적 진형 밖 빈칸</span></div>
    <div class="dw-shapes" title="칸당 내구도 (이번 페이즈)">${shapes}</div>
    <div class="dv-flow"><span class="hot">이동 막음</span><span class="hot">직선 사격 막음 · 양쪽</span></div>
    <div class="dv-flow"><span>기술</span><i>→</i><span class="t">틈 없이 갈라질 때만 막음</span></div>
    <div class="dv-flow"><span>길이 막히면</span><i>→</i><span class="hot">칸 단위로 부숨</span></div>`;
}
/** 유인 신호기 팝업: 놓는 곳 · 도발 배율 비교 막대 · 무적 → 체력 1 시간 띠 */
export function decoyPop() {
  const D = DEV.decoy, span = D.invuln * 2;
  return `<div class="sc-row">${zoneMini(true)}<span class="small">아무 빈칸 · <b>적 진형도</b></span></div>
    <div class="dv-bars" title="도발 배율 — 적이 표적을 고를 때의 무게">
      <span>보통 기물</span><i style="--p:${100 / D.prov}%"></i><b>×1</b>
      <span>신호기</span><i class="hot" style="--p:100%"></i><b>×${D.prov}</b>
    </div>
    <div class="dv-tl" title="전투 시작부터"><span class="on" style="flex:${D.invuln}">무적 ${D.invuln}초</span><span style="flex:${span - D.invuln}">체력 1</span></div>`;
}
/** 만찬 백수정 팝업 (미리암 라일라 전용): 놓는 곳 (아군 진형만) · 연쇄 회복 도식 (수정 → 1 → 2 → 3, 최대 체력 대비) · 주기 · 내구도 (이번 페이즈) */
export function feastPop(run: RunState) {
  const F = DEV.feast, ph = scalePhase(run.node?.enc?.phase ?? run.phase, !!run.campaign);
  const hop = feastChain().map((k, i) => `<i>→</i><span class="fc-hop" title="${i + 1}번째 대상"><b>${feastPct(k)}</b><small>${i + 1}</small></span>`).join('');
  return `<div class="sc-row">${zoneMini(false, false)}<span class="small">아군 진형 빈칸 · <b>아군 구조물</b></span></div>
    <div class="dv-chain" title="${F.every}초마다: 체력 비율이 가장 낮은 다친 아군부터 겹치지 않게">${lineIcon('k.feast', 'li fc-src')}${hop}</div>
    <div class="dv-flow"><span class="t">${F.every}초마다</span><span>체력 비율 낮은 아군부터 ${F.n}명</span></div>
    <div class="dv-bars" title="내구도 (이번 페이즈)"><span>내구도</span><i style="--p:100%"></i><b>${feastHp(ph)}</b></div>`;
}
/** 감전 지뢰 팝업: 놓는 곳 · 감지 · 폭발 범위 격자 · 발동 흐름 */
export function minePop() {
  const M = DEV.mine;
  return `<div class="sc-row">${zoneMini(false)}<span class="small">적 진형 밖 빈칸 · <b>늘 은신</b></span></div>
    <div class="sc-row">${rangeGrid(M.r)}<span class="small">감지 · 폭발 <b>주변 ${M.r}칸</b></span></div>
    <div class="dv-flow">${[['', '적 접근'], ['t', `${M.delay}초`], ['hot', '폭발 · 전기 피해'], ['hot', `감전 ${M.shock[0]}~${M.shock[1]}초`]].map(([c, t]) => `<span class="${c}">${t}</span>`).join('<i>→</i>')}</div>`;
}
/** 전장 방향 (위 t · 오른쪽 r · 아래 b · 왼쪽 l) → 화면 방향. 가로 지형은 시계 방향 90° (위 → 오른쪽) */
export const scrSide = (g: Geo, sd: string) => (g.rot ? ({ t: 'r', r: 'b', b: 'l', l: 't' } as Record<string, string>)[sd] || sd : sd);
/** 편성 화면에 놓은 장치: 바리케이드 · 신호기 · 지뢰는 칸 토큰, 그물 · 망원경은 효과 범위 테두리 + 누를 수 있는 표식 (누르면 회수 확인) */
export function deviceTokens(run: RunState, n: number, box: (x: number, y: number, w?: number, h?: number) => string) {
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
export const prepFrame = (g: Geo, ex: number) => { const r = rectScr(g, PAD - ex, PAD, g.w - 2 * PAD + 2 * ex, g.h - 2 * PAD); return { ox: r.x, oy: r.y, bw: r.w, bh: r.h }; };
/** 편성 보드: 전장 사각형 (x, y, 폭 w, 높이 h — 전장 좌표) → 절대 위치 (left · top · 크기 %). ex = .board 의 data-ex */
export const boardBox = (g: Geo, ex: number) => {
  const f = prepFrame(g, ex);
  return (x: number, y: number, w = 1, h = 1) => { const r = rectScr(g, x, y, w, h); return `left:${((r.x - f.ox) / f.bw) * 100}%;top:${((r.y - f.oy) / f.bh) * 100}%;width:${(100 * r.w) / f.bw}%;height:${(100 * r.h) / f.bh}%`; };
};
/** 배치 미리보기 (편성 화면): 고르거나 끄는 배치형 소모품을 가리킨 칸 = 기준점 (장치 실루엣 + 조준 모서리) · 효과 범위 (점선 + 빗금) · 놓을 수 없으면 금지 + 이유.
 *  판정은 엔진 그대로 (R.placeDevice → deviceErr). once = 끌어 놓기가 막힌 뒤 한 번 그릴 때만 (선택 없이) · cand = 터치 첫 탭의 후보 (같은 칸을 다시 누르면 확정) */
export let devPv: { idx: number; id: string; x: number; y: number; once?: boolean; cand?: boolean } | null = null;
export function setDevPv(v: typeof devPv) { devPv = v; }
/** 범위 · 모드가 중요한 배치형 소모품: 터치에서는 첫 탭 = 후보 표시, 같은 칸 재탭 = 확정 (docs/UI.md 11). 바리케이드는 옮기기 · 회수가 쉬워 바로 놓는다 */
export const TWO_STEP = ['K_net', 'K_scope', 'K_decoy', 'K_mine'];
/** 마지막 누름이 손가락인지 (터치 두 단계 배치 판정) */
export let touchPtr = false;
export function setTouchPtr(v: boolean) { touchPtr = v; }
/** 지형 덩어리를 새로 고른 그리기에서만 짧은 전환 (prepScreen) */
export let trSelLast = '';
/** 크레인으로 든 컨테이너 배지 (덩어리 아이콘 오른쪽 위): 지형 상세 선택 (선택색 경계 · 옅은 면)과 '옮기는 중' 을 나눈다. 보관함 물품 · 성유물은 호박색 실선만 (docs/UI.md 13) */
export const ARM_BADGE = '<i class="arm-b" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg></i>';
/** 금지 표시 (놓을 수 없는 칸 · 받을 수 없는 대상) */
export const NO_ICON = '<svg class="no-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/></svg>';
/** 엔진의 '놓을 수 없음' 문구 (run.ts placeDevice · deviceErr) → 짧은 이름표. 칸을 차지한 것은 장치 · 적 · 기물로 나눈다 */
export function placeReason(run: RunState, err: string, x: number, y: number) {
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
export function devPvHtml(run: RunState, pv: NonNullable<typeof devPv>, ex: number) {
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
export function devZone(run: RunState, idx: number, ex: number) {
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
export type Tool = { k: 'place' | 'equip' | 'use'; idx: number; id: string } | { k: 'relic'; id: string } | { k: 'crane'; crate: number };
export function toolOf(run: RunState | null): Tool | null {
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
export const crateKind = (): TerrainKind => mapOf(app.run?.node?.enc?.map).crateKind ?? 'container';
export const crateName = (c: number, k = crateKind()) => `${TERRAIN[k].name} ${String.fromCharCode(65 + c)}`;
/** 옮기는 수단 이름: 크레인 (컨테이너 · 차) · 자동 선반 (크레딧 셀) · 운반대 (회수 장치) */
export const moverName = (k = crateKind()) => (k === 'cell' ? '자동 선반' : k === 'recovery' ? '운반대' : '크레인');
/** 쥔 도구 칩 (편성 보드 머리): 무엇을 쥐고 다음 누름이 무엇을 하는지 + 남은 수 + 취소 (Esc 와 같음).
 *  '감전 지뢰 배치 중 · 보유 1' · '장비 장착 중: 이름' · '크레인: 컨테이너 B 옮기는 중' */
export function toolChip(run: RunState, t: Tool) {
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
export function whyShort(e: string) {
  if (e === R.WRONG_TARGET) return '대상 아님';
  for (const [k, v] of [['가득', '칸 가득'], ['반려 돌', '반려 돌'], ['문장', '이미 소속'], ['최고', '최고 등급'], ['포탑', '포탑 전용'], ['디바인', '디바인만'], ['공간', '보관함 부족'], ['장비가 없', '장비 없음'], ['바뀔 수 있는', '대상 없음']] as const) if (e.includes(k)) return v;
  return '불가';
}
/** 끄는 것 → 쥔 도구 (누르기와 같은 표현, docs/UI.md 14): 보관함 물품 · 성유물 · 기물에 단 장비. 기물 · 포탑 · 소환물 · 장치 끌기는 도구가 아니다 */
export type HeldTool = Tool | { k: 'move'; uid: string; slot: number; id: string };
export function dragTool(run: RunState, src: string): HeldTool | null {
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
export function toolMark(run: RunState, t: HeldTool | null = toolOf(run)) {
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
export function toolMarkClear() {
  root.querySelectorAll('.prep :is(.tg-ok, .tg-no, .tg-part, .tg-at)').forEach((el) => { el.classList.remove('tg-ok', 'tg-no', 'tg-part', 'tg-at'); el.removeAttribute('data-tgl'); });
  tgTip(null);
}
/** 끄는 동안 손가락 · 마우스 아래 받는 대상 (tg-at): 그 위에만 결과 이름표 (마우스로 가리킬 때와 같은 tgTip) */
export function toolMarkAt(x: number, y: number) {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.tg-ok, .tg-no');
  const cur = root.querySelector('.prep .tg-at');
  if (cur === el) return;
  cur?.classList.remove('tg-at');
  el?.classList.add('tg-at');
  tgTip(el ?? null);
}
/** 쥔 도구 결과 이름표 (가리킨 · 끌어 올린 대상 하나 위에만): 화면에 떠 있는 한 장 (보관함 · 보드 창의 스크롤 영역에 잘리지 않게).
 *  받는 대상 = '장착' · '조합 → 이름' · '교체' · '사용', 흐린 아군 = '⊘ 이유' */
export function tgTip(el: HTMLElement | null) {
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
/** 가리키거나 끄는 칸이 바뀌면 보드의 미리보기만 다시 그린다 (화면 전체를 다시 그리지 않음) */
export function devPvShow(board: HTMLElement, pv: typeof devPv) {
  const run = app.run, host = board.querySelector<HTMLElement>('.dev-pv-host');
  if (!run || !host) return;
  const same = devPv && pv && devPv.idx === pv.idx && devPv.x === pv.x && devPv.y === pv.y;
  devPv = pv;
  if (same && host.firstChild) return;
  host.innerHTML = pv ? devPvHtml(run, pv, +board.dataset.ex!) : '';
}
/** 배치형 소모품을 이 칸에 (누르기 · 끌어 놓기 공용): 놓을 수 있으면 놓고, 없으면 그 칸 옆에 이유를 띄우고 고른 상태는 그대로 둔다.
 *  터치로 누른 범위 · 모드 장치 (TWO_STEP): 첫 탭은 후보만 (기준점 · 범위 · 이유), 같은 칸을 다시 누르면 놓는다. 다른 칸을 누르면 후보가 옮겨 간다 */
export function placeAt(run: RunState, idx: number, x: number, y: number, dragged = false) {
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
export function foldTog(folded: boolean) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16${folded ? 'M10 9l-3 3 3 3' : 'M7 9l3 3-3 3'}"/></svg>`;
  return `<div class="side-fold-row"><button class="btn tiny side-fold" data-a="fold-r" aria-expanded="${!folded}" title="${folded ? '상세 패널 펼치기' : '상세 패널 접기 (보드를 넓게)'}">${icon}<span>${folded ? '상세' : '접기'}</span>${folded && app.sel ? '<i class="side-fold-dot" title="고른 대상의 상세가 있음"></i>' : ''}</button></div>`;
}
/** 대기석 숨기기 · 보이기 (보는 사람마다 errantes.prefs.v1 benchOff): 대기석 상자 오른쪽 위 테두리에 붙은 단추 하나 (docs/UI.md 16).
 *  docs/UI.md 9 — 숨기면 상자가 같은 자리에서 얇은 띠로 접히고, 단추는 같은 자리 · 같은 크기 (글자 수 같음, 화살표만 바뀜)라 누른 자리에서 다시 누르면 되돌아온다.
 *  숨겨도 보드 크기는 바꾸지 않는다 (바꾸면 띠 · 단추가 밀려난다) */
export function benchTog(off: boolean) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${off ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}"/></svg>`;
  return `<button class="bench-tog" data-a="bench-tog" aria-expanded="${!off}" title="${off ? '대기석 보이기' : '대기석 숨기기'}">${off ? '보이기' : '숨기기'}${icon}</button>`;
}
/** 보드의 기물을 끄는 동안만 화면 아래에 붙는 대기석 놓을 자리 (대기석을 숨겼거나 스크롤로 화면 밖이어도 페이지를 굴리지 않고 놓는다) */
export const BENCH_DOCK = `<div class="bench-dock" data-drop="bench" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><b>대기석으로</b></div>`;
export function prepScreen(run: RunState) {
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
    if (s.part === 0) { const cs = node.enc!.enemies.filter((o) => o.sq === s.sq && o.part !== undefined).map((o) => foeCell(o, geo)), x0 = Math.min(...cs.map((c) => c.x)), y0 = Math.min(...cs.map((c) => c.y)); units += `<i class="duo-frame" style="${box(x0, y0, Math.max(...cs.map((c) => c.x)) - x0 + 1, Math.max(...cs.map((c) => c.y)) - y0 + 1)}" aria-hidden="true"></i>`; } // 대형 적: 차지한 칸을 한 기물로 두르는 틀
    const sqc = sqSel === null ? '' : s.sq === sqSel ? ' sq-on' : ' sq-off';
    if (s.part) { units += `<div class="u side1 placed bigpart${sel ? ' sel' : ''}${sqc}" style="${(() => { const ec = foeCell(s, geo); return cellBox(ec.x, ec.y); })()}" data-a="sel-enemy" data-v="${i}" data-drop="foe:${i}" title="${esc(`${e.name} (대형 · 같은 기물)`)}"></div>`; return; } // 대형 적의 나머지 칸: 틀 안 빈칸 (초상은 본체 칸에)
    units += `<div class="u side1 placed${hasPortrait(e) ? ' tk' : ''} ${e.tier !== 'minion' && !hasPortrait(e) ? 'big' : ''} ${sel ? 'sel' : ''}${s.duo ? ` duo duo-${s.duo}` : ''}${sqc}" style="${(() => { const ec = foeCell(s, geo); return cellBox(ec.x, ec.y); })()}"
      data-a="sel-enemy" data-v="${i}" data-drop="foe:${i}" title="${esc(`${e.name} — ${ENEMY_DESC[e.id] || ''} · ${tendText(e)}`)}">${hasPortrait(e)
        ? (() => { const cat = enemyCategory(e), td = tendOf(e), mod = s.mod || (s.stripped ? null : e.mod), its = [...(s.stripped ? [] : (e.items || []).filter((x): x is string => !!x)), ...(s.items || [])]; return `<div class="tk-card"><div class="tk-art">${sprite(e, '')}${mod ? `<span class="tk-mod">${itemIcon(mod, `data-a="foe-item" data-v="${mod}"`)}</span>` : ''}</div><span class="tk-side">${e.tier === 'minion' ? '' : `<b class="tk-rank tier-${e.tier}" title="${tierKo(e)}">${e.tier === 'boss' ? 'B' : 'E'}</b>`}<i class="cat-${cat}" title="${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}">${lineIcon(`k.${cat}`, 'li')}</i>${td ? `<i class="tk-tend" title="${esc(`${td.name}: ${td.desc}`)}">${lineIcon(`t.${e.tend}`, 'li')}</i>` : ''}</span><span class="tk-items">${[0, 1, 2].map((k) => (its[k] ? itemIcon(its[k], `data-a="foe-item" data-v="${its[k]}"`) : itemIcon(null))).join('')}</span></div>`; })()
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
  const foeN = (flip: boolean) => node?.enc?.enemies.filter((s) => !!s.flip === flip && !s.part).length ?? 0; // 대형 적은 본체 칸만 센다
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
      <div class="board-head">${node?.enc ? boardTitle(node.enc, node.type) : '<span class="bh-title"><b class="bh-name">편성 관리</b></span>'}<span class="pill dep-pill" title="출전 인원 / 출전 한도"><span class="pk">출전</span> <b>${deployed(run).length}</b>/${cap}</span>${tacPill(run)}<span class="muted small bh-rows">${geo.foe2 ? '가운데' : geo.rot ? '왼쪽' : '아래'} ${geo.rows}줄에 배치</span>${noRoom.length ? `<span class="small warn" title="${esc(`배치 구역에 빈칸이 없음: ${noRoom.map((t) => t.name).join(' · ')} — 전투에서 가까운 빈칸에 나온다`)}">소환 자리 없음 ${noRoom.length}</span>` : ''}
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
export function allyCard(u: UnitState, fixed = false) {
  const d = UNIT_BY_ID[u.defId];
  const slot = (it: string | null, k: number) => (!it ? itemIcon(null) : fixed ? `<span class="tk-it" title="${esc(`${itemInfo(it).name} — ${itemInfo(it).desc}`)}">${itemIcon(it)}</span>`
    : `<span class="tk-it" data-a="item-info" data-v="${u.uid}:${k}" data-drag="eq:${u.uid}:${k}" data-drop="eqitem:${u.uid}:${k}" data-hold>${itemIcon(it)}</span>`);
  return `<div class="tk-card"><div class="tk-art">${sprite(d, '')}${u.mod && !fixed ? `<span class="tk-mod" data-a="item-info" data-v="${u.uid}:-1" data-drag="eq:${u.uid}:-1" data-drop="eqitem:${u.uid}:-1" data-hold>${itemIcon(u.mod)}</span>` : ''}</div>
        <span class="tk-side"><b class="tk-rank" title="공명 등급 ${u.rank}">${u.rank}</b><i class="tt-${d.ttype}" title="${TTYPE_NAME[d.ttype]}">${typeIcon(d.ttype)}</i><i class="ct-${d.ctype}" title="${CTYPE_NAME[d.ctype]}">${typeIcon(d.ctype)}</i></span>
        <span class="tk-items">${(fixed ? [...u.items, null, null, null].slice(0, Math.max(3, u.items.length)) : u.items).map((it, k) => slot(it, k)).join('')}</span></div>`; // 무휼: 해금 전 전용 장비 칸도 빈칸으로 (기물과 같은 3칸)
}
/** 편성 보드 소환물 토큰: 기물 토큰과 같은 틀 · 같은 높이, 장비 칸은 보이지 않는다 (공명 등급 칸 자리 = 소환물 표시) */
export function summonCard(t: CompanionTok) {
  const ty = (k?: string) => (k && (TTYPE_NAME as Record<string, string>)[k] ? `<i class="tt-${k}" title="${(TTYPE_NAME as Record<string, string>)[k]}">${typeIcon(k as never)}</i>` : k && (CTYPE_NAME as Record<string, string>)[k] ? `<i class="ct-${k}" title="${(CTYPE_NAME as Record<string, string>)[k]}">${typeIcon(k as never)}</i>` : '');
  return `<div class="tk-card"><div class="tk-art">${sprite(t.spr, '')}</div>
        <span class="tk-side"><i class="tk-summon" title="소환물">${lineIcon('a.summon', 'li')}</i>${ty(t.ttype)}${ty(t.ctype)}</span>
        <span class="tk-items tk-none" aria-hidden="true">${itemIcon(null)}${itemIcon(null)}${itemIcon(null)}</span></div>`; // 장비 칸 자리는 비워 두되 높이는 기물 토큰과 같게
}
export const TURRET_SPR = { sprite: 'turret', palette: TURRET_PAL, art: 'sm_turret' };
/** 개전 예측 (편성 화면, 선택한 출전 기물 · 적): 예상 이동 경로 · 병목 칸 · 첫 공격 목표를 보드 위에 (engine/preview.ts) */
export function selPreview(run: RunState) {
  const sel = app.sel, enc = run.node?.enc;
  if (!enc) return null;
  if (sel?.k === 'enemy') return enc.enemies[sel.i] ? startPreview(run, enc).get(foeKey(sel.i)) || null : null;
  if (sel?.k !== 'unit') return null;
  const u = run.units.find((x) => x.uid === sel.uid);
  if (!u?.pos) return null;
  return startPreview(run, enc).get(u.uid) || null;
}
export function startOverlay(run: RunState, g: Geo, ex: number) {
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
export function startChips(run: RunState) {
  const p = selPreview(run);
  if (!p) return '';
  const moves = p.path.length - 1, worst = p.waits.reduce((m, w) => Math.max(m, w.dur), 0);
  const chip = (k: string, v: string, cls = '') => `<span class="fc-chip${cls ? ` ${cls}` : ''}"><small>${k}</small><b>${v}</b></span>`;
  return `<div class="fc-chips" title="실제 전투와 같은 시드로 첫 ${PREVIEW_SECS}초를 미리 돌린 결과 (보드에 경로 · 병목 · 첫 목표 표시)"><h3>개전 예측</h3>
    ${chip('첫 목표', p.target ? esc(p.target.name) : '없음', p.target ? 'tgt' : '')}${chip('첫 공격', p.firstAtk !== undefined ? `${p.firstAtk.toFixed(1)}초` : `${PREVIEW_SECS}초 안에 없음`)}${chip('이동', `${moves}칸`)}${chip('병목', p.waits.length ? `${p.waits.length}곳 · 최대 ${worst.toFixed(1)}초` : '없음', p.waits.length ? 'wait' : '')}</div>`;
}
/** 감시 포탑 상세: 미리보기 전투에서 실제 포탑 능력치를 읽는다 */
export function turretDetail(run: RunState, i: number, bar: string) {
  const n = run.node?.enc?.n || CFG.bossBoard;
  const b = buildBattle(run, { n, env: '', enemies: [], mult: 1, seed: 1 }, false);
  const t = b.units.find((u) => u.defId === 'turret' && u.mem.turretIdx === i);
  const mods = run.turretMods || [];
  const row = (k: string, v: string) => `<dt>${k}</dt><dd>${v}</dd>`;
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  return `<div class="detail">${bar}
    ${heroHead(TURRET_SPR.art, sprite(TURRET_SPR, 'spr big'), `감시 포탑 ${i + 1}`, `<span class="tag cat-mech">${lineIcon('k.mech', 'li')}기계</span><span class="tag">구조물</span><span class="tag">엔지니어 소환물</span>`)}
    <div class="small muted">기계: ${esc(CATEGORY_RULE.mech)}<br>구조물: ${esc(CATEGORY_RULE.struct)}</div>
    ${t ? `<dl class="stats">${row('최대 내구도', fmt(t.st.maxHp))}${row('사격 위력', fmt(t.st.shoot))}${row('방어도', fmt(t.st.armor))}${row('공격 속도', `+${Math.round(t.st.atkSpd * 100)}%`)}${row('명중', pc(t.st.acc))}${row('치명타 확률', pc(t.st.crit))}${row('치명타 피해', pc(t.st.critDmg))}${row('사거리', String(t.st.range))}${row('피해 속성', ELEM_NAME[t.atk.elem])}${row('모든 주요 능력치', `+${t.mem.turretMaj || 0}`)}</dl>` : '<p class="muted small">엔지니어가 출전해야 포탑이 설치됩니다.</p>'}
    <h3>포탑 장비 ${kvChip('고름', `<b>${mods.length}</b>/${ENG_TUR.picks}`, '모든 포탑 공통')}</h3>
    <div class="t-gear">${mods.length ? mods.map((id) => `<div class="t-slot">${itemIcon(id)}<div><b>${esc(TURRET_GEAR[id]?.name || id)}</b><div class="small muted">${statIc(esc(TURRET_GEAR[id]?.desc || ''))}</div></div></div>`).join('') : '<p class="muted small">아직 고른 장비가 없습니다.</p>'}</div>
    <p class="muted small">${TURRET_RULES.map((x) => `${x[0]}: ${x[1]}`).join('. ')}.</p>
  </div>`;
}

/** 무휼 성장 칸: 성장 상태 (단계 · 누적) | 다음 승리 수집량 | 수집 근거 (기본 몫 · 장비 몫 · 청라 배율). 수치는 chungra.ts (causalGain) */
export function kingCells(run: RunState, pts: number, n: number, hi: number, left: number, t: number, g: { total: number; gear: number; score: number }) {
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
export function kingDetail(run: RunState, bar: string) {
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
export function invRail(run: RunState) {
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1; // 고른 (쥔) 물품 = 토큰에 붙은 호박색 실선 (docs/UI.md 13), 받을 수 없는 것은 toolMark 가 흐린다
  return `<div class="inv-rail" data-drop="inv" title="기물에게 끌어다 장착 · 재료끼리 겹치면 조합">
    <span class="ir-count">${R.invSlots(run)}/${CFG.inventoryMax}</span>
    <div class="ir-items">${invTokens(run, selIdx)}${run.inventory.length ? '' : '<span class="ir-empty muted">비어 있음</span>'}${relicInv(run)}</div>
  </div>`;
}
/** 상점 등: 가로 보관 칸 */
export function inventoryPanel(run: RunState) {
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  return `<div class="inv" data-drop="inv" title="재료끼리 겹치면 조합"><span class="ir-count">${R.invSlots(run)}/${CFG.inventoryMax}</span>
    <div class="inv-items">${invTokens(run, selIdx) || '<span class="muted small">비어 있음</span>'}${relicInv(run)}</div></div>${invDetail(run)}`;
}
/** 보관함 칸: 같은 소모품은 첫 칸 하나로 겹치고 원형 토큰에 개수 (표시 망원경의 사용 횟수와 같은 자리). 고른 칸 · 강조 칸은 겹친 묶음 어느 칸이든 */
export function invGroups(run: RunState): { i: number; all: number[] }[] {
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
export function invTokens(run: RunState, selIdx: number) {
  return invGroups(run).map(({ i, all }) => {
    const id = run.inventory[i], on = all.includes(selIdx) || all.some((k) => app.ask?.hl?.includes(k));
    return itemIcon(id, `data-drag="item:${i}" data-drop="invitem:${i}" data-a="sel-item" data-v="${i}"`, breadNote(run, i), all.length).replace('class="item', `class="item${on ? ' sel' : ''}`);
  }).join('');
}
/** 보관 중인 성유물: 소모품처럼 보관 칸에 항상 표시. 디바인에게 끌어다 놓거나 선택 후 디바인을 누르면 장착 */
export function relicInv(run: RunState) {
  const rs = run.relics || [];
  if (!rs.length) return '';
  const sel = app.sel?.k === 'relic' ? app.sel.id : null;
  return `<span class="ir-sep" title="성유물"></span>${rs.map((id) => relicTok(id, `data-drag="relic:${id}" data-a="sel-relic" data-v="${id}"`, id === sel)).join('')}`; // 고른 성유물 = 쥔 도구 (디바인에게 장착): 장비와 같은 호박색 실선
}
/** 배치형 소모품을 놓는 중 (편성 화면 · 조우): 팝업의 ✕ 는 팝업만 닫고 (놓기는 계속, 행동 칩이 대신 보인다) 바닥 줄 [취소] = Esc = 놓기 취소 */
export const placingSel = (run: RunState) => app.screen === 'prep' && app.sel?.k === 'item' && !!run.node?.enc && isPlaceable(run.inventory[app.sel.idx]);
export const popKey = (run: RunState) => (app.sel?.k === 'item' ? `${app.sel.idx}:${run.inventory[app.sel.idx]}` : '');
/** 고른 보관 물품: 설명 · 판매 */
export function invDetail(run: RunState) {
  const placing = placingSel(run);
  if (placing && app.popOff === popKey(run)) return ''; // 팝업만 닫아 둠 (쥔 배치 도구는 그대로)
  const xBtn = placing ? '<button class="btn tiny ip-x" data-a="pop-off" title="팝업 닫기 — 놓기는 계속 (취소는 Esc)" aria-label="팝업 닫기 (놓기는 계속)">×</button>'
    : '<button class="btn tiny ip-x" data-a="sel-clear" aria-label="닫기">×</button>';
  const pop = (icon: string, kind: string, name: string, stats: string, eff: string, foot: string) =>
    `<div class="inv-pop" role="dialog" aria-label="${esc(name)}"><div class="ip-head">${icon}<div><span class="ip-kind">${kind}</span><b>${esc(name)}</b></div>${xBtn}</div>${stats}${eff ? `<p class="ip-eff">${eff}</p>` : ''}${foot ? `<div class="ip-foot">${foot}</div>` : ''}</div>`;
  if (app.sel?.k === 'relic') {
    const r = RELIC_BY_ID[app.sel.id];
    if (!r) return '';
    return pop(relicTok(r.id), '성유물', r.name, `<div class="ip-stats"><span>${lineIcon('a.divact', 'li')}신권 대행</span><span title="장착한 디바인의 추천 주요 능력치 (봉헌 단계마다 +${CFG.offer.stat})">${lineIcon('k.relic', 'li')}추천 주요 능력치 +${CFG.offer.stat0}~</span></div>`, statIc(esc(r.desc(1))),
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
export function itemBrief(id: string) {
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
export const hpLabel = (c: CUnit) => (c.category === 'struct' ? '최대 내구도' : '최대 체력');
export function statLines(c: CUnit, b: Battle) {
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
export const agiMovePp = () => `${+(CFG.conv.agi.moveSpd * 100).toFixed(1)}%p`;
export function enemyMoveRule(e: EnemyDef) {
  const mul = e.moveSpd ?? 1, base = e.tend === 'assassin' ? CFG.enemyMoveSpd.assassin : e.tend === 'disrupt' ? CFG.enemyMoveSpd.disrupt : CFG.enemyMoveSpd.base;
  const fast = e.tend === 'assassin' || e.tend === 'disrupt' ? TEND_NAME[e.tend].name : '';
  const why = [fast ? `${fast} ${mul !== 1 ? pctTxt(base) : ''}`.trim() : mul !== 1 ? pctTxt(base) : '', mul !== 1 ? `이동 배율 ${mul}` : ''].filter(Boolean).join(' × ');
  return `기본 이동 속도 ${pctTxt(enemyBaseMoveSpd(e))}${why ? ` (${why})` : ''} + 기동력 1당 ${agiMovePp()}`;
}
export function moveRule(c: CUnit): string {
  if (c.side === 1 && ENEMY_BY_ID[c.defId] && !c.mem.echoOf) return enemyMoveRule(ENEMY_BY_ID[c.defId]);
  if (c.side === 0 && c.src) return `기본 ${pctTxt(CFG.unitMoveSpd)} + 기동력 1당 ${agiMovePp()}`;
  return '';
}

export function previewAlly(run: RunState, u: UnitState) {
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
