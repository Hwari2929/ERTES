import type { Battle, CUnit } from '../engine/combat';
import type { Effect, EffectCtx } from '../engine/effects';
import { amp, applyLive, inc, red, vuln } from '../engine/effects';
import { CFG } from '../config';
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
}

export const TITLE_NAME = ['평민', '기사', '남작', '백작', '공작', '대공', '황족'];
export const rankTitle = (rank: number) => (rank >= 20 ? 6 : rank >= 15 ? 5 : rank >= 10 ? 4 : rank >= 7 ? 3 : rank >= 4 ? 2 : 1);

const T = (tier: number, a: number[]) => a[Math.max(0, tier - 1)];

export const SYNERGIES: SynDef[] = [
  // ─────────────── 특성
  {
    id: 'MARK', name: '명사수', kind: 'trait', tiers: [2, 4, 6], color: '#e8b04a', icon: '◎',
    desc: '명사수 기물의 치명타 확률과 치명타 피해가 증가합니다. (치명타는 물리 피해에만 적용)',
    tierDesc: ['치명타 확률 +15%p, 치명타 피해 +25%p', '치명타 확률 +30%p, 치명타 피해 +60%p', '치명타 확률 +50%p, 치명타 피해 +130%p, 치명타가 대상 주변 1칸에 40% 폭발'],
    member: (t) => ({
      stats: { crit: T(t, [0.15, 0.3, 0.5]), critDmg: T(t, [0.25, 0.6, 1.3]) },
      hooks: t >= 3 ? { onDeal(b, u, tg, r, o) { if (!r.crit || o.tag === 'proc' || o.tag === 'dot') return; for (const e of b.around(tg, 1, b.enemiesOf(u))) if (e !== tg) skillHit(b, u, e, 'shoot', 0.4, 'phys', { tag: 'proc', noMiss: true }); } } : undefined,
    }),
  },
  {
    id: 'VAN', name: '돌격가', kind: 'trait', tiers: [2, 4, 6], color: '#d0603a', icon: '⛨',
    desc: '돌격가 기물의 타격 위력과 방어도가 증가합니다.',
    tierDesc: ['타격 위력 +20%, 방어도 +200', '타격 위력 +45%, 방어도 +450', '타격 위력 +90%, 방어도 +900, 전투 시작 시 최대 체력 30% 보호막'],
    member: (t) => ({
      pct: { strike: T(t, [0.2, 0.45, 0.9]) }, stats: { armor: T(t, [200, 450, 900]) },
      hooks: t >= 3 ? { onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.3); } } : undefined,
    }),
  },
  {
    id: 'SPEC', name: '전문가', kind: 'trait', tiers: [2, 4, 6], color: '#5aa0ff', icon: '✦',
    desc: '전문가 기물의 기술 위력과 쿨다운 감소 속도가 증가합니다.',
    tierDesc: ['기술 위력 +25%, 쿨다운 감소 속도 +20%', '기술 위력 +55%, 쿨다운 감소 속도 +40%', '기술 위력 +110%, 쿨다운 감소 속도 +75%, 기술 사용 시 25% 확률로 즉시 재사용'],
    member: (t) => ({
      pct: { tech: T(t, [0.25, 0.55, 1.1]) }, stats: { cdr: T(t, [0.2, 0.4, 0.75]) },
      hooks: t >= 3 ? { onSkill(b, u) { if (b.rng.chance(0.25)) { u.cd = 0.2; b.emit({ k: 'status', id: u.id, name: '연쇄 기술!' }); } } } : undefined,
    }),
  },
  {
    id: 'MED', name: '의무관', kind: 'trait', tiers: [2, 4, 6], color: '#5ad08a', icon: '✚',
    desc: '모든 아군의 회복 효율이 증가하고, 의무관은 4초마다 체력 비율이 가장 낮은 아군을 치료합니다.',
    tierDesc: ['회복 효율 +20%, 치료 = 기술 위력 80%', '회복 효율 +40%, 치료 = 기술 위력 150%', '회복 효율 +75%, 치료 = 기술 위력 260%, 치료 대상에게 초과분까지 보호막'],
    team: (t) => ({ stats: { healEff: T(t, [0.2, 0.4, 0.75]) } }),
    member: (t) => {
      const k = T(t, [0.8, 1.5, 2.6]);
      return {
        hooks: {
          onTick(b, u, dt) {
            u.mem.medT = (u.mem.medT || 0) + dt;
            if (u.mem.medT >= 4) {
              u.mem.medT = 0;
              const l = b.lowestHpAlly(u);
              if (l && b.hpPct(l) < 1) { const v = b.S(u, 'tech') * k; const miss = b.S(l, 'maxHp') - l.hp; b.heal(u, l, v); if (t >= 3 && v > miss) b.shield(l, v - miss); }
            }
          },
        },
      };
    },
  },
  // ─────────────── 세력
  {
    id: 'UNI', name: '성간 인류 연합', kind: 'faction', tiers: [3, 5, 7], color: '#3b6fd8', icon: '★',
    desc: '꾸준한 공명도 상승과 안정적인 전투력 증대. 전투가 끝날 때마다 연합 기물이 추가 공명도를 얻습니다.',
    tierDesc: ['모든 메이저 +3, 전투 후 공명도 +1', '모든 메이저 +7, 전투 후 공명도 +2, 피해 +15%', '모든 메이저 +14, 전투 후 공명도 +3, 피해 +45%'],
    member: (t) => {
      const m = T(t, [3, 7, 14]);
      return { majors: { vit: m, pow: m, mnd: m, def: m, agi: m }, mods: t >= 2 ? [inc('all', T(t, [0, 0.15, 0.45]))] : [] };
    },
  },
  {
    id: 'KAL', name: '칼리토 제국', kind: 'faction', tiers: [3, 5, 7], color: '#c0303a', icon: '♛',
    desc: '제국 기물은 공명 등급에 따라 작위(기사→남작→백작→공작, 15등급 대공, 20등급 황족)를 받고, 작위만큼 강해집니다. 백작 이상은 치명타 피해 +25%p, (5) 이상에서 공작은 전투 시작 시 모든 아군에게 보호막을 하사합니다.',
    tierDesc: ['작위 1당 피해 +6%, 방어도 +60', '작위 1당 피해 +12%, 방어도 +120, 공작의 위엄 해금', '작위 1당 피해 +22%, 방어도 +220, 모든 제국 기물 작위 +1'],
    member: (t) => ({
      setup: (u, b) => {
        const title = (u.mem.title || 1) + (t >= 3 ? 1 : 0);
        u.mods.push(inc('all', T(t, [0.06, 0.12, 0.22]) * title));
        u.st.armor += T(t, [60, 120, 220]) * title;
        if (title >= 3) u.st.critDmg += 0.25;
        if (title >= 4 && t >= 2) u.hooks.push({
          onStart(bb, self) { for (const a of bb.alliesOf(self)) bb.shield(a, bb.S(a, 'maxHp') * 0.1); },
        });
        void b;
      },
    }),
  },
  {
    id: 'HEL', name: '헬레니우스 동맹', kind: 'faction', tiers: [3, 5, 7], color: '#2fa39a', icon: '⚑',
    desc: '시너지 단계에 따라 매 페이즈 퀘스트가 주어지고, 완료하면 보상을 받습니다. 동맹 기물은 효과 명중이 증가합니다.',
    tierDesc: ['효과 명중 +20%p, 피해 +15%, 페이즈마다 퀘스트 1개', '효과 명중 +40%p, 피해 +35%, 퀘스트 2개, 보상 1.5배', '효과 명중 +50%p, 피해 +80%, 상태이상 걸린 적에게 피해 +30%, 퀘스트 3개, 보상 2배, 완료 시 동맹 기물 영구 메이저 +2'],
    member: (t) => ({
      stats: { effHit: T(t, [0.2, 0.4, 0.5]) }, mods: [inc('all', T(t, [0.15, 0.35, 0.8]))],
      hooks: t >= 3 ? { dmgMult: (_b, _u, tg) => (isDebuffed(tg) ? 1.3 : 1) } : undefined,
    }),
  },
  {
    id: 'PET', name: '주식회사 페트라', kind: 'faction', tiers: [3, 5, 7], color: '#e07a1f', icon: '¤',
    desc: '에너지 크레딧 스노우볼. 이자 상한 증가, 보험, 대출, 그리고 보유 크레딧에 비례한 전투력.',
    tierDesc: ['이자 상한 +3, 전투 승리 시 크레딧 +1, 페트라 기물 피해 +15%', '보험(패배 시 크레딧 +6, 체력 피해 -50%), 대출 해금, 피해 +35%', `이자 상한 +6, 피해 +35%, 페트라 기물 피해 증폭 = 크레딧 10당 +10% (최대 150%)`],
    member: (t, ctx) => ({
      mods: [inc('all', T(t, [0.15, 0.35, 0.35])), ...(t >= 3 ? [amp('all', Math.min(1.5, Math.floor(ctx.credits / 10) * 0.1))] : [])],
    }),
  },

  // ─────────────── 확장 특성
  {
    id: 'STAFF', name: '참모단', kind: 'trait', tiers: [2, 4, 6], color: '#c9b37a', icon: '✎',
    desc: '참모단이 아닌 아군 하나를 지원 대상으로 지정해 몰아서 강화합니다 (기물 정보 창에서 지정, 미지정 시 공명 등급이 가장 높은 기물). 참모단 기물은 쿨다운 감소 속도 +15%.',
    tierDesc: ['대상 모든 메이저 +5, 피해 +30%', '대상 모든 메이저 +10, 피해 +75%, 쿨다운 감소 +25%', '대상 모든 메이저 +20, 피해 +160%, 쿨다운 감소 +50%, 받는 피해 -25%'],
    member: () => ({ stats: { cdr: 0.15 } }),
    team: (t, ctx) => {
      if (!ctx.run || !ctx.unit || staffTargetUid(ctx.run) !== ctx.unit.uid) return null;
      const m = T(t, [5, 10, 20]);
      return {
        majors: { vit: m, pow: m, mnd: m, def: m, agi: m },
        mods: [inc('all', T(t, [0.3, 0.75, 1.6]))],
        stats: { cdr: T(t, [0, 0.25, 0.5]) },
        taken: t >= 3 ? [red('all', 0.25)] : [],
        setup: (u) => { u.mem.staffed = 1; },
      };
    },
  },
  {
    id: 'BUDDY', name: '최고의 친구', kind: 'trait', tiers: [2, 4, 6], color: '#f08fb0', icon: '♥',
    desc: '최고의 친구 기물은 전투 시작 시 단짝 소환물을 부릅니다. 소환물은 칸을 차지하고 공명도가 없으며, 주인 스탯의 일부를 물려받습니다 (기본 35%). 주인이 쓰러지면 함께 사라집니다.',
    tierDesc: ['소환물 스탯 상속 55%, 소환물 피해 +15%', '소환물 스탯 상속 85%, 소환물 피해 +40%', '소환물 스탯 상속 120%, 소환물 피해 +100%, 소환물 +1'],
    member: (t) => ({ setup: (u) => {
      u.mem.bond = Math.max(u.mem.bond || 0, T(t, [0.55, 0.85, 1.2]));
      u.mem.bondAmp = T(t, [0.15, 0.4, 1.0]);
      if (t >= 3) u.mem.extraSummon = (u.mem.extraSummon || 0) + 1;
    } }),
  },
  {
    id: 'NATURE', name: '캠핑 러버', kind: 'trait', tiers: [2, 4, 6], color: '#8fc56a', icon: '❀',
    desc: '어디서든 야영 장비를 챙겨 다닙니다. 매 전투 시작 시 이 전투에서만 유지되는 무작위 고급 장비를 받습니다 (장비 칸을 차지하지 않음).',
    tierDesc: ['임시 고급 장비 1개', '임시 고급 장비 2개, 그중 1개는 전설', '임시 장비 3개, 전부 전설'],
    member: (t) => ({
      setup: (u, b, ctx) => {
        const n = T(t, [1, 2, 3]) + (u.mem.natureExtra || 0);
        const legends = T(t, [0, 1, 3]);
        const names: string[] = [];
        const ids: string[] = [];
        for (let i = 0; i < n; i++) {
          let id = b.rng.pick(ALL_ADVANCED);
          if (i < legends) id = 'L_' + id.slice(2);
          ids.push(id);
          applyLive(u, itemEffect(id), b, ctx);
          names.push(itemInfo(id).name);
        }
        u.mem.gifts = n;
        u.tempItems = [...(u.tempItems || []), ...ids];
        u.hooks.push({ onStart(bb, self) { bb.emit({ k: 'status', id: self.id, name: names.join(' · ') }); } });
      },
    }),
  },
  {
    id: 'CLERIC', name: '성직자', kind: 'trait', tiers: [2, 4, 6], color: '#ffd866', icon: '✟',
    desc: '신앙을 쌓아 신성 피해를 키웁니다. 성직자가 활성화된 채 페이즈를 시작하면 순례 노드가 추가되어 신앙과 축복을 얻습니다. 전투에서 이기면 신앙 +단계.',
    tierDesc: ['성직자 신성 피해 +20% +신앙×4%', '성직자 신성 피해 +40% +신앙×7%, 모든 아군 피해 +신앙×1.5%', '성직자 신성 피해 +80% +신앙×12%, 모든 아군 피해 +신앙×2.5%'],
    member: (t, ctx) => ({ mods: [inc('holy', T(t, [0.2, 0.4, 0.8]) + faithOf(ctx) * T(t, [0.04, 0.07, 0.12]))] }),
    team: (t, ctx) => (t >= 2 ? { mods: [inc('all', faithOf(ctx) * T(t, [0, 0.015, 0.025]))] } : null),
  },
  {
    id: 'STAR', name: '은하 대스타', kind: 'trait', tiers: [2, 4, 6], color: '#ff9de2', icon: '✪',
    desc: '전투와 노드 진행으로 명성을 쌓습니다. 대스타가 활성화되어 있으면 보스 직전에 속보 노드가 추가되어, 명성을 원하는 보상으로 바꿀 수 있습니다. 대스타 기물은 명성만큼 강해집니다.',
    tierDesc: ['명성 획득 ×1, 대스타 피해 +15% +명성×0.8%', '명성 획득 ×2, 대스타 피해 +35% +명성×1.5%', '명성 획득 ×3, 대스타 피해 +80% +명성×2.5%, 모든 아군 피해 +명성×0.6%'],
    member: (t, ctx) => ({ mods: [inc('all', T(t, [0.15, 0.35, 0.8]) + Math.min(1.5, fameOf(ctx) * T(t, [0.008, 0.015, 0.025])))] }),
    team: (t, ctx) => (t >= 3 ? { mods: [inc('all', Math.min(0.5, fameOf(ctx) * 0.006))] } : null),
  },
  {
    id: 'INFIL', name: '침투자', kind: 'trait', tiers: [2, 4, 6], color: '#9a8cff', icon: '☾',
    desc: '전투가 시작되면 적 후방으로 순간이동해 기습합니다. 회피와 치명타 확률이 오르고, 착지 직후 잠시 피해가 크게 증가합니다.',
    tierDesc: ['회피 +15%p, 치명타 +15%p, 기습 3초 피해 +50%', '회피 +25%p, 치명타 +30%p, 기습 피해 +110%', '회피 +40%p, 치명타 +50%p, 기습 피해 +220%, 처치 시 기습 재발동'],
    member: (t) => {
      const ambush = T(t, [0.5, 1.1, 2.2]);
      return {
        stats: { eva: T(t, [0.15, 0.25, 0.4]), crit: T(t, [0.15, 0.3, 0.5]) },
        hooks: {
          onStart(b, u) {
            const foes = b.enemiesOf(u);
            if (!foes.length) return;
            // 적 진영 가장 안쪽(아군에서 먼 쪽)의 적을 노린다
            const back = foes.slice().sort((a, c) => (u.side === 0 ? a.y - c.y : c.y - a.y))[0];
            if (blinkTo(b, u, back)) b.buff(u, u, 'infil.ambush', 3, { mods: [inc('all', ambush)], label: '기습' });
          },
          onKill: t >= 3 ? (b, u) => { b.buff(u, u, 'infil.ambush', 3, { mods: [inc('all', ambush)], label: '기습' }); } : undefined,
        },
      };
    },
  },
  // ─────────────── 확장 세력
  {
    id: 'SIR', name: '시리우스 성도회', kind: 'faction', tiers: [3, 5, 7], color: '#e8e2c8', icon: '✧',
    desc: '시리우스를 섬기는 무장 교단. 성도회 기물은 신성 피해가 강하고 단단하며, 단계가 오르면 쓰러진 아군을 되살리는 기적을 일으킵니다.',
    tierDesc: ['성도회 신성 피해 +35%, 받는 피해 -12%', '신성 피해 +70%, 받는 피해 -18%, 전투당 1회 처음 쓰러지는 아군 부활 (체력 40%)', '신성 피해 +150%, 받는 피해 -25%, 부활 3회 (체력 70%)'],
    member: (t) => ({ mods: [inc('holy', T(t, [0.35, 0.7, 1.5]))], taken: [red('all', T(t, [0.12, 0.18, 0.25]))] }),
    team: (t) => (t >= 2 ? {
      hooks: {
        onLethal(b, u) {
          if (u.isSummon || (b.mem.sirRevive || 0) >= T(t, [0, 1, 3])) return false;
          b.mem.sirRevive = (b.mem.sirRevive || 0) + 1;
          u.hp = b.S(u, 'maxHp') * T(t, [0, 0.4, 0.7]);
          u.statuses = u.statuses.filter((s) => s.type === 'buff');
          b.emit({ k: 'status', id: u.id, name: '부활의 기적' });
          b.fx(u.x, u.y, 0, 'holy');
          return true;
        },
      },
    } : null),
  },
  {
    id: 'PAN', name: '범은하 공동체', kind: 'faction', tiers: [3, 5, 7], color: '#5fd3c0', icon: '◍',
    desc: '온갖 종족이 섞인 자유 공동체. 출전한 서로 다른 세력 수만큼 모든 아군이 강해지고, 5단계부터는 가장 큰 다른 세력에 손을 보태 그 세력의 인원 수를 늘려 줍니다.',
    tierDesc: ['세력 1개당 모든 아군 피해 +4%, 받는 피해 -2%', '세력 1개당 피해 +9%, 받는 피해 -4%, 가장 큰 다른 세력 인원 +1', '세력 1개당 피해 +16%, 받는 피해 -6%, 다른 세력 인원 +2, 모든 아군 메이저 +5'],
    team: (t, ctx) => {
      const f = FACTIONS.filter((x) => (ctx.counts[x] || 0) > 0).length;
      return {
        mods: [inc('all', T(t, [0.04, 0.09, 0.16]) * f)], taken: [red('all', T(t, [0.02, 0.04, 0.06]) * f)],
        majors: t >= 3 ? { vit: 5, pow: 5, mnd: 5, def: 5, agi: 5 } : undefined,
      };
    },
  },

  // ─────────────── 3차 확장
  {
    id: 'NAV', name: '항해자', kind: 'trait', tiers: [2, 4, 6], color: '#7ab8ff', icon: '✈',
    desc: '항해자 1명을 [에이스 파일럿]으로 지정합니다 (기물 정보 창, 미지정 시 공명 등급이 가장 높은 항해자). 에이스는 기물마다 다른 추가 특성이 활성화되고, 단계가 오를수록 그 능력이 강해집니다.',
    tierDesc: ['에이스 능력 ×1, 항해자 피해 +15%', '에이스 능력 ×1.8, 항해자 기동력 +5, 피해 +35%', '에이스 능력 ×3, 항해자 기동력 +10, 피해 +75%'],
    member: (t, ctx) => {
      const agi = T(t, [0, 5, 10]);
      const navDmg = [inc('all', T(t, [0.15, 0.35, 0.75]))];
      const ace = ctx.run && ctx.unit && aceTargetUid(ctx.run) === ctx.unit.uid ? UNIT_BY_ID[ctx.unit.defId].ace : undefined;
      if (!ace) return { majors: { agi }, mods: navDmg };
      const e = ace.effect(T(t, [1, 1.8, 3]));
      const prev = e.setup;
      return { ...e, mods: [...(e.mods || []), ...navDmg], majors: { ...(e.majors || {}), agi: (e.majors?.agi || 0) + agi }, setup: (u, b, c) => { u.mem.ace = 1; prev?.(u, b, c); } };
    },
  },
  {
    id: 'CHEF', name: '셰프', kind: 'trait', tiers: [2, 4, 6], color: '#ffb36b', icon: '♨',
    desc: '셰프는 기본 공격을 하지 않고 제자리에서 전용 요리 기술만 씁니다. 요리는 아군 1명을 회복시키거나 보호막을 주고 특수 버프를 겁니다. 단계가 오르면 요리 위력이 커집니다.',
    tierDesc: ['요리 위력 ×1.4', '요리 위력 ×2.1', '요리 위력 ×3.5, 모든 아군 최대 체력 +15%'],
    member: (t) => ({ setup: (u) => { u.mem.cook = CFG.cookPower[t]; } }),
    team: (t) => (t >= 3 ? { pct: { maxHp: 0.15 } } : null),
  },
  {
    id: 'ENG', name: '엔지니어', kind: 'trait', tiers: [2, 3, 4], color: '#a0b4c8', icon: '⚙',
    desc: '전투 시작 시 아군 진영에 감시 포탑을 설치합니다. 포탑은 움직이지 않고, 출전한 엔지니어 능력치 평균의 일부를 물려받습니다. 칸을 차지하며, 빈칸이 없으면 설치되지 않습니다.',
    tierDesc: ['감시 포탑 1기 (상속 60%)', '감시 포탑 2기 (상속 80%)', '감시 포탑 3기 (상속 120%), 포탑 공격 속도 +50%'],
    member: (t) => ({
      setup: (u) => { u.mem.eng = t; },
      hooks: {
        onStart(b, u) {
          const engs = b.alliesOf(u).filter((a) => a.mem.eng);
          if (engs[0] !== u) return; // 대표 엔지니어 1명만 설치
          const extra = engs.reduce((s2, a) => s2 + (a.mem.turretExtra || 0), 0);
          ENG_HOOK.spawn?.(b, u, engs, t + extra);
        },
      },
    }),
  },
  {
    id: 'TIME', name: '시간 여행자', kind: 'trait', tiers: [2, 3, 4], color: '#c8a0ff', icon: '⌛',
    desc: '시간 여행자는 회피 확률이 크게 오르고, 공격을 피할 때마다 체력을 회복합니다 (찰과상 포함). 최저 명중률은 15%입니다.',
    tierDesc: ['회피 +25%p, 회피 시 최대 체력 3% 회복', '회피 +40%p, 회피 시 6% 회복, 피해 +20%', '회피 +55%p, 회피 시 10% 회복, 피해 +60%, 회피 시 공격자에게 타격 위력 100% 반격'],
    member: (t) => {
      const h = T(t, [0.03, 0.06, 0.1]);
      return {
        stats: { eva: T(t, [0.25, 0.4, 0.55]) }, mods: t >= 2 ? [inc('all', T(t, [0, 0.2, 0.6]))] : [],
        hooks: { onEvade(b, u, src) { b.heal(u, u, b.S(u, 'maxHp') * h); if (t >= 3 && src?.alive) skillHit(b, u, src, 'strike', 1.0, 'phys', { tag: 'proc', noMiss: true }); } },
      };
    },
  },
  {
    id: 'FAM', name: '엘베스타드 일가', kind: 'faction', tiers: [3, 5, 7], color: '#b8c0d8', icon: '♞',
    desc: '은하 귀족 엘베스타드 가문. 일가 기물이 주는 모든 피해가 증폭됩니다. 이 증폭은 다른 증폭과 겹치지 않는 별도 배율로 곱해집니다.',
    tierDesc: ['일가 기물 피해 증폭 +30%', '일가 기물 피해 증폭 +75%', '일가 기물 피해 증폭 +200%'],
    member: (t) => {
      const m = 1 + T(t, [0.3, 0.75, 2.0]);
      return { hooks: { dmgMult: () => m } };
    },
  },
  {
    id: 'EXPLORER', name: '탐험가', kind: 'trait', tiers: [1], color: '#e6d27a', icon: '⚓',
    desc: `아문센 전용. ${CFG.explorerPhase}페이즈 전에는 배치할 수 없습니다. 고유 전설 장비 [그늘]을 장착한 채 합류합니다 (해제 불가).`,
    tierDesc: ['[그늘]: 기술 쿨다운 감소 속도 +150%, 모든 아군 회피·치명타 확률 +20%p'],
  },
  {
    id: 'RFRIEND', name: '당신의 친구, R', kind: 'trait', tiers: [1], color: '#ff7aa8', icon: 'R',
    desc: '데미우르고스 전용. 출전한 시리우스 성도회 인원과 성직자 인원 1pt당 데미우르고스의 모든 메이저 능력치 +1.',
    tierDesc: ['모든 메이저 +(성도회 인원 + 성직자 인원)'],
    member: (_t, ctx) => {
      const n = (ctx.counts.SIR || 0) + (ctx.counts.CLERIC || 0);
      return { majors: { vit: n, pow: n, mnd: n, def: n, agi: n } };
    },
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

/** 항해자 에이스 파일럿: 지정한 항해자가 출전 중이면 그 기물, 아니면 공명 등급이 가장 높은 항해자 */
export function aceTargetUid(run: RunState): string | null {
  const dep = run.units.filter((u) => u.pos && UNIT_BY_ID[u.defId].traits.includes('NAV'));
  if (dep.some((u) => u.uid === run.aceTarget)) return run.aceTarget;
  return dep.slice().sort((a, b) => b.rank - a.rank)[0]?.uid ?? null;
}

/** 엔지니어 포탑 생성 (build.ts 에서 주입: 순환 import 방지) */
export const ENG_HOOK: { spawn?: (b: Battle, lead: CUnit, engs: CUnit[], n: number) => void } = {};
