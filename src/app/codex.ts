// 도감 (main.ts 에서 분리)
import { CFG } from '../config';
import { ENEMIES, ENEMY_BY_ID } from '../data/enemies';
import { ENEMY_DESC } from '../data/enemyText';
import { diffLabel, diffName } from '../data/difficulty';
import { DESPAIRS } from '../data/despair';
import { EVENTS } from '../data/events';
import { STORIES } from '../data/stories';
import { FIELDS, fieldElites } from '../data/battlefields';
import { itemInfo } from '../data/items';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, type UnitDef } from '../data/units';
import * as CX2 from '../ui/codex2';
import * as BAR from '../ui/bar';
import * as ACH from '../ui/achieve';
import { buildAlly } from '../engine/build';
import { Battle } from '../engine/combat';
import { Rng } from '../rng';
import { CTYPE_NAME, MAJOR_NAME, TTYPE_NAME, MAJORS, type RunState, type SynergyId, type UnitState } from '../types';
import { loadMeta } from '../ui/meta';
import { standImg } from '../ui/portraits';
import * as OATH from '../ui/oath';
import { lineIcon, synIcon, typeIcon } from '../ui/synicons';
import { app, esc } from './state';
import { augIcon, itemIcon, majorIcon, sprite, statIc } from './common';
import { detailToggle, faithAbil, relicTok, traitGroup, ttSection } from './unitparts';
import { enemyMoveRule } from './prep';
import { abTok, abilPopHtml, powRow, relicSection, skillCard, sumScope, summonSection, ultCard, unitSummary, voyAbil, weaponCard } from './abilities';
import { tendText } from './battle';
import { recoKeys } from './modals';
import { codexManual } from './tutorial';

// ───────────────────────── 도감
export let cxScroll = false;
export function setCxScroll(v: boolean) { cxScroll = v; }
/** 도감 그림 조각 (codex2.ts 로 넘김) */
export const cxH = (): CX2.CxH => ({ itemIcon, augIcon, sprite: (d) => sprite(d), abTok, statIc, relicTok: (id) => relicTok(id), majorIcon: (m) => majorIcon(m), bust: (id) => standImg(id, 'cx-bust', true), typeIcon });
/** 도감 · 기물: 초상화 카드 목록 (묶기 · 정렬 · 검색은 codex2.ts) + 고른 기물의 큰 일러스트 · 요약 · 능력 · 시너지 */
export function codexUnits(m: ReturnType<typeof loadMeta>) {
  const known = (d: UnitDef) => !d.eventOnly || !!d.king || !!m.units[d.id]; // 공왕 무휼은 늘 공개 (청라공국 시너지 설명의 일부)
  const { html, first } = CX2.unitsList(cxH(), { group: app.codexGroup, sel: app.codexSel, known });
  const d = UNIT_BY_ID[app.codexSel || first || ''];
  const detail = d && known(d) ? codexDetail(d, m) : `<div class="cx-empty muted small">기물을 고르면 시너지 · 능력 · 역할군 · 추천 장비 · 이야기를 볼 수 있습니다.</div>`;
  return CX2.cxWrap('cx-units', html, detail, app.codexSel ? `data-a="codex-sel" data-v="${esc(app.codexSel)}"` : null);
}
export function codexDetail(d: UnitDef, m: ReturnType<typeof loadMeta>) {
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
export function codexScreen() {
  const m = loadMeta();
  // 탭: 자료 (기물 · 시너지 · 장비 · 증강 · 사이오닉 · 세계관) | 기록 (적 · 사건 · 교범 · 기록)
  const tb = ([k, l]: readonly [string, string]) => `<button class="cx-tab${app.codexTab === k ? ' on' : ''}" data-a="codex-tab" data-v="${k}" aria-pressed="${app.codexTab === k}">${l}</button>`;
  const tabs = `<div class="cx-tg">${([['units', '기물'], ...CX2.CX2_TABS] as const).map(tb).join('')}</div><div class="cx-tg cx-tg2">${([['enemies', '적'], ['events', '사건'], ['manual', '교범'], ['records', '기록'], ['ach', '업적']] as const).map(tb).join('')}</div>`;
  let body = '';
  if (app.codexTab === 'units') {
    body = codexUnits(m);
  } else if (app.codexTab === 'enemies') {
    body = FIELDS.map((f) => {
      const ids = [...f.pool, ...fieldElites(f), ...f.bosses];
      return `<h2 style="color:${f.color}">${f.icon} ${esc(f.name)}</h2><div class="codex-list">${ids.map((id) => {
        const e = ENEMY_BY_ID[id];
        const r = m.enemies[id];
        return `<div class="codex-row ${r ? '' : 'unknown'}">${sprite(e)}<div><b>${r ? esc(e.name) : '???'}</b> <span class="muted small">${e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '일반'}</span>
          <div class="small">${r ? esc(ENEMY_DESC[id] || '') : '아직 만나지 못했습니다.'}</div>${r ? `<div class="small muted">${esc(tendText(e))}</div>${e.immobile ? '' : `<div class="small muted">${esc(enemyMoveRule(e))}</div>`}` : ''}</div><div class="small mono">조우 ${r?.seen || 0}<br>처치 ${r?.kills || 0}</div></div>`;
      }).join('')}</div>`;
    }).join('') + (() => { const extra = ENEMIES.filter((e) => !FIELDS.some((f) => [...f.pool, ...fieldElites(f), ...f.bosses].includes(e.id)) && m.enemies[e.id]); return extra.length ? `<h2>기타</h2><div class="codex-list">${extra.map((e) => `<div class="codex-row">${sprite(e)}<div><b>${esc(e.name)}</b></div><div class="small mono">처치 ${m.enemies[e.id].kills}</div></div>`).join('')}</div>` : ''; })();
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
