import { CFG } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { ENEMY_BY_ID, type EnemyDef, setSummonHook } from '../data/enemies';
import { GLOBAL_BY_ID } from '../data/globals';
import { itemEffect } from '../data/items';
import { rankTitle, SYN_BY_ID, SYNERGIES, tierOf } from '../data/synergies';
import { UNIT_BY_ID } from '../data/units';
import { Rng } from '../rng';
import { type Major, MAJORS, type RunState, type Stats, emptyStats, type SynergyId, type UnitState, type Encounter } from '../types';
import { Battle, type CUnit } from './combat';
import type { Effect, EffectCtx } from './effects';

export type Counts = Partial<Record<SynergyId, number>>;

export const playerRows = (n: number) => (n <= 5 ? 2 : 3);

export function deployed(run: RunState) { return run.units.filter((u) => u.pos); }

/** 기물이 소속된 시너지 (세력 + 특성 + 증강으로 얻은 추가 소속) */
export function memberships(u: UnitState): SynergyId[] {
  const d = UNIT_BY_ID[u.defId];
  const s = new Set<SynergyId>([d.faction, ...d.traits]);
  for (const a of u.augments) {
    const e = AUG_BY_ID[a.id]?.effect(a.param);
    e?.extraSyn?.forEach((x) => s.add(x));
  }
  return [...s];
}

export function synergyCounts(units: UnitState[]): Counts {
  const seen = new Set<string>();
  const c: Counts = {};
  for (const u of units) {
    if (seen.has(u.defId)) continue; // 같은 기물은 1회만 집계
    seen.add(u.defId);
    for (const s of memberships(u)) c[s] = (c[s] || 0) + 1;
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
  for (const a of u.augments) { const d = AUG_BY_ID[a.id]; if (d) out.push(d.effect(a.param)); }
  for (const it of u.items) if (it) out.push(itemEffect(it));
  if (onBoard) {
    const ctx = makeCtx(run, u, counts);
    const mine = new Set(memberships(u));
    for (const s of SYNERGIES) {
      const tier = tierOf(s.id, counts[s.id] || 0);
      if (!tier) continue;
      if (s.team) { const e = s.team(tier, ctx); if (e) out.push(e); }
      if (s.member && mine.has(s.id)) { const e = s.member(tier, ctx); if (e) out.push(e); }
    }
    for (const g of run?.globals || []) { const e = GLOBAL_BY_ID[g]?.team; if (e) out.push(e); }
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
    counters: { dmg: 0, taken: 0, healed: 0, kills: 0, casts: 0 }, mem: {},
  };
}

export function buildAlly(b: Battle, run: RunState | null, u: UnitState, counts: Counts): CUnit {
  const d = UNIT_BY_ID[u.defId];
  const effects = unitEffects(run, u, counts, true);
  const { st } = computeStats(u, effects);
  const c = blankUnit(0);
  Object.assign(c, {
    defId: d.id, name: d.name, sprite: d.sprite, palette: d.palette, st, keywords: d.keywords.slice(),
    atk: { ...d.atk }, skill: d.skill, sk: { ...d.skill.params }, cdMax: d.skill.cd, src: u,
    synergies: new Set(memberships(u)),
  });
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
  return c;
}

export function buildEnemy(b: Battle, def: EnemyDef, phase: number, mult: number): CUnit {
  const c = blankUnit(1);
  const st = emptyStats();
  st.maxHp = def.hp * CFG.enemyHpMul * Math.pow(CFG.phaseHp, phase - 1) * mult;
  st.shoot = st.strike = st.tech = def.power * CFG.enemyPowMul;
  st.armor = def.armor * Math.pow(CFG.phaseArmor, phase - 1);
  st.acc = def.acc || 0; st.eva = def.eva || 0; st.crit = def.crit ?? 0.05; st.critDmg = 1.5;
  st.effHit = def.effHit || 0; st.effRes = def.effRes || 0; st.moveSpd = def.moveSpd || 1; st.range = def.range;
  Object.assign(c, {
    defId: def.id, name: def.name, sprite: def.sprite, palette: def.palette, st, keywords: def.keywords.slice(),
    atk: { type: def.atk.type, elem: def.atk.elem, interval: def.interval }, skill: def.skill || null,
    sk: { ...(def.skill?.params || {}) }, cdMax: def.skill?.cd || 0, isBoss: def.tier === 'boss', big: def.tier !== 'minion',
    immobile: !!def.immobile, phaseAmp: Math.pow(CFG.phaseAmp, phase - 1) * (1 + (mult - 1) / 2),
  });
  c.mem.mult = mult;
  c.cd = c.cdMax * 0.6;
  if (def.onBasic) c.hooks.push({ onBasic: def.onBasic });
  if (def.onTick) c.hooks.push({ onTick: def.onTick });
  void b;
  return c;
}

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
  const b = new Battle(enc.n, new Rng(enc.seed), { phase: run.phase, credits: run.credits });
  b.keepEvents = keepEvents;
  const dep = deployed(run);
  const counts = synergyCounts(dep);
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
