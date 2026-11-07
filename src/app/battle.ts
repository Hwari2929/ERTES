// 화면: 전투 · 지형 지물 · 전투 기록 · 버프 · 전투 중 상세 · 이성 추이 (main.ts 에서 분리)
import { CFG } from '../config';
import { ENEMY_BY_ID, type EnemyDef } from '../data/enemies';
import { ENEMY_DESC } from '../data/enemyText';
import { isLegendConsumable, itemInfo } from '../data/items';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, type UnitDef } from '../data/units';
import { withEmblemSummon } from '../data/emblems';
import { SCHOOL_PASSIVES, type SchoolId } from '../data/schools';
import { encGeo, runGeo, zoneAt, deployed, PAD, synergyCounts, totalMajors, turretCount, unitEffects } from '../engine/build';
import { Battle, type CUnit, REASON_HI, REASON_LO, type Status, STATUS_NAME, TEND_NAME } from '../engine/combat';
import * as R from '../engine/run';
import { type Encounter, type Geo, CATEGORY_NAME, CATEGORY_RULE, type DmgTag, type StatKey, CTYPE_NAME, ELEM_NAME, MAJOR_NAME, TTYPE_NAME, MAJORS, type Major, type RunState, type SynergyId } from '../types';
import { fromScr, gateGroupState, gateState, type GateState, rectScr, scrDims, toScr } from '../engine/build';
import { DEV, wallHp } from '../data/devices';
import { crateHomes, laserSets, mapOf, TERRAIN, terrainBlocks, type TerrainGroup, terrainGroups, terrainOf } from '../data/maps';
import { dynLive, type DynLive } from '../ui/terrainlive';
import { fmt } from '../ui/battleview';
import { VOICE, voicePick } from '../data/voicelines';
import { standImg } from '../ui/portraits';
import * as SND from '../ui/sound';
import { augKey, lineIcon, synIcon, typeIcon } from '../ui/synicons';
import { GLOSSARY } from '../data/glossary';
import { SPEEDS, app, esc, pctTxt } from './state';
import { hero, itemIcon, majorIcon, sprite, statIc } from './common';
import { abil, categoryTag, dBar, enemyCategory, faithAbil, ttSection, unitCategory } from './unitparts';
import { CR, RES, rankLabel, rankTip, unitRank } from './map';
import { ARM_BADGE, NO_ICON, crateName, moverName, statLines } from './prep';
import { abTok, abilOn, abilPopHtml, enemyAbilCards, enemyAbilPop, provChip, relicSection, skillCard, summonSection, traitHtml, ultCard, weaponCard } from './abilities';
import { layoutPanels } from './popups';
import { followCamera } from './battlecam';

// ───────────────────────── 화면: 전투
/** 전투 보드 칸 (테두리 · 적 진형 · 간격 · 아군 진형 색 구분) */
export function battleCells(enc: Encounter) {
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
export interface TerrainLayer { groups: TerrainGroup[]; at: Map<string, { gid: number; edge: string; bits: number }>; mid: { x: number; y: number }[] }
export function terrainLayer(g: Geo): TerrainLayer {
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
export function terrainCell(l: TerrainLayer, x: number, y: number, act: string, selG: number, gateOpen = false, cls = '') {
  const c = l.at.get(`${x},${y}`)!, grp = l.groups[c.gid], k = grp.k, t = TERRAIN[k], folded = k === 'bridge' && !!(grp.bits & 1);
  const open = (k === 'gate' && gateOpen) || (TERRAIN[k].dyn && k !== 'holo' && !c.bits); // 열린 수문 · 금고문 틈 · 꺼진 레이저 줄 (전투 중에는 BattleView.syncTerrain)
  return `<div class="cell tr tr-${k} ${c.edge}${c.gid === selG ? ' tr-sel' : ''}${open ? ' open' : ''}${grp.off ? ' off' : ''}${folded ? ' folded' : ''}${grp.crate !== undefined ? ` cr-${grp.crate % 3}` : ''}${cls ? ` ${cls}` : ''}" ${act}${act.includes('data-v=') ? '' : ` data-v="${c.gid}"`} data-tg="${c.gid}" title="${esc(`${t.name}${folded ? ' (접음)' : ''} — ${t.desc}`)}"></div>`;
}
/** 지형 지물 아이콘: 덩어리마다 1개, 무게중심에 (누름은 아래 칸이 받는다). box = 칸 1개 크기 자리 (소수 좌표 가능) */
export const terrainIcons = (l: TerrainLayer, box: (x: number, y: number) => string, lift = -1, battle = false) => // lift = 크레인으로 든 컨테이너 번호 (쥔 도구 배지) · battle = 전투 보드 (구조물이 된 차 · 바리케이드는 빼고)
  l.groups.map((grp, i) => battle && TERRAIN[grp.k].breakable ? '' : `<i class="tr-ic${grp.crate !== undefined && grp.crate === lift ? ' armed' : ''}" style="${box(l.mid[i].x, l.mid[i].y)}">${lineIcon(TERRAIN[grp.k].icon, 'li')}${grp.crate !== undefined && grp.crate === lift ? ARM_BADGE : ''}</i>`).join('');
/** 전투 중 수문 덩어리 상태 (칸마다 실제 지형 비트에서): 상태 · 다음 전환까지 남은 초 (전투 시간) · 폐쇄 대기 칸 수 */
export interface GateLive { state: GateState; left: number; pend: number }
export function gateLive(b: Battle, grp: TerrainGroup): GateLive {
  return { state: gateGroupState(b, grp.cells), left: Math.max(0, Math.ceil((b.mem.gateNext ?? 0) - b.t - 1e-9)), pend: grp.cells.filter((c) => gateState(b, c.x, c.y) === 'pending').length };
}
export const GATE_NAME: Record<GateState, string> = { open: '열림', shut: '닫힘', pending: '폐쇄 대기' };
/** 광석 운반차 (전투 중): 다음 통과까지 남은 초 · 방향 · 지나는 중 */
export interface CartLive { left: number; dir: 1 | -1; run: boolean }
export function cartLive(b: Battle): CartLive | undefined {
  if (b.mem.cartNext === undefined) return undefined;
  return { left: Math.max(0, Math.ceil(b.mem.cartNext - b.t - 1e-9)), dir: b.mem.cartDir > 0 ? 1 : -1, run: !!b.mem.cartRun };
}
export const cartArrow = (d: number) => (d > 0 ? '→' : '←');
/** 운반차 통과 시각 (CFG.maps.cart): '6 · 16 · 26초, 이후 10초마다' */
export const cartTimes = () => { const C = CFG.maps.cart; return `${[0, 1, 2].map((i) => C.first + i * C.period).join(' · ')}초, 이후 ${C.period}초마다`; };
/** 편성 화면 크레인: 고른 지형 지물이 컨테이너이고 그 컨테이너로 크레인을 켠 동안만 번호 (아니면 null) */
export function craneOn(run: RunState): number | null {
  if (app.crane === null || app.sel?.k !== 'terrain' || !run.node?.enc) return null;
  return terrainGroups(runGeo(run))[app.sel.g]?.crate === app.crane ? app.crane : null;
}
/** 컨테이너 번호 → 지금 덩어리 번호 (옮겨도 그대로지만, 고른 상태를 다시 맞출 때) */
export const crateGroup = (g: Geo, crate: number) => terrainGroups(g).findIndex((x) => x.crate === crate);
/** 컨테이너 환적장 보드 겹: 빈 적재칸 (흐린 점선, 편성 화면에서만) · 크레인을 켜면 그 컨테이너가 갈 수 있는 적재칸 (누르면 옮김) · 못 가는 칸 (이유 이름표) */
export function craneLayer(run: RunState, g: Geo, box: (x: number, y: number, w?: number, h?: number) => string) {
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
export function dynPrep(g: Geo, grp: TerrainGroup) {
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
export function dynRows(g: Geo, grp: TerrainGroup, run?: RunState): [string, string][] {
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
export function terrainDetail(g: Geo, grp: TerrainGroup, back: string, live?: { gate?: GateLive; cart?: CartLive; dyn?: DynLive | null }, prep?: RunState) {
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
export const PLAIN_ENV = new Set([...CFG.boardSizes.map((b) => b.env), '좁은 전장']);
/** 이번 전장 이름: 지형 틀 이름 (개활지 · 광석 운반차 선로 …). 개활지인데 조우가 따로 이름을 가지면 (보스 아레나 · 튜토리얼 장소) 그 이름 */
export function encName(enc: Encounter) {
  const m = mapOf(enc.map);
  return m.id === 'open' && enc.env && !PLAIN_ENV.has(enc.env) ? enc.env : m.name;
}
/** 편성 · 전투 보드 머리 제목 (docs/UI.md 17): 전장 이름 = 제목 글자 + 흐린 '폭 n칸 · 역경'. 이름은 칩이 아니고, 같은 것을 두 번 쓰지 않는다 (지형 설명은 오른쪽 '이번 전투') */
export function boardTitle(enc: Encounter, type?: string) {
  const name = encName(enc);
  const meta = [`폭 ${enc.n}칸`, type === 'adversity' ? '역경' : '', type === 'challenge' ? `도전 (P${enc.phase} 역경급)` : '', type === 'boss' && name !== '보스 아레나' ? '보스전' : ''].filter(Boolean).join(' · ');
  return `<span class="bh-title"><b class="bh-name">${esc(name)}</b><span class="bh-meta">${esc(meta)}</span></span>`;
}
/** 실제 진행 속도: 상세 정보를 보는 중이면 ×0.25 (설정) */
export function applySpeed() {
  const slow = app.slowDetail && app.battleSel !== null && !app.view?.b.over;
  if (app.view) app.view.speed = app.paused ? 0 : app.speed * (slow ? 0.25 : 1);
  const pb = document.querySelector<HTMLElement>('.speed .pause');
  if (pb) { pb.classList.toggle('on', app.paused); pb.textContent = app.paused ? '▶' : '❚❚'; pb.title = app.paused ? '계속 (Space)' : '일시 정지 (Space)'; }
  document.getElementById('bboard')?.classList.toggle('paused', app.paused);
  const tag = document.getElementById('bslow');
  if (tag) tag.hidden = !slow;
}
/** 전투 화면 가로 여유 칸: 엔지니어 포탑이 있으면 편성 화면처럼 양옆 가장자리 열(포탑 칸)까지 보여 준다 */
export const bviewEx = (run: RunState) => (!app.zoomOut && turretCount(run) > 0 ? PAD : 0);
/** 전투 보드 창: 기본 창 = 배치 구역 (테두리 제외 · 포탑 열 포함), 전체 보기면 전장 전체. 화면 칸 단위 (가로 지형은 돌려서):
 *  --w · --h = 창 칸 수 (배율 1), --fw · --fh = 전장 칸 수, --ox · --oy = 기본 창의 왼쪽 위 칸, --bz = 확대 배율 (bcam) */
export function bviewHtml(run: RunState, enc: Encounter) {
  const g = encGeo(enc), ex = bviewEx(run), S = scrDims(g), full = app.zoomOut;
  const v0 = full ? { x: 0, y: 0, w: S.w, h: S.h } : rectScr(g, PAD - ex, PAD, g.w - 2 * PAD + 2 * ex, g.h - 2 * PAD);
  // 창은 언제나 정사각 (긴 지형도 크게 · 궁극기 컷인 등 창을 채우는 연출이 지형 비율에 따라 찌그러지지 않게): 긴 변 칸 수로 맞추고, 짧은 쪽은 가운데 두고 전장 밖은 빈 바탕
  const sq = Math.max(v0.w, v0.h), v = { x: v0.x - (sq - v0.w) / 2, y: v0.y - (sq - v0.h) / 2, w: sq, h: sq };
  const zb = (d: 'out' | 'in') => `<button class="btn tiny bz-b" data-a="bzoom-b" data-v="${d}" title="${d === 'in' ? '확대' : '축소'} (Ctrl + 휠 · 두 손가락)" aria-label="${d === 'in' ? '확대' : '축소'}">${lineIcon(d === 'in' ? 'u.zoomin' : 'u.zoomout', 'li')}</button>`;
  return `<div class="board bview${full ? ' full' : ''}${g.rot ? ' rot' : ''}" data-a="bdesel" data-ex="${ex}" style="--ox:${v.x};--oy:${v.y};--w:${v.w};--h:${v.h};--fw:${S.w};--fh:${S.h}"><div class="board-in" id="bboard"><div class="cells">${battleCells(enc)}</div></div>${full ? '' : `<span class="bz-ctl bz-bat" hidden>${zb('out')}${zb('in')}</span>`}</div>`;
}
export function battleScreen(run: RunState) {
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

export let meterAt = 0;
export function updateMeter(force = false) {
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
export function resLine(l: string, i: number) {
  const STREAK = lineIcon('r.streak', 'li streak');
  const icon = /연승/.test(l) ? STREAK : /인과|청라공국/.test(l) ? lineIcon('a.power', 'li faith') : /공명도/.test(l) ? RES : /명성/.test(l) ? lineIcon('a.fame', 'li fame') : /봉헌/.test(l) ? lineIcon('k.relic', 'li faith') : /권능/.test(l) ? lineIcon('n.pilgrim', 'li faith')
    : /승리 보상|이자|실적|정산|보험금|상환|판매|크레딧/.test(l) ? CR : /패배|체력/.test(l) ? lineIcon('r.hp', 'li bad') : lineIcon('r.more', 'li');
  const m = l.match(/^(.*?)\s*([+-]\d+)(.*)$/);
  const body = m ? `<span class="rl-t">${esc(m[1])}${m[3] ? ` <small>${esc(m[3].trim())}</small>` : ''}</span><b class="rl-v${m[2].startsWith('-') ? ' neg' : ''}">${esc(m[2])}</b>` : `<span class="rl-t">${esc(l)}</span>`;
  return `<li style="--i:${i}" class="${/연승/.test(l) ? 'streak' : ''}">${icon}${body}</li>`;
}
/** 결과 창 공명도 막대: 전투 전 → 후. 등급이 오르면 가득 찬 뒤 번쩍이며 등급 표시가 바뀌고 새 등급에서 다시 차오른다 */
export function animateResult(scope: Element | Document) {
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
export function pickMvp(b: Battle) {
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
export function summaryModal(run: RunState) {
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
    <div class="rs-banner"><span class="rs-rays" aria-hidden="true"></span><span class="mt-stamp${s.won ? '' : ' void'}" data-label="${s.won ? 'VALID' : 'VOID'}" aria-hidden="true"><i></i></span><b>${head}</b><small>${s.won ? 'MISSION COMPLETE' : s.gameOver ? 'MISSION FAILED' : 'RETREAT'}</small></div>
    <div class="rs-grid">
      ${d && mvp ? `<section class="rs-mvp" aria-label="MVP" data-k="MVP FILE">
        <div class="rs-mvp-art">${standImg(d.id, 'stand', true) || sprite(d, 'spr big')}</div>
        <div class="rs-mvp-tag"><span class="rs-crown${s.won ? '' : ' ko'}">${s.won ? 'MVP' : '분투'}</span><em>${mvp.title}</em></div>
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

// ───────────────────────── 전투 기록 (진행 중 미터 · 결과 표)
export const ELEM_COLOR: Record<string, string> = { phys: '#cfd3dc', chem: '#7fdc4a', elec: '#5ab8ff', psy: '#c07cff', holy: '#ffd866', true: '#ff6a6a' };
export type Agg = { u: CUnit; dmg: number; taken: number; healed: number; shield: number; kills: number; elem: Record<string, number>; n?: number }; // n: 묶은 소환물 수 (최고의 친구 소환물 줄)
/** 시너지 자체 효과 집계 (아군 진영): 기물 몫과 따로 */
/** 시너지 소환물 → 기록을 받을 시너지 (엔지니어 감시 포탑 · 칼리토 근위기사). 사이오닉 등 기물 소환물은 주인 기물 몫, 최고의 친구 소환물은 종류별 자기 줄 (aggAllies) */
export const SUMMON_SYN: Record<string, SynergyId> = { turret: 'ENG', kal_guard: 'KAL' };
export type SynAgg = { id: string; name: string; color: string; icon: string; dmg: number; taken: number; healed: number; shield: number; elem: Record<string, number> };
export function aggSyn(b: Battle): SynAgg[] {
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
export const synBadge = (x: SynAgg) => `<span class="syn-src" style="color:${x.color}" title="시너지 효과">${x.icon}</span>`;
/** 최고의 친구 소환물 (기물 정의의 단짝 · 경호원 · 관료 등): 주인 줄에 합치지 않고 종류별 자기 줄 */
export const isBond = (s: CUnit) => s.isSummon && s.defId === 'summon' && !!s.owner;
export function aggOf(u: CUnit, parts: CUnit[], n?: number): Agg {
  const elem: Record<string, number> = {};
  for (const p of parts) for (const [k, x] of Object.entries(p.counters.elem)) elem[k] = (elem[k] || 0) + (x || 0);
  const sum = (k: 'dmg' | 'taken' | 'healed' | 'shield' | 'kills') => parts.reduce((s, p) => s + p.counters[k], 0);
  return { u, dmg: sum('dmg'), taken: sum('taken'), healed: sum('healed'), shield: sum('shield'), kills: sum('kills'), elem, ...(n ? { n } : {}) };
}
/** 아군 기물별 집계: 그 밖의 소환물(사이오닉 등)은 주인에게 합산, 최고의 친구 소환물은 주인 · 이름이 같은 것끼리 한 줄 (라라 · 맥스는 따로, 경호원 여럿은 한 줄) */
export function aggAllies(b: Battle, bonds = true): Agg[] {
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
export const aggName = (a: Agg) => (a.n ? `${esc(a.u.name)}${a.n > 1 ? ` ×${a.n}` : ''}<small class="agg-own"> · ${esc(a.u.owner?.name || '')}</small>` : esc(a.u.name));
export function elemBar(a: Agg) {
  const tot = Math.max(1, a.dmg);
  return `<span class="ebar" title="${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `${ELEM_NAME[k as keyof typeof ELEM_NAME]} ${Math.round((x / tot) * 100)}%`).join(' · ')}">${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `<i style="width:${(x / tot) * 100}%;background:${ELEM_COLOR[k]}"></i>`).join('')}</span>`;
}
export function battleTable(b: Battle) {
  const rows = aggAllies(b).sort((x, y) => y.dmg - x.dmg);
  return `<div class="btable-wrap"><table class="btable"><thead><tr><th>기물</th><th>준 피해</th><th>속성 비중</th><th>받은 피해</th><th>회복</th><th>보호막</th><th>결정타</th></tr></thead><tbody>
    ${rows.map((a) => `<tr class="${a.u.alive ? '' : 'dead'}${a.n ? ' bond' : ''}"><td>${sprite(a.u)} ${aggName(a)}</td><td class="mono">${fmt(a.dmg)}</td><td>${elemBar(a)}</td><td class="mono">${fmt(a.taken)}</td><td class="mono">${fmt(a.healed)}</td><td class="mono">${fmt(a.shield)}</td><td class="mono">${a.kills}</td></tr>`).join('')}
    ${(() => { const ss = aggSyn(b).sort((x, y) => y.dmg + y.taken + y.healed + y.shield - (x.dmg + x.taken + x.healed + x.shield)); return ss.length ? `<tr class="bt-sep"><td colspan="7">시너지 효과</td></tr>${ss.map((x) => `<tr class="syn"><td>${synBadge(x)} ${esc(x.name)}</td><td class="mono">${fmt(x.dmg)}</td><td>${x.dmg >= 1 ? elemBar(x as unknown as Agg) : ''}</td><td class="mono${x.taken >= 1 ? '' : ' muted'}">${x.taken >= 1 ? fmt(x.taken) : '-'}</td><td class="mono">${fmt(x.healed)}</td><td class="mono">${fmt(x.shield)}</td><td class="mono muted">-</td></tr>`).join('')}` : ''; })()}
  </tbody></table></div>
  <div class="elegend small muted">${Object.entries(ELEM_COLOR).map(([k, c]) => `<span><i style="background:${c}"></i>${ELEM_NAME[k as keyof typeof ELEM_NAME]}</span>`).join('')}</div>`;
}
// ───────────────────────── 버프 · 디버프
export const STAT_KO: Record<StatKey, string> = {
  maxHp: '최대 체력', healEff: '회복 효율', shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력', acc: '명중', crit: '치명타', effHit: '효과 명중',
  armor: '방어도', effRes: '효과 저항', moveSpd: '이동 속도', eva: '회피', critDmg: '치명타 피해', armorPen: '방어도 관통', cdr: '쿨다운 감소',
  atkSpd: '공격 속도', range: '사거리', lifesteal: '흡혈', reloadSpd: '재장전 속도', aoe: '범위', ultCharge: '궁극기 충전 효율',
};
export const FLAT_STAT = new Set<StatKey>(['maxHp', 'shoot', 'strike', 'tech', 'armor', 'range']);
export const TAG_KO: Record<DmgTag, string> = {
  all: '모든', phys: '물리', chem: '화학', elec: '전기', psy: '사이오닉', holy: '신성', true: '고정', basic: '기본 공격', skill: '스킬', dot: '지속',
  proc: '추가', shoot: '사격', strike: '타격', tech: '기술', combo: '콤보', finish: '피니쉬',
};
export const sgn = (v: number, pct = true) => `${v >= 0 ? '+' : '-'}${pct ? pctTxt(Math.abs(v)) : fmt(Math.abs(v))}`;
export function statusName(s: Status) {
  return s.label || STATUS_NAME[s.key] || STATUS_NAME[s.key.split('.')[0]] || STATUS_NAME[s.type] || (s.src?.skill?.name ?? '효과');
}
/** 효과 목록 + 좋고 나쁨 점수 */
export function statusParts(u: CUnit, s: Status) {
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
export function statusKind(u: CUnit, s: Status): 'buff' | 'debuff' | 'odd' {
  const { good, bad } = statusParts(u, s);
  if (good && !bad) return 'buff';
  if (bad && !good) return 'debuff';
  if (good || bad) return 'odd';
  if (s.src && s.src !== u) return s.src.side === u.side ? 'buff' : 'debuff';
  return 'odd';
}
export const durTxt = (d: number) => (d > 900 ? '전투 내내' : `${d.toFixed(1)}초 남음`);
export function buffIcons(u: CUnit) {
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
export function bpickInfo(u: CUnit) {
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
export const magBtn = () => `<button class="mag-btn${app.statPop ? ' on' : ''}" data-a="stat-pop" title="상세 능력치" aria-label="상세 능력치 ${app.statPop ? '닫기' : '보기'}" aria-pressed="${app.statPop}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l4.5 4.5"/></svg></button>`;
export function majorsHtml(ms: Record<Major, number>, amp?: { m: Major; x: number }) {
  return `<div class="majors">${MAJORS.map((m) => {
    const a = amp?.m === m ? amp : null, v = a ? Math.round(ms[m] * a.x) : ms[m];
    const pop = a ? ` data-kw="foe" data-tt="${MAJOR_NAME[m]} ${v}" data-td="기본 ${ms[m]} × 페이즈 피해 배율 ${a.x.toFixed(2)}" tabindex="0"` : '';
    return `<div class="major${a && v !== ms[m] ? ' amp' : ''}"${pop}><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, v * 3)}%"></i></span><b>${v}</b></div>`;
  }).join('')}</div>`;
}
/** 적의 주력 능력치 (전투력 · 정신력 중 큰 쪽) × 페이즈 피해 배율 (전장 · 위험 등급 포함, 엔진의 phaseAmp) */
export const foeAmp = (ms: Record<Major, number>, c: CUnit) => ({ m: (ms.mnd > ms.pow ? 'mnd' : 'pow') as Major, x: c.phaseAmp });
/** 아군: 전술 유형 · 전투 유형 · 분류, 적: 분류 · 등급 */
export function allyTags(d: UnitDef) { return `<i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i>${categoryTag(unitCategory(d))}`; }
/** 적 상세 머리 (편성 · 전장 브리핑 · 전투 공용): 초상 → 칩 줄 (공명 등급 · 분류 · 성향 · 정예 / 보스만 등급) → 한 줄 설명.
 *  칩은 편성 적 패널과 같은 토큰 (.rank.foe-rank · .tchip). 누르면(PC 호버) 설명 팝업 — 공명 등급 추정 · 분류 규칙 · 성향 · 용어집 '정예 · 보스' 데이터에서 읽는다 */
export function foeHead(e: EnemyDef, fallback: string, rk: { lv: number; hpX: number } | null) {
  const cat = enemyCategory(e), td = tendOf(e);
  const pop = (t: string, d: string) => ` data-kw="foe" data-tt="${esc(t)}" data-td="${esc(d)}" tabindex="0" role="button"`;
  const tier = e.tier === 'minion' ? undefined : GLOSSARY.flatMap((c) => c.entries).find((x) => x.id === 'boss');
  const [rt, rd] = rk ? rankTip(rk).split(': ') : ['', ''];
  const chips = (rk ? `<span class="rank foe-rank"${pop(rt, rd)}>${rankLabel(rk.lv)}</span>` : '')
    + `<span class="tchip cat-${cat}"${pop(CATEGORY_NAME[cat], CATEGORY_RULE[cat])}>${lineIcon(`k.${cat}`, 'li')}${CATEGORY_NAME[cat]}</span>`
    + (td ? `<span class="tchip"${pop(td.name, td.desc)}>${lineIcon(`t.${e.tend}`, 'li')}${td.name}</span>` : '')
    + (tier ? `<span class="tchip bad"${pop(tier.term, tier.text)}>${lineIcon(e.tier === 'boss' ? 'n.boss' : 'm.elite', 'li')}${tierKo(e)}</span>` : '');
  const line = foeBlurb(e);
  return `${heroHead(e.art || `en_${e.id}`, fallback, e.name, chips)}${line ? `<p class="small foe-line">${esc(line)}</p>` : ''}`;
}
/** 적 한 줄 설명 (표시용): 설명 데이터(ENEMY_DESC)에서 칩과 겹치는 머리말(보스 · 정예)과 출현 페이즈('n페이즈부터')를 걸러 낸다 — 도감 · 툴팁은 원문 그대로 */
export const foeBlurb = (e: EnemyDef) => (ENEMY_DESC[e.id] || '').replace(/^(보스|정예)(\. | · )/, '').replace(/\s*\d+페이즈부터\.?/g, '').trim();
/** 적 성향 한 줄 (툴팁 · 상세) */
/** 적 성향 (공격하지 않는 고정 구조물은 표적을 고르지 않으므로 없음: 컨테이너 · 둥지 알 · 광고판 등) */
export function tendOf(e: EnemyDef) { return e.noAttack && e.immobile ? null : TEND_NAME[e.tend]; }
export const tendText = (e: EnemyDef) => { const td = tendOf(e); return td ? `성향: ${td.name} — ${td.desc}` : '성향: 없음 — 공격하지 않는 고정 구조물'; };
/** 적: 지금 표적 + 도발 수치 상위 3명 (전투 상세) */
export function provInfo(b: Battle, u: CUnit) {
  if (!u.prov || !u.alive) return '';
  const top = b.provTop(u, 3);
  const tg = u.target?.alive ? u.target : null;
  const guard = u.tend === 'escort' && u.mem.guardId ? b.units.find((x) => x.id === u.mem.guardId && x.alive) : null; // 호위형: 지키는 동료
  return `<h3>표적 <span class="muted small">${u.tend ? esc(TEND_NAME[u.tend].name) : ''}</span></h3><p class="small">${tg ? `지금 표적: <b>${esc(tg.name)}</b>` : '표적 없음'}${(u.mem.provLock || 0) > b.t ? ' <span class="tag">도발 고정</span>' : ''}${guard ? ` · 지키는 동료: <b>${esc(guard.name)}</b>` : ''}${u.tend === 'pack' && b.t > CFG.tend.pack.provFor ? ' <span class="tag">도발 배율 무시</span>' : ''}</p>${top.length ? `<ol class="as-log">${top.map((x) => `<li>${esc(x.u.name)} <span class="muted">도발 수치 ${Math.round(x.v)}</span></li>`).join('')}</ol>` : ''}`;
}
export function heroHead(artId: string, fallback: string, name: string, tags: string) {
  const t = tags ? `<span class="dh-types">${tags}</span>` : '';
  return `<div class="d-hero">${hero(artId) || `<div class="hero none">${fallback}</div>`}<div class="dh-name"><b>${esc(name)}</b>${t}</div></div>`;
}
export function enemyWeapon(e: EnemyDef, interval = e.interval) {
  return abil('weapon', '기본 공격', `${interval.toFixed(1)}초`, `${e.atk.type === 'shoot' ? '사격' : '타격'} · ${ELEM_NAME[e.atk.elem]} 피해 · 사거리 ${e.range}${e.immobile ? ' · 이동하지 않음' : ''}${e.melee ? ' · 근접' : ''}`);
}
export const tierKo = (e: EnemyDef) => (e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '일반'); // 정예: 용어집 · 적 설명 · 도감과 같은 말
export const majorCache = new Map<number, Record<Major, number>>();
export function battleMajors(u: CUnit): Record<Major, number> | null {
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
export function battleUnitStatic(b: Battle, u: CUnit) {
  const items = u.side === 0 ? (u.src?.items || []) : (ENEMY_BY_ID[u.defId]?.items || []);
  const mod = u.side === 0 ? u.src?.mod : ENEMY_BY_ID[u.defId]?.mod;
  const temp = u.tempItems || [];
  const ic2 = (id: string, tag = '') => `<button class="tk-it${app.bPick === `it:${id}` ? ' on' : ''}" data-a="bpick" data-v="it:${id}" title="${esc(itemInfo(id).name)}${tag}">${itemIcon(id)}</button>`;
  const eq = [...items.filter((x): x is string => !!x).map((x) => ic2(x)), ...(mod ? [ic2(mod)] : []), ...temp.map((x) => ic2(x, u.side === 1 ? '' : ' (임시)'))];
  let head = '', abils = '', pop = '';
  if (u.side === 0 && (!u.isSummon || u.mem.king)) {
    const d = withEmblemSummon(UNIT_BY_ID[u.defId], u.src?.mod);
    const pv = provChip(b, u), traitTok = abTok(`trait.${d.id}`);
    head = heroHead(d.id, sprite(u, 'spr big'), d.name, allyTags(d)) + (pv ? `<div class="d-pows">${pv}</div>` : '');
    abils = `${weaponCard(u.weapon || d.weapon, b, u, u.atk.elem, d.id)}<div class="abil ab-trait ab-click${abilOn('trait')}${traitTok ? ' has-tok' : ''}" data-a="abil-pop" data-v="trait" role="button" tabindex="0">${traitTok}<div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div>${traitHtml(d, b, u)}</div>${skillCard(d, b, u)}${summonSection(d, b, u, '이번 전투')}${ultCard(d, b, u, true)}${ttSection(d, u.src || null, app.run, b, u, true)}${relicSection(d, u.src || null, app.run, u, true, b)}${faithAbil(d, u.src || null, app.run, u)}`;
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
export function battleUnitDyn(b: Battle, u: CUnit) {
  const max = b.S(u, 'maxHp');
  return `<div class="bs-hp"><span class="bs-bar"><i style="width:${Math.max(0, (u.hp / max) * 100)}%"></i>${u.shield > 0 ? `<i class="sh" style="width:${Math.min(100, (u.shield / max) * 100)}%"></i>` : ''}</span><span class="mono small">${u.alive ? `${fmt(Math.max(0, u.hp))} / ${fmt(max)}${u.shield > 0 ? ` · 보호막 ${fmt(u.shield)}` : ''}` : '전투 불능'}</span></div>
    ${actState(b, u)}${provInfo(b, u)}${reasonTrend(b, u)}
    <h3>효과 <span class="muted small">${u.statuses.filter((s) => s.dur > 0).length}</span></h3>${buffIcons(u)}${bpickInfo(u)}`;
}
// ───────── 이성 추이 (사이오닉): 엔진 rlog 기록을 읽어 보여 준다 (표시 전용)
/** 이성 출처 태그 → 이름 (전공 증강은 'volt.store' 처럼 전공.키) */
export function reasonTagName(tag: string) {
  if (tag === 'cantrip') return '비술';
  if (tag === 'frenzy') return '광폭 회복';
  if (tag === 'rule') return '고유 규칙';
  const [sc, k] = tag.split('.');
  return SCHOOL_PASSIVES[sc as SchoolId]?.find(([key]) => key === k)?.[1] || tag;
}
export const sgnN = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1).replace(/\.0$/, '')}`;
/** 출처별 합계 줄: 큰 순서, 최대 n개 */
export const tagSum = (m: Record<string, number>, n: number, sign = 1) => Object.entries(m).filter(([, v]) => Math.abs(v) >= 0.5).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, n).map(([k, v]) => `${esc(reasonTagName(k))} ${sgnN(v * sign)}`).join(' · ');
export const secs = (v: number) => `${v.toFixed(1)}초`;
export function reasonTrend(b: Battle, u: CUnit) {
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
export function reasonReport(b: Battle) {
  const us = b.units.filter((u) => u.side === 0 && !u.isSummon && u.reason !== null && u.rlog);
  if (!us.length) return '';
  return `<div class="rt-report"><h4>이성 관리 <span class="muted small">고이성 &gt; +${REASON_HI} · 저이성 &lt; ${REASON_LO}</span></h4><div class="btable-wrap"><table class="btable"><thead><tr><th>기물</th><th>고이성</th><th>저이성</th><th>광폭</th><th>회복 기여</th><th>감소</th></tr></thead><tbody>
    ${us.map((u) => { const L = u.rlog!; return `<tr class="${u.alive ? '' : 'dead'}"><td>${sprite(u)} ${esc(u.name)}</td><td class="mono">${secs(L.hiT)}</td><td class="mono">${secs(L.loT)}</td><td class="mono${L.frzT ? ' down' : ''}">${secs(L.frzT)}</td><td class="small">${tagSum(L.gain, 3) || '-'}</td><td class="small muted">${tagSum(L.loss, 2, -1) || '-'}</td></tr>`; }).join('')}
  </tbody></table></div></div>`;
}
/** 행동 상태: 왜 지금 멈췄는지 + 기술 준비 · 재장전 · 다음 공격 진행도 + 최근 행동 3개 */
export function actState(b: Battle, u: CUnit) {
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
export let bunitFor = '';
export function setBunitFor(v: string) { bunitFor = v; }
export function renderBattleUnit(b: Battle, force: boolean) {
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
