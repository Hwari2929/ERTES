// 사이오닉 전용 전공 증강: gungo (kit.ts 참고)
// 궁오: 전등사의 산군 (범). 특성 [범기름] (보호막을 벗겨 냄), 범의 발톱 (근접 콤보), 전투 스킬 [궤도 화승포] (가장 모인 곳 포격 + 연소),
// 전등사 보호막 생성기를 거꾸로 돌려 바깥을 지키려는 계획, 공왕을 즉사시킨 산군 · '마지막 호환'의 예언.
// 수치는 GX, 설명문도 GX 를 읽는다.
import type { Battle, CUnit, DmgOpts } from '../../engine/combat';
import type { AugDef, AugReq } from '../../engine/effects';
import { blinkTo } from '../kit';
import { addBurn, addChill, mp } from '../psionic';
import { pu } from './kit';

/** 궁오 전용 전공 증강 수치 */
export const GX = {
  pyro: {
    /** 범기름 인화: 범기름 지속 · 받는 연소 · 소각 피해 증가 · 연소 피해에 벗겨지는 보호막 비율 · 같은 적 대기 */
    oilDur: 5, oilDmg: 0.3, oilStrip: 0.5, oilIcd: 1,
    /** 화승포 잔불: 지속 · 몇 초마다 · 연소 */
    emberDur: 4, emberEvery: 2, emberBurn: 1,
    /** 전등사의 장막: 연소 1중첩당 보호막 (주요 위력 배수) · 셈하는 최대 중첩 */
    veilPer: 0.2, veilMax: 5,
  },
  chrono: {
    /** 산군의 도약: 필요한 오한 중첩 · 범위 · 피해 · 재사용 대기 */
    pounceAt: 3, pounceR: 4, pounceCoef: 1, pounceCd: 5,
    /** 시간차 포탄: 지연 · 피해 · 오한 */
    echoDelay: 1.5, echoCoef: 0.6, echoChill: 2,
    /** 마지막 호환: 빙결된 적을 즉시 쓰러뜨리는 체력 비율 */
    baneHp: 0.15,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const kindOf = (u: CUnit): 'shoot' | 'strike' | 'tech' => (u.ctype === 'MARK' ? 'shoot' : u.ctype === 'VAN' ? 'strike' : 'tech');
const stacksOf = (u: CUnit, k: string) => u.statuses.find((s) => s.key === k)?.stacks || 0;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
const hasOil = (t: CUnit, u: CUnit) => t.statuses.some((s) => s.key === 'pu.gungo.oil' && s.src === u);

/** 궤도 화승포가 떨어진 자리: 이번 시전(같은 시각)에 맞은 적들의 칸을 모았다가, 서로 가장 많이 붙어 있는 칸을 중심으로 */
interface Pt { x: number; y: number }
const HITS = new WeakMap<CUnit, { t: number; pts: Pt[] }>();
function noteHit(b: Battle, u: CUnit, t: CUnit) {
  const h = HITS.get(u);
  if (h && h.t === b.t) h.pts.push({ x: t.x, y: t.y });
  else HITS.set(u, { t: b.t, pts: [{ x: t.x, y: t.y }] });
}
function impact(b: Battle, u: CUnit): Pt | null {
  const h = HITS.get(u);
  if (!h || h.t !== b.t || !h.pts.length) return null;
  let best = h.pts[0], bn = -1;
  for (const p of h.pts) { const n = h.pts.filter((q) => b.dist(p, q) <= 1).length; if (n > bn) { bn = n; best = p; } }
  return best;
}
/** 화승포의 피해 반경 (전투 스킬 수치, 성장으로 늘 수 있다) */
const radiusOf = (u: CUnit) => u.sk.radius ?? 1;
/** 전투 스킬(궤도 화승포)의 적중 */
const noteSkillHit = (b: Battle, u: CUnit, t: CUnit, o: DmgOpts) => { if (o.tag === 'skill' && o.key !== 'cantrip' && foe(b, u, t)) noteHit(b, u, t); };
/** 화승포 잔불 지대 */
const ZONE = new WeakMap<CUnit, { x: number; y: number; r: number; until: number; next: number }>();

const P = GX.pyro, C = GX.chrono;
const REQ: Record<string, AugReq> = {
  pounce: { hint: `오한 ${C.pounceAt}중첩 필요`, stacks: { st: 'chill', need: C.pounceAt } },
};

export const AUGS: AugDef[] = [
  // ───────── 홍염
  pu('gungo', 'pyro', 'oil', '범기름 인화',
    `기본 공격 · 전투 스킬에 맞은 적에게 ${P.oilDur}초간 [범기름]. 범기름이 묻은 적은 자신의 연소 · 소각 피해를 ${pc(P.oilDmg)} 더 받고, 연소 피해를 받을 때마다 보호막이 ${pc(P.oilStrip)} 벗겨진다 (${P.oilIcd}초에 1회).`,
    { hooks: {
      onDeal(b, u, t, r, o) {
        if (!t.alive || !foe(b, u, t)) return;
        if ((o.tag === 'basic' || o.tag === 'skill') && o.key !== 'cantrip' && !r.miss) {
          const ex = t.statuses.find((s) => s.key === 'pu.gungo.oil' && s.src === u);
          if (ex) ex.dur = Math.max(ex.dur, P.oilDur); // 다시 묻히면 시간만 갱신
          else b.applyStatus(u, t, { type: 'buff', key: 'pu.gungo.oil', dur: P.oilDur, label: '범기름' }, 9);
        }
        // 기름 먹은 불길: 연소가 보호막을 벗긴다 (특성 범기름을 연소 피해까지)
        if (o.key === 'burn' && t.shield > 0 && hasOil(t, u) && icd(b, t, `puOil${u.id}`, P.oilIcd)) t.shield *= 1 - P.oilStrip;
      },
      dmgMult: (_b, u, t, o) => ((o.key === 'cantrip' || o.key === 'burn') && hasOil(t, u) ? 1 + P.oilDmg : 1),
    } }),
  pu('gungo', 'pyro', 'embers', '화승포 잔불',
    `궤도 화승포가 떨어진 자리(포격 반경)가 ${P.emberDur}초간 불탄다: ${P.emberEvery}초마다 그 안의 적에게 연소 ${P.emberBurn}중첩.`,
    { hooks: {
      onDeal(b, u, t, _r, o) { noteSkillHit(b, u, t, o); },
      onSkill(b, u) {
        const c = impact(b, u);
        if (c) ZONE.set(u, { ...c, r: radiusOf(u), until: b.t + P.emberDur, next: b.t + P.emberEvery }); // 새 포격이 앞 잔불을 대신한다
      },
      onTick(b, u) {
        const z = ZONE.get(u);
        if (!z || !u.alive || b.t > z.until + 1e-6 || b.t < z.next) return;
        z.next += P.emberEvery;
        b.fx(z.x, z.y, z.r, 'phys');
        for (const e of b.around(z, z.r, b.enemiesOf(u))) if (e.alive) addBurn(b, u, e, P.emberBurn);
      },
    } }),
  pu('gungo', 'pyro', 'veil', '전등사의 장막',
    `자신이 건 연소가 남은 적이 쓰러지면 체력 비율이 가장 낮은 아군에게 연소 1중첩당 주요 위력 ${pc(P.veilPer)} 보호막 (최대 ${P.veilMax}중첩분).`,
    { hooks: { onAnyDeath(b, u, dead) {
      if (!u.alive || !foe(b, u, dead)) return;
      const s = dead.statuses.find((x) => x.key === 'burn' && x.src === u);
      const a = s ? b.lowestHpAlly(u) : null;
      if (!s || !a) return;
      b.shield(a, mp(b, u) * P.veilPer * Math.min(P.veilMax, s.stacks || 1));
      b.fx(a.x, a.y, 0, 'holy', 'heal');
    } } }),

  // ───────── 시공
  pu('gungo', 'chrono', 'pounce', '산군의 도약',
    `적을 쓰러뜨린 직후나 공격이 닿는 적이 없을 때, ${C.pounceR}칸 안에서 오한 ${C.pounceAt}중첩 이상이거나 빙결된 적 중 가장 가까운 적에게 뛰어들어 주요 위력 ${pc(C.pounceCoef)} 물리 피해 (${C.pounceCd}초에 1회).`,
    { hooks: {
      onKill(b, u) { u.mem.puHuntT = b.t + 0.5; }, // 사냥감을 쓰러뜨리면 다음 사냥감으로
      onTick(b, u) {
      if (!u.alive || u.immobile || (u.mem.puPounceT || 0) > b.t || u.mem.charmTo || b.controlled(u)) return;
      if (u.statuses.some((s) => s.key === 'root' || s.key === 'confuse' || s.key === 'fear')) return;
      const reach = b.S(u, 'range');
      // 싸우던 자리를 함부로 버리지 않는다: 방금 적을 쓰러뜨렸거나 닿는 적이 없을 때만
      if ((u.mem.puHuntT || 0) <= b.t && b.enemiesOf(u).some((e) => b.dist(u, e) <= reach)) return;
      const prey = b.targetable(u).filter((e) => {
        const d = b.dist(u, e);
        return d > reach && d <= C.pounceR && (stacksOf(e, 'chill') >= C.pounceAt || e.statuses.some((s) => s.key === 'freeze'));
      });
      const t = prey.length ? b.nearest(u, prey) : null;
      if (!t || !blinkTo(b, u, t)) return;
      u.mem.puPounceT = b.t + C.pounceCd;
      u.mem.lastCell = -1;
      b.emit({ k: 'status', id: u.id, name: '산군의 도약', src: u.id });
      b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: false });
      b.dealDamage(u, t, mp(b, u) * C.pounceCoef, { elem: 'phys', tag: 'proc', kind: kindOf(u) });
      },
    } }, REQ.pounce),
  pu('gungo', 'chrono', 'echo', '시간차 포탄',
    `궤도 화승포가 떨어진 자리에 ${C.echoDelay}초 뒤 같은 포탄이 한 번 더 떨어져 포격 반경 안의 적에게 주요 위력 ${pc(C.echoCoef)} 물리 피해와 오한 ${C.echoChill}중첩.`,
    { hooks: {
      onDeal(b, u, t, _r, o) { noteSkillHit(b, u, t, o); },
      onSkill(b, u) {
        const c = impact(b, u);
        if (!c) return;
        const r = radiusOf(u);
        b.later(C.echoDelay, () => {
          if (b.over || !u.alive) return;
          b.fx(c.x, c.y, r, 'phys');
          b.emit({ k: 'status', id: u.id, name: '시간차 포탄', src: u.id });
          for (const e of b.around(c, r, b.enemiesOf(u))) {
            if (!e.alive) continue;
            b.dealDamage(u, e, mp(b, u) * C.echoCoef, { elem: 'phys', tag: 'proc', kind: kindOf(u) });
            if (e.alive) addChill(b, u, e, C.echoChill);
          }
        });
      },
    } }),
  pu('gungo', 'chrono', 'bane', '마지막 호환',
    `빙결된 적이 기본 공격 · 전투 스킬 · 비술에 맞고 체력 ${pc(C.baneHp)} 이하로 남으면 즉시 쓰러뜨린다 (보스 제외).`,
    { hooks: { onDeal(b, u, t, _r, o) {
      if ((o.tag !== 'basic' && o.tag !== 'skill') || !t.alive || t.isBoss || !foe(b, u, t)) return;
      if (!t.statuses.some((s) => s.key === 'freeze') || b.hpPct(t) > C.baneHp) return;
      b.emit({ k: 'status', id: t.id, name: '마지막 호환', src: u.id, harm: true });
      b.fx(t.x, t.y, 0, 'phys');
      b.kill(t, u);
    } } }),
];
