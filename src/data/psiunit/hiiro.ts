// 사이오닉 전용 전공 증강: hiiro (kit.ts 참고)
// 히이로: 점괘(특성 · 전투 스킬)의 길흉 · 여우불 부적(공포 환술) · 간식값(복채) · 기억에서 미끄러지는 얼굴
import type { Battle, Cantrip, CUnit, Status } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import { fear } from '../kit';
import { CANTRIPS, giveTempItem } from '../psionic';
import { PSI } from '../psinum';
import { pu } from './kit';

/** 히이로 전용 전공 증강 수치 */
export const H = {
  gold: {
    /** 행운 부적: 길 점괘 대상에게 임시 장비 (전투당 최대) */
    charmMax: 2,
    /** 복채: 처치 1번당 크레딧 · 전투당 최대 횟수 · 시장 개입 쿨다운 감소 (초) */
    fee: 1, feeMax: 3, feeCd: 1,
  },
  illusion: {
    /** 액막이 인형: 전투당 최대 */
    effigyMax: 3,
    /** 흐릿한 얼굴: 히이로 주변 범위 · 잊은 뒤 환영 · 분신을 노리는 시간 (초) */
    blurR: 2, blurLock: 1.5,
    /** 여우 홀림: 공포 확률 · 지속 · 같은 적 판정 대기 */
    bewitchP: 0.25, bewitchDur: 2, bewitchIcd: 3,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 전투 스킬 점괘 (rosterB hiiro: 'hiiro.omen', 길 = '대길') · 특성 점괘 흉 ('hiiro.start' 의 받는 피해 증가) */
const isOmen = (s: Status) => s.key === 'hiiro.omen';
const badOmen = (s: Status) => (isOmen(s) && s.label === '흉') || (s.key === 'hiiro.start' && !!s.taken?.length);
const shadesOf = (b: Battle, u: CUnit) => b.units.filter((s) => s.alive && s.owner === u && s.mem.illusion);
/** 흐릿한 얼굴: 지난 틱의 환영 · 분신 */
const SEEN = new WeakMap<CUnit, Set<CUnit>>();

// ───── 보화 · 운세 담보: 흉 = 다음 시장 개입 보험, (담보 없는) 실패 = 다음 점괘 길
/** 시장 개입 결과를 보려고 비술을 감싼다: 성공 여부 = 자신 · 배당 임시 장비가 늘었는지 (완전 헤지는 언제나 성공) */
function wrapMarket(u: CUnit) {
  const c = u.cantrip;
  if (!c || u.school !== 'gold' || u.mem.puHiiroWrap) return;
  u.mem.puHiiroWrap = 1;
  const w: Cantrip = { ...c, cast(b, self) {
    const g0 = self.mem.goldItems || 0, d0 = self.mem.goldDiv || 0;
    const res = c.cast(b, self);
    if (!res) return res;
    const won = (self.mem.goldItems || 0) > g0 || (self.mem.goldDiv || 0) > d0;
    if (won) return res;
    if (self.mem.puHiiroSure) {
      self.mem.puHiiroSure = 0;
      if (giveTempItem(b, self)) b.emit({ k: 'status', id: self.id, name: '담보 회수' });
    } else self.mem.puHiiroLuck = 1;
    return res;
  } };
  u.cantrip = w;
}

export const AUGS: AugDef[] = [
  // ───────── 보화
  pu('hiiro', 'gold', 'collateral', '운세 담보',
    '점괘(특성 · 전투 스킬)가 흉이면 그 흉을 담보로 잡아 다음 시장 개입은 실패해도 임시 장비 1개를 받는다. 담보 없이 시장 개입이 실패하면 다음에 전투 스킬 점괘가 흉으로 나올 때 길로 바뀐다.',
    { hooks: {
      onStart(_b, u) { wrapMarket(u); },
      onInflict(b, u, _t, s) {
        if (u.school !== 'gold') return;
        if (isOmen(s) && s.label === '흉' && u.mem.puHiiroLuck) {
          // 흉을 길로 바꾼다 (점괘가 이미 깎은 이성 10을 되돌리고 길의 +10)
          u.mem.puHiiroLuck = 0;
          s.mods = [{ kind: 'inc', tag: 'all', v: u.sk.dmg || 0 }];
          s.delta = { atkSpd: u.sk.as || 0 };
          s.label = '대길';
          b.addReason(u, 20, '운세 담보');
          return;
        }
        if (badOmen(s)) u.mem.puHiiroSure = 1;
      },
    } }),
  pu('hiiro', 'gold', 'charm', '행운 부적',
    `점괘(전투 스킬)가 길이면 대상 아군에게 무작위 재료 장비 1개를 이번 전투 동안 임시 장착시킨다 (전투당 ${H.gold.charmMax}개, 대상마다 임시 장비 최대 ${PSI.gold.max}개).`,
    { hooks: { onInflict(b, u, t, s) {
      if (!isOmen(s) || (u.mem.puHiiroCharm || 0) >= H.gold.charmMax) return;
      // 운세 담보가 같은 시전에서 흉을 길로 바꿀 수 있어 판정은 이 시전이 끝난 뒤
      b.later(0, () => {
        if (s.label !== '대길' || !t.alive || !u.alive || (u.mem.puHiiroCharm || 0) >= H.gold.charmMax) return;
        if (giveTempItem(b, u, t)) u.mem.puHiiroCharm = (u.mem.puHiiroCharm || 0) + 1;
      });
    } } }),
  {
    ...pu('hiiro', 'gold', 'fee', '복채',
      `점괘(전투 스킬)로 길을 받은 아군이 그 효과 중 적을 처치하면 복채를 받는다: 시장 개입 쿨다운 -${H.gold.feeCd}초, 이긴 전투가 끝나면 복채 1번당 크레딧 +${H.gold.fee} (전투당 최대 ${H.gold.feeMax}번).`,
      { hooks: { onAnyDeath(b, u, dead, killer) {
        if (!killer || !u.alive || !foe(b, u, dead) || (u.mem.puHiiroFee || 0) >= H.gold.feeMax) return;
        if (!killer.statuses.some((s) => isOmen(s) && s.src === u && s.label === '대길')) return;
        u.mem.puHiiroFee = (u.mem.puHiiroFee || 0) + 1;
        if (u.cantrip) u.cantripCd = Math.max(0, u.cantripCd - H.gold.feeCd);
        b.emit({ k: 'status', id: u.id, name: `복채 +${H.gold.fee}c` });
      } } }),
    after: (run, _u, won, _k, x) => {
      const n = Math.min(H.gold.feeMax, x?.c?.mem.puHiiroFee || 0);
      if (won && n > 0) run.credits += n * H.gold.fee;
    },
  },

  // ───────── 환조
  pu('hiiro', 'illusion', 'effigy', '액막이 인형',
    `점괘(특성 · 전투 스킬)가 흉으로 나올 때마다 액막이 환영이 흉을 대신 받는다: 특성 흉의 받는 피해 증가가 걸리지 않고, 현재 대상 근처에 환영 향과 같은 환영(분신이면 분신) 1기가 생긴다 (전투당 ${H.illusion.effigyMax}기).`,
    { hooks: { onInflict(b, u, _t, s) {
      if (u.school !== 'illusion' || !badOmen(s)) return;
      const same = u.mem.puHiiroEffT === b.t + 1; // 같은 점괘(특성은 아군마다 걸린다)는 1기만
      if (!same && (u.mem.puHiiroEff || 0) >= H.illusion.effigyMax) return;
      if (s.key === 'hiiro.start') { s.taken = undefined; s.dur = 0.1; s.label = '액막이'; }
      if (same) return;
      u.mem.puHiiroEffT = b.t + 1;
      u.mem.puHiiroEff = (u.mem.puHiiroEff || 0) + 1;
      b.later(0, () => {
        if (!u.alive || b.over) return;
        // 환영 향과 같은 소환 (거울 상은 비술에서만)
        const mirror = u.mem['ps.illusion.mirror'];
        u.mem['ps.illusion.mirror'] = 0;
        const ok = CANTRIPS.illusion.cast(b, u);
        u.mem['ps.illusion.mirror'] = mirror;
        if (ok) b.emit({ k: 'status', id: u.id, name: '액막이 인형' });
      });
    } } }),
  pu('hiiro', 'illusion', 'blur', '흐릿한 얼굴',
    `환영 · 분신이 생겨날 때 히이로를 노리던 적과 히이로 주변 ${H.illusion.blurR}칸의 적은 히이로를 잊는다: 히이로에 대한 도발 수치가 0이 되고 ${H.illusion.blurLock}초간 그 환영 · 분신을 노린다.`,
    { hooks: { onTick(b, u) {
      if (u.school !== 'illusion') return;
      const prev = SEEN.get(u) || new Set<CUnit>(), now = new Set(shadesOf(b, u));
      SEEN.set(u, now);
      for (const s of now) {
        if (prev.has(s)) continue;
        for (const e of b.enemiesOf(u)) {
          if (!e.alive || (e.target !== u && b.dist(e, u) > H.illusion.blurR)) continue;
          e.prov?.set(u, 0);
          b.provoke(e, s, H.illusion.blurLock);
          b.emit({ k: 'status', id: e.id, name: '잊힘', src: u.id, harm: true });
        }
      }
    } } }),
  pu('hiiro', 'illusion', 'bewitch', '여우 홀림',
    `여우불 부적(기본 공격)이 향취가 걸린 적에게 맞으면 ${pc(H.illusion.bewitchP)} 확률로 ${H.illusion.bewitchDur}초 공포, 그동안 향취가 사라지지 않는다 (같은 적은 ${H.illusion.bewitchIcd}초에 1회 판정).`,
    { hooks: { onBasic(b, u, t, r) {
      if (u.school !== 'illusion' || r.amount <= 0 || r.miss || !t.alive || !foe(b, u, t)) return;
      const sc = t.statuses.find((s) => s.key === 'scent');
      if (!sc || !icd(b, t, `puBewitch${u.id}`, H.illusion.bewitchIcd)) return;
      if (fear(b, u, t, H.illusion.bewitchDur, H.illusion.bewitchP)) sc.dur = Math.max(sc.dur, t.statuses.find((s) => s.key === 'fear')?.dur || 0);
    } } }),
];
