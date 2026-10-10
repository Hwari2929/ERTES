import { CFG, phaseAmpMult, phaseHpMult } from '../config';
import { AUG_BY_ID } from '../data/augments';
import { ENEMY_BY_ID, type EnemyDef, setSummonHook } from '../data/enemies';
import { BLESSING_BY_ID, GLOBAL_BY_ID } from '../data/globals';
import { itemEffect } from '../data/items';
import { ENG_HOOK, rankTitle, SYN_BY_ID, SYNERGIES, tierOf } from '../data/synergies';
import { UNIT_BY_ID } from '../data/units';
import type { SummonDef } from '../data/unitkit';
import { Rng } from '../rng';
import { FACTIONS, type Major, MAJORS, type RunState, type Stats, emptyStats, type SynergyId, type UnitState, type Encounter } from '../types';
import { Battle, type CUnit } from './combat';
import type { Effect, EffectCtx } from './effects';

export type Counts = Partial<Record<SynergyId, number>>;

export const playerRows = (n: number) => (n >= 8 ? 4 : 3);

export function deployed(run: RunState) { return run.units.filter((u) => u.pos); }

/** 기물이 소속된 시너지 (세력 + 특성 + 증강으로 얻은 추가 소속) */
export function memberships(u: UnitState): SynergyId[] {
  const d = UNIT_BY_ID[u.defId];
  const s = new Set<SynergyId>([...d.factions, ...d.traits]);
  for (const a of u.augments) {
    const e = AUG_BY_ID[a.id]?.effect(a.param);
    e?.extraSyn?.forEach((x) => s.add(x));
  }
  return [...s];
}

export function synergyCounts(units: UnitState[], run?: RunState | null): Counts {
  const seen = new Set<string>();
  const c: Counts = {};
  for (const u of units) {
    if (seen.has(u.defId)) continue; // 같은 기물은 1회만 집계
    seen.add(u.defId);
    for (const s of memberships(u)) c[s] = (c[s] || 0) + 1;
  }
  if (run) {
    // 문장 (특권 · 문장 수여): 해당 시너지 기물이 1명 이상 출전 중일 때만
    for (const [s, v] of Object.entries(run.synBonus || {})) if (c[s as SynergyId]) c[s as SynergyId]! += v!;
    // 연합 협정 / 전술 교범: 인원이 가장 많은 세력 / 특성 +1
    const top = (kind: 'faction' | 'trait') => SYNERGIES.filter((s) => s.kind === kind && s.tiers.length > 1 && (c[s.id] || 0) > 0)
      .sort((a, b2) => (c[b2.id] || 0) - (c[a.id] || 0))[0];
    if (run.globals.includes('G.faction')) { const t = top('faction'); if (t) c[t.id]! += 1; }
    if (run.globals.includes('G.trait')) { const t = top('trait'); if (t) c[t.id]! += 1; }
  }
  // 범은하 공동체 5/7단계: 가장 큰 다른 세력의 인원 +1/+2
  const pan = c.PAN || 0;
  const bonus = pan >= 7 ? 2 : pan >= 5 ? 1 : 0;
  if (bonus) {
    const best = FACTIONS.filter((f) => f !== 'PAN' && (c[f] || 0) > 0).sort((a, b2) => (c[b2] || 0) - (c[a] || 0))[0];
    if (best) c[best] = c[best]! + bonus;
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
  const passive = UNIT_BY_ID[u.defId].passive;
  if (passive) out.push(passive);
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
    if (run?.blessing) { const e = BLESSING_BY_ID[run.blessing]?.team; if (e) out.push(e); }
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
  c.noAttack = c.noAttack || d.traits.includes('CHEF');
  const sd = d.summon;
  if (sd) c.hooks.push({ onStart: (bb, self) => spawnSummons(bb, self, sd) });
  return c;
}

/** 최고의 친구: 주인 스탯 일부를 물려받는 소환물 */
function spawnSummons(b: Battle, owner: CUnit, sd: SummonDef) {
  const n = 1 + (owner.mem.extraSummon || 0);
  const base = Math.min(1.5, (owner.mem.bond || 0.35) + (owner.mem.bondBonus || 0));
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? base : base * 0.6;
    const s = blankUnit(owner.side);
    const o = owner.st;
    const st = emptyStats();
    st.maxHp = o.maxHp * r * (sd.hpMul || 1);
    st.shoot = o.shoot * r; st.strike = o.strike * r; st.tech = o.tech * r;
    st.armor = o.armor * r + (owner.mem.summonArmor || 0);
    st.acc = o.acc; st.crit = o.crit; st.critDmg = o.critDmg; st.effHit = o.effHit; st.effRes = o.effRes; st.eva = o.eva;
    st.moveSpd = 1.15; st.range = sd.range;
    Object.assign(s, {
      defId: 'summon', name: sd.name, sprite: sd.sprite, palette: sd.palette, st, atk: { ...sd.atk },
      keywords: sd.sprite === 'drone' ? ['mech'] : ['bio'], isSummon: true, owner,
      mods: owner.mem.bondAmp ? [{ kind: 'inc', tag: 'all', v: owner.mem.bondAmp }] : [],
    });
    s.hp = st.maxHp;
    s.atkTimer = 0.3;
    const treat = owner.mem.summonTreat;
    if (treat) s.hooks.push({
      onTick(bb, self, dt) {
        self.mem.treat = (self.mem.treat || 0) + dt;
        if (self.mem.treat >= 5 && owner.alive) { self.mem.treat = 0; bb.heal(self, owner, bb.S(owner, 'tech') * treat); }
      },
    });
    b.spawn(s, owner);
  }
}

export function buildEnemy(b: Battle, def: EnemyDef, phase: number, mult: number): CUnit {
  const c = blankUnit(1);
  const st = emptyStats();
  st.maxHp = def.hp * CFG.enemyHpMul * phaseHpMult(phase) * mult;
  st.shoot = st.strike = st.tech = def.power * CFG.enemyPowMul;
  st.armor = def.armor * Math.pow(CFG.phaseArmor, phase - 1);
  st.acc = def.acc || 0; st.eva = def.eva || 0; st.crit = def.crit ?? 0.05; st.critDmg = 1.5;
  st.effHit = def.effHit || 0; st.effRes = def.effRes || 0; st.moveSpd = def.moveSpd || 1; st.range = def.range;
  Object.assign(c, {
    defId: def.id, name: def.name, sprite: def.sprite, palette: def.palette, st, keywords: def.keywords.slice(),
    atk: { type: def.atk.type, elem: def.atk.elem, interval: def.interval }, skill: def.skill || null,
    sk: { ...(def.skill?.params || {}) }, cdMax: def.skill?.cd || 0, isBoss: def.tier === 'boss', big: def.tier !== 'minion',
    immobile: !!def.immobile, phaseAmp: phaseAmpMult(phase) * (1 + (mult - 1) / 2),
  });
  c.mem.mult = mult;
  c.cd = c.cdMax * 0.6;
  if (def.onBasic) c.hooks.push({ onBasic: def.onBasic });
  if (def.onTick) c.hooks.push({ onTick: def.onTick });
  void b;
  return c;
}

// 엔지니어 감시 포탑: 출전한 엔지니어 능력치 평균의 50%
const TURRET_PAL = ['#0c0e12', '#7a8aa0', '#3a4458', '#c0c8d0', '#7fe3ff', '#4a5468', '#e8f0ff'];
ENG_HOOK.spawn = (b, lead, engs, n) => {
  const avg = (k: keyof Stats) => engs.reduce((s, e) => s + b.S(e, k), 0) / engs.length;
  const hpBonus = engs.reduce((s, e) => s + (e.mem.turretHp || 0), 0);
  const asBonus = engs.reduce((s, e) => s + (e.mem.turretAs || 0), 0);
  for (let i = 0; i < n; i++) {
    const t = blankUnit(lead.side);
    const st = emptyStats();
    st.maxHp = avg('maxHp') * 0.5 * (1 + hpBonus);
    st.shoot = st.strike = st.tech = Math.max(avg('shoot'), avg('tech')) * 0.5;
    st.armor = avg('armor') * 0.5 * (1 + hpBonus);
    st.acc = avg('acc') * 0.5; st.crit = avg('crit') * 0.5; st.critDmg = 1.5; st.effRes = avg('effRes') * 0.5;
    st.atkSpd = asBonus; st.range = 4; st.moveSpd = 1;
    Object.assign(t, {
      defId: 'turret', name: '감시 포탑', sprite: 'turret', palette: TURRET_PAL, st, atk: { type: 'shoot', elem: 'phys', interval: 1.0 },
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
  const b = new Battle(enc.n, new Rng(enc.seed), { phase: run.phase, credits: run.credits });
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
