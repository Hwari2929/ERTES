// 능력 설명 (통일 형식) — 그룹 c
import type { AbilText, Area } from '../abiltext';

type Row = [string, string];
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');
/** 조건부 행 */
const opt = (on: unknown, label: string, v: string): Row[] => (on ? [[label, v]] : []);
/** 부동소수 정리 */
const n = (x: number) => Math.round(x * 1000) / 1000;

export const ABIL_C: Record<string, AbilText> = {
  // ───────── 시리우스 성도회
  romani: {
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['끌어오기', '대상을 자신 앞으로 끌어옴 (보스 · 고정 대상 제외)'],
        ['기절', `[st:stun:${p.stun}]`],
        ...opt(p.splash, '주변', `끌려온 대상 주변 [t:1] 적에게 [dmg:strike:${p.splash}:phys]`),
      ],
    }),
    trait: '기본 공격 적중 · 전투 스킬 사용 시 가장 먼 적을 바로 옆으로 끌어오고 [dmg:strike:0.5:phys] ([s:3]에 1회). 엘리트 · 보스는 끌려오지 않고 [dmg:strike:1.5:phys].',
    augs: {
      split: '집행자 투척 2회 (두 번째도 [p:1] 피해).',
      recall: '집행자 투척 피해 [dmg+:strike:1.8:phys].',
      shove: '끌려온 대상 주변 [t:1] 적에게 [dmg:strike:1.8:phys]. 집행자 투척 피해 [dmg+:strike:0.3:phys].',
      counsel: '효과 명중 [pp:0.25]. [g:stun] +[s:1].',
      uniform: '방어력 +6, 생명력 +3. 효과 저항 [pp:0.25].',
    },
  },
  joshua: {
    skill: (p) => ({
      tgt: '모든 아군', range: null, area: { k: 'all', ally: true },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ...opt(p.cleanse, '정화', '[g:cleanse]'),
        ['체사레', `자신만 [heal:${n(p.heal * 2)}]`],
      ],
    }),
    trait: '이성 -50 이하가 되면 전투 동안 체사레로 전환: 사거리 [t:1] 근접 물리 공격, 피해 [pp:0.4], 초당 최대 체력 [p:0.015] 회복. 전환할 때와 그 뒤 [s:8]마다 주변 [t:1] 적에게 [st:fear:1.5:0.6].',
    augs: {
      regen: '재생 촉진 회복 [heal+:0.7].',
      calm: '재생 촉진에 [g:cleanse] 추가. 쿨다운 감소 속도 [pp:0.25].',
      pilgrim: '체사레 피해 [pp:0.6].',
      tips: '체사레 전환 조건: 이성 -20 이하. 방어도 +250.',
      wave: '체사레 공포 확률 [pp:0.3]. 체사레 초당 회복 [pp:0.015].',
    },
  },
  sarma: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['둔화', `[st:slow:3] 공격 · 이동 속도 -[p:${p.slow}]`],
        ...opt(p.pen, '관통', `[g:pen] [p:${p.pen}]`),
        ...opt(p.stun, '기절', `[st:stun:${p.stun}]`),
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`),
      ],
    }),
    trait: '기본 공격 시 대상 주변 [t:1] 다른 적에게 기본 공격 피해의 [p:0.3] 물리 피해.',
    augs: {
      singularity: '포켓 블랙홀 범위 +[t:1]. 피해 [dmg+:shoot:0.3:phys].',
      fusion: '포켓 블랙홀 피해 [dmg+:shoot:2:phys].',
      horizon: '맞은 적에게 [st:stun:1.2].',
      thesis: '[g:pen] [p:0.5]. 맞은 적에게 [st:vuln:4]: 받는 피해 +[p:0.2].',
      sorry: '회피 [pp:0.075], 효과 저항 [pp:0.25].',
    },
  },
  kyle: {
    skill: (p) => ({
      tgt: '가장 뒤쪽 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:holy${hitsTxt(p.hits)}]`],
        ...opt(p.stun, '기절', `[st:stun:${p.stun}]`),
      ],
    }),
    trait: '신성 피해 [pp:0.2]. 전투 스킬 사용 시 자신에게 최대 체력 [p:0.2] 보호막.',
    augs: {
      smite: '맞은 적에게 [st:stun:1.2].',
      crusade: '성전 돌입 피해 [dmg+:strike:1.6:holy].',
      oath: '방어력 +6, 생명력 +3. 효과 저항 [pp:0.25].',
    },
  },
  doros: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ...opt(p.cleanse, '정화', '[g:cleanse]'),
        ['버프', `피해 +[p:${p.dmg}] ([s:${p.dur}])`],
        ...opt(p.shield, '보호막', `[shield:${p.shield}]`),
        ...opt(p.splash, '주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'),
        ['요리', '[g:cook] 배율 적용'],
      ],
    }),
    trait: '성찬을 받은 아군은 전투 동안 [g:awaken]. 이미 디바인이면 신성력 획득 [pp:1].',
    augs: {
      loaf: '성찬 회복 [heal+:1.8].',
      wine: '성찬 피해 증가 [pp:0.3].',
      share: '대상 주변 [t:1] 아군에게도 [p:0.5] 효과. 성찬 회복 [heal+:0.3].',
      crust: '성찬에 [shield:1.2] 추가.',
      grace: '쿨다운 감소 속도 [pp:0.25]. 전투 승리 시 권능 포인트 +1.',
    },
  },
  demiurgos: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: aroundOr(p.radius),
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
      ],
    }),
    trait: '회복한 아군에게 [g:red] [p:0.1] ([s:3]).',
    augs: {
      warm: '친구의 손길 회복 [heal+:2].',
      here: '[g:red] [pp:0.1]. 지속 +[s:3].',
      together: '친구의 손길 범위: 대상 주변 [t:1]. 회복 [heal+:0.3].',
      gift: '모든 메이저 스탯 +4.',
      listen: '친구의 손길 쿨다운 -[s:2].',
    },
  },

  // ───────── 범은하 공동체
  aiden: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['공포', `[st:fear:${p.fear}:${p.fearChance}]`],
        ...opt(p.resetOnKill, '처치 시', `쿨다운 [p:${p.resetOnKill}] 초기화`),
      ],
    }),
    trait: '전투 시작 시 [s:5] · 회피 시 [s:2] · 처치 시 [s:5] 동안 [g:catform].',
    ace: (k) => `회피 [pp:${n(0.075 * k)}]. 회피할 때마다 공격자에게 [dmg:strike:${n(0.8 * k)}:phys].`,
    augs: {
      claw: '액체 금속 변형 피해 [dmg+:strike:2.2:phys].',
      mirage: '액체 금속 변형 2회 (두 번째도 [p:1] 피해).',
      butcher: '액체 금속 변형으로 처치 시 쿨다운 [p:1] 초기화.',
      illusion: '공포 확률 [pp:0.4]. 공포 지속 +[s:0.5].',
      groom: '회피 [pp:0.125].',
      'sp.cat': '[g:catform] 상시 유지. 이동 속도 [pp:0.4], 최대 체력 -[p:0.3].',
      'sp.bar': '액체 금속 변형이 바텐더 근무로 바뀜: 적에게 파고드는 대신 체력 비율이 가장 낮은 아군 [heal:1.8] (피해 · 공포 없음).',
      'sp.crystal': '처치 시 자신 최대 체력 [p:0.075] 회복. [g:combo] +2.',
      'sp.nine': '전투당 1회, 쓰러질 피해를 받으면 체력 1로 버티고 [g:catform]으로 [s:3] 동안 모든 피해 회피.',
      'sp.tail': '[g:catform]일 때 기본 공격이 대상 주변 [t:1] 적에게 [p:0.5] 피해.',
      'sp.illusion': '액체 금속 변형 공포 확률 [p:0.7], 지속 [s:1.5].',
      'sp.gap': '[g:catform]이 될 때 주변 [t:2] 아군 [s:2] 동안 공격 속도 +[p:0.3].',
      'sp.human': '[g:catform]이 되지 않음. 최대 체력 +[p:0.4], 방어도 +30, 스킬 피해 +[p:0.5].',
    },
  },
  vivian: {
    skill: (p) => ({
      tgt: '현재 대상', range: null, area: { k: 'one' },
      rows: [
        ['피해', `리키가 대상 옆으로 이동해 리키 타격 위력의 [p:${p.mult}] 물리 피해`],
        ['기절', `[st:stun:${p.stun}]`],
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`),
        ['리키 없을 때', '비비안이 직접 [dmg:shoot:1.5:phys]'],
      ],
    }),
    trait: '비비안 · 리키의 기본 공격 적중 시 대상 방어도 -[p:0.1] (중첩, 최대 3, [s:5]).',
    augs: {
      trust: '리키 [g:bond] [pp:0.4].',
      pack: '동물 동료 +1 (추가 동료 [g:bond]는 기본의 [p:0.8]).',
      record: '동물 교감 대상에게 [st:vuln:4]: 받는 피해 +[p:0.3].',
      kit: '정신력 +9, 기동력 +6.',
    },
  },
  yupito: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: aroundOr(p.radius),
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ...opt(p.armor, '방어도', `방어도 +${p.armor} ([s:${p.dur}])`),
        ['포탑', `모든 [g:turret]에 [shield:${p.turretShield}]`],
      ],
    }),
    trait: '전투 시작 시 무작위 아군 1명에게 피해 [pp:0.2], 방어도 +200 (전투 동안). 공동체 · 엔지니어 아군이면 2배.',
    augs: {
      hull: '임시 에너지 장벽에 [shield:1] 추가.',
      choke: '임시 에너지 장벽 범위 +[t:1]. [shield:0.3] 추가.',
      spider: '[g:turret] 체력 · 방어도 +[p:0.6], 공격 속도 +[p:0.4].',
      kongi: '[g:turret] +1기. 포탑 체력 · 방어도 +[p:0.4].',
      trump: '장벽 대상 방어도 +400 ([s:4]).',
    },
  },
  ingel: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy${hitsTxt(p.hits)}]`],
        ['공포', `[st:fear:${p.fear}:${p.fearChance}]`],
        ...opt(p.noMiss, '명중', '빗나가지 않음'),
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[p:${p.vuln}]`),
      ],
    }),
    trait: '출전한 다른 아군 1명당 피해 [pp:0.1], 소환물 · 포탑 1기당 [pp:0.05] (전투 동안).',
    augs: {
      flight: '오늘도 최고의 무대 범위 +[t:1]. 피해 [dmg+:tech:0.3:psy].',
      nordic: '공포 확률 [pp:0.35].',
      ubermensch: '오늘도 최고의 무대 피해 [dmg+:tech:1.7:psy].',
      meursault: '맞은 적에게 [st:vuln:4]: 받는 피해 +[p:0.3].',
      deer: '쿨다운 감소 속도 [pp:0.25]. 전투 승리 시 명성 +2.',
    },
  },

  // ───────── 엘베스타드 일가
  rachel: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:psy${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
    }),
    trait: '[g:finish] 시 대상 주변 [t:1] 적에게 [dmg:strike:0.5:true]. 이 피해의 [p:0.2]만큼 보호막.',
    augs: {
      core: '염동 제압 피해 [dmg+:strike:2:psy].',
      weapon: '[g:stun] +[s:1.2].',
      lazy: '염동 제압 범위: 대상 주변 [t:1]. 피해 [dmg+:strike:0.3:psy].',
    },
  },
  oliver: {
    skill: (p) => ({
      tgt: '가장 뒤쪽 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
        ...opt(p.resetOnKill, '처치 시', `쿨다운 [p:${p.resetOnKill}] 초기화`),
      ],
    }),
    trait: '전투 시작 시 이동 속도가 100%를 넘는 만큼의 1.5배 비율로 기술 위력 증가.',
    ace: (k) => `전투 시작 시 모든 아군 공격 속도 [pp:${n(0.12 * k)}].`,
    augs: {
      bouquet: '규정 속도 경계선 피해 [dmg+:tech:1.6:phys].',
      gasoline: '규정 속도 경계선 범위 +[t:1]. 피해 [dmg+:tech:0.3:phys].',
      done: '규정 속도 경계선으로 처치 시 쿨다운 [p:1] 초기화.',
      pilot: '공격 속도 [pp:0.25], 회피 [pp:0.075].',
      kitchen: '흡혈 [pp:0.25].',
    },
  },
  rasmus: {
    skill: (p) => ({
      tgt: '현재 대상', range: null, area: { k: 'one' },
      rows: [
        ['피해', `맥스가 대상 옆으로 이동해 맥스 타격 위력의 [p:${p.mult}] 물리 피해`],
        ['출혈', `[st:bleed:4] 초당 맥스 타격 위력의 [p:${p.bleed}]`],
        ...opt(p.roar, '공포', `맥스 주변 [t:1] 적에게 [st:fear:1.2:${p.roar}]`),
        ['맥스 없을 때', '인접한 대상에게 라스무스가 직접 [dmg:strike:1.5:phys]'],
      ],
    }),
    trait: '라스무스 · 맥스의 기본 공격 적중 시 [g:wound] 1중첩 (최대 5, [s:6]).',
    augs: {
      old: '맥스 [g:bond] [pp:0.4].',
      maul: '불청객 퇴치 [g:bleed] 초당 피해 [pp:0.5] (맥스 타격 위력 기준).',
      cub: '맥스 +1 (추가 맥스 [g:bond]는 기본의 [p:0.8]).',
      lodge: '생명력 +9, 방어력 +6.',
      roar: '불청객 퇴치 시 맥스 주변 [t:1] 적에게 [st:fear:1.2:0.8].',
    },
  },
  sigmund: {
    skill: (p) => ({
      tgt: `모시는 아군 · 피해 기여가 가장 큰 아군 ${p.count}명`, range: null, area: { k: 'one' },
      rows: [
        ['버프', `피해 +[p:${p.dmg}], 공격 속도 +[p:${p.as}] ([s:${p.dur}])`],
        ...opt(p.red, '피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`),
        ['보호막', `엘베스타드 아군 전원에게 [shield:${p.famShield}]`],
      ],
    }),
    trait: '전투 시작 시 공명 등급이 가장 높은 다른 출전 아군을 모심 (집사의 보좌 우선 대상). 모시는 아군이 엘베스타드가 아니면 엘베스타드 시너지에 합류, 엘베스타드면 모든 메이저 스탯 +5.',
    augs: {
      council: '집사의 보좌 대상 +1명.',
      iron: '집사의 보좌 피해 증가 [pp:0.35].',
      crest: '엘베스타드 아군 보호막에 [shield:0.5] 추가. 방어력 +5.',
      reign: '집사의 보좌 지속 +[s:3]. 피해 증가 [pp:0.15], 공격 속도 [pp:0.1].',
      shelter: '집사의 보좌 대상 [g:red] [p:0.3].',
    },
  },
  gunnir: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ['회복', `[heal:${p.heal}]`],
        ['방어도', `방어도 +${p.armor} ([s:${p.dur}])`],
        ...opt(p.cleanse, '정화', '[g:cleanse]'),
        ...opt(p.splash, '주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'),
        ['요리', '[g:cook] 배율 적용'],
      ],
    }),
    trait: '전투 스킬 사용 후 모든 아군 [heal:0.25].',
    augs: {
      broth: '가문의 스튜에 [shield:1.8] 추가.',
      bone: '가문의 스튜 방어도 +400.',
      pot: '대상 주변 [t:1] 아군에게도 [p:0.5] 효과. 가문의 스튜에 [shield:0.3] 추가.',
      herb: '가문의 스튜 회복 [heal+:0.6]. [g:cleanse] 추가.',
      butler: '쿨다운 감소 속도 [pp:0.4].',
    },
  },
};

/** 이 그룹에서 새로 쓰는 용어 (공용 GLOSS 에 없을 때만) */
export const GLOSS_C: Record<string, { name: string; desc: string }> = {
  cook: { name: '요리', desc: '셰프 시너지 단계에 따라 회복 · 보호막 · 버프 효과가 배로 커지는 기술.' },
  bond: { name: '스탯 상속률', desc: '소환물이 주인의 능력치를 물려받는 비율.' },
  wound: { name: '부상', desc: '회복 · 보호막을 받을 때 1중첩을 소모하고 그 효과를 무효화.' },
  awaken: { name: '신앙 각성', desc: '고유 신앙이 깨어나 신성력 · 신권 대행을 쓸 수 있게 됨.' },
  catform: { name: '고양이 형태', desc: '회피 +15%p, 공격 속도 +30%p.' },
};
