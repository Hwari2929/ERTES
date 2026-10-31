# 시뮬레이터 · 검사 도구 (2026-10-31, 코드 기준)

빌드 · 검사 · 밸런스 시뮬레이션 · 측정 관례를 한곳에 모은다. 사실의 기준은 `package.json` · `tests/*` · `scripts/*` 이다.
봇 판단은 `docs/BOT_CHULSU.md` (맨 위 '지금 동작') · `docs/BOT_YOUNGHEE.md`, 에셋 도구는 `docs/ART_PIPELINE.md`.

## 목차

1. npm 스크립트
2. 검사 — `npm run check` · `npm run bot-regress`
3. 밸런스 시뮬레이터 `tests/balance.ts`
4. 밸런스 측정 관례
5. 집계 스크립트 (`tests/*.py`)
6. 그 밖의 시뮬 · 측정 도구

## 1. npm 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm run -s build` | `scripts/build.mjs`: `src/main.ts` 번들 → `dist/index.html` (오프라인 실행) · `dist/artifact.html` (아티팩트 게시용, 문서 뼈대 없음). `public/art` 를 `dist/art` 로 복사하고, 적 · 소환물 상반신(`en_*` · `sm_*` `.bust.webp`)을 `dist/art/busts-en.json` 하나로 묶는다 |
| `npm run -s offline` | build + `dist/ERRANTEs-offline.html` (그림 · 글꼴을 데이터 URI 로 내장한 단독 파일. 글꼴 조각은 `.cache/fonts` 에 보관) |
| `npm run -s typecheck` | `tsc --noEmit`. 작업 규칙의 확인 명령은 `npx tsc --noEmit -p .` |
| `npm run -s check` | 데이터 · 화면 · 규칙 검사 14종 (2절). 오래 걸린다 (제한 시간 900초 이상으로) |
| `npm run -s bot-regress` | 봇 회귀 테스트 (2절) |
| `npm run sim -- [런 수] [fields\|ult\|units]` | `tests/sim.ts` 헤드리스 시뮬 (단순 봇, 6절) |
| `npm run -s syn-doc` | `tests/syndoc.ts` → `docs/SYNERGY_TABLE.md` 다시 쓰기 |
| `npm run -s events-doc` | `tests/eventdoc.ts` → `docs/EVENTS.md` 다시 쓰기 (사건 일람, 손으로 고치지 않는다) |
| `npm run -s tut-doc` | `tests/tutorial_doc.ts` → `docs/TUTORIAL_SCRIPT.md` 다시 쓰기 (튜토리얼 대본 읽기용 사본, 원본 `src/data/scenes/tutorial.ts`) |
| `npm run -s banter` | `scripts/banter_build.mjs`: `docs/banter/*.md` → `src/data/bar/banter.gen.ts` |
| `npm run -s chulsu-profile` | 철수 기물 실측표 → `tests/chulsu/profile.gen.ts` |
| `npm run -s chulsu-augprofile` | 철수 증강 실측표 → `tests/chulsu/augprofile.gen.ts` (약 5분) |
| `npm run -s chulsu-synprofile` | 철수 시너지 실측표 → `tests/chulsu/synprofile.gen.ts` (약 3분) |
| `npm run -s css-baseline` | CSS 검사 기준 `tests/css_baseline.json` 갱신 (줄였을 때만) |
| `npm run -s map-metrics -- [표본 수] [--phase=2] [--rank=2] [--type=battle\|adversity] [--field=<전장>]` | 지형 틀 측정 (check 에 들어가지 않음, 6절) |

- `chulsu-*` 는 표준 출력을 `.gen.ts` 에 바로 덮어쓴다. 중간에 실패하면 파일이 잘리니 `git diff` 로 확인한다.
- 검사 · 시뮬 번들(`dist/*.cjs`)은 깃에 넣지 않는다 (`.gitignore`). 직접 번들할 때는 작업 폴더(scratchpad)로 내보내도 된다: `npx esbuild tests/<파일>.ts --bundle --platform=node --log-level=error --outfile=<폴더>/<이름>.cjs && node <폴더>/<이름>.cjs`.

## 2. 검사

### `npm run check` (실패하면 종료 코드 1)

| 순서 | 파일 | 보는 것 |
|---|---|---|
| 1 | `tests/codex_check.ts` | 도감: 데이터 표(장비 · 시너지 · 사이오닉 · 증강 · 전역 · 특권 · 축복 · 세계관)의 모든 항목이 도감 탭에 나오는지, 그린 글에 undefined · NaN 이 없는지, 세계관 연결 · 기물 참조 · 기물 한 줄 설명 |
| 2 | `tests/css_check.ts` | CSS 토큰: `:root` 밖 새 색 값, 옛 토큰 · 글자 크기 · 둥글기 · z-index 리터럴 · `!important` 가 기준(`tests/css_baseline.json`)보다 늘었는지, 정의 안 된 변수 |
| 3 | `tests/bar_check.ts` | 바 허브: 화자 · 후보 id, 슬롯, 인사 · 반응 · 화제 · 작별 · 혼잣말 분량, 무대 규칙 모의 실행 |
| 4 | `tests/motif_check.ts` | 인물별 표면 소재(말버릇 · 반복 개그) 사용 횟수가 기준 이하 (`--doc` 로 `docs/MOTIFS.md` 갱신) |
| 5 | `tests/number_check.ts` | 대사 · 서술의 수량 · 서수는 아라비아 숫자 (도우미 `python3 scripts/numfix.py [--apply] 파일…`) |
| 6 | `tests/lore_ext_check.ts` | `lore/인물/확장/*.md`: 문서 이름 · 원본 시트 경로 · 관계 표시 · 출처 문구가 실제 파일에 있는지 · 금지 설정 |
| 7 | `tests/achieve_check.ts` | 업적 데이터 · 숫자 표기 · 참조 · 판정 · 화면 조각 · 실효 위험 등급 |
| 8 | `tests/route_check.ts` | 분기 항로: 모든 길이 규칙(상점 1~2 · 상점 사이 2노드 이상 · 사건 1+ · 역경 1~3 · 보스 앞 전투 2~5)을 지키는지, 다음 노드 종류가 겹치지 않는지, 옛 저장(한 줄 항로) |
| 9 | `tests/squad_check.ts` | 적 분대: 인원 합 · 진형 · 포병 듀오 · 대형 적 · 공병단 · 묶음 적 |
| 10 | `tests/terrain_check.ts` | 지형 · 중립 구조물: 차단 · 우회 · 수문 · 물류망 지형(연결교 · 컨테이너 · 크레인 · 운반차), 전투 중 조작 없음 |
| 11 | `tests/deploy_check.ts` | 출전 명단 · 배치 칸 · 전투에 나오는 기물이 같은지 (모든 지형 틀 × 폭), 자리 부족 안전장치 |
| 12 | `tests/preview_check.ts` | 개전 예측이 장치 · 지형 틀 등 전투에 들어가는 값이 바뀌면 다시 계산되는지 |
| 13 | `tests/shop_check.ts` | 상점 · 상인: 진열 수 · 할인 · 새로고침 · 이자 · 지정 소집 티켓 · 고르곤 교환 · 만찬 백수정 |
| 14 | `tests/global_check.ts` | 전역 증강: 합친 증강이 안 나오는지, 고유 효과(경제 · 장비 · 기물 교체 · 전투 훅) 작동 |

기물 · 장비 · 시너지 · 증강 · 전공 · 성유물 · 적 · 데이터를 바꾸면 돌린다 (`CLAUDE.md`).

### `npm run bot-regress` (`tests/bot_regress.ts`, 종료 코드 0 = 통과)

| 절 | 보는 것 |
|---|---|
| 1–3 | 장비 운용 결함: 덤비가 결함을 재현하는지 (상황 구성 확인) · 라라가 고쳤는지 (보관함 인덱스, 해제 실패, 위험 7 분리 용제 보존) |
| 4 | 철수 장비 계획: 같은 상황에서 해제 결과 · id 재확인 · 실패 건너뛰기 |
| 5 | econ: 남길 크레딧 (이자 구간 · 체력 위험) · 함대 확장 우선 |
| 6 | recruit2 · aug: 반려 돌은 영입하지 않고, 있으면 방출 |
| 7 | 공정성: 사건 · 상점 평가는 복제 런에서만 굴리고 실제 런(런 난수 포함)을 바꾸지 않는다 |
| 8 | hard: 강제 징수기는 일반 전투에 1개뿐이면 아낀다 |
| 9 | syn3: 효과 없는 인원 구간은 가산 없음 · 인원을 늘리며 잃는 효과 |
| 10 | multi: 임계점 다중 교체 (완성 · 단독 후보) |
| 11 | boss: 보스가 벽이면 결승전 특집을 고르지 않는다 |
| 12 | 영희: 바닥 40 (함대 확장 · 지정 소집 · 공명도 · 상점 뒤), yh_last 마지막 페이즈, 여유 60 이면 상점 |

봇 코드(`tests/botlib.ts` · `tests/chulsu/*`)나 봇이 부르는 엔진 함수를 바꾸면 돌린다.

## 3. 밸런스 시뮬레이터 `tests/balance.ts`

봇이 런을 끝까지 돌리며 전투 · 기물 · 유형 상성 · 시너지 · 장비 · 경제 지표를 모은다. 게임 규칙은 바꾸지 않는다 (아래 '규칙 실험' 옵션만 그 실행 안에서 CFG 를 바꾼다).

```
npx esbuild tests/balance.ts --bundle --platform=node --log-level=error --outfile=<폴더>/bal.cjs
node <폴더>/bal.cjs <시작 시드> <런 수> [반사실 표본 비율] [위험 등급] [옵션 …] > part.json
```

| 위치 인자 | 기본 | 뜻 |
|---|---|---|
| 시작 시드 | 1 | 시드 `시작 … 시작 + 런 수 − 1` 을 차례로 |
| 런 수 | 10 | |
| 반사실 표본 비율 | 0.06 | 전투 중 이 비율을 골라 '활성 시너지를 하나씩 끈 전투'를 같은 시드로 다시 돌린다 (`agg.cf*`). 0 이면 끈다 |
| 위험 등급 | 0 | 쉬움 3 · 모험 6 · 고난 7. 2 이상이면 적 장비 · 개조부품이 붙고, 고난은 절망 증강을 고른다 |

### 옵션 (코드 `process.argv` 기준 전부)

| 묶음 | 옵션 | 뜻 |
|---|---|---|
| 봇 | `bot=dumbi\|rara\|chulsu\|chulsu-search\|younghee\|younghee-last` | 봇 고르기 (기본 dumbi). `docs/BOT_CHULSU.md` |
| | `chulsu=form,gear,…` | 철수 영역 (기본 `DEFAULT_AREAS`) |
| | `forcebuild=cmd\|guard\|med\|voyage\|time` | 철수 build 영역의 빌드 고정 (조건부 실험) |
| | `augoff=priv,desp,glob,unit,loot` · `bossoff=desp,place,reserve` | aug · boss 영역 일부만 끄기 (영역 안 효과 나눠 재기) |
| 시작 | `pool` | 실제 게임처럼 계약 후보(전장 우세 시너지 보장)에서 고른다. 없으면 시작 가능한 기물 전체에서 무작위 (옛 기록 비교용). 철수 start 영역은 이 후보 안에서 조합을 비교한다 |
| | `pool0` | pool 과 같되 우세 시너지 보장 없이 (`CFG.starterFav = 0`) |
| | `field=<전장 id>` | 전장 고정 |
| | `chr` · `fac=<세력 id>` | 그 세력 우선 봇 (시작 2명 · 영입 · 출전 · 지정 소집). `chr` = 청라공국 |
| 규칙 실험 | `hpadd=x` | 페이즈 체력 성장 계수에 x 를 더한다 |
| | `nodiffhp` | 난이도별 적 체력 성장 가산(`CFG.diffHpAdd`)을 끈다 |
| | `adv=1.2` | 역경 · 도전 강도 `CFG.adversityMult` |
| | `oath=grit:3,pain:2` · `oathfrom=3` | 절망 서약 설정 · 서약이 걸리는 위험 등급 낮추기 |
| | `cfgp1` · `cfgfront` | 보급 실험 `CFG.supply.p1` · `.front` 켜기. **p1 은 지금 기본으로 켜져 있어 `cfgp1` 은 효과 없음** |
| 선택 정책 | `advpol=<역경>:<도전>` | 역경 must · avoid · state · power, 도전 always · never · state · power (정책 난수는 봇 난수와 따로). 분기 항로에서는 '역경이 있으면 정책대로, 없으면 첫 선택지'로 고르므로 상점 · 보급 같은 서비스 노드 판단이 빠진다 |
| | `supply` | 갈림길 대기(`branch`)에서 첫 상점 뒤에 보급을 고른다. **갈림길 대기는 한 줄 항로에만 있어 지금 일반 런에서는 효과 없음** |
| | `globrand` | 전역 증강을 제시된 것 중 무작위로 (새로고침 없음) + 런마다 `gr` [페이즈, 제시, 고름] — 전역 증강 비교 (제시됐는데 안 고른 런이 대조군) |
| | `randrelic` | 디바인 성유물을 무작위 장착 (성유물 효과 분리) |
| | `fpriv=<id>` · `fdesp=<id>` · `fglob=<id>` | 첫 특권 · 출격 절망 증강 · 첫 항로 회의 전역 증강을 강제 (철수 실측 가치표 `tests/chulsu/tables.ts` 만들 때만) |
| 계측 | `instr` | 런마다 `trace` (전투별 승패 · 시간 · 시너지 · 적 fz · 아군 사망 ad · 밀수 loot · 분대 sq · 대형 적 bigd) · `ins` (조우 진입 상태 · 장비 현황 · 실패 사유 · 실행 시간 · 갈림길 br · 지도 칸 route · 상점 구매 buy · 전역 증강 · 기물 증강). 실행 오류도 `err` 로 남기고 다음 런으로 |
| | `detail` | 런마다 `det`: `<키>\|<페이즈>:<노드>` → [전투, 승] (키 `u:` 기물 · `a:` 증강 · `ua:` 기물×증강 · `i:` 장비 · `s:` 시너지\|단계 · `r:` · `ur:` 성유물). 군집 신뢰구간용 |
| | `gearlog` | 런마다 `gl`: 전투마다 [페이즈, 노드 첫 글자, 승, 출전 기물 장비 목록] (장비 · 제련 · 잠재능력 분석) |
| | `dlog` | 철수 판단 기록 `dlog` (econ · xp · muster · branch · shop · place · event 등) |
| | `advstudy` | 역경 계측: 같은 상태에서 일반전 / 역경 배수별 · 다른 시드 · 무작위 배치 · 앞뒤 뒤집기 · 장비 없음 재전투 (`adv` · `nb`) |

### 출력

- 표준 출력 = JSON 한 덩어리 `{ agg, runs }`. 표준 오류 = 25런마다 진행.
- `agg`: 합으로만 쌓은 표라 조각끼리 더하면 된다 — `unit` · `unit_ph` (기물), `ct` · `tt` (유형), `item` · `unit_item` (장비), `syn` · `syn_ph` (시너지 단계), `cf` · `cf_t` · `cf_ph` (반사실), `phase` · `node` · `death`, `offer` (영입 제시 · 선택), `cons` (소모품), `foegear` (instr, 적 장비), `psiaug` · `relic`, `mx_*` (공격자 · 대상 유형 상성).
- `runs[]`: `seed · starters · field · cleared · phase · battles · hp · eco (이자 · 수입 · 지출 · 페이즈별 전투 직전 크레딧) · despairs · bw (보스 / 그 밖 전투 · 승리)` + 옵션별 필드.

### 길 고르기 · 노드 처리

분기 항로에서 다음 노드는 `routePick` 이 고른다 (서비스 노드 → 봇 갈림길 점수, 그 밖은 역경 50% · 전투 > 사건). 노드별 행동은 `docs/BOT_CHULSU.md` 맨 위 표.

## 4. 밸런스 측정 관례

| 항목 | 관례 |
|---|---|
| 난이도 · 시작 | 고난 (위험 7) · `pool` |
| 시드 | 30001 부터. 500판 = 30001–30500, 2,000판 = 30001–32000. 보고서끼리 같은 시드라 판 단위로 비교된다 |
| 봇 | 철수 (`bot=chulsu`) · 영희 (`bot=younghee`) 각각 같은 시드로. 빠른 확인 500판, 보고서 2,000판 |
| 실행 | `node bal.cjs <시작> 125 0.06 7 bot=<봇> instr gearlog pool detail` 를 125판 조각으로 나눠 여러 프로세스로 (`xargs -P`) — v411 · v457 과 같은 설정. 조각 파일은 작업 폴더에 |
| 기준 커밋 비교 | 바꾸기 직전 커밋을 따로 꺼내 (예: 임시 워크트리) 같은 명령 · 같은 시드로 돌린다. 시드마다 성공 / 실패를 맞대어 '기준만 성공 / 이번만 성공' 수와 클리어 차를 낸다. 예: v457 은 개편 직전 `bf92f74` 를 30001–30750 (750판) |
| 계측 코드를 고칠 때 | 고치기 전 · 후 번들로 같은 시드 3판을 돌려 결과(클리어 · 페이즈 · 전투 수 · 체력 · 전투별 승패)가 같은지 먼저 확인한다 |
| 실행 실패 | `instr` 가 실패한 런을 `err` 로 남긴다. 보고서에 실행 실패 수를 적는다 (0 이어야 함) |

### lift

- **전투 lift (%p)** = 그 요소(기물 · 장비 · 증강 · 시너지 단계 · 적 · 성향 · 분대 …)가 있는 전투의 승률 − 같은 **페이즈 × 노드 종류**(일반 · 역경 · 도전 · 보스) 평균 승률. 적 · 전장 분석은 **전장 × 페이즈 × 노드** 평균을 뺀다. 초반 전투일수록 이기기 쉬운 효과를 걷어 낸 값이다.
- **런 lift** = 그 요소가 있는 런과 없는 런의 클리어 차.
- 오차: 런 군집 95% (같은 런의 전투를 한 묶음으로). 표본 기준(예: 300전 이상)을 표 머리에 적는다.
- 봇이 고른 요소는 '좋은 판에 자주 들어가는' 편향이 남는다 — 두 봇이 같은 부호일 때 믿는다. 고르기 편향 없이 보려면 무작위 실험(`globrand` · `randrelic` · `fpriv=` 등)을 쓴다.

### 보고서

- 이름: `docs/BALANCE_<YYYY_MM_DD>_v<빌드 번호>.md` + 원자료 `docs/balance_<yyyy_mm_dd>_v<빌드 번호>.json` (예: `BALANCE_2026_10_30_v457.md` · `balance_2026_10_30_v457.json`). 빌드 번호 = 측정 기준 커밋의 아티팩트 빌드 번호 (`git log --oneline | grep "아티팩트 v"`).
- 머리: 측정 기준 커밋 · 이번 개편 내용 · 직전 보고 뒤 들어간 다른 변경 · 표본(실행 명령 그대로, 실행 실패 수) · 원자료 json 의 키 · 집계 스크립트 위치. 제목에 '측정만 · 게임 수치 변경 없음'.
- 1쪽 요약 → 페이즈별 · 전장 · 기물 · 장비 · 증강 · 경제 → 제안 (측정만) → 다음에 볼 것.
- 보고서는 기록 문서다. 규칙이 바뀌어도 고치지 않고 새 보고서를 쓴다.
- 최근 보고서의 집계 스크립트(`rep2k_v457/an.py` 등)는 작업 폴더에만 있었다. 다시 쓸 집계는 `tests/*.py` 로 넣는다.

## 5. 집계 스크립트 (`tests/*.py`)

| 파일 | 입력 → 출력 |
|---|---|
| `balance_report.py` | `part*.json` + `meta.json` → 지표 json (`docs/BALANCE_REPORT.md` 재료) |
| `balance_tables.py` | `docs/balance_report.json` → 표 다시 그리기 |
| `balance_summary.py` | detail 출력 → 신뢰구간 포함 시너지 · 기물 · 장비 · 유형 표 |
| `detail_report.py` | detail 출력 (일반 · 성유물 무작위) → 페이즈 보정 승률 차 · 군집 95% |
| `balance_chulsu2000.py` | 조각 + 이름표 (`tests/chulsu2000_names.ts`) → `docs/BALANCE_CHULSU_2000.md` 재료 |
| `balance_chulsu_route.py` | 경로 · 자산 · 상점 구매 집계, `compare` 모드 = 여러 봇 짝 비교 (`docs/BOT_YOUNGHEE.md`) |
| `balance_synergy_lift.py` · `balance_synergy_compare.py` | 시너지 단계별 lift · 두 봇 비교 (`docs/BALANCE_SYNERGY_LIFT.md`) |
| `balance_adversity.py` | `advstudy` · `advpol=` 결과 → `docs/BALANCE_ADVERSITY.md` 재료 |
| `balance_experiments.py` | 단일 변경 실험 → `docs/balance_experiments.json` |
| `analyze_report.py` · `analyze_events.py` · `probe2_report.py` | `tests/analyze.ts` · `tests/probe2.ts` 출력 집계 (옛 측정) |

이름표: `tests/chulsu2000_names.ts` (기물 · 시너지 · 장비 · 증강 · 적 이름 JSON), `tests/balance_meta.ts` · `tests/detail_meta.ts`.

## 6. 그 밖의 시뮬 · 측정 도구

| 파일 | 하는 일 · 실행 |
|---|---|
| `tests/sim.ts` | 단순 봇 헤드리스 시뮬. `npm run sim -- 40` (도달 페이즈 · 승률), `… 40 fields` (전장별), `… 40 ult` (궁극기 · 신권 대행 계측, `SIM_ULTGAIN` 환경 변수), `… 40 units` (기물별). `fields` 출력의 'P6 · P7' 열은 6페이즈 시절 그대로다 |
| `tests/map_metrics.ts` | 지형 틀 × 편성 유형별 승률 · 전투 시간 · 첫 공격 · 시간 몫 · 소환 실패 (같은 표본 번호 = 같은 편성 · 시드) |
| `tests/despair_sim.ts` | 절망 증강을 강제로 걸어 의뢰 성공률 비교 (공통 난수). 머리 설명의 '6페이즈 보스'는 옛 문구 — 성공 판정은 `run.cleared` |
| `tests/campaign_sim.ts` | 캠페인 「회수 계약」 1~4장 자동 진행 (흐름 오류 · 승률 · 보스 시도 · 남은 AH) |
| `tests/report_base.ts` | 전투 종료 보고서 예상치 기준선 (`src/engine/report.ts EXPECT`) |
| `tests/enemy_stats.ts` · `tests/chulsu2000_foeprobe.ts` | 페이즈별 적 능력치 분포 · 위험 등급별 적 장비 풀 (전투 없이) |
| `tests/psi_probe.ts` · `tests/psi_combo_sim.ts` · `tests/psi_cantrip_check.ts` | 사이오닉 적중 · 역할 · 학파 조합 기여 · 비술 검사 |
| `tests/buildsim.ts` | 빌드 가이드용 조합 시뮬 (`docs/BUILD_GUIDE.md`) |
| `tests/analyze.ts` · `tests/probe2.ts` | 옛 계측 시뮬 (지금 측정은 `balance.ts`) |
| `tests/turret_pick_check.ts` · `tests/augtext_check.ts` · `tests/scenes_check.ts` · `tests/syn_overlap.ts` | 수동 검사: 포탑 장비 고르기 · 증강 설명 숫자 · 사건 연출 · 시너지 구성 겹침 |
| `tests/scenes_export.ts` | 사건 · 연출 JSON 내보내기 |
