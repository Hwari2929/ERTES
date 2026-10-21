// 캠페인 「회수 계약」 런 만들기 (튜토리얼 런과 같은 방식: 보통 RunState 에 campaign 표식을 붙인다)
import { CAMP_SYNERGIES, CHAPTERS, SETTLE, TIME_COST } from '../data/campaign';
import { CONSUMABLES, itemInfo } from '../data/items';
import { CAMP_PROLOGUE } from '../data/scenes/campaign';
import type { NodeType, RunState } from '../types';
import { CAMP_ID, CAMP_START } from './campaign';
import * as R from './run';

/** AH 비용 표에 보여 줄 칸 (같은 비용은 한 줄로) */
const COST_ROWS: [string, NodeType[]][] = [['전투 · 보스전', ['battle', 'boss']], ['사건', ['event']], ['보급', ['supply']], ['분기점', ['shop']]];
const LARS_KIT = ['P_pass', 'K_cp_purge', 'K_cp_note'];

export function newCampaignRun(diff: number): RunState {
  const ch = CHAPTERS[0];
  const run = R.newRun((Date.now() ^ (Math.random() * 1e9)) | 0, CAMP_START, 'swarm', diff);
  run.pending = []; // 특권 · 절망 증강 없음 (캠페인 고정 진행)
  run.campaign = { id: CAMP_ID, ch: ch.ch, time: ch.time, timeMax: ch.time, spent: 0 };
  run.map = ch.map.map((x) => x.slice());
  run.picked = [];
  run.log = [`캠페인 「회수 계약」 ${ch.name} 시작 · AH ${ch.time}`];
  // 라르스가 먼저 보낸 것: 통행증 · 정화 분무기 · 선지급 어음
  for (const id of LARS_KIT) R.gainItem(run, id);
  // 프롤로그: 예레나가 라르스의 의뢰를 연결하고, 처음부터 동석한 페트라 창구 린디웨가 AH 를 설명한다. 일반 전장 도입(swarm)은 보지 않는다
  run.flags.push('field_intro');
  run.pending.push({ t: 'notice', title: '의뢰 — 회수 계약', body: '의뢰인 라르스 (페트라 무역관세부장) · 페트라 창구 린디웨 (특별경호팀 협력팀장)', scene: CAMP_PROLOGUE });
  const settle = (SETTLE[ch.ch] || []).filter((s) => s.cr);
  run.pending.push({ t: 'notice', title: 'AH — 접근시간', body: 'AH(Access-Hour)는 정거장 설비 · 도킹 슬롯 · 항로 관제를 남보다 먼저 쓸 수 있는 권리를 시간으로 센 것입니다. 장마다 정해진 양이 있고, 고른 행동에만 듭니다 (대화 · 설명은 들지 않음). 장이 끝날 때 남은 AH에 따라 칼퇴 보너스를 정산합니다. 다 써도 진행은 계속되고, 보너스만 없습니다.', rows: [
    [`${ch.name.split(' · ')[0]} 시작`, `AH ${ch.time}`],
    ...COST_ROWS.map(([k, ts]): [string, string] => [k, `AH -${TIME_COST[ts[0]] || 0}`]),
    ...settle.map((s): [string, string] => [`정산 · 남은 AH ${s.from} 이상`, `크레딧 +${s.cr}`]),
  ] });
  run.pending.push({ t: 'notice', title: '회수 계약 — 편성', body: '이 캠페인에서는 일반 시너지 대신 캠페인 전용 시너지만 켜집니다. 출전 인원은 장마다 늘어납니다.', rows: [
    ['출전 인원', `${ch.name.split(' · ')[0]} ${ch.deploy}명 → 4장 5명`],
    ['시너지', CAMP_SYNERGIES.map((s) => s.name).join(' · ')],
    ['라르스가 보낸 물건', LARS_KIT.map((id) => (CONSUMABLES[id]?.name || itemInfo(id).name).replace(/^\[캠페인\] /, '')).join(' · ')],
  ] });
  return run;
}
