// 전투 종료 보고서 (런 결과 화면 · main.ts overScreen): 런 동안 쌓는 누적 기록 · 기물별 영향력 · '예상치' 기준선.
//  · 기록은 RunState.rep 에 둔다. 옛 세이브에는 없다 → 처음 쓸 때 만들고 from(그때 페이즈)을 남겨 '그 뒤부터 기록'이라고 밝힌다.
//  · 전투 하나가 끝나면 resolveBattle 이 recBattle 을 한 번 부른다 (게임 · 봇 시뮬레이션 공통). 지출은 쓰는 곳에서 recSpend.
//  · 기물별 수치는 엔진 집계(CUnit.counters)를 그대로 더한다. 소환물(주인이 있는 것: 단짝 · 사이오닉 소환물 등)의 피해 · 회복 · 보호막 · 버프 · 약화 · 제어 · 탱킹은
//    주인 기물에 합산한다 (소환물은 그 기물 능력의 일부라서). 주인 없는 시너지 소환물(감시 포탑 · 근위기사)과 시너지 자체 효과는 시너지 몫.
//  · 예상치: tests/report_base.ts 봇 시뮬레이션(실제 게임과 같은 계약 기물 후보 · 위험 등급별)의 평균을 상수 표로 넣었다 (EXPECT).
import { CFG } from '../config';
import type { NodeType, RunState } from '../types';
import type { Battle, CUnit } from './combat';

/** 기물 하나의 런 누적 (uid 별). 시간은 초 */
export interface UnitRec {
  /** 기물 id */
  d: string;
  /** 출전 전투 수 */
  n: number;
  /** 준 피해 · 받은 피해(기물 자신) · 적에게서 받아 낸 피해 (보호막 흡수 포함) · 회복 · 보호막 · 결정타. 받은 피해 말고는 소환물 몫 포함 */
  dmg: number; taken: number; tank: number; heal: number; shield: number; kills: number;
  /** 다른 아군에게 건 버프 · 적에게 건 약화(지속 피해 제외) · 제어(기절 · 빙결 · 공포 · 감전 · 매혹 · 혼란 · 속박)가 실제로 걸려 있던 시간 */
  buff: number; debuff: number; cc: number;
  /** 전술 위력 기여 (전투마다 더함: 지휘관 정신력 몫 + 장비 · 시너지 가산) */
  tac: number;
}
/** 전투 하나 */
export interface BattleRec {
  /** 페이즈 · 칸 · 노드 종류 · 승리 여부 */
  p: number; s: number; k: NodeType; w: 0 | 1;
  /** 아군 전투력 · 적 전력 (powerOf) */
  pw: number; ep: number;
  /** 이자 · 그 전투의 이자 상한 · 정산으로 늘어난 크레딧 (대출 상환 뺀 값) */
  i: number; cap: number; c: number;
}
export interface RunRec {
  v: 1;
  /** 기록을 시작한 페이즈 (1 = 런 처음부터, 그 밖 = 옛 세이브를 이어 하다 기록이 붙음) */
  from: number;
  /** 시작 · 끝 시각 (ms) */
  t0: number; t1?: number;
  /** 기록을 시작할 때 보유 크레딧 */
  c0: number;
  u: Record<string, UnitRec>;
  /** 시너지 자체 효과 (기물 몫과 따로) */
  syn: { dmg: number; heal: number; shield: number };
  b: BattleRec[];
  /** 크레딧 지출 (종류별): shop 상점 · xp 공명도 구매 · fleet 함대 확장 · muster 지정 소집 · invest 투자 · event 사건 · loan 대출 상환 */
  sp: Record<string, number>;
  /** 새로고침 횟수 (증강 · 전역 · 특권 · 절망 · 영입) */
  rr: number;
  /** 이번 런에 달성한 업적 id */
  ach?: string[];
}

export const SPEND_NAME: Record<string, string> = { shop: '상점 구매', xp: '공명도 구매', fleet: '함대 확장', muster: '지정 소집', invest: '투자', event: '사건', loan: '대출 상환' };

export function newRec(run: RunState, from = 1): RunRec {
  return { v: 1, from, t0: Date.now(), c0: run.credits, u: {}, syn: { dmg: 0, heal: 0, shield: 0 }, b: [], sp: {}, rr: 0 };
}
/** 기록 (없으면 지금부터: 옛 세이브) */
export const rec = (run: RunState): RunRec => (run.rep ??= newRec(run, run.phase));
export function recSpend(run: RunState, kind: string, n: number) {
  if (!(n > 0)) return;
  const sp = rec(run).sp;
  sp[kind] = (sp[kind] || 0) + n;
}
export const recReroll = (run: RunState) => { rec(run).rr++; };
export function recAch(run: RunState, ids: string[]) {
  const r = rec(run);
  for (const id of ids) if (!(r.ach ||= []).includes(id)) r.ach.push(id);
}
export function recEnd(run: RunState) { rec(run).t1 ??= Date.now(); }

/** 주요 위력: 사격 · 타격 · 기술 위력 중 큰 값 (기물 상세 위력 칩 · 적 공명 등급 추정과 같은 기준), 아군 지휘관은 전술 위력. 적은 페이즈 피해 배율을 곱한다 */
export function mainPower(b: Battle, c: CUnit): number {
  if (c.side === 0 && c.ctype === 'CMD' && !c.isSummon) return Math.max(1, b.tac[0]) * (1 + (c.mem.tacPct || 0));
  return Math.max(c.st.shoot, c.st.strike, c.st.tech) * (c.side === 1 ? c.phaseAmp : 1);
}
/** 전투력 (아군) · 적 전력: 소환물 · 장애물 · 반려 돌을 뺀 기물의 주요 위력 합 */
export function powerOf(b: Battle, side: 0 | 1): number {
  let s = 0;
  for (const c of b.units) if (c.side === side && !c.isSummon && !c.mem.inert && !(side === 1 && c.noAttack)) s += mainPower(b, c);
  return Math.round(s);
}
const rootOf = (c: CUnit) => { let r = c; for (let k = 0; r.owner && k < 4; k++) r = r.owner; return r; };

/** 전투 하나를 기록에 더한다 (resolveBattle 이 보상 정산 뒤에 부른다) */
export function recBattle(run: RunState, b: Battle, o: { interest: number; cap: number; credits0: number }) {
  const r = rec(run);
  const allies = b.units.filter((c) => c.side === 0);
  const usesTac = allies.some((c) => (c.ctype === 'CMD' && !c.isSummon) || c.weapon?.tactical);
  for (const c of allies) {
    const root = rootOf(c);
    const k = c.counters;
    if (root.mem.inert) continue; // 반려 돌 · 전장 장애물: 영향력 표에서 뺀다
    if (!root.src) { // 주인 없는 시너지 소환물 (감시 포탑 · 근위기사)
      r.syn.dmg += k.dmg; r.syn.heal += k.healed; r.syn.shield += k.shield;
      continue;
    }
    const u = (r.u[root.src.uid] ??= { d: root.src.defId, n: 0, dmg: 0, taken: 0, tank: 0, heal: 0, shield: 0, kills: 0, buff: 0, debuff: 0, cc: 0, tac: 0 });
    u.dmg += k.dmg; u.heal += k.healed; u.shield += k.shield; u.kills += k.kills;
    u.buff += k.buffT || 0; u.debuff += k.debuffT || 0; u.cc += k.ccT || 0; u.tank += k.tank || 0; // 소환물 몫도 주인에게 (단짝 · 사이오닉 소환물이 받아 낸 피해 포함)
    if (c === root) {
      u.n++;
      u.taken += k.taken;
      if (usesTac) u.tac += (c.ctype === 'CMD' ? CFG.tacPerMnd * (c.mem.mnd || 0) : 0) + (c.mem.tacBonus || 0);
    }
  }
  for (const x of Object.values(b.synStats)) if (x.side === 0) { r.syn.dmg += x.dmg; r.syn.heal += x.healed; r.syn.shield += x.shield; }
  r.b.push({ p: run.phase, s: run.step, k: run.node?.type || 'battle', w: b.winner === 0 ? 1 : 0, pw: powerOf(b, 0), ep: powerOf(b, 1), i: o.interest, cap: o.cap, c: run.credits - o.credits0 });
}

// ───────── 기물별 영향력 (런 내 비중)
/** 서포팅 점수를 이루는 항목과 무게: 항목마다 런 전체에서 그 기물이 차지한 비중을 구해 무게로 평균한다 (모두 0인 항목은 빼고) */
export const SUPPORT_PARTS = [
  { k: 'shield', name: '보호막', w: 1, unit: '' },
  { k: 'cc', name: '제어', w: 1, unit: '초' },
  { k: 'tank', name: '탱킹', w: 1, unit: '' },
  { k: 'buff', name: '버프', w: 0.75, unit: '초' },
  { k: 'debuff', name: '약화', w: 0.5, unit: '초' },
  { k: 'tac', name: '전술 위력', w: 0.5, unit: '' },
] as const;
export type SupportKey = (typeof SUPPORT_PARTS)[number]['k'];
export interface Influence {
  uid: string; r: UnitRec;
  /** 런 전체 대비 비중 (0~1): 전투 = 준 피해, 회복 = 회복량, 서포팅 = SUPPORT_PARTS 가중 평균 */
  dmg: number; heal: number; sup: number;
  /** 서포팅 항목별 비중 */
  parts: Record<SupportKey, number>;
}
export function influence(r: RunRec) {
  const rows = Object.entries(r.u).filter(([, x]) => x.n > 0);
  const tot = (f: (x: UnitRec) => number) => rows.reduce((s, [, x]) => s + f(x), 0);
  const tDmg = tot((x) => x.dmg) + r.syn.dmg, tHeal = tot((x) => x.heal) + r.syn.heal;
  const tPart = Object.fromEntries(SUPPORT_PARTS.map((p) => [p.k, tot((x) => x[p.k])])) as Record<SupportKey, number>;
  const live = SUPPORT_PARTS.filter((p) => tPart[p.k] > 0);
  const wSum = live.reduce((s, p) => s + p.w, 0);
  const out: Influence[] = rows.map(([uid, x]) => {
    const parts = Object.fromEntries(SUPPORT_PARTS.map((p) => [p.k, tPart[p.k] > 0 ? x[p.k] / tPart[p.k] : 0])) as Record<SupportKey, number>;
    return { uid, r: x, dmg: tDmg > 0 ? x.dmg / tDmg : 0, heal: tHeal > 0 ? x.heal / tHeal : 0, sup: wSum > 0 ? live.reduce((s, p) => s + p.w * parts[p.k], 0) / wSum : 0, parts };
  });
  out.sort((a, b) => b.dmg + b.heal + b.sup - (a.dmg + a.heal + a.sup));
  const top = (f: (x: Influence) => number) => { const m = out.reduce<Influence | null>((best, x) => (f(x) > 0 && (!best || f(x) > f(best)) ? x : best), null); return m?.uid || null; };
  return { rows: out, tot: { dmg: tDmg, heal: tHeal, ...tPart }, synShare: { dmg: tDmg > 0 ? r.syn.dmg / tDmg : 0, heal: tHeal > 0 ? r.syn.heal / tHeal : 0 }, mvp: { dmg: top((x) => x.dmg), heal: top((x) => x.heal), sup: top((x) => x.sup) } };
}

// ───────── 경제 요약
export function economy(run: RunState) {
  const r = rec(run);
  const spent = Object.values(r.sp).reduce((s, v) => s + v, 0);
  const earned = Math.max(0, run.credits - r.c0 + spent);
  const n = r.b.length;
  const interest = r.b.reduce((s, x) => s + x.i, 0), cap = r.b.reduce((s, x) => s + x.cap, 0);
  const exp = n ? r.b.reduce((s, x) => s + expInterest(x.p, run.diff), 0) / n : 0;
  return { spent, earned, n, interest, avg: n ? interest / n : 0, capAvg: n ? cap / n : 0, capRate: cap > 0 ? interest / cap : 0, maxed: r.b.filter((x) => x.cap > 0 && x.i >= x.cap).length, exp, battleIncome: r.b.reduce((s, x) => s + x.c, 0) };
}

// ───────── 예상치 (봇 평균)
/** tests/report_base.ts 출력 (위험 등급별 봇 표본). pw[페이즈-1] = [a, b] → 그 페이즈 칸 s 전투의 평균 아군 전투력 ≈ a + b·s (최소제곱 직선), i[페이즈-1] = 전투당 평균 이자.
 *  봇이 거의 닿지 못한 페이즈는 표에 없다 → 위험 0 표(가장 긴 표)의 모양을 그 위험 등급 표의 마지막 페이즈에 맞춰 늘려 쓴다.
 *  만든 명령: node dist/report_base.cjs 200 <위험> (위험 0 · 3 · 6 · 7 · 9 각각). 밸런스가 크게 바뀌면 다시 뽑는다 */
export const EXPECT: { diff: number; runs: number; pw: [number, number][]; i: number[] }[] = [
  { diff: 0, runs: 200, pw: [[354,13.2],[642,13.4],[871,13.7],[1060,9.5],[1262,15.9],[1507,8.9],[1795,17.4],[2079,16.4],[2368,37.7],[2812,24.7]], i: [1.77,2.67,2.86,2.8,2.76,2.77,2.84,2.82,2.85,2.8] },
  { diff: 3, runs: 200, pw: [[337,12.2],[612,12.6],[820,15.7],[1032,12.4],[1231,20.6],[1540,15],[1967,17.9],[2242,18.7],[2542,54.4],[3104,25]], i: [1.59,2.64,2.85,2.76,2.78,2.73,2.76,2.78,2.83,2.84] },
  { diff: 6, runs: 200, pw: [[358,10.7],[592,15.5],[781,18.6],[1060,12.1],[1208,31.5],[1655,16.6]], i: [1.49,2.31,2.73,2.72,2.62,2.78] },
  { diff: 7, runs: 200, pw: [[372,11],[601,14.8],[819,15.8],[1045,10.3],[1197,41.4],[1688,25.2]], i: [1.47,2.18,2.37,2.31,2.35,1.8] },
  { diff: 9, runs: 200, pw: [[345,11],[577,15.2],[797,15.7],[1018,17.8],[1316,25.2],[1578,0.3]], i: [1.44,2.09,2.52,2.58,2.9,2.91] },
];
/** 위험 등급에 가장 가까운 표 · 가장 긴 표 */
const expTable = (diff: number) => EXPECT.reduce((a, x) => (Math.abs(x.diff - diff) < Math.abs(a.diff - diff) ? x : a), EXPECT[0]);
const longest = () => EXPECT.reduce((a, x) => (x.pw.length > a.pw.length ? x : a), EXPECT[0]);
const line = (row: [number, number], s: number) => row[0] + row[1] * s;
/** 표 밖 페이즈 값: 가장 긴 표의 같은 페이즈 값 × (이 표 마지막 페이즈 / 가장 긴 표의 같은 페이즈). 그것도 넘으면 가장 긴 표의 마지막 두 페이즈 증가율로 */
function beyond(rows: [number, number][], p: number, s: number): number {
  const L = longest().pw, k = rows.length - 1, mid = 5.5;
  const scale = line(rows[k], mid) / Math.max(1, line(L[Math.min(k, L.length - 1)], mid));
  if (p - 1 < L.length) return line(L[p - 1], s) * scale;
  const n = L.length - 1, g = n > 0 ? Math.max(1, line(L[n], mid) / Math.max(1, line(L[n - 1], mid))) : 1;
  return line(L[n], s) * scale * Math.pow(g, p - 1 - n);
}
/** 예상 전투력: 그 위험 등급 · 페이즈 · 칸의 봇 평균 */
export function expPower(p: number, s: number, diff: number): number {
  const rows = expTable(diff).pw;
  if (!rows.length) return 0;
  return Math.max(0, p - 1 < rows.length ? line(rows[Math.max(0, p - 1)], s) : beyond(rows, p, s));
}
export function expInterest(p: number, diff: number): number {
  const t = expTable(diff).i.length >= p ? expTable(diff).i : longest().i;
  return t[Math.min(t.length - 1, Math.max(0, p - 1))] || 0;
}
/** 기준 출처 한 줄: '봇 시뮬레이션 평균 (tests/report_base.ts · 위험 n 기준 · m런)' */
export const expSource = (diff: number) => { const t = expTable(diff); return `봇 시뮬레이션 평균 (tests/report_base.ts · 위험 ${t.diff} 기준 · ${t.runs}런)`; };
/** 화면 툴팁에 적는 기준 설명 */
export const expBasis = (diff: number) => `예상치 = ${expSource(diff)}. 봇은 계약 기물 후보에서 우세 시너지 기물을 먼저 고르고, 증강 · 전역 증강은 무작위, 남는 크레딧은 이자 구간 30을 남기고 공명도를 산다. 그 페이즈 · 칸에서 싸운 봇 전투의 평균(페이즈마다 칸에 따른 직선)이라, 오래 살아남은 봇일수록 표본에 남는다. 봇이 거의 닿지 못한 페이즈는 위험 0 봇 곡선의 모양으로 늘렸다.`;
