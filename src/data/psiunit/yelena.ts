// 사이오닉 전용 전공 증강: yelena (kit.ts 참고)
// 예레나: [항밈 요원] 정신 피해 → 대상 기술 쿨다운 +1초 · [항밈 소거] 기억 소거 (기술 쿨다운 증가 · 항밈 약화 · 공포)
// 이성: 항밈 소거 -8, 아군이 전투 스킬을 쓰면 +2. 사전 조율 · 사후 수습이 본업인 외교관, 몰래 하는 가챠 게임.
import type { Battle, CUnit } from '../../engine/combat';
import { type AugDef, inc } from '../../engine/effects';
import { confuse, poisonStatus } from '../psionic';
import { PSI } from '../psinum';
import { pu } from './kit';

/** 예레나 전용 전공 증강 수치 (설명문도 여기서 읽는다) */
export const Y = {
  seed: {
    /** 망각 성분: 자신이 건 중독이 남은 적의 기술 쿨다운이 느리게 도는 비율 */
    amnesia: 0.4,
    /** 사전 조율: 아군 대상에게 거는 중독 · 대기 */
    liaisonN: 1, liaisonIcd: 3,
  },
  mind: {
    /** 천장: 혼란 없이 맞힌 횟수 · 확정 혼란 지속 */
    pityN: 4, pityDur: PSI.mind.confuse,
    /** 연결 고리 해체: 번지는 기억 소거의 세기 (기술 쿨다운 증가 · 항밈 약화) */
    unlinkK: 0.5,
    /** 협상 타결: 같은 적 대기 */
    dealIcd: 6,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 파종 중독 n중첩 (psionic.ts poisonStatus 와 같은 모양: 맹독 · 독성 농축 · 부패 · 괴사 반영) */
function seedPoison(b: Battle, u: CUnit, t: CUnit, n: number) {
  return b.applyStatus(u, t, poisonStatus(b, u, n));
}

export const AUGS: AugDef[] = [
  // ───── 파종
  // [항밈 요원]이 기술 쿨다운을 늦추듯, 중독에 섞인 망각 성분이 적의 기술 준비를 늦춘다 (누가 건 중독이든)
  pu('yelena', 'seed', 'amnesia', '망각 성분',
    `중독된 적은 기술 쿨다운이 ${pc(Y.seed.amnesia)} 느리게 돈다.`,
    { hooks: { onTick(b, u, dt) {
      for (const e of b.enemiesOf(u)) {
        if (!e.skill || e.cd <= 0 || !e.statuses.some((s) => s.key === 'poison' && s.dur > 0) || b.has(e, 'stun') || b.has(e, 'shock')) continue;
        e.cd += dt * Y.seed.amnesia;
      }
    } } }),
  // 이성 축(아군 전투 스킬 +2)과 같은 순간: 아군의 스킬에 맞춰 미리 독을 깔아 둔다
  pu('yelena', 'seed', 'liaison', '사전 조율',
    `아군이 전투 스킬을 쓰면 그 아군이 노리던 적에게 중독 ${Y.seed.liaisonN}중첩 (${Y.seed.liaisonIcd}초에 1회).`,
    { hooks: { onAllySkill(b, u, caster) {
      const t = caster.target;
      if (!u.alive || !t || !t.alive || !foe(b, u, t) || !icd(b, u, 'puLia', Y.seed.liaisonIcd)) return;
      if (seedPoison(b, u, t, Y.seed.liaisonN)) b.fx(t.x, t.y, 0, 'chem');
    } } }),
  // 항밈 소거로 기억이 지워진 적은 해독하는 법도 잊는다
  pu('yelena', 'seed', 'erase', '해독법 소거',
    '항밈 소거에 맞아 항밈 약화가 걸린 적은 해독하는 법도 잊는다: 그동안 그 적의 중독은 지속 시간이 줄지 않는다.',
    { hooks: { onTick(b, u, dt) {
      for (const e of b.enemiesOf(u)) {
        if (!e.statuses.some((s) => s.key === 'yelena.weak' && s.src === u && s.dur > 0)) continue;
        const p = e.statuses.find((s) => s.key === 'poison');
        if (p && p.dur > 0 && p.dur < PSI.seed.dur) p.dur = Math.min(PSI.seed.dur, p.dur + dt);
      }
    } } }),
  // ───── 정신
  // 몰래 하는 가챠 게임의 천장: 자아 침식이 계속 빗나가면 결국 한 번은 들어간다
  pu('yelena', 'mind', 'pity', '천장',
    `혼란을 걸지 못한 채 기본 공격 · 전투 스킬이 ${Y.mind.pityN}번 맞으면, ${Y.mind.pityN}번째 적중이 대상을 ${Y.mind.pityDur}초 혼란에 빠뜨린다 (혼란을 걸면 다시 0부터 센다).`,
    { hooks: {
      onInflict(b, u, t, s) { if (s.key === 'confuse' && foe(b, u, t)) u.mem.puPityT = b.t; },
      onDeal(b, u, t, r, o) {
        if ((o.tag !== 'basic' && o.tag !== 'skill') || o.key === 'cantrip' || r.miss || !foe(b, u, t)) return;
        const t0 = b.t;
        // 같은 적중에서 자아 침식이 혼란을 걸었는지 본 뒤에 센다 (훅 순서와 무관하게)
        b.later(0, () => {
          if (b.over || !u.alive) return;
          if ((u.mem.puPityT ?? -1) >= t0) { u.mem.puPityN = 0; return; }
          u.mem.puPityN = (u.mem.puPityN || 0) + 1;
          if (u.mem.puPityN < Y.mind.pityN) return;
          u.mem.puPityN = 0;
          if (t.alive && foe(b, u, t) && confuse(b, u, t, Y.mind.pityDur)) b.fx(t.x, t.y, 0, 'psy');
        });
      },
    } }),
  // 항밈: 이미 정착된 기억의 연결 고리를 해체한다 — 결속을 타고 기억 소거가 번진다 (번진 쪽은 다시 번지지 않는다)
  pu('yelena', 'mind', 'unlink', '연결 고리 해체',
    `항밈 소거가 결속된 적에게 맞으면, 같은 결속의 다른 적에게도 기억 소거(기술 쿨다운 증가 · 항밈 약화)가 ${pc(Y.mind.unlinkK)} 세기로 번진다.`,
    { hooks: { onDeal(b, u, t, r, o) {
      if (o.tag !== 'skill' || o.key === 'cantrip' || o.elem !== 'psy' || r.miss || !foe(b, u, t)) return;
      const bd = t.statuses.find((s) => s.key === 'bond');
      if (!bd || bd.grp === undefined) return;
      const k = `puUnlink${bd.grp}`;
      if (u.mem[k] === b.t) return; // 한 번의 항밈 소거에 결속 1묶음당 1번
      u.mem[k] = b.t;
      const p = u.sk, f = Y.mind.unlinkK;
      for (const e of b.enemiesOf(u)) {
        if (e === t || !e.statuses.some((s) => s.key === 'bond' && s.grp === bd.grp)) continue;
        if (e.skill) e.cd += (p.forget || 0) * f;
        b.applyStatus(u, e, { type: 'buff', key: 'yelena.unlink', dur: p.weakDur || 4, mods: [inc('all', -(p.weak || 0) * f)], label: '항밈 약화' });
        b.fx(e.x, e.y, 0, 'psy');
      }
    } } }),
  // 외교관의 협상: 매혹한 적이 곧바로 옛 편에게 전투 스킬을 쓴다. 결렬되면(못 쓰면) 쿨다운은 원래대로
  pu('yelena', 'mind', 'deal', '협상 타결',
    `자신이 매혹한 적은 기술 쿨다운이 0이 되어 옛 편에게 전투 스킬을 쓴다. 매혹이 끝날 때까지 쓰지 못하면 쿨다운은 원래대로 (같은 적은 ${Y.mind.dealIcd}초에 1번).`,
    { hooks: {
      onInflict(b, u, t, s) {
        if (s.key !== 'charm' || !foe(b, u, t) || !t.skill || !icd(b, t, `puDeal${u.id}`, Y.mind.dealIcd)) return;
        t.mem.puDealBy = u.id + 1;
        t.mem.puDealCd = t.cd;
        t.mem.puDealCasts = t.counters.casts;
        t.cd = 0;
        b.fx(t.x, t.y, 0, 'psy', 'buff');
      },
      onTick(b, u) {
        for (const e of b.units) {
          if (!e.alive || e.mem.puDealBy !== u.id + 1 || e.statuses.some((s) => s.key === 'charm')) continue;
          if (e.counters.casts === e.mem.puDealCasts && e.skill) e.cd = Math.max(e.cd, e.mem.puDealCd || 0);
          e.mem.puDealBy = 0;
        }
      },
    } }),
];
