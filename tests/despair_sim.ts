// 절망 증강 밸런스 시뮬레이션: sim.ts 와 같은 봇으로, 위험 등급 · 절망 증강을 강제로 걸어 의뢰 성공률(6페이즈 보스 격파)을 잰다.
// 같은 시드 묶음을 증강마다 그대로 쓰므로 (공통 난수) 증강 없는 기준과의 차이가 덜 흔들린다.
// 실행: npx esbuild tests/despair_sim.ts --bundle --platform=node --log-level=error --outfile=dist/despair_sim.cjs && node dist/despair_sim.cjs <위험 등급> <증강 id | none> <런 수> [시작 시드] [설정키=값 …]
//   예) node dist/despair_sim.cjs 0 D.overclock 100 1 overclock=2   → 한 줄 JSON {d, id, n, start, clears, phase, over} (시드 (start..start+n-1) × 1013)
//   병렬: 시작 시드를 1 · 101 · 201 · 301 … 로 나눠 여러 프로세스로 돌리고 합친다 (증강마다 같은 시드 묶음 → 기준과의 차이를 같은 시드끼리 본다).
//   고난 · 모험은 봇 성공률이 바닥(0~2%)이라 위험 0 에서 비교했다 (위험 7 이상이면 출격 · 페이즈 시작 때 첫 선택지 절망 증강도 함께 걸린다). 봇은 반려 돌을 영입하지 않고, 캣휠은 밍키가 있으면 밍키에게 · 없으면 판다.
import { CFG } from '../src/config';
import { DESPAIR_BY_ID, PETROCK } from '../src/data/despair';
import { isJunk } from '../src/data/items';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { augChoice, forkChoice, manageItems, shopSynth, pilgrimBot } from './botlib';
import { Rng } from '../src/rng';
import type { Major, RunState } from '../src/types';

declare const process: { argv: string[] };

const [DIFF, ID, N, START] = [+process.argv[2] || 0, process.argv[3] || 'none', +process.argv[4] || 100, +process.argv[5] || 1];
for (const kv of process.argv.slice(6)) { const [k, v] = kv.split('='); (CFG.despair as Record<string, number>)[k] = +v; }
if (ID !== 'none' && !DESPAIR_BY_ID[ID]) throw new Error(`없는 절망 증강 ${ID}`);

function resolvePending(run: RunState, bot: Rng) {
  while (run.pending.length) {
    const p = run.pending[0];
    if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; }
    if (p.t === 'despair') { R.pickDespair(run, 0); continue; }
    if (p.t === 'event') {
      const order = bot.shuffle([0, 1, 2]);
      let done = false;
      for (const i of order) if (R.chooseEvent(run, i) === null && run.pending[0] !== p) { done = true; break; }
      if (!done) run.pending.shift();
      continue;
    }
    if (p.t === 'victory') { run.endless = true; }
    if (p.t === 'global') R.pickGlobal(run, bot.pick(p.options));
    else if (p.t === 'rankup') {
      const u = run.units.find((x) => x.uid === p.uid)!;
      const d = UNIT_BY_ID[u.defId];
      const pref: Major[] = d.range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
      if (!p.allocDone) R.applyRankPicks(run, p.uid, pref, p.points);
      R.ensureRankupOptions(run, p);
      { const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a); }
    } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
    else if (p.t === 'recruit') {
      // sim.ts 와 같음: 파티와 시너지가 가장 많이 겹치는 기물. 반려 돌은 고르지 않는다
      const have = new Map<string, number>();
      for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
      const score = (id: string) => { if (id === PETROCK) return -1e9; const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
      const best = p.options.slice().sort((x, y) => score(y) - score(x))[0];
      if (best && best !== PETROCK) R.recruit(run, best);
    }
    else if (p.t === 'supply') R.flipAllSupply(run, p);
    else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
    else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
    else if (p.t === 'fork') { R.pickFork(run, forkChoice(run, () => bot.chance(0.5))); continue; }
    else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
    run.pending.shift();
  }
}

function manage(run: RunState) {
  // 캣휠: 밍키가 있으면 밍키에게, 없으면 판다
  const mk = run.units.find((u) => u.defId === 'mingki');
  for (let i = run.inventory.length - 1; i >= 0; i--) if (isJunk(run.inventory[i])) { if (!(mk && mk.items.includes(null) && R.equip(run, i, mk.uid) === null)) R.sellItem(run, i); }
  manageItems(run);
  for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
  while (run.credits >= 30 + R.xpCost(run)) {
    const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank && !R.isRock(x)).sort((a, b) => a.rank - b.rank)[0];
    if (!u || !R.buyXp(run, u.uid)) break;
  }
  R.autoPlace(run);
}

const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
function playRun(seed: number) {
  const bot = new Rng(seed * 7 + 1);
  const starters = bot.sample(STARTERS, CFG.startUnits);
  const run = R.newRun(seed, starters, undefined, DIFF);
  if (ID !== 'none') run.despairs = [ID]; // 특권 고르기 전에 걸어 둔다 (추가 계약 영입도 영향을 받게)
  let battles = 0;
  while (!run.over && !run.cleared && run.phase <= 25 && battles < 300) {
    resolvePending(run, bot);
    manage(run);
    resolvePending(run, bot);
    if (run.cleared) break;
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
    const b = buildBattle(run, run.node.enc!, false);
    b.runToEnd();
    battles++;
    R.resolveBattle(run, b);
  }
  return { cleared: run.cleared, phase: run.phase };
}

let clears = 0, phase = 0;
for (let i = 0; i < N; i++) { const r = playRun((START + i) * 1013); if (r.cleared) clears++; phase += r.phase; }
console.log(JSON.stringify({ d: DIFF, id: ID, n: N, start: START, clears, phase, over: process.argv.slice(6).join(' ') }));
