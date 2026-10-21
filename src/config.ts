// 밸런스 수치 모음. [임시] 표시는 기획 확정 전 기본값.
import type { CType } from './types';
export const CFG = {
  // ── 메이저 → 마이너 환산 [임시]
  conv: {
    vit: { maxHp: 138, healEff: 0.02 },
    pow: { shoot: 5, strike: 5, crit: 0.01 },
    mnd: { tech: 5, acc: 0.02, effHit: 0.03 },
    def: { armor: 69, effRes: 0.03 },
    // 재장전 속도 1%p → 2%p: 재장전 중 기술 금지 · 제어 시 재장전 초기화로 탄창 무기 기물의 기술 횟수가 ~5.5% 줄어든 만큼 보정
    // (같은 시드 1600판: 보정 전 클리어 31.4% → 29.2%, 보정 후 32.2% · 평균 도달 페이즈 5.61 → 5.60)
    agi: { moveSpd: 0.048, eva: 0.01, atkSpd: 0.01, reloadSpd: 0.02 },
  },
  // ── 리워크 [임시]
  finishMult: 2.6, // 콤보 무기 피니쉬 배율 (콤보 타격은 무기 계수 그대로)
  // 전술 위력 (사격 · 타격 · 기술 위력과 같은 단위): 출전 4명 · 지휘관 1명 기준 tacBase
  resultDelay: 1.1, // 전투가 끝나고 결과 창이 뜨기까지 (초)
  tacBase: 60, tacPerUnit: 16, tacPerCmd: 40, tacPerMnd: 2, // 기본값 100 → 60 (지휘관 스킬 하향)
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
  baseMinor: { maxHp: 600, shoot: 20, strike: 20, tech: 20, armor: 100, crit: 0.05, critDmg: 1.5 },

  // ── 전투 규칙 (확정)
  armorK: 3200,
  /** 난이도별 승리 크레딧 배율 (위험 3 · 6 단계): 쉬움(3) ×1.25 · 모험(6) · 고난(7) ×1.5 — 조건과 함께 간다 (위험 3 의 시작 크레딧 0 보상) */
  diffWinMul: (d: number) => (d >= 6 ? 1.5 : d >= 3 ? 1.25 : 1),
  /** 난이도별 적 증원: [위험 등급, 간격(페이즈)] — 그 등급부터 간격 페이즈마다 조우의 적 +1 (높은 등급이 대체).
   *  쉬움(3) 없음 · 모험(6) 3페이즈마다 · 고난(7) 2페이즈마다. 페이즈 p 의 증원 = ⌊p ÷ 간격⌋ (difficulty.ts diffAddCount) */
  diffAdd: [[6, 3], [7, 2]] as [number, number][],
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
  enemyMoveSpd: { base: 0.5, assassin: 1 },
  /** 돌격가 경계 (아군 돌격가만, 적 쪽 경계는 없다): 아군 돌격가 주변 r칸. 적이 경계 칸에 들어오면 그 자리에서 hold 초 동안 움직이지 못한다
   *  (공격 · 기술은 한다). 경계 칸 → 경계 칸 이동은 길찾기에서 막는다. 경계에 걸리면 그 돌격가에게 도발 수치 PROV.zoc (combat.ts).
   *  assassinMul: 암살형 성향은 경계에 걸리되 교전 시간 · 그 돌격가에게 쌓이는 도발 수치를 이 배율로 받는다 (예전엔 경계를 통째로 무시했다).
   *  pathCost: 길찾기에서 경계 칸에 들어가는 걸음의 추가 비용 (칸). 0 = 적이 경계를 피해 돌지 않고 그대로 걸어 들어온다.
   *  2 로 두면 적이 1~2칸 돌아서 경계를 피해 버려 후열이 받는 피해가 그대로였다 (같은 시드 1200판: 명사수 받은 피해 −0.1% · 0 이면 −1.3%) */
  /** 교전(붙잡힘) 시간 = hold + (그 경계를 만든 돌격가의 도발 배율 − 1) × holdPerProv 초 (돌격가 ×3 → 1.5초, 수호자 시너지 ×4.5 → 1.875초) */
  zoc: { r: 1, hold: 1, holdPerProv: 0.25, pathCost: 0, assassinMul: 0.5 },
  /** 암살형 적에게 노려지는 아군의 도주 (combat.ts flee): 자기를 표적으로 삼은 암살형 적이 r칸 안에 들어오면 그 적에게서 더 먼 빈칸으로 1칸 물러난다.
   *  ctypes: 도주하는 전투 유형 (돌격가는 맞서 싸운다). 소환물 · 고정 기물 · 속박 · 기절 · 광폭 · 혼란 · 매혹 중에는 하지 않는다.
   *  기본 공격이 준비돼 있고 사거리 안이면 공격이 먼저이고, 한 번 물러나면 cd 초 동안 다시 물러나지 않는다 (도망만 다니다 손을 놓지 않게). */
  flee: { r: 2, cd: 2, ctypes: ['MARK', 'SPEC', 'CMD'] as CType[] },
  overtimeStart: 45, overtimeRamp: 0.1, timeLimit: 75,

  // ── 무한 모드 페이즈 스케일링 (확정, 복리)
  phaseArmor: 1.25, phaseAmp: 1.28,
  // 체력 배율: 5페이즈까지 ×2.05, 6페이즈부터 ×1.9, ×1.8 … (하한 ×1.1 [임시])
  // 고페이즈 보정 [임시]: lateFrom 페이즈부터 매 페이즈 체력 ×lateHp, 피해 ×lateAmp 추가 (8페이즈 누적 체력 -19%, 피해 +41%)
  lateFrom: 5, lateHp: 0.9, lateAmp: 1.05,
  phaseHpFactor: (p: number) => (p <= 5 ? 1.85 : Math.max(1.1, 1.85 - 0.1 * (p - 5))) * (p >= CFG.lateFrom ? CFG.lateHp : 1),
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
  xpPool: (phase: number) => 6 + 3 * phase, // 전투 1회 공명도 풀 [임시]
  buyXpCost: 4, buyXpAmount: 4, // [임시]
  augmentChoices: 3, augmentRerolls: 1,
  /** ★ 전설 전공 증강: 전공 증강 선택지 3장 중 1장이 전설일 확률 = base + pity × (전설 없이 지나간 전공 증강 수). 전설을 한 번 얻으면 보정 없이 base */
  psiLegend: { base: 0.25, pity: 0.25 },
  /** 마이너 능력치 보상 대성공 확률: 대성공이면 고른 주요 능력치 상승량 2배 (run.ts allocRank) */
  greatChance: 0.2,

  // ── 파티/보드
  victoryPhase: 6, // 이 페이즈 보스를 이기면 의뢰 성공
  // 전환 노드 (짝수 페이즈): 휴식 = 체력 회복 + 공명도 소량 / 도전 = 다음 페이즈 역경급 전투, 승리 시 남은 노드 보상을 몰아 받고 다음 페이즈로
  forkRestHp: 10, forkRestLost: 0.2, forkRestXp: 0.5, // 휴식: 체력 +n + 잃은 체력 × lost (내림), 공명도 = 전투 1회 풀 × k
  challengeXp: 4.5, // 도전 승리: 공명도 = 전투 1회 풀 × k
  amundsenRecruitW: 0.08, // 아문센 · 데미우르고스 영입 후보 가중치 (다른 기물 = 1)
  joinRankRatio: 0.7, // 영입 · 합류 등급 = max(페이즈 - 1, 출전 기물 평균 등급 × k)
  startUnits: 4, maxParty: 16, // 출전 최대 10 + 대기 6
  starterPool: 8, starterFav: 2, starterRerolls: 1, // 계약 기물 선택 (engine/starters.ts): 후보 수 · 그중 전장 우세 시너지(FieldDef.ally.syn, 전장 브리핑의 '우세 시너지') 기물 최소 수 · 후보 새로고침 횟수
  deployBase: 4, // 기본 출전 인원. 함대 확장으로 늘린다
  fleetCosts: [20, 40, 56, 72, 90, 108, 128, 160, 200, 256], // 함대 확장 n번째 비용 (출전 5 → 14명)
  musterCost: 16, musterStep: 8, musterPicks: 3, // 지정 소집: 기본 가격, 회당 상승, 고르는 시너지 수
  benchXpWeight: 0.5, // 대기 기물의 공명도 분배 가중치 (출전 기물 대비)
  boardSizes: [ { n: 7, w: 70, env: '표준 전장' }, { n: 6, w: 15, env: '협소한 통로' }, { n: 8, w: 15, env: '개활지' } ],
  bossBoard: 7,
  /** 전장 지형 틀 (data/maps.ts, run.ts pickMap): 일반 · 역경 · 도전 전투에서 그 전장 전용 틀 확률 · 아니면 공용 틀 (긴 통로 · 포위) 확률.
   *  repeat: 직전 · 그 전 전투와 같은 틀의 가중치 (연달아 같은 지형이 덜 나오게) */
  maps: { field: 0.45, common: 0.2, repeat: [0.2, 0.5] as [number, number],
    /** 긴 통로 중 폭 5칸 (corridor5) 이 나올 몫: 페이즈 1 · 2 · 3 · 4 · 5+ (나머지는 폭 4칸). 초반은 4칸 위주, 후반은 거의 5칸 */
    wide5: [0.15, 0.35, 0.6, 0.85, 0.95],
    /** 연결교 (도킹 연결부): 위에 선 기물이 받는 피해 증가 몫 */
    bridgeTaken: 0.15,
    /** 광석 운반차 (광석 운반차 선로): 첫 통과 first 초, 이후 period 초마다 (방향은 번갈아) · warn 초 전부터 선로 경고 · 선로를 지나는 데 sweep 초 · 운반차 길이 len 칸 ·
     *  선로 위 기물 (아군 · 적 · 구조물): 최대 체력의 dmg 만큼 물리 피해 + 선로 밖으로 밀려남 + 기절 stun 초. 지나는 동안 운반차가 선 칸은 직선 사격을 막는다 */
    cart: { first: 6, period: 10, warn: 2, sweep: 0.6, len: 2, dmg: 0.12, stun: 0.5 } },
  rarePhase: 3, // 아문센 · 데미우르고스가 영입 후보에 나오는 페이즈 (배치 제한은 없음)
  /** 최고의 친구 소환물 스탯 상속률 (build.ts spawnSummons): 시너지가 꺼져 있을 때의 기본값 · 추가로 불린 소환물(2번째부터)의 배율 · 상한 */
  bond: { base: 0.35, extra: 0.8, cap: 6 },
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
  winCredits: (phase: number) => Math.floor(2.5 + phase / 2), // 노드가 늘어 이자가 쌓이므로 노드당 2~3 감소 (P1 3 · P3 4 · P6 5)
  lossCredits: 2,
  interestPer: 10, interestMax: 5,
  streakBonus: (streak: number) => (streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0),
  price: { C: 7, G: 16, A: 16, L: 60 } as Record<string, number>,
  sell: { C: 3, G: 7, A: 7, L: 20, M: 6, O: 8, K: 4, T: 5, E: 8, J: 1 } as Record<string, number>, // J: 유닉스제 잡동사니 (캣휠) · E: 엔지니어 전용 포탑 개조부품
  // 장비 드랍 [임시]
  // advParts: 역경(· 도전) 승리 시 무작위 장비 재료 확정 개수 (예전: 확률 50%)
  drop: { battle: 0.1, advParts: 1, bossAdvEvery: 3, bossPart: 0.5, shopParts: 2, shopAdv: 0.4, shopAdv2: 0.1, shopGraded: 0.15, shopLegend: 0.05, shopLegendPhase: 6, utility: { battle: 0.15, adversity: 0.3, boss: 0.5 } as Record<string, number>,
    // 전설 소모품 (승리 시, 위 utility 와 따로 굴림): 강제 징수기 = 매우 낮은 확률 (적이 장비를 다는 위험 등급에서만) · 원초 공명석 = 극저확률
    seize: { battle: 0.01, adversity: 0.02, boss: 0.04 } as Record<string, number>,
    rank3: { battle: 0.003, adversity: 0.008, boss: 0.02 } as Record<string, number> },
  /** 공명 주입기 (소형 K_xp · 중형 K_xp2 · 대형 K_xp3): 공명도 · 입고 가중치 · 나오기 시작하는 페이즈.
   *  smallTo 페이즈가 지나면 소형은 나오지 않고 그 가중치를 중형이 가져간다 (전투 보상 · 상점 공용) */
  inject: { amount: { K_xp: 8, K_xp2: 20, K_xp3: 40 } as Record<string, number>, w: { K_xp: 6, K_xp2: 3, K_xp3: 3 } as Record<string, number>, from: { K_xp: 1, K_xp2: 3, K_xp3: 6 } as Record<string, number>, smallTo: 4 },
  /** 상점 노드 (분기점의 상점, genShop): 재료 · 희귀 · 고급 · 전설은 drop.shop* 그대로, 아래는 그 밖의 진열 */
  /** 위험 등급 적 장비 (run.ts gearEnemies, 위험 2 부터): 칸마다 장착 확률 slot (역경 · 보스전 big) × 정예 elite · 보스 boss 배율,
   *  역경 · 보스전 장비는 graded 확률로 고급 (아니면 재료). (5): 보스 전설 bossLegend 확률 · 개조부품 mod [일반, 정예, 보스] */
  foeGear: { slot: 0.08, big: 0.25, elite: 1.5, boss: 2, graded: 0.5, bossLegend: 0.95, mod: [0.1, 0.3, 0.6] as [number, number, number] },
  shop: {
    gearFrom: 3, gearAdv: 0.5, // 이 페이즈부터 고급 · 희귀 장비를 1개 이상 확정 진열 (확률 입고가 없으면 1개 추가: 희귀일 확률, 아니면 고급)
    consMin: 2, // 소모품은 서로 다른 종류로 최소 2개 진열 (+ cons 확률로 1개 더)
    cons: 0.4, consW: { inject: 3, K_strip: 1, K_reroll: 1, K_cp_purge: 1, K_cp_note: 1, K_barricade: 1, K_decoy: 1, K_mine: 1, K_net: 1 } as Record<string, number>, // 소모품 1개 (종종): 공명 주입기(페이즈에 맞는 크기) · 분리 용제 · 재구성 회로 · 정화 분무기 · 선지급 어음 (캠페인에서 들여옴) · 배치형 4종 (바리케이드 · 신호기 · 지뢰 · 그물)
    seize: 0.25, // 강제 징수기 (종종, 적이 장비를 다는 위험 등급에서만)
    rank3: 0.04, rank3From: 2, // 원초 공명석 (희귀): 입고 확률 · 시작 페이즈
    emblem: 0.06, emblemOwn: 0.6, // 문장 (희귀): 입고 확률 · 출전 기물이 가진 시너지 문장일 확률
    /** 가격 (크레딧, 전장 상점 배율 · 관세 적용 전). 소모품 판매가(sell.K)보다 비싸게 */
    price: { K_xp: 6, K_xp2: 14, K_xp3: 26, K_strip: 6, K_reroll: 8, K_seize: 30, K_rank3: 40, emblem: 25, K_cp_purge: 6, K_cp_note: 2, K_barricade: 8, K_decoy: 6, K_mine: 7, K_net: 9 } as Record<string, number>,
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
    floor: (phase: number) => 12 + phase,
    kindW: { credits: 1, xp: 1, gear: 1 } as Record<string, number>,
    jackpot: [[2, 0.025], [1.5, 0.09]] as [number, number][],
    graded: 0.3, legendFrom: 6,
    jackpotInject: 0.35, // 대박 카드가 재료 등급으로 떨어졌을 때 중형 공명 주입기가 될 확률 (나머지는 고급 · 희귀 장비)
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
    medic: 3, salvage: 2, shieldwall: 0.08, tenacity: 0.2, tenacityHp: 0.35, discount: 0.15,
    glassDmg: 0.35, glassTaken: 0.2, overtime: 0.5, blitz: 0.6, blitzDur: 6, vamp: 0.08, bountyMax: 6, bond: 60, bondCap: 2,
    firstShot: 2, regen: 0.006, fiber: 0.12, critDmg: 0.25, pen: 0.1, reload: 0.25, ult: 0.2, eva: 0.06, mindRes: 0.2, mindRed: 0.15, saving: 2, ration: 15, rationMax: 10,
    chain: 0.8, thorns: 0.3, windAt: 0.3, wind: 0.25, execAt: 0.2, exec: 0.4, giant: 0.25, dblChance: 0.15, dbl: 0.5, patron: 15, tutor: 2, commission: 20, transfuse: 15,
    berserkMax: 0.8, berserkHp: 0.15, goldAt: 100, gold: 0.3, goldCap: 3, odAt: 20, od: 0.6, odAs: 0.2, odSlow: 0.3, hydra: 0.2, midasLean: 2, loneMax: 3, lone: 0.6, loneRed: 0.25, phoenix: 0.5, phoenixCost: 20,
    stakes: 1.5, stakesFoe: 0.25, blood: 2, minkyRank: 2, petraPer: 3, ascend: 2, lastDmg: 0.4, lastRed: 0.15, sacrifice: 2,
  },
  despair: {
    from: 7, // 이 위험 등급 이상 런에서 고른다 (고난)
    every: 3, // 추가로 고르는 간격 (페이즈): 페이즈 every · 2×every … 시작 때 1개씩
    choices: 3, rerolls: 1, // 선택지 수 · 새로고침 횟수 (고를 때마다)
    rockSlots: 1, // 단장의 반려 돌: 영입 선택지 중 반려 돌로 바뀌는 수
    overclock: 2, // 오버클럭: 적 기술 쿨다운 감소 속도 +
    rival: 0.4, // 배타적 경쟁 항로: 보유 기물과 시너지가 겹치는 기물의 영입 가중치 ×
    interest: 0.5, // 근시안적 투자안: 이자 수입 감소 비율 (내림)
    catwheel: 0.2, catwheelMajors: 3, // 유닉스제 대량 생산: 희귀 · 고급 장비가 캣휠로 바뀌는 확률 · 밍키가 캣휠을 달면 모든 주요 능력치 +
    zi: 5, ziMajors: 5, // 캣휠(ZI존): 캣휠 (보관함 + 장착 중)이 이만큼 모이면 자동으로 합쳐지는 전설 장비 · 모든 주요 능력치 + (밍키가 달면 캣휠 보너스도 더함)
    shield: 0.12, // 페트라 균등 납품: 적 전투 시작 보호막 (최대 체력 비율)
    tariff: 0.15, // 무역관세부 특별 관세: 상점 · 정비 · 합성 가격, 함대 확장 · 지정 소집 비용 + (0.3 은 너무 가혹해서 낮춤)
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
    abyss: { heat: [2, 2], start: [1, 1], every: [0, 2] }, // 심연: 출격 때 절망 증강 + · 추가 선택 간격 (0 = 그대로)
    strip: { heat: [1, 1], rerolls: [0, 0], choices: [0, 1] }, // 박탈: 특권 증강 새로고침 · 선택지 수 (0 = 그대로)
  },
};

/** p 페이즈 적 피해 누적 배율 */
export function phaseAmpMult(p: number): number {
  return Math.pow(CFG.phaseAmp, p - 1) * Math.pow(CFG.lateAmp, Math.max(0, p - CFG.lateFrom + 1));
}

/** 조우 강도 배율(적 체력 배율 mult) → 적 피해 배율: 체력 배율의 절반만 반영 (build.ts buildEnemy · 역경 설명 공용) */
export const encDmgMult = (mult: number) => 1 + (mult - 1) / 2;

/** p 페이즈 적 체력 누적 배율 */
export function phaseHpMult(p: number): number {
  let m = 1;
  for (let k = 2; k <= p; k++) m *= CFG.phaseHpFactor(k);
  return m;
}
