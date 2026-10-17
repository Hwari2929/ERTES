// 상세 밸런스 계측 시뮬레이션: 런을 돌리며 전투 · 기물 · 유형 상성 · 시너지 · 장비 지표를 집계한다.
// 실행: node dist/balance.cjs <시작 시드> <런 수> [반사실 표본 비율] > part.json   (집계는 tests/balance_report.py)
// - 시너지 기여 피해: 표본 전투를 같은 시드로 '그 시너지만 끈 상태'로 다시 돌려 아군 총 피해 차이를 잰다.
import { CFG } from '../src/config';
import { ENEMY_BY_ID, enemyTypes } from '../src/data/enemies';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { SYNERGIES, tierOf } from '../src/data/synergies';
import { boardDims, buildAlly, buildEnemy, deployed, enemyCell, layout, memberships, synergyCounts } from '../src/engine/build';
import { Battle, type CUnit, type DmgOpts, type DmgResult } from '../src/engine/combat';
import * as R from '../src/engine/run';
import { augChoice, forkChoice, manageItems, shopSynth, type Track, pilgrimBot } from './botlib';
import { Rng } from '../src/rng';
import { RELICS } from '../src/data/relics';
import { FIELDS } from '../src/data/battlefields';
import { fieldSyn, starterPool } from '../src/engine/starters';
import type { Major, RunState, SynergyId } from '../src/types';

declare const process: { argv: string[]; stdout: { write(s: string): void }; stderr: { write(s: string): void } };

const START = +process.argv[2] || 1;
const COUNT = +process.argv[3] || 10;
const CF_RATE = process.argv[4] !== undefined ? +process.argv[4] : 0.06;
/** 위험 등급 (기본 0). 2 이상이면 적 장비 · 개조부품이 실제 게임처럼 붙는다. 쉬움 3 · 모험 6 · 고난 7 (고난은 절망 증강을 봇이 무작위로 고른다) */
const DIFF = +process.argv[5] || 0;
/** detail: 런마다 기물 · 증강 · 성유물별 [전투 수, 승리] 기록 (군집 신뢰구간용). randrelic: 디바인 성유물을 무작위로 장착 (성유물 효과 분리 실험) */
const DETAIL = process.argv.includes('detail');
const RANDREL = process.argv.includes('randrelic');
/** field=<id>: 전장 고정 (전장별 클리어율 비교) */
const FORCE_FIELD = process.argv.find((a) => a.startsWith('field='))?.slice(6);
/** pool: 실제 게임처럼 계약 기물 후보(engine/starters.ts, 전장 우세 시너지 보장)에서 고른다 — 우세 시너지 기물 먼저 (최대 CFG.starterFav명), 나머지는 무작위.
 *  없으면 예전처럼 시작 가능한 기물 전체에서 무작위 4명 (예전 기록과 비교용) */
const POOL = process.argv.includes('pool') || process.argv.includes('pool0');
/** pool0: 같은 정책이되 우세 시너지 보장 없이 무작위 후보 (보장 효과만 따로 보려는 비교용) */
if (process.argv.includes('pool0')) CFG.starterFav = 0;

// ───────── 집계 저장소 (합으로만 누적 → 워커끼리 더하면 된다)
type Acc = Record<string, number>;
const agg: Record<string, Record<string, Acc>> = {};
function add(table: string, key: string, vals: Acc) {
  const t = (agg[table] ??= {});
  const a = (t[key] ??= {});
  for (const [k, v] of Object.entries(vals)) a[k] = (a[k] || 0) + v;
}

// ───────── 피해 계측: 공격자 · 대상 유형별 기본 피해 / 실제 피해 / 빗나감
interface Tap { pair: Acc; evaded: Map<CUnit, number> }
let tap: Tap | null = null;
const origDeal = Battle.prototype.dealDamage;
const actorOf = (u: CUnit) => (u.isSummon && u.owner ? u.owner : u);
function typesOf(u: CUnit): { ct: string; tt: string } {
  const a = actorOf(u);
  if (a.side === 1) { const d = ENEMY_BY_ID[a.defId]; if (d) { const t = enemyTypes(d); return { ct: t.ctype, tt: t.ttype }; } }
  return { ct: a.ctype || '?', tt: a.ttype || '?' };
}
Battle.prototype.dealDamage = function (this: Battle, src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
  const r = origDeal.call(this, src, tgt, base, o);
  if (tap && base > 0 && src.side !== tgt.side) {
    const s = typesOf(src), t = typesOf(tgt);
    const side = actorOf(src).side === 0 ? 'A' : 'E';
    const kc = `${side}|ct|${s.ct}>${t.ct}`, kt = `${side}|tt|${s.tt}>${t.tt}`;
    for (const k of [kc, kt]) {
      tap.pair[`${k}|base`] = (tap.pair[`${k}|base`] || 0) + base;
      tap.pair[`${k}|dealt`] = (tap.pair[`${k}|dealt`] || 0) + r.amount;
      tap.pair[`${k}|hits`] = (tap.pair[`${k}|hits`] || 0) + 1;
      if (r.miss) tap.pair[`${k}|miss`] = (tap.pair[`${k}|miss`] || 0) + 1;
      if (r.crit) tap.pair[`${k}|crit`] = (tap.pair[`${k}|crit`] || 0) + 1;
    }
    if (r.miss) tap.evaded.set(tgt, (tap.evaded.get(tgt) || 0) + base);
  }
  return r;
};

/** buildBattle 과 같되 시너지 인원을 덮어쓸 수 있다 (반사실 실험용) */
function makeBattle(run: RunState, enc: NonNullable<NonNullable<RunState['node']>['enc']>, counts: Record<string, number>) {
  const dim = boardDims(enc.n);
  const b = new Battle(dim.w, dim.h, new Rng(enc.seed), { phase: enc.phase ?? run.phase, credits: run.credits, field: run.field, diff: run.diff, despairs: run.despairs?.length ? [...run.despairs] : undefined });
  b.keepEvents = false;
  const lay = layout(run, enc.n);
  for (const u of deployed(run)) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const c = buildAlly(b, run, u, counts as never);
    c.x = c.px = p.x; c.y = c.py = p.y;
    b.add(c);
  }
  for (const s of enc.enemies) {
    const e = buildEnemy(b, ENEMY_BY_ID[s.defId], enc.phase ?? run.phase, enc.mult, s); // 난이도 장비 · 개조부품 포함
    const ec = enemyCell(s.c, s.row, enc.n);
    e.x = e.px = ec.x; e.y = e.py = ec.y;
    if (b.unitAt(e.x, e.y)) { const f = b.freeCellNear(e.x, e.y); if (!f) continue; e.x = e.px = f.x; e.y = e.py = f.y; }
    b.add(e);
  }
  b.start();
  return b;
}
/** 아군 총 피해: 기물(소환물 포함) + 시너지 자체 효과 (사냥꾼 고정 피해 · 시린 신성 추가타 등) */
const allyDamage = (b: Battle) => b.units.filter((u) => u.side === 0).reduce((s, u) => s + u.counters.dmg, 0)
  + Object.values(b.synStats).reduce((s, x) => s + (x.side === 0 ? x.dmg : 0), 0);

const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
const runs: unknown[] = [];

function playRun(seed: number) {
  const bot = new Rng(seed * 7 + 1);
  let starters = bot.sample(STARTERS, CFG.startUnits);
  if (POOL) { // 전장은 newRun 과 같은 추첨 (시드 첫 난수)
    const pr = new Rng(seed * 13 + 5), field = FORCE_FIELD || new Rng(seed).pick(FIELDS).id, syn = fieldSyn(field);
    const pool = starterPool(pr, field);
    const fav = pr.shuffle(pool.filter((id) => !!syn && ([...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[]).includes(syn))).slice(0, CFG.starterFav);
    starters = [...fav, ...pr.sample(pool.filter((id) => !fav.includes(id)), CFG.startUnits - fav.length)];
  }
  const run = R.newRun(seed, starters, FORCE_FIELD, DIFF);
  const synMax: Record<string, number> = {};
  const det: Record<string, [number, number]> = {}; // detail 모드: `키|페이즈:노드` → [전투, 승리]
  const relicSet = new Set<string>();

  const resolvePending = () => {
    while (run.pending.length) {
      const p = run.pending[0];
      if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; }
      if (p.t === 'despair') { R.pickDespair(run, bot.int(0, p.options.length - 1)); continue; } // 고난: 절망 증강 무작위 (출격 · 페이즈 시작)
      if (p.t === 'event') {
        let done = false;
        for (const i of bot.shuffle([0, 1, 2])) if (R.chooseEvent(run, i) === null && run.pending[0] !== p) { done = true; break; }
        if (!done) run.pending.shift();
        continue;
      }
      if (p.t === 'victory') run.endless = true;
      if (p.t === 'global') R.pickGlobal(run, bot.pick(p.options));
      else if (p.t === 'rankup') {
        const u = run.units.find((x) => x.uid === p.uid)!;
        const pref: Major[] = UNIT_BY_ID[u.defId].range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
        if (!p.allocDone) while (R.allocRank(run, p, pref) === 'again'); // 대성공이면 같은 능력치를 한 번 더
        R.ensureRankupOptions(run, p);
        { const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a); }
      } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
      else if (p.t === 'recruit') {
        // 영입: 보유 기물과 시너지가 가장 많이 겹치는 기물 (+약간의 무작위)
        const have = new Map<string, number>();
        for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
        const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
        const pick = p.options.slice().sort((x, y) => score(y) - score(x))[0];
        for (const id of p.options) add('offer', id, { offered: 1, picked: id === pick ? 1 : 0 });
        R.recruit(run, pick);
      } else if (p.t === 'supply') R.takeSupply(run, p.options[0]);
      else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
      else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
      else if (p.t === 'fork') { R.pickFork(run, forkChoice(run, () => bot.chance(0.5))); continue; }
      else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
      run.pending.shift();
    }
  };
  const track: Track = (id, what) => add('cons', id, { [what]: 1 });
  const manage = () => {
    manageItems(run, track);
    // 함대 확장: 출전 인원이 보유 기물보다 적으면 우선 구매 (예비 15 남김)
    for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
    while (run.credits >= 30 + R.xpCost(run)) {
      const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
      if (!u || !R.buyXp(run, u.uid)) break;
    }
    R.autoPlace(run);
  };

  let n = 0, battles = 0;
  const usedUnits = new Set<string>();
  while (!run.over && !run.cleared && n < 200) {
    resolvePending(); manage(); resolvePending();
    if (run.node?.synth) { shopSynth(run, track); continue; }
    if (!run.node) {
      const opts = R.currentOptions(run);
      R.enterNode(run, opts.includes('adversity') && run.hp > 60 && bot.chance(0.5) ? 'adversity' : opts[0]);
      if (run.pending[0]?.t === 'branch') resolvePending();
      const t = (run.node as { type: string } | null)?.type;
      if (t === 'shop') for (let i = 0; i < 6; i++) if (run.credits >= 35) R.buyShop(run, i);
      if (t === 'news') for (let i = 0; i < 6; i++) R.buyNews(run, i);
      if (t === 'invest') for (let i = 0; i < 5; i++) if (run.credits >= 30) R.buyInvest(run, i);
      if (t === 'shop' || t === 'news' || t === 'invest') R.leaveShop(run);
      continue;
    }
    n++;
    const enc = run.node.enc!;
    const ph = run.phase, ntype = run.node.type;
    const dep = deployed(run);
    const counts = synergyCounts(dep, run) as Record<string, number>;
    for (const s of SYNERGIES) { const t = tierOf(s.id, counts[s.id] || 0); if (t > (synMax[s.id] || 0)) synMax[s.id] = t; }

    if (RANDREL) for (const u of run.units) if (UNIT_BY_ID[u.defId].ttype === 'divine' && !relicSet.has(u.uid)) { relicSet.add(u.uid); u.relic = RELICS[Math.floor(bot.next() * RELICS.length)].id; }
    tap = { pair: {}, evaded: new Map() };
    const b = makeBattle(run, enc, counts);
    b.runToEnd();
    const won = b.winner === 0;
    battles++;
    const T = tap; tap = null;
    for (const [k, v] of Object.entries(T.pair)) {
      const [side, kind, pair, f] = k.split('|');
      add(`mx_${side}_${kind}_${ph <= 2 ? 'early' : ph <= 4 ? 'mid' : 'late'}`, pair, { [f]: v });
      add(`mx_${side}_${kind}_all`, pair, { [f]: v });
    }

    // 기물별 집계 (소환물 피해는 주인에게)
    const per = new Map<string, { u: CUnit; dmg: number; heal: number; shield: number; taken: number; evaded: number; kills: number }>();
    for (const c of b.units) {
      if (c.side !== 0) continue;
      const o = actorOf(c);
      if (!o.src) continue;
      const r = per.get(o.defId) || { u: o, dmg: 0, heal: 0, shield: 0, taken: 0, evaded: 0, kills: 0 };
      r.dmg += c.counters.dmg; r.heal += c.counters.healed; r.shield += c.counters.shield; r.kills += c.counters.kills;
      if (!c.isSummon) { r.taken += c.counters.taken; r.evaded += T.evaded.get(c) || 0; }
      per.set(o.defId, r);
    }
    const teamDmg = [...per.values()].reduce((s, x) => s + x.dmg, 0) || 1;
    const teamTaken = [...per.values()].reduce((s, x) => s + x.taken, 0) || 1;
    const k = per.size || 1;
    const enemyDmg = b.units.filter((u) => u.side === 1).reduce((s, u) => s + u.counters.dmg, 0);
    const tot = { battles: 1, wins: won ? 1 : 0, dmg: 0, heal: 0, shield: 0, taken: 0, evaded: 0, kills: 0, deaths: 0, units: per.size, dur: b.t, enemyDmg };
    for (const [id, r] of per) {
      const d = UNIT_BY_ID[id];
      const died = !r.u.alive ? 1 : 0;
      usedUnits.add(id);
      tot.dmg += r.dmg; tot.heal += r.heal; tot.shield += r.shield; tot.taken += r.taken; tot.evaded += r.evaded; tot.kills += r.kills; tot.deaths += died;
      const row = { n: 1, wins: won ? 1 : 0, dmg: r.dmg, heal: r.heal, shield: r.shield, taken: r.taken, evaded: r.evaded, kills: r.kills, died,
        share: (r.dmg / teamDmg) * k, tshare: (r.taken / teamTaken) * k, rank: r.u.src!.rank, dur: b.t };
      add('unit', id, row);
      add('unit_ph', `${id}|${ph}`, row);
      add('ct', d.ctype, row); add('ct_ph', `${d.ctype}|${ph}`, row);
      add('tt', d.ttype, row); add('tt_ph', `${d.ttype}|${ph}`, row);
      add('cttt', `${d.ctype}|${d.ttype}`, row);
      // 사이오닉 학파 · 전공, 디바인 성유물 · 신권 대행 발동 (증강 위주 조정용)
      for (const g of r.u.src!.augments) if (g.id.startsWith('school.') || g.id.startsWith('psi.')) add('psiaug', `${g.id}|${ph}`, row);
      if (DETAIL) {
        const src = r.u.src!;
        const keys = [`u:${id}`, ...src.augments.filter((g) => !g.id.startsWith('ev.')).flatMap((g) => [`ua:${id}|${g.id}`, `a:${g.id}`])];
        if (d.ttype === 'divine') keys.push(`r:${src.relic || '-'}`, `ur:${id}|${src.relic || '-'}`);
        for (const key of keys) { const v = (det[`${key}|${ph}:${ntype}`] ??= [0, 0]); v[0]++; if (won) v[1]++; }
      }
      if (d.ttype === 'divine') add('relic', `${r.u.src!.relic || '-'}|${ph}`, { ...row, used: r.u.divUsed ? 1 : 0 });
      // 장비: 장착한 기물의 전투 승패 · 피해 점유
      const items = [...r.u.src!.items.filter((x): x is string => !!x), ...(r.u.src!.mod ? [r.u.src!.mod] : [])];
      for (const it of items) {
        const ir = { n: 1, wins: won ? 1 : 0, share: row.share, died };
        add('item', it, ir); add('item_ph', `${it}|${ph}`, ir);
        add('unit_item', `${id}|${it}`, ir); add('unit_item_ph', `${id}|${it}|${ph}`, ir);
        if (DETAIL) { const v = (det[`i:${it}|${ph}:${ntype}`] ??= [0, 0]); v[0]++; if (won) v[1]++; }
      }
      add('nitems', `${items.length}|${ph}`, { n: 1, wins: won ? 1 : 0, share: row.share });
    }
    add('phase', String(ph), tot);
    add('node', `${ph}|${ntype}`, { n: 1, wins: won ? 1 : 0, dur: b.t });
    // 시너지: 활성 단계별 전투 승률
    const active: string[] = [];
    for (const s of SYNERGIES) {
      const t = tierOf(s.id, counts[s.id] || 0);
      if (!t) continue;
      active.push(s.id);
      add('syn', `${s.id}|${t}`, { n: 1, wins: won ? 1 : 0 });
      add('syn_ph', `${s.id}|${t}|${ph}`, { n: 1, wins: won ? 1 : 0 });
      if (DETAIL) { const v = (det[`s:${s.id}|${t}|${ph}:${ntype}`] ??= [0, 0]); v[0]++; if (won) v[1]++; }
    }
    add('nsyn', `${active.length}|${ph}`, { n: 1, wins: won ? 1 : 0 });
    // 반사실: 표본 전투에서 활성 시너지를 하나씩 꺼 보고 아군 피해 · 승패 차이를 잰다
    if (active.length && bot.chance(CF_RATE)) {
      const full = allyDamage(b);
      for (const sid of active) {
        const c2 = { ...counts, [sid]: 0 };
        const b2 = makeBattle(run, enc, c2);
        b2.runToEnd();
        const tier = tierOf(sid as SynergyId, counts[sid] || 0);
        const v = { n: 1, full, without: allyDamage(b2), winFull: won ? 1 : 0, winWithout: b2.winner === 0 ? 1 : 0, durFull: b.t, durWithout: b2.t };
        add('cf', sid, v); add('cf_t', `${sid}|${tier}`, v); add('cf_ph', `${sid}|${ph}`, v);
      }
    }
    R.resolveBattle(run, b);
    if (run.over) add('death', `${ph}|${ntype}`, { n: 1 });
  }
  // 런 단위: 최종 장비 · 시너지 최고 단계 · 도달 페이즈
  const finalItems: Record<string, string[]> = {};
  for (const u of run.units) if (u.pos) finalItems[u.defId] = [...u.items.filter((x): x is string => !!x), ...(u.mod ? [u.mod] : [])];
  for (const id of run.inventory) if (id.startsWith('K_')) add('cons', id, { left: 1 });
  for (const u of run.units) if (u.mod?.startsWith('O_')) add('cons', u.mod, { equipped: 1 });
  add('cons', '_occult', { tier: run.occultTier || 0, runs: 1 });
  runs.push({ seed, starters, field: run.field, cleared: run.cleared, phase: run.phase, battles, used: [...usedUnits], final: run.units.map((u) => u.defId), synMax, finalItems, ...(DETAIL ? { det } : {}) });
}

for (let i = 0; i < COUNT; i++) {
  playRun(START + i);
  if ((i + 1) % 25 === 0) process.stderr.write(`${START}: ${i + 1}/${COUNT}\n`);
}
process.stdout.write(JSON.stringify({ agg, runs }));
