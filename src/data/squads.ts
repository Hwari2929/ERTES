// 적 분대 (engine/run.ts genEncounter): 일반 · 역경 · 도전 · 보스 호위의 적을 무작위 낱개 대신 역할 분대로 묶어 조립한다.
// 분대는 진형 배치 (전열 = 앞줄 가운데 · 사격선 = 뒷줄 · 암살조 = 측면 · 포병 듀오 = 뒷줄 + 바로 앞 칸)와 편성 화면 미리보기 ('이번 전투' 분대 목록)를 위한 묶음이고,
// 분대 자체의 세트 효과는 없다. 포병 듀오만 두 칸이 한 기물처럼 체력을 나눠 쓴다 (engine/build.ts linkDuo, CFG.squads.duo).
// 공병단 = 구조물을 세우는 적(EnemyDef.builder) 2명 뒷줄 + 앞 호위 1명. 대형 적(EnemyDef.size: 2×2 · 1×3)은 제 분대 (대형)로 따로 놓인다 (CFG.foeKit.big).
import type { EnemyDef } from './enemies';

/** 적의 분대 역할 (적 정의의 성향 · 사거리에서): 앞 = 근접 · 총 = 원거리 · 암 = 암살형 · 근접 교란형 · 지 = 호위형 · 원거리 교란형 · 공격하지 않는 고정 구조물 (포낭 · 컨테이너 · 둥지 알 등) · 공 = 구조물을 세우는 적.
 *  묶음 적 (EnemyDef.pack): 분대에 뽑히면 그 적 pack 기가 한 묶음으로 나온다 (engine/run.ts assembleSquads, 예산 CFG.squads.pack 명분) */
export type FoeRole = 'front' | 'gun' | 'ambush' | 'support' | 'engineer';
export const roleOf = (e: EnemyDef): FoeRole => (e.builder ? 'engineer' : e.immobile && e.noAttack ? 'support' : e.tend === 'assassin' || (e.tend === 'disrupt' && e.melee) ? 'ambush' : e.tend === 'escort' || e.tend === 'disrupt' ? 'support' : e.melee ? 'front' : 'gun');

export type SquadKind = 'line' | 'fire' | 'ambush' | 'support' | 'duo' | 'engineer' | 'big' | 'mixed' | 'elite' | 'boss';
export interface SquadTpl {
  kind: SquadKind;
  /** 기본 이름 (전장 이름이 없을 때) */
  name: string;
  /** 처음 인원의 역할 */
  slots: FoeRole[];
  /** 인원을 더할 수 있는 역할 · 최대 인원 (남는 예산을 채울 때) */
  grow?: { role: FoeRole; max: number };
  /** 뽑기 무게 · 이 페이즈부터 */
  w: number;
  from?: number;
}
export const SQUADS: SquadTpl[] = [
  { kind: 'line', name: '전열', slots: ['front', 'front'], grow: { role: 'front', max: 4 }, w: 3 },
  { kind: 'fire', name: '사격선', slots: ['gun', 'gun'], grow: { role: 'gun', max: 3 }, w: 2 },
  { kind: 'ambush', name: '암살조', slots: ['ambush', 'ambush'], grow: { role: 'ambush', max: 3 }, w: 2 },
  { kind: 'support', name: '지원조', slots: ['support', 'front'], w: 1.5 },
  { kind: 'duo', name: '포병 듀오', slots: ['gun', 'front'], w: 1.2, from: 2 },
  { kind: 'engineer', name: '공병단', slots: ['engineer', 'engineer', 'front'], w: 1.5, from: 2 },
];
/** 분대 종류 이름 (전장 이름 뒤에 흐리게 붙는 종류) · 아이콘 (성향 아이콘 재사용) */
export const SQUAD_KIND: Record<SquadKind, { name: string; icon: string }> = {
  line: { name: '전열', icon: 't.charge' },
  fire: { name: '사격선', icon: 't.sniper' },
  ambush: { name: '암살조', icon: 't.assassin' },
  support: { name: '지원조', icon: 't.escort' },
  duo: { name: '포병 듀오', icon: 'a.range' },
  engineer: { name: '공병단', icon: 'k.struct' },
  big: { name: '대형', icon: 'u.expand' },
  mixed: { name: '혼성', icon: 'u.area' },
  elite: { name: '정예', icon: 'm.up' },
  boss: { name: '보스', icon: 'n.boss' },
};
/** 전장별 분대 이름 (없으면 기본 이름) */
export const FIELD_SQUAD_NAME: Record<string, Partial<Record<SquadKind, string>>> = {
  swarm: { line: '포자 물결', fire: '산성 분사대', ambush: '사냥 무리', duo: '분사 둥지' },
  crimson: { line: '종자 행렬', fire: '총사 대열', ambush: '사냥개 몰이', support: '수혈 의식', duo: '정맥관 포대' },
  sparta: { line: '팔랑크스', fire: '궤도 사수대', duo: '예인 포대' },
  petra: { line: '보안 집행선', fire: '감시망', ambush: '격리 이탈', duo: '감시 포대' },
  waste: { line: '약탈 돌격대', fire: '사수 엄호', ambush: '척후 습격', support: '공허 설교', duo: '포탑 진지' },
  county: { line: '반상회', fire: '정화 사격', ambush: '산책 나온 이웃', duo: '정화 포대' },
  livin: { line: '포자 무리', fire: '부유 포격', ambush: '프리버드 사냥', duo: '방역 포대' },
  raiden: { line: '폭주 군중', fire: '치안 드론편대', ambush: '전투 등급 습격', support: '생중계 촬영', duo: '단속 거점' },
  crete: { line: '대열', fire: '궁수 대열', ambush: '환영', engineer: '미완의 공사', duo: '망루' },
  olympus: { line: '링 순찰', fire: '포격 포대', support: '축전 정비', duo: '축전 포대' },
  catwheel: { line: '회수 집행', ambush: '메이드 호위', support: '투하 지원', duo: '투하 거점' },
  hyperion: { line: '환전 집행', fire: '창구 업무', ambush: '정찰 순회', duo: '금고 포대' },
  bshak: { line: '기화 행렬', fire: '산성 분사대', ambush: '청어 떼', duo: '분사 둥지' },
};
export const squadName = (field: string, kind: SquadKind) => FIELD_SQUAD_NAME[field]?.[kind] || SQUAD_KIND[kind].name;
