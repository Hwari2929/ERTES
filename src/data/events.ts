// 사건 노드: 전장별 · 공용 사건. 선택지마다 실제로 판을 흔드는 효과를 준다.
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { Rng } from '../rng';
import type { RunState, UnitState } from '../types';

/** run.ts 가 넘겨주는 조작 함수 (순환 import 방지) */
export interface EventApi {
  rng: <T>(f: (r: Rng) => T) => T;
  gain: (id: string, force?: boolean) => void; // 장비 · 문장 획득 (force: 보관함 한도 무시)
  recruitPick: (k: number) => void; // 영입 선택지 k 개 대기열에 추가
  join: (defId: string) => UnitState | null; // 특정 기물 즉시 합류
  rankUp: (u: UnitState, n: number) => void;
  xp: (amount: number) => void; // 공명도 풀 분배
  globalPick: () => void;
  allItems: () => { where: 'inv' | 'unit'; u?: UnitState; slot: number; id: string }[];
  setItem: (ref: { where: 'inv' | 'unit'; u?: UnitState; slot: number }, id: string | null) => void;
  randomItem: (tier: 'C' | 'G' | 'A' | 'L') => string;
  augNow: (u: UnitState) => string | null; // 전용 증강 하나 즉시 부여, 이름 반환
  phaseBoon: (id: string) => void; // 이번 페이즈 동안 팀 효과
  boon: (id: string) => void; // 영구 팀 효과
  flag: (id: string) => void; // 연계 사건 표식
  chance: (p: number) => boolean; // 확률 판정 (런 시드 기반)
  /** 결과 장면 고르기: 연출의 after[선택지] 가 키별일 때 이 키를 쓴다. vars 는 장면 텍스트의 {이름} 치환 */
  outcome: (key: string, vars?: Record<string, string>) => void;
}

export interface EventChoice {
  label: string;
  desc: string;
  /** 선택 불가 사유 (없으면 선택 가능) */
  block?: (run: RunState) => string | null;
  apply: (run: RunState, api: EventApi) => string;
}
export interface EventDef {
  id: string;
  title: string;
  fields?: string[]; // 없으면 모든 전장
  weight: number; // 1 = 보통, 0.05 = 매우 희귀
  minPhase?: number;
  rare?: boolean; // 도파민 사건 (연출 강조)
  /** 연계 사건: 이 표식이 있어야 등장 */
  req?: string;
  /** 이 표식이 있으면 등장하지 않음 */
  noFlag?: string;
  /** 런당 1회 */
  once?: boolean;
  text: string;
  choices: EventChoice[];
}

import { TUTORIAL_EVENT } from './scenes/tutorial';
import { BOONS_A, STORY_A } from './storyA';
import { BOONS_B, STORY_B } from './storyB';
import { BOONS_C, STORY_C } from './storyC';
import { BOONS_D, STORY_D } from './storyD';

const FACTION_EMBLEMS = ['UNI', 'KAL', 'HEL', 'PET', 'SIR', 'PAN', 'FAM'];
const owns = (run: RunState, id: string) => run.units.some((u) => u.defId === id);
const full = (run: RunState) => (run.units.length >= 16 ? '보유 한도(16명)에 도달했습니다' : null);
const top = (run: RunState) => run.units.slice().sort((a, b) => b.rank - a.rank)[0];

/** 캠페인 「회수 계약」 사건 (전장 id '__camp' = 일반 런 추첨에 나오지 않음, 캠페인 장 정의가 칸마다 고정으로 부른다 — data/campaign.ts) */
const CAMP = ['__camp'];
const hasTape = (r: RunState) => r.inventory.includes('K_cp_tape');
const useTape = (r: RunState) => { const i = r.inventory.indexOf('K_cp_tape'); if (i >= 0) r.inventory.splice(i, 1); };
const phyllisOut = (r: RunState) => r.units.some((u) => u.defId === 'phyllis' && u.pos);
const campTime = (r: RunState, n: number) => { if (r.campaign) { r.campaign.time -= n; r.campaign.spent += n; } };
/** 격리 화물 선택지 (화물칸마다 공통): 신고 = 안전 · 직접 = 보상 + 위험 반반 · 테이프 = 위험 제거 · 필리스 = 정보 (시간을 쓰고 내용물을 본 뒤 다시 고른다) */
const cargoChoices = (tag: string): EventChoice[] => [
  { label: '격리팀에 신고한다', desc: '크레딧 -4. 격리팀이 안전하게 열어 준다: 고급 장비 1개.', block: (r) => (r.credits < 4 ? '크레딧이 부족합니다' : null),
    apply: (r, api) => { r.credits -= 4; api.gain(api.randomItem('G')); return '격리팀이 컨테이너를 열었습니다. 고급 장비 1개.'; } },
  { label: '직접 연다', desc: '희귀 장비 1개. 군체 표본이 섞여 있으면 다음 전투에 포자 살점 2마리가 더 나온다.',
    apply: (r, api) => { api.gain(api.randomItem('A')); if (api.chance(0.5)) { api.flag('cp_sample'); return '희귀 장비를 꺼냈지만, 바닥에서 무언가 꿈틀거렸습니다 — 다음 전투에 포자 살점 +2.'; } return '깨끗한 화물이었습니다. 희귀 장비 1개.'; } },
  { label: '봉인 테이프로 연다', desc: '격리 봉인 테이프 1개를 써서 위험은 봉인하고 희귀 장비 1개만 챙긴다.', block: (r) => (hasTape(r) ? null : '격리 봉인 테이프가 없습니다'),
    apply: (r, api) => { useTape(r); api.gain(api.randomItem('A')); return '봉인 테이프로 입구를 감싸고 열었습니다. 희귀 장비 1개.'; } },
  { label: '필리스가 먼저 들여다본다', desc: 'AH -2. 열기 전에 안에 든 것이 깨끗한지 안다 (그다음 다시 고른다).', block: (r) => (phyllisOut(r) ? null : '필리스가 출전 중이어야 합니다'),
    apply: (r, api) => { campTime(r, 2); const risky = api.chance(0.5); r.pending.push({ t: 'event', id: risky ? 'cp_peek_risky' : 'cp_peek_safe', sub: null }); void tag; return risky ? '필리스: "안에서 뭐가 꿈틀거려-."' : '필리스: "깨끗해-. 그냥 열어."'; } },
];

export const EVENTS: EventDef[] = [
  // ───────── 캠페인 「회수 계약」 1장 · TS-7 환적 정거장
  {
    id: 'cp_phyllis', title: '긴급 조달 중', fields: CAMP, weight: 0,
    text: '화물칸 B-2. 페트라 화물 상자 위에 고양이 귀가 하나 걸터앉아 있다. 필리스가 렌치로 상자 모서리를 따다가 고개를 든다. "아, 지휘관님-. 이거 긴급 조달이야."',
    choices: [
      { label: '같이 가자', desc: '필리스 합류. 필리스가 이미 판 물건 값: 크레딧 +4.', apply: (r, api) => { api.join('phyllis'); r.credits += 4; return '필리스가 합류했습니다. 출전은 여전히 2명 — 누구를 내보낼지 고르세요.'; } },
      { label: '상자는 두고 와', desc: '필리스 합류. 상자 대신 주머니에 있던 격리 봉인 테이프 1개.', apply: (_r, api) => { api.join('phyllis'); api.gain('K_cp_tape', true); return '필리스가 합류했습니다. 상자는 두고 왔습니다 (테이프는 챙겼습니다). 출전은 2명.'; } },
    ],
  },
  {
    id: 'cp_cargo1', title: '격리 화물 — 화물칸 C-7', fields: CAMP, weight: 0,
    text: '적요 번호가 긁혀 나간 컨테이너가 떠 있다. 격리팀 스티커 위로 회백색 포자 자국이 번졌다. 라르스(통신): "열지 말라고는 안 했습니다. 시간이 비용이라는 것만 기억하시죠."',
    choices: cargoChoices('c7'),
  },
  {
    id: 'cp_cargo2', title: '격리 화물 — 화물칸 D-1', fields: CAMP, weight: 0,
    text: '의료 물자 표시가 붙은 냉동 컨테이너. 냉각기는 꺼졌는데 안쪽에서 온기가 올라온다. 비비안: "냄새가 이상해! 리키가 꼬리를 말았어."',
    choices: cargoChoices('d1'),
  },
  {
    id: 'cp_peek_safe', title: '필리스의 확인 — 깨끗함', fields: CAMP, weight: 0,
    text: '필리스가 균열 틈으로 손만 넣어 상자 안을 더듬고 나온다. "부품이야. 반짝이는 거. 위험한 건 없어-."',
    choices: [{ label: '연다', desc: '희귀 장비 1개.', apply: (_r, api) => { api.gain(api.randomItem('A')); return '희귀 장비 1개를 챙겼습니다.'; } }],
  },
  {
    id: 'cp_peek_risky', title: '필리스의 확인 — 꿈틀거림', fields: CAMP, weight: 0,
    text: '균열에서 손을 빼자 장갑 끝에 회백색 실이 묻어 나온다. 필리스: "좋은 부품이랑… 뭐가 같이 들어 있어. 살아 있는 거."',
    choices: [
      { label: '그래도 연다', desc: '희귀 장비 1개 + 다음 전투에 포자 살점 +2.', apply: (_r, api) => { api.gain(api.randomItem('A')); api.flag('cp_sample'); return '부품은 챙겼고, 표본이 빠져나갔습니다 — 다음 전투에 포자 살점 +2.'; } },
      { label: '봉인 테이프로 연다', desc: '격리 봉인 테이프 1개를 써서 희귀 장비 1개만.', block: (r) => (hasTape(r) ? null : '격리 봉인 테이프가 없습니다'), apply: (r, api) => { useTape(r); api.gain(api.randomItem('A')); return '표본은 봉인하고 부품만 꺼냈습니다.'; } },
      { label: '격리팀에 넘긴다', desc: '열지 않는다. 신고 포상금 크레딧 +3.', apply: (r) => { r.credits += 3; return '격리팀이 컨테이너를 통째로 가져갔습니다. 포상금 +3.'; } },
    ],
  },
  {
    id: 'cp_survey', title: '비비안의 둥지 조사', fields: CAMP, weight: 0,
    text: '하역 크레인 쪽 화물칸에서 포자 살점이 줄줄이 쏟아져 나온다. 비비안이 리키의 목줄을 쥔다. "저기 둥지가 크레인을 껴안고 있어! 조금만 냄새 맡게 해 주면 어디가 입구인지 알 수 있어!"',
    choices: [
      { label: '조사한다', desc: 'AH -4. 보스 [적재 군집]의 정체를 미리 알고, 컨테이너 2개를 봉인한 채 싸운다 (포자가 쏟아지는 간격 10초 → 12초). 리키에게 씌운 [리키용 진공 헬멧]도 남는다.',
        apply: (r, api) => { campTime(r, 4); api.flag('cp_intel'); api.gain('P_helmet', true); return '비비안: "크레인에 붙어서 못 움직여! 컨테이너 두 개는 리키가 막았어!" — 보스 정보 확보, 컨테이너 2개 봉인. [리키용 진공 헬멧] 획득.'; } },
      { label: '바로 돌파한다', desc: '시간을 아낀다. 보스는 컨테이너 4개가 모두 열린 채로 맞는다.', apply: () => '비비안: "알았어, 대신 리키는 내 옆에 있을 거야!"' },
    ],
  },

  // ───────── 공용
  {
    id: 'volunteer', title: '자원 입대', weight: 1,
    text: '전장 근처 정거장에서 떠돌이 용병들이 에란테스의 문장을 알아보고 합류를 청한다.',
    choices: [
      { label: '면접을 본다', desc: '기물 3명 중 1명 영입.', block: full, apply: (_r, api) => { api.recruitPick(3); return '면접을 진행합니다.'; } },
      { label: '소개비만 받는다', desc: '에너지 크레딧 +8.', apply: (r) => { r.credits += 8; return '크레딧 +8.'; } },
    ],
  },
  {
    id: 'tinker', title: '고물상의 제안', weight: 1,
    text: '"그거 하나 주면, 두 개 줄게. 뭐가 나올진 나도 몰라." 고물상이 진열대를 두드린다.',
    choices: [
      {
        label: '장비를 맡긴다', desc: '무작위 보유 장비 1개를 같은 등급 무작위 장비 2개로 교체 (전설은 희귀 2개 + 재료 1개).',
        block: (r) => (r.inventory.some((x) => /^[CGAL]_/.test(x)) || r.units.some((u) => u.items.some((x) => x && /^[CGAL]_/.test(x))) ? null : '맡길 장비가 없습니다'),
        apply: (_r, api) => {
          const all = api.allItems();
          const it = api.rng((g) => g.pick(all));
          const t = it.id[0] as 'C' | 'G' | 'A' | 'L';
          api.setItem(it, null);
          const got = t === 'L' ? [api.randomItem('A'), api.randomItem('A'), api.randomItem('C')] : [api.randomItem(t), api.randomItem(t)];
          for (const g of got) api.gain(g, true);
          return `장비 1개를 맡기고 ${got.length}개를 받았습니다.`;
        },
      },
      { label: '그냥 지나간다', desc: '아무 일도 없다.', apply: () => '고물상이 아쉬운 표정을 짓습니다.' },
    ],
  },
  {
    id: 'installment', title: '페트라 분할 정산 상품', weight: 0.8,
    text: '페트라 영업직원이 계약서를 내민다. "이자는 포기하시고, 대신 매번 꼬박꼬박 받으시는 겁니다."',
    choices: [
      { label: '서명한다', desc: '이자 상한 -3. 대신 노드를 지날 때마다 크레딧 +2 (영구).', apply: (r) => { r.mods.interestCap -= 3; r.mods.nodeIncome += 2; return '분할 정산 계약 체결. 노드마다 크레딧 +2.'; } },
      { label: '거절한다', desc: '아무 일도 없다.', apply: () => '"생각 바뀌시면 연락 주세요."' },
    ],
  },
  {
    id: 'drill', title: '합동 훈련', weight: 1,
    text: '빈 격납고를 빌렸다. 하루 정도는 훈련에 쓸 수 있다.',
    choices: [
      { label: '전원 훈련', desc: '공명도 풀 1.5배를 파티 전체에 분배.', apply: (r, api) => { api.xp(Math.round((6 + 3 * r.phase) * 1.5)); return '모두가 조금씩 성장했습니다.'; } },
      {
        label: '집중 훈련', desc: '공명 등급이 가장 낮은 기물 등급 +3.',
        apply: (r, api) => { const u = r.units.slice().sort((a, b) => a.rank - b.rank)[0]; api.rankUp(u, 3); return '한 명이 크게 성장했습니다.'; },
      },
    ],
  },
  {
    id: 'clinic', title: '야전 진료소', weight: 0.8,
    text: '임시 진료소가 문을 열었다. 치료비는 비싸지만 실력은 확실해 보인다.',
    choices: [
      { label: '응급 처치', desc: '플레이어 체력 +20.', apply: (r) => { r.hp = Math.min(r.maxHp, r.hp + 20); return '체력 +20.'; } },
      {
        label: '정밀 검진', desc: '크레딧 -10. 출전 기물 중 무작위 2명 모든 주요 능력치 +2 (영구).',
        block: (r) => (r.credits < 10 ? '크레딧이 부족합니다' : null),
        apply: (r, api) => {
          r.credits -= 10;
          const ts = api.rng((g) => g.sample(r.units.filter((x) => x.pos), 2));
          for (const u of ts) for (const k of ['vit', 'pow', 'mnd', 'def', 'agi'] as const) u.perm[k] += 2;
          return `${ts.length}명 모든 주요 능력치 +2.`;
        },
      },
    ],
  },
  {
    id: 'mingki', title: '밍키가 따라왔다', weight: 0.35,
    text: '보급 상자를 열자 낯익은 고양이가 튀어나온다. 엘베스타드 저택의 밍키다. 어떻게 여기까지 왔는지는 아무도 모른다.',
    choices: [
      { label: '데려간다', desc: '사건 전용 기물 [밍키] 합류.', block: (r) => (owns(r, 'mingki') ? '이미 함께하고 있습니다' : full(r)), apply: (_r, api) => { api.join('mingki'); return '밍키가 합류했습니다. 잘 먹여야 합니다.'; } },
      { label: '츄르를 주고 돌려보낸다', desc: '플레이어 체력 +15.', apply: (r) => { r.hp = Math.min(r.maxHp, r.hp + 15); return '밍키는 츄르만 먹고 사라졌습니다.'; } },
    ],
  },
  {
    id: 'vault', title: '아문센의 보물 창고', weight: 0.04, rare: true, minPhase: 2,
    text: '항로에서 벗어난 소행성 안쪽, 낡은 개조 기체 격납고가 있다. 문에는 "ACE"라고만 적혀 있다. 30년 유랑의 전리품이 그대로 쌓여 있다.',
    choices: [
      {
        label: '전부 챙긴다', desc: '무작위 세력 문장 7개 획득 (보관함 한도 무시).',
        apply: (_r, api) => { const got = api.rng((g) => Array.from({ length: 7 }, () => g.pick(FACTION_EMBLEMS))); for (const s of got) api.gain(`M_${s}`, true); return '세력 문장 7개를 챙겼습니다. 아문센은 아마 모를 겁니다.'; },
      },
    ],
  },
  {
    id: 'faceless', title: '얼굴 없는 중개인', weight: 0.06, rare: true, minPhase: 2,
    text: '"전부 거시죠. 돈도, 당신의 에이스도. 대신 손에 쥔 모든 것을 전설로 바꿔 드리겠습니다."',
    choices: [
      {
        label: '전부 건다', desc: '크레딧을 모두 잃고, 공명 등급이 가장 높은 기물이 이번 페이즈 동안 대기실에 묶인다. 대신 보유 · 장착한 모든 장비가 전설 등급이 된다.',
        apply: (r, api) => {
          r.credits = 0;
          const u = top(r);
          if (u) { u.lock = r.phase; u.pos = null; }
          let n = 0;
          for (const it of api.allItems()) {
            if (it.id[0] === 'A') { api.setItem(it, 'L_' + it.id.slice(2)); n++; }
            else if (it.id[0] === 'C') { api.setItem(it, api.randomItem('L')); n++; }
          }
          return `장비 ${n}개가 전설이 되었습니다. ${u ? '에이스는 이번 페이즈 동안 출전할 수 없습니다.' : ''}`;
        },
      },
      { label: '거절한다', desc: '아무 일도 없다.', apply: () => '중개인은 처음부터 없었던 것처럼 사라졌습니다.' },
    ],
  },

  // ───────── 베르타–산노디스 물류망 (군체)
  {
    id: 'spores', title: '오염 포자 지대', fields: ['swarm'], weight: 1,
    text: '사이오닉장이 끊긴 군체 살점이 기화하며 포자를 뿜는다. 그 아래로 끊긴 물류 컨테이너가 보인다.',
    choices: [
      { label: '돌파한다', desc: '플레이어 체력 -10, 희귀 장비 1개.', apply: (r, api) => { r.hp = Math.max(1, r.hp - 10); const id = api.randomItem('A'); api.gain(id); return '컨테이너에서 희귀 장비를 찾았습니다.'; } },
      { label: '우회한다', desc: '크레딧 +5.', apply: (r) => { r.credits += 5; return '안전하게 돌아갔습니다.'; } },
    ],
  },
  {
    id: 'onyx', title: '의뢰하지 않은 꿈', fields: ['swarm'], weight: 0.8,
    text: '밤새 모두가 같은 꿈을 꾸었다. 아침에 오닉스 합창단의 감응자가 찾아와 그 꿈의 뜻을 안다고 말한다.',
    choices: [
      { label: '합류시킨다', desc: '사건 전용 기물 [오닉스 감응자] 합류.', block: (r) => (owns(r, 'onyx') ? '이미 함께하고 있습니다' : full(r)), apply: (_r, api) => { api.join('onyx'); return '오닉스 감응자가 합류했습니다.'; } },
      {
        label: '꿈을 해석받는다', desc: '무작위 출전 기물 1명이 전용 증강 하나를 즉시 얻는다.',
        apply: (r, api) => { const pool = r.units.filter((u) => u.pos); const u = api.rng((g) => g.pick(pool.length ? pool : r.units)); const n = api.augNow(u); if (n) api.outcome('learn', { aug: n }); else api.outcome('none'); return n ? `꿈에서 [${n}]을(를) 깨달았습니다.` : '아무것도 깨닫지 못했습니다.'; },
      },
    ],
  },
  {
    id: 'convoy', title: '끊긴 보급선', fields: ['swarm'], weight: 0.8,
    text: '연합 수송 함대가 군체에 발이 묶였다. 구출하면 사례를 하겠다고 한다.',
    choices: [
      { label: '호위한다', desc: '이번 페이즈 동안 모든 아군 피해 +15% (연합의 감사), 크레딧 +6.', apply: (r, api) => { api.phaseBoon('convoy'); r.credits += 6; return '이번 페이즈 동안 피해 +15%.'; } },
      { label: '화물만 챙긴다', desc: '재료 2개.', apply: (_r, api) => { api.gain(api.randomItem('C')); api.gain(api.randomItem('C')); return '재료 2개를 챙겼습니다.'; } },
    ],
  },

  // ───────── 크림슨 대공령
  {
    id: 'bloodpact', title: '혈맹 계약', fields: ['crimson'], weight: 1,
    text: '"피는 거짓말을 하지 않지." 혈족 중개인이 은잔을 내민다.',
    choices: [
      { label: '잔을 비운다', desc: '최대 플레이어 체력 -15. 모든 아군 흡혈 +10% (영구).', apply: (r) => { r.maxHp -= 15; r.hp = Math.min(r.hp, r.maxHp); r.boons.push('bloodpact'); return '모든 아군 흡혈 +10%.'; } },
      { label: '정중히 거절한다', desc: '크레딧 +6.', apply: (r) => { r.credits += 6; return '중개인은 웃으며 잔을 거둡니다.'; } },
    ],
  },
  {
    id: 'exile', title: '망명자', fields: ['crimson'], weight: 0.8,
    text: '추격대에 쫓기던 혈족 귀공자가 에란테스의 함선에 숨어들었다. 이름은 버렸다고 한다.',
    choices: [
      { label: '숨겨 준다', desc: '사건 전용 기물 [망명 혈족 귀공자] 합류.', block: (r) => (owns(r, 'exile') ? '이미 함께하고 있습니다' : full(r)), apply: (_r, api) => { api.join('exile'); return '망명 혈족 귀공자가 합류했습니다.'; } },
      { label: '추격대에 넘긴다', desc: '크레딧 +15.', apply: (r) => { r.credits += 15; return '현상금 +15.'; } },
    ],
  },
  {
    id: 'vat', title: '배양조', fields: ['crimson'], weight: 0.8,
    text: '버려진 배양조가 아직 박동하고 있다. 안에 무언가를 넣으면 무언가가 되어 나온다.',
    choices: [
      {
        label: '장비를 넣는다', desc: '무작위 보유 장비 1개를 같은 등급 무작위 장비 2개로 교체.',
        block: (r) => (r.inventory.some((x) => /^[CA]_/.test(x)) || r.units.some((u) => u.items.some((x) => x && /^[CA]_/.test(x))) ? null : '넣을 장비가 없습니다'),
        apply: (_r, api) => {
          const all = api.allItems().filter((x) => x.id[0] === 'C' || x.id[0] === 'A');
          const it = api.rng((g) => g.pick(all));
          const t = it.id[0] as 'C' | 'A';
          api.setItem(it, null);
          api.gain(api.randomItem(t), true); api.gain(api.randomItem(t), true);
          return '배양조에서 장비 2개가 나왔습니다.';
        },
      },
      { label: '불태운다', desc: '이번 페이즈 동안 모든 아군 피해량 경감 10%.', apply: (_r, api) => { api.phaseBoon('purge'); return '이번 페이즈 동안 피해량 경감 10%.'; } },
    ],
  },

  // ───────── 스파르타 전쟁 궤도
  {
    id: 'deserter', title: '탈주 메카', fields: ['sparta'], weight: 1,
    text: '"물러서라"는 명령을 너무 충실히 지킨 호플리테 메카가 궤도 끝에 홀로 서 있다.',
    choices: [
      { label: '받아들인다', desc: '사건 전용 기물 [테르모필레] 합류.', block: (r) => (owns(r, 'thermo') ? '이미 함께하고 있습니다' : full(r)), apply: (_r, api) => { api.join('thermo'); return '테르모필레가 합류했습니다.'; } },
      { label: '분해한다', desc: '희귀 장비 1개.', apply: (_r, api) => { api.gain(api.randomItem('A')); return '쓸 만한 부품을 챙겼습니다.'; } },
    ],
  },
  {
    id: 'ares', title: '아레스의 시험', fields: ['sparta'], weight: 0.8,
    text: '전쟁 궤도의 창구가 잠시 이쪽을 향한다. 시험에 응하면 궤도 함포가 이번 전선에서 에란테스를 지원한다고 한다.',
    choices: [
      { label: '응한다', desc: '플레이어 체력 -15. 이번 페이즈 동안 모든 아군 피해 +30%.', apply: (r, api) => { r.hp = Math.max(1, r.hp - 15); api.phaseBoon('ares'); return '궤도 함포 지원: 이번 페이즈 피해 +30%.'; } },
      { label: '물러선다', desc: '공명도 풀 분배.', apply: (r, api) => { api.xp(6 + 3 * r.phase); return '물러서는 것도 스파르타식입니다.'; } },
    ],
  },

  // ───────── 페트라 본사 성역
  {
    id: 'audit', title: '정보감사실 호출', fields: ['petra'], weight: 1,
    text: '감사번호가 붙기 직전이다. 장부를 제출할지, 버틸지 정해야 한다.',
    choices: [
      { label: '장부를 제출한다', desc: '크레딧 절반을 잃는다. 페트라 문장 1개 + 전역 증강 1개 선택.', apply: (r, api) => { r.credits = Math.floor(r.credits / 2); api.gain('M_PET', true); api.globalPick(); return '감사 통과. 페트라 문장을 받았습니다.'; } },
      { label: '버틴다', desc: '크레딧 +12, 플레이어 체력 -10.', apply: (r) => { r.credits += 12; r.hp = Math.max(1, r.hp - 10); return '감사번호는 피했지만 대가가 있었습니다.'; } },
    ],
  },
  {
    id: 'u404', title: '규격 외 유닉스', fields: ['petra'], weight: 0.8,
    text: '격리 구역 구석에서 생산 목표를 잃은 유닉스 로봇이 같은 동작을 반복하고 있다.',
    choices: [
      { label: '재부팅한다', desc: '사건 전용 기물 [U-404] 합류.', block: (r) => (owns(r, 'u404') ? '이미 함께하고 있습니다' : full(r)), apply: (_r, api) => { api.join('u404'); return 'U-404가 새 생산 목표를 찾았습니다: 에란테스.'; } },
      { label: '고철로 판다', desc: '크레딧 +12.', apply: (r) => { r.credits += 12; return '크레딧 +12.'; } },
    ],
  },

  // ───────── 황무지 성계
  {
    id: 'wreck', title: '난파선', fields: ['waste'], weight: 1,
    text: '주인 없는 수송선이 떠다닌다. 함교에 불이 들어와 있다.',
    choices: [
      {
        label: '탐색한다', desc: '50%: 전설 장비 1개. 50%: 플레이어 체력 -20.',
        apply: (r, api) => (api.rng((g) => g.chance(0.5)) ? (api.gain(api.randomItem('L'), true), api.outcome('legend'), '전설 장비를 찾았습니다!') : ((r.hp = Math.max(1, r.hp - 20)), api.outcome('trap'), '함정이었습니다. 체력 -20.')),
      },
      { label: '무시한다', desc: '아무 일도 없다.', apply: () => '불빛은 곧 꺼졌습니다.' },
    ],
  },
  {
    id: 'turncoat', title: '바르가의 전 부관', fields: ['waste'], weight: 0.8,
    text: '"함장이 배를 잃었을 때 나는 배를 챙겼지." 약탈자 부관이 계약금을 요구한다.',
    choices: [
      { label: '고용한다', desc: '크레딧 -8. 사건 전용 기물 [루스] 합류.', block: (r) => (owns(r, 'rus') ? '이미 함께하고 있습니다' : r.credits < 8 ? '크레딧이 부족합니다' : full(r)), apply: (r, api) => { r.credits -= 8; api.join('rus'); return '루스가 합류했습니다.'; } },
      { label: '현상금을 받는다', desc: '크레딧 +15.', apply: (r) => { r.credits += 15; return '현상금 +15.'; } },
    ],
  },
];
EVENTS.push(...STORY_A, ...STORY_B, ...STORY_C, ...STORY_D);
export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
// 튜토리얼 전용 사건: 사건 창(id 조회)에서만 쓰고 EVENTS(무작위 사건 목록 · 도감)에는 넣지 않는다
EVENT_BY_ID[TUTORIAL_EVENT.id] = TUTORIAL_EVENT;

/** 사건 효과로 생기는 팀 효과: boons(영구) / phaseBoons(이번 페이즈) */
export const BOONS: Record<string, { name: string; effect: Effect }> = {
  bloodpact: { name: '혈맹 계약 (흡혈 +10%)', effect: { stats: { lifesteal: 0.1 } } },
  convoy: { name: '연합의 감사 (피해 +15%)', effect: { mods: [inc('all', 0.15)] } },
  purge: { name: '배양조 소각 (피해량 경감 10%)', effect: { taken: [red('all', 0.1)] } },
  ares: { name: '궤도 함포 지원 (피해 +30%)', effect: { mods: [inc('all', 0.3)] } },
  'hoi.rally': { name: '호이슌 전략 자금 (호이슌 기물 피해 +35%, 쿨다운 감소 속도 +25%)', effect: { setup: (u) => { if (!u.synergies.has('HOI')) return; u.mods.push(inc('all', 0.35)); u.st.cdr += 0.25; } } },
  ...BOONS_A, ...BOONS_B, ...BOONS_C, ...BOONS_D,
};
