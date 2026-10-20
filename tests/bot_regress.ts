// 봇 장비 운용 회귀 테스트 (덤비 = 예전 botlib, 라라 = 결함 수정판, 철수 = 새 봇의 장비 계획).
// 실행: npm run -s bot-regress   (종료 코드 0 = 통과)
// 각 상황에서 덤비가 결함을 '재현'하는지도 함께 확인한다 (상황 구성이 맞는지 검증 — 덤비 동작을 바꾸면 여기서 알려 준다).
import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import type { RunState } from '../src/types';
import { equipGear, equipGearFix, newIns, useConsumables, useConsumablesFix } from './botlib';
import { Chulsu } from './chulsu';
import * as A from './chulsu/aug';
import * as E from './chulsu/econ';
import * as H from './chulsu/hard';
import { lossCost, reserve } from './chulsu/econ';
import { teamEval } from './chulsu/eval';
import { effTier, setEvalMode } from './chulsu/syn';
import { formation, thresholdCands } from './chulsu/form';
import { tierOf } from '../src/data/synergies';
import { deployed, synergyCounts } from '../src/engine/build';
import { emblemId } from '../src/data/items';
import type { UnitState } from '../src/types';

declare const process: { exitCode: number; stdout: { write(s: string): void } };
let fails = 0;
function ok(cond: boolean, msg: string) {
  process.stdout.write(`${cond ? 'ok  ' : 'FAIL'} ${msg}\n`);
  if (!cond) fails++;
}

/** 위험 diff 런: 시작 기물 1명만 출전, 장비 칸 · 보관함을 직접 채운다 */
function mk(diff: number, items: (string | null)[], inv: string[], extra: (string | null)[][] = []): RunState {
  const ids = ['falcon', 'gebek', 'argon', 'romani'].slice(0, 1 + extra.length);
  const run = R.newRun(1, ids, 'waste', diff);
  run.pending = [];
  run.units.forEach((u, i) => { u.items = (i === 0 ? items : extra[i - 1]).slice(); });
  run.inventory = inv.slice();
  return run;
}
const u0 = (run: RunState) => run.units[0];

// ── 1. 인덱스 예시: 보관함 [분리 용제, 새 장비] · 칸이 찬 기물의 재료를 빼고 새 장비를 단다 (위험 7: 해제에 용제 1개 소모)
{
  const items = ['G_vit', 'G_pow', 'C_def'];
  const d = mk(CFG.solventFrom, items, ['K_strip', 'A_pow_mnd']);
  const ins = newIns();
  equipGear(d, ins);
  ok(!u0(d).items.includes('A_pow_mnd') && u0(d).items.includes('C_def') && (ins.ev.staleIdx || 0) >= 1,
    `덤비 결함 재현: 해제 뒤 옛 칸 번호로 해제된 재료(C_def)를 다시 단다 → ${JSON.stringify(u0(d).items)} · 보관함 ${JSON.stringify(d.inventory)}`);
  const f = mk(CFG.solventFrom, items, ['K_strip', 'A_pow_mnd']);
  equipGearFix(f, newIns());
  ok(u0(f).items.includes('A_pow_mnd') && !u0(f).items.includes('C_def'), `라라: 새 장비(A_pow_mnd)를 단다 → ${JSON.stringify(u0(f).items)}`);
  ok(f.inventory.includes('C_def') && !f.inventory.includes('K_strip'), `라라: 해제된 재료는 보관함, 용제 1개 소모 → ${JSON.stringify(f.inventory)}`);
}

// ── 2. 해제 실패 무시 + 첫 실패에서 중단: 위험 7 · 용제 없음. 희귀 장비는 자리가 없고, 뒤의 재료는 같은 재료와 고급 조합이 가능하다
{
  const items = ['G_vit', 'G_pow', 'C_def'];
  const d = mk(CFG.solventFrom, items, ['A_pow_mnd', 'C_def']);
  const ins = newIns();
  equipGear(d, ins);
  ok(u0(d).items.includes('C_def') && d.inventory.includes('C_def') && (ins.fail['unequip:분리 용제가 없어 장비를 옮길 수 없습니다'] || 0) >= 1,
    `덤비 결함 재현: 해제 실패를 무시하고 첫 실패에서 멈춰 조합 가능한 재료가 남는다 → ${JSON.stringify(u0(d).items)} · ${JSON.stringify(d.inventory)}`);
  const f = mk(CFG.solventFrom, items, ['A_pow_mnd', 'C_def']);
  const fi = newIns();
  equipGearFix(f, fi);
  ok(u0(f).items.includes('G_def') && f.inventory.join() === 'A_pow_mnd', `라라: 실패한 조합만 건너뛰고 재료를 고급 조합 → ${JSON.stringify(u0(f).items)} · ${JSON.stringify(f.inventory)}`);
}

// ── 3. 위험 7 분리 용제 보존: 덤비는 1개만 남기고 판다 (보관함이 절반을 넘으면 전부). 라라는 교체 예정 수 + 1 까지 남긴다
{
  const items = ['C_vit', 'C_pow', 'C_def'];
  const d = mk(CFG.solventFrom, items, ['K_strip', 'K_strip', 'K_strip']);
  useConsumables(d);
  ok(R.solventLeft(d) <= 1, `덤비 결함 재현: 위험 7에서 용제 ${R.solventLeft(d)}개만 남김`);
  const f = mk(CFG.solventFrom, items, ['K_strip', 'K_strip', 'K_strip']);
  useConsumablesFix(f);
  ok(R.solventLeft(f) === 3, `라라: 위험 7에서 용제 3개 보존 (교체 예정 재료 3개)`);
  const e = mk(6, items, ['K_strip', 'K_strip', 'K_strip']);
  useConsumablesFix(e);
  ok(R.solventLeft(e) === 1, `라라: 위험 6은 예전처럼 1개만 (해제가 무료)`);
}

// ── 4. 철수 장비 계획: 같은 상황 1 · 2에서 해제 결과 확인 · id 재확인 · 실패 건너뛰기
{
  const f = mk(CFG.solventFrom, ['G_vit', 'G_pow', 'C_def'], ['K_strip', 'A_pow_mnd']);
  const c = new Chulsu(f, { areas: new Set(['gear']) });
  c.manageGear();
  ok(u0(f).items.includes('A_pow_mnd'), `철수: 용제를 써서 희귀 장비로 교체 → ${JSON.stringify(u0(f).items)} · ${JSON.stringify(f.inventory)}`);
  const g = mk(CFG.solventFrom, ['G_vit', 'G_pow', 'C_def'], ['A_pow_mnd', 'C_def']);
  const c2 = new Chulsu(g, { areas: new Set(['gear']) });
  c2.manageGear();
  ok(u0(g).items.includes('G_def'), `철수: 용제가 없으면 해제하지 않고 조합 가능한 재료를 단다 → ${JSON.stringify(u0(g).items)} · ${JSON.stringify(g.inventory)}`);
  ok(Object.keys(c2.ins.fail).length === 0, `철수: 실패 시도 없음 ${JSON.stringify(c2.ins.fail)}`);
}

// ── 5. 철수 2단계 econ: 남길 크레딧 (이자 구간 · 체력 위험) 과 함대 확장 우선 (대기 기물이 있으면 이자 구간 아래로도)
{
  const run = R.newRun(1, ['falcon', 'gebek', 'argon', 'romani'], 'waste', 7);
  run.pending = [];
  ok(reserve(run) === R.interestInfo(run).cap * CFG.interestPer, `econ: 체력이 넉넉하면 이자 상한 구간만큼 남긴다 (${reserve(run)})`);
  run.hp = Math.floor(lossCost(run) * 2);
  ok(reserve(run) === 0, `econ: 체력 ≤ 다음 패배 비용 × 2.5 면 남기지 않는다 (체력 ${run.hp}, 패배 비용 ${lossCost(run).toFixed(1)})`);
  run.hp = run.maxHp;
  R.recruit(run, 'kyle'); // 5번째 기물: 대기
  run.credits = 25;
  const c = new Chulsu(run, { areas: new Set(['econ']) });
  c.spend();
  ok(R.deployCap(run) === CFG.deployBase + 1, `econ: 대기 기물이 있으면 이자 구간(40) 아래로도 함대 확장 (출전 ${R.deployCap(run)} · 잔액 ${run.credits})`);
}

// ── 6. 철수 2단계 recruit2 · aug: 반려 돌은 영입하지 않고, 있으면 방출한다
{
  const run = R.newRun(1, ['falcon', 'gebek', 'argon', 'romani'], 'waste', 7);
  run.pending = [];
  const c = new Chulsu(run, { areas: new Set(['recruit2', 'form']) });
  const pick = c.recruit2({ t: 'recruit', options: ['petrock', 'kyle', 'lindiwe'] });
  ok(pick !== 'petrock', `recruit2: 반려 돌을 고르지 않는다 → ${pick}`);
  ok(A.noRock(['petrock', 'kyle'], () => 0) === 'kyle', 'aug: 반려 돌을 뺀 후보에서 고른다');
  R.recruit(run, 'petrock');
  c.manageItems();
  ok(!run.units.some((u) => u.defId === 'petrock'), `recruit2: 이미 있는 반려 돌은 방출 → ${run.units.map((u) => u.defId).join(',')}`);
}

// ── 7. 공정성: 사건 · 상점 평가는 복제 런에서만 굴리고 실제 런(런 난수 포함)을 바꾸지 않는다
{
  const run = R.newRun(3, ['falcon', 'gebek', 'argon', 'romani'], 'waste', 3);
  run.pending = [{ t: 'event', id: 'volunteer' }];
  const before = JSON.stringify(run);
  const c = new Chulsu(run, { areas: new Set(['econ', 'gear', 'growth']) });
  const i = E.event(run, run.pending[0] as never, c.plan, c.log, c.rng);
  ok(i !== null && JSON.stringify(run) === before, `econ: 사건 평가 뒤에도 런 상태 · 런 난수 그대로 (고른 선택지 #${i})`);
}

// ── 8. hard: 강제 징수기는 일반 전투에 1개뿐이면 아낀다
{
  const run = R.newRun(1, ['falcon', 'gebek', 'argon', 'romani'], 'waste', 7);
  run.pending = [];
  R.enterNode(run, 'battle');
  run.node!.enc!.enemies[0].items = ['A_pow_mnd'];
  run.inventory = ['K_seize'];
  ok(!H.seize(run, new Chulsu(run, { areas: new Set(['hard']) }).log) && run.inventory.includes('K_seize'), 'hard: 일반 전투에는 징수기 1개를 쓰지 않는다');
  run.node!.type = 'adversity';
  ok(H.seize(run, new Chulsu(run, { areas: new Set(['hard']) }).log) && !run.inventory.includes('K_seize'), 'hard: 역경에서는 희귀 장비를 단 적에게 쓴다');
}


// ── 9. 3단계 syn3: 시너지 인원별 평가 (효과가 없는 인원 구간은 가산 없음 · 인원을 늘리며 잃는 효과)
{
  const eff = [0, 1, 2, 3, 4, 5, 6].map((n) => effTier('VOYAGE', n)).join(), raw = [0, 1, 2, 3, 4, 5, 6].map((n) => tierOf('VOYAGE', n)).join();
  ok(eff === '0,1,0,0,0,2,2' && raw === '0,1,1,1,1,2,2', `syn3: 출항기 효과 단계 ${eff} (엔진 tierOf ${raw}: 2~4명도 1단계로 센다)`);
  const run = R.newRun(1, ['rachel', 'nadir', 'temur', 'phyllis', 'vivian', 'kyle', 'argon', 'mirinae', 'juseong', 'falcon'], 'waste', 0);
  run.pending = [];
  const U = (id: string) => run.units.find((u) => u.defId === id)!;
  const pads = ['kyle', 'argon', 'mirinae', 'juseong', 'falcon'].map(U);
  const voy = ['rachel', 'nadir', 'temur', 'phyllis', 'vivian'].map(U);
  const team = (n: number) => [...voy.slice(0, n), ...pads.slice(0, 5 - Math.min(5, n))]; // 늘 5명: 출항기 n명 + 비구성원
  const rachel = U('rachel').uid;
  setEvalMode(false);
  const s1 = teamEval(run, team(1)), s2 = teamEval(run, team(2));
  ok(s2.per.get(rachel)!.off === s1.per.get(rachel)!.off, `2단계 V (결함 재현): 출항기 2명이 돼도 레이첼 피해 몫이 그대로 (${s1.per.get(rachel)!.off.toFixed(1)} → ${s2.per.get(rachel)!.off.toFixed(1)})`);
  setEvalMode(true);
  const t1 = teamEval(run, team(1)), t2 = teamEval(run, team(2));
  ok(t2.per.get(rachel)!.off < t1.per.get(rachel)!.off * 0.95, `syn3: 출항기 2명이면 레이첼 단독 출항 고유 능력 몫을 잃는다 (${t1.per.get(rachel)!.off.toFixed(1)} → ${t2.per.get(rachel)!.off.toFixed(1)})`);
  // 출항기 시너지 몫만 (teamEval 의 VOYAGE 잔차를 뺀 값과의 비): 2~4명 = 1, 5명 > 1
  const voyTerm = (n: number) => { const a = teamEval(run, team(n)), b = teamEval(run, team(n), 'VOYAGE'); return (a.mo * a.md) / (b.mo * b.md); };
  const vt = [2, 3, 4, 5].map(voyTerm);
  ok(vt.slice(0, 3).every((x) => Math.abs(x - 1) < 1e-9) && vt[3] > 1.2, `syn3: 출항기 시너지 배율 2~4명 ${vt.slice(0, 3).map((x) => x.toFixed(2)).join('/')} (가산 없음) · 5명 ${vt[3].toFixed(2)}`);
  // 시간 여행자 2 → 3 → 4명: 회피 회복 · 부활 몫으로 버틴 피해 배율이 오른다
  const t = R.newRun(2, ['franze', 'sarma', 'aiden', 'rachel', 'kyle', 'argon'], 'waste', 0);
  t.pending = [];
  const T = (ids: string[]) => ids.map((id) => t.units.find((u) => u.defId === id)!);
  const md = (ids: string[]) => { const a = teamEval(t, T(ids)), b = teamEval(t, T(ids), 'TIME'); return a.md / b.md; };
  const m2 = md(['franze', 'sarma', 'kyle', 'argon']), m3 = md(['franze', 'sarma', 'aiden', 'kyle']), m4 = md(['franze', 'sarma', 'aiden', 'rachel']);
  ok(m2 < m3 && m3 < m4, `syn3: 시간 여행자 2 · 3 · 4명 버틴 피해 배율 ${m2.toFixed(2)} < ${m3.toFixed(2)} < ${m4.toFixed(2)}`);
  setEvalMode(false);
}

// ── 10. 3단계 multi: 임계점 다중 교체 — 출항기 2명 출전 + 3명 · 비구성원 1명 대기면 완성(5명) · 단독(1명) 후보를 만들고, 편성 뒤 2~4명 구간에 남지 않는다
{
  setEvalMode(true);
  const run = R.newRun(1, ['rachel', 'nadir', 'kyle', 'argon', 'mirinae', 'temur', 'phyllis', 'vivian', 'falcon'], 'waste', 0);
  run.pending = [];
  run.fleet = 1; // 출전 5명
  for (const u of run.units) u.pos = null;
  ['rachel', 'nadir', 'kyle', 'argon', 'mirinae'].forEach((id, i) => { run.units.find((u) => u.defId === id)!.pos = { c: i, r: 0 }; });
  const cur = deployed(run), bench = run.units.filter((u) => !u.pos);
  const ev = (us: UnitState[]) => teamEval(run, us).v;
  const cands = thresholdCands(run, cur, bench, ev);
  const full = cands.find((c) => c.name.startsWith('완성 VOYAGE')), solo = cands.find((c) => c.name.startsWith('단독 VOYAGE'));
  ok(!!full && (synergyCounts(full.team, run).VOYAGE || 0) === 5 && !!solo && (synergyCounts(solo.team, run).VOYAGE || 0) === 1, `multi: 후보 ${cands.map((c) => c.name).join(' / ')}`);
  const c = new Chulsu(run, { areas: new Set(['form', 'multi', 'syn3']) });
  formation(run, c.log, [], undefined, true);
  const n = synergyCounts(deployed(run), run).VOYAGE || 0;
  ok(n === 1 || n >= 5, `multi: 편성 뒤 출항기 ${n}명 (2~4명 구간이 아니다) · 출전 ${deployed(run).map((u) => u.defId).join(',')}`);
  // 실제 소속: 출항기 문장을 단 기물도 구성원으로 센다
  const r2 = R.newRun(1, ['rachel', 'nadir', 'kyle', 'argon', 'mirinae', 'temur', 'phyllis'], 'waste', 0);
  r2.pending = []; r2.fleet = 1;
  for (const u of r2.units) u.pos = null;
  ['rachel', 'nadir', 'kyle', 'argon', 'mirinae'].forEach((id, i) => { r2.units.find((u) => u.defId === id)!.pos = { c: i, r: 0 }; });
  r2.units.find((u) => u.defId === 'kyle')!.mod = emblemId('VOYAGE');
  const cands2 = thresholdCands(r2, deployed(r2), r2.units.filter((u) => !u.pos), (us) => teamEval(r2, us).v);
  const f2 = cands2.find((x) => x.name.startsWith('완성 VOYAGE'));
  ok(!!f2 && f2.name.includes('3→5') && (synergyCounts(f2.team, r2).VOYAGE || 0) === 5, `multi: 문장 소속 포함 출항기 3명 → 대기 2명으로 완성 (${f2?.name})`);
  setEvalMode(false);
}

// ── 11. 3단계 boss: 보스가 벽이면 결승전 특집(보스 체력 · 피해 +30%)을 고르지 않는다 (2단계 절망표만 쓰면 고른다)
{
  const pick = (risk?: number) => {
    const run = R.newRun(5, ['falcon', 'gebek', 'argon', 'romani'], 'waste', 7);
    const p = { t: 'despair' as const, options: ['D.final', 'D.rival', 'D.tariff'], rerolls: 0 };
    run.pending = [p];
    A.despair(run, p, new Chulsu(run, { areas: new Set(['aug']) }).log, new Chulsu(run, { areas: new Set(['aug']) }).rng, risk);
    return (run.despairs || []).slice(-1)[0];
  };
  const old = pick(), neu = pick(A.bossLossRate(R.newRun(5, ['falcon'], 'waste', 7), []));
  ok(old === 'D.final' && neu !== 'D.final', `boss: 결승전 특집 · 경쟁 항로 · 관세 중 2단계 ${old} → 3단계 ${neu} (보스 패배율 사전값 ${A.BOSS.prior.d7})`);
}

process.stdout.write(fails ? `\n${fails}개 실패\n` : '\n모두 통과\n');
process.exitCode = fails ? 1 : 0;
