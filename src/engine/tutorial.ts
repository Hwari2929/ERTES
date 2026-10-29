// 튜토리얼 런 「당직 근무 중 승계」 (docs/TUTORIAL_DRAFT.md): 보통 RunState 에 tutorial 표식만 붙인다.
// 황무지 성계 · 위험 0 · 특권 없음 · 고정 시드 · 고정 항로(9칸) · 고정 조우. 지면 같은 전투를 다시 하고 체력은 1 아래로 내려가지 않는다 (run.ts).
import { CFG } from '../config';
import { fieldOf } from '../data/battlefields';
import { emblemId } from '../data/items';
import { TUTORIAL_EVENT } from '../data/scenes/tutorial';
import type { Encounter, NodeType, RunState, SupplyCard, UnitState } from '../types';
import * as R from './run';

export const TUT_SEED = 20261015;
export const TUT_FIELD = 'waste';

/** 고정 항로: 전투① · 전투② · 보급 · 상점 · 영입(필리스) · 전투③ · 사건 · 역경 · 보스 */
export const TUT_MAP: NodeType[][] = [['battle'], ['battle'], ['supply'], ['shop'], ['recruit'], ['battle'], ['event'], ['adversity'], ['boss']];

/** 칸별 고정 조우: 적 [id, 열, 줄 (2 = 앞줄 · 0 = 뒷줄)], mult = 적 체력 배율 (피해는 절반만 반영).
 *  일부러 쉽게: 시뮬레이션 기준 승률 ~100%, 전투 시간 ① 17초 · ② 16초 · ③ 15초 · 역경 11초 · 보스 20~25초 (전투 중 안내가 뜰 시간) */
const ENC: Record<number, { env: string; mult: number; foes: [string, number, number][] }> = {
  0: { env: '소행성 정박지 · 컨테이너 골목', mult: 1.2, foes: [['raider', 3, 2], ['gunner', 4, 0]] },
  1: { env: '소행성 정박지 · 하역장', mult: 1.6, foes: [['raider', 2, 2], ['drone', 4, 1], ['gunner', 3, 0]] },
  5: { env: '소행성 정박지 · 크레인 아래', mult: 2.4, foes: [['raider', 2, 2], ['raider', 4, 2], ['crawler', 3, 2], ['gunner', 3, 0]] },
  7: { env: '소행성 정박지 · 성채 외벽', mult: 3.6, foes: [['warlord', 3, 2], ['wraith', 1, 0], ['turret', 5, 0]] },
  8: { env: '컨테이너 성채', mult: 5.5, foes: [['varga', 3, 2], ['raider', 2, 2], ['gunner', 4, 0]] },
};
/** 사건에서 바르가의 약점을 들으면 보스 체력 배율 */
export const TUT_INTEL = 0.85;

export function newTutorialRun(): RunState {
  const run = R.newRun(TUT_SEED, ['vivian', 'temur'], TUT_FIELD, 0);
  run.pending = []; // 특권 증강 없음
  run.tutorial = { i: 0 };
  run.map = TUT_MAP.map((x) => x.slice()); R.clearRoute(run); // 튜토리얼: 한 줄 항로
  run.picked = [];
  for (const u of run.units) u.pos = null; // 첫 배치는 직접 끌어다 놓는다
  run.log = ['튜토리얼: 당직 근무 중 승계.'];
  return run;
}

export function tutEncounter(run: RunState, step = run.step): Encounter {
  const e = ENC[step];
  let mult = e.mult;
  if (step === 8 && run.flags.includes('tu_intel')) mult *= TUT_INTEL;
  return { n: CFG.bossBoard, env: e.env, enemies: e.foes.map(([defId, c, row]) => ({ defId, c, row })), mult, seed: TUT_SEED + step * 101 };
}

/** 튜토리얼 노드 진입 (지도 · 장면 뒤 자동 진입 공용) */
export function tutEnterNode(run: RunState, type: NodeType) {
  run.picked[run.step] = type;
  if ((type === 'battle' || type === 'adversity' || type === 'boss') && ENC[run.step]) { run.node = { type, enc: tutEncounter(run) }; return; }
  if (type === 'supply') { // 고정 카드: 재료(공격력) · 크레딧 · 크레딧 — 재료는 다음 칸 상점의 조합 안내용 (main.ts ch2_supply)
    const card = (c: Pick<SupplyCard, 'kind' | 'credits' | 'items'>): SupplyCard => ({ xp: 0, mult: 1, ...c, value: R.supplyValue({ xp: 0, ...c }) });
    run.pending.push({ t: 'supply', options: [card({ kind: 'gear', credits: 0, items: ['C_pow'] }), card({ kind: 'credits', credits: 4, items: [] }), card({ kind: 'credits', credits: 3, items: [] })] });
    R.advance(run);
    return;
  }
  if (type === 'shop') { // 상인 유이 · 고정 진열 9칸 (재료 3 · 고급 1 · 희귀 1 · 소모품 3 + 유이 전용 지정 소집 티켓), 할인 · 새로고침 없음
    const mul = fieldOf(run.field).shopMul || 1;
    const pr = (g: string) => Math.round(CFG.price[g] * mul), sp = (id: string) => Math.round(CFG.shop.price[id] * mul);
    const slot = (item: string, price: number, ex = false) => ({ item, price, sold: false, ...(ex ? { ex: true } : {}) });
    run.node = { type: 'shop', merchant: 'yui', shop: [
      slot('K_muster_ticket', R.ticketPrice(run), true), slot('A_vit_def', pr('A')), slot('G_vit', pr('G')),
      slot('C_pow', pr('C')), slot('C_mnd', pr('C')), slot('C_def', pr('C')),
      slot('K_xp', sp('K_xp')), slot('K_barricade', sp('K_barricade')), slot('K_cp_purge', sp('K_cp_purge')),
    ] };
    return;
  }
  if (type === 'recruit') { run.pending.push({ t: 'recruit', options: ['phyllis'], rerolls: 0 }); R.advance(run); return; }
  if (type === 'event') { run.seenEvents.push(TUTORIAL_EVENT.id); run.pending.push({ t: 'event', id: TUTORIAL_EVENT.id, sub: null }); R.advance(run); return; }
  R.enterNode(run, type);
}

/** 장면 속 합류 (나디르 · 레이첼): 영입처럼 출전 기물 기준 등급. autoSchool 이면 사이오닉 전공을 첫 선택지로 바로 정한다 */
export function tutJoin(run: RunState, defId: string, autoSchool = false): UnitState | null {
  if (run.units.some((u) => u.defId === defId)) return null;
  const u = R.addUnit(run, defId, R.joinRank(run));
  if (autoSchool) {
    const p = run.pending.find((x) => x.t === 'rankup' && x.uid === u.uid && x.kind === 'school');
    if (p?.t === 'rankup') {
      R.ensureRankupOptions(run, p);
      if (p.options?.[0]) R.chooseAug(run, u.uid, p.options[0]);
      run.pending = run.pending.filter((x) => x !== p);
    }
  }
  R.autoPlace(run);
  return u;
}

/** 장면 · 안내 사이에 주는 것: 2장 함대 확장 예산 (린디웨), 3장 창고 정리 (예레나) */
export function tutGrant(run: RunState, what: 'budget' | 'storeroom') {
  if (what === 'budget') {
    run.credits += 20;
    run.pending.push({ t: 'notice', title: '첫 결재', body: '린디웨가 함대 확장 예산으로 에너지 크레딧 20을 맡겼습니다. 지도의 함선 관리에서 함대 확장을 한 번 사면 출전 인원이 5명이 됩니다.' });
  } else {
    for (const id of ['C_vit', 'C_def', emblemId('KAL')]) R.gainItem(run, id, undefined, true);
    run.credits += 10;
    run.pending.push({ t: 'notice', title: '창고 정리', body: '예레나가 밀린 창고를 정리했습니다. 장비 재료 2개(강화 섬유 · 복합 장갑판), 칼리토 제국 문장, 에너지 크레딧 10을 받았습니다.' });
  }
}
