// 상점 · 상인 검사 (npm run check): 진열 9칸 · 상인 전용 상품 · 할인 분포 · 새로고침 · 이자 지키며 쓸 수 있음 · 지정 소집 티켓 ·
// 고르곤 교환 · 만찬 백수정 연쇄 회복 · 다시 열어도 같은 진열.
import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import { buildBattle, encGeo, PAD } from '../src/engine/build';
import { FIELDS } from '../src/data/battlefields';
import { MERCHANT_BY_ID, MERCHANTS, merchantPool } from '../src/data/merchants';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, CONSUMABLES } from '../src/data/items';
import { DEV, type Device, feastChain } from '../src/data/devices';
import { RECRUITABLE } from '../src/data/units';
import type { RunState } from '../src/types';
declare const process: { exitCode?: number };

let fails = 0, passed = 0;
const ok = (c: boolean, msg: string) => { if (c) passed++; else { fails++; console.log(`FAIL ${msg}`); } };
const STARTERS = RECRUITABLE.slice(0, 4).map((d) => d.id);
function mk(seed: number, field = 'waste', diff = 0, phase = 1): RunState {
  const run = R.newRun(seed, STARTERS, field, diff);
  run.pending = [];
  run.phase = phase;
  return run;
}

// ── 1. 진열 9칸 · 서로 다름 · 전용 상품 · 가격 · 고르곤 전설 확률
{
  let n = 0, bad = 0, exMiss = 0, badPrice = 0;
  const legend: Record<string, [number, number]> = {};
  let seed = 1;
  for (const f of FIELDS) for (const diff of [0, 6, 7]) for (const phase of [1, 3, 6]) for (let s = 1; s <= 12; s++) for (const m of MERCHANTS) {
    const run = mk(seed++ * 7919, f.id, diff, phase);
    const shop = R.genShop(run, m.id);
    n++;
    const ids = shop.map((x) => x.item);
    if (ids.length !== CFG.shop.slots || new Set(ids).size !== ids.length) { bad++; if (bad < 4) console.log('  진열', m.id, phase, JSON.stringify(ids)); }
    if (m.ex && !shop.some((x) => x.item === m.ex && x.ex)) exMiss++;
    if (shop.some((x) => !(x.price > 0) || !Number.isFinite(x.price) || (x.base !== undefined && !(x.base > x.price)))) badPrice++;
    const k = `${m.id}:${phase === 1 ? 'p1' : phase === 6 ? 'p6' : 'p3'}`;
    const l = (legend[k] ||= [0, 0]); l[1]++; if (ids.some((x) => x.startsWith('L_'))) l[0]++;
  }
  ok(bad === 0, `진열 ${n}개 상점 모두 ${CFG.shop.slots}칸 · 같은 물품 없음 (어긋남 ${bad})`);
  ok(exMiss === 0, `상인 전용 상품 늘 진열 (빠짐 ${exMiss})`);
  ok(badPrice === 0, `가격은 양수 · 할인 칸은 원래 가격 > 할인가 (어긋남 ${badPrice})`);
  const rate = (k: string) => legend[k][0] / legend[k][1];
  ok(rate('gorgon:p1') > 0.1 && rate('gorgon:p1') < 0.32, `고르곤 1페이즈 전설 ≈ ${CFG.shop.gorgonLegend} (${rate('gorgon:p1').toFixed(3)})`);
  ok(rate('yui:p1') === 0 && rate('laila:p3') === 0, '다른 상인은 1 · 3페이즈 전설 없음');
  ok(rate('yui:p6') > 0 && rate('yui:p6') < 0.15, `다른 상인 6페이즈 전설 ≈ ${CFG.drop.shopLegend} (${rate('yui:p6').toFixed(3)})`);
}

// ── 2. 할인 분포 (많은 시드)
{
  const cnt = [0, 0, 0, 0];
  let sales = 0, rare = 0, badPct = 0;
  const N = 4000;
  for (let s = 0; s < N; s++) {
    const shop = R.genShop(mk(10007 + s * 31), MERCHANTS[s % MERCHANTS.length].id);
    const d = shop.filter((x) => x.off);
    cnt[Math.min(3, d.length)]++;
    for (const x of d) { sales++; if (x.off === CFG.shop.sale.rare) rare++; else if (!CFG.shop.sale.pct.includes(x.off!)) badPct++; }
  }
  const p = cnt.map((c) => c / N);
  ok(CFG.shop.sale.n.every((q, k) => Math.abs(p[k] - q) < 0.03), `할인 칸 수 0 · 1 · 2 · 3 분포 ${p.map((x) => x.toFixed(3)).join(' · ')} ≈ ${CFG.shop.sale.n.join(' · ')}`);
  ok(badPct === 0, '할인율은 설정값 중 하나');
  ok(Math.abs(rare / sales - CFG.shop.sale.rareP) < 0.015, `${CFG.shop.sale.rare}% 할인 비율 ${(rare / sales).toFixed(3)} ≈ ${CFG.shop.sale.rareP}`);
}

// ── 3. 상인 풀 · 상점 열기 · 다시 열어도 같은 진열 (노드 · 저장에 기록)
{
  ok(merchantPool(FIELDS[0]).length === MERCHANTS.filter((m) => !m.fields).length, '전장 상인 풀 = 공용 상인');
  ok(merchantPool({ id: 'x', merchants: ['gorgon', 'nope'] }).length === merchantPool({ id: 'x' }).length, '전장 특별 상인: 없는 id · 겹침 무시');
  const seen = new Set<string>();
  for (let s = 1; s <= 60; s++) { const run = mk(s); R.openShop(run); seen.add(run.node!.merchant!); }
  ok(seen.size === MERCHANTS.length, `상인 무작위 (60번에 ${seen.size}명)`);
  const run = mk(5);
  R.openShop(run);
  const snap = JSON.stringify(run.node);
  const back = JSON.parse(JSON.stringify(run)) as RunState;
  ok(JSON.stringify(back.node) === snap, '저장 · 불러오기 뒤에도 같은 상인 · 같은 진열');
  R.buyShop(run, run.node!.shop!.findIndex((x) => x.price <= run.credits));
  ok(run.node!.shop!.length === CFG.shop.slots, '산 칸은 품절로 남는다 (채우지 않음)');
}

// ── 4. 새로고침: 페이즈마다 1번 · 첫 번 무료 · 그다음 base, +step
{
  const run = mk(9);
  run.credits = 100;
  R.openShop(run);
  const m = run.node!.merchant!;
  ok(R.refreshInfo(run).cost === 0 && !R.refreshInfo(run).used, '첫 새로고침 무료');
  ok(R.refreshShop(run) === null && run.credits === 100, '무료 새로고침 성공');
  ok(run.node!.merchant === m && run.node!.shop!.length === CFG.shop.slots, '새로고침: 상인 그대로 · 9칸');
  ok(!!R.refreshShop(run) && R.refreshInfo(run).used, '같은 페이즈 두 번째는 막힘');
  run.phase = 2;
  ok(R.refreshInfo(run).cost === CFG.shop.refresh.base, `다음 페이즈 비용 ${CFG.shop.refresh.base}`);
  R.refreshShop(run);
  ok(run.credits === 100 - CFG.shop.refresh.base, '비용 차감');
  run.phase = 3;
  ok(R.refreshInfo(run).cost === CFG.shop.refresh.base + CFG.shop.refresh.step, `그다음 +${CFG.shop.refresh.step}`);
  run.credits = 0;
  ok(R.refreshShop(run) === '크레딧 부족', '크레딧이 모자라면 막힘');
  const ex = MERCHANT_BY_ID[m].ex;
  ok(!ex || run.node!.shop!.some((x) => x.item === ex), '새로고침 뒤에도 전용 상품');
}

// ── 5. 이자 지키며 쓸 수 있음
{
  const run = mk(3);
  run.credits = 47;
  const k = R.interestKeep(run);
  ok(k.spend === 7 && k.keep === 4, `크레딧 47 · 이자 4 → 쓸 수 있음 7 (${k.spend}, ${k.keep})`);
  ok(k.after(7) === 4 && k.after(8) === 3, '7 쓰면 이자 4 유지 · 8 쓰면 3');
  run.credits = 93;
  const k2 = R.interestKeep(run), cap = R.interestInfo(run).cap;
  ok(k2.spend === 93 - CFG.interestPer * cap && k2.keep === cap, `상한에 닿으면 상한 단계만 지킨다 (${k2.spend})`);
}

// ── 6. 지정 소집 티켓: 크레딧 없이 소집 · 티켓 1장 소모 · 소집 횟수 증가
{
  const run = mk(4);
  run.credits = 0;
  ok(!!R.openMuster(run), '티켓 · 크레딧 없으면 소집 불가');
  run.inventory.push(R.TICKET);
  ok(R.openMuster(run) === null, '티켓이 있으면 크레딧 0 으로 소집 창');
  const syns = R.musterSyns().filter((s) => R.musterPool(run, [s]).length).slice(0, CFG.musterPicks);
  ok(R.confirmMuster(run, syns) === null, '티켓으로 소집 확정');
  ok(run.credits === 0 && R.ticketCount(run) === 0 && run.musters === 1, '크레딧 그대로 · 티켓 소모 · 소집 횟수 +1');
  ok(R.useCheck({ ...run, inventory: [R.TICKET] } as RunState, 0, { k: 'run' }) !== null, '티켓은 직접 사용 불가');
  const r1 = mk(4), t0 = R.ticketPrice(r1), r2 = mk(4); r2.musters = 2;
  ok(R.ticketPrice(r2) > t0 && t0 === Math.round(CFG.musterCost * CFG.shop.ticket * R.shopMul(r1)), `티켓 가격 = 지정 소집 비용 × ${CFG.shop.ticket} × 상점 배율 (${t0})`);
}

// ── 7. 고르곤 교환
{
  const base = () => { const run = mk(6); run.node = { type: 'shop', merchant: 'gorgon', shop: R.genShop(run, 'gorgon') }; return run; };
  let run = base();
  ok(R.tradeErr(run) === '교환할 고급 · 희귀 장비가 없습니다', '낼 장비가 없으면 막힘');
  run.inventory = ['G_pow'];
  let r = R.gorgonTrade(run, 0);
  ok(!!r.got && r.got.length === 3 && r.got.filter((x) => x === 'C_pow').length >= 2 && r.got.every((x) => ALL_COMPONENTS.includes(x)), `고급 → 같은 재료 2 + 무작위 1 (${r.got})`);
  ok(run.inventory.length === 3 && !run.inventory.includes('G_pow') && !!run.node!.traded, '보관함: 1개 내고 3개 받음 · 교환 기록');
  run.inventory.push('A_pow_mnd');
  ok(!!R.gorgonTrade(run, run.inventory.length - 1).err, '상점마다 1번');
  run = base(); run.inventory = ['A_vit_def'];
  r = R.gorgonTrade(run, 0);
  ok(!!r.got && r.got.includes('C_vit') && r.got.includes('C_def'), `희귀 → 조합법 재료 2 + 무작위 1 (${r.got})`);
  run = base(); run.inventory = ['A_taunt'];
  ok(R.tradeYield('A_taunt').fixed.length === 0 && R.tradeYield('A_taunt').rand === 3, '조합법 없는 희귀 → 무작위 3');
  ok(ALL_ADVANCED.filter((id) => R.tradeYield(id).fixed.length === 2).length > 0 && ALL_GRADED.every((id) => R.tradeYield(id).fixed.length === 2), '조합법 재료 계산');
  run = base(); run.inventory = ['G_def', ...Array(CFG.inventoryMax - 1).fill('C_vit')];
  ok(R.tradeErr(run, 0) === '보관함 공간이 부족합니다', '보관함 자리 (1개 내고 3개)');
  run = base(); run.node!.merchant = 'yui'; run.inventory = ['G_def'];
  ok(!!R.tradeErr(run, 0), '고르곤이 아니면 교환 없음');
  run = base(); run.inventory = ['L_pow_mnd', 'C_vit'];
  ok(R.tradeOptions(run).length === 0, '전설 · 재료는 교환 대상 아님');
}

// ── 8. 만찬 백수정: 아군 진형에만 · 5초마다 다친 아군 3명 연쇄 회복 (8% → 6.4% → 5.12%)
{
  const run = mk(8);
  R.autoPlace(run);
  const enc = R.genEncounter(run, 'battle');
  run.node = { type: 'battle', enc };
  const g = encGeo(enc);
  let feast: Device | null = null, foeErr = '';
  for (let y = g.ay0; y <= g.ay1 && !feast; y++) for (let x = PAD; x < PAD + enc.n; x++) { const p = R.placeDevice(run, 'K_feast', { k: 'cell', x, y }); if (!p.err && p.dev) { feast = p.dev; break; } }
  for (let x = PAD; x < PAD + enc.n && !foeErr; x++) foeErr = R.placeDevice(run, 'K_feast', { k: 'cell', x, y: PAD + 1 }).err || '';
  ok(!!feast, '아군 진형 빈칸에 놓을 수 있다');
  ok(foeErr.length > 0, `적 진형 · 사이에는 못 놓는다 (${foeErr})`);
  ok(R.placeDevice(run, 'K_feast', { k: 'cell', x: PAD, y: g.ay0 - 1 }).err === '아군 진형에만 놓을 수 있습니다', '사이 칸: 아군 진형에만');
  enc.devices = feast ? [feast] : [];
  // 적은 멀리, 피해 없이 (회복량만 보려고)
  const b = buildBattle(run, enc, true);
  const fu = b.units.find((u) => u.mem.feast);
  ok(!!fu && fu.side === 0 && fu.category === 'struct', '전투: 아군 구조물로 나온다');
  ok(!!fu && fu.st.maxHp >= DEV.feast.hp, `내구도 ${fu?.st.maxHp}`);
  const allies = b.units.filter((u) => u.side === 0 && !u.isSummon && u !== fu);
  allies.forEach((u, i) => { u.hp = u.st.maxHp * (0.3 + 0.1 * i); });
  for (const e of b.units.filter((u) => u.side === 1)) { e.st.shoot = 0; e.st.strike = 0; e.st.tech = 0; e.noAttack = true; e.immobile = true; }
  const heals = () => b.events.filter((e) => e.k === 'heal' && e.src === fu?.id) as { k: 'heal'; id: number; v: number }[];
  while (b.t < DEV.feast.every - 0.2 && !b.over) b.step(CFG.tick);
  ok(heals().length === 0, '5초 전에는 회복 없음');
  const before = new Map(allies.map((u) => [u.id, u.hp]));
  while (b.t < DEV.feast.every + 0.2 && !b.over) b.step(CFG.tick);
  const h = heals();
  const want = allies.slice().sort((x, y) => before.get(x.id)! / x.st.maxHp - before.get(y.id)! / y.st.maxHp).slice(0, DEV.feast.n);
  ok(h.length === Math.min(DEV.feast.n, allies.length), `5초: ${h.length}명 회복`);
  ok(h.every((e, k) => e.id === want[k]?.id), '체력 비율이 낮은 순서 · 겹치지 않음');
  const ks = feastChain();
  ok(h.every((e, k) => Math.abs(e.v - b.S(want[k], 'maxHp') * ks[k]) < 1), `회복량 ${h.map((e, k) => `${Math.round(e.v)}/${Math.round(b.S(want[k], 'maxHp') * ks[k])}`).join(' · ')}`);
  ok(Math.abs(ks[1] - 0.064) < 1e-9 && Math.abs(ks[2] - 0.0512) < 1e-9, '연쇄 감소 8% → 6.4% → 5.12%');
  ok(b.events.some((e) => e.k === 'atk' && e.from === fu?.id) && b.events.filter((e) => e.k === 'atk' && e.chain).length >= 2, '연쇄 탄 연출 (수정 → 1 → 2 → 3)');
  while (b.t < DEV.feast.every * 2 + 0.2 && !b.over) b.step(CFG.tick);
  ok(heals().length > h.length, '10초에 다시');
  ok(!b.fighters(0).includes(fu!), '승패 판정에서 빠진다 (아군이 모두 쓰러지면 패배)');
}

// ── 9. 소모품 표 · 상인 데이터
{
  ok(!!CONSUMABLES.K_feast && !!CONSUMABLES.K_muster_ticket, '전용 상품은 소모품 표에 있다 (도감)');
  ok(MERCHANTS.every((m) => (['greet', 'again', 'buy', 'poor', 'full', 'refresh', 'norefresh', 'close', 'leave', 'idle', 'selC', 'selA'] as const).every((k) => m.lines[k].length >= 2)), '상인마다 상황별 대사 2줄 이상');
  ok(MERCHANT_BY_ID.gorgon.lines.tradeDone.length >= 2 && MERCHANT_BY_ID.yui.lines.pitch.length >= 2 && MERCHANT_BY_ID.laila.lines.pitch.length >= 2, '교환 · 권유 대사');
}

if (fails) { console.log(`상점 검사 실패 ${fails}건 (통과 ${passed})`); process.exitCode = 1; }
else console.log(`상점 검사 통과 (${passed}건)`);
