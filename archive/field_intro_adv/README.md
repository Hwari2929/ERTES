# 전장 도입 미연시 보관본 (v365 직후 걷어 냄)

런을 시작하면(계약 기물 4명을 고르고 출격) 특권 증강을 고르기 전에 한 번 나오던 **의뢰 브리핑 미연시(ADV)** 를 떼어 보관한 것이다.
빌드에 들어가지 않는다 (`tsconfig.json` 의 include 밖).

## 들어 있는 것

| 파일 | 내용 |
|---|---|
| `FIELD_STORIES.md` | **전장별 대본 읽기용 사본** — 13개 전장의 의뢰 제목 · 의뢰인 · 의뢰 내용 · 핵심 · 보상 · 대사 전체 |
| `fields.ts` | 걷어 내기 직전 `src/data/scenes/fields.ts` 원본 (대사 `beats`, 의뢰인 NPC 등록부 `FIELD_REG`, `fieldIntroPending`) |
| `fielddoc.ts` | `FIELD_STORIES.md` 생성기 (원래 `tests/fielddoc.ts`) |

## 남긴 것 · 뺀 것

- **남김:** `src/data/scenes/fields.ts` 의 `FIELD_INTROS` 중 제목 · 의뢰인 · 의뢰 내용 · 핵심 · 보상. 계약 화면(메뉴판 · 전표)이 읽는다.
- **뺌:**
  - 대사(`beats`)
  - 의뢰인 NPC 10명(`fi_*`: 루크레치아 · 고르고 · 마르타 · 에르빈 · 칸자키 · 미노스 · 켈라이노스 · 토바 · 조디악 · 힐데). 일러스트 파일은 그대로 있다.
  - 런 시작 대기열에 미연시를 넣던 `fieldIntroPending`
  - 캠페인의 `field_intro` 깃발

## 되살리기

```sh
cp archive/field_intro_adv/fields.ts src/data/scenes/fields.ts
# src/data/scenes/index.ts: FIELD_REG 를 import 해 등록부 목록에 다시 넣는다
# src/main.ts 'start-run': app.run.pending.unshift(fieldIntroPending(app.run)) (null 이면 넣지 않는다)
```
