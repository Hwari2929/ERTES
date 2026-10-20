// 능력 설명 렌더러: 토큰 문장 → 아이콘 · 실제 수치, 사거리 · 범위 미니 격자, 좌측 상세 팝업
import { CFG } from '../config';
import { type Area, GLOSS, type SkillInfo } from '../data/abiltext';
import { elementDamageMult, type Battle, type CUnit } from '../engine/combat';
import { type Elem, ELEM_NAME, type Weapon } from '../types';
import { fmt } from './battleview';
import { augKey, lineIcon } from './synicons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** 수치를 계산할 기물 (없으면 계수로 표시) */
/** skill: 스킬 문맥 (지휘관이면 전술 위력으로 계산) — 무기 · 특성 · 패시브는 적힌 위력 그대로 */
export interface AbilCtx { b: Battle | null; c: CUnit | null; p: Record<string, number>; skill?: boolean }
/** main = 사이오닉 주요 위력 (명사수 사격 · 돌격가 타격 · 전문가 기술 · 지휘관 전술) × CFG.psiPower */
type Pow = 'shoot' | 'strike' | 'tech' | 'main';
const POW_KO: Record<Pow | 'tac', string> = { shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력', tac: '전술 위력', main: '주요 위력' };

export function powKey(ctx: AbilCtx, pow: Pow, tactical = false): Pow | 'tac' {
  if (pow === 'main') {
    const c = ctx.c;
    if (!c) return 'main';
    if (c.ctype === 'MARK') return 'shoot';
    if (c.ctype === 'VAN') return 'strike';
    return c.ctype === 'CMD' && (!c.isSummon || c.mem.tacOk) ? 'tac' : 'tech';
  }
  return tactical || (ctx.skill && ctx.c?.ctype === 'CMD' && (!ctx.c.isSummon || !!ctx.c.mem.tacOk)) ? 'tac' : pow;
}
export function powVal(ctx: AbilCtx, pow: Pow, tactical = false): number | null {
  if (!ctx.b || !ctx.c) return null;
  const k = powKey(ctx, pow, tactical);
  const v = k === 'tac' ? ctx.b.tacPower(ctx.c) : ctx.b.S(ctx.c, k as 'shoot' | 'strike' | 'tech');
  return pow === 'main' ? v * CFG.psiPower : v;
}
/** 기본 피해량 (치명타 · 속성 보정 제외). 아이콘 · 색은 속성, 위력 종류는 '피해 유형' 항목에 따로 */
/** 상세 보기: 예상 수치 대신 계수 (위력 × %) 로 표시 */
export const ABOPT = { coef: false };
export function powNum(ctx: AbilCtx, pow: Pow, mult: number, plus = false, tactical = false, elem?: Elem) {
  if (elem && (!ctx.c || ctx.c.side === 0)) mult *= elementDamageMult(elem); // 비물리 4속성: 아군 기물의 계수만 ×1.25 (적 능력 표시는 그대로)
  const k = powKey(ctx, pow, tactical);
  const v = ABOPT.coef ? null : powVal(ctx, pow, tactical);
  const txt = v === null ? `${POW_KO[k]} ${pct(mult)}` : fmt(v * mult);
  const cls = elem ? `pw el-t-${elem}` : `pw pw-${k}`;
  const icon = elem ? `e.${elem}` : `p.${k}`;
  return `<span class="${cls}" title="${POW_KO[k]} × ${pct(mult)}${elem ? ` · ${ELEM_NAME[elem]}` : ''}">${lineIcon(icon, 'li')}<b>${plus ? '+' : ''}${txt}</b></span>`;
}
/** 피해 유형: 위력 아이콘 + 이름 */
export function powType(ctx: AbilCtx, pow: Pow, tactical = false) {
  const k = powKey(ctx, pow, tactical);
  return `<span class="pw pw-${k}">${lineIcon(`p.${k}`, 'li')}${POW_KO[k]}</span>`;
}
const healNum = (ctx: AbilCtx, mult: number, icon: string, plus = false, pow: Pow = 'tech') => {
  const v = ABOPT.coef ? null : powVal(ctx, pow);
  return `<span class="pw pw-heal" title="${POW_KO[powKey(ctx, pow)]} × ${pct(mult)}">${lineIcon(icon, 'li')}<b>${plus ? '+' : ''}${v === null ? `${ABOPT.coef ? POW_KO[powKey(ctx, pow)] + ' ' : ''}${pct(mult)}` : fmt(v * mult)}</b></span>`;
};
export const elemChip = (e: Elem) => `<span class="elc el-${e}">${ELEM_NAME[e]}</span>`;
/** 키워드 아이콘: 지정값 우선, 없으면 이름 · 설명의 핵심어로 */
const KW_ICON: Record<string, string> = {
  stun: 'a.stun', fear: 'a.fear', shock: 'a.shock', slow: 'a.speed', corrode: 'e.chem', poison: 'e.chem', bleed: 'a.bleed', vuln: 'a.dmg',
  suppress: 'a.stun', pen: 'a.snipe', tac: 'p.tac', combo: 'u.combo', finish: 'u.finish', mag: 'u.mag', psy: 'e.psy', crit: 'a.crit',
  reason: 'a.reason', frenzy: 'a.reason', spawn: 'a.summon', turret: 'a.summon', camp: 'n.supply', red: 'a.shield', lifesteal: 'a.heal',
  cleanse: 'a.heal', rewind: 'a.reload', immobile: 'u.range', forget: 'a.cd',
};
export function kwIcon(key: string) {
  const g = GLOSS[key];
  return lineIcon(KW_ICON[key] || augKey(`${g?.name || ''} ${g?.desc || ''}`), 'li');
}
/** 키워드: 아이콘 + 노란 글자, 호버 · 탭하면 설명 팝업 (main.ts) */
const kw = (key: string, gl: Set<string>) => { gl.add(key); return `<span class="kw" data-kw="${esc(key)}" tabindex="0">${kwIcon(key)}${esc(GLOSS[key]?.name || key)}</span>`; };

/** 숫자 인자: 그대로 또는 @스킬파라미터(*배율) */
function num(x: string, ctx: AbilCtx): number {
  if (x.startsWith('@')) {
    const [k, m] = x.slice(1).split('*');
    return (ctx.p[k] || 0) * (m ? +m : 1);
  }
  return +x;
}

/** 토큰 문장 → HTML (등장한 용어는 gl 에 모은다) */
export function tok(text: string, ctx: AbilCtx, gl: Set<string>): string {
  return esc(text).replace(/\[([a-z+]+):([^\]]*)\]/g, (_m, k: string, rest: string) => {
    const a = rest.split(':');
    switch (k) {
      case 'dmg': {
        const hits = a[3] ? +a[3] : 1;
        return `${powNum(ctx, a[0] as Pow, num(a[1], ctx), false, false, a[2] as Elem)}${hits > 1 ? `<b class="hits">×${hits}</b>` : ''}`;
      }
      case 'dmg+': return powNum(ctx, a[0] as Pow, num(a[1], ctx), true, false, a[2] as Elem | undefined);
      case 'heal': return `${healNum(ctx, num(a[0], ctx), 'a.heal', false, (a[1] as Pow) || 'tech')} 회복`;
      case 'heal+': return healNum(ctx, num(a[0], ctx), 'a.heal', true, (a[1] as Pow) || 'tech');
      case 'shield': return `${healNum(ctx, num(a[0], ctx), 'a.shield', false, (a[1] as Pow) || 'tech')} 보호막`;
      case 'shield+': return healNum(ctx, num(a[0], ctx), 'a.shield', true, (a[1] as Pow) || 'tech');
      case 'st': {
        const ch = a[2] ? num(a[2], ctx) : 1;
        return `${ch < 1 ? `${pct(ch)} 확률로 ` : ''}${num(a[1], ctx)}초 ${kw(a[0], gl)}`;
      }
      case 'g': return kw(a[0], gl);
      case 't': return `<span class="tln">${lineIcon('u.range', 'li')}${num(a[0], ctx)}칸</span>`;
      case 's': return `${num(a[0], ctx)}초`;
      case 'p': return pct(num(a[0], ctx));
      case 'pp': { const v = num(a[0], ctx); return `${v >= 0 ? '+' : '-'}${pct(Math.abs(v))}p`; }
    }
    return _m;
  });
}

// ───────── 미니 격자
function grid(n: number, cell: (x: number, y: number) => string, label: string) {
  let h = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h += `<i class="${cell(x, y)}"></i>`;
  return `<figure class="mg"><div class="mg-g" style="--n:${n}">${h}</div><figcaption>${label}</figcaption></figure>`;
}
const cheb = (x: number, y: number, cx: number, cy: number) => Math.max(Math.abs(x - cx), Math.abs(y - cy));
/** 사거리: 시전자(금색) 기준 닿는 칸 */
export function rangeGrid(r: number | null) {
  if (r === null) return grid(5, () => 'in', '거리 무관');
  if (r === 0) return grid(3, (x, y) => (x === 1 && y === 1 ? 'me' : ''), '자신');
  const h = Math.min(r, 4);
  const n = 2 * h + 1;
  return grid(n, (x, y) => (x === h && y === h ? 'me' : cheb(x, y, h, h) <= r ? 'in' : ''), `사거리 ${r}칸`);
}
/** 범위: 대상(진한 빨강) · 피해 칸(빨강) */
export function areaGrid(a: Area) {
  switch (a.k) {
    case 'one': return grid(3, (x, y) => (x === 1 && y === 1 ? 'tg' : ''), '단일');
    case 'around': { const n = 2 * a.r + 3, c = a.r + 1; return grid(n, (x, y) => (x === c && y === c ? 'tg' : cheb(x, y, c, c) <= a.r ? 'hit' : ''), `대상 주변 ${a.r}칸`); }
    case 'self': { const n = 2 * a.r + 3, c = a.r + 1; return grid(n, (x, y) => (x === c && y === c ? 'me' : cheb(x, y, c, c) <= a.r ? 'hit' : ''), `자신 주변 ${a.r}칸`); }
    case 'line': return grid(5, (x, y) => (x === 2 && y === 4 ? 'me' : x === 2 && y === 1 ? 'tg' : x === 2 && y < 4 ? 'hit' : ''), '직선 관통');
    case 'all': return grid(5, () => (a.ally ? 'in' : 'hit'), a.ally ? '아군 전체' : '적 전체');
  }
}
export function areaLabel(a: Area) {
  return a.k === 'one' ? '단일' : a.k === 'around' ? `주변 ${a.r}칸` : a.k === 'self' ? `자신 주변 ${a.r}칸` : a.k === 'line' ? '직선' : a.ally ? '아군 전체' : '적 전체';
}
const rangeLabel = (r: number | null) => (r === null ? '거리 무관' : r === 0 ? '자신' : `${r}칸`);
export const chip = (icon: string, txt: string, title = '') => `<span class="abc"${title ? ` title="${esc(title)}"` : ''}>${lineIcon(icon, 'li')}${txt}</span>`;

// ───────── 무기
export function weaponRows(w: Weapon, ctx: AbilCtx, elem: Elem, gl: Set<string>) {
  const b = ctx.b, c = ctx.c;
  const pow: Pow = w.type === 'shoot' ? 'shoot' : 'strike';
  const tac = !!w.tactical;
  if (tac) gl.add('tac');
  const atkSpd = b && c ? Math.max(0.2, 1 + b.S(c, 'atkSpd')) : 1;
  const aps = atkSpd / w.interval;
  const rows: [string, string][] = [['피해 유형', powType(ctx, pow, tac)], ['피해', powNum(ctx, pow, w.mult, false, tac, elem)],
    ['공격 속도', `${aps.toFixed(2)}회/초 <span class="muted">(${(w.interval / atkSpd).toFixed(2)}초)</span>`]];
  if (w.type === 'shoot') rows.push(['RPM', `${Math.round(aps * 60)}발/분`]);
  if (w.kind === 'mag') {
    const rs = b && c ? Math.max(0.2, 1 + b.S(c, 'reloadSpd')) : 1;
    gl.add('mag');
    rows.push(['탄창', `${lineIcon('u.mag', 'li')}${w.mag}발`], ['재장전', `${((w.reload || 1.5) / rs).toFixed(2)}초`]);
  } else if (w.kind === 'combo') {
    gl.add('combo'); gl.add('finish');
    rows.push(['콤보', `${lineIcon('u.combo', 'li')}${w.combo}단`], ['피니쉬', `<span class="coef">×${CFG.finishMult}</span>${powNum(ctx, pow, w.mult * CFG.finishMult, false, tac, elem)}`]);
  }
  const dps = weaponDps(w, ctx);
  if (dps !== null) rows.push(['예상 DPS', `<span class="pw el-t-${elem}" title="재장전 · 피니쉬 · 치명타 기대값 포함, 방어도 · 속성 보정 · 명중 제외">${lineIcon(`e.${elem}`, 'li')}<b>${fmt(dps)}</b></span><span class="muted small">/초</span>`]);
  return rows;
}
/** 예상 DPS: 탄창(재장전 포함) · 콤보(피니쉬 포함) 주기 평균 × 치명타 기대값 */
export function weaponDps(w: Weapon, ctx: AbilCtx): number | null {
  const b = ctx.b, c = ctx.c;
  if (!b || !c || w.kind === 'none') return null;
  const pow: Pow = w.type === 'shoot' ? 'shoot' : 'strike';
  const base = (w.tactical ? b.tacPower(c) : b.S(c, pow)) * w.mult;
  const ivl = w.interval / Math.max(0.2, 1 + b.S(c, 'atkSpd'));
  const crit = 1 + Math.min(1, Math.max(0, b.S(c, 'crit'))) * Math.max(0, b.S(c, 'critDmg') - 1);
  if (w.kind === 'mag') {
    const n = w.mag || 1;
    const reload = (w.reload || 1.5) / Math.max(0.2, 1 + b.S(c, 'reloadSpd'));
    return (base * n * crit) / (n * ivl + reload);
  }
  const n = w.combo || 3;
  return (base * (n - 1 + CFG.finishMult) * crit) / (n * ivl);
}
export function weaponChips(w: Weapon, ctx: AbilCtx, range: number, elem: Elem) {
  const pow: Pow = w.type === 'shoot' ? 'shoot' : 'strike';
  if (w.kind === 'none') return '';
  const dps = weaponDps(w, ctx);
  return [chip('u.range', `${range}칸`, '사거리'), powNum(ctx, pow, w.mult, false, !!w.tactical, elem),
    w.kind === 'mag' ? chip('u.mag', `${w.mag}발`, '탄창') : chip('u.combo', `${w.combo}단`, '콤보'),
    dps !== null ? `<span class="abc" title="예상 DPS">DPS <b>${fmt(dps)}</b></span>` : ''].join('');
}
/** 팝업 본문: 왼쪽 사거리 · 범위 격자 (세로), 오른쪽 수치 */
export function popBody(range: number | null, area: Area, rows: [string, string][]) {
  // 자신 대상이면 범위 격자에 시전자가 이미 보이므로 사거리 격자는 생략
  return `<div class="ap-body"><div class="ap-grids">${range === 0 ? '' : rangeGrid(range)}${areaGrid(area)}</div>${rowsHtml(rows)}</div>`;
}

// ───────── 전투 기술
export function skillChips(info: SkillInfo, ctx: AbilCtx, range: number, cd: number) {
  const r = info.range === 'unit' ? range : info.range;
  const gl = new Set<string>();
  const first = info.rows[0] ? tok(info.rows[0][1], ctx, gl) : '';
  return `${chip('u.range', rangeLabel(r), '사거리')}${chip('u.area', areaLabel(info.area), '범위')}${chip('a.cd', `${cd.toFixed(1)}초`, '쿨다운')}${first ? `<span class="abc v">${first}</span>` : ''}`;
}
export function skillBody(info: SkillInfo, ctx: AbilCtx, range: number, cd: number, gl: Set<string>) {
  const r = info.range === 'unit' ? range : info.range;
  const pow = info.rows.map(([, v]) => /\[dmg:(\w+):/.exec(v)?.[1]).find(Boolean) as Pow | undefined;
  const healer = !pow && info.rows.some(([, v]) => /\[(heal|shield):/.test(v));
  // 회복 · 보호막 위력 (토큰 둘째 인자, 없으면 기술 위력)
  const hpow = (info.rows.map(([, v]) => /\[(?:heal|shield):[^:\]]*:(\w+)\]/.exec(v)?.[1]).find(Boolean) as Pow | undefined) || 'tech';
  const rows: [string, string][] = [['대상', esc(info.tgt)], ['쿨다운', `${lineIcon('a.cd', 'li')}${cd.toFixed(1)}초`],
    ...(pow ? [['피해 유형', powType(ctx, pow)] as [string, string]] : healer ? [['위력 기준', powType(ctx, hpow)] as [string, string]] : []),
    // 항목명이 회복 · 보호막이면 값 뒤 같은 말은 생략
    ...info.rows.map(([k, v]) => [k, tok(v, ctx, gl).replace(k === '회복' || k === '보호막' ? new RegExp(`</span> ${k}`, 'g') : /$^/, '</span>')] as [string, string])];
  return popBody(r, info.area, rows);
}
export function rowsHtml(rows: [string, string][]) {
  return `<dl class="ap-rows">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}
/** 용어 설명 (--- 아래) */
export function glossHtml(gl: Set<string>) {
  const list = [...gl].filter((k) => GLOSS[k]);
  if (!list.length) return '';
  return `<hr class="ap-hr"><dl class="ap-gloss">${list.map((k) => `<dt>${esc(GLOSS[k].name)}</dt><dd>${esc(GLOSS[k].desc)}</dd>`).join('')}</dl>`;
}
