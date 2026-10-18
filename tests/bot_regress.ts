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

process.stdout.write(fails ? `\n${fails}개 실패\n` : '\n모두 통과\n');
process.exitCode = fails ? 1 : 0;
