// 상점 · 속보 · 투자 · 사건 연출 · 공명 주입기 · 대기 중인 선택 창 · 메뉴 · 추천 장비 · 소모품 창 (main.ts 에서 분리)
import { CFG } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { ENEMY_BY_ID } from '../data/enemies';
import { diffName, effDiffLabel, runHeat } from '../data/difficulty';
import { DESPAIR_BY_ID, despairsOf } from '../data/despair';
import { EVENT_BY_ID } from '../data/events';
import { fieldElites, fieldOf } from '../data/battlefields';
import { BLESSING_BY_ID, GLOBAL_BY_ID, GLOBAL_TIER_NAME } from '../data/globals';
import { combine, CONSUMABLES, isConsumable, isLegendConsumable, DUST, SHARD, itemInfo, TURRET_GEAR } from '../data/items';
import { ENG_TUR, OCCULT_SYNTH, SYN_BY_ID, tierOf } from '../data/synergies';
import { UNIT_BY_ID, type UnitDef } from '../data/units';
import { GROUPS, UNIT_GROUP, augMark } from '../data/schools';
import { deployed, synergyCounts, totalMajors, unitEffects } from '../engine/build';
import * as R from '../engine/run';
import { BGS, NPCS, PC_NAME, type Beat } from '../data/scene';
import { CTYPE_NAME, MAJOR_NAME, MAJORS, NODE_NAME, type Major, type NodeType, type Pending, type RunState, type SynergyId } from '../types';
import { matchupShort } from '../ui/matchup';
import { DEATH_STYLES, FX, FX_DEFAULT } from '../ui/battleview';
import { exportCode, listSaves, SLOT_NAME } from '../ui/save';
import { loadMeta } from '../ui/meta';
import { iconURL, standImg, standURL } from '../ui/portraits';
import { advKey, closeAdv, playAdv } from '../ui/adv';
import * as SND from '../ui/sound';
import * as OATH from '../ui/oath';
import * as REPORT from '../ui/report';
import { lineIcon, synIcon } from '../ui/synicons';
import * as SHOP from '../ui/shop';
import { FS_SVG, UI_FX, app, canFullscreen, esc, isFullscreen, pct1, pctTxt, root, themePicker, uiFx } from './state';
import { NODE_ICON, augIcon, interestLines, itemIcon, majorIcon, recommendedMajors, sprite, statIc, synToken } from './common';
import { despairNames, dpPlayed, matchupHtml, pvPlayed, setDpPlayed, setPvPlayed } from './title';
import { CAN_HOVER, PSI_RANKS, detailToggle, ownedChip, pickCard, pilgrimHtml, schoolOpt, sub, supplyHtml, teamCount } from './unitparts';
import { CR, ic, musterModal, phaseBoss, rankLabel, rosterRow, supplyHint } from './map';
import { inventoryPanel, previewAlly } from './prep';
import { abilPopHtml, augNotes, augText } from './abilities';
import { keyList, uxSettings } from './hotkeys';
import { act, render } from '../main';

// ───────────────────────── 화면: 상점
/** 감시 포탑 장비 규칙 (포탑 상세 공용): [항목, 내용] */
export const TURRET_RULES: [string, string][] = [
  ['고르기', `엔지니어 ${SYN_BY_ID.ENG.tiers.slice(0, ENG_TUR.picks).join(' · ')}명에 처음 닿을 때 ${ENG_TUR.offer}개 중 1개 (최대 ${ENG_TUR.picks}개)`],
  ['적용', '모든 포탑 공통 (특성 · 증강으로 더 놓인 포탑 포함)'],
  ['유지', '엔지니어 단계가 내려가도 남음 · 포탑이 있을 때만 작동'],
];
/** 상태 칩 (이름 + 값): 지도 노드 미리보기의 예상 수입 칸(.ah-in)과 같은 모양. 화면 머리의 상태 줄 공용 */
export const kvChip = (label: string, val: string, title = '', cls = '') => `<span class="ah-in kv ${cls}"${title ? ` title="${esc(title)}"` : ''}><small>${label}</small><span class="kv-v">${val}</span></span>`;
/** 조건 칩 (확정 · 전용 등 켜진 규칙): 지도 노드 미리보기의 모디파이어 칸(.ah-md)과 같은 모양 */
export const modChip = (icon: string, txt: string, title = '', cls = '') => `<span class="ah-md tx ${cls}"${title ? ` title="${esc(title)}"` : ''}>${icon}<b>${txt}</b></span>`;
/** 장비 조합법 (상점 도움말): 재료 2개 = 희귀 · 성운 가루 + 재료 = 고급 모듈 · 성운 가루 + 고급 모듈 = 제련 · 성운 가루 2개 = 별무리 파편 · 별무리 파편 + 전설 = 제련 · 전설 합성 불가.
 *  예시 장비 · 능력치는 데이터(combine · itemInfo)에서 */
export function combineHelp() {
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
export function shopHead(run: RunState, stock: NonNullable<NonNullable<RunState['node']>['shop']>) {
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
export function shopScreen(run: RunState) {
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
export function newsScreen(run: RunState) {
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

export function investScreen(run: RunState) {
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
export function overScreen(run: RunState) {
  const risk = effDiffLabel(run.diff, runHeat(run)); // 실효 위험 등급 (절망 서약 반영)
  const summary = `${run.cleared ? `${esc(fieldOf(run.field).name)} 의뢰 완료${run.endless ? ` · 무한 모드 페이즈 ${run.phase}에서 귀환 불가` : ''}.` : `ERRANTEs 는 페이즈 ${run.phase}에서 무너졌습니다.`}${run.diff ? ` ${esc(risk)}.` : ''}${despairsOf(run).length ? ` 절망 증강 ${despairNames(run)}.` : ''}${OATH.oathResult(run, false)}`;
  return REPORT.reportScreen(run, {
    risk, summary, rank: rankLabel, roster: run.units.map(rosterRow).join(''),
    actions: '<button class="btn primary" data-a="newrun">새 계약</button><button class="btn" data-a="ret-bar">에란테스 바</button><button class="btn" data-a="codex">도감</button><button class="btn" data-a="to-title">타이틀</button>',
  });
}

/** 전장 정보: 이름 · 지역 · 조건 · 출현 적 · 보스 */
export function fieldCard(run: RunState, compact = false) {
  const f = fieldOf(run.field);
  const nm = (id: string) => esc(ENEMY_BY_ID[id]?.name || id);
  const bossNow = phaseBoss(run)?.id;
  return `<div class="field-card ${compact ? 'compact' : ''}" style="--c:${f.color}">
    <div class="fc-head"><span class="fc-ic">${f.icon}</span><div><b>${esc(f.name)}</b><div class="muted small">${esc(f.region)}</div></div></div>
    ${compact ? '' : `<p class="small">${esc(f.desc)}</p>`}
    <ul class="fc-rules">${f.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="small muted">출현: ${f.pool.map(nm).join(' · ')} · 정예 ${fieldElites(f).map(nm).join(' · ')}</div>
    <div class="small"><span class="accent">보스</span> ${f.bosses.map((id) => (id === bossNow ? `<b>${nm(id)}</b>` : nm(id))).join(' → ')} <span class="muted">(페이즈마다 순환)</span></div>
    ${compact ? '' : matchupHtml(f.id)}
  </div>`;
}

// ───────────────────────── 사건 연출 (임시 표시: 미연시 UI 전까지 대본 형태로 이어 보여 준다)
export function speakerOf(id: string): { name: string; color: string } {
  if (id === 'pc') return { name: PC_NAME, color: 'var(--accent)' };
  const d = UNIT_BY_ID[id];
  if (d) return { name: d.name, color: SYN_BY_ID[d.factions[0] || d.traits[0]]?.color || 'var(--accent)' };
  const n = NPCS[id];
  return { name: n?.name || id, color: n?.color || 'var(--dim)' };
}
export function sceneHtml(beats: Beat[]): string {
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
export function advSpeaker(id: string) {
  const sp = speakerOf(id);
  const stand = id === 'pc' ? 'rachel' : id; // 기물 · NPC 모두 스탠딩이 있으면 세운다
  return { ...sp, stand: standURL(stand) ? stand : null };
}
/** 사건 · 결과 장면은 전체 화면 미연시로 */
export function advSync(run: RunState | null) {
  const p = run?.pending[0];
  const live = run && p && app.screen !== 'battle' && app.screen !== 'over' && !routeHold(run);
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
export let injHold = false;
export function setInjHold(v: boolean) { injHold = v; }
export let injTimers: number[] = [];
export function injectFx(uid: string, r0: number, x0: number, x1: number, r1: number) {
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

/** 분기 항로: 갈림길 고르기가 증강 · 보상 창보다 먼저 — 지도에서 고를 노드가 2개 이상이면 증강 · 보상 · 알림 창을 미뤄 두고, 노드를 고르면 띄운다 (노드 자체의 창 = 보급 · 영입 · 사건 · 항로 회의 등은 그대로) */
export const HOLD_PENDING: Pending['t'][] = ['rankup', 'itemPick', 'turretPick', 'notice', 'global'];
export const goAfterOk = (run: RunState) => !!app.goAfter && app.goAfter.step === run.step && app.goAfter.phase === run.phase && !run.node && R.currentOptions(run).includes(app.goAfter.t);
export function routeHold(run: RunState): boolean {
  const p = run.pending[0];
  if (!p || app.screen !== 'map' || !run.links || run.node || run.tutorial || goAfterOk(run) || !HOLD_PENDING.includes(p.t)) return false;
  if ((p.t === 'global' && p.rerolls !== undefined) || (p.t === 'notice' && p.end)) return false; // 항로 회의 · 캠페인 마지막 알림
  return R.currentOptions(run).length > 1;
}

// ───────────────────────── 모달: 대기 중인 선택
export function pendingModal(run: RunState): string {
  const p = run.pending[0];
  if (!p || app.screen === 'battle' || app.screen === 'over' || injHold || routeHold(run)) return '';
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
        ${`<p class="muted small">스페셜 기물이 공명 등급 3의 배수마다 받는 보상입니다. 서로 다른 주요 능력치 ${CFG.rankPicks}개를 골라 각각 <b class="accent">+${p.points}</b>${p.options?.length === 0 ? '' : ` · 이어서 ${p.rank}등급 증강`}<br>확정할 때 ${Math.round(CFG.greatChance * 100)}% 확률로 <b>대성공</b>: 고른 능력치 상승량 2배 · (등급이 오를 때마다 모든 스탯 +${CFG.rankAll}은 이미 반영됨)</p>`}
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
          <span class="muted small">${p.kind === 'school' ? `${UNIT_GROUP[d.id] ? GROUPS[UNIT_GROUP[d.id]].name + '의 ' : ''}전공을 하나 고르세요. 비술과 지속 능력이 바로 붙고, ${PSI_RANKS.join(' · ')}등급에 전공 증강을 고릅니다.${d.id === 'rachel' ? ' 레이첼은 모든 학파의 전공을 고를 수 있습니다.' : ''}` : p.kind === 'special' ? `메이저 기물은 ${CFG.augEvery}등급마다 전용 증강을 고릅니다 (최대 ${CFG.majorAugMax}개). 이번 ★ 전설 출현 확률 ${Math.round(R.majorLegendChance(u) * 100)}% (전설을 얻기 전까지 선택마다 +${Math.round(CFG.majorLegend.pity * 100)}%p)` : p.kind === 'oath' ? '디바인 기물은 5등급마다 서약 증강을 고릅니다 (디바인 공용 풀).' : p.kind === 'psionic' ? `사이오닉 기물은 4 · 8 · 12 · 16등급에 전공 증강을 고릅니다 (최대 4개). 이번 ★ 전설 출현 확률 ${Math.round(R.psiLegendChance(u) * 100)}% (전설을 얻기 전까지 선택마다 +${Math.round(CFG.psiLegend.pity * 100)}%p)` : ''}</span>
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
      <div class="cards">${p.options.map((id, i) => { const g = TURRET_GEAR[id]; return `<button class="card tp-card" data-a="pick-turret" data-v="${i}" title="단축키 ${i + 1}">${itemIcon(id)}<b>${esc(g?.name || id)}</b><span>${statIc(esc(g?.desc || ''))}</span></button>`; }).join('')}</div>`;
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
  if (mcls === 'privilege') { pvCls = pvPlayed === run.seed ? ' pv-bg played' : ' pv-bg'; setPvPlayed(run.seed); }
  // 절망 증강: 붉은 재가 천천히 가라앉는 어두운 막 (고를 때마다 한 번 내려온다 — 새로고침으로 다시 그려도 그대로)
  if (mcls === 'despair') { const k = `${run.seed}:${run.despairs?.length || 0}`; pvCls = dpPlayed === k ? ' dp-bg played' : ' dp-bg'; setDpPlayed(k); } // 고를 때마다 (출격 · 페이즈 시작) 한 번씩
  const veil = mcls === 'despair' ? `<div class="dp-veil" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.7}s;--s:${6 + (i % 4)}s"></i>`).join('')}</div>` : '';
  const curtain = mcls === 'privilege' ? `<div class="pv-curtain" aria-hidden="true"><i class="pv-half l"></i><i class="pv-half r"></i><span class="pv-seam"></span>
    <span class="pv-stars">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 41) % 100}%;--d:${(i % 6) * 0.5}s;--s:${3 + (i % 5)}s"></i>`).join('')}</span></div>` : '';
  return `<div class="modal-bg${pvCls}">${curtain}${veil}<div class="modal ${mcls}">${body}</div></div>`;
}
export const STAT_SHORT: Record<string, string> = {
  maxHp: '체력', healEff: '회복 효율', shoot: '사격', strike: '타격', tech: '기술', acc: '명중', crit: '치명', effHit: '효과 명중',
  armor: '방어도', effRes: '효과 저항', moveSpd: '이동', eva: '회피', atkSpd: '공격 속도', reloadSpd: '재장전',
};

export function menuModal(run: RunState | null) {
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

/** 전투 유형별 추천 희귀 장비 (재료 조합 id) */
export const RECO: Record<string, string[]> = {
  MARK: ['pow_agi', 'pow_mnd', 'pow_pow', 'agi_agi', 'mnd_agi'],
  VAN: ['vit_pow', 'vit_def', 'pow_def', 'def_def', 'vit_vit', 'taunt'],
  SPEC: ['mnd_mnd', 'mnd_agi', 'mnd_def', 'vit_mnd', 'pow_mnd'],
  CMD: ['mnd_agi', 'mnd_mnd', 'def_def', 'vit_def', 'mnd_def'],
};
/** 기물별 추천 장비 키 (기물 정의 recItems 우선, 없으면 전투 유형 기본) */
export const recoKeys = (d: UnitDef) => d.recItems?.length ? d.recItems : RECO[d.ctype] || [];
/** 추천 장비 창: 추천 목록 + 보관함 보유 · 아군 장착 현황 */
export function recoModal(run: RunState) {
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
export function useModal(run: RunState) {
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
