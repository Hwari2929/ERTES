// 사이오닉 전용 전공 증강: onyx (kit.ts 참고)
// 오닉스 감응자: 합창(기본 공격) · 의뢰하지 않은 꿈(전체 정신 공격 + 공포) · 합창이 깎는 이성 · 조용한 방을 바라는 마음 · 흥얼거림
import type { Battle, CUnit } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import { fear } from '../kit';
import { mp } from '../psionic';
import { pu } from './kit';

/** 오닉스 전용 전공 증강 수치 */
export const O = {
  gold: {
    /** 화음: 임시 장비 1개당 함께 맞는 적 1명 · 계수 (주요 위력) · 범위 */
    voiceCoef: 0.2, voiceR: 1, voiceMax: 3,
    /** 꿈값 청구: 공포 1번당 시장 개입 쿨다운 감소 (초) · 1초에 최대 */
    billCd: 1, billMax: 3,
    /** 조용한 방: 되돌아오는 이성 · 합창 멈춤 (초) · 전투당 최대 */
    quietTo: -50, quietPause: 3, quietMax: 3,
  },
  illusion: {
    /** 돌림노래: 꿈 계수 대비 · 범위 · 따라 부르는 간격 (초) */
    roundK: 0.5, roundR: 1, roundGap: 0.4,
    /** 허밍: 1초마다 계수 (주요 위력) · 범위 · 흥얼거린 환영 · 분신 1기당 이성 · 초당 최대 이성 */
    humCoef: 0.15, humR: 1, humReason: 1, humMax: 2,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
/** 1초 창 안에서 최대 n회 */
const perSec = (b: Battle, u: CUnit, key: string, n: number) => {
  const w = Math.floor(b.t);
  if (u.mem[`${key}W`] !== w) { u.mem[`${key}W`] = w; u.mem[`${key}N`] = 0; }
  if ((u.mem[`${key}N`] || 0) >= n) return false;
  u.mem[`${key}N`] = (u.mem[`${key}N`] || 0) + 1;
  return true;
};
const shadesOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.alive && s.owner === u && s.mem.illusion);
const scented = (e: CUnit) => e.statuses.some((s) => s.key === 'scent');

export const AUGS: AugDef[] = [
  // ───────── 보화
  pu('onyx', 'gold', 'harmony', '화음',
    `합창(기본 공격)이 맞으면 장착한 임시 장비 1개당 대상 주변 ${O.gold.voiceR}칸의 다른 적 1명(최대 ${O.gold.voiceMax}명)도 화음에 맞아 주요 위력 ${pc(O.gold.voiceCoef)} 정신 피해를 받는다.`,
    { hooks: { onBasic(b, u, t, r) {
      const n = Math.min(O.gold.voiceMax, u.mem.goldItems || 0);
      if (u.school !== 'gold' || !n || r.amount <= 0 || r.miss || !foe(b, u, t)) return;
      const near = b.around(t, O.gold.voiceR, b.enemiesOf(u)).filter((e) => e !== t && e.alive).sort((a, c) => b.dist(a, t) - b.dist(c, t)).slice(0, n);
      for (const e of near) {
        b.emit({ k: 'atk', from: t.id, to: e.id, elem: 'psy', ranged: true, chain: true });
        b.dealDamage(u, e, mp(b, u) * O.gold.voiceCoef, { elem: 'psy', tag: 'proc', kind: 'tech' });
      }
    } } }, { hint: '임시 장비가 있어야 작동', stacks: { st: 'tempgear', need: 1 } }),
  pu('onyx', 'gold', 'bill', '꿈값 청구',
    `적을 공포에 빠뜨릴 때마다(의뢰하지 않은 꿈 등) 꿈값을 받아 시장 개입 쿨다운 -${O.gold.billCd}초 (1초에 최대 ${O.gold.billMax}번).`,
    { hooks: { onInflict(b, u, t, s) {
      if (u.school !== 'gold' || s.type !== 'fear' || !u.cantrip || !foe(b, u, t) || !perSec(b, u, 'puOnyxBill', O.gold.billMax)) return;
      u.cantripCd = Math.max(0, u.cantripCd - O.gold.billCd);
    } } }),
  pu('onyx', 'gold', 'quiet', '조용한 방',
    `이성이 -100에 닿으면 장착한 임시 장비 1개당 1번(전투당 최대 ${O.gold.quietMax}번) 광폭 대신 조용한 방에 든다: 이성이 ${O.gold.quietTo}으로 돌아오고 합창의 이성 감소가 ${O.gold.quietPause}초 멈춘다.`,
    { hooks: { onFrenzy(b, u) {
      const used = u.mem.puOnyxQuiet || 0;
      if (u.school !== 'gold' || used >= Math.min(O.gold.quietMax, u.mem.goldItems || 0) || u.reason === null) return;
      u.mem.puOnyxQuiet = used + 1;
      u.statuses = u.statuses.filter((s) => s.key !== 'frenzy');
      u.target = null;
      b.addReason(u, (O.gold.quietTo - u.reason) / (1 + (u.mem.reasonAmp || 0)), '조용한 방');
      u.mem.ot = (u.mem.ot || 0) - O.gold.quietPause; // 합창(이성 규칙)의 초당 이성 감소 누적 (rework.ts onyx)
      b.emit({ k: 'status', id: u.id, name: '조용한 방' });
    } } }, { hint: '임시 장비가 있어야 작동', stacks: { st: 'tempgear', need: 1 } }),

  // ───────── 환조
  pu('onyx', 'illusion', 'round', '돌림노래',
    `의뢰하지 않은 꿈(전투 스킬)을 쓰면 환영 · 분신이 차례로 따라 부른다: 1기마다 그 주변 ${O.illusion.roundR}칸 적에게 꿈 계수의 ${pc(O.illusion.roundK)}만큼 정신 피해 (같은 적은 시전마다 1번).`,
    { hooks: { onSkill(b, u) {
      if (u.school !== 'illusion') return;
      const hit = new Set<CUnit>(), k = (u.sk.mult || 0) * O.illusion.roundK;
      shadesOf(b, u).forEach((s, i) => b.later(O.illusion.roundGap * (i + 1), () => {
        if (!s.alive || !u.alive || b.over) return;
        b.fx(s.x, s.y, O.illusion.roundR, 'psy');
        for (const e of b.around(s, O.illusion.roundR, b.enemiesOf(u))) {
          if (!e.alive || hit.has(e)) continue;
          hit.add(e);
          b.dealDamage(u, e, b.P(u, 'tech') * k, { elem: 'psy', tag: 'proc', kind: 'tech' });
        }
      }));
    } } }),
  pu('onyx', 'illusion', 'nightmare', '가위눌림',
    '향취가 걸린 적에게 거는 공포는 같은 시간의 기절(가위눌림)이 된다. 의뢰하지 않은 꿈은 향취가 걸린 적에게 공포 판정을 한 번 더 한다.',
    { hooks: {
      onInflict(b, u, t, s) {
        if (u.school !== 'illusion' || s.type !== 'fear' || !foe(b, u, t) || !scented(t)) return;
        s.type = 'stun'; s.key = 'stun'; s.label = '가위눌림';
      },
      onSkill(b, u) {
        if (u.school !== 'illusion' || !u.sk.fearChance) return;
        for (const e of b.enemiesOf(u)) {
          if (!e.alive || !scented(e) || e.statuses.some((s) => (s.key === 'stun' || s.key === 'fear') && s.src === u)) continue;
          fear(b, u, e, u.sk.fear || 0, u.sk.fearChance);
        }
      },
    } }),
  pu('onyx', 'illusion', 'hum', '허밍',
    `환영 · 분신이 1초마다 흥얼거린다: 주변 ${O.illusion.humR}칸 적에게 주요 위력 ${pc(O.illusion.humCoef)} 정신 피해. 흥얼거림 1기당 오닉스의 이성 +${O.illusion.humReason} (초당 최대 +${O.illusion.humMax}).`,
    { hooks: { onTick(b, u, dt) {
      if (u.school !== 'illusion') return;
      u.mem.puOnyxHum = (u.mem.puOnyxHum || 0) + dt;
      if (u.mem.puOnyxHum < 1) return;
      u.mem.puOnyxHum -= 1;
      const ss = shadesOf(b, u);
      for (const s of ss) {
        const es = b.around(s, O.illusion.humR, b.enemiesOf(u)).filter((e) => e.alive);
        if (es.length) b.fx(s.x, s.y, O.illusion.humR, 'psy', 'aura');
        for (const e of es) b.dealDamage(u, e, mp(b, u) * O.illusion.humCoef, { elem: 'psy', tag: 'proc', kind: 'tech' });
      }
      if (ss.length) b.addReason(u, Math.min(O.illusion.humMax, ss.length * O.illusion.humReason), '허밍');
    } } }),
];
