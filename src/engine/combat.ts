import { CFG } from '../config';
import { Rng } from '../rng';
import type { CType, DmgTag, Elem, FaithId, Keyword, Mod, Stats, StatKey, SynergyId, TakenMod, TType, UnitState, Weapon } from '../types';

export type StatusType = 'stun' | 'fear' | 'shock' | 'dot' | 'buff';
export const STATUS_NAME: Record<string, string> = {
  stun: '기절', fear: '공포', shock: '감전', poison: '중독', bleed: '출혈', corrode: '침식', decay: '부식', gloom: '암운', slow: '둔화', frenzy: '광폭', wound: '부상', suppress: '제압',
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
  /** 고정 피해 반사 (방어도 무시) */
  reflectTrue?: number;
  /** 중첩 수 (부상 · 방어도 감소 등) */
  stacks?: number;
  /** 받은 피해의 일부를 이 기물이 나눠 받는다 (린디웨) */
  share?: CUnit; shareRate?: number;
  /** 기록값 (프란체 심판) */
  rec?: number;
  /** 지속이 끝날 때 */
  onExpire?(b: Battle, u: CUnit, s: Status): void;
}

export interface DmgOpts {
  elem: Elem;
  tag: 'basic' | 'skill' | 'dot' | 'proc';
  /** 피해 유형: 사격 · 타격 · 기술 (지속 피해는 tag 'dot') */
  kind?: 'shoot' | 'strike' | 'tech';
  /** 추가 피해 태그 (콤보 · 피니쉬) */
  extra?: DmgTag[];
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
  /** 자신이 상태이상 · 버프를 걸었을 때 (적 · 아군 모두) */
  onInflict?(b: Battle, self: CUnit, tgt: CUnit, s: Status): void;
  /** 다른 아군이 피해를 받았을 때 */
  onAllyHurt?(b: Battle, self: CUnit, ally: CUnit, src: CUnit, r: DmgResult): void;
  /** 다른 아군이 전투 스킬을 썼을 때 */
  onAllySkill?(b: Battle, self: CUnit, caster: CUnit): void;
  /** 다른 아군이 기본 공격을 했을 때 */
  onAllyBasic?(b: Battle, self: CUnit, attacker: CUnit): void;
  /** 아군 · 적 누구든 쓰러졌을 때 */
  onAnyDeath?(b: Battle, self: CUnit, dead: CUnit, killer: CUnit | null): void;
  /** 한 칸 이동했을 때 */
  onMove?(b: Battle, self: CUnit): void;
  /** 신권 대행 발동 직후 */
  onDivine?(b: Battle, self: CUnit): void;
  /** 이성이 -50 이하로 떨어져 광폭에 들어갈 때 */
  onFrenzy?(b: Battle, self: CUnit): void;
}

/** 디바인 신권 대행 (rework.ts 에서 주입: 순환 import 방지) */
export const DIVINE_HOOK: { act?: (b: Battle, u: CUnit) => void } = {};

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
  counters: { dmg: number; taken: number; healed: number; kills: number; casts: number; shield: number; elem: Partial<Record<Elem, number>> };
  mem: Record<string, number>;
  /** 이번 전투에서만 가진 장비 (캠핑 러버 등) */
  tempItems?: string[];
  // ── 리워크: 무기 · 유형 · 이성 · 신성력
  weapon: Weapon | null;
  ammo: number; reloadT: number; combo: number;
  ctype?: CType; ttype?: TType;
  /** 사이오닉 이성 (-100 ~ +100), 없으면 null */
  reason: number | null;
  /** 디바인 신성력 게이지 (0~100), 없으면 null */
  div: number | null;
  divGot: number; divCap: number; divUsed: boolean;
  faith?: FaithId;
  src?: UnitState;
  owner?: CUnit;
  /** 일러스트 id (소환물 · 포탑) */
  art?: string;
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

export interface BattleCtx { phase: number; credits: number; field?: string; diff?: number }

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

  /** 진영별 전술 위력 (전투 시작 시 계산) */
  tac: [number, number] = [0, 0];

  /** 전장 크기: 가로 w × 세로 h (배치 구역 + 바깥 테두리 1칸) */
  constructor(public w: number, public h: number, public rng: Rng, public ctx: BattleCtx) {}

  /** 기술 위력 조회: 지휘관은 사격/타격/기술 대신 전술 위력 기반 */
  P(u: CUnit, k: 'shoot' | 'strike' | 'tech'): number {
    if (u.ctype === 'CMD' && !u.isSummon) return this.tacPower(u);
    return this.S(u, k);
  }
  tacPower(u: CUnit): number {
    const side = u.side;
    const boost = this.has(u, 'buff', 'div.oracle') || (this.mem[`oracle${side}`] || 0) > this.t ? 2 : 1;
    return Math.max(1, this.tac[side]) * boost * (1 + (u.mem.tacPct || 0));
  }
  computeTac() {
    for (const side of [0, 1] as const) {
      const us = this.units.filter((x) => x.side === side && !x.isSummon && x.alive);
      // 아군 (위력 단위, 출전 4명 · 지휘관 1명 = 100): 출전 기물 1명당 +16, 지휘관 1명 추가당 +40, 지휘관 정신력 1당 +2
      // 적: 기존 규칙을 위력 단위로 (8 × (20 - 2×인원 + 지휘관 2))
      const cmds = us.filter((c) => c.ctype === 'CMD');
      let v = side === 0
        ? CFG.tacBase + CFG.tacPerUnit * (us.length - 4) + CFG.tacPerCmd * (cmds.length - 1) + cmds.reduce((s, c) => s + CFG.tacPerMnd * (c.mem.mnd || 0), 0)
        : 8 * (20 - 2 * us.length + 2 * cmds.length);
      for (const c of us) v += c.mem.tacBonus || 0;
      this.tac[side] = Math.max(8, Math.round(v));
    }
  }

  // ───────── 이성 (사이오닉)
  addReason(u: CUnit, d: number) {
    if (u.reason === null || !u.alive || !d) return;
    const before = u.reason;
    u.reason = Math.max(-100, Math.min(100, before + d * (1 + (u.mem.reasonAmp || 0))));
    if (before > -50 && u.reason <= -50) {
      this.applyStatus(u, u, { type: 'buff', key: 'frenzy', dur: 999, mods: [{ kind: 'inc', tag: 'all', v: 0.3 }], label: '광폭' });
      this.emit({ k: 'status', id: u.id, name: '광폭!' });
      for (const h of u.hooks) h.onFrenzy?.(this, u);
    } else if (before <= -50 && u.reason > -50) {
      u.statuses = u.statuses.filter((s) => s.key !== 'frenzy');
    }
  }
  // ───────── 신성력 (디바인)
  addDiv(u: CUnit, v: number) {
    if (u.div === null || !u.alive || v <= 0 || u.divGot >= u.divCap) return;
    const g = Math.min(v * (1 + (u.mem.divBoost || 0)), u.divCap - u.divGot);
    u.divGot += g;
    u.div = Math.min(100, u.div + g);
    if (u.div >= 100 && !u.divUsed) {
      u.divUsed = true;
      u.div = 0;
      this.emit({ k: 'skill', id: u.id, name: '신권 대행' });
      DIVINE_HOOK.act?.(this, u);
      for (const h of u.hooks) h.onDivine?.(this, u);
    }
  }

  // ───────── 조회
  get over() { return this.winner !== null; }
  living(side?: 0 | 1) { return this.units.filter((u) => u.alive && (side === undefined || u.side === side)); }
  enemiesOf(u: CUnit) { return this.living(u.side === 0 ? 1 : 0); }
  alliesOf(u: CUnit, includeSelf = true) { return this.living(u.side).filter((a) => includeSelf || a !== u); }
  dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  unitAt(x: number, y: number) { return this.units.find((u) => u.alive && u.x === x && u.y === y) || null; }
  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
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
    for (let r = 1; r < Math.max(this.w, this.h); r++)
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
      if (u.weapon?.kind === 'mag') u.ammo = u.weapon.mag || 1;
    }
    this.computeTac();
    for (const u of this.units.slice()) { this.actor = u; for (const h of u.hooks) h.onStart?.(this, u); }
    this.actor = null;
    for (const u of this.units) u.hp = Math.min(u.hp, this.S(u, 'maxHp'));
  }
  /** 지금 행동 중인 기물 (보호막 제공자 집계용) */
  actor: CUnit | null = null;

  // ───────── 메인 루프
  step(dt: number) {
    if (this.over) return;
    this.t += dt;
    for (const u of this.units) {
      if (!u.alive) continue;
      this.actor = u;
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
    // 광폭: 초당 최대 체력 2% 지속 피해 (광폭 제어 증강이면 없음)
    if (u.reason !== null && u.reason <= -50 && !u.mem.calmFrenzy) {
      u.mem.frenzyT = (u.mem.frenzyT || 0) + dt;
      if (u.mem.frenzyT >= 1) { u.mem.frenzyT = 0; this.dealDamage(u, u, this.S(u, 'maxHp') * 0.02, { elem: 'true', tag: 'dot', noHooks: true }); if (!u.alive) return; }
    }
    const gone = u.statuses.filter((s) => s.dur <= 0 && s.onExpire);
    u.statuses = u.statuses.filter((s) => s.dur > 0);
    for (const s of gone) s.onExpire!(this, u, s);
  }

  private act(u: CUnit, dt: number) {
    const stunned = this.has(u, 'stun');
    if (u.moveT > 0) { u.moveT -= dt; if (u.moveT <= 0) { u.px = u.x; u.py = u.y; } }
    if (stunned) return;
    if (!this.has(u, 'shock')) u.cd -= dt * (1 + this.S(u, 'cdr'));
    u.atkTimer -= dt * Math.max(0.2, 1 + this.S(u, 'atkSpd'));
    if (u.reloadT > 0) {
      u.reloadT -= dt * Math.max(0.2, 1 + this.S(u, 'reloadSpd'));
      if (u.reloadT <= 0) { u.reloadT = 0; u.ammo = u.weapon?.mag || 1; }
    }
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
          for (const a of this.alliesOf(u, false)) for (const h of a.hooks) h.onAllySkill?.(this, a, u);
          if (this.over) return;
        }
      }
    }
    if (!t2.alive || u.noAttack) return;
    if (d <= range) {
      if (!feared && u.atkTimer <= 0 && u.reloadT <= 0) {
        const tgt2 = u.mem.lowestFocus ? this.lowestEnemy(u) || t2 : t2;
        this.basicAttack(u, tgt2);
        u.atkTimer = u.atk.interval;
        if (u.weapon?.kind === 'mag' && --u.ammo <= 0) u.reloadT = u.weapon.reload || 1.5;
      }
    } else if (!u.immobile) {
      this.moveToward(u, t2, range);
    }
  }

  basicAttack(u: CUnit, tgt: CUnit, coef = 1) {
    const w = u.weapon;
    const kind = u.atk.type;
    const pow = w?.tactical ? this.tacPower(u) : this.S(u, kind);
    const extra: DmgTag[] = [];
    let m = (w?.mult ?? 1) * coef;
    if (w?.kind === 'combo') {
      u.combo++;
      if (u.combo >= (w.combo || 3)) { u.combo = 0; m *= CFG.finishMult; extra.push('finish'); u.mem.finished = 1; }
      else { extra.push('combo'); u.mem.finished = 0; }
    }
    // 심판의 탄환 (명사수 신권 대행): 신성 관통탄
    const holy = (u.mem.holyShots || 0) > 0;
    if (holy) u.mem.holyShots--;
    const elem = holy ? 'holy' : u.atk.elem;
    this.emit({ k: 'atk', from: u.id, to: tgt.id, elem, ranged: u.atk.type === 'shoot' });
    const r = this.dealDamage(u, tgt, pow * m, { elem, tag: 'basic', kind, canMiss: true, extra, pen: holy ? 1 : 0 });
    for (const h of u.hooks) h.onBasic?.(this, u, tgt, r);
    for (const a of this.alliesOf(u, false)) for (const h of a.hooks) h.onAllyBasic?.(this, a, u);
    return r;
  }
  lowestEnemy(u: CUnit) {
    const es = this.enemiesOf(u).filter((e) => this.dist(u, e) <= this.S(u, 'range'));
    return es.length ? es.reduce((a, c) => (this.hpPct(c) < this.hpPct(a) ? c : a)) : null;
  }

  private moveToward(u: CUnit, tgt: CUnit, range: number) {
    // BFS: 대상이 사거리 안에 들어오는 가장 가까운 빈 칸으로
    const n = this.w;
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
    for (const h of u.hooks) h.onMove?.(this, u);
  }

  // ───────── 피해 / 회복
  dealDamage(src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
    const res: DmgResult = { amount: 0, crit: false, miss: false, graze: false, killed: false };
    if (!tgt.alive || base <= 0) return res;
    let dmg = base;
    // 제압: 다음 공격 피해 1
    if (o.tag !== 'dot' && o.tag !== 'proc' && src.statuses.some((s) => s.key === 'suppress')) {
      src.statuses = src.statuses.filter((s) => s.key !== 'suppress');
      dmg = Math.min(dmg, 1);
    }
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
    // 치명타: 사격 · 타격 피해만 (기술 피해는 기술 치명 특성이 있을 때만, 지속 피해 없음)
    const canCrit = o.tag !== 'dot' && (o.kind === 'shoot' || o.kind === 'strike' || (o.kind === 'tech' && src.mem.techCrit));
    if (dmg > 0 && canCrit && !res.miss) {
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
      const tags: DmgTag[] = ['all', o.elem, o.tag, ...(o.kind && o.tag !== 'dot' ? [o.kind] : []), ...(o.extra || [])];
      dmg *= modMult(allMods(src), tags) * src.phaseAmp;
      // 이성: 낮을수록 주는 정신 피해 증폭, 높을수록 받는 정신 · 신성 피해 감소
      if (src.reason !== null && src.reason < 0 && o.elem === 'psy') dmg *= 1 + 0.6 * (-src.reason / 100) * (1 + (src.mem.abyss || 0));
      if (tgt.reason !== null && tgt.reason > 0 && (o.elem === 'psy' || o.elem === 'holy')) dmg *= 1 - 0.3 * (tgt.reason / 100) * (1 + (tgt.mem.bulwark || 0));
      dmg *= takenMult(allTaken(tgt), tags, isTrue);
      for (const h of src.hooks) if (h.dmgMult) dmg *= h.dmgMult(this, src, tgt, o);
      for (const h of tgt.hooks) if (h.takenMult) dmg *= h.takenMult(this, tgt, src, o);
      if (this.t > CFG.overtimeStart) dmg *= 1 + (this.t - CFG.overtimeStart) * CFG.overtimeRamp;
    }
    dmg = Math.max(0, dmg);
    if ((tgt.mem.invulnUntil || 0) > this.t) dmg = 0; // 성전 돌입 무적
    // 피해 분담 (린디웨 특별경호팀)
    const sh = dmg > 0 && o.tag !== 'dot' ? tgt.statuses.find((s) => s.share && s.share !== tgt && s.share.alive) : undefined;
    if (sh) {
      const part = dmg * (sh.shareRate || 0.5);
      dmg -= part;
      const g = sh.share!;
      let l2 = part;
      if (g.shield > 0) { const a = Math.min(g.shield, l2); g.shield -= a; l2 -= a; }
      g.hp -= l2; g.counters.taken += part;
      if (g.hp <= 0) this.kill(g, src);
    }
    res.amount = dmg;
    // 심판 기록 (프란체): 아군이 준 피해의 일부를 쌓는다
    if (dmg > 0 && src.side !== tgt.side) for (const s of tgt.statuses) if (s.rec !== undefined && s.src && s.src.side === src.side) s.rec += dmg * 0.2;
    if (dmg > 0) {
      let left = dmg;
      if (tgt.shield > 0) { const a = Math.min(tgt.shield, left); tgt.shield -= a; left -= a; }
      tgt.hp -= left;
      src.counters.dmg += dmg;
      src.counters.elem[o.elem] = (src.counters.elem[o.elem] || 0) + dmg;
      tgt.counters.taken += dmg;
      if (src.side === 0 && dmg > this.counters.bestHit) this.counters.bestHit = dmg;
    }
    this.emit({ k: 'dmg', id: tgt.id, v: dmg, crit: res.crit, miss: res.miss, graze: res.graze, elem: o.elem });
    if (dmg > 0 && !o.noHooks) {
      const ls = this.S(src, 'lifesteal') + (src.reason !== null && src.reason < 0 ? 0.2 * (-src.reason / 100) : 0);
      if (ls > 0 && src.alive) this.heal(src, src, dmg * ls, true);
      for (const h of src.hooks) h.onDeal?.(this, src, tgt, res, o);
      if (tgt.alive) for (const h of tgt.hooks) h.onHurt?.(this, tgt, src, res, o);
      if (src !== tgt) for (const a of this.alliesOf(tgt, false)) for (const h of a.hooks) h.onAllyHurt?.(this, a, tgt, src, res);
      if (o.tag !== 'proc' && src.alive && src !== tgt) {
        let rf = 0, rt = 0;
        for (const s of tgt.statuses) { rf += s.reflect || 0; rt += s.reflectTrue || 0; }
        if (rf > 0) this.dealDamage(tgt, src, dmg * rf, { elem: 'phys', tag: 'proc', noHooks: true });
        if (rt > 0 && src.alive) this.dealDamage(tgt, src, dmg * rt, { elem: 'true', tag: 'proc', noHooks: true });
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
    for (const a of this.living()) for (const h of a.hooks) h.onAnyDeath?.(this, a, u, by);
    // 소환자가 죽으면 소환물도 소멸
    for (const s of this.units) if (s.owner === u && s.alive) { s.alive = false; this.emit({ k: 'die', id: s.id }); }
    if (!this.living(0).length) this.winner = 1;
    else if (!this.living(1).length) this.winner = 0;
  }

  heal(src: CUnit, tgt: CUnit, amt: number, raw = false) {
    if (!tgt.alive || amt <= 0) return 0;
    if (this.consumeWound(tgt)) return 0;
    let a = amt;
    if (!raw) {
      a *= 1 + this.S(tgt, 'healEff');
      for (const h of src.hooks) if (h.healMult) a *= h.healMult(this, src, tgt);
      a *= this.supportMult(src, tgt);
    }
    const max = this.S(tgt, 'maxHp');
    const real = Math.min(a, max - tgt.hp);
    tgt.hp += real;
    src.counters.healed += real;
    if (real >= 1) this.emit({ k: 'heal', id: tgt.id, v: real });
    if (!raw) for (const h of src.hooks) h.onHealDone?.(this, src, tgt, real, a - real);
    return real;
  }

  /** 이성: 지원(회복·보호막) 효율 — 주는 쪽 이성이 높을수록 +, 받는 쪽 이성이 음수면 - */
  supportMult(src: CUnit, tgt: CUnit) {
    let m = 1;
    if (src !== tgt && src.reason !== null && src.reason > 0) m *= 1 + 0.3 * (src.reason / 100) * (1 + (src.mem.bulwark || 0));
    if (src !== tgt && tgt.reason !== null && tgt.reason < 0) m *= 1 - 0.5 * (-tgt.reason / 100);
    return m;
  }
  /** 부상 중첩이 있으면 회복 · 보호막 1회를 대신 소모한다 */
  consumeWound(tgt: CUnit) {
    const w = tgt.statuses.find((s) => s.key === 'wound' && (s.stacks || 0) > 0);
    if (!w) return false;
    w.stacks!--;
    if (!w.stacks) w.dur = 0;
    return true;
  }

  shield(tgt: CUnit, amt: number) {
    if (!tgt.alive || amt <= 0) return;
    if (this.consumeWound(tgt)) return;
    const giver0 = this.actor && this.actor.side === tgt.side ? this.actor : tgt;
    amt *= this.supportMult(giver0, tgt);
    const before = tgt.shield;
    tgt.shield = Math.min(this.S(tgt, 'maxHp'), tgt.shield + amt);
    const giver = giver0;
    giver.counters.shield += tgt.shield - before;
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
    // 축복 거부 (아르곤): 다른 기물이 거는 이로운 버프를 받지 않는다
    if (!hostile && src !== tgt && tgt.mem.noBless && s.type === 'buff' && (s.mods?.some((m) => m.v > 0) || Object.values(s.delta || {}).some((v) => (v as number) > 0))) return false;
    s.src = src;
    for (const h of src.hooks) h.onInflict?.(this, src, tgt, s);
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
