"""NovelAI 생성 안전장치 (파이썬판, scripts/nai_guard.mjs 와 같은 규칙 · 같은 잠금 파일). 모든 nai*.py 가 쓴다.
  - nai*.py 는 모두 편집(img2img · 인페인팅 · 표정 차분) — 새로 그리기와 같이 구독 무료 범위: 23스텝 (STEPS) · 1024×1024 이하 (free_only) · 1장씩. 유료(Anlas) 생성은 쓰지 않는다 (2026-11-04 사용자 결정).
  - 사용자가 요청한 만큼만 · 1회 실행 최대 8장 · 동시 실행 금지 (art/.nai.lock — node 스크립트와 함께 쓴다) · 장 사이 무작위 6~16초 휴식 (pause) · 429 재시도도 무작위 대기 (backoff) — 일정한 간격의 요청이 가지 않게.
"""
import atexit, os, random, sys, time

MAX_PER_RUN = 8
STEPS = 23
FREE_AREA = 1024 * 1024
LOCK = 'art/.nai.lock'


def guard(total):
  if total > MAX_PER_RUN:
    sys.exit(f'한 번에 {MAX_PER_RUN}장까지만 생성합니다 (요청 {total}장).')
  if os.path.exists(LOCK):
    try:
      pid = int(open(LOCK).read().strip() or 0)
      os.kill(pid, 0)
      sys.exit(f'다른 생성이 진행 중입니다 (pid {pid}).')
    except (ValueError, ProcessLookupError, PermissionError):
      pass  # 죽은 잠금
  open(LOCK, 'w').write(str(os.getpid()))
  atexit.register(lambda: os.path.exists(LOCK) and open(LOCK).read().strip() == str(os.getpid()) and os.remove(LOCK))


def free_only(w, h, what=''):
  """무료 범위(1024×1024 이하 · 28스텝 이하)를 벗어나면 막는다"""
  if w * h > FREE_AREA or STEPS > 28:
    sys.exit(f'{what} {w}×{h} · {STEPS}스텝: 구독 무료 범위(1024×1024 이하 · 28스텝 이하)를 벗어납니다. 무료 범위에서만 돌립니다 (입력을 줄이세요).')


def pause():
  time.sleep(6 + random.random() * 10)


def backoff(attempt):
  time.sleep(8 * (attempt + 1) + random.random() * 12)
