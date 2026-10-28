// 사이오닉 전용 전공 증강: zephyro (kit.ts 참고)
// 제피로: 깃펜 투필 (2발 탄창), 특성 [뱃사공 철학] (기본 공격이 근처 적 1명을 더 맞힘 · 아군 치명타 확률),
// 전투 스킬 [돛 방향 틀기] (주변 2칸 아군 받는 피해 감소 · 회피, 탄환의 작용점을 비튼다), 질문으로 전제의 허점을 짚는 논박,
// 빠른 길보다 안전한 우회로를 고르는 뱃사공. 공진 · 전도는 연쇄로 불어나지 않게 같은 적 대기를 둔다 (예전 공명 연쇄 과열).
// 수치는 ZX, 설명문도 ZX 를 읽는다.
import type { Battle, CUnit, Status } from '../../engine/combat';
import { type AugDef, vuln } from '../../engine/effects';
import { CFG } from '../../config';
import { resonanceStatus } from '../psionic';
import { PSI } from '../psinum';
import { pu } from './kit';

/** 제피로 전용 전공 증강 수치 */
export const ZX = {
  volt: {
    /** 꼬리 질문: 옮겨 붙이는 전도 · 같은 적 대기 */
    askAdd: 1, askIcd: 2,
    /** 작용점 비틀기: 더하는 전도 · 같은 공격자 대기 */
    bendAdd: 1, bendIcd: 1,
    /** 전제의 허점: 전도 1중첩당 받는 치명타 피해 */
    flawPer: 0.2,
  },
  wave: {
    /** 우회 항로: 표적 고정 · 같은 적 대기 */
    detourLock: 2, detourIcd: 4,
    /** 물수제비: 같은 적 대기 */
    skipIcd: 3,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && t.alive && b.sideOf(t) !== b.sideOf(u);
/** 대기 시간: key 가 아직 막혀 있으면 false, 아니면 막고 true */
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 자신이 건 전도 */
const myConduct = (u: CUnit, t: CUnit) => t.statuses.find((s) => s.key === 'conduct' && s.src === u && s.dur > 0);
/** [뱃사공 철학] 추가 타격 대상: 주 대상에서 가장 가까운, 사거리 안의 다른 적 (rework.ts 특성과 같은 계산) */
const secondOf = (b: Battle, u: CUnit, t: CUnit) => b.nearest(t, b.enemiesOf(u).filter((x) => x !== t && x.alive && b.dist(u, x) <= b.S(u, 'range')));
/** [돛 방향 틀기] 버프 (tpl.ts supportApply: sup.<기물>) */
const SAIL = 'sup.zephyro';
const sailOn = (u: CUnit, a: CUnit) => a.statuses.some((s) => s.key === SAIL && s.src === u && s.dur > 0);

/** 마지막으로 적에게 건 자신의 전도 (전도가 없는 적에게 새로 걸 때의 틀: 엔진의 전도 생성 함수가 바깥에 없어 복사한다) */
const CONDUCT_TPL = new WeakMap<CUnit, Status>();
const captureConduct = { onInflict(b: Battle, u: CUnit, t: CUnit, s: Status) { if (s.key === 'conduct' && foe(b, u, t)) CONDUCT_TPL.set(u, s); } };
/** 대상의 자신이 건 전도에 n중첩을 더한다 (없으면 새로 건다, 최대 중첩까지). from = 복사할 전도 (없으면 대상의 것 · 틀) */
function growConduct(b: Battle, u: CUnit, t: CUnit, n: number, from?: Status) {
  const base = from || myConduct(u, t) || CONDUCT_TPL.get(u);
  if (!base || !t.alive) return false;
  return b.applyStatus(u, t, { ...base, stacks: n, dur: PSI.volt.dur, tickAcc: undefined });
}
/** from 에서 멀어지는 쪽으로 1칸 밀쳐낸다 (옮긴 주인 = u: 한아 [혼란한 땅] · 반작용 등이 u 의 밀쳐내기로 본다) */
function shove(b: Battle, u: CUnit, from: CUnit, e: CUnit) {
  if (b.unmovable(e)) return false;
  const dx = Math.sign(e.x - from.x), dy = Math.sign(e.y - from.y);
  if (!dx && !dy) return false;
  const nx = e.x + dx, ny = e.y + dy;
  if (!b.inBounds(nx, ny) || b.unitAt(nx, ny)) return false;
  e.mem.knockUntil = Math.max(e.mem.knockUntil || 0, b.t + CFG.knockStagger);
  b.emit({ k: 'status', id: e.id, name: '밀쳐내기', src: u.id, harm: true, stype: 'knock' });
  return b.relocate(u, e, nx, ny, 'knock');
}
/** 가장 튼튼한 아군: 돌격가 중 체력(+보호막)이 가장 많은 기물, 없으면 전체에서 */
function sturdiest(b: Battle, u: CUnit) {
  const pool = b.alliesOf(u).filter((a) => !a.isSummon && !a.mem.inert);
  const van = pool.filter((a) => a.ctype === 'VAN');
  const from = van.length ? van : pool;
  return from.length ? from.reduce((a, c) => (c.hp + c.shield > a.hp + a.shield ? c : a)) : null;
}

const V = ZX.volt, W = ZX.wave;

export const AUGS: AugDef[] = [
  // ───────── 뇌전
  pu('zephyro', 'volt', 'ask', '꼬리 질문',
    `뱃사공 철학의 추가 타격이 나갈 때, 주 대상에게 자신이 건 전도가 있으면 추가 타격 대상에게도 전도 ${V.askAdd}중첩을 옮겨 붙인다 (주 대상의 전도는 그대로, 같은 적에게 ${V.askIcd}초에 1회).`,
    { hooks: { onBasic(b, u, t) {
      const s = myConduct(u, t);
      if (!s || !u.alive) return;
      const e = secondOf(b, u, t);
      if (!e || !foe(b, u, e) || !icd(b, e, `zvAsk${u.id}`, V.askIcd)) return;
      b.emit({ k: 'atk', from: t.id, to: e.id, elem: 'elec', ranged: true, chain: true });
      growConduct(b, u, e, V.askAdd, s);
    } } }),
  pu('zephyro', 'volt', 'bend', '작용점 비틀기',
    `돛 방향 틀기가 걸린 아군이 적의 기본 공격 · 전투 스킬에 맞으면, 그 공격의 작용점을 비틀어 공격자에게 전도 ${V.bendAdd}중첩을 더한다 (없으면 새로 건다, 같은 공격자에게 ${V.bendIcd}초에 1회).`,
    { hooks: { ...captureConduct, onStart(b, u) {
      for (const a of b.alliesOf(u)) {
        if (a.mem[`zvBend${u.id}`]) continue;
        a.mem[`zvBend${u.id}`] = 1;
        a.hooks.push({ onHurt(bb, self, src, r, o) {
          if ((o.tag !== 'basic' && o.tag !== 'skill') || r.amount <= 0 || !u.alive || !foe(bb, u, src) || !sailOn(u, self)) return;
          if (!icd(bb, src, `zvBendIcd${u.id}`, V.bendIcd)) return;
          bb.emit({ k: 'atk', from: self.id, to: src.id, elem: 'elec', ranged: true, chain: true });
          growConduct(bb, u, src, V.bendAdd);
        } });
      }
    } } }),
  pu('zephyro', 'volt', 'flaw', '전제의 허점',
    `자신이 건 전도가 남은 적은 전도 1중첩당 받는 치명타 피해 +${pc(V.flawPer)} (아군 모두의 치명타에 적용).`,
    { hooks: { onTick(b, u, dt) {
      u.mem.zvFlawT = (u.mem.zvFlawT || 0) - dt;
      if (u.mem.zvFlawT > 0) return;
      u.mem.zvFlawT = 0.25;
      for (const e of b.enemiesOf(u)) {
        const n = myConduct(u, e)?.stacks || 0;
        if (!n) continue;
        const ex = e.statuses.find((s) => s.key === 'psi.zflaw' && s.src === u);
        if (ex) { ex.dur = Math.max(ex.dur, 0.4); ex.critVuln = V.flawPer * n; }
        // taken 의 0 취약: 수치 영향 없이 해로운 효과로 분류되게 (kit.ts isHarmful)
        else e.statuses.push({ type: 'buff', key: 'psi.zflaw', dur: 0.4, critVuln: V.flawPer * n, taken: [vuln('all', 0)], src: u, label: '전제의 허점' });
      }
    } } }),
  // ───────── 파장
  pu('zephyro', 'wave', 'pole', '삿대 밀기',
    `돛 방향 틀기를 쓰면 삿대로 배에 붙은 적을 떼어 낸다: 버프를 받은 돌격가가 아닌 아군(자신 포함)에게 붙은(1칸) 적을 그 아군에게서 1칸 밀쳐낸다 (적마다 1번).`,
    { hooks: { onSkill(b, u) {
      const done = new Set<CUnit>();
      for (const a of b.alliesOf(u)) {
        if (a.ctype === 'VAN' || !sailOn(u, a)) continue;
        for (const e of b.around(a, 1, b.enemiesOf(u))) {
          if (done.has(e) || !foe(b, u, e)) continue;
          done.add(e);
          shove(b, u, a, e);
        }
      }
    } } }),
  pu('zephyro', 'wave', 'detour', '우회 항로',
    `자신이 밀쳐내거나 끌어당긴 적은 뱃머리가 돌아가 ${W.detourLock}초간 가장 튼튼한 아군(돌격가 우선)을 노린다 (보스 제외, 같은 적에게 ${W.detourIcd}초에 1회).`,
    { hooks: { onDisplace(b, u, victim, src, kind) {
      if (src !== u || kind === 'move' || !u.alive || !foe(b, u, victim) || victim.isBoss) return;
      const a = sturdiest(b, u);
      if (!a || a === victim.target || !icd(b, victim, `zwDet${u.id}`, W.detourIcd)) return;
      b.provoke(victim, a, W.detourLock);
      b.emit({ k: 'status', id: victim.id, name: '우회 항로', src: u.id, harm: true });
    } } }),
  pu('zephyro', 'wave', 'skip', '물수제비',
    `기본 공격이 공진된 적에게 맞으면 깃펜이 물수제비처럼 튀어, 뱃사공 철학의 추가 타격 대상에게도 공진을 건다 (같은 적에게 ${W.skipIcd}초에 1회).`,
    { hooks: { onBasic(b, u, t, r) {
      if (r.miss || r.amount <= 0 || !u.alive || !t.statuses.some((s) => s.key === 'resonance' && s.dur > 0)) return;
      const e = secondOf(b, u, t);
      if (!e || !foe(b, u, e) || !icd(b, e, `zwSkip${u.id}`, W.skipIcd)) return;
      b.emit({ k: 'atk', from: t.id, to: e.id, elem: 'elec', ranged: true, chain: true });
      b.applyStatus(u, e, resonanceStatus(b, u));
    } } }),
];
