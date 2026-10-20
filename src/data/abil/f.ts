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
        ...when(p.pull, ['끌어오기', '대상을 앞 [t:1]로 끌어옴 (엘리트 · 보스 제외)']),
      ],
    }),
    trait: '[g:red] [p:0.15]. 잃은 체력 [p:0.01]당 주는 피해 +[p:0.01]. 구조 신호: [s:7]마다 체력 비율이 가장 낮은 아군에게 [shield:1.2:shoot].',
    augs: {
      harpoon: '구조 작살 피해 [dmg+:shoot:2.2:elec].',
      rescue: '구조 작살 보호막 [shield+:1.5:shoot].',
      storm: '구조 작살 범위: 대상 주변 [t:1]. 피해 [dmg+:shoot:0.3:elec].',
      scar: '생명력 +9, 방어력 +6.',
      valhalla: '전투당 1회, 쓰러질 피해를 받으면 체력 [p:0.4]로 버티고 [s:4] 동안 [g:red] [p:0.5].',
      'sp.first': '전투당 1회, 다른 아군이 쓰러질 피해를 받으면 그 아군은 체력 1로 버틴다. 대신 자신이 최대 체력 [p:0.2]의 고정 피해를 받는다.',
      'sp.thunder': '기본 공격 적중 시 [st:shock:1:0.3].',
      'sp.song': '전투 시작 시 모든 아군 [s:8] 동안 피해 +[p:0.2].',
      'sp.pull': '구조 작살이 대상을 앞 [t:1]로 끌어옴 (엘리트 · 보스 제외). [st:stun:2]. 작살 피해 -[p:0.3].',
      'sp.valhalla': '체력 [p:0.3] 이하일 때 [g:red] +[p:0.2] ([p:0.15] → [p:0.35], 광전사와 함께면 0 → [p:0.2]).',
      'sp.gear': '구조 신호 보호막 [p:1.2] → [p:2], 체력 비율이 가장 낮은 아군 2명.',
      'sp.berserk': '[g:red] [p:0]. 잃은 체력 1%당 주는 피해 +2%.',
      'sp.storm': '[g:shock] 상태의 적에게 주는 피해 +[p:0.3].',
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
      lily: '마지막 꽃다발 피해 [dmg+:shoot:2.6:chem].',
      thorn: '마지막 꽃다발 중독 초당 피해 [dmg+:shoot:0.8:chem].',
      bouquet: '마지막 꽃다발로 처치 시 쿨다운 [p:1] 회복.',
      apron: '기동력 +9. [g:crit] 확률 [pp:0.075].',
      requiem: '중독된 적에게 주는 피해 [pp:0.25] (총 +[p:0.5]).',
    },
  },
  fotini: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:holy]`],
        ...when(p.vuln, ['취약', `[st:vuln:5] 받는 피해 +[p:${p.vuln}]`]),
        ['시선 집중', `주 대상 [s:5] 동안 도발 계수 +${p.provPlus}`],
      ],
    }),
    trait: '전투 시작 시 모든 아군 이동 속도 +[p:0.2] (전투 동안), [s:6] 동안 피해 +[p:0.15]. 자신은 [s:4] 동안 공격 속도 +[p:0.5], 결정타 시 [s:4]로 갱신.',
    augs: {
      tour: '관광 명소 소개 범위 +[t:1]. 피해 [dmg+:shoot:0.3:holy].',
      flag: '관광 명소 소개 피해 [dmg+:shoot:1.6:holy].',
      photo: '[st:vuln:5] 받는 피해 [pp:0.3].',
      smile: '전투 시작 시 모든 아군에게 각자 최대 체력 [p:0.15] 보호막.',
      souvenir: '정신력 +9, 전투력 +6.',
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
      overtime: '야근 수당 청구 피해 [dmg+:tech:1.9:elec].',
      memo: '감전 확률 [pp:0.4], 지속 +[s:1].',
      coffee: '쿨다운 감소 속도 [pp:0.4].',
      hedge: '[g:red] [p:0.3].',
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
      panorama: '기념사진 플래시 범위 +[t:1]. 피해 [dmg+:tech:0.3:elec].',
      flash: '공포 확률 [pp:0.4].',
      lei: '전투 시작 시 모든 아군 효과 명중 [pp:0.25].',
      cocktail: '생명력 +8, 정신력 +7.',
      aloha: '기념사진 플래시 피해 [dmg+:tech:1.4:elec].',
    },
  },
  issac: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['중독', `[st:poison:4:0.9] 초당 [dmg:strike:${p.poison}:chem]`],
      ],
    }),
    trait: '초당 최대 체력 [p:0.005] 회복. 화학 [g:red] [p:0.3]. 전투 스킬 사용 시 자신에게 최대 체력 [p:0.15] 보호막.',
    augs: {
      unwrap: '붕대 해제 피해 [dmg+:strike:1.8:chem], 범위 +[t:1].',
      ooze: '붕대 해제 중독 초당 피해 [dmg+:strike:0.6:chem].',
      suit: '붕대 해제 보호막 최대 체력 [pp:0.3].',
      mass: '생명력 +10, 방어력 +5.',
      manners: '효과 저항 [pp:0.25], [g:red] [p:0.08].',
    },
  },
  eden: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['강화 해제', `맞은 적마다 [p:${p.strip}] 확률로 이로운 효과 ${p.stripN}종 제거`],
        ...when(p.vuln, ['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`]),
      ],
    }),
    trait: '체력 [p:0.5] 이하일 때 주는 피해 +[p:0.2]. 처음 체력 [p:0.5] 이하가 되면 회피 [pp:0.1] (전투 동안).',
    augs: {
      dirty: '뒷골목 수법 피해 [dmg+:shoot:1.4:chem].',
      knife: '이로운 효과 제거 확률 [pp:0.35], 한 번에 2종까지 제거.',
      run: '기동력 +12, 생명력 +3.',
      grudge: '[st:vuln:4] 받는 피해 [pp:0.3].',
      luck: '[g:crit] 확률 [pp:0.15], 치명타 피해 [pp:0.6].',
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
      glow: '감전 확률 [pp:0.4], 지속 +[s:1].',
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
        ...when(p.red, ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`]),
        ['요리', '[g:cook] 배율이 모든 효과에 적용'],
      ],
    }),
    trait: '요리받은 아군 스킬 쿨다운 -[s:2]. 스킬은 [g:tac]으로 계산.',
    augs: {
      double: '네온 칵테일 피해 증가 [pp:0.35].',
      neon: '네온 칵테일 공격 속도 증가 [pp:0.35], 지속 +[s:2].',
      mask: '네온 칵테일 회복 [heal+:0.8], 피해 증가 [pp:0.15].',
      board: '정신력 +10, 방어력 +5.',
      vip: '쿨다운 감소 속도 [pp:0.4].',
      'sp.bar': '네온 칵테일 대상 +1명.',
      'sp.contract': '요리받은 아군 [g:red] [p:0.2] (버프 지속 동안).',
      'sp.yukata': '전투 시작 시 호이슌 · 스텔라레이서 아군 피해 +[p:0.2] (전투 동안).',
      'sp.vip': '요리 버프 지속 [s:6] → [s:10].',
      'sp.special': '요리받은 아군이 [s:6] 동안 기술 피해의 [p:0.15] 흡혈.',
      'sp.after': '요리받은 아군이 적을 처치하면 요리 버프 지속이 처음으로 갱신.',
      'sp.bomb': '네온 칵테일에 폭탄이 딸려 나감: 요리를 낸 뒤 체력이 가장 높은 적에게 [dmg:tech:1.5:elec] + [st:shock:1.5]. 요리 쿨다운 +[s:2] (요리 증강은 그대로).',
      'sp.regular': '같은 아군에게 연속으로 요리하면 효과 +[p:0.2] 누적 (최대 3회).',
    },
  },
  skadi: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:elec${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
    }),
    trait: '전투 시작 시 공명 등급이 가장 낮은 다른 아군 1명에게 피해 +[p:0.3], [g:red] [p:0.15] (전투 동안). 전투 스킬 사용 시 자신에게 최대 체력 [p:0.12] 보호막.',
    augs: {
      q4: '분기 실적 보고 피해 [dmg+:strike:2:elec].',
      audit: '분기 실적 보고 기절 +[s:1], 범위 +[t:1].',
      bonus: '분기 실적 보고 보호막 최대 체력 [pp:0.3].',
      mentor: '인재 육성 대상 피해 [pp:0.3].',
      career: '생명력 +8, 전투력 +7.',
    },
  },
  mingki: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...secondRow(p),
      ],
    }),
    trait: '체력이 처음 [p:0.5] 이하가 되면 [g:monster] 발동. 전투 스킬 사용 후 츄르 간식: 자신 최대 체력 [p:0.05] 회복.',
    augs: {
      nebula: '츄르 사냥 피해 [dmg+:strike:1.8:phys].',
      hungry: '처음 피해를 받으면 바로 [g:monster] 발동.',
      nine: '[g:rewind].',
      groom: '회피 [pp:0.075], 효과 저항 [pp:0.25].',
      double: '츄르 사냥 타수 +1 (두 번째도 [p:1] 피해).',
      'sp.awake': '전투 시작부터 [g:monster] 발동. 대신 체력 [p:0.1] 초과일 때 초당 최대 체력 [p:0.02]의 고정 피해를 받는다.',
      'sp.master': '전투 시작 시 엘베스타드 아군 피해 +[p:0.1] (전투 동안).',
      'sp.full': '츄르 사냥 쿨다운 -[s:2], 츄르 간식 회복 최대 체력 [pp:0.075].',
      'sp.appetite': '[g:monster] 중 처치 시 최대 체력 [p:0.1] 회복, 피해 +[p:0.1] 누적 (최대 +[p:0.5]).',
      'sp.purr': '[g:monster]이 깨어날 때 주변 [t:2] 적 [st:fear:1.5].',
      'sp.liquid': '회피 [pp:0.1]. [g:monster] 중 추가 [pp:0.15].',
      'sp.second': '체력이 처음 [p:0.2] 이하가 되면 2단 각성: 피해 +[p:0.5], 흡혈 [p:0.2].',
      'sp.tame': '[g:monster]이 수호 각성으로 바뀜 (피해 +[p:0.8] 대신 받는 피해 -[p:0.25], 공격 속도는 그대로). 츄르 사냥이 그르릉으로 바뀜: 적에게 뛰어드는 대신 다른 모든 아군 각자 최대 체력 [p:0.06] 회복, 자신 포함 모든 아군 [s:3] 동안 각자 최대 체력 [p:0.1] 보호막 (피해 없음).',
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
    trait: '[g:reason]이 낮을수록 주는 [g:psy] 증가 ([g:reason] -100에서 최대 +[p:0.3]).',
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
        ...when(p.resetOnKill, ['처치', `처치 시 쿨다운 [p:${p.resetOnKill}] 회복`]),
      ],
    }),
    trait: '[g:finish] · 전투 스킬 · 궁극기로 준 피해의 [p:0.35] 회복.',
    augs: {
      vein: '혈검 피해 [dmg+:strike:2.2:phys].',
      thirst: '혈검 흡혈 [pp:0.25]. 모든 피해 흡혈 [pp:0.15].',
      waltz: '혈검으로 처치 시 쿨다운 [p:1] 회복.',
      title: '작위 +3.',
      dusk: '회피 [pp:0.075], [g:crit] 확률 [pp:0.1], 치명타 피해 [pp:0.35].',
    },
  },
  thermo: {
    skill: (p) => ({
      tgt: '자신 주변 아군', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
      ],
    }),
    trait: '자신과 주변 [t:1] 아군 [g:red] [p:0.1].',
    augs: {
      wide: '팔랑크스 범위 +[t:1], [shield:0.4] 추가.',
      bronze: '팔랑크스 [shield:1.4] 추가.',
      hold: '팔랑크스 [g:red] [pp:0.1], 지속 +[s:3].',
      core: '방어력 +10, 생명력 +5.',
      last: '체력 [p:0.5] 이하일 때 [g:red] [p:0.45].',
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
      catwheel: '[g:red] [p:0.3].',
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
      aim: '사거리 +[t:1]. [g:crit] 확률 [pp:0.1], 치명타 피해 [pp:0.35].',
    },
  },
  petrock: {
    skill: () => ({ tgt: '없음', range: null, area: { k: 'one' }, rows: [['효과', '아무것도 하지 않는다.']] }),
    trait: '공격 · 이동 · 기술 없이 칸만 차지한다. 적의 표적이 되지 않고 승패 판정에도 세지 않는다. 시너지 · 공명 등급 성장 · 장비 칸이 없다.',
  },
};

/** 이 그룹에서 새로 쓰는 용어 (공용 GLOSS 에 없을 때만) */
export const GLOSS_F: Record<string, { name: string; desc: string }> = {
  cook: { name: '요리', desc: '셰프의 전투 스킬. 셰프 시너지 단계에 따라 회복 · 보호막 · 버프 효과가 배율로 커짐.' },
  viewer: { name: '시청자', desc: '레이카 0호의 중첩 수치. 1명당 기술 피해 +3%.' },
  monster: { name: '내면의 괴물', desc: '밍키의 각성 상태. 전투 동안 피해 +80%, 공격 속도 +50%.' },
  buddy: { name: '단짝 소환물', desc: '최고의 친구 시너지로 전투 시작 시 소환됨. 주인 스탯 일부를 물려받음.' },
  reason: { name: '이성', desc: '사이오닉 수치 (-100 ~ 100). 0 미만이면 주는 정신 피해 증가, 0 초과면 받는 정신 · 신성 피해량 경감.' },
};
