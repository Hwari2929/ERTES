// NovelAI 여러 회차 순차 실행: id 목록을 8장 이하 회차로 나눠 하나씩 돌리고, 회차 사이에 무작위로 쉰다 (60~150초, ms 단위 무작위).
// 회차 안의 장 사이 휴식(6~16초 무작위)은 각 스크립트가 nai_guard.mjs 로 한다. 동시 실행은 잠금 파일이 막는다.
//   NODE_USE_ENV_PROXY=1 NOVELAI_TOKEN=… node scripts/nai_batch.mjs nai.mjs gs_a gs_b … [--per 8] [-- --force]
//   (첫 인자 = scripts/ 안의 생성 스크립트, '--' 뒤는 그 스크립트에 그대로 넘긴다)
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const dd = argv.indexOf('--');
const own = dd >= 0 ? argv.slice(0, dd) : argv;
const pass = dd >= 0 ? argv.slice(dd + 1) : [];
const script = own[0];
const per = Math.min(8, Number(own[own.indexOf('--per') + 1]) || 8);
const ids = own.slice(1).filter((a, i, all) => a !== '--per' && all[i] !== '--per');
if (!script || !ids.length) { console.error('사용: node scripts/nai_batch.mjs <스크립트> <id ...> [--per 8] [-- 넘길 인자]'); process.exit(1); }
const rest = () => 60000 + Math.floor(Math.random() * 90001);
const chunks = [];
for (let i = 0; i < ids.length; i += per) chunks.push(ids.slice(i, i + per));
for (let i = 0; i < chunks.length; i++) {
  console.log(`\n── 회차 ${i + 1}/${chunks.length}: ${chunks[i].join(' ')}`);
  const r = spawnSync('node', [`scripts/${script}`, ...chunks[i], ...pass], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`회차 ${i + 1} 실패 (종료 코드 ${r.status}) — 멈춥니다.`); process.exit(r.status || 1); }
  if (i < chunks.length - 1) { const ms = rest(); console.log(`회차 사이 ${Math.round(ms / 1000)}초 쉼`); await new Promise((res) => setTimeout(res, ms)); }
}
