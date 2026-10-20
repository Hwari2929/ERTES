// 캠페인 「회수 계약」 검증판 시뮬: 1 · 2 · 3장을 끝까지 자동으로 돌려 흐름 오류 · 승률 · 장별 보스 시도 · 남은 AH 를 본다.
// 사용: npx esbuild tests/campaign_sim.ts --bundle --platform=node --outfile=dist/campaign_sim.cjs && node dist/campaign_sim.cjs [판수] [위험] [정책]
//   정책: safe (신고 · 바로 돌파 · 지나감 · 안테나 그대로) / survey (조사 · 영사 · 배전실 + 신고) / greedy (직접 열기 · 조사 · 영사 · 배전실) / peek (필리스 확인 · 조사 · 영사 · 배전실)
import { CFG } from '../src/config';
import { UNIT_BY_ID } from '../src/data/units';
import { buildBattle, deployed, synergyCounts, activeTiers } from '../src/engine/build';
import { newCampaignRun } from '../src/engine/campaignrun';
import * as R from '../src/engine/run';
import { Rng } from '../src/rng';
import type { Major } from '../src/types';
import { augChoice, manageItems } from './botlib';
import { EVENT_BY_ID } from '../src/data/events';

declare const process: { argv: string[]; stdout: { write(s: string): void } };
const N = +process.argv[2] || 50, DIFF = +process.argv[3] || 3, POL = process.argv[4] || 'safe';
const out = { runs: 0, clear: 0, dead: 0, stuck: 0, battles: 0, wins: 0, bossTries: 0, timeLeft: [] as number[], credits: [] as number[], errors: [] as string[], tiers: {} as Record<string, number>, boss: {} as Record<number, number>, reach: {} as Record<number, number>, left: {} as Record<number, number[]> };

for (let s = 0; s < N; s++) {
  const bot = new Rng(1000 + s);
  let run: ReturnType<typeof newCampaignRun>;
  try { run = newCampaignRun(DIFF); } catch (e) { out.errors.push(String(e)); continue; }
  out.runs++;
  const order = POL === 'survey' ? ['조사한다', '영사한다', '배전실로 간다', '같이 가자', '같이 들어가자', 'AH로 받는다', '격리팀에 신고한다', '직접 연다', '연다'] : POL === 'greedy' ? ['조사한다', '영사한다', '배전실로 간다', '상자는 두고 와', '따뜻한 길로 안내해', '크레딧으로 받는다', '봉인 테이프로 연다', '직접 연다', '그래도 연다', '연다'] : POL === 'peek' ? ['조사한다', '영사한다', '배전실로 간다', '상자는 두고 와', '따뜻한 길로 안내해', 'AH로 받는다', '필리스가 먼저 들여다본다', '봉인 테이프로 연다', '격리팀에 넘긴다', '연다'] : ['바로 돌파한다', '그냥 지나간다', '안테나는 그대로 둔다', '같이 가자', '같이 들어가자', 'AH로 받는다', '격리팀에 신고한다', '직접 연다', '연다'];
  const resolve = () => {
    for (let g = 0; run.pending.length && g < 50; g++) {
      const p = run.pending[0];
      if (p.t === 'event') {
        // 선택지 이름으로 고른다 (정책 순서), 막히면 다음
        const ev = EVENT_BY_ID[p.id];
        const idxs = order.map((l) => ev.choices.findIndex((c) => c.label === l)).filter((i) => i >= 0).concat(ev.choices.map((_, i) => i));
        let ok = false;
        for (const i of idxs) { if (R.chooseEvent(run, i) === null) { ok = true; break; } }
        if (!ok) run.pending.shift();
        continue;
      }
      if (p.t === 'rankup') {
        const u = run.units.find((x) => x.uid === p.uid)!;
        const pref: Major[] = UNIT_BY_ID[u.defId].range <= 1 ? ['vit', 'pow'] : ['pow', 'mnd'];
        if (!p.allocDone) R.allocRank(run, p, pref);
        R.ensureRankupOptions(run, p);
        const a = augChoice(p, (o) => bot.pick(o)); if (a) R.chooseAug(run, p.uid, a);
        if (run.pending[0] === p) run.pending.shift();
        continue;
      }
      if (p.t === 'supply') R.flipAllSupply(run, p);
      else if (p.t === 'itemPick') R.gainItem(run, bot.pick(p.options));
      else if (p.t === 'branch') { R.pickBranch(run, 'shop'); continue; }
      run.pending.shift();
    }
  };
  try {
    resolve();
    for (let guard = 0; guard < 200 && !run.over; guard++) {
      resolve();
      manageItems(run);
      while (run.credits >= 20 + R.xpCost(run)) { const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0]; if (!u || !R.buyXp(run, u.uid)) break; }
      // 조사 계열 정책: 나디르가 합류하면 출전시킨다 (영사 선택지를 쓰려면 출전 중이어야 한다)
      const nd = run.units.find((u) => u.defId === 'nadir');
      if (POL !== 'safe' && nd && !nd.pos) { const low = run.units.filter((u) => u.pos && u.defId !== 'rachel').sort((x, y) => x.rank - y.rank)[0]; if (low) low.pos = null; R.autoPlace(run, [nd, ...run.units.filter((u) => u !== nd)]); }
      R.autoPlace(run, run.units);
      if (!run.node) { R.enterNode(run, R.currentOptions(run)[0]); resolve(); }
      if (!run.node) continue;
      if (run.node.type === 'shop') { R.leaveShop(run); continue; }
      if (!run.node.enc) { R.leaveShop(run); continue; }
      const t = run.node.type;
      const tiers = activeTiers(synergyCounts(deployed(run), run), run);
      for (const [k, v] of Object.entries(tiers)) out.tiers[`${k}${v}`] = (out.tiers[`${k}${v}`] || 0) + 1;
      const b = buildBattle(run, run.node.enc, false);
      if ((globalThis as { DBG?: number }).DBG && t === 'boss') { const bo = b.units.find((x) => x.side === 1); console.error('BOSS', run.campaign!.ch, run.phase, bo?.defId, Math.round(bo?.hp || 0), deployed(run).map((u) => u.defId + u.rank).join(',')); }
      if ((globalThis as { DBG?: number }).DBG && t === 'boss') (b as unknown as { keepEvents: boolean }).keepEvents = true;
      b.runToEnd();
      if ((globalThis as { DBG?: number }).DBG && t === 'boss' && run.campaign!.ch === +((globalThis as { DBGCH?: number }).DBGCH || 2)) { const by: Record<string, number> = {}; const nm = (id?: number) => { const u = b.units.find((x) => x.id === id); return u ? `${u.side}:${u.defId}` : '?'; }; for (const e of (b as unknown as { events: { k: string; id: number; src?: number; v: number; tag?: string; syn?: string; elem?: string }[] }).events) if (e.k === 'dmg') { const k = `${nm(e.src)}>${nm(e.id).split(':')[0]} ${e.syn || e.tag || ''} ${e.elem}`; by[k] = (by[k] || 0) + Math.round(e.v); } console.error(Object.entries(by).sort((x, y) => y[1] - x[1]).slice(0, 14)); }
      if ((globalThis as { DBG?: number }).DBG && t === 'boss') { const bo = b.units.find((x) => x.side === 1 && x.defId.startsWith('cp_')); console.error('END', run.campaign!.ch, Math.round(b.t), b.winner, bo?.alive, Math.round(bo?.hp || 0), b.units.filter((x) => x.side === 0 && x.alive).length, 'antenna', b.units.filter((x) => x.defId === 'cp_antenna').length); }
      out.battles++; if (b.winner === 0) out.wins++;
      const ch0 = run.campaign!.ch, t0 = run.campaign!.time;
      out.reach[ch0] = out.reach[ch0] || 0;
      if (t === 'boss') { out.bossTries++; out.boss[ch0] = (out.boss[ch0] || 0) + 1; }
      R.resolveBattle(run, b);
      if (t === 'boss' && b.winner === 0) { out.reach[ch0]++; (out.left[ch0] ||= []).push(t0); }
      resolve();
    }
    if (run.cleared) { out.clear++; out.timeLeft.push(run.campaign!.time); out.credits.push(run.credits); }
    else if (run.over) out.dead++; else out.stuck++;
  } catch (e) { out.errors.push(String((e as Error).stack || e).slice(0, 300)); }
}
const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
process.stdout.write(JSON.stringify({ pol: POL, diff: DIFF, runs: out.runs, clear: out.clear, dead: out.dead, stuck: out.stuck, winRate: Math.round((out.wins / Math.max(1, out.battles)) * 1000) / 10, bossTriesPerClear: Math.round((out.bossTries / Math.max(1, out.clear)) * 10) / 10, timeLeft: avg(out.timeLeft), credits: avg(out.credits), bossTriesByCh: Object.fromEntries(Object.entries(out.boss).map(([k, v]) => [k, Math.round((v / Math.max(1, out.reach[+k] || 0)) * 10) / 10])), clearedByCh: out.reach, timeLeftByCh: Object.fromEntries(Object.entries(out.left).map(([k, v]) => [k, avg(v)])), tiers: out.tiers, errors: out.errors.slice(0, 3) }, null, 1) + '\n');
