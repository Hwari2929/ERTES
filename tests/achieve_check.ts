// 업적 검사 (data/achievements.ts · engine/achieve.ts · ui/achieve.ts). npm run check 에서 함께 돈다.
//   1. 데이터: id 중복 · 형식, 이름 · 설명 누락, 설명에 undefined · NaN, 등급, 숨김 업적의 귀띔, 메달 문양, 개수(20~30)
//   2. 숫자 표기: 이름 · 설명 · 귀띔은 아라비아 숫자로 ('세 번째' → '3번째'. 관용 '한 번' 등은 허용)
//   3. 참조: 판정이 가리키는 사건 id · 결과 키(api.outcome) · 선택지가 사건 데이터에 실제로 있다
//   4. 판정(순수 함수): 사실 하나로 기대한 업적만 달성되는지 (이미 달성한 업적은 다시 나오지 않음)
//   5. 화면 조각: 메달 SVG · 도감 업적 탭 · 바 진열장 HTML 에 undefined · NaN 이 없다
//   6. 실효 위험 등급 (data/difficulty.ts effDiff): 고난 + 절망 서약 절망 수치 CFG.oathDiffStep 마다 +1 → 의뢰 성공 기록 · 위험 등급 업적
import { ACH_BY_ID, ACH_GRADES, ACHIEVEMENTS, type AchFact, BAR_GOAL, ENDLESS_STEPS, EVENT_GOAL, jo, judge, LOW_HP } from '../src/data/achievements';
import { EVENT_BY_ID } from '../src/data/events';
import { ALL_ADVANCED } from '../src/data/items';
import { FIELDS } from '../src/data/battlefields';
import { UNITS } from '../src/data/units';
import { CFG } from '../src/config';
import { battleFact, clearFact, countSkip, metaFact, tutorialFact } from '../src/engine/achieve';
import { effDiff, effDiffLabel, MAX_DIFF, runEffDiff } from '../src/data/difficulty';
import { loadMeta, metaClear, oathBestDiff } from '../src/ui/meta';
import { achCodexHtml, barShowcaseHtml, medalSvg, motifOk } from '../src/ui/achieve';
import type { Battle } from '../src/engine/combat';
import type { RunState } from '../src/types';
import type { Meta } from '../src/ui/meta';
declare const process: { exitCode?: number };
declare function require(m: 'node:fs'): { readFileSync(p: string, e: 'utf8'): string; readdirSync(p: string): string[] };
const fs = require('node:fs');

const errs: string[] = [];
const bad = (s: string) => /undefined|NaN|\[object /.test(s);

// ───────── 1 · 2. 데이터 · 숫자 표기
const NUM_ALLOW = ['하나같이', '한두', '두세', '서너', '두어'];
const NATIVE = /(?<![가-힣0-9])(두|세|석|네|넉|다섯|여섯|일곱|여덟|아홉|열|스물|스무|서른|마흔|쉰)(?:하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉)? ?(번째|번|개|명|곳|종|편|판|회|단계|칸|장|잔|페이즈|연승)(?![가-힣])/;
const SINO = /(?<![가-힣0-9])([이삼사오육칠팔구]?[십백천])[일이삼사오육칠팔구]? ?(번째|번|개|명|곳|종|편|페이즈|년|일)(?![가-힣])/;
const numCheck = (where: string, s: string) => {
  let t = s.replace(/\[[^\]]*\]|「[^」]*」/g, '　'); // [사건 제목] · 「튜토리얼 제목」은 데이터에서 읽은 고유 이름
  for (const a of NUM_ALLOW) t = t.split(a).join('　');
  const m = NATIVE.exec(t) || SINO.exec(t) || /(이틀|사흘|나흘|닷새|열흘)/.exec(t);
  if (m) errs.push(`${where}: 한글 수 표기 '${m[0]}' — 아라비아 숫자로`);
};
const ids = new Set<string>();
for (const a of ACHIEVEMENTS) {
  const at = `업적 ${a.id}`;
  if (ids.has(a.id)) errs.push(`${at}: id 중복`);
  ids.add(a.id);
  if (!/^[a-z][a-z0-9_]*$/.test(a.id)) errs.push(`${at}: id 형식 (영소문자 · 숫자 · _)`);
  if (!a.name?.trim()) errs.push(`${at}: 이름 없음`);
  const d = a.desc();
  if (!d?.trim()) errs.push(`${at}: 설명 없음`);
  if (bad(a.name) || bad(d) || bad(a.hint || '')) errs.push(`${at}: 이름 · 설명에 undefined · NaN — ${a.name} / ${d}`);
  if (!ACH_GRADES.includes(a.grade)) errs.push(`${at}: 등급 ${a.grade}`);
  if (a.hidden && !a.hint?.trim()) errs.push(`${at}: 숨김 업적인데 귀띔(hint)이 없음`);
  if (!a.hidden && a.hint) errs.push(`${at}: 숨김이 아닌데 귀띔이 있음 (보이지 않는다)`);
  if (!motifOk(a.motif)) errs.push(`${at}: 메달 문양 '${a.motif}' 을 그릴 수 없음`);
  if (!/[.다]$/.test(d.trim())) errs.push(`${at}: 설명은 문장으로 끝낸다 ('…한다.') — ${d}`);
  for (const [k, s] of [['이름', a.name], ['설명', d], ['귀띔', a.hint || '']] as const) numCheck(`${at} ${k}`, s);
}
const names = ACHIEVEMENTS.map((a) => a.name);
names.forEach((n, i) => { if (names.indexOf(n) !== i) errs.push(`업적 이름 중복: ${n}`); });
if (ACHIEVEMENTS.length < 20 || ACHIEVEMENTS.length > 30) errs.push(`업적 수 ${ACHIEVEMENTS.length} (20~30개)`);
const hiddenN = ACHIEVEMENTS.filter((a) => a.hidden).length;
if (hiddenN < 3) errs.push(`숨김 업적 ${hiddenN}개 (몇 개는 숨긴다)`);
for (const g of ACH_GRADES) if (!ACHIEVEMENTS.some((a) => a.grade === g)) errs.push(`등급 ${g} 업적이 없음`);
// 조사 도우미
for (const [w, a, b, want] of [['[아문센의 보물 창고]', '을', '를', '를'], ['[함장석의 주인]', '을', '를', '을'], ['강제 징수기', '으로', '로', '로'], ['캣휠', '을', '를', '을'], ['올리버', '과', '와', '와'], ['밍키', '과', '와', '와'], ['1', '을', '를', '을']] as const) {
  if (jo(w, a, b) !== w + want) errs.push(`조사: ${w} + ${a}/${b} → ${jo(w, a, b)} (기대 ${w + want})`);
}

// ───────── 3. 참조: 판정 함수가 가리키는 사건 · 결과 키 · 선택지
const src = fs.readFileSync('src/data/achievements.ts', 'utf8');
const evRefs = new Set([...src.matchAll(/(?:ev|evIs)\((?:f, )?'([a-z0-9_]+)'/g)].map((m) => m[1]));
for (const id of evRefs) if (!EVENT_BY_ID[id]) errs.push(`업적이 가리키는 사건 ${id} 이 없음`);
const evSrc = ['events', 'storyA', 'storyB', 'storyC', 'storyD'].map((f) => fs.readFileSync(`src/data/${f}.ts`, 'utf8')).join('\n');
/** 사건 블록 (id 부터 다음 사건 id 전까지) */
const block = (id: string) => { const i = evSrc.indexOf(`id: '${id}'`); const j = evSrc.indexOf("\n    id: '", i + 5); return i < 0 ? '' : evSrc.slice(i, j < 0 ? undefined : j); };
for (const m of src.matchAll(/evIs\(f, '([a-z0-9_]+)', \(x\) => ([^)]*?)\)\s*\}/g)) {
  const [, id, cond] = m;
  for (const o of cond.matchAll(/x\.outcome === '([a-z_]+)'/g)) if (!block(id).includes(`outcome('${o[1]}'`)) errs.push(`업적: 사건 ${id} 에 결과 키 '${o[1]}' (api.outcome) 이 없음`);
  for (const c of cond.matchAll(/x\.choice === (\d+)/g)) if (!EVENT_BY_ID[id]?.choices[+c[1]]) errs.push(`업적: 사건 ${id} 에 선택지 ${c[1]} 이 없음`);
}
const choiceLabel = (id: string, i: number) => EVENT_BY_ID[id]?.choices[i]?.label || '';
if (!/전부 건다/.test(choiceLabel('faceless', 0))) errs.push(`업적 faceless: 사건 선택지 0 이 '전부 건다' 가 아님 (${choiceLabel('faceless', 0)})`);
if (!/숨결/.test(choiceLabel('sd_ferry', 0))) errs.push(`업적 ferry_win: 사건 선택지 0 이 '숨결을 건다' 가 아님 (${choiceLabel('sd_ferry', 0)})`);
if (!UNITS.some((u) => u.id === 'mingki') || !UNITS.some((u) => u.id === 'oliver')) errs.push('업적 catwheel: 밍키 · 올리버 기물이 없음');

// ───────── 4. 판정 (순수 함수)
const expect = (label: string, f: AchFact, want: string[], not: string[] = [], got: Record<string, string> = {}) => {
  const r = judge(f, got);
  for (const id of want) { if (!ACH_BY_ID[id]) errs.push(`판정 ${label}: 모르는 업적 ${id}`); else if (!r.includes(id)) errs.push(`판정 ${label}: ${id} 달성이어야 함 (결과 ${r.join(', ') || '없음'})`); }
  for (const id of not) if (r.includes(id)) errs.push(`판정 ${label}: ${id} 는 달성이 아니어야 함`);
};
const ally = (id: string, items: string[] = [], alive = true) => ({ id, items, alive });
const fight = (o: Partial<Extract<AchFact, { k: 'battle' }>>): AchFact => ({ k: 'battle', won: true, node: 'battle', phase: 3, endless: false, tutorial: false, allies: [ally('vivian'), ally('temur')], fleet: 0, streak: 1, ...o });
expect('첫 성공', { k: 'meta', clears: 1, fieldsCleared: ['swarm'], bestDiff: 3, events: 3, barSeen: 2 }, ['first_clear'], ['hard_clear', 'all_fields', 'events_50', 'bar_regular']);
expect('기록 가득', { k: 'meta', clears: 30, fieldsCleared: FIELDS.map((f) => f.id), bestDiff: 99, events: EVENT_GOAL, barSeen: BAR_GOAL }, ['first_clear', 'hard_clear', 'max_clear', 'all_fields', 'events_50', 'bar_regular']);
expect('이미 달성', { k: 'meta', clears: 1, fieldsCleared: [], bestDiff: -1, events: 0, barSeen: 0 }, [], ['first_clear'], { first_clear: '2026-01-01' });
expect('튜토리얼 끝까지', { k: 'tutorial', done: true, skips: 0 }, ['tutorial_full']);
expect('튜토리얼 장면 건너뜀', { k: 'tutorial', done: true, skips: 2 }, [], ['tutorial_full']);
expect('튜토리얼 건너뛰기', { k: 'tutorial', done: false, skips: 0 }, [], ['tutorial_full']);
expect(`무한 ${ENDLESS_STEPS[0]}`, fight({ node: 'boss', phase: ENDLESS_STEPS[0], endless: true }), ['endless_10'], ['endless_20', 'endless_30']);
expect(`무한 ${ENDLESS_STEPS[2]}`, fight({ node: 'boss', phase: ENDLESS_STEPS[2], endless: true }), ['endless_10', 'endless_20', 'endless_30']);
expect('무한 보스 패배', fight({ node: 'boss', phase: 40, endless: true, won: false }), [], ['endless_10']);
expect('일반 전투 페이즈 12', fight({ node: 'battle', phase: 12, endless: true }), [], ['endless_10']);
expect('무혈 보스', fight({ node: 'boss', phase: 2 }), ['flawless_boss'], ['last_one']);
expect('최후의 1인', fight({ node: 'boss', phase: 4, allies: [ally('a', [], false), ally('b', [], false), ally('c', [], false), ally('d')] }), ['last_one'], ['flawless_boss']);
expect('3명 중 1인', fight({ node: 'boss', phase: 4, allies: [ally('a', [], false), ally('b', [], false), ally('d')] }), [], ['last_one']);
expect(`${CFG.fleetCosts.length}회 확장`, fight({ fleet: CFG.fleetCosts.length }), ['fleet_full']);
expect('연승', fight({ streak: 10 }), ['streak_10']);
expect('튜토리얼 전투', fight({ node: 'boss', phase: 30, tutorial: true, streak: 99 }), [], ['endless_30', 'streak_10', 'flawless_boss']);
const fam = UNITS.filter((u) => u.factions.includes('FAM')).map((u) => ally(u.id));
expect('일가 총출동', fight({ allies: fam }), ['family_all']);
expect('일가 1명 빠짐', fight({ allies: fam.slice(1) }), [], ['family_all']);
expect('캣휠 밍키 + 올리버', fight({ allies: [ally('mingki', ['J_catwheel']), ally('oliver')] }), ['catwheel']);
expect('캣휠 밍키, 올리버 없음', fight({ allies: [ally('mingki', ['J_catwheel']), ally('rachel')] }), [], ['catwheel']);
expect('캣휠 없는 밍키 + 올리버', fight({ allies: [ally('mingki'), ally('oliver')] }), [], ['catwheel']);
expect('캣휠 밍키 + 올리버 패배', fight({ won: false, allies: [ally('mingki', ['J_catwheel']), ally('oliver')] }), [], ['catwheel']);
const ev = (id: string, choice = 0, outcome = 'default', tutorial = false): AchFact => ({ k: 'event', id, choice, outcome, tutorial });
expect('보물 창고', ev('vault'), ['vault']);
expect('중개인 전부 건다', ev('faceless', 0), ['faceless']);
expect('중개인 거절', ev('faceless', 1), [], ['faceless']);
expect('낙뢰 복권 당첨', ev('sc_zeus', 0, 'jackpot'), ['zeus_jackpot']);
expect('낙뢰 복권 감전', ev('sc_zeus', 0), [], ['zeus_jackpot']);
expect('단장의 상자', ev('sa_amundsen_bar', 1, 'legend'), ['amundsen_box']);
expect('여섯 번째 달', ev('sd_dice', 0, 'big'), ['dice_big']);
expect('뱃사공 숨결', ev('sd_ferry', 0, 'win'), ['ferry_win']);
expect('뱃사공 동전', ev('sd_ferry', 1, 'win'), [], ['ferry_win']);
expect('함장석', ev('sa_mingki_throne', 2, 'monster'), ['mingki_throne']);
expect('귀항', ev('sc_argo_home', 0), ['argo_home']);
expect('튜토리얼 사건', ev('vault', 0, 'default', true), [], ['vault']);
const clr = (o: Partial<Extract<AchFact, { k: 'clear' }>>): AchFact => ({ k: 'clear', tutorial: false, diff: 3, hp: 50, losses: 2, skips: 1, units: ['vivian'], ...o });
expect('건너뛰지 않은 성공', clr({ skips: 0 }), ['no_skip_clear'], ['no_loss_clear', 'low_hp_clear']);
expect('건너뛴 성공', clr({}), [], ['no_skip_clear']);
expect('무패 · 간신히', clr({ losses: 0, hp: LOW_HP }), ['no_loss_clear', 'low_hp_clear']);
expect('반려 돌', clr({ units: ['vivian', 'petrock'] }), ['petrock_clear']);
const legend = `L_${ALL_ADVANCED[0].slice(2)}`;
expect('징수: 보스 전설', { k: 'use', item: 'K_seize', foe: 'boss', got: legend }, ['seize_boss']);
expect('징수: 정예 전설', { k: 'use', item: 'K_seize', foe: 'elite', got: legend }, [], ['seize_boss']);
expect('징수: 보스 희귀', { k: 'use', item: 'K_seize', foe: 'boss', got: ALL_ADVANCED[0] }, [], ['seize_boss']);
// 어떤 업적이든 그 업적만으로 달성되는 사실이 하나는 있어야 한다 (판정이 늘 거짓인 업적 찾기)
const covered = new Set<string>();
for (const f of [
  { k: 'meta', clears: 30, fieldsCleared: FIELDS.map((x) => x.id), bestDiff: 99, events: 999, barSeen: 999 },
  { k: 'tutorial', done: true, skips: 0 },
  fight({ node: 'boss', phase: 99, endless: true, streak: 99, fleet: 99, allies: [...fam.filter((a) => a.id !== 'mingki'), ally('mingki', ['J_catwheel'])] }),
  fight({ node: 'boss', phase: 4, allies: [ally('a', [], false), ally('b', [], false), ally('c', [], false), ally('d')] }),
  ev('vault'), ev('faceless'), ev('sc_zeus', 0, 'jackpot'), ev('sa_amundsen_bar', 1, 'legend'), ev('sd_dice', 0, 'big'), ev('sd_ferry', 0, 'win'), ev('sa_mingki_throne'), ev('sc_argo_home'),
  clr({ skips: 0, losses: 0, hp: 1, units: ['petrock'] }),
  { k: 'use', item: 'K_seize', foe: 'boss', got: legend },
  { k: 'receipt', riders: 16 },
] as AchFact[]) judge(f).forEach((id) => covered.add(id));
for (const a of ACHIEVEMENTS) if (!covered.has(a.id)) errs.push(`업적 ${a.id}: 검사 사실 중 어느 것으로도 달성되지 않음 (판정이 늘 거짓?)`);

// 사실 만들기 (engine/achieve.ts)
const fakeRun = { node: { type: 'boss' }, phase: 10, endless: true, streak: 4, fleet: 2, tutorial: undefined, units: [{ defId: 'mingki' }, { defId: 'petrock' }], diff: 7, hp: 5, stats: { wins: 9, losses: 0, kills: 0, bestHit: 0 } } as unknown as RunState;
const src0 = { items: ['J_catwheel', null] }, src1 = { items: [null, null] };
const fakeBattle = { winner: 0, units: [
  { side: 0, src: src0, isSummon: false, defId: 'mingki', alive: true },
  { side: 0, src: src1, isSummon: false, defId: 'oliver', alive: false },
  { side: 0, isSummon: true, defId: 'summon', alive: true },
  { side: 1, isSummon: false, defId: 'varga', alive: false },
] } as unknown as Battle;
const bf = battleFact(fakeRun, fakeBattle);
if (bf.k !== 'battle' || bf.allies.length !== 2 || bf.node !== 'boss' || bf.phase !== 10 || bf.streak !== 5 || bf.fleet !== 2 || bf.allies[0].items.join() !== 'J_catwheel') errs.push(`battleFact: ${JSON.stringify(bf)}`);
expect('battleFact → 판정', bf, ['endless_10', 'catwheel'], ['flawless_boss']);
countSkip(fakeRun, 'ev:vault:1'); countSkip(fakeRun, 'bar:talk:aiden'); countSkip(fakeRun, 'nt:x:0');
const cf = clearFact(fakeRun);
if (cf.k !== 'clear' || cf.skips !== 2 || cf.losses !== 0 || cf.hp !== 5) errs.push(`clearFact / countSkip: ${JSON.stringify(cf)} (바 장면은 세지 않는다)`);
const tf = tutorialFact(fakeRun, true);
if (tf.k !== 'tutorial' || tf.skips !== 2) errs.push(`tutorialFact: ${JSON.stringify(tf)}`);
const mf = metaFact({ v: 1, maxDiff: 8, runs: 3, clears: 2, bestPhase: 7, units: {}, enemies: {}, events: { vault: 1, volunteer: 2, tinker: 0 }, fields: { swarm: { runs: 2, clears: 1, bestDiff: 7 }, waste: { runs: 1, clears: 0, bestDiff: -1 } }, bar: { seen: ['a', 'b'] } } as Meta);
if (mf.k !== 'meta' || mf.events !== 2 || mf.bestDiff !== 7 || mf.fieldsCleared.join() !== 'swarm' || mf.barSeen !== 2) errs.push(`metaFact: ${JSON.stringify(mf)}`);

// ───────── 5. 화면 조각
for (const a of ACHIEVEMENTS) for (const o of [{}, { locked: true }, { locked: true, secret: true }]) {
  const svg = medalSvg(a, o);
  if (bad(svg) || !svg.startsWith('<svg') || !/<(path|circle|rect|text)/.test(svg.split('class="am-ink"')[1] || '')) errs.push(`메달 ${a.id} ${JSON.stringify(o)}: SVG 이상`);
}
const cx = achCodexHtml();
if (bad(cx)) errs.push('도감 업적 탭에 undefined · NaN');
for (const a of ACHIEVEMENTS.filter((x) => x.hidden)) if (cx.includes(a.name)) errs.push(`도감 업적 탭: 달성 전 숨김 업적 이름이 보임 (${a.name})`);
if (!cx.includes(`/ <span class="f-num">${ACHIEVEMENTS.length}</span>`)) errs.push('도감 업적 탭: 전체 개수 표시');
if (barShowcaseHtml() !== '') errs.push('바 진열장: 놓인 메달이 없으면 그리지 않는다');

// ───────── 6. 실효 위험 등급: 표기 · 기록 · 업적 (적 배율 등 규칙은 실제 등급 그대로)
const H = CFG.oathFrom, STEP = CFG.oathDiffStep;
for (const [d, heat, want] of [[H, 0, H], [H, STEP - 1, H], [H, STEP, H + 1], [H, STEP * 2, H + 2], [H, STEP * 2 + 1, H + 2], [H - 1, STEP * 4, H - 1], [3, STEP * 2, 3]] as const) {
  if (effDiff(d, heat) !== want) errs.push(`effDiff(${d}, 절망 ${heat}) = ${effDiff(d, heat)} (기대 ${want})`);
}
if (effDiffLabel(H, STEP * 2) !== `고난 (위험 ${H + 2})`) errs.push(`effDiffLabel: ${effDiffLabel(H, STEP * 2)}`);
/** 위험 등급표의 마지막 칸(MAX_DIFF)에 닿는 고난 절망 수치 */
const maxHeat = (MAX_DIFF - H) * STEP;
const oathRun = (heat: number, field = 'waste') => ({ ...fakeRun, diff: H, field, oaths: heat ? { grit: 1 } : undefined, oathHeat: heat || undefined, cleared: true, usedIds: [], despairs: [] } as unknown as RunState);
if (runEffDiff(oathRun(maxHeat)) !== MAX_DIFF) errs.push(`runEffDiff: 절망 ${maxHeat} → ${runEffDiff(oathRun(maxHeat))} (기대 ${MAX_DIFF})`);
if (runEffDiff(oathRun(0)) !== H) errs.push(`runEffDiff: 서약 없음 → ${runEffDiff(oathRun(0))}`);
const cfo = clearFact(oathRun(maxHeat));
if (cfo.k !== 'clear' || cfo.diff !== MAX_DIFF) errs.push(`clearFact: 고난 + 절망 ${maxHeat} 의 diff = ${cfo.k === 'clear' ? cfo.diff : '?'} (기대 실효 등급 ${MAX_DIFF})`);
expect(`메타: 고난 + 절망 ${maxHeat - 1}`, { k: 'meta', clears: 1, fieldsCleared: ['waste'], bestDiff: effDiff(H, maxHeat - 1), events: 0, barSeen: 0 }, ['hard_clear'], ['max_clear']);
expect(`메타: 고난 + 절망 ${maxHeat}`, { k: 'meta', clears: 1, fieldsCleared: ['waste'], bestDiff: effDiff(H, maxHeat), events: 0, barSeen: 0 }, ['hard_clear', 'max_clear']);
// 의뢰 성공 기록 (ui/meta.ts metaClear): 전장별 최고 위험 등급 = 실효 등급, 해금(maxDiff)은 실제 등급 기준
const m0 = loadMeta(), maxDiff0 = m0.maxDiff;
metaClear(oathRun(STEP, 'swarm'));
metaClear(oathRun(maxHeat, 'waste'));
if (loadMeta().fields.swarm?.bestDiff !== H + 1) errs.push(`metaClear: 고난 + 절망 ${STEP} → 전장 최고 ${loadMeta().fields.swarm?.bestDiff} (기대 ${H + 1})`);
if (loadMeta().fields.waste?.bestDiff !== MAX_DIFF) errs.push(`metaClear: 고난 + 절망 ${maxHeat} → 전장 최고 ${loadMeta().fields.waste?.bestDiff} (기대 ${MAX_DIFF})`);
if (loadMeta().maxDiff !== Math.max(maxDiff0, Math.min(MAX_DIFF, H + 1))) errs.push(`metaClear: 해금 위험 등급 ${loadMeta().maxDiff} — 실제 등급(${H}) 기준이어야 함`);
const mfo = metaFact(loadMeta());
if (mfo.k !== 'meta' || mfo.bestDiff !== MAX_DIFF) errs.push(`metaFact: 실효 최고 위험 등급 ${mfo.k === 'meta' ? mfo.bestDiff : '?'}`);
expect('metaClear → 판정', mfo, ['hard_clear', 'max_clear']);
// 예전 기록 (서약 성공의 최고 절망 수치는 있지만 최고 위험 등급이 실제 등급이던 때): 다시 잡는다, 성공이 없는 전장은 그대로
const old = { fields: { waste: { runs: 2, clears: 1, bestDiff: H }, swarm: { runs: 1, clears: 0, bestDiff: -1 } }, oath: { best: { waste: maxHeat, swarm: maxHeat } } } as unknown as Meta;
oathBestDiff(old);
oathBestDiff(old);
if (old.fields.waste.bestDiff !== MAX_DIFF || old.fields.swarm.bestDiff !== -1) errs.push(`oathBestDiff: ${JSON.stringify(old.fields)}`);

if (errs.length) {
  console.log(`업적 검사 실패 ${errs.length}건`);
  errs.slice(0, 40).forEach((e) => console.log(' · ' + e));
  process.exitCode = 1;
} else {
  const by = ACH_GRADES.map((g) => `${g} ${ACHIEVEMENTS.filter((a) => a.grade === g).length}`).join(' · ');
  console.log(`업적 검사: 통과 (${ACHIEVEMENTS.length}개 · ${by} · 숨김 ${hiddenN})`);
}
