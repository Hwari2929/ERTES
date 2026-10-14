// 밸런스 분석용 계측 시뮬레이션: 런마다 JSON 한 줄을 출력한다.
// 실행: node dist/analyze.cjs <시작 시드 번호> <런 수> > out.jsonl   (집계는 tests/analyze_report.py)
import { CFG } from '../src/config';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { ENG_HOOK, SYN_BY_ID, SYNERGIES, tierOf } from '../src/data/synergies';
import { buildBattle, deployed, memberships, synergyCounts } from '../src/engine/build';
import * as R from '../src/engine/run';
import { augChoice, pilgrimBot } from './botlib';
import { Rng } from '../src/rng';
import type { Major, RunState } from '../src/types';

declare const process: { argv: string[]; stdout: { write(s: string): void } };

const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
const totalRank = (run: RunState) => run.units.reduce((s, u) => s + u.rank, 0);
const itemCount = (run: RunState) => run.inventory.length + run.units.reduce((s, u) => s + u.items.filter(Boolean).length + (u.mod ? 1 : 0), 0);
const permSum = (run: RunState) => run.units.reduce((s, u) => s + u.perm.vit + u.perm.pow + u.perm.mnd + u.perm.def + u.perm.agi, 0);
const snap = (run: RunState) => ({ cr: run.credits, hp: run.hp, mhp: run.maxHp, rank: totalRank(run), items: itemCount(run), perm: permSum(run), boons: run.boons.length + run.phaseBoons.length, units: run.units.length, power: run.power, fame: run.fame, loan: run.loan });

interface EvRec { id: string; c: number; ph: number; d: Record<string, number> }

function playRun(seed: number) {
  const bot = new Rng(seed * 7 + 1);
  const starters = bot.sample(STARTERS, CFG.startUnits);
  const run = R.newRun(seed, starters);
  const events: EvRec[] = [];
  const battles: { ph: number; t: string; won: boolean; boss?: string; dmg: Record<string, number>; sup: Record<string, number>; died: string[]; tac: number }[] = [];
  const synMax: Record<string, number> = {};
  const unitDeploy: Record<string, number> = {};
  let deathBy: string | null = null;
  let investN = 0, investBuy = 0;

  const resolvePending = () => {
    while (run.pending.length) {
      const p = run.pending[0];
      if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; }
      if (p.t === 'event') {
        const order = bot.shuffle([0, 1, 2]);
        let done = false;
        for (const i of order) {
          const before = snap(run);
          if (R.chooseEvent(run, i) === null && run.pending[0] !== p) {
            const after = snap(run);
            const d: Record<string, number> = {};
            for (const k of Object.keys(before) as (keyof typeof before)[]) if (after[k] !== before[k]) d[k] = after[k] - before[k];
            events.push({ id: p.id, c: i, ph: run.phase, d });
            done = true; break;
          }
        }
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
        const have = new Map<string, number>();
        for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
        const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
        R.recruit(run, p.options.slice().sort((x, y) => score(y) - score(x))[0]);
      } else if (p.t === 'supply') R.takeSupply(run, p.options[0]);
      else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
      else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
      else if (p.t === 'fork') { R.pickFork(run, run.hp > 60 && bot.chance(0.5) ? 'challenge' : 'rest'); continue; }
    else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
      run.pending.shift();
    }
  };
  const manage = () => {
    const sorted = run.units.filter((u) => u.pos).sort((a, b) => b.rank - a.rank);
    for (let i = run.inventory.length - 1; i >= 0; i--) {
      const id = run.inventory[i];
      if (!id.startsWith('M_')) continue;
      const t = sorted.find((u) => !u.mod && !memberships(u).includes(id.slice(2) as never));
      if (t) R.equip(run, i, t.uid);
    }
    for (let guard = 0; guard < 20 && run.inventory.some((x) => !x.startsWith('M_')); guard++) {
      const idx = run.inventory.findIndex((x) => !x.startsWith('M_'));
      const it = run.inventory[idx];
      let target = sorted.find((u) => it[0] === 'C' && u.items.some((x) => x && x[0] === 'C')) || sorted.find((u) => u.items.includes(null));
      if (!target && it[0] !== 'C') {
        target = sorted.find((u) => u.items.some((x) => x && x[0] === 'C'));
        if (target) { const k = target.items.findIndex((x) => x && x[0] === 'C'); R.unequip(run, target.uid, k); }
      }
      if (!target || R.equip(run, idx, target.uid)) break;
    }
    // 함대 확장: 출전 인원이 보유 기물보다 적으면 우선 구매 (예비 15 남김)
    for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
    while (run.credits >= 30 + R.xpCost(run)) {
      const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
      if (!u || !R.buyXp(run, u.uid)) break;
    }
    R.autoPlace(run);
  };

  let n = 0;
  while (!run.over && !run.cleared && n < 200) {
    resolvePending(); manage(); resolvePending();
    if (!run.node) {
      const opts = R.currentOptions(run);
      R.enterNode(run, opts.includes('adversity') && run.hp > 60 && bot.chance(0.5) ? 'adversity' : opts[0]);
      if (run.pending[0]?.t === 'branch') resolvePending();
      const t = (run.node as { type: string } | null)?.type;
      if (t === 'shop') for (let i = 0; i < 6; i++) if (run.credits >= 35) R.buyShop(run, i);
      if (t === 'news') for (let i = 0; i < 6; i++) R.buyNews(run, i);
      if (t === 'invest') { investN++; for (let i = 0; i < 5; i++) if (run.credits >= 30 && !R.buyInvest(run, i)) investBuy++; }
      if (t === 'shop' || t === 'news' || t === 'invest') R.leaveShop(run);
      continue;
    }
    const dep = deployed(run);
    const counts = synergyCounts(dep, run);
    for (const s of SYNERGIES) { const t = tierOf(s.id, counts[s.id] || 0); if (t > (synMax[s.id] || 0)) synMax[s.id] = t; }
    for (const u of dep) unitDeploy[u.defId] = (unitDeploy[u.defId] || 0) + 1;
    const enc = run.node.enc!;
    const b = buildBattle(run, enc, false);
    b.runToEnd();
    n++;
    const dmg: Record<string, number> = {}, sup: Record<string, number> = {};
    const died: string[] = [];
    for (const c of b.units) {
      if (c.side !== 0) continue;
      const owner = c.isSummon && c.owner ? c.owner : c;
      if (!owner.src) continue;
      const id = owner.defId;
      dmg[id] = (dmg[id] || 0) + c.counters.dmg;
      sup[id] = (sup[id] || 0) + c.counters.healed + c.counters.shield;
      if (!c.isSummon && !c.alive) died.push(id);
    }
    const bossId = enc.enemies.map((e) => ENEMY_BY_ID[e.defId]).find((e) => e.tier === 'boss')?.id;
    battles.push({ ph: run.phase, t: run.node.type, won: b.winner === 0, boss: bossId, dmg, sup, died, tac: b.tac[0] });
    const ph = run.phase, type = run.node.type;
    R.resolveBattle(run, b);
    if (run.over) deathBy = `${type}:${ph}${bossId ? ':' + bossId : ''}`;
  }
  return {
    seed, starters, field: run.field, cleared: run.cleared, phase: run.phase, hp: run.hp, deathBy,
    used: run.usedIds, final: run.units.map((u) => ({ id: u.defId, rank: u.rank, dep: !!u.pos, augs: u.augments.map((a) => a.id) })),
    synMax, unitDeploy, events, battles, credits: run.credits, power: run.power, boons: run.boons, globals: run.globals,
    invest: investN, investBuy,
  };
}

// 비교 실험: 4번째 인자 noTurret / noBlink
const variant = process.argv[4] || '';
if (variant === 'noTurret') ENG_HOOK.spawn = () => {};
if (variant === 'noBlink') {
  const s = SYN_BY_ID.INFIL, orig = s.member!;
  s.member = (t, ctx) => { const e = orig(t, ctx)!; return { ...e, hooks: { onKill: e.hooks?.onKill } }; };
}
const start = Number(process.argv[2] || 0), count = Number(process.argv[3] || 10);
for (let i = start; i < start + count; i++) process.stdout.write(JSON.stringify(playRun(i * 1013 + 17)) + '\n');
