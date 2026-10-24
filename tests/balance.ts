// 상세 밸런스 계측 시뮬레이션: 런을 돌리며 전투 · 기물 · 유형 상성 · 시너지 · 장비 지표를 집계한다.
// 실행: node dist/balance.cjs <시작 시드> <런 수> [반사실 표본 비율] > part.json   (집계는 tests/balance_report.py)
// - 시너지 기여 피해: 표본 전투를 같은 시드로 '그 시너지만 끈 상태'로 다시 돌려 아군 총 피해 차이를 잰다.
import { CFG } from '../src/config';
import { ENEMY_BY_ID, enemyTypes } from '../src/data/enemies';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { SYNERGIES, tierOf } from '../src/data/synergies';
import { boardDims, buildAlly, buildBattle, buildEnemy, deployed, enemyCell, layout, memberships, synergyCounts } from '../src/engine/build';
import { Battle, type CUnit, type DmgOpts, type DmgResult } from '../src/engine/combat';
import * as R from '../src/engine/run';
import { augChoice, forkChoice, manageItems, manageItemsFix, newIns, shopSynth, type BotIns, type Track, pilgrimBot } from './botlib';
import { ALL_AREAS, Chulsu, DEFAULT_AREAS, DLog, pickStarters, type Area } from './chulsu';
import { effTier, inactiveRange, setEvalMode } from './chulsu/syn';
import { Rng } from '../src/rng';
import { RELICS } from '../src/data/relics';
import { FIELDS } from '../src/data/battlefields';
import { fieldSyn, starterPool } from '../src/engine/starters';
import { oathV } from '../src/data/oaths';
import { causalStage } from '../src/data/chungra';
import { isLocked } from '../src/data/items';
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
/** oath=grit:3,pain:2 — 절망 서약 설정 (고난 이상에서만 걸린다). oathfrom=3 — 서약이 걸리는 위험 등급을 낮춰 쉬움 · 모험 기준으로 서약만 따로 잰다 */
const OATH_SEL = Object.fromEntries((process.argv.find((a) => a.startsWith('oath='))?.slice(5) || '').split(',').filter(Boolean).map((x) => { const [k, v] = x.split(':'); return [k, +v || 1]; }));
/** chr: 청라공국 우선 봇 — 시작 기물 중 2명을 청라 기물로 (영입 가능한 청라 기물에서), 영입 · 출전은 청라 기물을 먼저, 없는 청라 기물이 있으면 지정 소집 (무휼 인과 단계 계측용).
 *  fac=<세력 id>: 같은 정책을 다른 세력으로 (비교 기준, 예: fac=HEL) */
const FAC = (process.argv.find((a) => a.startsWith('fac='))?.slice(4) || (process.argv.includes('chr') ? 'CHR' : '')) as SynergyId | '';
const CHR = !!FAC;
const isFac = (id: string) => !!FAC && ([...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[]).includes(FAC);
const CHR_IDS = UNITS.filter((u) => isFac(u.id) && !u.noStarter && !u.eventOnly).map((u) => u.id);
/** supply: 첫 상점 뒤의 분기점에서 보급을 고른다 (보급 보상 비교용, 카드는 모두 뒤집는다) */
const SUPPLY = process.argv.includes('supply');
const OATH_FROM = process.argv.find((a) => a.startsWith('oathfrom='));
if (OATH_FROM) (CFG as { oathFrom: number }).oathFrom = +OATH_FROM.slice(9);
/** adv=1.2: 역경 · 도전 조우 강도 CFG.adversityMult 를 바꿔 돌린다 (역경 배수 비교, docs/BALANCE_ADVERSITY.md) */
const ADV_ARG = process.argv.find((a) => a.startsWith('adv='));
if (ADV_ARG) (CFG as { adversityMult: number }).adversityMult = +ADV_ARG.slice(4);
/** advpol=<역경>:<도전> — 역경 · 도전 진입 정책 (없으면 예전 봇 그대로).
 *  역경: must (지도대로 늘 역경 = 실제 게임 규칙) · avoid (역경 칸을 일반 전투로 바꿈, 가상) · state (체력 > 60 이면 50%로 역경, 가상) · power (직전 일반전을 여유 있게 이겼고 체력이 넉넉하면 역경, 가상)
 *  도전 (짝수 페이즈 전환): always · never · state · power (신비학자 합성 조건이면 예전처럼 합성). 정책 난수는 봇 난수와 따로 굴린다 */
const ADVPOL = (process.argv.find((a) => a.startsWith('advpol='))?.slice(7) || '').split(':');
const POL_ADV = ADVPOL[0] || '', POL_CH = ADVPOL[1] || ADVPOL[0] || '';
/** advstudy: 역경 계측 — 역경 순서 · 전투 시간선 · 패배 양상 · 같은 상태에서 일반전 / 역경(배수별) 재전투 · 준비(배치 · 장비 · 징수기) 반사실 */
const ADVSTUDY = process.argv.includes('advstudy');
/** 역경 계측에서 같은 상태 · 같은 조우로 다시 돌려 보는 배수 ('n' = 같은 칸 일반 전투 배수 1 + 0.04 × 칸) */
const STUDY_MULTS: (number | 'n')[] = [1, 'n', 1.15, 1.2, 1.25, 1.3];
/** bot=dumbi (기본, 예전 봇 그대로) · rara (덤비 + 장비 운용 결함 수정만) · chulsu (편성 · 장비 · 성장 · 경제 · 증강 · 빌드 · 시너지 평가 판단, tests/chulsu) · chulsu-search (+ 제한 탐색, 분석 전용. 3단계 선별 탐색은 chulsu=…,search3). docs/BOT_CHULSU.md */
const BOT0 = process.argv.find((a) => a.startsWith('bot='))?.slice(4) || 'dumbi';
if (!['dumbi', 'rara', 'chulsu', 'chulsu-search'].includes(BOT0)) throw new Error(`알 수 없는 봇: ${BOT0}`);
/** bot=chulsu-search: 철수 + 제한 탐색 (분석 전용, 대량 테스트 기본에서 뺀다) = bot=chulsu chulsu=<영역>,search */
const BOT = (BOT0 === 'chulsu-search' ? 'chulsu' : BOT0) as 'dumbi' | 'rara' | 'chulsu';
/** chulsu=form,gear,growth,start,econ,aug,hard,recruit2,build,syn3,multi,build3,boss,recruit,search,search3 — 철수 판단 영역 (없으면 DEFAULT_AREAS = 2단계 기본 + syn3,multi,build3). 꺼진 영역은 라라와 같다. start 는 계약 후보(pool) 안에서 고른다 */
const CH_AREAS = new Set<Area>(BOT === 'chulsu' ? ((process.argv.find((a) => a.startsWith('chulsu='))?.slice(7).split(',').filter(Boolean) as Area[]) || DEFAULT_AREAS) : []);
if (BOT0 === 'chulsu-search') CH_AREAS.add('search');
/** [조건부 실험] forcebuild=cmd|guard|med|voyage|time: 철수 build 영역의 빌드를 고정한다 (주어진 후보 · 자원만 쓰는 건 같다). 없으면 봇이 고른다 */
const FORCE_BUILD = process.argv.find((a) => a.startsWith('forcebuild='))?.slice(11);
/** [분석] augoff=priv,desp,glob,unit,loot: aug 영역의 일부만 끈다 (꺼진 부분은 덤비 규칙) — 증강 영역 안의 효과를 나눠 재는 용도 */
const AUG_OFF = new Set((process.argv.find((a) => a.startsWith('augoff='))?.slice(7) || '').split(',').filter(Boolean));
/** [분석] bossoff=desp,place,reserve: 3단계 boss 영역의 일부만 끈다 (절망 증강 보스 위험 · 보스 배치 · 보스 전 투자) */
const BOSS_OFF = new Set((process.argv.find((a) => a.startsWith('bossoff='))?.slice(8) || '').split(',').filter(Boolean));
for (const a of CH_AREAS) if (!ALL_AREAS.includes(a)) throw new Error(`알 수 없는 철수 영역: ${a}`);
setEvalMode(CH_AREAS.has('syn3')); // 3단계: 효과 단계 · 시너지 실측 잔차 평가 (tests/chulsu/syn.ts). 계약 기물 선택(pickStarters)부터 같은 평가를 쓴다
/** instr: 런마다 계측 기록 (조우 진입 상태 · 장비 현황 · 실패 사유 · 실행 시간) → runs[].ins. dlog: 철수 판단 기록 → runs[].dlog. 둘 다 없으면 출력은 예전과 같다 */
const INSTR = process.argv.includes('instr');
const DLOG = process.argv.includes('dlog');
/** [조건부 실험 · 측정표용] fpriv=<특권 id> · fdesp=<절망 증강 id> (출격 때 첫 절망 증강) · fglob=<전역 증강 id> (첫 항로 회의): 선택지와 무관하게 그것을 고른다.
 *  철수 aug 영역의 실측 가치표(tests/chulsu/tables.ts)를 조정 시드에서 만들 때만 쓴다. 없으면 동작 그대로 */
const F_PRIV = process.argv.find((a) => a.startsWith('fpriv='))?.slice(6);
const F_DESP = process.argv.find((a) => a.startsWith('fdesp='))?.slice(6);
const F_GLOB = process.argv.find((a) => a.startsWith('fglob='))?.slice(6);
/** [보급안 실험] cfgp1: CFG.supply.p1 (1페이즈 항로 보급 2회) · cfgfront: CFG.supply.front (2페이즈부터 페이즈 맨 앞 항로 보급). CLI supply(분기점 보급 선택 정책)와 다르다 */
if (process.argv.includes('cfgp1')) (CFG.supply as { p1: boolean }).p1 = true;
if (process.argv.includes('cfgfront')) (CFG.supply as { front: boolean }).front = true;

// ───────── 역경 계측: 첫 아군 사망 · 첫 적 처치 시각 (전투 동작은 그대로, 시각만 기록)
type Enc = NonNullable<NonNullable<RunState['node']>['enc']>;
const KT = new WeakMap<Battle, { fa: number; fe: number }>();
if (ADVSTUDY || POL_ADV) {
  const origKill = Battle.prototype.kill;
  Battle.prototype.kill = function (this: Battle, u: CUnit, by: CUnit | null) {
    if (u.alive && !u.isSummon && !u.mem.inert) {
      let k = KT.get(this);
      if (!k) KT.set(this, (k = { fa: -1, fe: -1 }));
      if (u.side === 0 && k.fa < 0) k.fa = this.t;
      if (u.side === 1 && k.fe < 0) k.fe = this.t;
    }
    return origKill.call(this, u, by);
  };
}
const r2 = (x: number) => Math.round(x * 100) / 100;
/** 전투 결과 요약: w 승리 · t 전투 시간 · fa 첫 아군 사망 · fe 첫 적 처치 (-1 = 없음) · aA/nA 살아남은 아군/출전 · aE/nE 남은 적/적 · aHp/eHp 남은 체력 비율 · to 시간 초과 패배 */
interface FR { w: number; t: number; fa: number; fe: number; aA: number; nA: number; aE: number; nE: number; aHp: number; eHp: number; to: number }
function measure(b: Battle): FR {
  const k = KT.get(b) || { fa: -1, fe: -1 };
  const side = (s: 0 | 1) => b.units.filter((u) => u.side === s && !u.isSummon && !u.mem.inert);
  const A = side(0), E = side(1);
  const frac = (us: CUnit[]) => { const m = us.reduce((s, u) => s + u.st.maxHp, 0); return m > 0 ? us.reduce((s, u) => s + (u.alive ? Math.max(0, u.hp) : 0), 0) / m : 0; };
  const aA = A.filter((u) => u.alive).length, won = b.winner === 0;
  return { w: won ? 1 : 0, t: r2(b.t), fa: r2(k.fa), fe: r2(k.fe), aA, nA: A.length, aE: E.filter((u) => u.alive).length, nE: E.length, aHp: r2(frac(A)), eHp: r2(frac(E)), to: !won && aA > 0 ? 1 : 0 };
}
/** 저장해 둔 상태(snap)를 복제해 조우 enc 를 실제 게임과 같은 경로(buildBattle)로 싸운다. 원래 런은 건드리지 않는다 */
function sim(snap: RunState, enc: Enc, type: 'battle' | 'adversity' | 'challenge', edit?: (r: RunState) => void): FR {
  const r = structuredClone(snap);
  const e = structuredClone(enc);
  r.node = { type, enc: e };
  edit?.(r);
  const b = buildBattle(r, e, false);
  b.runToEnd();
  return measure(b);
}
const withMult = (enc: Enc, m: number | 'n', step: number): Enc => ({ ...enc, mult: m === 'n' ? 1 + 0.04 * step : m });
const withSeed = (enc: Enc, k: number): Enc => ({ ...enc, seed: (enc.seed + 7919 * k) % 2147483647 });
/** 무작위 배치: 출전 기물을 폭 n × 3줄 칸에 무작위로 */
const randPlace = (rng: Rng, n: number) => (r: RunState) => {
  const dep = deployed(r);
  const cells = rng.shuffle([...Array(n * 3).keys()]).slice(0, dep.length);
  dep.forEach((u, i) => { u.pos = { c: cells[i] % n, r: Math.floor(cells[i] / n) }; });
};
/** 앞뒤 뒤집기: 근접 앞줄 · 원거리 뒷줄 배치를 거꾸로 */
const flipPlace = (r: RunState) => { for (const u of deployed(r)) u.pos = { c: u.pos!.c, r: 2 - u.pos!.r }; };
/** 장비 없음: 출전 기물의 일반 장비(고유 장비 제외) · 포탑 장비를 뺀다 (개조부품 · 문장은 그대로) */
const noGear = (r: RunState) => { for (const u of deployed(r)) u.items = u.items.map((x) => (x && isLocked(x) ? x : null)); r.turretGear = []; };
/** 주력 시너지: 활성 단계가 가장 높은 시너지 (같으면 인원이 많은 쪽) */
function mainSyn(counts: Record<string, number>): { main: string; act: string } {
  const act = SYNERGIES.map((s) => ({ id: s.id, t: tierOf(s.id, counts[s.id] || 0), c: counts[s.id] || 0 })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t || b.c - a.c || a.id.localeCompare(b.id));
  return { main: act[0] ? `${act[0].id}:${act[0].t}` : '-', act: act.map((x) => `${x.id}:${x.t}`).join(',') };
}

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

/** 반사실 실험 전용: buildBattle 과 같되 시너지 인원을 덮어쓸 수 있다.
 *  편성 화면의 포탑 자리 · 포탑 장비 · 무휼 자리(build.ts 내부 WeakMap)는 넘기지 못해 기본 자리 · 장비 없음으로 설치된다.
 *  그래서 실제 전투는 buildBattle 로 돌리고, 반사실 비교는 '켠 상태'도 이 함수로 다시 돌려 같은 경로끼리 비교한다. */
function makeBattle(run: RunState, enc: NonNullable<NonNullable<RunState['node']>['enc']>, counts: Record<string, number>) {
  const dim = boardDims(enc.n);
  const b = new Battle(dim.w, dim.h, new Rng(enc.seed), { phase: enc.phase ?? run.phase, credits: run.credits, field: run.field, diff: run.diff, despairs: run.despairs?.length ? [...run.despairs] : undefined, oaths: run.oaths, otShift: oathV(run, 'clock', 'sec') || undefined });
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
  const t0 = performance.now();
  const bot = new Rng(seed * 7 + 1);
  let starters = bot.sample(STARTERS, CFG.startUnits);
  const startLog = new DLog({ phase: 0, step: 0 } as RunState, DLOG);
  if (POOL || CH_AREAS.has('start')) { // 전장은 newRun 과 같은 추첨 (시드 첫 난수)
    const pr = new Rng(seed * 13 + 5), field = FORCE_FIELD || new Rng(seed).pick(FIELDS).id, syn = fieldSyn(field);
    const pool = starterPool(pr, field);
    const fav = pr.shuffle(pool.filter((id) => !!syn && ([...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[]).includes(syn))).slice(0, CFG.starterFav);
    starters = [...fav, ...pr.sample(pool.filter((id) => !fav.includes(id)), CFG.startUnits - fav.length)];
    if (CH_AREAS.has('start')) starters = pickStarters(seed, pool, field, DIFF, startLog); // 철수: 후보 8명 중 4명 조합을 모두 비교
  }
  if (CHR) { const pick = bot.sample(CHR_IDS, 2); starters = [...pick, ...starters.filter((x) => !pick.includes(x))].slice(0, CFG.startUnits); }
  const run = R.newRun(seed, starters, FORCE_FIELD, DIFF, OATH_SEL);
  const INS: BotIns | undefined = INSTR || BOT !== 'dumbi' ? newIns() : undefined;
  const CH = BOT === 'chulsu' ? new Chulsu(run, { areas: CH_AREAS, dlog: DLOG, ins: INS, forceBuild: FORCE_BUILD, augOff: AUG_OFF, bossOff: BOSS_OFF }) : null;
  if (CH) CH.log.list.push(...startLog.list);
  let dms = 0; // 봇 판단 시간 (manage · 선택지 처리, ms)
  let fGlobDone = false; // fglob= 실험: 첫 항로 회의만
  const encRec: number[][] = [], gearRec: number[][] = [];
  const synAt: Record<string, [number, number]> = {}; // 3단계 기록: 시너지 효과 단계에 처음 닿은 전투 [순번, 페이즈]
  const bossRec: [number, string, number][] = []; // 3단계 기록: 보스전 [페이즈, 보스, 승]
  const trace: unknown[] = [];
  const synMax: Record<string, number> = {};
  const det: Record<string, [number, number]> = {}; // detail 모드: `키|페이즈:노드` → [전투, 승리]
  const relicSet = new Set<string>();
  // 역경 계측 · 진입 정책 (봇 난수와 따로 굴려 기존 봇 선택을 흔들지 않는다)
  const pol = new Rng(seed * 31 + 11), sr = new Rng(seed * 101 + 3);
  let lastNorm: FR | null = null, advOrd = 0, consUsed = 0;
  const advRecs: unknown[] = [], nbRecs: unknown[] = [];
  const encPre = new WeakMap<object, Enc>(); // 노드 진입 직후(소모품 · 정비 전) 조우
  /** 정책 판정: 직전 일반전을 여유 있게(남은 아군 체력 50% 이상) 이겼고 함대 체력이 최대의 60% 이상 */
  const strong = () => !!lastNorm && lastNorm.w === 1 && lastNorm.aHp >= 0.5 && run.hp >= run.maxHp * 0.6;
  const want = (p: string) => (p === 'always' || p === 'must' ? true : p === 'avoid' || p === 'never' ? false : p === 'state' ? run.hp > 60 && pol.chance(0.5) : p === 'power' ? strong() : false);

  // 경로 · 상점 계측 (instr, 읽기만): 갈림길 [페이즈, 선택지, 고른 것] · 지도 칸 진입 [페이즈, 선택지, 들어간 노드] · 상점 구매 [페이즈, 장비, 가격, 구매 직전 크레딧]
  const brRec: [number, string, string][] = [], routeRec: [number, string, string][] = [], buyRec: [number, string, number, number][] = [];
  const resolvePending = () => {
    while (run.pending.length) {
      const p = run.pending[0];
      if (p.t === 'privilege') {
        if (F_PRIV) { p.options = [{ id: F_PRIV, ...(F_PRIV === 'P.emblem' ? { param: CH?.emblemParam() || p.options.find((o) => o.id === 'P.emblem')?.param || 'UNI' } : {}) }]; R.pickPrivilege(run, 0); continue; } // 조건부 실험 (측정표)
        if (CH?.augOn('priv')) { CH.privilege(p); continue; } // 철수 aug: 크레딧 환산 모형 + 새로고침 기대값
        R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue;
      }
      if (p.t === 'despair') {
        if (F_DESP && !p.phase) { p.options = [F_DESP]; R.pickDespair(run, 0); continue; } // 조건부 실험 (측정표)
        if (CH?.augOn('desp')) { CH.despair(p); continue; } // 철수 aug: 지금 계획에 가장 덜 해로운 것
        R.pickDespair(run, bot.int(0, p.options.length - 1)); continue; // 고난: 절망 증강 무작위 (출격 · 페이즈 시작)
      }
      if (p.t === 'event' && CH?.has('econ')) { CH.event(p); if (run.pending[0] === p) run.pending.shift(); continue; } // 철수 econ: 선택지마다 복제 상태에서 (다른 난수로) 결과를 굴려 상태 가치 비교
      if (p.t === 'event') {
        let done = false;
        for (const i of bot.shuffle([0, 1, 2])) if (R.chooseEvent(run, i) === null && run.pending[0] !== p) { done = true; break; }
        if (!done) run.pending.shift();
        continue;
      }
      if (p.t === 'victory') run.endless = true;
      if (p.t === 'global') {
        if (F_GLOB && !fGlobDone && p.rerolls !== undefined) { fGlobDone = true; R.pickGlobal(run, F_GLOB); } // 조건부 실험: 첫 항로 회의
        else if (CH?.augOn('glob')) CH.global(p); // 철수 aug (새로고침은 p.options 를 바꾼다)
        else R.pickGlobal(run, bot.pick(p.options));
      }
      else if (p.t === 'rankup') {
        const u = run.units.find((x) => x.uid === p.uid)!;
        const pref: Major[] = UNIT_BY_ID[u.defId].range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
        if (!p.allocDone) R.allocRank(run, p, (!p.allocDone && CH?.alloc(p)) || pref); // 대성공이면 같은 능력치 2배. 철수 growth: 실제 계수 기준
        R.ensureRankupOptions(run, p);
        if (CH?.augOn('unit')) { const a = CH.aug(p); if (a) R.chooseAug(run, p.uid, a); } // 철수 aug: 실측 증강 가치 + 새로고침
        else { const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a); }
      } else if (p.t === 'itemPick') R.gainItem(run, (CH?.augOn('loot') && CH.itemPick(p.options)) || bot.pick(p.options));
      else if (p.t === 'recruit') {
        // 영입: 보유 기물과 시너지가 가장 많이 겹치는 기물 (+약간의 무작위)
        const have = new Map<string, number>();
        for (const u of run.units) { const d = UNIT_BY_ID[u.defId]; for (const x of [...d.factions, ...d.traits]) have.set(x, (have.get(x) || 0) + 1); }
        const score = (id: string) => { const d = UNIT_BY_ID[id]; return [...d.factions, ...d.traits].reduce((s2, x) => s2 + (have.get(x) || 0), 0) + bot.next() + (CHR && isFac(id) ? 20 : 0); };
        // 철수 recruit: 영입 뒤 가능한 출전 편성의 팀 가치 비교 (덤비 점수는 동점 처리에만). 없으면 덤비 그대로 (정렬 비교마다 난수를 쓰는 예전 동작 유지)
        const pick = (CH?.has('recruit2') && CH.recruit2(p)) || (CH?.has('recruit') && CH.recruit(p.options, (id) => score(id))) || (CH?.augOn('desp') && CH.noRock(p.options, (id) => score(id))) || p.options.slice().sort((x, y) => score(y) - score(x))[0];
        if (pick === '-') { run.pending.shift(); continue; } // 철수 recruit2: 영입하지 않음 (보유 한도 · 반려 돌뿐)
        for (const id of p.options) add('offer', id, { offered: 1, picked: id === pick ? 1 : 0 });
        R.recruit(run, pick);
      } else if (p.t === 'supply') R.flipAllSupply(run, p);
      else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
      else if (p.t === 'branch' && CH?.has('econ')) { const c = CH.branch(p.options); if (INSTR) brRec.push([run.phase, p.options.join(','), c]); R.pickBranch(run, c); continue; } // 철수 econ: 지금 필요에 따라
      else if (p.t === 'branch') { R.pickBranch(run, run.picked.slice(0, run.step).includes('shop') ? SUPPLY && p.options.includes('supply') ? 'supply' : (run.units.length < 10 ? (['recruit', 'invest', 'pilgrim', 'shop'] as const) : (['invest', 'pilgrim', 'shop'] as const)).find((o) => p.options.includes(o))! : 'shop'); continue; }
      else if (p.t === 'fork' && CH?.has('hard') && !POL_ADV) { R.pickFork(run, CH.fork()); continue; } // 철수 hard: 체력 · 전력 여유로 휴식 / 도전
      else if (p.t === 'fork') { R.pickFork(run, POL_ADV ? (R.occultTier(run) && run.credits >= 20 ? 'synth' : want(POL_CH) ? 'challenge' : 'rest') : forkChoice(run, () => bot.chance(0.5))); continue; }
      else if (p.t === 'pilgrim') { pilgrimBot(run); run.pending.shift(); continue; }
      run.pending.shift();
    }
  };
  const track: Track = (id, what) => { add('cons', id, { [what]: 1 }); if (what === 'used') consUsed++; };
  const manage = () => {
    const tm = performance.now();
    if (CH) CH.manageItems(track);
    else if (BOT === 'rara') manageItemsFix(run, track, INS);
    else manageItems(run, track, INS);
    // 함대 확장: 출전 인원이 보유 기물보다 적으면 우선 구매 (예비 15 남김). 철수 econ: 함대 확장 · 공명도 · 저축을 한 예산으로 (CH.spend)
    if (CH?.has('econ')) CH.spend();
    else for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
    if (!CH?.has('econ') && !CH?.buyXp()) while (run.credits >= 30 + R.xpCost(run)) {
      const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0];
      if (!u || !R.buyXp(run, u.uid)) break;
    }
    CH?.buildStep(); // 철수 build: 빌드 유지 / 전환 · 지정 소집 (영입 선택은 다음 resolvePending)
    // 청라 우선: 아직 없는 청라 기물이 있으면 지정 소집 (청라 · 엔지니어 · 신비학자)
    if (CHR && !run.node && !run.pending.length && run.units.length < CFG.maxParty && CHR_IDS.some((id) => !run.units.some((u) => u.defId === id)) && run.credits >= R.musterCost(run) + 5) {
      if (R.openMuster(run) === null && R.confirmMuster(run, FAC === 'CHR' ? ['CHR', 'ENG', 'OCCULT'] : [FAC, ...['ENG', 'OCCULT', 'MED'].filter((x) => x !== FAC)].slice(0, 3)) !== null) R.cancelMuster(run);
      resolvePending();
    }
    if (CHR) for (const u of run.units.filter((x) => !x.pos && isFac(x.defId) && R.canDeploy(run, x))) { // 대기 중인 청라 기물이 있으면 청라가 아닌 출전 기물과 바꾼다
      if (deployed(run).length < R.deployCap(run)) break;
      const out = deployed(run).filter((x) => !isFac(x.defId) && !R.isRock(x)).sort((a, b) => a.rank - b.rank)[0];
      if (!out) break;
      u.pos = out.pos; out.pos = null;
    }
    if (!CH?.arrange()) R.autoPlace(run, CHR ? run.units.slice().sort((a, b) => +isFac(b.defId) - +isFac(a.defId)) : run.units);
    dms += performance.now() - tm;
  };

  let n = 0, battles = 0;
  const usedUnits = new Set<string>();
  const crAt: Record<number, [number, number]> = {}; // 경제: 페이즈별 전투 직전 보유 크레딧 [합, 전투 수]
  const czAt: Record<number, [number, number]> = {}; // 청라공국: 페이즈 첫 전투 직전 무휼 인과율 · 그 전투의 청라 단계
  const kbAt: Record<number, number> = {}; // 청라공국: 페이즈 보스전 첫 진입 직전 무휼 인과율 (최종 보스 승리 뒤 성장분 제외용)
  const bw = [0, 0, 0, 0]; // [보스전 수, 보스 승리, 보스 외 전투 수, 보스 외 승리]
  while (!run.over && !run.cleared && n < 200) {
    if (ADVSTUDY && run.node?.enc && !encPre.has(run.node.enc)) encPre.set(run.node.enc, structuredClone(run.node.enc));
    resolvePending(); manage(); resolvePending();
    if (run.node?.synth) { if (CH?.has('econ')) { CH.synth(track); R.leaveShop(run); } else shopSynth(run, track); continue; }
    if (!run.node) {
      const opts = R.currentOptions(run);
      if (POL_ADV) R.enterNode(run, opts.includes('adversity') ? (want(POL_ADV) ? 'adversity' : 'battle') : opts[0]); // 역경 칸을 일반 전투로 바꾸는 것은 가상 정책 (실제 지도에서 역경은 필수)
      else R.enterNode(run, opts.includes('adversity') && run.hp > 60 && bot.chance(0.5) ? 'adversity' : opts[0]);
      if (run.pending[0]?.t === 'branch') resolvePending();
      const t = (run.node as { type: string } | null)?.type;
      if (INSTR) routeRec.push([run.phase, opts.join(','), t || '-']);
      if (t === 'shop' && CH?.has('econ')) {
        const sh = (run.node as { shop?: { item: string; price: number; sold?: boolean }[] } | null)?.shop || [], was = sh.map((x) => !!x.sold), cr0 = run.credits;
        CH.shop();
        if (INSTR) sh.forEach((x, i) => { if (x.sold && !was[i]) buyRec.push([run.phase, x.item, x.price, cr0]); });
        R.leaveShop(run); continue;
      } // 철수 econ: 지금 빌드에 쓸모 · 가격 대비 (정비 포함)
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
    { const c = (crAt[ph] ??= [0, 0]); c[0] += run.credits; c[1]++; }
    const counts = synergyCounts(dep, run) as Record<string, number>;
    if (INSTR) { // 조우 진입 상태: [페이즈, 노드(0 일반 · 1 역경 · 2 도전 · 3 보스), 칸, 체력, 크레딧, 평균 등급, 최고 등급, 출전 수, 활성 단계 합, 활성 시너지 수, 승(전투 뒤 채움)]
      const rk = dep.filter((u) => !R.isRock(u)).map((u) => u.rank), act = SYNERGIES.map((s) => tierOf(s.id, counts[s.id] || 0)).filter((t) => t > 0);
      // 3단계 기록 [11~]: 출항기 출전 인원 · 실제 효과가 켜진 시너지 수 · 비활성 구간(2명 이상인데 효과 없음) 시너지 수 · 빈 출전 자리(출전 가능한 대기 기물이 있는데) · 출전 장착 장비 수 · 주력 피해 몫(%) · 주력 생존 (전투 뒤 채움) · 레이첼 출전
      const benchOk = run.units.filter((u) => !u.pos && !R.isRock(u) && R.canDeploy(run, u)).length;
      const effAct = SYNERGIES.filter((s) => s.tiers.length > 1 && effTier(s.id, counts[s.id] || 0) > 0).length;
      const inact = SYNERGIES.filter((s) => inactiveRange(s.id, counts[s.id] || 0)).length;
      encRec.push([ph, ['battle', 'adversity', 'challenge', 'boss'].indexOf(ntype), run.step, run.hp, run.credits, rk.length ? Math.round((rk.reduce((a, b) => a + b, 0) / rk.length) * 100) / 100 : 0, Math.max(0, ...rk), dep.length, act.reduce((a, b) => a + b, 0), act.length, -1,
        counts.VOYAGE || 0, effAct, inact, Math.max(0, Math.min(benchOk, R.deployCap(run) - dep.length)), dep.reduce((a, u) => a + u.items.filter((x) => x && !isLocked(x)).length, 0), -1, -1, dep.some((u) => u.defId === 'rachel') ? 1 : 0]);
      for (const s of SYNERGIES) { const t = effTier(s.id, counts[s.id] || 0); for (let k = 1; k <= t; k++) synAt[`${s.id}:${k}`] ??= [n, ph]; }
      if (ntype === 'boss') bossRec.push([ph, enc.enemies.find((e) => ENEMY_BY_ID[e.defId]?.tier === 'boss')?.defId || '?', -1]);
      // 장비 현황: [보관함 장비, 출전 기물 장착(고유 제외), 대기 기물 장착, 출전 조합 장비(고급 · 희귀 · 전설), 출전 단일 재료, 보관함 재료, 분리 용제]
      const g = (u: (typeof run.units)[number]) => u.items.filter((x) => x && !isLocked(x)) as string[];
      const depG = dep.flatMap(g), benG = run.units.filter((u) => !u.pos).flatMap(g);
      gearRec.push([run.inventory.filter((x) => /^[CGAL]_/.test(x)).length, depG.length, benG.length, depG.filter((x) => /^[GAL]_/.test(x)).length, depG.filter((x) => x[0] === 'C').length, run.inventory.filter((x) => /^C_/.test(x)).length, R.solventLeft(run)]);
    }
    if (!czAt[ph]) czAt[ph] = [run.causal || 0, tierOf('CHR', counts.CHR || 0)];
    for (const s of SYNERGIES) { const t = tierOf(s.id, counts[s.id] || 0); if (t > (synMax[s.id] || 0)) synMax[s.id] = t; }

    if (RANDREL) for (const u of run.units) if (UNIT_BY_ID[u.defId].ttype === 'divine' && !relicSet.has(u.uid)) { relicSet.add(u.uid); u.relic = RELICS[Math.floor(bot.next() * RELICS.length)].id; }
    const snap = ADVSTUDY && ntype !== 'boss' ? structuredClone(run) : null; // 전투 직전 상태 (계측용 재전투는 이 복제본에서)
    const hp0 = run.hp, cons0 = consUsed; consUsed = 0;
    tap = { pair: {}, evaded: new Map() };
    if (ntype === 'boss' && kbAt[ph] === undefined) kbAt[ph] = run.causal || 0; // 무휼: 페이즈 보스 첫 진입 직전 인과율
    if (CH?.has('search') || CH?.has('search3')) CH.search(); // 제한 탐색 (분석 전용): 보이는 조우를 다른 난수로 미리 싸워 편성 · 배치 후보 비교
    if (INSTR) for (const s of enc.enemies) { // 적 장비 분포 (위험 등급 장비 s.items · 개조부품 s.mod, 적 정의 고유 장비 제외 · 전투 직전 = 징수기 뒤): 노드|페이즈|등급(normal · elite · boss)
      const it = s.items || [], tr = ENEMY_BY_ID[s.defId]?.tier || '?';
      add('foegear', `${ntype}|${ph}|${tr}`, { n: 1, [`k${Math.min(3, it.length)}`]: 1, items: it.length, C: it.filter((x) => x.startsWith('C_')).length, G: it.filter((x) => x.startsWith('G_')).length, A: it.filter((x) => x.startsWith('A_')).length, L: it.filter((x) => x.startsWith('L_')).length, mod: s.mod ? 1 : 0, strip: s.stripped ? 1 : 0 });
    }
    const b = buildBattle(run, enc, false); // 실제 게임과 같은 경로 (포탑 · 무휼 자리, 포탑 장비 포함)
    b.runToEnd();
    const won = b.winner === 0;
    if (INSTR) trace.push({ph, st:run.step, type:ntype, won, sec:b.t, counts:{...counts},
      enemyLegends:enc.enemies.reduce((n,e)=>n+(e.items||[]).filter(i=>i.startsWith('L_')).length,0),
      foes:enc.enemies.length, party:dep.filter(u=>!R.isRock(u)).map(u=>({id:u.defId,rank:u.rank})),
      alive:b.units.filter(u=>u.side===0&&!u.isSummon&&u.alive).length});
    CH?.afterBattle(b, ntype);
    battles++;
    if (INSTR) {
      const er = encRec[encRec.length - 1];
      er[10] = won ? 1 : 0;
      if (ntype === 'boss') bossRec[bossRec.length - 1][2] = won ? 1 : 0;
      // 주력 = 출전 기물 중 공명 등급이 가장 높은 기물 (투자가 가장 많이 간 기물): 이 전투의 피해 몫 · 생존
      const core = dep.filter((u) => !R.isRock(u)).sort((a, z) => z.rank - a.rank || z.xp - a.xp)[0];
      if (core) {
        const al = b.units.filter((c) => c.side === 0);
        const own = (c: CUnit) => (c.isSummon && c.owner ? c.owner : c);
        const tot = al.reduce((x, c) => x + c.counters.dmg, 0) || 1;
        const mine = al.filter((c) => own(c).src?.uid === core.uid);
        er[16] = Math.round((mine.reduce((x, c) => x + c.counters.dmg, 0) / tot) * 100);
        er[17] = mine.some((c) => !c.isSummon && c.alive) ? 1 : 0;
      }
    }
    { const k2 = ntype === 'boss' ? 0 : 2; bw[k2]++; if (won) bw[k2 + 1]++; }
    const T = tap; tap = null;
    if (POL_ADV && ntype === 'battle') lastNorm = measure(b);
    if (snap) {
      const real = measure(b), step = run.step, ms = mainSyn(counts);
      const sweep = (e: Enc, type: 'adversity' | 'challenge') => Object.fromEntries(STUDY_MULTS.map((m) => [String(m), sim(snap, withMult(e, m, step), type).w]));
      if (ntype === 'adversity' || ntype === 'challenge') {
        if (ntype === 'adversity') advOrd++;
        const nEnc = R.genEncounter(structuredClone(snap), 'battle'); // 같은 칸 · 같은 상태의 일반 전투
        const pre = encPre.get(enc);
        const seized = !!pre && JSON.stringify(pre.enemies) !== JSON.stringify(enc.enemies);
        advRecs.push({ ord: ntype === 'adversity' ? advOrd : 0, type: ntype, ph, step, hp0, maxHp: run.maxHp, mult: enc.mult, n: enc.n, nDep: dep.length, syn: ms.main, act: ms.act, cons: cons0, real,
          norm: sim(snap, nEnc, 'battle'),
          mult_w: sweep(enc, ntype),
          seeds: [1, 2, 3, 4].map((k) => sim(snap, withSeed(enc, k), ntype).w),
          rand: [0, 1, 2, 3, 4].map(() => sim(snap, enc, ntype, randPlace(sr, enc.n)).w),
          flip: sim(snap, enc, ntype, flipPlace).w,
          nogear: sim(snap, enc, ntype, noGear).w,
          gear: dep.reduce((s, u) => s + u.items.filter((x) => x && !isLocked(x)).length, 0),
          ...(seized ? { unseized: sim(snap, pre!, ntype).w } : {}) });
      } else if (ntype === 'battle') {
        const rec: Record<string, unknown> = { ph, step, hp0, nDep: dep.length, syn: ms.main, real };
        if (ph <= 3) rec.adv = sweep(R.genEncounter(structuredClone(snap), 'adversity'), 'adversity'); // 같은 상태의 가상 역경 (배수별)
        nbRecs.push(rec);
      }
    }
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
      const b1 = makeBattle(run, enc, counts); // 같은 경로로 '켠 상태' 재전투 (buildBattle 과 포탑 · 무휼 자리가 다를 수 있다)
      b1.runToEnd();
      const full = allyDamage(b1), wonFull = b1.winner === 0;
      for (const sid of active) {
        const c2 = { ...counts, [sid]: 0 };
        const b2 = makeBattle(run, enc, c2);
        b2.runToEnd();
        const tier = tierOf(sid as SynergyId, counts[sid] || 0);
        const v = { n: 1, full, without: allyDamage(b2), winFull: wonFull ? 1 : 0, winWithout: b2.winner === 0 ? 1 : 0, durFull: b1.t, durWithout: b2.t };
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
  // 경제 (전투 종료 보고서 기록 run.rep): 이자 · 이자 상한 · 전투 정산 수입 합, 지출 종류별, 페이즈별 전투 직전 보유 크레딧
  const rb = run.rep?.b || [];
  const eco = { nb: rb.length, i: rb.reduce((s, x) => s + x.i, 0), cap: rb.reduce((s, x) => s + x.cap, 0), inc: rb.reduce((s, x) => s + x.c, 0), atCap: rb.filter((x) => x.cap > 0 && x.i >= x.cap).length,
    sp: run.rep?.sp || {}, crAt, end: run.credits, loan: run.loan || 0 };
  runs.push({ seed, starters, field: run.field, cleared: run.cleared, phase: run.phase, battles, causal: run.causal || 0, king: run.causal ? causalStage(run.causal) : 0, used: [...usedUnits], final: run.units.map((u) => u.defId), synMax, finalItems,
    cz: czAt, kb: kbAt, chrMax: run.chrTier || 0, bw, diff: run.diff || 0, heat: run.oathHeat || 0, despairs: run.despairs || [], hp: run.hp, eco, ...(DETAIL ? { det } : {}), ...(ADVSTUDY ? { adv: advRecs, nb: nbRecs, maxHp: run.maxHp } : {}),
    ...(INSTR ? { trace, ins: { bot: BOT, areas: [...CH_AREAS], enc: encRec, gear: gearRec, fail: INS!.fail, ev: INS!.ev, ms: Math.round(performance.now() - t0), dms: Math.round(dms), cms: Math.round(CH?.ms || 0), nb: battles, synAt, boss: bossRec, ...(n >= 200 ? { capped: 1 } : {}), ...(CH?.xb ? { xb: CH.xb, xms: Math.round(CH.xms) } : {}), ...(CH?.stage2() ? { ch: CH.rec } : {}),
      glob: [...(run.globals || [])], uaug: run.units.map((u) => [u.defId, u.augments.map((g) => g.id)]), br: brRec, route: routeRec, buy: buyRec } } : {}),
    ...(DLOG && CH ? { dlog: CH.log.list } : {}) });
}

for (let i = 0; i < COUNT; i++) {
  // instr: 실행 실패도 기록한다 (3단계 신뢰성 지표). instr 가 없으면 예전처럼 그대로 멈춘다
  if (INSTR) { try { playRun(START + i); } catch (e) { runs.push({ seed: START + i, err: String((e as Error)?.stack || e).slice(0, 400), cleared: false, phase: -1 }); } }
  else playRun(START + i);
  if ((i + 1) % 25 === 0) process.stderr.write(`${START}: ${i + 1}/${COUNT}\n`);
}
process.stdout.write(JSON.stringify({ agg, runs }));
