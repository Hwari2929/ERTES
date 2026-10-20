// 철수 봇 3단계: 시너지 효과 실측 (공개 정보 = 기물 · 시너지 정의만 사용). 결과 → tests/chulsu/synprofile.gen.ts
// 실행: npm run -s chulsu-synprofile   (시너지 · 기물 · 전투 수치가 바뀌면 다시 돌린다, 약 3분)
// 방법: 시너지 S 의 단계 t 인원(n명, 모자라면 S 문장을 단 기물)과 S 와 무관한 기물로 팀(6명 이상)을 꾸려 싸운다. 두 시점에서 잰다:
//   3페이즈 · 공명 6 (키 …@3), 6페이즈 · 공명 14 (키 …@6) — 보류 결과의 조우 진입 평균 등급에 맞춤. 보강(체력 · 방어력 가산)은 하지 않는다
//   (1차판은 2단계 기물 실측처럼 생명력 +60 · 방어력 +40 을 더해 최대 체력 · 방어도 비례 효과(분해자 · 수호자)를 크게 부풀렸다: docs/BOT_CHULSU.md 3단계).
//   같은 시드에서 S 인원만 0 으로 덮어쓴 전투(시너지를 끈 전투, 반사실)와 비교해
//     o = ln(켠 전투 팀 초당 피해 / 끈 전투) − ln(평가 함수가 예측한 같은 비율)  — 일반 조우와 보스 조우의 평균 (보스전이 벽이므로 단일 대상 효과도 본다)
//     d = ln(켠 전투 '버틴 피해' / 끈 전투) − ln(평가 함수 예측)   버틴 피해 = 아군이 받은 피해 ÷ 잃은 체력 비율 (회복 · 부활 · 소환물이 받아 준 피해 포함)
//   so · sd = 실측 팀에서 S 구성원의 피해 · 버틴 피해 몫 (평가 함수, 끈 상태) — 평가 때 지금 팀의 구성원 몫으로 늘이고 줄인다 (syn.ts SYN_KIND).
//   VOYAGE:solo:<기물> = 출항기 기물 1명의 단독 출항 고유 능력 (1명 vs 0명), VOYAGE:2 = 완전체 (5명 vs 0명, 고유 능력 5개 + 완전체 효과),
//   CHR:<단계>:<인과 단계> = 공왕 무휼 포함 (인과 단계 1 · 4 · 7).
import { buildAlly, buildEnemy, boardDims, deployed, enemyCell, layout, synergyCounts, type Counts } from '../../src/engine/build';
import { Battle } from '../../src/engine/combat';
import * as R from '../../src/engine/run';
import { Rng } from '../../src/rng';
import { UNITS, UNIT_BY_ID } from '../../src/data/units';
import { ENEMY_BY_ID } from '../../src/data/enemies';
import { SYNERGIES } from '../../src/data/synergies';
import { causalNeed } from '../../src/data/chungra';
import { emblemId } from '../../src/data/items';
import { EMBLEM_SYNS } from '../../src/data/globals';
import { MAJORS, type RunState, type SynergyId } from '../../src/types';
import { EV, isFront, teamEval, unitEval } from './eval';
import { memberships } from '../../src/engine/build';
import { setEvalMode, type SynProf } from './syn';
import { SYNPROF } from './synprofile.gen';

declare const process: { stdout: { write(s: string): void }; stderr: { write(s: string): void }; argv: string[] };
const SEEDS = +(process.argv[2] || 14);
const POINTS = [{ ph: 3, rank: 6 }, { ph: 6, rank: 14 }];
let PHASE = 3, RANK = 6;
let wins = [0, 0, 0, 0];
const NORMAL = UNITS.filter((u) => !u.eventOnly && !u.inert && !u.king);
const memOf = (id: string) => [...UNIT_BY_ID[id].factions, ...UNIT_BY_ID[id].traits] as string[];

function team(seed: number, ids: string[]): RunState {
  const run = R.newRun(seed, ids, 'waste', 0);
  run.pending = [];
  run.phase = PHASE;
  const fr = run.units.filter((u) => isFront(u)), bk = run.units.filter((u) => !isFront(u));
  fr.forEach((u, i) => { u.pos = { c: i % 7, r: 2 - Math.floor(i / 7) }; });
  bk.forEach((u, i) => { u.pos = { c: i % 7, r: Math.floor(i / 7) }; });
  for (const u of run.units) { u.rank = RANK; for (const k of MAJORS) u.alloc[k] += RANK - 1; }
  return run;
}
/** balance.ts makeBattle 과 같다: 시너지 인원을 덮어쓴 전투 (포탑 · 무휼 자리는 기본 자리) */
function fight(run: RunState, enc: ReturnType<typeof R.genEncounter>, counts: Counts) {
  const dim = boardDims(enc.n);
  const b = new Battle(dim.w, dim.h, new Rng(enc.seed), { phase: PHASE, credits: run.credits, field: run.field, diff: 0 });
  b.keepEvents = false;
  const lay = layout(run, enc.n);
  for (const u of deployed(run)) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const c = buildAlly(b, run, u, counts);
    c.x = c.px = p.x; c.y = c.py = p.y;
    b.add(c);
  }
  for (const s of enc.enemies) {
    const e = buildEnemy(b, ENEMY_BY_ID[s.defId], PHASE, enc.mult, s);
    const ec = enemyCell(s.c, s.row, enc.n);
    e.x = e.px = ec.x; e.y = e.py = ec.y;
    if (b.unitAt(e.x, e.y)) { const f = b.freeCellNear(e.x, e.y); if (!f) continue; e.x = e.px = f.x; e.y = e.py = f.y; }
    b.add(e);
  }
  b.start();
  b.runToEnd();
  const t = Math.max(1, b.t);
  const A = b.units.filter((x) => x.side === 0);
  const syn = Object.values(b.synStats).filter((x) => x.side === 0);
  const dmg = A.reduce((s, x) => s + x.counters.dmg, 0) + syn.reduce((s, x) => s + x.dmg, 0);
  const taken = A.reduce((s, x) => s + x.counters.taken, 0);
  const core = A.filter((x) => !x.isSummon);
  const mh = core.reduce((s, x) => s + x.st.maxHp, 0);
  const lost = 1 - (mh > 0 ? core.reduce((s, x) => s + (x.alive ? Math.max(0, x.hp) : 0), 0) / mh : 0);
  return { off: dmg / t, dur: taken / Math.max(0.05, lost), win: b.winner === 0 ? 1 : 0 };
}
/** 인원을 덮어쓴 상태의 평가 함수 합 (잔차 없음) */
function teamEvalWith(run: RunState, us: ReturnType<typeof deployed>, counts: Counts) {
  let off = 0, ehp = 0, heal = 0;
  const per = new Map<string, { off: number; ehp: number; heal: number }>();
  const cmds = us.filter((u) => UNIT_BY_ID[u.defId].ctype === 'CMD');
  const tac = cmds.length ? teamEval(run, us).tac : 0;
  for (const u of us) { const e = unitEval(run, u, counts, tac, memberships(u, run)); per.set(u.uid, e); off += e.off; ehp += e.ehp; heal += e.heal; }
  return { off, dur: ehp + EV.tau * heal, per };
}

/** S 의 인원 n 명 실측 (members 후보에서 시드마다 무작위 n명, 모자라면 문장 기물). fixed = 반드시 넣을 기물 */
function measure(S: string, n: number, opts: { fixed?: string[]; causal?: number; offCount?: number } = {}): SynProf | null {
  const pool = NORMAL.filter((u) => memOf(u.id).includes(S)).map((u) => u.id);
  const pads = NORMAL.filter((u) => !memOf(u.id).includes(S) && !memOf(u.id).includes('VOYAGE')).map((u) => u.id);
  const embOk = EMBLEM_SYNS.includes(S as SynergyId);
  if (pool.length < n && !embOk) return null;
  const ro: number[] = [], rd: number[] = [], so: number[] = [], sd: number[] = [];
  const rng = new Rng(9001 + S.length * 31 + n * 7);
  for (let s = 0; s < SEEDS; s++) {
    const fixed = opts.fixed || [];
    const mem = [...fixed, ...rng.sample(pool.filter((x) => !fixed.includes(x)), Math.min(pool.length - fixed.length, n - fixed.length))];
    const nEmb = n - mem.length;
    const N = Math.min(10, Math.max(6, n + 2));
    const pad = rng.sample(pads, N - mem.length);
    const run = team(4001 + s * 17, [...mem, ...pad]);
    for (let k = 0; k < nEmb; k++) { const u = run.units.find((x) => x.defId === pad[k])!; u.mod = emblemId(S as SynergyId); }
    if (opts.causal !== undefined) run.causal = opts.causal;
    const on = synergyCounts(deployed(run), run);
    if ((on[S as SynergyId] || 0) !== n) continue; // 인원이 맞지 않는 묶음 (문장 · 소속 겹침) 은 건너뛴다
    const off: Counts = { ...on, [S]: opts.offCount ?? 0 };
    if (S === 'CHR') off.KING = 0;
    const enc = R.genEncounter(run, 'battle');
    // 버틴 피해: 아군이 두 상태 모두 쓰러지는 강한 조우 (받은 피해 = 버틸 수 있는 피해). 켠 상태가 이기면 강도를 올려 다시
    let aD = fight(run, enc, on), bD = aD;
    for (const m of [1.5, 3, 6, 12, 24, 48, 96, 192]) { // 가장 약한 '둘 다 지는' 강도 (너무 센 조우는 한 방에 쓰러져 체력 · 방어 가치를 낮게 본다)
      const encD = { ...enc, mult: enc.mult * m };
      aD = fight(run, encD, on); bD = fight(run, encD, off);
      if (!aD.win && !bD.win) break;
    }
    const a = fight(run, enc, on), b = fight(run, enc, off);
    const encB = R.genEncounter(run, 'boss'); // 보스 조우 (같은 페이즈)
    const aB = fight(run, encB, on), bB = fight(run, encB, off);
    a.dur = aD.dur; b.dur = bD.dur;
    wins[0] += a.win; wins[1] += b.win; wins[2] += aD.win; wins[3] += bD.win;
    const va = teamEvalWith(run, deployed(run), on), vb = teamEvalWith(run, deployed(run), off);
    if (a.off <= 0 || b.off <= 0 || a.dur <= 0 || b.dur <= 0) continue;
    if (aB.off <= 0 || bB.off <= 0) continue;
    ro.push(0.5 * (Math.log(a.off / b.off) + Math.log(aB.off / bB.off)) - Math.log(va.off / vb.off));
    rd.push(Math.log(a.dur / b.dur) - Math.log(va.dur / vb.dur));
    const ms = deployed(run).filter((u) => memberships(u, run).includes(S as SynergyId));
    so.push(ms.reduce((x, u) => x + vb.per.get(u.uid)!.off, 0) / vb.off);
    sd.push(ms.reduce((x, u) => { const e = vb.per.get(u.uid)!; return x + e.ehp + EV.tau * e.heal; }, 0) / vb.dur);
  }
  if (ro.length < 6) return null;
  const st = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1); return [m, Math.sqrt(v / xs.length)]; };
  const [o, oe] = st(ro), [d, de] = st(rd);
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return { o: r3(o), oe: r3(oe), d: r3(d), de: r3(de), so: r3(st(so)[0]), sd: r3(st(sd)[0]), n: ro.length };
}

setEvalMode(true);
for (const k of Object.keys(SYNPROF)) delete SYNPROF[k]; // 처음부터 (단독 출항 값은 아래에서 먼저 채운다)
const out: Record<string, SynProf> = {};
const put = (k: string, p: SynProf | null) => { if (p) { out[k] = p; SYNPROF[k] = p; process.stderr.write(`${k} ${JSON.stringify(p)} 승 ${wins.join('/')}\n`); } wins = [0, 0, 0, 0]; };
// 조각 실행 (선택): node … <시드 수> <안 씀> <조각 번호> <조각 수> → JSON 조각 (tools 에서 합친다). 출항기는 0번 조각에서만
const SHARD = +(process.argv[4] || 0), NSH = +(process.argv[5] || 1);
let idx = 0;
const mine = () => idx++ % NSH === SHARD;
for (const P of POINTS) {
  PHASE = P.ph; RANK = P.rank;
  const at = `@${P.ph}`;
  // 1. 단독 출항: 기물 1명 (평가 함수 예측은 켜고 끈 상태가 같다 → 고유 능력 몫 그대로). 완전체(VOYAGE:2)는 이 값으로 기물 실측에서 고유 능력을 뺀 상태와 비교한다
  if (SHARD === 0) {
    for (const id of NORMAL.filter((u) => memOf(u.id).includes('VOYAGE')).map((u) => u.id)) put(`VOYAGE:solo:${id}${at}`, measure('VOYAGE', 1, { fixed: [id] }));
    put(`VOYAGE:2${at}`, measure('VOYAGE', 5));
  }
  // 2. 시너지 단계별 (청라는 인과 단계별)
  for (const s of SYNERGIES) {
    if (s.tiers.length < 2 || s.id === 'VOYAGE') continue;
    s.tiers.forEach((n, i) => {
      if (s.id === 'CHR') { for (const st of [1, 4, 7]) if (mine()) put(`CHR:${i + 1}:${st}${at}`, measure('CHR', n, { causal: causalNeed(st) })); }
      else if (mine()) put(`${s.id}:${i + 1}${at}`, measure(s.id, n));
    });
  }
}
if (NSH > 1) process.stdout.write(JSON.stringify(out));
else process.stdout.write(`// 자동 생성: tests/chulsu/synprofile_gen.ts (npm run -s chulsu-synprofile). 손으로 고치지 않는다\nimport type { SynProf } from './syn';\nexport const SYNPROF: Record<string, SynProf> = ${JSON.stringify(out, null, 0).replace(/},"/g, '},\n  "')};\n`);
