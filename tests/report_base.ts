// 전투 종료 보고서의 '예상치' 기준선 (src/engine/report.ts EXPECT) 만들기: 봇이 런을 돌리고 전투마다 남긴 기록(run.rep)을 페이즈 · 칸별로 평균낸다.
// 실행: npx esbuild tests/report_base.ts --bundle --platform=node --outfile=dist/report_base.cjs && node dist/report_base.cjs <런 수> <위험 등급,…>
//   출력 = EXPECT 표에 그대로 붙여 넣는 줄 (위험 등급마다 한 줄: 페이즈별 [a, b] → 칸 s 전투의 예상 전투력 a + b·s, 전투당 평균 이자). 봇 운용은 tests/sim.ts 와 같고, 계약 기물은 실제 게임처럼 후보(engine/starters.ts)에서 고른다.
import { CFG } from '../src/config';
import { FIELDS } from '../src/data/battlefields';
import { UNIT_BY_ID } from '../src/data/units';
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { fieldSyn, starterPool } from '../src/engine/starters';
import { Rng } from '../src/rng';
import type { Major, RunState } from '../src/types';
import { augChoice, forkChoice, manageItems, pilgrimBot, shopSynth, turretPickBot } from './botlib';

declare const process: { argv: string[]; stdout: { write(s: string): void } };
const N = +process.argv[2] || 200;
const DIFFS = (process.argv[3] || '0').split(',').map(Number);
/** 표에 넣는 최대 페이즈 (그 뒤는 report.ts 가 마지막 증가율로 늘린다) */
const MAX_P = 10;

function resolvePending(run: RunState, bot: Rng) {
  while (run.pending.length) {
    const p = run.pending[0];
    if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; }
    if (p.t === 'despair') { R.pickDespair(run, bot.int(0, p.options.length - 1)); continue; }
    if (p.t === 'event') {
      let done = false;
      for (const i of bot.shuffle([0, 1, 2])) if (R.chooseEvent(run, i) === null && run.pending[0] !== p) { done = true; break; }
      if (!done) run.pending.shift();
      continue;
    }
    if (p.t === 'victory') run.endless = true; // 무한 모드로 계속 (후반 페이즈 표본)
    if (p.t === 'global') R.pickGlobal(run, bot.pick(p.options));
    else if (p.t === 'rankup') {
      const u = run.units.find((x) => x.uid === p.uid)!;
      const pref: Major[] = UNIT_BY_ID[u.defId].range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
      if (!p.allocDone) R.allocRank(run, p, pref);
      R.ensureRankupOptions(run, p);
      { const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a); }
    } else if (p.t === 'turretPick') { turretPickBot(run); continue; } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
    else if (p.t === 'recruit') {
      const have = new Map<string, number>();
      for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
      const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
      R.recruit(run, p.options.slice().sort((x, y) => score(y) - score(x))[0]);
    } else if (p.t === 'supply') R.flipAllSupply(run, p);
    else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
    else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
    else if (p.t === 'fork') { R.pickFork(run, forkChoice(run, () => bot.chance(0.5))); continue; }
    else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
    run.pending.shift();
  }
}
function manage(run: RunState) {
  manageItems(run);
  for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
  while (run.credits >= 30 + R.xpCost(run)) {
    const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
    if (!u || !R.buyXp(run, u.uid)) break;
  }
  R.autoPlace(run);
}
/** 런 하나: 봇 운용 (sim.ts) + 계약 기물 후보 (balance.ts pool). stop: 전투 직전에 참이면 멈춘다 (화면 확인용 상태 만들기) */
export function botRun(seed: number, diff: number, stop?: (run: RunState) => boolean): RunState {
  const bot = new Rng(seed * 7 + 1);
  const pr = new Rng(seed * 13 + 5), field = new Rng(seed).pick(FIELDS).id, syn = fieldSyn(field);
  const pool = starterPool(pr, field);
  const fav = pr.shuffle(pool.filter((id) => !!syn && ([...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[]).includes(syn))).slice(0, CFG.starterFav);
  const starters = [...fav, ...pr.sample(pool.filter((id) => !fav.includes(id)), CFG.startUnits - fav.length)];
  const run = R.newRun(seed, starters, field, diff);
  let n = 0;
  while (!run.over && run.phase <= MAX_P && n < 200) {
    resolvePending(run, bot); manage(run); resolvePending(run, bot);
    if (run.node?.synth) { shopSynth(run); continue; }
    if (!run.node) {
      const opts = R.currentOptions(run);
      R.enterNode(run, opts.includes('adversity') && run.hp > 60 && bot.chance(0.5) ? 'adversity' : opts[0]);
      if (run.pending[0]?.t === 'branch') resolvePending(run, bot);
      const t = (run.node as { type: string } | null)?.type;
      if (t === 'shop') for (let i = 0; i < 6; i++) if (run.credits >= 35) R.buyShop(run, i);
      if (t === 'news') for (let i = 0; i < 6; i++) R.buyNews(run, i);
      if (t === 'invest') for (let i = 0; i < 5; i++) if (run.credits >= 30) R.buyInvest(run, i);
      if (t === 'shop' || t === 'news' || t === 'invest') R.leaveShop(run);
      continue;
    }
    if (stop?.(run)) break;
    n++;
    const b = buildBattle(run, run.node.enc!, false);
    b.runToEnd();
    R.resolveBattle(run, b);
  }
  return run;
}

if (process.argv[1]?.includes('report_base')) {
  for (const diff of DIFFS) {
    // 페이즈마다 칸(s)에 대한 직선 pw = a + b·s 를 최소제곱으로 (전환 칸의 도전처럼 표본이 치우친 칸이 튀지 않게)
    const acc: { n: number; s: number; ss: number; y: number; sy: number; i: number }[] = [];
    for (let k = 1; k <= N; k++) {
      const run = botRun(k * 4099 + diff, diff);
      for (const x of run.rep?.b || []) {
        if (x.p > MAX_P) continue;
        const a = (acc[x.p - 1] ||= { n: 0, s: 0, ss: 0, y: 0, sy: 0, i: 0 });
        a.n++; a.s += x.s; a.ss += x.s * x.s; a.y += x.pw; a.sy += x.s * x.pw; a.i += x.i;
      }
    }
    // 표본이 모자란 페이즈(전체 런의 5% 미만)부터는 버린다 (report.ts 가 위험 0 표의 모양으로 늘린다)
    const min = Math.max(5, Math.round(N * 0.05));
    const rows: [number, number][] = [], ints: number[] = [];
    for (const a of acc) {
      if (!a || a.n < min) break;
      const d = a.n * a.ss - a.s * a.s, b = d > 0 ? (a.n * a.sy - a.s * a.y) / d : 0;
      rows.push([Math.round((a.y - b * a.s) / a.n), +b.toFixed(1)]);
      ints.push(+(a.i / a.n).toFixed(2));
    }
    process.stdout.write(`  { diff: ${diff}, runs: ${N}, pw: ${JSON.stringify(rows)}, i: ${JSON.stringify(ints)} },\n`);
  }
}
