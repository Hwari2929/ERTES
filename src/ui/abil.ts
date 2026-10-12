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
/** 위력 아이콘 + 기본 피해량 (치명타 · 속성 보정 제외) */
export function powNum(ctx: AbilCtx, pow: Pow, mult: number, plus = false, tactical = false) {
  const k = powKey(ctx, pow, tactical);
  const v = powVal(ctx, pow, tactical);
  const txt = v === null ? `${POW_KO[k]} ${pct(mult)}` : fmt(v * mult);
  return `<span class="pw pw-${k}" title="${POW_KO[k]} × ${pct(mult)}">${lineIcon(`p.${k}`, 'li')}<b>${plus ? '+' : ''}${txt}</b></span>`;
}
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
        return `${powNum(ctx, a[0] as Pow, num(a[1], ctx))}${hits > 1 ? `<b class="hits">×${hits}</b>` : ''} ${elemChip(a[2] as Elem)}`;
      }
      case 'dmg+': return powNum(ctx, a[0] as Pow, num(a[1], ctx), true);
      case 'heal': return `${powNum(ctx, 'tech', num(a[0], ctx))} 회복`;
      case 'heal+': return powNum(ctx, 'tech', num(a[0], ctx), true);
      case 'shield': return `${powNum(ctx, 'tech', num(a[0], ctx))} 보호막`;
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
  const rows: [string, string][] = [['피해', `${powNum(ctx, pow, w.mult, false, tac)} ${elemChip(elem)}`],
    ['공격 속도', `${(atkSpd / w.interval).toFixed(2)}회/초 <span class="muted">(간격 ${(w.interval / atkSpd).toFixed(2)}초)</span>`]];
  if (w.kind === 'mag') {
    const rs = b && c ? Math.max(0.2, 1 + b.S(c, 'reloadSpd')) : 1;
    gl.add('mag');
    rows.push(['탄창', `${lineIcon('u.mag', 'li')}${w.mag}발`], ['재장전', `${((w.reload || 1.5) / rs).toFixed(2)}초`]);
  } else if (w.kind === 'combo') {
    gl.add('combo'); gl.add('finish');
    rows.push(['콤보', `${lineIcon('u.combo', 'li')}${w.combo}단`], ['피니쉬', `${powNum(ctx, pow, w.mult * CFG.finishMult, false, tac)} ${elemChip(elem)}`]);
  }
  return rows;
}
export function weaponChips(w: Weapon, ctx: AbilCtx, range: number) {
  const pow: Pow = w.type === 'shoot' ? 'shoot' : 'strike';
  if (w.kind === 'none') return '';
  return [chip('u.range', `${range}칸`, '사거리'), powNum(ctx, pow, w.mult, false, !!w.tactical),
    w.kind === 'mag' ? chip('u.mag', `${w.mag}발`, '탄창') : chip('u.combo', `${w.combo}단`, '콤보')].join('');
}

// ───────── 전투 기술
export function skillChips(info: SkillInfo, ctx: AbilCtx, range: number, cd: number) {
  const r = info.range === 'unit' ? range : info.range;
  const gl = new Set<string>();
  const first = info.rows[0] ? tok(info.rows[0][1], ctx, gl).replace(/<span class="elc[^]*?<\/span>/, '') : '';
  return `${chip('u.range', rangeLabel(r), '사거리')}${chip('u.area', areaLabel(info.area), '범위')}${chip('a.cd', `${cd.toFixed(1)}초`, '쿨다운')}${first ? `<span class="abc v">${first}</span>` : ''}`;
}
export function skillBody(info: SkillInfo, ctx: AbilCtx, range: number, cd: number, gl: Set<string>) {
  const r = info.range === 'unit' ? range : info.range;
  return `<div class="ap-top">${rangeGrid(r)}${areaGrid(info.area)}
    <dl class="ap-meta"><dt>대상</dt><dd>${esc(info.tgt)}</dd><dt>사거리</dt><dd>${rangeLabel(r)}</dd><dt>범위</dt><dd>${areaLabel(info.area)}</dd><dt>쿨다운</dt><dd>${cd.toFixed(1)}초</dd></dl></div>
    ${rowsHtml(info.rows.map(([k, v]) => [k, tok(v, ctx, gl)]))}`;
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
