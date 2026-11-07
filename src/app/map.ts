// 화면: 지도 (항로 · 함선 관리 · 적 스펙 등급 · 명부 줄) (main.ts 에서 분리)
import { CFG, encDmgMult, phaseAmpMult, phaseHpMult, scalePhase } from '../config';
import { ENEMY_BY_ID, type EnemyDef } from '../data/enemies';
import { ENEMY_DESC } from '../data/enemyText';
import { diffAddCount, diffAddRule } from '../data/difficulty';
import { despairsOf } from '../data/despair';
import { BOONS } from '../data/events';
import { fieldOf } from '../data/battlefields';
import { GLOBAL_BY_ID } from '../data/globals';
import { CONSUMABLES } from '../data/items';
import { SYN_BY_ID, SYNERGIES, tierOf } from '../data/synergies';
import { RECRUITABLE, UNIT_BY_ID } from '../data/units';
import * as CTR from '../ui/contract';
import { buildEnemy, chrTier, deployed, kingOn, memberships, synergyCounts } from '../engine/build';
import { Battle, type CUnit } from '../engine/combat';
import * as R from '../engine/run';
import { CAUSAL, causalGain, causalLeft, causalStage, gearScore, kingStageText } from '../data/chungra';
import { Rng } from '../rng';
import { CATEGORY_NAME, CATEGORY_RULE, CTYPE_NAME, TTYPE_NAME, MAJORS, NODE_NAME, type Major, type NodeType, type RunState, type SynergyId, type UnitState } from '../types';
import { computeStats } from '../engine/build';
import { campBoss } from '../engine/campaign';
import { chapterOf as campChapter, SETTLE as CAMP_SETTLE, TIME_COST as CAMP_TIME_COST } from '../data/campaign';
import { fmt } from '../ui/battleview';
import { bgURL } from '../ui/portraits';
import * as OATH from '../ui/oath';
import { lineIcon, synIcon, typeIcon } from '../ui/synicons';
import { NODE_DESC, SHOP_BRANCH_DESC } from '../data/nodes';
import * as RM from '../ui/routemap';
import * as SHOP from '../ui/shop';
import { app, esc, jackpotTxt, pctTxt } from './state';
import { NODE_ICON, itemIcon, rankPips, recommendedMajors, sprite, statPopHtml, synergyPanel, xpBar } from './common';
import { despairEnv } from './title';
import { dBar, enemyCategory } from './unitparts';
import { invGroups, kingDetail } from './prep';
import { detailPanel, tchip } from './abilities';
import { tendOf } from './battle';
import { fieldCard, kvChip } from './modals';

// ───────────────────────── 화면: 맵
/** 환경 탭 전장 = 여행 포스터의 한 줄 문구 · 현상 도장 (메트로, 2026-11-07 사용자 결정 C2-1 — 갤럭시는 숨긴다): 데이터를 그릴 때마다 읽는다.
 *  한 줄 문구 = 설명 첫 문장 (따옴표로 시작하면 닫는 따옴표까지), 현상 = 첫 조건의 이름 ('이름: 효과' 꼴일 때만) */
function envPoster(f: { desc: string; rules: string[] }) {
  const line = f.desc.match(/^["“][^"”]*["”]/)?.[0] ?? f.desc.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? f.desc;
  const ph = f.rules[0]?.match(/^([^:]{1,16}):/)?.[1];
  return `<p class="env-line">${esc(line)}</p>${ph ? `<span class="env-ph" data-k="PHENOMENON">${esc(ph)}</span>` : ''}`;
}
export function mapScreen(run: RunState) {
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
      ${RM.routeMapOn(run) ? '<div class="rmap-host"></div>' : ''}${run.links ? routeGraph(run, pick, nodeIc) : `<div class="tl"><ol class="tl-track">${track}</ol></div>`}
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
      <div class="env-hero" style="--c:${fieldOf(run.field).color};background-image:url('${bgURL(`field_${fieldOf(run.field).id}`)}'), linear-gradient(165deg, color-mix(in srgb, ${fieldOf(run.field).color} 40%, #0b0d14), #0b0d14 75%)"><span class="env-kicker">현재 전장</span><b data-k="DESTINATION">${esc(fieldOf(run.field).name)}</b><span class="env-reg">${esc(fieldOf(run.field).region)}</span>${envPoster(fieldOf(run.field))}</div>
      <button class="field-btn" data-a="field-info" title="전장 브리핑 다시 보기">${fieldCard(run, true)}</button>
      ${kingEnv(run)}
      ${run.quests.length ? `<h2>헬레니우스 퀘스트</h2><ul class="quests">${run.quests.map((q) =>
        `<li class="${q.done ? 'done' : ''}">${esc(R.questText(q))} <span class="muted">${Math.min(q.progress, q.target)}/${q.target} · 보상 ${R.questRewardText(q)}</span></li>`).join('')}</ul>` : ''}
      ${run.privilege ? `<h2>특권</h2><ul class="globals"><li><b>${esc(R.privilegeName(run.privilege))}</b> <span class="muted">${esc(R.privilegeDesc(run.privilege))}</span></li></ul>` : ''}
      ${CTR.contractEnv(run)}${despairEnv(run)}${OATH.oathEnv(run)}
      ${run.boons.length || run.phaseBoons.length || run.mods.nodeIncome || run.mods.interestCap ? `<h2>사건 효과</h2><ul class="globals">${run.boons.map((id) => `<li><b>${esc(BOONS[id]?.name || id)}</b> <span class="muted">영구</span></li>`).join('')}${run.phaseBoons.map((id) => `<li><b>${esc(BOONS[id]?.name || id)}</b> <span class="muted">이번 페이즈</span></li>`).join('')}${run.mods.nodeIncome ? `<li><b>분할 정산</b> <span class="muted">노드마다 크레딧 +${run.mods.nodeIncome}, 이자 상한 ${run.mods.interestCap}</span></li>` : ''}</ul>` : ''}
      ${run.globals.length ? `<h2>전역 증강</h2><ul class="globals">${run.globals.map((g) => `<li${GLOBAL_BY_ID[g].tier ? ` class="gt-${GLOBAL_BY_ID[g].tier}"` : ''}>${lineIcon(g, 'li')}<b>${esc(GLOBAL_BY_ID[g].name)}</b> <span class="muted">${ic(esc(GLOBAL_BY_ID[g].desc))}</span></li>`).join('')}</ul>` : ''}
      </section>
      <section class="st-pane" role="tabpanel" aria-label="기록">
      <h2>기록</h2>
      <ul class="log">${run.log.slice(0, 40).map((l) => { const k = l.indexOf(': '); return `<li>${k > 0 && k <= 16 ? `<b>${esc(l.slice(0, k))}</b> ${esc(l.slice(k + 2))}` : esc(l)}</li>`; }).join('')}</ul>
      </section>
      </div></div>
    </aside>
    ${app.sel?.k === 'unit' ? statPopHtml(run) : ''}
  </main>`;
}
/** 캠페인 지도 머리: 남은 AH(접근시간) · 정산 구간 */
export function campTimeChip(run: RunState) {
  const c = run.campaign!, ch = campChapter(run), st = CAMP_SETTLE[ch.ch] || [];
  const next = st.find((s) => c.time >= s.from);
  const tip = `AH(접근시간) ${c.time} / ${c.timeMax} — 고른 행동에만 든다. 장 정산: ${st.filter((s) => s.cr).map((s) => `${s.from} 이상 +${s.cr}`).join(' · ')}`;
  return `<span class="camp-time${c.time < 8 ? ' low' : ''}" title="${esc(tip)}">${lineIcon('r.ah', 'li')}<span>AH</span><b>${c.time}</b><small>/${c.timeMax}</small>${next?.cr ? `<em>정산 +${next.cr}</em>` : ''}</span>`;
}
/** 지도 환경 탭: 청라공국 · 인과율 (인과율이 있거나 청라가 켜져 있을 때) */
export function kingEnv(run: RunState) {
  if (!run.causal && !kingOn(run)) return '';
  const pts = run.causal || 0, n = causalStage(pts), lf = causalLeft(pts), t = chrTier(run), g = causalGain(run, t);
  return `<h2>청라공국 · 인과율</h2><ul class="globals"><li><button class="pill-btn" data-a="king-info"><b>공왕 무휼 · 인과 ${n}단계</b></button> <span class="muted">${lf ? `다음까지 ${lf}` : '최고 단계'} · 누적 ${pts}</span></li>
    <li><b>수집</b> <span class="muted">청라 ${t ? `×${CAUSAL.mult[t]}` : '꺼짐 (3명부터)'} · 장비 점수 ${gearScore(run)}${t ? ` · 다음 승리 +${g.total} (장비 +${g.gear})` : ''}</span></li>
    <li><b>단계 효과</b> <span class="muted">${esc(kingStageText(n))}</span></li></ul>`;
}
/** 메인 화면 상세 보기: 파티 아이콘을 누르면 오른쪽 패널(파티 · 환경 · 기록 자리)에 기물 상세가 열린다 */
export let lastMapDetail: string | null = null;
export function mapDetail(run: RunState) {
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
export function shipPanel(run: RunState, extra = '') {
  const fc = R.fleetCost(run), mc = R.musterCost(run), busy = !!run.node || run.pending.length > 0, tk = R.ticketCount(run); // tk: 지정 소집 티켓 (유이 전용 상품) — 있으면 소집 비용 0
  const full = run.units.length >= CFG.maxParty, mBlock = R.musterBlock(run), inShop = run.node?.type === 'shop' && !run.pending.length;
  const mSub = full ? `보유 한도 ${CFG.maxParty}명` : inShop ? (tk ? '상점 중 · 티켓으로 소집' : '상점 중 · 티켓만 가능') : `시너지 ${CFG.musterPicks}개를 골라 그 안에서 영입`;
  return `<section class="ship" aria-labelledby="ship-h"><h2 id="ship-h">함선 관리</h2><div class="ship-grid">
    <button class="ship-btn" data-a="fleet" ${fc === null || run.credits < fc || busy ? 'disabled' : ''}${busy ? ` title="${esc(run.node ? '진행 중인 칸을 끝낸 뒤' : '진행 중인 선택을 먼저 끝내세요')}"` : ''}>
      <span class="sb-ic">${NODE_ICON.supply}</span><b>함대 확장</b>
      <span class="small muted">출전 인원 ${R.deployCap(run)} → ${fc === null ? '최대' : R.deployCap(run) + 1}명</span>
      <span class="sb-cost">${fc === null ? '<span class="pk">최대 규모</span>' : `${CR}${fc}`}</span></button>
    <div class="ship-cell">${SHOP.adHtml(run)}<button class="ship-btn" data-a="muster-open" ${mBlock ? `disabled title="${esc(mBlock)}"` : ''}>
      <span class="sb-ic">${NODE_ICON.recruit}</span><b>지정 소집</b>
      <span class="small muted">${mSub}</span>
      <span class="sb-cost${tk ? ' tk' : ''}"${tk ? ` title="${esc(`${CONSUMABLES[R.TICKET].name} ${tk}장 — 크레딧 대신 1장`)}"` : ''}>${tk ? `${CR}<s>${mc}</s><b>0</b><small>${itemIcon(R.TICKET)}×${tk}</small>` : `${CR}${mc}`}</span></button></div>
  </div>${extra}</section>`;
}
export function musterModal(run: RunState) {
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
  return `<h1 class="mt-hd" data-k="MUSTER · TICKET" style="--hdc:var(--mt-b)">지정 소집</h1>
    <div class="ms-legend small muted"><span><i class="ms-syn ms-demo"><span class="ms-n">5</span></i>후보 수</span><span><i class="ms-syn ms-demo own" style="--c:var(--c-text)"></i>보유 중인 시너지</span></div>
    ${group('faction', '세력')}${group('trait', '특성')}
    <div class="row-btns ms-foot"><div class="ms-state"><div class="ms-picks" aria-label="고른 시너지 ${sel.length}/${CFG.musterPicks}">${picks}</div>
      ${kvChip('후보', sel.length ? `<b>${pool.length}</b>명` : '<b>—</b>', `고른 시너지 중 하나라도 가진 기물이 후보 (${CFG.musterPicks}개를 모두 골라야 소집)`, full ? '' : 'zero')}</div>
      <button class="btn" data-a="muster-cancel">취소</button>
      <button class="btn primary" data-a="muster-ok" ${full && pool.length ? '' : 'disabled'}>소집 ${R.ticketCount(run) ? `${CR}<s>${R.musterCost(run)}</s> 0 · 티켓 1장` : `${CR}${R.musterCost(run)}`}</button></div>`;
}
/** 보급 미리보기: 카드 수 · 지금 기준 합계 가치 (run.ts supplyBase, 크레딧 환산) */
/** route: 항로에 놓인 보급 노드 (첫 장 재료 확정 · 대박 없음) / 아니면 분기점 보급 */
export const supplyHint = (run: RunState | null, route = false) => `보급품 ${CFG.supply.cards}장 모두 받기 (${route ? '첫 장 장비 재료 확정, 나머지 ' : ''}크레딧 · 공명도 · 장비 무작위)${run ? ` · 합계 가치 약 ${Math.round(R.supplyBase(run))} 크레딧어치` : ''}${route ? ' · 대박 없음' : ` · 장마다 대박 ${jackpotTxt()}`}`;
export function nodeHint(o: NodeType) {
  return ({
    battle: '공명도 · 크레딧 · 재료 확률', adversity: `적 ×${CFG.adversityMult} · 보상 ${CFG.adversityReward}배 + 장비 재료 ${CFG.drop.advParts}개 확정`,
    council: `전역 증강 3장 중 택1 · 새로고침 ${CFG.globalRerolls}회`, shop: app.run?.links ? '상인의 진열대 · 장비 · 소모품 · 재료' : `분기점 — 상점 / 보급 / 모집 (+ ${SYN_BY_ID.STAR.name} 속보 · 호이슌 투자 · 순례)`, // 분기 항로는 상점 노드 = 바로 상점
    supply: supplyHint(app.run, true), recruit: '새 동료 3명 중 택1', boss: `${app.run && R.bossMustWin(app.run) ? '의뢰의 마지막 보스 · 이길 때까지 다시 싸운다' : `승리 시 페이즈 클리어 · 패배해도 다음 페이즈로 (체력 -${CFG.bossLossDamage(app.run?.phase || 1)})`} · ${CFG.drop.bossAdvEvery}페이즈마다 희귀 장비`,
    pilgrim: '제례 (신앙별 봉헌 + 축복) · 나눔 (재료) 중 1장 무료 · 권능으로 성유물 · 개종', news: '명성을 보상으로 교환', invest: '호이슌 투자 상품 · 크레딧으로 문장 · 증강 · 다음 페이즈 수익', event: '전장에 얽힌 사건 · 선택에 따라 판이 바뀝니다',
    fork: `갈림길 — 휴식(체력 +${CFG.forkRestHp} + 잃은 체력 ${Math.round(CFG.forkRestLost * 100)}%) 또는 도전(다음 페이즈 역경급 전투, 승리 시 다음 페이즈로)`,
    challenge: '다음 페이즈 역경 수준의 전투 · 승리 시 남은 노드 보상을 받고 다음 페이즈로',
  } as Record<NodeType, string>)[o] || '';
}
/** 이번 페이즈 보스: 전장의 보스는 페이즈마다 순환한다 (조우 생성과 같은 규칙) */
export const phaseBoss = (run: RunState): EnemyDef | undefined => { if (run.campaign) return ENEMY_BY_ID[campBoss(run)]; const f = fieldOf(run.field); return ENEMY_BY_ID[f.bosses[(run.phase - 1) % f.bosses.length]]; };
export const FIGHT_NODES: NodeType[] = ['battle', 'adversity', 'challenge', 'boss'];
/** 분기 항로 지도 (run.links): 칸 = 열, 노드 = 갈래 자리 (세 갈래 1 · 3 · 5, 두 갈래 2 · 4, 하나 3 — 6칸 격자에서 2칸씩), 연결선 = 뒤에 깐 SVG (같은 격자 좌표).
 *  지나간 노드 · 연결선 = 진하게, 지금 고를 수 있는 노드 = 단추, 지금 위치에서 갈 수 없는 노드 · 연결선 = 흐리게 (docs/UI.md 10: 정적) */
export function routeGraph(run: RunState, pick: NodeType | undefined, nodeIc: (o: NodeType, i: number) => string) {
  const links = run.links!, rows = run.map, C = rows.length, path = run.path || [];
  const slot = (len: number, j: number) => (len === 1 ? 3 : len === 2 ? 2 + j * 2 : 1 + j * 2); // 6칸 격자의 시작 줄 (가운데 = 같은 수)
  // 지금 위치에서 갈 수 있는 노드: 지금 칸의 고를 수 있는 노드부터 앞으로
  const reach = rows.map(() => new Set<number>());
  if (!run.node) R.reachIdx(run).forEach((j) => reach[run.step]?.add(j)); else reach[run.step]?.add(path[run.step] ?? 0);
  for (let i = run.step; i < C - 1; i++) for (const j of reach[i]) for (const k of links[i]?.[j] || []) reach[i + 1].add(k);
  const reachable = R.reachIdx(run);
  const edges: string[] = [];
  for (let i = 0; i < C - 1; i++) rows[i].forEach((_, j) => (links[i]?.[j] || []).forEach((k) => {
    const taken = i < run.step && path[i] === j && path[i + 1] === k, live = i >= run.step && reach[i].has(j) && reach[i + 1].has(k);
    edges.push(`<line class="${taken ? 'rt-e taken' : live ? 'rt-e' : 'rt-e off'}" x1="${i + 0.5}" y1="${slot(rows[i].length, j)}" x2="${i + 1.5}" y2="${slot(rows[i + 1].length, k)}" vector-effect="non-scaling-stroke"/>`);
  }));
  const nodes = rows.map((row, i) => row.map((o, j) => {
    const nm = o === 'recruit' && i < run.step && run.nodeUnits?.[i] ? `${NODE_NAME[o]} · ${UNIT_BY_ID[run.nodeUnits[i]]?.name}` : NODE_NAME[o];
    const st = i < run.step ? (path[i] === j ? 'done' : 'past') : i === run.step ? (reachable.includes(j) || run.node ? (run.node && path[i] !== j ? 'off' : 'cur') : 'off') : reach[i].has(j) ? 'next' : 'off';
    const pos = `grid-column:${i + 1};grid-row:${slot(row.length, j) + 1} / span 2`;
    const cls = `tl-node rt-n n-${o} ${st}${o === 'boss' ? ' rt-boss' : ''}`;
    if (st === 'cur' && !run.node) return `<button class="${cls}${o === pick ? ' on' : ''}" style="${pos}" data-a="tl-pick" data-v="${o}" data-step="${i}" data-node="${o}" title="${esc(nm)} (단축키 ${reachable.indexOf(j) + 1})" aria-pressed="${o === pick}">${nodeIc(o, i)}</button>`;
    return `<span class="${cls}" style="${pos}" data-step="${i}" data-node="${o}" title="${esc(nm)}">${nodeIc(o, i)}</span>`;
  }).join('')).join('');
  const nums = rows.map((_, i) => `<span class="rt-num${i === run.step ? ' cur' : ''}" style="grid-column:${i + 1};grid-row:1">${i + 1}</span>`).join('');
  return `<div class="tl rt"><div class="rt-grid" style="--cols:${C}">${nums}<svg class="rt-edges" viewBox="0 0 ${C} 6" preserveAspectRatio="none" aria-hidden="true">${edges.join('')}</svg>${nodes}</div></div>`;
}
/** 지도: 보스 칸까지 남은 전투 수 (지금 칸 포함, 보스 제외) · 남은 칸 · 전환 칸 수. 실제 지도(run.map)와 이미 고른 노드에서 센다.
 *  분기 항로는 지금 위치에서 갈 수 있는 길 중 가장 적은 · 많은 전투 (fights · fightsMax) */
export function toBoss(run: RunState) {
  const bi = run.map.findIndex((o, i) => i >= run.step && o.includes('boss'));
  if (bi < 0) return null;
  if (run.links) {
    let cur = new Map<number, [number, number]>((run.node ? [run.path?.[run.step] ?? 0] : R.reachIdx(run)).map((j) => [j, [0, 0]]));
    for (let i = run.step; i < bi; i++) {
      const nx = new Map<number, [number, number]>();
      for (const [j, [lo, hi]] of cur) {
        const f = FIGHT_NODES.includes(run.map[i][j]) ? 1 : 0;
        for (const k of run.links[i]?.[j] || []) { const o = nx.get(k); nx.set(k, o ? [Math.min(o[0], lo + f), Math.max(o[1], hi + f)] : [lo + f, hi + f]); }
      }
      cur = nx;
    }
    const all = [...cur.values()], forks = run.map.slice(run.step, bi).filter((o) => o.includes('fork')).length;
    return { bi, fights: Math.min(...all.map((x) => x[0])), fightsMax: Math.max(...all.map((x) => x[1])), forks, steps: bi - run.step };
  }
  let fights = 0, forks = 0;
  for (let i = run.step; i < bi; i++) {
    const o = run.picked[i] ? [run.picked[i]!] : run.map[i];
    if (o.every((x) => FIGHT_NODES.includes(x))) fights++;
    else if (o.includes('fork')) forks++;
  }
  return { bi, fights, fightsMax: fights, forks, steps: bi - run.step };
}
/** 지도 머리: 런의 목표(이번 페이즈 보스)까지 남은 전투 */
export function bossGoal(run: RunState) {
  const t = toBoss(run);
  if (!t) return '';
  const e = phaseBoss(run);
  const txt = t.steps === 0 ? `<b>보스전</b>` : `보스까지 남은 노드 <b>${t.steps}</b>개`;
  return `<div class="boss-goal" title="${esc(`${t.bi + 1}번째 칸 · ${e?.name || NODE_NAME.boss} · 보스까지 전투 ${t.fights === t.fightsMax ? t.fights : `${t.fights}~${t.fightsMax}`}회${t.forks ? ` (${NODE_NAME.fork}에서 ${NODE_NAME.challenge} 승리 시 지름길)` : ''}`)}"><span class="bg-ic">${e ? sprite(e, 'spr') : NODE_ICON.boss}</span><span class="bg-main">${txt}</span></div>`;
}
/** 지도 미리보기: 현재 칸 + 다음 2칸 (보스는 그 안에 들어올 때만 — 남은 노드 수는 페이즈 옆 보스 칩).
 *  현재 칸 설명은 노드 유형 설명(data/nodes.ts NODE_DESC), 다음 칸 설명은 nodeHint, 재료 확률은 설정 · 전장값, 보스는 적 데이터에서 읽는다 */
export function mapAhead(run: RunState, pick: NodeType | undefined, buttons: string) {
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
  const about = (o: NodeType) => `<span class="ah-desc ah-about">${ic(esc(o === 'shop' && !run.links ? SHOP_BRANCH_DESC : NODE_DESC[o]))}</span>`; // 한 줄 항로의 상점 칸 = 갈림길
  // 현재 칸 단추: 카드 오른쪽 위에 고정 (내용 길이와 무관)
  const act = (cur: boolean) => (cur ? `<div class="ah-act">${buttons}</div>` : '');
  // 현재 칸 카드: 이름 → 노드 설명 한 줄 → (보스는 특징 칩) → 예상 수입 → 모디파이어. 다음 칸 카드: 이름 → nodeHint 여러 줄 (보스는 특징 칩)
  const bossCard = (i: number, e: EnemyDef, cur: boolean) => {
    const cat = enemyCategory(e), td = tendOf(e), rk = foeRank(run, e, run.phase, R.encounterMult('boss', R.routeStep(run, i), !!run.campaign));
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
  // 분기 항로: 다음 칸은 지금 고른 노드에서 이어지는 노드만
  const nextOf = (i: number) => { if (!run.links) return run.map[i]; const j = run.node ? run.path?.[run.step] : R.reachIdx(run).find((k) => run.map[run.step][k] === pick); return (run.links[i - 1]?.[j ?? 0] || []).map((k) => run.map[i][k]); };
  return `<section class="ahead" aria-label="현재 칸과 앞으로 올 칸"><ol class="ah-list">${cur}${idx.flatMap((i) => run.map[i].includes('boss') ? [nodeCard(i, 'boss', false)] : nextOf(i).map((o) => nodeCard(i, o, false))).join('')}</ol></section>`;
}
// ───────── 적 스펙 ≈ 공명 등급: 적의 공격 위력을 '장비 · 시너지 · 증강 없는 아군(영입 가능 기물 평균)'의 등급별 위력과 비교해 가장 가까운 등급
//   위력 = 사격 · 타격 · 기술 중 큰 값 (적은 × 페이즈 피해 배율). 아군 등급 성장은 설정값 그대로 (모든 메이저 +rankAll, 마이너 추천 메이저 rankPoints, 위력 rankPowGrowth)
//   체력은 비교 기준에 넣지 않는다: 적 체력은 여럿이 한 적을 치는 전제로 페이즈마다 곱으로 커져 등급(한 기물 +1씩)과 맞지 않는다 → 같은 등급 아군 대비 배수로 따로 보여 준다
export const allyRefs: { hp: number; pow: number }[] = [];
export function allyRef(rank: number) {
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
export function foeRank(run: RunState, e: EnemyDef, phase: number, mult: number, s?: { items?: string[]; mod?: string }) {
  return unitRank(e, buildEnemy(new Battle(9, 9, new Rng(1), { phase, credits: 0, camp: !!run.campaign, field: run.field, diff: run.diff, despairs: run.despairs, oaths: run.oaths }), e, phase, mult, s));
}
/** 적 유닛(편성 미리보기 · 전투 중)의 공명 등급 추정 */
export function unitRank(e: EnemyDef, c: CUnit) {
  const pow = Math.max(c.st.shoot, c.st.strike, c.st.tech) * c.phaseAmp;
  if (e.noAttack || !(pow > 0)) return null; // 공격하지 않는 장애물 · 지원 드론
  let lv = 1;
  while (lv < CFG.maxRank && allyRef(lv + 1).pow <= pow) lv++; // 위력은 등급에 따라 늘기만 한다
  if (lv < CFG.maxRank && allyRef(lv + 1).pow - pow < pow - allyRef(lv).pow) lv++; // 더 가까운 쪽
  return { lv, hpX: c.st.maxHp / allyRef(lv).hp };
}
export const rankTip = (r: { lv: number; hpX: number }) => `공명 등급 ★${r.lv} 수준 (추정): 공격 위력이 장비 · 시너지 없는 ★${r.lv} 아군 평균과 비슷 · 체력은 그 아군의 ×${r.hpX >= 10 ? Math.round(r.hpX) : r.hpX.toFixed(1)}`;
export const rankChip = (r: { lv: number; hpX: number } | null) => (r ? `<span class="rank foe-rank" title="${esc(rankTip(r))}">${rankLabel(r.lv)}</span>` : ''); // 아군 공명 등급과 같은 흰 배지
/** 자원 아이콘: 에너지 크레딧 · 공명도 */
export const CR = lineIcon('r.cr', 'li cr'), RES = lineIcon('r.res', 'li res'), AH = lineIcon('r.ah', 'li ah');
/** 문장 속 '크레딧' · '공명도' 앞에 아이콘 (이미 escape 된 HTML 에만) */
export const ic = (html: string) => html.replace(/(?<![A-Za-z])AH(?![A-Za-z])/g, `${AH}AH`).replace(/(에너지 크레딧|크레딧)/g, `${CR}$1`).replace(/공명도/g, `${RES}공명도`);
/** 공명 등급 표기: 별 아이콘 + 숫자 */
export const RANK_STAR = '<svg class="rstar" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.4l-6.1 3.5 1.5-6.8-5.2-4.6 6.9-.7z"/></svg>';
export const rankLabel = (rank: number) => `${RANK_STAR}${rank}`;
/** 파티 타일: 초상화(좌상단 문장 · 우상단 유형 · 좌하단 공명 등급) · 장비 */
export function rosterTile(u: UnitState) {
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
export function rosterRow(u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  return `<button class="roster-row ${u.pos ? '' : 'bench'}" data-a="manage" data-v="${u.uid}">
    ${sprite(d)}<span class="rr-main"><b>${esc(d.name)}${app.run && u.lock === app.run.phase ? ' <small class="down">⛓ 이번 페이즈 출전 불가</small>' : ''}</b>${xpBar(u)}</span>${rankPips(u.rank)}
    <span class="rr-items">${u.items.map((i) => itemIcon(i)).join('')}${u.mod ? itemIcon(u.mod) : ''}</span>
  </button>`;
}
