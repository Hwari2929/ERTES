// 출격 계약: 에란테스 바 카운터. 의뢰 차림표의 놋쇠 단추로 의뢰 · 약관 · 특약을 고르면 전표 인쇄기가 한 줄씩 찍고,
// 벨 줄을 당기면 계산서 → 만년필 서명 → 영수 증서 (찢으면 차림표로) → 증서가 날아가고 금 체인과 그늘(회중시계)이 내려왔다 올라가며 → 계약 기물 명부 (main.ts newRunScreen).
// 의뢰 = 전장 (의뢰 제목 · 의뢰인 = data/scenes/fields.ts) · 약관 = 난이도 (data/contract.ts PLANS, 조항 = data/difficulty.ts DIFFS) · 특약 = 절망 서약 (data/oaths.ts, 담보 약관에만).
// 단골 경로: 두 번째 계약부터 '늘 하던 대로'(직전 전장 · 약관) · 서명하면 바로 증서 · 그늘 연출 압축 (의식은 처음에만 길다). 전표 번호는 서명하고 출격한 수 (ui/meta.ts deeds).
// 이름 · 수치는 그릴 때마다 데이터 · 설정에서 읽는다. 재료: 만지는 것(차림표 나무 · 놋쇠 단추 · 종이 · 체인 · 가죽 탭)은 바 물성 토큰, 읽는 것(정보 판)은 홀로 판 (style.css 바 물성 키트).
import { CFG } from '../config';
import { FIELDS, fieldOf } from '../data/battlefields';
import { customWin, PLAN_BY_LVL, PLANS, rollSealed, sealedRange } from '../data/contract';
import { DIFFS, diffAddRule, diffName, effDiffLabel } from '../data/difficulty';
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

type Step = 'board' | 'review' | 'seal';
/** 의뢰서: open = 정가 · sealed = 싯가 의뢰 (서명 뒤에 전장 · 의뢰인 · 보수 가산이 드러난다) · custom = 메뉴에 없는 의뢰 (직접 주문). bonus = 승리 크레딧 가감 */
type Kind = 'open' | 'sealed' | 'custom';
interface Job { field: string; kind: Kind; bonus: number }
/** 에이든의 한마디 (상태에 따라) */
type Say = '' | 'tear' | 'tearSealed' | 'usual';
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
  /** 두 번째 계약부터 (서명하고 출격한 적이 있음): 계산서 설명 생략 · 서명하면 바로 증서 · 그늘 연출 압축 */
  vet: false,
  /** 담보 약관을 막 골라 특약 칸에 불이 들어오는 중 (그릴 때 한 번) */
  lit: false,
  /** 약관 = 위험 등급 (이번 방문 동안 기억) */
  plan: PLANS[0].lvl,
  /** 정보 판이 보여 주는 줄: 'job:0' · 'plan:3' · 'rider:grit' · '' */
  focus: '',
  /** 방금 전표에 찍힌 묶음: 'job' · 'plan' · 'rider:id' */
  last: '',
  check: false,
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
const sealedText = () => `승리 크레딧 ${sealedRangeText()}`;
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
  Object.assign(CT, { step: 'board', from, sel: null, list, vet: n > 0, lit: false, focus: '', last: '', check: false, signed: false, say: '', fromSeal: false });
  CT.no = n + 1;
  const d = new Date();
  CT.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ids = shuffle(FIELDS.map((f) => f.id));
  CT.jobs = [{ field: ids[0], kind: 'open', bonus: 0 }, { field: ids[1], kind: 'open', bonus: 0 }, newSealed(ids.slice(0, 2))];
}
/** 명부에서 '뒤로': 차림표로 (고른 것은 그대로, 서명은 무른다) */
export function contractBack() { clear(); Object.assign(CT, { step: 'board', check: false, signed: false, say: '', last: '', fromSeal: false }); }
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

// ───────── 전표 (인쇄기 · 계산서 · 영수 증서 · 날아가는 종이가 같은 줄을 쓴다)
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
    out.push({ l: '', k: 'div' }, { l: '승리 크레딧', r: winText(), k: 'tot' }, { l: '표기 위험', r: effDiffLabel(p.lvl, heatNow()), k: 'b' }, { l: '결제', r: CT.signed ? '서명 완료' : '서명 대기', k: 'm' });
  }
  return out;
}
const rowHtml = (x: Row) => x.k === 'div' ? '<i class="ct-r div" aria-hidden="true"></i>'
  : `<div class="ct-r ${x.k || ''}${x.g && x.g === CT.last ? ' new' : ''}"><span${x.k === 'h' ? ' class="ct-ribbon"' : ''}>${esc(x.l)}</span>${x.r ? `<span class="f-num">${esc(x.r)}</span>` : ''}</div>`;
const slipHtml = () => rows().map(rowHtml).join('');

// ───────── 차림표
/** 놋쇠 단추: 누르면 안쪽 전구에 불이 들어온다 (big = 의뢰 단추) */
const knob = (on: boolean, big = false) => `<span class="ct-knob${on ? ' on' : ''}${big ? ' big' : ''}" aria-hidden="true"><i></i></span>`;
const clientShort = (c?: string) => (c || '').replace(/\s*\(.*\)$/, '');
/** 의뢰 줄 (주 메뉴): 제목은 두 줄까지, 부제(전장 · 의뢰인)는 한 줄 */
function jobRow(j: Job, v: string, big = true) {
  const f = fieldOf(j.field), fi = fieldIntroOf(j.field), on = CT.sel === j || (!!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field), hid = hidden(j);
  const sub = hid ? `발신자 없음 · 보수 ${sealedRangeText()} · 전장은 서명 뒤 공개` : `<span class="ct-fi" style="--c:${f.color}">${f.icon}</span>${esc(f.name)}${fi ? ` · ${esc(clientShort(fi.client))}` : ''}`;
  return `<button class="ct-row ct-jobrow${on ? ' on' : ''} k-${j.kind}${big ? '' : ' small'}" data-a="ct-job" data-v="${v}" data-f="job:${v}" aria-pressed="${on}">
    ${knob(on, big)}<span class="ct-rb"><span class="ct-rt"><b class="ct-nm">${hid ? '봉인 의뢰서' : `「${esc(fi?.title || f.name)}」`}</b><i class="ct-dots" aria-hidden="true"></i><em class="ct-pr">${hid ? '싯가' : j.kind === 'sealed' ? `+${pct(j.bonus)}` : j.kind === 'custom' ? `−${pct(-j.bonus)}` : '정가'}</em></span>
    <small class="ct-sub">${sub}</small></span></button>`;
}
/** 의뢰 칸: 오늘의 의뢰서 3장 + '메뉴에 없는 의뢰' 한 줄 (누르면 다른 전장 목록) */
function jobCol() {
  const custom = CT.sel?.kind === 'custom' ? CT.sel : null;
  if (CT.list) return `<button class="ct-row ct-back" data-a="ct-off">‹ 오늘의 의뢰서로</button>${offMenu().map((f) => jobRow(orderOf(f.id), `c:${f.id}`, false)).join('')}`;
  return `${CT.jobs.map((j, i) => jobRow(j, `d${i}`)).join('')}
    ${custom ? jobRow(custom, `c:${custom.field}`) : ''}
    <button class="ct-row ct-offrow" data-a="ct-off" data-f="off"><span class="ct-rb"><span class="ct-rt"><b class="ct-nm">메뉴에 없는 의뢰</b><i class="ct-dots" aria-hidden="true"></i><em class="ct-pr">−${pct(-customWin())}</em></span><small class="ct-sub">다른 전장을 직접 주문 · ${offMenu().length}곳</small></span></button>`;
}
/** 약관 줄: 큰 글자 = 고르는 말(표준 · 성과급 · 담보), 작은 글자 = 세계의 말(부서 · 난이도 · 위험 등급) + 조항 수 · 대표 조항 1개 (전문은 전표 · 정보 판) */
function planRow(lvl: number) {
  const p = PLAN_BY_LVL[lvl], on = CT.plan === lvl;
  return `<button class="ct-row ct-planrow${on ? ' on' : ''}" data-a="ct-plan" data-v="${lvl}" data-f="plan:${lvl}" aria-pressed="${on}">
    ${knob(on)}<span class="ct-rb"><span class="ct-rt"><b class="ct-nm">${esc(p.short)}</b><i class="ct-dots" aria-hidden="true"></i><em class="ct-pr">${mul(CFG.diffWinMul(lvl))}</em></span>
    <small class="ct-sub">${esc(p.dept)} · ${esc(diffName(lvl))} · 위험 ${lvl}</small><small class="ct-sub ct-rep">제1~${lvl}조 · ${esc(repClause(lvl))}</small></span></button>`;
}
/** 특약 줄 (토핑): 장식 없이 글자만, 켠 특약은 붉게. 누를 때마다 단계가 오르고 마지막 다음은 끄기 */
function riderRow(id: OathId, i: number, lit: boolean) {
  const d = OATHS.find((o) => o.id === id)!, n = oathLv({ oaths: oathSel() }, id), max = oathMax(id);
  return `<button class="ct-row ct-riderrow${n ? ' on' : ''}${lit ? ' lit' : ''}" style="--i:${i}" data-a="ct-rider" data-v="${id}" data-f="rider:${id}" aria-pressed="${n > 0}" title="${esc(n >= max ? '누르면 끄기' : `누르면 ${n + 1}단계`)}">
    <span class="ct-rb"><span class="ct-rt"><b class="ct-nm">${esc(d.name)}</b><i class="ct-dots" aria-hidden="true"></i><em class="ct-pr">${n ? `${n}단계 · ` : ''}+${oathHeatOf(id, Math.max(1, n))}</em></span>
    <small class="ct-sub">${esc(d.lv(Math.max(1, n)))}</small></span></button>`;
}
/** 정보 판 (홀로): 가리킨 · 고른 줄의 자세한 내용 */
function infoHtml(): string {
  const [k, ...rest] = CT.focus.split(':'), v = rest.join(':');
  if (k === 'off') return `<header class="ct-ih"><b>메뉴에 없는 의뢰</b><span>다른 전장을 직접 주문</span></header>
      <div class="ct-kv"><span><i>보수</i><b>승리 크레딧 −${pct(-customWin())}</b></span><span><i>고를 수 있는 전장</i><b>${offMenu().length}곳</b></span></div>
      <p class="ct-ip">오늘 들어온 의뢰서에 없는 전장으로 가고 싶으면 따로 주문한다. 의뢰인을 찾아 연결하는 수고만큼 보수가 깎인다.</p>`;
  if (k === 'usual') { const u = usual(); return u ? `<header class="ct-ih"><b>늘 하던 대로</b><span>직전 영수 증서를 그대로</span></header>
      <div class="ct-kv"><span><i>의뢰</i><b>「${esc(fieldTitle(u.job.field))}」</b><small>${u.job.kind === 'custom' ? `오늘 메뉴에 없음 · −${pct(-u.job.bonus)}` : '오늘 메뉴에 있음 · 정가'}</small></span><span><i>약관</i><b>${esc(u.plan.short)}</b><small>${esc(u.plan.dept)} · ${esc(diffName(u.plan.lvl))}</small></span></div>` : ''; }
  if (k === 'job') {
    const j = v.startsWith('c:') ? orderOf(v.slice(2)) : CT.jobs[+v.slice(1)];
    if (!j) return '';
    if (hidden(j)) return `<header class="ct-ih"><b>봉인 의뢰서</b><span>발신자 없음</span></header>
      <div class="ct-kv"><span><i>보수</i><b>싯가</b><small>${esc(sealedText())} · 서명하면 확정</small></span><span><i>전장</i><b>서명 뒤 공개</b></span></div>
      <p class="ct-ip">봉투에 좌표 하나. 서명란은 비어 있다. 전장 · 의뢰인 · 보수는 계산서에 서명한 뒤에 드러난다.</p>`;
    const f = fieldOf(j.field), fi = fieldIntroOf(j.field);
    return `<header class="ct-ih"><b>「${esc(fi?.title || f.name)}」</b><span><span class="ct-fi" style="--c:${f.color}">${f.icon}</span>${esc(f.name)} · ${esc(f.region)}</span></header>
      <div class="ct-kv"><span><i>의뢰인</i><b>${esc(fi?.client || '—')}</b></span><span><i>보수</i><b>${esc(priceOf(j))}</b>${fi?.reward ? `<small>${esc(fi.reward)}</small>` : ''}</span></div>
      ${fi?.brief ? `<p class="ct-ip">${esc(fi.brief)}</p>` : ''}${hooks.brief(j.field)}`;
  }
  if (k === 'plan') {
    const p = PLAN_BY_LVL[+v];
    if (!p) return '';
    const hp = CFG.playerHp - (+v >= 7 ? 25 : 0), pv = prevLvl(p.lvl);
    return `<header class="ct-ih"><b>${esc(p.short)}</b><span>${esc(p.code)} ${esc(p.name)} · ${esc(diffName(p.lvl))} (위험 ${p.lvl})</span></header>
      <div class="ct-kv"><span><i>승리 크레딧</i><b>${mul(CFG.diffWinMul(p.lvl))}</b></span><span><i>함대 체력</i><b class="f-num">${hp}</b></span><span><i>특약</i><b>${oathDiff(p.lvl) ? '붙일 수 있음' : '없음'}</b></span></div>
      <p class="ct-ip">${esc(p.quip)}</p>
      <ol class="ct-cl">${pv ? `<li><b>제1~${pv}조</b> ${esc(PLAN_BY_LVL[pv].name)} 전 조항 승계</li>` : ''}${clausesOf(p.lvl).map((d) => `<li><b>제${d.lvl}조</b> ${esc(d.desc)}</li>`).join('')}</ol>`;
  }
  if (k === 'rider') {
    const d = OATHS.find((o) => o.id === v);
    if (!d) return '';
    const n = oathLv({ oaths: oathSel() }, d.id);
    return `<header class="ct-ih"><b>${lineIcon(d.icon, 'li')}${esc(d.name)}</b><span>특약 · 절망 서약${ridersOn() ? '' : ' · 담보 약관에만 붙는다'}</span></header>
      <p class="ct-ip">${esc(d.quip)}</p>
      <ol class="ct-lv">${Array.from({ length: oathMax(d.id) }, (_, i) => i + 1).map((k2) => `<li class="${k2 === n ? 'on' : ''}"><b>${k2}단계</b><span>${esc(d.lv(k2))}</span><em class="f-num">절망 +${oathHeatOf(d.id, k2)}</em></li>`).join('')}</ol>`;
  }
  return `<header class="ct-ih"><b>의뢰 차림표</b><span>오늘의 의뢰서 ${CT.jobs.length}장</span></header>
    <p class="ct-ip">놋쇠 단추를 누르면 그 줄이 전표에 찍힙니다. 의뢰와 약관을 고르면 벨 줄을 당겨 계산서를 받습니다.</p>`;
}
function aidenSay(): string {
  const j = jobOf(), p = planOf(), [a, b] = sealedRange();
  if (CT.say === 'tearSealed') return '찢으셨군요. 봉인 의뢰서는 새 걸로 드리죠. 같은 봉투는 2번 오지 않습니다.';
  if (CT.say === 'tear') return '찢으셨군요. 의뢰서는 또 들어옵니다. 천천히 고르시죠.';
  if (CT.say === 'usual' && j) return j.kind === 'custom' ? `늘 하시던 걸로요. 오늘 메뉴에는 없어서 ${hal(j.bonus)}할 덜 쳐 드립니다.` : '늘 하시던 걸로요. 마침 오늘 메뉴에 있습니다.';
  if (payable()) return '다 고르셨으면 벨 줄을 당기시죠. 계산서는 바로 나옵니다.';
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
function boardHtml() {
  const ok = payable(), heat = heatNow();
  const leave = CT.from === 'bar' ? '바로 돌아가기' : '타이틀로', u = CT.vet ? usual() : null, lit = CT.lit;
  CT.lit = false;
  return `<main class="ct ct-board-step" aria-label="출격 계약 — 의뢰 차림표">
    <div class="ct-bg" style="background-image:url('${bgURL('erantes_bar')}')" aria-hidden="true"></div><div class="mk-light" aria-hidden="true"></div><div class="mk-grain" aria-hidden="true"></div>
    <button class="ct-leave mk-tab" data-a="ct-leave">‹ ${leave}</button>
    <figure class="ct-aiden" aria-hidden="true">${standURL('aiden') ? `<img alt="" src="${standURL('aiden')}" style="${figStyle('aiden')}" decoding="async">` : ''}</figure>
    <p class="ct-say mk-lacquer" aria-live="polite"><b>에이든</b><span>${esc(aidenSay())}</span></p>
    <section class="ct-board mk-lacquer mk-frame" aria-label="의뢰 차림표">
      <h1 class="ct-sign"><span class="ct-ribbon mk-gold">의뢰 차림표</span></h1>
      ${u ? `<button class="ct-usual mk-brass" data-a="ct-usual" data-f="usual"><span>늘 하던 대로</span><small>「${esc(fieldTitle(u.job.field))}」 · ${esc(u.plan.short)}${u.job.kind === 'custom' ? ` · −${pct(-u.job.bonus)}` : ''}</small></button>` : ''}
      <div class="ct-cols${CT.list ? ' listing' : ''}">
        <div class="ct-col ct-col-job" role="group" aria-label="의뢰"><h2>의뢰 <small>${CT.list ? '메뉴에 없는 것' : '1건'}</small></h2><div class="ct-list">${jobCol()}</div></div>
        <div class="ct-col ct-col-plan" role="group" aria-label="약관"><h2>약관 <small>난이도</small></h2><div class="ct-list">${PLANS.map((p) => planRow(p.lvl)).join('')}</div></div>
        <div class="ct-col ct-col-rider${ridersOn() ? '' : ' off'}" role="group" aria-label="특약"><h2>특약 <small>${ridersOn() ? `절망 서약 · 절망 ${heat}` : '담보 약관 전용'}</small></h2><div class="ct-list">${ridersOn() ? OATHS.map((o, i) => riderRow(o.id, i, lit)).join('') : ''}</div></div>
      </div>
    </section>
    <section class="ct-info mk-holo" aria-live="polite">${infoHtml()}</section>
    <div class="ct-bell${ok ? ' ready' : ''}">
      <svg class="ct-bell-ic" viewBox="0 0 30 40" aria-hidden="true"><path class="mk-br-lo" d="M15 3 C6 9 7 22 3 31 H27 C23 22 24 9 15 3 Z"/><path class="mk-br-hi" d="M15 3 C6 9 7 22 3 31 H27 C23 22 24 9 15 3 Z"/><circle class="mk-br-fill" cx="15" cy="35" r="3.5"/></svg>
      <button class="ct-rope" data-a="ct-bell" aria-label="벨 줄을 당겨 계산서 받기"${ok ? '' : ' aria-disabled="true"'}><svg viewBox="0 0 30 260" preserveAspectRatio="none" aria-hidden="true"><path class="ct-cord"/></svg><span class="ct-handle"></span><span class="ct-rope-tx">벨 줄 당기기</span></button>
    </div>
    <section class="ct-printer" aria-label="의뢰 전표">
      <div class="ct-roll"><div class="ct-slip mk-paper">${slipHtml()}</div></div>
      <div class="ct-slot mk-lacquer" aria-hidden="true"><i></i></div>
      <div class="ct-sum">
        <span class="ct-chip mk-brass"><i>승리 크레딧</i><b class="f-num">${ok ? winText() : '—'}</b></span>
        <span class="ct-chip mk-brass"><i>표기 위험</i><b class="f-num">${planOf() ? effDiffLabel(CT.plan, heat) : '—'}</b></span>
      </div>
    </section>
    ${CT.check ? checkHtml() : ''}
    ${hooks.foe()}
  </main>`;
}
/** 계산서: 합계 · 서명란. 서명하면 봉인 의뢰서가 열린다 */
function checkHtml() {
  const j = jobOf(), p = planOf();
  if (!j || !p) return '';
  const f = fieldOf(j.field), fi = fieldIntroOf(j.field), hid = hidden(j), on = ridersOn() ? oathsOn(oathSel()) : [];
  return `<div class="ct-check-bg" data-a="ct-check-close" aria-hidden="true"></div>
  <section class="ct-check mk-paper mk-frame" role="dialog" aria-label="계산서">
    <header><b class="ct-ribbon">계산서</b><span class="f-num">No.${pad(CT.no, 4)} · ${esc(CT.time)}</span></header>
    <dl class="ct-cs">
      <dt>의뢰</dt><dd class="${CT.signed && j.kind === 'sealed' ? 'reveal' : ''}">${hid ? '봉인 의뢰서 · 발신자 없음' : `「${esc(fi?.title || f.name)}」 · ${esc(f.name)}`}</dd>
      <dt>약관</dt><dd>${esc(p.code)} ${esc(p.name)}</dd>
      ${on.length ? `<dt>특약</dt><dd>${on.length}건 · 절망 ${heatNow()}</dd>` : ''}
      <dt>승리 크레딧</dt><dd class="f-num${CT.signed && j.kind === 'sealed' ? ' reveal' : ''}">${winText()}${j.kind === 'sealed' && !hid ? ` <em class="ct-stamp">싯가 +${pct(j.bonus)}</em>` : j.kind === 'custom' ? ` <em class="ct-stamp">메뉴 외 −${pct(-j.bonus)}</em>` : ''}</dd>
      <dt>표기 위험</dt><dd>${esc(effDiffLabel(p.lvl, heatNow()))}</dd>
      ${CT.vet ? '<dt>결제</dt><dd>서명</dd>' : ''}
    </dl>
    ${CT.vet ? '' : '<p class="ct-cp">이 의뢰는 크레딧이 아니라 서명으로 치른다. 서명하면 전표의 약관과 특약이 효력을 갖는다.</p>'}
    <div class="ct-sigline"><span>지휘관 서명</span>${CT.signed ? `<i class="ct-sig">${SIG}</i>` : ''}</div>
    <div class="ct-check-act"><button class="btn ghost" data-a="ct-check-close">돌아가기</button>${CT.signed ? '<button class="btn primary" data-a="ct-take">증서 받기</button>' : `<button class="btn primary" data-a="ct-sign">${CT.vet ? '서명하고 증서 받기' : '만년필로 서명'}</button>`}</div>
  </section>`;
}
function reviewHtml() {
  return `<main class="ct ct-review" aria-label="영수 증서">
    <div class="ct-bg" style="background-image:url('${bgURL('erantes_bar')}')" aria-hidden="true"></div><div class="mk-light" aria-hidden="true"></div><div class="mk-grain" aria-hidden="true"></div>
    <div class="ct-deed-wrap"><div class="ct-deed mk-paper mk-frame">${slipHtml()}<div class="ct-deed-sig"><span>서명</span><i class="ct-sig">${SIG}</i></div></div></div>
    <aside class="ct-deed-side mk-lacquer">
      <h1>영수 증서 <span class="f-num">제${pad(CT.no, 4)}호</span></h1>
      <p>불을 켠 줄이 모두 여기 찍혔다. 계약은 이 한 장이 전부다.</p>
      <button class="btn primary" data-a="ct-seal">증서를 놓아 보낸다</button>
      <button class="btn ghost ct-tear-btn" data-a="ct-tear">증서를 찢는다 <small>차림표로</small></button>
    </aside>
  </main>`;
}
/** 체인 고리: 같은 모양을 짙고 굵은 획(아래) + 밝고 가는 획(위)으로 두 번 (황동에 새긴 것처럼) */
/** 지휘관 서명 (만년필 한글 필기) */
const SIG = '레이첼';
const CHAIN_DEFS = `<svg class="ct-defs" width="0" height="0" aria-hidden="true"><defs><pattern id="ct-chain" width="18" height="30" patternUnits="userSpaceOnUse">
  <ellipse class="mk-br-lo" cx="9" cy="8" rx="5.5" ry="7.6"/><ellipse class="mk-br-hi" cx="9" cy="7.6" rx="5.5" ry="7.6"/><rect class="mk-br-lo" x="7.4" y="15" width="3.2" height="15" rx="1.6"/><rect class="mk-br-hi" x="7.6" y="14.6" width="2.8" height="15" rx="1.4"/></pattern></defs></svg>`;
function sealHtml() {
  const ch = [[0.12, 0.42], [0.25, 0.56], [0.75, 0.5], [0.88, 0.38]];
  return `<main class="ct ct-seal${CT.vet ? ' quick' : ''}" data-a="ct-skip" aria-label="그늘 — 누르면 넘깁니다">
    <div class="ct-bg" style="background-image:url('${bgURL('erantes_bar')}')" aria-hidden="true"></div><div class="ct-dark" aria-hidden="true"></div><div class="mk-grain" aria-hidden="true"></div>
    <div class="ct-fly mk-paper" aria-hidden="true">${slipHtml()}</div>
    ${CHAIN_DEFS}
    ${ch.map(([x, h], i) => `<div class="ct-chain" style="--x:${x};--h:${h};--d:${(i * 0.14).toFixed(2)}s" aria-hidden="true"><div class="ct-sway"><svg preserveAspectRatio="none" aria-hidden="true"><rect width="18" height="100%" fill="url(#ct-chain)"/></svg></div></div>`).join('')}
    <div class="ct-watch" aria-hidden="true"><div class="ct-swing">
      <svg viewBox="0 0 140 600" aria-hidden="true">
        <rect x="61" y="0" width="18" height="434" fill="url(#ct-chain)"/>
        <g transform="translate(10 426)"><g class="ct-twist">
          <circle class="mk-br-lo ct-bow" cx="60" cy="10" r="9"/><circle class="mk-br-hi ct-bow" cx="60" cy="9.4" r="9"/>
          <circle class="ct-case" cx="60" cy="84" r="60"/><circle class="mk-br-lo ct-rim" cx="60" cy="84" r="56"/><circle class="mk-br-hi ct-rim2" cx="60" cy="83.4" r="56"/>
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
  if (CT.step === 'review') return reviewHtml();
  if (CT.step === 'seal') return sealHtml();
  return boardHtml();
}

// ───────── 동작
/** data-a="ct-*" 처리. 다시 그려야 하면 true */
export function contractAct(a: string, v: string): boolean {
  switch (a) {
    case 'ct-job': {
      const j = v.startsWith('c:') ? (FIELDS.some((f) => f.id === v.slice(2)) ? orderOf(v.slice(2)) : null) : CT.jobs[+v.slice(1)];
      if (!j) return false;
      const same = !!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field;
      CT.sel = same ? null : j; CT.focus = `job:${v}`; CT.last = CT.sel ? 'job' : ''; CT.say = '';
      if (v.startsWith('c:')) CT.list = false; // 메뉴에 없는 의뢰를 고르면 목록을 접고 그 줄을 의뢰 칸에 남긴다
      if (CT.sel) sfx('print');
      return true;
    }
    case 'ct-off': CT.list = !CT.list; CT.focus = 'off'; CT.say = ''; return true;
    case 'ct-usual': {
      const u = usual();
      if (!u) return false;
      CT.lit = !ridersOn() && oathDiff(u.plan.lvl);
      CT.sel = u.job; CT.plan = u.plan.lvl; CT.list = false; CT.focus = 'usual'; CT.last = 'job'; CT.say = 'usual';
      sfx('print');
      return true;
    }
    case 'ct-plan': {
      if (!PLAN_BY_LVL[+v]) return false;
      CT.lit = !ridersOn() && oathDiff(+v); // 담보 약관을 켜는 순간 특약 칸에 불이 들어온다
      CT.plan = +v; CT.focus = `plan:${v}`; CT.last = 'plan'; CT.say = '';
      sfx('print');
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
      CT.last = s[d.id] ? `rider:${d.id}` : ''; CT.say = '';
      sfx('print');
      return true;
    }
    case 'ct-bell': {
      if (!payable()) { hooks.toast('의뢰와 약관을 먼저 고르세요.'); return false; }
      const bell = document.querySelector('.ct-bell');
      bell?.classList.add('ring');
      sfx('bell');
      clear();
      later(reduced() ? 0 : 650, () => { CT.check = true; CT.say = ''; hooks.render(); });
      return false;
    }
    case 'ct-check-close': CT.check = false; return true;
    case 'ct-sign': {
      if (!payable() || CT.signed) return false;
      CT.signed = true; CT.last = jobOf()?.kind === 'sealed' ? 'job' : ''; sfx('paper');
      if (CT.vet) later(reduced() ? 0 : jobOf()?.kind === 'sealed' ? 1500 : 900, () => { if (CT.signed && CT.check) { CT.step = 'review'; CT.check = false; hooks.render(); } }); // 단골: 서명이 마르면 바로 증서
      return true;
    }
    case 'ct-take': if (!CT.signed) return false; CT.step = 'review'; CT.check = false; return true;
    case 'ct-tear': tear(); return false;
    case 'ct-seal': if (!CT.signed) return false; CT.step = 'seal'; return true;
    case 'ct-skip': finish(); return false;
    case 'ct-leave': clear(); hooks.leave(CT.from); return false;
  }
  return false;
}
/** 정보 판만 바꾼다 (가리키기 · 막힌 특약 누르기) */
function refreshInfo() {
  const el = document.querySelector<HTMLElement>('.ct-info');
  if (el) el.innerHTML = infoHtml();
}
/** 증서를 찢는다: 지그재그로 두 조각이 갈라져 떨어진 뒤 차림표로 (싯가 의뢰를 찢었으면 봉인 의뢰서를 새로) */
function tear() {
  const wrap = document.querySelector<HTMLElement>('.ct-deed-wrap'), deed = wrap?.querySelector<HTMLElement>('.ct-deed');
  sfx('tear');
  const done = () => {
    const j = jobOf();
    const k = j ? CT.jobs.indexOf(j) : -1;
    if (j?.kind === 'sealed' && k >= 0) { CT.jobs[k] = newSealed(CT.jobs.map((x) => x.field)); CT.sel = null; CT.say = 'tearSealed'; CT.focus = ''; } else CT.say = 'tear';
    Object.assign(CT, { step: 'board', signed: false, check: false, last: '' });
    hooks.render();
  };
  if (!wrap || !deed || reduced()) { done(); return; }
  const pts: string[] = [];
  for (let i = 0; i <= 14; i++) pts.push(`${50 + (i % 2 ? 3.2 : -3.2) * (0.6 + Math.random() * 0.6)}% ${(i / 14) * 100}%`);
  for (const side of ['l', 'r'] as const) {
    const c = deed.cloneNode(true) as HTMLElement;
    c.classList.add('ct-half', side);
    c.style.clipPath = side === 'l' ? `polygon(0 0, ${pts.join(', ')}, 0 100%)` : `polygon(100% 0, ${pts.join(', ')}, 100% 100%)`;
    wrap.appendChild(c);
  }
  deed.style.visibility = 'hidden';
  wrap.closest('.ct')?.querySelector('.ct-deed-side')?.classList.add('gone');
  clear();
  later(780, done);
}
/** 그늘 연출 끝 → 명부 */
function finish() {
  clear();
  const s = signedContract();
  if (!s) { contractBack(); hooks.render(); return; }
  CT.fromSeal = true;
  hooks.roster(s);
}

/** 그린 뒤 (main.ts render): 차림표 가리키기 → 정보 판 · 그늘 연출 시간표 */
export function contractMount(root: HTMLElement) {
  const ct = root.querySelector<HTMLElement>('main.ct');
  if (!ct) return;
  if (CT.step === 'board') {
    const board = ct.querySelector<HTMLElement>('.ct-board');
    const point = (e: Event) => {
      const f = (e.target as HTMLElement).closest<HTMLElement>('[data-f]')?.dataset.f;
      if (f && f !== CT.focus) { CT.focus = f; refreshInfo(); }
    };
    board?.addEventListener('mouseover', point);
    board?.addEventListener('focusin', point);
    if (CT.last) ct.querySelector('.ct-slip .ct-r.new')?.scrollIntoView?.({ block: 'nearest' });
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
