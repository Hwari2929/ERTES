// 칼리토 제국 · 헬레니우스 동맹
import { inc, red } from '../engine/effects';
import { pct, skillHit, summonsOf } from './kit';
import { cookPower, pickEnemy, strike, strongestAlly, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type BaseUnit } from './unitkit';

/** 자하라 에이스 파일럿 [곁을 지키는 곡도]: 주변 아군 반격 피해의 흡혈 비율 (×항해자 단계 배율) */
export const ZAHARA_ACE_STEAL = 0.1;

const faithWin = { after: (run: { power: number }, _u: unknown, won: boolean) => { if (won) run.power += 1; } };
const BEHEMOTH = ['#140608', '#6a1020', '#b02030', '#d06060', '#ffcf40', '#3a0810', '#ff8080'];

/** 카이로 [기다림의 미학]: 스택이 차면 안단테-7 저격 (요리 · 아군 공격 12회마다 스택) */
export function kairoSnipe(b: import('../engine/combat').Battle, u: import('../engine/combat').CUnit) {
  const p = u.sk;
  if ((u.mem.wait ?? 0) < p.need) return;
  const e = pickEnemy(b, u, 'strongest');
  if (e) {
    b.emit({ k: 'skill', id: u.id, name: '기다림의 미학' });
    b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
    skillHit(b, u, e, 'shoot', p.snipe, 'phys', { critBonus: p.snipeCrit, noMiss: true, pen: p.snipePen || 0 });
    // 라스트 오더: 체력 25% 이하로 남으면 처형
    if (p.lastOrder && e.alive && b.hpPct(e) <= p.lastOrder) { b.emit({ k: 'mark', id: e.id, name: '처형', style: 'execute' }); b.kill(e, u); }
    // 더블 샷: 두 번째로 체력이 높은 적에게도
    if (p.double) {
      const e2 = b.targetable(u).filter((x) => x !== e).sort((a, c) => b.S(c, 'maxHp') - b.S(a, 'maxHp'))[0];
      if (e2) { b.emit({ k: 'atk', from: u.id, to: e2.id, elem: 'phys', ranged: true }); skillHit(b, u, e2, 'shoot', p.snipe * p.double, 'phys', { critBonus: p.snipeCrit, noMiss: true, pen: p.snipePen || 0 }); }
    }
  }
  u.mem.wait = p.keep;
}

export const ROSTER_B: BaseUnit[] = [
  // ───────── 칼리토 제국
  {
    id: 'hiiro', name: '히이로', title: '여우 환수 점술사 · 작전고문', factions: ['KAL'], traits: ['STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.2 }, range: 3, base: B(6, 7, 9, 4, 5),
    sprite: 'robe', palette: tint(PAL.KAL, '#f0a0c8', '#ffffff', '#ff60c0'),
    lore: '누군가는 3년 전부터 있었다고 하고, 누군가는 처음부터 있었던 것 같다고 한다.',
    skill: {
      name: '점괘', tag: () => '핵심 아군 강화', cd: 8, params: { count: 1, luck: 0.7, dmg: 0.5, as: 0.3, dur: 5 },
      desc: (p) => `가장 강한 아군 ${p.count}명의 점괘를 본다. ${pct(p.luck)} 확률로 길(${p.dur}초간 피해 +${pct(p.dmg)}, 공격 속도 +${pct(p.as)}), 아니면 흉(피해 +${pct(p.dmg * 0.3)}).`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        for (const a of strongestAlly(b, u, p.count)) {
          const good = b.rng.chance(Math.min(1, p.luck + (u.reason ?? 50) / 400 - 0.125));
          b.addReason(u, good ? 10 : -10);
          b.buff(u, a, 'hiiro.omen', p.dur, good
            ? { delta: { atkSpd: p.as }, mods: [inc('all', p.dmg)], label: '대길' }
            : { mods: [inc('all', p.dmg * 0.3)], label: '흉' });
        }
        return true;
      },
    },
  },
  {
    id: 'nadir', name: '나디르', title: '흑정상회 출신 수정상', factions: ['KAL', 'PAN'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'robe', palette: tint(PAL.KAL, '#e8e8f0', '#40c0c0', '#80e0ff'), lore: '"말만 해요! 깨끗한 기록부터 더러운 금서까지 - 다 제 손바닥 안이거든요."',
    skill: strike({
      name: '백수정 섬광', cd: 7, pow: 'tech', elem: 'psy', mult: 1.4, params: { radius: 1, noMiss: 1, blind: 0.3 },
      desc: (p) => `빈 백수정을 터뜨려 대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 정신 피해, 3초간 명중 -${pct(p.blind)}p${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}.`,
      after: (b, u, t, _d, p) => { for (const e of b.around(t, p.radius, b.enemiesOf(u))) b.applyStatus(u, e, { type: 'buff', key: 'nadir.blind', dur: 3, delta: { acc: -p.blind }, label: '섬광' }); },
    }),
  },
  {
    id: 'temur', name: '테무르', title: '아퀼리 경기장 출신 검투사', factions: ['KAL'], traits: [], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(9, 9, 4, 7, 4),
    sprite: 'knight', palette: tint(PAL.KAL, '#7a5a3a', '#e0b040', '#ffd34d'), lore: '"그래- \'주인님\'. 어디 짭잘한 일감 좀 물어왔나?"',
    skill: strike({
      name: '경기장의 검', cd: 7, pow: 'strike', elem: 'phys', mult: 1.6, aroundSelf: true, params: { radius: 1, pen: 0.3, stun: 0.6 },
      desc: (p) => `압도적인 체급으로 주변 ${p.radius}칸 적을 베어 타격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)}) + ${p.stun}초 기절.`,
    }),
  },
  {
    id: 'kairo', name: '카이로', title: '페르난데즈 백작가 차남 · 콜사인 킬로', factions: ['KAL'], traits: ['CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 6, base: B(6, 9, 8, 4, 4),
    sprite: 'soldier', palette: tint(PAL.KAL, '#5a3a2a', '#e0b040', '#ff3040'), lore: '"사감은 없어. 예술을 추구할 뿐이네."',
    skill: {
      name: '바텐더의 칵테일', tag: () => '약한 아군 보호막 · 치명 강화', cd: 4.5, params: { shield: 1.2, crit: 0.075, dur: 5, need: 8, snipe: 8, snipeCrit: 0.15, keep: 0, start: 2 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군에게 칵테일을 내어 기술 위력 ${pct(p.shield)} 보호막 + ${p.dur}초간 치명타 +${pct(p.crit)}p. 한 잔마다 [기다림의 미학] 1스택 (저격은 특성이 따로 쏜다).`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        const t = b.lowestHpAlly(u);
        if (t) {
          b.shield(t, b.P(u, 'tech') * p.shield * cookPower(u));
          if (p.sigCd && t.skill) t.cd -= p.sigCd; // 시그니처
          b.buff(u, t, 'kairo.cocktail', p.dur, { delta: { crit: p.crit * cookPower(u) }, label: '칵테일' });
        }
        u.mem.wait = (u.mem.wait ?? p.start) + 1;
        b.emit({ k: 'status', id: u.id, name: `기다림 ${u.mem.wait}/${p.need}` });
        return true; // 저격은 특성 [기다림의 미학]이 다음 틱에 별도 행동으로 쏜다
      },
    },
  },
  {
    id: 'zahara', name: '자하라', title: '알-카흐란 유랑령의 전 왕녀', factions: ['KAL'], traits: ['STAR', 'NAV'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 2, base: B(7, 6, 8, 6, 3),
    sprite: 'robe', palette: tint(PAL.KAL, '#2a3a6a', '#e0b040', '#4060c0'), lore: '"날과 감각은 항상 예리해야 해. 이왕이면 카메라 각도도."',
    // 항해자 에이스: 특성 [복수자]의 주변 아군 반격이 확정 + 반격 피해 흡혈 (rework.ts 자하라 특성이 mem.zAce 를 읽는다)
    ace: {
      name: '곁을 지키는 곡도', desc: (k) => `주변 1칸 아군이 피해를 받으면 [복수자] 반격이 반드시 나간다 (50% 확률 대신, 0.4초에 1회는 그대로). 그 반격 피해의 ${pct(ZAHARA_ACE_STEAL * k)}만큼 체력을 흡수한다.`,
      effect: (k) => ({ setup: (u) => { u.mem.zAce = k; } }),
    },
    skill: strike({
      // 유랑민 곡도술: 주변 적을 몰아붙이는 2연타 + 출혈 (예전 [요리] 사라진 레시피 재현 → 공격 기술)
      name: '유랑의 곡도술', cd: 6, pow: 'strike', elem: 'phys', mult: 0.9, aroundSelf: true, params: { radius: 1, hits: 2, second: 1, bleed: 0.25 },
      desc: (p) => `세피르 유랑민의 곡도술로 몰아붙여 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해 ${p.hits}회, 4초간 초당 타격 위력 ${pct(p.bleed)} 출혈.`,
    }),
  },
  {
    id: 'bianca', name: '비앙카', title: '"냉혈한 성녀" 수석 군의관', factions: ['KAL'], traits: ['BUDDY', 'MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(7, 6, 8, 5, 4),
    sprite: 'medic', palette: tint(PAL.KAL, '#f0f0f0', '#5a3a2a', '#80c0ff'),
    summon: { name: '베헤모스', ctype: 'SPEC', art: 'sm_behemoth', sprite: 'crawler', palette: BEHEMOTH, atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, hpMul: 1.4 },
    lore: '"체온 관리는 중요해. 이상 체온은 베헤모스를 자극할 수 있어."',
    skill: support({
      name: '치유 탄환', cd: 7, target: 'lowest', params: { heal: 2.6, petDmg: 0.4 }, // 회복 2.2 → 2.6
      desc: (p) => `의료 드론이 체력 비율이 가장 낮은 아군에게 치유 탄환을 꽂아 기술 위력 ${pct(p.heal)} 회복${p.shield ? ` + ${pct(p.shield)} 보호막` : ''}${p.cleanse ? ', 해로운 상태이상 제거' : ''}${p.red ? `, 4초간 받는 피해 -${pct(p.red)}` : ''}. 베헤모스는 4초간 피해 +${pct(p.petDmg)}.`,
      after: (b, u, ts, p) => {
        for (const d of summonsOf(b, u)) b.buff(u, d, 'bianca.behemoth', 4, { mods: [inc('all', p.petDmg)], label: '변이' });
        // 표본 회수: 베헤모스 대신 치유 대상이 변이 (유전 물질 단계 피해 포함)
        if (u.mem.sample && ts[0]) b.buff(u, ts[0], 'bianca.sample', 4, { mods: [inc('all', p.petDmg + (u.mem.bondAmp || 0))], label: '변이' });
      },
    }),
  },
  // ───────── 헬레니우스 동맹
  {
    id: 'zephyro', name: '제피로', title: '뱃사공 철학자 · 작전계획담당', factions: ['HEL'], traits: ['NAV'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 2, base: B(8, 7, 7, 5, 4),
    sprite: 'soldier', palette: tint(PAL.HEL, '#e8eef0', '#2fa39a', '#40c0a0'), lore: '"역풍이 불 때에는 돛 방향을 틀 줄도 알아야지"',
    ace: {
      name: '강철깃털호 안전 항행', desc: (k) => `전투 시작 시 모든 아군 받는 피해 -${Math.round(8 * k)}%.`,
      effect: (k) => ({ hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'ace.zephyro', 999, { taken: [red('all', 0.08 * k)], label: '안전 항행' }); } } }),
    },
    skill: support({
      name: '돛 방향 틀기', cd: 8, target: 'aroundSelf', params: { radius: 2, red: 0.2, eva: 0.05, dur: 4 },
      desc: (p) => `염동력으로 탄환의 작용점을 비튼다. 주변 ${p.radius}칸 아군 ${p.dur}초간 받는 피해 -${pct(p.red)}, 회피 +${pct(p.eva)}p.`,
    }),
  },
  {
    id: 'phyllis', name: '필리스', title: '고양이 환수 · 전 하데스 사제단', factions: ['HEL'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 0.9 }, range: 1, base: B(5, 9, 7, 3, 8),
    sprite: 'robe', palette: tint(PAL.HEL, '#8a8a90', '#2a2a30', '#ffd040'), lore: '"일은 똑똑하게 해야지- 나 쉬러간다-!"',
    skill: strike({
      name: '균열 도약', cd: 6, pow: 'tech', elem: 'holy', mult: 2.2, target: 'lowest', blink: true, params: { supply: 0.8 },
      desc: (p) => `공간 균열로 체력 비율이 가장 낮은 적에게 파고들어 기술 위력 ${pct(p.mult)} 신성 피해${p.hits > 1 ? ` ${p.hits}회` : ''}.`,
    }),
  },
  {
    id: 'eleni', name: '엘레니', title: '로도스 생환 등대지기 · 영매기사', factions: ['HEL'], traits: ['MED'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(10, 7, 5, 8, 1),
    sprite: 'knight', palette: tint(PAL.HEL, '#e8eef0', '#c0c8d0', '#a0e0ff'), lore: '"셀레네의 은총과 달빛이 우리 앞 길을 비추길-"',
    skill: support({
      name: '달빛 진혼', cd: 9, target: 'aroundSelf', params: { radius: 2, shield: 1.0, heal: 0.5, armor: 0 },
      desc: (p) => `달빛을 모아 자신과 주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.shield)} 보호막 + ${pct(p.heal)} 회복${p.armor ? `, 4초간 방어도 +${p.armor}` : ''}.`,
    }),
  },
  {
    id: 'iris', name: '이리스', title: '이타카 헤르메스 사제', factions: ['HEL'], traits: ['COND'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.0 }, range: 3, base: B(6, 7, 9, 4, 5),
    sprite: 'medic', palette: tint(PAL.HEL, '#f0f0f0', '#d4a83a', '#ffd040'), lore: '"헤르메스 신도가 되는거 어떻게 생각하세요? 그- 일단 우리 헤르메스님이 엄청 잘생기셨거든요!"',
    skill: support({
      name: '헤르메스의 가속', cd: 7, target: 'commanded', params: { count: 2, as: 0.35, dur: 4, jam: 1.2, fearChance: 0.5 },
      desc: (p) => `피해 기여가 가장 큰 아군 ${p.count}명의 공격 속도 ${p.dur}초간 +${pct(p.as)}.`,
    }),
  },
  {
    id: 'odysseus', name: '오디세우스', title: '동맹 귀환 정찰병', factions: ['HEL'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 0.95 }, range: 3, base: B(5, 9, 8, 3, 7),
    sprite: 'soldier', palette: tint(PAL.HEL, '#4a6a3a', '#d8c090', '#ffd34d'), lore: '20년 걸려 귀환했다. 집 비밀번호는 아직 기억난다.',
    skill: strike({
      name: '귀환의 화살', cd: 6, pow: 'shoot', elem: 'phys', mult: 2.6, target: 'lowest', params: { crit: 0.15 },
      desc: (p) => `체력 비율이 가장 낮은 적에게 사격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''} (치명타 확률 +${pct(p.crit)}p)${p.bleed ? `, 4초간 초당 사격 위력 ${pct(p.bleed)} 출혈` : ''}.`,
    }),
  },
  {
    id: 'argon', name: '아르곤', title: '이타카 최고참 도선사 · 뱃사공', factions: ['HEL'], traits: ['NAV'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 0.85 }, range: 4, base: B(6, 9, 8, 4, 5),
    sprite: 'soldier', palette: tint(PAL.HEL, '#c0c8d0', '#2fa39a', '#ff6040'), lore: '신좌의 축복 없이 항해한다. 그래서 배는 느리고, 느리기에 한 번도 잃어버린 적이 없다.',
    ace: {
      name: '최고참의 항로', desc: (k) => `자신의 피해 +${Math.round(25 * k)}%, 치명타 확률 +${Math.round(7.5 * k)}%p.`,
      effect: (k) => ({ mods: [inc('all', 0.25 * k)], stats: { crit: 0.075 * k } }),
    },
    skill: {
      name: '망령권 작살', tag: () => '무작위 화학 6연사', cd: 7, params: { shots: 6, mult: 0.5, shock: 0, crit: 0 },
      desc: (p) => `등불로 항로를 밝히고 무작위 적에게 선상 작살총으로 사격 위력 ${pct(p.mult)} 화학 사격 ${p.shots}회${p.crit ? ` (치명타 확률 +${pct(p.crit)}p)` : ''}${p.shock ? `, 발당 ${pct(p.shock)} 확률로 1.5초 감전` : ''}.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        for (let i = 0; i < p.shots; i++) {
          const es = b.enemiesOf(u);
          if (!es.length) break;
          const t = b.rng.pick(es);
          b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'chem', ranged: true });
          const r = skillHit(b, u, t, 'shoot', p.mult, 'chem', { critBonus: p.crit });
          if (p.shock && !r.miss && t.alive) b.applyStatus(u, t, { type: 'shock', key: 'shock', dur: 1.5 }, p.shock);
        }
        return true;
      },
    },
  },
];
