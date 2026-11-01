// 순례 항목 가치 측정 (분석 전용, tests/balance.ts 옵션 `pilval[=전투 수]`).
//   순례에 들어갈 때 런을 복제해 항목마다 '받았다 / 안 받았다' 두 상태로 같은 시험 조우를 싸워 본다 (공통 난수: 모든 상태가 같은 조우 · 같은 시드).
//   항목 = 봉헌 1단계 (출전 디바인마다 — 축성 · 제례의 봉헌 몫은 이 값 × 봉헌량 ÷ 그 단계 폭으로 나눠 셈한다, 봉헌은 문턱에서만 효과가 나므로)
//          · 제례 축복 (제례 카드의 신앙 축복만, 이번 페이즈) · 나눔 카드 (받고 장비 정리) · 진열장 성유물 (성유물 × 출전 디바인) · 개종 (출전 디바인마다).
//   권능이 모자라도 값을 잰다 (비용만큼 권능을 더해 주고 쓴다) — 값은 '그 항목을 받았을 때의 전력 변화', 비용은 따로 기록한다.
//   크레딧 사다리: 크레딧 K 를 더해 공명도 구매 (크레딧 1 당 팀 가치 상승이 가장 큰 출전 기물, 철수 xpBest) 에 모두 쓴 상태 — 같은 전력 변화를 크레딧으로 환산하는 기준.
//   시험 조우 = 이번 페이즈의 일반 · 역경 · 보스 (봇 자체 난수로 새로 만든다, 진짜 런 난수는 건드리지 않는다).
//   원래 런 · 봇 난수는 바꾸지 않는다 (측정 뒤 봇은 평소대로 고른다).
import { CFG } from '../src/config';
import { buildBattle, deployed } from '../src/engine/build';
import * as R from '../src/engine/run';
import type { Rng } from '../src/rng';
import type { NodeType, Pending, RunState } from '../src/types';
import { offerNeed, offerStage } from '../src/data/relics';
import { blessingOf } from '../src/data/globals';
import { UNIT_BY_ID } from '../src/data/units';
import { manageItems } from './botlib';
import { xpBest } from './chulsu/econ';

/** 크레딧 사다리 (공명도 구매에 쓸 크레딧) */
export const PV_LADDER = [16, 32, 64];
/** 시험 조우 종류 (페이즈 안 비중을 어림: 일반 2 · 역경 1 · 보스 1) */
const ENC_TYPES: NodeType[] = ['battle', 'battle', 'adversity', 'boss'];

type Pil = Extract<Pending, { t: 'pilgrim' }>;
interface Variant { name: string; cost: number; f: (r: RunState) => boolean }
/** 한 상태의 시험 결과: [이긴 수, 아군 남은 체력 비율 합, 적 남은 체력 비율 합] */
type Res = [number, number, number];
/** 순례 1회 측정 기록 */
export interface PVRec {
  ph: number; st: number; pw: number; cr: number;
  /** 출전 디바인 [기물 id, 신앙, 성유물, 봉헌 단계, 봉헌 누계] */
  dv: [string, string, string, number, number][];
  n: number; base: Res;
  /** 항목 [이름, 비용 (크레딧 사다리 · 나눔 = 크레딧, 성유물 · 개종 = 권능, up = 다음 단계까지 남은 봉헌), 결과] */
  v: [string, number, Res][];
}

const pilOf = (r: RunState) => r.pending.find((x): x is Pil => x.t === 'pilgrim');
const faithOf = (u: { faith?: string; defId: string }) => u.faith || UNIT_BY_ID[u.defId].faith;

/** 공명 등급이 오르며 생긴 대기 선택 (능력치 배분 · 증강) 을 단순 규칙으로 처리 (철수 stateW 와 같은 규칙) */
function settlePending(r: RunState) {
  for (let g = 0; g < 20 && r.pending.length; g++) {
    const p = r.pending[0];
    if (p.t === 'rankup') {
      if (!p.allocDone) R.allocRank(r, p, ['pow', 'vit']);
      R.ensureRankupOptions(r, p);
      if (p.options?.[0]) R.chooseAug(r, p.uid, p.options[0]); else r.pending.shift();
      if (r.pending[0] === p) r.pending.shift();
    } else if (p.t === 'pilgrim') break; // 순례는 남겨 둔다 (아래 항목이 쓴다)
    else r.pending.shift();
  }
}
/** 크레딧 k 를 더해 공명도 구매에 모두 쓴다 */
export function spendXp(r: RunState, k: number): boolean {
  r.credits += k;
  let left = k;
  while (left >= R.xpCost(r)) {
    const b = xpBest(r);
    if (!b || !R.buyXp(r, b.u.uid)) break;
    left -= R.xpCost(r);
    settlePending(r);
  }
  return left < k;
}

function variants(run: RunState, p: Pil): Variant[] {
  const out: Variant[] = [];
  for (const k of PV_LADDER) out.push({ name: `cr:${k}`, cost: k, f: (r) => spendXp(r, k) });
  p.offers.forEach((o, i) => {
    if (o.k === 'rite') { const bl = blessingOf(o.faith); if (bl) out.push({ name: `bless:${o.faith}`, cost: 0, f: (r) => { R.pickBlessing(r, bl.id); return true; } }); }
    else out.push({ name: `alms:${i}`, cost: o.value || 0, f: (r) => { if (R.pilgrimTake(r, i).err) return false; manageItems(r); return true; } });
  });
  const dv = R.divines(run).filter((u) => u.pos);
  for (const u of dv) {
    const sg = offerStage(u.offer);
    if (sg < CFG.offer.max) out.push({ name: `up:${u.defId}`, cost: offerNeed(sg + 1) - (u.offer || 0), f: (r) => { r.units.find((y) => y.uid === u.uid)!.offer = offerNeed(sg + 1); return true; } });
    (p.relics || []).forEach((o, i) => {
      if (o.sold) return;
      out.push({ name: `relic:${o.id}:${u.defId}`, cost: o.cost, f: (r) => { r.power += o.cost; return !R.pilgrimRelic(r, i) && !R.equipRelic(r, u.uid, o.id); } });
    });
    const c = p.convert;
    if (c && !c.sold && faithOf(u) !== c.faith) out.push({ name: `conv:${c.faith}:${u.defId}`, cost: c.cost, f: (r) => { r.power += c.cost; return !R.pilgrimConvert(r, u.uid); } });
  }
  return out;
}

function fight(st: RunState, encs: { type: NodeType; enc: ReturnType<typeof R.genEncounter> }[]): Res {
  const res: Res = [0, 0, 0];
  for (const { type, enc } of encs) {
    const r = structuredClone(st);
    const e = structuredClone(enc);
    r.node = { type, enc: e };
    const b = buildBattle(r, e, false);
    b.runToEnd();
    const side = (s: 0 | 1) => b.units.filter((u) => u.side === s && !u.isSummon && !u.mem.inert);
    const frac = (us: typeof b.units) => { const m = us.reduce((a, u) => a + u.st.maxHp, 0); return m > 0 ? us.reduce((a, u) => a + (u.alive ? Math.max(0, u.hp) : 0), 0) / m : 0; };
    if (b.winner === 0) res[0]++;
    res[1] += frac(side(0)); res[2] += frac(side(1));
  }
  return res.map((x) => Math.round(x * 1000) / 1000) as Res;
}

/** 순례 1회 측정. perType = 조우 종류마다 시드 수 (전투 수 = ENC_TYPES 4개 × perType) */
export function pilgrimValue(run: RunState, rng: Rng, perType = 2): PVRec | null {
  const p = pilOf(run);
  if (!p || !deployed(run).length) return null;
  const encs: { type: NodeType; enc: ReturnType<typeof R.genEncounter> }[] = [];
  for (const type of ENC_TYPES) {
    const g = structuredClone(run);
    g.rng = rng.int(1, 2147483646); // 봇 자체 난수 (런 난수를 쓰지 않는다)
    const enc = R.genEncounter(g, type);
    for (let k = 0; k < perType; k++) encs.push({ type, enc: { ...enc, seed: rng.int(1, 2147483646) } });
  }
  const base0 = structuredClone(run);
  settlePending(base0);
  const rec: PVRec = {
    ph: run.phase, st: run.step, pw: run.power, cr: run.credits,
    dv: R.divines(run).filter((u) => u.pos).map((u) => [u.defId, faithOf(u), u.relic || '', offerStage(u.offer), u.offer || 0]),
    n: encs.length, base: fight(base0, encs), v: [],
  };
  for (const v of variants(run, p)) {
    const r = structuredClone(base0);
    if (!v.f(r)) continue;
    rec.v.push([v.name, v.cost, fight(r, encs)]);
  }
  return rec;
}
