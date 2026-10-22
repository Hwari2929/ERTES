// 업적: 희귀한 사건 · 어려운 계약 · 이상한 조합을 해냈을 때 받는 메달. 보상은 메달과 전시(도감 '업적' 탭 · 바 카운터 뒤 진열장)뿐이고 게임 밸런스에는 영향이 없다.
// 판정은 순수 함수: 훅(ui/achieve.ts)이 런 · 전투 · 사건 · 메타 기록을 '사실(AchFact)' 하나로 요약해 넘기면 test 가 참인지만 본다 (tests/achieve_check.ts).
// 이름 · 설명에 나오는 사건 제목 · 기물 이름 · 장비 이름 · 위험 등급 · 전장 수 · 함대 확장 횟수는 그릴 때마다 데이터 표에서 읽는다.
//   훅 위치: 전투 결과 (main.ts BattleView 끝 → achBattle) · 사건 선택 (event-choice → achEvent, 결과 키는 run.ts lastOutcome)
//            의뢰 성공 (victory-end · victory-endless → achClear) · 튜토리얼 종료 (tutFinish → achTutorial) · 소모품 사용 (use-k → achUse)
//            장면 건너뛰기 (adv.ts 'adv-skip' 이벤트 → run.ach.skip) · 메타 기록이 바뀔 때마다 (meta.ts metaWatch → 사건 · 만담 · 전장 · 위험 등급 기록)
import { CFG } from '../config';
import { FIELDS } from './battlefields';
import { DIFF_PRESETS, MAX_DIFF, diffLabel } from './difficulty';
import { CATWHEEL, PETROCK } from './despair';
import { EVENT_BY_ID } from './events';
import { isCatwheel, itemInfo } from './items';
import { UNIT_BY_ID, UNITS } from './units';
import type { NodeType } from '../types';

export type AchGrade = 'bronze' | 'silver' | 'gold' | 'legend';
export const ACH_GRADES: AchGrade[] = ['legend', 'gold', 'silver', 'bronze'];
export const GRADE_NAME: Record<AchGrade, string> = { bronze: '동', silver: '은', gold: '금', legend: '전설' };

/** 훅이 넘기는 사실 하나 (판정 입력). 모두 직렬화할 수 있는 값만 */
export type AchFact =
  /** 전투 끝 (보상 처리 전): 노드 · 페이즈는 이 전투의 것. allies = 출전한 아군 기물 (소환물 · 포탑 제외) */
  | { k: 'battle'; won: boolean; node: NodeType; phase: number; endless: boolean; tutorial: boolean; allies: { id: string; items: string[]; alive: boolean }[]; fleet: number; streak: number }
  /** 사건 선택지 확정 (outcome = 사건 데이터의 api.outcome 결과 키, 없으면 'default') */
  | { k: 'event'; id: string; choice: number; outcome: string; tutorial: boolean }
  /** 의뢰 성공 (목표 페이즈 보스 격파 뒤 귀환 · 무한 모드 선택). diff = 실효 위험 등급 (절망 서약 반영), skips = 이번 런에서 장면을 건너뛴 횟수 */
  | { k: 'clear'; tutorial: boolean; diff: number; hp: number; losses: number; skips: number; units: string[] }
  /** 튜토리얼 끝 (done = 종장까지 · 아니면 건너뜀) */
  | { k: 'tutorial'; done: boolean; skips: number }
  /** 소모품 사용 성공. foe = 적에게 쓴 경우 그 적의 등급, got = 얻은 장비의 등급 */
  | { k: 'use'; item: string; foe?: 'minion' | 'elite' | 'boss'; got?: string }
  /** 메타 기록 (런 사이에 남는 기록): 성공 수 · 전장별 최고 실효 위험 등급 (절망 서약 반영, ui/meta.ts metaClear) · 겪은 사건 종류 · 바에서 본 만담 수 */
  | { k: 'meta'; clears: number; fieldsCleared: string[]; bestDiff: number; events: number; barSeen: number }
  /** 출격 계약 전표가 화면 위 끝을 넘었다 (riders = 그때 붙은 특약 수) */
  | { k: 'receipt'; riders: number };

export interface AchDef {
  id: string;
  name: string;
  /** 달성 조건 (수치 · 이름은 데이터 표에서 읽는다) */
  desc: () => string;
  grade: AchGrade;
  /** 숨김: 달성 전에는 이름 · 조건이 '???' (hint 만 보인다) */
  hidden?: boolean;
  /** 숨김 업적의 귀띔 (세계관 문장) */
  hint?: string;
  /** 메달 문양: 'li:키' (synicons 선 아이콘) · 'syn:시너지' · 'ty:유형' (속이 찬 아이콘) · 'cx:키' (업적 전용, ui/achieve.ts) · 'num:숫자' (각인) */
  motif: string;
  test: (f: AchFact) => boolean;
}

// ───────── 판정에 쓰는 기준값 (설명문도 이 값을 읽는다)
/** 무한 모드 페이즈 업적 단계 (10 × N, 30 이 상한: 적이 페이즈마다 복리로 강해져 그 너머는 사실상 닿지 않는다) */
export const ENDLESS_STEPS = [10, 20, 30];
export const STREAK_GOAL = 10;
export const BAR_GOAL = 20;
export const EVENT_GOAL = 50;
export const LOW_HP = 10;
export const LAST_ONE_MIN = 4;
/** 가장 어려운 이름 붙은 난이도 (difficulty.ts DIFF_PRESETS 의 마지막 = 고난) */
const hardest = () => DIFF_PRESETS[DIFF_PRESETS.length - 1];
/** 실효 위험 등급 안내: 고난은 절망 서약의 절망 수치 CFG.oathDiffStep 마다 위험 등급 +1 로 친다 (data/difficulty.ts effDiff) */
const effNote = () => `${hardest().name} 의뢰는 절망 서약의 절망 수치 ${CFG.oathDiffStep}마다 위험 등급이 1씩 오른 것으로 친다.`;
const famIds = () => UNITS.filter((u) => u.factions.includes('FAM')).map((u) => u.id);
const ev = (id: string) => `[${EVENT_BY_ID[id]?.title || id}]`;
const un = (id: string) => UNIT_BY_ID[id]?.name || id;
/** 조사: 앞 글자의 받침으로 고른다 (이름은 데이터에서 읽으므로). jo(이름, '을', '를') · 받침이 ㄹ 이면 '로' 는 그대로 */
export function jo(word: string, withB: string, noB: string): string {
  const ch = [...word.replace(/[\])」'"\s]+$/, '')].pop() || '';
  const k = ch.charCodeAt(0) - 0xac00;
  const b = k >= 0 && k < 11172 ? k % 28 : /[013678]$/.test(ch) ? 1 : 0; // 한글이 아니면 숫자 읽기로 (1 일 · 3 삼 …)
  if (noB === '로' && b === 8) return word + noB;
  return word + (b ? withB : noB);
}
const won = (f: AchFact) => f.k === 'battle' && f.won && !f.tutorial;
const bossWin = (f: AchFact, phase = 0) => won(f) && f.k === 'battle' && f.node === 'boss' && f.phase >= phase;
const evIs = (f: AchFact, id: string, pred: (x: Extract<AchFact, { k: 'event' }>) => boolean = () => true) => f.k === 'event' && !f.tutorial && f.id === id && pred(f);
const cleared = (f: AchFact) => f.k === 'clear' && !f.tutorial;

export const ACHIEVEMENTS: AchDef[] = [
  // ───────── 동
  { id: 'first_clear', name: '첫 정산서', grade: 'bronze', motif: 'li:r.flag',
    desc: () => '의뢰를 처음으로 성공한다.',
    test: (f) => f.k === 'meta' && f.clears >= 1 },
  { id: 'tutorial_full', name: '정식 승계', grade: 'bronze', motif: 'li:r.dividend',
    desc: () => '튜토리얼 「당직 근무 중 승계」를 장면 건너뛰기 · 튜토리얼 건너뛰기 없이 종장까지 마친다.',
    test: (f) => f.k === 'tutorial' && f.done && f.skips === 0 },
  { id: 'streak_10', name: '멈추지 않는 항로', grade: 'bronze', motif: 'li:a.speed',
    desc: () => `한 의뢰에서 전투를 ${STREAK_GOAL}연승한다.`,
    test: (f) => won(f) && f.k === 'battle' && f.streak >= STREAK_GOAL },
  { id: 'bar_regular', name: '바의 단골', grade: 'bronze', motif: 'cx:glass',
    desc: () => `에란테스 바에서 만담 ${BAR_GOAL}편을 본다.`,
    test: (f) => f.k === 'meta' && f.barSeen >= BAR_GOAL },
  { id: 'dice_big', name: '한 밑천 잡았다', grade: 'bronze', motif: 'cx:dice',
    desc: () => `사건 ${ev('sd_dice')}의 큰 판에서 크게 딴다.`,
    test: (f) => evIs(f, 'sd_dice', (x) => x.outcome === 'big') },
  { id: 'ferry_win', name: '뱃사공이 진 날', grade: 'bronze', motif: 'li:m.skull', hidden: true,
    hint: '누구도 그가 지는 걸 본 적은 없다고들 한다.',
    desc: () => `사건 ${ev('sd_ferry')}에서 숨결을 걸고 이긴다.`,
    test: (f) => evIs(f, 'sd_ferry', (x) => x.choice === 0 && x.outcome === 'win') },

  // ───────── 은
  { id: 'no_skip_clear', name: '모든 이야기를 들은 자', grade: 'silver', motif: 'li:a.reason',
    desc: () => '한 의뢰 동안 사건 장면 · 미연시를 하나도 건너뛰지 않고 의뢰를 성공한다.',
    test: (f) => cleared(f) && f.k === 'clear' && f.skips === 0 },
  { id: 'endless_10', name: `항로 밖 ${ENDLESS_STEPS[0]}페이즈`, grade: 'silver', motif: `num:${ENDLESS_STEPS[0]}`,
    desc: () => `무한 모드에서 ${ENDLESS_STEPS[0]}페이즈 보스를 쓰러뜨린다.`,
    test: (f) => bossWin(f, ENDLESS_STEPS[0]) },
  { id: 'flawless_boss', name: '무혈 정산', grade: 'silver', motif: 'syn:GUARD',
    desc: () => '보스전에서 출전한 아군 기물을 하나도 잃지 않고 이긴다.',
    test: (f) => bossWin(f) && f.k === 'battle' && f.allies.length > 0 && f.allies.every((a) => a.alive) },
  { id: 'low_hp_clear', name: '간신히 귀환', grade: 'silver', motif: 'li:a.hp',
    desc: () => `플레이어 체력 ${LOW_HP} 이하로 의뢰를 성공한다.`,
    test: (f) => cleared(f) && f.k === 'clear' && f.hp <= LOW_HP },
  { id: 'mingki_throne', name: '함장석의 주인', grade: 'silver', motif: 'cx:cat',
    desc: () => `${jo(un('mingki'), '과', '와')}의 협상 끝에 이어지는 사건 ${jo(ev('sa_mingki_throne'), '을', '를')} 겪는다.`,
    test: (f) => evIs(f, 'sa_mingki_throne') },
  { id: 'argo_home', name: '여기가 집입니까', grade: 'silver', motif: 'syn:VOYAGE',
    desc: () => `유령선 아르고 연계의 끝, 사건 ${ev('sc_argo_home')}에 이른다.`,
    test: (f) => evIs(f, 'sc_argo_home') },
  { id: 'zeus_jackpot', name: '번개가 고른 이름', grade: 'silver', motif: 'syn:COND', hidden: true,
    hint: '피뢰침에 이름표를 달아 세워 두는 행성이 있다.',
    desc: () => `사건 ${ev('sc_zeus')}에서 전설 장비에 당첨된다.`,
    test: (f) => evIs(f, 'sc_zeus', (x) => x.outcome === 'jackpot') },
  { id: 'amundsen_box', name: '30년 묵은 상자', grade: 'silver', motif: 'li:n.supply', hidden: true,
    hint: '단장의 긴 이야기 속에는 늘 쓸 만한 것이 하나쯤 섞여 있다.',
    desc: () => `사건 ${ev('sa_amundsen_bar')}에서 ${un('amundsen')}의 낡은 상자를 열어 전설 장비를 받는다.`,
    test: (f) => evIs(f, 'sa_amundsen_bar', (x) => x.outcome === 'legend') },
  { id: 'last_one', name: '최후의 1인', grade: 'silver', motif: 'ty:VAN', hidden: true,
    hint: '끝까지 서 있는 사람이 정산서에 서명한다.',
    desc: () => `아군 기물 ${LAST_ONE_MIN}명 이상으로 보스전에 나서, 1명만 남은 채 이긴다.`,
    test: (f) => bossWin(f) && f.k === 'battle' && f.allies.length >= LAST_ONE_MIN && f.allies.filter((a) => a.alive).length === 1 },

  // ───────── 금
  { id: 'hard_clear', name: '절망을 짊어진 귀환', grade: 'gold', motif: 'li:n.boss',
    desc: () => `${diffLabel(hardest().lvl)} 이상의 의뢰를 성공한다.`,
    test: (f) => f.k === 'meta' && f.bestDiff >= hardest().lvl }, // bestDiff = 실효 위험 등급
  { id: 'endless_20', name: `항로 밖 ${ENDLESS_STEPS[1]}페이즈`, grade: 'gold', motif: `num:${ENDLESS_STEPS[1]}`,
    desc: () => `무한 모드에서 ${ENDLESS_STEPS[1]}페이즈 보스를 쓰러뜨린다.`,
    test: (f) => bossWin(f, ENDLESS_STEPS[1]) },
  { id: 'no_loss_clear', name: '무패 계약', grade: 'gold', motif: 'ty:special',
    desc: () => '전투에서 한 번도 지지 않고 의뢰를 성공한다.',
    test: (f) => cleared(f) && f.k === 'clear' && f.losses === 0 },
  { id: 'all_fields', name: '은하 순회 정산', grade: 'gold', motif: 'syn:PAN',
    desc: () => `모든 전장 ${FIELDS.length}곳에서 의뢰를 성공한다.`,
    test: (f) => f.k === 'meta' && FIELDS.every((x) => f.fieldsCleared.includes(x.id)) },
  { id: 'fleet_full', name: '함대 완편', grade: 'gold', motif: 'syn:STL',
    desc: () => `함대 확장을 ${CFG.fleetCosts.length}번 모두 마친 함대로 전투에서 이긴다.`,
    test: (f) => won(f) && f.k === 'battle' && f.fleet >= CFG.fleetCosts.length },
  { id: 'family_all', name: '엘베스타드 일가 총출동', grade: 'gold', motif: 'syn:FAM',
    desc: () => `엘베스타드 일가 ${famIds().length}명(${famIds().map(un).join(' · ')})을 모두 출전시켜 전투에서 이긴다.`,
    test: (f) => won(f) && f.k === 'battle' && famIds().every((id) => f.allies.some((a) => a.id === id)) },
  { id: 'seize_boss', name: '강제 징수 집행', grade: 'gold', motif: 'li:k.seize',
    desc: () => `${jo(itemInfo('K_seize').name, '으로', '로')} 보스의 전설 장비를 떼어 낸다.`,
    test: (f) => f.k === 'use' && f.item === 'K_seize' && f.foe === 'boss' && !!f.got && itemInfo(f.got).tier === 'L' },
  { id: 'receipt_long', name: '끝나지 않는 영수증', grade: 'bronze', motif: 'li:k.note', hidden: true,
    hint: '에이든의 전표 출력기는 종이가 떨어진 적이 없다고 한다.',
    desc: () => '출격 계약에서 특약을 6건 넘게 붙여 전표를 화면 위로 넘기거나, 12건을 붙인다.',
    test: (f) => f.k === 'receipt' && f.riders >= 6 },
  { id: 'events_50', name: '항해일지 수집가', grade: 'gold', motif: 'li:n.event',
    desc: () => `서로 다른 사건 ${EVENT_GOAL}종을 겪는다.`,
    test: (f) => f.k === 'meta' && f.events >= EVENT_GOAL },
  { id: 'vault', name: 'ACE라고 적힌 문', grade: 'gold', motif: 'li:r.key', hidden: true,
    hint: '항로에서 벗어난 소행성 안쪽에 낡은 개조 기체 격납고가 있다고 한다.',
    desc: () => `아주 드문 사건 ${jo(ev('vault'), '을', '를')} 겪는다.`,
    test: (f) => evIs(f, 'vault') },
  { id: 'faceless', name: '얼굴 없는 거래', grade: 'gold', motif: 'cx:mask', hidden: true,
    hint: '손에 쥔 모든 것을 전설로 바꿔 준다는 중개인이 있다. 대가는 묻지 않는 편이 좋다.',
    desc: () => `아주 드문 사건 ${ev('faceless')}에서 전부 건다.`,
    test: (f) => evIs(f, 'faceless', (x) => x.choice === 0) },

  // ───────── 전설
  { id: 'max_clear', name: '계약서의 마지막 칸', grade: 'legend', motif: 'syn:KAL',
    desc: () => `위험 등급표의 마지막 칸, ${diffLabel(MAX_DIFF)} 이상의 의뢰를 성공한다. ${effNote()}`,
    test: (f) => f.k === 'meta' && f.bestDiff >= MAX_DIFF }, // bestDiff = 실효 위험 등급: 고난 + 절망 수치 (MAX_DIFF − 고난) × CFG.oathDiffStep 이상이면 달성
  { id: 'endless_30', name: `항로 밖 ${ENDLESS_STEPS[2]}페이즈`, grade: 'legend', motif: `num:${ENDLESS_STEPS[2]}`,
    desc: () => `무한 모드에서 ${ENDLESS_STEPS[2]}페이즈 보스를 쓰러뜨린다.`,
    test: (f) => bossWin(f, ENDLESS_STEPS[2]) },
  { id: 'petrock_clear', name: '돌과 함께 귀환', grade: 'legend', motif: 'li:k.struct', hidden: true,
    hint: '유닉스가 보내온 위로 선물. 단장이 아끼는 돌이라 두고 갈 수도 없다.',
    desc: () => `절망 증강이 보낸 ${jo(un(PETROCK), '을', '를')} 데리고 의뢰를 성공한다.`,
    test: (f) => cleared(f) && f.k === 'clear' && f.units.includes(PETROCK) },
  { id: 'catwheel', name: '고양이라면 또 모르겠다', grade: 'legend', motif: 'li:i.catwheel', hidden: true,
    hint: '아무 기능이 없는 유닉스제 잡동사니도, 임자를 만나면 이야기가 달라진다.',
    desc: () => `${un('mingki')}에게 ${jo(itemInfo(CATWHEEL).name, '을', '를')} 달고 ${jo(un('oliver'), '과', '와')} 함께 출전해 전투에서 이긴다.`,
    test: (f) => won(f) && f.k === 'battle' && f.allies.some((a) => a.id === 'mingki' && a.items.some(isCatwheel)) && f.allies.some((a) => a.id === 'oliver') },
];
export const ACH_BY_ID: Record<string, AchDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** 판정 (순수): 이 사실로 새로 달성한 업적 id. got = 이미 달성한 업적 */
export function judge(f: AchFact, got: Record<string, unknown> = {}): string[] {
  return ACHIEVEMENTS.filter((a) => !got[a.id] && a.test(f)).map((a) => a.id);
}
/** 바 진열장 칸 수 */
export const SHOWCASE_MAX = 3;
