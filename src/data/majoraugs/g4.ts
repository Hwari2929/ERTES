// 메이저 전용 증강 (기물별 14개 = 일반 12 + ★ 전설 2) · 궁극기가 없던 기물의 궁극기. 이 묶음이 맡은 기물만 채운다 (index.ts 가 합친다)
// 4묶음: 루스 (전용 증강 14개 새로) · 도노반 · 라르스 · 카이로 · 비앙카 · 필리스 · 에이든 (예전 스페셜 8개 + 6개, 궁극기 새로)
import type { Battle, CUnit, Hooks, UltDef } from '../../engine/combat';
import { ELEM_AMP } from '../../engine/combat';
import { type AugDef, type Effect, inc, red, vuln } from '../../engine/effects';
import { blinkTo, cleanse, corrode, every, fear, lineTargets, pct, skillHit, slow, summonsOf } from '../kit';
import { ROSTER_A } from '../rosterA';
import { cookPower } from '../tpl';
import { setSk, SUMMON_RT, uaug } from '../unitkit';

const mj = (owner: string, key: string, name: string, desc: string, effect: Effect, legend = false): AugDef =>
  ({ ...uaug(owner, `mj.${key}`, name, desc, effect), pool: 'special', ...(legend ? { legend: true } : {}) });

// ───────── 공용 헬퍼
/** 재발동 대기: sec 초에 1번 */
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
/** 부가 피해 (반격 · 추가타) */
const proc = (b: Battle, u: CUnit, t: CUnit, amt: number, elem: 'phys' | 'holy' | 'elec', kind: 'shoot' | 'strike' | 'tech') =>
  b.dealDamage(u, t, amt, { elem, tag: 'proc', kind });
/** 이 기물이 그 증강을 가졌는지 */
const hasAug = (u: CUnit, id: string) => !!u.src?.augments.some((a) => a.id === id);
/** 전투 기술 시전 중 표시 (mem.mjInSk = 1): 궁극기 · 다른 기술 피해와 구분해야 하는 증강용. 한 번만 감싼다 */
function flagSkill(u: CUnit) {
  const base = u.skill;
  if (u.mem.mjSkW || !base) return;
  u.mem.mjSkW = 1;
  u.skill = { ...base, cast(b, self) {
    self.mem.mjInSk = 1;
    try { return base.cast(b, self); } finally { self.mem.mjInSk = 0; }
  } };
}
/** 체력 비율이 가장 낮은 적 (대상 지정 가능, exclude 제외) */
const lowestFoe = (b: Battle, u: CUnit, exclude?: Set<CUnit>) => {
  const es = b.targetable(u).filter((e) => !exclude?.has(e));
  return es.length ? es.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a)) : null;
};
/** 궁극기 지속 효과: dur 초 동안 every 초마다 fn, 끝나면 end */
function channel(u: CUnit, dur: number, step: number, fn: (b: Battle, i: number) => void, end?: (b: Battle) => void) {
  let t = 0, acc = step, i = 0;
  const h: Hooks = {
    onTick(b, self, dt) {
      if (!h.onTick) return;
      t += dt; acc += dt;
      while (acc >= step && t <= dur + 1e-6) { acc -= step; if (self.alive) fn(b, i++); }
      if (t >= dur) { h.onTick = undefined; end?.(b); }
    },
  };
  u.hooks.push(h);
}

// ───────────────────────── 루스: 쌍권총 · 약탈 · 자기 기준의 '공평'
const RUS = {
  ship: 0.5, ship2: 0.25, ship2At: 0.5,
  escHp: 0.4, escCd: 8, escR: 2, escEva: 0.3, escDur: 3,
  feePer: 10, fee: 0.02, feeMax: 0.2,
  reloadCd: 2,
  fair: 0.5,
  lootCap: 5,
  hot: 0.25, hotDur: 3,
  first: 0.3, firstCharge: 0.15,
  twinCut: 0.3,
  capCharge: 0.4, capDur: 6, capAs: 0.4, capDmg: 0.25,
};
/** 루스 [탈출로 확보]: 적에게서 가장 먼 빈칸으로 (r칸 안) */
function backOff(b: Battle, u: CUnit, r: number) {
  const es = b.enemiesOf(u);
  if (!es.length) return false;
  const near = (x: number, y: number) => Math.min(...es.map((e) => Math.max(Math.abs(e.x - x), Math.abs(e.y - y))));
  let best: { x: number; y: number } | null = null, bs = near(u.x, u.y);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = u.x + dx, y = u.y + dy;
      if ((!dx && !dy) || !b.inBounds(x, y) || b.unitAt(x, y)) continue;
      const d = near(x, y);
      if (d > bs) { bs = d; best = { x, y }; }
    }
  if (!best) return false;
  u.px = u.x; u.py = u.y; u.x = best.x; u.y = best.y;
  u.moveDur = u.moveT = 0.25; u.mem.lastCell = -1;
  b.emit({ k: 'status', id: u.id, name: '탈출' });
  for (const h of u.hooks) h.onMove?.(b, u);
  return true;
}
const rus: AugDef[] = [
  mj('rus', 'double', '쌍권총 난사', '약탈 사격 타수 +1 (추가 사격은 60% 피해).', setSk((s) => { s.hits += 1; })),
  mj('rus', 'ap', '철갑탄', '약탈 사격 계수 +60%p, 방어도 관통 +30%p.', setSk((s) => { s.mult += 0.6; s.pen += 0.3; })),
  mj('rus', 'ship', '챙겨 나온 배', `전투 시작 시 최대 체력 ${pct(RUS.ship)} 보호막. 체력이 ${pct(RUS.ship2At)} 아래로 처음 떨어지면 최대 체력 ${pct(RUS.ship2)} 보호막을 한 번 더 얻는다.`, { hooks: {
    onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * RUS.ship); },
    onHurt(b, u) {
      if (u.mem.mjShip2 || b.hpPct(u) >= RUS.ship2At) return;
      u.mem.mjShip2 = 1;
      b.shield(u, b.S(u, 'maxHp') * RUS.ship2);
    },
  } }),
  mj('rus', 'escape', '탈출로 확보', `체력이 ${pct(RUS.escHp)} 아래로 떨어지면 적에게서 먼 빈칸으로 최대 ${RUS.escR}칸 물러나고 ${RUS.escDur}초간 회피 +${pct(RUS.escEva)}p (${RUS.escCd}초에 1번).`, { hooks: { onHurt(b, u) {
    if (b.hpPct(u) >= RUS.escHp || u.immobile || !icd(b, u, 'mjEsc', RUS.escCd)) return;
    backOff(b, u, RUS.escR);
    b.buff(u, u, 'rus.escape', RUS.escDur, { delta: { eva: RUS.escEva }, label: '탈출로' });
  } } }),
  mj('rus', 'fee', '계약금부터', `전투 시작 시 보유 크레딧 ${RUS.feePer}당 주는 피해 +${pct(RUS.fee)} (최대 +${pct(RUS.feeMax)}).`, { setup(u, _b, ctx) {
    const v = Math.min(RUS.feeMax, Math.floor((ctx.credits || 0) / RUS.feePer) * RUS.fee);
    if (v > 0) u.mods.push(inc('all', v));
  } }),
  mj('rus', 'reload', '빠른 손', `적을 처치하면 탄창을 가득 채우고 (재장전 중이면 바로 끝난다) 약탈 사격 쿨다운 -${RUS.reloadCd}초.`, { hooks: { onKill(_b, u) {
    if (u.weapon?.kind === 'mag') { u.ammo = u.weapon.mag || 1; u.reloadT = 0; }
    u.cd = Math.max(0, u.cd - RUS.reloadCd);
  } } }),
  mj('rus', 'fair', '앞 반, 뒷 반', `약탈 사격을 쏜 뒤 가장 가까운 적에게도 같은 사격을 ${pct(RUS.fair)} 피해로 쏜다 (적이 1명이면 쏘지 않는다).`, { hooks: { onSkill(b, u) {
    const es = b.targetable(u);
    if (es.length < 2) return;
    const far = es.reduce((a, c) => (b.dist(u, c) > b.dist(u, a) ? c : a));
    const near = es.filter((e) => e !== far).reduce((a, c) => (b.dist(u, c) < b.dist(u, a) ? c : a));
    b.emit({ k: 'atk', from: u.id, to: near.id, elem: 'phys', ranged: true });
    b.dealDamage(u, near, b.P(u, 'shoot') * u.sk.mult * RUS.fair, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: true, pen: u.sk.pen, critBonus: u.sk.crit });
  } } }),
  mj('rus', 'blacksail', '검은 돛', '약탈 사격에 맞은 적이 50% 확률로 1.5초 공포.', setSk((s) => { s.fear = 1.5; s.fearChance = 0.5; })),
  mj('rus', 'plunder', '약탈 수법', `[약탈자] 크레딧을 챙기는 처치 횟수 상한 3회 → ${RUS.lootCap}회 (전투당).`, { hooks: { onKill(_b, u) {
    u.mem.mjLootK = (u.mem.mjLootK || 0) + 1;
    if (u.mem.mjLootK > 3 && u.mem.mjLootK <= RUS.lootCap && (u.mem.g_loot || 0) < RUS.lootCap) u.mem.g_loot = (u.mem.g_loot || 0) + 1;
  } } }),
  mj('rus', 'aim', '두 손 조준', '사거리 +1, 치명타 확률 +10%p.', { stats: { range: 1, crit: 0.1 } }),
  mj('rus', 'hot', '재장전 직후', `재장전이 끝나면 ${RUS.hotDur}초간 치명타 확률 +${pct(RUS.hot)}p, 공격 속도 +${pct(RUS.hot)}.`, { hooks: { onTick(b, u) {
    if (u.reloadT > 0) { u.mem.mjRl = 1; return; }
    if (!u.mem.mjRl) return;
    u.mem.mjRl = 0;
    b.buff(u, u, 'rus.hot', RUS.hotDur, { delta: { crit: RUS.hot, atkSpd: RUS.hot }, label: '재장전 직후' });
  } } }),
  mj('rus', 'first', '선제 약탈', `전투 시작 시 궁극기 게이지 +${pct(RUS.first)}p, 궁극기 충전 +${pct(RUS.firstCharge)}.`, {
    stats: { ultCharge: RUS.firstCharge }, setup: (u) => { u.mem.ultStart = (u.mem.ultStart || 0) + RUS.first; },
  }),
  mj('rus', 'twin', '양손 난사', `기본 공격 피해 -${pct(RUS.twinCut)}. 대신 기본 공격마다 사거리 안의 다른 적 1명 (없으면 같은 적)에게 한 발 더 쏜다 (같은 피해). 탄창 2배.`, {
    mods: [inc('basic', -RUS.twinCut)],
    setup: (u) => { if (u.weapon?.kind === 'mag') u.weapon = { ...u.weapon, mag: (u.weapon.mag || 1) * 2 }; },
    hooks: { onBasic(b, u, t) {
      const range = b.S(u, 'range');
      const others = b.targetable(u).filter((e) => e !== t && b.dist(u, e) <= range);
      const v = others.length ? b.rng.pick(others) : t.alive ? t : null;
      if (!v) return;
      b.emit({ k: 'atk', from: u.id, to: v.id, elem: u.atk.elem, ranged: true });
      b.dealDamage(u, v, b.S(u, 'shoot') * (u.weapon?.mult ?? 1), { elem: u.atk.elem, tag: 'basic', kind: 'shoot', canMiss: true });
    } },
  }, true),
  mj('rus', 'captain', '함장의 몫', `궁극기 충전 +${pct(RUS.capCharge)}. 궁극기 [약탈 개시]를 쓰면 ${RUS.capDur}초간 공격 속도 +${pct(RUS.capAs)}, 주는 피해 +${pct(RUS.capDmg)}, 약탈 사격 쿨다운 초기화.`, {
    stats: { ultCharge: RUS.capCharge },
    hooks: { onTick(b, u) {
      const g = u.ultG || 0;
      if ((u.mem.mjPrevG || 0) >= 1 && g < 1) {
        b.buff(u, u, 'rus.captain', RUS.capDur, { delta: { atkSpd: RUS.capAs }, mods: [inc('all', RUS.capDmg)], label: '함장의 몫' });
        u.cd = 0;
      }
      u.mem.mjPrevG = g;
    } },
  }, true),
];

// ───────────────────────── 도노반: 자안의 사수 · 까악이 · 소시민 귀차니즘
const DON = { crowBond: 0.25, crowShot: 1.5, chain: 0.6, quiet: 2, quietDmg: 0.4, feedCrit: 0.04, feedCd: 0.08, feedMax: 5, red: 0.6, hack: 0.3, hackDur: 4, ult: 1.8, ultN: 4, ultCrow: 0.8 };
const donovan: AugDef[] = [
  mj('donovan', 'livibold', '리비볼드 경', `까악이 상속률 +${pct(DON.crowBond)}p. 자안의 사수를 쓰면 까악이가 그 대상에게 까악이 사격 위력 ${pct(DON.crowShot)} 전기 피해.`, {
    setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + DON.crowBond; },
    hooks: { onSkill(b, u) {
      for (const d of summonsOf(b, u)) {
        const t = d.target?.alive ? d.target : u.target?.alive ? u.target : null;
        if (!t || b.sideOf(t) === b.sideOf(d)) continue;
        b.emit({ k: 'atk', from: d.id, to: t.id, elem: 'elec', ranged: true });
        b.dealDamage(d, t, b.S(d, 'shoot') * DON.crowShot, { elem: 'elec', tag: 'skill', kind: 'shoot', canMiss: false });
      }
    } },
  }),
  mj('donovan', 'chain', '연쇄 급소', `자안의 사수로 적을 처치하면 다음으로 체력 비율이 가장 낮은 적에게 파고들어 같은 기술을 ${pct(DON.chain)} 피해로 1번 더 쓴다 (시전마다 1번).`, {
    setup: (u) => flagSkill(u),
    hooks: {
      // 처치 판정은 onKill 에서 (onDeal 시점에는 아직 r.killed 가 정해지지 않는다)
      onKill(b, u, t) {
        if (!u.mem.mjInSk || u.mem.mjChained) return;
        u.mem.mjChained = 1;
        const e = lowestFoe(b, u, new Set([t]));
        if (!e) return;
        blinkTo(b, u, e);
        for (const d of summonsOf(b, u)) d.target = e;
        b.dealDamage(u, e, b.P(u, 'tech') * u.sk.mult * DON.chain, { elem: 'phys', tag: 'skill', kind: 'tech', canMiss: false, critBonus: u.sk.crit });
      },
      onSkill(_b, u) { u.mem.mjChained = 0; },
    },
  }),
  mj('donovan', 'quiet', '조용한 퇴근', `자안의 사수를 쓰면 ${DON.quiet}초간 은신 (대상으로 지정되지 않음). 은신 중 기본 공격 피해 +${pct(DON.quietDmg)}.`, { hooks: {
    onSkill(b, u) { b.buff(u, u, 'stealth', DON.quiet, { label: '은신' }); },
    dmgMult: (b, u, _t, o) => (o.tag === 'basic' && b.hidden(u) ? 1 + DON.quietDmg : 1),
  } }),
  mj('donovan', 'feed', '사료값', `적을 처치할 때마다 이번 전투 동안 치명타 확률 +${pct(DON.feedCrit)}p, 치명타 피해 +${pct(DON.feedCd)}p (최대 ${DON.feedMax}회).`, { hooks: { onKill(_b, u) {
    if ((u.mem.mjFeed || 0) >= DON.feedMax) return;
    u.mem.mjFeed = (u.mem.mjFeed || 0) + 1;
    u.st.crit += DON.feedCrit; u.st.critDmg += DON.feedCd;
  } } }),
  mj('donovan', 'redeye', '붉은 급소', `자안의 사수가 반드시 치명타로 터진다. 자안의 사수 피해가 대상이 잃은 체력 1%당 +1% (최대 +${pct(DON.red)}).`, {
    setup: (u) => { flagSkill(u); u.sk.crit = (u.sk.crit || 0) + 1; },
    hooks: { dmgMult: (b, u, t, o) => (u.mem.mjInSk && o.tag === 'skill' ? 1 + Math.min(DON.red, Math.max(0, 1 - b.hpPct(t))) : 1) },
  }, true),
  mj('donovan', 'flock', '까마귀 편대', `까악이 1마리가 더 따라온다 (추가 소환물 상속률). 까악이의 공격에 맞은 적은 ${DON.hackDur}초간 [해킹]: 받는 치명타 피해 +${pct(DON.hack)}p.`, {
    setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; },
    hooks: { onTick(b, u) {
      if (u.mem.mjFlock) return;
      u.mem.mjFlock = 1;
      for (const d of summonsOf(b, u)) d.hooks.push({ onDeal(bb, self, t, r) {
        if (r.amount > 0 && t.alive && bb.sideOf(t) !== bb.sideOf(self)) bb.applyStatus(self, t, { type: 'buff', key: 'donovan.hack', dur: DON.hackDur, critVuln: DON.hack, label: '해킹' });
      } });
    } },
  }, true),
];

// ───────────────────────── 라르스: 직접 싸우지 않는다 · 사과 대신 보상 · 정시 퇴근
const LARS = { otAt: 18, otAs: 0.3, otDmg: 0.2, insWait: 4, insMax: 2, insHp: 0.5, armor: 0.3, armorDur: 4, cdPlus: 1.5, cdCut: 2, charm: 3, bossSlow: 0.4, life: 0.5, lifeDmg: 0.2, ultDur: 6, ultDurSolo: 8, ultWeak: 0.25, ultVuln: 0.15, ultHit: 2.5 };
const larsGuard = () => ROSTER_A.find((x) => x.id === 'lars')?.summon;
const larsDeal = (b: Battle, u: CUnit) => b.units.find((e) => e.alive && e.side !== u.side && e.id === u.mem.dealId) || null;
const lars: AugDef[] = [
  mj('lars', 'overtime', '야근 수당', `전투 ${LARS.otAt}초부터 경호원 공격 속도 +${pct(LARS.otAs)}, 주는 피해 +${pct(LARS.otDmg)}. 하청과 함께면 무작위 아군 기물 2명에게.`, { hooks: { onTick(b, u) {
    if (b.t < LARS.otAt || !b.enemiesOf(u).length) return;
    const give = (a: CUnit) => b.buff(u, a, 'lars.ot', 999, { delta: { atkSpd: LARS.otAs }, mods: [inc('all', LARS.otDmg)], label: '야근 수당' });
    if (u.mem.noSummon) {
      if (u.mem.mjOT) return;
      u.mem.mjOT = 1;
      const pool = b.alliesOf(u, false).filter((a) => !a.isSummon);
      for (const a of b.rng.sample(pool, 2)) give(a);
      return;
    }
    for (const g of summonsOf(b, u)) if (!g.statuses.some((s) => s.key === 'lars.ot')) give(g);
  } } }),
  mj('lars', 'insurance', '보험 처리', `경호원이 쓰러지면 ${LARS.insWait}초 뒤 체력 ${pct(LARS.insHp)}인 경호원을 새로 데려온다 (첫 경호원 능력치, 전투당 ${LARS.insMax}번).`, { hooks: { onAllyDeath(b, u, dead) {
    if (!dead.isSummon || dead.owner !== u || (u.mem.mjIns || 0) >= LARS.insMax) return;
    u.mem.mjIns = (u.mem.mjIns || 0) + 1;
    b.later(LARS.insWait, () => {
      const sd = larsGuard();
      if (!u.alive || b.over || !sd) return;
      const g = SUMMON_RT.make?.(b, u, sd);
      if (!g) return;
      g.hp = b.S(g, 'maxHp') * LARS.insHp;
      b.emit({ k: 'status', id: g.id, name: '보험 처리' });
    });
  } } }),
  mj('lars', 'clause', '세부 조항', `거래 대상 적이 ${LARS.armorDur}초간 방어도 -${pct(LARS.armor)}, 기술 쿨다운 +${LARS.cdPlus}초.`, { hooks: { onSkill(b, u) {
    const t = larsDeal(b, u);
    if (!t) return;
    corrode(b, u, t, 1 - LARS.armor, LARS.armorDur);
    if (t.skill) t.cd += LARS.cdPlus;
  } } }),
  mj('lars', 'time', '시간은 비용', `거래 제안 쿨다운 -${LARS.cdCut}초. 첫 거래 제안은 전투 시작 직후.`, {
    setup: (u) => { u.cdMax = Math.max(1, u.cdMax - LARS.cdCut); },
    hooks: { onStart(_b, u) { u.cd = 0; } },
  }),
  mj('lars', 'takeover', '적대적 인수', `거래 대상 적을 ${LARS.charm}초간 매혹해 아군 편으로 싸우게 한다 (정예는 절반). 매혹되지 않는 보스는 대신 ${LARS.charm}초간 공격 속도 · 이동 속도 -${pct(LARS.bossSlow)}.`, { hooks: { onSkill(b, u) {
    const t = larsDeal(b, u);
    if (!t) return;
    if (t.isBoss) { slow(b, u, t, LARS.bossSlow, LARS.charm); return; }
    b.applyStatus(u, t, { type: 'buff', key: 'charm', dur: LARS.charm, label: '매혹' });
  } } }, true),
  mj('lars', 'lifetime', '종신 계약', `경호 계약 보호막 +${pct(LARS.life)}. 아군 전원 (경호원 포함)은 보호막이 남아 있는 동안 주는 피해 +${pct(LARS.lifeDmg)}.`, {
    setup: (u) => { u.sk.shield = (u.sk.shield ?? 1.5) * (1 + LARS.life); },
    hooks: { onTick(b, u) {
      for (const a of b.alliesOf(u)) {
        if (a.mem.mjLife) continue;
        a.mem.mjLife = 1;
        a.hooks.push({ dmgMult: (_bb, self) => (self.shield > 0 ? 1 + LARS.lifeDmg : 1) });
      }
    } },
  }, true),
];

// ───────────────────────── 카이로: 저격 · 칵테일 · 예술
const KAI = { pen: 0.5, crit: 0.15, keep: 3, dart: 1.2, patron: 0.15, pierce: 0.7, share: 0.5, ult: 4.5, ultN: 3, ultCrit: 0.3, ultPen: 0.5 };
/** 지금 저격 중인지 (특성 [기다림의 미학]은 스택이 다 찬 상태에서 쏘고 나서 스택을 비운다) */
const sniping = (u: CUnit) => (u.mem.wait ?? 0) >= u.sk.need;
const kairo: AugDef[] = [
  mj('kairo', 'wind', '풍향 계산', `저격의 방어도 관통 ${pct(KAI.pen)} (인내와 함께면 100% 그대로), 저격 치명타 확률 +${pct(KAI.crit)}p.`, setSk((s) => { s.snipePen = Math.max(s.snipePen || 0, KAI.pen); s.snipeCrit += KAI.crit; })),
  mj('kairo', 'next', '다음 표적', `저격으로 적을 처치하면 저격 뒤 [기다림의 미학] ${KAI.keep}스택이 남는다 (저격마다 1번).`, { hooks: {
    // 저격은 스택이 다 찬 동안 한 번에 쏘고 끝에 스택을 비운다: 그 사이의 처치 = 저격 처치 (라스트 오더 처형 포함)
    onKill(_b, u) {
      if (u.mem.mjNext || !sniping(u)) return;
      u.mem.mjNext = 1;
      u.sk.keep = (u.sk.keep || 0) + KAI.keep;
    },
    onTick(_b, u) {
      if (!u.mem.mjNext || sniping(u)) return;
      u.mem.mjNext = 0;
      u.sk.keep -= KAI.keep;
    },
  } }),
  mj('kairo', 'dart', '다트 한 판', `칵테일을 낼 때마다 체력 비율이 가장 낮은 적에게 다트를 던져 사격 위력 ${pct(KAI.dart)} 물리 피해.`, { hooks: { onSkill(b, u) {
    const e = lowestFoe(b, u);
    if (!e) return;
    b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
    b.dealDamage(u, e, b.S(u, 'shoot') * KAI.dart, { elem: 'phys', tag: 'proc', kind: 'shoot', canMiss: true });
  } } }),
  mj('kairo', 'patron', '후원 계약', `칵테일을 받은 아군은 칵테일이 남아 있는 동안 주는 피해 +${pct(KAI.patron)}.`, { hooks: { onInflict(_b, _u, _t, s) {
    if (s.key === 'kairo.cocktail') s.mods = [inc('all', KAI.patron)];
  } } }),
  mj('kairo', 'pierce', '꿰뚫는 예술', `저격 (더블 샷 포함)이 대상 방향 직선 위의 다른 적 모두를 꿰뚫어 저격 피해의 ${pct(KAI.pierce)}를 준다.`, { hooks: { onDeal(b, u, t, _r, o) {
    if (u.mem.mjPierce || o.tag !== 'skill' || o.kind !== 'shoot' || !sniping(u)) return;
    u.mem.mjPierce = 1;
    try {
      const p = u.sk;
      for (const e of lineTargets(b, u, t)) {
        if (e === t || !e.alive) continue;
        b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
        skillHit(b, u, e, 'shoot', p.snipe * KAI.pierce, 'phys', { critBonus: p.snipeCrit, noMiss: true, pen: p.snipePen || 0 });
      }
    } finally { u.mem.mjPierce = 0; }
  } } }, true),
  mj('kairo', 'treat', '오늘은 내가 사지', `칵테일이 다른 아군 전원에게도 ${pct(KAI.share)} 효과로 나간다 (보호막 · 치명타 · 시그니처의 쿨다운 감소).`, { setup: (u) => {
    const base = u.skill;
    if (!base) return;
    u.skill = { ...base, tag: () => '아군 전원 보호막 · 치명 강화', cast(b, self) {
      const first = b.lowestHpAlly(self);
      if (!base.cast(b, self)) return false;
      const p = self.sk, k = cookPower(self) * KAI.share;
      for (const a of b.alliesOf(self)) {
        if (a === first) continue;
        if (p.shield) b.shield(a, b.P(self, 'tech') * p.shield * k);
        if (p.sigCd && a.skill) a.cd -= p.sigCd * KAI.share;
        b.buff(self, a, 'kairo.cocktail', p.dur, { delta: { crit: p.crit * k }, label: '칵테일' });
      }
      return true;
    } };
  } }, true),
];

// ───────────────────────── 비앙카: 치유 탄환 · 베헤모스 · 효율
const BIA = { heal: 0.15, bite: 0.2, biteDur: 4, red: 0.2, genes: 3, elite: 0.2, apex: 0.08, apexMax: 10, apexHeal: 0.15, ult: 1.6, ultDur: 6, ultDmg: 0.6, ultAs: 0.4 };
/** 최상위 포식자: 처치마다 최대 체력 · 피해 +8% (최대 10회) + 최대 체력 15% 회복 */
function apexKill(b: Battle, x: CUnit) {
  if ((x.mem.mjApex || 0) < BIA.apexMax) {
    x.mem.mjApex = (x.mem.mjApex || 0) + 1;
    x.mem.mjApexBase ??= x.st.maxHp;
    const add = x.mem.mjApexBase * BIA.apex;
    x.st.maxHp += add; x.hp += add;
    x.mods.push(inc('all', BIA.apex));
  }
  b.heal(x, x, b.S(x, 'maxHp') * BIA.apexHeal, true);
}
const eliteMult = (_b: Battle, _u: CUnit, t: CUnit) => (t.isBoss || t.elite ? 1 + BIA.elite : 1);
const bianca: AugDef[] = [
  mj('bianca', 'wash', '손 7번 씻기', `치유 탄환이 해로운 상태이상을 없애고, 회복량 +${pct(BIA.heal)}.`, setSk((s) => { s.cleanse = 1; s.heal *= 1 + BIA.heal; })),
  mj('bianca', 'bite', '베헤모스, 물어', `비앙카를 공격한 적을 베헤모스가 곧바로 노리고, 그 적은 ${BIA.biteDur}초간 받는 피해 +${pct(BIA.bite)} (1초에 1번).`, { hooks: { onHurt(b, u, src, r, o) {
    if (b.sideOf(src) === b.sideOf(u) || !src.alive || r.amount <= 0 || o.tag === 'dot' || !icd(b, u, 'mjBite', 1)) return;
    for (const d of summonsOf(b, u)) d.target = src;
    b.applyStatus(u, src, { type: 'buff', key: 'bianca.bite', dur: BIA.biteDur, taken: [vuln('all', BIA.bite)], label: '물어' });
  } } }),
  mj('bianca', 'rx', '처방 준수', `치유 탄환을 맞은 아군이 4초간 받는 피해 -${pct(BIA.red)}.`, setSk((s) => { s.red = Math.max(s.red || 0, BIA.red); })),
  mj('bianca', 'specimen', '미확인 표본', `정예 · 보스가 쓰러지면 유전 물질 ${BIA.genes}개를 확정으로 수집한다. 비앙카와 베헤모스가 정예 · 보스에게 주는 피해 +${pct(BIA.elite)}.`, { hooks: {
    onAnyDeath(_b, u, dead) { if (dead.side !== u.side && (dead.isBoss || dead.elite)) u.mem.g_genes = (u.mem.g_genes || 0) + BIA.genes; },
    dmgMult: eliteMult,
    onTick(b, u) {
      if (u.mem.mjSpec) return;
      u.mem.mjSpec = 1;
      for (const d of summonsOf(b, u)) d.hooks.push({ dmgMult: eliteMult });
    },
  } }),
  mj('bianca', 'apex', '최상위 포식자', `베헤모스가 적을 처치할 때마다 최대 체력 +${pct(BIA.apex)}, 주는 피해 +${pct(BIA.apex)} (전투당 최대 ${BIA.apexMax}회)이고 최대 체력 ${pct(BIA.apexHeal)} 회복. 표본 회수와 함께면 비앙카가 처치할 때 비앙카에게.`, { hooks: {
    onKill(b, u) { if (u.mem.sample) apexKill(b, u); },
    onTick(b, u) {
      if (u.mem.mjApexInit) return;
      u.mem.mjApexInit = 1;
      for (const d of summonsOf(b, u)) d.hooks.push({ onKill(bb, self) { apexKill(bb, self); } });
    },
  } }, true),
  mj('bianca', 'triage', '트리아지', '치유 탄환이 두 번째로 체력 비율이 낮은 아군에게도 같은 회복 · 보호막을 준다. 비앙카의 회복이 최대 체력을 넘치면 넘친 양만큼 보호막을 준다.', {
    setup: (u) => {
      const base = u.skill;
      if (!base) return;
      u.skill = { ...base, cast(b, self) {
        const order = b.alliesOf(self).slice().sort((a, c) => b.hpPct(a) - b.hpPct(c));
        if (!base.cast(b, self)) return false;
        const second = order[1];
        if (second?.alive) {
          const p = self.sk;
          if (p.heal) b.heal(self, second, b.P(self, 'tech') * p.heal);
          if (p.shield) b.shield(second, b.P(self, 'tech') * p.shield);
          if (p.cleanse) cleanse(second);
        }
        return true;
      } };
    },
    hooks: { onHealDone(b, _u, t, _amt, over) { if (over > 0) b.shield(t, over); } },
  }, true),
];

// ───────────────────────── 필리스: 균열 · 땡땡이 · 긴급 조달
const PHY = { cherry: 6, cherryAs: 0.25, cherryDur: 4, restAt: 0.3, rest: 3, restHps: 0.05, armor: 0.3, armorDur: 4, boom: 0.2, boomDmg: 0.8, fear: 1.5, fearChance: 0.6, chainN: 2, chain: 0.7, ult: 1.1, ultDur: 6, ultStep: 0.6 };
const phyllis: AugDef[] = [
  mj('phyllis', 'cherry', '체리 배송', `${PHY.cherry}초마다 무작위 아군 기물 1명에게 ${PHY.cherryDur}초간 공격 속도 +${pct(PHY.cherryAs)}.`, { hooks: { onTick(b, u, dt) {
    if (!every(u, 'mjCherry', dt, PHY.cherry) || !b.enemiesOf(u).length) return;
    const as = b.alliesOf(u).filter((a) => !a.isSummon);
    if (as.length) b.buff(u, b.rng.pick(as), 'phyllis.cherry', PHY.cherryDur, { delta: { atkSpd: PHY.cherryAs }, label: '체리 배송' });
  } } }),
  mj('phyllis', 'rest', '나 쉬러 간다-', `체력이 ${pct(PHY.restAt)} 아래로 처음 떨어지면 ${PHY.rest}초간 은신하고 초당 최대 체력 ${pct(PHY.restHps)} 회복 (전투당 1번).`, { hooks: { onHurt(b, u) {
    if (u.mem.mjRest || b.hpPct(u) >= PHY.restAt) return;
    u.mem.mjRest = 1;
    b.buff(u, u, 'stealth', PHY.rest, { label: '은신' });
    b.buff(u, u, 'phyllis.rest', PHY.rest, { hps: b.S(u, 'maxHp') * PHY.restHps, label: '휴식' });
  } } }),
  mj('phyllis', 'disasm', '분해 · 조립', `피니쉬에 맞은 적이 ${PHY.armorDur}초간 방어도 -${pct(PHY.armor)}. ${pct(PHY.boom)} 확률로 렌치가 폭발해 대상 주변 1칸 적에게 기술 위력 ${pct(PHY.boomDmg)} 신성 피해.`, { hooks: { onBasic(b, u, t, r) {
    if (!u.mem.finished || r.amount <= 0) return;
    if (t.alive) corrode(b, u, t, 1 - PHY.armor, PHY.armorDur);
    if (!b.rng.chance(PHY.boom)) return;
    b.fx(t.x, t.y, 1, 'holy');
    for (const e of b.around(t, 1, b.enemiesOf(u))) proc(b, u, e, b.P(u, 'tech') * PHY.boomDmg, 'holy', 'tech');
  } } }),
  mj('phyllis', 'boo', '깜짝 놀랐지-?', `균열 도약에 맞은 적이 ${pct(PHY.fearChance)} 확률로 ${PHY.fear}초 공포.`, setSk((s) => { s.fear = PHY.fear; s.fearChance = PHY.fearChance; })),
  mj('phyllis', 'chainrift', '균열 연쇄', `균열 도약 뒤 다른 적 중 체력 비율이 가장 낮은 적에게 차례로 ${PHY.chainN}번 더 도약해 균열 도약 피해의 ${pct(PHY.chain)}를 준다 (도약마다 다른 적). 명계 출장과 함께면 발동하지 않는다.`, { hooks: { onSkill(b, u) {
    if (hasAug(u, 'phyllis.sp.underworld')) return;
    const hit = new Set<CUnit>(u.target ? [u.target] : []);
    for (let i = 0; i < PHY.chainN; i++) {
      const e = lowestFoe(b, u, hit);
      if (!e) break;
      hit.add(e);
      blinkTo(b, u, e);
      b.dealDamage(u, e, b.P(u, 'tech') * u.sk.mult * PHY.chain, { elem: 'holy', tag: 'skill', kind: 'tech', canMiss: false });
    }
  } } }, true),
  mj('phyllis', 'express', '하데스 특급', '[물자 전송] 주기 6초 → 3초. 전투 시작 직후 1번 바로 전송한다.', { hooks: {
    onStart(_b, u) { u.mem.supplyT = 0; },
    onTick(_b, u, dt) { if (u.mem.supplyT !== undefined) u.mem.supplyT -= dt; }, // 특성 [균열 회피]의 물자 전송 타이머를 2배로 돌린다
  } }, true),
];

// ───────────────────────── 에이든: 바텐더 · 고양이 형태 · 액체 금속
const AID = { shield: 0.25, vuln: 0.15, menu: 1.5, serve: 1.5, serveCd: 3, eva: 0.15, counter: 1.2, counterCd: 0.3, metalMax: 10, metalArmor: 40, metalRed: 0.02, metalHit: 0.3, metalCd: 0.3, ult: 2.6, ultFear: 1.5, ultFearChance: 0.6, ultTaunt: 2, ultDur: 5, ultRed: 0.3 };
/** 액체 금속 장갑 중첩 반영 */
function metal(b: Battle, u: CUnit, n: number) {
  u.mem.mjMetal = n;
  let s = u.statuses.find((x) => x.key === 'aiden.metal');
  if (!s) { b.buff(u, u, 'aiden.metal', 9999, { label: '액체 금속' }); s = u.statuses.find((x) => x.key === 'aiden.metal'); }
  if (!s) return;
  s.stacks = n;
  s.delta = { armor: AID.metalArmor * n };
  s.taken = [red('all', AID.metalRed * n)];
}
/** 고양이 형태 (인간 형태면 [집중]) — rework.ts 특성과 같은 키 */
function catForm(b: Battle, u: CUnit, dur: number) {
  if (u.mem.noCat) b.buff(u, u, 'aiden.cat', dur, { label: '집중' });
  else b.buff(u, u, 'aiden.cat', dur, { delta: { eva: 0.15, atkSpd: 0.3 }, label: '고양이' });
}
const aiden: AugDef[] = [
  mj('aiden', 'glass', '잔 닦기', `체력이 35% 아래로 떨어져 후방으로 물러날 때 (10초에 1번) 최대 체력 ${pct(AID.shield)} 보호막을 얻고 해로운 상태이상을 모두 없앤다.`, { hooks: { onTick(b, u) {
    if (!u.mem.aidenRet || u.mem.aidenRet === u.mem.mjRetSeen) return;
    u.mem.mjRetSeen = u.mem.aidenRet;
    b.shield(u, b.S(u, 'maxHp') * AID.shield);
    cleanse(u);
  } } }),
  mj('aiden', 'tip', '정보 하나만', `액체 금속 변형에 맞은 적이 4초간 받는 피해 +${pct(AID.vuln)}.`, setSk((s) => { s.vuln = Math.max(s.vuln || 0, AID.vuln); })),
  mj('aiden', 'menu', '숨은 메뉴', `피니쉬마다 액체 금속 변형 쿨다운 -${AID.menu}초.`, { hooks: { onBasic(_b, u) { if (u.mem.finished) u.cd = Math.max(0, u.cd - AID.menu); } } }),
  mj('aiden', 'serve', '손님 응대', `주변 1칸 아군을 공격한 적을 ${AID.serve}초간 도발한다 (적마다 ${AID.serveCd}초에 1번).`, { hooks: { onAllyHurt(b, u, ally, src, r) {
    if (r.amount <= 0 || !src.alive || b.sideOf(src) === b.sideOf(u) || b.dist(u, ally) > 1) return;
    const key = `mjServe${u.id}`;
    if ((src.mem[key] || 0) > b.t) return;
    src.mem[key] = b.t + AID.serveCd;
    b.provoke(src, u, AID.serve);
  } } }),
  mj('aiden', 'catking', '고양이 왕', `고양이 형태의 회피 보너스 +15%p → +${pct(0.15 + AID.eva)}p. 고양이 형태에서 회피하면 공격자에게 타격 위력 ${pct(AID.counter)} 반격 (${AID.counterCd}초에 1번). 인간 형태와 함께면 반격만 (집중 상태에서).`, { hooks: {
    onInflict(_b, u, t, s) { if (s.key === 'aiden.cat' && t === u && s.delta?.eva) s.delta = { ...s.delta, eva: s.delta.eva + AID.eva }; },
    onEvade(b, u, src) {
      if (!src.alive || !b.has(u, 'buff', 'aiden.cat') || !icd(b, u, 'mjCatK', AID.counterCd)) return;
      proc(b, u, src, b.S(u, 'strike') * AID.counter, 'phys', 'strike');
    },
  } }, true),
  mj('aiden', 'metal', '액체 금속 장갑', `피해를 받을 때마다 액체 금속 1중첩 (${AID.metalCd}초에 1번, 최대 ${AID.metalMax}중첩): 중첩당 방어도 +${AID.metalArmor}, 피해량 경감 +${pct(AID.metalRed)}. 피니쉬가 중첩을 모두 써서 대상에게 중첩당 타격 위력 ${pct(AID.metalHit)} 물리 피해.`, { hooks: {
    onHurt(b, u, src, r, o) {
      if (r.amount <= 0 || o.tag === 'dot' || b.sideOf(src) === b.sideOf(u) || (u.mem.mjMetal || 0) >= AID.metalMax || !icd(b, u, 'mjMetalT', AID.metalCd)) return;
      metal(b, u, (u.mem.mjMetal || 0) + 1);
    },
    onBasic(b, u, t) {
      const n = u.mem.mjMetal || 0;
      if (!u.mem.finished || !n) return;
      metal(b, u, 0);
      if (t.alive) proc(b, u, t, b.S(u, 'strike') * AID.metalHit * n, 'phys', 'strike');
    },
  } }, true),
];

export const AUGS: Record<string, AugDef[]> = { rus, donovan, lars, kairo, bianca, phyllis, aiden };

// ───────────────────────── 궁극기 (루스는 기본 궁극기 [약탈 개시]를 그대로 쓴다)
export const ULTS_X: Record<string, UltDef> = {
  donovan: {
    id: 'donovan', name: '밤까마귀 사냥', charge: 1.0, line: '빨리 끝내자. 저녁 메뉴 아직 못 정했어.',
    brief: '가장 다친 적들에게 차례로 파고들어 치명타를 노리고, 까악이도 함께 공격합니다.',
    text: `체력 비율이 가장 낮은 적부터 최대 ${DON.ultN}명에게 차례로 이동해 각각 [pw:tech:${DON.ult}:phys] 피해를 가합니다.\n이 공격은 치명타 확률이 [pv:1] 상승 적용됩니다.\n까악이가 같은 대상마다 까악이 사격 위력의 ${pct(DON.ultCrow * ELEM_AMP)} [el:elec] 피해를 가합니다.`,
    desc: `체력 비율이 가장 낮은 적부터 최대 ${DON.ultN}명에게 차례로 파고들어 기술 위력 ${pct(DON.ult)} 물리 피해 (치명타 확정). 까악이도 그 대상들에게 까악이 사격 위력 ${pct(DON.ultCrow)} 전기 피해.`,
    theme: { pat: 'moon', c1: '#e03a4a', c2: '#0e0c16', txt: 'glitch' },
    cast(b, u) {
      const es = b.targetable(u).sort((a, c) => b.hpPct(a) - b.hpPct(c)).slice(0, DON.ultN);
      if (!es.length) return false;
      for (const e of es) {
        if (!e.alive || !u.alive) continue;
        blinkTo(b, u, e);
        b.dealDamage(u, e, b.P(u, 'tech') * DON.ult, { elem: 'phys', tag: 'skill', kind: 'tech', canMiss: false, critBonus: 1 });
        for (const d of summonsOf(b, u)) {
          if (!e.alive) break;
          b.emit({ k: 'atk', from: d.id, to: e.id, elem: 'elec', ranged: true });
          b.dealDamage(d, e, b.S(d, 'shoot') * DON.ultCrow, { elem: 'elec', tag: 'skill', kind: 'shoot', canMiss: false });
        }
      }
      return true;
    },
  },
  lars: {
    id: 'lars', name: '최종 제안', charge: 1.0, line: '17시 58분이군요. 2분 안에 정리하죠.',
    brief: '모든 적을 잠시 약하게 만들고, 경호원들이 가장 튼튼한 적을 덮칩니다.',
    text: `적 전체에게 [s:${LARS.ultDur}]간 대상이 가하는 피해를 [pv:${LARS.ultWeak}] 감소시키고, 대상이 받는 피해를 [pv:${LARS.ultVuln}] 증가시킵니다.\n경호원이 없으면 이 효과가 [s:${LARS.ultDurSolo}] 지속됩니다.\n경호원 전원이 최대 체력이 가장 높은 적에게 이동해 각각 경호원 타격 위력의 ${pct(LARS.ultHit)} [el:phys] 피해를 가합니다.`,
    desc: `모든 적에게 ${LARS.ultDur}초간 [최종 제안]: 주는 피해 -${pct(LARS.ultWeak)}p, 받는 피해 +${pct(LARS.ultVuln)}p. 경호원 전원이 최대 체력이 가장 높은 적에게 달려들어 경호원 타격 위력 ${pct(LARS.ultHit)} 물리 피해. 경호원이 없으면 [최종 제안]이 ${LARS.ultDurSolo}초.`,
    theme: { pat: 'form', c1: '#d4a83a', c2: '#16161c', txt: 'stamp' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      const guards = summonsOf(b, u);
      const dur = guards.length ? LARS.ultDur : LARS.ultDurSolo;
      for (const e of es) b.applyStatus(u, e, { type: 'buff', key: 'lars.final', dur, mods: [inc('all', -LARS.ultWeak)], taken: [vuln('all', LARS.ultVuln)], label: '최종 제안' });
      const ts = b.targetable(u);
      if (!ts.length) return true;
      const t = ts.reduce((a, c) => (b.S(c, 'maxHp') > b.S(a, 'maxHp') ? c : a));
      for (const g of guards) {
        if (!t.alive) break;
        if (b.dist(g, t) > 1) blinkTo(b, g, t);
        g.target = t;
        b.dealDamage(g, t, b.S(g, 'strike') * LARS.ultHit, { elem: 'phys', tag: 'skill', kind: 'strike', canMiss: false });
      }
      return true;
    },
  },
  kairo: {
    id: 'kairo', name: '알레그로 3연주', charge: 1.0, line: '풍향은 보정했네. 자, 감상하게.',
    brief: '가장 튼튼한 적들부터 차례로 방어도를 무시하는 강한 사격을 가합니다.',
    text: `최대 체력이 가장 높은 적부터 차례로 ${KAI.ultN}명에게 각각 [pw:shoot:${KAI.ult}:phys] 피해를 가합니다.\n적이 ${KAI.ultN}명보다 적으면 남은 공격도 같은 순서로 다시 가합니다.\n이 공격은 치명타 확률이 [pv:${KAI.ultCrit}], 명중 확률이 [pv:1] 상승 적용됩니다.\n이 공격은 대상의 방어도를 [p:${KAI.ultPen}] 무시합니다.`,
    desc: `최대 체력이 가장 높은 적부터 ${KAI.ultN}명에게 차례로 사격 위력 ${pct(KAI.ult)} 물리 저격 (치명타 확률 +${pct(KAI.ultCrit)}p, 방어도 관통 ${pct(KAI.ultPen)}, 회피 불가). 적이 ${KAI.ultN}명보다 적으면 남은 탄도 그 적들에게 차례로 쏜다.`,
    theme: { pat: 'rail', c1: '#e0b040', c2: '#2a1810', txt: 'type' },
    cast(b, u) {
      const es = b.targetable(u).sort((a, c) => b.S(c, 'maxHp') - b.S(a, 'maxHp'));
      if (!es.length) return false;
      for (let i = 0; i < KAI.ultN; i++) {
        const live = es.filter((e) => e.alive);
        if (!live.length) break;
        const e = live[i % live.length];
        b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
        skillHit(b, u, e, 'shoot', KAI.ult, 'phys', { critBonus: KAI.ultCrit, noMiss: true, pen: KAI.ultPen });
      }
      return true;
    },
  },
  bianca: {
    id: 'bianca', name: '긴급 수술', charge: 0.95, line: '수술 시작합니다. 베헤모스, 가.',
    brief: '아군 전체를 치료 · 정화하고, 베헤모스를 회복시켜 잠시 강하게 만듭니다.',
    text: `아군 전체를 [pw:tech:${BIA.ult}]만큼 회복시키고, 해로운 효과를 모두 제거합니다.\n베헤모스의 체력을 모두 회복시킵니다.\n[s:${BIA.ultDur}]간 베헤모스가 가하는 피해를 [pv:${BIA.ultDmg}] 증가시키고, 공격 속도를 [pv:${BIA.ultAs}] 증가시킵니다.\n베헤모스가 없으면 체력 비율이 가장 낮은 아군이 대신 이 강화를 받습니다.`,
    desc: `아군 전원을 기술 위력 ${pct(BIA.ult)} 회복하고 해로운 상태이상을 없앤다. 베헤모스는 체력을 모두 회복하고 ${BIA.ultDur}초간 주는 피해 +${pct(BIA.ultDmg)}p, 공격 속도 +${pct(BIA.ultAs)}p. 베헤모스가 없으면 체력 비율이 가장 낮은 아군이 대신 그 강화를 받는다.`,
    theme: { pat: 'hex', c1: '#80c0ff', c2: '#6a1020', txt: 'unwrap' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      const low = b.lowestHpAlly(u);
      for (const a of b.alliesOf(u)) { b.heal(u, a, b.P(u, 'tech') * BIA.ult); cleanse(a); }
      const pets = summonsOf(b, u);
      const boost = { delta: { atkSpd: BIA.ultAs }, mods: [inc('all', BIA.ultDmg)] };
      if (pets.length) for (const d of pets) { b.heal(u, d, b.S(d, 'maxHp'), true); b.buff(u, d, 'bianca.ultpet', BIA.ultDur, { ...boost, label: '폭주' }); }
      else if (low) b.buff(u, low, 'bianca.ultmut', BIA.ultDur, { ...boost, label: '변이' });
      return true;
    },
  },
  phyllis: {
    id: 'phyllis', name: '균열 술래잡기', charge: 1.0, line: '술래는 너희야-! 잡아 보든가-!',
    brief: '잠시 무작위 적들에게 계속 이동하며 신성 피해를 줍니다.',
    text: `[s:${PHY.ultStep}]마다 무작위 적에게 이동해 [pw:tech:${PHY.ult}:holy] 피해를 가합니다.\n이 공격은 ${Math.round(PHY.ultDur / PHY.ultStep)}회 이어집니다.`,
    desc: `${PHY.ultDur}초 동안 ${PHY.ultStep}초마다 무작위 적에게 균열 도약해 기술 위력 ${pct(PHY.ult)} 신성 피해 (총 ${Math.round(PHY.ultDur / PHY.ultStep)}회).`,
    theme: { pat: 'vortex', c1: '#ffd040', c2: '#2a2a30', txt: 'slide' },
    cast(b, u) {
      if (!b.targetable(u).length) return false;
      const n = Math.round(PHY.ultDur / PHY.ultStep);
      channel(u, PHY.ultDur, PHY.ultStep, (bb, i) => {
        if (i >= n) return;
        const es = bb.targetable(u);
        if (!es.length) return;
        const e = bb.rng.pick(es);
        blinkTo(bb, u, e);
        bb.dealDamage(u, e, bb.P(u, 'tech') * PHY.ult, { elem: 'holy', tag: 'skill', kind: 'tech', canMiss: false });
      });
      return true;
    },
  },
  aiden: {
    id: 'aiden', name: '마감 시간입니다', charge: 1.0, line: '마감 시간입니다, 손님들. 계산은 이쪽으로.',
    brief: '주변 적들에게 피해를 주고 자신을 노리게 하며, 가끔 [공포]에 빠뜨립니다.',
    text: `자신으로부터 [t:2] 이내의 적들에게 [pw:strike:${AID.ult}:phys] 피해를 가합니다.\n공격이 적중하면 대상에게 [p:${AID.ultFearChance}] 기본 확률로 [fx:fear:${AID.ultFear}] 효과를 부여하고, 반드시 [fx:taunt:${AID.ultTaunt}] 효과를 부여합니다.\n[s:${AID.ultDur}]간 자신의 회피를 [pv:0.15], 공격 속도를 [pv:0.3] 증가시키고, 받는 피해를 [pv:${AID.ultRed}] 감소시킵니다.`,
    desc: `주변 2칸 적에게 타격 위력 ${pct(AID.ult)} 물리 피해 + ${pct(AID.ultFearChance)} 확률로 ${AID.ultFear}초 공포, 맞은 적을 ${AID.ultTaunt}초간 도발한다. 자신은 ${AID.ultDur}초간 고양이 형태가 되고 피해량 경감 ${pct(AID.ultRed)}p.`,
    theme: { pat: 'haze', c1: '#7fe3ff', c2: '#1a1a22', txt: 'mist' },
    cast(b, u) {
      const es = b.around(u, 2, b.enemiesOf(u));
      if (!es.length) return false;
      b.fx(u.x, u.y, 2, 'phys');
      for (const e of es) {
        const r = b.dealDamage(u, e, b.S(u, 'strike') * AID.ult, { elem: 'phys', tag: 'skill', kind: 'strike', canMiss: false });
        if (r.miss || !e.alive) continue; // 공포 · 도발은 적중한 대상만
        fear(b, u, e, AID.ultFear, AID.ultFearChance);
        b.provoke(e, u, AID.ultTaunt);
      }
      catForm(b, u, AID.ultDur);
      b.buff(u, u, 'aiden.closing', AID.ultDur, { taken: [red('all', AID.ultRed)], label: '마감' });
      return true;
    },
  },
};
