// 메이저 전용 증강 (기물별 14개 = 일반 12 + ★ 전설 2) · 궁극기가 없던 기물의 궁극기. 이 묶음이 맡은 기물만 채운다 (index.ts 가 합친다)
// 묶음 2: 케빈(falcon) · 테무르(temur) · 아르곤(argon) · 사르마(sarma) · 유피토(yupito)
import { CFG } from '../../config';
import type { Battle, CUnit, Hooks, UltDef } from '../../engine/combat';
import { inc, red, vuln, type AugDef, type Effect } from '../../engine/effects';
import type { Elem } from '../../types';
import { blinkTo, isDebuffed, lineTargets, poison, shock, slow } from '../kit';
import { setSk, uaug } from '../unitkit';

const mj = (owner: string, key: string, name: string, desc: string, effect: Effect, legend = false): AugDef =>
  ({ ...uaug(owner, `mj.${key}`, name, desc, effect), pool: 'special', ...(legend ? { legend: true } : {}) });

/** 내부 재사용 대기시간: sec 초에 1번 */
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
/** 부가 피해 (반격 · 번짐 같은 발동형) */
const proc = (b: Battle, u: CUnit, t: CUnit, amt: number, elem: Elem, kind?: 'shoot' | 'strike' | 'tech') =>
  b.dealDamage(u, t, amt, { elem, tag: 'proc', kind });
/** 기술 판정 사격 (궁극기 · 추가 작살 등): 명중 판정 있음 */
const shot = (b: Battle, u: CUnit, t: CUnit, mult: number, elem: Elem, o: { pen?: number; noMiss?: boolean } = {}) => {
  b.emit({ k: 'atk', from: u.id, to: t.id, elem, ranged: true });
  return b.dealDamage(u, t, b.S(u, 'shoot') * mult, { elem, tag: 'skill', kind: 'shoot', canMiss: !o.noMiss, pen: o.pen });
};
const wmult = (u: CUnit) => u.weapon?.mult || 1;

/** 전투 기술 시전을 감싼다 (setup 에서): 성공하면 after (이번 시전 중 처치 수) */
function wrapSkill(u: CUnit, after: (b: Battle, self: CUnit, kills: number) => void) {
  const base = u.skill;
  if (!base) return;
  u.skill = { ...base, cast(b, self) {
    const k0 = self.counters.kills;
    const ok = base.cast(b, self);
    if (ok) after(b, self, self.counters.kills - k0);
    return ok;
  } };
}
/** 궁극기 시전을 감싼다 (궁극기는 setup 뒤에 붙으므로 전투 시작 때). before = 시전 직전, after = 성공 직후 (t = 시전 때 대상) */
function onUlt(key: string, after: ((b: Battle, u: CUnit, t: CUnit | null) => void) | null, before?: (b: Battle, u: CUnit) => void): Hooks {
  return { onStart(_b, u) {
    const o = u.ult;
    if (!o || u.mem[key]) return;
    u.mem[key] = 1;
    const w: UltDef = { ...o, cast(b, self) {
      if (!b.enemiesOf(self).length) return o.cast(b, self);
      const t = self.target?.alive ? self.target : b.nearest(self, b.enemiesOf(self));
      before?.(b, self);
      const ok = o.cast(b, self);
      if (ok) after?.(b, self, t);
      return ok;
    } };
    u.ult = w;
  } };
}
/** 전투 기술 · 궁극기 판정 피해가 맞았을 때 (기본 공격 · 지속 피해 · 발동 피해 제외) */
const onSkillHit = (elem: Elem | null, fn: (b: Battle, u: CUnit, t: CUnit) => void): Hooks => ({
  onDeal(b, u, t, r, o) { if (o.tag === 'skill' && (!elem || o.elem === elem) && r.amount > 0 && t.alive) fn(b, u, t); },
});
/** 보유 크레딧 비례 보정 (전투 시작 때 기준) */
const creditBonus = (credits: number, per: number, cap: number) => Math.min(cap, Math.floor(Math.max(0, credits) / 10) * per);

// ───────────────────────── 케빈 (falcon): 레일건 · 관통 시험
const falcon: AugDef[] = [
  mj('falcon', 'coil', '과충전 코일', '레일건 피해 계수 ×1.3, 쿨다운 +1.5초.', setSk((s, u) => { s.mult *= 1.3; u.cdMax += 1.5; })),
  mj('falcon', 'tungsten', '텅스텐 탄심', '레일건 방어도 관통 +30%p, 치명타 확률 +20%p.', setSk((s) => { s.pen = Math.min(1, (s.pen || 0) + 0.3); s.crit = (s.crit || 0) + 0.2; })),
  mj('falcon', 'leak', '전자기 누설', '레일건에 맞은 적은 60% 확률로 2초 감전.', setSk((s) => { s.shock = Math.min(1, (s.shock || 0) + 0.6); })),
  mj('falcon', 'pierce', '관통 효율 개선', '[관통 시험] 직선 위 다른 적이 받는 피해 50% → 80% (기본 공격 피해 기준).', { hooks: { onBasic(b, u, t) {
    for (const e of lineTargets(b, u, t)) if (e !== t && e.alive) proc(b, u, e, b.S(u, 'shoot') * wmult(u) * 0.3, 'phys', 'shoot');
  } } }),
  mj('falcon', 'mag', '확장 탄창', '탄창 +2발 (3 → 5).', { setup: (u) => { if (u.weapon) u.weapon.mag = (u.weapon.mag || 1) + 2; } }),
  mj('falcon', 'cool', '냉각 순환', '재장전을 시작할 때마다 레일건 쿨다운 -1.5초.', { hooks: { onTick(_b, u) {
    if (u.reloadT > 0) { if (!u.mem.mjFcool) { u.mem.mjFcool = 1; u.cd = Math.max(0, u.cd - 1.5); } } else u.mem.mjFcool = 0;
  } } }),
  mj('falcon', 'safety', '사고 대비 수칙', '궁극기를 쓰기 직전 최대 체력 15% 보호막. 궁극기 충전 효율 +15%.', {
    stats: { ultCharge: 0.15 },
    hooks: onUlt('mjFsafe', null, (b, u) => b.shield(u, b.S(u, 'maxHp') * 0.15)),
  }),
  mj('falcon', 'prey', '사냥감 표시', '레일건 · 궁극기에 맞은 적은 5초간 받는 사격 피해 +15%.', { hooks: onSkillHit(null, (b, u, t) => {
    b.applyStatus(u, t, { type: 'buff', key: 'falcon.prey', dur: 5, taken: [vuln('shoot', 0.15)], label: '사냥감' });
  }) }),
  mj('falcon', 'scope', '정밀 조준경', '사거리 +1, 명중 +15%p.', { stats: { range: 1, acc: 0.15 } }),
  mj('falcon', 'warranty', '시제품 보증서', '보유 크레딧 10당 전투 기술 · 궁극기 피해 +4% (최대 +40%, 전투 시작 때 기준).', { setup: (u, _b, ctx) => {
    const v = creditBonus(ctx.credits, 0.04, 0.4);
    if (v > 0) u.mods.push(inc('skill', v));
  } }),
  mj('falcon', 'chain', '연쇄 방전', '레일건으로 적을 쓰러뜨리면 그 레일건 쿨다운이 40% 줄어든다 (시전마다 1번).', { setup: (u) => wrapSkill(u, (_b, self, kills) => {
    if (kills > 0) self.cd = Math.min(self.cd, self.cdMax * 0.6);
  }) }),
  mj('falcon', 'used', '사고에 익숙함', '최대 체력 +15%. 체력 50% 이하일 때 받는 피해 -20%.', { pct: { maxHp: 0.15 }, hooks: { takenMult: (b, u) => (b.hpPct(u) <= 0.5 ? 0.8 : 1) } }),
  mj('falcon', 'encore', '1,206회차 연속 시험', '궁극기를 쓰면 0.6초 간격으로 같은 방향 직선 위 모든 적에게 사격 위력 550% 물리 피해를 2번 더 준다 (방어도 완전 관통, 빗나가지 않음). 궁극기 충전 효율 +25%.', {
    stats: { ultCharge: 0.25 },
    hooks: onUlt('mjFenc', (b, u, t0) => {
      if (!t0) return;
      const tx = t0.x, ty = t0.y;
      for (let i = 1; i <= 2; i++) b.later(0.6 * i, () => {
        if (!u.alive) return;
        const t = t0.alive ? t0 : b.nearest(u, b.enemiesOf(u)) || null;
        const aim = t || b.unitAt(tx, ty);
        if (!aim || aim.side === u.side) return;
        b.emit({ k: 'status', id: u.id, name: '연속 시험' });
        for (const e of lineTargets(b, u, aim)) if (e.alive) shot(b, u, e, 5.5, 'phys', { pen: 1, noMiss: true });
      });
    }),
  }, true),
  mj('falcon', 'twin', '2연장 레일건', '레일건을 쏘면 0.4초 뒤 한 번 더 쏜다 (피해 계수 70%, 관통 · 치명타 · 감전 보정 그대로).', { setup: (u) => {
    const base = u.skill;
    if (!base) return;
    u.skill = { ...base, cast(b, self) {
      const ok = base.cast(b, self);
      if (ok) b.later(0.4, () => {
        if (!self.alive) return;
        const m = self.sk.mult;
        self.sk.mult = m * 0.7;
        try { base.cast(b, self); } finally { self.sk.mult = m; }
      });
      return ok;
    } };
  } }, true),
];

// ───────────────────────── 테무르 (temur): 경기장의 검 · 투사
const fighterAdd = (u: CUnit, n: number) => { u.mem.fighter = Math.min(100, (u.mem.fighter || 0) + n); };
const canLeap = (u: CUnit) => !u.immobile && !u.statuses.some((s) => s.key === 'root');
const temur: AugDef[] = [
  mj('temur', 'whirl', '대검 회전', '경기장의 검 범위 1칸 → 2칸, 피해 계수 ×0.85.', setSk((s) => { s.radius = 2; s.mult *= 0.85; })),
  mj('temur', 'stomp', '짓밟기', '경기장의 검 기절 +0.6초.', setSk((s) => { s.stun = (s.stun || 0) + 0.6; })),
  mj('temur', 'warm', '몸풀기', '전투 시작 시 [투사] 15중첩 (타격 피해 +30%p).', { hooks: { onStart(_b, u) { u.mem.fighter = Math.max(u.mem.fighter || 0, 15); } } }),
  mj('temur', 'blood', '피맛', '전투 기술 · 궁극기로 준 피해의 12%만큼 체력 회복.', { hooks: { onDeal(b, u, _t, r, o) {
    if (o.tag === 'skill' && r.amount > 0 && u.alive) b.heal(u, u, r.amount * 0.12);
  } } }),
  mj('temur', 'cleave', '마무리 휘두르기', '콤보 피니쉬가 대상 주변 1칸의 다른 적에게도 피니쉬 피해 50%.', { hooks: { onBasic(b, u, t) {
    if (!u.mem.finished) return;
    for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) proc(b, u, e, b.S(u, 'strike') * wmult(u) * CFG.finishMult * 0.5, 'phys', 'strike');
  } } }),
  mj('temur', 'roar', '경기장의 함성', '경기장의 검에 맞은 적을 도발 (1.5초간 테무르를 노림). 시전 후 3초간 받는 피해 -15%.', { hooks: { onSkill(b, u) {
    for (const e of b.around(u, u.sk.radius || 1, b.enemiesOf(u))) b.provoke(e, u);
    b.buff(u, u, 'temur.roar', 3, { taken: [red('all', 0.15)], label: '함성' });
  } } }),
  mj('temur', 'hide', '단련된 맷집', '받는 피해 -10%. [투사] 50중첩 이상이면 추가로 -10%.', {
    taken: [red('all', 0.1)],
    hooks: { takenMult: (_b, u) => ((u.mem.fighter || 0) >= 50 ? 0.9 : 1) },
  }),
  mj('temur', 'meal', '알 세르 베이컨', '최대 체력 +15%, 받는 회복량 +20%p.', { pct: { maxHp: 0.15 }, stats: { healEff: 0.2 } }),
  mj('temur', 'leap', '검투사의 도약', '전투 시작 시 가장 가까운 적 곁으로 뛰어든다. 경기장의 검이 준비됐는데 주변에 적이 없으면 4칸 안의 가장 가까운 적 곁으로 뛰어들어 휘두른다.', {
    setup: (u) => {
      const base = u.skill;
      if (!base) return;
      u.skill = { ...base, cast(b, self) {
        if (!b.around(self, self.sk.radius || 1, b.enemiesOf(self)).length && canLeap(self)) {
          const es = b.targetable(self).filter((e) => b.dist(self, e) <= 4);
          const t = es.length ? b.nearest(self, es) : null;
          if (t) blinkTo(b, self, t);
        }
        return base.cast(b, self);
      } };
    },
    hooks: { onTick(b, u) { // 모든 전투 시작 처리(침투자 순간이동 등) 뒤 첫 틱
      if (u.mem.mjTleap) return;
      u.mem.mjTleap = 1;
      const t = canLeap(u) ? b.nearest(u, b.targetable(u)) : null;
      if (t && b.dist(u, t) > 1) blinkTo(b, u, t);
    } },
  }),
  mj('temur', 'pay', '주인님의 돈값', '보유 크레딧 10당 타격 피해 +3% (최대 +30%, 전투 시작 때 기준).', { setup: (u, _b, ctx) => {
    const v = creditBonus(ctx.credits, 0.03, 0.3);
    if (v > 0) u.mods.push(inc('strike', v));
  } }),
  mj('temur', 'quick', '빠른 손놀림', '콤보 3타 → 2타 (2타째가 피니쉬).', { setup: (u) => { if (u.weapon?.kind === 'combo') u.weapon.combo = 2; } }),
  mj('temur', 'grit', '투지', '피해를 받을 때 [투사]가 1중첩 더 쌓인다.', { hooks: { onHurt(_b, u, _s, r) { if (r.amount > 0) fighterAdd(u, 1); } } }),
  mj('temur', 'champ', '불패의 챔피언', '전투당 1번, 쓰러질 피해를 받으면 최대 체력 30%로 버티고 2초 무적, 궁극기 게이지가 가득 찬다.', { hooks: { onLethal(b, u) {
    if (u.mem.mjTchamp) return false;
    u.mem.mjTchamp = 1;
    u.hp = b.S(u, 'maxHp') * 0.3;
    u.mem.invulnUntil = Math.max(u.mem.invulnUntil || 0, b.t + 2);
    if (u.ult) u.ultG = 1;
    b.emit({ k: 'mark', id: u.id, name: '불패의 챔피언', style: 'revive' });
    return true;
  } } }, true),
  mj('temur', 'colosseum', '콜로세움의 주인', '피해를 받으면 주변 1칸 모든 적에게 타격 위력 60% 물리 반격 (0.5초에 1번). [투사] 1중첩당 받는 피해 -0.2% (최대 -20%).', { hooks: {
    onHurt(b, u, _s, r, o) {
      if (r.amount <= 0 || o.tag === 'dot' || !u.alive || !icd(b, u, 'mjTcol', 0.5)) return;
      const es = b.around(u, 1, b.enemiesOf(u));
      if (es.length) b.fx(u.x, u.y, 1, 'phys');
      for (const e of es) if (e.alive) proc(b, u, e, b.S(u, 'strike') * 0.6, 'phys', 'strike');
    },
    takenMult: (_b, u) => 1 - Math.min(0.2, 0.002 * (u.mem.fighter || 0)),
  } }, true),
];

// ───────────────────────── 아르곤 (argon): 망령권 작살 · 망자의 뱃사공
const ARGON_MARK = (b: Battle, u: CUnit, t: CUnit) =>
  b.applyStatus(u, t, { type: 'buff', key: 'argon.mark', dur: 4, taken: [vuln('all', 0.15)], label: '망자의 표식' });
/** 무작위 적에게 작살 1발 (사격 위력 mult 화학) + 망자의 표식 */
const harpoon = (b: Battle, u: CUnit, mult: number) => {
  if (!u.alive) return;
  const es = b.enemiesOf(u);
  if (!es.length) return;
  const t = b.rng.pick(es);
  const r = shot(b, u, t, mult, 'chem');
  if (r.amount > 0 && t.alive) ARGON_MARK(b, u, t);
};
const argon: AugDef[] = [
  mj('argon', 'more', '작살 추가 장전', '망령권 작살 +2발 (6 → 8).', setSk((s) => { s.shots += 2; })),
  mj('argon', 'lamp', '망자의 등불', '작살(전투 기술 · 궁극기)에 맞은 적은 4초간 [등불]: 받는 피해 +10%.', { hooks: onSkillHit('chem', (b, u, t) => {
    b.applyStatus(u, t, { type: 'buff', key: 'argon.lamp', dur: 4, taken: [vuln('all', 0.1)], label: '등불' });
  }) }),
  mj('argon', 'venom', '독 작살촉', '작살(전투 기술 · 궁극기)에 맞은 적은 4초간 초당 사격 위력 15% 화학 중독.', { hooks: onSkillHit('chem', (b, u, t) => {
    poison(b, u, t, b.S(u, 'shoot') * 0.15, 4, 1);
  }) }),
  mj('argon', 'count', '승객 명부', '전투 시작 시 적 1명당 피해 +3% (최대 +30%).', { hooks: { onStart(b, u) {
    const v = Math.min(0.3, 0.03 * b.enemiesOf(u).length);
    if (v > 0) u.mods.push(inc('all', v));
  } } }),
  mj('argon', 'slow', '느린 항해', '공격 속도 -15%, 기본 공격 피해 +35%, 명중 +20%p.', { stats: { atkSpd: -0.15, acc: 0.2 }, mods: [inc('basic', 0.35)] }),
  mj('argon', 'bare', '축복 없는 몸', '효과 저항 +30%p. 해로운 상태이상에 걸려 있는 동안 받는 피해 -15%.', {
    stats: { effRes: 0.3 },
    hooks: { takenMult: (_b, u) => (isDebuffed(u) ? 0.85 : 1) },
  }),
  mj('argon', 'mag', '이중 탄창', '탄창 +1발 (2 → 3).', { setup: (u) => { if (u.weapon) u.weapon.mag = (u.weapon.mag || 1) + 1; } }),
  mj('argon', 'guide', '도선 안내', '전투 시작 시 다른 아군 전원 8초간 피해 +12%.', { hooks: { onStart(b, u) {
    for (const a of b.alliesOf(u, false)) b.buff(u, a, 'argon.guide', 8, { mods: [inc('all', 0.12)], label: '도선 안내' });
  } } }),
  mj('argon', 'retrieve', '작살 회수', '망령권 작살을 쓰면 탄창이 바로 가득 차고, 다음 기본 공격 3발의 피해 +40%.', {
    setup: (u) => wrapSkill(u, (_b, self) => {
      if (self.weapon?.kind === 'mag') { self.ammo = self.weapon.mag || 1; self.reloadT = 0; }
      self.mem.mjAret = 3;
    }),
    hooks: {
      dmgMult: (_b, u, _t, o) => (o.tag === 'basic' && (u.mem.mjAret || 0) > 0 ? 1.4 : 1),
      onBasic(_b, u) { if ((u.mem.mjAret || 0) > 0) u.mem.mjAret--; },
    },
  }),
  mj('argon', 'fare', '하데스의 뱃삯', '누구든 쓰러질 때마다 4초간 공격 속도 +25%.', { hooks: { onAnyDeath(b, u) {
    if (u.alive) b.buff(u, u, 'argon.fare', 4, { delta: { atkSpd: 0.25 }, label: '뱃삯' });
  } } }),
  mj('argon', 'steel', '강철 작살', '망령권 작살 피해 계수 ×1.3.', setSk((s) => { s.mult *= 1.3; })),
  mj('argon', 'net', '망자의 그물', '작살(전투 기술 · 궁극기)에 맞은 적은 2초간 둔화 20%.', { hooks: onSkillHit('chem', (b, u, t) => { slow(b, u, t, 0.2, 2); }) }),
  mj('argon', 'endless', '끝나지 않는 항로', '궁극기 작살 +8발 (12 → 20발, 맞은 적에게 같은 망자의 표식). 전투 시작 시 궁극기 게이지 +30%.', {
    setup: (u) => { u.mem.ultStart = (u.mem.ultStart || 0) + 0.3; },
    hooks: onUlt('mjAend', (b, u) => {
      for (let i = 1; i <= 8; i++) b.later(1.5 + 0.125 * i, () => harpoon(b, u, 0.9));
    }),
  }, true),
  mj('argon', 'ferry', '저승 도선사', '작살(전투 기술 · 궁극기)에 맞은 적에게 [망자의 표식] (4초간 받는 피해 +15%). [망자의 표식] · [등불]이 걸린 적이 쓰러지면 작살 3발이 무작위 적에게 날아간다 (사격 위력 60% 화학, 맞으면 망자의 표식).', { hooks: {
    ...onSkillHit('chem', ARGON_MARK),
    onAnyDeath(b, u, dead) {
      if (!u.alive || dead.side === u.side || !dead.statuses.some((s) => s.key === 'argon.mark' || s.key === 'argon.lamp')) return;
      for (let i = 1; i <= 3; i++) b.later(0.1 * i, () => harpoon(b, u, 0.6));
    },
  } }, true),
];

// ───────────────────────── 사르마 (sarma): 포켓 블랙홀 · 차원 융합
/** 블랙홀 중심: 포켓 블랙홀은 지금 대상 자리에 열린다 (전투 기술은 대상이 있을 때만 시전된다) */
const holeCenter = (b: Battle, u: CUnit) => (u.target?.alive ? u.target : b.nearest(u, b.targetable(u)));
function wrapHole(u: CUnit, after: (b: Battle, self: CUnit, c: { x: number; y: number }) => void) {
  const base = u.skill;
  if (!base) return;
  u.skill = { ...base, cast(b, self) {
    const t = holeCenter(b, self);
    const c = t ? { x: t.x, y: t.y } : null;
    const ok = base.cast(b, self);
    if (ok && c) after(b, self, c);
    return ok;
  } };
}
const sarma: AugDef[] = [
  mj('sarma', 'dense', '고밀도 특이점', '포켓 블랙홀 피해 계수 ×1.3, 쿨다운 +2초.', setSk((s, u) => { s.mult *= 1.3; u.cdMax += 2; })),
  mj('sarma', 'horizon', '사건의 경계', '포켓 블랙홀에 맞은 적은 4초간 받는 피해 +15%.', setSk((s) => { s.vuln = (s.vuln || 0) + 0.15; })),
  mj('sarma', 'stop', '시간 정지', '포켓 블랙홀에 맞은 적 1초 기절.', setSk((s) => { s.stun = (s.stun || 0) + 1; })),
  mj('sarma', 'lens', '중력 렌즈', '포켓 블랙홀 방어도 관통 +40%p.', setSk((s) => { s.pen = Math.min(1, (s.pen || 0) + 0.4); })),
  mj('sarma', 'fusion', '차원 융합 확장', '[차원 융합] 주변 1칸으로 번지는 피해 30% → 50% (기본 공격 피해 기준).', { hooks: { onBasic(b, u, t) {
    for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t && e.alive) proc(b, u, e, b.S(u, 'shoot') * wmult(u) * 0.2, 'phys', 'shoot');
  } } }),
  mj('sarma', 'gap', '시간의 틈', '공격을 회피하면 포켓 블랙홀 쿨다운 -1초 (1초에 1번).', { hooks: { onEvade(b, u) {
    if (icd(b, u, 'mjSgap', 1)) u.cd = Math.max(0, u.cd - 1);
  } } }),
  mj('sarma', 'textbook', '미래 교과서', '포켓 블랙홀 쿨다운 -2초.', setSk((_s, u) => { u.cdMax -= 2; })),
  mj('sarma', 'cell', '융합 전지 증설', '탄창 +2발 (4 → 6), 재장전 시간 +0.5초.', { setup: (u) => {
    if (u.weapon?.kind !== 'mag') return;
    u.weapon.mag = (u.weapon.mag || 1) + 2;
    u.weapon.reload = (u.weapon.reload || 1.5) + 0.5;
  } }),
  mj('sarma', 'sorry', '아, 실례했어요', '체력이 처음 40% 아래로 떨어지면 2초 무적 + 최대 체력 15% 보호막 (전투당 1번).', { hooks: { onHurt(b, u) {
    if (u.mem.mjSsorry || u.hp <= 0 || b.hpPct(u) >= 0.4) return;
    u.mem.mjSsorry = 1;
    u.mem.invulnUntil = Math.max(u.mem.invulnUntil || 0, b.t + 2);
    b.shield(u, b.S(u, 'maxHp') * 0.15);
    b.emit({ k: 'status', id: u.id, name: '실례했어요' });
  } } }),
  mj('sarma', 'collapse', '중력 붕괴', '포켓 블랙홀이 범위 안의 적을 중심 쪽으로 1칸 끌어당긴다 (보스 · 고정 기물 제외).', { setup: (u) => wrapHole(u, (b, self, c) => {
    const vs = b.around(c, self.sk.radius || 1, b.enemiesOf(self)).sort((a, z) => b.dist(a, c) - b.dist(z, c));
    for (const e of vs) {
      if (b.unmovable(e) || (e.x === c.x && e.y === c.y)) continue;
      b.relocate(self, e, e.x + Math.sign(c.x - e.x), e.y + Math.sign(c.y - e.y), 'pull');
    }
  }) }),
  mj('sarma', 'residue', '잔류 중력장', '포켓 블랙홀 자리에 3초간 중력장: 매초 주변 2칸 적에게 사격 위력 30% 물리 피해.', { setup: (u) => wrapHole(u, (b, self, c) => {
    for (let i = 1; i <= 3; i++) b.later(i, () => {
      if (!self.alive) return;
      const vs = b.around(c, 2, b.enemiesOf(self));
      if (!vs.length) return;
      b.fx(c.x, c.y, 2, 'psy');
      for (const e of vs) if (e.alive) b.dealDamage(self, e, b.S(self, 'shoot') * 0.3, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false });
    });
  }) }),
  mj('sarma', 'next', '다음 은하로', '궁극기 충전 효율 +20%. 포켓 블랙홀을 쓸 때마다 궁극기 게이지 +5%.', { stats: { ultCharge: 0.2 }, hooks: { onSkill(_b, u) {
    if (u.ult && (u.ultG || 0) < 1) u.ultG = Math.min(1, (u.ultG || 0) + 0.05);
  } } }),
  mj('sarma', 'echo', '블랙홀 메아리', '포켓 블랙홀을 쓰면 3초 뒤 같은 자리에 메아리 블랙홀이 열린다 (피해 계수 70%, 둔화 · 기절 · 받는 피해 증가 · 방어도 관통 그대로).', { setup: (u) => wrapHole(u, (b, self, c) => {
    b.later(3, () => {
      if (!self.alive) return;
      const p = self.sk;
      const vs = b.around(c, p.radius || 1, b.enemiesOf(self));
      if (!vs.length) return;
      b.fx(c.x, c.y, p.radius || 1, 'psy');
      b.emit({ k: 'status', id: self.id, name: '메아리' });
      for (const e of vs) {
        if (!e.alive) continue;
        b.dealDamage(self, e, b.P(self, 'shoot') * p.mult * 0.7, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: !p.noMiss, critBonus: p.crit, pen: p.pen });
        if (!e.alive) continue;
        if (p.slow) slow(b, self, e, p.slow, 3);
        if (p.stun) b.stun(self, e, p.stun, p.stunChance || 1);
        if (p.vuln) b.applyStatus(self, e, { type: 'buff', key: `vuln.${self.defId}`, dur: p.vulnDur || 4, taken: [vuln('all', p.vuln)], label: '취약' });
      }
    });
  }) }, true),
  mj('sarma', 'rewind', '시간 되감기', '전투당 1번, 쓰러질 피해를 받으면 5초 전의 체력으로 되돌아간다 (최소 최대 체력 30%). 포켓 블랙홀 쿨다운 초기화.', { hooks: {
    onTick(_b, u, dt) {
      u.mem.mjSrwT = (u.mem.mjSrwT ?? 1) + dt;
      if (u.mem.mjSrwT < 1) return;
      u.mem.mjSrwT -= 1;
      for (let i = 4; i > 0; i--) u.mem[`mjSrw${i}`] = u.mem[`mjSrw${i - 1}`] ?? u.hp;
      u.mem.mjSrw0 = u.hp;
    },
    onLethal(b, u) {
      if (u.mem.mjSrew) return false;
      u.mem.mjSrew = 1;
      const max = b.S(u, 'maxHp');
      const past = u.mem.mjSrw4 ?? u.mem.mjSrw3 ?? u.mem.mjSrw2 ?? u.mem.mjSrw1 ?? u.mem.mjSrw0 ?? max;
      u.hp = Math.min(max, Math.max(max * 0.3, past));
      u.cd = 0;
      b.emit({ k: 'mark', id: u.id, name: '시간 되감기', style: 'rewind' });
      return true;
    },
  } }, true),
];

// ───────────────────────── 유피토 (yupito): 임시 에너지 장벽 · 강철의 마녀
const GEAR = 'yupito.gear';
const panEng = (a: CUnit) => a.synergies.has('PAN') || a.synergies.has('ENG');
const hasSt = (a: CUnit, key: string) => a.statuses.some((s) => s.key === key);
const yupito: AugDef[] = [
  mj('yupito', 'amp', '장벽 증폭', '임시 에너지 장벽 보호막 ×1.3 (포탑 보호막 포함).', setSk((s) => { s.shield *= 1.3; s.turretShield *= 1.3; })),
  mj('yupito', 'plate', '강화 장갑판', '임시 에너지 장벽을 받은 아군은 4초간 방어도 +20.', setSk((s) => { s.armor = (s.armor || 0) + 20; s.dur = 4; })),
  mj('yupito', 'wide', '광역 장벽', '임시 에너지 장벽 범위 1칸 → 2칸, 보호막 ×0.8 (포탑 보호막 제외).', setSk((s) => { s.radius = 2; s.shield *= 0.8; })),
  mj('yupito', 'gear2', '특제 장비 2호', '[강철의 마녀] 특제 장비를 아군 1명에게 더 준다 (아직 없는 아군 중 무작위, 같은 효과).', { hooks: { onStart(b, u) {
    const as = b.alliesOf(u).filter((a) => !a.isSummon && !hasSt(a, GEAR));
    if (!as.length) return;
    const a = b.rng.pick(as);
    const k = panEng(a) ? 2 : 1;
    b.buff(u, a, GEAR, 999, { mods: [inc('all', 0.2 * k)], delta: { armor: 15 * k }, label: '특제 장비' });
  } } }),
  mj('yupito', 'tune', '맞춤 정비', '[강철의 마녀] 특제 장비를 받은 아군은 공격 속도 +20%, 받는 피해 -10%.', { hooks: { onTick(b, u) {
    if (u.mem.mjYtune) return; // 특제 장비 2호까지 나눠 준 뒤 (첫 틱)
    u.mem.mjYtune = 1;
    for (const a of b.alliesOf(u)) if (hasSt(a, GEAR)) b.buff(u, a, 'yupito.tune', 999, { delta: { atkSpd: 0.2 }, taken: [red('all', 0.1)], label: '맞춤 정비' });
  } } }),
  mj('yupito', 'scrap', '고철 재활용', '적이 쓰러질 때마다 체력 비율이 가장 낮은 아군에게 기술 위력 40% 보호막 (1초에 1번).', { hooks: { onAnyDeath(b, u, dead) {
    if (!u.alive || dead.side === u.side || !icd(b, u, 'mjYscrap', 1)) return;
    const t = b.lowestHpAlly(u);
    if (t) b.shield(t, b.P(u, 'tech') * 0.4);
  } } }),
  mj('yupito', 'arc', '아크 용접', '기본 공격이 맞으면 15% 확률로 1초 감전 (2초에 1번).', { hooks: { onBasic(b, u, t, r) {
    if (r.amount > 0 && t.alive && (u.mem.mjYarc || 0) <= b.t && b.rng.chance(0.15)) { u.mem.mjYarc = b.t + 2; shock(b, u, t, 1, 1); }
  } } }),
  mj('yupito', 'turret', '포탑 개조', '엔지니어 포탑 최대 체력 · 방어도 +30%, 공격 속도 +20%.', { setup: (u) => {
    u.mem.turretHp = (u.mem.turretHp || 0) + 0.3;
    u.mem.turretAs = (u.mem.turretAs || 0) + 0.2;
  } }),
  mj('yupito', 'backup', '비상 전력', '자신의 체력이 처음 50% 아래로 떨어지면 아군 전원에게 기술 위력 80% 보호막.', { hooks: { onHurt(b, u) {
    if (u.mem.mjYback || u.hp <= 0 || b.hpPct(u) >= 0.5) return;
    u.mem.mjYback = 1;
    for (const a of b.alliesOf(u)) b.shield(a, b.P(u, 'tech') * 0.8);
  } } }),
  mj('yupito', 'wrench', '콩이야, 렌치!', '임시 에너지 장벽 쿨다운 -1.5초.', setSk((_s, u) => { u.cdMax -= 1.5; })),
  mj('yupito', 'filter', '정화 필터', '임시 에너지 장벽을 받은 아군의 해로운 상태이상을 모두 지운다.', setSk((s) => { s.cleanse = 1; })),
  mj('yupito', 'trick', '한 수 더', '궁극기를 쓰면 8초간 아군 전원 피해 +12%. 궁극기 충전 효율 +15%.', {
    stats: { ultCharge: 0.15 },
    hooks: onUlt('mjYtrick', (b, u) => { for (const a of b.alliesOf(u)) b.buff(u, a, 'yupito.trick', 8, { mods: [inc('all', 0.12)], label: '한 수 더' }); }),
  }),
  mj('yupito', 'last', '마지막 한 수', '전투당 2번, 아군(소환물 제외)이 쓰러질 피해를 받으면 장비가 대신 터져 체력 1로 버티고 1초 무적 + 기술 위력 200% 보호막.', { hooks: { onStart(b, u) {
    for (const a of b.alliesOf(u)) {
      if (a.isSummon) continue;
      a.hooks.push({ onLethal(bb, self) {
        if ((u.mem.mjYlast || 0) >= 2) return false;
        u.mem.mjYlast = (u.mem.mjYlast || 0) + 1;
        self.hp = 1;
        self.mem.invulnUntil = Math.max(self.mem.invulnUntil || 0, bb.t + 1);
        bb.shield(self, bb.P(u, 'tech') * 2);
        bb.emit({ k: 'mark', id: self.id, name: '마지막 한 수', style: 'immortal' });
        return true;
      } });
    }
    void b;
  } } }, true),
  mj('yupito', 'workshop', '강철의 마녀 공방', '특제 장비가 없는 아군 전원(소환물 제외)에게 보급형 특제 장비: 피해 +12%, 방어도 +9 (공동체 · 엔지니어 아군이면 2배).', { hooks: { onTick(b, u) {
    if (u.mem.mjYshop) return;
    u.mem.mjYshop = 1;
    for (const a of b.alliesOf(u)) {
      if (a.isSummon || hasSt(a, GEAR)) continue;
      const k = panEng(a) ? 2 : 1;
      b.buff(u, a, 'yupito.lite', 999, { mods: [inc('all', 0.12 * k)], delta: { armor: 9 * k }, label: '보급형 특제 장비' });
    }
  } } }, true),
];

export const AUGS: Record<string, AugDef[]> = { falcon, temur, argon, sarma, yupito };
export const ULTS_X: Record<string, UltDef> = {};
