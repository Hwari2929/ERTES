# ERRANTEs 작업 규칙

- 답변은 한국어로.
- 변경 후 항상 `npm run -s build` · `npx tsc --noEmit -p .` 통과를 확인한다.

## 도감 연동
- 도감(codexScreen · src/ui/codex2.ts)은 데이터 표(기물 · 장비 · 시너지 · 증강 · 전공 · 성유물 · 전역 증강 등)를 **그릴 때마다 직접 읽어서** 보여 준다. 도감에 이름 · 수치 · 설명을 따로 베껴 적지 않는다.
- 기물 · 장비 · 시너지 · 증강 · 전공 · 성유물을 추가 · 수정 · 삭제하면 `npm run check` (도감 누락 · undefined · NaN 검사)를 돌려 통과시킨다. 능력 문구(src/data/abiltext.ts · src/data/abil/*.ts · brief.ts)도 함께 맞춘다.

## 에셋
- 배경 · 스탠딩 일러스트는 넣기 전에 반드시 사용자 확인을 받는다 (시안을 보여 주고 고르게 한다).
- 능력 아이콘: art/icon_prompts.json → scripts/nai_icon.mjs → art/icons/raw → `python3 scripts/icons_build.py` → src/ui/abilicons.gen.ts. 다시 뽑을 때는 프롬프트를 바꾼 시안 3개를 보여 준다. 물리 계열 스킬 · 무기는 흰 배경(light).

## 사건 연출
- docs/SCENES.md 의 3차 지침과 docs/VOICES.md 를 따른다. 사건 속 지휘관({pc}) = 레이첼.
- 에란테스 바는 지상의 실제 바이고, 함대 · 함선은 별개다.
