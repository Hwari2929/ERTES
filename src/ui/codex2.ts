// 도감 추가 탭: 장비 · 시너지 · 사이오닉 · 증강 · 세계관.
// 모든 이름 · 수치 · 설명은 그릴 때마다 데이터 표(items · synergies · schools · psiinfo · augments · relics · globals · run 상품표 · worldlore · battlefields)에서 읽는다.
// 목록은 표를 순회해서 만들므로, 데이터에 항목을 더하거나 고치면 도감에도 그대로 반영된다 (검사: npm run check).
// main.ts 에만 있는 그림 조각(장비 · 증강 아이콘, 초상화 등)은 CxH 로 받는다.
import { CFG } from '../config';
import { augAbilText } from '../data/abiltext';
import { augReqState } from '../data/augreq';
import { FIELD_BY_ID } from '../data/battlefields';
import { ALL_AUGS, augDesc, augSource } from '../data/augments';
import { BLESSINGS, EMBLEM_SYNS, GLOBAL_BY_ID, GLOBALS, PRIVILEGES } from '../data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, combine, CONSUMABLES, emblemId, emblemOf, HEL_ITEM_IDS, isEmblem, isHelItem, isLocked, isOccultMod, isTurretGear, itemInfo, OCCULT_MODS, TURRET_GEAR, TURRET_GEAR_IDS, TURRET_PRICE, UNIQUE_IDS } from '../data/items';
import { PSI_BRIEF } from '../data/brief';
import { cantripView, passiveView, SCHOOL_LINE, transformPreview } from '../data/psiinfo';
import { RELIC_BY_ID, RELICS } from '../data/relics';
import { GROUPS, type GroupId, isTransformAug, SCHOOL_BY_ID, SCHOOLS, type SchoolId, UNIT_GROUP } from '../data/schools';
import { KAL_GUARD_TEXT, KAL_GUARDS, SYN_BY_ID, SYNERGIES, VOYAGE_SPECIAL } from '../data/synergies';
import { KNIGHT_PAL } from '../engine/build';
import { UNIT_BY_ID, UNITS, type UnitDef } from '../data/units';
import { LORE, LORE_BY_ID, LORE_GROUP_NAME, LORE_SECTIONS, type LoreEntry, type LoreGroup, loreRegionsOf } from '../data/worldlore';
import { INVEST_OFFERS, NEWS_OFFERS, PILGRIM_CARDS } from '../engine/run';
import type { AugDef } from '../engine/effects';
import { CTYPE_NAME, MAJOR_NAME, type Major, type RunState, type SynergyId, TTYPE_NAME } from '../types';
import * as AB from './abil';
import { artURL, bgURL } from './portraits';
import { lineIcon, synIcon } from './synicons';

/** main.ts 의 그림 조각 */
export interface CxH {
  itemIcon(id: string): string;
  augIcon(id: string): string;
  sprite(d: UnitDef): string;
  abTok(key: string): string;
  statIc(html: string): string;
  relicTok(id: string): string;
  majorIcon(m: Major): string;
}

export type Cx2Tab = 'items' | 'syn' | 'psi' | 'augs' | 'lore';
export const CX2_TABS: [Cx2Tab, string][] = [['syn', '시너지'], ['items', '장비'], ['augs', '증강'], ['psi', '사이오닉'], ['lore', '세계관']];
export const isCx2Tab = (t: string): t is Cx2Tab => CX2_TABS.some(([k]) => k === t);

/** 탭별 선택 · 분류 · 검색어 (이 브라우저 세션 동안 유지) */
export const CX2 = {
  sel: { items: null, syn: null, psi: null, augs: null, lore: null } as Record<Cx2Tab, string | null>,
  filt: { items: 'all', syn: 'all', psi: 'all', augs: 'all', lore: 'all' } as Record<Cx2Tab, string>,
  q: { items: '', syn: '', psi: '', augs: '', lore: '' } as Record<Cx2Tab, string>,
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
const qAttr = (tab: Cx2Tab, text: string) => ` data-q="${esc(norm(text))}"${CX2.q[tab] && !qHit(CX2.q[tab], text) ? ' hidden' : ''}`;
function searchBox(tab: Cx2Tab, ph: string) {
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
    const tab = el.dataset.tab as Cx2Tab;
    CX2.q[tab] = el.value;
    const scope = el.closest('.cx2') || document;
    applyQuery(scope, el.value);
  });
}
/** 보이는 줄(data-q 이고 hidden 이 아님)이 있는지 */
const SHOWN = /data-q="[^"]*"(?! hidden)/;
/** 묶음: 검색으로 안의 줄이 모두 숨으면 묶음도 숨김 */
const grp = (tab: Cx2Tab, cls: string, inner: string, tag = 'div') => `<${tag} class="cx2-grp${cls}"${CX2.q[tab] && !SHOWN.test(inner) ? ' hidden' : ''}>${inner}</${tag}>`;
const noneMsg = (tab: Cx2Tab, html: string) => `<p class="cx2-none muted small"${CX2.q[tab] && !SHOWN.test(html) ? '' : ' hidden'}>찾는 항목이 없습니다.</p>`;

/** 분류 단추 줄 */
function filterBar(tab: Cx2Tab, opts: [string, string, number][]) {
  return `<div class="cx-bar" role="group" aria-label="분류">${opts.map(([k, l, n]) => `<button class="btn tiny ${CX2.filt[tab] === k ? 'on' : ''}" ${go(`filt:${tab}:${k}`)} aria-pressed="${CX2.filt[tab] === k}">${esc(l)}${n >= 0 ? ` <span class="muted">${n}</span>` : ''}</button>`).join('')}</div>`;
}
const wrap = (tab: Cx2Tab, list: string, detail: string) => `<div class="cx-wrap cx2 cx2-${tab}"><section class="cx-list">${list}</section><aside class="cx-detail">${detail}</aside></div>`;
const empty = (msg: string) => `<div class="cx-empty muted small">${esc(msg)}</div>`;
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
function synChip(sid: string) {
  const s = SYN_BY_ID[sid as SynergyId];
  if (!s) return '';
  return `<button class="cx2-sc" style="--c:${s.color}" ${go(`go:syn:${s.id}`)} title="시너지 도감에서 보기"><span class="cx2-si">${synIcon(s.id) || esc(s.icon)}</span>${esc(s.name)}</button>`;
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
    ['X', [...HEL_ITEM_IDS.flatMap((x) => [x, legendOf(x)]), ...Object.keys(OCCULT_MODS), ...UNIQUE_IDS]],
    ['T', TURRET_GEAR_IDS.slice()],
    ['K', Object.keys(CONSUMABLES)],
    ['R', RELICS.map((r) => RELIC_KEY + r.id)],
  ];
}
/** 전용 장비가 속한 시너지 (문장 제외) */
function gearSyn(id: string): SynergyId | null {
  if (isHelItem(id)) return 'HEL';
  if (isTurretGear(id)) return 'ENG';
  if (isOccultMod(id) || (CONSUMABLES[id] && !CONSUMABLES[id].drop)) return 'OCCULT';
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
const tierLabel = (g: IGrp, id: string) => (g === 'T' ? `포탑 전용 · ${TURRET_GEAR[id]?.grade === 'adv' ? '고급형' : '보급형'}` : g === 'X' ? (isHelItem(id) ? (id[0] === 'L' ? '동맹 전용 · 전설' : '동맹 전용 · 희귀') : isOccultMod(id) ? `신비 부품 ${OCCULT_MODS[id].tier}단계` : '고유') : g === 'K' ? (CONSUMABLES[id]?.drop ? '소모품 · 전투 보상' : '소모품 · 합성') : IGRP_NAME[g]);

/** 얻는 곳 (가격 · 확률 · 단계는 설정 · 데이터에서) */
function sources(id: string): string[] {
  const P = CFG.price, D = CFG.drop;
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
  if (isOccultMod(id)) {
    const o = OCCULT_MODS[id], s = SYN_BY_ID.OCCULT;
    out.push(`${s.name} ${o.tier}단계 (${s.tiers[o.tier - 1]}명) 첫 도달 시 그 단계 부품 3개 중 1개 선택`);
    return out;
  }
  if (CONSUMABLES[id]) {
    const c = CONSUMABLES[id];
    out.push(c.drop ? '전투 종료 보상 (확률)' : `${SYN_BY_ID.OCCULT.name} [합성] 공방 · ${c.price} 크레딧`);
    out.push(`사용: ${c.target === 'unit' ? '기물에 끌어다 놓기' : '장비에 끌어다 놓기'}`);
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
    out.push('일부 사건 보상');
    return out;
  }
  if (t === 'C') out.push(`상점 · ${P.C} 크레딧 (매번 ${D.shopParts}개)`, `전투 ${pctTxt(D.battle)} · 역경 ${pctTxt(D.adversity)} 확률 전리품`, '보스 · 도전 전리품, 보급 · 사건 · 퀘스트 보상');
  if (t === 'G') out.push('같은 재료 2개 조합', `상점 · ${P.G} 크레딧 (${pctTxt(D.shopGraded)} 확률 입고)`);
  if (t === 'A') {
    out.push(itemInfo(id).recipe ? '서로 다른 재료 2개 조합' : '조합 불가 (상점 · 전리품으로만)');
    out.push(`상점 · ${P.A} 크레딧 (${pctTxt(D.shopAdv)} 확률 입고)`, `도전 · ${D.bossAdvEvery}페이즈마다 보스 전리품 (희귀 3개 중 1개)`);
    if (NEWS_OFFERS.sponsor) out.push(`${SYN_BY_ID.STAR.name} 속보 [${NEWS_OFFERS.sponsor.name}] (무작위)`);
  }
  if (t === 'L') {
    out.push(`상점 · ${P.L} 크레딧 (${D.shopLegendPhase}페이즈부터 ${pctTxt(D.shopLegend)} 확률 입고)`);
    if (hall) out.push(`${SYN_BY_ID.STAR.name} 속보 [${hall.name}] · 명성 ${hall.cost} (3개 중 1개)`);
    if (legendK) out.push(`소모품 [${legendK.name}] 사용`);
  }
  return out;
}

function itemTile(H: CxH, g: IGrp, id: string) {
  const on = CX2.sel.items === id;
  return `<button class="cx-tile cx2-tile${on ? ' on' : ''}" ${go(`sel:items:${id}`)} aria-pressed="${on}"${qAttr('items', `${itemName(id)} ${itemDescText(id)} ${tierLabel(g, id)}`)}>
    <span class="cx-face">${itemIc(H, id)}</span><span class="cx-nm">${esc(itemName(id))}</span><span class="cx2-sub">${esc(tierLabel(g, id))}</span></button>`;
}
/** 장비 한 줄 (누르면 장비 상세) */
function itemRow(H: CxH, id: string, note = '') {
  return `<button class="cx2-row" ${go(`go:items:${id}`)}>${itemIc(H, id)}<span><b>${esc(itemName(id))}</b>${note ? ` <span class="tag">${esc(note)}</span>` : ''}<p class="muted">${H.statIc(esc(itemDescText(id)))}</p></span></button>`;
}
function itemDetail(H: CxH, id: string): string {
  const cat = itemCatalog().find(([, ids]) => ids.includes(id));
  if (!cat) return empty('장비를 고르면 효과 · 조합 · 얻는 곳을 볼 수 있습니다.');
  const g = cat[0];
  const parts: string[] = [];
  if (id.startsWith(RELIC_KEY)) {
    const r = RELIC_BY_ID[id.slice(2)];
    parts.push(`<p>${H.statIc(esc(r.desc(1)))}</p>`, `<h3>축성 시 <span class="muted small">계수 ×3</span></h3><p class="small">${H.statIc(esc(r.desc(3)))}</p>`);
    if (r.owner && UNIT_BY_ID[r.owner]) parts.push(`<h3>기본 장착</h3><div class="cx2-mem">${unitChip(H, UNIT_BY_ID[r.owner])}</div>`);
    const div = UNITS.filter((d) => d.ttype === 'divine');
    parts.push(`<p class="muted small">${esc(TTYPE_NAME.divine)} 기물 ${div.length}명이 장착할 수 있습니다. 장착한 성유물이 신권 대행이 됩니다.</p>`);
  } else {
    const it = itemInfo(id);
    parts.push(`<p>${H.statIc(esc(it.desc))}</p>`);
    const maj = Object.entries(it.majors) as [Major, number][];
    if (maj.length) parts.push(`<div class="cx2-maj">${maj.map(([m, v]) => `<span class="abc">${H.majorIcon(m)}${esc(MAJOR_NAME[m])} +${v}</span>`).join('')}</div>`);
    if (it.recipe) parts.push(`<h3>조합</h3><div class="cx2-recipe">${it.recipe.map((x) => `${H.itemIcon(x)}<span class="small">${esc(itemInfo(x).name)}</span>`).join('<b>+</b>')}<b>=</b>${H.itemIcon(id)}</div>`);
    if (g === 'C') {
      const rows = ALL_COMPONENTS.map((y) => [y, combine(id, y)] as const).filter(([, r]) => r);
      parts.push(`<h3>조합 결과</h3><ul class="cx2-rows">${rows.map(([y, r]) => `<li class="cx2-mix">${H.itemIcon(id)}<b>+</b>${H.itemIcon(y)}<b>=</b>${itemRow(H, r!)}</li>`).join('')}</ul>`);
    }
    if (g === 'A' || (g === 'X' && isHelItem(id) && id[0] === 'A')) parts.push(`<h3>전설 등급</h3><ul class="cx2-rows"><li>${itemRow(H, legendOf(id))}</li></ul>`);
    if (g === 'L' || (g === 'X' && isHelItem(id) && id[0] === 'L')) parts.push(`<h3>희귀 등급</h3><ul class="cx2-rows"><li>${itemRow(H, 'A_' + id.slice(2))}</li></ul>`);
    if (isEmblem(id)) {
      const s = SYN_BY_ID[emblemOf(id)];
      parts.push(`<h3>시너지</h3><div class="cx2-mem">${synChip(s.id)}</div><p class="muted small">단계 ${s.tiers.join(' / ')} · 소속 ${UNITS.filter((d) => memberOf(d, s.id)).length}명. 장착한 기물이 이 시너지에 1명으로 더해집니다.</p>`);
    }
    const gs = gearSyn(id);
    if (gs && !isEmblem(id)) parts.push(`<h3>전용 시너지</h3><div class="cx2-mem">${synChip(gs)}</div>`);
    if (isLocked(id)) { const owner = UNITS.find((d) => d.item === id); if (owner) parts.push(`<h3>고유 장비 주인</h3><div class="cx2-mem">${unitChip(H, owner)}</div>`); }
  }
  const src = sources(id);
  if (src.length) parts.push(`<h3>얻는 곳</h3><ul class="cx2-src">${src.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);
  const sell = id.startsWith(RELIC_KEY) || isLocked(id) ? undefined : CFG.sell[id[0]];
  if (sell !== undefined) parts.push(`<p class="muted small">판매가 ${sell} 크레딧</p>`);
  return `<div class="detail cx-d cx2-d"><div class="cx2-hd">${itemIc(H, id)}<div><b>${esc(itemName(id))}</b><small>${esc(tierLabel(g, id))}</small></div></div>${parts.join('')}</div>`;
}
function itemsTab(H: CxH) {
  const cat = itemCatalog();
  const f = CX2.filt.items;
  const bar = filterBar('items', [['all', '전체', cat.reduce((n, [, l]) => n + l.length, 0)], ...cat.map(([g, l]) => [g, IGRP_NAME[g], l.length] as [string, string, number])]);
  const shown = cat.filter(([g]) => f === 'all' || f === g);
  const list = shown.map(([g, ids]) => grp('items', '', `<h3 class="cx-h">${esc(IGRP_NAME[g])} <span class="muted small">${ids.length}종</span></h3><div class="cx-grid">${ids.map((id) => itemTile(H, g, id)).join('')}</div>`)).join('');
  const sel = CX2.sel.items;
  return wrap('items', `<div class="cx2-tools">${searchBox('items', '장비 이름 · 효과 검색')}</div>${bar}${list}${noneMsg('items', list)}`,
    sel ? itemDetail(H, sel) : empty('장비를 고르면 효과 · 조합 · 얻는 곳을 볼 수 있습니다.'));
}

// ═══════════════════════ 시너지
function synTile(sid: SynergyId) {
  const s = SYN_BY_ID[sid];
  const on = CX2.sel.syn === sid;
  const n = UNITS.filter((d) => memberOf(d, sid)).length;
  return `<button class="cx-tile cx2-tile${on ? ' on' : ''}" ${go(`sel:syn:${sid}`)} aria-pressed="${on}" style="--c:${s.color}"${qAttr('syn', `${s.name} ${s.desc} ${s.tierDesc.join(' ')} ${UNITS.filter((d) => memberOf(d, sid)).map((d) => d.name).join(' ')}`)}>
    <span class="cx-face cx2-synf">${synIcon(s.id) || esc(s.icon)}</span><span class="cx-nm">${esc(s.name)}</span><span class="cx2-sub">${s.tiers.join(' / ')} · ${n}명</span></button>`;
}
function offerList(title: string, unit: string, offers: { name: string; cost: number; desc: string }[]) {
  return `<h3>${esc(title)}</h3><ul class="cx2-rows">${offers.map((o) => `<li class="cx2-row cx2-offer"><span class="cx2-cost">${o.cost}<small>${esc(unit)}</small></span><span><b>${esc(o.name)}</b><p class="muted">${esc(o.desc)}</p></span></li>`).join('')}</ul>`;
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
function synDetail(H: CxH, sid: SynergyId): string {
  const s = SYN_BY_ID[sid];
  if (!s) return empty('시너지를 고르면 단계별 효과 · 소속 기물 · 전용 장비를 볼 수 있습니다.');
  const mem = UNITS.filter((d) => memberOf(d, sid));
  const parts: string[] = [];
  parts.push(`<p class="small">${br(s.desc)}</p>`);
  parts.push(`<h3>단계별 효과</h3><ol class="cx2-tiers" style="--c:${s.color}">${s.tiers.map((need, i) => `<li><span class="cx2-need">(${need})</span><span>${esc(s.tierDesc[i] ?? '')}</span></li>`).join('')}</ol>`);
  parts.push(`<h3>소속 기물 <span class="muted small">${mem.length}명</span></h3><div class="cx2-mem">${mem.map((d) => unitChip(H, d, `${esc(CTYPE_NAME[d.ctype])} · ${esc(TTYPE_NAME[d.ttype])}${d.eventOnly ? ' · 사건' : ''}`)).join('')}</div>`);
  if (EMBLEM_SYNS.includes(sid)) parts.push(`<h3>문장</h3><ul class="cx2-rows"><li>${itemRow(H, emblemId(sid))}</li></ul>`);
  const gear = synGear(sid);
  if (gear.length) parts.push(`<h3>${sid === 'ENG' ? '포탑 전용 장비' : '전용 장비 · 상품'} <span class="muted small">${gear.length}종</span></h3><ul class="cx2-rows">${gear.map((id) => `<li>${itemRow(H, id, isHelItem(id) ? (id[0] === 'L' ? '전설' : '희귀') : isOccultMod(id) ? `${OCCULT_MODS[id].tier}단계` : CONSUMABLES[id] ? `합성 · ${CONSUMABLES[id].price}` : isTurretGear(id) ? `${TURRET_GEAR[id].grade === 'adv' ? '고급형' : '보급형'} · ${TURRET_PRICE[TURRET_GEAR[id].grade]}` : '')}</li>`).join('')}</ul>`);
  if (sid === 'KAL') {
    const k = KAL_GUARD_TEXT;
    const counts = s.tiers.map((need, i) => (KAL_GUARDS[i] ? `(${need}) ${KAL_GUARDS[i]}기` : '')).filter(Boolean).join(' · ');
    parts.push(`<h3>소환물 · ${esc(k.name)} <span class="muted small">${esc(counts)}</span></h3><div class="cx2-row cx2-knight">${H.sprite({ id: 'kal_guard', name: k.name, sprite: 'knight', palette: KNIGHT_PAL } as unknown as UnitDef)}<span><b>${esc(k.name)}</b> <span class="tag">${esc(CTYPE_NAME.VAN)} · ${esc(TTYPE_NAME.major)} · 소환물</span><p class="muted">${esc(k.desc)}</p><p class="muted">${esc(k.weapon)}<br>${esc(k.skill)}<br>${esc(k.ult)}</p></span></div>`);
  }
  if (sid === 'HOI') parts.push(offerList('[투자] 상품', '크레딧', investOffers()));
  if (sid === 'STAR') parts.push(offerList('[속보] 명성 교환', '명성', Object.values(NEWS_OFFERS)));
  if (sid === 'VOYAGE') parts.push(`<h3>단독 출항 · 완전체 고유 능력</h3><ul class="cx2-rows">${Object.entries(VOYAGE_SPECIAL).map(([uid, v]) => `<li class="cx2-row">${UNIT_BY_ID[uid] ? H.sprite(UNIT_BY_ID[uid]) : ''}<span><b>${esc(v.who)} · ${esc(v.name)}</b><p class="muted">${esc(v.text)}</p></span></li>`).join('')}</ul>`);
  if (sid === 'NAV') {
    const aces = UNITS.filter((d) => d.ace);
    parts.push(`<h3>에이스 파일럿 능력 <span class="muted small">능력 ×1 기준</span></h3><ul class="cx2-rows">${aces.map((d) => `<li class="cx2-row">${H.sprite(d)}<span><b>${esc(d.name)} · ${esc(d.ace!.name)}</b><p class="muted">${H.statIc(esc(d.ace!.desc(1)))}</p></span></li>`).join('')}</ul>`);
  }
  const lore = LORE.filter((e) => e.rel?.syn?.includes(sid));
  if (lore.length) parts.push(`<h3>세계관</h3><div class="cx2-mem">${lore.map((e) => loreChip(e.id)).join('')}</div>`);
  return `<div class="detail cx-d cx2-d"><div class="cx2-hd" style="--c:${s.color}"><span class="cx2-synf big">${synIcon(s.id) || esc(s.icon)}</span><div><b>${esc(s.name)}</b><small>${KIND_NAME[s.kind]} · 단계 ${s.tiers.join(' / ')}${EMBLEM_SYNS.includes(sid) ? ' · 문장 있음' : ' · 전용'}</small></div></div>${parts.join('')}</div>`;
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
  const list = shown.map(([, l, ids]) => grp('syn', '', `<h3 class="cx-h">${esc(l)} <span class="muted small">${ids.length}종</span></h3><div class="cx-grid">${ids.map(synTile).join('')}</div>`)).join('');
  const sel = CX2.sel.syn as SynergyId | null;
  return wrap('syn', `<div class="cx2-tools">${searchBox('syn', '시너지 · 효과 · 기물 이름 검색')}</div>${bar}${list}${noneMsg('syn', list)}`,
    sel ? synDetail(H, sel) : empty('시너지를 고르면 단계별 효과 · 소속 기물 · 문장 · 전용 장비를 볼 수 있습니다.'));
}

// ═══════════════════════ 증강 문장 (토큰 → 계수 표시)
const NO_CTX: AB.AbilCtx = { b: null, c: null, p: {} };
export function augHtml(H: CxH, id: string, param?: string, gl = new Set<string>()) {
  const t = augAbilText(id);
  return t ? H.statIc(AB.tok(t, NO_CTX, gl)) : esc(augDesc(id, param));
}
const augById = (id: string) => ALL_AUGS.find((a) => a.id === id);
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
function augLi(H: CxH, a: AugDef, tags: string[] = [], q = '') {
  const x = (a.excl || []).map((e) => augById(e)?.name).filter(Boolean) as string[];
  const all = [...tags, ...(a.stack ? ['중복 가능'] : []), ...(a.roll ? ['능력치 무작위'] : [])];
  const text = augHtml(H, a.id) + tfLine(H, a.id);
  const rq = augReqState(a.id);
  return `<li class="aug-li" data-id="${esc(a.id)}"${qAttr('augs', `${a.name} ${a.desc} ${text} ${all.join(' ')} ${q}`)}>${H.augIcon(a.id)}<span><b>${isTransformAug(a.id) ? '◆ ' : ''}${esc(a.name)}</b>${all.map((t) => ` <span class="tag">${esc(t)}</span>`).join('')}<br><span class="muted">${text}</span>${x.length ? `<br><span class="cx2-x">함께 가질 수 없음: ${x.map(esc).join(', ')} <span class="muted">(같은 선택 창에 함께 나올 수 있고, 하나를 고르면 나머지는 이후 제외)</span></span>` : ''}${rq ? `<br><span class="aug-req ${rq.ok === false ? 'bad' : 'info'}">조합 조건: ${esc(rq.hint)}. ${esc(rq.cur)}</span>` : ''}</span></li>`;
}

// ═══════════════════════ 사이오닉
const groupUnits = (g: GroupId) => UNITS.filter((d) => d.ttype === 'psionic' && UNIT_GROUP[d.id] === g);
const freeUnits = () => UNITS.filter((d) => d.ttype === 'psionic' && !UNIT_GROUP[d.id]);
const schoolAugs = (sid: SchoolId) => ALL_AUGS.filter((a) => a.pool === 'psionic' && a.owner === sid);
function psiTab(H: CxH) {
  const groups = Object.entries(GROUPS) as [GroupId, (typeof GROUPS)[GroupId]][];
  const list = groups.map(([gid, g]) => `<div class="cx2-grp cx2-psig" style="--sc:${g.color}">
    <h3 class="cx-h"><span style="color:${g.color}">${esc(g.name)}</span> <span class="muted small">${esc(g.study)}</span></h3>
    <dl class="cx2-reason"><dt>고이성</dt><dd>${esc(g.high)}</dd><dt>저이성</dt><dd>${esc(g.low)}</dd></dl>
    <div class="cx-grid">${g.majors.map((sid) => {
      const s = SCHOOL_BY_ID[sid];
      const on = CX2.sel.psi === sid;
      return `<button class="cx-tile cx2-tile cx2-sch${on ? ' on' : ''}" style="--sc:${s.color}" ${go(`sel:psi:${sid}`)} aria-pressed="${on}"><span class="cx-face">${lineIcon(`s.${sid}`, 'li')}</span><span class="cx-nm">${esc(s.name)}</span><span class="cx2-sub">${esc(s.study)}</span></button>`;
    }).join('')}</div>
    <div class="cx2-mem small">${groupUnits(gid).map((d) => unitChip(H, d)).join('')}</div></div>`).join('');
  const free = freeUnits();
  const foot = free.length ? `<div class="cx2-grp"><h3 class="cx-h">학파 없음 <span class="muted small">${SCHOOLS.length}개 전공 중 선택</span></h3><div class="cx2-mem small">${free.map((d) => unitChip(H, d)).join('')}</div></div>` : '';
  const psiR = milestones(CFG.growth.psionic, 'psionic');
  const intro = `<p class="muted small">${esc(TTYPE_NAME.psionic)} 기물은 학파가 정해져 있고, 합류할 때 그 학파의 전공 ${groups[0][1].majors.length}개 중 1개를 고릅니다. 전공 증강은 ${esc(psiR)}에 그 전공의 ${schoolAugs(SCHOOLS[0].id).length}종 중에서 고릅니다 (최대 ${msCount(CFG.growth.psionic, 'psionic')}개, ◆ = 비술 · 지속 능력을 바꾸는 변형).</p>`;
  const sel = CX2.sel.psi as SchoolId | null;
  return wrap('psi', `${intro}${list}${foot}`, sel && SCHOOL_BY_ID[sel] ? psiDetail(H, sel) : empty('전공을 고르면 비술 · 지속 능력 · 전공 증강을 볼 수 있습니다.'));
}
function psiDetail(H: CxH, sid: SchoolId) {
  const s = SCHOOL_BY_ID[sid], g = GROUPS[s.group];
  const gl = new Set<string>();
  const cantrip = cantripCard(H, sid, [], gl);
  const passive = passiveCard(H, sid, [], gl);
  const augs = schoolAugs(sid);
  const units = [...groupUnits(s.group), ...freeUnits()];
  return `<div class="detail cx-d cx2-d cx2-psi" style="--sc:${s.color}">
    <div class="cx2-band"><div class="cx2-hd">${lineIcon(`s.${sid}`, 'li cx2-sico')}<div><b style="color:${s.color}">${esc(s.name)}</b><small>${esc(g.name)} · ${esc(s.study)}</small></div></div><p class="small">${esc(SCHOOL_LINE[sid] || '')}</p>
    <dl class="cx2-reason"><dt>고이성</dt><dd>${esc(g.high)}</dd><dt>저이성</dt><dd>${esc(g.low)}</dd></dl></div>
    <h3>비술 · 지속 능력 <span class="muted small">계수 기준</span></h3><div class="abils">${cantrip}${passive}</div>
    ${augs.filter((a) => isTransformAug(a.id)).map((a) => `<h3>◆ 변형 후 <span class="muted small">「${esc(a.name)}」을 고르면</span></h3><div class="abils">${transformCards(H, a.id, gl)}</div>`).join('')}
    ${AB.glossHtml(gl)}
    <h3>전공 증강 <span class="muted small">${augs.length}종 · ${esc(milestones(CFG.growth.psionic, 'psionic'))}</span></h3>
    <ul class="augs cx2-augs one">${augs.map((a) => augLi(H, a, isTransformAug(a.id) ? ['변형'] : [])).join('')}</ul>
    <h3>이 전공을 고를 수 있는 기물</h3><ul class="cx2-rows">${units.map((d) => `<li>${unitRowBtn(H, d, PSI_BRIEF[d.id] || d.psi?.desc || '')}</li>`).join('')}</ul>
  </div>`;
}
/** 비술 카드 (augs = 반영할 전공 증강, ◆ 변형이면 머리에 표시) */
function cantripCard(H: CxH, sid: SchoolId, augs: string[], gl: Set<string>) {
  const s = SCHOOL_BY_ID[sid], cv = cantripView(sid, augs);
  return `<div class="abil cx2-ab has-tok" style="--ab:${s.color}">${H.abTok(`cantrip.${sid}`)}<div class="ab-head"><span class="ab-kind">비술</span><b>${esc(cv.name)}</b>${cv.transform ? `<span class="psi-tf">◆ 변형됨: ${esc(cv.transform)}</span>` : ''}<span class="ab-meta">${lineIcon('a.cd', 'li')}${cv.cd}초 · ${lineIcon('a.reason', 'li')}이성 -${cv.cost}</span></div>
    <div class="cx2-body">${AB.skillBody(cv.info, NO_CTX, 0, cv.cd, gl)}${AB.rowsHtml([['이성 소모', `${lineIcon('a.reason', 'li')}-${cv.cost}`]])}</div></div>`;
}
function passiveCard(H: CxH, sid: SchoolId, augs: string[], gl: Set<string>) {
  const s = SCHOOL_BY_ID[sid], pv = passiveView(sid, augs);
  return `<div class="abil cx2-ab has-tok" style="--ab:${s.color}">${H.abTok(`passive.${sid}`)}<div class="ab-head"><span class="ab-kind">지속</span><b>${esc(s.passive.name)}</b>${pv.transform ? `<span class="psi-tf">◆ 변형됨: ${esc(pv.transform)}</span>` : ''}</div>
    <div class="cx2-body">${AB.rowsHtml(pv.rows.map(([k, v]) => [k, H.statIc(AB.tok(v, NO_CTX, gl))] as [string, string]))}</div></div>`;
}
/** ◆ 변형 증강: 바뀐 비술 · 지속 능력 카드 */
function transformCards(H: CxH, augId: string, gl: Set<string>) {
  const tp = transformPreview(augId);
  if (!tp) return '';
  return `${tp.cantrip.transform ? cantripCard(H, tp.sid, [augId], gl) : ''}${tp.passive.transform ? passiveCard(H, tp.sid, [augId], gl) : ''}`;
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
        return grp('augs', '', `<div class="cx2-uh">${d ? unitChip(H, d, `${esc(CTYPE_NAME[d.ctype])} · ${l.length}종`) : esc(o)}</div><ul class="augs cx2-augs">${l.map((a) => augLi(H, a, [], d?.name || '')).join('')}</ul>`);
      }).join('');
    } else if (pool === 'psionic') {
      const owners = [...new Set(list.map((a) => a.owner || ''))];
      note = `${TTYPE_NAME.psionic} 기물이 ${milestones(CFG.growth.psionic, 'psionic')}에 자기 전공의 증강 중에서 고릅니다. ◆ = 변형. 자세한 내용은 사이오닉 탭.`;
      body = (H) => owners.map((o) => {
        const s = SCHOOL_BY_ID[o as SchoolId], l = list.filter((a) => (a.owner || '') === o);
        return grp('augs', '', `<div class="cx2-uh">${s ? `<button class="cx2-sc" style="--c:${s.color}" ${go(`go:psi:${s.id}`)}>${lineIcon(`s.${s.id}`, 'li')}${esc(GROUPS[s.group].name)} · ${esc(s.name)}</button>` : esc(o)}</div><ul class="augs cx2-augs">${l.map((a) => augLi(H, a, [], s ? `${s.name} ${GROUPS[s.group].name}` : '')).join('')}</ul>`);
      }).join('');
    } else {
      if (pool === 'major') note = `${TTYPE_NAME.major} 기물이 ${milestones(CFG.growth.major, 'major')} 고릅니다.`;
      if (pool === 'school') note = `${TTYPE_NAME.psionic} 기물이 합류할 때 학파의 전공 ${Object.values(GROUPS)[0].majors.length}개 중 1개를 고릅니다 (학파가 없으면 ${SCHOOLS.length}개 중).`;
      body = (H) => `<ul class="augs cx2-augs">${list.map((a) => augLi(H, a)).join('')}</ul>`;
    }
    out.push({ key: pool, name, note, body, count: list.length });
  }
  // 전역 · 특권 · 축복: 기물이 아닌 함대 전체 증강
  const simple = (key: string, name: string, note: string, rows: { id: string; name: string; desc: string; tags: string[] }[]): AugGroup => ({
    key, name, note, count: rows.length,
    body: () => `<ul class="augs cx2-augs">${rows.map((r) => `<li class="aug-li" data-id="${esc(r.id)}"${qAttr('augs', `${r.name} ${r.desc} ${r.tags.join(' ')}`)}><span class="aug-ic" style="--h:${key === 'global' ? 160 : key === 'priv' ? 42 : 50}" aria-hidden="true">${lineIcon(key === 'bless' ? 'a.divact' : key === 'priv' ? 'a.power' : 'n.council', 'li')}</span><span><b>${esc(r.name)}</b>${r.tags.map((t) => ` <span class="tag">${esc(t)}</span>`).join('')}<br><span class="muted">${esc(r.desc)}</span></span></li>`).join('')}</ul>`,
  });
  out.push(simple('global', '전역 증강', '런 시작과 매 페이즈 항로 회의에서 3개 중 1개. 함대 전체에 적용됩니다.',
    GLOBALS.map((g) => ({ id: g.id, name: g.name, desc: g.desc, tags: [...(g.unique ? ['1회'] : []), ...(g.team ? ['모든 아군'] : []), ...(g.onPick ? ['즉시'] : [])] }))));
  const wsum = PRIVILEGES.reduce((n, p) => n + p.w, 0);
  const PH = '(시너지)';
  out.push(simple('priv', '특권 증강', '런 시작 때 3개 중 1개 (새로고침 가능). 문장은 시작 기물의 시너지 위주로 나옵니다.',
    PRIVILEGES.map((p) => ({ id: p.id, name: p.name(PH), desc: p.desc(PH), tags: [`출현 ${pctTxt(p.w / wsum)}`] }))));
  out.push(simple('bless', '축복', `${TTYPE_NAME.divine} 기물이 있으면 열리는 순례에서 권능으로 받습니다. 이번 페이즈 동안 모든 아군에게.`,
    BLESSINGS.map((b) => { const c = PILGRIM_CARDS[`bless:${b.id}`]; return { id: b.id, name: b.name, desc: b.desc, tags: c ? [`권능 ${c.cost}`] : [] }; })));
  return out;
}
function augsTab(H: CxH) {
  const groups = augGroups();
  const f = CX2.filt.augs;
  const bar = filterBar('augs', [['all', '전체', groups.reduce((n, g) => n + g.count, 0)], ...groups.map((g) => [g.key, g.name, g.count] as [string, string, number])]);
  const shown = groups.filter((g) => f === 'all' || f === g.key);
  const body = shown.map((g) => grp('augs', ' cx2-ag', `<h2 class="cx-h">${esc(g.name)} <span class="muted small">${g.count}종</span></h2>${g.note ? `<p class="muted small">${esc(g.note)}</p>` : ''}${g.body(H)}`, 'section')).join('');
  return `<div class="cx2 cx2-augsTab"><div class="cx2-tools">${searchBox('augs', '증강 이름 · 효과 · 기물 검색')}</div>${bar}${body}${noneMsg('augs', body)}</div>`;
}

// ═══════════════════════ 세계관 (src/data/worldlore.ts · 전장은 battlefields.ts 에서 읽음)
const loreColor = (e: LoreEntry) => SYN_BY_ID[e.mark as SynergyId]?.color || e.color || 'var(--accent)';
const loreIcon = (e: LoreEntry) => synIcon(e.mark) || lineIcon(e.mark, 'li');
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
  return `<div class="cx2-fld" style="--c:${f.color}" data-field="${esc(f.id)}"><div class="cx2-fld-bg" style="background-image:url('${bgURL(`field_${f.id}`)}'), linear-gradient(165deg, color-mix(in srgb, ${f.color} 40%, #0b0d14), #0b0d14 75%)" aria-hidden="true"></div>
    <div class="cx2-fld-tx"><b>${esc(f.icon)} ${esc(f.name)}</b><small>${esc(f.region)}</small><p>${esc(f.desc)}</p>
    <ul class="cx2-src">${f.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="cx2-mem">${syn ? synChip(syn) : ''}<button class="btn tiny" ${go(`tab:enemies:${f.id}`)}>이 전장의 적 보기</button></div></div></div>`;
}
function loreTile(e: LoreEntry) {
  const on = CX2.sel.lore === e.id;
  const r = e.rel || {};
  const names = [...(r.units || []).map((u) => UNIT_BY_ID[u]?.name || ''), ...(r.syn || []).map((s) => SYN_BY_ID[s]?.name || ''), ...(r.fields || []).map((x) => FIELD_BY_ID[x]?.name || '')].join(' ');
  return `<button class="cx-tile cx2-tile${on ? ' on' : ''}" ${go(`sel:lore:${e.id}`)} aria-pressed="${on}" style="--c:${loreColor(e)}"${qAttr('lore', `${e.name} ${e.tag} ${e.bullets.join(' ')} ${names}`)}>
    <span class="cx-face cx2-synf">${loreIcon(e)}</span><span class="cx-nm">${esc(e.name)}</span><span class="cx2-sub">${esc(loreSub(e))}</span></button>`;
}
const LORE_EMPTY = '항목을 고르면 짧은 소개와 관련 시너지 · 전장 · 기물을 볼 수 있습니다.';
function loreDetail(H: CxH, id: string): string {
  const e = LORE_BY_ID[id];
  if (!e) return empty(LORE_EMPTY);
  const r = e.rel || {};
  const parts: string[] = [`<p class="cx2-lt">${esc(e.tag)}</p>`, `<ul class="cx2-lb">${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`];
  if (e.bloc) parts.push(`<h3>소속 세력</h3><div class="cx2-mem">${loreChip(e.bloc)}</div>`);
  const kids = loreRegionsOf(e.id);
  if (kids.length) parts.push(`<h3>주요 지역 <span class="muted small">${kids.length}곳</span></h3><div class="cx2-mem">${kids.map((x) => loreChip(x.id)).join('')}</div>`);
  if (r.syn?.length) parts.push(`<h3>시너지</h3><div class="cx2-mem">${r.syn.map(synChip).join('')}</div>`);
  if (r.fields?.length) parts.push(`<h3>무대가 되는 전장</h3>${r.fields.map(fieldCard).join('')}`);
  const units = (r.units || []).map((u) => UNIT_BY_ID[u]).filter((d): d is UnitDef => !!d);
  if (units.length) parts.push(`<h3>관련 기물 <span class="muted small">${units.length}명</span></h3><div class="cx2-mem">${units.map((d) => unitChip(H, d, esc(d.title))).join('')}</div>`);
  if (r.lore?.length) parts.push(`<h3>함께 보기</h3><div class="cx2-mem">${r.lore.map(loreChip).join('')}</div>`);
  const art = e.art ? `<img class="cx2-lart" src="${artURL(`${e.art}.webp`)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
  return `<div class="detail cx-d cx2-d cx2-ld" style="--c:${loreColor(e)}">${art}<div class="cx2-hd"><span class="cx2-synf big">${loreIcon(e)}</span><div><b>${esc(e.name)}</b><small>${esc(loreSub(e))}</small></div></div>${parts.join('')}</div>`;
}
function loreTab(H: CxH) {
  const f = CX2.filt.lore;
  const groups: LoreGroup[] = ['errantes', 'faction', 'region'];
  const bar = filterBar('lore', [['all', '전체', LORE.length], ...groups.map((g) => [g, LORE_GROUP_NAME[g], LORE.filter((e) => e.group === g).length] as [string, string, number])]);
  const list = LORE_SECTIONS.filter((s) => f === 'all' || f === s.group).map((s) => {
    const l = LORE.filter((e) => e.group === s.group && (!s.bloc || e.bloc === s.bloc));
    return grp('lore', '', `<h3 class="cx-h">${esc(s.name)} <span class="muted small">${l.length}</span></h3><div class="cx-grid">${l.map(loreTile).join('')}</div>`);
  }).join('');
  const intro = '<p class="muted small">은하력 562년 기준의 짧은 안내입니다. 항목을 고르면 관련 시너지 · 전장 · 기물로 이어집니다.</p>';
  const sel = CX2.sel.lore;
  return wrap('lore', `${intro}<div class="cx2-tools">${searchBox('lore', '세력 · 지역 · 기물 이름 검색')}</div>${bar}${list}${noneMsg('lore', list)}`,
    sel ? loreDetail(H, sel) : empty(LORE_EMPTY));
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
/** 상세 패널만 (검사 · 다른 화면에서 재사용) */
export function codex2Detail(tab: Cx2Tab, id: string, H: CxH): string {
  if (tab === 'items') return itemDetail(H, id);
  if (tab === 'syn') return synDetail(H, id as SynergyId);
  if (tab === 'psi') return psiDetail(H, id as SchoolId);
  if (tab === 'lore') return loreDetail(H, id);
  return '';
}
/**
 * 도감 추가 탭 동작. v = sel:<탭>:<id> (상세 펼침 · 접기) | filt:<탭>:<분류> | go:<탭>:<id> (그 탭으로 가서 펼침) | unit:<기물> | tab:<main.ts 도감 탭> (적 · 사건 등으로 이동)
 * 돌려주는 tab · unit 은 main.ts 가 app.codexTab · app.codexSel 에 넣는다.
 */
export function codex2Act(v: string): { tab?: string; unit?: string; scroll: boolean } {
  const [cmd, tab, ...rest] = v.split(':');
  const id = rest.join(':');
  if (cmd === 'unit') return { tab: 'units', unit: [tab, ...rest].join(':'), scroll: true };
  if (cmd === 'tab') { // 다른 도감 탭으로. tab:enemies:<전장> 이면 그 전장 묶음까지 내려간다 (main.ts 가 다시 그린 뒤)
    const name = FIELD_BY_ID[id]?.name;
    if (name && typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>('main.codex h2')).find((h) => h.textContent?.includes(name))?.scrollIntoView({ block: 'start' }));
    return { tab, scroll: false };
  }
  if (!isCx2Tab(tab)) return { scroll: false };
  if (cmd === 'sel') { CX2.sel[tab] = CX2.sel[tab] === id ? null : id; return { scroll: !!CX2.sel[tab] }; }
  if (cmd === 'filt') { CX2.filt[tab] = id || 'all'; return { scroll: false }; }
  if (cmd === 'go') {
    CX2.sel[tab] = id; CX2.filt[tab] = 'all'; CX2.q[tab] = '';
    return { tab, scroll: true };
  }
  return { scroll: false };
}

