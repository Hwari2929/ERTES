// 사이오닉 전용 전공 증강: joshua (kit.ts 참고)
// 조슈아: 진정제 다트 권총 (기본 공격) · [재생 촉진] 아군 전체 회복 (체사레면 자신만 2배)
// [체사레] 이성 -50 이하에서 전환: 도끼 근접 · 피해 증가 · 재생 · 주변 적 공포. 이성: 아군이 잃은 체력만큼 감소, 회복할 때 +3.
import type { Battle, CUnit, Status } from '../../engine/combat';
import { type AugDef, inc, vuln } from '../../engine/effects';
import { fear } from '../kit';
import { mp } from '../psionic';
import { PSI, psiStackCap } from '../psinum';
import { PSI_STATUS } from '../schools';
import { pu } from './kit';

/** 조슈아 전용 전공 증강 수치 (설명문도 여기서 읽는다) */
export const J = {
  seed: {
    /** 진정제 다트: 진정 지속 · 공격 속도 감소 */
    sedateDur: 2, sedateAtkSpd: 0.25,
    /** 대사 촉진: 다음 기본 공격이 거는 중독 · 유효 시간 */
    metabN: 1, metabDur: 4,
    /** 포식: 남은 중독 피해 중 즉시 주는 비율 · 적마다 상한 (주요 위력 배수) · 준 피해 중 자신 회복 비율 */
    devourK: 0.6, devourCap: 2.5, devourHeal: 0.5,
  },
  mind: {
    /** 역대 최고 포교율: 매혹 지속 */
    preachCharm: 1,
    /** 공포의 파동: 번지는 공포 지속 (체사레 공포와 같게) */
    dreadDur: 1.5,
    /** 아비스: 다트 1발당 혼란 연장 · 같은 혼란에 최대 */
    abyssExt: 0.5, abyssMax: 1.5,
  },
} as const;

/** 체사레 전용 · 조슈아 전용 표시 */
const CESARE = { hint: '체사레(이성 -50 이하)일 때만 작동', reason: 'neg' as const };

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const myPoison = (u: CUnit, t: CUnit) => t.statuses.find((s) => s.key === 'poison' && s.src === u);
/** 파종 중독 n중첩 (psionic.ts poisonStatus 와 같은 모양: 맹독 · 독성 농축 · 부패 · 괴사 반영) */
function seedPoison(b: Battle, u: CUnit, t: CUnit, n: number) {
  const has = (k: string) => !!u.mem[`ps.${k}`];
  const per = mp(b, u) * (has('seed.venom') ? PSI.seed.venomPer : PSI.seed.per);
  const st: Status = {
    type: 'dot', key: 'poison', dur: PSI.seed.dur, elem: 'chem', perDps: per, dps: per * n, stacks: n, maxStacks: psiStackCap('poison', has),
    healMul: has('seed.rot') ? 0.4 : undefined, label: PSI_STATUS.poison.name,
    onStack: has('seed.necro') ? (s) => { s.taken = (s.stacks || 0) >= PSI.seed.necroAt ? [vuln('all', PSI.seed.necroVuln)] : undefined; } : undefined,
  };
  return b.applyStatus(u, t, st);
}
/** 아비스: 혼란마다 이미 늘린 시간 */
const ABYSS = new WeakMap<Status, number>();

export const AUGS: AugDef[] = [
  // ───── 파종
  // 진정제 다트 권총 + 중독: 독이 돈 적은 다트 한 발에 몸이 무거워진다 (조슈아의 정신 안정 능력)
  pu('joshua', 'seed', 'sedate', '진정제 다트',
    `다트(기본 공격)가 중독된 적에게 맞으면 ${J.seed.sedateDur}초간 진정: 공격 속도 -${pc(J.seed.sedateAtkSpd)}. 체사레일 때는 작동하지 않는다.`,
    { hooks: { onBasic(b, u, t, r) {
      if (u.mem.cesare || r.miss || r.amount <= 0 || !t.alive || !foe(b, u, t) || !t.statuses.some((s) => s.key === 'poison' && s.dur > 0)) return;
      b.applyStatus(u, t, { type: 'buff', key: 'joshua.sedate', dur: J.seed.sedateDur, delta: { atkSpd: -J.seed.sedateAtkSpd }, label: '진정' });
    } } }),
  // 재생 촉진 = 자연 치유(대사)의 가속: 가속된 대사가 아군의 다음 일격에 독으로 실린다
  pu('joshua', 'seed', 'metab', '대사 촉진',
    `재생 촉진을 쓰면 아군 전원(체사레면 자신만)의 ${J.seed.metabDur}초 안 다음 기본 공격이 맞을 때 대상에게 중독 ${J.seed.metabN}중첩.`,
    { hooks: { onSkill(b, u) {
      for (const a of u.mem.cesare ? [u] : b.alliesOf(u)) {
        if (!a.mem[`puMetab${u.id}`]) {
          a.mem[`puMetab${u.id}`] = 1;
          a.hooks.push({ onBasic(bb, self, t, r) {
            if (r.miss || r.amount <= 0 || !t.alive || !u.alive || bb.sideOf(t) === bb.sideOf(self)) return;
            const i = self.statuses.findIndex((s) => s.key === 'joshua.metab' && s.src === u && s.dur > 0);
            if (i < 0) return;
            self.statuses.splice(i, 1);
            seedPoison(bb, u, t, J.seed.metabN);
          } });
        }
        b.applyStatus(u, a, { type: 'buff', key: 'joshua.metab', dur: J.seed.metabDur, label: '대사 촉진' });
      }
    } } }),
  // 체사레는 같은 능력을 자신에게 쓴다: 재생 촉진이 곁의 적에게 퍼진 독을 빨아들여 살로 바꾼다
  pu('joshua', 'seed', 'devour', '포식',
    `체사레가 재생 촉진을 쓰면 주변 1칸 적에게 건 자신의 중독에서 남은 피해의 ${pc(J.seed.devourK)}를 즉시 빨아들여 주고 (적마다 최대 주요 위력 ${pc(J.seed.devourCap)}, 중독은 그대로), 준 피해의 ${pc(J.seed.devourHeal)}만큼 자신을 회복.`,
    { hooks: { onSkill(b, u) {
      if (!u.mem.cesare || !u.alive) return;
      let got = 0;
      for (const e of b.around(u, 1, b.enemiesOf(u))) {
        const s = myPoison(u, e);
        if (!e.alive || !s || !s.dps || s.dur <= 0) continue;
        b.fx(e.x, e.y, 0, 'chem');
        got += b.dealDamage(u, e, Math.min(s.dps * s.dur * J.seed.devourK, mp(b, u) * J.seed.devourCap), { elem: 'chem', tag: 'proc', kind: 'tech' }).amount;
      }
      if (got > 0 && u.alive) { b.heal(u, u, got * J.seed.devourHeal, true); b.fx(u.x, u.y, 0, 'chem', 'heal'); }
    } } }, CESARE),
  // ───── 정신
  // 20세까지 가문 역대 최고의 포교율: 계시(설교) 한 번에 결속된 적 하나가 더 넘어온다 (체사레는 설교하지 않는다)
  pu('joshua', 'mind', 'preach', '역대 최고 포교율',
    `계시를 쓰면 이번에 결속된 일반 적 중 체력 비율이 가장 낮은 1명도 ${J.mind.preachCharm}초 매혹한다 (이미 매혹된 적 제외, 승천이면 엘리트도). 체사레일 때는 작동하지 않는다.`,
    { hooks: { onCantrip(b, u) {
      if (u.mem.cesare || u.school !== 'mind') return;
      const asc = !!u.mem['ps.mind.ascend'], g = b.mem.bondGrp;
      const pool = b.enemiesOf(u).filter((e) => !e.isBoss && (!e.elite || asc) && e.statuses.some((s) => s.key === 'bond' && s.grp === g) && !e.statuses.some((s) => s.key === 'charm'));
      if (!pool.length) return;
      const t = pool.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a));
      const ok = b.applyStatus(u, t, { type: 'buff', key: 'charm', dur: J.mind.preachCharm, label: PSI_STATUS.charm.name, mods: u.mem['ps.mind.dominate'] ? [inc('all', PSI.mind.dominate)] : undefined });
      if (ok) b.fx(t.x, t.y, 0, 'psy', 'aura');
    } } }),
  // 체사레의 공포의 파동: 가장 깊은 공포가 결속을 타고 번진다 (번진 공포는 다시 번지지 않는다)
  pu('joshua', 'mind', 'dread', '공포의 파동',
    '체사레가 결속된 적을 공포에 빠뜨리면 같은 결속의 다른 적도 같은 확률로 공포 판정을 받는다.',
    { hooks: { onInflict(b, u, t, s) {
      if (s.type !== 'fear' || !u.mem.cesare || u.mem.puDread || !foe(b, u, t)) return;
      const bd = t.statuses.find((x) => x.key === 'bond');
      if (!bd) return;
      u.mem.puDread = 1;
      for (const e of b.enemiesOf(u)) {
        if (e === t || !e.statuses.some((x) => x.key === 'bond' && x.grp === bd.grp) || b.has(e, 'fear')) continue;
        if (fear(b, u, e, J.mind.dreadDur, u.sk.fearChance ?? 1)) b.fx(e.x, e.y, 0, 'psy');
      }
      u.mem.puDread = 0;
    } } }, CESARE),
  // 교단의 압생트 '아비스' 한 방울: 몽환적인, 여정을 떠나는 맛. 다트가 혼란을 더 깊게 한다
  pu('joshua', 'mind', 'abyss', '아비스',
    `다트(기본 공격)가 혼란된 적에게 맞으면 혼란 +${J.mind.abyssExt}초 (같은 혼란에 최대 +${J.mind.abyssMax}초). 체사레일 때는 작동하지 않는다.`,
    { hooks: { onBasic(b, u, t, r) {
      if (u.mem.cesare || r.miss || !t.alive || !foe(b, u, t)) return;
      const s = t.statuses.find((x) => x.key === 'confuse' && x.dur > 0);
      if (!s) return;
      const used = ABYSS.get(s) || 0, add = Math.min(J.mind.abyssExt, J.mind.abyssMax - used);
      if (add <= 0) return;
      s.dur += add;
      ABYSS.set(s, used + add);
      b.fx(t.x, t.y, 0, 'psy');
    } } }),
];
