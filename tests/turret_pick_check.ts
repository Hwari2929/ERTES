// 엔지니어 포탑 장비 고르기 점검 (수동 실행: npx esbuild tests/turret_pick_check.ts --bundle --platform=node --outfile=dist/turret_pick_check.cjs && node dist/turret_pick_check.cjs): 엔지니어 4명 출전 → 전투 칸 진입 때 고르기 → 하나 고르면 다음 고르기 → 모든 포탑에 두 장비 + 모든 주요 능력치 +modMaj×2
import * as R from '../src/engine/run';
import { buildBattle, deployed, engTier, synergyCounts } from '../src/engine/build';
import { UNITS } from '../src/data/units';
import { ENG_TUR, SYN_BY_ID } from '../src/data/synergies';
import { TURRET_GEAR_IDS } from '../src/data/items';
import type { RunState } from '../src/types';

declare const process: { exitCode: number; stdout: { write(s: string): void } };
let fails = 0;
const ok = (c: boolean, m: string) => { process.stdout.write(`${c ? 'ok  ' : 'FAIL'} ${m}\n`); if (!c) fails++; };

const engs = UNITS.filter((d) => d.traits.includes('ENG') && !d.traits.includes('EXPLORER')).map((d) => d.id);
const run: RunState = R.newRun(7, engs.slice(0, 1), 'waste');
run.pending = [];
for (const id of engs.slice(1, 4)) R.addUnit(run, id, 1);
run.fleet = 6;
R.autoPlace(run);
const nEng = synergyCounts(deployed(run), run).ENG || 0;
ok(nEng >= 4, `엔지니어 출전 ${nEng}명 (${SYN_BY_ID.ENG.name} ${engTier(run)}단계)`);
R.enterNode(run, 'battle');
const p1 = run.pending.find((p) => p.t === 'turretPick');
ok(!!p1 && p1.t === 'turretPick' && p1.options.length === ENG_TUR.offer && new Set(p1.options).size === ENG_TUR.offer, `전투 칸 진입 → 포탑 장비 고르기 (선택지 ${p1 && p1.t === 'turretPick' ? p1.options.join(',') : '-'})`);
ok(run.pending.filter((p) => p.t === 'turretPick').length === 1, '한 번에 고르기 하나만');
run.pending = run.pending.filter((p) => p.t === 'turretPick'); // 다른 알림은 치운다
const a = (run.pending[0] as { options: string[] }).options[0];
ok(R.pickTurretMod(run, 'T_nope') !== null, '선택지에 없는 장비는 거절');
ok(R.pickTurretMod(run, a) === null && run.turretMods?.[0] === a, `첫 고르기 ${a}`);
const p2 = run.pending[0];
ok(p2?.t === 'turretPick' && p2.tier === 2 && !p2.options.includes(a), '두 번째 고르기가 바로 이어서 (고른 장비 제외)');
const b = (p2 as { options: string[] }).options[0];
ok(R.pickTurretMod(run, b) === null && run.turretMods?.length === 2, `두 번째 고르기 ${b}`);
ok(!run.pending.some((p) => p.t === 'turretPick'), '4명이면 2개에서 멈춘다');
ok(!R.syncTurretPick(run), '다시 불러도 더 뜨지 않는다');

const bt = buildBattle(run, run.node!.enc!, false);
bt.start();
const ts = bt.units.filter((u) => u.defId === 'turret' && u.side === 0);
ok(ts.length >= ENG_TUR.count[engTier(run) - 1], `포탑 ${ts.length}기 설치`);
const base = ENG_TUR.maj[engTier(run) - 1];
ok(ts.every((t) => (t.tempItems || []).join() === [a, b].join()), '모든 포탑에 두 장비');
ok(ts.every((t) => t.mem.turretMaj === base + 2 * ENG_TUR.modMaj), `모든 포탑 모든 주요 능력치 ${base} + ${2 * ENG_TUR.modMaj} (실제 ${ts.map((t) => t.mem.turretMaj).join(',')})`);

// 단계가 내려가도 남는다
for (const u of run.units.slice(1)) u.pos = null;
ok(run.turretMods?.length === 2 && !R.syncTurretPick(run), '엔지니어가 줄어도 고른 장비는 그대로');

// 옛 저장 이전: 포탑 장비 칸 · 보관함 T_ → turretMods (엔지니어 단계만큼), 정비 상점 닫기
const old = R.newRun(9, engs.slice(0, 1), 'waste');
old.pending = [];
for (const id of engs.slice(1, 6)) R.addUnit(old, id, 1);
old.fleet = 6; R.autoPlace(old);
const o = old as RunState & { turretGear?: (string | null)[][] };
o.turretGear = [['T_cal', null], ['T_cal', 'T_rapid']];
old.inventory = ['C_pow', 'T_snipe', 'T_tesla', 'T_mark'];
old.node = { type: 'shop', shop: [{ item: 'T_plate', price: 9, sold: false }], ...({ maint: true } as object) };
const step0 = old.step;
delete (old as { turretMods?: unknown }).turretMods;
R.migrate(old);
const tier = engTier(old);
ok(!('turretGear' in old), '옛 turretGear 삭제');
ok(JSON.stringify(old.turretMods) === JSON.stringify(['T_cal', 'T_rapid', 'T_snipe'].slice(0, Math.min(3, tier))), `turretMods = ${JSON.stringify(old.turretMods)} (엔지니어 ${tier}단계)`);
ok(old.inventory.join() === 'C_pow', '보관함의 포탑 장비 제거');
ok(old.node === null && old.step === step0 + 1, '열려 있던 정비 상점은 떠난 것으로');
ok(TURRET_GEAR_IDS.length === 11, '포탑 장비 11종');

process.stdout.write(fails ? `\n${fails}건 실패\n` : '\n포탑 장비 고르기 점검 통과\n');
if (fails) process.exitCode = 1;
