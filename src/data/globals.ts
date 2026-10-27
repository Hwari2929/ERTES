import type { Effect, EffectCtx } from '../engine/effects';
import type { Battle, CUnit } from '../engine/combat';
import { inc, red } from '../engine/effects';
import type { RunState, SynergyId } from '../types';
import type { EventApi } from './events';
import { CFG } from '../config';
import { emblemText } from './emblems';
import { skillHit } from './kit';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED } from './items';
import { SYN_BY_ID, SYNERGIES, tierOf } from './synergies';

/** 문장 대상이 될 수 있는 시너지 (전용 독립 시너지 제외) */
export const EMBLEM_SYNS = SYNERGIES.filter((s) => s.tiers.length > 1).map((s) => s.id);
const pc = (x: number) => `${Math.round(x * 100)}%`;
const G = CFG.globalAug;
const active = (ctx: EffectCtx) => SYNERGIES.filter((s) => s.tiers.length > 1 && tierOf(s.id, ctx.counts[s.id] || 0) > 0);
const maxed = (ctx: EffectCtx) => SYNERGIES.filter((s) => s.tiers.length > 1 && tierOf(s.id, ctx.counts[s.id] || 0) === s.tiers.length);
export const synName = (id: string) => SYN_BY_ID[id as SynergyId]?.name || id;
const FOREVER = 9999;
/** 표적 지정 (G.aim): 살아 있는 표적이 없으면 남은 적 중 최대 체력이 가장 높은 적에게 표적 (받는 피해 +mark, 저항 없이) */
function markNext(b: Battle, u: CUnit) {
  const es = b.enemiesOf(u);
  if (es.some((e) => e.statuses.some((s) => s.key === 'g.mark'))) return;
  const t = es.filter((e) => !e.mem.wall).sort((x, y) => b.S(y, 'maxHp') - b.S(x, 'maxHp'))[0];
  if (t) b.applyStatus(u, t, { type: 'buff', key: 'g.mark', dur: FOREVER, taken: [{ kind: 'vuln', tag: 'all', v: G.mark }], label: '표적' }, 99);
}

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
  { id: 'G.funds', name: '포인트 적립', desc: `상점에서 크레딧을 ${G.pointPer} 쓸 때마다 공명도 1을 파티에 분배합니다.`, unique: true },
  { id: 'G.resonance', name: '고속 공명', desc: '전투 후 공명도 풀 +35%.', unique: true },
  { id: 'G.interest', name: '복리의 마법', desc: '이자 상한 +5.', unique: true },
  { id: 'G.squad', tier: 'R', name: '대규모 편성', desc: '출전 인원 +1.', unique: true },
  { id: 'G.aim', name: '표적 지정', desc: `전투가 시작되면 최대 체력이 가장 높은 적이 표적이 됩니다. 표적이 받는 피해 +${pc(G.mark)}. 표적이 쓰러지면 남은 적 중 최대 체력이 가장 높은 적에게 옮겨 갑니다.`, unique: true,
    team: { hooks: { onStart(b, u) { markNext(b, u); }, onAnyDeath(b, u, dead) { if (dead.statuses.some((s) => s.key === 'g.mark')) markNext(b, u); } } } },
  { id: 'G.plate', name: '장갑 공유', desc: `전투가 시작되면 방어도가 가장 높은 아군 방어도의 ${pc(G.armorShare)}를 다른 모든 아군이 얻습니다.`, unique: true,
    team: { hooks: { onStart(b, u) { const top = b.alliesOf(u).filter((a) => !a.isSummon).sort((x, y) => b.S(y, 'armor') - b.S(x, 'armor'))[0]; if (top && top !== u) b.buff(u, u, 'g.plate', FOREVER, { delta: { armor: b.S(top, 'armor') * G.armorShare }, label: '장갑 공유' }); } } } },
  { id: 'G.cooler', name: '연속 처형', desc: `전투 스킬로 적을 처치하면 그 스킬의 쿨다운이 바로 돌아옵니다 (기물마다 ${G.killCdIcd}초에 1번).`, unique: true,
    team: { hooks: { onDeal(b, u, _t, r, o) { if (r.killed && o.tag === 'skill' && u.skill && (u.mem.gKillCd ?? -99) + G.killCdIcd <= b.t) { u.mem.gKillCd = b.t; u.cd = 0; } } } } },
  { id: 'G.survival', name: '생존 본능', desc: '최대 플레이어 체력 +30 (즉시 회복), 패배 시 피해량 경감 30%.', unique: true,
    onPick: (r) => { r.maxHp += 30; r.hp += 30; } },
  { id: 'G.study', name: '학습 곡선', desc: '공명도 구매 비용 -1, 구매량 +1.', unique: true },
  { id: 'G.scout', name: '인재 스카우트', desc: '영입 노드 선택지 +1, 현재 파티와 시너지가 겹치는 기물이 더 자주 나오고, 영입 기물이 공명 등급 +1로 합류.', unique: true },
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
  // ── 일반 (추가)
  { id: 'G.medic', name: '재기 수당', desc: `전투에서 지면 잃은 플레이어 체력의 ${pc(G.comeback)}를 다음 승리 때 돌려받습니다.`, unique: true },
  { id: 'G.salvage', name: '잔돈 영업', desc: `이자 상한 -${G.nodeCap}. 노드를 지날 때마다 크레딧 +${G.nodeCredit}.`, unique: true },
  { id: 'G.shieldwall', name: '최후의 방벽', desc: `아군이 처음 쓰러지면 남은 아군 전원에게 최대 체력 ${pc(G.lastWall)} 보호막.`, unique: true,
    team: { hooks: { onAllyDeath(b, u, dead) { if (dead === u || dead.isSummon || u.mem.gLastWall || !u.alive) return; u.mem.gLastWall = 1; b.shield(u, b.S(u, 'maxHp') * G.lastWall); } } } },
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
  { id: 'G.r_vamp', tier: 'R', name: '흡혈 탄두', desc: `적을 처치하면 최대 체력 ${pc(G.vampKill)} 회복하고, 그 전투 동안 생명력 흡수 +${pc(G.vamp)} (처치마다 중첩, 최대 +${pc(G.vamp * G.vampMax)}).`, unique: true,
    team: { hooks: { onKill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * G.vampKill, true); u.mem.gVamp = Math.min(G.vampMax, (u.mem.gVamp || 0) + 1); b.buff(u, u, 'g.vamp', FOREVER, { delta: { lifesteal: G.vamp * u.mem.gVamp }, label: '흡혈 탄두' }); } } } },
  { id: 'G.r_bounty', tier: 'R', name: '현상금 사냥', desc: `이긴 전투에서 처치한 적 1명당 크레딧 +1 (전투당 최대 ${G.bountyMax}).`, unique: true },
  { id: 'G.r_relic', tier: 'R', name: '고고학 발굴', desc: '즉시 무작위 희귀 장비 2개 획득.', onPick: (_r, api) => { for (let i = 0; i < 2; i++) api.gain(api.randomItem('A'), true); } },
  { id: 'G.r_mentor', tier: 'R', name: '사관 학교', desc: '즉시 보유 기물 전원 공명 등급 +1.', onPick: (r, api) => { for (const u of r.units) api.rankUp(u, 1); } },
  { id: 'G.r_bond', tier: 'R', name: '전쟁 채권', desc: `즉시 크레딧 +${G.bond}, 이자 상한 -${G.bondCap}.`, unique: true, onPick: (r) => { r.credits += G.bond; r.mods.interestCap -= G.bondCap; } },
  // ── 전설 (선택지 한 장마다 3%): 독특한 보상 · 위험한 판
  { id: 'G.l_stakes', tier: 'L', name: '판돈 올리기', desc: `모든 적이 주는 피해 +${pc(G.stakesFoe)}. 그 대신 전투 승리 크레딧 · 공명도 풀 ×${G.stakes}.`, unique: true },
  { id: 'G.l_blood', tier: 'L', name: '피로 쓴 수표', desc: `플레이어 체력을 1까지 깎고, 깎인 체력 ×${G.blood}만큼 크레딧을 받습니다.`,
    onPick: (r) => { const cut = Math.max(0, r.hp - 1); r.hp = 1; r.credits += cut * G.blood; } },
  { id: 'G.l_minky', tier: 'L', name: 'ZI존 밍키', desc: `[캣휠(ZI존)]을 단 밍키가 출전 평균 공명 등급 +${G.minkyRank}으로 합류합니다 (자리가 없으면 캣휠(ZI존)만).`, unique: true },
  { id: 'G.l_amundsen', tier: 'L', name: '단장과 반려 돌', desc: '공명 등급 1의 아문센이 [단장의 반려 돌]과 함께 합류합니다. 반려 돌은 시너지가 없고 싸우지 않으며, 늘 출전해 출전 칸 하나를 차지합니다 (보유 한도가 모자라면 들어갈 수 있는 만큼, 이미 있는 쪽은 빠집니다).', unique: true },
  { id: 'G.l_petra', tier: 'L', name: '페트라 직불 계약', desc: `이자 수입이 0이 됩니다. 그 대신 전투에 들어갈 때마다 출전 중인 페트라 시너지 기물 1명당 크레딧 +${G.petraPer}.`, unique: true },
  { id: 'G.l_ascend', tier: 'L', name: '승천 계약', desc: `즉시 보유 기물 전원 공명 등급 +${G.ascend}. 출전 인원은 영구히 -1.`, unique: true },
  { id: 'G.l_double', tier: 'L', name: '이중 계약', desc: '희귀 이상 전역 증강 2개를 무작위로 즉시 얻습니다 (고르지 않음).' },
  { id: 'G.l_last', tier: 'L', name: '마지막 출항', desc: `최대 플레이어 체력이 절반이 됩니다 (내림). 모든 아군 피해 +${pc(G.lastDmg)}, 피해량 경감 ${pc(G.lastRed)}.`, unique: true,
    onPick: (r) => { r.maxHp = Math.max(1, Math.floor(r.maxHp / 2)); r.hp = Math.min(r.hp, r.maxHp); },
    team: { mods: [inc('all', G.lastDmg)], taken: [red('all', G.lastRed)] } },
  // ── 2차 확장 (일반 12 · 희귀 10 · 전설 8)
  { id: 'G.firstshot', name: '선제 사격', desc: `전투 시작 때 모든 아군 기술 쿨다운 -${G.firstShot}초.`, unique: true,
    team: { hooks: { onStart(_b, u) { u.cd = Math.max(0, u.cd - G.firstShot); } } } },
  { id: 'G.regen', name: '마무리 흡수', desc: `피니쉬(연타 무기의 마무리 타격)가 자신 최대 체력의 ${pc(G.finishHp)}만큼 추가 고정 피해를 주고, 준 고정 피해만큼 회복합니다.`, unique: true,
    team: { hooks: { onBasic(b, u, t, r) { if (!u.mem.finished || r.miss || !t.alive) return; const x = b.dealDamage(u, t, b.S(u, 'maxHp') * G.finishHp, { elem: 'true', tag: 'proc', noHooks: true }); if (x.amount > 0) b.heal(u, u, x.amount, true); } } } },
  { id: 'G.fiber', name: '과잉 회복 전환', desc: `넘친 회복의 ${pc(G.overheal)}를 보호막으로 바꿉니다 (보호막은 최대 체력 ${pc(G.overhealCap)}까지).`, unique: true,
    team: { hooks: { onHealDone(b, _u, t, _a, over) { if (over > 0 && t.alive) b.shield(t, Math.max(0, Math.min(over * G.overheal, b.S(t, 'maxHp') * G.overhealCap - t.shield))); } } } },
  { id: 'G.focus', name: '약점 연산', desc: `비물리(전기 · 화학 · 정신 · 신성) 공격도 치명타가 터질 수 있습니다. 이 치명타의 피해는 ${pc(G.npCritDmg)}로 고정됩니다.`, unique: true,
    team: { setup: (u) => { u.mem.npCrit = 1; } } },
  { id: 'G.pierce', name: '장갑 부식', desc: `아군 공격이 적중할 때마다 대상 방어도 -${pc(G.corrode)} (그 전투 동안, 최대 -${pc(G.corrodeMax)}).`, unique: true,
    team: { hooks: { onDeal(_b, _u, t, r) { if (r.amount > 0 && !r.miss) t.mem.corrode = Math.min(G.corrodeMax, (t.mem.corrode || 0) + G.corrode); } } } },
  { id: 'G.reload', name: '탄피 회수', desc: `결정타를 가하면 탄창 용량의 ${pc(G.ammoKill)}만큼 즉시 장전하며, 이 방법으로 탄창 용량의 ${pc(G.ammoCap)}까지 초과 장전할 수 있습니다 (탄창 무기).`, unique: true,
    team: { hooks: { onKill(_b, u) { const m = u.weapon?.kind === 'mag' ? u.weapon.mag || 1 : 0; if (!m) return; u.ammo = Math.min(m * G.ammoCap, Math.max(0, u.ammo) + Math.ceil(m * G.ammoKill)); if (u.reloadT > 0) u.reloadT = 0; } } } },
  { id: 'G.amp', name: '공명 연쇄', desc: `아군이 궁극기를 쓰면 다른 모든 아군의 궁극기 게이지 +${pc(G.ultChain)}.`, unique: true,
    team: { hooks: { onAllyUlt(_b, u) { if (u.ult) u.ultG = Math.min(1, (u.ultG || 0) + G.ultChain); } } } },
  { id: 'G.evade', name: '역습 태세', desc: `회피하면 다음 기본 공격의 피해 +${pc(G.riposte)}.`, unique: true,
    team: { hooks: { onEvade(_b, u) { u.mem.gRiposte = 1; }, dmgMult: (_b, u, _t, o) => (o.tag === 'basic' && u.mem.gRiposte ? 1 + G.riposte : 1), onBasic(_b, u) { u.mem.gRiposte = 0; } } } },
  { id: 'G.mind', name: '정화 반응', desc: `적이 건 해로운 효과를 받으면 최대 체력 ${pc(G.cleanse)} 보호막 (기물마다 ${G.cleanseIcd}초에 1번).`, unique: true,
    team: { hooks: { onAfflicted(b, u) { if ((u.mem.gCleanse ?? -99) + G.cleanseIcd > b.t) return; u.mem.gCleanse = b.t; b.shield(u, b.S(u, 'maxHp') * G.cleanse); } } } },
  { id: 'G.scrap', name: '분해 작업대', desc: `즉시 무작위 장비 재료 ${G.scrapN}개. 재구성 회로를 희귀 · 고급 장비 1개에 쓰면 장비를 조합 재료로 분해하고, 성운 가루 1개를 더 얻습니다.`, unique: true },
  { id: 'G.ration', name: '전투 식량', desc: `즉시 플레이어 체력 +${G.ration} (최대치까지), 최대 플레이어 체력 +${G.rationMax}.`,
    onPick: (r) => { r.maxHp += G.rationMax; r.hp = Math.min(r.maxHp, r.hp + G.ration); } },
  { id: 'G.r_chain', tier: 'R', name: '연쇄 반응', desc: `아군이 적을 처치하면 주변 1칸 적에게 기술 위력 ${pc(G.chain)} 전기 피해.`, unique: true,
    team: { hooks: { onKill(b, u, t) { for (const e of b.around(t, 1, b.enemiesOf(u))) skillHit(b, u, e, 'tech', G.chain, 'elec', { tag: 'proc', noMiss: true }); } } } },
  { id: 'G.r_thorns', tier: 'R', name: '가시 장갑', desc: `기본 공격을 받으면 공격자에게 자신 방어도의 ${pc(G.thorns)}만큼 고정 피해.`, unique: true,
    team: { hooks: { onHurt(b, u, src, r, o) { if (o.tag === 'basic' && src.alive && r.amount > 0) b.dealDamage(u, src, b.S(u, 'armor') * G.thorns, { elem: 'true', tag: 'proc', noHooks: true }); } } } },
  { id: 'G.r_wind', tier: 'R', name: '두 번째 바람', desc: `전투마다 아군마다 1회, 체력이 처음 ${pc(G.windAt)} 아래로 떨어지면 최대 체력 ${pc(G.wind)} 회복.`, unique: true,
    team: { hooks: { onHurt(b, u) { if (!u.mem.gWind && u.alive && u.hp < b.S(u, 'maxHp') * G.windAt) { u.mem.gWind = 1; b.heal(u, u, b.S(u, 'maxHp') * G.wind); } } } } },
  { id: 'G.r_execute', tier: 'R', name: '처형 규약', desc: `체력 ${pc(G.execAt)} 이하인 적에게 주는 피해 +${pc(G.exec)}.`, unique: true,
    team: { hooks: { dmgMult: (b, _u, t) => (t.hp <= b.S(t, 'maxHp') * G.execAt ? 1 + G.exec : 1) } } },
  { id: 'G.r_giant', tier: 'R', name: '거인 사냥', desc: `보스 · 정예에게 주는 피해 +${pc(G.giant)}.`, unique: true,
    team: { hooks: { dmgMult: (_b, _u, t) => (t.isBoss || t.elite ? 1 + G.giant : 1) } } },
  { id: 'G.r_double', tier: 'R', name: '이중 장전', desc: `기본 공격이 ${pc(G.dblChance)} 확률로 같은 대상에게 그 피해의 ${pc(G.dbl)}를 한 번 더 줍니다.`, unique: true,
    team: { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive && b.rng.chance(G.dblChance)) b.dealDamage(u, t, r.amount * G.dbl, { elem: u.atk.elem, tag: 'proc', kind: u.atk.type, canMiss: false }); } } } },
  { id: 'G.r_patron', tier: 'R', name: '투기 자금', desc: `고를 때와 페이즈가 시작될 때마다 보유 크레딧의 ${pc(G.spec)}를 투자하고, 다음 페이즈가 시작될 때 ×${G.specMin}~×${G.specMax} (무작위)로 돌려받습니다.`, unique: true },
  { id: 'G.r_tutor', tier: 'R', name: '집중 육성', desc: `즉시 공명 등급이 가장 낮은 기물 2명의 공명 등급 +${G.tutor}.`,
    onPick: (r, api) => { for (const u of r.units.slice().sort((a, b) => a.rank - b.rank).slice(0, 2)) api.rankUp(u, G.tutor); } },
  { id: 'G.r_solvent', tier: 'R', name: '용제 밀수', desc: `분리 용제 +${G.solventN}. 분리 용제를 적에게도 쓸 수 있다 (장비를 녹여 없앰).`, unique: true,
    onPick: (_r, api) => { for (let i = 0; i < G.solventN; i++) api.gain('K_strip', true); } },
  { id: 'G.l_overhaul', tier: 'L', name: '전면 재조달', desc: `고급 장비 +1. 가진 장비를 모두 다시 뽑는다 (하나마다 ${pc(G.overhaulUp)} 확률로 한 등급 위). 고유 · 동맹 · 포탑 장비 · 개조부품 제외.`, unique: true,
    onPick: (_r, api) => {
      for (const x of api.allItems()) {
        // 등급: 부품 0 · 고급 / 희귀 1 · 전설 2 (전설은 희귀 조합의 전설판만 — 동맹 · 고유 장비 등은 그대로)
        const tier = ALL_COMPONENTS.includes(x.id) ? 0 : ALL_GRADED.includes(x.id) || ALL_ADVANCED.includes(x.id) ? 1 : /^L_/.test(x.id) && ALL_ADVANCED.includes('A_' + x.id.slice(2)) ? 2 : -1;
        if (tier < 0) continue;
        const up = tier < 2 && api.chance(G.overhaulUp) ? tier + 1 : tier;
        api.setItem(x, api.randomItem((['C', api.chance(0.5) ? 'G' : 'A', 'L'] as const)[up]));
      }
      api.gain(api.randomItem('G'), true);
    } },
  { id: 'G.r_commission', tier: 'R', name: '전설 의뢰품', desc: `즉시 무작위 전설 장비 1개. 크레딧 -${G.commission} (0 아래로는 내려가지 않음).`,
    onPick: (r, api) => { api.gain(api.randomItem('L'), true); r.credits = Math.max(0, r.credits - G.commission); } },
  { id: 'G.r_transfuse', tier: 'R', name: '응급 수혈', desc: `최대 플레이어 체력 +${G.transfuse}, 즉시 체력을 모두 회복.`,
    onPick: (r) => { r.maxHp += G.transfuse; r.hp = r.maxHp; } },
  { id: 'G.l_berserk', tier: 'L', name: '광전사 계약', desc: `아군이 잃은 체력 1%당 주는 피해 +1% (최대 +${pc(G.berserkMax)}). 모든 아군 최대 체력 -${pc(G.berserkHp)}.`, unique: true,
    team: { pct: { maxHp: -G.berserkHp }, hooks: { dmgMult: (b, u) => 1 + Math.min(G.berserkMax, 1 - u.hp / b.S(u, 'maxHp')) } } },
  { id: 'G.l_goldrush', tier: 'L', name: '골드 러시', desc: `전투에 들어갈 때 크레딧이 ${G.goldAt} 이상이면 모든 아군 피해 +${pc(G.gold)}. 이자 상한 -${G.goldCap}.`, unique: true,
    onPick: (r) => { r.mods.interestCap -= G.goldCap; },
    team: { hooks: { dmgMult: (b) => ((b.ctx.credits || 0) >= G.goldAt ? 1 + G.gold : 1) } } },
  { id: 'G.l_overdrive', tier: 'L', name: '과부하 구동', desc: `전투 ${G.odAt}초부터 모든 아군 피해 +${pc(G.od)}, 공격 속도 +${pc(G.odAs)}. 그 전까지는 공격 속도 -${pc(G.odSlow)}.`, unique: true,
    team: { hooks: { onStart(b, u) { b.buff(u, u, 'g.odslow', G.odAt, { delta: { atkSpd: -G.odSlow }, label: '과부하 대기' }); },
      onTick(b, u) { if (!u.mem.gOd && b.t >= G.odAt) { u.mem.gOd = 1; b.buff(u, u, 'g.od', 999, { delta: { atkSpd: G.odAs }, label: '과부하' }); } },
      dmgMult: (b) => (b.t >= G.odAt ? 1 + G.od : 1) } } },
  { id: 'G.l_hydra', tier: 'L', name: '히드라 계약', desc: `아군이 쓰러질 때마다 남은 아군 피해 +${pc(G.hydra)} (그 전투 동안 중첩).`, unique: true,
    team: { hooks: { onAllyDeath(b, u, dead) { if (dead !== u && !dead.isSummon) { u.mem.gHydra = (u.mem.gHydra || 0) + 1; } }, dmgMult: (_b, u) => 1 + G.hydra * (u.mem.gHydra || 0) } } },
  { id: 'G.l_midas', tier: 'L', name: '미다스의 손', desc: `보관함에 있는 장비 재료를 모두 무작위 고급 장비로 바꿉니다. 이후 전투 승리 크레딧 -${G.midasLean}.`, unique: true,
    onPick: (_r, api) => { for (const x of api.allItems()) if (x.where === 'inv' && /^C_/.test(x.id)) api.setItem(x, api.randomItem('G')); } },
  { id: 'G.l_lone', tier: 'L', name: '고독한 늑대', desc: `출전한 아군(소환물 제외)이 ${G.loneMax}명 이하인 전투에서 모든 아군 피해 +${pc(G.lone)}, 피해량 경감 ${pc(G.loneRed)}.`, unique: true,
    team: { hooks: {
      dmgMult: (b, u) => (b.alliesOf(u).filter((a) => !a.isSummon).length <= G.loneMax ? 1 + G.lone : 1),
      takenMult: (b, u) => (b.alliesOf(u).filter((a) => !a.isSummon).length <= G.loneMax ? 1 - G.loneRed : 1) } } },
  { id: 'G.l_chaos', tier: 'L', name: '혼돈의 주사위', desc: '페이즈가 시작될 때마다 무작위 전역 증강 1개를 즉시 얻습니다 (등급 확률은 평소와 같음).', unique: true },
  { id: 'G.l_phoenix', tier: 'L', name: '불사조 계약', desc: `런마다 1회, 플레이어 체력이 0이 되면 최대 체력 ${pc(G.phoenix)}로 되살아납니다. 즉시 최대 플레이어 체력 -${G.phoenixCost}.`, unique: true,
    onPick: (r) => { r.maxHp = Math.max(1, r.maxHp - G.phoenixCost); r.hp = Math.min(r.hp, r.maxHp); } },
  { id: 'G.l_sacrifice', tier: 'L', name: '희생 제의', desc: `공명 등급이 가장 높은 기물 1명이 보상 없이 떠나고 (장비는 보관함으로), 남은 기물 전원 공명 등급 +${G.sacrifice}.` },
  { id: 'G.l_rebirth', tier: 'L', name: '윤회 계약', desc: `모든 아군 기물의 공명 등급이 +${G.rebirth} 증가하고, 장비를 유지한 채 보유하지 않은 무작위 기물로 교체됩니다 (반려 돌 제외).`, unique: true },
];
/** 다른 증강에 합쳐 더는 나오지 않는 전역 증강 (옛 세이브 표시용): 무기고 개방 → 분해 작업대 · 인맥 → 인재 스카우트 · 저축 습관 → 복리의 마법 */
export const RETIRED_GLOBALS: GlobalDef[] = [
  { id: 'G.armory', name: '무기고 개방', desc: '즉시 무작위 장비 재료 2개 획득.' },
  { id: 'G.network', name: '인맥', desc: '영입 선택지 +1, 현재 파티와 시너지가 겹치는 기물이 더 자주 나옴.', unique: true },
  { id: 'G.saving', name: '저축 습관', desc: '이자 상한 +2.', unique: true, onPick: (r) => { r.mods.interestCap += 2; } },
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
export const GLOBAL_BY_ID: Record<string, GlobalDef> = Object.fromEntries([...GLOBALS, ...RETIRED_GLOBALS].map((g) => [g.id, g]));

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
