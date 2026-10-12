// 능력 설명 렌더러: 토큰 문장 → 아이콘 · 실제 수치, 사거리 · 범위 미니 격자, 좌측 상세 팝업
import { CFG } from '../config';
import { type Area, GLOSS, type SkillInfo } from '../data/abiltext';
import type { Battle, CUnit } from '../engine/combat';
import { type Elem, ELEM_NAME, type Weapon } from '../types';
import { fmt } from './battleview';
import { lineIcon } from './synicons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** 수치를 계산할 기물 (없으면 계수로 표시) */
export interface AbilCtx { b: Battle | null; c: CUnit | null; p: Record<string, number> }
type Pow = 'shoot' | 'strike' | 'tech';
const POW_KO: Record<Pow | 'tac', string> = { shoot: '사격 위력', strike: '타격 위력', tech: '기술 위력', tac: '전술 위력' };

export function powKey(ctx: AbilCtx, pow: Pow, tactical = false): Pow | 'tac' {
  return tactical || (ctx.c?.ctype === 'CMD' && !ctx.c.isSummon) ? 'tac' : pow;
}
export function powVal(ctx: AbilCtx, pow: Pow, tactical = false): number | null {
  if (!ctx.b || !ctx.c) return null;
  return tactical ? ctx.b.tacPower(ctx.c) : ctx.b.P(ctx.c, pow);
}
/** 기본 피해량 (치명타 · 속성 보정 제외). 아이콘 · 색은 속성, 위력 종류는 '피해 유형' 항목에 따로 */
export function powNum(ctx: AbilCtx, pow: Pow, mult: number, plus = false, tactical = false, elem?: Elem) {
  const k = powKey(ctx, pow, tactical);
  const v = powVal(ctx, pow, tactical);
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
const healNum = (ctx: AbilCtx, mult: number, icon: string, plus = false) => {
  const v = powVal(ctx, 'tech');
  return `<span class="pw pw-heal" title="${POW_KO[powKey(ctx, 'tech')]} × ${pct(mult)}">${lineIcon(icon, 'li')}<b>${plus ? '+' : ''}${v === null ? pct(mult) : fmt(v * mult)}</b></span>`;
};
export const elemChip = (e: Elem) => `<span class="elc el-${e}">${ELEM_NAME[e]}</span>`;
const kw = (key: string, gl: Set<string>) => { gl.add(key); return `<b class="kw">${esc(GLOSS[key]?.name || key)}</b>`; };

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
      case 'heal': return `${healNum(ctx, num(a[0], ctx), 'a.heal')} 회복`;
      case 'heal+': return healNum(ctx, num(a[0], ctx), 'a.heal', true);
      case 'shield': return `${healNum(ctx, num(a[0], ctx), 'a.shield')} 보호막`;
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
    case 'all': return grid(5, () => 'hit', '적 전체');
  }
}
export function areaLabel(a: Area) {
  return a.k === 'one' ? '단일' : a.k === 'around' ? `주변 ${a.r}칸` : a.k === 'self' ? `자신 주변 ${a.r}칸` : a.k === 'line' ? '직선' : '전체';
}
const rangeLabel = (r: number | null) => (r === null ? '거리 무관' : r === 0 ? '자신' : `${r}칸`);
const chip = (icon: string, txt: string, title = '') => `<span class="abc"${title ? ` title="${esc(title)}"` : ''}>${lineIcon(icon, 'li')}${txt}</span>`;

// ───────── 무기
export function weaponRows(w: Weapon, ctx: AbilCtx, elem: Elem, gl: Set<string>) {
  const b = ctx.b, c = ctx.c;
  const pow: Pow = w.type === 'shoot' ? 'shoot' : 'strike';
  const tac = !!w.tactical;
  if (tac) gl.add('tac');
  const atkSpd = b && c ? Math.max(0.2, 1 + b.S(c, 'atkSpd')) : 1;
  const rows: [string, string][] = [['피해 유형', powType(ctx, pow, tac)], ['피해', powNum(ctx, pow, w.mult, false, tac, elem)],
    ['공격 속도', `${(atkSpd / w.interval).toFixed(2)}회/초 <span class="muted">(${(w.interval / atkSpd).toFixed(2)}초)</span>`]];
  if (w.kind === 'mag') {
    const rs = b && c ? Math.max(0.2, 1 + b.S(c, 'reloadSpd')) : 1;
    gl.add('mag');
    rows.push(['탄창', `${lineIcon('u.mag', 'li')}${w.mag}발`], ['재장전', `${((w.reload || 1.5) / rs).toFixed(2)}초`]);
  } else if (w.kind === 'combo') {
    gl.add('combo'); gl.add('finish');
    rows.push(['콤보', `${lineIcon('u.combo', 'li')}${w.combo}단`], ['피니쉬', `<span class="coef">×${CFG.finishMult}</span>${powNum(ctx, pow, w.mult * CFG.finishMult, false, tac, elem)}`]);
  }
  return rows;
}
export function weaponChips(w: Weapon, ctx: AbilCtx, range: number, elem: Elem) {
  const pow: Pow = w.type === 'shoot' ? 'shoot' : 'strike';
  if (w.kind === 'none') return '';
  return [chip('u.range', `${range}칸`, '사거리'), powNum(ctx, pow, w.mult, false, !!w.tactical, elem),
    w.kind === 'mag' ? chip('u.mag', `${w.mag}발`, '탄창') : chip('u.combo', `${w.combo}단`, '콤보')].join('');
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
  const rows: [string, string][] = [['대상', esc(info.tgt)], ['쿨다운', `${lineIcon('a.cd', 'li')}${cd.toFixed(1)}초`],
    ...(pow ? [['피해 유형', powType(ctx, pow)] as [string, string]] : healer ? [['위력 기준', powType(ctx, 'tech')] as [string, string]] : []),
    ...info.rows.map(([k, v]) => [k, tok(v, ctx, gl)] as [string, string])];
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
