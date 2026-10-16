// 사이오닉 비술 검사: (1) ◆ 변형 증강의 설명이 기본형과 다른지, (2) 실체화 + 분신이 실제로 분신을 바꾸는지 (엔진 시뮬).
// 실행: npx esbuild tests/psi_cantrip_check.ts --bundle --platform=node --log-level=error --outfile=dist/psi_cantrip_check.cjs && node dist/psi_cantrip_check.cjs
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { UNIT_BY_ID } from '../src/data/units';
import { cantripView, passiveView } from '../src/data/psiinfo';
import { PSI } from '../src/data/psinum';
import { SCHOOLS, TRANSFORM_KEYS, psiAugId } from '../src/data/schools';
import { CFG } from '../src/config';
import type { CUnit } from '../src/engine/combat';

declare const process: { exit(code: number): never };
const fails: string[] = [];

// (1) 변형 설명
for (const s of SCHOOLS) {
  const id = psiAugId(s.id, TRANSFORM_KEYS[s.id]);
  const c0 = cantripView(s.id), c1 = cantripView(s.id, [id]);
  const p0 = passiveView(s.id), p1 = passiveView(s.id, [id]);
  const changed = JSON.stringify(c0.info) !== JSON.stringify(c1.info) || JSON.stringify(p0.rows) !== JSON.stringify(p1.rows);
  if (!changed) fails.push(`${id}: 변형해도 설명이 그대로`);
  if (!c1.transform && !p1.transform) fails.push(`${id}: 변형 표시 없음`);
  console.log(`${id.padEnd(22)} 비술 ${c1.transform ? '변형' : '-'} · 지속 ${p1.transform ? '변형' : '-'} · 쿨다운 ${c0.cd} → ${c1.cd} · 대상 ${c1.info.tgt}`);
}

// (2) 실체화 + 분신: 같은 시드로 분신 / 분신+실체화 전투를 돌려 생성된 분신 비교
function trial(augs: string[]) {
  const psi = Object.values(UNIT_BY_ID).find((d) => d.ttype === 'psionic' && d.id === 'hiiro')!;
  const run = R.newRun(7, [psi.id, 'vivian', 'falcon']);
  run.pending = [];
  const u = run.units.find((x) => x.defId === psi.id)!;
  u.augments = [{ id: 'school.illusion' }, ...augs.map((id) => ({ id }))];
  R.enterNode(run, R.currentOptions(run)[0]);
  run.pending = [];
  R.autoPlace(run);
  const b = buildBattle(run, run.node!.enc!, false);
  const owner = b.units.find((c) => c.src === u)!;
  let clone: CUnit | null = null;
  let taken = 0, extra = 0;
  const seen = new Set<CUnit>();
  for (let t = 0; t < 40 && !b.over; t += CFG.tick) {
    b.step(CFG.tick);
    for (const c of b.units) if (c.owner === owner && c.mem.illusion && !seen.has(c)) { seen.add(c); clone ??= c; }
  }
  for (const c of seen) taken += c.counters.taken;
  extra = owner.counters.dmg;
  const ownerHp = b.S(owner, 'maxHp');
  return { clone, ownerHp, n: seen.size, taken, ownerDmg: extra };
}
const a = trial([psiAugId('illusion', 'clone')]);
const bb = trial([psiAugId('illusion', 'clone'), psiAugId('illusion', 'solid')]);
if (!a.clone || !bb.clone) fails.push('분신이 생성되지 않음');
else {
  const ra = a.clone.st.maxHp / a.ownerHp, rb = bb.clone.st.maxHp / bb.ownerHp;
  console.log(`분신만: 분신 ${a.n}기, 체력 비율 ${ra.toFixed(2)}, 실체화 표시 ${a.clone.mem.solid || 0}, 훅 ${a.clone.hooks.length}, 시전자 피해 ${Math.round(a.ownerDmg)}`);
  console.log(`분신+실체화: 분신 ${bb.n}기, 체력 비율 ${rb.toFixed(2)}, 실체화 표시 ${bb.clone.mem.solid || 0}, 훅 ${bb.clone.hooks.length}, 시전자 피해 ${Math.round(bb.ownerDmg)}`);
  if (Math.abs(ra - PSI.illusion.cloneHp) > 0.01) fails.push(`분신 체력 비율 ${ra}`);
  if (Math.abs(rb - PSI.illusion.solidCloneHp) > 0.01) fails.push(`실체화 분신 체력 비율 ${rb}`);
  if (!bb.clone.mem.solid || a.clone.mem.solid) fails.push('실체화 표시가 맞지 않음');
  const tm = bb.clone.hooks.map((h) => h.takenMult?.(null as never, bb.clone!, bb.clone!, { elem: 'phys' } as never)).find((x) => x !== undefined);
  if (tm === undefined || Math.abs(tm - (1 - PSI.illusion.solidCloneRed)) > 1e-9) fails.push(`실체화 분신 받는 피해 배율 ${tm}`);
}
// (3) 추첨: 배타 증강도 같은 창에 나오고, 각 후보 등장 확률이 고르다 (시공 7종 중 3개 → 각 3/7)
{
  const run = R.newRun(11, ['romani', 'vivian', 'falcon']);
  const u = run.units.find((x) => x.defId === 'romani')!;
  u.augments = [{ id: 'school.chrono' }];
  const N = 4000, cnt: Record<string, number> = {};
  let both = 0;
  for (let i = 0; i < N; i++) {
    const ids = R.augOptions(run, u, 'psionic').map((o) => o.id);
    for (const id of ids) cnt[id] = (cnt[id] || 0) + 1;
    if (ids.includes('psi.chrono.storm') && ids.includes('psi.chrono.haste')) both++;
  }
  const rates = Object.entries(cnt).map(([k, v]) => `${k.slice(11)} ${(v / N).toFixed(3)}`).join(' · ');
  console.log(`추첨 ${N}회: ${rates} · 폭풍+가속 함께 ${(both / N).toFixed(3)} (기대 ${(1 / 7).toFixed(3)})`);
  if (!both) fails.push('배타 증강이 같은 창에 나오지 않음');
  for (const [k, v] of Object.entries(cnt)) if (Math.abs(v / N - 3 / 7) > 0.04) fails.push(`추첨 편향: ${k} ${(v / N).toFixed(3)}`);
  u.augments.push({ id: 'psi.chrono.haste' });
  for (let i = 0; i < 300; i++) if (R.augOptions(run, u, 'psionic').some((o) => o.id === 'psi.chrono.storm')) { fails.push('보유 증강과 충돌하는 후보가 나옴'); break; }
}
if (fails.length) { console.log('실패\n' + fails.join('\n')); process.exit(1); }
console.log('통과');
