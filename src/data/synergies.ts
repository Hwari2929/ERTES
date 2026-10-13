import type { Battle, CUnit } from '../engine/combat';
import type { Effect, EffectCtx } from '../engine/effects';
import { amp, applyLive, inc, red, vuln } from '../engine/effects';
import { CFG } from '../config';
import { type Major, MAJORS, type RunState, type Stats, type SynergyId } from '../types';
import { ALL_ADVANCED, itemEffect, itemInfo } from './items';
import { addStacks, blinkTo, harmfulCount, isDebuffed, isHarmful, pct, slow } from './kit';
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
  /** 최종 단계는 증표(문장)를 단 기물이 1명 이상 있어야 열린다 */
  lockFinal?: boolean;
  /** 소속 기물에게 */
  member?: (tier: number, ctx: EffectCtx) => Effect | null;
  /** 모든 출전 아군에게 */
  team?: (tier: number, ctx: EffectCtx) => Effect | null;
}

export const TITLE_NAME = ['평민', '기사', '남작', '백작', '공작', '대공', '황족'];
export const rankTitle = (rank: number) => (rank >= 20 ? 6 : rank >= 15 ? 5 : rank >= 10 ? 4 : rank >= 7 ? 3 : rank >= 4 ? 2 : 1);

const T = (tier: number, a: number[]) => a[Math.max(0, tier - 1)];

// ─────────────── 범은하 공동체: 기물마다 다른 선물
type Gift = { name: string; text: string; stats?: Partial<Stats>; pct?: { armor?: number }; tag?: 'tech' | 'psy'; majors?: number };
const PAN_GIFT: Record<string, Gift> = {
  zephyro: { name: '제피로', text: '회피 +7%p', stats: { eva: 0.07 } },
  joshua: { name: '조슈아', text: '받는 회복 +10%p', stats: { healEff: 0.1 } },
  vivian: { name: '비비안', text: '방어 관통 +10%p', stats: { armorPen: 0.1 } },
  yupito: { name: '유피토', text: '방어도 +10%', pct: { armor: 0.1 } },
  oliver: { name: '올리버', text: '공격 속도 +10%p', stats: { atkSpd: 0.1 } },
  ingel: { name: '잉겔', text: '기술 피해 +10%p', tag: 'tech' },
  bjorn: { name: '비외른', text: '치명타 확률 +7%p', stats: { crit: 0.07 } },
  onyx: { name: '오닉스', text: '정신 피해 +10%p', tag: 'psy' },
  rus: { name: '루스', text: '치명타 피해 +10%p', stats: { critDmg: 0.1 } },
};
const PAN_EMBLEM: Gift = { name: '증표', text: '모든 메이저 +2 (내림)', majors: 2 };
const PAN_MULT = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const PAN_GIFT_TEXT = [...Object.values(PAN_GIFT), PAN_EMBLEM].map((g) => `${g.name} ${g.text}`).join(' · ');
const isPan = (defId: string, mod: string | null) => UNIT_BY_ID[defId]?.factions.includes('PAN') || mod === 'M_PAN';
/** 출전한 범은하 기물의 선물을 모아 하나의 효과로 */
function panGift(t: number, ctx: EffectCtx): Effect | null {
  const run = ctx.run;
  if (!run) return null;
  const k = PAN_MULT[Math.min(PAN_MULT.length, t) - 1] * (ctx.unit && isPan(ctx.unit.defId, ctx.unit.mod) ? 2 : 1);
  const seen = new Set<string>();
  const stats: Partial<Stats> = {};
  let armor = 0, maj = 0;
  const mods: ReturnType<typeof inc>[] = [];
  for (const u of run.units) {
    if (!u.pos || seen.has(u.defId) || !isPan(u.defId, u.mod)) continue;
    seen.add(u.defId);
    const g = UNIT_BY_ID[u.defId].factions.includes('PAN') ? PAN_GIFT[u.defId] || PAN_EMBLEM : PAN_EMBLEM;
    for (const [key, v] of Object.entries(g.stats || {})) stats[key as keyof Stats] = (stats[key as keyof Stats] || 0) + (v as number) * k;
    armor += (g.pct?.armor || 0) * k;
    if (g.tag) mods.push(inc(g.tag, 0.1 * k));
    maj += g.majors || 0;
  }
  const m = Math.floor(maj * k);
  const majors = m ? (Object.fromEntries(MAJORS.map((x) => [x, m])) as Record<Major, number>) : undefined;
  return { stats, pct: armor ? { armor } : undefined, mods, majors };
}

/** 스텔라레이서: 비행선 추락 */
function shipCrash(b: Battle, u: CUnit, k: number) {
  b.emit({ k: 'status', id: u.id, name: '비행선 추락!' });
  for (const e of b.enemiesOf(u)) {
    b.fx(e.x, e.y, 1, 'phys');
    b.dealDamage(u, e, b.S(e, 'maxHp') * k, { elem: 'true', tag: 'proc' });
  }
}

/** 전도체: from 에서 시작해 주변 적에게 튀는 연쇄 전기 (skipFrom = from 을 이미 맞힌 대상으로 취급) */
function chainBolt(b: Battle, u: CUnit, from: CUnit, hops: number, radius: number, k: number, skipFrom: boolean) {
  const dmg = Math.max(b.S(u, 'shoot'), b.S(u, 'strike'), b.S(u, 'tech')) * k; // 시너지 발동: 지휘관도 전술 위력이 아닌 실제 위력
  const hit = new Set<CUnit>(skipFrom ? [from] : []);
  let at: { x: number; y: number } = from;
  for (let i = 0; i < hops; i++) {
    const pool = b.around(at, radius, b.enemiesOf(u)).filter((e) => !hit.has(e));
    const next = b.nearest(at as CUnit, pool);
    if (!next) break;
    hit.add(next);
    b.fx(next.x, next.y, 0, 'elec');
    b.dealDamage(u, next, dmg, { elem: 'elec', tag: 'proc', kind: 'tech' });
    at = next;
  }
}

export const SYNERGIES: SynDef[] = [
  // ═══════════════ 세력
  {
    id: 'UNI', name: '성간 인류 연합', kind: 'faction', tiers: [3, 5, 7, 9], lockFinal: true, color: '#3b6fd8', icon: '★',
    desc: '꾸준한 공명도 상승과 안정적인 전투력 증대. 전투가 끝날 때마다 연합 기물이 추가 공명도를 얻습니다.',
    tierDesc: ['모든 메이저 +3, 전투 후 공명도 +1', '모든 메이저 +7, 전투 후 공명도 +2, 피해 +15%', '모든 메이저 +14, 전투 후 공명도 +3, 피해 +45%',
      '[연합 총동원령] 모든 메이저 +25, 전투 후 공명도 +5, 피해 +100%, 모든 아군 모든 메이저 +6'],
    member: (t) => {
      const m = T(t, [3, 7, 14, 25]);
      return { majors: { vit: m, pow: m, mnd: m, def: m, agi: m }, mods: t >= 2 ? [inc('all', T(t, [0, 0.15, 0.45, 1.0]))] : [] };
    },
    team: (t) => (t >= 4 ? { majors: { vit: 6, pow: 6, mnd: 6, def: 6, agi: 6 } } : null),
  },
  {
    id: 'KAL', name: '칼리토 제국', kind: 'faction', tiers: [3, 5, 7, 9], lockFinal: true, color: '#c0303a', icon: '♛',
    desc: '제국 기물은 공명 등급에 따라 작위(기사→남작→백작→공작, 15등급 대공, 20등급 황족)를 받고, 작위만큼 강해집니다. 백작 이상은 치명타 피해 +25%p, (5) 이상에서 공작은 전투 시작 시 모든 아군에게 보호막을 하사합니다.',
    tierDesc: ['작위 1당 피해 +6%, 방어도 +60', '작위 1당 피해 +12%, 방어도 +120, 공작의 위엄 해금', '작위 1당 피해 +22%, 방어도 +220, 모든 제국 기물 작위 +1',
      '[황제 친정] 작위 1당 피해 +35%, 방어도 +350, 작위 +2, 공작의 하사 보호막 10% → 25%, 모든 아군 치명타 피해 +50%p'],
    member: (t) => ({
      setup: (u) => {
        const title = (u.mem.title || 1) + (t >= 4 ? 2 : t >= 3 ? 1 : 0);
        u.mods.push(inc('all', T(t, [0.06, 0.12, 0.22, 0.35]) * title));
        u.st.armor += T(t, [60, 120, 220, 350]) * title;
        if (title >= 3) u.st.critDmg += 0.25;
        const gift = t >= 4 ? 0.25 : 0.1;
        if (title >= 4 && t >= 2) u.hooks.push({
          onStart(bb, self) { for (const a of bb.alliesOf(self)) bb.shield(a, bb.S(a, 'maxHp') * gift); },
        });
      },
    }),
    team: (t) => (t >= 4 ? { stats: { critDmg: 0.5 } } : null),
  },
  {
    id: 'HEL', name: '헬레니우스 동맹', kind: 'faction', tiers: [3, 5, 7, 9], lockFinal: true, color: '#2fa39a', icon: '⚑',
    desc: '시너지 단계에 따라 매 페이즈 퀘스트가 주어지고, 완료하면 보상을 받습니다. 동맹 기물은 효과 명중이 증가합니다.',
    tierDesc: ['효과 명중 +20%p, 피해 +15%, 페이즈마다 퀘스트 1개', '효과 명중 +40%p, 피해 +35%, 퀘스트 2개, 보상 1.5배', '효과 명중 +50%p, 피해 +80%, 상태이상 걸린 적에게 피해 +30%, 퀘스트 3개, 보상 2배, 완료 시 동맹 기물 영구 메이저 +2',
      '[동맹 대함대] 효과 명중 +80%p, 피해 +150%, 상태이상 걸린 적에게 피해 +60%, 퀘스트 4개, 보상 3배, 완료 시 영구 메이저 +3'],
    member: (t) => ({
      stats: { effHit: T(t, [0.2, 0.4, 0.5, 0.8]) }, mods: [inc('all', T(t, [0.15, 0.35, 0.8, 1.5]))],
      hooks: t >= 3 ? { dmgMult: (_b, _u, tg) => (isDebuffed(tg) ? (t >= 4 ? 1.6 : 1.3) : 1) } : undefined,
    }),
  },
  {
    id: 'PET', name: '주식회사 페트라', kind: 'faction', tiers: [3, 5, 7, 9], lockFinal: true, color: '#e07a1f', icon: '¤',
    desc: '에너지 크레딧 스노우볼. 이자 상한 증가, 보험, 대출, 그리고 보유 크레딧에 비례한 전투력.',
    tierDesc: ['이자 상한 +3, 전투 승리 시 크레딧 +1, 페트라 기물 피해 +15%', '보험(패배 시 크레딧 +6, 체력 피해 -50%), 대출 해금, 피해 +35%', '이자 상한 +6, 피해 +35%, 페트라 기물 피해 증폭 = 크레딧 10당 +10% (최대 150%)',
      '[적대적 인수합병] 이자 상한 +10, 승리 시 크레딧 +3, 피해 +60%, 피해 증폭 = 크레딧 10당 +15% (최대 300%)'],
    member: (t, ctx) => ({
      mods: [inc('all', T(t, [0.15, 0.35, 0.35, 0.6])), ...(t >= 3 ? [amp('all', Math.min(t >= 4 ? 3 : 1.5, Math.floor(ctx.credits / 10) * (t >= 4 ? 0.15 : 0.1)))] : [])],
    }),
  },
  {
    id: 'SIR', name: '시리우스 성도회', kind: 'faction', tiers: [3, 5, 7, 9], lockFinal: true, color: '#e8e2c8', icon: '✧',
    desc: '시리우스를 섬기는 무장 교단. 성도회 기물은 신성 피해가 강하고 단단하며, 단계가 오르면 쓰러진 아군을 되살리는 기적을 일으킵니다.',
    tierDesc: ['성도회 신성 피해 +35%, 피해량 경감 12%', '신성 피해 +70%, 피해량 경감 18%, 전투당 1회 처음 쓰러지는 아군 부활 (체력 40%)', '신성 피해 +150%, 피해량 경감 25%, 부활 3회 (체력 70%)',
      '[시리우스 강림] 신성 피해 +300%, 피해량 경감 35%, 부활 6회 (체력 100%), 부활한 아군은 2초 무적 · 10초간 피해 +50%'],
    member: (t) => ({ mods: [inc('holy', T(t, [0.35, 0.7, 1.5, 3.0]))], taken: [red('all', T(t, [0.12, 0.18, 0.25, 0.35]))] }),
    team: (t) => (t >= 2 ? {
      hooks: {
        onLethal(b, u) {
          if (u.isSummon || (b.mem.sirRevive || 0) >= T(t, [0, 1, 3, 6])) return false;
          b.mem.sirRevive = (b.mem.sirRevive || 0) + 1;
          u.hp = b.S(u, 'maxHp') * T(t, [0, 0.4, 0.7, 1.0]);
          u.statuses = u.statuses.filter((s) => s.type === 'buff' && !isHarmful(s));
          if (t >= 4) { u.mem.invulnUntil = b.t + 2; b.buff(u, u, 'sir.reborn', 10, { mods: [inc('all', 0.5)], label: '강림' }); }
          b.emit({ k: 'status', id: u.id, name: '부활의 기적' });
          b.fx(u.x, u.y, 0, 'holy');
          return true;
        },
      },
    } : null),
  },
  {
    id: 'PAN', name: '범은하 공동체', kind: 'faction', tiers: [1, 2, 3, 4, 5, 6, 7], color: '#5fd3c0', icon: '◍',
    desc: `온갖 종족이 섞인 자유 공동체. 출전한 공동체 기물마다 모든 아군에게 저마다 다른 선물을 줍니다. 공동체 기물은 선물 효과를 2배로 받습니다. 단계가 오를수록 모든 선물이 커집니다.\n선물: ${PAN_GIFT_TEXT}`,
    tierDesc: ['선물 ×1', '선물 ×1.25', '선물 ×1.5', '선물 ×1.75', '선물 ×2', '선물 ×2.5', '선물 ×3'],
    team: (t, ctx) => panGift(t, ctx),
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
    id: 'SEC', name: '보안위원회', kind: 'faction', tiers: [2, 4, 6], lockFinal: true, color: '#7d8aa3', icon: '⛨',
    desc: '은하 보안을 책임지는 비밀 위원회. 위원회 기물은 피해에 강하고, 해로운 효과에 시달릴수록 오히려 기술을 빨리 꺼냅니다. 위원회 기물의 기본 공격은 확률로 적을 [둔화]시키고, 위원회 기물이 거는 해로운 효과는 더 오래 갑니다.',
    tierDesc: ['피해량 경감 10%, 정신 피해 추가 -15%, 해로운 효과 1개당 쿨다운 감소 속도 +10%, 기본 공격 25% 확률 [둔화] 2초, 거는 해로운 효과 +1초', '피해량 경감 20%, 정신 피해 추가 -20%, 해로운 효과 1개당 +20%, [둔화] 35%, 해로운 효과 +2초',
      '[비상 대권] 피해량 경감 30%, 정신 피해 추가 -30%, 해로운 효과 1개당 쿨다운 감소 속도 +50%, [둔화] 50%, 해로운 효과 +3초'],
    member: (t) => {
      const k = T(t, [0.1, 0.2, 0.5]), ext = T(t, [1, 2, 3]), slowP = T(t, [0.25, 0.35, 0.5]);
      return {
        taken: [red('all', T(t, [0.1, 0.2, 0.3])), red('psy', T(t, [0.15, 0.2, 0.3]))],
        hooks: {
          onInflict(_b, u, tgt, s) { if (tgt.side !== u.side && isHarmful(s)) s.dur += ext; },
          onBasic(b, u, tgt, r) { if (!r.miss && tgt.alive) slow(b, u, tgt, 0.2, 2, slowP); },
          onTick(_b, u) {
            const v = harmfulCount(u) * k;
            u.st.cdr += v - (u.mem.secCdr || 0);
            u.mem.secCdr = v;
          },
        },
      };
    },
  },
  {
    id: 'STL', name: '스텔라레이서', kind: 'faction', tiers: [2, 4, 6, 8], lockFinal: true, color: '#ff6a3d', icon: '➹',
    desc: '성간 경기장의 레이서들. 레이서 기물은 빠르고, 전투가 시작되면 경기장에서 이탈한 비행선이 적진에 추락해 모든 적에게 최대 체력 비례 고정 피해를 줍니다.',
    tierDesc: ['기동력 +5, 전투 시작 비행선 추락: 모든 적 최대 체력 4% 고정 피해', '기동력 +11, 추락 6%, 20초마다 다시 추락',
      '기동력 +18, 추락 8%, 14초마다 다시 추락', '[그랑프리 대참사] 기동력 +30, 추락 12%, 8초마다 다시 추락'],
    member: (t) => {
      const dmg = T(t, [0.04, 0.06, 0.08, 0.12]), every = T(t, [0, 20, 14, 8]);
      const lead = (b: Battle, u: CUnit) => b.alliesOf(u).find((a) => a.mem.stl) === u;
      return {
        majors: { agi: T(t, [5, 11, 18, 30]) },
        setup: (u) => { u.mem.stl = 1; },
        hooks: {
          onStart(b, u) { if (lead(b, u)) shipCrash(b, u, dmg); },
          onTick(b, u, dt) {
            if (!every || !lead(b, u)) return;
            u.mem.stlT = (u.mem.stlT || 0) + dt;
            if (u.mem.stlT >= every) { u.mem.stlT = 0; shipCrash(b, u, dmg); }
          },
        },
      };
    },
  },
  {
    id: 'HOI', name: '호이슌 홀딩스', kind: 'faction', tiers: [2, 4, 6], color: '#d4af37', icon: '₩',
    desc: '은하 금융을 쥔 거대 지주회사. 호이슌 기물은 정신력이 오르고, 활성화되어 있으면 페이즈 중간에 [투자] 노드가 열립니다. 단계가 높을수록 투자 상품이 많고 수익률이 좋습니다.',
    tierDesc: ['정신력 +5, [투자] 노드: 상품 3개, 투자 수익 ×1.5', '정신력 +11, 상품 4개, 투자 수익 ×1.8, 가격 -15%', '[블랙 먼데이] 정신력 +24, 상품 5개, 투자 수익 ×2.5, 가격 -30%, 호이슌 기물 피해 +1%p × 보유 크레딧 (최대 +120%)'],
    member: (t, ctx) => ({ majors: { mnd: T(t, [5, 11, 24]) }, mods: t >= 3 ? [inc('all', Math.min(1.2, ctx.credits * 0.01))] : [] }),
  },
  {
    id: 'TIME', name: '시간 여행자', kind: 'faction', tiers: [2, 3, 4, 5], color: '#c8a0ff', icon: '⌛',
    desc: '시간의 틈을 걷는 이들. 시간 여행자는 회피가 크게 오르고, 공격을 피할 때마다 (찰과상 포함) 체력을 회복하며 공격자에게 고정 피해로 반격합니다. 최저 명중률은 15%입니다.',
    tierDesc: ['회피 +7%p, 회피 시 최대 체력 3% 회복, 반격 = 사격 · 타격 위력 중 높은 값 40%', '회피 +18%p, 4% 회복, 반격 100%', '회피 +28%p, 5% 회복, 반격 200%',
      '[시간 역행] 회피 +42%p, 6% 회복, 반격 500%'],
    member: (t) => {
      const h = T(t, [0.03, 0.04, 0.05, 0.06]), k = T(t, [0.4, 1, 2, 5]);
      return {
        stats: { eva: T(t, [0.07, 0.18, 0.28, 0.42]) },
        hooks: {
          onEvade(b, u, src) {
            b.heal(u, u, b.S(u, 'maxHp') * h);
            if (src?.alive && src !== u) b.dealDamage(u, src, Math.max(b.S(u, 'shoot'), b.S(u, 'strike')) * k, { elem: 'true', tag: 'proc' });
          },
        },
      };
    },
  },

  // ═══════════════ 특성
  {
    id: 'MED', name: '의무관', kind: 'trait', tiers: [2, 4, 6, 8], color: '#5ad08a', icon: '✚',
    desc: '모든 아군의 회복 효율이 증가하고, 의무관은 4초마다 체력 비율이 가장 낮은 아군을 치료합니다.',
    tierDesc: ['회복 효율 +20%, 치료 = 기술 위력 80%', '회복 효율 +40%, 치료 = 기술 위력 150%', '회복 효율 +75%, 치료 = 기술 위력 260%, 치료 대상에게 초과분까지 보호막',
      '[기적의 병동] 회복 효율 +150%, 3초마다 기술 위력 450% 치료 + 초과분 보호막, 치료할 때 해로운 효과 1개 제거, 모든 아군 최대 체력 +20%'],
    team: (t) => ({ stats: { healEff: T(t, [0.2, 0.4, 0.75, 1.5]) }, pct: t >= 4 ? { maxHp: 0.2 } : undefined }),
    member: (t) => {
      const k = T(t, [0.8, 1.5, 2.6, 4.5]), every = t >= 4 ? 3 : 4;
      return {
        hooks: {
          onTick(b, u, dt) {
            u.mem.medT = (u.mem.medT || 0) + dt;
            if (u.mem.medT >= every) {
              u.mem.medT = 0;
              const l = b.lowestHpAlly(u);
              if (l && (b.hpPct(l) < 1 || (t >= 4 && isDebuffed(l)))) {
                const v = b.S(u, 'tech') * k; const miss = b.S(l, 'maxHp') - l.hp;
                b.heal(u, l, v);
                if (t >= 3 && v > miss) b.shield(l, v - miss);
                if (t >= 4) { const i = l.statuses.findIndex(isHarmful); if (i >= 0) l.statuses.splice(i, 1); }
              }
            }
          },
        },
      };
    },
  },
  {
    id: 'BUDDY', name: '최고의 친구', kind: 'trait', tiers: [2, 4, 6, 8], color: '#f08fb0', icon: '♥',
    desc: '최고의 친구 기물은 전투 시작 시 단짝 소환물을 부릅니다. 소환물은 칸을 차지하고 공명도가 없으며, 주인 스탯의 일부를 물려받습니다 (기본 35%). 주인이 쓰러지면 함께 사라집니다.',
    tierDesc: ['소환물 스탯 상속 55%, 소환물 피해 +15%', '소환물 스탯 상속 85%, 소환물 피해 +40%', '소환물 스탯 상속 120%, 소환물 피해 +100%, 소환물 +1',
      '[우정 파워 MAX] 소환물 스탯 상속 200%, 소환물 피해 +250%, 소환물 +2'],
    member: (t) => ({ setup: (u) => {
      u.mem.bond = Math.max(u.mem.bond || 0, T(t, [0.55, 0.85, 1.2, 2.0]));
      u.mem.bondAmp = T(t, [0.15, 0.4, 1.0, 2.5]);
      if (t >= 3) u.mem.extraSummon = (u.mem.extraSummon || 0) + (t >= 4 ? 2 : 1);
    } }),
  },
  {
    id: 'NATURE', name: '캠핑 러버', kind: 'trait', tiers: [2, 4, 6, 8], color: '#8fc56a', icon: '❀',
    desc: '어디서든 야영 장비를 챙겨 다닙니다. 매 전투 시작 시 이 전투에서만 유지되는 무작위 희귀 장비를 받습니다 (장비 칸을 차지하지 않음).',
    tierDesc: ['임시 희귀 장비 1개', '임시 희귀 장비 2개, 그중 1개는 전설', '임시 장비 3개, 전부 전설', '[글램핑 풀옵션] 임시 장비 5개, 전부 전설'],
    member: (t) => ({
      setup: (u, b, ctx) => {
        const n = T(t, [1, 2, 3, 5]) + (u.mem.natureExtra || 0);
        const legends = T(t, [0, 1, 3, 5]);
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
    id: 'STAR', name: '은하 대스타', kind: 'trait', tiers: [2, 4, 6, 8], color: '#ff9de2', icon: '✪',
    desc: '전투와 노드 진행으로 명성을 쌓습니다. 대스타가 활성화되어 있으면 보스 직전에 속보 노드가 추가되어, 명성을 원하는 보상으로 바꿀 수 있습니다. 대스타 기물은 명성만큼 강해집니다.',
    tierDesc: ['명성 획득 ×1, 대스타 피해 +15% +명성×0.8%', '명성 획득 ×2, 대스타 피해 +35% +명성×1.5%', '명성 획득 ×3, 대스타 피해 +80% +명성×2.5%, 모든 아군 피해 +명성×0.6%',
      '[은하 월드 투어] 명성 획득 ×5, 대스타 피해 +200% +명성×4% (최대 +300%), 모든 아군 피해 +명성×1.2% (최대 +100%)'],
    member: (t, ctx) => ({ mods: [inc('all', T(t, [0.15, 0.35, 0.8, 2.0]) + Math.min(t >= 4 ? 3 : 1.5, fameOf(ctx) * T(t, [0.008, 0.015, 0.025, 0.04])))] }),
    team: (t, ctx) => (t >= 3 ? { mods: [inc('all', Math.min(t >= 4 ? 1 : 0.5, fameOf(ctx) * (t >= 4 ? 0.012 : 0.006)))] } : null),
  },
  {
    id: 'INFIL', name: '침투자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#9a8cff', icon: '☾',
    desc: '전투가 시작되면 적 후방으로 순간이동해 기습합니다. 회피와 치명타 확률이 오르고, 착지 직후 잠시 피해가 크게 증가합니다.',
    tierDesc: ['회피 +11%p, 치명타 +11%p, 기습 3초 피해 +50%', '회피 +18%p, 치명타 +21%p, 기습 피해 +110%', '회피 +28%p, 치명타 +35%p, 기습 피해 +220%, 처치 시 기습 재발동',
      '[그림자 숙청] 회피 +42%p, 치명타 +56%p, 기습 5초 피해 +500%, 처치 시 기습 재발동 + 최대 체력 30% 회복'],
    member: (t) => {
      const ambush = T(t, [0.5, 1.1, 2.2, 5.0]), dur = t >= 4 ? 5 : 3;
      return {
        stats: { eva: T(t, [0.11, 0.18, 0.28, 0.42]), crit: T(t, [0.11, 0.21, 0.35, 0.56]) },
        hooks: {
          onStart(b, u) {
            const foes = b.enemiesOf(u);
            if (!foes.length) return;
            // 적 진영 가장 안쪽(아군에서 먼 쪽)의 적을 노린다
            const back = foes.slice().sort((a, c) => (u.side === 0 ? a.y - c.y : c.y - a.y))[0];
            if (blinkTo(b, u, back)) b.buff(u, u, 'infil.ambush', dur, { mods: [inc('all', ambush)], label: '기습' });
          },
          onKill: t >= 3 ? (b, u) => {
            b.buff(u, u, 'infil.ambush', dur, { mods: [inc('all', ambush)], label: '기습' });
            if (t >= 4) b.heal(u, u, b.S(u, 'maxHp') * 0.3, true);
          } : undefined,
        },
      };
    },
  },
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
    desc: '셰프의 전투 스킬은 요리입니다. 요리는 아군 1명을 회복시키거나 보호막을 주고 특수 버프를 겁니다. 단계가 오르면 요리 위력이 커집니다.',
    tierDesc: ['요리 위력 ×1.4', '요리 위력 ×2.1', '요리 위력 ×3.5, 모든 아군 최대 체력 +15%'],
    member: (t) => ({ setup: (u) => { u.mem.cook = CFG.cookPower[t]; } }),
    team: (t) => (t >= 3 ? { pct: { maxHp: 0.15 } } : null),
  },
  {
    id: 'ENG', name: '엔지니어', kind: 'trait', tiers: [2, 3, 4], color: '#a0b4c8', icon: '⚙',
    desc: '전투 시작 시 아군 진영 양옆 가장자리에 감시 포탑을 설치합니다. 포탑은 움직이지 않고, 출전한 엔지니어 능력치 평균의 일부를 물려받습니다. 칸을 차지하며, 빈칸이 없으면 설치되지 않습니다.',
    tierDesc: ['감시 포탑 1기 (상속 60%, 공격 속도 +40%)', '감시 포탑 2기 (상속 80%)', '감시 포탑 3기 (상속 120%), 포탑 공격 속도 추가 +50%'],
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
    id: 'SCHEME', name: '모략가', kind: 'trait', tiers: [2, 4, 6, 8], color: '#8a5cc8', icon: '♠',
    desc: '판 뒤에서 실을 당기는 이들. 모략가가 적에게 해로운 효과를 걸면 기본 75% 확률로 [암운]을 쌓습니다. [암운]은 1중첩당 매초 아군 전술 위력 비례 고정 피해를 줍니다 (최대 99중첩, 6초간 새로 쌓이지 않으면 사라짐).',
    tierDesc: ['효과 명중 +25%p, [암운] 1중첩당 초당 전술 위력 4%', '효과 명중 +50%p, 초당 전술 위력 8%, [암운]을 쌓을 때 50% 확률로 1중첩 추가',
      '효과 명중 +75%p, 초당 전술 위력 15%, 25% 확률로 2중첩 더 추가, 모략가의 공격이 [암운] 1중첩당 전술 위력 10% 고정 피해 추가',
      '[흑막 강림] 효과 명중 +100%p, 초당 전술 위력 30%, [암운] 쌓는 양 3배'],
    member: (t) => {
      const per = T(t, [0.04, 0.08, 0.15, 0.3]); // [암운] 1중첩 초당 피해 = 전술 위력 × per
      return {
        stats: { effHit: T(t, [0.25, 0.5, 0.75, 1.0]) },
        hooks: {
          onInflict(b, u, tgt, s) {
            if (tgt.side === u.side || !isHarmful(s) || s.key === 'gloom') return;
            if (!b.rng.chance(Math.min(1, 0.75 * (1 + b.S(u, 'effHit') - b.S(tgt, 'effRes'))))) return;
            let n = 1;
            if (t >= 2 && b.rng.chance(0.5)) n += 1;
            if (t >= 3 && b.rng.chance(0.25)) n += 2;
            if (t >= 4) n *= 3;
            addStacks(b, u, tgt, 'gloom', n, 99, 6, (k) => ({ type: 'dot', elem: 'true', dps: b.tacPower(u) * per * k }), '암운');
          },
          onDeal: t >= 3 ? (b, u, tgt, r, o) => {
            if ((o.tag !== 'basic' && o.tag !== 'skill') || r.amount <= 0 || !tgt.alive) return;
            const g = tgt.statuses.find((x) => x.key === 'gloom')?.stacks || 0;
            if (g) b.dealDamage(u, tgt, b.tacPower(u) * 0.1 * g, { elem: 'true', tag: 'proc' });
          } : undefined,
        },
      };
    },
  },
  {
    id: 'DECOMP', name: '분해자', kind: 'trait', tiers: [2, 4, 6, 8], color: '#9bd13a', icon: '☣',
    desc: '무엇이든 녹여 버리는 이들. 분해자가 기본 공격 · 기술로 적을 맞히면 자신 최대 체력 비례 화학 피해를 더하고, 반드시 [부식]을 쌓습니다. [부식] 1중첩당 대상이 받는 화학 피해 +10%p (8초).',
    tierDesc: ['화학 피해 +10%, 추가 화학 피해 = 최대 체력 5%, [부식] 최대 5중첩', '화학 피해 +25%, [부식] 최대 7중첩, [부식] 걸린 적을 공격하면 피해의 20% 회복',
      '화학 피해 +50%, 추가 화학 피해 10%, [부식] 최대 9중첩', '[완전 분해] 화학 피해 +100%, 추가 화학 피해 15%, [부식] 최대 13중첩'],
    member: (t) => {
      const extra = T(t, [0.05, 0.05, 0.1, 0.15]), max = T(t, [5, 7, 9, 13]);
      return {
        mods: [inc('chem', T(t, [0.1, 0.25, 0.5, 1.0]))],
        hooks: {
          onDeal(b, u, tgt, r, o) {
            if (r.amount <= 0 || o.tag === 'dot') return;
            if (t >= 2 && tgt.statuses.some((x) => x.key === 'decay')) b.heal(u, u, r.amount * 0.2, true);
            if ((o.tag !== 'basic' && o.tag !== 'skill') || !tgt.alive) return;
            b.dealDamage(u, tgt, b.S(u, 'maxHp') * extra, { elem: 'chem', tag: 'proc' });
            if (tgt.alive) addStacks(b, u, tgt, 'decay', 1, max, 8, (k) => ({ taken: [vuln('chem', 0.1 * k)] }), '부식');
          },
        },
      };
    },
  },
  {
    id: 'COND', name: '전도체', kind: 'trait', tiers: [2, 4, 6, 8], color: '#4fc3ff', icon: 'ϟ',
    desc: '몸에 전류가 흐르는 이들. 전도체가 기본 공격 · 기술로 적을 맞히면 25% 고정 확률로 주변 적에게 튀는 연쇄 전기 피해를 일으킵니다. 연쇄 1회 피해 = 사격 · 타격 · 기술 위력 중 가장 높은 값의 일정 비율.',
    tierDesc: ['전기 피해 +10%, 연쇄 1칸 · 최대 1회 · 계수 25%', '전기 피해 +25%, 연쇄 2칸 · 최대 2회, 명사수 · 지휘관 전도체 연쇄 +1회, 전문가 · 돌격가 전도체는 피격 시 50% 확률로 연쇄',
      '전기 피해 +50%, 연쇄 3칸 · 최대 4회 · 계수 35%', '[천둥 폭풍] 전기 피해 +100%, 연쇄 3칸 · 최대 8회 · 계수 70%'],
    member: (t) => {
      const radius = T(t, [1, 2, 3, 3]), k = T(t, [0.25, 0.25, 0.35, 0.7]);
      const hopsOf = (u: CUnit) => T(t, [1, 2, 4, 8]) + (t >= 2 && (u.ctype === 'MARK' || u.ctype === 'CMD') ? 1 : 0);
      return {
        mods: [inc('elec', T(t, [0.1, 0.25, 0.5, 1.0]))],
        hooks: {
          onDeal(b, u, tgt, r, o) {
            if ((o.tag !== 'basic' && o.tag !== 'skill') || r.amount <= 0 || !b.rng.chance(0.25)) return;
            chainBolt(b, u, tgt, hopsOf(u), radius, k, true);
          },
          onHurt: t >= 2 ? (b, u, src, _r, o) => {
            if (o.tag === 'dot' || o.tag === 'proc' || (u.ctype !== 'SPEC' && u.ctype !== 'VAN') || !src.alive || !b.rng.chance(0.5)) return;
            chainBolt(b, u, u, hopsOf(u), radius, k, false);
          } : undefined,
        },
      };
    },
  },
  {
    id: 'GUARD', name: '수호자', kind: 'trait', tiers: [2, 4, 6], color: '#c9a86a', icon: '⛉',
    desc: '앞에 서서 모두를 지키는 이들. 출전한 수호자 1명마다 모든 아군의 방어도가 오르고, 수호자의 기본 공격에는 자신 방어도에 비례한 물리 피해가 더해집니다.',
    tierDesc: ['수호자 1명당 모든 아군 방어도 +8%, 수호자 기본 공격 + 방어도 20% 물리 피해', '수호자 1명당 모든 아군 방어도 +16%, 수호자 기본 공격 + 방어도 35% 물리 피해', '[철벽 방진] 수호자 1명당 모든 아군 방어도 +30%, 수호자 기본 공격 + 방어도 50% 물리 피해'],
    team: (t, ctx) => ({ pct: { armor: (ctx.counts.GUARD || 0) * T(t, [0.08, 0.16, 0.3]) } }),
    member: (t) => {
      const k = T(t, [0.2, 0.35, 0.5]);
      return {
        hooks: {
          onBasic(b, u, tgt, r) {
            if (r.miss || !tgt.alive) return;
            b.dealDamage(u, tgt, b.S(u, 'armor') * k, { elem: 'phys', tag: 'proc', kind: 'strike' });
          },
        },
      };
    },
  },
  {
    id: 'EXPLORER', name: '탐험가', kind: 'trait', tiers: [1], color: '#e6d27a', icon: '⚓',
    desc: `아문센 전용. ${CFG.explorerPhase}페이즈 전에는 배치할 수 없습니다. 고유 전설 장비 [그늘]을 장착한 채 합류합니다 (해제 불가).`,
    tierDesc: ['[그늘]: 기술 쿨다운 감소 속도 +150%, 모든 아군 회피·치명타 확률 +14%p'],
  },
  {
    id: 'RFRIEND', name: '당신의 친구, R', kind: 'trait', tiers: [1], color: '#ff7aa8', icon: 'R',
    desc: '데미우르고스 전용. 출전한 시리우스 성도회 인원과 디바인 기물 1명당 데미우르고스의 모든 메이저 능력치 +1.',
    tierDesc: ['모든 메이저 +(성도회 인원 + 디바인 인원)'],
    member: (_t, ctx) => {
      const n = (ctx.counts.SIR || 0) + (ctx.run?.units.filter((x) => x.pos && UNIT_BY_ID[x.defId].ttype === 'divine').length || 0);
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

const fameOf = (ctx: EffectCtx) => ctx.run?.fame || 0;

export type { Battle, CUnit };

/** 항해자 에이스 파일럿: 지정한 항해자가 출전 중이면 그 기물, 아니면 공명 등급이 가장 높은 항해자 */
export function aceTargetUid(run: RunState): string | null {
  const dep = run.units.filter((u) => u.pos && UNIT_BY_ID[u.defId].traits.includes('NAV'));
  if (dep.some((u) => u.uid === run.aceTarget)) return run.aceTarget;
  return dep.slice().sort((a, b) => b.rank - a.rank)[0]?.uid ?? null;
}

/** 엔지니어 포탑 생성 (build.ts 에서 주입: 순환 import 방지) */
export const ENG_HOOK: { spawn?: (b: Battle, lead: CUnit, engs: CUnit[], n: number) => void } = {};
