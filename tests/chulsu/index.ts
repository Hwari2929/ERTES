// 철수 (chulsu): 공개 정보로 편성 · 장비 · 성장을 판단하는 봇 (1단계: 우선순위 1–3). docs/BOT_CHULSU.md
// 판단 구조: 상태 분석(eval.ts teamEval: 출전 · 대기, 실제 시너지 인원 · 단계, 주력 · 전열 · 회복, 장비 반영 능력치)
//   → 행동 후보 (편성 교체 · 장비 장착/조합/교체/이동 · 공명도 대상 · 능력치 선택 · 영입 · 계약 기물)
//   → 가벼운 평가 함수로 비교 (전투 탐색 없음) → 판단 기록 (log.ts, dlog 인자).
// 영역은 따로 켤 수 있다 (chulsu=form,gear,growth,start,recruit). 꺼진 영역은 라라(덤비 + 결함 수정)와 같다.
import type { Pending, RunState } from '../../src/types';
import * as R from '../../src/engine/run';
import { equipGearFix, equipMods, newIns, useConsumablesFix, type BotIns, type Track } from '../botlib';
import { planGear } from './gear';
import { formation, pickRecruit, place } from './form';
import { allocPicks, buyXp, xpTarget } from './growth';
import { DLog } from './log';

export type Area = 'start' | 'form' | 'gear' | 'growth' | 'recruit';
export const ALL_AREAS: Area[] = ['form', 'gear', 'growth', 'start', 'recruit'];
/** bot=chulsu 의 기본 영역: recruit 는 보류 시드 위험 7에서 도달 페이즈를 낮춰 (docs/BOT_CHULSU.md 5절) 기본에서 뺀다. chulsu=…,recruit 로 켠다 */
export const DEFAULT_AREAS: Area[] = ['form', 'gear', 'growth', 'start'];
export interface ChulsuOpts { areas: Set<Area>; dlog?: boolean; ins?: BotIns }

export class Chulsu {
  ins: BotIns;
  log: DLog;
  /** 판단에 쓴 시간 (ms) */
  ms = 0;
  constructor(public run: RunState, public o: ChulsuOpts) {
    this.ins = o.ins || newIns();
    this.log = new DLog(run, !!o.dlog);
  }
  has(a: Area) { return this.o.areas.has(a); }
  /** 상태 서명이 같으면 편성 · 장비 판단을 다시 하지 않는다 (같은 입력 = 같은 결론, 계산 절약) */
  private sig = { form: '', gear: '' };
  private key() {
    const r = this.run;
    return JSON.stringify([r.units.map((u) => [u.uid, u.rank, !!u.pos, u.items, u.mod, u.augments.length, u.lock]), r.inventory.slice().sort(), R.deployCap(r), r.globals.length, r.phase]);
  }
  private form() { const k = this.key(); if (k === this.sig.form) return; formation(this.run, this.log); this.sig.form = this.key(); }
  private gear() { const k = this.key(); if (k === this.sig.gear) return; planGear({ run: this.run, ins: this.ins, log: this.log }); this.sig.gear = this.key(); }
  private time<T>(f: () => T): T { const t = performance.now(); try { return f(); } finally { this.ms += performance.now() - t; } }

  /** 장비 · 개조부품 · 소모품 한 바퀴 (덤비와 같은 자리에서 부른다) */
  manageItems(track?: Track) {
    this.time(() => {
      const run = this.run;
      R.checkOccult(run);
      const xpPick = this.has('growth') ? () => xpTarget(run) : undefined;
      if (this.has('form')) this.form();
      if (!this.has('gear')) equipMods(run);
      for (let k = 0; k < 2; k++) {
        useConsumablesFix(run, track, this.ins, { noStrip: this.has('gear'), xpPick });
        if (this.has('gear')) this.gear();
        else equipGearFix(run, this.ins);
      }
    });
  }
  /** 장비 계획만 (회귀 테스트용) */
  manageGear() { this.time(() => planGear({ run: this.run, ins: this.ins, log: this.log })); }
  /** 공명도 구매 (growth 가 꺼져 있으면 null → 덤비 규칙) */
  buyXp(): boolean {
    if (!this.has('growth')) return false;
    this.time(() => buyXp(this.run, this.log));
    return true;
  }
  /** 함대 확장 등으로 자리가 바뀐 뒤 편성 · 배치 (form 이 꺼져 있으면 false → 덤비 autoPlace) */
  arrange(): boolean {
    if (!this.has('form')) return false;
    this.time(() => {
      this.form();
      if (this.has('gear')) this.gear();
      R.autoPlace(this.run); // 반려 돌 등 엔진 규칙 (빈 자리 · 강제 출전)
      place(this.run, this.log);
    });
    return true;
  }
  /** 마이너 능력치 선택 (growth 가 꺼져 있으면 null → 덤비 규칙) */
  alloc(p: Extract<Pending, { t: 'rankup' }>) {
    if (!this.has('growth')) return null;
    return this.time(() => allocPicks(this.run, p, this.log));
  }
  /** 영입 선택 (recruit 가 꺼져 있으면 null → 덤비 규칙) */
  recruit(options: string[], tie: (id: string) => number): string | null {
    if (!this.has('recruit')) return null;
    return this.time(() => pickRecruit(this.run, options, this.log, tie));
  }
}
export { pickStarters } from './form';
export { DLog } from './log';
