// 타이틀 · 출격 연출 · 절망 증강 표시 · 난이도 · 기물 방출 (main.ts 에서 분리)
import { CFG } from '../config';
import { ENEMY_BY_ID } from '../data/enemies';
import { diffAddCount, diffAddRule, diffName } from '../data/difficulty';
import { DESPAIRS, despairDiff, despairsOf, type DespairDef } from '../data/despair';
import { fieldElites, fieldOf } from '../data/battlefields';
import { itemInfo } from '../data/items';
import { SYN_BY_ID, SYNERGIES } from '../data/synergies';
import { UNIT_BY_ID } from '../data/units';
import * as CTR from '../ui/contract';
import * as BRF from '../ui/briefing';
import { buildEnemy } from '../engine/build';
import { Battle } from '../engine/combat';
import * as R from '../engine/run';
import { Rng } from '../rng';
import { type Category, CATEGORY_NAME, CATEGORY_RULE, type Elem, ELEM_NAME, NODE_NAME, type RunState, type UnitState } from '../types';
import { fieldMatchup } from '../ui/matchup';
import { chapterOf as campChapter } from '../data/campaign';
import { fmt } from '../ui/battleview';
import { listSaves, loadRun, SLOT_NAME } from '../ui/save';
import { loadMeta, tutMeta } from '../ui/meta';
import { artURL, bgURL } from '../ui/portraits';
import * as OATH from '../ui/oath';
import { lineIcon, synIcon } from '../ui/synicons';
import * as TUT from '../engine/tutorial';
import { fieldSyn, starterFavNeed } from '../engine/starters';
import * as LAB from '../ui/lab';
import { CAMP_SLOT, FS_SVG, app, canFullscreen, esc, isFullscreen, uiTheme } from './state';
import { NODE_ICON, chip, itemIcon, sprite, synToken } from './common';
import { enemyCategory, pickCard, teamCount } from './unitparts';
import { CR, RES, ic, unitRank } from './map';
import { enemyAbilCards, enemyAbilPop, foeGear, tchip } from './abilities';
import { battleMajors, foeAmp, foeHead, majorsHtml } from './battle';
import { listTutSave } from './tutorial';

// ───────────────────────── 화면: 타이틀
export function titleScreen() {
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
      <div class="ts-body"><div class="ts-left">
      <nav class="title-actions" aria-label="메뉴">
        <div class="ts-main">${auto ? `<button class="btn primary ts-btn ts-hero" data-a="load" data-v="auto"><b>이어하기</b><small>페이즈 ${auto.phase} · 체력 ${auto.hp}</small></button>` : ''}
          <div class="ts-split one"><button class="btn ${auto ? '' : 'primary ts-hero'} ts-btn" data-a="newrun"><b>새 계약</b>${auto ? '<small>진행 중인 의뢰는 덮어씁니다</small>' : `<small>바 카운터 · 의뢰 · 약관 · 계약 기물 ${CFG.startUnits}명</small>`}</button></div></div>
        <div class="ts-grid" role="group" aria-label="둘러보기">${tutButton()}
          <button class="btn ts-btn ts-tile" data-a="bar"><b>에란테스 바</b><small>${auto ? '들렀다가 이어서 출격' : '단원 · 손님들의 잡담'}</small></button>
          <button class="btn ts-btn ts-tile" data-a="codex"><b>도감 · 기록</b><small>교범 · 기록 · 업적</small></button>
          <button class="btn ts-btn ts-tile ts-oath" data-a="oath"><b>절망 서약</b><small>${diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`} 조건 · 절망 ${OATH.heatNow()}${OATH.effNow() > CFG.oathFrom ? ` (위험 ${OATH.effNow()})` : ''}</small></button>
          ${(() => { const ls = LAB.labSaveInfo(); return `<button class="btn ts-btn ts-tile ts-lab" data-a="lab-enter"><b>에란테스 훈련장</b><small>${ls ? `이어서 · ${ls.step + 1}/${ls.len}칸` : '기물 · 장비 · 적을 불러 시험하는 실험실'}</small></button>`; })()}</div>
        <div class="ts-util" role="group" aria-label="저장 · 설정">${listTutSave() ? '<button class="btn ghost tiny" data-a="tutorial-restart">튜토리얼 처음부터</button>' : ''}<button class="btn ghost tiny" data-a="menu-import">저장 코드 불러오기</button><button class="btn ghost tiny" data-a="menu-tab" data-v="settings">설정 · 테마</button>${canFullscreen() ? `<button class="btn ghost tiny" data-a="fullscreen" title="전체 화면 (주소창 · 상태 표시줄 숨김)">${FS_SVG(isFullscreen())} ${isFullscreen() ? '전체 화면 끄기' : '전체 화면'}</button>` : ''}</div>
      </nav>
      ${slots.length ? `<div class="slots">${slots.map((s) => `<button class="btn ghost" data-a="load" data-v="${s.slot}">${SLOT_NAME[s.slot]} · 페이즈 ${s.phase} · 기물 ${s.units}</button>`).join('')}</div>` : ''}
      ${m.runs ? `<p class="ts-meta"><span>의뢰 <b>${m.runs}</b></span><span>성공 <b>${m.clears}</b></span><span>위험 등급 <b>${m.maxDiff}</b></span></p>` : ''}
      </div>
      ${(() => { const cs = loadRun(CAMP_SLOT); const go = cs?.campaign && !cs.over; return `<button class="btn ts-btn ts-campaign" data-a="campaign"><span class="ts-cp-kick">CAMPAIGN · 회수 계약</span><b>캠페인</b><small>${go ? `이어서 · ${esc(campChapter(cs!).name)} ${Math.min(cs!.step + 1, cs!.map.length)}/${cs!.map.length} · AH ${cs!.campaign!.time}` : '베르타–산노디스 물류망 · 라르스의 의뢰 · 1장 TS-7 환적 정거장'}</small><span class="ts-soon">1부 · 4장 완결</span></button>`; })()}
      </div>
    </div>
    <p class="ts-foot">싱글 PvE · 오프라인 플레이 · 진행은 이 브라우저에 자동 저장됩니다.</p>
    ${app.tutAsk ? tutAskModal() : ''}
  </main>`;
}
/** 타이틀: 튜토리얼 칸 (끝내기 전에는 NEW, 진행 중이면 이어서 — '처음부터'는 아래 보조 줄) */
export function tutButton() {
  const saved = listTutSave();
  return `<button class="btn ts-btn ts-tile ts-tut" data-a="tutorial" title="튜토리얼 — 당직 근무: 새벽 2시, 에란테스 바에서 지휘를 배운다"><b>튜토리얼</b>${saved ? `<small>이어서 · 항로 ${Math.min(saved.step + 1, TUT.TUT_MAP.length)}/${TUT.TUT_MAP.length}칸</small>` : '<small>당직 근무 · 지휘 배우기</small>'}${tutMeta().done ? '' : '<span class="ts-new">NEW</span>'}</button>`;
}
/** 첫 실행: 튜토리얼부터 / 건너뛰기 */
export function tutAskModal() {
  const d = UNIT_BY_ID.aiden;
  return `<div class="modal-bg"><div class="modal tut-ask" role="dialog" aria-label="튜토리얼 안내">
    <div class="ta-head">${d ? sprite(d, 'spr') : ''}<div><h1>처음 오셨군요</h1><p class="muted small">에이든 · 에란테스 바텐더</p></div></div>
    <p>지휘가 처음이시라면 튜토리얼 「당직 근무」부터 권합니다. 20분쯤 걸리고, 지는 일은 없습니다. 배운 용어는 도감의 교범 탭에 남습니다.</p>
    <p class="muted small">건너뛰면 교범이 모두 열리고, 튜토리얼은 타이틀에서 언제든 다시 할 수 있습니다.</p>
    <div class="row-btns"><button class="btn primary" data-a="tutorial">튜토리얼부터</button><button class="btn" data-a="tut-ask-skip">건너뛰기</button><button class="btn ghost" data-a="tut-ask-close">닫기</button></div>
  </div></div>`;
}

// ───────────────────────── 출격 연출: 전장 추첨 → 난이도 → 계약 기물
/** 전장 상성 요약 (적 풀 · 분류 규칙에서 자동 집계): 편성 화면 '상성'과 같은 토큰 줄 (분류 아이콘 · 이름 · 비중 · 취약(초록) / 저항(빨강) / 면역 칩). head = 머리 글씨 */
export function matchupHtml(fid: string, head = true) {
  const mu = fieldMatchup(fid);
  const rows = [
    ...mu.cats.map((x) => muRow(lineIcon(`k.${x.c}`, 'li'), CATEGORY_NAME[x.c], `${Math.round(x.share * 100)}%`, muTags(x), `cat-${x.c}`, '', `${CATEGORY_NAME[x.c]}: ${CATEGORY_RULE[x.c]} (적 풀 비중)`)),
    mu.bosses ? muRow(NODE_ICON.boss, NODE_NAME.boss, '', muTag(`${mu.bossImmune.join('·')} 면역`, 'mute'), '', '--c:var(--c-bad)') : '',
  ].join('');
  return rows ? `<div class="mu-box">${head ? '<span class="mu-k">이 전장의 주요 적</span>' : ''}<ul class="pb-rows">${rows}</ul></div>` : '';
}
/** 영입 · 전공 창 머리용 한 줄 (문장 대신 표식): 주요 적 분류 = 아이콘 · 이름 · 비중, 그 옆에 취약(초록) · 저항(빨강) 속성 아이콘 칩 · 면역 칩, 보스 = 공통 면역 칩 */
export function matchupChips(fid: string) {
  const mu = fieldMatchup(fid);
  const el = (names: string[]) => names.map((n) => { const k = (Object.keys(ELEM_NAME) as Elem[]).find((e) => ELEM_NAME[e] === n); return k ? lineIcon(`e.${k}`, 'li') : ''; }).join('');
  const cats = mu.cats.map((x) => `<span class="mu-c cat-${x.c}" title="${esc(`${CATEGORY_NAME[x.c]}: ${CATEGORY_RULE[x.c]} (적 풀 비중)`)}">${lineIcon(`k.${x.c}`, 'li')}${CATEGORY_NAME[x.c]}<b>${Math.round(x.share * 100)}%</b></span>`
    + (x.weak.length ? tchip(el(x.weak), '취약', 'good', `${x.weak.join('·')} 취약`) : '') + (x.resist.length ? tchip(el(x.resist), '저항', 'bad', `${x.resist.join('·')} 저항`) : '')
    + (x.immune.length ? tchip('', `${esc(x.immune.join('·'))} 면역`, 'mute') : '')).join('');
  const boss = mu.bosses ? `<span class="mu-c boss" title="보스 공통 면역">${NODE_ICON.boss}${NODE_NAME.boss}</span>${tchip('', `${esc(mu.bossImmune.join('·'))} 면역`, 'mute')}` : '';
  return cats || boss ? `<div class="mu-chips"><small>주요 적</small>${cats}${boss}</div>` : '';
}
/** 상성 토큰 줄 (편성 화면 '상성' · 전장 상세 공용): 아이콘 · 이름 · 인원(비중) · 칩들 */
export function muRow(icon: string, name: string, cnt: string, tags: string, cls = '', st = '', title = '') {
  return `<li class="pb-row"${title ? ` title="${esc(title)}"` : ''}><i class="pb-ri ${cls}"${st ? ` style="${st}"` : ''}>${icon}</i><b>${esc(name)}</b><span class="pb-cnt">${cnt}</span><span class="pb-tags">${tags}</span></li>`;
}
export const muTag = (txt: string, tone: 'good' | 'bad' | 'mute') => tchip('', esc(txt), tone);
/** 분류 하나의 취약 · 저항 · 면역 칩 */
export const muTags = (x: { weak: string[]; resist: string[]; immune: string[] }) => [x.weak.length ? muTag(`${x.weak.join('·')} 취약`, 'good') : '', x.resist.length ? muTag(`${x.resist.join('·')} 저항`, 'bad') : '', x.immune.length ? muTag(`${x.immune.join('·')} 면역`, 'mute') : ''].join('');
/** 전장 정보: 적 유형 · 우세 속성 · 우세 시너지 */
export function fieldBrief(fid: string) {
  const f = fieldOf(fid);
  const roster = [...f.pool.map((id) => [id, 1] as const), ...fieldElites(f).map((id) => [id, 2 / fieldElites(f).length] as const), ...f.bosses.map((id) => [id, 3] as const)];
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
  <div class="fb-foes">${[...f.bosses, ...fieldElites(f), ...f.pool].map((id) => {
    const e = ENEMY_BY_ID[id];
    if (!e) return '';
    const tag = e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '';
    return `<button class="fb-foe-ic tier-${e.tier}" data-a="intro-foe" data-v="${id}" title="${esc(e.name)}">${sprite(e, '')}${tag ? `<em>${tag}</em>` : ''}<i>${esc(e.name)}</i></button>`;
  }).join('')}</div>`;
}
/** 명부 머리 띠 위 전장 정보: 자주 나오는 적 (분류 · 얼굴) · 유리한 시너지 (후보 보장 수). 전장 그림 위에 얹는다 */
export function fieldBandInfo(fid: string) {
  const f = fieldOf(fid), ct: Record<string, number> = {};
  for (const [id, w] of [...f.pool.map((id) => [id, 1] as const), ...fieldElites(f).map((id) => [id, 2 / fieldElites(f).length] as const)]) { const e = ENEMY_BY_ID[id]; if (e) ct[enemyCategory(e)] = (ct[enemyCategory(e)] || 0) + w; }
  const cats = Object.entries(ct).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0] as Category);
  const faces = f.pool.slice(0, 4).map((id) => ENEMY_BY_ID[id]).filter(Boolean).map((e) => `<i class="nr-bi-face" title="${esc(e.name)}">${sprite(e, '')}</i>`).join('');
  const syn = fieldSyn(fid), k = starterFavNeed(fid);
  return `<div class="nr-bi-row"><span class="nr-bi-k">자주 나오는 적</span><span class="nr-bi-v">${cats.map((c) => `<i class="nr-bi-cat cat-${c}" title="${esc(CATEGORY_RULE[c])}">${lineIcon(`k.${c}`, 'li')}${CATEGORY_NAME[c]}</i>`).join('')}${faces}</span></div>
    ${syn ? `<div class="nr-bi-row"><span class="nr-bi-k">유리한 시너지</span><span class="nr-bi-v">${chip(syn)}${k ? `<span class="nr-bi-n" title="${esc(`우세 시너지 기물이 후보에 ${k}명 이상 섞여 있습니다`)}">후보 <b>${k}명+</b></span>` : ''}</span></div>` : ''}`;
}
/** 전장 브리핑: 적 초상화를 누르면 1페이즈 기준 상세 (능력 카드 · 설명) */
export function foeModal(id: string) {
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
/** 특권 커튼 연출을 이미 보여 준 런 (시드) */
export let pvPlayed: number | null = null;
export function setPvPlayed(v: number | null) { pvPlayed = v; }
/** 절망 증강 막을 이미 보여 준 선택 (시드:이미 고른 수) */
export let dpPlayed: string | null = null;
export function setDpPlayed(v: string | null) { dpPlayed = v; }

export function newRunScreen() {
  const n = app.starters.length, sc = CTR.signedContract();
  const fld = fieldOf(app.introField);
  CTR.takeFromSeal();
  // 전장 그림 = 화면 위쪽을 가로지르는 배경 (브리핑 수신 중에는 화면을 채운 태블릿 속, 끝나면 높이가 줄어 이 자리에 내려앉는다 · ui/briefing.ts)
  const title = sc ? sc.contract.title : fld.name;
  return `<main class="wrap nr roster${BRF.BR.on ? ' brief' : ''}">
    ${BRF.bandHtml({ art: bgURL(`field_${fld.id}`), color: fld.color, title, place: fld.name })}
    <div class="nr-head">
      <div class="nr-title"><h2 class="nr-band-t nr-field">「${esc(title)}」 <small>${esc(fld.name)}</small></h2><h1>계약 기물 ${CFG.startUnits}명을 선택하세요</h1></div>
      <div class="nr-side"><div class="nr-band-info">${fieldBandInfo(fld.id)}</div></div>
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
      <button class="btn ghost" data-a="ct-back" title="차림표로 돌아가 의뢰 · 약관을 다시 고릅니다 (서명은 무릅니다)">뒤로</button>
      <button class="btn ghost" data-a="random-starters">무작위</button>
      <button class="btn ghost" data-a="reroll-starters" title="고른 기물을 모두 해제하고 후보 ${app.pool.length}명을 새로 뽑습니다. 직전 후보와 겹치지 않게 뽑고, 우세 시너지 기물 보장은 그대로입니다 (단축키 R)" ${app.poolRerolls > 0 ? '' : 'disabled'}>새로고침 (${app.poolRerolls}회)</button>
      <button class="btn primary" data-a="start-run" ${n === CFG.startUnits ? '' : 'disabled'}>출격 (${n}/${CFG.startUnits})</button>
    </div>
  </main>`;
}


// ───────────────────────── 절망 증강 표시 (여러 개가 쌓일 수 있다, data/despair.ts)
/** 상단 바: 1개면 아이콘 + 이름, 여러 개면 아이콘을 나란히 + '절망 n' (좁은 화면은 아이콘만). 누르면 설명 */
export function despairPill(r: RunState) {
  const ds = despairsOf(r);
  if (!ds.length) return '';
  const tip = `절망 증강 ${ds.length}개\n${ds.map((d) => `[${d.name}] ${d.desc()}`).join('\n')}`;
  return `<button class="pill despair" data-a="despair-info" title="${esc(tip)}"><span class="dp-ics">${ds.map((d) => lineIcon(d.icon, 'li')).join('')}</span><b>${ds.length === 1 ? esc(ds[0].name) : `절망 ${ds.length}`}</b></button>`;
}
/** 지도 환경 탭: 고른 순서대로 이름 · 효과, 고난이면 다음에 더 고르는 페이즈 */
export function despairEnv(run: RunState) {
  const ds = despairsOf(run);
  const ev = OATH.despairEvery(run), nx = despairDiff(run.diff) ? Math.ceil((run.phase + 1) / ev) * ev : 0; // 간격: 심연의 서약이면 짧다
  const next = nx && (nx <= CFG.victoryPhase || run.endless) && DESPAIRS.length > ds.length ? nx : 0; // 의뢰 페이즈 밖(무한 모드 전)이거나 남은 증강이 없으면 표시 안 함
  if (!ds.length && !next) return '';
  const nextTxt = next ? `<li class="dp-next muted small">다음 절망 증강: ${next}페이즈 시작 때 1개 더</li>` : '';
  return `<h2>절망 증강${ds.length > 1 ? ` <span class="muted small">${ds.length}개</span>` : ''}</h2><ul class="globals despair">${ds.map((d: DespairDef) => `<li>${lineIcon(d.icon, 'li')}<b>${esc(d.name)}</b> <span class="muted">${ic(esc(d.desc()))}</span></li>`).join('')}${nextTxt}</ul>`;
}
/** 결과 문구: '[반려 돌] · [오버클럭]' */
export const despairNames = (run: RunState) => despairsOf(run).map((d) => `[${esc(d.name)}]`).join(' · ');

// ───────────────────────── 난이도 선택
/** 위험 등급 적 증원 칩 (지도 미리보기 · 편성 적 구성): 그 페이즈 전투에 더해지는 적 수. n 을 주면 조우에 실제로 더한 수 (보드 칸 상한 반영) */
export function diffAddChip(run: RunState, phase: number, n = diffAddCount(run.diff, phase)) {
  return n > 0 ? tchip('', `적 +${n}`, 'bad', `위험 등급 ${run.diff} 적 증원: ${diffAddRule(run.diff)} — 페이즈 ${phase} 전투마다 적 +${n}`) : '';
}

// ───────────────────────── 기물 방출
/** 방출 정산: 이름 + 값 줄 (크레딧 · 공명도 분배 · 장비 행방 · 사라지는 고유 장비) */
function releaseRows(run: RunState, u: UnitState): [string, string, string?][] {
  if (R.isRock(u)) return [['보상', '없음'], ['다시 등장', '절망 증강이 있으면 영입 선택지에']];
  const v = R.releaseValue(run, u);
  return [
    [`${CR}크레딧`, `+${v.credits}`, 'good'],
    [`${RES}공명도 분배`, `${v.xp} (${Math.round(CFG.release.xpShare * 100)}%)`],
    ['장비 · 개조부품', v.items.length ? `보관함으로 ${v.items.length}개` : '없음'],
    ...(v.lost.length ? [['고유 장비', `사라짐 · ${v.lost.map((x) => esc(itemInfo(x).name)).join(', ')}`, 'bad'] as [string, string, string]] : []),
  ];
}
/** 방출 확인 창: 탑승권을 찢는 표 (머리 = 이름 · 되돌릴 수 없음 / 절취선 / 몸통 = 정산 줄 · 그만두기 · 방출하기). 방출하기를 누르면 표가 절취선에서 찢어진 뒤 실행된다 (main.ts release-confirm) */
export function releasePop(run: RunState, u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  const id = `tear-t-${u.uid}`;
  return `<div class="tear-scrim" data-a="release-cancel"></div>
  <div class="tear-tk" role="dialog" aria-modal="true" aria-labelledby="${id}">
    <div class="tear-a"><span class="tear-face" aria-hidden="true">${sprite(d, 'spr big')}</span>
      <div class="tear-hd"><span class="tear-k"><b>RELEASE</b><i></i><span>CAN NOT UNDO</span></span><h3 id="${id}">${esc(d.name)}을(를) 방출할까요?</h3><span class="tear-sub">방출한 기물은 되돌릴 수 없습니다.</span></div>
      <button class="btn tear-x" data-a="release-cancel" aria-label="닫기" title="닫기 (Esc)">✕</button></div>
    <div class="tear-perf" aria-hidden="true"></div>
    <div class="tear-b"><dl class="tear-rows">${releaseRows(run, u).map(([k, val, c]) => `<div${c ? ` class="${c}"` : ''}><dt>${k}</dt><dd>${val}</dd></div>`).join('')}</dl>
      <div class="tear-act"><button class="btn ghost" data-a="release-cancel">그만두기</button><button class="btn danger" data-a="release-confirm" data-v="${u.uid}">방출하기</button></div></div>
  </div>`;
}
/** 기물 상세 패널 아래 방출 칸: 정산 요약 줄 + 방출하기 (누르면 방출 확인 창) */
export function releaseBlock(run: RunState, u: UnitState) {
  return `<div class="release">
    <h3>방출</h3>
    <dl class="tear-rows small">${releaseRows(run, u).map(([k, val, c]) => `<div${c ? ` class="${c}"` : ''}><dt>${k}</dt><dd>${val}</dd></div>`).join('')}</dl>
    <button class="btn small" data-a="release" data-v="${u.uid}" ${run.units.length <= 1 ? 'disabled title="마지막 남은 기물은 방출할 수 없습니다"' : ''}>방출하기</button>
  </div>`;
}
/** 방출 확인 창은 화면 최상위에 그린다 (상세 창 · 패널 안에 두면 변형된 조상 때문에 고정 위치가 어긋난다) */
export function releaseModal(run: RunState) {
  const u = app.releaseConfirm ? run.units.find((x) => x.uid === app.releaseConfirm) : null;
  return u ? releasePop(run, u) : '';
}
