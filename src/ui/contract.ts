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
import { chainScene } from './chains';
import { starField } from './themefx';
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
  /** 도면 · 차림표가 놓인 각도 (열 때마다 조금씩 다르게) */
  /** 놓인 각도: 도면 · 차림표 · 출력기 · 특약 차림표 · 메뉴에 없는 의뢰 */
  rot: { bp: 0, mn: 0, pr: 0, rd: 0, ls: 0 },
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
  Object.assign(CT, { step: 'board', from, sel: null, list, vet: n > 0, lit: false, focus: '', last: '', stamp: '', intro: true, bell: false, swapAt: -1e9, fromSeal: false, say: '오늘 들어온 의뢰서입니다. 제철이라 조금 더 쳐 드리죠.' });
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
  const ok = payable(), heat = heatNow(), lit = CT.lit, info = infoHtml(), swEl = Math.round(performance.now() - CT.swapAt);
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
    <button class="ct-leave lp-btn" data-a="ct-leave" aria-label="${leave}" title="${leave} (화면을 위로 쓸어 올려도 된다)">${UP_SVG}</button>
    <p class="ct-voice${CT.say ? ' on' : ''}" aria-live="polite"><b>에이든</b><span>${esc(CT.say)}</span></p>
    <section class="ct-bp" aria-label="의뢰 도면 (표시기)"><div class="ct-bp-scr lp-bp" aria-live="polite">${info}</div><i class="ct-blank" aria-hidden="true"><img class="ct-mk" alt="" src="${artURL('mingki.bust.webp')}" decoding="async" onerror="this.remove()"></i><i class="ct-led" aria-hidden="true"></i></section>
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
/** 벨을 누른 순간 전표가 있던 자리 (날아가는 전표가 거기서 떠올라 가운데로 확대된다) */
let flyFrom: { x: number; y: number; w: number } | null = null;
function sealHtml() {
  const f = flyFrom, fw = Math.min(380, innerWidth * 0.8);
  const from = f ? `${Math.round(f.x - innerWidth / 2)} ${Math.round(f.y - innerHeight * 0.12)} ${(f.w / fw).toFixed(3)}` : '0 0 1';
  return `<main class="ct ct-seal${CT.vet ? ' quick' : ''}" data-a="ct-skip" aria-label="그늘 — 누르면 넘깁니다">
    <div class="ct-table" aria-hidden="true">${prop('ct_table', '')}</div><div class="ct-dark" aria-hidden="true"></div><div class="lp-grain" aria-hidden="true"></div>
    <div class="ct-sky" aria-hidden="true"></div>
    <i class="ct-tail lp-carbon" aria-hidden="true"><i class="ct-glow"></i><i class="ct-pulse"></i></i>
    <div class="ct-fly lp-carbon" data-from="${from}" aria-hidden="true">${slipHtml()}<i class="ct-stampmark ok">승인</i><i class="ct-glow"></i></div>
    <i class="ct-glint" aria-hidden="true"></i>
    <canvas class="ct-chains" aria-hidden="true"></canvas>
    <div class="ct-watch" aria-hidden="true">
      <svg viewBox="0 0 140 150" aria-hidden="true">
        <g transform="translate(10 0)">
          <circle class="ct-bow" cx="60" cy="10" r="9"/>
          <circle class="ct-case" cx="60" cy="84" r="60"/><circle class="ct-rim" cx="60" cy="84" r="56"/>
          <circle class="ct-enamel-o" cx="60" cy="84" r="51"/><circle class="ct-enamel" cx="60" cy="84" r="41"/>
          ${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6, r1 = i % 3 ? 45 : 42; return `<line class="ct-tick" x1="${(60 + Math.sin(a) * r1).toFixed(1)}" y1="${(84 - Math.cos(a) * r1).toFixed(1)}" x2="${(60 + Math.sin(a) * 49).toFixed(1)}" y2="${(84 - Math.cos(a) * 49).toFixed(1)}"/>`; }).join('')}
          <line class="ct-hh" x1="60" y1="84" x2="78" y2="72"/><g class="ct-hand"><line class="ct-mh" x1="60" y1="84" x2="60" y2="40"/></g><circle class="ct-pin" cx="60" cy="84" r="4"/>
        </g>
      </svg>
    </div>
    <canvas class="ct-chains front" aria-hidden="true"></canvas>
    <p class="ct-load"><span>계약 기물 명부를 펼치는 중</span><i>.</i><i>.</i><i>.</i></p>
    <p class="ct-skip-k">누르면 넘깁니다</p>
    <div class="ct-beat" aria-hidden="true"></div>
  </main>`;
}

/** 날아가는 전표 (카메라 연출):
 *  ① 클로즈업: 출력기 자리에서 떠올라 가운데로 확대된다.
 *  ② 종이가 위로 끝없이 끌려 올라간다 — 느리게 시작해 점점 빨라져 전표가 화면 위로 완전히 빠져나간다 (아래로 이어진 종이는 계속 지나간다).
 *  ③ 카메라가 뒤늦게 따라붙으며 빠르게 줌 아웃 (처음 빠르게, 점점 느리게) → 전표가 위에서 작게 다시 들어오고, 종이는 얇은 한 줄기 빛이 된다.
 *  ④ 줌 아웃 뒤에도 멈추지 않는다: 빛줄기 끝(전표)이 계속 위로 올라가고, 빛 마디가 줄기를 타고 올라간다. 끝이 닿는 자리에서 섬광.
 *  꼬리는 매 프레임 전표 밑변에서 화면 아래 끝까지 같은 너비로 잇는다 (곧게 끊김 없이).
 *  매 프레임 시각의 함수로 한 번에 계산한다 (프레임이 밀려도 같은 곡선. 구간 키프레임을 이어 붙이면 꺾이는 데마다 툭툭 끊겨 보인다). 단골은 같은 연출을 0.48배 시간으로 */
function flyUp(fly: HTMLElement, tail: HTMLElement, glint: HTMLElement | null, quick: boolean) {
  const [fx, fy, fs] = (fly.dataset.from || '0 0 1').split(' ').map(Number);
  const SC = quick ? 0.48 : 1, S0 = 1.3, ZMIN = 0.026, H = innerHeight;
  const IN = 0.75, RISE = 0.8, ZOOM = 1.2, GLINT = 2.4, END = 2.62; // 시각 (초, 단골은 × SC)
  const glows = [fly, tail].map((e) => e.querySelector<HTMLElement>('.ct-glow')), pulse = tail.querySelector<HTMLElement>('.ct-pulse');
  const top = fly.offsetTop, h = fly.offsetHeight;
  tail.style.width = `${fly.offsetWidth}px`;
  tail.style.height = `${H * 3}px`; // 전표가 화면 위로 멀리 나가도 꼬리가 화면 아래 끝까지 닿게
  const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
  /** ② 종이가 끌려 올라간 거리 (px): 0.3초 동안 점점 빨라져 2600px/초, 그 뒤로도 조금씩 더 빨라진다 */
  const pulled = (t: number) => { const u = t - RISE; if (u <= 0) return 0; if (u < 0.3) return (2600 * u ** 3) / 0.27; const w = u - 0.3; return 260 + 2600 * w + 800 * w * w; };
  /** ③④ 줌 아웃 뒤 전표(빛줄기 끝)의 화면 높이: 위에서 내려와 자리를 잡고, 그 뒤로 점점 빠르게 위로 올라간다 */
  const after = (u: number) => H * (0.32 - 0.155 * u - 0.035 * u * u);
  const y0 = top - S0 * pulled(ZOOM); // 줌 아웃이 시작될 때 전표 자리 (화면 위 밖)
  const t0 = performance.now();
  const frame = (now: number) => {
    if (!fly.isConnected) return;
    const t = (now - t0) / 1000 / SC;
    let x = 0, hy = top, z = S0;
    if (t < IN) { const k = t / IN, e = k * k * (3 - 2 * k); x = fx * (1 - e); hy = top + fy * (1 - e); z = fs + (S0 - fs) * e; } // ① 클로즈업
    else if (t < ZOOM) hy = top - S0 * pulled(t); // ② 카메라는 그대로, 종이만 위로
    else { const u = t - ZOOM; z = ZMIN + (S0 - ZMIN) * Math.exp(-u / 0.17); hy = after(u) + (y0 - after(0)) * Math.exp(-u / 0.13); } // ③④
    const g = Math.log(S0 / z) / Math.log(S0 / ZMIN), glow = 0.62 * smooth((g - 0.35) / 0.55), op = 1 - smooth((t - GLINT) / (END - GLINT));
    fly.style.transform = `translate(calc(-50% + ${x}px), ${hy - top}px) scale(${z})`;
    tail.style.transform = `translate(calc(-50% + ${x}px), ${hy + h * z - 1}px) scale(${z}, 1)`;
    fly.style.opacity = tail.style.opacity = String(op);
    glows.forEach((e) => { if (e) e.style.opacity = String(glow); });
    if (pulse) { pulse.style.opacity = String(smooth((g - 0.5) / 0.4)); pulse.style.transform = `translateY(${-((t * 720) % 180)}px)`; } // 빛 마디가 줄기를 타고 올라간다
    if (glint && t <= GLINT) glint.style.top = `${Math.max(24, hy)}px`; // 섬광은 빛줄기 끝이 닿는 자리에서
    if (t < END) requestAnimationFrame(frame);
  };
  frame(t0); // 첫 그림부터 출력기 자리에서 (확대된 모습이 한 번 비치지 않게)
}

/** 그늘 장면의 은하 하늘: 에란테스 갤럭시 테마의 바탕색 + 별빛 층과 같은 별무리 (지금 테마 · 연출 설정과 상관없이) */
function galaxySky(el: HTMLElement) {
  const probe = document.createElement('i');
  probe.setAttribute('data-ui-theme', 'galaxy');
  probe.hidden = true;
  document.body.appendChild(probe);
  el.style.background = getComputedStyle(probe).getPropertyValue('--bg').trim();
  probe.remove();
  starField(el);
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
      later(reduced() ? 400 : CT.vet ? 900 : 1300, () => {
        if (CT.stamp !== 'ok') return;
        const sl = document.querySelector<HTMLElement>('.ct-slip')?.getBoundingClientRect();
        flyFrom = sl && sl.width ? { x: sl.left + sl.width / 2, y: Math.max(0, sl.top), w: sl.width } : null;
        CT.step = 'seal'; hooks.render();
      });
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
export function contractMount(root: HTMLElement) {
  const ct = root.querySelector<HTMLElement>('main.ct');
  if (!ct) return;
  if (CT.step === 'board') {
    if (CT.intro) { CT.intro = false; if (!reduced()) { sfx('paper', { delay: 0.8 }); sfx('paper', { delay: 1.05, pitch: 0.9 }); } window.setTimeout(() => ct.querySelector('.ct-barview')?.remove(), 1700); }
    const menu = ct.querySelector<HTMLElement>('.ct-menu');
    const point = (e: Event) => {
      if (e.type === 'focusin' && !(e.target as HTMLElement).matches(':focus-visible')) return; // 다시 그린 뒤 되돌아온 초점(터치 · 클릭)이 도면을 옛 줄로 되돌리지 않게
      const f = (e.target as HTMLElement).closest<HTMLElement>('[data-f]')?.dataset.f;
      if (f && f !== CT.focus) { CT.focus = f; refreshInfo(); }
    };
    for (const el of [menu, ...Array.from(ct.querySelectorAll<HTMLElement>(':is(.ct-riders, .ct-offsheet):not(.out)'))]) { el?.addEventListener('mouseover', point); el?.addEventListener('focusin', point); }
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
  clear();
  if (reduced()) { later(900, finish); return; }
  // 처음: 0 전표(원본 그대로)가 출력기 자리에서 떠올라 가운데로 확대 → 0.8 위로 끌려 올라가 1.15 화면 밖으로 → 1.2 카메라가 뒤늦게 따라붙으며 빠르게 줌 아웃 (한 줄기 빛, 계속 올라간다. flyUp)
  //   → 1.8 은하 하늘 → 2.3 빛 줄기가 사라지는 자리에서 섬광 → 2.5~3.4 체인 · 회중시계가 살랑이며 내려온다 → 4.1 심장 박동 → 4.9~5.7 끌려 올라간다 → 6.4 명부 (카드)
  // 두 번째부터 (CSS .quick): 같은 순서를 3.1초로 압축 — 의식은 처음에만 길다
  const t = CT.vet ? [1200, 2000, 2500, 3100] : [2500, 4100, 5300, 6400];
  const sky = ct.querySelector<HTMLElement>('.ct-sky');
  if (sky) galaxySky(sky);
  // 체인 · 회중시계는 물리로 (ui/chains.ts): 체인마다 무작위 순서 · 시각에 나타나고, 무작위 시각에 끌려 올라간다
  const cv = ct.querySelector<HTMLCanvasElement>('canvas.ct-chains:not(.front)');
  const sc = cv ? chainScene(cv, ct.querySelector<HTMLCanvasElement>('canvas.ct-chains.front'), ct.querySelector<HTMLElement>('.ct-watch'), CT.vet
    ? { win: [1.2, 1.55], wout: [2.3, 2.75], watchIn: 1.25, watchOut: 2.5 }
    : { win: [2.5, 3.4], wout: [4.9, 5.7], watchIn: 2.7, watchOut: 5.3 }) : null;
  later(CT.vet ? 1150 : 2400, () => sfx('despair', { pitch: 1.4 })); // 섬광
  const fly = ct.querySelector<HTMLElement>('.ct-fly'), tail = ct.querySelector<HTMLElement>('.ct-tail');
  if (fly && tail) flyUp(fly, tail, ct.querySelector<HTMLElement>('.ct-glint'), CT.vet);
  sfx('paper');
  later(t[0], () => sfx('chain'));
  later(t[1], () => { ct.classList.add('beat'); sc?.pulse(); sfx('heart'); sfx('despair'); });
  later(t[2], () => { ct.classList.add('lift'); sfx('chain'); });
  later(t[3], finish);
}
