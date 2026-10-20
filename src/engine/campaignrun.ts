// 캠페인 「회수 계약」 런 만들기 (튜토리얼 런과 같은 방식: 보통 RunState 에 campaign 표식을 붙인다)
import { CHAPTERS } from '../data/campaign';
import { fieldIntroPending } from '../data/scenes/fields';
import type { RunState } from '../types';
import { CAMP_ID, CAMP_START } from './campaign';
import * as R from './run';

export function newCampaignRun(diff: number): RunState {
  const ch = CHAPTERS[0];
  const run = R.newRun((Date.now() ^ (Math.random() * 1e9)) | 0, CAMP_START, 'swarm', diff);
  run.pending = []; // 특권 · 절망 증강 없음 (캠페인 고정 진행)
  run.campaign = { id: CAMP_ID, ch: ch.ch, time: ch.time, timeMax: ch.time, spent: 0 };
  run.map = ch.map.map((x) => x.slice());
  run.picked = [];
  run.log = [`캠페인 「회수 계약」 ${ch.name} 시작 · 계약 잔여 시간 ${ch.time}`];
  // 라르스가 먼저 보낸 것: 통행증 · 정화 분무기 · 선지급 어음
  for (const id of ['P_pass', 'K_cp_purge', 'K_cp_note']) R.gainItem(run, id);
  const intro = fieldIntroPending(run); // 전장 도입 「끊긴 물류망」(라르스 · 17시 58분)이 곧 프롤로그
  if (intro) run.pending.push(intro);
  run.pending.push({ t: 'notice', title: '회수 계약 — 조건', body: [
    `납기: 산-노디스 소등 예보보다 먼저. 장마다 [계약 잔여 시간]이 있고, 고른 행동에만 시간이 든다 (전투 6 · 사건 3 · 보급 2 · 분기점 1).`,
    `장이 끝나면 남은 시간으로 칼퇴 보너스를 정산한다 (1장: 14 이상 +8 · 8 이상 +4).`,
    `출전 인원: 1장 2명 → 극후반 6명. 캠페인 전용 시너지만 켜진다 (출항기 · 귀차니스트 · 캠핑 러버 · 바운스 · 페트라 · 선동가).`,
    `라르스가 보낸 물건: 청금 통행증 · 정화 분무기 · 선지급 어음.`,
  ].join('\n') });
  return run;
}
