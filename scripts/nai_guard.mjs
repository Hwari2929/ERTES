// NovelAI 생성 안전장치. 모든 nai*.mjs 가 import 한다. (2026-11-02 구독 토큰으로 바꾼 뒤의 규칙)
//  - 사용자가 요청한 만큼만. 새로 그리기(스탠딩 · 배경 · 아이콘 · 소품)는 구독 무료 범위로: GEN_STEPS 23스텝 · FREE_AREA(1024×1024) 이하 · 1장씩 (freeOnly 가 확인).
//  - 편집(img2img · 인페인팅 · 캔버스 확장 · 표정 차분)과 업스케일만 유료(Anlas): EDIT_STEPS 29스텝 (nai_guard.py 의 STEPS 도 29).
//  - 서버에 부담을 주지 않게: 1회 실행 최대 8장 · 동시 실행 금지 (art/.nai.lock) · 장 사이 무작위 6~16초 휴식 (ms 단위까지 무작위 — 일정한 간격의 요청이 가지 않게).
//    429 재시도 대기도 무작위 (backoff). 여러 번은 순차로, 회차 사이에도 무작위로 쉰다 (scripts/nai_batch.sh).
//  - 시작 전 Anlas 잔액 표시 (클라우드에서는 조회 주소가 막혀 실패가 정상).
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
export const MAX_PER_RUN = 8;
export const GEN_STEPS = 23, EDIT_STEPS = 29, FREE_AREA = 1024 * 1024;
/** 새로 그리기가 무료 범위(크기 · 스텝)를 벗어나면 막는다 */
export function freeOnly(w, h, steps, what = '') {
  if (w * h > FREE_AREA || steps > 28) { console.error(`${what} ${w}×${h} · ${steps}스텝: 구독 무료 범위(1024×1024 이하 · 28스텝 이하)를 벗어납니다. 새로 그리기는 무료 범위에서만 돌립니다.`); process.exit(1); }
}
/** 장 사이 휴식: 6~16초 무작위 (ms 단위) */
export const pause = () => 6000 + Math.floor(Math.random() * 10001);
/** 429 (요청 제한) 재시도 대기: 30초 × 시도 수 + 0~20초 무작위 */
export const backoff = (attempt) => 30000 * (attempt + 1) + Math.floor(Math.random() * 20001);
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
