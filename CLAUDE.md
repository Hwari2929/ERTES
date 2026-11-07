# ERRANTEs 작업 규칙

- **사용자에게 하는 모든 답변 · 보고 · 질문은 반드시 한국어로 쓴다.** 작업 보고, 요약, 선택지 질문(AskUserQuestion), 에이전트 결과 전달, 대화가 길어져 요약된 뒤의 첫 답변도 예외 없다. 코드 · 파일 경로 · 명령어 · 고유 식별자만 원문 그대로 둔다. 서브에이전트에게 맡길 때도 "보고는 한국어로"를 지시에 넣는다.
- 사용자에게 알리는 시각은 한국 표준시(KST)로 쓴다 (UTC 를 쓰지 않는다. 변환: `TZ=Asia/Seoul date`).
- 변경 후 항상 `npm run -s build` · `npx tsc --noEmit -p .` 통과를 확인한다. 적 · 기물 · 데이터를 바꾸면 `npm run -s check` (오래 걸림, 제한 시간 900초 이상) · `npm run -s bot-regress` 도 통과시킨다.
- 문서 지도는 `docs/README.md` (현행 문서 / 기록 문서 구분). 규칙 · 수치의 기준은 코드(`src/config.ts` · `src/data/*` · `src/engine/*`)이고, 현행 문서는 바뀐 규칙에 맞춰 함께 고친다. 기록 문서(밸런스 보고서 · 초안)는 고치지 않는다.

## 커밋 · 게시
- 작업 브랜치에 커밋 · push 한다. 코드 커밋과 빌드 커밋을 나눈다: 코드 먼저, 그다음 `dist/artifact.html` · `dist/index.html` 을 "아티팩트 vNNN 빌드" 로 (NNN 은 직전 빌드 커밋 번호 + 1, `git log --oneline | grep "아티팩트 v"`).
- 게시: Artifact 도구로 `dist/artifact.html` 을 기존 게임 아티팩트 URL 에 올린다 (label 에 버전). 오프라인 파일(`npm run -s offline` → `dist/ERRANTEs-offline.html`, 약 70MB)은 **사용자가 요청할 때만** 만들어 보낸다.
- 시뮬레이터 · 검사 도구 · 밸런스 측정 관례는 `docs/TOOLS.md`.

## 도감 연동
- 도감(codexScreen `src/app/codex.ts` · `src/ui/codex2.ts`)은 데이터 표(기물 · 장비 · 시너지 · 증강 · 전공 · 성유물 · 전역 증강 등)를 **그릴 때마다 직접 읽어서** 보여 준다. 도감에 이름 · 수치 · 설명을 따로 베껴 적지 않는다.
- 기물 · 장비 · 시너지 · 증강 · 전공 · 성유물을 추가 · 수정 · 삭제하면 `npm run check` (도감 누락 · undefined · NaN 검사)를 돌려 통과시킨다. 능력 문구(src/data/abiltext.ts · src/data/abil/*.ts · brief.ts)도 함께 맞춘다.
- 적을 추가 · 수정하면 설명 문구(src/data/enemyText.ts — 수치는 CFG 에서 읽는다)와 `docs/ENEMIES.md` 도 맞춘다. 게임 규칙이 바뀌면 교범(src/data/glossary.ts) · 튜토리얼(src/data/scenes/tutorial.ts) 설명도 확인한다.

## UI
- **UI 를 만들거나 고치기 전에 매번 docs/UI.md 를 먼저 읽는다** (서브에이전트에게 맡길 때도 지시에 넣는다). 지침에 없는 일관성 문제를 사용자가 짚으면 docs/UI.md 에 원칙으로 추가한다.
- 메트로 테마를 고칠 때는 docs/METRO.md 도 읽는다 (UI.md 공통 원칙이 먼저, 메트로 명세 · 결정 기록 · 구조 토큰은 METRO.md).
- docs/UI.md 를 따른다: 비교 · 판단할 수치 · 조건 · 행동을 문장에 묻지 않는다 (이름 + 값으로 나누고 대상 옆에). 화면 머리는 제목 + 상태 칩, 규칙 설명은 교범 · 접힘으로. 서사 · 도감 설명 · 보고서는 문장 그대로.

## 에셋 (자세히는 docs/ART_PIPELINE.md)
- **NovelAI 생성은 사용자가 요청한 분량만 돌린다.** 에이전트가 스스로 판단해 생성을 시작하지 않는다. 2026-11-02 부터 구독 토큰. **유료(Anlas) 생성은 쓰지 않는다** (2026-11-04 사용자 결정): 새로 그리기(스탠딩 · 배경 · 아이콘 · 소품)와 편집(img2img · 인페인팅 · 캔버스 확장 · 표정 차분) 모두 구독 무료 범위(23스텝 · 1024×1024 이하 · 1장씩), 업스케일은 640×640 이하(무료)만 — 스크립트가 범위를 벗어나면 막는다. 서버에 부담을 주지 않게 스크립트(scripts/nai_guard.mjs · nai_guard.py, 모든 nai* 스크립트)가 1회 실행 최대 8장 · 동시 실행 금지 · 장 사이 무작위 6~16초 휴식을 강제하고, 휴식 · 재시도 대기 · 회차 사이를 모두 무작위로 둬 일정한 간격의 요청이 절대 가지 않게 한다. 여러 장은 `scripts/nai_batch.mjs` 로 순차 실행한다 (병렬 금지). (이전 계정은 무료 생성 자동화로 무료 생성이 영구 제한됐다 — ToS 9.1.6)
- 클라우드 환경에서는 `NODE_USE_ENV_PROXY=1` 을 붙여 실행한다 (없으면 `fetch failed`). 잔액 조회 주소(api.novelai.net)는 막혀 있어 "Anlas 잔액 확인 실패"가 나오는 것이 정상이다.
- **프롬프트를 새로 쓰거나 고치면 1~2장만 먼저 뽑아 확인한 뒤** 나머지를 뽑는다. `art/prompts.json` 의 `object: true` 는 'solo' 를 빼고 'concept art' 를 붙여 여러 개를 늘어놓은 설정화가 나오기 쉽다 — 동물 · 한 개체는 object 를 끄고 'solo, animal focus' 를 쓴다.
- 배경 · 스탠딩 일러스트는 넣기 전에 반드시 사용자 확인을 받는다.
  - **한 번에 고를 시안이 10장 이하이면 고르기 페이지(아티팩트)를 만들지 않는다** — 번호를 붙여 한 장으로 합친 그림을 채팅에 올리고 (SendUserFile), 사용자가 번호로 답한다. 여러 묶음(예: 잔 6종 × 8장)이면 묶음마다 한 장씩 올린다.
  - 10장을 넘을 때만 시안 페이지로 보여 주고 고르게 한다: `python3 scripts/pick_page.py` → 아티팩트(db) 게시 → ArtifactData 로 선택 읽기. 고르는 페이지의 변경 알림은 오지 않을 수 있으니 사용자가 "골랐다"고 하면 읽는다.
- 그림 반영: `art/picks.json` → `art/picked/` → `python3 scripts/art.py build [id ...]` (id 를 주면 그 그림만, 전체 빌드는 20분 넘게 걸린다) → `public/art/<id>.webp` · `<id>.bust.webp` · `src/ui/portraits.gen.ts`.
- 아티팩트는 그림을 별도 파일로 보관한다 (artifact.html 에 내장되지 않음). **한 버전 파일 수 한도가 512개**라 적 · 소환물 상반신(`en_*` · `sm_*` .bust.webp)은 빌드가 `dist/art/busts-en.json` 하나로 묶는다 (src/ui/portraits.ts `loadArtPack`). 그림을 새로 넣거나 바꾸면 게시 때 `files` 로 함께 올린다: 아군 · 인물은 `art/<id>.webp` · `art/<id>.bust.webp`, 적 · 소환물은 `art/<id>.webp` · `art/busts-en.json`, 바 낯선 손님(`gs_*`)은 세력별 묶음 `art/guests-<u|e|a|p|c|t|x>.json` 만 (낱개 파일은 올리지 않는다). 안 올리면 게임에서 실루엣 · 옛 그림이 나온다.
- 자동으로 오리기 어려운 투명화(배경 · 그려진 종이 지우기 · 층 나누기)는 사용자가 붓으로 칠하게 한다: `tools/mask-paint.html` 아티팩트 → `scripts/mask_apply.py` (사용법 `tools/mask-paint.md`). 점 찍기 방식은 쓰지 않는다.
- 능력 아이콘: art/icon_prompts.json → scripts/nai_icon.mjs → art/icons/raw → `python3 scripts/icons_build.py` → src/ui/abilicons.gen.ts. 다시 뽑을 때는 프롬프트를 바꾼 시안 3개를 보여 준다. 물리 계열 스킬 · 무기는 흰 배경(light).

## 사건 연출
- docs/SCENES.md 의 3차 지침 · '한국어 대사 작성 원칙'과 docs/VOICES.md 를 따른다. 대사는 소리 내어 읽어 자연스러운 구어체로 — 명사구 · 파편 나열(전보체)로 줄이지 말고, 중복 · 수식을 덜어 간결하게. 사건 속 지휘관({pc}) = 레이첼.
- 에란테스 바는 알렉산드리아 궤도 정거장(중립 구역)에 있는 실제 바 — 용병단 본부 — 이고, 함대 · 함선은 별개다. 알렉산드리아는 항성 없는 부유 행성이라 바의 낮 · 밤은 정거장 인공 일광 주기다.
- **숫자는 반드시 아라비아 숫자로 쓴다.** 대사 · 서술 · 만담 · 바 대본 모두 '백 여든 다섯 개', '세 번째' 같은 한글 수 표기 대신 '185개', '3번째'처럼 쓴다. (관용구 '한두 번', '하나같이' 등 수량이 아닌 표현은 예외)
- 대본에서 새로 생긴 인물 설정은 `lore/인물/확장/<이름>.md` 에 기록하고, 원본 캐릭터 시트 · 세계관 문서와 어긋나지 않는지 확인한다.
