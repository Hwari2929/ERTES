// 사이오닉 전용 전공 증강: zina (kit.ts 참고)
// 지나: 꽃다발 속 소음 권총 · [꽃집 아가씨] 기본 공격이 중독, 중독된 적에게 피해 증가, 암살형 적에게서 멀리 물러남
// [마지막 꽃다발] 체력 비율이 가장 낮은 적 곁으로 숨어들어 화학 피해 + 중독, 처치하면 쿨다운 회복. 이성: 스킬 -10, 처치 +6. 전직 성도회 암살자.
import type { Battle, CUnit } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import { confuse, mp } from '../psionic';
import { pu } from './kit';

/** 지나 전용 전공 증강 수치 (설명문도 여기서 읽는다) */
export const Z = {
  seed: {
    /** 조화: 중독을 옮길 범위 */
    wreathR: 3,
    /** 거름: 포자 쿨다운 감소 */
    compost: 2,
    /** 백합의 꽃말: 대상 체력 조건 · 남은 중독 피해 중 즉시 주는 비율 · 상한 (주요 위력 배수) */
    lilyHp: 0.5, lilyK: 0.6, lilyCap: 2.5,
  },
  mind: {
    /** 소음기: 혼란 확률 · 지속 · 같은 적 대기 */
    silP: 0.3, silDur: 1, silIcd: 3,
    /** 공범: 지나가 처치한 것으로 칠 때 이성 (처치 +6 과 같게) */
    accReason: 6,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
const myPoison = (u: CUnit, t: CUnit) => t.statuses.find((s) => s.key === 'poison' && s.src === u);
const charmedBy = (e: CUnit, u: CUnit) => e.statuses.some((s) => s.key === 'charm' && s.src === u);
/** 마지막 꽃다발(전투 스킬) 적중 기록: 처치가 그 적중으로 난 것인지 본다 */
const skillKey = (u: CUnit) => `puZsk${u.id}`;
const markSkill = { onDeal(b: Battle, u: CUnit, t: CUnit, _r: unknown, o: { tag: string; key?: string }) {
  if (o.tag === 'skill' && o.key !== 'cantrip' && foe(b, u, t)) t.mem[skillKey(u)] = b.t;
} };
const bySkill = (b: Battle, u: CUnit, dead: CUnit) => dead.mem[skillKey(u)] === b.t;

export const AUGS: AugDef[] = [
  // ───── 파종
  // 조화(弔花): 마지막 꽃다발로 보낸 손님의 독을 다음 손님에게 — 다음 꽃다발이 노릴 가장 약한 적
  pu('zina', 'seed', 'wreath', '조화',
    `마지막 꽃다발로 적을 처치하면, 그 적에게 건 자신의 중독을 ${Z.seed.wreathR}칸 안에서 체력 비율이 가장 낮은 다른 적에게 그대로 옮긴다.`,
    { hooks: {
      onDeal: markSkill.onDeal,
      onKill(b, u, dead) {
        if (!bySkill(b, u, dead)) return;
        const s = myPoison(u, dead);
        if (!s || s.dur <= 0) return;
        const near = b.around(dead, Z.seed.wreathR, b.enemiesOf(u)).filter((e) => e !== dead && e.alive);
        if (!near.length) return;
        const e = near.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a));
        b.emit({ k: 'atk', from: dead.id, to: e.id, elem: 'chem', ranged: true });
        b.applyStatus(u, e, { ...s, dur: Math.max(s.dur, 1), tickAcc: 0, taken: undefined });
        b.fx(e.x, e.y, 0, 'chem');
      },
    } }),
  // 꽃집 주인의 거름: 중독으로 쓰러진 적이 다음 포자를 키운다
  pu('zina', 'seed', 'compost', '거름',
    `자신이 건 중독이 남은 적이 쓰러지면 포자 쿨다운 -${Z.seed.compost}초.`,
    { hooks: { onAnyDeath(b, u, dead) {
      if (!u.alive || !u.cantrip || !foe(b, u, dead) || !myPoison(u, dead)) return;
      u.cantripCd = Math.max(0, u.cantripCd - Z.seed.compost);
    } } }),
  // "오늘의 꽃은 백합이에요. 꽃말이요? …그건 받는 분이 알게 되실 거예요."
  pu('zina', 'seed', 'lily', '백합의 꽃말',
    `마지막 꽃다발에 맞은 뒤 체력이 ${pc(Z.seed.lilyHp)} 이하인 적에게는, 자신이 건 중독의 남은 피해 ${pc(Z.seed.lilyK)}를 즉시 준다 (최대 주요 위력 ${pc(Z.seed.lilyCap)}, 중독은 그대로).`,
    { hooks: { onDeal(b, u, t, r, o) {
      // 마지막 꽃다발의 중독은 피해 뒤에 걸린다: 여기서 보이는 중독은 이미 있던 것
      if (o.tag !== 'skill' || o.key === 'cantrip' || r.miss || !t.alive || !foe(b, u, t) || b.hpPct(t) > Z.seed.lilyHp) return;
      const s = myPoison(u, t);
      if (!s || !s.dps || s.dur <= 0 || t.mem[`puLily${u.id}`] === b.t) return;
      t.mem[`puLily${u.id}`] = b.t;
      b.fx(t.x, t.y, 0, 'chem');
      b.dealDamage(u, t, Math.min(s.dps * s.dur * Z.seed.lilyK, mp(b, u) * Z.seed.lilyCap), { elem: 'chem', tag: 'proc', kind: 'shoot' });
    } } }),
  // ───── 정신
  // 암살 명부: 결속으로 묶인 표적을 하나 지우면 같은 명부의 다음 표적으로 곧장
  pu('zina', 'mind', 'list', '명부',
    '결속된 적을 마지막 꽃다발로 처치했을 때 같은 결속의 적이 남아 있으면 쿨다운을 모두 돌려받는다 (결속 1묶음에 1번).',
    { hooks: {
      onDeal: markSkill.onDeal,
      onKill(b, u, dead) {
        if (!bySkill(b, u, dead)) return;
        const bd = dead.statuses.find((s) => s.key === 'bond');
        if (!bd || bd.grp === undefined || u.mem[`puList${bd.grp}`]) return;
        if (!b.enemiesOf(u).some((e) => e !== dead && e.statuses.some((s) => s.key === 'bond' && s.grp === bd.grp))) return;
        u.mem[`puList${bd.grp}`] = 1;
        u.cd = 0;
        b.fx(u.x, u.y, 0, 'psy', 'buff');
      },
    } }),
  // 꽃다발 속 소음 권총: 누가 쐈는지 모르는 적은 정신이 흐트러진다
  pu('zina', 'mind', 'silencer', '소음기',
    `자신을 노리지 않는 적에게 기본 공격이 맞으면 ${pc(Z.mind.silP)} 확률로 ${Z.mind.silDur}초 혼란 (같은 적은 ${Z.mind.silIcd}초에 1번 판정).`,
    { hooks: { onBasic(b, u, t, r) {
      if (r.miss || r.amount <= 0 || !t.alive || !foe(b, u, t) || t.target === u || !icd(b, t, `puSil${u.id}`, Z.mind.silIcd)) return;
      if (confuse(b, u, t, Z.mind.silDur, Z.mind.silP)) b.fx(t.x, t.y, 0, 'psy');
    } } }),
  // 성도회 암살자의 공범: 매혹한 적이 같은 표적을 노리고, 그 처치는 지나의 몫
  pu('zina', 'mind', 'accomplice', '공범',
    `자신이 매혹한 적은 지나의 대상을 함께 노린다. 그 적이 적을 쓰러뜨리면 지나가 처치한 것으로 친다 (이성 +${Z.mind.accReason}, 마지막 꽃다발 쿨다운을 처치할 때만큼 회복).`,
    { hooks: {
      onTick(b, u) {
        const t = u.target, ok = !!t && t.alive && foe(b, u, t);
        for (const e of b.units) {
          if (e.side === u.side) continue;
          const on = e.alive && ok && e !== t && !!e.mem.charmTo && charmedBy(e, u);
          if (on) {
            // 외길 추적처럼 대상을 고정 (매혹이 끝나면 원래대로)
            if (!e.mem.puAcc) { e.mem.puAcc = 1; e.mem.puAccPrev = e.mem.lockTarget || 0; }
            e.mem.lockTarget = 1;
            e.target = t;
          } else if (e.mem.puAcc) { e.mem.puAcc = 0; e.mem.lockTarget = e.mem.puAccPrev || 0; }
        }
      },
      onAnyDeath(b, u, dead, killer) {
        if (!killer || killer === u || !u.alive || !foe(b, u, dead) || !charmedBy(killer, u)) return;
        b.addReason(u, Z.mind.accReason, 'pu.zina.accomplice');
        u.cd = Math.min(u.cd, u.cdMax * (1 - (u.sk.resetOnKill || 0)));
        b.fx(u.x, u.y, 0, 'psy', 'buff');
      },
    } }),
];
