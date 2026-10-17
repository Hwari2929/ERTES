import type { Beat } from './data/scene';
import type { RunRec } from './engine/report';
export type Major = 'vit' | 'pow' | 'mnd' | 'def' | 'agi';
export const MAJORS: Major[] = ['vit', 'pow', 'mnd', 'def', 'agi'];
export const MAJOR_NAME: Record<Major, string> = { vit: '생명력', pow: '전투력', mnd: '정신력', def: '방어력', agi: '기동력' };

export type Elem = 'phys' | 'chem' | 'elec' | 'psy' | 'holy' | 'true';
export const ELEM_NAME: Record<Elem, string> = { phys: '물리', chem: '화학', elec: '전기', psy: '정신', holy: '신성', true: '고정' };
export type Keyword = 'bio' | 'mech' | 'struct' | 'phantom';
export const KEYWORD_NAME: Record<Keyword, string> = { bio: '생체', mech: '기계', struct: '건물', phantom: '환상' };
/** 분류: 아군 · 적 공통 상성 규칙 (기물 하나에 하나) */
export type Category = 'bio' | 'mech' | 'soul' | 'struct';
export const CATEGORY_NAME: Record<Category, string> = { bio: '생체', mech: '기계', soul: '영혼', struct: '구조물' };
export const CATEGORY_RULE: Record<Category, string> = {
  bio: '받는 화학 피해 ×1.5. 출혈 · 중독 피해 +25%.',
  mech: '받는 전기 피해 ×1.5, 정신 피해 ×0.25. 출혈 · 중독 면역.',
  soul: '받는 물리 피해 ×0.6, 신성 피해 ×1.5. 회피 +10%p. 매혹 면역.',
  struct: '이동하지 않음. 방어도 ×1.3. 기절 · 공포 · 빙결 면역.',
};
/** 키워드 → 분류: 이동하지 않으면 구조물, 기계 > 영혼(환상) > 생체 */
export function categoryOf(keywords: readonly string[], immobile = false): Category {
  if (immobile) return 'struct';
  if (keywords.includes('mech')) return 'mech';
  if (keywords.includes('phantom')) return 'soul';
  return 'bio';
}

export type FactionId = 'UNI' | 'KAL' | 'HEL' | 'PET' | 'SIR' | 'PAN' | 'FAM' | 'SEC' | 'STL' | 'HOI' | 'TIME' | 'VOYAGE' | 'CHR';
export const FACTIONS: FactionId[] = ['UNI', 'KAL', 'HEL', 'PET', 'SIR', 'PAN', 'FAM', 'SEC', 'STL', 'HOI', 'TIME', 'VOYAGE', 'CHR'];
export type TraitId = 'MED' | 'BUDDY' | 'STAR' | 'INFIL' | 'NAV' | 'CHEF' | 'ENG' | 'EXPLORER' | 'RFRIEND'
  | 'SCHEME' | 'DECOMP' | 'COND' | 'GUARD' | 'HUNTER' | 'OCCULT' | 'KING' | 'SANGUN';

/** 전투 유형: 어떤 스탯이 주력인지 */
export type CType = 'MARK' | 'VAN' | 'SPEC' | 'CMD';
export const CTYPE_NAME: Record<CType, string> = { MARK: '명사수', VAN: '돌격가', SPEC: '전문가', CMD: '지휘관' };
/** 전술 유형: 성장 방식과 특수 체계 */
export type TType = 'major' | 'minor' | 'special' | 'psionic' | 'divine';
export const TTYPE_NAME: Record<TType, string> = { major: '메이저', minor: '마이너', special: '스페셜', psionic: '사이오닉', divine: '디바인' };
export type FaithId = 'emperor' | 'athena' | 'hermes' | 'ares' | 'hades' | 'zeus' | 'selene' | 'human' | 'index' | 'science' | 'sirius';
export const FAITH_NAME: Record<FaithId, string> = {
  emperor: '황제 숭배', athena: '아테나 신앙', hermes: '헤르메스 신앙', ares: '아레스 신앙', hades: '하데스 신앙', zeus: '제우스 신앙',
  selene: '셀레네 신앙', human: '인간찬가', index: '지수추종', science: '과학지상주의', sirius: '시리우스 신학',
};
export const FAITHS = Object.keys(FAITH_NAME) as FaithId[];
/** 무기: 탄창형(원거리) 또는 콤보형(근거리) */
export interface Weapon {
  name: string;
  kind: 'mag' | 'combo' | 'none';
  type: 'shoot' | 'strike';
  elem: Elem;
  interval: number;
  range: number;
  /** 기본 공격 계수 (위력 대비) */
  mult: number;
  mag?: number; reload?: number;
  combo?: number;
  /** 위력 대신 전술 위력을 쓴다 (아문센 등) */
  tactical?: boolean;
}
export type SynergyId = FactionId | TraitId;

/** 마이너 스탯 (전투에 실제 적용되는 값). 확률/비율은 0~1 소수. */
export interface Stats {
  maxHp: number; healEff: number;
  shoot: number; strike: number; tech: number;
  acc: number; crit: number; effHit: number;
  armor: number; effRes: number;
  moveSpd: number; eva: number;
  critDmg: number; armorPen: number; cdr: number; atkSpd: number;
  range: number; lifesteal: number;
  reloadSpd: number; aoe: number;
  /** 궁극기 충전 효율 (+0.2 = 20% 빠르게) */
  ultCharge: number;
}
export type StatKey = keyof Stats;

export function emptyStats(): Stats {
  return { maxHp: 0, healEff: 0, shoot: 0, strike: 0, tech: 0, acc: 0, crit: 0, effHit: 0, armor: 0, effRes: 0,
    moveSpd: 0, eva: 0, critDmg: 0, armorPen: 0, cdr: 0, atkSpd: 0, range: 0, lifesteal: 0, reloadSpd: 0, aoe: 0, ultCharge: 0 };
}

/** 피해 태그: 속성 + 전달 방식 + 피해 유형(사격·타격·기술) + 콤보/피니쉬. 'dot' = 지속 피해 */
export type DmgTag = 'all' | Elem | 'basic' | 'skill' | 'dot' | 'proc' | 'shoot' | 'strike' | 'tech' | 'combo' | 'finish';
/** 증가(inc, %p 합연산) / 증폭(amp, 최대값만) — 공격자 측 */
export interface Mod { kind: 'inc' | 'amp'; tag: DmgTag; v: number }
/** 받는 피해 증가(vuln, 합) / 경감(red, 합, 상한) — 방어자 측 */
export interface TakenMod { kind: 'vuln' | 'red'; tag: DmgTag; v: number }

export interface AugPick { id: string; param?: string }

export interface UnitState {
  uid: string;
  defId: string;
  rank: number;
  xp: number;
  alloc: Record<Major, number>;
  perm: Record<Major, number>;
  augments: AugPick[];
  items: (string | null)[];
  mod: string | null; // 개조부품 슬롯 (문장 등)
  lock?: number; // 이 페이즈 동안 출전 불가 (사건)
  /** 고유 신앙 (순례에서 바꿀 수 있음, 디바인만 효과) */
  faith?: FaithId;
  /** 런 동안 누적되는 값 (마이너 성장 특성, 유전 물질 등) */
  grow?: Record<string, number>;
  /** 디바인: 장착한 성유물 (= 신권 대행) · 다음 전투 강화 여부 */
  relic?: string; enh?: boolean;
  pos: { c: number; r: number } | null; // r=0 이 아군 진영 가장 뒷줄
}

export type NodeType = 'battle' | 'adversity' | 'shop' | 'supply' | 'recruit' | 'boss' | 'pilgrim' | 'news' | 'event' | 'invest' | 'fork' | 'challenge' | 'council' | 'maint';
export const NODE_NAME: Record<NodeType, string> = {
  battle: '일반 전투', adversity: '역경', shop: '상점', supply: '보급', recruit: '기물 영입', boss: '보스',
  pilgrim: '순례', news: '속보', event: '사건', invest: '투자', fork: '전환', challenge: '도전', council: '항로 회의', maint: '정비',
};

export interface EnemySpawn { defId: string; c: number; row: number; elite?: boolean; items?: string[]; mod?: string; stripped?: boolean } // items · mod: 위험 등급 장비 · stripped: 강제 징수기로 장비를 떼어 냄 (적 정의의 장비도 달지 않는다)
export interface Encounter { n: number; env: string; enemies: EnemySpawn[]; mult: number; seed: number; phase?: number; add?: number } // phase: 적 강도 기준 페이즈 (도전 = 다음 페이즈) · add: 위험 등급 적 증원으로 더한 수 (difficulty.ts)

export interface ShopSlot { item: string; price: number; sold: boolean }
export interface NewsOffer { id: string; cost: number; sold: boolean }
/** 호이슌 [투자] 상품 (uid · aug = 고유 증강 구매 대상) */
export interface InvestOffer { id: string; cost: number; sold: boolean; uid?: string; aug?: string }

export interface Quest { id: string; target: number; progress: number; done: boolean; reward: string }

export type Pending =
  | { t: 'global'; options: string[]; rerolls?: number } // rerolls: 항로 회의 전역 증강 새로고침
  | { t: 'field' }
  | { t: 'victory' }
  | { t: 'event'; id: string; sub?: string | null } // sub: 이번 사건의 동적 조연 (기물 id)
  | { t: 'privilege'; options: AugPick[]; rerolls: number }
  | { t: 'despair'; options: string[]; rerolls: number; phase?: number } // 절망 증강 (data/despair.ts): 반드시 1개 · phase: 페이즈 시작 때 더 고르는 것 (없으면 출격 때)
  | { t: 'rankup'; uid: string; rank: number; points: number; options: AugPick[] | null; rerolls: number; allocDone: boolean; join?: boolean; kind?: 'major' | 'special' | 'psionic' | 'school'; great?: boolean; round?: number } // school: 사이오닉 합류 시 학파 선택 · great: 마이너 능력치 대성공 (만들 때 굴림, 첫 확정 뒤 공개) · round: 대성공으로 두 번째 고르는 중
  | { t: 'pilgrim'; cards?: { id: string; cost: number; sold: boolean; faith?: FaithId }[]; relics?: { id: string; cost: number; sold: boolean }[] }
  | { t: 'itemPick'; options: string[]; title: string }
  | { t: 'recruit'; options: string[]; rerolls?: number; syns?: string[] } // rerolls 없음 = 1회, syns = 지정 소집 조건
  | { t: 'supply'; options: string[] }
  | { t: 'branch'; options: NodeType[] }
  | { t: 'fork' } // 전환: 휴식 / 도전
  | { t: 'muster' } // 지정 소집: 시너지 4개 선택 창
  | { t: 'blessing'; options: string[] }
  | { t: 'notice'; title: string; body: string; scene?: Beat[] };

export interface RunState {
  version: number;
  /** 함대 확장 횟수 (출전 인원 = 기본 + fleet). 없으면 구 세이브: 페이즈 기준으로 환산 */
  fleet?: number;
  /** 지정 소집 횟수 (가격 상승) */
  musters?: number;
  /** 엔지니어 감시 포탑 배치 (편성 화면에서 끌어 옮긴 자리, 순서대로). c = -1 / 99 는 양옆 가장자리 열 */
  turretPos?: { c: number; r: number }[];
  /** 엔지니어 감시 포탑 장비 (포탑 순서대로, 포탑마다 1~2칸). 포탑 전용 장비(T_)만 */
  turretGear?: (string | null)[][];
  /** 튜토리얼 런: 진행 순서(TUTORIAL_FLOW) 위치. 있으면 고정 항로 · 고정 조우 · 지는 일 없음 */
  tutorial?: { i: number };
  seed: number;
  rng: number;
  phase: number;
  step: number;
  map: NodeType[][];
  picked: (NodeType | null)[];
  node: { type: NodeType; enc?: Encounter; shop?: ShopSlot[]; synth?: boolean; maint?: boolean; news?: NewsOffer[]; invest?: InvestOffer[] } | null;
  hp: number; maxHp: number;
  credits: number;
  streak: number;
  units: UnitState[];
  inventory: string[];
  globals: string[];
  pending: Pending[];
  quests: Quest[];
  questPhase: number;
  loan: number; // 남은 상환액
  faith: number; // (구) 성직자 신앙 — 사용 안 함
  power: number; // 디바인: 권능 포인트
  /** 보유했지만 장착하지 않은 성유물 */
  relics?: string[];
  divCap: number; // 디바인: 전투당 신성력 수집 상한 보너스
  fame: number; // 은하 대스타: 명성
  fund?: number; // 호이슌 투자: 다음 페이즈에 돌려받을 크레딧
  nodeUnits?: Record<number, string>; // 이번 페이즈 노드(칸 번호)에서 영입한 기물
  blessing: string | null; // 순례 축복 (이번 페이즈)
  staffTarget: string | null; // (구) 참모단 — 사용 안 함
  aceTarget: string | null; // 항해자 에이스 파일럿 uid
  occultTier?: number;
  chefBread?: boolean; // 셰프: 시너지가 처음 켜질 때 주는 갓 구운 빵을 받았는지
  breadFresh?: number[]; // 보관함의 갓 구운 빵이 식기까지 남은 전투 수 (오름차순 = 보관함의 'K_bread' 순서, engine/run.ts breadLeft)
  /** 청라공국: 쌓은 인과율 (공왕 무휼의 인과 단계, data/chungra.ts) · 지금까지 도달한 최고 청라 단계 (무휼 전용 장비 해금) · 무휼 배치 (포탑과 같은 저장 형식, c = -1 / 99 는 양옆 가장자리 열). 옛 세이브에는 없다 → 0 · 기본 자리 */
  causal?: number;
  chrTier?: number;
  kingPos?: { c: number; r: number };
  helTier?: number; // 헬레니우스: 지금까지 도달한 최고 단계 (전용 장비 지급 기록) // 신비학자: 지금까지 도달한 최고 단계 (전용 개조부품 지급 기록)
  privilege: AugPick | null; // 런 시작 특권 증강
  /** 절망 증강 id 목록 (data/despair.ts, 고른 순서). 고난 런에서 출격 때 특권 다음에 1개 + CFG.despair.every 페이즈마다 1개 */
  despairs?: string[];
  /** (예전 저장) 절망 증강 1개 — 불러올 때 despairs 로 옮긴다 (run.ts migrate) */
  despair?: string | null;
  /** 절망 서약 (data/oaths.ts): 고난 이상으로 출격할 때 도감 기록의 설정을 옮겨 둔 것 (서약 id → 단계) · 그때의 총 절망 수치 */
  oaths?: Record<string, number>;
  oathHeat?: number;
  field: string; // 전장 (battlefields.ts)
  diff: number; // 난이도 단계 = 위험 등급 (difficulty.ts): 쉬움 3 · 모험 6 · 고난 7
  cleared: boolean; // 목표 페이즈 보스 격파 (의뢰 성공)
  endless: boolean; // 의뢰 성공 후 무한 모드 진행 중
  mods: { interestCap: number; nodeIncome: number; divStart?: number; divGain?: number }; // 사건으로 바뀐 경제 규칙 · 순례 효과 (다음 전투 신성력 · 이번 페이즈 신성력 획득)
  boons: string[]; // 사건 팀 효과 (영구)
  phaseBoons: string[]; // 사건 팀 효과 (이번 페이즈)
  seenEvents: string[]; // 이번 런에서 겪은 사건
  flags: string[]; // 연계 사건 표식
  usedIds: string[]; // 이번 런에 합류한 적 있는 기물 (도감 기록용)
  recorded?: boolean; // 도감에 런 결과를 기록했는지
  rankLog: Record<string, number>; // 기물별 이번 런 최고 공명 등급 (도감 기록용)
  nextUid: number;
  log: string[];
  stats: { wins: number; losses: number; kills: number; bestHit: number };
  over: boolean;
  /** 업적 판정용 런 기록 (engine/achieve.ts): skip = 이번 런에서 사건 장면 · 미연시를 건너뛴 횟수 */
  ach?: { skip?: number };
  /** 전투 종료 보고서용 누적 기록 (engine/report.ts). 옛 세이브에는 없다 */
  rep?: RunRec;
}
