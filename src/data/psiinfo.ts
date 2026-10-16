// 사이오닉 비술 · 지속 능력의 상세 정보 (전투 스킬과 같은 형식: 대상 · 사거리 · 범위 · 항목별 토큰 문장)
// 수치는 엔진과 같은 표(psinum.ts)에서 읽는다. 전공 증강(◆ 변형 포함)을 가진 기물은 cantripView · passiveView 로
// 실제로 적용 중인 모습을 받는다 (상세 창 · 칩 · 팝업 · 전투 중 표시 · 도감 공용).
import type { SkillInfo } from './abiltext';
import { cantripCdOf, CONDUCT_SNAP, PSI, PSI_HIT, PSI_ICD } from './psinum';
import { SCHOOL_BY_ID, SCHOOL_PASSIVES, SCHOOLS, TRANSFORM_KEYS, type SchoolId } from './schools';

/** 보유 증강 목록 → has('전공.키') */
export type AugList = readonly (string | { id: string })[];
export function psiHas(augs: AugList = []): (k: string) => boolean {
  const set = new Set(augs.map((a) => (typeof a === 'string' ? a : a.id)).filter((id) => id.startsWith('psi.')).map((id) => id.slice(4)));
  return (k) => set.has(k);
}
const augName = (sid: SchoolId, key: string) => SCHOOL_PASSIVES[sid].find(([k]) => k === key)?.[1] || key;

export interface CantripView {
  /** 대상 · 사거리 · 범위 · 수치 행 */
  info: SkillInfo;
  name: string;
  /** 쿨다운 (변동성 · 분신 반영, 열폭주는 행으로) · 이성 소모 */
  cd: number; cost: number;
  /** 비술을 바꾼 ◆ 변형 증강 이름 (없으면 null) */
  transform: string | null;
  /** 수치 · 동작을 바꾼 다른 전공 증강 이름 */
  mods: string[];
}
export interface PassiveView { rows: [string, string][]; brief: string; transform: string | null; mods: string[] }

/** 증강 사용 기록: 실제로 설명을 바꾼 증강만 mods 에 남긴다 */
function tracker(sid: SchoolId, augs: AugList) {
  const has = psiHas(augs);
  const used = new Set<string>();
  const use = (key: string) => { const on = has(`${sid}.${key}`); if (on) used.add(key); return on; };
  const tf = TRANSFORM_KEYS[sid];
  const out = (changedByTf: boolean) => ({
    transform: changedByTf && used.has(tf) ? augName(sid, tf) : null,
    mods: [...used].filter((k) => k !== tf || !changedByTf).map((k) => augName(sid, k)),
  });
  return { use, out };
}

// ───────────────────────── 비술
type Build = (use: (k: string) => boolean) => { info: SkillInfo; tf: boolean };
const CANTRIP: Record<SchoolId, Build> = {
  pyro(use) {
    const N = PSI.pyro;
    const wp = use('wp'), white = use('white'), chain = use('chain'), runaway = use('runaway');
    const rows: [string, string][] = [
      ['피해', `대상과 주변 [t:${N.splashR}] 적 [dmg:main:${N.splash}:phys]`],
      ['소모', `대상의 [g:burn] 제거, 중첩 1당 [dmg:main:${wp ? N.wpPer : N.per}:phys]${white ? ' (방어도 감소가 남은 채로 계산)' : ''}`],
      ['연소 없음', `[g:burn] ${use('kindle') ? N.kindleSeed : N.seed}중첩`],
    ];
    if (chain) rows.push(['연쇄 소각', `연소를 소모한 적이 쓰러지면 즉시 한 번 더 (연속 최대 ${N.chainMax}회, 쿨다운 · 이성 소모 없음)`]);
    if (runaway) rows.push(['열폭주', `[g:reason] 0 미만이면 쿨다운 -[p:${1 - N.runawayCd}]`]);
    return { tf: false, info: { tgt: '연소 중첩이 가장 많은 적 (없으면 현재 대상)', range: null, area: { k: 'around', r: N.splashR }, rows } };
  },
  chrono(use) {
    const N = PSI.chrono;
    const storm = use('storm'), perma = use('perma'), stop = use('stop'), revert = use('revert');
    const extra = (rows: [string, string][]) => {
      if (stop) rows.push(['정지된 시간', `빙결된 적이 받는 피해 +[p:${N.stopVuln}]`]);
      if (revert) rows.push(['엔트로피 역류', `빙결을 걸 때마다 [g:reason] +${N.revertReason}`]);
      if (use('echo')) rows.push(['시간의 메아리', `빙결이 풀릴 때 얼어 있는 동안 받은 피해의 [p:${N.echoK}]를 한 번 더`]);
      if (use('timestop')) rows.push(['시간 정지', `${N.stopEvery}번째 시전마다 보스가 아닌 적 전원 확정 [g:freeze], 보스는 [s:${N.stopBossDur}]간 공격 · 이동 속도 -[p:${N.stopBossSlow}]`]);
      return rows;
    };
    if (use('haste')) {
      // 시간 가속 (◆): 적을 치지 않고 아군에게 공격 속도 + 서리 무장 (다음 기본 공격이 빙결 판정)
      const n = storm ? N.hasteStormN : N.hasteN;
      return { tf: true, info: { tgt: `아군 ${n}명 (기물 우선, 같은 아군 중복 없음)`, range: null, area: { k: 'one' }, rows: extra([
        ['가속', `[s:${N.hasteDur}]간 공격 속도 +[p:${storm ? N.hasteStormAtkSpd : N.hasteAtkSpd}]${storm ? ' (서리 폭풍: 대상 3 → 6명, 가속 25% → 18%)' : ''}`],
        ['서리 무장', `그 아군의 다음 기본 공격이 맞으면 [st:freeze:${perma ? N.permaDur : N.freezeDur}:${N.freezeP}] ([g:chill] 1중첩당 [pp:${N.freezePerChill}])`],
        ['소모', perma ? '빙결을 걸어도 오한이 남는다' : '빙결되면 오한 중첩 전부 제거'],
        ['적', '파편 피해 없음'],
      ]) } };
    }
    const n = storm ? N.stormShards : N.shards;
    const rows: [string, string][] = [
      ['피해', `파편 ${n}발, 각각 [dmg:main:${storm ? N.stormCoef : N.coef}:phys]`],
      ['빙결', `각 [st:freeze:${perma ? N.permaDur : N.freezeDur}:${N.freezeP}] ([g:chill] 1중첩당 [pp:${N.freezePerChill}])`],
      ['소모', perma ? '빙결을 걸어도 오한이 남는다' : '빙결되면 오한 중첩 전부 제거'],
    ];
    return { tf: false, info: { tgt: `서로 다른 적 ${n}명 (적이 적으면 중복)`, range: null, area: { k: 'one' }, rows: extra(rows) } };
  },
  volt(use) {
    const N = PSI.volt;
    const hv = use('hv');
    const overload = use('overload'), chain = use('chain'), short = use('short');
    const bounce = `[dmg:main:${Math.round(N.coef * N.bounce * 100) / 100}:elec]`;
    if (use('reverse')) {
      // 역전류 (◆): 적 대신 대상과 가장 가까운 아군에게 전도 충전. 방전 강화 증강은 충전한 아군 기준으로 작동
      const rows: [string, string][] = [
        ['충전', `[g:conduct] ${N.reverseN}중첩 (적에게 직접 피해 없음)`],
        ['전도 피해', `전도된 아군이 행동할 때마다 주변 [t:${hv ? N.hvR : N.r}] 적에게 중첩당 [dmg:main:${hv ? N.reverseHvPer : N.reversePer}:elec]`],
      ];
      if (overload) rows.push(['과부하', `그 아군이 이미 전도 ${N.overloadAt}중첩이면 소모해 주변 [t:1] 적 전원에게 [dmg:main:${N.reverseOverload}:elec] 후 다시 충전`]);
      if (chain) rows.push(['바운스', `${bounce}가 충전한 아군에서 가장 가까운 적부터 최대 ${N.bounceN}회 [g:bounce]`]);
      if (short) rows.push(['단락', `전도 ${N.overloadAt}중첩인 아군이 행동하면 범위 안 가장 가까운 적 [st:shock:${N.shortShock}] (그 아군 기준 ${N.shortIcd}초에 1회)`]);
      return { tf: true, info: { tgt: '대상과 가장 가까운 아군 (자신 포함)', range: null, area: { k: 'one' }, rows } };
    }
    const rows: [string, string][] = [
      ['피해', `[dmg:main:${N.coef}:elec]`],
      ['전도', `[g:conduct] ${N.conduct}중첩${hv ? ` (주변 [t:${N.hvR}], 중첩당 [dmg:main:${N.hvPer}:elec])` : ''}`],
    ];
    if (overload) rows.push(['과부하', `대상이 전도 ${N.overloadAt}중첩이면 중첩을 모두 소모해 [dmg:main:${N.overload}:elec] (전도를 새로 걸지 않음)`]);
    if (chain) rows.push(['바운스', `${bounce}가 대상에서 가까운 다른 적 최대 ${N.bounceN}명에게 차례로 [g:bounce] (거리 제한 없음)`]);
    if (short) rows.push(['단락', `전도 ${N.overloadAt}중첩인 적이 행동하면 [st:shock:${N.shortShock}] (같은 적 ${N.shortIcd}초에 1회)`]);
    return { tf: false, info: { tgt: '현재 대상', range: null, area: { k: 'one' }, rows } };
  },
  wave(use) {
    const N = PSI.wave;
    const attract = use('attract'), amp = use('amp'), freq = use('freq'), impact = use('impact'), seismic = use('seismic');
    const who = amp ? '대상과 주변 [t:1] 적 모두를' : '대상을';
    const rows: [string, string][] = [
      ['피해', `[dmg:main:${N.coef}:elec] (대상만)`],
      attract ? ['끌어당기기', `${who} 자기 앞 칸으로 [g:pull] (보스 제외)`] : ['밀쳐내기', `${who} [t:1] [g:knock] (보스 제외)`],
      ['공진', `${amp ? '모두에게 ' : ''}[s:${N.resDur}] [g:resonance]: 피격될 때마다 주변 [t:${attract ? N.attractResR : N.resR}] 적에게 [dmg:main:${freq ? N.freqRes : N.res}:elec]`],
    ];
    if (impact) rows.push(['충돌', `${attract ? '끌려온' : '밀려난'} 적이 다른 기물과 부딪히면 둘 다 [st:stun:${N.stun}] (부딪힌 쪽이 아군이면 적만)`]);
    if (seismic) rows.push(['진도 측정', `대상 [st:stun:${N.stun}:${N.seismicP}]`]);
    if (use('collapse')) rows.push(['중력 붕괴', `대상 주변 [t:${N.collapseR}] 적을 모두 대상 곁으로 [g:pull]하고 [g:resonance] (보스 · 고정 적 제외)`]);
    if (use('after')) rows.push(['여진', `[s:${N.afterDelay}] 뒤 같은 대상에게 [dmg:main:${N.afterCoef}:elec] + 공진 갱신 (밀쳐내기 없음)`]);
    return { tf: attract, info: { tgt: '현재 대상', range: null, area: amp ? { k: 'around', r: 1 } : { k: 'one' }, rows } };
  },
  seed(use) {
    const N = PSI.seed;
    if (use('regen')) {
      // 재생 포자 (◆): 적 대신 아군 지속 회복
      return { tf: true, info: { tgt: '체력 비율이 가장 낮은 아군 (적이 있을 때)', range: null, area: { k: 'one' }, rows: [
        ['지속 회복', `[s:${N.regenDur}] [g:regen]: 초당 [heal:${N.regenHps}:main]`],
        ['적', '피해 · 중독 없음 (지속 능력 「대사」의 중독은 그대로)'],
      ] } };
    }
    const conc = use('conc'), venom = use('venom'), endless = use('endless');
    return { tf: false, info: { tgt: '현재 대상', range: null, area: { k: 'one' }, rows: [
      ['피해', `[dmg:main:${N.coef}:chem]`],
      ['중독', `[g:poison] ${N.poison}중첩 ([s:${N.dur}], 중첩당 초당 [dmg:main:${venom ? N.venomPer : N.per}:chem], ${endless ? '중첩 제한 없음' : `최대 ${conc ? N.concMax : N.max}중첩`})`],
    ] } };
  },
  mind(use) {
    const N = PSI.mind;
    const n = use('collective') ? N.collectiveN : N.n, share = use('fate') ? N.fateShare : N.share;
    const rows: [string, string][] = [['결속', `[s:${N.bondDur}] [g:bond]: 받는 피해 +[p:${N.bondVuln}], 받은 피해의 [p:${share}]를 ${use('hive') ? '다른 결속 대상이 각각 (나누지 않음)' : '다른 결속 대상이 나눠'} 받음`]];
    const hypno = use('hypno'), asc = use('ascend'), dom = use('dominate');
    if (hypno) {
      rows.push(['혼란', `매혹 대신 결속된 적 전원 [st:confuse:${N.hypno + (asc ? N.ascendPlus : 0)}]${asc ? ' (승천 +1초)' : ''}`]);
      if (dom) rows.push(['정신 지배', `혼란된 적이 같은 편에게 주는 피해 +[p:${N.dominate}]`]);
    } else {
      rows.push(['매혹', asc ? `대상이 일반 적이면 [st:charm:${N.charm + N.ascendPlus}], 엘리트면 절반` : `대상이 일반 적이면 [st:charm:${N.charm}]`]);
      if (dom) rows.push(['정신 지배', `매혹된 적이 주는 피해 +[p:${N.dominate}]`]);
    }
    if (use('puppet')) rows.push(['꼭두각시', `${hypno ? '혼란' : '매혹'}이 끝날 때 체력 [p:${N.puppetHp}] 이하인 일반 적${asc ? ' (승천: 엘리트도)' : ''}은 전투 끝까지 [g:charm] (전투당 최대 ${N.puppetMax}명)`]);
    return { tf: hypno, info: { tgt: `현재 대상과 주변 적 (최대 ${n}명)`, range: null, area: { k: 'around', r: 1 }, rows } };
  },
  gold(use) {
    const N = PSI.gold;
    const insider = use('insider'), lev = use('leverage'), div = use('dividend'), hedge = use('hedge'), safe = use('safe');
    const fail = safe ? `체력이 가장 낮은 아군 ${N.safeN}명에게 [shield:${N.safeShield}:main]` : `체력이 가장 낮은 아군에게 [shield:${N.shield}:main]`;
    const rows: [string, string][] = [
      ['확률', hedge ? '언제나 성공과 실패를 모두 (완전 헤지)' : `[p:${N.base}] + [p:${N.perReason}] × |이성|/100${insider ? ` [pp:${N.insider}]` : ''}`],
      ['성공', div ? `아군 최대 ${N.divN}명에게 무작위 재료 장비 1개씩 [g:tempgear] (성공 ${N.divMax}회까지, 기물당 최대 ${N.max}개)` : `무작위 재료 장비 1개를 [g:tempgear] (최대 ${N.max}개)`],
    ];
    if (hedge) rows.push(...(lev ? [['레버리지', '임시 장비 효과 2배']] as [string, string][] : []), ['실패 몫', `${fail} (언제나, 자해 없음)`]);
    else if (lev) rows.push(['레버리지', '임시 장비 효과 2배'], ['실패', `보호막 없이 자신이 최대 체력 [p:${N.leverageSelf}] 피해`], ['더 못 받음', fail]);
    else rows.push(['실패', `${fail} (성공했지만 더 장착할 수 없을 때도)`]);
    return { tf: div, info: { tgt: div ? `아군 최대 ${N.divN}명 (소환물 제외)` : '자신', range: div ? null : 0, area: div ? { k: 'one' } : { k: 'self', r: 0 }, rows } };
  },
  illusion(use) {
    const N = PSI.illusion;
    const troupe = use('troupe'), max = troupe ? N.troupeMax : N.max;
    const clone = use('clone'), solid = use('solid');
    const rows: [string, string][] = [];
    if (clone) {
      // 분신 (◆): 자신의 능력치 · 공격 방식을 물려받은 소환물
      rows.push(
        ['소환', `자신의 [g:clone] 1기 ([s:${(troupe ? N.troupeCloneLife : N.cloneLife) + (use('linger') ? N.lingerClone : 0)}], 최대 ${max}기)${troupe ? ' (군무: 지속 12 → 18초, 분신 여러 기가 함께 싸운다)' : ''}`],
        ['능력치', `자신의 능력치 · 무기 · 공격 방식을 물려받음. 체력 = 자신 최대 체력 [p:${solid ? N.solidCloneHp : N.cloneHp}], 주는 피해 [p:${N.cloneDmg}]`],
      );
      if (solid) rows.push(['실체화', `체력 [p:${N.cloneHp}] → [p:${N.solidCloneHp}], 받는 피해 -[p:${N.solidCloneRed}], 기본 공격이 맞으면 [dmg:main:${N.solidCloneHit}:psy] 추가`]);
      rows.push(['도발', '없음 (분신은 직접 싸운다)']);
    } else {
      const linger = use('linger');
      rows.push(
        ['소환', `[g:illusion] 1기 ([s:${linger ? N.lingerLife : N.life}], 최대 ${max}기, 체력 = 자신 최대 체력 [p:${linger ? N.lingerHp : N.hp}])`],
        ['도발', '주변 [t:1] 적은 환영을 우선 공격 ([g:taunt])'],
      );
      if (solid) rows.push(['실체화', `환영이 [dmg:main:${N.solid}:psy]로 공격 (제자리, 사거리 [t:1])`]);
    }
    const who = clone ? '분신' : '환영';
    if (use('echo')) rows.push(['잔향', `${who}이 사라질 때 주변 [t:1] 적에게 [dmg:main:${N.echo}:psy]`]);
    if (use('fog')) rows.push(['안개', `${who} 주변 [t:1] 적 명중 [pp:${-N.fog}]`]);
    if (use('disrupt')) rows.push(['교란', `${who}을 공격한 적 공격 속도 -[p:${N.disrupt}] (최대 ${N.disruptMax}중첩, 4초)`]);
    if (use('mirage')) rows.push(['신기루', `${who}이 하나라도 있으면 자신은 [g:stealth], 은신 중 주는 피해 +[p:${N.mirageDmg}]`]);
    if (use('mirror')) rows.push(['거울 상', `대상 적(보스 제외)의 능력치 · 기본 공격을 복사한 아군 ([s:${N.mirrorLife}], 체력 [p:${N.mirrorHp}], 피해 [p:${N.mirrorDmg}], 최대 1기)`]);
    return { tf: clone, info: { tgt: clone ? '자신 곁 빈칸' : '현재 대상 근처 빈칸', range: null, area: clone ? { k: 'one' } : { k: 'around', r: 1 }, rows } };
  },
};

/** 기물의 전공 증강을 반영한 실제 비술 */
export function cantripView(sid: SchoolId, augs: AugList = []): CantripView {
  const s = SCHOOL_BY_ID[sid];
  const { use, out } = tracker(sid, augs);
  const { info, tf } = CANTRIP[sid](use);
  const cd = cantripCdOf(sid, (k) => k.startsWith(`${sid}.`) && use(k.slice(sid.length + 1)));
  return { info, name: s.cantrip.name, cd, cost: s.cantrip.cost, ...out(tf) };
}

// ───────────────────────── 지속 능력
/** 피해량 비례 확률 (파장 · 시공) */
const HIT_SCALED = (p: number) => `평타 · 전투 스킬 · 비술 적중 시 [p:${p}] × (이번 피해 ÷ 주요 위력 ${Math.round(PSI_HIT.ref * 100)}%), 최대 [p:${p * PSI_HIT.max}]`;
/** 같은 대상 재판정 대기 (환조 · 정신) */
const PER_TARGET = (p: number) => `평타 · 전투 스킬 · 비술 적중 시 [p:${p}] (같은 대상에게는 [s:${PSI_ICD}]에 한 번만 판정)`;
type PBuild = (use: (k: string) => boolean) => { rows: [string, string][]; brief: string; tf: boolean };
const PASSIVE: Record<SchoolId, PBuild> = {
  pyro(use) {
    const N = PSI.pyro;
    const wp = use('wp'), beacon = use('beacon'), runaway = use('runaway');
    const max = wp ? N.wpMax : N.max;
    const eff: [string, string] = ['효과', `[g:burn] 1중첩: 중첩당 초당 [dmg:main:${N.dps}:phys]`];
    const stack: [string, string] = ['중첩', `최대 ${max} · [s:${use('kindle') ? N.kindleDur : N.dur}] · 걸 때마다 갱신${use('nova') ? ` · 최대 중첩이면 초신성 폭발 (주변 [t:${N.novaR}], 중첩당 [dmg:main:${N.novaPer}:phys])` : ''}`];
    if (beacon) return { tf: true, brief: `아군 기본 공격 ${Math.round(N.beacon * 100)}% 연소`, rows: [['발동', `아군 전원의 기본 공격 적중 시 [p:${N.beacon}]${runaway ? ` ([g:reason] 0 미만이면 [p:${N.beacon * N.runawayProc}])` : ''} (자신의 평타 · 스킬 · 비술 발화는 0)`], eff, stack] };
    return { tf: false, brief: `적중 시 ${Math.round(N.proc * 100)}% 연소`, rows: [
      ['발동', `평타 · 전투 스킬 · 비술 적중 시 [p:${N.proc}]${runaway ? ` ([g:reason] 0 미만이면 [p:${N.proc * N.runawayProc}])` : ''}`], eff, stack] };
  },
  chrono(use) {
    const N = PSI.chrono;
    const zero = use('zero');
    const rows: [string, string][] = [
      ['발동', HIT_SCALED(N.proc)],
      ['효과', `[g:chill] 1중첩: 중첩당 초당 [dmg:main:${N.chillDps}:phys], 이동 · 공격 속도 -${Math.round(N.chillSlow * 100)}%p, 빙결 확률 [pp:${N.freezePerChill}]`],
      ['중첩', `최대 ${zero ? N.zeroMax : N.chillMax} · [s:5]`],
    ];
    if (zero) rows.push(['절대 영도', `${N.zeroMax}중첩인 적에게 다음 적중은 확정 [g:freeze]`]);
    if (use('rime')) rows.push(['서리 갑옷', `자신을 공격한 적에게 [g:chill] 1중첩 (같은 적 [s:${N.rimeIcd}]에 1회)`]);
    return { tf: false, brief: `적중 시 ${Math.round(N.proc * 100)}% 오한 (피해 비례)`, rows };
  },
  volt(use) {
    const N = PSI.volt;
    const hv = use('hv'), proc = use('static') ? N.staticProc : N.proc;
    const extra: [string, string][] = [];
    if (use('grid')) extra.push(['전력망', `전도된 대상이 행동할 때 범위 밖 무작위 적 ${N.gridN}명에게도 같은 피해`]);
    if (use('avatar')) extra.push(['뇌신 강림', `자신이 사라지지 않는 [g:conduct] ${N.avatarN}중첩: 행동할 때마다 주변 [t:${N.avatarR}] 적에게 중첩당 [dmg:main:${hv ? N.avatarHvPer : N.avatarPer}:elec]`]);
    if (use('reverse')) return { tf: true, brief: `적중 시 ${Math.round(proc * 100)}% 아군 전도`, rows: [
      ['발동', `평타 · 전투 스킬 · 비술 적중 시 [p:${proc}]`],
      ['효과', `적 대신 대상과 가장 가까운 아군에게 [g:conduct] 1중첩: 그 아군이 행동할 때마다 주변 [t:${hv ? N.hvR : N.r}] 적에게 중첩당 [dmg:main:${hv ? N.reverseHvPer : N.reversePer}:elec]`],
      ['중첩', `최대 ${N.max} · [s:${N.dur}]`], ...extra,
    ] };
    return { tf: false, brief: `적중 시 ${Math.round(proc * 100)}% 전도`, rows: [
      ['발동', `평타 · 전투 스킬 · 비술 적중 시 [p:${proc}]`],
      ['효과', `[g:conduct] 1중첩: 대상이 행동할 때마다 주변 [t:${hv ? N.hvR : N.r}] 다른 적에게 중첩당 [dmg:main:${hv ? N.hvPer : N.per}:elec] × (건 피해 ÷ 주요 위력, 최대 ${CONDUCT_SNAP.max}배)`],
      ['기준', '전도를 건 순간의 피해량으로 고정 (같은 대상에 다시 걸면 더 큰 쪽)'],
      ['중첩', `최대 ${N.max} · [s:${N.dur}]`], ...extra,
    ] };
  },
  wave(use) {
    const N = PSI.wave;
    const attract = use('attract'), freq = use('freq');
    return { tf: attract, brief: `적중 시 ${Math.round(N.proc * 100)}% 공진 (피해 비례)`, rows: [
      ['발동', HIT_SCALED(N.proc)],
      ['효과', `[s:${N.resDur}] [g:resonance]: 피격될 때마다 주변 [t:${attract ? N.attractResR : N.resR}] 적에게 [dmg:main:${freq ? N.freqRes : N.res}:elec] (${N.resIcd}초에 1회)`],
      ...(use('cascade') ? [['공명 연쇄', '공진 피해를 받은 적에게도 공진이 옮겨 붙는다']] as [string, string][] : []),
    ] };
  },
  seed(use) {
    const N = PSI.seed;
    const rows: [string, string][] = [
      ['발동', `평타 · 전투 스킬 · 비술 적중 시 [p:${N.proc}]`], ['효과', `[g:poison] 1중첩${use('venom') ? ` (중첩당 초당 [dmg:main:${N.venomPer}:chem])` : ''}`], ['중첩', use('endless') ? '제한 없음' : `최대 ${use('conc') ? N.concMax : N.max}`]];
    if (use('colony')) rows.push(['포자 군락', `중독된 적이 쓰러지면 아군 포자 군락 ([s:${N.colonyLife}], 1초마다 주변 [t:1] 적 중독 1중첩, 최대 ${N.colonyMax}기)`]);
    return { tf: false, brief: `적중 시 ${Math.round(N.proc * 100)}% 중독`, rows };
  },
  mind(use) {
    const N = PSI.mind;
    const er = use('erode'), p = er ? N.erodeProc : N.proc;
    return { tf: false, brief: `적중 시 ${Math.round(p * 100)}% 혼란`, rows: [
      ['발동', PER_TARGET(p)], ['효과', `[st:confuse:${er ? N.erodeConfuse : N.confuse}]: 가까운 아무나 공격 (같은 편 포함)`]] };
  },
  gold(use) {
    const N = PSI.gold;
    const div = use('dividend'), lev = use('leverage');
    return { tf: div, brief: `임시 장비당 피해 +${Math.round(N.perDmg * 100)}% · 경감 +${Math.round(N.perRed * 100)}%`, rows: [
      ['조건', div ? `[g:tempgear] 1개당 (배당: 성공 횟수 + 자신이 받은 임시 장비, 최대 ${N.max})` : '[g:tempgear] 1개당'],
      ['효과', `주는 피해 +[p:${N.perDmg}], [g:red] +[p:${N.perRed}]${lev ? ' (장비 효과는 레버리지로 2배)' : ''}`]] };
  },
  illusion(use) {
    const N = PSI.illusion;
    return { tf: false, brief: `적중 시 ${Math.round(N.proc * 100)}% 향취`, rows: [
      ['발동', PER_TARGET(N.proc)],
      ['효과', `[st:scent:${N.scentDur}]: 회피 [pp:${-N.scentEva}], 받는 피해 +[p:${N.scentVuln}]${use('dense') ? ` (최대 ${N.denseMax}중첩)` : ''}`]] };
  },
};
/** 기물의 전공 증강을 반영한 실제 지속 능력 */
export function passiveView(sid: SchoolId, augs: AugList = []): PassiveView {
  const { use, out } = tracker(sid, augs);
  const { rows, brief, tf } = PASSIVE[sid](use);
  return { rows, brief, ...out(tf) };
}

/** 비술 기본형 (증강 없음) */
export const CANTRIP_INFO = Object.fromEntries(SCHOOLS.map((s) => [s.id, cantripView(s.id).info])) as Record<SchoolId, SkillInfo>;
/** 지속 능력 기본형: 발동 조건 · 효과 */
export const PASSIVE_INFO = Object.fromEntries(SCHOOLS.map((s) => [s.id, passiveView(s.id).rows])) as Record<SchoolId, [string, string][]>;
/** 지속 능력 한 줄 요약 (섹션 카드용) */
export const PASSIVE_BRIEF = Object.fromEntries(SCHOOLS.map((s) => [s.id, passiveView(s.id).brief])) as Record<SchoolId, string>;
/** ◆ 변형 증강 id → 그 증강 하나만 가졌을 때의 비술 · 지속 능력 (도감 · 증강 상세용) */
export function transformPreview(augId: string): { sid: SchoolId; cantrip: CantripView; passive: PassiveView } | null {
  const [, s, k] = augId.split('.');
  const sid = s as SchoolId;
  if (!augId.startsWith('psi.') || TRANSFORM_KEYS[sid] !== k) return null;
  return { sid, cantrip: cantripView(sid, [augId]), passive: passiveView(sid, [augId]) };
}
/** 전공 핵심 한 줄 (전공 선택 카드용) */
export const SCHOOL_LINE: Record<SchoolId, string> = {
  pyro: '연소를 쌓아 두었다가 비술로 한꺼번에 터뜨린다.',
  chrono: '오한을 쌓아 적을 느리게 하고, 끝내 얼려 버린다.',
  volt: '전도된 적이 행동할 때마다 주변 적에게 전기 피해가 바운스된다.',
  wave: '충격파로 밀쳐내고, 맞을수록 퍼지는 공진을 건다.',
  seed: '중독을 쌓아 적을 천천히 갉아먹는다.',
  mind: '적을 서로 묶고 홀려서 혼란에 빠뜨린다.',
  gold: '임시 장비를 연성해 쌓을수록 강해진다.',
  illusion: '환영으로 적의 공격을 끌어내고 향취로 약하게 만든다.',
};
