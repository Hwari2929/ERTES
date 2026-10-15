// 능력 설명 (통일 형식) — 그룹 b
import type { AbilText, Area } from '../abiltext';

type Row = [string, string];
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');
const cntTxt = (n: number) => (n > 1 ? ` ${n}명` : '');

export const ABIL_B: Record<string, AbilText> = {
  hiiro: {
    skill: (p) => ({
      tgt: `가장 강한 아군${cntTxt(p.count)}`, range: null, area: { k: 'one' },
      rows: [
        ['길', `[s:${p.dur}] 동안 피해 +[p:${p.dmg}], 공격 속도 +[p:${p.as}]`],
        ['흉', `[s:${p.dur}] 동안 피해 +[p:${p.dmg * 0.3}]`],
        ['길 확률', `[p:${p.luck}] (이성 50 기준, 이성 1당 [pp:0.0025])`],
        ['이성', '길 +10, 흉 -10'],
      ],
    }),
    trait: '전투 시작 시 [p:0.5] + 이성 1당 [pp:0.005] 확률 (최대 [p:0.95])로 길: 모든 아군 [s:12] 동안 피해 +[p:0.12]. 아니면 흉: 모든 아군 [s:6] 동안 받는 피해 +[p:0.08]. 길이면 이성 +10, 흉이면 이성 -10. 기본 공격 적중 시 [p:0.1] 확률로 환술: 대상 [st:fear:2] ([s:3]에 1회).',
    augs: {
      second: '점괘 대상 +1명.',
      daegil: '길 확률 [pp:0.3]. 점괘 피해 증가 [pp:0.3].',
      linger: '점괘 지속 +[s:3]. 피해 증가 [pp:0.25], 공격 속도 증가 [pp:0.15].',
      nine: '정신력 +9. 회피 [pp:0.075].',
      sns: '전투 승리 시 명성 +2. 공포 확률 [pp:0.2].',
    },
  },
  nadir: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy] (회피 불가)`],
        ['명중', `[s:3] 동안 명중 [pp:${-p.blind}]`],
        ...(p.vuln ? [['취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`] as Row] : []),
      ],
    }),
    trait: '기본 공격 적중 시 대상 주변 [t:2]의 가장 가까운 다른 적 1명에게 [dmg:tech:0.5:psy].',
    augs: {
      flare: '백수정 섬광 범위 +[t:1]. 피해 [dmg+:tech:0.3:psy].',
      focus: '백수정 섬광 피해 [dmg+:tech:1.4:psy].',
      glare: '명중 감소 [pp:0.2]. 맞은 적에게 [st:vuln:4]: 받는 피해 +[p:0.2].',
      camo: '회피 [pp:0.075]. 전투 시작 후 [s:6] 동안 회피 [pp:0.2].',
      pocket: '정신력 +10, 전투력 +5.',
    },
  },
  kairo: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: { k: 'one' },
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ['버프', `[s:${p.dur}] 동안 치명타 확률 [pp:${p.crit}]`],
        ['배율', '[g:cook] 배율 적용'],
        ...(p.need < 999 ? [['스택', `[g:wait] +1 (${p.need}스택이면 특성이 저격)`] as Row] : []),
      ],
    }),
    trait: '칵테일 1잔 또는 다른 아군 기본 공격 12회마다 (소환물 제외) [g:wait] +1, 전투 시작 시 2스택. 8스택이면 별도 행동으로 체력이 가장 높은 적에게 [dmg:shoot:8:phys] 저격 (회피 불가, [g:crit] 확률 [pp:0.15]) 후 스택 초기화.',
    augs: {
      patience: '저격에 필요한 스택 -2.',
      record: '저격 피해 [dmg+:shoot:8:phys].',
      pendant: '저격 후 2스택 유지. 저격 피해 [dmg+:shoot:4:phys].',
      andante: '저격 [g:crit] 확률 [pp:0.2]. 치명타 피해 [pp:0.6].',
      eden: '칵테일: [shield:1.2] 추가.',
      'sp.cocktail': '칵테일 쿨다운 ×0.5. 저격을 하지 않음.',
      'sp.kilo': '자신의 기본 공격 2회 적중마다 [g:wait] +1.',
      'sp.andante': '[g:mag] 1발. 기본 공격 피해 ×4.',
      'sp.lastorder': '저격 후 대상 체력이 [p:0.25] 이하이면 즉시 처형.',
      'sp.double': '저격이 두 번째로 체력이 높은 적에게도 [p:0.5] 피해.',
      'sp.signature': '칵테일 보호막 대신 대상 기술 쿨다운 -[s:1.5], [g:crit] 확률 [pp:0.15].',
      'sp.patience': '저격에 [g:wait] 12스택 필요. 저격 피해 ×2, 방어도 무시.',
      'sp.regular': '전투 시작 시 칼리토 아군 1명당 [g:wait] +1.',
    },
  },
  zahara: {
    skill: (p) => ({
      tgt: `가장 강한 아군${cntTxt(p.count)}`, range: null, area: { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['버프', `[s:${p.dur}] 동안 피해 +[p:${p.dmg}]${p.as ? `, 공격 속도 +[p:${p.as}]` : ''}`],
        ['배율', '[g:cook] 배율 적용'],
      ],
    }),
    trait: '피해를 받으면 (지속 피해 제외) 공격자에게 [dmg:strike:1.5:phys] 반격. 주변 [t:1] 아군이 피해를 받으면 [p:0.5] 확률로 반격. 반격은 [s:0.4]에 1회.',
    augs: {
      tteok: '사라진 레시피 재현 피해 증가 [pp:0.45].',
      spice: '사라진 레시피 재현 회복 [heal+:1.2].',
      tea: '사라진 레시피 재현 대상 공격 속도 +[p:0.4].',
      market: '사라진 레시피 재현 대상 +1명.',
      camera: '전투 승리 시 명성 +2. 사라진 레시피 재현 피해 증가 [pp:0.25].',
    },
  },
  bianca: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ...(p.heal ? [['회복', `[heal:${p.heal}]`] as Row] : []),
        ...(p.shield ? [['보호막', `[shield:${p.shield}]`] as Row] : []),
        ...(p.cleanse ? [['정화', '[g:cleanse]'] as Row] : []),
        ...(p.red ? [['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`] as Row] : []),
        ['베헤모스', `[g:behemoth] [s:4] 동안 피해 +[p:${p.petDmg}]`],
        ...(p.splash ? [['주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'] as Row] : []),
      ],
    }),
    trait: '적이 쓰러질 때 [p:0.3] 확률로 유전 물질 1개 수집 (런 누적). 10 / 30 / 60개: [g:behemoth] [g:bond] [pp:0.1] / [pp:0.25] / [pp:0.45], 피해 +[p:0.1] / [p:0.25] / [p:0.5].',
    augs: {
      hands: '치유 탄환 회복 [heal+:1.8].',
      carapace: '[g:behemoth] [g:bond] [pp:0.25], 방어도 +250.',
      pheromone: '치유 탄환: [shield:1.8] 추가.',
      scalpel: '공격 속도 [pp:0.25], 치명타 확률 [pp:0.1], 치명타 피해 [pp:0.35].',
      wash: '치유 탄환 대상 [g:cleanse]. [g:red] [p:0.3] ([s:4]).',
      'sp.unleash': '[g:behemoth] [g:bond] [pp:0.6], 피해 +[p:0.5]. 기본 공격을 하지 않음.',
      'sp.drone': '치유 탄환이 대상 주변 [t:1] 아군에게도 [p:0.5] 효과.',
      'sp.cold': '치유 탄환 회복이 보호막으로 바뀜 (양 ×1.5).',
      'sp.genes': '유전 물질 수집 확률 [p:0.3] → [p:0.5].',
      'sp.symbiosis': '[g:behemoth]가 준 피해의 [p:0.15]만큼 체력 비율이 가장 낮은 아군 회복.',
      'sp.regen': '전투당 1회, [g:behemoth]가 쓰러질 피해를 받으면 체력 [p:0.5]로 재기동.',
      'sp.serum': '치유 탄환 대상 [s:4] 동안 피해 +[p:0.2].',
      'sp.sample': '[g:behemoth]를 부르지 않음. 유전 물질 단계 피해 보너스를 자신이 얻고, 치유 탄환 대상 [s:4] 동안 피해 +[p:0.4] + 단계 피해 보너스.',
    },
  },
  zephyro: {
    skill: (p) => ({
      tgt: '자신 주변 아군', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
        ['회피', `[pp:${p.eva}] ([s:${p.dur}])`],
      ],
    }),
    trait: '기본 공격 시 대상과 가장 가까운, 사거리 안의 다른 적 1명에게도 기본 공격 피해. 모든 아군 치명타 확률 [pp:0.1].',
    ace: (k) => `전투 시작 시 모든 아군 [g:red] [p:${0.08 * k}].`,
    augs: {
      sail: '돛 방향 틀기 범위 +[t:1]. [g:red] [pp:0.06].',
      athena: '돛 방향 틀기 [g:red] [pp:0.2].',
      detour: '돛 방향 틀기 회피 [pp:0.125].',
      nap: '돛 방향 틀기 지속 +[s:3]. [g:red] [pp:0.1], 회피 [pp:0.025].',
      pen: '사거리 +[t:1]. 공격 속도 [pp:0.25].',
    },
  },
  phyllis: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:holy${hitsTxt(p.hits)}]`],
        ['이동', '대상 옆으로 순간이동'],
        ...(p.resetOnKill ? [['처치', `쿨다운 [p:${p.resetOnKill}] 회복`] as Row] : []),
      ],
    }),
    trait: '회피 [pp:0.05]. 회피 시 공격자에게 [dmg:strike:1:holy] 반격 후 무작위 적 옆으로 순간이동 ([s:0.5]에 1회). 물자 전송: [s:6]마다 체력 비율이 가장 낮은 아군에게 [shield:1].',
    augs: {
      rush: '균열 도약 타수 +1 (두 번째도 [p:1] 피해).',
      supply: '균열 도약 보호막: [shield:0.8] 추가.',
      slack: '균열 도약으로 처치 시 쿨다운 [p:1] 회복.',
      tail: '회피 [pp:0.075]. 방어력 +9.',
      prayers: '전투 승리 시 권능 포인트 +1. 균열 도약 피해 [dmg+:tech:1.3:holy].',
      'sp.mail': '전투 시작 시 첫 번째 장비 효과를 무작위 아군 1명에게도 적용.',
      'sp.slack': '전투 시작 시 자신 [st:stun:3]. 피해 +[p:0.6].',
      'sp.chain': '처치 시 사거리 안에서 체력 비율이 가장 낮은 적 옆으로 순간이동하고 즉시 기본 공격.',
      'sp.hades': '물자 전송 보호막 ×1.6, 보호막을 받은 아군의 해로운 효과 1개 제거.',
      'sp.rift': '균열 도약으로 떠난 자리 주변 [t:1]에 [s:2] 동안 균열: 지나는 적에게 [dmg:tech:0.4:holy] (균열마다 1회).',
      'sp.dodge': '회피 [pp:0.1]. 균열 회피 반격 [dmg:strike:1.5:holy].',
      'sp.supply': '전투 시작 시 모든 아군 [shield:0.6].',
      'sp.underworld': '균열 도약이 가장 뒤에 있는 아군 곁으로 순간이동해 자신과 주변 [t:1] 아군에게 [shield:1] (물자 전송 보호막 수치). 피해 없음.',
    },
  },
  eleni: {
    skill: (p) => ({
      tgt: '자신과 주변 아군', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['보호막', `자신과 주변 [t:${p.radius || 1}] 아군에게 [shield:${p.shield}]`],
        ['회복', `[heal:${p.heal}]`],
        ...(p.armor ? [['방어도', `[s:4] 동안 방어도 +${p.armor}`] as Row] : []),
      ],
    }),
    trait: '주변 [t:2] 아군 매초 최대 체력 [p:0.01] 회복. [g:finish] 적중 시 달빛 베기: 주변 [t:1] 적 모두에게 [dmg:strike:0.5:phys].',
    augs: {
      baklava: '달빛 진혼 보호막: [shield:1] 추가.',
      harp: '달빛 진혼 회복 [heal+:0.5].',
      lighthouse: '달빛 진혼 범위 +[t:1]. 피해 [dmg+:strike:0.3:phys].',
      moon: '달빛 진혼 대상 아군 [s:4] 동안 방어도 +400.',
      blade: '달빛 진혼 피해 [dmg+:strike:1.2:phys].',
    },
  },
  iris: {
    skill: (p) => ({
      tgt: `피해 기여가 가장 큰 아군${cntTxt(p.count)}`, range: null, area: { k: 'one' },
      rows: [
        ['버프', `[s:${p.dur}] 동안 공격 속도 +[p:${p.as}]`],
      ],
    }),
    trait: '모든 아군 이동 속도 · 공격 속도 [pp:0.25]. 날개 단검 6번째 적중마다 인지 교란: 대상에게 [dmg:tech:1.2:holy] (회피 불가) + [st:fear:1.5:0.5].',
    augs: {
      kerykeion: '헤르메스의 가속 대상 +1명.',
      blessing: '헤르메스의 가속 공격 속도 증가 [pp:0.35].',
      goods: '전투 승리 시 크레딧 +3. 헤르메스의 가속 피해 [dmg+:tech:0.7:holy].',
      sparta: '회피 [pp:0.075]. 기동력 +9.',
      praise: '전투 승리 시 권능 포인트 +1. 공포 확률 [pp:0.2].',
    },
  },
  odysseus: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['치명타', `[g:crit] 확률 [pp:${p.crit}]`],
        ...(p.bleed ? [['출혈', `[st:bleed:4] 초당 [dmg:shoot:${p.bleed}:phys]`] as Row] : []),
        ...(p.resetOnKill ? [['처치', `쿨다운 [p:${p.resetOnKill}] 회복`] as Row] : []),
      ],
    }),
    trait: '기본 공격은 사거리 안에서 체력 비율이 가장 낮은 적을 노림. 치명타 확률 [pp:0.25].',
    augs: {
      twin: '귀환의 화살 타수 +1 (두 번째도 [p:1] 피해).',
      hunt: '귀환의 화살로 처치 시 쿨다운 [p:1] 회복.',
      bow: '귀환의 화살 [g:crit] 확률 [pp:0.15]. 치명타 피해 [pp:0.6].',
      barb: '맞은 적에게 [st:bleed:4]: 초당 [dmg:shoot:0.5:phys].',
      horse: '회피 [pp:0.075]. 전투 시작 후 [s:6] 동안 회피 [pp:0.25].',
    },
  },
  argon: {
    skill: (p) => ({
      tgt: '무작위 적 (발마다)', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:chem${hitsTxt(p.shots)}]`],
        ...(p.crit ? [['치명타', `[g:crit] 확률 [pp:${p.crit}]`] as Row] : []),
        ...(p.shock ? [['감전', `적중 시 [st:shock:1.5:${p.shock}]`] as Row] : []),
      ],
    }),
    trait: '다른 기물이 거는 강화 효과를 받지 않음 (회복 · 보호막은 받음). 효과 저항 [pp:0.4].',
    ace: (k) => `피해 +[p:${0.25 * k}], 치명타 확률 [pp:${0.075 * k}].`,
    augs: {
      ammo: '망령권 작살 +3발.',
      caliber: '망령권 작살 발당 피해 [dmg+:shoot:0.6:chem].',
      tracer: '망령권 작살 적중 시 [st:shock:1.5:0.4].',
      roll: '회피 [pp:0.075]. 기동력 +9.',
      gunsight: '망령권 작살 [g:crit] 확률 [pp:0.15]. 치명타 피해 [pp:0.6].',
    },
  },
};

/** 이 그룹에서 새로 쓰는 용어 (공용 GLOSS 에 없을 때만) */
export const GLOSS_B: Record<string, { name: string; desc: string }> = {
  cook: { name: '요리', desc: '셰프의 전투 스킬. 셰프 시너지 단계에 따라 효과 ×1.4 / ×2.1 / ×3.5.' },
  wait: { name: '기다림의 미학', desc: '스택이 정해진 수에 이르면 체력이 가장 높은 적을 저격하고 스택이 초기화됨.' },
  behemoth: { name: '베헤모스', desc: '전투 시작 시 소환되는 근접 단짝. 비앙카 스탯을 상속률만큼 물려받음.' },
  bond: { name: '상속률', desc: '소환물이 주인 스탯을 물려받는 비율.' },
};
