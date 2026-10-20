// 캠페인 「회수 계약」 검증판 시뮬: 1장을 끝까지 자동으로 돌려 흐름 오류 · 승률 · 남은 계약 시간을 본다.
// 사용: npx esbuild tests/campaign_sim.ts --bundle --platform=node --outfile=dist/campaign_sim.cjs && node dist/campaign_sim.cjs [판수] [위험] [정책]
//   정책: safe (신고 · 바로 돌파) / greedy (직접 열기 · 조사) / peek (필리스 확인 · 조사)
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
const out = { runs: 0, clear: 0, dead: 0, stuck: 0, battles: 0, wins: 0, bossTries: 0, timeLeft: [] as number[], credits: [] as number[], errors: [] as string[], tiers: {} as Record<string, number> };

for (let s = 0; s < N; s++) {
  const bot = new Rng(1000 + s);
  let run: ReturnType<typeof newCampaignRun>;
  try { run = newCampaignRun(DIFF); } catch (e) { out.errors.push(String(e)); continue; }
  out.runs++;
  const order = POL === 'survey' ? ['조사한다', '같이 가자', '격리팀에 신고한다', '직접 연다', '연다'] : POL === 'greedy' ? ['조사한다', '상자는 두고 와', '봉인 테이프로 연다', '직접 연다', '그래도 연다', '연다'] : POL === 'peek' ? ['조사한다', '상자는 두고 와', '필리스가 먼저 들여다본다', '봉인 테이프로 연다', '격리팀에 넘긴다', '연다'] : ['바로 돌파한다', '같이 가자', '격리팀에 신고한다', '직접 연다', '연다'];
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
    for (let guard = 0; guard < 80 && !run.over; guard++) {
      resolve();
      manageItems(run);
      while (run.credits >= 20 + R.xpCost(run)) { const u = run.units.filter((x) => x.pos && x.rank < CFG.maxRank).sort((a, b) => a.rank - b.rank)[0]; if (!u || !R.buyXp(run, u.uid)) break; }
      R.autoPlace(run, run.units);
      if (!run.node) { R.enterNode(run, R.currentOptions(run)[0]); resolve(); }
      if (!run.node) continue;
      if (run.node.type === 'shop') { R.leaveShop(run); continue; }
      if (!run.node.enc) { R.leaveShop(run); continue; }
      const t = run.node.type;
      const tiers = activeTiers(synergyCounts(deployed(run), run), run);
      for (const [k, v] of Object.entries(tiers)) out.tiers[`${k}${v}`] = (out.tiers[`${k}${v}`] || 0) + 1;
      const b = buildBattle(run, run.node.enc, false);
      b.runToEnd();
      out.battles++; if (b.winner === 0) out.wins++;
      if (t === 'boss') out.bossTries++;
      R.resolveBattle(run, b);
      resolve();
    }
    if (run.cleared) { out.clear++; out.timeLeft.push(run.campaign!.time); out.credits.push(run.credits); }
    else if (run.over) out.dead++; else out.stuck++;
  } catch (e) { out.errors.push(String((e as Error).stack || e).slice(0, 300)); }
}
const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
process.stdout.write(JSON.stringify({ pol: POL, diff: DIFF, runs: out.runs, clear: out.clear, dead: out.dead, stuck: out.stuck, winRate: Math.round((out.wins / Math.max(1, out.battles)) * 1000) / 10, bossTriesPerClear: Math.round((out.bossTries / Math.max(1, out.clear)) * 10) / 10, timeLeft: avg(out.timeLeft), credits: avg(out.credits), tiers: out.tiers, errors: out.errors.slice(0, 3) }, null, 1) + '\n');
