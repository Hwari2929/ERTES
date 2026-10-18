// 전장 상성 요약: 전장의 적 풀(일반 · 정예 · 보스)과 적 정의의 키워드(→ 분류)에서 자동 집계한다.
// 면역 · 취약 · 저항은 엔진 규칙(categoryImmune · categoryMult · BOSS_CC_IMMUNE)을 그대로 물어서 얻는다 (손으로 적지 않음).
import { BOSS_CC_IMMUNE, categoryImmune, categoryMult, STATUS_NAME } from '../engine/combat';
import { fieldOf } from '../data/battlefields';
import { ENEMY_BY_ID } from '../data/enemies';
import { PSI_STATUS, SCHOOL_BY_ID, type SchoolId } from '../data/schools';
import { type Category, CATEGORY_NAME, categoryOf, type Elem, ELEM_NAME } from '../types';

/** 비중: 일반 적은 자주 만나므로 3, 정예 2, 보스 2 */
const W = { minion: 3, elite: 2, boss: 2 } as const;
const ELEMS: Elem[] = ['phys', 'chem', 'elec', 'psy', 'holy'];
/** 면역 여부를 물어볼 상태 (이름이 있는 상태 전부) */
const PROBE = Object.keys(STATUS_NAME).map((key) => ({ key, type: key === 'stun' || key === 'fear' ? key : 'buff' }));
const uniq = (l: string[]) => [...new Set(l)];

export interface FieldFoes { total: number; cats: { c: Category; w: number; share: number }[]; roster: { c: Category; w: number; boss: boolean }[]; hasBoss: boolean }
const cache = new Map<string, FieldFoes>();
export function fieldFoes(fid: string): FieldFoes {
  const hit = cache.get(fid);
  if (hit) return hit;
  const f = fieldOf(fid);
  const roster: FieldFoes['roster'] = [];
  const add = (id: string, w: number, boss: boolean) => { const e = ENEMY_BY_ID[id]; if (e) roster.push({ c: categoryOf(e.keywords, !!e.immobile), w, boss }); };
  for (const id of f.pool) add(id, W.minion, false);
  add(f.elite, W.elite, false);
  for (const id of f.bosses) add(id, W.boss, true);
  const total = roster.reduce((a, r) => a + r.w, 0) || 1;
  const by: Partial<Record<Category, number>> = {};
  for (const r of roster) by[r.c] = (by[r.c] || 0) + r.w;
  const cats = (Object.entries(by) as [Category, number][]).map(([c, w]) => ({ c, w, share: w / total })).sort((a, b) => b.w - a.w);
  const out = { total, cats, roster, hasBoss: roster.some((r) => r.boss) };
  cache.set(fid, out);
  return out;
}
/** 분류 하나의 면역 상태 · 취약 속성 · 저항 속성 */
export function categoryTraits(c: Category) {
  return {
    immune: uniq(PROBE.filter((s) => categoryImmune(c, s)).map((s) => STATUS_NAME[s.key])),
    weak: ELEMS.filter((e) => categoryMult(c, e) > 1).map((e) => ELEM_NAME[e]),
    resist: ELEMS.filter((e) => categoryMult(c, e) < 1).map((e) => ELEM_NAME[e]),
  };
}
const catLine = (c: Category) => {
  const t = categoryTraits(c);
  return [t.immune.length ? `${t.immune.join('·')} 면역` : '', t.weak.length ? `${t.weak.join('·')} 취약` : '', t.resist.length ? `${t.resist.join('·')} 저항` : ''].filter(Boolean).join(', ');
};
/** 보스 공통 면역 한 줄 (엔진 BOSS_CC_IMMUNE) */
export const bossImmuneText = () => `보스: ${BOSS_CC_IMMUNE.map((k) => STATUS_NAME[k]).join('·')} 면역`;
/** 전장의 주요 적 (토큰 줄용): 비중 30% 이상 분류 (최대 2) 의 비중 · 면역 · 취약 · 저항 + 보스 공통 면역 */
export function fieldMatchup(fid: string) {
  const ff = fieldFoes(fid);
  return {
    cats: ff.cats.filter((k) => k.share >= 0.3).slice(0, 2).map((x) => ({ c: x.c, share: x.share, ...categoryTraits(x.c) })),
    bosses: ff.roster.filter((r) => r.boss).length,
    bossImmune: BOSS_CC_IMMUNE.map((k) => STATUS_NAME[k]),
  };
}
/** 요약 줄: 비중 30% 이상 분류 (최대 2) + 보스 면역 */
export function matchupLines(fid: string): { cls: string; text: string }[] {
  const ff = fieldFoes(fid);
  const out: { cls: string; text: string }[] = [];
  for (const x of ff.cats.filter((k) => k.share >= 0.3).slice(0, 2)) {
    const r = catLine(x.c);
    out.push({ cls: `cat-${x.c}`, text: `${CATEGORY_NAME[x.c]} ${x.share >= 0.6 ? '다수' : '일부'} (${Math.round(x.share * 100)}%)${r ? ` — ${r}` : ''}` });
  }
  if (ff.hasBoss) out.push({ cls: 'boss', text: bossImmuneText() });
  return out;
}

// ───────── 이번 전투 상성 (편성 화면 기본 패널): 실제 조우의 적 목록으로 분류별 인원 · 면역 · 취약 · 저항과
// 아군 공격 속성마다 취약 · 저항인 적 수를 센다. 규칙은 위와 같이 엔진(categoryMult · categoryImmune)에 물어서 얻는다
export interface EncMatchup {
  foes: number;
  /** 분류별 인원 · 면역 · 취약 · 저항 (인원 많은 순) */
  cats: ({ c: Category; n: number } & ReturnType<typeof categoryTraits>)[];
  /** 보스 수 · 보스 공통 면역 */
  bosses: number;
  bossImmune: string[];
  /** 아군 공격 속성: 그 속성으로 치는 아군 수 · 그 속성에 취약 · 저항인 적 수 */
  elems: { e: Elem; name: string; allies: number; weak: number; resist: number }[];
}
export function encounterMatchup(ids: string[], allyElems: Elem[]): EncMatchup {
  const roster = ids.map((id) => ENEMY_BY_ID[id]).filter((e) => e && !e.inert).map((e) => ({ c: categoryOf(e.keywords, !!e.immobile), boss: e.tier === 'boss' }));
  const by = new Map<Category, number>();
  for (const r of roster) by.set(r.c, (by.get(r.c) || 0) + 1);
  const cats = [...by].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ c, n, ...categoryTraits(c) }));
  const cnt = new Map<Elem, number>();
  for (const e of allyElems) cnt.set(e, (cnt.get(e) || 0) + 1);
  const elems = [...cnt].sort((a, b) => b[1] - a[1]).map(([e, n]) => ({
    e, name: ELEM_NAME[e], allies: n,
    weak: roster.filter((r) => categoryMult(r.c, e) > 1).length,
    resist: roster.filter((r) => categoryMult(r.c, e) < 1).length,
  }));
  return { foes: roster.length, cats, bosses: roster.filter((r) => r.boss).length, bossImmune: BOSS_CC_IMMUNE.map((k) => STATUS_NAME[k]), elems };
}
/** 한 줄 요약 (모집 화면 머리 등) */
export function matchupShort(fid: string) {
  return matchupLines(fid).map((l) => l.text).join(' · ');
}

// ───────── 사이오닉 전공 경고: 전공의 핵심 상태 · 피해 속성이 이 전장에서 막히는지
const ELEM_BY_NAME = Object.fromEntries(ELEMS.map((e) => [ELEM_NAME[e], e])) as Record<string, Elem>;
/** 전공 핵심 상태 · 피해 속성: 비술 · 지속 능력 설명에서 상태 이름과 'OO 피해' 를 찾아 자동 추출 */
export function schoolCore(id: SchoolId) {
  const sc = SCHOOL_BY_ID[id];
  const txt = `${sc.cantrip.desc} ${sc.passive.desc}`;
  const statuses = Object.entries(PSI_STATUS).filter(([, v]) => txt.includes(v.name)).map(([k]) => k);
  const elems = uniq([...txt.matchAll(/(물리|화학|전기|정신|신성) 피해/g)].map((m) => m[1])).map((n) => ELEM_BY_NAME[n]).filter(Boolean);
  return { statuses, elems };
}
export interface SchoolWarn { level: 'bad' | 'warn' | 'good'; text: string }
export function schoolWarnings(id: SchoolId, fid: string): SchoolWarn[] {
  const ff = fieldFoes(fid);
  const core = schoolCore(id);
  const out: SchoolWarn[] = [];
  const who = (pred: (r: FieldFoes['roster'][number]) => boolean) => {
    const rs = ff.roster.filter(pred);
    const names = uniq(rs.map((r) => (r.boss && !ff.roster.some((o) => !o.boss && o.c === r.c && pred(o)) ? '보스' : CATEGORY_NAME[r.c])));
    return { share: rs.reduce((a, r) => a + r.w, 0) / ff.total, names };
  };
  for (const k of core.statuses) {
    const b = who((r) => categoryImmune(r.c, { key: k, type: 'buff' }) || (r.boss && BOSS_CC_IMMUNE.includes(k)));
    if (b.share >= 0.25) out.push({ level: b.share >= 0.5 ? 'bad' : 'warn', text: `${PSI_STATUS[k].name}: 적 ${Math.round(b.share * 100)}% 면역 (${b.names.join('·')})` });
  }
  for (const e of core.elems) {
    const r = who((x) => categoryMult(x.c, e) < 1), w = who((x) => categoryMult(x.c, e) > 1);
    if (r.share >= 0.25) out.push({ level: r.share >= 0.5 ? 'bad' : 'warn', text: `${ELEM_NAME[e]} 피해: 적 ${Math.round(r.share * 100)}% 저항 (${r.names.join('·')})` });
    else if (w.share >= 0.4) out.push({ level: 'good', text: `${ELEM_NAME[e]} 피해: 적 ${Math.round(w.share * 100)}% 취약 (${w.names.join('·')})` });
  }
  return out;
}
