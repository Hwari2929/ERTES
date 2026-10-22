// 출격 계약: 에란테스 바 카운터 위에 펼친 세 쪽 접이 차림표 (네이비 표지 · 속지 · 청사진). 속지의 줄을 고르면 오른쪽 인쇄기에서 카본지 전표가 한 줄씩 덜그럭 밀려 나오고,
// 탁상 벨을 누르면 차림표가 카운터 아래로 내려가고 전표만 올라와 전부 보인다 → 아래 서명란에 만년필 서명 → 전표가 날아가고 금 체인과 그늘(회중시계)이 내려왔다 올라가며 → 계약 기물 명부 (main.ts newRunScreen).
// 의뢰 = 전장 (의뢰 제목 · 의뢰인 = data/scenes/fields.ts) · 약관 = 난이도 (data/contract.ts PLANS, 조항 = data/difficulty.ts DIFFS) · 특약 = 절망 서약 (data/oaths.ts, 담보 약관에만).
// 단골 경로: 두 번째 계약부터 의뢰 칸 맨 위에 '늘 하던 대로'(지난 계약) · 그늘 연출 압축 (의식은 처음에만 길다). 전표 번호는 서명하고 출격한 수 (ui/meta.ts deeds).
// 이름 · 수치는 그릴 때마다 데이터 · 설정에서 읽는다. 재료는 청사진 레터프레스 키트 (style.css .lp-*, docs/UI.md 19): 네이비 표지 · 한색 종이 · 청사진 · 카본지 · 금 괘선.
import { CFG } from '../config';
import { FIELDS, fieldOf } from '../data/battlefields';
import { customWin, PLAN_BY_LVL, PLANS, rollSealed, sealedRange } from '../data/contract';
import { DIFFS, diffName, effDiffLabel } from '../data/difficulty';
import { despairDiff, despairPhases } from '../data/despair';
import { OATHS, oathDiff, oathHeat, oathHeatOf, oathLv, oathMax, oathsOn, oathWinMul, type OathId } from '../data/oaths';
import { fieldIntroOf } from '../data/scenes/fields';
import type { RunState } from '../types';
import { figStyle } from './bar';
import { deedCount, lastDeed, metaOath, oathSel } from './meta';
import { bgURL, standURL } from './portraits';
import { sfx } from './sound';
import { lineIcon } from './synicons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const mul = (x: number) => `×${+x.toFixed(2)}`;
const pad = (n: number, k = 2) => String(n).padStart(k, '0');
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type Step = 'board' | 'seal';
/** 의뢰서: open = 정가 · sealed = 싯가 의뢰 (서명 뒤에 전장 · 의뢰인 · 보수 가산이 드러난다) · custom = 메뉴에 없는 의뢰 (직접 주문). bonus = 승리 크레딧 가감 */
type Kind = 'open' | 'sealed' | 'custom';
interface Job { field: string; kind: Kind; bonus: number }
/** 에이든의 한마디 (상태에 따라) */
type Say = '' | 'usual';
const CT = {
  step: 'board' as Step,
  /** 차림표를 연 곳 (나가기 = 그리로): 'bar' · 'title' */
  from: 'title',
  /** 오늘의 의뢰서 3장 (정가 2 + 싯가 1) */
  jobs: [] as Job[],
  /** 고른 의뢰 (오늘의 의뢰서 중 하나, 또는 메뉴에 없는 의뢰) */
  sel: null as Job | null,
  /** 메뉴에 없는 의뢰 목록을 펼쳤는지 */
  list: false,
  /** 두 번째 계약부터 (서명하고 출격한 적이 있음): 표지에 지난 계약 · 그늘 연출 압축 */
  vet: false,
  /** 담보 약관을 막 골라 특약 칸에 불이 들어오는 중 (그릴 때 한 번) */
  lit: false,
  /** 약관 = 위험 등급 (이번 방문 동안 기억) */
  plan: PLANS[0].lvl,
  /** 청사진 쪽이 보여 주는 줄: 'job:0' · 'plan:3' · 'rider:grit' · '' */
  focus: '',
  /** 방금 전표에 찍힌 묶음: 'job' · 'plan' · 'rider:id' (그 줄들이 덜그럭 밀려 나온다) */
  last: '',
  /** 벨을 눌러 차림표가 내려가고 전표가 올라온 상태 (서명 대기) */
  signing: false,
  signed: false,
  say: '' as Say,
  /** 전표 번호 · 시각 */
  no: 0,
  time: '',
  timers: [] as number[],
  /** 그늘 연출을 막 끝내고 명부를 여는 중 (명부 화면이 어둠에서 밝아진다) */
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
const heatNow = () => (ridersOn() ? oathHeat(oathSel()) : 0);
const hidden = (j: Job | null) => !!j && j.kind === 'sealed' && !CT.signed;
const payable = () => !!jobOf() && !!planOf();
const fieldTitle = (fid: string) => fieldIntroOf(fid)?.title || fieldOf(fid).name;
/** 승리 크레딧 배율: 약관 × 박봉의 서약 × 싯가 가산 (봉인 중이면 가산 없이) */
function winMul() {
  const j = jobOf();
  return CFG.diffWinMul(CT.plan) * (ridersOn() ? oathWinMul({ oaths: oathSel() }) : 1) * (j && !hidden(j) ? 1 + j.bonus : 1);
}
const winText = () => `${mul(winMul())}${hidden(jobOf()) ? ' + 싯가' : ''}`;
const sealedRangeText = () => { const [a, b] = sealedRange(); return `+${pct(a)}~${pct(b)}`; };
/** 할 단위 (에이든 말투): 0.1 → '1' */
const hal = (x: number) => String(Math.round(Math.abs(x) * 10));
/** 보수 가감 표기: 정가 · 싯가 +n% · 메뉴 외 −n% */
const priceOf = (j: Job) => (j.kind === 'sealed' ? (hidden(j) ? '싯가' : `싯가 +${pct(j.bonus)}`) : j.kind === 'custom' ? `메뉴 외 −${pct(-j.bonus)}` : '정가');
/** 직전 약관의 위험 등급 (승계 조항) */
const prevLvl = (lvl: number) => PLANS.filter((p) => p.lvl < lvl).reduce((a, p) => Math.max(a, p.lvl), 0);
/** 조항 한 줄: 위험 등급 설명의 첫 문장 */
const clause = (desc: string) => desc.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
const clausesOf = (lvl: number) => DIFFS.filter((d) => d.lvl > prevLvl(lvl) && d.lvl <= lvl);
/** 약관의 대표 조항 (차림표 한 줄): 절망 증강이 새로 붙는 약관이면 그것, 아니면 그 등급의 첫 문장 (괄호 뺌) */
const repClause = (lvl: number) => (despairDiff(lvl) && !despairDiff(prevLvl(lvl)) ? '절망 증강 담보' : clause(DIFFS.find((d) => d.lvl === lvl)?.desc || '').replace(/\s*\([^)]*\)/g, ''));

function newSealed(except: string[]): Job {
  const ids = FIELDS.map((f) => f.id).filter((id) => !except.includes(id));
  return { field: ids[Math.floor(Math.random() * ids.length)] || FIELDS[0].id, kind: 'sealed', bonus: rollSealed(Math.random) };
}
/** 메뉴에 없는 의뢰로 고를 수 있는 전장: 오늘 정가 의뢰서에 있는 전장은 그 의뢰서로 (싯가 봉투 속 전장은 모르니 목록에 남는다) */
const offMenu = () => FIELDS.filter((f) => !CT.jobs.some((j) => j.kind === 'open' && j.field === f.id));
/** 그 전장 주문: 오늘 정가 의뢰서에 있으면 그것, 없으면 메뉴에 없는 의뢰 */
const orderOf = (fid: string): Job => CT.jobs.find((j) => j.kind === 'open' && j.field === fid) || { field: fid, kind: 'custom', bonus: customWin() };
/** 차림표를 연다: 오늘의 의뢰서 3장 (정가 2 + 싯가 1). list = 메뉴에 없는 의뢰 목록을 펼친 채로 (타이틀 옛 '지정 의뢰') */
export function contractStart(from: string, list = false) {
  clear();
  const n = deedCount();
  Object.assign(CT, { step: 'board', from, sel: null, list, vet: n > 0, lit: false, focus: '', last: '', signing: false, signed: false, say: '', fromSeal: false });
  CT.no = n + 1;
  const d = new Date();
  CT.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ids = shuffle(FIELDS.map((f) => f.id));
  CT.jobs = [{ field: ids[0], kind: 'open', bonus: 0 }, { field: ids[1], kind: 'open', bonus: 0 }, newSealed(ids.slice(0, 2))];
}
/** 명부에서 '뒤로': 차림표로 (고른 것은 그대로, 서명은 무른다) */
export function contractBack() { clear(); Object.assign(CT, { step: 'board', signing: false, signed: false, say: '', last: '', fromSeal: false }); }
/** 명부 화면이 그늘 연출에서 이어지는지 (한 번 읽으면 지운다) */
export function takeFromSeal() { const v = CT.fromSeal; CT.fromSeal = false; return v; }
/** 서명한 계약 (출격 때 run.contract) */
export function signedContract(): Signed | null {
  const j = jobOf(), p = planOf();
  if (!j || !p) return null;
  return { field: j.field, diff: p.lvl, contract: { no: CT.no, title: fieldTitle(j.field), plan: p.label, ...(j.kind !== 'open' ? { bonus: j.bonus, kind: j.kind } : {}) } };
}
/** 상단 바 영수 증서 칩 (지도 등): 번호 · 의뢰 제목 · 계약 종류 · 싯가 가산 */
export function contractPill(r: RunState) {
  const c = r.contract;
  if (!c) return '';
  const b = c.bonus ?? c.sealed ?? 0, bt = b ? `${b > 0 ? '+' : '−'}${pct(Math.abs(b))}` : '';
  const tip = `영수 증서 No.${pad(c.no, 4)} — 의뢰 「${c.title}」 · ${c.plan}${b ? ` · ${c.kind === 'custom' ? '메뉴에 없는 의뢰' : '싯가 의뢰'} 승리 크레딧 ${bt}` : ''}`;
  return `<span class="pill ct-pill" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="f-num">No.${pad(c.no, 4)}</span>${bt ? `<em>${bt}</em>` : ''}</span>`;
}

// ───────── 전표 (인쇄기 · 서명 · 날아가는 종이가 같은 줄을 쓴다)
/** k: h 머리 · hs 머리 아래 · m 흐림 · b 굵게 · s 들여 쓴 세부 · st 도장(특약) · div 점선 · tot 합계. g = 묶음 (방금 찍힌 줄 표시) */
interface Row { l: string; r?: string; k?: string; g?: string }
function rows(): Row[] {
  const j = jobOf(), p = planOf(), out: Row[] = [];
  out.push({ l: 'ERRANTES BAR', k: 'h' }, { l: '의뢰 전표', k: 'hs' }, { l: `No.${pad(CT.no, 4)}`, r: CT.time, k: 'm' }, { l: '', k: 'div' });
  if (j) {
    const f = fieldOf(j.field), fi = fieldIntroOf(j.field), hid = hidden(j);
    out.push({ l: hid ? '의뢰 (싯가)' : `의뢰 「${fi?.title || f.name}」`, r: priceOf(j), k: 'b', g: 'job' });
    out.push({ l: `의뢰인 ${hid ? '발신자 없음' : fi?.client || '—'}`, k: 's', g: 'job' }, { l: `전장 ${hid ? '서명 뒤 공개' : f.name}`, k: 's', g: 'job' });
  }
  if (p) {
    out.push({ l: '', k: 'div' }, { l: `${p.code} ${p.name}`, r: mul(CFG.diffWinMul(p.lvl)), k: 'b', g: 'plan' });
    const pv = prevLvl(p.lvl);
    if (pv) out.push({ l: `제1~${pv}조 ${PLAN_BY_LVL[pv].name} 승계`, k: 's', g: 'plan' });
    for (const d of clausesOf(p.lvl)) out.push({ l: `제${d.lvl}조 ${clause(d.desc)}`, k: 's', g: 'plan' });
    if (despairDiff(p.lvl) && !despairDiff(pv)) { const ph = despairPhases(); out.push({ l: `담보 조항 절망 증강 ${1 + ph.length}건 (출격${ph.length ? ` · ${ph.join(' · ')}페이즈` : ''})`, k: 'st', g: 'plan' }); }
  }
  const on = ridersOn() ? oathsOn(oathSel()) : [];
  if (on.length) {
    out.push({ l: '', k: 'div' }, { l: `특약 ${on.length}건`, r: `절망 ${heatNow()}`, k: 'b', g: 'rider' });
    for (const x of on) out.push({ l: `${x.def.name} ${x.n}단계`, r: `+${oathHeatOf(x.def.id, x.n)}`, k: 'st', g: `rider:${x.def.id}` }, { l: x.def.lv(x.n), k: 's', g: `rider:${x.def.id}` });
  }
  if (j && p) {
    out.push({ l: '', k: 'div' }, { l: '승리 크레딧', r: winText(), k: 'tot' }, { l: '표기 위험', r: effDiffLabel(p.lvl, heatNow()), k: 'b' }, { l: '결제', r: CT.signed ? '서명 완료' : '서명', k: 'm' });
  }
  return out;
}
/** 방금 찍힌 묶음(rider:id 는 특약 머리줄 'rider' 도 함께)의 줄에 .new — 줄마다 --i 를 주어 한 줄씩 밀려 나온다 */
const isNew = (x: Row) => !!x.g && !!CT.last && (x.g === CT.last || (CT.last.startsWith('rider:') && x.g === 'rider'));
function slipHtml() {
  let i = 0;
  return rows().map((x) => x.k === 'div' ? '<i class="ct-r div" aria-hidden="true"></i>'
    : `<div class="ct-r ${x.k || ''}${isNew(x) ? ` new" style="--i:${i++}` : ''}"><span>${esc(x.l)}</span>${x.r ? `<span class="f-num">${esc(x.r)}</span>` : ''}</div>`).join('');
}
const newCount = () => rows().filter(isNew).length;

// ───────── 차림표 (속지)
const clientShort = (c?: string) => (c || '').replace(/\s*\(.*\)$/, '');
/** 항목 한 줄: 이름 ‥‥ 가격, 아래 작은 설명 (고르면 네이비 띠로 반전) */
const row = (cls: string, attrs: string, nm: string, pr: string, ds: string[], on: boolean) =>
  `<button class="lp-row${on ? ' on' : ''}${cls ? ` ${cls}` : ''}" ${attrs} aria-pressed="${on}"><span class="lp-rt"><b class="lp-nm">${nm}</b><i class="lp-dots" aria-hidden="true"></i><em class="lp-pr">${pr}</em></span>${ds.map((d) => `<small class="lp-ds">${d}</small>`).join('')}</button>`;
/** 의뢰 줄: 제목 ‥ 정가 · 싯가 · −n%, 아래 전장 · 의뢰인 */
function jobRow(j: Job, v: string, small = false) {
  const f = fieldOf(j.field), fi = fieldIntroOf(j.field), on = CT.sel === j || (!!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field), hid = hidden(j);
  const ds = hid ? `발신자 없음 · 보수 ${sealedRangeText()} · 전장은 서명 뒤 공개` : `${esc(f.name)}${fi ? ` · ${esc(clientShort(fi.client))}` : ''}`;
  return row(small ? 'sm' : '', `data-a="ct-job" data-v="${v}" data-f="job:${v}"`, hid ? '봉인 의뢰서' : `「${esc(fi?.title || f.name)}」`, hid ? '싯가' : j.kind === 'sealed' ? `+${pct(j.bonus)}` : j.kind === 'custom' ? `−${pct(-j.bonus)}` : '정가', [ds], on);
}
/** 의뢰 칸: (단골) 늘 하던 대로 + 오늘의 의뢰서 3장 + '메뉴에 없는 의뢰' 한 줄 (누르면 다른 전장 목록) */
function jobCol() {
  const custom = CT.sel?.kind === 'custom' ? CT.sel : null;
  if (CT.list) return `<button class="lp-row bk" data-a="ct-off" data-f="off">‹ 오늘의 의뢰서로</button>${offMenu().map((f) => jobRow(orderOf(f.id), `c:${f.id}`, true)).join('')}`;
  const u = CT.vet ? usual() : null, l = lastDeed();
  const us = u && l ? row('us', 'data-a="ct-usual" data-f="usual"', '늘 하던 대로', u.job.kind === 'custom' ? `−${pct(-u.job.bonus)}` : '정가', [`지난 계약 「${esc(fieldTitle(l.field))}」 · ${esc(u.plan.short)}`], false) : '';
  return `${us}${CT.jobs.map((j, i) => jobRow(j, `d${i}`)).join('')}${custom ? jobRow(custom, `c:${custom.field}`) : ''}
    ${row('', 'data-a="ct-off" data-f="off"', '메뉴에 없는 의뢰', `−${pct(-customWin())}`, [`다른 전장을 직접 주문 · ${offMenu().length}곳`], false)}`;
}
/** 약관 줄: 큰 글자 = 고르는 말(표준 · 성과급 · 담보), 작은 글자 = 세계의 말(부서 · 난이도 · 위험 등급) + 대표 조항 1개 (전문은 전표 · 청사진) */
function planRow(lvl: number) {
  const p = PLAN_BY_LVL[lvl];
  return row('', `data-a="ct-plan" data-v="${lvl}" data-f="plan:${lvl}"`, esc(p.short), mul(CFG.diffWinMul(lvl)), [`${esc(p.dept)} · ${esc(diffName(lvl))} · 위험 ${lvl}`, `제1~${lvl}조 · ${esc(repClause(lvl))}`], CT.plan === lvl);
}
/** 특약 줄: 이름 ‥ 절망 가산, 아래 단계 · 효과. 누를 때마다 단계가 오르고 마지막 다음은 끄기 */
function riderRow(id: OathId, i: number, lit: boolean) {
  const d = OATHS.find((o) => o.id === id)!, n = oathLv({ oaths: oathSel() }, id), max = oathMax(id);
  return row(`sm${lit ? ' lit' : ''}`, `style="--i:${i}" data-a="ct-rider" data-v="${id}" data-f="rider:${id}" title="${esc(n >= max ? '누르면 끄기' : `누르면 ${n + 1}단계`)}"`, esc(d.name), `+${oathHeatOf(id, Math.max(1, n))}`, [`${n ? `${n}단계 · ` : ''}${esc(d.lv(Math.max(1, n)))}`], n > 0);
}
/** 청사진 머리: 작은 궤도 선 그림 (장식은 이것 하나) */
const DRAW = `<svg class="lp-draw" viewBox="0 0 110 60" aria-hidden="true"><ellipse cx="55" cy="30" rx="50" ry="14"/><ellipse cx="55" cy="30" rx="30" ry="26" transform="rotate(-28 55 30)"/><circle cx="55" cy="30" r="4"/><circle cx="100" cy="23" r="2"/><line x1="55" y1="4" x2="55" y2="56" stroke-dasharray="2 3"/></svg>`;
const bh = (t: string, s: string) => `${DRAW}<header class="lp-bh"><b>${t}</b><span>${s}</span></header>`;
/** 청사진 쪽: 가리킨 · 고른 줄의 자세한 내용 */
function infoHtml(): string {
  const [k, ...rest] = CT.focus.split(':'), v = rest.join(':');
  if (k === 'off') return `${bh('메뉴에 없는 의뢰', '다른 전장을 직접 주문')}
      <div class="lp-kv"><span><i>보수</i><b>승리 크레딧 −${pct(-customWin())}</b></span><span><i>고를 수 있는 전장</i><b>${offMenu().length}곳</b></span></div>
      <p class="lp-ip">오늘 들어온 의뢰서에 없는 전장으로 가고 싶으면 따로 주문한다. 의뢰인을 찾아 연결하는 수고만큼 보수가 깎인다.</p>`;
  if (k === 'usual') { const u = usual(); return u ? `${bh('늘 하던 대로', '직전 영수 증서를 그대로')}
      <div class="lp-kv"><span><i>의뢰</i><b>「${esc(fieldTitle(u.job.field))}」</b><small>${u.job.kind === 'custom' ? `오늘 메뉴에 없음 · −${pct(-u.job.bonus)}` : '오늘 메뉴에 있음 · 정가'}</small></span><span><i>약관</i><b>${esc(u.plan.short)}</b><small>${esc(u.plan.dept)} · ${esc(diffName(u.plan.lvl))}</small></span></div>` : ''; }
  if (k === 'job') {
    const j = v.startsWith('c:') ? orderOf(v.slice(2)) : CT.jobs[+v.slice(1)];
    if (!j) return '';
    if (hidden(j)) return `${bh('봉인 의뢰서', '발신자 없음')}
      <div class="lp-kv"><span><i>보수</i><b>싯가</b><small>승리 크레딧 ${esc(sealedRangeText())} · 서명하면 확정</small></span><span><i>전장</i><b>서명 뒤 공개</b></span></div>
      <p class="lp-ip">봉투에 좌표 하나. 서명란은 비어 있다. 전장 · 의뢰인 · 보수는 서명한 뒤에 드러난다.</p>`;
    const f = fieldOf(j.field), fi = fieldIntroOf(j.field);
    return `${bh(`「${esc(fi?.title || f.name)}」`, `${esc(f.name)} · ${esc(f.region)}`)}
      <div class="lp-kv"><span><i>의뢰인</i><b>${esc(fi?.client || '—')}</b></span><span><i>보수</i><b>${esc(priceOf(j))}</b>${fi?.reward ? `<small>${esc(fi.reward)}</small>` : ''}</span></div>
      ${fi?.brief ? `<p class="lp-ip">${esc(fi.brief)}</p>` : ''}${hooks.brief(j.field)}`;
  }
  if (k === 'plan') {
    const p = PLAN_BY_LVL[+v];
    if (!p) return '';
    const hp = CFG.playerHp - (+v >= 7 ? 25 : 0), pv = prevLvl(p.lvl);
    return `${bh(esc(p.short), `${esc(p.code)} ${esc(p.name)} · ${esc(diffName(p.lvl))} (위험 ${p.lvl})`)}
      <div class="lp-kv"><span><i>승리 크레딧</i><b>${mul(CFG.diffWinMul(p.lvl))}</b></span><span><i>함대 체력</i><b class="f-num">${hp}</b></span><span><i>특약</i><b>${oathDiff(p.lvl) ? '붙일 수 있음' : '없음'}</b></span></div>
      <p class="lp-ip">${esc(p.quip)}</p>
      <ol class="lp-cl">${pv ? `<li><b>제1~${pv}조</b> ${esc(PLAN_BY_LVL[pv].name)} 전 조항 승계</li>` : ''}${clausesOf(p.lvl).map((d) => `<li><b>제${d.lvl}조</b> ${esc(d.desc)}</li>`).join('')}</ol>`;
  }
  if (k === 'rider') {
    const d = OATHS.find((o) => o.id === v);
    if (!d) return '';
    const n = oathLv({ oaths: oathSel() }, d.id);
    return `${bh(`${lineIcon(d.icon, 'li')}${esc(d.name)}`, `특약 · 절망 서약${ridersOn() ? '' : ' · 담보 약관에만 붙는다'}`)}
      <p class="lp-ip">${esc(d.quip)}</p>
      <ol class="lp-lv">${Array.from({ length: oathMax(d.id) }, (_, i) => i + 1).map((k2) => `<li class="${k2 === n ? 'on' : ''}"><b>${k2}단계</b><span>${esc(d.lv(k2))}</span><em class="f-num">절망 +${oathHeatOf(d.id, k2)}</em></li>`).join('')}</ol>`;
  }
  return `${bh('의뢰 차림표', `오늘의 의뢰서 ${CT.jobs.length}장`)}
    <p class="lp-ip">줄을 누르면 그 줄이 전표에 찍힙니다. 의뢰와 약관을 고르면 벨을 눌러 전표를 받습니다.</p>`;
}
function aidenSay(): string {
  const j = jobOf(), p = planOf(), [a, b] = sealedRange();
  if (CT.signed && j) {
    if (j.kind === 'sealed') return `봉인을 뜯었습니다. 「${fieldTitle(j.field)}」, 의뢰인은 ${clientShort(fieldIntroOf(j.field)?.client) || '없음'}. 싯가는 ${hal(j.bonus)}할 더 쳐 드리죠.`;
    return '서명 확인했습니다. 명부를 펼치죠.';
  }
  if (CT.signing) return '아래 서명란에 서명하시죠. 만년필은 제 것을 쓰셔도 됩니다.';
  if (CT.say === 'usual' && j) return j.kind === 'custom' ? `늘 하시던 걸로요. 오늘 메뉴에는 없어서 ${hal(j.bonus)}할 덜 쳐 드립니다.` : '늘 하시던 걸로요. 마침 오늘 메뉴에 있습니다.';
  if (payable()) return '다 고르셨으면 벨을 누르시죠. 전표는 바로 올려 드립니다.';
  if (j && hidden(j)) return `싯가는 보통 ${hal(a)}~${hal(b)}할 더 쳐 드립니다. 계산은 서명으로 받죠.`;
  if (CT.list) return `메뉴에 없는 것도 됩니다. 대신 ${hal(customWin())}할 덜 쳐 드리죠.`;
  if (p && ridersOn()) return '담보 약관이요. 특약 칸에 불이 들어왔습니다.';
  return '오늘 들어온 의뢰서입니다. 싯가는 서명하셔야 알려 드리죠.';
}
/** 늘 하던 대로: 직전 계약의 전장 · 약관 (전장이 오늘 메뉴에 없으면 메뉴에 없는 의뢰로) */
function usual() {
  const l = lastDeed(), plan = l ? PLAN_BY_LVL[l.plan] : null;
  if (!l || !plan || !FIELDS.some((f) => f.id === l.field)) return null;
  return { job: orderOf(l.field), plan };
}
/** 지휘관 서명 (만년필 한글 필기) */
const SIG = '레이첼';

/** 탁상 벨 (금 선 그림 두 겹) */
const BELL = (() => { const d = '<path d="M45 13v7"/><circle cx="45" cy="9" r="4"/><path d="M14 56C14 36 28 22 45 22s31 14 31 34"/><path d="M8 56h74"/><path d="M12 57c0 7 10 12 33 12s33-5 33-12"/>'; return `<svg viewBox="0 0 90 80" aria-hidden="true"><g class="lp-lo">${d}</g><g class="lp-hi">${d}</g></svg>`; })();
/** 표지 장식 (금 선 그림 두 겹): 모서리 스와시 · 가운데 마름모 괘선 · 별자리 */
const gold = (d: string, vb: string, cls: string) => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true"><g class="lp-lo">${d}</g><g class="lp-hi">${d}</g></svg>`;
const SWASH = "<path d='M6 50C6 22 20 8 50 6'/><path d='M12 46C12 26 24 14 46 12'/><path d='M14 30c0-7 9-7 9 0 0 5-7 5-7 0'/><path d='M30 14c-7 0-7 9 0 9 5 0 5-7 0-7'/>";
const CORNERS = ['tl', 'tr', 'bl', 'br'].map((k) => gold(SWASH, '0 0 56 56', `ct-co ${k}`)).join('');
const FLEURON = gold("<path d='M4 8H40M64 8H100'/><path d='M52 1 59 8 52 15 45 8Z'/><circle cx='42' cy='8' r='1.4'/><circle cx='62' cy='8' r='1.4'/>", '0 0 104 16', 'ct-fl');
const CONST = `<svg class="ct-const" viewBox="0 0 120 44" aria-hidden="true"><polyline points="14,30 34,13 54,24 76,9 100,20"/><circle cx="14" cy="30" r="1.6"/><circle cx="34" cy="13" r="1.2"/><circle cx="54" cy="24" r="1.9"/><circle cx="76" cy="9" r="1.1"/><circle cx="100" cy="20" r="1.5"/><circle cx="110" cy="34" r=".9"/></svg>`;
/** 표지: 네이비 바탕 + 금 액자 · 동판 필기체 'Errantes' 를 90도 돌려 세운 간판 (정보는 속지 · 전표에) */
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
/** 전표 아래 서명란 (벨을 누른 뒤에만 보인다): 서명 · 도장 · [돌아가기] [만년필로 서명] */
function sigboxHtml() {
  const j = jobOf();
  const stamp = CT.signed && j && j.kind !== 'open' ? `<span class="lp-stamp">${j.kind === 'sealed' ? `싯가 +${pct(j.bonus)}` : `메뉴 외 −${pct(-j.bonus)}`}</span>` : '';
  return `<div class="ct-sigbox">
    <div class="ct-sigline"><span class="k">지휘관 서명</span>${CT.signed ? `<i class="lp-sig">${SIG}</i>` : ''}${stamp}</div>
    <div class="ct-sigact">${CT.signed ? '<span class="ct-r m">서명 완료 · 명부를 펼치는 중</span>' : `<button class="lp-btn ink" data-a="ct-back-board">돌아가기</button><button class="lp-btn pri" data-a="ct-sign">만년필로 서명</button>`}</div>
  </div>`;
}
function boardHtml() {
  const ok = payable(), heat = heatNow(), lit = CT.lit, nn = newCount();
  CT.lit = false;
  const leave = CT.from === 'bar' ? '바로 돌아가기' : '타이틀로';
  return `<main class="ct${CT.signing ? ' signing' : ''}" aria-label="출격 계약 — 의뢰 차림표">
    <div class="ct-bg" style="background-image:url('${bgURL('erantes_bar')}')" aria-hidden="true"></div><div class="ct-vig" aria-hidden="true"></div><div class="lp-grain" aria-hidden="true"></div>
    <button class="ct-leave lp-btn" data-a="ct-leave">‹ ${leave}</button>
    <figure class="ct-aiden" aria-hidden="true">${standURL('aiden') ? `<img alt="" src="${standURL('aiden')}" style="${figStyle('aiden')}" decoding="async">` : ''}</figure>
    <p class="ct-say lp-paper" aria-live="polite"><b>에이든</b><span>${esc(aidenSay())}</span></p>
    <div class="ct-fold">
      ${coverHtml()}
      <section class="ct-page lp-paper lp-frame" aria-label="의뢰 차림표">
        <div class="lp-cols${CT.list ? ' listing' : ''}">
          <div class="lp-col ct-col-job" role="group" aria-label="의뢰"><h2 class="lp-h2">의뢰 <small>${CT.list ? '메뉴에 없는 것' : '1건'}</small></h2><div class="lp-list">${jobCol()}</div></div>
          <div class="lp-col ct-col-plan" role="group" aria-label="약관"><h2 class="lp-h2">약관 <small>난이도</small></h2><div class="lp-list">${PLANS.map((p) => planRow(p.lvl)).join('')}</div></div>
          <div class="lp-col ct-col-rider${ridersOn() ? '' : ' off'}" role="group" aria-label="특약"><h2 class="lp-h2">특약 <small>${ridersOn() ? `절망 ${heat}` : '담보 전용'}</small></h2><div class="lp-list">${ridersOn() ? OATHS.map((o, i) => riderRow(o.id, i, lit)).join('') : ''}</div></div>
        </div>
      </section>
      <section class="ct-leaf lp-bp" aria-live="polite">${infoHtml()}</section>
    </div>
    <button class="ct-bell" data-a="ct-bell" aria-label="벨을 눌러 전표 받기"${ok ? '' : ' aria-disabled="true"'}>${BELL}</button>
    <section class="ct-slipwrap${nn ? ' ct-feed' : ''}" style="--n:${nn}" aria-label="의뢰 전표">
      <div class="ct-roll"><div class="ct-slip lp-carbon">${slipHtml()}${sigboxHtml()}</div></div>
      <div class="ct-slot lp-band" aria-hidden="true"><i></i></div>
    </section>
    ${hooks.foe()}
  </main>`;
}
/** 체인 고리: 같은 모양을 짙은 면(아래) + 밝은 면(위, 0.4 위로)으로 두 번 (금에 새긴 것처럼) */
const CHAIN_DEFS = `<svg class="ct-defs" width="0" height="0" aria-hidden="true"><defs><pattern id="ct-chain" width="18" height="30" patternUnits="userSpaceOnUse">
  <ellipse class="ct-au-lo" cx="9" cy="8" rx="5.5" ry="7.6"/><ellipse class="ct-au-hi" cx="9" cy="7.6" rx="4.6" ry="6.6"/><rect class="ct-au-lo" x="7.4" y="15" width="3.2" height="15" rx="1.6"/><rect class="ct-au-hi" x="7.8" y="14.6" width="2.4" height="14.6" rx="1.2"/></pattern></defs></svg>`;
function sealHtml() {
  const ch = [[0.12, 0.42], [0.25, 0.56], [0.75, 0.5], [0.88, 0.38]];
  return `<main class="ct ct-seal${CT.vet ? ' quick' : ''}" data-a="ct-skip" aria-label="그늘 — 누르면 넘깁니다">
    <div class="ct-bg" style="background-image:url('${bgURL('erantes_bar')}')" aria-hidden="true"></div><div class="ct-dark" aria-hidden="true"></div><div class="lp-grain" aria-hidden="true"></div>
    <div class="ct-fly lp-carbon" aria-hidden="true">${slipHtml()}<div class="ct-sigline"><i class="lp-sig">${SIG}</i></div></div>
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
/** data-a="ct-*" 처리. 다시 그려야 하면 true */
export function contractAct(a: string, v: string): boolean {
  if (CT.signing && !['ct-sign', 'ct-back-board', 'ct-leave', 'ct-skip'].includes(a)) return false; // 전표가 올라와 있는 동안 차림표는 내려가 있다
  switch (a) {
    case 'ct-job': {
      const j = v.startsWith('c:') ? (FIELDS.some((f) => f.id === v.slice(2)) ? orderOf(v.slice(2)) : null) : CT.jobs[+v.slice(1)];
      if (!j) return false;
      const same = !!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field;
      CT.sel = same ? null : j; CT.focus = `job:${v}`; CT.say = '';
      if (v.startsWith('c:')) CT.list = false; // 메뉴에 없는 의뢰를 고르면 목록을 접고 그 줄을 의뢰 칸에 남긴다
      if (CT.sel) printed('job'); else CT.last = '';
      return true;
    }
    case 'ct-off': CT.list = !CT.list; CT.focus = 'off'; CT.say = ''; CT.last = ''; return true;
    case 'ct-usual': {
      const u = usual();
      if (!u) return false;
      CT.lit = !ridersOn() && oathDiff(u.plan.lvl);
      CT.sel = u.job; CT.plan = u.plan.lvl; CT.list = false; CT.focus = 'usual'; CT.say = 'usual';
      printed('job');
      return true;
    }
    case 'ct-plan': {
      if (!PLAN_BY_LVL[+v]) return false;
      CT.lit = !ridersOn() && oathDiff(+v); // 담보 약관을 켜는 순간 특약 칸에 불이 들어온다
      CT.plan = +v; CT.focus = `plan:${v}`; CT.say = '';
      printed('plan');
      return true;
    }
    case 'ct-rider': {
      const d = OATHS.find((o) => o.id === v);
      if (!d) return false;
      CT.focus = `rider:${v}`;
      if (!ridersOn()) return false; // 담보 약관이 아니면 특약 칸이 비어 있다
      const s = oathSel(), n = oathLv({ oaths: s }, d.id);
      s[d.id] = n >= oathMax(d.id) ? 0 : n + 1;
      metaOath(s);
      CT.say = '';
      if (s[d.id]) printed(`rider:${d.id}`); else CT.last = '';
      return true;
    }
    case 'ct-bell': { // 벨: 차림표 · 청사진이 카운터 아래로 내려가고 전표가 가운데로 올라온다 (다시 그리지 않고 클래스만 — 그래야 미끄러진다)
      if (!payable()) { hooks.toast('의뢰와 약관을 먼저 고르세요.'); return false; }
      const ct = document.querySelector<HTMLElement>('main.ct');
      ct?.querySelector('.ct-bell')?.classList.add('ring');
      sfx('bell');
      clear();
      later(reduced() ? 0 : 380, () => { CT.signing = true; CT.say = ''; CT.last = ''; ct?.classList.add('signing'); setSay(ct); sfx('paper'); });
      return false;
    }
    case 'ct-back-board': { // 서명 전에 돌아가기: 전표가 내려가고 차림표가 올라온다
      if (CT.signed) return false;
      CT.signing = false;
      const ct = document.querySelector<HTMLElement>('main.ct');
      ct?.classList.remove('signing'); setSay(ct);
      return false;
    }
    case 'ct-sign': { // 서명: 봉인 의뢰서가 열리고 (전표 의뢰 줄이 다시 찍힌다) 서명이 마르면 그늘로
      if (!payable() || !CT.signing || CT.signed) return false;
      CT.signed = true; CT.last = jobOf()?.kind === 'sealed' ? 'job' : ''; sfx('paper');
      if (CT.last) sfx('print', { delay: 0.3 });
      clear();
      later(reduced() ? 600 : jobOf()?.kind === 'sealed' ? 2100 : 1500, () => { if (CT.signed) { CT.step = 'seal'; CT.signing = false; hooks.render(); } });
      return true;
    }
    case 'ct-skip': finish(); return false;
    case 'ct-leave': clear(); hooks.leave(CT.from); return false;
  }
  return false;
}
/** 에이든의 말풍선만 바꾼다 (벨 · 돌아가기: 다시 그리지 않는다) */
function setSay(ct: HTMLElement | null) {
  const el = ct?.querySelector('.ct-say > span');
  if (el) el.textContent = aidenSay();
}
/** 청사진 쪽만 바꾼다 (가리키기 · 막힌 특약 누르기) */
function refreshInfo() {
  const el = document.querySelector<HTMLElement>('.ct-leaf');
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

/** 그린 뒤 (main.ts render): 차림표 가리키기 → 청사진 쪽 · 전표의 새 줄 보이기 · 그늘 연출 시간표 */
export function contractMount(root: HTMLElement) {
  const ct = root.querySelector<HTMLElement>('main.ct');
  if (!ct) return;
  if (CT.step === 'board') {
    const fold = ct.querySelector<HTMLElement>('.ct-fold');
    const point = (e: Event) => {
      const f = (e.target as HTMLElement).closest<HTMLElement>('[data-f]')?.dataset.f;
      if (f && f !== CT.focus) { CT.focus = f; refreshInfo(); }
    };
    fold?.addEventListener('mouseover', point);
    fold?.addEventListener('focusin', point);
    if (CT.last && !CT.signed) { ct.querySelector('.ct-slip .ct-r.new')?.scrollIntoView?.({ block: 'nearest' }); later(1200, () => { CT.last = ''; }); } // 밀려 나온 뒤에는 다시 그려도 가만히
    return;
  }
  if (CT.step !== 'seal') return;
  clear();
  if (reduced()) { later(900, finish); return; }
  // 처음: 0 종이가 날아가고 바가 어둠에 잠긴다 → 0.6 체인이 내려온다 → 3.0 그늘이 눈높이에 멈춘다 (심장 박동) → 4.5 반동 뒤 끌려 올라간다 → 5.5 명부
  // 두 번째부터 (CSS .quick): 같은 순서를 2.4초로 압축 — 의식은 처음에만 길다
  const t = CT.vet ? [200, 1300, 1700, 2400] : [600, 3000, 4500, 5500];
  sfx('paper');
  later(t[0], () => sfx('chain'));
  later(t[1], () => { ct.classList.add('beat'); sfx('heart'); sfx('despair'); });
  later(t[2], () => { ct.classList.add('lift'); sfx('chain'); });
  later(t[3], finish);
}
