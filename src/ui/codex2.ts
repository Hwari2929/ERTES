// 도감 탭: 기물 목록 · 장비 · 시너지 · 사이오닉 · 증강 · 세계관.
// 모든 이름 · 수치 · 설명은 그릴 때마다 데이터 표(items · synergies · schools · psiinfo · augments · relics · globals · run 상품표 · worldlore · battlefields)에서 읽는다.
// 목록은 표를 순회해서 만들므로, 데이터에 항목을 더하거나 고치면 도감에도 그대로 반영된다 (검사: npm run check).
// main.ts 에만 있는 그림 조각(장비 · 증강 아이콘, 초상화 등)은 CxH 로 받는다.
// 배치: 왼쪽 목록 + 오른쪽 상세 (상세 폭이 넓으면 2단). 좁은 화면(≤860px)은 목록 → 상세 → '목록' 단추로 돌아오는 한 단 흐름.
import { CFG } from '../config';
import { ABIL, augAbilText, GLOSS } from '../data/abiltext';
import { augReqState } from '../data/augreq';
import { FIELD_BY_ID, FIELDS } from '../data/battlefields';
import { ALL_AUGS, augDesc, augSource } from '../data/augments';
import { BLESSINGS, EMBLEM_SYNS, GLOBAL_BY_ID, GLOBAL_ODDS, GLOBAL_TIER_NAME, GLOBALS, PRIVILEGES } from '../data/globals';
import { DESPAIR_BY_ID, DESPAIRS, despairRule } from '../data/despair';
import { OATHS, oathHeatOf, oathMax } from '../data/oaths';
import { diffName } from '../data/difficulty';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, breadSellText, combine, CONSUMABLES, emblemId, injectorWeights, INJECTORS, isLegendConsumable, emblemOf, HEL_ITEM_IDS, isEmblem, isHelItem, isLocked, isOccultMod, isTurretGear, isTurretMod, itemInfo, OCCULT_MODS, TURRET_GEAR, TURRET_GEAR_IDS, TURRET_MOD_IDS, TURRET_MODS, TURRET_PRICE, UNIQUE_IDS, isJunk, JUNK_IDS, CATWHEEL_ZI, isCatwheel } from '../data/items';
import { PSI_BRIEF } from '../data/brief';
import { cantripView, passiveView, SCHOOL_LINE, transformPreview } from '../data/psiinfo';
import { RELIC_BY_ID, RELICS } from '../data/relics';
import { augMark, GROUPS, type GroupId, isLegendAug, isTransformAug, PSI_STATUS, SCHOOL_BY_ID, SCHOOLS, type SchoolId, UNIT_GROUP } from '../data/schools';
import { KAL_GUARD_TEXT, KAL_GUARDS, SYN_BY_ID, SYNERGIES, VOYAGE_SPECIAL } from '../data/synergies';
import { KNIGHT_PAL } from '../engine/build';
import { CAUSAL, causalNeed, isKingGear, KING_GEAR, KING_MS_TEXT, kingStageText } from '../data/chungra';
import { BOSS_CC_IMMUNE, categoryImmune, categoryMult, REASON_HI, REASON_LO } from '../engine/combat';
import { UNIT_BY_ID, UNITS, type UnitDef } from '../data/units';
import { EMB_ROCK, emblemText } from '../data/emblems';
import type { SummonDef } from '../data/unitkit';
import { LORE, LORE_BY_ID, LORE_GROUP_NAME, LORE_SECTIONS, type LoreEntry, type LoreGroup, loreRegionsOf } from '../data/worldlore';
import { FOE_GEAR_DIFF, INVEST_OFFERS, NEWS_OFFERS, PILGRIM_CARDS } from '../engine/run';
import type { AugDef } from '../engine/effects';
import { type Category, CATEGORY_NAME, CTYPE_NAME, ELEM_NAME, MAJOR_NAME, type Major, type RunState, type SynergyId, TTYPE_NAME } from '../types';
import * as AB from './abil';
import { schoolCore, schoolWarnings } from './matchup';
import { loadMeta } from './meta';
import { artURL, bgURL } from './portraits';
import { lineIcon, synIcon } from './synicons';
import { tierCellHtml } from './tierdiff';

/** main.ts 의 그림 조각 */
export interface CxH {
  itemIcon(id: string): string;
  augIcon(id: string): string;
  sprite(d: UnitDef): string;
  abTok(key: string): string;
  statIc(html: string): string;
  relicTok(id: string): string;
  majorIcon(m: Major): string;
  /** 상반신 일러스트 (없으면 빈 문자열) */
  bust?(id: string): string;
  /** 전투 · 전술 유형 아이콘 */
  typeIcon?(k: string): string;
}

export type Cx2Tab = 'items' | 'syn' | 'psi' | 'augs' | 'lore';
export const CX2_TABS: [Cx2Tab, string][] = [['syn', '시너지'], ['items', '장비'], ['augs', '증강'], ['psi', '사이오닉'], ['lore', '세계관']];
export const isCx2Tab = (t: string): t is Cx2Tab => CX2_TABS.some(([k]) => k === t);
type QTab = Cx2Tab | 'units';
export type UnitSort = 'name' | 'ctype' | 'ttype';

/** 탭별 선택 · 분류 · 검색어 (이 브라우저 세션 동안 유지) */
export const CX2 = {
  sel: { items: null, syn: null, psi: null, augs: null, lore: null } as Record<Cx2Tab, string | null>,
  filt: { items: 'all', syn: 'all', psi: 'all', augs: 'all', lore: 'all' } as Record<Cx2Tab, string>,
  q: { items: '', syn: '', psi: '', augs: '', lore: '', units: '' } as Record<QTab, string>,
  /** 기물 목록 정렬 */
  usort: 'name' as UnitSort,
  /** 좁은 화면에서 상세 → 목록으로 돌아왔을 때 다시 보여 줄 목록 단추 (data-v) */
  focus: null as string | null,
};

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const br = (s: string) => esc(s).replace(/\n/g, '<br>');
const pctTxt = (x: number) => `${Math.round(x * 1000) / 10}%`;
const go = (v: string) => `data-a="cx2" data-v="${esc(v)}"`;
const memberOf = (d: UnitDef, sid: string) => ([...d.factions, ...d.traits] as string[]).includes(sid);
const KIND_NAME = { faction: '세력', trait: '특성' } as const;

// ───────── 검색: 타일 · 줄의 data-q 에 이름 · 설명을 넣고, 입력할 때마다 다시 그리지 않고 숨긴다
const norm = (s: string) => s.toLowerCase().replace(/<[^>]*>/g, ' ');
const qHit = (q: string, text: string) => { const t = norm(text); return q.trim().toLowerCase().split(/\s+/).filter(Boolean).every((w) => t.includes(w)); };
const qAttr = (tab: QTab, text: string) => ` data-q="${esc(norm(text))}"${CX2.q[tab] && !qHit(CX2.q[tab], text) ? ' hidden' : ''}`;
function searchBox(tab: QTab, ph: string) {
  return `<input class="cx2-q" type="search" data-tab="${tab}" placeholder="${esc(ph)}" value="${esc(CX2.q[tab])}" aria-label="검색" autocomplete="off">`;
}
/** 검색 결과에 맞춰 묶음 머리도 숨긴다 */
function applyQuery(scope: ParentNode, q: string) {
  scope.querySelectorAll<HTMLElement>('[data-q]').forEach((el) => { el.hidden = !!q && !qHit(q, el.dataset.q || ''); });
  scope.querySelectorAll<HTMLElement>('.cx2-grp').forEach((g) => { g.hidden = !!q && !g.querySelector('[data-q]:not([hidden])'); });
  scope.querySelectorAll<HTMLElement>('.cx2-none').forEach((n) => { n.hidden = !q || !!scope.querySelector('[data-q]:not([hidden])'); });
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el?.classList?.contains('cx2-q')) return;
    const tab = el.dataset.tab as QTab;
    CX2.q[tab] = el.value;
    const scope = el.closest('.cx-list') || el.closest('.cx2') || document;
    applyQuery(scope, el.value);
  });
}
/** 보이는 줄(data-q 이고 hidden 이 아님)이 있는지 */
const SHOWN = /data-q="[^"]*"(?! hidden)/;
/** 묶음: 검색으로 안의 줄이 모두 숨으면 묶음도 숨김 */
const grp = (tab: QTab, cls: string, inner: string, tag = 'div') => `<${tag} class="cx2-grp${cls}"${CX2.q[tab] && !SHOWN.test(inner) ? ' hidden' : ''}>${inner}</${tag}>`;
const noneMsg = (tab: QTab, html: string) => `<p class="cx2-none muted small"${CX2.q[tab] && !SHOWN.test(html) ? '' : ' hidden'}>찾는 항목이 없습니다.</p>`;

/** 분류 단추 줄 (하나만 고르는 분절 단추) */
function segBar(label: string, opts: [string, string, number][], cur: string, act: (k: string) => string) {
  return `<div class="cx-seg" role="group" aria-label="${esc(label)}"><span class="cx-seg-l">${esc(label)}</span>${opts.map(([k, l, n]) => `<button class="${cur === k ? 'on' : ''}" ${act(k)} aria-pressed="${cur === k}">${esc(l)}${n >= 0 ? ` <span class="f-num">${n}</span>` : ''}</button>`).join('')}</div>`;
}
function filterBar(tab: Cx2Tab, opts: [string, string, number][]) {
  return segBar('분류', opts, CX2.filt[tab], (k) => go(`filt:${tab}:${k}`));
}
/** 목록 머리: 검색 + 분류 (목록과 함께 위에 붙어 있음) */
const tools = (...parts: string[]) => `<div class="cx-tools">${parts.join('')}</div>`;
/**
 * 목록 + 상세. back = 상세 맨 위 '목록으로' 단추의 동작 속성 (선택이 있을 때만 · 좁은 화면에서만 보임).
 * 선택이 있으면 has-sel: 좁은 화면은 상세만, 없으면 목록만 보인다.
 */
export function cxWrap(cls: string, list: string, detail: string, back: string | null, backLabel = '목록') {
  return `<div class="cx-wrap ${cls}${back ? ' has-sel' : ''}"><section class="cx-list">${list}</section><aside class="cx-detail">${back ? `<button class="cx-back" ${back}>← ${esc(backLabel)}</button>` : ''}${detail}</aside></div>`;
}
const wrap = (tab: Cx2Tab, list: string, detail: string, backLabel = '목록') =>
  cxWrap(`cx2 cx2-${tab}${tab === 'psi' && !CX2.sel.psi ? ' cx-both' : ''}`, list, detail, CX2.sel[tab] ? go(tab === 'psi' ? `set:psi:${psiParent(CX2.sel.psi!)}` : `sel:${tab}:${CX2.sel[tab]}`) : null, backLabel);
const empty = (msg: string) => `<div class="cx-empty muted small">${esc(msg)}</div>`;
/** 상세 2단: 둘째 단이 비면 한 단 */
const cols = (a: string, b: string) => (b ? `<div class="cx2-cols"><div class="cx2-c">${a}</div><div class="cx2-c">${b}</div></div>` : a);
/** 상세 머리: 아이콘 + 이름 + 분류 */
const head = (ic: string, name: string, sub: string, style = '') => `<header class="cx2-hd"${style}>${ic}<div><b class="f-ui">${name}</b><small>${sub}</small></div></header>`;
/** 성장 이정표 등급 (CFG.growth 를 그대로 계산) */
function milestones(f: (tt: string, r: number) => boolean, tt: string): string {
  const l: number[] = [];
  for (let r = 1; r <= CFG.maxRank; r++) if (f(tt, r)) l.push(r);
  if (!l.length) return '';
  if (l.length > 6) return `${l[0]}등급부터 ${l[1] - l[0]}등급마다`;
  return `${l.join(' · ')}등급`;
}
const msCount = (f: (tt: string, r: number) => boolean, tt: string) => { let n = 0; for (let r = 1; r <= CFG.maxRank; r++) if (f(tt, r)) n++; return n; };

/** 기물 작은 단추 (누르면 기물 탭) */
function unitChip(H: CxH, d: UnitDef, extra = '') {
  return `<button class="cx2-u" ${go(`unit:${d.id}`)} title="${esc(d.name)} — 기물 도감에서 보기">${H.sprite(d)}<span><b>${esc(d.name)}</b>${extra ? `<small>${extra}</small>` : ''}</span></button>`;
}
/** 시너지 문양 + 이름 (문양만 시너지 색) */
const synTag = (sid: string) => { const s = SYN_BY_ID[sid as SynergyId]; return s ? `<span class="cx-st" style="--c:${s.color}"><i>${synIcon(s.id) || esc(s.icon)}</i>${esc(s.name)}</span>` : ''; };
function synChip(sid: string) {
  const s = SYN_BY_ID[sid as SynergyId];
  if (!s) return '';
  return `<button class="cx2-sc" style="--c:${s.color}" ${go(`go:syn:${s.id}`)} title="시너지 도감에서 보기"><span class="cx2-si">${synIcon(s.id) || esc(s.icon)}</span>${esc(s.name)}</button>`;
}

// ═══════════════════════ 기물 목록 (상세는 main.ts 의 codexDetail)
export type UnitGroupBy = 'none' | 'faction' | 'trait' | 'ctype' | 'ttype';
const UGROUP: [UnitGroupBy, string][] = [['none', '없음'], ['faction', '세력'], ['trait', '특성'], ['ctype', '전투 유형'], ['ttype', '전술 유형']];
const USORT: [UnitSort, string][] = [['name', '이름'], ['ctype', '전투 유형'], ['ttype', '전술 유형']];
/** 초상화 카드: 큰 상반신 (없으면 머리 아이콘) · 이름 · 유형 · 시너지 문양 + 이름 */
function unitCard(H: CxH, d: UnitDef, on: boolean, peek: boolean, known: boolean) {
  const syn = [...d.factions, ...d.traits];
  const role = `${CTYPE_NAME[d.ctype]} · ${TTYPE_NAME[d.ttype]}`;
  const q = known ? `${d.name} ${d.title} ${role} ${syn.map((s) => SYN_BY_ID[s as SynergyId]?.name || '').join(' ')}` : '???';
  return `<button class="cx-card${on ? ' on' : peek ? ' peek' : ''}${known ? '' : ' unknown'}" data-a="codex-sel" data-v="${esc(d.id)}" aria-pressed="${on}"${qAttr('units', q)}>
    <span class="cx-pic">${H.sprite(d)}${known && H.bust ? H.bust(d.id) : ''}</span>
    <span class="cx-cap"><b class="cx-nm">${known ? esc(d.name) : '???'}</b>${known ? `<span class="cx-role">${esc(role)}</span><span class="cx-syns">${syn.map(synTag).join('')}</span>` : `<span class="cx-role">${d.inert ? '절망 증강으로 합류' : d.king ? '청라공국이 소환' : '사건으로 합류'}</span>`}</span></button>`;
}
/** 기물 목록 (묶기 · 정렬 · 검색). first = 아무것도 고르지 않았을 때 넓은 화면에서 미리 보여 줄 기물 */
export function unitsList(H: CxH, o: { group: UnitGroupBy; sel: string | null; known: (d: UnitDef) => boolean }): { html: string; first: string | null } {
  const ck = Object.keys(CTYPE_NAME), tk = Object.keys(TTYPE_NAME);
  const cmp = (x: UnitDef, y: UnitDef) => (CX2.usort === 'ctype' ? ck.indexOf(x.ctype) - ck.indexOf(y.ctype) : CX2.usort === 'ttype' ? tk.indexOf(x.ttype) - tk.indexOf(y.ttype) : 0) || x.name.localeCompare(y.name, 'ko');
  const ti = (k: string) => (H.typeIcon ? H.typeIcon(k) : '');
  let groups: [string, string, UnitDef[]][];
  const g = o.group;
  if (g === 'faction' || g === 'trait') groups = SYNERGIES.filter((x) => x.kind === g).map((x) => [`<span class="cx-gi" style="--c:${x.color}">${synIcon(x.id) || x.icon}</span>${esc(x.name)}`, `단계 ${x.tiers.join(' / ')}`, UNITS.filter((d) => memberOf(d, x.id))] as [string, string, UnitDef[]]);
  else if (g === 'ctype') groups = (Object.keys(CTYPE_NAME) as (keyof typeof CTYPE_NAME)[]).map((k) => [`${ti(k)}${esc(CTYPE_NAME[k])}`, '', UNITS.filter((d) => d.ctype === k)] as [string, string, UnitDef[]]);
  else if (g === 'ttype') groups = (Object.keys(TTYPE_NAME) as (keyof typeof TTYPE_NAME)[]).map((k) => [`${ti(k)}${esc(TTYPE_NAME[k])}`, '', UNITS.filter((d) => d.ttype === k)] as [string, string, UnitDef[]]);
  else groups = [['', '', UNITS.slice()]];
  groups = groups.filter(([, , l]) => l.length);
  for (const [, , l] of groups) l.sort(cmp);
  const first = groups[0]?.[2].find(o.known)?.id || null;
  const shown = o.sel || first;
  const grid = (l: UnitDef[]) => `<div class="cx-cards">${l.map((d) => unitCard(H, d, d.id === o.sel, d.id === shown, o.known(d))).join('')}</div>`;
  const list = groups.map(([h, sub, l]) => grp('units', '', `${h ? `<h3 class="cx-h">${h} <span class="cx-hn">${l.length}명${sub ? ` · ${esc(sub)}` : ''}</span></h3>` : ''}${grid(l)}`)).join('');
  const bar = tools(searchBox('units', '이름 · 시너지 · 유형 검색'),
    segBar('묶기', UGROUP.map(([k, l]) => [k, l, -1]), g, (k) => `data-a="codex-group" data-v="${k}"`),
    segBar('정렬', USORT.map(([k, l]) => [k, l, -1]), CX2.usort, (k) => go(`usort:units:${k}`)));
  return { html: `${bar}<p class="cx-count muted small">기물 ${UNITS.length}명${g === 'faction' || g === 'trait' ? ' · 시너지가 여럿이면 각 묶음에 모두 나옵니다' : ''}</p>${list}${noneMsg('units', list)}`, first };
}

// ═══════════════════════ 장비
type IGrp = 'C' | 'G' | 'A' | 'L' | 'M' | 'X' | 'T' | 'K' | 'R';
const IGRP_NAME: Record<IGrp, string> = { C: '재료', G: '고급', A: '희귀', L: '전설', M: '문장', X: '시너지 · 기물 전용', T: '포탑 전용', K: '소모품', R: '성유물' };
const RELIC_KEY = 'R:';
const legendOf = (aId: string) => 'L_' + aId.slice(2);
/** 장비 표 전체: 데이터의 목록 상수를 순회 (재료 · 고급 · 희귀 · 전설 · 문장 · 전용 · 소모품 · 성유물) */
export function itemCatalog(): [IGrp, string[]][] {
  return [
    ['C', ALL_COMPONENTS.slice()],
    ['G', ALL_GRADED.slice()],
    ['A', ALL_ADVANCED.slice()],
    ['L', ALL_ADVANCED.map(legendOf)],
    ['M', EMBLEM_SYNS.map(emblemId)],
    ['X', [...HEL_ITEM_IDS.flatMap((x) => [x, legendOf(x)]), ...Object.keys(OCCULT_MODS), ...UNIQUE_IDS, ...JUNK_IDS, CATWHEEL_ZI]],
    ['T', [...TURRET_GEAR_IDS, ...TURRET_MOD_IDS]],
    ['K', Object.keys(CONSUMABLES)],
    ['R', RELICS.map((r) => RELIC_KEY + r.id)],
  ];
}
/** 전용 장비가 속한 시너지 (문장 제외) */
function gearSyn(id: string): SynergyId | null {
  if (isHelItem(id)) return 'HEL';
  if (isKingGear(id)) return 'CHR';
  if (isTurretGear(id) || isTurretMod(id)) return 'ENG';
  if (isOccultMod(id) || (CONSUMABLES[id] && !CONSUMABLES[id].drop)) return 'OCCULT';
  if (CONSUMABLES[id]?.chef) return 'CHEF';
  const owner = UNITS.find((d) => d.item === id);
  return (owner && ([...owner.traits, ...owner.factions] as SynergyId[]).find((s) => SYN_BY_ID[s]?.tiers.length === 1)) || null;
}
/** 시너지 전용 장비 · 상품 목록 (문장 제외) */
function synGear(sid: SynergyId): string[] {
  return itemCatalog().flatMap(([, ids]) => ids).filter((id) => !id.startsWith(RELIC_KEY) && !isEmblem(id) && gearSyn(id) === sid);
}
function itemName(id: string) { return id.startsWith(RELIC_KEY) ? RELIC_BY_ID[id.slice(2)]?.name || id : itemInfo(id).name; }
function itemDescText(id: string) { return id.startsWith(RELIC_KEY) ? RELIC_BY_ID[id.slice(2)]?.desc(1) || '' : itemInfo(id).desc; }
function itemIc(H: CxH, id: string) { return id.startsWith(RELIC_KEY) ? H.relicTok(id.slice(2)) : H.itemIcon(id); }
const tierLabel = (g: IGrp, id: string) => (g === 'T' ? (isTurretMod(id) ? `포탑 개조부품 · ${TURRET_MODS[id].tier}단계` : `포탑 전용 · ${TURRET_GEAR[id]?.grade === 'adv' ? '고급형' : '보급형'}`) : g === 'X' ? (isHelItem(id) ? (id[0] === 'L' ? '동맹 전용 · 전설' : '동맹 전용 · 희귀') : isOccultMod(id) ? `신비 부품 ${OCCULT_MODS[id].tier}단계` : isJunk(id) ? '유닉스제 · 절망 증강' : id === CATWHEEL_ZI ? '유닉스제 · 전설' : '고유') : g === 'K' ? consLabel(id) : IGRP_NAME[g]);
/** 소모품 분류: 합성 · 셰프 · 전설 · 전투 보상 · 상점 */
const consLabel = (id: string) => { const c = CONSUMABLES[id]; return !c?.drop ? '소모품 · 합성' : c.chef ? `소모품 · ${SYN_BY_ID.CHEF.name}` : isLegendConsumable(id) ? '전설 소모품' : '소모품 · 전투 보상 · 상점'; };
/** 공명 주입기의 페이즈별 비중: '1~2페이즈 100% · 3~4페이즈 66.7%' (CFG.inject, 의뢰 페이즈 + 무한 모드 2페이즈까지 보고 마지막 구간은 '이후') */
function injectorShare(id: string): string {
  const parts: [number, number, string][] = [];
  for (let p = 1; p <= CFG.victoryPhase + 2; p++) {
    const ws = injectorWeights(p), tot = ws.reduce((a, [, w]) => a + w, 0), w = ws.find(([x]) => x === id)?.[1] || 0;
    if (!w) continue;
    const t = pctTxt(w / tot), last = parts[parts.length - 1];
    if (last && last[2] === t && last[1] === p - 1) last[1] = p; else parts.push([p, p, t]);
  }
  return parts.map(([a, b, t]) => `${b === CFG.victoryPhase + 2 ? `${a}페이즈 이후` : a === b ? `${a}페이즈` : `${a}~${b}페이즈`} ${t}`).join(' · ');
}
/** 전투 승리 확률표: '일반 15% · 역경 30% · 보스 50%' */
const dropTxt = (t: Record<string, number>) => [['battle', '일반'], ['adversity', '역경 · 도전'], ['boss', '보스']].filter(([k]) => t[k]).map(([k, n]) => `${n} ${pctTxt(t[k])}`).join(' · ');
const USE_TXT: Record<string, string> = { unit: '기물에 끌어다 놓기', item: '장비에 끌어다 놓기', foe: '편성 화면에서 이번 전투의 적에게 끌어다 놓기 (적을 눌러도 됨)', run: '보관함에서 골라 [사용]' };

/** 얻는 곳 (가격 · 확률 · 단계는 설정 · 데이터에서) */
function sources(id: string): string[] {
  const P = CFG.price, D = CFG.drop;
  // 보급 장비 카드: 카드 가치(크레딧 환산)를 가까운 두 등급 가격 사이에서 확률로 맞춘다 (run.ts supplyGear)
  const S = CFG.supply;
  const supGear = (t: 'G' | 'A' | 'L') => t === 'L' ? `보급 장비 카드 (${S.legendFrom}페이즈부터 대박 ${S.jackpot.map(([x]) => `×${x}`).join(' · ')} 카드만, 카드 가치가 ${Math.min(P.G, P.A)}을 넘으면 ${P.L}에 가까울수록 확률 ↑)`
    : `보급 장비 카드 (카드 가치가 ${P.C}을 넘으면 ${Math.min(P.G, P.A)}에 가까울수록 확률 ↑, 고급 ${pctTxt(S.graded)} · 희귀 ${pctTxt(1 - S.graded)})`;
  const out: string[] = [];
  const hall = NEWS_OFFERS.hall as (typeof NEWS_OFFERS)[string] | undefined, legendK = CONSUMABLES.K_legend as (typeof CONSUMABLES)[string] | undefined;
  if (id.startsWith(RELIC_KEY)) {
    const r = RELIC_BY_ID[id.slice(2)];
    if (r.owner && UNIT_BY_ID[r.owner]) out.push(`${UNIT_BY_ID[r.owner].name} 기본 장착`);
    out.push(`순례에서 구매 · 권능 ${r.price}`, `축성 (다음 전투 신권 대행 ×3) · 권능 ${r.enh}`);
    return out;
  }
  const t = id[0];
  if (isHelItem(id)) {
    const hel = SYN_BY_ID.HEL;
    const k = HEL_ITEM_IDS.indexOf('A_' + id.slice(2)) + 1;
    if (t === 'A') out.push(`${hel.name} ${k}단계 (${hel.tiers[k - 1]}명) 첫 도달 시 지급`);
    else out.push(`${hel.name} ${hel.tiers.length}단계 (${hel.tiers[hel.tiers.length - 1]}명) 도달 시 보유한 동맹 장비가 전설로 승격 (효과 2배)`);
    return out;
  }
  if (isTurretGear(id)) {
    const g = TURRET_GEAR[id], s = SYN_BY_ID.ENG;
    out.push(`${s.name} 출전 중 분기점의 [정비] · ${TURRET_PRICE[g.grade]} 크레딧${g.grade === 'basic' ? ' (보급형 1개는 무료)' : ''}`);
    out.push('감시 포탑의 장비 칸에만 장착 (일반 기물 장착 불가 · 일반 상점 · 전리품 · 재구성에 나오지 않음)');
    return out;
  }
  if (isTurretMod(id)) {
    const m = TURRET_MODS[id], s = SYN_BY_ID.ENG;
    out.push(`${s.name} ${m.tier}단계 (${s.tiers[m.tier - 1]}명) 첫 도달 시 그 단계 부품 중 아직 없는 것 1개를 무작위로 지급 (빈 포탑 개조부품 칸이 있으면 바로 장착)`);
    out.push('감시 포탑의 개조부품 칸에만 장착 (일반 기물 장착 불가 · 상점 · 전리품에 나오지 않음)');
    return out;
  }
  if (isOccultMod(id)) {
    const o = OCCULT_MODS[id], s = SYN_BY_ID.OCCULT;
    out.push(`${s.name} ${o.tier}단계 (${s.tiers[o.tier - 1]}명) 첫 도달 시 그 단계 부품 3개 중 1개 선택`);
    return out;
  }
  if (CONSUMABLES[id]) {
    const c = CONSUMABLES[id], S = CFG.shop, chef = SYN_BY_ID.CHEF;
    const foeGear = `적이 장비를 다는 위험 ${FOE_GEAR_DIFF} 이상 의뢰에서만`;
    if (!c.drop) out.push(`${SYN_BY_ID.OCCULT.name} [합성] 공방 · ${c.price} 크레딧`);
    else if (c.chef) {
      const stale = id === 'K_bread_stale', C = CFG.chef;
      if (stale) out.push(`[${CONSUMABLES.K_bread?.name}]을 얻은 뒤 전투 ${C.staleAfter}회를 지나면 (승패 무관, ${chef.name} ${chef.tiers[C.noStaleTier - 1]}명 이상이 켜진 전투는 세지 않음 · 이미 식은 빵은 그대로)`);
      else {
        out.push(`${chef.name} 시너지가 의뢰에서 처음 켜질 때 (${chef.tiers[0]}명) 1개`);
        out.push(`${chef.name} 활성 중 전투 승리 시 확률로 1개: ${chef.tiers.map((n, i) => `${n}명 ${pctTxt(C.breadWin[i] || 0)}`).join(' · ')}`);
        out.push(`전투 ${C.staleAfter}회 뒤 [${CONSUMABLES.K_bread_stale?.name}]이 된다 (회복 −${C.staleHeal} · 판매가 −${C.staleSell}, ${chef.name} ${chef.tiers[C.noStaleTier - 1]}명 이상이 켜진 전투는 세지 않음)`);
      }
      out.push(`회복량 (위험 등급별): ${C.breadHeal.map(([l, h]) => `${diffName(l) || `위험 ${l}`} ${stale ? Math.max(1, h - C.staleHeal) : h}`).join(' · ')}`);
      out.push(`판매가 (난이도별): ${breadSellText(stale)}`);
    } else if (id.startsWith('K_cp_')) { // 캠페인 「회수 계약」 전용 (일반 의뢰에서는 나오지 않음)
      out.push(id === 'K_cp_tape' ? '캠페인 1장: 필리스 합류 사건에서 [상자는 두고 와]를 고르면 1개' : '캠페인 시작 때 라르스가 1개 보낸다');
      out.push('일반 의뢰에서는 나오지 않는다');
    } else if (id === 'K_seize') {
      out.push(`상점 · ${S.price[id]} 크레딧 (${pctTxt(S.seize)} 확률 진열, ${foeGear})`);
      out.push(`전투 승리 보상 (${foeGear}): ${dropTxt(CFG.drop.seize)}`);
    } else if (id === 'K_rank3') {
      out.push(`상점 · ${S.price[id]} 크레딧 (${S.rank3From}페이즈부터 ${pctTxt(S.rank3)} 확률 진열)`);
      out.push(`전투 승리 보상: ${dropTxt(CFG.drop.rank3)}`);
    } else {
      const inj = INJECTORS.includes(id);
      out.push(`전투 승리 보상: ${dropTxt(CFG.drop.utility)} 확률로 소모품 1개 (분리 용제 · 재구성 회로 · 공명 주입기 중 하나${inj ? ', 주입기 크기는 페이즈에 따라' : ''})`);
      out.push(`상점 · ${S.price[id]} 크레딧 (${pctTxt(S.cons)} 확률로 소모품 1개 진열)`);
      if (inj) out.push(`주입기 중 이 크기의 비중: ${injectorShare(id)}`);
    }
    out.push(`사용: ${c.alsoItem ? `${USE_TXT.unit} 또는 ${USE_TXT.item} (장비 1개)` : USE_TXT[c.target]}`);
    return out;
  }
  if (isJunk(id)) { // 절망 증강이 끼워 넣는 잡동사니
    const u = DESPAIR_BY_ID['D.unix'];
    if (u) out.push(`절망 증강 [${u.name}]: 희귀 · 고급 장비를 얻거나 합성할 때 ${pctTxt(CFG.despair.catwheel)} 확률로 대신 들어옴`);
    out.push('조합 · 전설 주조 불가');
    return out;
  }
  if (id === CATWHEEL_ZI) { // 캣휠이 모이면 자동으로 (engine/run.ts mergeCatwheels)
    out.push(`보관함 + 장착 중인 캣휠이 ${CFG.despair.zi}개 모이면 자동으로 합쳐짐 (보관함 것부터, 모자라면 장착한 것 — 그 칸에 그대로 달림)`);
    out.push('조합 · 전설 주조 불가');
    return out;
  }
  if (isLocked(id)) {
    const owner = UNITS.find((d) => d.item === id);
    if (owner) out.push(`${owner.name} 합류 시 장착 (해제 불가)`);
    return out;
  }
  if (isEmblem(id)) {
    const pe = PRIVILEGES.find((p) => p.id === 'P.emblem'), ge = GLOBAL_BY_ID['G.emblem'], ie = INVEST_OFFERS.emblem;
    if (pe) out.push('런 시작 특권 증강 (출전 기물의 시너지 위주)');
    if (ge) out.push(`전역 증강 [${ge.name}] (출전 중인 시너지 중 무작위)`);
    if (ie) out.push(`${SYN_BY_ID.HOI.name} 투자 [${ie.name}] · ${ie.cost} 크레딧 (3개 중 1개)`);
    out.push(`상점 · ${CFG.shop.price.emblem} 크레딧 (${pctTxt(CFG.shop.emblem)} 확률 진열, ${pctTxt(CFG.shop.emblemOwn)}는 출전 기물의 시너지 문장)`);
    out.push('일부 사건 보상');
    return out;
  }
  if (t === 'C') out.push(`상점 · ${P.C} 크레딧 (매번 ${D.shopParts}개)`, `전투 ${pctTxt(D.battle)} 확률 · 역경 ${D.advParts}개 확정 전리품`, '보스 · 도전 전리품, 보급 · 사건 · 퀘스트 보상');
  if (t === 'G') out.push('같은 재료 2개 조합', `상점 · ${P.G} 크레딧 (${pctTxt(D.shopGraded)} 확률 입고 · ${CFG.shop.gearFrom}페이즈부터는 고급 · 희귀 중 1개 이상 확정)`, supGear('G'));
  if (t === 'A') {
    out.push(itemInfo(id).recipe ? '서로 다른 재료 2개 조합' : '조합 불가 (상점 · 보급 · 전리품으로만)');
    out.push(`상점 · ${P.A} 크레딧 (${pctTxt(D.shopAdv)} 확률 입고 · ${CFG.shop.gearFrom}페이즈부터는 고급 · 희귀 중 1개 이상 확정)`, `도전 · ${D.bossAdvEvery}페이즈마다 보스 전리품 (희귀 3개 중 1개)`, supGear('A'));
    if (NEWS_OFFERS.sponsor) out.push(`${SYN_BY_ID.STAR.name} 속보 [${NEWS_OFFERS.sponsor.name}] (무작위)`);
  }
  if (t === 'L') {
    out.push(`상점 · ${P.L} 크레딧 (${D.shopLegendPhase}페이즈부터 ${pctTxt(D.shopLegend)} 확률 입고)`, supGear('L'));
    if (hall) out.push(`${SYN_BY_ID.STAR.name} 속보 [${hall.name}] · 명성 ${hall.cost} (3개 중 1개)`);
    if (legendK) out.push(`소모품 [${legendK.name}] 사용`);
  }
  return out;
}

function itemTile(H: CxH, g: IGrp, id: string, shown: string | null) {
  const on = CX2.sel.items === id, peek = !on && shown === id;
  return `<button class="cx-tile cx2-tile${on ? ' on' : peek ? ' peek' : ''}" ${go(`sel:items:${id}`)} aria-pressed="${on}"${qAttr('items', `${itemName(id)} ${itemDescText(id)} ${tierLabel(g, id)}`)}>
    <span class="cx-face">${itemIc(H, id)}</span><span class="cx-nm">${esc(itemName(id))}</span><span class="cx2-sub">${esc(tierLabel(g, id))}</span></button>`;
}
/** 장비 한 줄 (누르면 장비 상세) */
function itemRow(H: CxH, id: string, note = '') {
  return `<button class="cx2-row" ${go(`go:items:${id}`)}>${itemIc(H, id)}<span><b>${esc(itemName(id))}</b>${note ? ` <span class="cx2-note">${esc(note)}</span>` : ''}<p class="muted">${H.statIc(esc(itemDescText(id)))}</p></span></button>`;
}
function itemDetail(H: CxH, id: string): string {
  const cat = itemCatalog().find(([, ids]) => ids.includes(id));
  if (!cat) return empty('장비를 고르면 효과 · 조합 · 얻는 곳을 볼 수 있습니다.');
  const g = cat[0];
  const a: string[] = [], b: string[] = [];
  if (id.startsWith(RELIC_KEY)) {
    const r = RELIC_BY_ID[id.slice(2)];
    a.push(`<p class="cx2-lead">${H.statIc(esc(r.desc(1)))}</p>`, `<h3>축성 시 <span class="cx-hn">계수 ×3</span></h3><p class="small">${H.statIc(esc(r.desc(3)))}</p>`);
    if (r.owner && UNIT_BY_ID[r.owner]) b.push(`<h3>기본 장착</h3><div class="cx2-mem">${unitChip(H, UNIT_BY_ID[r.owner])}</div>`);
    const div = UNITS.filter((d) => d.ttype === 'divine');
    a.push(`<p class="muted small">${esc(TTYPE_NAME.divine)} 기물 ${div.length}명이 장착할 수 있습니다. 장착한 성유물이 신권 대행이 됩니다.</p>`);
  } else {
    const it = itemInfo(id);
    a.push(`<p class="cx2-lead">${H.statIc(esc(it.desc))}</p>`);
    const maj = Object.entries(it.majors) as [Major, number][];
    if (maj.length) a.push(`<div class="cx2-maj">${maj.map(([m, v]) => `<span>${H.majorIcon(m)}${esc(MAJOR_NAME[m])} <b class="f-num">+${v}</b></span>`).join('')}</div>`);
    if (it.recipe) a.push(`<h3>조합</h3><div class="cx2-recipe">${it.recipe.map((x) => `${H.itemIcon(x)}<span class="small">${esc(itemInfo(x).name)}</span>`).join('<b>+</b>')}<b>=</b>${H.itemIcon(id)}</div>`);
    if (g === 'C') {
      const rows = ALL_COMPONENTS.map((y) => [y, combine(id, y)] as const).filter(([, r]) => r);
      b.push(`<h3>조합 결과 <span class="cx-hn">${rows.length}종</span></h3><ul class="cx2-rows">${rows.map(([y, r]) => `<li class="cx2-mix"><b>+</b>${H.itemIcon(y)}<b>=</b>${itemRow(H, r!)}</li>`).join('')}</ul>`);
    }
    if (g === 'A' || (g === 'X' && isHelItem(id) && id[0] === 'A')) a.push(`<h3>전설 등급</h3><ul class="cx2-rows"><li>${itemRow(H, legendOf(id))}</li></ul>`);
    if (g === 'L' || (g === 'X' && isHelItem(id) && id[0] === 'L')) a.push(`<h3>희귀 등급</h3><ul class="cx2-rows"><li>${itemRow(H, 'A_' + id.slice(2))}</li></ul>`);
    if (isCatwheel(id)) { // 캣휠 ↔ 캣휠(ZI존)
      const other = id === CATWHEEL_ZI ? JUNK_IDS.find((x) => isCatwheel(x)) : CATWHEEL_ZI;
      if (other) a.push(`<h3>${id === CATWHEEL_ZI ? `재료 <span class="cx-hn">${CFG.despair.zi}개</span>` : `${CFG.despair.zi}개가 모이면`}</h3><ul class="cx2-rows"><li>${itemRow(H, other)}</li></ul>`);
    }
    if (isEmblem(id)) {
      const s = SYN_BY_ID[emblemOf(id)];
      b.push(`<h3>시너지</h3><div class="cx2-mem">${synChip(s.id)}</div><p class="muted small">단계 ${s.tiers.join(' / ')} · 소속 ${UNITS.filter((d) => memberOf(d, s.id)).length}명. 장착한 기물이 이 시너지에 1명으로 더해집니다.</p>`);
    }
    const gs = gearSyn(id);
    if (gs && !isEmblem(id)) b.push(`<h3>전용 시너지</h3><div class="cx2-mem">${synChip(gs)}</div>`);
    if (isLocked(id)) { const owner = UNITS.find((d) => d.item === id); if (owner) b.push(`<h3>고유 장비 주인</h3><div class="cx2-mem">${unitChip(H, owner)}</div>`); }
  }
  const src = sources(id);
  if (src.length) a.push(`<h3>얻는 곳</h3><ul class="cx2-src">${src.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);
  // 판매는 소모품만 (빵 판매가는 난이도에 따라 — 얻는 곳에 표시). 장비 · 개조부품은 보관함이 가득 찬 채로 얻을 때만 자동 판매
  const sell = id.startsWith(RELIC_KEY) || isLocked(id) || CONSUMABLES[id]?.chef ? undefined : CFG.sell[id[0]];
  if (sell !== undefined) a.push(`<p class="muted small">${CONSUMABLES[id] ? `판매가 <span class="f-num">${sell}</span> 크레딧` : `판매 불가 · 보관함이 가득 찬 채로 얻으면 자동 판매 <span class="f-num">${sell}</span> 크레딧`}</p>`);
  return `<div class="detail cx-d cx2-d">${head(itemIc(H, id), esc(itemName(id)), esc(tierLabel(g, id)))}${cols(a.join(''), b.join(''))}</div>`;
}
function itemsTab(H: CxH) {
  const cat = itemCatalog();
  const f = CX2.filt.items;
  const bar = filterBar('items', [['all', '전체', cat.reduce((n, [, l]) => n + l.length, 0)], ...cat.map(([g, l]) => [g, IGRP_NAME[g], l.length] as [string, string, number])]);
  const shown = cat.filter(([g]) => f === 'all' || f === g);
  const sel = CX2.sel.items, peek = sel || shown[0]?.[1][0] || null;
  const list = shown.map(([g, ids]) => grp('items', '', `<h3 class="cx-h">${esc(IGRP_NAME[g])} <span class="cx-hn">${ids.length}종</span></h3><div class="cx-grid">${ids.map((id) => itemTile(H, g, id, peek)).join('')}</div>`)).join('');
  return wrap('items', `${tools(searchBox('items', '장비 이름 · 효과 검색'), bar)}${list}${noneMsg('items', list)}`,
    peek ? itemDetail(H, peek) : empty('장비를 고르면 효과 · 조합 · 얻는 곳을 볼 수 있습니다.'));
}

// ═══════════════════════ 시너지
function synTile(sid: SynergyId, peek: string | null) {
  const s = SYN_BY_ID[sid];
  const on = CX2.sel.syn === sid, pk = !on && peek === sid;
  const n = UNITS.filter((d) => memberOf(d, sid)).length;
  return `<button class="cx-tile cx2-tile${on ? ' on' : pk ? ' peek' : ''}" ${go(`sel:syn:${sid}`)} aria-pressed="${on}" style="--c:${s.color}"${qAttr('syn', `${s.name} ${s.desc} ${s.tierDesc.join(' ')} ${UNITS.filter((d) => memberOf(d, sid)).map((d) => d.name).join(' ')}`)}>
    <span class="cx-face cx2-synf">${synIcon(s.id) || esc(s.icon)}</span><span class="cx-nm">${esc(s.name)}</span><span class="cx2-sub"><span class="f-num">${s.tiers.join('/')}</span> · ${n}명</span></button>`;
}
function offerList(title: string, unit: string, offers: { name: string; cost: number; desc: string }[]) {
  return `<h3>${esc(title)}</h3><ul class="cx2-rows">${offers.map((o) => `<li class="cx2-row cx2-offer"><span class="cx2-cost f-num">${o.cost}<small>${esc(unit)}</small></span><span><b>${esc(o.name)}</b><p class="muted">${esc(o.desc)}</p></span></li>`).join('')}</ul>`;
}
/** 호이슌 투자 상품: 설명이 런 상태를 쓰는 상품은 빈 런으로 계산 (대상 기물이 정해지지 않음) */
function investOffers() {
  const dummy = { units: [] } as unknown as RunState;
  return Object.entries(INVEST_OFFERS).map(([id, o]) => {
    let d = '';
    try { d = o.desc(dummy, { id, cost: o.cost, sold: false }); } catch { d = ''; }
    if (!d || d === '대상 없음') d = '보유 기물 1명의 유형 증강 1개를 바로 얻습니다 (대상은 매번 바뀝니다).';
    return { name: o.name, cost: o.cost, desc: d };
  });
}
/** 소속 기물: 작은 초상화 카드 (이름 · 유형) */
function memberCards(H: CxH, list: UnitDef[]) {
  return `<div class="cx-mini">${list.map((d) => `<button class="cx-mc" ${go(`unit:${d.id}`)} title="${esc(d.name)} — 기물 도감에서 보기"><span class="cx-pic">${H.sprite(d)}${H.bust ? H.bust(d.id) : ''}</span><b>${esc(d.name)}</b><small>${esc(CTYPE_NAME[d.ctype])} · ${esc(TTYPE_NAME[d.ttype])}${d.king ? ' · 공왕 (소환)' : d.eventOnly ? ' · 사건' : ''}</small></button>`).join('')}</div>`;
}
/** 공왕 무휼: 인과 단계표 (data/chungra.ts 에서 읽는다) — 청라공국 · 공왕 시너지 도감과 무휼 기물 도감이 함께 쓴다. gear = 전용 장비 줄도 */
export function kingSection(H: CxH, gear = false): string {
  const d = UNIT_BY_ID.muhyul;
  const rows = [...Array(CAUSAL.max).keys()].map((i) => `<tr><th class="f-num">${i + 1}단계</th><td class="f-num">${causalNeed(i + 1)}</td><td>${esc(kingStageText(i + 1))}</td></tr>`).join('');
  return `<h3>공왕 무휼 · 인과 단계 <span class="cx-hn">인과율 = (${CAUSAL.base} + 장비 점수 ÷ ${CAUSAL.gearDiv}) × 청라 단계 배율, 이긴 전투만</span></h3>
    ${d ? `<div class="cx2-row">${H.sprite(d)}<span><button class="cx2-note" ${go('unit:muhyul')} title="기물 도감에서 보기">${esc(d.name)} · ${esc(CTYPE_NAME[d.ctype])} · ${esc(TTYPE_NAME[d.ttype])}</button><p class="muted">출전 칸 밖에 포탑처럼 놓이고, 공명도 · 영입 · 판매가 없습니다. 청라공국 인원에는 세지 않습니다.</p></span></div>` : ''}
    <table class="cx-tbl cx2-tiers"><thead><tr><th>단계</th><th>누적 인과율</th><th>능력치</th></tr></thead><tbody>${rows}</tbody></table>
    <ul class="cx2-rows">${KING_MS_TEXT.map((x) => `<li class="muted">${esc(x)}</li>`).join('')}</ul>
    ${gear ? `<h3>전용 장비 <span class="cx-hn">청라공국 3 · 5 · 7명에 해금 · 자동 장착</span></h3><ul class="cx2-rows">${KING_GEAR.map((id, i) => `<li>${itemRow(H, id, `청라 ${[3, 5, 7][i]}명`)}</li>`).join('')}</ul>` : ''}`;
}
/** 최고의 친구 소환물: 주인 · 소환물 · 전투 유형 · 기본 공격 · 기술 (주인 스킬 연계, 기본 파라미터) — 데이터(UnitDef.summon · ABIL[].summon)에서 읽는다 */
function buddySummons(H: CxH) {
  const gl = new Set<string>();
  const atkText = (sd: SummonDef) => `기본 공격: ${sd.atk.type === 'shoot' ? '사격' : '타격'} · ${ELEM_NAME[sd.atk.elem]} · 사거리 ${sd.range} · 공격 간격 ${sd.atk.interval}초${sd.basicMult && sd.basicMult !== 1 ? ` · 계수 ${pctTxt(sd.basicMult)}` : ''} · 체력 ×${sd.hpMul || 1}${sd.rate ? ` · 상속 ×${+sd.rate.toFixed(2)}` : ''}${sd.focusLow ? ' · 체력 비율이 가장 낮은 적을 노림' : ''}`;
  const rows = UNITS.filter((d) => d.summon).flatMap((d) => [d.summon!, ...(d.summon!.also || [])].map((sd, i) => {
    const info = ABIL[d.id]?.summon?.[sd.name]?.(d.skill.params);
    const atk = atkText(sd);
    const sk = info ? `기술 (${esc(d.skill.name)} 연계): ${info.rows.map(([k, v]) => `${esc(k)}: ${H.statIc(AB.tok(v, NO_CTX, gl))}`).join(' · ')}` : '';
    const face = H.sprite({ id: sd.art || `sm_${d.id}_${i}`, name: sd.name, sprite: sd.sprite, palette: sd.palette, art: sd.art } as unknown as UnitDef);
    return `<li class="cx2-row">${face}<span><b>${esc(sd.name)}</b> <span class="cx2-note">${esc(sd.ctype ? CTYPE_NAME[sd.ctype] : '소환물')}</span> <button class="cx2-note" ${go(`unit:${d.id}`)} title="기물 도감에서 보기">${esc(d.name)}</button><p class="muted">${esc(atk)}</p>${sk ? `<p class="muted">${sk}</p>` : ''}</span></li>`;
  }));
  // 최고의 친구 문장을 단 기물이 부르는 반려 돌(인화성) (data/emblems.ts)
  const rk = EMB_ROCK, rface = H.sprite({ id: rk.art, name: rk.name, sprite: rk.sprite, palette: rk.palette, art: rk.art } as unknown as UnitDef);
  rows.push(`<li class="cx2-row">${rface}<span><b>${esc(rk.name)}</b> <span class="cx2-note">${esc(rk.ctype ? CTYPE_NAME[rk.ctype] : '소환물')}</span> <button class="cx2-note" ${go(`go:items:${emblemId('BUDDY')}`)} title="장비 도감에서 보기">${esc(itemName(emblemId('BUDDY')))} 장착 기물</button><p class="muted">${esc(atkText(rk))}</p><p class="muted">${esc(emblemText('BUDDY'))}</p></span></li>`);
  return `<h3>소환물 <span class="cx-hn">기본 상속률 ${pctTxt(CFG.bond.base)} · 단계가 오르면 위 표대로</span></h3><ul class="cx2-rows">${rows.join('')}</ul>`;
}
function synDetail(H: CxH, sid: SynergyId): string {
  const s = SYN_BY_ID[sid];
  if (!s) return empty('시너지를 고르면 단계별 효과 · 소속 기물 · 전용 장비를 볼 수 있습니다.');
  const mem = UNITS.filter((d) => memberOf(d, sid));
  const a: string[] = [], b: string[] = [];
  a.push(`<p class="cx2-lead">${br(s.desc)}</p>`);
  // 단계별 효과: 효과 한 줄씩, 이전 단계보다 바뀐 숫자 강조 · 새로 붙은 효과 '+' (tierdiff.ts, 문구는 tierDesc 그대로)
  a.push(`<h3>단계별 효과 <span class="cx-hn">바뀐 수치 강조 · + 새 효과</span></h3><table class="cx-tbl cx2-tiers" style="--c:${s.color}"><tbody>${s.tiers.map((need, i) => `<tr><th class="f-num">${need}명</th><td>${tierCellHtml(s.tierDesc[i - 1], s.tierDesc[i] ?? '', esc, H.statIc)}</td></tr>`).join('')}</tbody></table>`);
  b.push(`<h3>소속 기물 <span class="cx-hn">${mem.length}명</span></h3>${memberCards(H, mem)}`);
  if (EMBLEM_SYNS.includes(sid)) a.push(`<h3>문장</h3><ul class="cx2-rows"><li>${itemRow(H, emblemId(sid))}</li></ul>`);
  const gear = synGear(sid);
  if (gear.length) a.push(`<h3>${sid === 'ENG' ? '포탑 전용 장비 · 개조부품' : '전용 장비 · 상품'} <span class="cx-hn">${gear.length}종</span></h3><ul class="cx2-rows">${gear.map((id) => `<li>${itemRow(H, id, isHelItem(id) ? (id[0] === 'L' ? '전설' : '희귀') : isOccultMod(id) ? `${OCCULT_MODS[id].tier}단계` : CONSUMABLES[id] ? (CONSUMABLES[id].chef ? '소모품' : `합성 · ${CONSUMABLES[id].price}`) : isTurretGear(id) ? `${TURRET_GEAR[id].grade === 'adv' ? '고급형' : '보급형'} · ${TURRET_PRICE[TURRET_GEAR[id].grade]}` : isTurretMod(id) ? `개조부품 · ${TURRET_MODS[id].tier}단계` : '')}</li>`).join('')}</ul>`);
  if (sid === 'KAL') {
    const k = KAL_GUARD_TEXT;
    const counts = s.tiers.map((need, i) => (KAL_GUARDS[i] ? `(${need}) ${KAL_GUARDS[i]}기` : '')).filter(Boolean).join(' · ');
    a.push(`<h3>소환물 · ${esc(k.name)} <span class="cx-hn">${esc(counts)}</span></h3><div class="cx2-row cx2-knight">${H.sprite({ id: 'kal_guard', name: k.name, sprite: 'knight', palette: KNIGHT_PAL } as unknown as UnitDef)}<span><b>${esc(k.name)}</b> <span class="cx2-note">${esc(CTYPE_NAME.VAN)} · ${esc(TTYPE_NAME.major)} · 소환물</span><p class="muted">${esc(k.desc)}</p><p class="muted">${esc(k.weapon)}<br>${esc(k.skill)}<br>${esc(k.ult)}</p></span></div>`);
  }
  if (sid === 'BUDDY') a.push(buddySummons(H));
  if (sid === 'CHR' || sid === 'KING') a.push(kingSection(H, sid === 'KING'));
  if (sid === 'HOI') a.push(offerList('[투자] 상품', '크레딧', investOffers()));
  if (sid === 'STAR') a.push(offerList('[속보] 명성 교환', '명성', Object.values(NEWS_OFFERS)));
  if (sid === 'VOYAGE') a.push(`<h3>단독 출항 · 완전체 고유 능력</h3><ul class="cx2-rows">${Object.entries(VOYAGE_SPECIAL).map(([uid, v]) => `<li class="cx2-row">${UNIT_BY_ID[uid] ? H.sprite(UNIT_BY_ID[uid]) : ''}<span><b>${esc(v.who)} · ${esc(v.name)}</b><p class="muted">${esc(v.text)}</p></span></li>`).join('')}</ul>`);
  if (sid === 'NAV') {
    const aces = UNITS.filter((d) => d.ace);
    a.push(`<h3>에이스 파일럿 능력 <span class="cx-hn">능력 ×1 기준</span></h3><ul class="cx2-rows">${aces.map((d) => `<li class="cx2-row">${H.sprite(d)}<span><b>${esc(d.name)} · ${esc(d.ace!.name)}</b><p class="muted">${H.statIc(esc(d.ace!.desc(1)))}</p></span></li>`).join('')}</ul>`);
  }
  const lore = LORE.filter((e) => e.rel?.syn?.includes(sid));
  if (lore.length) b.push(`<h3>세계관</h3><div class="cx2-mem">${lore.map((e) => loreChip(e.id)).join('')}</div>`);
  return `<div class="detail cx-d cx2-d">${head(`<span class="cx2-synf big" style="--c:${s.color}">${synIcon(s.id) || esc(s.icon)}</span>`, esc(s.name), `${KIND_NAME[s.kind]} · 단계 <span class="f-num">${s.tiers.join(' / ')}</span>${EMBLEM_SYNS.includes(sid) ? ' · 문장 있음' : ' · 전용'}`)}${cols(a.join(''), b.join(''))}</div>`;
}
function synTab(H: CxH) {
  const f = CX2.filt.syn;
  const kinds: ['faction' | 'trait' | 'solo', string, SynergyId[]][] = [
    ['faction', '세력', SYNERGIES.filter((s) => s.kind === 'faction' && s.tiers.length > 1).map((s) => s.id)],
    ['trait', '특성', SYNERGIES.filter((s) => s.kind === 'trait' && s.tiers.length > 1).map((s) => s.id)],
    ['solo', '전용 (1명)', SYNERGIES.filter((s) => s.tiers.length <= 1).map((s) => s.id)],
  ];
  const bar = filterBar('syn', [['all', '전체', SYNERGIES.length], ...kinds.map(([k, l, ids]) => [k, l, ids.length] as [string, string, number])]);
  const shown = kinds.filter(([k, , ids]) => ids.length && (f === 'all' || f === k));
  const sel = CX2.sel.syn as SynergyId | null, peek = sel || shown[0]?.[2][0] || null;
  const list = shown.map(([, l, ids]) => grp('syn', '', `<h3 class="cx-h">${esc(l)} <span class="cx-hn">${ids.length}종</span></h3><div class="cx-grid">${ids.map((id) => synTile(id, peek)).join('')}</div>`)).join('');
  return wrap('syn', `${tools(searchBox('syn', '시너지 · 효과 · 기물 이름 검색'), bar)}${list}${noneMsg('syn', list)}`,
    peek ? synDetail(H, peek as SynergyId) : empty('시너지를 고르면 단계별 효과 · 소속 기물 · 문장 · 전용 장비를 볼 수 있습니다.'));
}

// ═══════════════════════ 증강 문장 (토큰 → 계수 표시)
const NO_CTX: AB.AbilCtx = { b: null, c: null, p: {} };
export function augHtml(H: CxH, id: string, param?: string, gl = new Set<string>()) {
  const t = augAbilText(id);
  return t ? H.statIc(AB.tok(t, NO_CTX, gl)) : esc(augDesc(id, param));
}
/** ◆ 변형 증강: 변형 후 비술 · 지속 능력 한 줄 요약 (psiinfo 에서 읽음) */
function tfLine(H: CxH, id: string) {
  const tp = transformPreview(id);
  if (!tp) return '';
  const gl = new Set<string>();
  const part = (label: string, name: string, rows: [string, string][], tgt?: string) =>
    `<span class="cx2-tfv"><b>${label} 「${esc(name)}」</b>${tgt ? ` 대상: ${esc(tgt)} ·` : ''} ${rows.map(([k, v]) => `${esc(k)}: ${H.statIc(AB.tok(v, NO_CTX, gl))}`).join(' · ')}</span>`;
  const s = SCHOOL_BY_ID[tp.sid];
  return `${tp.cantrip.transform ? `<br>${part('변형 후 비술', tp.cantrip.name, tp.cantrip.info.rows, tp.cantrip.info.tgt)}` : ''}${tp.passive.transform ? `<br>${part('변형 후 지속', s.passive.name, tp.passive.rows)}` : ''}`;
}
/** 조합 조건 (경고 표기): 기본값 기준으로 못 채우면 경고색, 전투 중 상태에 달리면 안내색 */
function reqLine(id: string, tag = 'span') {
  const rq = augReqState(id);
  return rq ? `<${tag} class="cx2-req ${rq.ok === false ? 'warn' : 'info'}">⚠ 조합 조건: ${esc(rq.hint)}. <span class="muted">${esc(rq.cur)}</span></${tag}>` : '';
}
function augLi(H: CxH, a: AugDef, tags: string[] = [], q = '') {
  const all = [...tags, ...(isLegendAug(a.id) ? ['★ 전설'] : []), ...(a.stack ? ['중복 가능'] : []), ...(a.roll ? ['능력치 무작위'] : [])];
  const text = augHtml(H, a.id) + tfLine(H, a.id);
  return `<li class="aug-li" data-id="${esc(a.id)}"${qAttr('augs', `${a.name} ${a.desc} ${text} ${all.join(' ')} ${q}`)}>${H.augIcon(a.id)}<span><b>${augMark(a.id)}${esc(a.name)}</b>${all.map((t) => ` <span class="cx2-note">${esc(t)}</span>`).join('')}<br><span class="muted">${text}</span>${reqLine(a.id)}</span></li>`;
}

// ═══════════════════════ 사이오닉
// 2단계 탐색: 목록 = 학파 4개 아래에 각 학파의 전공. 상세 = 아무것도 안 고름(학파 비교) → 학파(전공 비교) → 전공.
// 전공 상세 순서: 무엇을 하는가 → 이성 관리 → 성장(전공 증강 · ◆ 변형 미리보기) → 상성 → 가질 수 있는 기물.
// 선택 id: 전공 = SchoolId, 학파 = 'g.<GroupId>'
const groupUnits = (g: GroupId) => UNITS.filter((d) => d.ttype === 'psionic' && UNIT_GROUP[d.id] === g);
const freeUnits = () => UNITS.filter((d) => d.ttype === 'psionic' && !UNIT_GROUP[d.id]);
const schoolAugs = (sid: SchoolId) => ALL_AUGS.filter((a) => a.pool === 'psionic' && a.owner === sid);
const GSEL = 'g.';
const selGroup = (sel: string | null): GroupId | null => (!sel ? null : sel.startsWith(GSEL) ? (sel.slice(GSEL.length) as GroupId) : SCHOOL_BY_ID[sel as SchoolId]?.group || null);
/** 한 단계 위 (전공 → 학파 → 처음) */
const psiParent = (sel: string) => (SCHOOL_BY_ID[sel as SchoolId] ? `${GSEL}${SCHOOL_BY_ID[sel as SchoolId].group}` : '');
/** 이성 범위 (엔진 addReason 의 상하한) */
const REASON_MAX = 100;
const rp = (v: number) => `${Math.round(((v + REASON_MAX) / (2 * REASON_MAX)) * 1000) / 10}%`;
const sgn = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
/** 이성 구간: 막대 (−100 ~ +100, 고이성 · 저이성 표시 기준, 시작값) + 구간별 효과 */
function reasonBand(g: (typeof GROUPS)[GroupId] | null) {
  const ticks = [-REASON_MAX, REASON_LO, 0, REASON_HI, REASON_MAX];
  const fr = GLOSS.frenzy;
  return `<div class="psi-rb">
    <div class="rb-bar" aria-hidden="true"><span class="rb-lo" style="width:${rp(REASON_LO)}"><small>저이성</small></span><span class="rb-hi" style="left:${rp(REASON_HI)}"><small>고이성</small></span><i class="rb-mk" style="left:${rp(CFG.reasonStart)}" title="전투 시작 이성"></i></div>
    <div class="rb-ticks f-num" aria-hidden="true">${ticks.map((v) => `<span style="left:${rp(v)}">${sgn(v)}</span>`).join('')}<span class="rb-st" style="left:${rp(CFG.reasonStart)}">시작 ${sgn(CFG.reasonStart)}</span></div>
    <dl class="cx-rows">
      <dt>고이성 <small class="f-num">${sgn(REASON_HI)} 초과</small></dt><dd>${g ? esc(g.high) : '학파마다 다름 (아래 표)'}</dd>
      <dt>저이성 <small class="f-num">${sgn(REASON_LO)} 미만</small></dt><dd>${g ? esc(g.low) : '학파마다 다름 (아래 표)'}</dd>
      ${fr ? `<dt>${esc(fr.name)} <small class="f-num">${sgn(-REASON_MAX)}</small></dt><dd>${esc(fr.desc)}</dd>` : ''}
    </dl>
    ${GLOSS.reason ? `<p class="muted small">${esc(GLOSS.reason.desc)}</p>` : ''}
  </div>`;
}
function psiTab(H: CxH) {
  const groups = Object.entries(GROUPS) as [GroupId, (typeof GROUPS)[GroupId]][];
  const sel = CX2.sel.psi, sg = selGroup(sel);
  const psiR = milestones(CFG.growth.psionic, 'psionic');
  const rules = `<dl class="cx-rows psi-rules">
    <dt>학파</dt><dd>기물마다 정해져 있고, 이성 효과를 정합니다.</dd>
    <dt>전공</dt><dd>합류할 때 학파의 전공 ${groups[0][1].majors.length}개 중 1개. 비술 + 지속 능력.</dd>
    <dt>전공 증강</dt><dd>${esc(psiR)}에 그 전공의 증강 ${schoolAugs(SCHOOLS[0].id).length}종 중 1개 (최대 ${msCount(CFG.growth.psionic, 'psionic')}개). ◆ = 변형.</dd></dl>`;
  const faces = (l: UnitDef[]) => `<span class="psi-gu">${l.map((d) => H.sprite(d)).join('')}</span>`;
  const list = groups.map(([gid, g]) => `<div class="psi-g${sg === gid ? ' open' : ''}">
    <button class="psi-gh${sel === GSEL + gid ? ' on' : ''}" ${go(`sel:psi:${GSEL}${gid}`)} aria-pressed="${sel === GSEL + gid}"><span><b>${esc(g.name)}</b><small>${esc(g.study)}</small></span>${faces(groupUnits(gid))}</button>
    <div class="psi-ms">${g.majors.map((sid) => {
      const s = SCHOOL_BY_ID[sid], on = sel === sid;
      return `<button class="psi-m${on ? ' on' : ''}" style="--sc:${s.color}" ${go(`sel:psi:${sid}`)} aria-pressed="${on}">${lineIcon(`s.${sid}`, 'li')}<span><b>${esc(s.name)}</b><small>${esc(s.study)}</small></span></button>`;
    }).join('')}</div></div>`).join('');
  const free = freeUnits();
  const foot = free.length ? `<div class="psi-g psi-free"><div class="psi-gh"><span><b>학파 없음</b><small>${SCHOOLS.length}개 전공 중에서 고름</small></span>${faces(free)}</div></div>` : '';
  const detail = !sel ? psiOverview(H) : sel.startsWith(GSEL) && GROUPS[sg!] ? psiGroupDetail(H, sg!) : SCHOOL_BY_ID[sel as SchoolId] ? psiDetail(H, sel as SchoolId) : psiOverview(H);
  return wrap('psi', `${rules}<div class="psi-tree">${list}${foot}</div>`, detail, sel && SCHOOL_BY_ID[sel as SchoolId] ? GROUPS[SCHOOL_BY_ID[sel as SchoolId].group].name : '학파 목록');
}
/** 처음 화면: 이성 구간 + 학파 비교 표 */
function psiOverview(H: CxH) {
  const rows = (Object.entries(GROUPS) as [GroupId, (typeof GROUPS)[GroupId]][]).map(([gid, g]) => `<tr>
    <th><button class="cx-lk" ${go(`sel:psi:${GSEL}${gid}`)}>${esc(g.name)}</button><small>${esc(g.study)}</small></th>
    <td data-h="고이성">${esc(g.high)}</td><td data-h="저이성">${esc(g.low)}</td>
    <td data-h="전공">${g.majors.map((sid) => `<button class="cx-lk psi-ml" style="--sc:${SCHOOL_BY_ID[sid].color}" ${go(`sel:psi:${sid}`)}>${lineIcon(`s.${sid}`, 'li')}${esc(SCHOOL_BY_ID[sid].name)}</button>`).join('')}</td>
    <td data-h="기물">${groupUnits(gid).map((d) => esc(d.name)).join(', ') || '—'}</td></tr>`).join('');
  return `<div class="detail cx-d cx2-d psi-d">${head(lineIcon('a.reason', 'li cx2-sico'), `${esc(TTYPE_NAME.psionic)}`, '학파를 고르면 그 학파의 전공을, 전공을 고르면 자세한 동작을 볼 수 있습니다.')}
    <section class="psi-sec"><h3>이성 구간</h3>${reasonBand(null)}</section>
    <section class="psi-sec"><h3>학파 비교</h3><table class="cx-tbl cx-stack psi-ov"><thead><tr><th>학파</th><th>고이성</th><th>저이성</th><th>전공</th><th>기물</th></tr></thead><tbody>${rows}</tbody></table></section>
  </div>`;
}
/** 학파 상세: 이성 효과 + 두 전공 비교 + 소속 기물 */
function psiGroupDetail(H: CxH, gid: GroupId) {
  const g = GROUPS[gid];
  const ms = g.majors.map((sid) => SCHOOL_BY_ID[sid]);
  const row = (label: string, f: (sid: SchoolId) => string) => `<tr><th>${esc(label)}</th>${ms.map((s) => `<td data-h="${esc(s.name)}">${f(s.id)}</td>`).join('')}</tr>`;
  const tfName = (sid: SchoolId) => schoolAugs(sid).find((a) => isTransformAug(a.id))?.name;
  const core = (sid: SchoolId) => schoolCore(sid);
  const cmp = `<table class="cx-tbl cx-stack psi-cmp"><thead><tr><th></th>${ms.map((s) => `<th><span class="psi-ml" style="--sc:${s.color}">${lineIcon(`s.${s.id}`, 'li')}${esc(s.name)}</span></th>`).join('')}</tr></thead><tbody>
    ${row('핵심', (sid) => esc(SCHOOL_LINE[sid] || ''))}
    ${row('비술', (sid) => { const cv = cantripView(sid); return `<b>${esc(cv.name)}</b> <span class="muted f-num">${cv.cd}초 · 이성 −${cv.cost}</span>`; })}
    ${row('지속 능력', (sid) => `<b>${esc(SCHOOL_BY_ID[sid].passive.name)}</b> <span class="muted">${esc(passiveView(sid).brief)}</span>`)}
    ${row('거는 상태', (sid) => core(sid).statuses.map((k) => esc(PSI_STATUS[k].name)).join(' · ') || '—')}
    ${row('피해 속성', (sid) => core(sid).elems.map((e) => esc(ELEM_NAME[e])).join(' · ') || '—')}
    ${row('◆ 변형', (sid) => (tfName(sid) ? esc(tfName(sid)!) : '—'))}
    ${row('★ 전설', (sid) => schoolAugs(sid).filter((a) => isLegendAug(a.id)).map((a) => esc(a.name)).join(' · ') || '—')}
    ${row('전공 증강', (sid) => { const l = schoolAugs(sid); const n = l.filter((a) => isLegendAug(a.id)).length, r = l.filter((a) => a.requires).length; return `기본 <span class="f-num">${l.length - n}</span>종 · ★ 전설 <span class="f-num">${n}</span>종${r ? ` · 조합 조건 <span class="f-num">${r}</span>종` : ''}`; })}
  </tbody></table>`;
  const units = groupUnits(gid);
  return `<div class="detail cx-d cx2-d psi-d">
    <nav class="cx-crumb" aria-label="위치"><button ${go('sel:psi:')}>${esc(TTYPE_NAME.psionic)}</button><span aria-hidden="true">›</span><b>${esc(g.name)}</b></nav>
    ${head(`<span class="psi-gmark" style="--sc:${g.color}"></span>`, esc(g.name), `${esc(g.study)} · 전공 ${g.majors.length}개`)}
    <section class="psi-sec"><h3>이성 효과</h3>${reasonBand(g)}</section>
    <section class="psi-sec"><h3>전공 <span class="cx-hn">합류할 때 하나를 고릅니다 · 눌러서 자세히</span></h3>
      <div class="psi-ms psi-ms-d">${ms.map((s) => `<button class="psi-m" style="--sc:${s.color}" ${go(`sel:psi:${s.id}`)}>${lineIcon(`s.${s.id}`, 'li')}<span><b>${esc(s.name)} ›</b><small>${esc(s.study)}</small></span></button>`).join('')}</div>
      <h4>비교</h4>${cmp}</section>
    <section class="psi-sec"><h3>이 학파의 기물 <span class="cx-hn">${units.length}명</span></h3><ul class="cx2-rows">${units.map((d) => `<li>${unitRowBtn(H, d, PSI_BRIEF[d.id] || d.psi?.desc || '')}</li>`).join('')}</ul></section>
  </div>`;
}
/** 전공 증강 한 줄: 이름 · 무엇을 바꾸는지 · 효과 · 조합 조건 (경고) */
function psiAugRow(H: CxH, sid: SchoolId, a: AugDef, gl: Set<string>) {
  const c = cantripView(sid, [a.id]), p = passiveView(sid, [a.id]);
  const tf = isTransformAug(a.id), lg = isLegendAug(a.id);
  const hit = [c.transform || c.mods.length ? '비술' : '', p.transform || p.mods.length ? '지속 능력' : ''].filter(Boolean);
  const t = augAbilText(a.id);
  const text = t ? H.statIc(AB.tok(t, NO_CTX, gl)) : esc(a.desc);
  return `<div class="pa${tf ? ' tf' : ''}" data-id="${esc(a.id)}"><div class="pa-n">${H.augIcon(a.id)}<span><b>${augMark(a.id)}${esc(a.name)}</b><small>${tf ? '변형 · ' : lg ? '전설 · ' : ''}${hit.length ? `${hit.join(' · ')} 변경` : '추가 효과'}</small></span></div><div class="pa-t">${text}${reqLine(a.id, 'p')}</div></div>`;
}
/** 상성: 핵심 상태 · 피해 속성이 적 분류마다 어떻게 받는지 (엔진 규칙에서) + 전장별 경고 (matchup.ts) */
function psiMatchup(sid: SchoolId) {
  const core = schoolCore(sid);
  const cats = Object.keys(CATEGORY_NAME) as Category[];
  const mark = (cls: string, t: string) => `<span class="cx2-st ${cls}">${t}</span>`;
  const colsDef: { h: string; f: (c: Category | 'boss') => string }[] = [
    ...core.statuses.map((k) => ({ h: PSI_STATUS[k].name, f: (c: Category | 'boss') => (c === 'boss' ? BOSS_CC_IMMUNE.includes(k) : categoryImmune(c, { key: k, type: 'buff' })) ? mark('bad', '면역') : '' })),
    ...core.elems.map((e) => ({ h: `${ELEM_NAME[e]} 피해`, f: (c: Category | 'boss') => { if (c === 'boss') return ''; const m = categoryMult(c, e); return m > 1 ? mark('good', `취약 ×${m}`) : m < 1 ? mark('bad', `저항 ×${m}`) : ''; } })),
  ];
  if (!colsDef.length) return '<p class="muted small">이 전공의 비술 · 지속 능력에는 적 분류에 따라 막히는 상태나 피해 속성이 없습니다.</p>';
  const rowsC: [Category | 'boss', string][] = [...cats.map((c) => [c, CATEGORY_NAME[c]] as [Category, string]), ...(core.statuses.length ? [['boss', '보스'] as ['boss', string]] : [])];
  const tbl = `<table class="cx-tbl psi-mx"><thead><tr><th>적 분류</th>${colsDef.map((c) => `<th>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rowsC.map(([c, n]) => `<tr><th>${esc(n)}</th>${colsDef.map((d) => `<td>${d.f(c) || '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const fw = FIELDS.map((f) => [f, schoolWarnings(sid, f.id)] as const);
  const hitF = fw.filter(([, w]) => w.length), okF = fw.filter(([, w]) => !w.length);
  const fl = hitF.length ? `<ul class="psi-fw">${hitF.map(([f, w]) => `<li><button class="cx-lk" ${go(`tab:enemies:${f.id}`)} title="이 전장의 적 보기">${esc(f.name)}</button><span>${w.map((x) => mark(x.level, esc(x.text))).join('')}</span></li>`).join('')}</ul>` : '';
  return `<p class="muted small">비술 · 지속 능력이 거는 상태: ${core.statuses.map((k) => esc(PSI_STATUS[k].name)).join(' · ') || '없음'} · 피해 속성: ${core.elems.map((e) => esc(ELEM_NAME[e])).join(' · ') || '없음'}</p>${tbl}
    <h4>전장별</h4>${fl}${okF.length ? `<p class="muted small">특이 사항 없음: ${okF.map(([f]) => esc(f.name)).join(' · ')}</p>` : ''}`;
}
function psiDetail(H: CxH, sid: SchoolId) {
  const s = SCHOOL_BY_ID[sid], g = GROUPS[s.group];
  const gl = new Set<string>();
  const all = schoolAugs(sid);
  const augs = [...all.filter((a) => isTransformAug(a.id)), ...all.filter((a) => !isTransformAug(a.id) && !isLegendAug(a.id)), ...all.filter((a) => isLegendAug(a.id))];
  const nLeg = augs.filter((a) => isLegendAug(a.id)).length;
  const cv = cantripView(sid);
  const units = [...groupUnits(s.group), ...freeUnits()];
  const rAugs = augs.filter((a) => a.requires?.reason);
  const tfa = augs.find((a) => isTransformAug(a.id));
  const tp = tfa ? transformPreview(tfa.id) : null;
  const tfBlock = tp && tfa ? `<div class="psi-tf"><h4>◆ 「${esc(tfa.name)}」을 고르면 <span class="cx-hn">바뀐 모습</span></h4><div class="cx2-cols even">${tp.cantrip.transform ? `<div class="cx2-c abils">${cantripCard(H, sid, [tfa.id], gl)}</div>` : ''}${tp.passive.transform ? `<div class="cx2-c abils">${passiveCard(H, sid, [tfa.id], gl)}</div>` : ''}</div></div>` : '';
  return `<div class="detail cx-d cx2-d psi-d" style="--sc:${s.color}">
    <nav class="cx-crumb" aria-label="위치"><button ${go('sel:psi:')}>${esc(TTYPE_NAME.psionic)}</button><span aria-hidden="true">›</span><button ${go(`sel:psi:${GSEL}${s.group}`)}>${esc(g.name)}</button><span aria-hidden="true">›</span><b>${esc(s.name)}</b></nav>
    ${head(lineIcon(`s.${sid}`, 'li cx2-sico'), esc(s.name), `${esc(g.name)} · ${esc(s.study)}`)}
    <section class="psi-sec"><h3>무엇을 하는가</h3><p class="cx2-lead">${esc(SCHOOL_LINE[sid] || '')}</p>
      <div class="cx2-cols even"><div class="cx2-c abils">${cantripCard(H, sid, [], gl)}</div><div class="cx2-c abils">${passiveCard(H, sid, [], gl)}</div></div></section>
    <section class="psi-sec"><h3>이성 관리</h3>${reasonBand(g)}
      <dl class="cx-rows"><dt>소모</dt><dd>비술 1회마다 이성 −<span class="f-num">${cv.cost}</span> (쿨다운 <span class="f-num">${cv.cd}</span>초)</dd>${rAugs.length ? `<dt>이성 조건 증강</dt><dd>${rAugs.map((a) => `<b>${esc(a.name)}</b> — ${esc(a.requires!.hint)}`).join('<br>')}</dd>` : ''}</dl></section>
    <section class="psi-sec"><h3>성장 · 전공 증강 <span class="cx-hn">기본 ${augs.length - nLeg}종 + ★ 전설 ${nLeg}종 · ${esc(milestones(CFG.growth.psionic, 'psionic'))}에 1개씩, 최대 ${msCount(CFG.growth.psionic, 'psionic')}개</span></h3>
      <p class="muted small">★ 전설: 선택지 ${CFG.augmentChoices}장 중 1장으로 섞일 확률 ${Math.round(CFG.psiLegend.base * 100)}%, 전설 없이 전공 증강을 고를 때마다 +${Math.round(CFG.psiLegend.pity * 100)}%p (전설을 한 번 얻으면 다시 ${Math.round(CFG.psiLegend.base * 100)}%).</p>
      <div class="psi-augs">${augs.map((a) => psiAugRow(H, sid, a, gl)).join('')}</div>${tfBlock}</section>
    <section class="psi-sec"><h3>상성</h3>${psiMatchup(sid)}</section>
    <section class="psi-sec"><h3>이 전공을 가질 수 있는 기물 <span class="cx-hn">${units.length}명</span></h3><ul class="cx2-rows">${units.map((d) => `<li>${unitRowBtn(H, d, PSI_BRIEF[d.id] || d.psi?.desc || '')}</li>`).join('')}</ul></section>
    ${AB.glossHtml(gl)}
  </div>`;
}
/** 비술 카드 (augs = 반영할 전공 증강, ◆ 변형이면 머리에 표시) */
function cantripCard(H: CxH, sid: SchoolId, augs: string[], gl: Set<string>) {
  const cv = cantripView(sid, augs);
  return `<div class="abil cx2-ab has-tok">${H.abTok(`cantrip.${sid}`)}<div class="ab-head"><span class="ab-kind">비술</span><b>${esc(cv.name)}</b>${cv.transform ? `<span class="psi-tf-tag">◆ 변형: ${esc(cv.transform)}</span>` : ''}<span class="ab-meta">${lineIcon('a.cd', 'li')}${cv.cd}초 · ${lineIcon('a.reason', 'li')}이성 -${cv.cost}</span></div>
    <div class="cx2-body">${AB.skillBody(cv.info, NO_CTX, 0, cv.cd, gl)}${AB.rowsHtml([['이성 소모', `${lineIcon('a.reason', 'li')}-${cv.cost}`]])}</div></div>`;
}
function passiveCard(H: CxH, sid: SchoolId, augs: string[], gl: Set<string>) {
  const s = SCHOOL_BY_ID[sid], pv = passiveView(sid, augs);
  return `<div class="abil cx2-ab has-tok">${H.abTok(`passive.${sid}`)}<div class="ab-head"><span class="ab-kind">지속</span><b>${esc(s.passive.name)}</b>${pv.transform ? `<span class="psi-tf-tag">◆ 변형: ${esc(pv.transform)}</span>` : ''}</div>
    <div class="cx2-body">${AB.rowsHtml(pv.rows.map(([k, v]) => [k, H.statIc(AB.tok(v, NO_CTX, gl))] as [string, string]))}</div></div>`;
}
function unitRowBtn(H: CxH, d: UnitDef, text: string) {
  return `<button class="cx2-row" ${go(`unit:${d.id}`)}>${H.sprite(d)}<span><b>${esc(d.name)}</b> <span class="muted small">${UNIT_GROUP[d.id] ? esc(GROUPS[UNIT_GROUP[d.id]].name) : '학파 없음'}</span>${text ? `<p class="muted">${esc(text)}</p>` : ''}</span></button>`;
}

// ═══════════════════════ 증강
interface AugGroup { key: string; name: string; note: string; body: (H: CxH) => string; count: number }
const POOL_NAME: Record<string, string> = { major: '메이저 공용', special: '스페셜 전용', school: '사이오닉 전공 선택', psionic: '사이오닉 전공 증강' };
function augGroups(): AugGroup[] {
  const pools = [...new Set(ALL_AUGS.map((a) => a.pool))];
  const order = ['major', 'special', 'school', 'psionic'];
  pools.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const out: AugGroup[] = [];
  for (const pool of pools) {
    const list = ALL_AUGS.filter((a) => a.pool === pool);
    const name = POOL_NAME[pool] || augSource(list[0]);
    let note = '', body: AugGroup['body'];
    if (pool === 'special') {
      const owners = [...new Set(list.map((a) => a.owner || ''))];
      note = `${TTYPE_NAME.special} 기물이 합류 시 + ${milestones(CFG.growth.special, 'special')}에 자기 전용 증강 중에서 고릅니다 (최대 ${msCount(CFG.growth.special, 'special') + 1}개).`;
      body = (H) => owners.map((o) => {
        const d = UNIT_BY_ID[o], l = list.filter((a) => (a.owner || '') === o);
        return grp('augs', ' cx2-sub-g', `<div class="cx2-uh">${d ? unitChip(H, d, `${esc(CTYPE_NAME[d.ctype])} · ${l.length}종`) : esc(o)}</div><ul class="augs cx2-augs">${l.map((a) => augLi(H, a, [], d?.name || '')).join('')}</ul>`);
      }).join('');
    } else if (pool === 'psionic') {
      const owners = [...new Set(list.map((a) => a.owner || ''))];
      note = `${TTYPE_NAME.psionic} 기물이 ${milestones(CFG.growth.psionic, 'psionic')}에 자기 전공의 증강 중에서 고릅니다. ◆ = 변형. 이성 · 상성 · 변형 후 모습은 사이오닉 탭.`;
      body = (H) => owners.map((o) => {
        const s = SCHOOL_BY_ID[o as SchoolId], l = list.filter((a) => (a.owner || '') === o);
        return grp('augs', ' cx2-sub-g', `<div class="cx2-uh">${s ? `<button class="cx2-sc" style="--c:${s.color}" ${go(`go:psi:${s.id}`)}>${lineIcon(`s.${s.id}`, 'li')}${esc(GROUPS[s.group].name)} · ${esc(s.name)} ›</button>` : esc(o)}</div><ul class="augs cx2-augs">${l.map((a) => augLi(H, a, [], s ? `${s.name} ${GROUPS[s.group].name}` : '')).join('')}</ul>`);
      }).join('');
    } else {
      if (pool === 'major') note = `${TTYPE_NAME.major} 기물이 ${milestones(CFG.growth.major, 'major')} 고릅니다.`;
      if (pool === 'school') note = `${TTYPE_NAME.psionic} 기물이 합류할 때 학파의 전공 ${Object.values(GROUPS)[0].majors.length}개 중 1개를 고릅니다 (학파가 없으면 ${SCHOOLS.length}개 중).`;
      body = (H) => `<ul class="augs cx2-augs">${list.map((a) => augLi(H, a)).join('')}</ul>`;
    }
    out.push({ key: pool, name, note, body, count: list.length });
  }
  // 전역 · 특권 · 축복 · 절망: 기물이 아닌 함대 전체 증강 (icon: 줄마다 아이콘이 다를 때)
  const simple = (key: string, name: string, note: string, rows: { id: string; name: string; desc: string; tags: string[]; icon?: string }[]): AugGroup => ({
    key, name, note, count: rows.length,
    body: () => `<ul class="augs cx2-augs${key === 'despair' || key === 'oath' ? ' cx2-despair' : ''}">${rows.map((r) => `<li class="aug-li" data-id="${esc(r.id)}"${qAttr('augs', `${r.name} ${r.desc} ${r.tags.join(' ')}`)}><span class="aug-ic" aria-hidden="true">${lineIcon(r.icon || (key === 'bless' ? 'a.divact' : key === 'priv' ? 'a.power' : 'n.council'), 'li')}</span><span><b>${esc(r.name)}</b>${r.tags.map((t) => ` <span class="cx2-note">${esc(t)}</span>`).join('')}<br><span class="muted">${esc(r.desc)}</span></span></li>`).join('')}</ul>`,
  });
  out.push(simple('global', '전역 증강', '런 시작과 매 페이즈 항로 회의에서 3개 중 1개. 함대 전체에 적용됩니다.',
    GLOBALS.map((g) => ({ id: g.id, name: g.name, desc: g.desc, tags: [`${GLOBAL_TIER_NAME[g.tier || 'N']} · 장마다 ${g.tier === 'L' ? `${pctTxt(GLOBAL_ODDS.L)}` : g.tier === 'R' ? `${pctTxt(GLOBAL_ODDS.R)}` : `${pctTxt(1 - GLOBAL_ODDS.L - GLOBAL_ODDS.R)}`}`, ...(g.unique ? ['1회'] : []), ...(g.team ? ['모든 아군'] : []), ...(g.onPick ? ['즉시'] : [])] }))));
  const wsum = PRIVILEGES.reduce((n, p) => n + p.w, 0);
  const PH = '(시너지)';
  out.push(simple('priv', '특권 증강', '런 시작 때 3개 중 1개 (새로고침 가능). 문장은 시작 기물의 시너지 위주로 나옵니다.',
    PRIVILEGES.map((p) => ({ id: p.id, name: p.name(PH), desc: p.desc(PH), tags: [`출현 ${pctTxt(p.w / wsum)}`] }))));
  out.push(simple('bless', '축복', `${TTYPE_NAME.divine} 기물이 있으면 열리는 순례에서 권능으로 받습니다. 이번 페이즈 동안 모든 아군에게.`,
    BLESSINGS.map((b) => { const c = PILGRIM_CARDS[`bless:${b.id}`]; return { id: b.id, name: b.name, desc: b.desc, tags: c ? [`권능 ${c.cost}`] : [] }; })));
  const meta = loadMeta();
  out.push(simple('despair', '절망 증강', `${diffName(CFG.despair.from) || `위험 ${CFG.despair.from}`}(위험 ${CFG.despair.from}) 런은 ${despairRule()} 고른 증강은 의뢰 내내 함께 걸리는 디버프이고, 증강별로 의뢰 · 성공 기록이 남습니다.`,
    DESPAIRS.map((d) => { const r = meta.despair?.[d.id]; return { id: d.id, name: d.name, desc: `${d.desc()} — ${d.quip}`, icon: d.icon, tags: [r?.clears ? `성공 ${r.clears}회` : r?.runs ? `의뢰 ${r.runs}회 · 성공 없음` : '기록 없음'] }; })));
  // 절망 서약 (data/oaths.ts): 단계별 효과 · 절망 수치는 CFG.oath 에서 읽는다
  out.push(simple('oath', '절망 서약', `${diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`}(위험 ${CFG.oathFrom}) 이상으로 출격할 때만 걸리는 고정 조건. 타이틀 [절망 서약]에서 직접 켜고 단계를 올리며, 단계마다 절망 수치가 쌓입니다 (쉬움 · 모험에서는 무시). 절망 수치 ${CFG.oathDiffStep}마다 표기 위험 등급이 1씩 오르고 (위험 ${CFG.oathFrom} → 절망 ${CFG.oathDiffStep}이면 위험 ${CFG.oathFrom + 1}), 결과 · 전장 기록 · 업적이 그 등급을 읽습니다. 적이 세지는 것은 서약 효과뿐입니다. 런 중에 무작위로 고르는 절망 증강과 따로 걸립니다.`,
    OATHS.map((o) => ({ id: `oath.${o.id}`, name: o.name, desc: `${Array.from({ length: oathMax(o.id) }, (_, i) => `${i + 1}단계: ${o.lv(i + 1)}`).join(' / ')} — ${o.quip}`, icon: o.icon,
      tags: [`최대 ${oathMax(o.id)}단계`, `절망 ${CFG.oath[o.id].heat.join(' · ')} (합 ${oathHeatOf(o.id, oathMax(o.id))})`] }))));
  return out;
}
function augsTab(H: CxH) {
  const groups = augGroups();
  const f = CX2.filt.augs;
  const bar = filterBar('augs', [['all', '전체', groups.reduce((n, g) => n + g.count, 0)], ...groups.map((g) => [g.key, g.name, g.count] as [string, string, number])]);
  const shown = groups.filter((g) => f === 'all' || f === g.key);
  const body = shown.map((g) => grp('augs', ' cx2-ag', `<h2 class="cx-h">${esc(g.name)} <span class="cx-hn">${g.count}종</span></h2>${g.note ? `<p class="muted small">${esc(g.note)}</p>` : ''}${g.body(H)}`, 'section')).join('');
  return `<div class="cx2 cx2-augsTab">${tools(searchBox('augs', '증강 이름 · 효과 · 기물 검색'), bar)}${body}${noneMsg('augs', body)}</div>`;
}

// ═══════════════════════ 세계관 (src/data/worldlore.ts · 전장은 battlefields.ts 에서 읽음)
const loreColor = (e: LoreEntry) => SYN_BY_ID[e.mark as SynergyId]?.color || e.color || 'var(--dim)';
const loreIcon = (e: LoreEntry) => synIcon(e.mark) || lineIcon(e.mark, 'li');
const loreArt = (e: LoreEntry, cls: string) => (e.art ? `<img class="${cls}" src="${artURL(`${e.art}.webp`)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '');
/** 목록 · 머리의 짧은 분류 (연합 섹터 · 전장 등) */
function loreSub(e: LoreEntry) {
  const s = LORE_SECTIONS.find((x) => x.group === e.group && (!x.bloc || x.bloc === e.bloc));
  const base = s?.short || LORE_GROUP_NAME[e.group];
  return e.rel?.fields?.length ? `${base} · 전장` : base;
}
/** 세계관 항목 단추 (누르면 세계관 탭에서 펼침) */
function loreChip(id: string) {
  const e = LORE_BY_ID[id];
  if (!e) return '';
  return `<button class="cx2-sc" style="--c:${loreColor(e)}" ${go(`go:lore:${e.id}`)} title="세계관 도감에서 보기"><span class="cx2-si">${loreIcon(e)}</span>${esc(e.name)}</button>`;
}
/** 전장 브리핑 카드: 이름 · 지역 · 설명 · 조건은 전장 표에서 */
function fieldCard(fid: string) {
  const f = FIELD_BY_ID[fid];
  if (!f) return '';
  const syn = f.ally ? f.ally.syn : null;
  return `<div class="cx2-fld" data-field="${esc(f.id)}"><div class="cx2-fld-bg" style="background-image:url('${bgURL(`field_${f.id}`)}'), linear-gradient(165deg, color-mix(in srgb, ${f.color} 30%, #0b0d14), #0b0d14 75%)" aria-hidden="true"></div>
    <div class="cx2-fld-tx"><b>${esc(f.name)}</b><small>${esc(f.region)}</small><p>${esc(f.desc)}</p>
    <ul class="cx2-src">${f.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="cx2-mem">${syn ? synChip(syn) : ''}<button class="btn tiny" ${go(`tab:enemies:${f.id}`)}>이 전장의 적 보기</button></div></div></div>`;
}
function loreTile(e: LoreEntry, peek: string | null) {
  const on = CX2.sel.lore === e.id, pk = !on && peek === e.id;
  const r = e.rel || {};
  const names = [...(r.units || []).map((u) => UNIT_BY_ID[u]?.name || ''), ...(r.syn || []).map((s) => SYN_BY_ID[s]?.name || ''), ...(r.fields || []).map((x) => FIELD_BY_ID[x]?.name || '')].join(' ');
  const q = qAttr('lore', `${e.name} ${e.tag} ${e.bullets.join(' ')} ${names}`);
  const cls = `${on ? ' on' : pk ? ' peek' : ''}`;
  if (e.art) return `<button class="cx-lcard${cls}" ${go(`sel:lore:${e.id}`)} aria-pressed="${on}"${q}><span class="cx-lpic">${loreArt(e, 'cx-limg')}</span><span class="cx-lcap"><b>${esc(e.name)}</b><small>${esc(loreSub(e))}</small></span></button>`;
  return `<button class="cx-tile cx2-tile${cls}" ${go(`sel:lore:${e.id}`)} aria-pressed="${on}" style="--c:${loreColor(e)}"${q}>
    <span class="cx-face cx2-synf">${loreIcon(e)}</span><span class="cx-nm">${esc(e.name)}</span><span class="cx2-sub">${esc(loreSub(e))}</span></button>`;
}
const LORE_EMPTY = '항목을 고르면 짧은 소개와 관련 시너지 · 전장 · 기물을 볼 수 있습니다.';
function loreDetail(H: CxH, id: string): string {
  const e = LORE_BY_ID[id];
  if (!e) return empty(LORE_EMPTY);
  const r = e.rel || {};
  const a: string[] = [`<p class="cx2-lt">${esc(e.tag)}</p>`, `<ul class="cx2-lb">${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`];
  const b: string[] = [];
  if (e.bloc) b.push(`<h3>소속 세력</h3><div class="cx2-mem">${loreChip(e.bloc)}</div>`);
  const kids = loreRegionsOf(e.id);
  if (kids.length) b.push(`<h3>주요 지역 <span class="cx-hn">${kids.length}곳</span></h3><div class="cx2-mem">${kids.map((x) => loreChip(x.id)).join('')}</div>`);
  if (r.syn?.length) b.push(`<h3>시너지</h3><div class="cx2-mem">${r.syn.map(synChip).join('')}</div>`);
  const units = (r.units || []).map((u) => UNIT_BY_ID[u]).filter((d): d is UnitDef => !!d);
  if (units.length) b.push(`<h3>관련 기물 <span class="cx-hn">${units.length}명</span></h3>${memberCards(H, units)}`);
  if (r.lore?.length) b.push(`<h3>함께 보기</h3><div class="cx2-mem">${r.lore.map(loreChip).join('')}</div>`);
  const fields = r.fields?.length ? `<h3>무대가 되는 전장</h3><div class="cx2-flds">${r.fields.map(fieldCard).join('')}</div>` : '';
  const ic = `<span class="cx2-synf big" style="--c:${loreColor(e)}">${loreIcon(e)}</span>`;
  const top = e.art
    ? `<figure class="cx2-lhero">${loreArt(e, 'cx2-lart')}<figcaption>${head(ic, esc(e.name), esc(loreSub(e)))}</figcaption></figure>`
    : head(ic, esc(e.name), esc(loreSub(e)));
  return `<div class="detail cx-d cx2-d cx2-ld${e.art ? ' has-art' : ''}">${top}${cols(a.join(''), b.join(''))}${fields}</div>`;
}
function loreTab(H: CxH) {
  const f = CX2.filt.lore;
  const groups: LoreGroup[] = ['errantes', 'faction', 'region'];
  const bar = filterBar('lore', [['all', '전체', LORE.length], ...groups.map((g) => [g, LORE_GROUP_NAME[g], LORE.filter((e) => e.group === g).length] as [string, string, number])]);
  const secs = LORE_SECTIONS.filter((s) => f === 'all' || f === s.group).map((s) => [s, LORE.filter((e) => e.group === s.group && (!s.bloc || e.bloc === s.bloc))] as const);
  const sel = CX2.sel.lore, peek = sel || secs[0]?.[1][0]?.id || null;
  const list = secs.map(([s, l]) => grp('lore', '', `<h3 class="cx-h">${esc(s.name)} <span class="cx-hn">${l.length}</span></h3><div class="${l.some((e) => e.art) ? 'cx-lgrid' : 'cx-grid'}">${l.map((e) => loreTile(e, peek)).join('')}</div>`)).join('');
  const intro = '<p class="muted small cx-count">은하력 562년 기준의 짧은 안내입니다. 항목을 고르면 관련 시너지 · 전장 · 기물로 이어집니다.</p>';
  return wrap('lore', `${tools(searchBox('lore', '세력 · 지역 · 기물 이름 검색'), bar)}${intro}${list}${noneMsg('lore', list)}`,
    peek ? loreDetail(H, peek) : empty(LORE_EMPTY));
}
/** 기물 도감 상세에 붙는 세계관 링크 (그 기물이 관련 기물로 들어간 항목) */
export function loreLinks(uid: string): string {
  const l = LORE.filter((e) => e.rel?.units?.includes(uid));
  return l.length ? `<h3>세계관</h3><div class="cx2-mem">${l.map((e) => loreChip(e.id)).join('')}</div>` : '';
}

// ═══════════════════════ 진입점
export function codex2Body(tab: Cx2Tab, H: CxH): string {
  if (tab === 'items') return itemsTab(H);
  if (tab === 'syn') return synTab(H);
  if (tab === 'psi') return psiTab(H);
  if (tab === 'lore') return loreTab(H);
  return augsTab(H);
}
/** 상세 패널만 (검사 · 다른 화면에서 재사용). 사이오닉은 전공 id 또는 'g.<학파>' */
export function codex2Detail(tab: Cx2Tab, id: string, H: CxH): string {
  if (tab === 'items') return itemDetail(H, id);
  if (tab === 'syn') return synDetail(H, id as SynergyId);
  if (tab === 'psi') return id.startsWith(GSEL) && GROUPS[id.slice(GSEL.length) as GroupId] ? psiGroupDetail(H, id.slice(GSEL.length) as GroupId) : SCHOOL_BY_ID[id as SchoolId] ? psiDetail(H, id as SchoolId) : psiOverview(H);
  if (tab === 'lore') return loreDetail(H, id);
  return '';
}
/**
 * 도감 탭 동작. v = sel:<탭>:<id> (상세 펼침 · 접기, 사이오닉은 접지 않고 그 단계로) | filt:<탭>:<분류> | go:<탭>:<id> (그 탭으로 가서 펼침)
 *   | usort:units:<정렬> | unit:<기물> | tab:<main.ts 도감 탭> (적 · 사건 등으로 이동)
 * 돌려주는 tab · unit 은 main.ts 가 app.codexTab · app.codexSel 에 넣는다.
 */
export function codex2Act(v: string): { tab?: string; unit?: string; scroll: boolean } {
  const [cmd, tab, ...rest] = v.split(':');
  const id = rest.join(':');
  if (cmd === 'unit') return { tab: 'units', unit: [tab, ...rest].join(':'), scroll: true };
  if (cmd === 'usort') { CX2.usort = (['name', 'ctype', 'ttype'] as UnitSort[]).includes(id as UnitSort) ? (id as UnitSort) : 'name'; return { scroll: false }; }
  if (cmd === 'tab') { // 다른 도감 탭으로. tab:enemies:<전장> 이면 그 전장 묶음까지 내려간다 (main.ts 가 다시 그린 뒤)
    const name = FIELD_BY_ID[id]?.name;
    if (name && typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>('main.codex h2')).find((h) => h.textContent?.includes(name))?.scrollIntoView({ block: 'start' }));
    return { tab, scroll: false };
  }
  if (!isCx2Tab(tab)) return { scroll: false };
  if (cmd === 'sel') {
    const prev = CX2.sel[tab];
    CX2.sel[tab] = tab === 'psi' ? id || null : prev === id ? null : id;
    if (!CX2.sel[tab] && prev) CX2.focus = `sel:${tab}:${prev}`;
    return { scroll: true };
  }
  if (cmd === 'filt') { CX2.filt[tab] = id || 'all'; return { scroll: false }; }
  if (cmd === 'go') {
    CX2.sel[tab] = id; CX2.filt[tab] = 'all'; CX2.q[tab] = '';
    return { tab, scroll: true };
  }
  return { scroll: false };
}
