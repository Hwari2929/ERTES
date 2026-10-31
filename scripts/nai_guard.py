"""NovelAI 생성 안전장치 (파이썬판, scripts/nai_guard.mjs 와 같은 규칙 · 같은 잠금 파일). 모든 nai*.py 가 쓴다.
  - 사용자가 요청한 만큼만, 유료(Anlas) 생성만: 29스텝 (STEPS, 무료 범위 28스텝 이하를 벗어난다). 1회 실행 최대 8장.
  - 동시 실행 금지 (art/.nai.lock — node 스크립트와 함께 쓴다), 장 사이 무작위 6~15초 휴식 (pause).
"""
import atexit, os, random, sys, time

MAX_PER_RUN = 8
STEPS = 29
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


def pause():
  time.sleep(6 + random.random() * 9)
