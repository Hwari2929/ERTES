// 기물 정보 조각: 유형 아이콘 · 전술 유형 규칙 · 성유물 · 능력 블록 · 기물 카드 · 후보 카드 (main.ts 에서 분리)
import { CFG, psiAugRanks } from '../config';
import { AUG_BY_ID, augDesc } from '../data/augments';
import { type EnemyDef } from '../data/enemies';
import { tierKey, itemInfo } from '../data/items';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, type UnitDef } from '../data/units';
import { FAITH_DEF, MINOR_TRAIT_GROW } from '../data/rework';
import { cantripView, passiveView, SCHOOL_LINE } from '../data/psiinfo';
import { GROUPS, SCHOOL_BY_ID, SCHOOL_PASSIVES, UNIT_GROUP, augMark, psiAugId, schoolOf, type SchoolId } from '../data/schools';
import { BRIEF, unitBlurb } from '../data/brief';
import { ABIL } from '../data/abiltext';
import * as AB from '../ui/abil';
import { memberships } from '../engine/build';
import { Battle, type CUnit, fleeShort, zocHoldFormula, zocRows, zocRule } from '../engine/combat';
import * as R from '../engine/run';
import { type Category, CATEGORY_NAME, CATEGORY_RULE, categoryOf, type CType, type TType, type Weapon, CTYPE_NAME, ELEM_NAME, FAITH_NAME, MAJOR_NAME, TTYPE_NAME, MAJORS, type Pending, type RunState, type SupplyCard, type SynergyId, type UnitState } from '../types';
import { schoolWarnings } from '../ui/matchup';
import { RELIC_BY_ID, offerMul, offerNeed, offerStage, offerStat } from '../data/relics';
import { recMajors } from '../data/rework';
import { standImg } from '../ui/portraits';
import { lineIcon, typeIcon } from '../ui/synicons';
import { app, esc, jackpotTxt, jpClass } from './state';
import { augIcon, chip, hero, itemIcon, majorIcon, rankPips, sprite, statIc, synToken } from './common';
import { CR, RES } from './map';
import { MAX_SVG, abTok, abilOn, actx, augText, psiCd, psiTfTag, traitHtml } from './abilities';

// ───────────────────────── 화면: 시작 기물 선택
/** 영입 카드용: 이 시너지를 가진 보유 기물 수 (출전 + 대기, 같은 기물은 1회) → 영입 후 */
export function ownedChip(defId: string) {
  return (id: string) => {
    const run = app.run;
    if (!run) return chip(id);
    const owners = new Set(run.units.filter((u) => memberships(u).includes(id as SynergyId)).map((u) => u.defId));
    const n = owners.size, after = owners.has(defId) ? n : n + 1;
    return n ? chip(id).replace('</span>', ` <b class="own" title="보유 중인 ${esc(SYN_BY_ID[id as keyof typeof SYN_BY_ID].name)} 기물 ${n}명">${n}→${after}</b></span>`) : chip(id);
  };
}
export const CTYPE_ICON = (k: string) => typeIcon(k);
export const TTYPE_ICON = (k: string) => typeIcon(k);
export const WPOS = (r: number) => (r <= 1 ? '근거리' : r <= 3 ? '중거리' : '원거리');
/** 이름 옆 유형 아이콘 (설명은 특성 아래) */
export function typeIcons(d: UnitDef) {
  return `<span class="ticons"><i class="ct-${d.ctype}" title="전투 유형: ${CTYPE_NAME[d.ctype]}">${CTYPE_ICON(d.ctype)}</i><i class="tt-${d.ttype}" title="전술 유형: ${TTYPE_NAME[d.ttype]}">${TTYPE_ICON(d.ttype)}</i></span>`;
}
/** 이름 + 유형 아이콘, 그 아래 시너지 · 공명 등급 */
export function nameBlock(d: UnitDef, syns: string[], rank: number | undefined, chipFn: (id: string) => string = chip, extra = '') {
  return `<div class="nb"><div class="nb-name"><b>${esc(d.name)}</b>${typeIcons(d)}</div>
    <div class="chips nb-syn">${rank ? rankPips(rank) : ''}${syns.map(chipFn).join('')}</div>${extra}</div>`;
}
/** 전투 유형 상세 설명 끝에 붙는 도주 규칙 (CFG.flee.ctypes 에 든 유형만) */
export const fleeLine = (c: CType) => (CFG.flee.ctypes.includes(c) ? ` ${fleeShort()}.` : '');
export const CTYPE_DESC: Record<string, [string, string]> = {
  MARK: [`사격으로 싸운다. 1초마다 사거리 안에서 체력 비율이 가장 낮은 적을 다시 노린다. 사격 위력 · 공격 속도 · 재장전 · 명중 · 치명타가 중요하다.`, `마무리 사격: 1초마다 사거리 안에서 체력 비율이 가장 낮은 적으로 대상을 바꾼다. 주력: 사격 위력, 사격 속도, 재장전 속도, 명중, 치명 확률 · 피해. 탄창을 다 쓰면 재장전하는 동안 기본 공격을 못 한다 (스킬은 가능).${fleeLine('MARK')}`],
  VAN: [`근접 타격으로 싸운다. 타격 위력 · 콤보와 피니쉬 · 치명타가 중요하다. 주변 ${CFG.zoc.r}칸은 경계 — 들어온 적이 ${zocHoldFormula()} 멈춰 선다 (암살형은 ×${+CFG.zoc.assassinMul.toFixed(2)}).`, `주력: 타격 위력, 타격 속도, 명중, 콤보 · 피니쉬 피해량, 치명 확률 · 피해. 무기별 N번째 공격이 피니쉬 (×${CFG.finishMult}). ${zocRule()}`],
  SPEC: ['기술로 싸운다. 기술 위력 · 효과 명중 · 쿨다운이 중요하다.', `주력: 기술 위력, 효과 명중, 쿨다운 감소 속도, 기술 범위. 기술 피해는 치명타가 없다 (일부 특성 예외).${fleeLine('SPEC')}`],
  CMD: ['아군이 함께 쓰는 전술 위력으로 스킬을 쓴다. 출전 인원이 많을수록, 지휘관이 많고 정신력이 높을수록 강하다.', `스킬은 전술 위력으로 계산한다. 전술 위력 = ${CFG.tacBase - CFG.tacPerCmd} + 출전 기물 1명당 ${CFG.tacPerUnit} (4명 기준) + 지휘관마다 (${CFG.tacPerCmd} + 정신력 × ${CFG.tacPerMnd}) 을 높은 순으로 100% · ${Math.round(CFG.tacDecay * 100)}% · ${Math.round(CFG.tacDecay ** 2 * 100)}% … 더한 값.${fleeLine('CMD')}`],
};
/** 전투 유형 공통 규칙 본문: 돌격가는 이름 + 값 표 (주력 · 피니쉬 · 경계), 나머지는 문장 */
export function ctypeRuleHtml(ct: string, detail: boolean) {
  if (ct !== 'VAN') return `<p>${esc(CTYPE_DESC[ct]?.[detail ? 1 : 0] || '')}</p>`;
  const rows: [string, string][] = [
    ['주력', detail ? '타격 위력 · 타격 속도 · 명중 · 콤보 · 피니쉬 피해량 · 치명 확률 · 치명 피해' : '타격 위력 · 콤보와 피니쉬 · 치명타'],
    ['피니쉬', `무기별 N번째 공격 · 피해 ×${CFG.finishMult}`],
    ...(detail ? zocRows() : zocRows().filter(([k]) => k === '경계 범위' || k === '교전 시간' || k === '암살형 적')),
  ];
  return `<dl class="um-types ct-rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** 전술 유형 공통 규칙: 공명 등급마다 모든 능력치 +1, 이정표 보상은 유형별 */
export const RANK_ALL = `공명 등급마다 모든 주요 능력치 +${CFG.rankAll}.`, PSI_RANKS = psiAugRanks();
export const TTYPE_RULE: Record<TType, string> = {
  major: `${RANK_ALL} ${CFG.augEvery}등급마다 기물 전용 증강 1개 (최대 ${CFG.majorAugMax}개, 일반 12 · ★ 전설 2 중에서). 고유 궁극기는 시간이 지나면 저절로 차오르고 (기본 약 ${Math.round(CFG.ultTime * CFG.ultNeed)}초, 전투 시작 ${Math.round(CFG.ultStart * 100)}%), 기본 공격 · 전투 스킬 · 피격 때도 조금씩 찬다. 한 전투에 여러 번 쓸 수 있다.`,
  minor: `${RANK_ALL} ${CFG.statEvery}등급마다 주요 능력치 ${CFG.rankPicks}종 +${CFG.rankPoints}. 기술 계수와 특성 수치가 등급에 따라 자란다 (10등급 ×${CFG.minorGrow(10)}, 20등급 ×${CFG.minorGrow(20)}).`,
  special: `${RANK_ALL} ${CFG.augEvery}등급마다 기물 전용 증강 1개 (최대 ${CFG.majorAugMax}개).`,
  psionic: `${RANK_ALL} 기물마다 학파가 정해져 있고, 합류할 때 그 학파의 전공을 고른다 (비술 + 지속 능력). ${PSI_RANKS.join(' · ')}등급에 전공 증강 (최대 ${CFG.psiAugMax}개, ${PSI_RANKS[PSI_RANKS.length - 1]}등급에 완성).`,
  divine: `${RANK_ALL} 고유 신앙이 깨어 있어 신성력을 모으고, 가득 차면 장착한 성유물의 신권 대행을 쓴다. 성유물에 봉헌이 쌓여 단계가 오르면 추천 주요 능력치와 신권 대행 위력이 오른다 (전투마다 자동 봉헌 · 축성 · 순례 제례). 모은 신성력은 전투 후 권능 포인트가 된다.`,
};
/** 특성 하위 항목 (접힘) */
export function sub(key: string, icon: string, cls: string, name: string, kind: string, body: string) {
  const open = app.subOpen.has(key);
  return `<div class="sub ${open ? 'open' : ''}"><span class="sub-h" data-a="toggle-sub" data-v="${key}" aria-expanded="${open}"><i class="${cls}">${icon}</i><b>${esc(name)}</b><span class="muted">${kind}</span><span class="caret">${open ? '▾' : '▸'}</span></span>${open ? `<div class="sub-b">${body}</div>` : ''}</div>`;
}
/** 증강 한 줄 (이름 · 설명) */
export function augRow(id: string, param?: string, b: Battle | null = null, c: CUnit | null = null, tag = '') {
  const ad = AUG_BY_ID[id];
  return `<li class="aug-li ab-click${abilOn(`aug:${id}`)}" data-a="abil-pop" data-v="aug:${esc(id)}" role="button" tabindex="0">${augIcon(id)}<span><b>${augMark(id)}${esc(ad?.name || id)}</b>${tag ? ` <span class="tag">${tag}</span>` : ''}<br><span class="muted">${b && c ? augText(id, param, b, c) : esc(augDesc(id, param))}</span></span></li>`;
}
/** 다음 이정표 등급 */
export function nextMilestone(tt: TType, rank: number): number | null {
  for (let r = rank + 1; r <= Math.min(CFG.maxRank, rank + 30); r++) {
    if ((tt === 'major' || tt === 'special') && CFG.growth.special('major', r)) return r;
    if (tt === 'minor' && CFG.growth.pick(tt, r)) return r;
    if (tt === 'psionic' && CFG.growth.psionic(tt, r)) return r;
  }
  return null;
}
/** 보급: 뒷면 카드를 뒤집어 모두 받는다 (카드 1장 = 크레딧 · 공명도 · 장비 하나, 대박이면 배율 띠). 공개 연출 · 공개음은 revealfx · sound (supplyGrade) */
export function supplyHtml(p: Extract<Pending, { t: 'supply' }>) {
  const left = p.options.filter((c) => !c.open).length;
  const face = (c: SupplyCard, i: number) => {
    if (!c.open) return `<button class="card sup-card" data-a="pick-supply" data-v="${i}" aria-label="보급품 ${i + 1} 뒤집기"><i class="cback" aria-hidden="true"></i></button>`;
    const jp = c.mult > 1 ? `<span class="sup-jp">대박 ×${c.mult}</span>` : ''; // ×2 파랑 · ×4 빨강 (jpClass)
    const body = c.kind === 'credits' ? `<span class="sup-ic">${CR}</span><b>+${c.credits}</b><span>에너지 크레딧</span>`
      : c.kind === 'xp' ? `<span class="sup-ic">${RES}</span><b>+${c.xp}</b><span>공명도 — 파티에 분배</span>`
      : c.items.map((id) => `<span class="sup-ic">${itemIcon(id)}</span><b class="t${tierKey(id)}">${esc(itemInfo(id).name)}</b><span>${statIc(esc(itemInfo(id).desc))}</span>`).join('');
    return `<div class="card sup-card open sup-${c.kind}${jpClass(c)}" data-sup="${i}">${jp}${body}<i class="sup-dt" aria-hidden="true"></i></div>`; // sup-dt = 메트로 우하단 망점 (갤럭시는 숨김)
  };
  return `<h1>보급</h1><p class="muted small">보급품 ${p.options.length}장을 모두 받습니다. 뒤집기 전에는 무엇이 들었는지 모릅니다 · ${p.route ? '항로 보급: 첫 장은 장비 재료 확정, 대박 없음' : `장마다 대박 확률 ${jackpotTxt()} (가치 배율)`} · 마지막 장: ${app.run && R.solventOn(app.run) ? '분리 용제 또는 재구성 회로' : '재구성 회로 또는 공명도'}.</p>
    <div class="cards sup-cards">${p.options.map(face).join('')}</div>
    <div class="row-btns">${left ? `<button class="btn primary" data-a="supply-all">모두 뒤집기 (${left}장)</button>` : '<button class="btn primary" data-a="supply-done">계속</button>'}</div>`;
}
/** 성유물 토큰 (원형) */
export function relicTok(id: string | undefined, attrs = '', on = false) {
  const r = id ? RELIC_BY_ID[id] : null;
  return `<span class="relic-tok${r ? '' : ' empty'}${on ? ' on' : ''}" role="button" tabindex="0" ${attrs} title="${r ? esc(`성유물 · ${r.name} — ${r.desc(1)}`) : '성유물 칸'}">${lineIcon(r ? `r.${r.id}` : 'k.relic', 'li')}</span>`;
}
/** 성유물 교체: 보관함의 성유물 토큰을 눌러 장착 */
export function relicPicker(run: RunState, u: UnitState) {
  const spare = run.relics || [];
  const cur = u.relic ? RELIC_BY_ID[u.relic] : null;
  return `<div class="relic-pick"><div class="small">${cur ? `<b class="accent">${esc(cur.name)}</b> 장착 중 · ` : ''}<span class="muted">보관함 성유물을 누르면 교체합니다</span></div>
    <div class="rp-list">${spare.length ? spare.map((id) => `<button class="rp-item" data-a="relic-equip" data-v="${u.uid}:${id}">${relicTok(id)}<span><b>${esc(RELIC_BY_ID[id].name)}</b><br><span class="muted small">${esc(RELIC_BY_ID[id].desc(1))}</span></span></button>`).join('') : '<span class="muted small">보관 중인 성유물이 없습니다. 순례에서 구할 수 있습니다.</span>'}</div></div>`;
}
/** 축성 단추 (성유물 칸 · 상세 창 머리 공용): 권능 CFG.consecrate.cost → 그 기물 봉헌 +gain, 기물마다 페이즈당 perPhase 번. 못 하면 흐리게 + 이유 (title) */
export function consBtn(run: RunState, u: UnitState, cls: string, off = false) {
  const C = CFG.consecrate, why = R.consecrateWhy(run, u), done = R.consUsed(run, u) >= C.perPhase, max = offerStage(u.offer) >= CFG.offer.max;
  const label = max ? '봉헌 최대' : done ? '축성함' : `축성 · 권능 ${C.cost} → 봉헌 +${C.gain}`;
  return `<button class="btn tiny ${cls}${done || max ? ' done' : ''}" data-a="consecrate" data-v="${u.uid}" title="${esc(why || `권능 ${C.cost}을 써서 봉헌 +${C.gain} (기물마다 페이즈당 ${C.perPhase}번 · 보유 권능 ${run.power})`)}" ${off || why ? 'disabled' : ''}>${lineIcon('a.divact', 'li')}${label}</button>`;
}
/** 봉헌 게이지 + '지금 → 다음' 칩 (기물 상세 전술 유형 칸 · 순례 봉헌함 공용). d = 기물 정의 (추천 주요 능력치) */
export function offerGauge(d: UnitDef, offer: number | undefined, plus = 0) {
  const O = CFG.offer, st = offerStage(offer), max = st >= O.max;
  const lo = offerNeed(st), hi = offerNeed(Math.min(O.max, st + 1)), cur = offer || 0;
  const m = recMajors(d)[0];
  const w = max ? 100 : Math.max(0, Math.min(100, ((cur - lo) / (hi - lo)) * 100));
  const wp = max || !plus ? 0 : Math.max(0, Math.min(100 - w, ((Math.min(hi, cur + plus) - Math.max(lo, cur)) / (hi - lo)) * 100));
  const k = (n: number) => `×${offerMul(n).toFixed(1)}`;
  const nx = (a: string, b: string) => (max ? `<b>${a}</b>` : `<b>${a}</b><i>→</i><b class="nx">${b}</b>`);
  return `<div class="of-g${max ? ' max' : ''}"><div class="of-h"><span class="tt-k">${lineIcon('k.relic', 'li')}봉헌</span><b class="tt-big">${st}<small>/${O.max}단계</small></b><span class="of-n">${max ? '최대' : `${Math.round(cur - lo)} / ${hi - lo}`}</span></div>
    <div class="of-bar" role="img" aria-label="봉헌 ${st}단계${max ? ' (최대)' : `, 다음 단계까지 ${Math.round(hi - cur)}`}"><i style="width:${w.toFixed(1)}%"></i>${wp ? `<i class="add" style="width:${wp.toFixed(1)}%"></i>` : ''}</div>
    <div class="of-chips"><span class="abc" title="장착한 성유물이 주는 ${MAJOR_NAME[m]} (추천 주요 능력치)">${majorIcon(m)}${nx(`+${offerStat(st)}`, `+${offerStat(st + 1)}`)}</span><span class="abc" title="신권 대행 위력 배율">${lineIcon('a.divact', 'li')}${nx(k(st), k(st + 1))}</span></div></div>`;
}
/** 고유 신앙 한 줄: 디바인만 활성 */
/** 능력 블록: 고유 신앙 (디바인만 활성, 그 외는 비활성 표시) */
/** 성찬(도로스)으로 신앙이 깨어난 디바인 아닌 기물인지 (전투 중) */
export const awakened = (d: UnitDef, c: CUnit | null) => d.ttype !== 'divine' && !!c && c.div !== null;
/** 도로스가 출전 중이라 성찬으로 깨어날 수 있는지 (편성) */
export const dorosReady = (d: UnitDef, run: RunState | null) => d.ttype !== 'divine' && d.id !== 'doros' && !!run?.units.some((x) => x.defId === 'doros' && x.pos);
export function faithAbil(d: UnitDef, u: UnitState | null, run: RunState | null, c: CUnit | null = null) {
  const f = c?.faith || u?.faith || d.faith;
  const fd = FAITH_DEF[f];
  const woke = awakened(d, c);
  const on = d.ttype === 'divine' || woke;
  const tok = abTok(`faith.${f}`);
  const off = dorosReady(d, run) ? '디바인만 신앙의 힘을 쓴다. 도로스의 [성찬] 요리를 받으면 이번 전투 동안 깨어난다.' : '디바인만 신앙의 힘을 쓴다.';
  return `<div class="abil ab-faith${on ? '' : ' off'}${tok ? ' has-tok' : ''}">${tok}<div class="ab-head"><span class="ab-kind">신앙</span><b>${FAITH_NAME[f]}</b><span class="ab-meta">${woke ? '성찬 각성' : on ? '활성' : '비활성'}</span></div>
    <p>${on ? `${esc(fd.buff)}. 신성력: ${esc(fd.gain)}${app.detail ? `, 초당 +${CFG.divTick} (수집 상한 ${CFG.divCap + (run?.divCap || 0)})` : ''}.${woke ? ' 도로스의 [성찬]으로 이번 전투 동안 깨어났다.' : ''}` : off}</p></div>`;
}
/** 능력 란의 전술 유형 섹션: 유형마다 구성이 다르다 (u 없으면 도감 미리보기, c 있으면 전투 중 실시간 값) */
/** 전공 선택 카드: 학파 · 비술 · 지속 능력 · 고이성 · 저이성 · 전공 증강 7종 */
export function schoolOpt(id: string, i: number) {
  const sc = SCHOOL_BY_ID[id.split('.')[1] as SchoolId];
  if (!sc) return '';
  // 이름 · 핵심 한 줄 · 비술 / 지속 아이콘만. 기믹은 아이콘을 눌러 상세에서 본다
  const ic = (key: string, tok: string, kind: string, name: string) =>
    `<span class="so-ic ab-click${abilOn(key)}" data-a="abil-pop" data-v="${key}" role="button" tabindex="0" title="눌러서 자세히">${abTok(tok)}<span><small>${kind}</small><b>${esc(name)}</b></span></span>`;
  return `<div class="aug-opt sch-opt ${app.augPick === i ? 'on' : ''}" style="--sc:${sc.color}" data-a="pick-augsel" data-v="${i}" role="button" tabindex="0" aria-pressed="${app.augPick === i}">
    <span class="so-head">${augIcon(id)}<span><span class="muted small">${GROUPS[sc.group].name}</span><b>${sc.name}</b></span><kbd>${i + 1}</kbd></span>
    <p class="so-line">${esc(SCHOOL_LINE[sc.id])}</p>
    ${app.run ? schoolWarnings(sc.id, app.run.field).map((w) => `<p class="so-warn ${w.level}">${w.level === 'good' ? '▲' : '⚠'} ${esc(w.text)}</p>`).join('') : ''}
    <span class="so-ics">${ic(`cantrip:${sc.id}`, `cantrip.${sc.id}`, '비술', sc.cantrip.name)}${ic(`psipass:${sc.id}`, `passive.${sc.id}`, '지속', sc.passive.name)}</span></div>`;
}
/** 전투 기물의 학파 (엔진 필드) */
export const cSchool = (c: CUnit | null): SchoolId | null => ((c as { school?: SchoolId | null } | null)?.school ?? null);
export function ttSection(d: UnitDef, u: UnitState | null, run: RunState | null, b: Battle | null = null, c: CUnit | null = null, live = false, rule = true) { // rule: 유형 공통 규칙 문장 (전체 상세는 접힌 칸으로 따로 보여 주므로 false)
  const tt = d.ttype;
  const rank = u?.rank || 1;
  const nx = u ? nextMilestone(tt, rank) : null;
  const f = u?.faith || d.faith;
  const owned = u?.augments || [];
  const body: string[] = [];
  if (tt === 'major' || tt === 'special') {
    if (live && c) body.push(`<div class="tt-row"><span class="tt-k">${lineIcon('a.battery', 'li')} 궁극기 게이지</span><b class="tt-big">${Math.round((c.ultG || 0) * 100)}%</b></div>`);
    const pool = d.specialAugs || [];
    const mine = owned.filter((a) => pool.some((p) => p.id === a.id));
    const max = CFG.majorAugMax;
    body.push(`<div class="tt-row"><span class="tt-k">전용 증강</span><b class="tt-big">${mine.length}<small>/${max}</small></b>${nx && mine.length < max ? `<span class="muted small">다음 ${nx}등급</span>` : ''}</div>`);
    if (mine.length) body.push(`<ul class="augs">${mine.map((a) => augRow(a.id, a.param, b, c)).join('')}</ul>`);
    else if (u) body.push(`<p class="muted small">4등급에 첫 전용 증강을 고릅니다.</p>`);
    if (!u) body.push(`<ul class="augs">${pool.map((a) => augRow(a.id, undefined, b, c)).join('')}</ul>`);
  } else if (tt === 'minor') {
    const g = CFG.minorGrow(rank);
    const tl = MINOR_TRAIT_GROW[d.id];
    body.push(`<div class="tt-row"><span class="tt-k">성장 배율</span><b class="tt-big">×${g.toFixed(2)}</b><span class="muted small">${u ? `${rank}등급` : '1등급'} · 10등급 ×2 · 20등급 ×3</span></div>`);
    body.push(`<ul class="tt-list"><li>${lineIcon('p.tech', 'li')}기술 계수 ×${g.toFixed(2)}</li>${tl ? `<li>${lineIcon('a.power', 'li')}${esc(tl(g))}</li>` : ''}</ul>`);
    if (nx) body.push(`<p class="muted small">다음 능력치 선택: ${nx}등급</p>`);
  } else if (tt === 'psionic') {
    const sid = (u ? schoolOf(u) : null) || cSchool(c);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    const mine = owned.filter((a) => a.id.startsWith('psi.'));
    if (sc) {
      const g = GROUPS[sc.group];
      // 머리: 학파 · 전공 칩
      body.push(`<div class="ps-head" style="--sc:${sc.color}">${lineIcon(`s.${sc.id}`, 'li')}<span class="ps-grp">${g.name}</span><b>${sc.name}</b><span class="muted small">${sc.study}</span></div>`);
      // 비술 · 지속 능력: 두 장의 작은 카드 (누르면 상세)
      // 전공 증강(◆ 변형 포함)을 반영한 실제 비술 · 지속 능력
      const pa = c?.src?.augments || owned;
      const cv = cantripView(sc.id, pa), pv = passiveView(sc.id, pa);
      const cd = psiCd(b, c, cv.cd);
      const chips = AB.skillChips(cv.info, actx(b, c, true), b && c ? b.S(c, 'range') : d.range, cd) + AB.chip('a.reason', `-${cv.cost}`, '이성 소모');
      // 설명: 상세 보기 = 상세 문장 (docs/ABILITY_TEXT.md), 아니면 한 줄 (수치 없음)
      const psiTx = (text: string | undefined, brief: string) => (app.detail && text ? `<div class="small">${detailHtml(text, actx(b, c, true))}</div>` : `<span class="small">${esc(brief)}</span>`);
      body.push(`<div class="ps-cards${app.detail ? ' dt' : ''}" style="--sc:${sc.color}">
        <div class="ps-card ab-click${abilOn('cantrip')} has-tok" data-a="abil-pop" data-v="cantrip" role="button" tabindex="0">${abTok(`cantrip.${sc.id}`)}<div class="ab-head"><span class="ab-kind">비술</span><b>${esc(cv.name)}</b>${psiTfTag(cv.transform)}</div><div class="ab-chips">${chips}</div>${psiTx(cv.info.text, cv.brief)}</div>
        <div class="ps-card ab-click${abilOn('psipass')} has-tok" data-a="abil-pop" data-v="psipass" role="button" tabindex="0">${abTok(`passive.${sc.id}`)}<div class="ab-head"><span class="ab-kind">지속</span><b>${esc(sc.passive.name)}</b>${psiTfTag(pv.transform)}</div>${psiTx(pv.text, pv.brief)}</div>
      </div>`);
      // 이성: 양 끝에 효과, 가운데 0 (누르면 규칙 상세)
      const r = live && c && c.reason !== null ? c.reason : null;
      const fz = !!(c && (c.mem.frenzy || c.statuses.some((x) => x.key === 'frenzy')));
      body.push(`<div class="ps-reason ab-click${abilOn('reason')}" data-a="abil-pop" data-v="reason" role="button" tabindex="0" style="--sc:${sc.color}">
        <div class="pr-bar">${r !== null ? `<i style="left:${(r + 100) / 2}%"></i><b style="left:${(r + 100) / 2}%">${Math.round(r)}</b>` : ''}</div>
        <div class="pr-ends"><span class="lo">${lineIcon('a.power', 'li')}${esc(sc.low)}</span><span class="hi">${esc(sc.high)}${lineIcon('a.shield', 'li')}</span></div>
        ${fz ? '<span class="pr-fz">광폭</span>' : ''}</div>`);
      // 전공 증강: 칸마다 고르는 등급 (CFG.psiEvery · psiAugMax — 예전에는 5 · 10 · 15 · 20 으로 잘못 적혀 있었다)
      const slots = psiAugRanks().map((rk, i) => {
        const a = mine[i];
        if (a) return `<button class="tt-ic ab-click${abilOn(`aug:${a.id}`)}" data-a="abil-pop" data-v="aug:${esc(a.id)}" title="${esc(AUG_BY_ID[a.id]?.name || a.id)}">${augIcon(a.id)}</button>`;
        return `<span class="ps-slot" title="${rk}등급">${rk}</span>`;
      }).join('');
      body.push(`<div class="tt-row ps-augs"><span class="tt-k">전공 증강</span><div class="tt-icons">${slots}</div></div>`);
      if (!u) { // 보유 기물은 고른 증강만 (남은 후보 목록은 상세 보기에서도 띄우지 않는다)
        const rest = SCHOOL_PASSIVES[sc.id].filter(([k]) => !mine.some((m) => m.id === psiAugId(sc.id, k)));
        if (rest.length) body.push(`<div class="ps-rest">${rest.map(([k, n, dsc]) => `<span class="pill" title="${esc(dsc)}">${augMark(psiAugId(sc.id, k))}${esc(n)}</span>`).join('')}</div>`);
      }
    } else {
      const gid = UNIT_GROUP[d.id];
      const majors = gid ? GROUPS[gid].majors : (Object.keys(SCHOOL_BY_ID) as SchoolId[]);
      body.push(`<p class="small muted">${u ? '아직 전공을 고르지 않았습니다.' : `${gid ? `${GROUPS[gid].name} · ` : '모든 학파 · '}합류할 때 전공 하나를 고른다.`}</p>`);
      body.push(`<div class="ps-rest">${majors.map((m) => SCHOOL_BY_ID[m]).map((x) => `<span class="pill sch-pill" style="--sc:${x.color}" title="${esc(`${x.cantrip.name}: ${x.cantrip.desc}`)}">${lineIcon(`s.${x.id}`, 'li')}${x.name}</span>`).join('')}</div>`);
    }
  } else {
    if (live && c && c.div !== null) body.push(`<div class="tt-row"><span class="tt-k">신성력</span><b class="tt-big">${c.divUsed ? '발동함' : Math.round(c.div)}</b><span class="muted small">수집 ${Math.round(c.divGot)} / ${c.divCap}</span></div>`);
    if (u) body.push(offerGauge(d, u.offer));
    else body.push(`<div class="of-chips"><span class="abc" title="성유물을 장착하면 (봉헌 0단계)">${majorIcon(recMajors(d)[0])}<b>+${offerStat(0)}</b></span><span class="abc" title="봉헌 단계마다">${lineIcon('k.relic', 'li')}단계마다 +${CFG.offer.stat} · 위력 +${Math.round(CFG.offer.act * 100)}%p</span><span class="abc">최대 ${CFG.offer.max}단계</span></div>`);
    if (run) body.push(`<div class="tt-row"><span class="tt-k">${lineIcon('a.power', 'li')}권능 포인트</span><b>${run.power}</b>${app.detail ? `<span class="muted small">전투 후 모은 신성력 ÷ ${CFG.powerPerDiv} · 자동 봉헌 ${CFG.offer.floor} + 번 권능 × ${CFG.offer.perPower}</span>` : ''}</div>`);
  }
  void f;
  return `<section class="abil tt-sec tt-${tt}"><div class="ab-head"><span class="ab-kind">전술 유형</span><b class="tt-name"><i class="tt-${tt}">${TTYPE_ICON(tt)}</i>${TTYPE_NAME[tt]}</b></div>
    ${rule && (tt !== 'psionic' || app.detail) ? `<p class="tt-rule small muted">${esc(TTYPE_RULE[tt])}</p>` : ''}${body.join('')}</section>`;
}
/** 분류 표시 (아군 · 적 공통) */
export function categoryTag(cat: Category) {
  return `<i class="cat cat-${cat}" title="${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}">${lineIcon(`k.${cat}`, 'li')}${CATEGORY_NAME[cat]}</i>`;
}
export const unitCategory = (d: UnitDef) => categoryOf(d.keywords);
export const enemyCategory = (e: EnemyDef) => categoryOf(e.keywords, !!e.immobile);
/** 특성 블록: 고유 특성 + 전투 유형 · 전술 유형 · 고유 신앙 (접힘) */
export function traitGroup(d: UnitDef, u: UnitState | null, run: RunState | null, b: Battle | null = null, c: CUnit | null = null) {
  const k = (x: string) => `${d.id}:${x}`;
  void u; void run;
  const tok = abTok(`trait.${d.id}`);
  return `<div class="abil ab-trait"><div class="ab-click${abilOn('trait')}${tok ? ' has-tok' : ''}" data-a="abil-pop" data-v="trait" role="button" tabindex="0">${tok}<div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div>${traitHtml(d, b, c)}</div>
    <div class="subs">
      ${sub(k('ct'), CTYPE_ICON(d.ctype), `ct-${d.ctype}`, CTYPE_NAME[d.ctype], '전투 유형', ctypeRuleHtml(d.ctype, app.detail))}
    </div></div>`;
}
export const AB_KIND = { weapon: '무기', trait: '특성', skill: '스킬', grow: '성장', psi: '이성', div: '신권', ult: '궁극기', act: '신권 대행' } as const;
/** 무기 · 특성 · 스킬 등을 같은 모양의 블록으로 */
export function abil(kind: keyof typeof AB_KIND, name: string, meta: string, desc: string) {
  return `<div class="abil ab-${kind}"><div class="ab-head"><span class="ab-kind">${AB_KIND[kind]}</span><b>${name.startsWith('<svg') ? name.replace(/(<\/svg>)(.*)$/, (_m, a, t) => a + esc(t)) : esc(name)}</b>${meta ? `<span class="ab-meta">${meta}</span>` : ''}</div><p>${esc(desc)}</p></div>`;
}
export function weaponAbil(w: Weapon, elem = w.elem) {
  const el = elem !== 'phys' ? `${ELEM_NAME[elem]} 피해 · ` : '';
  if (w.kind === 'none') return abil('weapon', w.name, '', '기본 공격을 하지 않는다.');
  const brief = w.kind === 'mag' ? `${el}탄창 ${w.mag}발, 다 쓰면 재장전한다.` : `${el}${w.combo}번째 공격마다 강력한 피니쉬.`;
  const pow = w.tactical ? '전술 위력' : w.type === 'shoot' ? '사격 위력' : '타격 위력';
  const full = `${ELEM_NAME[elem]} · ${pow} ${Math.round(w.mult * 100)}% · ${w.kind === 'mag' ? `탄 ${w.mag} · 재장전 ${w.reload}초` : `콤보 ${w.combo} (피니쉬 ×${CFG.finishMult})`} · 공격 간격 ${w.interval}초`;
  return abil('weapon', w.name, app.detail ? `${WPOS(w.range)} · 사거리 ${w.range}` : WPOS(w.range), app.detail ? full : brief);
}
/** 지휘관 스킬은 전술 위력으로 계산된다 */
export function skillText(d: UnitDef, sk = d.skill.params) {
  if (!app.detail) return ABIL[d.id]?.brief?.skill || BRIEF[d.id]?.skill || d.skill.desc(sk);
  const t = d.skill.desc(sk);
  return d.ctype === 'CMD' ? t.replace(/기술 위력/g, '전술 위력') : t;
}
export const traitText = (d: UnitDef) => (app.detail ? d.trait.desc : ABIL[d.id]?.brief?.trait || BRIEF[d.id]?.trait || d.trait.desc);
/** 상세 문장 (docs/ABILITY_TEXT.md): 줄마다 한 문장, 능력치 아이콘 치환 */
export const detailHtml = (text: string, ctx: AB.AbilCtx, gl = new Set<string>()) => statIc(AB.detailText(text, ctx, gl));
/** 영입 · 계약 카드의 스킬 블록: 상세 보기 = 상세 문장 (없으면 옛 설명), 아니면 한 줄. 전투 기물이 없으니 전투 유형만 담은 자리표시로 위력 이름(지휘관 = 전술 위력)을 고른다 */
export function unitSkillAbil(d: UnitDef) {
  const info = app.detail ? ABIL[d.id]?.skill?.(d.skill.params) : undefined;
  if (!info?.text) return abil('skill', d.skill.name, app.detail ? `${d.skill.cd}초` : '', skillText(d));
  return `<div class="abil ab-skill"><div class="ab-head"><span class="ab-kind">${AB_KIND.skill}</span><b>${esc(d.skill.name)}</b><span class="ab-meta">${d.skill.cd}초</span></div>${detailHtml(info.text, { b: null, c: { ctype: d.ctype, side: 0, isSummon: false, mem: {} } as unknown as CUnit, p: d.skill.params, skill: true, range: d.range })}</div>`;
}
/** 위쪽 바 축성 단추 (편성 중 디바인 · 성유물 장착 시): 성유물 칸의 축성과 같은 동작 */
export function blessBtn(run: RunState, u: UnitState, d: UnitDef) {
  if (d.ttype !== 'divine' || !u.relic) return '';
  return consBtn(run, u, 'd-bless');
}
/** 상세 창 상단 고정 바: 닫기(←) · [추가 버튼] · 상세 보기(돋보기) */
export function dBar(back: string, extra = '') {
  return `<div class="d-bar"><button class="btn d-back" data-a="${back}" data-v="" aria-label="상세 닫기" title="닫기 (Esc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <span class="d-bar-r">${extra}${magToggle()}</span></div>`;
}
/** 상세 보기 단추 (돋보기 아이콘, 켜면 강조색): 상세 패널 머리 · 기물 선택 · 영입 · 전체 상세 공용 */
export function magToggle(cls = '') {
  return `<button class="btn d-mag${cls}${app.detail ? ' on' : ''}" data-a="toggle-detail" aria-pressed="${app.detail}" aria-label="상세 보기 ${app.detail ? '끄기' : '켜기'}" title="상세 보기: 계수 · 세부 규칙 표시 (단축키 D) · ${app.detail ? 'ON' : 'OFF'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg></button>`;
}
export function detailToggle() { return magToggle(' d-mag-solo'); }
/** 집중 육성 단추 (전체 상세 머리, 상세 보기 단추 옆): 파티 창 초상화의 표적 단추(.rt-focus)와 같은 동작 · 켜면 선택색 */
export function focusBtn(run: RunState, u: UnitState) {
  if (R.isRock(u)) return '';
  const on = !!run.focus?.includes(u.uid);
  return `<button class="btn d-mag-solo d-focus${on ? ' on' : ''}" data-a="focus" data-v="${u.uid}" aria-pressed="${on}" aria-label="집중 육성 ${on ? '해제' : '지정'}" title="${on ? '집중 육성 해제' : `집중 육성 — 지정한 기물들이 공명도 풀의 ${Math.round(CFG.focusXpShare * 100)}%를 먼저 나눠 받고, 나머지는 모든 기물이 함께 나눕니다`}">${lineIcon('u.target', 'li')}</button>`;
}
export function unitCard(d: UnitDef, opts: { selected?: boolean; action?: string; rank?: number; clone?: boolean } = {}) {
  return `<button class="ucard ${opts.selected ? 'sel' : ''}" ${opts.clone ? 'aria-hidden="true" tabindex="-1"' : ''} data-a="${opts.action || 'pick-starter'}" data-v="${d.id}">
    ${hero(d.id, 'hero sm')}<div class="ucard-head">${sprite(d, 'spr big')}${nameBlock(d, [...d.factions, ...d.traits], opts.rank, opts.action === 'pick-recruit' ? ownedChip(d.id) : chip)}</div>
    ${unitInfo(d)}
  </button>`;
}
/** 무기 · 특성 · 스킬 · 기본 능력치 */
export function unitInfo(d: UnitDef) {
  return `${weaponAbil(d.weapon)}
    ${traitGroup(d, null, app.run)}
    ${unitSkillAbil(d)}
    <div class="majors-mini">${MAJORS.map((m) => `<span title="${MAJOR_NAME[m]}">${majorIcon(m)}<b>${d.base[m]}</b></span>`).join('')}</div>`;
}
/** 역할: 전투 유형 · 전술 유형 (아이콘 + 이름) */
export function roleTag(d: UnitDef) {
  return `<span class="pc-role"><span class="ct-${d.ctype}">${CTYPE_ICON(d.ctype)} ${CTYPE_NAME[d.ctype]}</span><span class="tt-${d.ttype}">${TTYPE_ICON(d.ttype)} ${TTYPE_NAME[d.ttype]}</span></span>`;
}
/** 시작 기물 후보 카드: 스탠딩 + 이름 + 역할 + 시너지. 호버(터치는 탭)하면 카드 안에서 설명이 올라온다 */
export interface PickOpts { nameExtra?: string; synCount?: (id: string) => number; clone?: boolean; on: boolean; badge?: string; tapAct: string; full?: boolean; fullLabel?: string; chipFn?: (id: string) => string; extra?: string; i?: number }
/** 이 기물이 합류했을 때 시너지별 기물 수 (같은 기물은 1회) */
export function teamCount(ids: string[]) {
  const uniq = [...new Set(ids)];
  return (sid: string) => uniq.filter((x) => { const d = UNIT_BY_ID[x]; return d && ([...d.factions, ...d.traits] as string[]).includes(sid); }).length;
}
export function pickCard(d: UnitDef, o: PickOpts) {
  const { clone, on, full } = o;
  return `<div class="pslot" style="--i:${Math.min(o.i ?? 0, 7)}"><div class="pcard ${on ? 'sel' : ''} ${app.cardOpen === d.id && !clone ? 'open' : ''}" data-ct="${d.ctype}" data-a="${o.tapAct}" data-v="${d.id}" ${clone ? 'aria-hidden="true"' : 'tabindex="0" role="button"'} aria-label="${esc(d.name)}">
    <i class="cback" aria-hidden="true"><i class="cb-l"></i></i><i class="gc-scan" aria-hidden="true"></i>
    <span class="mt-pass" aria-hidden="true"><b>BOARDING PASS</b><i></i><span class="mt-pass-stub"><i class="mt-code"></i><b>METRO</b><em>${String((o.i ?? 0) + 1).padStart(2, '0')}</em></span></span>
    <div class="pc-art">${standImg(d.id, 'stand') || sprite(d, 'spr big')}</div>
    <button class="btn pc-full" data-a="card-max" data-v="${d.id}" ${clone ? 'tabindex="-1"' : ''} title="전체 상세 (확대)" aria-label="${esc(d.name)} 전체 상세 열기">${MAX_SVG}</button>
    ${on ? `<span class="pc-check"><b class="pc-ck">✓</b>${o.badge ? ` ${o.badge}` : ''}</span>` : ''}
    <div class="pc-syn">${[...d.factions, ...d.traits].map((id) => synToken(id, o.synCount ? o.synCount(id) : 0)).join('')}</div>
    <div class="pc-panel">
      <div class="pc-top"><div class="pc-nm"><b class="pc-name">${esc(d.name)}</b>${o.nameExtra || ''}</div>${roleTag(d)}${unitBlurb(d) ? `<span class="pc-blurb">${esc(unitBlurb(d))}</span>` : ''}${o.extra || ''}
        <div class="chips">${[...d.factions, ...d.traits].map(o.chipFn || chip).join('')}</div>
        <button class="pc-more" data-a="card-open" data-v="${d.id}" ${clone ? 'tabindex="-1"' : ''}>${app.cardOpen === d.id && !clone ? '접기 ▼' : '상세 보기 ▲'}</button></div>
      <div class="pc-desc" data-a="noop">${unitInfo(d)}
        <button class="btn ${on ? '' : 'primary'} pc-pick" data-a="${o.tapAct}" data-v="${d.id}" ${full ? 'disabled' : ''} ${clone ? 'tabindex="-1"' : ''}>${on ? '선택 해제' : full ? o.fullLabel || '선택 불가' : '선택'}</button></div>
    </div>
  </div></div>`;
}
export const CAN_HOVER = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;
