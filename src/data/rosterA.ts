// 성간 인류 연합 · 주식회사 페트라
import { inc, red, vuln } from '../engine/effects';
import { lineTargets, pct, shock, skillHit, summonsOf } from './kit';
import { cookPower, pickEnemy, strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type UnitDef } from './unitkit';

const nat = (n: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + n; } });
const DRONE = ['#0c0e12', '#5a7090', '#2a3040', '#9ab0c8', '#7fe3ff', '#40465a', '#e0f0ff'];
const BOT = ['#0c0c12', '#3a3f58', '#c8ccd8', '#9aa0b0', '#ff5a5a', '#2a2e40', '#ffffff'];

export const ROSTER_A: UnitDef[] = [
  // ───────── 성간 인류 연합
  {
    id: 'yelena', name: '예레나', title: '전 보안위원회 델타 요원 · 대외협력담당', factions: ['UNI'], traits: ['SPEC', 'NATURE'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'soldier', palette: tint(PAL.UNI, '#5a5e6a', '#2a6ad8', '#3a8aff'), lore: '"밀린 업무가 많아요. 까먹기 전에, 모두 해치우죠."',
    skill: strike({
      name: '항밈 소거', cd: 7, pow: 'tech', elem: 'psy', mult: 1.6, params: { forget: 3, fear: 1, fearChance: 0.4 },
      desc: (p) => `대상${p.radius ? `과 주변 ${p.radius}칸` : ''}에게 기술 위력 ${pct(p.mult)} 정신 피해. 기억이 지워진 적은 기술 쿨다운 +${p.forget}초, ${pct(p.fearChance)} 확률로 ${p.fear}초 공포.`,
      after: (b, u, t, _d, p) => { for (const e of p.radius ? b.around(t, p.radius, b.enemiesOf(u)) : [t]) if (e.alive) e.cd += p.forget; },
    }),
    augs: [
      uaug('yelena', 'wide', '광역 소거', '항밈 소거가 대상 주변 1칸에도 닿는다.', setSk((s) => { s.radius += 1; })),
      uaug('yelena', 'deep', '깊은 망각', '쿨다운 증가 +2초, 공포 확률 +20%p.', setSk((s) => { s.forget += 2; s.fearChance += 0.2; })),
      uaug('yelena', 'delta', '델타 등급 기밀', '소거당한 적은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('yelena', 'report', '보고서의 마지막 줄', '항밈 소거 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('yelena', 'hoodie', '라쿤 후드티', '캠핑 러버 임시 장비 +1개, 정신력 +3.', { ...nat(1), majors: { mnd: 3 } }),
    ],
  },
  {
    id: 'mirinae', name: '미리내', title: '"신기루" 추적·잠입 전문가', factions: ['UNI'], traits: ['MARK', 'NATURE'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.15 }, range: 5, base: B(5, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.UNI, '#4a5a3a', '#1a1a22', '#3a8aff'), lore: '"연락은 자제해줘. 캠핑 중이니까 - "',
    skill: strike({
      name: '깜찍이', cd: 6, pow: 'shoot', elem: 'phys', mult: 2.8, params: { crit: 0.25 },
      desc: (p) => `커스텀 에너지 핸드캐논으로 대상에게 사격 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p)${p.hits > 1 ? `, ${p.hits}회` : ''}. 가능하면 한 발로 끝낸다.`,
    }),
    augs: [
      uaug('mirinae', 'double', '연발 모드', '깜찍이를 2회 쏜다 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('mirinae', 'cell', '과충전 셀', '방어도 관통 50%.', setSk((s) => { s.pen = 0.5; })),
      uaug('mirinae', 'vanish', '흔적 없이', '깜찍이로 처치하면 쿨다운 초기화.', setSk((s) => { s.resetOnKill = 1; })),
      uaug('mirinae', 'gem', '푸른 물방울 보석', '치명타 확률 +20%p, 치명타 피해 +40%p.', { stats: { crit: 0.2, critDmg: 0.4 } }),
      uaug('mirinae', 'onsen', '휴대용 온천 시스템', '캠핑 러버 임시 장비 +1개, 기동력 +3.', { ...nat(1), majors: { agi: 3 } }),
    ],
  },
  {
    id: 'gebek', name: '게베크', title: '"괴수" 중화기 전문가 · 창립 멤버', factions: ['UNI'], traits: ['MARK', 'ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(8, 9, 7, 6, 3),
    sprite: 'mech', palette: tint(PAL.UNI, '#3a3f4a', '#c03a2a', '#ff6040'), lore: '"비결? 이 요망한 주둥아리지."',
    skill: strike({
      name: '헤비 버니 화망', cd: 8, pow: 'shoot', elem: 'phys', mult: 0.5, params: { radius: 1, hits: 5, second: 1 },
      desc: (p) => `막내 유리가 이름 붙인 기관총으로 대상 주변 ${p.radius}칸에 사격 위력 ${pct(p.mult)} 물리 연사 ${p.hits}회.`,
    }),
    augs: [
      uaug('gebek', 'drum', '대용량 탄창', '연사 +2회.', setSk((s) => { s.hits += 2; })),
      uaug('gebek', 'zirgon', '팀 지르곤 대전자포', '연사 발당 피해 +20%p.', setSk((s) => { s.mult += 0.2; })),
      uaug('gebek', 'nuke', '핵융합볶음면 탄두', '화망에 맞은 적 방어도 25% 감소 (5초).', setSk((s) => { s.corrode = 0.25; })),
      uaug('gebek', 'suit', '15년치 전투 데이터', '방어력 +4, 생명력 +2.', { majors: { def: 4, vit: 2 } }),
      uaug('gebek', 'spare', '예비 포탑', '엔지니어 포탑 +1기.', { setup: (u) => { u.mem.turretExtra = (u.mem.turretExtra || 0) + 1; } }),
    ],
  },
  {
    id: 'donovan', name: '도노반', title: '전 보안위원회 특수요원 "밤까마귀"', factions: ['UNI'], traits: ['INFIL', 'BUDDY'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(6, 9, 7, 4, 7),
    sprite: 'soldier', palette: tint(PAL.UNI, '#5a5a66', '#2a2a30', '#b07cff'),
    summon: { name: '까악이', sprite: 'drone', palette: DRONE, atk: { type: 'shoot', elem: 'elec', interval: 0.8 }, range: 3, hpMul: 1.2 },
    lore: '"휴가 중. 기한 100년. 고양이 사료는 문 앞에."',
    skill: strike({
      name: '자안의 사수', cd: 7, pow: 'strike', elem: 'phys', mult: 2.0, target: 'lowest', blink: true, params: { crit: 0.4 },
      desc: (p) => `급소가 붉게 보인다. 체력 비율이 가장 낮은 적에게 파고들어 단분자 와이어로 타격 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p). 까악이는 4초간 공격 속도 +50%로 같은 적을 노린다.`,
      after: (b, u, t) => { for (const d of summonsOf(b, u)) { d.target = t; b.buff(u, d, 'donovan.crow', 4, { delta: { atkSpd: 0.5 }, label: '해킹 지원' }); } },
    }),
    augs: [
      uaug('donovan', 'wire', '단분자 와이어', '4초간 초당 타격 위력 30% 출혈.', setSk((s) => { s.bleed = 0.3; })),
      uaug('donovan', 'marker', '붉은 마커', '자안의 사수에 맞은 적은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('donovan', 'livibold', '리비볼드 경', '까악이 스탯 상속률 +30%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.3; } }),
      uaug('donovan', 'deck', '팔목 해킹 덱', '자안의 사수가 70% 확률로 2초 감전을 건다.', setSk((s) => { s.shock = 2; s.shockChance = 0.7; })),
      uaug('donovan', 'ice', '얼음 씹기', '회피 +15%p, 공격 속도 +15%.', { stats: { eva: 0.15, atkSpd: 0.15 } }),
    ],
  },
  {
    id: 'chloe', name: '클로에', title: '의무실 항밈담당 · 전 보안위원회 잠입 요원', factions: ['UNI'], traits: ['MED', 'STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 3, base: B(6, 6, 9, 4, 5),
    sprite: 'medic', palette: tint(PAL.UNI, '#1a1a22', '#f0f0f0', '#ff80c0'), lore: '"어머, 이 숙녀가 여기 있으면 안 될 이유라도 있으신가요?"',
    skill: support({
      name: '업계 비밀 배합', cd: 7, target: 'lowest', params: { heal: 1.2, cleanse: 1, sleep: 2, sleepChance: 0.5 },
      desc: (p) => `체력 비율이 가장 낮은 아군${p.radius ? `과 주변 ${p.radius}칸` : ''}에게 약물을 투여해 기술 위력 ${pct(p.heal)} 회복 + 해로운 상태이상 제거. 가장 가까운 적에게는 항밈 수면제를 써서 ${pct(p.sleepChance)} 확률로 ${p.sleep}초 기절.`,
      after: (b, u, _ts, p) => { const e = b.nearest(u, b.enemiesOf(u)); if (e) b.stun(u, e, p.sleep, p.sleepChance); },
    }),
    augs: [
      uaug('chloe', 'seven', '나머지 7%', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('chloe', 'sedative', '마취약 투약 요령', '수면 확률 +30%p.', setSk((s) => { s.sleepChance += 0.3; })),
      uaug('chloe', 'batch', '여러 사람 몫', '약물이 대상 주변 1칸 아군에게도 닿는다.', setSk((s) => { s.radius = 1; })),
      uaug('chloe', 'lady', '숙녀의 통과', '회피 +20%p.', { stats: { eva: 0.2 } }),
      uaug('chloe', 'photo', '머리만 뜬 사진', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'west', name: '웨스트', title: '연합군 원사 출신 · 시설담당', factions: ['UNI'], traits: ['SPEC', 'ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(7, 8, 8, 5, 3),
    sprite: 'soldier', palette: tint(PAL.UNI, '#e0c020', '#3a4a6a', '#7fe3ff'), lore: '"흠. 그래. 일단 담배 한 대 피고 얘기하지."',
    skill: strike({
      name: '스패너 던지기', cd: 7, pow: 'shoot', elem: 'phys', mult: 1.6, params: { stun: 1, fix: 1.0, overclock: 0.35 },
      desc: (p) => `대상에게 스패너를 던져 사격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절. 모든 포탑을 기술 위력 ${pct(p.fix)}만큼 수리하고 4초간 공격 속도 +${pct(p.overclock)}.`,
      after: (b, u, _t, _d, p) => {
        for (const t of b.alliesOf(u)) if (t.defId === 'turret') { b.heal(u, t, b.S(u, 'tech') * p.fix); b.buff(u, t, 'west.oc', 4, { delta: { atkSpd: p.overclock }, label: '정비' }); }
      },
    }),
    augs: [
      uaug('west', 'spanner', '스패너 명사수', '스패너 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('west', 'cig', '일단 담배 한 대', '쿨다운 감소 속도 +20%.', { stats: { cdr: 0.2 } }),
      uaug('west', 'nco', '원사의 짬', '명중 +20%p, 치명타 확률 +10%p.', { stats: { acc: 0.2, crit: 0.1 } }),
      uaug('west', 'honey', '꿀 퍼먹기', '생명력 +4.', { majors: { vit: 4 } }),
      uaug('west', 'standard', '은하 기술 표준', '엔지니어 포탑 체력·방어도 +60%.', { setup: (u) => { u.mem.turretHp = (u.mem.turretHp || 0) + 0.6; } }),
    ],
  },
  // ───────── 주식회사 페트라
  {
    id: 'lindiwe', name: '린디웨', title: '페트라 특별경호팀 협력팀장', factions: ['PET'], traits: ['STAFF', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(10, 7, 5, 8, 3),
    sprite: 'knight', palette: tint(PAL.PET, '#e07a1f', '#f0e0c0', '#7dff8a'), lore: '"행복은 잠깐이지만, 신용은 영원하죠"',
    skill: strike({
      name: '실드 제너레이터', cd: 8, pow: 'strike', elem: 'phys', mult: 1.2, aroundSelf: true, params: { radius: 1, selfShield: 0.3, counter: 0.3, dur: 4 },
      desc: (p) => `팔목 방어막을 전개해 최대 체력 ${pct(p.selfShield)} 보호막을 얻고, 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해. ${p.dur}초간 받은 피해의 ${pct(p.counter)}를 카운터로 되돌려준다.`,
      after: (b, u, _t, _d, p) => { b.buff(u, u, 'lindiwe.guard', p.dur, { reflect: p.counter, label: '카운터' }); },
    }),
    augs: [
      uaug('lindiwe', 'onetwo', '원투 스트레이트', '실드 제너레이터 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('lindiwe', 'overload', '출력 과부하', '보호막 +20%p.', setSk((s) => { s.selfShield += 0.2; })),
      uaug('lindiwe', 'weave', '위빙', '카운터 반사량 +20%p, 지속 +2초.', setSk((s) => { s.counter += 0.2; s.dur += 2; })),
      uaug('lindiwe', 'dough', '반죽 치대기', '실드 제너레이터에 맞은 적 0.8초 기절.', setSk((s) => { s.stun = 0.8; })),
      uaug('lindiwe', 'tenure', '10년 근속', '방어력 +5, 생명력 +2.', { majors: { def: 5, vit: 2 } }),
    ],
  },
  {
    id: 'orca', name: '오르카', title: '범고래 환수 · 에란테스 재정담당', factions: ['PET'], traits: ['STAFF', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(7, 5, 8, 6, 3),
    sprite: 'medic', palette: tint(PAL.PET, '#1a1a22', '#e8e8f0', '#e8e8f0'), lore: '"사기라뇨 - 그런 비겁한 행동은 선호하지 않아요."',
    skill: support({
      name: '바 당직 시그니처', cd: 4.5, target: 'lowest', power: cookPower, params: { heal: 1.8, as: 0.35, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 공격 속도 +${pct(p.as)}.`,
    }),
    augs: [
      uaug('orca', 'herring', '긴 다리 청어 조림', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('orca', 'espresso', '에스프레소', '공격 속도 증가 +15%p.', setSk((s) => { s.as += 0.15; })),
      uaug('orca', 'blanca', '블랑카 크림빵', '기술 위력 60% 보호막도 준다.', setSk((s) => { s.shield = 0.6; })),
      uaug('orca', 'counsel', '상담 시간', '요리받은 아군의 해로운 상태이상 제거.', setSk((s) => { s.cleanse = 1; })),
      uaug('orca', 'coin', '동전 마술', '요리받은 아군 피해 +15%.', setSk((s) => { s.dmg = 0.15; })),
    ],
  },
  {
    id: 'franze', name: '프란체', title: '크림슨 강화 혈족 · 은하법률고문', factions: ['PET'], traits: ['TIME', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.95 }, range: 1, base: B(8, 8, 5, 6, 5),
    sprite: 'knight', palette: tint(PAL.PET, '#2a2a34', '#c02030', '#ff3040'), lore: '"이의 있습니다. 방금 그 발언, 기록해도 되겠습니까?"',
    skill: strike({
      name: '이의 있습니다', cd: 7, pow: 'strike', elem: 'phys', mult: 1.8, params: { rewind: 0.25 },
      desc: (p) => `에너지 블레이드로 대상에게 타격 위력 ${pct(p.mult)} 물리 피해. 이후 잃은 체력의 ${pct(p.rewind)}를 재생한다.`,
      after: (b, u, _t, _d, p) => { b.heal(u, u, (b.S(u, 'maxHp') - u.hp) * p.rewind, true); },
    }),
    augs: [
      uaug('franze', 'precedent', '판례 인용', '이의 있습니다 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('franze', 'deferred', '유예된 시한부', '잃은 체력 재생량 +15%p.', setSk((s) => { s.rewind += 0.15; })),
      uaug('franze', 'oldform', '110년 전의 검술', '이의 있습니다가 0.8초 기절을 건다.', setSk((s) => { s.stun = 0.8; })),
      uaug('franze', 'blood', '혈족 재생력', '이의 있습니다 피해의 30%만큼 회복.', setSk((s) => { s.lifesteal = 0.3; })),
      uaug('franze', 'stocks', '취미 주식 계좌', '회피 +10%p. 전투 승리 시 크레딧 +1.', { stats: { eva: 0.1 } }, { after: (run, _u, won) => { if (won) run.credits += 1; } }),
    ],
  },
  {
    id: 'grenholm', name: '그렌홀름', title: '페트라 전쟁부장', factions: ['PET'], traits: ['VAN', 'STAR'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(11, 6, 5, 8, 2),
    sprite: 'knight', palette: tint(PAL.PET, '#24242e', '#e0602a', '#ff8a40'),
    lore: '"이 병신같은 보고서 양식은 주주님의 좆같은 면상을 따와 그린 겁니까?" — 주주총회에서',
    skill: strike({
      name: '군수품 시연', cd: 8, pow: 'strike', elem: 'phys', mult: 1.0, aroundSelf: true, params: { radius: 1, stun: 1, selfShield: 0.3 },
      desc: (p) => `에너지 블레이드와 EMP로 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}. 7중 방호 슈트가 최대 체력 ${pct(p.selfShield)} 보호막을 전개한다.`,
    }),
    augs: [
      uaug('grenholm', 'deflect', '에너지 편향막', '보호막 +20%p.', setSk((s) => { s.selfShield += 0.2; })),
      uaug('grenholm', 'rocket', '휴대용 로켓런처', '군수품 시연 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('grenholm', 'sevenfold', '7중 방호 체계', '체력 50% 이상일 때 받는 피해 -20%. 방호가 뚫리면 불이행 사건이다.', { hooks: { takenMult: (b, u) => (b.hpPct(u) >= 0.5 ? 0.8 : 1) } }),
      uaug('grenholm', 'evidence', '자료 첨부', '모욕한 뒤 사실임을 증명한다. 맞은 적 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('grenholm', 'loss', '기대손실 시리즈', 'SNS 연재. 전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'lars', name: '라르스', title: '엘베스타드가 가주 · 페트라 무역관세부장', factions: ['PET', 'FAM'], traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(6, 7, 7, 5, 5),
    sprite: 'soldier', palette: tint(PAL.FAM, '#16161c', '#3a5ab0', '#d4a83a'),
    summon: { name: '페트라 경호원', sprite: 'soldier', palette: BOT, atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, hpMul: 1.5 },
    lore: '"좋습니다. 서로가 만족할 거래가 되었군요."',
    // 비무장: 폭력은 경호팀에게 아웃소싱했다
    passive: {
      setup: (u) => { u.noAttack = true; u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; },
      hooks: { takenMult: (b, u) => (summonsOf(b, u).length ? 0.75 : 1) },
    },
    skill: {
      name: '거래 제안', cd: 8, params: { shield: 1.5, mult: 2.0, weak: 0.2, dur: 4, vuln: 0 },
      desc: (p) => `[비무장] 기본 공격을 하지 않는다. 경호원 2명을 데려오며, 경호원이 살아 있는 동안 받는 피해 -25%. 체력이 가장 높은 적에게 거래를 제안해 ${p.dur}초간 주는 피해 -${pct(p.weak)}${p.vuln ? `, 받는 피해 +${pct(p.vuln)}` : ''}. 경호원들에게 기술 위력 ${pct(p.shield)} 보호막을 주고 그 적을 타격 위력 ${pct(p.mult)}로 공격하게 한다.`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'strongest');
        if (!t) return false;
        const p = u.sk;
        b.applyStatus(u, t, { type: 'buff', key: 'deal.lars', dur: p.dur, mods: [inc('all', -p.weak)], taken: p.vuln ? [vuln('all', p.vuln)] : undefined, label: '거래 조건' });
        b.fx(t.x, t.y, 0, 'psy');
        for (const bot of summonsOf(b, u)) {
          b.shield(bot, b.S(u, 'tech') * p.shield);
          bot.target = t;
          if (b.dist(bot, t) <= 1) skillHit(b, bot, t, 'strike', p.mult, 'phys');
        }
        return true;
      },
    },
    augs: [
      uaug('lars', 'guards', '경호 인력 증원', '경호원이 한 명 더 붙는다 (상속률 60%). 관심이 지독한 편이다.', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } }),
      uaug('lars', 'elite', '정예 경호팀', '경호원 스탯 상속률 +30%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.3; } }),
      uaug('lars', 'downstream', '10%의 하류', '손실은 항상 그가 아닌 쪽에 떨어진다. 거래 대상이 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('lars', 'terms', '상호 이익', '거래 조건 약화 +15%p, 지속 +2초.', setSk((s) => { s.weak += 0.15; s.dur += 2; })),
      uaug('lars', 'resell', '손실 매각', '손실을 얼마에 되팔았는지부터 설명한다. 전투 승리 시 크레딧 +2.', {}, { after: (run, _u, won) => { if (won) run.credits += 2; } }),
    ],
  },
  {
    id: 'falcon', name: '팔콘', title: '페트라 레일건 시험 사수', factions: ['PET'], traits: ['MARK', 'ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.4 }, range: 6, base: B(4, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.PET, '#d0d0d8', '#e07a1f', '#62d6ff'), lore: '시제품 레일건 시험 사격 1,204회. 사고 보고서 1,203건.',
    skill: {
      name: '레일건', cd: 8, needsRange: true, params: { mult: 2.8, pen: 0.4, crit: 0, shock: 0 },
      desc: (p) => `대상 방향 직선 위 모든 적에게 사격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)}).`,
      cast(b, u) {
        const t = u.target;
        if (!t?.alive) return false;
        const p = u.sk;
        for (const e of lineTargets(b, u, t)) {
          b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'elec', ranged: true });
          skillHit(b, u, e, 'shoot', p.mult, 'phys', { pen: p.pen, critBonus: p.crit });
          if (p.shock && e.alive) shock(b, u, e, 2, p.shock);
        }
        return true;
      },
    },
    augs: [
      uaug('falcon', 'charge', '완충 사격', '레일건 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('falcon', 'core', '텅스텐 탄심', '방어도 관통 +30%p.', setSk((s) => { s.pen += 0.3; })),
      uaug('falcon', 'arc', '잔류 전하', '레일건에 맞은 적 60% 확률로 2초 감전.', setSk((s) => { s.shock = 0.6; })),
      uaug('falcon', 'turret', '시제 포탑', '엔지니어 포탑 체력·방어도 +60%.', { setup: (u) => { u.mem.turretHp = (u.mem.turretHp || 0) + 0.6; } }),
      uaug('falcon', 'scope', '열상 조준경', '레일건 치명타 확률 +30%p.', setSk((s) => { s.crit = 0.3; })),
    ],
  },
];
export { inc, red };
