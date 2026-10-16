# 상호작용 대사 (BANTER)

기물끼리 주고받는 짧은 만담 모음 (661편, 57기 전원 13회 이상 등장). 에란테스 바 허브(src/ui/bar.ts)에서 쓴다 (`npm run banter` 로 src/data/bar/banter.gen.ts 생성). 같은 개그가 여러 편에 반복되면 하나만 남긴다 (2차 정리: 스콜치 / 지르곤 / 땅콩버터 범인 / 부계정 / 점검구 미사일 중복 6편 삭제).

- 말투는 `docs/VOICES.md`, 연출 원칙은 `docs/SCENES.md` 3차 지침을 따른다. 코미디 우선, 2~4줄, 경구 · 로어 낭독 금지.
- 지휘관 = 레이첼. 에란테스 바는 **지상의 진짜 바**이고, 함대 · 함선은 따로다 (함선 안 술자리는 식당 · 휴게실).
- 아문센은 지휘하지 않는다 (참견 · 옛날 얘기만). 은퇴 여부도 확정하지 않는다.
- 엘베스타드 본가 식구(시그문드 · 구닐라 · 라스무스 · 밍키)가 함선 · 바에 있으면 상황 줄에 따라온 이유를 깐다.
- 카일 = 로마니가 찾는 가주인지, 카부라야 = 레이카 0호인지, 마오의 실물은 확정하지 않는다.

형식: `**A × B** — 상황 한 줄` 다음 줄부터 `A: …`. 화자 이름은 기물 이름 (망명 혈족 귀공자 = 귀공자, 오닉스 감응자 = 오닉스, 테르모필레 = 테르모필레).

## 주제별 파일

| 파일 | 주제 |
|---|---|
| [banter/01_deploy.md](banter/01_deploy.md) | 배치 직전 · 셔틀 강하 |
| [banter/02_victory.md](banter/02_victory.md) | 전투 승리 후 · 패배 후 |
| [banter/03_supply.md](banter/03_supply.md) | 상점 · 보급 · 정산 |
| [banter/04_bar.md](banter/04_bar.md) | 에란테스 바 당직 |
| [banter/05_travel.md](banter/05_travel.md) | 이동 중 (함선 · 셔틀) |
| [banter/06_chat.md](banter/06_chat.md) | 잡담 |
| [banter/07_elvestad.md](banter/07_elvestad.md) | 엘베스타드 일가 |
| [banter/08_staff.md](banter/08_staff.md) | 참모진 · 작전반 · 의무실 |
| [banter/09_factions.md](banter/09_factions.md) | 세력별 (페트라 · 호이슌 · 연합 · 성도회 · 동맹) |
| [banter/10_oddcouple.md](banter/10_oddcouple.md) | 이상한 조합 |
| [banter/11_hobbies.md](banter/11_hobbies.md) | 취미 · 쉬는 날 |
| [banter/12_inbattle.md](banter/12_inbattle.md) | 전투 중 한마디 (2줄) |
| [banter/13_shiplife.md](banter/13_shiplife.md) | 함선 생활 |
| [banter/14_groups.md](banter/14_groups.md) | 셋 이상 (단체) |
| [banter/15_fields.md](banter/15_fields.md) | 전장 환경 (설원 · 사막 · 해양 · 폐광 · 도시 · 우주 · 정글) |
| [banter/16_days.md](banter/16_days.md) | 정장의 날 · 검진 · 생일 · 연말 · 휴무 |
| [banter/17_missions.md](banter/17_missions.md) | 의뢰 현장 (호위 · 잠입 · 구조 · 협상 · 회수 · 수송) |
| [banter/18_firstmeet.md](banter/18_firstmeet.md) | 첫 만남 (영입 직후) |
| [banter/19_latenight.md](banter/19_latenight.md) | 심야 · 술자리 |
| [banter/20_rivals.md](banter/20_rivals.md) | 티격태격 연작 (반복 개그) |
| [banter/21_shopquick.md](banter/21_shopquick.md) | 상점 한마디 (영입 · 새로고침 · 판매) |

## 층 · 끼어들기 만담 (바 허브 2차)

- 만담마다 층 태그가 붙는다 (`scripts/banter_build.mjs` 의 `LAYER_FIX`): 표면(말버릇 · 소재) · 이상(가치 · 입장) · 실재(상처 · 기제). 기존 만담은 거의 다 표면이다. 이상 · 실재는 키워드가 잘못 걸리기 쉬워 수동으로만 올린다.
- 새 만담은 `src/data/bar/frames*.ts` 의 '핵심 틀 + 끼어들기 슬롯' 구조로 쓴다: 핵심 두 인물의 대화 사이 `@0` 자리에, 그때 바에 있는 세 번째 단원의 대사가 들어간다 (후보 5~7명, 없으면 건너뜀). 주제는 뜬금없는 소리 · 요즘 유행 · 시사 · 진지한 토론.
- 실재 층은 노출의 약 10%, 심야 장면이며, 그 인물과 가까워진 뒤에 열린다 (바에서 말 건 횟수 + 함께 출전한 런 수 ≥ 6). 고백하지 말고 docs/VOICES.md '새어 나오는 방식'으로 쓴다.
- 소재 반복은 `npm run check` 의 소재 검사가 경고한다 (docs/MOTIFS.md).
