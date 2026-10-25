// 절망 증강: 게임을 어렵게 만드는 런 한정 디버프.
// 고난(위험 CFG.despair.from) 이상 런은 해금 조건 없이, 출격 때 특권 증강을 고른 직후 CFG.despair.choices 개 중 1개를 반드시 고르고
// CFG.despair.every 페이즈마다 (그 페이즈 시작 때) 1개를 더 고른다 (누적 · 이미 고른 증강은 선택지에 다시 나오지 않음 · 고를 때마다 새로고침 CFG.despair.rerolls 회).
// 수치는 전부 CFG.despair 에서 읽는다 (설명문도 그릴 때마다 읽음). 효과가 실제로 걸리는 곳:
//   rock      run.ts recruitOptions · recruit · autoPlace (반려 돌 기물 'petrock', rosterE.ts)
//   overclock build.ts buildEnemy · rival run.ts recruitOptions · myopic run.ts despairInterest
//   unix      run.ts unixSwap (캣휠 'J_catwheel', items.ts) · petra build.ts buildEnemy · tariff run.ts genShop · genSynth
//   miracle   combat.ts heal · final build.ts buildEnemy · swarm run.ts resolveBattle · battleRewardPreview
import { CFG } from '../config';
import type { Effect } from '../engine/effects';

export interface DespairDef {
  id: string;
  name: string;
  /** 효과 (설정값을 그릴 때마다 읽는다) */
  desc: () => string;
  /** 한 줄 사연 (카드 · 도감) */
  quip: string;
  /** 선 아이콘 키 (ui/synicons.ts) */
  icon: string;
  /** 지도 현재 칸 카드의 모디파이어 값 (전투 칸에서 이 증강이 걸리면, boss = 보스전). 없으면 표시하지 않음 */
  mod?: (boss: boolean) => string | null;
  /** 모든 출전 아군에게 거는 효과 (build.ts unitEffects) */
  ally?: () => Effect;
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
const D = () => CFG.despair;

/** 반려 돌 (아군 기물 id) · 캣휠 (장비 id) */
export const PETROCK = 'petrock';
export const CATWHEEL = 'J_catwheel';

export const DESPAIRS: DespairDef[] = [
  { id: 'D.rock', name: '단장의 반려 돌', icon: 'k.struct',
    desc: () => `기물 영입 선택지 ${D().rockSlots}개가 반려 돌로 바뀝니다. 반려 돌은 시너지가 없고 공격 · 이동을 하지 않으며, 영입하면 늘 출전해 출전 칸 하나를 차지합니다 (방출하면 보상 없이 사라지고, 다시 선택지에 섞입니다).`,
    quip: '유닉스가 보내온 위로 선물. 단장이 아끼는 돌이라 두고 갈 수도 없다.' },
  { id: 'D.overclock', name: '오버클럭', icon: 'a.cd',
    desc: () => `모든 적의 기술 쿨다운 감소 속도 +${pc(D().overclock)}.`, mod: () => `+${pc(D().overclock)}`,
    quip: '적 함대 정비병들이 냉각 규정을 함께 뜯어냈다.' },
  { id: 'D.rival', name: '배타적 경쟁 항로', icon: 'n.recruit',
    desc: () => `보유 기물과 시너지가 하나라도 겹치는 기물은 영입 선택지에 뽑히는 가중치가 ×${D().rival}로 줄어듭니다 (지정 소집 포함).`,
    quip: '같은 깃발의 용병들은 경쟁사 항로로 먼저 빠져나갔다.' },
  { id: 'D.myopic', name: '근시안적 투자안', icon: 'a.credit',
    desc: () => `이자 수입 -${pc(D().interest)} (내림).`, mod: () => `-${pc(D().interest)}`,
    quip: '이번 분기 실적만 보면 됩니다. 다음 분기는 다음 분기 담당자가.' },
  { id: 'D.unix', name: '유닉스제 대량 생산', icon: 'r.part',
    desc: () => `장비를 합성하거나 희귀 · 고급 장비를 얻을 때 ${pc(D().catwheel)} 확률로 아무 기능이 없는 [캣휠]로 바뀝니다. 캣휠이 ${D().zi}개 모이면 저절로 합쳐져 모든 주요 능력치 +${D().ziMajors} 전설 장비 [캣휠(ZI존)]이 됩니다.`,
    quip: '직전 분기 대비 생산량 증가. 쓸모는 원칙에 포함되지 않는다.' },
  { id: 'D.petra', name: '페트라 균등 납품', icon: 'a.shield',
    desc: () => `모든 적이 전투 시작 때 최대 체력 ${pc(D().shield)} 보호막을 두릅니다.`, mod: () => pc(D().shield),
    quip: '페트라는 모든 세력에 똑같이 납품한다. 이번 상대에게도.' },
  { id: 'D.tariff', name: '무역관세부 특별 관세', icon: 'n.shop',
    desc: () => `상점 · 합성 공방 가격과 함대 확장 · 지정 소집 비용 +${pc(D().tariff)} (반올림).`,
    quip: '관세는 협상하는 것이 아니라, 협상했다고 믿게 하는 것이다.' },
  { id: 'D.miracle', name: '기적 정기 휴무', icon: 'a.heal',
    desc: () => `아군이 받는 모든 회복 -${pc(D().heal)}.`, mod: () => `-${pc(D().heal)}`,
    quip: '성도회 공지: 이번 의뢰 기간에는 기적을 접수하지 않습니다.' },
  { id: 'D.final', name: '스타페어 결승전 특집', icon: 'n.boss',
    desc: () => `보스 체력 · 피해 +${pc(D().boss)}.`, mod: (boss) => (boss ? `+${pc(D().boss)}` : null),
    quip: '시청률이 걸린 판이다. 보스도 대본에 없는 힘을 낸다.' },
  { id: 'D.swarm', name: '군체 공명 간섭', icon: 'r.res',
    desc: () => `전투 후 공명도 풀 -${pc(D().xp)}.`, mod: () => `-${pc(D().xp)}`,
    quip: '먼 군집의 사이오닉장이 함대의 공명을 긁어 간다.' },
  // ── 감수할 만한 디버프 (아래는 build.ts buildEnemy · unitEffects, run.ts resolveBattle · xpCost 에서 읽는다)
  { id: 'D.fatigue', name: '피로 누적', icon: 'r.hp',
    desc: () => `모든 아군 최대 체력 -${pc(D().fatigue)}.`, mod: () => `-${pc(D().fatigue)}`, ally: () => ({ pct: { maxHp: -D().fatigue } }),
    quip: '휴가 결재는 다음 의뢰가 끝나면 난다고 했다. 지난번에도.' },
  { id: 'D.rust', name: '정비 지연', icon: 'a.cd',
    desc: () => `모든 아군 쿨다운 감소 속도 -${pc(D().rust)}.`, mod: () => `-${pc(D().rust)}`, ally: () => ({ stats: { cdr: -D().rust } }),
    quip: '부품은 오고 있다. 송장에는 그렇게 적혀 있다.' },
  { id: 'D.late', name: '늦은 출항', icon: 'a.speed',
    desc: () => `전투 시작 후 ${D().lateDur}초 동안 모든 아군 공격 속도 -${pc(D().late)}.`,
    ally: () => ({ hooks: { onStart(b, u) { b.buff(u, u, 'd.late', D().lateDur, { delta: { atkSpd: -D().late }, label: '늦은 출항' }); } } }),
    quip: '출격 사이렌이 울릴 때 절반은 아직 식당에 있었다.' },
  { id: 'D.plating', name: '두꺼운 장갑판', icon: 'a.shield',
    desc: () => `모든 적 방어도 +${pc(D().plating)}.`, mod: () => `+${pc(D().plating)}`,
    quip: '적 정비창이 이번 분기 예산을 전부 장갑에 썼다.' },
  { id: 'D.hasty', name: '성급한 적', icon: 'a.speed',
    desc: () => `모든 적 공격 속도 +${pc(D().hasty)}.`, mod: () => `+${pc(D().hasty)}`,
    quip: '저쪽도 퇴근이 걸려 있는 모양이다.' },
  { id: 'D.fog', name: '전장의 안개', icon: 'a.evade',
    desc: () => `모든 적 회피 +${pc(D().fog)}p.`, mod: () => `+${pc(D().fog)}p`,
    quip: '관측 위성이 하필 오늘 정기 점검이다.' },
  { id: 'D.exposed', name: '급소 노출', icon: 'a.crit',
    desc: () => `모든 적 치명타 확률 +${pc(D().exposed)}p.`, mod: () => `+${pc(D().exposed)}p`,
    quip: '함대 설계도가 암시장에 돌았다. 다행히 구버전이다.' },
  { id: 'D.lean', name: '긴축 예산', icon: 'a.credit',
    desc: () => `전투 승리 보상 크레딧 -${D().lean}.`, mod: () => `-${D().lean}`,
    quip: '경리팀이 탄약 영수증을 한 장씩 대조하기 시작했다.' },
  { id: 'D.leak', name: '공명 누수', icon: 'r.reco',
    desc: () => `공명도 구매 비용 +${D().leak}.`,
    quip: '공명 주입 장치에서 새는 소리가 난다. 고칠 사람은 휴가 중이다.' },
];
export const DESPAIR_BY_ID: Record<string, DespairDef> = Object.fromEntries(DESPAIRS.map((d) => [d.id, d]));
export const despairName = (id: string | null | undefined) => (id && DESPAIR_BY_ID[id]?.name) || '';
/** 이 런에 걸린 절망 증강 (고른 순서, 없어진 id 는 뺀다) */
export const despairsOf = (r: { despairs?: string[] } | null | undefined): DespairDef[] => (r?.despairs || []).map((id) => DESPAIR_BY_ID[id]).filter((d): d is DespairDef => !!d);
/** 이 런에 절망 증강 id 가 걸려 있는지 */
export const hasDespair = (r: { despairs?: string[] } | null | undefined, id: string) => !!r?.despairs?.includes(id);
/** 이 위험 등급 런에서 절망 증강을 고르는지 (고난 이상, 해금 조건 없음) */
export const despairDiff = (d: number | undefined) => (d || 0) >= CFG.despair.from;
/** 페이즈 p 시작 때 절망 증강을 1개 더 고르는지 (출격 때 1개는 따로). every: 간격 (심연의 서약이면 짧다) */
export const despairAt = (d: number | undefined, p: number, every = CFG.despair.every) => despairDiff(d) && p > 1 && p % every === 0;
/** 의뢰 페이즈 안에서 추가로 고르는 페이즈: [3, 6] */
export const despairPhases = () => { const out: number[] = []; for (let p = CFG.despair.every; p <= CFG.victoryPhase; p += CFG.despair.every) if (p > 1) out.push(p); return out; };
/** 고르는 방식 한 문장 (난이도 조건 · 선택 화면 · 도감 · 교범이 읽는다) */
export const despairRule = () => {
  const D = CFG.despair, ph = despairPhases();
  return `출격 때 특권 증강 다음에 ${D.choices}개 중 1개를 반드시 고르고, ${D.every}페이즈마다${ph.length ? ` (${ph.map((p) => `${p}페이즈`).join(' · ')} 시작 때)` : ''} 1개씩 더 고릅니다 (누적 · 이미 고른 증강은 다시 나오지 않음 · 고를 때마다 새로고침 ${D.rerolls}회).`;
};
