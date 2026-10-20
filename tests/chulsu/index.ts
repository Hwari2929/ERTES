// 철수 (chulsu): 공개 정보로 편성 · 장비 · 성장 · 경제 · 증강 · 위험별 계획 · 영입 · 빌드를 판단하는 봇 (1단계: 우선순위 1–3, 2단계: 4–6, 3단계: 평가 정확성 · 수집/출전 분리 · 빌드 운영 · 보스 대응 · 선별 탐색). docs/BOT_CHULSU.md
// 판단 구조: 상태 분석(eval.ts teamEval: 출전 · 대기, 실제 시너지 인원 · 단계, 주력 · 전열 · 회복, 장비 반영 능력치)
//   → 행동 후보 (편성 교체 · 장비 장착/조합/교체/이동 · 공명도 대상 · 능력치 선택 · 영입 · 계약 기물)
//   → 가벼운 평가 함수로 비교 (전투 탐색 없음) → 판단 기록 (log.ts, dlog 인자).
// 영역은 따로 켤 수 있다 (chulsu=form,gear,growth,start,recruit,econ,aug,hard,recruit2,build,search,syn3,multi,build3,boss,search3). 꺼진 영역은 라라(덤비 + 결함 수정)와 같다.
import type { NodeType, Pending, RunState } from '../../src/types';
import type { Battle } from '../../src/engine/combat';
import * as E from './econ';
import * as H from './hard';
import * as RS from './roster';
import * as B from './build';
import * as S from './search';
import * as R from '../../src/engine/run';
import { equipGearFix, equipMods, newIns, useConsumablesFix, type BotIns, type Track } from '../botlib';
import { planGear } from './gear';
import { formation, pickRecruit, place } from './form';
import { allocPicks, buyXp, xpTarget } from './growth';
import { DLog } from './log';
import * as A from './aug';
import { Rng } from '../../src/rng';

export type Area = 'start' | 'form' | 'gear' | 'growth' | 'recruit' | 'aug' | 'econ' | 'hard' | 'recruit2' | 'build' | 'search' | 'syn3' | 'multi' | 'build3' | 'boss' | 'search3';
/** 3단계 영역: syn3 (평가 정확성: 효과 단계 · 잃는 효과 · 시너지 실측 잔차), multi (영입 · 보관 · 출전 분리, 임계점 다중 교체), build3 (빌드 임계점 · 포기 조건),
 *  boss (보스 위험을 보는 절망 증강 · 보스 배치 · 보스 전 투자), search3 (선별 탐색, 분석 전용) */
export const ALL_AREAS: Area[] = ['form', 'gear', 'growth', 'start', 'recruit', 'aug', 'econ', 'hard', 'recruit2', 'build', 'search', 'syn3', 'multi', 'build3', 'boss', 'search3'];
/** bot=chulsu 의 기본 영역 (3단계): 2단계 기본(form · gear · growth · start · econ · aug · hard · recruit2 · build) + syn3 · multi · build3.
 *  보류 시드에서 syn3 는 이득 (모험 +14.5%p · 고난 +4.2%p), multi · build3 는 중립(오차 안), boss 는 고난에서 이득이 없어 (−3.8 ± 4.5%p, 결승전 특집 대신 고른
 *  절망 증강이 일반 전투를 어렵게 했다) 선택 영역으로 둔다 (docs/BOT_CHULSU.md 3단계). search · search3 는 분석 전용.
 *  2단계 기본을 재현하려면 chulsu=form,gear,growth,start,econ,aug,hard,recruit2,build · 1단계 기본은 chulsu=form,gear,growth,start */
export const DEFAULT_AREAS: Area[] = ['form', 'gear', 'growth', 'start', 'econ', 'aug', 'hard', 'recruit2', 'build', 'syn3', 'multi', 'build3'];
export interface ChulsuOpts { areas: Set<Area>; dlog?: boolean; ins?: BotIns; forceBuild?: string; augOff?: Set<string>; bossOff?: Set<string> }

export class Chulsu {
  ins: BotIns;
  log: DLog;
  /** 판단에 쓴 시간 (ms) */
  ms = 0;
  constructor(public run: RunState, public o: ChulsuOpts) {
    this.ins = o.ins || newIns();
    this.log = new DLog(run, !!o.dlog);
    this.rng = new Rng(run.seed * 977 + 13);
  }
  has(a: Area) { return this.o.areas.has(a); }
  /** aug 영역의 부분 (priv · desp · glob · unit · loot) — augoff= 분석 인자로 일부만 끌 수 있다 */
  augOn(part: string) { return this.has('aug') && !this.o.augOff?.has(part); }
  /** boss 영역의 부분 (desp · place · reserve) — bossoff= 분석 인자로 일부만 끌 수 있다 */
  bossOn(part: string) { return this.has('boss') && !this.o.bossOff?.has(part); }
  /** 상태 서명이 같으면 편성 · 장비 판단을 다시 하지 않는다 (같은 입력 = 같은 결론, 계산 절약) */
  private sig = { form: '', gear: '' };
  private key() {
    const r = this.run;
    return JSON.stringify([r.units.map((u) => [u.uid, u.rank, !!u.pos, u.items, u.mod, u.augments.length, u.lock]), r.inventory.slice().sort(), R.deployCap(r), r.globals.length, r.phase]);
  }
  private form() { const k = this.key(); if (k === this.sig.form) return; formation(this.run, this.log, [], this.bias(), this.has('multi'), () => this.count('multiSwap')); this.sig.form = this.key(); }
  private gear() { const k = this.key(); if (k === this.sig.gear) return; planGear({ run: this.run, ins: this.ins, log: this.log }); this.sig.gear = this.key(); }
  private time<T>(f: () => T, label?: string): T {
    const t = performance.now();
    try { return f(); } finally { const d = performance.now() - t; this.ms += d; if (label && this.stage2()) this.rec[`ms_${label}`] = Math.round((this.rec[`ms_${label}`] || 0) + d); }
  }

  /** 장비 · 개조부품 · 소모품 한 바퀴 (덤비와 같은 자리에서 부른다) */
  manageItems(track?: Track) {
    this.time(() => {
      const run = this.run;
      R.checkOccult(run);
      const xpPick = this.has('growth') ? () => xpTarget(run) : undefined;
      if (this.has('recruit2') && !run.node) { const n = RS.releaseBench(run, this.log, this.bias(), this.has('multi')); if (n) this.count('released', n); }
      if (this.has('form')) this.form();
      if (!this.has('gear')) equipMods(run);
      if (this.has('hard') && H.seize(run, this.log)) this.count('seize');
      for (let k = 0; k < 2; k++) {
        useConsumablesFix(run, track, this.ins, { noStrip: this.has('gear'), noSeize: this.has('hard'), xpPick });
        if (this.has('gear')) this.gear();
        else equipGearFix(run, this.ins);
      }
      if (this.has('econ')) E.equipTurrets(run);
    }, 'items');
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
      place(this.run, this.log, this.bossOn('place'));
    }, 'arrange');
    return true;
  }
  /** 마이너 능력치 선택 (growth 가 꺼져 있으면 null → 덤비 규칙) */
  alloc(p: Extract<Pending, { t: 'rankup' }>) {
    if (!this.has('growth')) return null;
    return this.time(() => allocPicks(this.run, p, this.log));
  }
  // ───────── 2단계: 증강 (aug)
  /** 봇 자체 난수 (새로고침 기대값 몬테카를로 등). 런 난수와 따로 굴린다 */
  rng: Rng;
  /** 추가 전투 수 · 시간 (제한 탐색) · 2단계 계측 */
  xb = 0; xms = 0; rec: Record<string, number> = {};
  count(k: string, n = 1) { this.rec[k] = (this.rec[k] || 0) + n; }
  stage2() { return ['aug', 'econ', 'hard', 'recruit2', 'build', 'search', 'syn3', 'multi', 'build3', 'boss', 'search3'].some((a) => this.has(a as Area)); }
  // ───────── 2단계: 경제 (econ) · 위험별 계획 (hard) · 영입 (recruit2)
  /** 전투 결과 기록 (전투가 끝나면 보이는 값): 노드 · 승 · 남은 아군 체력 비율 */
  hist: H.Hist[] = [];
  afterBattle(b: Battle, type: string) {
    const A0 = b.units.filter((u) => u.side === 0 && !u.isSummon && !u.mem.inert);
    const m = A0.reduce((s, u) => s + u.st.maxHp, 0);
    const hp = m > 0 ? A0.reduce((s, u) => s + (u.alive ? Math.max(0, u.hp) : 0), 0) / m : 0;
    this.hist.push({ t: type, w: b.winner === 0 ? 1 : 0, hp });
  }
  /** 복제 런에서 쓰는 '살 뒤 · 고른 뒤의 정리' (평가 모형): 소모품 · 장비 계획 · 포탑 */
  plan = (r: RunState) => {
    const ins = newIns(), log = new DLog(r, false);
    useConsumablesFix(r, undefined, ins, { noStrip: true, noSeize: true, xpPick: () => xpTarget(r) });
    planGear({ run: r, ins, log });
    E.equipTurrets(r);
  };
  spend() { this.time(() => E.spend(this.run, this.log, this.bossOn('reserve')), 'spend'); }
  shop(track?: Track) { this.time(() => { E.shop(this.run, this.plan, this.log, track ? (id) => track(id, 'bought') : undefined); E.equipTurrets(this.run); }, 'shop'); }
  synth(track?: Track) { this.shop(track); }
  branch(options: NodeType[]): NodeType { return this.time(() => E.branch(this.run, options, this.log), 'branch'); }
  event(p: Extract<Pending, { t: 'event' }>) {
    const i = this.time(() => E.event(this.run, p, this.plan, this.log, this.rng), 'event');
    if (i !== null) R.chooseEvent(this.run, i);
  }
  fork(): 'rest' | 'challenge' | 'synth' { return this.time(() => H.fork(this.run, this.hist, this.log), 'fork'); }
  recruit2(p: Extract<Pending, { t: 'recruit' }>): string { return this.time(() => RS.pickRecruit2(this.run, p, this.log, this.bias(), this.has('multi')), 'recruit'); }
  // ───────── 2단계: 전문 빌드 (build) · 제한 탐색 (search)
  buildId: string | null = null;
  private buildPhase = 0; private musters = 0;
  bias() { return this.has('build') ? B.bias(this.run, this.buildId, this.has('build3')) : undefined; }
  /** 페이즈마다 빌드 유지 / 전환을 다시 보고, 모자란 구성원을 지정 소집 (manage 에서, 노드 밖) */
  buildStep() {
    if (!this.has('build')) return;
    this.time(() => {
      if (this.buildPhase !== this.run.phase) {
        const prev = this.buildId;
        this.buildId = B.chooseBuild(this.run, this.buildId, this.log, this.o.forceBuild, this.has('build3'));
        if (prev && prev !== this.buildId) this.count('buildSwitch');
        this.buildPhase = this.run.phase; this.musters = 0;
      }
      if (B.muster(this.run, this.buildId, this.musters, this.log, this.has('build3'))) { this.musters++; this.count('muster'); }
    }, 'build');
  }
  /** 제한 탐색 (search.ts): 편성 화면의 조우를 다른 난수로 미리 싸워 대안 비교 */
  private lastMulti = 0;
  search() {
    const ctx = { run: this.run, rng: this.rng, log: this.log, xb: this.xb, xms: this.xms };
    if (this.has('search3')) { // 3단계: 선별 탐색 (중요한 판단에만)
      const m = this.rec.multiSwap || 0;
      const r = S.search3(ctx, m > this.lastMulti);
      this.lastMulti = m;
      this.count(r === 'skip' ? 'search_skip' : 'search_done');
    } else S.search(ctx);
    this.xb = ctx.xb; this.xms = ctx.xms;
  }
  emblemParam(): string { return this.time(() => A.emblemParam(this.run)); }
  privilege(p: Extract<Pending, { t: 'privilege' }>) { this.time(() => A.privilege(this.run, p, this.log, this.rng), 'aug'); }
  despair(p: Extract<Pending, { t: 'despair' }>) {
    const risk = this.bossOn('desp') ? A.bossLossRate(this.run, this.hist) : undefined; // 3단계 boss: 보스가 벽이면 결승전 특집을 피한다
    this.time(() => A.despair(this.run, p, this.log, this.rng, risk), 'aug');
    if (this.run.despairs?.includes('D.final')) this.rec.final = 1;
  }
  global(p: Extract<Pending, { t: 'global' }>) { this.time(() => A.global(this.run, p, this.log, this.rng), 'aug'); }
  aug(p: Extract<Pending, { t: 'rankup' }>) { return this.time(() => A.aug(this.run, p, this.log, this.rng), 'aug'); }
  itemPick(options: string[]) { return this.time(() => A.itemPick(this.run, options, (r) => planGear({ run: r, ins: newIns(), log: new DLog(r, false) }), this.log), 'loot'); }
  noRock(options: string[], score: (id: string) => number) { return A.noRock(options, score); }
  /** 영입 선택 (recruit 가 꺼져 있으면 null → 덤비 규칙) */
  recruit(options: string[], tie: (id: string) => number): string | null {
    if (!this.has('recruit')) return null;
    return this.time(() => pickRecruit(this.run, options, this.log, tie));
  }
}
export { pickStarters } from './form';
export { DLog } from './log';
