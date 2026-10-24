// 2차 밸런스 측정 시뮬레이션 (tests/balance.ts 의 봇을 그대로 복사, 같은 시드 = 같은 런). 게임 규칙은 바꾸지 않고 계측만 한다.
// 빌드: npx esbuild tests/probe2.ts --bundle --platform=node --format=cjs --outfile=X.cjs
// 실행: node X.cjs <arm> <시작 시드> <런 수> [cf] > part.json      (집계: tests/probe2_report.py)
//       node X.cjs meta > meta.json
//  arm: base (현행) · noreasondot (저이성 정신 피해 0) · nofrenzyally (광폭이 아군을 노리지 않음) · reasonbot (이성 관리 봇) · randrelic (디바인 성유물 무작위)
//  cf : 표본 전투(P4 보스 · P4 일반 · P3 보스)를 같은 시드로 다시 돌려 아군 피해 +15% / 최대 체력 +15% / 받는 회복 +30% / 대조군 승패를 잰다
import { CFG } from '../src/config';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { SYNERGIES, tierOf } from '../src/data/synergies';
import { boardDims, buildAlly, buildEnemy, deployed, enemyCell, layout, synergyCounts } from '../src/engine/build';
import { Battle, DIVINE_HOOK, type CUnit, type DmgOpts, type DmgResult, type Status } from '../src/engine/combat';
import * as R from '../src/engine/run';
import { manageItems, shopSynth, type Track, pilgrimBot, forkChoice, turretPickBot } from './botlib';
import { Rng } from '../src/rng';
import { RELICS } from '../src/data/relics';
import { ULTS } from '../src/data/ults';
import { AUG_BY_ID } from '../src/data/augments';
import { FIELDS } from '../src/data/battlefields';
import type { AugPick, Major, RunState } from '../src/types';

declare const process: { argv: string[]; stdout: { write(s: string): void }; stderr: { write(s: string): void } };

// ───────── 메타 (집계용 이름표)
const META = process.argv[2] === 'meta';
if (META) {
  const TT: Record<string, string> = { major: '메이저', minor: '마이너', special: '스페셜', psionic: '사이오닉', divine: '디바인' };
  process.stdout.write(JSON.stringify({
    units: UNITS.map((u) => ({ id: u.id, name: u.name, tt: u.ttype, ct: u.ctype, ttName: TT[u.ttype] || u.ttype, mag: u.weapon.kind === 'mag' || (u.weapon.mag || 0) > 0, wkind: u.weapon.kind, ult: !!ULTS[u.id], starter: !u.noStarter })),
    augs: Object.fromEntries(Object.values(AUG_BY_ID).map((a) => [a.id, a.name])),
    relics: Object.fromEntries(RELICS.map((r) => [r.id, r.name])),
    fields: Object.fromEntries(FIELDS.map((f) => [f.id, f.name])),
    enemies: Object.fromEntries(Object.values(ENEMY_BY_ID).map((e) => [e.id, e.name])),
  }));
}

const ARM = process.argv[2] || 'base';
const START = +process.argv[3] || 1;
const COUNT = +process.argv[4] || 10;
const CF = process.argv.includes('cf');
const RANDREL = ARM === 'randrelic';
const RBOT = ARM === 'reasonbot';
if (ARM === 'noreasondot') CFG.reasonDot = 0;
if (ARM === 'nofrenzyally') CFG.frenzyFriendly = false;

/** 이성 관리 봇이 우선하는 전공: 이성을 올리거나 (축전 · 엔트로피 역행) 고이성에서 보상하는 것 (광합성 · 역장 · 상승장) */
const REASON_PREF = ['psi.volt.store', 'psi.chrono.revert', 'psi.seed.photo', 'psi.wave.field', 'psi.gold.bull'];

// ───────── 집계 저장소 (합으로만 누적)
type Acc = Record<string, number>;
const agg: Record<string, Record<string, Acc>> = {};
function add(table: string, key: string, vals: Acc) {
  const t = (agg[table] ??= {});
  const a = (t[key] ??= {});
  for (const [k, v] of Object.entries(vals)) a[k] = (a[k] || 0) + v;
}
/** 런별 누적 (군집 신뢰구간용): 키 → 합 배열 */
let RA: Record<string, number[]> = {};
function radd(key: string, vals: number[]) {
  const a = (RA[key] ??= new Array(vals.length).fill(0));
  for (let i = 0; i < vals.length; i++) a[i] += vals[i];
}

// ───────── 전투 계측
interface Rec {
  u: CUnit; id: string; ct: string; tt: string; school: string | null; psi: string[]; maj: string[];
  dmg: number; raw: number; after: number; conv: number; unconv: number;
  basics: number; ults: number; firstUlt: number; firstDeath: number; lastDeath: number;
  cause: string; frenzyT: number; fAlly: number; fEnemy: number; negT: number;
  // 홍염 · 시공
  ign: number; ignRaw: number; ignDealt: number; ignConsumed: number; ignLostStackSec: number; ignLostWhite: number; ignLostDur: number;
  burnSec: number; burnStackSec: number; whiteSec: number; burnTickRaw: number; burnTickDealt: number;
  frzN: number; frzApplied: number; frzSec: number; chillConsumed: number; chillSec: number; chillStackSec: number;
  // 디바인
  actT: number;
}
interface Inst {
  b: Battle;
  recs: Map<CUnit, Rec>;
  ctx: { src: CUnit; tgt: CUnit; o: DmgOpts }[];
  byTgt: Map<CUnit, Map<Rec, number>>;
  hasVan: boolean;
  firstAllyDeath: number; frontT: number; firstKill: number;
  psiUnits: CUnit[]; scanEnemies: boolean;
  estat: Acc; estatBoss: Acc;
  revives: { relic: string; div: string; t: number; who: CUnit }[];
  synDmg: number;
}
let I: Inst | null = null;
/** 반사실 모드: 'dmg' 아군 피해 +15% · 'hp' 최대 체력 +15% · 'heal' 받는 회복 +30% */
let CFX: '' | 'dmg' | 'hp' | 'heal' = '';
const actorOf = (u: CUnit) => (u.isSummon && u.owner ? u.owner : u);
const lastBurn = new WeakMap<CUnit, Status>();
const newRec = (u: CUnit): Rec => ({
  u, id: u.defId, ct: u.ctype || '?', tt: u.ttype || '?', school: null, psi: [], maj: [],
  dmg: 0, raw: 0, after: 0, conv: 0, unconv: 0, basics: 0, ults: 0, firstUlt: -1, firstDeath: -1, lastDeath: -1,
  cause: '', frenzyT: 0, fAlly: 0, fEnemy: 0, negT: 0,
  ign: 0, ignRaw: 0, ignDealt: 0, ignConsumed: 0, ignLostStackSec: 0, ignLostWhite: 0, ignLostDur: 0,
  burnSec: 0, burnStackSec: 0, whiteSec: 0, burnTickRaw: 0, burnTickDealt: 0,
  frzN: 0, frzApplied: 0, frzSec: 0, chillConsumed: 0, chillSec: 0, chillStackSec: 0, actT: -1,
});
const recOf = (u: CUnit | undefined | null) => (I && u ? I.recs.get(actorOf(u)) : undefined);

const P = Battle.prototype;
const oDeal = P.dealDamage, oKill = P.kill, oApply = P.applyStatus, oStep = P.step, oBasic = P.basicAttack, oHeal = P.heal, oRaw = P.rawHit;
P.dealDamage = function (this: Battle, src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
  if (CFX === 'dmg' && src.side === 0 && tgt.side === 1) base *= 1.15;
  if (!I) return oDeal.call(this, src, tgt, base, o);
  const pre = tgt.alive ? Math.max(0, tgt.hp) + tgt.shield : 0;
  I.ctx.push({ src, tgt, o });
  const r = oDeal.call(this, src, tgt, base, o);
  I.ctx.pop();
  if (r.amount > 0) noteDmg(this, src, tgt, r.amount, pre, o);
  // 홍염: 점화 (proc · key burn) / 연소 틱
  if (o.key === 'burn') {
    const c = recOf(src);
    if (c) {
      if (o.tag === 'proc') {
        c.ign++; c.ignRaw += base; c.ignDealt += r.amount; c.ignConsumed += base / 1.5;
        const s = lastBurn.get(tgt);
        if (s) { const d = Math.max(0, s.dur); c.ignLostStackSec += (s.stacks || 1) * d; c.ignLostDur += d; if (s.armorMul !== undefined && s.armorMul < 1) c.ignLostWhite += d * (1 - s.armorMul); }
      } else if (o.tag === 'dot') { c.burnTickRaw += base; c.burnTickDealt += r.amount; }
    }
  }
  return r;
};
P.rawHit = function (this: Battle, src: CUnit, tgt: CUnit, amt: number, elem) {
  if (!I) return oRaw.call(this, src, tgt, amt, elem);
  const pre = tgt.alive ? Math.max(0, tgt.hp) + tgt.shield : 0;
  const r = oRaw.call(this, src, tgt, amt, elem);
  if (r > 0) noteDmg(this, src, tgt, r, pre, null);
  return r;
};
function noteDmg(b: Battle, src: CUnit, tgt: CUnit, amount: number, pre: number, o: DmgOpts | null) {
  const a = actorOf(src);
  if (a.side === 0 && tgt.side === 1) {
    const eff = Math.min(amount, pre);
    if (o?.syn) { I!.synDmg += eff; return; }
    const c = I!.recs.get(a);
    if (!c) return;
    c.dmg += eff; c.raw += amount;
    if (I!.frontT >= 0) c.after += eff;
    let m = I!.byTgt.get(tgt);
    if (!m) I!.byTgt.set(tgt, (m = new Map()));
    m.set(c, (m.get(c) || 0) + eff);
  }
  // 광폭 중 피해 (사이오닉 본인)
  if (src.side === 0 && src.reason !== null && !src.isSummon && b.frenzied(src)) {
    const c = I!.recs.get(src);
    if (c) { if (tgt.side === 0 && tgt !== src) c.fAlly += amount; else if (tgt.side === 1) c.fEnemy += amount; }
  }
}
P.kill = function (this: Battle, u: CUnit, by: CUnit | null) {
  const was = u.alive;
  oKill.call(this, u, by);
  if (!I || !was) return;
  const t = this.t;
  if (u.side === 0 && !u.isSummon) {
    const c = I.recs.get(u);
    if (I.firstAllyDeath < 0) I.firstAllyDeath = t;
    if (I.frontT < 0 && (!I.hasVan || u.ctype === 'VAN')) I.frontT = t;
    if (c) {
      if (c.firstDeath < 0) c.firstDeath = t;
      c.lastDeath = t;
      const x = I.ctx[I.ctx.length - 1];
      let cause: string;
      if (x && x.tgt === u) cause = x.o.key === 'reason' ? 'reason' : actorOf(x.src).side === 0 ? 'ally' : 'enemy';
      else cause = !by ? 'other' : by === u ? 'reason' : actorOf(by).side === 0 ? 'ally' : 'enemy';
      c.cause = cause;
    }
  } else if (u.side === 1 && I.firstKill < 0) I.firstKill = t;
};
P.applyStatus = function (this: Battle, src: CUnit, tgt: CUnit, s: Status, chance = 1) {
  if (!I) return oApply.call(this, src, tgt, s, chance);
  const preChill = s.key === 'freeze' ? (tgt.statuses.find((x) => x.key === 'chill')?.stacks || 0) : 0;
  const ok = oApply.call(this, src, tgt, s, chance);
  if (!ok) return ok;
  if (s.key === 'burn') { const x = tgt.statuses.find((y) => y.key === 'burn'); if (x) lastBurn.set(tgt, x); }
  if (s.key === 'freeze') {
    const c = recOf(src);
    if (c) { c.frzN++; c.frzApplied += tgt.statuses.find((y) => y.key === 'freeze')?.dur || 0; c.chillConsumed += preChill; }
  }
  if (src.side === 1 && tgt.side === 0 && src !== tgt) {
    const k = `${s.type}:${s.key}`;
    const tab = actorOf(src).isBoss ? I.estatBoss : I.estat;
    tab[k] = (tab[k] || 0) + 1;
  }
  return ok;
};
P.step = function (this: Battle, dt: number) {
  oStep.call(this, dt);
  if (!I) return;
  for (const u of I.psiUnits) {
    if (!u.alive) continue;
    const c = I.recs.get(u)!;
    if (this.frenzied(u)) c.frenzyT += dt;
    if ((u.reason ?? 0) < 0) c.negT += dt;
  }
  if (!I.scanEnemies) return;
  for (const e of this.units) {
    if (!e.alive || e.side !== 1) continue;
    for (const s of e.statuses) {
      if (s.key === 'burn') {
        const c = recOf(s.src); if (!c) continue;
        c.burnSec += dt; c.burnStackSec += (s.stacks || 1) * dt;
        if (s.armorMul !== undefined && s.armorMul < 1) c.whiteSec += dt * (1 - s.armorMul);
      } else if (s.key === 'chill') {
        const c = recOf(s.src); if (!c) continue;
        c.chillSec += dt; c.chillStackSec += (s.stacks || 1) * dt;
      } else if (s.key === 'freeze') {
        const c = recOf(s.src); if (c) c.frzSec += dt;
      }
    }
  }
};
P.basicAttack = function (this: Battle, u: CUnit, tgt: CUnit, coef = 1) {
  if (I && u.side === 0) { const c = I.recs.get(u); if (c) c.basics++; }
  return oBasic.call(this, u, tgt, coef);
};
P.heal = function (this: Battle, src: CUnit, tgt: CUnit, amt: number, raw = false, syn?: string) {
  if (CFX === 'heal' && tgt.side === 0) amt *= 1.3;
  return oHeal.call(this, src, tgt, amt, raw, syn);
};
for (const ult of Object.values(ULTS)) {
  const oc = ult.cast;
  ult.cast = (b, u) => {
    const ok = oc(b, u);
    if (ok && I && u.side === 0) { const c = I.recs.get(u); if (c) { c.ults++; if (c.firstUlt < 0) c.firstUlt = b.t; } }
    return ok;
  };
}
const oAct = DIVINE_HOOK.act!;
DIVINE_HOOK.act = (b, u) => {
  const c = I?.recs.get(u);
  if (c && c.actT < 0) c.actT = b.t;
  const dead = I && u.relic === 'key' ? b.units.filter((x) => !x.alive && x.side === u.side && !x.isSummon) : [];
  oAct(b, u);
  if (I && u.relic === 'key') for (const x of dead) if (x.alive) I.revives.push({ relic: 'key', div: u.defId, t: b.t, who: x });
};

/** buildBattle 과 같다. before: start() 전에 호출 (계측 · 반사실 설정) */
function makeBattle(run: RunState, enc: NonNullable<NonNullable<RunState['node']>['enc']>, counts: Record<string, number>, before?: (b: Battle) => void) {
  const dim = boardDims(enc.n);
  const b = new Battle(dim.w, dim.h, new Rng(enc.seed), { phase: enc.phase ?? run.phase, credits: run.credits, field: run.field, diff: run.diff });
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
    const e = buildEnemy(b, ENEMY_BY_ID[s.defId], enc.phase ?? run.phase, enc.mult, s);
    const ec = enemyCell(s.c, s.row, enc.n);
    e.x = e.px = ec.x; e.y = e.py = ec.y;
    if (b.unitAt(e.x, e.y)) { const f = b.freeCellNear(e.x, e.y); if (!f) continue; e.x = e.px = f.x; e.y = e.py = f.y; }
    b.add(e);
  }
  before?.(b);
  b.start();
  return b;
}
function instrument(b: Battle): Inst {
  const recs = new Map<CUnit, Rec>();
  for (const u of b.units) {
    if (u.side !== 0 || u.isSummon || !u.src) continue;
    const r = newRec(u);
    const augs = u.src.augments.map((g) => g.id);
    r.school = augs.find((x) => x.startsWith('school.'))?.slice(7) || null;
    r.psi = augs.filter((x) => x.startsWith('psi.'));
    r.maj = augs.filter((x) => x.startsWith('maj.'));
    recs.set(u, r);
  }
  const allies = [...recs.keys()];
  return {
    b, recs, ctx: [], byTgt: new Map(), hasVan: allies.some((u) => u.ctype === 'VAN'),
    firstAllyDeath: -1, frontT: -1, firstKill: -1,
    psiUnits: allies.filter((u) => u.ttype === 'psionic'),
    scanEnemies: [...recs.values()].some((r) => r.school === 'pyro' || r.school === 'chrono'),
    estat: {}, estatBoss: {}, revives: [], synDmg: 0,
  };
}

// ───────── 봇 (balance.ts 와 같은 결정 · 같은 난수 소비)
function augChoiceP(p: { kind?: string; options: AugPick[] | null }, u: { defId: string } | undefined, bot: Rng, alt: Rng): AugPick | null {
  const o = p.options || [];
  if (!o.length) return null;
  if (p.kind === 'school') return RBOT && u?.defId === 'rachel' ? alt.pick(o) : o[0];
  const base = bot.pick(o);
  if (RBOT && p.kind === 'psionic') { for (const id of REASON_PREF) { const f = o.find((x) => x.id === id); if (f) return f; } }
  return base;
}

const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
const runs: unknown[] = [];
const PH_GRP = (ph: number) => (ph >= 6 ? 'P6+' : `P${ph}`);

function playRun(seed: number) {
  const bot = new Rng(seed * 7 + 1);
  const alt = new Rng(seed * 13 + 5); // 이성 관리 봇 전용 (기본 봇 난수와 분리)
  const starters = bot.sample(STARTERS, CFG.startUnits);
  const run = R.newRun(seed, starters, undefined, 0);
  RA = {};
  const relicSet = new Set<string>();
  const cfRows: number[][] = [];
  const psiRun = { n: 0, died: 0, reason: 0, ally: 0, enemy: 0, other: 0, frenzyT: 0, alive: 0, fAlly: 0, fEnemy: 0, dmg: 0, frenzied: 0 };

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
        if (!p.allocDone) R.allocRank(run, p, pref); // 대성공이면 같은 능력치 2배
        R.ensureRankupOptions(run, p);
        { const a = augChoiceP(p, u, bot, alt); if (a) R.chooseAug(run, p.uid, a); }
      } else if (p.t === 'turretPick') { turretPickBot(run); continue; } else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
      else if (p.t === 'recruit') {
        const have = new Map<string, number>();
        for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
        const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next(); };
        const pick = p.options.slice().sort((x, y) => score(y) - score(x))[0];
        R.recruit(run, pick);
      } else if (p.t === 'supply') R.flipAllSupply(run, p);
      else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
      else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
      else if (p.t === 'fork') { R.pickFork(run, forkChoice(run, () => bot.chance(0.5))); continue; }
      else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
      run.pending.shift();
    }
  };
  const track: Track = () => {};
  const manage = () => {
    manageItems(run, track);
    for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
    while (run.credits >= 30 + R.xpCost(run)) {
      const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
      if (!u || !R.buyXp(run, u.uid)) break;
    }
    R.autoPlace(run);
  };

  let n = 0, battles = 0;
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
    const pn = `${ph}:${ntype}`;
    const dep = deployed(run);
    const counts = synergyCounts(dep, run) as Record<string, number>;

    if (RANDREL) for (const u of run.units) if (UNIT_BY_ID[u.defId].ttype === 'divine' && !relicSet.has(u.uid)) { relicSet.add(u.uid); u.relic = RELICS[Math.floor(bot.next() * RELICS.length)].id; }
    let inst: Inst | null = null;
    const b = makeBattle(run, enc, counts, (bb) => { inst = I = instrument(bb); });
    b.runToEnd();
    I = null;
    const T = inst! as Inst;
    const won = b.winner === 0, W = won ? 1 : 0, res = won ? 'W' : 'L';
    const dur = b.t;
    battles++;
    const bossDef = ntype === 'boss' ? enc.enemies.find((s) => ENEMY_BY_ID[s.defId]?.tier === 'boss')?.defId || enc.enemies[0]?.defId : '-';

    // 전환 (적 사망 여부) → 각 기물 피해를 전환 · 미전환으로
    for (const [tgt, m] of T.byTgt) for (const [c, v] of m) { if (!tgt.alive) c.conv += v; else c.unconv += v; }

    // ── 전투 단위 (3 · 6)
    const isP4B = ph === 4 && ntype === 'boss';
    const teamConv = [...T.recs.values()].reduce((s, c) => s + c.conv, 0), teamUnconv = [...T.recs.values()].reduce((s, c) => s + c.unconv, 0);
    const bat = { n: 1, win: W, dur, hasAD: T.firstAllyDeath >= 0 ? 1 : 0, adT: Math.max(0, T.firstAllyDeath), hasK: T.firstKill >= 0 ? 1 : 0, kT: Math.max(0, T.firstKill),
      hasF: T.frontT >= 0 ? 1 : 0, fT: Math.max(0, T.frontT), adBeforeK: T.firstAllyDeath >= 0 && (T.firstKill < 0 || T.firstAllyDeath < T.firstKill) ? 1 : 0,
      conv: teamConv, unconv: teamUnconv, deaths: b.counters.allyDeaths, units: T.recs.size, timeout: !won && b.living(0).length ? 1 : 0 };
    add('e3bat', `all|${res}`, bat); add('e3bat', `${PH_GRP(ph)}|${res}`, bat);
    if (isP4B) add('e3bat', `P4boss|${res}`, bat);
    add('bw', pn, { n: T.recs.size, w: W * T.recs.size });

    if (ph >= 3 && ph <= 5) {
      const boss = b.units.find((e) => e.side === 1 && e.isBoss);
      const ed: Acc = { n: 1, win: W, dur, deaths: b.counters.allyDeaths, edmg: 0, timeout: !won && b.living(0).length ? 1 : 0,
        bossLeft: boss && !won ? Math.max(0, boss.hp) / boss.st.maxHp : 0, lossN: won ? 0 : 1 };
      for (const e of b.units) if (e.side === 1) for (const [k, v] of Object.entries(e.counters.elem)) { ed[`el_${k}`] = (ed[`el_${k}`] || 0) + (v || 0); ed.edmg += v || 0; }
      for (const [k, v] of Object.entries(T.estatBoss)) ed[`sb_${k}`] = v;
      for (const [k, v] of Object.entries(T.estat)) ed[`sn_${k}`] = v;
      ed.allyHp = [...T.recs.keys()].reduce((s, u) => s + u.st.maxHp, 0);
      add('e6', `${run.field}|${ph}|${ntype}|${bossDef}`, ed);
    }

    // ── 기물 단위
    for (const c of T.recs.values()) {
      const u = c.u;
      const alive = u.alive, died = alive ? 0 : 1;
      const tAlive = died ? c.lastDeath : dur;
      // 3. 전투 유형 · 전술 유형 실패 분해
      const fr = T.frontT >= 0;
      const row = { n: 1, died, deathT: died ? c.lastDeath : 0, aliveFrac: tAlive / Math.max(0.05, dur), dmg: c.dmg, conv: c.conv, unconv: c.unconv, overkill: c.raw - c.dmg,
        fN: fr ? 1 : 0, fDmg: fr ? c.dmg : 0, fAfter: c.after, fTimeAfter: fr ? (dur - T.frontT) / Math.max(0.05, dur) : 0 };
      add('e3ct', `${c.ct}|all|${res}`, row); add('e3ct', `${c.ct}|${PH_GRP(ph)}|${res}`, row);
      add('e3tt', `${c.tt}|all|${res}`, row); add('e3tt', `${c.tt}|${PH_GRP(ph)}|${res}`, row);
      add('e3cttt', `${c.ct}|${c.tt}|${res}`, row);
      add('e3u', `${c.id}|${res}`, row);
      if (isP4B) { add('e3ct', `${c.ct}|P4boss|${res}`, row); add('e3tt', `${c.tt}|P4boss|${res}`, row); add('e3u', `${c.id}|P4boss|${res}`, row); }

      // 1. 사이오닉 전공 (같은 기물 · 같은 학파, 전공 ≥1)
      if (c.tt === 'psionic' && c.school && c.psi.length) {
        radd(`pu|${c.id}|${c.school}|${pn}`, [1, W]);
        for (const p of c.psi) radd(`pp|${c.id}|${c.school}|${p}|${pn}`, [1, W]);
      }
      // 2. 메이저 공용 증강 (메이저 증강 ≥1 보유 기물만)
      if (c.tt === 'major' && c.maj.length) {
        radd(`ma|${c.id}|${pn}`, [1, W]);
        for (const g of new Set(c.maj)) radd(`maa|${c.id}|${g}|${pn}`, [1, W]);
        if (ULTS[c.id]) {
          const dbu = c.firstDeath >= 0 && (c.firstUlt < 0 || c.firstUlt > c.firstDeath) ? 1 : 0;
          const m = [1, c.basics, c.ults, dbu, tAlive, dur, died, W];
          for (const g of ['maj.reload', 'maj.ultc', 'maj.ults']) radd(`m2|${c.id}|${g}|${c.maj.includes(g) ? 1 : 0}|${ph}`, m);
        }
      }
      // 4. 사이오닉 사망 원인 · 광폭
      if (c.tt === 'psionic') {
        psiRun.n++; psiRun.died += died; psiRun.frenzyT += c.frenzyT; psiRun.alive += tAlive; psiRun.fAlly += c.fAlly; psiRun.fEnemy += c.fEnemy; psiRun.dmg += c.dmg; psiRun.frenzied += c.frenzyT > 0 ? 1 : 0;
        if (died) (psiRun as Acc)[c.cause || 'other']++;
        const pr = { n: 1, died, reason: died && c.cause === 'reason' ? 1 : 0, ally: died && c.cause === 'ally' ? 1 : 0, enemy: died && c.cause === 'enemy' ? 1 : 0,
          frenzyT: c.frenzyT, negT: c.negT, alive: tAlive, fAlly: c.fAlly, fEnemy: c.fEnemy, dmg: c.dmg, frenzied: c.frenzyT > 0 ? 1 : 0, win: W };
        add('e4u', c.id, pr); add('e4s', c.school || '-', pr); add('e4ph', String(ph), pr);
      }
      // 5. 홍염 · 시공 계측
      if (c.school === 'pyro' || c.school === 'chrono') {
        const v = { n: 1, dur, win: W, cantrips: u.mem.cantrips || 0, ign: c.ign, ignRaw: c.ignRaw, ignDealt: c.ignDealt, ignConsumed: c.ignConsumed, ignLostStackSec: c.ignLostStackSec,
          ignLostWhite: c.ignLostWhite, ignLostDur: c.ignLostDur, burnSec: c.burnSec, burnStackSec: c.burnStackSec, whiteSec: c.whiteSec, burnTickRaw: c.burnTickRaw, burnTickDealt: c.burnTickDealt,
          frzN: c.frzN, frzApplied: c.frzApplied, frzSec: c.frzSec, chillConsumed: c.chillConsumed, chillSec: c.chillSec, chillStackSec: c.chillStackSec, dmg: c.dmg };
        add('e5', `${c.school}|all`, v);
        const keys = c.school === 'pyro' ? ['ignite', 'white', 'boil', 'wildfire', 'cycle', 'overheat'] : ['zero', 'perma', 'revert', 'determ', 'delay', 'rewind'];
        for (const k of keys) add('e5', `${c.school}|${k}|${c.psi.includes(`psi.${c.school}.${k}`) ? 1 : 0}`, v);
        add('e5', `${c.school}|combo|${keys.slice(0, 3).map((k) => (c.psi.includes(`psi.${c.school}.${k}`) ? 1 : 0)).join('')}`, v);
      }
      // 8. 디바인 성유물
      if (c.tt === 'divine') {
        const rel = u.relic || '-';
        const a = c.actT >= 0 ? 1 : 0;
        const v = { n: 1, act: a, actT: a ? c.actT : 0, remain: a ? dur - c.actT : 0, dur, win: W, died };
        add('e8r', rel, v); add('e8ru', `${rel}|${c.id}`, v); add('e8rph', `${rel}|${ph}`, v);
      }
    }
    for (const rv of T.revives) {
      add('e8key', 'all', { n: 1, t: rv.t, remain: dur - rv.t, survived: rv.who.alive ? 1 : 0, win: W });
      add('e8key', `ct|${rv.who.ctype}`, { n: 1, survived: rv.who.alive ? 1 : 0 });
      add('e8key', `tt|${rv.who.ttype}`, { n: 1, survived: rv.who.alive ? 1 : 0 });
      add('e8key', `u|${rv.who.defId}`, { n: 1, survived: rv.who.alive ? 1 : 0 });
    }

    // balance.ts 와 같은 난수 소비 (반사실 표본 추첨, 비율 0)
    const active = SYNERGIES.filter((s) => tierOf(s.id, counts[s.id] || 0));
    if (active.length) bot.chance(0);

    // 6b. 반사실: 같은 전투를 조건만 바꿔 다시 (봇 난수와 무관한 추첨)
    if (CF) {
      const grp = ph === 4 && ntype === 'boss' ? 1 : ph === 4 && ntype === 'battle' ? 2 : ph === 3 && ntype === 'boss' ? 3 : 0;
      const rate = grp === 1 ? 0.14 : grp === 2 ? 0.08 : grp === 3 ? 0.12 : 0;
      if (grp && new Rng(seed * 1009 + n * 7919).next() < rate) {
        const out = [grp, W];
        for (const mode of ['', 'dmg', 'hp', 'heal'] as const) {
          CFX = mode;
          const b2 = makeBattle(run, enc, counts, mode === 'hp' ? (bb) => { for (const x of bb.units) if (x.side === 0) x.st.maxHp *= 1.15; } : undefined);
          b2.runToEnd();
          CFX = '';
          out.push(b2.winner === 0 ? 1 : 0);
        }
        cfRows.push(out);
      }
    }
    R.resolveBattle(run, b);
  }
  runs.push({ seed, starters, field: run.field, cleared: run.cleared ? 1 : 0, phase: run.phase, battles, acc: RA, psi: psiRun, ...(CF ? { cf: cfRows } : {}) });
}

if (!META) {
  for (let i = 0; i < COUNT; i++) {
    playRun(START + i);
    if ((i + 1) % 100 === 0) process.stderr.write(`${ARM} ${START}: ${i + 1}/${COUNT}\n`);
  }
  process.stdout.write(JSON.stringify({ arm: ARM, agg, runs }));
}
