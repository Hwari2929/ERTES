// 헤드리스 밸런스 시뮬레이션: 단순 봇이 런을 끝까지 진행하고 도달 페이즈/승률을 집계한다.
// 실행: npm run sim -- [런 수]
import { CFG } from '../src/config';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { Rng } from '../src/rng';
import { MAJORS, type Major, type RunState } from '../src/types';

declare const process: { argv: string[] };

function resolvePending(run: RunState, bot: Rng) {
  while (run.pending.length) {
    const p = run.pending[0];
    if (p.t === 'global') R.pickGlobal(run, bot.pick(p.options));
    else if (p.t === 'rankup') {
      const u = run.units.find((x) => x.uid === p.uid)!;
      const d = UNIT_BY_ID[u.defId];
      const pref: Major[] = d.range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
      R.applyRankPicks(run, p.uid, pref, p.points);
      R.ensureRankupOptions(run, p);
      if (p.options!.length) R.chooseAug(run, p.uid, bot.pick(p.options!));
    } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
    else if (p.t === 'recruit') {
      // 현재 파티와 시너지가 가장 많이 겹치는 기물을 영입
      const have = new Map<string, number>();
      for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
      const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
      R.recruit(run, p.options.slice().sort((x, y) => score(y) - score(x))[0]);
    }
    else if (p.t === 'supply') R.takeSupply(run, p.options[0]);
    else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
    run.pending.shift();
  }
}

function manage(run: RunState) {
  // 장비: 재료를 가장 공명 등급 높은 기물부터 장착
  const sorted = run.units.filter((u) => u.pos).sort((a, b) => b.rank - a.rank);
  for (let guard = 0; guard < 20 && run.inventory.length; guard++) {
    const target = sorted.find((u) => u.items.includes(null) || u.items.some((x) => x && x[0] === 'C'));
    if (!target || R.equip(run, 0, target.uid)) break;
  }
  // 남는 크레딧(이자 구간 30 유지)으로 공명도 구매
  while (run.credits >= 30 + R.xpCost(run)) {
    const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
    if (!u || !R.buyXp(run, u.uid)) break;
  }
  R.autoPlace(run);
}

function playRun(seed: number, force?: string) {
  const bot = new Rng(seed * 7 + 1);
  const starters = force ? [force, ...bot.sample(STARTERS.filter((x) => x !== force), 2)] : bot.sample(STARTERS, 3);
  const run = R.newRun(seed, starters);
  const phaseLog: Record<number, { w: number; l: number }> = {};
  let battles = 0;
  while (!run.over && run.phase <= 25 && battles < 300) {
    resolvePending(run, bot);
    manage(run);
    resolvePending(run, bot);
    if (!run.node) {
      const opts = R.currentOptions(run);
      R.enterNode(run, opts.includes('adversity') && run.hp > 60 && bot.chance(0.5) ? 'adversity' : opts[0]);
      const t = (run.node as { type: string } | null)?.type;
      if (t === 'shop') for (let i = 0; i < 6; i++) if (run.credits >= 35) R.buyShop(run, i);
      if (t === 'news') for (let i = 0; i < 6; i++) R.buyNews(run, i);
      if (t === 'shop' || t === 'news') R.leaveShop(run);
      continue;
    }
    const b = buildBattle(run, run.node.enc!, false);
    b.runToEnd();
    battles++;
    const ph = run.phase;
    const key = run.node.type === 'boss' ? -ph : ph; // 음수 = 보스전
    phaseLog[key] = phaseLog[key] || { w: 0, l: 0 };
    if (b.winner === 0) phaseLog[key].w++; else phaseLog[key].l++;
    R.resolveBattle(run, b);
  }
  const items = [...run.inventory, ...run.units.flatMap((u) => u.items.filter((x): x is string => !!x))];
  const grade = (g: string) => items.filter((x) => x[0] === g).length;
  return { phase: run.phase, phaseLog, units: run.units.length, avgRank: run.units.reduce((s, u) => s + u.rank, 0) / run.units.length, items: { C: grade('C'), A: grade('A'), L: grade('L') } };
}

const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
const N = Number(process.argv[2] || 40);
if (process.argv[3] === 'units') {
  // 기물별: 해당 기물을 시작 기물에 넣은 런의 평균 도달 페이즈
  const rows = UNITS.map((u) => {
    let sum = 0;
    for (let i = 1; i <= N; i++) sum += playRun(i * 7919, u.id).phase;
    return [u.name, sum / N] as const;
  }).sort((a, b) => b[1] - a[1]);
  for (const [n, v] of rows) console.log(`${v.toFixed(2)}  ${n}`);
  throw 0;
}
const reach: Record<number, number> = {};
const wl: Record<number, { w: number; l: number }> = {};
let rankSum = 0, unitSum = 0;
const itemSum = { C: 0, A: 0, L: 0 };
for (let i = 1; i <= N; i++) {
  const r = playRun(i * 1013);
  reach[r.phase] = (reach[r.phase] || 0) + 1;
  rankSum += r.avgRank;
  unitSum += r.units;
  for (const g of ['C', 'A', 'L'] as const) itemSum[g] += r.items[g];
  for (const [p, v] of Object.entries(r.phaseLog)) {
    wl[+p] = wl[+p] || { w: 0, l: 0 };
    wl[+p].w += v.w; wl[+p].l += v.l;
  }
}
console.log(`런 ${N}회 — 사망 시점 페이즈 분포:`);
for (const p of Object.keys(reach).map(Number).sort((a, b) => a - b)) console.log(`  P${p}: ${'#'.repeat(reach[p])} ${reach[p]}`);
console.log('페이즈별 전투 승률 (일반 / 보스):');
for (const p of Object.keys(wl).map(Number).filter((x) => x > 0).sort((a, b) => a - b)) {
  const v = wl[p], bo = wl[-p];
  const f = (x?: { w: number; l: number }) => (x ? `${((x.w / (x.w + x.l)) * 100).toFixed(0)}% (${x.w}/${x.w + x.l})` : '-');
  console.log(`  P${p}: ${f(v)}  |  보스 ${f(bo)}`);
}
console.log(`사망 시 평균 공명 등급: ${(rankSum / N).toFixed(1)} · 보유 기물 ${(unitSum / N).toFixed(1)}명`);
console.log(`사망 시 보유 장비 (재료 / 고급 / 전설): ${(itemSum.C / N).toFixed(1)} / ${(itemSum.A / N).toFixed(1)} / ${(itemSum.L / N).toFixed(2)}`);
void MAJORS;
