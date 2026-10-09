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
      const alloc: Record<Major, number> = { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 };
      const pref: Major[] = d.range <= 1 ? ['vit', 'def', 'pow'] : ['pow', 'mnd', 'vit'];
      for (let i = 0; i < p.points; i++) alloc[pref[i % pref.length]]++;
      R.applyRankAlloc(run, p.uid, alloc);
      R.ensureRankupOptions(run, p);
      if (p.options!.length) R.chooseAug(run, p.uid, bot.pick(p.options!));
    } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
    else if (p.t === 'recruit') R.recruit(run, bot.pick(p.options));
    else if (p.t === 'supply') R.takeSupply(run, p.options[0]);
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

function playRun(seed: number) {
  const bot = new Rng(seed * 7 + 1);
  const run = R.newRun(seed, bot.sample(UNITS.map((u) => u.id), 3));
  const phaseLog: Record<number, { w: number; l: number }> = {};
  let battles = 0;
  while (!run.over && run.phase <= 15 && battles < 200) {
    resolvePending(run, bot);
    manage(run);
    resolvePending(run, bot);
    if (!run.node) {
      const opts = R.currentOptions(run);
      R.enterNode(run, opts.includes('adversity') && run.hp > 60 && bot.chance(0.5) ? 'adversity' : opts[0]);
      if (run.node && (run.node as { type: string }).type === 'shop') {
        for (let i = 0; i < 6; i++) if (run.credits >= 35) R.buyShop(run, i);
        R.leaveShop(run);
      }
      continue;
    }
    const b = buildBattle(run, run.node.enc!, false);
    b.runToEnd();
    battles++;
    const ph = run.phase;
    phaseLog[ph] = phaseLog[ph] || { w: 0, l: 0 };
    if (b.winner === 0) phaseLog[ph].w++; else phaseLog[ph].l++;
    R.resolveBattle(run, b);
  }
  return { phase: run.phase, phaseLog, units: run.units.length, avgRank: run.units.reduce((s, u) => s + u.rank, 0) / run.units.length };
}

const N = Number(process.argv[2] || 40);
const reach: Record<number, number> = {};
const wl: Record<number, { w: number; l: number }> = {};
let rankSum = 0;
for (let i = 1; i <= N; i++) {
  const r = playRun(i * 1013);
  reach[r.phase] = (reach[r.phase] || 0) + 1;
  rankSum += r.avgRank;
  for (const [p, v] of Object.entries(r.phaseLog)) {
    wl[+p] = wl[+p] || { w: 0, l: 0 };
    wl[+p].w += v.w; wl[+p].l += v.l;
  }
}
console.log(`런 ${N}회 — 사망 시점 페이즈 분포:`);
for (const p of Object.keys(reach).map(Number).sort((a, b) => a - b)) console.log(`  P${p}: ${'#'.repeat(reach[p])} ${reach[p]}`);
console.log('페이즈별 전투 승률:');
for (const p of Object.keys(wl).map(Number).sort((a, b) => a - b)) {
  const v = wl[p];
  console.log(`  P${p}: ${((v.w / (v.w + v.l)) * 100).toFixed(0)}% (${v.w}/${v.w + v.l})`);
}
console.log(`사망 시 평균 공명 등급: ${(rankSum / N).toFixed(1)}`);
void MAJORS;
