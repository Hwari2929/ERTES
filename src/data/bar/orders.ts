// 에란테스 바 운영: 주문 만들기 · 채점 · 술값과 팁 (docs/BAR_OPS.md 1 · 4 · 6절). 화면은 src/ui/barprep.ts · bar.ts.
// 주문 4방식: 느낌으로(맛 조건) · 사진으로(완성 잔 그림) · 이름으로(메뉴 이름) · 늘 마시던 거(지난번 좋아한 잔, 없으면 단골 메뉴).
// 채점은 만족 3단계 (좋아함 · 그럭저럭 · 별로). 별로여도 잔은 내준 것이다 (다시 만들기 없음) — 손님은 마시고 팁이 적다.
import { AXES, GARNISH_BY_ID, GLASS_BY_ID, HOUSE_MENUS, RECIPE_BY_ID, RECIPES, REGULARS, tagsOf, tasteOf, type Axis, type Drink, type Ice, type OrderStyle, type Recipe, canOrder } from './drinks';
import { GUEST_BY_ID } from './guests.gen';

/** 바 운영 수치 [임시]. 확인용 주소(?bartest)의 __barTune({ ops: … }) 로 바꿀 수 있다 */
export const BAR_OPS = {
  /** 들어온 뒤 첫 주문까지 · 마지막 주문(잔을 받은 때)에서 다음 주문까지 (ms) */
  firstWait: 15_000,
  minGap: 90_000,
  /** 주문한 손님이 머물 시간이 끝나도 레이첼을 기다리는 최소 실제 시간 (ms — 시간 가속 중에도 실제 시간). 그 뒤에는 주문을 거두고 일어난다 (벌점 없음) */
  patience: 60_000,
  /** 낯선 손님이 들어오자마자 (들어올 때 한마디와 함께) 주문할 확률 — 이때는 동시 주문 maxOpen + 1 까지 */
  arrive: 0.92,
  /** 조건이 맞을 때 한때마다 주문할 확률 · 동시에 걸려 있을 수 있는 주문 수 */
  chance: 0.3,
  maxOpen: 2,
  /** 바 운영을 처음 하는 플레이어 (잔을 내준 적도, 첫 주문 귀띔을 본 적도 없음): 첫 주문만 조금 일찍 — 들어온 뒤 대기 (ms) · 한때마다 확률.
   *  그동안 에이든은 새로 온 손님 · 잔 없는 손님에게 단골 메뉴를 먼저 내주지 않는다 (첫 손님을 레이첼에게 남겨 둔다). 강제 이벤트는 아니다 */
  first: { wait: 8_000, chance: 0.7 },
  /** 좋아하는 주문 방식으로 시킬 확률 (나머지는 다른 방식 중 무작위) */
  styleKeep: 0.5,
  /** 이름 · 사진 주문에서 단골 메뉴를 고를 확률 (나머지는 메뉴판에서 무작위) */
  ownMenu: 0.5,
  /** 술값 (잔 크기 = 칸 수별) · 팁 (만족별) · 런을 마치면 받는 코인 */
  price: { 3: 6, 4: 8, 5: 10 } as Record<number, number>,
  tip: { like: 6, ok: 2, bad: 0 } as Record<Grade, number>,
  /** 낯선 손님 팁 성향 (명부 tip 0 짬 · 1 보통 · 2 후함) → 팁 배율 */
  tipK: [0.5, 1, 1.5] as [number, number, number],
  run: { clear: 30, fail: 10 },
};
/** 바 화폐: 만찬 주화 (단위 '닢'). 알렉산드리아 만찬회 상인 조합이 찍는 중립 주화 — 3국 어디의 정식 화폐도 아니라 진영이 섞인 용병 · 손님 사이에서
 *  잔돈 · 팁으로 돈다 (도시 이름조차 합의가 안 된 곳이라 이름도 하는 일대로). 의뢰 보수는 에너지 크레딧 · 유물로만 받는다 (lore 범은하 공동체) */
export const COIN_NAME = '만찬 주화';
export const COIN_UNIT = '닢';
export const coinText = (n: number) => `${COIN_NAME} ${n}${COIN_UNIT}`;

export type Grade = 'like' | 'ok' | 'bad';
export const GRADE_NAME: Record<Grade, string> = { like: '좋아함', ok: '그럭저럭', bad: '별로' };

// ───────── 느낌 주문의 조건
/** 맛 축 조건 (tasteText 문턱과 같다): word = 부사형(마지막) · conn = 이음형(앞) */
interface AxisCond { k: 'axis'; a: Axis; min?: number; max?: number; word: string; conn: string; label: string }
interface TagCond { k: 'tag'; tag: string; word: string; label: string }
interface SizeCond { k: 'size'; n: 3 | 5; word: string; label: string }
interface IceCond { k: 'ice'; ice: Ice; word: string; label: string }
export type FeelCond = AxisCond | TagCond | SizeCond | IceCond;

const AXIS_CONDS: AxisCond[] = [
  { k: 'axis', a: 'sweet', min: 3, word: '달게', conn: '달고', label: '당도 +3 이상' },
  { k: 'axis', a: 'sweet', max: -3, word: '쓰게', conn: '쓰고', label: '당도 −3 이하' },
  { k: 'axis', a: 'strength', max: 0, word: '술 없이', conn: '술 없이', label: '강도 0' },
  { k: 'axis', a: 'strength', min: 1, max: 3, word: '순하게', conn: '순하고', label: '강도 1~3' },
  { k: 'axis', a: 'strength', min: 4, word: '독하게', conn: '독하고', label: '강도 4 이상' },
  { k: 'axis', a: 'body', min: 4, word: '진하게', conn: '진하고', label: '농도 +4 이상' },
  { k: 'axis', a: 'body', max: -4, word: '청량하게', conn: '청량하고', label: '농도 −4 이하' },
];
/** 주문에 쓰는 향 · 맛 태그 → 말 (부사형) */
export const TAG_WORD: Record<string, string> = {
  시트러스: '시트러스 향 나게', 라임: '라임 넣어서', 산미: '새콤하게', 커피향: '커피 향 나게', 꽃향: '꽃향기 나게', 허브향: '허브 향 나게',
  초콜릿: '초콜릿 맛 나게', 꿀: '꿀 넣어서', 생강: '생강 맛 나게', 사과: '사과 맛 나게', 크림: '크림 얹어서', 바닐라: '바닐라 향 나게',
  스모키: '스모키하게', 짭짤함: '짭짤하게', 향신료: '향신료 넣어서', 약초향: '약초 향 나게', 우유: '우유 넣어서', 과일향: '과일 향 나게',
  파인애플: '파인애플 맛 나게', 요거트: '요거트 넣어서',
};
const SIZE_CONDS: Record<3 | 5, SizeCond> = { 3: { k: 'size', n: 3, word: '작은 잔에', label: '작은 잔 (3칸)' }, 5: { k: 'size', n: 5, word: '큰 잔에', label: '큰 잔 (5칸)' } };
const ICE_CONDS: Partial<Record<Ice, IceCond>> = { little: { k: 'ice', ice: 'little', word: '얼음 조금만 넣어서', label: '얼음 조금' }, lots: { k: 'ice', ice: 'lots', word: '얼음 가득 넣어서', label: '얼음 많이' }, frozen: { k: 'ice', ice: 'frozen', word: '얼음 갈아서', label: '프로즌' } };

const inRange = (v: number, c: { min?: number; max?: number }) => (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max);
/** 이 잔이 조건 하나를 맞췄나 */
export function condMet(c: FeelCond, d: Drink): boolean {
  if (c.k === 'axis') return inRange(tasteOf(d)[c.a], c);
  if (c.k === 'tag') return tagsOf(d).includes(c.tag);
  if (c.k === 'size') return GLASS_BY_ID[d.glass]?.slots === c.n;
  return d.ice === c.ice;
}
/** 조건 → 주문 말 (부사형으로 끝난다): '달고 청량하게, 시트러스 향 나게, 큰 잔에' */
export function feelText(cs: FeelCond[]): string {
  const ax = cs.filter((c): c is AxisCond => c.k === 'axis');
  const head = ax.map((c, i) => (i === ax.length - 1 ? c.word : c.conn)).join(' ');
  return [head, ...cs.filter((c) => c.k !== 'axis').map((c) => c.word)].filter(Boolean).join(', ');
}
/** 맛 막대에 그릴 목표 범위 (느낌 주문의 맛 축 조건) */
export function axisTargets(cs: FeelCond[] | undefined): Partial<Record<Axis, { min?: number; max?: number }>> {
  const o: Partial<Record<Axis, { min?: number; max?: number }>> = {};
  for (const c of cs || []) if (c.k === 'axis') o[c.a] = { min: c.min, max: c.max };
  return o;
}

// ───────── 주문
export interface Order {
  /** 주문한 사람 (무대 키) · 방식 · 주문한 시각 */
  who: string; style: OrderStyle; at: number;
  /** 사진 · 이름 · 늘 마시던 거: 맞춰야 할 잔 (이름 = 메뉴 이름, 레이첼이 만든 잔이면 '이름 없는 잔') */
  target?: Drink; name?: string;
  /** 느낌: 조건 */
  conds?: FeelCond[];
  /** 늘 마시던 거: 귀띔 (낮 = 에이든, 밤 = 손님이 흘림) · 장부에 적힌 잔인가 */
  hint?: 'aiden' | 'guest'; ledger?: boolean;
}
const pick = <T>(a: T[], r = Math.random): T => a[Math.floor(r() * a.length)];
const OTHER: OrderStyle[] = ['vague', 'photo', 'name', 'usual'];
/** 손님의 잔 (단골 메뉴, 단골이 아니면 무난한 메뉴) */
export const baseMenu = (id: string, r = Math.random): Recipe => RECIPE_BY_ID[prefOf(id)?.menu || pick(HOUSE_MENUS.filter((x) => canOrder(id, RECIPE_BY_ID[x])), r)];
/** 주문 방식: 단골은 약 50% 좋아하는 방식, 나머지는 다른 방식 중 무작위 */
/** 단골 메뉴 · 좋아하는 주문 방식: 정규 단원(REGULARS) 또는 낯선 손님 명부(GUEST_BY_ID) */
const prefOf = (id: string) => REGULARS[id] || GUEST_BY_ID[id];
export function styleFor(id: string, r = Math.random): OrderStyle {
  const fav = prefOf(id)?.style;
  if (fav && r() < BAR_OPS.styleKeep) return fav;
  return pick(OTHER.filter((s) => s !== fav), r);
}
/** 느낌 주문 조건: 기준 잔(단골 메뉴 또는 메뉴판의 잔)이 맞추는 조건 중에서 고른다 → 언제나 만들 수 있다 */
export function feelConds(base: Drink, r = Math.random): FeelCond[] {
  const t = tasteOf(base);
  const ax = AXIS_CONDS.filter((c) => inRange(t[c.a], c));
  const cs: FeelCond[] = [];
  const nAx = ax.length >= 2 && r() < 0.5 ? 2 : Math.min(1, ax.length);
  const order = ax.map((c) => [r(), c] as const).sort((p, q) => p[0] - q[0]).map(([, c]) => c);
  const used = new Set<Axis>();
  for (const c of order) { if (cs.length >= nAx) break; if (!used.has(c.a)) { used.add(c.a); cs.push(c); } }
  cs.sort((p, q) => AXES.indexOf((p as AxisCond).a) - AXES.indexOf((q as AxisCond).a));
  const tags = tagsOf(base).filter((x) => TAG_WORD[x]);
  if (tags.length && (cs.length === 0 || r() < 0.5)) { const tag = pick(tags.slice(0, 3), r); cs.push({ k: 'tag', tag, word: TAG_WORD[tag], label: `향 · 맛: ${tag}` }); }
  const n = GLASS_BY_ID[base.glass]?.slots;
  if ((n === 3 || n === 5) && cs.length < 3 && r() < 0.25) cs.push(SIZE_CONDS[n]);
  const ic = ICE_CONDS[base.ice];
  if (ic && cs.length < 3 && r() < 0.15) cs.push(ic);
  return cs; // 강도 조건 셋(0 · 1~3 · 4 이상)이 모든 잔을 덮으므로 비지 않는다
}
/** 주문 하나 만들기. usual = 그 손님 장부(지난번 좋아함을 받은 잔), night = 에이든이 없어 귀띔이 없다 */
export function makeOrder(who: string, now: number, o: { usual?: Drink & { name?: string }; night: boolean; style?: OrderStyle }, r = Math.random): Order {
  const style = o.style || styleFor(who, r);
  const base = baseMenu(who, r);
  const menu = r() < BAR_OPS.ownMenu ? base : pick(RECIPES.filter((x) => canOrder(who, x)), r); // 술을 안 마시는 손님은 술 든 잔을 시키지 않는다 (ORDER_AVOID)
  if (style === 'vague') return { who, style, at: now, conds: feelConds(r() < 0.6 ? base : menu, r) };
  if (style === 'photo' || style === 'name') return { who, style, at: now, target: menu, name: menu.name };
  const u = o.usual && canOrder(who, o.usual) ? o.usual : undefined;
  if (u) return { who, style, at: now, target: u, name: u.name || recipeName(u) || undefined, ledger: true, hint: o.night ? undefined : 'aiden' };
  return { who, style, at: now, target: base, name: base.name, hint: o.night ? 'guest' : 'aiden' };
}

// ───────── 채점
/** 잔 맞추기 채점 (사진 · 이름 · 늘 마시던 거): 항목별 만점 (합 = 만점) · 만족 문턱. 느낌 주문은 조건을 다 맞추면 좋아함 · 절반 이상 그럭저럭 [임시] */
export const SCORE = { glass: 2, fill: 4, ice: 1, garnish: 1, like: 7, ok: 4.5 };
export const SCORE_MAX = SCORE.glass + SCORE.fill + SCORE.ice + SCORE.garnish;
const count = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) || 0) + 1); return m; };
/** 목표 잔과 만든 잔의 재료 구성이 겹치는 칸 수 (순서 무관) */
function overlap(a: string[], b: string[]) { const m = count(a); let n = 0; for (const x of b) { const k = m.get(x) || 0; if (k) { n++; m.set(x, k - 1); } } return n; }
/** 같은 층 자리에 같은 재료가 놓인 칸 수 (아래층부터) */
const samePos = (a: string[], b: string[]) => a.reduce((n, x, i) => n + (b[i] === x ? 1 : 0), 0);
/** 층 순서를 보는 주문인가: 사진 주문 (그림에 층 색 순서가 보인다). 프로즌 · 섞은 잔은 한 색이라 순서가 안 보인다 */
export const layerOrdered = (o: Pick<Order, 'style' | 'target'>) => o.style === 'photo' && o.target?.ice !== 'frozen' && !o.target?.mix;
/** 잔 맞추기 점수 (0~SCORE_MAX): 잔 (같은 잔 = 만점 · 크기나 종류만 같으면 절반) · 재료 (겹치는 칸 비율 — ordered 면 1/3 은 겹치는 칸, 2/3 는 같은 층 자리 비율) · 얼음 · 가니쉬 */
export function matchScore(t: Drink, d: Drink, ordered = false): number {
  const gt = GLASS_BY_ID[t.glass], gd = GLASS_BY_ID[d.glass];
  const glass = t.glass === d.glass ? SCORE.glass : gt && gd && (gt.slots === gd.slots || gt.kind === gd.kind) ? SCORE.glass / 2 : 0;
  const n = Math.max(t.fill.length, d.fill.length, 1);
  const fill = ordered ? SCORE.fill * (overlap(t.fill, d.fill) + 2 * samePos(t.fill, d.fill)) / (3 * n) : SCORE.fill * overlap(t.fill, d.fill) / n;
  const ice = t.ice === d.ice ? SCORE.ice : 0;
  const gn = Math.max(t.garnish.length, d.garnish.length);
  const garnish = SCORE.garnish * (gn ? overlap(t.garnish, d.garnish) / gn : 1);
  return glass + fill + ice + garnish;
}
export interface Verdict { grade: Grade; /** 맞춘 것 · 놓친 것 (조건 이름 또는 잔 · 재료 · 얼음 · 가니쉬) */ hit: string[]; miss: string[] }
/** 내준 잔 채점 */
export function judge(o: Order, d: Drink): Verdict {
  if (!canOrder(o.who, d)) return { grade: 'bad', hit: [], miss: ['안 마시는 재료'] }; // 술을 안 마시는 손님에게 술 (ORDER_AVOID)
  if (o.style === 'vague' && o.conds) {
    const hit = o.conds.filter((c) => condMet(c, d)).map((c) => c.label);
    const miss = o.conds.filter((c) => !condMet(c, d)).map((c) => c.label);
    const n = o.conds.length;
    return { grade: hit.length === n ? 'like' : hit.length * 2 >= n ? 'ok' : 'bad', hit, miss };
  }
  const t = o.target!;
  const ordered = layerOrdered(o);
  const s = matchScore(t, d, ordered);
  const allIn = overlap(t.fill, d.fill) === t.fill.length && t.fill.length === d.fill.length;
  const parts: [string, boolean][] = [
    ['잔', t.glass === d.glass],
    ['재료', allIn],
    ...(ordered && allIn ? [['층 순서', samePos(t.fill, d.fill) === t.fill.length] as [string, boolean]] : []),
    ['얼음', t.ice === d.ice],
    ['가니쉬', overlap(t.garnish, d.garnish) === t.garnish.length && t.garnish.length === d.garnish.length],
  ];
  return { grade: s >= SCORE.like ? 'like' : s >= SCORE.ok ? 'ok' : 'bad', hit: parts.filter(([, x]) => x).map(([k]) => k), miss: parts.filter(([, x]) => !x).map(([k]) => k) };
}
/** 술값 + 팁 */
/** 술값 + 팁. tipK = 손님 팁 성향 배율 (낯선 손님 명부 tip 0 · 1 · 2 → BAR_OPS.tipK) */
export const payOf = (d: Drink, g: Grade, tipK = 1) => (BAR_OPS.price[GLASS_BY_ID[d.glass]?.slots || 4] || 8) + Math.round(BAR_OPS.tip[g] * tipK);

const sorted = (xs: string[]) => [...xs].sort().join(',');
/** 메뉴판에 있는 잔이면 그 이름 (잔 · 재료 구성 · 얼음 · 가니쉬가 모두 같을 때, 붓는 순서는 무관) */
export function recipeName(d: Drink): string | null {
  const r = RECIPES.find((x) => x.glass === d.glass && x.ice === d.ice && sorted(x.fill) === sorted(d.fill) && sorted(x.garnish) === sorted(d.garnish));
  return r ? r.name : null;
}
/** 가니쉬 이름 (잔 그림 꼬리표 · 주문서) */
export const garnishNames = (d: Drink) => d.garnish.map((g) => GARNISH_BY_ID[g]?.name || g);
