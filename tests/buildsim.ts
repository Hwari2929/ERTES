// 빌드 가이드용 조합 시뮬레이션 (게임 규칙은 바꾸지 않고 계측만).
// 빌드: npx esbuild tests/buildsim.ts --bundle --platform=node --format=cjs --outfile=X.cjs
// 실행:
//   node X.cjs calib <시작 시드> <런 수> [목표 조합 id,id,..] → 봇 풀런에서 페이즈별 출전 인원 · 평균 등급 · 장비 수 · 승률 (고정 보드 기준 잡기)
//   node X.cjs comps <comps.json> <i0> <i1> [빌드 시드 수] [rank, 0=페이즈별] [위험 등급] → 조합 i0..i1-1 을 전장 5 × 페이즈 3–6 × 노드(전투 · 역경 · 보스)에 붙인다
//   comps.json: [{ id, units: [defId...], items?: {defId: [itemId...]} }]
import { CFG } from '../src/config';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { FIELDS } from '../src/data/battlefields';
import { ULTS } from '../src/data/ults';
import { SYNERGIES, tierOf } from '../src/data/synergies';
import { deployed, synergyCounts, buildBattle } from '../src/engine/build';
import { Battle, type CUnit, type DmgOpts, type DmgResult } from '../src/engine/combat';
import * as R from '../src/engine/run';
import { manageItems, shopSynth, pilgrimBot, forkChoice } from './botlib';
import { Rng } from '../src/rng';
import type { AugPick, Major, RunState, NodeType } from '../src/types';

declare const process: { argv: string[]; stdout: { write(s: string): void }; stderr: { write(s: string): void } };
declare function require(x: string): { readFileSync(p: string, e: string): string };

const MODE = process.argv[2];

// ───────── 계측: 아군 → 적 피해 (실제 감소분), 치명타, 궁극기
interface Tap { dmg: number; hits: { t: number; v: number }[]; crit: number; hitsN: number; maxHit: number; ults: number; per: Map<CUnit, number> }
let TAP: Tap | null = null;
const actorOf = (u: CUnit) => (u.isSummon && u.owner ? u.owner : u);
const P = Battle.prototype;
const oDeal = P.dealDamage, oRaw = P.rawHit;
function note(b: Battle, src: CUnit, tgt: CUnit, amt: number, pre: number, crit: boolean) {
  if (!TAP || actorOf(src).side !== 0 || tgt.side !== 1) return;
  const eff = Math.min(amt, pre);
  if (eff <= 0) return;
  TAP.dmg += eff;
  TAP.hits.push({ t: b.t, v: eff });
  TAP.hitsN++;
  if (crit) TAP.crit++;
  if (eff > TAP.maxHit) TAP.maxHit = eff;
  const a = actorOf(src);
  TAP.per.set(a, (TAP.per.get(a) || 0) + eff);
}
P.dealDamage = function (this: Battle, src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
  const pre = tgt.alive ? Math.max(0, tgt.hp) + tgt.shield : 0;
  const r = oDeal.call(this, src, tgt, base, o);
  if (r.amount > 0) note(this, src, tgt, r.amount, pre, !!r.crit);
  return r;
};
P.rawHit = function (this: Battle, src: CUnit, tgt: CUnit, amt: number, elem) {
  const pre = tgt.alive ? Math.max(0, tgt.hp) + tgt.shield : 0;
  const r = oRaw.call(this, src, tgt, amt, elem);
  if (r > 0) note(this, src, tgt, r, pre, false);
  return r;
};
for (const ult of Object.values(ULTS)) {
  const oc = ult.cast;
  ult.cast = (b, u) => { const ok = oc(b, u); if (ok && TAP && u.side === 0) TAP.ults++; return ok; };
}
/** 3초 창 최대 피해 */
function burst(hits: { t: number; v: number }[], w = 3) {
  let best = 0, s = 0, j = 0;
  for (let i = 0; i < hits.length; i++) {
    s += hits[i].v;
    while (hits[i].t - hits[j].t > w) { s -= hits[j].v; j++; }
    if (s > best) best = s;
  }
  return best;
}

// ───────── 펜딩 해소 (증강 · 학파 · 스탯 배분은 시드 난수로)
function resolve(run: RunState, bot: Rng) {
  for (let g = 0; g < 500 && run.pending.length; g++) {
    const p = run.pending[0];
    if (p.t === 'rankup') {
      const u = run.units.find((x) => x.uid === p.uid)!;
      const pref: Major[] = UNIT_BY_ID[u.defId].range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
      if (!p.allocDone) while (R.allocRank(run, p, pref) === 'again'); // 대성공이면 같은 능력치를 한 번 더
      R.ensureRankupOptions(run, p);
      const o = p.options || [];
      if (o.length) R.chooseAug(run, p.uid, p.kind === 'school' ? o[0] : bot.pick(o as AugPick[]));
    }
    run.pending.shift();
  }
}

// ═════════ calib: 봇 풀런 (probe2 · balance 봇과 같은 결정)
const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
/** 조합 지향 봇: 목표 기물로 시작 · 영입 우선 · 지정 소집 · 목표 기물 우선 출전 (null = 기본 봇) */
let TARGET: string[] | null = null;
function steer(run: RunState) {
  if (!TARGET) return;
  const tg = TARGET;
  const missing = tg.filter((id) => !run.units.some((u) => u.defId === id));
  if (missing.length && run.units.length < CFG.maxParty && run.credits >= R.musterCost(run) + 10 && !run.pending.length && !run.node) {
    const cnt = new Map<string, number>();
    for (const id of missing) for (const x of [...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits]) if (R.musterSyns().includes(x)) cnt.set(x, (cnt.get(x) || 0) + 1);
    const syns = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, CFG.musterPicks).map((x) => x[0]);
    for (const x of R.musterSyns()) if (syns.length < CFG.musterPicks && !syns.includes(x)) syns.push(x);
    if (R.openMuster(run) === null && R.confirmMuster(run, syns) !== null) R.cancelMuster(run);
  }
  // 출전: 목표 기물 먼저 (등급 순), 남는 자리는 다른 기물
  const order = run.units.slice().sort((a, b) => (tg.includes(b.defId) ? 1 : 0) - (tg.includes(a.defId) ? 1 : 0) || b.rank - a.rank);
  for (const u of run.units) u.pos = null;
  R.autoPlace(run, order);
}
function calibRun(seed: number, out: Record<string, Record<string, number>>) {
  const bot = new Rng(seed * 7 + 1);
  const pool = TARGET ? TARGET.filter((id) => !UNIT_BY_ID[id].noStarter) : STARTERS;
  const run = R.newRun(seed, bot.sample(pool, Math.min(CFG.startUnits, pool.length)), undefined, 0);
  const resolvePending = () => {
    while (run.pending.length) {
      const p = run.pending[0];
      if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; }
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
        const o = p.options || [];
        if (o.length) R.chooseAug(run, p.uid, p.kind === 'school' ? o[0] : bot.pick(o));
      } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
      else if (p.t === 'recruit') {
        const have = new Map<string, number>();
        for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
        const score = (id: string) => { const d = UNIT_BY_ID[id]; return (TARGET?.includes(id) ? 100 : 0) + [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
        R.recruit(run, p.options.slice().sort((x, y) => score(y) - score(x))[0]);
      } else if (p.t === 'supply') R.flipAllSupply(run, p);
      else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
      else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
      else if (p.t === 'fork') { R.pickFork(run, forkChoice(run, () => bot.chance(0.5))); continue; }
      else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
      run.pending.shift();
    }
  };
  const manage = () => {
    manageItems(run);
    for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
    while (run.credits >= 30 + R.xpCost(run)) {
      const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
      if (!u || !R.buyXp(run, u.uid)) break;
    }
    R.autoPlace(run);
    if (TARGET) { resolvePending(); steer(run); resolvePending(); steer(run); }
  };
  let n = 0;
  while (!run.over && !run.cleared && n < 200) {
    resolvePending(); manage(); resolvePending();
    if (run.node?.synth) { shopSynth(run); continue; }
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
    const ph = run.phase, nt = run.node.type;
    const dep = deployed(run);
    const b = buildBattle(run, run.node.enc!, false);
    b.runToEnd();
    const k = `${Math.min(ph, 7)}|${nt}`;
    const a = (out[k] ??= {});
    const add = (x: string, v: number) => (a[x] = (a[x] || 0) + v);
    add('n', 1); add('win', b.winner === 0 ? 1 : 0); add('dep', dep.length);
    add('rank', dep.reduce((s, u) => s + u.rank, 0) / Math.max(1, dep.length));
    add('items', dep.reduce((s, u) => s + u.items.filter((x) => x && /^[CGAL]_/.test(x)).length, 0) / Math.max(1, dep.length));
    add('adv', dep.reduce((s, u) => s + u.items.filter((x) => x && /^[AL]_/.test(x)).length, 0) / Math.max(1, dep.length));
    add('tgt', TARGET ? dep.filter((u) => TARGET!.includes(u.defId)).length : 0); add('dur', b.t); add('credits', run.credits); add('fame', run.fame || 0);
    R.resolveBattle(run, b);
  }
  const f = (out['run'] ??= {});
  f.n = (f.n || 0) + 1; f.clear = (f.clear || 0) + (run.cleared || run.endless ? 1 : 0); f.phase = (f.phase || 0) + run.phase;
}

// ═════════ comps: 고정 조합 전투
/** causal: 청라공국 조합의 무휼 인과율 (페이즈 → 누적 인과율, 없으면 0 = 인과 1단계) */
interface Comp { id: string; units: string[]; items?: Record<string, string[]>; pos?: Record<string, [number, number]>; turretGear?: (string | null)[][]; mods?: Record<string, string>; causal?: Record<string, number> }
/** 기본 장비: 근접 탱커 = 수호자 판금 + 요새 장갑, 원거리 사격 = 조준 보조 AI + 고속 연사, 기술 = 사이오닉 증폭기 + 예지 회로, 근접 딜러 = 광전사 + 과출력 */
function defaultItems(id: string): string[] {
  const d = UNIT_BY_ID[id];
  if (d.range <= 1) return d.ctype === 'VAN' ? ['A_vit_def', 'A_def_def'] : ['A_vit_def', 'A_pow_pow'];
  const tech = d.ttype === 'psionic' || d.base.mnd > d.base.pow;
  return tech ? ['A_mnd_mnd', 'A_mnd_agi'] : ['A_pow_mnd', 'A_pow_agi'];
}
let ECON: Record<number, { credits: number; fame: number }> = {};
function buildRun(comp: Comp, field: string, phase: number, rank: number, seed: number, diff = 0): RunState {
  const bot = new Rng(seed * 31 + 7);
  const run = R.newRun(seed, [], field, diff);
  run.pending = [];
  run.phase = phase;
  run.fleet = Math.max(0, comp.units.length - CFG.deployBase);
  for (const id of comp.units) {
    const u = R.addUnit(run, id, 1);
    resolve(run, bot); // 학파 · 합류 증강
    u.items = [...(u.items[0] ? [u.items[0]] : []), ...(comp.items?.[id] || defaultItems(id))].slice(0, 3) as (string | null)[];
    while (u.items.length < 3) u.items.push(null);
    if (comp.mods?.[id]) u.mod = comp.mods[id]; // 개조부품 (문장 등)
  }
  // 등급: addUnit 의 rankUp 경로 대신 settleXp 로 올린다 (이정표 보상 동일)
  for (const u of run.units) {
    while (u.rank < rank) { u.xp = CFG.xpToNext(u.rank); R.settleXp(run, u); resolve(run, bot); }
    u.xp = 0;
  }
  // 경제 상태: 페이즈별 봇 평균 (calib) 근사
  run.credits = ECON[phase]?.credits ?? 40; run.fame = ECON[phase]?.fame ?? 0;
  // 헬레니우스: 단계 도달 시 받는 동맹 장비를 동맹 기물 빈 칸에
  const hel = run.units.filter((u) => UNIT_BY_ID[u.defId].factions.includes('HEL'));
  const helItems = ['A_helanchor', 'A_hellight', 'A_helrelic'].slice(0, hel.length >= 7 ? 3 : hel.length >= 5 ? 2 : hel.length >= 3 ? 1 : 0);
  for (const it of helItems) { const t = hel.find((u) => u.items.includes(null)); if (t) t.items[t.items.indexOf(null)] = it; }
  if (comp.causal) run.causal = comp.causal[String(phase)] ?? 0; // 청라공국: 페이즈별 무휼 인과율 (봇 청라 런 기준)
  if (comp.turretGear) run.turretGear = comp.turretGear.map((g) => g.slice()); // 포탑 전용 장비 (포탑 순서대로)
  // 배치: 근접 = 앞줄(r=2), 원거리 = 뒷줄(r=0), 지정 좌표 우선
  const used = new Set<string>();
  const ord = run.units.slice().sort((a, b) => UNIT_BY_ID[a.defId].range - UNIT_BY_ID[b.defId].range);
  for (const u of ord) {
    const fixed = comp.pos?.[u.defId];
    if (fixed) { u.pos = { c: fixed[0], r: fixed[1] }; used.add(`${fixed[0]},${fixed[1]}`); continue; }
    const d = UNIT_BY_ID[u.defId];
    const rows = d.range <= 1 ? [2, 1, 0] : d.range <= 3 ? [1, 0, 2] : [0, 1, 2];
    outer: for (const r of rows) for (const c of [3, 2, 4, 1, 5, 0, 6]) if (!used.has(`${c},${r}`)) { u.pos = { c, r }; used.add(`${c},${r}`); break outer; }
  }
  return run;
}

function runComps() {
  const fs = require('fs');
  const comps: Comp[] = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const i0 = +process.argv[4] || 0, i1 = Math.min(comps.length, +process.argv[5] || comps.length);
  const NS = +process.argv[6] || 6;
  const RANK = +process.argv[7] || 0; // 0 = 페이즈별 기준 등급
  const PH_RANK: Record<number, number> = { 3: 9, 4: 10, 5: 12, 6: 13 }; // 봇 풀런 보스전 평균 등급 근사
  const DIFF = +process.argv[8] || 0;
  // BS_NOADD=1: 위험 등급 적 증원(CFG.diffAdd)을 끈다 (증원 도입 전 측정과 비교용)
  if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BS_NOADD) CFG.diffAdd = [];
  const NODES: { t: NodeType; step: number }[] = [{ t: 'battle', step: 6 }, { t: 'adversity', step: 7 }, { t: 'boss', step: 11 }];
  ECON = Object.fromEntries([3, 4, 5, 6].map((p) => [p, { credits: 40, fame: 10 * (p - 1) }]));
  const res: unknown[] = [];
  for (let ci = i0; ci < i1; ci++) {
    const comp = comps[ci];
    const rows: unknown[] = [];
    // 조합의 활성 시너지 단계 (보고서에서 시너지 ↔ 조합 연결용)
    const syn: Record<string, [number, number]> = {};
    { const r0 = buildRun(comp, FIELDS[0].id, 5, PH_RANK[5], 1, DIFF); const cnt = synergyCounts(deployed(r0), r0) as Record<string, number>;
      for (const x of SYNERGIES) { const t = tierOf(x.id, cnt[x.id] || 0); if (t > 0) syn[x.id] = [cnt[x.id] || 0, t]; } }
    const FL = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BS_FIELDS?.split(',');
    const PHS = DIFF ? [5, 6] : [3, 4, 5, 6]; // 고위험은 후반(5 · 6페이즈)만 본다
    for (const f of FIELDS.filter((x) => !FL || FL.includes(x.id))) for (const ph of PHS) for (let s = 0; s < NS; s++) {
      const seed = 100000 + ph * 1000 + s * 17 + FIELDS.indexOf(f) * 7;
      const run = buildRun(comp, f.id, ph, RANK || PH_RANK[ph], seed, DIFF);
      for (const nd of NODES) {
        run.step = nd.step;
        run.rng = seed * 13 + nd.step;
        const enc = R.genEncounter(run, nd.t, ph);
        const b = buildBattle(run, enc, false);
        TAP = { dmg: 0, hits: [], crit: 0, hitsN: 0, maxHit: 0, ults: 0, per: new Map() };
        b.runToEnd();
        const T = TAP; TAP = null;
        const allies = b.units.filter((u) => u.side === 0 && !u.isSummon);
        const ehp = b.units.filter((u) => u.side === 1).reduce((s2, u) => s2 + u.st.maxHp, 0);
        let top = 0; for (const v of T.per.values()) top = Math.max(top, v);
        rows.push({
          f: f.id, ph, t: nd.t, s, w: b.winner === 0 ? 1 : 0, dur: +b.t.toFixed(2), surv: allies.filter((u) => u.alive).length, n: allies.length,
          hpLeft: +(allies.reduce((s2, u) => s2 + Math.max(0, u.hp), 0) / allies.reduce((s2, u) => s2 + u.st.maxHp, 0)).toFixed(3),
          dmg: Math.round(T.dmg), dps: Math.round(T.dmg / Math.max(1, b.t)), burst: Math.round(burst(T.hits)), maxHit: Math.round(T.maxHit),
          crit: +(T.crit / Math.max(1, T.hitsN)).toFixed(3), per: Object.fromEntries([...T.per].filter(([u]) => u.side === 0).map(([u, v]) => [u.defId, +(v / Math.max(1, T.dmg)).toFixed(3)])), ults: T.ults, ehp: Math.round(ehp), topShare: +(top / Math.max(1, T.dmg)).toFixed(3),
        });
      }
    }
    res.push({ id: comp.id, syn, rows });
    process.stderr.write(`${comp.id} done\n`);
  }
  process.stdout.write(JSON.stringify(res));
}

if (MODE === 'calib') {
  const out: Record<string, Record<string, number>> = {};
  const s0 = +process.argv[3] || 1, n = +process.argv[4] || 20;
  if (process.argv[5]) TARGET = process.argv[5].split(',');
  if (TARGET) for (const id of TARGET) if (!UNIT_BY_ID[id]) throw new Error(id);
  for (let i = 0; i < n; i++) calibRun(s0 + i, out);
  process.stdout.write(JSON.stringify(out));
} else if (MODE === 'comps') runComps();
if (MODE === 'debug') {
  const fs = require('fs');
  const comps: Comp[] = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const comp = comps[+process.argv[4] || 0];
  const ph = +process.argv[5] || 4;
  ECON = { [ph]: { credits: 40, fame: 0 } };
  const run = buildRun(comp, process.argv[6] || 'waste', ph, +process.argv[7] || 9, 123);
  if (process.argv.includes('noitems')) for (const u of run.units) u.items = [u.items[0] && /^U_/.test(u.items[0]) ? u.items[0] : null, null, null];
  run.step = 11;
  const enc = R.genEncounter(run, 'boss', ph);
  const b = buildBattle(run, enc, false);
  for (const u of b.units) process.stdout.write(`${u.side} ${u.defId} rank=${u.src?.rank ?? '-'} hp=${Math.round(u.st.maxHp)} sh=${Math.round(u.st.shoot)} st=${Math.round(u.st.strike)} te=${Math.round(u.st.tech)} ar=${Math.round(u.st.armor)} items=${u.src?.items.join(',') ?? ''} augs=${u.src?.augments.map((a) => a.id).join(',') ?? ''}\n`);
  b.runToEnd();
  process.stdout.write(`winner=${b.winner} t=${b.t.toFixed(1)}\n`);
}
