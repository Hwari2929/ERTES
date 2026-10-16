// 바 허브 데이터 검사: 확장 틀 · 말 걸기 대본의 화자 이름 · 후보 id 가 실제 인물인지, 슬롯 표시와 슬롯 수가 맞는지. 층 분포도 출력한다.
import { BANTER } from '../src/data/bar/banter.gen';
import { FRAMES } from '../src/data/bar/frames';
import { BAR_TALK, DEEP_TOPICS } from '../src/data/bar/talk';
import { ASK, ASK_Q, askLines } from '../src/data/bar/ask';
import { UNIT_BY_ID, UNITS } from '../src/data/units';
import { BAR_ENTER, BAR_WAIT, LEAVE_GENERIC, LEAVE_LINES } from '../src/data/bar/leave';
import { BAR_TUNE, STAGE_MAX, barSimulate } from '../src/ui/bar';
declare const process: { exitCode?: number; argv?: string[] };
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
  if (u.id === 'rachel' || u.inert) continue; // 반려 돌(절망 증강)은 바에 오지 않는다
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
// 바 대본: 레이첼을 뺀 전원에게 인사 · 반응 3개 이상 · 화제 2편. 심야 화제(실재 층)는 로어 있는 인물만
for (const u of UNITS) {
  if (u.id === 'rachel' || u.inert) continue;
  const t = BAR_TALK[u.id];
  if (!t) { errs.push(`대본: ${u.name} 없음`); continue; }
  if (!t.at || !t.hello.length || Object.keys(t.react).length < 3 || t.topics.length < 2) errs.push(`대본: ${u.name} 인사 · 반응(3+) · 화제(2) 부족`);
  if (DEEP_TOPICS[u.id] && !LORE.has(u.name)) errs.push(`대본: ${u.name} 로어 문서 없이 심야 화제가 있음`);
  if (LORE.has(u.name) && !DEEP_TOPICS[u.id]) errs.push(`대본: ${u.name} 심야 화제 없음 (로어 있음)`);
}
for (const id of Object.keys(ASK)) if (!UNIT_BY_ID[id] || id === 'rachel') errs.push(`물어보기: 모르는 인물 ${id}`);
// 작별 인사 (구경 모드 퇴장): 에이든 · 레이첼을 뺀 전원. 에이든은 나가지 않고 카운터 뒤로 돌아갈 뿐, 레이첼은 무대에 서지 않는다
for (const [id, ls] of Object.entries(LEAVE_LINES)) {
  if (!ok(id) || id === 'rachel' || id === 'aiden') errs.push(`작별 인사: 모르는 인물 · 나가지 않는 인물 ${id}`);
  if (!ls.length || ls.some((l) => !l.trim())) errs.push(`작별 인사: ${id} 빈 줄`);
  ls.forEach((l) => lineCheck(`leave/${id}`, l));
}
for (const u of UNITS) if (u.id !== 'rachel' && u.id !== 'aiden' && !u.inert && !LEAVE_LINES[u.id]) errs.push(`작별 인사: ${u.name}(${u.id}) 없음`);
if (!LEAVE_GENERIC.length || !BAR_WAIT.length || !BAR_ENTER.length) errs.push('작별 인사: 일반 인사 · 대기 서술 · 입장 서술 풀이 비었음');

// 무대 규칙 (src/ui/bar.ts 구경 모드, 화면 없이 모의 실행): 무대 STAGE_MAX 명 이하 · 0명 없음 · 레이첼 미등장 · 말하는 사람은 무대에 ·
// 새 단원은 한 번에 1명, 빈자리(또는 직전 입장) 뒤 BAR_TUNE.vacant[0] 이상 지나서만 · 퇴장 전에는 그 사람의 작별 인사
const amb = BANTER.filter((b) => b.place !== 2);
const needN = (c: string[]) => new Set(c.filter((id) => id !== 'rachel').map((id) => (id === 'cesare' ? 'joshua' : id))).size;
const castN = [0, 1, 2, 3, 4].map((n) => amb.filter((b) => b.cast.filter((id) => id !== 'rachel' && id !== 'aiden').length === n).length);
console.log(`바 무대 ${STAGE_MAX}명 (레이첼은 무대 밖 · 에이든은 나오는 장면에서만): 재생 가능한 바 만담 ${amb.filter((b) => needN(b.cast) <= STAGE_MAX).length}/${amb.length}편 · 레이첼 · 에이든 뺀 출연 0~4명 = ${castN.join(' / ')}편`);
const ROSTERS: [string, string[]][] = [
  ['전원', UNITS.filter((u) => !u.inert).map((u) => u.id).filter((id) => id !== 'rachel' && id !== 'aiden')], // 반려 돌(절망 증강)은 바에 오지 않는다
  ['튜토리얼 7명', ['yelena', 'franze', 'lindiwe', 'vivian', 'phyllis', 'temur', 'nadir']],
  ['2명', ['vivian', 'temur']],
  ['없음', []],
];
const sim = { steps: 0, entries: 0, joins: 0, leaves: 0, waits: 0, idle: 0, aiden: 0, three: 0 };
for (const [label, ids] of ROSTERS) {
  const s0 = { ...sim };
  for (let run = 0; run < 3; run++) {
    const log = barSimulate(300, ids);
    let lastChange = log[0].t;
    let prev = new Set(log[0].stage);
    log.forEach((r, i) => {
      const at = `무대 모의 실행(${label}) ${i}번째 ${r.kind}`;
      if (r.stage.length > STAGE_MAX) errs.push(`${at}: 무대 ${r.stage.length}명`);
      if (!r.stage.length) errs.push(`${at}: 무대가 비었음`);
      if (r.stage.includes('rachel')) errs.push(`${at}: 레이첼이 무대에 섰음`);
      for (const sp of r.speakers) if (!r.stage.includes(sp)) errs.push(`${at}: 말하는 ${sp} 가 무대에 없음 (${r.key})`);
      const fresh = r.stage.filter((k) => !prev.has(k) && k !== 'aiden' && k !== 'guest');
      if (i > 0 && fresh.length) {
        sim.entries++;
        if (fresh.length > 1) errs.push(`${at}: 한 번에 ${fresh.length}명이 들어옴`);
        if (r.t - lastChange < BAR_TUNE.vacant[0]) errs.push(`${at}: 빈자리 ${r.t - lastChange}ms 만에 들어옴`);
        if (r.speakers.some((k) => prev.has(k) && k !== 'aiden' && k !== 'guest')) sim.joins++; // 남아 있던 사람과 함께 나오는 합류 장면
        lastChange = r.t;
      }
      if (r.kind === 'exit') {
        const p = log[i - 1];
        if (p?.kind !== 'leave' || p.speakers.join() !== r.exit) errs.push(`${at}: 작별 인사 없이 ${r.exit} 퇴장`);
        sim.leaves++;
        lastChange = r.t;
      }
      sim.steps++;
      if (r.kind === 'wait') sim.waits++;
      if (r.kind === 'idle') sim.idle++;
      if (r.stage.includes('aiden')) sim.aiden++;
      if (r.stage.length === STAGE_MAX) sim.three++;
      prev = new Set(r.stage);
    });
  }
  if (process.argv?.includes('--stage')) console.log(`  ${label}: ${Object.entries(sim).map(([k, v]) => `${k} ${v - s0[k as keyof typeof sim]}`).join(' · ')}`);
}
console.log(`무대 모의 실행 ${sim.steps}단계: 입장 ${sim.entries} (합류 장면 ${sim.joins}) · 퇴장 ${sim.leaves} · 빈자리 대기 ${sim.waits} · 바텐더와 손님 ${sim.idle} · 에이든이 나와 있음 ${sim.aiden} · 3명 무대 ${sim.three}`);
const askN = Object.keys(ASK).length, askDeep = Object.values(ASK).filter((a) => a.past[2]).length;
console.log(`물어보기: ${askN}명 × 질문 ${ASK_Q.length}개 (실재 층 답 ${askDeep}명)`);
const lay = (xs: { layer: string }[]) => ['s', 'i', 'r'].map((k) => xs.filter((x) => x.layer === k).length).join(' / ');
console.log(`바 데이터: 만담 ${BANTER.length}편 (표면/이상/실재 ${lay(BANTER)}) · 확장 틀 ${FRAMES.length}편 (${lay(FRAMES)}) · 끼어들기 버전 ${FRAMES.reduce((n, f) => n + f.slots.reduce((a, s) => a + Object.keys(s).length, 0), 0)}`);
if (errs.length) { console.log(`바 데이터 검사 실패 ${errs.length}건`); errs.slice(0, 30).forEach((e) => console.log(' · ' + e)); process.exitCode = 1; } else console.log('바 데이터 검사: 통과');
