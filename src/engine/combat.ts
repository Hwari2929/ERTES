import { CFG } from '../config';
import { Rng } from '../rng';
import { PSI_STATUS, type SchoolId } from '../data/schools';
import { CTYPE_NAME } from '../types';
import type { Category, CType, DmgTag, Elem, FaithId, Geo, Keyword, Mod, Stats, StatKey, SynergyId, TakenMod, TType, UnitState, Weapon } from '../types';

/** 비물리 4속성 (전기 · 화학 · 정신 · 신성): 치명타 불가 대신 아군 기물이 주는 피해의 계수 ×ELEM_AMP (적 · 전장 효과 · 체력 비례 직접 피해에는 없음) */
export const ELEM_AMP = 1.25;
export const isNonPhys = (elem: Elem) => elem === 'elec' || elem === 'chem' || elem === 'psy' || elem === 'holy';
export const elementDamageMult = (elem: Elem): number => (isNonPhys(elem) ? ELEM_AMP : 1);

export type StatusType = 'stun' | 'fear' | 'shock' | 'dot' | 'buff';

/** 분류별 받는 피해 배율 (아군 · 적 공통) */
export function categoryMult(c: Category, elem: Elem): number {
  if (c === 'bio') return elem === 'chem' ? 1.5 : 1;
  if (c === 'mech') return elem === 'elec' ? 1.5 : elem === 'psy' ? 0.25 : 1;
  if (c === 'soul') return elem === 'phys' ? 0.6 : elem === 'holy' ? 1.5 : 1;
  return 1;
}
/** 이성 출처 태그: cantrip 비술 · frenzy 광폭 회복 · rule 기물 고유 규칙(기본) · '<전공>.<증강키>' 전공 증강 (예: volt.store) */
export interface ReasonLog { gain: Record<string, number>; loss: Record<string, number>; hiT: number; loT: number; frzT: number; recent: { t: number; tag: string; d: number }[] }
/** 이성 구간 기준 (표시용): 고이성 > +15, 저이성 < -15 */
export const REASON_HI = 15, REASON_LO = -15;
/** 보스가 면역인 군중 제어 (빙결 · 매혹 · 혼란) */
export const BOSS_CC_IMMUNE = ['freeze', 'charm', 'confuse'];
/** 분류별 상태이상 면역 */
export function categoryImmune(c: Category, s: { type: string; key: string }): boolean {
  if (c === 'mech') return s.key === 'bleed' || s.key === 'poison';
  if (c === 'struct') return s.type === 'stun' || s.type === 'fear' || s.key === 'freeze';
  if (c === 'soul') return s.key === 'charm';
  return false;
}
/** 제어 효과: 행동을 막는 상태이상 종류 — 기절 · 빙결(type stun) · 공포(fear) · 감전(shock).
 *  걸려 있는 동안 재장전이 멈추고, 재장전 중에 (적에게서) 받으면 재장전이 처음으로 돌아간다.
 *  매혹 · 혼란(편 · 표적만 바뀌고 행동은 한다) · 속박(이동만) · 둔화 · 오한(속도만)은 해당하지 않는다 */
export const CONTROL_TYPES: readonly StatusType[] = ['stun', 'fear', 'shock'];
/** 전투 종료 보고서의 '제어' 시간에 드는 상태 (제어 효과 종류 밖): 매혹 · 혼란 · 속박 · 빙결 */
const CC_KEYS: readonly string[] = ['charm', 'confuse', 'root', 'freeze'];
/** 제어 효과 이름 순서 (교범 · 툴팁 표시용: STATUS_NAME 에서 이름을 읽는다) */
export const CONTROL_KEYS = ['stun', 'freeze', 'fear', 'shock'] as const;
export const STATUS_NAME: Record<string, string> = {
  stun: '기절', fear: '공포', rampage: '광폭', shock: '감전', root: '속박', stealth: '은신', poison: '중독', bleed: '출혈', corrode: '침식', decay: '부식', gloom: '암운', slow: '둔화', frenzy: '광폭', wound: '부상', suppress: '제압',
  // 사이오닉 상태이상 (연소 · 전도 · 지속 회복 · 오한 · 빙결 · 매혹 · 결속 · 공진 · 중독 · 혼란 · 향취)
  ...Object.fromEntries(Object.entries(PSI_STATUS).map(([k, v]) => [k, v.name])),
};
/** 제어 효과 이름 묶음 (예: '기절 · 빙결 · 공포 · 감전') */
export const controlNames = (sep = ' · ') => CONTROL_KEYS.map((k) => STATUS_NAME[k]).join(sep);
/** 재장전 초기화 떠오르는 글자 (상태 글자 규칙: status 이벤트) */
export const RELOAD_RESET_LABEL = '재장전 초기화';

export interface Status {
  type: StatusType;
  key: string; // 같은 key 는 중첩 대신 갱신
  dur: number;
  src?: CUnit;
  dps?: number; elem?: Elem; tickAcc?: number;
  /** 지속 피해가 시너지 몫이면 그 시너지 id */
  syn?: string;
  delta?: Partial<Stats>;
  armorMul?: number;
  mods?: Mod[];
  taken?: TakenMod[];
  label?: string;
  /** 받은 피해의 일부를 공격자에게 반사 */
  reflect?: number;
  /** 이 상태가 유지되는 동안 도발 계수 가산 */
  provPlus?: number;
  /** 고정 피해 반사 (방어도 무시) */
  reflectTrue?: number;
  /** 피격 시 자신 방어도 × 이 값만큼 공격자에게 고정 피해 (반응 장갑) */
  reflectArmor?: number;
  /** 중첩 수 (부상 · 방어도 감소 등) */
  stacks?: number;
  /** 받은 피해의 일부를 이 기물이 나눠 받는다 (린디웨) */
  share?: CUnit; shareRate?: number;
  /** 기록값 (프란체 심판) */
  rec?: number;
  /** 기록 비율 (기본 0.2) */
  recRate?: number;
  /** 이 기물이 받는 치명타의 피해 배율 가산 (도노반 전 보안위원회 표식) */
  critVuln?: number;
  /** 지속이 끝날 때 */
  onExpire?(b: Battle, u: CUnit, s: Status): void;
  // ── 학파 상태이상 (5단계)
  /** 중첩 상한: 있으면 다시 걸 때 stacks 만큼 중첩이 더해진다 (연소 · 오한 · 독성 농축 중독) */
  maxStacks?: number;
  /** 중첩당 초당 피해 (dps = perDps × stacks) */
  perDps?: number;
  /** 중첩당 능력치 변화 (delta = perDelta × stacks) */
  perDelta?: Partial<Stats>;
  /** 초당 회복 (지속 회복) */
  hps?: number;
  /** 받는 회복량 배율 (부패) */
  healMul?: number;
  /** 효과 수치 스냅샷 (전도 · 공진 피해, 결속 공유 비율) */
  val?: number;
  /** 묶음 번호 (같은 계시로 걸린 결속) */
  grp?: number;
  /** 중첩이 바뀐 뒤 (백열 방어도 감소 등) */
  onStack?(s: Status): void;
  /** 이 상태의 기물이 기본 공격 · 전투 스킬을 쓸 때 (전도) */
  onAct?(b: Battle, u: CUnit, s: Status): void;
  /** 이 상태의 기물이 피해를 받은 뒤 (공진) */
  onHit?(b: Battle, u: CUnit, src: CUnit, r: DmgResult, o: DmgOpts, s: Status): void;
  /** 이 기물에게 다른 상태이상이 걸렸을 때 (정상파) */
  onOther?(b: Battle, u: CUnit, s: Status, added: Status): void;
}

/** 주요 위력 능력치: 명사수 사격 · 돌격가 타격 · 그 밖은 기술 (지휘관은 P() 가 전술 위력으로 바꾼다) */
const mainKey = (u: CUnit): StatKey => (u.ctype === 'MARK' ? 'shoot' : u.ctype === 'VAN' ? 'strike' : 'tech');
export interface DmgOpts {
  elem: Elem;
  /** 시너지 자체 효과: 기물이 아닌 시너지 몫으로 집계 */
  syn?: string;
  tag: 'basic' | 'skill' | 'dot' | 'proc';
  /** 피해 유형: 사격 · 타격 · 기술 (지속 피해는 tag 'dot') */
  kind?: 'shoot' | 'strike' | 'tech';
  /** 추가 피해 태그 (콤보 · 피니쉬) */
  extra?: DmgTag[];
  canMiss?: boolean;
  critBonus?: number;
  pen?: number;
  noHooks?: boolean;
  /** 지속 피해를 낸 상태이상 키 (연소 등). 'reason' = 저이성 정신 피해 (공격자 쪽 배율 없음) */
  key?: string;
}
export interface DmgResult { amount: number; crit: boolean; miss: boolean; graze: boolean; killed: boolean }

export interface Hooks {
  onDeal?(b: Battle, self: CUnit, tgt: CUnit, r: DmgResult, o: DmgOpts): void;
  onKill?(b: Battle, self: CUnit, tgt: CUnit): void;
  onHurt?(b: Battle, self: CUnit, src: CUnit, r: DmgResult, o: DmgOpts): void;
  onSkill?(b: Battle, self: CUnit): void;
  onBasic?(b: Battle, self: CUnit, tgt: CUnit, r: DmgResult): void;
  onTick?(b: Battle, self: CUnit, dt: number): void;
  onStart?(b: Battle, self: CUnit): void;
  onHealDone?(b: Battle, self: CUnit, tgt: CUnit, amount: number, over: number): void;
  onAllyDeath?(b: Battle, self: CUnit, dead: CUnit): void;
  onEvade?(b: Battle, self: CUnit, src: CUnit): void;
  onLethal?(b: Battle, self: CUnit): boolean;
  dmgMult?(b: Battle, self: CUnit, tgt: CUnit, o: DmgOpts): number;
  takenMult?(b: Battle, self: CUnit, src: CUnit, o: DmgOpts): number;
  healMult?(b: Battle, self: CUnit, tgt: CUnit): number;
  /** 자신이 상태이상 · 버프를 걸었을 때 (적 · 아군 모두) */
  onInflict?(b: Battle, self: CUnit, tgt: CUnit, s: Status): void;
  /** 다른 아군이 피해를 받았을 때 */
  onAllyHurt?(b: Battle, self: CUnit, ally: CUnit, src: CUnit, r: DmgResult): void;
  /** 다른 아군이 전투 스킬을 썼을 때 */
  onAllySkill?(b: Battle, self: CUnit, caster: CUnit): void;
  /** 다른 아군이 기본 공격을 했을 때 */
  onAllyBasic?(b: Battle, self: CUnit, attacker: CUnit): void;
  /** 아군 · 적 누구든 쓰러졌을 때 */
  onAnyDeath?(b: Battle, self: CUnit, dead: CUnit, killer: CUnit | null): void;
  /** 한 칸 이동했을 때 */
  onMove?(b: Battle, self: CUnit): void;
  /** 신권 대행 발동 직후 */
  onDivine?(b: Battle, self: CUnit): void;
  /** 이성이 -100 에 닿아 광폭에 들어갈 때 */
  onFrenzy?(b: Battle, self: CUnit): void;
  /** 소마법을 쓴 직후 */
  onCantrip?(b: Battle, self: CUnit): void;
  /** 누군가의 위치가 효과로 강제로 바뀐 뒤 (밀쳐내기 · 끌어당기기 · 강제 이동, Battle.displaced 가 모아 부른다).
   *  victim = 옮겨진 기물, src = 옮긴 효과의 주인. 모든 살아 있는 기물에게 불린다 (편 판정은 받는 쪽이) */
  onDisplace?(b: Battle, self: CUnit, victim: CUnit, src: CUnit, kind: DisplaceKind): void;
  /** 받을 피해가 정해진 뒤, 일부를 다른 대상에게 넘긴다 (반환: 남은 피해) */
  redirect?(b: Battle, self: CUnit, src: CUnit, dmg: number, o: DmgOpts): number;
}

/** 강제 위치 변경 종류: 밀쳐내기 · 끌어당기기 · 그 밖의 강제 이동 (순간 이동 · 재배치) */
export type DisplaceKind = 'knock' | 'pull' | 'move';

/** 사이오닉 소마법 (학파 증강이 붙인다). cast: 대상이 없으면 false */
export interface Cantrip {
  name: string;
  cast(b: Battle, u: CUnit): false | { to?: CUnit };
  /** 이번 시전 뒤 쿨다운 (초) */
  cd(b: Battle, u: CUnit): number;
  /** 이번 시전의 이성 소모 */
  cost(b: Battle, u: CUnit): number;
}

/** 디바인 신권 대행 (rework.ts 에서 주입: 순환 import 방지) */
export const DIVINE_HOOK: { act?: (b: Battle, u: CUnit) => void } = {};

/** 메이저 궁극기: 시간에 따라 자연 충전, 가득 차면 발동 (전투 중 여러 번) */
export interface UltDef {
  id: string;
  name: string;
  /** 충전 계수 (1.0 = 기준 시간에 한 번) */
  charge: number;
  /** 컷인 대사 */
  line: string;
  /** 효과 설명 (상세 창) */
  desc: string;
  /** 기본 한 줄 설명 (상세 보기 꺼짐, docs/ABILITY_TEXT.md 1절) */
  brief?: string;
  /** 상세 문장 (상세 보기 켜짐, docs/ABILITY_TEXT.md 2절 · 토큰) */
  text?: string;
  /** 컷인 디자인: 배경 패턴 · 주색 · 보조색 · 글자 연출 */
  theme: { pat: string; c1: string; c2: string; txt: string };
  /** 성공하면 true (대상이 없으면 false → 게이지 유지) */
  cast: (b: Battle, u: CUnit) => boolean;
}

export interface SkillDef {
  name: string;
  cd: number;
  params: Record<string, number>;
  /** true 면 대상이 사거리(+reach) 안일 때만 시전 */
  needsRange?: boolean;
  reach?: number;
  desc: (p: Record<string, number>) => string;
  /** 발동 순간 스킬명 옆에 붙는 짧은 설명 (예: 아군 회복, 광역 화학 공격) */
  tag?: (p: Record<string, number>) => string;
  cast: (b: Battle, u: CUnit) => boolean;
}

export interface CUnit {
  id: number;
  side: 0 | 1;
  defId: string;
  name: string;
  sprite: string;
  palette: string[];
  big?: boolean;
  x: number; y: number; px: number; py: number;
  moveT: number; moveDur: number;
  hp: number; shield: number;
  st: Stats;
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  atkTimer: number;
  cd: number; cdMax: number;
  skill: SkillDef | null;
  sk: Record<string, number>;
  /** 메이저 궁극기와 게이지 (0~1) */
  ult?: UltDef | null; ultG?: number;
  statuses: Status[];
  mods: Mod[];
  taken: TakenMod[];
  hooks: Hooks[];
  keywords: Keyword[];
  /** 분류: 생체 · 기계 · 영혼 · 구조물 (아군 · 적 공통 상성) */
  category: Category;
  synergies: Set<SynergyId>;
  target: CUnit | null;
  alive: boolean;
  isBoss: boolean; isSummon: boolean; immobile: boolean;
  /** 셰프: 기본 공격을 하지 않고 제자리에서 기술만 쓴다 */
  noAttack?: boolean;
  phaseAmp: number;
  counters: { dmg: number; taken: number; healed: number; kills: number; casts: number; shield: number; elem: Partial<Record<Elem, number>>
    /** 아군만 (전투 종료 보고서, engine/report.ts): 적에게서 받아 낸 피해 · 다른 아군에게 건 버프 · 적에게 건 약화 · 제어가 걸려 있던 시간 (초) */
    tank?: number; buffT?: number; debuffT?: number; ccT?: number };
  mem: Record<string, number>;
  /** 이번 전투에서만 가진 장비 (캠핑 러버 등) */
  tempItems?: string[];
  // ── 리워크: 무기 · 유형 · 이성 · 신성력
  weapon: Weapon | null;
  ammo: number; reloadT: number; combo: number;
  ctype?: CType; ttype?: TType;
  /** 사이오닉 이성 (-100 ~ +100), 없으면 null */
  reason: number | null;
  /** 사이오닉 전공 · 비술 (없으면 null / 0) */
  school: SchoolId | null;
  cantrip?: Cantrip | null;
  /** 소마법 남은 쿨다운 · 이번 쿨다운 전체 (초) */
  cantripCd: number; cantripMax: number;
  /** 적 정예 (매혹 · 빙결 · 혼란 지속 시간 절반) */
  elite?: boolean;
  /** 디바인 신성력 게이지 (0~100), 없으면 null */
  div: number | null;
  divGot: number; divCap: number; divUsed: boolean;
  faith?: FaithId;
  /** 디바인: 성유물 (신권 대행) */
  relic?: string;
  src?: UnitState;
  owner?: CUnit;
  /** 이성 기록 (표시 전용, 전투 결과에 영향 없음): 출처별 회복 · 감소, 고이성 · 저이성 · 광폭 시간, 최근 변화 */
  rlog?: ReasonLog;
  /** 일러스트 id (소환물 · 포탑) */
  art?: string;
  /** 적 성향 (표적 고르기) · 아군별 도발 수치 (적만) */
  tend?: EnemyTend;
  prov?: Map<CUnit, number>;
}

// ───────── 도발 수치: 적이 표적을 고르는 규칙
/** 적 성향: 돌격형 (가까운 대상 · 도발 수치에 충실) · 암살형 (약하거나 뒷줄 · 도발 수치 영향 적음) · 저격형 (피해를 많이 준 대상) · 반격형 (동료 적을 때린 대상) */
export type EnemyTend = 'charge' | 'assassin' | 'sniper' | 'counter';
/** 배율 → '×0.5' */
const xm = (v: number) => `×${+v.toFixed(2)}`;
/** 도주하는 전투 유형 이름: '명사수 · 전문가 · 지휘관' */
const fleeWho = () => CFG.flee.ctypes.map((c) => CTYPE_NAME[c]).join(' · ');
/** 암살형 적에게 노려지는 아군의 도주 규칙 문구 (교범 · 적 성향 · 전투 유형 설명): CFG.flee 에서 읽는다 */
export const fleeRule = () => `암살형 적의 표적이 된 아군 ${fleeWho()} 기물은 그 적이 ${CFG.flee.r}칸 안으로 다가오면 그 적에게서 더 먼 빈칸으로 1칸 물러난다. 기본 공격이 준비돼 있고 사거리 안이면 공격이 먼저이고, 한 번 물러나면 ${CFG.flee.cd}초 동안은 다시 물러나지 않는다. 길이 막혔거나 고정 · 속박 · 기절 · 광폭 · 혼란 · 매혹 중이면 제자리, 소환물은 물러나지 않는다. 돌격가 곁으로 물러나면 쫓아오던 암살형이 경계에 걸리기 쉽다.`;
/** 짧은 도주 문구 (전투 유형 한 줄 설명) */
export const fleeShort = () => `암살형 적의 표적이 되면 그 적이 ${CFG.flee.r}칸 안으로 올 때 1칸 물러난다 (${CFG.flee.cd}초에 1번, 공격 준비가 되면 공격 먼저)`;
export const TEND_NAME: Record<EnemyTend, { name: string; desc: string }> = {
  charge: { name: '돌격형', desc: '가까운 대상을 먼저 노리고, 도발 수치를 가장 충실히 따른다' },
  assassin: { name: '암살형', desc: `체력이 낮거나 뒷줄에 있는 약한 대상을 노리고, 도발 수치에 덜 휘둘린다. 기본 이동 속도가 다른 성향의 ${+(CFG.enemyMoveSpd.assassin / CFG.enemyMoveSpd.base).toFixed(2)}배이고, 돌격가 경계에 걸리는 교전 시간 · 그때 돌격가에게 쌓이는 도발 수치가 ${xm(CFG.zoc.assassinMul)}이다. 표적이 된 아군 ${fleeWho()} 기물은 이 적이 ${CFG.flee.r}칸 안으로 다가오면 ${CFG.flee.cd}초에 1번씩 1칸 물러난다` },
  sniper: { name: '저격형', desc: '피해를 가장 많이 준 대상을 노린다' },
  counter: { name: '반격형', desc: '동료 적을 때린 대상을 노린다' },
};
/** 경계 교전(붙잡힘) 시간: CFG.zoc.hold + (그 돌격가의 도발 배율 − 1) × CFG.zoc.holdPerProv (도발 배율 = provMult, 전투 상세의 '도발 배율 ×N') */
export const zocHoldOf = (mult: number) => Math.max(0, CFG.zoc.hold + (mult - 1) * CFG.zoc.holdPerProv);
/** 교전 시간 식 문구: '1초 + (도발 배율 − 1) × 0.25초' */
export const zocHoldFormula = () => `${CFG.zoc.hold}초 + (도발 배율 − 1) × ${CFG.zoc.holdPerProv}초`;
/** 교전 시간 예시 문구: '돌격가 ×3 → 1.5초, 수호자 시너지가 켜지면 ×4.5 → 1.875초' */
const zocHoldExamples = () => `돌격가 ×${PROV.van} → ${+zocHoldOf(PROV.van).toFixed(3)}초, 수호자 시너지가 켜지면 ×${PROV.van + PROV.guard} → ${+zocHoldOf(PROV.van + PROV.guard).toFixed(3)}초`;
/** 돌격가 경계 규칙 표 (상세 보기 · 전투 유형 공통 규칙): 이름 + 값 줄로 */
export const zocRows = (): [string, string][] => [
  ['경계 범위', `아군 돌격가 주변 ${CFG.zoc.r}칸 (편성 화면에서만 보임)`],
  ['경계 효과', '들어온 적이 그 자리에 멈춘다 (공격 · 기술은 함) · 그 돌격가에게 도발 수치 누적'],
  ['교전 시간', zocHoldFormula()],
  ['예시', zocHoldExamples()],
  ['겹친 경계', '긴 쪽 적용'],
  ['경계 → 경계', '곧장 넘어갈 수 없음 (돌격가 사이 틈 차단)'],
  ['암살형 적', `교전 시간 · 도발 ${xm(CFG.zoc.assassinMul)} (경계 → 경계 금지는 같음)`],
  ['적 쪽 경계', '없음'],
];
/** 돌격가 경계 규칙 문구 (교범 · 전투 유형 설명): CFG.zoc · PROV 에서 읽는다 */
export const zocRule = () => `아군 돌격가 주변 ${CFG.zoc.r}칸은 경계다. 적이 경계 칸에 들어오면 그 자리에서 멈춰 교전 시간 동안 움직이지 못하고 (공격 · 기술은 한다) 그 돌격가에게 도발 수치가 쌓인다. 교전 시간 = ${zocHoldFormula()}, 도발 배율은 그 경계를 만든 돌격가의 값이다 (${zocHoldExamples()}, 경계가 겹치면 긴 쪽). 경계 칸에서 다른 경계 칸으로 곧장 넘어갈 수 없어 돌격가 사이의 틈을 그냥 빠져나가지 못한다. 암살형 성향의 적도 경계에 걸리지만 교전 시간과 그 돌격가에게 쌓이는 도발 수치가 ${xm(CFG.zoc.assassinMul)}이다 (경계 → 경계 이동 금지는 똑같이 받는다). 적 쪽에는 경계가 없다. 경계 범위는 편성 화면에서만 보인다.`;
/** 짧은 경계 문구 (편성 칸 툴팁 · 돌격가 한 줄 설명) */
export const zocShort = (hold?: number) => `돌격가 경계: 들어온 적은 ${hold !== undefined ? `${+hold.toFixed(3)}초` : zocHoldFormula()} 멈춰 교전, 경계에서 경계로 곧장 넘어가지 못함 (암살형은 ${hold !== undefined ? `${+(hold * CFG.zoc.assassinMul).toFixed(3)}초` : `교전 시간 ${xm(CFG.zoc.assassinMul)}`})`;
/** 도발 수치 계수 */
export const PROV = {
  /** 그 적에게 준 피해 1당 */
  dmg: 0.1,
  /** 회복 · 보호막 1당 (주변 supportR 칸 적 전체에) */
  support: 0.08, supportR: 4,
  /** 초당 감소 비율 */
  decay: 0.08,
  /** 표적 다시 고르는 간격 (초) · 갈아타는 기준 (지금 대상 점수의 배수) */
  every: 0.75, switchAt: 1.3,
  /** 도발 상태: 다른 대상 최대치 × tauntMul + tauntFlat 으로 올리고 tauntLock 초 고정 */
  tauntMul: 1.5, tauntFlat: 400, tauntLock: 1.5,
  /** 점수 바닥값 (모두 0일 때 성향 규칙으로 고르게) — 피해 600 상당 */
  seed: 60,
  /** 사거리 밖 대상 감쇠 (돌격형 · 저격형 · 반격형): 1 / (1 + far × 넘는 칸) */
  far: 0.5,
  /** 도발 배율: 돌격가 · 수호자 가산 · 소환물 (근접 · 고정 · 원거리, 전투 유형이 정해진 단짝 소환물은 그 유형 값) · 은신 · 기습 중 */
  van: 3, guard: 1.5, sumMelee: 1.4, sumFixed: 1.2, sumRanged: 1, hide: 0.3,
  /** 거리 감쇠 (돌격형 · 저격형 · 반격형, 칸당) · 저격형 피해 점유 가중치 · 도발 수치 지수 (1 = 비례) */
  near: 0.5, snipe: 0.5, pow: 1,
  /** 돌격가 경계에 걸린 적 → 그 돌격가에게 (도발 배율 적용 전, 피해 1당 dmg 와 같은 단위: 40 = 피해 400 상당) */
  zoc: 40,
};
/** 기물별 도발 배율: 돌격가 3, 수호자 시너지가 켜지면 +1.5, 장비(위협 신호기) +n, 은신 · 침투자 기습 중 ×0.3.
 *  소환물: 돌격가 소환물 3, 전투 유형이 정해진 단짝 소환물 (SummonDef.ctype → mem.typed) 은 그 유형 값 (전문가 1), 그 밖은 근접 1.4 · 고정 1.2 · 원거리 1.0 */
export function provMult(b: Battle | null, a: CUnit): number {
  let m = a.mem.provBase ?? (a.ctype === 'VAN' ? PROV.van : 1); // provBase: 기본 도발 배율을 따로 정한 소환물 (반려 돌(인화성) 4.5)
  if (a.isSummon && a.ctype !== 'VAN' && !a.mem.typed && a.mem.provBase === undefined) m = a.immobile ? PROV.sumFixed : a.atk.type === 'strike' ? PROV.sumMelee : PROV.sumRanged;
  if (a.synergies?.has('GUARD') && !a.mem.guardOff) m += PROV.guard; // 수호자 혼자(시너지 꺼짐)면 가산 없음
  m += a.statuses.reduce((sum, s) => sum + (s.provPlus || 0), 0);
  if (a.mem.provPlus) m += a.mem.provPlus; // 장비 가산 (위협 신호기)
  if (a.mem.provMul) m *= a.mem.provMul;
  if (b && (b.hidden(a) || a.statuses.some((x) => x.key === 'infil.ambush'))) m *= PROV.hide;
  return m;
}

/** 수호자 4/6/8: 현재 도발 계수에 따른 모든 피해 경감 몫 (다른 '모든 피해' 경감과 합쳐 CFG.reductionCap 을 넘지 않는다). 공유 피해는 이미 경감되어 있으므로 다시 적용하지 않는다. */
export const guardThreatRed = (b: Battle | null, u: CUnit) => Math.max(0, provMult(b, u)) * (u.mem.guardThreatRed || 0);

export type BEvent =
  /** chain: 연쇄 탄환 (앞 탄환이 닿은 지점에서 이어서 출발) */
  | { k: 'atk'; from: number; to: number; elem: Elem; ranged: boolean; chain?: boolean }
  /** dhp · dsh: 실제 체력 · 보호막 변화 (연출이 표시 시점을 늦출 때 되돌려 보여 주는 데 쓴다) */
  | { k: 'dmg'; id: number; src?: number; v: number; crit: boolean; miss: boolean; graze: boolean; elem: Elem; tag?: string; syn?: string; dhp?: number; dsh?: number }
  | { k: 'heal'; id: number; src?: number; v: number; dhp?: number }
  | { k: 'shield'; id: number; src?: number; v: number; dsh?: number }
  /** tag: 효과를 설명하는 짧은 말 (예: 광역 정신 공격) */
  | { k: 'skill'; id: number; name: string; tag?: string }
  /** 스킬 효과 처리가 끝난 지점 (사이의 이벤트는 이 스킬의 결과) */
  | { k: 'skillEnd'; id: number }
  /** 메이저 궁극기 발동 (컷인) */
  | { k: 'ult'; id: number; ult: string }
  /** 디바인 신권 대행 발동 (컷인) */
  | { k: 'divact'; id: number }
  | { k: 'status'; id: number; name: string; src?: number; harm?: boolean; stype?: string }
  | { k: 'die'; id: number; by?: number }
  | { k: 'spawn'; id: number }
  /** side: 효과를 낸 쪽 (색: 아군 피해 흰색 · 적 피해 빨강 · 회복 초록 · 버프 흰색) */
  | { k: 'fx'; x: number; y: number; r: number; elem: Elem; kind?: 'atk' | 'heal' | 'buff' | 'aura'; side?: 0 | 1 }
  | { k: 'crash'; side: 0 | 1 }
  /** 고유 표식: 부활 · 시간 역행 · 처형 · 불사 */
  | { k: 'mark'; id: number; name: string; style: 'revive' | 'rewind' | 'execute' | 'immortal' }
  /** 장비 지급 (필리스 배달 사고 등) */
  | { k: 'gift'; from: number; to: number; item: string }
  /** 사이오닉 소마법 시전 (to: 주 대상) */
  | { k: 'cantrip'; id: number; school: SchoolId; to?: number; name: string }
  /** 광석 운반차가 선로 위 기물을 쳐 냄 (ids: 맞은 기물 · dir: 1 오른쪽으로 · -1 왼쪽으로) */
  | { k: 'cart'; ids: number[]; dir: 1 | -1 };

export interface BattleCtx { phase: number; credits: number; field?: string; diff?: number; despairs?: string[]; oaths?: Record<string, number>; otShift?: number; campIntel?: boolean; campIntel2?: boolean; campIntel3?: boolean; campIntel4?: boolean; campAudit?: boolean; /** 전역 증강 id (적에게 걸리는 것: 판돈 올리기) */ globals?: string[] } // despairs: 이 런의 절망 증강 id 목록 (data/despair.ts) · oaths: 절망 서약 (data/oaths.ts) · otShift: 연장전 · 제한 시간을 앞당기는 초 (초침의 서약)

/** 지형 칸 성질 (비트): 통행 불가 (물 · 수로 — 탄은 넘어간다) · 탄도 차단 (벽 · 탱크 · 닫힌 수문 — 보통 통행 불가와 함께) */
export const T_NOWALK = 1, T_NOSHOT = 2;
/** 중립 구조물 (바리케이드): 길이 완전히 막혔을 때만 부수러 가도록 경로 비용을 크게 */
const WALL_PATH_COST = 1000;

/** 전장 조건 훅: 전장(id)마다 하나. battlefields.ts 가 FIELD_RULES 에 등록하고, 전투 시작 때 ctx.field 로 붙는다 */
export interface FieldRules {
  /** 기물 onStart 보다 먼저 (배치를 바꾸는 전장 규칙 — 침투자 순간이동 등보다 앞서야 할 때) */
  onPreStart?(b: Battle): void;
  /** 모든 기물 onStart 직후 */
  onStart?(b: Battle): void;
  /** 매 틱 (기물 행동 전) */
  onTick?(b: Battle, dt: number): void;
  /** 누구든 쓰러졌을 때 (by: 처치자, 없으면 null) */
  onDeath?(b: Battle, dead: CUnit, by: CUnit | null): void;
  /** 피해가 정해진 직후 (지속 피해 포함): 반환값으로 피해를 바꾼다 (보호막 겹 등) */
  absorb?(b: Battle, src: CUnit, tgt: CUnit, dmg: number, o: DmgOpts): number;
  /** 피해를 준 뒤 (훅 없는 피해 · 반사 포함, 0 피해 제외) */
  afterHit?(b: Battle, src: CUnit, tgt: CUnit, r: DmgResult, o: DmgOpts): void;
}
export const FIELD_RULES: Record<string, FieldRules> = {};

export class Battle {
  t = 0;
  units: CUnit[] = [];
  events: BEvent[] = [];
  keepEvents = true;
  /** 빗나간 공격의 대상: 그 공격에 딸린 효과(기본 공격 훅 · 스킬 부가 효과)가 처리되는 동안 해로운 상태 효과를 받지 않는다 */
  missed = new Set<CUnit>();
  winner: 0 | 1 | null = null;
  nextId = 1;
  counters = { crits: 0, statuses: 0, skills: 0, kills: 0, allyDeaths: 0, bestHit: 0 };
  /** 전투 단위 공유 상태 (부활 횟수 등) */
  mem: Record<string, number> = {};
  /** 전장 조건 (start 에서 ctx.field 로 붙는다) */
  fr: FieldRules | null = null;
  /** 지연 실행 (hold: 그 편이 전멸해도 이 예약이 끝날 때까지 승패를 미룬다 — 부활 · 망령 대기) */
  timers: { t: number; fn: () => void; hold?: 0 | 1 }[] = [];
  holds: [number, number] = [0, 0];
  later(delay: number, fn: () => void, hold?: 0 | 1) {
    this.timers.push({ t: this.t + delay, fn, hold });
    if (hold !== undefined) this.holds[hold]++;
  }
  /** 승패 판정에 세는 기물 (전장 장애물 inert 제외) */
  fighters(side: 0 | 1) { return this.units.filter((u) => u.alive && u.side === side && !u.mem.inert && !u.mem.decoy && !u.mem.feast); } // 유인 신호기 · 만찬 백수정도 빠진다
  /** 칸에 숨겨 둔 함정 (감전 지뢰): side 의 적이 r칸 안에 들어오면 delay 초 뒤 fire. 기물이 아니라 칸을 막지 않는다 */
  traps: { x: number; y: number; side: 0 | 1; r: number; delay: number; at?: number; fire: (b: Battle) => void }[] = [];
  private tickTraps() {
    for (const tr of this.traps.slice()) {
      if (tr.at === undefined) {
        if (this.units.some((e) => e.alive && !e.mem.inert && !e.mem.neutral && this.sideOf(e) !== tr.side && this.dist(e, tr) <= tr.r)) tr.at = this.t + tr.delay;
      } else if (this.t >= tr.at) {
        this.traps.splice(this.traps.indexOf(tr), 1);
        this.actor = null;
        tr.fire(this);
        if (this.over) return;
      }
    }
  }
  checkEnd() {
    if (this.over) return;
    if (!this.fighters(0).length && !this.holds[0]) this.winner = 1;
    else if (!this.fighters(1).length && !this.holds[1]) this.winner = 0;
  }

  /** 진영별 전술 위력 (전투 시작 시 계산) */
  tac: [number, number] = [0, 0];
  /** 시너지 자체 효과의 피해 · 회복 · 보호막 (진영별) */
  synStats: Record<string, { side: 0 | 1; dmg: number; healed: number; shield: number; elem: Partial<Record<Elem, number>> }> = {};
  synStat(id: string, side: 0 | 1) {
    const k = `${side}:${id}`;
    return (this.synStats[k] ??= { side, dmg: 0, healed: 0, shield: 0, elem: {} });
  }

  /** 전장 크기: 가로 w × 세로 h (배치 구역 + 바깥 테두리 1칸) */
  constructor(public w: number, public h: number, public rng: Rng, public ctx: BattleCtx) {}

  /** 기술 위력 조회: 지휘관은 사격/타격/기술 대신 전술 위력 기반 */
  P(u: CUnit, k: 'shoot' | 'strike' | 'tech'): number {
    if (u.ctype === 'CMD' && (!u.isSummon || u.mem.tacOk)) return this.tacPower(u); // tacOk: 주인 없는 시너지 기물 (공왕 무휼)
    return this.S(u, k);
  }
  tacPower(u: CUnit): number {
    const side = u.side;
    const boost = this.has(u, 'buff', 'div.oracle') || (this.mem[`oracle${side}`] || 0) > this.t ? 2 : 1;
    const base = Math.max(1, this.tac[side]) * boost;
    // 지휘관의 주요 위력 = 전술 위력: 페트라 (보유 크레딧 비례 %) · 청라 [지휘] (전술 위력 × 배율을 더한다)
    return base * (1 + (u.mem.tacPct || 0) + (u.mem.petPow || 0)) + (u.mem.command ? base * u.mem.command : 0);
  }
  computeTac() {
    for (const side of [0, 1] as const) {
      const us = this.units.filter((x) => x.side === side && !x.isSummon && x.alive && !x.mem.inert); // 반려 돌은 세지 않는다
      // 아군 (위력 단위, 출전 4명 · 지휘관 1명 = CFG.tacBase): 출전 기물 1명당 tacPerUnit, 지휘관 기여 (tacPerCmd + 정신력 × tacPerMnd) 는 높은 순으로 100% · 50% · 25% … (tacDecay)
      // 적: 기존 규칙을 위력 단위로 (8 × (20 - 2×인원 + 지휘관 2))
      const cmds = us.filter((c) => c.ctype === 'CMD');
      let v: number;
      if (side === 0) {
        v = CFG.tacBase - CFG.tacPerCmd + CFG.tacPerUnit * (us.length - 4);
        cmds.map((c) => ({ c, k: CFG.tacPerCmd + CFG.tacPerMnd * (c.mem.mnd || 0) })).sort((a, b) => b.k - a.k).forEach((x, i) => {
          const w = Math.pow(CFG.tacDecay, i);
          x.c.mem.tacShare = x.k * w; x.c.mem.tacW = w; // 내역 툴팁 · 전투 기록 (영향력)
          v += x.k * w;
        });
      } else v = 8 * (20 - 2 * us.length + 2 * cmds.length);
      for (const c of us) v += c.mem.tacBonus || 0;
      this.tac[side] = Math.max(8, Math.round(v));
    }
  }

  // ───────── 이성 (사이오닉)
  addReason(u: CUnit, d: number, tag = 'rule') {
    if (u.reason === null || !u.alive || !d) return;
    const before = u.reason;
    u.reason = Math.max(-100, Math.min(100, u.reason + d * (1 + (u.mem.reasonAmp || 0))));
    this.logReason(u, u.reason - before, tag);
    this.checkFrenzy(u);
  }
  /** 이성 변화 기록 (표시 전용): 출처별 누적 + 최근 6초 */
  private logReason(u: CUnit, real: number, tag: string) {
    if (!real) return;
    const L = (u.rlog ??= { gain: {}, loss: {}, hiT: 0, loT: 0, frzT: 0, recent: [] });
    const m = real > 0 ? L.gain : L.loss;
    m[tag] = (m[tag] || 0) + Math.abs(real);
    const last = L.recent[L.recent.length - 1];
    if (last && last.tag === tag && Math.sign(last.d) === Math.sign(real) && this.t - last.t < 0.5) { last.d += real; last.t = this.t; } else L.recent.push({ t: this.t, tag, d: real });
    while (L.recent.length && L.recent[0].t < this.t - 6) L.recent.shift();
  }
  /** 광폭: 이성 -100 에서 시작 (피아 구분 없이 가장 가까운 대상 공격 · 비술 불가 · 피해 +30%, 같은 편에게는 50%), -60 을 넘으면 해제 */
  frenzied(u: CUnit) { return u.statuses.some((s) => s.key === 'frenzy' || s.key === 'rampage'); }
  /** 혼란: 가까운 아무나 공격 (같은 편 포함), 스킬 · 비술 · 궁극기 사용 불가 */
  confused(u: CUnit) { return u.statuses.some((s) => s.key === 'confuse'); }
  /** 도발 (환영): 주변 1칸 안의 도발 기물을 우선 공격 */
  // ───────── 도발 수치
  /** 적 e 의 아군 a 에 대한 도발 수치 +v (a 의 도발 배율 적용) */
  provAdd(e: CUnit, a: CUnit, v: number) {
    if (!e.prov || v <= 0 || !a.alive || a.mem.neutral || this.sideOf(a) === this.sideOf(e)) return; // 중립 (운반차 등 지형 피해 출처)은 표적 후보가 아니다
    e.prov.set(a, (e.prov.get(a) || 0) + v * provMult(this, a));
  }
  /** 도발: e 의 a 에 대한 도발 수치를 크게 올리고 lock 초 동안 표적을 고정한다 */
  provoke(e: CUnit, a: CUnit, lock = PROV.tauntLock) {
    if (!e.prov || !a.alive) { e.target = a; return; }
    let top = 0;
    for (const [x, v] of e.prov) if (x !== a && v > top) top = v;
    e.prov.set(a, Math.max(e.prov.get(a) || 0, top * PROV.tauntMul + PROV.tauntFlat));
    e.mem.provLock = Math.max(e.mem.provLock || 0, this.t + lock);
    e.target = a;
  }
  /** 도발 수치 상위 n명 (표시용) */
  provTop(e: CUnit, n = 3): { u: CUnit; v: number }[] {
    return e.prov ? [...e.prov].filter(([x]) => x.alive).sort((a, c) => c[1] - a[1]).slice(0, n).map(([u, v]) => ({ u, v })) : [];
  }
  /** 성향을 곱한 표적 점수 */
  provScore(u: CUnit, c: CUnit, maxDmg: number): number {
    const p = Math.pow((u.prov?.get(c) || 0) + PROV.seed, PROV.pow);
    const d = this.dist(u, c), range = this.S(u, 'range');
    const reach = (d <= range ? 1 : 1 / (1 + PROV.far * (d - range))) / (1 + PROV.near * d);
    switch (u.tend) {
      case 'assassin': {
        const foes = this.enemiesOf(c);
        const front = foes.length ? Math.min(...foes.map((e) => this.dist(c, e))) : 1;
        const depth = Math.min(1, Math.max(0, (front - 1) / 4));
        return Math.sqrt(p) * (1 + 1.5 * (1 - this.hpPct(c))) * (1 + 0.6 * depth) * (d <= range ? 1 : 1 / (1 + 0.08 * (d - range)));
      }
      case 'sniper': return p * (1 + PROV.snipe * (maxDmg > 0 ? c.counters.dmg / maxDmg : 0)) * reach;
      case 'counter': {
        let o = 0, n = 0;
        for (const e of this.units) if (e !== u && e.alive && e.prov && this.sideOf(e) === this.sideOf(u)) { o += e.prov.get(c) || 0; n++; }
        return (p + (n ? (0.6 * o) / n : 0)) * reach;
      }
      default: return p * reach; // 돌격형: 같으면 가까운 쪽 (거리 감쇠)
    }
  }
  /** 표적 다시 고르기: 지금 대상보다 switchAt 배 이상 높을 때만 갈아탄다 (force = 지금 대상이 무효) */
  provPick(u: CUnit, cands: CUnit[], force: boolean) {
    if (!cands.length) { if (force) u.target = null; return; }
    const maxDmg = Math.max(0, ...cands.map((c) => c.counters.dmg));
    let best: CUnit | null = null, bs = -1;
    for (const c of cands) { const sc = this.provScore(u, c, maxDmg) + this.rng.next() * 1e-6; if (sc > bs) { bs = sc; best = c; } }
    if (!best) return;
    const cur = !force && u.target && cands.includes(u.target) ? u.target : null;
    if (cur && best !== cur && bs < PROV.switchAt * this.provScore(u, cur, maxDmg)) return;
    u.target = best;
  }
  taunter(u: CUnit): CUnit | null {
    let best: CUnit | null = null, bd = 2;
    for (const e of this.units) {
      if (!e.alive || !e.mem.taunt || this.sideOf(e) === this.sideOf(u) || this.hidden(e)) continue;
      const d = this.dist(u, e);
      if (d <= 1 && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  private checkFrenzy(u: CUnit) {
    if (u.reason === null || !u.alive) return;
    const on = u.statuses.some((s) => s.key === 'frenzy'); // 전장 광폭(rampage)은 이성과 무관
    if (!on && u.reason <= -100) {
      this.applyStatus(u, u, { type: 'buff', key: 'frenzy', dur: 9999, mods: [{ kind: 'inc', tag: 'all', v: 0.3 }], label: '광폭' });
      u.target = null;
      this.emit({ k: 'status', id: u.id, name: '광폭!' });
      for (const h of u.hooks) h.onFrenzy?.(this, u);
    } else if (on && u.reason > -60) {
      u.statuses = u.statuses.filter((s) => s.key !== 'frenzy');
      u.target = null;
      this.emit({ k: 'status', id: u.id, name: '광폭 해제' });
    }
  }
  // ───────── 신성력 (디바인)
  addDiv(u: CUnit, v: number) {
    if (u.div === null || !u.alive || v <= 0 || u.divGot >= u.divCap) return;
    const g = Math.min(v * (1 + (u.mem.divBoost || 0)), u.divCap - u.divGot);
    u.divGot += g;
    u.div = Math.min(100, u.div + g);
    if (u.div >= 100 && this.divReady(u)) this.divineAct(u);
  }
  /** 신권 대행을 더 쓸 수 있는지: 전투당 1회 + 서약 증강의 추가 횟수 (mem.divExtra, data/oathaugs.ts) */
  divReady(u: CUnit) { return u.div !== null && (u.mem.divActs || 0) < 1 + (u.mem.divExtra || 0); }
  /** 신권 대행 발동 (신성력 100 · 서약 증강 [순교의 서약]). divUsed = 한 번이라도 썼는지 (권능 정산 · 게이지 표시) */
  divineAct(u: CUnit) {
    u.divUsed = true;
    u.mem.divActs = (u.mem.divActs || 0) + 1;
    if (!u.mem.divT1) u.mem.divT1 = this.t; // 계측: 첫 신권 대행 시각
    u.div = 0;
    this.emit({ k: 'divact', id: u.id });
    DIVINE_HOOK.act?.(this, u);
    this.emit({ k: 'skillEnd', id: u.id });
    for (const h of u.hooks) h.onDivine?.(this, u);
  }

  // ───────── 조회
  get over() { return this.winner !== null; }
  living(side?: 0 | 1) { return this.units.filter((u) => u.alive && (side === undefined || u.side === side)); }
  /** 실제로 싸우는 편 (매혹된 기물은 시전자 편) */
  /** 편: 매혹이면 시전자 편, 중립 구조물(바리케이드)은 2 — 어느 편과도 아군이 아니다 */
  sideOf(u: CUnit): 0 | 1 | 2 { return u.mem.neutral ? 2 : u.mem.charmTo ? ((u.mem.charmTo - 1) as 0 | 1) : u.side; }
  /** 적 (중립 구조물 제외 — 기술이 바리케이드를 대상으로 고르지 않게. 바리케이드는 탄도 · 길막 · 갈라짐으로만 맞는다) */
  enemiesOf(u: CUnit) { const s = this.sideOf(u); return this.units.filter((x) => x.alive && this.sideOf(x) !== s && !x.mem.neutral); }
  /** 같은 편 (매혹된 기물은 원래 편과도, 시전자 편과도 아군이 아니다) */
  alliesOf(u: CUnit, includeSelf = true) { const s = this.sideOf(u); return this.units.filter((a) => a.alive && a.side === u.side && this.sideOf(a) === s && (includeSelf || a !== u)); }
  dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  unitAt(x: number, y: number) { return this.units.find((u) => u.alive && u.x === x && u.y === y) || null; }
  /** 기물이 설 수 있는 칸 범위 (전장 안 + 통행 불가 지형 아님). 순수 좌표 범위는 inRect */
  inBounds(x: number, y: number) { return this.inRect(x, y) && !(this.terrain && this.terrain[y * this.w + x] & T_NOWALK); }
  inRect(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  // ───────── 지형 · 중립 구조물
  /** 칸별 지형 비트 (T_NOWALK · T_NOSHOT), 지형이 없는 전장은 null. terrainVer: 바뀔 때마다 +1 (전투 화면이 칸을 다시 칠한다) */
  terrain: Uint8Array | null = null;
  terrainVer = 0;
  /** 칸별 받는 피해 증가 몫 (연결교 등, 지형이 정한다), 없으면 null */
  cellTaken: Float32Array | null = null;
  /** 칸 구조 (지형 틀 · 아군 진형 줄): buildBattle 이 붙인다 */
  geo?: Geo;
  /** 탄도를 막는 칸 (지형 · 구조물) 기준 구역 번호. 구조물이 부서지거나 지형이 바뀌면 다시 계산 */
  private region: Int32Array | null = null;
  private regionDirty = true;
  setTerrain(x: number, y: number, bits: number) {
    if (!this.inRect(x, y)) return;
    (this.terrain ||= new Uint8Array(this.w * this.h))[y * this.w + x] = bits;
    this.regionDirty = true;
    this.terrainVer++;
  }
  terrainAt(x: number, y: number) { return this.terrain && this.inRect(x, y) ? this.terrain[y * this.w + x] : 0; }
  /** 이 칸의 살아 있는 중립 구조물 */
  wallAt(x: number, y: number) { const u = this.unitAt(x, y); return u && u.mem.wall ? u : null; }
  /** 이동 · 구역을 막는 칸 (탄도 차단 지형 또는 구조물) — 대각선으로 두 칸 사이를 비집지 못하게 */
  private sealCell(x: number, y: number) { return !this.inRect(x, y) || !!(this.terrainAt(x, y) & T_NOSHOT) || !!this.wallAt(x, y); }
  private stepCell(x: number, y: number) { return !this.inBounds(x, y) || !!this.wallAt(x, y); }
  /** a → b 직선이 지나는 칸 (양 끝 제외, 칸 중심을 잇는 선을 촘촘히 따라가며) */
  lineCells(a: { x: number; y: number }, b: { x: number; y: number }) {
    const out: { x: number; y: number }[] = [];
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 4;
    let lx = a.x, ly = a.y;
    for (let i = 1; i < n; i++) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / n - 1e-6), y = Math.round(a.y + ((b.y - a.y) * i) / n - 1e-6);
      if ((x === lx && y === ly) || (x === b.x && y === b.y)) continue;
      lx = x; ly = y;
      out.push({ x, y });
    }
    return out;
  }
  /** 시야: a → b 사이에 탄도 차단 지형이 없는지 (구조물은 시야를 막지 않는다 — 쏘면 구조물에 맞는다) */
  los(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (!this.terrain) return true;
    return !this.lineCells(a, b).some((c) => this.terrainAt(c.x, c.y) & T_NOSHOT);
  }
  /** a → b 사이에서 a 쪽부터 처음 만나는 중립 구조물 (탄도 차단: 기본 공격은 이것에 맞는다) */
  lineWall(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (!this.mem.walls) return null;
    for (const c of this.lineCells(a, b)) { const w = this.wallAt(c.x, c.y); if (w) return w; }
    return null;
  }
  /** 사선 조회 (전투 화면 표시 · 측정용, 상태를 바꾸지 않는다): a → b 직선을 처음 막는 것.
   *  'terrain' = 탄도 차단 지형 (쏘지 못하고 자리를 옮긴다) · 'wall' = 중립 구조물 (기본 공격이 대신 맞는다) · at = 그 칸. sealed = 완전히 갈라짐 (기술 · 상태이상도 막힘) */
  fireLine(a: { x: number; y: number }, b: { x: number; y: number }): { block: 'clear' | 'terrain' | 'wall'; at?: { x: number; y: number }; sealed: boolean } {
    const sealed = this.sealed(a, b);
    if (!this.terrain && !this.mem.walls) return { block: 'clear', sealed };
    const cells = this.lineCells(a, b);
    const t = this.terrain ? cells.find((c) => this.terrainAt(c.x, c.y) & T_NOSHOT) : undefined;
    if (t) return { block: 'terrain', at: t, sealed };
    const w = this.lineWall(a, b);
    return w ? { block: 'wall', at: { x: w.x, y: w.y }, sealed } : { block: 'clear', sealed };
  }
  /** 두 칸이 탄도 차단 지형 · 구조물로 완전히 갈라져 있는지 (틈이 하나라도 있으면 false) — 전투 기술 · 상태이상도 넘지 못한다 */
  sealed(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (!this.mem.walls && !this.terrain) return false;
    if (this.regionDirty || !this.region) this.buildRegions();
    const ra = this.region![a.y * this.w + a.x], rb = this.region![b.y * this.w + b.x];
    return ra >= 0 && rb >= 0 && ra !== rb;
  }
  private buildRegions() {
    const n = this.w, N = n * this.h, r = (this.region = new Int32Array(N).fill(-1));
    this.regionDirty = false;
    let id = 0;
    const q: number[] = [];
    for (let i = 0; i < N; i++) {
      if (r[i] >= 0 || this.sealCell(i % n, (i / n) | 0)) continue;
      r[i] = id; q.push(i);
      while (q.length) {
        const c = q.pop()!, cx = c % n, cy = (c / n) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = cx + dx, y = cy + dy;
            if ((!dx && !dy) || this.sealCell(x, y)) continue;
            if (dx && dy && this.sealCell(cx + dx, cy) && this.sealCell(cx, cy + dy)) continue;
            const j = y * n + x;
            if (r[j] < 0) { r[j] = id; q.push(j); }
          }
      }
      id++;
    }
  }
  /** 중립 구조물이 생기거나 부서졌을 때 */
  wallsChanged() { this.mem.walls = this.units.filter((u) => u.alive && u.mem.wall).length; this.regionDirty = true; }
  /** 중립 구조물이 받는 피해: 방어도 · 속성 상성만 (치명 · 훅 · 집계 없음) */
  private hitWall(src: CUnit, w: CUnit, base: number, o: DmgOpts): DmgResult {
    const res: DmgResult = { amount: 0, crit: false, miss: false, graze: false, killed: false };
    if ((w.mem.invulnUntil || 0) > this.t) return res;
    let dmg = base * (src.side === 0 ? elementDamageMult(o.elem) : 1);
    if (o.elem !== 'true') { const armor = this.S(w, 'armor') * CFG.armorFactor[o.elem]; dmg *= 1 - armor / (armor + CFG.armorK); }
    dmg *= categoryMult(w.category, o.elem);
    const dhp = -Math.min(dmg, Math.max(0, w.hp));
    w.hp -= dmg;
    res.amount = dmg;
    this.emit({ k: 'dmg', id: w.id, src: src.id, v: dmg, crit: false, miss: false, graze: false, elem: o.elem, tag: o.tag, dhp, dsh: 0 });
    if (w.hp <= 0) { res.killed = true; this.kill(w, src); }
    return res;
  }
  nearest(from: CUnit, pool: CUnit[]) {
    let best: CUnit | null = null, bd = 1e9;
    for (const e of pool) {
      const d = this.dist(from, e) + this.rng.next() * 0.1;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  around(c: { x: number; y: number }, r: number, pool: CUnit[]) { return pool.filter((u) => this.dist(u, c) <= r); }
  /** 은신 중이라 대상으로 지정할 수 없는지 */
  hidden(u: CUnit) { return u.statuses.some((s) => s.key === 'stealth'); }
  /** 대상으로 지정할 수 있는 적 (은신 제외) */
  targetable(u: CUnit) { return this.enemiesOf(u).filter((e) => (!this.hidden(e) || u.mem.seeStealth) && !e.mem.inert); }

  S(u: CUnit, k: StatKey): number {
    let v = u.st[k];
    for (const s of u.statuses) if (s.delta && s.delta[k] !== undefined) v += s.delta[k]!;
    if ((u.mem.petPow || u.mem.command) && u.ctype !== 'CMD' && k === mainKey(u)) { // 주요 위력: 페트라 (보유 크레딧 비례 %) · 청라 [지휘] (아군 전술 위력 × 배율을 더한다)
      v *= 1 + (u.mem.petPow || 0);
      if (u.mem.command) v += Math.max(0, this.tac[u.side] || 0) * u.mem.command;
    }
    if (k === 'armor') {
      for (const s of u.statuses) if (s.armorMul !== undefined) v *= s.armorMul;
      v = Math.max(0, v);
    }
    if (k === 'moveSpd') v = Math.max(0.2, v);
    return v;
  }
  has(u: CUnit, type: StatusType, key?: string) { return u.statuses.some((s) => s.type === type && (!key || s.key === key)); }
  hpPct(u: CUnit) { return u.hp / this.S(u, 'maxHp'); }

  emit(e: BEvent) { if (this.keepEvents) this.events.push(e); }

  // ───────── 생성
  add(u: CUnit) { u.id = this.nextId++; this.units.push(u); if (u.mem.wall) this.wallsChanged(); return u; }
  spawn(u: CUnit, near: { x: number; y: number }) {
    const cell = this.freeCellNear(near.x, near.y);
    if (!cell) return null;
    u.x = u.px = cell.x; u.y = u.py = cell.y;
    this.add(u);
    for (const h of u.hooks) h.onStart?.(this, u);
    this.emit({ k: 'spawn', id: u.id });
    return u;
  }
  freeCellNear(x: number, y: number) {
    for (let r = 1; r < Math.max(this.w, this.h); r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (this.inBounds(nx, ny) && !this.unitAt(nx, ny)) return { x: nx, y: ny };
        }
    return null;
  }

  start() {
    for (const u of this.units) {
      u.hp = u.st.maxHp;
      u.atkTimer = u.atk.interval * (0.2 + this.rng.next() * 0.4);
      if (u.weapon?.kind === 'mag') u.ammo = u.weapon.mag || 1;
    }
    this.computeTac();
    this.fr = this.ctx.field ? FIELD_RULES[this.ctx.field] || null : null;
    this.fr?.onPreStart?.(this);
    for (const u of this.units.slice()) { this.actor = u; for (const h of u.hooks) h.onStart?.(this, u); }
    this.actor = null;
    this.fr?.onStart?.(this);
    for (const u of this.units) u.hp = Math.min(u.hp, this.S(u, 'maxHp'));
  }
  /** 궁극기 행동 충전 (CFG.ultGain): 기본 공격 · 전투 기술 · 피격. 충전 계수 · 궁극기 충전 스탯을 자연 충전과 같이 곱한다.
   *  피격 충전은 기물마다 CFG.ultGain.hurtIcd 초에 1번 (다단 · 소환물 공격을 많이 받아도 충전 속도가 피격 횟수에 비례해 폭증하지 않게).
   *  계측: u.mem['ug.<src>'] = 출처별 실제 충전량, ultN = 사용 횟수, ultT1 = 첫 사용 시각 */
  ultGain(u: CUnit, k: number, src: 'basic' | 'skill' | 'hurt' | 'time' | 'bonus' = 'basic') {
    if (!u.ult || (u.ultG || 0) >= 1) return;
    if (src === 'hurt') { if ((u.mem.ultHurtT || 0) > this.t) return; u.mem.ultHurtT = this.t + CFG.ultGain.hurtIcd; u.mem.ultHurtAt = this.t; }
    const g0 = u.ultG || 0;
    u.ultG = Math.min(1, g0 + (k / CFG.ultNeed) * u.ult.charge * Math.max(0.1, 1 + this.S(u, 'ultCharge')));
    u.mem[`ug.${src}`] = (u.mem[`ug.${src}`] || 0) + (u.ultG - g0);
  }
  /** 지금 행동 중인 기물 (보호막 제공자 집계용) */
  actor: CUnit | null = null;

  // ───────── 메인 루프
  step(dt: number) {
    if (this.over) return;
    this.t += dt;
    if (this.timers.length) {
      const due = this.timers.filter((x) => x.t <= this.t);
      if (due.length) {
        this.timers = this.timers.filter((x) => x.t > this.t);
        this.actor = null;
        for (const x of due) { if (x.hold !== undefined) this.holds[x.hold]--; if (!this.over) x.fn(); }
        this.checkEnd();
        if (this.over) return;
      }
    }
    if (this.fr?.onTick) { this.actor = null; this.fr.onTick(this, dt); if (this.over) return; }
    if (this.traps.length) { this.tickTraps(); this.checkEnd(); if (this.over) return; }
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.prov?.size) { const k = Math.max(0, 1 - PROV.decay * dt); for (const [a, v] of u.prov) { if (!a.alive) u.prov.delete(a); else u.prov.set(a, v * k); } } // 도발 수치 감소
      this.actor = u;
      this.tickStatuses(u, dt);
      if (!u.alive) continue;
      if (u.ult && (u.ultG || 0) < 1) this.ultGain(u, dt / CFG.ultTime, 'time');
      for (const h of u.hooks) h.onTick?.(this, u, dt);
      if (!u.alive || this.over) continue;
      this.act(u, dt);
      if (this.over) return;
    }
    if (this.t >= CFG.timeLimit - (this.ctx.otShift || 0)) this.winner = 1;
  }

  runToEnd(maxT = CFG.timeLimit + 1) {
    while (!this.over && this.t < maxT) { this.step(CFG.tick); if (!this.keepEvents) this.events.length = 0; }
    if (!this.over) this.winner = 1;
  }

  private tickStatuses(u: CUnit, dt: number) {
    for (const s of u.statuses) {
      const sc = s.src;
      if (sc && sc.side === 0 && sc !== u && s.type !== 'dot' && !s.hps && s.dur > 0) { // 보고서: 아군이 건 상태가 실제로 걸려 있던 시간 (지속 피해 · 지속 회복은 피해 · 회복으로 이미 센다)
        const k = u.side === 0 ? (s.type === 'buff' ? 'buffT' : null) : CONTROL_TYPES.includes(s.type) || CC_KEYS.includes(s.key) ? 'ccT' : 'debuffT';
        if (k) sc.counters[k] = (sc.counters[k] || 0) + Math.min(dt, s.dur);
      }
      s.dur -= dt;
      if (s.type === 'dot' && s.dps && s.src) {
        s.tickAcc = (s.tickAcc || 0) + dt;
        if (s.tickAcc >= 0.5 || s.dur <= 0) {
          const amt = s.dps * s.tickAcc;
          s.tickAcc = 0;
          this.dealDamage(s.src, u, amt, { elem: s.elem || 'phys', tag: 'dot', syn: s.syn, key: s.key });
          if (!u.alive) return;
        }
      } else if (s.hps && s.src) {
        // 지속 회복: 1초마다
        s.tickAcc = (s.tickAcc || 0) + dt;
        if (s.tickAcc >= 1 || s.dur <= 0) { const amt = s.hps * s.tickAcc; s.tickAcc = 0; this.heal(s.src, u, amt); }
      }
    }
    if (u.reason !== null) {
      // 저이성: 초당 최대 체력 × CFG.reasonDot × (-이성/100) 정신 피해, -50 이하 2배
      if (u.reason < 0) {
        u.mem.lowT = (u.mem.lowT || 0) + dt;
        if (u.mem.lowT >= 1) {
          u.mem.lowT -= 1;
          const k = (-u.reason / 100) * (u.reason <= -50 ? 2 : 1);
          this.dealDamage(u, u, this.S(u, 'maxHp') * CFG.reasonDot * k, { elem: 'psy', tag: 'dot', noHooks: true, key: 'reason' });
          if (!u.alive) return;
        }
      } else u.mem.lowT = 0;
      // 이성 구간 시간 (표시 전용)
      const L = (u.rlog ??= { gain: {}, loss: {}, hiT: 0, loT: 0, frzT: 0, recent: [] });
      if (this.frenzied(u)) L.frzT += dt; else if (u.reason > REASON_HI) L.hiT += dt; else if (u.reason < REASON_LO) L.loT += dt;
      // 광폭 중 초당 이성 +5 (-60 을 넘으면 해제)
      if (this.frenzied(u)) this.addReason(u, 5 * dt, 'frenzy');
      else this.checkFrenzy(u);
    }
    const gone = u.statuses.filter((s) => s.dur <= 0 && s.onExpire);
    u.statuses = u.statuses.filter((s) => s.dur > 0);
    for (const s of gone) s.onExpire!(this, u, s);
    // 매혹이 끝나거나 지워지면 원래 편으로
    if (u.mem.charmTo && !u.statuses.some((s) => s.key === 'charm')) this.uncharm(u);
    // 원래 편에 매혹되지 않은 기물이 하나도 없으면 (마지막 남은 적이 매혹 상태): 매혹은 남기되 편을 원래대로 돌려 공격받게 한다 (전투가 매혹이 풀릴 때까지 멈추지 않게). 그동안 스스로는 행동하지 않는다
    else if (u.mem.charmTo && !this.fighters(u.side).some((x) => !x.mem.charmTo)) { this.uncharm(u); u.mem.charmIdle = 1; }
    if (u.mem.charmIdle && !u.statuses.some((s) => s.key === 'charm')) u.mem.charmIdle = 0;
  }
  private uncharm(u: CUnit) {
    u.mem.charmTo = 0;
    u.target = null;
    for (const x of this.units) if (x.target === u) x.target = null;
  }

  private act(u: CUnit, dt: number) {
    const stunned = this.has(u, 'stun') || !!u.mem.charmIdle; // 빙결도 type 'stun' · 마지막 남은 매혹 기물은 매혹이 끝날 때까지 멍하니 서 있다
    if (u.moveT > 0) { u.moveT -= dt; if (u.moveT <= 0) { u.px = u.x; u.py = u.y; } }
    if (stunned) return;
    if (!this.has(u, 'shock')) {
      const cdr = 1 + this.S(u, 'cdr');
      u.cd -= dt * cdr;
      if (u.cantrip) u.cantripCd = Math.max(0, u.cantripCd - dt * cdr);
    }
    u.atkTimer -= dt * Math.max(0.2, 1 + this.S(u, 'atkSpd'));
    // 재장전: 제어 효과(공포 · 감전 등, 기절 · 빙결은 위에서 이미 멈춤)가 걸려 있는 동안은 멈춘다
    if (u.reloadT > 0 && !this.controlled(u)) {
      u.reloadT -= dt * Math.max(0.2, 1 + this.S(u, 'reloadSpd'));
      if (u.reloadT <= 0) { u.reloadT = 0; u.ammo = u.weapon?.mag || 1; }
    }
    if (u.moveT > 0) return;

    // 광폭: 피아 구분 없이 가장 가까운 대상
    const frenzy = this.frenzied(u);
    const confused = this.confused(u);
    const ff = (frenzy && CFG.frenzyFriendly) || confused; // 광폭이 아군도 노리는지 (기본 true) · 혼란은 항상
    const pool = () => (ff ? this.units.filter((x) => x.alive && x !== u && !this.hidden(x) && !x.mem.inert) : this.targetable(u));
    // 적: 도발 수치 + 성향으로 표적을 고른다 (광폭 · 혼란 · 매혹 중에는 예전 규칙)
    const provAI = !!u.prov && !ff && !u.mem.charmTo;
    const badT = !u.target || !u.target.alive || (this.hidden(u.target) && !u.mem.seeStealth) || u.target === u || (!ff && this.sideOf(u.target) === this.sideOf(u));
    if (provAI) {
      const tz = this.taunter(u);
      if (tz) this.provoke(u, tz);
      u.mem.provT = (u.mem.provT ?? 0) - dt;
      const locked = (u.mem.provLock || 0) > this.t && !badT;
      if (badT || (!locked && u.mem.provT <= 0)) { u.mem.provT = PROV.every; this.provPick(u, pool(), badT); }
    } else if (badT) u.target = this.nearest(u, pool());
    // 명사수 기본 메커니즘: 1초마다 사거리 안에서 체력 비율이 가장 낮은 적으로 대상을 바꾼다 (아군 명사수, 외길 추적 · 광폭 · 매혹 제외)
    if (u.ctype === 'MARK' && u.side === 0 && !u.isSummon && !frenzy && !confused && !u.mem.lockTarget && !u.mem.charmTo) {
      u.mem.mkScan = (u.mem.mkScan || 0) - dt;
      if (u.mem.mkScan <= 0) {
        u.mem.mkScan = 1;
        const low = this.lowestEnemy(u);
        if (low) u.target = low;
      }
    }
    // 도발: 주변 1칸에 도발 기물(환영)이 있으면 그쪽을 노린다 (광폭 · 혼란 제외)
    if (!ff && !provAI) { const tz = this.taunter(u); if (tz) u.target = tz; }
    const tgt = u.target;
    if (!tgt) return;
    const range = this.S(u, 'range');
    // 사거리 밖의 더 가까운 적이 생기면 재조준 (외길 추적: 대상이 쓰러질 때까지 바꾸지 않음)
    if (!provAI && this.dist(u, tgt) > range && (!u.mem.lockTarget || ff) && !tgt.mem.taunt) {
      const near = this.nearest(u, pool());
      if (near && this.dist(u, near) < this.dist(u, tgt)) u.target = near;
    }
    const t2 = u.target!;
    const d = this.dist(u, t2);
    const feared = this.has(u, 'fear') || confused; // 혼란: 스킬 · 비술 · 궁극기 불가 (기본 공격만)
    const fearOnly = this.has(u, 'fear');

    // 메이저 궁극기: 게이지가 가득 차면 기술보다 먼저
    if (!feared && u.ult && (u.ultG || 0) >= 1) {
      const at = this.events.length;
      if (u.ult.cast(this, u)) {
        u.ultG = 0;
        u.mem.ultN = (u.mem.ultN || 0) + 1;
        if (!u.mem.ultT1) u.mem.ultT1 = this.t;
        if (u.side === 0) this.counters.skills++;
        if (this.keepEvents) { this.events.splice(at, 0, { k: 'ult', id: u.id, ult: u.ult.id }); this.emit({ k: 'skillEnd', id: u.id }); }
        if (this.over) return;
      } else this.events.length = Math.min(this.events.length, at);
    }

    // 재장전 중에는 기술을 쓰지 않는다 (쿨다운은 계속 돌고, 재장전이 끝나는 순간 기본 공격보다 먼저 시전)
    if (!feared && u.skill && u.cd <= 0 && u.reloadT <= 0) {
      const sk = u.skill;
      if (!sk.needsRange || d <= range + (sk.reach || 0)) {
        // 시전 전에 쿨다운을 채워 두어, 시전 중 처치 등으로 쿨다운을 돌려받을 수 있게 한다
        const prevCd = u.cd;
        u.cd = u.cdMax;
        const at = this.events.length;
        if (!sk.cast(this, u)) { u.cd = prevCd; this.events.length = Math.min(this.events.length, at); }
        else {
          u.counters.casts++;
          if (u.side === 0) this.counters.skills++;
          // 연출 순서: 스킬명 → 효과. 시전 앞자리에 끼워 넣는다
          if (this.keepEvents) { this.events.splice(at, 0, { k: 'skill', id: u.id, name: sk.name, tag: sk.tag?.(u.sk) }); this.emit({ k: 'skillEnd', id: u.id }); }
          for (const h of u.hooks) h.onSkill?.(this, u);
          this.ultGain(u, CFG.ultGain.skill, 'skill');
          for (const a of this.alliesOf(u, false)) for (const h of a.hooks) h.onAllySkill?.(this, a, u);
          this.statusAct(u);
          if (this.over) return;
        }
      }
    }
    // 사이오닉 비술: 전투 스킬과 별개, 준비되면 자동 시전 (공포 · 매혹 · 광폭 · 혼란 중에는 불가)
    let d2 = d;
    if (u.cantrip && u.cantripCd <= 0 && !feared && !frenzy && !u.mem.charmTo && u.alive) {
      this.castCantrip(u);
      if (this.over) return;
      d2 = this.dist(u, t2); // 밀쳐내기 등으로 대상 위치가 바뀌었을 수 있다
    }
    // 암살형 적에게 노려지는 아군: 그 적이 다가오면 1칸 물러난다 (공격이 준비돼 있고 사거리 안이면 공격 먼저)
    if (u.alive && !(t2.alive && !u.noAttack && d2 <= range && !fearOnly && u.atkTimer <= 0 && u.reloadT <= 0) && this.flee(u, frenzy || confused)) return;
    if (!t2.alive || u.noAttack || !u.alive) return;
    if (d2 <= range && this.los(u, t2)) {
      if (!fearOnly && u.atkTimer <= 0 && u.reloadT <= 0) {
        const tgt2 = u.mem.lowestFocus ? this.lowestEnemy(u) || t2 : t2;
        this.basicAttack(u, tgt2);
        u.atkTimer = u.atk.interval;
        if (u.weapon?.kind === 'mag' && --u.ammo <= 0) this.startReload(u);
      }
    } else if (!u.immobile && !u.statuses.some((s) => s.key === 'root') && !((u.mem.zocUntil || 0) > this.t)) { // 돌격가 경계에 걸린 동안은 제자리
      const br = this.moveToward(u, t2, range);
      // 길이 구조물로 완전히 막혔으면 앞을 막은 구조물을 친다
      if (br && this.dist(u, br) <= range && this.los(u, br) && !fearOnly && u.atkTimer <= 0 && u.reloadT <= 0) {
        this.basicAttack(u, br);
        u.atkTimer = u.atk.interval;
        if (u.weapon?.kind === 'mag' && --u.ammo <= 0) this.startReload(u);
      }
    }
  }

  // ───────── 재장전 · 제어 효과
  /** 제어 효과(CONTROL_TYPES)가 걸려 있는지 */
  controlled(u: CUnit) { return u.statuses.some((s) => s.dur > 0 && CONTROL_TYPES.includes(s.type)); }
  /** 탄창을 다 써서 재장전 시작 (처음 길이를 기억해 초기화 때 쓴다) */
  startReload(u: CUnit) {
    u.reloadT = u.mem.rlFull = u.weapon?.reload || 1.5;
  }
  /** 재장전 중에 제어 효과를 받으면 재장전이 처음으로 돌아간다 (제어가 풀린 뒤 처음부터 다시). 진행이 없었으면 그대로 */
  resetReload(u: CUnit, src?: CUnit) {
    if (u.reloadT <= 0) return;
    const full = u.mem.rlFull || u.weapon?.reload || 1.5;
    if (u.reloadT >= full - 1e-6) return;
    u.reloadT = full;
    u.mem.rlResets = (u.mem.rlResets || 0) + 1;
    this.emit({ k: 'status', id: u.id, name: RELOAD_RESET_LABEL, src: src?.id, harm: true, stype: 'reload' });
  }

  /** 소마법 시전: 시전 전 이성으로 쿨다운 · 소모를 정하고, 성공하면 이성 감소 */
  private castCantrip(u: CUnit) {
    const c = u.cantrip!;
    const cd = c.cd(this, u), cost = c.cost(this, u);
    const at = this.events.length;
    const res = c.cast(this, u);
    if (!res) { this.events.length = Math.min(this.events.length, at); return; }
    if (this.keepEvents && u.school) this.events.splice(at, 0, { k: 'cantrip', id: u.id, school: u.school, to: res.to?.id, name: c.name });
    u.cantripMax = Math.max(0.5, cd);
    u.cantripCd = u.cantripMax;
    u.mem.cantrips = (u.mem.cantrips || 0) + 1;
    this.addReason(u, -cost, 'cantrip');
    for (const h of u.hooks) h.onCantrip?.(this, u);
  }
  /** 행동(기본 공격 · 전투 스킬)에 반응하는 상태이상 (전도) */
  private statusAct(u: CUnit) {
    for (const s of u.statuses.slice()) if (s.onAct && s.dur > 0) s.onAct(this, u, s);
  }

  basicAttack(u: CUnit, tgt: CUnit, coef = 1) {
    if (!tgt.mem.wall) tgt = this.lineWall(u, tgt) || tgt; // 탄도 차단: 사이의 중립 구조물에 맞는다 (양쪽 모두)
    const w = u.weapon;
    const kind = u.atk.type;
    const pow = w?.tactical ? this.tacPower(u) : this.S(u, kind);
    const extra: DmgTag[] = [];
    let m = (w?.mult ?? 1) * coef;
    if (w?.kind === 'combo') {
      u.combo++;
      if (u.combo >= (w.combo || 3)) { u.combo = 0; m *= CFG.finishMult; extra.push('finish'); u.mem.finished = 1; }
      else { extra.push('combo'); u.mem.finished = 0; }
    }
    // 심판의 탄환 (명사수 신권 대행): 신성 관통탄
    const holy = (u.mem.holyShots || 0) > 0;
    if (holy) u.mem.holyShots--;
    const elem = holy ? 'holy' : u.atk.elem;
    this.emit({ k: 'atk', from: u.id, to: tgt.id, elem, ranged: u.atk.type === 'shoot' });
    const mix = !holy && w?.mix ? w.mix : null; // 혼합 속성 무기: 계수를 반씩 두 속성으로 (두 번째 몫은 첫 몫이 맞아야)
    const r = this.dealDamage(u, tgt, pow * m * (mix ? 0.5 : 1), { elem, tag: 'basic', kind, canMiss: true, extra, pen: holy ? 1 : 0 });
    if (mix && !r.miss && tgt.alive) { const r2 = this.dealDamage(u, tgt, pow * m * 0.5, { elem: mix, tag: 'basic', kind, canMiss: false }); r.amount += r2.amount; r.killed ||= r2.killed; }
    if (r.miss) this.missed.add(tgt); // 빗나간 기본 공격: 특성 · 장비 훅이 거는 해로운 상태 효과는 들어가지 않는다
    for (const h of u.hooks) h.onBasic?.(this, u, tgt, r);
    this.missed.delete(tgt);
    this.ultGain(u, CFG.ultGain.basic, 'basic');
    for (const a of this.alliesOf(u, false)) for (const h of a.hooks) h.onAllyBasic?.(this, a, u);
    if (u.alive) this.statusAct(u);
    return r;
  }
  lowestEnemy(u: CUnit) {
    const es = this.enemiesOf(u).filter((e) => this.dist(u, e) <= this.S(u, 'range') && !this.hidden(e));
    return es.length ? es.reduce((a, c) => (this.hpPct(c) < this.hpPct(a) ? c : a)) : null;
  }

  /** 반환: 길이 구조물로 완전히 막혀 먼저 부숴야 하는 구조물 (없으면 null) */
  private moveToward(u: CUnit, tgt: CUnit, range: number): CUnit | null {
    // 최단 경로 (다익스트라): 대상이 사거리 안에 들어오는 가장 가까운 빈 칸으로.
    // 아군 칸은 지나갈 수 있지만 비용이 크다 (빈 길이 있으면 그쪽으로 돌아간다). 첫 걸음 · 도착 칸은 비어 있어야 하고 적은 항상 막는다.
    // 맴돌기 방지: 방금 떠나온 칸으로는 바로 되돌아가지 않고, 아군을 지나야 하는 길인데 첫 걸음이 대상에게 가까워지지 않으면 제자리에서 기다린다
    const n = this.w, N = n * this.h;
    const start = u.y * n + u.x;
    const cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), via = new Uint8Array(N), done = new Uint8Array(N);
    cost[start] = 0;
    const back = u.mem.lastCell ?? -1;
    const zoc = this.zocMask(u); // 돌격가 경계 (적만): 경계 → 경계 이동 금지, 경계에 들어가는 길은 비싸게
    let goal = -1;
    for (;;) {
      let cur = -1, bc = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && cost[i] < bc) { bc = cost[i]; cur = i; }
      if (cur < 0) break;
      done[cur] = 1;
      const cx = cur % n, cy = (cur / n) | 0;
      if (cur !== start && !this.unitAt(cx, cy) && this.dist({ x: cx, y: cy }, tgt) <= range && this.los({ x: cx, y: cy }, tgt)) { goal = cur; break; }
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (!this.inBounds(nx, ny)) continue;
          const id = ny * n + nx;
          if (done[id]) continue;
          const occ = this.unitAt(nx, ny), wall = !!occ?.mem.wall;
          if (occ && !wall && (cur === start || occ.side !== u.side)) continue;
          if (dx && dy && this.stepCell(cx + dx, cy) && this.stepCell(cx, cy + dy)) continue; // 막힌 두 칸 사이를 대각선으로 비집지 못한다
          if (cur === start && id === back) continue; // 방금 떠나온 칸
          if (zoc && zoc[cur] && zoc[id]) continue; // 경계 칸에서 경계 칸으로 곧장 넘어가지 못한다
          const c = bc + (wall ? WALL_PATH_COST : occ ? 4 : 1) + (dx && dy ? 0.01 : 0) + (zoc && zoc[id] && !zoc[cur] ? CFG.zoc.pathCost : 0); // 아군 칸은 비싸게, 대각선은 아주 조금 비싸게 (직선 우선), 경계에 들어가면 멈추므로 그만큼
          if (c < cost[id]) { cost[id] = c; prev[id] = cur; via[id] = via[cur] | (occ ? 1 : 0); }
        }
    }
    let next = -1;
    if (goal >= 0) {
      let c = goal;
      const path: number[] = [];
      while (c !== start) { path.push(c); c = prev[c]; }
      path.reverse();
      // 길에 구조물이 끼어 있으면 (돌아갈 길이 없음) 그 앞까지 가서 부순다
      const wi = path.findIndex((i) => this.wallAt(i % n, (i / n) | 0));
      if (wi >= 0) {
        const w = this.wallAt(path[wi] % n, (path[wi] / n) | 0)!;
        if (wi === 0 || this.dist(u, w) <= range) { u.mem.lastCell = -1; return w; }
      }
      next = path[0];
      // 아군 사이로 비집어야 하는 길: 첫 걸음이 대상에게 가까워지지 않으면 비켜 줄 때까지 기다린다
      if (via[goal] && this.dist({ x: next % n, y: (next / n) | 0 }, tgt) >= this.dist(u, tgt)) next = -1;
    } else {
      // 경로가 막힘: 거리를 줄이는 아무 빈 칸
      let best = this.dist(u, tgt);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = u.x + dx, ny = u.y + dy;
          if (!this.inBounds(nx, ny) || this.unitAt(nx, ny)) continue;
          if (dx && dy && this.stepCell(u.x + dx, u.y) && this.stepCell(u.x, u.y + dy)) continue;
          if (zoc && zoc[start] && zoc[ny * n + nx]) continue;
          const dd = this.dist({ x: nx, y: ny }, tgt);
          if (dd < best) { best = dd; next = ny * n + nx; }
        }
    }
    if (next < 0) { u.mem.lastCell = -1; return null; } // 기다렸으면 다음엔 되돌아가는 길도 허용
    u.mem.lastCell = start;
    u.px = u.x; u.py = u.y;
    u.x = next % n; u.y = (next / n) | 0;
    u.moveDur = u.moveT = CFG.moveTime / this.S(u, 'moveSpd');
    if (zoc && zoc[next] && !zoc[start]) this.zocCatch(u);
    for (const h of u.hooks) h.onMove?.(this, u);
    return null;
  }

  /** 암살형 적에게 노려지는 아군의 도주 (CFG.flee): 자기를 표적으로 삼은 암살형 적이 r칸 안이면 그 적들에게서 더 먼 빈칸으로 1칸.
   *  같은 거리면 다른 적과 먼 칸, 그다음 아군 돌격가 곁 (쫓아오는 암살형을 경계로 끌어들인다), 그다음 자기 표적이 사거리 안인 칸. 물러났으면 true */
  private flee(u: CUnit, wild: boolean): boolean {
    const F = CFG.flee;
    if (wild || u.side !== 0 || this.sideOf(u) !== 0 || u.isSummon || u.immobile || u.mem.inert || u.mem.charmTo || !u.ctype || !F.ctypes.includes(u.ctype)) return false;
    if ((u.mem.fleeAt ?? -Infinity) + F.cd > this.t || u.statuses.some((s) => s.key === 'root')) return false;
    const hunters = this.units.filter((e) => e.alive && e.tend === 'assassin' && e.target === u && this.sideOf(e) === 1 && this.dist(u, e) <= F.r);
    if (!hunters.length) return false;
    const near = (p: { x: number; y: number }) => Math.min(...hunters.map((e) => this.dist(p, e)));
    const others = this.enemiesOf(u).filter((e) => !hunters.includes(e));
    const vans = this.zocOwners();
    const range = this.S(u, 'range'), tgt = u.target && u.target.alive ? u.target : null;
    const d0 = near(u);
    let best: { x: number; y: number } | null = null, bs = -Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = u.x + dx, y = u.y + dy;
        if ((!dx && !dy) || !this.inBounds(x, y) || this.unitAt(x, y)) continue;
        const p = { x, y }, d = near(p);
        if (d <= d0) continue;
        const o = others.length ? Math.min(3, ...others.map((e) => this.dist(p, e))) : 3;
        const v = vans.length ? Math.min(...vans.map((a) => this.dist(p, a))) : 0;
        const sc = d * 100 + o * 10 - Math.min(v, 5) + (tgt && this.dist(p, tgt) <= range ? 0.5 : 0) - (dx && dy ? 0.01 : 0);
        if (sc > bs) { bs = sc; best = p; }
      }
    if (!best) return false;
    u.mem.fleeAt = this.t;
    u.mem.flees = (u.mem.flees || 0) + 1;
    u.mem.lastCell = u.y * this.w + u.x;
    u.px = u.x; u.py = u.y;
    u.x = best.x; u.y = best.y;
    u.moveDur = u.moveT = CFG.moveTime / this.S(u, 'moveSpd');
    this.emit({ k: 'status', id: u.id, name: '물러남' });
    for (const h of u.hooks) h.onMove?.(this, u);
    return true;
  }

  // ───────── 돌격가 경계 (아군 돌격가만)
  /** 경계를 만드는 기물: 아군 편 돌격가 (소환물 · 반려 돌 · 은신 · 매혹된 기물 제외) */
  zocOwners() { return this.units.filter((v) => v.alive && v.side === 0 && this.sideOf(v) === 0 && v.ctype === 'VAN' && !v.isSummon && !v.mem.inert && !this.hidden(v)); }
  /** u 가 경계를 따르는 적이면 칸별 경계 표시 (1 = 아군 돌격가 주변 CFG.zoc.r 칸), 아니면 null. 고정 기물은 무시 (암살형도 따른다, 교전 시간만 CFG.zoc.assassinMul 배) */
  zocMask(u: CUnit): Uint8Array | null {
    if (this.sideOf(u) !== 1 || u.immobile) return null;
    const owners = this.zocOwners();
    if (!owners.length) return null;
    const n = this.w, m = new Uint8Array(n * this.h), r = CFG.zoc.r;
    for (const v of owners)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = v.x + dx, y = v.y + dy;
          if ((dx || dy) && this.inBounds(x, y)) m[y * n + x] = 1;
        }
    return m;
  }
  /** 경계 칸에 막 들어선 적: 도착한 뒤 교전 시간(zocHoldOf, 겹치면 긴 쪽) 동안 이동 금지 + 그 경계의 돌격가에게 도발 수치 (바로 표적을 다시 고른다).
   *  암살형은 교전 시간 · 도발 수치 모두 CFG.zoc.assassinMul 배 */
  private zocCatch(u: CUnit) {
    let hold = 0;
    const mul = u.tend === 'assassin' ? CFG.zoc.assassinMul : 1;
    u.mem.provT = 0;
    for (const v of this.zocOwners()) if (this.dist(u, v) <= CFG.zoc.r) {
      hold = Math.max(hold, zocHoldOf(provMult(this, v)) * mul);
      this.provAdd(u, v, PROV.zoc * mul);
      u.mem.zocBy = v.id;
      v.mem.zocCaught = (v.mem.zocCaught || 0) + 1;
    }
    u.mem.zocUntil = this.t + u.moveDur + hold;
  }

  // ───────── 피해 / 회복
  dealDamage(src: CUnit, tgt: CUnit, base: number, o: DmgOpts): DmgResult {
    const res: DmgResult = { amount: 0, crit: false, miss: false, graze: false, killed: false };
    if (!tgt.alive || base <= 0) return res;
    if (tgt.mem.neutral) return this.hitWall(src, tgt, base, o);
    // 탄도 차단 지형 · 구조물로 완전히 갈라진 적에게는 기술도 닿지 않는다 (사이의 구조물이 대신 맞는다)
    if (o.tag !== 'dot' && src !== tgt && !src.mem.neutral && this.sideOf(src) !== this.sideOf(tgt) && this.sealed(src, tgt)) {
      const w = this.lineWall(src, tgt);
      return w ? this.hitWall(src, w, base, o) : res;
    }
    let dmg = base * (src.side === 0 ? elementDamageMult(o.elem) : 1); // 비물리 4속성: 아군 기물의 계수만 ×ELEM_AMP
    // 제압: 다음 공격 피해 1
    if (o.tag !== 'dot' && o.tag !== 'proc' && src.statuses.some((s) => s.key === 'suppress')) {
      src.statuses = src.statuses.filter((s) => s.key !== 'suppress');
      dmg = Math.min(dmg, 1);
    }
    if (o.canMiss) {
      const acc = this.S(src, 'acc');
      const hit = Math.max(CFG.minHit, Math.min(1, CFG.baseHit + acc - this.S(tgt, 'eva')));
      if (this.rng.next() >= hit) {
        res.miss = true;
        const gc = Math.min(CFG.grazeChanceMax, CFG.grazeBase + acc * CFG.grazeAccK);
        if (this.rng.next() < gc) {
          res.graze = true;
          dmg *= Math.min(CFG.grazeDmgMax, CFG.grazeDmgBase + acc * CFG.grazeDmgAccK);
          if (tgt.mem.grazeRed) dmg *= Math.max(0, 1 - tgt.mem.grazeRed); // 잠재능력 [흘려 내기]: 받는 찰과상 피해 감소
        } else dmg = 0;
        for (const h of tgt.hooks) h.onEvade?.(this, tgt, src);
      }
    }
    // 전기 · 화학 · 정신 · 신성은 치명타 불가. 그 밖은 기존 사격 · 타격 / 기술 치명 허용 규칙을 따른다.
    // 기술 피해 치명: 기술 치명 허용(도노반 등) 또는 인과학파 저이성 (mem.lowTechCrit, data/psionic.ts)
    const canCrit = !isNonPhys(o.elem) && o.tag !== 'dot' && (o.kind === 'shoot' || o.kind === 'strike' || (o.kind === 'tech' && (src.mem.techCrit || src.mem.lowTechCrit)));
    if (dmg > 0 && canCrit && !res.miss) {
      if (this.rng.next() < this.S(src, 'crit') + (o.critBonus || 0)) {
        res.crit = true;
        let cm = this.S(src, 'critDmg') + tgt.statuses.reduce((a, s) => a + (s.critVuln || 0), 0);
        if (src.mem.critOver) cm += Math.max(0, this.S(src, 'crit') - 1) * src.mem.critOver; // 사냥꾼: 치명타 확률 100% 초과분 × 배율 = 치명타 피해
        if (tgt.mem.critRed) cm = Math.max(1, cm * (1 - tgt.mem.critRed)); // 인과학파 고이성: 받는 치명타 피해 감소
        dmg *= cm;
        if (src.side === 0) this.counters.crits++;
      }
    }
    if (dmg > 0) {
      const isTrue = o.elem === 'true';
      if (!isTrue) {
        const armor = this.S(tgt, 'armor') * CFG.armorFactor[o.elem] * (1 - Math.min(1, this.S(src, 'armorPen') + (o.pen || 0)));
        dmg *= 1 - armor / (armor + CFG.armorK);
      }
      dmg *= categoryMult(tgt.category, o.elem);
      const tags: DmgTag[] = ['all', o.elem, o.tag, ...(o.kind && o.tag !== 'dot' ? [o.kind] : []), ...(o.extra || [])];
      const selfPsy = o.key === 'reason'; // 저이성 정신 피해: 공격자 쪽 배율 없음
      if (!selfPsy) dmg *= modMult(allMods(src), tags) * src.phaseAmp;
      dmg *= takenMult(allTaken(tgt), tags, isTrue, guardThreatRed(this, tgt));
      const ct = this.cellTaken?.[tgt.y * this.w + tgt.x]; if (ct) dmg *= 1 + ct; // 엄폐 없는 지형 칸 (연결교)
      if (!selfPsy) for (const h of src.hooks) if (h.dmgMult) dmg *= h.dmgMult(this, src, tgt, o);
      for (const h of tgt.hooks) if (h.takenMult) dmg *= h.takenMult(this, tgt, src, o);
      const ot = CFG.overtimeStart - (this.ctx.otShift || 0); // 초침의 서약: 연장전을 앞당긴다
      if (this.t > ot) dmg *= 1 + (this.t - ot) * CFG.overtimeRamp;
      // 광폭: 같은 편에게 주는 피해 50%
      if (src !== tgt && o.tag !== 'dot' && this.sideOf(src) === this.sideOf(tgt) && this.frenzied(src)) dmg *= 0.5;
    }
    dmg = Math.max(0, dmg);
    if (tgt.mem.hitCap && dmg > 0) dmg = Math.min(dmg, this.S(tgt, 'maxHp') * tgt.mem.hitCap); // 올림푸스 성물: 1회 피해 상한
    if ((tgt.mem.invulnUntil || 0) > this.t) dmg = 0; // 성전 돌입 무적
    if (dmg > 0 && this.fr?.absorb) dmg = Math.max(0, this.fr.absorb(this, src, tgt, dmg, o)); // 전장 조건 (보호막 겹 등)
    if (dmg > 0 && src !== tgt) for (const h of tgt.hooks) if (h.redirect) dmg = Math.max(0, h.redirect(this, tgt, src, dmg, o)); // 자아 분리
    // 피해 분담 (린디웨 특별경호팀)
    const sh = dmg > 0 && o.tag !== 'dot' ? tgt.statuses.find((s) => s.share && s.share !== tgt && s.share.alive) : undefined;
    if (sh) {
      const part = dmg * (sh.shareRate || 0.5);
      dmg -= part;
      const g = sh.share!;
      let l2 = part;
      if (g.shield > 0) { const a = Math.min(g.shield, l2); g.shield -= a; l2 -= a; }
      g.hp -= l2; g.counters.taken += part; g.mem.shareTaken = (g.mem.shareTaken || 0) + part;
      if (g.side === 0 && src.side !== 0) g.counters.tank = (g.counters.tank || 0) + part;
      if (g.hp <= 0) this.kill(g, src);
    }
    res.amount = dmg;
    // 심판 기록 (프란체): 아군이 준 피해의 일부를 쌓는다
    if (dmg > 0 && src.side !== tgt.side) for (const s of tgt.statuses) if (s.rec !== undefined && s.src && s.src.side === src.side) s.rec += dmg * (s.recRate ?? 0.2);
    let dsh = 0, dhp = 0;
    if (dmg > 0) {
      let left = dmg;
      if (tgt.shield > 0) { const a = Math.min(tgt.shield, left); tgt.shield -= a; left -= a; dsh = -a; }
      dhp = -Math.min(left, Math.max(0, tgt.hp));
      tgt.hp -= left;
      const cs = o.syn ? this.synStat(o.syn, src.side) : src.counters;
      cs.dmg += dmg;
      cs.elem[o.elem] = (cs.elem[o.elem] || 0) + dmg;
      tgt.counters.taken += dmg;
      if (tgt.side === 0 && src.side !== 0) tgt.counters.tank = (tgt.counters.tank || 0) + dmg; // 받아 낸 피해 (보고서)
      if (src.side === 0 && dmg > this.counters.bestHit) this.counters.bestHit = dmg;
    }
    this.emit({ k: 'dmg', id: tgt.id, src: src.id, v: dmg, crit: res.crit, miss: res.miss, graze: res.graze, elem: o.elem, tag: o.tag, syn: o.syn, dhp, dsh });
    if (dmg > 0) { tgt.mem.lastChem = o.elem === 'chem' ? 1 : 0; this.fr?.afterHit?.(this, src, tgt, res, o); }
    if (dmg > 0 && tgt.prov && src !== tgt) this.provAdd(tgt, src, dmg * PROV.dmg); // 도발 수치: 준 피해 비례
    if (dmg > 0 && !o.noHooks) {
      const ls = this.S(src, 'lifesteal');
      if (ls > 0 && src.alive) this.heal(src, src, dmg * ls, true);
      for (const h of src.hooks) h.onDeal?.(this, src, tgt, res, o);
      if (tgt.alive) for (const h of tgt.hooks) h.onHurt?.(this, tgt, src, res, o);
      if (tgt.alive && res.amount > 0 && o.tag !== 'dot') this.ultGain(tgt, CFG.ultGain.hurt, 'hurt');
      if (src !== tgt) for (const a of this.alliesOf(tgt, false)) for (const h of a.hooks) h.onAllyHurt?.(this, a, tgt, src, res);
      if (o.tag !== 'proc' && src.alive && src !== tgt) {
        let rf = 0, rt = 0, ra = 0;
        for (const s of tgt.statuses) { rf += s.reflect || 0; rt += s.reflectTrue || 0; ra += s.reflectArmor || 0; }
        if (rf > 0) this.dealDamage(tgt, src, dmg * rf, { elem: 'phys', tag: 'proc', noHooks: true });
        if (rt > 0 && src.alive) this.dealDamage(tgt, src, dmg * rt, { elem: 'true', tag: 'proc', noHooks: true });
        if (ra > 0 && src.alive && o.tag !== 'dot') this.dealDamage(tgt, src, this.S(tgt, 'armor') * ra, { elem: 'true', tag: 'proc', noHooks: true });
      }
    }
    if (dmg > 0 && src !== tgt && !o.noHooks) {
      // 결속: 받은 피해의 일부를 다른 결속 대상이 나눠 받는다
      const bd = tgt.statuses.find((s) => s.key === 'bond' && s.val);
      if (bd) {
        const others = this.units.filter((x) => x.alive && x !== tgt && x.statuses.some((s) => s.key === 'bond' && s.grp === bd.grp));
        const div = bd.src?.mem['ps.mind.hive'] ? 1 : others.length; // ★ 집단 자아: 나누지 않고 각자 공유 비율만큼
        for (const x of others) this.rawHit(bd.src || src, x, (dmg * bd.val!) / div, o.elem, true);
      }
      // 공진 등: 피격 반응
      if (tgt.alive) for (const s of tgt.statuses.slice()) if (s.onHit && s.dur > 0) s.onHit(this, tgt, src, res, o, s);
    }
    if (tgt.alive && tgt.hp <= 0) {
      for (const h of tgt.hooks) if (h.onLethal && h.onLethal(this, tgt)) break;
      if (tgt.hp <= 0) { res.killed = true; this.kill(tgt, src); }
    }
    return res;
  }

  /** 방어를 무시하는 직접 피해 (체력 비례 · 전장 효과 등, 속성 배율 없음). 수호자 도발 경감만 받고, 이미 계산된 공유 피해는 resolved=true 로 중복 경감을 막는다. 훅 없음 */
  rawHit(src: CUnit, tgt: CUnit, amt: number, elem: Elem, resolved = false) {
    if (!resolved) amt *= 1 - Math.min(CFG.reductionCap, guardThreatRed(this, tgt));
    if (!tgt.alive || amt <= 0) return 0;
    if ((tgt.mem.invulnUntil || 0) > this.t) return 0;
    if (tgt.mem.neutral) return this.hitWall(src, tgt, amt, { elem, tag: 'proc' }).amount;
    let left = amt, dsh = 0;
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, left); tgt.shield -= a; left -= a; dsh = -a; }
    const dhp = -Math.min(left, Math.max(0, tgt.hp));
    tgt.hp -= left;
    src.counters.dmg += amt;
    src.counters.elem[elem] = (src.counters.elem[elem] || 0) + amt;
    tgt.counters.taken += amt;
    this.emit({ k: 'dmg', id: tgt.id, src: src.id, v: amt, crit: false, miss: false, graze: false, elem, tag: 'proc', dhp, dsh });
    tgt.mem.lastChem = elem === 'chem' ? 1 : 0;
    if (tgt.hp <= 0) {
      for (const h of tgt.hooks) if (h.onLethal && h.onLethal(this, tgt)) break;
      if (tgt.hp <= 0) this.kill(tgt, src);
    }
    return amt;
  }

  /** 밀쳐내기 · 끌어당기기 면역 (보스 · 고정 기물 · 역장) */
  unmovable(u: CUnit) { return !u.alive || u.isBoss || u.immobile || !!u.mem.noKnock; }
  /** 끌어당기기: 대상을 시전자 바로 앞 칸(대상 쪽)으로. 그 칸이 막혀 있으면 blocker */
  pull(src: CUnit, tgt: CUnit): { moved: boolean; blocker?: CUnit } {
    if (this.unmovable(tgt)) return { moved: false };
    const dx = Math.sign(tgt.x - src.x), dy = Math.sign(tgt.y - src.y);
    if (!dx && !dy) return { moved: false };
    const nx = src.x + dx, ny = src.y + dy;
    if (nx === tgt.x && ny === tgt.y) return { moved: false };
    if (!this.inBounds(nx, ny)) return { moved: false };
    const occ = this.unitAt(nx, ny);
    if (occ) return { moved: false, blocker: occ };
    tgt.px = tgt.x; tgt.py = tgt.y;
    tgt.x = nx; tgt.y = ny;
    tgt.moveDur = tgt.moveT = 0.25;
    tgt.mem.lastCell = -1;
    this.emit({ k: 'status', id: tgt.id, name: '끌어당기기', src: src.id, harm: true, stype: 'knock' });
    this.displaced(src, tgt, 'pull');
    return { moved: true };
  }
  /** 밀쳐내기: 시전자 반대 방향으로 1칸 (보스 · 고정 기물 면역). blocker = 부딪힌 기물 */
  knockback(src: CUnit, tgt: CUnit): { moved: boolean; blocker?: CUnit } {
    if (this.unmovable(tgt)) return { moved: false };
    const dx = Math.sign(tgt.x - src.x), dy = Math.sign(tgt.y - src.y);
    if (!dx && !dy) return { moved: false };
    const nx = tgt.x + dx, ny = tgt.y + dy;
    if (!this.inBounds(nx, ny)) return { moved: false };
    const occ = this.unitAt(nx, ny);
    if (occ) return { moved: false, blocker: occ };
    tgt.px = tgt.x; tgt.py = tgt.y;
    tgt.x = nx; tgt.y = ny;
    tgt.moveDur = tgt.moveT = 0.2;
    tgt.mem.lastCell = -1;
    this.emit({ k: 'status', id: tgt.id, name: '밀쳐내기', src: src.id, harm: true, stype: 'knock' });
    this.displaced(src, tgt, 'knock');
    return { moved: true };
  }
  /** 강제 위치 변경 알림 (한 곳): pull · knockback 이 부르고, 칸을 직접 옮기는 효과(끌어오기 · 재배치)도 옮긴 뒤 이것을 부른다.
   *  모든 살아 있는 기물의 onDisplace 훅이 받는다 (한아 [혼란한 땅] 등) */
  displaced(src: CUnit, tgt: CUnit, kind: DisplaceKind) {
    if (!tgt.alive) return;
    for (const a of this.living()) for (const h of a.hooks) h.onDisplace?.(this, a, tgt, src, kind);
  }
  /** 대상을 (x, y) 칸으로 강제로 옮긴다 (빈칸이어야 함, 밀쳐내기 면역 무시 — 부르는 쪽이 판단). 옮기면 displaced 알림 */
  relocate(src: CUnit, tgt: CUnit, x: number, y: number, kind: DisplaceKind = 'move') {
    if (!tgt.alive || !this.inBounds(x, y) || this.unitAt(x, y)) return false;
    tgt.px = tgt.x; tgt.py = tgt.y;
    tgt.x = x; tgt.y = y;
    tgt.moveDur = tgt.moveT = 0.2;
    tgt.mem.lastCell = -1;
    this.displaced(src, tgt, kind);
    return true;
  }

  kill(u: CUnit, by: CUnit | null) {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    if (u.mem.charmTo) u.mem.charmTo = 0; // 매혹 중 쓰러지면 원래 편으로 집계
    this.emit({ k: 'die', id: u.id, by: by?.id });
    if (u.mem.neutral) { if (u.mem.wall) this.wallsChanged(); return; } // 중립 구조물: 처치 · 사망 훅 없음
    // 광폭으로 같은 편을 쓰러뜨린 것은 그 기물의 처치로 치지 않는다 (아군 사망은 그대로 패배 피해에 포함)
    const foe = !!by && this.sideOf(by) !== u.side;
    if (u.side === 1 && by) this.counters.kills++;
    if (u.side === 0 && !u.isSummon) this.counters.allyDeaths++;
    if (by && by.alive && foe) { by.counters.kills++; for (const h of by.hooks) h.onKill?.(this, by, u); }
    for (const a of this.alliesOf(u)) for (const h of a.hooks) h.onAllyDeath?.(this, a, u);
    for (const a of this.living()) for (const h of a.hooks) h.onAnyDeath?.(this, a, u, by);
    // 소환자가 죽으면 소환물도 소멸
    for (const s of this.units) if (s.owner === u && s.alive) { s.alive = false; this.emit({ k: 'die', id: s.id }); }
    this.fr?.onDeath?.(this, u, by);
    this.checkEnd();
  }

  heal(src: CUnit, tgt: CUnit, amt: number, raw = false, syn?: string) {
    if (!tgt.alive || amt <= 0 || tgt.mem.neutral) return 0;
    if (this.consumeWound(tgt)) return 0;
    let a = amt;
    if (!raw) {
      a *= 1 + this.S(tgt, 'healEff');
      for (const h of src.hooks) if (h.healMult) a *= h.healMult(this, src, tgt);
    }
    for (const s of tgt.statuses) if (s.healMul !== undefined) a *= s.healMul; // 부패
    if (tgt.side === 0 && this.ctx.despairs?.includes('D.miracle')) a *= 1 - CFG.despair.heal; // 절망 증강 [기적 정기 휴무]
    const max = this.S(tgt, 'maxHp');
    const real = Math.min(a, max - tgt.hp);
    tgt.hp += real;
    (syn ? this.synStat(syn, src.side) : src.counters).healed += real;
    if (real >= 1) this.emit({ k: 'heal', id: tgt.id, src: src.id, v: real, dhp: real });
    if (real > 0) this.provSupport(src, real);
    if (!raw) for (const h of src.hooks) h.onHealDone?.(this, src, tgt, real, a - real);
    return real;
  }

  /** 도발 수치: 회복 · 보호막을 쓰면 주변 적 전체에 조금씩 */
  provSupport(src: CUnit, amt: number) {
    if (!src.alive) return;
    for (const e of this.units) if (e.alive && e.prov && this.sideOf(e) !== this.sideOf(src) && this.dist(e, src) <= PROV.supportR) this.provAdd(e, src, amt * PROV.support);
  }
  /** 부상 중첩이 있으면 회복 · 보호막 1회를 대신 소모한다 */
  consumeWound(tgt: CUnit) {
    const w = tgt.statuses.find((s) => s.key === 'wound' && (s.stacks || 0) > 0);
    if (!w) return false;
    w.stacks!--;
    if (!w.stacks) w.dur = 0;
    return true;
  }

  shield(tgt: CUnit, amt: number, syn?: string) {
    if (!tgt.alive || amt <= 0 || tgt.mem.neutral) return;
    if (this.consumeWound(tgt)) return;
    const giver0 = this.actor && this.actor.side === tgt.side ? this.actor : tgt;
    const before = tgt.shield;
    tgt.shield = Math.min(this.S(tgt, 'maxHp'), tgt.shield + amt);
    const giver = giver0;
    (syn ? this.synStat(syn, tgt.side) : giver.counters).shield += tgt.shield - before;
    if (tgt.shield > before) this.provSupport(giver, tgt.shield - before);
    this.emit({ k: 'shield', id: tgt.id, src: giver.id, v: amt, dsh: tgt.shield - before });
  }

  /** 상태이상 부여. 확률 = 기본 × (1 + 효과명중 − 효과저항) */
  applyStatus(src: CUnit, tgt: CUnit, s: Status, baseChance = 1): boolean {
    if (!tgt.alive || tgt.mem.neutral) return false;
    if (src !== tgt && !src.mem.neutral && this.sideOf(src) !== this.sideOf(tgt) && this.sealed(src, tgt)) return false; // 완전히 갈라진 적
    if (categoryImmune(tgt.category, s)) return false;
    if ((s.type === 'stun' || s.type === 'fear') && (tgt.mem.ccImmuneUntil || 0) > this.t && src.side !== tgt.side) return false; // 궁극기 등 일시 면역 // 분류 면역 (기계: 출혈 · 중독, 구조물: 기절 · 공포 · 빙결, 영혼: 매혹)
    const cc = BOSS_CC_IMMUNE.includes(s.key);
    if (cc && tgt.isBoss) return false; // 보스: 빙결 · 매혹 · 혼란 면역
    const hostile = this.sideOf(src) !== this.sideOf(tgt);
    if (hostile && tgt.category === 'bio' && s.dps && (s.key === 'bleed' || s.key === 'poison')) { s.dps *= 1.25; if (s.perDps) s.perDps *= 1.25; } // 생체: 출혈 · 중독 강화
    if (hostile && this.missed.has(tgt)) return false; // 공격이 빗나간 대상
    if (hostile) {
      const p = baseChance * (1 + this.S(src, 'effHit') - this.S(tgt, 'effRes'));
      if (this.rng.next() >= p) return false;
      if (tgt.isBoss && (s.type === 'stun' || s.type === 'fear')) s.dur *= 0.5;
      if (cc && tgt.elite) s.dur *= 0.5; // 정예: 빙결 · 매혹 · 혼란 지속 절반
      s.dur *= 1 + (src.mem.statusDur || 0);
      if (src.side === 0) this.counters.statuses++;
    }
    // 축복 거부 (아르곤): 다른 기물이 거는 이로운 버프를 받지 않는다
    if (!hostile && src !== tgt && tgt.mem.noBless && s.type === 'buff' && (s.mods?.some((m) => m.v > 0) || Object.values(s.delta || {}).some((v) => (v as number) > 0))) return false;
    s.src = src;
    for (const h of src.hooks) h.onInflict?.(this, src, tgt, s);
    const ex = tgt.statuses.find((x) => x.key === s.key);
    if (ex) this.mergeStatus(ex, s, src);
    else {
      if (s.maxStacks) { s.stacks = Math.min(s.maxStacks, s.stacks ?? 1); this.restack(s); }
      else s.onStack?.(s);
      tgt.statuses.push(s);
      if (s.key === 'charm') { tgt.mem.charmTo = this.sideOf(src) + 1; tgt.target = null; for (const x of this.units) if (x.target === tgt) x.target = null; }
      if (s.key === 'confuse') tgt.target = null;
    }
    const cur = ex || s;
    for (const x of tgt.statuses.slice()) if (x !== cur && x.onOther) x.onOther(this, tgt, x, cur);
    const label = s.label || STATUS_NAME[s.key];
    if (label) this.emit({ k: 'status', id: tgt.id, name: label, src: src.id, harm: hostile, stype: s.type });
    if (hostile && CONTROL_TYPES.includes(s.type)) this.resetReload(tgt, src); // 재장전 중 제어 효과: 재장전 초기화
    return true;
  }
  /** 같은 키 상태이상을 다시 걸 때: 지속 갱신, 중첩형이면 중첩 추가 */
  private mergeStatus(ex: Status, s: Status, src: CUnit) {
    ex.dur = Math.max(ex.dur, s.dur);
    if (s.maxStacks) {
      const n0 = ex.stacks ?? 1, per0 = ex.perDps ?? (ex.dps || 0) / n0;
      ex.maxStacks = Math.max(ex.maxStacks || 0, s.maxStacks);
      ex.stacks = Math.min(ex.maxStacks, n0 + (s.stacks ?? 1));
      if (s.perDps !== undefined) ex.perDps = Math.max(per0, s.perDps);
      if (s.perDelta) ex.perDelta = s.perDelta;
      if (s.elem) ex.elem = s.elem;
      ex.src = src;
    } else if (s.dps && (!ex.dps || s.dps > ex.dps)) {
      ex.dps = s.dps; ex.src = src;
      if (ex.perDps !== undefined) ex.perDps = s.dps / (ex.stacks || 1);
    }
    if (s.key in PSI_STATUS) {
      // 학파 상태이상: 새로 건 쪽의 수치 · 반응을 이어받는다
      if (s.val !== undefined && s.val >= (ex.val ?? -Infinity)) { ex.val = s.val; ex.src = src; }
      if (s.hps !== undefined && s.hps >= (ex.hps ?? 0)) { ex.hps = s.hps; ex.src = src; }
      if (s.grp !== undefined) ex.grp = s.grp;
      if (s.taken && !ex.taken) ex.taken = s.taken;
      if (s.mods && !ex.mods) ex.mods = s.mods;
      for (const k of ['onAct', 'onHit', 'onOther', 'onStack'] as const) if (s[k]) (ex as unknown as Record<string, unknown>)[k] = s[k];
    }
    if (s.healMul !== undefined) ex.healMul = Math.min(ex.healMul ?? 1, s.healMul);
    this.restack(ex);
  }
  private restack(s: Status) {
    if (s.maxStacks) {
      const n = s.stacks ?? 1;
      if (s.perDps !== undefined) s.dps = s.perDps * n;
      if (s.perDelta) s.delta = Object.fromEntries(Object.entries(s.perDelta).map(([k, v]) => [k, (v as number) * n])) as Partial<Stats>;
    }
    s.onStack?.(s);
  }

  // ───────── 스킬 헬퍼
  stun(src: CUnit, tgt: CUnit, dur: number, chance = 1) { return this.applyStatus(src, tgt, { type: 'stun', key: 'stun', dur }, chance); }
  buff(src: CUnit, tgt: CUnit, key: string, dur: number, p: Partial<Status>) {
    return this.applyStatus(src, tgt, { type: 'buff', key, dur, ...p });
  }
  fx(x: number, y: number, r: number, elem: Elem, kind?: 'atk' | 'heal' | 'buff' | 'aura') { this.emit({ k: 'fx', x, y, r, elem, kind, side: this.actor?.side }); }
  lowestHpAlly(u: CUnit) {
    let best: CUnit | null = null, bp = 2;
    for (const a of this.alliesOf(u)) { const p = this.hpPct(a); if (p < bp) { bp = p; best = a; } }
    return best;
  }
  farthest(u: CUnit) {
    let best: CUnit | null = null, bd = -1;
    for (const e of this.enemiesOf(u)) { const d = this.dist(u, e); if (d > bd) { bd = d; best = e; } }
    return best;
  }
}

export function allMods(u: CUnit): Mod[] {
  const m = u.mods.slice();
  for (const s of u.statuses) if (s.mods) m.push(...s.mods);
  return m;
}
export function allTaken(u: CUnit): TakenMod[] {
  const m = u.taken.slice();
  for (const s of u.statuses) if (s.taken) m.push(...s.taken);
  return m;
}
/** 같은 종류: 증가는 합, 증폭은 최대값. 증가×증폭, 다른 종류끼리 곱. */
export function modMult(mods: Mod[], tags: DmgTag[]): number {
  let m = 1;
  for (const tag of tags) {
    let inc = 0, amp = 0;
    for (const x of mods) if (x.tag === tag) { if (x.kind === 'inc') inc += x.v; else amp = Math.max(amp, x.v); }
    m *= Math.max(0, 1 + inc) * (1 + amp);
  }
  return m;
}
/** extraRed: '모든 피해' 경감에 더할 몫 (수호자 도발 경감) — 같은 상한 안에서 합산하고, 고정 피해(ignoreRed)에도 이 몫은 적용 */
export function takenMult(mods: TakenMod[], tags: DmgTag[], ignoreRed: boolean, extraRed = 0): number {
  let m = 1;
  for (const tag of tags) {
    let vuln = 0, red = 0;
    for (const x of mods) if (x.tag === tag) { if (x.kind === 'vuln') vuln += x.v; else red += x.v; }
    if (ignoreRed) red = 0;
    if (tag === 'all') red += extraRed;
    m *= (1 + vuln) * (1 - Math.min(CFG.reductionCap, red));
  }
  return m;
}
