// 사건 전용 기물: 사건 노드로만 합류한다 (시작 기물 · 영입 노드에는 나오지 않음)
import { inc, red } from '../engine/effects';
import { fear, pct, skillHit } from './kit';
import { strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type UnitDef } from './unitkit';

const CAT = ['#0c0a10', '#3a3448', '#e8e0f0', '#c8b8d8', '#9ad0ff', '#2a2434', '#ffffff'];
const CRIMSON = ['#100406', '#4a0a14', '#d0c0c0', '#e8c8b8', '#ff2030', '#2a0a10', '#fff0f0'];
const SPARTA = ['#0c0a06', '#b08a30', '#5a4a30', '#f0d080', '#ff6020', '#6a5a30', '#fff0c0'];
const UNIX = ['#0c0c0c', '#b0b0a0', '#6a6a60', '#e0e0d0', '#30ff60', '#4a4a40', '#ffffff'];
const RAIDER = ['#1a0f0a', '#7a5a3a', '#c04a2a', '#d0a080', '#ffd040', '#55504a', '#f0d0a0'];

export const ROSTER_E: UnitDef[] = [
  {
    id: 'mingki', name: '밍키', title: '엘베스타드 저택 고양이 · 성운을 먹는다(?)', factions: ['FAM'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.7 }, range: 1, base: B(6, 8, 5, 4, 9),
    sprite: 'beast', palette: CAT, eventOnly: true, noStarter: true,
    lore: '"잘 먹이지 않으면 밍키 내면의 괴물이 깨어날 거야." — 올리버',
    passive: {
      hooks: {
        onHurt(b, u) {
          if (u.mem.monster || b.hpPct(u) > (u.sk.monsterAt || 0.5)) return;
          u.mem.monster = 1;
          b.buff(u, u, 'mingki.monster', 999, { delta: { atkSpd: 0.5 }, mods: [inc('all', 0.8)], label: '내면의 괴물' });
          b.emit({ k: 'status', id: u.id, name: '내면의 괴물이 깨어났다!' });
        },
      },
    },
    skill: strike({
      name: '츄르 사냥', cd: 6, pow: 'strike', elem: 'phys', mult: 1.8, target: 'lowest', blink: true, params: { monsterAt: 0.5, heal: 0.1 },
      desc: (p) => `[내면의 괴물] 체력이 처음 ${pct(p.monsterAt)} 이하가 되면 피해 +80%, 공격 속도 +50%. 기술: 체력 비율이 가장 낮은 적에게 뛰어들어 타격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''}, 최대 체력 ${pct(p.heal)} 회복.`,
      after: (b, u, _t, _d, p) => { b.heal(u, u, b.S(u, 'maxHp') * p.heal); },
    }),
    augs: [
      uaug('mingki', 'nebula', '성운 흡입', '츄르 사냥 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('mingki', 'hungry', '배고픈 괴물', '내면의 괴물이 체력 75%에서 깨어난다.', setSk((s) => { s.monsterAt = 0.75; })),
      uaug('mingki', 'nine', '아홉 목숨', '전투당 1회, 쓰러질 피해를 받으면 체력 50%로 버틴다.', {
        hooks: { onLethal(b, u) { if (u.mem.nine) return false; u.mem.nine = 1; u.hp = b.S(u, 'maxHp') * 0.5; b.emit({ k: 'status', id: u.id, name: '아홉 목숨' }); return true; } },
      }),
      uaug('mingki', 'groom', '그루밍', '회피 +15%p, 효과 저항 +25%p.', { stats: { eva: 0.15, effRes: 0.25 } }),
      uaug('mingki', 'double', '꾹꾹이 연타', '츄르 사냥 2회 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
    ],
  },
  {
    id: 'onyx', name: '오닉스 감응자', title: '오닉스 합창단 · 사이오닉 감응 집단', factions: ['PAN'], traits: ['SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.1 }, range: 3, base: B(5, 5, 11, 3, 5),
    sprite: 'robe', palette: tint(PAL.PAN, '#1a1a2a', '#9a5ad0', '#d0b0ff'), eventOnly: true, noStarter: true,
    lore: '설계되지 않았는데 꾸어지는 꿈이 있다. 합창단은 그것을 "의뢰하지 않은 꿈"이라 부른다. [임시]',
    skill: {
      name: '의뢰하지 않은 꿈', cd: 8, params: { mult: 0.9, fearChance: 0.25, fear: 1.5, vuln: 0 },
      desc: (p) => `모든 적에게 기술 위력 ${pct(p.mult)} 정신 피해, ${pct(p.fearChance)} 확률로 ${p.fear}초 공포${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}.`,
      cast(b, u) {
        const es = b.enemiesOf(u);
        if (!es.length) return false;
        const p = u.sk;
        b.fx(u.x, u.y, 0, 'psy');
        for (const e of es) {
          skillHit(b, u, e, 'tech', p.mult, 'psy', { noMiss: true });
          if (e.alive) fear(b, u, e, p.fear, p.fearChance);
          if (e.alive && p.vuln) b.applyStatus(u, e, { type: 'buff', key: 'onyx.dream', dur: 4, taken: [{ kind: 'vuln', tag: 'all', v: p.vuln }], label: '악몽' });
        }
        return true;
      },
    },
    augs: [
      uaug('onyx', 'chorus', '대합창', '꿈 피해 +40%p.', setSk((s) => { s.mult += 0.4; })),
      uaug('onyx', 'night', '깊은 밤', '공포 확률 +25%p.', setSk((s) => { s.fearChance += 0.25; })),
      uaug('onyx', 'echo', '메아리', '맞은 적 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('onyx', 'lullaby', '자장가', '기술을 쓸 때마다 모든 아군을 기술 위력 50%만큼 회복.', {
        hooks: { onSkill(b, u) { for (const a of b.alliesOf(u)) b.heal(u, a, b.S(u, 'tech') * 0.5); } },
      }),
      uaug('onyx', 'swarmsong', '군체의 노래', '정신력 +6.', { majors: { mnd: 6 } }),
    ],
  },
  {
    id: 'exile', name: '망명 혈족 귀공자', title: '크림슨 대공령 출신 · 이름을 버린 혈족', factions: ['KAL'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(7, 9, 5, 4, 7),
    sprite: 'knight', palette: CRIMSON, eventOnly: true, noStarter: true,
    lore: '"제국의 방패는 피로 만들어졌다지. 나는 그 피를 조금 덜 흘리기로 했을 뿐이네." [임시]',
    skill: strike({
      name: '혈검', cd: 6, pow: 'strike', elem: 'phys', mult: 2.2, target: 'lowest', blink: true, params: { lifesteal: 0.4, bleed: 0.3 },
      desc: (p) => `체력 비율이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 물리 피해 + 출혈, 준 피해의 ${pct(p.lifesteal)} 회복${p.resetOnKill ? `. 처치 시 쿨다운 ${pct(p.resetOnKill)} 초기화` : ''}.`,
    }),
    augs: [
      uaug('exile', 'vein', '정맥 절개', '혈검 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('exile', 'thirst', '갈증', '흡혈 +30%p.', setSk((s) => { s.lifesteal += 0.3; })),
      uaug('exile', 'waltz', '피의 왈츠', '혈검으로 처치하면 쿨다운 70% 초기화.', setSk((s) => { s.resetOnKill = 0.7; })),
      uaug('exile', 'title', '버린 작위', '작위 +2.', { title: 2 }),
      uaug('exile', 'dusk', '어스름', '회피 +15%p, 치명타 확률 +15%p.', { stats: { eva: 0.15, crit: 0.15 } }),
    ],
  },
  {
    id: 'thermo', name: '테르모필레', title: '탈주한 호플리테 메카 · 스파르타 전쟁 궤도', factions: ['HEL'], traits: ['VAN'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(12, 6, 4, 10, 2),
    sprite: 'mech', palette: SPARTA, eventOnly: true, noStarter: true,
    lore: '"물러서라"는 명령을 끝까지 지킨 끝에, 궤도에서 가장 멀리 물러나 버린 메카. [임시]',
    skill: support({
      name: '팔랑크스', cd: 8, target: 'aroundSelf', params: { radius: 1, shield: 1.4, red: 0.2, dur: 4 },
      desc: (p) => `주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.shield)} 보호막, ${p.dur}초간 받는 피해 -${pct(p.red)}.`,
    }),
    augs: [
      uaug('thermo', 'wide', '넓은 방진', '범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('thermo', 'bronze', '청동 방패', '보호막 +60%p.', setSk((s) => { s.shield += 0.6; })),
      uaug('thermo', 'hold', '사수', '받는 피해 감소 +10%p, 지속 +2초.', setSk((s) => { s.red += 0.1; s.dur += 2; })),
      uaug('thermo', 'core', '궤도 동력로', '방어력 +8, 생명력 +6.', { majors: { def: 8, vit: 6 } }),
      uaug('thermo', 'last', '최후의 300', '체력 30% 이하일 때 받는 피해 -40%.', { hooks: { takenMult: (b, u) => (b.hpPct(u) <= 0.3 ? 0.6 : 1) } }),
    ],
  },
  {
    id: 'u404', name: 'U-404', title: '규격 외 유닉스 로봇 · 생산 목표 미확인', factions: ['PET'], traits: ['ENG'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(9, 8, 6, 8, 3),
    sprite: 'mech', palette: UNIX, eventOnly: true, noStarter: true,
    lore: '"Root 권한이 없습니다. 다시 시도하십시오." 그래서 다시 시도했다. 계속. [임시]',
    passive: {
      // 1원칙: 직전 대비 더 많이
      hooks: { onSkill(b, u) { u.mem.quarter = (u.mem.quarter || 0) + 1; b.buff(u, u, `u404.q${u.mem.quarter}`, 999, { mods: [inc('all', u.sk.growth || 0.1)], label: '' }); } },
    },
    skill: strike({
      name: '분기 실적 달성', cd: 7, pow: 'strike', elem: 'phys', mult: 1.3, aroundSelf: true, params: { radius: 1, growth: 0.1, stun: 0 },
      desc: (p) => `[1원칙] 기술을 쓸 때마다 피해 +${pct(p.growth)} (전투 동안 중첩). 기술: 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해${p.stun ? ` + ${p.stun}초 기절` : ''}.`,
    }),
    augs: [
      uaug('u404', 'overtime', '초과 생산', '중첩당 피해 +10%p 추가.', setSk((s) => { s.growth += 0.1; })),
      uaug('u404', 'press', '프레스 공정', '기절 1초 추가.', setSk((s) => { s.stun = 1; })),
      uaug('u404', 'line', '생산 라인 확장', '범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('u404', 'catwheel', '버려진 캣휠', '받는 피해 -15%.', { taken: [red('all', 0.15)] }),
      uaug('u404', 'turret', '포탑 자가 생산', '엔지니어 포탑 +1기.', { setup: (u) => { u.mem.turretExtra = (u.mem.turretExtra || 0) + 1; } }),
    ],
  },
  {
    id: 'rus', name: '루스', title: '약탈 함장 바르가의 전 부관', factions: ['PAN'], traits: ['MARK'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(6, 10, 6, 4, 6),
    sprite: 'soldier', palette: RAIDER, eventOnly: true, noStarter: true,
    lore: '"바르가는 배를 잃었고, 나는 배를 챙겼지. 공평하잖아?" [임시]',
    skill: strike({
      name: '약탈 사격', cd: 7, pow: 'shoot', elem: 'phys', mult: 2.4, target: 'farthest', params: { pen: 0.2, hits: 1 },
      desc: (p) => `가장 먼 적에게 사격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)})${p.hits > 1 ? ` ${p.hits}회` : ''}.`,
    }),
    augs: [
      uaug('rus', 'loot', '전리품 우선권', '이 기물이 처치한 적 2명당 전투 후 크레딧 +1.', {}, { after: (run, _u, _w, kills) => { run.credits += Math.floor(kills / 2); } }),
      uaug('rus', 'double', '쌍권총', '약탈 사격 2회 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('rus', 'ap', '철갑탄', '방어도 관통 +30%p.', setSk((s) => { s.pen += 0.3; })),
      uaug('rus', 'ship', '챙겨 나온 배', '전투 시작 시 최대 체력 30% 보호막.', { hooks: { onStart(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.3); } } }),
      uaug('rus', 'aim', '부관의 눈', '사거리 +1, 치명타 확률 +15%p.', { stats: { range: 1, crit: 0.15 } }),
    ],
  },
];
