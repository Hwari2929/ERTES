// 런 결과 화면: 전투 종료 보고서 (main.ts overScreen 이 부른다). 기록 · 기준선 계산은 engine/report.ts, 여기는 그리기만.
//   구성: 머리(작전명 · 전장 · 위험 등급 · 결과 도장 · 일자 · 페이즈 · 전투 수) → 핵심 수치 → 기물별 영향력 → 전투력 추이 · 경제 → 기록 (메타 · 절망 · 업적 · 최종 편성)
//   승리 · 패배는 도장 · 색 · 문구만 다르고 구조는 같다 (.aar.win / .aar.lose). 색은 테마 토큰만 (style.css '전투 종료 보고서').
//   전투력 그래프: 축 하나 (실제 · 예상 같은 단위). 선은 늘어나는 SVG(preserveAspectRatio none + non-scaling-stroke), 눈금 글자는 HTML 로 얹어 폭이 바뀌어도 글자 크기가 그대로.
import { CFG } from '../config';
import { ACH_BY_ID } from '../data/achievements';
import { fieldOf } from '../data/battlefields';
import { despairsOf } from '../data/despair';
import { UNIT_BY_ID } from '../data/units';
import { economy, expBasis, expInterest, expSource, expPower, influence, rec, SPEND_NAME, SUPPORT_PARTS, type BattleRec, type Influence } from '../engine/report';
import { NODE_NAME, type RunState } from '../types';
import { medalSvg } from './achieve';
import { fmt } from './battleview';
import { loadMeta } from './meta';
import { oathResult } from './oath';
import { hasPortrait, iconURL } from './portraits';
import { lineIcon } from './synicons';

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pct = (x: number) => (x > 0 && x < 0.005 ? '<1%' : `${Math.round(x * 100)}%`);
const sec = (s: number) => `${fmt(Math.round(s))}초`;
const sprite = (defId: string) => { const d = UNIT_BY_ID[defId]; return d ? `<img class="spr${hasPortrait(d) ? ' pt' : ''}" alt="" src="${iconURL(d)}">` : ''; };
const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tip = (s: string) => `<span class="aar-tip" title="${esc(s)}" tabindex="0" aria-label="${esc(s)}">ⓘ</span>`;

/** 작전명: 시드로 정하는 두 낱말 (같은 런은 늘 같은 이름) */
const OP_A = ['잿빛', '붉은', '고요한', '부서진', '늦은', '검은', '푸른', '먼', '은빛', '깊은', '흐린', '마지막', '녹슨', '젖은', '꺼진', '새벽의'];
const OP_B = ['등대', '항로', '닻', '별무리', '파도', '나침반', '유성', '봉화', '항적', '돛', '성좌', '방파제', '등불', '궤도', '해협', '여울'];
const opName = (seed: number) => { const s = Math.abs(seed | 0); return `${OP_A[s % OP_A.length]} ${OP_B[(s >>> 5) % OP_B.length]}`; };
const opCode = (seed: number) => `ERR-${String(Math.abs(seed | 0) % 100000).padStart(5, '0')}`;

export interface ReportOpts {
  /** 위험 등급 표기 (main.ts 가 한 곳에서 만든다) */
  risk: string;
  /** 예전 결과 화면의 한 줄 요약 (의뢰 성공 · 무너진 페이즈 · 위험 등급 · 절망 증강 · 절망 서약) */
  summary: string;
  /** 최종 편성 (main.ts rosterRow) */
  roster: string;
  /** 공명 등급 표기 */
  rank: (n: number) => string;
  /** 하단 버튼 줄 */
  actions: string;
}

export function reportScreen(run: RunState, o: ReportOpts) {
  const win = !!run.cleared;
  const r = rec(run);
  const f = fieldOf(run.field);
  const inf = influence(r);
  const eco = economy(run);
  const last = r.b[r.b.length - 1];
  const lastExp = last ? expPower(last.p, last.s, run.diff) : 0;
  const ratio = last && lastExp > 0 ? last.pw / lastExp : 0;
  const battles = run.stats.wins + run.stats.losses;
  const meta = [
    ['전장', `<b style="--c:${f.color}" class="aar-field">${f.icon} ${esc(f.name)}</b>`],
    ['위험 등급', `<b>${esc(o.risk)}</b>`],
    ['보고 일자', `<b class="mono">${ymd(r.t1 ?? Date.now())}</b>`],
    ['도달 페이즈', `<b class="mono">${run.phase}</b>${run.endless ? '<small> 무한 모드</small>' : ''}`],
    ['소요 전투', `<b class="mono">${battles}</b><small> ${run.stats.wins}승 ${run.stats.losses}패</small>`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const kpi = [
    { k: '전투력 · 예상 대비', v: last ? pct(ratio) : '—', s: last ? `끝 시점 ${fmt(last.pw)} · 예상 ${fmt(lastExp)}` : '전투 기록 없음', cls: last ? (ratio >= 1 ? 'is-up' : 'is-down') : '', main: true, t: `마지막 전투의 파티 전투력 ÷ 같은 페이즈 · 칸의 예상치. ${POWER_DEF} ${expBasis(run.diff)}` },
    { k: '평균 이자 수입', v: eco.n ? eco.avg.toFixed(1) : '—', s: eco.n ? `예상 ${eco.exp.toFixed(1)} · ${eco.exp > 0 ? pct(eco.avg / eco.exp) : '—'}` : '전투 기록 없음', cls: eco.n && eco.exp > 0 ? (eco.avg >= eco.exp ? 'is-up' : 'is-down') : '', t: `전투 ${eco.n}회의 이자 평균 ÷ 같은 페이즈 봇 전투의 평균 이자 — ${expSource(run.diff)}` },
    { k: '처치', v: fmt(run.stats.kills), s: `전투당 ${battles ? (run.stats.kills / battles).toFixed(1) : '0'}`, t: '' },
    { k: '최대 단일 피해', v: fmt(run.stats.bestHit), s: '한 번에 준 가장 큰 피해', t: '' },
  ].map((x) => `<div class="aar-kpi${'main' in x ? ' is-main' : ''}${'cls' in x && x.cls ? ` ${x.cls}` : ''}"${x.t ? ` title="${esc(x.t)}"` : ''}><small>${x.k}</small><b class="mono">${x.v}</b><span>${x.s}</span></div>`).join('');
  const note = r.from > 1 ? `<p class="aar-note">${lineIcon('r.more', 'li')}이 런은 보고서 기록이 생기기 전 저장에서 이어져, 페이즈 ${r.from}부터의 기록만 담겼습니다.</p>` : '';
  return `<main class="wrap over aar ${win ? 'win' : 'lose'}">
    <article class="aar-doc" aria-label="전투 종료 보고서">
      <header class="aar-head">
        <div class="aar-kicker"><span>ERRANTEs 용병단 · 전투 종료 보고서</span><span class="mono">${opCode(run.seed)}</span></div>
        <div class="aar-title"><small>작전명</small><h1>「${opName(run.seed)}」</h1></div>
        <div class="aar-stamp" role="img" aria-label="결과: ${win ? '의뢰 성공' : '계약 종료'}"><b>${win ? '의뢰 성공' : '계약 종료'}</b><small>${win ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}</small></div>
        <dl class="aar-meta">${meta}</dl>
        <p class="aar-sum">${o.summary}</p>
      </header>
      ${note}
      <section class="aar-kpis" aria-label="핵심 수치">${kpi}</section>
      <div class="aar-grid">
        ${impactSection(run, inf, o)}
        ${powerSection(run, r.b, ratio, last, lastExp)}
        ${econSection(run, eco)}
        ${recordSection(run, o)}
      </div>
    </article>
    <div class="sticky-actions">${o.actions}</div>
  </main>`;
}

const secHead = (n: number, title: string, extra = '') => `<h2 class="aar-h"><span class="aar-n mono">${String(n).padStart(2, '0')}</span>${title}${extra}</h2>`;

// ───────── 1. 기물별 영향력
const AXES = [
  { k: 'dmg', name: '전투', sub: '가한 피해', head: '가한 피해 · 소환물 포함', ic: 'a.dmg' },
  { k: 'heal', name: '회복', sub: '회복량', head: '회복량 · 소환물 포함', ic: 'a.heal' },
  { k: 'sup', name: '서포팅', sub: '보호막 · 제어 · 탱킹 · 버프', head: '보호막 · 제어 · 탱킹 · 버프 · 소환물 포함', ic: 'a.shield' },
] as const;
type AxisK = (typeof AXES)[number]['k'];
const supParts = (x: Influence) => SUPPORT_PARTS.filter((p) => x.r[p.k] >= 1).map((p) => ({ p, v: x.r[p.k], s: x.parts[p.k] })).sort((a, b) => b.s - a.s);
const supText = (x: Influence) => supParts(x).map(({ p, v, s }) => `${p.name} ${p.unit ? sec(v) : fmt(v)} (${pct(s)})`);
const axisValue = (x: Influence, k: AxisK) => (k === 'dmg' ? fmt(x.r.dmg) : k === 'heal' ? fmt(x.r.heal) : supParts(x).slice(0, 2).map(({ p, v }) => `${p.name} ${p.unit ? sec(v) : fmt(v)}`).join(' · ') || '—');

function impactSection(run: RunState, inf: ReturnType<typeof influence>, o: ReportOpts) {
  const rows = inf.rows;
  const byUid = new Map(rows.map((x) => [x.uid, x]));
  const max = { dmg: Math.max(1e-9, ...rows.map((x) => x.dmg), inf.synShare.dmg), heal: Math.max(1e-9, ...rows.map((x) => x.heal), inf.synShare.heal), sup: Math.max(1e-9, ...rows.map((x) => x.sup)) };
  const rankOf = (x: Influence) => run.units.find((u) => u.uid === x.uid)?.rank ?? run.rankLog[x.r.d] ?? 1;
  const gone = (x: Influence) => !run.units.some((u) => u.uid === x.uid);
  const mvpCard = (k: AxisK) => {
    const a = AXES.find((z) => z.k === k)!, uid = inf.mvp[k], x = uid ? byUid.get(uid) : undefined, d = x ? UNIT_BY_ID[x.r.d] : undefined;
    if (!x || !d) return `<div class="aar-mvp is-none" style="--ax:var(--ax-${k})"><span class="aar-mvp-k">${lineIcon(a.ic, 'li')}${a.name} MVP</span><b>해당 없음</b><small>${a.sub} 기록 없음</small></div>`;
    return `<div class="aar-mvp" style="--ax:var(--ax-${k})">${sprite(d.id)}<span class="aar-mvp-k">${lineIcon(a.ic, 'li')}${a.name} MVP</span><b>${esc(d.name)}</b><small>${k === 'sup' ? `서포팅 비중 ${pct(x.sup)}` : `${a.sub} ${fmt(k === 'dmg' ? x.r.dmg : x.r.heal)} · ${pct(x[k])}`}</small></div>`;
  };
  const cell = (x: Influence, k: AxisK) => {
    const v = x[k], best = inf.mvp[k] === x.uid;
    const title = k === 'sup' ? `서포팅 ${pct(v)} — ${supText(x).join(' · ') || '기록 없음'}` : `${AXES.find((z) => z.k === k)!.sub} ${fmt(k === 'dmg' ? x.r.dmg : x.r.heal)} · 런 전체의 ${pct(v)}`;
    return `<div class="aar-ax ax-${k}${best ? ' best' : ''}${v > 0 ? '' : ' zero'}" title="${esc(title)}"><span class="aar-ax-k">${AXES.find((z) => z.k === k)!.name}</span><span class="aar-bar" aria-hidden="true"><i style="--w:${(v / max[k]) * 100}%"></i></span><b class="mono">${v > 0 ? pct(v) : '—'}</b><small class="mono">${v > 0 ? esc(axisValue(x, k)) : '—'}</small></div>`;
  };
  const row = (x: Influence, i: number) => {
    const d = UNIT_BY_ID[x.r.d];
    const tags = AXES.filter((a) => inf.mvp[a.k] === x.uid).map((a) => `<em class="aar-tag ax-${a.k}">${a.name} MVP</em>`).join('');
    return `<li class="aar-row" style="--i:${i}"><div class="aar-who">${sprite(x.r.d)}<span class="aar-who-t"><b>${esc(d?.name || x.r.d)}</b><small><span class="rank">${o.rank(rankOf(x))}</span><span class="mono">${x.r.n}전</span>${gone(x) ? '<span class="aar-gone">방출</span>' : ''}${x.r.kills ? `<span>결정타 ${fmt(x.r.kills)}</span>` : ''}</small>${tags ? `<span class="aar-tags">${tags}</span>` : ''}</span></div>
      ${AXES.map((a) => cell(x, a.k)).join('')}</li>`;
  };
  const syn = inf.synShare.dmg + inf.synShare.heal > 0 ? `<li class="aar-row is-syn"><div class="aar-who"><span class="aar-syn-ic" aria-hidden="true">${lineIcon('a.power', 'li')}</span><span class="aar-who-t"><b>시너지 효과</b><small>포탑 · 근위기사 · 시너지 추가타</small></span></div>
      <div class="aar-ax ax-dmg"><span class="aar-ax-k">전투</span><span class="aar-bar" aria-hidden="true"><i style="--w:${(inf.synShare.dmg / max.dmg) * 100}%"></i></span><b class="mono">${pct(inf.synShare.dmg)}</b><small class="mono">${fmt(rec(run).syn.dmg)}</small></div>
      <div class="aar-ax ax-heal"><span class="aar-ax-k">회복</span><span class="aar-bar" aria-hidden="true"><i style="--w:${(inf.synShare.heal / max.heal) * 100}%"></i></span><b class="mono">${pct(inf.synShare.heal)}</b><small class="mono">${fmt(rec(run).syn.heal)}</small></div>
      <div class="aar-ax ax-sup zero"><span class="aar-ax-k">서포팅</span><span class="aar-bar" aria-hidden="true"><i style="--w:0%"></i></span><b class="mono">—</b><small class="mono">${rec(run).syn.shield >= 1 ? `보호막 ${fmt(rec(run).syn.shield)}` : '—'}</small></div></li>` : '';
  const basis = `소환물(단짝 · 사이오닉 소환물 등 주인이 있는 것)의 몫은 주인 기물에 합산했다 — 피해 · 회복 · 보호막 · 버프 · 약화 · 제어 · 탱킹 모두. 주인 없는 시너지 소환물(감시 포탑 · 근위기사)과 시너지 자체 효과는 '시너지 효과' 줄에 따로. 전투 = 준 피해, 회복 = 실제로 채운 체력, 서포팅 = 항목마다 런 전체에서 그 기물이 차지한 비중의 가중 평균 — ${SUPPORT_PARTS.map((p) => `${p.name} ×${p.w}`).join(' · ')}. 보호막 = 실제로 씌운 양, 제어 = 기절 · 빙결 · 공포 · 감전 · 매혹 · 혼란 · 속박이 적에게 걸려 있던 시간, 약화 = 그 밖의 해로운 효과 (지속 피해 제외) 시간, 버프 = 다른 아군에게 걸어 준 이로운 효과 시간, 탱킹 = 적에게서 받아 낸 피해 (보호막 흡수 포함), 전술 위력 = 지휘관 정신력 · 장비 · 시너지로 더한 전술 위력 (전투마다 합산). 막대는 열마다 가장 큰 값 기준, 숫자는 런 전체 대비 비중.`;
  return `<section class="aar-sec aar-impact">${secHead(1, '기물별 영향력', tip(basis))}
    <div class="aar-mvps">${AXES.map((a) => mvpCard(a.k)).join('')}</div>
    ${rows.length ? `<div class="aar-thead" aria-hidden="true"><span>기물</span>${AXES.map((a) => `<span class="ax-${a.k}">${lineIcon(a.ic, 'li')}${a.name}<small>${a.head}</small></span>`).join('')}</div>
    <ol class="aar-rows">${rows.map(row).join('')}${syn}</ol>` : '<p class="muted small">출전 기록이 없습니다.</p>'}
  </section>`;
}

// ───────── 2. 전투력 추이 (축 하나: 실제 · 예상 같은 단위)
const POWER_DEF = '전투력 = 그 전투에 출전한 기물(소환물 제외)의 주요 위력 합 — 사격 · 타격 · 기술 위력 중 큰 값, 지휘관은 전술 위력 (기물 상세 위력 칩과 같은 값, 장비 · 시너지 · 증강 반영, 체력 · 방어는 넣지 않음).';
function powerSection(run: RunState, bs: BattleRec[], ratio: number, last: BattleRec | undefined, lastExp: number) {
  const basis = `${POWER_DEF} ${expBasis(run.diff)}`;
  if (!bs.length) return `<section class="aar-sec aar-power">${secHead(2, '전투력 추이', tip(basis))}<p class="muted small">전투 기록이 없습니다.</p></section>`;
  const exp = bs.map((x) => expPower(x.p, x.s, run.diff));
  const top = Math.max(...bs.map((x) => x.pw), ...exp, 1);
  const step = niceStep(top / 4), yMax = Math.ceil(top / step) * step;
  const n = bs.length, X = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100), Y = (v: number) => 100 - (v / yMax) * 100;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(2)} ${Y(v).toFixed(2)}`).join(' ');
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, k) => k * step);
  const phases: { p: number; i: number }[] = [];
  bs.forEach((x, i) => { if (!i || x.p !== bs[i - 1].p) phases.push({ p: x.p, i }); });
  const colW = 100 / n;
  const cols = bs.map((x, i) => {
    const e = exp[i];
    const t = `${i + 1}번째 전투 · 페이즈 ${x.p} ${x.s + 1}칸 ${NODE_NAME[x.k] || x.k} · ${x.w ? '승리' : '패배'}\n전투력 ${fmt(x.pw)} · 예상 ${fmt(e)} (${e > 0 ? pct(x.pw / e) : '—'})\n적 전력 ${fmt(x.ep)}`;
    return `<rect class="aar-col" x="${Math.max(0, X(i) - colW / 2).toFixed(2)}" y="0" width="${colW.toFixed(2)}" height="100"><title>${esc(t)}</title></rect>`;
  }).join('');
  // 점: 길이 0 선 + 둥근 끝 (늘어나는 SVG 안에서도 동그랗게). 패배는 속이 빈 붉은 고리
  const dot = (i: number, v: number, cls: string) => `<path class="${cls}" d="M${X(i).toFixed(2)} ${Y(v).toFixed(2)}h0"/>`;
  const dots = bs.map((x, i) => (x.w ? dot(i, x.pw, 'aar-dot') : dot(i, x.pw, 'aar-dot loss') + dot(i, x.pw, 'aar-dot hole'))).join('');
  // 페이즈별 표 (그래프의 표 보기)
  const byP = new Map<number, { n: number; pw: number; e: number; w: number }>();
  bs.forEach((x, i) => { const a = byP.get(x.p) || { n: 0, pw: 0, e: 0, w: 0 }; a.n++; a.pw += x.pw; a.e += exp[i]; a.w += x.w; byP.set(x.p, a); });
  const table = [...byP].map(([p, a]) => `<tr><td>페이즈 ${p}</td><td class="mono">${a.n}</td><td class="mono">${fmt(a.pw / a.n)}</td><td class="mono">${fmt(a.e / a.n)}</td><td class="mono">${a.e > 0 ? pct(a.pw / a.e) : '—'}</td><td class="mono">${pct(a.w / a.n)}</td></tr>`).join('');
  const avgRatio = bs.reduce((s, x, i) => s + (exp[i] > 0 ? x.pw / exp[i] : 1), 0) / n;
  return `<section class="aar-sec aar-power">${secHead(2, '전투력 추이', tip(basis))}
    <div class="aar-hero ${ratio >= 1 ? 'is-up' : 'is-down'}"><b class="mono">${pct(ratio)}</b><span><small>예상 대비 (끝 시점)</small>페이즈 ${last!.p} ${NODE_NAME[last!.k] || last!.k} · 실제 ${fmt(last!.pw)} / 예상 ${fmt(lastExp)}<br><small>런 평균 ${pct(avgRatio)}</small></span></div>
    <div class="aar-legend"><span class="lg-act"><i></i>실제 전투력</span><span class="lg-exp"><i></i>예상치 (봇 평균)</span><span class="lg-loss"><i></i>패배한 전투</span></div>
    <figure class="aar-chart" aria-label="전투력 추이: 실제 ${fmt(last!.pw)}, 예상 ${fmt(lastExp)}">
      <div class="aar-plot">
        ${ticks.map((v) => `<span class="aar-yt mono" style="--y:${Y(v)}%">${fmt(v)}</span>`).join('')}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${ticks.map((v) => `<line class="aar-gl${v ? '' : ' base'}" x1="0" x2="100" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}
          ${phases.slice(1).map((ph) => `<line class="aar-pline" x1="${((X(ph.i - 1) + X(ph.i)) / 2).toFixed(2)}" x2="${((X(ph.i - 1) + X(ph.i)) / 2).toFixed(2)}" y1="0" y2="100"/>`).join('')}
          ${cols}
          <path class="aar-exp" d="${line(exp)}"/>
          <path class="aar-act" d="${line(bs.map((x) => x.pw))}"/>
          ${dots}
        </svg>
      </div>
      <div class="aar-xt">${phases.map((ph) => `<span class="mono" style="--x:${X(ph.i)}%">P${ph.p}</span>`).join('')}</div>
    </figure>
    <details class="aar-more"><summary>페이즈별 수치</summary><table class="aar-table"><thead><tr><th>페이즈</th><th>전투</th><th>평균 전투력</th><th>예상</th><th>예상 대비</th><th>승률</th></tr></thead><tbody>${table}</tbody></table></details>
  </section>`;
}
/** 눈금 간격: 1 · 2 · 5 × 10^n */
function niceStep(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, x))));
  const m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// ───────── 3. 경제
function econSection(run: RunState, eco: ReturnType<typeof economy>) {
  const r = rec(run);
  const sp = Object.entries(r.sp).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const spMax = Math.max(1, ...sp.map(([, v]) => v));
  const basis = `이자 = 전투마다 정산 전 보유 크레딧 ${CFG.interestPer}당 1 (그때의 상한까지). 예상 = 같은 페이즈 봇 전투의 평균 이자 — ${expSource(run.diff)}. 총 획득 = 남은 크레딧 − 시작 크레딧 + 총 지출 (전투 보상 · 이자 · 사건 · 판매 · 보급 등 모두). 지출은 상점 · 공명도 · 함대 확장 · 지정 소집 · 투자 · 사건 · 대출 상환.`;
  const expByP = [...new Set(r.b.map((x) => x.p))].map((p) => `페이즈 ${p} ${expInterest(p, run.diff).toFixed(1)}`).join(' · ');
  return `<section class="aar-sec aar-econ">${secHead(3, '경제', tip(basis))}
    <div class="aar-hero ${eco.exp > 0 && eco.avg >= eco.exp ? 'is-up' : 'is-down'}"><b class="mono">${eco.n ? eco.avg.toFixed(1) : '—'}</b><span><small>전투당 평균 이자</small>예상 ${eco.exp.toFixed(1)} · ${eco.exp > 0 && eco.n ? pct(eco.avg / eco.exp) : '—'}<br><small title="${esc(expByP)}">이자 합계 ${fmt(eco.interest)} · 전투 ${eco.n}회</small></span></div>
    <div class="aar-cap" title="${esc(`전투마다 그때의 이자 상한(평균 ${eco.capAvg.toFixed(1)})에 견준 이자 합계`)}"><div class="aar-cap-top"><span>이자 상한 대비</span><b class="mono">${pct(eco.capRate)}</b><small>상한 도달 ${eco.maxed}/${eco.n}전투</small></div><span class="aar-bar cr" aria-hidden="true"><i style="--w:${Math.min(100, eco.capRate * 100)}%"></i></span></div>
    <dl class="aar-ledger">
      <div><dt>총 획득</dt><dd class="mono is-up">+${fmt(eco.earned)}</dd></div>
      <div><dt>총 지출</dt><dd class="mono is-down">-${fmt(eco.spent)}</dd></div>
      <div><dt>전투 정산 합계</dt><dd class="mono">${eco.battleIncome >= 0 ? '+' : ''}${fmt(eco.battleIncome)}</dd></div>
      <div><dt>남은 크레딧</dt><dd class="mono">${fmt(run.credits)}</dd></div>
      <div><dt>새로고침</dt><dd class="mono">${r.rr}회</dd></div>
    </dl>
    ${sp.length ? `<h3 class="aar-h3">지출 내역</h3><ul class="aar-spend">${sp.map(([k, v]) => `<li><span>${SPEND_NAME[k] || k}</span><span class="aar-bar cr" aria-hidden="true"><i style="--w:${(v / spMax) * 100}%"></i></span><b class="mono">${fmt(v)}</b><small class="mono">${pct(v / Math.max(1, eco.spent))}</small></li>`).join('')}</ul>` : '<p class="muted small">지출 기록이 없습니다.</p>'}
  </section>`;
}

// ───────── 4. 기록 (메타 · 절망 · 업적 · 최종 편성)
function recordSection(run: RunState, o: ReportOpts) {
  const m = loadMeta(), fr = m.fields[run.field];
  const ds = despairsOf(run);
  const oath = oathResult(run, false).trim();
  const ach = (rec(run).ach || []).map((id) => ACH_BY_ID[id]).filter(Boolean);
  return `<section class="aar-sec aar-record">${secHead(4, '기록')}
    <div class="aar-rec-grid">
      <div><h3 class="aar-h3">용병단 기록</h3><dl class="aar-ledger">
        <div><dt>의뢰 (누적)</dt><dd>${m.runs}회 · 성공 ${m.clears}회</dd></div>
        <div><dt>${esc(fieldOf(run.field).name)}</dt><dd>${fr ? `${fr.runs}회 · 성공 ${fr.clears}회` : '—'}</dd></div>
        <div><dt>최고 도달 페이즈</dt><dd class="mono">${m.bestPhase}</dd></div>
      </dl>
      ${ds.length || oath ? `<h3 class="aar-h3">절망</h3><ul class="aar-chips">${ds.map((d) => `<li title="${esc(d.desc())}">${lineIcon(d.icon, 'li')}${esc(d.name)}</li>`).join('')}${oath ? `<li class="is-oath">${lineIcon('r.lantern', 'li')}${esc(oath.replace(/\.$/, ''))}</li>` : ''}</ul>` : ''}
      <h3 class="aar-h3">이번 의뢰의 업적</h3>${ach.length ? `<ul class="aar-ach">${ach.map((a) => `<li title="${esc(a.desc())}">${medalSvg(a)}<span>${esc(a.name)}</span></li>`).join('')}</ul>` : '<p class="muted small">새로 달성한 업적이 없습니다.</p>'}</div>
      <div><h3 class="aar-h3">최종 편성</h3><div class="roster">${o.roster}</div></div>
    </div>
  </section>`;
}
