// 사이오닉 학파별 추가 전공 증강 (학파마다 일반 2개). psionic.ts schoolPassives 풀에 합쳐진다
// 효과는 이 파일에서 훅으로 붙인다 (psionic.ts 의 비술 · 상태 생성 함수는 건드리지 않는다). 수치는 X, 설명문도 X 를 읽는다.
// 스스로 다시 번지는 효과(공진이 공진을 거는 식) · 상한 없는 중독 중첩은 만들지 않는다.
import type { Battle, CUnit, Hooks } from '../engine/combat';
import { type AugDef, type AugReq, type Effect, inc } from '../engine/effects';
import { addChill, confuse, mp } from './psionic';
import type { SchoolId } from './schools';

/** 추가 전공 증강 수치 */
export const X = {
  pyro: {
    /** 방열: 연소 피해마다 이성 · 초당 최대 */
    sinkReason: 1, sinkMax: 2,
    /** 역화: 필요한 연소 중첩 · 기절 · 같은 적 대기 */
    backAt: 3, backStun: 1, backIcd: 4,
  },
  chrono: {
    /** 해빙 한기: 빙결이 풀린 적에게 거는 오한 */
    thawChill: 2,
    /** 고요한 시간: 필요 이성 · 받는 피해 감소 */
    lullAt: 30, lullRed: 0.15,
  },
  volt: {
    /** 전류 이전: 옮겨 갈 범위 */
    relayR: 2,
    /** 아크: 필요한 전도 중첩 · 추가 피해 · 같은 적 대기 */
    arcAt: 3, arcCoef: 0.5, arcIcd: 2,
  },
  wave: {
    /** 감쇠: 공진된 적이 주는 피해 감소 */
    damp: 0.15,
    /** 반작용: 보호막 · 이성 · 1초에 최대 횟수 */
    recoilShield: 0.2, recoilReason: 2, recoilMax: 3,
  },
  seed: {
    /** 수확: 중독 1중첩당 회복 · 셈하는 최대 중첩 */
    harvest: 0.15, harvestMax: 6,
    /** 촉매: 남은 중독 피해 중 즉시 주는 비율 · 상한 (주요 위력 배수) */
    cat: 0.5, catCap: 3.75,
  },
  mind: {
    /** 단절: 다른 결속 대상 혼란 · 이성 */
    severConfuse: 1, severReason: 5,
    /** 사념 흡수: 혼란을 걸 때 이성 · 대기 · 혼란된 적에게 주는 피해 */
    siphonReason: 2, siphonIcd: 0.5, siphonDmg: 0.15,
  },
  gold: {
    /** 고위험 고수익: 이성 절댓값 기준 · 쿨다운 감소 */
    extremeAt: 50, extremeCd: 0.3,
    /** 이자 수익: 임시 장비 1개당 크레딧 · 최대 */
    interest: 1, interestMax: 3,
  },
  illusion: {
    /** 장막: 보호막 · 이성 */
    veilShield: 0.3, veilReason: 4,
    /** 환각: 혼란 확률 · 지속 · 같은 적 대기 */
    phantP: 0.25, phantDur: 1, phantIcd: 3,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const kindOf = (u: CUnit): 'shoot' | 'strike' | 'tech' => (u.ctype === 'MARK' ? 'shoot' : u.ctype === 'VAN' ? 'strike' : 'tech');
const stacksOf = (u: CUnit, k: string) => u.statuses.find((s) => s.key === k)?.stacks || 0;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
/** 대기 시간: key 가 아직 막혀 있으면 false, 아니면 막고 true */
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 1초 창 안에서 최대 n회 */
const perSec = (b: Battle, u: CUnit, key: string, n: number) => {
  const w = Math.floor(b.t);
  if (u.mem[`${key}W`] !== w) { u.mem[`${key}W`] = w; u.mem[`${key}N`] = 0; }
  if ((u.mem[`${key}N`] || 0) >= n) return false;
  u.mem[`${key}N`] = (u.mem[`${key}N`] || 0) + 1;
  return true;
};
/** 지금 살아 있는 자신의 환영 · 분신 (거울 상 제외) */
const shadesOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.alive && s.owner === u && s.mem.illusion);
/** 해빙 한기: 지난 틱에 자신의 빙결이 걸려 있던 적 · 장막: 지난 틱의 환영 · 분신 */
const FROZEN = new WeakMap<CUnit, Set<CUnit>>();
const SHADES = new WeakMap<CUnit, Set<CUnit>>();

const FX: Record<string, Hooks> = {
  // ───── 홍염
  'pyro.heatsink': { onDeal(b, u, t, r, o) {
    if (o.key === 'burn' && t !== u && r.amount > 0 && u.alive && perSec(b, u, 'sink', X.pyro.sinkMax)) b.addReason(u, X.pyro.sinkReason, 'pyro.heatsink');
  } },
  'pyro.backdraft': { onDeal(b, u, t, _r, o) {
    // 소각의 첫 타격 때는 연소가 아직 남아 있다 (소모는 그 뒤)
    if (o.key !== 'cantrip' || u.school !== 'pyro' || !t.alive || !foe(b, u, t) || stacksOf(t, 'burn') < X.pyro.backAt) return;
    if (icd(b, t, `backIcd${u.id}`, X.pyro.backIcd)) b.stun(u, t, X.pyro.backStun);
  } },
  // ───── 시공
  'chrono.thaw': { onTick(b, u) {
    const prev = FROZEN.get(u) || new Set<CUnit>(), now = new Set<CUnit>();
    for (const e of b.enemiesOf(u)) if (e.statuses.some((s) => s.key === 'freeze' && s.src === u)) now.add(e);
    for (const e of prev) if (!now.has(e) && e.alive && foe(b, u, e)) addChill(b, u, e, X.chrono.thawChill);
    FROZEN.set(u, now);
  } },
  'chrono.lull': { takenMult: (b, u) => ((u.reason ?? 0) >= X.chrono.lullAt && b.enemiesOf(u).some((e) => e.statuses.some((s) => s.key === 'freeze')) ? 1 - X.chrono.lullRed : 1) },
  // ───── 뇌전
  'volt.relay': { onAnyDeath(b, u, dead) {
    if (!u.alive || !foe(b, u, dead)) return;
    const s = dead.statuses.find((x) => x.key === 'conduct' && x.src === u);
    if (!s) return;
    const near = b.around(dead, X.volt.relayR, b.enemiesOf(u)).filter((e) => e !== dead && e.alive);
    const e = near.length ? b.nearest(dead, near) : null;
    if (!e) return;
    b.emit({ k: 'atk', from: dead.id, to: e.id, elem: 'elec', ranged: true, chain: true });
    b.applyStatus(u, e, { ...s, dur: Math.max(s.dur, 1) }); // 남은 중첩 그대로 (옮길 뿐 늘지 않는다)
  } },
  'volt.arc': { onDeal(b, u, t, r, o) {
    if ((o.tag !== 'basic' && o.tag !== 'skill') || r.miss || !t.alive || !foe(b, u, t) || stacksOf(t, 'conduct') < X.volt.arcAt) return;
    if (!icd(b, t, `arcIcd${u.id}`, X.volt.arcIcd)) return;
    b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true, chain: true });
    b.dealDamage(u, t, mp(b, u) * X.volt.arcCoef, { elem: 'elec', tag: 'proc', kind: kindOf(u) });
  } },
  // ───── 파장
  'wave.dampen': { onTick(b, u, dt) {
    u.mem.dampT = (u.mem.dampT || 0) - dt;
    if (u.mem.dampT > 0) return;
    u.mem.dampT = 0.25;
    for (const e of b.enemiesOf(u)) {
      if (!e.statuses.some((s) => s.key === 'resonance' && s.src === u)) continue;
      const ex = e.statuses.find((s) => s.key === 'psi.dampen');
      if (ex) ex.dur = Math.max(ex.dur, 0.4);
      else e.statuses.push({ type: 'buff', key: 'psi.dampen', dur: 0.4, mods: [inc('all', -X.wave.damp)], src: u, label: '감쇠' });
    }
  } },
  'wave.recoil': { onDisplace(b, u, victim, src, kind) {
    if (src !== u || kind === 'move' || !u.alive || !foe(b, u, victim) || !perSec(b, u, 'recoil', X.wave.recoilMax)) return;
    b.shield(u, mp(b, u) * X.wave.recoilShield);
    b.addReason(u, X.wave.recoilReason, 'wave.recoil');
  } },
  // ───── 파종
  'seed.harvest': { onAnyDeath(b, u, dead) {
    if (!u.alive || !foe(b, u, dead)) return;
    const s = dead.statuses.find((x) => x.key === 'poison' && x.src === u);
    const a = s ? b.lowestHpAlly(u) : null;
    if (s && a) { b.heal(u, a, mp(b, u) * X.seed.harvest * Math.min(X.seed.harvestMax, s.stacks || 1)); b.fx(a.x, a.y, 0, 'chem', 'heal'); }
  } },
  'seed.catalyst': { onDeal(b, u, t, _r, o) {
    // 포자의 피해는 중독을 걸기 전에 들어간다: 여기서 보이는 중독은 이미 있던 것
    if (o.key !== 'cantrip' || u.school !== 'seed' || !t.alive || !foe(b, u, t)) return;
    const s = t.statuses.find((x) => x.key === 'poison' && x.src === u);
    if (!s || !s.dps || s.dur <= 0) return;
    const v = Math.min(s.dps * s.dur * X.seed.cat, mp(b, u) * X.seed.catCap);
    b.fx(t.x, t.y, 0, 'chem');
    b.dealDamage(u, t, v, { elem: 'chem', tag: 'proc', kind: kindOf(u) });
  } },
  // ───── 정신
  'mind.sever': { onAnyDeath(b, u, dead) {
    if (!u.alive || !foe(b, u, dead)) return;
    const bd = dead.statuses.find((x) => x.key === 'bond' && x.src === u);
    if (!bd) return;
    for (const e of b.enemiesOf(u)) if (e !== dead && e.statuses.some((x) => x.key === 'bond' && x.grp === bd.grp)) confuse(b, u, e, X.mind.severConfuse);
    b.addReason(u, X.mind.severReason, 'mind.sever');
  } },
  'mind.siphon': {
    onInflict(b, u, t, s) { if (s.key === 'confuse' && foe(b, u, t) && icd(b, u, 'siphonIcd', X.mind.siphonIcd)) b.addReason(u, X.mind.siphonReason, 'mind.siphon'); },
    dmgMult: (b, u, t) => (foe(b, u, t) && t.statuses.some((s) => s.key === 'confuse') ? 1 + X.mind.siphonDmg : 1),
  },
  // ───── 보화
  'gold.extreme': { onCantrip(_b, u) {
    if (u.school === 'gold' && Math.abs(u.reason ?? 0) >= X.gold.extremeAt) u.cantripCd *= 1 - X.gold.extremeCd;
  } },
  // ───── 환조
  'illusion.veil': { onTick(b, u) {
    const prev = SHADES.get(u) || new Set<CUnit>(), now = new Set(shadesOf(b, u));
    for (const s of prev) if (!now.has(s) && u.alive) {
      b.shield(u, mp(b, u) * X.illusion.veilShield);
      b.addReason(u, X.illusion.veilReason, 'illusion.veil');
    }
    SHADES.set(u, now);
  } },
  'illusion.phantasm': { onTick(b, u) {
    for (const s of shadesOf(b, u)) {
      if (s.mem.phantHook) continue;
      s.mem.phantHook = 1;
      s.hooks.push({ onHurt(bb, self, src, _r, o) {
        if ((o.tag !== 'basic' && o.tag !== 'skill') || !src.alive || !u.alive || bb.sideOf(src) === bb.sideOf(self)) return;
        if (icd(bb, src, `phantIcd${u.id}`, X.illusion.phantIcd)) confuse(bb, u, src, X.illusion.phantDur, X.illusion.phantP);
      } });
    }
  } },
};

/** 전투 뒤 런 단위 효과 */
const AFTER: Record<string, AugDef['after']> = {
  // 이자 수익: 이긴 전투가 끝날 때 장착한 임시 장비 1개당 크레딧
  'gold.interest': (run, _u, won, _k, x) => {
    const n = Math.min(X.gold.interestMax, x?.c?.mem.goldItems || 0);
    if (won && n > 0) run.credits += n * X.gold.interest;
  },
};
const REQ: Record<string, AugReq> = {
  'chrono.lull': { hint: `이성 ${X.chrono.lullAt} 이상일 때만 작동`, reason: 'hi30' },
  'volt.arc': { hint: `전도 ${X.volt.arcAt}중첩 필요`, stacks: { st: 'conduct', need: X.volt.arcAt } },
};

/** [키, 이름, 설명] — 설명의 수치는 X 에서 */
const DEFS: Record<SchoolId, [key: string, name: string, desc: string][]> = {
  pyro: [
    ['heatsink', '방열', `자신이 건 연소가 피해를 줄 때마다 이성 +${X.pyro.sinkReason} (초당 최대 +${X.pyro.sinkMax}).`],
    ['backdraft', '역화', `소각에 맞은 적이 연소 ${X.pyro.backAt}중첩 이상이면 ${X.pyro.backStun}초 기절 (같은 적은 ${X.pyro.backIcd}초에 1회).`],
  ],
  chrono: [
    ['thaw', '해빙 한기', `자신이 건 빙결이 풀린 적에게 오한 ${X.chrono.thawChill}중첩.`],
    ['lull', '고요한 시간', `이성 ${X.chrono.lullAt} 이상이면 빙결된 적이 하나라도 있는 동안 받는 피해 -${pc(X.chrono.lullRed)}.`],
  ],
  volt: [
    ['relay', '전류 이전', `자신이 건 전도가 남은 적이 쓰러지면 그 전도를 ${X.volt.relayR}칸 안의 가장 가까운 다른 적에게 그대로 옮긴다 (중첩은 늘지 않는다).`],
    ['arc', '아크', `전도 ${X.volt.arcAt}중첩인 적에게 기본 공격 · 전투 스킬이 맞으면 주요 위력 ${pc(X.volt.arcCoef)} 전기 추가 피해 (같은 적에게 ${X.volt.arcIcd}초에 1회).`],
  ],
  wave: [
    ['dampen', '감쇠', `자신이 건 공진이 남은 적은 주는 피해 -${pc(X.wave.damp)}.`],
    ['recoil', '반작용', `적을 밀쳐내거나 끌어당길 때마다 자신에게 주요 위력 ${pc(X.wave.recoilShield)} 보호막, 이성 +${X.wave.recoilReason} (1초에 최대 ${X.wave.recoilMax}회).`],
  ],
  seed: [
    ['harvest', '수확', `자신이 건 중독이 남은 적이 쓰러지면 체력 비율이 가장 낮은 아군을 중독 1중첩당 주요 위력 ${pc(X.seed.harvest)}만큼 회복 (최대 ${X.seed.harvestMax}중첩분).`],
    ['catalyst', '촉매', `포자가 이미 중독된 적에게 맞으면 그 중독의 남은 피해 ${pc(X.seed.cat)}를 즉시 준다 (최대 주요 위력 ${pc(X.seed.catCap)}, 중독은 그대로). 재생 포자와 함께면 작동하지 않는다.`],
  ],
  mind: [
    ['sever', '단절', `결속된 적이 쓰러지면 같은 결속의 다른 적이 ${X.mind.severConfuse}초 혼란에 빠지고, 자신은 이성 +${X.mind.severReason}.`],
    ['siphon', '사념 흡수', `적을 혼란에 빠뜨릴 때마다 이성 +${X.mind.siphonReason} (${X.mind.siphonIcd}초에 1회). 혼란된 적에게 주는 피해 +${pc(X.mind.siphonDmg)}.`],
  ],
  gold: [
    ['extreme', '고위험 고수익', `시장 개입을 쓴 뒤 이성이 ${X.gold.extremeAt} 이상이거나 -${X.gold.extremeAt} 이하이면 그 쿨다운 -${pc(X.gold.extremeCd)}.`],
    ['interest', '이자 수익', `이긴 전투가 끝날 때 자신이 장착한 임시 장비 1개당 크레딧 +${X.gold.interest} (최대 +${X.gold.interestMax * X.gold.interest}).`],
  ],
  illusion: [
    ['veil', '장막', `자신의 환영 · 분신이 쓰러지거나 사라질 때마다 자신에게 주요 위력 ${pc(X.illusion.veilShield)} 보호막, 이성 +${X.illusion.veilReason}.`],
    ['phantasm', '환각', `환영 · 분신을 공격한 적은 ${pc(X.illusion.phantP)} 확률로 ${X.illusion.phantDur}초 혼란 (같은 적은 ${X.illusion.phantIcd}초에 1회 판정).`],
  ],
};

function extraEffect(sid: SchoolId, key: string): Effect {
  const id = `${sid}.${key}`;
  // ps.<전공>.<키> 플래그: psionic.ts 의 전공 증강과 같은 보유 표시
  return { setup: (u) => { u.mem[`ps.${id}`] = 1; }, hooks: FX[id] };
}

export const PSI_EXTRA: Record<string, AugDef[]> = Object.fromEntries(Object.entries(DEFS).map(([sid, list]) => [sid, list.map(([key, name, desc]): AugDef => ({
  id: `psi.${sid}.${key}`, name, desc, pool: 'psionic', owner: sid,
  effect: () => extraEffect(sid as SchoolId, key),
  requires: REQ[`${sid}.${key}`],
  after: AFTER[`${sid}.${key}`],
}))]));
