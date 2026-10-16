// 도감 범위 검사: 데이터 표의 모든 항목이 도감(장비 · 시너지 · 증강 · 사이오닉 · 세계관) 탭에 나오고, 깨진 글자 없이 그려지는지.
// 표를 직접 순회해서 확인하므로, 데이터에 항목을 더했는데 도감에 안 나오면 여기서 걸린다.
// 실행: npm run check   (실패하면 종료 코드 1)
import { ALL_AUGS } from '../src/data/augments';
import { FIELD_BY_ID, FIELDS } from '../src/data/battlefields';
import { BLURB, blurbNames, unitBlurb } from '../src/data/brief';
import { BLESSINGS, EMBLEM_SYNS, GLOBALS, PRIVILEGES } from '../src/data/globals';
import { ALL_ADVANCED, ALL_COMPONENTS, ALL_GRADED, CONSUMABLES, emblemId, HEL_ITEM_IDS, itemInfo, OCCULT_MODS, TURRET_GEAR_IDS, UNIQUE_IDS } from '../src/data/items';
import { CANTRIP_INFO, PASSIVE_INFO } from '../src/data/psiinfo';
import { RELICS } from '../src/data/relics';
import { GROUPS, SCHOOLS } from '../src/data/schools';
import { SYNERGIES } from '../src/data/synergies';
import { UNIT_BY_ID, UNITS } from '../src/data/units';
import { ULTS } from '../src/data/ults';
import { LORE, LORE_BY_ID, loreWords } from '../src/data/worldlore';
import { codex2Body, codex2Detail, CX2, CX2_TABS, type Cx2Tab, type CxH, loreLinks } from '../src/ui/codex2';
import { ELEM_NAME } from '../src/types';

declare const process: { exit(code: number): never };
declare function require(m: 'node:fs'): { existsSync(p: string): boolean };

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
  ...Object.keys(OCCULT_MODS), ...Object.keys(CONSUMABLES), ...UNIQUE_IDS, ...TURRET_GEAR_IDS,
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

// ───── 세계관: 모든 항목이 목록에 나오고, 연결한 기물 · 시너지 · 전장 · 항목이 실제로 있고 양쪽에서 이어지는지 + 분량 규칙
const loreSeen = new Set<string>();
for (const e of LORE) {
  if (loreSeen.has(e.id)) fail(`세계관 ${e.id}: id 중복`);
  loreSeen.add(e.id);
  named(`세계관 ${e.id}`, e.name);
  if (!listed('lore', e.id)) { fail(`세계관 ${e.id} (${e.name}): 세계관 탭 목록에 없음`); continue; }
  const d = codex2Detail('lore', e.id, H);
  clean(`세계관 ${e.id} 상세`, d);
  for (const t of [e.name, e.tag, ...e.bullets]) if (!d.includes(esc(t))) fail(`세계관 ${e.id}: '${t.slice(0, 24)}…' 가 상세에 없음`);
  if (!d.includes('<svg')) fail(`세계관 ${e.id}: 아이콘 '${e.mark}' 없음 (시너지 id 또는 선 아이콘 키)`);
  const [lo, hi] = e.group === 'region' ? [2, 3] : [3, 5];
  if (e.bullets.length < lo || e.bullets.length > hi) fail(`세계관 ${e.id}: 사실 ${e.bullets.length}줄 (${lo}–${hi}줄)`);
  const w = loreWords(e);
  if (w > 120) fail(`세계관 ${e.id}: ${w}어절 (120어절 이하)`);
  if (e.group === 'region') {
    const b = LORE_BY_ID[e.bloc || ''];
    if (!b || b.group !== 'faction') fail(`세계관 ${e.id}: 소속 세력 '${e.bloc}' 이 세력 항목이 아님`);
    else if (!codex2Detail('lore', b.id, H).includes(`go:lore:${e.id}"`)) fail(`세계관 ${e.id}: ${b.name} 상세의 주요 지역에 없음`);
  } else if (e.bloc) fail(`세계관 ${e.id}: 지역이 아닌데 소속 세력이 있음`);
  const r = e.rel || {};
  for (const u of r.units || []) {
    if (!UNIT_BY_ID[u]) fail(`세계관 ${e.id}: 없는 기물 ${u}`);
    else if (!d.includes(`data-v="unit:${u}"`)) fail(`세계관 ${e.id}: 관련 기물 ${u} 가 상세에 없음`);
    else if (!loreLinks(u).includes(`go:lore:${e.id}"`)) fail(`기물 ${u}: 상세의 세계관 링크에 ${e.id} 없음`);
  }
  for (const sid of r.syn || []) {
    if (!SYNERGIES.some((x) => x.id === sid)) fail(`세계관 ${e.id}: 없는 시너지 ${sid}`);
    else if (!d.includes(`go:syn:${sid}"`)) fail(`세계관 ${e.id}: 시너지 ${sid} 가 상세에 없음`);
    else if (!codex2Detail('syn', sid, H).includes(`go:lore:${e.id}"`)) fail(`시너지 ${sid}: 상세의 세계관 링크에 ${e.id} 없음`);
  }
  for (const f of r.fields || []) {
    if (!FIELD_BY_ID[f]) fail(`세계관 ${e.id}: 없는 전장 ${f}`);
    else if (!d.includes(`data-field="${f}"`) || !d.includes(esc(FIELD_BY_ID[f].desc))) fail(`세계관 ${e.id}: 전장 ${f} 브리핑이 상세에 없음`);
  }
  for (const l of r.lore || []) {
    if (!LORE_BY_ID[l]) fail(`세계관 ${e.id}: 없는 항목 ${l}`);
    else if (l === e.id) fail(`세계관 ${e.id}: 자기 자신을 함께 보기에 넣음`);
    else if (!d.includes(`go:lore:${l}"`)) fail(`세계관 ${e.id}: 함께 보기 ${l} 가 상세에 없음`);
  }
  if (e.art) {
    if (!/^lore_[a-z0-9_]+$/.test(e.art)) fail(`세계관 ${e.id}: 일러스트 이름 '${e.art}' 은 lore_<id> 형식`);
    else if (!require('node:fs').existsSync(`public/art/${e.art}.webp`)) fail(`세계관 ${e.id}: public/art/${e.art}.webp 없음`);
    else if (!d.includes(`${e.art}.webp`)) fail(`세계관 ${e.id}: 일러스트가 상세에 없음`);
  }
}
for (const f of FIELDS) if (!LORE.some((e) => e.rel?.fields?.includes(f.id))) warns.push(`전장 ${f.id} (${f.name}): 어느 세계관 항목에도 연결되지 않음`);
for (const [t, html] of Object.entries(lists)) for (const m of html.matchAll(/go:lore:([^"]+)"/g)) if (!LORE_BY_ID[m[1]]) fail(`${t}: 없는 세계관 항목 ${m[1]} 로 연결`);

// ───── 기물 참조: 도감 링크가 가리키는 기물이 실제로 있는지
for (const [t, html] of Object.entries(lists)) for (const m of html.matchAll(/data-v="unit:([^"]+)"/g)) if (!UNIT_BY_ID[m[1]]) fail(`${t}: 없는 기물 ${m[1]} 로 연결`);

// ───── 기물 한 줄 설명 (src/data/brief.ts BLURB): 전체 상세 · 도감 기물 상세 머리에 나온다
//   모든 기물(사건 전용 포함, 소환물 제외)에 있고, 자리표시가 실제 이름으로 다 채워지고, 수치 없이 알맞은 길이인지.
//   피해 속성을 말하면 그 속성이 무기 · 특성 · 스킬 · 궁극기 중 어딘가에 실제로 있는지 (키트를 바꾸고 설명을 안 고친 경우)
const ELEMS = ['물리', '화학', '전기', '정신', '신성', '고정'];
for (const d of UNITS) {
  const t = BLURB[d.id];
  if (!t) { fail(`기물 ${d.id} (${d.name}): 한 줄 설명 없음 — src/data/brief.ts BLURB 에 추가`); continue; }
  const s = unitBlurb(d);
  clean(`기물 ${d.id} 한 줄 설명`, s);
  const names = blurbNames(d);
  for (const m of t.matchAll(/\{(\w+)\}/g)) if (!(m[1] in names)) fail(`기물 ${d.id} 한 줄 설명: 모르는 자리표시 {${m[1]}} (쓸 수 있는 것: ${Object.keys(names).join(' · ')})`);
  if (/[{}]/.test(s)) fail(`기물 ${d.id} 한 줄 설명: 채워지지 않은 자리표시 — ${s}`);
  if (/\d/.test(t.replace(/\{\w+\}/g, ''))) fail(`기물 ${d.id} 한 줄 설명: 수치를 넣지 않는다 (수치는 능력 칸이 보여 준다) — ${t}`);
  if (s.length < 20 || s.length > 60) fail(`기물 ${d.id} 한 줄 설명: ${s.length}자 (20–60자) — ${s}`);
  if (!/다\.$/.test(s)) fail(`기물 ${d.id} 한 줄 설명: '~다.' 로 끝나는 한 문장으로 — ${s}`);
  const kit = [ELEM_NAME[d.weapon.elem], d.trait.desc, d.skill.desc(d.skill.params), ULTS[d.id]?.desc || ''].join(' ');
  for (const el of ELEMS) if (s.replace(/「[^」]*」/g, '').includes(el) && !kit.includes(el)) fail(`기물 ${d.id} 한 줄 설명: '${el}' 을 말하지만 무기 · 특성 · 스킬 · 궁극기에 ${el} 이 없음 — ${s}`);
}
for (const id of Object.keys(BLURB)) if (!UNIT_BY_ID[id]) fail(`한 줄 설명 ${id}: 없는 기물`);

const n = { units: UNITS.length, items: nItems, syn: SYNERGIES.length, schools: SCHOOLS.length, augs: ALL_AUGS.length + GLOBALS.length + PRIVILEGES.length + BLESSINGS.length, lore: LORE.length };
console.log(`도감 검사: 기물 ${n.units} · 장비 ${n.items} · 시너지 ${n.syn} · 전공 ${n.schools} · 증강 ${n.augs} · 세계관 ${n.lore}`);
for (const w of warns) console.log(`  경고 ${w}`);
if (fails.length) {
  for (const f of fails) console.log(`  실패 ${f}`);
  console.log(`실패 ${fails.length}건`);
  process.exit(1);
}
console.log('통과');
