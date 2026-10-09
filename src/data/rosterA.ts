// 성간 인류 연합 · 주식회사 페트라
import { inc, red } from '../engine/effects';
import { lineTargets, pct, shock, skillHit, summonsOf } from './kit';
import { cookPower, strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type UnitDef } from './unitkit';

const nat = (n: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + n; } });
const DRONE = ['#0c0e12', '#5a7090', '#2a3040', '#9ab0c8', '#7fe3ff', '#40465a', '#e0f0ff'];
const BOT = ['#0c0c12', '#3a3f58', '#c8ccd8', '#9aa0b0', '#ff5a5a', '#2a2e40', '#ffffff'];

export const ROSTER_A: UnitDef[] = [
  // ───────── 성간 인류 연합
  {
    id: 'yelena', name: '예레나', title: '연합 현장 과학자', factions: ['UNI'], traits: ['SPEC', 'NATURE'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'medic', palette: tint(PAL.UNI, '#4a7ad8', '#e8f0ff', '#7fe3ff'), lore: '측정값이 이상하면, 측정 대상을 감전시켜 보면 된다.',
    skill: strike({
      name: '열화상 분석', cd: 7, pow: 'tech', elem: 'elec', mult: 1.6, params: { radius: 1, shock: 2, shockChance: 0.5 },
      desc: (p) => `대상과 주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.mult)} 전기 피해, ${pct(p.shockChance)} 확률로 ${p.shock}초 감전.`,
    }),
    augs: [
      uaug('yelena', 'wide', '광역 스캔', '분석 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('yelena', 'overload', '과부하 판정', '감전 확률 +30%p, 지속 +1초.', setSk((s) => { s.shockChance += 0.3; s.shock += 1; })),
      uaug('yelena', 'weak', '약점 데이터', '분석당한 적은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('yelena', 'precise', '정밀 계측', '분석 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('yelena', 'lab', '야전 실험실', '캠핑 러버 임시 장비 +1개, 정신력 +3.', { ...nat(1), majors: { mnd: 3 } }),
    ],
  },
  {
    id: 'mirinae', name: '미리내', title: '연합 은하수 레인저', factions: ['UNI'], traits: ['MARK', 'NATURE'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.15 }, range: 5, base: B(5, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.UNI, '#2a5a9a', '#d8c090', '#ffe080'), lore: '별자리로 길을 찾고, 별빛으로 조준한다.',
    skill: strike({
      name: '은하수 저격', cd: 6, pow: 'shoot', elem: 'phys', mult: 2.8, params: { crit: 0.25 },
      desc: (p) => `대상에게 사격 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p)${p.hits > 1 ? `, ${p.hits}회` : ''}.`,
    }),
    augs: [
      uaug('mirinae', 'double', '쌍성', '은하수 저격을 2회 쏜다 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('mirinae', 'pierce', '유성 탄두', '방어도 관통 50%.', setSk((s) => { s.pen = 0.5; })),
      uaug('mirinae', 'reset', '별똥별 사냥', '은하수 저격으로 처치하면 쿨다운 초기화.', setSk((s) => { s.resetOnKill = 1; })),
      uaug('mirinae', 'focus', '천체 관측', '치명타 확률 +20%p, 치명타 피해 +40%p.', { stats: { crit: 0.2, critDmg: 0.4 } }),
      uaug('mirinae', 'camp', '별빛 야영', '캠핑 러버 임시 장비 +1개, 기동력 +3.', { ...nat(1), majors: { agi: 3 } }),
    ],
  },
  {
    id: 'gebek', name: '게베크', title: '연합 포병 기술병', factions: ['UNI'], traits: ['MARK', 'ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.2 }, range: 4, base: B(7, 9, 7, 5, 3),
    sprite: 'mech', palette: tint(PAL.UNI, '#3a5a8a', '#b0c0d8', '#ffb040'), lore: '좌표만 불러 줘. 나머지는 포탄이 알아서 한다.',
    skill: strike({
      name: '포격 요청', cd: 8, pow: 'shoot', elem: 'phys', mult: 1.9, params: { radius: 1 },
      desc: (p) => `대상 주변 ${p.radius}칸에 사격 위력 ${pct(p.mult)} 물리 포격.`,
    }),
    augs: [
      uaug('gebek', 'carpet', '융단 폭격', '포격 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('gebek', 'he', '고폭탄', '포격 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('gebek', 'shell', '충격탄', '포격에 맞은 적 0.8초 기절.', setSk((s) => { s.stun = 0.8; })),
      uaug('gebek', 'acid', '산성 탄두', '포격에 맞은 적 방어도 25% 감소 (5초).', setSk((s) => { s.corrode = 0.25; })),
      uaug('gebek', 'spare', '예비 포탑', '엔지니어 포탑 +1기.', { setup: (u) => { u.mem.turretExtra = (u.mem.turretExtra || 0) + 1; } }),
    ],
  },
  {
    id: 'donovan', name: '도노반', title: '연합 특수부대 코만도', factions: ['UNI'], traits: ['INFIL', 'BUDDY'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(6, 9, 6, 4, 7),
    sprite: 'soldier', palette: tint(PAL.UNI, '#2a3a4a', '#6a7a5a', '#ff6040'),
    summon: { name: '스패로우', sprite: 'drone', palette: DRONE, atk: { type: 'shoot', elem: 'elec', interval: 0.8 }, range: 2, hpMul: 0.7 },
    lore: '드론 이름은 전우에게서 따왔다. 그 전우는 아직 살아 있다. 본인은 불만이다.',
    skill: strike({
      name: '드론 공습', cd: 7, pow: 'strike', elem: 'phys', mult: 2.0, target: 'lowest', blink: true,
      desc: (p) => `체력이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 물리 피해. 드론은 4초간 공격 속도 +50%로 같은 적을 노린다.`,
      after: (b, u, t) => { for (const d of summonsOf(b, u)) { d.target = t; b.buff(u, d, 'donovan.raid', 4, { delta: { atkSpd: 0.5 }, label: '공습' }); } },
    }),
    augs: [
      uaug('donovan', 'knife', '전투 단검', '드론 공습 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('donovan', 'bleed', '출혈 유도', '공습 대상에게 4초간 초당 타격 위력 30% 출혈.', setSk((s) => { s.bleed = 0.3; })),
      uaug('donovan', 'second', '2번기 출격', '드론을 하나 더 띄운다 (상속률 60%).', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } }),
      uaug('donovan', 'upgrade', '드론 개량', '드론 스탯 상속률 +30%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.3; } }),
      uaug('donovan', 'ghillie', '위장복', '회피 +20%p.', { stats: { eva: 0.2 } }),
    ],
  },
  {
    id: 'chloe', name: '클로에', title: '연합 위문 공연 의무병', factions: ['UNI'], traits: ['MED', 'STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.1 }, range: 3, base: B(7, 6, 8, 5, 4),
    sprite: 'medic', palette: tint(PAL.UNI, '#ff8ac8', '#ffffff', '#7fe3ff'), lore: '노래 한 곡에 붕대 한 롤. 앙코르는 수술비 별도.',
    skill: support({
      name: '응원가', cd: 8, target: 'all', params: { heal: 0.75, as: 0.2, dur: 4 },
      desc: (p) => `모든 아군을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 공격 속도 +${pct(p.as)}.`,
    }),
    augs: [
      uaug('chloe', 'chorus', '합창', '응원가 회복량 +30%p.', setSk((s) => { s.heal += 0.3; })),
      uaug('chloe', 'tempo', '빠른 템포', '공격 속도 증가 +15%p.', setSk((s) => { s.as += 0.15; })),
      uaug('chloe', 'encore', '앙코르 무대', '응원가 쿨다운 -1.5초.', setSk((_s, u) => { u.cdMax -= 1.5; })),
      uaug('chloe', 'shield', '무대 조명', '응원가가 기술 위력 40% 보호막도 준다.', setSk((s) => { s.shield = 0.4; })),
      uaug('chloe', 'fame', '위문 공연 실황', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'west', name: '웨스트', title: '연합 전투 공병', factions: ['UNI'], traits: ['SPEC', 'ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.0 }, range: 3, base: B(6, 7, 8, 5, 4),
    sprite: 'soldier', palette: tint(PAL.UNI, '#c08030', '#3a4a6a', '#ffd34d'), lore: '고칠 수 없으면 개조한다. 개조할 수 없으면 터뜨린다.',
    skill: support({
      name: '과부하 프로토콜', cd: 8, target: 'aroundSelf', params: { radius: 2, as: 0.35, dur: 4 },
      desc: (p) => `주변 ${p.radius}칸 아군과 모든 포탑의 공격 속도 ${p.dur}초간 +${pct(p.as)}.`,
      after: (b, u, _ts, p) => { for (const t of b.alliesOf(u)) if (t.defId === 'turret') b.buff(u, t, 'west.oc', p.dur, { delta: { atkSpd: p.as }, label: '과부하' }); },
    }),
    augs: [
      uaug('west', 'range', '중계기', '프로토콜 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('west', 'boost', '한계 돌파', '공격 속도 증가 +20%p.', setSk((s) => { s.as += 0.2; })),
      uaug('west', 'dmg', '고출력 탄창', '프로토콜 대상 피해 +20%.', setSk((s) => { s.dmg = 0.2; })),
      uaug('west', 'turret', '포탑 튜닝', '엔지니어 포탑 공격 속도 +50%.', { setup: (u) => { u.mem.turretAs = (u.mem.turretAs || 0) + 0.5; } }),
      uaug('west', 'wall', '방벽 전개', '프로토콜이 기술 위력 50% 보호막도 준다.', setSk((s) => { s.shield = 0.5; })),
    ],
  },
  // ───────── 주식회사 페트라
  {
    id: 'lindiwe', name: '린디웨', title: '페트라 보안 책임자', factions: ['PET'], traits: ['STAFF', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, base: B(10, 6, 5, 9, 2),
    sprite: 'knight', palette: tint(PAL.PET, '#c06a1a', '#2a2a30', '#7dff8a'), lore: '이 구역은 사유지입니다. 당신도 이제 회사 자산입니다.',
    skill: strike({
      name: '강제 집행', cd: 8, pow: 'strike', elem: 'phys', mult: 1.4, aroundSelf: true, params: { radius: 1, stun: 1, selfShield: 0.2 },
      desc: (p) => `주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절, 자신에게 최대 체력 ${pct(p.selfShield)} 보호막.`,
    }),
    augs: [
      uaug('lindiwe', 'arrest', '연행', '기절 +0.5초.', setSk((s) => { s.stun += 0.5; })),
      uaug('lindiwe', 'armor', '진압 장비', '보호막 +20%p.', setSk((s) => { s.selfShield += 0.2; })),
      uaug('lindiwe', 'zone', '통제 구역', '집행 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('lindiwe', 'fine', '과태료 부과', '집행당한 적은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('lindiwe', 'contract', '종신 계약', '방어력 +5, 생명력 +2.', { majors: { def: 5, vit: 2 } }),
    ],
  },
  {
    id: 'orca', name: '오르카', title: '페트라 임원 전속 셰프', factions: ['PET'], traits: ['STAFF', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(7, 5, 8, 6, 3),
    sprite: 'medic', palette: tint(PAL.PET, '#f0f0f0', '#e07a1f', '#ffcf40'), lore: '이사회 메뉴는 3년 치가 예약돼 있다. 전쟁터 메뉴는 즉흥이다.',
    skill: support({
      name: '고급 코스 요리', cd: 4.5, target: 'lowest', power: cookPower, params: { heal: 1.8, as: 0.35, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 공격 속도 +${pct(p.as)}.`,
    }),
    augs: [
      uaug('orca', 'main', '메인 디시', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('orca', 'espresso', '에스프레소', '공격 속도 증가 +15%p.', setSk((s) => { s.as += 0.15; })),
      uaug('orca', 'dessert', '디저트 코스', '기술 위력 60% 보호막도 준다.', setSk((s) => { s.shield = 0.6; })),
      uaug('orca', 'digest', '소화제', '요리받은 아군의 해로운 상태이상 제거.', setSk((s) => { s.cleanse = 1; })),
      uaug('orca', 'wine', '와인 페어링', '요리받은 아군 피해 +15%.', setSk((s) => { s.dmg = 0.15; })),
    ],
  },
  {
    id: 'franze', name: '프란체', title: '페트라 시간 보험 조사관', factions: ['PET'], traits: ['TIME', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.95 }, range: 1, base: B(8, 8, 5, 6, 5),
    sprite: 'knight', palette: tint(PAL.PET, '#8a5ad0', '#e07a1f', '#7dff8a'), lore: '사고 발생 3초 전으로 돌아가 보상 청구를 기각합니다.',
    skill: strike({
      name: '되감기', cd: 7, pow: 'strike', elem: 'phys', mult: 1.8, params: { rewind: 0.25 },
      desc: (p) => `대상에게 타격 위력 ${pct(p.mult)} 물리 피해 후, 잃은 체력의 ${pct(p.rewind)}를 되돌린다.`,
      after: (b, u, _t, _d, p) => { b.heal(u, u, (b.S(u, 'maxHp') - u.hp) * p.rewind, true); },
    }),
    augs: [
      uaug('franze', 'claim', '보험금 청구', '되감기 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('franze', 'rewind', '완전 복원', '잃은 체력 회복량 +15%p.', setSk((s) => { s.rewind += 0.15; })),
      uaug('franze', 'freeze', '정지 화면', '되감기가 0.8초 기절을 건다.', setSk((s) => { s.stun = 0.8; })),
      uaug('franze', 'leech', '보상 회수', '되감기 피해의 30%만큼 회복.', setSk((s) => { s.lifesteal = 0.3; })),
      uaug('franze', 'premium', '프리미엄 약관', '회피 +10%p. 전투 승리 시 크레딧 +1.', { stats: { eva: 0.1 } }, { after: (run, _u, won) => { if (won) run.credits += 1; } }),
    ],
  },
  {
    id: 'grenholm', name: '그렌홀름', title: '페트라 광고 모델 겸 경호원', factions: ['PET'], traits: ['VAN', 'STAR'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(11, 6, 5, 8, 2),
    sprite: 'mech', palette: tint(PAL.PET, '#f0a040', '#ffffff', '#ff60e0'), lore: '광고 계약서에 "얼굴은 맞지 않는다" 조항이 있다. 그래서 몸으로 막는다.',
    skill: strike({
      name: '쇼타임', cd: 8, pow: 'strike', elem: 'phys', mult: 1.0, aroundSelf: true, params: { radius: 1, stun: 1, selfShield: 0.3 },
      desc: (p) => `주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절, 자신에게 최대 체력 ${pct(p.selfShield)} 보호막.`,
    }),
    augs: [
      uaug('grenholm', 'pose', '포토 타임', '보호막 +20%p.', setSk((s) => { s.selfShield += 0.2; })),
      uaug('grenholm', 'flash', '플래시 세례', '기절 +0.5초.', setSk((s) => { s.stun += 0.5; })),
      uaug('grenholm', 'stage', '대형 무대', '쇼타임 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('grenholm', 'face', '얼굴 보험', '체력 50% 이상일 때 받는 피해 -20%.', { hooks: { takenMult: (b, u) => (b.hpPct(u) >= 0.5 ? 0.8 : 1) } }),
      uaug('grenholm', 'sponsor', '스폰서 노출', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'lars', name: '라르스', title: '엘베스타드가 막내 상속자', factions: ['PET', 'FAM'], traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(6, 7, 7, 5, 5),
    sprite: 'soldier', palette: tint(PAL.FAM, '#5a3a7a', '#e07a1f', '#9ad0ff'),
    summon: { name: '경호 로봇 B-11', sprite: 'mech', palette: BOT, atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, hpMul: 1.5 },
    lore: '용돈으로 산 경호 로봇이 회사 하나 값이다. 본인은 모른다.',
    skill: {
      name: '경호 명령', cd: 8, params: { shield: 1.5, mult: 2.0 },
      desc: (p) => `B-11에게 기술 위력 ${pct(p.shield)} 보호막을 주고 라르스의 대상을 타격 위력 ${pct(p.mult)}로 공격하게 한다. 로봇이 없으면 라르스가 사격 위력 150%로 쏜다.`,
      cast(b, u) {
        const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
        if (!t) return false;
        const bots = summonsOf(b, u);
        if (!bots.length) { b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true }); skillHit(b, u, t, 'shoot', 1.5, 'phys'); return true; }
        for (const bot of bots) {
          b.shield(bot, b.S(u, 'tech') * u.sk.shield);
          bot.target = t;
          if (b.dist(bot, t) <= 1) skillHit(b, bot, t, 'strike', u.sk.mult, 'phys');
        }
        return true;
      },
    },
    augs: [
      uaug('lars', 'premium', '프리미엄 모델', 'B-11 스탯 상속률 +30%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.3; } }),
      uaug('lars', 'plating', '보강 장갑', 'B-11 보호막 +50%.', setSk((s) => { s.shield *= 1.5; })),
      uaug('lars', 'spare', '예비기 B-12', '경호 로봇을 하나 더 데려온다 (상속률 60%).', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } }),
      uaug('lars', 'allowance', '용돈', '전투 승리 시 크레딧 +2.', {}, { after: (run, _u, won) => { if (won) run.credits += 2; } }),
      uaug('lars', 'strike', '공격 모드', 'B-11 공격 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
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
