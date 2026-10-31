# 문서 지도

저장소의 모든 .md 문서를 한곳에 모은 목록이다 (2026-10-31 기준). 문서마다 상태를 둘로 나눈다.

- **현행**: 코드와 계속 맞춰 두는 문서. 규칙 · 구조가 바뀌면 같은 작업에서 함께 고친다. 생성 문서는 원본 데이터를 고친 뒤 명령으로 다시 만든다.
- **기록**: 그 시점의 스냅숏 · 측정 보고서 · 초안 · 폐기된 계획 · 보관본. 내용을 지금 규칙에 맞춰 고치지 않는다 (필요하면 맨 위에 상태 한 줄만). **현행 규칙은 `docs/GDD.md` 와 코드(`src/config.ts` · `src/data/*` · `src/engine/*`)를 본다.**

코드가 기준(source of truth)이다. 문서와 코드가 어긋나면 코드를 믿고 현행 문서를 고친다.

## 현행 — 저장소 안내 · 작업 규칙
| 문서 | 다루는 것 |
|---|---|
| [`README.md`](../README.md) | 저장소 첫 안내: 무엇인지, 빌드 · 검사 명령, 폴더 구조, 에셋 · 아티팩트 배포 |
| [`CLAUDE.md`](../CLAUDE.md) | 작업 규칙: 한국어 보고, 빌드 · 타입 검사, 도감 연동, UI · 에셋 · 사건 연출 규칙 |
| [`docs/README.md`](README.md) | 이 문서. 문서 목록과 현행 / 기록 구분 |

## 현행 — 기획 · 규칙
| 문서 | 다루는 것 |
|---|---|
| [`GDD.md`](GDD.md) | 게임 기획서: 런 구조 (출격 계약 · 분기 항로), 난이도 · 절망 증강 · 서약, 기물 · 적 (성향 · 분대 · 기믹 적), 전투 · 지형, 시너지, 장비 · 합성, 증강, 사이오닉, 신앙, 경제, 튜토리얼 · 캠페인 · 훈련장, 도감 · 업적. 수치는 설정 키로 가리킨다 |
| [`ENEMIES.md`](ENEMIES.md) | 적 개념 정리: 분류 4종 (배율 · 면역), 성향 6종, 등급, 적 세기 곡선, 분대 편성, 공용 기믹 적 12종 · 전장 고유 기믹 적 39종 표, 공용 훅, 전투 중 소환된 적 규칙, 전장 규칙과의 상호작용. 적을 추가 · 수정하면 함께 고친다 |
| [`TARGETING.md`](TARGETING.md) | 적 표적 규칙 (도발 수치 + 적 성향). 규칙 · 계수 장(1 · 3장)은 현행으로 맞춰 두고, 명단 · 측정 장(2 · 4장 이후)은 적힌 날짜 기준 기록 |
| [`UI.md`](UI.md) | UI 지침 ("읽게 하지 말고 보이게"): 수치 · 조건을 문장에 묻지 않기, 화면 머리, 교범 · 접힘 등. UI 를 고치기 전에 매번 읽는다 |
| [`ABILITY_TEXT.md`](ABILITY_TEXT.md) | 능력 설명 작문 규칙: 한 줄 설명(brief) · 상세 문장 2가지 모드, 토큰(`[pv]` · `[pw]` · `[el]` · `[rng]` · `[fx]` 등), 동사 · %p 표기 |
| [`SCENES.md`](SCENES.md) | 사건 연출(미연시) 작성 가이드. 3차 지침 · '한국어 대사 작성 원칙'이 가장 우선, 숫자는 아라비아 숫자 |
| [`VOICES.md`](VOICES.md) | 인물별 말투 시트 (금지 설정 · '새어 나오는 방식' 포함) |
| [`BANTER.md`](BANTER.md) | 기물 만담 모음의 원칙 · 목차. 바 허브에서 재생한다 |
| [`banter/`](banter/) `01_deploy.md` ~ `21_shopquick.md` | 만담 원본 21묶음 (배치 직전 · 승패 · 상점 · 바 당직 · 이동 · 잡담 · 엘베스타드 · 참모진 · 세력 · 이상한 조합 · 취미 · 전투 중 · 함선 생활 · 단체 · 전장 환경 · 날짜 · 의뢰 현장 · 첫 만남 · 심야 · 티격태격 · 상점 한마디). `npm run banter` → `src/data/bar/banter.gen.ts` |

## 현행 — 도구 · 파이프라인
| 문서 | 다루는 것 |
|---|---|
| [`TOOLS.md`](TOOLS.md) | npm 스크립트 전부, `check` · `bot-regress` 검사 항목, `tests/balance.ts` 옵션, 밸런스 측정 관례 (시드 · 기준 커밋 비교 · lift), 보고서 이름 관례, 집계 스크립트 |
| [`ART_PIPELINE.md`](ART_PIPELINE.md) | 그림 파이프라인: NovelAI 생성 · 안전장치 (`nai_guard`), `art/prompts.json` 필드, 시안 고르기 페이지 (`scripts/pick_page.py`), `scripts/art.py` (부분 빌드), 아티팩트 파일 한도 · `busts-en.json`, 마스크 붓, 표정 · 배경 · 소품, 능력 아이콘 |

## 현행 — 데이터에서 생성 (손으로 고치지 않는다)
| 문서 | 다루는 것 | 다시 만들기 |
|---|---|---|
| [`SYNERGY_TABLE.md`](SYNERGY_TABLE.md) | 기물 소속 · 시너지 단계 · 효과 전문 | `npm run -s syn-doc` |
| [`EVENTS.md`](EVENTS.md) | 사건 일람 (조건 · 선택지 · 결과) | `npm run -s events-doc` |
| [`TUTORIAL_SCRIPT.md`](TUTORIAL_SCRIPT.md) | 튜토리얼 대본 읽기용 사본 (원본 `src/data/scenes/tutorial.ts`) | 원본을 고친 뒤 다시 옮긴다 (생성 스크립트는 저장소에 없음) |
| [`MOTIFS.md`](MOTIFS.md) | 인물별 표면 소재 사용 횟수 (기준을 넘으면 `npm run check` 실패) | `tests/motif_check.ts --doc` |

## 현행 — 로어 · 도구
| 문서 | 다루는 것 |
|---|---|
| [`lore/README.md`](../lore/README.md) | 기획자 로어북(옵시디언 볼트 사본) 폴더 구조와 확장 설정(`인물/확장/`) 작성 · 정합성 절차 |
| `lore/세력/` · `lore/지역/` · `lore/인물/` · `lore/_틀/` | 로어 원본 (기획자 볼트 — 원본 시트는 고치지 않는다) |
| `lore/인물/확장/<이름>.md` | 대본에서 새로 생긴 인물 설정 (`npm run check` 의 `tests/lore_ext_check.ts` 가 검사) |
| [`tools/mask-paint.md`](../tools/mask-paint.md) | 마스크 붓 도구 사용법 (`tools/mask-paint.html` → `scripts/mask_apply.py`) |

## 기록 — 밸런스 측정 보고서
모두 측정 당시 커밋 · 규칙 기준이고 고치지 않는다. 숫자가 지금 게임과 다를 수 있다. 원자료 JSON · CSV 가 옆에 있다 (`docs/balance_*.json` · `balance_durability_500_*.csv/json`).

| 문서 | 다루는 것 |
|---|---|
| [`BALANCE_2026_10_30_v457.md`](BALANCE_2026_10_30_v457.md) | 철수 · 영희 각 2,000판 (고난, 적 성향 개편 · 공용 기믹 적 12종 뒤, v457). **가장 최근 전체 측정** — 전장 고유 기믹 적 39종 · 분기 항로 조정 일부는 그 뒤 |
| [`BALANCE_2026_10_28_v411.md`](BALANCE_2026_10_28_v411.md) | 철수 · 영희 각 2,000판 (적 성장 곡선 · 전장 조정 · 사이오닉 전용 증강 뒤, v411) |
| [`BALANCE_2026_10_28.md`](BALANCE_2026_10_28.md) | 철수 · 영희 각 2,000판 (5페이즈 단축 · 기물 25명 개편 뒤) |
| [`BALANCE_2026_10_27.md`](BALANCE_2026_10_27.md) | 철수 · 영희 각 2,000판 (난이도별 체력 가산 · 전역 증강 개편 · 제련 · 잠재능력) |
| [`BALANCE_SYNERGY_LIFT.md`](BALANCE_SYNERGY_LIFT.md) | 시너지 단계별 lift (철수 vs 영희, 고난 500판씩, 2026-10-24 ~ 25) |
| [`BALANCE_CHULSU_2000.md`](BALANCE_CHULSU_2000.md) | 철수 봇 2,000판 (2026-10-24, 커밋 f1d69e1) |
| [`BALANCE_CHULSU_ROUTE.md`](BALANCE_CHULSU_ROUTE.md) | 철수 고난 500판 경로 · 페이즈별 자산 · 상점 구매 (한 줄 항로 · 분기점 시절) |
| [`BALANCE_DURABILITY_500.md`](BALANCE_DURABILITY_500.md) | 내구도 · 역경 후속 패치 500판 짝 비교 (PR 시험판) |
| [`PATCH_PREVIEW_2026_10_19.md`](PATCH_PREVIEW_2026_10_19.md) | 2026-10-19 밸런스 시험판 PR 인계 메모 (초안 사양) |
| [`BALANCE_ADVERSITY.md`](BALANCE_ADVERSITY.md) | 역경 배수(`CFG.adversityMult`) 연구 (2026-10-18) |
| [`BALANCE_EXPERIMENTS.md`](BALANCE_EXPERIMENTS.md) | 단일 변경 밸런스 실험 (2026-10-17) |
| [`BALANCE_REPORT.md`](BALANCE_REPORT.md) | 전체 런 + 고위험 조합 밸런스 보고서 (2026-10-17) |
| [`BALANCE_REWORK.md`](BALANCE_REWORK.md) | 전술 유형 리워크 이후 상세 보고서 (v172) |
| [`BALANCE_REWORK_2.md`](BALANCE_REWORK_2.md) | 리워크 2차: 원인 좁히기 (v172) |
| [`BALANCE_REWORK_2_DATA.md`](BALANCE_REWORK_2_DATA.md) | 2차 측정 원자료 표 (probe2) |
| [`BALANCE_1000.md`](BALANCE_1000.md) | 시뮬레이션 1,000판 (리워크 1차 + 이야기 사건 64종) |
| [`PSIONIC_HIT_ROLE_ANALYSIS.md`](PSIONIC_HIT_ROLE_ANALYSIS.md) | 사이오닉 적중 · 역할 · 인과학파 저이성 분석 |
| [`SYNERGY_ROSTER_ANALYSIS.md`](SYNERGY_ROSTER_ANALYSIS.md) | 시너지별 인원 구성 · 완성도 분석 (2026-10-16) |
| [`BUILD_GUIDE.md`](BUILD_GUIDE.md) | 시뮬레이션으로 고른 추천 조합 10선 (2026-10-15 규칙 · 6페이즈 시절 측정) |

## 현행 (맨 위 '지금 동작' 절) + 기록 (아래 단계 절) — 봇 설계
봇 코드는 `tests/chulsu/` · `tests/botlib.ts` 가 기준이다. 맨 위 '지금 동작' 절은 현행으로 맞춰 두고 (2026-10-31), 그 아래 단계 절은 날짜가 붙은 작업 기록이다.

| 문서 | 다루는 것 |
|---|---|
| [`BOT_CHULSU.md`](BOT_CHULSU.md) | 철수 봇: 장비 운용 · 계약 후보 · 편성 · 성장 판단 (2026-10-18 ~) |
| [`BOT_YOUNGHEE.md`](BOT_YOUNGHEE.md) | 영희 봇: 철수 판단 + 장기투자형 경제 (2026-10-24) |

## 기록 — 설계 초안 · 폐기된 계획
| 문서 | 다루는 것 | 상태 |
|---|---|---|
| [`REWORK.md`](REWORK.md) | 시스템 리워크 1차안 (전투 · 전술 유형) | 구현 뒤 여러 번 바뀜 (2026-10-11 기록) |
| [`SYNERGY_PLAN.md`](SYNERGY_PLAN.md) | 시너지 개편 v1.0 해석 · 임시값 | 반영 뒤 구조가 또 바뀜 (2026-10-11 기록) |
| [`SYNERGY_TUNE_DRAFT.md`](SYNERGY_TUNE_DRAFT.md) | 시너지 수치 조정안과 적용 결과 (2026-10-15 · 16) | 그 뒤 여러 번 다시 바뀜 |
| [`PSIONIC_REWORK_DRAFT.md`](PSIONIC_REWORK_DRAFT.md) | 사이오닉 4학파 · 8전공 설계 초안 | 구조는 구현됨, 수치는 첫 제안 (현행은 GDD 9절 · `src/data/psionic.ts` 등) |
| [`PSIONIC_SCHOOLS_DRAFT.md`](PSIONIC_SCHOOLS_DRAFT.md) | 사이오닉 7학파 구안 | 폐기 |
| [`SPECIAL_AUGS_DRAFT.md`](SPECIAL_AUGS_DRAFT.md) | 특수군 전용 증강 (기물당 8종) 초안 | 폐기 (지금은 메이저 전용 증강 14종) |
| [`FIELDS_DRAFT.md`](FIELDS_DRAFT.md) | 신규 전장 15곳 제안 (기획 배경) | 초안. 지금 전장 13곳은 `src/data/battlefields.ts` |
| [`TUTORIAL_DRAFT.md`](TUTORIAL_DRAFT.md) | 튜토리얼 「당직 근무 중 승계」 설계 | 구현됨. 현행은 GDD 12.1 · `src/engine/tutorial.ts` · `src/data/scenes/tutorial.ts` |
| [`SKILL_SPLIT_CHANGES.md`](../SKILL_SPLIT_CHANGES.md) | 스킬 한쪽 원칙 정리 작업의 변경 내역 (2026-10-15) | 원칙은 현행 (GDD 4.1), 표의 수치 · 문구는 그때 값 |
| [`drafts/연합 캠페인 방향.md`](../drafts/연합%20캠페인%20방향.md) · [`drafts/연합 캠페인 아크.md`](../drafts/연합%20캠페인%20아크.md) | 연합 캠페인 줄거리 방향 · 이야기 장치 메모 | 미확정 제안 |
| [`drafts/스타페어 엔터테인먼트.md`](../drafts/스타페어%20엔터테인먼트.md) · [`drafts/적광.md`](../drafts/적광.md) | 로어북에 넣을 기업 문서 초안 (옵시디언 틀 문법) | 미확정 초안 |

## 기록 — 보관본
| 문서 | 다루는 것 |
|---|---|
| [`archive/unit_augments.md`](archive/unit_augments.md) | 폐지된 기물 개별 증강 (전술 유형 개편 전) — 참고용 |
| [`archive/field_intro_adv/README.md`](../archive/field_intro_adv/README.md) · [`FIELD_STORIES.md`](../archive/field_intro_adv/FIELD_STORIES.md) | 걷어 낸 전장 도입 브리핑 미연시 보관본과 그 대본 (빌드 밖). 의뢰 제목 · 의뢰인은 지금도 `src/data/scenes/fields.ts` 에서 계약 화면이 읽는다 |
| [`archive/seal_v361/README.md`](../archive/seal_v361/README.md) | 걷어 낸 그늘 연출(전표 카메라 · 체인 · 회중시계) 보관본 (빌드 밖) |
