# 마스크 붓 (`tools/mask-paint.html`)

자동으로 오리기 어려운 그림(배경과 색이 비슷한 소매, 손밑에 그려진 종이, 층을 나눠야 하는 손가락 등)을
사용자가 휴대폰 · PC 에서 붓으로 칠해 마스크를 만들고, Claude 가 그 마스크를 그대로 적용하는 도구.
아티팩트로 게시해 쓴다 (저장소 `db` + 내려받기 `downloads`).

## 쓰는 법 (사용자)

- 위 줄: **층** 고르기 (첫 층 = 남길 곳, 나머지 = 따로 뺄 층) · **보기** (편집 / 칠한 곳만 / 나머지만) · **저장**
- 아래 줄: **붓 | 이동 · 확대** (붓 모드에서는 한 손가락 = 칠하기만, 이동 모드에서는 한 손가락 끌기 = 이동 · 두 손가락 = 확대),
  **칠하기 | 지우기**, 붓 크기, 되돌리기(획 단위), 맞추기, 바탕 색 (칠한 곳만 · 나머지만 볼 때)
- 편집 보기: 첫 층 밖은 어둡게(지워질 곳), 나머지 층은 각자 색으로 덮인다.
- PC 단축키: `X` 칠하기 ↔ 지우기 · 오른쪽 버튼 = 지우기 · `V` 붓 ↔ 이동 · `[` `]` 크기 · 휠 확대 · `Space`+끌기 이동 · `1`~`9` 층 · `Ctrl+Z` · `F`

## 새 작업 (Claude)

1. 원본을 webp 로 만든다 (그대로의 원본 — 지울 것까지 보이게).
2. `tools/mask-paint.html` 맨 위 `<script id="cfg">` 의 `name` (저장 문서 = `masks/<name>`) · `src` (원본 파일 이름) · `layers` (층 키 · 이름 · 색, 남길 곳은 `"keep": true`) 를 작업에 맞게 바꾼다.
3. 게시: `Artifact` publish, `file_path` = 이 파일, `files` = `{ "<src>": "<원본 webp 경로>" }`, `capabilities` = `{ "db": {}, "downloads": true }`.
   같은 아티팩트를 다른 작업에 다시 쓰려면 `url` 을 주고 `files` 로 원본만 바꾼다 (문서 이름이 다르면 마스크가 섞이지 않는다).
4. 처음 값(자동 추출본)이 있으면 `ArtifactData` set 으로 `masks/<name>` 에 넣는다: `{ w, h, <층 키>: "data:image/png;base64,..." (흰색 + 알파) }`.
5. 사용자가 저장하면 `ArtifactData` get (`out_dir` 로 파일로 받기) → `python3 scripts/mask_apply.py <원본> <문서.json> <출력 폴더> --keep <남길 층> --under <뺄 층,...>`.

## 기록

- 2026-10: 에이든 손 (`name: hand`, 층 `hand` 남길 곳 · `thumb` 영수증 밑). 원본 = HAND I 를 1.5배 캔버스 확장한 EXT 4 (`art/raw/prop/ad_hand_i_x/4283987270.png`).
  아티팩트: https://claude.ai/artifact/N8M4AcpapsWJjdEsQ7Atwc
