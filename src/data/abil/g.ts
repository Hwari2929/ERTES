// 능력 설명 (통일 형식) — 그룹 g: 청라공국 · 미노스 (rosterG.ts)
import type { AbilText, Area } from '../abiltext';

type Row = [string, string];
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const when = (c: unknown, r: Row): Row[] => (c ? [r] : []);

export const ABIL_G: Record<string, AbilText> = {
  muhyul: {
    skill: (p) => ({
      tgt: '최대 체력이 가장 높은 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult * (p.final ? 1.5 : 1)}:phys${p.hits > 1 ? `:${p.hits}` : ''}]`],
        ...when(p.hits > 1, ['연사', `두 번째부터 [p:${p.second}] 피해`]),
        ['기록', `[g:record] [s:6] 받는 피해 +[p:${p.vuln}]`],
        ...when(p.refund, ['환급', `[g:record] 대상이 쓰러지면 쿨다운 [p:${p.refund}] 환급`]),
      ],
    }),
    trait: '공명도 대신 [g:causal]로 성장 (인과 단계 1~10). 단계마다 모든 주요 능력치 · 위력 · 주는 피해 · 최대 체력 상승, 4 · 7 · 10단계에 천명 기록 강화. 전투당 1회 쓰러질 피해를 받으면 체력 [p:0.4]로 버틴다.',
  },
  dobin: {
    skill: (p) => ({
      tgt: '기동력이 가장 높은 적 2명', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:holy]`],
        ['밀쳐내기', '[g:knock] [t:1]'],
        ['고정', `[st:root:${p.root}:${p.rootChance}] (움직일 수 없음)`],
      ],
    }),
    trait: '[g:turret]이 피해를 줄 때마다 그 피해의 [p:0.15]만큼 신성 피해를 더한다.',
  },
  siu: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: { k: 'one' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:chem]`],
        ['바운스', `[dmg:tech:${p.bk}:chem] · [t:${p.radius}] 내 최대 ${p.bounce}회 (공명 등급 4등급마다 +1회)`],
        ...when(p.tears, ['중독', '바운스 적중 시 [st:poison:4] 초당 [dmg:tech:0.15:chem]']),
      ],
    }),
    trait: '기본 공격 적중 시 [p:0.3] 확률로 [g:bounce]: [dmg:tech:0.5:chem] · [t:2] 내 최대 1회. 공명 등급 4등급마다 눈물의 해독 바운스 +1회.',
    augs: {
      'sp.record': '바운스 계수 [p:0.5] → [p:0.75].',
      'sp.scope': '바운스 범위 [t:2] → [t:3], 눈물의 해독 바운스 +1회.',
      'sp.tears': '눈물의 해독 바운스 적중 시 [st:poison:4]: 초당 [dmg:tech:0.15:chem].',
      'sp.trigger': '기본 공격 바운스 확률 [p:0.3] → [p:0.6], 바운스 +1회.',
      'sp.lab': '쿨다운 감소 속도 [pp:0.3], 정신력 +6.',
      'sp.devotion': '전투 시작 시 공왕 무휼 피해 +[p:0.25] (없으면 자신 피해 +[p:0.1]).',
      'sp.melt': '눈물의 해독 주 대상 [s:6] 받는 화학 피해 +[p:0.2].',
      'sp.final': '바운스로 적을 쓰러뜨리면 쓰러뜨린 수만큼 (최대 3회) 바운스를 다시 한다.',
    },
  },
  jaehwon: {
    skill: (p) => ({
      tgt: '체력이 가장 낮은 적', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:elec:${p.hits}]`],
        ['환급', `도중에 대상이 쓰러지면 남은 사격을 멈추고 쿨다운 [p:${p.refund}] 환급`],
      ],
    }),
    trait: '일반 공격 [g:crit] 적중 시 전투 스킬 쿨다운 -[s:1.25]. 전투 스킬 사용 후 [s:5] 동안 공격 속도 [pp:0.25] (최대 2중첩, 각 중첩 별도 만료).',
  },
  juseong: {
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys]`],
        ['약화', `[g:weak] [p:${p.weak}] ([s:${p.dur}])`],
      ],
    }),
    trait: '[g:finish] 적중 시 대상 [g:knock] [t:1], [st:stun:1:0.3].',
  },
  clover: {
    skill: (p) => ({
      tgt: '자신 (농업 드론)', range: null, area: { k: 'all', ally: true },
      rows: [
        ['소환', `농업 드론 1기 추가 (최대 ${p.cap}기)`],
        ['농작물', `드론마다 곧바로 체력 비율이 가장 낮은 아군 회복 (드론 기술 위력 [p:${p.crop}] × [g:cook])`],
      ],
    }),
    trait: '[g:immobile]. 방어도 +[p:0.6]. 기본 공격이 [t:2] 안의 다른 적 모두에게 [dmg:shoot:0.6:phys], 맞은 적마다 [p:0.25] 확률로 [g:burn] 1중첩. 농업 드론은 [s:3]마다 체력 비율이 가장 낮은 아군을 회복 ([g:cook]).',
    summon: {
      '농업 드론': (p) => ({
        tgt: '체력 비율이 가장 낮은 아군', range: null, area: { k: 'one' },
        rows: [['농작물', `[s:3]마다 [heal:${p.crop}] × [g:cook] (공격하지 않음)`]],
      }),
    },
    augs: {
      'sp.fleet': '농업 드론 최대 2 → 3기.',
      'sp.harvest': '농작물 회복 +[p:0.4].',
      'sp.greenhouse': '농작물을 받은 아군에게 최대 체력 [p:0.05] 보호막.',
      'sp.incinerate': '[g:burn] 확률 [p:0.25] → [p:0.5].',
      'sp.quota': '출하 지시 쿨다운 -[s:2].',
      'sp.pesticide': '농작물 3번째마다 가장 가까운 적에게 드론 기술 위력 [p:0.8] 화학 피해 + [st:poison:4].',
      'sp.silo': '방어도 +[p:0.3], [g:red] [p:0.1].',
      'sp.protocol': '[g:cook] 배율 +[p:0.2].',
    },
  },
  hana: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy]`],
        ['위치 교란', `[p:${p.swap}] 확률로 범위 안 무작위 빈칸으로 [g:displace] + 이로운 효과 모두 제거`],
      ],
    }),
    trait: '적이 자신 · 아군의 효과로 [g:displace]되면 그 적에게 [dmg:tech:0.6:psy] + [st:fear:1.5:0.3] (대상당 [s:0.4]에 1번).',
    ace: (k) => `해주굿 피해 +[p:${0.2 * k}]. 자신 · 아군의 효과로 [g:displace]된 적은 [s:3] 동안 받는 피해 +[p:${0.05 * k}].`,
  },
  gayoung: {
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:holy]`],
        ['추가 피해', `대상 최대 체력 [p:${p.hp}] 신성 피해 (상한 [dmg:strike:${p.cap}:holy])`],
        ['실명', `[g:blind] [s:${p.dur}] 명중 -[pp:${p.blind}]`],
      ],
    }),
    trait: '자신과 [t:1] 안에 붙은 적 회피 -[pp:0.15].',
  },
  gungo: {
    skill: (p) => ({
      tgt: '적이 가장 많이 모인 곳', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys] (빗나가지 않음)`],
        ['연소', `[g:burn] ${p.burn}중첩`],
      ],
    }),
    trait: '기본 공격 · 전투 스킬 적중 시 대상 보호막 절반 제거. 받는 정신 피해 -[p:0.3].',
  },
  minos: {
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적', range: null, area: { k: 'one' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy]`],
        ['접수 완료', `대상 체력 [p:${p.exec}] 이하면 피해 ×2 (보스 제외)`],
        ['관료 사격', `살아 있는 관료마다 관료 기술 위력 [p:${p.clerk}] 신성 피해`],
      ],
    }),
    trait: '[s:10]마다 저승청 관료 1기 추가 (최대 3기). 관료 기본 공격 적중 시 [st:fear:1:0.25].',
    summon: {
      '저승청 관료': (p) => ({
        tgt: '주인의 대상 (대기열 정리 연계)', range: null, area: { k: 'one' },
        rows: [['관료 사격', `대기열 정리 때 같은 대상에게 관료 기술 위력 [p:${p.clerk}] 신성 피해`], ['공포', '기본 공격 적중 시 [st:fear:1:0.25]']],
      }),
    },
  },
};

/** 이 그룹에서 새로 쓰는 용어 */
export const GLOSS_G: Record<string, { name: string; desc: string }> = {
  record: { name: '기록', desc: '공왕 무휼의 표식. 받는 피해가 늘어난다 (모든 아군의 공격).' },
  causal: { name: '인과율', desc: '청라공국 시너지가 켜진 채 이긴 전투마다 모이는 수치. 공왕 무휼의 인과 단계(1~10)를 올린다. 출전 아군이 장착한 장비가 많을수록 더 모인다.' },
  blind: { name: '실명', desc: '명중이 떨어진다 (해로운 효과).' },
  displace: { name: '강제 이동', desc: '밀쳐내기 · 끌어당기기 · 위치 교란처럼 효과로 위치가 바뀌는 것.' },
};
