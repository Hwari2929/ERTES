// 전역 증강 검사: 합친 증강은 더는 나오지 않음 · 고유 효과 (경제 · 장비 · 기물 교체 · 전투 훅)가 실제로 작동
import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import { buildBattle } from '../src/engine/build';
import { GLOBAL_BY_ID, GLOBALS, RETIRED_GLOBALS } from '../src/data/globals';
import { DUST } from '../src/data/items';
import { RECRUITABLE, UNIT_BY_ID } from '../src/data/units';
import type { RunState } from '../src/types';

declare const process: { exitCode?: number };

let fails = 0, passed = 0;
const ok = (c: boolean, msg: string) => { if (c) passed++; else { fails++; console.log(`FAIL ${msg}`); } };
const STARTERS = RECRUITABLE.slice(0, 4).map((d) => d.id);
const GA = CFG.globalAug;
function mk(seed: number, diff = 0): RunState {
  const run = R.newRun(seed, STARTERS, 'waste', diff);
  run.pending = [];
  return run;
}

// 1. 합친 증강 · 등급
{
  const retired = RETIRED_GLOBALS.map((g) => g.id);
  ok(retired.every((id) => !GLOBALS.some((g) => g.id === id) && !!GLOBAL_BY_ID[id]), '합친 증강: 목록에서 빠지고 옛 세이브용 정의는 남음');
  let seen = 0;
  for (let s = 1; s <= 300; s++) { const run = mk(s); for (const id of R.rollGlobals(run)) if (retired.includes(id)) seen++; }
  ok(seen === 0, `합친 증강은 선택지에 나오지 않음 (${seen})`);
  ok(GLOBAL_BY_ID['G.squad'].tier === 'R', '대규모 편성 = 희귀');
  const flat = GLOBALS.filter((g) => g.team && Object.keys(g.team).every((k) => k === 'stats' || k === 'pct'));
  ok(!flat.length, `깡 능력치만 주는 팀 효과 없음 (${flat.map((g) => g.id).join(', ')})`);
}

// 2. 경제 · 장비 · 기물 교체
{
  const run = mk(2);
  const cap0 = run.mods.interestCap, inc0 = run.mods.nodeIncome;
  R.pickGlobal(run, 'G.salvage');
  ok(run.mods.interestCap === cap0 - GA.nodeCap && run.mods.nodeIncome === inc0 + GA.nodeCredit, '잔돈 영업: 이자 상한 - · 노드 수입 +');
  const c0 = run.credits; R.advance(run);
  ok(run.credits === c0 + GA.nodeCredit, `잔돈 영업: 노드를 지나면 크레딧 +${GA.nodeCredit}`);
}
{
  const run = mk(3);
  run.inventory = [];
  R.pickGlobal(run, 'G.scrap');
  ok(run.inventory.filter((x) => x.startsWith('C_')).length === GA.scrapN, `분해 작업대: 재료 ${GA.scrapN}개`);
  run.inventory = ['A_vit_pow', 'K_reroll'];
  const r = R.useConsumable(run, 1, { k: 'inv', i: 0 });
  ok(!!r && 'ok' in r && r.ok && run.inventory.includes('C_vit') && run.inventory.includes('C_pow') && run.inventory.includes(DUST) && !run.inventory.includes('K_reroll'), `분해 작업대: 재구성 회로 → 희귀 분해 + 성운 가루 (${run.inventory.join(',')})`);
  run.inventory = ['G_def+3', 'K_reroll'];
  R.useConsumable(run, 1, { k: 'inv', i: 0 });
  ok(run.inventory.filter((x) => x === DUST).length === 2 && run.inventory.includes('C_def'), `분해 작업대: 고급 → 재료 + 성운 가루 2 (${run.inventory.join(',')})`);
}
{
  const run = mk(4);
  run.globals.push('G.funds');
  run.node = { type: 'shop', shop: [{ item: 'C_vit', price: 12 }] } as RunState['node'];
  run.credits = 50;
  const xp0 = run.units.reduce((s, u) => s + u.xp + u.rank * 1000, 0);
  ok(!R.buyShop(run, 0), '포인트 적립: 구매');
  ok(run.units.reduce((s, u) => s + u.xp + u.rank * 1000, 0) > xp0 && run.mods.pts === 12 % GA.pointPer, `포인트 적립: 공명도 분배 · 남은 크레딧 ${run.mods.pts}`);
}
{
  const run = mk(5);
  run.credits = 100;
  R.pickGlobal(run, 'G.r_patron');
  ok(run.credits === 100 - Math.floor(100 * GA.spec) && run.mods.spec === Math.floor(100 * GA.spec), '투기 자금: 고른 순간 투자');
  const st = run.mods.spec!;
  run.step = run.map.length - 1; const before = run.credits; R.advance(run);
  ok(run.credits - before + (run.mods.spec || 0) >= Math.round(st * GA.specMin), `투기 자금: 다음 페이즈에 정산 (${before} → ${run.credits} · 새 투자 ${run.mods.spec})`);
}
{
  const run = mk(6);
  run.units[0].items = ['A_vit_pow', null, null];
  const before = run.units.map((u) => [u.defId, u.rank] as const);
  R.pickGlobal(run, 'G.l_rebirth');
  ok(run.units.length === before.length && run.units.every((u) => !before.some(([d]) => d === u.defId)), `윤회 계약: 전원 다른 기물 (${run.units.map((u) => UNIT_BY_ID[u.defId].name).join(' · ')})`);
  ok(run.units.every((u, i) => u.rank === Math.min(CFG.maxRank, before[i][1] + GA.rebirth)), '윤회 계약: 공명 등급 +3');
  ok(run.units.some((u) => u.items.includes('A_vit_pow')), '윤회 계약: 장비 유지');
}

// 3. 전투 훅
function battle(seed: number, gl: string[]) {
  const run = mk(seed);
  run.globals.push(...gl);
  const enc = R.genEncounter(run, 'battle');
  run.node = { type: 'battle', enc };
  const b = buildBattle(run, enc, false);
  return { run, b };
}
{
  const { b } = battle(7, ['G.aim', 'G.focus', 'G.pierce']);
  b.step(0.05);
  const foes = b.units.filter((u) => u.side === 1 && u.alive);
  ok(foes.filter((e) => e.statuses.some((s) => s.key === 'g.mark')).length === 1, '표적 지정: 적 1명에게 표적');
  ok(b.units.filter((u) => u.side === 0 && !u.isSummon).every((u) => u.mem.npCrit === 1), '약점 연산: 아군 전원 비물리 치명');
  for (let i = 0; i < 400 && !b.over; i++) b.step(0.05);
  ok(foes.some((e) => (e.mem.corrode || 0) > 0) && foes.every((e) => (e.mem.corrode || 0) <= GA.corrodeMax + 1e-9), '장갑 부식: 적중한 적의 방어도 감소 (최대 이내)');
  const marked = b.units.filter((u) => u.side === 1 && u.alive && u.statuses.some((s) => s.key === 'g.mark')).length;
  ok(marked <= 1, '표적 지정: 표적은 늘 1명 이하');
}
{
  const { b } = battle(8, ['G.reload']);
  const u = b.units.find((x) => x.side === 0 && x.weapon?.kind === 'mag');
  if (u) {
    const m = u.weapon!.mag || 1;
    u.ammo = m;
    for (let k = 0; k < 20; k++) for (const h of u.hooks) h.onKill?.(b, u, u);
    ok(u.ammo === m * GA.ammoCap, `탄피 회수: 처치마다 장전, 최대 ${GA.ammoCap * 100}% (${u.ammo}/${m})`);
  } else ok(true, '탄피 회수: 탄창 무기 아군 없음 (건너뜀)');
}
{
  const { b } = battle(9, ['G.amp', 'G.mind', 'G.shieldwall']);
  const us = b.units.filter((x) => x.side === 0 && !x.isSummon);
  const caster = us[0], other = us.find((x) => x !== caster && x.ult);
  if (other) { other.ultG = 0; for (const h of other.hooks) h.onAllyUlt?.(b, other, caster); ok(Math.abs((other.ultG || 0) - GA.ultChain) < 1e-9, '공명 연쇄: 다른 아군 궁극기 게이지 +10%'); }
  const foe = b.units.find((x) => x.side === 1)!;
  const sh0 = caster.shield;
  b.applyStatus(foe, caster, { type: 'stun', key: 'stun', dur: 1 }, 99);
  ok(caster.shield > sh0, '정화 반응: 해로운 효과 → 보호막');
  const sh1 = us[1].shield;
  b.kill(caster, foe);
  ok(us[1].shield > sh1, '최후의 방벽: 아군이 처음 쓰러지면 보호막');
}

if (fails) { console.log(`전역 증강 검사 실패 ${fails}건 (통과 ${passed})`); process.exitCode = 1; }
else console.log(`전역 증강 검사 통과 (${passed}건)`);
