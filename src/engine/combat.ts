import { CFG } from '../config';
import { Rng } from '../rng';
import type { DmgTag, Elem, Keyword, Mod, Stats, StatKey, SynergyId, TakenMod, UnitState } from '../types';

export type StatusType = 'stun' | 'fear' | 'shock' | 'dot' | 'buff';
export const STATUS_NAME: Record<string, string> = {
  stun: '기절', fear: '공포', shock: '감전', poison: '중독', bleed: '출혈', corrode: '부식', slow: '둔화',
};

export interface Status {
  type: StatusType;
  key: string; // 같은 key 는 중첩 대신 갱신
  dur: number;
  src?: CUnit;
  dps?: number; elem?: Elem; tickAcc?: number;
  delta?: Partial<Stats>;
  armorMul?: number;
  mods?: Mod[];
  taken?: TakenMod[];
  label?: string;
  /** 받은 피해의 일부를 공격자에게 반사 */
  reflect?: number;
}

export interface DmgOpts {
  elem: Elem;
  tag: 'basic' | 'skill' | 'dot' | 'proc';
  canMiss?: boolean;
  critBonus?: number;
  pen?: number;
  noHooks?: boolean;
}
export interface DmgResult { amount: number; crit: boolean; miss: boolean; graze: boolean; killed: boolean }

export interface Hooks {
  onDeal?(b: Battle, self: CUnit, tgt: CUnit, r: DmgResult, o: DmgOpts): void;
  onKill?(b: Battle, self: CUnit, tgt: CUnit): void;
  onHurt?(b: Battle, self: CUnit, src: CUnit, r: DmgResult, o: DmgOpts): void;
  onSkill?(b: Battle, self: CUnit): void;
  onBasic?(b: Battle, self: CUnit, tgt: CUnit, r: DmgResult): void;
  onTick?(b: Battle, self: CUnit, dt: number): void;
  onStart?(b: Battle, self: CUnit): void;
  onHealDone?(b: Battle, self: CUnit, tgt: CUnit, amount: number, over: number): void;
  onAllyDeath?(b: Battle, self: CUnit, dead: CUnit): void;
  onEvade?(b: Battle, self: CUnit, src: CUnit): void;
  onLethal?(b: Battle, self: CUnit): boolean;
  dmgMult?(b: Battle, self: CUnit, tgt: CUnit, o: DmgOpts): number;
  takenMult?(b: Battle, self: CUnit, src: CUnit, o: DmgOpts): number;
  healMult?(b: Battle, self: CUnit, tgt: CUnit): number;
}

export interface SkillDef {
  name: string;
  cd: number;
  params: Record<string, number>;
  /** true 면 대상이 사거리(+reach) 안일 때만 시전 */
  needsRange?: boolean;
  reach?: number;
  desc: (p: Record<string, number>) => string;
  cast: (b: Battle, u: CUnit) => boolean;
}

export interface CUnit {
  id: number;
  side: 0 | 1;
  defId: string;
  name: string;
  sprite: string;
  palette: string[];
  big?: boolean;
  x: number; y: number; px: number; py: number;
  moveT: number; moveDur: number;
  hp: number; shield: number;
  st: Stats;
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  atkTimer: number;
  cd: number; cdMax: number;
  skill: SkillDef | null;
  sk: Record<string, number>;
  statuses: Status[];
  mods: Mod[];
  taken: TakenMod[];
  hooks: Hooks[];
  keywords: Keyword[];
  synergies: Set<SynergyId>;
  target: CUnit | null;
  alive: boolean;
  isBoss: boolean; isSummon: boolean; immobile: boolean;
  /** 셰프: 기본 공격을 하지 않고 제자리에서 기술만 쓴다 */
  noAttack?: boolean;
  phaseAmp: number;
  counters: { dmg: number; taken: number; healed: number; kills: number; casts: number };
  mem: Record<string, number>;
  src?: UnitState;
  owner?: CUnit;
}

export type BEvent =
  | { k: 'atk'; from: number; to: number; elem: Elem; ranged: boolean }
  | { k: 'dmg'; id: number; v: number; crit: boolean; miss: boolean; graze: boolean; elem: Elem }
  | { k: 'heal'; id: number; v: number }
  | { k: 'shield'; id: number; v: number }
  | { k: 'skill'; id: number; name: string }
  | { k: 'status'; id: number; name: string }
  | { k: 'die'; id: number }
  | { k: 'spawn'; id: number }
  | { k: 'fx'; x: number; y: number; r: number; elem: Elem };

export interface BattleCtx { phase: number; credits: number }

export class Battle {
  t = 0;
  units: CUnit[] = [];
  events: BEvent[] = [];
  keepEvents = true;
  winner: 0 | 1 | null = null;
  nextId = 1;
  counters = { crits: 0, statuses: 0, skills: 0, kills: 0, allyDeaths: 0, bestHit: 0 };
  /** 전투 단위 공유 상태 (부활 횟수 등) */
  mem: Record<string, number> = {};

  constructor(public n: number, public rng: Rng, public ctx: BattleCtx) {}

  // ───────── 조회
  get over() { return this.winner !== null; }
  living(side?: 0 | 1) { return this.units.filter((u) => u.alive && (side === undefined || u.side === side)); }
  enemiesOf(u: CUnit) { return this.living(u.side === 0 ? 1 : 0); }
  alliesOf(u: CUnit, includeSelf = true) { return this.living(u.side).filter((a) => includeSelf || a !== u); }
  dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  unitAt(x: number, y: number) { return this.units.find((u) => u.alive && u.x === x && u.y === y) || null; }
  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }
  nearest(from: CUnit, pool: CUnit[]) {
    let best: CUnit | null = null, bd = 1e9;
    for (const e of pool) {
      const d = this.dist(from, e) + this.rng.next() * 0.1;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  around(c: { x: number; y: number }, r: number, pool: CUnit[]) { return pool.filter((u) => this.dist(u, c) <= r); }

  S(u: CUnit, k: StatKey): number {
    let v = u.st[k];
    for (const s of u.statuses) if (s.delta && s.delta[k] !== undefined) v += s.delta[k]!;
    if (k === 'armor') {
      for (const s of u.statuses) if (s.armorMul !== undefined) v *= s.armorMul;
      v = Math.max(0, v);
    }
    if (k === 'moveSpd') v = Math.max(0.2, v);
    return v;
  }
  has(u: CUnit, type: StatusType, key?: string) { return u.statuses.some((s) => s.type === type && (!key || s.key === key)); }
  hpPct(u: CUnit) { return u.hp / this.S(u, 'maxHp'); }

  emit(e: BEvent) { if (this.keepEvents) this.events.push(e); }

  // ───────── 생성
  add(u: CUnit) { u.id = this.nextId++; this.units.push(u); return u; }
  spawn(u: CUnit, near: { x: number; y: number }) {
    const cell = this.freeCellNear(near.x, near.y);
    if (!cell) return null;
    u.x = u.px = cell.x; u.y = u.py = cell.y;
    this.add(u);
    for (const h of u.hooks) h.onStart?.(this, u);
    this.emit({ k: 'spawn', id: u.id });
    return u;
  }
  freeCellNear(x: number, y: number) {
    for (let r = 1; r < this.n; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (this.inBounds(nx, ny) && !this.unitAt(nx, ny)) return { x: nx, y: ny };
        }
    return null;
  }

  start() {
    for (const u of this.units) {
      u.hp = u.st.maxHp;
      u.atkTimer = u.atk.interval * (0.2 + this.rng.next() * 0.4);
    }
    for (const u of this.units.slice()) for (const h of u.hooks) h.onStart?.(this, u);
    for (const u of this.units) u.hp = Math.min(u.hp, this.S(u, 'maxHp'));
  }

  // ───────── 메인 루프
  step(dt: number) {
    if (this.over) return;
    this.t += dt;
    for (const u of this.units) {
      if (!u.alive) continue;
      this.tickStatuses(u, dt);
      if (!u.alive) continue;
      for (const h of u.hooks) h.onTick?.(this, u, dt);
      if (!u.alive || this.over) continue;
      this.act(u, dt);
      if (this.over) return;
    }
    if (this.t >= CFG.timeLimit) this.winner = 1;
  }

  runToEnd(maxT = CFG.timeLimit + 1) {
    while (!this.over && this.t < maxT) { this.step(CFG.tick); if (!this.keepEvents) this.events.length = 0; }
    if (!this.over) this.winner = 1;
  }

  private tickStatuses(u: CUnit, dt: number) {
    for (const s of u.statuses) {
      s.dur -= dt;
      if (s.type === 'dot' && s.dps && s.src) {
        s.tickAcc = (s.tickAcc || 0) + dt;
        if (s.tickAcc >= 0.5 || s.dur <= 0) {
          const amt = s.dps * s.tickAcc;
          s.tickAcc = 0;
          this.dealDamage(s.src, u, amt, { elem: s.elem || 'phys', tag: 'dot' });
          if (!u.alive) return;
        }
      }
    }
    u.statuses = u.statuses.filter((s) => s.dur > 0);
  }

  private act(u: CUnit, dt: number) {
    const stunned = this.has(u, 'stun');
    if (u.moveT > 0) { u.moveT -= dt; if (u.moveT <= 0) { u.px = u.x; u.py = u.y; } }
    if (stunned) return;
    if (!this.has(u, 'shock')) u.cd -= dt * (1 + this.S(u, 'cdr'));
    u.atkTimer -= dt * Math.max(0.2, 1 + this.S(u, 'atkSpd'));
    if (u.moveT > 0) return;

    if (!u.target || !u.target.alive) u.target = this.nearest(u, this.enemiesOf(u));
    const tgt = u.target;
    if (!tgt) return;
    const range = this.S(u, 'range');
    // 사거리 밖의 더 가까운 적이 생기면 재조준
    if (this.dist(u, tgt) > range) {
      const near = this.nearest(u, this.enemiesOf(u));
      if (near && this.dist(u, near) < this.dist(u, tgt)) u.target = near;
    }
    const t2 = u.target!;
    const d = this.dist(u, t2);
    const feared = this.has(u, 'fear');

    if (!feared && u.skill && u.cd <= 0) {
      const sk = u.skill;
      if (!sk.needsRange || d <= range + (sk.reach || 0)) {
        // 시전 전에 쿨다운을 채워 두어, 시전 중 처치 등으로 쿨다운을 돌려받을 수 있게 한다
        const prevCd = u.cd;
        u.cd = u.cdMax;
        if (!sk.cast(this, u)) u.cd = prevCd;
        else {
          u.counters.casts++;
          if (u.side === 0) this.counters.skills++;
          this.emit({ k: 'skill', id: u.id, name: sk.name });
          for (const h of u.hooks) h.onSkill?.(this, u);
          if (this.over) return;
        }
      }
    }
    if (!t2.alive || u.noAttack) return;
    if (d <= range) {
      if (!feared && u.atkTimer <= 0) {
        this.basicAttack(u, t2);
        u.atkTimer = u.atk.interval;
      }
    } else if (!u.immobile) {
      this.moveToward(u, t2, range);
    }
  }

  basicAttack(u: CUnit, tgt: CUnit, coef = 1) {
    const pow = u.atk.type === 'shoot' ? this.S(u, 'shoot') : this.S(u, 'strike');
    this.emit({ k: 'atk', from: u.id, to: tgt.id, elem: u.atk.elem, ranged: u.atk.type === 'shoot' });
    const r = this.dealDamage(u, tgt, pow * coef, { elem: u.atk.elem, tag: 'basic', canMiss: true });
    for (const h of u.hooks) h.onBasic?.(this, u, tgt, r);
    return r;
  }

  private moveToward(u: CUnit, tgt: CUnit, range: number) {
    // BFS: 대상이 사거리 안에 들어오는 가장 가까운 빈 칸으로
    const n = this.n;
    const prev = new Map<number, number>();
    const start = u.y * n + u.x;
    const q = [start];
    prev.set(start, -1);
    let goal = -1;
    while (q.length) {
      const cur = q.shift()!;
      const cx = cur % n, cy = (cur / n) | 0;
      if (cur !== start && this.dist({ x: cx, y: cy }, tgt) <= range) { goal = cur; break; }
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (!this.inBounds(nx, ny)) continue;
          const id = ny * n + nx;
          if (prev.has(id) || this.unitAt(nx, ny)) continue;
          prev.set(id, cur);
          q.push(id);
        }
    }
    let next = -1;
    if (goal >= 0) {
      let c = goal;
      while (prev.get(c) !== start) c = prev.get(c)!;
      next = c;
    } else {
      // 경로가 막힘: 거리를 줄이는 아무 빈 칸
      let best = this.dist(u, tgt);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = u.x + dx, ny = u.y + dy;
          if (!this.inBounds(nx, ny) || this.unitAt(nx, ny)) continue;
          const dd = this.dist({ x: nx, y: ny }, tgt);
          if (dd < best) { best = dd; next = ny * n + nx; }
        }
    }
    if (next < 0) return;
    u.px = u.x; u.py = u.y;
    u.x = next % n; u.y = (next / n) | 0;
    u.moveDur = u.moveT = CFG.moveTime / this.S(u, 'moveSpd');
  }

  // ───────── 피해 / 회복
  dealDamage(src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
    const res: DmgResult = { amount: 0, crit: false, miss: false, graze: false, killed: false };
    if (!tgt.alive || base <= 0) return res;
    let dmg = base;
    if (o.canMiss) {
      const acc = this.S(src, 'acc');
      const hit = Math.max(CFG.minHit, Math.min(1, CFG.baseHit + acc - this.S(tgt, 'eva')));
      if (this.rng.next() >= hit) {
        res.miss = true;
        const gc = Math.min(CFG.grazeChanceMax, CFG.grazeBase + acc * CFG.grazeAccK);
        if (this.rng.next() < gc) {
          res.graze = true;
          dmg *= Math.min(CFG.grazeDmgMax, CFG.grazeDmgBase + acc * CFG.grazeDmgAccK);
        } else dmg = 0;
        for (const h of tgt.hooks) h.onEvade?.(this, tgt, src);
      }
    }
    if (dmg > 0 && o.elem === 'phys' && !res.miss) {
      if (this.rng.next() < this.S(src, 'crit') + (o.critBonus || 0)) {
        res.crit = true;
        dmg *= this.S(src, 'critDmg');
        if (src.side === 0) this.counters.crits++;
      }
    }
    if (dmg > 0) {
      const isTrue = o.elem === 'true';
      if (!isTrue) {
        const armor = this.S(tgt, 'armor') * CFG.armorFactor[o.elem] * (1 - Math.min(1, this.S(src, 'armorPen') + (o.pen || 0)));
        dmg *= 1 - armor / (armor + CFG.armorK);
      }
      if (o.elem === 'chem' && tgt.keywords.includes('bio')) dmg *= 1.5;
      if (o.elem === 'elec' && tgt.keywords.includes('mech')) dmg *= 1.5;
      if (o.elem === 'psy' && tgt.keywords.includes('mech')) dmg *= 0.25;
      const tags: DmgTag[] = ['all', o.elem, o.tag];
      dmg *= modMult(allMods(src), tags) * src.phaseAmp;
      dmg *= takenMult(allTaken(tgt), tags, isTrue);
      for (const h of src.hooks) if (h.dmgMult) dmg *= h.dmgMult(this, src, tgt, o);
      for (const h of tgt.hooks) if (h.takenMult) dmg *= h.takenMult(this, tgt, src, o);
      if (this.t > CFG.overtimeStart) dmg *= 1 + (this.t - CFG.overtimeStart) * CFG.overtimeRamp;
    }
    dmg = Math.max(0, dmg);
    res.amount = dmg;
    if (dmg > 0) {
      let left = dmg;
      if (tgt.shield > 0) { const a = Math.min(tgt.shield, left); tgt.shield -= a; left -= a; }
      tgt.hp -= left;
      src.counters.dmg += dmg;
      tgt.counters.taken += dmg;
      if (src.side === 0 && dmg > this.counters.bestHit) this.counters.bestHit = dmg;
    }
    this.emit({ k: 'dmg', id: tgt.id, v: dmg, crit: res.crit, miss: res.miss, graze: res.graze, elem: o.elem });
    if (dmg > 0 && !o.noHooks) {
      const ls = this.S(src, 'lifesteal');
      if (ls > 0 && src.alive) this.heal(src, src, dmg * ls, true);
      for (const h of src.hooks) h.onDeal?.(this, src, tgt, res, o);
      if (tgt.alive) for (const h of tgt.hooks) h.onHurt?.(this, tgt, src, res, o);
      if (o.tag !== 'proc' && src.alive && src !== tgt) {
        let rf = 0;
        for (const s of tgt.statuses) rf += s.reflect || 0;
        if (rf > 0) this.dealDamage(tgt, src, dmg * rf, { elem: 'phys', tag: 'proc', noHooks: true });
      }
    }
    if (tgt.alive && tgt.hp <= 0) {
      for (const h of tgt.hooks) if (h.onLethal && h.onLethal(this, tgt)) break;
      if (tgt.hp <= 0) { res.killed = true; this.kill(tgt, src); }
    }
    return res;
  }

  kill(u: CUnit, by: CUnit | null) {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    this.emit({ k: 'die', id: u.id });
    if (u.side === 1 && by) this.counters.kills++;
    if (u.side === 0 && !u.isSummon) this.counters.allyDeaths++;
    if (by && by.alive) { by.counters.kills++; for (const h of by.hooks) h.onKill?.(this, by, u); }
    for (const a of this.alliesOf(u)) for (const h of a.hooks) h.onAllyDeath?.(this, a, u);
    // 소환자가 죽으면 소환물도 소멸
    for (const s of this.units) if (s.owner === u && s.alive) { s.alive = false; this.emit({ k: 'die', id: s.id }); }
    if (!this.living(0).length) this.winner = 1;
    else if (!this.living(1).length) this.winner = 0;
  }

  heal(src: CUnit, tgt: CUnit, amt: number, raw = false) {
    if (!tgt.alive || amt <= 0) return 0;
    let a = amt;
    if (!raw) {
      a *= 1 + this.S(tgt, 'healEff');
      for (const h of src.hooks) if (h.healMult) a *= h.healMult(this, src, tgt);
    }
    const max = this.S(tgt, 'maxHp');
    const real = Math.min(a, max - tgt.hp);
    tgt.hp += real;
    src.counters.healed += real;
    if (real >= 1) this.emit({ k: 'heal', id: tgt.id, v: real });
    if (!raw) for (const h of src.hooks) h.onHealDone?.(this, src, tgt, real, a - real);
    return real;
  }

  shield(tgt: CUnit, amt: number) {
    if (!tgt.alive || amt <= 0) return;
    tgt.shield = Math.min(this.S(tgt, 'maxHp'), tgt.shield + amt);
    this.emit({ k: 'shield', id: tgt.id, v: amt });
  }

  /** 상태이상 부여. 확률 = 기본 × (1 + 효과명중 − 효과저항) */
  applyStatus(src: CUnit, tgt: CUnit, s: Status, baseChance = 1): boolean {
    if (!tgt.alive) return false;
    const hostile = src.side !== tgt.side;
    if (hostile) {
      const p = baseChance * (1 + this.S(src, 'effHit') - this.S(tgt, 'effRes'));
      if (this.rng.next() >= p) return false;
      if (tgt.isBoss && (s.type === 'stun' || s.type === 'fear')) s.dur *= 0.5;
      s.dur *= 1 + (src.mem.statusDur || 0);
      if (src.side === 0) this.counters.statuses++;
    }
    s.src = src;
    const ex = tgt.statuses.find((x) => x.key === s.key);
    if (ex) {
      ex.dur = Math.max(ex.dur, s.dur);
      if (s.dps && (!ex.dps || s.dps > ex.dps)) { ex.dps = s.dps; ex.src = src; }
    } else tgt.statuses.push(s);
    const label = s.label || STATUS_NAME[s.key];
    if (label) this.emit({ k: 'status', id: tgt.id, name: label });
    return true;
  }

  // ───────── 스킬 헬퍼
  stun(src: CUnit, tgt: CUnit, dur: number, chance = 1) { return this.applyStatus(src, tgt, { type: 'stun', key: 'stun', dur }, chance); }
  buff(src: CUnit, tgt: CUnit, key: string, dur: number, p: Partial<Status>) {
    return this.applyStatus(src, tgt, { type: 'buff', key, dur, ...p });
  }
  fx(x: number, y: number, r: number, elem: Elem) { this.emit({ k: 'fx', x, y, r, elem }); }
  lowestHpAlly(u: CUnit) {
    let best: CUnit | null = null, bp = 2;
    for (const a of this.alliesOf(u)) { const p = this.hpPct(a); if (p < bp) { bp = p; best = a; } }
    return best;
  }
  farthest(u: CUnit) {
    let best: CUnit | null = null, bd = -1;
    for (const e of this.enemiesOf(u)) { const d = this.dist(u, e); if (d > bd) { bd = d; best = e; } }
    return best;
  }
}

export function allMods(u: CUnit): Mod[] {
  const m = u.mods.slice();
  for (const s of u.statuses) if (s.mods) m.push(...s.mods);
  return m;
}
export function allTaken(u: CUnit): TakenMod[] {
  const m = u.taken.slice();
  for (const s of u.statuses) if (s.taken) m.push(...s.taken);
  return m;
}
/** 같은 종류: 증가는 합, 증폭은 최대값. 증가×증폭, 다른 종류끼리 곱. */
export function modMult(mods: Mod[], tags: DmgTag[]): number {
  let m = 1;
  for (const tag of tags) {
    let inc = 0, amp = 0;
    for (const x of mods) if (x.tag === tag) { if (x.kind === 'inc') inc += x.v; else amp = Math.max(amp, x.v); }
    m *= Math.max(0, 1 + inc) * (1 + amp);
  }
  return m;
}
export function takenMult(mods: TakenMod[], tags: DmgTag[], ignoreRed: boolean): number {
  let m = 1;
  for (const tag of tags) {
    let vuln = 0, red = 0;
    for (const x of mods) if (x.tag === tag) { if (x.kind === 'vuln') vuln += x.v; else red += x.v; }
    m *= (1 + vuln) * (ignoreRed ? 1 : 1 - Math.min(CFG.reductionCap, red));
  }
  return m;
}
