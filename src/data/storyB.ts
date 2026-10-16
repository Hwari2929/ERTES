// 이야기 사건 묶음 B — 세력 정치 · 의뢰
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { EventApi, EventDef } from './events';
import type { RunState, UnitState } from '../types';

export const BOONS_B: Record<string, { name: string; effect: Effect }> = {
  b_uni_contract: { name: '연합 군납 계약 (피해량 경감 8%)', effect: { taken: [red('all', 0.08)] } },
  b_ithaca: { name: '이타카 호위 함대 (피해 +12%)', effect: { mods: [inc('all', 0.12)] } },
  b_oracle: { name: '델포이 신탁 (효과 명중 +15%)', effect: { stats: { effHit: 0.15 } } },
  b_sir_vow: { name: '성도회의 서약 (최대 체력 +10%)', effect: { pct: { maxHp: 0.1 } } },
};

// ───────── 도우미
const MAJ = ['vit', 'pow', 'mnd', 'def', 'agi'] as const;
const FAC: Record<'UNI' | 'PET' | 'KAL' | 'HEL' | 'SIR' | 'PAN', string[]> = {
  UNI: ['yelena', 'mirinae', 'gebek', 'donovan', 'chloe', 'west'],
  PET: ['lindiwe', 'orca', 'franze', 'grenholm', 'lars', 'falcon', 'u404'],
  KAL: ['hiiro', 'nadir', 'temur', 'kairo', 'zahara', 'bianca', 'exile'],
  HEL: ['zephyro', 'phyllis', 'eleni', 'iris', 'odysseus', 'argon', 'thermo'],
  SIR: ['romani', 'joshua', 'sarma', 'kyle', 'doros', 'demiurgos'],
  PAN: ['aiden', 'vivian', 'yupito', 'onyx', 'rus'],
};
const NAME: Record<string, string> = {
  yelena: '예레나', mirinae: '미리내', gebek: '게베크', donovan: '도노반', chloe: '클로에', west: '웨스트',
  lindiwe: '린디웨', orca: '오르카', franze: '프란체', grenholm: '그렌홀름', lars: '라르스', falcon: '케빈',
  hiiro: '히이로', nadir: '나디르', temur: '테무르', kairo: '카이로', zahara: '자하라', bianca: '비앙카',
  zephyro: '제피로', phyllis: '필리스', eleni: '엘레니', iris: '이리스', odysseus: '오디세우스', argon: '아르곤',
  romani: '로마니', joshua: '조슈아', sarma: '사르마', kyle: '카일', doros: '도로스', demiurgos: '데미우르고스',
  aiden: '에이든', vivian: '비비안', yupito: '유피토', onyx: '오닉스 감응자', rus: '루스',
  ingel: '잉겔', amundsen: '아문센', rachel: '레이첼', oliver: '올리버', rasmus: '라스무스', sigmund: '시그문드',
  gunnir: '구닐라', mingki: '밍키', u404: 'U-404', exile: '망명 귀공자', thermo: '테르모필레',
};
const nm = (u: UnitState) => NAME[u.defId] ?? '대원';
const heal = (r: RunState, n: number) => { r.hp = Math.min(r.maxHp, r.hp + n); };
const hurt = (r: RunState, n: number) => { r.hp = Math.max(1, r.hp - n); };
const spend = (r: RunState, n: number) => { r.credits = Math.max(0, r.credits - n); };
const needCr = (n: number) => (r: RunState) => (r.credits < n ? '크레딧이 부족합니다' : null);
const ofFac = (r: RunState, f: keyof typeof FAC) => r.units.filter((u) => FAC[f].includes(u.defId));
const deployed = (r: RunState) => r.units.filter((u) => u.pos);
const ace = (r: RunState) => r.units.slice().sort((a, b) => b.rank - a.rank)[0] as UnitState | undefined;
const pickOne = (api: EventApi, pool: UnitState[]) => (pool.length ? api.rng((g) => g.pick(pool)) : undefined);
const bench = (r: RunState, u: UnitState) => { u.lock = r.phase; u.pos = null; };
const allMaj = (u: UnitState, n: number) => { for (const k of MAJ) u.perm[k] += n; };
const noUnits = (r: RunState) => (r.units.length ? null : '기물이 없습니다');
const noDeployed = (r: RunState) => (deployed(r).length ? null : '출전 중인 기물이 없습니다');

export const STORY_B: EventDef[] = [
  // ───────── 연계 1: 망명자 (칼리토 ↔ 헬레니우스)
  {
    id: 'sb_defector', title: '망명 요청', weight: 0.8, once: true,
    text: '항로 표지 아래에서 소형 요트 한 척이 구조 신호를 보내고 있다. 안에는 칼리토 제국의 남작 부인이 홀로 타고 있다. 그녀는 제국 투기장의 비밀 장부를 통째로 들고 도망쳤으며, 헬레니우스 동맹의 이타카까지만 데려다 달라고 애원한다. 뒤쪽 항로에서는 제국 추격함의 신호가 점점 가까워진다.',
    choices: [
      {
        label: '이타카로 데려간다', desc: '헬레니우스 문장 1개, 크레딧 +6. 제국이 이 일을 기억합니다.',
        apply: (r, api) => { api.gain('M_HEL', true); r.credits += 6; api.flag('b_defect_help'); return '남작 부인은 이타카에 무사히 내렸습니다. 제국의 추격함이 항적을 기록해 갔습니다.'; },
      },
      {
        label: '추격함에 넘긴다', desc: '크레딧 +20. 헬레니우스가 이 일을 기억합니다.',
        apply: (r, api) => { r.credits += 20; api.flag('b_defect_sold'); return '제국 기사들이 그녀를 끌고 갔습니다. 크레딧 +20.'; },
      },
      {
        label: '장부만 사들인다', desc: '크레딧 -10. 60%: 희귀 장비 1개 + 공명도 12 / 40%: 위조 장부, 공명도 6.',
        block: needCr(10),
        apply: (r, api) => {
          r.credits -= 10;
          if (api.chance(0.6)) { api.gain(api.randomItem('A')); api.xp(12); api.outcome('real'); return '장부 속 은닉 창고 좌표에서 희귀 장비를 찾았습니다.'; }
          api.xp(6); api.outcome('fake'); return '절반은 위조였습니다. 그래도 제국 전술 기록 몇 장은 쓸모가 있었습니다.';
        },
      },
    ],
  },
  {
    id: 'sb_defector_hunt', title: '제국의 추심관', weight: 2.5, once: true, req: 'b_defect_help',
    text: '칼리토 제국의 추심관이 붉은 망토의 기사들을 이끌고 에란테스의 함선을 가로막는다. "남작 부인을 빼돌린 용병단이 너희인가." 그는 배상금을 내거나 제국식 결투를 받아들이라고 요구한다. 결투에서 이기면 모든 죄를 묻지 않겠다고 한다. 통신망 너머에서는 이타카의 함대가 이 대치를 조용히 지켜보고 있다.',
    choices: [
      {
        label: '배상금을 낸다', desc: '크레딧 -15. 예법을 갖춘 지불에 추심관이 칼리토 문장 1개를 증서로 남긴다.',
        block: needCr(15),
        apply: (r, api) => { r.credits -= 15; api.gain('M_KAL', true); return '"제국은 셈이 정확한 자를 존중한다." 추심관이 문장을 남기고 떠났습니다.'; },
      },
      {
        label: '결투를 받아들인다', desc: '공명 등급이 가장 높은 기물이 결투. 55%: 그 기물 공명 등급 +2, 크레딧 +10 / 45%: 플레이어 체력 -20, 그 기물은 이번 페이즈 출전 불가.',
        block: noUnits,
        apply: (r, api) => {
          const u = ace(r)!;
          const name = nm(u);
          if (api.chance(0.55)) { api.rankUp(u, 2); r.credits += 10; api.outcome('win', { name }); return `${nm(u)}이(가) 추심관의 검을 부러뜨렸습니다. 공명 등급 +2, 크레딧 +10.`; }
          hurt(r, 20); bench(r, u); api.outcome('lose', { name }); return `${nm(u)}이(가) 쓰러졌습니다. 체력 -20, 이번 페이즈 동안 회복에 전념합니다.`;
        },
      },
      {
        label: '이타카에 도움을 청한다', desc: '플레이어 체력 -8 (함포 교전). 이번 페이즈 동안 모든 아군 피해 +12% (이타카 호위 함대).',
        apply: (r, api) => { hurt(r, 8); api.phaseBoon('b_ithaca'); return '헬레니우스 함대가 사이에 끼어들었습니다. 이번 페이즈 동안 이타카 함대가 호위합니다.'; },
      },
    ],
  },
  {
    id: 'sb_defector_grudge', title: '이타카의 원한', weight: 2.5, once: true, req: 'b_defect_sold',
    text: '헬레니우스 동맹의 삼단노선 함대가 항로를 막아선다. 기함의 함장은 남작 부인이 제국 투기장으로 끌려갔다는 소식을 전하며, 그녀를 판 값이 얼마였냐고 묻는다. 동맹은 에란테스를 항해자 명부에서 지우겠다고 위협한다. 다만 오디세우스의 후예답게, 그들은 거래의 여지를 늘 남겨 둔다.',
    choices: [
      {
        label: '위자료를 낸다', desc: '크레딧 -18. 화해의 증표로 헬레니우스 문장 1개.',
        block: needCr(18),
        apply: (r, api) => { r.credits -= 18; api.gain('M_HEL', true); return '함장은 크레딧을 받고 동맹의 문장을 건넸습니다. "다음엔 저울을 잘 보시오."'; },
      },
      {
        label: '봉쇄를 돌파한다', desc: '플레이어 체력 -12. 50%: 추격을 따돌리고 희귀 장비 1개 / 50%: 추가로 체력 -10.',
        apply: (r, api) => {
          hurt(r, 12);
          if (api.chance(0.5)) { api.gain(api.randomItem('A')); api.outcome('ok'); return '봉쇄를 뚫으며 떨어진 보급 캡슐을 건졌습니다. 희귀 장비 1개.'; }
          hurt(r, 10); api.outcome('hurt'); return '삼단노선의 충각에 선체가 찢겼습니다. 체력 추가 -10.';
        },
      },
      {
        label: '구출을 약속한다', desc: '출전 기물 중 무작위 1명이 이번 페이즈 동안 투기장 구출 작전에 빠진다 (출전 불가). 그 기물 모든 주요 능력치 +2 (영구), 공명도 12.',
        block: noDeployed,
        apply: (r, api) => {
          const u = pickOne(api, deployed(r))!;
          bench(r, u); allMaj(u, 2); api.xp(12);
          const name = nm(u);
          api.outcome('default', { name });
          return `${nm(u)}이(가) 제국 투기장으로 잠입했습니다. 돌아올 때는 한층 단단해져 있을 겁니다.`;
        },
      },
    ],
  },

  // ───────── 연계 2: 페트라 입찰 공작
  {
    id: 'sb_tender', title: '입찰 공작', weight: 0.8, once: true,
    text: '주식회사 페트라의 조달 담당 이사가 은밀히 접선해 온다. 연합 군수 입찰에서 경쟁사 수송선단의 출항을 "지연"시켜 달라는 의뢰다. 선금은 넉넉하고, 계약서 어디에도 에란테스의 이름은 적혀 있지 않다. 하지만 그 수송선단은 전선으로 가는 연합의 보급품을 싣고 있다.',
    choices: [
      {
        label: '의뢰를 받는다', desc: '크레딧 +20, 이자 상한 +1 (영구). 이 일은 기록에 남지 않을 겁니다… 아마도.',
        apply: (r, api) => { r.credits += 20; r.mods.interestCap += 1; api.flag('b_tender_took'); return '수송선단의 항법 장치가 "우연히" 고장 났습니다. 크레딧 +20.'; },
      },
      {
        label: '연합에 제보한다', desc: '연합 문장 1개, 공명도 8. 페트라가 제보자를 찾기 시작합니다.',
        apply: (_r, api) => { api.gain('M_UNI', true); api.xp(8); api.flag('b_tender_leak'); return '연합 감찰국이 감사 표시로 문장을 보내왔습니다.'; },
      },
      {
        label: '못 들은 걸로 한다', desc: '크레딧 +5 (비밀 유지 수당).',
        apply: (r) => { r.credits += 5; return '이사는 입막음 값을 건네고 사라졌습니다.'; },
      },
    ],
  },
  {
    id: 'sb_tender_audit', title: '감사번호 B-7', weight: 2.5, once: true, req: 'b_tender_took',
    text: '연합 감찰국과 페트라 정보감사실이 동시에 같은 사건을 들여다보기 시작했다. 지연된 수송선단의 항적 기록 끝에 에란테스 함선의 신호가 찍혀 있다. 의뢰를 맡긴 이사는 이미 연락을 끊었다. 감사관은 정식 소명서를 요구하며, 기한은 다음 도약 전까지다.',
    choices: [
      {
        label: '모든 걸 자백한다', desc: '크레딧 -15, 이자 상한 -1. 대신 연합 감찰국과 군납 계약: 모든 아군 피해량 경감 8% (영구).',
        block: needCr(15),
        apply: (r, api) => { r.credits -= 15; r.mods.interestCap -= 1; api.boon('b_uni_contract'); return '벌금을 낸 뒤 연합 군납 계약서에 서명했습니다. 피해량 경감 8% (영구).'; },
      },
      {
        label: '장부를 조작한다', desc: '50%: 무혐의, 크레딧 +10 / 50%: 적발, 벌금 15 (모자라면 대출로 떠안음) + 플레이어 체력 -10.',
        apply: (r, api) => {
          if (api.chance(0.5)) { r.credits += 10; return '감사관이 서류를 덮었습니다. 남은 예비비 크레딧 +10.'; }
          const paid = Math.min(r.credits, 15);
          r.credits -= paid; r.loan += 15 - paid; hurt(r, 10);
          return `적발되었습니다. 벌금 15${paid < 15 ? ` (대출 ${15 - paid})` : ''}, 체력 -10.`;
        },
      },
      {
        label: '이사를 찾아간다', desc: '페트라 대출 25를 떠안는다 (노드마다 자동 상환). 대신 입막음 값 크레딧 +15, 페트라 문장 1개.',
        apply: (r, api) => { r.loan += 25; r.credits += 15; api.gain('M_PET', true); return '이사는 회사 명의로 대출을 일으켜 입막음 값을 치렀습니다. 빚은 에란테스 앞으로 달렸습니다.'; },
      },
    ],
  },
  {
    id: 'sb_tender_suit', title: '페트라 법무팀', weight: 2.5, once: true, req: 'b_tender_leak',
    text: '페트라 법무팀의 사무용 함선이 정중하게 도킹을 요청한다. 그들은 에란테스가 기밀 유지 의무를 어겼다며 손해배상 청구서를 내민다. 액수는 터무니없지만, 서명란 옆에는 합의안도 함께 놓여 있다. 연합 측 연락관은 "법정에 서면 끝까지 지켜 주겠다"고 약속한다.',
    choices: [
      {
        label: '합의한다', desc: '크레딧 -12. 페트라 우대 고객으로 등록되어 이자 상한 +1 (영구).',
        block: needCr(12),
        apply: (r) => { r.credits -= 12; r.mods.interestCap += 1; return '합의서에 서명했습니다. 이상하게도 페트라의 대우가 좋아졌습니다.'; },
      },
      {
        label: '연합 법정에서 싸운다', desc: '60%: 승소, 크레딧 +20 + 연합 기물 전원 공명 등급 +1 (없으면 공명도 10) / 40%: 패소, 크레딧 -10, 이자 상한 -1.',
        apply: (r, api) => {
          if (api.chance(0.6)) {
            r.credits += 20;
            const uni = ofFac(r, 'UNI');
            if (uni.length) uni.forEach((u) => api.rankUp(u, 1)); else api.xp(10);
            return '승소했습니다. 크레딧 +20, 연합이 증인들을 표창했습니다.';
          }
          spend(r, 10); r.mods.interestCap -= 1; return '패소했습니다. 크레딧 -10, 페트라 신용 등급이 깎였습니다.';
        },
      },
      {
        label: '신용을 포기한다', desc: '이자 상한 -2 (영구). 소송을 피해 숨어 지내며 훈련만 한다: 출전 기물 전원 모든 주요 능력치 +1 (영구).',
        apply: (r) => { r.mods.interestCap -= 2; for (const u of deployed(r)) allMaj(u, 1); return '페트라 신용망에서 이름이 지워졌습니다. 대신 훈련할 시간은 많았습니다.'; },
      },
    ],
  },

  // ───────── 연계 3: 성유물
  {
    id: 'sb_relic', title: '봉인된 성유물', weight: 0.8, once: true,
    text: '시리우스 성도회의 수도사가 납으로 봉인된 상자를 맡긴다. 다음 성소까지 옮겨 주기만 하면 후한 헌금을 내겠다고 한다. 상자는 이따금 미세하게 떨리고, 그때마다 함선의 사이오닉 계기판이 튄다. 수도사는 결코 열어 보지 말라고 세 번이나 당부했다.',
    choices: [
      {
        label: '봉인된 채로 운반한다', desc: '크레딧 +12, 공명도 8.',
        apply: (r, api) => { r.credits += 12; api.xp(8); return '성소에 무사히 인도했습니다. 수도사가 축복과 헌금을 건넸습니다.'; },
      },
      {
        label: '몰래 열어 본다', desc: '50%: 무작위 출전 기물 1명이 전용 증강 1개 획득 / 50%: 플레이어 체력 -12. 성도회가 봉인이 풀린 것을 알게 됩니다.',
        apply: (r, api) => {
          api.flag('b_relic_open');
          if (api.chance(0.5)) {
            const u = pickOne(api, deployed(r).length ? deployed(r) : r.units);
            const n = u ? api.augNow(u) : null;
            if (n && u) return `빛이 ${nm(u)}에게 스며들었습니다. [${n}]을(를) 깨달았습니다.`;
            api.xp(10); return '상자 안의 빛이 함선 전체에 흩어졌습니다. 공명도 10.';
          }
          hurt(r, 12); return '상자에서 터져 나온 신성력에 함선이 그을렸습니다. 체력 -12.';
        },
      },
      {
        label: '공동체 학자에게 판다', desc: '크레딧 +8, 범은하 문장 1개. 성도회가 봉인이 풀린 것을 알게 됩니다.',
        apply: (r, api) => { r.credits += 8; api.gain('M_PAN', true); api.flag('b_relic_open'); return '공동체 학자들이 기뻐하며 상자를 뜯었습니다. 성도회에도 소문이 닿겠지요.'; },
      },
    ],
  },
  {
    id: 'sb_relic_trial', title: '이단 심문', weight: 2.5, once: true, req: 'b_relic_open',
    text: '시리우스 성도회의 무장 심문관들이 에란테스의 함선에 올라탄다. 성유물의 봉인이 풀렸다는 사실을 그들은 이미 알고 있다. 심문관장은 고해와 속죄를 요구하며, 거부한다면 이단으로 기록하겠다고 경고한다. 성도회 갑주의 문양 사이로 신성력이 은은하게 일렁인다.',
    choices: [
      {
        label: '고해하고 속죄한다', desc: '크레딧 -12. 성도회의 서약: 모든 아군 최대 체력 +10% (영구).',
        block: needCr(12),
        apply: (r, api) => { r.credits -= 12; api.boon('b_sir_vow'); return '속죄 헌금을 바치고 서약을 받았습니다. 모든 아군 최대 체력 +10%.'; },
      },
      {
        label: '무력으로 쫓아낸다', desc: '45%: 시리우스 문장 1개 + 희귀 장비 1개 / 55%: 플레이어 체력 -22.',
        apply: (r, api) => {
          if (api.chance(0.45)) { api.gain('M_SIR', true); api.gain(api.randomItem('A')); return '심문관들이 무기를 버리고 달아났습니다. 문장과 장비를 챙겼습니다.'; }
          hurt(r, 22); return '성도회 갑주는 소문보다 단단했습니다. 체력 -22.';
        },
      },
      {
        label: '대리 속죄자를 보낸다', desc: '공명 등급이 가장 높은 기물이 이번 페이즈 동안 성소에 머문다 (출전 불가). 대신 그 기물 공명 등급 +1, 전용 증강 1개.',
        block: noUnits,
        apply: (r, api) => {
          const u = ace(r)!;
          bench(r, u); api.rankUp(u, 1); const n = api.augNow(u);
          return `${nm(u)}이(가) 성소에서 기도합니다.${n ? ` [${n}]을(를) 깨달았습니다.` : ''}`;
        },
      },
    ],
  },

  // ───────── 단발 사건
  {
    id: 'sb_envoy', title: '공동체의 사절', weight: 1,
    text: '범은하 공동체의 다종족 사절단이 호위를 의뢰한다. 그들은 연합과 제국 사이에 중립 항로 협정을 맺으러 가는 길이다. 사절단장은 크레딧 대신 공동체의 연줄을 보수로 제시한다. 다만 이 항로에는 협정을 원치 않는 자들이 매복해 있다는 소문이 돈다.',
    choices: [
      {
        label: '정식으로 호위한다', desc: '플레이어 체력 -10. 범은하 문장 1개, 공명도 8.',
        apply: (r, api) => { hurt(r, 10); api.gain('M_PAN', true); api.xp(8); return '매복을 막아 내고 사절단을 무사히 데려다주었습니다.'; },
      },
      {
        label: '지름길로 몰래 통과한다', desc: '65%: 크레딧 +12, 범은하 문장 1개 / 35%: 매복에 걸려 플레이어 체력 -18.',
        apply: (r, api) => {
          if (api.chance(0.65)) { r.credits += 12; api.gain('M_PAN', true); return '아무도 모르는 항로로 빠져나갔습니다. 사절단장이 크게 감탄합니다.'; }
          hurt(r, 18); return '지름길이 매복지였습니다. 체력 -18.';
        },
      },
      {
        label: '사절단 위치를 판다', desc: '크레딧 +22. 공동체 기물이 있다면 1명이 분노해 이번 페이즈 동안 출전을 거부한다.',
        apply: (r, api) => {
          r.credits += 22;
          const u = pickOne(api, ofFac(r, 'PAN'));
          if (u) { bench(r, u); return `크레딧 +22. ${nm(u)}이(가) 이번 페이즈 동안 함께 싸우지 않겠다고 선언했습니다.`; }
          return '크레딧 +22. 아무도 이 일을 입에 올리지 않습니다.';
        },
      },
    ],
  },
  {
    id: 'sb_tribunal', title: '연합 군사 법정', weight: 0.9,
    text: '성간 인류 연합의 군사 법정이 에란테스를 증인으로 소환했다. 피고는 전선에서 명령을 어기고 민간 함선을 구한 연합 장교다. 검찰은 유죄 증언을 원하고, 피고 측 변호인은 그저 진실을 말해 달라고 부탁한다. 어느 쪽이든 연합 관료들은 증언 내용을 오래 기억할 것이다.',
    choices: [
      {
        label: '검찰 편에 선다', desc: '크레딧 +15, 공명도 8 (연합 표창).',
        apply: (r, api) => { r.credits += 15; api.xp(8); return '장교는 유죄 판결을 받았습니다. 연합이 협조 수당을 지급했습니다.'; },
      },
      {
        label: '진실을 증언한다', desc: '크레딧 -8 (관료들에게 찍힌다). 출전 기물 전원 정신력 +2 (영구).',
        apply: (r) => { spend(r, 8); for (const u of deployed(r)) u.perm.mnd += 2; return '장교는 무죄로 풀려났습니다. 대원들의 눈빛이 달라졌습니다.'; },
      },
      {
        label: '증언을 거부한다', desc: '70%: 조용히 넘어가고 공명도 6 / 30%: 법정 모독으로 크레딧 -10.',
        apply: (r, api) => {
          if (api.chance(0.7)) { api.xp(6); return '법정은 에란테스 없이 진행되었습니다.'; }
          spend(r, 10); return '법정 모독 벌금이 부과되었습니다. 크레딧 -10.';
        },
      },
    ],
  },
  {
    id: 'sb_arena', title: '황제 탄신 검투', weight: 0.9,
    text: '칼리토 제국 황제의 탄신을 기념하는 검투 대회가 열렸다. 외부 용병단도 참가할 수 있으며, 우승자에게는 하사금과 명예 작위가 주어진다. 귀족석에서는 어느 용병단이 먼저 쓰러질지 내기가 한창이다. 아문센은 "구경만 해도 배우는 게 있지"라며 턱을 괸다.',
    choices: [
      {
        label: '최강의 기물을 내보낸다', desc: '공명 등급이 가장 높은 기물 출전. 50%: 우승, 그 기물 공명 등급 +2, 크레딧 +12 / 50%: 준우승, 공명 등급 +1, 플레이어 체력 -15.',
        block: noUnits,
        apply: (r, api) => {
          const u = ace(r)!;
          if (api.chance(0.5)) { api.rankUp(u, 2); r.credits += 12; api.outcome('win', { name: nm(u) }); return `${nm(u)}이(가) 우승했습니다! 공명 등급 +2, 하사금 +12.`; }
          api.rankUp(u, 1); hurt(r, 15); api.outcome('lose', { name: nm(u) }); return `${nm(u)}은(는) 결승에서 아깝게 졌습니다. 공명 등급 +1, 체력 -15.`;
        },
      },
      {
        label: '제국 기물을 내보낸다', desc: '칼리토 제국 기물 1명 출전. 관중의 환호: 그 기물 공명 등급 +1, 전투력 +3 (영구), 크레딧 +8.',
        block: (r) => (ofFac(r, 'KAL').length ? null : '칼리토 제국 기물이 없습니다'),
        apply: (r, api) => {
          const u = ofFac(r, 'KAL').sort((a, b) => b.rank - a.rank)[0];
          api.rankUp(u, 1); u.perm.pow += 3; r.credits += 8; api.outcome('default', { name: nm(u) });
          return `제국 관중이 ${nm(u)}의 이름을 연호합니다. 공명 등급 +1, 전투력 +3.`;
        },
      },
      {
        label: '내기만 건다', desc: '크레딧 -10. 45%: 크레딧 +25 / 55%: 잃는다.',
        block: needCr(10),
        apply: (r, api) => {
          r.credits -= 10;
          if (api.chance(0.45)) { r.credits += 25; api.outcome('win'); return '이변이 일어났습니다! 크레딧 +25.'; }
          api.outcome('lose'); return '귀족들이 웃으며 판돈을 쓸어 갔습니다.';
        },
      },
    ],
  },
  {
    id: 'sb_checkpoint', title: '연합 검문소', weight: 1,
    text: '성간 인류 연합의 검문소가 항로를 막고 있다. 서류 심사 대기열은 사흘 치나 밀려 있고, 담당 관료는 한숨을 쉬며 "급행 처리 수수료"를 넌지시 언급한다. 화물칸에는 아직 신고하지 않은 전리품이 실려 있다. 정직하게 기다리자니 다음 전선에 늦을 판이다.',
    choices: [
      {
        label: '수수료를 쥐여 준다', desc: '크레딧 -8. 75%: 급행 통과, 남는 시간에 훈련해 공명도 10 / 25%: 감찰에 걸려 크레딧 -8 추가.',
        block: needCr(8),
        apply: (r, api) => {
          r.credits -= 8;
          if (api.chance(0.75)) { api.xp(10); api.outcome('ok'); return '도장이 찍혔습니다. 남는 시간에 훈련했습니다.'; }
          spend(r, 8); api.outcome('caught'); return '하필 감찰관이 지켜보고 있었습니다. 크레딧 추가 -8.';
        },
      },
      {
        label: '정직하게 기다린다', desc: '플레이어 체력 +15 (강제 휴식), 공명도 6.',
        apply: (r, api) => { heal(r, 15); api.xp(6); return '사흘을 쉬었습니다. 의외로 나쁘지 않았습니다.'; },
      },
      {
        label: '검문을 강행 돌파한다', desc: '플레이어 체력 -12. 신고하지 않은 전리품을 지켜 낸다: 장비 재료 1개 + 크레딧 +8.',
        apply: (r, api) => { hurt(r, 12); api.gain(api.randomItem('C')); r.credits += 8; return '연합 경비정의 경고 사격을 뚫고 지나갔습니다.'; },
      },
    ],
  },
  {
    id: 'sb_double', title: '두 장의 의뢰서', weight: 0.8, minPhase: 2,
    text: '같은 날, 같은 성계에서 의뢰서 두 장이 도착했다. 하나는 헬레니우스 동맹의 항구 방어 의뢰, 다른 하나는 주식회사 페트라의 같은 항구 "자산 회수" 의뢰다. 둘 다 선금을 이미 송금해 왔다. 레이첼은 두 의뢰서를 나란히 펼쳐 놓고 아문센의 눈치를 본다.',
    choices: [
      {
        label: '동맹의 편에 선다', desc: '플레이어 체력 -8. 헬레니우스 문장 1개, 크레딧 +6 (선금).',
        apply: (r, api) => { hurt(r, 8); api.gain('M_HEL', true); r.credits += 6; return '항구를 지켜 냈습니다. 페트라의 선금은 정중히 돌려보냈습니다.'; },
      },
      {
        label: '페트라의 편에 선다', desc: '플레이어 체력 -8. 크레딧 +18.',
        apply: (r) => { hurt(r, 8); r.credits += 18; return '항구의 자산은 무사히 "회수"되었습니다. 크레딧 +18.'; },
      },
      {
        label: '양쪽 선금을 다 챙긴다', desc: '50%: 크레딧 +25, 장비 재료 1개 / 50%: 양쪽에 들통나 플레이어 체력 -20, 크레딧 -5.',
        apply: (r, api) => {
          if (api.chance(0.5)) { r.credits += 25; api.gain(api.randomItem('C')); api.outcome('ok'); return '양쪽이 서로를 탓하는 사이 조용히 빠져나왔습니다.'; }
          hurt(r, 20); spend(r, 5); api.outcome('caught'); return '동맹 함대와 페트라 경호팀이 동시에 포문을 열었습니다. 체력 -20.';
        },
      },
    ],
  },
  {
    id: 'sb_summit', title: '정전 회담', weight: 0.8,
    text: '연합과 칼리토 제국이 국경 성계에서 정전 회담을 열었다. 에란테스는 중립 경비대로 고용되었다. 회담 전날 밤, 얼굴을 가린 사내가 찾아와 회담장 방어막 발전기를 잠깐만 꺼 달라며 크레딧 칩을 내민다. 회담이 깨지면 전쟁이 길어지고, 전쟁이 길어지면 용병의 일감도 늘어난다.',
    choices: [
      {
        label: '회담을 지킨다', desc: '크레딧 +8 (경비 수당), 공명도 12.',
        apply: (r, api) => { r.credits += 8; api.xp(12); return '정전 협정이 체결되었습니다. 양측 장성들이 에란테스에 고개를 숙였습니다.'; },
      },
      {
        label: '발전기를 끈다', desc: '크레딧 +25. 30%: 정체가 드러나 양측 함대에 쫓기며 플레이어 체력 -20.',
        apply: (r, api) => {
          r.credits += 25;
          if (api.chance(0.3)) { hurt(r, 20); api.outcome('exposed'); return '회담장이 불타는 사이 정체가 드러났습니다. 크레딧 +25, 체력 -20.'; }
          api.outcome('clean'); return '회담은 결렬되었고, 아무도 이유를 모릅니다. 크레딧 +25.';
        },
      },
      {
        label: '사내를 붙잡아 넘긴다', desc: '60%: 양측의 사례로 연합 또는 칼리토 문장 1개 (무작위) / 40%: 사내가 자폭해 플레이어 체력 -14.',
        apply: (r, api) => {
          if (api.chance(0.6)) { const m = api.rng((g) => g.pick(['M_UNI', 'M_KAL'])); api.gain(m, true); api.outcome('ok', { side: m === 'M_UNI' ? '연합' : '제국' }); return `공작원을 넘겼습니다. ${m === 'M_UNI' ? '연합' : '제국'}이 문장을 보내왔습니다.`; }
          hurt(r, 14); api.outcome('boom'); return '사내가 품속의 기폭 장치를 눌렀습니다. 체력 -14.';
        },
      },
    ],
  },
  {
    id: 'sb_headhunt', title: '헤드헌터', weight: 0.8, minPhase: 2,
    text: '주식회사 페트라의 인재 영입팀이 함선 휴게실에 명함을 돌린다. 그들의 목표는 에란테스의 에이스다. 계약금과 연봉, 스톡옵션이 빼곡한 제안서를 본 대원들이 웅성거린다. 헤드헌터는 "단기 임대도 가능합니다"라며 미소 짓는다.',
    choices: [
      {
        label: '에이스를 임대한다', desc: '공명 등급이 가장 높은 기물이 이번 페이즈 동안 페트라에 파견된다 (출전 불가). 크레딧 +18, 희귀 장비 1개.',
        block: noUnits,
        apply: (r, api) => { const u = ace(r)!; bench(r, u); r.credits += 18; api.gain(api.randomItem('A')); api.outcome('default', { name: nm(u) }); return `${nm(u)}이(가) 페트라 경호 업무에 파견되었습니다. 크레딧 +18, 희귀 장비 1개.`; },
      },
      {
        label: '대항 제안을 낸다', desc: '크레딧 -12. 공명 등급이 가장 높은 기물 모든 주요 능력치 +2 (영구).',
        block: (r) => needCr(12)(r) ?? noUnits(r),
        apply: (r, api) => { r.credits -= 12; const u = ace(r)!; allMaj(u, 2); api.outcome('default', { name: nm(u) }); return `${nm(u)}의 처우를 올렸습니다. 모든 주요 능력치 +2.`; },
      },
      {
        label: '역으로 스카우트한다', desc: '50%: 헤드헌터의 인맥으로 기물 3명 중 1명 영입 / 50%: 접대비만 날린다, 크레딧 -6.',
        block: (r) => (r.units.length >= 16 ? '보유 한도(16명)에 도달했습니다' : null),
        apply: (r, api) => {
          if (api.chance(0.5)) { api.recruitPick(3); api.outcome('ok'); return '헤드헌터가 명함첩을 통째로 넘겼습니다. 면접을 진행합니다.'; }
          spend(r, 6); api.outcome('fail'); return '헤드헌터는 비싼 술만 마시고 돌아갔습니다. 크레딧 -6.';
        },
      },
    ],
  },
  {
    id: 'sb_feast', title: '이타카의 연회', weight: 0.9,
    text: '헬레니우스 동맹의 모항 이타카에서 귀환 연회가 열렸다. 뱃사공들은 술잔을 돌리며 오디세우스의 항해를 노래하고, 함장들은 활쏘기 내기를 건다. 신전의 무녀는 이방인에게도 신탁을 내려 준다고 한다. 이런 자리에서 맺은 인연은 전장에서 함대가 되어 돌아온다.',
    choices: [
      {
        label: '활쏘기 내기에 나선다', desc: '55%: 헬레니우스 문장 1개 + 크레딧 +8 / 45%: 크레딧 -8.',
        apply: (r, api) => {
          if (api.chance(0.55)) { api.gain('M_HEL', true); r.credits += 8; api.outcome('win'); return '화살이 열두 개의 도끼 구멍을 꿰뚫었습니다! 함장들이 문장을 내렸습니다.'; }
          spend(r, 8); api.outcome('lose'); return '화살이 과녁을 비껴갔습니다. 크레딧 -8.';
        },
      },
      {
        label: '신탁을 청한다', desc: '크레딧 -12. 델포이 신탁: 모든 아군 효과 명중 +15% (영구).',
        block: needCr(12),
        apply: (r, api) => { r.credits -= 12; api.boon('b_oracle'); return '"너희의 화살은 빗나가지 않으리라." 효과 명중 +15% (영구).'; },
      },
      {
        label: '함장들과 술을 마신다', desc: '플레이어 체력 +12. 이번 페이즈 동안 모든 아군 피해 +12% (이타카 호위 함대).',
        apply: (r, api) => { heal(r, 12); api.phaseBoon('b_ithaca'); return '밤새 마신 끝에 함장들이 이번 전선을 함께하기로 했습니다.'; },
      },
    ],
  },
];
