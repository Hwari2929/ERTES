// 시리우스 성도회 · 범은하 공동체 · 엘베스타드 일가
import { inc, vuln } from '../engine/effects';
import { blinkTo, bleed, cleanse, fear, pct, skillHit, summonsOf } from './kit';
import { cookPower, strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type UnitDef } from './unitkit';

const nat = (n: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + n; } });
const faithWin = { after: (run: { faith: number }, _u: unknown, won: boolean) => { if (won) run.faith += 1; } };
const fameWin = { after: (run: { fame: number }, _u: unknown, won: boolean) => { if (won) run.fame += 1; } };
const extraPet = { setup: (u: { mem: Record<string, number> }) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } };
const bond = (v: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + v; } });
const WOLF = ['#101014', '#7a7a80', '#d8d8d8', '#b0b0b0', '#ffcf40', '#4a4a50', '#ffffff'];
const BEAR = ['#0c0806', '#4a3424', '#8a6a4a', '#c0a080', '#ffcf40', '#2a1a10', '#e0d0c0'];

export const ROSTER_C: UnitDef[] = [
  // ───────── 시리우스 성도회
  {
    id: 'romani', name: '로마니', title: '켈레브림 가문 제3위계장', factions: ['SIR'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(7, 9, 7, 5, 4),
    sprite: 'knight', palette: tint(PAL.SIR, '#3a2a50', '#e8e8f0', '#b07cff'), lore: '"그 정도면 잘했어. 네 수준에서는."',
    skill: {
      name: '집행자 투척', cd: 7, params: { mult: 1.8, stun: 1, hits: 1, splash: 0 },
      desc: (p) => `거대 도끼 집행자를 가장 먼 적에게 던져 타격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''}, 염동력으로 자기 앞까지 끌어당겨 ${p.stun}초 기절${p.splash ? `. 끌려온 자리 주변 1칸에 ${pct(p.splash)} 피해` : ''}.`,
      cast(b, u) {
        const t = b.farthest(u);
        if (!t) return false;
        const p = u.sk;
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
        for (let i = 0; i < p.hits && t.alive; i++) skillHit(b, u, t, 'strike', p.mult * (i ? 0.6 : 1), 'phys');
        if (!t.alive) return true;
        if (b.dist(u, t) > 1 && !t.immobile && !t.isBoss) { blinkTo(b, t, u); t.target = u; }
        b.stun(u, t, p.stun);
        if (p.splash) for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) skillHit(b, u, e, 'strike', p.splash, 'phys', { noMiss: true });
        return true;
      },
    },
    augs: [
      uaug('romani', 'split', '양손 도끼 분리', '집행자 투척 2회 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('romani', 'recall', '재가속', '투척 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('romani', 'shove', '염동 밀쳐내기', '끌려온 자리 주변 1칸 적에게 타격 위력 80% 피해.', setSk((s) => { s.splash = 0.8; })),
      uaug('romani', 'counsel', '16년의 개종 상담', '효과 명중 +30%p, 기절 +0.5초.', { stats: { effHit: 0.3 }, setup: (u) => { u.sk.stun += 0.5; } }),
      uaug('romani', 'uniform', '정복 관리 강박', '방어력 +4, 효과 저항 +20%p.', { majors: { def: 4 }, stats: { effRes: 0.2 } }),
    ],
  },
  {
    id: 'joshua', name: '조슈아', title: '최초의 계약자 · 상담관 (체사레)', factions: ['SIR'], traits: ['MED', 'CLERIC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.1 }, range: 3, base: B(8, 7, 7, 5, 4),
    sprite: 'robe', palette: tint(PAL.SIR, '#2a5a4a', '#e8e2c8', '#40c0a0'), lore: '"항상 몸 조심해요"',
    passive: {
      hooks: {
        onHurt(b, u) {
          if (u.mem.cesare || b.hpPct(u) > u.sk.threshold) return;
          // 체사레 강제 전환: 양손 도끼 순례자를 들고 전방으로
          u.mem.cesare = 1;
          u.st.range = 1;
          u.atk = { type: 'strike', elem: 'phys', interval: 0.8 };
          u.target = b.nearest(u, b.enemiesOf(u));
          b.buff(u, u, 'joshua.cesare', 999, { mods: [inc('all', u.sk.rage)], label: '체사레' });
          b.fx(u.x, u.y, 1, 'psy');
          for (const e of b.around(u, 1, b.enemiesOf(u))) fear(b, u, e, 1.5, u.sk.fearChance);
        },
        onTick(b, u, dt) {
          if (!u.mem.cesare) return;
          u.mem.regenT = (u.mem.regenT || 0) + dt;
          if (u.mem.regenT >= 1) { u.mem.regenT = 0; b.heal(u, u, b.S(u, 'maxHp') * u.sk.regen, true); }
        },
      },
    },
    skill: {
      name: '재생 촉진', cd: 8, params: { heal: 0.7, cleanse: 0, threshold: 0.4, rage: 0.4, regen: 0.03, fearChance: 0.6 },
      desc: (p) => `모든 아군의 자연 치유를 가속해 기술 위력 ${pct(p.heal)} 회복${p.cleanse ? ' + 해로운 상태이상 제거' : ''}. 체력이 처음 ${pct(p.threshold)} 이하가 되면 체사레로 전환: 근접 도끼 공격, 피해 +${pct(p.rage)}, 초당 최대 체력 ${pct(p.regen)} 재생, 주변 적 ${pct(p.fearChance)} 확률 공포. 체사레의 재생 촉진은 자신에게만 2배로 쓰인다.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        if (u.mem.cesare) {
          b.heal(u, u, b.S(u, 'tech') * p.heal * 2, true);
          b.fx(u.x, u.y, 1, 'psy');
          for (const e of b.around(u, 1, b.enemiesOf(u))) fear(b, u, e, 1.5, p.fearChance);
          return true;
        }
        const allies = b.alliesOf(u);
        if (allies.every((a) => b.hpPct(a) > 0.95) && !p.cleanse) return false;
        b.fx(u.x, u.y, 0, 'holy');
        for (const a of allies) { b.heal(u, a, b.S(u, 'tech') * p.heal); if (p.cleanse) cleanse(a); }
        return true;
      },
    },
    augs: [
      uaug('joshua', 'regen', '회복 속도의 극대화', '재생 촉진 회복량 +30%p.', setSk((s) => { s.heal += 0.3; })),
      uaug('joshua', 'calm', '정신 안정', '재생 촉진이 해로운 상태이상도 제거한다.', setSk((s) => { s.cleanse = 1; })),
      uaug('joshua', 'pilgrim', '순례자', '체사레의 피해 증가 +30%p.', setSk((s) => { s.rage += 0.3; })),
      uaug('joshua', 'tips', '붉어지는 머리끝', '체력 60% 이하에서 체사레로 전환.', setSk((s) => { s.threshold = 0.6; })),
      uaug('joshua', 'wave', '공포의 파동', '체사레 공포 확률 +30%p, 재생 +2%p.', setSk((s) => { s.fearChance += 0.3; s.regen += 0.02; })),
    ],
  },
  {
    id: 'sarma', name: '사르마', title: '미래 은하에서 온 시간 여행자 · 차원 연구자', factions: ['SIR'], traits: ['TIME', 'MARK'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.2 }, range: 4, base: B(6, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.SIR, '#6a5aa0', '#e8e2c8', '#c0b0ff'), lore: '"아, 실례했군요. 죄송해요. 제가 이번 은하는 처음이라."',
    skill: strike({
      name: '포켓 블랙홀', cd: 7, pow: 'shoot', elem: 'phys', mult: 2.0, params: { radius: 1, slow: 0.4 },
      desc: (p) => `융합포로 대상 지점에 소형 블랙홀을 열어 주변 ${p.radius}칸 적에게 사격 위력 ${pct(p.mult)} 물리 피해 + 둔화${p.stun ? ` + ${p.stun}초 기절` : ''}.`,
    }),
    augs: [
      uaug('sarma', 'singularity', '특이점 확장', '블랙홀 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('sarma', 'fusion', '융합 출력 증폭', '블랙홀 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('sarma', 'horizon', '사건의 지평선', '블랙홀에 맞은 적 0.8초 기절.', setSk((s) => { s.stun = 0.8; })),
      uaug('sarma', 'thesis', '차원 이론 논문', '방어도 관통 40%.', setSk((s) => { s.pen = 0.4; })),
      uaug('sarma', 'sorry', '이번 은하는 처음이라', '회피 +15%p, 효과 저항 +20%p.', { stats: { eva: 0.15, effRes: 0.2 } }),
    ],
  },
  {
    id: 'kyle', name: '카일', title: '성도회 성전 기사', factions: ['SIR'], traits: ['VAN', 'INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 1.1 }, range: 1, base: B(9, 7, 5, 8, 3),
    sprite: 'knight', palette: PAL.SIR, lore: '적진 한가운데가 그의 제단이다.',
    skill: strike({
      name: '성전 돌입', cd: 8, pow: 'strike', elem: 'holy', mult: 1.6, target: 'backline', blink: true, params: { radius: 1, selfShield: 0.25 },
      desc: (p) => `적 후방으로 돌입해 주변 ${p.radius}칸에 타격 위력 ${pct(p.mult)} 신성 피해, 최대 체력 ${pct(p.selfShield)} 보호막.`,
    }),
    augs: [
      uaug('kyle', 'bulwark', '성벽', '보호막 +20%p.', setSk((s) => { s.selfShield += 0.2; })),
      uaug('kyle', 'smite', '징벌', '돌입에 맞은 적 0.8초 기절.', setSk((s) => { s.stun = 0.8; })),
      uaug('kyle', 'crusade', '대성전', '돌입 피해 +40%p.', setSk((s) => { s.mult += 0.4; })),
      uaug('kyle', 'tithe', '피의 십일조', '돌입 피해의 30%만큼 회복.', setSk((s) => { s.lifesteal = 0.3; })),
      uaug('kyle', 'oath', '기사 서약', '방어력 +4, 효과 저항 +20%p.', { majors: { def: 4 }, stats: { effRes: 0.2 } }),
    ],
  },
  {
    id: 'doros', name: '도로스', title: '성도회 수도원 요리사', factions: ['SIR'], traits: ['CLERIC', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.0 }, range: 3, base: B(8, 5, 8, 6, 3),
    sprite: 'robe', palette: tint(PAL.SIR, '#c8a070', '#ffffff', '#ffd866'), lore: '빵을 굽는 동안 기도하고, 기도하는 동안 빵을 굽는다.',
    skill: support({
      name: '성찬', cd: 4.5, target: 'lowest', power: cookPower, params: { heal: 1.8, cleanse: 1, dmg: 0.3, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복, 해로운 상태이상 제거, ${p.dur}초간 피해 +${pct(p.dmg)}.`,
    }),
    augs: [
      uaug('doros', 'loaf', '큰 빵', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('doros', 'wine', '성배', '피해 증가 +15%p.', setSk((s) => { s.dmg += 0.15; })),
      uaug('doros', 'share', '나눔', '요리받은 아군 주변 1칸에도 50% 효과.', setSk((s) => { s.splash = 1; })),
      uaug('doros', 'crust', '단단한 껍질', '기술 위력 50% 보호막도 준다.', setSk((s) => { s.shield = 0.5; })),
      uaug('doros', 'grace', '식전 기도', '전투 승리 시 신앙 +1.', {}, faithWin),
    ],
  },
  {
    id: 'demiurgos', name: '데미우르고스', title: '당신의 친구, R', factions: ['SIR'], traits: ['RFRIEND', 'MED'], keywords: ['bio', 'phantom'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.0 }, range: 3, base: B(7, 7, 7, 6, 5),
    sprite: 'phantom', palette: tint(PAL.SIR, '#f0f0f8', '#ff7aa8', '#ff7aa8'), lore: '처음 만났는데 오래 알던 사이 같다고? 응, 맞아.',
    skill: support({
      name: '친구의 손길', cd: 7, target: 'lowest', params: { heal: 2.0, red: 0.2, dur: 3 },
      desc: (p) => `체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 받는 피해 -${pct(p.red)}${p.radius ? ` (주변 ${p.radius}칸 포함)` : ''}.`,
    }),
    augs: [
      uaug('demiurgos', 'warm', '따뜻한 손', '회복량 +50%p.', setSk((s) => { s.heal += 0.5; })),
      uaug('demiurgos', 'here', '곁에 있을게', '피해 감소 +10%p, 지속 +2초.', setSk((s) => { s.red += 0.1; s.dur += 2; })),
      uaug('demiurgos', 'together', '다 같이', '친구의 손길이 대상 주변 1칸에도 닿는다.', setSk((s) => { s.radius = 1; })),
      uaug('demiurgos', 'gift', '선물', '모든 메이저 +2.', { majors: { vit: 2, pow: 2, mnd: 2, def: 2, agi: 2 } }),
      uaug('demiurgos', 'listen', '들어 줄게', '친구의 손길 쿨다운 -1.5초.', setSk((_s, u) => { u.cdMax -= 1.5; })),
    ],
  },
  // ───────── 범은하 공동체
  {
    id: 'aiden', name: '에이든', title: '구인류 안드로이드 · 에란테스 바텐더', factions: ['PAN'], traits: ['TIME', 'NAV'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 0.85 }, range: 1, base: B(6, 8, 7, 5, 7),
    sprite: 'soldier', palette: tint(PAL.PAN, '#c8ccd8', '#1a1a22', '#7fe3ff'), lore: '"반갑습니다. 오늘도 - 늘 먹던 것으로 드리나요?"',
    ace: {
      name: '기체 조종', desc: (k) => `회피 +${Math.round(15 * k)}%p, 회피할 때마다 공격자에게 타격 위력 ${Math.round(80 * k)}% 반격.`,
      effect: (k) => ({
        stats: { eva: 0.15 * k },
        hooks: { onEvade(b, u, src) { if (src.alive) b.dealDamage(u, src, b.S(u, 'strike') * 0.8 * k, { elem: 'phys', tag: 'proc' }); } },
      }),
    },
    skill: strike({
      name: '액체 금속 변형', cd: 6, pow: 'strike', elem: 'phys', mult: 2.2, target: 'lowest', blink: true, params: { fear: 0.8, fearChance: 0.4 },
      desc: (p) => `고양이로 변해 체력 비율이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''}. 환술로 ${pct(p.fearChance)} 확률 ${p.fear}초 공포.`,
    }),
    augs: [
      uaug('aiden', 'claw', '고양이 발톱', '변형 공격 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('aiden', 'mirage', '환영 분신', '변형 공격이 2회 공격 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('aiden', 'butcher', '도륙 프로토콜', '처치하면 쿨다운 60% 회복.', setSk((s) => { s.resetOnKill = 0.6; })),
      uaug('aiden', 'illusion', '인지 교란', '공포 확률 +40%p.', setSk((s) => { s.fearChance += 0.4; })),
      uaug('aiden', 'groom', '그루밍', '회피 +15%p.', { stats: { eva: 0.15 } }),
    ],
  },
  {
    id: 'vivian', name: '비비안', title: '생태계 분석관 · 군체 연구원', factions: ['PAN'], traits: ['BUDDY', 'NATURE'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(6, 7, 8, 5, 5),
    sprite: 'medic', palette: tint(PAL.PAN, '#f0d040', '#1a1a22', '#ff8080'),
    summon: { name: '리키', sprite: 'beast', palette: WOLF, atk: { type: 'strike', elem: 'phys', interval: 0.8 }, range: 1, hpMul: 1.1 },
    lore: '"흠흠- 만나서 반가워! 나는 정찰과 은하 생태학을 담당하는 비비안이야."',
    skill: {
      name: '동물 교감', cd: 7, params: { mult: 2.3, stun: 1, kazoo: 0, vuln: 0 },
      desc: (p) => `리키에게 공격 지시를 내린다. 리키가 비비안의 대상에게 덮쳐 리키 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절. 리키가 없으면 비비안이 직접 사격 위력 150%로 쏜다.`,
      cast(b, u) {
        const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
        if (!t) return false;
        const p = u.sk;
        const pets = summonsOf(b, u);
        if (!pets.length) { b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true }); skillHit(b, u, t, 'shoot', 1.5, 'phys'); }
        for (const pet of pets) {
          if (b.dist(pet, t) > 1) blinkTo(b, pet, t);
          pet.target = t;
          skillHit(b, pet, t, 'strike', p.mult, 'phys');
        }
        if (t.alive) {
          b.stun(u, t, p.stun);
          if (p.vuln) b.applyStatus(u, t, { type: 'buff', key: 'vivian.record', dur: 4, taken: [vuln('all', p.vuln)], label: '관찰 기록' });
        }
        if (p.kazoo) for (const a of b.alliesOf(u)) b.buff(u, a, 'vivian.kazoo', 3, { delta: { atkSpd: p.kazoo }, label: '카주' });
        return true;
      },
    },
    augs: [
      uaug('vivian', 'trust', '깊은 신뢰', '리키 스탯 상속률 +30%p.', bond(0.3)),
      uaug('vivian', 'pack', '야생 동료 호출', '동물 동료를 하나 더 부른다 (상속률 60%).', extraPet),
      uaug('vivian', 'kazoo', '카주 연주', '교감할 때 모든 아군 공격 속도 3초간 +20%.', setSk((s) => { s.kazoo = 0.2; })),
      uaug('vivian', 'record', '생태 기록 강박', '교감 대상은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('vivian', 'kit', '생존 키트와 신호기', '캠핑 러버 임시 장비 +1개, 기동력 +3.', { ...nat(1), majors: { agi: 3 } }),
    ],
  },
  {
    id: 'yupito', name: '유피토', title: '"강철의 마녀" 특수공학자', factions: ['PAN'], traits: ['SPEC', 'ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.0 }, range: 3, base: B(6, 7, 9, 5, 3),
    sprite: 'medic', palette: tint(PAL.PAN, '#2a3a6a', '#40e0c0', '#40e0c0'), lore: '"공학자는 언제나 상상력과 비장의 한 수가 있는 법이지"',
    skill: support({
      name: '임시 에너지 장벽', cd: 7, target: 'lowest', params: { radius: 1, shield: 1.0, turretShield: 1.0 },
      desc: (p) => `체력 비율이 가장 낮은 아군과 주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.shield)} 보호막. 모든 포탑에도 ${pct(p.turretShield)} 보호막.`,
      after: (b, u, _ts, p) => { for (const t of b.alliesOf(u)) if (t.defId === 'turret') b.shield(t, b.S(u, 'tech') * p.turretShield); },
    }),
    augs: [
      uaug('yupito', 'hull', '폐선 외벽', '보호막 +50%p.', setSk((s) => { s.shield += 0.5; })),
      uaug('yupito', 'choke', '진입로 봉쇄', '범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('yupito', 'spider', '거미집 포탑', '엔지니어 포탑 체력·방어도 +60%.', { setup: (u) => { u.mem.turretHp = (u.mem.turretHp || 0) + 0.6; } }),
      uaug('yupito', 'kongi', '콩이에서 꺼낸 포탑', '엔지니어 포탑 +1기.', { setup: (u) => { u.mem.turretExtra = (u.mem.turretExtra || 0) + 1; } }),
      uaug('yupito', 'trump', '비장의 한 수', '장벽 대상 4초간 방어도 +250.', setSk((s) => { s.armor = 250; })),
    ],
  },
  {
    id: 'ingel', name: '잉겔', title: '엘베스타드가 장녀 · 은하 셀럽', factions: ['PAN', 'FAM'], traits: ['STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.0 }, range: 3, base: B(6, 8, 8, 4, 5),
    sprite: 'medic', palette: tint(PAL.FAM, '#e8e8f0', '#ff9de2', '#ff9de2'), lore: '가문을 나와 공동체에 들어갔다. 팔로워는 둘 다 따라왔다.',
    skill: strike({
      name: '플래시 세례', cd: 7, pow: 'tech', elem: 'psy', mult: 1.7, params: { radius: 2, fear: 1, fearChance: 0.3, noMiss: 1 },
      desc: (p) => `대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 정신 피해, ${pct(p.fearChance)} 확률로 ${p.fear}초 공포.`,
    }),
    augs: [
      uaug('ingel', 'crowd', '인파', '플래시 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('ingel', 'scandal', '스캔들', '공포 확률 +30%p.', setSk((s) => { s.fearChance += 0.3; })),
      uaug('ingel', 'viral', '바이럴', '플래시 피해 +40%p.', setSk((s) => { s.mult += 0.4; })),
      uaug('ingel', 'live', '라이브 방송', '전투 승리 시 명성 +1.', {}, fameWin),
      uaug('ingel', 'expose', '폭로', '맞은 적 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
    ],
  },
  // ───────── 엘베스타드 일가
  {
    id: 'amundsen', name: '아문센', title: '에란테스 단장 · 전 연합군 에이스', factions: ['FAM'], traits: ['EXPLORER', 'NAV'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(8, 10, 9, 6, 6),
    sprite: 'soldier', palette: tint(PAL.FAM, '#1a1a22', '#d4a83a', '#e0b040'), item: 'U_shade', noStarter: true,
    lore: '"은하는 넓고 - 인지는 비좁아. 모든 신비가 이 괴리에서 온다네."',
    ace: {
      name: '콜사인 Ace', desc: (k) => `전투 시작 시 모든 아군 쿨다운 감소 속도 +${Math.round(15 * k)}%.`,
      effect: (k) => ({ hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'ace.amundsen', 999, { delta: { cdr: 0.15 * k }, label: 'Ace' }); } } }),
    },
    skill: strike({
      name: '에란테-7703 화력 지원', cd: 8, pow: 'shoot', elem: 'phys', mult: 2.8, target: 'farthest', params: { pen: 0.3, slow: 0.3 },
      desc: (p) => `30년을 함께한 개조 기체가 가장 먼 적을 사격 위력 ${pct(p.mult)} 물리 피해로 포격 (방어도 관통 ${pct(p.pen)}) + 둔화${p.hits > 1 ? `, ${p.hits}회` : ''}${p.radius ? `, 주변 ${p.radius}칸` : ''}.`,
    }),
    augs: [
      uaug('amundsen', 'wander', '30년의 유랑', '화력 지원 피해 +80%p.', setSk((s) => { s.mult += 0.8; })),
      uaug('amundsen', 'refit', '수십 번의 개조', '방어도 관통 +30%p.', setSk((s) => { s.pen += 0.3; })),
      uaug('amundsen', 'twin', '2연사', '화력 지원 2회 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('amundsen', 'carpet', '융단 사격', '화력 지원이 대상 주변 1칸에도 피해.', setSk((s) => { s.radius = 1; })),
      uaug('amundsen', 'travelogue', '엘베스타드 유람기', '모든 메이저 +3.', { majors: { vit: 3, pow: 3, mnd: 3, def: 3, agi: 3 } }),
    ],
  },
  {
    id: 'rachel', name: '레이첼', title: '엘베스타드가 근위 기사', factions: ['FAM'], traits: ['TIME', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(10, 7, 5, 8, 3),
    sprite: 'knight', palette: PAL.FAM, lore: '가문을 지키는 데 필요한 시간은 언제나 충분하다. 그녀가 멈춰 두니까.',
    skill: strike({
      name: '시간 정지 베기', cd: 7, pow: 'strike', elem: 'phys', mult: 2.0, params: { stun: 1.5 },
      desc: (p) => `대상에게 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절${p.radius ? ` (주변 ${p.radius}칸)` : ''}.`,
    }),
    augs: [
      uaug('rachel', 'still', '완전 정지', '기절 +0.5초.', setSk((s) => { s.stun += 0.5; })),
      uaug('rachel', 'arc', '시간의 호', '베기가 대상 주변 1칸에도 닿는다.', setSk((s) => { s.radius = 1; })),
      uaug('rachel', 'guard', '근위 서약', '베기 후 최대 체력 25% 보호막.', setSk((s) => { s.selfShield = 0.25; })),
      uaug('rachel', 'edge', '날 선 순간', '베기 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('rachel', 'drain', '시간 흡수', '베기 피해의 25%만큼 회복.', setSk((s) => { s.lifesteal = 0.25; })),
    ],
  },
  {
    id: 'rasmus', name: '라스무스', title: '엘베스타드가 사냥터지기 · 곰 비요른', factions: ['FAM'], traits: ['NATURE', 'BUDDY'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, base: B(9, 7, 5, 7, 3),
    sprite: 'knight', palette: tint(PAL.FAM, '#4a5a3a', '#c8ccd8', '#ffcf40'),
    summon: { name: '비요른', sprite: 'beast', palette: BEAR, atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, hpMul: 1.6 },
    lore: '가문의 사냥터를 40년 지켰다. 비요른은 그중 39년을 함께했다.',
    skill: {
      name: '사냥', cd: 7, params: { mult: 2.5, bleed: 0.3, roar: 0 },
      desc: (p) => `비요른이 라스무스의 대상에게 덮쳐 비요른 타격 위력 ${pct(p.mult)} 물리 피해 + 출혈. 곰이 없으면 라스무스가 직접 150%.`,
      cast(b, u) {
        const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
        if (!t) return false;
        const p = u.sk;
        const bears = summonsOf(b, u);
        if (!bears.length) { if (b.dist(u, t) > 1) return false; skillHit(b, u, t, 'strike', 1.5, 'phys'); return true; }
        for (const bear of bears) {
          if (b.dist(bear, t) > 1) blinkTo(b, bear, t);
          bear.target = t;
          skillHit(b, bear, t, 'strike', p.mult, 'phys');
          if (t.alive) bleed(b, bear, t, b.S(bear, 'strike') * p.bleed, 4);
          if (p.roar) { b.fx(bear.x, bear.y, 1, 'psy'); for (const e of b.around(bear, 1, b.enemiesOf(u))) fear(b, u, e, 1.2, 0.5); }
        }
        return true;
      },
    },
    augs: [
      uaug('rasmus', 'old', '오랜 짝', '비요른 스탯 상속률 +30%p.', bond(0.3)),
      uaug('rasmus', 'maul', '할퀴기', '출혈 피해 +30%p.', setSk((s) => { s.bleed += 0.3; })),
      uaug('rasmus', 'cub', '새끼 곰', '곰을 하나 더 데려온다 (상속률 60%).', extraPet),
      uaug('rasmus', 'lodge', '사냥 오두막', '캠핑 러버 임시 장비 +1개, 생명력 +3.', { ...nat(1), majors: { vit: 3 } }),
      uaug('rasmus', 'roar', '포효', '사냥 때 비요른 주변 적 50% 확률로 1.2초 공포.', setSk((s) => { s.roar = 1; })),
    ],
  },
  {
    id: 'sigmund', name: '시그문드', title: '엘베스타드 가주', factions: ['FAM'], traits: ['STAFF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.2 }, range: 3, base: B(7, 7, 9, 6, 3),
    sprite: 'robe', palette: tint(PAL.FAM, '#1a1c2a', '#c8ccd8', '#ffd34d'), lore: '가문의 이름 앞에서 고개를 들 수 있는 자는 없다. 그의 자식들만 빼고.',
    skill: support({
      name: '가주의 명령', cd: 8, target: 'commanded', params: { count: 1, dmg: 0.35, as: 0.15, dur: 6, famShield: 0.5 },
      desc: (p) => `가장 강한 아군 ${p.count}명에게 ${p.dur}초간 피해 +${pct(p.dmg)}, 공격 속도 +${pct(p.as)}. 엘베스타드 일가 아군 전원에게 기술 위력 ${pct(p.famShield)} 보호막.`,
      after: (b, u, _ts, p) => { for (const a of b.alliesOf(u)) if (a.synergies.has('FAM')) b.shield(a, b.S(u, 'tech') * p.famShield); },
    }),
    augs: [
      uaug('sigmund', 'council', '가문 회의', '명령 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('sigmund', 'iron', '철의 가주', '피해 증가 +20%p.', setSk((s) => { s.dmg += 0.2; })),
      uaug('sigmund', 'crest', '가문의 문장', '일가 보호막 +50%p.', setSk((s) => { s.famShield += 0.5; })),
      uaug('sigmund', 'reign', '긴 통치', '명령 지속 +3초.', setSk((s) => { s.dur += 3; })),
      uaug('sigmund', 'shelter', '가문의 그늘', '명령 대상 받는 피해 -15%.', setSk((s) => { s.red = 0.15; })),
    ],
  },
  {
    id: 'gunnir', name: '구니르', title: '엘베스타드가 집사장', factions: ['FAM'], traits: ['MED', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(8, 5, 8, 7, 3),
    sprite: 'robe', palette: tint(PAL.FAM, '#1a1a1a', '#ffffff', '#c8ccd8'), lore: '3대째 같은 스튜를 끓인다. 레시피는 가주도 모른다.',
    skill: support({
      name: '가문의 스튜', cd: 4.5, target: 'lowest', power: cookPower, params: { shield: 1.8, heal: 0.6, armor: 200, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군에게 기술 위력 ${pct(p.shield)} 보호막 + ${pct(p.heal)} 회복, ${p.dur}초간 방어도 +${p.armor}.`,
    }),
    augs: [
      uaug('gunnir', 'broth', '진한 육수', '보호막 +50%p.', setSk((s) => { s.shield += 0.5; })),
      uaug('gunnir', 'bone', '사골', '방어도 증가 +200.', setSk((s) => { s.armor += 200; })),
      uaug('gunnir', 'pot', '큰 솥', '요리받은 아군 주변 1칸에도 50% 효과.', setSk((s) => { s.splash = 1; })),
      uaug('gunnir', 'herb', '약초', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('gunnir', 'butler', '완벽한 집사', '요리 쿨다운 -1초.', setSk((_s, u) => { u.cdMax -= 1; })),
    ],
  },
];
export { inc };
