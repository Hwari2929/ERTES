import type { Battle, CUnit, SkillDef } from '../engine/combat';
import type { Elem, Keyword } from '../types';
import { bleed, corrode, fear, lineTargets, poison, skillHit } from './kit';

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
  // ═════════ 전장별 적 (플레이스홀더 스프라이트: 나중에 에셋으로 교체)
  // ── 군체 (연합 · 베르타–산노디스 물류망)
  { id: 'sw_spore', name: '포자 살점', keywords: ['bio'], sprite: 'crawler', palette: SWARM, tier: 'minion', minPhase: 1,
    hp: 360, power: 24, armor: 80, interval: 0.9, range: 1, moveSpd: 1.1, atk: { type: 'strike', elem: 'chem' }, melee: true,
    onBasic: (b, u, t) => { poison(b, u, t, b.S(u, 'strike') * 0.2, 3, 0.5); } },
  { id: 'sw_hound', name: '군체 사냥개체', keywords: ['bio'], sprite: 'beast', palette: SWARM, tier: 'minion', minPhase: 1,
    hp: 320, power: 28, armor: 70, eva: 0.1, interval: 0.7, range: 1, moveSpd: 1.5, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'sw_spitter', name: '산성 분사체', keywords: ['bio'], sprite: 'crawler', palette: SWARM2, tier: 'minion', minPhase: 1,
    hp: 280, power: 26, armor: 60, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    onBasic: (b, u, t) => { corrode(b, u, t, 0.85, 3, 0.3); } },
  { id: 'sw_carrier', name: '마부 개체', keywords: ['bio'], sprite: 'beast', palette: SWARM2, tier: 'minion', minPhase: 2,
    hp: 900, power: 30, armor: 300, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '짓밟기', cd: 10, needsRange: true, params: {}, desc: () => '주변 적 피해 + 기절',
      cast(b, u) { b.fx(u.x, u.y, 1, 'phys'); for (const e of b.around(u, 1, b.enemiesOf(u))) { skillHit(b, u, e, 'strike', 1.0, 'phys'); b.stun(u, e, 1, 0.6); } return true; },
    } },
  { id: 'sw_brood', name: '군체 산란체', keywords: ['bio'], sprite: 'crawler', palette: SWARM_ELITE, tier: 'elite', minPhase: 1,
    hp: 1200, power: 36, armor: 200, interval: 1.2, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'chem' }, melee: true,
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 10) { u.mem.spawnT = 0; summonHook?.(b, u, 'sw_spore', 2); } } },
  { id: 'sw_queen', name: '군체 여왕', keywords: ['bio', 'phantom'], sprite: 'phantom', palette: SWARM_BOSS, tier: 'boss', minPhase: 1,
    hp: 3000, power: 46, armor: 180, effRes: 0.3, interval: 1.0, range: 3, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    escort: ['sw_hound', 'sw_spitter'],
    skill: {
      name: '사이오닉 지배', cd: 8, params: {}, desc: () => '군체 광폭화 + 3칸 정신 피해',
      cast(b, u) {
        b.fx(u.x, u.y, 3, 'psy');
        for (const a of b.alliesOf(u)) b.buff(u, a, 'swarm.dom', 5, { delta: { atkSpd: 0.3 }, mods: [{ kind: 'inc', tag: 'all', v: 0.25 }], label: '사이오닉장' });
        for (const e of b.around(u, 3, b.enemiesOf(u))) { skillHit(b, u, e, 'tech', 0.8, 'psy', { noMiss: true }); fear(b, u, e, 1, 0.3); }
        return true;
      },
    } },
  { id: 'sw_harvester', name: '거대 마부 개체', keywords: ['bio'], sprite: 'beast', palette: SWARM_BOSS, tier: 'boss', minPhase: 1,
    hp: 3500, power: 44, armor: 320, effRes: 0.3, interval: 1.3, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['sw_spore', 'sw_spore'],
    skill: {
      name: '포식', cd: 8, needsRange: true, params: {}, desc: () => '대상 강타 + 자가 회복',
      cast(b, u) { const t = u.target; if (!t?.alive) return false; b.fx(t.x, t.y, 0, 'chem'); skillHit(b, u, t, 'strike', 2.5, 'phys'); b.heal(u, u, b.S(u, 'maxHp') * 0.08); return true; },
    },
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'sw_spore', 2); } } },

  // ── 크림슨 대공령 (제국)
  { id: 'cr_thrall', name: '혈족 종자', keywords: ['bio'], sprite: 'knight', palette: CRIMSON, tier: 'minion', minPhase: 1,
    hp: 440, power: 30, armor: 140, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u) => { b.heal(u, u, b.S(u, 'strike') * 0.6); } },
  { id: 'cr_hound', name: '배양 사냥개', keywords: ['bio'], sprite: 'beast', palette: CRIMSON, tier: 'minion', minPhase: 1,
    hp: 340, power: 28, armor: 80, eva: 0.1, interval: 0.7, range: 1, moveSpd: 1.5, atk: { type: 'strike', elem: 'phys' }, melee: true,
    onBasic: (b, u, t) => { bleed(b, u, t, b.S(u, 'strike') * 0.2, 3, 0.4); } },
  { id: 'cr_musket', name: '정맥관 총사', keywords: ['bio'], sprite: 'soldier', palette: CRIMSON, tier: 'minion', minPhase: 1,
    hp: 300, power: 30, armor: 80, acc: 0.1, interval: 1.2, range: 4, atk: { type: 'shoot', elem: 'phys' }, melee: false },
  { id: 'cr_leech', name: '배양조 사제', keywords: ['bio'], sprite: 'medic', palette: CRIMSON2, tier: 'minion', minPhase: 2,
    hp: 340, power: 24, armor: 80, interval: 1.2, range: 3, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    skill: {
      name: '수혈', cd: 6, params: {}, desc: () => '아군 회복',
      cast(b, u) { const l = b.lowestHpAlly(u); if (!l || b.hpPct(l) > 0.85) return false; b.fx(l.x, l.y, 0, 'chem'); b.heal(u, l, b.S(u, 'tech') * 3); return true; },
    } },
  { id: 'cr_knight', name: '크림슨 혈기사', keywords: ['bio'], sprite: 'knight', palette: CRIMSON_ELITE, tier: 'elite', minPhase: 1,
    hp: 1200, power: 44, armor: 300, acc: 0.1, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '피의 일섬', cd: 8, needsRange: true, params: {}, desc: () => '주변 베기 + 흡혈',
      cast(b, u) { b.fx(u.x, u.y, 1, 'phys'); for (const e of b.around(u, 1, b.enemiesOf(u))) skillHit(b, u, e, 'strike', 1.6, 'phys'); b.heal(u, u, b.S(u, 'maxHp') * 0.12); return true; },
    } },
  { id: 'cr_count', name: '혈족 백작', keywords: ['bio'], sprite: 'knight', palette: CRIMSON_BOSS, tier: 'boss', minPhase: 1,
    hp: 3300, power: 50, armor: 280, acc: 0.15, effRes: 0.3, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['cr_thrall', 'cr_musket'],
    skill: {
      name: '혈연 축제', cd: 9, params: {}, desc: () => '2칸 피해 + 흡혈 + 아군 강화',
      cast(b, u) {
        const es = b.around(u, 2, b.enemiesOf(u)); if (!es.length) return false;
        b.fx(u.x, u.y, 2, 'phys');
        for (const e of es) skillHit(b, u, e, 'strike', 1.4, 'phys');
        b.heal(u, u, b.S(u, 'maxHp') * 0.12);
        for (const a of b.alliesOf(u)) b.buff(u, a, 'crimson.feast', 5, { mods: [{ kind: 'inc', tag: 'all', v: 0.25 }], label: '혈연 축제' });
        return true;
      },
    } },
  { id: 'cr_heart', name: '그라나툼 심핵 수호체', keywords: ['bio', 'struct'], sprite: 'mech', palette: CRIMSON_BOSS, tier: 'boss', minPhase: 1,
    hp: 3400, power: 40, armor: 280, effRes: 0.3, interval: 1.3, range: 5, immobile: true, atk: { type: 'shoot', elem: 'chem' }, melee: false,
    escort: ['cr_hound', 'cr_thrall'],
    skill: {
      name: '박동', cd: 7, params: {}, desc: () => '모든 적 화학 피해 + 중독',
      cast(b, u) { b.fx(u.x, u.y, 4, 'chem'); for (const e of b.enemiesOf(u)) { skillHit(b, u, e, 'tech', 0.5, 'chem', { noMiss: true }); poison(b, u, e, b.S(u, 'tech') * 0.1, 4, 0.5); } return true; },
    },
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'cr_thrall', 1); } } },

  // ── 스파르타 전쟁 궤도 (동맹)
  { id: 'sp_hoplite', name: '호플리테 메카', keywords: ['mech'], sprite: 'mech', palette: SPARTA, tier: 'minion', minPhase: 1,
    hp: 650, power: 28, armor: 420, effRes: 0.3, interval: 1.2, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'sp_lancer', name: '창병 메카', keywords: ['mech'], sprite: 'knight', palette: SPARTA, tier: 'minion', minPhase: 1,
    hp: 420, power: 34, armor: 220, interval: 1.0, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'sp_archer', name: '궤도 사수 메카', keywords: ['mech'], sprite: 'soldier', palette: SPARTA, tier: 'minion', minPhase: 1,
    hp: 300, power: 30, armor: 150, acc: 0.1, interval: 1.2, range: 4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'sp_drone', name: '예인 드론', keywords: ['mech'], sprite: 'drone', palette: SPARTA, tier: 'minion', minPhase: 2,
    hp: 240, power: 22, armor: 100, eva: 0.15, interval: 0.7, range: 2, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'sp_phalanx', name: '팔랑크스 지휘기', keywords: ['mech'], sprite: 'mech', palette: SPARTA_ELITE, tier: 'elite', minPhase: 1,
    hp: 1300, power: 38, armor: 500, effRes: 0.3, interval: 1.2, range: 1, moveSpd: 0.8, atk: { type: 'strike', elem: 'phys' }, melee: true,
    skill: {
      name: '방패벽', cd: 9, params: {}, desc: () => '아군 보호막 + 방어도 증가',
      cast(b, u) { b.fx(u.x, u.y, 2, 'phys'); for (const a of b.alliesOf(u)) { b.shield(a, b.S(a, 'maxHp') * 0.15); b.buff(u, a, 'sparta.wall', 4, { delta: { armor: 200 }, label: '방패벽' }); } return true; },
    } },
  { id: 'sp_spear', name: '창구 절멸 포대', keywords: ['mech', 'struct'], sprite: 'turret', palette: SPARTA_BOSS, tier: 'boss', minPhase: 1,
    hp: 4000, power: 52, armor: 450, effRes: 0.4, interval: 1.4, range: 7, immobile: true, atk: { type: 'shoot', elem: 'elec' }, melee: false,
    escort: ['sp_hoplite', 'sp_hoplite', 'sp_archer'],
    skill: {
      name: '절멸 광선', cd: 7, params: {}, desc: () => '직선 관통 전기 피해',
      cast(b, u) { const t = u.target?.alive ? u.target : b.farthest(u); if (!t) return false; for (const e of lineTargets(b, u, t)) { b.fx(e.x, e.y, 0, 'elec'); skillHit(b, u, e, 'tech', 2.0, 'elec', { noMiss: true }); } return true; },
    } },
  { id: 'sp_colossus', name: '전쟁 궤도 콜로서스', keywords: ['mech'], sprite: 'mech', palette: SPARTA_BOSS, tier: 'boss', minPhase: 1,
    hp: 3500, power: 46, armor: 360, effRes: 0.3, interval: 1.4, range: 1, moveSpd: 0.7, atk: { type: 'strike', elem: 'phys' }, melee: true,
    escort: ['sp_lancer', 'sp_archer'],
    skill: {
      name: '진동 충격', cd: 7, params: {}, desc: () => '주변 2칸 피해 + 기절',
      cast(b, u) { const es = b.around(u, 2, b.enemiesOf(u)); if (!es.length) return false; b.fx(u.x, u.y, 2, 'elec'); for (const e of es) { skillHit(b, u, e, 'tech', 1.2, 'elec', { noMiss: true }); b.stun(u, e, 1, 0.5); } return true; },
    },
    onTick: (b, u, dt) => { u.mem.spawnT = (u.mem.spawnT || 0) + dt; if (u.mem.spawnT >= 15) { u.mem.spawnT = 0; summonHook?.(b, u, 'sp_drone', 2); } } },

  // ── 페트라 본사 성역 · 격리 구역
  { id: 'pt_guard', name: '보안 집행 로봇', keywords: ['mech'], sprite: 'mech', palette: PETRA, tier: 'minion', minPhase: 1,
    hp: 600, power: 30, armor: 300, interval: 1.2, range: 1, moveSpd: 0.9, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'pt_drone', name: '감시 드론', keywords: ['mech'], sprite: 'drone', palette: PETRA, tier: 'minion', minPhase: 1,
    hp: 240, power: 22, armor: 80, eva: 0.15, interval: 0.7, range: 3, moveSpd: 1.4, atk: { type: 'shoot', elem: 'elec' }, melee: false },
  { id: 'pt_unix', name: '유닉스 생산 로봇', keywords: ['mech'], sprite: 'mech', palette: UNIX, tier: 'minion', minPhase: 1,
    hp: 500, power: 26, armor: 250, interval: 1.1, range: 1, atk: { type: 'strike', elem: 'phys' }, melee: true },
  { id: 'pt_anomaly', name: '격리 이탈 개체', keywords: ['phantom'], sprite: 'phantom', palette: ANOMALY, tier: 'minion', minPhase: 2,
    hp: 320, power: 32, armor: 40, eva: 0.3, interval: 1.1, range: 2, atk: { type: 'shoot', elem: 'psy' }, melee: false,
    onBasic: (b, u, t) => { fear(b, u, t, 1, 0.15); } },
  { id: 'pt_auditor', name: '정보감사관', keywords: ['bio'], sprite: 'soldier', palette: PETRA_ELITE, tier: 'elite', minPhase: 1,
    hp: 1000, power: 40, armor: 200, acc: 0.15, interval: 1.1, range: 3, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    skill: {
      name: '감사번호 부여', cd: 7, params: {}, desc: () => '대상 피격 피해 증가 (영구 기록)',
      cast(b, u) { const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u)); if (!t) return false; b.fx(t.x, t.y, 0, 'phys'); skillHit(b, u, t, 'shoot', 1.5, 'phys'); b.applyStatus(u, t, { type: 'buff', key: 'pt.audit', dur: 8, taken: [{ kind: 'vuln', tag: 'all', v: 0.3 }], label: '감사번호' }); return true; },
    } },
  { id: 'pt_contract', name: '계약서에 없던 것', keywords: ['phantom'], sprite: 'phantom', palette: ANOMALY_BOSS, tier: 'boss', minPhase: 1,
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
  { id: 'pt_unixline', name: '유닉스 생산 라인', keywords: ['mech', 'struct'], sprite: 'turret', palette: UNIX, tier: 'boss', minPhase: 1,
    hp: 3400, power: 38, armor: 320, effRes: 0.3, interval: 1.2, range: 4, immobile: true, atk: { type: 'shoot', elem: 'phys' }, melee: false,
    escort: ['pt_guard', 'pt_drone'],
    // 1원칙: 매 분기 직전 대비 더 많이 생산한다
    onTick: (b, u, dt) => {
      u.mem.spawnT = (u.mem.spawnT || 0) + dt;
      if (u.mem.spawnT < 12) return;
      u.mem.spawnT = 0;
      u.mem.quarter = (u.mem.quarter || 0) + 1;
      const alive = b.alliesOf(u).filter((a) => a.defId === 'pt_unix').length;
      summonHook?.(b, u, 'pt_unix', Math.max(0, Math.min(1 + Math.floor(u.mem.quarter / 2), 5 - alive)));
    } },
];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const BOSS_ROTATION = ['varga', 'goliath', 'nyx'];

// build.ts 에서 주입 (순환 import 방지)
export let summonHook: ((b: Battle, owner: CUnit, defId: string, count: number) => void) | null = null;
export function setSummonHook(f: typeof summonHook) { summonHook = f; }
