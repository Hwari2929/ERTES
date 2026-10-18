// 철수 봇 2단계: 절망 증강 실측 해로움표 (aug 영역). 조정 시드 1–60, 위험 7, 철수 1단계 기본 + econ 정책(chulsu=form,gear,growth,start,econ)으로
// 출격 때 첫 절망 증강을 그것으로 강제했을 때의 도달 페이즈(클리어 = 7) 손실 = 기준(봇 무작위 선택) − 강제. 클수록 해롭다.
// 잡음(95% 구간 ±0.4~0.5 페이즈)이 커서 평균 쪽으로 절반 당겼다 (= 0.5 × 실측 + 0.5 × 평균). 만든 방법 · 원자료: docs/BOT_CHULSU.md 2단계 · 실행 인자 fdesp= (tests/balance.ts, 조건부 실험)
export const DESP_HARM: Record<string, number> = {'D.rock': 0.11, 'D.overclock': -0.048, 'D.rival': 0.193, 'D.myopic': 0.035, 'D.unix': 0.06, 'D.petra': -0.148, 'D.tariff': 0.11, 'D.miracle': -0.098, 'D.final': -0.09, 'D.swarm': 0.077};
