// 메이저 전용 증강 (기물별 14개 = 일반 12 + ★ 전설 2) · 궁극기가 없던 기물의 궁극기. 이 묶음이 맡은 기물만 채운다 (index.ts 가 합친다)
// 1묶음: 미리내 · 게베크 · 린디웨 · 프란체 · 그렌홀름
import type { Battle, CUnit, DmgOpts, Hooks, Status, UltDef } from '../../engine/combat';
import { type AugDef, type Effect, inc, red, vuln } from '../../engine/effects';
import { blinkTo, every } from '../kit';
import { setSk, uaug } from '../unitkit';

const mj = (owner: string, key: string, name: string, desc: string, effect: Effect, legend = false): AugDef =>
  ({ ...uaug(owner, `mj.${key}`, name, desc, effect), pool: 'special', ...(legend ? { legend: true } : {}) });

// ───────── 공용 헬퍼 (상태는 모두 u.mem 에 둔다: 효과 객체는 기물끼리 공유된다)
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
const maxHp = (b: Battle, u: CUnit) => b.S(u, 'maxHp');
const hasSt = (u: CUnit, key: string) => u.statuses.some((s) => s.key === key);
/** 궁극기 게이지 직접 가산 (상한 1). 궁극기 시전 중에는 시전 직후 0으로 돌아가므로 ultLater 를 쓴다 */
const ultAdd = (u: CUnit, v: number) => { if (u.ult) u.ultG = Math.min(1, (u.ultG || 0) + v); };
/** 궁극기 시전 중에 생긴 게이지 보상: 다음 틱에 더한다 (onTick 에서 ultFlush) */
const ultLater = (u: CUnit, v: number) => { u.mem.mjUltLater = (u.mem.mjUltLater || 0) + v; };
const ultFlush = (u: CUnit) => { if (u.mem.mjUltLater) { ultAdd(u, u.mem.mjUltLater); u.mem.mjUltLater = 0; } };

/** 전투 스킬 시전 중 표시: 스킬 피해(tag 'skill')를 궁극기 피해와 가른다. setup 에서 부른다 (여러 증강이 불러도 한 번만 감싼다) */
function markCast(u: CUnit) {
  if (u.mem.mjCastWrap || !u.skill) return;
  u.mem.mjCastWrap = 1;
  const base = u.skill;
  u.skill = { ...base, cast(b, self) {
    self.mem.mjCast = (self.mem.mjCast || 0) + 1;
    try { return base.cast(b, self); } finally { self.mem.mjCast--; }
  } };
}
/** 지금 이 피해가 전투 스킬의 피해인지 */
const bySkill = (u: CUnit, o: DmgOpts) => o.tag === 'skill' && (u.mem.mjCast || 0) > 0;

/** 궁극기 감싸기 (전투 시작 때 한 번, 증강마다 key 로 구분). 감싼 시전 동안 u.mem.mjUltOn > 0 */
const ultWrap = (key: string, cast: (b: Battle, u: CUnit, base: UltDef['cast']) => boolean): Hooks => ({
  onStart(_b, u) {
    if (!u.ult || u.mem[key]) return;
    u.mem[key] = 1;
    const base = u.ult.cast;
    u.ult = { ...u.ult, cast: (b, self) => {
      self.mem.mjUltOn = (self.mem.mjUltOn || 0) + 1;
      try { return cast(b, self, base); } finally { self.mem.mjUltOn--; }
    } };
  },
});
/** 여러 Hooks 를 하나로 (같은 이름의 훅은 차례로 부른다, 반환값이 있는 훅은 곱하거나 첫 true) */
function joinHooks(...hs: Hooks[]): Hooks {
  const out: Hooks = {};
  const keys = new Set(hs.flatMap((h) => Object.keys(h) as (keyof Hooks)[]));
  for (const k of keys) {
    const fs = hs.map((h) => h[k]).filter(Boolean) as ((...a: unknown[]) => unknown)[];
    if (fs.length === 1) { (out as Record<string, unknown>)[k] = fs[0]; continue; }
    if (k === 'dmgMult' || k === 'takenMult' || k === 'healMult') (out as Record<string, unknown>)[k] = (...a: unknown[]) => fs.reduce((m, f) => m * (f(...a) as number), 1);
    else if (k === 'onLethal') (out as Record<string, unknown>)[k] = (...a: unknown[]) => fs.some((f) => f(...a));
    else if (k === 'redirect') (out as Record<string, unknown>)[k] = (b: unknown, s: unknown, src: unknown, dmg: number, o: unknown) => fs.reduce((d, f) => f(b, s, src, d, o) as number, dmg);
    else (out as Record<string, unknown>)[k] = (...a: unknown[]) => { for (const f of fs) f(...a); };
  }
  return out;
}

// ═══════════════════════════ 미리내: 깜찍이 (핸드캐논) · 물질주의 캠퍼 · 신기루 종막
/** 물질주의 캠퍼와 같은 장비 개수 */
const gearCount = (u: CUnit) => (u.src?.items.filter(Boolean).length || 0) + (u.src?.mod ? 1 : 0) + (u.tempItems?.length || 0);
/** 신기루 종막과 같은 대상 규칙: 체력이 가장 높은 적 */
const highestHp = (es: CUnit[]) => (es.length ? es.reduce((a, c) => (c.hp > a.hp ? c : a)) : null);

const MIRINAE: AugDef[] = [
  mj('mirinae', 'ap', '철갑 에너지 셀', '흉악한 한 발 방어도 관통 +40%.', setSk((s) => { s.pen = (s.pen || 0) + 0.4; })),
  mj('mirinae', 'oneshot', '한 발 원칙', '흉악한 한 발로 적을 쓰러뜨리면 흉악한 한 발 쿨다운의 60%를 바로 돌려받는다.',
    setSk((s) => { s.resetOnKill = Math.max(s.resetOnKill || 0, 0.6); })),
  mj('mirinae', 'double', '2발째', '흉악한 한 발을 2번 쏜다 (2번째 피해 50%). 흉악한 한 발 쿨다운 +1.5초.', { setup: (u) => {
    u.sk.hits = Math.max(2, u.sk.hits || 1); u.sk.second = 0.5; u.cdMax += 1.5;
  } }),
  mj('mirinae', 'camper', '캠핑 장비 풀세트', '물질주의 캠퍼: 장비 1개당 회피 · 치명타 확률 +2.5%p → +4%p, 상한 15%p → 24%p.', { hooks: { onStart(_b, u) {
    const n = gearCount(u);
    const extra = Math.min(0.24, 0.04 * n) - Math.min(0.15, 0.025 * n);
    u.st.eva += extra; u.st.crit += extra;
  } } }),
  mj('mirinae', 'mirage', '신기루', '흉악한 한 발을 쏜 뒤 2초간 은신 (대상으로 지정되지 않는다).', { hooks: { onSkill(b, u) { b.buff(u, u, 'stealth', 2, { label: '은신' }); } } }),
  mj('mirinae', 'track', '추적 표식', '흉악한 한 발에 맞은 적은 6초간 받는 피해 +15%.', { setup: markCast, hooks: { onDeal(b, u, t, r, o) {
    if (r.amount > 0 && t.alive && bySkill(u, o)) b.applyStatus(u, t, { type: 'buff', key: 'mirinae.track', dur: 6, taken: [vuln('all', 0.15)], label: '추적' });
  } } }),
  mj('mirinae', 'drum', '증설 탄창', '탄창 4 → 6발, 재장전 2.5 → 2초.', { setup: (u) => {
    if (u.weapon?.kind === 'mag') u.weapon = { ...u.weapon, mag: 6, reload: 2 };
  } }),
  mj('mirinae', 'last', '마지막 한 발', '탄창의 마지막 1발 (기본 공격)은 피해 ×2.', { hooks: {
    dmgMult: (_b, u, _t, o) => (o.tag === 'basic' && u.weapon?.kind === 'mag' && u.ammo === 1 ? 2 : 1),
  } }),
  mj('mirinae', 'bill', '장비값 청구', '신기루 종막으로 적을 쓰러뜨리면 1명당 궁극기 게이지 +40%.', { hooks: joinHooks(
    ultWrap('mjMirBill', (b, u, base) => base(b, u)),
    { onKill(_b, u) { if ((u.mem.mjUltOn || 0) > 0) ultLater(u, 0.4); }, onTick(_b, u) { ultFlush(u); } },
  ) }),
  mj('mirinae', 'jackpot', '대박 조짐', '치명타가 터질 때마다 궁극기 게이지 +3% (0.5초에 1회).', { hooks: {
    onDeal(b, u, _t, r) { if (r.crit && !(u.mem.mjUltOn > 0) && icd(b, u, 'mjMirJack', 0.5)) ultAdd(u, 0.03); },
  } }),
  mj('mirinae', 'escape', '탈출 루트', '체력이 40% 아래로 떨어지면 3초간 은신하고 최대 체력 20% 보호막 (전투당 1회).', { hooks: { onHurt(b, u) {
    if (u.mem.mjMirEsc || !u.alive || b.hpPct(u) >= 0.4) return;
    u.mem.mjMirEsc = 1;
    b.buff(u, u, 'stealth', 3, { label: '은신' });
    b.shield(u, maxHp(b, u) * 0.2);
  } } }),
  mj('mirinae', 'scope', '장거리 조준경', '사거리 +1. 3칸 이상 떨어진 적에게 주는 피해 +15%.', { stats: { range: 1 }, hooks: {
    dmgMult: (b, u, t) => (b.dist(u, t) >= 3 ? 1.15 : 1),
  } }),
  // ★ 전설
  mj('mirinae', 'onlyone', '한 발이면 충분해', '흉악한 한 발에 맞고 체력이 25% 이하가 된 적은 즉시 쓰러진다. 보스 · 정예는 대신 체력 25% 이하일 때 흉악한 한 발 피해 ×1.6.', { setup: markCast, hooks: {
    dmgMult: (b, u, t, o) => (bySkill(u, o) && (t.isBoss || t.elite) && b.hpPct(t) <= 0.25 ? 1.6 : 1),
    onDeal(b, u, t, r, o) {
      if (r.amount <= 0 || !t.alive || t.isBoss || t.elite || !bySkill(u, o) || b.hpPct(t) > 0.25) return;
      b.emit({ k: 'status', id: t.id, name: '한 발', src: u.id, harm: true, stype: 'buff' });
      b.rawHit(u, t, t.hp + t.shield, 'true', true);
      if (!t.alive && u.sk.resetOnKill) u.cd = Math.min(u.cd, u.cdMax * (1 - u.sk.resetOnKill)); // 한 발 원칙과 함께
    },
  } }, true),
  mj('mirinae', 'encore', '신기루 2막', '신기루 종막을 쏜 뒤 그다음으로 체력이 높은 적의 곁으로 순간이동해 같은 사격을 한 번 더 (사격 위력 1200%, 치명타 확정, 빗나가지 않음). 이어서 3초간 은신.', { hooks: ultWrap('mjMirEncore', (b, u, base) => {
    const first = highestHp(b.enemiesOf(u));
    if (!base(b, u)) return false;
    const t = highestHp(b.enemiesOf(u).filter((e) => e !== first));
    if (t) {
      blinkTo(b, u, t);
      b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
      b.dealDamage(u, t, b.S(u, 'shoot') * 12, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false, critBonus: 1 });
    }
    if (u.alive) b.buff(u, u, 'stealth', 3, { label: '은신' });
    return true;
  }) }, true),
];

// ═══════════════════════════ 게베크: 헤비 버니 (기관총) · 괴수 [제압] · 헤비 버니 풀오토
const suppress = (b: Battle, src: CUnit, t: CUnit, chance = 1) => b.applyStatus(src, t, { type: 'buff', key: 'suppress', dur: 10, label: '제압' }, chance);
/** 재장전이 시작된 틱이면 true (무한 탄띠: 탄창 1개 분량을 쏠 때마다 mem.mjRefill 이 오른다) */
function reloadEdge(u: CUnit, key: string, refill: boolean) {
  const inR = u.reloadT > 0 ? 1 : 0, n = refill ? u.mem.mjRefill || 0 : 0;
  const fire = (inR && !u.mem[key + 'R']) || n !== (u.mem[key + 'N'] || 0);
  u.mem[key + 'R'] = inR; u.mem[key + 'N'] = n;
  return !!fire;
}

const GEBEK: AugDef[] = [
  mj('gebek', 'belt', '탄띠 증설', '탄막 화망 연사 5 → 7회.', setSk((s) => { s.hits += 2; })),
  mj('gebek', 'wide', '화망 확장', '탄막 화망 범위 1 → 2칸.', setSk((s) => { s.radius = Math.max(s.radius, 2); })),
  mj('gebek', 'ap', '철갑탄', '탄막 화망에 맞은 적은 5초간 방어도 -30%.', setSk((s) => { s.corrode = Math.max(s.corrode || 0, 0.3); })),
  mj('gebek', 'roar', '괴수의 포효', '괴수: [제압] 확률 25% → 40%.', { hooks: { onBasic(b, u, t, r) {
    // 특성 판정(25%)이 실패했을 때 20% 한 번 더: 25% + 75% × 20% = 40%
    if (r.amount > 0 && t.alive && !hasSt(t, 'suppress') && b.rng.chance(0.2)) suppress(b, u, t);
  } } }),
  mj('gebek', 'pin', '꼼짝 마!', '[제압]을 건 적은 4초간 받는 피해 +15%.', { hooks: { onInflict(b, u, t, s) {
    if (s.key === 'suppress' && t.side !== u.side) b.applyStatus(u, t, { type: 'buff', key: 'gebek.pin', dur: 4, taken: [vuln('all', 0.15)], label: '꼼짝 마' });
  } } }),
  mj('gebek', 'drum', '탄약 상자', '탄창 40 → 60발, 재장전 4.5 → 3.5초.', { setup: (u) => {
    if (u.weapon?.kind === 'mag') u.weapon = { ...u.weapon, mag: 60, reload: 3.5 };
  } }),
  mj('gebek', 'spin', '총열 예열', '기본 공격 1회마다 공격 속도 +2% (최대 +30%). 재장전하면 초기화.', { hooks: {
    onBasic(_b, u) { if ((u.mem.mjSpin || 0) < 15) { u.mem.mjSpin = (u.mem.mjSpin || 0) + 1; u.st.atkSpd += 0.02; } },
    onTick(_b, u) { if (reloadEdge(u, 'mjSpinE', false) && u.mem.mjSpin) { u.st.atkSpd -= 0.02 * u.mem.mjSpin; u.mem.mjSpin = 0; } },
  } }),
  mj('gebek', 'burp', '핵융합볶음면 트림', '재장전을 시작할 때 (무한 탄띠면 탄창 1개 분량을 쏠 때마다) 불붙은 트림: 주변 2칸 적에게 사격 위력 250% 화학 피해.', { hooks: { onTick(b, u) {
    if (!reloadEdge(u, 'mjBurpE', true)) return;
    const es = b.around(u, 2, b.enemiesOf(u));
    if (!es.length) return;
    b.fx(u.x, u.y, 2, 'chem');
    for (const e of es) b.dealDamage(u, e, b.S(u, 'shoot') * 2.5, { elem: 'chem', tag: 'proc', kind: 'shoot' });
  } } }),
  mj('gebek', 'yuri', '막내의 응원', '헤비 버니 풀오토가 끝나면 1초 동안 그때의 대상 주변 2칸에 10발 더 (사격 위력 60% 물리, 맞은 적 50% 확률로 [제압]).', { hooks: ultWrap('mjGebYuri', (b, u, base) => {
    if (!base(b, u)) return false;
    for (let i = 0; i < 10; i++) b.later(2 + i * 0.1, () => {
      if (!u.alive || b.over) return;
      if (i === 0) {
        const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
        if (!t) return;
        u.mem.mjYuriX = t.x; u.mem.mjYuriY = t.y; u.mem.mjYuriOn = 1;
      }
      if (!u.mem.mjYuriOn) return;
      const vs = b.around({ x: u.mem.mjYuriX, y: u.mem.mjYuriY }, 2, b.enemiesOf(u));
      if (i === 9) u.mem.mjYuriOn = 0;
      if (!vs.length) return;
      const v = b.rng.pick(vs);
      b.emit({ k: 'atk', from: u.id, to: v.id, elem: 'phys', ranged: true });
      const r = b.dealDamage(u, v, b.S(u, 'shoot') * 0.6, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: true });
      if (r.amount > 0 && v.alive && b.rng.chance(0.5)) suppress(b, u, v);
    });
    return true;
  }) }),
  mj('gebek', 'dad', '아빠는 안 쓰러져', '쓰러질 피해를 받으면 체력 30%로 버티고 3초간 받는 피해 -50% (전투당 1회).', { hooks: { onLethal(b, u) {
    if (u.mem.mjGebDad) return false;
    u.mem.mjGebDad = 1;
    u.hp = maxHp(b, u) * 0.3;
    b.buff(u, u, 'gebek.dad', 3, { taken: [red('all', 0.5)], label: '아빠는 안 쓰러져' });
    return true;
  } } }),
  mj('gebek', 'eng', '공동 설계', '아군 포탑의 기본 공격이 맞으면 20% 확률로 [제압].', { hooks: { onTick(b, u) {
    if (u.mem.mjGebEng) return;
    u.mem.mjGebEng = 1;
    for (const tur of b.units) {
      if (tur.defId !== 'turret' || tur.side !== u.side) continue;
      tur.hooks.push({ onBasic(bb, _self, t, r) { if (r.amount > 0 && t.alive && u.alive && bb.rng.chance(0.2)) suppress(bb, u, t); } });
    }
  } } }),
  mj('gebek', 'legeno', '레게노!', '탄막 화망이 1발 맞을 때마다 궁극기 게이지 +0.4% (시전마다 최대 10%).', { setup: markCast, hooks: {
    onDeal(_b, u, _t, r, o) {
      if (r.amount <= 0 || !bySkill(u, o) || (u.mem.mjLeg || 0) >= 0.1 - 1e-9) return;
      u.mem.mjLeg = (u.mem.mjLeg || 0) + 0.004;
      ultAdd(u, 0.004);
    },
    onSkill(_b, u) { u.mem.mjLeg = 0; },
  } }),
  // ★ 전설
  mj('gebek', 'beast', '진짜 괴수', '기본 공격이 맞으면 대상 주변 1칸 다른 적에게도 사격 위력 25% 물리 피해. 퍼진 탄도 25% 확률로 [제압].', { hooks: { onBasic(b, u, t, r) {
    if (r.amount <= 0) return;
    for (const e of b.around(t, 1, b.enemiesOf(u))) {
      if (e === t) continue;
      const r2 = b.dealDamage(u, e, b.S(u, 'shoot') * 0.25, { elem: 'phys', tag: 'proc', kind: 'shoot' });
      if (r2.amount > 0 && e.alive && b.rng.chance(0.25)) suppress(b, u, e);
    }
  } } }, true),
  mj('gebek', 'endless', '무한 탄띠', '재장전하지 않는다 (탄창이 줄지 않음). 기본 공격 10회마다 탄막 화망 쿨다운 -1초.', { hooks: { onBasic(_b, u) {
    if (u.weapon?.kind !== 'mag') return;
    const mag = u.weapon.mag || 1;
    u.ammo = mag + 1; // 공격 뒤 1 줄어 가득 찬 채로
    u.mem.mjEndShots = (u.mem.mjEndShots || 0) + 1;
    if (u.mem.mjEndShots % mag === 0) u.mem.mjRefill = (u.mem.mjRefill || 0) + 1; // 트림: 탄창 1개 분량
    if (u.mem.mjEndShots % 10 === 0) u.cd -= 1;
  } } }, true),
];

// ═══════════════════════════ 린디웨: 실드 제너레이터 · 특별경호팀 · 신용 보증
/** 특별경호팀과 같은 상태 (같은 키라 겹치지 않고 갱신만 된다) */
const lindAura = (b: Battle, u: CUnit, a: CUnit) =>
  b.applyStatus(u, a, { type: 'buff', key: 'lindiwe.aura', dur: 0.7, taken: [red('all', 0.3)], share: a === u ? undefined : u, shareRate: 0.5 });

const LINDIWE: AugDef[] = [
  mj('lindiwe', 'jab', '카운터 펀치', '실드 제너레이터에 맞은 적 1초 기절.', setSk((s) => { s.stun = Math.max(s.stun || 0, 1); })),
  mj('lindiwe', 'counter', '반격 조항', '실드 제너레이터 카운터 30% → 50%, 지속 4 → 5초.', setSk((s) => { s.counter = Math.max(s.counter, 0.5); s.dur = Math.max(s.dur, 5); })),
  mj('lindiwe', 'wide', '경호 반경 확대', '특별경호팀 범위 1 → 2칸 (피해량 경감 · 피해 분담 모두).', { hooks: { onTick(b, u, dt) {
    if (!every(u, 'mjLindWide', dt, 0.5, 0)) return;
    for (const a of b.around(u, 2, b.alliesOf(u))) if (b.dist(u, a) > 1) lindAura(b, u, a);
  } } }),
  mj('lindiwe', 'limit', '신용 한도 상향', '전투 스킬을 쓸 때 보호막 18% → 28% (최대 체력 비례).', { hooks: { onSkill(b, u) { b.shield(u, maxHp(b, u) * 0.1); } } }),
  mj('lindiwe', 'ledger', '장부 정산', '실드 제너레이터가 맞은 적마다, 지난 시전 뒤 나눠 받은 피해의 25%만큼 물리 피해를 더 준다 (적마다 최대 타격 위력 300%).', { setup: markCast, hooks: {
    onDeal(b, u, t, r, o) {
      if (r.amount <= 0 || !t.alive || !bySkill(u, o)) return;
      const amt = Math.min(b.P(u, 'strike') * 3, ((u.mem.shareTaken || 0) - (u.mem.mjLedger || 0)) * 0.25);
      if (amt > 0) b.dealDamage(u, t, amt, { elem: 'phys', tag: 'proc', kind: 'strike' });
    },
    onSkill(_b, u) { u.mem.mjLedger = u.mem.shareTaken || 0; },
  } }),
  mj('lindiwe', 'boxing', '복싱 스텝', '방어막 건틀릿 콤보 3 → 2 (2타마다 피니쉬).', { setup: (u) => {
    if (u.weapon?.kind === 'combo') u.weapon = { ...u.weapon, combo: 2 };
  } }),
  mj('lindiwe', 'poke', '연어 포케', '실드 제너레이터를 쓰면 주변 1칸 다른 아군이 각자 최대 체력 6% 회복.', { hooks: { onSkill(b, u) {
    for (const a of b.around(u, 1, b.alliesOf(u, false))) b.heal(u, a, maxHp(b, a) * 0.06);
  } } }),
  mj('lindiwe', 'interest', '이자 수익', '보호막이 남아 있는 동안 피해 +20%.', { hooks: { dmgMult: (_b, u) => (u.shield > 0 ? 1.2 : 1) } }),
  mj('lindiwe', 'cosign', '연대 보증', '신용 보증 보호막 15% → 25% (아군 각자 최대 체력 비례).', { hooks: ultWrap('mjLindCosign', (b, u, base) => {
    if (!base(b, u)) return false;
    for (const a of b.alliesOf(u)) b.shield(a, maxHp(b, a) * 0.1);
    return true;
  }) }),
  mj('lindiwe', 'subrogate', '대위변제', '다른 아군 대신 받은 피해가 자신 최대 체력의 10%만큼 쌓일 때마다 궁극기 게이지 +5%.', { hooks: { onTick(b, u) {
    const step = maxHp(b, u) * 0.1;
    if (step <= 0) return;
    const n = Math.floor(((u.mem.shareTaken || 0) - (u.mem.mjSubro || 0)) / step);
    if (n <= 0) return;
    u.mem.mjSubro = (u.mem.mjSubro || 0) + n * step;
    ultAdd(u, 0.05 * n);
  } } }),
  mj('lindiwe', 'table', '협상 테이블', '실드 제너레이터에 맞은 적은 2초간 린디웨를 노린다 (도발). 도발한 적 1명당 최대 체력 3% 보호막.', { setup: markCast, hooks: { onDeal(b, u, t, r, o) {
    if (r.amount <= 0 || !t.alive || !bySkill(u, o)) return;
    b.provoke(t, u, 2);
    b.shield(u, maxHp(b, u) * 0.03);
  } } }),
  mj('lindiwe', 'petra', '페트라 협력', '주변 2칸 안의 다른 페트라 아군 공격 속도 +15%.', { hooks: { onTick(b, u, dt) {
    if (!every(u, 'mjLindPet', dt, 0.5, 0)) return;
    for (const a of b.around(u, 2, b.alliesOf(u, false))) if (a.synergies.has('PET')) b.buff(u, a, 'lindiwe.petra', 0.7, { delta: { atkSpd: 0.15 } });
  } } }),
  // ★ 전설
  mj('lindiwe', 'cross', '크로스 카운터', '실드 제너레이터 쿨다운 6.5 → 5초. 실드 제너레이터를 쓰면 6초간 받은 피해의 50%를 고정 피해로 되돌린다 (카운터와 별도).', {
    setup: (u) => { u.cdMax -= 1.5; },
    hooks: { onSkill(b, u) { b.buff(u, u, 'lindiwe.cross', 6, { reflectTrue: 0.5, label: '크로스 카운터' }); } },
  }, true),
  mj('lindiwe', 'allin', '전원 경호 계약', '특별경호팀이 모든 아군에게 닿는다: 범위 밖 아군은 받는 피해의 30%를 린디웨가 나눠 받고 피해량 경감 15%p. 자신 최대 체력 +25%, 피해량 경감 +15%p.', {
    pct: { maxHp: 0.25 }, taken: [red('all', 0.15)],
    hooks: { onTick(b, u, dt) {
      if (!every(u, 'mjLindAll', dt, 0.5, 0)) return;
      for (const a of b.alliesOf(u, false)) {
        if (b.dist(u, a) <= 1 || hasSt(a, 'lindiwe.aura')) { a.statuses = a.statuses.filter((s) => s.key !== 'lindiwe.all'); continue; }
        b.applyStatus(u, a, { type: 'buff', key: 'lindiwe.all', dur: 0.7, taken: [red('all', 0.15)], share: u, shareRate: 0.3 });
      }
    } },
  }, true),
];

// ═══════════════════════════ 프란체: 이의 있습니다 · 은하법 검사 [심판] · 판결 선고 [판결]
const RULED = new WeakSet<Status>();
/** 기록 정산 (고정 피해). extras: 집단 소송 · 신속 재판 적용 */
function settle(b: Battle, src: CUnit | undefined, tgt: CUnit, amt: number, extras: boolean) {
  if (!src || amt <= 0 || !tgt.alive) return;
  b.dealDamage(src, tgt, amt, { elem: 'true', tag: 'proc' });
  if (!extras) return;
  if (src.mem.mjFzSplash) for (const e of b.around(tgt, 1, b.enemiesOf(src))) if (e !== tgt) b.dealDamage(src, e, amt * 0.5, { elem: 'true', tag: 'proc', noHooks: true });
  if (src.mem.mjFzSwift && src.alive) ultAdd(src, 0.04);
}
/** 프란체가 거는 [심판] · [판결]을 증강 수치로 고친다 (onInflict, 한 상태에 한 번) */
const rulingHook: Hooks = { onInflict(_b, u, _t, s) {
  if ((s.key !== 'franze.judge' && s.key !== 'franze.verdict') || RULED.has(s)) return;
  RULED.add(s);
  const judge = s.key === 'franze.judge';
  if (judge) s.recRate = 0.2 + (u.mem.mjFzRec || 0);
  const mult = judge ? 1 + (u.mem.mjFzPay || 0) : 1.5 + (u.mem.mjFzVerdict || 0);
  s.onExpire = (bb, tgt, st) => settle(bb, st.src, tgt, (st.rec || 0) * mult, true);
} };
/** 기본 공격 [심판]과 같은 상태 */
const judgeStatus = (): Status => ({ type: 'buff', key: 'franze.judge', dur: 5, rec: 0, label: '심판',
  onExpire(bb, tgt, s) { if (s.rec && s.src && tgt.alive) bb.dealDamage(s.src, tgt, s.rec, { elem: 'true', tag: 'proc' }); } });
const flag = (key: string, v = 1): Effect['setup'] => (u) => { u.mem[key] = (u.mem[key] || 0) + v; };

const FRANZE: AugDef[] = [
  mj('franze', 'sustain', '이의 인정', '이의 있습니다에 맞은 적 1초 기절.', setSk((s) => { s.stun = Math.max(s.stun || 0, 1); })),
  mj('franze', 'regen', '혈족의 재생력', '은하법 검사: 전투 스킬 뒤 재생 12.5% → 25% (잃은 체력 비례).', setSk((s) => { s.rewind = Math.max(s.rewind ?? 0.125, 0.25); })),
  mj('franze', 'evidence', '증거 수집', '[심판] 기록 비율 20% → 30%.', { setup: flag('mjFzRec', 0.1), hooks: rulingHook }),
  mj('franze', 'aggravate', '가중 처벌', '[심판] 정산 100% → 140%.', { setup: flag('mjFzPay', 0.4), hooks: rulingHook }),
  mj('franze', 'cross', '반대 신문', '[심판] 중인 적에게 이의 있습니다 피해 +40%.', { setup: markCast, hooks: {
    dmgMult: (_b, u, t, o) => (bySkill(u, o) && t.statuses.some((s) => s.key === 'franze.judge' && s.src === u) ? 1.4 : 1),
  } }),
  mj('franze', 'class', '집단 소송', '[심판] · [판결] 정산 피해의 50%를 대상 주변 1칸 다른 적에게도 준다.', { setup: flag('mjFzSplash'), hooks: rulingHook }),
  mj('franze', 'rapid', '속사포 변론', '이의 있습니다 쿨다운 7 → 5.5초.', { setup: (u) => { u.cdMax -= 1.5; } }),
  mj('franze', 'execute', '판결 집행', '판결 선고 정산 150% → 200%.', { setup: flag('mjFzVerdict', 0.5), hooks: rulingHook }),
  mj('franze', 'swift', '신속 재판', '[심판] · [판결]을 정산할 때마다 궁극기 게이지 +4%.', { setup: flag('mjFzSwift'), hooks: rulingHook }),
  mj('franze', 'record', '발언 기록', '자신이 건 [심판] 중인 적에게서 받는 피해 -20%.', { hooks: {
    takenMult: (_b, u, src) => (src.statuses.some((s) => s.key === 'franze.judge' && s.src === u) ? 0.8 : 1),
  } }),
  mj('franze', 'terrace', '대낮의 테라스', '전투 시작 후 10초간 피해 +30%, 받는 피해 +10% (햇볕에 불이 붙는다).', { hooks: { onStart(b, u) {
    b.buff(u, u, 'franze.sun', 10, { mods: [inc('all', 0.3)], taken: [vuln('all', 0.1)], label: '대낮의 테라스' });
  } } }),
  mj('franze', 'counsel', '법률 자문', '이의 있습니다를 쓰면 주변 2칸 다른 아군 4초간 피해 +12%.', { hooks: { onSkill(b, u) {
    for (const a of b.around(u, 2, b.alliesOf(u, false))) b.buff(u, a, 'franze.counsel', 4, { mods: [inc('all', 0.12)], label: '법률 자문' });
  } } }),
  // ★ 전설
  mj('franze', 'unanimous', '만장일치', '기본 공격이 맞으면 대상 주변 1칸 다른 적에게도 [심판]을 건다 (이미 걸린 적 제외).', { hooks: joinHooks(rulingHook, { onBasic(b, u, t, r) {
    if (r.amount <= 0) return;
    for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t && e.alive && !hasSt(e, 'franze.judge')) b.applyStatus(u, e, judgeStatus());
  } }) }, true),
  mj('franze', 'court', '즉결 심판', '이의 있습니다가 대상과 주변 1칸 적에게 4초간 [즉결]을 건다: 그동안 아군이 준 피해의 30%를 기록하고, 끝날 때 기록의 150%를 고정 피해로 정산한다.', { setup: markCast, hooks: { onDeal(b, u, t, r, o) {
    if (r.amount <= 0 || !t.alive || !bySkill(u, o) || u.mem.mjCourtT === b.t) return;
    u.mem.mjCourtT = b.t; // 시전 1번에 1번
    for (const e of b.around(t, 1, b.enemiesOf(u))) b.applyStatus(u, e, { type: 'buff', key: 'franze.court', dur: 4, rec: 0, recRate: 0.3, label: '즉결',
      onExpire(bb, tgt, s) { settle(bb, s.src, tgt, (s.rec || 0) * 1.5, false); } });
  } } }, true),
];

// ═══════════════════════════ 그렌홀름: 군수품 시연 · 7중 방호 슈트 · 7중 방호 전면 전개
/** 7중 방호 슈트 행동 보호막과 같은 규칙 (대상 최대 체력 기준, 상한 20%) */
function suitShield(b: Battle, a: CUnit) {
  const max = maxHp(b, a), cap = max * 0.2;
  if (a.shield < cap) b.shield(a, Math.min(max * 0.04, cap - a.shield));
}

const GRENHOLM: AugDef[] = [
  mj('grenholm', 'target', '시연용 표적', '군수품 시연에 맞은 적은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = Math.max(s.vuln || 0, 0.2); })),
  mj('grenholm', 'wide', '대규모 시연', '군수품 시연 범위 1 → 2칸.', setSk((s) => { s.radius = Math.max(s.radius, 2); })),
  mj('grenholm', 'emp', 'EMP 출력 상향', '군수품 시연 기절 1 → 1.5초.', setSk((s) => { s.stun = Math.max(s.stun, 1.5); })),
  mj('grenholm', 'layer8', '8번째 방호막', '보호막 없이 피해를 받으면 최대 체력 10% 보호막을 전개한다 (6초에 1회).', { hooks: { onHurt(b, u, _src, r) {
    if (r.amount > 0 && u.alive && u.shield <= 0 && icd(b, u, 'mjGrenL8', 6)) b.shield(u, maxHp(b, u) * 0.1);
  } } }),
  mj('grenholm', 'equal', '균등 납품', '전투 시작 시 다른 아군 전원에게 각자 최대 체력 10% 보호막.', { hooks: { onStart(b, u) {
    for (const a of b.alliesOf(u, false)) b.shield(a, maxHp(b, a) * 0.1);
  } } }),
  mj('grenholm', 'recall', '무기 회수', '군수품 시연에 맞은 적은 4초간 주는 피해 -15%.', { setup: markCast, hooks: { onDeal(b, u, t, r, o) {
    if (r.amount > 0 && t.alive && bySkill(u, o)) b.applyStatus(u, t, { type: 'buff', key: 'grenholm.recall', dur: 4, mods: [inc('all', -0.15)], label: '무기 회수' });
  } } }),
  mj('grenholm', 'form', '양식 반려', '피니쉬에 맞은 적 0.5초 기절, 군수품 시연 쿨다운 -1초.', { hooks: { onBasic(b, u, t, r) {
    if (!u.mem.finished || r.amount <= 0) return;
    if (t.alive) b.stun(u, t, 0.5);
    u.cd -= 1;
  } } }),
  mj('grenholm', 'extend', '방호 전개 연장', '7중 방호 전면 전개의 방어도 · 피해량 경감 지속 6 → 9초.', { hooks: { onInflict(_b, _u, _t, s) {
    if (s.key === 'gren.wall') s.dur = Math.max(s.dur, 9);
  } } }),
  mj('grenholm', 'punctual', '정시 보고', '6초마다 궁극기 게이지 +3%.', { hooks: { onTick(b, u, dt) {
    if (every(u, 'mjGrenPunc', dt, 6, 6) && b.enemiesOf(u).length) ultAdd(u, 0.03);
  } } }),
  mj('grenholm', 'charged', '방호 블레이드 충전', '보호막이 최대 체력 15% 이상이면 기본 공격 피해 +30%.', { hooks: {
    dmgMult: (b, u, _t, o) => (o.tag === 'basic' && u.shield >= maxHp(b, u) * 0.15 ? 1.3 : 1),
  } }),
  mj('grenholm', 'cover', '엄호 시연', '군수품 시연을 쓰면 주변 1칸 다른 아군에게 각자 최대 체력 8% 보호막.', { hooks: { onSkill(b, u) {
    for (const a of b.around(u, 1, b.alliesOf(u, false))) b.shield(a, maxHp(b, a) * 0.08);
  } } }),
  mj('grenholm', 'landing', '적진 시연', '전투 시작 시 군수품 시연 쿨다운이 바로 찬다. [기습] 중에는 군수품 시연 피해 +30%.', { setup: markCast, hooks: {
    onStart(_b, u) { u.cd = 0; },
    dmgMult: (_b, u, _t, o) => (bySkill(u, o) && hasSt(u, 'infil.ambush') ? 1.3 : 1),
  } }),
  // ★ 전설
  mj('grenholm', 'riposte', '7중 방호 반격', '보호막이 막아 낸 피해의 40%를 공격자에게 고정 피해로 되돌린다.', { hooks: {
    takenMult: (_b, u) => { u.mem.mjGrenSh = u.shield; return 1; },
    onHurt(b, u, src, r) {
      const absorbed = Math.min(u.mem.mjGrenSh || 0, r.amount);
      u.mem.mjGrenSh = 0;
      if (absorbed > 0 && src !== u && src.alive && src.side !== u.side) b.dealDamage(u, src, absorbed * 0.4, { elem: 'true', tag: 'proc', noHooks: true });
    },
  } }, true),
  mj('grenholm', 'network', '방호 네트워크', '7중 방호 슈트 보호막이 주변 1칸 다른 아군에게도 쌓인다 (각자 최대 체력 기준: 행동마다 4%, 상한 20% · 전투 스킬 12%).', { hooks: {
    onBasic(b, u) { for (const a of b.around(u, 1, b.alliesOf(u, false))) suitShield(b, a); },
    onSkill(b, u) { for (const a of b.around(u, 1, b.alliesOf(u, false))) { suitShield(b, a); b.shield(a, maxHp(b, a) * 0.12); } },
  } }, true),
];

export const AUGS: Record<string, AugDef[]> = { mirinae: MIRINAE, gebek: GEBEK, lindiwe: LINDIWE, franze: FRANZE, grenholm: GRENHOLM };
export const ULTS_X: Record<string, UltDef> = {};
