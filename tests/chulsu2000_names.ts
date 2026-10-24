// 철수 2,000판 보고서용 이름표: 기물 · 시너지(단계 인원) · 장비 · 증강 · 전역 증강 · 절망 증강 · 적 이름을 JSON 으로 낸다 (tests/balance_chulsu2000.py 가 읽는다).
// 실행: npx esbuild tests/chulsu2000_names.ts --bundle --platform=node --log-level=error --outfile=dist/chulsu2000_names.cjs && node dist/chulsu2000_names.cjs [장비 id 목록 .json] > names.json
import { UNITS } from '../src/data/units';
import { SYNERGIES } from '../src/data/synergies';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, itemInfo } from '../src/data/items';
import { AUG_BY_ID } from '../src/data/augments';
import { GLOBALS } from '../src/data/globals';
import { DESPAIRS } from '../src/data/despair';
import { ENEMY_BY_ID } from '../src/data/enemies';

declare const process: { argv: string[]; stdout: { write(s: string): void } };
declare function require(m: string): { readFileSync(p: string, e: string): string };

const item = (id: string) => { try { const i = itemInfo(id); return { name: i.name, tier: i.tier }; } catch { return { name: id, tier: '?' }; } };
const ids = new Set([...ALL_COMPONENTS, ...ALL_GRADED, ...ALL_ADVANCED, ...ALL_ADVANCED.map((x) => 'L_' + x.slice(2))]);
if (process.argv[2]) for (const id of JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')) as string[]) ids.add(id);
process.stdout.write(JSON.stringify({
  units: Object.fromEntries(UNITS.map((u) => [u.id, { name: u.name, syn: [...u.factions, ...u.traits], starter: !u.noStarter, eventOnly: !!u.eventOnly }])),
  syn: Object.fromEntries(SYNERGIES.map((s) => [s.id, { name: s.name, kind: s.kind, tiers: s.tiers }])),
  aug: Object.fromEntries(Object.values(AUG_BY_ID).map((a) => [a.id, { name: a.name, pool: a.pool, owner: a.owner || '', legend: !!a.legend }])),
  glob: Object.fromEntries(GLOBALS.map((g) => [g.id, { name: g.name, tier: g.tier || 'N' }])),
  desp: Object.fromEntries(DESPAIRS.map((d) => [d.id, { name: (d as { name: string }).name }])),
  enemy: Object.fromEntries(Object.entries(ENEMY_BY_ID).map(([k, e]) => [k, { name: (e as { name: string }).name, tier: e.tier }])),
  item: Object.fromEntries([...ids].map((id) => [id, item(id)])),
}));
