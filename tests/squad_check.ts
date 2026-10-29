// 적 분대 검사 (data/squads.ts · run.ts assembleSquads · placeSquads · build.ts linkDuo):
// 적 수 = 분대 인원 합 · 분대 진형 (전열 앞줄 · 사격선 뒷줄 · 포병 듀오 뒷줄 + 바로 앞) · 포병 듀오가 체력을 나눠 쓰고 함께 쓰러진다
import * as R from '../src/engine/run';
import { buildBattle, deployed } from '../src/engine/build';
import { CFG } from '../src/config';
import { FIELDS } from '../src/data/battlefields';
import { RECRUITABLE } from '../src/data/units';
declare const process: { exit(code: number): never };

let fail = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fail++; };
const ids = RECRUITABLE.slice(0, 4).map((u) => u.id);
const kinds: Record<string, number> = {};
let encs = 0, bad = 0, badForm = 0, duos = 0;
for (const f of FIELDS) for (let p = 1; p <= 5; p++) for (let s = 0; s < 6; s++) {
  const run = R.newRun(100 + s * 7 + p * 131, ids, f.id, 7);
  run.phase = p; run.step = s;
  for (const type of ['battle', 'adversity', 'boss'] as const) {
    const enc = R.genEncounter(run, type, p);
    encs++;
    if (!enc.squads?.length || enc.enemies.some((e) => e.sq === undefined || !enc.squads![e.sq])) { bad++; continue; }
    for (const q of enc.squads) kinds[q.kind] = (kinds[q.kind] || 0) + 1;
    const rows = enc.n === CFG.bossBoard ? 3 : 3;
    enc.squads.forEach((q, i) => {
      const m = enc.enemies.filter((e) => e.sq === i && !e.flip);
      if (q.kind === 'duo' && m.length === 2) { duos++; const b = m.find((e) => e.duo === 'b'), fr = m.find((e) => e.duo === 'f'); if (!b || !fr || b.c !== fr.c || b.row !== 0 || fr.row !== 1) badForm++; }
      if (q.kind === 'line' && m.length === enc.enemies.filter((e) => e.sq === i).length && m.some((e) => e.row !== rows - 1) && enc.enemies.filter((e) => e.row === rows - 1).length < enc.n) badForm++;
    });
  }
}
ok(bad === 0, `조우 ${encs}개: 모든 적이 분대에 속한다 (분대 없는 조우 ${bad})`);
ok(badForm === 0, `분대 진형: 포병 듀오 ${duos}개 뒷줄 + 바로 앞 · 전열 앞줄 (어긋남 ${badForm})`);
ok(['line', 'fire', 'ambush', 'support', 'duo', 'boss'].every((k) => kinds[k] > 0), `분대 종류가 고루 나온다: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
// 포병 듀오: 체력 공유 · 뒤 칸 피해 배율 · 함께 쓰러짐
{
  let checked = false;
  for (let s = 0; s < 200 && !checked; s++) {
    const run = R.newRun(900 + s, ids, 'sparta', 7);
    run.phase = 4; run.pending = []; R.autoPlace(run);
    const enc = R.genEncounter(run, 'battle', 4);
    const d = enc.enemies.findIndex((e) => e.duo === 'b');
    if (d < 0 || !deployed(run).length) continue;
    run.node = { type: 'battle', enc };
    const b = buildBattle(run, enc, false);
    const back = b.units.find((u) => u.mem.duo === 2)!, front = b.units.find((u) => u.id === back.mem.duoMate)!;
    const hit = (u: typeof back) => { const h0 = u.hp; b.dealDamage(b.units.find((x) => x.side === 0)!, u, 100, { elem: 'true', tag: 'skill', noHooks: false }); return h0 - u.hp; };
    const dB = hit(back); b.step(0.05);
    ok(Math.abs(front.hp - back.hp) < 1e-6, `포병 듀오: 뒤 칸이 맞으면 앞 칸 체력도 같이 준다 (${Math.round(front.hp)} = ${Math.round(back.hp)})`);
    const dF = hit(front); b.step(0.05);
    ok(dB > dF * 2, `포병 듀오: 뒤 칸 피해 ${Math.round(dB)} > 앞 칸 피해 ${Math.round(dF)} (×${CFG.squads.duo.back} · ×${CFG.squads.duo.front})`);
    b.dealDamage(b.units.find((x) => x.side === 0)!, back, 1e9, { elem: 'true', tag: 'skill' }); b.step(0.05);
    ok(!back.alive && !front.alive, '포병 듀오: 한 칸이 쓰러지면 둘 다 쓰러진다');
    checked = true;
  }
  ok(checked, '포병 듀오가 나오는 조우를 찾았다');
}
if (fail) { console.log(`\n${fail}개 실패`); process.exit(1); }
console.log('\n분대 검사 통과');
