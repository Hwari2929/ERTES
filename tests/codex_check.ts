// 도감 범위 검사: 데이터 표의 모든 항목이 도감(장비 · 시너지 · 증강 · 사이오닉) 탭에 나오고, 깨진 글자 없이 그려지는지.
// 표를 직접 순회해서 확인하므로, 데이터에 항목을 더했는데 도감에 안 나오면 여기서 걸린다.
// 실행: npm run check   (실패하면 종료 코드 1)
import { ALL_AUGS } from '../src/data/augments';
import { BLESSINGS, EMBLEM_SYNS, GLOBALS, PRIVILEGES } from '../src/data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, CONSUMABLES, emblemId, HEL_ITEM_IDS, itemInfo, OCCULT_MODS, UNIQUE_IDS } from '../src/data/items';
import { CANTRIP_INFO, PASSIVE_INFO } from '../src/data/psiinfo';
import { RELICS } from '../src/data/relics';
import { GROUPS, SCHOOLS } from '../src/data/schools';
import { SYNERGIES } from '../src/data/synergies';
import { UNIT_BY_ID, UNITS } from '../src/data/units';
import { codex2Body, codex2Detail, CX2, CX2_TABS, type Cx2Tab, type CxH } from '../src/ui/codex2';

declare const process: { exit(code: number): never };

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// main.ts 의 그림 조각 대역 (이름은 넣지 않는다: 이름이 상세 본문에 실제로 나오는지 보려고)
const H: CxH = {
  itemIcon: (id) => `<span class="item" data-i="${esc(id)}">${itemInfo(id) ? '' : 'undefined'}</span>`,
  augIcon: (id) => `<span class="aug-ic" data-a="${esc(id)}"></span>`,
  sprite: (d) => `<img class="spr" data-u="${esc(d.id)}">`,
  abTok: (k) => `<img class="ab-tok" data-k="${esc(k)}">`,
  statIc: (h) => h,
  relicTok: (id) => `<span class="relic-tok" data-r="${esc(id)}"></span>`,
  majorIcon: (m) => `<svg data-m="${m}"></svg>`,
};

const fails: string[] = [];
const warns: string[] = [];
const fail = (m: string) => fails.push(m);
const BAD = /undefined|NaN|\[object Object\]/;
function clean(where: string, html: string) {
  const m = BAD.exec(html);
  if (m) fail(`${where}: '${m[0]}' 포함 … ${html.slice(Math.max(0, m.index - 80), m.index + 40).replace(/\s+/g, ' ')}`);
}
const named = (where: string, name: string | undefined) => { if (!name || !name.trim()) fail(`${where}: 이름이 비어 있음`); };

// 모든 탭: 검색어 · 분류를 비우고 전체 목록
for (const [t] of CX2_TABS) { CX2.q[t] = ''; CX2.filt[t] = 'all'; CX2.sel[t] = null; }
const lists = Object.fromEntries(CX2_TABS.map(([t]) => [t, codex2Body(t, H)])) as Record<Cx2Tab, string>;
for (const [t, html] of Object.entries(lists)) clean(`목록 ${t}`, html);
const listed = (tab: Cx2Tab, id: string) => lists[tab].includes(`data-v="sel:${tab}:${esc(id)}"`);

// ───── 장비: 재료 · 고급 · 희귀 · 전설 · 문장 · 동맹 · 신비 부품 · 소모품 · 고유 · 성유물
let nItems = 0;
const itemIds = new Set<string>([
  ...ALL_COMPONENTS, ...ALL_GRADED, ...ALL_ADVANCED, ...ALL_ADVANCED.map((x) => 'L_' + x.slice(2)),
  ...EMBLEM_SYNS.map(emblemId), ...HEL_ITEM_IDS, ...HEL_ITEM_IDS.map((x) => 'L_' + x.slice(2)),
  ...Object.keys(OCCULT_MODS), ...Object.keys(CONSUMABLES), ...UNIQUE_IDS,
  ...UNITS.map((d) => d.item).filter((x): x is string => !!x),
]);
for (const id of itemIds) {
  nItems++;
  const it = itemInfo(id);
  named(`장비 ${id}`, it?.name);
  if (!listed('items', id)) { fail(`장비 ${id} (${it?.name}): 장비 탭 목록에 없음`); continue; }
  const d = codex2Detail('items', id, H);
  clean(`장비 ${id} 상세`, d);
  if (!d.includes(esc(it.name))) fail(`장비 ${id}: 상세에 이름이 없음`);
  if (!d.includes(esc(it.desc))) fail(`장비 ${id}: 상세에 설명이 없음`);
  for (const r of it.recipe || []) if (!d.includes(`data-i="${r}"`)) fail(`장비 ${id}: 조합 재료 ${r} 가 상세에 없음`);
}
for (const r of RELICS) {
  nItems++;
  named(`성유물 ${r.id}`, r.name);
  const key = `R:${r.id}`;
  if (!listed('items', key)) { fail(`성유물 ${r.id} (${r.name}): 장비 탭 목록에 없음`); continue; }
  const d = codex2Detail('items', key, H);
  clean(`성유물 ${r.id} 상세`, d);
  if (!d.includes(esc(r.name)) || !d.includes(esc(r.desc(1)))) fail(`성유물 ${r.id}: 상세에 이름 · 설명이 없음`);
  if (r.owner && !UNIT_BY_ID[r.owner]) fail(`성유물 ${r.id}: 주인 기물 ${r.owner} 없음`);
}

// ───── 시너지: 단계 · 단계별 효과 · 소속 기물 · 문장
for (const s of SYNERGIES) {
  named(`시너지 ${s.id}`, s.name);
  if (s.tiers.length !== s.tierDesc.length) fail(`시너지 ${s.id}: 단계 ${s.tiers.length}개인데 단계 설명 ${s.tierDesc.length}개`);
  if (!listed('syn', s.id)) { fail(`시너지 ${s.id} (${s.name}): 시너지 탭 목록에 없음`); continue; }
  const d = codex2Detail('syn', s.id, H);
  clean(`시너지 ${s.id} 상세`, d);
  if (!d.includes(esc(s.name))) fail(`시너지 ${s.id}: 상세에 이름이 없음`);
  s.tierDesc.forEach((t, i) => { if (!d.includes(esc(t))) fail(`시너지 ${s.id}: ${i + 1}단계 효과가 상세에 없음`); });
  for (const u of UNITS.filter((x) => ([...x.factions, ...x.traits] as string[]).includes(s.id))) if (!d.includes(`data-v="unit:${u.id}"`)) fail(`시너지 ${s.id}: 소속 기물 ${u.name} 이 상세에 없음`);
  if (EMBLEM_SYNS.includes(s.id) && !d.includes(`go:items:${emblemId(s.id)}`)) fail(`시너지 ${s.id}: 문장이 상세에 없음`);
}

// ───── 사이오닉: 학파 · 전공 · 비술 · 지속 · 전공 증강
for (const [gid, g] of Object.entries(GROUPS)) {
  named(`학파 ${gid}`, g.name);
  if (!lists.psi.includes(esc(g.name))) fail(`학파 ${gid} (${g.name}): 사이오닉 탭에 없음`);
}
for (const s of SCHOOLS) {
  named(`전공 ${s.id}`, s.name);
  if (!listed('psi', s.id)) { fail(`전공 ${s.id} (${s.name}): 사이오닉 탭 목록에 없음`); continue; }
  if (!GROUPS[s.group]?.majors.includes(s.id)) fail(`전공 ${s.id}: 학파 ${s.group} 의 전공 목록에 없음 (학파 묶음에 안 나옴)`);
  const d = codex2Detail('psi', s.id, H);
  clean(`전공 ${s.id} 상세`, d);
  for (const [k, v] of [['이름', s.name], ['비술', s.cantrip.name], ['지속', s.passive.name], ['고이성', s.high], ['저이성', s.low]]) if (!d.includes(esc(v))) fail(`전공 ${s.id}: ${k} '${v}' 가 상세에 없음`);
  for (const a of ALL_AUGS.filter((x) => x.pool === 'psionic' && x.owner === s.id)) if (!d.includes(`data-id="${esc(a.id)}"`)) fail(`전공 ${s.id}: 전공 증강 ${a.name} 이 상세에 없음`);
  if (!CANTRIP_INFO[s.id]) warns.push(`전공 ${s.id}: CANTRIP_INFO 없음 (도감은 비술 설명문으로 대신 표시)`);
  if (!PASSIVE_INFO[s.id]) warns.push(`전공 ${s.id}: PASSIVE_INFO 없음 (도감은 지속 설명문으로 대신 표시)`);
}

// ───── 증강: 모든 풀 (메이저 · 스페셜 · 전공 선택 · 전공) + 전역 · 특권 · 축복
const augRow = (id: string) => lists.augs.includes(`data-id="${esc(id)}"`);
for (const a of ALL_AUGS) {
  named(`증강 ${a.id}`, a.name);
  if (!augRow(a.id)) fail(`증강 ${a.id} (${a.name}, ${a.pool}): 증강 탭에 없음`);
  if (a.pool === 'special' && a.owner && !UNIT_BY_ID[a.owner]) fail(`증강 ${a.id}: 주인 기물 ${a.owner} 없음`);
}
for (const g of GLOBALS) { named(`전역 ${g.id}`, g.name); if (!augRow(g.id)) fail(`전역 증강 ${g.id} (${g.name}): 증강 탭에 없음`); }
for (const p of PRIVILEGES) { named(`특권 ${p.id}`, p.name('X')); if (!augRow(p.id)) fail(`특권 ${p.id}: 증강 탭에 없음`); }
for (const b of BLESSINGS) { named(`축복 ${b.id}`, b.name); if (!augRow(b.id)) fail(`축복 ${b.id} (${b.name}): 증강 탭에 없음`); }

// ───── 기물 참조: 도감 링크가 가리키는 기물이 실제로 있는지
for (const [t, html] of Object.entries(lists)) for (const m of html.matchAll(/data-v="unit:([^"]+)"/g)) if (!UNIT_BY_ID[m[1]]) fail(`${t}: 없는 기물 ${m[1]} 로 연결`);

const n = { items: nItems, syn: SYNERGIES.length, schools: SCHOOLS.length, augs: ALL_AUGS.length + GLOBALS.length + PRIVILEGES.length + BLESSINGS.length };
console.log(`도감 검사: 장비 ${n.items} · 시너지 ${n.syn} · 전공 ${n.schools} · 증강 ${n.augs}`);
for (const w of warns) console.log(`  경고 ${w}`);
if (fails.length) {
  for (const f of fails) console.log(`  실패 ${f}`);
  console.log(`실패 ${fails.length}건`);
  process.exit(1);
}
console.log('통과');
