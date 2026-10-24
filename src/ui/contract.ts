// 출격 계약: 에란테스 바 카운터를 내려다본 탑뷰. 바에서 [새 계약] → 시선이 바 테이블로 내려가고 → 위에서 청사진(도면)이, 아래에서 차림표(메뉴판)가 미끄러져 들어온다.
// 차림표의 줄을 고르면 오른쪽 전표 출력기가 카본지 전표를 찍어 위로 밀어 올리고 (길수록 끝이 휘며 그림자가 진다). 고른 것을 바꾸면 출력기가 바뀐 첫 줄까지 종이를 되감아 그 자리부터 다시 찍는다 (종이 재활용 · feedSlip), 다 고르면 탁상 벨이 테이블 오른쪽 끝에서 튀어나와 그 자리에 놓인다.
// 나가기 = 같은 길을 거꾸로 (바로 돌아갈 때): 위 화살표 · 화면을 위로 세게 쓸어 올리기 · 세게 굴리기. 벨 = 전표에 '승인' 도장 → 그늘(체인 · 회중시계) → 계약 기물 명부 (main.ts newRunScreen).
// [의뢰 취소] 또는 벨을 화면 밖으로 끌어내기 = '취소' 도장 → 전표가 바깥으로 미끄러져 나가고 고른 것이 비워진다.
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
import { noteHtml, tabHtml, type Note } from './briefing';
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
  /** 벨이 테이블 오른쪽 끝에 나와 있는지 (다 고르면 오른쪽 밖에서 튀어나오고, 고른 것이 비면 다시 들어간다) */
  bell: false,
  /** 펜 체크가 바뀌는 중에 연타하면 에이든이 핀잔을 주며 차림표를 새 것으로 바꾼 시각 */
  swapAt: -1e9,
  /** 핫초코가 미끄러져 들어오기 시작하는 시각 (열 때 소품이 다 놓인 뒤 · 다시 그려도 이어서 움직인다) */
  mugAt: -1e9,
  /** 도면 · 차림표가 놓인 각도 (열 때마다 조금씩 다르게) */
  /** 놓인 각도: 도면 · 차림표 · 출력기 · 특약 차림표 · 메뉴에 없는 의뢰 */
  rot: { bp: 0, mn: 0, pr: 0, rd: 0, ls: 0 },
  /** 카운터 너머 목소리 (잠깐 떴다 사라진다) */
  say: '',
  no: 0,
  time: '',
  timers: [] as number[],
  fromSeal: false,
  /** 런을 마치고 돌아오는 길: 태블릿 화면을 가득 채운 채로 시작해 줌 아웃 → 바로 (그릴 때 한 번) */
  ret: false,
};

/** main.ts 가 채우는 연결: 다시 그리기 · 전장 브리핑 · 적 상세 창 · 알림 · 명부 열기 · 나가기 */
export const hooks = {
  render: () => {},
  brief: (_fid: string) => '',
  foe: () => '',
  toast: (_msg: string) => {},
  roster: (_s: Signed) => {},
  /** 전표가 화면 위 끝을 넘었을 때 (업적) */
  receipt: (_riders: number) => {},
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
/** 바 화면을 뜬 것 (시선 전환용, 클릭 · 낭독 없이 그림으로만): <main> 을 <div> 로 바꿔 화면 판정에 걸리지 않게 */
let barSnap = '';
/** 테이블에 올라온 종이 (특약 차림표 rd · 메뉴에 없는 의뢰 ls): 막 나오면 ' in', 막 빠지면 ' out' (빠지는 동안 한 번 더 그린다), 없으면 null */
const shown: Record<string, boolean> = {};
/** 쓸어 내리다 놓은 자리 (빠지는 연출이 거기서 이어진다) */
const dragY: Record<string, number> = {};
function sheetCls(k: string, on: boolean): string | null {
  const was = !!shown[k];
  shown[k] = on;
  if (on) return was ? '' : ' in';
  return was ? ' out' : null;
}
const snapOf = (html: string) => html.replace(/^<main\b/, '<div').replace(/<\/main>\s*$/, '</div>').replace(/\saria-live="[^"]*"/g, '');
const barviewHtml = () => `<div class="ct-barview" aria-hidden="true" inert>${barSnap || `<div class="ct-barbg" style="background-image:url('${bgURL('erantes_bar')}')"></div>`}</div>`;
export function contractStart(from: string, list = false, snap = '') {
  barSnap = snap ? snapOf(snap) : '';
  clear();
  const n = deedCount();
  Object.assign(CT, { step: 'board', from, sel: null, list, vet: n > 0, lit: false, focus: '', last: '', stamp: '', intro: true, bell: false, swapAt: -1e9, mugAt: performance.now() + MUG_AT, fromSeal: false, say: '오늘 들어온 의뢰서입니다. 제철이라 조금 더 쳐 드리죠.' });
  CT.rot = { bp: rnd(-4, 4), mn: rnd(-3, 3), pr: rnd(-3, 3), rd: rnd(-3, 3), ls: rnd(-2, 2) };
  for (const k in shown) delete shown[k];
  paper.rows = []; paper.run = null; paper.token++;
  scr.last = ''; scr.hits = [];
  for (const k in marks) delete marks[k];
  CT.no = n + 1;
  const d = new Date();
  CT.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  CT.jobs = shuffle(FIELDS.map((f) => f.id)).slice(0, 3).map((field) => ({ field, kind: 'season' as const, bonus: seasonWin() }));
}
/** 런을 마치고 바로 돌아가는 길: 계약 보드를 태블릿 화면이 시야를 채운 모습으로 그리고, 줌 아웃해 테이블이 보이면 바로 올라간다 (contractMount → returnZoom) */
export function contractReturn() {
  contractStart('bar');
  Object.assign(CT, { intro: false, ret: !reduced(), say: '', mugAt: -1e9 });
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
  return `<span class="pill ct-pill" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="f-num">No.${pad(c.no, 4)}</span>${bt ? `<em${b < 0 ? ' class="dn"' : ''}>${bt}</em>` : ''}</span>`;
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
  if (!j) return out; // 의뢰를 고르기 전에는 종이가 출력기 안에 있다
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
    for (const x of on) out.push({ l: `${x.def.env} ${x.n}단계`, r: `+${oathHeatOf(x.def.id, x.n)}`, k: 'st', g: `rider:${x.def.id}` }, { l: x.def.lv(x.n), k: 's', g: `rider:${x.def.id}` });
  }
  if (j && p) {
    out.push({ l: '', k: 'div' }, { l: '보수', r: priceOf(j), k: 'tot' }, { l: '표기 위험', r: effDiffLabel(p.lvl, heatNow()), k: 'b' }, { l: '결제', r: CT.stamp === 'ok' ? '승인' : CT.stamp === 'void' ? '취소' : '벨을 누르면 승인', k: 'm' });
  }
  return out;
}
/** 전표 줄 HTML (한 줄씩: 출력기가 지금 종이와 줄 단위로 비교한다) */
const slipRows = () => rows().map((x) => x.k === 'div' ? '<i class="ct-r div" aria-hidden="true"></i>'
  : `<div class="ct-r ${x.k || ''}"><span>${esc(x.l)}</span>${x.r ? `<span class="f-num">${esc(x.r)}</span>` : ''}</div>`);
/** 말려 들어가는 끝단의 그늘 (슬롯 자리에 머문다 · feedSlip 이 종이와 반대로 움직인다) */
const CURL = '<i class="ct-curl" aria-hidden="true"></i>';
const slipHtml = () => slipRows().join('') + CURL;

// ───────── 출력기: 종이는 재활용된다. 줄이 바뀌면 바뀐 첫 줄이 인쇄 머리(슬롯)에 닿을 때까지 종이를 거꾸로 빨아들이고, 그 자리부터 새로 찍으며 밀어낸다
/** 지금 종이에 찍혀 있는 줄 · 움직이는 중이면 그 기록 (연타하면 지금 위치에서 이어받는다) · 오래된 연쇄를 끊는 표 */
const paper = { rows: [] as string[], run: null as null | { from: number; to: number; t0: number; ms: number; steps: number }, token: 0 };
/** 종이가 슬롯 안으로 들어가 있는 길이 (px) */
function paperOff() {
  const r = paper.run;
  if (!r) return 0;
  let p = Math.min(1, Math.max(0, (performance.now() - r.t0) / r.ms));
  if (r.steps) p = Math.floor(p * r.steps) / r.steps;
  return r.from + (r.to - r.from) * p;
}
/** 움직일 거리 → 시간: 거의 일정한 속도 (0.18px/ms), 길면 조금씩 빨라진다 (600px 에서 1.6배). 되감기는 1.5배 빠르게 */
const feedMs = (dist: number, back: boolean) => Math.round(dist / (0.18 * (1 + 0.6 * Math.min(1, dist / 600)) * (back ? 1.5 : 1)));
/** 그린 뒤: 종이(지금 찍힌 줄)를 새 줄로 맞춘다. 끝나면 done */
function feedSlip(ct: HTMLElement, done: () => void) {
  const slip = ct.querySelector<HTMLElement>('.ct-slip'), pr = ct.querySelector<HTMLElement>('.ct-printer');
  const want = slipRows(), tok = ++paper.token, off0 = paperOff();
  paper.run = null;
  if (!slip) return;
  const same = want.length === paper.rows.length && want.every((h, i) => h === paper.rows[i]);
  if (CT.stamp || reduced() || (same && off0 <= 0)) { paper.rows = want; done(); return; } // 도장은 종이 위에 찍는 것 (출력기가 아니다)
  const html = (rs: string[]) => { slip.innerHTML = rs.join('') + CURL; slip.classList.toggle('empty', !rs.length); };
  const curl = () => slip.querySelector<HTMLElement>('.ct-curl');
  const at = (y: number) => { slip.style.translate = y ? `0 ${y}px` : ''; const c = curl(); if (c) c.style.translate = y ? `0 ${-y}px` : ''; };
  /** i 번째 줄의 윗변 (줄 끝 = 마지막 줄 아래, 아래 여백 앞) */
  const topOf = (i: number) => { const el = slip.querySelectorAll<HTMLElement>(':scope > .ct-r')[i]; return el ? el.offsetTop : slip.offsetHeight - parseFloat(getComputedStyle(slip).paddingBottom); };
  const go = (from: number, to: number, back: boolean, then: () => void) => {
    const dist = Math.abs(to - from);
    if (dist < 1) { at(to); then(); return; }
    const ms = feedMs(dist, back), steps = back ? 0 : Math.max(2, Math.round(dist / 7)); // 찍을 때는 한 칸씩 (모터 스텝), 되감을 때는 매끈하게
    paper.run = { from, to, t0: performance.now(), ms, steps };
    at(to);
    pr?.classList.add('run');
    const ticks = Math.min(14, Math.max(1, Math.round(ms / 110)));
    for (let i = 0; i < ticks; i++) sfx('print', { delay: i * ms / ticks / 1000, pitch: back ? 0.72 + (i % 2) * 0.03 : 1 + (i % 2) * 0.04 });
    const tm = { duration: ms, easing: steps ? `steps(${steps}, end)` : 'linear' };
    curl()?.animate([{ translate: `0 ${-from}px` }, { translate: `0 ${-to}px` }], tm); // 끝단 그늘은 슬롯 자리에 머문다
    slip.animate([{ translate: `0 ${from}px` }, { translate: `0 ${to}px` }], tm).onfinish = () => {
      if (tok !== paper.token) return;
      paper.run = null; pr?.classList.remove('run'); then();
    };
  };
  const print = (start: number) => { paper.rows = want; go(start, 0, false, () => { at(0); done(); }); };
  if (same) { at(off0); print(off0); return; } // 찍던 중에 다시 그려졌으면 이어서 밀어낸다
  if (!paper.rows.length) { html(want); print(slip.offsetHeight); return; } // 빈 출력기: 머리말부터 새로 찍는다
  let d = 0;
  while (d < want.length && d < paper.rows.length && want[d] === paper.rows[d]) d++;
  html(paper.rows); at(off0);
  const h = slip.offsetHeight, top = want.length ? topOf(d) : 0;
  go(off0, Math.max(off0, h - top), true, () => { // ① 바뀐 첫 줄이 인쇄 머리에 닿을 때까지 빨아들인다 (다 비우면 끝까지)
    html(want);
    if (!want.length) { paper.rows = []; at(0); done(); return; }
    print(slip.offsetHeight - top); // ② 그 자리부터 새로 찍으며 밀어낸다
  });
}

// ───────── 차림표
const clientShort = (c?: string) => (c || '').replace(/\s*\(.*\)$/, '');
/** 항목 한 줄: 이름 ‥‥ 가격, 아래 작은 설명 (고르면 네이비 띠로 반전) */
const row = (cls: string, attrs: string, nm: string, pr: string, ds: string[], on: boolean, ck = '') =>
  `<button class="lp-row${on ? ' on' : ''}${cls ? ` ${cls}` : ''}" ${attrs} aria-pressed="${on}"><span class="lp-rt"><b class="lp-nm">${nm}</b><i class="lp-dots" aria-hidden="true"></i>${pr ? `<em class="lp-pr">${pr}</em>` : ''}${ck}</span>${ds.map((d) => `<small class="lp-ds">${d}</small>`).join('')}</button>`;

// ───────── 펜 체크: 고른 줄은 바탕을 칠하지 않고 체크칸에 네이비 펜으로 체크한다. 고른 것을 바꾸면 앞 체크를 지운 뒤 새 칸에 긋는다
/** 손으로 그은 듯한 체크 한 획 (pathLength 1 → 그리기 · 지우기) */
const PEN = '<svg viewBox="0 0 20 20" aria-hidden="true"><path pathLength="1" d="M3.4 10.6c1.6 1.4 3.1 3 4.6 5.2 2.6-4.6 5.7-8.8 9.7-12.6"/></svg>';
const PEN_OUT = 220, PEN_IN = 320, SWAP = 1100;
/** 핫초코: 도면 · 차림표 · 출력기 · 말풍선이 다 나온 뒤 (2.5초) 에이든 쪽 (화면 위)에서 밀려 내려와 밑 부분만 보인다 */
const MUG_AT = 2700, MUG_MS = 900;
/** 알림이 뜬 뒤 카메라가 표시기로 들어가기까지 */
const NOTE_WAIT = 250;
/** 묶음(job · plan · rd:id)마다 지금 체크된 값 · 직전 값 · 바뀐 시각 (다시 그려도 연출이 이어지게) */
const marks: Record<string, { cur: string; prev: string; t0: number }> = {};
function mark(g: string, cur: string) {
  const m = marks[g];
  if (!m) { marks[g] = { cur, prev: '', t0: 0 }; return; }
  if (m.cur !== cur) { m.prev = m.cur; m.cur = cur; m.t0 = performance.now(); }
}
const penBusy = () => { const now = performance.now(); return Object.values(marks).some((m) => now - m.t0 < PEN_OUT + PEN_IN); };
/** 체크칸: 지금 값이면 체크 (막 바뀌었으면 앞 체크를 지운 뒤 긋는다), 직전 값이면 지우는 중 */
function box(g: string, key: string, cls = 'ct-box') {
  const m = marks[g], now = performance.now(), el = m ? Math.round(now - m.t0) : 1e9, quiet = reduced() || now - CT.swapAt < SWAP;
  let c = cls, st = '';
  if (m && m.cur && key === m.cur) { c += ' on'; if (el < PEN_OUT + PEN_IN && !quiet) { c += ' draw'; st = ` style="--el:${el}ms;--d:${m.prev ? PEN_OUT : 0}ms"`; } }
  else if (m && key === m.prev && el < PEN_OUT && !quiet) { c += ' erase'; st = ` style="--el:${el}ms"`; }
  return `<i class="${c}"${st} aria-hidden="true">${PEN}</i>`;
}
const jobKey = (j: Job | null) => j ? `${j.kind}:${j.field}` : '';
function jobRow(j: Job, v: string, small = false) {
  const f = fieldOf(j.field), fi = fieldIntroOf(j.field), on = !!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field;
  return row(small ? 'sm' : '', `data-a="ct-job" data-v="${v}" data-f="job:${v}"`, `「${esc(fi?.title || f.name)}」`, '', [`${esc(f.name)}${fi ? ` · ${esc(clientShort(fi.client))}` : ''}`], on, box('job', jobKey(j))); // 전장 이름 ‥ 체크칸 (제철은 머리 '모두 싯가' · 도면 · 전표에)
}
/** 의뢰 칸: (단골) 늘 하던 대로 + 오늘의 의뢰서 3장 + '메뉴에 없는 의뢰' 한 줄 */
function jobCol() {
  const custom = CT.sel?.kind === 'custom' ? CT.sel : null;
  const u = CT.vet ? usual() : null, l = lastDeed();
  const us = u && l ? row('us', 'data-a="ct-usual" data-f="usual"', '늘 하던 대로', u.job.kind === 'season' ? '제철' : '', [`지난 계약 「${esc(fieldTitle(l.field))}」 · ${esc(u.plan.short)}`], false) : '';
  return `${us}${CT.jobs.map((j, i) => jobRow(j, `d${i}`)).join('')}${custom ? jobRow(custom, `c:${custom.field}`) : ''}
    ${row('', 'data-a="ct-off" data-f="off"', '메뉴에 없는 의뢰', '', [`다른 전장을 직접 주문 · ${offMenu().length}곳`], false)}`;
}
/** 위험 눈금: 칸 3개 중 n개 (담보 = 도장 색) */
const pipsHtml = (n: number, hot = false) => `<i class="ct-pips${hot ? ' hot' : ''}" role="img" aria-label="위험 ${n}/3">${[1, 2, 3].map((k) => `<b class="${k <= n ? 'on' : ''}"></b>`).join('')}</i>`;
/** 담보 위험 표식: 고르기 전에도 다른 약관과 다르게 (해골 + 위험, 도장 색) */
const RISK = () => `<i class="ct-risk" title="담보 — 함대를 담보로 잡는 약관">${lineIcon('m.skull', 'li')}<span>위험</span></i>`;
/** 약관 줄: 큰 글자 = 고르는 말, 작은 글자 = 부서 · 난이도 + 위험 눈금 (배율 숫자 없음) */
function planRow(lvl: number) {
  const p = PLAN_BY_LVL[lvl], hot = collateral(lvl);
  return row(hot ? 'hot' : '', `data-a="ct-plan" data-v="${lvl}" data-f="plan:${lvl}"`, esc(p.short), hot ? RISK() : '', [`${esc(p.dept)} · ${esc(diffName(lvl))} ${pipsHtml(p.pips, hot)}`], CT.plan === lvl, box('plan', String(lvl)));
}
/** 메뉴에 없는 의뢰: 차림표의 의뢰 칸을 덮는 조금 넓은 종이 (약관 칸은 거의 덮지 않는다). 고른 뒤에도 남고, 아래로 쓸어 내리면 빠진다 */
function offSheetHtml(cls: string) {
  const fs = offMenu();
  return `<section class="ct-offsheet lp-paper lp-frame${cls}" style="--y0:${dragY.ls || 0}px" role="group" aria-label="메뉴에 없는 의뢰 — 직접 주문"${cls === ' out' ? ' aria-hidden="true" inert' : ''}>
    <h2 class="lp-h2">메뉴에 없는 의뢰 <small>직접 주문 · ${fs.length}곳</small></h2>
    <div class="lp-list">${fs.map((f) => jobRow(orderOf(f.id), `c:${f.id}`, true)).join('')}</div>
  </section>`;
}
/** 특약 줄: 환경 조건 이름 + 한 줄 설명 (수치는 도면) + 단계 체크칸 (지금 단계에 체크). 이름을 누르면 단계가 하나씩 오르고, 칸을 누르면 그 단계로 (같은 칸 = 끄기) */
function riderRow(id: OathId) {
  const d = OATHS.find((o) => o.id === id)!, n = oathLv({ oaths: oathSel() }, id), max = oathMax(id);
  const lvBox = (k: number) => `<button class="ct-ck${k === n ? ' on' : ''}" data-a="ct-rlv" data-v="${id}:${k}" aria-pressed="${k === n}" aria-label="${esc(d.env)} ${k}단계${k === n ? ' (누르면 끄기)' : ''}">${box(`rd:${id}`, String(k), 'ct-box sm')}${k}단계</button>`;
  return `<div class="lp-row sm ct-rd${n ? ' on' : ''}" data-f="rider:${id}">
    <button class="ct-rd-nm" data-a="ct-rider" data-v="${id}" title="${esc(n >= max ? '누르면 끄기' : `누르면 ${n + 1}단계`)}"><b class="lp-nm">${esc(d.env)}</b></button>
    <span class="ct-rd-ln"><small class="lp-ds">${esc(d.brief)}</small><span class="ct-cks" role="group" aria-label="단계">${Array.from({ length: max }, (_, i) => lvBox(i + 1)).join('')}</span></span>
  </div>`;
}

// ───────── 청사진 (도면): 가리킨 · 고른 줄의 내용을 아이콘 · 구획으로 (줄글 없이)
const bh = (t: string, s: string) => `<header class="lp-bh"><b>${t}</b><span>${s}</span></header>`;
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
    // 전장 브리핑(main.ts fieldBrief)을 세 칸으로 나눈다: 의뢰 | 전장 (분류 · 속성 · 시너지 · 규칙) | 주요 적 (상성 · 초상)
    const b = hooks.brief(j.field), at = (k: string) => { const i = b.indexOf(k); return i < 0 ? b.length : i; };
    const iMu = at('<div class="mu-box">'), iRules = at('<ul class="fb-rules">'), iFoes = at('<div class="fb-foes">');
    const field = b.slice(0, Math.min(iMu, iRules)) + b.slice(iRules, iFoes), foes = b.slice(iMu, iRules).replace(/<span class="mu-k">[^<]*<\/span>/, '') + b.slice(iFoes);
    const col = (icon: string, t: string, body: string) => `<section class="bp-col"><h3 class="bp-h">${lineIcon(icon, 'li')}${t}</h3>${body}</section>`;
    return `${bh(`「${esc(fi?.title || f.name)}」`, `${esc(f.name)} · ${esc(f.region)}`)}
      <div class="bp-cols">
        ${col('k.note', '의뢰', `<div class="lp-kv"><span><i>의뢰인</i><b>${esc(fi?.client || '—')}</b></span><span><i>보수</i><b>${esc(priceOf(j))}</b>${fi?.reward ? `<small>${esc(fi.reward)}</small>` : ''}</span></div>${fi?.brief ? `<p class="lp-ip">${esc(fi.brief)}</p>` : ''}`)}
        ${col('r.flag', '전장', field)}
        ${col('m.skull', '주요 적', foes)}
      </div>`;
  }
  if (k === 'plan') {
    const p = PLAN_BY_LVL[+v];
    if (!p) return '';
    return `${bh(`${esc(p.short)} ${pipsHtml(p.pips, collateral(p.lvl))}`, `${esc(p.code)} ${esc(p.name)} · ${esc(diffName(p.lvl))}`)}
      <div class="bp-cols plan">${sect('cost', 'm.skull', '감수', costsOf(p.lvl))}<div class="bp-col">${sect('gain', 'm.up', '보상', gainsOf(p.lvl))}${sect('', 'k.note', '조항', [{ icon: 'k.note', text: `위험 1~${p.lvl} 조항 ${clauseN(p.lvl)}건`, sub: '수치는 출격 뒤 지도 환경 탭 \'계약\'' }, ...(collateral(p.lvl) ? [{ icon: 'n.adversity', text: '담보 조항', sub: `${collateralTerms(p.lvl).despair} · ${collateralTerms(p.lvl).when}` }] : []), ...(oathDiff(p.lvl) ? [{ icon: 'm.up', text: '특약을 붙일 수 있다', sub: '절망 서약' }] : [])])}</div></div>`;
  }
  if (k === 'rider') {
    const d = OATHS.find((o) => o.id === v);
    if (!d) return '';
    const n = oathLv({ oaths: oathSel() }, d.id);
    return `${bh(`${lineIcon(d.icon, 'li')}${esc(d.env)}`, `특약 · ${esc(d.name)}${ridersOn() ? '' : ' · 담보 약관에만 붙는다'}`)}
      <p class="bp-quip">${esc(d.quip)}</p>
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
  if (a === 'spam') return '펜 자국이 겹치면 저도 못 읽습니다. 새 차림표로 드리죠.';
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
/** 바로 돌아가기: 위로 (시선이 바로 올라간다) */
const UP_SVG = `<svg class="ct-up" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>`;
/** 전표 출력기 (위에서 본 네이비 법랑 몸체 + 놋쇠 테 + 위쪽 슬릿) */
const PRINTER_SVG = `<svg class="ct-fb" viewBox="0 0 100 154" aria-hidden="true"><rect x="10" y="6" width="84" height="146" rx="10" class="sh"/><rect x="4" y="2" width="84" height="146" rx="10" class="body"/><rect x="9" y="7" width="74" height="136" rx="7" class="rim"/><rect x="15" y="9" width="62" height="7" rx="2" class="slot"/><rect x="18" y="11.5" width="56" height="2" rx="1" class="gap"/></svg>`;

function boardHtml() {
  mark('job', jobKey(CT.sel)); mark('plan', String(CT.plan));
  for (const o of OATHS) mark(`rd:${o.id}`, String(oathLv({ oaths: oathSel() }, o.id)));
  const ok = payable(), heat = heatNow(), lit = CT.lit, info = infoHtml(), swEl = Math.round(performance.now() - CT.swapAt), mugEl = Math.round(performance.now() - CT.mugAt);
  scr.blink = !!scr.last && info !== scr.last && !CT.intro; // 도면 내용이 바뀌면 그린 뒤 화면이 한 번 꺼졌다 켜진다
  scr.last = info;
  CT.lit = false;
  const leave = CT.from === 'bar' ? '바로 돌아가기' : '타이틀로';
  const n = rows().filter((r) => r.k !== 'div').length;
  const on = ok && CT.stamp !== 'void', bellIn = on && !CT.bell, bellOut = !on && CT.bell;
  CT.bell = on;
  const rOn = ridersOn(), rd = sheetCls('rd', rOn), ls = sheetCls('ls', CT.list);
  if (rd === ' in') CT.rot.rd = rnd(-3, 3); // 놓일 때마다 조금씩 다른 각도
  if (ls === ' in') { CT.rot.ls = rnd(-2, 2); dragY.ls = 0; }
  return `<main class="ct ct-top${CT.intro && !reduced() ? ' intro' : ''}${CT.stamp ? ` st-${CT.stamp}` : ''}${swEl < SWAP && !reduced() ? ' swapping' : ''}" style="--sw-el:${Math.min(swEl, SWAP)}ms;--rot-bp:${CT.rot.bp}deg;--rot-mn:${CT.rot.mn}deg;--rot-pr:${CT.rot.pr}deg;--rot-rd:${CT.rot.rd}deg;--rot-ls:${CT.rot.ls}deg" aria-label="출격 계약 — 바 테이블 위 의뢰 차림표">
    ${CT.intro ? barviewHtml() : ''}
    <div class="ct-table" aria-hidden="true">${prop('ct_table', '')}</div><div class="lp-grain" aria-hidden="true"></div>
    <img class="ct-mug${mugEl < MUG_MS && !reduced() ? ` in" style="animation-delay:${-mugEl}ms` : ''}" alt="" aria-hidden="true" src="${artURL('ct_mug.webp')}" decoding="async" onerror="this.remove()">
    <button class="ct-leave lp-btn" data-a="ct-leave" aria-label="${leave}" title="${leave} (화면을 위로 쓸어 올려도 된다)">${UP_SVG}</button>
    <p class="ct-voice${CT.say ? ' on' : ''}" aria-live="polite"><b>에이든</b><span>${esc(CT.say)}</span></p>
    <section class="ct-bp" aria-label="의뢰 도면 (표시기)"><div class="ct-bp-scr lp-bp" aria-live="polite">${info}</div><div class="ct-os">${tabHtml()}</div><i class="ct-blank" aria-hidden="true"><img class="ct-mk" alt="" src="${artURL('mingki.bust.webp')}" decoding="async" onerror="this.remove()"></i><i class="ct-led" aria-hidden="true"></i></section>
    <div class="ct-menu">
      ${coverHtml()}
      <section class="ct-page lp-paper lp-frame" aria-label="의뢰 차림표">
        <div class="lp-cols">
          <div class="lp-col ct-col-job" role="group" aria-label="의뢰"><h2 class="lp-h2">의뢰 <small>모두 싯가</small></h2><div class="lp-list">${jobCol()}</div></div>
          <div class="lp-col ct-col-plan" role="group" aria-label="약관"><h2 class="lp-h2">약관 <small>난이도</small></h2><div class="lp-list">${PLANS.map((p) => planRow(p.lvl)).join('')}</div></div>
        </div>
        ${collateral(CT.plan) ? `<i class="ct-plan-stamp${lit ? ' lit' : ''}" aria-hidden="true">담보</i>` : ''}
      </section>
    </div>
    ${ls !== null ? offSheetHtml(ls) : ''}
    ${rd !== null ? `<section class="ct-riders lp-paper lp-frame${rd}" role="group" aria-label="특약 차림표 (담보 약관 전용)"${rd === ' out' ? ' aria-hidden="true" inert' : ''}>
      <h2 class="lp-h2">특약 <small>절망 ${heat}</small></h2><div class="lp-list">${OATHS.map((o) => riderRow(o.id)).join('')}</div>
    </section>` : ''}
    <section class="ct-printer" aria-label="의뢰 전표">
      <div class="ct-slipwrap" style="--n:${n}">
        <div class="ct-slip lp-carbon${n ? '' : ' empty'}">${slipHtml()}${CT.stamp ? `<i class="ct-stampmark ${CT.stamp}" aria-hidden="true">${CT.stamp === 'ok' ? '승인' : '취소'}</i>` : ''}</div>
      </div>
      <div class="ct-pmach" aria-hidden="true">${prop('ct_printer', PRINTER_SVG)}</div>
    </section>
    <div class="ct-desk">
      <button class="ct-cancel lp-btn" data-a="ct-cancel"${jobOf() && !CT.stamp ? '' : ' disabled'}>의뢰 취소</button>
    </div>
    <button class="ct-bell${on ? ' on' : ''}${bellIn ? ' in' : ''}${bellOut ? ' out' : ''}${ok && !CT.stamp ? ' ready' : ''}" data-a="ct-bell" aria-label="벨을 눌러 전표 승인 (화면 밖으로 끌어내면 의뢰 취소)"${on ? '' : ' tabindex="-1" aria-hidden="true"'}${ok && !CT.stamp ? '' : ' aria-disabled="true"'}>${prop('ct_bell', BELL_SVG)}</button>
    <img class="ct-hand sh" alt="" aria-hidden="true" src="${artURL('ct_hand.webp')}" decoding="async"><div class="ct-hand-thb" aria-hidden="true"><img class="ct-hand th" alt="" src="${artURL('ct_hand_thumb.webp')}" decoding="async"></div><img class="ct-hand fr" alt="" aria-hidden="true" src="${artURL('ct_hand.webp')}" decoding="async">
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
/** 그늘 도중에 화면을 다시 그려야 할 때의 대체 화면 (보통은 보드 위에서 그대로 이어진다 — startSeal) */
function sealHtml() {
  return `<main class="ct ct-seal" data-a="ct-skip" aria-label="넘어가는 중 — 누르면 넘깁니다"></main>`;
}

/** 벨 → 브리핑 → 명부: 도장 → 출력기가 전표를 짧게 밀어낸 뒤(0.6초) 카메라가 태블릿(의뢰 도면 표시기)으로 락인한다 —
 *  기운 만큼(2~3°)만 돌려 정면으로 세우고, 화면이 시야를 덮을 때까지 들어간다 (--ct-in: 버티다 휙). 들어가는 동안 표시기 글자 · 램프 빛은 옅어져 청사진 모눈만 남는다.
 *  다 들어간 순간 모눈이 놓인 자리 · 간격을 넘겨 주고 명부(브리핑 수신, ui/briefing.ts)로 컷 — 같은 모눈에서 이어진다 (크로스 디졸브 없음).
 *  보드(main.ct)는 다시 그리지 않고 카메라처럼 옮긴다 (WAAPI). 줄이기 설정이면 회전 · 줌 없이 바로 컷.
 *  이전 연출(전표 카메라 · 체인 · 회중시계)은 archive/seal_v361 에 보관 */
let sealGrid: { x: number; y: number; s: number } | null = null;
/** 컷 순간 태블릿 모눈의 화면 자리 (브리핑이 같은 모눈에서 시작한다) — 한 번 읽으면 지운다 */
export function takeSealGrid() { const g = sealGrid; sealGrid = null; return g; }
/** 두 번째 계약부터 (브리핑을 1줄로 줄인다) */
export const contractVet = () => CT.vet;
/** 에이든의 손 (ct_hand · ct_hand_thumb, 임시본 scripts/hand_layers.py): 오른쪽 위에서 비스듬히 들어와 전표 오른쪽 끝을 집고(검지 · 중지는 종이 위, 엄지 끝은 종이 밑 = 전표 사각형만큼 잘라 냄) 위로 끌어 간다.
 *  두 층은 같은 크기 · 같은 원점, 그림 폭 1354px 기준 검지 끝 (13, 842) · 손목~검지 끝 565px. 손 크기 = 표시기 화면 높이의 80%.
 *  움직임: 스윽 들어와 살짝 지나쳤다 제자리 → 탁 눌러 집고(그림자가 붙는다) → 스윽 끌어 간다. 걸리는 ms 를 돌려준다 (못 하면 0) */
const HAND = { w: 1354, tipX: 13, tipY: 842, thumb: [175, 824], len: 565, rot: -16, grip: [14, 40], arm: Math.atan2(-842, 1341) }; // thumb: 엄지 끝 (그림 px) · grip: 엄지 끝 자리 = 전표 오른쪽 끝에서 안쪽 14 · 위에서 40 (전표 폭 204px 기준)
function handTake(ct: HTMLElement): number {
  const fr = ct.querySelector<HTMLImageElement>('.ct-hand.fr'), th = ct.querySelector<HTMLImageElement>('.ct-hand.th'), sh = ct.querySelector<HTMLImageElement>('.ct-hand.sh');
  const wrap = ct.querySelector<HTMLElement>('.ct-slipwrap'), slip = wrap?.querySelector<HTMLElement>('.ct-slip'), scr = ct.querySelector<HTMLElement>('.ct-bp-scr');
  if (!fr || !th || !sh || !wrap || !slip || !scr || reduced() || matchMedia('(max-width: 760px)').matches || !fr.naturalWidth || !th.naturalWidth) return 0;
  const cr = ct.getBoundingClientRect(), r = slip.getBoundingClientRect(), ks = r.width / 204, k = (scr.offsetHeight * 0.8) / HAND.len;
  // 엄지 끝을 전표 오른쪽 끝 밑에 두고, 검지 끝은 그만큼 왼쪽 위 (그림의 검지→엄지 거리를 손 크기 · 각도대로)
  const rr = (HAND.rot * Math.PI) / 180, vx = (HAND.thumb[0] - HAND.tipX) * k, vy = (HAND.thumb[1] - HAND.tipY) * k;
  const tx = r.right - cr.left - HAND.grip[0] * ks, ty = r.top - cr.top + HAND.grip[1] * ks;
  const ax = tx - (vx * Math.cos(rr) - vy * Math.sin(rr)), ay = ty - (vx * Math.sin(rr) + vy * Math.cos(rr));
  const a = HAND.arm + (HAND.rot * Math.PI) / 180, D = Math.hypot(innerWidth, innerHeight) * 0.75, dx = Math.cos(a) * D, dy = Math.sin(a) * D;
  const b = (-86 * Math.PI) / 180, ex = Math.cos(b) * D, ey = Math.sin(b) * D; // 끌어 갈 때는 거의 곧장 위로 (오른쪽 벨 위로 지나가지 않게)
  for (const el of [fr, th, sh]) Object.assign(el.style, { width: `${HAND.w * k}px`, left: `${ax - HAND.tipX * k}px`, top: `${ay - HAND.tipY * k}px`, transformOrigin: `${HAND.tipX * k}px ${HAND.tipY * k}px` });
  const at = (s: number, z = 1, out = false) => `translate(${(out ? ex : dx) * s}px, ${(out ? ey : dy) * s}px) rotate(${HAND.rot}deg) scale(${z})`;
  const IN = 300, TAK = 70, HOLD = 200, OUT = 380, T = IN + TAK + HOLD + OUT, o = (ms: number) => ms / T;
  const SNAP = 'cubic-bezier(.1, .9, .2, 1)', YANK = 'cubic-bezier(.5, 0, .8, .2)';
  const keys = [
    { transform: at(1), offset: 0, easing: SNAP }, // 스윽
    { transform: at(-0.012), offset: o(IN * 0.8), easing: 'ease-out' }, // 살짝 지나쳤다
    { transform: at(0), offset: o(IN), easing: 'ease-in' },
    { transform: at(0, 0.985), offset: o(IN + TAK * 0.5), easing: 'ease-out' }, // 탁 (눌러 집는다)
    { transform: at(0), offset: o(IN + TAK) },
    { transform: at(0, 1.01), offset: o(IN + TAK + HOLD), easing: YANK }, // 들어 올리며
    { transform: at(1, 1.01, true), offset: 1 }, // 스윽 끌어 간다
  ];
  for (const el of [fr, th]) { el.classList.add('on'); el.animate(keys, { duration: T, fill: 'forwards' }); }
  // 그림자: 들어올 때는 조금 떨어져 있다가, 탁 누를 때 손에 붙고, 들어 올리면 다시 조금 떨어진다
  // 그림자는 전표 · 벨 위, 엄지 · 손 밑 (DOM 순서). 손이 테이블 바로 위에 있으니 손에 붙어 있다
  const off = (i: number) => (i === 3 ? '4px 6px' : i === 2 || i === 4 ? '6px 9px' : '11px 16px');
  sh.classList.add('on');
  sh.animate(keys.map((kf, i) => ({ ...kf, translate: off(i) })), { duration: T, fill: 'forwards' });
  // 전표: 집은 뒤 손과 같은 길로 (출력기가 기운 만큼 되돌려 출력기 안 좌표로)
  const pr = (-CT.rot.pr * Math.PI) / 180, lx = ex * Math.cos(pr) - ey * Math.sin(pr), ly = ex * Math.sin(pr) + ey * Math.cos(pr);
  wrap.animate([{ transform: 'none', offset: 0 }, { transform: 'none', offset: o(IN + TAK + HOLD), easing: YANK }, { transform: `translate(${lx}px, ${ly}px)`, offset: 1 }], { duration: T, fill: 'forwards' });
  // 엄지 끝은 손과 같은 층(램프 · 벨 위)에 두고, 전표가 있는 사각형만 잘라 낸다 (전표 밑으로 들어간 것처럼). 전표가 끌려가는 동안에도 매 프레임 따라간다
  const thb = th.parentElement as HTMLElement, t0 = performance.now();
  const cut = () => {
    if (!thb.isConnected || CT.step === 'seal') { thb.style.clipPath = ''; return; }
    const c = ct.getBoundingClientRect(), q = slip.getBoundingClientRect(), x1 = q.left - c.left, y1 = q.top - c.top, x2 = q.right - c.left, y2 = q.bottom - c.top;
    thb.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)`;
    if (performance.now() - t0 < T + 100) requestAnimationFrame(cut);
  };
  cut();
  later(IN, () => sfx('knock', { pitch: 1.6, gain: 0.5 }));
  later(IN + TAK + HOLD, () => sfx('paper', { pitch: 1.2 }));
  return T;
}
/** 표시기 화면 위에 예레나의 알림 토스트를 띄운다 (흔들리며 뜨고, 카메라를 따라 커진 그대로 브리핑 화면에 0.7초 남았다가 사라진다) */
function tabletNote() {
  const bp = document.querySelector<HTMLElement>('main.ct.ct-top .ct-os'), j = jobOf();
  if (!bp || !j || CT.stamp !== 'ok' || bp.querySelector('.tnote')) return;
  bp.insertAdjacentHTML('beforeend', noteHtml(fieldTitle(j.field), ' ct-tnote'));
  requestAnimationFrame(() => bp.querySelector('.tnote')?.classList.add('in'));
  sfx('beep', { pitch: 1.4, gain: 0.6 });
}
/** 카메라가 표시기 화면 속으로 들어갈 때의 시야: 화면이 시야를 꼭 덮는 배율 Z, 시야가 되는 영역(화면 가로 가운데 · 위쪽 끝)의 화면 안 자리, 그 가운데의 페이지 좌표, 실제 기운 각 (휴대폰은 rotate: none) */
function camOf(scr: HTMLElement) {
  const W = innerWidth, H = innerHeight, sw = scr.offsetWidth, sh = scr.offsetHeight, Z = Math.max(W / sw, H / sh) * 1.002;
  const r = scr.getBoundingClientRect(), bp = scr.parentElement!, rot = ((parseFloat(getComputedStyle(bp).rotate) || 0) * Math.PI) / 180;
  const dy = H / Z / 2 - sh / 2; // 화면 가운데 → 시야 영역 가운데 (화면 좌표, 기운 각만큼 돌려 페이지로)
  return { W, H, Z, rot, ox: (sw - W / Z) / 2, cx: r.left + r.width / 2 - dy * Math.sin(rot), cy: r.top + r.height / 2 + dy * Math.cos(rot) };
}
/** 표시기 OS 층 (상태줄 · 알림): 카메라가 화면 속으로 들어갔을 때 시야가 되는 영역을 시야 크기 그대로 그리고 카메라 배율만큼 줄여 둔다.
 *  그래서 상태줄 · 토스트는 보드에서는 아주 작고(멀리서 보면 흔들림만 보인다), 컷 순간 브리핑 화면의 같은 것과 자리 · 크기가 같다 (startSeal 과 같은 camOf) */
function osFit(ct: HTMLElement) {
  const scr = ct.querySelector<HTMLElement>('.ct-bp-scr'), os = ct.querySelector<HTMLElement>('.ct-os');
  if (!scr || !os || !scr.offsetWidth) return;
  const c = camOf(scr);
  os.style.cssText = `--ow:${c.W}px;--oh:${c.H}px;--oz:${(1 / c.Z).toFixed(5)};--ox:${(scr.offsetLeft + c.ox).toFixed(2)}px;--oy:${scr.offsetTop}px`;
}
let osResize = false;
let sealNote: Note | null = null;
export function takeSealNote() { const n = sealNote; sealNote = null; return n; }
function startSeal(ct: HTMLElement) {
  CT.step = 'seal';
  sealGrid = null; sealNote = null;
  const scr = ct.querySelector<HTMLElement>('.ct-bp-scr');
  if (reduced() || !scr) { finish(); return; }
  const { W, H, Z, rot, cx, cy } = camOf(scr); // 표시기 화면이 시야를 꼭 덮는 배율 · 시야가 될 영역의 가운데
  // 진행도 e (0~1) 마다: 표시기 가운데가 화면 가운데로 곧게 · 기운 만큼 돌려 세우고 · 고르게 확대 (시간 곡선은 --ct-in 이 맡는다)
  const keys = Array.from({ length: 25 }, (_, i) => {
    const e = i / 24;
    return { transform: `translate(${cx + (W / 2 - cx) * e}px, ${cy + (H / 2 - cy) * e}px) rotate(${-rot * e}rad) scale(${Math.exp(Math.log(Z) * e)}) translate(${-cx}px, ${-cy}px)` };
  });
  ct.classList.add('sealing');
  const cam = ct.animate(keys, { duration: 950, easing: 'cubic-bezier(.8, 0, .55, 1)', fill: 'forwards' });
  sfx('paper', { pitch: 0.8 });
  cam.finished.then(() => {
    if (CT.step !== 'seal') return;
    const q = scr.getBoundingClientRect(), bw = parseFloat(getComputedStyle(scr).borderLeftWidth) || 0;
    sealGrid = { x: q.left + bw * Z, y: q.top + bw * Z, s: 16 * Z }; // .lp-bp 모눈: 테두리 안쪽 원점 · 16px 간격
    const nt = ct.querySelector<HTMLElement>('.ct-tnote.in');
    if (nt) { const b = nt.getBoundingClientRect(), k = parseFloat(getComputedStyle(nt).getPropertyValue('--k')) || 1, w = nt.offsetWidth / k; sealNote = { x: b.left, y: b.top, w, s: b.width / w }; } // 알림 토스트: --k 1 기준 폭과, 화면에 보이는 배율 (보드 --k × 카메라)
    finish();
  }).catch(() => {});
}

export function contractScreen(): string {
  if (CT.step === 'seal') return sealHtml();
  return boardHtml();
}

// ───────── 동작
/** 전표 한 묶음을 고쳐 찍는다 (되감기 · 인쇄 연출과 소리는 그린 뒤 feedSlip) */
function printed(group: string) { CT.last = group; }
const say = (a: string) => { const t = sayFor(a); if (t) CT.say = t; };
/** data-a="ct-*" 처리. 다시 그려야 하면 true */
/** 펜 체크가 바뀌는 중에 고르기를 연타한 시각 (1.5초 안에 3번이면 핀잔 + 새 차림표) */
let spam: number[] = [];
export function contractAct(a: string, v: string): boolean {
  const pick = ['ct-job', 'ct-plan', 'ct-rider', 'ct-rlv', 'ct-usual'].includes(a) && !CT.stamp;
  let swap = false;
  if (pick && penBusy()) {
    const now = performance.now();
    spam = spam.filter((t) => now - t < 1500);
    spam.push(now);
    if (spam.length >= 3 && now - CT.swapAt > SWAP) { swap = true; spam = []; CT.swapAt = now; }
  }
  const r = actOn(a, v);
  if (swap) { CT.say = sayFor('spam'); sfx('paper'); sfx('paper', { delay: 0.55, pitch: 0.9 }); return true; } // 차림표가 아래로 빠졌다가 새 것으로 올라온다
  return r;
}
function actOn(a: string, v: string): boolean {
  if (CT.stamp && a !== 'ct-leave' && a !== 'ct-skip') return false; // 도장이 찍히는 동안은 테이블을 만지지 않는다
  const wasReady = payable();
  const after = (r: boolean) => { if (r && !wasReady && payable() && !CT.say) say('ready'); return r; };
  switch (a) {
    case 'ct-job': {
      const j = v.startsWith('c:') ? (FIELDS.some((f) => f.id === v.slice(2)) ? orderOf(v.slice(2)) : null) : CT.jobs[+v.slice(1)];
      if (!j) return false;
      const same = !!CT.sel && CT.sel.kind === j.kind && CT.sel.field === j.field;
      CT.sel = same ? null : j; CT.focus = `job:${v}`; CT.say = '';
      if (CT.sel) printed('job'); else CT.last = '';
      return after(true);
    }
    case 'ct-off': CT.list = !CT.list; CT.focus = CT.list ? 'off' : ''; CT.last = ''; CT.say = ''; return true;
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
    case 'ct-rlv': { // 특약 단계 칸: 그 단계로 (지금 단계 칸이면 끄기)
      const [id, k] = v.split(':'), d = OATHS.find((o) => o.id === id);
      if (!d || !ridersOn()) return false;
      const s = oathSel(), n = oathLv({ oaths: s }, d.id), to = Math.max(0, Math.min(oathMax(d.id), +k || 0));
      s[d.id] = n === to ? 0 : to;
      metaOath(s);
      CT.focus = `rider:${d.id}`; CT.say = '';
      if (s[d.id]) printed(`rider:${d.id}`); else CT.last = '';
      return true;
    }
    case 'ct-bell': { // 벨: 전표에 '승인' 도장 → 그늘 → 명부
      if (!payable()) { hooks.toast('의뢰와 약관을 먼저 고르세요.'); return false; }
      clear();
      CT.stamp = 'ok'; CT.last = ''; say('ok');
      sfx('bell'); sfx('knock', { delay: 0.25, pitch: 0.8 });
      const go = () => {
        if (CT.stamp !== 'ok') return;
        if (paper.run) { later(120, go); return; } // 전표를 다 찍은 뒤에 (되감는 도중이면 반쯤 찍힌 종이가 날아간다)
        const ct = document.querySelector<HTMLElement>('main.ct.ct-top');
        if (!ct) { CT.step = 'seal'; finish(); return; }
        const t = handTake(ct); // 에이든이 전표를 집고 0.2초 멈췄다가 들고 간다
        later(t, tabletNote); // 손이 빠져나가면 표시기에 예레나의 브리핑 알림 (토스트: 카메라를 따라 커진 채 태블릿 화면에 잠깐 남는다)
        later(t + NOTE_WAIT, () => { if (CT.stamp === 'ok') startSeal(ct); }); // 알림을 잠깐 보여 준 뒤 카메라가 표시기로
      };
      later(600, go); // 도장 → 출력기가 전표를 짧게 밀어낸다 (서명의 결과물이 손에 들어온 감각) → 에이든의 손 → 알림 → 카메라
      return true;
    }
    case 'ct-cancel': { // 의뢰 취소: '취소' 도장 → 전표가 바깥으로 미끄러져 나가고 고른 것이 비워진다 (테이블은 그대로)
      if (!jobOf()) return false;
      clear();
      CT.stamp = 'void'; CT.last = ''; say('void');
      sfx('knock', { pitch: 0.75 }); sfx('paper', { delay: 0.45 });
      later(reduced() ? 300 : 1200, () => { Object.assign(CT, { stamp: '', sel: null, focus: '', last: '', list: false }); paper.rows = []; hooks.render(); }); // 던진 종이는 출력기에 없다
      return true;
    }
    case 'ct-skip': finish(); return false;
    case 'ct-leave': { // 나가기: 들어올 때의 길을 거꾸로 (종이 · 소품이 빠지고 → 테이블이 낮아지며 바 그림이 다시 내려온다) 뒤에 바 · 타이틀로
      clear();
      const ct = document.querySelector<HTMLElement>('main.ct');
      if (!ct || reduced() || CT.from !== 'bar') { hooks.leave(CT.from); return false; }
      ct.querySelector('.ct-barview')?.remove();
      ct.insertAdjacentHTML('afterbegin', barviewHtml());
      ct.classList.remove('intro'); ct.classList.add('outro');
      sfx('paper'); sfx('paper', { delay: 0.12, pitch: 0.9 });
      later(1900, () => hooks.leave(CT.from)); // 종이 빠짐 0.45 → 테이블 · 바 1.0 → 세로 띠 튕겨 들어옴 0.5
      return false;
    }
  }
  return false;
}
/** 청사진만 바꾼다 (가리키기) */
function refreshInfo() {
  const el = document.querySelector<HTMLElement>('.ct-bp-scr'), h = infoHtml();
  if (!el || h === scr.last) return;
  scr.last = h; el.innerHTML = h;
  blink();
}
/** 도면 표시기: 마지막으로 띄운 내용 · 그린 뒤 깜빡일지 · 최근 전환 시각 (자주 바꾸면 이스터에그) · 마지막 이스터에그 시각 */
const scr = { last: '', blink: false, hits: [] as number[], egg: 0 };
/** 내용이 바뀔 때 화면이 한 번 검게 꺼졌다 켜진다. 4초 안에 7번 넘게 바꿔 대면 가끔 꺼진 검은 화면에 밍키 얼굴이 비친다 */
function blink() {
  const bp = document.querySelector<HTMLElement>('.ct-bp');
  if (!bp || reduced()) return;
  const now = performance.now();
  scr.hits = scr.hits.filter((t) => now - t < 4000);
  scr.hits.push(now);
  const egg = scr.hits.length >= 7 && now - scr.egg > 8000 && Math.random() < 0.35;
  if (egg) { scr.egg = now; scr.hits = []; }
  bp.classList.remove('blink', 'mk');
  void bp.offsetWidth; // 같은 애니메이션을 다시 건다
  bp.classList.add('blink');
  if (egg) bp.classList.add('mk');
}
/** 그늘 연출 끝 → 명부 */
function finish() {
  clear();
  const s = signedContract();
  if (!s) { contractBack(); hooks.render(); return; }
  CT.fromSeal = true;
  hooks.roster(s);
}

/** 벨을 끌어 화면 가장자리 밖으로 내보내면 (벨 가운데가 가장자리에 닿거나, 끄는 손이 가장자리 끝에 닿으면) 의뢰 취소. 안쪽에서 놓으면 제자리 (오른쪽 끝) 로 돌아간다 */
function bellDrag(ct: HTMLElement) {
  const bell = ct.querySelector<HTMLElement>('.ct-bell.on');
  if (!bell || CT.stamp) return;
  let x0 = 0, y0 = 0, px = 0, py = 0, id = -1, moved = false;
  const outside = () => {
    const r = bell.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, m = r.width * 0.2, e = 8;
    return cx < m || cx > innerWidth - m || cy < m || cy > innerHeight - m || px < e || px > innerWidth - e || py < e || py > innerHeight - e;
  };
  bell.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; id = e.pointerId; moved = false;
    bell.setPointerCapture(id); // 손이 벨 밖으로 빨리 나가도 계속 따라오게
  });
  bell.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    px = e.clientX; py = e.clientY;
    if (!moved && Math.hypot(dx, dy) < 8) return;
    if (!moved) { moved = true; bell.classList.add('drag'); bell.classList.remove('in', 'back'); }
    bell.style.setProperty('--dx', `${dx}px`); bell.style.setProperty('--dy', `${dy}px`);
    bell.classList.toggle('leaving', outside());
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!moved) return;
    bell.classList.remove('drag');
    if (outside() && jobOf()) { CT.bell = false; if (contractAct('ct-cancel', '')) hooks.render(); return; } // 이미 화면 밖이니 빠지는 연출 없이
    bell.classList.remove('leaving'); bell.classList.add('back');
    bell.style.setProperty('--dx', '0px'); bell.style.setProperty('--dy', '0px');
  };
  bell.addEventListener('dragstart', (e) => e.preventDefault()); // 벨 그림(img)의 브라우저 기본 끌기가 pointercancel 로 끌기를 끊지 않게
  bell.addEventListener('pointerup', end);
  bell.addEventListener('pointercancel', end);
  bell.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }); // 끈 것은 누름이 아니다
}
/** Esc: 덮인 종이(메뉴에 없는 의뢰)를 내린다. 문서에 한 번만 건다 */
let escOn = false;
function escSheets() {
  if (escOn) return;
  escOn = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || CT.step !== 'board' || CT.stamp || !document.querySelector('main.ct')) return;
    if (!document.querySelector('.ct-offsheet:not(.out)')) return;
    CT.list = false; CT.focus = '';
    hooks.render();
  });
}
/** 종이를 아래로 쓸어 내리면 빠진다: 손을 따라 내려가다가, 1/4 넘게 내리거나 세게 내리면 빠지고 아니면 제자리로. 누름과 구분하려고 8px 넘게 움직인 뒤부터 끈다 */
function swipeDown(ct: HTMLElement, sel: string, k: string, close: () => void) {
  const el = ct.querySelector<HTMLElement>(`${sel}:not(.out)`);
  if (!el) return;
  let y0 = 0, t0 = 0, id = -1, dy = 0, moved = false;
  el.addEventListener('pointerdown', (e) => { if (e.button !== 0 || CT.stamp) return; y0 = e.clientY; t0 = performance.now(); id = e.pointerId; dy = 0; moved = false; });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    dy = e.clientY - y0;
    if (!moved && Math.abs(dy) < 8) return;
    if (!moved) { moved = true; el.setPointerCapture(id); el.classList.remove('in'); el.classList.add('drag'); }
    el.style.translate = `0 ${dy > 0 ? dy : dy / 4}px`; // 위로는 조금만 (끌려 올라가지 않는다)
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!moved) return;
    el.classList.remove('drag');
    if (dy > el.offsetHeight / 4 || (dy > 30 && dy / (performance.now() - t0) > 0.6)) { dragY[k] = Math.max(0, dy); close(); hooks.render(); return; }
    el.style.translate = '';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true); // 끈 것은 누름이 아니다 (줄 위에서 시작해도)
}
/** el 에서 ct 까지 올라가며 dir 쪽 (1 = 내용이 아래로, -1 = 위로) 으로 더 스크롤할 칸이 있는지 */
function canScroll(el: Element | null, ct: HTMLElement, dir: number) {
  for (let n = el as HTMLElement | null; n && n !== ct.parentElement; n = n.parentElement) {
    if (n.scrollHeight <= n.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(n).overflowY)) continue;
    if (dir > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
  }
  return false;
}
/** 바로 돌아가기 몸짓: 화면을 위로 세게 쓸어 올리거나 (터치) 세게 굴리면 (휠). 목록 · 도면이 아직 스크롤되는 동안은 스크롤만 한다 */
function leaveGesture(ct: HTMLElement) {
  const go = () => { if (CT.step === 'board' && !CT.stamp && !ct.classList.contains('outro')) contractAct('ct-leave', ''); };
  let ty = 0, tx = 0, tt = 0, tScroll = true;
  ct.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || (e.target as HTMLElement).closest('.ct-bell')) { tScroll = true; return; }
    const t = e.touches[0]; ty = t.clientY; tx = t.clientX; tt = performance.now();
    tScroll = canScroll(e.target as Element, ct, 1);
  }, { passive: true });
  ct.addEventListener('touchend', (e) => {
    if (tScroll) return;
    const t = e.changedTouches[0], dy = ty - t.clientY, dx = Math.abs(t.clientX - tx), ms = performance.now() - tt;
    if (dy > 120 && dx < dy * 0.6 && dy / ms > 0.5) go();
  }, { passive: true });
  // 휠: 스크롤할 칸이 없는 데서 시작한 한 번의 세찬 굴림 (0.3초 쉬면 새 굴림). 목록을 굴리다 끝에 닿은 관성은 세지 않는다
  let sum = 0, last = 0, dir = 0, dead = false;
  ct.addEventListener('wheel', (e) => {
    const now = performance.now(), d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1), sd = Math.sign(d);
    if (!sd) return;
    if (now - last > 300 || sd !== dir) { sum = 0; dead = false; dir = sd; }
    last = now;
    if (dead || canScroll(e.target as Element, ct, sd)) { dead = true; return; }
    sum += Math.abs(d);
    if (sum > 900) { dead = true; go(); }
  }, { passive: true });
}
/** 그린 뒤 (main.ts render): 등장 연출 · 가리키기 → 청사진 · 목소리 사라짐 · 그늘 연출 시간표 */
/** 카메라를 그늘 연출의 끝(표시기 화면이 시야를 채운 자리)에 두고 거꾸로 물러난다 → 잠깐 테이블 → 바로 올라간다 */
function returnZoom(ct: HTMLElement) {
  const scr = ct.querySelector<HTMLElement>('.ct-bp-scr');
  if (!scr) { contractAct('ct-leave', ''); return; }
  const { W, H, Z, rot, cx, cy } = camOf(scr);
  const keys = Array.from({ length: 25 }, (_, i) => {
    const e = 1 - i / 24;
    return { transform: `translate(${cx + (W / 2 - cx) * e}px, ${cy + (H / 2 - cy) * e}px) rotate(${-rot * e}rad) scale(${Math.exp(Math.log(Z) * e)}) translate(${-cx}px, ${-cy}px)` };
  });
  ct.classList.add('sealing', 'returning');
  const cam = ct.animate(keys, { duration: 1000, easing: 'cubic-bezier(.3, 0, .2, 1)', fill: 'forwards' });
  sfx('paper', { pitch: 0.7 });
  cam.finished.then(() => {
    if (!ct.isConnected) return;
    cam.cancel(); ct.classList.remove('sealing', 'returning');
    later(450, () => contractAct('ct-leave', '')); // 테이블을 잠깐 보여 주고 바로 (들어올 때의 길을 거꾸로)
  }).catch(() => {});
}
export function contractMount(root: HTMLElement) {
  const ct = root.querySelector<HTMLElement>('main.ct');
  if (!ct) return;
  osFit(ct);
  if (!osResize) { osResize = true; addEventListener('resize', () => { const c = document.querySelector<HTMLElement>('main.ct.ct-top'); if (c && !c.classList.contains('sealing')) osFit(c); }, { passive: true }); }
  if (CT.ret) { CT.ret = false; returnZoom(ct); }
  if (CT.step === 'board') {
    if (CT.intro) { CT.intro = false; if (!reduced()) { sfx('paper', { delay: 0.8 }); sfx('paper', { delay: 1.05, pitch: 0.9 }); } window.setTimeout(() => ct.querySelector('.ct-barview')?.remove(), 1700); }
    const menu = ct.querySelector<HTMLElement>('.ct-menu');
    const point = (e: Event) => {
      if (e.type === 'pointerover' && (e as PointerEvent).pointerType !== 'mouse') return; // 터치 · 펜은 미리보기 없이 바로 누름 (iPad Safari 는 첫 탭에 화면이 바뀌면 그 탭을 '호버'로 삼아 두 번 눌러야 한다)
      if (e.type === 'focusin' && !(e.target as HTMLElement).matches(':focus-visible')) return; // 다시 그린 뒤 되돌아온 초점(터치 · 클릭)이 도면을 옛 줄로 되돌리지 않게
      const f = (e.target as HTMLElement).closest<HTMLElement>('[data-f]')?.dataset.f;
      if (f && f !== CT.focus) { CT.focus = f; refreshInfo(); }
    };
    for (const el of [menu, ...Array.from(ct.querySelectorAll<HTMLElement>(':is(.ct-riders, .ct-offsheet):not(.out)'))]) { el?.addEventListener('pointerover', point); el?.addEventListener('focusin', point); }
    escSheets();
    if (scr.blink) { scr.blink = false; blink(); }
    swipeDown(ct, '.ct-offsheet', 'ls', () => { CT.list = false; CT.focus = ''; });
    bellDrag(ct);
    leaveGesture(ct);
    if (CT.last) later(1200, () => { CT.last = ''; });
    // 전표를 고쳐 찍고, 다 밀려 나온 뒤 화면 위 끝을 넘었는지 잰다 (특약 6건 이상으로 넘기거나 (높이 제한 없는 배치에서), 큰 화면이라 안 넘어가도 12건 이상이면)
    feedSlip(ct, () => {
      const sl = ct.querySelector<HTMLElement>('.ct-slip'), n = ridersOn() ? oathsOn(oathSel()).length : 0;
      const over = !!sl && sl.getBoundingClientRect().top < 0 && getComputedStyle(ct.querySelector('.ct-slipwrap')!).overflow !== 'hidden';
      if ((over && n >= 6) || n >= 12) hooks.receipt(n);
    });
    if (CT.say) { const said = CT.say; later(CT.stamp ? 6000 : 4200, () => { if (CT.say === said) { CT.say = ''; ct.querySelector('.ct-voice')?.classList.remove('on'); } }); }
    return;
  }
  if (CT.step !== 'seal') return;
  clear(); // 그늘 도중에 다시 그려졌다 (대체 화면) → 바로 명부로
  later(300, finish);
}
