// 화면 공용 조각 · 전환 배너 · 능력치 팝업 · 장비 말풍선 (main.ts 에서 분리)
import { CFG } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { ENEMY_BY_ID } from '../data/enemies';
import { BLESSING_BY_ID } from '../data/globals';
import { tierKey, CONSUMABLES, emblemOf, isConsumable, isEmblem, isLegendConsumable, isLocked, isMat, isMod, refineLv, refineBase, potsOf, potSlots, isOccultMod, isTurretGear, itemInfo } from '../data/items';
import { SYN_BY_ID, tierOf } from '../data/synergies';
import { rowHtml, tierCmp } from '../ui/tierdiff';
import { UNIT_BY_ID, UNITS, type UnitDef } from '../data/units';
import { withEmblemSummon } from '../data/emblems';
import { recMajors } from '../data/rework';
import { SCHOOL_BY_ID, type SchoolId } from '../data/schools';
import * as CTR from '../ui/contract';
import * as TFX from '../ui/themefx';
import { buildEnemy, deployed, kingOn, memberships, synergyCounts, synList } from '../engine/build';
import { Battle } from '../engine/combat';
import * as R from '../engine/run';
import { CAUSAL, causalLeft, causalStage } from '../data/chungra';
import { Rng } from '../rng';
import { MAJOR_NAME, MAJORS, type Major, type NodeType, type RunState, type SynergyId, type UnitState } from '../types';
import { loadMeta } from '../ui/meta';
import { hasPortrait, iconURL, standImg } from '../ui/portraits';
import * as OATH from '../ui/oath';
import { augKey, lineIcon, synIcon } from '../ui/synicons';
import { Sel, app, esc, persist, toast } from './state';
import { despairPill } from './title';
import { CR, rankLabel } from './map';
import { previewAlly, statLines } from './prep';
import { abilPopHtml, enemyAbilPop } from './abilities';
import { act } from '../main';

// ───────────────────────── 공용 조각
export const NODE_ICON = new Proxy({} as Record<NodeType, string>, { get: (_t, k: string) => lineIcon(`n.${k}`) });

export function chip(id: string) {
  const s = SYN_BY_ID[id as keyof typeof SYN_BY_ID];
  return `<span class="chip" style="--c:${s.color}">${synIcon(id) || s.icon} ${esc(s.name)}</span>`;
}
export function sprite(defOrUnit: Parameters<typeof iconURL>[0], cls = 'spr') {
  return `<img class="${cls}${hasPortrait(defOrUnit) ? ' pt' : ''}" alt="" src="${iconURL(defOrUnit)}">`;
}
/** 스탠딩 상단 배너 (클릭하면 전신 보기) */
export function hero(id: string, cls = 'hero') {
  const img = standImg(id, 'stand', true);
  return img ? `<div class="${cls}" data-stand="${id}">${img}</div>` : '';
}
// 메이저 스탯 아이콘 (24×24 선 아이콘, 색은 CSS --c)
export const MAJOR_ICON: Record<Major, string> = {
  // 메이저 능력치: 흰색 면 아이콘 (마이너 능력치 · 위력은 선 아이콘)
  vit: '<path d="M12 20.5s-7.6-4.6-9.6-9.2A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.6 5.3c-2 4.6-9.6 9.2-9.6 9.2z"/>',
  pow: '<path d="M20.5 3.5l-.8 4.6-8.1 8.1-3.8-3.8 8.1-8.1z"/><path d="M4.6 12.4l1.4-1.4 7 7-1.4 1.4z"/><path d="M6.6 16.6l.8.8-3.1 3.1a1.1 1.1 0 0 1-1.6-1.6z"/>',
  mnd: '<path fill-rule="evenodd" d="M12 5.2C5.9 5.2 2 12 2 12s3.9 6.8 10 6.8S22 12 22 12s-3.9-6.8-10-6.8zm0 2.6a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4z"/><circle cx="12" cy="12" r="2"/>',
  def: '<path d="M12 2.5l8.5 3.2v6.1c0 5-3.6 8.4-8.5 9.7-4.9-1.3-8.5-4.7-8.5-9.7V5.7z"/>',
  agi: '<path d="M13.6 2L4 13.8h6.6L9.4 22l10-12.2h-6.7z"/>',
};
export function majorIcon(m: Major, cls = 'mi') {
  return `<svg class="${cls} mi-${m}" viewBox="0 0 24 24" aria-hidden="true">${MAJOR_ICON[m]}</svg>`;
}
/** 증강 임시 아이콘: id 로 정해지는 색 · 무늬 + 이름 첫 글자 (정식 아이콘이 생기면 교체) */
export function augIcon(id: string, cls = 'aug-ic') {
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
export const recommendedMajors = (d: UnitDef): Major[] => recMajors(d);

export function rankPips(rank: number) {
  return `<span class="rank" title="공명 등급 ${rank}">${rankLabel(rank)}</span>`;
}
export function xpBar(u: UnitState) {
  if (u.rank >= CFG.maxRank) return `<div class="xp max"><i style="width:100%"></i><b>MAX</b></div>`;
  const need = CFG.xpToNext(u.rank);
  return `<div class="xp"><i style="width:${(u.xp / need) * 100}%"></i><b>${u.xp}/${need}</b></div>`;
}
/** 장비 · 물품 등급 이름 (tierKey 기준): 장비 팝업 머리 · 고르는 미니 카드 아래 표식 (app/modals.ts miniCard) */
export const TIER_NAME: Record<string, string> = { C: '재료', G: '고급', A: '희귀', L: '전설', M: '개조부품', U: '고유', S: '합성 재료', K: '소모품', T: '포탑 장비' };
export function itemIcon(id: string | null, attrs = '', note = '', count = 1) { // note: 툴팁 덧붙임 (갓 구운 빵의 남은 전투 등) · count: 보관함에 겹친 같은 소모품 수
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
export function breadNote(run: RunState, i: number) {
  if (run.inventory[i] !== 'K_bread') return '';
  const left = R.breadLeft(run)[run.inventory.slice(0, i).filter((x) => x === 'K_bread').length];
  return `전투 ${left}회 뒤 식음${tierOf('CHEF', synergyCounts(deployed(run), run).CHEF || 0) >= CFG.chef.noStaleTier ? ' · 지금은 셰프 덕에 식지 않음' : ''}`;
}
/** 소모품 육각형 테두리 색: 전설급 = 전설 장비 색 · 셰프 = 셰프 시너지 색 · 합성품 = 신비학자 색 · 그 밖 (전투 보상 · 상점) 청록 */
export const consColor = (id: string) => (id === 'K_scope' ? SYN_BY_ID.NAV.color : isLegendConsumable(id) ? 'var(--g-L)' : id === 'K_bread_stale' ? '#8c8478' : CONSUMABLES[id]?.chef ? SYN_BY_ID.CHEF.color : CONSUMABLES[id]?.drop ? '#6fc3df' : SYN_BY_ID.OCCULT.color);
/** 등급색 대신 쓰는 카드 색 (--tc — 상인 진열 카드 윗띠 · 미니 카드 머리 · 표식): 소모품 = 그 소모품 색, 문장 = 그 시너지 색, 신비 부품 = 신비학자 색.
 *  나머지 (재료 · 고급 · 희귀 · 전설 부품) 는 빈 값 — 등급 클래스 tS/tC/tG/tA/tL 이 정한다 */
export const itemTone = (id: string) => (isConsumable(id) ? consColor(id) : isEmblem(id) ? SYN_BY_ID[emblemOf(id)]?.color : isOccultMod(id) ? SYN_BY_ID.OCCULT.color : '') || '';
/** 신비 개조부품 · 소모품 아이콘 */
export const SPECIAL_GLYPH: Record<string, string> = {
  O_reach: 'a.range', O_feast: 'a.heal', O_ward_phys: 'e.phys', O_ward_psy: 'e.psy', O_ward_chem: 'e.chem', O_ward_elec: 'e.elec', O_ward_holy: 'e.holy',
  O_mirror: 'a.shield', O_echo: 'a.cd', O_soul: 'a.dmg', O_aegis: 'r.hp', O_void: 'a.crit', O_abyss: 'e.psy', O_grail: 'a.heal', O_codex: 'a.power',
  K_rank: 'r.res', K_morph: 'a.summon', K_legend: 'a.power', K_copy: 'a.reload', K_strip: 'u.area', K_reroll: 'a.cd', K_xp: 'k.inj1', K_xp2: 'k.inj2', K_xp3: 'k.inj3',
  K_seize: 'k.seize', K_rank3: 'k.rank3', K_bread: 'k.bread', K_bread_stale: 'k.bread_stale',
  K_cp_purge: 'k.purge', K_cp_note: 'k.note', K_cp_tape: 'k.tape',
  K_barricade: 'k.barricade', K_decoy: 'k.decoy', K_mine: 'k.mine', K_net: 'k.net', K_scope: 'k.scope', K_feast: 'k.feast', K_muster_ticket: 'k.ticket',
  T_cal: 'a.dmg', T_plate: 'a.hp', T_cryo: 's.chrono', T_ammo: 'u.mag', T_barrier: 'a.shield', T_selfd: 'u.area', T_rapid: 'a.speed', T_tesla: 'e.elec', T_flame: 's.pyro', T_snipe: 'a.snipe', T_mark: 'u.target',
};
/** 잠재능력 별 (아이콘 아래 가운데, 열린 잠재능력마다 1개 · 빈 칸은 그리지 않는다) */
export const POT_PIP = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 .3l1.3 3.4L9.7 5 6.3 6.3 5 9.7 3.7 6.3.3 5l3.4-1.3z"/></svg>'; // 잠재능력 줄 (팝업): 네 모서리 별
export const POT_STAR = POT_PIP;
/** 제련 단계 칩 (팝업): 마름모 */
export const RF_GEM = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1l4 4-4 4-4-4z"/></svg>';
/** 합성 재료 아이콘 */
export const MAT_GLYPH: Record<string, string> = { S_dust: 'm.dust', S_shard: 'm.shard', S_crystal: 'm.crystal' };
/** 장비 아이콘: 재료 · 고급 = 메이저 아이콘, 희귀 · 전설 = 고유 아이콘, 문장 = 시너지 아이콘 */
export function itemGlyph(id: string) {
  if (isEmblem(id)) return synIcon(emblemOf(id), 'ii');
  if (isMod(id) || isConsumable(id) || isTurretGear(id)) return lineIcon(SPECIAL_GLYPH[id] || 'a.power', 'ii');
  if (id.startsWith('U_')) return lineIcon(`i.${id}`, 'ii');
  if (isMat(id)) return lineIcon(MAT_GLYPH[id] || 'm.dust', 'ii');
  if (id.startsWith('C_') || id.startsWith('G_')) return majorIcon(id.slice(2).split('+')[0] as Major, 'ii mi'); // 고급 모듈: 제련 단계 '+n' 은 떼고
  return lineIcon(`i.${refineBase(id).slice(2)}`, 'ii'); // 전설: 제련 단계 '+n' 은 떼고
}

/** 예상 이자 (상단 바 크레딧 · 투자 창구): 다음 전투를 마치면 받는 이자. R.interestInfo = 전투 정산(resolveBattle)과 같은 식 · 같은 상한 */
export function interestLines(r: RunState) {
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
export function topbar() {
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
    <div class="brand"><span class="brand-gx">ERRANTEs</span><span class="brand-mt"><span class="a">INFINITE</span><span class="b">METRO</span><span class="c">Express</span></span></div>
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
export function kingPill(r: RunState) {
  if (!r.causal && !kingOn(r)) return '';
  const st = causalStage(r.causal || 0), lf = causalLeft(r.causal || 0);
  return `<button class="pill king-pill" data-a="king-info" title="${esc(`공왕 무휼 · 누적 인과율 ${r.causal || 0}\n이긴 전투마다 (${CAUSAL.base} + 장비 점수 ÷ ${CAUSAL.gearDiv}) × 청라 단계 배율`)}">${lineIcon('a.power', 'li')}<span class="kp-tx">인과</span><b>${st}단계</b><span class="kp-next">${lf ? ` · 다음까지 ${lf}` : ' · 최고'}</span></button>`;
}
/** 시너지 토큰: 마름모 아이콘(누르면 상세) + 활성 단계 원 + 이름 · 구성 단계 (+ note: 목록의 보조 줄) */
export function synToken(id: string, c: number, extra = '', note = '') {
  const sd = SYN_BY_ID[id as SynergyId];
  const t = tierOf(sd.id, c);
  const steps = sd.tiers.map((need, i) => `<span class="${c >= need ? 'on' : ''}${i === t - 1 ? ' cur' : ''}">${need}</span>`).join('');
  return `<div class="syn-tk${t ? ' active' : ''}${extra}" style="--c:${sd.color}">
    <button class="syn-b" type="button" data-syn="${sd.id}" aria-label="${esc(sd.name)} 상세"><span class="syn-dia">${synIcon(sd.id) || sd.icon}</span><span class="syn-lv" title="출전 ${c}명">${c}</span></button>
    <span class="syn-tx"><b>${esc(sd.name)}</b><span class="syn-steps">${steps}</span>${note}</span></div>`;
}
/** 시너지 상세 팝업 (마름모를 누르면) */
export function synPopHtml(sid: string) {
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
export let synMore = false;
export function setSynMore(v: boolean) { synMore = v; }
export function synergyPanel(run: RunState) {
  const counts = synergyCounts(deployed(run), run);
  const benchN: Record<string, number> = {}; // 시너지별 대기 기물 수
  for (const u of run.units) if (!u.pos) for (const sid of memberships(u, run)) benchN[sid] = (benchN[sid] || 0) + 1;
  const list = synList(run).filter((s) => counts[s.id] || benchN[s.id])
    .sort((a, b) => tierOf(b.id, counts[b.id] || 0) - tierOf(a.id, counts[a.id] || 0) || (counts[b.id] || 0) - (counts[a.id] || 0));
  if (!list.length) return `<div class="muted small">출전한 기물이 없습니다.</div>`;
  return list.map((s) => synToken(s.id, counts[s.id] || 0, counts[s.id] ? '' : ' benchonly')).join('');
}
/** 화면 전환 연출: 전투 개시 · 보스전 · 페이즈 전환. 돌려주는 값 = 테마 연출이 화면을 다 덮었다가 걷히기 시작하는 때(ms, 그때 전투를 시작한다). 기본 배너면 0 */
export function banner(kind: 'battle' | 'boss' | 'phase' | 'adversity', title: string, sub = ''): number {
  document.querySelector('.banner')?.remove();
  const hold = TFX.banner(kind, title, sub); // 메트로 인피니티 패스: 노선색 패널 와이프 · 신호등 · 탑승권
  if (hold >= 0) return hold;
  const el = document.createElement('div');
  el.className = `banner bn-${kind}`;
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="bn-band"><span class="bn-line"></span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}<span class="bn-line"></span></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), kind === 'boss' ? 2300 : 1800);
  return 0;
}
/** 상세 능력치 창 (상세 보기 패널 바깥, 위치는 layoutPanels 가 잡는다) */
export function statPopHtml(run: RunState) {
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

export function equipSel(run: RunState, idx: number, uid: string): Sel {
  const e = R.equip(run, idx, uid);
  if (e) toast(e); else { toast('장착했습니다.'); persist(); }
  return { k: 'unit', uid };
}

/** 장비 설명의 메이저 능력치 이름을 아이콘으로 */
export const statIc = (html: string) => MAJORS.reduce((h, m) => h.split(MAJOR_NAME[m]).join(majorIcon(m)), html);
/** 장비 설명 말풍선 (짧게 누르기). 다음 누르기에 닫힌다. 색은 장비 등급 */
export function itemTip(el: HTMLElement, key: string) {
  document.querySelector('.item-tip')?.remove();
  const [uid, slot] = key.split(':');
  const u = app.run?.units.find((x) => x.uid === uid);
  const id = u ? (+slot < 0 ? u.mod : u.items[+slot]) : null;
  if (!id) return;
  const it = itemInfo(id);
  const tier = tierKey(id);
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
