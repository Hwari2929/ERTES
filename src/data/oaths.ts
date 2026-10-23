// 절망 서약: 고난 의뢰에 플레이어가 직접 거는 고정 조건. 서약마다 단계를 올릴 수 있고, 단계마다 절망 수치가 쌓인다.
// 절망 증강(data/despair.ts)은 런 중에 무작위로 고르는 디버프, 서약은 출격 전에 타이틀 [절망 서약] 화면(ui/oath.ts)에서 고르는 고정 조건이다.
// 설정은 도감 기록(ui/meta.ts Meta.oath.sel)에 남고, 위험 CFG.oathFrom(고난) 이상으로 출격할 때만 런에 옮겨진다 (engine/run.ts newRun → RunState.oaths).
// 수치 · 단계 수 · 절망 수치는 전부 CFG.oath 에서 읽는다 (설명문도 그릴 때마다 읽음). 효과가 걸리는 곳:
//   grit · pain · plate · frenzy · titan(체력) · elite(능력치)  engine/build.ts buildEnemy (oathEnemy)    clock  engine/combat.ts (ctx.otShift: 연장전 · 제한 시간)
//   horde · elite(출현) · titan(호위)  engine/run.ts genEncounter    pay · vault · wound  engine/run.ts resolveBattle · battleRewardPreview
//   hull · strip · abyss(출격)  engine/run.ts newRun · pickDespair    abyss(간격)  engine/run.ts advance    recruit  offerRecruit    augment  augOptions
import { CFG } from '../config';

export type OathId = keyof typeof CFG.oath;
/** 서약 설정: 서약 id → 단계 (0 또는 없음 = 꺼짐) */
export type OathSel = Record<string, number>;
export interface OathDef {
  id: OathId;
  name: string;
  /** 계약 차림표에서 부르는 이름: 전장 환경 조건 (의뢰 · 약관 줄과 같은 말투) */
  env: string;
  /** 차림표 한 줄 설명 (수치 없이, 자세한 값은 도면) */
  brief: string;
  /** 선 아이콘 키 (ui/synicons.ts) */
  icon: string;
  /** 한 줄 사연 (서약 화면 · 도감) */
  quip: string;
  /** n 단계의 효과 (설정값을 그릴 때마다 읽는다, 누적이 아니라 그 단계의 전체 효과) */
  lv: (n: number) => string;
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
const pp = (x: number) => `${Math.round(x * 100)}%p`;
const O = () => CFG.oath;
/** 단계 n 의 값 (배열 [0] = 1단계) */
const at = (a: readonly number[], n: number) => a[Math.max(0, Math.min(a.length, n) - 1)] || 0;

export const OATHS: OathDef[] = [
  { id: 'grit', name: '강철의 서약', env: '강건한 보급창', brief: '적의 체력이 증가합니다', icon: 'a.hp', quip: '적 함대도 같은 정비창에서 장갑을 덧댄다.',
    lv: (n) => `적 최대 체력 +${pc(at(O().grit.hp, n))}` },
  { id: 'pain', name: '칼날의 서약', env: '풀린 안전장치', brief: '적이 주는 피해가 증가합니다', icon: 'a.dmg', quip: '포문의 안전장치를 모두 풀어 둔 상대와 싸우겠다고 서명한다.',
    lv: (n) => `적이 주는 피해 +${pc(at(O().pain.dmg, n))}` },
  { id: 'plate', name: '장갑의 서약', env: '두꺼운 장갑판', brief: '적의 방어도와 효과 저항이 증가합니다', icon: 'r.helm', quip: '보험 약관 대신 장갑판을 두껍게 바른 상대들.',
    lv: (n) => `적 방어도 +${pc(at(O().plate.armor, n))}, 효과 저항 +${pp(at(O().plate.res, n))}` },
  { id: 'frenzy', name: '질주의 서약', env: '각성제 배급', brief: '적의 공격 속도가 증가합니다', icon: 'a.speed', quip: '적 포수들이 각성제를 정량보다 2배 받았다.',
    lv: (n) => `적 공격 속도 +${pc(at(O().frenzy.atkSpd, n))}` },
  { id: 'horde', name: '군세의 서약', env: '불어난 적 규모', brief: '전투마다 적이 늘어납니다', icon: 'm.skull', quip: '의뢰서의 적 규모 칸에 \'대략\'이라는 말이 붙었다.',
    lv: (n) => `모든 전투의 적 +${at(O().horde.add, n)} (보드 칸이 남는 만큼)` },
  { id: 'elite', name: '정예의 서약', env: '정예 출격', brief: '정예가 더 자주, 더 강하게 나옵니다', icon: 'm.elite', quip: '상대도 이번만큼은 가장 좋은 전력을 내보낸다.',
    lv: (n) => `일반 전투에 정예가 나올 확률 +${pp(at(O().elite.chance, n))} (1페이즈부터), 정예 체력 · 피해 +${pc(at(O().elite.buff, n))}` },
  { id: 'titan', name: '거두의 서약', env: '우두머리의 호위함', brief: '보스가 강해지고 호위가 붙습니다', icon: 'n.boss', quip: '우두머리가 호위함을 더 끌고 나온다. 중계진만 신이 났다.',
    lv: (n) => `보스 체력 +${pc(at(O().titan.hp, n))}, 보스 호위 +${at(O().titan.guard, n)}` },
  { id: 'clock', name: '초침의 서약', env: '빠른 시계', brief: '연장전과 제한 시간이 앞당겨집니다', icon: 's.chrono', quip: '작전 시간은 무역관세부 시계로 잰다. 그 시계는 늘 빠르다.',
    lv: (n) => { const s = at(O().clock.sec, n); return `연장전 · 전투 제한 시간 ${s}초 앞당김 (연장전 ${CFG.overtimeStart - s}초부터, 제한 ${CFG.timeLimit - s}초)`; } },
  { id: 'pay', name: '박봉의 서약', env: '깎인 성공 보수', brief: '전투 승리 크레딧이 줄어듭니다', icon: 'r.cr', quip: '성공 보수는 추후 협의. 협의는 오지 않는다.',
    lv: (n) => `전투 승리 크레딧 -${pc(at(O().pay.win, n))} (반올림)` },
  { id: 'vault', name: '동결의 서약', env: '묶인 계좌', brief: '이자 상한이 줄어듭니다', icon: 'r.dividend', quip: '의뢰주가 이번 의뢰 기간 동안 함대 계좌의 한도를 묶었다.',
    lv: (n) => `이자 상한 -${at(O().vault.cap, n)}` },
  { id: 'wound', name: '패전의 서약', env: '끊긴 보험', brief: '패배할 때 함대 피해가 증가합니다', icon: 'a.bleed', quip: '지면 그만큼 더 잃는다. 보험사는 이미 연락을 끊었다.',
    lv: (n) => `패배할 때 함대 체력 피해 +${pc(at(O().wound.loss, n))}` },
  { id: 'hull', name: '균열의 서약', env: '땜질 안 한 균열', brief: '함대 최대 체력이 줄어듭니다', icon: 'r.hp', quip: '기함 장갑의 균열을 땜질하지 않은 채 출항한다.',
    lv: (n) => `함대 최대 체력 -${at(O().hull.hp, n)}` },
  { id: 'recruit', name: '고립의 서약', env: '한산한 용병 시장', brief: '모집 영입 선택지가 줄어듭니다', icon: 'n.recruit', quip: '이번 항로에 함께하겠다는 용병이 드물다.',
    lv: (n) => `페이즈 시작 · 모집 영입 선택지 -${at(O().recruit.less, n)} (최소 1, 지정 소집 · 특권 제외)` },
  { id: 'augment', name: '침묵의 서약', env: '짧아진 공명', brief: '증강 선택지가 줄어듭니다', icon: 's.mind', quip: '공명의 노래가 1소절 짧아진다.',
    lv: (n) => `메이저 · 스페셜 · 전공 증강 선택지 ${CFG.augmentChoices}장 → ${Math.max(1, CFG.augmentChoices - at(O().augment.less, n))}장` },
  { id: 'abyss', name: '심연의 서약', env: '깊어진 심연', brief: '절망 증강이 늘어납니다', icon: 'k.soul', quip: '절망을 더 일찍, 더 자주 들이마신다.',
    lv: (n) => { const ev = at(O().abyss.every, n); return `출격 때 절망 증강 ${1 + at(O().abyss.start, n)}개${ev ? `, 추가로 고르는 간격 ${CFG.despair.every} → ${ev}페이즈` : ''}`; } },
  { id: 'strip', name: '박탈의 서약', env: '회수된 특전', brief: '특권 증강 새로고침이 줄어듭니다', icon: 'a.power', quip: '후원사들이 특전 목록을 회수해 갔다.',
    lv: (n) => { const k = at(O().strip.choices, n), r = at(O().strip.rerolls, n); return `특권 증강 새로고침 ${r ? `${r}회` : '없음'}${k ? `, 선택지 ${k}장` : ''}`; } },
];
export const OATH_BY_ID: Record<string, OathDef> = Object.fromEntries(OATHS.map((o) => [o.id, o]));

/** 서약 id 의 최고 단계 */
export const oathMax = (id: OathId) => CFG.oath[id].heat.length;
/** r(설정 · 런 · 전투 문맥)에서 서약 id 의 단계 (꺼짐 0, 범위 밖이면 최고 단계로) */
export const oathLv = (r: { oaths?: OathSel } | null | undefined, id: OathId) => Math.max(0, Math.min(oathMax(id), Math.floor(r?.oaths?.[id] || 0)));
/** 서약 값: CFG.oath[id][key] 의 지금 단계 값 (꺼져 있으면 0) */
export function oathV(r: { oaths?: OathSel } | null | undefined, id: OathId, key: string): number {
  const n = oathLv(r, id);
  if (!n) return 0;
  const a = (CFG.oath[id] as unknown as Record<string, readonly number[]>)[key];
  return a ? at(a, n) : 0;
}
/** 서약 id 를 n 단계까지 올렸을 때의 절망 수치 */
export const oathHeatOf = (id: OathId, n: number) => CFG.oath[id].heat.slice(0, Math.max(0, n)).reduce((s, x) => s + x, 0);
/** 설정의 총 절망 수치 */
export const oathHeat = (sel: OathSel | null | undefined) => OATHS.reduce((s, o) => s + oathHeatOf(o.id, oathLv({ oaths: sel || {} }, o.id)), 0);
/** 모든 서약을 최고 단계로 올린 절망 수치 */
export const oathHeatMax = () => OATHS.reduce((s, o) => s + oathHeatOf(o.id, oathMax(o.id)), 0);
/** 켜진 서약 (OATHS 순서) */
export const oathsOn = (sel: OathSel | null | undefined) => OATHS.map((def) => ({ def, n: oathLv({ oaths: sel || {} }, def.id) })).filter((x) => x.n > 0);
/** 한 줄: '강철의 서약 2단계 — 적 최대 체력 +20%' */
export const oathLine = (def: OathDef, n: number) => `${def.name} ${n}단계 — ${def.lv(n)}`;
/** 이 위험 등급 런에 서약이 걸리는지 (고난 이상) */
export const oathDiff = (d: number | undefined) => (d || 0) >= CFG.oathFrom;
/** 런에 옮길 설정: 고난 이상이면 켜진 서약만 (단계는 범위 안으로), 아니면 undefined */
export function oathsFor(diff: number, sel: OathSel | null | undefined): OathSel | undefined {
  if (!oathDiff(diff)) return undefined;
  return Object.fromEntries(oathsOn(sel).map((x) => [x.def.id, x.n]));
}
/** 적 능력치 (buildEnemy): 강철 · 칼날 · 장갑 · 질주 · 거두(보스 체력) · 정예(정예 체력 · 피해). tier = 적 등급 (minion · elite · boss) */
export function oathEnemy(r: { oaths?: OathSel } | null | undefined, st: { maxHp: number; armor: number; effRes: number; atkSpd: number }, c: { phaseAmp: number }, tier: string) {
  if (!r?.oaths) return;
  const eb = tier === 'elite' ? 1 + oathV(r, 'elite', 'buff') : 1;
  st.maxHp *= (1 + oathV(r, 'grit', 'hp')) * (tier === 'boss' ? 1 + oathV(r, 'titan', 'hp') : 1) * eb;
  c.phaseAmp *= (1 + oathV(r, 'pain', 'dmg')) * eb;
  st.armor *= 1 + oathV(r, 'plate', 'armor');
  st.effRes += oathV(r, 'plate', 'res');
  st.atkSpd += oathV(r, 'frenzy', 'atkSpd');
}
/** 절망 증강을 더 고르는 간격 (페이즈): 심연의 서약 2단계면 짧아진다 */
export const oathDespairEvery = (r: { oaths?: OathSel } | null | undefined) => oathV(r, 'abyss', 'every') || CFG.despair.every;
/** 승리 크레딧 배율 (박봉) */
export const oathWinMul = (r: { oaths?: OathSel } | null | undefined) => 1 - oathV(r, 'pay', 'win');
