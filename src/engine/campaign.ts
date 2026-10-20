// 캠페인 런 진행 (data/campaign.ts 의 장 정의를 run.ts 흐름에 끼운다).
// run.ts 는 run.campaign 이 있을 때만 이 함수들을 부른다 — 일반 런 경로는 그대로.
import { CAMP, CAMP_MEMBERS, chapterOf, SETTLE, TIME_COST } from '../data/campaign';
import { UNIT_BY_ID } from '../data/units';
import { tierOf } from '../data/synergies';
import type { Battle } from './combat';
import type { Counts } from './build';
import type { NodeType, RunState } from '../types';

export const CAMP_ID = 'recover';
export const CAMP_START = ['rachel', 'vivian'];

/** 출전 인원 상한 (장마다) */
export const campDeploy = (run: RunState) => chapterOf(run).deploy;

/** 노드에 들어갈 때: 계약 시간을 쓴다 (고른 행동에만). 사건 노드는 장마다 고정 사건 id 를 돌려준다 */
export function campEnter(run: RunState, type: NodeType): { event?: string } {
  const c = run.campaign!;
  const cost = TIME_COST[type] || 0;
  if (cost) spendTime(run, cost, typeName(type));
  if (type === 'event') return { event: chapterOf(run).events[run.step] };
  return {};
}
const typeName = (t: NodeType) => ({ battle: '전투', adversity: '역경', boss: '보스전', event: '사건', supply: '보급', shop: '분기점', maint: '정비' } as Record<string, string>)[t] || t;
export function spendTime(run: RunState, n: number, why: string) {
  const c = run.campaign!;
  c.time -= n; c.spent += n;
  run.log.unshift(`계약 시간 -${n} (${why}) · 남은 ${c.time}`);
}

/** 조우 규모: 출전 인원에 맞춘다 (초반 2명) */
export const campFoeCount = (run: RunState) => campDeploy(run) + (run.step >= 5 ? 1 : 0);
export const campBoss = (run: RunState) => chapterOf(run).boss;

/** 전투 정산 (승패 반영 뒤, 다음 칸으로 넘어가기 전) */
export function campAfterBattle(run: RunState, b: Battle, won: boolean, type: NodeType, counts: Counts, lines: string[]) {
  const c = run.campaign!;
  run.flags = run.flags.filter((f) => f !== 'cp_purge'); // 정화 분무기: 한 전투만
  if (!won) return;
  const t = (id: Parameters<typeof tierOf>[0]) => tierOf(id, counts[id] || 0);
  if (t('CP_PET') >= 1) { run.credits += CAMP.petWin; lines.push(`페트라 — 계약 정산 크레딧 +${CAMP.petWin}`); }
  if (t('CP_AGIT') >= 1) { c.time += CAMP.agitTime; lines.push(`선동가 — 기한 재협상: 계약 시간 +${CAMP.agitTime} (남은 ${c.time})`); }
  if (t('CP_CAMP') >= 3 && run.hp < run.maxHp) { const h = Math.min(CAMP.campAfterHp, run.maxHp - run.hp); run.hp += h; lines.push(`캠핑 러버 — 모닥불 저녁: 플레이어 체력 +${h}`); }
  const pass = run.units.filter((u) => u.pos && u.items.includes('P_pass')).length;
  if (pass) { run.credits += pass; lines.push(`청금 통행증 — 크레딧 +${pass}`); }
  void b;
  if (type === 'boss') settleChapter(run, counts, lines);
}

/** 장 정산: 남은 계약 시간 구간별 보너스 (상한 있음, 페트라 3단계면 한 단계 위) · 선지급 어음 차감 */
export function settleChapter(run: RunState, counts: Counts, lines: string[]) {
  const c = run.campaign!;
  const ch = chapterOf(run);
  const tiers = SETTLE[ch.ch] || SETTLE[1];
  let i = tiers.findIndex((s) => c.time >= s.from);
  if (i < 0) i = tiers.length - 1;
  if (tierOf('CP_PET', counts.CP_PET || 0) >= 2) i = Math.max(0, i - 1);
  const bonus = tiers[i].cr;
  const debt = run.flags.filter((f) => f === 'cp_note').length * 20;
  run.flags = run.flags.filter((f) => f !== 'cp_note');
  run.credits = Math.max(0, run.credits + bonus - debt);
  lines.push(`${ch.name} 정산 — 남은 계약 시간 ${c.time}: 칼퇴 보너스 +${bonus}${debt ? ` · 선지급 어음 -${debt}` : ''}`);
  run.pending.push({ t: 'notice', title: `${ch.name} · 항로 회복`, body: `남은 계약 시간 ${c.time} / ${c.timeMax}. 칼퇴 보너스 크레딧 +${bonus}${debt ? `, 선지급 어음 정산 -${debt}` : ''}.\n검증판은 여기까지입니다. 다음 장(광석 하역장)은 플레이 감각을 확인한 뒤 이어서 만듭니다.` });
  run.cleared = true;
  run.over = true;
}

/** 캠페인 소속 이름 (기물 카드 · 상세): 원래 소속 대신 보여 줄 때 */
export const campMemberOf = (defId: string) => CAMP_MEMBERS[defId] || [];
export const campReady = (defId: string) => !!UNIT_BY_ID[defId];
