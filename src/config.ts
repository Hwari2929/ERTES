// 밸런스 수치 모음. [임시] 표시는 기획 확정 전 기본값.
export const CFG = {
  // ── 메이저 → 마이너 환산 [임시]
  conv: {
    vit: { maxHp: 60, healEff: 0.02 },
    pow: { shoot: 5, strike: 5, tech: 5 },
    mnd: { acc: 0.02, crit: 0.02, effHit: 0.03 },
    def: { armor: 60, effRes: 0.03 },
    agi: { moveSpd: 0.04, eva: 0.02 },
  },
  // 모든 기물 공통 기초 마이너 스탯 [임시]
  baseMinor: { maxHp: 300, shoot: 20, strike: 20, tech: 20, armor: 100, crit: 0.05, critDmg: 1.5 },

  // ── 전투 규칙 (확정)
  armorK: 2000,
  baseHit: 0.8,
  grazeBase: 0.3, grazeAccK: 0.5, grazeChanceMax: 0.8,
  grazeDmgBase: 0.2, grazeDmgAccK: 0.25, grazeDmgMax: 0.5,
  armorFactor: { phys: 1, chem: 0.5, elec: 0.5, psy: 0, holy: 0.5, true: 0 } as Record<string, number>,
  reductionCap: 0.8,
  tick: 0.05,
  moveTime: 0.45, // 1칸 이동 시간(초) / 이동속도 배율
  overtimeStart: 45, overtimeRamp: 0.1, timeLimit: 75,

  // ── 무한 모드 페이즈 스케일링 (확정, 복리)
  phaseArmor: 1.25, phaseAmp: 1.35,
  // 체력 배율: 5페이즈까지 ×2, 6페이즈부터 ×1.9, ×1.8 … (하한 ×1.1 [임시])
  phaseHpFactor: (p: number) => (p <= 5 ? 2 : Math.max(1.1, 2 - 0.1 * (p - 5))),
  adversityMult: 1.6,
  enemyHpMul: 1.8, enemyPowMul: 1.6, // 적 기초 수치 전체 배율 (튜닝용)

  // ── 성장
  maxRank: 99, // 10 이상은 스탯만
  augmentMaxRank: 10, // 이 등급까지만 증강 선택
  xpToNext: (rank: number) => 2 + 2 * rank, // 1→2: 4pt … 9→10: 20pt [임시]
  rankPoints: (newRank: number) => (newRank % 5 === 0 ? 5 : 2), // 5의 배수 등급은 +5
  forcedUnitAugRanks: [3, 6, 9],
  xpPool: (phase: number) => 6 + 3 * phase, // 전투 1회 공명도 풀 [임시]
  buyXpCost: 4, buyXpAmount: 4, // [임시]
  augmentChoices: 3, augmentRerolls: 1,

  // ── 파티/보드
  startUnits: 3, maxParty: 10,
  deployCap: (phase: number) => Math.min(10, 3 + phase), // [임시]
  boardSizes: [ { n: 6, w: 70, env: '표준 전장' }, { n: 5, w: 15, env: '협소한 통로' }, { n: 7, w: 15, env: '개활지' } ],

  // ── 경제 [임시]
  startCredits: 6,
  winCredits: (phase: number) => 5 + Math.floor(phase / 2),
  lossCredits: 2,
  interestPer: 10, interestMax: 5,
  streakBonus: (streak: number) => (streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0),
  price: { C: 5, A: 14, L: 40 } as Record<string, number>,
  sell: { C: 2, A: 6, L: 15 } as Record<string, number>,
  inventoryMax: 12,

  // ── 플레이어 체력 [임시]
  playerHp: 100,
  lossDamage: (phase: number, survivors: number) => 3 + 2 * phase + survivors,
  bossLossDamage: (phase: number) => 10 + 3 * phase,

  globalAugEvery: 3, // 런 시작 + n 페이즈마다
};

/** p 페이즈 적 체력 누적 배율 */
export function phaseHpMult(p: number): number {
  let m = 1;
  for (let k = 2; k <= p; k++) m *= CFG.phaseHpFactor(k);
  return m;
}
