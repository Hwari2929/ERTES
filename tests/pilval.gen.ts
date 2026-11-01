// 자동 생성: tests/pilval_model.py (balance.ts pilval 측정 → 순례 봇 실측표). 손으로 고치지 않는다.
// 측정: 48387cc (v475) · 시드 30001–30300 × 철수 · 영희 · pilval=2 · 순례 방문 1073회. 단위 = 크레딧 (같은 시험 조우에서 크레딧 사다리 → 공명도 구매와 같은 전력 변화).
// 성유물 · 신앙 · 봉헌 · 나눔 수치가 바뀌면 다시 잰다 (docs/TOOLS.md pilval).
/** 성유물 고유 가치: 바꿨을 때 이득 ≈ RELIC_G[새] − RELIC_G[지금] */
export const RELIC_G: Record<string, number> = { key: 83.7, stew: 14.7, pact: 14.3, lantern: 12.5, aegis: 10.8, platter: 6.9, bell: 6.8, spear: 5.9, aspis: 4.3, spot: 2.0, flag: -1.8, mic: -2.7, sandals: -4.9, whip: -12.5, gauge: -15.4, warrant: -21.9, bow: -23.0, helm: -23.5, bolt: -25.0, dividend: -31.1 };
/** 신앙 고유 가치: 개종 이득 ≈ FAITH_H[새] − FAITH_H[지금] */
export const FAITH_H: Record<string, number> = { hermes: 11.1, hades: 10.1, science: 8.8, index: 1.8, selene: 0.7, ares: -0.3, emperor: -2.6, athena: -2.9, human: -5.1, zeus: -7.3, sirius: -14.3 };
/** 축복: 이번 페이즈 전투당 가치 (봇이 '이번 페이즈 남은 전투 ÷ 런 남은 전투' 를 곱한다) */
export const BLESS_V: Record<string, number> = { 'B.sanctum': 39.1, 'B.zeal': -15.7, 'B.flame': 26.2, 'B.martyr': 74.7 };
/** 봉헌 1 당 가치 (지금 단계 0–5) */
export const OFFER_V = [0.215, 0.087, 0.085, 0.07, 0.052, 0.074];
/** 권능 1 의 가치 (축성 = 봉헌 30 ÷ 권능 20) */
export const POWER_V = 0.133;
/** 나눔: 측정 가치 ÷ 공시 가치 (보급 기준값 × CFG.alms.ratio) */
export const ALMS_K = 0.72;
