// 시너지 구성 기물 겹침 점검: 영입 가능 기물 기준, 시너지 쌍마다 공유 기물 수 · 자카드 · 포함 비율
// 실행: npx esbuild tests/syn_overlap.ts --bundle --platform=node --format=cjs --outfile=dist/syn_overlap.cjs && node dist/syn_overlap.cjs
import { RECRUITABLE } from '../src/data/units';
import { SYNERGIES } from '../src/data/synergies';
const mem = new Map<string, string[]>();
for (const s of SYNERGIES) mem.set(s.id, RECRUITABLE.filter((d) => ([...d.factions, ...d.traits] as string[]).includes(s.id)).map((d) => d.name));
const name = (id: string) => SYNERGIES.find((s) => s.id === id)!.name;
const kind = (id: string) => SYNERGIES.find((s) => s.id === id)!.kind === 'faction' ? '세력' : '특성';
console.log('시너지별 인원 / 단계:');
for (const s of SYNERGIES) console.log(`  ${kind(s.id)} ${s.name.padEnd(10)} ${mem.get(s.id)!.length}명 · 단계 ${s.tiers.join('/')}`);
const rows: [number, string][] = [];
const ids = [...mem.keys()].filter((k) => mem.get(k)!.length > 1);
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const a = mem.get(ids[i])!, b = mem.get(ids[j])!;
  const sh = a.filter((x) => b.includes(x));
  if (sh.length < 2) continue;
  const jac = sh.length / new Set([...a, ...b]).size, cover = sh.length / Math.min(a.length, b.length);
  rows.push([cover * 10 + jac, `${kind(ids[i])} ${name(ids[i])}(${a.length}) × ${kind(ids[j])} ${name(ids[j])}(${b.length}) 공유 ${sh.length} · 작은 쪽의 ${Math.round(cover * 100)}% · 자카드 ${jac.toFixed(2)} — ${sh.join(', ')}`]);
}
rows.sort((x, y) => y[0] - x[0]);
console.log('\n겹침 상위:'); for (const [, r] of rows.slice(0, 25)) console.log('  ' + r);
// 기물 쌍이 시너지 2개 이상을 함께 가지는 경우 (같은 조합이 겹치면 한 명 영입으로 두 시너지가 함께 오른다)
const pairs: string[] = [];
for (let i = 0; i < RECRUITABLE.length; i++) for (let j = i + 1; j < RECRUITABLE.length; j++) {
  const a = [...RECRUITABLE[i].factions, ...RECRUITABLE[i].traits] as string[], b = [...RECRUITABLE[j].factions, ...RECRUITABLE[j].traits] as string[];
  const sh = a.filter((x) => b.includes(x));
  if (sh.length >= 2) pairs.push(`  ${RECRUITABLE[i].name} · ${RECRUITABLE[j].name}: ${sh.map(name).join(' + ')}`);
}
console.log(`\n시너지 2개 이상을 공유하는 기물 쌍 ${pairs.length}:`); console.log(pairs.join('\n'));
