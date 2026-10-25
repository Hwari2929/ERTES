// 메이저 전용 증강 (기물별 14개 = 일반 12 + ★ 전설 2) · 궁극기가 없던 기물의 궁극기. 이 묶음이 맡은 기물만 채운다 (index.ts 가 합친다)
//  5묶음: 아문센 · 비외른 · 윈터 · 마오 · 시우 · 클로버 · 밍키 (예전 스페셜 증강 8개 + 여기 6개 = 일반 4 + ★ 전설 2)
import type { Battle, CUnit, Hooks, Status, UltDef } from '../../engine/combat';
import { type AugDef, type Effect, inc, red, vuln } from '../../engine/effects';
import type { Elem } from '../../types';
import { bleed, blinkTo, cleanse, every, isHarmful, pct, shock, slow, summonsOf } from '../kit';
import { addBurn } from '../psionic';
import { PSI } from '../psinum';
import { monsterBuff } from '../rosterE';
import { cookPower } from '../tpl';
import { setSk, uaug } from '../unitkit';

const mj = (owner: string, key: string, name: string, desc: string, effect: Effect, legend = false, extra: Partial<AugDef> = {}): AugDef =>
  ({ ...uaug(owner, `mj.${key}`, name, desc, effect), pool: 'special', ...(legend ? { legend: true } : {}), ...extra });

/** n 번 반복: 첫 번째는 바로, 그 뒤 every 초마다 (시전자가 쓰러지면 멈춘다) */
function pulse(u: CUnit, b: Battle, n: number, every: number, fn: (b: Battle, i: number) => void) {
  if (n <= 0) return;
  fn(b, 0);
  let i = 1, acc = 0;
  if (i >= n) return;
  const h: Hooks = {
    onTick(bb, self, dt) {
      if (!h.onTick) return;
      acc += dt;
      while (acc >= every && i < n && self.alive) { acc -= every; fn(bb, i++); }
      if (i >= n || !self.alive) h.onTick = undefined;
    },
  };
  u.hooks.push(h);
}
/** 같은 키 버프가 있으면 수치를 덮어쓰고 지속만 늘린다 (mergeStatus 는 수치를 바꾸지 않는다) */
function setBuff(b: Battle, src: CUnit, t: CUnit, key: string, dur: number, p: Partial<Status>) {
  const ex = t.statuses.find((s) => s.key === key);
  if (ex) { Object.assign(ex, p); ex.dur = Math.max(ex.dur, dur); return; }
  b.buff(src, t, key, dur, p);
}
/** start 에서 radius 칸 안의 적에게 튀는 바운스 (아직 안 맞은 적 먼저). first = start 도 먼저 맞힌다 */
function hop(b: Battle, u: CUnit, start: CUnit, hops: number, radius: number, dmg: number, elem: Elem, kind: 'shoot' | 'tech', onHit?: (e: CUnit) => void, first = false) {
  const hit = new Set<CUnit>([start]);
  if (first && start.alive) {
    b.emit({ k: 'atk', from: u.id, to: start.id, elem, ranged: true });
    const r = b.dealDamage(u, start, dmg, { elem, tag: 'proc', kind });
    if (r.amount > 0 && start.alive) onHit?.(start);
  }
  let at: CUnit = start, last: CUnit = start;
  for (let i = 0; i < hops; i++) {
    const near = b.around(at, radius, b.enemiesOf(u)).filter((e) => e !== last && e.alive);
    const fresh = near.filter((e) => !hit.has(e));
    const next = b.nearest(at, fresh.length ? fresh : near);
    if (!next) break;
    hit.add(next);
    b.emit({ k: 'atk', from: at.id, to: next.id, elem, ranged: true, chain: true });
    const r = b.dealDamage(u, next, dmg, { elem, tag: 'proc', kind });
    if (r.amount > 0 && next.alive) onHit?.(next);
    at = next; last = next;
  }
}
/** 적이 가장 많이 모인 칸 */
function densest(b: Battle, u: CUnit, r: number) {
  const es = b.enemiesOf(u);
  return es.length ? es.slice().sort((a, z) => b.around(z, r, es).length - b.around(a, r, es).length)[0] : null;
}

// ───────── 아문센: 궁극기 포탄 수 · 계수 (★ 마지막 편대 비행이 포탄 수를 바꾼다)
const AMU = { shells: 8, legend: 12, every: 0.25, mult: 1.3, pen: 0.3, slow: 0.3, slowDur: 2 };
/** 아문센 ★ 선회 비행: 화력 지원 뒤 추가 포격 (발 수 · 간격 · 계수) */
const ORBIT = { n: 4, every: 0.5, mult: 0.4 };
/** 시우 ★ 천구의 회전: 눈물의 해독 뒤 1초마다 바운스 (횟수 · 이어지는 바운스 수) */
const SIU_ORB = { n: 3, every: 1, hops: 2 };

export const AUGS: Record<string, AugDef[]> = {
  // ───────────────────────── 아문센 (지휘관 · 포격은 전술 위력)
  amundsen: [
    mj('amundsen', 'double', '2연장 포격', '에란테-7703 화력 지원이 같은 대상을 2번 포격한다 (2번째 피해 60%).', setSk((s) => { s.hits = Math.max(2, s.hits || 1); s.second = 0.6; })),
    mj('amundsen', 'mark', '좌표 지정', '화력 지원에 맞은 적은 6초간 받는 피해 +15%.', setSk((s) => { s.vuln = 0.15; s.vulnDur = 6; })),
    mj('amundsen', 'watch', '회중시계', '화력 지원을 쓸 때마다 다른 아군 전원의 기술 쿨다운 -0.5초.', { hooks: { onSkill(b, u) {
      for (const a of b.alliesOf(u, false)) if (a.skill) a.cd = Math.max(0, a.cd - 0.5);
    } } }),
    mj('amundsen', 'detour', '재미없는 길', '주변 2칸 안에 적이 있으면 주는 피해 +25%, 받는 피해 -10%.', { hooks: {
      dmgMult: (b, u) => (b.around(u, 2, b.enemiesOf(u)).length ? 1.25 : 1),
      takenMult: (b, u) => (b.around(u, 2, b.enemiesOf(u)).length ? 0.9 : 1),
    } }),
    mj('amundsen', 'orbit', '선회 비행', `화력 지원을 쓴 뒤 7703이 상공을 돌며 ${ORBIT.every}초마다 무작위 적에게 전술 위력 ${pct(ORBIT.mult)} 물리 포격 (${ORBIT.n}발, 화력 지원의 방어도 관통 적용). 다시 쓰면 ${ORBIT.n}발부터 새로 센다.`, { hooks: {
      onSkill(_b, u) { u.mem.amuOrbit = ORBIT.n; u.mem.amuOrbitAcc = 0; },
      onTick(b, u, dt) {
        if (!u.mem.amuOrbit) return;
        u.mem.amuOrbitAcc += dt;
        if (u.mem.amuOrbitAcc < ORBIT.every) return;
        u.mem.amuOrbitAcc -= ORBIT.every;
        u.mem.amuOrbit--;
        const es = b.targetable(u);
        if (!es.length) return;
        const t = b.rng.pick(es);
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
        b.dealDamage(u, t, b.P(u, 'shoot') * ORBIT.mult, { elem: 'phys', tag: 'proc', kind: 'shoot', canMiss: false, pen: u.sk.pen || 0 });
      },
    } }, true),
    mj('amundsen', 'lastflight', '마지막 편대 비행', `궁극기 [7703 전탄 발사] 포탄 ${AMU.shells} → ${AMU.legend}발, 궁극기 충전 +25%. 궁극기를 쓰면 다른 아군 전원의 남은 기술 쿨다운 -50%.`, { stats: { ultCharge: 0.25 }, setup: (u) => { u.mem.amuUltN = AMU.legend; u.mem.amuUltCd = 1; } }, true),
  ],

  // ───────────────────────── 비외른 (명사수 · 구조대장)
  bjorn: [
    mj('bjorn', 'aid', '응급 처치', '구조 작살을 쓸 때 체력 비율이 가장 낮은 아군을 사격 위력 100%만큼 회복한다.', { hooks: { onSkill(b, u) {
      const a = b.lowestHpAlly(u);
      if (a) { b.heal(u, a, b.P(u, 'shoot')); b.fx(a.x, a.y, 0, 'elec', 'heal'); }
    } } }),
    mj('bjorn', 'bill', '심신안정비 청구', '이긴 전투에서 구조 작살을 3번 쓸 때마다 크레딧 +1 (전투당 최대 +2).', { hooks: { onSkill(_b, u) { u.mem.bjBill = (u.mem.bjBill || 0) + 1; } } }, false, {
      after: (run, _u, won, _k, x) => { if (won) run.credits += Math.min(2, Math.floor((x?.c?.mem.bjBill || 0) / 3)); },
    }),
    mj('bjorn', 'crawl', '사지로 기어들기', '주변 2칸 안의 적 1명당 받는 피해 -5% (최대 -20%).', { hooks: {
      takenMult: (b, u) => 1 - Math.min(0.2, 0.05 * b.around(u, 2, b.enemiesOf(u)).length),
    } }),
    mj('bjorn', 'reel', '작살 회수', '구조 작살로 적을 쓰러뜨리면 쿨다운 50% 환급. 재장전 속도 +25%.', { stats: { reloadSpd: 0.25 }, setup: (u) => { u.sk.resetOnKill = Math.max(u.sk.resetOnKill || 0, 0.5); } }),
    mj('bjorn', 'thor', '천둥 작살', '구조 작살이 대상에게서 2칸 안의 다른 적에게 최대 4번 튄다: 튈 때마다 사격 위력 60% 전기 피해 + 1초 감전.', { hooks: { onDeal(b, u, t, r, o) {
      if (o.tag !== 'skill' || o.kind !== 'shoot' || o.elem !== 'elec' || r.amount <= 0) return;
      hop(b, u, t, 4, 2, b.P(u, 'shoot') * 0.6, 'elec', 'shoot', (e) => shock(b, u, e, 1, 1));
    } } }, true),
    mj('bjorn', 'wall', '방패벽', '주변 2칸 안의 다른 아군이 받는 피해의 30%를 대신 받는다. 비외른 피해량 경감 +15%p.', { taken: [red('all', 0.15)], hooks: { onTick(b, u, dt) {
      if (!every(u, 'bjWall', dt, 0.5, 0)) return;
      for (const a of b.around(u, 2, b.alliesOf(u, false))) b.buff(u, a, 'bjorn.wall', 0.7, { share: u, shareRate: 0.3 });
    } } }, true),
  ],

  // ───────────────────────── 윈터 (전문가 · 의무관)
  winter: [
    mj('winter', 'clean', '소독 완료', '전투 시작 시 아군 전원 효과 저항 +20%p (전투 동안).', { hooks: { onStart(b, u) {
      for (const a of b.alliesOf(u)) b.buff(u, a, 'winter.clean', 999, { delta: { effRes: 0.2 }, label: '소독 완료' });
    } } }),
    mj('winter', 'data', '임상 데이터', '전투 스킬을 쓸 때마다 기술 위력 +3% (최대 10번, +30%).', { hooks: { onSkill(b, u) {
      const n = (u.mem.wData = Math.min(10, (u.mem.wData || 0) + 1));
      setBuff(b, u, u, 'winter.data', 999, { delta: { tech: u.st.tech * 0.03 * n }, label: '임상 데이터' });
    } } }),
    mj('winter', 'triage', '응급 우선', '체력 비율 40% 이하인 아군을 회복할 때 회복량 +50%.', { hooks: { healMult: (b, _u, t) => (b.hpPct(t) <= 0.4 ? 1.5 : 1) } }),
    mj('winter', 'pit', '피트 스톱', '임상 시험 혈청을 받은 아군이 혈청 지속 시간 동안 공격 속도 +20%.', { hooks: { onInflict(b, u, t, s) {
      if (s.key === 'sup.winter') b.buff(u, t, 'winter.pit', s.dur, { delta: { atkSpd: 0.2 }, label: '피트 스톱' });
    } } }),
    mj('winter', 'phase3', '임상 3상', '다른 아군이 쓰러질 피해를 받으면 전투당 2번까지, 쓰러지는 대신 체력 40%로 회복하고 해로운 효과를 모두 없앤다 (윈터가 살아 있을 때).', { hooks: { onStart(b, u) {
      for (const a of b.alliesOf(u, false)) {
        if (a.isSummon) continue;
        a.hooks.push({ onLethal(bb, self) {
          if (!u.alive || (u.mem.w3 || 0) >= 2) return false;
          u.mem.w3 = (u.mem.w3 || 0) + 1;
          self.hp = bb.S(self, 'maxHp') * 0.4;
          cleanse(self);
          bb.emit({ k: 'mark', id: self.id, name: '임상 3상', style: 'revive' });
          bb.fx(self.x, self.y, 0, 'chem', 'heal');
          return true;
        } });
      }
    } } }, true),
    mj('winter', 'stem', '줄기세포 배양', '임상 시험 혈청을 받은 아군이 8초간 1초마다 최대 체력 3%를 회복한다 (생명과학 교수 적용).', { hooks: { onInflict(b, u, t, s) {
      if (s.key !== 'sup.winter') return;
      b.applyStatus(u, t, { type: 'buff', key: 'winter.stem', dur: 8, hps: b.S(t, 'maxHp') * 0.03, label: '줄기세포' });
    } } }, true),
  ],

  // ───────────────────────── 마오 (지휘관 · 셰프)
  mao: [
    mj('mao', 'ice', '얼음 추가', '네온 칵테일을 받은 아군 치명타 확률 +15%p (요리 지속 동안, 요리 배율 적용).', setSk((s) => { s.crit = (s.crit || 0) + 0.15; })),
    mj('mao', 'happy', '해피 아워', '전투 시작 후 10초 동안 쿨다운 감소 속도 +100%.', { hooks: { onStart(b, u) {
      b.buff(u, u, 'mao.happy', 10, { delta: { cdr: 1 }, label: '해피 아워' });
    } } }),
    mj('mao', 'fine', '위약금 조항', '네온 칵테일을 받은 아군을 공격한 적은 4초간 받는 피해 +15%.', { hooks: { onInflict(_b, u, t, s) {
      if (s.key !== 'sup.mao' || t.mem.maoFine) return;
      t.mem.maoFine = 1;
      t.hooks.push({ onHurt(bb, self, src) {
        if (!src.alive || bb.sideOf(src) === bb.sideOf(self) || !self.statuses.some((x) => x.key === 'sup.mao')) return;
        const ex = src.statuses.find((x) => x.key === 'mao.fine');
        if (ex && ex.dur > 1) return;
        bb.applyStatus(u, src, { type: 'buff', key: 'mao.fine', dur: 4, taken: [vuln('all', 0.15)], label: '위약금' });
      } });
    } } }),
    mj('mao', 'refill', '한 잔 더', '기본 공격을 할 때마다 네온 칵테일 쿨다운 -0.3초.', { hooks: { onBasic(_b, u) { u.cd = Math.max(0, u.cd - 0.3); } } }),
    mj('mao', 'openbar', '오픈 바', '네온 칵테일을 다른 아군 전원에게 낸다. 대신 요리 배율 -40%.', {
      setup: (u) => { u.sk.count = 99; u.mem.cookBonus = (u.mem.cookBonus || 0) - 0.4; },
      hooks: { onStart(_b, u) { u.sk.count = 99; } }, // 펜트하우스 바(2명)를 나중에 골라도 전원
    }, true),
    mj('mao', 'neon', '네온 사인', '기본 공격을 하지 않는다. 네온 칵테일 쿨다운 -40%, 요리 배율 +50%.', { setup: (u) => {
      u.noAttack = true;
      u.cdMax *= 0.6;
      u.mem.cookBonus = (u.mem.cookBonus || 0) + 0.5;
    } }, true),
  ],

  // ───────────────────────── 시우 (전문가 · 바운스)
  siu: [
    mj('siu', 'chain', '연쇄 해독', '바운스가 튈 때마다 피해가 15%씩 커진다 (1번째 +15%, 2번째 +30% …, 공격마다 처음부터).', { hooks: { dmgMult(b, u, _t, o) {
      if (o.tag === 'skill' || o.tag === 'basic') { u.mem.siuN = 0; u.mem.siuNT = b.t; return 1; }
      if (o.tag !== 'proc' || o.elem !== 'chem' || o.kind !== 'tech') return 1;
      if (u.mem.siuNT !== b.t) { u.mem.siuN = 0; u.mem.siuNT = b.t; }
      u.mem.siuN = (u.mem.siuN || 0) + 1;
      return 1 + 0.15 * u.mem.siuN;
    } } }),
    mj('siu', 'ending', '이미 적힌 결말', '체력 비율 30% 이하인 적에게 주는 전투 스킬 · 궁극기 피해 +60%.', { hooks: { dmgMult: (b, _u, t, o) => (o.tag === 'skill' && b.hpPct(t) <= 0.3 ? 1.6 : 1) } }),
    mj('siu', 'rewrite', '고쳐 쓰기', '바운스가 적을 맞힐 때마다 눈물의 해독 쿨다운 -0.2초.', { hooks: { onDeal(_b, u, _t, _r, o) {
      if (o.tag === 'proc' && o.elem === 'chem' && o.kind === 'tech') u.cd = Math.max(0, u.cd - 0.2);
    } } }),
    mj('siu', 'mag', '확장 탄창', '호신용 권총 탄창 8 → 12발, 재장전 속도 +20%.', { stats: { reloadSpd: 0.2 }, setup: (u) => { if (u.weapon) u.weapon = { ...u.weapon, mag: 12 }; } }),
    mj('siu', 'script', '은하수 필사', '눈물의 해독 · 바운스에 맞은 적에게 6초간 [필사]: 받는 화학 피해 +10%. [필사]된 적이 쓰러지면 그 자리에서 기술 위력 80% 화학 바운스가 3번 튄다 (이 바운스는 [필사]를 남기지 않는다).', { hooks: {
      onDeal(b, u, t, r, o) {
        if (r.amount <= 0 || (u.mem.siuNoMark || 0) > 0 || u.mem.siuUlt || o.elem !== 'chem' || o.kind !== 'tech' || (o.tag !== 'proc' && o.tag !== 'skill')) return;
        const ex = t.statuses.find((s) => s.key === 'siu.script' && s.src === u);
        if (ex) ex.dur = Math.max(ex.dur, 6);
        else b.applyStatus(u, t, { type: 'buff', key: 'siu.script', dur: 6, taken: [vuln('chem', 0.1)], label: '필사' });
      },
      onAnyDeath(b, u, dead) {
        if (dead.side === u.side || !dead.statuses.some((s) => s.key === 'siu.script' && s.src === u && s.dur > 0)) return;
        u.mem.siuNoMark = (u.mem.siuNoMark || 0) + 1;
        hop(b, u, dead, 3, u.sk.radius || 2, b.P(u, 'tech') * 0.8, 'chem', 'tech');
        u.mem.siuNoMark--;
      },
    } }, true),
    mj('siu', 'orbit', '천구의 회전', `눈물의 해독을 쓴 뒤 ${SIU_ORB.n}초 동안 ${SIU_ORB.every}초마다 무작위 적에게 바운스가 떨어져 ${SIU_ORB.hops}번 더 튄다 (바운스 계수 · 범위 적용). 다시 쓰면 처음부터.`, { hooks: {
      onSkill(_b, u) { u.mem.siuOrb = SIU_ORB.n; u.mem.siuOrbAcc = 0; },
      onTick(b, u, dt) {
        if (!u.mem.siuOrb) return;
        u.mem.siuOrbAcc += dt;
        if (u.mem.siuOrbAcc < SIU_ORB.every) return;
        u.mem.siuOrbAcc -= SIU_ORB.every;
        u.mem.siuOrb--;
        const es = b.targetable(u);
        if (!es.length) return;
        hop(b, u, b.rng.pick(es), SIU_ORB.hops, u.sk.radius || 2, b.P(u, 'tech') * (u.sk.bk || 0.5), 'chem', 'tech', undefined, true);
      },
    } }, true),
  ],

  // ───────────────────────── 클로버 (명사수 · 움직이지 않음 · 농업 드론)
  clover: [
    mj('clover', 'guard', '창고 경비', '주변 1칸 안의 적에게 주는 피해 +25%.', { hooks: { dmgMult: (b, u, t) => (b.dist(u, t) <= 1 ? 1.25 : 1) } }),
    mj('clover', 'plate', '드론 장갑', '농업 드론 최대 체력 +50%, 방어도 +50%.', { hooks: { onTick(b, u) {
      for (const p of summonsOf(b, u)) {
        if (p.mem.clvArm) continue;
        p.mem.clvArm = 1;
        const add = p.st.maxHp * 0.5;
        p.st.maxHp += add; p.hp += add;
        p.st.armor *= 1.5;
      }
    } } }),
    mj('clover', 'burner', '침입자 소각', '연소 중인 적에게 주는 피해 +20%.', { hooks: { dmgMult: (_b, _u, t) => (t.statuses.some((s) => s.key === 'burn') ? 1.2 : 1) } }),
    mj('clover', 'compost', '퇴비 순환', '적이 쓰러지면 농업 드론 전원이 곧바로 농작물을 던진다 (1초에 1번까지).', { hooks: { onAnyDeath(b, u, dead) {
      if (dead.side === u.side || (u.mem.clvCompost || 0) > b.t) return;
      u.mem.clvCompost = b.t + 1;
      for (const p of summonsOf(b, u)) p.mem.cropT = 0;
    } } }),
    mj('clover', 'awaken', '드론 각성', '농업 드론이 농작물을 던질 때마다 가장 가까운 적에게도 수확물을 던져 드론 기술 위력 200% 물리 피해 + 연소 2중첩.', { hooks: { onTick(b, u) {
      for (const p of b.units) {
        if (p.owner !== u || !p.alive || !p.mem.crop || p.mem.clvWake) continue; // 드론 초기화(특성) 뒤에 붙인다
        p.mem.clvWake = 1;
        p.mem.clvPrev = 1e9;
        // 농작물을 던지면 주기 타이머(cropT)가 한 주기만큼 다시 차오른다: 그 순간을 잡는다
        p.hooks.push({ onTick(bb, self) {
          const cur = self.mem.cropT ?? 0, prev = self.mem.clvPrev;
          self.mem.clvPrev = cur;
          if (cur <= prev + 1e-9) return;
          const e = bb.nearest(self, bb.targetable(self));
          if (!e) return;
          bb.emit({ k: 'atk', from: self.id, to: e.id, elem: 'phys', ranged: true });
          const r = bb.dealDamage(self, e, bb.S(self, 'tech') * 2, { elem: 'phys', tag: 'proc', kind: 'tech' });
          if (r.amount > 0 && e.alive) addBurn(bb, u, e, 2);
        } });
      }
    } } }, true),
    mj('clover', 'kiln', '소각로 가동', '3초마다 주변 3칸 안의 적 전원에게 사격 위력 100% 물리 피해 + 연소 1중첩.', { hooks: { onTick(b, u, dt) {
      if (!every(u, 'clvKiln', dt, 3, 1.5)) return;
      const es = b.around(u, 3, b.enemiesOf(u));
      if (!es.length) return;
      b.fx(u.x, u.y, 3, 'phys');
      for (const e of es) {
        const r = b.dealDamage(u, e, b.S(u, 'shoot'), { elem: 'phys', tag: 'proc', kind: 'shoot' });
        if (r.amount > 0 && e.alive) addBurn(b, u, e, 1);
      }
    } } }, true),
  ],

  // ───────────────────────── 밍키 (돌격가 · 고양이)
  mingki: [
    mj('mingki', 'punch', '냥냥 펀치', '피니쉬(6번째 타격)가 맞으면 대상을 1초 기절시킨다.', { hooks: { onBasic(b, u, t, r) {
      if (u.mem.finished && r.amount > 0 && t.alive) b.stun(u, t, 1);
    } } }),
    mj('mingki', 'tower', '캣타워', '전투 스킬을 쓴 뒤 2초간 회피 +30%p.', { hooks: { onSkill(b, u) { b.buff(u, u, 'mingki.tower', 2, { delta: { eva: 0.3 }, label: '캣타워' }); } } }),
    mj('mingki', 'claw', '발톱 갈기', '기본 공격이 맞으면 출혈 (4초, 초당 타격 위력 15%).', { hooks: { onBasic(b, u, t, r) {
      if (r.amount > 0 && t.alive) bleed(b, u, t, b.S(u, 'strike') * 0.15, 4);
    } } }),
    mj('mingki', 'groom', '그루밍', '각성 중 1초마다 최대 체력 2%를 회복하고 해로운 효과 1개를 없앤다.', { hooks: { onTick(b, u, dt) {
      if (!b.has(u, 'buff', 'mingki.monster') || !every(u, 'mkGroom', dt, 1, 1)) return;
      b.heal(u, u, b.S(u, 'maxHp') * 0.02);
      const i = u.statuses.findIndex(isHarmful);
      if (i >= 0) u.statuses.splice(i, 1);
    } } }),
    mj('mingki', 'nine', '아홉 개의 목숨', '쓰러질 피해를 받으면 전투당 2번까지 체력 30%로 버티고 1초간 무적. 그때마다 주는 피해 +30% (전투 동안), 내면의 괴물이 아직 잠들어 있으면 바로 깨어난다.', { hooks: { onLethal(b, u) {
      if ((u.mem.mkLives || 0) >= 2) return false;
      u.mem.mkLives = (u.mem.mkLives || 0) + 1;
      u.hp = b.S(u, 'maxHp') * 0.3;
      u.mem.invulnUntil = Math.max(u.mem.invulnUntil || 0, b.t + 1);
      u.mods.push(inc('all', 0.3));
      b.emit({ k: 'mark', id: u.id, name: '아홉 개의 목숨', style: 'revive' });
      if (!u.mem.monster) { u.mem.monster = 1; b.buff(u, u, 'mingki.monster', 999, monsterBuff(u)); }
      return true;
    } } }, true),
    mj('mingki', 'nebula', '성운을 먹는 고양이', '츄르 사냥 · 궁극기로 적을 쓰러뜨리면 그 적 최대 체력의 10%만큼 최대 체력이 오르고 (전투 동안, 최대 +50%), 츄르 사냥 쿨다운 50% 환급.', { hooks: {
      onStart(_b, u) { u.mem.mkBase = u.st.maxHp; },
      onDeal(b, u, t, _r, o) { if (o.tag === 'skill') { u.mem.mkEatId = t.id; u.mem.mkEatT = b.t; } },
      onKill(b, u, t) {
        if (u.mem.mkEatId !== t.id || u.mem.mkEatT !== b.t) return;
        const room = (u.mem.mkBase || u.st.maxHp) * 0.5 - (u.mem.mkGain || 0);
        const add = Math.min(room, b.S(t, 'maxHp') * 0.1);
        if (add > 0) { u.st.maxHp += add; u.hp += add; u.mem.mkGain = (u.mem.mkGain || 0) + add; }
        u.cd = Math.min(u.cd, u.cdMax * 0.5);
      },
    } }, true),
  ],
};

export const ULTS_X: Record<string, UltDef> = {
  amundsen: {
    id: 'amundsen', name: '7703 전탄 발사', charge: 1.0, line: '7703, 아직 날 수 있겠나?',
    brief: '무작위 적들에게 여러 번 포격해 주변까지 피해를 주고 느리게 만듭니다.',
    text: `무작위 적을 ${AMU.shells}회 지정해 각각 대상으로부터 [t:1] 이내의 적들에게 [pw:shoot:${AMU.mult}:phys] 피해를 가합니다.\n공격은 [s:${AMU.every}] 간격으로 이어집니다.\n이 공격은 대상의 방어도를 [p:${AMU.pen}] 무시합니다.\n이어서 [s:${AMU.slowDur}]간 대상의 공격 속도와 이동 속도를 [p:${AMU.slow}]p 줄입니다.`,
    desc: `7703이 ${AMU.every}초마다 무작위 적에게 포탄을 ${AMU.shells}발 떨어뜨린다: 포탄마다 대상과 주변 1칸 적에게 전술 위력 ${pct(AMU.mult)} 물리 피해 (방어도 관통 ${pct(AMU.pen)}) + ${AMU.slowDur}초 둔화 ${pct(AMU.slow)}.`,
    theme: { pat: 'shells', c1: '#e0b040', c2: '#1a1a22', txt: 'slide' },
    cast(b, u) {
      if (!b.targetable(u).length) return false;
      if (u.mem.amuUltCd) for (const a of b.alliesOf(u, false)) if (a.skill && a.cd > 0) a.cd *= 0.5;
      // 포탄은 부가 피해(proc): 일제 포격 등 '스킬 포격' 반응이 포탄마다 다시 터지지 않게
      pulse(u, b, u.mem.amuUltN || AMU.shells, AMU.every, (bb) => {
        const es = bb.targetable(u);
        if (!es.length) return;
        const t = bb.rng.pick(es);
        bb.fx(t.x, t.y, 1, 'phys');
        for (const e of bb.around(t, 1, bb.enemiesOf(u))) {
          bb.dealDamage(u, e, bb.P(u, 'shoot') * AMU.mult, { elem: 'phys', tag: 'proc', kind: 'shoot', canMiss: false, pen: AMU.pen });
          if (e.alive) slow(bb, u, e, AMU.slow, AMU.slowDur);
        }
      });
      return true;
    },
  },
  bjorn: {
    id: 'bjorn', name: '북해 구조 작전', charge: 1.0, line: '다친 놈 먼저! 한 명도 두고 안 간다.',
    brief: '가장 다친 아군들을 치료 · 정화하고, 아군 전체에게 보호막을 줍니다.',
    text: `체력 비율이 가장 낮은 아군 2명의 해로운 효과를 모두 제거하고, [pw:shoot:1.5]만큼 회복시킵니다.\n아군 전체에게 [pw:shoot:2]만큼 보호막을 부여합니다.\n[s:5]간 아군 전체가 받는 피해를 [p:0.2] 줄입니다.`,
    desc: '체력 비율이 가장 낮은 아군 2명의 해로운 효과를 모두 없애고 사격 위력 150% 회복. 아군 전원에게 사격 위력 200% 보호막, 5초간 피해량 경감 20%.',
    theme: { pat: 'sea', c1: '#ffd84d', c2: '#14202a', txt: 'shake' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      const al = b.alliesOf(u);
      for (const a of al.slice().sort((x, y) => b.hpPct(x) - b.hpPct(y)).slice(0, 2)) { cleanse(a); b.heal(u, a, b.P(u, 'shoot') * 1.5); }
      for (const a of al) {
        b.shield(a, b.P(u, 'shoot') * 2);
        b.buff(u, a, 'bjorn.ult', 5, { taken: [red('all', 0.2)], label: '구조 작전' });
      }
      b.fx(u.x, u.y, 0, 'elec', 'heal');
      return true;
    },
  },
  winter: {
    id: 'winter', name: '격리 병동', charge: 1.0, line: '다들 움직이지 마세요. 소독 들어갑니다.',
    brief: '아군 전체를 치료 · 정화하고, 잠시 받는 피해를 줄이며 받는 회복을 늘립니다.',
    text: `아군 전체의 해로운 효과를 모두 제거하고, [pw:tech:2.5]만큼 회복시킵니다.\n[s:6]간 아군 전체가 받는 피해를 [p:0.2] 줄이고, 받는 회복량을 [p:0.3] 늘립니다.`,
    desc: '아군 전원의 해로운 효과를 모두 없애고 기술 위력 250% 회복. 6초간 아군 전원 받는 피해 -20%, 받는 회복 +30%.',
    theme: { pat: 'hex', c1: '#9ad0ff', c2: '#e8eef0', txt: 'mist' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      for (const a of b.alliesOf(u)) {
        cleanse(a);
        b.heal(u, a, b.P(u, 'tech') * 2.5);
        b.buff(u, a, 'winter.ult', 6, { taken: [red('all', 0.2)], delta: { healEff: 0.3 }, label: '격리 병동' });
      }
      b.fx(u.x, u.y, 0, 'chem', 'heal');
      return true;
    },
  },
  mao: {
    id: 'mao', name: '라스트 오더', charge: 1.0, line: '오늘 밤은 제가 사죠. 서명은 내일 받을게요.',
    brief: '아군 전체를 치료하고 잠시 강화하며, 다른 아군의 스킬을 앞당깁니다.',
    text: `아군 전체를 [pw:tech:2]만큼 회복시킵니다.\n이 회복에는 [g:cook] 배율이 적용됩니다.\n[s:8]간 아군 전체가 가하는 피해를 [p:0.4] 늘리고, 공격 속도를 [p:0.3]p 높입니다.\n다른 아군의 스킬 쿨다운을 [s:3] 줄입니다.`,
    desc: '아군 전원을 전술 위력 200% × 요리 배율 회복, 8초간 피해 +40% · 공격 속도 +30%. 다른 아군의 기술 쿨다운 즉시 -3초.',
    theme: { pat: 'haze', c1: '#ff4d9a', c2: '#1c1c24', txt: 'spark' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      for (const a of b.alliesOf(u)) {
        b.heal(u, a, b.P(u, 'tech') * 2 * cookPower(u));
        b.buff(u, a, 'mao.ult', 8, { mods: [inc('all', 0.4)], delta: { atkSpd: 0.3 }, label: '라스트 오더' });
        if (a !== u && a.skill) a.cd = Math.max(0, a.cd - 3);
      }
      b.fx(u.x, u.y, 0, 'elec', 'buff');
      return true;
    },
  },
  siu: {
    id: 'siu', name: '쏟아지는 별무리', charge: 1.0, line: '이번 장은 제가 고쳐 쓸게요.',
    brief: '모든 적에게 화학 피해를 주고, 잠시 화학 피해에 약하게 만듭니다.',
    text: `적 전체에게 [pw:tech:2.2:chem] 피해를 가합니다.\n이어서 [s:6]간 대상이 받는 [el:chem] 피해를 [p:0.2] 늘립니다.`,
    desc: '모든 적에게 기술 위력 220% 화학 피해, 맞은 적은 6초간 받는 화학 피해 +20%.',
    theme: { pat: 'vortex', c1: '#5ad08a', c2: '#0c1430', txt: 'reverse' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      u.mem.siuUlt = 1; // ★ 은하수 필사: 궁극기 피해는 [필사]를 남기지 않는다
      for (const e of es) {
        b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'chem', ranged: true });
        b.dealDamage(u, e, b.P(u, 'tech') * 2.2, { elem: 'chem', tag: 'skill', kind: 'tech', canMiss: false });
        if (e.alive) b.applyStatus(u, e, { type: 'buff', key: 'siu.ult', dur: 6, taken: [vuln('chem', 0.2)], label: '별의 눈물' });
      }
      u.mem.siuUlt = 0;
      return true;
    },
  },
  clover: {
    id: 'clover', name: '전량 소각 처분', charge: 1.0, line: '유통 체계 위반을 확인했습니다. 전량 소각합니다.',
    brief: '적이 모인 곳의 적들에게 피해를 주고 [연소]를 겁니다.',
    text: `적이 가장 많이 모인 곳의 적을 지정해 대상으로부터 [t:2] 이내의 적들에게 [pw:shoot:3:phys] 피해를 가합니다.\n공격이 적중하면 대상에게 반드시 [g:burn] 효과를 3중첩 부여합니다.\n[g:burn] 효과는 중첩당 1초마다 [pw:main:${PSI.pyro.dps}:phys] 피해를 가하며, [s:${PSI.pyro.dur}] 지속되고, 최대 ${PSI.pyro.max}회 중첩됩니다.`,
    desc: '적이 가장 많이 모인 곳 주변 2칸에 사격 위력 300% 물리 피해 + 연소 3중첩.',
    theme: { pat: 'blueprint', c1: '#9af0a0', c2: '#1a3a1a', txt: 'type' },
    cast(b, u) {
      const c = densest(b, u, 2);
      if (!c) return false;
      b.fx(c.x, c.y, 2, 'phys');
      for (const e of b.around(c, 2, b.enemiesOf(u))) {
        const r = b.dealDamage(u, e, b.P(u, 'shoot') * 3, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false });
        if (r.amount > 0 && e.alive) addBurn(b, u, e, 3);
      }
      return true;
    },
  },
  mingki: {
    id: 'mingki', name: '한밤의 우다다', charge: 1.0, line: '…냐아.',
    brief: '잠시 무작위 적들에게 여러 번 뛰어들어 피해를 주고, 그동안 받는 피해가 줄어듭니다.',
    text: `무작위 적을 6회 지정해 각각 대상에게 이동해 [pw:strike:1.4:phys] 피해를 가합니다.\n공격은 [s:0.4] 간격으로 이어집니다.\n[s:2.5]간 자신이 받는 피해를 [p:0.3] 줄입니다.`,
    desc: '0.4초마다 무작위 적에게 뛰어들어 타격 위력 140% 물리 피해 (6회). 2.5초간 받는 피해 -30%.',
    theme: { pat: 'moon', c1: '#c8b8d8', c2: '#0c0a10', txt: 'roar' },
    cast(b, u) {
      if (!b.targetable(u).length) return false;
      b.buff(u, u, 'mingki.zoom', 2.5, { taken: [red('all', 0.3)], label: '우다다' });
      pulse(u, b, 6, 0.4, (bb) => {
        const es = bb.targetable(u);
        if (!es.length) return;
        const t = bb.rng.pick(es);
        blinkTo(bb, u, t);
        bb.dealDamage(u, t, bb.P(u, 'strike') * 1.4, { elem: 'phys', tag: 'skill', kind: 'strike', canMiss: false });
      });
      return true;
    },
  },
};
