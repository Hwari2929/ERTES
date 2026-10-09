import type { Effect } from '../engine/effects';
import { inc, red, scaleEffect } from '../engine/effects';
import type { Major } from '../types';
import { MAJOR_NAME } from '../types';

// 재료(일반) 2개 → 고급, 같은 고급 2개 → 전설(효과 3배)
export const COMPONENTS: { id: string; major: Major; name: string; icon: string }[] = [
  { id: 'C_vit', major: 'vit', name: '강화 섬유', icon: '❤' },
  { id: 'C_pow', major: 'pow', name: '출력 코어', icon: '⚔' },
  { id: 'C_mnd', major: 'mnd', name: '신경 칩', icon: '◈' },
  { id: 'C_def', major: 'def', name: '복합 장갑판', icon: '⛊' },
  { id: 'C_agi', major: 'agi', name: '추진 모듈', icon: '➶' },
];
const COMP_PTS = 3;

interface AdvDef { id: string; a: Major; b: Major; name: string; desc: (k: number) => string; effect: (k: number) => Effect }

const ADV: AdvDef[] = [
  { id: 'vit_vit', a: 'vit', b: 'vit', name: '재생 외골격', desc: (k) => `초당 최대 체력 ${2 * k}% 회복.`,
    effect: (k) => ({ hooks: { onTick(bt, u, dt) { u.mem.exo = (u.mem.exo || 0) + dt; if (u.mem.exo >= 1) { u.mem.exo = 0; bt.heal(u, u, bt.S(u, 'maxHp') * 0.02 * k); } } } }) },
  { id: 'vit_pow', a: 'vit', b: 'pow', name: '광전사 갑주', desc: (k) => `체력 50% 이하일 때 피해 +${30 * k}%.`,
    effect: (k) => ({ hooks: { dmgMult: (bt, u) => (bt.hpPct(u) <= 0.5 ? 1 + 0.3 * k : 1) } }) },
  { id: 'vit_mnd', a: 'vit', b: 'mnd', name: '생체 동기화기', desc: (k) => `회복 효율 +${30 * k}%, 효과 저항 +${15 * k}%p.`,
    effect: () => ({ stats: { healEff: 0.3, effRes: 0.15 } }) },
  { id: 'vit_def', a: 'vit', b: 'def', name: '수호자 판금', desc: (k) => `전투 시작 시 최대 체력 ${20 * k}% 보호막.`,
    effect: (k) => ({ hooks: { onStart(bt, u) { bt.shield(u, bt.S(u, 'maxHp') * 0.2 * k); } } }) },
  { id: 'vit_agi', a: 'vit', b: 'agi', name: '생존 키트', desc: (k) => `치명적인 피해를 받으면 전투당 ${k}회 버티고 체력 30% 회복.`,
    effect: (k) => ({ hooks: { onLethal(bt, u) { if ((u.mem.kit || 0) >= k) return false; u.mem.kit = (u.mem.kit || 0) + 1; u.hp = 1; bt.heal(u, u, bt.S(u, 'maxHp') * 0.3, true); return true; } } }) },
  { id: 'pow_pow', a: 'pow', b: 'pow', name: '과출력 무기', desc: (k) => `모든 피해 +${15 * k}%.`,
    effect: () => ({ mods: [inc('all', 0.15)] }) },
  { id: 'pow_mnd', a: 'pow', b: 'mnd', name: '조준 보조 AI', desc: (k) => `치명타 확률 +${10 * k}%p, 치명타 피해 +${40 * k}%p.`,
    effect: () => ({ stats: { crit: 0.1, critDmg: 0.4 } }) },
  { id: 'pow_def', a: 'pow', b: 'def', name: '중력 해머', desc: (k) => `기본 공격 시 ${Math.min(100, 20 * k)}% 확률로 대상 1초 기절.`,
    effect: (k) => ({ hooks: { onBasic(bt, u, t) { if (t.alive && bt.rng.chance(0.2 * k)) bt.stun(u, t, 1); } } }) },
  { id: 'pow_agi', a: 'pow', b: 'agi', name: '고속 연사 장치', desc: (k) => `공격 속도 +${30 * k}%.`,
    effect: () => ({ stats: { atkSpd: 0.3 } }) },
  { id: 'mnd_mnd', a: 'mnd', b: 'mnd', name: '사이오닉 증폭기', desc: (k) => `기술 위력 +${30 * k}%, 효과 명중 +${20 * k}%p.`,
    effect: () => ({ pct: { tech: 0.3 }, stats: { effHit: 0.2 } }) },
  { id: 'mnd_def', a: 'mnd', b: 'def', name: '전자전 모듈', desc: (k) => `기본 공격 시 ${Math.min(100, 20 * k)}% 확률로 대상 2초 감전.`,
    effect: (k) => ({ hooks: { onBasic(bt, u, t) { if (t.alive && bt.rng.chance(0.2 * k)) bt.applyStatus(u, t, { type: 'shock', key: 'shock', dur: 2 }); } } }) },
  { id: 'mnd_agi', a: 'mnd', b: 'agi', name: '예지 회로', desc: (k) => `쿨다운 감소 속도 +${30 * k}%.`,
    effect: () => ({ stats: { cdr: 0.3 } }) },
  { id: 'def_def', a: 'def', b: 'def', name: '요새 장갑', desc: (k) => `받는 피해 -${Math.min(80, 15 * k)}%.`,
    effect: () => ({ taken: [red('all', 0.15)] }) },
  { id: 'def_agi', a: 'def', b: 'agi', name: '반응 장갑', desc: (k) => `받은 피해의 ${15 * k}%를 공격자에게 반사.`,
    effect: (k) => ({ hooks: { onStart(bt, u) { bt.buff(u, u, 'item.reactive', 999, { reflect: 0.15 * k, label: '' }); } } }) },
  { id: 'agi_agi', a: 'agi', b: 'agi', name: '위상 이동기', desc: (k) => `회피 +${15 * k}%p. 회피할 때마다 공격 속도 +${5 * k}% (최대 10중첩).`,
    effect: (k) => ({
      stats: { eva: 0.15 },
      hooks: { onEvade(bt, u) { u.mem.phase = Math.min(10, (u.mem.phase || 0) + 1); const s = u.statuses.find((x) => x.key === 'item.phase'); const d = { atkSpd: 0.05 * k * u.mem.phase }; if (s) s.delta = d; else bt.buff(u, u, 'item.phase', 999, { delta: d, label: '' }); } },
    }) },
];
// stats/pct/mods/taken 기반 효과는 scaleEffect 로 배율 적용, 훅 기반은 k 를 직접 받는다
const HOOK_SCALED = new Set(['vit_vit', 'vit_pow', 'vit_def', 'vit_agi', 'pow_def', 'mnd_def', 'def_agi', 'agi_agi']);

export interface ItemInfo { id: string; tier: 'C' | 'A' | 'L'; name: string; icon: string; majors: Partial<Record<Major, number>>; desc: string; recipe?: [string, string] }

const ADV_BY_ID = Object.fromEntries(ADV.map((a) => [a.id, a]));

export function itemInfo(id: string): ItemInfo {
  const [tier, rest] = [id[0] as 'C' | 'A' | 'L', id.slice(2)];
  if (tier === 'C') {
    const c = COMPONENTS.find((x) => x.id === id)!;
    return { id, tier, name: c.name, icon: c.icon, majors: { [c.major]: COMP_PTS }, desc: `${MAJOR_NAME[c.major]} +${COMP_PTS}` };
  }
  const a = ADV_BY_ID[rest];
  const k = tier === 'L' ? 3 : 1;
  const majors: Partial<Record<Major, number>> = {};
  majors[a.a] = (majors[a.a] || 0) + COMP_PTS * k;
  majors[a.b] = (majors[a.b] || 0) + COMP_PTS * k;
  const mtxt = Object.entries(majors).map(([m, v]) => `${MAJOR_NAME[m as Major]} +${v}`).join(', ');
  return {
    id, tier, name: (tier === 'L' ? '[전설] ' : '') + a.name, icon: COMPONENTS.find((c) => c.major === a.a)!.icon,
    majors, desc: `${mtxt}. ${a.desc(k)}`, recipe: tier === 'A' ? [`C_${a.a}`, `C_${a.b}`] : undefined,
  };
}

export function itemEffect(id: string): Effect {
  const info = itemInfo(id);
  if (info.tier === 'C') return { majors: info.majors };
  const a = ADV_BY_ID[id.slice(2)];
  const k = info.tier === 'L' ? 3 : 1;
  const e = HOOK_SCALED.has(a.id) ? a.effect(k) : scaleEffect(a.effect(1), k);
  return { ...e, majors: info.majors };
}

export function combine(x: string, y: string): string | null {
  if (x[0] === 'C' && y[0] === 'C') {
    const ma = x.slice(2), mb = y.slice(2);
    const order = ['vit', 'pow', 'mnd', 'def', 'agi'];
    const [p, q] = order.indexOf(ma) <= order.indexOf(mb) ? [ma, mb] : [mb, ma];
    return `A_${p}_${q}`;
  }
  if (x[0] === 'A' && x === y) return `L_${x.slice(2)}`;
  return null;
}

export const ALL_ADVANCED = ADV.map((a) => `A_${a.id}`);
export const ALL_COMPONENTS = COMPONENTS.map((c) => c.id);
