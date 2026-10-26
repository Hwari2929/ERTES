// 헤드리스 밸런스 시뮬레이션: 단순 봇이 런을 끝까지 진행하고 도달 페이즈/승률을 집계한다.
// 실행: npm run sim -- [런 수]
import { CFG } from '../src/config';
import { FIELDS } from '../src/data/battlefields';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { augChoice, forkChoice, manageItems, shopSynth, pilgrimBot, turretPickBot } from './botlib';
import { Rng } from '../src/rng';
import { MAJORS, type Major, type RunState } from '../src/types';

declare const process: { argv: string[]; env: Record<string, string | undefined> };

function resolvePending(run: RunState, bot: Rng) {
  while (run.pending.length) {
    const p = run.pending[0];
    if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; } // 대기열을 직접 정리함
    if (p.t === 'event') {
      // 가능한 선택지 중 무작위 (전부 막혀 있으면 건너뜀)
      const order = bot.shuffle([0, 1, 2]);
      let done = false;
      for (const i of order) if (R.chooseEvent(run, i) === null && run.pending[0] !== p) { done = true; break; }
      if (!done) run.pending.shift();
      continue;
    }
    if (p.t === 'victory') { R.continueEndless(run); continue; } // 시뮬레이션은 무한 모드로 계속
    if (p.t === 'global') R.pickGlobal(run, bot.pick(p.options));
    else if (p.t === 'rankup') {
      const u = run.units.find((x) => x.uid === p.uid)!;
      const d = UNIT_BY_ID[u.defId];
      const pref: Major[] = d.range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
      if (!p.allocDone) R.allocRank(run, p, pref); // 대성공이면 같은 능력치 2배
      R.ensureRankupOptions(run, p);
      { const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a); }
    } else if (p.t === 'turretPick') { turretPickBot(run); continue; } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
    else if (p.t === 'recruit') {
      // 현재 파티와 시너지가 가장 많이 겹치는 기물을 영입
      const have = new Map<string, number>();
      for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
      const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
      R.recruit(run, p.options.slice().sort((x, y) => score(y) - score(x))[0]);
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
  manageItems(run); // 장비 · 개조부품 · 소모품 (tests/botlib.ts)
  // 남는 크레딧(이자 구간 30 유지)으로 공명도 구매
  // 함대 확장: 출전 인원이 보유 기물보다 적으면 우선 구매 (예비 15 남김)
  for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
  while (run.credits >= 30 + R.xpCost(run)) {
    const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
    if (!u || !R.buyXp(run, u.uid)) break;
  }
  R.autoPlace(run);
}

/** 전투 직후 계측 (모드 'ult' 등): 전투 결과를 정산하기 전에 부른다 */
const onBattle: ((b: ReturnType<typeof buildBattle>, run: RunState) => void)[] = [];
function playRun(seed: number, force?: string, field?: string) {
  const bot = new Rng(seed * 7 + 1);
  const starters = force ? [force, ...bot.sample(STARTERS.filter((x) => x !== force), CFG.startUnits - 1)] : bot.sample(STARTERS, CFG.startUnits);
  const run = R.newRun(seed, starters, field);
  const phaseLog: Record<number, { w: number; l: number }> = {};
  let battles = 0;
  while (!run.over && run.phase <= 25 && battles < 300) {
    resolvePending(run, bot);
    manage(run);
    resolvePending(run, bot);
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
    for (const f of onBattle) f(b, run);
    battles++;
    const ph = run.phase;
    const key = run.node.type === 'boss' ? -ph : ph; // 음수 = 보스전
    phaseLog[key] = phaseLog[key] || { w: 0, l: 0 };
    if (b.winner === 0) phaseLog[key].w++; else phaseLog[key].l++;
    R.resolveBattle(run, b);
  }
  const items = [...run.inventory, ...run.units.flatMap((u) => u.items.filter((x): x is string => !!x))];
  const grade = (g: string) => items.filter((x) => x[0] === g).length;
  return { cleared: run.cleared, phase: run.phase, phaseLog, units: run.units.length, avgRank: run.units.reduce((s, u) => s + u.rank, 0) / run.units.length, items: { C: grade('C'), A: grade('A'), L: grade('L') } };
}

const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
const N = Number(process.argv[2] || 40);
if (process.argv[3] === 'fields') {
  // 전장별: 평균 도달 페이즈 · 페이즈별 승률
  for (const f of FIELDS) {
    let sum = 0;
    const wl: Record<number, { w: number; l: number }> = {};
    for (let i = 1; i <= N; i++) {
      const r = playRun(i * 2027, undefined, f.id);
      sum += r.phase;
      for (const [p, v] of Object.entries(r.phaseLog)) { wl[+p] = wl[+p] || { w: 0, l: 0 }; wl[+p].w += v.w; wl[+p].l += v.l; }
    }
    const rate = (k: number) => (wl[k] ? `${Math.round((wl[k].w / (wl[k].w + wl[k].l)) * 100)}%` : '-');
    console.log(`${f.name.padEnd(16)} 평균 ${(sum / N).toFixed(2)}  보스 P3 ${rate(-3)} P5 ${rate(-5)} P6 ${rate(-6)} P7 ${rate(-7)}  일반 P6 ${rate(6)} P7 ${rate(7)}`);
  }
  throw 0;
}
if (process.argv[3] === 'ult') {
  // SIM_ULTGAIN='{"basic":0,"skill":0,"hurt":0}' 처럼 행동 충전 계수를 바꿔 같은 시드로 비교한다
  if (process.env.SIM_ULTGAIN) Object.assign(CFG.ultGain, JSON.parse(process.env.SIM_ULTGAIN));
  // 궁극기 · 신권 대행 계측: 첫 궁극기 시각 · 전투당 사용 횟수 · 충전 출처 비중 (전투 유형별), 디바인 신권 대행 횟수 (서약 조합별)
  const med = (a: number[]) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : NaN; };
  const M = { durs: [] as number[], n: 0, uses: 0, first: [] as number[], src: {} as Record<string, number>, ct: {} as Record<string, { n: number; first: number[]; uses: number; hurt: number; tot: number }> };
  const D: Record<string, { n: number; acts: number; first: number[]; multi: number }> = {};
  const VOWS = ['vow.twice', 'vow.zeal', 'vow.share', 'vow.echo', 'vow.martyr'];
  onBattle.push((b) => {
    if (b.t < 3) return;
    M.durs.push(b.t);
    for (const c of b.units) {
      if (c.side !== 0 || !c.src) continue;
      const m = c.mem;
      if (c.ult) {
        M.n++; M.uses += m.ultN || 0; if (m.ultT1) M.first.push(m.ultT1);
        const k = (M.ct[c.ctype || "?"] ||= { n: 0, first: [], uses: 0, hurt: 0, tot: 0 });
        k.n++; k.uses += m.ultN || 0; if (m.ultT1) k.first.push(m.ultT1);
        for (const s of ['time', 'basic', 'skill', 'hurt', 'bonus']) { const v = m[`ug.${s}`] || 0; M.src[s] = (M.src[s] || 0) + v; k.tot += v; if (s === 'hurt') k.hurt += v; }
      }
      if (UNIT_BY_ID[c.src.defId]?.ttype === 'divine' && c.div !== null) {
        const own = VOWS.filter((v) => c.src!.augments.some((a) => a.id === v));
        const keys = ['전체', own.length ? own.map((v) => v.slice(4)).sort().join('+') : '(조합 서약 없음)'];
        if (own.includes('vow.twice') && own.includes('vow.zeal') && own.includes('vow.share')) keys.push('재림+열성+나눔');
        for (const key of keys) {
          const d = (D[key] ||= { n: 0, acts: 0, first: [], multi: 0 });
          d.n++; d.acts += m.divActs || 0; if (m.divT1) d.first.push(m.divT1); if ((m.divActs || 0) >= 2) d.multi++;
        }
      }
    }
  });
  for (let i = 1; i <= N; i++) playRun(i * 1013);
  const tot = Object.values(M.src).reduce((a, b) => a + b, 0) || 1;
  console.log(`전투 ${M.durs.length}회 · 전투 시간 중앙값 ${med(M.durs).toFixed(1)}초`);
  console.log(`메이저 ${M.n}기-전투 · 첫 궁극기 중앙값 ${med(M.first).toFixed(1)}초 (쓴 비율 ${((M.first.length / M.n) * 100).toFixed(0)}%) · 전투당 ${(M.uses / M.n).toFixed(2)}회`);
  console.log(`충전 출처: ${Object.entries(M.src).map(([k, v]) => `${k} ${((v / tot) * 100).toFixed(0)}%`).join(' · ')}`);
  for (const [k, v] of Object.entries(M.ct)) console.log(`  ${k}: 첫 ${med(v.first).toFixed(1)}초 · 전투당 ${(v.uses / v.n).toFixed(2)}회 · 피격 비중 ${((v.hurt / (v.tot || 1)) * 100).toFixed(0)}%`);
  console.log('디바인 신권 대행 (서약 조합별):');
  for (const [k, d] of Object.entries(D).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(22)} n=${String(d.n).padStart(4)} · 전투당 ${(d.acts / d.n).toFixed(2)}회 · 2회 이상 ${((d.multi / d.n) * 100).toFixed(0)}% · 첫 발동 ${med(d.first).toFixed(1)}초`);
  throw 0;
}
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
let rankSum = 0, unitSum = 0, clears = 0;
const itemSum = { C: 0, A: 0, L: 0 };
for (let i = 1; i <= N; i++) {
  const r = playRun(i * 1013);
  reach[r.phase] = (reach[r.phase] || 0) + 1;
  rankSum += r.avgRank;
  if (r.cleared) clears++;
  unitSum += r.units;
  for (const g of ['C', 'A', 'L'] as const) itemSum[g] += r.items[g];
  for (const [p, v] of Object.entries(r.phaseLog)) {
    wl[+p] = wl[+p] || { w: 0, l: 0 };
    wl[+p].w += v.w; wl[+p].l += v.l;
  }
}
console.log(`런 ${N}회 — 의뢰 성공(${CFG.victoryPhase}페이즈 보스 격파) ${clears}회 (${Math.round((clears / N) * 100)}%)`);
console.log('사망 시점 페이즈 분포:');
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
