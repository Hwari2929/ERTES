// 성간 인류 연합 · 주식회사 페트라
import { inc, red, vuln } from '../engine/effects';
import { lineTargets, pct, shock, skillHit, summonsOf } from './kit';
import { cookPower, pickEnemy, strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type BaseUnit } from './unitkit';

const DRONE = ['#0c0e12', '#5a7090', '#2a3040', '#9ab0c8', '#7fe3ff', '#40465a', '#e0f0ff'];
const BOT = ['#0c0c12', '#3a3f58', '#c8ccd8', '#9aa0b0', '#ff5a5a', '#2a2e40', '#ffffff'];

export const ROSTER_A: BaseUnit[] = [
  // ───────── 성간 인류 연합
  {
    id: 'yelena', name: '예레나', title: '전 보안위원회 델타 요원 · 대외협력담당', factions: ['UNI'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'soldier', palette: tint(PAL.UNI, '#5a5e6a', '#2a6ad8', '#3a8aff'), lore: '"밀린 업무가 많아요. 까먹기 전에, 모두 해치우죠."',
    skill: strike({
      name: '항밈 소거', cd: 7, pow: 'tech', elem: 'psy', mult: 1.6, params: { forget: 3, fear: 1, fearChance: 0.4, weak: 0.2, weakDur: 4 },
      desc: (p) => `대상${p.radius ? `과 주변 ${p.radius}칸` : ''}에게 기술 위력 ${pct(p.mult)} 정신 피해. 기억이 지워진 적은 기술 쿨다운 +${p.forget}초, ${p.weakDur}초간 주는 피해 -${pct(p.weak)}, ${pct(p.fearChance)} 확률로 ${p.fear}초 공포${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}.`,
      after: (b, u, t, _d, p) => {
        for (const e of p.radius ? b.around(t, p.radius, b.enemiesOf(u)) : [t]) if (e.alive) {
          e.cd += p.forget;
          b.applyStatus(u, e, { type: 'buff', key: 'yelena.weak', dur: p.weakDur, mods: [inc('all', -p.weak)], label: '항밈 약화' });
        }
      },
    }),
  },
  {
    id: 'mirinae', name: '미리내', title: '"신기루" 추적·잠입 전문가', factions: ['UNI'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.15 }, range: 5, base: B(5, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.UNI, '#4a5a3a', '#1a1a22', '#3a8aff'), lore: '"연락은 자제해줘. 캠핑 중이니까 - "',
    skill: strike({
      name: '깜찍이', cd: 6, pow: 'shoot', elem: 'phys', mult: 2.8, params: { crit: 0.125 },
      desc: (p) => `커스텀 에너지 핸드캐논으로 대상에게 사격 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p${p.pen ? `, 방어도 관통 ${pct(p.pen)}` : ''})${p.hits > 1 ? `, ${p.hits}회` : ''}. 가능하면 한 발로 끝낸다.`,
    }),
  },
  {
    id: 'gebek', name: '게베크', title: '"괴수" 중화기 전문가 · 창립 멤버', factions: ['UNI'], traits: ['ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(8, 9, 7, 6, 3),
    sprite: 'mech', palette: tint(PAL.UNI, '#3a3f4a', '#c03a2a', '#ff6040'), lore: '"비결? 이 요망한 주둥아리지."',
    skill: strike({
      name: '헤비 버니 화망', cd: 8, pow: 'shoot', elem: 'phys', mult: 0.5, params: { radius: 1, hits: 5, second: 1 },
      desc: (p) => `막내 유리가 이름 붙인 기관총으로 대상 주변 ${p.radius}칸에 사격 위력 ${pct(p.mult)} 물리 연사 ${p.hits}회${p.corrode ? `. 맞은 적 5초간 방어도 -${pct(p.corrode)}` : ''}.`,
    }),
  },
  {
    id: 'donovan', name: '도노반', title: '전 보안위원회 특수요원 "밤까마귀"', factions: ['UNI'], traits: ['INFIL', 'BUDDY'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(6, 9, 7, 4, 7),
    sprite: 'soldier', palette: tint(PAL.UNI, '#5a5a66', '#2a2a30', '#b07cff'),
    summon: { name: '까악이', art: 'sm_crow', sprite: 'drone', palette: DRONE, atk: { type: 'shoot', elem: 'elec', interval: 0.8 }, range: 3, hpMul: 1.2 },
    lore: '"휴가 중. 기한 100년. 고양이 사료는 문 앞에."',
    skill: strike({
      name: '자안의 사수', cd: 7, pow: 'tech', elem: 'phys', mult: 2.0, target: 'lowest', blink: true, params: { crit: 0.2 },
      desc: (p) => `급소가 붉게 보인다. 체력 비율이 가장 낮은 적에게 파고들어 단분자 와이어로 기술 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p)${p.bleed ? `, 4초간 초당 ${pct(p.bleed)} 출혈` : ''}${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}${p.shock ? `, ${pct(p.shockChance || 0.7)} 확률로 ${p.shock}초 감전` : ''}. 까악이는 4초간 공격 속도 +50%로 같은 적을 노린다.`,
      after: (b, u, t) => { for (const d of summonsOf(b, u)) { d.target = t; b.buff(u, d, 'donovan.crow', 4, { delta: { atkSpd: 0.5 }, label: '해킹 지원' }); } },
    }),
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
  },
  {
    id: 'west', name: '웨스트', title: '연합군 원사 출신 · 시설담당', factions: ['UNI'], traits: ['ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(7, 8, 8, 5, 3),
    sprite: 'soldier', palette: tint(PAL.UNI, '#e0c020', '#3a4a6a', '#7fe3ff'), lore: '"흠. 그래. 일단 담배 한 대 피고 얘기하지."',
    skill: strike({
      name: '스패너 던지기', cd: 7, pow: 'shoot', elem: 'phys', mult: 1.6, params: { stun: 1, fix: 1.0, overclock: 0.35 },
      desc: (p) => `대상에게 스패너를 던져 사격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절. 모든 포탑을 기술 위력 ${pct(p.fix)}만큼 수리하고 4초간 공격 속도 +${pct(p.overclock)}.`,
      after: (b, u, _t, _d, p) => {
        for (const t of b.alliesOf(u)) if (t.defId === 'turret') { b.heal(u, t, b.P(u, 'tech') * p.fix); b.buff(u, t, 'west.oc', 4, { delta: { atkSpd: p.overclock }, label: '정비' }); }
      },
    }),
  },
  // ───────── 주식회사 페트라
  {
    id: 'lindiwe', name: '린디웨', title: '페트라 특별경호팀 협력팀장', factions: ['PET'], traits: [], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(10, 7, 5, 8, 3),
    sprite: 'knight', palette: tint(PAL.PET, '#e07a1f', '#f0e0c0', '#7dff8a'), lore: '"행복은 잠깐이지만, 신용은 영원하죠"',
    skill: strike({
      name: '실드 제너레이터', cd: 8, pow: 'strike', elem: 'phys', mult: 1.2, aroundSelf: true, params: { radius: 1, selfShield: 0.3, counter: 0.3, dur: 4 },
      desc: (p) => `팔목 방어막을 전개해 최대 체력 ${pct(p.selfShield)} 보호막을 얻고, 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해${p.stun ? ` + ${p.stun}초 기절` : ''}. ${p.dur}초간 받은 피해의 ${pct(p.counter)}를 카운터로 되돌려준다.`,
      after: (b, u, _t, _d, p) => { b.buff(u, u, 'lindiwe.guard', p.dur, { reflect: p.counter, label: '카운터' }); },
    }),
  },
  {
    id: 'orca', name: '오르카', title: '범고래 환수 · 에란테스 재정담당', factions: ['PET'], traits: ['CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(7, 5, 8, 6, 3),
    sprite: 'medic', palette: tint(PAL.PET, '#1a1a22', '#e8e8f0', '#e8e8f0'), lore: '"사기라뇨 - 그런 비겁한 행동은 선호하지 않아요."',
    skill: support({
      name: '바 당직 시그니처', cd: 4.5, target: 'lowest', power: cookPower, params: { heal: 1.8, as: 0.35, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복${p.shield ? ` + ${pct(p.shield)} 보호막` : ''}${p.cleanse ? ' + 해로운 상태이상 제거' : ''}하고 ${p.dur}초간 공격 속도 +${pct(p.as)}${p.dmg ? `, 피해 +${pct(p.dmg)}` : ''}${p.red ? `, 받는 피해 -${pct(p.red)}` : ''}.`,
    }),
  },
  {
    id: 'franze', name: '프란체', title: '크림슨 강화 혈족 · 은하법률고문', factions: ['PET'], traits: [], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.95 }, range: 1, base: B(8, 8, 5, 6, 5),
    sprite: 'knight', palette: tint(PAL.PET, '#2a2a34', '#c02030', '#ff3040'), lore: '"이의 있습니다. 방금 그 발언, 기록해도 되겠습니까?"',
    skill: strike({
      name: '이의 있습니다', cd: 7, pow: 'strike', elem: 'phys', mult: 1.8, params: { rewind: 0.125 },
      desc: (p) => `에너지 블레이드로 대상에게 타격 위력 ${pct(p.mult)} 물리 피해${p.stun ? ` + ${p.stun}초 기절` : ''}. 이후 잃은 체력의 ${pct(p.rewind)}를 재생한다.`,
      after: (b, u, _t, _d, p) => { b.heal(u, u, (b.S(u, 'maxHp') - u.hp) * p.rewind, true); },
    }),
  },
  {
    id: 'grenholm', name: '그렌홀름', title: '페트라 전쟁부장', factions: ['PET'], traits: ['STAR'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(11, 6, 5, 8, 2),
    sprite: 'knight', palette: tint(PAL.PET, '#24242e', '#e0602a', '#ff8a40'),
    lore: '"이 병신같은 보고서 양식은 주주님의 좆같은 면상을 따와 그린 겁니까?" — 주주총회에서',
    skill: strike({
      name: '군수품 시연', cd: 8, pow: 'strike', elem: 'phys', mult: 1.0, aroundSelf: true, params: { radius: 1, stun: 1, selfShield: 0.3 },
      desc: (p) => `에너지 블레이드와 EMP로 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}. 7중 방호 슈트가 최대 체력 ${pct(p.selfShield)} 보호막을 전개한다.`,
    }),
  },
  {
    id: 'lars', name: '라르스', title: '엘베스타드가 가주 · 페트라 무역관세부장', factions: ['PET', 'FAM'], traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(6, 7, 7, 5, 5),
    sprite: 'soldier', palette: tint(PAL.FAM, '#16161c', '#3a5ab0', '#d4a83a'),
    summon: { name: '페트라 경호원', art: 'sm_guard', sprite: 'soldier', palette: BOT, atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, hpMul: 1.5 },
    lore: '"좋습니다. 서로가 만족할 거래가 되었군요."',
    // 비무장: 폭력은 경호팀에게 아웃소싱했다
    passive: {
      setup: (u) => { u.noAttack = true; u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; },
      hooks: { takenMult: (b, u) => (summonsOf(b, u).length ? 0.75 : 1) },
    },
    skill: {
      name: '거래 제안', tag: () => '강적 약화 · 경호원 지원', cd: 8, params: { shield: 1.5, mult: 2.0, weak: 0.2, dur: 4, vuln: 0 },
      desc: (p) => `[비무장] 기본 공격을 하지 않는다. 경호원 2명을 데려오며, 경호원이 살아 있는 동안 피해량 경감 25%. 체력이 가장 높은 적에게 거래를 제안해 ${p.dur}초간 주는 피해 -${pct(p.weak)}${p.vuln ? `, 받는 피해 +${pct(p.vuln)}` : ''}. 경호원들에게 기술 위력 ${pct(p.shield)} 보호막을 주고 그 적을 타격 위력 ${pct(p.mult)}로 공격하게 한다.`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'strongest');
        if (!t) return false;
        const p = u.sk;
        b.applyStatus(u, t, { type: 'buff', key: 'deal.lars', dur: p.dur, mods: [inc('all', -p.weak)], taken: p.vuln ? [vuln('all', p.vuln)] : undefined, label: '거래 조건' });
        b.fx(t.x, t.y, 0, 'psy');
        for (const bot of summonsOf(b, u)) {
          b.shield(bot, b.P(u, 'tech') * p.shield);
          bot.target = t;
          if (b.dist(bot, t) <= 1) skillHit(b, bot, t, 'strike', p.mult, 'phys');
        }
        return true;
      },
    },
  },
  {
    id: 'falcon', name: '팔콘', title: '페트라 레일건 시험 사수', factions: ['PET'], traits: ['ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.4 }, range: 6, base: B(4, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.PET, '#d0d0d8', '#e07a1f', '#62d6ff'), lore: '시제품 레일건 시험 사격 1,204회. 사고 보고서 1,203건.',
    skill: {
      name: '레일건', tag: () => '직선 관통 사격', cd: 8, needsRange: true, params: { mult: 2.8, pen: 0.4, crit: 0, shock: 0 },
      desc: (p) => `대상 방향 직선 위 모든 적에게 사격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)}${p.crit ? `, 치명타 확률 +${pct(p.crit)}p` : ''})${p.shock ? `. ${pct(p.shock)} 확률로 2초 감전` : ''}.`,
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
  },
];
export { inc, red };
