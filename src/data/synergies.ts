import type { Battle, CUnit } from '../engine/combat';
import type { AugDef, Effect, EffectCtx } from '../engine/effects';
import { amp, applyLive, inc, red, vuln } from '../engine/effects';
import { FACTIONS, type RunState, type SynergyId } from '../types';
import { ALL_ADVANCED, ALL_COMPONENTS, itemEffect, itemInfo } from './items';
import { blinkTo, isDebuffed, pct, poison, skillHit } from './kit';
import { UNIT_BY_ID } from './units';

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
export const rankTitle = (rank: number) => (rank >= 20 ? 6 : rank >= 15 ? 5 : rank >= 10 ? 4 : rank >= 7 ? 3 : rank >= 4 ? 2 : 1);

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
    desc: '제국 기물은 공명 등급에 따라 작위(기사→남작→백작→공작, 15등급 대공, 20등급 황족)를 받고, 작위만큼 강해집니다. 백작 이상은 치명타 피해 +25%p, (4) 이상에서 공작은 전투 시작 시 모든 아군에게 보호막을 하사합니다.',
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

  // ─────────────── 확장 특성
  {
    id: 'STAFF', name: '참모단', kind: 'trait', tiers: [2, 4, 6], color: '#c9b37a', icon: '✎',
    desc: '참모단이 아닌 아군 하나를 지원 대상으로 지정해 몰아서 강화합니다 (기물 정보 창에서 지정, 미지정 시 공명 등급이 가장 높은 기물). 참모단 기물은 쿨다운 감소 속도 +15%.',
    tierDesc: ['대상 모든 메이저 +3, 피해 +20%', '대상 모든 메이저 +6, 피해 +40%, 쿨다운 감소 +20%', '대상 모든 메이저 +10, 피해 +70%, 쿨다운 감소 +40%, 받는 피해 -15%'],
    member: () => ({ stats: { cdr: 0.15 } }),
    team: (t, ctx) => {
      if (!ctx.run || !ctx.unit || staffTargetUid(ctx.run) !== ctx.unit.uid) return null;
      const m = T(t, [3, 6, 10]);
      return {
        majors: { vit: m, pow: m, mnd: m, def: m, agi: m },
        mods: [inc('all', T(t, [0.2, 0.4, 0.7]))],
        stats: { cdr: T(t, [0, 0.2, 0.4]) },
        taken: t >= 3 ? [red('all', 0.15)] : [],
        setup: (u) => { u.mem.staffed = 1; },
      };
    },
    augs: [
      saug('STAFF', 'brief', '작전 브리핑', '전투 시작 시 지원 대상의 기술 쿨다운이 즉시 준비된다.', {
        hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) if (a.mem.staffed) a.cd = 0.5; } },
      }),
      saug('STAFF', 'escort', '호위 명령', '지원 대상의 체력이 처음 50% 이하가 되면 이 기물 최대 체력 50%만큼 보호막을 준다.', {
        hooks: {
          onTick(b, u) {
            if (u.mem.escort) return;
            const t = b.alliesOf(u).find((a) => a.mem.staffed);
            if (t && b.hpPct(t) <= 0.5) { u.mem.escort = 1; b.shield(t, b.S(u, 'maxHp') * 0.5); }
          },
        },
      }),
      saug('STAFF', 'self', '현장 지휘', '이 기물 피해 +20%, 모든 메이저 +3.', { mods: [inc('all', 0.2)], majors: { vit: 3, pow: 3, mnd: 3, def: 3, agi: 3 } }),
      saug('STAFF', 'focus', '집중 화력 지시', '지원 대상이 공격한 적은 3초간 받는 피해 +15%.', {
        hooks: {
          onStart(b, u) {
            const t = b.alliesOf(u).find((a) => a.mem.staffed);
            if (t) t.hooks.push({ onDeal(bb, self, tgt, _r, o) { if (o.tag !== 'dot' && tgt.alive) bb.applyStatus(self, tgt, { type: 'buff', key: 'staff.focus', dur: 3, taken: [vuln('all', 0.15)], label: '집중 표적' }); } });
          },
        },
      }),
    ],
  },
  {
    id: 'BUDDY', name: '최고의 친구', kind: 'trait', tiers: [2, 4, 6], color: '#f08fb0', icon: '♥',
    desc: '최고의 친구 기물은 전투 시작 시 단짝 소환물을 부릅니다. 소환물은 칸을 차지하고 공명도가 없으며, 주인 스탯의 일부를 물려받습니다 (기본 35%). 주인이 쓰러지면 함께 사라집니다.',
    tierDesc: ['소환물 스탯 상속 50%', '소환물 스탯 상속 70%', '소환물 스탯 상속 95%, 소환물 피해 +30%'],
    member: (t) => ({ setup: (u) => { u.mem.bond = Math.max(u.mem.bond || 0, T(t, [0.5, 0.7, 0.95])); if (t >= 3) u.mem.bondAmp = 0.3; } }),
    augs: [
      saug('BUDDY', 'loyal', '충직함', '소환물이 쓰러지면 전투 동안 이 기물 피해 +30%.', {
        hooks: { onAllyDeath(b, u, dead) { if (dead.owner === u) b.buff(u, u, `buddy.loyal${dead.id}`, 999, { mods: [inc('all', 0.3)], label: '분노' }); } },
      }),
      saug('BUDDY', 'pack', '무리 사냥', '소환물과 같은 대상을 공격하면 피해 +25%.', {
        hooks: { dmgMult: (b, u, t) => (b.units.some((s) => s.owner === u && s.alive && s.target === t) ? 1.25 : 1) },
      }),
      saug('BUDDY', 'big', '든든한 덩치', '소환물 상속률 +25%p, 소환물 방어도 +300.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.25; u.mem.summonArmor = 300; } }),
      saug('BUDDY', 'treat', '간식 주머니', '소환물이 5초마다 주인 기술 위력 60%만큼 회복한다.', { setup: (u) => { u.mem.summonTreat = 0.6; } }),
    ],
  },
  {
    id: 'NATURE', name: '자연주의자', kind: 'trait', tiers: [2, 4, 6], color: '#8fc56a', icon: '❀',
    desc: '전장에서 쓸 만한 장비를 주워 씁니다. 매 전투 시작 시 이 전투에서만 유지되는 무작위 고급 장비를 받습니다 (장비 칸을 차지하지 않음).',
    tierDesc: ['임시 고급 장비 1개', '임시 고급 장비 2개', '임시 고급 장비 2개, 그중 1개는 전설'],
    member: (t) => ({
      setup: (u, b, ctx) => {
        const n = T(t, [1, 2, 2]) + (u.mem.natureExtra || 0);
        const names: string[] = [];
        for (let i = 0; i < n; i++) {
          let id = b.rng.pick(ALL_ADVANCED);
          if (t >= 3 && i === 0) id = 'L_' + id.slice(2);
          applyLive(u, itemEffect(id), b, ctx);
          names.push(itemInfo(id).name);
        }
        u.mem.gifts = n;
        u.hooks.push({ onStart(bb, self) { bb.emit({ k: 'status', id: self.id, name: names.join(' · ') }); } });
      },
    }),
    augs: [
      saug('NATURE', 'forage', '채집 본능', '자연주의자 임시 장비 +1개.', { setup: (u) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + 1; } }),
      saug('NATURE', 'symbiosis', '공생', '임시 장비 1개당 피해 +8%, 전투 시작 시 최대 체력 6% 보호막.', {
        hooks: {
          onStart(b, u) {
            const g = u.mem.gifts || 0;
            if (!g) return;
            b.buff(u, u, 'nature.sym', 999, { mods: [inc('all', 0.08 * g)], label: '공생' });
            b.shield(u, b.S(u, 'maxHp') * 0.06 * g);
          },
        },
      }),
      saug('NATURE', 'bloom', '만개', '전투 15초 후 무작위 임시 고급 장비 하나를 더 얻는다.', {
        hooks: {
          onTick(b, u) {
            if (u.mem.bloomed || b.t < 15) return;
            u.mem.bloomed = 1;
            const id = b.rng.pick(ALL_ADVANCED);
            applyLive(u, itemEffect(id), b, { run: null, unit: null, counts: {}, phase: b.ctx.phase, credits: b.ctx.credits });
            b.emit({ k: 'status', id: u.id, name: '만개: ' + itemInfo(id).name });
          },
        },
      }),
      saug('NATURE', 'recycle', '재활용', '전투 승리 시 25% 확률로 무작위 장비 재료 1개를 얻는다.', {}, {
        after: (run, _u, won) => { if (won && Math.random() < 0.25 && run.inventory.length < 12) run.inventory.push(ALL_COMPONENTS[Math.floor(Math.random() * ALL_COMPONENTS.length)]); },
      }),
    ],
  },
  {
    id: 'CLERIC', name: '성직자', kind: 'trait', tiers: [2, 4, 6], color: '#ffd866', icon: '✟',
    desc: '신앙을 쌓아 신성 피해를 키웁니다. 성직자가 활성화된 채 페이즈를 시작하면 순례 노드가 추가되어 신앙과 축복을 얻습니다. 전투에서 이기면 신앙 +단계.',
    tierDesc: ['성직자 신성 피해 +신앙×3%', '성직자 신성 피해 +신앙×5%, 모든 아군 피해 +신앙×1%', '성직자 신성 피해 +신앙×8%, 모든 아군 피해 +신앙×1.5%'],
    member: (t, ctx) => ({ mods: [inc('holy', faithOf(ctx) * T(t, [0.03, 0.05, 0.08]))] }),
    team: (t, ctx) => (t >= 2 ? { mods: [inc('all', faithOf(ctx) * T(t, [0, 0.01, 0.015]))] } : null),
    augs: [
      saug('CLERIC', 'devotion', '독실함', '전투 승리 시 신앙 +1 추가.', {}, { after: (run, _u, won) => { if (won) run.faith += 1; } }),
      saug('CLERIC', 'halo', '후광', '전투 시작 시 주변 1칸 아군에게 최대 체력 (신앙×1.5)% 보호막 (최대 45%).', {
        setup: (u, _b, ctx) => { u.mem.halo = Math.min(0.45, faithOf(ctx) * 0.015); },
        hooks: { onStart(b, u) { for (const a of b.around(u, 1, b.alliesOf(u))) b.shield(a, b.S(a, 'maxHp') * (u.mem.halo || 0)); } },
      }),
      saug('CLERIC', 'smite', '징벌', '기본 공격 시 기술 위력 35% 신성 추가 피해.', {
        hooks: { onBasic(b, u, t, r) { if (!r.miss && t.alive) skillHit(b, u, t, 'tech', 0.35, 'holy', { tag: 'proc', noMiss: true }); } },
      }),
      saug('CLERIC', 'litany', '연도', '기술을 쓸 때마다 모든 아군을 기술 위력 40%만큼 회복.', {
        hooks: { onSkill(b, u) { for (const a of b.alliesOf(u)) b.heal(u, a, b.S(u, 'tech') * 0.4); } },
      }),
    ],
  },
  {
    id: 'STAR', name: '은하 대스타', kind: 'trait', tiers: [2, 4, 6], color: '#ff9de2', icon: '✪',
    desc: '전투와 노드 진행으로 명성을 쌓습니다. 대스타가 활성화되어 있으면 보스 직전에 속보 노드가 추가되어, 명성을 원하는 보상으로 바꿀 수 있습니다. 대스타 기물은 명성만큼 강해집니다.',
    tierDesc: ['명성 획득 ×1, 대스타 피해 +명성×0.5%', '명성 획득 ×2, 대스타 피해 +명성×1%', '명성 획득 ×3, 대스타 피해 +명성×1.5%, 모든 아군 피해 +명성×0.4%'],
    member: (t, ctx) => ({ mods: [inc('all', Math.min(0.9, fameOf(ctx) * T(t, [0.005, 0.01, 0.015])))] }),
    team: (t, ctx) => (t >= 3 ? { mods: [inc('all', Math.min(0.3, fameOf(ctx) * 0.004))] } : null),
    augs: [
      saug('STAR', 'encore', '앙코르', '기술을 쓰면 30% 확률로 쿨다운이 즉시 초기화된다.', {
        hooks: { onSkill(b, u) { if (b.rng.chance(0.3)) { u.cd = 0.3; b.emit({ k: 'status', id: u.id, name: '앙코르!' }); } } },
      }),
      saug('STAR', 'paparazzi', '파파라치', '이 기물이 처치한 적 2명당 명성 +1.', {}, { after: (run, _u, _w, kills) => { run.fame += Math.floor(kills / 2); } }),
      saug('STAR', 'charisma', '카리스마', '전투 시작 시 주변 1칸 아군의 피해 +12% (전투 동안).', {
        hooks: { onStart(b, u) { for (const a of b.around(u, 1, b.alliesOf(u, false))) b.buff(u, a, `star.cha.${u.id}`, 999, { mods: [inc('all', 0.12)], label: '카리스마' }); } },
      }),
      saug('STAR', 'stage', '무대 체질', '체력 50% 이상일 때 피해 +25%.', { hooks: { dmgMult: (b, u) => (b.hpPct(u) >= 0.5 ? 1.25 : 1) } }),
    ],
  },
  {
    id: 'INFIL', name: '침투자', kind: 'trait', tiers: [2, 4, 6], color: '#9a8cff', icon: '☾',
    desc: '전투가 시작되면 적 후방으로 순간이동해 기습합니다. 회피와 치명타 확률이 오르고, 착지 직후 잠시 피해가 크게 증가합니다.',
    tierDesc: ['회피 +15%p, 치명타 +15%p, 기습 3초 피해 +30%', '회피 +25%p, 치명타 +25%p, 기습 피해 +60%', '회피 +40%p, 치명타 +40%p, 기습 피해 +100%'],
    member: (t) => {
      const ambush = T(t, [0.3, 0.6, 1.0]);
      return {
        stats: { eva: T(t, [0.15, 0.25, 0.4]), crit: T(t, [0.15, 0.25, 0.4]) },
        hooks: {
          onStart(b, u) {
            const foes = b.enemiesOf(u);
            if (!foes.length) return;
            // 적 진영 가장 안쪽(아군에서 먼 쪽)의 적을 노린다
            const back = foes.slice().sort((a, c) => (u.side === 0 ? a.y - c.y : c.y - a.y))[0];
            if (blinkTo(b, u, back)) b.buff(u, u, 'infil.ambush', 3, { mods: [inc('all', ambush)], label: '기습' });
          },
        },
      };
    },
    augs: [
      saug('INFIL', 'shadow', '그림자 걸음', '적을 처치하면 다음 후방 적에게 순간이동하고 기습 효과를 다시 얻는다.', {
        hooks: {
          onKill(b, u) {
            const foes = b.enemiesOf(u);
            if (!foes.length) return;
            const back = foes.slice().sort((a, c) => a.y - c.y)[0];
            if (blinkTo(b, u, back)) b.buff(u, u, 'infil.ambush', 3, { mods: [inc('all', 0.5)], label: '기습' });
          },
        },
      }),
      saug('INFIL', 'blade', '독날', '기본 공격이 3초간 초당 타격 위력 30% 중독을 건다.', {
        hooks: { onBasic(b, u, t, r) { if (!r.miss && t.alive) poison(b, u, t, b.S(u, 'strike') * 0.3, 3, 0.8); } },
      }),
      saug('INFIL', 'smoke', '연막', '체력이 처음 40% 이하가 되면 4초간 회피 +50%p.', {
        hooks: { onHurt(b, u) { if (!u.mem.smoke && b.hpPct(u) <= 0.4) { u.mem.smoke = 1; b.buff(u, u, 'infil.smoke', 4, { delta: { eva: 0.5 }, label: '연막' }); } } },
      }),
      saug('INFIL', 'backstab', '배후 습격', '체력 70% 이상인 적에게 주는 피해 +35%.', { hooks: { dmgMult: (b, _u, t) => (b.hpPct(t) >= 0.7 ? 1.35 : 1) } }),
    ],
  },
  // ─────────────── 확장 세력
  {
    id: 'SIR', name: '시리우스 성도회', kind: 'faction', tiers: [2, 4, 6], color: '#e8e2c8', icon: '✧',
    desc: '시리우스를 섬기는 무장 교단. 성도회 기물은 신성 피해가 강하고 단단하며, 단계가 오르면 쓰러진 아군을 되살리는 기적을 일으킵니다.',
    tierDesc: ['성도회 신성 피해 +25%, 받는 피해 -10%', '+ 전투당 1회, 처음 쓰러지는 아군 부활 (체력 30%)', '성도회 신성 피해 +60%, 부활 2회 (체력 50%)'],
    member: (t) => ({ mods: [inc('holy', T(t, [0.25, 0.25, 0.6]))], taken: [red('all', 0.1)] }),
    team: (t) => (t >= 2 ? {
      hooks: {
        onLethal(b, u) {
          if (u.isSummon || (b.mem.sirRevive || 0) >= T(t, [0, 1, 2])) return false;
          b.mem.sirRevive = (b.mem.sirRevive || 0) + 1;
          u.hp = b.S(u, 'maxHp') * T(t, [0, 0.3, 0.5]);
          u.statuses = u.statuses.filter((s) => s.type === 'buff');
          b.emit({ k: 'status', id: u.id, name: '부활의 기적' });
          b.fx(u.x, u.y, 0, 'holy');
          return true;
        },
      },
    } : null),
    augs: [
      saug('SIR', 'relic', '성유물', '받는 피해 -12%, 효과 저항 +25%p.', { taken: [red('all', 0.12)], stats: { effRes: 0.25 } }),
      saug('SIR', 'vow', '순례의 서약', '신앙 1당 최대 체력 +1.5% (최대 60%).', { setup: (u, _b, ctx) => { u.st.maxHp *= 1 + Math.min(0.6, faithOf(ctx) * 0.015); } }),
      saug('SIR', 'martyr', '순교', '이 기물이 쓰러지면 모든 아군을 기술 위력 150% 회복하고, 주변 1칸 적에게 기술 위력 150% 신성 피해.', {
        hooks: {
          onLethal(b, u) {
            if (u.mem.martyr) return false;
            u.mem.martyr = 1;
            b.fx(u.x, u.y, 1, 'holy');
            for (const a of b.alliesOf(u, false)) b.heal(u, a, b.S(u, 'tech') * 1.5);
            for (const e of b.around(u, 1, b.enemiesOf(u))) skillHit(b, u, e, 'tech', 1.5, 'holy', { tag: 'proc', noMiss: true });
            return false;
          },
        },
      }),
      saug('SIR', 'hymn', '찬송', '신성 피해를 준 적은 4초간 받는 신성 피해 +20%.', {
        hooks: { onDeal(b, u, t, _r, o) { if (o.elem === 'holy' && t.alive) b.applyStatus(u, t, { type: 'buff', key: 'sir.hymn', dur: 4, taken: [vuln('holy', 0.2)], label: '' }); } },
      }),
    ],
  },
  {
    id: 'PAN', name: '범은하 공동체', kind: 'faction', tiers: [2, 4, 6], color: '#5fd3c0', icon: '◍',
    desc: '온갖 종족이 섞인 자유 공동체. 출전한 서로 다른 세력 수만큼 모든 아군이 강해지고, 4단계부터는 가장 큰 다른 세력에 손을 보태 그 세력의 인원 수를 늘려 줍니다.',
    tierDesc: ['세력 1개당 모든 아군 피해 +3%, 받는 피해 -2%', '세력 1개당 피해 +6%, 받는 피해 -4%, 가장 큰 다른 세력 인원 +1', '세력 1개당 피해 +9%, 받는 피해 -6%, 다른 세력 인원 +2, 모든 아군 메이저 +2'],
    team: (t, ctx) => {
      const f = FACTIONS.filter((x) => (ctx.counts[x] || 0) > 0).length;
      const m = T(t, [1, 2, 3]);
      return {
        mods: [inc('all', 0.03 * m * f)], taken: [red('all', 0.02 * m * f)],
        majors: t >= 3 ? { vit: 2, pow: 2, mnd: 2, def: 2, agi: 2 } : undefined,
      };
    },
    augs: [
      saug('PAN', 'multi', '다문화 감수성', '출전한 세력 1개당 이 기물 모든 메이저 +1.', {
        setup: (u, b, ctx) => {
          const f = FACTIONS.filter((x) => (ctx.counts[x] || 0) > 0).length;
          applyLive(u, { majors: { vit: f, pow: f, mnd: f, def: f, agi: f } }, b, ctx);
        },
      }),
      saug('PAN', 'potluck', '포틀럭 파티', '전투 시작 시 모든 아군에게 최대 체력 (세력 수×4)% 보호막.', {
        setup: (u, _b, ctx) => { u.mem.potluck = FACTIONS.filter((x) => (ctx.counts[x] || 0) > 0).length * 0.04; },
        hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.shield(a, b.S(a, 'maxHp') * (u.mem.potluck || 0)); } },
      }),
      saug('PAN', 'translator', '만능 통역기', '효과 명중 +25%p, 효과 저항 +25%p.', { stats: { effHit: 0.25, effRes: 0.25 } }),
      saug('PAN', 'refuge', '피난처', '다른 아군이 쓰러질 때마다 방어도 +200, 피해 +8% (중첩).', {
        hooks: { onAllyDeath(b, u, d) { if (d === u) return; u.mem.refuge = (u.mem.refuge || 0) + 1; b.buff(u, u, `pan.refuge${u.mem.refuge}`, 999, { delta: { armor: 200 }, mods: [inc('all', 0.08)], label: '피난처' }); } },
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

const faithOf = (ctx: EffectCtx) => Math.min(40, ctx.run?.faith || 0);
const fameOf = (ctx: EffectCtx) => ctx.run?.fame || 0;

/** 참모단 지원 대상: 지정한 기물이 출전 중이면 그 기물, 아니면 공명 등급이 가장 높은 비참모단 기물 */
export function staffTargetUid(run: RunState): string | null {
  const dep = run.units.filter((u) => u.pos && !UNIT_BY_ID[u.defId].traits.includes('STAFF'));
  if (dep.some((u) => u.uid === run.staffTarget)) return run.staffTarget;
  return dep.slice().sort((a, b) => b.rank - a.rank)[0]?.uid ?? null;
}
export type { Battle, CUnit };
