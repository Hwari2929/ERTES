import type { Effect, EffectCtx } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { RunState, SynergyId } from '../types';
import { skillHit } from './kit';
import { SYN_BY_ID, SYNERGIES, tierOf } from './synergies';

/** 문장 대상이 될 수 있는 시너지 (전용 독립 시너지 제외) */
export const EMBLEM_SYNS = SYNERGIES.filter((s) => s.tiers.length > 1).map((s) => s.id);
const active = (ctx: EffectCtx) => SYNERGIES.filter((s) => s.tiers.length > 1 && tierOf(s.id, ctx.counts[s.id] || 0) > 0);
const maxed = (ctx: EffectCtx) => SYNERGIES.filter((s) => s.tiers.length > 1 && tierOf(s.id, ctx.counts[s.id] || 0) === s.tiers.length);
export const synName = (id: string) => SYN_BY_ID[id as SynergyId]?.name || id;

/** 전역 증강: 런 시작 시 + n 페이즈마다 1개 선택 */
export interface GlobalDef {
  id: string;
  name: string;
  desc: string;
  /** 선택 즉시 1회 */
  onPick?: (run: RunState) => void;
  /** 모든 출전 아군에게 */
  team?: Effect;
  unique?: boolean;
}

export const GLOBALS: GlobalDef[] = [
  { id: 'G.funds', name: '전투 자금', desc: '즉시 에너지 크레딧 +25.', onPick: (r) => { r.credits += 25; } },
  { id: 'G.resonance', name: '고속 공명', desc: '전투 후 공명도 풀 +35%.', unique: true },
  { id: 'G.interest', name: '복리의 마법', desc: '이자 상한 +5.', unique: true },
  { id: 'G.armory', name: '무기고 개방', desc: '즉시 무작위 장비 재료 2개 획득.' },
  { id: 'G.squad', name: '대규모 편성', desc: '출전 인원 +1.', unique: true },
  { id: 'G.aim', name: '정밀 조준 프로토콜', desc: '모든 아군 명중 +10%p, 치명타 확률 +8%p.', team: { stats: { acc: 0.1, crit: 0.08 } } },
  { id: 'G.plate', name: '표준 강화 장갑', desc: '모든 아군 방어도 +200, 효과 저항 +10%p.', team: { stats: { armor: 200, effRes: 0.1 } } },
  { id: 'G.cooler', name: '쿨러 오버클럭', desc: '모든 아군 쿨다운 감소 속도 +20%.', team: { stats: { cdr: 0.2 } } },
  { id: 'G.survival', name: '생존 본능', desc: '최대 플레이어 체력 +30 (즉시 회복), 패배 시 받는 피해 -30%.', unique: true,
    onPick: (r) => { r.maxHp += 30; r.hp += 30; } },
  { id: 'G.study', name: '학습 곡선', desc: '공명도 구매 비용 -1, 구매량 +1.', unique: true },
  { id: 'G.scout', name: '인재 스카우트', desc: '영입 노드 선택지 +1, 영입 기물이 공명 등급 +1로 합류.', unique: true },
  { id: 'G.allin', name: '올인', desc: '모든 아군 피해 +20%, 최대 체력 -10%.', team: { mods: [{ kind: 'inc', tag: 'all', v: 0.2 }], pct: { maxHp: -0.1 } } },
  // ── 시너지 관련
  { id: 'G.emblem', name: '문장 수여', desc: '출전 중인 시너지 중 무작위 1개의 문장 개조부품 획득 (중첩 가능).' },
  { id: 'G.faction', name: '연합 협정', desc: '출전 인원이 가장 많은 세력 +1pt.', unique: true },
  { id: 'G.trait', name: '전술 교범', desc: '출전 인원이 가장 많은 특성 +1pt.', unique: true },
  { id: 'G.bond', name: '결속', desc: '활성화된 시너지 1개당 모든 아군 피해 +3%.', unique: true,
    team: { setup: (u, _b, ctx) => { u.mods.push(inc('all', 0.03 * active(ctx).length)); } } },
  { id: 'G.apex', name: '정점', desc: '최고 단계에 도달한 시너지 1개당 모든 아군 피해 +10%, 받는 피해 -5%.', unique: true,
    team: { setup: (u, _b, ctx) => { const n = maxed(ctx).length; if (n) { u.mods.push(inc('all', 0.1 * n)); u.taken.push(red('all', 0.05 * n)); } } } },
  { id: 'G.diverse', name: '다국적 편성', desc: '활성화된 세력 시너지가 3개 이상이면 모든 아군 받는 피해 -12%, 공격 속도 +10%.', unique: true,
    team: { setup: (u, _b, ctx) => { if (active(ctx).filter((s) => s.kind === 'faction').length >= 3) { u.taken.push(red('all', 0.12)); u.st.atkSpd += 0.1; } } } },
  { id: 'G.network', name: '인맥', desc: '영입 선택지 +1, 현재 파티와 시너지가 겹치는 기물이 더 자주 나옴.', unique: true },
];

/** 특권 증강: 런 시작 시 1개 (새로고침 가능) */
export interface PrivilegeDef { id: string; name: (param?: string) => string; desc: (param?: string) => string; w: number }
export const PRIVILEGES: PrivilegeDef[] = [
  { id: 'P.emblem', w: 4, name: (p) => `${synName(p!)} 문장`, desc: (p) => `[개조부품] ${synName(p!)} 문장 획득. 장착한 기물이 ${synName(p!)} 시너지에 추가로 소속됩니다.` },
  { id: 'P.recruit', w: 1, name: () => '추가 계약', desc: () => '기물 3명 중 1명을 즉시 영입.' },
  { id: 'P.legend', w: 1, name: () => '가보', desc: () => '전설 장비 3개 중 1개 선택.' },
  { id: 'P.rank', w: 1, name: () => '베테랑 편성', desc: () => '시작 기물 전원 공명 등급 +2.' },
  { id: 'P.global', w: 1, name: () => '작전 재량', desc: () => '전역 증강을 1개 더 선택.' },
  { id: 'P.funds', w: 1, name: () => '후원금', desc: () => '즉시 에너지 크레딧 +40.' },
  { id: 'P.hp', w: 1, name: () => '보험 가입', desc: () => '최대 플레이어 체력 +40 (즉시 회복).' },
];
export const PRIVILEGE_BY_ID: Record<string, PrivilegeDef> = Object.fromEntries(PRIVILEGES.map((p) => [p.id, p]));
export const GLOBAL_BY_ID: Record<string, GlobalDef> = Object.fromEntries(GLOBALS.map((g) => [g.id, g]));

/** 성직자 순례 노드 축복: 이번 페이즈 동안 모든 아군에게 */
export interface BlessingDef { id: string; name: string; desc: string; team?: Effect; onPick?: (run: RunState) => void }
export const BLESSINGS: BlessingDef[] = [
  { id: 'B.martyr', name: '순교자의 가호', desc: '이번 페이즈 모든 아군 최대 체력 +20%.', team: { pct: { maxHp: 0.2 } } },
  { id: 'B.flame', name: '성전의 불꽃', desc: '이번 페이즈 모든 아군 기본 공격에 기술 위력 25% 신성 추가 피해.',
    team: { hooks: { onBasic(b, u, t, r) { if (!r.miss && t.alive) skillHit(b, u, t, 'tech', 0.25, 'holy', { tag: 'proc', noMiss: true }); } } } },
  { id: 'B.sanctum', name: '성소의 빛', desc: '이번 페이즈 전투 시작 시 모든 아군 최대 체력 25% 보호막.',
    team: { hooks: { onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.25); } } } },
  { id: 'B.zeal', name: '광신', desc: '이번 페이즈 모든 아군 공격 속도 +25%, 받는 피해 +10%.',
    team: { stats: { atkSpd: 0.25 }, taken: [{ kind: 'vuln', tag: 'all', v: 0.1 }] } },
  { id: 'B.prayer', name: '깊은 기도', desc: '즉시 신앙 +6.', onPick: (r) => { r.faith += 6; } },
  { id: 'B.tithe', name: '헌금', desc: '즉시 에너지 크레딧 +15.', onPick: (r) => { r.credits += 15; } },
];
export const BLESSING_BY_ID: Record<string, BlessingDef> = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));
