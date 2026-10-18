// 철수 봇 2단계: 위험(난이도)별 계획 (hard 영역) — 전환 노드 휴식 / 도전, 강제 징수기, 분리 용제 보충.
//   전환 노드: 도전에 지면 역경 패배 피해(× CFG.adversityLoss)를 받고 페이즈를 이어 가고, 이기면 남은 노드(역경 · 보스 포함)를 건너뛰며 보상을 몰아 받는다.
//   그래서 '최근 전투에서 본 여유'(이긴 전투의 남은 아군 체력 비율 — 전투가 끝나면 플레이어가 보는 값)와 '도전에 져도 버틸 체력'으로 정한다.
//   강제 징수기: 보이는 조우(편성 화면)의 적 장비만 본다. 일반 전투에는 아끼고, 보스 · 역경 · 도전에서 가장 위협적인 장비를 단 적에게.
import { CFG } from '../../src/config';
import { ENEMY_BY_ID } from '../../src/data/enemies';
import { gearRank } from '../../src/data/items';
import * as R from '../../src/engine/run';
import type { RunState } from '../../src/types';
import type { DLog } from './log';

export const HARD = {
  challengeAdv: 0.7, // 이번 페이즈 역경을 남은 아군 체력 이 비율 이상으로 이겨야 도전 (도전 = 다음 페이즈 역경급)
  challengeHpK: 2.5, // 도전 패배 피해 × 이 값보다 체력이 많아야 도전
  seizeNormal: 2, // 일반 전투에는 징수기를 이 개수 이상 들고 있을 때만 쓴다
};

/** 전투 결과 기록 (전투가 끝나면 보이는 값만): [노드, 승, 남은 아군 체력 비율] */
export interface Hist { t: string; w: number; hp: number }
/** 조정 시드(고난)에서 도전은 20% 안팎만 이겼다 (econ 기준 43전 7승, 첫 규칙 '최근 3전 여유 0.45' 84전 17승).
 *  그래서 '직전 보스 승리 + 이번 역경을 크게 이김 + 져도 버틸 체력'일 때만 도전하고, 나머지는 휴식 (체력 · 공명도). */
export function fork(run: RunState, hist: Hist[], log: DLog): 'rest' | 'challenge' | 'synth' {
  if (R.occultTier(run) && run.credits >= 20) return 'synth'; // 신비학자: 합성 (덤비와 같다)
  const lastAdv = [...hist].reverse().find((h) => h.t === 'adversity');
  const lastBoss = [...hist].reverse().find((h) => h.t === 'boss');
  // 도전 패배 피해: 다음 페이즈 역경급, 생존 적 절반 어림
  const loss = CFG.lossDamage(run.phase, 3) * CFG.adversityLoss * (R.hasGlobal(run, 'G.survival') ? 0.7 : 1);
  const ok = !!lastAdv && lastAdv.w === 1 && lastAdv.hp >= HARD.challengeAdv && (!lastBoss || lastBoss.w === 1) && run.hp > loss * HARD.challengeHpK;
  log.add('fork', ok ? '도전' : '휴식', 0, 0, [`직전 역경 ${lastAdv ? `${lastAdv.w}/${lastAdv.hp.toFixed(2)}` : '-'}`, `직전 보스 ${lastBoss ? lastBoss.w : '-'}`, `체력 ${run.hp}/${Math.round(loss * HARD.challengeHpK)}`]);
  return ok ? 'challenge' : 'rest';
}

/** 강제 징수기: 편성 화면의 조우에서 쓸지 · 누구에게 (보이는 적 장비만) */
export function seize(run: RunState, log: DLog): boolean {
  const enc = run.node?.enc;
  const k = run.inventory.indexOf('K_seize');
  if (!enc || k < 0) return false;
  const big = run.node!.type !== 'battle';
  const have = run.inventory.filter((x) => x === 'K_seize').length;
  let bi = -1, bv = 0;
  enc.enemies.forEach((s, i) => {
    const g = R.foeGearOf(s);
    if (!g.length) return;
    const d = ENEMY_BY_ID[s.defId];
    const w = d?.tier === 'boss' ? 2 : d?.tier === 'elite' || s.elite ? 1.4 : 1;
    const v = g.reduce((a, x) => a + gearRank(x) ** 2, 0) * w; // 높은 등급 장비 · 강한 적
    if (v > bv) { bv = v; bi = i; }
  });
  if (bi < 0) return false;
  const top = Math.max(...R.foeGearOf(enc.enemies[bi]).map(gearRank));
  const use = big ? top >= 2 : have >= HARD.seizeNormal && top >= 3;
  if (!use) return false;
  const r = R.useConsumable(run, k, { k: 'foe', i: bi });
  if (r.ok) log.add('seize', `징수기 → ${enc.enemies[bi].defId} (${run.node!.type})`, 0, bv, [r.msg]);
  return r.ok;
}
