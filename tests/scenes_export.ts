// 스크립트 매니저용 내보내기: 사건 · 선택지 · 연출 · 등록부 · 기물 이름표 → JSON
// 실행: npx esbuild tests/scenes_export.ts --bundle --platform=node --format=cjs --outfile=dist/scenes_export.cjs && node dist/scenes_export.cjs > out.json
import { EVENTS } from '../src/data/events';
import { BGMS, BGS, NPCS, PC_NAME, SFXS } from '../src/data/scene';
import { EVENT_SCENES } from '../src/data/scenes';
import { SYN_BY_ID } from '../src/data/synergies';
import { UNITS } from '../src/data/units';
declare const process: { stdout: { write(s: string): void } };
const group = (id: string, fields?: string[]) => (/^sa_/.test(id) ? '이야기 A · 함선 생활' : /^sb_/.test(id) ? '이야기 B · 세력 정치' : /^sc_/.test(id) ? '이야기 C · 우주 기담' : /^sd_/.test(id) ? '이야기 D · 변경 생존' : fields ? '전장' : '공용');
const events = EVENTS.map((e) => ({
  id: e.id, title: e.title, group: group(e.id, e.fields), fields: e.fields || null, text: e.text, rare: !!e.rare, req: e.req || null,
  choices: e.choices.map((c) => ({ label: c.label, desc: c.desc, keys: [...new Set([...c.apply.toString().matchAll(/outcome\(['"](\w+)['"]/g)].map((m) => m[1]))] })),
  scene: EVENT_SCENES[e.id] || null,
}));
const units = Object.fromEntries(UNITS.map((u) => [u.id, { name: u.name, color: SYN_BY_ID[u.factions[0] || u.traits[0]]?.color || '#f2a93b' }]));
process.stdout.write(JSON.stringify({ pc: PC_NAME, events, units, npcs: NPCS, bgs: BGS, bgms: BGMS, sfxs: SFXS }));
