// 칼리토 제국 · 헬레니우스 동맹
import { inc, red } from '../engine/effects';
import { fear, pct, skillHit, summonsOf } from './kit';
import { cookPower, pickEnemy, strike, strongestAlly, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type UnitDef } from './unitkit';

const nat = (n: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + n; } });
const faithWin = { after: (run: { faith: number }, _u: unknown, won: boolean) => { if (won) run.faith += 1; } };
const BEHEMOTH = ['#140608', '#6a1020', '#b02030', '#d06060', '#ffcf40', '#3a0810', '#ff8080'];

export const ROSTER_B: UnitDef[] = [
  // ───────── 칼리토 제국
  {
    id: 'hiiro', name: '히이로', title: '여우 환수 점술사 · 작전고문', factions: ['KAL'], traits: ['STAFF', 'STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.2 }, range: 3, base: B(6, 7, 9, 4, 5),
    sprite: 'robe', palette: tint(PAL.KAL, '#f0a0c8', '#ffffff', '#ff60c0'),
    lore: '누군가는 3년 전부터 있었다고 하고, 누군가는 처음부터 있었던 것 같다고 한다.',
    skill: {
      name: '점괘', cd: 8, params: { count: 1, luck: 0.7, dmg: 0.5, as: 0.3, dur: 5, fearChance: 0.5 },
      desc: (p) => `가장 강한 아군 ${p.count}명의 점괘를 본다. ${pct(p.luck)} 확률로 길(${p.dur}초간 피해 +${pct(p.dmg)}, 공격 속도 +${pct(p.as)}), 아니면 흉(피해 +${pct(p.dmg * 0.3)}). 가장 가까운 적은 환술에 ${pct(p.fearChance)} 확률로 2초 공포.`,
      cast(b, u) {
        const foe = b.nearest(u, b.enemiesOf(u));
        if (!foe) return false;
        const p = u.sk;
        for (const a of strongestAlly(b, u, p.count)) {
          const good = b.rng.chance(p.luck);
          b.buff(u, a, 'hiiro.omen', p.dur, good
            ? { delta: { atkSpd: p.as }, mods: [inc('all', p.dmg)], label: '대길' }
            : { mods: [inc('all', p.dmg * 0.3)], label: '흉' });
        }
        fear(b, u, foe, 2, p.fearChance);
        return true;
      },
    },
    augs: [
      uaug('hiiro', 'second', '두 번째 점괘', '점괘 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('hiiro', 'daegil', '대길', '길이 나올 확률 +20%p.', setSk((s) => { s.luck = Math.min(1, s.luck + 0.2); })),
      uaug('hiiro', 'linger', '긴 여운', '점괘 지속 +3초.', setSk((s) => { s.dur += 3; })),
      uaug('hiiro', 'nine', '구미 본체', '정신력 +3, 회피 +15%p.', { majors: { mnd: 3 }, stats: { eva: 0.15 } }),
      uaug('hiiro', 'sns', '야경 사진 한 장', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'nadir', name: '나디르', title: '흑정상회 출신 수정상', factions: ['KAL', 'PAN'], traits: ['SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'robe', palette: tint(PAL.KAL, '#e8e8f0', '#40c0c0', '#80e0ff'), lore: '"말만 해요! 깨끗한 기록부터 더러운 금서까지 - 다 제 손바닥 안이거든요."',
    skill: strike({
      name: '백수정 섬광', cd: 7, pow: 'tech', elem: 'psy', mult: 1.4, params: { radius: 1, noMiss: 1, blind: 0.3 },
      desc: (p) => `빈 백수정을 터뜨려 대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 정신 피해, 3초간 명중 -${pct(p.blind)}p.`,
      after: (b, u, t, _d, p) => { for (const e of b.around(t, p.radius, b.enemiesOf(u))) b.applyStatus(u, e, { type: 'buff', key: 'nadir.blind', dur: 3, delta: { acc: -p.blind }, label: '섬광' }); },
    }),
    augs: [
      uaug('nadir', 'flare', '광원 증폭', '섬광 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('nadir', 'focus', '한 점 집중', '섬광 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('nadir', 'glare', '눈부신 영사', '명중 감소 +20%p.', setSk((s) => { s.blind += 0.2; })),
      uaug('nadir', 'camo', '영사 위장', '전투 시작 후 4초간 회피 +40%p.', { hooks: { onStart(b, u) { b.buff(u, u, 'nadir.camo', 4, { delta: { eva: 0.4 }, label: '위장' }); } } }),
      uaug('nadir', 'pocket', '이차원 주머니', '정신력 +3, 전투력 +2.', { majors: { mnd: 3, pow: 2 } }),
    ],
  },
  {
    id: 'temur', name: '테무르', title: '아퀼리 경기장 출신 검투사', factions: ['KAL'], traits: ['VAN', 'NATURE'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(9, 9, 4, 7, 4),
    sprite: 'knight', palette: tint(PAL.KAL, '#7a5a3a', '#e0b040', '#ffd34d'), lore: '"그래- \'주인님\'. 어디 짭잘한 일감 좀 물어왔나?"',
    skill: strike({
      name: '경기장의 검', cd: 7, pow: 'strike', elem: 'phys', mult: 1.6, aroundSelf: true, params: { radius: 1, pen: 0.3, stun: 0.6 },
      desc: (p) => `압도적인 체급으로 주변 ${p.radius}칸 적을 베어 타격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)}) + ${p.stun}초 기절.`,
    }),
    augs: [
      uaug('temur', 'rapier', '바위 가르는 레이피어', '피해 +30%p, 방어도 관통 +30%p.', setSk((s) => { s.mult += 0.3; s.pen += 0.3; })),
      uaug('temur', 'ritual', '등에 박힌 의식 검', '경기장의 검 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('temur', 'lava', '용암 보행', '효과 저항 +30%p, 방어도 +150.', { stats: { effRes: 0.3, armor: 150 } }),
      uaug('temur', 'meal', '두 배 식사', '생명력 +5.', { majors: { vit: 5 } }),
      uaug('temur', 'fur', '모피 코트 두 겹', '캠핑 러버 임시 장비 +1개, 생명력 +2.', { ...nat(1), majors: { vit: 2 } }),
    ],
  },
  {
    id: 'kairo', name: '카이로', title: '페르난데즈 백작가 차남 · 콜사인 킬로', factions: ['KAL'], traits: ['MARK', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 6, base: B(6, 9, 8, 4, 4),
    sprite: 'soldier', palette: tint(PAL.KAL, '#5a3a2a', '#e0b040', '#ff3040'), lore: '"사감은 없어. 예술을 추구할 뿐이네."',
    skill: {
      name: '바텐더의 칵테일', cd: 4.5, params: { shield: 1.2, crit: 0.15, dur: 5, need: 6, snipe: 8, snipeCrit: 0.3, keep: 0, start: 2 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군에게 칵테일을 내어 기술 위력 ${pct(p.shield)} 보호막 + ${p.dur}초간 치명타 +${pct(p.crit)}p. 한 잔마다 [기다림의 미학] 1스택, ${p.need}스택이면 안단테-7로 체력이 가장 높은 적에게 사격 위력 ${pct(p.snipe)} 물리 저격 (치명타 확률 +${pct(p.snipeCrit)}p). 전투 시작 시 ${p.start}스택.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        const t = b.lowestHpAlly(u);
        if (t) {
          b.shield(t, b.S(u, 'tech') * p.shield * cookPower(u));
          b.buff(u, t, 'kairo.cocktail', p.dur, { delta: { crit: p.crit * cookPower(u) }, label: '칵테일' });
        }
        u.mem.wait = (u.mem.wait ?? p.start) + 1;
        b.emit({ k: 'status', id: u.id, name: `기다림 ${u.mem.wait}/${p.need}` });
        if (u.mem.wait >= p.need) {
          const e = pickEnemy(b, u, 'strongest');
          if (e) {
            b.emit({ k: 'skill', id: u.id, name: '기다림의 미학' });
            b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
            skillHit(b, u, e, 'shoot', p.snipe, 'phys', { critBonus: p.snipeCrit, noMiss: true });
          }
          u.mem.wait = p.keep;
        }
        return true;
      },
    },
    augs: [
      uaug('kairo', 'patience', '5개월의 잠복', '저격에 필요한 스택 -1 (5스택).', setSk((s) => { s.need -= 1; })),
      uaug('kairo', 'record', '11.8km 기록', '저격 피해 +300%p.', setSk((s) => { s.snipe += 3; })),
      uaug('kairo', 'pendant', '반쪽짜리 펜던트', '저격 후 스택 2개가 남는다.', setSk((s) => { s.keep = 2; })),
      uaug('kairo', 'andante', '안단테-7 정비', '저격 치명타 확률 +30%p, 치명타 피해 +50%p.', { stats: { critDmg: 0.5 }, setup: (u) => { u.sk.snipeCrit += 0.3; } }),
      uaug('kairo', 'eden', '에덴 글라스', '칵테일 보호막 +50%p.', setSk((s) => { s.shield += 0.5; })),
    ],
  },
  {
    id: 'zahara', name: '자하라', title: '알-카흐란 유랑령의 전 왕녀', factions: ['KAL'], traits: ['STAR', 'CHEF'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 2, base: B(7, 6, 8, 6, 3),
    sprite: 'robe', palette: tint(PAL.KAL, '#2a3a6a', '#e0b040', '#4060c0'), lore: '"날과 감각은 항상 예리해야 해. 이왕이면 카메라 각도도."',
    skill: support({
      name: '사라진 레시피 재현', cd: 4.5, target: 'strongest', power: cookPower, params: { heal: 1.2, dmg: 0.45, dur: 5, count: 1 },
      desc: (p) => `[요리] 소실 직전의 레시피로 가장 강한 아군 ${p.count}명을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 피해 +${pct(p.dmg)}.`,
    }),
    augs: [
      uaug('zahara', 'tteok', '딸기 떡과 아몬드', '피해 증가 +15%p.', setSk((s) => { s.dmg += 0.15; })),
      uaug('zahara', 'spice', '알-카흐란 향신료', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('zahara', 'tea', '유랑령의 차', '요리받은 아군 공격 속도 +20%.', setSk((s) => { s.as = 0.2; })),
      uaug('zahara', 'market', '흑정상회 식자재', '요리 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('zahara', 'camera', '아카이지온 카메라', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'bianca', name: '비앙카', title: '"냉혈한 성녀" 수석 군의관', factions: ['KAL'], traits: ['BUDDY', 'MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(7, 6, 8, 5, 4),
    sprite: 'medic', palette: tint(PAL.KAL, '#f0f0f0', '#5a3a2a', '#80c0ff'),
    summon: { name: '베헤모스', sprite: 'crawler', palette: BEHEMOTH, atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, hpMul: 1.4 },
    lore: '"체온 관리는 중요해. 이상 체온은 베헤모스를 자극할 수 있어."',
    skill: support({
      name: '치유 탄환', cd: 7, target: 'lowest', params: { heal: 1.8, petDmg: 0.4 },
      desc: (p) => `의료 드론이 체력 비율이 가장 낮은 아군에게 치유 탄환을 꽂아 기술 위력 ${pct(p.heal)} 회복. 베헤모스는 4초간 피해 +${pct(p.petDmg)}.`,
      after: (b, u, _ts, p) => { for (const d of summonsOf(b, u)) b.buff(u, d, 'bianca.behemoth', 4, { mods: [inc('all', p.petDmg)], label: '변이' }); },
    }),
    augs: [
      uaug('bianca', 'hands', '신의 손', '회복량 +50%p.', setSk((s) => { s.heal += 0.5; })),
      uaug('bianca', 'carapace', '갑각류형 프리셋', '베헤모스 스탯 상속률 +20%p, 방어도 +300.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.2; u.mem.summonArmor = (u.mem.summonArmor || 0) + 300; } }),
      uaug('bianca', 'pheromone', '식별 페로몬', '치유 탄환이 기술 위력 80% 보호막도 준다.', setSk((s) => { s.shield = 0.8; })),
      uaug('bianca', 'scalpel', '투척 메스', '공격 속도 +20%, 치명타 확률 +15%p.', { stats: { atkSpd: 0.2, crit: 0.15 } }),
      uaug('bianca', 'wash', '손 씻기 일곱 번', '치유 탄환 대상의 해로운 상태이상 제거.', setSk((s) => { s.cleanse = 1; })),
    ],
  },
  // ───────── 헬레니우스 동맹
  {
    id: 'zephyro', name: '제피로', title: '뱃사공 철학자 · 작전계획담당', factions: ['HEL'], traits: ['STAFF', 'NAV'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(8, 7, 7, 5, 4),
    sprite: 'soldier', palette: tint(PAL.HEL, '#e8eef0', '#2fa39a', '#40c0a0'), lore: '"역풍이 불 때에는 돛 방향을 틀 줄도 알아야지"',
    ace: {
      name: '강철깃털호 안전 항행', desc: (k) => `전투 시작 시 모든 아군 받는 피해 -${Math.round(8 * k)}%.`,
      effect: (k) => ({ hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'ace.zephyro', 999, { taken: [red('all', 0.08 * k)], label: '안전 항행' }); } } }),
    },
    skill: support({
      name: '돛 방향 틀기', cd: 8, target: 'aroundSelf', params: { radius: 2, red: 0.2, eva: 0.1, dur: 4 },
      desc: (p) => `염동력으로 탄환의 작용점을 비튼다. 주변 ${p.radius}칸 아군 ${p.dur}초간 받는 피해 -${pct(p.red)}, 회피 +${pct(p.eva)}p.`,
    }),
    augs: [
      uaug('zephyro', 'sail', '넓은 돛', '범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('zephyro', 'athena', '아테나의 축복', '받는 피해 감소 +10%p.', setSk((s) => { s.red += 0.1; })),
      uaug('zephyro', 'detour', '우회 항로', '회피 증가 +10%p.', setSk((s) => { s.eva += 0.1; })),
      uaug('zephyro', 'nap', '느긋한 항해', '지속 +3초.', setSk((s) => { s.dur += 3; })),
      uaug('zephyro', 'pen', '투필', '사거리 +1, 공격 속도 +25%.', { stats: { range: 1, atkSpd: 0.25 } }),
    ],
  },
  {
    id: 'phyllis', name: '필리스', title: '고양이 환수 · 전 하데스 사제단', factions: ['HEL'], traits: ['INFIL', 'CLERIC'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 0.9 }, range: 1, base: B(5, 9, 7, 3, 8),
    sprite: 'robe', palette: tint(PAL.HEL, '#8a8a90', '#2a2a30', '#ffd040'), lore: '"일은 똑똑하게 해야지- 나 쉬러간다-!"',
    skill: strike({
      name: '균열 도약', cd: 6, pow: 'strike', elem: 'holy', mult: 2.2, target: 'lowest', blink: true, params: { supply: 0.8 },
      desc: (p) => `공간 균열로 체력 비율이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 신성 피해${p.hits > 1 ? ` ${p.hits}회` : ''}. 긴급 조달한 물자를 체력이 가장 낮은 아군에게 전송해 기술 위력 ${pct(p.supply)} 보호막.`,
      after: (b, u, _t, _d, p) => { const a = b.lowestHpAlly(u); if (a) b.shield(a, b.S(u, 'tech') * p.supply); },
    }),
    augs: [
      uaug('phyllis', 'rush', '균열 돌진', '균열 도약이 2회 공격 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('phyllis', 'supply', '긴급 조달', '전송 보호막 +60%p.', setSk((s) => { s.supply += 0.6; })),
      uaug('phyllis', 'slack', '농땡이', '처치하면 쿨다운 70% 회복.', setSk((s) => { s.resetOnKill = 0.7; })),
      uaug('phyllis', 'tail', '꼬리 매달리기', '회피 +15%p, 방어력 +3.', { stats: { eva: 0.15 }, majors: { def: 3 } }),
      uaug('phyllis', 'prayers', '1,364종 기도문', '전투 승리 시 신앙 +1.', {}, faithWin),
    ],
  },
  {
    id: 'eleni', name: '엘레니', title: '로도스 생환 등대지기 · 영매기사', factions: ['HEL'], traits: ['VAN', 'MED'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(10, 7, 5, 8, 1),
    sprite: 'knight', palette: tint(PAL.HEL, '#e8eef0', '#c0c8d0', '#a0e0ff'), lore: '"셀레네의 은총과 달빛이 우리 앞 길을 비추길-"',
    skill: strike({
      name: '달빛 진혼', cd: 8, pow: 'strike', elem: 'phys', mult: 1.2, aroundSelf: true, params: { radius: 1, guard: 1.0, mend: 0.5, armor: 0 },
      desc: (p) => `대검으로 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해. 자신과 주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.guard)} 보호막 + ${pct(p.mend)} 회복${p.armor ? `, 4초간 방어도 +${p.armor}` : ''}.`,
      after: (b, u, _t, _d, p) => {
        for (const a of b.around(u, p.radius, b.alliesOf(u))) {
          b.shield(a, b.S(u, 'tech') * p.guard);
          b.heal(u, a, b.S(u, 'tech') * p.mend);
          if (p.armor) b.buff(u, a, 'eleni.light', 4, { delta: { armor: p.armor }, label: '달빛' });
        }
      },
    }),
    augs: [
      uaug('eleni', 'baklava', '바클라바 세 조각', '보호막 +50%p.', setSk((s) => { s.guard += 0.5; })),
      uaug('eleni', 'harp', '하프 연주', '회복량 +40%p.', setSk((s) => { s.mend += 0.4; })),
      uaug('eleni', 'lighthouse', '등대지기', '달빛 진혼 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('eleni', 'moon', '태양이 꺼져도 달은 뜬다', '달빛 진혼 대상 4초간 방어도 +250.', setSk((s) => { s.armor = 250; })),
      uaug('eleni', 'blade', '위협용 대검', '대검 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
    ],
  },
  {
    id: 'iris', name: '이리스', title: '이타카 헤르메스 사제', factions: ['HEL'], traits: ['CLERIC', 'SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.0 }, range: 3, base: B(6, 7, 9, 4, 5),
    sprite: 'medic', palette: tint(PAL.HEL, '#f0f0f0', '#d4a83a', '#ffd040'), lore: '"헤르메스 신도가 되는거 어떻게 생각하세요? 그- 일단 우리 헤르메스님이 엄청 잘생기셨거든요!"',
    skill: support({
      name: '헤르메스의 가속', cd: 7, target: 'commanded', params: { count: 2, as: 0.35, dur: 4, jam: 1.2, fearChance: 0.5 },
      desc: (p) => `가장 강한 아군 ${p.count}명의 공격 속도 ${p.dur}초간 +${pct(p.as)}. 가장 가까운 적의 인지를 교란해 기술 위력 ${pct(p.jam)} 신성 피해 + ${pct(p.fearChance)} 확률로 1.5초 공포.`,
      after: (b, u, _ts, p) => {
        const e = b.nearest(u, b.enemiesOf(u));
        if (!e) return;
        skillHit(b, u, e, 'tech', p.jam, 'holy', { noMiss: true });
        if (e.alive) fear(b, u, e, 1.5, p.fearChance);
      },
    }),
    augs: [
      uaug('iris', 'kerykeion', '케리케이온 레플리카', '가속 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('iris', 'blessing', '헤르메스의 축복', '공격 속도 증가 +15%p.', setSk((s) => { s.as += 0.15; })),
      uaug('iris', 'goods', '공식 굿즈 사업', '전투 승리 시 크레딧 +2.', {}, { after: (run, _u, won) => { if (won) run.credits += 2; } }),
      uaug('iris', 'sparta', '스파르타 생존 무술', '회피 +15%p, 기동력 +2.', { stats: { eva: 0.15 }, majors: { agi: 2 } }),
      uaug('iris', 'praise', '헤르메스님 찬양', '전투 승리 시 신앙 +1.', {}, faithWin),
    ],
  },
  {
    id: 'odysseus', name: '오디세우스', title: '동맹 귀환 정찰병', factions: ['HEL'], traits: ['MARK', 'INFIL'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 0.95 }, range: 3, base: B(5, 9, 8, 3, 7),
    sprite: 'soldier', palette: tint(PAL.HEL, '#4a6a3a', '#d8c090', '#ffd34d'), lore: '20년 걸려 귀환했다. 집 비밀번호는 아직 기억난다.',
    skill: strike({
      name: '귀환의 화살', cd: 6, pow: 'shoot', elem: 'phys', mult: 2.6, target: 'lowest', params: { crit: 0.3 },
      desc: (p) => `체력 비율이 가장 낮은 적에게 사격 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p).`,
    }),
    augs: [
      uaug('odysseus', 'twin', '두 발의 화살', '귀환의 화살을 2회 쏜다 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('odysseus', 'hunt', '사냥 귀환', '처치하면 쿨다운 70% 회복.', setSk((s) => { s.resetOnKill = 0.7; })),
      uaug('odysseus', 'bow', '명궁', '치명타 확률 +20%p.', setSk((s) => { s.crit += 0.2; })),
      uaug('odysseus', 'barb', '미늘 화살촉', '맞은 적 4초간 초당 사격 위력 30% 출혈.', setSk((s) => { s.bleed = 0.3; })),
      uaug('odysseus', 'horse', '트로이 목마', '전투 시작 후 3초간 회피 +50%p.', { hooks: { onStart(b, u) { b.buff(u, u, 'ody.horse', 3, { delta: { eva: 0.5 }, label: '목마' }); } } }),
    ],
  },
  {
    id: 'argon', name: '아르곤', title: '동맹 에이스 전투기 조종사', factions: ['HEL'], traits: ['NAV'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 0.85 }, range: 4, base: B(6, 9, 8, 4, 5),
    sprite: 'soldier', palette: tint(PAL.HEL, '#c0c8d0', '#2fa39a', '#ff6040'), lore: '격추 마크를 기체에 다 그리지 못해 날개 아래까지 그렸다.',
    ace: {
      name: '에이스의 귀환', desc: (k) => `자신의 피해 +${Math.round(25 * k)}%, 치명타 확률 +${Math.round(15 * k)}%p.`,
      effect: (k) => ({ mods: [inc('all', 0.25 * k)], stats: { crit: 0.15 * k } }),
    },
    skill: {
      name: '기총 소사', cd: 7, params: { shots: 6, mult: 0.5, shock: 0, crit: 0 },
      desc: (p) => `무작위 적에게 사격 위력 ${pct(p.mult)} 물리 사격 ${p.shots}회.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        for (let i = 0; i < p.shots; i++) {
          const es = b.enemiesOf(u);
          if (!es.length) break;
          const t = b.rng.pick(es);
          b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
          const r = skillHit(b, u, t, 'shoot', p.mult, 'phys', { critBonus: p.crit });
          if (p.shock && !r.miss && t.alive) b.applyStatus(u, t, { type: 'shock', key: 'shock', dur: 1.5 }, p.shock);
        }
        return true;
      },
    },
    augs: [
      uaug('argon', 'ammo', '탄띠 추가', '기총 소사 +3발.', setSk((s) => { s.shots += 3; })),
      uaug('argon', 'caliber', '대구경 기관포', '기총 소사 발당 피해 +15%p.', setSk((s) => { s.mult += 0.15; })),
      uaug('argon', 'tracer', '전기 예광탄', '발당 20% 확률로 1.5초 감전.', setSk((s) => { s.shock = 0.2; })),
      uaug('argon', 'roll', '배럴 롤', '회피 +15%p, 기동력 +3.', { stats: { eva: 0.15 }, majors: { agi: 3 } }),
      uaug('argon', 'gunsight', '조준 사격', '기총 소사 치명타 확률 +25%p.', setSk((s) => { s.crit = 0.25; })),
    ],
  },
];
