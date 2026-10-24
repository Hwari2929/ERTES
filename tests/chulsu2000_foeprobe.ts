// 적 장비 풀 확인 (BALANCE_CHULSU_2000 5절): 위험 등급별로 역경 · 보스 조우를 페이즈마다 만들어 적이 단 장비 id 를 센다 (전투는 하지 않는다).
// 실행: npx esbuild tests/chulsu2000_foeprobe.ts --bundle --platform=node --log-level=error --outfile=dist/foeprobe.cjs && node dist/foeprobe.cjs [런 수=200]
import * as R from '../src/engine/run';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { UNITS } from '../src/data/units';

declare const process: { argv: string[]; stdout: { write(s: string): void } };
const N = +process.argv[2] || 200;
const starters = UNITS.filter((u) => !u.noStarter).slice(0, 4).map((u) => u.id);
const out: Record<string, Record<string, number>> = {};
for (const diff of [6, 7]) for (const type of ['adversity', 'boss'] as const) {
  const c: Record<string, number> = { _foes: 0, _boss: 0, _mod: 0 };
  for (let s = 1; s <= N; s++) {
    const run = R.newRun(70000 + s, starters, undefined, diff);
    for (let ph = 1; ph <= 6; ph++) {
      run.phase = ph;
      for (const e of R.genEncounter(run, type, ph).enemies) {
        c._foes++; if (ENEMY_BY_ID[e.defId].tier === 'boss') c._boss++; if (e.mod) c._mod++;
        for (const it of e.items || []) c[it] = (c[it] || 0) + 1;
      }
    }
  }
  out[`${diff}|${type}`] = c;
}
process.stdout.write(JSON.stringify(out));
