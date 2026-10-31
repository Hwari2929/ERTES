import type { Battle, CUnit, DmgResult, EnemyTend, Hooks, SkillDef } from '../engine/combat';
import { CFG } from '../config';
import type { CType, Elem, Keyword, TType } from '../types';
import { bleed, blinkTo, corrode, fear, lineTargets, poison, skillHit } from './kit';

/** 지휘 · 강화 패시브: period 초마다 (첫 발동 first 초), 전투 스킬과 따로 돈다 (스킬 한쪽 원칙).
 *  교전 중이 아니거나 (reach 칸 안에 적이 없으면) 기절 · 공포 중이면 미뤄 두었다가 조건이 되면 발동 — 예전 스킬 시전 조건과 같게 */
function command(b: Battle, u: CUnit, key: string, dt: number, period: number, first: number, reach = 99) {
  u.mem[key] = (u.mem[key] ?? first) - dt;
  if (u.mem[key] > 0 || !b.around(u, reach, b.enemiesOf(u)).length || b.has(u, 'stun') || b.has(u, 'fear')) return false;
  u.mem[key] = period;
  return true;
}

export interface EnemyDef {
  id: string;
  name: string;
  keywords: Keyword[];
  sprite: string;
  palette: string[];
  tier: 'minion' | 'elite' | 'boss';
  /** 성향: 표적을 고르는 방식 (도발 수치에 곱하는 가중치) */
  tend: EnemyTend;
  minPhase: number;
  hp: number; power: number; armor: number;
  acc?: number; eva?: number; crit?: number; effHit?: number; effRes?: number;
  interval: number; range: number; moveSpd?: number;
  atk: { type: 'shoot' | 'strike'; elem: Elem };
  immobile?: boolean;
  melee: boolean;
  skill?: SkillDef;
  onBasic?: (b: Battle, u: CUnit, t: CUnit, r: DmgResult) => void;
  onTick?: (b: Battle, u: CUnit, dt: number) => void;
  escort?: string[];
  /** 장비 3칸 · 개조부품 (적 전용 장비는 추후 설계) */
  items?: (string | null)[];
  mod?: string | null;
  /** 표시용 유형 (없으면 enemyTypes 가 추정) */
  ctype?: CType; ttype?: TType;
  /** 기본 공격을 하지 않는다 (지원 드론 · 장애물) */
  noAttack?: boolean;
  /** 전장 장애물: 대상 지정 · 승패 판정에서 빠진다 (반려 돌 · 묘석) */
  inert?: boolean;
  /** 그 밖의 전투 훅 (받는 피해 · 주는 피해 배율 등) */
  hooks?: Hooks;
  /** 다른 적의 초상화를 빌려 쓴다 (portraits.gen 키, 예: 'en_sw_brood') */
  art?: string;
  /** 구조물을 세우는 적: 분대 역할 '공병' (data/squads.ts 공병단) */
  builder?: boolean;
  /** 대형 적: 가로 w × 세로 h 칸을 한 기물이 차지한다 (체력 공유 · 움직이지 않음, engine/build.ts linkGroup · CFG.foeKit.big) */
  size?: { w: number; h: number };
}

/** 적 전투 유형 · 전술 유형: 지정값 우선, 없으면 공격 방식 · 키워드로 추정 */
export function enemyTypes(e: EnemyDef): { ctype: CType; ttype: TType } {
  const mystic = e.atk.elem === 'psy' || e.atk.elem === 'holy' || e.keywords.includes('phantom');
  const ctype: CType = e.ctype ?? (e.escort?.length ? 'CMD' : e.melee ? 'VAN' : mystic || e.atk.elem === 'chem' ? 'SPEC' : 'MARK');
  const ttype: TType = e.ttype ?? (e.atk.elem === 'holy' ? 'divine' : mystic ? 'psionic' : e.tier === 'boss' ? 'special' : e.tier === 'elite' ? 'major' : 'minor');
  return { ctype, ttype };
}

const RAIDER = ['#1a0f0a', '#7a5a3a', '#c04a2a', '#d0a080', '#ff5030', '#55504a', '#f0d0a0'];
const MACHINE = ['#0c0e12', '#6a7480', '#3a4048', '#9aa4ae', '#ff3040', '#40464e', '#d8e0e8'];
const VOID = ['#0a0612', '#4a2a7a', '#8a5ad0', '#c0a0ff', '#ff60e0', '#30204a', '#f0e0ff'];
const BUG = ['#0a120a', '#4a7a2a', '#a0d040', '#c0e080', '#ffe040', '#2a402a', '#e0ffc0'];
// 전장별 팔레트
const SWARM = ['#120a0e', '#6a2a3a', '#b04a5a', '#d08a8a', '#ffd040', '#3a1a24', '#f0c0c0'];
const SWARM2 = ['#0e0a12', '#5a3a6a', '#9a5aa0', '#c8a0d0', '#a0ff60', '#2a1a34', '#e8d0f0'];
const SWARM_ELITE = ['#120a0a', '#7a2a2a', '#d05030', '#e0a080', '#a0ff60', '#3a1a1a', '#ffe0c0'];
const SWARM_BOSS = ['#0a0408', '#5a0a2a', '#e03070', '#ff90b0', '#ffff60', '#2a0418', '#ffe0f0'];
const CRIMSON = ['#100406', '#4a0a14', '#8a1a2a', '#d0a0a0', '#ff2030', '#2a0a10', '#f0d0d0'];
const CRIMSON2 = ['#100408', '#3a1028', '#7a2a5a', '#c0a0c0', '#ff4060', '#24081a', '#f0d0e0'];
const CRIMSON_ELITE = ['#0a0204', '#6a0a18', '#c02030', '#e0c0a0', '#ffd040', '#30060c', '#fff0e0'];
const CRIMSON_BOSS = ['#080002', '#3a0008', '#a00818', '#ffd0a0', '#ffffff', '#200004', '#fff0d0'];
const SPARTA = ['#0c0a06', '#8a6a3a', '#4a4030', '#d0b080', '#ff6020', '#5a4a30', '#f0e0c0'];
const SPARTA_ELITE = ['#0c0a06', '#b08a30', '#5a4a30', '#f0d080', '#ff3020', '#6a5a30', '#fff0c0'];
const SPARTA_BOSS = ['#0a0604', '#c09030', '#3a2a18', '#ffe0a0', '#ff2010', '#5a3a18', '#fff8e0'];
const PETRA = ['#0c0c10', '#3a3f58', '#e07a1f', '#c8ccd8', '#ffb040', '#2a2e40', '#ffffff'];
const PETRA_ELITE = ['#0c0c10', '#24242e', '#3a5ab0', '#d0d4e0', '#d4a83a', '#1a1a24', '#ffffff'];
const UNIX = ['#0c0c0c', '#b0b0a0', '#6a6a60', '#e0e0d0', '#30ff60', '#4a4a40', '#ffffff'];
const ANOMALY = ['#06060a', '#2a2a3a', '#6060a0', '#a0a0ff', '#ffffff', '#1a1a2a', '#e0e0ff'];
const ANOMALY_BOSS = ['#040408', '#1a1a2a', '#4040ff', '#c0c0ff', '#ff3040', '#0a0a1a', '#ffffff'];
// 신규 전장
const SEPIA = ['#140e08', '#8a6a48', '#c8a070', '#e8d0a8', '#ff7040', '#4a3a28', '#fff0d8'];
const SEPIA_ELITE = ['#140e08', '#6a4a30', '#e0b060', '#f0e0c0', '#ff4020', '#3a2a18', '#fff8e8'];
const SEPIA_BOSS = ['#0c0804', '#a07040', '#f0c080', '#fff0d0', '#40ff80', '#5a3a20', '#ffffff'];
const SIRIUS = ['#0c0c14', '#b8b090', '#f0e8c0', '#ffffff', '#ffd040', '#6a6450', '#fffff0'];
const SIRIUS_BOSS = ['#08080e', '#d0b060', '#fff0b0', '#ffffff', '#ff6040', '#7a6430', '#ffffff'];
const FLOAT = ['#0e0812', '#6a3a8a', '#b070d0', '#e0c0f0', '#a0ff60', '#3a2048', '#f8e8ff'];
const FLOAT_BOSS = ['#0a040e', '#7a2a9a', '#d080ff', '#f0d0ff', '#e0ff40', '#40105a', '#ffffff'];
const BIRD = ['#0e0c06', '#5a6a2a', '#a0b050', '#d8e0a0', '#ff6020', '#2a3418', '#f0f8d0'];
const BIRD_ELITE = ['#0e0a04', '#7a5a1a', '#c09030', '#e8d090', '#ff3010', '#3a2a10', '#fff0c0'];
const BIRD_BOSS = ['#0a0604', '#6a3a10', '#b06020', '#f0c080', '#ffe040', '#3a1a08', '#fff0d0'];
const NEON = ['#08060e', '#3a2a5a', '#e040a0', '#a0e0ff', '#40ffe0', '#1a1430', '#f0e0ff'];
const NEON_ELITE = ['#0a040a', '#5a1a4a', '#ff3080', '#ffb0d0', '#ffff40', '#2a0a24', '#ffe0f0'];
const NEON_BOSS = ['#06040c', '#2a1a5a', '#a040ff', '#d0b0ff', '#40ffe0', '#140a30', '#ffffff'];
const CHROME = ['#0a0c10', '#8090a8', '#40485a', '#d0e0f0', '#ff3080', '#2a3040', '#ffffff'];
const CHROME_BOSS = ['#080a0e', '#a0b0c8', '#30384a', '#e8f0ff', '#ff2060', '#20283a', '#ffffff'];
const GHOST = ['#0a0c12', '#a0b0c0', '#d8e0e8', '#f0f8ff', '#80e0ff', '#5a6a7a', '#ffffff'];
const GHOST_ELITE = ['#0a0c10', '#8a9aa0', '#c0d0c8', '#f0fff8', '#ffe080', '#4a5a5a', '#ffffff'];
const GHOST_BOSS = ['#06080c', '#c0c8a0', '#f0f0d0', '#ffffff', '#ffd060', '#6a6a50', '#ffffff'];
const STONE = ['#0e0e0e', '#8a8a86', '#5a5a58', '#c8c8c0', '#a0a098', '#3a3a38', '#e8e8e0'];
const RING = ['#0a0a0c', '#7a7060', '#3a3a3a', '#d0c8a8', '#60c0ff', '#2a2a2a', '#fff8e0'];
const BLACKCLOUD = ['#06060a', '#1a1a24', '#3a3a50', '#c0b080', '#ffd040', '#10101a', '#f0e8c0'];
const BLACKCLOUD_BOSS = ['#040406', '#14141c', '#2a2a3c', '#e0c070', '#60e0ff', '#0a0a12', '#fff4d0'];
const MAID = ['#0c0c0c', '#202020', '#e0e0e0', '#ffffff', '#ff5080', '#404040', '#ffffff'];
const ASH = ['#0e0e10', '#6a6a70', '#9a9aa0', '#d0d0d4', '#ff9040', '#3a3a40', '#f0f0f0'];
const UNIX_ELITE = ['#0c0c0c', '#c0c0a0', '#4a6a50', '#e0f0d0', '#30ffa0', '#3a4a3a', '#ffffff'];
const UNIX_BOSS = ['#080808', '#d0d0c0', '#505048', '#f0f0e8', '#30ff60', '#30302a', '#ffffff'];
const BANK = ['#0c0a06', '#2a2418', '#c8a040', '#f0e0b0', '#ffe060', '#4a3a20', '#fff8e0'];
const BANK_ELITE = ['#0c0a06', '#1a2a3a', '#d0a840', '#f0e8c8', '#40e0ff', '#2a3040', '#ffffff'];
const VAULT = ['#080604', '#5a4a20', '#e0c060', '#fff0c0', '#ffffff', '#3a2a10', '#fffbe8'];
const PALE = ['#0e0c0c', '#8a8078', '#c8c0b0', '#e8e0d8', '#ff6060', '#4a4440', '#fff8f0'];
const TOMB = ['#0a0606', '#6a3a3a', '#c06a6a', '#f0c0b0', '#ffe0a0', '#3a1a1a', '#fff0e8'];
const TOMB_BOSS = ['#080404', '#7a2020', '#e05050', '#ffc0b0', '#e0ff80', '#3a0a0a', '#fff0e0'];
// 공용 기믹 적 (mx_*): 여러 전장의 풀에 함께 들어간다
const MERC = ['#0e0d0c', '#5a5448', '#8a7a5a', '#cfc4a8', '#ffb040', '#34302a', '#f4ecd8'];
const MERC_ELITE = ['#0c0c0e', '#3a4a5a', '#c08a3a', '#d8d0c0', '#ffd060', '#22303c', '#fff4e0'];
const MERC_BIG = ['#0a0c0e', '#4a5258', '#6a6a58', '#c0c4b8', '#ff7030', '#2a3036', '#eef0e8'];
const SMUG = ['#0c0a06', '#4a3a1a', '#d0a030', '#f0e0a0', '#fff080', '#2a2010', '#fffbe0'];
/** 공병이 세운 구조물 · 지휘관이 부른 징집병처럼 주인이 있는 소환물: 주인이 쓰러지면 함께 사라진다 (Battle.kill) */
function ownedSpawn(b: Battle, u: CUnit, defId: string, cell: { x: number; y: number }, exact = false) {
  const o = ENEMY_RT.spawn?.(b, defId, cell, { summon: true, mult: u.mem.mult, exact });
  if (o) o.owner = u;
  return o || null;
}
const ownedAlive = (b: Battle, u: CUnit, ids: string[]) => b.units.filter((x) => x.alive && x.owner === u && ids.includes(x.defId)).length;
/** 밀수 운반책: 아군 기물(플레이어 쪽)에게서 먼 쪽 빈칸으로 1칸 (움직이는 중 · 기절 · 속박 중이면 제자리) */
function runAway(b: Battle, u: CUnit) {
  if (u.moveT > 0 || b.has(u, 'stun') || u.statuses.some((s) => s.key === 'root')) return;
  const foes = b.enemiesOf(u).filter((e) => !e.mem.inert);
  if (!foes.length) return;
  const score = (x: number, y: number) => Math.min(6, ...foes.map((e) => b.dist(e, { x, y }))) * 10 - Math.abs(x - (b.w - 1) / 2) * 0.1;
  let best: { x: number; y: number } | null = null, bs = score(u.x, u.y);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = u.x + dx, y = u.y + dy;
      if ((!dx && !dy) || !b.inBounds(x, y) || b.unitAt(x, y)) continue;
      const sc = score(x, y) - (dx && dy ? 0.01 : 0);
      if (sc > bs) { bs = sc; best = { x, y }; }
    }
  if (!best) return;
  u.px = u.x; u.py = u.y;
  u.x = best.x; u.y = best.y;
  u.moveDur = u.moveT = CFG.moveTime / b.S(u, 'moveSpd');
}
const K = () => CFG.foeKit;
/** 카운티폴 광대 (반상회장이 은신시키는 대상) */
const CLOWNS = new Set(['cf_neighbor', 'cf_dog', 'sw_spitter', 'cf_model']);

export const ENEMIES: EnemyDef[] = [
  { id: 'raider', name: '약탈자 척후병', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: RAIDER, tier: 'minion', minPhase: 1,
    hp: 420, power: 30, armor: 120, acc: 0.05, eva: 0.05, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'gunner', name: '약탈자 사수', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: RAIDER, tier: 'minion', minPhase: 1,
    hp: 320, power: 28, armor: 80, acc: 0.1, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'drone', name: '정찰 드론', tend: 'assassin', keywords: ['mech'], sprite: 'drone', palette: MACHINE, tier: 'minion', minPhase: 1,
    hp: 230, power: 20, armor: 60, eva: 0.15, interval: 0.7, range: 2, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'crawler', name: '산성 크롤러', tend: 'charge', keywords: ['bio'], sprite: 'crawler', palette: BUG, tier: 'minion', minPhase: 1,
    hp: 380, power: 24, armor: 100, interval: 0.9, range: 1, moveSpd: 1.2, atk: { type: 'strike', elem: 'chem' }, melee: true,
    onBasic: (b, u, t) => { poison(b, u, t, b.S(u, 'strike') * 0.25, 3, 0.5); } },
  { id: 'trooper', name: '강습 기갑병', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: MACHINE, tier: 'minion', minPhase: 2,
    hp: 700, power: 32, armor: 350, interval: 1.3, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '충격 강타', cd: 10, needsRange: true, params: {}, desc: () => '주변 적 기절',
      cast(b, u) { b.fx(u.x, u.y, 1, 'phys'); for (const e of b.around(u, 1, b.enemiesOf(u))) { skillHit(b, u, e, 'strike', 1.0, 'phys'); b.stun(u, e, 1, 0.7); } return true; },
    } },
  { id: 'turret', name: '방어 포탑', tend: 'sniper', keywords: ['struct', 'mech'], sprite: 'turret', palette: MACHINE, tier: 'minion', minPhase: 2,
    hp: 600, power: 34, armor: 300, acc: 0.1, interval: 1.2, range: 4, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'wraith', name: '공허 환영', tend: 'assassin', keywords: ['phantom'], sprite: 'phantom', palette: VOID, tier: 'minion', minPhase: 2,
    hp: 300, power: 30, armor: 40, eva: 0.25, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false },
  { id: 'priest', name: '사이오닉 사제', tend: 'escort', keywords: ['bio', 'phantom'], sprite: 'medic', palette: VOID, tier: 'minion', minPhase: 3,
    hp: 340, power: 24, armor: 80, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    skill: {
      name: '공허 치유', cd: 6, params: {}, desc: () => '아군 회복',
      cast(b, u) { const l = b.lowestHpAlly(u); if (!l || b.hpPct(l) > 0.85) return false; b.fx(l.x, l.y, 0, 'psy'); b.heal(u, l, b.S(u, 'tech') * 3); return true; },
    } },
  { id: 'warlord', name: '약탈자 두목', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: ['#1a0a0a', '#a02020', '#e0a020', '#d0a080', '#ffe040', '#55504a', '#fff0a0'],
    tier: 'elite', minPhase: 1, hp: 1100, power: 42, armor: 250, acc: 0.1, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '두목의 일격', cd: 8, needsRange: true, params: {}, desc: () => '주변 광역 베기',
      cast(b, u) {
        b.fx(u.x, u.y, 1, 'phys');
        for (const e of b.around(u, 1, b.enemiesOf(u))) skillHit(b, u, e, 'strike', 1.5, 'phys');
        return true;
      },
    },
    // 약탈 명령: 8초마다 아군 강화 (스킬과 별도)
    onTick: (b, u, dt) => {
      if (!command(b, u, 'cmdT', dt, 8, 4, 1)) return;
      b.emit({ k: 'status', id: u.id, name: '약탈 명령' });
      for (const a of b.alliesOf(u)) b.buff(u, a, 'warlord', 4, { mods: [{ kind: 'inc', tag: 'all', v: 0.2 }], label: '약탈 명령' });
    } },
  // ───────── 보스
  { id: 'varga', name: '약탈 함장 바르가', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: ['#1a0a0a', '#601818', '#e0a020', '#d0a080', '#ff3020', '#55504a', '#fff0a0'],
    tier: 'boss', minPhase: 1, hp: 3200, power: 50, armor: 300, acc: 0.15, effRes: 0.3, interval: 1.1, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['raider', 'gunner'],
    skill: {
      name: '함장의 강타', cd: 9, needsRange: true, params: {}, desc: () => '대상 강타',
      cast(b, u) {
        const t = u.target; if (!t?.alive) return false;
        b.fx(t.x, t.y, 0, 'phys');
        skillHit(b, u, t, 'strike', 2.2, 'phys');
        return true;
      },
    },
    // 함장의 호령: 9초마다 아군 광폭화 (스킬과 별도)
    onTick: (b, u, dt) => {
      if (!command(b, u, 'cmdT', dt, 9, 4.5, 1)) return;
      b.emit({ k: 'status', id: u.id, name: '함장의 호령' });
      for (const a of b.alliesOf(u)) b.buff(u, a, 'varga', 5, { delta: { atkSpd: 0.3 }, mods: [{ kind: 'inc', tag: 'all', v: 0.3 }], label: '광폭화' });
    } },
  { id: 'goliath', name: '강철 군주 골리앗', tend: 'charge', keywords: ['mech', 'struct'], sprite: 'mech', palette: ['#0c0e12', '#8a6a30', '#3a4048', '#c0c8d0', '#30d0ff', '#40464e', '#fff0c0'],
    tier: 'boss', minPhase: 2, hp: 3600, power: 44, armor: 380, effRes: 0.3, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '지진 강타', cd: 7, params: {}, desc: () => '주변 2칸 전기 피해 + 기절',
      cast(b, u) {
        const es = b.around(u, 2, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 2, 'elec');
        for (const e of es) { skillHit(b, u, e, 'tech', 1.2, 'elec', { noMiss: true }); b.stun(u, e, 1, 0.5); }
        return true;
      },
    },
    onTick: (b, u, dt) => {
      u.mem.summon = (u.mem.summon || 0) + dt;
      if (u.mem.summon >= 15) { u.mem.summon = 0; summonHook?.(b, u, 'drone', 2); }
    } },
  { id: 'nyx', name: '공허의 여왕 닉스', tend: 'sniper', keywords: ['phantom'], sprite: 'phantom', palette: ['#0a0612', '#2a0a4a', '#d050ff', '#ffb0ff', '#ffffff', '#30204a', '#ffe0ff'],
    tier: 'boss', minPhase: 3, hp: 3000, power: 48, armor: 150, eva: 0.2, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    escort: ['wraith', 'wraith'],
    skill: {
      name: '공허 파동', cd: 6, params: {}, desc: () => '3칸 내 모든 적 정신 피해 + 공포',
      cast(b, u) {
        const es = b.around(u, 3, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 3, 'psy');
        for (const e of es) { skillHit(b, u, e, 'tech', 1.0, 'psy', { noMiss: true }); fear(b, u, e, 1.5, 0.4); }
        return true;
      },
    } },
  // ═════════ 전장별 적 (플레이스홀더 스프라이트: 나중에 에셋으로 교체)
  // ── 군체 (연합 · 베르타–산노디스 물류망)
  { id: 'sw_spore', name: '포자 살점', tend: 'charge', keywords: ['bio'], sprite: 'crawler', palette: SWARM, tier: 'minion', minPhase: 1,
    hp: 360, power: 24, armor: 80, interval: 0.9, range: 1, moveSpd: 1.1, atk: { type: 'strike', elem: 'chem' }, melee: true,
    onBasic: (b, u, t) => { poison(b, u, t, b.S(u, 'strike') * 0.2, 3, 0.5); } },
  { id: 'sw_hound', name: '군체 사냥개체', tend: 'assassin', keywords: ['bio'], sprite: 'beast', palette: SWARM, tier: 'minion', minPhase: 1,
    hp: 320, power: 28, armor: 70, eva: 0.1, interval: 0.7, range: 1, moveSpd: 1.5, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'sw_spitter', name: '산성 분사체', tend: 'sniper', keywords: ['bio'], sprite: 'crawler', palette: SWARM2, tier: 'minion', minPhase: 1,
    hp: 280, power: 26, armor: 60, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    onBasic: (b, u, t) => { corrode(b, u, t, 0.85, 3, 0.3); } },
  { id: 'sw_carrier', name: '마부 개체', tend: 'charge', keywords: ['bio'], sprite: 'beast', palette: SWARM2, tier: 'minion', minPhase: 2,
    hp: 900, power: 30, armor: 230, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '짓밟기', cd: 10, needsRange: true, params: {}, desc: () => '주변 적 피해 + 기절',
      cast(b, u) { b.fx(u.x, u.y, 1, 'phys'); for (const e of b.around(u, 1, b.enemiesOf(u))) { skillHit(b, u, e, 'strike', 1.0, 'phys'); b.stun(u, e, 1, 0.6); } return true; },
    } },
  { id: 'sw_brood', name: '군체 산란체', tend: 'charge', keywords: ['bio'], sprite: 'crawler', palette: SWARM_ELITE, tier: 'elite', minPhase: 1,
    hp: 1200, power: 36, armor: 200, interval: 1.2, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'chem' }, melee: true,
    onTick: (b, u, dt) => {
      u.mem.spawnT = (u.mem.spawnT || 0) + dt;
      if (u.mem.spawnT < 14) return;
      u.mem.spawnT = 0;
      const alive = b.units.filter((x) => x.alive && x.side === u.side && x.defId === 'sw_spore').length; // 포자 동시 생존 최대 6
      if (alive < 6) summonHook?.(b, u, 'sw_spore', Math.min(2, 6 - alive));
    } },
  // 캠페인 「회수 계약」 1장 보스: 하역 크레인에 엉겨 붙은 고정형 군집. 컨테이너에서 포자 살점을 쏟아 낸다 (비비안 조사 = 컨테이너 2개 봉인 → 간격 10 → 12초, b.ctx.campIntel).
  // 시뮬(tests/campaign_sim.ts, 쉬움): 바로 돌파 시 보스 평균 2.2회 · 조사 시 1.5회
  { id: 'cp_loader', name: '적재 군집', tend: 'pack', keywords: ['bio'], sprite: 'crawler', palette: SWARM_BOSS, art: 'en_sw_brood', tier: 'boss', minPhase: 99,
    hp: 2600, power: 34, armor: 160, interval: 1.4, range: 2, immobile: true, atk: { type: 'strike', elem: 'chem' }, melee: true,
    skill: {
      name: '크레인 투척', cd: 9, params: {}, desc: () => '가장 가까운 적을 집어 던진다 (기술 위력 160% 물리 + 1.5초 기절)',
      cast(b, u) { const t = b.nearest(u, b.enemiesOf(u)); if (!t) return false; b.fx(t.x, t.y, 0, 'phys'); skillHit(b, u, t, 'strike', 1.6, 'phys'); b.stun(u, t, 1.5, 0.8); return true; },
    },
    onTick: (b, u, dt) => {
      const sealed = !!b.ctx.campIntel;
      u.mem.spawnT = (u.mem.spawnT || 0) + dt;
      if (u.mem.spawnT < (sealed ? 12 : 10)) return;
      u.mem.spawnT = 0;
      const cap = 4, alive = b.units.filter((x) => x.alive && x.side === u.side && x.defId === 'sw_spore').length;
      if (alive < cap) summonHook?.(b, u, 'sw_spore', Math.min(2, cap - alive));
    } },
  // 캠페인 「회수 계약」 2장 보스: 갱도 깊이 버티는 군체 '기사' 계급. 골갑 = 화학 외 받는 피해 감소 (나디르 영사로 이음매를 알면 골갑이 듣지 않는다, b.ctx.campIntel2).
  // [굴착 돌진] 바닥을 파고 들어가 체력 비율이 가장 낮은 적 곁으로 솟아오른다. 장 적 단계 3 (data/campaign.ts) · 2장엔 아군이 6~7등급이라 위력이 높다.
  // 시뮬(tests/campaign_sim.ts, 40판): 바로 지나감 보스 평균 1.8회 · 영사 1.7회 · 1장과 비슷한 벽
  { id: 'cp_borer', name: '골갑 굴착 기사', tend: 'charge', keywords: ['bio'], sprite: 'beast', palette: SWARM_BOSS, art: 'en_sw_hound', tier: 'boss', minPhase: 99,
    hp: 6000, power: 215, armor: 200, effRes: 0.2, interval: 1.3, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '굴착 돌진', cd: 10, params: {}, desc: () => '땅을 파고 들어가 체력 비율이 가장 낮은 적 곁에서 솟아오른다 (기술 위력 180% 물리 + 주변 1칸 80% + 1초 기절)',
      cast(b, u) {
        const es = b.enemiesOf(u); if (!es.length) return false;
        const t = es.slice().sort((a, c) => a.hp / b.S(a, 'maxHp') - c.hp / b.S(c, 'maxHp'))[0];
        if (!blinkTo(b, u, t)) return false;
        b.fx(t.x, t.y, 1, 'phys');
        skillHit(b, u, t, 'strike', 1.8, 'phys'); b.stun(u, t, 1, 0.8);
        for (const e of b.around(t, 1, es)) if (e !== t) skillHit(b, u, e, 'strike', 0.8, 'phys');
        return true;
      },
    },
    hooks: { takenMult: (b, _u, _src, o) => (o.elem === 'chem' || b.ctx.campIntel2 ? 1 : 0.7) } },
  // 캠페인 「회수 계약」 3장 보스: RL-2 중계 안테나에 자리 잡은 군체 '전도사' 변종. 전투가 시작되면 양옆에 중계 안테나 2개가 켜진다
  // (배전실에서 1개를 미리 끄면 1개, b.ctx.campIntel3). [중계 증폭] 안테나가 하나라도 서 있으면 받는 피해 -50%. 탑이 쓰러지면 안테나도 꺼진다 (owner).
  // [설교 방송] 4칸 안 모든 적에게 정신 피해 + 공포. 장 적 단계는 data/campaign.ts (3장 = 4).
  // 시뮬(tests/campaign_sim.ts, 80판): 안테나 그대로 보스 평균 1.4회 · 배전실 1.8회 · 필리스 확인 1.7회 (3장에 도착한 판의 90% 이상 클리어)
  { id: 'cp_herald', name: '전도사 중계탑', tend: 'sniper', keywords: ['bio'], sprite: 'phantom', palette: SWARM_BOSS, art: 'en_sw_queen', tier: 'boss', minPhase: 99,
    hp: 5000, power: 120, armor: 220, effRes: 0.3, interval: 1.2, range: 4, immobile: true, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    skill: {
      name: '설교 방송', cd: 9, params: {}, desc: () => '4칸 안 모든 적에게 정신 피해 (기술 위력 100%) + 40% 확률 1.5초 공포',
      cast(b, u) {
        const es = b.around(u, 4, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 4, 'psy');
        for (const e of es) { skillHit(b, u, e, 'tech', 1.0, 'psy', { noMiss: true }); fear(b, u, e, 1.5, 0.4); }
        return true;
      },
    },
    onTick: (b, u) => {
      if (u.mem.relays) return;
      u.mem.relays = 1;
      const n = b.ctx.campIntel3 ? 1 : 2;
      for (let i = 0; i < n; i++) { const a = ENEMY_RT.spawn?.(b, 'cp_antenna', { x: u.x + (i ? 1 : -1), y: u.y }, { summon: true }); if (a) a.owner = u; }
    },
    hooks: { takenMult: (b, u) => (b.units.some((x) => x.alive && x.owner === u && x.defId === 'cp_antenna') ? 0.5 : 1) } },
  { id: 'cp_antenna', name: '중계 안테나', tend: 'escort', keywords: ['mech', 'struct'], sprite: 'turret', palette: SWARM2, art: 'en_turret', tier: 'minion', minPhase: 99,
    hp: 900, power: 0, armor: 200, interval: 9, range: 0, immobile: true, atk: { type: 'strike', elem: 'phys' }, melee: false, noAttack: true },
  // 캠페인 「회수 계약」 4장 보스: 베르타-4 제4링 격리 검사 갑문에 뿌리내린 둥지. 적요 번호 없는 화물이 검사 없이 지나가던 바로 그 갑문이다.
  // [격리 셔터] 12초 주기로 갑문이 열렸다 닫힌다 — 닫혀 있는 동안 받는 피해 -50%. 열린 시간은 4초, 검사대를 다시 돌리고 왔으면 7초 (b.ctx.campIntel4).
  // [오염 컨테이너] 10초마다 포자 살점 2마리 (동시 최대 4마리). 감사 분기(b.ctx.campAudit)면 격리팀이 컨테이너를 봉인해 15초마다 1마리.
  // [산성 방류] 3칸 안 모든 적에게 화학 피해. 장 적 단계는 data/campaign.ts (4장 = 5).
  // 시뮬(tests/campaign_sim.ts, 분기 · 정책별 40판): 4장 보스 평균 시도 감사 1.0~1.1 · 라르스 1.6~1.9 · 침묵 1.4~1.6회. 감사는 쉬운 대신 AH -6 이라 정산이 줄고, 라르스는 AH 가 가장 많이 남는다
  { id: 'cp_gate', name: '검역 갑문 둥지', tend: 'pack', keywords: ['bio'], sprite: 'crawler', palette: SWARM_BOSS, art: 'en_sw_brood', tier: 'boss', minPhase: 99,
    hp: 5600, power: 125, armor: 220, effRes: 0.3, interval: 1.3, range: 2, immobile: true, atk: { type: 'strike', elem: 'chem' }, melee: true,
    skill: {
      name: '산성 방류', cd: 9, params: {}, desc: () => '3칸 안 모든 적에게 화학 피해 (기술 위력 110%)',
      cast(b, u) {
        const es = b.around(u, 3, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 3, 'chem');
        for (const e of es) skillHit(b, u, e, 'tech', 1.1, 'chem', { noMiss: true });
        return true;
      },
    },
    onTick: (b, u, dt) => {
      const audit = !!b.ctx.campAudit;
      u.mem.spawnT = (u.mem.spawnT || 0) + dt;
      if (u.mem.spawnT < (audit ? 15 : 10)) return;
      u.mem.spawnT = 0;
      const cap = 4, alive = b.units.filter((x) => x.alive && x.side === u.side && x.defId === 'sw_spore').length;
      if (alive < cap) summonHook?.(b, u, 'sw_spore', Math.min(audit ? 1 : 2, cap - alive));
    },
    hooks: { takenMult: (b) => (b.t % 12 < (b.ctx.campIntel4 ? 7 : 4) ? 1 : 0.5) } },
  { id: 'sw_queen', name: '군체 여왕', tend: 'pack', keywords: ['bio', 'phantom'], sprite: 'phantom', palette: SWARM_BOSS, tier: 'boss', minPhase: 1,
    hp: 3000, power: 46, armor: 180, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    escort: ['sw_hound', 'sw_spitter'],
    skill: {
      name: '사이오닉 파동', cd: 8, params: {}, desc: () => '3칸 정신 피해 + 공포',
      cast(b, u) {
        const es = b.around(u, 3, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 3, 'psy');
        for (const e of es) { skillHit(b, u, e, 'tech', 0.8, 'psy', { noMiss: true }); fear(b, u, e, 1, 0.3); }
        return true;
      },
    },
    // 사이오닉 지배: 8초마다 군체 광폭화 (스킬과 별도)
    onTick: (b, u, dt) => {
      if (!command(b, u, 'cmdT', dt, 8, 4)) return;
      b.emit({ k: 'status', id: u.id, name: '사이오닉 지배' });
      for (const a of b.alliesOf(u)) b.buff(u, a, 'swarm.dom', 5, { delta: { atkSpd: 0.3 }, mods: [{ kind: 'inc', tag: 'all', v: 0.25 }], label: '사이오닉장' });
    } },
  { id: 'sw_harvester', name: '거대 마부 개체', tend: 'charge', keywords: ['bio'], sprite: 'beast', palette: SWARM_BOSS, tier: 'boss', minPhase: 1,
    hp: 3500, power: 44, armor: 320, effRes: 0.3, interval: 1.3, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['sw_spore', 'sw_spore'],
    skill: {
      name: '포식', cd: 8, needsRange: true, params: {}, desc: () => '대상 강타 + 자가 회복',
      cast(b, u) { const t = u.target; if (!t?.alive) return false; b.fx(t.x, t.y, 0, 'chem'); skillHit(b, u, t, 'strike', 2.5, 'phys'); b.heal(u, u, b.S(u, 'maxHp') * 0.04); return true; },
    },
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'sw_spore', 2); } } },

  // ── 크림슨 대공령 (제국)
  { id: 'cr_thrall', name: '혈족 종자', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: CRIMSON, tier: 'minion', minPhase: 1,
    hp: 440, power: 30, armor: 140, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u) => { b.heal(u, u, b.S(u, 'strike') * 0.6); } },
  { id: 'cr_hound', name: '배양 사냥개', tend: 'assassin', keywords: ['bio'], sprite: 'beast', palette: CRIMSON, tier: 'minion', minPhase: 1,
    hp: 340, power: 28, armor: 80, eva: 0.1, interval: 0.7, range: 1, moveSpd: 1.5, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u, t) => { bleed(b, u, t, b.S(u, 'strike') * 0.2, 3, 0.4); } },
  { id: 'cr_musket', name: '정맥관 총사', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: CRIMSON, tier: 'minion', minPhase: 1,
    hp: 300, power: 30, armor: 80, acc: 0.1, interval: 1.2, range: 4, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'cr_leech', name: '배양조 사제', tend: 'escort', keywords: ['bio'], sprite: 'medic', palette: CRIMSON2, tier: 'minion', minPhase: 2,
    hp: 340, power: 24, armor: 80, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    skill: {
      name: '수혈', cd: 6, params: {}, desc: () => '아군 회복',
      cast(b, u) { const l = b.lowestHpAlly(u); if (!l || b.hpPct(l) > 0.85) return false; b.fx(l.x, l.y, 0, 'chem'); b.heal(u, l, b.S(u, 'tech') * 3); return true; },
    } },
  { id: 'cr_knight', name: '크림슨 혈기사', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: CRIMSON_ELITE, tier: 'elite', minPhase: 1,
    hp: 1200, power: 44, armor: 300, acc: 0.1, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '피의 일섬', cd: 8, needsRange: true, params: {}, desc: () => '주변 베기 + 흡혈',
      cast(b, u) { b.fx(u.x, u.y, 1, 'phys'); for (const e of b.around(u, 1, b.enemiesOf(u))) skillHit(b, u, e, 'strike', 1.6, 'phys'); b.heal(u, u, b.S(u, 'maxHp') * 0.06); return true; },
    } },
  { id: 'cr_count', name: '혈족 백작', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: CRIMSON_BOSS, tier: 'boss', minPhase: 1,
    hp: 3300, power: 50, armor: 280, acc: 0.15, effRes: 0.3, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['cr_thrall', 'cr_musket'],
    skill: {
      name: '혈족의 검무', cd: 9, params: {}, desc: () => '2칸 피해',
      cast(b, u) {
        const es = b.around(u, 2, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 2, 'phys');
        for (const e of es) skillHit(b, u, e, 'strike', 1.4, 'phys');
        return true;
      },
    },
    // 혈연 축제: 9초마다 자가 회복 + 아군 강화 (스킬과 별도)
    onTick: (b, u, dt) => {
      if (!command(b, u, 'cmdT', dt, 9, 4.5, 2)) return;
      b.emit({ k: 'status', id: u.id, name: '혈연 축제' });
      b.heal(u, u, b.S(u, 'maxHp') * 0.06);
      for (const a of b.alliesOf(u)) b.buff(u, a, 'crimson.feast', 5, { mods: [{ kind: 'inc', tag: 'all', v: 0.25 }], label: '혈연 축제' });
    } },
  { id: 'cr_heart', name: '그라나툼 심핵 수호체', tend: 'escort', keywords: ['bio', 'struct'], sprite: 'mech', palette: CRIMSON_BOSS, tier: 'boss', minPhase: 1,
    hp: 3400, power: 40, armor: 280, effRes: 0.3, interval: 1.3, range: 5, immobile: true, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    escort: ['cr_hound', 'cr_thrall'],
    skill: {
      name: '박동', cd: 7, params: {}, desc: () => '모든 적 화학 피해 + 중독',
      cast(b, u) { b.fx(u.x, u.y, 4, 'chem'); for (const e of b.enemiesOf(u)) { skillHit(b, u, e, 'tech', 0.5, 'chem', { noMiss: true }); poison(b, u, e, b.S(u, 'tech') * 0.1, 4, 0.5); } return true; },
    },
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'cr_thrall', 1); } } },

  // ── 스파르타 전쟁 궤도 (동맹)
  { id: 'sp_hoplite', name: '호플리테 메카', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: SPARTA, tier: 'minion', minPhase: 1,
    hp: 650, power: 28, armor: 420, effRes: 0.3, interval: 1.2, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'sp_lancer', name: '창병 메카', tend: 'charge', keywords: ['mech'], sprite: 'knight', palette: SPARTA, tier: 'minion', minPhase: 1,
    hp: 420, power: 34, armor: 220, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'sp_archer', name: '궤도 사수 메카', tend: 'sniper', keywords: ['mech'], sprite: 'soldier', palette: SPARTA, tier: 'minion', minPhase: 1,
    hp: 300, power: 30, armor: 150, acc: 0.1, interval: 1.2, range: 4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'sp_drone', name: '예인 드론', tend: 'sniper', keywords: ['mech'], sprite: 'drone', palette: SPARTA, tier: 'minion', minPhase: 2,
    hp: 240, power: 22, armor: 100, eva: 0.15, interval: 0.7, range: 2, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'sp_phalanx', name: '팔랑크스 지휘기', tend: 'escort', keywords: ['mech'], sprite: 'mech', palette: SPARTA_ELITE, tier: 'elite', minPhase: 1,
    hp: 1300, power: 38, armor: 500, effRes: 0.3, interval: 1.2, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '방패벽', cd: 9, params: {}, desc: () => '아군 보호막 + 방어도 증가',
      cast(b, u) { b.fx(u.x, u.y, 2, 'phys'); for (const a of b.alliesOf(u)) { b.shield(a, b.S(a, 'maxHp') * 0.15); b.buff(u, a, 'sparta.wall', 4, { delta: { armor: 15 }, label: '방패벽' }); } return true; },
    } },
  { id: 'sp_spear', name: '창구 절멸 포대', tend: 'sniper', keywords: ['mech', 'struct'], sprite: 'turret', palette: SPARTA_BOSS, tier: 'boss', minPhase: 1,
    hp: 4000, power: 52, armor: 450, effRes: 0.4, interval: 1.4, range: 7, immobile: true, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    escort: ['sp_hoplite', 'sp_hoplite', 'sp_archer'],
    skill: {
      name: '절멸 광선', cd: 7, params: {}, desc: () => '직선 관통 전기 피해',
      cast(b, u) { const t = u.target?.alive ? u.target : b.farthest(u); if (!t) return false; for (const e of lineTargets(b, u, t)) { b.fx(e.x, e.y, 0, 'elec'); skillHit(b, u, e, 'tech', 2.0, 'elec', { noMiss: true }); } return true; },
    } },
  { id: 'sp_colossus', name: '전쟁 궤도 콜로서스', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: SPARTA_BOSS, tier: 'boss', minPhase: 1,
    hp: 3500, power: 46, armor: 360, effRes: 0.3, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['sp_lancer', 'sp_archer'],
    skill: {
      name: '진동 충격', cd: 7, params: {}, desc: () => '주변 2칸 피해 + 기절',
      cast(b, u) { const es = b.around(u, 2, b.enemiesOf(u)); if (!es.length) return false; b.fx(u.x, u.y, 2, 'elec'); for (const e of es) { skillHit(b, u, e, 'tech', 1.2, 'elec', { noMiss: true }); b.stun(u, e, 1, 0.5); } return true; },
    },
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'sp_drone', 2); } } },

  // ── 페트라 본사 성역 · 격리 구역
  { id: 'pt_guard', name: '보안 집행 로봇', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: PETRA, tier: 'minion', minPhase: 1,
    hp: 600, power: 30, armor: 300, interval: 1.2, range: 1, moveSpd: 0.9, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'pt_drone', name: '감시 드론', tend: 'sniper', keywords: ['mech'], sprite: 'drone', palette: PETRA, tier: 'minion', minPhase: 1,
    hp: 240, power: 22, armor: 80, eva: 0.15, interval: 0.7, range: 3, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'pt_unix', name: '유닉스 생산 로봇', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: UNIX, tier: 'minion', minPhase: 1,
    hp: 500, power: 26, armor: 250, interval: 1.1, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'pt_anomaly', name: '격리 이탈 개체', tend: 'assassin', keywords: ['phantom'], sprite: 'phantom', palette: ANOMALY, tier: 'minion', minPhase: 2,
    hp: 320, power: 32, armor: 40, eva: 0.3, interval: 1.1, range: 2, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    onBasic: (b, u, t) => { fear(b, u, t, 1, 0.15); } },
  { id: 'pt_auditor', name: '정보감사관', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: PETRA_ELITE, tier: 'elite', minPhase: 1,
    hp: 1000, power: 40, armor: 200, acc: 0.15, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    skill: {
      name: '감사번호 부여', cd: 7, params: {}, desc: () => '대상 피격 피해 증가 (영구 기록)',
      cast(b, u) { const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u)); if (!t) return false; b.fx(t.x, t.y, 0, 'phys'); skillHit(b, u, t, 'shoot', 1.5, 'phys'); b.applyStatus(u, t, { type: 'buff', key: 'pt.audit', dur: 8, taken: [{ kind: 'vuln', tag: 'all', v: 0.3 }], label: '감사번호' }); return true; },
    } },
  { id: 'pt_contract', name: '계약서에 없던 것', tend: 'sniper', keywords: ['phantom'], sprite: 'phantom', palette: ANOMALY_BOSS, tier: 'boss', minPhase: 1,
    hp: 3200, power: 50, armor: 150, eva: 0.2, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    escort: ['pt_anomaly', 'pt_guard'],
    skill: {
      name: '조항 위반', cd: 6, params: {}, desc: () => '3칸 정신 피해 + 취약',
      cast(b, u) {
        const es = b.around(u, 3, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 3, 'psy');
        for (const e of es) { skillHit(b, u, e, 'tech', 1.0, 'psy', { noMiss: true }); b.applyStatus(u, e, { type: 'buff', key: 'pt.breach', dur: 4, taken: [{ kind: 'vuln', tag: 'all', v: 0.2 }], label: '위반' }); }
        return true;
      },
    } },
  { id: 'pt_unixline', name: '유닉스 생산 라인', tend: 'escort', keywords: ['mech', 'struct'], sprite: 'turret', palette: UNIX, tier: 'boss', minPhase: 1,
    hp: 2900, power: 34, armor: 320, effRes: 0.3, interval: 1.2, range: 4, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    escort: ['pt_guard', 'pt_drone'],
    // 1원칙: 매 분기 직전 대비 더 많이 생산한다
    onTick: (b, u, dt) => {
      u.mem.spawnT = (u.mem.spawnT || 0) + dt;
      if (u.mem.spawnT < 12) return;
      u.mem.spawnT = 0;
      u.mem.quarter = (u.mem.quarter || 0) + 1;
      const alive = b.alliesOf(u).filter((a) => a.defId === 'pt_unix').length;
      summonHook?.(b, u, 'pt_unix', Math.max(0, Math.min(1 + Math.floor(u.mem.quarter / 2), 4 - alive)));
    } },

  // ═════════ 신규 전장 (docs/FIELDS_DRAFT.md 1 · 3 · 8 · 9 · 10 · 12 · 14 · 15)
  // ── 카운티폴 세피아 교외 (연합 · 광대 × 성도회 정화조)
  { id: 'cf_neighbor', name: '완벽한 이웃', tend: 'assassin', keywords: ['bio'], sprite: 'knight', palette: SEPIA, tier: 'minion', minPhase: 1,
    hp: 430, power: 30, armor: 120, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'cf_dog', name: '이웃집 개', tend: 'assassin', keywords: ['bio'], sprite: 'beast', palette: SEPIA, tier: 'minion', minPhase: 1,
    hp: 320, power: 26, armor: 70, eva: 0.1, interval: 0.7, range: 1, moveSpd: 1.5, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u, t) => { bleed(b, u, t, b.S(u, 'strike') * 0.2, 3, 0.4); } },
  { id: 'cf_purifier', name: '정화사', tend: 'sniper', keywords: ['bio'], sprite: 'robe', palette: SIRIUS, tier: 'minion', minPhase: 1,
    hp: 300, power: 28, armor: 70, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'holy' }, melee: false,
    onBasic: (b, u, t) => { antiheal(b, u, t, 0.3, 4); } },
  { id: 'cf_drone', name: '성광 드론', tend: 'sniper', keywords: ['mech'], sprite: 'drone', palette: SIRIUS, tier: 'minion', minPhase: 2,
    hp: 240, power: 22, armor: 70, eva: 0.15, interval: 0.7, range: 2, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'cf_chair', name: '반상회장', tend: 'pack', keywords: ['bio'], sprite: 'soldier', palette: SEPIA_ELITE, tier: 'elite', minPhase: 1,
    hp: 1100, power: 40, armor: 220, acc: 0.1, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    // 반상회 소집: 8초마다 광대 1기 은신 + 피해 증가
    onTick: (b, u, dt) => {
      if (!command(b, u, 'cmdT', dt, 8, 4)) return;
      const cl = b.alliesOf(u, false).filter((a) => CLOWNS.has(a.defId) && !b.hidden(a));
      const t = cl.length ? cl[b.rng.int(0, cl.length - 1)] : null;
      if (!t) return;
      b.emit({ k: 'status', id: u.id, name: '반상회 소집' });
      b.buff(u, t, 'stealth', 3, { label: '은신' });
      b.buff(u, t, 'cf.chair', 3, { mods: [{ kind: 'inc', tag: 'all', v: 0.5 }], label: '기습 준비' });
    } },
  { id: 'cf_model', name: '모범 시민', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: SEPIA_BOSS, tier: 'boss', minPhase: 1,
    hp: 3300, power: 48, armor: 260, acc: 0.1, effRes: 0.3, interval: 1.1, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['cf_neighbor', 'cf_dog'],
    skill: {
      name: '산성 분사', cd: 7, needsRange: true, params: {}, desc: () => '주변 1칸 화학 피해 + 침식',
      cast(b, u) {
        const es = b.around(u, 1, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 1, 'chem');
        for (const e of es) { skillHit(b, u, e, 'tech', u.mem.unmask ? 1.5 : 1.0, 'chem', { noMiss: true }); corrode(b, u, e, 0.85, 3, 0.5); }
        return true;
      },
    },
    hooks: { takenMult: (b, u) => (u.mem.unmask ? 1 : 0.7) },
    // 의태 해제: 체력 50% 아래로 떨어지면 거대화 (공격 속도 +40%, 산성 분사 강화)
    onTick: (b, u) => {
      if (u.mem.unmask || b.hpPct(u) > 0.5) return;
      u.mem.unmask = 1;
      b.emit({ k: 'status', id: u.id, name: '의태 해제!' });
      b.buff(u, u, 'cf.unmask', 9999, { delta: { atkSpd: 0.4 }, label: '거대화' });
      u.cd = Math.min(u.cd, 1);
    } },
  { id: 'cf_inquisitor', name: '정화관', tend: 'sniper', keywords: ['bio'], sprite: 'robe', palette: SIRIUS_BOSS, tier: 'boss', minPhase: 1,
    hp: 3000, power: 48, armor: 180, effRes: 0.3, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'holy' }, melee: false,
    escort: ['cf_purifier', 'cf_neighbor'],
    skill: {
      name: '정화의 창', cd: 9, params: {}, desc: () => '직선 관통 신성 피해 + 회복 감소',
      cast(b, u) {
        const t = u.target?.alive ? u.target : b.farthest(u); if (!t) return false;
        for (const e of lineTargets(b, u, t)) { b.fx(e.x, e.y, 0, 'holy'); skillHit(b, u, e, 'tech', 1.5, 'holy', { noMiss: true }); antiheal(b, u, e, 0.5, 6); }
        return true;
      },
    } },

  // ── 리빈 낙원동 방역 시즌 (연합 · 부유체 · 프리버드)
  { id: 'lv_floater', name: '부유체', tend: 'sniper', keywords: ['bio'], sprite: 'phantom', palette: FLOAT, tier: 'minion', minPhase: 1,
    hp: 460, power: 26, armor: 60, interval: 1.3, range: 2, moveSpd: 0.6, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    onBasic: (b, u, t) => { poison(b, u, t, b.S(u, 'shoot') * 0.2, 3, 0.3); } },
  { id: 'lv_spores', name: '부유 포자 무리', tend: 'charge', keywords: ['bio'], sprite: 'crawler', palette: FLOAT, tier: 'minion', minPhase: 1,
    hp: 200, power: 18, armor: 30, interval: 0.9, range: 1, moveSpd: 1.3, atk: { type: 'strike', elem: 'chem' }, melee: true },
  { id: 'lv_raptor', name: '랩터급 프리버드', tend: 'assassin', keywords: ['bio'], sprite: 'beast', palette: BIRD, tier: 'minion', minPhase: 1,
    hp: 340, power: 28, armor: 70, eva: 0.2, interval: 0.7, range: 1, moveSpd: 1.6, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'lv_alpha', name: '무리 우두머리 프리버드', tend: 'charge', keywords: ['bio'], sprite: 'beast', palette: BIRD_ELITE, tier: 'elite', minPhase: 1,
    hp: 1200, power: 42, armor: 220, interval: 1.0, range: 1, moveSpd: 1.2, atk: { type: 'strike', elem: 'phys' }, melee: true,
    // 포식: 6초마다 가장 가까운 부유체를 삼켜 회복, 3초 뒤 체내 폭발
    onTick: (b, u, dt) => {
      u.mem.eatT = (u.mem.eatT ?? 3) - dt;
      if (u.mem.eatT > 0) return;
      u.mem.eatT = 6;
      const f = b.nearest(u, b.alliesOf(u, false).filter((a) => (a.defId === 'lv_floater' || a.defId === 'lv_spores') && b.dist(u, a) <= 3));
      if (!f) return;
      b.emit({ k: 'status', id: u.id, name: '부유체 포식' });
      f.mem.swallowed = 1;
      b.kill(f, null);
      b.heal(u, u, b.S(u, 'maxHp') * 0.15);
      b.later(3, () => { if (u.alive) gasBlast(b, u, u.x, u.y, 1, 0.1); });
    } },
  { id: 'lv_mother', name: '부유체 모체', tend: 'pack', keywords: ['bio'], sprite: 'phantom', palette: FLOAT_BOSS, tier: 'boss', minPhase: 1,
    hp: 3000, power: 42, armor: 160, effRes: 0.3, interval: 1.3, range: 3, moveSpd: 0.5, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    escort: ['lv_floater', 'lv_raptor'],
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 14) { u.mem.spawnT = 0; b.emit({ k: 'status', id: u.id, name: '포자 방출' }); summonHook?.(b, u, 'lv_spores', 2); } } },
  { id: 'lv_king', name: '목초지의 왕', tend: 'assassin', keywords: ['bio'], sprite: 'beast', palette: BIRD_BOSS, tier: 'boss', minPhase: 1,
    hp: 4000, power: 54, armor: 300, effRes: 0.3, interval: 1.2, range: 1, moveSpd: 0.9, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['lv_raptor', 'lv_floater'],
    skill: {
      name: '포식자의 도약', cd: 8, params: {}, desc: () => '가장 먼 적에게 도약 + 주변 1칸 피해 + 기절',
      cast(b, u) {
        const t = b.farthest(u); if (!t) return false;
        blinkTo(b, u, t);
        b.fx(u.x, u.y, 1, 'phys');
        for (const e of b.around(u, 1, b.enemiesOf(u))) { skillHit(b, u, e, 'strike', 1.8, 'phys'); b.stun(u, e, 1, 1); }
        return true;
      },
    } },

  // ── 라이덴 제34블록 봉쇄선 (제국 호이슌 · 폭주한 과개조자)
  { id: 'rd_laborer', name: '노동 등급 폭주자', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: NEON, tier: 'minion', minPhase: 1,
    hp: 460, power: 30, armor: 130, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'rd_combat', name: '전투 등급 폭주자', tend: 'assassin', keywords: ['mech'], sprite: 'knight', palette: CHROME, tier: 'minion', minPhase: 1,
    hp: 500, power: 32, armor: 250, interval: 0.8, range: 1, moveSpd: 1.2, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'rd_sub', name: '구독 치안 드론', tend: 'sniper', keywords: ['mech'], sprite: 'drone', palette: CHROME, tier: 'minion', minPhase: 1,
    hp: 260, power: 24, armor: 90, eva: 0.1, interval: 0.8, range: 3, moveSpd: 1.3, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    onBasic: (b, u, t) => { b.applyStatus(u, t, { type: 'buff', key: 'rd.unpaid', dur: 4, taken: [{ kind: 'vuln', tag: 'all', v: 0.15 }], label: '미납' }); } },
  { id: 'rd_stream', name: '데스 스트리밍 드론', tend: 'disrupt', keywords: ['mech'], sprite: 'drone', palette: NEON, tier: 'minion', minPhase: 2,
    hp: 240, power: 10, armor: 80, eva: 0.2, interval: 1.0, range: 4, moveSpd: 1.2, atk: { type: 'shoot', elem: 'phys' }, melee: false, noAttack: true,
    // 생중계: 2초마다 가장 가까운 적 하나를 찍는다 (받는 피해 +15%)
    onTick: (b, u, dt) => {
      u.mem.camT = (u.mem.camT ?? 0.5) - dt;
      if (u.mem.camT > 0) return;
      u.mem.camT = 2;
      const t = b.nearest(u, b.targetable(u).filter((e) => b.dist(u, e) <= 4));
      if (t) b.applyStatus(u, t, { type: 'buff', key: 'rd.stream', dur: 2.5, taken: [{ kind: 'vuln', tag: 'all', v: 0.15 }], label: '생중계' });
    } },
  { id: 'rd_critical', name: '\'임계\' 과개조자', tend: 'charge', keywords: ['mech'], sprite: 'knight', palette: NEON_ELITE, tier: 'elite', minPhase: 1,
    hp: 1200, power: 44, armor: 280, interval: 0.9, range: 1, moveSpd: 1.1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    // 임계 돌파: 체력 50% 이하에서 한 번, 8초 광폭 + 받는 피해 -30%
    onTick: (b, u) => {
      if (u.mem.crit || b.hpPct(u) > 0.5) return;
      u.mem.crit = 1;
      rampage(b, u, 8);
      b.buff(u, u, 'rd.crit', 8, { taken: [{ kind: 'red', tag: 'all', v: 0.3 }], label: '임계 돌파' });
    } },
  { id: 'rd_tower', name: '결함 펌웨어 송출탑', tend: 'pack', keywords: ['mech', 'struct'], sprite: 'turret', palette: NEON_BOSS, tier: 'boss', minPhase: 1,
    hp: 3000, power: 40, armor: 300, effRes: 0.3, interval: 1.3, range: 5, immobile: true, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    escort: ['rd_laborer', 'rd_combat', 'rd_sub'],
    // 펌웨어 송출: 10초마다 같은 편 2기 광폭 + 적 기계 기물 2초 감전
    onTick: (b, u, dt) => {
      u.mem.txT = (u.mem.txT ?? 5) - dt;
      if (u.mem.txT > 0) return;
      u.mem.txT = 10;
      b.emit({ k: 'status', id: u.id, name: '펌웨어 송출' });
      const al = b.rng.shuffle(b.alliesOf(u, false).filter((a) => !a.mem.inert && !a.immobile)).slice(0, 2);
      for (const a of al) rampage(b, a, 4);
      for (const e of b.enemiesOf(u)) if (e.category === 'mech') b.applyStatus(u, e, { type: 'shock', key: 'shock', dur: 2 });
    } },
  { id: 'rd_repo', name: '구독 해지 집행반장', tend: 'sniper', keywords: ['mech'], sprite: 'soldier', palette: CHROME_BOSS, tier: 'boss', minPhase: 1,
    hp: 3200, power: 48, armor: 260, acc: 0.1, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    escort: ['rd_sub', 'rd_combat'],
    skill: {
      name: '원격 잠금', cd: 9, params: {}, desc: () => '장비가 가장 많은 적 6초 약화',
      cast(b, u) {
        const es = b.targetable(u); if (!es.length) return false;
        const t = es.reduce((a, c) => (gearCount(c) > gearCount(a) ? c : a));
        b.fx(t.x, t.y, 0, 'elec');
        skillHit(b, u, t, 'shoot', 1.2, 'phys');
        b.applyStatus(u, t, { type: 'buff', key: 'rd.lock', dur: 6, mods: [{ kind: 'inc', tag: 'all', v: -0.25 }], delta: { atkSpd: -0.2 }, label: '원격 잠금' });
        return true;
      },
    } },

  // ── 크레타 백원 (동맹 · 장군의 망령)
  { id: 'kr_nameless', name: '무명 망령', tend: 'charge', keywords: ['phantom'], sprite: 'knight', palette: GHOST, tier: 'minion', minPhase: 1,
    hp: 380, power: 28, armor: 60, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'kr_archer', name: '대열 궁수 망령', tend: 'sniper', keywords: ['phantom'], sprite: 'soldier', palette: GHOST, tier: 'minion', minPhase: 1,
    hp: 280, power: 28, armor: 40, acc: 0.05, interval: 1.2, range: 4, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'kr_builder', name: '미완의 건축가 망령', tend: 'escort', keywords: ['phantom'], sprite: 'robe', palette: GHOST, tier: 'minion', minPhase: 2,
    hp: 320, power: 22, armor: 60, interval: 1.2, range: 2, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    // 묘석 축조: 10초마다 적 쪽 빈칸에 묘석
    onTick: (b, u, dt) => {
      u.mem.buildT = (u.mem.buildT ?? 5) - dt;
      if (u.mem.buildT > 0) return;
      u.mem.buildT = 10;
      const t = b.nearest(u, b.targetable(u)); if (!t) return;
      const dy = Math.sign(t.y - u.y);
      const cell = [[0, dy], [-1, dy], [1, dy], [-1, 0], [1, 0]].map(([dx, d]) => ({ x: u.x + dx, y: u.y + d })).find((c) => b.inBounds(c.x, c.y) && !b.unitAt(c.x, c.y));
      if (cell && dropObstacle(b, 'kr_stone', cell, 20)) b.emit({ k: 'status', id: u.id, name: '묘석 축조' });
    } },
  { id: 'kr_ferryman', name: '은퇴 못 한 이송관', tend: 'charge', keywords: ['phantom'], sprite: 'robe', palette: GHOST_ELITE, tier: 'minion', minPhase: 1,
    hp: 420, power: 28, armor: 100, interval: 1.2, range: 2, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u, t) => { b.applyStatus(u, t, { type: 'buff', key: 'root', dur: 1.5 }, 0.5); } },
  { id: 'kr_bearer', name: '기수 망령', tend: 'charge', keywords: ['phantom'], sprite: 'knight', palette: GHOST_ELITE, tier: 'elite', minPhase: 1,
    hp: 1100, power: 40, armor: 180, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'kr_general', name: '장군의 망령', tend: 'charge', keywords: ['phantom'], sprite: 'knight', palette: GHOST_BOSS, tier: 'boss', minPhase: 1,
    hp: 3300, power: 50, armor: 220, acc: 0.1, effRes: 0.3, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['kr_nameless', 'kr_archer'],
    // 재집결: 9초마다 쓰러진 망령 2기를 체력 50%로 다시 세운다. 서사의 망령 피해 +30%
    onTick: (b, u, dt) => {
      u.mem.aura = (u.mem.aura || 0) - dt;
      if (u.mem.aura <= 0) { u.mem.aura = 1; for (const a of b.alliesOf(u, false)) if (a.defId === 'kr_echo') b.buff(u, a, 'kr.general', 1.5, { mods: [{ kind: 'inc', tag: 'all', v: 0.3 }], label: '' }); }
      u.mem.rallyT = (u.mem.rallyT ?? 6) - dt;
      if (u.mem.rallyT > 0) return;
      u.mem.rallyT = 9;
      const dead = b.units.filter((x) => !x.alive && x.side === 1 && x.category === 'soul' && !x.isBoss && !x.mem.raised && x.defId !== 'kr_echo' && !x.mem.inert).slice(-2);
      if (!dead.length) return;
      b.emit({ k: 'status', id: u.id, name: '재집결' });
      for (const d of dead) { d.mem.raised = 1; const n = ENEMY_RT.spawn?.(b, d.defId, d, { hpPct: 0.5, mult: d.mem.mult, summon: true }); if (n) n.mem.raised = 1; }
    } },
  { id: 'kr_choir', name: '무명의 합창', tend: 'pack', keywords: ['phantom'], sprite: 'phantom', palette: GHOST_BOSS, tier: 'boss', minPhase: 1,
    hp: 3000, power: 46, armor: 120, effRes: 0.3, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    escort: ['kr_nameless', 'kr_ferryman'],
    skill: {
      name: '합창', cd: 12, params: {}, desc: () => '모든 적 정신 피해 + 공포',
      cast(b, u) {
        const es = b.enemiesOf(u); if (!es.length) return false;
        b.fx(u.x, u.y, 4, 'psy');
        for (const e of es) { skillHit(b, u, e, 'tech', 0.7, 'psy', { noMiss: true }); fear(b, u, e, 1, 0.6); }
        return true;
      },
    },
    hooks: { onAllyDeath: (b, u, dead) => { if (dead !== u && dead.category === 'soul') b.heal(u, u, b.S(u, 'maxHp') * 0.03); } } },
  // 전장 전용 (풀 밖): 서사의 망령 · 묘석
  { id: 'kr_echo', name: '서사의 망령', tend: 'charge', keywords: ['phantom'], sprite: 'phantom', palette: GHOST, tier: 'minion', minPhase: 99,
    hp: 300, power: 20, armor: 40, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'kr_stone', name: '묘석', tend: 'charge', keywords: ['struct'], sprite: 'turret', palette: STONE, tier: 'minion', minPhase: 99,
    hp: 420, power: 0, armor: 200, interval: 9, range: 0, immobile: true, atk: { type: 'strike', elem: 'phys' }, melee: false, noAttack: true, inert: true },

  // ── 올림푸스 성관 축전 구획 (동맹 · 흑운)
  { id: 'ol_battery', name: '자동 포격 포대', tend: 'sniper', keywords: ['mech', 'struct'], sprite: 'turret', palette: RING, tier: 'minion', minPhase: 1,
    hp: 520, power: 30, armor: 260, acc: 0.1, interval: 1.4, range: 5, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'ol_tender', name: '축전 정비 드론', tend: 'escort', keywords: ['mech'], sprite: 'drone', palette: RING, tier: 'minion', minPhase: 1,
    hp: 260, power: 20, armor: 80, eva: 0.1, interval: 0.8, range: 2, moveSpd: 1.3, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    // 축전 정비: 8초마다 주변 2칸 아군에게 충전 비례 보호막
    onTick: (b, u, dt) => {
      u.mem.fixT = (u.mem.fixT ?? 4) - dt;
      if (u.mem.fixT > 0) return;
      u.mem.fixT = 8;
      b.fx(u.x, u.y, 2, 'elec', 'buff');
      for (const a of b.around(u, 2, b.alliesOf(u))) b.shield(a, b.S(a, 'maxHp') * (0.03 + 0.015 * (a.mem.charge || 0)));
    } },
  { id: 'ol_patrol', name: '링 순찰기', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: RING, tier: 'minion', minPhase: 1,
    hp: 560, power: 30, armor: 280, interval: 1.1, range: 1, moveSpd: 0.9, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'ol_manager', name: '축전 구획 관리기', tend: 'escort', keywords: ['mech', 'struct'], sprite: 'turret', palette: BLACKCLOUD, tier: 'elite', minPhase: 1,
    hp: 1300, power: 40, armor: 320, interval: 1.2, range: 3, immobile: true, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    // 축전 배분: 8초마다 주변 2칸 아군 충전 +3 (자신은 방전 피해 면역)
    onTick: (b, u, dt) => {
      u.mem.dischargeImmune = 1;
      u.mem.chgT = (u.mem.chgT ?? 4) - dt;
      if (u.mem.chgT > 0) return;
      u.mem.chgT = 8;
      b.emit({ k: 'status', id: u.id, name: '축전 배분' });
      for (const a of b.around(u, 2, b.alliesOf(u, false))) ENEMY_RT.charge?.(b, a, 3, u);
    } },
  { id: 'ol_cloud', name: '흑운', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: BLACKCLOUD_BOSS, tier: 'boss', minPhase: 1,
    hp: 3800, power: 50, armor: 380, effRes: 0.3, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['ol_patrol', 'ol_tender'],
    skill: {
      name: '방전 강타', cd: 7, params: {}, desc: () => '주변 2칸 전기 피해 + 기절',
      cast(b, u) {
        const es = b.around(u, 2, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 2, 'elec');
        for (const e of es) { skillHit(b, u, e, 'tech', 1.1, 'elec', { noMiss: true }); b.stun(u, e, 1, 0.5); }
        return true;
      },
    } },
  { id: 'ol_conduit', name: '극지 도관', tend: 'escort', keywords: ['mech', 'struct'], sprite: 'turret', palette: BLACKCLOUD_BOSS, tier: 'boss', minPhase: 1,
    hp: 2800, power: 38, armor: 300, effRes: 0.3, interval: 1.3, range: 5, immobile: true, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    escort: ['ol_patrol', 'ol_tender'],
    // 살아 있는 동안 모든 아군 공격 속도 +20%, 4초마다 충전이 가장 높은 아군 +2
    onTick: (b, u, dt) => {
      u.mem.aura = (u.mem.aura || 0) - dt;
      if (u.mem.aura <= 0) { u.mem.aura = 1; for (const a of b.alliesOf(u)) b.buff(u, a, 'ol.conduit', 1.5, { delta: { atkSpd: 0.2 }, label: '' }); }
      u.mem.feedT = (u.mem.feedT ?? 4) - dt;
      if (u.mem.feedT > 0) return;
      u.mem.feedT = 4;
      const cs = b.alliesOf(u, false).filter((a) => a.category === 'mech' || a.category === 'struct');
      if (cs.length) ENEMY_RT.charge?.(b, cs.reduce((a, c) => ((c.mem.charge || 0) > (a.mem.charge || 0) ? c : a)), 2, u);
    } },

  // ── 캣휠 그늘 성계 (유닉스 · 일탈 개체 회수)
  { id: 'cw_reclaim', name: '회수 집행 유닉스', tend: 'charge', keywords: ['mech'], sprite: 'mech', palette: UNIX, tier: 'minion', minPhase: 1,
    hp: 540, power: 28, armor: 250, interval: 1.1, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u, t) => { b.applyStatus(u, t, { type: 'buff', key: 'root', dur: 1 }, 0.5); },
    // 회수 우선순위: 기계 기물 먼저
    onTick: (b, u) => {
      if (u.target?.category === 'mech' || b.frenzied(u)) return;
      const m = b.targetable(u).filter((e) => e.category === 'mech');
      if (m.length) u.target = b.nearest(u, m);
    } },
  { id: 'cw_maid', name: '전투 메이드 유닉스', tend: 'assassin', keywords: ['mech'], sprite: 'knight', palette: MAID, tier: 'minion', minPhase: 1,
    hp: 380, power: 30, armor: 140, eva: 0.1, interval: 0.7, range: 1, moveSpd: 1.5, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'cw_dropper', name: '투하 드론', tend: 'disrupt', keywords: ['mech'], sprite: 'drone', palette: ASH, tier: 'minion', minPhase: 2,
    hp: 260, power: 10, armor: 80, eva: 0.15, interval: 1.0, range: 4, moveSpd: 1.2, atk: { type: 'shoot', elem: 'phys' }, melee: false, noAttack: true,
    onTick: (b, u, dt) => {
      u.mem.dropT = (u.mem.dropT ?? 3) - dt;
      if (u.mem.dropT > 0) return;
      u.mem.dropT = 6;
      const t = b.nearest(u, b.targetable(u)); if (!t) return;
      const cell = b.freeCellNear(t.x, t.y);
      if (cell) petRock(b, cell);
    } },
  { id: 'cw_sub', name: '서브루틴', tend: 'pack', keywords: ['mech'], sprite: 'robe', palette: UNIX_ELITE, tier: 'elite', minPhase: 1,
    hp: 1100, power: 40, armor: 220, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    onTick: (b, u, dt) => {
      if (!command(b, u, 'cmdT', dt, 8, 4)) return;
      b.emit({ k: 'status', id: u.id, name: '작업 할당' });
      for (const a of b.alliesOf(u)) if (a.category === 'mech' && !a.mem.inert) b.buff(u, a, 'cw.sub', 4, { delta: { atkSpd: 0.3 }, label: '작업 가속' });
    } },
  { id: 'cw_ship', name: '회수함 \'루틴 7\'', tend: 'sniper', keywords: ['mech', 'struct'], sprite: 'turret', palette: UNIX_BOSS, tier: 'boss', minPhase: 1,
    hp: 3600, power: 44, armor: 340, effRes: 0.3, interval: 1.3, range: 6, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    escort: ['cw_reclaim', 'cw_maid', 'pt_unix'],
    skill: {
      name: '회수 빔', cd: 10, params: {}, desc: () => '기계 기물(없으면 체력 최저)을 끌어와 속박 + 취약',
      cast(b, u) {
        const es = b.targetable(u); if (!es.length) return false;
        const m = es.filter((e) => e.category === 'mech');
        const t = m.length ? b.nearest(u, m)! : es.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a));
        b.fx(t.x, t.y, 0, 'elec');
        b.pull(u, t);
        b.applyStatus(u, t, { type: 'buff', key: 'root', dur: 3 });
        b.applyStatus(u, t, { type: 'buff', key: 'cw.reclaim', dur: 3, taken: [{ kind: 'vuln', tag: 'all', v: 0.3 }], label: '회수 대상' });
        return true;
      },
    } },
  { id: 'cw_kernel', name: '커널 응답체', tend: 'escort', keywords: ['mech'], sprite: 'robe', palette: UNIX_BOSS, tier: 'boss', minPhase: 1,
    hp: 3200, power: 46, armor: 260, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    escort: ['cw_maid', 'cw_reclaim'],
    // 권한 거부: 체력 25% 구간마다 4초 무적 + 반려 돌 4개
    onTick: (b, u) => {
      const step = Math.floor((1 - b.hpPct(u)) / 0.25);
      if (step <= (u.mem.deny || 0) || step >= 4) return;
      u.mem.deny = step;
      u.mem.invulnUntil = b.t + 4;
      b.emit({ k: 'status', id: u.id, name: 'Root 권한이 없습니다' });
      for (let i = 0; i < 4; i++) { const c = b.freeCellNear(u.x, u.y + (u.y < b.h / 2 ? 2 : -2)); if (c) petRock(b, c); }
    } },
  { id: 'cw_rock', name: '반려 돌', tend: 'charge', keywords: ['struct'], sprite: 'turret', palette: STONE, tier: 'minion', minPhase: 99,
    hp: 480, power: 0, armor: 250, interval: 9, range: 0, immobile: true, atk: { type: 'strike', elem: 'phys' }, melee: false, noAttack: true, inert: true },

  // ── 금고선 히페리온호 (범은하 · 금고장 조디악)
  { id: 'hy_teller', name: '창구 은행원', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: BANK, tier: 'minion', minPhase: 1,
    hp: 320, power: 28, armor: 90, acc: 0.1, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'hy_cashier', name: '출납 드론', tend: 'sniper', keywords: ['mech'], sprite: 'drone', palette: BANK, tier: 'minion', minPhase: 1,
    hp: 220, power: 20, armor: 60, eva: 0.15, interval: 0.6, range: 2, moveSpd: 1.6, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'hy_exchange', name: '환전 집행관', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: BANK, tier: 'minion', minPhase: 1,
    hp: 460, power: 30, armor: 160, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    hooks: { dmgMult: (b) => 1 + 0.02 * Math.floor((b.ctx.credits || 0) / 10) } },
  { id: 'hy_appraiser', name: '감정 은행원', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: BANK_ELITE, tier: 'elite', minPhase: 1,
    hp: 1000, power: 40, armor: 200, acc: 0.15, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    skill: {
      name: '감정 중', cd: 7, params: {}, desc: () => '장비가 가장 많은 적 사격 + 4초 약화',
      cast(b, u) {
        const es = b.targetable(u); if (!es.length) return false;
        const t = es.reduce((a, c) => (gearCount(c) > gearCount(a) ? c : a));
        b.fx(t.x, t.y, 0, 'phys');
        skillHit(b, u, t, 'shoot', 1.2, 'phys');
        b.applyStatus(u, t, { type: 'buff', key: 'hy.appraise', dur: 4, mods: [{ kind: 'inc', tag: 'all', v: -0.3 }], delta: { atkSpd: -0.3 }, label: '감정 중' });
        return true;
      },
    } },
  { id: 'hy_door', name: '13번째 금고문', tend: 'escort', keywords: ['struct'], sprite: 'turret', palette: VAULT, tier: 'boss', minPhase: 1,
    hp: 2600, power: 38, armor: 360, effRes: 0.3, interval: 1.3, range: 5, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    escort: ['hy_teller', 'hy_exchange', 'turret'],
    // 금고 재봉인: 5초마다 자기 보호막 +1겹, 12초마다 모든 아군 +2겹 (처음 겹 수까지)
    onTick: (b, u, dt) => {
      u.mem.sealT = (u.mem.sealT || 0) + dt;
      u.mem.sealAll = (u.mem.sealAll || 0) + dt;
      if (u.mem.sealT >= 5) { u.mem.sealT = 0; addLayers(b, u, 1); }
      if (u.mem.sealAll >= 12) { u.mem.sealAll = 0; b.emit({ k: 'status', id: u.id, name: '금고 재봉인' }); for (const a of b.alliesOf(u, false)) addLayers(b, a, 2); }
    } },
  { id: 'hy_zodiac', name: '금고장 조디악', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: VAULT, tier: 'boss', minPhase: 1,
    hp: 3000, power: 46, armor: 220, acc: 0.15, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    escort: ['hy_teller', 'hy_cashier'],
    hooks: { dmgMult: (_b, u) => Math.pow(1.06, u.mem.interest || 0) },
    onTick: (b, u, dt) => {
      u.mem.intT = (u.mem.intT || 0) + dt;
      if (u.mem.intT < 5) return;
      u.mem.intT = 0;
      u.mem.interest = (u.mem.interest || 0) + 1;
      b.emit({ k: 'status', id: u.id, name: `이자 ×${Math.pow(1.06, u.mem.interest).toFixed(2)}` });
    } },

  // ── 브샤크 묘비 해안 (황무지 · 군체 휴면 군집)
  { id: 'bs_herring', name: '긴다리 청어 떼', tend: 'assassin', keywords: ['bio'], sprite: 'beast', palette: PALE, tier: 'minion', minPhase: 1,
    hp: 260, power: 24, armor: 50, eva: 0.2, interval: 0.6, range: 1, moveSpd: 1.7, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'bs_vapor', name: '기화 살점', tend: 'charge', keywords: ['bio'], sprite: 'crawler', palette: PALE, tier: 'minion', minPhase: 1,
    hp: 360, power: 24, armor: 80, interval: 0.9, range: 1, moveSpd: 1.1, atk: { type: 'strike', elem: 'chem' }, melee: true,
    hooks: { onLethal: (b, u) => { for (const e of b.around(u, 1, b.enemiesOf(u))) antiheal(b, u, e, 0.5, 3); return false; } } },
  { id: 'bs_knight', name: '해안 기사 개체', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: TOMB, tier: 'elite', minPhase: 1,
    hp: 1200, power: 42, armor: 260, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    hooks: { takenMult: (_b, _u, _s, o) => (o.elem === 'chem' ? 1 : 0.7) } },
  { id: 'bs_tomb', name: '묘비 개체', tend: 'pack', keywords: ['bio', 'struct'], sprite: 'turret', palette: TOMB_BOSS, tier: 'boss', minPhase: 1,
    hp: 2800, power: 38, armor: 260, effRes: 0.3, interval: 1.3, range: 4, immobile: true, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    escort: ['sw_spore'],
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'sw_spore', 2); } } },
  { id: 'bs_signal', name: '신호를 보내는 것', tend: 'assassin', keywords: ['bio', 'phantom'], sprite: 'phantom', palette: TOMB_BOSS, tier: 'boss', minPhase: 1,
    hp: 3300, power: 52, armor: 160, eva: 0.1, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    escort: ['bs_herring', 'sw_hound', 'bs_vapor'],
    skill: {
      name: '아는 목소리', cd: 7, params: {}, desc: () => '무작위 적 정신 피해 + 공포',
      cast(b, u) {
        const es = b.targetable(u); if (!es.length) return false;
        const t = es[b.rng.int(0, es.length - 1)];
        b.fx(t.x, t.y, 0, 'psy');
        skillHit(b, u, t, 'tech', 1.0, 'psy', { noMiss: true });
        fear(b, u, t, 2, 1);
        return true;
      },
    },
    onTick: (b, u) => {
      if (u.mem.hid || b.hpPct(u) > 0.5) return;
      u.mem.hid = 1;
      b.buff(u, u, 'stealth', 4, { label: '은신' });
    } },

  // ═════════ 공용 기믹 적 (여러 전장 풀 · 정예 후보 · 밀수 운반책은 무작위 출현). 수치는 CFG.foeKit
  // 원칙: 특정 속성 면역 없이, 해법이 여러 갈래 (폭딜 · 광역 · 다단 · 은신 감지 · 소환자 먼저 등). 대형 · 구조물은 '구조물' 분류 (속성 배율 없음)
  // [방벽 투사기] 시작 보호막 = 최대 체력. 보호막이 깨지면 [과부하]: 받는 피해 +50% · 주는 피해 −50% (그 전투 동안)
  { id: 'mx_aegis', name: '방벽 투사병', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: MERC, tier: 'minion', minPhase: 1,
    hp: 380, power: 26, armor: 150, interval: 1.1, range: 1, moveSpd: 0.9, atk: { type: 'strike', elem: 'phys' }, melee: true,
    hooks: {
      onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * K().aegis.shield); u.mem.aegis = 1; },
      onTick(b, u) {
        if (u.mem.aegis !== 1 || u.shield > 0) return;
        u.mem.aegis = 2;
        b.emit({ k: 'status', id: u.id, name: '방벽 과부하', harm: true });
        b.applyStatus(u, u, { type: 'buff', key: 'mx.overload', dur: 9999, taken: [{ kind: 'vuln', tag: 'all', v: K().aegis.taken }], mods: [{ kind: 'inc', tag: 'all', v: -K().aegis.weak }], label: '과부하' });
      },
    } },
  // [소집] 시작에 징집병 2기, 8초마다 2기 (동시 3기). 징집병이 하나라도 있으면 받는 피해 −20%. 지휘관이 쓰러지면 징집병도 흩어진다
  { id: 'mx_warden', name: '소집 지휘관', tend: 'escort', keywords: ['bio'], sprite: 'soldier', palette: MERC_ELITE, tier: 'elite', minPhase: 1,
    hp: 1000, power: 38, armor: 200, acc: 0.1, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    onTick: (b, u, dt) => {
      const W = K().warden;
      u.mem.callT = (u.mem.callT ?? 0) - dt;
      if (u.mem.callT > 0) return;
      u.mem.callT = W.every;
      const n = Math.min(W.n, W.cap - ownedAlive(b, u, ['mx_conscript']));
      if (n <= 0) return;
      b.emit({ k: 'status', id: u.id, name: '소집' });
      const fwd = u.y < b.h / 2 ? 1 : -1;
      for (let i = 0; i < n; i++) ownedSpawn(b, u, 'mx_conscript', { x: u.x + (i % 2 ? 1 : -1), y: u.y + fwd });
    },
    hooks: { takenMult: (b, u) => (ownedAlive(b, u, ['mx_conscript']) ? 1 - K().warden.red : 1) } },
  { id: 'mx_conscript', name: '징집병', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: MERC, tier: 'minion', minPhase: 99,
    hp: 240, power: 20, armor: 60, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  // [각성] 시작부터 공격 속도 +50% · 피해 +25%. 4번 맞으면 (지속 피해 제외) 5초 진정한 뒤 다시 각성
  { id: 'mx_stim', name: '각성제 강습병', tend: 'charge', keywords: ['bio'], sprite: 'knight', palette: MERC, tier: 'minion', minPhase: 1,
    hp: 400, power: 26, armor: 110, interval: 1.0, range: 1, moveSpd: 1.1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onTick: (b, u) => {
      if (u.mem.stim || b.t < (u.mem.calmUntil || 0)) return;
      const S = K().stim;
      u.mem.stim = 1; u.mem.stimHits = 0;
      b.applyStatus(u, u, { type: 'buff', key: 'mx.stim', dur: 9999, delta: { atkSpd: S.atkSpd }, mods: [{ kind: 'inc', tag: 'all', v: S.dmg }], label: '각성' });
    },
    hooks: { onHurt(b, u, _src, _r, o) {
      if (!u.mem.stim || o.tag === 'dot') return;
      if (++u.mem.stimHits < K().stim.hits) return;
      u.mem.stim = 0;
      u.mem.calmUntil = b.t + K().stim.calm;
      u.statuses = u.statuses.filter((s) => s.key !== 'mx.stim');
      b.emit({ k: 'status', id: u.id, name: '진정', harm: true });
    } } },
  // [광학 위장] 전투 시작 5초 은신 · 체력 50% 아래로 처음 떨어지면 3초 은신 (은신 중에도 광역 피해는 맞는다)
  { id: 'mx_shade', name: '광학 위장 저격수', tend: 'sniper', keywords: ['bio'], sprite: 'soldier', palette: MERC, tier: 'minion', minPhase: 2,
    hp: 280, power: 30, armor: 60, acc: 0.15, interval: 1.3, range: 4, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    onTick: (b, u) => {
      const S = K().shade;
      if (!u.mem.hid0) { u.mem.hid0 = 1; b.buff(u, u, 'stealth', S.hide, { label: '광학 위장' }); return; }
      if (u.mem.hid1 || b.hpPct(u) > S.low) return;
      u.mem.hid1 = 1;
      b.buff(u, u, 'stealth', S.hideLow, { label: '광학 위장' });
    } },
  // [야전 축성] 3초 뒤부터 8초마다 앞쪽 2칸 안 빈칸에 방벽 · 자동 포탑을 번갈아 (공병 1명당 동시 2개). 공병이 쓰러지면 구조물도 무너진다
  { id: 'mx_sapper', name: '야전 공병', tend: 'escort', builder: true, keywords: ['bio'], sprite: 'robe', palette: MERC, tier: 'minion', minPhase: 2,
    hp: 320, power: 22, armor: 90, interval: 1.2, range: 2, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    onTick: (b, u, dt) => {
      const S = K().sapper;
      u.mem.buildT = (u.mem.buildT ?? S.first) - dt;
      if (u.mem.buildT > 0 || b.has(u, 'stun')) return;
      u.mem.buildT = S.every;
      if (ownedAlive(b, u, ['mx_barrier', 'mx_sentry']) >= S.cap) return;
      const t = b.nearest(u, b.targetable(u)); if (!t) return;
      const dy = Math.sign(t.y - u.y) || 1;
      const cell = [[0, dy], [-1, dy], [1, dy], [0, 2 * dy], [-1, 2 * dy], [1, 2 * dy], [-1, 0], [1, 0]].map(([dx, d]) => ({ x: u.x + dx, y: u.y + d })).find((c) => b.inBounds(c.x, c.y) && !b.unitAt(c.x, c.y));
      if (!cell) return;
      const id = (u.mem.built = (u.mem.built || 0) + 1) % 2 ? 'mx_barrier' : 'mx_sentry';
      if (ownedSpawn(b, u, id, cell, true)) b.emit({ k: 'status', id: u.id, name: id === 'mx_barrier' ? '방벽 설치' : '포탑 설치' });
    } },
  { id: 'mx_barrier', name: '야전 방벽', tend: 'charge', keywords: ['struct'], sprite: 'turret', palette: MERC_BIG, tier: 'minion', minPhase: 99,
    hp: 520, power: 0, armor: 160, interval: 9, range: 0, immobile: true, atk: { type: 'strike', elem: 'phys' }, melee: false, noAttack: true },
  { id: 'mx_sentry', name: '야전 자동 포탑', tend: 'sniper', keywords: ['struct'], sprite: 'turret', palette: MERC_BIG, art: 'en_turret', tier: 'minion', minPhase: 99,
    hp: 300, power: 18, armor: 100, interval: 1.0, range: 3, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  // 대형 (2×2): 움직이지 않는 포격 보행기. 포탄이 맞은 칸 주변 1칸에 40%. 칸마다 맞지만 체력은 하나 (본체 칸 ×1 · 나머지 ×0.5)
  { id: 'mx_bastion', name: '공성 보행 포대', tend: 'sniper', size: { w: 2, h: 2 }, keywords: ['struct'], sprite: 'turret', palette: MERC_BIG, tier: 'minion', minPhase: 2,
    hp: 1400, power: 30, armor: 200, acc: 0.1, interval: 1.6, range: 5, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    onBasic: (b, u, t, r) => { if (r.miss || u.mem.part) return; b.fx(t.x, t.y, 1, 'phys'); for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) skillHit(b, u, e, 'shoot', 0.4, 'phys', { tag: 'proc', noMiss: true }); } },
  // 대형 (1×3): 앞줄을 가로막는 방벽 전차. 사거리 2 사격, 지킬 동료 곁의 대상을 친다
  { id: 'mx_rampart', name: '방벽 전차', tend: 'escort', size: { w: 3, h: 1 }, keywords: ['struct'], sprite: 'mech', palette: MERC_BIG, tier: 'minion', minPhase: 2,
    hp: 1300, power: 26, armor: 240, interval: 1.2, range: 2, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  // 교란형 근접: 아군이 몰린 곳을 두 번씩 베고 지나간다. 피해는 낮고 회피가 높다 (명중 · 광역 · 경계로 붙잡기)
  { id: 'mx_skirm', name: '교란 척후병', tend: 'disrupt', keywords: ['bio'], sprite: 'knight', palette: MERC, tier: 'minion', minPhase: 1,
    hp: 300, power: 22, armor: 70, eva: 0.1, interval: 0.8, range: 1, moveSpd: 1.2, atk: { type: 'strike', elem: 'phys' }, melee: true },
  // 밀수 운반책: 공격하지 않고 달아난다. 18초 (+페이즈마다 3초)가 지나거나 동료가 다 쓰러지고 5초가 지나면 빠져나간다 (보상 없음). 그 전에 쓰러뜨리면 크레딧
  { id: 'mx_smuggler', name: '밀수 운반책', tend: 'disrupt', keywords: ['bio'], sprite: 'beast', palette: SMUG, tier: 'minion', minPhase: 99,
    hp: 220, power: 10, armor: 40, interval: 9, range: 1, moveSpd: 0.9, atk: { type: 'strike', elem: 'phys' }, melee: true, noAttack: true,
    onTick: (b, u) => {
      const S = K().smuggler;
      if (!u.mem.bounty) { u.mem.bounty = S.credBase + S.credPer * b.ctx.phase; u.mem.escAt = S.escape + S.escPer * Math.max(0, b.ctx.phase - 1); }
      if (!u.mem.alone && !b.fighters(1).some((x) => x !== u && x.defId !== 'mx_smuggler')) { u.mem.alone = 1; u.mem.escAt = Math.min(u.mem.escAt, b.t + S.alone); }
      if (b.t >= u.mem.escAt) { u.alive = false; b.emit({ k: 'status', id: u.id, name: '탈출' }); b.emit({ k: 'die', id: u.id }); b.checkEnd(); return; }
      runAway(b, u);
    } },
];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const BOSS_ROTATION = ['varga', 'goliath', 'nyx'];

// ───────── 신규 전장 공용 헬퍼 (적 능력 · 전장 조건이 함께 쓴다)
/** build.ts 에서 주입: 적 생성 · 망령 · 장비 빌려 쓰기 · 충전 (battlefields.ts 가 충전을 채운다) */
export const ENEMY_RT: {
  spawn?: (b: Battle, defId: string, at: { x: number; y: number }, o?: { hpPct?: number; mult?: number; summon?: boolean; exact?: boolean }) => CUnit | null;
  ghost?: (b: Battle, from: CUnit) => CUnit | null;
  borrow?: (b: Battle, u: CUnit, n: number) => string[];
  charge?: (b: Battle, u: CUnit, n: number, src: CUnit) => void;
} = {};
/** 회복 감소 (받는 회복 × (1 - amt)) */
export function antiheal(b: Battle, u: CUnit, t: CUnit, amt: number, dur: number) {
  return b.applyStatus(u, t, { type: 'buff', key: 'antiheal', dur, healMul: 1 - amt, label: '회복 감소' });
}
/** 전장 광폭: 피해 +30%, 같은 편 포함 가장 가까운 대상 공격 (같은 편에겐 50%). 이성과 무관 */
export function rampage(b: Battle, u: CUnit, dur: number) {
  if (!u.alive || u.mem.inert) return;
  b.applyStatus(u, u, { type: 'buff', key: 'rampage', dur, mods: [{ kind: 'inc', tag: 'all', v: 0.3 }], label: '광폭' });
  u.target = null;
}
/** 프리버드: 산패 폭발 피해 2배 */
export const FREEBIRDS = new Set(['lv_raptor', 'lv_alpha', 'lv_king']);
/** 산패 폭발: 주변 r칸 모든 유닛(양쪽)에게 각자 최대 체력 pct 화학 피해 */
export function gasBlast(b: Battle, src: CUnit, x: number, y: number, r: number, pct: number) {
  b.emit({ k: 'fx', x, y, r, elem: 'chem' });
  for (const t of b.units.filter((v) => v.alive && !v.mem.inert && b.dist(v, { x, y }) <= r)) b.rawHit(src, t, b.S(t, 'maxHp') * pct * (FREEBIRDS.has(t.defId) ? 2 : 1), 'chem');
}
/** 아군 기물의 장비 수 (감정 · 원격 잠금 대상 고르기) */
export const gearCount = (c: CUnit) => (c.src?.items.filter(Boolean).length || 0) + (c.tempItems?.length || 0);
/** 전장 장애물 (반려 돌 · 묘석): 칸을 막고 life 초 뒤 사라진다. 동시에 최대 10개 */
export function dropObstacle(b: Battle, defId: string, cell: { x: number; y: number }, life: number) {
  if (b.units.filter((v) => v.alive && v.mem.inert).length >= 10) return null;
  const o = ENEMY_RT.spawn?.(b, defId, cell, { exact: true, summon: true });
  if (!o) return null;
  b.later(life, () => { if (o.alive) { o.alive = false; b.emit({ k: 'die', id: o.id }); } });
  return o;
}
/** 답례 투하: 반려 돌 + 낙하 칸 주변 1칸 아군(플레이어 쪽) 최대 체력 pct 물리 피해 (캣휠 전장 규칙 8%, 적 기술 6%) */
export function petRock(b: Battle, cell: { x: number; y: number }, pct = 0.06) {
  const o = dropObstacle(b, 'cw_rock', cell, 20);
  if (!o) return null;
  b.emit({ k: 'fx', x: cell.x, y: cell.y, r: 1, elem: 'phys' });
  for (const t of b.around(cell, 1, b.living(0))) b.rawHit(o, t, b.S(t, 'maxHp') * pct, 'phys');
  return o;
}
/** 히페리온 보호막 겹 더하기 (처음 겹 수까지) */
export function addLayers(b: Battle, u: CUnit, n: number) {
  if (!u.alive || !u.mem.layersMax) return;
  const v = Math.min(u.mem.layersMax, (u.mem.layers || 0) + n);
  if (v > (u.mem.layers || 0)) { u.mem.layers = v; b.emit({ k: 'status', id: u.id, name: `보호막 ${v}겹` }); }
}

// build.ts 에서 주입 (순환 import 방지)
export let summonHook: ((b: Battle, owner: CUnit, defId: string, count: number) => void) | null = null;
export function setSummonHook(f: typeof summonHook) { summonHook = f; }
