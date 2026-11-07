// UI 촬영용 저장 상태 만들기 (scripts/ui_shots.mjs 가 쓴다): 화면 이름 → RunState JSON 을 표준 출력으로.
// 실행: npx esbuild tests/ui_states.ts --bundle --platform=node --log-level=error --outfile=dist/ui_states.cjs && node dist/ui_states.cjs > dist/ui_states.json
// 노드 화면(상점 · 속보 · 투자 · 순례 · 합성 공방) · 고르기 창(특권 · 전역 증강 · 보급 · 영입 · 공명 증강 · 전리품 · 포탑 · 분기점 · 전환 · 절망 · 지정 소집 · 알림)
// · 지도 · 편성 · 보스 편성 · 결과(승리 · 패배). 같은 코드면 같은 상태가 나온다 (시드 고정).
import { CFG } from '../src/config';
import { UNITS, UNIT_BY_ID } from '../src/data/units';
import { DESPAIRS } from '../src/data/despair';
import { BLESSINGS } from '../src/data/globals';
import { buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { augChoice, forkChoice, manageItems, shopSynth, turretPickBot, pilgrimBot, TURRET_PREF } from './botlib';
import { Rng } from '../src/rng';
import type { Major, RunState } from '../src/types';

const out: Record<string, RunState> = {};
const clone = (r: RunState): RunState => JSON.parse(JSON.stringify(r));
const div = UNITS.filter((u) => (u as any).ttype === 'divine').slice(0, 3).map((u) => u.id);
const rest = UNITS.filter((u) => !div.includes(u.id) && !(u as any).special).slice(0, 5 - div.length).map((u) => u.id);
const TEAM = [...div, ...rest];
const fresh = (seed = 7, team = TEAM) => { const run = R.newRun(seed, team); return run; };

// 노드 화면
for (const t of ['shop', 'news', 'invest', 'pilgrim', 'recruit'] as const) {
  const run = fresh(); run.credits = 40; run.fame = 12; run.power = 6;
  R.enterNode(run, t);
  run.pending = run.pending.filter((p) => p.t === 'pilgrim' || p.t === 'recruit');
  out[t] = run;
}
{ const run = fresh(); run.pending = run.pending.filter((p) => p.t === 'privilege'); out.priv = run; }
{ const run = fresh(); run.pending = []; out.map = run; }
{ const run = fresh(); run.pending = []; R.enterNode(run, 'supply' as any); run.pending = run.pending.filter((p) => p.t === 'supply'); out.supply = run; }
{ const run = fresh(11); run.pending = []; R.enterNode(run, 'council' as any); run.pending = run.pending.filter((p) => p.t === 'global'); out.council = run; }
{ const run = fresh(); run.pending = []; R.enterNode(run, 'battle' as any); run.pending = []; out.prep = run; }
{ const run = fresh(); run.pending = []; run.step = 12; R.enterNode(run, 'boss' as any); run.pending = []; out.bossprep = run; }
for (const t of ['boss', 'shop', 'battle'] as const) { // 지도에서 그 노드를 고를 수 있는 칸 (보스 급행 · 상점 전환 · 전투 칸 예상 수입 확인)
  for (let seed = 7; seed < 60; seed++) {
    const run = fresh(seed); run.pending = [];
    const k = run.map.findIndex((row, i) => i > 0 && row.includes(t as any));
    if (k < 0) continue;
    run.step = k; run.path = run.path || [];
    for (let i = 0; i < k; i++) { const prev = run.links?.[i - 1]?.[run.path[i - 1] ?? 0]; run.path[i] = prev ? prev[0] : 0; }
    if (!R.currentOptions(run).includes(t as any)) continue;
    out[`${t}map`] = run; break;
  }
}
// 합성 공방: 오컬트 시너지 기물로 전환 → 합성
{
  const occ = UNITS.filter((u) => JSON.stringify(u).includes('"OCCULT"') && !(u as any).special).map((u) => u.id);
  for (let n = 2; n <= Math.min(5, occ.length) && !out.ws; n++) {
    const run = fresh(7, [...occ.slice(0, n), ...TEAM].slice(0, 5)); run.pending = []; R.autoPlace(run);
    run.pending = [{ t: 'fork' }]; R.pickFork(run, 'synth');
    if ((run.node as any)?.synth) out.ws = run;
  }
}
// 고르기 창 (알맞은 바탕 위에 pending 하나만)
const base = () => { const run = fresh(); run.pending = []; return run; };
{ const run = base(); run.pending = [{ t: 'rankup', uid: run.units[0].uid, rank: 3, points: 2, options: null, rerolls: 1, allocDone: true, kind: 'normal' as any }]; R.ensureRankupOptions(run, run.pending[0] as any); out.rankup = run; }
{ const run = base(); run.pending = [{ t: 'itemPick', title: '전리품 — 장비 1개 선택', options: ['K_feast', 'G_vit', 'S_dust'] }]; out.item = run; }
{ const run = base(); run.pending = [{ t: 'branch', options: ['shop', 'news'] }]; out.branch = run; }
{ const run = base(); run.pending = [{ t: 'fork' }]; out.fork = run; }
{ const run = base(); run.pending = [{ t: 'despair', options: DESPAIRS.slice(0, 3).map((d) => d.id), rerolls: 1 }]; out.despair = run; }
{ const run = base(); run.pending = [{ t: 'turretPick', options: TURRET_PREF.slice(0, 3), tier: 1 }]; out.turret = run; }
{ const run = base(); run.pending = [{ t: 'blessing', options: BLESSINGS.slice(0, 3).map((b) => b.id) }]; out.blessing = run; }
{ const run = base(); run.pending = [{ t: 'muster' }]; out.muster = run; }
{ const run = base(); run.pending = [{ t: 'notice', title: '알림', body: '측정용 알림 창입니다.', rows: [['크레딧', '+12'], ['명성', '+3']] }]; out.notice = run; }

// 결과 보고서: 봇이 끝까지 진행한 런 (승리 · 패배)
function resolvePending(run: RunState, bot: Rng) {
  let guard = 0;
  while (run.pending.length && guard++ < 50) {
    const p = run.pending[0] as any;
    if (p.t === 'privilege') { R.pickPrivilege(run, bot.int(0, p.options.length - 1)); continue; }
    if (p.t === 'event') { const order = bot.shuffle([0, 1, 2]); let done = false; for (const i of order) if (R.chooseEvent(run, i) === null && run.pending[0] !== p) { done = true; break; } if (!done) run.pending.shift(); continue; }
    if (p.t === 'victory') { run.pending.shift(); run.over = true; return; }
    if (p.t === 'global') R.pickGlobal(run, bot.pick(p.options));
    else if (p.t === 'rankup') { const u = run.units.find((x) => x.uid === p.uid)!; const d = UNIT_BY_ID[u.defId]; const pref: Major[] = d.range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd']; if (!p.allocDone) R.allocRank(run, p, pref); R.ensureRankupOptions(run, p); { const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a); } }
    else if (p.t === 'turretPick') { turretPickBot(run); continue; }
    else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
    else if (p.t === 'recruit') { const id = p.options[0]; if (id) R.recruit(run, id); else run.pending.shift(); }
    else if (p.t === 'pilgrim') { pilgrimBot(run); if (run.pending[0] === p) run.pending.shift(); continue; }
    else if (p.t === 'fork') { R.pickFork(run, forkChoice(run, () => bot.chance(0.5))); continue; }
    else if (p.t === 'supply') R.flipAllSupply(run, p);
    else if (p.t === 'blessing') R.pickBlessing(run, bot.pick(p.options));
    else if (p.t === 'branch') { R.pickBranch(run, p.options[0]); continue; }
    else run.pending.shift();
    if (run.pending[0] === p) run.pending.shift();
  }
}
function play(seed: number) {
  const bot = new Rng(seed * 7 + 1);
  const STARTERS = UNITS.filter((u) => !u.noStarter).map((u) => u.id);
  const run = R.newRun(seed, bot.sample(STARTERS, CFG.startUnits));
  let battles = 0, loops = 0;
  while (!run.over && battles < 200 && loops++ < 3000) {
    resolvePending(run, bot); if (run.over) break;
    manageItems(run);
    for (let c = R.fleetCost(run); c !== null && run.units.length > R.deployCap(run) && run.credits >= c + 15; c = R.fleetCost(run)) R.buyFleet(run);
    while (run.credits >= 30 + R.xpCost(run)) { const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0]; if (!u || !R.buyXp(run, u.uid)) break; }
    R.autoPlace(run);
    resolvePending(run, bot); if (run.over) break;
    if ((run.node as any)?.synth) { shopSynth(run); continue; }
    if (!run.node) {
      const opts = R.currentOptions(run);
      R.enterNode(run, opts[0]);
      if (run.pending[0]?.t === 'branch') resolvePending(run, bot);
      const t = (run.node as any)?.type;
      if (t === 'shop') for (let i = 0; i < 6; i++) if (run.credits >= 35) R.buyShop(run, i);
      if (t === 'news') for (let i = 0; i < 6; i++) R.buyNews(run, i);
      if (t === 'invest') for (let i = 0; i < 5; i++) if (run.credits >= 30) R.buyInvest(run, i);
      if (t === 'shop' || t === 'news' || t === 'invest') R.leaveShop(run);
      continue;
    }
    const b = buildBattle(run, (run.node as any).enc!, false);
    b.runToEnd(); battles++;
    R.resolveBattle(run, b);
  }
  return run;
}
for (let s = 1; s < 30 && !(out.lose && out.win); s++) {
  const run = play(s);
  if (run.over && !run.cleared && run.phase >= 2 && !out.lose) out.lose = run;
  if (run.over && run.cleared && !out.win) out.win = run;
}
if (!out.win && out.lose) { const w = clone(out.lose); w.cleared = true; out.win = w; } // 승리 판: 같은 기록에 의뢰 성공 표시만 (보고서 모양 확인용)
console.error('ui_states:', Object.keys(out).join(' '));
console.log(JSON.stringify(out));
