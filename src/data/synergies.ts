import type { AugDef, Effect, EffectCtx } from '../engine/effects';
import { amp, inc, red, vuln } from '../engine/effects';
import type { SynergyId } from '../types';
import { isDebuffed, pct, skillHit } from './kit';

export interface SynDef {
  id: SynergyId;
  name: string;
  kind: 'trait' | 'faction';
  tiers: number[];
  color: string;
  icon: string;
  desc: string;
  tierDesc: string[];
  /** 소속 기물에게 */
  member?: (tier: number, ctx: EffectCtx) => Effect | null;
  /** 모든 출전 아군에게 */
  team?: (tier: number, ctx: EffectCtx) => Effect | null;
  augs: AugDef[];
}

export const TITLE_NAME = ['평민', '기사', '남작', '백작', '공작', '대공', '황족'];
export const rankTitle = (rank: number) => (rank >= 10 ? 4 : rank >= 7 ? 3 : rank >= 4 ? 2 : 1);

function saug(owner: SynergyId, id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef {
  return { id: `${owner}.${id}`, name, desc, pool: 'syn', owner, effect: () => effect, ...extra };
}
const T = (tier: number, a: number[]) => a[Math.max(0, tier - 1)];

export const SYNERGIES: SynDef[] = [
  // ─────────────── 특성
  {
    id: 'MARK', name: '명사수', kind: 'trait', tiers: [2, 4, 6], color: '#e8b04a', icon: '◎',
    desc: '명사수 기물의 치명타 확률과 치명타 피해가 증가합니다. (치명타는 물리 피해에만 적용)',
    tierDesc: ['치명타 확률 +10%p, 치명타 피해 +15%p', '치명타 확률 +20%p, 치명타 피해 +35%p', '치명타 확률 +35%p, 치명타 피해 +60%p'],
    member: (t) => ({ stats: { crit: T(t, [0.1, 0.2, 0.35]), critDmg: T(t, [0.15, 0.35, 0.6]) } }),
    augs: [
      saug('MARK', 'weak', '약점 간파', '치명타 적중 시 대상 방어도 4초간 -20% (부식).', {
        hooks: { onDeal(b, u, t, r) { if (r.crit && t.alive) b.applyStatus(u, t, { type: 'buff', key: 'corrode', dur: 4, armorMul: 0.8 }); } },
      }),
      saug('MARK', 'head', '헤드샷', '치명타 피해 +45%p.', { stats: { critDmg: 0.45 } }),
      saug('MARK', 'rapid', '속사', '공격 속도 +25%.', { stats: { atkSpd: 0.25 } }),
      saug('MARK', 'angle', '저격 각도', '사거리 +1. 3칸 이상 떨어진 적에게 주는 피해 +20%.', {
        stats: { range: 1 }, hooks: { dmgMult: (b, u, t) => (b.dist(u, t) >= 3 ? 1.2 : 1) },
      }),
    ],
  },
  {
    id: 'VAN', name: '돌격가', kind: 'trait', tiers: [2, 4, 6], color: '#d0603a', icon: '⛨',
    desc: '돌격가 기물의 타격 위력과 방어도가 증가합니다.',
    tierDesc: ['타격 위력 +15%, 방어도 +150', '타격 위력 +30%, 방어도 +300', '타격 위력 +50%, 방어도 +600'],
    member: (t) => ({ pct: { strike: T(t, [0.15, 0.3, 0.5]) }, stats: { armor: T(t, [150, 300, 600]) } }),
    augs: [
      saug('VAN', 'wall', '철벽', '방어도 +300, 효과 저항 +20%p.', { stats: { armor: 300, effRes: 0.2 } }),
      saug('VAN', 'charge', '돌진 충격', '전투 첫 기본 공격이 대상을 1.5초 기절시킨다.', {
        hooks: { onBasic(b, u, t) { if (!u.mem.charged) { u.mem.charged = 1; b.stun(u, t, 1.5); } } },
      }),
      saug('VAN', 'counter', '반격 태세', '피격 시 20% 확률로 타격 위력 80% 반격.', {
        hooks: {
          onHurt(b, u, src, _r, o) {
            if (o.tag !== 'proc' && src.alive && b.rng.chance(0.2)) skillHit(b, u, src, 'strike', 0.8, 'phys', { tag: 'proc', noMiss: true });
          },
        },
      }),
      saug('VAN', 'unyield', '불굴', '체력이 처음 30% 이하가 되면 최대 체력 35% 보호막.', {
        hooks: {
          onHurt(b, u) { if (!u.mem.unyield && b.hpPct(u) <= 0.3) { u.mem.unyield = 1; b.shield(u, b.S(u, 'maxHp') * 0.35); } },
        },
      }),
    ],
  },
  {
    id: 'SPEC', name: '전문가', kind: 'trait', tiers: [2, 4, 6], color: '#5aa0ff', icon: '✦',
    desc: '전문가 기물의 기술 위력과 쿨다운 감소 속도가 증가합니다.',
    tierDesc: ['기술 위력 +20%, 쿨다운 감소 속도 +15%', '기술 위력 +40%, 쿨다운 감소 속도 +30%', '기술 위력 +70%, 쿨다운 감소 속도 +50%'],
    member: (t) => ({ pct: { tech: T(t, [0.2, 0.4, 0.7]) }, stats: { cdr: T(t, [0.15, 0.3, 0.5]) } }),
    augs: [
      saug('SPEC', 'overcharge', '과충전', '기술 위력 +25%.', { pct: { tech: 0.25 } }),
      saug('SPEC', 'accel', '연산 가속', '쿨다운 감소 속도 +25%.', { stats: { cdr: 0.25 } }),
      saug('SPEC', 'echo', '잔향', '기술 사용 후 3초간 기본 공격 피해 +40%.', {
        hooks: { onSkill(b, u) { b.buff(u, u, 'spec.echo', 3, { mods: [inc('basic', 0.4)], label: '잔향' }); } },
      }),
      saug('SPEC', 'preempt', '선제 기동', '전투 시작 시 쿨다운이 70% 진행된 상태로 시작한다.', {
        hooks: { onStart(_b, u) { u.cd = u.cdMax * 0.3; } },
      }),
    ],
  },
  {
    id: 'MED', name: '의무관', kind: 'trait', tiers: [2, 4, 6], color: '#5ad08a', icon: '✚',
    desc: '모든 아군의 회복 효율이 증가하고, 의무관은 4초마다 체력 비율이 가장 낮은 아군을 치료합니다.',
    tierDesc: ['회복 효율 +15%, 치료 = 기술 위력 60%', '회복 효율 +30%, 치료 = 기술 위력 100%', '회복 효율 +50%, 치료 = 기술 위력 160%'],
    team: (t) => ({ stats: { healEff: T(t, [0.15, 0.3, 0.5]) } }),
    member: (t) => {
      const k = T(t, [0.6, 1.0, 1.6]);
      return {
        hooks: {
          onTick(b, u, dt) {
            u.mem.medT = (u.mem.medT || 0) + dt;
            if (u.mem.medT >= 4) {
              u.mem.medT = 0;
              const l = b.lowestHpAlly(u);
              if (l && b.hpPct(l) < 1) b.heal(u, l, b.S(u, 'tech') * k);
            }
          },
        },
      };
    },
    augs: [
      saug('MED', 'kit', '응급 처치 키트', '받는 회복 +25%, 최대 체력 +10%.', { stats: { healEff: 0.25 }, pct: { maxHp: 0.1 } }),
      saug('MED', 'regen', '재생 나노봇', '초당 최대 체력의 1.5% 회복.', {
        hooks: { onTick(b, u, dt) { u.mem.regen = (u.mem.regen || 0) + dt; if (u.mem.regen >= 1) { u.mem.regen = 0; b.heal(u, u, b.S(u, 'maxHp') * 0.015); } } },
      }),
      saug('MED', 'protect', '보호 프로토콜', '이 기물이 준 초과 회복량의 60%를 보호막으로 전환.', {
        hooks: { onHealDone(b, _u, t, _a, over) { if (over > 0) b.shield(t, over * 0.6); } },
      }),
      saug('MED', 'triage', '트리아지', '체력 40% 이하 아군을 치료할 때 회복량 +60%.', {
        hooks: { healMult: (b, _u, t) => (b.hpPct(t) <= 0.4 ? 1.6 : 1) },
      }),
    ],
  },
  // ─────────────── 세력
  {
    id: 'UNI', name: '성간 인류 연합', kind: 'faction', tiers: [2, 4, 6], color: '#3b6fd8', icon: '★',
    desc: '꾸준한 공명도 상승과 안정적인 전투력 증대. 전투가 끝날 때마다 연합 기물이 추가 공명도를 얻습니다.',
    tierDesc: ['모든 메이저 +1, 전투 후 공명도 +1', '모든 메이저 +3, 전투 후 공명도 +2', '모든 메이저 +5, 전투 후 공명도 +3, 피해 +15%'],
    member: (t) => {
      const m = T(t, [1, 3, 5]);
      return { majors: { vit: m, pow: m, mnd: m, def: m, agi: m }, mods: t >= 3 ? [inc('all', 0.15)] : [] };
    },
    augs: [
      saug('UNI', 'doctrine', '표준 교리', '모든 메이저 스탯 +2.', { majors: { vit: 2, pow: 2, mnd: 2, def: 2, agi: 2 } }, { stack: true }),
      saug('UNI', 'priority', '보급 우선권', '전투가 끝날 때마다 이 기물 공명도 +2.', {}, {
        after: (_run, u) => { u.xp += 2; },
      }),
      saug('UNI', 'flag', '연합의 깃발', '전투 시작 시 주변 1칸 아군의 피해 +12% (전투 동안).', {
        hooks: {
          onStart(b, u) { for (const a of b.around(u, 1, b.alliesOf(u))) b.buff(u, a, `uni.flag.${u.id}`, 999, { mods: [inc('all', 0.12)], label: '연합의 깃발' }); },
        },
      }),
      saug('UNI', 'veteran', '베테랑', '공명 등급 1당 피해 +3%.', {
        setup: (u, _b, ctx) => { u.mods.push(inc('all', 0.03 * (ctx.unit?.rank || 1))); },
      }),
    ],
  },
  {
    id: 'KAL', name: '칼리토 제국', kind: 'faction', tiers: [2, 4, 6], color: '#c0303a', icon: '♛',
    desc: '제국 기물은 공명 등급에 따라 작위(기사→남작→백작→공작)를 받고, 작위만큼 강해집니다. 백작 이상은 치명타 피해 +25%p, (4) 이상에서 공작은 전투 시작 시 모든 아군에게 보호막을 하사합니다.',
    tierDesc: ['작위 1당 피해 +4%, 방어도 +40', '작위 1당 피해 +8%, 방어도 +80, 공작의 위엄 해금', '작위 1당 피해 +12%, 방어도 +120'],
    member: (t) => ({
      setup: (u, b) => {
        const title = u.mem.title || 1;
        u.mods.push(inc('all', T(t, [0.04, 0.08, 0.12]) * title));
        u.st.armor += T(t, [40, 80, 120]) * title;
        if (title >= 3) u.st.critDmg += 0.25;
        if (title >= 4 && t >= 2) u.hooks.push({
          onStart(bb, self) { for (const a of bb.alliesOf(self)) bb.shield(a, bb.S(a, 'maxHp') * 0.1); },
        });
        void b;
      },
    }),
    augs: [
      saug('KAL', 'heir', '작위 승계', '작위 +1.', { title: 1 }),
      saug('KAL', 'duty', '귀족의 의무', '아군이 쓰러질 때마다 피해 +12% (중첩).', {
        hooks: { onAllyDeath(b, u) { u.mem.duty = (u.mem.duty || 0) + 1; b.buff(u, u, `kal.duty${u.mem.duty}`, 999, { mods: [inc('all', 0.12)], label: '귀족의 의무' }); } },
      }),
      saug('KAL', 'guard', '제국 근위대', '방어도 +200, 최대 체력 +250.', { stats: { armor: 200, maxHp: 250 } }),
      saug('KAL', 'edict', '처형 칙령', '체력 25% 이하인 적에게 주는 피해 +40%.', {
        hooks: { dmgMult: (b, _u, t) => (b.hpPct(t) <= 0.25 ? 1.4 : 1) },
      }),
    ],
  },
  {
    id: 'HEL', name: '헬레니우스 동맹', kind: 'faction', tiers: [2, 4, 6], color: '#2fa39a', icon: '⚑',
    desc: '시너지 단계에 따라 매 페이즈 퀘스트가 주어지고, 완료하면 보상을 받습니다. 동맹 기물은 효과 명중이 증가합니다.',
    tierDesc: ['효과 명중 +15%p, 페이즈마다 퀘스트 1개', '효과 명중 +30%p, 퀘스트 2개, 보상 1.5배', '효과 명중 +30%p, 퀘스트 3개, 보상 2배, 완료 시 동맹 기물 영구 메이저 +2'],
    member: (t) => ({ stats: { effHit: T(t, [0.15, 0.3, 0.3]) } }),
    augs: [
      saug('HEL', 'pact', '동맹의 맹약', '효과 명중 +25%p, 이 기물이 거는 상태이상 지속 +30%.', {
        stats: { effHit: 0.25 }, setup: (u) => { u.mem.statusDur = (u.mem.statusDur || 0) + 0.3; },
      }),
      saug('HEL', 'intel', '정보 공유', '헬레니우스 퀘스트를 완료할 때마다 이 기물의 모든 메이저 +1 (영구).', {}),
      saug('HEL', 'immunity', '외교 면책', '효과 저항 +40%p, 받는 피해 -8%.', { stats: { effRes: 0.4 }, taken: [red('all', 0.08)] }),
      saug('HEL', 'pincer', '협공', '상태이상에 걸린 적에게 주는 피해 +25%.', {
        hooks: { dmgMult: (_b, _u, t) => (isDebuffed(t) ? 1.25 : 1) },
      }),
    ],
  },
  {
    id: 'PET', name: '주식회사 페트라', kind: 'faction', tiers: [2, 4, 6], color: '#e07a1f', icon: '¤',
    desc: '에너지 크레딧 스노우볼. 이자 상한 증가, 보험, 대출, 그리고 보유 크레딧에 비례한 전투력.',
    tierDesc: ['이자 상한 +3, 전투 승리 시 크레딧 +1', '보험(패배 시 크레딧 +6, 체력 피해 -50%), 대출 해금', `이자 상한 +6, 페트라 기물 피해 증폭 = 크레딧 10당 +5% (최대 50%)`],
    member: (t, ctx) => (t >= 3 ? { mods: [amp('all', Math.min(0.5, Math.floor(ctx.credits / 10) * 0.05))] } : null),
    augs: [
      saug('PET', 'bonus', '성과급', '전투 승리 시 크레딧 +2.', {}, { after: (run, _u, won) => { if (won) run.credits += 2; } }),
      saug('PET', 'roi', '투자 수익', '보유 크레딧 10당 피해 +4% (최대 40%).', {
        setup: (u, _b, ctx) => { u.mods.push(inc('all', Math.min(0.4, Math.floor(ctx.credits / 10) * 0.04))); },
      }),
      saug('PET', 'asset', '자산 보호', '받는 피해 -15%.', { taken: [red('all', 0.15)] }),
      saug('PET', 'hostile', '적대적 인수', '공격한 적이 받는 피해 3초간 +10%.', {
        hooks: { onDeal(b, u, t, _r, o) { if (o.tag !== 'dot' && t.alive) b.applyStatus(u, t, { type: 'buff', key: 'pet.hostile', dur: 3, taken: [vuln('all', 0.1)], label: '인수 표적' }); } },
      }),
    ],
  },
];

export const SYN_BY_ID = Object.fromEntries(SYNERGIES.map((s) => [s.id, s])) as Record<SynergyId, SynDef>;

/** 활성 단계 (0 = 비활성, 1 = 첫 단계 …) */
export function tierOf(id: SynergyId, count: number): number {
  const s = SYN_BY_ID[id];
  let t = 0;
  for (const need of s.tiers) if (count >= need) t++;
  return t;
}
export { pct };
