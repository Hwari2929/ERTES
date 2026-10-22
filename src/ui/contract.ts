// 출격 계약: 에란테스 바 카운터를 내려다본 탑뷰. 바에서 [새 계약] → 시선이 바 테이블로 내려가고 → 위에서 청사진(도면)이, 아래에서 차림표(메뉴판)가 미끄러져 들어온다.
// 차림표의 줄을 고르면 오른쪽 전표 출력기가 카본지 전표를 위로 한 줄씩 밀어 올리고 (길수록 끝이 휘며 그림자가 진다), 다 고르면 탁상 벨이 떨린다.
// 벨 = 전표에 '승인' 도장 → 그늘(체인 · 회중시계) → 계약 기물 명부 (main.ts newRunScreen). [의뢰 취소] = '취소' 도장 → 전표가 바깥으로 미끄러져 나가고 고른 것이 비워진다.
// 의뢰 = 전장 (의뢰 제목 · 의뢰인 = data/scenes/fields.ts) · 약관 = 난이도 (data/contract.ts PLANS, 조항 = data/difficulty.ts DIFFS) · 특약 = 절망 서약 (data/oaths.ts, 담보 약관에만).
// 에란테스의 의뢰는 모두 싯가: 오늘 들어온 의뢰서 3장 = 제철 의뢰 (보수 + CFG.contract.seasonWin), 메뉴에 없는 의뢰 = 직접 주문 (기본 보수).
// 차림표 · 청사진에는 배율 숫자를 쓰지 않는다 (위험 눈금 · 감수 / 보상 아이콘만). 조항 수치는 출격 뒤 지도 환경 탭 '계약' (contractEnv).
// 단골 경로: 두 번째 계약부터 의뢰 칸 맨 위에 '늘 하던 대로', 그늘 연출 압축. 전표 번호 = 서명하고 출격한 수 (ui/meta.ts deeds).
// 재료: 종이 사물(차림표 · 청사진 · 전표)만 청사진 레터프레스 키트 (style.css .lp-*), 말풍선은 게임 말풍선 (docs/UI.md 19). 소품 그림 = art/ct_*.webp (없으면 선 그림).
import { CFG } from '../config';
import { FIELDS, fieldOf } from '../data/battlefields';
import { PLAN_BY_LVL, PLANS, seasonWin } from '../data/contract';
import { DIFFS, diffLabel, diffName, effDiffLabel } from '../data/difficulty';
import { despairDiff, despairPhases } from '../data/despair';
import { OATHS, oathDiff, oathHeat, oathHeatOf, oathLv, oathMax, oathsOn, type OathId } from '../data/oaths';
import { fieldIntroOf } from '../data/scenes/fields';
import type { RunState } from '../types';
import { deedCount, lastDeed, metaOath, oathSel } from './meta';
import { artURL, bgURL } from './portraits';
import { sfx } from './sound';
import { lineIcon } from './synicons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const pad = (n: number, k = 2) => String(n).padStart(k, '0');
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a: number, b: number) => +(a + Math.random() * (b - a)).toFixed(1);

type Step = 'board' | 'seal';
/** 의뢰서: season = 오늘 들어온 제철 의뢰 · custom = 메뉴에 없는 의뢰 (직접 주문). bonus = 승리 크레딧 가산 */
type Kind = 'season' | 'custom';
interface Job { field: string; kind: Kind; bonus: number }
const CT = {
  step: 'board' as Step,
  /** 차림표를 연 곳 (나가기 = 그리로): 'bar' · 'title' */
  from: 'title',
  /** 오늘의 의뢰서 3장 (모두 제철) */
  jobs: [] as Job[],
  sel: null as Job | null,
  /** 메뉴에 없는 의뢰 목록을 펼쳤는지 */
  list: false,
  /** 두 번째 계약부터: 늘 하던 대로 · 그늘 연출 압축 */
  vet: false,
  /** 담보 약관을 막 골라 특약 칸 · 담보 조항이 펼쳐지는 중 (그릴 때 한 번) */
  lit: false,
  plan: PLANS[0].lvl,
  /** 청사진이 보여 주는 줄: 'job:d0' · 'plan:3' · 'rider:grit' · 'off' · 'usual' · '' */
  focus: '',
  /** 방금 전표에 찍힌 묶음 (그 줄들이 덜그럭 밀려 올라온다) */
  last: '',
  /** 전표 도장: '' · 'ok' 승인 · 'void' 취소 */
  stamp: '' as '' | 'ok' | 'void',
  /** 바에서 시선이 테이블로 내려가는 연출 (연 직후 한 번) */
  intro: false,
  /** 도면 · 차림표가 놓인 각도 (열 때마다 조금씩 다르게) */
  rot: { bp: 0, mn: 0 },
  /** 카운터 너머 목소리 (잠깐 떴다 사라진다) */
  say: '',
  no: 0,
  time: '',
  timers: [] as number[],
  fromSeal: false,
};

/** main.ts 가 채우는 연결: 다시 그리기 · 전장 브리핑 · 적 상세 창 · 알림 · 명부 열기 · 나가기 */
export const hooks = {
  render: () => {},
  brief: (_fid: string) => '',
  foe: () => '',
  toast: (_msg: string) => {},
  roster: (_s: Signed) => {},
  leave: (_to: string) => {},
};
/** 서명한 계약: 명부 · 출격에 넘긴다 */
export interface Signed { field: string; diff: number; contract: NonNullable<RunState['contract']> }

const later = (ms: number, f: () => void) => { CT.timers.push(window.setTimeout(f, ms)); };
function clear() { CT.timers.forEach((t) => clearTimeout(t)); CT.timers = []; }
const shuffle = <T>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);

// ───────── 상태
const jobOf = () => CT.sel;
const planOf = () => PLAN_BY_LVL[CT.plan] || null;
/** 특약(절망 서약)이 붙는 약관인지: 담보 약관 (위험 CFG.oathFrom 이상) */
const ridersOn = () => oathDiff(CT.plan);
/** 담보 약관 (절망 증강을 떠안는 약관) */
const collateral = (lvl: number) => despairDiff(lvl);
const heatNow = () => (ridersOn() ? oathHeat(oathSel()) : 0);
const payable = () => !!jobOf() && !!planOf();
const fieldTitle = (fid: string) => fieldIntroOf(fid)?.title || fieldOf(fid).name;
/** 보수 표기: 제철 +n% · 기본 */
const priceOf = (j: Job) => (j.kind === 'season' ? `제철 +${pct(j.bonus)}` : '기본 보수');
/** 조항 한 줄: 위험 등급 설명의 첫 문장 */
const clause = (desc: string) => desc.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
/** 그 약관까지의 조항 수 (위험 1 ~ lvl) */
const clauseN = (lvl: number) => DIFFS.filter((d) => d.lvl >= 1 && d.lvl <= lvl).length;
/** 담보 조항 (전표 · 담보 펼침): 함대 체력 조항 + 절망 증강 건수 */
function collateralTerms(lvl: number) {
  const hp = clause(DIFFS.find((d) => d.lvl === lvl)?.desc || ''), ph = despairPhases();
  return { hp, despair: `절망 증강 ${1 + ph.length}건`, when: `출격${ph.length ? ` · ${ph.join(' · ')}페이즈` : ''}` };
}
/** 그 약관까지 쌓인 감수 (앞 약관 것을 이어받는다) · 그 약관의 보상 */
const costsOf = (lvl: number) => PLANS.filter((p) => p.lvl <= lvl).flatMap((p) => p.costs);
const gainsOf = (lvl: number) => PLAN_BY_LVL[lvl]?.gains || [];

/** 메뉴에 없는 의뢰로 고를 수 있는 전장: 오늘 의뢰서에 없는 전장 */
const offMenu = () => FIELDS.filter((f) => !CT.jobs.some((j) => j.field === f.id));
/** 그 전장 주문: 오늘 의뢰서에 있으면 그것(제철), 없으면 메뉴에 없는 의뢰 */
const orderOf = (fid: string): Job => CT.jobs.find((j) => j.field === fid) || { field: fid, kind: 'custom', bonus: 0 };
/** 차림표를 연다: 오늘의 의뢰서 3장 (모두 제철). list = 메뉴에 없는 의뢰 목록을 펼친 채로 */
export function contractStart(from: string, list = false) {
  clear();
  const n = deedCount();
  Object.assign(CT, { step: 'board', from, sel: null, list, vet: n > 0, lit: false, focus: '', last: '', stamp: '', intro: true, fromSeal: false, say: '오늘 들어온 의뢰서입니다. 제철이라 조금 더 쳐 드리죠.' });
  CT.rot = { bp: rnd(-4, 4), mn: rnd(-3, 3) };
  CT.no = n + 1;
  const d = new Date();
  CT.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  CT.jobs = shuffle(FIELDS.map((f) => f.id)).slice(0, 3).map((field) => ({ field, kind: 'season' as const, bonus: seasonWin() }));
}
/** 명부에서 '뒤로': 차림표로 (고른 것은 그대로, 도장은 무른다) */
export function contractBack() { clear(); Object.assign(CT, { step: 'board', stamp: '', say: '', last: '', intro: false, fromSeal: false }); }
/** 명부 화면이 그늘 연출에서 이어지는지 (한 번 읽으면 지운다) */
export function takeFromSeal() { const v = CT.fromSeal; CT.fromSeal = false; return v; }
/** 서명한 계약 (출격 때 run.contract) */
export function signedContract(): Signed | null {
  const j = jobOf(), p = planOf();
  if (!j || !p) return null;
  return { field: j.field, diff: p.lvl, contract: { no: CT.no, title: fieldTitle(j.field), plan: p.label, kind: j.kind, ...(j.bonus ? { bonus: j.bonus } : {}) } };
}
/** 상단 바 영수 증서 칩 (지도 등): 번호 · 제철 가산 */
export function contractPill(r: RunState) {
  const c = r.contract;
  if (!c) return '';
  const b = c.bonus ?? c.sealed ?? 0, bt = b ? `${b > 0 ? '+' : '−'}${pct(Math.abs(b))}` : '';
  const tip = `영수 증서 No.${pad(c.no, 4)} — 의뢰 「${c.title}」 · ${c.plan}${b ? ` · ${c.kind === 'season' ? '제철 의뢰' : '보수 가감'} 승리 크레딧 ${bt}` : ''}`;
  return `<span class="pill ct-pill" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="f-num">No.${pad(c.no, 4)}</span>${bt ? `<em>${bt}</em>` : ''}</span>`;
}
/** 지도 환경 탭 '계약': 차림표에서 뺀 수치 (조항 전문 · 보수 배율) */
export function contractEnv(r: RunState) {
  const c = r.contract, d = r.diff || 0;
  if (!c && !d) return '';
  const b = c?.bonus ?? c?.sealed ?? 0;
  return `<h2>계약 <span class="muted small">${esc(c?.plan || diffLabel(d))}</span></h2>
    <ul class="globals ct-env">
      <li><b>승리 크레딧</b> <span class="muted">약관 ×${+CFG.diffWinMul(d).toFixed(2)}${b ? ` · ${c?.kind === 'season' ? '제철' : '가감'} ${b > 0 ? '+' : '−'}${pct(Math.abs(b))}` : ''}</span></li>
      ${DIFFS.filter((x) => x.lvl >= 1 && x.lvl <= d).map((x) => `<li><b>제${x.lvl}조</b> <span class="muted">${esc(x.desc)}</span></li>`).join('')}
    </ul>`;
}

// ───────── 전표 (출력기 · 날아가는 종이가 같은 줄을 쓴다)
/** k: h 머리 · hs 머리 아래 · m 흐림 · b 굵게 · s 들여 쓴 세부 · st 도장 색(담보 · 특약) · div 점선 · tot 합계. g = 묶음 (방금 찍힌 줄 표시) */
interface Row { l: string; r?: string; k?: string; g?: string }
function rows(): Row[] {
  const j = jobOf(), p = planOf(), out: Row[] = [];
  out.push({ l: 'ERRANTES BAR', k: 'h' }, { l: '의뢰 전표', k: 'hs' }, { l: `No.${pad(CT.no, 4)}`, r: CT.time, k: 'm' }, { l: '', k: 'div' });
  if (j) {
    const f = fieldOf(j.field), fi = fieldIntroOf(j.field);
    out.push({ l: `의뢰 「${fi?.title || f.name}」`, r: j.kind === 'season' ? '제철' : '직접 주문', k: 'b', g: 'job' });
    out.push({ l: `의뢰인 ${fi?.client || '—'}`, k: 's', g: 'job' }, { l: `전장 ${f.name}`, k: 's', g: 'job' });
  }
  if (p) {
    out.push({ l: '', k: 'div' }, { l: `${p.code} ${p.name}`, r: `조항 ${clauseN(p.lvl)}건`, k: 'b', g: 'plan' });
    if (collateral(p.lvl)) { const t = collateralTerms(p.lvl); out.push({ l: `담보 · ${t.hp}`, k: 'st', g: 'plan' }, { l: `담보 · ${t.despair} (${t.when})`, k: 'st', g: 'plan' }); }
  }
  const on = ridersOn() ? oathsOn(oathSel()) : [];
  if (on.length) {
    out.push({ l: '', k: 'div' }, { l: `특약 ${on.length}건`, r: `절망 ${heatNow()}`, k: 'b', g: 'rider' });
    for (const x of on) out.push({ l: `${x.def.name} ${x.n}단계`, r: `+${oathHeatOf(x.def.id, x.n)}`, k: 'st', g: `rider:${x.def.id}` });
  }
  if (j && p) {
    out.push({ l: '', k: 'div' }, { l: '보수', r: priceOf(j), k: 'tot' }, { l: '표기 위험', r: effDiffLabel(p.lvl, heatNow()), k: 'b' }, { l: '결제', r: CT.stamp === 'ok' ? '승인' : CT.stamp === 'void' ? '취소' : '벨을 누르면 승인', k: 'm' });
  }
  return out;
}
/** 방금 찍힌 묶음(rider:id 는 특약 머리줄도 함께)의 줄에 .new — --i 로 한 줄씩 밀려 올라온다 */
const isNew = (x: Row) => !!x.g && !!CT.last && (x.g === CT.last || (CT.last.startsWith('rider:') && x.g === 'rider'));
function slipHtml() {
  let i = 0;
  return rows().map((x) => x.k === 'div' ? '<i class="ct-r div" aria-hidden="true"></i>'
    : `<div class="ct-r ${x.k || ''}${isNew(x) ? ` new" style="--i:${i++}` : ''}"><span>${esc(x.l)}</span>${x.r ? `<span class="f-num">${esc(x.r)}</span>` : ''}</div>`).join('');
}
const newCount = () => rows().filter(isNew).length;

// ───────── 차림표
const clientShort = (c?: string) => (c || '').replace(/\s*\(.*\)$/, '');
/** 항목 한 줄: 이름 ‥‥ 가격, 아래 작은 설명 (고르면 네이비 띠로 반전) */
const row = (cls: string, attrs: string, nm: string, pr: string, ds: string[], on: boolean) =>
  `<button class="lp-row${on ? ' on' : ''}${cls ? ` ${cls}` : ''}" ${attrs} aria-pressed="${on}"><span class="lp-rt"><b class="lp-nm">${nm}</b><i class="lp-dots" aria-hidden="true"></i><em class="lp-pr">${pr}</em></span>${ds.map((d) => `<small class="lp-ds">${d}</small>`).join('')}</button>`;
function jobRow(j: Job, v: string, small = false) {
  const f = fieldOf(j.field), fi = fieldIntroOf(j.field), on = !!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field;
  return row(small ? 'sm' : '', `data-a="ct-job" data-v="${v}" data-f="job:${v}"`, `「${esc(fi?.title || f.name)}」`, j.kind === 'season' ? '제철' : '', [`${esc(f.name)}${fi ? ` · ${esc(clientShort(fi.client))}` : ''}`], on);
}
/** 의뢰 칸: (단골) 늘 하던 대로 + 오늘의 의뢰서 3장 + '메뉴에 없는 의뢰' 한 줄 */
function jobCol() {
  const custom = CT.sel?.kind === 'custom' ? CT.sel : null;
  if (CT.list) return `<button class="lp-row bk" data-a="ct-off" data-f="off">‹ 오늘의 의뢰서로</button>${offMenu().map((f) => jobRow(orderOf(f.id), `c:${f.id}`, true)).join('')}`;
  const u = CT.vet ? usual() : null, l = lastDeed();
  const us = u && l ? row('us', 'data-a="ct-usual" data-f="usual"', '늘 하던 대로', u.job.kind === 'season' ? '제철' : '', [`지난 계약 「${esc(fieldTitle(l.field))}」 · ${esc(u.plan.short)}`], false) : '';
  return `${us}${CT.jobs.map((j, i) => jobRow(j, `d${i}`)).join('')}${custom ? jobRow(custom, `c:${custom.field}`) : ''}
    ${row('', 'data-a="ct-off" data-f="off"', '메뉴에 없는 의뢰', '', [`다른 전장을 직접 주문 · ${offMenu().length}곳`], false)}`;
}
/** 위험 눈금: 칸 3개 중 n개 (담보 = 도장 색) */
const pipsHtml = (n: number, hot = false) => `<i class="ct-pips${hot ? ' hot' : ''}" role="img" aria-label="위험 ${n}/3">${[1, 2, 3].map((k) => `<b class="${k <= n ? 'on' : ''}"></b>`).join('')}</i>`;
/** 담보 봉인: 고르기 전에도 다른 약관과 다른 붉은 밀랍 도장 */
const WAX = `<i class="ct-wax" title="담보 — 함대를 담보로 잡는 약관" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l2.3 2.1 3-.6.9 2.9 2.9.9-.6 3L22 12l-2.1 2.3.6 3-2.9.9-.9 2.9-3-.6L12 22l-2.3-2.1-3 .6-.9-2.9-2.9-.9.6-3L2 12l2.1-2.3-.6-3 2.9-.9.9-2.9 3 .6z"/></svg><span>담보</span></i>`;
/** 약관 줄: 큰 글자 = 고르는 말, 작은 글자 = 부서 · 난이도 + 위험 눈금 (배율 숫자 없음) */
function planRow(lvl: number) {
  const p = PLAN_BY_LVL[lvl], hot = collateral(lvl);
  return row(hot ? 'hot' : '', `data-a="ct-plan" data-v="${lvl}" data-f="plan:${lvl}"`, esc(p.short), hot ? WAX : '', [`${esc(p.dept)} · ${esc(diffName(lvl))} ${pipsHtml(p.pips, hot)}`], CT.plan === lvl);
}
/** 담보를 고르면 약관 칸 아래로 펼쳐지는 담보 조항: 감수 / 보상을 나눠 아이콘으로 */
function collateralHtml(lit: boolean) {
  if (!collateral(CT.plan)) return '';
  const t = collateralTerms(CT.plan);
  return `<div class="ct-terms${lit ? ' lit' : ''}" aria-label="담보 조항">
    <section class="ct-tm cost"><h3>${lineIcon('m.skull', 'li')}감수</h3>
      <p>${lineIcon('r.hp', 'li')}<span>${esc(t.hp)}</span></p><p>${lineIcon('n.adversity', 'li')}<span>${esc(t.despair)}<small>${esc(t.when)}</small></span></p></section>
    <section class="ct-tm gain"><h3>${lineIcon('m.up', 'li')}보상</h3>
      ${gainsOf(CT.plan).map((g) => `<p>${lineIcon(g.icon, 'li')}<span>${esc(g.text)}</span></p>`).join('')}</section>
  </div>`;
}
/** 특약 줄: 이름 ‥ 절망 가산, 아래 단계 · 효과. 누를 때마다 단계가 오르고 마지막 다음은 끄기 */
function riderRow(id: OathId, i: number, lit: boolean) {
  const d = OATHS.find((o) => o.id === id)!, n = oathLv({ oaths: oathSel() }, id), max = oathMax(id);
  return row(`sm${lit ? ' lit' : ''}`, `style="--i:${i}" data-a="ct-rider" data-v="${id}" data-f="rider:${id}" title="${esc(n >= max ? '누르면 끄기' : `누르면 ${n + 1}단계`)}"`, esc(d.name), `+${oathHeatOf(id, Math.max(1, n))}`, [`${n ? `${n}단계 · ` : ''}${esc(d.lv(Math.max(1, n)))}`], n > 0);
}

// ───────── 청사진 (도면): 가리킨 · 고른 줄의 내용을 아이콘 · 구획으로 (줄글 없이)
const DRAW = `<svg class="lp-draw" viewBox="0 0 110 60" aria-hidden="true"><ellipse cx="55" cy="30" rx="50" ry="14"/><ellipse cx="55" cy="30" rx="30" ry="26" transform="rotate(-28 55 30)"/><circle cx="55" cy="30" r="4"/><circle cx="100" cy="23" r="2"/><line x1="55" y1="4" x2="55" y2="56" stroke-dasharray="2 3"/></svg>`;
const bh = (t: string, s: string) => `${DRAW}<header class="lp-bh"><b>${t}</b><span>${s}</span></header>`;
/** 구획: 아이콘 머리 + 아이콘 줄 */
const sect = (cls: string, icon: string, title: string, items: { icon: string; text: string; sub?: string }[]) =>
  `<section class="bp-sec ${cls}"><h3>${lineIcon(icon, 'li')}${esc(title)}</h3><ul>${items.map((x) => `<li>${lineIcon(x.icon, 'li')}<span>${esc(x.text)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></li>`).join('')}</ul></section>`;
/** 탁상 벨 작은 표시 (도면의 순서도) */
const BELL_MINI = `<svg class="li bell-mini" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
function infoHtml(): string {
  const [k, ...rest] = CT.focus.split(':'), v = rest.join(':');
  if (k === 'off') return `${bh('메뉴에 없는 의뢰', '다른 전장을 직접 주문')}
    ${sect('', 'k.ticket', '주문', [{ icon: 'r.node', text: `고를 수 있는 전장 ${offMenu().length}곳` }, { icon: 'r.cr', text: '기본 보수', sub: '제철 가산 없음' }])}`;
  if (k === 'usual') { const u = usual(); return u ? `${bh('늘 하던 대로', '지난 영수 증서를 그대로')}
    ${sect('', 'k.note', '지난 계약', [{ icon: 'r.flag', text: `「${fieldTitle(u.job.field)}」`, sub: u.job.kind === 'season' ? '오늘 제철' : '오늘 메뉴에 없음 · 기본 보수' }, { icon: 'k.seize', text: u.plan.short, sub: `${u.plan.dept} · ${diffName(u.plan.lvl)}` }])}` : ''; }
  if (k === 'job') {
    const j = v.startsWith('c:') ? orderOf(v.slice(2)) : CT.jobs[+v.slice(1)];
    if (!j) return '';
    const f = fieldOf(j.field), fi = fieldIntroOf(j.field);
    return `${bh(`「${esc(fi?.title || f.name)}」`, `${esc(f.name)} · ${esc(f.region)}`)}
      <div class="lp-kv"><span><i>의뢰인</i><b>${esc(fi?.client || '—')}</b></span><span><i>보수</i><b>${esc(priceOf(j))}</b>${fi?.reward ? `<small>${esc(fi.reward)}</small>` : ''}</span></div>
      ${fi?.brief ? `<p class="lp-ip">${esc(fi.brief)}</p>` : ''}${hooks.brief(j.field)}`;
  }
  if (k === 'plan') {
    const p = PLAN_BY_LVL[+v];
    if (!p) return '';
    return `${bh(`${esc(p.short)} ${pipsHtml(p.pips, collateral(p.lvl))}`, `${esc(p.code)} ${esc(p.name)} · ${esc(diffName(p.lvl))}`)}
      <div class="bp-two">${sect('cost', 'm.skull', '감수', costsOf(p.lvl))}${sect('gain', 'm.up', '보상', gainsOf(p.lvl))}</div>
      <p class="bp-foot">${lineIcon('k.note', 'li')}조항 ${clauseN(p.lvl)}건 · 수치는 출격 뒤 지도 환경 탭 '계약'</p>`;
  }
  if (k === 'rider') {
    const d = OATHS.find((o) => o.id === v);
    if (!d) return '';
    const n = oathLv({ oaths: oathSel() }, d.id);
    return `${bh(`${lineIcon(d.icon, 'li')}${esc(d.name)}`, `특약 · 절망 서약${ridersOn() ? '' : ' · 담보 약관에만 붙는다'}`)}
      <ol class="lp-lv">${Array.from({ length: oathMax(d.id) }, (_, i) => i + 1).map((k2) => `<li class="${k2 === n ? 'on' : ''}"><b>${k2}단계</b><span>${esc(d.lv(k2))}</span><em class="f-num">절망 +${oathHeatOf(d.id, k2)}</em></li>`).join('')}</ol>`;
  }
  return `${bh('의뢰 도면', `오늘의 의뢰서 ${CT.jobs.length}장 · 모두 제철`)}
    <ol class="bp-steps"><li>${lineIcon('r.flag', 'li')}<b>의뢰</b><span>어디로</span></li><li>${lineIcon('k.seize', 'li')}<b>약관</b><span>얼마나 위험하게</span></li><li>${lineIcon('m.skull', 'li')}<b>특약</b><span>담보일 때만</span></li><li>${BELL_MINI}<b>벨</b><span>전표 승인</span></li></ol>`;
}
/** 카운터 너머 목소리 (에이든): 상태가 바뀔 때만 잠깐 */
function sayFor(a: string): string {
  const j = jobOf();
  if (a === 'usual' && j) return j.kind === 'custom' ? '늘 하시던 걸로요. 오늘은 제철이 아니라 기본으로 쳐 드립니다.' : '늘 하시던 걸로요. 마침 오늘 제철입니다.';
  if (a === 'collateral') return '담보 약관이요. 함대를 맡기시는 겁니다. 돌아오는 길은 장담 못 합니다.';
  if (a === 'ready') return '다 고르셨으면 벨을 누르시죠.';
  if (a === 'ok') return '승인했습니다. 좋은 밤 되시길.';
  if (a === 'void') return '없던 걸로 하죠. 다시 고르시면 됩니다.';
  return '';
}
function usual() {
  const l = lastDeed(), plan = l ? PLAN_BY_LVL[l.plan] : null;
  if (!l || !plan || !FIELDS.some((f) => f.id === l.field)) return null;
  return { job: orderOf(l.field), plan };
}

// ───────── 소품 (탑뷰 · 왼쪽 위 광원): 그림(art/ct_*.webp)이 있으면 그림, 없으면 같은 광원의 면 그림
const prop = (id: string, fallback: string) => `${fallback}<img class="ct-art" alt="" src="${artURL(`${id}.webp`)}" decoding="async" onerror="this.remove()">`;
/** 탁상 벨 (위에서 본 놋쇠 돔 + 나무 받침) */
const BELL_SVG = `<svg class="ct-fb" viewBox="0 0 120 120" aria-hidden="true"><circle cx="65" cy="67" r="50" class="sh"/><circle cx="60" cy="60" r="50" class="base"/><circle cx="60" cy="60" r="43" class="base2"/><circle cx="60" cy="60" r="34" class="dome"/><path d="M36 50a26 26 0 0 1 24-16" class="hl"/><circle cx="60" cy="60" r="9" class="btn"/><circle cx="57.5" cy="57.5" r="3" class="hl2"/></svg>`;
/** 전표 출력기 (위에서 본 네이비 법랑 몸체 + 놋쇠 테 + 위쪽 슬릿) */
const PRINTER_SVG = `<svg class="ct-fb" viewBox="0 0 100 154" aria-hidden="true"><rect x="10" y="6" width="84" height="146" rx="10" class="sh"/><rect x="4" y="2" width="84" height="146" rx="10" class="body"/><rect x="9" y="7" width="74" height="136" rx="7" class="rim"/><rect x="15" y="9" width="62" height="7" rx="2" class="slot"/><rect x="18" y="11.5" width="56" height="2" rx="1" class="gap"/></svg>`;

function boardHtml() {
  const ok = payable(), heat = heatNow(), lit = CT.lit, nn = newCount();
  CT.lit = false;
  const leave = CT.from === 'bar' ? '바로 돌아가기' : '타이틀로';
  const n = rows().filter((r) => r.k !== 'div').length;
  return `<main class="ct ct-top${CT.intro && !reduced() ? ' intro' : ''}${CT.stamp ? ` st-${CT.stamp}` : ''}" style="--rot-bp:${CT.rot.bp}deg;--rot-mn:${CT.rot.mn}deg" aria-label="출격 계약 — 바 테이블 위 의뢰 차림표">
    ${CT.intro ? `<div class="ct-barview" style="background-image:url('${bgURL('erantes_bar')}')" aria-hidden="true"></div>` : ''}
    <div class="ct-table" aria-hidden="true">${prop('ct_table', '')}</div><div class="lp-grain" aria-hidden="true"></div>
    <button class="ct-leave lp-btn" data-a="ct-leave">${leave} ›</button>
    <p class="ct-voice${CT.say ? ' on' : ''}" aria-live="polite"><b>에이든</b><span>${esc(CT.say)}</span></p>
    <section class="ct-bp lp-bp" aria-live="polite" aria-label="의뢰 도면">${infoHtml()}</section>
    <div class="ct-menu">
      ${coverHtml()}
      <section class="ct-page lp-paper lp-frame" aria-label="의뢰 차림표">
        <div class="lp-cols${CT.list ? ' listing' : ''}">
          <div class="lp-col ct-col-job" role="group" aria-label="의뢰"><h2 class="lp-h2">의뢰 <small>${CT.list ? '메뉴에 없는 것' : '모두 싯가'}</small></h2><div class="lp-list">${jobCol()}</div></div>
          <div class="lp-col ct-col-plan" role="group" aria-label="약관"><h2 class="lp-h2">약관 <small>난이도</small></h2><div class="lp-list">${PLANS.map((p) => planRow(p.lvl)).join('')}${collateralHtml(lit)}</div></div>
          <div class="lp-col ct-col-rider${ridersOn() ? '' : ' off'}" role="group" aria-label="특약"><h2 class="lp-h2">특약 <small>${ridersOn() ? `절망 ${heat}` : '담보 전용'}</small></h2><div class="lp-list">${ridersOn() ? OATHS.map((o, i) => riderRow(o.id, i, lit)).join('') : ''}</div></div>
        </div>
        ${collateral(CT.plan) ? `<i class="ct-plan-stamp${lit ? ' lit' : ''}" aria-hidden="true">담보</i>` : ''}
      </section>
    </div>
    <section class="ct-printer${nn ? ' feed' : ''}" aria-label="의뢰 전표">
      <div class="ct-slipwrap" style="--n:${n}">
        <div class="ct-slip lp-carbon">${slipHtml()}${CT.stamp ? `<i class="ct-stampmark ${CT.stamp}" aria-hidden="true">${CT.stamp === 'ok' ? '승인' : '취소'}</i>` : ''}</div>
      </div>
      <div class="ct-pmach" aria-hidden="true">${prop('ct_printer', PRINTER_SVG)}</div>
    </section>
    <div class="ct-desk">
      <button class="ct-cancel lp-btn" data-a="ct-cancel"${jobOf() && !CT.stamp ? '' : ' disabled'}>의뢰 취소</button>
      <button class="ct-bell${ok && !CT.stamp ? ' ready' : ''}" data-a="ct-bell" aria-label="벨을 눌러 전표 승인"${ok && !CT.stamp ? '' : ' aria-disabled="true"'}>${prop('ct_bell', BELL_SVG)}</button>
    </div>
    <div class="ct-light" aria-hidden="true"></div><div class="ct-glow" aria-hidden="true"></div>
    ${hooks.foe()}
  </main>`;
}
/** 표지 장식 (금 선 그림 두 겹): 모서리 스와시 · 가운데 마름모 괘선 · 별자리 */
const gold = (d: string, vb: string, cls: string) => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true"><g class="lp-lo">${d}</g><g class="lp-hi">${d}</g></svg>`;
const SWASH = "<path d='M6 50C6 22 20 8 50 6'/><path d='M12 46C12 26 24 14 46 12'/><path d='M14 30c0-7 9-7 9 0 0 5-7 5-7 0'/><path d='M30 14c-7 0-7 9 0 9 5 0 5-7 0-7'/>";
const CORNERS = ['tl', 'tr', 'bl', 'br'].map((k) => gold(SWASH, '0 0 56 56', `ct-co ${k}`)).join('');
const FLEURON = gold("<path d='M4 8H40M64 8H100'/><path d='M52 1 59 8 52 15 45 8Z'/><circle cx='42' cy='8' r='1.4'/><circle cx='62' cy='8' r='1.4'/>", '0 0 104 16', 'ct-fl');
const CONST = `<svg class="ct-const" viewBox="0 0 120 44" aria-hidden="true"><polyline points="14,30 34,13 54,24 76,9 100,20"/><circle cx="14" cy="30" r="1.6"/><circle cx="34" cy="13" r="1.2"/><circle cx="54" cy="24" r="1.9"/><circle cx="76" cy="9" r="1.1"/><circle cx="100" cy="20" r="1.5"/><circle cx="110" cy="34" r=".9"/></svg>`;
/** 표지: 네이비 바탕 + 금 액자 · 동판 필기체 'Errantes' (아래에서 위로 읽는 간판) */
function coverHtml() {
  return `<section class="ct-cover lp-band" aria-label="에란테스 바 — 의뢰 차림표">
    ${CORNERS}${CONST}
    <span class="ct-cv-k">· BAR ·</span>
    ${FLEURON}
    <h1 class="ct-signboard" lang="la" aria-label="에란테스">Errantes</h1>
    ${FLEURON}
    <span class="ct-cv-k">의뢰 차림표</span>
  </section>`;
}
/** 지휘관 서명 (날아가는 전표에만) */
const SIG = '레이첼';
const CHAIN_DEFS = `<svg class="ct-defs" width="0" height="0" aria-hidden="true"><defs><pattern id="ct-chain" width="18" height="30" patternUnits="userSpaceOnUse">
  <ellipse class="ct-au-lo" cx="9" cy="8" rx="5.5" ry="7.6"/><ellipse class="ct-au-hi" cx="9" cy="7.6" rx="4.6" ry="6.6"/><rect class="ct-au-lo" x="7.4" y="15" width="3.2" height="15" rx="1.6"/><rect class="ct-au-hi" x="7.8" y="14.6" width="2.4" height="14.6" rx="1.2"/></pattern></defs></svg>`;
function sealHtml() {
  const ch = [[0.12, 0.42], [0.25, 0.56], [0.75, 0.5], [0.88, 0.38]];
  return `<main class="ct ct-seal${CT.vet ? ' quick' : ''}" data-a="ct-skip" aria-label="그늘 — 누르면 넘깁니다">
    <div class="ct-table" aria-hidden="true">${prop('ct_table', '')}</div><div class="ct-dark" aria-hidden="true"></div><div class="lp-grain" aria-hidden="true"></div>
    <div class="ct-fly lp-carbon" aria-hidden="true">${slipHtml()}<i class="ct-stampmark ok">승인</i><div class="ct-sigline"><i class="lp-sig">${SIG}</i></div></div>
    ${CHAIN_DEFS}
    ${ch.map(([x, h], i) => `<div class="ct-chain" style="--x:${x};--h:${h};--d:${(i * 0.14).toFixed(2)}s" aria-hidden="true"><div class="ct-sway"><svg preserveAspectRatio="none" aria-hidden="true"><rect width="18" height="100%" fill="url(#ct-chain)"/></svg></div></div>`).join('')}
    <div class="ct-watch" aria-hidden="true"><div class="ct-swing">
      <svg viewBox="0 0 140 600" aria-hidden="true">
        <rect x="61" y="0" width="18" height="434" fill="url(#ct-chain)"/>
        <g transform="translate(10 426)"><g class="ct-twist">
          <circle class="ct-bow" cx="60" cy="10" r="9"/><circle class="ct-bow hi" cx="60" cy="9.4" r="9"/>
          <circle class="ct-case" cx="60" cy="84" r="60"/><circle class="ct-rim" cx="60" cy="84" r="56"/><circle class="ct-rim2" cx="60" cy="83.4" r="56"/>
          <circle class="ct-enamel-o" cx="60" cy="84" r="51"/><circle class="ct-enamel" cx="60" cy="84" r="41"/>
          ${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6, r1 = i % 3 ? 45 : 42; return `<line class="ct-tick" x1="${(60 + Math.sin(a) * r1).toFixed(1)}" y1="${(84 - Math.cos(a) * r1).toFixed(1)}" x2="${(60 + Math.sin(a) * 49).toFixed(1)}" y2="${(84 - Math.cos(a) * 49).toFixed(1)}"/>`; }).join('')}
          <line class="ct-hh" x1="60" y1="84" x2="78" y2="72"/><g class="ct-hand"><line class="ct-mh" x1="60" y1="84" x2="60" y2="40"/></g><circle class="ct-pin" cx="60" cy="84" r="4"/>
          <path class="ct-glass" d="M 26 62 A 41 41 0 0 1 70 44"/>
        </g></g>
      </svg>
    </div></div>
    <p class="ct-load"><span>계약 기물 명부를 펼치는 중</span><i>.</i><i>.</i><i>.</i></p>
    <p class="ct-skip-k">누르면 넘깁니다</p>
    <div class="ct-beat" aria-hidden="true"></div>
  </main>`;
}

export function contractScreen(): string {
  if (CT.step === 'seal') return sealHtml();
  return boardHtml();
}

// ───────── 동작
/** 전표 한 묶음을 찍는다: 인쇄음은 줄마다 (최대 4번) */
function printed(group: string) {
  CT.last = group;
  const n = Math.min(4, Math.max(1, newCount()));
  for (let i = 0; i < n; i++) sfx('print', { delay: i * 0.11, pitch: 1 + (i % 2) * 0.04 });
}
const say = (a: string) => { const t = sayFor(a); if (t) CT.say = t; };
/** data-a="ct-*" 처리. 다시 그려야 하면 true */
export function contractAct(a: string, v: string): boolean {
  if (CT.stamp && a !== 'ct-leave' && a !== 'ct-skip') return false; // 도장이 찍히는 동안은 테이블을 만지지 않는다
  const wasReady = payable();
  const after = (r: boolean) => { if (r && !wasReady && payable() && !CT.say) say('ready'); return r; };
  switch (a) {
    case 'ct-job': {
      const j = v.startsWith('c:') ? (FIELDS.some((f) => f.id === v.slice(2)) ? orderOf(v.slice(2)) : null) : CT.jobs[+v.slice(1)];
      if (!j) return false;
      const same = !!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field;
      CT.sel = same ? null : j; CT.focus = `job:${v}`; CT.say = '';
      if (v.startsWith('c:')) CT.list = false;
      if (CT.sel) printed('job'); else CT.last = '';
      return after(true);
    }
    case 'ct-off': CT.list = !CT.list; CT.focus = 'off'; CT.last = ''; CT.say = ''; return true;
    case 'ct-usual': {
      const u = usual();
      if (!u) return false;
      CT.lit = !ridersOn() && oathDiff(u.plan.lvl);
      CT.sel = u.job; CT.plan = u.plan.lvl; CT.list = false; CT.focus = 'usual';
      say('usual');
      printed('job');
      return true;
    }
    case 'ct-plan': {
      if (!PLAN_BY_LVL[+v]) return false;
      const was = collateral(CT.plan);
      CT.lit = !ridersOn() && oathDiff(+v); // 담보 약관을 켜는 순간 특약 칸 · 담보 조항에 불이 들어온다
      CT.plan = +v; CT.focus = `plan:${v}`; CT.say = '';
      if (collateral(+v) && !was) { say('collateral'); sfx('knock', { pitch: 0.7 }); sfx('despair', { delay: 0.15 }); }
      printed('plan');
      return after(true);
    }
    case 'ct-rider': {
      const d = OATHS.find((o) => o.id === v);
      if (!d) return false;
      CT.focus = `rider:${v}`;
      if (!ridersOn()) return false;
      const s = oathSel(), n = oathLv({ oaths: s }, d.id);
      s[d.id] = n >= oathMax(d.id) ? 0 : n + 1;
      metaOath(s);
      CT.say = '';
      if (s[d.id]) printed(`rider:${d.id}`); else CT.last = '';
      return true;
    }
    case 'ct-bell': { // 벨: 전표에 '승인' 도장 → 그늘 → 명부
      if (!payable()) { hooks.toast('의뢰와 약관을 먼저 고르세요.'); return false; }
      clear();
      CT.stamp = 'ok'; CT.last = ''; say('ok');
      sfx('bell'); sfx('knock', { delay: 0.25, pitch: 0.8 });
      later(reduced() ? 400 : CT.vet ? 900 : 1300, () => { if (CT.stamp === 'ok') { CT.step = 'seal'; hooks.render(); } });
      return true;
    }
    case 'ct-cancel': { // 의뢰 취소: '취소' 도장 → 전표가 바깥으로 미끄러져 나가고 고른 것이 비워진다 (테이블은 그대로)
      if (!jobOf()) return false;
      clear();
      CT.stamp = 'void'; CT.last = ''; say('void');
      sfx('knock', { pitch: 0.75 }); sfx('paper', { delay: 0.45 });
      later(reduced() ? 300 : 1200, () => { Object.assign(CT, { stamp: '', sel: null, focus: '', last: '', list: false }); hooks.render(); });
      return true;
    }
    case 'ct-skip': finish(); return false;
    case 'ct-leave': clear(); hooks.leave(CT.from); return false;
  }
  return false;
}
/** 청사진만 바꾼다 (가리키기) */
function refreshInfo() {
  const el = document.querySelector<HTMLElement>('.ct-bp');
  if (el) el.innerHTML = infoHtml();
}
/** 그늘 연출 끝 → 명부 */
function finish() {
  clear();
  const s = signedContract();
  if (!s) { contractBack(); hooks.render(); return; }
  CT.fromSeal = true;
  hooks.roster(s);
}

/** 그린 뒤 (main.ts render): 등장 연출 · 가리키기 → 청사진 · 목소리 사라짐 · 그늘 연출 시간표 */
export function contractMount(root: HTMLElement) {
  const ct = root.querySelector<HTMLElement>('main.ct');
  if (!ct) return;
  if (CT.step === 'board') {
    if (CT.intro) { CT.intro = false; if (!reduced()) { sfx('paper', { delay: 0.8 }); sfx('paper', { delay: 1.05, pitch: 0.9 }); } window.setTimeout(() => ct.querySelector('.ct-barview')?.remove(), 1400); }
    const menu = ct.querySelector<HTMLElement>('.ct-menu');
    const point = (e: Event) => {
      const f = (e.target as HTMLElement).closest<HTMLElement>('[data-f]')?.dataset.f;
      if (f && f !== CT.focus) { CT.focus = f; refreshInfo(); }
    };
    menu?.addEventListener('mouseover', point);
    menu?.addEventListener('focusin', point);
    if (CT.last) later(1200, () => { CT.last = ''; });
    if (CT.say) { const said = CT.say; later(CT.stamp ? 6000 : 4200, () => { if (CT.say === said) { CT.say = ''; ct.querySelector('.ct-voice')?.classList.remove('on'); } }); }
    return;
  }
  if (CT.step !== 'seal') return;
  clear();
  if (reduced()) { later(900, finish); return; }
  // 처음: 0 종이가 날아가고 테이블이 어둠에 잠긴다 → 0.6 체인이 내려온다 → 3.0 그늘이 눈높이에 멈춘다 (심장 박동) → 4.5 반동 뒤 끌려 올라간다 → 5.5 명부
  // 두 번째부터 (CSS .quick): 같은 순서를 2.4초로 압축 — 의식은 처음에만 길다
  const t = CT.vet ? [200, 1300, 1700, 2400] : [600, 3000, 4500, 5500];
  sfx('paper');
  later(t[0], () => sfx('chain'));
  later(t[1], () => { ct.classList.add('beat'); sfx('heart'); sfx('despair'); });
  later(t[2], () => { ct.classList.add('lift'); sfx('chain'); });
  later(t[3], finish);
}
