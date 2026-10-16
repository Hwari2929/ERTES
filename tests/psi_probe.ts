// 사이오닉 적중 · 역할 수행 계측 (게임 규칙은 바꾸지 않고 Battle 메서드를 감싸서 읽기만 한다).
// 빌드: npx esbuild tests/psi_probe.ts --bundle --platform=node --format=cjs --outfile=X.cjs
// 실행:
//   node X.cjs school <i0> <i1> [시드 수]   → (사이오닉 기물, 전공) 쌍 i0..i1-1: 적중 · 상태 공급 · 중첩 · 비술 · 인과학파 치명타 계측
//   node X.cjs role <comps.json> <i0> <i1> [시드 수] [위험 등급 (주면 5 · 6페이즈만)] → 조합 전투의 기물별 '핵심 행동' 시각 · 사망 시각 · 처치 · 유효 회복 · 실흡수 보호막
//   node X.cjs aug <i0> <i1> [시드 수] → (사이오닉 기물, 전공) 쌍마다 전공 증강 0개 / 각 1개(기본 8 · ★ 전설 2): 승률 · 피해 · 생존 · 발동 표식 수 (전설 밸런스)
import { CFG } from '../src/config';
import { FIELDS } from '../src/data/battlefields';
import { UNIT_BY_ID } from '../src/data/units';
import { majorsOf, PSI_STATUS, SCHOOL_PASSIVES, type SchoolId } from '../src/data/schools';
import { mp } from '../src/data/psionic';
import { buildBattle } from '../src/engine/build';
import { Battle, type CUnit, type DmgOpts, type DmgResult, type Status } from '../src/engine/combat';
import * as R from '../src/engine/run';
import type { NodeType, RunState } from '../src/types';

declare const process: { argv: string[]; stdout: { write(s: string): void }; stderr: { write(s: string): void } };
declare function require(x: string): { readFileSync(p: string, e: string): string };

// ───────── 계측 상태 (전투 1회)
interface Track {
  hits: number; basicHits: number; skillHits: number; cantripHits: number;
  apps: number; appsAll: number; stackTime: number; alive: number; lowTime: number;
  dmg: number; schoolDmg: number;
  lowDmg: number; lowElig: number; lowBonus: number; allElig: number; allBonus: number;
  firstApp: number; firstCantrip: number; firstSkill: number; firstKill: number; firstSupport: number; death: number;
  casts0: number; cantrips0: number; kills0: number; castsAtDeath: number;
  healed: number; shieldGiven: number; shieldAbsorbed: number;
}
const newTrack = (): Track => ({ hits: 0, basicHits: 0, skillHits: 0, cantripHits: 0, apps: 0, appsAll: 0, stackTime: 0, alive: 0, lowTime: 0, dmg: 0, schoolDmg: 0,
  lowDmg: 0, lowElig: 0, lowBonus: 0, allElig: 0, allBonus: 0, firstApp: -1, firstCantrip: -1, firstSkill: -1, firstKill: -1, firstSupport: -1, death: -1,
  casts0: 0, cantrips0: 0, kills0: 0, castsAtDeath: -1, healed: 0, shieldGiven: 0, shieldAbsorbed: 0 });
let TR: Map<CUnit, Track> | null = null;
/** 전공 상태이상 키 (지속 능력 · 비술이 거는 것) */
const SCHOOL_KEYS: Record<SchoolId, string[]> = {
  pyro: ['burn'], chrono: ['chill', 'freeze'], volt: ['conduct'], wave: ['resonance'], seed: ['poison', 'regen'],
  mind: ['confuse', 'bond', 'charm'], gold: [], illusion: ['scent'],
};
const PSI_KEYS = new Set(Object.keys(PSI_STATUS));
const tr = (u: CUnit) => TR?.get(u) || null;
const isFoe = (b: Battle, a: CUnit, t: CUnit) => b.sideOf(a) !== b.sideOf(t);
/** 피해가 치명타 대상인지 (엔진 규칙 그대로: 사격 · 타격, 기술은 기술 치명 특성 또는 인과학파 저이성일 때, 지속 피해 제외) */
const critEligible = (src: CUnit, o: DmgOpts) => o.tag !== 'dot' && (o.kind === 'shoot' || o.kind === 'strike' || (o.kind === 'tech' && !!(src.mem.techCrit || src.mem.lowTechCrit)));

const P = Battle.prototype;
const oDeal = P.dealDamage, oRaw = P.rawHit, oStatus = P.applyStatus, oStep = P.step, oShield = P.shield, oHeal = P.heal;
/** 보호막 장부: 대상별 (준 기물, 남은 양) — 흡수되면 먼저 들어온 것부터 소모 */
const LEDGER = new WeakMap<CUnit, { g: CUnit; v: number; syn: boolean }[]>();
function absorb(tgt: CUnit, amt: number) {
  const l = LEDGER.get(tgt);
  if (!l || amt <= 0) return;
  while (amt > 1e-9 && l.length) {
    const x = l[0], a = Math.min(x.v, amt);
    x.v -= a; amt -= a;
    const t = x.syn ? null : tr(x.g); if (t) t.shieldAbsorbed += a; // 시너지 몫 보호막은 기물에게 넣지 않는다
    if (x.v <= 1e-9) l.shift();
  }
}
P.dealDamage = function (this: Battle, src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
  const sh0 = tgt.shield;
  const low = src.reason !== null && src.reason < 0 ? Math.min(1, -src.reason / 100) : 0;
  const c = this.S(src, 'crit'), cm = this.S(src, 'critDmg');
  const r = oDeal.call(this, src, tgt, base, o);
  absorb(tgt, sh0 - tgt.shield);
  const t = tr(src);
  if (t && tgt !== src && isFoe(this, src, tgt) && r.amount > 0) {
    t.dmg += r.amount;
    const sch = src.school as SchoolId | null;
    if (o.key === 'cantrip' || (o.key && sch && SCHOOL_KEYS[sch].includes(o.key)) || (o.tag === 'proc' && (sch === 'volt' || sch === 'wave') && o.elem === 'elec')) t.schoolDmg += r.amount;
    if (!r.miss && (o.tag === 'basic' || o.tag === 'skill')) {
      t.hits++;
      if (o.key === 'cantrip') t.cantripHits++; else if (o.tag === 'basic') t.basicHits++; else t.skillHits++;
    }
    // 인과학파 저이성 보상: 치명타 대상 피해에 대해 (보상 있을 때 기대 배율 − 없을 때 기대 배율)
    if (critEligible(src, o)) {
      const d0 = r.amount / (r.crit ? Math.max(1, cm) : 1);
      t.allElig += r.amount;
      if (src.school === 'gold' || src.school === 'illusion') {
        const dc = 0.25 * low, dcd = 0.25 * low;
        const ew = 1 + Math.min(1, c) * (cm - 1), eo = 1 + Math.max(0, Math.min(1, c - dc)) * (cm - dcd - 1);
        const bonus = d0 * (ew - eo);
        t.allBonus += bonus;
        if (low > 0) { t.lowElig += r.amount; t.lowBonus += bonus; }
      }
    }
    if (low > 0) t.lowDmg += r.amount;
  }
  return r;
};
P.rawHit = function (this: Battle, src: CUnit, tgt: CUnit, amt: number, elem) {
  const sh0 = tgt.shield;
  const r = oRaw.call(this, src, tgt, amt, elem);
  absorb(tgt, sh0 - tgt.shield);
  return r;
};
P.applyStatus = function (this: Battle, src: CUnit, tgt: CUnit, s: Status, chance?: number): boolean {
  const ok = oStatus.call(this, src, tgt, s, chance);
  const t = tr(src);
  // 전공 상태만 센다 (기물 특성이 같은 키를 거는 경우 — 지나의 중독 — 는 구분할 수 없어 함께 센다)
  const keys = src.school ? SCHOOL_KEYS[src.school as SchoolId] : [];
  if (ok && t && isFoe(this, src, tgt) && PSI_KEYS.has(s.key)) { t.appsAll++; if (keys.includes(s.key)) { t.apps++; if (t.firstApp < 0) t.firstApp = this.t; } }
  return ok;
};
P.shield = function (this: Battle, tgt: CUnit, amt: number, syn?: string) {
  const before = tgt.shield;
  const giver = this.actor && this.actor.side === tgt.side ? this.actor : tgt;
  oShield.call(this, tgt, amt, syn);
  const add = tgt.shield - before;
  if (add > 0) {
    let l = LEDGER.get(tgt); if (!l) LEDGER.set(tgt, (l = []));
    l.push({ g: giver, v: add, syn: !!syn || !tr(giver) }); // 계측 시작 전(전투 시작 처리) · 시너지 몫은 흡수량에서도 뺀다
    const t = tr(giver); if (t && !syn) { t.shieldGiven += add; if (t.firstSupport < 0 && giver !== tgt) t.firstSupport = this.t; }
  }
};
P.heal = function (this: Battle, src: CUnit, tgt: CUnit, amt: number, raw?: boolean, syn?: string) {
  const v = oHeal.call(this, src, tgt, amt, raw, syn);
  const t = tr(src); if (t && !syn && v > 0) { t.healed += v; if (t.firstSupport < 0 && src !== tgt) t.firstSupport = this.t; }
  return v;
};
P.step = function (this: Battle, dt: number) {
  oStep.call(this, dt);
  if (!TR) return;
  for (const [u, t] of TR) {
    if (u.alive) {
      t.alive += dt;
      if (u.reason !== null && u.reason < 0) t.lowTime += dt;
      const keys = u.school ? SCHOOL_KEYS[u.school as SchoolId] : [];
      if (keys.length) for (const e of this.units) if (e.alive && isFoe(this, u, e)) for (const s of e.statuses) if (s.src === u && keys.includes(s.key)) t.stackTime += (s.stacks || 1) * dt;
    } else if (t.death < 0) { t.death = this.t; t.castsAtDeath = u.counters.casts - t.casts0; }
    if (t.firstSkill < 0 && u.counters.casts > t.casts0) t.firstSkill = this.t;
    if (t.firstCantrip < 0 && (u.mem.cantrips || 0) > t.cantrips0) t.firstCantrip = this.t;
    if (t.firstKill < 0 && u.counters.kills > t.kills0) t.firstKill = this.t;
  }
};

// ───────── 런 만들기
const ITEMS = (id: string): string[] => {
  const d = UNIT_BY_ID[id];
  if (d.range <= 1) return d.ctype === 'VAN' ? ['A_vit_def', 'A_def_def'] : ['A_vit_def', 'A_pow_pow'];
  const tech = d.ttype === 'psionic' || d.base.mnd > d.base.pow;
  return tech ? ['A_mnd_mnd', 'A_mnd_agi'] : ['A_pow_mnd', 'A_pow_agi'];
};
function makeRun(ids: string[], rank: number, phase: number, field: string, seed: number, school?: { id: string; s: SchoolId }, diff = 0): RunState {
  const run = R.newRun(seed, [], field, diff);
  run.pending = []; run.phase = phase; run.fleet = Math.max(0, ids.length - CFG.deployBase);
  for (const id of ids) {
    const u = R.addUnit(run, id, rank);
    run.pending = []; // 증강 · 전공 증강은 고르지 않는다 (기본 지속 능력만 비교)
    if (UNIT_BY_ID[id].ttype === 'psionic') u.augments.push({ id: `school.${school && school.id === id ? school.s : majorsOf(id)[0]}` });
    u.items = [...(u.items[0] ? [u.items[0]] : []), ...ITEMS(id)].slice(0, 3) as (string | null)[];
    while (u.items.length < 3) u.items.push(null);
  }
  const used = new Set<string>();
  for (const u of run.units.slice().sort((a, b) => UNIT_BY_ID[a.defId].range - UNIT_BY_ID[b.defId].range)) {
    const d = UNIT_BY_ID[u.defId];
    const rows = d.range <= 1 ? [2, 1, 0] : d.range <= 3 ? [1, 0, 2] : [0, 1, 2];
    outer: for (const r of rows) for (const c of [3, 2, 4, 1, 5, 0, 6]) if (!used.has(`${c},${r}`)) { u.pos = { c, r }; used.add(`${c},${r}`); break outer; }
  }
  return run;
}
const FIELDS5 = ['swarm', 'crimson', 'sparta', 'petra', 'waste'];
const NODES: { t: NodeType; step: number }[] = [{ t: 'battle', step: 6 }, { t: 'adversity', step: 7 }, { t: 'boss', step: 11 }];
function fight(run: RunState, nd: { t: NodeType; step: number }, phase: number, seed: number, watch: (b: Battle) => CUnit[]) {
  run.step = nd.step; run.rng = seed * 13 + nd.step;
  const enc = R.genEncounter(run, nd.t, phase);
  const b = buildBattle(run, enc, false);
  TR = new Map();
  for (const u of watch(b)) { const t = newTrack(); t.casts0 = u.counters.casts; t.cantrips0 = u.mem.cantrips || 0; t.kills0 = u.counters.kills; TR.set(u, t); }
  b.runToEnd();
  const out = TR; TR = null;
  return { b, out };
}

// ───────── 1 · 3) 사이오닉 (기물, 전공) 쌍
const PSI_UNITS = ['yelena', 'hiiro', 'nadir', 'zephyro', 'romani', 'joshua', 'zina', 'onyx', 'rachel'];
const PAIRS: { id: string; s: SchoolId }[] = PSI_UNITS.flatMap((id) => majorsOf(id).map((s) => ({ id, s })));
const PARTNERS = ['kyle', 'chloe', 'mirinae', 'temur'];
function runSchool() {
  const i0 = +process.argv[3] || 0, i1 = Math.min(PAIRS.length, +process.argv[4] || PAIRS.length), NS = +process.argv[5] || 10;
  const res: unknown[] = [];
  for (let pi = i0; pi < i1; pi++) {
    const pr = PAIRS[pi];
    const acc: Record<string, number> = {};
    const add = (k: string, v: number) => (acc[k] = (acc[k] || 0) + v);
    for (const ph of [4, 5]) for (const f of FIELDS5) for (let s = 0; s < NS; s++) {
      const seed = 200000 + ph * 1000 + s * 17 + FIELDS.findIndex((x) => x.id === f) * 7;
      const run = makeRun([pr.id, ...PARTNERS.filter((x) => x !== pr.id)], ph === 4 ? 10 : 12, ph, f, seed, pr);
      for (const nd of NODES) {
        const { b, out } = fight(run, nd, ph, seed, (bb) => bb.units.filter((u) => u.side === 0 && u.defId === pr.id));
        const u = [...out.keys()][0];
        const t = out.get(u)!;
        add('n', 1); add('win', b.winner === 0 ? 1 : 0); add('dur', b.t);
        add('mp', mp(b, u) / CFG.psiPower);
        for (const k of ['hits', 'basicHits', 'skillHits', 'cantripHits', 'apps', 'appsAll', 'stackTime', 'alive', 'lowTime', 'dmg', 'schoolDmg', 'lowDmg', 'lowElig', 'lowBonus', 'allElig', 'allBonus'] as const) add(k, t[k]);
        add('cantrips', (u.mem.cantrips || 0) - t.cantrips0);
        // 전투 단위 표본 (분산 계산용)
        add('apsSq', t.alive > 0 ? (t.apps / t.alive) ** 2 : 0); add('aps', t.alive > 0 ? t.apps / t.alive : 0);
      }
    }
    res.push({ id: pr.id, school: pr.s, ...acc });
    process.stderr.write(`${pr.id}.${pr.s} done\n`);
  }
  process.stdout.write(JSON.stringify(res));
}

// ───────── 2) 역할 수행
interface Comp { id: string; units: string[] }
function runRole() {
  const comps: Comp[] = JSON.parse(require('fs').readFileSync(process.argv[3], 'utf8'));
  const i0 = +process.argv[4] || 0, i1 = Math.min(comps.length, +process.argv[5] || comps.length), NS = +process.argv[6] || 4, DIFF = +process.argv[7] || 0;
  const per: Record<string, Record<string, number>> = {};
  for (let ci = i0; ci < i1; ci++) {
    const comp = comps[ci];
    for (const ph of DIFF ? [5, 6] : [3, 4, 5, 6]) for (const f of FIELDS5) for (let s = 0; s < NS; s++) {
      const seed = 300000 + ph * 1000 + s * 17 + ci * 101;
      const run = makeRun(comp.units, ({ 3: 9, 4: 10, 5: 12, 6: 13 } as Record<number, number>)[ph], ph, f, seed, undefined, DIFF);
      for (const nd of NODES) {
        const { b, out } = fight(run, nd, ph, seed, (bb) => bb.units.filter((u) => u.side === 0 && !u.isSummon));
        const foeDeaths = b.counters.kills;
        for (const [u, t] of out) {
          const a = (per[u.defId] ??= {});
          const add = (k: string, v: number) => (a[k] = (a[k] || 0) + v);
          add('n', 1); add('win', b.winner === 0 ? 1 : 0);
          const died = t.death >= 0;
          // 기물별 핵심 행동: 지원 = 첫 회복 · 보호막 (남에게), 사이오닉 = 첫 비술, 명사수 = 첫 처치, 그 밖 = 첫 전투 스킬
          const keys: Record<string, number> = { skill: t.firstSkill, cantrip: t.firstCantrip, kill: t.firstKill, support: t.firstSupport, app: t.firstApp };
          for (const [k, v] of Object.entries(keys)) {
            if (v >= 0) { add(`${k}Got`, 1); add(`${k}T`, v); }
            if (died && (v < 0 || v > t.death)) add(`${k}DiedBefore`, 1);
          }
          add('died', died ? 1 : 0); if (died) { add('deathT', t.death); add('castsAtDeath', t.castsAtDeath); if (t.castsAtDeath >= 2) add('died2', 1); }
          add('casts', u.counters.casts - t.casts0);
          add('alive', t.alive); add('dur', b.t);
          add('kills', u.counters.kills - t.kills0); add('foeDeaths', foeDeaths);
          add('dmg', t.dmg); add('healed', t.healed); add('shieldGiven', t.shieldGiven); add('shieldAbsorbed', t.shieldAbsorbed);
        }
      }
    }
    process.stderr.write(`${comp.id} done\n`);
  }
  process.stdout.write(JSON.stringify(per));
}

// ───────── 4) 전공 증강 하나씩: 전설이 기본 증강보다 과하게 튀지 않는지
/** 발동 표식 (status · mark 이름) 세기 */
let EV: Record<string, number> | null = null;
const oEmit = P.emit;
P.emit = function (this: Battle, e: Parameters<Battle['emit']>[0]) {
  if (EV && (e.k === 'status' || e.k === 'mark') && 'name' in e && e.name) EV[e.name] = (EV[e.name] || 0) + 1;
  return oEmit.call(this, e);
};
function runAug() {
  const pairs = PAIRS.filter((x) => x.id !== 'rachel');
  const i0 = +process.argv[3] || 0, i1 = Math.min(pairs.length, +process.argv[4] || pairs.length), NS = +process.argv[5] || 6;
  const res: unknown[] = [];
  for (let pi = i0; pi < i1; pi++) {
    const pr = pairs[pi];
    const vars = ['', ...SCHOOL_PASSIVES[pr.s].map(([k]) => k)];
    const out: Record<string, Record<string, number>> = {};
    for (const v of vars) {
      const acc: Record<string, number> = {};
      const add = (k: string, x: number) => (acc[k] = (acc[k] || 0) + x);
      for (const ph of [4, 5]) for (const f of FIELDS5) for (let s = 0; s < NS; s++) {
        const seed = 400000 + ph * 1000 + s * 17 + FIELDS.findIndex((x) => x.id === f) * 7;
        const run = makeRun([pr.id, ...PARTNERS.filter((x) => x !== pr.id)], ph === 4 ? 10 : 12, ph, f, seed, pr);
        const ru = run.units.find((x) => x.defId === pr.id)!;
        if (v) ru.augments.push({ id: `psi.${pr.s}.${v}` });
        for (const nd of NODES) {
          EV = {};
          const { b, out: o } = fight(run, nd, ph, seed, (bb) => bb.units.filter((u) => u.side === 0 && u.defId === pr.id));
          const u = [...o.keys()][0], t = o.get(u)!;
          add('n', 1); add('win', b.winner === 0 ? 1 : 0); add('dur', b.t); add('alive', t.alive); add('died', t.death >= 0 ? 1 : 0);
          add('dmg', t.dmg); add('team', b.units.filter((x) => x.side === 0).reduce((q, x) => q + x.counters.dmg, 0));
          add('healed', t.healed); add('shield', t.shieldGiven);
          for (const [k, c] of Object.entries(EV)) add(`ev:${k}`, c);
          EV = null;
        }
      }
      out[v || '-'] = acc;
    }
    res.push({ id: pr.id, school: pr.s, out });
    process.stderr.write(`${pr.id}.${pr.s} done\n`);
  }
  process.stdout.write(JSON.stringify(res));
}

const MODE = process.argv[2];
if (MODE === 'school') runSchool();
else if (MODE === 'role') runRole();
else if (MODE === 'aug') runAug();
