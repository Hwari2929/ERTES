// 바 허브 데이터 검사: 확장 틀 · 말 걸기 대본의 화자 이름 · 후보 id 가 실제 인물인지, 슬롯 표시와 슬롯 수가 맞는지. 층 분포도 출력한다.
import { BANTER } from '../src/data/bar/banter.gen';
import { FRAMES } from '../src/data/bar/frames';
import { BAR_TALK, DEEP_TOPICS } from '../src/data/bar/talk';
import { ASK, ASK_Q, askLines } from '../src/data/bar/ask';
import { UNIT_BY_ID, UNITS } from '../src/data/units';
declare const process: { exitCode?: number };
declare function require(m: 'node:fs'): { readdirSync(p: string): string[] };

const NAMES = new Set([...UNITS.map((u) => u.name), '포티니', '레이카', '오닉스', '귀공자', '체사레', '맥스', '손님']);
const ok = (id: string) => !!UNIT_BY_ID[id];
const errs: string[] = [];
const lineCheck = (where: string, l: string) => {
  if (l.startsWith('* ') || /^@\d$/.test(l)) return;
  const m = l.match(/^([^:\s]{1,8}): /);
  if (m && !NAMES.has(m[1])) errs.push(`${where}: 모르는 이름표 '${m[1]}'`);
};
for (const f of FRAMES) {
  f.cast.forEach((id) => ok(id) || errs.push(`${f.id}: 모르는 핵심 인물 ${id}`));
  if (f.deep && !ok(f.deep)) errs.push(`${f.id}: deep ${f.deep}`);
  if (f.layer === 'r' && !f.deep) errs.push(`${f.id}: 실재 층인데 deep 인물이 없음`);
  const marks = f.lines.filter((l) => /^@\d$/.test(l)).length;
  if (marks !== f.slots.length) errs.push(`${f.id}: 슬롯 표시 ${marks} ≠ 슬롯 ${f.slots.length}`);
  f.lines.forEach((l) => lineCheck(f.id, l));
  f.slots.forEach((sl, i) => {
    const n = Object.keys(sl).length;
    if (n < 4) errs.push(`${f.id} 슬롯${i}: 후보 ${n}명 (5명 이상 권장)`);
    for (const [id, ls] of Object.entries(sl)) { if (!ok(id)) errs.push(`${f.id}: 모르는 후보 ${id}`); ls.forEach((l) => lineCheck(`${f.id}/${id}`, l)); }
  });
}
for (const [id, t] of Object.entries(BAR_TALK)) {
  if (!ok(id)) errs.push(`talk: ${id}`);
  [...t.hello.flat(), ...Object.values(t.react).flat(), ...t.topics.flatMap((x) => x.lines), ...(DEEP_TOPICS[id]?.lines || [])].forEach((l) => lineCheck(`talk/${id}`, l));
}
// 공통 질문: 바에 나올 수 있는 단원 전원(레이첼 제외)에게 답이 있어야 한다. 실재 층 답은 로어 문서가 있는 인물만
const LORE = new Set(require('node:fs').readdirSync('lore/인물').filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')));
for (const u of UNITS) {
  if (u.id === 'rachel') continue;
  const a = ASK[u.id];
  if (!a) { errs.push(`물어보기: ${u.name}(${u.id}) 답 없음`); continue; }
  for (const q of ASK_Q) {
    const v = a[q.key];
    const tiers = Array.isArray(v) ? v : [v];
    if (q.deep && (!Array.isArray(v) || !v[0]?.trim() || !v[1]?.trim())) errs.push(`물어보기: ${u.name} '${q.label}' 표면 · 이상 답이 비었음`);
    if (!q.deep && (Array.isArray(v) || !String(v).trim())) errs.push(`물어보기: ${u.name} '${q.label}' 답이 비었음`);
    if (Array.isArray(v) && v[2] && !LORE.has(u.name)) errs.push(`물어보기: ${u.name} 로어 문서 없이 실재 층 답이 있음`);
    tiers.filter(Boolean).forEach((t) => askLines(t as string).forEach((l) => lineCheck(`ask/${u.id}/${q.key}`, l)));
  }
}
for (const id of Object.keys(ASK)) if (!UNIT_BY_ID[id] || id === 'rachel') errs.push(`물어보기: 모르는 인물 ${id}`);
const askN = Object.keys(ASK).length, askDeep = Object.values(ASK).filter((a) => a.past[2]).length;
console.log(`물어보기: ${askN}명 × 질문 ${ASK_Q.length}개 (실재 층 답 ${askDeep}명)`);
const lay = (xs: { layer: string }[]) => ['s', 'i', 'r'].map((k) => xs.filter((x) => x.layer === k).length).join(' / ');
console.log(`바 데이터: 만담 ${BANTER.length}편 (표면/이상/실재 ${lay(BANTER)}) · 확장 틀 ${FRAMES.length}편 (${lay(FRAMES)}) · 끼어들기 버전 ${FRAMES.reduce((n, f) => n + f.slots.reduce((a, s) => a + Object.keys(s).length, 0), 0)}`);
if (errs.length) { console.log(`바 데이터 검사 실패 ${errs.length}건`); errs.slice(0, 30).forEach((e) => console.log(' · ' + e)); process.exitCode = 1; } else console.log('바 데이터 검사: 통과');
