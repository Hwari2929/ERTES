// 사이오닉 전용 전공 증강: hana (kit.ts 참고)
// 한아: 녹림의원 임시 원장 · 무당. 특성 [혼란한 땅] (아군 효과로 강제 이동된 적에게 정신 피해 · 공포), 부적 (콤보 3번째 피니쉬),
// 전투 스킬 [해주굿] (주변 2칸 정신 피해 + 위치 교란 · 이로운 효과 제거). 굿판 · 부적 · 금줄 같은 무속,
// 땅을 건드려 탈이 나는 동티. 수치는 HX, 설명문도 HX 를 읽는다.
import type { Battle, CUnit, DmgOpts, Status } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import { CFG } from '../../config';
import { addConduct, resonanceStatus } from '../psionic';
import { PSI } from '../psinum';
import { pu } from './kit';

/** 한아 전용 전공 증강 수치 */
export const HX = {
  volt: {
    /** 동티: 같은 적 대기 */
    stirIcd: 3,
    /** 뇌부: 더하는 전도 · 최대 중첩일 때 반응 대기 (같은 적) */
    charmAdd: 1, charmIcd: 1,
    /** 넋떨림: 최대 중첩 공포 · 같은 적 대기 · 공포에 질린 적의 전도가 반응하는 간격 */
    trembleFear: 1, trembleIcd: 5, trembleEvery: 1,
  },
  wave: {
    /** 땅울림: 같은 적 대기 */
    rumbleIcd: 2,
    /** 금줄: 같은 적 대기 */
    ropeIcd: 4,
  },
} as const;

const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && t.alive && b.sideOf(t) !== b.sideOf(u);
/** 대기 시간: key 가 아직 막혀 있으면 false, 아니면 막고 true */
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 자신이 건 전도 */
const myConduct = (u: CUnit, t: CUnit) => t.statuses.find((s) => s.key === 'conduct' && s.src === u && s.dur > 0);
/** [혼란한 땅]과 같은 조건: 옮겨진 쪽이 적이고, 옮긴 효과의 주인이 자신 · 아군 */
const ourDisplace = (b: Battle, u: CUnit, victim: CUnit, src: CUnit) => foe(b, u, victim) && b.sideOf(src) === b.sideOf(u);
/** [해주굿] 적중 (skillHit: 정신 · 키 없음, 비술은 key 'cantrip') */
const isGut = (o: DmgOpts) => o.tag === 'skill' && o.elem === 'psy' && !o.key;
/** 전도 반응 (그 적이 행동한 것처럼) */
const react = (b: Battle, t: CUnit, s: Status) => { b.fx(t.x, t.y, 1, 'elec'); s.onAct?.(b, t, s); };

/** 대상에게 자신의 전도 n중첩 (psionic.ts addConduct: 없으면 새로 걸고, 최대 중첩까지 · 역전류면 아군에게) */
function growConduct(b: Battle, u: CUnit, t: CUnit, n: number) {
  return t.alive ? addConduct(b, u, t, n) : false;
}
/** 동티: 전도된 적이 ally 를 쳤다 → 전류에 튕겨 곁의 빈칸으로 (옮긴 주인 = u: [혼란한 땅]이 자신의 강제 이동으로 본다) */
function jolt(b: Battle, u: CUnit, src: CUnit, amount: number) {
  if (amount <= 0 || !u.alive || !foe(b, u, src) || !myConduct(u, src) || b.unmovable(src)) return;
  const cells: { x: number; y: number }[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = src.x + dx, y = src.y + dy;
    if ((dx || dy) && b.inBounds(x, y) && !b.unitAt(x, y)) cells.push({ x, y });
  }
  if (!cells.length || !icd(b, src, `hvStir${u.id}`, HX.volt.stirIcd)) return;
  const c = b.rng.pick(cells);
  src.mem.knockUntil = Math.max(src.mem.knockUntil || 0, b.t + CFG.knockStagger);
  b.fx(src.x, src.y, 0, 'elec');
  b.emit({ k: 'status', id: src.id, name: '동티', src: u.id, harm: true, stype: 'knock' });
  b.relocate(u, src, c.x, c.y, 'move');
}
/** 이번 해주굿에 맞은 적 (onDeal 에서 모으고, 같은 틱의 onSkill 에서 쓴다) */
const GUT = new WeakMap<CUnit, { t: number; hit: Set<CUnit> }>();

const V = HX.volt, W = HX.wave;

export const AUGS: AugDef[] = [
  // ───────── 뇌전
  pu('hana', 'volt', 'stir', '동티',
    `자신이 건 전도가 남은 적이 자신이나 아군에게 피해를 주면 동티가 나서, 전류에 튕겨 곁의 빈칸으로 옮겨지고 ${CFG.knockStagger}초간 행동하지 못한다 (같은 적에게 ${V.stirIcd}초에 1회). 옮겨진 적에게는 혼란한 땅이 발동한다.`,
    { hooks: {
      onHurt(b, u, src, r) { jolt(b, u, src, r.amount); },
      onAllyHurt(b, u, _ally, src, r) { jolt(b, u, src, r.amount); },
    } }),
  pu('hana', 'volt', 'charm', '뇌부',
    `부적 피니쉬(콤보 3번째)가 맞으면 대상에게 벼락 부적을 붙여 전도 ${V.charmAdd}중첩을 더한다 (없으면 새로 건다). 이미 최대 중첩이면 대신 그 전도가 즉시 한 번 반응한다 (같은 적에게 ${V.charmIcd}초에 1회).`,
    { hooks: { onBasic(b, u, t, r) {
      if (!u.mem.finished || r.miss || r.amount <= 0 || !u.alive || !foe(b, u, t)) return;
      const s = myConduct(u, t);
      if (s && (s.stacks || 1) >= (s.maxStacks || PSI.volt.max)) { if (icd(b, t, `hvCharm${u.id}`, V.charmIcd)) react(b, t, s); }
      else growConduct(b, u, t, V.charmAdd);
    } } }),
  pu('hana', 'volt', 'tremble', '넋떨림',
    `자신이 건 전도가 최대 중첩에 이른 적은 넋이 떨려 ${V.trembleFear}초 공포에 빠진다 (같은 적에게 ${V.trembleIcd}초에 1회). 공포에 질린 적은 공격하지 못하는 대신, 자신이 건 전도가 ${V.trembleEvery}초마다 한 번씩 반응한다 (그 적이 행동한 것처럼).`,
    { hooks: { onTick(b, u, dt) {
      u.mem.hvTrT = (u.mem.hvTrT || 0) - dt;
      if (u.mem.hvTrT > 0 || !u.alive) return;
      u.mem.hvTrT = 0.25;
      for (const e of b.enemiesOf(u)) {
        const s = myConduct(u, e);
        if (!s) continue;
        if ((s.stacks || 1) >= (s.maxStacks || PSI.volt.max) && icd(b, e, `hvTrF${u.id}`, V.trembleIcd)) b.applyStatus(u, e, { type: 'fear', key: 'fear', dur: V.trembleFear });
        if (e.alive && e.statuses.some((x) => x.type === 'fear' && x.dur > 0) && icd(b, e, `hvTr${u.id}`, V.trembleEvery)) react(b, e, s);
      }
    } } }, { hint: `전도 ${PSI.volt.max}중첩 필요`, stacks: { st: 'conduct', need: PSI.volt.max } }),
  // ───────── 파장
  pu('hana', 'wave', 'rumble', '땅울림',
    `자신 · 아군의 효과로 강제 이동된 적에게 공진을 건다: 혼란한 땅이 울린다 (같은 적에게 ${W.rumbleIcd}초에 1회).`,
    { hooks: { onDisplace(b, u, victim, src) {
      if (!u.alive || !ourDisplace(b, u, victim, src) || !icd(b, victim, `hwRum${u.id}`, W.rumbleIcd)) return;
      b.applyStatus(u, victim, resonanceStatus(b, u));
    } } }),
  pu('hana', 'wave', 'exorcise', '잡귀 쫓기',
    `해주굿에 맞은 적 중 공진된 적을 자신에게서 1칸 밀쳐낸다 (해주굿이 이미 자리를 옮긴 적도).`,
    { hooks: {
      onDeal(b, u, t, _r, o) {
        if (!isGut(o) || !foe(b, u, t)) return;
        let h = GUT.get(u);
        if (!h || h.t !== b.t) { h = { t: b.t, hit: new Set() }; GUT.set(u, h); }
        h.hit.add(t);
      },
      onSkill(b, u) {
        const h = GUT.get(u);
        if (!h || h.t !== b.t) return;
        for (const e of h.hit) if (foe(b, u, e) && e.statuses.some((s) => s.key === 'resonance' && s.dur > 0)) b.knockback(u, e);
      },
    } }),
  pu('hana', 'wave', 'rope', '금줄',
    `자신에게 붙은(1칸) 적은 금줄에 걸려 1칸 밀려나고 공진에 걸린다 (같은 적에게 ${W.ropeIcd}초에 1회, 밀려나지 않는 적도 공진).`,
    { hooks: { onTick(b, u, dt) {
      u.mem.hwRopeT = (u.mem.hwRopeT || 0) - dt;
      if (u.mem.hwRopeT > 0 || !u.alive) return;
      u.mem.hwRopeT = 0.25;
      for (const e of b.around(u, 1, b.enemiesOf(u))) {
        if (!foe(b, u, e) || !icd(b, e, `hwRope${u.id}`, W.ropeIcd)) continue;
        b.fx(e.x, e.y, 0, 'elec');
        b.knockback(u, e);
        if (e.alive) b.applyStatus(u, e, resonanceStatus(b, u));
      }
    } } }),
];
