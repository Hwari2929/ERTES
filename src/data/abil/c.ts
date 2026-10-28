// 능력 설명 (통일 형식) — 그룹 c
// 상세 문장 문형: docs/ABILITY_TEXT.md (줄마다 한 문장, 토큰 [rng] [pw] [el] [t] [s] [p] [pp] [pv] [g] [fx])
// 지휘관(도로스 · 시그문드)의 스킬 위력은 [pw:tac:…] (전술 위력) 으로 적는다
import type { AbilText, Area } from '../abiltext';
import { DOROS_FEAST, GUNNIR_FAM_HEAL, GUNNIR_HEAL, KYLE_FINISH, VIVIAN_BOND } from '../rework';

type Row = [string, string];
type P = Record<string, number>;
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');
/** 조건부 행 */
const opt = (on: unknown, label: string, v: string): Row[] => (on ? [[label, v]] : []);
/** 부동소수 정리 */
const n = (x: number) => Math.round(x * 1000) / 1000;
/** 상세 문장: 빈 줄 · false 는 빼고 줄바꿈으로 잇는다 */
const L = (...xs: (string | false | 0 | undefined)[]) => xs.filter(Boolean).join('\n');
/** 조건부 문장 묶음 */
const when = (on: unknown, ...xs: string[]) => (on ? xs : []);

// ───────── 공용 문장
// 기절 · 공포 · 출혈 · 도발 · 감전의 설명 문장은 [fx:키:지속(:인자)] 토큰이 능력 설명 끝에 자동으로 붙인다 (STATUS_FX)
/** 다단: 2번째부터는 계수 × second (tpl.ts strike) */
const moreHits = (p: P, pow: string, elem: string, second = p.second ?? 0.6) =>
  when(p.hits > 1, `이어서 같은 대상에게 [pw:${pow}:${n(p.mult * second)}:${elem}] 피해를 ${p.hits - 1}회 더 가합니다.`);
/** 이번 공격만의 보정 (관통 · 치명타) */
const hitMods = (p: P) => [
  ...when(p.pen, `이 공격은 대상의 방어도를 [p:${p.pen}] 무시합니다.`),
  ...when(p.crit, `이 공격은 치명타 확률이 [pv:${p.crit}] 상승 적용됩니다.`),
];
/** 공격형 기술의 해로운 부가 효과 (tpl.ts applyRiders 순서). who = '대상' | '범위 안의 적들' */
const riders = (p: P, who: string) => [
  ...when(p.stun, `공격이 적중하면 ${who}에게 ${p.stunChance && p.stunChance < 1 ? `[p:${p.stunChance}] 기본 확률로` : '반드시'} [fx:stun:${p.stun}] 효과를 부여합니다.`),
  ...when(p.fear, `공격이 적중하면 ${who}에게 [p:${p.fearChance || 0.5}] 기본 확률로 [fx:fear:${p.fear}] 효과를 부여합니다.`),
  ...when(p.slow, `공격이 적중하면 [s:3]간 ${who}의 공격 속도와 이동 속도를 [pv:${p.slow}] 감소시킵니다.`),
  ...when(p.vuln, `공격이 적중하면 [s:${p.vulnDur || 4}]간 ${who}이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`),
];
const resetLine = (p: P) => when(p.resetOnKill, `이 스킬로 적을 처치하면 쿨다운의 [p:${p.resetOnKill}]를 초기화합니다.`);

/** 라스무스의 개 (맥스 · 라라): 불청객 퇴치 연계. 피해 · 출혈은 각자 타격 위력 기준 */
const rasmusDog = (p: P) => ({
  tgt: '라스무스의 현재 대상 (곁으로 뛰어듦)', range: null, area: { k: 'one' } as Area,
  rows: [
    ['피해', `[dmg:strike:${p.mult}:phys]`],
    ['출혈', `[st:bleed:4] 초당 [dmg:strike:${p.bleed}:phys]`],
    ...opt(p.roar, '공포', `주변 [t:1] 적에게 [st:fear:1.2:${p.roar}]`),
    ['가지치기', '기본 공격 적중 시 [g:wound] 1중첩 (최대 5, [s:6])'],
  ] as Row[],
  text: L(
    `라스무스가 스킬을 쓰면 라스무스의 대상 곁으로 순간이동해 [pw:strike:${p.mult}:phys] 피해를 가합니다.`,
    `공격이 적중하면 대상에게 반드시 [fx:bleed:4:strike:${p.bleed}] 효과를 부여합니다.`,
    ...when(p.roar, `자신으로부터 [t:1] 이내의 적들에게 [p:${p.roar}] 기본 확률로 [fx:fear:1.2] 효과를 부여합니다.`),
    '기본 공격이 적중하면 대상에게 반드시 "특성 - 가지치기"의 [g:wound] 효과를 1중첩 부여합니다.',
  ),
});

export const ABIL_C: Record<string, AbilText> = {
  // ───────── 시리우스 성도회
  romani: {
    brief: {
      skill: '가장 먼 적에게 물리 피해를 주고 끌어와 [기절]시키며, 잠시 약하게 만듭니다. 그동안 자신이 받는 피해가 감소합니다.',
      trait: '공격할 때 가장 먼 적을 끌어와 추가 피해를 줍니다. 엘리트 · 보스는 끌려오지 않고 큰 피해를 받습니다.',
    },
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['끌어오기', '대상을 자신 앞으로 끌어옴 (보스 · 고정 대상 제외)'],
        ['기절', `[st:stun:${p.stun}]`],
        ['약화', `[g:weak] [p:${p.weak}] ([s:${p.weakDur}])`],
        ['자세', `자신 [g:red] [p:${p.guard}] ([s:${p.guardDur}])`],
        ...opt(p.splash, '주변', `끌려온 대상 주변 [t:1] 적에게 [dmg:strike:${p.splash}:phys]`),
      ],
      text: L(
        `가장 먼 적에게 [pw:strike:${p.mult}:phys] 피해를 가합니다.`,
        ...moreHits(p, 'strike', 'phys'),
        '대상이 보스나 이동하지 않는 적이 아니면 자신 곁으로 끌어오고, 대상에게 반드시 [fx:taunt:2] 효과를 부여합니다.',
        `공격이 적중하면 대상에게 반드시 [fx:stun:${p.stun}] 효과를 부여하고, [s:${p.weakDur}]간 대상이 가하는 피해를 [pv:${p.weak}] 감소시킵니다.`,
        ...when(p.splash, `끌어온 대상으로부터 [t:1] 이내의 다른 적들에게 [pw:strike:${p.splash}:phys] 피해를 가합니다.`, '이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.'),
        `스킬을 쓰면 [s:${p.guardDur}]간 자신이 받는 피해를 [pv:${p.guard}] 감소시킵니다.`,
      ),
    }),
    trait: L(
      '기본 공격이 적중하거나 전투 스킬을 쓰면 가장 먼 적을 자신 곁으로 끌어오고 [pw:strike:0.5:phys] 피해를 가합니다.',
      '엘리트 · 보스는 끌려오지 않고, 대신 [pw:strike:1.5:phys] 피해를 받습니다.',
      '이 효과는 [s:3]마다 1번 발동합니다.',
    ),
  },
  joshua: {
    brief: {
      skill: '모든 아군을 치료합니다. 체사레로 전환한 뒤에는 자신만 크게 치료합니다.',
      trait: '[이성]이 크게 감소하면 체사레로 전환해 근접에서 싸우고, 주변 적을 가끔 [공포]에 빠뜨립니다.',
    },
    skill: (p) => ({
      tgt: '모든 아군', range: null, area: { k: 'all', ally: true },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ...opt(p.cleanse, '정화', '[g:cleanse]'),
        ['체사레', `자신만 [heal:${n(p.heal * 2)}]`],
      ],
      text: L(
        `모든 아군을 [pw:tech:${p.heal}]만큼 회복시킵니다.`,
        p.cleanse && '모든 아군의 해로운 효과를 모두 제거합니다.',
        `체사레로 전환한 뒤에는 자신만 [pw:tech:${n(p.heal * 2)}]만큼 회복합니다.`,
      ),
    }),
    trait: L(
      '[g:reason]이 -50 이하가 되면 전투가 끝날 때까지 체사레로 전환합니다.',
      '체사레는 기본 공격이 사거리 [t:1]의 [el:phys] 타격 공격으로 바뀌고, 가하는 피해가 [pv:@rage] 증가합니다.',
      '체사레는 1초마다 최대 체력의 [p:@regen]만큼 회복합니다.',
      '체사레로 전환할 때와 그 뒤 [s:8]마다 자신으로부터 [t:1] 이내의 적들에게 [p:@fearChance] 기본 확률로 [fx:fear:1.5] 효과를 부여합니다.',
    ),
  },
  sarma: {
    brief: {
      skill: '대상 주변의 적들에게 큰 물리 피해를 주고 느리게 만듭니다.',
      trait: '기본 공격 피해가 대상 주변의 적들에게 번집니다.',
    },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['둔화', `[st:slow:3] 공격 · 이동 속도 -[pv:${p.slow}]`],
        ...opt(p.pen, '관통', `[g:pen] [p:${p.pen}]`),
        ...opt(p.stun, '기절', `[st:stun:${p.stun}]`),
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[pv:${p.vuln}]`),
      ],
      text: L(
        p.radius ? `[rng] 이내의 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:shoot:${p.mult}:phys] 피해를 가합니다.` : `[rng] 이내의 적에게 [pw:shoot:${p.mult}:phys] 피해를 가합니다.`,
        ...moreHits(p, 'shoot', 'phys'),
        ...hitMods(p),
        ...riders(p, p.radius ? '범위 안의 적들' : '대상'),
      ),
    }),
    trait: '기본 공격을 하면 대상으로부터 [t:1] 이내의 다른 적들에게 기본 공격 피해의 [p:0.3] [el:phys] 피해를 가합니다.',
    augs: {
      'mj.dense': '포켓 블랙홀의 피해가 [pw:shoot:1.35:phys]만큼 증가하고, 쿨다운이 [s:2] 증가합니다.',
      'mj.horizon': '포켓 블랙홀이 적중하면 [s:4]간 대상이 받는 피해를 [pv:0.15] 증가시킵니다.',
      'mj.stop': '포켓 블랙홀이 적중하면 대상에게 반드시 [fx:stun:1] 효과를 부여합니다.',
      'mj.lens': '포켓 블랙홀의 방어도 관통이 [pv:0.4] 증가합니다.',
      'mj.fusion': '차원 융합이 번지는 피해가 기본 공격 피해의 [p:0.3]에서 [p:0.5]로 증가합니다.',
      'mj.gap': '공격을 회피하면 포켓 블랙홀의 쿨다운이 [s:1] 감소합니다. 이 효과는 [s:1]에 1회 발동합니다.',
      'mj.textbook': '포켓 블랙홀의 쿨다운이 [s:2] 감소합니다.',
      'mj.cell': '[g:mag]이 2발 증가해 6발이 되고, 재장전 시간이 [s:0.5] 증가합니다.',
      'mj.sorry': '체력이 처음으로 [p:0.4] 미만이 되면 [s:2]간 피해를 받지 않고, 최대 체력의 [p:0.15]만큼 보호막을 얻습니다. 전투당 1회.',
      'mj.collapse': '포켓 블랙홀이 범위 안의 적들을 중심 쪽으로 [t:1] 끌어당깁니다. 보스 · 고정 기물은 끌려오지 않습니다.',
      'mj.residue': '포켓 블랙홀을 쓰면 그 자리에 [s:3]간 중력장을 남깁니다. 중력장은 [s:1]마다 중심으로부터 [t:2] 이내의 적들에게 [pw:shoot:0.3:phys] 피해를 가합니다. 이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.',
      'mj.next': '궁극기 충전 효율 [pp:0.2]. 포켓 블랙홀을 쓸 때마다 궁극기 게이지가 [pv:0.05] 증가합니다.',
      'mj.echo': '포켓 블랙홀을 쓰면 [s:3] 뒤 같은 자리에 메아리 블랙홀이 열려, 같은 범위의 적들에게 포켓 블랙홀 피해의 [p:0.7]를 가합니다. 메아리 블랙홀은 포켓 블랙홀의 치명타 확률 · 방어도 관통 보정과 이동 · 공격 속도 감소, [g:stun], 받는 피해 증가 효과를 그대로 적용합니다.',
      'mj.rewind': '쓰러질 피해를 받으면 [s:5] 전의 체력으로 되돌아가고, 포켓 블랙홀의 쿨다운이 초기화됩니다. 되돌아갈 체력이 최대 체력의 [p:0.3] 미만이면 최대 체력의 [p:0.3]으로 되돌아갑니다. 전투당 1회.',
    },
  },
  kyle: {
    brief: {
      skill: '가장 뒤쪽 적에게 순간이동해 주변 적들에게 신성 피해를 주고, 보호막을 얻습니다.',
      trait: '가하는 신성 피해가 증가하고, 피니쉬가 주변까지 신성 피해를 줍니다.',
    },
    skill: (p) => ({
      tgt: '가장 뒤쪽 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:holy${hitsTxt(p.hits)}]`],
        ...opt(p.stun, '기절', `[st:stun:${p.stun}]`),
      ],
      text: L(
        p.radius ? `가장 뒤쪽 적에게 순간이동해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:strike:${p.mult}:holy] 피해를 가합니다.` : `가장 뒤쪽 적에게 순간이동해 [pw:strike:${p.mult}:holy] 피해를 가합니다.`,
        ...moreHits(p, 'strike', 'holy'),
        ...hitMods(p),
        ...riders(p, p.radius ? '범위 안의 적들' : '대상'),
        `자신에게 최대 체력의 [p:${p.guard}]만큼 보호막을 부여합니다.`,
      ),
    }),
    trait: L(
      '가하는 [el:holy] 피해가 [pv:0.2] 증가합니다.',
      `[g:finish]가 적중하면 대상과 대상으로부터 [t:1] 이내의 적들에게 [pw:strike:${KYLE_FINISH}:holy] 피해를 가합니다.`,
    ),
  },
  doros: {
    brief: {
      skill: '[요리] 가장 다친 아군을 치료하고 해로운 효과를 걷어내며, 피해를 잠시 증가시키고 고유 신앙을 깨웁니다.',
      trait: '기본 공격을 할 때마다 모든 아군을 조금씩 치료합니다.',
    },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: p.splash ? { k: 'around', r: 1 } : { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ...opt(p.cleanse, '정화', '[g:cleanse]'),
        ['버프', `피해 +[pv:${p.dmg}] ([s:${p.dur}])`],
        ...opt(p.shield, '보호막', `[shield:${p.shield}]`),
        ...opt(p.splash, '주변', '대상 주변 [t:1] 아군에게 [p:0.5] 효과'),
        ['요리', '[g:cook] 배율 적용'],
      ],
      text: L(
        `체력 비율이 가장 낮은 아군을 [pw:tac:${p.heal}]만큼 회복시킵니다.`,
        p.shield && `대상에게 [pw:tac:${p.shield}]만큼 보호막을 부여합니다.`,
        p.cleanse && '대상의 해로운 효과를 모두 제거합니다.',
        `[s:${p.dur}]간 대상이 가하는 피해를 [pv:${p.dmg}] 증가시킵니다.`,
        p.splash && '대상으로부터 [t:1] 이내의 다른 아군들에게도 같은 효과를 [p:0.5]의 세기로 줍니다.',
        '이 스킬의 회복 · 강화 효과는 [g:cook] 배율을 받습니다.',
        '성찬을 받은 아군은 이번 전투 동안 [g:awaken] 상태가 됩니다. 이미 디바인인 아군은 대신 신성력 획득량이 [pv:1] 증가합니다.',
      ),
    }),
    trait: `기본 공격을 할 때마다 모든 아군을 [pw:tac:${DOROS_FEAST}]만큼 회복시킵니다.`,
  },
  demiurgos: {
    brief: {
      skill: '가장 다친 아군을 크게 치료하고 잠시 받는 피해를 감소시킵니다.',
      trait: '치료를 받은 아군이 잠시 받는 피해가 감소합니다.',
    },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: aroundOr(p.radius),
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
      ],
      text: L(
        p.radius ? `체력 비율이 가장 낮은 아군을 지정해 대상으로부터 [t:${p.radius}] 이내의 아군들을 [pw:tech:${p.heal}]만큼 회복시킵니다.` : `체력 비율이 가장 낮은 아군을 [pw:tech:${p.heal}]만큼 회복시킵니다.`,
        `[s:${p.dur}]간 ${p.radius ? '대상들이' : '대상이'} 받는 피해를 [pv:${p.red}] 감소시킵니다.`,
      ),
    }),
    trait: '아군의 체력을 회복시키면 [s:3]간 그 아군이 받는 피해를 [pv:0.1] 감소시킵니다.',
  },

  // ───────── 범은하 공동체
  aiden: {
    brief: {
      skill: '체력 비율이 가장 낮은 적에게 순간이동해 물리 피해를 주고, 가끔 [공포]에 빠뜨립니다.',
      trait: '전투 시작 · 회피 · 처치 때 잠시 [고양이 형태]가 되고, 크게 다치면 뒤로 물러나 조금 회복합니다.',
    },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['공포', `[st:fear:${p.fear}:${p.fearChance}]`],
        ...opt(p.resetOnKill, '처치 시', `쿨다운 [p:${p.resetOnKill}] 초기화`),
      ],
      text: L(
        p.radius ? `체력 비율이 가장 낮은 적에게 순간이동해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:strike:${p.mult}:phys] 피해를 가합니다.` : `체력 비율이 가장 낮은 적에게 순간이동해 [pw:strike:${p.mult}:phys] 피해를 가합니다.`,
        ...moreHits(p, 'strike', 'phys'),
        ...hitMods(p),
        ...riders(p, p.radius ? '범위 안의 적들' : '대상'),
        ...resetLine(p),
      ),
    }),
    trait: L(
      '전투가 시작되면 [s:5]간, 공격을 회피하면 [s:2]간, 적을 처치하면 [s:5]간 [g:catform] 상태가 됩니다.',
      '[g:catform]에서는 회피가 [pv:0.15], 공격 속도가 [pv:0.3] 증가합니다.',
      '체력이 [p:0.35] 미만이 되면 자기 진영 뒷줄로 물러나고, 곧바로 최대 체력의 [p:0.1]만큼 회복합니다.',
      '이 후퇴는 [s:10]마다 1번 발동합니다.',
    ),
    ace: (k) => `회피가 [pv:${n(0.075 * k)}] 증가합니다. 공격을 회피하면 공격자에게 [pw:strike:${n(0.8 * k)}:phys] 피해를 가합니다.`,
    augs: {
      'sp.cat': '[g:catform] 상태가 전투 내내 유지됩니다. 이동 속도가 [pv:0.4] 증가하고, 최대 체력이 [pv:0.3] 감소합니다.',
      'sp.bar': '액체 금속 변형이 적을 공격하지 않고, 체력 비율이 가장 낮은 아군을 [pw:tech:1.8]만큼 회복시키는 스킬로 바뀝니다.',
      'sp.crystal': '적을 처치하면 최대 체력의 [p:0.075]만큼 회복하고, [g:combo]가 2번 진행됩니다.',
      'sp.nine': '전투당 1회, 쓰러질 피해를 받으면 체력 1로 버팁니다. 그 뒤 [s:3]간 [g:catform] 상태가 되고, 회피가 [pv:1] 증가하며, 피해를 받지 않습니다.',
      'sp.tail': '[g:catform]일 때 기본 공격을 하면 대상으로부터 [t:1] 이내의 다른 적들에게 기본 공격 피해의 [p:0.5] [el:phys] 피해를 가합니다.',
      'sp.illusion': '액체 금속 변형의 [g:fear] 효과 기본 확률이 [p:0.7]로, 지속 시간이 [s:1.5]로 바뀝니다. 바텐더 근무를 함께 가지면 회복시킨 아군으로부터 [t:1] 이내의 적들에게 [p:0.7] 기본 확률로 [fx:fear:1.5] 효과를 부여합니다.',
      'sp.gap': '[g:catform] 상태가 되면 [s:2]간 자신으로부터 [t:2] 이내의 다른 아군들의 공격 속도를 [pv:0.3] 증가시킵니다.',
      'sp.human': '[g:catform] 상태가 되지 않는 대신 최대 체력이 [pv:0.4], 스킬 피해가 [pv:0.5] 증가하고, 방어도가 2 증가합니다. [g:catform] 상태가 될 때마다 같은 시간 동안 [g:focus] 상태가 되며, [g:focus]은 능력치 보너스 없이 [g:catform]에 반응하는 효과만 발동시킵니다.',
      'mj.glass': '체력이 [p:0.35] 미만이 되어 뒷줄로 물러날 때마다 최대 체력의 [p:0.25]만큼 보호막을 얻고, 자신의 해로운 효과를 모두 제거합니다.',
      'mj.tip': '액체 금속 변형이 적중하면 [s:4]간 대상이 받는 피해를 [pv:0.15] 증가시킵니다.',
      'mj.menu': '[g:finish] 공격을 할 때마다 액체 금속 변형의 쿨다운이 [s:1.5] 감소합니다.',
      'mj.serve': '자신으로부터 [t:1] 이내의 아군을 공격한 적에게 반드시 [fx:taunt:1.5] 효과를 부여합니다. 같은 적에게는 [s:3]에 1회 발동합니다.',
      'mj.catking': '[g:catform]의 회피 증가량이 [pv:0.15] 증가합니다. [g:catform] 상태에서 공격을 회피하면 공격자에게 [pw:strike:1.2:phys] 피해로 반격하며, 이 반격은 [s:0.3]에 1회 발동합니다. 인간 형태와 함께 가지면 회피 증가 없이 [g:focus] 상태에서 반격만 합니다.',
      'mj.metal': '적에게 피해를 받을 때마다 액체 금속을 1중첩 얻으며, 최대 10회 중첩됩니다. 이 효과는 [s:0.3]에 1회 발동합니다. 액체 금속 1중첩당 방어도가 3 증가하고, 받는 피해가 [pv:0.02] 감소합니다. [g:finish] 공격을 하면 중첩을 모두 소모해 대상에게 중첩당 [pw:strike:0.3:phys] 피해를 가합니다.',
    },
  },
  vivian: {
    brief: {
      skill: '리키를 대상에게 보내 물리 피해를 주고 [기절]시킵니다.',
      trait: '비비안과 리키의 기본 공격이 적의 방어도를 감소시킵니다.',
    },
    skill: (p) => ({
      tgt: '현재 대상', range: null, area: { k: 'one' },
      rows: [
        ['피해', `리키가 대상 옆으로 이동해 리키 타격 위력의 [p:${p.mult}] 물리 피해`],
        ['기절', `[st:stun:${p.stun}]`],
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[pv:${p.vuln}]`),
        ['리키 없을 때', '비비안이 직접 [dmg:shoot:1.5:phys]'],
      ],
      text: L(
        `리키가 대상 곁으로 순간이동해 리키 타격 위력의 [p:${p.mult}] [el:phys] 피해를 가합니다.`,
        `공격이 적중하면 대상에게 반드시 [fx:stun:${p.stun}] 효과를 부여합니다.`,
        p.vuln && `공격이 적중하면 [s:4]간 대상이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`,
        '리키가 없으면 비비안이 대상에게 직접 [pw:shoot:1.5:phys] 피해를 가합니다.',
      ),
    }),
    trait: L(
      '비비안과 리키의 기본 공격이 적중하면 [s:5]간 대상의 방어도를 [p:0.1] 감소시키며, 이 효과는 최대 3회 중첩됩니다.',
      '리키의 기본 공격 피해가 [p:0.12] 증가합니다.',
      `리키의 [g:inherit]이 [pv:${VIVIAN_BOND}] 증가합니다.`,
    ),
    summon: {
      리키: (p) => ({
        tgt: '비비안의 현재 대상 (곁으로 뛰어듦)', range: null, area: { k: 'one' },
        rows: [
          ['피해', `[dmg:strike:${p.mult}:phys]`],
          ['기절', `[st:stun:${p.stun}] (비비안이 건다)`],
          ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[pv:${p.vuln}]`),
          ['생태 분석', '기본 공격 적중 시 대상 방어도 -[p:0.1] (중첩, 최대 3, [s:5])'],
        ],
        text: L(
          `비비안이 스킬을 쓰면 비비안의 대상 곁으로 순간이동해 [pw:strike:${p.mult}:phys] 피해를 가합니다.`,
          `이어서 비비안이 대상에게 반드시 [fx:stun:${p.stun}] 효과를 부여합니다.`,
          p.vuln && `[s:4]간 대상이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`,
          '기본 공격이 적중하면 대상에게 "특성 - 생태 분석"의 방어도 감소 효과를 부여합니다.',
        ),
      }),
    },
  },
  yupito: {
    brief: {
      skill: '가장 다친 아군과 그 주변 아군, 모든 포탑에 보호막을 부여합니다.',
      trait: '전투가 시작되면 무작위 아군의 피해와 방어도를 크게 증가시킵니다.',
    },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 아군', range: null, area: aroundOr(p.radius),
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ...opt(p.armor, '방어도', `방어도 +${p.armor} ([s:${p.dur}])`),
        ['포탑', `모든 [g:turret]에 [shield:${p.turretShield}]`],
      ],
      text: L(
        p.radius ? `체력 비율이 가장 낮은 아군을 지정해 대상으로부터 [t:${p.radius}] 이내의 아군들에게 [pw:tech:${p.shield}]만큼 보호막을 부여합니다.` : `체력 비율이 가장 낮은 아군에게 [pw:tech:${p.shield}]만큼 보호막을 부여합니다.`,
        p.cleanse && `${p.radius ? '대상들' : '대상'}의 해로운 효과를 모두 제거합니다.`,
        p.armor && `[s:${p.dur}]간 ${p.radius ? '대상들' : '대상'}의 방어도를 ${p.armor} 증가시킵니다.`,
        `모든 아군 [g:turret]에 [pw:tech:${p.turretShield}]만큼 보호막을 부여합니다.`,
      ),
    }),
    trait: L(
      '전투가 시작되면 소환물이 아닌 무작위 아군 1명이 가하는 피해를 [pv:0.2], 방어도를 15 증가시키며, 이 효과는 전투 동안 지속됩니다.',
      '그 아군이 범은하 공동체나 엔지니어 시너지를 가지면 효과가 2배가 됩니다.',
    ),
    augs: {
      'mj.amp': '임시 에너지 장벽의 보호막이 [pw:tech:0.3]만큼, [g:turret]에 부여하는 보호막이 [pw:tech:0.3]만큼 증가합니다.',
      'mj.plate': '임시 에너지 장벽을 받은 아군은 [s:4]간 방어도가 20 증가합니다.',
      'mj.wide': '임시 에너지 장벽의 범위가 대상으로부터 [t:2] 이내로 증가하고, 보호막이 [pw:tech:0.2]만큼 감소합니다. [g:turret]에 부여하는 보호막은 감소하지 않습니다.',
      'mj.gear2': '전투가 시작되면 강철의 마녀의 특제 장비를 아직 받지 않은 무작위 아군 1명(소환물 제외)에게 하나 더 줍니다. 그 아군이 가하는 피해가 [pv:0.2], 방어도가 15 증가하며, 범은하 공동체나 엔지니어 시너지를 가지면 효과가 2배가 됩니다.',
      'mj.tune': '강철의 마녀의 특제 장비를 받은 아군은 전투 동안 공격 속도가 [pv:0.2] 증가하고, 받는 피해가 [pv:0.1] 감소합니다.',
      'mj.scrap': '적이 쓰러질 때마다 체력 비율이 가장 낮은 아군에게 [pw:tech:0.4]만큼 보호막을 부여합니다. 이 효과는 [s:1]에 1회 발동합니다.',
      'mj.arc': '기본 공격이 적중하면 대상에게 [p:0.15] 고정 확률로 [fx:shock:1] 효과를 부여합니다. 이 효과는 [s:2]에 1회 발동합니다.',
      'mj.turret': '[g:turret]의 최대 체력과 방어도가 [pv:0.3], 공격 속도가 [pv:0.2] 증가합니다.',
      'mj.backup': '체력이 처음으로 [p:0.5] 미만이 되면 아군 전원에게 [pw:tech:0.8]만큼 보호막을 부여합니다.',
      'mj.wrench': '임시 에너지 장벽의 쿨다운이 [s:1.5] 감소합니다.',
      'mj.filter': '임시 에너지 장벽을 받은 아군의 해로운 효과를 모두 제거합니다.',
      'mj.trick': '궁극기 충전 효율 [pp:0.15]. 비장의 한 수를 쓰면 [s:8]간 아군 전원이 가하는 피해를 [pv:0.12] 증가시킵니다.',
      'mj.last': '소환물이 아닌 아군이 쓰러질 피해를 받으면 체력 1로 버티고, [s:1]간 피해를 받지 않으며, [pw:tech:2]만큼 보호막을 얻습니다. 전투당 2회.',
      'mj.workshop': '전투가 시작되면 특제 장비가 없는 아군 전원(소환물 제외)에게 보급형 특제 장비를 줍니다. 보급형 특제 장비는 가하는 피해를 [pv:0.12], 방어도를 9 증가시키며, 범은하 공동체나 엔지니어 시너지를 가진 아군에게는 효과가 2배가 됩니다.',
    },
  },
  ingel: {
    brief: {
      skill: '대상 주변의 적들에게 정신 피해를 주고, 가끔 [공포]에 빠뜨립니다.',
      trait: '함께 출전한 아군과 소환물이 많을수록 가하는 피해가 증가합니다.',
    },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy${hitsTxt(p.hits)}]`],
        ['공포', `[st:fear:${p.fear}:${p.fearChance}]`],
        ...opt(p.noMiss, '명중', '빗나가지 않음'),
        ...opt(p.vuln, '취약', `[st:vuln:4] 받는 피해 +[pv:${p.vuln}]`),
      ],
      text: L(
        p.radius ? `[rng] 이내의 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:tech:${p.mult}:psy] 피해를 가합니다.` : `[rng] 이내의 적에게 [pw:tech:${p.mult}:psy] 피해를 가합니다.`,
        ...moreHits(p, 'tech', 'psy'),
        p.noMiss && '이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.',
        ...hitMods(p),
        ...riders(p, p.radius ? '범위 안의 적들' : '대상'),
      ),
    }),
    trait: '전투가 시작되면 출전한 다른 아군 기물 1명당 가하는 피해가 [pv:0.1], 아군 소환물 · 포탑 1기당 [pv:0.05] 증가합니다.',
  },

  // ───────── 엘베스타드 일가
  rachel: {
    brief: {
      skill: '대상에게 강한 정신 피해를 주고 [기절]시킨 뒤, 대상 너머로 순간이동합니다.',
      trait: '정신 피해로 체력을 흡수하고, 기본 공격과 피니쉬에 고정 피해를 더합니다.',
    },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:psy${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
      text: L(
        p.radius ? `[rng] 이내의 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:strike:${p.mult}:psy] 피해를 가합니다.` : `[rng] 이내의 적에게 [pw:strike:${p.mult}:psy] 피해를 가합니다.`,
        ...moreHits(p, 'strike', 'psy'),
        ...hitMods(p),
        ...riders(p, p.radius ? '범위 안의 적들' : '대상'),
        '이어서 대상 너머 1칸으로 순간이동합니다.',
        `그 칸에 적이 있으면 밀쳐내고 [fx:stun:${p.blinkStun}] 효과를 부여합니다. 밀어낼 수 없으면 이동하지 않고 기절만 겁니다.`,
      ),
    }),
    trait: L(
      '[el:psy] 피해를 가하면 그 피해의 [p:0.15]만큼 회복합니다.',
      '기본 공격이 적중하면 대상에게 [pw:strike:0.2:true] 피해를 추가로 가합니다.',
      '[g:finish]가 적중하면 대상으로부터 [t:1] 이내의 적들에게 피니쉬 피해의 [p:0.35]만큼 [el:true] 피해를 가합니다.',
    ),
  },
  oliver: {
    brief: {
      skill: '가장 뒤쪽 적에게 순간이동해 주변 적들에게 물리 피해를 주고 잠시 [기절]시킵니다.',
      trait: '이동 속도가 빠를수록 기술 위력이 증가합니다.',
    },
    skill: (p) => ({
      tgt: '가장 뒤쪽 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
        ...opt(p.resetOnKill, '처치 시', `쿨다운 [p:${p.resetOnKill}] 초기화`),
      ],
      text: L(
        p.radius ? `가장 뒤쪽 적에게 순간이동해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:tech:${p.mult}:phys] 피해를 가합니다.` : `가장 뒤쪽 적에게 순간이동해 [pw:tech:${p.mult}:phys] 피해를 가합니다.`,
        ...moreHits(p, 'tech', 'phys'),
        ...hitMods(p),
        ...riders(p, p.radius ? '범위 안의 적들' : '대상'),
        ...resetLine(p),
      ),
    }),
    trait: '전투가 시작되면 이동 속도가 100%를 넘는 만큼의 1.5배 비율로 기술 위력이 증가합니다.',
    ace: (k) => `전투가 시작되면 모든 아군의 공격 속도가 [pv:${n(0.12 * k)}] 증가합니다.`,
    augs: {
      'mj.overspeed': '이동 속도 [pp:0.15].',
      'mj.wide': '규정 속도 경계선의 범위가 대상으로부터 [t:2] 이내로 증가하고, 피해가 [pw:tech:0.3:phys]만큼 감소합니다.',
      'mj.express': '규정 속도 경계선으로 적을 처치하면 쿨다운의 [p:0.5]를 돌려받습니다.',
      'mj.brake': '규정 속도 경계선의 [g:stun] 지속 시간이 [s:0.5]에서 [s:1.2]로 증가합니다.',
      'mj.doors': '규정 속도 경계선을 쓰면 자신에게 [pw:tech:0.8]만큼 보호막을 부여합니다.',
      'mj.transfer': '규정 속도 경계선이 적중하면 [s:5]간 대상이 받는 피해를 [pv:0.15] 증가시킵니다.',
      'mj.wrench': '[g:finish]가 적중하면 규정 속도 경계선의 쿨다운이 [s:0.6] 감소합니다.',
      'mj.first': '전투가 시작되면 궁극기 게이지가 [pv:0.4] 증가합니다.',
      'mj.passenger': '막차 급행을 쓰면 [s:5]간 모든 아군의 공격 속도를 [pv:0.25] 증가시킵니다.',
      'mj.horn': '규정 속도 경계선이 적중하면 대상에게 [p:0.5] 기본 확률로 [fx:fear:1.5] 효과를 부여합니다.',
      'mj.double': '규정 속도 경계선이 피해를 2회 가하며, 2번째 피해는 1번째 피해의 [p:0.4]입니다.',
      'mj.family': '엘베스타드 일가 시너지 기물 1명당 (자신 포함) 이동 속도가 [pv:0.05] 증가합니다.',
      'mj.nonstop': '이동 속도 [pp:0.15]. 메트로 기관사가 이동 속도 100% 대신 80%를 넘는 만큼의 2배 비율로 기술 위력을 증가시킵니다.',
      'mj.extend': '막차 급행을 쓰면 규정 속도 경계선의 쿨다운이 곧바로 끝나고, [s:8]간 쿨다운 감소 속도가 [pv:1] 증가합니다.',
    },
  },
  rasmus: {
    brief: {
      skill: '맥스와 라라를 대상에게 보내 물리 피해를 주고 [출혈]을 겁니다.',
      trait: '라스무스와 개들의 기본 공격이 [부상]을 쌓아 적의 회복 · 보호막을 막습니다.',
    },
    skill: (p) => ({
      tgt: '현재 대상', range: null, area: { k: 'one' },
      rows: [
        ['피해', `맥스와 라라가 각각 대상 옆으로 이동해 자기 타격 위력의 [p:${p.mult}] 물리 피해`],
        ['출혈', `[st:bleed:4] 초당 자기 타격 위력의 [p:${p.bleed}]`],
        ...opt(p.roar, '공포', `각자 주변 [t:1] 적에게 [st:fear:1.2:${p.roar}]`),
        ['개 없을 때', '인접한 대상에게 라스무스가 직접 [dmg:strike:1.5:phys]'],
        ['소환', '맥스 (체력 ×1.6, 앞을 막음) · 라라 (상속 [p:0.8], 체력 ×0.9, 회피 [pp:0.15], 공격 간격 0.75초, 빠름, 인접한 적 중 체력 비율이 가장 낮은 적을 노림)'],
      ],
      text: L(
        `맥스와 라라가 각자 대상 곁으로 순간이동해 자신의 타격 위력의 [p:${p.mult}] [el:phys] 피해를 가합니다.`,
        '공격이 적중하면 각자 대상에게 반드시 "소환물 기술 - 불청객 퇴치"의 [g:bleed] 효과를 부여합니다.',
        ...when(p.roar, `각자 자신으로부터 [t:1] 이내의 적들에게 [p:${p.roar}] 기본 확률로 [fx:fear:1.2] 효과를 부여합니다.`),
        '개가 없으면 라스무스가 곁에 있는 대상에게 직접 [pw:strike:1.5:phys] 피해를 가합니다.',
      ),
    }),
    trait: L(
      '라스무스 · 맥스 · 라라의 기본 공격이 적중하면 대상에게 [fx:wound:6:5] 효과를 1중첩 부여합니다.',
    ),
    summon: { 맥스: rasmusDog, 라라: rasmusDog },
  },
  sigmund: {
    brief: {
      skill: '모시는 아군이나 가장 활약한 아군을 잠시 강화하고, 엘베스타드 아군들에게 보호막을 부여합니다.',
      trait: '공명 등급이 가장 높은 아군을 모셔 엘베스타드 일원으로 대우합니다.',
    },
    skill: (p) => ({
      tgt: `모시는 아군 · 피해 기여가 가장 큰 아군 ${p.count}명`, range: null, area: { k: 'one' },
      rows: [
        ['버프', `피해 +[pv:${p.dmg}], 공격 속도 +[pv:${p.as}] ([s:${p.dur}])`],
        ...opt(p.red, '피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`),
        ['주요 위력', `보좌 대상의 주요 위력 + 시그문드 [g:tac] [p:${p.mainUp}] ([s:${p.dur}])`],
        ['보호막', `엘베스타드 아군 전원에게 [shield:${p.famShield}]`],
      ],
      text: L(
        `자신을 뺀 아군 중 모시는 아군을 먼저, 그다음 이번 전투에서 가장 많은 피해를 가한 아군을 ${p.count}명 지정합니다.`,
        `[s:${p.dur}]간 대상이 가하는 피해를 [pv:${p.dmg}], 공격 속도를 [pv:${p.as}] 증가시킵니다.`,
        p.red && `[s:${p.dur}]간 대상이 받는 피해를 [pv:${p.red}] 감소시킵니다.`,
        `[s:${p.dur}]간 대상의 주요 위력을 [pw:tac:${p.mainUp}]만큼 증가시킵니다.`,
        `엘베스타드 일가 아군 모두에게 [pw:tac:${p.famShield}]만큼 보호막을 부여합니다.`,
      ),
    }),
    trait: L(
      '전투가 시작되면 출전한 다른 아군 중 공명 등급이 가장 높은 아군을 모십니다.',
      '모시는 아군이 엘베스타드 일가가 아니면 엘베스타드 일가 시너지에 합류시키고, 엘베스타드 일가면 모든 주요 능력치를 5 증가시킵니다.',
    ),
  },
  gunnir: {
    brief: {
      skill: '[요리] 가장 다친 아군을 치료하고 보호막을 부여하며, 잠시 방어도를 증가시킵니다.',
      trait: '전투 스킬을 쓴 뒤 모든 아군을 치료하고, 엘베스타드 일가는 더 많이 치료합니다.',
    },
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
      text: L(
        `체력 비율이 가장 낮은 아군을 [pw:tech:${p.heal}]만큼 회복시키고, [pw:tech:${p.shield}]만큼 보호막을 부여합니다.`,
        p.cleanse && '대상의 해로운 효과를 모두 제거합니다.',
        `[s:${p.dur}]간 대상의 방어도를 ${p.armor} 증가시킵니다.`,
        p.splash && '대상으로부터 [t:1] 이내의 다른 아군들에게도 같은 효과를 [p:0.5]의 세기로 줍니다.',
        '이 스킬의 회복 · 보호막 · 방어도 효과는 [g:cook] 배율을 받습니다.',
      ),
    }),
    trait: L(
      `전투 스킬을 쓰면 모든 아군을 [pw:tech:${GUNNIR_HEAL}]만큼 회복시킵니다.`,
      `엘베스타드 일가 아군은 [pw:tech:${GUNNIR_HEAL + GUNNIR_FAM_HEAL}]만큼 회복시킵니다.`,
    ),
  },
};

/** 이 그룹에서 새로 쓰는 용어 (공용 GLOSS 에 없을 때만) */
export const GLOSS_C: Record<string, { name: string; desc: string }> = {
  cook: { name: '요리', desc: '셰프 시너지 단계에 따라 회복 · 보호막 · 버프 효과가 배로 커지는 기술.' },
  wound: { name: '부상', desc: '회복 · 보호막을 받을 때 1중첩을 소모하고 그 효과를 무효화.' },
  awaken: { name: '신앙 각성', desc: '고유 신앙이 깨어나 신성력 · 신권 대행을 쓸 수 있게 됨.' },
  catform: { name: '고양이 형태', desc: '회피 +15%p, 공격 속도 +30%p.' },
};
