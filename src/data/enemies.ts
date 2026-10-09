import type { Battle, CUnit, SkillDef } from '../engine/combat';
import type { Elem, Keyword } from '../types';
import { fear, poison, skillHit } from './kit';

export interface EnemyDef {
  id: string;
  name: string;
  keywords: Keyword[];
  sprite: string;
  palette: string[];
  tier: 'minion' | 'elite' | 'boss';
  minPhase: number;
  hp: number; power: number; armor: number;
  acc?: number; eva?: number; crit?: number; effHit?: number; effRes?: number;
  interval: number; range: number; moveSpd?: number;
  atk: { type: 'shoot' | 'strike'; elem: Elem };
  immobile?: boolean;
  melee: boolean;
  skill?: SkillDef;
  onBasic?: (b: Battle, u: CUnit, t: CUnit) => void;
  onTick?: (b: Battle, u: CUnit, dt: number) => void;
  escort?: string[];
}

const RAIDER = ['#1a0f0a', '#7a5a3a', '#c04a2a', '#d0a080', '#ff5030', '#55504a', '#f0d0a0'];
const MACHINE = ['#0c0e12', '#6a7480', '#3a4048', '#9aa4ae', '#ff3040', '#40464e', '#d8e0e8'];
const VOID = ['#0a0612', '#4a2a7a', '#8a5ad0', '#c0a0ff', '#ff60e0', '#30204a', '#f0e0ff'];
const BUG = ['#0a120a', '#4a7a2a', '#a0d040', '#c0e080', '#ffe040', '#2a402a', '#e0ffc0'];

export const ENEMIES: EnemyDef[] = [
  { id: 'raider', name: '약탈자 척후병', keywords: ['bio'], sprite: 'knight', palette: RAIDER, tier: 'minion', minPhase: 1,
    hp: 420, power: 30, armor: 120, acc: 0.05, eva: 0.05, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'gunner', name: '약탈자 사수', keywords: ['bio'], sprite: 'soldier', palette: RAIDER, tier: 'minion', minPhase: 1,
    hp: 320, power: 28, armor: 80, acc: 0.1, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'drone', name: '정찰 드론', keywords: ['mech'], sprite: 'drone', palette: MACHINE, tier: 'minion', minPhase: 1,
    hp: 230, power: 20, armor: 60, eva: 0.15, interval: 0.7, range: 2, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'crawler', name: '산성 크롤러', keywords: ['bio'], sprite: 'crawler', palette: BUG, tier: 'minion', minPhase: 1,
    hp: 380, power: 24, armor: 100, interval: 0.9, range: 1, moveSpd: 1.2, atk: { type: 'strike', elem: 'chem' }, melee: true,
    onBasic: (b, u, t) => { poison(b, u, t, b.S(u, 'strike') * 0.25, 3, 0.5); } },
  { id: 'trooper', name: '강습 기갑병', keywords: ['mech'], sprite: 'mech', palette: MACHINE, tier: 'minion', minPhase: 2,
    hp: 700, power: 32, armor: 350, interval: 1.3, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '충격 강타', cd: 10, needsRange: true, params: {}, desc: () => '주변 적 기절',
      cast(b, u) { b.fx(u.x, u.y, 1, 'phys'); for (const e of b.around(u, 1, b.enemiesOf(u))) { skillHit(b, u, e, 'strike', 1.0, 'phys'); b.stun(u, e, 1, 0.7); } return true; },
    } },
  { id: 'turret', name: '방어 포탑', keywords: ['struct', 'mech'], sprite: 'turret', palette: MACHINE, tier: 'minion', minPhase: 2,
    hp: 600, power: 34, armor: 300, acc: 0.1, interval: 1.2, range: 4, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'wraith', name: '공허 환영', keywords: ['phantom'], sprite: 'phantom', palette: VOID, tier: 'minion', minPhase: 2,
    hp: 300, power: 30, armor: 40, eva: 0.25, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false },
  { id: 'priest', name: '사이오닉 사제', keywords: ['bio', 'phantom'], sprite: 'medic', palette: VOID, tier: 'minion', minPhase: 3,
    hp: 340, power: 24, armor: 80, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    skill: {
      name: '공허 치유', cd: 6, params: {}, desc: () => '아군 회복',
      cast(b, u) { const l = b.lowestHpAlly(u); if (!l || b.hpPct(l) > 0.85) return false; b.fx(l.x, l.y, 0, 'psy'); b.heal(u, l, b.S(u, 'tech') * 3); return true; },
    } },
  { id: 'warlord', name: '약탈자 두목', keywords: ['bio'], sprite: 'knight', palette: ['#1a0a0a', '#a02020', '#e0a020', '#d0a080', '#ffe040', '#55504a', '#fff0a0'],
    tier: 'elite', minPhase: 1, hp: 1100, power: 42, armor: 250, acc: 0.1, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '약탈 명령', cd: 8, needsRange: true, params: {}, desc: () => '광역 베기 + 아군 강화',
      cast(b, u) {
        b.fx(u.x, u.y, 1, 'phys');
        for (const e of b.around(u, 1, b.enemiesOf(u))) skillHit(b, u, e, 'strike', 1.5, 'phys');
        for (const a of b.alliesOf(u)) b.buff(u, a, 'warlord', 4, { mods: [{ kind: 'inc', tag: 'all', v: 0.2 }], label: '약탈 명령' });
        return true;
      },
    } },
  // ───────── 보스
  { id: 'varga', name: '약탈 함장 바르가', keywords: ['bio'], sprite: 'knight', palette: ['#1a0a0a', '#601818', '#e0a020', '#d0a080', '#ff3020', '#55504a', '#fff0a0'],
    tier: 'boss', minPhase: 1, hp: 3200, power: 50, armor: 300, acc: 0.15, effRes: 0.3, interval: 1.1, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['raider', 'gunner'],
    skill: {
      name: '함장의 호령', cd: 9, needsRange: true, params: {}, desc: () => '대상 강타 + 아군 광폭화',
      cast(b, u) {
        const t = u.target; if (!t?.alive) return false;
        b.fx(t.x, t.y, 0, 'phys');
        skillHit(b, u, t, 'strike', 2.2, 'phys');
        for (const a of b.alliesOf(u)) b.buff(u, a, 'varga', 5, { delta: { atkSpd: 0.3 }, mods: [{ kind: 'inc', tag: 'all', v: 0.3 }], label: '광폭화' });
        return true;
      },
    } },
  { id: 'goliath', name: '강철 군주 골리앗', keywords: ['mech', 'struct'], sprite: 'mech', palette: ['#0c0e12', '#8a6a30', '#3a4048', '#c0c8d0', '#30d0ff', '#40464e', '#fff0c0'],
    tier: 'boss', minPhase: 2, hp: 4200, power: 46, armor: 550, effRes: 0.3, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
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
      if (u.mem.summon >= 12) { u.mem.summon = 0; summonHook?.(b, u, 'drone', 2); }
    } },
  { id: 'nyx', name: '공허의 여왕 닉스', keywords: ['phantom'], sprite: 'phantom', palette: ['#0a0612', '#2a0a4a', '#d050ff', '#ffb0ff', '#ffffff', '#30204a', '#ffe0ff'],
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
];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const BOSS_ROTATION = ['varga', 'goliath', 'nyx'];

// build.ts 에서 주입 (순환 import 방지)
export let summonHook: ((b: Battle, owner: CUnit, defId: string, count: number) => void) | null = null;
export function setSummonHook(f: typeof summonHook) { summonHook = f; }
