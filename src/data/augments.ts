import type { AugDef, Effect } from '../engine/effects';
import { amp, inc } from '../engine/effects';
import type { SynergyId } from '../types';
import { SYN_BY_ID, SYNERGIES } from './synergies';
import { UNITS } from './units';

function caug(id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef {
  return { id: `C.${id}`, name, desc, pool: 'common', effect: () => effect, ...extra };
}

const FACTIONS: SynergyId[] = ['UNI', 'KAL', 'HEL', 'PET'];
const TRAITS: SynergyId[] = ['MARK', 'VAN', 'SPEC', 'MED'];

export const COMMON_AUGS: AugDef[] = [
  caug('vit', '강화 골격', '생명력 +4.', { majors: { vit: 4 } }, { stack: true }),
  caug('pow', '출력 증강', '전투력 +4.', { majors: { pow: 4 } }, { stack: true }),
  caug('mnd', '신경 가속', '정신력 +4.', { majors: { mnd: 4 } }, { stack: true }),
  caug('def', '장갑 증설', '방어력 +4.', { majors: { def: 4 } }, { stack: true }),
  caug('agi', '추진기 튜닝', '기동력 +4.', { majors: { agi: 4 } }, { stack: true }),
  caug('vamp', '흡혈 나노', '가한 피해의 12%만큼 체력 회복.', { stats: { lifesteal: 0.12 } }),
  caug('blood', '피의 대가', '최대 체력 -20%, 모든 피해 +30% (증폭).', { pct: { maxHp: -0.2 }, mods: [amp('all', 0.3)] }),
  caug('decisive', '결전 병기', '전투 시작 10초 후부터 모든 피해 +50%.', {
    hooks: { dmgMult: (b) => (b.t >= 10 ? 1.5 : 1) },
  }),
  caug('barrier', '긴급 방벽', '전투 시작 시 최대 체력 30% 보호막.', {
    hooks: { onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.3); } },
  }),
  caug('berserk', '광전사 칩', '잃은 체력 1%당 공격 속도 +1.2%.', {
    hooks: {
      onTick(b, u) {
        const lost = 1 - b.hpPct(u);
        const s = u.statuses.find((x) => x.key === 'c.berserk');
        if (s) s.delta = { atkSpd: lost * 1.2 };
        else b.buff(u, u, 'c.berserk', 999, { delta: { atkSpd: lost * 1.2 }, label: '' });
      },
    },
  }),
  {
    id: 'C.dual', name: '이중 소속', pool: 'common',
    desc: '이 기물이 다른 시너지 하나에 추가로 소속된다.',
    roll: (pick) => pick([...FACTIONS, ...TRAITS]),
    descParam: (p) => `이 기물이 [${SYN_BY_ID[p as SynergyId].name}] 시너지에도 소속된다.`,
    effect: (p) => ({ extraSyn: p ? [p as SynergyId] : [] }),
  },
  caug('focus', '단일 목표 프로토콜', '같은 대상을 계속 공격할수록 피해 증가 (공격당 +6%, 최대 +60%).', {
    hooks: {
      onBasic(b, u, t) {
        if (u.mem.focusId !== t.id) { u.mem.focusId = t.id; u.mem.focus = 0; }
        u.mem.focus = Math.min(10, (u.mem.focus || 0) + 1);
        const s = u.statuses.find((x) => x.key === 'c.focus');
        const mods = [inc('all', 0.06 * u.mem.focus)];
        if (s) s.mods = mods; else b.buff(u, u, 'c.focus', 999, { mods, label: '' });
      },
    },
  }),
];

export const ALL_AUGS: AugDef[] = [
  ...UNITS.flatMap((u) => u.augs),
  ...SYNERGIES.flatMap((s) => s.augs),
  ...COMMON_AUGS,
];
export const AUG_BY_ID: Record<string, AugDef> = Object.fromEntries(ALL_AUGS.map((a) => [a.id, a]));

export function augDesc(id: string, param?: string) {
  const a = AUG_BY_ID[id];
  if (!a) return '';
  return param && a.descParam ? a.descParam(param) : a.desc;
}
export function augSource(a: AugDef): string {
  if (a.pool === 'unit') return '전용';
  if (a.pool === 'syn') return SYN_BY_ID[a.owner as SynergyId]?.name || '시너지';
  return '공용';
}
