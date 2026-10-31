# ERRANTEs

은하 용병단 **에란테스(ERRANTEs)** 를 지휘하는 싱글 PvE 오토배틀러 로그라이트 (TypeScript). 에란테스 바에서 의뢰를 받아 전장 하나의 분기 항로를 5페이즈 동안 헤쳐 나가고, 마지막 보스를 쓰러뜨리면 의뢰 성공이다. 증강 · 시너지 · 장비가 한 번에 판을 뒤집는 설계. 브라우저에서 HTML 파일 하나로 돌아가고, 서버가 필요 없습니다.

- 기획서: [`docs/GDD.md`](docs/GDD.md) — 지금 게임 구조와 규칙
- 문서 지도: [`docs/README.md`](docs/README.md) — 모든 문서의 내용과 현행 / 기록 구분
- 작업 규칙: [`CLAUDE.md`](CLAUDE.md)

코드가 기준입니다: 수치 `src/config.ts` (`CFG`), 데이터 `src/data/*`, 규칙 `src/engine/*`. 문서와 코드가 어긋나면 코드를 믿습니다.

## 플레이
- `dist/index.html`을 브라우저로 엽니다. 스탠딩 · 배경 일러스트는 같은 폴더의 `dist/art/`에서 읽고, 파일이 없으면 도트 스프라이트로 대신 그립니다.
- `npm run offline`을 돌리면 일러스트 · 글꼴까지 데이터 URI로 넣은 `dist/ERRANTEs-offline.html` 파일 하나가 만들어집니다 (용량이 큽니다. 깃에는 넣지 않습니다).
- 진행 상황은 브라우저 localStorage에 저장됩니다. 자동 저장, 슬롯 3개, 캠페인 슬롯, 저장 코드 내보내기 · 불러오기를 지원합니다. 도감 · 기록 · 업적도 이 브라우저에만 남습니다.

## 명령
```bash
npm install
npm run -s build           # dist/index.html (오프라인 실행용) + dist/artifact.html (아티팩트 게시용) + public/art → dist/art 복사 (+ 적 · 소환물 배너 묶음 busts-en.json)
npx tsc --noEmit -p .      # 타입 검사 (npm run typecheck 와 같음)
npm run -s check           # 데이터 검사 묶음 (아래)
npm run -s bot-regress     # 봇 장비 운용 회귀 테스트 (tests/bot_regress.ts, 종료 코드 0 = 통과)
npm run -s offline         # 일러스트 내장 단독 파일
npm run sim -- 40          # 헤드리스 봇 시뮬레이션 40판 (뒤에 fields / units 를 붙이면 전장별 · 기물별 집계)
npm run -s syn-doc         # docs/SYNERGY_TABLE.md 다시 생성
npm run -s events-doc      # docs/EVENTS.md 다시 생성
npm run -s tut-doc         # docs/TUTORIAL_SCRIPT.md 다시 생성
npm run -s banter          # docs/banter/*.md → src/data/bar/banter.gen.ts (바 허브 만담)
npm run -s map-metrics     # 지형 틀 측정 (check 에 들어가지 않음)
```
- 무엇을 바꾸든 `npm run -s build`와 `npx tsc --noEmit -p .`가 통과해야 합니다.
- 기물 · 장비 · 시너지 · 증강 · 전공 · 성유물을 추가 · 수정 · 삭제했으면 `npm run -s check`도 통과해야 하고, 능력 문구(`src/data/abiltext.ts`, `src/data/abil/*.ts`, `src/data/brief.ts`)도 같이 고칩니다.
- `npm run check` 가 도는 검사 (`tests/*_check.ts`): 도감 범위 · undefined · NaN (`codex`), CSS 토큰 (`css`, 기준 갱신은 `npm run css-baseline`), 바 허브 대본 (`bar`), 소재 반복 (`motif`), 숫자 표기 (`number`), 확장 설정 정합성 (`lore_ext`), 업적 (`achieve`), 분기 항로 규칙 (`route`), 적 분대 (`squad`), 지형 (`terrain`), 출전 기물 (`deploy`), 개전 예측 (`preview`), 상점 · 상인 (`shop`), 전역 증강 (`global`).
- 그 밖의 검사 · 계측 스크립트도 `tests/`에 있고, 실행법은 파일 첫 줄 주석에 적혀 있습니다 (사건 연출 검사 `scenes_check.ts`, 증강 문구 대조 `augtext_check.ts`, 밸런스 계측 `balance.ts` (철수 · 영희 봇 `tests/chulsu/`) · `buildsim.ts` · `probe2.ts`, 절망 증강 비교 `despair_sim.ts`, 전투 종료 보고서 기준선 `report_base.ts` 등). 봇 평가표 다시 만들기는 `npm run chulsu-profile` · `chulsu-augprofile` · `chulsu-synprofile`.

## 폴더 구조
| 경로 | 내용 |
|---|---|
| `src/main.ts` | 화면 · 입력 · 진행 흐름 (타이틀, 계약 기물 명부, 지도, 편성, 전투, 결과, 도감, 튜토리얼 진행) |
| `src/config.ts` | 전투 · 성장 · 경제 · 적 강도 · 적 성향 · 기믹 적 · 지형 · 분대 수치 (`CFG`), 적 성장 곡선 (`scalePhase` · `phaseHpMult` · `phaseAmpMult`) |
| `src/types.ts` | 공용 타입: 주요 능력치, 속성, 분류, 전투 · 전술 유형, 신앙, 노드 종류, 조우 · 분대, 런 상태 |
| `src/engine/` | `combat.ts` 전투 시뮬레이션 (피해 · 상태 · 도발 · 성향 · 경계) · `build.ts` 기물 · 적 → 전투 유닛 변환, 스탯 · 시너지 집계 · `run.ts` 런 진행 (분기 항로, 조우 · 분대 조립, 보상, 성장, 상점, 사건) · `preview.ts` 개전 예측 · `report.ts` 전투 종료 보고서 · `achieve.ts` 업적 판정 · `campaign.ts` · `campaignrun.ts` 캠페인 · `lab.ts` 훈련장 · `tutorial.ts` 튜토리얼 런 · `starters.ts` 계약 기물 후보 · `effects.ts` 효과 모델 |
| `src/data/` | 게임 데이터. 기물(`roster*.ts` + `rework.ts`, `units.ts`에서 합침), 시너지, 장비 · 합성(`items.ts`), 배치형 소모품(`devices.ts`), 증강(`augments.ts` · `majoraugs/`), 사이오닉(`schools.ts` · `psionic.ts` · `psiextra.ts` · `psiunit/`), 성유물, 궁극기, 전장(`battlefields.ts`), 적(`enemies.ts` · `enemyText.ts`), 적 분대(`squads.ts`), 지형(`maps.ts`), 상인(`merchants.ts`), 사건(`events.ts` · `story*.ts`), 사건 연출(`scenes/`), 바 허브 대본(`bar/`), 계약 약관(`contract.ts`), 난이도 · 절망 증강 · 서약(`difficulty.ts` · `despair.ts` · `oaths.ts`), 전역 증강 · 특권(`globals.ts`), 캠페인(`campaign.ts`), 업적, 교범, 세계관 요약, 음성 대사, 능력 설명(`abiltext.ts` · `abil/` · `brief.ts`) |
| `src/ui/` | 바 허브(`bar.ts`), 출격 계약(`contract.ts`), 항로도(`routemap.ts`), 상점(`shop.ts`), 전투 연출(`battleview.ts`), 도감(`codex2.ts`), 미연시 화면(`adv.ts`), 안내 말풍선(`coach.ts`), 절망 서약(`oath.ts`), 훈련장(`lab.ts`), 업적 · 보고서, 저장 · 기록(`save.ts` · `meta.ts`), 스타일(`style.css`). `*.gen.ts`는 스크립트가 만드는 파일이라 손으로 고치지 않습니다 |
| `tests/` | 검사 · 시뮬레이션 · 봇(`chulsu/`, `botlib.ts`) · 문서 생성 스크립트 |
| `scripts/` | 빌드(`build.mjs`)와 에셋 파이프라인 (NovelAI 생성 · 크롭 · 마스크 적용 · 아이콘 빌드) |
| `art/` | 에셋 원본과 설정: 프롬프트(`prompts.json` · `bg_prompts.json` · `icon_prompts.json`), 고른 원본(`picked/`), 얼굴 위치 · 크롭(`faces.json` · `crops.json`). `art/raw/`는 깃에 넣지 않습니다 |
| `public/art/` | 게임에서 쓰는 WebP 일러스트 (스탠딩, 상반신 배너, 적, 배경 `bg_*`) |
| `dist/` | 빌드 결과. 깃에는 `index.html` · `artifact.html`만 들어갑니다 |
| `docs/` | 기획 · 규칙 · 글쓰기 · 밸런스 기록 문서 ([`docs/README.md`](docs/README.md)) |
| `lore/` | 기획자 로어북 (옵시디언 볼트 사본) + 확장 설정. [`lore/README.md`](lore/README.md) 참고 |
| `drafts/` | 로어 · 캠페인 초안 (미확정) |
| `archive/` | 걷어 낸 연출 보관본 (빌드 밖) |
| `tools/` | 보조 도구 (초상화 크롭 도구, 마스크 붓 `mask-paint.html`) |

## 에셋 파이프라인
NovelAI 생성 스크립트는 환경 변수 `NOVELAI_TOKEN`이 필요하고, 생성 설정은 `art/nai.config.json`에 있습니다. **생성은 사용자가 요청한 분량만, 유료(Anlas)로만 돌립니다** — `scripts/nai_guard.mjs`가 1회 실행 최대 장 수 · 동시 실행 금지 · 장 사이 휴식을 강제합니다 (자세한 규칙은 `CLAUDE.md`). 배경 · 스탠딩 일러스트는 넣기 전에 반드시 시안을 보여 주고 사용자가 고르게 합니다.

1. **스탠딩 · 초상화**: `art/prompts.json` → `node scripts/nai.mjs <id>` → `art/raw/<id>/` → 고른 파일을 `art/picks.json`에 적고 `python3 scripts/art.py pick` → `art/picked/` → `python3 scripts/art.py build [id ...]` → `public/art/<id>.webp`, `<id>.bust.webp`, `src/ui/portraits.gen.ts`(아이콘 내장). 얼굴 위치는 `art/faces.json`을 기본으로 쓰고, `art.py croptool`로 고친 값(`art/crops.json`)이 있으면 그 값을 먼저 씁니다. 표정 차분은 `scripts/nai_face.py` · `nai_expr.py` · `face_fix.py`로 만듭니다.
2. **배경**: `art/bg_prompts.json` → `node scripts/nai_bg.mjs <key>` → `art/raw/bg/<key>/` → 고른 것을 `public/art/bg_<key>.webp`로 넣습니다. 그 밖의 이미지 변환에는 `nai_i2i.py`, 업스케일에는 `nai_upscale.mjs`(Anlas 소모)를 씁니다.
3. **능력 아이콘**: `art/icon_prompts.json` → `node scripts/nai_icon.mjs <id>` → `art/icons/raw/` → `python3 scripts/icons_build.py` → `src/ui/abilicons.gen.ts`(WebP 데이터 URI 내장). 다시 뽑을 때는 프롬프트를 바꾼 시안 3개를 보여 줍니다. 물리 계열 스킬 · 무기 아이콘은 흰 배경(light)입니다.
4. **어려운 투명화**: 사용자가 `tools/mask-paint.html` 아티팩트에서 붓으로 칠한 마스크를 `scripts/mask_apply.py`로 적용합니다 (사용법 `tools/mask-paint.md`).

## 아티팩트 배포
- `npm run build`가 만드는 `dist/artifact.html`은 문서 뼈대(`<html>` · `<head>`)가 없는 페이지 본문입니다. 이것을 아티팩트 페이지로 게시합니다. 코드 · CSS · 능력 아이콘 · 초상화 아이콘은 이 파일 안에 들어 있습니다.
- 일러스트는 페이지에 넣지 않고 **별도 파일로 따로 올립니다.** 페이지는 상대 경로 `art/<파일>`로 읽으므로, 게시 경로 `art/<파일>`에 원본 `dist/art/<파일>`(= `public/art/`)을 대응시켜 `files`로 함께 올립니다. 그림을 새로 넣거나 바꾸면 `art/<id>.webp` · `art/<id>.bust.webp`를 함께 올립니다 (안 올리면 게임에서 실루엣 · 옛 그림이 나옵니다).
- 적 · 소환물 상반신 배너(`en_*` · `sm_*` `.bust.webp`)는 파일 수 한도 때문에 빌드가 `dist/art/busts-en.json` 하나로 묶습니다 (`src/ui/portraits.ts`). 적 · 소환물 배너를 바꾸면 이 파일을 올립니다.
- 한 번에 올릴 수 있는 파일 수(255개)를 넘기 때문에 같은 아티팩트 URL에 여러 번 나눠 게시합니다. 이미 올라간 파일은 그대로 남습니다.
- 게시 용량에 한도가 있어 아이콘 압축 품질을 낮춰 두었습니다 (`scripts/icons_build.py`). 페이지가 커지면 이 점부터 확인합니다.

## 문서
분류와 문서별 한 줄 설명은 [`docs/README.md`](docs/README.md)에 있습니다. 자주 보는 것만 추리면:

| 분류 | 문서 |
|---|---|
| 기획 · 규칙 (현행) | [`docs/GDD.md`](docs/GDD.md), [`docs/ENEMIES.md`](docs/ENEMIES.md) (적 개념 · 기믹 적 표), [`docs/TARGETING.md`](docs/TARGETING.md) (적 표적 규칙), [`docs/UI.md`](docs/UI.md) (UI 지침), [`docs/ABILITY_TEXT.md`](docs/ABILITY_TEXT.md) (능력 설명 작문) |
| 글쓰기 (현행) | [`docs/SCENES.md`](docs/SCENES.md) (사건 연출, 3차 지침 우선), [`docs/VOICES.md`](docs/VOICES.md) (인물 말투), [`docs/BANTER.md`](docs/BANTER.md) + `docs/banter/` (바 허브 만담) |
| 데이터에서 생성 | `SYNERGY_TABLE.md` (`npm run syn-doc`), `EVENTS.md` (`npm run events-doc`), `TUTORIAL_SCRIPT.md` (`npm run tut-doc`), `MOTIFS.md`. 손으로 고치지 말고 원본 데이터를 고친 뒤 다시 만듭니다 |
| 도구 (현행) | [`docs/TOOLS.md`](docs/TOOLS.md) (검사 · 시뮬레이터 · 밸런스 측정 관례), [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md) (그림 생성 · 반영 · 게시) |
| 밸런스 · 봇 (기록) | 최신 `docs/BALANCE_2026_10_30_v457.md`, 그 밖의 `BALANCE_*` · `BOT_*` · `BUILD_GUIDE.md` — 측정 당시 규칙 기준 |
| 설계 초안 · 보관 (기록) | `REWORK.md` · `*_DRAFT.md` · `SYNERGY_PLAN.md` · 루트 `SKILL_SPLIT_CHANGES.md`, `docs/archive/` · `archive/` |
