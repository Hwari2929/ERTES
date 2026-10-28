// 사이오닉 전용 전공 증강: romani (kit.ts 참고)
// 로마니: 집행자(도끼)를 던지고 · 붙잡고 · 끌어당기고 · 되돌리는 순환. 특성 [염동 회수] (가장 먼 적을 끌어옴),
// 전투 스킬 [집행자 투척], 채찍 콤보 (3번째 마무리), 상대의 약점을 첫 3마디 안에 짚는 버릇, 열등감과 서툰 칭찬.
// 수치는 RX, 설명문도 RX 를 읽는다.
import type { Battle, CUnit, DmgOpts } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import { addBurn, addChill, mp } from '../psionic';
import { psiStackCap } from '../psinum';
import { pu } from './kit';

/** 로마니 전용 전공 증강 수치 */
export const RX = {
  pyro: {
    /** 되돌아오는 집행자: 되돌아오는 시간 · 피해 (주요 위력 배수) · 연소 */
    retDelay: 1.5, retCoef: 0.6, retBurn: 2,
    /** 불씨 회수: 끌어온 적 연소 · 소각 쿨다운이 줄어드는 연소 중첩 · 줄어드는 초 */
    pyreBurn: 2, pyreAt: 3, pyreCd: 1,
    /** 약점 3개: 더하는 연소 · 간파 지속 · 자신의 연소 피해 증가 */
    readBurn: 1, readDur: 4, readDmg: 0.25,
  },
  chrono: {
    /** 되감는 궤도: 오한 · 빙결을 기다리는 시간 · 투척 쿨다운 감소 */
    rwChill: 2, rwWin: 5, rwCd: 2,
    /** 염동 결박: 오한 · 대기 시간 해제의 대기 */
    tetherChill: 2, tetherIcd: 3,
    /** 그 정도면 잘했어: 표식 유지 · 공격 속도 · 지속 */
    praiseWin: 5, praiseAtkSpd: 0.25, praiseDur: 4,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const kindOf = (u: CUnit): 'shoot' | 'strike' | 'tech' => (u.ctype === 'MARK' ? 'shoot' : u.ctype === 'VAN' ? 'strike' : 'tech');
const stacksOf = (u: CUnit, k: string) => u.statuses.find((s) => s.key === k)?.stacks || 0;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const has = (u: CUnit) => (k: string) => !!u.mem[`ps.${k}`];
/** 대기 시간: key 가 아직 막혀 있으면 false, 아니면 막고 true */
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 전투 스킬(집행자 투척)의 적중 (비술은 tag 'skill' + key 'cantrip' 이라 뺀다) */
const isThrow = (o: DmgOpts) => o.tag === 'skill' && o.key !== 'cantrip';
const R = RX.pyro, C = RX.chrono;

export const AUGS: AugDef[] = [
  // ───────── 홍염
  pu('romani', 'pyro', 'return', '되돌아오는 집행자',
    `집행자 투척 ${R.retDelay}초 뒤 도끼가 손으로 되돌아오며, 대상이 살아 있으면 주요 위력 ${pc(R.retCoef)} 물리 피해와 연소 ${R.retBurn}중첩.`,
    { hooks: { onDeal(b, u, t, _r, o) {
      if (!isThrow(o) || !foe(b, u, t) || !icd(b, u, 'puRetIcd', 1)) return; // 투척 1번에 1회 (여러 번 맞히는 투척도)
      b.later(R.retDelay, () => {
        if (b.over || !u.alive || !t.alive || !foe(b, u, t)) return;
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
        b.dealDamage(u, t, mp(b, u) * R.retCoef, { elem: 'phys', tag: 'proc', kind: kindOf(u) });
        if (t.alive) addBurn(b, u, t, R.retBurn);
      });
    } } }),
  pu('romani', 'pyro', 'pyre', '불씨 회수',
    `염동 회수로 적을 끌어오면 그 적에게 연소 ${R.pyreBurn}중첩. 이미 연소 ${R.pyreAt}중첩 이상이던 적이면 소각 쿨다운 -${R.pyreCd}초.`,
    { hooks: { onDisplace(b, u, v, src, kind) {
      // 염동 회수(특성)의 끌어오기만 'pull' 로 알린다 (집행자 투척은 순간 이동이라 알리지 않는다)
      if (src !== u || kind !== 'pull' || !v.alive || !foe(b, u, v)) return;
      const had = stacksOf(v, 'burn');
      addBurn(b, u, v, R.pyreBurn);
      if (had >= R.pyreAt && u.school === 'pyro' && u.cantrip) u.cantripCd = Math.max(0, u.cantripCd - R.pyreCd);
    } } }),
  pu('romani', 'pyro', 'three', '약점 3개',
    `채찍 콤보의 마무리(3번째 타격)가 연소 중인 적에게 맞으면 연소 ${R.readBurn}중첩을 더하고 ${R.readDur}초간 [간파]: 그 적이 받는 자신의 연소 피해 +${pc(R.readDmg)}.`,
    { hooks: {
      onBasic(b, u, t, r) {
        if (u.mem.finished !== 1 || r.miss || r.amount <= 0 || !t.alive || !foe(b, u, t) || !stacksOf(t, 'burn')) return;
        addBurn(b, u, t, R.readBurn);
        const ex = t.statuses.find((s) => s.key === 'pu.romani.read' && s.src === u);
        if (ex) ex.dur = Math.max(ex.dur, R.readDur); // 다시 짚으면 시간만 갱신 (중첩 없음)
        else b.applyStatus(u, t, { type: 'buff', key: 'pu.romani.read', dur: R.readDur, label: '간파' }, 9);
      },
      dmgMult: (_b, u, t, o) => (o.key === 'burn' && t.statuses.some((s) => s.key === 'pu.romani.read' && s.src === u) ? 1 + R.readDmg : 1),
    } }),

  // ───────── 시공
  pu('romani', 'chrono', 'rewind', '되감는 궤도',
    `집행자 투척에 맞은 적에게 오한 ${C.rwChill}중첩. 그 적이 ${C.rwWin}초 안에 자신의 빙결에 걸리면 집행자 투척 쿨다운 -${C.rwCd}초 (투척마다 1회).`,
    { hooks: {
      onDeal(b, u, t, _r, o) {
        if (!isThrow(o) || !t.alive || !foe(b, u, t) || !icd(b, u, 'puRwIcd', 1)) return;
        addChill(b, u, t, C.rwChill);
        t.mem[`puRw${u.id}`] = b.t + C.rwWin;
      },
      onInflict(b, u, t, s) {
        if (s.key !== 'freeze' || (t.mem[`puRw${u.id}`] || 0) <= b.t) return;
        t.mem[`puRw${u.id}`] = 0; // 투척 1번에 1회
        u.cd = Math.max(0, u.cd - C.rwCd);
        b.emit({ k: 'status', id: u.id, name: '되감는 궤도', src: u.id });
      },
    } }),
  pu('romani', 'chrono', 'tether', '염동 결박',
    `염동 회수로 적을 끌어오면 그 적에게 오한 ${C.tetherChill}중첩. 이미 오한 최대 중첩이던 적을 끌어오면 염동 회수의 대기 시간이 바로 풀린다 (${C.tetherIcd}초에 1회).`,
    { hooks: { onDisplace(b, u, v, src, kind) {
      if (src !== u || kind !== 'pull' || !v.alive || !foe(b, u, v)) return;
      const full = stacksOf(v, 'chill') >= psiStackCap('chill', has(u));
      addChill(b, u, v, C.tetherChill);
      // 염동 회수의 대기 시간 = mem.pullIcd (data/rework.ts romaniPull, 3초). 끌어온 적은 이미 곁에 있어 다음 회수는 다른 적을 노린다
      if (full && icd(b, u, 'puTetherIcd', C.tetherIcd)) { u.mem.pullIcd = 0; b.emit({ k: 'status', id: u.id, name: '염동 결박', src: u.id }); }
    } } }),
  pu('romani', 'chrono', 'praise', '그 정도면 잘했어',
    `자신이 끌어오거나 집행자 투척으로 맞힌 지 ${C.praiseWin}초 안의 적, 또는 자신의 오한 · 빙결이 걸린 적을 다른 아군이 쓰러뜨리면 그 아군에게 ${C.praiseDur}초간 시간 가속 (공격 속도 +${pc(C.praiseAtkSpd)}).`,
    { hooks: {
      onDisplace(b, u, v, src, kind) { if (src === u && kind === 'pull' && foe(b, u, v)) v.mem[`puPraise${u.id}`] = b.t + C.praiseWin; },
      onDeal(b, u, t, _r, o) { if (isThrow(o) && foe(b, u, t)) t.mem[`puPraise${u.id}`] = b.t + C.praiseWin; },
      onAnyDeath(b, u, dead, killer) {
        if (!u.alive || !killer || killer === u || !killer.alive || killer.side !== u.side || b.sideOf(killer) !== b.sideOf(u) || !foe(b, u, dead)) return;
        const marked = (dead.mem[`puPraise${u.id}`] || 0) > b.t || dead.statuses.some((s) => (s.key === 'chill' || s.key === 'freeze') && s.src === u);
        if (!marked) return;
        // 시공 시간 가속과 같은 키: 겹치지 않고 시간만 갱신
        if (b.buff(u, killer, 'psi.haste', C.praiseDur, { delta: { atkSpd: C.praiseAtkSpd }, label: '시간 가속' })) b.fx(killer.x, killer.y, 0, 'elec', 'buff');
      },
    } }),
];
