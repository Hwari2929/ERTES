// 사이오닉 대표 조합 기여 시뮬: 학파별 변형 + 강화 조합을 같은 시드 · 같은 편성으로 돌려 기여를 비교한다.
declare const process: { env: Record<string, string | undefined> };
// 실행: npx esbuild tests/psi_combo_sim.ts --bundle --platform=node --log-level=error --outfile=dist/psi_combo_sim.cjs && node dist/psi_combo_sim.cjs
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';

const COMBOS: [string, string, string[]][] = [
  ['홍염', 'romani', ['pyro']], ['홍염', 'romani', ['pyro', 'beacon']], ['홍염', 'romani', ['pyro', 'beacon', 'runaway']], ['홍염', 'romani', ['pyro', 'wp', 'white']],
  ['시공', 'romani', ['chrono']], ['시공', 'romani', ['chrono', 'storm']], ['시공', 'romani', ['chrono', 'haste']], ['시공', 'romani', ['chrono', 'haste', 'storm']], ['시공', 'romani', ['chrono', 'haste', 'perma', 'stop', 'revert']],
  ['뇌전', 'nadir', ['volt']], ['뇌전', 'nadir', ['volt', 'overload', 'chain', 'short']], ['뇌전', 'nadir', ['volt', 'reverse']], ['뇌전', 'nadir', ['volt', 'reverse', 'overload', 'chain', 'short']], ['뇌전', 'nadir', ['volt', 'reverse', 'hv']],
  ['파장', 'zephyro', ['wave']], ['파장', 'zephyro', ['wave', 'attract', 'impact', 'amp']],
  ['파종', 'joshua', ['seed']], ['파종', 'joshua', ['seed', 'regen']], ['파종', 'joshua', ['seed', 'regen', 'conc', 'necro']],
  ['정신', 'yelena', ['mind']], ['정신', 'yelena', ['mind', 'ascend', 'dominate']], ['정신', 'yelena', ['mind', 'hypno']], ['정신', 'yelena', ['mind', 'hypno', 'ascend', 'dominate']],
  ['보화', 'onyx', ['gold']], ['보화', 'onyx', ['gold', 'dividend']], ['보화', 'onyx', ['gold', 'dividend', 'folio', 'futures']],
  ['환조', 'hiiro', ['illusion']], ['환조', 'hiiro', ['illusion', 'clone']], ['환조', 'hiiro', ['illusion', 'clone', 'solid']], ['환조', 'hiiro', ['illusion', 'clone', 'troupe']], ['환조', 'hiiro', ['illusion', 'clone', 'solid', 'troupe', 'echo']],
];
// SET=sp: 스페셜 변형 + 기존 강화 조합 (배타 리워크 확인용)
const SP_COMBOS: [string, string, string[]][] = [
  ['라르스', 'lars', []], ['라르스', 'lars', ['subcon']], ['라르스', 'lars', ['subcon', 'counsel', 'elite', 'penalty']],
  ['카이로', 'kairo', []], ['카이로', 'kairo', ['cocktail']], ['카이로', 'kairo', ['cocktail', 'double', 'patience', 'lastorder']],
  ['비앙카', 'bianca', []], ['비앙카', 'bianca', ['sample']], ['비앙카', 'bianca', ['sample', 'unleash', 'symbiosis', 'regen']],
  ['에이든', 'aiden', []], ['에이든', 'aiden', ['human']], ['에이든', 'aiden', ['human', 'tail', 'gap', 'cat']], ['에이든', 'aiden', ['bar', 'illusion']],
  ['밍키', 'mingki', []], ['밍키', 'mingki', ['tame']], ['밍키', 'mingki', ['tame', 'appetite', 'purr', 'second', 'awake']],
  ['비외른', 'bjorn', ['berserk']], ['비외른', 'bjorn', ['berserk', 'valhalla']],
  ['윈터', 'winter', []], ['윈터', 'winter', ['trial']], ['윈터', 'winter', ['trial', 'vaccine', 'antidote', 'overheal', 'tenure']],
  ['마오', 'mao', []], ['마오', 'mao', ['bar', 'contract', 'vip']], ['밍키', 'mingki', ['appetite', 'purr', 'second', 'awake']], ['마오', 'mao', ['bomb']], ['마오', 'mao', ['bomb', 'bar', 'contract', 'vip']],
];
const MATES = ['vivian', 'falcon', 'gunnir', 'zahara'];
const SEEDS = 16;
console.log('학파\t조합\t승률\t전투(초)\t기물 피해/초\t팀 피해/초\t팀 회복+보호막/초');
const SP = process.env.SET === 'sp';
for (const [sch, def, keys] of SP ? SP_COMBOS : COMBOS) {
  let win = 0, time = 0, own = 0, team = 0, sup = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const run = R.newRun(100 + s, [def, ...MATES.slice(0, 2)]);
    for (const m of MATES.slice(2)) R.recruit(run, m);
    run.pending = [];
    run.phase = +(process.env.PH || 2);
    for (const u of run.units) u.rank = +(process.env.RK || 8);
    const u = run.units.find((x) => x.defId === def)!;
    u.augments = SP ? keys.map((k) => ({ id: `${def}.sp.${k}` })) : [{ id: `school.${keys[0]}` }, ...keys.slice(1).map((k) => ({ id: `psi.${keys[0]}.${k}` }))];
    R.enterNode(run, R.currentOptions(run)[0]);
    run.pending = [];
    R.autoPlace(run);
    if (!run.node?.enc) continue;
    const b = buildBattle(run, run.node.enc, false);
    b.runToEnd();
    const owner = b.units.find((c) => c.src === u);
    if (b.winner === 0) win++;
    time += b.t;
    for (const c of b.units) {
      if (c.side !== 0) continue;
      const d = c.counters.dmg, h = c.counters.healed + c.counters.shield;
      team += d / b.t; sup += h / b.t;
      if (c === owner || (c.isSummon && c.owner === owner)) own += d / b.t;
    }
  }
  console.log(`${sch}\t${(SP ? keys : keys.slice(1)).join('+') || '기본'}\t${(win / SEEDS * 100).toFixed(0)}%\t${(time / SEEDS).toFixed(1)}\t${(own / SEEDS).toFixed(1)}\t${(team / SEEDS).toFixed(1)}\t${(sup / SEEDS).toFixed(1)}`);
}
