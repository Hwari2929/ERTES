# ERRANTEs

은하 용병단 **에란테스(ERRANTEs)** 를 지휘하는 싱글 PvE 오토배틀러 로그라이트. 브라우저에서 HTML 파일 하나로 돌아가고, 서버가 필요 없습니다.
기획 정리는 [`docs/GDD.md`](docs/GDD.md)에 있습니다.

## 플레이
- `dist/index.html`을 브라우저로 엽니다. 스탠딩 · 배경 일러스트는 같은 폴더의 `dist/art/`에서 읽고, 파일이 없으면 도트 스프라이트로 대신 그립니다.
- `npm run offline`을 돌리면 일러스트까지 데이터 URI로 넣은 `dist/ERRANTEs-offline.html` 파일 하나가 만들어집니다 (용량이 큽니다. 깃에는 넣지 않습니다).
- 진행 상황은 브라우저 localStorage에 저장됩니다. 자동 저장, 슬롯 3개, 저장 코드 내보내기 · 불러오기를 지원합니다. 도감 · 기록도 이 브라우저에만 남습니다.

## 명령
```bash
npm install
npm run build            # dist/index.html (오프라인 실행용) + dist/artifact.html (아티팩트 게시용) + public/art → dist/art 복사
npx tsc --noEmit -p .    # 타입 검사 (npm run typecheck 와 같음)
npm run check            # 도감 검사: 데이터 표의 모든 항목이 도감에 나오는지, undefined · NaN 이 없는지
npm run sim -- 40        # 헤드리스 봇 시뮬레이션 40판 (뒤에 fields / units 를 붙이면 전장별 · 기물별 집계)
npm run offline          # 일러스트 내장 단독 파일
npm run syn-doc          # docs/SYNERGY_TABLE.md 다시 생성
npm run events-doc       # docs/EVENTS.md 다시 생성
```
- 무엇을 바꾸든 `npm run -s build`와 `npx tsc --noEmit -p .`가 통과해야 합니다.
- 기물 · 장비 · 시너지 · 증강 · 전공 · 성유물을 추가 · 수정 · 삭제했으면 `npm run check`도 통과해야 하고, 능력 문구(`src/data/abiltext.ts`, `src/data/abil/*.ts`, `src/data/brief.ts`)도 같이 고칩니다. 작업 규칙 전체는 [`CLAUDE.md`](CLAUDE.md)에 있습니다.
- 그 밖의 검사 · 계측 스크립트는 `tests/`에 있고, 실행법은 파일 첫 줄 주석에 적혀 있습니다 (사건 연출 검사 `scenes_check.ts`, 증강 문구 대조 `augtext_check.ts`, 밸런스 계측 `balance.ts` · `buildsim.ts` · `probe2.ts` 등).

## 폴더 구조
| 경로 | 내용 |
|---|---|
| `src/main.ts` | 화면 · 입력 · 진행 흐름 (타이틀, 전장 추첨, 난이도, 시작 기물, 지도, 편성, 전투, 상점, 도감, 튜토리얼 진행) |
| `src/config.ts` | 전투 · 성장 · 경제 · 적 강도 수치 (`CFG`) |
| `src/types.ts` | 공용 타입: 주요 능력치, 속성, 분류, 전투 · 전술 유형, 신앙, 노드 종류, 런 상태 |
| `src/engine/` | `combat.ts` 전투 시뮬레이션 · `build.ts` 기물 → 전투 유닛 변환, 스탯 · 시너지 집계 · `run.ts` 런 진행 (노드, 보상, 성장, 상점, 사건) · `effects.ts` 효과 모델 · `tutorial.ts` 튜토리얼 런 |
| `src/data/` | 게임 데이터. 기물(`roster*.ts` + `rework.ts`, `units.ts`에서 합침), 시너지, 장비, 증강, 사이오닉(`schools.ts` · `psionic.ts`), 성유물, 궁극기, 전장, 적, 사건(`events.ts` · `story*.ts`), 사건 연출(`scenes/`), 난이도, 전역 증강 · 특권, 교범, 세계관 요약, 음성 대사 |
| `src/ui/` | 전투 연출(`battleview.ts`), 도감(`codex2.ts`), 미연시 화면(`adv.ts`), 안내 말풍선(`coach.ts`), 저장 · 기록, 스타일. `*.gen.ts`는 스크립트가 만드는 파일이라 손으로 고치지 않습니다 |
| `tests/` | 검사 · 시뮬레이션 · 문서 생성 스크립트 |
| `scripts/` | 빌드(`build.mjs`)와 에셋 파이프라인 |
| `art/` | 에셋 원본과 설정: 프롬프트(`prompts.json` · `bg_prompts.json` · `icon_prompts.json`), 고른 원본(`picked/`), 얼굴 위치 · 크롭(`faces.json` · `crops.json`). `art/raw/`는 깃에 넣지 않습니다 |
| `public/art/` | 게임에서 쓰는 WebP 일러스트 (스탠딩, 상반신 배너, 적, 배경 `bg_*`) |
| `dist/` | 빌드 결과. 깃에는 `index.html` · `artifact.html`만 들어갑니다 |
| `docs/` | 설계 · 밸런스 · 글쓰기 문서 (아래 목록) |
| `lore/` | 기획자 로어북 (옵시디언 볼트 사본). [`lore/README.md`](lore/README.md) 참고 |
| `tools/` | 보조 도구 (초상화 크롭 도구 등) |

## 에셋 파이프라인
NovelAI 생성 스크립트는 환경 변수 `NOVELAI_TOKEN`이 필요하고, 생성 설정은 `art/nai.config.json`에 있습니다. 배경 · 스탠딩 일러스트는 넣기 전에 반드시 시안을 보여 주고 사용자가 고르게 합니다.

1. **스탠딩 · 초상화**: `art/prompts.json` → `node scripts/nai.mjs <id>` → `art/raw/<id>/` → 고른 파일을 `art/picks.json`에 적고 `python3 scripts/art.py pick` → `art/picked/` → `python3 scripts/art.py build` → `public/art/<id>.webp`, `<id>.bust.webp`, `src/ui/portraits.gen.ts`(아이콘 내장). 얼굴 위치는 `art/faces.json`을 기본으로 쓰고, `art.py croptool`로 고친 값(`art/crops.json`)이 있으면 그 값을 먼저 씁니다. 표정 차분은 `scripts/nai_face.py` · `nai_expr.py` · `face_fix.py`로 만듭니다.
2. **배경**: `art/bg_prompts.json` → `node scripts/nai_bg.mjs <key>` → `art/raw/bg/<key>/` → 고른 것을 `public/art/bg_<key>.webp`로 넣습니다. 그 밖의 이미지 변환에는 `nai_i2i.py`, 업스케일에는 `nai_upscale.mjs`(Anlas 소모)를 씁니다.
3. **능력 아이콘**: `art/icon_prompts.json` → `node scripts/nai_icon.mjs <id>` → `art/icons/raw/` → `python3 scripts/icons_build.py` → `src/ui/abilicons.gen.ts`(WebP 데이터 URI 내장). 다시 뽑을 때는 프롬프트를 바꾼 시안 3개를 보여 줍니다. 물리 계열 스킬 · 무기 아이콘은 흰 배경(light)입니다.

## 아티팩트 배포
- `npm run build`가 만드는 `dist/artifact.html`은 문서 뼈대(`<html>` · `<head>`)가 없는 페이지 본문입니다. 이것을 아티팩트 페이지로 게시합니다. 코드 · CSS · 능력 아이콘 · 초상화 아이콘은 이 파일 안에 들어 있습니다.
- 일러스트는 페이지에 넣지 않고 **별도 파일로 따로 올립니다.** 페이지는 상대 경로 `art/<파일>`로 읽으므로, 게시 경로 `art/<파일>`에 원본 `dist/art/<파일>`(= `public/art/`)을 대응시켜 `files`로 함께 올립니다. 파일 수가 한 번에 올릴 수 있는 개수(255개)를 넘기 때문에, 같은 아티팩트 URL에 여러 번 나눠 게시합니다. 이미 올라간 파일은 그대로 남습니다.
- 게시 용량에 한도가 있어 아이콘 압축 품질을 낮춰 두었습니다 (`scripts/icons_build.py`). 페이지가 커지면 이 점부터 확인합니다.

## 문서
| 분류 | 문서 |
|---|---|
| 기획 정리 | [`docs/GDD.md`](docs/GDD.md): 현재 게임 구조와 규칙 |
| 설계 기록 · 초안 | `REWORK.md` (전투 · 전술 유형 리워크 1차안), `PSIONIC_REWORK_DRAFT.md` (4학파 · 8전공, 현행), `SPECIAL_AUGS_DRAFT.md` (스페셜 전용 증강), `SYNERGY_PLAN.md` (시너지 개편 v1.0), `SYNERGY_TUNE_DRAFT.md` (시너지 수치 조정과 적용 결과), `FIELDS_DRAFT.md` (전장 초안), `TUTORIAL_DRAFT.md` (튜토리얼 설계), 루트의 `SKILL_SPLIT_CHANGES.md` (스킬 한쪽 원칙 정리). `PSIONIC_SCHOOLS_DRAFT.md`는 7학파 구안이라 지금 구현과 다릅니다 |
| 데이터에서 생성 | `SYNERGY_TABLE.md` (`npm run syn-doc`), `EVENTS.md` (`npm run events-doc`), `FIELD_STORIES.md` (`tests/fielddoc.ts`), `TUTORIAL_SCRIPT.md` (`src/data/scenes/tutorial.ts` 읽기용 사본). 손으로 고치지 말고 원본 데이터를 고친 뒤 다시 생성합니다 |
| 글쓰기 | `SCENES.md` (사건 연출 작성 가이드, 3차 지침 우선), `VOICES.md` (인물 말투), `BANTER.md` + `banter/` (기물 만담, 아직 게임에 연결하지 않음) |
| 밸런스 | `BALANCE_REPORT.md` + `balance_report.json` (최신), `BALANCE_REWORK.md` · `BALANCE_REWORK_2.md` · `BALANCE_REWORK_2_DATA.md` (리워크 이후), `BALANCE_1000.md`, `BUILD_GUIDE.md` (추천 조합) |
| 보관 | `docs/archive/` |
