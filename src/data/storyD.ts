// 이야기 사건 묶음 D — 변경 생존 · 도박 · 인양
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { EventApi, EventDef } from './events';
import type { RunState, UnitState } from '../types';

export const BOONS_D: Record<string, { name: string; effect: Effect }> = {
  d_route: { name: '밀수 항로 (공격 속도 +10%)', effect: { stats: { atkSpd: 0.1 } } },
  d_intel: { name: '약탈자의 정보망 (피해 +20%)', effect: { mods: [inc('all', 0.2)] } },
  d_colors: { name: '해적 깃발 위장 (회피 +8%)', effect: { stats: { eva: 0.08 } } },
  d_plating: { name: '인양 장갑판 (받는 피해 -10%)', effect: { taken: [red('all', 0.1)] } },
};

// ───────── 공통 도우미
const heal = (r: RunState, n: number) => { r.hp = Math.min(r.maxHp, r.hp + n); };
const hurt = (r: RunState, n: number) => { r.hp = Math.max(1, r.hp - n); };
const roll = (api: EventApi) => api.rng((g) => g.next());
const owns = (r: RunState, id: string) => r.units.some((u) => u.defId === id);
const top = (r: RunState): UnitState | undefined => r.units.slice().sort((a, b) => b.rank - a.rank)[0];
const needCr = (n: number) => (r: RunState) => (r.credits < n ? '크레딧이 부족합니다' : null);
const needHp = (n: number) => (r: RunState) => (r.hp <= n ? '체력이 부족합니다' : null);
const isGear = (x: string | null) => !!x && /^[CGAL]_/.test(x);
const hasGear = (r: RunState) => r.inventory.some(isGear) || r.units.some((u) => u.items.some(isGear));
const noGear = (r: RunState) => (hasGear(r) ? null : '내놓을 장비가 없습니다');
const full = (r: RunState) => (r.units.length >= 16 ? '보유 한도(16명)에 도달했습니다' : null);
const pickDeployed = (r: RunState, api: EventApi): UnitState | undefined => {
  const pool = r.units.filter((u) => u.pos);
  const src = pool.length ? pool : r.units;
  return src.length ? api.rng((g) => g.pick(src)) : undefined;
};
/** 무작위 장비 1개를 빼앗고 그 등급을 돌려준다 */
const takeGear = (api: EventApi): 'C' | 'G' | 'A' | 'L' | null => {
  const all = api.allItems().filter((x) => isGear(x.id));
  if (!all.length) return null;
  const it = api.rng((g) => g.pick(all));
  api.setItem(it, null);
  return it.id[0] as 'C' | 'G' | 'A' | 'L';
};
const TIER_NAME = { C: '재료', G: '고급 장비', A: '희귀 장비', L: '전설 장비' } as const;

export const STORY_D: EventDef[] = [
  // ───────── 1. 난파선 인양
  {
    id: 'sd_derelict', title: '침묵하는 화물선', weight: 1,
    text: '항로 표지도 없는 암흑 구역에 대형 화물선 한 척이 비스듬히 떠 있다. 선체에는 세 번 이상 약탈당한 흔적이 겹겹이 남아 있지만, 화물칸 깊숙한 곳의 격벽만은 아직 봉인되어 있다. 웨스트가 스캐너를 두드리며 중얼거린다. "안쪽에 뭔가 있긴 해. 다만 반응로도 살아 있고."',
    choices: [
      {
        label: '봉인 격벽을 뜯는다', desc: '40%: 희귀 장비 1개 / 35%: 크레딧 +12 / 25%: 반응로 폭주, 플레이어 체력 -18.',
        apply: (r, api) => {
          const x = roll(api);
          if (x < 0.4) { api.gain(api.randomItem('A')); return '격벽 너머에서 멀쩡한 희귀 장비를 건졌습니다.'; }
          if (x < 0.75) { r.credits += 12; return '값나가는 화물 몇 상자를 챙겼습니다. 크레딧 +12.'; }
          hurt(r, 18); return '격벽을 여는 순간 반응로가 폭주했습니다. 체력 -18.';
        },
      },
      { label: '외곽만 벗겨 낸다', desc: '재료 1개 + 크레딧 +4. 위험 없음.', apply: (r, api) => { api.gain(api.randomItem('C')); r.credits += 4; return '외장재와 배선을 뜯어 재료를 챙겼습니다.'; } },
      { label: '장갑판을 떼어 덧댄다', desc: '이번 페이즈 동안 모든 아군 받는 피해 -10%. 플레이어 체력 -8 (작업 사고).', block: needHp(8), apply: (r, api) => { hurt(r, 8); api.phaseBoon('d_plating'); return '화물선 장갑판을 덧댔습니다. 이번 페이즈 받는 피해 -10%.'; } },
    ],
  },

  // ───────── 2. 구조 신호 (연계 오프너)
  {
    id: 'sd_mayday', title: '구조 신호', weight: 0.9, once: true,
    text: '잡음 사이로 끊어질 듯한 구조 신호가 반복된다. "생명 유지 장치 고장… 승무원 일곱… 누구든…" 이 근방 약탈자들이 쓰는 미끼 수법과 똑같은 문구다. 오르카는 무시하자고, 미리내는 가 보자고 한다. 아문센은 모두의 시선을 받으며 담배를 비벼 끈다.',
    choices: [
      {
        label: '곧장 응답한다', desc: '60%: 진짜 조난선. 공명도 +10, 생존자들이 은혜를 기억한다 / 40%: 약탈자 매복. 체력 -15, 전리품 크레딧 +6.',
        apply: (r, api) => {
          if (api.chance(0.6)) { api.xp(10); api.flag('d_rescued'); return '진짜 조난선이었습니다. 선장이 이 빚은 꼭 갚겠다고 약속합니다.'; }
          hurt(r, 15); r.credits += 6; return '미끼였습니다. 매복을 뚫고 나왔지만 체력 -15. 전리품 크레딧 +6.';
        },
      },
      {
        label: '웨스트에게 신호를 분석시킨다', desc: '크레딧 -6. 확실하게 진위를 가려 조난선을 구조한다. 공명도 +8, 생존자들이 은혜를 기억한다.', block: needCr(6),
        apply: (r, api) => { r.credits -= 6; api.xp(8); api.flag('d_rescued'); return '분석 장비 값은 들었지만, 안전하게 생존자들을 구했습니다.'; },
      },
      { label: '신호 좌표를 팔아넘긴다', desc: '크레딧 +9. 그 뒤에 무슨 일이 있었는지는 알 수 없다.', apply: (r) => { r.credits += 9; return '좌표를 정보상에게 넘겼습니다. 크레딧 +9.'; } },
    ],
  },
  {
    id: 'sd_mayday2', title: '빚 갚는 선장', weight: 2.5, req: 'd_rescued', once: true,
    text: '정거장 부두에서 낯익은 얼굴이 손을 흔든다. 그때 구해 준 조난선의 선장이다. 알고 보니 그는 변경에서 이름난 밀수꾼이었고, 그날은 세관선에 쫓기다 엔진이 터졌던 것이다. "에란테스한테는 빚이 있지. 원하는 걸로 갚겠네."',
    choices: [
      { label: '비밀 항로를 받는다', desc: '모든 아군 공격 속도 +10% (영구).', apply: (_r, api) => { api.boon('d_route'); return '밀수 항로를 손에 넣었습니다. 공격 속도 +10%.'; } },
      { label: '화물칸 하나를 받는다', desc: '희귀 장비 1개 + 크레딧 +8.', apply: (r, api) => { api.gain(api.randomItem('A')); r.credits += 8; return '선장이 화물칸 열쇠를 건넸습니다.'; } },
      { label: '쓸 만한 사람을 소개받는다', desc: '기물 3명 중 1명 영입.', block: full, apply: (_r, api) => { api.recruitPick(3); return '선장이 믿을 만한 떠돌이들을 데려왔습니다.'; } },
    ],
  },

  // ───────── 3. 약탈단 (분기 연계 오프너)
  {
    id: 'sd_raiders', title: '검은 돛의 약탈단', weight: 0.9, once: true,
    text: '소행성대를 빠져나오는 순간, 개조 포함 네 척이 함선을 에워싼다. 통신 화면에 흉터투성이 두목이 나타나 이를 드러낸다. "통행료다. 아니면 너희 배를 통째로 받아 가지." 게베크가 이미 포탑에 앉아 탄띠를 걸고 있다.',
    choices: [
      {
        label: '싸워서 두목을 살려 보낸다', desc: '플레이어 체력 -12, 크레딧 +10. 두목은 이 일을 기억한다.', block: needHp(12),
        apply: (r, api) => { hurt(r, 12); r.credits += 10; api.flag('d_spared'); return '약탈단을 격퇴했습니다. 두목은 고개를 숙이고 물러났습니다.'; },
      },
      {
        label: '싸워서 두목의 목에 걸린 현상금을 받는다', desc: '플레이어 체력 -12, 크레딧 +22. 두목에게는 형제가 있다는 소문이 있다.', block: needHp(12),
        apply: (r, api) => { hurt(r, 12); r.credits += 22; api.flag('d_grudge'); return '현상금 크레딧 +22. 어딘가에서 누군가 이를 갈고 있을 겁니다.'; },
      },
      { label: '통행료를 낸다', desc: '크레딧 -10. 싸움은 없다.', block: needCr(10), apply: (r) => { r.credits -= 10; return '통행료를 냈습니다. 게베크가 아쉬운 듯 탄띠를 내려놓습니다.'; } },
    ],
  },
  {
    id: 'sd_raiders_favor', title: '돌아온 약탈자', weight: 2.5, req: 'd_spared', once: true,
    text: '변경 주점 구석 자리에서 그 흉터투성이 두목이 술잔을 밀어 온다. "목숨 빚은 처음 져 봐서, 어떻게 갚는지 모르겠더군." 그는 이 근방 약탈자들의 습격 경로와 은신처를 꿰고 있다. 카이로가 말없이 잔을 닦으며 귀를 기울인다.',
    choices: [
      { label: '습격 정보를 받는다', desc: '이번 페이즈 동안 모든 아군 피해 +20%.', apply: (_r, api) => { api.phaseBoon('d_intel'); return '적의 동선이 훤히 보입니다. 이번 페이즈 피해 +20%.'; } },
      { label: '해적 깃발을 빌린다', desc: '모든 아군 회피 +8% (영구). 대신 평판이 깎여 크레딧 -8.', block: needCr(8), apply: (r, api) => { r.credits -= 8; api.boon('d_colors'); return '약탈단 깃발을 달았습니다. 아무도 함부로 다가오지 않습니다.'; } },
      { label: '장물 창고를 턴다', desc: '희귀 장비 1개 + 재료 1개.', apply: (_r, api) => { api.gain(api.randomItem('A')); api.gain(api.randomItem('C')); return '두목이 알려 준 창고에서 장물을 챙겼습니다.'; } },
    ],
  },
  {
    id: 'sd_raiders_grudge', title: '형제의 복수', weight: 2.5, req: 'd_grudge', once: true,
    text: '항로 한가운데 같은 깃발을 단 함선이 버티고 서 있다. 이번에는 다섯 척이다. "내 형의 목값으로 술은 맛있었나, 에란테스?" 죽은 두목의 동생이 직접 함포를 겨누고 있다. 피할 길은 없어 보인다.',
    choices: [
      {
        label: '정면으로 맞붙는다', desc: '50%: 압승, 희귀 장비 1개 + 크레딧 +12 / 30%: 신승, 크레딧 +6 · 체력 -10 / 20%: 패퇴, 체력 -22.',
        apply: (r, api) => {
          const x = roll(api);
          if (x < 0.5) { api.gain(api.randomItem('A')); r.credits += 12; return '동생의 기함까지 격침했습니다. 복수는 여기서 끝납니다.'; }
          if (x < 0.8) { r.credits += 6; hurt(r, 10); return '간신히 물리쳤습니다. 체력 -10, 크레딧 +6.'; }
          hurt(r, 22); return '포화를 견디지 못하고 퇴각했습니다. 체력 -22.';
        },
      },
      {
        label: '웨스트의 기뢰 함정', desc: '크레딧 -10. 확실하게 함대를 무력화하고 잔해에서 희귀 장비 1개.', block: needCr(10),
        apply: (r, api) => { r.credits -= 10; api.gain(api.randomItem('A')); return '기뢰밭에 걸린 함대가 차례로 멈춰 섰습니다.'; },
      },
      {
        label: '장비를 피값으로 내준다', desc: '무작위 보유 장비 1개를 잃는다. 싸움 없이 원한을 끝낸다. 공명도 +8.', block: noGear,
        apply: (_r, api) => { const t = takeGear(api); api.xp(8); return t ? `${TIER_NAME[t]} 1개를 피값으로 넘겼습니다. 동생은 말없이 뱃머리를 돌렸습니다.` : '내줄 것이 없었습니다.'; },
      },
    ],
  },

  // ───────── 4. 도박장
  {
    id: 'sd_dice', title: '여섯 번째 달', weight: 1,
    text: '폐광 행성의 지하에 "여섯 번째 달"이라는 도박장이 있다. 자욱한 연기 속에서 주사위 굴러가는 소리와 환호, 욕설이 뒤섞인다. 오르카가 카운터 너머 바텐더와 눈인사를 나눈다. "여기 딜러 손이 좀 빠르긴 한데, 운이 좋으면 한 밑천 잡지."',
    choices: [
      {
        label: '큰 판에 건다', desc: '크레딧 -15. 25%: 크레딧 +50 / 40%: 크레딧 +20 / 35%: 전부 잃는다.', block: needCr(15),
        apply: (r, api) => {
          r.credits -= 15;
          const x = roll(api);
          if (x < 0.25) { r.credits += 50; return '여섯 번째 달이 떴습니다! 크레딧 +50.'; }
          if (x < 0.65) { r.credits += 20; return '본전에 조금 더 얹어 일어났습니다. 크레딧 +20.'; }
          return '딜러가 미소를 지으며 판돈을 쓸어 갑니다.';
        },
      },
      {
        label: '작은 판에서 논다', desc: '크레딧 -5. 50%: 크레딧 +12 / 50%: 잃는다.', block: needCr(5),
        apply: (r, api) => { r.credits -= 5; if (api.chance(0.5)) { r.credits += 12; return '소소하게 땄습니다. 크레딧 +12.'; } return '조용히 잃었습니다.'; },
      },
      { label: '오르카에게 바를 맡긴다', desc: '크레딧 +7. 단원들이 한숨 돌린다: 플레이어 체력 +8.', apply: (r) => { r.credits += 7; heal(r, 8); return '오르카가 하룻밤 바를 봐 주고 팁을 챙겼습니다.'; } },
    ],
  },

  // ───────── 5. 연료 부족
  {
    id: 'sd_fuel', title: '연료 바닥', weight: 0.9,
    text: '경고음이 함교를 채운다. 연료 계기판의 바늘이 붉은 선 아래로 떨어졌다. 가장 가까운 급유소는 바가지로 악명 높은 독점 업자의 것이고, 근처에는 경비가 허술한 광산 연료고가 하나 있다. 올리버가 핸들에서 손을 떼지 않은 채 묻는다. "단장님, 어디로 꺾을까요?"',
    choices: [
      { label: '바가지를 감수한다', desc: '크레딧 -12. 그 외에는 아무 일도 없다.', block: needCr(12), apply: (r) => { r.credits -= 12; return '세 배 값을 치르고 연료를 채웠습니다.'; } },
      { label: '생명 유지 장치를 줄인다', desc: '플레이어 체력 -14. 대신 버틴 단원들이 단단해진다: 공명도 +8.', block: needHp(14), apply: (r, api) => { hurt(r, 14); api.xp(8); return '추위와 산소 부족을 견뎌 냈습니다. 체력 -14.'; } },
      {
        label: '광산 연료고를 턴다', desc: '55%: 연료를 넉넉히 챙기고 남은 걸 판다, 크레딧 +10 / 45%: 경비 드론에 발각, 체력 -20.',
        apply: (r, api) => { if (api.chance(0.55)) { r.credits += 10; return '연료를 가득 채우고 남은 걸 되팔았습니다. 크레딧 +10.'; } hurt(r, 20); return '경비 드론에게 들켰습니다. 체력 -20.'; },
      },
    ],
  },

  // ───────── 6. 현상금 사냥꾼
  {
    id: 'sd_bounty', title: '현상금 사냥꾼', weight: 0.9, minPhase: 2,
    text: '정거장 출입문 앞에 장갑 외투를 걸친 사냥꾼이 기대 서 있다. 그가 내민 수배서에는 에란테스 단원 한 명의 얼굴이 흐릿하게 찍혀 있다. "개인적인 감정은 없어. 돈이 걸렸을 뿐이지." 자하라가 슬그머니 칼자루에 손을 올린다.',
    choices: [
      {
        label: '에이스가 결투를 받는다', desc: '공명 등급이 가장 높은 기물이 나선다. 60%: 승리, 그 기물 등급 +2 / 40%: 패배, 체력 -15 · 그 기물이 이번 페이즈 동안 출전 불가.',
        apply: (r, api) => {
          const u = top(r);
          if (!u) return '나설 사람이 없었습니다.';
          if (api.chance(0.6)) { api.rankUp(u, 2); return '단 한 발로 결투를 끝냈습니다. 에이스 등급 +2.'; }
          hurt(r, 15); u.lock = r.phase; u.pos = null; return '결투에서 졌습니다. 에이스가 부상으로 이번 페이즈 동안 쉬어야 합니다.';
        },
      },
      { label: '돈으로 수배서를 사들인다', desc: '크레딧 -15. 깔끔하게 끝난다.', block: needCr(15), apply: (r) => { r.credits -= 15; return '사냥꾼이 수배서를 찢어 버렸습니다.'; } },
      {
        label: '더 큰 사냥감을 같이 쫓자고 제안한다', desc: '50%: 공동 사냥 성공, 크레딧 +20 / 50%: 사냥감에게 역습당해 체력 -12.',
        apply: (r, api) => { if (api.chance(0.5)) { r.credits += 20; return '함께 거물을 잡았습니다. 몫으로 크레딧 +20.'; } hurt(r, 12); return '사냥감이 한 수 위였습니다. 체력 -12.'; },
      },
    ],
  },

  // ───────── 7. 암시장 경매
  {
    id: 'sd_auction', title: '암시장 경매', weight: 0.9,
    text: '버려진 정거장의 화물칸에서 은밀한 경매가 열린다. 출품작은 모두 출처를 묻지 말아야 할 물건들이다. 라르스가 귀족 특유의 느긋한 손짓으로 번호판을 집어 든다. "이런 데서는 겉포장이 아니라 판매자의 눈을 보는 법이지."',
    choices: [
      {
        label: '봉인 상자를 낙찰받는다', desc: '크레딧 -20. 10%: 전설 장비 / 55%: 희귀 장비 / 35%: 재료 1개.', block: needCr(20),
        apply: (r, api) => {
          r.credits -= 20;
          const x = roll(api);
          if (x < 0.1) { api.gain(api.randomItem('L'), true); return '상자 안에서 전설 장비가 빛납니다!'; }
          if (x < 0.65) { api.gain(api.randomItem('A')); return '쓸 만한 희귀 장비가 들어 있었습니다.'; }
          api.gain(api.randomItem('C')); return '재료 하나뿐이었습니다. 라르스가 판매자를 노려봅니다.';
        },
      },
      {
        label: '장비를 출품한다', desc: '무작위 보유 장비 1개를 판다. 재료 크레딧 +9 / 고급·희귀 +18 / 전설 +35.', block: noGear,
        apply: (r, api) => { const t = takeGear(api); if (!t) return '팔 물건이 없었습니다.'; const p = t === 'L' ? 35 : t === 'A' || t === 'G' ? 18 : 9; r.credits += p; return `${TIER_NAME[t]} 1개가 낙찰되었습니다. 크레딧 +${p}.`; },
      },
      {
        label: '경매 장부를 훔쳐본다', desc: '50%: 정보를 되팔아 크레딧 +12 / 50%: 경비에게 붙잡혀 체력 -10.',
        apply: (r, api) => { if (api.chance(0.5)) { r.credits += 12; return '낙찰자 명단을 다른 손님에게 팔았습니다. 크레딧 +12.'; } hurt(r, 10); return '경비에게 끌려 나갔습니다. 체력 -10.'; },
      },
    ],
  },

  // ───────── 8. 결투장
  {
    id: 'sd_arena', title: '모래 우리의 챔피언', weight: 0.8,
    text: '변경 광산 도시의 중앙 광장에는 철창으로 둘러친 모래 우리가 있다. 광부들은 하루 품삯을 걸고 챔피언에게 도전하는 자를 구경한다. 테무르가 철창을 손끝으로 훑으며 웃는다. 이런 곳의 냄새는 어디나 같다는 듯이.',
    choices: [
      {
        label: '도전자를 내보낸다', desc: '테무르가 있으면 테무르가, 없으면 무작위 출전 기물이 싸운다. 45%: 압승, 크레딧 +22 · 그 기물 등급 +1 / 35%: 판정승, 크레딧 +10 / 20%: 패배, 체력 -18.',
        apply: (r, api) => {
          const u = owns(r, 'temur') ? r.units.find((x) => x.defId === 'temur') : pickDeployed(r, api);
          const x = roll(api);
          if (x < 0.45) { r.credits += 22; if (u) api.rankUp(u, 1); return '챔피언이 모래 위에 쓰러졌습니다. 크레딧 +22, 도전자 등급 +1.'; }
          if (x < 0.8) { r.credits += 10; return '치열한 접전 끝에 판정승을 거뒀습니다. 크레딧 +10.'; }
          hurt(r, 18); return '챔피언은 소문 이상이었습니다. 체력 -18.';
        },
      },
      {
        label: '챔피언에게 판돈을 건다', desc: '크레딧 -10. 55%: 크레딧 +20 / 45%: 잃는다.', block: needCr(10),
        apply: (r, api) => { r.credits -= 10; if (api.chance(0.55)) { r.credits += 20; return '챔피언이 이겼습니다. 크레딧 +20.'; } return '이변이 일어났습니다. 판돈을 잃었습니다.'; },
      },
      { label: '경기를 관전하며 배운다', desc: '공명도 +12.', apply: (_r, api) => { api.xp(12); return '단원들이 챔피언의 발놀림을 눈에 새겼습니다.'; } },
    ],
  },

  // ───────── 9. 밀수 의뢰 (연계 오프너)
  {
    id: 'sd_smuggle', title: '묻지 말아야 할 화물', weight: 0.9, once: true,
    text: '후드를 깊게 눌러쓴 의뢰인이 봉인된 컨테이너 하나를 내민다. "다음 성계까지만. 열어 보지 않는 조건으로 선불이오." 컨테이너 안에서 미세하게 무언가 웅웅거린다. 유피토가 고개를 갸웃한다. "저거, 살아 있는 소리 같은데?"',
    choices: [
      { label: '묻지 않고 싣는다', desc: '크레딧 +15. 다음 성계에 검문소가 있다는 소문이 있다.', apply: (r, api) => { r.credits += 15; api.flag('d_cargo'); return '선불 크레딧 +15. 컨테이너가 화물칸에 실렸습니다.'; } },
      {
        label: '몰래 열어 본다', desc: '50%: 귀한 장비, 희귀 장비 1개를 빼돌린다 / 50%: 봉인 장치가 터져 체력 -15.',
        apply: (r, api) => { if (api.chance(0.5)) { api.gain(api.randomItem('A')); return '안에는 밀수 장비가 가득했습니다. 하나쯤은 아무도 모를 겁니다.'; } hurt(r, 15); return '봉인 장치가 폭발했습니다. 체력 -15.'; },
      },
      { label: '페트라 세관에 신고한다', desc: '페트라 문장 1개. 의뢰인은 체포된다.', apply: (_r, api) => { api.gain('M_PET'); return '세관이 감사의 뜻으로 페트라 문장을 보냈습니다.'; } },
    ],
  },
  {
    id: 'sd_smuggle2', title: '검문소', weight: 2.5, req: 'd_cargo', once: true,
    text: '성계 경계에 세관 순찰선이 빛 기둥처럼 늘어서 있다. 화물칸의 그 컨테이너가 점점 더 크게 웅웅거린다. 검문관이 통신으로 정지 명령을 내린다. "화물 목록을 제출하고 승선 검사에 응하십시오." 사르마가 조용히 묻는다. "어떻게 하시겠습니까, 단장?"',
    choices: [
      { label: '검문관을 매수한다', desc: '크레딧 -12. 무사히 배달하고 잔금 크레딧 +10.', block: needCr(12), apply: (r) => { r.credits -= 2; return '검문관의 주머니가 두둑해졌고, 화물은 무사히 도착했습니다. 잔금 포함 크레딧 -2.'; } },
      {
        label: '순찰선을 뿌리치고 달린다', desc: '60%: 돌파 성공, 잔금 크레딧 +18 / 40%: 포격을 맞고 체력 -20, 잔금은 받는다 (크레딧 +10).',
        apply: (r, api) => { if (api.chance(0.6)) { r.credits += 18; return '올리버가 순찰선 사이를 꿰뚫었습니다. 크레딧 +18.'; } hurt(r, 20); r.credits += 10; return '포격을 맞았지만 화물은 배달했습니다. 체력 -20, 크레딧 +10.'; },
      },
      { label: '화물을 넘기고 협조한다', desc: '선불은 압수, 크레딧 -15. 대신 세관의 신뢰를 얻어 노드를 지날 때마다 크레딧 +1 (영구).', block: needCr(15), apply: (r) => { r.credits -= 15; r.mods.nodeIncome += 1; return '세관 협력 업체로 등록되었습니다. 노드마다 크레딧 +1.'; } },
    ],
  },

  // ───────── 10. 아르곤의 내기
  {
    id: 'sd_ferry', title: '뱃사공의 내기', weight: 0.6, minPhase: 2,
    text: '안개 낀 성운 한가운데, 해골 얼굴의 뱃사공 아르곤이 낡은 카드 한 벌을 펼친다. "이 강을 건너는 자는 무언가를 걸어야 하지. 동전이든, 숨결이든." 카드 뒷면에는 오래된 별자리들이 새겨져 있다. 누구도 그가 지는 걸 본 적은 없다고들 한다.',
    choices: [
      {
        label: '숨결을 건다', desc: '50%: 최대 플레이어 체력 +10 · 체력 +10 / 50%: 플레이어 체력 -20.', block: needHp(20),
        apply: (r, api) => { if (api.chance(0.5)) { r.maxHp += 10; heal(r, 10); return '아르곤이 처음으로 카드를 내려놓았습니다. 최대 체력 +10.'; } hurt(r, 20); return '숨결 한 자락을 강물에 빼앗겼습니다. 체력 -20.'; },
      },
      {
        label: '동전을 건다', desc: '크레딧 -10. 35%: 크레딧 +30 / 65%: 잃는다.', block: needCr(10),
        apply: (r, api) => { r.credits -= 10; if (api.chance(0.35)) { r.credits += 30; return '별자리가 맞아떨어졌습니다. 크레딧 +30.'; } return '아르곤이 말없이 동전을 강물에 던집니다.'; },
      },
      { label: '뱃노래 한 곡만 청한다', desc: '공명도 +10. 아무것도 걸지 않는다.', apply: (_r, api) => { api.xp(10); return '오래된 뱃노래가 단원들의 마음을 가라앉혔습니다.'; } },
    ],
  },

  // ───────── 11. 사채업자
  {
    id: 'sd_shark', title: '변경의 사채업자', weight: 0.7,
    text: '금니를 번뜩이는 사채업자가 무장 경호원 둘을 대동하고 함교로 올라온다. "변경에선 은행이 멀지. 나는 가깝고." 그의 장부에는 이미 수많은 용병단의 이름이 지워져 있다. 오르카가 계약서를 낚아채 한 줄씩 짚어 내려간다.',
    choices: [
      { label: '급전을 빌린다', desc: '크레딧 +25. 상환액 +35.', apply: (r) => { r.credits += 25; r.loan += 35; return '두툼한 크레딧 칩을 받았습니다. 갚을 날이 오겠지요.'; } },
      {
        label: '오르카가 이자를 깎는다', desc: '상환액이 있을 때만. 50%: 상환액 -15 / 50%: 협상 결렬, 상환액 +5.', block: (r) => (r.loan <= 0 ? '갚을 빚이 없습니다' : null),
        apply: (r, api) => { if (api.chance(0.5)) { r.loan = Math.max(0, r.loan - 15); return '오르카가 장부의 허점을 찔렀습니다. 상환액 -15.'; } r.loan += 5; return '사채업자가 얼굴을 붉히며 수수료를 얹었습니다. 상환액 +5.'; },
      },
      {
        label: '경호원째 내쫓는다', desc: '60%: 떨어뜨린 지갑을 챙긴다, 크레딧 +14 / 40%: 총격전, 체력 -15.',
        apply: (r, api) => { if (api.chance(0.6)) { r.credits += 14; return '사채업자가 지갑을 떨어뜨리고 도망쳤습니다. 크레딧 +14.'; } hurt(r, 15); return '경호원들이 총을 뽑았습니다. 체력 -15.'; },
      },
    ],
  },

  // ───────── 12. 역병 격리선
  {
    id: 'sd_quarantine', title: '격리 깃발', weight: 0.7, minPhase: 2,
    text: '노란 격리 깃발을 단 의료선이 표류하고 있다. 통신은 없지만 의료 보급품 신호가 선명하게 잡힌다. 미리내가 마스크를 고쳐 쓰며 말한다. "안에 살아 있는 사람이 있으면 도울 수 있어요. 없으면… 약은 남아 있겠죠."',
    choices: [
      {
        label: '의료품을 털어 온다', desc: '45%: 고급 의료품, 체력 +20 / 35%: 체력 +10 / 20%: 오염, 체력 -14.',
        apply: (r, api) => {
          const x = roll(api);
          if (x < 0.45) { heal(r, 20); return '봉인된 고급 의료품을 찾았습니다. 체력 +20.'; }
          if (x < 0.8) { heal(r, 10); return '쓸 만한 약품 몇 개를 챙겼습니다. 체력 +10.'; }
          hurt(r, 14); return '격리 구역 공기에 노출되었습니다. 체력 -14.';
        },
      },
      {
        label: '미리내가 생존자를 치료한다', desc: '무작위 출전 기물 1명이 전용 증강 하나를 즉시 얻는다. 플레이어 체력 -10.', block: needHp(10),
        apply: (r, api) => { hurt(r, 10); const u = pickDeployed(r, api); const n = u ? api.augNow(u) : null; return n ? `생존자를 살리며 [${n}]을(를) 깨달았습니다. 체력 -10.` : '생존자를 살렸지만 얻은 깨달음은 없었습니다. 체력 -10.'; },
      },
      { label: '의료선을 예인해 넘긴다', desc: '크레딧 +11.', apply: (r) => { r.credits += 11; return '보건 당국에 의료선을 넘기고 사례금을 받았습니다. 크레딧 +11.'; } },
    ],
  },
];
