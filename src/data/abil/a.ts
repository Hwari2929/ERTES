// 능력 설명 (통일 형식) — 그룹 a
import type { AbilText, Area } from '../abiltext';

type Row = [string, string];
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');
/** 값이 있을 때만 행 추가 */
const opt = (on: unknown, k: string, v: string): Row[] => (on ? [[k, v]] : []);

export const ABIL_A: Record<string, AbilText> = {
  mirinae: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: { k: 'one' },
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['치명타', `[g:crit] 확률 [pp:${p.crit}]`],
        ...opt(p.pen, '관통', `[g:pen] [p:${p.pen}]`),
        ...opt(p.resetOnKill, '처치', '처치 시 쿨다운 초기화'),
      ],
    }),
    trait: '장착한 장비 · 개조부품 · 임시 장비 1개당 회피 · [g:crit] 확률 [pp:0.025] (최대 [pp:0.15]).',
    augs: {
      double: '깜찍이 2회 발사 (두 번째도 [p:1] 피해).',
      cell: '깜찍이 피해 [dmg+:shoot:1.7:phys]. [g:pen] [p:0.5].',
      vanish: '깜찍이로 처치 시 쿨다운 초기화.',
      gem: '[g:crit] 확률 [pp:0.15], 치명타 피해 [pp:0.6].',
      onsen: '기동력 +9, 전투력 +6.',
    },
  },
  donovan: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:phys]`],
        ['치명타', `[g:crit] 확률 [pp:${p.crit}]`],
        ...opt(p.bleed, '출혈', `[st:bleed:4] 초당 [dmg:tech:${p.bleed}:phys]`),
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`),
        ...opt(p.shock, '감전', `[st:shock:${p.shock}:${p.shockChance || 0.7}]`),
        ['소환', '까악이가 같은 대상을 노림'],
      ],
    }),
    trait: '기술 피해도 [g:crit] 발생. 기본 공격은 사거리 안에서 체력 비율이 가장 낮은 적을 노림. 까악이 공격 속도 +[p:0.3].',
    augs: {
      wire: '자안의 사수 적중 시 [st:bleed:4]: 초당 [dmg:tech:0.5:phys].',
      marker: '자안의 사수 적중 시 [st:vuln:4]: 받는 피해 +[p:0.3].',
      livibold: '까악이 스탯 상속률 [pp:0.4].',
      deck: '자안의 사수 적중 시 [st:shock:2].',
      ice: '회피 [pp:0.075], 공격 속도 [pp:0.25].',
      'sp.eye': '기술 피해가 [g:crit]로 적중 시 쿨다운 -[s:1].',
      'sp.crow': '까악이 기본 공격 적중 시 [st:shock:1:0.3].',
      'sp.shadow': '[g:finish] 적중 시 대상 주변 [t:1] 적에게 [dmg:strike:0.8:phys].',
      'sp.execute': '스킬 대상의 체력이 [p:0.3] 이하이면 스킬 피해 ×1.8.',
      'sp.night': '전투 시작 후 [s:4] 동안 은신 (대상으로 지정되지 않음). 은신 중 첫 스킬은 반드시 [g:crit].',
      'sp.weak': '[g:crit] 피해 [pp:0.4]. 기술 피해가 [g:crit]로 적중하면 대상 [st:corrode:4]: 방어도 -[p:0.3].',
      'sp.council': '스킬 대상에게 [s:6] 동안 표식: 모든 아군이 그 적에게 주는 [g:crit] 피해 [pp:0.25].',
      'sp.track': '대상이 쓰러질 때까지 대상을 바꾸지 않음 (스킬 포함). 같은 대상 공격마다 피해 +[p:0.06] (최대 +[p:0.6]).',
    },
  },
  chloe: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: aroundOr(p.radius),
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['정화', '[g:cleanse]'],
      ],
    }),
    trait: '기본 공격 적중 시 [st:poison:4]: 초당 [dmg:tech:0.25:chem]. 다트 6번째 적중마다 항밈 수면제: 대상 [st:stun:2:0.5]. 회복 시 대상의 해로운 효과 1개 제거.',
    augs: {
      seven: '업계 비밀 배합 회복 [heal+:1.2].',
      sedative: '기절 확률 [pp:0.4], 지속 +[s:1].',
      batch: '업계 비밀 배합 범위: 대상 주변 [t:1]. 회복 [heal+:0.3].',
      lady: '회피 [pp:0.125].',
      photo: '쿨다운 감소 속도 [pp:0.25]. 전투 승리 시 명성 +2.',
    },
  },
  west: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: { k: 'one' },
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
    }),
    trait: '아군 [g:turret] 기본 공격 적중 시 추가 [dmg:shoot:0.15:true]. [s:7]마다 모든 아군 [g:turret] [heal:1] + 공격 속도 +[p:0.35] ([s:4]).',
    augs: {
      spanner: '스패너 던지기 피해 [dmg+:shoot:1.6:phys].',
      cig: '쿨다운 감소 속도 [pp:0.4].',
      nco: '명중 [pp:0.15], [g:crit] 확률 [pp:0.1], 치명타 피해 [pp:0.4].',
      honey: '생명력 +10, 방어력 +5.',
      standard: '[g:turret] +1기. 포탑 체력 · 방어도 +[p:0.4].',
    },
  },
  lindiwe: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys]`],
        ['반사', `[g:reflect] [p:${p.counter}] ([s:${p.dur}])`],
        ...opt(p.stun, '기절', `[st:stun:${p.stun}]`),
      ],
    }),
    trait: '자신과 주변 [t:1] 아군 [g:red] [p:0.3]. 주변 아군이 받는 피해의 [p:0.5]를 대신 받음. 전투 스킬 사용 시 자신에게 최대 체력 [p:0.18] 보호막.',
    augs: {
      onetwo: '실드 제너레이터 피해 [dmg+:strike:1.2:phys].',
      overload: '실드 제너레이터 보호막 최대 체력 [pp:0.3].',
      weave: '[g:reflect] [pp:0.15], 지속 +[s:3].',
      dough: '실드 제너레이터 적중 시 [st:stun:1.2].',
      tenure: '방어력 +10, 생명력 +5.',
    },
  },
  orca: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ...opt(p.shield, '보호막', `[shield:${p.shield}]`),
        ['버프', `공격 속도 +[p:${p.as}] ([s:${p.dur}])`],
        ...opt(p.dmg, '피해', `주는 피해 +[p:${p.dmg}] ([s:${p.dur}])`),
        ...opt(p.red, '피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`),
        ...opt(p.cleanse, '정화', '[g:cleanse]'),
        ['요리', '[g:cook] 배율 적용'],
      ],
    }),
    trait: '기본 공격 · 스킬 피해 시 [p:0.2] 확률로 무작위 적 1명 [st:stun:0.6] (1초에 1회).',
    augs: {
      herring: '바 당직 시그니처 회복 [heal+:1.8].',
      espresso: '바 당직 시그니처 공격 속도 [pp:0.35].',
      blanca: '바 당직 시그니처 [shield:1.2] 추가.',
      counsel: '바 당직 시그니처 대상 [g:cleanse]. 지속 동안 [g:red] [p:0.25].',
      coin: '바 당직 시그니처 대상 지속 동안 주는 피해 +[p:0.3].',
    },
  },
  franze: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: { k: 'one' },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys]`],
        ...opt(p.stun, '기절', `[st:stun:${p.stun}]`),
      ],
    }),
    trait: '[g:lifesteal] [pp:0.1]. 전투 스킬 사용 후 잃은 체력의 [p:0.125] 재생. 기본 공격 적중 시 [g:judge] ([s:5], 대상당 1개). 전투 스킬은 [g:tac]으로 계산.',
    augs: {
      precedent: '이의 있습니다 피해 [dmg+:strike:1.8:phys].',
      deferred: '이의 있습니다 잃은 체력 회복 [pp:0.125].',
      oldform: '이의 있습니다 적중 시 [st:stun:1.2].',
      blood: '[g:lifesteal] [pp:0.25].',
      stocks: '회피 [pp:0.075]. 전투 승리 시 크레딧 +3.',
    },
  },
  grenholm: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys]`],
        ['기절', `[st:stun:${p.stun}]`],
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`),
      ],
    }),
    trait: '기본 공격 · 스킬 사용 시 최대 체력 [p:0.05] 보호막 (최대 [p:0.2]). 전투 스킬 사용 시 최대 체력 [p:0.15] 보호막 추가.',
    augs: {
      deflect: '군수품 시연 보호막 최대 체력 [pp:0.3].',
      rocket: '군수품 시연 범위 +[t:1]. 피해 [dmg+:strike:0.3:phys].',
      sevenfold: '체력 [p:0.5] 이상일 때 [g:red] [p:0.45].',
      evidence: '군수품 시연 적중 시 [st:vuln:4]: 받는 피해 +[p:0.3].',
      loss: '군수품 시연 피해 [dmg+:strike:0.6:phys]. 전투 승리 시 명성 +2.',
    },
  },
  lars: {
    skill: (p) => ({
      tgt: '최대 체력이 가장 높은 적', range: null, area: { k: 'one' },
      rows: [
        ['약화', `[g:weak] [p:${p.weak}] ([s:${p.dur}])`],
        ...opt(p.vuln, '취약', `[g:vuln] 받는 피해 +[p:${p.vuln}] ([s:${p.dur}])`),
        ['피해', `경호원이 대상을 공격. 인접한 경호원은 즉시 경호원 타격 위력의 [p:${p.mult}] 물리 피해`],
      ],
    }),
    trait: '기본 공격을 하지 않음. 경호원 +1명. 경호원이 살아 있으면 [g:red] [p:0.25]. 함께한 뒤 번 크레딧 10당 경호원 메이저 스탯 +1 (최대 +10). 이자 상한 +2. 경호 계약: [s:8]마다 모든 경호원에게 [shield:1.5]. 전투 스킬 · 경호 계약은 [g:tac]으로 계산.',
    augs: {
      guards: '경호원 +1명. 경호원 방어도 +240.',
      elite: '경호원 스탯 상속률 [pp:0.4].',
      downstream: '거래 제안 대상 [g:vuln]: 받는 피해 +[p:0.3].',
      terms: '거래 제안 약화 [pp:0.1], 지속 +[s:3].',
      resell: '거래 제안 경호원 [shield:0.9] 추가. 전투 승리 시 크레딧 +3.',
      'sp.bribe': '거래 제안 사용 시 대상 [st:fear:4], 받는 피해 +[p:0.25].',
      'sp.counsel': '경호원 -1명. 남은 경호원 최대 체력 ×2, 피해 ×1.5.',
      'sp.pen': '기본 공격 활성화: 사격 · 물리, 피해 계수 ×1.8, 사거리 [t:3], [g:mag] 1발, 재장전 [s:1.5].',
      'sp.elite': '경호원 최대 체력 +[p:0.4], 경호원 메이저 스탯 +2.',
      'sp.penalty': '경호원이 쓰러지면 체력이 가장 높은 적에게 [dmg:tech:2.5:phys], [st:vuln:6] 받는 피해 +[p:0.2].',
      'sp.exclusive': '거래 대상 [s:4] 동안 속박 (이동 불가), 공격 속도 -[p:0.3].',
      'sp.installment': '거래 제안 쿨다운 +[s:2]. 같은 적과 거래할 때마다 [g:weak] [pp:0.1] 누적 (최대 [p:0.6], 전투 동안 유지).',
      'sp.subcon': '경호원을 데려오지 않음. 경호 계약 보호막 ([shield:1.5])을 무작위 아군 2명에게.',
    },
  },
  falcon: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: { k: 'line' },
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys]`],
        ['관통', `[g:pen] [p:${p.pen}]`],
        ...opt(p.crit, '치명타', `[g:crit] 확률 [pp:${p.crit}]`),
        ...opt(p.shock, '감전', `[st:shock:2:${p.shock}]`),
      ],
    }),
    trait: '기본 공격 시 대상 방향 직선 위 다른 적에게 기본 공격 피해의 [p:0.5] 물리 피해.',
    augs: {
      charge: '레일건 피해 [dmg+:shoot:2.8:phys].',
      core: '레일건 피해 [dmg+:shoot:1.7:phys]. [g:pen] [pp:0.3].',
      arc: '레일건 적중 시 [st:shock:2].',
      turret: '[g:turret] +1기. 포탑 체력 · 방어도 +[p:0.4].',
      scope: '레일건 [g:crit] 확률 [pp:0.15]. 치명타 피해 [pp:0.6].',
    },
  },
};

/** 이 그룹에서 새로 쓰는 용어 (공용 GLOSS 에 없을 때만) */
export const GLOSS_A: Record<string, { name: string; desc: string }> = {
  reflect: { name: '반사', desc: '받은 피해의 비율만큼 공격자에게 물리 피해로 되돌림 (부가 피해 제외).' },
  cook: { name: '요리', desc: '셰프 시너지 단계에 따라 회복 · 보호막 · 버프 수치 ×1.4 / ×2.1 / ×3.5.' },
  lifesteal: { name: '흡혈', desc: '준 피해의 비율만큼 체력 회복.' },
  judge: { name: '심판', desc: '지속 동안 아군이 대상에게 준 피해의 20%를 기록하고, 끝날 때 기록만큼 고정 피해.' },
};
