// 밸런스 수치 모음. [임시] 표시는 기획 확정 전 기본값.
export const CFG = {
  // ── 메이저 → 마이너 환산 [임시]
  conv: {
    vit: { maxHp: 120, healEff: 0.02 },
    pow: { shoot: 5, strike: 5, crit: 0.01 },
    mnd: { tech: 5, acc: 0.02, effHit: 0.03 },
    def: { armor: 60, effRes: 0.03 },
    agi: { moveSpd: 0.04, eva: 0.01, atkSpd: 0.01, reloadSpd: 0.01 },
  },
  // ── 리워크 [임시]
  finishMult: 2.6, // 콤보 무기 피니쉬 배율 (콤보 타격은 무기 계수 그대로)
  // 전술 위력 (사격 · 타격 · 기술 위력과 같은 단위): 출전 4명 · 지휘관 1명 기준 100
  resultDelay: 1.1, // 전투가 끝나고 결과 창이 뜨기까지 (초)
  tacBase: 100, tacPerUnit: 16, tacPerCmd: 40, tacPerMnd: 2,
  reasonStart: 50, // 사이오닉 이성 시작값
  divCap: 200, // 디바인 전투당 신성력 수집 상한
  powerPerDiv: 20, powerMax: 10, // 권능 포인트 = 모은 신성력 ÷ 20 (전투당 최대 10)
  // 전술 유형별 성장 주기
  growth: {
    pick: (tt: string, rank: number) => tt !== 'special' && rank % 3 === 0,
    aug: (tt: string, rank: number) => rank % (tt === 'major' ? 3 : 5) === 0,
    psionic: (tt: string, rank: number) => tt === 'psionic' && rank % 4 === 0,
  },
  // 모든 기물 공통 기초 마이너 스탯 [임시]
  baseMinor: { maxHp: 600, shoot: 20, strike: 20, tech: 20, armor: 100, crit: 0.05, critDmg: 1.5 },

  // ── 전투 규칙 (확정)
  armorK: 2000,
  baseHit: 0.8,
  minHit: 0.15, // 최저 명중률 (회피 과다 누적 방지) [임시]
  grazeBase: 0.3, grazeAccK: 0.5, grazeChanceMax: 0.8,
  grazeDmgBase: 0.2, grazeDmgAccK: 0.25, grazeDmgMax: 0.5,
  armorFactor: { phys: 1, chem: 0.5, elec: 0.5, psy: 0, holy: 0.5, true: 0 } as Record<string, number>,
  reductionCap: 0.8,
  tick: 0.05,
  moveTime: 0.45, // 1칸 이동 시간(초) / 이동속도 배율
  overtimeStart: 45, overtimeRamp: 0.1, timeLimit: 75,

  // ── 무한 모드 페이즈 스케일링 (확정, 복리)
  phaseArmor: 1.25, phaseAmp: 1.4,
  // 체력 배율: 5페이즈까지 ×2.05, 6페이즈부터 ×1.9, ×1.8 … (하한 ×1.1 [임시])
  // 고페이즈 보정 [임시]: lateFrom 페이즈부터 매 페이즈 체력 ×lateHp, 피해 ×lateAmp 추가 (8페이즈 누적 체력 -19%, 피해 +41%)
  lateFrom: 5, lateHp: 0.9, lateAmp: 1.09,
  phaseHpFactor: (p: number) => (p <= 5 ? 2.05 : Math.max(1.1, 2 - 0.1 * (p - 5))) * (p >= CFG.lateFrom ? CFG.lateHp : 1),
  adversityMult: 1.6,
  enemyHpMul: 5.6, enemyPowMul: 2.5, // 적 기초 수치 전체 배율 (튜닝용)
  // 아군 치명타 · 회피 환산은 0.01 (예전 0.02 의 0.5배). 적은 아래 배율로 예전 값을 유지한다
  // 적 메이저 → 명중 · 회피 · 치명타 · 효과 저항 환산 배율 (아군 환산 × 배율). 페이즈 6 일반 적 기준 회피 ~30% · 치명타 ~35% · 효과 저항 ~30%
  enemyMajorConv: { acc: 0.3, eva: 2.5, crit: 1.8, effRes: 0.4 },
  enemyEvaCap: 0.6, enemyCritCap: 0.75,
  // 늘어난 회피 · 치명타만큼 체력 · 피해를 깎아 총 난이도를 맞춘다: 치명타 1%p = 피해 2%, 회피는 유효 체력 1/(1-회피) 기준
  enemyOldConv: { eva: 0.5, crit: 0.5 },

  // ── 성장
  maxRank: 99, // 10 이상은 스탯만
  rankPowGrowth: 1.025, // 공명 등급당 사격 · 타격 · 기술 위력 독립 배율
  augEvery: 5, // n등급마다 기물 전용 증강 1개
  hasRankAug: (rank: number) => rank % CFG.augEvery === 0,
  xpToNext: (rank: number) => 2 + 2 * rank, // 1→2: 4pt … 9→10: 20pt [임시]
  // 등급업: 모든 메이저 +rankAll. statEvery 등급마다 서로 다른 메이저 rankPicks개를 골라 각각 +rankPoints
  rankAll: 1, rankPicks: 2, rankPoints: 3, statEvery: 3,
  hasRankPick: (rank: number) => rank % CFG.statEvery === 0,
  xpPool: (phase: number) => 6 + 3 * phase, // 전투 1회 공명도 풀 [임시]
  buyXpCost: 4, buyXpAmount: 4, // [임시]
  augmentChoices: 3, augmentRerolls: 1,

  // ── 파티/보드
  victoryPhase: 6, // 이 페이즈 보스를 이기면 의뢰 성공
  // 전환 노드 (짝수 페이즈): 휴식 = 체력 회복 + 공명도 소량 / 도전 = 다음 페이즈 역경급 전투, 승리 시 남은 노드 보상을 몰아 받고 다음 페이즈로
  forkRestHp: 10, forkRestLost: 0.2, forkRestXp: 0.5, // 휴식: 체력 +n + 잃은 체력 × lost (내림), 공명도 = 전투 1회 풀 × k
  challengeXp: 4.5, // 도전 승리: 공명도 = 전투 1회 풀 × k
  amundsenRecruitW: 0.08, // 아문센 · 데미우르고스 영입 후보 가중치 (다른 기물 = 1)
  joinRankRatio: 0.7, // 영입 · 합류 등급 = max(페이즈 - 1, 출전 기물 평균 등급 × k)
  startUnits: 4, maxParty: 16, // 출전 최대 10 + 대기 6
  deployBase: 4, // 기본 출전 인원. 함대 확장으로 늘린다
  fleetCosts: [20, 40, 56, 72, 90, 108, 128, 160, 200, 256], // 함대 확장 n번째 비용 (출전 5 → 14명)
  musterCost: 16, musterStep: 8, musterPicks: 3, // 지정 소집: 기본 가격, 회당 상승, 고르는 시너지 수
  benchXpWeight: 0.5, // 대기 기물의 공명도 분배 가중치 (출전 기물 대비)
  boardSizes: [ { n: 7, w: 70, env: '표준 전장' }, { n: 6, w: 15, env: '협소한 통로' }, { n: 8, w: 15, env: '개활지' } ],
  bossBoard: 7,
  rarePhase: 3, // 아문센 · 데미우르고스가 영입 후보에 나오는 페이즈 (배치 제한은 없음)
  cookPower: [1, 1.4, 2.1, 3.5], // 셰프 단계별 요리 위력 배율 (0단계 = 미발동)

  // ── 경제 [임시]
  startCredits: 6,
  winCredits: (phase: number) => Math.floor(2.5 + phase / 2), // 노드가 늘어 이자가 쌓이므로 노드당 2~3 감소 (P1 3 · P3 4 · P6 5)
  lossCredits: 2,
  interestPer: 10, interestMax: 5,
  streakBonus: (streak: number) => (streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0),
  price: { C: 7, G: 16, A: 16, L: 60 } as Record<string, number>,
  sell: { C: 3, G: 7, A: 7, L: 20, M: 6, O: 8, K: 4 } as Record<string, number>,
  // 장비 드랍 [임시]
  drop: { battle: 0.1, adversity: 0.5, bossAdvEvery: 3, bossPart: 0.5, shopParts: 2, shopAdv: 0.4, shopAdv2: 0.1, shopGraded: 0.15, shopLegend: 0.05, shopLegendPhase: 6, supplyAdv: 0.12, utility: { battle: 0.15, adversity: 0.3, boss: 0.5 } as Record<string, number> },
  inventoryMax: 32,

  // ── 플레이어 체력 [임시]
  playerHp: 100,
  lossDamage: (phase: number, survivors: number) => 3 + 2 * phase + survivors,
  bossLossDamage: (phase: number) => 10 + 3 * phase,

  privilegeRerolls: 3, // 런 시작 특권 증강 새로고침 횟수
  globalRerolls: 1, // 항로 회의 전역 증강 새로고침 횟수
};

/** p 페이즈 적 피해 누적 배율 */
export function phaseAmpMult(p: number): number {
  return Math.pow(CFG.phaseAmp, p - 1) * Math.pow(CFG.lateAmp, Math.max(0, p - CFG.lateFrom + 1));
}

/** p 페이즈 적 체력 누적 배율 */
export function phaseHpMult(p: number): number {
  let m = 1;
  for (let k = 2; k <= p; k++) m *= CFG.phaseHpFactor(k);
  return m;
}
