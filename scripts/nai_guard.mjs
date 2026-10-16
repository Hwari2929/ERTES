// NovelAI 생성 안전장치 (2026-10 무료 생성 영구 제한 이후). 모든 nai*.mjs 가 import 한다.
//  - 사용자가 요청한 만큼만, 유료(Anlas) 생성만. 1회 실행 최대 8장.
//  - 동시 실행 금지 (art/.nai.lock), 장 사이 무작위 6~15초 휴식.
//  - 시작 전 Anlas 잔액 표시.
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
export const MAX_PER_RUN = 8;
export const pause = () => 6000 + Math.floor(Math.random() * 9000);
const LOCK = 'art/.nai.lock';
export async function guard(total, token) {
  if (total > MAX_PER_RUN) { console.error(`한 번에 ${MAX_PER_RUN}장까지만 생성합니다 (요청 ${total}장).`); process.exit(1); }
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, 'utf8'));
    try { process.kill(pid, 0); console.error(`다른 생성이 진행 중입니다 (pid ${pid}).`); process.exit(1); } catch { /* 죽은 잠금 */ }
  }
  writeFileSync(LOCK, String(process.pid));
  const free = () => { try { unlinkSync(LOCK); } catch {} };
  process.on('exit', free); process.on('SIGINT', () => process.exit(130));
  await anlas(token, '시작 전');
}
export async function anlas(token, when) {
  try {
    const r = await fetch('https://api.novelai.net/user/subscription', { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    const t = j.trainingStepsLeft || {};
    console.log(`Anlas (${when}): ${(t.fixedTrainingStepsLeft ?? 0) + (t.purchasedTrainingSteps ?? 0)} (구독 ${t.fixedTrainingStepsLeft ?? '?'} · 구매 ${t.purchasedTrainingSteps ?? '?'})`);
  } catch (e) { console.log(`Anlas 잔액 확인 실패: ${e.message}`); }
}
