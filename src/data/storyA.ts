// 이야기 사건 묶음 A — 함선 생활 · 엘베스타드 일가
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { EventApi, EventDef } from './events';
import type { Major, RunState, UnitState } from '../types';

export const BOONS_A: Record<string, { name: string; effect: Effect }> = {
  a_stew: { name: '구닐라의 보양식 (최대 체력 +10%)', effect: { pct: { maxHp: 0.1 } } },
  a_watchdog: { name: '맥스의 순찰 (피해량 경감 6%)', effect: { taken: [red('all', 0.06)] } },
  a_encore: { name: '흰사슴의 앙코르 (피해 +15%)', effect: { mods: [inc('all', 0.15)] } },
  a_catluck: { name: '함장석의 고양이 (치명타 확률 +8%)', effect: { stats: { crit: 0.08 } } },
};

// ───────── 보조 함수
const unit = (r: RunState, id: string) => r.units.find((u) => u.defId === id);
const need = (id: string, name: string) => (r: RunState) => (unit(r, id) ? null : `[${name}] 기물이 없습니다`);
const cost = (n: number) => (r: RunState) => (r.credits < n ? `크레딧이 부족합니다 (${n} 필요)` : null);
const heal = (r: RunState, n: number) => { r.hp = Math.min(r.maxHp, r.hp + n); };
const hurt = (r: RunState, n: number) => { r.hp = Math.max(1, r.hp - n); };
/** 출전 기물 우선으로 무작위 1명 */
const anyUnit = (r: RunState, api: EventApi): UnitState | null => {
  const pool = r.units.filter((u) => u.pos);
  const list = pool.length ? pool : r.units;
  return list.length ? api.rng((g) => g.pick(list)) : null;
};
const nm = (u: UnitState | null | undefined) => (u ? u.defId : '');
const NAME: Record<string, string> = {
  yelena: '예레나', mirinae: '미리내', gebek: '게베크', donovan: '도노반', chloe: '클로에', west: '웨스트', lindiwe: '린디웨', orca: '오르카',
  franze: '프란체', grenholm: '그렌홀름', lars: '라르스', falcon: '팔콘', hiiro: '히이로', nadir: '나디르', temur: '테무르', kairo: '카이로',
  zahara: '자하라', bianca: '비앙카', zephyro: '제피로', phyllis: '필리스', eleni: '엘레니', iris: '이리스', odysseus: '오디세우스', argon: '아르곤',
  romani: '로마니', joshua: '조슈아', sarma: '사르마', kyle: '카일', doros: '도로스', demiurgos: '데미우르고스', aiden: '에이든', vivian: '비비안',
  yupito: '유피토', ingel: '잉겔', amundsen: '아문센', rachel: '레이첼', oliver: '올리버', rasmus: '라스무스', sigmund: '시그문드', gunnir: '구닐라', mingki: '밍키',
};
const who = (u: UnitState | null | undefined) => (u ? NAME[nm(u)] || '단원' : '단원');
const buff = (u: UnitState | null | undefined, k: Major, n: number) => { if (u) u.perm[k] += n; };

export const STORY_A: EventDef[] = [
  // ───────── 연계 ①: 맥스의 땅굴 → 덕트 속의 보물창고
  {
    id: 'sa_max_lost', title: '맥스의 땅굴', weight: 0.8, once: true,
    text: '아침 점호에 맥스가 없다. 화물칸 바닥판 하나가 들려 있고, 그 아래 정비 덕트 안쪽으로 발톱 자국이 길게 이어져 있다. 정원이 없는 함선에서 정원견은 대체 무엇을 파고 있었던 걸까. 라스무스는 말없이 손전등을 챙기고 있다.',
    choices: [
      {
        label: '직접 덕트로 기어든다', desc: '플레이어 체력 -8. 맥스의 흔적을 쫓는다 (연계 사건).',
        apply: (r, api) => { hurt(r, 8); api.flag('a_max_trail'); return '무릎이 다 까졌지만, 덕트 깊숙이 이어진 발자국을 찾았습니다.'; },
      },
      {
        label: '육포로 유인한다', desc: '크레딧 -6. 60%: 맥스가 재료 1개를 물고 돌아온다 / 40%: 육포만 사라진다.',
        block: cost(6),
        apply: (r, api) => {
          r.credits -= 6;
          if (api.chance(0.6)) { api.gain(api.randomItem('C')); api.outcome('ok'); return '맥스가 꼬리를 흔들며 나왔습니다. 입에 뭔가를 물고 있습니다. 재료 1개 획득.'; }
          api.outcome('fail');
          return '육포는 사라졌고, 맥스는 끝내 나오지 않았습니다.';
        },
      },
      {
        label: '라스무스에게 맡긴다', desc: '라스무스 공명 등급 +1. 맥스의 흔적을 쫓는다 (연계 사건).',
        block: need('rasmus', '라스무스'),
        apply: (r, api) => { const u = unit(r, 'rasmus'); if (u) api.rankUp(u, 1); api.flag('a_max_trail'); return '라스무스는 휘파람 한 번으로 덕트의 구조를 파악했습니다. 40년 동안 두더지를 쫓은 사람답습니다.'; },
      },
    ],
  },
  {
    id: 'sa_max_den', title: '덕트 속의 보물창고', weight: 2.5, req: 'a_max_trail', once: true,
    text: '덕트 끝, 공조기 뒤편의 따뜻한 공간에서 맥스를 찾았다. 녀석은 거기에 소굴을 차려 놓았다. 클로에의 약병, 도노반의 드론 프로펠러, 레이첼의 간식 봉지, 그리고 아문센이 잃어버렸다고 투덜대던 낡은 연합군 훈장까지. 맥스는 자랑스럽다는 듯 꼬리를 흔든다.',
    choices: [
      {
        label: '주인들에게 돌려준다', desc: '공명도 +14를 파티에 분배.',
        apply: (_r, api) => { api.xp(14); return '물건을 돌려받은 단원들이 한동안 맥스를 쓰다듬느라 바빴습니다.'; },
      },
      {
        label: '쓸 만한 것만 챙긴다', desc: '희귀 장비 1개. 50%: 물건 주인에게 들켜 크레딧 -8.',
        apply: (r, api) => {
          api.gain(api.randomItem('A'));
          if (api.chance(0.5)) { r.credits = Math.max(0, r.credits - 8); api.outcome('caught'); return '희귀 장비를 챙겼지만, 도노반이 프로펠러 값을 청구했습니다. 크레딧 -8.'; }
          api.outcome('clean');
          return '희귀 장비를 챙겼습니다. 아무도 눈치채지 못했습니다.';
        },
      },
      {
        label: '소굴을 맥스에게 허락한다', desc: '모든 아군 피해량 경감 6% (영구). 크레딧 -10 (공조기 개조비).',
        block: cost(10),
        apply: (r, api) => { r.credits -= 10; api.boon('a_watchdog'); return '맥스는 이제 덕트 순찰견입니다. 함선 구석구석에서 수상한 소리가 나면 맥스가 먼저 짖습니다.'; },
      },
    ],
  },

  // ───────── 연계 ②: 새벽의 기타 소리 → 유출 음원 → 기습 공연
  {
    id: 'sa_ingel_guitar', title: '새벽의 기타 소리', weight: 0.8, once: true,
    text: '새벽 세 시, 빈 격납고에서 서툰 기타 소리가 들린다. 코드 전환마다 한 박자씩 늦고, 가끔 짜증 섞인 한숨이 섞인다. 문틈으로 보니 금회색 머리의 잉겔이 혼자 앉아 있다. 은하 대스타가 이렇게 못 치는 악기가 있다는 사실은, 아마 이 함선에서 당신만 알고 있다.',
    choices: [
      {
        label: '모른 척 지나간다', desc: '플레이어 체력 +10.',
        apply: (r) => { heal(r, 10); return '조용히 돌아가 다시 잠을 청했습니다. 이상하게 푹 잤습니다.'; },
      },
      {
        label: '들어가서 조언한다', desc: '50%: 공명도 +12 분배 / 50%: 자존심이 상한 잉겔이 기타줄을 끊는다, 크레딧 -6.',
        apply: (r, api) => {
          if (api.chance(0.5)) { api.xp(12); api.outcome('ok'); return '"…한 번만 더 보여 줘." 둘은 해가 뜰 때까지 연습했습니다.'; }
          r.credits = Math.max(0, r.credits - 6); api.outcome('snap'); return '"누가 물어봤어?" 기타줄이 끊어졌고, 줄값은 당신이 냈습니다. 크레딧 -6.';
        },
      },
      {
        label: '몰래 녹음한다', desc: '아무 일도 없다. 이 파일을 어떻게 쓸지는 나중 문제다 (연계 사건).',
        apply: (_r, api) => { api.flag('a_ingel_tape'); return '3분 42초짜리 파일이 저장되었습니다. 제목은 "새벽.wav".'; },
      },
    ],
  },
  {
    id: 'sa_ingel_leak', title: '유출 음원', weight: 2.5, req: 'a_ingel_tape', once: true,
    text: '"새벽.wav"가 어째서인지 함내 공용 채널에 올라갔고, 몇 시간 뒤에는 스타페어 팬덤 흰사슴의 게시판까지 퍼졌다. 서툰 기타 위로 흥얼거린 멜로디가 오히려 진짜 같다며 반응이 뜨겁다. 잉겔이 함교 문을 열고 들어와, 금빛과 푸른빛 눈으로 당신을 정확히 겨눈다.',
    choices: [
      {
        label: '진심으로 사과한다', desc: '잉겔 보유 시 잉겔 공명 등급 +1, 아니면 공명도 +8 분배.',
        apply: (r, api) => {
          const u = unit(r, 'ingel');
          if (u) { api.rankUp(u, 1); api.outcome('ingel'); return '잉겔은 한참 노려보다가 "다음엔 제대로 친 걸로 녹음해"라고 말했습니다. 잉겔 공명 등급 +1.'; }
          api.xp(8); api.outcome('post'); return '사과문은 함내 공용 채널에 올라갔습니다. 단원들이 즐거워했습니다. 공명도 +8.';
        },
      },
      {
        label: '수익을 나누자고 한다', desc: '크레딧 +15, 명성 +2. 잉겔이 정식 무대를 준비한다 (연계 사건).',
        apply: (r, api) => { r.credits += 15; r.fame += 2; api.flag('a_ingel_debut'); return '"…7 대 3. 내가 7." 협상은 3초 만에 끝났습니다. 크레딧 +15, 명성 +2.'; },
      },
      {
        label: '내가 한 게 아니라고 한다', desc: '60%: 의심이 도노반에게 향한다, 크레딧 +6 / 40%: 거짓말이 들켜 플레이어 체력 -12.',
        apply: (r, api) => {
          if (api.chance(0.6)) { r.credits += 6; api.outcome('ok'); return '모두가 도노반을 쳐다봤습니다. 도노반은 호랑이 사료값을 걸고 결백을 주장했습니다. 크레딧 +6.'; }
          hurt(r, 12); api.outcome('caught'); return '녹음 파일의 메타데이터에 당신의 단말기 번호가 찍혀 있었습니다. 체력 -12.';
        },
      },
    ],
  },
  {
    id: 'sa_ingel_stage', title: '기습 공연', weight: 2.5, req: 'a_ingel_debut', once: true,
    text: '잉겔이 정박지 광장에 즉석 무대를 세웠다. 마이크 대신 기타를 멘 것은 데뷔 이후 처음이다. 공지 한 줄에 흰사슴들이 몰려들었고, 정박지 관리국은 허가증을 요구하며 서류를 흔든다. 무대 뒤에서 잉겔이 손을 떨고 있는 것을 본 사람은 당신뿐이다.',
    choices: [
      {
        label: '무대를 지킨다', desc: '이번 페이즈 동안 모든 아군 피해 +15%.',
        apply: (_r, api) => { api.phaseBoon('a_encore'); return '공연은 앙코르 세 번으로 끝났습니다. 단원들의 사기가 하늘을 찌릅니다.'; },
      },
      {
        label: '굿즈를 판다', desc: '크레딧 +12, 명성 +3.',
        apply: (r) => { r.credits += 12; r.fame += 3; return '즉석 제작한 "새벽.wav" 티셔츠가 완판되었습니다. 크레딧 +12, 명성 +3.'; },
      },
      {
        label: '함께 무대에 오른다', desc: '50%: 모든 아군 피해 +15% (영구) / 50%: 대참사, 플레이어 체력 -15, 명성 +1.',
        apply: (r, api) => {
          if (api.chance(0.5)) { api.boon('a_encore'); api.outcome('ok'); return '당신의 탬버린은 의외로 박자가 맞았습니다. 이 공연은 에란테스의 전설이 되었습니다.'; }
          hurt(r, 15); r.fame += 1; api.outcome('fail'); return '탬버린이 날아가 관리국 직원에게 맞았습니다. 체력 -15. 그래도 영상은 조회수가 꽤 나왔습니다.';
        },
      },
    ],
  },

  // ───────── 연계 ③: 가주와 고양이의 협상 → 함장석의 주인
  {
    id: 'sa_mingki_deal', title: '가주와 고양이의 협상', weight: 0.8, once: true,
    text: '라르스 가주가 함교 함장석 앞에 무릎을 꿇고 있다. 정확히는 함장석 위에 식빵 자세로 앉은 밍키 앞에. 페트라 무역관세부장이 고양이를 상대로 일곱 번째 협상안을 제시하는 중이다. "츄르 두 개, 그리고 오후 햇살 자리 독점권." 밍키는 하품을 한다.',
    choices: [
      {
        label: '라르스의 협상을 후원한다', desc: '크레딧 -8. 60%: 밍키가 자리를 비키고 라르스가 고마워한다, 크레딧 +16 / 40%: 츄르만 사라진다.',
        block: cost(8),
        apply: (r, api) => {
          r.credits -= 8;
          if (api.chance(0.6)) { r.credits += 16; api.outcome('ok'); return '밍키가 기지개를 켜고 내려왔습니다. 라르스는 이 승리를 기념해 상여금을 지급했습니다. 크레딧 +16.'; }
          api.outcome('fail');
          return '밍키는 츄르를 다 먹고 다시 식빵 자세로 돌아갔습니다. 라르스: "…장기전으로 가지."';
        },
      },
      {
        label: '함장석을 밍키에게 내준다', desc: '아무 일도 없다. 당분간 함교의 주인은 밍키다 (연계 사건).',
        apply: (_r, api) => { api.flag('a_mingki_throne'); return '라르스가 처음으로 협상에서 졌습니다. 밍키는 만족스럽게 눈을 감았습니다.'; },
      },
      {
        label: '아문센을 부른다', desc: '공명도 +10 분배.',
        apply: (_r, api) => { api.xp(10); return '아문센은 밍키를 번쩍 들어 자기 무릎에 앉히고 함장석에 앉았습니다. 모두가 무언가를 배웠습니다. 무엇인지는 모르겠지만.'; },
      },
    ],
  },
  {
    id: 'sa_mingki_throne', title: '함장석의 주인', weight: 2.5, req: 'a_mingki_throne', once: true,
    text: '밍키가 함장석을 차지한 지 사흘째. 이상하게도 항해가 순조롭다. 밍키가 꼬리로 콘솔을 툭 칠 때마다 경로가 미세하게 바뀌는데, 그때마다 해적 매복이나 유성우를 아슬아슬하게 비껴간다. 항법사들은 이걸 기록해야 할지 고민 중이다. 밍키의 밥그릇은 비어 있다.',
    choices: [
      {
        label: '정식 항법관으로 임명한다', desc: '크레딧 -12 (최고급 사료 정기 구독). 모든 아군 치명타 확률 +8% (영구).',
        block: cost(12),
        apply: (r, api) => { r.credits -= 12; api.boon('a_catluck'); return '밍키 항법관 임명식이 열렸습니다. 밍키는 임명장 위에서 잠들었습니다.'; },
      },
      {
        label: '항로 데이터를 판다', desc: '70%: 크레딧 +15 / 30%: 데이터가 고양이 낙서였다, 아무것도 없다.',
        apply: (r, api) => {
          if (api.chance(0.7)) { r.credits += 15; api.outcome('ok'); return '정보상은 이 경로 데이터를 비싸게 사 갔습니다. 출처는 묻지 않았습니다. 크레딧 +15.'; }
          api.outcome('doodle');
          return '분석 결과, 데이터의 절반이 "ㅁㅁㅁㅁㅁㅁㅁ"였습니다.';
        },
      },
      {
        label: '밥그릇을 채우고 의자를 돌려받는다', desc: '플레이어 체력 +12. 30%: 내면의 괴물이 깨어나 체력이 회복되지 않고 -10.',
        apply: (r, api) => {
          if (api.chance(0.3)) { hurt(r, 10); api.outcome('monster'); return '밥그릇 채우는 게 3분 늦었습니다. 밍키 내면의 괴물이 깨어났습니다. 체력 -10.'; }
          heal(r, 12); api.outcome('ok'); return '밍키는 밥을 먹고 미련 없이 떠났습니다. 오랜만에 함장석에 앉아 쉬었습니다. 체력 +12.';
        },
      },
    ],
  },

  // ───────── 단발 사건
  {
    id: 'sa_gunnir_stew', title: '3대째 스튜', weight: 0.9,
    text: '주방에서 익숙한 냄새가 흘러나온다. 구닐라가 엘베스타드 본가에서 3대째 끓여 온 바로 그 스튜다. 레시피는 가주인 라르스조차 모르며, 구닐라는 국자를 든 채로 주방 입구를 지키고 있다. 단원들이 냄비 주위를 맴돌지만 아무도 먼저 말을 걸지 못한다.',
    choices: [
      {
        label: '한 그릇 얻어먹는다', desc: '플레이어 체력 +15.',
        apply: (r) => { heal(r, 15); return '뼛속까지 따뜻해졌습니다. 체력 +15.'; },
      },
      {
        label: '레시피를 슬쩍 묻는다', desc: '25%: 비밀 하나를 배운다, 무작위 기물 1명 생명력 +3 (영구) / 75%: 국자로 맞는다, 플레이어 체력 -8.',
        apply: (r, api) => {
          if (api.chance(0.25)) { const u = anyUnit(r, api); buff(u, 'vit', 3); api.outcome('secret', { name: who(u) }); return `구닐라가 "월계수는 두 장"이라고 속삭였습니다. 그날 저녁을 먹은 ${who(u)}의 생명력 +3.`; }
          hurt(r, 8); api.outcome('ladle'); return '국자가 정확히 이마에 꽂혔습니다. 체력 -8.';
        },
      },
      {
        label: '최고급 식재료를 후원한다', desc: '크레딧 -15. 모든 아군 최대 체력 +10% (영구).',
        block: cost(15),
        apply: (r, api) => { r.credits -= 15; api.boon('a_stew'); return '구닐라가 처음으로 웃었습니다. 앞으로 에란테스의 식탁은 저택 수준입니다.'; },
      },
    ],
  },
  {
    id: 'sa_sigmund_inspect', title: '집사의 점검', weight: 0.9,
    text: '시그문드가 흰 장갑을 끼고 함선 복도에 섰다. 엘베스타드 일가가 탑승한 이상, 이 배도 저택의 기준을 따라야 한다는 것이 그의 입장이다. 그는 장갑 낀 손가락으로 난간을 한 번 쓸어 보고, 아무 말 없이 수첩에 무언가를 적었다. 단원들이 일제히 옷매무새를 고친다.',
    choices: [
      {
        label: '전원 대청소', desc: '플레이어 체력 -8. 출전 기물 전원 방어력 +1 (영구).',
        apply: (r) => { hurt(r, 8); for (const u of r.units.filter((x) => x.pos)) u.perm.def += 1; return '함선이 반짝입니다. 모두가 지쳤지만 어딘가 단단해졌습니다. 출전 기물 방어력 +1.'; },
      },
      {
        label: '잡동사니를 창고에 숨긴다', desc: '50%: 점검 통과, 숨긴 상자에서 재료 1개 / 50%: 발각, 크레딧 -10 (시그문드의 "수업료").',
        apply: (r, api) => {
          if (api.chance(0.5)) { api.gain(api.randomItem('C')); api.outcome('pass'); return '점검을 통과했습니다. 숨겼던 상자에서 쓸 만한 재료가 나왔습니다.'; }
          r.credits = Math.max(0, r.credits - 10); api.outcome('caught'); return '"창고 정리도 청소입니다." 시그문드가 수업료를 청구했습니다. 크레딧 -10.';
        },
      },
      {
        label: '차를 대접한다', desc: '크레딧 -5. 무작위 기물 1명 정신력 +2 (영구), 공명도 +6 분배.',
        block: cost(5),
        apply: (r, api) => { r.credits -= 5; const u = anyUnit(r, api); buff(u, 'mnd', 2); api.xp(6); api.outcome('default', { name: who(u) }); return `시그문드는 찻잔을 내려놓고 예법에 대해 한 시간 강의했습니다. 끝까지 들은 ${who(u)}의 정신력 +2.`; },
      },
    ],
  },
  {
    id: 'sa_amundsen_bar', title: '단장의 술자리', weight: 0.8,
    text: '에이든의 바 카운터에 아문센이 앉아 있다. 하얗게 센 수염을 쓸며, 오늘은 연합군 에이스 시절 이야기를 하겠다고 한다. 에이든은 아무도 주문하지 않은 술을 이미 따르고 있다. 한 번 시작되면 새벽까지 간다는 걸 모두가 알지만, 그 이야기 속에는 늘 쓸 만한 것이 하나쯤 섞여 있다.',
    choices: [
      {
        label: '끝까지 듣는다', desc: '공명도 +16 분배. 플레이어 체력 -10 (숙취).',
        apply: (r, api) => { api.xp(16); hurt(r, 10); return '이야기는 동이 틀 때 끝났습니다. 머리는 깨질 것 같지만 무언가를 배웠습니다.'; },
      },
      {
        label: '오래된 상자 이야기를 청한다', desc: '아문센이 낡은 상자를 건넨다. 90%: 재료 1개 / 10%: 전설 장비 1개.',
        apply: (_r, api) => {
          if (api.chance(0.1)) { api.gain(api.randomItem('L'), true); api.outcome('legend'); return '"이건 이제 내가 쓸 일이 없지." 상자 안에는 전설 장비가 들어 있었습니다!'; }
          api.gain(api.randomItem('C')); api.outcome('parts'); return '상자 안에는 30년 묵은 부품이 들어 있었습니다. 아직 쓸 만합니다. 재료 1개.';
        },
      },
      {
        label: '술값 내기 카드를 친다', desc: '크레딧 10 필요. 45%: 크레딧 +15 / 55%: 크레딧 -10.',
        block: cost(10),
        apply: (r, api) => {
          if (api.chance(0.45)) { r.credits += 15; api.outcome('win'); return '단장의 블러핑을 읽었습니다. 크레딧 +15.'; }
          r.credits -= 10; api.outcome('lose'); return '"대항해시대를 연 사람한테 블러핑으로 이기려고?" 크레딧 -10.';
        },
      },
    ],
  },
  {
    id: 'sa_rachel_fridge', title: '냉장고 습격', weight: 0.9,
    text: '공용 냉장고가 비었다. 일주일 치 보급이 하룻밤 사이에 사라졌고, 범인은 숨을 생각조차 없다. 레이첼이 식당 의자에 늘어진 채 "배고팠어"라고 말한다. 보통 사람 네 배를 먹는 암흑 물질 반응로에게 배급 계획표는 애초에 무리였다. 다음 보급항까지는 아직 멀다.',
    choices: [
      {
        label: '비상 보급을 산다', desc: '크레딧 -12. 플레이어 체력 +12.',
        block: cost(12),
        apply: (r) => { r.credits -= 12; heal(r, 12); return '비싼 보급선을 불렀습니다. 이번에는 레이첼 몫을 네 배로 계산했습니다.'; },
      },
      {
        label: '배급제를 실시한다', desc: '플레이어 체력 -12. 크레딧 +5 (남은 예산).',
        apply: (r) => { hurt(r, 12); r.credits += 5; return '모두가 배고픈 일주일을 보냈습니다. 레이첼만 "그래도 살 만한데?"라고 말했습니다.'; },
      },
      {
        label: '레이첼에게 식량을 구해 오게 한다', desc: '60%: 소행성 정거장에서 재료 2개 / 40%: "꼭 지금 해야 해?" 레이첼이 잠든다, 플레이어 체력 -8.',
        apply: (r, api) => {
          if (api.chance(0.6)) { api.gain(api.randomItem('C')); api.gain(api.randomItem('C')); api.outcome('ok'); return '레이첼은 식량과 함께 정거장 고철상의 부품까지 들고 왔습니다. 재료 2개.'; }
          hurt(r, 8); api.outcome('sleep'); return '레이첼은 셔틀 안에서 잠들었고, 아무도 깨우지 못했습니다. 체력 -8.';
        },
      },
    ],
  },
  {
    id: 'sa_engine_knock', title: '기관실의 노크 소리', weight: 0.9,
    text: '기관실에서 일정한 간격으로 쿵, 쿵 소리가 난다. 계기판은 모두 정상이라고 말하지만, 오래 배를 탄 단원일수록 표정이 굳는다. 정비 매뉴얼은 "공인 정비소 입고"를 권하고, 정비 담당은 "한번 열어 보면 알 거"라고 말하며, 나머지는 소리가 저절로 멈추길 기도하는 중이다.',
    choices: [
      {
        label: '직접 열어 본다', desc: '60%: 원인을 찾아 부품값을 아낀다, 크레딧 +10 / 40%: 냉각수가 터진다, 플레이어 체력 -15.',
        apply: (r, api) => {
          if (api.chance(0.6)) { r.credits += 10; api.outcome('ok'); return '헐거워진 볼트 하나였습니다. 정비소에 줄 돈을 아꼈습니다. 크레딧 +10.'; }
          hurt(r, 15); api.outcome('burst'); return '볼트를 푸는 순간 냉각수가 쏟아졌습니다. 체력 -15.';
        },
      },
      {
        label: '공인 정비소에 입고한다', desc: '크레딧 -12. 최대 플레이어 체력 +8, 체력 +8.',
        block: cost(12),
        apply: (r) => { r.credits -= 12; r.maxHp += 8; heal(r, 8); return '정비소는 소리 말고도 고칠 것을 세 개 더 찾아냈습니다. 최대 체력 +8.'; },
      },
      {
        label: '그냥 간다', desc: '70%: 소리가 저절로 멈춘다 / 30%: 기관 정지, 플레이어 체력 -20.',
        apply: (r, api) => {
          if (api.chance(0.7)) { api.outcome('stop'); return '소리는 다음 날 아침 멈췄습니다. 아무도 이유를 모릅니다.'; }
          hurt(r, 20); api.outcome('dead'); return '항해 중에 기관이 멈췄습니다. 비상 수리에 꼬박 하루가 걸렸습니다. 체력 -20.';
        },
      },
    ],
  },
  {
    id: 'sa_lars_seminar', title: '가주의 재테크 강의', weight: 0.8,
    text: '라르스 가주가 휴게실 화이트보드에 그래프를 그리고 있다. 오늘의 주제는 "용병단 재무 구조 개선". 단, 강의는 정확히 17시에 끝난다고 미리 못 박았다. 앞자리에 앉은 사람은 시그문드뿐이고, 그는 이미 가주의 그래프를 수첩에 옮겨 적고 있다.',
    choices: [
      {
        label: '정식으로 수강한다', desc: '크레딧 -10 (수강료). 이자 상한 +2 (영구).',
        block: cost(10),
        apply: (r) => { r.credits -= 10; r.mods.interestCap += 2; return '"돈은 쉬게 두면 안 됩니다." 이자 상한 +2.'; },
      },
      {
        label: '여유 자금을 맡긴다', desc: '크레딧 -15. 50%: 크레딧 +30 / 30%: 크레딧 +15 / 20%: 크레딧 0.',
        block: cost(15),
        apply: (r, api) => {
          r.credits -= 15;
          const roll = api.rng((g) => g.int(1, 10));
          if (roll <= 5) { r.credits += 30; api.outcome('big'); return '라르스는 상대가 이겼다고 믿게 만들고 두 배를 챙겼습니다. 크레딧 +30.'; }
          if (roll <= 8) { r.credits += 15; api.outcome('even'); return '"원금 보장은 해 드렸습니다." 본전입니다.'; }
          api.outcome('zero');
          return '"시장이 비합리적이었습니다." 라르스는 17시에 정시 퇴근했습니다.';
        },
      },
      {
        label: '정시 퇴근을 돕는다', desc: '크레딧 +5. 라르스 보유 시 라르스 정신력 +2 (영구).',
        apply: (r, api) => { r.credits += 5; const u = unit(r, 'lars'); buff(u, 'mnd', 2); if (u) api.outcome('lars'); else api.outcome('note'); return u ? '라르스는 고맙다며 상품권을 건넸습니다. 푹 쉰 라르스의 정신력 +2. 크레딧 +5.' : '휴게실 화이트보드에 상품권 한 장이 붙어 있었습니다. 크레딧 +5.'; },
      },
    ],
  },
  {
    id: 'sa_rasmus_garden', title: '격납고 텃밭', weight: 0.8,
    text: '격납고 한쪽 구석, 예비 장갑판을 쌓아 두던 자리에 화분이 줄지어 늘어섰다. 수경 재배 토마토와 허브, 그리고 이름 모를 덩굴. 라스무스가 40년 동안 저택 정원을 가꾸던 솜씨를 여기서 발휘한 모양이다. 정비 담당은 공간이 부족하다고 불만이고, 구닐라는 허브를 눈여겨보고 있다.',
    choices: [
      {
        label: '텃밭을 허락한다', desc: '크레딧 -8 (양액 값). 최대 플레이어 체력 +10, 체력 +10.',
        block: cost(8),
        apply: (r) => { r.credits -= 8; r.maxHp += 10; heal(r, 10); return '식탁에 신선한 채소가 오르기 시작했습니다. 최대 체력 +10.'; },
      },
      {
        label: '수확물을 정거장에 판다', desc: '60%: 크레딧 +15 / 40%: 시세가 나빠 크레딧 +5.',
        apply: (r, api) => {
          if (api.chance(0.6)) { r.credits += 15; api.outcome('ok'); return '우주 정거장에서 생토마토는 귀합니다. 크레딧 +15.'; }
          r.credits += 5; api.outcome('low'); return '하필 옆 정거장에 수경 농장이 생겼습니다. 크레딧 +5.';
        },
      },
      {
        label: '격납고를 훈련장으로 되돌린다', desc: '공명도 +12 분배. 라스무스 보유 시 라스무스 이번 페이즈 출전 불가 (서운함).',
        apply: (r, api) => {
          api.xp(12);
          const u = unit(r, 'rasmus');
          if (u) { u.lock = r.phase; u.pos = null; api.outcome('sulk'); return '훈련 공간이 돌아왔습니다. 라스무스는 화분을 안고 한동안 방에서 나오지 않습니다.'; }
          api.outcome('kitchen');
          return '화분은 구닐라가 주방으로 가져갔습니다. 훈련 공간이 돌아왔습니다.';
        },
      },
    ],
  },
  {
    id: 'sa_eating_bet', title: '식당의 도박판', weight: 0.8,
    text: '식당 한가운데 테이블이 치워지고, 테무르와 레이첼이 마주 앉았다. 누가 더 많이 먹는가. 카이로가 배당판을 들고 돌아다니고, 비앙카가 장부를 적는다. 테무르는 계약 조건으로 밥을 요구한 전직 검투사고, 레이첼은 반응로를 심장에 단 프로 귀차니스트다. 구닐라는 냄비를 들고 지친 표정으로 서 있다.',
    choices: [
      {
        label: '테무르에게 건다', desc: '크레딧 -10. 35%: 크레딧 +30 / 65%: 잃는다.',
        block: cost(10),
        apply: (r, api) => {
          r.credits -= 10;
          if (api.chance(0.35)) { r.credits += 30; api.outcome('win'); return '레이첼이 일곱 번째 그릇에서 "귀찮아"라며 수저를 놓았습니다! 크레딧 +30.'; }
          api.outcome('lose');
          return '테무르는 열두 그릇에서 쓰러졌고, 레이첼은 디저트를 주문했습니다.';
        },
      },
      {
        label: '레이첼에게 건다', desc: '크레딧 -10. 75%: 크레딧 +16 / 25%: 잃는다.',
        block: cost(10),
        apply: (r, api) => {
          r.credits -= 10;
          if (api.chance(0.75)) { r.credits += 16; api.outcome('win'); return '예상대로 레이첼이 이겼습니다. 배당은 짰지만 확실했습니다. 크레딧 +16.'; }
          api.outcome('lose');
          return '레이첼이 중간에 잠들었습니다. 몰수패입니다.';
        },
      },
      {
        label: '구닐라를 돕는다', desc: '플레이어 체력 -8 (주방 노동). 무작위 기물 2명 생명력 +1 (영구), 공명도 +6 분배.',
        apply: (r, api) => {
          hurt(r, 8);
          const a = anyUnit(r, api); const b = anyUnit(r, api);
          buff(a, 'vit', 1); if (b && b !== a) buff(b, 'vit', 1);
          api.xp(6);
          const names = `${who(a)}${b && b !== a ? `와(과) ${who(b)}` : ''}`;
          api.outcome('default', { names });
          return `냄비 열두 개를 씻었습니다. 남은 음식은 ${who(a)}${b && b !== a ? `와(과) ${who(b)}` : ''}의 몫이 되었습니다.`;
        },
      },
    ],
  },
  {
    id: 'sa_family_call', title: '본가의 통신', weight: 0.7,
    text: '엘베스타드 본가에서 암호화된 통신이 들어왔다. 화면에는 집사 시그문드가 단정하게 서 있고, 그 뒤로 라스무스의 정원과 구닐라의 주방이 언뜻 보인다. 가문의 인장이 찍힌 화물이 다음 정박지로 발송되었다는 소식이다. 다만 배달은 메트로 기관사 올리버가 맡았다고 한다. 좋게 말하면 신속 배달, 나쁘게 말하면 난폭 운전이다.',
    choices: [
      {
        label: '정박지에서 기다린다', desc: '50%: 희귀 장비 1개 / 30%: 재료 1개 / 20%: 화물이 로켓 추진 꽃다발과 함께 폭발, 플레이어 체력 -10.',
        apply: (r, api) => {
          const roll = api.rng((g) => g.int(1, 10));
          if (roll <= 5) { api.gain(api.randomItem('A')); api.outcome('gear'); return '올리버가 오운완 사진을 찍으며 화물을 넘겼습니다. 희귀 장비 1개.'; }
          if (roll <= 8) { api.gain(api.randomItem('C')); api.outcome('parts'); return '화물은 반쯤 찌그러졌지만 쓸 만한 재료가 남아 있었습니다.'; }
          hurt(r, 10); api.outcome('boom'); return '로켓 추진 꽃다발이 착륙장에서 폭발했습니다. 올리버는 "궁금해서"라고 해명했습니다. 체력 -10.';
        },
      },
      {
        label: '문장을 청한다', desc: '크레딧 -10. 엘베스타드 일가 문장 1개.',
        block: cost(10),
        apply: (r, api) => { r.credits -= 10; api.gain('M_FAM', true); return '시그문드가 고개를 끄덕였습니다. "가주님께서 허락하셨습니다." 엘베스타드 문장을 받았습니다.'; },
      },
      {
        label: '안부만 전한다', desc: '공명도 +8 분배. 엘베스타드 일가 기물을 보유하면 그중 1명 공명 등급 +1.',
        apply: (r, api) => {
          api.xp(8);
          const fam = r.units.filter((u) => ['lars', 'ingel', 'amundsen', 'rachel', 'oliver', 'rasmus', 'sigmund', 'gunnir', 'mingki'].includes(u.defId));
          if (fam.length) { const u = api.rng((g) => g.pick(fam)); api.rankUp(u, 1); api.outcome('fam', { name: who(u) }); return `오랜만에 집안 소식을 들은 ${who(u)}의 표정이 밝아졌습니다. 공명 등급 +1.`; }
          api.outcome('none');
          return '시그문드는 "모두 무사하십니다"라는 말로 통신을 끝냈습니다.';
        },
      },
    ],
  },
];
