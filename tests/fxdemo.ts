// 전투 연출 확인용 데모 (빌드 산출물 아님): 지정 기물로 첫 전투를 바로 띄운다
import { boardDims, buildBattle } from '../src/engine/build';
import * as R from '../src/engine/run';
import { BattleView } from '../src/ui/battleview';
const q = new URLSearchParams(location.search);
const ids = (q.get('u') || 'joshua,vivian,falcon,yupito,phyllis').split(',');
const run = R.newRun(+(q.get('seed') || 3), ids.slice(0, 3));
for (const id of ids.slice(3)) R.recruit(run, id);
run.pending = [];
R.enterNode(run, R.currentOptions(run)[0]);
run.pending = [];
R.autoPlace(run);
for (const u of run.units) if (!u.pos) { R.autoPlace(run); }
const enc = run.node!.enc!;
const d = boardDims(enc.n);
document.body.innerHTML = `<main class="wrap battle"><section class="board-col"><div class="board bview" style="--w:${d.w - 2};--h:${d.h - 2};--fw:${d.w};--fh:${d.h}"><div class="board-in" id="bboard"><div class="cells"></div></div></div></section></main>`;
const b = buildBattle(run, enc);
const v = new BattleView(document.getElementById('bboard')!, b, () => {}, () => {});
v.speed = +(q.get('speed') || 0.5);
(window as unknown as { v: BattleView }).v = v;
v.start();
