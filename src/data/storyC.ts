// 이야기 사건 묶음 C — 우주 기담 · 사이오닉 · 신앙
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { EventApi, EventDef } from './events';
import type { FaithId, RunState, UnitState } from '../types';

export const BOONS_C: Record<string, { name: string; effect: Effect }> = {
  c_hymn: { name: '오닉스 찬가 (정신 피해 +20%)', effect: { mods: [inc('psy', 0.2)] } },
  c_moon: { name: '셀레네의 달빛 (피해량 경감 8%)', effect: { taken: [red('all', 0.08)] } },
  c_tears: { name: '황제의 성유 (신성 피해 +20%)', effect: { mods: [inc('holy', 0.2)] } },
  c_lucid: { name: '깨어 있는 꿈 (효과 저항 +15%)', effect: { stats: { effRes: 0.15 } } },
};

// ───────── 보조 함수
const NAME: Record<string, string> = {
  yelena: '예레나', mirinae: '미리내', gebek: '게베크', donovan: '도노반', chloe: '클로에', west: '웨스트', lindiwe: '린디웨',
  orca: '오르카', franze: '프란체', grenholm: '그렌홀름', lars: '라르스', falcon: '팔콘', hiiro: '히이로', nadir: '나디르',
  temur: '테무르', kairo: '카이로', zahara: '자하라', bianca: '비앙카', zephyro: '제피로', phyllis: '필리스', eleni: '엘레니',
  iris: '이리스', odysseus: '오디세우스', argon: '아르곤', romani: '로마니', joshua: '조슈아', sarma: '사르마', kyle: '카일',
  doros: '도로스', demiurgos: '데미우르고스', aiden: '에이든', vivian: '비비안', yupito: '유피토', ingel: '잉겔',
  amundsen: '아문센', rachel: '레이첼', oliver: '올리버', rasmus: '라스무스', sigmund: '시그문드', gunnir: '구닐라',
  onyx: '오닉스 감응자', thermo: '테르모필레',
};
const PSY = ['yelena', 'hiiro', 'nadir', 'zephyro', 'romani', 'joshua', 'rachel', 'onyx'];
const DIV = ['eleni', 'iris', 'odysseus', 'kyle', 'doros', 'thermo'];

const nm = (u: UnitState) => NAME[u.defId] ?? '기물';
const heal = (r: RunState, n: number) => { r.hp = Math.min(r.maxHp, r.hp + n); };
const hurt = (r: RunState, n: number) => { r.hp = Math.max(1, r.hp - n); };
const psyOf = (r: RunState) => r.units.filter((u) => PSY.includes(u.defId));
const divOf = (r: RunState) => r.units.filter((u) => DIV.includes(u.defId));
const fielded = (r: RunState) => { const f = r.units.filter((u) => u.pos); return f.length ? f : r.units; };
/** 무작위 기물 1명 (기본: 출전 기물 우선) */
const pickU = (r: RunState, api: EventApi, pool?: UnitState[]): UnitState | null => {
  const p = pool ?? fielded(r);
  return p.length ? api.rng((g) => g.pick(p)) : null;
};
/** 이번 페이즈 동안 출전 불가 */
const bench = (r: RunState, u: UnitState) => { u.lock = r.phase; u.pos = null; };
const top = (r: RunState) => r.units.slice().sort((a, b) => b.rank - a.rank)[0] ?? null;
/** 세 갈래 판정: a 확률 → 0, b 확률 → 1, 나머지 → 2 */
const tri = (api: EventApi, a: number, b: number) => (api.chance(a) ? 0 : api.chance(b / (1 - a)) ? 1 : 2);
const setFaith = (u: UnitState, f: FaithId) => { u.faith = f; };
const noUnits = (r: RunState) => (r.units.length ? null : '기물이 없습니다');
const needCr = (n: number) => (r: RunState) => (r.credits < n ? '크레딧이 부족합니다' : null);

export const STORY_C: EventDef[] = [
  // ───────── 연계 1: 유령선 아르고 (3단)
  {
    id: 'sc_argo', title: '유령선 아르고', weight: 0.8, once: true,
    text: '항로 한가운데 낡은 이민선 한 척이 떠 있다. 선체 번호는 아르고-7, 기록상 삼백 년 전에 실종된 배다. 그런데 선체에는 긁힌 자국 하나 없고, 함교의 시계는 지금보다 정확히 열한 시간 앞서 간다. 구조 신호가 끝없이 반복된다. "이 신호를 받았다면, 당신들은 이미 늦었습니다."',
    choices: [
      {
        label: '승선한다', desc: '항해일지를 회수한다 (연계). 60%: 희귀 장비 1개. 40%: 플레이어 체력 -15.',
        apply: (r, api) => {
          api.flag('c_argo');
          if (api.chance(0.6)) { api.gain(api.randomItem('A')); api.outcome('ok'); return '텅 빈 선실에서 희귀 장비와 항해일지를 챙겼습니다.'; }
          api.outcome('hurt');
          hurt(r, 15);
          return '복도가 접히며 승무원들을 덮쳤습니다. 체력 -15. 항해일지만은 손에 남았습니다.';
        },
      },
      {
        label: '함교 시계를 맞춰 준다', desc: '공명도 14 분배. 무작위 출전 기물 1명이 이번 페이즈 동안 출전 불가 (열한 시간을 잃는다).',
        block: noUnits,
        apply: (r, api) => {
          api.xp(14);
          const u = pickU(r, api);
          if (u) bench(r, u);
          api.outcome('default', { victim: u ? nm(u) : '누군가' });
          return `시계가 맞춰지는 순간 모두가 무언가를 배웠습니다. ${u ? `${nm(u)}은(는) 열한 시간을 통째로 잃었습니다.` : ''}`;
        },
      },
      { label: '격침하고 잔해를 판다', desc: '크레딧 +12.', apply: (r) => { r.credits += 12; return '잔해는 삼백 년 묵은 고철 값에 팔렸습니다. 크레딧 +12.'; } },
    ],
  },
  {
    id: 'sc_argo_log', title: '아르고의 항해일지', weight: 2.5, req: 'c_argo', once: true,
    text: '회수한 항해일지는 아직도 쓰이고 있다. 매일 밤 새 문장이 한 줄씩 늘어나는데, 날짜는 전부 내일이다. 오늘 밤 적힌 줄은 이렇다. "에란테스가 우리를 찾아왔다. 우리는 그들에게 집으로 가는 길을 물었다." 일지 마지막 장에는 좌표 하나에 동그라미가 쳐져 있다.',
    choices: [
      {
        label: '좌표를 따라간다', desc: '크레딧 -5 (우회 연료). 아르고 이야기가 이어진다 (연계).',
        block: needCr(5),
        apply: (r, api) => { r.credits -= 5; api.flag('c_argo_home'); return '항로를 꺾었습니다. 좌표까지는 열한 시간 거리입니다.'; },
      },
      {
        label: '내일 자 일지를 읽는다', desc: '50%: 공명도 18 분배 (다가올 전투를 미리 본다). 50%: 무작위 사이오닉 기물(없으면 무작위 기물) 1명 정신력 -1 (영구).',
        block: noUnits,
        apply: (r, api) => {
          if (api.chance(0.5)) { api.xp(18); return '내일의 전투가 한 줄 한 줄 적혀 있었습니다. 공명도 +18.'; }
          const ps = psyOf(r);
          const u = pickU(r, api, ps.length ? ps : r.units);
          if (u) u.perm.mnd -= 1;
          return `${u ? nm(u) : '누군가'}이(가) 자기 이름이 적힌 마지막 줄을 읽고 말았습니다. 정신력 -1.`;
        },
      },
      { label: '일지를 태운다', desc: '플레이어 체력 +12. 권능 포인트 +1.', apply: (r) => { heal(r, 12); r.power += 1; return '재가 된 일지에서 따뜻한 빛이 올라왔습니다. 체력 +12, 권능 +1.'; } },
    ],
  },
  {
    id: 'sc_argo_home', title: '귀항', weight: 2.5, req: 'c_argo_home', once: true,
    text: '좌표에는 아무것도 없었다. 기다리자, 정확히 열한 시간 뒤 아르고-7이 그 자리에 나타난다. 이번에는 승무원들이 함교 창가에 서서 손을 흔든다. 삼백 년 동안 그들은 이 좌표, 이 순간만을 향해 항해해 왔다. 선장의 목소리가 통신망에 울린다. "여기가 집입니까?"',
    choices: [
      { label: '"그렇다"고 답한다', desc: '권능 포인트 +2. 신성력 수집 상한 +25.', apply: (r) => { r.power += 2; r.divCap += 25; return '승무원들이 웃으며 빛으로 흩어졌습니다. 권능 +2, 신성력 상한 +25.'; } },
      {
        label: '배를 인수한다', desc: '희귀 장비 1개 + 재료 1개. 30%: 승무원들이 분노해 플레이어 체력 -20.',
        apply: (r, api) => {
          api.gain(api.randomItem('A')); api.gain(api.randomItem('C'));
          if (api.chance(0.3)) { hurt(r, 20); return '화물은 챙겼지만, 집을 빼앗긴 망자들이 함선을 할퀴었습니다. 체력 -20.'; }
          return '승무원들은 말없이 배를 넘겨주었습니다. 희귀 장비와 재료를 얻었습니다.';
        },
      },
      {
        label: '집으로 가는 항로를 그려 준다', desc: '크레딧 -10. 노드를 지날 때마다 크레딧 +1 (영구).',
        block: needCr(10),
        apply: (r) => { r.credits -= 10; r.mods.nodeIncome += 1; return '아르고-7이 떠나며 항로 사용료를 영원히 보내 주기로 했습니다. 노드마다 크레딧 +1.'; },
      },
    ],
  },

  // ───────── 연계 2: 오닉스 합창단 (2단)
  {
    id: 'sc_choir', title: '합창단의 초대장', weight: 0.8, once: true,
    text: '통신망에 초대장이 끼어든다. 발신자는 오닉스 합창단, 서명 대신 악보 한 줄이 적혀 있다. 그들은 에란테스의 사이오닉 기물 하나를 "비어 있는 성부"로 모시고 싶다고 한다. 거절하면 노래가 조금 쓸쓸해질 뿐이라고. 그 악보를 오래 들여다본 정비병은 벌써 사흘째 콧노래를 멈추지 못하고 있다.',
    choices: [
      {
        label: '사이오닉 기물을 보낸다', desc: '무작위 사이오닉 기물 1명이 이번 페이즈 동안 출전 불가, 공명 등급 +2. 합창단과 인연이 생긴다 (연계).',
        block: (r) => (psyOf(r).length ? null : '사이오닉 기물이 없습니다'),
        apply: (r, api) => {
          const u = pickU(r, api, psyOf(r))!;
          bench(r, u); api.rankUp(u, 2); api.flag('c_choir');
          return `${nm(u)}이(가) 합창단의 빈 자리를 채우러 떠났습니다. 공명 등급 +2.`;
        },
      },
      {
        label: '녹음본을 산다', desc: '크레딧 -10. 이번 페이즈 동안 모든 아군 정신 피해 +20%.',
        block: needCr(10),
        apply: (r, api) => { r.credits -= 10; api.phaseBoon('c_hymn'); return '함내 방송으로 찬가를 틀었습니다. 이번 페이즈 정신 피해 +20%.'; },
      },
      {
        label: '초대장을 되판다', desc: '크레딧 +8. 50%: 환청에 시달려 플레이어 체력 -8.',
        apply: (r, api) => {
          r.credits += 8;
          if (api.chance(0.5)) { hurt(r, 8); return '크레딧 +8. 그런데 함선 어딘가에서 계속 노랫소리가 들립니다. 체력 -8.'; }
          return '수집가가 기꺼이 사 갔습니다. 크레딧 +8.';
        },
      },
    ],
  },
  {
    id: 'sc_choir2', title: '돌아온 성부', weight: 2.5, req: 'c_choir', once: true,
    text: '합창단에 갔던 기물이 돌아왔다. 아무것도 기억나지 않는다고 하지만, 밤마다 잠결에 아무도 모르는 언어로 화음을 넣는다. 함선 전체의 사이오닉 계측기가 그 노래에 맞춰 흔들린다. 그리고 오닉스 감응자의 짧은 전언이 도착한다. "노래는 아직 끝나지 않았습니다."',
    choices: [
      {
        label: '노래를 끝까지 듣는다', desc: '50%: 오닉스 찬가 — 모든 아군 정신 피해 +20% (영구). 50%: 플레이어 체력 -20, 크레딧 -5.',
        apply: (r, api) => {
          if (api.chance(0.5)) { api.boon('c_hymn'); return '마지막 소절이 함선의 일부가 되었습니다. 정신 피해 +20% (영구).'; }
          hurt(r, 20); r.credits = Math.max(0, r.credits - 5);
          return '노래가 끝났을 때 모두가 바닥에 쓰러져 있었습니다. 체력 -20, 크레딧 -5.';
        },
      },
      {
        label: '노래를 받아 적는다', desc: '보유 사이오닉 기물 전원 정신력 +1 (영구). 공명도 8 분배.',
        apply: (r, api) => {
          const ps = psyOf(r);
          for (const u of ps) u.perm.mnd += 1;
          api.xp(8);
          return `악보가 완성되었습니다. 사이오닉 기물 ${ps.length}명 정신력 +1, 공명도 +8.`;
        },
      },
      {
        label: '노래를 끊어 낸다', desc: '플레이어 체력 -10. 깨어 있는 꿈 — 모든 아군 효과 저항 +15% (영구).',
        apply: (r, api) => { hurt(r, 10); api.boon('c_lucid'); return '억지로 깨어난 대가로 체력 -10. 이제 누구도 쉽게 꿈에 끌려가지 않습니다. 효과 저항 +15%.'; },
      },
    ],
  },

  // ───────── 연계 3: 같은 꿈 (2단)
  {
    id: 'sc_dream', title: '모두가 같은 꿈', weight: 0.8, once: true,
    text: '밤새 모든 승무원이 같은 꿈을 꾸었다. 끝없는 복도 끝에 문이 하나 있고, 문 너머에서 누군가 이름을 부른다. 부른 이름은 저마다 달랐지만 목소리는 모두 같았다. 아침 식탁에서 아무도 그 이야기를 먼저 꺼내지 않는다. 오늘 밤에도 그 문은 나타날 것이다.',
    choices: [
      { label: '오늘 밤 문을 연다', desc: '플레이어 체력 -8 (악몽). 꿈 이야기가 이어진다 (연계).', apply: (r, api) => { hurt(r, 8); api.flag('c_door'); return '손잡이는 차가웠고, 문은 이미 조금 열려 있었습니다. 체력 -8.'; } },
      {
        label: '꿈을 기록해 분석한다', desc: '40%: 무작위 출전 기물 1명이 전용 증강 1개를 즉시 얻는다. 60%: 공명도 10 분배.',
        block: noUnits,
        apply: (r, api) => {
          if (api.chance(0.4)) {
            const u = pickU(r, api)!;
            const n = api.augNow(u);
            if (n) return `${nm(u)}이(가) 꿈속에서 [${n}]을(를) 깨달았습니다.`;
          }
          api.xp(10);
          return '해석은 애매했지만 모두가 조금 성장했습니다. 공명도 +10.';
        },
      },
      { label: '수면제를 돌린다', desc: '플레이어 체력 +15.', apply: (r) => { heal(r, 15); return '꿈 없는 잠을 잤습니다. 체력 +15.'; } },
    ],
  },
  {
    id: 'sc_door', title: '문 너머', weight: 2.5, req: 'c_door', once: true,
    text: '문을 열자 에란테스의 함교가 나온다. 똑같은 함교, 똑같은 승무원, 단지 모두가 조금 더 늙었다. 그곳의 지휘관이 피곤한 얼굴로 당신을 본다. "하나만 가져가. 둘 이상 가져가면 우리가 사라져." 탁자 위에 상자 세 개가 놓여 있다.',
    choices: [
      { label: '금빛 상자', desc: '권능 포인트 +2. 신성력 수집 상한 +25.', apply: (r) => { r.power += 2; r.divCap += 25; return '상자 안에는 미래의 기도가 들어 있었습니다. 권능 +2, 신성력 상한 +25.'; } },
      {
        label: '검은 상자', desc: '10%: 전설 장비 1개. 60%: 희귀 장비 1개. 30%: 빈 상자, 플레이어 체력 -12.',
        apply: (r, api) => {
          const k = tri(api, 0.1, 0.6);
          if (k === 0) { api.gain(api.randomItem('L'), true); return '미래의 당신이 쓰던 전설 장비입니다. 흠집까지 똑같습니다.'; }
          if (k === 1) { api.gain(api.randomItem('A')); return '희귀 장비 하나가 들어 있었습니다.'; }
          hurt(r, 12);
          return '상자는 비어 있었고, 뚜껑이 손가락을 물었습니다. 체력 -12.';
        },
      },
      { label: '상자 대신 조언을 구한다', desc: '공명도 18 분배. 크레딧 +6.', apply: (r, api) => { api.xp(18); r.credits += 6; return '"그 전투에서는 오른쪽을 조심해." 공명도 +18, 크레딧 +6.'; } },
    ],
  },

  // ───────── 단발 사건
  {
    id: 'sc_hermes', title: '빈 우편낭', weight: 0.8,
    text: '궤도에 우편낭 하나가 떠 있다. 날개 문양, 헤르메스 우정국의 것이다. 수신인 칸은 비어 있고, 안에는 봉인된 편지 수십 통이 들어 있다. 헤르메스 신도들은 배달되지 못한 편지가 쌓일수록 신의 발걸음이 무거워진다고 믿는다.',
    choices: [
      {
        label: '편지를 뜯어본다', desc: '40%: 동봉된 송금 — 크레딧 +15. 35%: 소포 — 재료 1개. 25%: 저주 편지 — 플레이어 체력 -12.',
        apply: (r, api) => {
          const k = tri(api, 0.4, 0.35);
          if (k === 0) { r.credits += 15; return '삼대째 부치지 못한 송금이 들어 있었습니다. 크레딧 +15.'; }
          if (k === 1) { api.gain(api.randomItem('C')); return '작은 소포에서 쓸 만한 재료가 나왔습니다.'; }
          hurt(r, 12);
          return '"이 편지를 연 자에게 일곱 번의 불운을." 체력 -12.';
        },
      },
      {
        label: '대신 배달한다', desc: '무작위 출전 기물 1명이 이번 페이즈 동안 출전 불가. 권능 포인트 +2, 크레딧 +6.',
        block: noUnits,
        apply: (r, api) => {
          const u = pickU(r, api)!;
          bench(r, u); r.power += 2; r.credits += 6;
          return `${nm(u)}이(가) 우편낭을 메고 떠났습니다. 권능 +2, 크레딧 +6 (배달 수당).`;
        },
      },
      {
        label: '우편낭을 짊어진다', desc: '디바인 기물(없으면 무작위 기물) 1명의 신앙이 헤르메스 신앙으로 바뀌고 기동력 +2 (영구).',
        block: noUnits,
        apply: (r, api) => {
          const d = divOf(r);
          const u = pickU(r, api, d.length ? d : r.units)!;
          setFaith(u, 'hermes'); u.perm.agi += 2;
          return `${nm(u)}의 발걸음이 가벼워졌습니다. 헤르메스 신앙, 기동력 +2.`;
        },
      },
    ],
  },
  {
    id: 'sc_athena', title: '올빼미의 수수께끼', weight: 0.8,
    text: '함교 난간에 금속 올빼미가 내려앉는다. 아테나 신전의 감시 드론이다. 올빼미는 렌즈를 깜박이며 묻는다. "모든 전장에서 한 번도 패배하지 않은 자는 누구인가?" 승무원들이 서로를 쳐다본다. 정답을 아는 사람은 없어 보인다.',
    choices: [
      {
        label: '"싸우지 않은 자"라고 답한다', desc: '55%: 정답 — 권능 포인트 +2, 신성력 수집 상한 +25. 45%: 오답 — 무작위 기물 1명 정신력 -1 (영구), 플레이어 체력 -8.',
        apply: (r, api) => {
          if (api.chance(0.55)) { r.power += 2; r.divCap += 25; return '올빼미가 고개를 끄덕였습니다. 권능 +2, 신성력 상한 +25.'; }
          const u = pickU(r, api, r.units);
          if (u) u.perm.mnd -= 1;
          hurt(r, 8);
          return `"틀렸다. 정답은 '아직 태어나지 않은 자'다." 올빼미가 ${u ? nm(u) : '승무원'}을(를) 쪼고 날아갔습니다. 체력 -8.`;
        },
      },
      { label: '올빼미를 포획한다', desc: '희귀 장비 1개 (부품). 플레이어 체력 -10 (신전의 보복 사격).', apply: (r, api) => { api.gain(api.randomItem('A')); hurt(r, 10); return '쓸 만한 광학 부품을 얻었지만 신전 포대가 응사했습니다. 체력 -10.'; } },
      {
        label: '경례하고 돌려보낸다', desc: '공명도 8 분배. 출전 기물 전원 방어력 +1 (영구).',
        apply: (r, api) => { api.xp(8); for (const u of r.units.filter((x) => x.pos)) u.perm.def += 1; return '올빼미가 날개를 펼쳐 답례했습니다. 출전 기물 방어력 +1.'; },
      },
    ],
  },
  {
    id: 'sc_hades', title: '명부 정정', weight: 0.8, minPhase: 2,
    text: '하데스 명부청의 이송관이 함선에 올라와 서류를 내민다. 명부에 따르면 에란테스의 기물 하나는 지난 전투에서 이미 죽었다. "본인은 모르는 것 같군요. 흔한 일입니다." 이송관은 정정 신청서와 망자용 승선권을 나란히 탁자에 올려놓는다.',
    choices: [
      {
        label: '정정 신청서를 낸다', desc: '크레딧 -12. 무작위 기물 1명 생명력 +3 (영구).',
        block: (r) => noUnits(r) ?? needCr(12)(r),
        apply: (r, api) => { r.credits -= 12; const u = pickU(r, api, r.units)!; u.perm.vit += 3; return `수수료를 내자 ${nm(u)}의 이름 옆 붉은 줄이 지워졌습니다. 생명력 +3.`; },
      },
      {
        label: '망자 대우를 받아들인다', desc: '무작위 기물 1명이 이번 페이즈 동안 출전 불가, 공명 등급 +2, 신앙이 하데스 신앙으로 바뀐다.',
        block: noUnits,
        apply: (r, api) => {
          const u = pickU(r, api, r.units)!;
          bench(r, u); api.rankUp(u, 2); setFaith(u, 'hades');
          return `${nm(u)}은(는) 명부의 강을 한 번 건너갔다 왔습니다. 공명 등급 +2, 하데스 신앙.`;
        },
      },
      {
        label: '명부를 찢는다', desc: '50%: 권능 포인트 +3. 50%: 명부청의 독촉 — 플레이어 체력 -20.',
        apply: (r, api) => {
          if (api.chance(0.5)) { r.power += 3; return '찢어진 명부에서 빠져나온 이름들이 감사 인사를 남겼습니다. 권능 +3.'; }
          hurt(r, 20);
          return '이송관이 한숨을 쉬며 독촉장을 붙였습니다. 함선 온도가 뚝 떨어집니다. 체력 -20.';
        },
      },
    ],
  },
  {
    id: 'sc_selene', title: '월식 순례선', weight: 0.8,
    text: '셀레네 순례선단이 월식을 따라 항해하고 있다. 일 년에 단 한 번, 달이 가려지는 동안에만 기도가 하늘에 닿는다고 그들은 믿는다. 늙은 사제가 에란테스에게도 자리를 내준다. 다만 월식 동안에는 모든 무기를 내려놓아야 한다고.',
    choices: [
      { label: '기도에 합류한다', desc: '최대 플레이어 체력 -10. 셀레네의 달빛 — 모든 아군 피해량 경감 8% (영구).', apply: (r, api) => { r.maxHp -= 10; r.hp = Math.min(r.hp, r.maxHp); api.boon('c_moon'); return '무기를 내려놓은 밤, 달빛이 함선에 스며들었습니다. 피해량 경감 8% (영구).'; } },
      { label: '치유를 청한다', desc: '플레이어 체력 +22.', apply: (r) => { heal(r, 22); return '사제의 손끝에서 서늘한 빛이 흘러나왔습니다. 체력 +22.'; } },
      {
        label: '월식 중에 선단을 턴다', desc: '크레딧 +18. 50%: 달의 저주 — 플레이어 체력 -15.',
        apply: (r, api) => {
          r.credits += 18;
          if (api.chance(0.5)) { hurt(r, 15); return '크레딧 +18. 달이 다시 떠오르자 함선에 서리가 끼었습니다. 체력 -15.'; }
          return '크레딧 +18. 달은 아직 가려져 있었습니다. 아마 못 봤을 겁니다.';
        },
      },
    ],
  },
  {
    id: 'sc_ares', title: '결투 신청', weight: 0.8,
    text: '붉은 갑주의 아레스 기사가 홀로 함선 앞을 가로막는다. "너희 가운데 가장 강한 자와 겨루겠다. 이기면 내 신의 축복을, 지면 그자의 이번 전쟁을 가져가겠다." 아레스 신도에게 결투 거절은 패배보다 깊은 모욕이다. 기사의 칼날에서 신성력이 끓어오른다.',
    choices: [
      {
        label: '에이스를 내보낸다', desc: '공명 등급이 가장 높은 기물이 결투한다. 55%: 전투력 +2, 생명력 +1 (영구), 신성력 수집 상한 +25. 45%: 그 기물 이번 페이즈 동안 출전 불가, 플레이어 체력 -10.',
        block: noUnits,
        apply: (r, api) => {
          const u = top(r)!;
          if (api.chance(0.55)) { u.perm.pow += 2; u.perm.vit += 1; r.divCap += 25; return `${nm(u)}이(가) 기사의 투구를 날려 버렸습니다. 전투력 +2, 생명력 +1, 신성력 상한 +25.`; }
          bench(r, u); hurt(r, 10);
          return `${nm(u)}이(가) 쓰러졌습니다. 기사는 약속대로 그의 이번 전쟁을 가져갔습니다. 체력 -10.`;
        },
      },
      {
        label: '대리 결투사를 고용한다', desc: '크레딧 -10. 공명도 12 분배 (모두가 결투를 지켜보며 배운다).',
        block: needCr(10),
        apply: (r, api) => { r.credits -= 10; api.xp(12); return '용병이 멋지게 졌지만, 모두가 많은 것을 배웠습니다. 공명도 +12.'; },
      },
      {
        label: '함께 술을 마신다', desc: '공명도 10 분배. 무작위 기물 1명의 신앙이 아레스 신앙으로 바뀐다. 플레이어 체력 -8 (주먹다짐).',
        block: noUnits,
        apply: (r, api) => {
          api.xp(10); hurt(r, 8);
          const u = pickU(r, api, r.units)!;
          setFaith(u, 'ares');
          return `결투는 술자리가 되었고, 술자리는 다시 결투가 되었습니다. ${nm(u)}이(가) 아레스에게 귀의했습니다. 체력 -8.`;
        },
      },
    ],
  },
  {
    id: 'sc_zeus', title: '낙뢰 복권', weight: 0.8,
    text: '제우스 신앙의 폭풍 행성 상공. 이곳 신도들은 피뢰침에 이름표를 달아 세워 두고, 번개가 고른 이름을 신의 뜻이라 부른다. 세관원이 표를 흔든다. "한 장에 5 크레딧. 맞으면 축복, 안 맞으면 기부, 잘못 맞으면… 장례는 저희가 치러 드립니다."',
    choices: [
      {
        label: '표를 산다', desc: '크레딧 -5. 10%: 전설 장비 1개. 45%: 크레딧 +15. 45%: 감전 — 플레이어 체력 -15.',
        block: needCr(5),
        apply: (r, api) => {
          r.credits -= 5;
          const k = tri(api, 0.1, 0.45);
          if (k === 0) { api.gain(api.randomItem('L'), true); return '번개가 정확히 당신의 이름을 골랐습니다! 전설 장비를 받았습니다.'; }
          if (k === 1) { r.credits += 15; return '옆 피뢰침에 맞은 덕에 위로금이 나왔습니다. 크레딧 +15.'; }
          hurt(r, 15);
          return '잘못 맞았습니다. 장례는 다행히 필요 없었습니다. 체력 -15.';
        },
      },
      { label: '번개를 축전지에 담는다', desc: '재료 2개.', apply: (_r, api) => { api.gain(api.randomItem('C')); api.gain(api.randomItem('C')); return '충전된 축전지 두 개를 챙겼습니다.'; } },
      { label: '폭풍 속에서 비행 훈련을 한다', desc: '공명도 14 분배. 플레이어 체력 -8.', apply: (r, api) => { api.xp(14); hurt(r, 8); return '머리카락이 전부 섰지만 실력은 늘었습니다. 공명도 +14, 체력 -8.'; } },
    ],
  },
  {
    id: 'sc_index', title: '예언 차트', weight: 0.8,
    text: '지수추종 수도원의 수도승이 두루마리 차트를 펼친다. "시세는 신의 심전도입니다." 그는 다음 상승장이 언제 오는지 안다고 주장하며, 예언의 대가로 투자를 권한다. 수도원 벽에는 지난 예언들이 붙어 있다. 맞은 것은 금박, 틀린 것은 검게 칠해져 있는데, 검은 쪽이 조금 더 많다.',
    choices: [
      {
        label: '10 크레딧을 맡긴다', desc: '45%: 30 크레딧으로 돌려받는다 (순이익 +20). 55%: 전부 잃는다.',
        block: needCr(10),
        apply: (r, api) => {
          r.credits -= 10;
          if (api.chance(0.45)) { r.credits += 30; return '상승장이 왔습니다! 금박이 하나 늘었습니다. 크레딧 +20.'; }
          return '수도승이 엄숙하게 붓에 검은 먹을 묻혔습니다. 크레딧 -10.';
        },
      },
      {
        label: '예언에 공매도를 친다', desc: '크레딧 +10. 50%: 수도승의 저주 — 이자 상한 -1 (영구).',
        apply: (r, api) => {
          r.credits += 10;
          if (api.chance(0.5)) { r.mods.interestCap -= 1; return '크레딧 +10. 수도승이 당신의 장부에 하락 부호를 그렸습니다. 이자 상한 -1.'; }
          return '크레딧 +10. 수도승은 담담하게 차트를 말았습니다.';
        },
      },
      { label: '차트 읽는 법을 배운다', desc: '권능 포인트 +1. 공명도 8 분배.', apply: (r, api) => { r.power += 1; api.xp(8); return '아무것도 예측할 수 없다는 것을 배웠습니다. 그것도 깨달음입니다. 권능 +1, 공명도 +8.'; } },
    ],
  },
  {
    id: 'sc_emperor', title: '우는 초상', weight: 0.8,
    text: '버려진 제국 초소 벽에 황제의 초상이 걸려 있다. 초상의 눈에서 성유가 끊임없이 흘러내린다. 제국 신도들은 이것을 칙령이라 부르고, 과학지상주의자들은 배관 누수라 부른다. 바닥에 고인 기름은 이미 발목 높이다.',
    choices: [
      {
        label: '성유를 무기에 바른다', desc: '70%: 이번 페이즈 동안 모든 아군 신성 피해 +20%. 30%: 그냥 기름이었다 — 윤활유로 팔아 크레딧 +6.',
        apply: (r, api) => {
          if (api.chance(0.7)) { api.phaseBoon('c_tears'); return '총열이 은은하게 빛납니다. 이번 페이즈 신성 피해 +20%.'; }
          r.credits += 6;
          return '배관 누수였습니다. 품질 좋은 윤활유라 크레딧 +6.';
        },
      },
      {
        label: '초상을 떼어 판다', desc: '크레딧 +16. 50%: 제국 신도의 저주 — 무작위 기물 1명 정신력 -1 (영구).',
        apply: (r, api) => {
          r.credits += 16;
          if (api.chance(0.5)) { const u = pickU(r, api, r.units); if (u) u.perm.mnd -= 1; return `크레딧 +16. 그날 밤부터 ${u ? nm(u) : '누군가'}의 꿈에 황제가 나타나 꾸짖습니다. 정신력 -1.`; }
          return '크레딧 +16. 초상은 팔려 가면서도 울고 있었습니다.';
        },
      },
      {
        label: '디바인 기물을 무릎 꿇린다', desc: '디바인 기물 1명의 신앙이 황제 숭배로 바뀌고 공명 등급 +1. 신성력 수집 상한 +25.',
        block: (r) => (divOf(r).length ? null : '디바인 기물이 없습니다'),
        apply: (r, api) => {
          const u = pickU(r, api, divOf(r))!;
          setFaith(u, 'emperor'); api.rankUp(u, 1); r.divCap += 25;
          return `성유가 ${nm(u)}의 이마에 떨어졌습니다. 황제 숭배, 공명 등급 +1, 신성력 상한 +25.`;
        },
      },
    ],
  },
  {
    id: 'sc_relic', title: '주인 없는 성유물', weight: 0.7, minPhase: 2,
    text: '궤도를 떠도는 성유물함 하나를 두고 세 척의 배가 대치하고 있다. 시리우스 성도회는 성자의 뼈라 하고, 과학지상주의 연구선은 미확인 동위원소라 하며, 인간찬가 이민선은 잃어버린 고향 행성의 흙이라 한다. 세 쪽 모두 에란테스에게 중재를 청했다. 사실 아무도 열어 본 적은 없다.',
    choices: [
      { label: '시리우스 성도회에 넘긴다', desc: '신성력 수집 상한 +50.', apply: (r) => { r.divCap += 50; return '성도회가 성가를 부르며 성유물함을 모셔 갔습니다. 신성력 상한 +50.'; } },
      { label: '과학지상주의 연구선에 넘긴다', desc: '희귀 장비 1개. 크레딧 +5.', apply: (r, api) => { api.gain(api.randomItem('A')); r.credits += 5; return '연구선이 측정 장비 하나와 연구 보조금을 건넸습니다.'; } },
      {
        label: '직접 열어 본다', desc: '30%: 성자의 뼈 — 권능 포인트 +3. 40%: 고향의 흙 — 출전 기물 전원 생명력 +1 (영구), 플레이어 체력 +10. 30%: 동위원소 — 플레이어 체력 -20, 무작위 기물 1명 생명력 -1 (영구).',
        apply: (r, api) => {
          const k = tri(api, 0.3, 0.4);
          if (k === 0) { r.power += 3; return '정말로 뼈였습니다. 세 척의 배가 동시에 침묵했습니다. 권능 +3.'; }
          if (k === 1) {
            for (const u of r.units.filter((x) => x.pos)) u.perm.vit += 1;
            heal(r, 10);
            return '흙냄새가 함선을 채웠습니다. 다들 아무 말 없이 한참을 서 있었습니다. 출전 기물 생명력 +1, 체력 +10.';
          }
          hurt(r, 20);
          const u = pickU(r, api, r.units);
          if (u) u.perm.vit -= 1;
          return `계측기가 비명을 질렀습니다. 과학지상주의자들만 환호했습니다. 체력 -20${u ? `, ${nm(u)} 생명력 -1` : ''}.`;
        },
      },
    ],
  },
];
