// 분기 항로 검사 (run.ts phaseRoute · reachIdx · enterNode): 모든 길이 규칙을 지키고 (상점 1~2 · 상점 사이 다른 노드 2개 이상 · 사건 1개 이상 · 역경 1~3 · 보스 앞 전투 2~5),
// 한 노드에서 갈 수 있는 다음 노드는 종류가 겹치지 않으며 (노드는 종류로 고른다), 옛 저장 (links 없음)은 한 줄 항로처럼 움직인다
import * as R from '../src/engine/run';
import { RECRUITABLE } from '../src/data/units';
import type { NodeType } from '../src/types';
declare const process: { exit(code: number): never };

let fail = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fail++; };
const ids = RECRUITABLE.slice(0, 4).map((u) => u.id);
let routes = 0, paths = 0, bad = 0, dup = 0, flat = 0;
const shops: number[] = [];
const F = ['battle', 'adversity'];
for (let s = 1; s <= 120; s++) for (const p of [1, 2, 3, 4, 5]) {
  const run = R.newRun(s * 13, ids, 'waste', 7);
  run.phase = p;
  const { map, links } = R.phaseRoute(run, p);
  routes++;
  if (map.every((r) => r.length === 1)) flat++;
  const walk = (i: number, j: number, acc: NodeType[]): void => {
    if (i === map.length - 1) {
      paths++;
      const n = (t: NodeType) => acc.filter((x) => x === t).length, f = acc.filter((x) => F.includes(x)).length;
      const sp = acc.flatMap((x, k) => (x === 'shop' ? [k] : [])), close = sp.some((k, q) => q > 0 && k - sp[q - 1] <= 2); // 상점 사이 다른 노드 2개 미만
      if (map[i][j] !== 'boss' || !n('shop') || n('shop') > 2 || close || !n('event') || n('adversity') < 1 || n('adversity') > 3 || f < 2 || f > 5) bad++;
      shops.push(n('shop'));
      return;
    }
    const nx = links[i]?.[j] || [];
    if (!nx.length) { bad++; return; }
    if (new Set(nx.map((k) => map[i + 1][k])).size < nx.length) dup++;
    for (const k of nx) walk(i + 1, k, [...acc, map[i + 1][k]]);
  };
  walk(0, 0, [map[0][0]]);
}
ok(bad === 0, `항로 ${routes}개 · 길 ${paths}개: 모든 길이 규칙을 지킨다 (어긋남 ${bad})`);
ok(dup === 0, `다음 노드 종류가 겹치지 않는다 (겹침 ${dup})`);
console.log(`     길마다 상점: 1번 ${shops.filter((x) => x === 1).length} · 2번 ${shops.filter((x) => x === 2).length}`);
ok(flat === 0, `모든 항로가 실제로 갈라진다 (한 줄로 떨어진 항로 ${flat})`);
// 진행: enterNode 가 지나간 노드를 기록하고, 다음 칸 선택지는 그 노드에서 이어진 것만
{
  const run = R.newRun(77, ids, 'waste', 7);
  run.pending = [];
  let okPath = true;
  for (let i = 0; i < 20; i++) {
    const opts = R.currentOptions(run), pick = opts[opts.length - 1], st = run.step;
    if (pick === 'boss') break;
    R.enterNode(run, pick); // 보급 · 회의 · 사건 등은 들어가면서 바로 다음 칸으로 넘어간다
    const at = run.path![st];
    if (run.map[st][at] !== pick) okPath = false;
    run.node = null; run.pending = [];
    if (run.step === st) R.advance(run);
    const nx = R.reachIdx(run);
    if (nx.join() !== run.links![run.step - 1][at].join()) okPath = false;
  }
  ok(okPath, '지나간 노드 기록 · 다음 칸 선택지 = 그 노드에서 이어진 노드');
}
// 옛 저장: links 없으면 칸 전체가 선택지
{
  const run = R.newRun(5, ids, 'waste', 7);
  R.clearRoute(run);
  run.map = R.phaseMap(2); run.step = 3;
  ok(R.currentOptions(run).join() === run.map[3].join(), '옛 저장 (links 없음): 칸 전체가 선택지');
}
if (fail) { console.log(`\n${fail}개 실패`); process.exit(1); }
console.log('\n항로 검사 통과');
