// 밸런스 수치 모음. [임시] 표시는 기획 확정 전 기본값.
import type { CType } from './types';
export const CFG = {
  // ── 메이저 → 마이너 환산 [임시]
  conv: {
    vit: { maxHp: 150, healEff: 0.02 }, // 최대 체력 138 → 150
    pow: { shoot: 5, strike: 5, crit: 0.01 },
    mnd: { tech: 5, acc: 0.02, effHit: 0.03 },
    def: { armor: 5, effRes: 0.03 }, // 방어도 69 → 5: 위력(1당 +5)과 같은 자릿수. armorK · 고정 방어도도 약 1/14 로 줄여 경감률은 거의 그대로 (armorScale)
    // 재장전 속도 1%p → 2%p: 재장전 중 기술 금지 · 제어 시 재장전 초기화로 탄창 무기 기물의 기술 횟수가 ~5.5% 줄어든 만큼 보정
    // (같은 시드 1600판: 보정 전 클리어 31.4% → 29.2%, 보정 후 32.2% · 평균 도달 페이즈 5.61 → 5.60)
    agi: { moveSpd: 0.048, eva: 0.01, atkSpd: 0.01, reloadSpd: 0.02 },
  },
  // ── 리워크 [임시]
  finishMult: 2.6, // 콤보 무기 피니쉬 배율 (콤보 타격은 무기 계수 그대로)
  // 전술 위력 (사격 · 타격 · 기술 위력과 같은 단위): 출전 4명 · 지휘관 1명 기준 tacBase
  resultDelay: 1.1, // 전투가 끝나고 결과 창이 뜨기까지 (초)
  tacBase: 100, tacPerUnit: 10, tacPerCmd: 10, tacPerMnd: 3, // 기본 100 (출전 4명 · 지휘관 1명) · 출전 1명당 ±10 · 지휘관 몫 10 · 지휘관 정신력 1당 +3 (예전 60 · 16 · 40 · 2)
  /** 지휘관 기여 감쇠: 지휘관마다 기여 (tacPerCmd + 정신력 × tacPerMnd) 를 높은 순으로 100% · 50% · 25% … 로 더한다 (지휘관 1명이면 tacBase + 정신력 × tacPerMnd 그대로) */
  tacDecay: 0.5,
  reasonStart: 50, // 사이오닉 이성 시작값
  reasonDot: 0.005, // 저이성 정신 피해: 초당 최대 체력 × 이 값 × (-이성/100), -50 이하 2배
  frenzyFriendly: true, // 광폭이 아군도 공격하는지 (실험용 토글, 기본 true = 현행)
  psiPower: 1.2, // 소마법 · 학파 전공 계수 배율 (밸런스)
  divCap: 200, // 디바인 전투당 신성력 수집 상한
  powerPerDiv: 25, powerMax: 12, // 권능 포인트 = 디바인 1명당 모은 신성력 ÷ 25 + 신권 대행 1 (전투당 최대 12)
  // 전술 유형별 성장 주기
  // 전술 유형별 성장 (공명 등급이 오르면 모두 메이저 +1, 그 밖의 보상은 유형별 이정표)
  growth: {
    /** 마이너: 3등급마다 능력치 2종 +3 */
    pick: (tt: string, rank: number) => tt === 'minor' && rank % 3 === 0,
    /** (예전) 메이저 공용 증강: 쓰지 않는다 — 메이저는 아래 special(전용 증강)로 성장 */
    major: (_tt: string, _rank: number) => false,
    /** 메이저 (예전 메이저 + 스페셜): 4등급마다 기물 전용 증강 (14개 중, 최대 majorAugMax 개) */
    special: (tt: string, rank: number) => tt === 'major' && rank % 4 === 0,
    /** 디바인: 5등급마다 서약 증강 (디바인 공용 풀) */
    oath: (tt: string, rank: number) => tt === 'divine' && rank % 5 === 0,
    /** 사이오닉: 4 · 8 · 12 · 16등급에 전공 증강 (최대 4, 16등급에 완성) */
    psionic: (tt: string, rank: number) => tt === 'psionic' && rank % 4 === 0 && rank <= 16,
  },
  /** 메이저 궁극기: 자연 충전 기준 시간(초, 충전 계수 1.0) · 전투 시작 게이지 */
  ultTime: 35, ultStart: 0.2,
  /** 궁극기 요구 충전량 배율: 자연 · 행동 충전이 모두 이만큼 더 모여야 가득 찬다 (1.2 = 요구량 +20%). 증강의 '게이지 +N%' 는 그대로 */
  ultNeed: 1.2,
  /** 행동 충전: 기본 공격 · 전투 기술 · 피격 때 궁극기 게이지 + (충전 계수 · 궁극기 충전 스탯 적용) */
  // 시뮬 40런 (메이저 기물-전투 ~6000): 자연 충전만 첫 궁극기 28초 · 전투당 0.55회 / 1.5 · 5 · 0.8% 12.5초 · 1.37회 (행동 몫 52%) / 지금 값 17초 · 0.99회 (행동 몫 35%)
  ultGain: { basic: 0.0075, skill: 0.025, hurt: 0.004, hurtIcd: 0.25 },
  /** 메이저 전용 증강: 최대 개수 · ★ 전설이 선택지에 섞일 확률 (기본 + 전설 없이 지나간 선택마다) */
  majorAugMax: 5, majorLegend: { base: 0.12, pity: 0.08 },
  /** 마이너 성장 배율: 10등급 ×2, 20등급 ×3 (선형) */
  minorGrow: (rank: number) => (rank <= 10 ? 1 + (Math.max(1, rank) - 1) / 9 : 2 + (rank - 10) / 10),
  // 모든 기물 공통 기초 마이너 스탯 [임시]
  baseMinor: { maxHp: 600, shoot: 20, strike: 20, tech: 20, armor: 7, crit: 0.05, critDmg: 1.5 },

  // ── 전투 규칙 (확정)
  armorK: 250, // 방어도 250 = 받는 물리 피해 절반 (예전 3200, 방어도 단위를 약 1/14 로 → 230 → 250)
  /** 방어도 단위 변환 (옛 단위 → 새 단위, 약 1/14): 적 정의의 방어도 (data/enemies.ts) 에 곱한다. 그 밖의 고정 방어도는 숫자를 직접 바꿨다 */
  armorScale: 1 / 14,
  /** 승리 크레딧 기본 배율: 예전 쉬움(위험 3)의 ×1.25 를 기본으로 옮겼다 (winCredits × 이 값 × diffWinMul) */
  winBaseMul: 1.25,
  /** 난이도별 승리 크레딧 배율 (기본 배율 위에): 쉬움(3) ×1 · 모험(6) · 고난(7) ×1.2 (= 예전 ×1.5). 위험 3 미만 (캠페인 · 튜토리얼 · 훈련장) ×0.8 = 예전 그대로 */
  diffWinMul: (d: number) => (d >= 6 ? 1.2 : d >= 3 ? 1 : 0.8),
  /** 난이도별 적 증원: [위험 등급, 간격(페이즈)] — 그 등급부터 간격 페이즈마다 조우의 적 +1 (높은 등급이 대체).
   *  쉬움(3) 없음 · 모험(6) 3페이즈마다 · 고난(7) 2페이즈마다. 페이즈 p 의 증원 = ⌊p ÷ 간격⌋ (difficulty.ts diffAddCount) */
  diffAdd: [[6, 3], [7, 2]] as [number, number][],
  /** 출격 계약 (ui/contract.ts · data/contract.ts) [임시]
   *  seasonWin: 제철 의뢰(오늘 바에 들어온 의뢰서 3장)의 승리 크레딧 가산. 메뉴에 없는 의뢰(직접 주문)는 가산 없이 기본 보수 */
  contract: { seasonWin: 0.15 },
  baseHit: 0.8,
  minHit: 0.15, // 최저 명중률 (회피 과다 누적 방지) [임시]
  grazeBase: 0.3, grazeAccK: 0.5, grazeChanceMax: 0.8,
  grazeDmgBase: 0.2, grazeDmgAccK: 0.25, grazeDmgMax: 0.5,
  armorFactor: { phys: 1, chem: 0.5, elec: 0.5, psy: 0, holy: 0.5, true: 0 } as Record<string, number>,
  reductionCap: 0.8,
  tick: 0.05,
  moveTime: 0.45, // 1칸 이동 시간(초) / 이동속도 배율
  unitMoveSpd: 0.5, // 아군 기물 기본 이동 속도 (기동력 1당 conv.agi.moveSpd 만큼 더함)
  /** 적 기본 이동 속도 = 이 값 × 적별 이동 배율(EnemyDef.moveSpd, 없으면 1), 그 위에 기동력 1당 conv.agi.moveSpd 를 더한다.
   *  암살형 성향은 assassin (예전 기본값 그대로). 소환물 · 포탑 · 근위기사 · 망령 등 아군 쪽 생성물은 따로 (build.ts) */
  enemyMoveSpd: { base: 0.5, assassin: 1, disrupt: 0.85 },
  /** 적 성향 중 호위형 · 교란형 · 무리형의 수치 (combat.ts provScore · act · lureScore, build.ts buildEnemy).
   *  escort 호위형: r 칸 안의 같은 편 중 받은 피해가 가장 많은 동료(없으면 자신)를 지킨다 — 후보 점수 = √p × 1 / (1 + near × 그 동료와 후보 사이 거리) × (사거리 안이면 inRange).
   *  disrupt 교란형: 도발 수치를 보지 않는다. 후보 점수 = (1 + crowd × 후보 주변 1칸의 다른 아군 수) / (1 + near × 거리), 같은 대상에게 기본 공격 sweepHits 번을 하면
   *    sweepFor 초 동안 그 대상 점수 ×sweepMul (다음 대상으로 휩쓸고 지나간다). 기본 회피 +eva, 받는 찰과상 피해 ×(1 − grazeRed).
   *    lure: 아군 기물이 표적을 고를 때 사거리 + 1칸 안의 교란형 적을 '도발 배율 ×lure' 로 본다 (점수 = 배율 / (1 + 0.5 × 거리), 보통 적은 1).
   *    돌격가 경계에는 암살형처럼 걸린다 (교전 시간 · 도발 ×zoc.assassinMul, 경계 안 이동 ×zoc.assassinSlow).
   *  pack 무리형: 후보 점수 = p × (1 + focus × 그 후보를 지금 노리는 다른 같은 편 수) × 도달. 도발 배율은 전투 시작 provFor 초까지만 곱하고, 그 뒤로는 배율을 뺀 도발 수치를 본다. */
  tend: {
    escort: { r: 5, near: 0.6, inRange: 1.3 },
    disrupt: { eva: 0.15, grazeRed: 0.5, lure: 2, near: 0.3, crowd: 0.5, sweepHits: 2, sweepFor: 6, sweepMul: 0.15 },
    pack: { provFor: 6, focus: 0.8 },
  },
  /** 공용 기믹 적 (data/enemies.ts mx_*) 수치. 이름 · 설명은 enemyText 가 이 값을 읽는다.
   *  aegis 방벽 투사병: 전투 시작 보호막 = 최대 체력 × shield, 보호막이 깨지면 그 전투 동안 받는 피해 +taken · 주는 피해 −weak
   *  warden 소집 지휘관: 시작 n기 · every 초마다 n기 (동시 cap 기), 징집병이 하나라도 살아 있으면 받는 피해 −red
   *  stim 각성제 강습병: 시작부터 [각성] 공격 속도 +atkSpd · 피해 +dmg. hits 번 맞으면 calm 초 동안 [각성] 해제 (그 뒤 다시 각성)
   *  shade 광학 위장 저격수: 전투 시작 hide 초 은신 · 체력 low 아래로 처음 떨어지면 hideLow 초 은신
   *  sapper 야전 공병: first 초 뒤부터 every 초마다 방벽 · 자동 포탑을 번갈아 세운다 (공병 1명당 동시 cap 개, 앞쪽 2칸 안 빈칸)
   *  smuggler 밀수 운반책: 일반 · 역경 전투에 chance 확률로 1기 더 (보스 · 캠페인 · 튜토리얼 제외). 공격하지 않고 아군 기물에게서 달아난다. 교란형이지만 아군 기물의 시선은 끌지 않는다.
   *    (escape + escPer × (페이즈 − 1)) 초가 지나거나 다른 적이 모두 쓰러지고 alone 초가 지나면 빠져나가고 (보상 없음), 그 전에 쓰러뜨리면 승패와 상관없이 크레딧 +(credBase + credPer × 페이즈)
   *  big 대형 적 (2×2 · 1×3): 한 기물이 여러 칸을 차지하고 체력을 나눠 쓴다. 본체 칸 받는 피해 ×core · 나머지 칸 ×part.
   *    풀에 대형 적이 있는 전장의 일반 · 역경 전투에 chance 확률로 1기 (적 수 예산 cost 명분) */
  foeKit: {
    aegis: { shield: 1, taken: 0.5, weak: 0.5 },
    warden: { n: 2, every: 8, cap: 3, red: 0.2 },
    stim: { atkSpd: 0.5, dmg: 0.25, hits: 4, calm: 5 },
    shade: { hide: 5, low: 0.5, hideLow: 3 },
    sapper: { first: 3, every: 8, cap: 2 },
    smuggler: { chance: 0.15, escape: 18, escPer: 3, alone: 5, credBase: 2, credPer: 1 },
    big: { core: 1, part: 0.5, chance: 0.35, cost: 2 },
  },
  /** 돌격가 경계 (아군 돌격가만, 적 쪽 경계는 없다): 아군 돌격가 주변 r칸. 적이 경계 칸에 들어오면 그 자리에서 hold 초 동안 움직이지 못한다
   *  (공격 · 기술은 한다). 경계에 걸리면 그 돌격가에게 도발 수치 PROV.zoc (combat.ts).
   *  slow: 경계 칸에서 나가거나 경계 칸으로 들어가는 걸음의 이동 속도 배율 (암살형은 assassinSlow). 길찾기는 경계 칸을 보통 칸과 같게 본다.
   *  assassinMul: 암살형 성향은 경계에 걸리되 교전 시간 · 그 돌격가에게 쌓이는 도발 수치를 이 배율로 받는다 (예전엔 경계를 통째로 무시했다).
   *  pathCost: 길찾기에서 경계 칸에 들어가는 걸음의 추가 비용 (칸). 0 = 적이 경계를 피해 돌지 않고 그대로 걸어 들어온다.
   *  2 로 두면 적이 1~2칸 돌아서 경계를 피해 버려 후열이 받는 피해가 그대로였다 (같은 시드 1200판: 명사수 받은 피해 −0.1% · 0 이면 −1.3%) */
  /** 교전(붙잡힘) 시간 = hold + (그 경계를 만든 돌격가의 도발 배율 − 1) × holdPerProv 초 (돌격가 ×3 → 1.5초, 수호자 시너지 ×4.5 → 1.875초) */
  zoc: { r: 1, hold: 1, holdPerProv: 0.25, pathCost: 0, assassinMul: 0.5, slow: 0.5, assassinSlow: 0.75 },
  /** 밀쳐내기 · 끌어당기기에 맞은 대상: 이 시간(초) 동안 이동 · 기본 공격 · 기술 · 비술 · 궁극기를 하지 못한다 (쿨다운은 돈다) */
  knockStagger: 0.5,
  /** 암살형 적에게 노려지는 아군의 도주 (combat.ts flee): 자기를 표적으로 삼은 암살형 적이 r칸 안에 들어오면 그 적에게서 더 먼 빈칸으로 1칸 물러난다.
   *  ctypes: 도주하는 전투 유형 (돌격가는 맞서 싸운다). 소환물 · 고정 기물 · 속박 · 기절 · 광폭 · 혼란 · 매혹 중에는 하지 않는다.
   *  기본 공격이 준비돼 있고 사거리 안이면 공격이 먼저이고, 한 번 물러나면 cd 초 동안 다시 물러나지 않는다 (도망만 다니다 손을 놓지 않게). */
  flee: { r: 2, cd: 2, ctypes: ['MARK', 'SPEC', 'CMD'] as CType[] },
  overtimeStart: 45, overtimeRamp: 0.1, timeLimit: 75,

  // ── 무한 모드 페이즈 스케일링 (확정, 복리)
  phaseArmor: 1.25, phaseAmp: 1.28,
  // 체력 배율 (적 성장 페이즈 기준, config.ts scalePhase): 5페이즈까지 ×1.85, 6페이즈부터 ×1.75, ×1.65 … (하한 ×1.1 [임시]) · lateFrom 도 적 성장 페이즈 기준
  // 고페이즈 보정 [임시]: lateFrom 페이즈부터 매 페이즈 피해 ×lateAmp 추가 (체력 ×0.9 약화 보정은 없앴다)
  lateFrom: 5, lateAmp: 1.05,
  phaseHpFactor: (p: number) => (p <= 5 ? 1.85 : Math.max(1.1, 1.85 - 0.1 * (p - 5))), // 후반 체력 약화 보정(×0.9) 제거
  /** 난이도별 적 체력 성장 가산: 페이즈마다 곱하는 phaseHpFactor 에 더한다 (모험(6) +0.15 · 고난(7) +0.25, 위험 6 미만 0) */
  diffHpAdd: (d: number) => (d >= 7 ? 0.25 : d >= 6 ? 0.225 : 0), // 모험 0.15 → 0.225 (봇 클리어 74% → 0.2 에서 63% → 50%대 목표)
  adversityMult: 1.25, // 역경 · 도전 조우 강도 (위험 등급과 무관): 적 체력 ×이 값, 피해 ×encDmgMult(이 값) (예전 1.5)
  adversityReward: 1.5, // 역경 승리 보상 배율: 크레딧 · 공명도 풀 (도전 보상의 '남은 역경' 몫도 이 값)
  adversityLoss: 1.5, // 역경 패배 체력 피해 배율 (도전 패배도 역경 기준)
  enemyHpMul: 4.6, enemyPowMul: 2.25, // 적 기초 수치 전체 배율 (튜닝용)
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
  xpPool: (phase: number) => 4 + 8 * phase, // 전투 1회 공명도 풀: P1 12 · P3 28 · P5 44 (총량은 10 + 6p 와 같고 후반으로 기울임 — 초반 성장 쏠림 완화)
  buyXpCost: 4, buyXpAmount: 4, // [임시]
  augmentChoices: 3, augmentRerolls: 1,
  /** ★ 전설 전공 증강: 전공 증강 선택지 3장 중 1장이 전설일 확률 = base + pity × (전설 없이 지나간 전공 증강 수). 전설을 한 번 얻으면 보정 없이 base */
  psiLegend: { base: 0.25, pity: 0.25 },
  /** 마이너 능력치 보상 대성공 확률: 대성공이면 고른 주요 능력치 상승량 2배 (run.ts allocRank) */
  greatChance: 0.2,

  // ── 파티/보드
  victoryPhase: 5, // 이 페이즈 보스를 이기면 의뢰 성공
  /** 적 성장 페이즈 (scalePhase): 의뢰 페이즈 1 … victoryPhase 의 적 = 예전 6페이즈 곡선의 이 위치 (마지막 보스 = 예전 6페이즈, P2 를 당겨 초반을 조인다) */
  scaleCurve: [1, 2.5, 3.75, 4.75, 6],
  /** 페이즈 안 칸 번호(step)당 일반 · 보스 조우 강도 +이 값 (12칸 시절 0.04 → 10칸이라 마지막 보스가 예전과 같은 ×1.44 가 되게. 0.06 · 0.08 은 보스만 크게 세져 고난 클리어 14% · 6%) */
  stepMult: 0.049,
  // 전환 노드 (짝수 페이즈): 휴식 = 체력 회복 + 공명도 소량 / 도전 = 다음 페이즈 역경급 전투, 승리 시 남은 노드 보상을 몰아 받고 다음 페이즈로
  forkRestHp: 10, forkRestLost: 0.2, forkRestXp: 0.5, // 휴식: 체력 +n + 잃은 체력 × lost (내림), 공명도 = 전투 1회 풀 × k
  challengeXp: 3.5, // 도전 승리: 공명도 = 전투 1회 풀 × k (건너뛰는 역경 1.5 + 보스 1 + 사건 · 보급 몫, 10칸 항로)
  amundsenRecruitW: 0.08, // 아문센 · 데미우르고스 영입 후보 가중치 (다른 기물 = 1)
  joinRankRatio: 0.7, // 영입 · 합류 등급 = max(페이즈 - 1, 출전 기물 평균 등급 × k)
  startUnits: 5, maxParty: 16, // 계약 기물: 후보 8명 중 5명 (출전 한도 deployBase 4 — 1명은 대기) // 출전 최대 10 + 대기 6
  starterPool: 8, starterFav: 2, starterRerolls: 1, // 계약 기물 선택 (engine/starters.ts): 후보 수 · 그중 전장 우세 시너지(FieldDef.ally.syn, 전장 브리핑의 '우세 시너지') 기물 최소 수 (그 시너지 첫 단계 인원이 더 크면 그만큼 — starterFavNeed) · 후보 새로고침 횟수
  deployBase: 4, // 기본 출전 인원. 함대 확장으로 늘린다
  fleetCosts: [20, 40, 56, 72, 90, 108, 128, 160, 200, 256], // 함대 확장 n번째 비용 (출전 5 → 14명)
  musterCost: 16, musterStep: 8, musterPicks: 3, // 지정 소집: 기본 가격, 회당 상승, 고르는 시너지 수
  /** 집중 육성: 지정한 기물들이 공명도 풀의 이 몫을 먼저 나눠 받고, 나머지는 보유 기물 전체가 무작위로 (run.ts distributeXp) */
  focusXpShare: 0.4,
  boardSizes: [ { n: 7, w: 70, env: '표준 전장' }, { n: 6, w: 15, env: '협소한 통로' }, { n: 8, w: 15, env: '개활지' } ],
  bossBoard: 7,
  /** 전장 지형 틀 (data/maps.ts, run.ts pickMap): 일반 · 역경 · 도전 전투에서 그 전장 전용 틀 확률 · 아니면 공용 틀 (긴 통로 · 포위) 확률.
   *  repeat: 직전 · 그 전 전투와 같은 틀의 가중치 (연달아 같은 지형이 덜 나오게) */
  maps: { field: 0.45, common: 0.2, repeat: [0.2, 0.5] as [number, number],
    /** 포위 틀 (포위 · 가로 포위) 이 한 런에 나오는 최대 횟수 (공용 틀 무게는 data/maps.ts weight) */
    surroundMax: 2,
    /** 긴 통로 중 폭 5칸 (corridor5) 이 나올 몫: 페이즈 1 · 2 · 3 · 4 · 5+ (나머지는 폭 4칸). 초반은 4칸 위주, 후반은 거의 5칸 */
    wide5: [0.15, 0.35, 0.6, 0.85, 0.95],
    /** 연결교 (도킹 연결부): 위에 선 기물이 받는 피해 증가 몫 */
    bridgeTaken: 0.15,
    /** 광석 운반차 (광석 운반차 선로): 첫 통과 first 초, 이후 period 초마다 (방향은 번갈아) · warn 초 전부터 선로 경고 · 선로를 지나는 데 sweep 초 · 운반차 길이 len 칸 ·
     *  선로 위 기물 (아군 · 적 · 구조물): 최대 체력의 dmg 만큼 물리 피해 + 선로 밖으로 밀려남 + 기절 stun 초. 지나는 동안 운반차가 선 칸은 직선 사격을 막는다 */
    cart: { first: 6, period: 10, warn: 2, sweep: 0.6, len: 2, dmg: 0.12, stun: 0.5 },
    /** 스프링클러 (스프링클러 잔디밭): 첫 살수 early · late 초 (편성 화면에서 고름), 이후 period 초마다 전장 전체 은신 해제 + 주변 r칸 slow 초 둔화 (공격 · 이동 속도 −slowAmt) */
    sprinkler: { early: 2, late: 6, period: 8, r: 1, slow: 1, slowAmt: 0.3 },
    /** 주차된 차 · 봉쇄 바리케이드 (부서지는 엄폐물): 체력 = 소모품 바리케이드 체력 ÷ hpDiv (페이즈 배율). 차는 부서지고 delay 초 뒤 주변 r칸에 최대 체력 dmg 몫 화학 피해 (아군 · 적 · 구조물 모두) */
    car: { hpDiv: 2, delay: 1, r: 1, dmg: 0.15 },
    barricade: { hpDiv: 3 },
    /** 홀로그램 광고판: 켜짐 on 초 (직선 사격 막음) → 꺼짐 off 초, 켜진 채 시작 */
    holo: { on: 6, off: 4 },
    /** 전력선: first 초에 첫 전류, 이후 period 초마다 live 초 동안 (warn 초 전부터 예고). 위에 선 기물 (아군 · 적 · 구조물 피해만): 최대 체력 dmg 몫 전기 피해 + 감전 stun 초, 기계 적은 광폭 rampage 초 */
    power: { first: 10, period: 12, live: 2, warn: 2, dmg: 0.08, stun: 0.5, rampage: 4 },
    /** 회수 장치: 주변 r칸에서 쓰러진 아군은 망령으로 일어나지 않고, 주변 r칸의 영혼 적은 1초마다 최대 체력 soul 몫 피해 */
    recovery: { r: 1, soul: 0.02 },
    /** 단상: 위에 선 원거리 기물 (기본 사거리 2 이상) 사거리 +range */
    dais: { range: 1 },
    /** 레이저 장막: period 초마다 두 줄이 엇갈려 켜진다 (켜진 줄 = 통행 불가 · 탄은 넘어감) */
    laser: { period: 6 },
    /** 회전 금고문: period 초마다 틈이 한 칸씩 오른쪽으로 (끝에서 처음으로) */
    vault: { period: 6 },
    /** 금고 칸: 아군이 그 위에 합쳐 need 초 서 있으면 전투 승리 때 크레딧 +credits */
    vaultCell: { need: 5, credits: 2 } },
  /** 적 분대 (data/squads.ts · run.ts assembleSquads).
   *  elite: 일반 · 역경 전투에 정예 분대를 넣는다 (역경 확정 · 2페이즈부터 일반 전투 확률). 캠페인 2장 작업(5bb320c) 뒤로 정예 줄이 주석에 묻혀 빠져 있던 것을 되살림 (v411 밸런스는 정예 없이 맞춘 값).
   *  duo: 포병 듀오 (두 칸이 체력을 나눠 쓰는 한 기물): 뒤 칸 (포병) 받는 피해 ×back · 앞 칸 (부사수) ×front · 한 전투 최대 수 (4페이즈부터 max4) */
  squads: { elite: true, duo: { back: 1.5, front: 0.6, max: 1, max4: 2 } },
  rarePhase: 3, // 아문센 · 데미우르고스가 영입 후보에 나오는 페이즈 (배치 제한은 없음)
  /** 최고의 친구 소환물 스탯 상속률 (build.ts spawnSummons): 시너지가 꺼져 있을 때의 기본값 · 추가로 불린 소환물(2번째부터)의 배율 · 상한 */
  bond: { base: 0.5, extra: 0.8, cap: 6 },
  cookPower: [1, 1.3, 2.0, 3.4, 4.6], // 셰프 단계별 요리 위력 배율 (0단계 = 미발동, 2 · 4 · 6 · 8명). 갓 구운 빵을 얻는 대신 단계마다 10%p 낮춤 (예전 1.4 · 2.1 · 3.5)
  /** 셰프: 갓 구운 빵 (소모품 K_bread, 플레이어 체력 회복). 셰프 시너지가 처음 켜질 때 1개 + 전투 승리마다 단계별 확률로 1개 (breadWin = 셰프 1 · 2 · 3 · 4단계).
   *  회복량은 위험 등급 기준 [등급, 회복량]: 런의 위험 등급 이하에서 가장 높은 등급의 값, 그보다 낮은 등급은 첫 값.
   *  지금 표는 선택 화면의 세 단계 (difficulty.ts DIFF_PRESETS: 쉬움 3 · 모험 6 · 고난 7) — 이름은 difficulty.ts 에서 읽는다 */
  chef: { breadWin: [0.15, 0.2, 0.3, 0.45], breadHeal: [[3, 10], [6, 7], [7, 5]] as [number, number][],
    // 식은 빵 (K_bread_stale): 얻은 뒤 전투 staleAfter 회를 지나면 식는다 (승패 무관, 빵을 얻은 그 전투는 세지 않음) — 회복 −staleHeal (최소 1) · 판매가 −staleSell.
    // 셰프 noStaleTier 단계 (6명) 이상이 켜진 전투는 세지 않는다 (이미 식은 빵은 그대로)
    staleAfter: 2, staleHeal: 2, staleSell: 1, noStaleTier: 3,
    breadSell: [[3, 4], [6, 3], [7, 2]] as [number, number][], // 빵 판매가: 위험 등급 d 이하에서 가장 높은 등급의 값 (쉬움 4 · 모험 3 · 고난 2, 셰프 단계와 무관)
  },

  // ── 경제 [임시]
  startCredits: 6,
  // 의뢰 5페이즈 (전투 약 22회)에 예전 6페이즈 (약 39회) 규모를 나눠 담는다: 페이즈마다 쌓인 양이 그 페이즈의 적 성장 페이즈 (scalePhase) 끝의 예전 누적과 비슷하게
  winCredits: (phase: number) => Math.floor(4 + phase), // P1 5 · P3 7 · P5 9 (예전 3 · 4 · 5, 판 전체 약 189 ↔ 예전 176 + 줄어든 이자 일부)
  lossShare: 0.5, // 패배 시 승리 보상 크레딧의 몫 (공명도 풀도 같은 몫: xpPool × lossShare)
  interestPer: 10, interestMax: 5,
  streakBonus: (streak: number) => (streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0),
  price: { C: 7, G: 16, A: 16, L: 60, S: 8 } as Record<string, number>, // S: 합성 재료 (성운 가루 · 백수정 조각)
  sell: { C: 3, G: 7, A: 7, L: 20, M: 6, O: 8, K: 4, T: 5, J: 1, S: 3 } as Record<string, number>,
  /** 장비 합성 재료 (data/items.ts MATS): 성운 가루 + 재료 = 고급 모듈 · 성운 가루 2개 = 별무리 파편 · 별무리 파편 + 고급 모듈 = 제련.
   *  drop: 승리 시 재료 드롭과 따로 굴리는 합성 재료 확률 · w: 성운 가루 : 백수정 조각 비율 (crystal = false 면 백수정 조각은 나오지 않음).
   *  shop: 상점마다 합성 재료 1개를 진열할 확률 · refinePts: 성운 가루 제련 1단계마다 고급 모듈 주요 능력치 증가 (기본 +9 → 5단계 +24) · legendPts: 별무리 파편 제련 1단계마다 전설 장비 능력치 증가 (focus = 주요 능력치 하나 +18 짜리 · split = 둘에 +9 씩 짜리, 각각) · refineMax: 최대 제련 단계 */
  craft: { drop: { battle: 0.15, adversity: 0.5, boss: 1 } as Record<string, number>, w: { S_dust: 3, S_crystal: 1 } as Record<string, number>, crystal: true,
    shop: 0.75, refinePts: 3, legendPts: { focus: 6, split: 3 }, refineMax: 5,
    /** 잠재능력 칸 (백수정 조각): 희귀 · 전설 */ potSlots: { A: 2, L: 3 },
    /** 캣휠(ZI존) 제련 (별무리 파편): 단계마다 모든 주요 능력치 + · 별무리 파편을 밍키에게 끼우면 (이스터에그) 먹어 치우고 공명도 + */ ziPts: 2, mingkiShardXp: 12 }, // J: 유닉스제 잡동사니 (캣휠)
  // 장비 드랍 [임시]
  // advParts: 역경(· 도전) 승리 시 무작위 장비 재료 확정 개수 (예전: 확률 50%)
  drop: { battle: 0.1, advParts: 1, bossAdvEvery: 3, bossPart: 0.5, shopParts: 2, shopAdv: 0.4, shopAdv2: 0.1, shopGraded: 0.15, shopLegend: 0.05, shopLegendPhase: 5, utility: { battle: 0.15, adversity: 0.3, boss: 0.5 } as Record<string, number>,
    // 전설 소모품 (승리 시, 위 utility 와 따로 굴림): 원초 공명석 = 극저확률
    rank3: { battle: 0.003, adversity: 0.008, boss: 0.02 } as Record<string, number> },
  /** 공명 주입기 (소형 K_xp · 중형 K_xp2 · 대형 K_xp3): 공명도 · 입고 가중치 · 나오기 시작하는 페이즈.
   *  smallTo 페이즈가 지나면 소형은 나오지 않고 그 가중치를 중형이 가져간다 (전투 보상 · 상점 공용) */
  inject: { amount: { K_xp: 8, K_xp2: 20, K_xp3: 40 } as Record<string, number>, w: { K_xp: 6, K_xp2: 3, K_xp3: 3 } as Record<string, number>, from: { K_xp: 1, K_xp2: 3, K_xp3: 6 } as Record<string, number>, smallTo: 4 },
  /** 상점 노드 (분기점의 상점, genShop): 재료 · 희귀 · 고급 · 전설은 drop.shop* 그대로, 아래는 그 밖의 진열 */
  /** 위험 등급 적 장비 (run.ts gearEnemies, 위험 2 부터): 칸마다 장착 확률 slot (역경 · 보스전 big) × 정예 elite 배율 (보스도 다른 적과 같은 규칙),
   *  역경 · 보스전 장비는 graded 확률로 고급 (아니면 재료). (7) 고난 역경: hardN 번 hard 확률로 재료 · 고급 · 희귀 중 등급별 같은 확률. 적은 개조부품을 달지 않는다 */
  foeGear: { slot: 0.08, big: 0.25, elite: 1.5, graded: 0.5, hard: 0.6, hardN: 3 },
  shop: {
    gearFrom: 3, gearAdv: 0.5, // 이 페이즈부터 고급 · 희귀 장비를 1개 이상 확정 진열 (확률 입고가 없으면 1개 추가: 희귀일 확률, 아니면 고급)
    consMin: 2, // 소모품은 서로 다른 종류로 최소 2개 진열 (+ cons 확률로 1개 더)
    cons: 0.4, consW: { inject: 3, K_strip: 1, K_reroll: 1, K_seize: 1, K_cp_purge: 1, K_cp_note: 1, K_barricade: 1, K_decoy: 1, K_mine: 1, K_net: 1 } as Record<string, number>, // 소모품 1개 (종종): 공명 주입기(페이즈에 맞는 크기) · 분리 용제 · 재구성 회로 · 강제 징수기 (적이 장비를 다는 위험 등급만) · 정화 분무기 · 선지급 어음 (캠페인만) · 배치형 4종 (바리케이드 · 신호기 · 지뢰 · 그물)
    rank3: 0.04, rank3From: 2, // 원초 공명석 (희귀): 입고 확률 · 시작 페이즈
    emblem: 0.06, emblemOwn: 0.6, // 문장 (희귀): 입고 확률 · 출전 기물이 가진 시너지 문장일 확률
    /** 가격 (크레딧, 전장 상점 배율 · 관세 적용 전). 소모품 판매가(sell.K)보다 비싸게. K_feast = 미리암 라일라 전용 (만찬 백수정) */
    price: { K_xp: 6, K_xp2: 14, K_xp3: 26, K_strip: 6, K_reroll: 8, K_seize: 12, K_rank3: 40, emblem: 25, K_cp_purge: 6, K_cp_note: 2, K_barricade: 8, K_decoy: 6, K_mine: 7, K_net: 9, K_feast: 14 } as Record<string, number>,
    /** 진열대 칸 수 (3×3). 상점마다 진열하는 물품 수는 count 확률 ([개수, 확률], 새로고침도 다시 뽑는다) — 남는 칸은 빈 선반으로 둔다.
     *  위 확률 진열을 굴린 뒤 모자라는 칸은 fill 가중치로 분류를 골라 채운다 (재료 · 소모품 · 고급 · 희귀 · 문장, 겹치지 않게) */
    slots: 9,
    count: [[6, 0.2], [7, 0.3], [8, 0.3], [9, 0.2]] as [number, number][],
    fill: { C: 3, K: 3, G: 1, A: 1, M: 0.25 } as Record<string, number>,
    /** 할인: 상점마다 할인 칸 수 0 · 1 · 2 · 3 의 확률 · 할인율(%) 균등 · 드물게 rare% (할인 1칸마다 rareP) */
    sale: { n: [0.3, 0.4, 0.2, 0.1], pct: [15, 20, 25, 30, 35, 40, 45], rare: 50, rareP: 0.04 },
    /** 진열 새로고침: 페이즈마다 1번 (상점끼리 공유). 의뢰의 첫 새로고침은 무료, 그다음 base, 유료 1번마다 +step — 진열 가격처럼 상점 배율 (전장 · 관세 · 할인 증강)을 곱한다 */
    refresh: { base: 6, step: 4 },
    /** 유이 전용 지정 소집 티켓 가격 = 지금 지정 소집 기본 비용 (관세 전) × ticket × 상점 배율 */
    ticket: 0.6,
    /** 고르곤: 전설 장비 진열 확률 (페이즈 무관, 다른 상인은 drop.shopLegend · shopLegendPhase) · 교환 = 상점마다 1번 */
    gorgonLegend: 0.2,
  },
  inventoryMax: 32,
  /** 분리 용제 규칙: 이 위험 등급(고난) 이상이면 기물에 장착한 장비(개조부품 · 고유 장비 제외)를 떼어 보관함 · 다른 기물로 옮길 때 분리 용제(K_strip) 1개를 소모한다 (run.ts unequip).
   *  보관함에서 장착하는 것 · 엔진이 옮기는 것(방출 · 변성 · 재구성 회로 자동 해제 · 분리 용제 사용)은 그대로 무료 */
  solventFrom: 7,
  /** 기물 방출 환급 (run.ts releaseValue): 쌓은 공명도의 xpShare 를 남은 파티에 분배 + 크레딧 base + 공명 등급 × perRank (장비는 보관함으로) */
  release: { xpShare: 0.6, base: 3, perRank: 2 },
  /** 보급 노드 (run.ts genSupply): 뒷면 카드 cards장을 뒤집어 모두 받는다. 카드 1장 = 보상 한 종류 (크레딧 · 공명도 · 장비, 겹쳐도 된다, 가중치 kindW).
   *  3장 합계 기준값 = max(floor(페이즈), 지금 영입할 기물(recruitRank)을 바로 방출할 때의 환급 가치 × ratio) — '영입 → 바로 방출'로 크레딧 · 공명도를
   *  찍어 내는 것보다 보급이 크게 밀리지 않게 하려는 기준 (floor = 초반 하한, 예전 크레딧 보급 12 + 페이즈). 카드 1장 = 기준값 ÷ cards × (1 ± spread).
   *  대박: 장마다 jackpot 의 [배율, 확률] 을 앞에서부터 굴려 처음 걸린 배율 (공개 연출 · 공개음 단계가 오른다).
   *  가치 환산 (크레딧 기준): 크레딧 1 = 1 · 공명도 1 = 직접 구매 단가 (buyXpCost ÷ buyXpAmount) · 장비 = 상점 기본가 CFG.price (재료 C · 고급 G · 희귀 A · 전설 L).
   *  장비 카드는 카드 가치를 가장 가까운 두 등급 사이에서 확률로 맞춘다 (가치가 높을수록 윗 등급, 기대 가치 = 카드 가치, 차이는 버림). 고급 · 희귀는 같은 값이라 graded 확률로 고급, 전설은 legendFrom 페이즈부터 대박 카드에서만 */
  supply: {
    /** [실험] 1페이즈 보급 노드: 항로 맨 앞에 보급 노드를 더하고 첫 역경을 같은 보급 노드로 바꾼다 (재료 1장 확정 · 나머지 무작위 · 대박 없음). 이 시험판에서는 켜짐 */
    p1: true,
    /** [실험] 2페이즈부터 모든 페이즈 항로 맨 앞에 같은 보급 노드 (p1 과 함께 쓰면 매 페이즈 맨 앞 보급). 기본 꺼짐 */
    front: false,
    /** 카드 수 · 가치 기준 장 수 (기준 가치 ÷ valueCards 가 한 장 값: 4장이면 3장 몫 + 마지막 정비 소모품 칸) */
    cards: 4, valueCards: 3, ratio: 0.8, spread: 0.12,
    /** 런의 첫 보급 (1페이즈 항로 보급): 순서 고정 (장비 재료 · 에너지 크레딧 · 공명도 · 소모품) · 크레딧 카드 +firstCredits */
    firstCredits: 10,
    floor: (phase: number) => 12 + phase,
    kindW: { credits: 1, xp: 1, gear: 1 } as Record<string, number>,
    /** 대박 [배율, 확률]: ×2 = 파랑 · ×4 = 빨강 (공개 연출). jackpotLegend 배율 이상인 장비 카드는 페이즈와 무관하게 전설 장비 */
    jackpot: [[4, 0.025], [2, 0.09]] as [number, number][], jackpotLegend: 4,
    graded: 0.3, legendFrom: 5,
    jackpotInject: 0.35, // ×2 대박 카드가 재료 등급으로 떨어졌을 때 중형 공명 주입기가 될 확률 (나머지는 고급 · 희귀 장비)
  },

  // ── 플레이어 체력 [임시]
  playerHp: 100,
  lossDamage: (phase: number, survivors: number) => 3 + 2 * phase + survivors,
  bossLossDamage: (phase: number) => 10 + 3 * phase,

  privilegeRerolls: 3, // 런 시작 특권 증강 새로고침 횟수
  globalRerolls: 1, // 항로 회의 전역 증강 새로고침 횟수

  // ── 절망 증강 (src/data/despair.ts): 고난(위험 7 = from) 이상 런은 해금 조건 없이 출격 때 특권 증강 직후 3개 중 1개를 반드시 고르고,
  //   every 페이즈마다 (3 · 6 · 9 … 페이즈 시작 때) 1개를 더 고른다 (누적, 이미 고른 증강은 다시 나오지 않는다).
  //   수치: 봇 클리어율 하락폭이 비슷하도록 맞췄다 (tests/despair_sim.ts). 그때 고난 · 모험은 봇 성공률이 바닥이라 비교가 안 돼, 위험 0 에 하나씩 강제로 걸어
  //   같은 시드 800판을 비교 — 기준 30.9% 대비 -3.6 ~ -7.5%p (반려 돌 · 캣휠 20% 는 지정값 그대로)
  // ── 전역 증강 수치 (src/data/globals.ts · 설명문도 여기서 읽는다)
  globalAug: {
    solventN: 2, overhaulUp: 0.25, // 용제 밀수: 분리 용제 개수 · 전면 재조달: 장비마다 한 단계 위 확률
    tenacity: 0.2, tenacityHp: 0.35, discount: 0.15, // vamp · vampKill · vampMax: 흡혈 탄두 (처치마다 생명력 흡수 +vamp, 최대 vampMax 중첩 · 처치 회복)
    glassDmg: 0.35, glassTaken: 0.2, overtime: 0.5, blitz: 0.6, blitzDur: 6, vamp: 0.02, vampKill: 0.1, vampMax: 8, bountyMax: 6, bond: 60, bondCap: 2,
    firstShot: 2, ration: 15, rationMax: 10,
    // 고유 효과 (예전 깡 능력치 · 소액 경제 증강을 바꾼 것)
    ammoKill: 0.25, ammoCap: 2, // 탄피 회수: 처치 시 탄창 용량 × ammoKill 장전 · 최대 탄창 용량 × ammoCap
    npCritDmg: 1.5, // 약점 연산: 비물리 치명타 피해 (고정)
    finishHp: 0.15, // 마무리 흡수: 피니쉬 추가 고정 피해 = 자신 최대 체력 × finishHp, 같은 양 회복
    nodeCredit: 1, nodeCap: 3, // 잔돈 영업: 노드마다 크레딧 + · 이자 상한 -
    scrapN: 3, // 분해 작업대: 즉시 장비 재료 개수 (재구성 회로 → 분해 + 성운 가루 1)
    comeback: 0.5, // 재기 수당: 패배로 잃은 플레이어 체력 중 다음 승리 때 돌려받는 몫
    pointPer: 5, // 포인트 적립: 상점에서 쓴 크레딧 pointPer 당 공명도 1 분배
    mark: 0.3, // 표적 지정: 표적이 받는 피해 +
    armorShare: 0.3, // 장갑 공유: 방어도가 가장 높은 아군 방어도의 몫
    killCdIcd: 3, // 연속 처형: 스킬 처치 → 쿨다운 초기화 (기물마다 초당 1번)
    ultChain: 0.1, // 공명 연쇄: 아군 궁극기 → 다른 아군 궁극기 게이지 +
    riposte: 0.8, // 역습 태세: 회피 뒤 다음 기본 공격 피해 +
    cleanse: 0.06, cleanseIcd: 2, // 정화 반응: 해로운 효과를 받으면 최대 체력 × 보호막 (기물마다 icd 초에 1번)
    overheal: 0.5, overhealCap: 0.25, // 과잉 회복 전환: 넘친 회복 × 보호막 (최대 체력 × cap 까지)
    lastWall: 0.2, // 최후의 방벽: 아군이 처음 쓰러지면 남은 아군에게 최대 체력 × 보호막
    corrode: 0.03, corrodeMax: 0.45, // 장갑 부식: 적중마다 대상 방어도 - (최대)
    spec: 0.25, specMin: 0.5, specMax: 3, // 투기 자금: 페이즈 시작 때 보유 크레딧 × spec 투자 → 다음 페이즈 시작 때 × [min, max] 무작위
    rebirth: 3, // 윤회 계약: 모든 기물 공명 등급 + (무작위 기물로 교체)
    chain: 1, thorns: 1, windAt: 0.3, wind: 0.25, execAt: 0.2, exec: 0.4, giant: 0.25, dblChance: 0.15, dbl: 0.5, tutor: 2, commission: 20, transfuse: 15,
    berserkMax: 0.8, berserkHp: 0.15, goldAt: 100, gold: 0.3, goldCap: 3, odAt: 20, od: 0.6, odAs: 0.2, odSlow: 0.3, hydra: 0.2, midasLean: 2, loneMax: 3, lone: 0.6, loneRed: 0.25, phoenix: 0.5, phoenixCost: 20,
    stakes: 1.5, stakesFoe: 0.25, blood: 2, minkyRank: 2, petraPer: 3, ascend: 2, lastDmg: 0.4, lastRed: 0.15, sacrifice: 2,
  },
  despair: {
    from: 7, // 이 위험 등급 이상 런에서 고른다 (고난)
    every: 2, // 추가로 고르는 간격 (페이즈): 페이즈 1+every · 1+2×every … 시작 때 1개씩 (의뢰 5페이즈: 3 · 5페이즈)
    choices: 3, rerolls: 1, // 선택지 수 · 새로고침 횟수 (고를 때마다)
    rockSlots: 1, // 단장의 반려 돌: 영입 선택지 중 반려 돌로 바뀌는 수
    overclock: 2, // 오버클럭: 적 기술 쿨다운 감소 속도 +
    rival: 0.4, // 배타적 경쟁 항로: 보유 기물과 시너지가 겹치는 기물의 영입 가중치 ×
    interest: 0.5, // 근시안적 투자안: 이자 수입 감소 비율 (내림)
    catwheel: 0.2, catwheelMajors: 3, // 유닉스제 대량 생산: 희귀 · 고급 장비가 캣휠로 바뀌는 확률 · 밍키가 캣휠을 달면 모든 주요 능력치 +
    zi: 5, ziMajors: 5, // 캣휠(ZI존): 캣휠 (보관함 + 장착 중)이 이만큼 모이면 자동으로 합쳐지는 전설 장비 · 모든 주요 능력치 + (밍키가 달면 캣휠 보너스도 더함)
    shield: 0.12, // 페트라 균등 납품: 적 전투 시작 보호막 (최대 체력 비율)
    tariff: 0.15, // 무역관세부 특별 관세: 상점 · 합성 공방 가격, 함대 확장 · 지정 소집 비용 + (0.3 은 너무 가혹해서 낮춤)
    heal: 0.5, // 기적 정기 휴무: 아군이 받는 회복 감소
    boss: 0.15, // 스타페어 결승전 특집: 보스 체력 · 피해 + (0.3 은 너무 가혹해서 낮춤)
    xp: 0.15, // 군체 공명 간섭: 전투 공명도 풀 감소
    // 감수할 만한 디버프. 5 ~ 8% 대는 체감이 없어 12 ~ 15% 대로 올렸다 (피로 · 성급 · 안개 · 급소 · 균등 납품)
    fatigue: 0.12, // 피로 누적: 아군 최대 체력 -
    rust: 0.1, // 정비 지연: 아군 쿨다운 감소 속도 -
    plating: 0.12, // 두꺼운 장갑판: 모든 적 방어도 +
    hasty: 0.12, // 성급한 적: 모든 적 공격 속도 +
    lean: 1, // 긴축 예산: 전투 승리 보상 크레딧 -
    fog: 0.15, // 전장의 안개: 모든 적 회피 +
    late: 0.4, lateDur: 4, // 늦은 출항: 전투 시작 후 lateDur 초 동안 아군 공격 속도 -
    exposed: 0.15, // 급소 노출: 모든 적 치명타 확률 +
    leak: 1, // 공명 누수: 공명도 구매 비용 +
  },
  // ── 절망 서약 (src/data/oaths.ts): 플레이어가 타이틀 [절망 서약] 화면에서 직접 켜는 고정 조건. 위험 oathFrom(고난) 이상으로 출격할 때만 걸린다.
  //   서약마다 단계 = 값 배열 길이, heat[k] = k+1 단계로 올릴 때 더해지는 절망 수치. 값은 단계별 (1단계 = [0]).
  //   절망 수치: 봇 sim (tests/balance.ts oathfrom=3 oath=…, 쉬움에 서약 하나를 최고 단계로, 같은 시드 400판)에서 평균 도달 페이즈가 약 0.25 떨어질 때마다 1로 잡았다
  //   (강철 3단계 -0.71 · 칼날 -1.01 · 군세 -1.71 · 거두 -0.93 · 질주 -0.47 · 패전 -0.33 · 박봉 -0.17 · 고립 -0.17 · 균열 -0.16 · 초침 -0.13, 보스전 패배 진행 변경 전 기준).
  //   봇이 선택을 무작위로 하는 서약(침묵 · 박탈 · 동결)은 봇 차이가 없어 설계값 (1단계 = 1, 침묵 2). 장갑 · 정예는 첫 계측에서 효과가 거의 없어 수치를 올렸다 (재계측 전).
  oathFrom: 7,
  /** 절망 서약 표기 위험 등급: 서약이 걸리는 등급(고난) 이상에서 절망 수치 oathDiffStep 마다 표기 위험 등급 +1 (data/difficulty.ts effDiff).
   *  난이도 카드 · 서약 화면 · 상단 바 · 환경 탭 · 결과 · 도감 기록 · 업적 판정(전장별 최고 위험 등급)만 이 값을 읽고, 적 배율 등 실제 규칙은 그대로다 */
  oathDiffStep: 5,
  oath: {
    grit: { heat: [1, 1, 1], hp: [0.1, 0.2, 0.3] }, // 강철: 적 최대 체력 +
    pain: { heat: [1, 1, 2], dmg: [0.1, 0.2, 0.3] }, // 칼날: 적 피해 +
    plate: { heat: [1, 1], armor: [0.6, 1.2], res: [0.15, 0.3] }, // 장갑: 적 방어도 + · 효과 저항 +
    frenzy: { heat: [1, 1], atkSpd: [0.1, 0.2] }, // 질주: 적 공격 속도 +
    horde: { heat: [3, 4], add: [1, 2] }, // 군세: 모든 전투 적 + (보드 칸 상한 안에서)
    elite: { heat: [1, 1], chance: [0.3, 0.6], buff: [0.25, 0.5] }, // 정예: 일반 전투 정예 출현 확률 + (1페이즈부터) · 정예 체력 · 피해 +
    titan: { heat: [2, 2], hp: [0.25, 0.5], guard: [1, 2] }, // 거두: 보스 체력 + · 보스 호위 +
    clock: { heat: [1, 1], sec: [10, 20] }, // 초침: 연장전 시작 · 제한 시간 앞당김 (초)
    pay: { heat: [1, 1], win: [0.2, 0.4] }, // 박봉: 승리 크레딧 - (반올림)
    vault: { heat: [1, 1], cap: [2, 4] }, // 동결: 이자 상한 -
    wound: { heat: [1, 1], loss: [0.3, 0.6] }, // 패전: 패배 때 함대 체력 피해 +
    hull: { heat: [1, 1], hp: [15, 30] }, // 균열: 함대 최대 체력 -
    recruit: { heat: [1, 1], less: [1, 2] }, // 고립: 영입 선택지 - (최소 1)
    augment: { heat: [2], less: [1] }, // 침묵: 공명 증강 선택지 -
    abyss: { heat: [2, 2], start: [1, 1], every: [0, 1] }, // 심연: 출격 때 절망 증강 + · 추가 선택 간격 (0 = 그대로, 1 = 2페이즈부터 매 페이즈)
    strip: { heat: [1, 1], rerolls: [0, 0], choices: [0, 1] }, // 박탈: 특권 증강 새로고침 · 선택지 수 (0 = 그대로)
  },
};

/** 적 성장 페이즈: 의뢰 페이즈 p 를 적 체력 · 피해 · 방어도 · 능력치 성장 곡선 위 위치로 (CFG.scaleCurve, 소수 가능),
 *  그 뒤 (무한 항해)는 1씩. 캠페인은 장마다 정한 페이즈 그대로 (camp = true) */
export function scalePhase(p: number, camp = false): number {
  const C = CFG.scaleCurve;
  if (camp || p <= 1) return p;
  const i = Math.round(p);
  return i <= C.length ? C[i - 1] : i + C[C.length - 1] - C.length;
}

/** p 페이즈 적 피해 누적 배율 (p = 적 성장 페이즈, 소수 가능) */
export function phaseAmpMult(p: number): number {
  return Math.pow(CFG.phaseAmp, p - 1) * Math.pow(CFG.lateAmp, Math.max(0, p - CFG.lateFrom + 1));
}

/** 조우 강도 배율(적 체력 배율 mult) → 적 피해 배율: 체력 배율의 절반만 반영 (build.ts buildEnemy · 역경 설명 공용) */
export const encDmgMult = (mult: number) => 1 + (mult - 1) / 2;

/** p 페이즈 적 체력 누적 배율 (p = 적 성장 페이즈, 소수면 다음 페이즈 계수를 그 몫만큼 거듭제곱 · add = 페이즈마다 곱하는 계수에 더하는 값: 난이도 diffHpAdd) */
export function phaseHpMult(p: number, add = 0): number {
  let m = 1;
  const n = Math.floor(p);
  for (let k = 2; k <= n; k++) m *= CFG.phaseHpFactor(k) + add;
  if (p > n && n >= 1) m *= Math.pow(CFG.phaseHpFactor(n + 1) + add, p - n);
  return m;
}
