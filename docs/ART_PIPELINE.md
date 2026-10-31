# 에셋 파이프라인 — 스탠딩 · 초상화 · 배경 · 소품 · 능력 아이콘 (2026-10-31, 스크립트 기준)

그림을 뽑고(NovelAI) → 사용자가 고르고 → 잘라 게임에 넣고 → 아티팩트에 올리는 흐름. 사실의 기준은 `scripts/*` · `art/*.json` · `src/ui/portraits.ts` · `scripts/build.mjs` 이다. 작업 규칙 요약은 `CLAUDE.md` '에셋'.

## 목차

1. 원칙
2. 흐름 한눈에
3. NovelAI 생성
4. 프롬프트 파일 `art/prompts.json`
5. 시안 고르기
6. 게임에 넣기 — `scripts/art.py`
7. 아티팩트 게시 때 그림 파일
8. 어려운 투명화 — 마스크 붓
9. 표정 차분 · 배경 · 소품
10. 능력 아이콘
11. 알려진 어긋남 (스크립트 쪽, 판단 필요)

## 1. 원칙

- **NovelAI 생성은 사용자가 요청한 분량만, 유료(Anlas)로만.** 무료 생성 자동화로 무료 생성이 영구 제한됐다 (ToS 9.1.6). 에이전트가 스스로 판단해 생성을 시작하지 않는다.
- 여러 장은 순차 실행으로 나눠 돌린다 (1회 최대 8장, 동시 실행 · 병렬 금지).
- **프롬프트를 새로 쓰거나 고치면 1~2장만 먼저 뽑아 확인한 뒤** 나머지를 뽑는다.
- 배경 · 스탠딩 일러스트는 넣기 전에 반드시 사용자에게 시안을 보여 주고 고르게 한다 (5절).
- 투명화가 자동으로 안 되면 사용자가 붓으로 칠한다 (8절). 점 찍기 방식은 쓰지 않는다.

## 2. 흐름 한눈에

```
art/prompts.json ──(scripts/nai.mjs, 유료 29스텝)──▶ art/raw/<id>/<seed>.png      (깃 밖) + art/gen-log.json
        │                                                    │
        │                         scripts/pick_page.py ──▶ 시안 페이지 (아티팩트 · db) ──▶ 사용자가 고름
        │                                                    ▼
        └─────────────────────────────────────────── art/picks.json  { "<id>": "<seed>.png" }
                                                             │ python3 scripts/art.py pick
                                                             ▼
                                art/picked/<id>.webp  (깃에 넣는 보관 원본)  + art/faces.json · crops.json · cut.json
                                                             │ python3 scripts/art.py build <id ...>
                                                             ▼
             public/art/<id>.webp · <id>.bust.webp · <id>.<표정>.webp  +  src/ui/portraits.gen.ts · standface.gen.ts
                                                             │ npm run -s build
                                                             ▼
                          dist/art/*  (+ 적 · 소환물 상반신 묶음 dist/art/busts-en.json)  ──▶ 아티팩트 files
```

## 3. NovelAI 생성

### 스크립트

| 스크립트 | 용도 | 실행 | 결과 |
|---|---|---|---|
| `scripts/nai.mjs` | 스탠딩 · 초상화 (기물 · 적 · 소환물 · 인물) | `node scripts/nai.mjs <id ...>` · `--alt <키>` (prompts.json `alts`) · `--n <장 수>` · `--seed N` · `--force` · `--dry` · `--all` | `art/raw/<id>/<seed>.png` (`--alt` 면 `<alt>-<seed>.png`), 기록 `art/gen-log.json` |
| `scripts/nai_bg.mjs` | 배경 (가로 1216×832) | `node scripts/nai_bg.mjs <키 ...>` · `--all` · `--n` · `--force` | `art/raw/bg/<키>/<seed>.png` (입력 `art/bg_prompts.json`) |
| `scripts/nai_prop.mjs` | 출격 계약 탑뷰 소품 (테이블 · 벨 · 전표 출력기) | `node scripts/nai_prop.mjs <키 ...>` · `--all` | `art/raw/prop/<키>/<seed>.png` (입력 `art/prop_prompts.json`, 흰 바탕 → 오리기) |
| `scripts/nai_outpaint.mjs` | 캔버스 확장 (마스크 흰 곳만 새로 그림) | `node scripts/nai_outpaint.mjs <소품 키> <canvas.png> <mask.png> <장 수>` | `art/raw/prop/<키>_x/<seed>.png` |
| `scripts/nai_icon.mjs` | 능력 아이콘 (10절) | `node scripts/nai_icon.mjs <id ...>` · `--all` · `--style A~E` (기본 E) · `--seed` · `--force` · `--dry` | `art/icons/raw/<id>.png` |
| `scripts/nai_upscale.mjs` | 2배 업스케일 (Anlas 소모) | `node scripts/nai_upscale.mjs <입력.png> <출력.png>` | |
| `scripts/nai_expr.py` · `scripts/nai_face.py` | 표정 차분 (전신 img2img · 얼굴 인페인팅, 9절) | 파일 머리 docstring | `art/picked/<id>.<표정>.webp` · `art/faces_raw/` |
| `scripts/nai_i2i.py` | 배경 등 일반 img2img | `python3 scripts/nai_i2i.py <입력> <출력 폴더> --prompt "…" [--strength] [--noise] [--n]` | |

- 토큰: 환경 변수 `NOVELAI_TOKEN`. `--dry` 는 요청 없이 프롬프트만 출력한다 (토큰 불필요) — 프롬프트를 고칠 때 먼저 확인한다.
- `nai.mjs` 는 `art/raw/<id>` 에 이미 그림이 있으면 건너뛴다 (`--force` 또는 `--seed` 로 다시).
- **이 클라우드 환경에서는 `NODE_USE_ENV_PROXY=1` 을 붙여 실행한다** (`NODE_USE_ENV_PROXY=1 NOVELAI_TOKEN=… node scripts/nai.mjs …`). 없으면 `fetch failed`. 잔액 조회 주소(`api.novelai.net`)는 막혀 있어 시작 · 끝의 **"Anlas 잔액 확인 실패" 는 정상**이다 (생성 주소 `image.novelai.net` 는 열려 있음).

### 안전장치 (`scripts/nai_guard.mjs`, 모든 `nai*.mjs` 가 import)

| 규칙 | 코드 |
|---|---|
| 1회 실행 최대 8장 (`id 수 × --n` 이 8 을 넘으면 시작하지 않음) | `MAX_PER_RUN = 8` · `guard()` |
| 동시 실행 금지: 잠금 파일 `art/.nai.lock` (pid 가 살아 있으면 거절, 죽은 잠금은 무시) | `guard()` |
| 장 사이 무작위 6~15초 휴식 | `pause()` |
| 시작 전 · 끝난 뒤 Anlas 잔액 표시 (클라우드에서는 실패가 정상) | `anlas()` |
| 유료로만: 무료 범위(832×1216 이하 · 28스텝 이하)를 벗어나도록 **29스텝** | `nai.mjs` (설정 23 → 29로 올림, 29 초과 · 큰 해상도는 거절) · `nai_icon` · `nai_prop` · `nai_outpaint` (`STEPS = 29`) |

- `nai.mjs --free` 플래그(설정 스텝 그대로)는 쓰지 않는다.
- 429 (요청 제한)는 30초 × 시도 수만큼 기다렸다 다시 (최대 4~5번).

### 생성 설정 `art/nai.config.json`

모델 `nai-diffusion-5-full` · 832×1216 · scale 7 · `k_euler_ancestral` · karras · `transparent: true`. 공용 앞 태그 `base`(화풍 · 작가 태그 · `solo` 포함) · 부정 `negative`.
`transparent` 면 `base` 에서 `white background` · `simple background` 를 빼고 `transparent background` 를 넣어 V5 투명 배경(RGBA)으로 받는다.

## 4. 프롬프트 파일 `art/prompts.json`

`{ "<id>": { … } }` 253항목. id 머리: 없음 = 기물, `en_` 적, `sm_` 소환물, `b_` · `c_` · `d_` · `m_` · `tu_` · `fi_` · `a_` 바 · 사건 · 상인 등 인물.

| 필드 | 뜻 |
|---|---|
| `name` | 한국어 이름 (시안 페이지 · 크롭 도구 표시) |
| `subject` | 맨 앞 주어 태그 (`1girl` · `1boy` · `1other` · `no humans` …) |
| `tags` | 본 태그 |
| `alts` | `{ 키: 태그 }` 다른 시안 (`--alt 키` 로 `tags` 대신) |
| `object` | `true` = 사물 · 기계 · 괴물. 아래 참고 |
| `source` | 설정 출처 (`lore` · `user` · `enemy` · `npc` · `temp` · `derived`) |
| `notes` | 설정 메모 · 시안 차수 |

프롬프트 = `<subject>, transparent background, <base>, <tags>`.

**`object: true`** 면 `base` 에서 `standing illustration, splash art, solo, ` 를 빼고 맨 앞에 `concept art, single object, ` 를 붙이며, 부정 프롬프트에 사람형 태그(humanoid · bipedal · android · mecha musume · person · human · arms and legs · standing robot …)를 더한다.
'concept art' 는 여러 개를 늘어놓은 설정화를 부르기 쉽다 — **동물 · 한 개체는 `object` 를 끄고 `tags` 에 `solo, animal focus` 를 쓴다** (예: `en_cw_cats` — 4차 시안에서 object 를 끄고 `solo, cat, animal focus, …` 와 `-2::multiple cats, group, character sheet, reference sheet, multiple views::`).

## 5. 시안 고르기

시안 페이지 도구: **`scripts/pick_page.py`** + 템플릿 **`tools/pick/tpl.html`** (사용법은 파일 머리 docstring).

1. 페이지 만들기: `python3 scripts/pick_page.py OUT_DIR --title "전장 고유 적 시안" --col picks <prompt id ...> [--latest N]`
   → `OUT_DIR/index.html` · `OUT_DIR/img/<id>_<seed>.webp` (축소본) · 게시용 목록 `OUT_DIR/files.json`. `--latest N` = 각 id 의 `art/raw/<id>/` 에서 최근 N장만.
2. 게시: Artifact 도구로 `OUT_DIR/index.html` 을 `root` = OUT_DIR, `files` = `files.json` 내용, `capabilities` = `{"db": {}}` 로.
3. 사용자가 고른다 (고르면 바로 db 에 저장, 시안마다 '다시 뽑기' 칸도 있다). 고르는 페이지의 변경 알림은 오지 않을 수 있으니 사용자가 "골랐다"고 하면 읽는다.
4. 읽기: ArtifactData `list` (collection = `--col`) → 문서 id = 시안 id (`en_` 를 뺀 것), `seed` = 고른 파일 이름, `redo` = 다시 뽑기.
5. 적용: `art/picks.json` 에 `"<id>": "<seed>.png"` (문서 id 에 `en_` 를 다시 붙인다) → `python3 scripts/art.py pick` → `art/picked/<id>.webp` → `python3 scripts/art.py build <id ...>` (6절).

## 6. 게임에 넣기 — `scripts/art.py`

| 명령 | 하는 일 |
|---|---|
| `pick` | `art/picks.json` 의 선택본(`art/raw/<id>/<파일>`) → `art/picked/<id>.webp` (보관 원본, 깃에 넣음). 값이 `user` 면 사용자 제공본이 이미 `art/picked` 에 있다 |
| `faces` | 얼굴 위치를 못 정한 그림만 자동 추정 → `art/faces.json` (손으로 고치는 게 기본) |
| `build <id ...>` | **그 그림만 다시** (아이콘 · 얼굴 위치표의 다른 줄은 그대로). 보통 이것을 쓴다 |
| `build` | 전부 다시 (20분 넘게 걸린다) |
| `standfaces` | 스탠딩 안 얼굴 위치표만 다시 → `src/ui/standface.gen.ts` |
| `variants [id.표정 ...]` | 표정 차분만 다시 내기 |
| `croptool` | 초상화 크롭 도구 → `dist/crop/index.html` + `dist/crop/img/` (아티팩트로 게시. 저장 = db `crops/<id>` · JSON 복사) |
| `sheet OUT.png` · `holes OUT.png` | 아이콘 확인 시트 · 갇힌 배경 후보 표시 |

### 입력 파일

| 파일 | 형식 |
|---|---|
| `art/picks.json` | `{ id: "<seed>.png" \| "user" }` 고른 원본 |
| `art/faces.json` | `{ id: [얼굴 중심 x, 눈썹 y, 턱 y] }` (원본 픽셀) — 아이콘 · 상반신 배너 · 얼굴 위치표 |
| `art/crops.json` | `{ id: [x, y, 한 변] }` 아이콘 크롭 (크롭 도구에서 옮김, faces.json 보다 우선) |
| `art/cut.json` | `{ id: [[x, y], …] }` 흰 배경 원본에서 팔과 몸 사이처럼 갇힌 배경을 지울 점 (`holes` 로 후보 확인). 옛 그림용 — 새 그림은 투명 배경으로 받거나 마스크 붓(8절) |

### 산출물

| 파일 | 내용 |
|---|---|
| `public/art/<id>.webp` | 전신 스탠딩 (원본 높이를 960 으로 맞춘 비율로 줄이고 투명 테두리를 깎음) |
| `public/art/<id>.<표정>.webp` | 표정 차분 (`art/picked/<id>.<표정>.webp` 를 기본 스탠딩과 같은 틀로) |
| `public/art/<id>.bust.webp` | 머리 크기를 맞춘 상반신 배너 480×360 (faces 또는 crops 가 있을 때) |
| `src/ui/portraits.gen.ts` | 머리 크롭 아이콘 128px (데이터 URI 내장, `ICONS`) |
| `src/ui/standface.gen.ts` | 스탠딩 안 얼굴 위치 비율 (바 무대 정렬용, 적 · 소환물 · `lore_` · `bg_` 제외) |

투명 배경 원본(RGBA)은 그대로 쓰고, 흰 배경 원본만 배경을 깎는다. `.gen.ts` 는 손으로 고치지 않는다. 넣은 뒤 `npm run -s build` · `npx tsc --noEmit -p .`.

## 7. 아티팩트 게시 때 그림 파일

아티팩트는 그림을 `artifact.html` 에 내장하지 않고 `art/<파일>` 로 따로 불러온다 (`src/ui/portraits.ts artURL`). 그림을 새로 넣거나 바꾸면 게시 때 `files` 로 함께 올린다 — 안 올리면 게임에서 실루엣 · 옛 그림이 나온다.

- **아티팩트 한 버전의 파일 수 한도는 512개**다. 그래서 적 · 소환물 상반신(`en_*` · `sm_*` `.bust.webp`)은 `npm run -s build` 가 `dist/art/busts-en.json` 하나로 묶고 (`scripts/build.mjs`), 게임은 시작 때 `loadArtPack()` 으로 받는다 (받기 전 · 실패하면 낱개 파일로).

| 바꾼 그림 | `files` 로 올릴 것 |
|---|---|
| 아군 기물 · 인물 | `art/<id>.webp` · `art/<id>.bust.webp` (표정 차분이 있으면 `art/<id>.<표정>.webp`) |
| 배경 · 소품 | `art/<파일>.webp` |
| 적 · 소환물 (`en_` · `sm_`) | `art/<id>.webp` · `art/busts-en.json` |

- 원본 경로는 빌드 산출물 `dist/art/…` (`npm run -s build` 뒤). 게시 흐름 (빌드 커밋 · 버전 label)은 `CLAUDE.md` '커밋 · 게시'.

## 8. 어려운 투명화 — 마스크 붓

배경과 색이 비슷한 소매, 그려진 종이 · 그림자, 층을 나눠야 하는 손가락처럼 자동으로 오리기 어려운 그림은 사용자가 붓으로 칠한다: `tools/mask-paint.html` 아티팩트 (db 에 `masks/<name>` 저장) → ArtifactData 로 받기 → `scripts/mask_apply.py`. 쓰는 법은 **`tools/mask-paint.md`**.

자동 오리기 보조 스크립트 (작업 하나에 맞춘 것): `scripts/hand_cut.py` · `hand_layers.py` · `hand_tone.py` (에이든 손), `mug_cut.py` (머그), `table_bake.py` (바 테이블 결 음영).

## 9. 표정 차분 · 배경 · 소품

- 표정 차분: `nai_expr.py <id> <표정 ...>` (원래 생성 프롬프트에 표정 태그를 얹어 전신 img2img, 결과 `art/picked/<id>.<표정>.webp`) 또는 `nai_face.py` (얼굴만 인페인팅 → `art/faces_raw/` → `face_fix.py` 로 색 맞춤). 그 뒤 `art.py build <id>` 또는 `variants`.
- 배경: `art/bg_prompts.json` (`base` · `negative` · `bgs`) → `nai_bg.mjs` → 사용자가 고른 뒤 (필요하면 `nai_upscale.mjs` 로 2배) 보관 원본 `art/picked/bg_<키>.webp` 와 게임용 `public/art/bg_<키>.webp` 를 넣는다. `art.py build` 는 `art/prompts.json` 의 id 만 처리하므로 배경은 따로 낸다 (전용 스크립트 없음, 예: 19e27cf). 게시 때 `art/bg_<키>.webp` 를 `files` 로.
- 소품: `art/prop_prompts.json` → `nai_prop.mjs` (흰 바탕) → 오리기 · 굽기 스크립트.
- 배경 · 스탠딩은 넣기 전에 반드시 시안을 보여 주고 고르게 한다 (5절).

## 10. 능력 아이콘

`art/icon_prompts.json` → `scripts/nai_icon.mjs` → `art/icons/raw/<id>.png` → `python3 scripts/icons_build.py` → `src/ui/abilicons.gen.ts` (88px WebP 데이터 URI).

| 항목 | 내용 |
|---|---|
| 키 | `skill.<기물>` · `trait.<기물>` · `ult.<기물>` · `weapon.<기물>` · `cantrip.<전공>` · `passive.<전공>` · `faith.<신앙>` … |
| 항목 필드 | `subject` (그릴 것) · `color` (색 계열) · `light` (흰 배경) · `prop` (무기 강조 끄기) |
| 화풍 | `--style` A~E, 기본 E (꽉 찬 이펙트 페인팅 · 단색 계열 · 대각 구도). 640×640 · 29스텝 |
| 물리 계열 스킬 · 무기 | `light: true` → 흰 배경 · 옅은 회색 비네트 (부정 프롬프트에 어두운 배경) |
| 무기 (`weapon.*`) | `prop` 이 없으면 무기 자체가 먼저 보이게 강조 태그를 더한다 |

- 다시 뽑을 때는 프롬프트를 바꾼 시안 3개를 보여 주고 고르게 한다.
- `art/icons/raw` 는 깃에 없다. `icons_build.py` 는 그 폴더에 있는 그림만으로 `abilicons.gen.ts` 를 통째로 다시 쓰므로, 새 체크아웃처럼 폴더가 비어 있으면 기존 아이콘이 빠진다 — 돌리기 전에 폴더 내용을 확인하고 `git diff` 로 줄어든 아이콘이 없는지 본다.

## 11. 알려진 어긋남 (스크립트 쪽, 판단 필요)

1절 원칙(유료 29스텝 · 1회 8장 · 잠금)을 스크립트가 다 강제하지는 않는다. 고치기 전에는 아래 스크립트를 쓰지 않거나, 쓰기 전에 사용자에게 확인한다.

| 스크립트 | 어긋남 |
|---|---|
| `nai_bg.mjs` | `STEPS = min(28, 설정 23)` = 23스텝 — 무료 범위 안 (안전장치 `guard` 는 씀) |
| `nai_expr.py` · `nai_i2i.py` · `nai_face.py` | 28스텝 이하 (무료 범위), `nai_guard` 를 쓰지 않아 8장 상한 · 잠금 · 6~15초 휴식이 없다 (2.5초 휴식) |
| `nai_upscale.mjs` | 안전장치 없음 (한 번에 1장) |
| `nai.mjs` 주석 | 'Anlas 보호: 28스텝 이하 · 1장만' 은 옛 설명 — 코드는 29스텝 · 최대 8장 |
