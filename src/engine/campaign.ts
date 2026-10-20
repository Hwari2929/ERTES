// 캠페인 런 진행 (data/campaign.ts 의 장 정의를 run.ts 흐름에 끼운다).
// run.ts 는 run.campaign 이 있을 때만 이 함수들을 부른다 — 일반 런 경로는 그대로.
import { CAMP, CAMP_MEMBERS, CAMP_NEXT, CHAPTERS, chapterOf, SETTLE, TIME_COST } from '../data/campaign';
import { campChapterIntro } from '../data/scenes/campaign';
import { UNIT_BY_ID } from '../data/units';
import { tierOf } from '../data/synergies';
import type { Battle } from './combat';
import type { Counts } from './build';
import type { NodeType, RunState } from '../types';

export const CAMP_ID = 'recover';
export const CAMP_START = ['rachel', 'vivian'];

/** 출전 인원 상한 (장마다) */
export const campDeploy = (run: RunState) => chapterOf(run).deploy;

/** 노드에 들어갈 때: AH(접근시간)를 쓴다 (고른 행동에만). 사건 노드는 장마다 고정 사건 id 를 돌려준다 */
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
  run.log.unshift(`AH -${n} (${why}) · 남은 AH ${c.time}`);
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
  if (t('CP_AGIT') >= 1) { c.time += CAMP.agitTime; lines.push(`선동가 — AH 재협상 +${CAMP.agitTime} (남은 AH ${c.time})`); }
  if (t('CP_CAMP') >= 3 && run.hp < run.maxHp) { const h = Math.min(CAMP.campAfterHp, run.maxHp - run.hp); run.hp += h; lines.push(`캠핑 러버 — 모닥불 저녁: 플레이어 체력 +${h}`); }
  const pass = run.units.filter((u) => u.pos && u.items.includes('P_pass')).length;
  if (pass) { run.credits += pass; lines.push(`청금 통행증 — 크레딧 +${pass}`); }
  void b;
  if (type === 'boss') settleChapter(run, counts, lines);
}

/** 장 정산: 남은 AH 구간별 보너스 (상한 있음, 페트라 3단계면 한 단계 위) · 선지급 어음 차감. 다음 장이 있으면 넘어가고, 없으면 검증판 끝 */
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
  c.bonus = bonus;
  lines.push(`${ch.name} 정산 — 남은 AH ${c.time}: 칼퇴 보너스 +${bonus}${debt ? ` · 선지급 어음 -${debt}` : ''}`);
  const next = CHAPTERS.find((x) => x.ch === ch.ch + 1);
  run.pending.push({ t: 'notice', title: `${ch.name} — 정산`, body: next ? `항로 한 구간을 되찾았습니다. 다음은 ${next.place}입니다.` : `항로 한 구간을 더 되찾았습니다.\n검증판은 여기까지입니다. 다음은 ${CAMP_NEXT}입니다 (플레이 감각을 확인한 뒤 이어서 만듭니다).`, rows: [
    ['남은 AH', `${c.time} / ${c.timeMax}`],
    ['칼퇴 보너스', `크레딧 +${bonus}`],
    ...(debt ? [['선지급 어음', `크레딧 -${debt}`] as [string, string]] : []),
  ] });
  if (next) return; // 보스 승리 뒤 advance() → campNextChapter
  run.cleared = true;
  run.over = true;
}

/** 다음 장으로: 장 지도 · AH · 출전 인원을 바꾸고 장 도입 장면 · 조건 표를 띄운다 (run.ts advance 가 항로 끝에서 부른다) */
export function campNextChapter(run: RunState) {
  const c = run.campaign!;
  const ch = CHAPTERS.find((x) => x.ch === c.ch + 1);
  if (!ch) return;
  c.ch = ch.ch; c.time = ch.time; c.timeMax = ch.time;
  run.phase = ch.phase; // 적 성장 단계 (장 정의)
  run.step = 0;
  run.map = ch.map.map((x) => x.slice());
  run.log.unshift(`${ch.name} 시작 · AH ${ch.time}`);
  const intro = campChapterIntro(ch.ch, c.bonus ?? 0);
  if (intro) run.pending.push({ t: 'notice', title: ch.name, body: ch.place, scene: intro });
  const settle = (SETTLE[ch.ch] || []).filter((s) => s.cr);
  run.pending.push({ t: 'notice', title: `${ch.name} — 조건`, body: '이번 장의 AH와 출전 인원입니다. 행동별 AH 비용은 1장과 같습니다.', rows: [
    ['시작', `AH ${ch.time}`],
    ['출전 인원', `${ch.deploy}명`],
    ...settle.map((s): [string, string] => [`정산 · 남은 AH ${s.from} 이상`, `크레딧 +${s.cr}`]),
  ] });
}

/** 장 정예: 정해진 칸부터 일반 전투에 1마리 */
export const campElite = (run: RunState) => { const e = chapterOf(run).elite; return e && run.step >= e.from ? e.id : null; };

/** 캠페인 소속 이름 (기물 카드 · 상세): 원래 소속 대신 보여 줄 때 */
export const campMemberOf = (defId: string) => CAMP_MEMBERS[defId] || [];
export const campReady = (defId: string) => !!UNIT_BY_ID[defId];
