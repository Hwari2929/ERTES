import type { Effect, EffectCtx } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { RunState, SynergyId } from '../types';
import type { EventApi } from './events';
import { CFG } from '../config';
import { emblemText } from './emblems';
import { skillHit } from './kit';
import { SYN_BY_ID, SYNERGIES, tierOf } from './synergies';

/** 문장 대상이 될 수 있는 시너지 (전용 독립 시너지 제외) */
export const EMBLEM_SYNS = SYNERGIES.filter((s) => s.tiers.length > 1).map((s) => s.id);
const pc = (x: number) => `${Math.round(x * 100)}%`;
const G = CFG.globalAug;
const active = (ctx: EffectCtx) => SYNERGIES.filter((s) => s.tiers.length > 1 && tierOf(s.id, ctx.counts[s.id] || 0) > 0);
const maxed = (ctx: EffectCtx) => SYNERGIES.filter((s) => s.tiers.length > 1 && tierOf(s.id, ctx.counts[s.id] || 0) === s.tiers.length);
export const synName = (id: string) => SYN_BY_ID[id as SynergyId]?.name || id;

/** 전역 증강: 런 시작 시 + 매 페이즈 시작마다 1개 선택.
 *  등급: 일반 · 희귀(R) · 전설(L). 선택지 한 장마다 GLOBAL_ODDS 확률로 희귀 · 전설 풀에서 뽑는다 (engine/run.ts rollGlobals).
 *  효과가 걸리는 곳: team = build.ts unitEffects · onPick = 고른 즉시 (api = 사건 api) · 나머지 id 는 run.ts 에서 hasGlobal 로 읽는다
 *    G.medic · G.salvage · G.r_bounty · G.l_stakes (resolveBattle) · G.discount (상점 가격) · G.l_petra (interestInfo · enterNode)
 *    G.l_ascend (deployCap) · G.l_stakes 적 피해 (build.ts buildEnemy) · G.l_double (pickGlobal) */
export type GlobalTier = 'R' | 'L';
export const GLOBAL_ODDS = { L: 0.03, R: 0.2 };
export const GLOBAL_TIER_NAME: Record<GlobalTier | 'N', string> = { N: '일반', R: '희귀', L: '전설' };
export interface GlobalDef {
  id: string;
  name: string;
  desc: string;
  /** 등급 (없으면 일반) */
  tier?: GlobalTier;
  /** 선택 즉시 1회 */
  onPick?: (run: RunState, api: EventApi) => void;
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
  { id: 'G.aim', name: '정밀 조준 프로토콜', desc: '모든 아군 명중 +10%p, 치명타 확률 +4%p.', team: { stats: { acc: 0.1, crit: 0.04 } } },
  { id: 'G.plate', name: '표준 강화 장갑', desc: '모든 아군 방어도 +200, 효과 저항 +10%p.', team: { stats: { armor: 200, effRes: 0.1 } } },
  { id: 'G.cooler', name: '쿨러 오버클럭', desc: '모든 아군 쿨다운 감소 속도 +20%.', team: { stats: { cdr: 0.2 } } },
  { id: 'G.survival', name: '생존 본능', desc: '최대 플레이어 체력 +30 (즉시 회복), 패배 시 피해량 경감 30%.', unique: true,
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
  { id: 'G.apex', name: '정점', desc: '최고 단계에 도달한 시너지 1개당 모든 아군 피해 +10%, 피해량 경감 5%.', unique: true,
    team: { setup: (u, _b, ctx) => { const n = maxed(ctx).length; if (n) { u.mods.push(inc('all', 0.1 * n)); u.taken.push(red('all', 0.05 * n)); } } } },
  { id: 'G.diverse', name: '다국적 편성', desc: '활성화된 세력 시너지가 3개 이상이면 모든 아군 피해량 경감 12%, 공격 속도 +10%.', unique: true,
    team: { setup: (u, _b, ctx) => { if (active(ctx).filter((s) => s.kind === 'faction').length >= 3) { u.taken.push(red('all', 0.12)); u.st.atkSpd += 0.1; } } } },
  { id: 'G.network', name: '인맥', desc: '영입 선택지 +1, 현재 파티와 시너지가 겹치는 기물이 더 자주 나옴.', unique: true },
  // ── 일반 (추가)
  { id: 'G.medic', name: '야전 의무대', desc: `전투에서 이길 때마다 플레이어 체력 +${G.medic}.`, unique: true },
  { id: 'G.salvage', name: '전리품 회수', desc: `전투 승리 보상 크레딧 +${G.salvage}.`, unique: true },
  { id: 'G.shieldwall', name: '전열 보호막', desc: `전투 시작 때 모든 아군에게 최대 체력 ${pc(G.shieldwall)} 보호막.`,
    team: { hooks: { onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * G.shieldwall); } } } },
  { id: 'G.tenacity', name: '불굴', desc: `체력이 ${pc(G.tenacityHp)} 이하인 아군은 피해량 경감 ${pc(G.tenacity)}.`, unique: true,
    team: { hooks: { takenMult: (b, u) => (u.hp <= b.S(u, 'maxHp') * G.tenacityHp ? 1 - G.tenacity : 1) } } },
  { id: 'G.discount', name: '단골 할인', desc: `상점 가격 -${pc(G.discount)} (반올림).`, unique: true },
  // ── 희귀 (선택지 한 장마다 20%)
  { id: 'G.r_glass', tier: 'R', name: '유리 대포', desc: `모든 아군 피해 +${pc(G.glassDmg)}, 받는 피해 +${pc(G.glassTaken)}.`, unique: true,
    team: { mods: [inc('all', G.glassDmg)], taken: [{ kind: 'vuln', tag: 'all', v: G.glassTaken }] } },
  { id: 'G.r_overtime', tier: 'R', name: '연장 수당', desc: `연장전(전투 ${CFG.overtimeStart}초 이후)에 모든 아군 피해 +${pc(G.overtime)}.`, unique: true,
    team: { hooks: { dmgMult: (b) => (b.t >= CFG.overtimeStart ? 1 + G.overtime : 1) } } },
  { id: 'G.r_blitz', tier: 'R', name: '기습 교리', desc: `전투 시작 후 ${G.blitzDur}초 동안 모든 아군 공격 속도 · 쿨다운 감소 속도 +${pc(G.blitz)}.`, unique: true,
    team: { hooks: { onStart(b, u) { b.buff(u, u, 'g.blitz', G.blitzDur, { delta: { atkSpd: G.blitz, cdr: G.blitz }, label: '기습' }); } } } },
  { id: 'G.r_vamp', tier: 'R', name: '흡혈 탄두', desc: `모든 아군 생명력 흡수 +${pc(G.vamp)}.`, unique: true, team: { stats: { lifesteal: G.vamp } } },
  { id: 'G.r_bounty', tier: 'R', name: '현상금 사냥', desc: `이긴 전투에서 처치한 적 1명당 크레딧 +1 (전투당 최대 ${G.bountyMax}).`, unique: true },
  { id: 'G.r_relic', tier: 'R', name: '고고학 발굴', desc: '즉시 무작위 희귀 장비 2개 획득.', onPick: (_r, api) => { for (let i = 0; i < 2; i++) api.gain(api.randomItem('A'), true); } },
  { id: 'G.r_mentor', tier: 'R', name: '사관 학교', desc: '즉시 보유 기물 전원 공명 등급 +1.', onPick: (r, api) => { for (const u of r.units) api.rankUp(u, 1); } },
  { id: 'G.r_bond', tier: 'R', name: '전쟁 채권', desc: `즉시 크레딧 +${G.bond}, 이자 상한 -${G.bondCap}.`, unique: true, onPick: (r) => { r.credits += G.bond; r.mods.interestCap -= G.bondCap; } },
  // ── 전설 (선택지 한 장마다 3%): 독특한 보상 · 위험한 판
  { id: 'G.l_stakes', tier: 'L', name: '판돈 올리기', desc: `모든 적이 주는 피해 +${pc(G.stakesFoe)}. 그 대신 전투 승리 크레딧 · 공명도 풀 ×${G.stakes}.`, unique: true },
  { id: 'G.l_blood', tier: 'L', name: '피로 쓴 수표', desc: `플레이어 체력을 1까지 깎고, 깎인 체력 ×${G.blood}만큼 크레딧을 받습니다.`,
    onPick: (r) => { const cut = Math.max(0, r.hp - 1); r.hp = 1; r.credits += cut * G.blood; } },
  { id: 'G.l_minky', tier: 'L', name: 'ZI존 밍키', desc: `[캣휠(ZI존)]을 단 밍키가 출전 평균 공명 등급 +${G.minkyRank}으로 합류합니다 (자리가 없으면 캣휠(ZI존)만).`, unique: true },
  { id: 'G.l_petra', tier: 'L', name: '페트라 직불 계약', desc: `이자 수입이 0이 됩니다. 그 대신 전투에 들어갈 때마다 출전 중인 페트라 시너지 기물 1명당 크레딧 +${G.petraPer}.`, unique: true },
  { id: 'G.l_ascend', tier: 'L', name: '승천 계약', desc: `즉시 보유 기물 전원 공명 등급 +${G.ascend}. 출전 인원은 영구히 -1.`, unique: true },
  { id: 'G.l_double', tier: 'L', name: '이중 계약', desc: '희귀 이상 전역 증강 2개를 무작위로 즉시 얻습니다 (고르지 않음).' },
  { id: 'G.l_last', tier: 'L', name: '마지막 출항', desc: `최대 플레이어 체력이 절반이 됩니다 (내림). 모든 아군 피해 +${pc(G.lastDmg)}, 피해량 경감 ${pc(G.lastRed)}.`, unique: true,
    onPick: (r) => { r.maxHp = Math.max(1, Math.floor(r.maxHp / 2)); r.hp = Math.min(r.hp, r.maxHp); },
    team: { mods: [inc('all', G.lastDmg)], taken: [red('all', G.lastRed)] } },
  { id: 'G.l_sacrifice', tier: 'L', name: '희생 제의', desc: `공명 등급이 가장 높은 기물 1명이 보상 없이 떠나고 (장비는 보관함으로), 남은 기물 전원 공명 등급 +${G.sacrifice}.` },
];

/** 특권 증강: 런 시작 시 1개 (새로고침 가능) */
export interface PrivilegeDef { id: string; name: (param?: string) => string; desc: (param?: string) => string; w: number }
export const PRIVILEGES: PrivilegeDef[] = [
  { id: 'P.emblem', w: 4, name: (p) => `${synName(p!)} 문장`, desc: (p) => `[개조부품] ${synName(p!)} 문장 획득. 장착한 기물이 ${synName(p!)} 시너지에 추가로 소속됩니다.${emblemText(p as SynergyId) ? ` ${emblemText(p as SynergyId)}` : ''}` },
  { id: 'P.recruit', w: 1, name: () => '추가 계약', desc: () => '기물 3명 중 1명을 즉시 영입.' },
  { id: 'P.rank', w: 1, name: () => '베테랑 편성', desc: () => '시작 기물 전원 공명 등급 +2.' },
  { id: 'P.global', w: 1, name: () => '작전 재량', desc: () => '전역 증강을 1개 더 선택.' },
  { id: 'P.funds', w: 1, name: () => '후원금', desc: () => '즉시 에너지 크레딧 +40.' },
  { id: 'P.hp', w: 1, name: () => '보험 가입', desc: () => '최대 플레이어 체력 +40 (즉시 회복).' },
  { id: 'P.relic', w: 1, name: () => '유산', desc: () => '무작위 희귀 장비 2개 획득.' },
  { id: 'P.supply', w: 1, name: () => '보급 상자', desc: () => '무작위 소모품 3개 획득.' },
  { id: 'P.trust', w: 1, name: () => '신탁 계좌', desc: () => '이자 상한 +3, 즉시 에너지 크레딧 +15.' },
  { id: 'P.scout', w: 1, name: () => '스카우트 리포트', desc: () => '기물 5명 중 1명을 즉시 영입.' },
  { id: 'P.gamble', w: 0.6, name: () => '도박사의 출항', desc: () => '즉시 에너지 크레딧 +90, 최대 플레이어 체력 -25.' },
  { id: 'P.rare', w: 0.5, name: () => '고급 작전 재량', desc: () => '희귀 이상 전역 증강 3개 중 1개를 선택.' },
  { id: 'P.legend', w: 0.25, name: () => '전설의 시작', desc: () => '무작위 전설 장비 1개 획득.' },
];
export const PRIVILEGE_BY_ID: Record<string, PrivilegeDef> = Object.fromEntries(PRIVILEGES.map((p) => [p.id, p]));
export const GLOBAL_BY_ID: Record<string, GlobalDef> = Object.fromEntries(GLOBALS.map((g) => [g.id, g]));

/** 성직자 순례 노드 축복: 이번 페이즈 동안 모든 아군에게 */
export interface BlessingDef { id: string; name: string; desc: string; team?: Effect; onPick?: (run: RunState) => void }
export const BLESSINGS: BlessingDef[] = [
  { id: 'B.martyr', name: '순교자의 가호', desc: '이번 페이즈 모든 아군 최대 체력 +20%.', team: { pct: { maxHp: 0.2 } } },
  { id: 'B.flame', name: '성전의 불꽃', desc: '이번 페이즈 모든 아군 기본 공격에 기술 위력 25% 신성 추가 피해.',
    team: { hooks: { onBasic(b, u, t, r) { if (!r.miss && t.alive) skillHit(b, u, t, 'tech', 0.25, 'holy', { tag: 'proc', noMiss: true }); } } } },
  { id: 'B.sanctum', name: '성소의 빛', desc: '이번 페이즈 전투 시작 시 모든 아군 최대 체력 15% 보호막.',
    team: { hooks: { onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.15); } } } },
  { id: 'B.zeal', name: '광신', desc: '이번 페이즈 모든 아군 공격 속도 +25%, 받는 피해 +10%.',
    team: { stats: { atkSpd: 0.25 }, taken: [{ kind: 'vuln', tag: 'all', v: 0.1 }] } },
];
export const BLESSING_BY_ID: Record<string, BlessingDef> = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));
