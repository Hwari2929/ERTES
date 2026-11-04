// 바 허브 데이터 검사: 확장 틀 · 말 걸기 대본의 화자 이름 · 후보 id 가 실제 인물인지, 슬롯 표시와 슬롯 수가 맞는지. 층 분포도 출력한다.
import { BANTER } from '../src/data/bar/banter.gen';
import { FRAMES } from '../src/data/bar/frames';
import { BAR_TALK, DEEP_TOPICS } from '../src/data/bar/talk';
import { ASK, ASK_Q, askLines } from '../src/data/bar/ask';
import { UNIT_BY_ID, UNITS } from '../src/data/units';
import { AIDEN_BACK, BAR_ENTER, BAR_WAIT, LEAVE_GENERIC, LEAVE_LINES } from '../src/data/bar/leave';
import { ERANTES_CREW, MONO, MONO_KINDS } from '../src/data/bar/mono';
import { BAR_FAST, BAR_TUNE, STAGE_MAX, barSimulate } from '../src/ui/bar';
import { canOrder, GLASS_BY_ID, ING_BY_ID, GARNISH_BY_ID, GARNISH_MAX, ORDER_AVOID, RECIPES, REGULARS, RECIPE_BY_ID } from '../src/data/bar/drinks';
import { feelConds, feelText, judge, makeOrder, recipeName } from '../src/data/bar/orders';
import { ORDER_TALK, ORDER_GENERIC } from '../src/data/bar/orderlines';
import { FIRST_MEET } from '../src/data/bar/firstmeet';
import { GUEST_ANON, GUEST_BY_ID, GUESTS } from '../src/data/bar/guests.gen';
import { GUEST_LINES, type GuestLines } from '../src/data/bar/guestlines';
import { GUEST_AIDEN } from '../src/data/bar/guestaiden';
declare const process: { exitCode?: number; argv?: string[] };
declare function require(m: 'node:fs'): { readdirSync(p: string): string[]; readFileSync(p: string, e: 'utf8'): string };

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
  if (u.id === 'rachel' || u.inert || u.noBar) continue; // 반려 돌(절망 증강) · 바 대본이 아직 없는 기물(noBar: 청라공국 · 미노스)은 바에 오지 않는다
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
  if (u.id === 'rachel' || u.inert || u.noBar) continue;
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
for (const u of UNITS) if (u.id !== 'rachel' && u.id !== 'aiden' && !u.inert && !u.noBar && !LEAVE_LINES[u.id]) errs.push(`작별 인사: ${u.name}(${u.id}) 없음`);
if (!LEAVE_GENERIC.length || !BAR_WAIT.length || !BAR_ENTER.length || !AIDEN_BACK.length) errs.push('작별 인사: 일반 인사 · 대기 서술 · 입장 서술 · 에이든 카운터 풀이 비었음');
// 정규 단원 명단 = lore/_틀/틀-에란테스.md 의 에란테스 표 (픽서 · 객원 표 앞까지, 주인공 제외)
const frameDoc = require('node:fs').readFileSync('lore/_틀/틀-에란테스.md', 'utf8').split('픽서')[0];
const NAME_TO_ID = Object.fromEntries(UNITS.map((u) => [u.name, u.id]));
const crewDoc = [...frameDoc.matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1]).filter((n) => n !== '주인공');
const crewIds = crewDoc.map((n) => NAME_TO_ID[n] || `?${n}`);
crewIds.filter((id) => id.startsWith('?')).forEach((id) => errs.push(`정규 단원: 틀 문서의 ${id.slice(1)} 이(가) 기물에 없음`));
if ([...crewIds].sort().join() !== [...ERANTES_CREW].sort().join()) errs.push(`정규 단원: mono.ts ERANTES_CREW 가 틀-에란테스 표와 다름 (표 ${crewIds.length}명 · 코드 ${ERANTES_CREW.length}명)`);
// 혼잣말: 정규 단원마다 6종 (레이첼 제외), 이름표 없는 한 줄
for (const id of ERANTES_CREW) {
  if (id === 'rachel') errs.push('혼잣말: 레이첼은 넣지 않는다');
  for (const k of MONO_KINDS) {
    const l = MONO[id]?.[k];
    if (!l?.trim()) errs.push(`혼잣말: ${id} ${k} 없음`);
    else if (l.startsWith('* ') || /^[^:\s]{1,8}: /.test(l)) errs.push(`혼잣말: ${id} ${k} 는 그 인물의 말 한 줄이어야 한다 (서술 · 이름표 금지)`);
  }
}
for (const id of Object.keys(MONO)) if (!ERANTES_CREW.includes(id)) errs.push(`혼잣말: 정규 단원이 아닌 ${id}`);

// 무대 규칙 (src/ui/bar.ts 구경 모드, 화면 없이 모의 실행): 무대 STAGE_MAX 명 이하 · 0명 없음 · 레이첼 미등장 · 말하는 사람은 무대에 ·
// 걸어 들어오는 사람은 한 번에 1명, 직전 입퇴장 뒤 BAR_TUNE.vacant[0] 이상 지나서만 · 퇴장 전에는 그 사람의 작별 인사 ·
// 모의 실행 중에 들어온 사람은 BAR_TUNE.stay 최소 이상 머문다 · 같은 방문에 같은 혼잣말이 두 번 나오지 않는다 · 혼잣말은 정규 단원만.
// 낯선 손님의 무대 키는 'g.<번호>' (단원 지표에서 뺀다)
const amb = BANTER.filter((b) => b.place !== 2);
const needN = (c: string[]) => new Set(c.filter((id) => id !== 'rachel').map((id) => (id === 'cesare' ? 'joshua' : id))).size;
const castN = [0, 1, 2, 3, 4].map((n) => amb.filter((b) => b.cast.filter((id) => id !== 'rachel' && id !== 'aiden').length === n).length);
console.log(`바 무대 ${STAGE_MAX}명 (레이첼은 무대 밖 · 에이든은 거의 늘 1자리): 재생 가능한 바 만담 ${amb.filter((b) => needN(b.cast) <= STAGE_MAX).length}/${amb.length}편 · 레이첼 · 에이든 뺀 출연 0~4명 = ${castN.join(' / ')}편`);
// 무대 정원보다 출연이 많은 바 만담은 영영 재생되지 않는다 → 출연을 줄이거나 바 밖(place 2) 만담으로
for (const b of amb) if (needN(b.cast) > STAGE_MAX) errs.push(`만담 ${b.id}: 레이첼 뺀 출연 ${needN(b.cast)}명 > 무대 ${STAGE_MAX}명 — 재생되지 않는다 (${b.cast.join(' · ')})`);
const ROSTERS: [string, string[]][] = [
  ['전원', UNITS.filter((u) => !u.inert && !u.noBar).map((u) => u.id).filter((id) => id !== 'rachel' && id !== 'aiden')], // 반려 돌(절망 증강)은 바에 오지 않는다
  ['튜토리얼 7명', ['yelena', 'franze', 'lindiwe', 'vivian', 'phyllis', 'temur', 'nadir']],
  ['2명', ['vivian', 'temur']],
  ['없음', []],
];
const CREW = new Set(ERANTES_CREW);
const sim = { steps: 0, entries: 0, joins: 0, leaves: 0, waits: 0, idle: 0, mono: 0, emotes: 0, scenes: 0, nights: 0 };
/** 시간 지표 (명단별): 단원 체류 · 퇴장 사이 간격 · 정규 단원 비율(에이든 · 손님 뺀 단원 시간 중) · 에이든 무대 비율 */
const metric = (label: string) => ({ label, stay: [] as number[], gap: [] as number[], crewT: 0, unitT: 0, aidenT: 0, totT: 0, kindT: {} as Record<string, number> });
const metrics: ReturnType<typeof metric>[] = [];
for (const [label, ids] of ROSTERS) {
  const s0 = { ...sim };
  const mt = metric(label);
  metrics.push(mt);
  for (let run = 0; run < 3; run++) {
    const log = barSimulate(300, ids, run === 2); // 3번째는 밤에서 시작 (런을 마치고 돌아온 바)
    let lastChange = log[0].t;
    let lastExit = -1;
    let prev = new Set(log[0].stage);
    const first = new Set(log[0].stage);
    const since: Record<string, number> = {};
    const monos = new Set<string>();
    log.forEach((r, i) => {
      const at = `무대 모의 실행(${label}) ${i}번째 ${r.kind}`;
      const dt = (log[i + 1]?.t ?? r.t) - r.t;
      const regs = r.stage.filter((k) => k !== 'aiden' && !k.startsWith('g.'));
      mt.totT += dt; if (r.stage.includes('aiden')) mt.aidenT += dt;
      const kk = r.kind === 'idle' || r.kind === 'scene' ? '만담' : r.kind === 'emote' ? '이모티콘' : r.kind === 'mono' ? '혼잣말' : '그 밖의 말'; // 말풍선이 떠 있는 시간만, 나머지는 정적
      if (r.vis) mt.kindT[kk] = (mt.kindT[kk] || 0) + Math.min(r.vis, dt);
      for (const k of regs) { mt.unitT += dt; if (CREW.has(k)) mt.crewT += dt; if (since[k] === undefined) since[k] = r.t; }
      if (r.stage.length > STAGE_MAX) errs.push(`${at}: 무대 ${r.stage.length}명`);
      if (!r.stage.length && !r.night && ids.length) errs.push(`${at}: 낮인데 무대가 비었음`); // 밤에는 레이첼 혼자일 수 있다
      if (r.night && r.stage.includes('aiden') && r.kind !== 'leave') errs.push(`${at}: 밤인데 에이든이 무대에 있음 (낮에만 출근)`);
      for (const e of r.emotes) if (!r.stage.includes(e)) errs.push(`${at}: 이모티콘 ${e} 가 무대에 없음`);
      if (r.night) sim.nights++;
      if (r.kind === 'emote') sim.emotes++;
      if (r.kind === 'scene' || r.kind === 'idle') sim.scenes++;
      if (r.stage.includes('rachel')) errs.push(`${at}: 레이첼이 무대에 섰음`);
      for (const sp of r.speakers) if (!r.stage.includes(sp)) errs.push(`${at}: 말하는 ${sp} 가 무대에 없음 (${r.key})`);
      for (const k of r.stage) if (since[k] === undefined) since[k] = r.t;
      const fresh = r.stage.filter((k) => !prev.has(k) && k !== 'aiden');
      if (i > 0 && fresh.length) {
        sim.entries++;
        if (fresh.length > 1) errs.push(`${at}: 한 번에 ${fresh.length}명이 들어옴`);
        if (fresh.some((k) => !r.speakers.includes(k)) && r.t - lastChange < BAR_TUNE.vacant[0]) errs.push(`${at}: 직전 입퇴장 ${r.t - lastChange}ms 만에 들어옴`); // 장면의 '손님' 역(말하는 사람)은 바로 들어온다
        if (r.speakers.some((k) => prev.has(k) && k !== 'aiden' && !k.startsWith('g.'))) sim.joins++; // 남아 있던 사람과 함께 나오는 합류 장면
        lastChange = r.t;
      }
      if (r.kind === 'exit' && r.exit) {
        const p = log[i - 1];
        if (p?.kind !== 'leave' || p.speakers.join() !== r.exit) errs.push(`${at}: 작별 인사 없이 ${r.exit} 퇴장`);
        if (r.exit !== 'aiden') { // 에이든은 카운터 뒤로 잠깐 (빈자리 규칙과 무관)
          const stay = r.t - (since[r.exit] ?? r.t);
          const min = (r.exit.startsWith('g.') ? BAR_TUNE.stay.guest : BAR_TUNE.stay.crew)[0];
          if (!first.has(r.exit) && stay < min) errs.push(`${at}: ${r.exit} 가 ${Math.round(stay / 1000)}초 만에 나감 (최소 ${min / 1000}초)`);
          if (!r.exit.startsWith('g.')) mt.stay.push(stay);
          delete since[r.exit]; first.delete(r.exit);
          if (lastExit >= 0) mt.gap.push(r.t - lastExit);
          lastExit = r.t;
          sim.leaves++;
          lastChange = r.t;
        }
      }
      if (r.mono) {
        sim.mono++;
        if (monos.has(r.mono)) errs.push(`${at}: 같은 혼잣말이 다시 나옴 (${r.mono})`);
        monos.add(r.mono);
        if (!CREW.has(r.mono.slice(5).split('.')[0])) errs.push(`${at}: 정규 단원이 아닌 혼잣말 ${r.mono}`);
      }
      sim.steps++;
      if (r.kind === 'wait') sim.waits++;
      if (r.kind === 'idle') sim.idle++;
      prev = new Set(r.stage);
    });
  }
  if (process.argv?.includes('--stage')) console.log(`  ${label}: ${Object.entries(sim).map(([k, v]) => `${k} ${v - s0[k as keyof typeof sim]}`).join(' · ')}`);
}
const avgS = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length / 1000) : 0);
console.log(`무대 모의 실행 ${sim.steps}단계: 입장 ${sim.entries} (합류 장면 ${sim.joins}) · 퇴장 ${sim.leaves} · 만담 ${sim.scenes} (바텐더와 손님 ${sim.idle}) · 정적 ${sim.waits} · 혼잣말 ${sim.mono} · 이모티콘 ${sim.emotes} · 밤 ${sim.nights}단계`);
for (const m of metrics.slice(0, 2)) {
  console.log(`  ${m.label}: 단원 평균 체류 ${avgS(m.stay)}초 · 퇴장 간격 ${avgS(m.gap)}초 · 정규 단원 비율 ${Math.round((m.crewT / (m.unitT || 1)) * 100)}% · 에이든 무대 ${Math.round((m.aidenT / (m.totT || 1)) * 100)}%`);
  const talk = Object.values(m.kindT).reduce((a, b) => a + b, 0);
  console.log(`    시간 비율 (화면에 떠 있는 동안): ${Object.entries(m.kindT).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / (m.totT || 1)) * 100)}%`).join(' · ')} · 정적 ${Math.round((1 - talk / (m.totT || 1)) * 100)}%`);
}
// 시간 가속과 손님 수: 머무는 시간 · 빈자리 대기가 바 시간 기준이라 1배 · 8배의 평균 손님 수가 같아야 한다 (10% 안).
// 바 시간 하루(24시간)마다 들어오는 사람 수 · 들어오는 사람 없이 지나는 가장 긴 구간도 본다
{
  const DAY = BAR_TUNE.day + BAR_TUNE.night, ids = ROSTERS[0][1];
  const flow = (rate: number) => {
    let area = 0, end = 0, ent = 0, gap = 0, strT = 0, dayA = 0, dayS = 0, nightA = 0, nightS = 0;
    for (let run = 0; run < 6; run++) {
      const log = barSimulate(rate === 1 ? 1500 : 400, ids, run % 2 === 1, rate);
      let last = 0, prev = new Set(log[0].stage);
      log.forEach((r, i) => {
        const dt = (log[i + 1]?.t ?? r.t) - r.t;
        const ps = r.stage.filter((k) => k !== 'aiden');
        const g = ps.filter((k) => k.startsWith('g.')).length;
        area += ps.length * dt; strT += g * dt;
        if (r.night) { nightA += ps.length * dt; nightS += g * dt; } else { dayA += ps.length * dt; dayS += g * dt; }
        for (const k of ps) if (!prev.has(k)) { ent++; gap = Math.max(gap, r.t - last); last = r.t; }
        prev = new Set(r.stage);
      });
      const t = log[log.length - 1].t;
      gap = Math.max(gap, t - last); end += t;
    }
    return { head: area / end, perDay: (ent * DAY) / end, gapH: gap / BAR_TUNE.hour, str: strT / (area || 1), day: dayS / (dayA || 1), night: nightS / (nightA || 1) };
  };
  const a = flow(1), b = flow(BAR_FAST);
  console.log(`손님 흐름 (전원, 바 시간 기준): 1배 평균 ${a.head.toFixed(2)}명 · 하루 ${a.perDay.toFixed(1)}명 입장 · 입장 없는 최장 ${a.gapH.toFixed(1)}시간 · 낯선 손님 낮 ${Math.round(a.day * 100)}% · 밤 ${Math.round(a.night * 100)}% | ${BAR_FAST}배 평균 ${b.head.toFixed(2)}명 · 하루 ${b.perDay.toFixed(1)}명 · 최장 ${b.gapH.toFixed(1)}시간 · 낯선 손님 낮 ${Math.round(b.day * 100)}% · 밤 ${Math.round(b.night * 100)}%`);
  if (Math.abs(a.head - b.head) > 0.1 * a.head) errs.push(`손님 흐름: 1배 평균 ${a.head.toFixed(2)}명 · ${BAR_FAST}배 ${b.head.toFixed(2)}명 — 10% 넘게 다름`);
  for (const [n, x] of [['1배', a], [`${BAR_FAST}배`, b]] as const) {
    if (x.perDay < 10) errs.push(`손님 흐름 ${n}: 하루 입장 ${x.perDay.toFixed(1)}명 (10명 미만)`);
    if (x.gapH > 10) errs.push(`손님 흐름 ${n}: 입장 없는 구간 ${x.gapH.toFixed(1)}시간 (10시간 초과)`); // 새벽(0~1명) · 저녁(꽉 참)이 겹치면 7~9시간까지 나온다
    if (Math.abs(x.day - 0.66) > 0.1 || Math.abs(x.night - 0.33) > 0.1) errs.push(`손님 흐름 ${n}: 낯선 손님 비율 낮 ${Math.round(x.day * 100)}% · 밤 ${Math.round(x.night * 100)}% (목표 66% · 33%, ±10%)`);
  }
}
// 낯선 손님 (명부 src/data/bar/guests.gen.ts · 대사 src/data/bar/guestlines.ts): 대사가 있는 손님은 칸 수 · 자리 표시 · 명부 id 가 맞아야 한다.
// 대사가 아직 없는 손님은 바에 와도 공통 대사로 주문하고 이름을 밝히지 않는다 (수만 보인다)
{
  const need: [keyof GuestLines, number, number][] = [['enter', 2, 2], ['call', 2, 2], ['vague', 2, 2], ['photo', 2, 2], ['name', 2, 2], ['usual', 2, 2], ['like', 2, 2], ['ok', 2, 2], ['bad', 2, 2], ['drop', 2, 2], ['leave', 3, 3], ['mono', 6, 6], ['meet', 10, 18]];
  for (const [id, L] of Object.entries(GUEST_LINES)) {
    const g = GUEST_BY_ID[id];
    if (!g) { errs.push(`손님 대사 ${id}: 명부에 없는 손님`); continue; }
    for (const [k, lo, hi] of need) { const n = (L[k] as string[] | undefined)?.length ?? 0; if (n < lo || n > hi) errs.push(`손님 대사 ${id}.${String(k)}: ${n}줄 (${lo}~${hi})`); }
    if (!L.hint) errs.push(`손님 대사 ${id}.hint 없음`);
    if (L.topics?.length !== 2 || L.topics.some((t) => !t.label || t.lines.length < 4)) errs.push(`손님 대사 ${id}.topics: 2편 · 편마다 4줄 이상`);
    if (!L.vague.every((l) => l.includes('{feel}'))) errs.push(`손님 대사 ${id}.vague: {feel} 없는 줄`);
    if (!L.name.every((l) => l.includes('{menu}'))) errs.push(`손님 대사 ${id}.name: {menu} 없는 줄`);
    if (!L.hint.includes('{menu}')) errs.push(`손님 대사 ${id}.hint: {menu} 없음`);
    if (!L.meet.some((l) => l.includes(g.name.split(' ')[0]))) errs.push(`손님 대사 ${id}.meet: 이름(${g.name})을 밝히는 줄이 없음`);
    for (const l of [...L.meet, ...L.topics.flatMap((t) => t.lines)]) lineCheck(`손님 대사 ${id}`, l);
  }
  const miss = GUESTS.filter((g) => !GUEST_LINES[g.id]);
  console.log(`낯선 손님: 명부 ${GUESTS.length}명 · 대사 ${GUESTS.length - miss.length}명${miss.length ? ` (대사 없음 ${miss.length}: ${miss.slice(0, 8).map((g) => g.id).join(' ')}${miss.length > 8 ? ' …' : ''})` : ''} · 익명 그림 ${GUEST_ANON.length}`);
}
// 에이든 × 낯선 손님 만담 (src/data/bar/guestaiden.ts, 지침 art/guests/_aiden_brief.md): 손님마다 3편 · 편마다 4~7줄 · 에이든과 그 손님이 둘 다 말한다 ·
// 서술 줄 없음 · 이름표는 에이든 · 레이첼만 · 이름을 밝히기 전 편(named 없음)에는 그 손님 이름이 없다
{
  let n = 0;
  for (const [id, ts] of Object.entries(GUEST_AIDEN)) {
    const g = GUEST_BY_ID[id];
    if (!g) { errs.push(`에이든 만담 ${id}: 명부에 없는 손님`); continue; }
    if (ts.length !== 3) errs.push(`에이든 만담 ${id}: ${ts.length}편 (3편)`);
    const parts = g.name.split(' ').filter((x) => x.length >= 2);
    ts.forEach((t, i) => {
      const w = `에이든 만담 ${id}.${i}`;
      n++;
      if (!t.sit) errs.push(`${w}: sit 없음`);
      if (t.lines.length < 4 || t.lines.length > 7) errs.push(`${w}: ${t.lines.length}줄 (4~7)`);
      const label = (l: string) => l.match(/^([^:\s]{1,8}): /)?.[1];
      if (!t.lines.some((l) => label(l) === '에이든')) errs.push(`${w}: 에이든 줄 없음`);
      if (!t.lines.some((l) => !label(l))) errs.push(`${w}: 손님 줄 없음`);
      for (const l of t.lines) {
        if (l.startsWith('* ')) errs.push(`${w}: 서술 줄 (무대 말풍선이라 쓰지 않는다)`);
        const lb = label(l);
        if (lb && lb !== '에이든' && lb !== '레이첼') errs.push(`${w}: 이름표 '${lb}' (에이든 · 레이첼만)`);
      }
      if (!t.named && parts.some((x) => t.lines.some((l) => l.includes(x)))) errs.push(`${w}: 이름 밝히기 전 편에 이름(${g.name})`);
    });
  }
  console.log(`에이든 × 낯선 손님 만담: 손님 ${Object.keys(GUEST_AIDEN).length}명 · ${n}편`);
}
// 반복 개그 회수 〔회수:id,id〕: 깔린 편이 있고 보류 · 자기 자신이 아니어야 (없으면 영영 재생되지 않는다)
const BID = new Map(BANTER.map((b) => [b.id, b]));
for (const b of BANTER) for (const id of b.callback || []) {
  const x = BID.get(id);
  if (!x) errs.push(`만담 ${b.id}: 회수 대상 ${id} 없음`);
  else if (x.hold) errs.push(`만담 ${b.id}: 회수 대상 ${id} 가 보류`);
  else if (id === b.id) errs.push(`만담 ${b.id}: 자기 자신을 회수`);
}
const shapes = new Map<string, number>();
for (const b of BANTER) if (!b.hold) shapes.set(b.shape || '(없음)', (shapes.get(b.shape || '(없음)') || 0) + 1);
console.log(`만담 모양: ${[...shapes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
// ───────── 바 운영 (docs/BAR_OPS.md): 메뉴 · 단골 · 주문 · 채점 · 주문 대사
for (const r of RECIPES) {
  const g = GLASS_BY_ID[r.glass];
  if (!g) errs.push(`메뉴 ${r.id}: 모르는 잔 ${r.glass}`);
  else if (r.fill.length !== g.slots) errs.push(`메뉴 ${r.id}: ${g.name} 는 ${g.slots}칸인데 ${r.fill.length}칸`);
  for (const x of r.fill) if (!ING_BY_ID[x]) errs.push(`메뉴 ${r.id}: 모르는 재료 ${x}`);
  for (const x of r.garnish) if (!GARNISH_BY_ID[x]) errs.push(`메뉴 ${r.id}: 모르는 가니쉬 ${x}`);
  if (r.garnish.length > GARNISH_MAX) errs.push(`메뉴 ${r.id}: 가니쉬 ${r.garnish.length}개 (최대 ${GARNISH_MAX})`);
  if (recipeName(r) !== r.name) errs.push(`메뉴 ${r.id}: 같은 구성의 다른 메뉴가 있다 (${recipeName(r)})`);
  if (judge({ who: 'x', style: 'name', at: 0, target: r, name: r.name }, r).grade !== 'like') errs.push(`메뉴 ${r.id}: 메뉴 그대로 만든 잔이 좋아함이 아니다`);
}
for (const [id, x] of Object.entries(REGULARS)) { if (!ok(id)) errs.push(`단골 ${id}: 모르는 인물`); if (!RECIPE_BY_ID[x.menu]) errs.push(`단골 ${id}: 모르는 메뉴 ${x.menu}`); }
// 느낌 주문은 그 기준 잔으로 늘 '좋아함'이 나와야 한다 (만들 수 있는 주문만)
let rs = 7; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 2000; i++) {
  const r = RECIPES[i % RECIPES.length];
  const cs = feelConds(r, rnd);
  const o = { who: 'x', style: 'vague' as const, at: 0, conds: cs };
  if (!cs.length || cs.length > 3) errs.push(`느낌 주문 ${r.id}: 조건 ${cs.length}개`);
  if (judge(o, r).grade !== 'like') { errs.push(`느낌 주문 ${r.id}: 기준 잔이 조건을 못 맞춤 (${feelText(cs)})`); break; }
}
for (const id of Object.keys(REGULARS)) for (const st of ['vague', 'photo', 'name', 'usual'] as const) {
  const o = makeOrder(id, 0, { night: true, style: st }, rnd);
  if (st !== 'vague' && !o.target) errs.push(`주문 ${id}/${st}: 맞출 잔이 없다`);
}
// 잔 속 불투명도: 재료마다 0.3 ~ 0.95 (완전히 불투명한 음료는 없다)
for (const g of Object.values(ING_BY_ID)) if (!(g.alpha >= 0.3 && g.alpha <= 0.95)) errs.push(`재료 ${g.id}: 불투명도 ${g.alpha} (0.3 ~ 0.95)`);
// 술을 안 마시는 손님 (ORDER_AVOID): 주문 2000건에 피하는 재료가 든 잔이 없고, 그런 잔을 내주면 별로
for (const id of Object.keys(ORDER_AVOID)) {
  if (!REGULARS[id] && !GUEST_BY_ID[id]) { errs.push(`ORDER_AVOID ${id}: 모르는 손님`); continue; }
  for (let i = 0; i < 2000; i++) {
    const st = (['vague', 'photo', 'name', 'usual'] as const)[i % 4];
    const o = makeOrder(id, 0, { night: true, style: st }, rnd);
    if (o.target && !canOrder(id, o.target)) { errs.push(`주문 ${id}/${st}: 안 마시는 재료가 든 ${o.name || '잔'}`); break; }
  }
  const bad = RECIPES.find((r) => !canOrder(id, r));
  if (bad && judge({ who: id, style: 'name', at: 0, target: bad, name: bad.name }, bad).grade !== 'bad') errs.push(`주문 ${id}: 안 마시는 재료가 든 잔을 내줬는데 별로가 아니다`);
}
// 사진 주문은 층 순서를 본다: 층을 뒤집은 잔은 좋아함이 아니다 (프로즌 · 뒤집어도 같은 잔 제외). 이름 주문은 순서 무관
for (const r of RECIPES) {
  const rev = { ...r, fill: [...r.fill].reverse() };
  if (rev.fill.join() === r.fill.join()) continue;
  const photo = judge({ who: 'x', style: 'photo', at: 0, target: r }, rev).grade;
  if (r.ice !== 'frozen' && photo === 'like') errs.push(`사진 주문 ${r.id}: 층을 뒤집어도 좋아함`);
  if (r.ice === 'frozen' && photo !== 'like') errs.push(`사진 주문 ${r.id}: 프로즌인데 층 순서를 본다`);
  if (judge({ who: 'x', style: 'name', at: 0, target: r, name: r.name }, rev).grade !== 'like') errs.push(`이름 주문 ${r.id}: 층 순서를 본다`);
}
// 주문 대사: 정규 단원 25명 모두 · 방식마다 {feel} · {menu} 자리
const CUSTOMERS = ERANTES_CREW.filter((id) => id !== 'aiden');
for (const id of CUSTOMERS) if (!ORDER_TALK[id]) errs.push(`주문 대사 ${id}: 없음`);
for (const [id, t] of [...Object.entries(ORDER_TALK), ['(공통)', ORDER_GENERIC] as const]) {
  for (const k of ['vague', 'photo', 'name', 'usual', 'like', 'ok', 'bad'] as const) {
    if (!t[k]?.length) { errs.push(`주문 대사 ${id}.${k}: 비었다`); continue; }
    for (const l of t[k]) {
      if (k === 'vague' && (l.match(/\{feel\}/g) || []).length !== 1) errs.push(`주문 대사 ${id}.vague: {feel} 이 한 번이 아니다 — ${l}`);
      if (k === 'name' && !l.includes('{menu}')) errs.push(`주문 대사 ${id}.name: {menu} 없음 — ${l}`);
      if (k !== 'vague' && l.includes('{feel}')) errs.push(`주문 대사 ${id}.${k}: {feel} 은 느낌 주문에만 — ${l}`);
      if ((k === 'photo' || k === 'usual') && l.includes('{menu}')) errs.push(`주문 대사 ${id}.${k}: 메뉴 이름을 말하면 안 된다 — ${l}`);
    }
  }
  if (!t.hint?.includes('{menu}')) errs.push(`주문 대사 ${id}.hint: {menu} 없음`);
}
// 레이첼과의 첫 만남: 바에 오는 단원 전원 (레이첼 · 보류한 카일 · 데미우르고스 제외), 이름표 · 길이
const MEET_SKIP = new Set(['rachel', 'kyle', 'demiurgos']);
for (const [id, ls] of Object.entries(FIRST_MEET)) {
  if (!ok(id)) errs.push(`첫 만남 ${id}: 모르는 인물`);
  ls.forEach((l, i) => lineCheck(`첫 만남 ${id}:${i}`, l));
  if (ls.length < 6 || ls.length > 18) errs.push(`첫 만남 ${id}: ${ls.length}줄 (6~18줄)`);
}
const meetMiss = UNITS.filter((u) => !u.inert && !u.noBar && !MEET_SKIP.has(u.id) && !FIRST_MEET[u.id]).map((u) => u.id);
if (meetMiss.length) errs.push(`첫 만남 없음 ${meetMiss.length}명: ${meetMiss.join(' · ')}`);
console.log(`바 운영: 메뉴 ${RECIPES.length} · 단골 ${Object.keys(REGULARS).length} · 주문 대사 ${Object.keys(ORDER_TALK).length}/${CUSTOMERS.length}명`);
const askN = Object.keys(ASK).length, askDeep = Object.values(ASK).filter((a) => a.past[2]).length;
console.log(`물어보기: ${askN}명 × 질문 ${ASK_Q.length}개 (실재 층 답 ${askDeep}명)`);
const lay = (xs: { layer: string }[]) => ['s', 'i', 'r'].map((k) => xs.filter((x) => x.layer === k).length).join(' / ');
console.log(`바 데이터: 만담 ${BANTER.length}편 (표면/이상/실재 ${lay(BANTER)}) · 확장 틀 ${FRAMES.length}편 (${lay(FRAMES)}) · 끼어들기 버전 ${FRAMES.reduce((n, f) => n + f.slots.reduce((a, s) => a + Object.keys(s).length, 0), 0)}`);
if (errs.length) { console.log(`바 데이터 검사 실패 ${errs.length}건`); errs.slice(0, 30).forEach((e) => console.log(' · ' + e)); process.exitCode = 1; } else console.log('바 데이터 검사: 통과');
