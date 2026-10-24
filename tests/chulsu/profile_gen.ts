// 철수 봇: 기물별 실제 기여 · 계수 측정 (공개 정보 = 기물 정의만 사용). 결과 → tests/chulsu/profile.gen.ts
// 실행: npm run -s chulsu-profile   (기물 · 전투 수치가 바뀌면 다시 돌린다. 없는 기물은 eval.ts 기본값)
// 방법: 기준 아군 3명(refs.ts refsFor: 묶음 안 · X 와 시너지 단계가 바뀌지 않는 묶음, 2 ~ 5묶음 전부) + 기물 X 를 2페이즈 일반 조우 SEEDS 개와 싸우게 한다 (묶음 × 시드 평균).
//   같은 시드에서 X 자리를 반려 돌(아무것도 하지 않는 짐)로 바꾼 전투와 비교해 '팀 초당 피해 · 회복(보호막 포함) 기여'를 잰다
//   (자기 피해 + 소환물 + 아군 강화 · 지휘관 전술 위력 몫까지 들어간다). 모두 공명 1, 생명력 +60 · 방어력 +40 보강 (오래 싸워 처리량을 잰다).
//  - d · h: X 의 팀 초당 피해 · 회복 기여 (하한 1 · 0)
//  - sp · sm: X 의 전투력 · 정신력 1점당 기여 상대 변화 (같은 시드 짝 평균), hm: 정신력 1점당 회복 기여 상대 변화
//  - P · T: 기준 상태 X 의 기본 공격 위력(사격 · 타격, 전술 무기는 기술) · 기술 위력 (참고용. 평가 함수는 같은 기준 상태를 직접 계산한다)
import { buildBattle, computeStats, unitEffects } from '../../src/engine/build';
import * as R from '../../src/engine/run';
import { UNITS } from '../../src/data/units';
import { PETROCK } from '../../src/data/despair';
import type { Major } from '../../src/types';
import { checkRefs, refsFor } from './refs';

declare const process: { stdout: { write(s: string): void } };
const SEEDS = 8, ADD = 10;
checkRefs();
const ids = UNITS.filter((u) => !u.king && !u.inert).map((u) => u.id);

function fight(team: string[], seed: number, xi: number, add: Partial<Record<Major, number>>) {
  const run = R.newRun(seed, team, 'waste', 0);
  run.pending = [];
  run.phase = 2;
  run.units.forEach((u, i) => {
    u.pos = { c: 2 + i, r: i === 0 ? 2 : i === xi ? 1 : 0 }; // 고정 배치 (X 는 가운데 줄)
    if (u.defId === PETROCK) return;
    u.perm.vit += 60; u.perm.def += 40;
    if (i === xi) for (const [k, v] of Object.entries(add)) u.perm[k as Major] += v!;
  });
  const enc = R.genEncounter(run, 'battle');
  const b = buildBattle(run, enc, false);
  b.runToEnd();
  const t = Math.max(1, b.t);
  const al = b.units.filter((x) => x.side === 0);
  return { d: al.reduce((s, x) => s + x.counters.dmg, 0) / t, h: al.reduce((s, x) => s + x.counters.healed + x.counters.shield, 0) / t };
}

const out: Record<string, unknown> = {};
const baseCache = new Map<string, { d: number; h: number }>();
for (const id of ids) {
  let d0 = 0, h0 = 0, dp = 0, dm = 0, hmS = 0;
  const sets = refsFor(id), N = sets.length * SEEDS;
  for (const refs of sets) for (let s = 1; s <= SEEDS; s++) {
    const seed = s * 97;
    const bk = `${refs.join()}|${seed}`;
    let base = baseCache.get(bk);
    if (!base) { base = fight([...refs.slice(0, 1), PETROCK, ...refs.slice(1)], seed, 1, {}); baseCache.set(bk, base); }
    const team = [refs[0], id, ...refs.slice(1)];
    const a = fight(team, seed, 1, {}), p = fight(team, seed, 1, { pow: ADD }), m = fight(team, seed, 1, { mnd: ADD });
    d0 += a.d - base.d; h0 += a.h - base.h; dp += p.d - a.d; dm += m.d - a.d; hmS += m.h - a.h;
  }
  d0 /= N; h0 /= N; dp /= N; dm /= N; hmS /= N;
  const dd = Math.max(1, d0), hh = Math.max(0, h0);
  const run = R.newRun(1, [id], 'waste', 0);
  const u = run.units[0];
  u.perm.vit += 60; u.perm.def += 40;
  const st = computeStats(u, unitEffects(run, u, {}, false)).st;
  const w = UNITS.find((x) => x.id === id)!.weapon;
  const P = w.tactical ? st.tech : w.type === 'shoot' ? st.shoot : st.strike;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  out[id] = { d: r3(dd), h: r3(hh), sp: r3(dp / dd / ADD), sm: r3(dm / dd / ADD), hm: r3(hh > 1 ? hmS / hh / ADD : 0), P: r3(P), T: r3(st.tech) };
}
process.stdout.write(`// 자동 생성: tests/chulsu/profile_gen.ts (npm run -s chulsu-profile). 손으로 고치지 않는다\nexport const PROFILE: Record<string, { d: number; h: number; sp: number; sm: number; hm: number; P: number; T: number }> = ${JSON.stringify(out, null, 0).replace(/},"/g, '},\n  "')};\n`);
