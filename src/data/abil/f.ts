// 능력 설명 (통일 형식) — 그룹 f
// 상세 문장은 docs/ABILITY_TEXT.md 문형. 지휘관(CMD)의 스킬 · 증강처럼 전술 위력으로 계산되는 값은 [pw:tac:…] 로 적는다.
import type { AbilText, Area } from '../abiltext';

type Row = [string, string];
const aroundOr = (r: number): Area => (r ? { k: 'around', r } : { k: 'one' });
const hitsTxt = (n: number) => (n > 1 ? `:${n}` : '');
/** 다타 스킬: 두 번째 타부터 피해 배율 */
const secondRow = (p: Record<string, number>): Row[] => (p.hits > 1 && p.second !== 1 ? [['연타', `두 번째 타부터 [p:${p.second}] 피해`]] : []);
const when = (c: unknown, r: Row): Row[] => (c ? [r] : []);

// ───────── 상세 문장 조각
type P = Record<string, number>;
const opt = (c: unknown, ...lines: string[]): string[] => (c ? lines : []);
const lines = (...ls: (string | string[])[]) => ls.flat().join('\n');
/** 다단: '피해를 N회 가합니다' 의 'N회 ' */
const times = (p: P) => (p.hits > 1 ? ` ${p.hits}회` : '');
/** 2번째 타부터 줄어드는 피해 */
const secondLine = (p: P) => opt(p.hits > 1 && p.second !== 1, `2번째 타격부터는 [p:${p.second}]의 피해를 가합니다.`);
/** 이번 공격만의 보정 (치명타 · 방어도 관통) */
const bonusLines = (p: P) => [
  ...opt(p.crit, `이 공격은 치명타 확률이 [pv:${p.crit}] 상승 적용됩니다.`),
  ...opt(p.pen, `이 공격은 대상 방어도의 [p:${p.pen}]를 무시합니다.`),
];
const killLine = (p: P) => opt(p.resetOnKill, `이 공격으로 적을 처치하면 쿨다운의 [p:${p.resetOnKill}]를 돌려받습니다.`);
/** 공격에 딸린 상태 효과 부여 (확률 1 이상 = 반드시). fx = [fx] 토큰 인자 (키:지속(:위력:계수)) — 설명 문장은 detailText 가 끝에 붙인다 */
const give = (who: string, ch: number, fx: string) => `공격이 적중하면 ${who}에게 ${ch >= 1 ? '반드시' : `[p:${ch}] 기본 확률로`} [fx:${fx}] 효과를 부여합니다.`;
/** 대상 문형: 지정 대상 (주변 r칸) */
const atTarget = (p: P, pw: string) => (p.radius
  ? `[rng] 이내의 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 ${pw} 피해를${times(p)} 가합니다.`
  : `[rng] 이내의 적에게 ${pw} 피해를${times(p)} 가합니다.`);
/** 피해 문장 뒤: 다단 감쇠 · 이번 공격 보정 */
const after = (p: P) => [...secondLine(p), ...bonusLines(p)];
/** 순간이동 스킬의 피해 대상 (주변 r칸) */
const blinkWho = (p: P) => (p.radius ? `대상으로부터 [t:${p.radius}] 이내의 적들에게` : '그 적에게');
const who = (p: P) => (p.radius ? '각 대상' : '대상');
/** 마오 요리 대상 (여러 명이면 각 대상) */
const mt = (p: P) => ((p.count || 1) > 1 ? '각 대상' : '대상');

export const ABIL_F: Record<string, AbilText> = {
  bjorn: {
    brief: { skill: '가장 먼 적에게 전기 피해를 주고 [기절]시킵니다.', trait: '받는 피해가 감소하고, 다칠수록 더 세게 싸우며, 주기적으로 가장 다친 아군에게 보호막을 줍니다.' },
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:elec]`],
        ['기절', `[st:stun:${p.stun}]`],
        ...when(p.pull, ['끌어오기', '대상을 앞 [t:1]로 끌어옴 (엘리트 · 보스 제외)']),
      ],
      text: lines(
        p.radius ? `가장 먼 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:shoot:${p.mult}:elec] 피해를${times(p)} 가합니다.` : `가장 먼 적에게 [pw:shoot:${p.mult}:elec] 피해를${times(p)} 가합니다.`,
        after(p),
        give(who(p), 1, `stun:${p.stun}`),
        killLine(p),
        opt(p.pull, '대상이 일반 적이면 자신으로부터 [t:1] 이내의 빈칸으로 끌어옵니다.', '엘리트 · 보스는 끌려오지 않습니다.'),
      ),
    }),
    trait: lines(
      '받는 피해가 [pv:0.15] 감소합니다.',
      '잃은 체력 1%당 주는 피해가 [p:0.01] 증가합니다.',
      '[s:7]마다 체력 비율이 가장 낮은 아군에게 [pw:shoot:@rescue]만큼 보호막을 부여합니다.',
    ),
    augs: {
      'sp.first': '다른 아군이 쓰러질 피해를 받으면 그 아군은 체력 1로 버팁니다. 대신 자신이 최대 체력의 [p:0.2]만큼 [el:true] 피해를 받습니다. 전투당 1회.',
      'sp.thunder': '기본 공격이 적중하면 대상에게 [p:0.3] 기본 확률로 [fx:shock:1] 효과를 부여합니다.',
      'sp.song': '전투가 시작되면 [s:8]간 모든 아군이 가하는 피해를 [pv:0.2] 증가시킵니다.',
      'sp.pull': '구조 작살이 일반 적을 자신으로부터 [t:1] 이내의 빈칸으로 끌어옵니다. 엘리트 · 보스는 끌려오지 않습니다. [g:stun] 지속 시간이 [s:2]로 증가하고, 구조 작살의 피해가 [pw:shoot:0.66:elec] 피해만큼 감소합니다.',
      'sp.valhalla': '체력이 [p:0.3] 이하이면 받는 피해가 [pv:0.2] 더 감소합니다.',
      'sp.gear': '구조 신호의 보호막이 [pw:shoot:0.8]만큼 증가하고, 체력 비율이 가장 낮은 아군 2명에게 부여합니다.',
      'sp.berserk': '받는 피해 감소 [pv:0.15]가 사라집니다. 대신 잃은 체력 1%당 주는 피해 증가가 [p:0.01]에서 [p:0.02]로 증가합니다.',
      'sp.storm': '[g:shock] 상태의 적에게 주는 피해가 [p:0.3] 증가합니다.',
      'mj.aid': '구조 작살을 쓰면 체력 비율이 가장 낮은 아군을 [pw:shoot:1]만큼 회복시킵니다.',
      'mj.bill': '이긴 전투에서 구조 작살을 3번 쓸 때마다 크레딧을 1 얻습니다. 전투당 최대 2.',
      'mj.crawl': '자신으로부터 [t:2] 이내의 적 1명당 받는 피해가 [p:0.05] 감소합니다. 최대 [p:0.2]까지 감소합니다.',
      'mj.reel': '구조 작살로 적을 처치하면 쿨다운의 [p:0.5]를 돌려받습니다. 재장전 속도가 [pv:0.25] 증가합니다.',
      'mj.thor': '구조 작살이 피해를 가하면 대상으로부터 [t:2] 이내의 적에게 최대 4회 바운스되는 [pw:shoot:0.6:elec] 피해를 가하고, 맞은 적마다 반드시 [fx:shock:1] 효과를 부여합니다.',
      'mj.wall': '자신으로부터 [t:2] 이내의 다른 아군이 받는 피해의 [p:0.3]를 대신 받습니다. 자신이 받는 피해가 [pv:0.15] 더 감소합니다.',
    },
  },
  zina: {
    brief: { skill: '가장 약한 적 곁으로 순간이동해 화학 피해를 주고 [중독]시키며, 처치하면 쿨다운을 돌려받습니다.', trait: '기본 공격이 [중독]을 걸고, 중독된 적에게 더 큰 피해를 줍니다.' },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['중독', `[st:poison:4:0.9] 초당 [dmg:shoot:${p.poison}:chem]`],
        ...when(p.resetOnKill, ['처치', `처치 시 쿨다운 [p:${p.resetOnKill}] 회복`]),
      ],
      text: lines(
        `체력 비율이 가장 낮은 적의 곁으로 순간이동해 ${blinkWho(p)} [pw:shoot:${p.mult}:chem] 피해를${times(p)} 가합니다.`,
        after(p),
        give(who(p), 0.9, `poison:4:shoot:${p.poison}`),
        killLine(p),
      ),
    }),
    trait: lines(
      '기본 공격이 적중하면 대상에게 반드시 [fx:poison:4:shoot:0.2] 효과를 부여합니다.',
      '[g:poison] 상태의 적에게 주는 피해가 [p:0.25] 증가합니다.',
    ),
  },
  fotini: {
    brief: { skill: '대상 주변에 신성 피해를 주고 받는 피해를 증가시키며, 주 대상의 도발 배율을 증가시킵니다.', trait: '전투가 시작되면 아군 전원이 빨라지고 잠시 강해지며, 자신은 잠시 빠르게 쏘고 처치하면 다시 빨라집니다.' },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:holy]`],
        ...when(p.vuln, ['취약', `[st:vuln:5] 받는 피해 +[pv:${p.vuln}]`]),
        ['시선 집중', `주 대상 [s:5] 동안 도발 계수 +${p.provPlus}`],
      ],
      text: lines(
        atTarget(p, `[pw:shoot:${p.mult}:holy]`),
        after(p),
        opt(p.vuln, `공격이 적중하면 [s:${p.vulnDur || 4}]간 ${who(p)}이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`),
        `[s:5]간 지정한 대상의 도발 배율을 ${p.provPlus} 증가시킵니다.`,
        killLine(p),
      ),
    }),
    trait: lines(
      '전투가 시작되면 모든 아군의 이동 속도가 이번 전투 동안 [pv:0.2] 증가합니다.',
      '전투가 시작되면 [s:6]간 모든 아군이 가하는 피해를 [pv:0.15] 증가시킵니다.',
      '전투가 시작되거나 적을 처치하면 [s:4]간 자신의 공격 속도가 [pv:0.5] 증가합니다.',
    ),
  },
  kaburaya: {
    brief: { skill: '대상 주변에 전기 피해를 주고 [감전]시킵니다.', trait: '기본 공격이 가끔 [감전]을 걸고, 감전된 적에게 더 큰 피해를 줍니다.' },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:elec]`],
        ['감전', `[st:shock:${p.shock}:${Math.min(1, p.shockChance || 0.7)}]`],
        ...when(p.vuln, ['취약', `[st:vuln:${p.vulnDur || 4}] 받는 피해 +[pv:${p.vuln}]`]),
      ],
      text: lines(
        atTarget(p, `[pw:tac:${p.mult}:elec]`),
        after(p),
        give(who(p), Math.min(1, p.shockChance || 0.7), `shock:${p.shock}`),
        opt(p.vuln, `공격이 적중하면 [s:${p.vulnDur || 4}]간 ${who(p)}이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`),
        killLine(p),
      ),
    }),
    trait: lines(
      '기본 공격이 적중하면 대상에게 [p:0.3] 기본 확률로 [fx:shock:1] 효과를 부여합니다.',
      '[g:shock] 상태의 적에게 주는 피해가 [p:0.25] 증가합니다.',
    ),
    augs: {
      'mj.bored': '권태의 피해 증가가 [p:0.25]에서 [p:0.45]로 증가합니다.',
      'mj.overtime': '야근 수당 청구의 범위가 대상으로부터 [t:2] 이내로 증가하고, 피해가 [pw:tac:0.6:elec] 피해만큼 감소합니다.',
      'mj.jolt': '기본 공격이 [g:shock] 상태의 적에게 적중하면 [pw:tac:0.4:elec] 피해를 추가로 가합니다.',
      'mj.invoice': '야근 수당 청구가 피해를 가하면 [s:5]간 각 대상이 받는 피해를 [pv:0.15] 증가시킵니다.',
      'mj.clockout': '전투가 시작될 때 궁극기 게이지가 [pp:0.4] 더 차 있습니다.',
      'mj.meeting': '야근 수당 청구가 반드시 [g:shock] 효과를 부여하고, [g:shock] 지속 시간이 [s:2.5]로 증가합니다.',
      'mj.riskdoc': '[s:8]마다 자신에게 [pw:tac:0.8]만큼 보호막을 부여합니다.',
      'mj.dnd': '적이 거는 [g:stun] · [g:freeze] · [g:fear] 효과에 걸리지 않습니다. 최대 체력이 [pv:0.1] 감소합니다.',
      'mj.hoi': '호이슌 홀딩스 시너지 기물 1명당 (자신 포함) 전술 위력이 [pv:0.05] 증가합니다.',
      'mj.chain': '[g:shock] 상태의 적이 쓰러지면 그 적으로부터 [t:2] 이내의 가장 가까운 적에게 [pw:tac:0.6:elec] 피해를 가하고, 반드시 [fx:shock:1.5] 효과를 부여합니다.',
      'mj.battery': '지루한 스턴건의 탄창이 6발로 증가하고, 재장전 시간이 [s:1.5]로 감소합니다.',
      'mj.paper': '야근 수당 청구의 쿨다운이 [s:7]에서 [s:6]로 감소합니다.',
      'mj.afterhours': '정시 퇴근을 쓰고 [s:3] 뒤 적 전체에게 [pw:tac:2:elec] 피해를 가하고, 반드시 "특성 - 권태"의 [g:shock] 효과를 부여합니다. 이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.',
      'mj.contagion': '전투가 시작되면 다른 아군 기물(소환물 제외)도 [g:shock] 상태의 적에게 주는 피해가 [p:0.25] 증가합니다.',
    },
  },
  bill: {
    brief: { skill: '대상 주변에 전기 피해를 주고 [공포]에 빠뜨립니다.', trait: '기본 공격이 가끔 적을 느리게 만들고, 해로운 효과가 걸린 적에게 더 큰 피해를 줍니다.' },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:tech:${p.mult}:elec]`],
        ['공포', `[st:fear:${p.fear}:${Math.min(1, p.fearChance || 0.5)}]`],
      ],
      text: lines(
        atTarget(p, `[pw:tech:${p.mult}:elec]`),
        after(p),
        give(who(p), Math.min(1, p.fearChance || 0.5), `fear:${p.fear}`),
        killLine(p),
      ),
    }),
    trait: lines(
      '기본 공격이 적중하면 [p:0.25] 기본 확률로 [s:3]간 대상의 공격 속도와 이동 속도를 [pv:0.25] 감소시킵니다.',
      '지속 피해 · 제어 효과 · 둔화가 걸린 적에게 주는 피해가 [p:0.1] 증가합니다.',
    ),
  },
  issac: {
    brief: { skill: '주변 적에게 화학 피해를 주고 [중독]시킵니다.', trait: '계속 체력을 회복하고 화학 피해에 강하며, 스킬을 쓸 때 보호막을 두릅니다.' },
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['중독', `[st:poison:4:0.9] 초당 [dmg:strike:${p.poison}:chem]`],
      ],
      text: lines(
        `자신으로부터 [t:${p.radius || 1}] 이내의 적들에게 [pw:strike:${p.mult}:chem] 피해를${times(p)} 가합니다.`,
        after(p),
        give('각 대상', 0.9, `poison:4:strike:${p.poison}`),
        killLine(p),
      ),
    }),
    trait: lines(
      '1초마다 최대 체력의 [p:0.005]만큼 회복합니다.',
      '받는 [el:chem] 피해가 [pv:0.3] 감소합니다.',
      '전투 스킬을 쓰면 자신에게 최대 체력의 [p:0.15]만큼 보호막을 부여합니다.',
    ),
    augs: {
      'mj.regen': '1초마다 회복하는 체력이 최대 체력의 [pv:0.005] 증가합니다.',
      'mj.slime': '전투 스킬을 쓸 때 받는 보호막이 최대 체력의 [pv:0.1] 증가합니다.',
      'mj.wide': '붕대 해제의 범위가 자신으로부터 [t:2] 이내로 증가하고, 피해가 [pw:strike:0.3:chem] 피해만큼 감소합니다.',
      'mj.toxin': '붕대 해제의 [g:poison] 피해가 초당 [pw:strike:0.3:chem] 피해만큼 증가합니다.',
      'mj.family': '자신으로부터 [t:1] 이내의 다른 아군이 받는 피해의 [p:0.2]를 대신 받습니다. 지속 피해는 대신 받지 않습니다.',
      'mj.name': '다른 아군 기물(소환물 제외)이 쓰러지면 [s:8]간 자신이 가하는 피해를 [pv:0.35] 증가시키고, 받는 피해를 [pv:0.15] 감소시킵니다.',
      'mj.manners': '붕대 해제를 쓰면 범위 안의 적들에게 [fx:taunt:2] 효과를 부여합니다.',
      'mj.crowd': '자신으로부터 [t:2] 이내의 적 1명당 받는 피해가 [p:0.05] 감소합니다. 최대 [p:0.25]까지 감소합니다.',
      'mj.venom': '[g:finish]가 적중하면 대상에게 반드시 [fx:poison:4:strike:0.4] 효과를 부여합니다.',
      'mj.limb': '기본 공격이 적중하면 [p:0.25] 고정 확률로 [pw:strike:0.5:chem] 피해를 추가로 가합니다.',
      'mj.patience': '피격으로 차는 궁극기 게이지가 2배가 됩니다.',
      'mj.ornis': '성간 인류 연합 시너지 기물 1명당 (자신 포함) 방어도가 [p:0.06] 증가합니다.',
      'mj.hands': '체력이 처음으로 [p:0.5] 이하가 되면 녹빛 손 2기를 소환합니다. 녹빛 손은 화학 근접 공격을 하는 돌격가 소환물이며, 능력치 상속률은 최고의 친구 기본 상속률의 1.5배, 체력은 0.8배입니다.',
      'mj.unbound': '최대 체력이 [pv:0.15] 감소합니다. 기본 공격을 하면 대상으로부터 [t:1] 이내의 다른 적들에게 [pw:strike:0.4:chem] 피해를 가하고, 반드시 [fx:poison:3:strike:0.15] 효과를 부여합니다.',
    },
  },
  eden: {
    brief: { skill: '대상 주변에 화학 피해를 주고 적의 이로운 효과를 벗깁니다.', trait: '체력이 절반 이하가 되면 더 세지고 잘 피합니다.' },
    skill: (p) => ({
      tgt: '현재 대상', range: 'unit', area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:chem${hitsTxt(p.hits)}]`],
        ['강화 해제', `맞은 적마다 [p:${p.strip}] 확률로 이로운 효과 ${p.stripN}종 제거`],
        ...when(p.vuln, ['취약', `[st:vuln:4] 받는 피해 +[pv:${p.vuln}]`]),
      ],
      text: lines(
        atTarget(p, `[pw:tac:${p.mult}:chem]`),
        after(p),
        `${who(p)}마다 [p:${p.strip}] 고정 확률로 이로운 효과를 ${p.stripN}개 제거합니다.`,
        opt(p.vuln, `공격이 적중하면 [s:4]간 ${who(p)}이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`),
        killLine(p),
      ),
    }),
    trait: lines(
      '체력이 [p:0.5] 이하이면 주는 피해가 [p:0.2] 증가합니다.',
      '체력이 처음으로 [p:0.5] 이하가 되면 이번 전투 동안 회피가 [pv:0.1] 증가합니다.',
    ),
  },
  reika: {
    brief: { skill: '모든 적에게 전기 피해를 주고 [감전]시킵니다.', trait: '아군이 스킬을 쓸수록 [시청자]가 증가해 기술 피해가 증가합니다.' },
    skill: (p) => ({
      tgt: '모든 적', range: null, area: { k: 'all' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:elec] (빗나가지 않음)`],
        ['감전', `[st:shock:${p.shock}:${Math.min(1, p.shockChance)}]`],
        ...when(p.encore, ['앙코르', `같은 효과를 [p:${p.encore}] 위력으로 한 번 더`]),
      ],
      text: lines(
        `적 전체에게 [pw:tac:${p.mult}:elec] 피해를 가합니다.`,
        '이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.',
        give('각 대상', Math.min(1, p.shockChance), `shock:${p.shock}`),
        opt(p.encore, `같은 공격을 [p:${p.encore}]의 위력으로 한 번 더 가합니다.`),
      ),
    }),
    trait: lines(
      '자신이나 아군이 전투 스킬을 쓸 때마다 [g:viewer]가 1명 증가하며, 최대 30명까지 증가합니다.',
      '[g:viewer] 1명당 자신이 가하는 기술 피해가 [p:0.03] 증가합니다.',
    ),
  },
  mao: {
    brief: { skill: '피해를 가장 많이 준 아군을 치료하고, 피해와 공격 속도를 증가시킵니다.', trait: '요리받은 아군의 스킬 쿨다운을 감소시킵니다.' },
    skill: (p) => ({
      tgt: (p.count || 1) > 1 ? `피해 기여가 가장 큰 아군 ${p.count}명` : '피해 기여가 가장 큰 아군', range: null, area: { k: 'one' },
      rows: [
        ['회복', `[heal:${p.heal}]`],
        ['버프', `[s:${p.dur}] 동안 피해 +[pv:${p.dmg}], 공격 속도 +[pv:${p.as}]`],
        ...when(p.red, ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`]),
        ['요리', '[g:cook] 배율이 모든 효과에 적용'],
      ],
      text: lines(
        `${(p.count || 1) >= 99 ? '다른 아군 전원을' : (p.count || 1) > 1 ? `다른 아군 중 피해 기여가 가장 큰 ${p.count}명을 지정해 각각` : '다른 아군 중 피해 기여가 가장 큰 아군을 지정해'} [pw:tac:${p.heal}]만큼 회복시킵니다.`,
        `[s:${p.dur}]간 ${mt(p)}이 가하는 피해를 [pv:${p.dmg}] 증가시키고, 공격 속도를 [pv:${p.as}] 증가시킵니다.`,
        opt(p.red, `[s:${p.dur}]간 ${mt(p)}이 받는 피해를 [pv:${p.red}] 감소시킵니다.`),
        opt(p.crit, `[s:${p.dur}]간 ${mt(p)}의 치명타 확률을 [pv:${p.crit}] 증가시킵니다.`),
        '회복량과 강화 수치에 [g:cook] 배율이 곱해집니다.',
      ),
    }),
    trait: '요리를 받은 아군의 스킬 쿨다운이 [s:2] 감소합니다.',
    augs: {
      'sp.bar': '네온 칵테일의 대상이 2명으로 증가합니다.',
      'sp.contract': '네온 칵테일이 강화 지속 동안 대상이 받는 피해를 [pv:0.2] 감소시킵니다.',
      'sp.yukata': '전투가 시작되면 호이슌 · 스텔라레이서 아군이 가하는 피해가 이번 전투 동안 [pv:0.2] 증가합니다.',
      'sp.vip': '네온 칵테일의 강화 지속 시간이 [s:6]에서 [s:10]로 증가합니다.',
      'sp.special': '요리를 받은 아군은 [s:6]간 기술 피해로 준 피해의 [p:0.15]만큼 회복합니다.',
      'sp.after': '요리를 받은 아군이 적을 처치하면 요리 강화 효과의 지속 시간이 처음 값으로 돌아갑니다.',
      'sp.bomb': '네온 칵테일을 쓴 뒤 최대 체력이 가장 높은 적에게 [pw:tac:1.5:elec] 피해를 가하고, 반드시 [fx:shock:1.5] 효과를 부여합니다. 이 공격은 명중 확률이 [pv:1] 상승 적용됩니다. 네온 칵테일의 쿨다운이 [s:2] 증가합니다.',
      'sp.regular': '같은 아군에게 연달아 요리하면 효과가 [p:0.2]씩 증가하며, 최대 3회까지 누적됩니다.',
      'mj.ice': '네온 칵테일이 강화 지속 동안 대상의 치명타 확률을 [pv:0.15] 증가시킵니다. 이 수치에도 [g:cook] 배율이 곱해집니다.',
      'mj.happy': '전투가 시작되면 [s:10]간 쿨다운 감소 속도가 [pv:1] 증가합니다.',
      'mj.fine': '요리를 받은 아군을 공격한 적은 [s:4]간 받는 피해가 [pv:0.15] 증가합니다.',
      'mj.refill': '기본 공격을 할 때마다 네온 칵테일의 쿨다운이 [s:0.3] 감소합니다.',
      'mj.openbar': '네온 칵테일을 다른 아군 전원에게 냅니다. [g:cook] 배율이 [pv:0.4] 감소합니다.',
      'mj.neon': '기본 공격을 하지 않습니다. 네온 칵테일의 쿨다운이 [p:0.4] 감소하고, [g:cook] 배율이 [pv:0.5] 증가합니다.',
    },
  },
  skadi: {
    brief: { skill: '주변 적에게 전기 피해를 주고 [기절]시킵니다.', trait: '전투가 시작되면 가장 신참인 아군을 크게 강화하고, 스킬을 쓸 때 보호막을 두릅니다.' },
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:elec${hitsTxt(p.hits)}]`],
        ['기절', `[st:stun:${p.stun}]`],
      ],
      text: lines(
        `자신으로부터 [t:${p.radius || 1}] 이내의 적들에게 [pw:strike:${p.mult}:elec] 피해를${times(p)} 가합니다.`,
        after(p),
        give('각 대상', 1, `stun:${p.stun}`),
        killLine(p),
      ),
    }),
    trait: lines(
      '전투가 시작되면 공명 등급이 가장 낮은 다른 아군 1명이 이번 전투 동안 가하는 피해를 [pv:0.3] 증가시키고, 받는 피해를 [pv:0.15] 감소시킵니다.',
      '전투 스킬을 쓰면 자신에게 최대 체력의 [p:0.12]만큼 보호막을 부여합니다.',
    ),
  },
  mingki: {
    brief: { skill: '가장 약한 적에게 순간이동해 물리 피해를 줍니다.', trait: '체력이 절반 이하가 되면 [내면의 괴물]이 깨어나 크게 강해지고, 스킬을 쓰면 체력을 회복합니다.' },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...secondRow(p),
      ],
      text: lines(
        `체력 비율이 가장 낮은 적의 곁으로 순간이동해 ${blinkWho(p)} [pw:strike:${p.mult}:phys] 피해를${times(p)} 가합니다.`,
        after(p),
        killLine(p),
      ),
    }),
    trait: lines(
      '체력이 처음으로 [p:@monsterAt] 이하가 되면 자신에게 [fx:monster] 효과를 부여합니다.',
      '전투 스킬을 쓰면 최대 체력의 [p:@heal]만큼 회복합니다.',
    ),
    augs: {
      'sp.awake': '전투가 시작되면 바로 [g:monster] 효과를 얻습니다. 대신 체력이 [p:0.1]보다 높으면 1초마다 최대 체력의 [p:0.02]만큼 [el:true] 피해를 받습니다.',
      'sp.master': '전투가 시작되면 엘베스타드 아군이 가하는 피해가 이번 전투 동안 [pv:0.1] 증가합니다.',
      'sp.full': '츄르 사냥의 쿨다운이 [s:2] 감소하고, 전투 스킬을 쓸 때 회복하는 체력이 최대 체력의 [pv:0.075] 증가합니다.',
      'sp.appetite': '[g:monster] 상태에서 적을 처치하면 최대 체력의 [p:0.1]만큼 회복하고, [g:monster] 상태에서 가하는 피해가 [p:0.1]씩 증가합니다. 최대 5회 누적됩니다.',
      'sp.purr': '[g:monster] 효과를 얻으면 자신으로부터 [t:2] 이내의 적들에게 반드시 [fx:fear:1.5] 효과를 부여합니다.',
      'sp.liquid': '회피가 [pv:0.1] 증가합니다. [g:monster] 상태에서는 회피가 [pv:0.15] 더 증가합니다.',
      'sp.second': '체력이 처음으로 [p:0.2] 이하가 되면 이번 전투 동안 가하는 피해가 [pv:0.5] 증가하고, 준 피해의 [p:0.2]만큼 체력을 회복합니다.',
      'sp.tame': '[g:monster] 효과가 가하는 피해를 증가시키는 대신 받는 피해를 [pv:0.25] 감소시킵니다. 공격 속도 증가는 그대로입니다. 츄르 사냥은 적에게 순간이동해 공격하는 대신, 다른 아군 전체를 각자 최대 체력의 [p:0.06]만큼 회복시키고 자신을 포함한 아군 전체에게 [s:3]간 각자 최대 체력의 [p:0.1]만큼 보호막을 부여합니다. 바뀐 츄르 사냥은 피해를 가하지 않습니다.',
      'mj.punch': '[g:finish]가 적중하면 대상에게 반드시 [fx:stun:1] 효과를 부여합니다.',
      'mj.tower': '전투 스킬을 쓰면 [s:2]간 회피가 [pv:0.3] 증가합니다.',
      'mj.claw': '기본 공격이 적중하면 대상에게 반드시 [fx:bleed:4:strike:0.15] 효과를 부여합니다.',
      'mj.groom': '[g:monster] 상태에서 1초마다 최대 체력의 [p:0.02]만큼 회복하고, 해로운 효과를 1개 제거합니다.',
      'mj.nine': '쓰러질 피해를 받으면 최대 체력의 [p:0.3]만큼 체력을 남기고 버티며, [s:1]간 피해를 받지 않습니다. 버틸 때마다 이번 전투 동안 가하는 피해가 [pv:0.3] 증가하고, [g:monster] 효과가 없으면 바로 얻습니다. 전투당 2회.',
      'mj.nebula': '츄르 사냥이나 궁극기로 적을 처치하면 그 적 최대 체력의 [p:0.1]만큼 이번 전투 동안 최대 체력이 증가합니다. 이렇게 증가하는 최대 체력은 원래 최대 체력의 [p:0.5]까지입니다. 이때 츄르 사냥 쿨다운의 [p:0.5]를 돌려받습니다.',
    },
  },
  onyx: {
    brief: { skill: '모든 적에게 정신 피해를 주고 가끔 [공포]에 빠뜨립니다.', trait: '[이성]이 낮을수록 정신 피해가 증가합니다.' },
    skill: (p) => ({
      tgt: '모든 적', range: null, area: { k: 'all' },
      rows: [
        ['피해', `[dmg:tech:${p.mult}:psy] (빗나가지 않음)`],
        ['공포', `[st:fear:${p.fear}:${Math.min(1, p.fearChance)}]`],
        ...when(p.vuln, ['취약', `[st:vuln:4] 받는 피해 +[pv:${p.vuln}]`]),
      ],
      text: lines(
        `적 전체에게 [pw:tech:${p.mult}:psy] 피해를 가합니다.`,
        '이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.',
        give('각 대상', Math.min(1, p.fearChance), `fear:${p.fear}`),
        opt(p.vuln, `공격이 적중하면 [s:4]간 각 대상이 받는 피해를 [pv:${p.vuln}] 증가시킵니다.`),
      ),
    }),
    trait: '[g:reason]이 0보다 낮으면 가하는 [el:psy] 피해가 [g:reason]이 낮을수록 증가하며, [g:reason] -100에서 [p:0.3] 증가합니다.',
  },
  exile: {
    brief: { skill: '가장 약한 적에게 순간이동해 물리 피해를 주고 [출혈]을 겁니다.', trait: '피니쉬 · 스킬 · 궁극기로 준 피해의 일부만큼 체력을 회복합니다.' },
    skill: (p) => ({
      tgt: '체력 비율이 가장 낮은 적 (순간이동)', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ['출혈', `[st:bleed:4] 초당 [dmg:strike:${p.bleed}:phys]`],
        ...when(p.resetOnKill, ['처치', `처치 시 쿨다운 [p:${p.resetOnKill}] 회복`]),
      ],
      text: lines(
        `체력 비율이 가장 낮은 적의 곁으로 순간이동해 ${blinkWho(p)} [pw:strike:${p.mult}:phys] 피해를${times(p)} 가합니다.`,
        after(p),
        give(who(p), 1, `bleed:4:strike:${p.bleed}`),
        killLine(p),
      ),
    }),
    trait: '[g:finish] · 전투 스킬 · 궁극기로 피해를 주면 준 피해의 [p:0.35]만큼 회복합니다.',
    augs: {
      'mj.hunt': '혈검으로 적을 처치하면 쿨다운의 [p:0.6]를 돌려받습니다.',
      'mj.deep': '혈검의 [g:bleed] 피해가 초당 [pw:strike:0.3:phys] 피해만큼 증가합니다.',
      'mj.vital': '혈검은 치명타 확률이 [pv:0.3] 상승 적용됩니다.',
      'mj.thirst': '혈족의 갈증의 회복량이 준 피해의 [pv:0.15] 증가합니다.',
      'mj.cloak': '전투가 시작되면 자신에게 [fx:stealth:4] 효과를 부여하고, [s:4]간 공격 속도가 [pv:0.3] 증가합니다.',
      'mj.apology': '혈검 · 혈월로 피해를 주면 [s:3]간 대상이 가하는 피해를 [pv:0.2] 감소시킵니다.',
      'mj.evade': '체력이 [p:0.5] 이하이면 회피가 [pv:0.15] 증가합니다.',
      'mj.noble': '칼리토 작위 +1, 치명타 피해 [pp:0.2].',
      'mj.moon': '혈월을 쓰면 [s:6]간 공격 속도가 [pv:0.4] 증가합니다.',
      'mj.edge': '[g:finish]가 적중하면 대상에게 반드시 [fx:bleed:4:strike:0.25] 효과를 부여합니다.',
      'mj.shadow': '적을 처치하면 체력 비율이 가장 낮은 적의 곁으로 순간이동합니다. 1초에 1번.',
      'mj.price': '혈검의 피해가 [pw:strike:0.8:phys] 피해만큼 증가합니다. 대신 혈검을 쓸 때마다 최대 체력의 [p:0.06]만큼 체력을 잃으며, 체력은 1 미만으로 감소하지 않습니다.',
      'mj.banquet': '혈월이 끝나면 혈월이 베지 않은 적 중 체력 비율이 가장 낮은 2명에게 차례로 순간이동해 각각 [pw:strike:3:phys] 피해를 가하고, 반드시 [fx:bleed:4:strike:0.3] 효과를 부여합니다. 이 공격은 명중 확률이 [pv:1] 상승 적용됩니다.',
      'mj.undying': '쓰러질 피해를 받으면 체력 1로 버티고 [s:3]간 피해를 받지 않습니다. 그동안 혈족의 갈증의 회복량이 준 피해의 [pv:0.35] 증가합니다. 전투당 1회.',
    },
  },
  thermo: {
    brief: { skill: '주변 아군에게 보호막을 주고 받는 피해를 감소시킵니다.', trait: '자신과 주변 아군이 받는 피해를 감소시킵니다.' },
    skill: (p) => ({
      tgt: '자신 주변 아군', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['보호막', `[shield:${p.shield}]`],
        ['피해량 경감', `[g:red] [p:${p.red}] ([s:${p.dur}])`],
      ],
      text: lines(
        `자신으로부터 [t:${p.radius || 1}] 이내의 아군들에게 [pw:tech:${p.shield}]만큼 보호막을 부여합니다.`,
        `[s:${p.dur}]간 대상들이 받는 피해를 [pv:${p.red}] 감소시킵니다.`,
      ),
    }),
    trait: '자신과 자신으로부터 [t:1] 이내의 아군이 받는 피해가 [pv:0.1] 감소합니다.',
  },
  u404: {
    brief: { skill: '주변 적에게 물리 피해를 줍니다.', trait: '스킬을 쓸 때마다 피해가 계속 증가합니다.' },
    skill: (p) => ({
      tgt: '자신', range: 0, area: { k: 'self', r: p.radius || 1 },
      rows: [
        ['피해', `[dmg:strike:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...when(p.stun, ['기절', `[st:stun:${p.stun}]`]),
        ['버프', `사용할 때마다 피해 +[pv:${p.growth}] (전투 동안 중첩)`],
      ],
      text: lines(
        `자신으로부터 [t:${p.radius || 1}] 이내의 적들에게 [pw:strike:${p.mult}:phys] 피해를${times(p)} 가합니다.`,
        after(p),
        opt(p.stun, give('각 대상', 1, `stun:${p.stun}`)),
        killLine(p),
      ),
    }),
    trait: '전투 스킬을 쓸 때마다 이번 전투 동안 가하는 피해가 [pv:@growth] 증가하며, 이 효과는 계속 중첩됩니다.',
  },
  rus: {
    brief: { skill: '가장 먼 적에게 방어도를 일부 무시하는 물리 피해를 줍니다.', trait: '적을 처치하면 크레딧을 얻습니다.' },
    skill: (p) => ({
      tgt: '가장 먼 적', range: null, area: aroundOr(p.radius),
      rows: [
        ['피해', `[dmg:shoot:${p.mult}:phys${hitsTxt(p.hits)}]`],
        ...secondRow(p),
        ['관통', `[g:pen] [p:${p.pen}]`],
      ],
      text: lines(
        p.radius ? `가장 먼 적을 지정해 대상으로부터 [t:${p.radius}] 이내의 적들에게 [pw:shoot:${p.mult}:phys] 피해를${times(p)} 가합니다.` : `가장 먼 적에게 [pw:shoot:${p.mult}:phys] 피해를${times(p)} 가합니다.`,
        after(p),
        opt(p.fear, give(who(p), Math.min(1, p.fearChance || 0.5), `fear:${p.fear}`)),
        killLine(p),
      ),
    }),
    trait: '적을 처치하면 크레딧을 1 얻습니다. 전투당 최대 3회.',
    augs: {
      'mj.double': '약탈 사격의 타수가 1 증가합니다. 추가 사격은 [p:0.6]의 피해를 가합니다.',
      'mj.ap': '약탈 사격의 피해가 [pw:shoot:0.6:phys] 피해만큼 증가하고, 방어도 무시 비율이 [pv:0.3] 증가합니다.',
      'mj.ship': '전투가 시작되면 자신에게 최대 체력의 [p:0.5]만큼 보호막을 부여합니다. 체력이 처음으로 [p:0.5] 미만이 되면 최대 체력의 [p:0.25]만큼 보호막을 한 번 더 부여합니다.',
      'mj.escape': '체력이 [p:0.4] 미만이 되면 적에게서 먼 빈칸으로 최대 [t:2] 물러나고, [s:3]간 회피가 [pv:0.3] 증가합니다. [s:8]에 1번.',
      'mj.fee': '전투가 시작될 때 보유 크레딧 10당 가하는 피해가 [pv:0.02] 증가합니다. 최대 [pv:0.2]까지 증가합니다.',
      'mj.reload': '적을 처치하면 탄창을 가득 채우고, 재장전 중이면 재장전을 바로 끝냅니다. 약탈 사격의 쿨다운이 [s:2] 감소합니다.',
      'mj.fair': '약탈 사격을 쓴 뒤 그 대상을 뺀 가장 가까운 적에게 같은 사격을 [p:0.5]의 피해로 가합니다. 적이 1명이면 쏘지 않습니다.',
      'mj.blacksail': '약탈 사격이 적중하면 대상에게 [p:0.5] 기본 확률로 [fx:fear:1.5] 효과를 부여합니다.',
      'mj.plunder': '약탈자로 크레딧을 얻는 처치 횟수 상한이 전투당 3회에서 5회로 증가합니다.',
      'mj.aim': '사거리 +1, 치명타 확률 [pp:0.1].',
      'mj.hot': '재장전이 끝나면 [s:3]간 치명타 확률이 [pv:0.25], 공격 속도가 [pv:0.25] 증가합니다.',
      'mj.first': '전투가 시작될 때 궁극기 게이지가 [pp:0.3] 더 차 있습니다. 궁극기 충전 효율이 [pv:0.15] 증가합니다.',
      'mj.twin': '기본 공격 피해가 [pv:0.3] 감소합니다. 대신 기본 공격을 할 때마다 사거리 안의 다른 적 1명에게 같은 피해로 한 발 더 쏘며, 다른 적이 없으면 같은 적에게 쏩니다. 탄창이 2배로 증가합니다.',
      'mj.captain': '궁극기 충전 효율이 [pv:0.4] 증가합니다. 약탈 개시를 쓰면 [s:6]간 공격 속도가 [pv:0.4], 가하는 피해가 [pv:0.25] 증가하고, 약탈 사격의 쿨다운이 초기화됩니다.',
    },
  },
  petrock: {
    brief: { skill: '아무것도 하지 않습니다.', trait: '칸만 차지하고, 적의 대상이 되지 않습니다.' },
    skill: () => ({ tgt: '없음', range: null, area: { k: 'one' }, rows: [['효과', '아무것도 하지 않는다.']], text: '아무것도 하지 않습니다.' }),
    trait: lines(
      '공격 · 이동 · 스킬을 하지 않고 칸만 차지합니다.',
      '적의 대상으로 지정되지 않고, 승패 판정에 세지 않습니다.',
      '시너지 · 공명 등급 성장 · 장비 칸이 없습니다.',
    ),
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
