// 사이오닉 비술 · 지속 능력의 상세 정보 (전투 스킬과 같은 형식: 대상 · 사거리 · 범위 · 항목별 토큰 문장)
import type { SkillInfo } from './abiltext';
import type { SchoolId } from './schools';

/** 비술: 쿨다운 · 이성 소모는 SCHOOLS 의 cantrip 에서 */
export const CANTRIP_INFO: Record<SchoolId, SkillInfo> = {
  pyro: { tgt: '연소 중첩이 가장 많은 적 (없으면 현재 대상)', range: null, area: { k: 'around', r: 1 }, rows: [
    ['피해', '대상과 주변 [t:1] 적 [dmg:main:0.6:phys]'],
    ['소모', '대상의 [g:burn] 제거, 중첩 1당 [dmg:main:0.5:phys]'],
    ['연소 없음', '[g:burn] 2중첩'],
  ] },
  chrono: { tgt: '서로 다른 적 3명 (적이 적으면 중복)', range: null, area: { k: 'one' }, rows: [
    ['피해', '파편 3발, 각각 [dmg:main:0.5:phys]'],
    ['빙결', '각 [st:freeze:2:0.25] ([g:chill] 1중첩당 [pp:0.1])'],
    ['소모', '빙결되면 오한 중첩 전부 제거'],
  ] },
  volt: { tgt: '현재 대상', range: null, area: { k: 'one' }, rows: [
    ['피해', '[dmg:main:0.9:elec]'],
    ['전도', '[g:conduct] 2중첩'],
  ] },
  wave: { tgt: '현재 대상', range: null, area: { k: 'one' }, rows: [
    ['피해', '[dmg:main:0.7:elec]'],
    ['밀쳐내기', '[t:1] 밀쳐냄 (보스 제외)'],
    ['공진', '[s:5] [g:resonance]'],
  ] },
  seed: { tgt: '현재 대상', range: null, area: { k: 'one' }, rows: [
    ['피해', '[dmg:main:0.4:chem]'],
    ['중독', '[g:poison] 2중첩 ([s:5], 중첩당 초당 [dmg:main:0.1:chem])'],
  ] },
  mind: { tgt: '현재 대상과 주변 적 (최대 3명)', range: null, area: { k: 'around', r: 1 }, rows: [
    ['결속', '[s:5] [g:bond]: 받는 피해 +[p:0.1], 받은 피해의 [p:0.25]를 다른 결속 대상이 나눠 받음'],
    ['매혹', '대상이 일반 적이면 [st:charm:1.5]'],
  ] },
  gold: { tgt: '자신', range: 0, area: { k: 'self', r: 0 }, rows: [
    ['확률', '[p:0.4] + [p:0.5] × |이성|/100'],
    ['성공', '무작위 재료 장비 1개를 [g:tempgear] (최대 3개)'],
    ['실패', '체력이 가장 낮은 아군에게 [shield:0.8:main]'],
  ] },
  illusion: { tgt: '현재 대상 근처 빈칸', range: null, area: { k: 'around', r: 1 }, rows: [
    ['소환', '[g:illusion] 1기 ([s:6], 최대 2기, 체력 = 자신 최대 체력 [p:0.3])'],
    ['도발', '주변 [t:1] 적은 환영을 우선 공격 ([g:taunt])'],
  ] },
};

/** 지속 능력: 발동 조건 · 효과 */
export const PASSIVE_INFO: Record<SchoolId, [string, string][]> = {
  pyro: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.25]'], ['효과', '[g:burn] 1중첩: 중첩당 초당 [dmg:main:0.12:phys]'], ['중첩', '최대 5 · [s:5] · 걸 때마다 갱신']],
  chrono: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.3]'], ['효과', '[g:chill] 1중첩: 중첩당 초당 [dmg:main:0.04:phys], 이동 · 공격 속도 -8%p, 빙결 확률 [pp:0.1]'], ['중첩', '최대 4 · [s:5]']],
  volt: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.25]'], ['효과', '[g:conduct] 1중첩: 대상이 행동할 때마다 주변 [t:1] 다른 적에게 중첩당 [dmg:main:0.15:elec]'], ['중첩', '최대 3 · [s:5]']],
  wave: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.2]'], ['효과', '[s:5] [g:resonance]: 피격될 때마다 주변 [t:1] 적에게 [dmg:main:0.15:elec] (0.5초에 1회)']],
  seed: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.25]'], ['효과', '[g:poison] 1중첩'], ['중첩', '최대 3']],
  mind: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.15]'], ['효과', '[st:confuse:1]: 가까운 아무나 공격 (같은 편 포함)']],
  gold: [['조건', '[g:tempgear] 1개당'], ['효과', '주는 피해 +[p:0.05], [g:red] +[p:0.03]']],
  illusion: [['발동', '평타 · 전투 스킬 · 비술 적중 시 [p:0.2]'], ['효과', '[st:scent:4]: 회피 [pp:-0.15], 받는 피해 +[p:0.08]']],
};
/** 지속 능력 한 줄 요약 (섹션 카드용) */
export const PASSIVE_BRIEF: Record<SchoolId, string> = {
  pyro: '적중 시 25% 연소', chrono: '적중 시 30% 오한', volt: '적중 시 25% 전도', wave: '적중 시 20% 공진',
  seed: '적중 시 25% 중독', mind: '적중 시 15% 혼란', gold: '임시 장비당 피해 +5% · 경감 +3%', illusion: '적중 시 20% 향취',
};
/** 전공 핵심 한 줄 (전공 선택 카드용) */
export const SCHOOL_LINE: Record<SchoolId, string> = {
  pyro: '연소를 쌓아 두었다가 비술로 한꺼번에 터뜨린다.',
  chrono: '오한을 쌓아 적을 느리게 하고, 끝내 얼려 버린다.',
  volt: '전도된 적이 움직일 때마다 주변 적에게 번개가 튄다.',
  wave: '충격파로 밀쳐내고, 맞을수록 퍼지는 공진을 건다.',
  seed: '중독을 쌓아 적을 천천히 갉아먹는다.',
  mind: '적을 서로 묶고 홀려서 혼란에 빠뜨린다.',
  gold: '임시 장비를 연성해 쌓을수록 강해진다.',
  illusion: '환영으로 적의 공격을 끌어내고 향취로 약하게 만든다.',
};
