# ERRANTEs

은하 용병단 오토배틀러. 싱글 PvE · 증강 도파민 MAX.

## 플레이
`dist/index.html` 을 브라우저로 열면 끝입니다 (오프라인 OK, 파일 하나).
진행은 브라우저에 자동 저장되고, 메뉴에서 슬롯 저장 / 저장 코드 내보내기·불러오기를 할 수 있습니다.

## 개발
```bash
npm install
npm run build      # dist/index.html (오프라인용), dist/artifact.html (아티팩트 게시용)
npm run typecheck
npm run sim -- 40  # 헤드리스 밸런스 시뮬레이션 (봇 40판)
```

## 구조
| 경로 | 내용 |
|---|---|
| `src/config.ts` | 밸런스 수치 전부 (`[임시]` = 확정 전 기본값) |
| `src/engine/combat.ts` | 전투 시뮬레이션 (명중/찰과상, 방어도, 속성, 증가/증폭, 상태이상) |
| `src/engine/build.ts` | 기물 → 전투 유닛 변환, 스탯 계산, 시너지 집계 |
| `src/engine/run.ts` | 런 진행: 노드, 보상, 공명도, 증강 추첨, 상점, 퀘스트 |
| `src/data/` | 기물 10종, 적, 시너지 8종, 증강, 장비, 전역 증강 |
| `src/ui/` | 화면, 전투 연출, 도트 스프라이트, 저장 |
| `tests/sim.ts` | 밸런스 시뮬레이션 봇 |
| `docs/GDD.md` | 기획 정리 (확정 / 임시 구분, 시뮬레이션 결과, 미정 항목) |
