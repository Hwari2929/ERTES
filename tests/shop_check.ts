// 상점 · 상인 검사 (npm run check): 진열 6~9개 (3×3 진열대, 개수 분포) · 상인 전용 상품 · 할인 분포 · 새로고침 (비용 × 상점 배율 · 개수도 다시) ·
// 이자 지키며 쓸 수 있음 · 지정 소집 티켓 (상점 칸이 열린 채로도) · 고르곤 교환 · 만찬 백수정 연쇄 회복 · 다시 열어도 같은 진열.
import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import { buildBattle, encGeo, PAD } from '../src/engine/build';
import { FIELDS, fieldOf } from '../src/data/battlefields';
import { MERCHANT_BY_ID, MERCHANTS, merchantPool } from '../src/data/merchants';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, combine, CONSUMABLES, CRYSTAL, DUST, itemEffect, itemInfo, potPool, POTS, potsOf, SHARD } from '../src/data/items';
import { DEV, type Device, feastChain } from '../src/data/devices';
import { RECRUITABLE } from '../src/data/units';
import type { RunState } from '../src/types';
import { Rng } from '../src/rng';
declare const process: { exitCode?: number };

let fails = 0, passed = 0;
const ok = (c: boolean, msg: string) => { if (c) passed++; else { fails++; console.log(`FAIL ${msg}`); } };
const STARTERS = RECRUITABLE.slice(0, 4).map((d) => d.id);
const CNT = CFG.shop.count, CMIN = Math.min(...CNT.map(([n]) => n)), CMAX = Math.max(...CNT.map(([n]) => n));
const inRange = (n: number) => n >= CMIN && n <= CMAX && n <= CFG.shop.slots;
function mk(seed: number, field = 'waste', diff = 0, phase = 1): RunState {
  const run = R.newRun(seed, STARTERS, field, diff);
  run.pending = [];
  run.phase = phase;
  return run;
}

// ── 1. 진열 6~9개 · 서로 다름 · 전용 상품 · 가격 · 고르곤 전설 확률
{
  let n = 0, bad = 0, exMiss = 0, badPrice = 0;
  const legend: Record<string, [number, number]> = {};
  let seed = 1;
  for (const f of FIELDS) for (const diff of [0, 6, 7]) for (const phase of [1, 3, 6]) for (let s = 1; s <= 12; s++) for (const m of MERCHANTS) {
    const run = mk(seed++ * 7919, f.id, diff, phase);
    const shop = R.genShop(run, m.id);
    n++;
    const ids = shop.map((x) => x.item);
    if (!inRange(ids.length) || new Set(ids).size !== ids.length) { bad++; if (bad < 4) console.log('  진열', m.id, phase, JSON.stringify(ids)); }
    if (m.ex && !shop.some((x) => x.item === m.ex && x.ex)) exMiss++;
    if (shop.some((x) => !(x.price > 0) || !Number.isFinite(x.price) || (x.base !== undefined && !(x.base > x.price)))) badPrice++;
    const k = `${m.id}:${phase === 1 ? 'p1' : phase === 6 ? 'p6' : 'p3'}`;
    const l = (legend[k] ||= [0, 0]); l[1]++; if (ids.some((x) => x.startsWith('L_'))) l[0]++;
  }
  ok(bad === 0, `진열 ${n}개 상점 모두 ${CMIN}~${CMAX}개 (진열대 ${CFG.shop.slots}칸 이하) · 같은 물품 없음 (어긋남 ${bad})`);
  ok(exMiss === 0, `상인 전용 상품 늘 진열 (빠짐 ${exMiss})`);
  ok(badPrice === 0, `가격은 양수 · 할인 칸은 원래 가격 > 할인가 (어긋남 ${badPrice})`);
  const rate = (k: string) => legend[k][0] / legend[k][1];
  ok(rate('gorgon:p1') > 0.1 && rate('gorgon:p1') < 0.32, `고르곤 1페이즈 전설 ≈ ${CFG.shop.gorgonLegend} (${rate('gorgon:p1').toFixed(3)})`);
  ok(rate('yui:p1') === 0 && rate('laila:p3') === 0, '다른 상인은 1 · 3페이즈 전설 없음');
  ok(rate('yui:p6') > 0 && rate('yui:p6') < 0.15, `다른 상인 6페이즈 전설 ≈ ${CFG.drop.shopLegend} (${rate('yui:p6').toFixed(3)})`);
}

// ── 2. 할인 분포 · 진열 개수 분포 (많은 시드)
{
  const cnt = [0, 0, 0, 0];
  const len: Record<number, number> = {};
  let sales = 0, rare = 0, badPct = 0, exMiss = 0;
  const N = 4000;
  for (let s = 0; s < N; s++) {
    const m = MERCHANTS[s % MERCHANTS.length];
    const shop = R.genShop(mk(10007 + s * 31, 'waste', 0, 1 + (s % 8)), m.id);
    len[shop.length] = (len[shop.length] || 0) + 1;
    if (m.ex && !shop.some((x) => x.item === m.ex && x.ex)) exMiss++;
    const d = shop.filter((x) => x.off);
    cnt[Math.min(3, d.length)]++;
    for (const x of d) { sales++; if (x.off === CFG.shop.sale.rare) rare++; else if (!CFG.shop.sale.pct.includes(x.off!)) badPct++; }
  }
  const p = cnt.map((c) => c / N);
  ok(CFG.shop.sale.n.every((q, k) => Math.abs(p[k] - q) < 0.03), `할인 칸 수 0 · 1 · 2 · 3 분포 ${p.map((x) => x.toFixed(3)).join(' · ')} ≈ ${CFG.shop.sale.n.join(' · ')}`);
  ok(badPct === 0, '할인율은 설정값 중 하나');
  ok(Math.abs(rare / sales - CFG.shop.sale.rareP) < 0.015, `${CFG.shop.sale.rare}% 할인 비율 ${(rare / sales).toFixed(3)} ≈ ${CFG.shop.sale.rareP}`);
  ok(Object.keys(len).every((k) => inRange(+k)), `진열 개수는 ${CMIN}~${CMAX} (${Object.keys(len).join(' · ')})`);
  ok(CNT.every(([k, q]) => Math.abs((len[k] || 0) / N - q) < 0.03), `진열 개수 분포 ${CNT.map(([k]) => `${k}개 ${((len[k] || 0) / N).toFixed(3)}`).join(' · ')} ≈ ${CNT.map(([k, q]) => `${k}개 ${q}`).join(' · ')}`);
  ok(exMiss === 0, `몇 개를 진열하든 전용 상품 (빠짐 ${exMiss})`);
  // 6개 상점에서도 굴린 전설은 남는다 (고르곤, 전용 다음 순서): 같은 씨앗을 9개로 굴린 것과 전설 유무가 같다
  const c0 = CFG.shop.count;
  const setCount = (c: [number, number][]) => { (CFG.shop as { count: [number, number][] }).count = c; };
  let g6 = 0, g6L = 0, g6miss = 0;
  for (let s = 0; s < 400; s++) {
    setCount([[CMIN, 1]]);
    const shop = R.genShop(mk(70001 + s * 13, 'waste', 0, 1 + (s % 8)), 'gorgon');
    setCount([[CFG.shop.slots, 1]]);
    const full = R.genShop(mk(70001 + s * 13, 'waste', 0, 1 + (s % 8)), 'gorgon');
    setCount(c0);
    g6++;
    const L6 = shop.some((x) => x.item.startsWith('L_')), L9 = full.some((x) => x.item.startsWith('L_'));
    if (L6) g6L++;
    if (L6 !== L9 || shop.length !== CMIN) g6miss++;
  }
  ok(g6miss === 0 && g6L > 40, `고르곤 ${CMIN}개 상점: 전설 굴림이 잘리지 않는다 (${g6}개 중 전설 ${g6L} · 어긋남 ${g6miss})`);
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
  const n0 = run.node!.shop!.length;
  R.buyShop(run, run.node!.shop!.findIndex((x) => x.price <= run.credits));
  ok(run.node!.shop!.length === n0 && run.node!.shop!.filter((x) => x.sold).length === 1, '산 칸은 품절로 남는다 (채우지 않음 · 개수 그대로)');
}

// ── 4. 새로고침: 페이즈마다 1번 · 첫 번 무료 · 그다음 (base, +step) × 상점 배율 (진열 가격과 같은 shopMul: 전장 · 관세 · 단골 할인) · 진열 개수도 다시
{
  const RF = CFG.shop.refresh;
  const WASTE = fieldOf('waste').shopMul || 1;
  const cases: [string, boolean, boolean, number][] = [['swarm', false, false, 1], ['waste', false, false, WASTE], ['livin', false, false, 1.15], ['waste', true, false, WASTE * (1 + CFG.despair.tariff)], ['waste', true, true, WASTE * (1 + CFG.despair.tariff) * (1 - CFG.globalAug.discount)], ['swarm', false, true, 1 - CFG.globalAug.discount]];
  for (const [field, tariff, discount, expMul] of cases) {
    const run = mk(9, field);
    if (tariff) run.despairs = [...(run.despairs || []), 'D.tariff'];
    if (discount) run.globals.push('G.discount');
    const mul = R.shopMul(run), want = (b: number) => Math.max(1, Math.round(b * mul)), lab = `${field}${tariff ? ' · 관세' : ''}${discount ? ' · 단골 할인' : ''} ×${+mul.toFixed(4)}`;
    ok(Math.abs(mul - expMul) < 1e-9, `[${lab}] 상점 배율 = ${+expMul.toFixed(4)}`);
    run.credits = 100;
    R.openShop(run);
    const m = run.node!.merchant!;
    ok(R.refreshInfo(run).cost === 0 && !R.refreshInfo(run).used, `[${lab}] 첫 새로고침 무료`);
    ok(R.refreshShop(run) === null && run.credits === 100, `[${lab}] 무료 새로고침 성공`);
    ok(run.node!.merchant === m && inRange(run.node!.shop!.length), `[${lab}] 새로고침: 상인 그대로 · ${CMIN}~${CMAX}개`);
    ok(!!R.refreshShop(run) && R.refreshInfo(run).used, `[${lab}] 같은 페이즈 두 번째는 막힘`);
    run.phase = 2;
    const c1 = R.refreshInfo(run).cost;
    ok(R.refreshInfo(run).base === RF.base && c1 === want(RF.base), `[${lab}] 다음 페이즈 비용 ${RF.base} × 배율 = ${c1}`);
    R.refreshShop(run);
    ok(run.credits === 100 - c1, `[${lab}] 배율 적용 비용 차감 (−${c1})`);
    run.phase = 3;
    const c2 = R.refreshInfo(run).cost;
    ok(c2 === want(RF.base + RF.step), `[${lab}] 그다음 (${RF.base} + ${RF.step}) × 배율 = ${c2}`);
    run.credits = c2 - 1;
    ok(R.refreshShop(run) === '크레딧 부족', `[${lab}] 크레딧이 모자라면 막힘`);
    const ex = MERCHANT_BY_ID[m].ex;
    ok(!ex || run.node!.shop!.some((x) => x.item === ex), `[${lab}] 새로고침 뒤에도 전용 상품`);
  }
  // 배율이 1이 아니면 숫자가 실제로 바뀐다 (황무지 ×shopMul)
  const rw = mk(9, 'waste');
  rw.shopRf = { n: 1, ph: 0 };
  ok(R.refreshInfo(rw).cost === Math.round(RF.base * (fieldOf('waste').shopMul || 1)) && R.refreshInfo(rw).cost !== RF.base, `황무지 유료 첫 새로고침 ${RF.base} → ${R.refreshInfo(rw).cost}`);
  // 새로고침은 진열 개수도 다시 뽑는다 (유이 티켓은 늘)
  const lens = new Set<number>();
  let exMiss = 0;
  const run = mk(19);
  R.openShop(run);
  run.node!.merchant = 'yui';
  for (let i = 0; i < 80; i++) {
    run.phase = 1 + i; run.credits = 999;
    if (R.refreshShop(run)) break;
    lens.add(run.node!.shop!.length);
    if (!run.node!.shop!.some((x) => x.item === R.TICKET && x.ex)) exMiss++;
  }
  ok(lens.size >= 3 && [...lens].every(inRange), `새로고침마다 진열 개수가 바뀐다 (${[...lens].sort().join(' · ')})`);
  ok(exMiss === 0, '새로고침 뒤에도 유이 티켓');
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

// ── 6b. 상점 칸이 열린 채 지정 소집: 티켓이 있으면 허용 (크레딧 소집은 막힘), 상인 · 진열 · 품절은 그대로
{
  const run = mk(41);
  run.credits = 200;
  R.openShop(run);
  run.node!.met = true;
  R.buyShop(run, run.node!.shop!.findIndex((x) => !x.ex && x.price <= run.credits));
  const snap = JSON.stringify(run.node);
  ok(R.openMuster(run) === R.SHOP_TICKET_ONLY && R.musterBlock(run) === R.SHOP_TICKET_ONLY && !run.pending.length, '상점 칸 + 티켓 없음: 크레딧이 넉넉해도 소집 막힘 (티켓만)');
  run.inventory.push(R.TICKET, R.TICKET);
  ok(R.musterBlock(run) === null && R.openMuster(run) === null && run.pending[0]?.t === 'muster', '상점 칸 + 티켓: 소집 창이 열린다');
  ok(R.musterBlock(run) !== null, '소집 창이 떠 있는 동안 다시 열 수 없다');
  R.cancelMuster(run);
  ok(!run.pending.length && JSON.stringify(run.node) === snap, '소집 취소: 상점 그대로');
  R.openMuster(run);
  const syns = R.musterSyns().filter((s) => R.musterPool(run, [s]).length).slice(0, CFG.musterPicks);
  const cr0 = run.credits, mu0 = run.musters || 0;
  ok(R.confirmMuster(run, syns) === null && run.pending[0]?.t === 'recruit', '상점 칸에서 티켓으로 소집 확정 → 영입 창');
  ok(run.credits === cr0 && R.ticketCount(run) === 1 && run.musters === mu0 + 1, '크레딧 그대로 · 티켓 1장 소모 · 소집 횟수 +1');
  const p = run.pending[0] as { t: 'recruit'; options: string[] };
  R.recruit(run, p.options[0]);
  run.pending.shift();
  ok(run.units.some((u) => u.defId === p.options[0]), '영입 완료');
  ok(run.node?.type === 'shop' && JSON.stringify(run.node) === snap, '소집 · 영입 뒤에도 같은 상인 · 같은 진열 · 같은 품절');
  const back = JSON.parse(JSON.stringify(run)) as RunState;
  ok(JSON.stringify(back.node) === snap, '저장 · 불러오기 뒤에도 같은 상점');
  // 그사이 티켓이 없어지면 확정을 막는다 (상점 칸에서는 크레딧으로 넘어가지 않는다)
  R.openMuster(run);
  run.inventory = run.inventory.filter((x) => x !== R.TICKET);
  ok(R.confirmMuster(run, syns) === R.SHOP_TICKET_ONLY && run.pending[0]?.t === 'muster', '상점 칸: 티켓이 없어지면 막힘');
  R.cancelMuster(run);
  // 상점이 아닌 칸 (전투 편성 중)은 티켓이 있어도 막힘
  const r2 = mk(42);
  r2.inventory.push(R.TICKET);
  r2.node = { type: 'battle', enc: R.genEncounter(r2, 'battle') };
  ok(!!R.openMuster(r2) && R.musterBlock(r2) !== R.SHOP_TICKET_ONLY && !r2.pending.length, '전투 칸은 티켓이 있어도 막힘');
  // 상점을 떠난 뒤 (칸 없음)는 크레딧 소집 그대로
  const r3 = mk(43);
  r3.credits = 200;
  R.openShop(r3);
  R.leaveShop(r3);
  r3.pending = [];
  ok(R.openMuster(r3) === null, '상점을 떠나면 크레딧 소집 가능');
}

// ── 7. 고르곤 교환
{
  const base = () => { const run = mk(6); run.node = { type: 'shop', merchant: 'gorgon', shop: R.genShop(run, 'gorgon') }; return run; };
  let run = base();
  ok(R.tradeErr(run) === '교환할 고급 · 희귀 장비가 없습니다', '낼 장비가 없으면 막힘');
  run.inventory = ['G_pow'];
  let r = R.gorgonTrade(run, 0);
  ok(!!r.got && r.got.length === 3 && r.got[0] === 'S_dust' && r.got[1] === 'C_pow' && ALL_COMPONENTS.includes(r.got[2]), `고급 모듈 → 성운 가루 + 같은 재료 + 무작위 재료 1 (${r.got})`);
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
  for (const e of b.units.filter((u) => u.side === 1)) { e.st.shoot = 0; e.st.strike = 0; e.st.tech = 0; e.noAttack = true; e.immobile = true; e.st.maxHp = e.hp = 1e9; } // 10초 동안 전투가 끝나지 않게
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

// ── 8. 합성 재료 (성운 가루 · 별무리 파편 · 백수정 조각) · 제련
{
  ok(combine(DUST, 'C_pow') === 'G_pow' && combine('C_pow', DUST) === 'G_pow', '성운 가루 + 재료 = 고급 모듈 (순서 무관)');
  ok(combine('C_pow', 'C_pow') === 'A_pow_pow' && combine('C_vit', 'C_pow') === 'A_vit_pow', '재료 2개 = 희귀 (같은 재료 → 같은 재료 희귀)');
  ok(combine(DUST, DUST) === SHARD, '성운 가루 2개 = 별무리 파편');
  ok(combine(DUST, 'G_pow') === 'G_pow+1' && combine('G_pow+4', DUST) === 'G_pow+5' && combine(DUST, 'G_pow+5') === null, '성운 가루 + 고급 모듈 = 제련 1단계 (최대 5)');
  ok(combine(SHARD, 'L_pow_pow') === 'L_pow_pow+1' && combine('L_vit_pow+4', SHARD) === 'L_vit_pow+5' && combine(SHARD, 'L_vit_pow+5') === null, '별무리 파편 + 전설 = 제련 1단계 (최대 5)');
  ok(combine(SHARD, 'C_pow') === null && combine(SHARD, 'G_pow') === null && combine(DUST, 'L_pow_pow') === null && combine(SHARD, 'A_pow_mnd') === null && combine(SHARD, 'L_helanchor') === null && combine(CRYSTAL, 'C_pow') === null && combine(SHARD, SHARD) === null, '그 밖의 조합은 불가 (동맹 전설 · 백수정 조각 포함)');
  const pts = (id: string) => itemEffect(id).majors?.pow || 0;
  ok(pts('G_pow') === 9 && pts('G_pow+1') === 12 && pts('G_pow+5') === 24, `고급 모듈 제련: 9 → 12 … 24 (${pts('G_pow')} · ${pts('G_pow+1')} · ${pts('G_pow+5')})`);
  ok(pts('L_pow_pow') === 18 && pts('L_pow_pow+1') === 24 && pts('L_pow_pow+5') === 48, `전설 집중형 제련: 18 → 24 … 48 (${pts('L_pow_pow')} · ${pts('L_pow_pow+5')})`);
  const lm = itemEffect('L_pow_mnd+5').majors || {};
  ok(lm.pow === 24 && lm.mnd === 24 && (itemEffect('L_pow_mnd').majors || {}).pow === 9, `전설 분산형 제련: 각각 9 → 24 (${lm.pow} · ${lm.mnd})`);
  ok(Object.keys(itemEffect('L_pow_mnd+3')).length === Object.keys(itemEffect('L_pow_mnd')).length, '전설 제련: 특수 효과는 그대로');
  ok(itemInfo('G_pow+2').name.endsWith('+2') && itemInfo('G_pow+2').refine === 2 && itemInfo('L_pow_mnd+3').refine === 3, '제련 단계가 이름 · 정보에 표시');
  const run = mk(3);
  const u = run.units[0];
  u.items = ['C_pow', null, null]; run.inventory = [DUST];
  ok(!R.equipCheck(run, DUST, u.uid) && !R.equip(run, 0, u.uid) && u.items[0] === 'G_pow', '성운 가루를 재료 든 기물에 주면 그 칸에서 고급 모듈');
  u.items = ['A_pow_mnd', null, null]; run.inventory = [SHARD];
  ok(!!R.equipCheck(run, SHARD, u.uid) && run.inventory.length === 1, '합성할 장비가 없으면 합성 재료는 장착되지 않음');
  u.items = ['G_vit+1', null, null]; run.inventory = [DUST];
  ok(!R.equip(run, 0, u.uid) && u.items[0] === 'G_vit+2', '성운 가루를 고급 모듈 든 기물에 주면 제련');
  u.items = ['L_vit_pow', null, null]; run.inventory = [SHARD];
  ok(!R.equip(run, 0, u.uid) && u.items[0] === 'L_vit_pow+1', '별무리 파편을 전설 든 기물에 주면 제련');
  u.items = ['G_vit+1', 'G_pow', 'A_pow_mnd']; run.inventory = [DUST];
  ok(R.equipCombo(run, DUST, u.uid, 1)?.slot === 1 && !R.equip(run, 0, u.uid, 1) && u.items[0] === 'G_vit+1' && u.items[1] === 'G_pow+1', `고급 모듈 여럿: 성운 가루를 놓은 칸만 제련 (${u.items.join(' · ')})`);
  run.inventory = [DUST];
  ok(R.equipCombo(run, DUST, u.uid, 2)?.slot === 0, '조합되지 않는 칸에 놓으면 앞 칸부터 찾는다');
  ok(R.tradeOptions({ ...run, inventory: ['G_pow+3'] } as RunState).length === 1, '제련한 고급 모듈도 교환 가능');
  const rg = new Rng(7), draws = [...Array(400)].map(() => R.pickMat(rg));
  ok(CFG.craft.crystal ? draws.includes(CRYSTAL) && draws.includes(DUST) : draws.every((x) => x === DUST), `합성 재료 드롭: 백수정 조각 ${CFG.craft.crystal ? '켜짐 (3 : 1)' : '꺼짐 → 성운 가루만'}`);
}

// ── 9. 잠재능력 (백수정 조각)
{
  ok(combine(CRYSTAL, 'A_pow_mnd') === 'A_pow_mnd#?' && combine('L_pow_mnd#pow1', CRYSTAL) === 'L_pow_mnd#pow1.?', '백수정 조각: 빈 칸 하나 개방');
  ok(combine(CRYSTAL, 'A_pow_mnd#pow1') === 'A_pow_mnd#pow1.?' && combine(CRYSTAL, 'A_pow_mnd#pow1.mnd2') === 'A_pow_mnd#?.?' && combine(CRYSTAL, 'L_pow_mnd+2#pow1.mnd2.pow3') === 'L_pow_mnd+2#?.?.?', '희귀 2칸 · 전설 3칸, 다 열린 장비: 모두 다시 뽑기 (제련 단계는 유지)');
  ok(combine(CRYSTAL, 'G_pow') === null && combine(CRYSTAL, 'L_helanchor') === null && combine(CRYSTAL, 'A_pow_mnd#?') === null && combine(CRYSTAL, 'C_pow') === null, '고급 · 동맹 전설 · 재료에는 쓸 수 없음');
  ok(potPool('A_pow_mnd').length === 8 && potPool('L_pow_pow').length === 4 && potPool('A_pow_mnd').every((k) => ['pow', 'mnd'].includes(POTS[k].major)), '후보: 장비 재료의 잠재능력 (같은 재료면 4종)');
  const run = mk(5);
  let allIn = true, distinct = true, changed = true;
  for (let i = 0; i < 60; i++) {
    const r1 = R.rollPots(run, 'L_pow_mnd#?.?'), p1 = potsOf(r1);
    allIn &&= p1.every((k) => potPool('L_pow_mnd').includes(k)); distinct &&= p1.length === 2 && p1[0] !== p1[1];
    const r2 = R.rollPots(run, 'A_vit_vit#?', 'A_vit_vit#vit1'); changed &&= potsOf(r2)[0] !== 'vit1';
  }
  ok(allIn && distinct, '굴린 잠재능력: 후보 안에서 · 겹치지 않게');
  ok(changed, '다시 뽑기: 적어도 하나는 바뀜');
  ok((itemEffect('A_pow_pow#pow2').stats?.armorPen || 0) === 0.2 && (itemEffect('A_pow_mnd#pow1', 'x', 'MARK').pct?.shoot || 0) === 0.2 && (itemEffect('A_pow_mnd#pow1', 'x', 'VAN').pct?.strike || 0) === 0.2, '잠재능력 효과 · 주 위력은 전투 유형을 따름');
  const u = run.units[0];
  u.items = ['A_vit_pow', null, null]; run.inventory = [CRYSTAL];
  ok(!R.equip(run, 0, u.uid) && potsOf(u.items[0]!).length === 1 && !u.items[0]!.includes('?'), `기물에 단 희귀에 백수정 조각 → 바로 개방 (${u.items[0]})`);
  u.items = ['A_vit_pow', 'A_def_agi', null]; run.inventory = [CRYSTAL];
  ok(!R.equip(run, 0, u.uid, 1) && potsOf(u.items[1]!).length === 1 && potsOf(u.items[0]!).length === 0, `희귀 여럿: 백수정 조각을 놓은 칸만 개방 (${u.items.join(' · ')})`);
  run.inventory = [CRYSTAL, 'A_def_agi'];
  const got = R.combineInv(run, 0, 1);
  ok(!!got && potsOf(got).length === 1 && !got.includes('?') && run.inventory.length === 1, `보관함 합성 → 개방 (${got})`);
  ok(itemInfo('L_pow_mnd+1#pow1.mnd3').desc.includes(POTS.pow1.name) && itemInfo('L_pow_mnd+1#pow1.mnd3').refine === 1, '설명에 잠재능력 · 제련 단계');
}

// ── 10. 소모품 겹치기 · 바리케이드 2회 · 캣휠(ZI존) 제련 · 잠재능력 · 밍키 별무리 파편 · 출처
{
  const run = mk(10, 'waste', 7);
  run.inventory = ['K_strip', 'K_strip', 'K_reroll', 'A_vit_pow'];
  ok(R.invSlots(run) === 3, `같은 소모품은 한 칸 (${R.invSlots(run)})`);
  run.inventory = [...Array(CFG.inventoryMax - 1).keys()].map((i) => ALL_COMPONENTS[i % ALL_COMPONENTS.length]).concat('K_mine');
  ok(R.invFull(run) && !R.invFull(run, 'K_mine') && R.invFull(run, 'K_net'), '가득 차도 이미 든 소모품은 겹쳐 들어감');
  ok(R.gainItem(run, 'K_mine') === 'K_mine' && run.inventory.filter((x) => x === 'K_mine').length === 2, '가득 찬 보관함에 같은 소모품 획득');
  run.inventory = [];
  R.gainItem(run, 'K_barricade');
  ok(run.inventory.filter((x) => x === 'K_barricade').length === DEV.wall.uses, `바리케이드 1개 = ${DEV.wall.uses}회분`);
  ok(!CONSUMABLES.K_seize.legend, '강제 징수기는 일반 소모품');
  let jg = 0, jbad = 0, j2 = 0;
  for (let sd = 1; sd <= 400; sd++) {
    const r = mk(sd, 'waste', 7, 2);
    for (const c of R.genSupply(r)) {
      if (c.mult === 2) j2++;
      if (c.mult >= CFG.supply.jackpotLegend && c.kind === 'gear') { jg++; if (!c.items.every((x) => x[0] === 'L')) jbad++; }
    }
  }
  ok(jg > 0 && jbad === 0 && j2 > 0, `보급 대박 ×${CFG.supply.jackpotLegend} 장비 카드 = 전설 확정 (${jg}장 · ×2 ${j2}장)`);
  ok(itemInfo('A_def_agi').desc.includes('방어도의 75%') && itemInfo('L_def_agi').desc.includes('방어도의 150%'), '반응 장갑: 방어도의 75% (전설 ×2 = 150%)');
  let cp = 0, seize = 0;
  for (let sd = 1; sd <= 300; sd++) {
    const r = mk(sd, 'waste', 7, 3);
    r.node = { type: 'shop' } as RunState['node'];
    const stock = R.genShop(r).map((x) => x.item);
    if (stock.some((x) => x.startsWith('K_cp_'))) cp++;
    if (stock.includes('K_seize')) seize++;
  }
  ok(cp === 0, `일반 의뢰 상점에 정화 분무기 · 선지급 어음 없음 (${cp})`);
  ok(seize > 0, `일반 소모품 진열에 강제 징수기 (${seize}/300)`);
  const zi = 'L_catwheel_zi';
  ok(combine(SHARD, zi) === zi + '+1' && combine(SHARD, zi + '+5') === null, '캣휠(ZI존) 별무리 파편 제련 (최대 5)');
  const z = CFG.despair.ziMajors;
  ok(itemInfo(zi + '+3').majors.vit === z + 3 * CFG.craft.ziPts && itemEffect(zi + '+3').majors?.agi === z + 3 * CFG.craft.ziPts, '제련 단계마다 모든 주요 능력치 +ziPts');
  ok(combine(CRYSTAL, zi) === zi + '#?' && potPool(zi).length === Object.keys(POTS).length, '캣휠(ZI존) 잠재능력: 2칸 · 모든 잠재능력 후보');
  ok((itemEffect(zi + '#pow2').stats?.armorPen || 0) === 0.2, '캣휠(ZI존) 잠재능력 효과');
  const mk2 = mk(11);
  const u = mk2.units[0];
  u.defId = 'mingki'; u.items = [null, null, null];
  const xp0 = u.xp, r0 = u.rank;
  mk2.inventory = [SHARD];
  ok(!R.equip(mk2, 0, u.uid) && !mk2.inventory.length && u.items.every((x) => x === null) && (u.rank > r0 || u.xp === xp0 + CFG.craft.mingkiShardXp), '밍키에게 별무리 파편: 삼키고 공명도');
  const v = mk2.units[1]; mk2.inventory = [SHARD];
  ok(!!R.equip(mk2, 0, v.uid) && mk2.inventory.length === 1, '다른 기물에게는 별무리 파편을 끼울 수 없음');
}

if (fails) { console.log(`상점 검사 실패 ${fails}건 (통과 ${passed})`); process.exitCode = 1; }
else console.log(`상점 검사 통과 (${passed}건)`);
