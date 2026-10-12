// 능력 설명 (통일 형식) — 그룹 f
import type { AbilText, Area } from '../abiltext';

type Row = [string, string];
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');
/** 다타 스킬: 두 번째 타부터 피해 배율 */
const secondRow = (p: Record<string, number>): Row[] => (p.hits > 1 && p.second !== 1 ? [['연타', `두 번째 타부터 [p:${p.second}] 피해`]] : []);
const when = (c: unknown, r: Row): Row[] => (c ? [r] : []);

export const ABIL_F: Record<string, AbilText> = {
  bjorn: {
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:elec]`],
        ['기절', `[st:stun:${p.stun}]`],
        ['보호막', `체력 비율이 가장 낮은 아군에게 [shield:${p.rescue}:shoot]`],
      ],
    }),
    trait: '받는 피해 -[p:0.15]. 잃은 체력 [p:0.01]당 주는 피해 +[p:0.01].',
    augs: {
      harpoon: '구조 작살 피해 [dmg+:shoot:2:elec].',
      rescue: '구조 작살 보호막 [shield+:1.5:shoot].',
      storm: '구조 작살 범위: 대상 주변 [t:1].',
      scar: '생명력 +8, 방어력 +6.',
      valhalla: '전투당 1회, 쓰러질 피해를 받으면 체력 [p:0.4]로 버티고 [s:4] 동안 받는 피해 -[p:0.5].',
      'sp.first': '전투당 1회, 다른 아군이 쓰러질 피해를 받으면 그 아군은 체력 1로 버틴다. 대신 자신이 최대 체력 [p:0.2]의 고정 피해를 받는다.',
      'sp.thunder': '기본 공격 적중 시 [st:shock:1:0.3].',
      'sp.song': '전투 시작 시 모든 아군 [s:8] 동안 피해 +[p:0.2].',
    },
  },
  zina: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['중독', `[st:poison:4:0.9] 초당 [dmg:shoot:${p.poison}:chem]`],
        ...when(p.resetOnKill, ['처치', `처치 시 쿨다운 [p:${p.resetOnKill}] 회복`]),
      ],
    }),
    trait: '기본 공격 적중 시 [st:poison:4]: 초당 [dmg:shoot:0.2:chem]. 중독된 적에게 주는 피해 +[p:0.25].',
    augs: {
      lily: '마지막 꽃다발 피해 [dmg+:shoot:1.8:chem].',
      thorn: '마지막 꽃다발 중독 초당 피해 [dmg+:shoot:0.8:chem].',
      bouquet: '마지막 꽃다발로 처치 시 쿨다운 [p:1] 회복.',
      apron: '기동력 +6. [g:crit] 확률 [pp:0.15].',
      requiem: '중독된 적에게 주는 피해 [pp:0.25] (총 +[p:0.5]).',
    },
  },
  fotini: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:holy]`],
        ...when(p.vuln, ['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`]),
      ],
    }),
    trait: '전투 시작 시 모든 아군 이동 속도 +[p:0.2] (전투 동안), [s:6] 동안 피해 +[p:0.15].',
    augs: {
      tour: '관광 명소 소개 범위 +[t:1].',
      flag: '관광 명소 소개 피해 [dmg+:shoot:1.5:holy].',
      photo: '[st:vuln:4] 받는 피해 [pp:0.2].',
      smile: '전투 시작 시 모든 아군에게 각자 최대 체력 [p:0.1] 보호막.',
      souvenir: '정신력 +6, 전투력 +4.',
    },
  },
  kaburaya: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:elec]`],
        ['감전', `[st:shock:${p.shock}:${Math.min(1, p.shockChance || 0.7)}]`],
      ],
    }),
    trait: '기본 공격 적중 시 [st:shock:1:0.3]. 감전된 적에게 주는 피해 +[p:0.25]. 스킬은 [g:tac]으로 계산.',
    augs: {
      overtime: '야근 수당 청구 피해 [dmg+:tech:1.6:elec].',
      memo: '감전 확률 [pp:0.2], 지속 +[s:1].',
      coffee: '쿨다운 감소 속도 [pp:0.35].',
      hedge: '받는 피해 -[p:0.15].',
      bored: '감전된 적에게 주는 피해 [pp:0.25] (총 +[p:0.5]).',
    },
  },
  bill: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:elec]`],
        ['공포', `[st:fear:${p.fear}:${Math.min(1, p.fearChance || 0.5)}]`],
      ],
    }),
    trait: '기본 공격 적중 시 [st:slow:3:0.25]: 공격 · 이동 속도 -[p:0.25]. 해로운 효과가 걸린 적에게 주는 피해 +[p:0.1].',
    augs: {
      panorama: '기념사진 플래시 범위 +[t:1].',
      flash: '공포 확률 [pp:0.3].',
      lei: '전투 시작 시 모든 아군 효과 명중 [pp:0.1].',
      cocktail: '생명력 +6, 정신력 +6.',
      aloha: '기념사진 플래시 피해 [dmg+:tech:1.4:elec].',
    },
  },
  issac: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['중독', `[st:poison:4:0.9] 초당 [dmg:strike:${p.poison}:chem]`],
        ...when(p.selfShield, ['보호막', `자신에게 최대 체력 [p:${p.selfShield}] 보호막`]),
      ],
    }),
    trait: '초당 최대 체력 [p:0.01] 회복. 받는 화학 피해 -[p:0.3].',
    augs: {
      unwrap: '붕대 해제 피해 [dmg+:strike:1.6:chem], 범위 +[t:1].',
      ooze: '붕대 해제 중독 초당 피해 [dmg+:strike:0.6:chem].',
      suit: '붕대 해제 보호막 최대 체력 [pp:0.25].',
      mass: '생명력 +10, 방어력 +4.',
      manners: '[g:buddy] 스탯 상속 [pp:0.3].',
    },
  },
  eden: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['출혈', `[st:bleed:4] 초당 [dmg:shoot:${p.bleed}:phys]`],
        ...when(p.vuln, ['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`]),
      ],
    }),
    trait: '체력 [p:0.5] 이하일 때 주는 피해 +[p:0.2]. 처음 체력 [p:0.5] 이하가 되면 회피 [pp:0.2] (전투 동안).',
    augs: {
      dirty: '뒷골목 수법 피해 [dmg+:shoot:1.7:phys].',
      knife: '뒷골목 수법 출혈 초당 피해 [dmg+:shoot:0.7:phys].',
      run: '기동력 +8.',
      grudge: '[st:vuln:4] 받는 피해 [pp:0.2].',
      luck: '[g:crit] 확률 [pp:0.2].',
    },
  },
  reika: {
    skill: (p) => ({
      tgt: '모든 적', range: null, area: { k: 'all' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:elec] (빗나가지 않음)`],
        ['감전', `[st:shock:${p.shock}:${Math.min(1, p.shockChance)}]`],
        ...when(p.encore, ['앙코르', `같은 효과를 [p:${p.encore}] 위력으로 한 번 더`]),
      ],
    }),
    trait: '자신 또는 아군이 전투 스킬을 쓸 때마다 [g:viewer] +1 (최대 30). 시청자 1명당 기술 피해 +[p:0.03]. 스킬은 [g:tac]으로 계산.',
    augs: {
      encore: '라이브 피날레를 [p:0.6] 위력으로 한 번 더 사용.',
      bass: '라이브 피날레 피해 [dmg+:tech:0.9:elec].',
      glow: '감전 확률 [pp:0.3].',
      superchat: '[g:viewer] 최대치 +20.',
      collab: '전투 시작 시 [g:viewer] +10.',
    },
  },
  mao: {
    skill: (p) => ({
      tgt: (p.count || 1) > 1 ? `피해 기여가 가장 큰 아군 ${p.count}명` : '피해 기여가 가장 큰 아군', range: null, area: { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['버프', `[s:${p.dur}] 동안 피해 +[p:${p.dmg}], 공격 속도 +[p:${p.as}]`],
        ...when(p.red, ['피해 감소', `[g:red] -[p:${p.red}] ([s:${p.dur}])`]),
        ['요리', '[g:cook] 배율이 모든 효과에 적용'],
      ],
    }),
    trait: '요리받은 아군 스킬 쿨다운 -[s:2]. 스킬은 [g:tac]으로 계산.',
    augs: {
      double: '네온 칵테일 피해 증가 [pp:0.35].',
      neon: '네온 칵테일 공격 속도 증가 [pp:0.25], 지속 +[s:2].',
      mask: '네온 칵테일 회복 [heal+:1].',
      board: '정신력 +8, 방어력 +4.',
      vip: '쿨다운 감소 속도 [pp:0.4].',
      'sp.bar': '네온 칵테일 대상 +1명.',
      'sp.contract': '요리받은 아군 [g:red] -[p:0.2] (버프 지속 동안).',
      'sp.yukata': '전투 시작 시 호이슌 · 스텔라레이서 아군 피해 +[p:0.2] (전투 동안).',
    },
  },
  skadi: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:elec${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
        ...when(p.selfShield, ['보호막', `자신에게 최대 체력 [p:${p.selfShield}] 보호막`]),
      ],
    }),
    trait: '전투 시작 시 공명 등급이 가장 낮은 다른 아군 1명에게 피해 +[p:0.3], 받는 피해 -[p:0.15] (전투 동안).',
    augs: {
      q4: '분기 실적 보고 피해 [dmg+:strike:1.7:elec].',
      audit: '분기 실적 보고 기절 +[s:0.7], 범위 +[t:1].',
      bonus: '분기 실적 보고 보호막 최대 체력 [pp:0.25].',
      mentor: '인재 육성 대상 피해 [pp:0.3].',
      career: '생명력 +6, 전투력 +6.',
    },
  },
  mingki: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...secondRow(p),
        ['회복', `자신 최대 체력 [p:${p.heal}] 회복`],
      ],
    }),
    trait: '체력이 처음 [p:0.5] 이하가 되면 [g:monster] 발동.',
    augs: {
      nebula: '츄르 사냥 피해 [dmg+:strike:1.8:phys].',
      hungry: '처음 피해를 받으면 바로 [g:monster] 발동.',
      nine: '[g:rewind].',
      groom: '회피 [pp:0.15], 효과 저항 [pp:0.25].',
      double: '츄르 사냥 타수 +1 (두 번째도 [p:1] 피해).',
      'sp.awake': '전투 시작부터 [g:monster] 발동. 대신 체력 [p:0.1] 초과일 때 초당 최대 체력 [p:0.02]의 고정 피해를 받는다.',
      'sp.master': '전투 시작 시 엘베스타드 아군 피해 +[p:0.1] (전투 동안).',
      'sp.full': '츄르 사냥 쿨다운 -[s:2], 회복 최대 체력 [pp:0.15].',
    },
  },
  onyx: {
    skill: (p) => ({
      tgt: '모든 적', range: null, area: { k: 'all' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy] (빗나가지 않음)`],
        ['공포', `[st:fear:${p.fear}:${Math.min(1, p.fearChance)}]`],
        ...when(p.vuln, ['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`]),
      ],
    }),
    trait: '[g:reason]이 0 미만일 때 주는 [g:psy] 증폭량 +[p:0.5].',
    augs: {
      chorus: '의뢰하지 않은 꿈 피해 [dmg+:tech:0.9:psy].',
      night: '공포 확률 [pp:0.35].',
      echo: '맞은 적에게 [st:vuln:4]: 받는 피해 +[p:0.3].',
      lullaby: '스킬 사용 시 모든 아군 [heal:1].',
      swarmsong: '정신력 +10, 생명력 +5.',
    },
  },
  exile: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['출혈', `[st:bleed:4] 초당 [dmg:strike:${p.bleed}:phys]`],
        ['흡혈', `준 피해의 [p:${p.lifesteal}] 회복`],
        ...when(p.resetOnKill, ['처치', `처치 시 쿨다운 [p:${p.resetOnKill}] 회복`]),
      ],
    }),
    trait: '[g:finish]로 준 피해의 [p:0.3] 회복.',
    augs: {
      vein: '혈검 피해 [dmg+:strike:2.2:phys].',
      thirst: '혈검 흡혈 [pp:0.25]. 모든 피해 흡혈 [pp:0.15].',
      waltz: '혈검으로 처치 시 쿨다운 [p:1] 회복.',
      title: '작위 +3.',
      dusk: '회피 [pp:0.15], [g:crit] 확률 [pp:0.2], 치명타 피해 [pp:0.35].',
    },
  },
  thermo: {
    skill: (p) => ({
      tgt: '자신 주변 아군', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ['피해 감소', `[g:red] -[p:${p.red}] ([s:${p.dur}])`],
      ],
    }),
    trait: '자신과 주변 [t:1] 아군 받는 피해 -[p:0.1].',
    augs: {
      wide: '팔랑크스 범위 +[t:1], [shield:0.4] 추가.',
      bronze: '팔랑크스 [shield:1.4] 추가.',
      hold: '팔랑크스 [g:red] [pp:0.1], 지속 +[s:3].',
      core: '방어력 +10, 생명력 +5.',
      last: '체력 [p:0.5] 이하일 때 받는 피해 -[p:0.45].',
    },
  },
  u404: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...when(p.stun, ['기절', `[st:stun:${p.stun}]`]),
        ['버프', `사용할 때마다 피해 +[p:${p.growth}] (전투 동안 중첩)`],
      ],
    }),
    trait: '전투 스킬을 쓸 때마다 피해 +[p:@growth] (전투 동안 중첩).',
    augs: {
      overtime: '스킬 사용당 피해 증가 [pp:0.2].',
      press: '분기 실적 달성에 [st:stun:1.5] 추가.',
      line: '분기 실적 달성 범위 +[t:1]. 피해 [dmg+:strike:0.3:phys].',
      catwheel: '받는 피해 -[p:0.3].',
      turret: '[g:turret] +1기. 포탑 체력 · 방어도 +[p:0.4].',
    },
  },
  rus: {
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...secondRow(p),
        ['관통', `[g:pen] [p:${p.pen}]`],
      ],
    }),
    trait: '적 처치 시 크레딧 +1 (전투당 최대 3).',
    augs: {
      loot: '공격 속도 +[p:0.25]. 전투 승리 시 크레딧 +3.',
      double: '약탈 사격 타수 +1 (두 번째도 [p:1] 피해).',
      ap: '[g:pen] [pp:0.3]. 약탈 사격 피해 [dmg+:shoot:1.4:phys].',
      ship: '전투 시작 시 최대 체력 [p:0.6] 보호막.',
      aim: '사거리 +[t:1]. [g:crit] 확률 [pp:0.2], 치명타 피해 [pp:0.35].',
    },
  },
};

/** 이 그룹에서 새로 쓰는 용어 (공용 GLOSS 에 없을 때만) */
export const GLOSS_F: Record<string, { name: string; desc: string }> = {
  cook: { name: '요리', desc: '셰프의 전투 스킬. 셰프 시너지 단계에 따라 회복 · 보호막 · 버프 효과가 배율로 커짐.' },
  viewer: { name: '시청자', desc: '레이카 0호의 중첩 수치. 1명당 기술 피해 +3%.' },
  monster: { name: '내면의 괴물', desc: '밍키의 각성 상태. 전투 동안 피해 +80%, 공격 속도 +50%.' },
  buddy: { name: '단짝 소환물', desc: '최고의 친구 시너지로 전투 시작 시 소환됨. 주인 스탯 일부를 물려받음.' },
  reason: { name: '이성', desc: '사이오닉 수치 (-100 ~ 100). 0 미만이면 주는 정신 피해 증가, 0 초과면 받는 정신 · 신성 피해 감소.' },
};
