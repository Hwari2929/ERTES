// 교범: 튜토리얼에서 가르치는 용어 모음 (도감 · 교범 탭). 수치는 config.ts · run.ts · combat.ts 기준.
// key = 이 항목을 여는 튜토리얼 장면 · 안내 키 (TUTORIAL_FLOW). 튜토리얼을 끝내거나 건너뛰면 전부 열린다.
import { CFG, encDmgMult } from '../config';
import { DIFF_PRESETS, diffName } from './difficulty';
import { DESPAIRS } from './despair';
import { controlNames, RELOAD_RESET_LABEL, zocRule } from '../engine/combat';

export interface GlossEntry { id: string; term: string; text: string; key: string }
export interface GlossChapter { ch: string; title: string; who: string; entries: GlossEntry[] }
/** 비율 → '25%' */
const pc = (v: number) => `${Math.round(v * 100)}%`;
/** 비율 포인트 → '4.8%p' */
const pp = (v: number) => `${+(v * 100).toFixed(1)}%p`;

export const GLOSSARY: GlossChapter[] = [
  {
    ch: 'pro', title: '서장 — 당직 근무', who: 'aiden', entries: [
      { id: 'adv', term: '장면 넘기기', key: 'prologue', text: '대사창을 누르거나 Space · Enter 로 다음 줄로 넘어간다. [로그]는 지난 대사, [자동]은 저절로 넘기기, [건너뛰기]는 장면 전체를 넘긴다.' },
    ],
  },
  {
    ch: 'ch1', title: '1장 — 전투 기초', who: 'aiden', entries: [
      { id: 'place', term: '배치 · 출전 인원', key: 'ch1_place', text: '전투 준비 화면에서 보드 아래쪽 세 줄(아군 진영)에 기물을 끌어다 세운다. 근접은 앞줄, 원거리는 뒷줄이 기본이고 자동 배치(단축키 A)도 있다. 한 번에 세울 수 있는 인원은 기본 4명이며, 대기석의 기물은 공명도를 절반 비율로 받는다.' },
      { id: 'auto', term: '자동 전투', key: 'ch1_battle', text: '전투가 시작되면 기물이 스스로 움직이고 공격하고 기술을 쓴다. 지휘관이 하는 일은 배치까지. 전투 중에는 배속(0.25~8배, 단축키 1~6)과 일시정지(Space)만 조절한다.' },
      { id: 'attack', term: '사격 · 타격', key: 'ch1_battle', text: `기본 공격은 무기에 따라 사격 아니면 타격. 사격(탄창형)은 탄창을 다 쓰면 재장전하고, 타격(콤보형)은 정해진 횟수마다 피니쉬로 ${CFG.finishMult}배 피해를 준다. 재장전 중에는 기본 공격도 기술도 쓰지 않는다 — 기술 쿨다운은 계속 돌다가, 재장전이 끝나는 순간 기술부터 나간다 (궁극기 · 비술은 재장전과 상관없다).` },
      { id: 'move', term: '이동 속도 · 기동력', key: 'ch1_battle', text: `한 칸을 옮기는 데 ${CFG.moveTime}초 ÷ 이동 속도가 걸린다. 아군 기물의 기본 이동 속도는 ${pc(CFG.unitMoveSpd)}이고 기동력 1당 +${pp(CFG.conv.agi.moveSpd)}. 적은 기본 ${pc(CFG.enemyMoveSpd.base)} × 적마다 정해진 이동 배율 (날랜 적은 높고 굼뜬 적은 낮다)에 기동력 1당 같은 +${pp(CFG.conv.agi.moveSpd)}를 더한다. 암살형 성향의 적만 기본이 ${pc(CFG.enemyMoveSpd.assassin)} × 이동 배율이라 훨씬 빨리 파고든다.` },
      { id: 'skill', term: '기술 · 쿨다운', key: 'ch1_battle', text: '기술은 쿨다운이 다 차면 저절로 나간다. 마나 같은 자원은 없다. 쿨다운 감소 속도가 높을수록 자주 쓴다.' },
      { id: 'prov', term: '도발 수치 · 적 성향', key: 'ch1_battle', text: '적은 아군마다 도발 수치를 기억한다. 그 적에게 준 피해에 비례해 오르고, 회복 · 보호막을 쓰면 주변 적에게 조금 오르며, 시간이 지나면 조금씩 줄어든다. 적은 0.75초마다 도발 수치가 가장 높은 대상을 다시 고르되, 지금 대상보다 1.3배 이상 높아야 갈아탄다. 기물마다 도발 배율이 있다 (돌격가 3 · 수호자 시너지가 켜지면 +1.5 · 그 밖 1.0, 은신 · 침투자 기습 중 ×0.3). 적 성향이 여기에 가중치를 곱한다: 돌격형은 가까운 대상, 암살형은 체력이 낮거나 뒷줄인 대상, 저격형은 피해를 많이 준 대상, 반격형은 동료 적을 때린 대상. [도발] 상태는 도발 수치를 크게 올리고 잠시 표적을 고정시킨다.' },
      { id: 'hpbar', term: '체력 바 · 피해 측정표', key: 'ch1_battle', text: '머리 위 막대가 체력, 흰 막대는 보호막. 체력이 바닥난 기물은 그 전투에서 빠진다. 왼쪽 측정표는 준 피해 · 받은 피해 · 회복과 보호막 · 결정타를 기물별로 보여 준다.' },
      { id: 'overtime', term: '연장전 · 시간 제한', key: 'ch1_after', text: '적을 모두 쓰러뜨리면 승리. 45초부터 연장전으로, 양쪽 모두 1초마다 주는 피해가 10%씩 커진다. 75초 안에 끝내지 못하면 패배.' },
    ],
  },
  {
    ch: 'ch1b', title: '1장 — 상성과 전투 유형', who: 'aiden', entries: [
      { id: 'elem', term: '속성', key: 'ch1b_intro', text: '피해에는 물리 · 화학 · 전기 · 정신 · 신성 · 고정 속성이 있다. 방어도는 물리를 온전히, 화학 · 전기 · 신성은 절반만 막고, 정신과 고정은 막지 못한다.' },
      { id: 'bounce', term: '바운스', key: 'ch1b_intro', text: '피해가 맞은 적에서 정해진 칸 안의 다른 적에게 차례로 옮겨 가며 다시 맞히는 것. 기물 · 시너지 · 장비 설명은 "n% 계수의 OO 속성 피해가 n칸 내의 적에게 최대 n회 바운스된다" 꼴로 적는다. 바로 직전에 맞은 적에게는 다시 가지 않는다.' },
      { id: 'armor', term: '방어도', key: 'ch1b_intro', text: '받는 피해를 줄이는 수치. 피해 × (1 − 방어도 ÷ (방어도 + 3200)), 즉 3200이면 절반. 높을수록 효과가 점점 둔해지고, 방어도 관통으로 일부를 무시할 수 있다.' },
      { id: 'category', term: '분류 (생체 · 기계 · 영혼 · 구조물)', key: 'ch1b_detail', text: '생체는 화학 피해 1.5배, 기계는 전기 1.5배 · 정신 0.25배, 영혼은 물리 0.6배 · 신성 1.5배. 구조물은 움직이지 않고 방어도 1.3배, 기절 · 공포 · 빙결이 듣지 않는다.' },
      { id: 'control', term: '제어 효과 · 재장전 초기화', key: 'ch1b_detail', text: `${controlNames()}은 행동을 막는 제어 효과다. 제어 효과가 걸려 있는 동안에는 재장전이 멈추고, 재장전 중에 적의 제어 효과를 받으면 재장전이 처음으로 돌아가 제어가 풀린 뒤 처음부터 다시 한다 (머리 위에 '${RELOAD_RESET_LABEL}'). 둔화 · 속박 · 매혹 · 혼란처럼 행동 자체를 막지 않는 효과는 해당하지 않는다.` },
      { id: 'ctype', term: '전투 유형', key: 'ch1b_intro', text: '싸우는 방식. 돌격가(근접 타격 · 피니쉬 · 경계), 명사수(사격 · 체력 비율이 가장 낮은 적을 노림), 전문가(기술 위력 · 효과 명중), 지휘관(출전 인원이 많을수록 커지는 전술 위력으로 기술).' },
      { id: 'zoc', term: '돌격가 경계', key: 'ch1b_intro', text: zocRule() },
      { id: 'detail', term: '상세 보기', key: 'ch1b_detail', text: '기물이나 적을 누르면 상세가 열린다. 돋보기(상세 보기, 단축키 D)를 켜면 계수와 세부 규칙까지 보인다.' },
    ],
  },
  {
    ch: 'ch2', title: '2장 — 경제', who: 'lindiwe', entries: [
      { id: 'credit', term: '에너지 크레딧', key: 'ch2_intro', text: '용병단의 돈. 전투가 끝날 때마다 들어온다. 승리 보수는 페이즈에 따라 3~5 (역경 1.5배, 보스 +5), 져도 위로금 2.' },
      { id: 'interest', term: '이자', key: 'ch2_intro', text: '전투 정산 때 그 전에 들고 있던 크레딧 10마다 1씩 더 받는다. 기본 상한 5. 안 쓰고 모아 두는 것도 투자다.' },
      { id: 'streak', term: '연승', key: 'ch2_intro', text: '연달아 이기면 보너스: 2연승부터 +1, 4연승 +2, 6연승 +3. 한 번 지면 처음부터.' },
      { id: 'php', term: '플레이어 체력', key: 'ch2_intro', text: '화면 위쪽 하트, 용병단이 버틸 수 있는 힘. 전투에서 지면 3 + 2 × 페이즈 + 살아남은 적 수만큼 깎인다 (보스전은 10 + 3 × 페이즈). 0이 되면 의뢰 실패.' },
      { id: 'resonance', term: '공명도 · 공명 등급', key: 'ch2_xp', text: '공명도는 전투마다 파티 전체가 나눠 받는 경험치. 다음 등급까지 2 + 2 × 등급만큼 모이면 공명 등급이 오르고, 오를 때마다 모든 주요 능력치 +1. 기물 상세의 [경험치]로 4크레딧에 공명도 4를 살 수도 있다.' },
      { id: 'fleet', term: '함대 확장', key: 'ch2_xp', text: '지도의 함선 관리에서 출전 인원을 1명 늘린다. 첫 확장은 20크레딧, 이후 40 · 56 · 72 … 점점 비싸진다 (최대 14명).' },
      { id: 'supply', term: '보급', key: 'ch2_supply', text: '보급품 셋 중 하나를 고른다. 장비 재료 + 크레딧, 크레딧 묶음, 공명도 분배, 플레이어 체력 회복 같은 것들.' },
      { id: 'shop', term: '상점', key: 'ch2_shop', text: `재료 장비 ${CFG.drop.shopParts}개는 늘 진열되고 희귀 · 고급 · 전설은 확률로 나온다 (${CFG.shop.gearFrom}페이즈부터는 고급 · 희귀 중 1개 이상 확정). 가끔 소모품, 드물게 문장도 들어온다. 기본가 재료 ${CFG.price.C} · 고급과 희귀 ${CFG.price.G} · 전설 ${CFG.price.L} · 문장 ${CFG.shop.price.emblem}, 전장에 따라 달라진다. 팔면 재료 ${CFG.sell.C} · 고급과 희귀 ${CFG.sell.G} · 소모품 ${CFG.sell.K}.` },
      { id: 'cons', term: '소모품', key: 'ch2_shop', text: `보관함의 육각형 칸. 쓸 곳에 끌어다 놓으면 한 번 쓰고 사라진다: 기물(공명 주입기 소형 +${CFG.inject.amount.K_xp} · 중형 +${CFG.inject.amount.K_xp2} · 대형 +${CFG.inject.amount.K_xp3} 공명도, 분리 용제 · 재구성 회로), 편성 화면의 적(강제 징수기), 또는 [사용] 단추(갓 구운 빵 — 전투 ${CFG.chef.staleAfter}회 뒤 식으면 회복 −${CFG.chef.staleHeal}). 주입기는 ${CFG.inject.from.K_xp2}페이즈부터 중형, ${CFG.inject.from.K_xp3}페이즈부터 대형이 나오고 ${CFG.inject.smallTo + 1}페이즈부터는 소형이 나오지 않는다. 금색 테두리는 전설급이다. 전투 승리 보상 · 상점에서 얻는다.` },
    ],
  },
  {
    ch: 'ch3', title: '3장 — 시너지 · 장비', who: 'yelena', entries: [
      { id: 'synergy', term: '시너지 (세력 · 특성)', key: 'ch3_intro', text: '어디 소속인지가 세력, 어떤 사람인지가 특성. 같은 시너지를 가진 기물이 함께 출전하면 효과가 켜지고, 인원이 단계 기준에 닿을 때마다 강해진다. 마름모를 누르면 단계별 효과가 나온다.' },
      { id: 'emblem', term: '문장', key: 'ch3_emblem', text: '개조부품 칸에 다는 소속 증명서. 단 기물이 그 시너지에 한 명 더 있는 것으로 친다. 이미 소속된 시너지의 문장은 달 수 없다.' },
      { id: 'gear', term: '장비 칸 · 추천 장비', key: 'ch3_equip', text: '기물마다 장비 3칸과 개조부품 1칸. 보관함에서 기물에게 끌어다 놓으면 장착되고, 고유 장비가 아니면 언제든 바꿔 낄 수 있다. [추천 장비]는 전투 유형에 어울리는 희귀 장비와 재료 · 보유 현황을 보여 준다.' },
      { id: 'combine', term: '장비 조합', key: 'ch3_equip', text: '재료(주요 능력치 +3) 둘을 합친다. 같은 재료끼리는 고급(+12), 다른 재료끼리는 희귀(+6과 특수 효과). 재료를 단 기물에 재료를 더 주거나 보관함에서 겹치면 된다. 전설은 조합할 수 없다.' },
      { id: 'recruit', term: '영입', key: 'ch3_recruit', text: '보통 후보 셋 중 한 명을 고른다 (새로고침 1회). 새 동료는 출전 기물 평균 공명 등급의 70% 정도로 합류한다.' },
    ],
  },
  {
    ch: 'ch4', title: '4장 — 항로 · 적', who: 'franze', entries: [
      { id: 'phase', term: '페이즈 · 항로', key: 'ch4_map', text: `의뢰 하나는 ${CFG.victoryPhase}페이즈. 한 페이즈는 12칸이고 한 칸씩 밟아 간다. 마지막 칸의 보스전을 치르면 (지더라도) 다음 페이즈, ${CFG.victoryPhase}페이즈 보스를 이기면 의뢰 성공.` },
      { id: 'nodes', term: '노드 종류', key: 'ch4_map', text: '전투, 역경, 사건, 보급(갈림길: 상점 · 보급 · 모집, 은하 대스타가 있으면 속보도), 전환(짝수 페이즈: 휴식 · 도전), 보스. 항로 회의에서는 의뢰 내내 함대 전체에 적용되는 전역 증강 셋 중 하나를 고른다. 2페이즈부터는 페이즈마다 영입 기회가 열린다.' },
      { id: 'field', term: '전장 · 전장 조건', key: 'ch4_brief', text: '의뢰마다 싸우는 전장이 정해진다. 전장 조건은 모든 전투에 붙고(적 증가, 가격 상승 등), 힘을 받는 세력도 따로 있다. 지도의 환경 탭에서 언제든 다시 본다.' },
      { id: 'ttype', term: '전술 유형', key: 'ch4_intro', text: '성장 방식. 메이저(궁극기 · 4등급마다 메이저 증강), 마이너(3등급마다 주요 능력치 2종 +3 · 기술이 등급 따라 자람), 스페셜(합류 · 5 · 10 · 15등급 전용 증강), 사이오닉(전공 · 이성 · 4 · 8 · 12 · 16등급 전공 증강), 디바인(신앙 · 신성력 · 성유물). 증강끼리 배타는 없다: 비술 · 기술을 바꾸는 변형 증강도 다른 증강과 함께 작동한다.' },
      { id: 'psileg', term: '★ 전설 전공 증강', key: 'ch4_intro', text: `사이오닉의 전공 증강은 전공마다 기본 8종에 ★ 전설 2종이 더 있다. 전설은 학파의 규칙 자체를 비튼다 (초신성 · 시간 정지 · 포자 군락 등). 전공 증강 선택지 ${CFG.augmentChoices}장 중 1장이 전설로 섞일 확률은 ${pc(CFG.psiLegend.base)}이고, 전설 없이 고를 때마다 +${pc(CFG.psiLegend.pity)}p씩 오른다 (4번째 선택에서는 반드시 나온다). 전설을 한 번 얻으면 다시 ${pc(CFG.psiLegend.base)}. 전설 카드는 가장 화려한 공개 연출로 나오고, ◆ 변형 증강은 그보다 한 단계 아래로 나온다.` },
      { id: 'great', term: '능력치 대성공', key: 'ch4_intro', text: `마이너 기물의 능력치 보상(3등급마다)은 확정할 때 ${pc(CFG.greatChance)} 확률로 대성공한다. 대성공이면 화려한 연출과 함께 주요 능력치 ${CFG.rankPicks}종을 한 번 더 골라 각각 +${CFG.rankPoints} (같은 능력치를 다시 고르면 +${CFG.rankPoints * 2}, 상승량 2배).` },
      { id: 'reason', term: '이성 (사이오닉)', key: 'ch4_deploy', text: '사이오닉의 정신 수치. 50에서 시작해 기술과 행동에 따라 오르내리고, 0 밑으로 내려가면 매초 정신 피해를 받는다. 사이오닉은 합류할 때 학파의 전공을 하나 고른다. 학파마다 고이성 · 저이성 효과가 다르다 (인과학파 저이성은 기술 피해에도 치명타).' },
      { id: 'event', term: '사건', key: 'ch4_event', text: '이야기를 읽고 끝에서 선택지를 고른다. 선택지 아래 작은 글씨가 효과이며, 회색 선택지는 조건이 모자란 것이고 이유가 함께 적힌다.' },
      { id: 'adversity', term: '역경', key: 'ch4_adversity', text: `적 체력 ${CFG.adversityMult}배 · 피해 ${+encDmgMult(CFG.adversityMult).toFixed(2)}배에 정예가 반드시 섞인다. 대신 크레딧과 공명도 보상은 ${CFG.adversityReward}배이고, 이기면 무작위 장비 재료 ${CFG.drop.advParts}개가 확정으로 나온다.` },
      { id: 'boss', term: '정예 · 보스', key: 'ch4_boss', text: `정예는 체력이 많은 강적. 보스는 페이즈 마지막 칸의 우두머리로 호위를 거느린다. 보스에게 지면 체력이 크게 깎이지만 다음 페이즈로는 넘어간다. 의뢰의 마지막 보스(${CFG.victoryPhase}페이즈)만은 이길 때까지 다시 싸운다.` },
    ],
  },
  {
    ch: 'epi', title: '종장 — 본편', who: 'aiden', entries: [
      { id: 'diff', term: '새 계약 · 위험 등급', key: 'epilogue', text: `새 계약은 출격에 응한 후보 여덟 명 중 넷을 골라 시작한다. 위험 등급이 오를수록 적이 강해지고 조건이 붙는 대신 승리 보수도 늘어난다. 출격 화면에서는 ${DIFF_PRESETS.map((x) => `${x.name}(위험 ${x.lvl})`).join(' · ')} 중에서 고른다. ${CFG.diffAdd.map(([l]) => diffName(l) || `위험 ${l}`).join(' · ')} 등급에서는 페이즈가 지날수록 모든 전투의 적 수도 늘어나고 (${CFG.diffAdd.map(([l, k]) => `위험 ${l}부터 ${k}페이즈마다 +1`).join(' · ')}), ${diffName(CFG.despair.from) || `위험 ${CFG.despair.from}`} 등급은 절망 증강까지 짊어진다.` },
      { id: 'privilege', term: '특권 증강', key: 'epilogue', text: '출격 직전에 고르는 이번 의뢰 한정 특권 (새로고침 3회). 문장 · 추가 영입 · 전역 증강 · 후원금 · 체력 · 공명 등급 같은 것들.' },
      { id: 'despair', term: '절망 증강', key: 'epilogue', text: `${diffName(CFG.despair.from) || `위험 ${CFG.despair.from}`} 의뢰의 대가. 출격 때 특권 증강 다음에 ${CFG.despair.choices}개 중 1개를 반드시 고르고, ${CFG.despair.every}페이즈마다 1개씩 더 고른다 (고를 때마다 새로고침 ${CFG.despair.rerolls}회). 고른 디버프는 의뢰 내내 쌓여서 걸리고, 같은 증강은 다시 나오지 않는다. 상단 바의 붉은 표시를 누르거나 지도 [환경] 탭에서 효과를 다시 볼 수 있다. ${DESPAIRS.length}종 (${DESPAIRS.map((d) => d.name).join(' · ')}), 증강별 성공 기록은 도감 기록 탭에 남는다.` },
      { id: 'oath', term: '절망 서약', key: 'epilogue', text: `${diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`} 의뢰에 스스로 거는 고정 조건. 타이틀의 [절망 서약]에서 서약 ${Object.keys(CFG.oath).length}종 중 원하는 것을 켜고 단계를 올리면, 단계마다 절망 수치가 쌓인다. 설정은 이 브라우저에 남고, ${diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`}으로 출격할 때만 걸린다 (쉬움 · 모험은 무시). 무작위로 고르는 절망 증강과 따로 걸리며, 성공하면 전장별 최고 절망 수치가 도감 기록 탭에 남는다. 런 중에는 상단 바의 서약 표시와 지도 [환경] 탭에서 켠 서약을 볼 수 있다.` },
    ],
  },
];

export const GLOSSARY_COUNT = GLOSSARY.reduce((n, c) => n + c.entries.length, 0);
