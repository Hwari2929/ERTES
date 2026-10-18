// 철수 봇: 기물 증강 실측 (공개 정보 = 기물 · 증강 정의만 사용). 결과 → tests/chulsu/augprofile.gen.ts
// 실행: npm run -s chulsu-augprofile   (증강 · 기물 · 전투 수치가 바뀌면 다시 돌린다. 없는 증강은 평가 함수 V 만 쓴다)
// 방법 (profile_gen.ts 와 같은 틀): 기준 아군 3명 + 기물 X (공명 4, 생명력 +60 · 방어력 +40 보강) 가 3페이즈 일반 조우 SEEDS 개와 싸운다.
//   X 자리를 반려 돌로 바꾼 같은 시드 전투와 비교해 X 의 팀 초당 피해 · 회복 기여를 재고, 증강 A 를 단 X 와 달지 않은 X 의 기여 비율을 낸다.
//  - d: (A 를 단 X 의 팀 피해 기여) ÷ (달지 않은 X 의 기여) − 1 · h: 회복 기여 같은 비율 (회복 기여가 작으면 0)
//  - 메이저 증강 12종 (집중 단련은 능력치 5종 따로) · 스페셜 전용 증강 · 사이오닉 학파(전공 2종) · 학파별 전공 증강 (그 학파를 단 상태 대비)
import { buildBattle } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import { UNITS } from '../../src/data/units';
import { PETROCK } from '../../src/data/despair';
import { MAJOR_AUGS } from '../../src/data/rework';
import { schoolPassives } from '../../src/data/psionic';
import { majorsOf, schoolAugId } from '../../src/data/schools';
import { MAJORS, type AugPick } from '../../src/types';

declare const process: { stdout: { write(s: string): void }; stderr: { write(s: string): void } };
const SEEDS = 16, RANK = 4, PHASE = 3;
/** 기준 아군 (profile_gen.ts REFS 와 같다: 지휘관 아님 · 서로 시너지가 겹치지 않게) */
const REFS = [['juseong', 'falcon', 'gebek'], ['kyle', 'argon', 'mirinae']];

function fight(team: string[], seed: number, xi: number, augs: AugPick[]) {
  const run = R.newRun(seed, team, 'waste', 0);
  run.pending = [];
  run.phase = PHASE;
  run.units.forEach((u, i) => {
    u.pos = { c: 2 + i, r: i === 0 ? 2 : i === xi ? 1 : 0 };
    if (u.defId === PETROCK) return;
    u.rank = RANK; for (const k of MAJORS) u.alloc[k] += RANK - 1;
    u.perm.vit += 60; u.perm.def += 40;
    if (i === xi) u.augments = augs.slice();
  });
  const enc = R.genEncounter(run, 'battle');
  const b = buildBattle(run, enc, false);
  b.runToEnd();
  const t = Math.max(1, b.t);
  const al = b.units.filter((x) => x.side === 0);
  return { d: al.reduce((s, x) => s + x.counters.dmg, 0) / t, h: al.reduce((s, x) => s + x.counters.healed + x.counters.shield, 0) / t };
}

const out: Record<string, Record<string, { d: number; h: number }>> = {};
const baseCache = new Map<string, { d: number; h: number }>();
/** X 의 기여 (증강 묶음 augs): 시드 평균 [피해, 회복] */
function contrib(id: string, augs: AugPick[]): { d: number; h: number }[] {
  const refs = REFS.find((r) => !r.includes(id))!;
  const res: { d: number; h: number }[] = [];
  for (let s = 1; s <= SEEDS; s++) {
    const seed = s * 131;
    const bk = `${refs.join()}|${seed}`;
    let base = baseCache.get(bk);
    if (!base) { base = fight([refs[0], PETROCK, ...refs.slice(1)], seed, 1, []); baseCache.set(bk, base); }
    const a = fight([refs[0], id, ...refs.slice(1)], seed, 1, augs);
    res.push({ d: a.d - base.d, h: a.h - base.h });
  }
  return res;
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** 비율: 같은 시드 짝 합의 비 (기여가 작으면 0) */
function ratio(a: { d: number; h: number }[], b: { d: number; h: number }[]) {
  const sd = (xs: { d: number; h: number }[], k: 'd' | 'h') => xs.reduce((s, x) => s + x[k], 0);
  const d0 = Math.max(1, sd(b, 'd')), h0 = sd(b, 'h');
  return { d: r3(Math.max(-0.5, Math.min(3, (sd(a, 'd') - sd(b, 'd')) / d0))), h: r3(h0 > SEEDS * 2 ? Math.max(-0.5, Math.min(3, (sd(a, 'h') - h0) / h0)) : 0) };
}

let n = 0;
for (const d of UNITS) {
  if (d.king || d.inert) continue;
  const tt = d.ttype;
  if (tt !== 'major' && tt !== 'special' && tt !== 'psionic') continue;
  const rec: Record<string, { d: number; h: number }> = (out[d.id] = {});
  if (tt === 'major') {
    const c0 = contrib(d.id, []);
    for (const a of MAJOR_AUGS) {
      const params = a.roll ? [...MAJORS] : [undefined];
      for (const p of params) { rec[p ? `${a.id}:${p}` : a.id] = ratio(contrib(d.id, [{ id: a.id, ...(p ? { param: p } : {}) }]), c0); n++; }
    }
  } else if (tt === 'special') {
    const c0 = contrib(d.id, []);
    for (const a of d.specialAugs || []) {
      const p = a.roll ? a.roll((arr) => arr[0]) : undefined;
      rec[a.id] = ratio(contrib(d.id, [{ id: a.id, ...(p ? { param: p } : {}) }]), c0); n++;
    }
  } else {
    const c0 = contrib(d.id, []);
    for (const s of majorsOf(d.id)) {
      const sa = { id: schoolAugId(s) };
      const cs = contrib(d.id, [sa]);
      rec[sa.id] = ratio(cs, c0); n++;
      for (const a of schoolPassives(s)) { rec[a.id] = ratio(contrib(d.id, [sa, { id: a.id }]), cs); n++; }
    }
  }
  process.stderr.write(`${d.id} ${Object.keys(rec).length}\n`);
}
process.stderr.write(`증강 ${n}개\n`);
process.stdout.write(`// 자동 생성: tests/chulsu/augprofile_gen.ts (npm run -s chulsu-augprofile). 손으로 고치지 않는다\n// [기물][증강 id(:능력치)] = { d: 팀 피해 기여 비율 변화, h: 회복 기여 비율 변화 }\nexport const AUGPROF: Record<string, Record<string, { d: number; h: number }>> = ${JSON.stringify(out).replace(/}},"/g, '}},\n  "')};\n`);
