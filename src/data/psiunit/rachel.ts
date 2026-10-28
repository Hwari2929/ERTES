// 사이오닉 전용 전공 증강: rachel (kit.ts 참고) — 학파가 없어 전공 8개 × 3개
// 레이첼: 에란테스의 새 지휘관 · 아문센의 양녀 · 구인류 최후의 생존자 (심장이 암흑물질 반응로, 식사량 4배, "꼭 지금 해야 돼?").
// 엮는 것: 특성 [암흑물질 붕괴] (정신 피해 15% 회복 · 기본 공격 고정 피해 · 피니쉬 확산 고정 피해), 무기 [암흑물질 노심] (물리 + 정신 혼합, 4타 피니쉬),
// 전투 스킬 [염동 제압] (정신 피해 + 기절, 대상 너머로 순간이동 · 그 칸의 적 밀쳐내기), 고유 능력 [파괴 광선!] (우리의 출항기!),
// 이성 규칙 (피니쉬마다 -5, 주변 1칸 아군이 맞으면 +4).
// 수치는 RA, 설명문도 RA 를 읽는다. 스스로 다시 번지는 효과 · 상한 없는 중첩은 만들지 않는다 (대기 시간 · 초당 상한).
import type { Battle, CUnit, DmgOpts, Status } from '../../engine/combat';
import { type AugDef, vuln } from '../../engine/effects';
import { addBurn, addChill, CANTRIPS, confuse, giveTempItem, mp, resonanceStatus } from '../psionic';
import { PSI, psiStackCap } from '../psinum';
import { PSI_STATUS } from '../schools';
import { pu } from './kit';

/** 레이첼 전용 전공 증강 수치 */
export const RA = {
  pyro: {
    /** 노심 점화: 피니쉬 대상에게 더하는 연소 · 확산 범위의 적(대상 포함)에게 거는 연소 */
    igniteMain: 1, igniteSplash: 1,
    /** 임계 붕괴: 거둔 연소 1중첩당 정신 피해 (주요 위력 배수) */
    critPer: 0.3,
    /** 야간 당직: 거는 연소 · 같은 적 대기 · 연소 1중첩당 보호막 · 초당 최대 보호막 횟수 */
    watchBurn: 1, watchIcd: 1, watchShield: 0.06, watchMax: 2,
  },
  chrono: {
    /** 정지 화면: 거는 오한 · 빙결로 바꾸는 오한 중첩 */
    frameChill: 2, frameAt: 2,
    /** 빨리 감기: 콤보 가속에 필요한 오한 중첩 · 피니쉬가 거는 오한 */
    ffAt: 1, ffChill: 1,
    /** 5분만 더: 미루는 시간 · 미룬 피해 중 받는 비율 */
    snoozeDur: 3, snoozeK: 0.5,
  },
  volt: {
    /** 강제 방전: 같은 적 대기 */
    forceIcd: 2,
    /** 과전류 제압: 범위 · 거둔 전도 1중첩당 전기 피해 · 감전 */
    overR: 2, overPer: 0.25, overShock: 0.5,
    /** 피뢰침: 전기 피해 · 대기 */
    rodCoef: 0.3, rodIcd: 1.5,
  },
  wave: {
    /** 새치기 금지: 자신과의 거리 · 같은 적 대기 */
    queueR: 2, queueIcd: 4,
    /** 암흑물질 중력: 끌어당기는 범위 · 최대 인원 */
    gravR: 2, gravN: 2,
  },
  seed: {
    /** 소화: 남은 중독 피해 중 즉시 주는 비율 · 상한 (주요 위력 배수) */
    digestK: 0.8, digestCap: 2.5,
    /** 한 입만: 필요한 체력 비율 · 범위 · 지속 · 초당 회복 (주요 위력 배수) · 대기 */
    biteFull: 0.9, biteR: 2, biteDur: 3, biteHps: 0.2, biteIcd: 2,
    /** 신경독: 거는 중독 · 중독 1중첩당 기절 연장 · 최대 연장 */
    toxPoison: 2, toxPer: 0.2, toxMax: 1,
  },
  mind: {
    /** 몽롱: 혼란 · 같은 적 대기 */
    dazeDur: 1.5, dazeIcd: 7,
    /** 연대 책임: 피니쉬 피해 중 나눠 주는 고정 피해 */
    liable: 0.25,
    /** 귀찮게 하지 마: 혼란 확률 · 지속 · 같은 적 대기 · 혼란된 적에게서 더 회복하는 비율 */
    shooP: 0.25, shooDur: 1, shooIcd: 3, shooHeal: 0.15,
  },
  gold: {
    /** 본전 뽑기: 임시 장비 1개에 필요한 회복량 (최대 체력 배수) · 전투당 최대 */
    payback: 0.08, paybackMax: 2,
    /** 올인: 피니쉬마다 더 떨어지는 이성 · 줄어드는 시장 개입 쿨다운 */
    allinReason: 5, allinCd: 1,
    /** 단원 몫: 범위 · 전투당 최대 */
    shareR: 2, shareMax: 3,
  },
  illusion: {
    /** 잔상: 대기 */
    afterIcd: 8,
    /** 공유 노심: 피니쉬 피해 중 고정 피해 · 환영 · 분신 최대 수 */
    core: 0.2, coreN: 2,
    /** 대타: 넘기는 피해 비율 */
    standin: 0.25,
  },
} as const;
/** 특성 [암흑물질 붕괴]의 정신 피해 회복 비율 (rework.ts RACHEL.heal 과 같은 값) */
const TRAIT_HEAL = 0.15;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const kindOf = (u: CUnit): 'shoot' | 'strike' | 'tech' => (u.ctype === 'MARK' ? 'shoot' : u.ctype === 'VAN' ? 'strike' : 'tech');
const statusOf = (u: CUnit, k: string) => u.statuses.find((s) => s.key === k);
const stacksOf = (u: CUnit, k: string) => statusOf(u, k)?.stacks || 0;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const has = (u: CUnit) => (k: string) => !!u.mem[`ps.${k}`];
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
/** 파괴 광선!의 적중: 광선을 쏘는 순간 mem.beamT 가 0 (synergies.ts VOYAGE_SPECIAL), 빗나가지 않음 */
const isBeam = (u: CUnit, o: DmgOpts) => o.tag === 'skill' && o.elem === 'psy' && o.canMiss === false && u.mem.beamT === 0;
/** 염동 제압의 적중 (비술은 key 'cantrip', 이 파일의 부가 피해는 key 'pu.*') */
const isSkill = (u: CUnit, o: DmgOpts) => o.tag === 'skill' && o.elem === 'psy' && o.kind === 'strike' && !o.key && !isBeam(u, o);
/** 암흑물질 붕괴가 회복하는 정신 피해 (저이성 자해 제외) */
const traitPsy = (b: Battle, u: CUnit, t: CUnit, amount: number, o: DmgOpts) => o.elem === 'psy' && amount > 0 && o.key !== 'reason' && foe(b, u, t);
/** 지금 살아 있는 자신의 환영 · 분신 (거울 상 · 포자 군락 제외), 가까운 순 */
const shadesOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.alive && s.owner === u && s.mem.illusion).sort((a, c) => b.dist(a, u) - b.dist(c, u));

/** 염동 제압 한 번의 시전 기록: 첫 적중 때 만들고 onSkill 에서 거둔다 (시전 → 피해 → 기절 → 순간이동 → onSkill 순) */
interface Cast { t: number; x: number; y: number; hit: CUnit[]; pre: Map<CUnit, number>; stunned: Set<CUnit> }
const CAST = new WeakMap<CUnit, Cast>();
const castOf = (b: Battle, u: CUnit) => { const c = CAST.get(u); return c && c.t === b.t ? c : null; };
const openCast = (b: Battle, u: CUnit) => {
  let c = castOf(b, u);
  if (!c) { c = { t: b.t, x: u.x, y: u.y, hit: [], pre: new Map(), stunned: new Set() }; CAST.set(u, c); }
  return c;
};
/** 지금 시전 중인 염동 제압 기록 (onSkill 에서 꺼내고 지운다) */
const closeCast = (b: Battle, u: CUnit) => { const c = castOf(b, u); CAST.delete(u); return c; };

/** 파종 중독 (psionic.ts poisonStatus 와 같은 규칙: 맹독 · 독성 농축 · 부패 · 괴사 반영) */
function poisonOf(b: Battle, u: CUnit, n: number): Status {
  const P = has(u), per = mp(b, u) * (P('seed.venom') ? PSI.seed.venomPer : PSI.seed.per);
  return {
    type: 'dot', key: 'poison', dur: PSI.seed.dur, elem: 'chem', perDps: per, dps: per * n, stacks: n, maxStacks: psiStackCap('poison', P),
    healMul: P('seed.rot') ? 0.4 : undefined, label: PSI_STATUS.poison.name,
    onStack: P('seed.necro') ? (s) => { s.taken = (s.stacks || 0) >= PSI.seed.necroAt ? [vuln('all', PSI.seed.necroVuln)] : undefined; } : undefined,
  };
}
/** 시공 빙결 (psionic.ts freeze 와 같은 규칙: 영구 동토 · 정지된 시간 · 엔트로피 역류 반영, 오한 소모) */
function freezeOn(b: Battle, u: CUnit, t: CUnit) {
  const P = has(u);
  const ok = b.applyStatus(u, t, {
    type: 'stun', key: 'freeze', dur: P('chrono.perma') ? PSI.chrono.permaDur : PSI.chrono.freezeDur, label: PSI_STATUS.freeze.name,
    taken: P('chrono.stop') ? [vuln('all', PSI.chrono.stopVuln)] : undefined,
  });
  if (!ok) return false;
  if (!P('chrono.perma')) t.statuses = t.statuses.filter((s) => s.key !== 'chill');
  b.fx(t.x, t.y, 0, 'elec', 'aura');
  if (P('chrono.revert')) b.addReason(u, PSI.chrono.revertReason, 'chrono.revert');
  return true;
}

const PY = RA.pyro, CH = RA.chrono, VO = RA.volt, WA = RA.wave, SE = RA.seed, MI = RA.mind, GO = RA.gold, IL = RA.illusion;

export const AUGS: AugDef[] = [
  // ───────── 홍염: 과열된 노심
  pu('rachel', 'pyro', 'ignite', '노심 점화',
    `피니쉬가 맞으면 암흑물질 붕괴의 고정 피해가 퍼지는 대상과 주변 1칸 적에게 연소 ${PY.igniteSplash}중첩, 대상에게는 ${PY.igniteMain}중첩 더.`,
    { hooks: { onBasic(b, u, t, r) {
      if (!u.mem.finished || r.amount <= 0 || !foe(b, u, t)) return;
      for (const e of b.around(t, 1, b.enemiesOf(u))) if (e.alive) addBurn(b, u, e, PY.igniteSplash + (e === t ? PY.igniteMain : 0));
    } } }),
  pu('rachel', 'pyro', 'critical', '임계 붕괴',
    `염동 제압 · 파괴 광선!이 연소된 적에게 맞으면 그 연소를 모두 거두어 중첩당 주요 위력 ${pc(PY.critPer)} 정신 피해를 준다 (정신 피해라 암흑물질 붕괴로 회복한다).`,
    { hooks: { onDeal(b, u, t, r, o) {
      if ((!isSkill(u, o) && !isBeam(u, o)) || r.miss || !t.alive || !foe(b, u, t)) return;
      const s = statusOf(t, 'burn');
      if (!s) return;
      const n = s.stacks || 1;
      t.statuses = t.statuses.filter((x) => x !== s);
      b.fx(t.x, t.y, 0, 'psy');
      b.emit({ k: 'status', id: t.id, name: '임계 붕괴', src: u.id, harm: true });
      b.dealDamage(u, t, mp(b, u) * PY.critPer * n, { elem: 'psy', tag: 'proc', kind: kindOf(u), key: 'pu.critical' });
    } } }),
  pu('rachel', 'pyro', 'nightwatch', '야간 당직',
    `주변 1칸 아군을 공격한 적에게 연소 ${PY.watchBurn}중첩 (같은 적은 ${PY.watchIcd}초에 1회). 그 적의 연소 1중첩당 자신에게 주요 위력 ${pc(PY.watchShield)} 보호막 (1초에 최대 ${PY.watchMax}회).`,
    { hooks: { onAllyHurt(b, u, ally, src) {
      if (!u.alive || !src.alive || b.dist(u, ally) > 1 || !foe(b, u, src) || !icd(b, src, `puWatch${u.id}`, PY.watchIcd)) return;
      addBurn(b, u, src, PY.watchBurn);
      const n = stacksOf(src, 'burn');
      if (n > 0 && perSec(b, u, 'puWatch', PY.watchMax)) b.shield(u, mp(b, u) * PY.watchShield * n);
    } } }),

  // ───────── 시공: 박자를 당기고 일을 미룬다
  pu('rachel', 'chrono', 'stopframe', '정지 화면',
    `염동 제압에 맞은 적에게 오한 ${CH.frameChill}중첩. 이미 오한 ${CH.frameAt}중첩 이상이었으면 오한을 모두 거두고 빙결 (기절과 따로).`,
    { hooks: { onDeal(b, u, t, r, o) {
      if (!isSkill(u, o) || r.miss || !t.alive || !foe(b, u, t)) return;
      if (stacksOf(t, 'chill') >= CH.frameAt && freezeOn(b, u, t)) return;
      addChill(b, u, t, CH.frameChill);
    } } }),
  pu('rachel', 'chrono', 'ffwd', '빨리 감기',
    `오한이 ${CH.ffAt}중첩 이상인 적을 기본 공격하면 콤보가 1 더 쌓인다 (피니쉬까지 4타 → 3타). 피니쉬가 맞은 적에게 오한 ${CH.ffChill}중첩.`,
    { hooks: { onBasic(b, u, t, r) {
      if (r.amount <= 0 || !foe(b, u, t)) return;
      if (u.mem.finished) { if (t.alive) addChill(b, u, t, CH.ffChill); return; }
      const w = u.weapon;
      if (w?.kind === 'combo' && stacksOf(t, 'chill') >= CH.ffAt) u.combo = Math.min((w.combo || 3) - 1, u.combo + 1);
    } } }),
  pu('rachel', 'chrono', 'snooze', '5분만 더',
    `전투당 1회, 쓰러질 피해를 받으면 체력 1로 버티고 ${CH.snoozeDur}초 동안 받는 피해를 모두 미룬다. ${CH.snoozeDur}초 뒤 미룬 피해의 ${pc(CH.snoozeK)}를 한꺼번에 받는다 (그사이 암흑물질 붕괴로 회복해 두면 버틴다).`,
    { hooks: {
      onLethal(b, u) {
        if ((u.mem.puSnzUntil || 0) > b.t) { u.mem.puSnzAcc = (u.mem.puSnzAcc || 0) + 1 - u.hp; u.hp = 1; return true; }
        if (u.mem.puSnz) return false;
        u.mem.puSnz = 1;
        u.mem.puSnzUntil = b.t + CH.snoozeDur;
        u.mem.puSnzAcc = 1 - u.hp;
        u.hp = 1;
        b.emit({ k: 'mark', id: u.id, name: '5분만 더', style: 'rewind' });
        b.later(CH.snoozeDur, () => {
          u.mem.puSnzUntil = 0;
          if (b.over || !u.alive) return;
          b.emit({ k: 'status', id: u.id, name: '미룬 피해', harm: true });
          b.rawHit(u, u, (u.mem.puSnzAcc || 0) * CH.snoozeK, 'psy', true);
        });
        return true;
      },
      redirect(b, u, _src, dmg) {
        if ((u.mem.puSnzUntil || 0) <= b.t) return dmg;
        u.mem.puSnzAcc = (u.mem.puSnzAcc || 0) + dmg;
        return 0;
      },
    } }),

  // ───────── 뇌전: 지휘관이 피뢰침이 된다
  pu('rachel', 'volt', 'forcedc', '강제 방전',
    `피니쉬가 자신이 건 전도가 남은 적에게 맞으면 그 전도가 즉시 1번 작동한다 (그 적이 행동한 것처럼, 같은 적은 ${VO.forceIcd}초에 1회).`,
    { hooks: { onBasic(b, u, t, r) {
      if (!u.mem.finished || r.amount <= 0 || !t.alive || !foe(b, u, t)) return;
      const s = t.statuses.find((x) => x.key === 'conduct' && x.src === u && x.onAct && x.dur > 0);
      if (!s || !icd(b, t, `puForce${u.id}`, VO.forceIcd)) return;
      b.fx(t.x, t.y, 1, 'elec');
      b.emit({ k: 'status', id: t.id, name: '강제 방전', src: u.id, harm: true });
      s.onAct!(b, t, s);
    } } }),
  pu('rachel', 'volt', 'overcur', '과전류 제압',
    `염동 제압이 전도된 적에게 맞으면 그 전도를 모두 거두어, 대상과 주변 ${VO.overR}칸 적에게 거둔 중첩당 주요 위력 ${pc(VO.overPer)} 전기 피해 + ${VO.overShock}초 감전.`,
    { hooks: { onDeal(b, u, t, r, o) {
      if (!isSkill(u, o) || r.miss || !t.alive || !foe(b, u, t)) return;
      const s = statusOf(t, 'conduct');
      if (!s) return;
      const n = s.stacks || 1;
      t.statuses = t.statuses.filter((x) => x !== s);
      b.fx(t.x, t.y, VO.overR, 'elec');
      b.emit({ k: 'status', id: t.id, name: '과전류', src: u.id, harm: true });
      for (const e of b.around(t, VO.overR, b.enemiesOf(u))) {
        if (!e.alive) continue;
        if (e !== t) b.emit({ k: 'atk', from: t.id, to: e.id, elem: 'elec', ranged: true, chain: true });
        b.dealDamage(u, e, mp(b, u) * VO.overPer * n, { elem: 'elec', tag: 'proc', kind: kindOf(u), key: 'pu.overcur' });
        if (e.alive) b.applyStatus(u, e, { type: 'shock', key: 'shock', dur: VO.overShock });
      }
    } } }),
  pu('rachel', 'volt', 'rod', '피뢰침',
    `주변 1칸 아군을 공격한 적에게 주요 위력 ${pc(VO.rodCoef)} 전기 피해 (비술처럼 유도 전류가 발동할 수 있다, ${VO.rodIcd}초에 1회).`,
    { hooks: { onAllyHurt(b, u, ally, src) {
      if (!u.alive || !src.alive || b.dist(u, ally) > 1 || !foe(b, u, src) || !icd(b, u, 'puRod', VO.rodIcd)) return;
      b.emit({ k: 'atk', from: u.id, to: src.id, elem: 'elec', ranged: true, chain: true });
      // tag 'skill': 비술 적중과 같이 기본 지속 능력(유도 전류)이 판정된다
      b.dealDamage(u, src, mp(b, u) * VO.rodCoef, { elem: 'elec', tag: 'skill', kind: kindOf(u), key: 'pu.rod' });
    } } }),

  // ───────── 파장: 암흑물질의 중력과 반동
  pu('rachel', 'wave', 'tremor', '진동 제압',
    '염동 제압에 맞은 적과 순간이동으로 밀쳐낸 적에게 공진. 맞은 적의 공진은 그 일격에 곧바로 한 번 울린다.',
    { hooks: {
      onDeal(b, u, t, r, o) {
        if (!isSkill(u, o) || r.miss || !t.alive || !foe(b, u, t)) return;
        openCast(b, u);
        b.applyStatus(u, t, resonanceStatus(b, u)); // 피해 뒤의 공진 반응(onHit)이 같은 일격에 이어서 돈다
      },
      onDisplace(b, u, v, src, kind) {
        if (src !== u || kind !== 'knock' || !castOf(b, u) || !v.alive || !foe(b, u, v)) return;
        b.applyStatus(u, v, resonanceStatus(b, u));
      },
      onSkill(b, u) { closeCast(b, u); },
    } }),
  pu('rachel', 'wave', 'noqueue', '새치기 금지',
    `주변 1칸 아군을 공격한 적이 자신의 ${WA.queueR}칸 안에 있으면 1칸 밀쳐내고 공진 (같은 적은 ${WA.queueIcd}초에 1회).`,
    { hooks: { onAllyHurt(b, u, ally, src) {
      if (!u.alive || !src.alive || b.dist(u, ally) > 1 || b.dist(u, src) > WA.queueR || !foe(b, u, src) || !icd(b, src, `puQueue${u.id}`, WA.queueIcd)) return;
      b.fx(src.x, src.y, 0, 'elec');
      b.knockback(u, src);
      if (src.alive) b.applyStatus(u, src, resonanceStatus(b, u));
    } } }),
  pu('rachel', 'wave', 'gravity', '암흑물질 중력',
    `피니쉬가 맞으면 대상 주변 ${WA.gravR}칸 적 최대 ${WA.gravN}명을 대상 곁으로 끌어당긴 뒤 암흑물질 붕괴의 고정 피해가 퍼진다 (보스 · 고정 적 제외).`,
    { hooks: { onDeal(b, u, t, r, o) {
      // 피니쉬 첫 몫(물리)의 적중: 특성의 확산(onBasic)보다 먼저 끌어당긴다
      if (o.tag !== 'basic' || !o.extra?.includes('finish') || r.miss || !t.alive || !foe(b, u, t)) return;
      const pool = b.around(t, WA.gravR, b.enemiesOf(u)).filter((e) => e.alive && e !== t && b.dist(e, t) > 1 && !b.unmovable(e));
      if (!pool.length) return;
      b.fx(t.x, t.y, WA.gravR, 'psy');
      for (const e of pool.slice(0, WA.gravN)) b.pull(t, e);
    } } }),

  // ───────── 파종: 먹성
  pu('rachel', 'seed', 'digest', '소화',
    `피니쉬가 자신이 건 중독이 남은 적에게 맞으면 그 중독을 거두어 남은 중독 피해의 ${pc(SE.digestK)}를 즉시 정신 피해로 준다 (최대 주요 위력 ${pc(SE.digestCap)}, 정신 피해라 암흑물질 붕괴로 회복한다).`,
    { hooks: { onBasic(b, u, t, r) {
      if (!u.mem.finished || r.amount <= 0 || !t.alive || !foe(b, u, t)) return;
      const s = t.statuses.find((x) => x.key === 'poison' && x.src === u);
      if (!s || !s.dps || s.dur <= 0) return;
      const v = Math.min(s.dps * s.dur * SE.digestK, mp(b, u) * SE.digestCap);
      t.statuses = t.statuses.filter((x) => x !== s);
      b.fx(t.x, t.y, 0, 'chem');
      b.emit({ k: 'status', id: t.id, name: '소화', src: u.id, harm: true });
      b.dealDamage(u, t, v, { elem: 'psy', tag: 'proc', kind: kindOf(u), key: 'pu.digest' });
    } } }),
  pu('rachel', 'seed', 'bite', '한 입만',
    `체력이 ${pc(SE.biteFull)} 이상일 때 정신 피해를 주면 (암흑물질 붕괴의 회복이 남아돌면) 주변 ${SE.biteR}칸에서 체력 비율이 가장 낮은 아군에게 ${SE.biteDur}초 지속 회복 (초당 주요 위력 ${pc(SE.biteHps)}, ${SE.biteIcd}초에 1회).`,
    { hooks: { onDeal(b, u, t, r, o) {
      if (!traitPsy(b, u, t, r.amount, o) || !u.alive || u.hp < b.S(u, 'maxHp') * SE.biteFull) return;
      const al = b.around(u, SE.biteR, b.alliesOf(u, false)).filter((a) => a.alive && !a.mem.inert && a.hp < b.S(a, 'maxHp'));
      if (!al.length || !icd(b, u, 'puBite', SE.biteIcd)) return;
      const a = al.reduce((x, y) => (b.hpPct(y) < b.hpPct(x) ? y : x));
      b.applyStatus(u, a, { type: 'buff', key: 'regen', dur: SE.biteDur, hps: mp(b, u) * SE.biteHps, label: '한 입만' });
      b.fx(a.x, a.y, 0, 'chem', 'heal');
    } } }),
  pu('rachel', 'seed', 'neurotox', '신경독',
    `염동 제압 · 파괴 광선!에 맞은 적에게 중독 ${SE.toxPoison}중첩. 염동 제압에 맞은 적이 이미 중독돼 있었으면 기절이 중독 1중첩당 +${SE.toxPer}초 (최대 +${SE.toxMax}초).`,
    { hooks: {
      onDeal(b, u, t, r, o) {
        const sk = isSkill(u, o);
        if ((!sk && !isBeam(u, o)) || r.miss || !t.alive || !foe(b, u, t)) return;
        if (sk) { const c = openCast(b, u); if (!c.pre.has(t)) c.pre.set(t, stacksOf(t, 'poison')); }
        b.applyStatus(u, t, poisonOf(b, u, SE.toxPoison));
      },
      onSkill(b, u) {
        const c = closeCast(b, u);
        if (!c) return;
        for (const [t, n] of c.pre) {
          const st = n > 0 && t.alive ? statusOf(t, 'stun') : undefined;
          if (st && st.dur > 0) st.dur += Math.min(SE.toxMax, SE.toxPer * n);
        }
      },
    } }),

  // ───────── 정신: 귀찮게 하지 마
  pu('rachel', 'mind', 'daze', '몽롱',
    `염동 제압으로 기절한 적(순간이동으로 밀쳐낸 적 포함)은 기절이 풀리면 ${MI.dazeDur}초 혼란 (같은 적은 ${MI.dazeIcd}초에 1회).`,
    { hooks: {
      onDeal(b, u, t, r, o) { if (isSkill(u, o) && !r.miss && foe(b, u, t)) openCast(b, u); },
      onInflict(b, u, t, s) { const c = castOf(b, u); if (c && s.type === 'stun' && s.key === 'stun' && foe(b, u, t)) c.stunned.add(t); },
      onSkill(b, u) {
        const c = closeCast(b, u);
        if (!c) return;
        for (const t of c.stunned) {
          const st = t.alive ? statusOf(t, 'stun') : undefined;
          if (!st || st.onExpire || !icd(b, t, `puDaze${u.id}`, MI.dazeIcd)) continue;
          st.onExpire = (bb, v) => { if (!bb.over && u.alive && v.alive) confuse(bb, u, v, MI.dazeDur); };
        }
      },
    } }),
  pu('rachel', 'mind', 'liable', '연대 책임',
    `피니쉬가 결속된 적에게 맞으면 같은 결속의 다른 적 전원에게도 피니쉬 피해의 ${pc(MI.liable)} 고정 피해 (암흑물질 붕괴의 확산과 따로).`,
    { hooks: { onBasic(b, u, t, r) {
      if (!u.mem.finished || r.amount <= 0 || !foe(b, u, t)) return;
      const bd = statusOf(t, 'bond');
      if (!bd || bd.grp === undefined) return;
      for (const e of b.enemiesOf(u)) {
        if (e === t || !e.alive || !e.statuses.some((x) => x.key === 'bond' && x.grp === bd.grp)) continue;
        b.emit({ k: 'atk', from: t.id, to: e.id, elem: 'psy', ranged: true, chain: true });
        b.dealDamage(u, e, r.amount * MI.liable, { elem: 'true', tag: 'proc' });
      }
    } } }),
  pu('rachel', 'mind', 'shoo', '귀찮게 하지 마',
    `자신을 기본 공격 · 전투 스킬로 공격한 적은 ${pc(MI.shooP)} 확률로 ${MI.shooDur}초 혼란 (같은 적은 ${MI.shooIcd}초에 1회 판정). 혼란된 적에게 정신 피해를 주면 암흑물질 붕괴로 그 ${pc(MI.shooHeal)}를 더 회복한다.`,
    { hooks: {
      onHurt(b, u, src, _r, o) {
        if ((o.tag !== 'basic' && o.tag !== 'skill') || !src.alive || !foe(b, u, src) || !icd(b, src, `puShoo${u.id}`, MI.shooIcd)) return;
        confuse(b, u, src, MI.shooDur, MI.shooP);
      },
      onDeal(b, u, t, r, o) {
        if (traitPsy(b, u, t, r.amount, o) && u.alive && b.confused(t)) b.heal(u, u, r.amount * MI.shooHeal, true);
      },
    } }),

  // ───────── 보화: 단장의 장부
  pu('rachel', 'gold', 'payback', '본전 뽑기',
    `암흑물질 붕괴로 회복한 양(넘친 몫 포함)이 쌓여 최대 체력의 ${pc(GO.payback)}에 이를 때마다 임시 장비 1개 (전투당 최대 ${GO.paybackMax}개).`,
    { hooks: { onDeal(b, u, t, r, o) {
      if (!traitPsy(b, u, t, r.amount, o) || !u.alive || (u.mem.puPayN || 0) >= GO.paybackMax) return;
      const need = b.S(u, 'maxHp') * GO.payback;
      u.mem.puPay = Math.min(need, (u.mem.puPay || 0) + r.amount * TRAIT_HEAL);
      if (u.mem.puPay < need || !giveTempItem(b, u, u)) return; // 장비가 가득하면 다 채운 채로 기다린다
      u.mem.puPay = 0;
      u.mem.puPayN = (u.mem.puPayN || 0) + 1;
    } } }),
  pu('rachel', 'gold', 'allin', '올인',
    `피니쉬마다 이성이 ${GO.allinReason} 더 떨어진다. 대신 피니쉬마다 시장 개입 쿨다운 -${GO.allinCd}초 (이성 절댓값이 클수록 시장 개입 성공 확률이 오른다).`,
    { hooks: { onBasic(b, u) {
      if (!u.mem.finished || u.school !== 'gold' || !u.cantrip) return;
      b.addReason(u, -GO.allinReason, 'rule'); // 이성 규칙(피니쉬 -5)을 키운다
      u.cantripCd = Math.max(0, u.cantripCd - GO.allinCd);
    } } }),
  pu('rachel', 'gold', 'share', '단원 몫',
    `임시 장비가 ${PSI.gold.max}개면 시장 개입을 쓸 때마다 주변 ${GO.shareR}칸에서 임시 장비가 가장 적은 아군에게 임시 장비 1개를 나눠 준다 (전투당 최대 ${GO.shareMax}개).`,
    { hooks: { onCantrip(b, u) {
      if (u.school !== 'gold' || (u.mem.goldItems || 0) < PSI.gold.max || (u.mem.puShareN || 0) >= GO.shareMax) return;
      const al = b.around(u, GO.shareR, b.alliesOf(u, false)).filter((a) => !a.isSummon && !a.mem.inert && (a.mem.goldItems || 0) < PSI.gold.max);
      if (!al.length) return;
      const a = al.reduce((x, y) => ((y.mem.goldItems || 0) < (x.mem.goldItems || 0) ? y : x));
      if (giveTempItem(b, u, a)) u.mem.puShareN = (u.mem.puShareN || 0) + 1;
    } } }, { hint: `임시 장비 ${PSI.gold.max}개 필요`, stacks: { st: 'tempgear', need: PSI.gold.max } }),

  // ───────── 환조: 대신 해 줘
  pu('rachel', 'illusion', 'afterimg', '잔상',
    `염동 제압으로 순간이동하면 떠난 자리에 환영 1기를 남긴다 (환영 향과 같은 환영, 분신을 부르면 분신, ${IL.afterIcd}초에 1회).`,
    { hooks: {
      onDeal(b, u, t, r, o) { if (isSkill(u, o) && !r.miss && foe(b, u, t)) openCast(b, u); },
      onSkill(b, u) {
        const c = closeCast(b, u);
        if (!c || u.school !== 'illusion' || !u.alive || (c.x === u.x && c.y === u.y) || b.unitAt(c.x, c.y)) return;
        if (!icd(b, u, 'puAfter', IL.afterIcd)) return;
        // 환영 향을 한 번 그대로 부른다 (쿨다운 · 이성 소모 없음). 거울 상은 비술에서만
        const mirror = u.mem['ps.illusion.mirror'];
        u.mem['ps.illusion.mirror'] = 0;
        const before = new Set(shadesOf(b, u));
        const res = CANTRIPS.illusion.cast(b, u);
        u.mem['ps.illusion.mirror'] = mirror;
        const s = res ? shadesOf(b, u).find((x) => !before.has(x)) : undefined;
        if (!s || b.unitAt(c.x, c.y)) return;
        s.x = s.px = c.x; s.y = s.py = c.y;
        b.fx(c.x, c.y, 0, 'psy', 'aura');
      },
    } }),
  pu('rachel', 'illusion', 'core', '공유 노심',
    `피니쉬가 맞으면 자신의 환영 · 분신 최대 ${IL.coreN}기(가까운 순) 주변 1칸 적에게도 피니쉬 피해의 ${pc(IL.core)} 고정 피해 (암흑물질 붕괴의 확산에 이미 맞은 적 제외).`,
    { hooks: { onBasic(b, u, t, r) {
      if (!u.mem.finished || r.amount <= 0 || !foe(b, u, t)) return;
      const done = new Set(b.around(t, 1, b.enemiesOf(u)));
      for (const s of shadesOf(b, u).slice(0, IL.coreN)) {
        b.fx(s.x, s.y, 1, 'psy');
        for (const e of b.around(s, 1, b.enemiesOf(u))) {
          if (done.has(e) || !e.alive) continue;
          done.add(e);
          b.dealDamage(u, e, r.amount * IL.core, { elem: 'true', tag: 'proc' });
        }
      }
    } } }),
  pu('rachel', 'illusion', 'standin', '대타',
    `환영 · 분신이 있으면 자신이 받는 피해의 ${pc(IL.standin)}를 가장 가까운 환영 · 분신이 대신 받는다.`,
    { hooks: { redirect(b, u, src, dmg, o) {
      const s = shadesOf(b, u)[0];
      if (!s) return dmg;
      const part = dmg * IL.standin;
      b.rawHit(src, s, part, o.elem, true);
      return dmg - part;
    } } }),
];
