// 능력 (통일 형식) · 소환물 (main.ts 에서 분리)
import { CFG } from '../config';
import { AUG_BY_ID, augDesc } from '../data/augments';
import { ENEMY_BY_ID, type EnemyDef } from '../data/enemies';
import { SQUAD_KIND, type SquadKind } from '../data/squads';
import { ENEMY_DESC } from '../data/enemyText';
import { tierKey, itemInfo } from '../data/items';
import { aceTargetUid, rankTitle, TITLE_NAME, tierOf, VOYAGE_SPECIAL } from '../data/synergies';
import { UNIT_BY_ID, type UnitDef } from '../data/units';
import { withEmblemSummon } from '../data/emblems';
import { DIVINE_ACT } from '../data/rework';
import { type AugList, cantripView, passiveView, transformPreview } from '../data/psiinfo';
import { augReqState } from '../data/augreq';
import { GROUPS, SCHOOL_BY_ID, augMark, schoolOf, type SchoolId } from '../data/schools';
import { BRIEF, unitBlurb } from '../data/brief';
import { ABIL, augAbilText, ENEMY_ABIL } from '../data/abiltext';
import * as AB from '../ui/abil';
import { runGeo, buildBattle, buildEnemy, deployed, memberships, synergyCounts, totalMajors, unitEffects } from '../engine/build';
import { Battle, controlNames, type CUnit, PROV, provMult, zocCapable, zocHoldFormula, zocHoldOf } from '../engine/combat';
import * as R from '../engine/run';
import { Rng } from '../rng';
import { type Encounter, type EnemySpawn, CATEGORY_NAME, CATEGORY_RULE, type StatKey, type Weapon, CTYPE_NAME, ELEM_NAME, MAJOR_NAME, TTYPE_NAME, MAJORS, NODE_NAME, type RunState, type UnitState } from '../types';
import { encounterMatchup } from '../ui/matchup';
import { makeSummons, type SummonMade } from '../engine/build';
import { mapOf, terrainGroups } from '../data/maps';
import { fmt } from '../ui/battleview';
import { ULTS } from '../data/ults';
import { DEFAULT_RELIC, RELIC_BY_ID } from '../data/relics';
import { ABIL_ICONS } from '../ui/abilicons.gen';
import { lineIcon, typeIcon } from '../ui/synicons';
import { app, esc, root } from './state';
import { NODE_ICON, augIcon, hero, itemIcon, majorIcon, sprite, statIc, synToken, xpBar } from './common';
import { diffAddChip, matchupHtml, muRow, muTag, muTags, releaseBlock } from './title';
import { AB_KIND, CTYPE_ICON, TTYPE_ICON, TTYPE_RULE, WPOS, awakened, blessBtn, cSchool, categoryTag, ctypeRuleHtml, dBar, detailHtml, detailToggle, dorosReady, enemyCategory, faithAbil, focusBtn, relicPicker, relicTok, skillText, sub, traitGroup, traitText, ttSection, unitCategory } from './unitparts';
import { foeRank, rankChip, rankLabel, unitRank } from './map';
import { hpLabel, kingDetail, previewAlly, startChips, statLines, turretDetail } from './prep';
import { battleMajors, encName, foeAmp, foeHead, magBtn, majorsHtml, tendOf, terrainDetail, tierKo } from './battle';

// ───────────────────────── 능력 (통일 형식 · 누르면 좌측 상세 팝업)
/** 능력 문장 계산 맥락. 전투 밖(도감 · 상세)에서는 기물 기본 스킬 파라미터로 @파라미터를 채운다 */
export const actx = (b: Battle | null, c: CUnit | null, skill = false, d?: UnitDef | null): AB.AbilCtx => ({ b, c, p: c?.sk || d?.skill.params || {}, skill });
export const abilOn = (k: string) => (app.abilPop === k ? ' on' : '');
/** 능력 아이콘 토큰 (없으면 빈 문자열). 키: skill.<기물> · trait.<기물> · ult.<기물> · weapon.<기물> · cantrip/passive.<전공> · faith.<신앙> */
export function abTok(ic?: string) {
  const src = ic ? ABIL_ICONS[ic] : '';
  if (!src && ic?.startsWith('ult.')) return '<span class="ab-tok ab-tok-ph" aria-hidden="true">✦</span>'; // 아이콘을 아직 뽑지 않은 궁극기: 임시 자리표시
  return src ? `<img class="ab-tok" src="${src}" alt="" draggable="false">` : '';
}
export function abilCard(key: string, kind: keyof typeof AB_KIND, name: string, meta: string, body: string, extra = '', ic?: string) {
  const tok = abTok(ic);
  return `<div class="abil ab-${kind} ab-click${abilOn(key)}${tok ? ' has-tok' : ''}" data-a="abil-pop" data-v="${esc(key)}" role="button" tabindex="0">${tok}<div class="ab-head"><span class="ab-kind">${AB_KIND[kind]}</span><b>${name.startsWith('<svg') ? name.replace(/(<\/svg>)(.*)$/, (_m, x, t) => x + esc(t)) : esc(name)}</b>${meta ? `<span class="ab-meta">${meta}</span>` : ''}</div>${body}${extra}</div>`;
}
export function weaponCard(w: Weapon, b: Battle | null, c: CUnit | null, elem = w.elem, uid?: string) {
  const ic = uid ? `weapon.${uid}` : undefined;
  if (w.kind === 'none') return abilCard('weapon', 'weapon', w.name, '', '<p>기본 공격을 하지 않는다.</p>', '', ic);
  const range = b && c ? b.S(c, 'range') : w.range;
  return abilCard('weapon', 'weapon', w.name, WPOS(range), `<div class="ab-chips">${AB.weaponChips(w, actx(b, c), range, elem)}</div>`, '', ic);
}
/** 메이저 궁극기 카드 (스킬과 같은 모양) */
export function ultCard(d: UnitDef, b: Battle | null, c: CUnit | null, live = false) {
  const ul = ULTS[d.id];
  if (!ul || d.ttype !== 'major') return '';
  const eff = c && b ? b.S(c, 'ultCharge') : 0;
  const sec = (CFG.ultTime * CFG.ultNeed) / (ul.charge * Math.max(0.1, 1 + eff));
  const chips = `<div class="ab-chips"><span class="abc" title="자연 충전 주기">${lineIcon('a.cd', 'li')}${sec.toFixed(0)}초</span><span class="abc" title="전투 시작 게이지">${lineIcon('a.battery', 'li')}시작 ${Math.round((CFG.ultStart + (c?.mem.ultStart || 0)) * 100)}%</span>${live && c ? `<span class="abc v">${Math.round((c.ultG || 0) * 100)}%</span>` : ''}</div>`;
  const body = app.detail ? (ul.text ? detailHtml(ul.text, actx(b, c, true)) : `<p>${statIc(esc(ul.desc))}</p>`) : `<p>${esc(ul.brief || ul.desc)}</p>`;
  return abilCard('ult', 'ult', ul.name, `약 ${sec.toFixed(0)}초`, `${chips}${body}`, '', `ult.${d.id}`);
}
/** 디바인 신권 대행 카드: 장착한 성유물 */
/** 성유물 섹션: 장착 슬롯 + 종속 하위 능력(신권 대행) */
export function relicSection(d: UnitDef, u: UnitState | null, run: RunState | null, c: CUnit | null, live = false, b0: Battle | null = null) {
  if (d.ttype !== 'divine') {
    // 성찬(도로스)으로 깨어난 기물: 성유물이 없으므로 전투 유형 기본형 신권 대행 (전투 중) · 깨어날 수 있으면 미리보기 (편성)
    const woke = live && awakened(d, c);
    if (!woke && !dorosReady(d, run)) return '';
    const da = DIVINE_ACT[d.ctype];
    const chips = `<div class="ab-chips"><span class="abc" title="신성력이 가득 차면 발동">${lineIcon('a.divact', 'li')}신성력 100</span><span class="abc">전투당 1회</span>${woke && c ? `<span class="abc v">${c.divUsed ? '발동함' : Math.round(c.div || 0)}</span>` : '<span class="abc">성찬을 받으면</span>'}</div>`;
    return `<section class="abil ab-relic"><div class="rl-act ab-click${abilOn('divact')}" data-a="abil-pop" data-v="divact" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">신권 대행 · 성찬</span><b>${lineIcon('a.divact', 'li ab-ic')}${esc(da.name)}</b></div>${chips}${app.detail ? detailHtml(da.text, actx(b0, c)) : `<p>${esc(da.brief)}</p>`}<p class="small muted">성유물이 없어 ${esc(CTYPE_NAME[d.ctype])} 기본형을 쓴다.</p></div></section>`;
  }
  const rid = u?.relic || c?.relic || DEFAULT_RELIC[d.id];
  const rel = rid ? RELIC_BY_ID[rid] : null;
  const edit = !!(u && run && !live);
  const head = `<div class="ab-head"><span class="ab-kind">성유물</span><b>${esc(rel?.name || '없음')}</b>${u && run && rel ? `<button class="btn tiny rl-bless${u.enh ? ' done' : ''}" data-a="relic-enh" data-v="${u.uid}" title="권능 ${rel.enh}을 써서 다음 전투의 신권 대행 계수를 ×3으로" ${live || u.enh || run.power < rel.enh ? 'disabled' : ''}>${u.enh ? '축성됨' : `축성 · 권능 ${rel.enh}`}</button>` : ''}</div>`;
  const slot = `<div class="rl-slot">${relicTok(rel?.id || '', edit ? `data-a="relic-pick" data-v="${u!.uid}"` : '', edit && app.relicPick === u!.uid)}<p class="small muted">${rel ? '장착한 성유물이 신권 대행의 효과를 정한다.' : `성유물이 없으면 ${esc(CTYPE_NAME[d.ctype])} 기본형 신권 대행 [${esc(DIVINE_ACT[d.ctype].name)}]을 쓴다.`}</p></div>${edit && app.relicPick === u!.uid ? relicPicker(run!, u!) : ''}`;
  let act = '';
  if (rel) {
    const k = (live ? c?.mem.enh : u?.enh ? 3 : 1) || 1;
    const chips = `<div class="ab-chips"><span class="abc" title="신성력이 가득 차면 발동">${lineIcon('a.divact', 'li')}신성력 100</span><span class="abc">전투당 1회</span>${k > 1 ? '<span class="abc v">강화 ×3</span>' : ''}${live && c && c.div !== null ? `<span class="abc v">${c.divUsed ? '발동함' : Math.round(c.div)}</span>` : ''}</div>`;
    act = `<div class="rl-act ab-click${abilOn('divact')}" data-a="abil-pop" data-v="divact" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">신권 대행</span><b>${lineIcon('a.divact', 'li ab-ic')}${esc(rel.name)}</b></div>${chips}${app.detail ? detailHtml(rel.text(k), actx(b0, c)) : `<p>${esc(rel.brief)}</p>`}</div>`;
  }
  return `<section class="abil ab-relic">${head}${slot}${act ? `<hr class="rl-sep">${act}` : ''}</section>`;
}
// ───────── 소환물 (최고의 친구): 이름 · 초상 · 전투 유형 · 현재 상속률 + 기본 공격 · 기술 카드 (누르면 좌측 상세)
export type SumDef = NonNullable<UnitDef['summon']>;
export const sumKinds = (sd: SumDef): SumDef[] => [sd, ...(sd.also || [])];
/** 이 기물의 소환물: 전투에 이미 불려 나와 있으면 그 소환물, 아니면 build.ts makeSummons 로 만든 미리보기
 *  (상세용 전투의 기물 c 기준 = 지금 런의 시너지 · 특성 · 증강, 도감 · 대기석은 시너지 없이 기본값) */
export function summonList(d: UnitDef, b: Battle | null, c: CUnit | null): SummonMade[] {
  const sd0 = d.summon;
  if (!sd0 || !c) return [];
  const real = b ? b.units.filter((s) => s.isSummon && s.owner === c && s.defId === 'summon') : [];
  if (real.length) return real.map((s) => ({ sd: sumKinds(sd0).find((k) => k.name === s.name) || sd0, unit: s, rate: s.mem.bondRate || 0, extra: !!s.mem.bondExtra }));
  return makeSummons(c, sd0);
}
export const sumPc = (x: number) => `${Math.round(x * 100)}%`;
export const sumPow = (s: CUnit): 'shoot' | 'strike' => (s.atk.type === 'shoot' ? 'shoot' : 'strike');
export const sumS = (b: Battle | null, s: CUnit, k: StatKey) => (b ? b.S(s, k) : s.st[k]);
/** 상속률 구성: 시너지 단계 (꺼져 있으면 기본) + 특성 · 증강 가산 × 소환물 배율 */
export function bondNote(c: CUnit, m: SummonMade) {
  const syn = c.mem.bond ? `최고의 친구 단계 ${sumPc(c.mem.bond)}` : `기본 ${sumPc(CFG.bond.base)} (최고의 친구 시너지 꺼짐)`;
  const bonus = c.mem.bondBonus ? ` + 특성 · 증강 ${sumPc(c.mem.bondBonus)}p` : '';
  const k = (m.extra ? c.mem.extraRate ?? CFG.bond.extra : 1) * (m.sd.rate || 1);
  return `${syn}${bonus}${k !== 1 ? ` × ${+k.toFixed(2)}${m.extra ? ' (추가 소환)' : ''}` : ''}`;
}
/** 소환물 기본 공격 예상 DPS (치명타 기대값 포함, 방어도 · 속성 보정 · 명중 제외) */
export function sumDps(b: Battle | null, s: CUnit, sd: SumDef) {
  const ivl = s.atk.interval / Math.max(0.2, 1 + sumS(b, s, 'atkSpd'));
  const crit = 1 + Math.min(1, Math.max(0, sumS(b, s, 'crit'))) * Math.max(0, sumS(b, s, 'critDmg') - 1);
  return (sumS(b, s, sumPow(s)) * (sd.basicMult || 1) * crit) / ivl;
}
/** 소환물 상세 (기본 공격 팝업) 행 */
export function summonRows(b: Battle | null, c: CUnit, m: SummonMade, ctx: AB.AbilCtx): [string, string][] {
  const s = m.unit, sd = m.sd, pow = sumPow(s), ct = s.ctype;
  const aps = Math.max(0.2, 1 + sumS(b, s, 'atkSpd')) / s.atk.interval;
  const amp = s.mods.reduce((a, x) => a + (x.kind === 'inc' && x.tag === 'all' ? x.v : 0), 0);
  const pv = provMult(b, s);
  return [
    ['전투 유형', ct ? `${typeIcon(ct)}${CTYPE_NAME[ct]}` : '소환물'],
    ['상속률', `${sumPc(m.rate)} <span class="muted small">${esc(bondNote(c, m))}</span>`],
    [hpLabel(s), `${fmt(sumS(b, s, 'maxHp'))}${sd.hpMul && sd.hpMul !== 1 ? ` <span class="muted small">(체력 ×${sd.hpMul})</span>` : ''}`],
    ['피해 유형', AB.powType(ctx, pow)],
    ['피해', AB.powNum(ctx, pow, sd.basicMult || 1, false, false, s.atk.elem)],
    ...(amp ? [['피해 증가', `+${sumPc(amp)} <span class="muted small">(최고의 친구 단계 · 특성 · 증강)</span>`] as [string, string]] : []),
    ['공격 속도', `${aps.toFixed(2)}회/초 <span class="muted">(${(1 / aps).toFixed(2)}초)</span>`],
    ['예상 DPS', `<span class="pw el-t-${s.atk.elem}">${lineIcon(`e.${s.atk.elem}`, 'li')}<b>${fmt(sumDps(b, s, sd))}</b></span><span class="muted small">/초</span>`],
    ['방어도', fmt(sumS(b, s, 'armor'))],
    ['도발 배율', `×${+pv.toFixed(2)} <span class="muted small">${ct === 'VAN' ? '돌격가 소환물 (경계는 없음)' : ct ? `${CTYPE_NAME[ct]} 소환물` : '소환물 기본'}</span>`],
  ];
}
/** 소환물 섹션: 소환물마다 초상 · 이름 · 유형 · 상속률 칩 + 기본 공격 · 기술(주인 스킬 연계) 카드. scope = 상속률 기준 (지금 런 · 대기석 · 기본값) */
export function summonSection(d: UnitDef, b: Battle | null, c: CUnit | null, scope: string) {
  const sd0 = d.summon;
  if (!sd0 || !c) return '';
  const kinds = sumKinds(sd0), made = summonList(d, b, c);
  const names = kinds.map((k) => k.name).join(' · ');
  const body = made.length ? kinds.map((sd, k) => {
    const ms = made.filter((x) => x.sd === sd);
    const m = ms.find((x) => !x.extra) || ms[0];
    if (!m) return '';
    const s = m.unit, ex = ms.filter((x) => x.extra), ct = s.ctype, pow = sumPow(s);
    const ctx: AB.AbilCtx = { b, c: s, p: c.sk };
    const range = sumS(b, s, 'range');
    const info = ABIL[d.id]?.summon?.[sd.name]?.(c.sk);
    const pv = provMult(b, s);
    // 머리: 초상 (여러 기면 모서리에 수) | 이름 (여러 종류일 때만 — 한 종류면 섹션 머리에 이미 있다) · 전투 유형 · 분류 / 상속률 · 체력 · 위력 · 도발 칩
    const chips = `<div class="ab-chips sm-stats"><span class="abc sm-bond" title="${esc(`스탯 상속률: 주인의 체력 · 위력 · 방어도를 물려받는 비율 (명중 · 치명타 · 효과 명중 · 효과 저항 · 회피는 주인 값 그대로). ${bondNote(c, m)}`)}">${lineIcon('a.summon', 'li')}상속률 <b>${sumPc(m.rate)}</b></span>`
      + (ex.length ? `<span class="abc" title="${esc(`추가로 불린 소환물 ${ex.length}기: 상속률 ×${c.mem.extraRate ?? CFG.bond.extra}`)}">추가 ${ex.length}기 <b>${sumPc(ex[0].rate)}</b></span>` : '')
      + `<span class="abc" title="${hpLabel(s)}">${lineIcon('a.hp', 'li')}<b>${fmt(sumS(b, s, 'maxHp'))}</b></span>`
      + `<span class="abc" title="${pow === 'shoot' ? '사격' : '타격'} 위력">${lineIcon(`p.${pow}`, 'li')}<b>${fmt(sumS(b, s, pow))}</b></span>`
      + `<span class="abc" title="${esc(`도발 배율: 적이 이 소환물에게 쌓는 도발 수치에 곱해지는 값 (${ct ? `${CTYPE_NAME[ct]} 소환물` : '소환물'}). 돌격가 경계는 소환물에게 없다.`)}">${lineIcon('p.prov', 'li')}<b>×${+pv.toFixed(2)}</b></span></div>`;
    const head = `<div class="sm-id"><span class="sm-pic">${sprite(s, 'spr sm-face')}${ms.length > 1 ? `<b class="sm-n" title="전투 시작 시 불려 나오는 수">${ms.length}기</b>` : ''}</span><div class="sm-tx"><span class="sm-nm">${kinds.length > 1 ? `<b>${esc(sd.name)}</b>` : ''}<span class="dh-types">${ct ? `<i>${typeIcon(ct)}${CTYPE_NAME[ct]}</i>` : ''}${categoryTag(s.category)}</span></span>${chips}</div></div>`;
    const atk = `<div class="ps-card ab-click${abilOn(`summon:atk:${k}`)}" data-a="abil-pop" data-v="summon:atk:${k}" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">기본 공격</span><b>${WPOS(range)}</b></div><div class="ab-chips">${AB.chip('u.range', `${range}칸`, '사거리')}${AB.powNum(ctx, pow, sd.basicMult || 1, false, false, s.atk.elem)}${AB.chip('a.speed', `${s.atk.interval}초`, '공격 간격')}</div></div>`;
    const sk = info ? `<div class="ps-card ab-click${abilOn(`summon:skill:${k}`)}" data-a="abil-pop" data-v="summon:skill:${k}" role="button" tabindex="0"><div class="ab-head"><span class="ab-kind">기술 · 연계</span><b>${esc(d.skill.name)}</b></div><div class="ab-chips">${AB.skillChips(info, ctx, range, c.cdMax)}</div></div>` : '';
    return `<div class="sm-unit">${head}<div class="ps-cards">${atk}${sk}</div></div>`;
  }).join('') : `<p class="small muted">증강 효과로 이번 빌드에서는 소환물(${esc(names)})을 부르지 않는다.</p>`;
  return `<section class="abil sm-sec"><div class="ab-head"><span class="ab-kind">소환물</span><b>${esc(names)}</b><span class="ab-meta">${esc(scope)}</span></div>${body}</section>`;
}
/** 상세 창 위치별 상속률 기준 문구 */
export const sumScope = (u: UnitState | null) => (!u ? '기본값 (런 밖)' : u.pos ? '지금 런 · 출전 기준' : '대기석 · 시너지 미적용');
export function skillCard(d: UnitDef, b: Battle | null, c: CUnit | null) {
  const p = c?.sk || d.skill.params;
  const info = ABIL[d.id]?.skill?.(p);
  const cd = c?.cdMax ?? d.skill.cd;
  const range = b && c ? b.S(c, 'range') : d.range;
  // 칩(사거리 · 범위 · 쿨다운) + 설명: 상세 보기 = 문형 문장 (info.text), 아니면 한 줄 설명 (BRIEF) — docs/ABILITY_TEXT.md
  const body = app.detail && info?.text ? statIc(AB.detailText(info.text, { ...actx(b, c, true), range }, new Set())) : `<p>${esc(skillText(d, p))}</p>`;
  return abilCard('skill', 'skill', d.skill.name, info ? '' : `${cd.toFixed(1)}초`, `${info ? `<div class="ab-chips">${AB.skillChips(info, actx(b, c, true), range, cd)}</div>` : ''}${body}`, '', `skill.${d.id}`);
}
export const traitHtml = (d: UnitDef, b: Battle | null, c: CUnit | null) => {
  const t = ABIL[d.id]?.trait;
  const bt = ABIL[d.id]?.brief?.trait || BRIEF[d.id]?.trait;
  if (!app.detail && bt) return `<p>${esc(bt)}</p>`; // 상세 보기 꺼짐: 한 줄 설명
  return t ? (t.includes('\n') ? statIc(AB.detailText(t, actx(b, c, false, d), new Set())) : `${statIc(AB.detailText(t, actx(b, c, false, d), new Set()))}`) : `<p>${esc(traitText(d))}</p>`;
};
export function augText(id: string, param: string | undefined, b: Battle | null, c: CUnit | null, gl = new Set<string>()) {
  const t = augAbilText(id);
  return t ? statIc(AB.detailText(t, actx(b, c, AUG_BY_ID[id]?.pool === 'unit'), gl)) : esc(augDesc(id, param)); // 기물 전용 증강은 대부분 스킬 강화
}
/** 메커니즘 한 줄 설명 */
export function weaponMech(w: Weapon, ctx: AB.AbilCtx) {
  const tac = w.tactical ? ' 피해는 전술 위력으로 계산.' : '';
  if (w.kind === 'none') return '기본 공격을 하지 않는다.';
  if (w.kind === 'mag') {
    const rs = ctx.b && ctx.c ? Math.max(0.2, 1 + ctx.b.S(ctx.c, 'reloadSpd')) : 1;
    return `사거리 안의 대상을 사격. 탄창 ${w.mag}발을 모두 쓰면 ${((w.reload || 1.5) / rs).toFixed(1)}초 동안 재장전 — 그동안 기술도 쓰지 않는다 (쿨다운은 계속 돈다). 재장전 중 제어 효과(${controlNames()})를 받으면 재장전이 처음부터 다시.${tac}`;
  }
  return `사거리 안의 대상을 타격. ${w.combo}번째 공격마다 피니쉬(×${CFG.finishMult})로 마무리.${tac}`;
}
export function skillMech(range: 'unit' | number | null, cmd: boolean, mag = false) {
  const when = range === 'unit' ? '대상이 사거리 안에 있으면' : range === 0 ? '주변에 대상이 있으면' : '조건이 맞으면';
  return `쿨다운이 차고 ${when} 자동으로 시전.${mag ? ' 재장전 중에는 쓰지 않고 재장전이 끝나기를 기다린다.' : ''}${cmd ? ' 지휘관은 전술 위력으로 계산.' : ''}`;
}
/** 증강 카드 · 상세의 부가 줄: 조합 조건 (충족 못 하면 경고색). block = 상세 팝업용 문단 */
export function augNotes(id: string, u: UnitState | null, block = false) {
  const rq = augReqState(id, u);
  const tag = block ? 'p' : 'span';
  return rq ? `<${tag} class="aug-req ${rq.ok === false ? 'bad' : rq.ok ? 'ok' : 'info'}">${rq.ok === false ? '⚠ ' : ''}조합 조건: ${esc(rq.hint)}. ${esc(rq.cur)}</${tag}>` : '';
}
/** 사이오닉 기물의 보유 증강 (전투 중이면 그 전투 기물의 원본, 아니면 런의 기물) */
export const psiAugsFor = (d: UnitDef, c: CUnit | null): AugList => c?.src?.augments || app.run?.units.find((x) => x.defId === d.id)?.augments || [];
/** 비술 쿨다운: 전투 기물이면 엔진 계산 (열폭주 등 이성 반영), 아니면 증강 반영 기본값 */
export const psiCd = (b: Battle | null, c: CUnit | null, base: number) => (b && c?.cantrip ? c.cantrip.cd(b, c) : base);
/** ◆ 변형 표시 (카드 머리) */
export const psiTfTag = (tf: string | null) => (tf ? `<span class="psi-tf" title="◆ 변형 증강 「${esc(tf)}」이 적용된 모습">◆ ${esc(tf)}</span>` : '');
/** ◆ 변형 · 증강 반영 안내 (상세 팝업 첫 줄) */
export function psiTfNote(tf: string | null, mods: string[], base: string) {
  const tfl = tf ? `<p class="psi-tfn"><b>◆ 변형됨: ${esc(tf)}</b> <span class="muted small">원래 「${esc(base)}」에서 바뀐 모습</span></p>` : '';
  const ml = mods.length ? `<p class="psi-mods muted small">증강 반영: ${mods.map(esc).join(' · ')}</p>` : '';
  return tfl + ml;
}
/** 좌측 능력 상세 팝업 */
export function abilPopHtml(key: string, d: UnitDef, b: Battle | null, c: CUnit | null, aceK = 1) {
  // 'cantrip:<전공>' · 'psipass:<전공>': 아직 고르지 않은 전공 미리보기 (전공 선택 창)
  let forcedSchool: SchoolId | null = null;
  if (/^(cantrip|psipass):/.test(key)) { forcedSchool = key.split(':')[1] as SchoolId; key = key.split(':')[0]; }
  const ctx = actx(b, c);
  const gl = new Set<string>();
  let kind = '', name = '', body = '', mech = '', sumTok = '';
  if (key === 'weapon') {
    const w = c?.weapon || d.weapon;
    const range = b && c ? b.S(c, 'range') : w.range;
    kind = '무기'; name = w.name; mech = weaponMech(w, ctx);
    body = w.kind === 'none' ? '<p>기본 공격을 하지 않는다.</p>' : AB.popBody(range, { k: 'one' }, AB.weaponRows(w, ctx, c?.atk.elem || w.elem, gl));
  } else if (key === 'skill') {
    const p = c?.sk || d.skill.params;
    const info = ABIL[d.id]?.skill?.(p);
    const cd = c?.cdMax ?? d.skill.cd;
    kind = '스킬'; name = d.skill.name; mech = skillMech(info?.range ?? 'unit', d.ctype === 'CMD', (c?.weapon || d.weapon).kind === 'mag');
    const range = b && c ? b.S(c, 'range') : d.range;
    body = info ? (info.text ? detailHtml(info.text, { ...actx(b, c, true), range }, gl) : '') + AB.skillBody(info, actx(b, c, true), range, cd, gl) : `<p>${esc(d.skill.desc(p))}</p><p class="muted small">쿨다운 ${cd.toFixed(1)}초</p>`;
  } else if (key === 'ult' && ULTS[d.id]) {
    const ul = ULTS[d.id];
    const sec = (CFG.ultTime * CFG.ultNeed) / (ul.charge * Math.max(0.1, 1 + (c && b ? b.S(c, 'ultCharge') : 0)));
    kind = '궁극기'; name = ul.name; mech = `시간이 지나면 저절로 차오른다 (약 ${sec.toFixed(0)}초, 전투 시작 ${Math.round(CFG.ultStart * 100)}%). 가득 차면 다음 행동에 기술보다 먼저 발동하고, 한 전투에 여러 번 쓸 수 있다. 충전 효율이 높을수록 빨리 찬다.`;
    body = `${ul.text ? detailHtml(ul.text, actx(b, c, true), gl) : `<p>${statIc(esc(ul.desc))}</p>`}<p class="muted small">“${esc(ul.line)}”</p>`;
  } else if (key === 'cantrip') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = forcedSchool || cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '비술'; name = sc?.cantrip.name || '비술';
    mech = `${sc ? `${GROUPS[sc.group].name} ${sc.name}` : '전공'}의 비술. 전투 스킬과 별개로 쿨다운마다 자동으로 시전하고, 쓸 때마다 이성이 줄어든다. 광폭 중에는 쓰지 않는다.`;
    if (sc) {
      // 전공 선택 미리보기(forcedSchool)는 기본형, 그 밖에는 보유 증강을 반영한 실제 비술
      const cv = cantripView(sc.id, forcedSchool ? [] : psiAugsFor(d, c));
      const cd = psiCd(b, c, cv.cd);
      body = psiTfNote(cv.transform, cv.mods, sc.cantrip.name) + (cv.info.text ? detailHtml(cv.info.text, actx(b, c, true), gl) : '') + AB.skillBody(cv.info, ctx, b && c ? b.S(c, 'range') : d.range, cd, gl) + AB.rowsHtml([['이성 소모', `${lineIcon('a.reason', 'li')}-${cv.cost}`]]);
    }
  } else if (key === 'psipass') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = forcedSchool || cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '지속 능력'; name = sc?.passive.name || '지속 능력';
    mech = '전투 내내 적용된다. 확률 발동은 평타 · 전투 스킬 · 비술이 적중할 때만 판정하고, 지속 피해 · 소환물 공격은 판정하지 않는다.';
    const pv = sc ? passiveView(sc.id, forcedSchool ? [] : psiAugsFor(d, c)) : null;
    body = sc && pv ? psiTfNote(pv.transform, pv.mods, sc.passive.name) + detailHtml(pv.text, actx(b, c, true), gl) + AB.rowsHtml(pv.rows.map(([k, v]) => [k, statIc(AB.tok(v, ctx, gl))] as [string, string])) : '';
  } else if (key === 'reason') {
    const ru = app.run?.units.find((x) => x.defId === d.id);
    const sid = cSchool(c) || (ru ? schoolOf(ru) : null);
    const sc = sid ? SCHOOL_BY_ID[sid] : null;
    kind = '이성'; name = sc ? GROUPS[sc.group].name : '이성';
    mech = '-100 ~ 100. 비술을 쓰면 줄고, 기물마다 정해진 행동으로 오르내린다. 효과는 이성 값에 비례한다.';
    body = AB.rowsHtml([
      ...(sc ? [['고이성', esc(sc.high)], ['저이성', esc(sc.low)]] as [string, string][] : []),
      ...(d.psi ? [['이성 변화', esc(d.psi.desc)]] as [string, string][] : []),
      ['이성 0 미만', '초당 정신 피해 (이성에 비례, -50 이하 2배)'],
      ['광폭 (-100)', '피아 구분 없이 공격 (아군에게는 피해 50%), 비술 사용 불가. -60 위로 회복하면 해제'],
    ]);
  } else if (key === 'divact') {
    const rid = c?.relic || app.run?.units.find((x) => x.defId === d.id)?.relic || DEFAULT_RELIC[d.id];
    const rel = rid ? RELIC_BY_ID[rid] : null;
    const da = DIVINE_ACT[d.ctype];
    kind = '신권 대행'; name = rel?.name || da.name; mech = rel ? '고유 신앙에 맞는 행동으로 신성력을 모아 100이 되면 전투당 한 번 발동. 장착한 성유물에 따라 효과가 바뀌고, 지속 효과는 전투가 끝날 때까지 유지된다. 권능으로 강화하면 다음 전투 한정 계수 ×3.'
      : `고유 신앙에 맞는 행동으로 신성력을 모아 100이 되면 전투당 한 번 발동. 성유물이 없으면 (도로스의 [성찬]으로 깨어난 기물 등) ${CTYPE_NAME[d.ctype]} 기본형을 쓴다.`;
    body = rel ? `${detailHtml(rel.text(c?.mem.enh || 1), ctx, gl)}<p class="muted small">강화 비용 권능 ${rel.enh}</p>` : detailHtml(da.text, ctx, gl);
  } else if (key === 'trait') {
    kind = '특성'; name = d.trait.name; mech = '전투 내내 적용되는 이 기물의 고유 효과.';
    const t = ABIL[d.id]?.trait;
    body = `${t ? statIc(AB.detailText(t, ctx, gl)) : `<p>${esc(d.trait.desc)}</p>`}`;
  } else if (key === 'ace' && d.ace) {
    kind = '에이스'; name = d.ace.name; mech = '항해자 시너지 활성 시, 에이스 파일럿으로 지정한 출전 기물에게만 발동. 항해자 단계가 오를수록 강해짐.';
    const t = ABIL[d.id]?.ace?.(aceK);
    body = t ? statIc(AB.detailText(t, ctx, gl)) : `<p>${esc(d.ace.desc(aceK))}</p>`;
  } else if (key === 'voy' && VOYAGE_SPECIAL[d.id]) {
    const v = VOYAGE_SPECIAL[d.id];
    kind = '출항'; name = v.name; mech = '우리의 출항기! 구성원이 정확히 1명 또는 5명 출전하면, 출전한 구성원 전원에게 발동.';
    body = `<p>${statIc(esc(v.text))}</p>`;
  } else if (key.startsWith('aug:')) {
    const id = key.slice(4);
    kind = '증강'; name = AUG_BY_ID[id]?.name || id;
    const pool = AUG_BY_ID[id]?.pool;
    mech = pool === 'unit' ? '이 기물 전용 증강. 획득하면 영구 적용.' : pool === 'special' ? `메이저 기물이 ${CFG.augEvery}등급마다 고르는 전용 증강. 영구 적용.` : pool === 'oath' ? `디바인 기물이 ${CFG.oathEvery}등급마다 고르는 서약 증강. 영구 적용.` : pool === 'psionic' ? '사이오닉 증강. 이성 규칙을 바꾼다. 영구 적용.' : '공용 증강. 영구 적용.';
    body = `<p>${augText(id, c?.src?.augments.find((a) => a.id === id)?.param, b, c, gl)}</p>${augNotes(id, c?.src || app.run?.units.find((x) => x.defId === d.id) || null, true)}`;
    // ◆ 변형 증강: 바뀐 비술 · 지속 능력을 함께 (이 기물의 다른 전공 증강까지 반영)
    const tp = transformPreview(id);
    if (tp) {
      const all = [...psiAugsFor(d, c), id], s2 = SCHOOL_BY_ID[tp.sid];
      const cv = cantripView(tp.sid, all), pv = passiveView(tp.sid, all);
      if (cv.transform) body += `<h4 class="psi-tfh">변형 후 비술 「${esc(cv.name)}」</h4>${AB.skillBody(cv.info, ctx, b && c ? b.S(c, 'range') : d.range, psiCd(b, c, cv.cd), gl)}`;
      if (pv.transform) body += `<h4 class="psi-tfh">변형 후 지속 「${esc(s2.passive.name)}」</h4>${AB.rowsHtml(pv.rows.map(([k, v]) => [k, statIc(AB.tok(v, ctx, gl))] as [string, string]))}`;
    }
  } else if (key.startsWith('summon:') && d.summon && c) {
    // 소환물 (최고의 친구): 'summon:atk:<n>' 기본 공격 · 'summon:skill:<n>' 기술 (n = 소환물 종류 순서)
    const [, part, ks] = key.split(':');
    const sd = sumKinds(d.summon)[+ks];
    const ms = sd ? summonList(d, b, c).filter((x) => x.sd === sd) : [];
    const m = ms.find((x) => !x.extra) || ms[0];
    if (!sd || !m) return '';
    const s = m.unit, sctx: AB.AbilCtx = { b, c: s, p: c.sk };
    const range = b ? b.S(s, 'range') : s.st.range;
    sumTok = sprite(s, 'ab-tok ap-tok');
    if (part === 'skill') {
      const info = ABIL[d.id]?.summon?.[sd.name]?.(c.sk);
      if (!info) return '';
      kind = '소환물 기술'; name = `${sd.name} · ${d.skill.name}`;
      mech = `${d.name}의 스킬 [${d.skill.name}]에 맞춰 움직이는 연계 기술 (쿨다운 = ${d.name}의 스킬 쿨다운). 피해 수치는 ${sd.name}의 위력으로 계산한다.`;
      body = AB.skillBody(info, sctx, range, c.cdMax, gl);
    } else {
      kind = '소환물 기본 공격'; name = `${sd.name}${ms.length > 1 ? ` ×${ms.length}` : ''}`;
      mech = `전투 시작 시 ${d.name} 곁에 불려 나와 스스로 움직이며 적을 기본 공격한다${sd.focusLow ? ' (사거리 안에서 체력 비율이 가장 낮은 적을 노림)' : ''}. 체력 · 위력 · 방어도는 ${d.name}의 능력치를 상속률만큼 물려받고, 주인이 쓰러지면 함께 사라진다.`;
      body = AB.popBody(range, { k: 'one' }, summonRows(b, c, m, sctx));
    }
  } else return '';
  // 머리에 능력 아이콘 (아군 기물의 무기 · 특성 · 스킬 · 궁극기 · 비술 · 지속 · 신앙)
  const sc = forcedSchool || (c ? cSchool(c) : (app.run?.units.find((x) => x.defId === d.id) as { school?: SchoolId } | undefined)?.school ?? null);
  const icKey = key === 'cantrip' && sc ? `cantrip.${sc}` : key === 'psipass' && sc ? `passive.${sc}` : ['weapon', 'trait', 'skill', 'ult'].includes(key) ? `${key}.${d.id}` : '';
  const tok = sumTok || (icKey && UNIT_BY_ID[d.id] ? abTok(icKey).replace('ab-tok', 'ab-tok ap-tok') : '');
  return `<div class="stat-pop abil-pop"><div class="sp-head">${tok}<span class="ab-kind">${kind}</span><b>${esc(name)}</b><button class="btn tiny" data-a="abil-pop" data-v="">닫기</button></div>${mech ? `<p class="ap-mech">${mech}</p>` : ''}${body}</div>`;
}

/** 적 능력: 무기 · 특성 · 스킬 카드 */
export function enemyAbilCards(e: EnemyDef, b: Battle, c: CUnit) {
  const ab = ENEMY_ABIL[e.id];
  const w = { ...c.weapon!, name: '기본 공격' };
  const range = b.S(c, 'range');
  const trait = ab?.trait ? abilCard('trait', 'trait', '특성', '', `${statIc(AB.detailText(ab.trait, actx(b, c), new Set()))}`) : '';
  const skill = e.skill ? abilCard('skill', 'skill', e.skill.name, ab?.skill ? '' : `${e.skill.cd}초`,
    ab?.skill ? `<div class="ab-chips">${AB.skillChips(ab.skill, actx(b, c), range, e.skill.cd)}</div>` : `<p>${esc(e.skill.desc(c.sk))}</p>`) : '';
  return `${weaponCard(w, b, c, e.atk.elem)}${trait}${skill}`;
}
export function enemyAbilPop(key: string, e: EnemyDef, b: Battle, c: CUnit) {
  const ab = ENEMY_ABIL[e.id];
  const ctx = actx(b, c);
  const gl = new Set<string>();
  let kind = '', name = '', body = '', mech = '';
  if (key === 'weapon') {
    kind = '무기'; name = '기본 공격'; mech = weaponMech(c.weapon!, ctx);
    body = AB.popBody(b.S(c, 'range'), { k: 'one' }, AB.weaponRows({ ...c.weapon!, name }, ctx, e.atk.elem, gl));
  } else if (key === 'skill' && e.skill) {
    kind = '스킬'; name = e.skill.name; mech = skillMech(ab?.skill?.range ?? 'unit', false, c.weapon?.kind === 'mag');
    body = ab?.skill ? AB.skillBody(ab.skill, ctx, b.S(c, 'range'), e.skill.cd, gl) : `<p>${esc(e.skill.desc(c.sk))}</p>`;
  } else if (key === 'trait' && ab?.trait) {
    kind = '특성'; name = '특성'; mech = '전투 내내 적용되는 이 적의 고유 효과.';
    body = `${statIc(AB.detailText(ab.trait, ctx, gl))}`;
  } else return '';
  return `<div class="stat-pop abil-pop"><div class="sp-head"><span class="ab-kind">${kind}</span><b>${esc(name)}</b><button class="btn tiny" data-a="abil-pop" data-v="">닫기</button></div>${mech ? `<p class="ap-mech">${mech}</p>` : ''}${body}</div>`;
}

/** 우리의 출항기! 고유 능력: 구성원이 정확히 1명 또는 5명 출전하면 발동 */
export function voyAbil(d: UnitDef, run: RunState | null, u: UnitState | null) {
  const v = VOYAGE_SPECIAL[d.id];
  if (!v) return '';
  const n = run ? synergyCounts(deployed(run), run).VOYAGE || 0 : 0;
  const on = !!(run && u?.pos && (n === 1 || n >= 5));
  const st = run ? (on ? '활성' : `비활성 · 출전 ${n}명`) : '1명 · 5명 출전 시';
  return `<div class="ab-ace-wrap${on ? ' on' : ''}">${abilCard('voy', 'skill', v.name, st, `<p>${statIc(esc(v.text))}</p>`).replace('ab-skill', 'ab-ace')}</div>`;
}

/** 항해자 에이스 파일럿: 능력 란에 표시하고 여기서 지정 */
export function aceAbil(run: RunState, u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  if (!d.ace) return '';
  const nav = tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0);
  const k = [1, 1, 1.6, 2.5][nav] ?? 1;
  const on = nav > 0 && !!u.pos && aceTargetUid(run) === u.uid;
  const ctl = !nav || !u.pos ? '<span class="muted small">항해자 시너지가 활성화된 출전 기물만 지정할 수 있습니다.</span>'
    : on ? '<span class="small staff-on">✈ 지정됨</span>' : `<button class="btn tiny" data-a="ace-target" data-v="${u.uid}">✈ 에이스 파일럿으로 지정</button>`;
  const t = ABIL[d.id]?.ace?.(k);
  return `<div class="ab-ace-wrap${on ? ' on' : ''}">${abilCard('ace', 'skill', d.ace.name, on ? '활성' : '비활성', (t ? statIc(AB.detailText(t, actx(null, null), new Set())) : `<p>${esc(d.ace.desc(k))}</p>`)).replace('ab-skill', 'ab-ace')}${ctl}</div>`;
}

/** 상세 보기: 전투 유형에 따른 주요 위력 (+ 무기가 다른 위력을 쓰면 함께). 전술 위력은 지금 출전 구성 기준 실시간 값 */
export const POW_NAME = { shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력', tac: '전술 위력' } as const;
export function powRow(b: Battle, c: CUnit, d: UnitDef, deployedNow: boolean) {
  type K = keyof typeof POW_NAME;
  const main: K = d.ctype === 'CMD' ? 'tac' : d.ctype === 'MARK' ? 'shoot' : d.ctype === 'VAN' ? 'strike' : 'tech';
  const keys: K[] = [main];
  const w = c.weapon;
  if (w && w.kind !== 'none') { const wk: K = w.tactical ? 'tac' : w.type === 'shoot' ? 'shoot' : 'strike'; if (!keys.includes(wk)) keys.push(wk); }
  const val = (k: K) => Math.round(k === 'tac' ? b.tacPower(c) : b.S(c, k));
  return `<div class="d-pows">${keys.map((k, i) => `<span class="d-pow pw-${k}${i ? ' sub' : ''}" title="${POW_NAME[k]}${k === 'tac' ? (deployedNow ? ' · 지금 출전 구성 기준' : ' · 이 기물이 출전했을 때 기준') : ''}">${lineIcon(`p.${k}`, 'li')}<span>${POW_NAME[k]}</span><b>${fmt(val(k))}</b></span>`).join('')}${provChip(null, c)}</div>`;
}
/** 도발 배율 칩 (위력 칩과 같은 모양): 정상값(×1)이 아닐 때만. 배율 규칙은 엔진 PROV 에서 읽는다 */
export function provChip(b: Battle | null, c: CUnit) {
  const m = provMult(b, c);
  if (Math.abs(m - 1) < 0.05) return '';
  const rule = `돌격가 ×${PROV.van} · 수호자 시너지 +${PROV.guard}${c.mem.provPlus ? ` · 장비 +${c.mem.provPlus}` : ''} · 소환물 근접 ×${PROV.sumMelee} · 고정 ×${PROV.sumFixed} (전투 유형이 정해진 최고의 친구 소환물은 그 유형 값: 돌격가 ×${PROV.van} · 전문가 ×1) · 그 밖 ×1, 은신 · 기습 중 ×${PROV.hide}`;
  const zoc = c.side === 0 && zocCapable(c) && !c.isSummon ? ` 돌격가 경계 교전 시간 ${+zocHoldOf(m).toFixed(3)}초 (${zocHoldFormula()}).` : '';
  return `<span class="d-pow pw-prov" title="도발 배율: 적이 이 기물에게 쌓는 도발 수치에 곱해지는 값 (${rule}).${zoc}">${lineIcon('p.prov', 'li')}<span>도발 배율</span><b>×${+m.toFixed(2)}</b></span>`;
}
/** 확대 버튼 (전체 상세 팝업): 상세 창 위쪽 바 (자세히 보기 옆) */
export const MAX_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
export const maxBtn = (uid: string) => `<button class="btn d-mag d-max" data-a="big-open" data-v="${uid}" title="전체 상세 (확대)" aria-label="전체 상세 열기">${MAX_SVG}</button>`;
/** 기물 전체 상세 팝업: 장비 · 주요 · 상세 능력치 · 능력 구성 · 유형 특성을 한 화면에 */
/** 전체 상세 머리 요약: 한 줄 설명 (brief.ts BLURB, 능력 이름은 데이터에서) → 이번 빌드에서 달라진 점 (변형 증강이면 그 변화를 먼저) */
export function unitSummary(run: RunState, u: UnitState, d: UnitDef, b: Battle, c: CUnit) {
  const blurb = unitBlurb(d);
  const sc = schoolOf(u);
  const cv = sc ? cantripView(sc, u.augments) : null, pv = sc ? passiveView(sc, u.augments) : null;
  // 변형: 바뀐 능력 (상태 칩) · 증강: 아이콘 줄 (누르면 설명) · 장비: 작은 칸 줄 — 문장으로 잇지 않는다
  const tf = [cv?.transform ? ['비술', cv.transform] : null, pv?.transform ? ['지속 능력', pv.transform] : null].filter((x): x is [string, string] => !!x);
  const augs = u.augments.filter((a) => !a.id.startsWith('school.') && AUG_BY_ID[a.id]);
  const slots = [...u.items, ...(u.mod ? [u.mod] : [])];
  const gear = slots.some(Boolean);
  void run; void b; void c;
  const grp = (k: string, body: string) => `<div class="us-g"><span class="us-gk">${k}</span>${body}</div>`;
  return `<section class="um-sum" aria-label="요약">
    ${blurb ? `<p class="us-blurb">${esc(blurb).replace(/「([^」]*)」/g, '<b>「$1」</b>')}</p>` : ''}
    <div class="us-row us-build"><span class="us-k">이번 빌드</span>${tf.length || augs.length || gear ? `<div class="us-bd">
      ${tf.length ? grp('변형', tf.map(([k, n]) => tchip('<span aria-hidden="true">◆</span>', `${k} → ${esc(n)}`, 'tf', `${k}이 「${n}」으로 변형됨`)).join('')) : ''}
      ${augs.length ? grp(`증강 ${augs.length}`, `<div class="tt-icons">${augs.map((a) => `<button class="tt-ic ab-click${abilOn(`aug:${a.id}`)}" data-a="abil-pop" data-v="aug:${esc(a.id)}" title="${esc(augMark(a.id) + (AUG_BY_ID[a.id]?.name || a.id))}">${augIcon(a.id)}</button>`).join('')}</div>`) : ''}
      ${gear ? grp('장비', `<span class="us-gear">${slots.map((id) => itemIcon(id)).join('')}</span>`) : ''}
    </div>` : '<p class="muted">기본 상태 (증강 · 장비 없음)</p>'}</div>
  </section>`;
}
/** 기물 전체 상세 팝업. pv = 영입 전 미리보기 (복제한 런에 합류시킨 모습, 방출 · 경험치 구매 없음) */
export function unitModal(run: RunState, pv = false) {
  const u = run.units.find((x) => x.uid === (pv ? app.preview?.uid : app.bigUnit));
  if (!u) return '';
  const d = withEmblemSummon(UNIT_BY_ID[u.defId], u.mod); // 최고의 친구 문장: 소환물 섹션에 반려 돌(인화성)
  const { b, c } = previewAlly(run, u);
  const cnt = synergyCounts(deployed(run), run) as Record<string, number>;
  const effects = unitEffects(run, u, cnt, !!u.pos);
  const tm = totalMajors(u, effects);
  const cost = R.xpCost(run);
  const cat = unitCategory(d);
  const rel = d.ttype === 'divine' && u.relic ? RELIC_BY_ID[u.relic] : null;
  const majors = `<div class="majors">${MAJORS.map((m) => {
    const add = tm[m] - d.base[m];
    return `<div class="major"><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`;
  }).join('')}</div>`;
  const pop = app.abilPop ? `<div class="um-pop">${abilPopHtml(app.abilPop, d, b, c)}</div>` : '';
  const rankRow = `<div class="um-rank">${rankLabel(u.rank)}${xpBar(u)}${pv ? '' : `<button class="btn tiny" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost || R.isRock(u) ? 'disabled' : ''}>경험치 +${cost}c</button>`}</div>`;
  const synRow = `<div class="pc-syn">${memberships(u, run).map((id) => synToken(id, cnt[id] || 0)).join('')}</div>`;
  return `<div class="um-back" data-a="big-close"></div>
  <section class="um" role="dialog" aria-modal="true" aria-label="${esc(d.name)} 전체 상세">
    <div class="um-grid">
      <div class="um-col um-a">
        <div class="um-sticky"><div class="um-sc" aria-hidden="true">${sprite(d, 'um-face')}<div class="um-sc-main"><b class="um-sc-name">${esc(d.name)}</b>${rankRow}${synRow}</div></div></div>
        <div class="um-art">${hero(d.id) || sprite(d, 'spr big')}</div>
        <div class="um-idblk"><div class="um-id"><b>${esc(d.name)}</b><span class="muted small">${esc(d.title || '')}</span></div>
        ${rankRow}
        ${synRow}</div>
        <h3>장비</h3>${eqBox(u)}
        ${rel ? `<div class="um-relic">${relicTok(rel.id)}<span><b>${esc(rel.name)}</b><br><span class="muted small">성유물 · 신권 대행</span></span></div>` : ''}
        <h3>주요 능력치</h3>${majors}
        ${powRow(b, c, d, !!u.pos)}
        <h3>상세 능력치</h3>${statLines(c, b)}
      </div>
      <div class="um-main">
        <div class="um-top">
          <header class="um-head">
            <span class="um-tools">${pv ? '<span class="um-pv">영입 전 미리보기</span>' : blessBtn(run, u, d)}${pv ? '' : focusBtn(run, u)}${detailToggle()}${pv ? '' : `<button class="btn small danger-ghost" data-a="release" data-v="${u.uid}" ${run.units.length <= 1 ? 'disabled title="마지막 남은 기물은 방출할 수 없습니다"' : 'title="기물 방출 (확인 후 진행)"'} aria-expanded="${app.releaseConfirm === u.uid}">기물 방출</button>`}<button class="btn" data-a="big-close" aria-label="닫기" title="닫기 (Esc)">✕</button></span>
          </header>
          ${app.releaseConfirm === u.uid ? `<div class="um-release">${releaseBlock(run, u)}</div>` : ''}
        </div>
        ${unitSummary(run, u, d, b, c)}
        <div class="um-col um-c">
          <h3>전투 유형</h3>
          <div class="subs um-rules">
            ${sub('um:ct', CTYPE_ICON(d.ctype), `ct-${d.ctype}`, CTYPE_NAME[d.ctype], '공통 규칙', ctypeRuleHtml(d.ctype, app.detail))}
            ${sub('um:cat', lineIcon(`k.${cat}`, 'li'), `cat-${cat}`, CATEGORY_NAME[cat], '분류 규칙', `<p>${esc(CATEGORY_RULE[cat])}</p>`)}
          </div>
          <h3>전투 능력</h3>
          <div class="abils">
            ${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}
            ${traitGroup(d, u, run, b, c)}
            ${skillCard(d, b, c)}
            ${aceAbil(run, u)}${voyAbil(d, run, u)}
            ${summonSection(d, b, c, sumScope(u))}
          </div>
        </div>
        <div class="um-col um-r">
          <h3>전술 유형</h3>
          <div class="subs um-rules">${sub('um:tt', TTYPE_ICON(d.ttype), `tt-${d.ttype}`, TTYPE_NAME[d.ttype], '공통 규칙', `<p>${esc(TTYPE_RULE[d.ttype])}</p>`)}</div>
          <div class="abils">
            ${ultCard(d, b, c)}
            ${ttSection(d, u, run, b, c, false, false)}${relicSection(d, u, run, c, false, b)}
          </div>
          <h3>신앙</h3>
          <div class="abils">${faithAbil(d, u, run)}</div>
        </div>
      </div>
    </div>${pop}
  </section>`;
}
/** 전체 상세 왼쪽 열: 스탠딩 일러스트를 일정 이상(일러스트 높이의 30%) 내려 보면 일러스트가 접히고 머리 초상화 · 공명 등급 · 시너지 머리줄이 위에 붙는다.
 *  넓은 화면은 왼쪽 열이, 좁은 화면(≤700px)은 팝업 전체(.um-grid)가 스크롤된다 */
export let umIO: { disconnect(): void } | null = null;
export function umCompactBind() {
  const a = root.querySelector<HTMLElement>('.um-a');
  const grid = root.querySelector<HTMLElement>('.um-grid');
  const blk = a?.querySelector<HTMLElement>('.um-idblk');
  if (!a || !grid || !blk) return;
  const scroller = () => (a.scrollHeight > a.clientHeight + 1 && getComputedStyle(a).overflowY !== 'visible' ? a : grid);
  umIO?.disconnect();
  umIO = compactHead(a, blk, () => { const r = scroller().getBoundingClientRect(); return [r.top, r.bottom]; }, [a, grid]);
}
/** 작은 고정 머리 (전체 상세 · 편성 기물 상세 공용): 본문의 초상 · 공명 등급 · 시너지 블록이 거의 다 가려지면 col 에 compact 를 켠다
 *  (보이는 높이 ≤ 블록의 25% 또는 ≤ 24px), 40% 이상 보이면 끈다 (히스테리시스). 켜진 동안 남은 블록 조각은 CSS 로 숨긴다.
 *  view = 지금 보이는 세로 범위 [위, 아래] (위쪽 고정 바 아래부터). 반환: 레이아웃 변화 감시 (다시 묶을 때 끊는다) */
export function compactHead(col: HTMLElement, blk: HTMLElement, view: () => [number, number], scrollers: (HTMLElement | Window)[]) {
  const upd = (instant = false) => {
    if (!col.isConnected) return;
    const [top, bottom] = view(), br = blk.getBoundingClientRect();
    const h = Math.max(1, br.height);
    const vis = Math.max(0, Math.min(br.bottom, bottom) - Math.max(br.top, top));
    const was = col.classList.contains('compact');
    const on = was ? vis < h * 0.4 : vis <= h * 0.25 || vis <= 24;
    if (on === was) return;
    if (instant) { col.classList.add('um-instant'); requestAnimationFrame(() => requestAnimationFrame(() => col.classList.remove('um-instant'))); }
    col.classList.toggle('compact', on);
    col.querySelector('.um-sc')?.setAttribute('aria-hidden', String(!on));
  };
  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; upd(); }); };
  for (const s of scrollers) s.addEventListener('scroll', onScroll, { passive: true });
  // 크기 변화 · 레이아웃 변화로 블록이 가려지거나 드러날 때도 (스크롤 없이)
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(() => upd(), { root: null, threshold: [0, 1] }) : null;
  io?.observe(blk);
  upd(true);
  return { disconnect: () => { io?.disconnect(); for (const s of scrollers) s.removeEventListener('scroll', onScroll); } };
}
/** 편성 기물 상세의 작은 고정 머리: 위쪽 바(닫기 · 자세히 보기 · 확대) 바로 아래에 붙는다. 넓은 화면은 옆 패널이, 좁은 화면은 창이 스크롤된다 */
export let dpHead: { disconnect(): void } | null = null;
export function detailHeadBind() {
  dpHead?.disconnect(); dpHead = null;
  const det = root.querySelector<HTMLElement>('.detail.dp-unit'), bar = det?.querySelector<HTMLElement>('.d-bar'), st = det?.querySelector<HTMLElement>('.dp-sticky'), blk = det?.querySelector<HTMLElement>('.d-hero');
  if (!det || !bar || !st || !blk) return;
  st.style.top = `calc(${getComputedStyle(bar).top} + ${bar.offsetHeight}px)`; // 바 높이 · 바의 고정 위치를 그대로 따른다
  const side = det.closest<HTMLElement>('.side');
  const own = () => !!side && side.scrollHeight > side.clientHeight + 1 && getComputedStyle(side).overflowY !== 'visible';
  dpHead = compactHead(det, blk, () => [bar.getBoundingClientRect().bottom, own() ? side!.getBoundingClientRect().bottom : innerHeight], side ? [side, window] : [window]);
}
/** 장비 · 개조부품 칸 (끌어 놓기 지원) */
export function eqBox(u: UnitState) {
  return `<div class="d-eqbox"><div class="d-eq" aria-label="장비 · 개조부품">${u.items.map((it, k) => (it ? `<span class="tk-it" data-a="item-info" data-v="${u.uid}:${k}" data-drag="eq:${u.uid}:${k}" data-drop="eqitem:${u.uid}:${k}" data-hold>${itemIcon(it)}</span>` : `<span data-drop="unit:${u.uid}">${itemIcon(null)}</span>`)).join('')}${u.mod ? `<span class="tk-it" data-a="item-info" data-v="${u.uid}:-1" data-drag="eq:${u.uid}:-1" data-drop="eqitem:${u.uid}:-1" data-hold>${itemIcon(u.mod)}</span>` : `<span data-drop="unit:${u.uid}" title="개조부품 칸 · 문장을 끌어다 장착"><span class="item empty tM"></span></span>`}</div><button class="reco-btn" data-a="reco" data-v="${u.uid}" title="추천 장비 · 보유 현황">${lineIcon('r.reco', 'li')}추천 장비</button></div>`;
}
/** 편성 화면 오른쪽 기본 패널 (아무것도 고르지 않았을 때): 이번 전투의 적 구성 + 상성 요약.
 *  기물 · 적을 고르면 그 상세로 바뀌고, 선택을 풀면 다시 이 패널. 전투 밖 편성 관리에서는 이 전장의 주요 적 */
export const PREP_TIPS = '<p class="pb-tips small muted">기물을 누르면 스탯 · 스킬 · 증강 · 장비를 봅니다. 기물을 끌어 배치를 바꾸고(보드 ↔ 대기열), 장비를 기물에게 끌어 장착합니다.</p>';
export function prepBrief(run: RunState) {
  const enc = run.node?.enc;
  if (!enc) return `<div class="detail pb"><h3>이 전장의 주요 적</h3>${matchupHtml(run.field, false) || '<p class="small muted">특별한 면역 · 취약 없음</p>'}${PREP_TIPS}</div>`;
  const type = run.node!.type;
  // 같은 적은 한 줄로 묶는다 (장비는 편성 보드의 적 카드에 보인다). 누르면 그 적의 첫 개체 상세
  const groups = new Map<string, { id: string; i: number; n: number; idx: number[] }>();
  enc.enemies.forEach((s, i) => {
    if (s.part) return; // 대형 적의 나머지 칸 (본체 칸이 대표)
    const g = groups.get(s.defId) || { id: s.defId, i, n: 0, idx: [] };
    g.n++;
    g.idx.push(i);
    groups.set(s.defId, g);
  });
  // 공명 등급 추정: 개체마다 (장비 · 개조부품이 다를 수 있다) 구해 평균, 올림
  const groupRank = (e: EnemyDef, idx: number[]) => {
    const rs = idx.map((i) => foeRank(run, e, enc.phase ?? run.phase, enc.mult, enc.enemies[i])).filter((r): r is NonNullable<typeof r> => !!r);
    return rs.length ? { lv: Math.ceil(rs.reduce((a, r) => a + r.lv, 0) / rs.length), hpX: rs.reduce((a, r) => a + r.hpX, 0) / rs.length } : null;
  };
  const rank = (e: EnemyDef) => (e.tier === 'boss' ? 0 : e.tier === 'elite' ? 1 : e.inert ? 3 : 2);
  const rows = [...groups.values()].map((g) => ({ e: ENEMY_BY_ID[g.id], ...g })).filter((x) => x.e).sort((a, b) => rank(a.e) - rank(b.e));
  // 아군 공격 속성: 미리보기 전투에서 실제 값을 읽는다 (장비 · 증강 반영)
  const b = deployed(run).length ? buildBattle(run, { ...enc, enemies: [] }, false) : null;
  const allies = b ? b.units.filter((u) => u.side === 0 && !u.isSummon) : [];
  const mu = encounterMatchup(enc.enemies.filter((s) => !s.part).map((s) => s.defId), allies.map((u) => u.atk.elem)); // 대형 적은 본체 칸만
  const kind = type === 'challenge' ? `${NODE_NAME.challenge} · P${enc.phase ?? run.phase}` : type === 'boss' ? '보스전' : NODE_NAME[type];
  const foe = (x: (typeof rows)[number]) => {
    const cat = enemyCategory(x.e), td = tendOf(x.e);
    const atk = x.e.noAttack ? '' : tchip(lineIcon(`e.${x.e.atk.elem}`, 'li'), '', '', `${ELEM_NAME[x.e.atk.elem]} ${x.e.atk.type === 'shoot' ? '사격' : '타격'}`, `--c:var(--el-${x.e.atk.elem})`);
    return `<li><button class="pb-foe tier-${x.e.tier}" data-a="sel-enemy" data-v="${x.i}" title="${esc(`${x.e.name} — ${ENEMY_DESC[x.e.id] || ''}`)}">${sprite(x.e, 'spr')}
      <span class="pb-nm"><b>${esc(x.e.name)}</b>${x.e.tier !== 'minion' ? `<em>${tierKo(x.e)}</em>` : ''}${x.e.inert ? '<em>장애물</em>' : ''}</span><span class="pb-n">${x.n > 1 ? `×${x.n}` : ''}</span>
      <span class="pb-sub">${rankChip(groupRank(x.e, x.idx))}${tchip(lineIcon(`k.${cat}`, 'li'), CATEGORY_NAME[cat], `cat-${cat}`, `${CATEGORY_NAME[cat]}: ${CATEGORY_RULE[cat]}`)}${td ? tchip(lineIcon(`t.${x.e.tend}`, 'li'), td.name, '', `${td.name}: ${td.desc}`) : ''}${atk}</span></button></li>`;
  };
  // 상성 · 아군 공격 속성: 같은 줄 토큰 (아이콘 · 이름 · 인원 · 유리(초록) / 불리(빨강) / 면역 칩)
  const muRows = [
    ...mu.cats.map((x) => muRow(lineIcon(`k.${x.c}`, 'li'), CATEGORY_NAME[x.c], `${x.n}명`, muTags(x), `cat-${x.c}`)),
    mu.bosses ? muRow(NODE_ICON.boss, NODE_NAME.boss, `${mu.bosses}명`, muTag(`${mu.bossImmune.join('·')} 면역`, 'mute'), '', '--c:var(--c-bad)') : '',
  ].join('');
  const elRows = mu.elems.map((x) => muRow(lineIcon(`e.${x.e}`, 'li'), x.name, `${x.allies}명`, `${x.weak ? muTag(`적 ${x.weak}명 취약`, 'good') : ''}${x.resist ? muTag(`적 ${x.resist}명 저항`, 'bad') : ''}`, '', `--c:var(--el-${x.e})`)).join('');
  return `<div class="detail pb" aria-label="이번 전투 적 구성">
    <div class="pb-head"><h3>이번 전투</h3><span class="pb-kind n-${type}">${esc(kind)}</span><span class="muted small">적 ${mu.foes}명 · 체력 ×${+enc.mult.toFixed(2)}</span>${diffAddChip(run, enc.phase ?? run.phase, enc.add || 0)}</div>
    <div class="pb-map">${lineIcon('n.battle', 'li')}<b>${esc(encName(enc))}</b><span>${esc(mapOf(enc.map).desc)}</span></div>
    ${squadList(enc)}
    <ul class="pb-foes">${rows.map(foe).join('')}</ul>
    <h3>상성</h3>
    <ul class="pb-rows">${muRows || '<li class="pb-row muted">특별한 면역 · 취약 없음</li>'}</ul>
    ${elRows ? `<h3>아군 공격 속성 <span class="muted small">출전 ${allies.length}명</span></h3><ul class="pb-rows">${elRows}</ul>` : ''}
    ${PREP_TIPS}
  </div>`;
}
/** 포병 듀오 적 상세 (engine/build.ts linkDuo): 이 칸 (포병 · 부사수) · 두 칸 합친 체력 · 받는 피해 배율 · 움직이지 않음 */
export function duoInfo(run: RunState, s: EnemySpawn, b: Battle, c: CUnit) {
  const enc = run.node?.enc, mate = s.duo && enc?.enemies.find((o) => o.sq === s.sq && o.duo !== s.duo);
  if (!s.duo || !enc || !mate) return '';
  const m = buildEnemy(b, ENEMY_BY_ID[mate.defId], enc.phase ?? run.phase, enc.mult, mate), D = CFG.squads.duo, back = s.duo === 'b';
  const rows: [string, string][] = [['이 칸', back ? '포병 (뒤 칸)' : '부사수 (앞 칸)'], ['짝', `${ENEMY_BY_ID[mate.defId].name} (${back ? '앞' : '뒤'} 칸)`], ['체력', `두 칸 합계 ${fmt(b.S(c, 'maxHp') + b.S(m, 'maxHp'))} · 나눠 씀`], ['받는 피해', `뒤 칸 ×${D.back} · 앞 칸 ×${D.front}`], ['이동', '움직이지 않음'], ['쓰러짐', '한 칸이 쓰러지면 둘 다']];
  return `<h3>포병 듀오 <span class="muted small">두 칸 한 기물</span></h3><dl class="um-types ct-rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** 대형 적 상세 (EnemyDef.size · engine/build.ts linkGroup): 차지한 칸 · 이 칸 · 체력 공유 · 칸별 받는 피해 배율 */
export function bigInfo(s: EnemySpawn) {
  const z = ENEMY_BY_ID[s.defId]?.size;
  if (!z || s.part === undefined) return '';
  const B = CFG.foeKit.big;
  const rows: [string, string][] = [['차지한 칸', `가로 ${z.w} × 세로 ${z.h}`], ['이 칸', s.part ? '나머지 칸' : '본체 칸'], ['체력', '모든 칸이 같은 체력을 나눠 씀'], ['받는 피해', `본체 칸 ×${B.core} · 나머지 칸 ×${B.part} (광역은 칸마다)`], ['이동', '움직이지 않음'], ['쓰러짐', '체력이 다하면 모든 칸이 함께']];
  return `<h3>대형 <span class="muted small">${z.w * z.h}칸 한 기물</span></h3><dl class="um-types ct-rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
/** '이번 전투' 적 분대 (data/squads.ts): 분대마다 종류 아이콘 · 이름 · 인원 · 분대원 얼굴 (같은 적은 한 번). 누르면 보드에서 그 분대만 강조 (다시 누르면 해제).
 *  증원 분대는 '증원' 꼬리표. 포병 듀오는 두 칸 한 기물이라 '2칸' */
export function squadList(enc: Encounter) {
  if (!enc.squads?.length) return '';
  const items = enc.squads.map((q, i) => {
    const mem = enc.enemies.filter((e) => e.sq === i);
    if (!mem.length) return '';
    const k = SQUAD_KIND[q.kind as SquadKind] || SQUAD_KIND.mixed, on = app.sqSel === i;
    const faces = [...new Set(mem.map((e) => e.defId))].slice(0, 3).map((id) => sprite(ENEMY_BY_ID[id], 'spr')).join('');
    const n = q.kind === 'duo' ? '2칸' : q.kind === 'big' ? `${mem.length}칸` : `${mem.length}명`;
    return `<li><button class="pb-sq sq-${q.kind}${on ? ' on' : ''}" data-a="sel-squad" data-v="${i}" aria-pressed="${on}" title="${esc(`${q.name} — ${k.name}${q.kind === 'duo' ? ` · 두 칸이 체력을 나눠 쓰는 한 기물 · 뒤 칸 받는 피해 ×${CFG.squads.duo.back}` : ''}`)}">
      <span class="pb-sq-ic">${lineIcon(k.icon, 'li')}</span><span class="pb-sq-nm"><b>${esc(q.name)}</b>${q.name !== k.name ? `<em>${esc(k.name)}</em>` : ''}${q.add ? '<em class="pb-sq-add">증원</em>' : ''}</span><span class="pb-sq-faces">${faces}</span><span class="pb-n">${n}</span></button></li>`;
  }).join('');
  return `<h3 class="pb-sq-h">분대 <span class="muted small">${enc.squads.length}개</span></h3><ul class="pb-sqs">${items}</ul>`;
}
/** 적이 단 장비: 적 정의의 장비 · 개조부품 + 이번 조우의 위험 등급 장비 (편성 보드 · 적 구성 · 적 상세 공용, 강제 징수기로 떼어 낸 적은 정의 장비도 없음) */
export function foeGear(e: EnemyDef, s: { items?: string[]; mod?: string; stripped?: boolean }) {
  return [...(s.stripped ? [] : [...(e.items || []).filter((x): x is string => !!x), ...(e.mod ? [e.mod] : [])]), ...(s.items || []), ...(s.mod ? [s.mod] : [])];
}
/** 작은 칩: 아이콘 + 글씨. tone = good(유리) · bad(불리) · mute(면역 등), 그 밖 클래스 · --c(데이터 색) 지정 가능 */
export function tchip(icon: string, txt: string, cls = '', title = '', st = '') {
  return `<span class="tchip ${cls}"${title ? ` title="${esc(title)}"` : ''}${st ? ` style="${st}"` : ''}>${icon}${txt}</span>`;
}
/** 적 장비 설명 (편성 적 구성 · 보드 · 적 상세): 누르면 이름 · 설명 (마우스는 title 로도 보인다) */
export function foeItemTip(el: HTMLElement, id: string) {
  document.querySelector('.item-tip')?.remove();
  if (!id) return;
  const it = itemInfo(id);
  const tip = document.createElement('div');
  tip.className = `item-tip tip-${tierKey(id)}`;
  tip.innerHTML = `<span class="tip-tier">적 장비</span><b>${esc(it.name)}</b><span>${statIc(esc(it.desc))}</span>`;
  tip.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(tip);
  const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
  const top = r.top - tr.height - 6 < 8 ? r.bottom + 6 : r.top - tr.height - 6;
  tip.style.left = `${left + scrollX}px`; tip.style.top = `${top + scrollY}px`;
  setTimeout(() => window.addEventListener('pointerdown', () => tip.remove(), { once: true }), 0);
}
export function detailPanel(run: RunState, extra = '') {
  const sel = app.sel;
  const bar = dBar('desel', extra);
  if (sel?.k === 'terrain') { const g = runGeo(run), grp = terrainGroups(g)[sel.g]; return grp ? terrainDetail(g, grp, 'desel', undefined, run.node?.enc ? run : undefined) : ''; }
  if (sel?.k === 'enemy' && run.node?.enc) {
    const s = run.node.enc.enemies[sel.i];
    if (!s) return '';
    const e = ENEMY_BY_ID[s.defId];
    const ph = run.node.enc.phase ?? run.phase; // 도전은 다음 페이즈 적
    const b = new Battle(9, 9, new Rng(1), { phase: ph, credits: 0, camp: !!run.campaign, field: run.field, diff: run.diff, despairs: run.despairs, oaths: run.oaths }); // 실제 전투와 같은 전장 · 위험 등급 · 절망 증강 · 절망 서약 (체력 · 피해 배율)
    const c = buildEnemy(b, e, ph, run.node.enc.mult, s);
    const ms = battleMajors(c)!;
    const eq = foeGear(e, s);
    return `<div class="detail">${bar}
      ${foeHead(e, sprite(e, 'spr big'), unitRank(e, c))}
      ${startChips(run)}
      ${duoInfo(run, s, b, c)}${bigInfo(s)}
      ${eq.length ? `<h3>장비</h3><div class="d-eqbox"><div class="d-eq">${eq.map((x) => `<span class="tk-it">${itemIcon(x, `data-a="foe-item" data-v="${x}"`)}</span>`).join('')}</div></div>` : ''}
      <div class="mj-wrap"><div class="mj-head"><h3>주요 능력치 <span class="muted small">페이즈 ${ph} · 체력 ${fmt(b.S(c, 'maxHp'))}</span></h3>${magBtn()}</div>${majorsHtml(ms, foeAmp(ms, c))}</div>
      <h3>능력</h3><div class="abils">${enemyAbilCards(e, b, c)}</div>
    </div>`;
  }
  if (sel?.k === 'turret') return turretDetail(run, sel.i, bar);
  if (sel?.k === 'king') return kingDetail(run, bar);
  if (sel?.k !== 'unit') return prepBrief(run);
  const u = run.units.find((x) => x.uid === sel.uid);
  if (!u) return '';
  const d = withEmblemSummon(UNIT_BY_ID[u.defId], u.mod); // 최고의 친구 문장: 소환물 섹션에 반려 돌(인화성)
  const { b, c } = previewAlly(run, u);
  const effects = unitEffects(run, u, synergyCounts(deployed(run), run), !!u.pos);
  const tm = totalMajors(u, effects);
  const title = rankTitle(u.rank + effects.reduce((s, e) => s + (e.rankBonus || 0), 0)) + effects.reduce((s, e) => s + (e.title || 0), 0);
  const cost = R.xpCost(run);
  const synTok = (() => { const cnt = synergyCounts(deployed(run), run) as Record<string, number>; return memberships(u, run).map((id) => synToken(id, cnt[id] || 0)).join(''); })();
  return `<div class="detail dp-unit">${dBar('desel', blessBtn(run, u, d) + maxBtn(u.uid) + extra)}
    <div class="um-sticky dp-sticky"><div class="um-sc" aria-hidden="true">${sprite(d, 'um-face')}<div class="um-sc-main"><div class="um-rank">${rankLabel(u.rank)}${xpBar(u)}</div><div class="pc-syn">${synTok}</div></div></div></div>
    <div class="d-hero">${hero(d.id) || `<div class="hero none">${sprite(d, 'spr big')}</div>`}
      <div class="pc-syn dh-syn">${synTok}</div>
      <div class="dh-name"><b>${esc(d.name)}</b><span class="dh-types"><i>${typeIcon(d.ttype)}${TTYPE_NAME[d.ttype]}</i><i>${typeIcon(d.ctype)}${CTYPE_NAME[d.ctype]}</i></span></div></div>
    <div class="dh-rank"><span class="dh-r">${rankLabel(u.rank)}</span>${xpBar(u)}<button class="btn tiny dh-buy" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost || R.isRock(u) ? 'disabled' : ''} title="공명도 +${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)} 구입 (에너지 크레딧 ${cost})">${lineIcon('r.res', 'li res')}+${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)}<span class="dh-cost">${lineIcon('r.cr', 'li cr')}${cost}</span></button></div>
    ${powRow(b, c, d, !!u.pos)}
    ${startChips(run)}
    ${memberships(u, run).includes('KAL') ? `<div class="small accent">작위: ${TITLE_NAME[Math.min(6, title)]}</div>` : ''}
    <h3>장비</h3>${eqBox(u)}

    <div class="mj-wrap">
    <div class="mj-head"><h3>주요 능력치</h3><button class="mag-btn${app.statPop ? ' on' : ''}" data-a="stat-pop" title="상세 능력치" aria-label="상세 능력치 ${app.statPop ? '닫기' : '보기'}" aria-pressed="${app.statPop}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l4.5 4.5"/></svg></button></div>
    <div class="majors">${MAJORS.map((m) => {
      const base = d.base[m], add = tm[m] - base;
      return `<div class="major"><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`;
    }).join('')}</div>
    </div>
    <h3>능력</h3>
    <div class="abils">
      ${weaponCard(c.weapon || d.weapon, b, c, c.atk.elem, d.id)}
      ${traitGroup(d, u, run, b, c)}
      ${aceAbil(run, u)}${voyAbil(d, run, u)}
      ${skillCard(d, b, c)}
      ${summonSection(d, b, c, sumScope(u))}
      ${ultCard(d, b, c)}
      ${ttSection(d, u, run, b, c)}${relicSection(d, u, run, c, false, b)}
      ${faithAbil(d, u, run)}
    </div>
    <p class="lore">${esc(d.lore)}</p>
    ${releaseBlock(run, u)}
  </div>`;
}
