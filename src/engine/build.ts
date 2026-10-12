import { CFG, phaseAmpMult, phaseHpMult } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { ENEMY_BY_ID, type EnemyDef, setSummonHook } from '../data/enemies';
import { fieldOf } from '../data/battlefields';
import { diffHas } from '../data/difficulty';
import { BOONS } from '../data/events';
import { BLESSING_BY_ID, GLOBAL_BY_ID } from '../data/globals';
import { emblemOf, isMod, itemEffect } from '../data/items';
import { ENG_HOOK, rankTitle, SYN_BY_ID, SYNERGIES, tierOf } from '../data/synergies';
import { UNIT_BY_ID } from '../data/units';
import { enableDivine, ENEMY_PSI, sigmundTarget } from '../data/rework';
import type { SummonDef } from '../data/unitkit';
import { Rng } from '../rng';
import { type Major, MAJORS, type RunState, type Stats, emptyStats, type SynergyId, type UnitState, type Encounter } from '../types';
import { Battle, type CUnit } from './combat';
import { applyLive, type Effect, type EffectCtx } from './effects';

export type Counts = Partial<Record<SynergyId, number>>;

export const playerRows = (n: number) => (n >= 8 ? 4 : 3);

export function deployed(run: RunState) { return run.units.filter((u) => u.pos); }

/** 기물이 소속된 시너지 (세력 + 특성 + 증강으로 얻은 추가 소속) */
export function memberships(u: UnitState, run?: RunState | null): SynergyId[] {
  const d = UNIT_BY_ID[u.defId];
  const s = new Set<SynergyId>([...d.factions, ...d.traits]);
  if (run && sigmundTarget(run) === u.uid) s.add('FAM'); // 시그문드가 모시는 기물
  for (const a of u.augments) {
    const e = AUG_BY_ID[a.id]?.effect(a.param);
    e?.extraSyn?.forEach((x) => s.add(x));
  }
  if (u.mod && isMod(u.mod)) s.add(emblemOf(u.mod)); // 문장 개조부품
  return [...s];
}

/** raw = 증표 규칙으로 묶기 전 인원 (표시용) */
export function synergyCounts(units: UnitState[], run?: RunState | null, raw = false): Counts {
  const seen = new Set<string>();
  const c: Counts = {};
  for (const u of units) {
    if (seen.has(u.defId)) continue; // 같은 기물은 1회만 집계
    seen.add(u.defId);
    for (const s of memberships(u, run)) c[s] = (c[s] || 0) + 1;
  }
  if (run) {
    // 연합 협정 / 전술 교범: 인원이 가장 많은 세력 / 특성 +1
    const top = (kind: 'faction' | 'trait') => SYNERGIES.filter((s) => s.kind === kind && s.tiers.length > 1 && (c[s.id] || 0) > 0)
      .sort((a, b2) => (c[b2.id] || 0) - (c[a.id] || 0))[0];
    if (run.globals.includes('G.faction')) { const t = top('faction'); if (t) c[t.id]! += 1; }
    if (run.globals.includes('G.trait')) { const t = top('trait'); if (t) c[t.id]! += 1; }
  }
  // 최종 단계 증표 규칙: 증표(문장)를 단 출전 기물이 없으면 최종 단계 직전 인원으로 묶는다
  if (!raw) for (const sd of SYNERGIES) {
    if (!sd.lockFinal) continue;
    const last = sd.tiers[sd.tiers.length - 1];
    if ((c[sd.id] || 0) >= last && !units.some((u) => u.mod === `M_${sd.id}`)) c[sd.id] = last - 1;
  }
  return c;
}

export function activeTiers(counts: Counts): Partial<Record<SynergyId, number>> {
  const t: Partial<Record<SynergyId, number>> = {};
  for (const s of SYNERGIES) { const v = tierOf(s.id, counts[s.id] || 0); if (v) t[s.id] = v; }
  return t;
}

export function makeCtx(run: RunState | null, unit: UnitState | null, counts: Counts): EffectCtx {
  return { run, unit, counts, phase: run?.phase || 1, credits: run?.credits || 0 };
}

/** 기물 하나에 적용되는 모든 효과 */
export function unitEffects(run: RunState | null, u: UnitState, counts: Counts, onBoard: boolean): Effect[] {
  const out: Effect[] = [];
  const d = UNIT_BY_ID[u.defId];
  if (d.passive) out.push(d.passive);
  if (d.trait.effect) out.push(d.trait.effect);
  const g = u.grow || {};
  if (d.ttype === 'minor' && d.growth?.effect) out.push(d.growth.effect(g));
  if (d.ttype === 'psionic' && d.psi) out.push(d.psi.effect);
  // 시그문드: 모시는 기물이 원래 엘베스타드면 모든 메이저 +5
  if (run && sigmundTarget(run) === u.uid && d.factions.includes('FAM')) out.push({ majors: { vit: 5, pow: 5, mnd: 5, def: 5, agi: 5 } });
  for (const a of u.augments) { const d = AUG_BY_ID[a.id]; if (d) out.push(d.effect(a.param)); }
  for (const it of u.items) if (it) out.push(itemEffect(it));
  if (onBoard) {
    const ctx = makeCtx(run, u, counts);
    const mine = new Set(memberships(u, run));
    for (const s of SYNERGIES) {
      const tier = tierOf(s.id, counts[s.id] || 0);
      if (!tier) continue;
      if (s.team) { const e = s.team(tier, ctx); if (e) out.push(e); }
      if (s.member && mine.has(s.id)) { const e = s.member(tier, ctx); if (e) out.push(e); }
    }
    for (const g of run?.globals || []) { const e = GLOBAL_BY_ID[g]?.team; if (e) out.push(e); }
    if (run?.blessing) { const e = BLESSING_BY_ID[run.blessing]?.team; if (e) out.push(e); }
    for (const id of [...(run?.boons || []), ...(run?.phaseBoons || [])]) { const e = BOONS[id]?.effect; if (e) out.push(e); } // 사건 효과
    const fa = run ? fieldOf(run.field).ally : undefined; // 전장 세력 보너스
    if (fa && mine.has(fa.syn)) out.push(fa.effect);
  }
  return out;
}

export function totalMajors(u: UnitState, effects: Effect[]): Record<Major, number> {
  const d = UNIT_BY_ID[u.defId];
  const m = {} as Record<Major, number>;
  for (const k of MAJORS) {
    let v = d.base[k] + u.alloc[k] + u.perm[k];
    for (const e of effects) v += e.majors?.[k] || 0;
    m[k] = Math.max(0, v);
  }
  return m;
}

export function computeStats(u: UnitState, effects: Effect[]): { st: Stats; majors: Record<Major, number> } {
  const d = UNIT_BY_ID[u.defId];
  const m = totalMajors(u, effects);
  const st = emptyStats();
  Object.assign(st, CFG.baseMinor);
  st.moveSpd = 1;
  st.range = d.range;
  for (const k of MAJORS) {
    const conv = CFG.conv[k] as Partial<Stats>;
    for (const [sk, per] of Object.entries(conv)) st[sk as keyof Stats] += per! * m[k];
  }
  const pct: Partial<Record<keyof Stats, number>> = {};
  for (const e of effects) {
    if (e.stats) for (const [k, v] of Object.entries(e.stats)) st[k as keyof Stats] += v as number;
    if (e.pct) for (const [k, v] of Object.entries(e.pct)) pct[k as keyof Stats] = (pct[k as keyof Stats] || 0) + (v as number);
  }
  for (const [k, v] of Object.entries(pct)) st[k as keyof Stats] *= Math.max(0.1, 1 + v!);
  st.range = Math.max(1, Math.round(st.range));
  return { st, majors: m };
}

/** 저장된 배치(c, r)를 크기 n 보드의 실제 좌표로 */
export function boardPos(pos: { c: number; r: number }, n: number) {
  const rows = playerRows(n);
  return { x: Math.min(pos.c, n - 1), y: n - 1 - Math.min(pos.r, rows - 1) };
}

function blankUnit(side: 0 | 1): CUnit {
  return {
    id: 0, side, defId: '', name: '', sprite: 'soldier', palette: [], x: 0, y: 0, px: 0, py: 0, moveT: 0, moveDur: 0,
    hp: 1, shield: 0, st: emptyStats(), atk: { type: 'strike', elem: 'phys', interval: 1 }, atkTimer: 0, cd: 0, cdMax: 0,
    skill: null, sk: {}, statuses: [], mods: [], taken: [], hooks: [], keywords: [], synergies: new Set(), target: null,
    alive: true, isBoss: false, isSummon: false, immobile: false, phaseAmp: 1,
    counters: { dmg: 0, taken: 0, healed: 0, kills: 0, casts: 0, shield: 0, elem: {} }, mem: {},
    weapon: null, ammo: 0, reloadT: 0, combo: 0, reason: null, div: null, divGot: 0, divCap: 0, divUsed: false,
  };
}

export function buildAlly(b: Battle, run: RunState | null, u: UnitState, counts: Counts): CUnit {
  const d = UNIT_BY_ID[u.defId];
  const effects = unitEffects(run, u, counts, true);
  const { st, majors } = computeStats(u, effects);
  const c = blankUnit(0);
  Object.assign(c, {
    defId: d.id, name: d.name, sprite: d.sprite, palette: d.palette, st, keywords: d.keywords.slice(),
    atk: { ...d.atk }, skill: d.skill, sk: { ...d.skill.params }, cdMax: d.skill.cd, src: u,
    synergies: new Set(memberships(u, run)),
    weapon: { ...d.weapon }, ctype: d.ctype, ttype: d.ttype, faith: u.faith || d.faith,
  });
  c.mem.mnd = majors.mnd;
  if (d.weapon.kind === 'none') c.noAttack = true;
  const p = boardPos(u.pos!, b.n);
  c.x = c.px = p.x; c.y = c.py = p.y;
  c.mem.title = rankTitle(u.rank) + effects.reduce((s, e) => s + (e.title || 0), 0);
  const ctx = makeCtx(run, u, counts);
  for (const e of effects) {
    if (e.mods) c.mods.push(...e.mods);
    if (e.taken) c.taken.push(...e.taken);
    if (e.hooks) c.hooks.push(e.hooks);
  }
  for (const e of effects) e.setup?.(c, b, ctx);
  c.cdMax = Math.max(1, c.cdMax);
  c.cd = c.cdMax * 0.5;
  if (d.ttype === 'psionic') c.reason = Math.min(100, CFG.reasonStart + (c.mem.reasonStart || 0));
  if (d.ttype === 'divine') enableDivine(c, c.faith!, run?.divCap || 0);
  const sd = d.summon;
  if (sd) c.hooks.push({ onStart: (bb, self) => spawnSummons(bb, self, sd) });
  return c;
}

/** 최고의 친구: 주인 스탯 일부를 물려받는 소환물 */
function spawnSummons(b: Battle, owner: CUnit, sd: SummonDef) {
  const n = 1 + (owner.mem.extraSummon || 0);
  const base = Math.min(2.5, (owner.mem.bond || 0.35) + (owner.mem.bondBonus || 0));
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? base : base * 0.8; // 추가 소환물은 상속률 80%
    const s = blankUnit(owner.side);
    const o = owner.st;
    const st = emptyStats();
    st.maxHp = o.maxHp * r * (sd.hpMul || 1);
    st.shoot = o.shoot * r; st.strike = o.strike * r; st.tech = o.tech * r;
    st.armor = o.armor * r + (owner.mem.summonArmor || 0);
    st.acc = o.acc; st.crit = o.crit; st.critDmg = o.critDmg; st.effHit = o.effHit; st.effRes = o.effRes; st.eva = o.eva;
    st.moveSpd = 1.15; st.range = sd.range;
    st.maxHp *= 1 + (owner.mem.summonHpPct || 0);
    // 라르스: 경호원 메이저 보너스
    const gm = owner.mem.summonMaj || 0;
    if (gm) for (const k of MAJORS) for (const [sk, per] of Object.entries(CFG.conv[k])) st[sk as keyof Stats] += (per as number) * gm;
    Object.assign(s, {
      defId: 'summon', name: sd.name, sprite: sd.sprite, palette: sd.palette, art: sd.art, st, atk: { ...sd.atk },
      keywords: sd.sprite === 'drone' ? ['mech'] : ['bio'], isSummon: true, owner,
      mods: owner.mem.bondAmp ? [{ kind: 'inc', tag: 'all', v: owner.mem.bondAmp }] : [],
    });
    s.hp = st.maxHp;
    s.atkTimer = 0.3;
    const treat = owner.mem.summonTreat;
    if (owner.mem.crowShock) s.hooks.push({ onBasic(bb, self, t, r2) { if (r2.amount > 0 && t.alive && bb.rng.chance(0.3)) bb.applyStatus(self, t, { type: 'shock', key: 'shock', dur: 1 }); } });
    if (treat) s.hooks.push({
      onTick(bb, self, dt) {
        self.mem.treat = (self.mem.treat || 0) + dt;
        if (self.mem.treat >= 5 && owner.alive) { self.mem.treat = 0; bb.heal(self, owner, bb.S(owner, 'tech') * treat); }
      },
    });
    b.spawn(s, owner);
  }
}

/**
 * 적 메이저 스탯: 페이즈 · 등급 · 성향에 따라 정해지고, 아군과 같은 환산 규칙으로
 * 명중 · 효과 명중 · 효과 저항 · 회피 · 치명타를 올린다 (체력 · 위력 · 방어도는 기존 적 수치 그대로).
 */
export function enemyMajors(def: EnemyDef, phase: number): Record<Major, number> {
  const w: Record<Major, number> = { vit: 0.8, pow: 0.8, mnd: 0.6, def: 0.8, agi: 0.5 };
  if (def.melee) { w.vit += 0.3; w.def += 0.2; } else { w.pow += 0.2; w.agi += 0.1; }
  if (def.atk.elem === 'psy' || def.atk.elem === 'holy' || def.keywords.includes('phantom')) w.mnd += 0.6;
  if (def.keywords.includes('mech')) { w.def += 0.2; w.mnd -= 0.3; }
  if ((def.eva || 0) >= 0.15) w.agi += 0.3;
  if (def.armor >= 300) w.def += 0.4;
  const lv = (4 + 3 * (phase - 1)) * (def.tier === 'boss' ? 1.3 : def.tier === 'elite' ? 1.15 : 1);
  return Object.fromEntries(MAJORS.map((m) => [m, Math.max(0, Math.round(lv * w[m]))])) as Record<Major, number>;
}

export function buildEnemy(b: Battle, def: EnemyDef, phase: number, mult: number): CUnit {
  const c = blankUnit(1);
  const st = emptyStats();
  st.maxHp = def.hp * CFG.enemyHpMul * phaseHpMult(phase) * mult;
  st.shoot = st.strike = st.tech = def.power * CFG.enemyPowMul;
  st.armor = def.armor * Math.pow(CFG.phaseArmor, phase - 1);
  st.acc = def.acc || 0; st.eva = def.eva || 0; st.crit = def.crit ?? 0.05; st.critDmg = 1.5;
  st.effHit = def.effHit || 0; st.effRes = def.effRes || 0; st.moveSpd = def.moveSpd || 1; st.range = def.range;
  const em = enemyMajors(def, phase);
  // 효과 명중 · 효과 저항은 아군과 같은 환산, 명중 · 회피 · 치명타는 약하게 (전체 난이도 유지)
  const K = CFG.enemyMajorConv;
  st.effHit += em.mnd * CFG.conv.mnd.effHit; st.effRes += em.def * CFG.conv.def.effRes;
  st.acc += em.mnd * CFG.conv.mnd.acc * K.acc; st.eva += em.agi * CFG.conv.agi.eva * K.eva; st.crit += em.pow * CFG.conv.pow.crit * K.crit;
  Object.assign(c, {
    defId: def.id, name: def.name, sprite: def.sprite, palette: def.palette, st, keywords: def.keywords.slice(),
    atk: { type: def.atk.type, elem: def.atk.elem, interval: def.interval }, skill: def.skill || null,
    sk: { ...(def.skill?.params || {}) }, cdMax: def.skill?.cd || 0, isBoss: def.tier === 'boss', big: def.tier !== 'minion',
    immobile: !!def.immobile, phaseAmp: phaseAmpMult(phase) * (1 + (mult - 1) / 2),
  });
  c.mem.mult = mult;
  for (const m of MAJORS) c.mem[`M_${m}`] = em[m];
  c.cd = c.cdMax * 0.6;
  // 리워크: 적도 무기 · 전투 유형 · 이성을 가진다
  c.ctype = def.atk.type === 'shoot' ? 'MARK' : 'VAN';
  c.weapon = { name: '', kind: def.atk.type === 'shoot' ? 'mag' : 'combo', type: def.atk.type, elem: def.atk.elem, interval: def.interval, range: def.range,
    mult: def.atk.type === 'shoot' ? (8 * def.interval + 1.5) / (8 * def.interval) : 4 / (3 + CFG.finishMult), mag: 8, reload: 1.5, combo: 4 };
  c.reason = CFG.reasonStart;
  c.hooks.push(ENEMY_PSI);
  if (b.ctx.field) fieldOf(b.ctx.field).enemyMod?.(c); // 전장 조건
  // 난이도 단계
  const d = b.ctx.diff || 0;
  if (diffHas(d, 1)) st.maxHp *= 1.15;
  if (diffHas(d, 2)) c.phaseAmp *= 1.15;
  if (diffHas(d, 4) && def.tier === 'boss') st.maxHp *= 1.25;
  if (diffHas(d, 7)) { st.armor *= 1.25; st.effRes += 0.15; }
  if (diffHas(d, 8)) st.maxHp *= Math.pow(1.05, phase - 1);
  // 적 장비 · 개조부품
  for (const it of [...(def.items || []), def.mod || null]) if (it) applyLive(c, itemEffect(it), b, makeCtx(null, null, {}));
  if (def.onBasic) c.hooks.push({ onBasic: def.onBasic });
  if (def.onTick) c.hooks.push({ onTick: def.onTick });
  void b;
  return c;
}

// 엔지니어 감시 포탑: 출전한 엔지니어 능력치 평균을 단계별 비율(60 / 80 / 120%)로 상속
const TURRET_PAL = ['#0c0e12', '#7a8aa0', '#3a4458', '#c0c8d0', '#7fe3ff', '#4a5468', '#e8f0ff'];
ENG_HOOK.spawn = (b, lead, engs, n) => {
  const avg = (k: keyof Stats) => engs.reduce((s, e) => s + b.S(e, k), 0) / engs.length;
  const hpBonus = engs.reduce((s, e) => s + (e.mem.turretHp || 0), 0);
  const tier = lead.mem.eng || 1;
  const inherit = [0.6, 0.8, 1.2][Math.min(3, tier) - 1]; // 엔지니어 단계별 상속률
  const asBonus = engs.reduce((s, e) => s + (e.mem.turretAs || 0), 0) + (tier >= 3 ? 0.5 : 0);
  for (let i = 0; i < n; i++) {
    const t = blankUnit(lead.side);
    const st = emptyStats();
    st.maxHp = avg('maxHp') * inherit * (1 + hpBonus);
    st.shoot = st.strike = st.tech = Math.max(avg('shoot'), avg('tech')) * inherit;
    st.armor = avg('armor') * inherit * (1 + hpBonus);
    st.acc = avg('acc') * 0.5; st.crit = avg('crit') * 0.5; st.critDmg = 1.5; st.effRes = avg('effRes') * 0.5;
    st.atkSpd = asBonus; st.range = 4; st.moveSpd = 1;
    Object.assign(t, {
      defId: 'turret', name: '감시 포탑', sprite: 'turret', palette: TURRET_PAL, art: 'sm_turret', st, atk: { type: 'shoot', elem: 'phys', interval: 1.0 },
      keywords: ['mech', 'struct'], isSummon: true, immobile: true,
    });
    t.hp = st.maxHp;
    t.atkTimer = 0.4;
    // 아군 진영 안의 빈칸에만 설치
    const rows = playerRows(b.n);
    let cell: { x: number; y: number } | null = null;
    for (let r = 1; r < b.n && !cell; r++)
      for (let dy = -r; dy <= r && !cell; dy++)
        for (let dx = -r; dx <= r && !cell; dx++) {
          const x = lead.x + dx, y = lead.y + dy;
          const mine = lead.side === 0 ? y >= b.n - rows : y < rows;
          if (b.inBounds(x, y) && mine && !b.unitAt(x, y)) cell = { x, y };
        }
    if (!cell) return;
    t.x = t.px = cell.x; t.y = t.py = cell.y;
    b.add(t);
    b.emit({ k: 'spawn', id: t.id });
  }
};

setSummonHook((b, owner, defId, count) => {
  for (let i = 0; i < count; i++) {
    const e = buildEnemy(b, ENEMY_BY_ID[defId], b.ctx.phase, owner.mem.mult || 1);
    e.isSummon = true;
    e.hp = e.st.maxHp;
    b.spawn(e, owner);
  }
});

/** 보드 크기 n 에서의 실제 아군 배치 (크기가 바뀌어 겹치면 빈 칸으로 밀어낸다) */
export function layout(run: RunState, n: number): Map<string, { x: number; y: number }> {
  const rows = playerRows(n);
  const used = new Set<string>();
  const out = new Map<string, { x: number; y: number }>();
  for (const u of deployed(run)) {
    let p: { x: number; y: number } | null = boardPos(u.pos!, n);
    if (used.has(`${p.x},${p.y}`)) {
      p = null;
      for (let y = n - 1; y >= n - rows && !p; y--) for (let x = 0; x < n && !p; x++) if (!used.has(`${x},${y}`)) p = { x, y };
    }
    if (!p) continue;
    used.add(`${p.x},${p.y}`);
    out.set(u.uid, p);
  }
  return out;
}

export function buildBattle(run: RunState, enc: Encounter, keepEvents = true): Battle {
  const b = new Battle(enc.n, new Rng(enc.seed), { phase: run.phase, credits: run.credits, field: run.field, diff: run.diff });
  b.keepEvents = keepEvents;
  const dep = deployed(run);
  const counts = synergyCounts(dep, run);
  const lay = layout(run, enc.n);
  for (const u of dep) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const c = buildAlly(b, run, u, counts);
    c.x = c.px = p.x; c.y = c.py = p.y;
    b.add(c);
  }
  for (const s of enc.enemies) {
    const def = ENEMY_BY_ID[s.defId];
    const e = buildEnemy(b, def, run.phase, enc.mult);
    e.x = e.px = Math.min(s.c, enc.n - 1);
    e.y = e.py = Math.min(s.row, enc.n - 1);
    if (b.unitAt(e.x, e.y)) { const f = b.freeCellNear(e.x, e.y); if (!f) continue; e.x = e.px = f.x; e.y = e.py = f.y; }
    b.add(e);
  }
  b.start();
  return b;
}

export { SYN_BY_ID };
