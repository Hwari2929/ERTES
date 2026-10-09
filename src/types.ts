export type Major = 'vit' | 'pow' | 'mnd' | 'def' | 'agi';
export const MAJORS: Major[] = ['vit', 'pow', 'mnd', 'def', 'agi'];
export const MAJOR_NAME: Record<Major, string> = { vit: '생명력', pow: '전투력', mnd: '정신력', def: '방어력', agi: '기동력' };

export type Elem = 'phys' | 'chem' | 'elec' | 'psy' | 'holy' | 'true';
export const ELEM_NAME: Record<Elem, string> = { phys: '물리', chem: '화학', elec: '전기', psy: '정신', holy: '신성', true: '고정' };
export type Keyword = 'bio' | 'mech' | 'struct' | 'phantom';
export const KEYWORD_NAME: Record<Keyword, string> = { bio: '생체', mech: '기계', struct: '건물', phantom: '환상' };

export type FactionId = 'UNI' | 'KAL' | 'HEL' | 'PET' | 'SIR' | 'PAN' | 'FAM';
export const FACTIONS: FactionId[] = ['UNI', 'KAL', 'HEL', 'PET', 'SIR', 'PAN', 'FAM'];
export type TraitId = 'MARK' | 'VAN' | 'SPEC' | 'MED' | 'STAFF' | 'BUDDY' | 'NATURE' | 'CLERIC' | 'STAR' | 'INFIL'
  | 'NAV' | 'CHEF' | 'ENG' | 'TIME' | 'EXPLORER' | 'RFRIEND';
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
}
export type StatKey = keyof Stats;

export function emptyStats(): Stats {
  return { maxHp: 0, healEff: 0, shoot: 0, strike: 0, tech: 0, acc: 0, crit: 0, effHit: 0, armor: 0, effRes: 0,
    moveSpd: 0, eva: 0, critDmg: 0, armorPen: 0, cdr: 0, atkSpd: 0, range: 0, lifesteal: 0 };
}

/** 피해 태그: 속성 + 전달 방식 */
export type DmgTag = 'all' | Elem | 'basic' | 'skill' | 'dot' | 'proc';
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
  pos: { c: number; r: number } | null; // r=0 이 아군 진영 가장 뒷줄
}

export type NodeType = 'battle' | 'adversity' | 'shop' | 'supply' | 'recruit' | 'boss' | 'pilgrim' | 'news';
export const NODE_NAME: Record<NodeType, string> = {
  battle: '일반 전투', adversity: '역경', shop: '상점', supply: '보급', recruit: '기물 영입', boss: '보스',
  pilgrim: '순례', news: '속보',
};

export interface EnemySpawn { defId: string; c: number; row: number; elite?: boolean }
export interface Encounter { n: number; env: string; enemies: EnemySpawn[]; mult: number; seed: number }

export interface ShopSlot { item: string; price: number; sold: boolean }
export interface NewsOffer { id: string; cost: number; sold: boolean }

export interface Quest { id: string; target: number; progress: number; done: boolean; reward: string }

export type Pending =
  | { t: 'global'; options: string[] }
  | { t: 'rankup'; uid: string; rank: number; points: number; options: AugPick[] | null; rerolls: number; allocDone: boolean }
  | { t: 'itemPick'; options: string[]; title: string }
  | { t: 'recruit'; options: string[] }
  | { t: 'supply'; options: string[] }
  | { t: 'blessing'; options: string[] }
  | { t: 'notice'; title: string; body: string };

export interface RunState {
  version: number;
  seed: number;
  rng: number;
  phase: number;
  step: number;
  map: NodeType[][];
  picked: (NodeType | null)[];
  node: { type: NodeType; enc?: Encounter; shop?: ShopSlot[]; news?: NewsOffer[] } | null;
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
  faith: number; // 성직자: 신앙
  fame: number; // 은하 대스타: 명성
  blessing: string | null; // 순례 축복 (이번 페이즈)
  staffTarget: string | null; // 참모단 지원 대상 uid
  aceTarget: string | null; // 항해자 에이스 파일럿 uid
  nextUid: number;
  log: string[];
  stats: { wins: number; losses: number; kills: number; bestHit: number };
  over: boolean;
}
