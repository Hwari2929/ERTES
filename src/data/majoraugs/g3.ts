// 메이저 전용 증강 (기물별 14개 = 일반 12 + ★ 전설 2) · 궁극기가 없던 기물의 궁극기. 이 묶음이 맡은 기물만 채운다 (index.ts 가 합친다)
// 3묶음: 올리버 · 카부라야 · ISSAC · 주성 · 망명 혈족 귀공자 (모두 궁극기가 이미 있다 — ults.ts)
import { CFG } from '../../config';
import type { Battle, CUnit, UltDef } from '../../engine/combat';
import { type AugDef, type Effect, inc, red } from '../../engine/effects';
import { addStacks, bleed, blinkTo, every, poison, shock } from '../kit';
import { setSk, SUMMON_RT, type SummonDef, uaug } from '../unitkit';

const mj = (owner: string, key: string, name: string, desc: string, effect: Effect, legend = false): AugDef =>
  ({ ...uaug(owner, `mj.${key}`, name, desc, effect), pool: 'special', ...(legend ? { legend: true } : {}) });

/** 내부 쿨다운: sec 초에 1번 */
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
/** 이 기물의 궁극기를 감싼다 (ults.ts 는 건드리지 않는다). 궁극기는 setup 뒤에 붙으므로 onStart 에서 감싼다.
 *  f 는 원래 궁극기를 부르는 cast() 를 받아 성공 여부를 돌려준다 */
const wrapUlt = (f: (b: Battle, u: CUnit, cast: () => boolean) => boolean) => (_b: Battle, u: CUnit) => {
  const base = u.ult;
  if (!base) return;
  u.ult = { ...base, cast: (bb, uu) => f(bb, uu, () => base.cast(bb, uu)) };
};
/** 궁극기가 성공한 직후 효과 */
const afterUlt = (fn: (b: Battle, u: CUnit) => void) => wrapUlt((b, u, cast) => {
  const ok = cast();
  if (ok && u.alive) fn(b, u);
  return ok;
});
/** 주기적으로 주변 아군에게 짧은 상태를 다시 건다 (오라) */
const aura = (b: Battle, u: CUnit, dt: number, key: string, r: number, p: { taken?: ReturnType<typeof red>[]; share?: CUnit; shareRate?: number }) => {
  if (!every(u, `${key}T`, dt, 0.5, 0)) return;
  for (const a of b.around(u, r, b.alliesOf(u, false))) b.applyStatus(u, a, { type: 'buff', key, dur: 0.7, ...p });
};
const lowFirst = (b: Battle, es: CUnit[]) => es.slice().sort((a, z) => b.hpPct(a) - b.hpPct(z));

// ───────────────────────── 올리버: 규정 속도 경계선 (후열 돌진 · 기술 위력 160% · 기절 0.5초) · 메트로 기관사 (이동 속도 → 기술 위력) · 막차 급행
const OLIVER: AugDef[] = [
  mj('oliver', 'overspeed', '과속 딱지', '이동 속도 +15% (100%를 넘는 만큼 특성 [메트로 기관사]로 기술 위력이 오른다).', { stats: { moveSpd: 0.15 } }),
  mj('oliver', 'wide', '광폭 선로', '규정 속도 경계선 범위 주변 1칸 → 2칸, 피해 160% → 130%.', setSk((s) => { s.radius = 2; s.mult *= 1.3 / 1.6; })),
  mj('oliver', 'express', '급행 환승', '규정 속도 경계선으로 적을 처치하면 쿨다운 50% 초기화.', setSk((s) => { s.resetOnKill = Math.max(s.resetOnKill || 0, 0.5); })),
  mj('oliver', 'brake', '급제동', '규정 속도 경계선 기절 0.5초 → 1.2초.', setSk((s) => { s.stun = 1.2; })),
  mj('oliver', 'doors', '스크린 도어', '규정 속도 경계선을 쓰면 자신에게 기술 위력 80% 보호막.', { hooks: { onSkill(b, u) { b.shield(u, b.P(u, 'tech') * 0.8); } } }),
  mj('oliver', 'transfer', '환승 안내 방송', '규정 속도 경계선에 맞은 적은 5초간 받는 피해 +15%.', setSk((s) => { s.vuln = 0.15; s.vulnDur = 5; })),
  mj('oliver', 'wrench', '렌치 정비', '피니쉬가 맞으면 규정 속도 경계선 쿨다운 0.6초 감소.', { hooks: { onBasic(_b, u, _t, r) {
    if (u.mem.finished && !r.miss) u.cd = Math.max(0, u.cd - 0.6);
  } } }),
  mj('oliver', 'first', '첫차 출발', '전투 시작 궁극기 게이지 +40% (20% → 60%).', { setup: (u) => { u.mem.ultStart = (u.mem.ultStart || 0) + 0.4; } }),
  mj('oliver', 'passenger', '승객 대체로 무사', '막차 급행을 쓰면 모든 아군 5초간 공격 속도 +25%.', { hooks: { onStart: afterUlt((b, u) => {
    for (const a of b.alliesOf(u)) b.buff(u, a, 'oliver.pass', 5, { delta: { atkSpd: 0.25 }, label: '승객 대체로 무사' });
  }) } }),
  mj('oliver', 'horn', '경적', '규정 속도 경계선에 맞은 적이 50% 확률로 1.5초 공포.', setSk((s) => { s.fear = 1.5; s.fearChance = 0.5; })),
  mj('oliver', 'double', '복선 운행', '규정 속도 경계선이 2번 들이받는다 (2번째 피해 40%).', setSk((s) => { s.hits = 2; s.second = 0.4; })),
  mj('oliver', 'family', '5형제 맏이', '엘베스타드 일가 시너지 기물 1명당 (자신 포함) 이동 속도 +5%.', { setup: (u, _b, ctx) => { u.st.moveSpd += 0.05 * (ctx.counts.FAM || 0); } }),
  mj('oliver', 'nonstop', '무정차 통과', '이동 속도 +15%. 특성 [메트로 기관사] 기준 이동 속도 100% → 80%, 넘는 만큼 오르는 기술 위력 1.5배 → 2배.', {
    stats: { moveSpd: 0.15 },
    // 특성(onStart)이 이미 ×(1 + 1.5 × (이동 속도 − 1))을 곱하므로, 여기서는 목표 배율 ×(1 + 2 × (이동 속도 − 0.8)) 과의 비를 곱한다 (순서와 무관)
    hooks: { onStart(b, u) {
      const ms = b.S(u, 'moveSpd');
      u.st.tech *= (1 + 2 * Math.max(0, ms - 0.8)) / (1 + 1.5 * Math.max(0, ms - 1));
    } },
  }, true),
  mj('oliver', 'extend', '막차 연장 운행', '막차 급행을 쓰면 규정 속도 경계선 쿨다운이 바로 끝나고, 8초간 쿨다운 감소 +100%.', { hooks: { onStart: afterUlt((b, u) => {
    u.cd = 0;
    b.buff(u, u, 'oliver.extend', 8, { delta: { cdr: 1 }, label: '연장 운행' });
  }) } }, true),
];

// ───────────────────────── 카부라야 (지휘관): 야근 수당 청구 (전술 위력 350% · 주변 1칸 · 감전 80% 1.5초) · 권태 (감전 적 피해 +25%) · 정시 퇴근
const KABURAYA: AugDef[] = [
  mj('kaburaya', 'bored', '권태의 극치', '감전된 적에게 주는 피해 +25% → +45%.', { setup: (u) => { u.mem.kabBored = (u.mem.kabBored || 0) + 0.2; } }),
  mj('kaburaya', 'overtime', '확대 회의', '야근 수당 청구 범위 주변 1칸 → 2칸, 피해 350% → 275%.', setSk((s) => { s.radius = 2; s.mult *= 2.2 / 2.8; })),
  mj('kaburaya', 'jolt', '누전', '기본 공격이 감전된 적에게 맞으면 전술 위력 50% 전기 추가 피해.', { hooks: { onBasic(b, u, t, r) {
    if (r.amount > 0 && t.alive && b.has(t, 'shock')) b.dealDamage(u, t, b.tacPower(u) * 0.5, { elem: 'elec', tag: 'proc', kind: 'tech' });
  } } }),
  mj('kaburaya', 'invoice', '수당 청구서', '야근 수당 청구에 맞은 적은 5초간 받는 피해 +15%.', setSk((s) => { s.vuln = 0.15; s.vulnDur = 5; })),
  mj('kaburaya', 'clockout', '칼퇴 준비', '전투 시작 궁극기 게이지 +40% (20% → 60%).', { setup: (u) => { u.mem.ultStart = (u.mem.ultStart || 0) + 0.4; } }),
  mj('kaburaya', 'meeting', '긴급 회의', '야근 수당 청구 감전 확률 80% → 100%, 지속 1.5초 → 2.5초.', setSk((s) => { s.shock = 2.5; s.shockChance = 1; })),
  mj('kaburaya', 'riskdoc', '리스크 문서', '8초마다 자신에게 전술 위력 80% 보호막.', { hooks: { onTick(b, u, dt) {
    if (!every(u, 'kabDocT', dt, 8, 8) || !b.enemiesOf(u).length) return;
    b.shield(u, b.P(u, 'tech') * 0.8);
  } } }),
  mj('kaburaya', 'dnd', '방해 금지', '적이 거는 기절 · 빙결 · 공포에 걸리지 않는다. 대신 최대 체력 -10%.', { pct: { maxHp: -0.1 }, setup: (u) => { u.mem.ccImmuneUntil = Infinity; } }),
  mj('kaburaya', 'hoi', '결재 라인', '호이슌 홀딩스 시너지 기물 1명당 (자신 포함) 전술 위력 +5%.', { setup: (u, _b, ctx) => { u.mem.tacPct = (u.mem.tacPct || 0) + 0.05 * (ctx.counts.HOI || 0); } }),
  mj('kaburaya', 'chain', '연쇄 결재', '감전된 적이 쓰러지면 2칸 안의 가장 가까운 적에게 전술 위력 75% 전기 피해 + 1.5초 감전.', { hooks: { onAnyDeath(b, u, dead) {
    if (dead.side === u.side || !dead.statuses.some((s) => s.key === 'shock' && s.dur > 0)) return;
    const n = b.nearest(dead, b.around(dead, 2, b.enemiesOf(u)));
    if (!n) return;
    b.fx(n.x, n.y, 0, 'elec');
    b.dealDamage(u, n, b.tacPower(u) * 0.75, { elem: 'elec', tag: 'proc', kind: 'tech' });
    if (n.alive) shock(b, u, n, 1.5, 1);
  } } }),
  mj('kaburaya', 'battery', '보조 배터리', '지루한 스턴건 탄창 4발 → 6발, 재장전 2초 → 1.5초.', { setup: (u) => { if (u.weapon) { u.weapon.mag = 6; u.weapon.reload = 1.5; } } }),
  mj('kaburaya', 'paper', '서류 정리', '야근 수당 청구 쿨다운 7초 → 6초.', setSk((_s, u) => { u.cdMax *= 6 / 7; })),
  mj('kaburaya', 'afterhours', '퇴근 후 문제', '정시 퇴근 3초 뒤 한 번 더: 모든 적에게 전술 위력 250% 전기 피해 + 1초 감전.', { hooks: { onStart: afterUlt((b, u) => {
    b.later(3, () => {
      if (!u.alive) return;
      b.emit({ k: 'status', id: u.id, name: '퇴근 후 문제' });
      for (const e of b.enemiesOf(u)) {
        b.dealDamage(u, e, b.P(u, 'tech') * 2.5, { elem: 'elec', tag: 'skill', kind: 'tech', canMiss: false });
        if (e.alive) shock(b, u, e, 1, 1);
      }
    });
  }) } }, true),
  mj('kaburaya', 'contagion', '권태 전염', '전투 시작 시 다른 아군 기물 (소환물 제외)도 감전된 적에게 주는 피해 +25%.', { hooks: { onStart(b, u) {
    for (const a of b.alliesOf(u, false)) if (!a.isSummon) a.hooks.push({ dmgMult: (bb, _s, t) => (bb.has(t, 'shock') ? 1.25 : 1) });
  } } }, true),
];

// ───────────────────────── ISSAC (돌격가): 붕대 해제 (주변 1칸 타격 위력 225% 화학 + 중독 38%) · 재생하는 괴물 · 실험체 해방
const SLIME = ['#06100a', '#4cc860', '#2a7a3a', '#9af0a0', '#ffffff', '#2a4a30', '#e0ffe0'];
/** ★ 녹빛 손: 상속률 = 최고의 친구 기본 상속률 × rate */
const GREEN_HAND: SummonDef = { name: '녹빛 손', ctype: 'VAN', sprite: 'beast', palette: SLIME, atk: { type: 'strike', elem: 'chem', interval: 0.9, mult: 1.25 }, range: 1, hpMul: 0.8, rate: 1.5 };
const ISSAC: AugDef[] = [
  mj('issac', 'regen', '과재생', '초당 재생 최대 체력 0.5% → 1%.', { hooks: { onTick(b, u, dt) {
    u.mem.isRg = (u.mem.isRg || 0) + dt;
    if (u.mem.isRg >= 1) { u.mem.isRg -= 1; b.heal(u, u, b.S(u, 'maxHp') * 0.005, true); }
  } } }),
  mj('issac', 'slime', '점액 갑옷', '전투 스킬을 쓸 때 받는 보호막 최대 체력 15% → 25%.', { hooks: { onSkill(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.1); } } }),
  mj('issac', 'wide', '붕대 전부 풀기', '붕대 해제 범위 주변 1칸 → 2칸, 피해 225% → 188%.', setSk((s) => { s.radius = 2; s.mult *= 1.5 / 1.8; })),
  mj('issac', 'toxin', '맹독 체액', '붕대 해제 중독 초당 타격 위력 38% → 75%.', setSk((s) => { s.poison *= 2; })),
  mj('issac', 'family', '우리 식구', '주변 1칸 다른 아군이 받는 피해 (지속 피해 제외)의 20%를 ISSAC이 대신 받는다.', { hooks: { onTick(b, u, dt) {
    aura(b, u, dt, 'issac.family', 1, { share: u, shareRate: 0.2 });
  } } }),
  mj('issac', 'name', '이름부터 여쭙겠습니다', '아군 기물 (소환물 제외)이 쓰러지면 8초간 주는 피해 +35%, 받는 피해 -15%.', { hooks: { onAllyDeath(b, u, dead) {
    if (dead === u || dead.isSummon) return;
    b.buff(u, u, 'issac.name', 8, { mods: [inc('all', 0.35)], taken: [red('all', 0.15)], label: '이름을 여쭙다' });
  } } }),
  mj('issac', 'manners', '정중한 양해', '붕대 해제를 쓰면 범위 안의 적이 2초간 ISSAC을 노린다 (도발).', { hooks: { onSkill(b, u) {
    for (const e of b.around(u, u.sk.radius || 1, b.enemiesOf(u))) b.provoke(e, u, 2);
  } } }),
  mj('issac', 'crowd', '사람이 많네요', '주변 2칸 적 1명당 받는 피해 -5% (최대 -25%).', { hooks: {
    takenMult: (b, u) => 1 - Math.min(0.25, 0.05 * b.around(u, 2, b.enemiesOf(u)).length),
  } }),
  mj('issac', 'venom', '독수', '피니쉬가 맞으면 4초간 초당 타격 위력 50% 중독.', { hooks: { onBasic(b, u, t, r) {
    if (u.mem.finished && r.amount > 0 && t.alive) poison(b, u, t, b.S(u, 'strike') * 0.5, 4, 1);
  } } }),
  mj('issac', 'limb', '성격 급한 손', '기본 공격이 맞으면 25% 확률로 떨어진 손이 타격 위력 63% 화학 추가 피해.', { hooks: { onBasic(b, u, t, r) {
    if (r.amount > 0 && t.alive && b.rng.chance(0.25)) b.dealDamage(u, t, b.S(u, 'strike') * 0.625, { elem: 'chem', tag: 'proc', kind: 'strike' });
  } } }),
  mj('issac', 'patience', '참을성의 한계', '피격으로 차는 궁극기 게이지 2배.', { hooks: { onHurt(b, u, _s, r, o) {
    if (o.tag !== 'dot' && r.amount > 0 && u.mem.ultHurtAt === b.t) b.ultGain(u, CFG.ultGain.hurt, 'bonus'); // 이번 피격에 엔진 피격 충전이 들어갔을 때만 같은 양 한 번 더
  } } }),
  mj('issac', 'ornis', '오르니스 예법', '성간 인류 연합 시너지 기물 1명당 (자신 포함) 방어도 +6%.', { setup: (u, _b, ctx) => { u.st.armor *= 1 + 0.06 * (ctx.counts.UNI || 0); } }),
  mj('issac', 'hands', '녹빛 손', '처음으로 체력이 50% 이하가 되면 녹빛 손 2기가 떨어져 나와 싸운다 (돌격가 · 화학 근접, 능력치 상속률 = 최고의 친구 기본 상속률 × 1.5, 체력 ×0.8).', { hooks: { onHurt(b, u) {
    if (u.mem.gHands || !u.alive || b.hpPct(u) > 0.5) return;
    u.mem.gHands = 1;
    b.emit({ k: 'status', id: u.id, name: '녹빛 손' });
    for (let i = 0; i < 2; i++) SUMMON_RT.make?.(b, u, GREEN_HAND);
  } } }, true),
  mj('issac', 'unbound', '붕대 없는 신사', '최대 체력 -15%. 기본 공격이 대상 주변 1칸 다른 적에게도 타격 위력 50% 화학 피해 + 3초간 초당 타격 위력 19% 중독.', {
    pct: { maxHp: -0.15 },
    hooks: { onBasic(b, u, t) {
      for (const e of b.around(t, 1, b.enemiesOf(u))) {
        if (e === t || !e.alive) continue;
        b.dealDamage(u, e, b.S(u, 'strike') * 0.5, { elem: 'chem', tag: 'proc', kind: 'strike' });
        if (e.alive) poison(b, u, e, b.S(u, 'strike') * 0.1875, 3, 1);
      }
    } },
  }, true),
];

// ───────────────────────── 주성 (돌격가 · 수호자): 설원 검무 (주변 1칸 200% · 가하는 피해 -30% 4초) · 연현문 검객 (피니쉬 밀쳐내기 + 30% 기절) · 월하 호위
const JUSEONG: AugDef[] = [
  mj('juseong', 'circle', '큰 원 베기', '설원 검무 범위 주변 1칸 → 2칸, 피해 200% → 160%.', setSk((s) => { s.radius = 2; s.mult *= 1.6 / 2; })),
  mj('juseong', 'frost', '설원의 냉기', '설원 검무에 맞은 적이 가하는 피해 -40% → -55%.', setSk((s) => { s.weak = 0.55; })),
  mj('juseong', 'shatter', '빙판 깨기', '피니쉬가 맞은 뒤 대상이 기절해 있으면 타격 위력 80% 물리 추가 피해.', { hooks: { onBasic(b, u, t, r) {
    if (u.mem.finished && !r.miss && t.alive && b.has(t, 'stun')) b.dealDamage(u, t, b.S(u, 'strike') * 0.8, { elem: 'phys', tag: 'proc', kind: 'strike' });
  } } }),
  mj('juseong', 'escort', '왕자 호위', '주변 1칸 다른 아군의 피해량 경감 +12%.', { hooks: { onTick(b, u, dt) {
    aura(b, u, dt, 'jus.escort', 1, { taken: [red('all', 0.12)] });
  } } }),
  mj('juseong', 'toll', '통행료', '설원 검무 · 월하 호위에 맞은 적 1명당 자신에게 최대 체력 3% 보호막.', { hooks: { onDeal(b, u, t, r, o) {
    if (o.tag === 'skill' && t !== u && r.amount > 0) b.shield(u, b.S(u, 'maxHp') * 0.03);
  } } }),
  mj('juseong', 'loot', '훔친 물자', '전투 시작 시 모든 아군에게 주성 최대 체력 6% 보호막.', { hooks: { onStart(b, u) {
    for (const a of b.alliesOf(u)) b.shield(a, b.S(u, 'maxHp') * 0.06);
  } } }),
  mj('juseong', 'whet', '대검 손질', '피니쉬 피해 +40%.', { mods: [inc('finish', 0.4)] }),
  mj('juseong', 'counter', '받아치기', '주변 1칸 적에게 맞으면 25% 확률로 타격 위력 60% 물리 반격 (0.5초에 1번).', { hooks: { onHurt(b, u, src, _r, o) {
    if (o.tag === 'dot' || o.tag === 'proc' || src === u || !src.alive || b.sideOf(src) === b.sideOf(u) || b.dist(u, src) > 1) return;
    if (!b.rng.chance(0.25) || !icd(b, u, 'jusCounterT', 0.5)) return;
    b.dealDamage(u, src, b.S(u, 'strike') * 0.6, { elem: 'phys', tag: 'proc', kind: 'strike' });
  } } }),
  mj('juseong', 'stance', '버티기', '체력이 50% 이하이면 피해량 경감 +20%.', { hooks: { onTick(b, u) {
    if (b.hpPct(u) <= 0.5) b.buff(u, u, 'jus.stance', 0.3, { taken: [red('all', 0.2)] });
  } } }),
  mj('juseong', 'moonlight', '달빛 아래', '월하 호위를 쓰면 주변 2칸 다른 아군에게 주성 최대 체력 15% 보호막.', { hooks: { onStart: afterUlt((b, u) => {
    for (const a of b.around(u, 2, b.alliesOf(u, false))) b.shield(a, b.S(u, 'maxHp') * 0.15);
  }) } }),
  mj('juseong', 'tempo', '검기 순환', '설원 검무 쿨다운 7초 → 5.5초.', setSk((_s, u) => { u.cdMax *= 5.5 / 7; })),
  mj('juseong', 'chr', '청라의 떠돌이', '청라공국 시너지 기물 1명당 (자신 포함) 최대 체력 +5%.', { setup: (u, _b, ctx) => { u.st.maxHp *= 1 + 0.05 * (ctx.counts.CHR || 0); } }),
  mj('juseong', 'wall', '만부부당', '설원 검무를 쓰면 범위 안의 적이 2초간 주성을 노리고 (도발), 그 적 1명당 6초간 피해량 경감 +6% (최대 30%).', { hooks: { onSkill(b, u) {
    const es = b.around(u, u.sk.radius || 1, b.enemiesOf(u));
    for (const e of es) b.provoke(e, u, 2);
    if (es.length) addStacks(b, u, u, 'jus.wall', es.length, 5, 6, (n) => ({ taken: [red('all', 0.06 * n)] }), '만부부당');
  } } }, true),
  mj('juseong', 'moonblade', '월하 검귀', '월하 호위를 쓰면 8초간 3타 → 2타마다 피니쉬, 피니쉬가 대상 주변 1칸 다른 적도 타격 위력 100%로 벤다.', { hooks: {
    onStart: afterUlt((b, u) => {
      if (!u.weapon) return;
      const until = (u.mem.moonUntil = b.t + 8);
      if (!u.mem.moonCombo) u.mem.moonCombo = u.weapon.combo || 3;
      u.weapon.combo = 2;
      b.later(8, () => { if (u.mem.moonUntil === until && u.weapon) { u.weapon.combo = u.mem.moonCombo || 3; u.mem.moonCombo = 0; } });
    }),
    onBasic(b, u, t) {
      if (!u.mem.finished || (u.mem.moonUntil || 0) <= b.t) return;
      for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t && e.alive) b.dealDamage(u, e, b.S(u, 'strike'), { elem: 'phys', tag: 'proc', kind: 'strike' });
    },
  } }, true),
];

// ───────────────────────── 망명 혈족 귀공자 (돌격가 · 침투자): 혈검 (최저 체력 적 돌진 220% + 출혈 30%) · 혈족의 갈증 (피니쉬 · 스킬 · 궁극기 피해 35% 회복) · 혈월
/** 혈족의 갈증과 같은 조건으로 추가 회복 (k = 준 피해 대비) */
const thirst = (k: (b: Battle, u: CUnit) => number) => ({
  onBasic(b: Battle, u: CUnit, _t: CUnit, r: { amount: number }) { const m = k(b, u); if (m && u.mem.finished && r.amount > 0) b.heal(u, u, r.amount * m, true); },
  onDeal(b: Battle, u: CUnit, t: CUnit, r: { amount: number }, o: { tag: string }) { const m = k(b, u); if (m && o.tag === 'skill' && t !== u && r.amount > 0) b.heal(u, u, r.amount * m, true); },
});
const EXILE: AugDef[] = [
  mj('exile', 'hunt', '사냥의 밤', '선혈 습격으로 적을 처치하면 쿨다운 60% 초기화.', setSk((s) => { s.resetOnKill = Math.max(s.resetOnKill || 0, 0.6); })),
  mj('exile', 'deep', '깊은 상처', '선혈 습격 출혈 초당 타격 위력 30% → 60%.', setSk((s) => { s.bleed *= 2; })),
  mj('exile', 'vital', '급소 찌르기', '선혈 습격 치명타 확률 +30%.', setSk((s) => { s.crit = (s.crit || 0) + 0.3; })),
  mj('exile', 'thirst', '갈증 심화', '특성 [혈족의 갈증] 회복 35% → 50%.', { hooks: thirst(() => 0.15) }),
  mj('exile', 'cloak', '망토 한 벌', '전투 시작 시 4초간 은신 (적의 대상이 되지 않는다), 공격 속도 +30%.', { hooks: { onStart(b, u) {
    b.buff(u, u, 'stealth', 4, { label: '은신' });
    b.buff(u, u, 'exile.cloak', 4, { delta: { atkSpd: 0.3 } });
  } } }),
  mj('exile', 'apology', '칼을 뽑기 전의 사과', '선혈 습격 · 혈월에 맞은 적은 3초간 가하는 피해 -20%.', { hooks: { onDeal(b, u, t, r, o) {
    if (o.tag === 'skill' && t !== u && t.alive && r.amount > 0) b.applyStatus(u, t, { type: 'buff', key: 'weaken', dur: 3, mods: [inc('all', -0.2)], label: '피해량 감소' });
  } } }),
  mj('exile', 'evade', '추격대 따돌리기', '체력이 50% 이하이면 회피 +15%.', { hooks: { onTick(b, u) {
    if (b.hpPct(u) <= 0.5) b.buff(u, u, 'exile.evade', 0.3, { delta: { eva: 0.15 } });
  } } }),
  mj('exile', 'noble', '대공령의 예법', '칼리토 작위 +1, 치명타 피해 +20%.', { title: 1, stats: { critDmg: 0.2 } }),
  mj('exile', 'moon', '붉은 달의 여운', '혈월을 쓰면 6초간 공격 속도 +40%.', { hooks: { onStart: afterUlt((b, u) => {
    b.buff(u, u, 'exile.moon', 6, { delta: { atkSpd: 0.4 }, label: '붉은 달' });
  }) } }),
  mj('exile', 'edge', '혈검 끝', '피니쉬가 맞으면 4초간 초당 타격 위력 25% 출혈.', { hooks: { onBasic(b, u, t, r) {
    if (u.mem.finished && r.amount > 0 && t.alive) bleed(b, u, t, b.S(u, 'strike') * 0.25, 4);
  } } }),
  mj('exile', 'shadow', '그림자 걸음', '적을 처치하면 체력 비율이 가장 낮은 적 곁으로 순간이동 (1초에 1번).', { hooks: { onKill(b, u) {
    const es = b.targetable(u);
    if (!es.length || !icd(b, u, 'exShadowT', 1)) return;
    blinkTo(b, u, lowFirst(b, es)[0]);
  } } }),
  mj('exile', 'price', '내 피 말이오', '선혈 습격 피해 220% → 300%. 대신 선혈 습격을 쓸 때마다 체력 6% 소모 (체력 1 아래로는 줄지 않는다).', {
    setup: (u) => { u.sk.mult *= 3 / 2.2; },
    hooks: { onSkill(b, u) { u.hp = Math.max(1, u.hp - b.S(u, 'maxHp') * 0.06); } },
  }),
  mj('exile', 'banquet', '혈월 연회', '혈월이 끝나면 아직 베지 않은 적 중 체력 비율이 가장 낮은 2명에게 더 순간이동해 타격 위력 300% 물리 피해 + 출혈.', { hooks: { onStart: wrapUlt((b, u, cast) => {
    const first = new Set(lowFirst(b, b.enemiesOf(u)).slice(0, 3)); // 혈월이 고르는 3명과 같은 규칙
    if (!cast()) return false;
    if (!u.alive) return true;
    for (const e of lowFirst(b, b.enemiesOf(u).filter((x) => !first.has(x))).slice(0, 2)) {
      if (!e.alive || !u.alive) continue;
      blinkTo(b, u, e);
      b.dealDamage(u, e, b.S(u, 'strike') * 3, { elem: 'phys', tag: 'skill', kind: 'strike', canMiss: false });
      if (e.alive) bleed(b, u, e, b.S(u, 'strike') * 0.3, 4);
    }
    return true;
  }) } }, true),
  mj('exile', 'undying', '이름 없는 불사', '전투당 1회, 쓰러질 피해를 받으면 체력 1로 버티고 3초간 피해를 받지 않는다. 그 3초 동안 [혈족의 갈증] 회복 35% → 70%.', { hooks: {
    onLethal(b, u) {
      if (u.mem.undyUsed) return false;
      u.mem.undyUsed = 1;
      u.hp = 1;
      u.mem.invulnUntil = Math.max(u.mem.invulnUntil || 0, b.t + 3);
      u.mem.undyUntil = b.t + 3;
      b.emit({ k: 'mark', id: u.id, name: '이름 없는 불사', style: 'immortal' });
      return true;
    },
    ...thirst((b, u) => ((u.mem.undyUntil || 0) > b.t ? 0.35 : 0)),
  } }, true),
];

export const AUGS: Record<string, AugDef[]> = { oliver: OLIVER, kaburaya: KABURAYA, issac: ISSAC, juseong: JUSEONG, exile: EXILE };
export const ULTS_X: Record<string, UltDef> = {};
