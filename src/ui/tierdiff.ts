// 단계 효과 비교 (docs/UI.md 3. '지금 → 다음'):
// 두 단계 문구를 숫자 / 글자 토막으로 나누고, 효과가 여러 개면 한 효과씩 자른 뒤,
// 숫자를 뺀 뼈대가 같은 효과끼리 짝지어 바뀐 숫자만 a → b 로 보인다. 짝이 하나도 없으면 문구를 그대로 둔다 (지금 / 다음).
// 문구는 데이터(synergies.ts tierDesc)에서 그대로 받는다. 시너지 팝업(main.ts synPopHtml)과 도감(codex2 synDetail)이 함께 쓴다.

/** 문구 토막: n = 숫자(부호 · 단위 포함) */
export interface Tok { n: boolean; v: string }
/** 비교 한 줄. chg = 숫자가 바뀜 · same = 그대로 · add = 다음 단계에만 · cur = 지금 단계에만 · one = 한쪽만 보일 때 */
export interface TierRow { k: 'chg' | 'same' | 'add' | 'cur' | 'one'; a?: Tok[]; b: Tok[]; /** 다음 단계 문구 안의 순서 */ j?: number }
/** clean = 모든 효과가 짝지어짐 · partial = 일부만 · fallback = 짝 없음 (지금 / 다음 문구) · single = 한 단계만 */
export interface TierCmp { mode: 'clean' | 'partial' | 'fallback' | 'single'; curTag?: string; nextTag?: string; rows: TierRow[] }

const NUM = /[+\-−×]?\d+(?:\.\d+)?(?:%p|%|배|초|기|개|칸|회|중첩)?/g;
export function toks(s: string): Tok[] {
  const out: Tok[] = [];
  let at = 0;
  for (const m of s.matchAll(NUM)) {
    if (m.index! > at) out.push({ n: false, v: s.slice(at, m.index) });
    out.push({ n: true, v: m[0] });
    at = m.index! + m[0].length;
  }
  if (at < s.length) out.push({ n: false, v: s.slice(at) });
  return out;
}
/** 숫자를 # 로 바꾼 뼈대 */
export const skel = (t: Tok[]) => t.map((x) => (x.n ? '#' : x.v)).join('').trim();
const nums = (t: Tok[]) => t.filter((x) => x.n).length;

/** 맨 앞 '[단계 이름] ' 을 떼어 낸다 ('[그늘]: …' 처럼 바로 설명이 붙으면 이름표가 아니다) */
export function tagOf(s: string): { tag?: string; rest: string } {
  const m = /^\[([^\]]+)\] (?=\S)/.exec(s);
  return m ? { tag: m[1], rest: s.slice(m[0].length) } : { rest: s };
}

/** 효과 여러 개를 이은 문구를 한 효과씩 나눈다 (', ' · '; ' · '. ').
 *  괄호 · 대괄호 안은 자르지 않는다. ' · ' 는 조각마다 숫자가 있고 뒤 조각이 숫자로 시작하지 않을 때만 자른다 (예: '피해 +15% · 흡혈 15%').
 *  괄호 짝이 안 맞거나 빈 조각이 생기면 자르지 않고 문장 그대로 둔다. */
export function splitFx(s: string): string[] {
  const cut = (text: string, seps: string[]): string[] | null => {
    const out: string[] = [];
    let d = 0, from = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(' || ch === '[') d++;
      else if (ch === ')' || ch === ']') { d--; if (d < 0) return null; }
      else if (d === 0) {
        const sep = seps.find((x) => text.startsWith(x, i));
        if (sep) { out.push(text.slice(from, i)); from = i + sep.length; i += sep.length - 1; }
      }
    }
    if (d !== 0) return null;
    out.push(text.slice(from));
    return out.map((x) => x.trim());
  };
  const top = cut(s, [', ', '; ', '. ']);
  if (!top || top.some((x) => !x)) return [s];
  return top.flatMap((p) => {
    const sub = cut(p, [' · ']);
    return sub && sub.length > 1 && sub.every((x, i) => /\d/.test(x) && !(i && /^[+\-−×]?\d/.test(x))) ? sub : [p];
  }).map((x) => x.replace(/\.$/, ''));
}

/** 뼈대 b 가 뼈대 a 안에 낱말 경계로 들어 있는가 ('성도회 신성 피해 증폭 +#' ⊃ '신성 피해 증폭 +#') */
const within = (a: string, b: string) => {
  const i = a.indexOf(b);
  return i >= 0 && (i === 0 || a[i - 1] === ' ') && (i + b.length === a.length || a[i + b.length] === ' ');
};

/** 단계 문구 둘(지금 · 다음)을 비교한다. 한쪽이 없으면 (미활성 · 최대 단계) 있는 쪽만 한 효과씩 */
export function tierCmp(cur: string | undefined, next: string | undefined): TierCmp {
  if (cur == null || next == null) {
    const one = tagOf(cur ?? next ?? '');
    return { mode: 'single', curTag: cur != null ? one.tag : undefined, nextTag: next != null ? one.tag : undefined, rows: splitFx(one.rest).map((x) => ({ k: 'one', b: toks(x) })) };
  }
  const A = tagOf(cur), B = tagOf(next);
  const ca = splitFx(A.rest).map(toks), nb = splitFx(B.rest).map(toks);
  const sa = ca.map(skel), sb = nb.map(skel);
  const pair: number[] = nb.map(() => -1);
  const used = new Set<number>();
  // 1) 뼈대가 같은 효과
  sb.forEach((s, j) => { const i = sa.findIndex((x, k) => !used.has(k) && x === s); if (i >= 0) { pair[j] = i; used.add(i); } });
  // 2) 한쪽 뼈대가 다른 쪽을 품고 숫자 개수가 같은 효과 (후보가 하나일 때만)
  sb.forEach((s, j) => {
    if (pair[j] >= 0) return;
    const c = sa.map((x, k) => k).filter((k) => !used.has(k) && nums(ca[k]) === nums(nb[j]) && nums(nb[j]) > 0 && (within(sa[k], s) || within(s, sa[k])));
    if (c.length === 1) { pair[j] = c[0]; used.add(c[0]); }
  });
  const matched = used.size;
  if (!matched) {
    return { mode: 'fallback', curTag: A.tag, nextTag: B.tag, rows: [...ca.map((t): TierRow => ({ k: 'cur', b: t })), ...nb.map((t): TierRow => ({ k: 'add', b: t }))] };
  }
  const rows: TierRow[] = [];
  nb.forEach((t, j) => {
    if (pair[j] < 0) return;
    const a = ca[pair[j]];
    const an = a.filter((x) => x.n), bn = t.filter((x) => x.n);
    rows.push({ k: an.some((x, i) => x.v !== bn[i].v) ? 'chg' : 'same', a, b: t, j });
  });
  ca.forEach((t, i) => { if (!used.has(i)) rows.push({ k: 'cur', b: t }); });
  nb.forEach((t, j) => { if (pair[j] < 0) rows.push({ k: 'add', b: t, j }); });
  return { mode: matched === ca.length && matched === nb.length ? 'clean' : 'partial', curTag: A.tag, nextTag: B.tag, rows };
}

type Fmt = (s: string) => string;
/** 한 줄 HTML. 바뀐 숫자는 '이전 → 새 값' (새 값 강조). arrow = false 면 새 값만 강조하고 이전 값은 title 로 */
export function rowHtml(r: TierRow, esc: Fmt, ic: Fmt = (s) => s, arrow = true): string {
  const an = r.a?.filter((x) => x.n) || [];
  let ni = 0;
  return r.b.map((x) => {
    if (!x.n) return ic(esc(x.v));
    const a = an[ni++];
    if (!a || a.v === x.v) return `<span class="td-n">${esc(x.v)}</span>`;
    return arrow ? `<span class="td-a">${esc(a.v)}</span><span class="td-ar" aria-label="에서">→</span><b class="td-b">${esc(x.v)}</b>` : `<b class="td-b" title="이전 단계 ${esc(a.v)}">${esc(x.v)}</b>`;
  }).join('');
}

/** 도감 단계표 한 칸: 이전 단계와 비교해 효과를 한 줄씩, 바뀐 숫자는 강조 · 새 효과는 표시 */
export function tierCellHtml(prev: string | undefined, text: string, esc: Fmt, ic: Fmt = (s) => s): string {
  const c = tierCmp(prev, text);
  const tag = c.mode === 'single' ? c.curTag ?? c.nextTag : c.nextTag;
  const rows = c.mode === 'fallback' ? c.rows.filter((r) => r.k === 'add').map((r): TierRow => ({ k: 'one', b: r.b })) : c.rows.filter((r) => r.k !== 'cur').sort((x, y) => (x.j ?? 0) - (y.j ?? 0));
  return `${tag ? `<span class="td-tag">${esc(tag)}</span>` : ''}<ul class="td-rows">${rows.map((r) => `<li class="td-${r.k}"><span>${rowHtml(r, esc, ic, false)}</span></li>`).join('')}</ul>`;
}
