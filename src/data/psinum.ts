// 사이오닉 비술 · 지속 능력 · 전공 증강의 수치. 엔진(psionic.ts)과 설명(psiinfo.ts)이 같은 값을 읽는다.
import { SCHOOL_BY_ID, type SchoolId } from './schools';
// 계수는 주요 위력 기준 (명사수 사격 · 돌격가 타격 · 전문가 기술 · 지휘관 전술) × CFG.psiPower.

export const PSI = {
  pyro: {
    /** 소각: 대상 · 주변 1칸 피해 */
    splash: 0.6, splashR: 1,
    /** 소각: 소모한 연소 1중첩당 (백린) */
    per: 0.5, wpPer: 0.35,
    /** 소각: 연소가 없을 때 거는 중첩 */
    seed: 2,
    /** 연소: 중첩당 초당 · 최대 중첩 (백린) · 지속 */
    dps: 0.12, max: 5, wpMax: 10, dur: 5,
    /** 발화 확률 · 봉화 (아군 기본 공격) · 열폭주 (발화 ×2, 쿨다운 ×0.5) */
    proc: 0.25, beacon: 0.1, runawayProc: 2, runawayCd: 0.5,
    /** 연쇄 소각 최대 연속 횟수 */
    chainMax: 4,
  },
  chrono: {
    /** 서리 파편 발 수 · 파편당 피해 (서리 폭풍) */
    shards: 3, stormShards: 6, coef: 0.5, stormCoef: 0.3,
    /** 빙결 확률 · 오한 1중첩당 추가 · 지속 (영구 동토) */
    freezeP: 0.25, freezePerChill: 0.1, freezeDur: 2, permaDur: 3,
    /** 정지된 시간: 빙결된 적 받는 피해 · 엔트로피 역류: 빙결당 이성 */
    stopVuln: 0.4, revertReason: 6,
    /** 시간 가속 (◆): 아군 수 · 지속 · 공격 속도 */
    hasteN: 3, hasteDur: 4, hasteAtkSpd: 0.25,
    /** 오한: 중첩당 초당 · 속도 감소 · 최대 (절대 영도) · 발동 확률 */
    chillDps: 0.04, chillSlow: 0.08, chillMax: 4, zeroMax: 6, proc: 0.3,
  },
  volt: {
    /** 방전 피해 · 거는 전도 */
    coef: 0.9, conduct: 2,
    /** 전도: 중첩당 (고전압) · 범위 (고전압) · 최대 · 지속 */
    per: 0.15, hvPer: 0.22, r: 1, hvR: 2, max: 3, dur: 5, proc: 0.25,
    /** 과부하: 필요 중첩 · 폭발 계수 */
    overloadAt: 3, overload: 3,
    /** 바운스 번개: 방전 피해 대비 · 횟수 */
    bounce: 0.6, bounceN: 3,
    /** 역전류 (◆): 충전 중첩 · 아군 전도 중첩당 피해 (고전압이면 hv) */
    reverseN: 3, reversePer: 0.1, reverseHvPer: 0.15,
  },
  wave: {
    /** 충격파 피해 · 공진 지속 */
    coef: 0.7, resDur: 5,
    /** 공진: 피해 (고유 진동수) · 범위 (끌개) · 내부 쿨다운 */
    res: 0.15, freqRes: 0.25, resR: 1, attractResR: 2, resIcd: 0.5, proc: 0.2,
    /** 충돌 · 진도 측정 기절 */
    stun: 1.2, seismicP: 0.35,
  },
  seed: {
    /** 포자 피해 · 거는 중독 */
    coef: 0.4, poison: 2,
    /** 중독: 중첩당 초당 · 지속 · 최대 (독성 농축) */
    per: 0.1, dur: 5, max: 3, concMax: 6, proc: 0.25,
    /** 재생 포자 (◆): 지속 · 초당 회복 */
    regenDur: 5, regenHps: 0.25,
    /** 괴사: 필요 중첩 · 받는 피해 */
    necroAt: 6, necroVuln: 0.2,
  },
  mind: {
    /** 계시: 결속 인원 (집단 무의식) · 지속 · 받는 피해 · 공유 비율 (연결된 운명) */
    n: 3, collectiveN: 5, bondDur: 5, bondVuln: 0.1, share: 0.25, fateShare: 0.5,
    /** 매혹 지속 · 승천 추가 · 정신 지배 피해 */
    charm: 1.5, ascendPlus: 1, dominate: 1,
    /** 집단 최면 (◆) 혼란 */
    hypno: 2,
    /** 자아 침식 */
    proc: 0.15, confuse: 1,
  },
  gold: {
    /** 시장 개입 성공 확률 = base + perReason × |이성|/100 (+ 내부 정보) */
    base: 0.4, perReason: 0.5, insider: 0.3,
    /** 실패 보호막 · 임시 장비 최대 · 변동성 쿨다운 · 레버리지 실패 피해 */
    shield: 0.8, max: 3, volCd: 2, leverageSelf: 0.1,
    /** 배당 (◆): 아군 수 · 성공 횟수 */
    divN: 3, divMax: 3,
    /** 분산 투자: 임시 장비 1개당 피해 · 경감 */
    perDmg: 0.05, perRed: 0.03,
  },
  illusion: {
    /** 환영: 지속 · 최대 (군무) · 체력 · 실체화 공격 계수 */
    life: 6, max: 2, troupeMax: 4, hp: 0.3, solid: 0.4,
    /** 분신 (◆): 지속 · 체력 · 피해 · 쿨다운 증가 */
    cloneLife: 12, cloneHp: 0.5, cloneDmg: 0.5, cloneCd: 4,
    /** 실체화 + 분신: 체력 · 받는 피해 감소 · 기본 공격 적중 시 정신 추가 피해 */
    solidCloneHp: 0.7, solidCloneRed: 0.15, solidCloneHit: 0.2,
    /** 잔향 · 안개 · 교란 */
    echo: 1.2, fog: 0.3, disrupt: 0.1, disruptMax: 3,
    /** 향취 */
    proc: 0.2, scentDur: 4, scentEva: 0.15, scentVuln: 0.08, denseMax: 3,
  },
} as const;

/** 비술 쿨다운 (전공 증강 반영, 이성에 따라 바뀌는 열폭주 제외). has('전공.키') = 그 전공 증강 보유. 엔진 · 설명 공용 */
export function cantripCdOf(id: SchoolId, has: (k: string) => boolean): number {
  let cd = SCHOOL_BY_ID[id].cantrip.cd;
  if (id === 'gold' && has('gold.vol')) cd -= PSI.gold.volCd; // 변동성
  if (id === 'illusion' && has('illusion.clone')) cd += PSI.illusion.cloneCd; // 분신
  return Math.max(0.5, cd);
}

/** 자신이 거는 상태의 최대 중첩 (전공 증강 반영). 엔진 · 조합 조건 표시 공용 */
export type PsiStack = 'burn' | 'chill' | 'conduct' | 'poison' | 'scent' | 'tempgear';
export function psiStackCap(st: PsiStack, has: (k: string) => boolean): number {
  switch (st) {
    case 'burn': return has('pyro.wp') ? PSI.pyro.wpMax : PSI.pyro.max;
    case 'chill': return has('chrono.zero') ? PSI.chrono.zeroMax : PSI.chrono.chillMax;
    case 'conduct': return PSI.volt.max;
    case 'poison': return has('seed.conc') ? PSI.seed.concMax : PSI.seed.max;
    case 'scent': return has('illusion.dense') ? PSI.illusion.denseMax : 1;
    case 'tempgear': return PSI.gold.max;
  }
}
