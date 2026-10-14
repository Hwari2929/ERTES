// 시리우스 성도회 · 범은하 공동체 · 엘베스타드 일가
import { inc, vuln } from '../engine/effects';
import { blinkTo, bleed, cleanse, fear, pct, skillHit, summonsOf } from './kit';
import { cookPower, strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type BaseUnit } from './unitkit';

const faithWin = { after: (run: { power: number }, _u: unknown, won: boolean) => { if (won) run.power += 1; } };
const fameWin = { after: (run: { fame: number }, _u: unknown, won: boolean) => { if (won) run.fame += 2; } };
const extraPet = { setup: (u: { mem: Record<string, number> }) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } };
const bond = (v: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + v; } });
const WOLF = ['#101014', '#7a7a80', '#d8d8d8', '#b0b0b0', '#ffcf40', '#4a4a50', '#ffffff'];
const BEAR = ['#0c0806', '#4a3424', '#8a6a4a', '#c0a080', '#ffcf40', '#2a1a10', '#e0d0c0'];

export const ROSTER_C: BaseUnit[] = [
  // ───────── 시리우스 성도회
  {
    id: 'romani', name: '로마니', title: '켈레브림 가문 제3위계장', factions: ['SIR'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(7, 9, 7, 5, 4),
    sprite: 'knight', palette: tint(PAL.SIR, '#3a2a50', '#e8e8f0', '#b07cff'), lore: '"그 정도면 잘했어. 네 수준에서는."',
    skill: {
      name: '집행자 투척', tag: () => '먼 적 끌어오기 + 기절', cd: 7, params: { mult: 1.8, stun: 1, hits: 1, splash: 0 },
      desc: (p) => `거대 도끼 집행자를 가장 먼 적에게 던져 타격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''}, 염동력으로 자기 앞까지 끌어당겨 ${p.stun}초 기절${p.splash ? `. 끌려온 자리 주변 1칸에 ${pct(p.splash)} 피해` : ''}.`,
      cast(b, u) {
        const t = b.farthest(u);
        if (!t) return false;
        const p = u.sk;
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
        for (let i = 0; i < p.hits && t.alive; i++) skillHit(b, u, t, 'strike', p.mult * (i ? p.second || 0.6 : 1), 'phys');
        if (!t.alive) return true;
        if (b.dist(u, t) > 1 && !t.immobile && !t.isBoss) { blinkTo(b, t, u); t.target = u; }
        b.stun(u, t, p.stun);
        if (p.splash) for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) skillHit(b, u, e, 'strike', p.splash, 'phys', { noMiss: true });
        return true;
      },
    },
  },
  {
    id: 'joshua', name: '조슈아', title: '최초의 계약자 · 상담관 (체사레)', factions: ['SIR'], traits: ['MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.1 }, range: 3, base: B(8, 7, 7, 5, 4),
    sprite: 'robe', palette: tint(PAL.SIR, '#2a5a4a', '#e8e2c8', '#40c0a0'), lore: '"항상 몸 조심해요"',
    passive: {
      hooks: {
        onTick(b, u, dt) {
          if (!u.mem.cesare && u.reason !== null && u.reason <= u.sk.threshold) {
          // 체사레 강제 전환: 양손 도끼 순례자를 들고 전방으로
          u.mem.cesare = 1;
          u.st.range = 1;
          u.atk = { type: 'strike', elem: 'phys', interval: 0.8 };
          u.target = b.nearest(u, b.enemiesOf(u));
          b.buff(u, u, 'joshua.cesare', 999, { mods: [inc('all', u.sk.rage)], label: '체사레' });
          b.fx(u.x, u.y, 1, 'psy');
          for (const e of b.around(u, 1, b.enemiesOf(u))) fear(b, u, e, 1.5, u.sk.fearChance);
          }
          if (!u.mem.cesare) return;
          u.mem.regenT = (u.mem.regenT || 0) + dt;
          if (u.mem.regenT >= 1) { u.mem.regenT = 0; b.heal(u, u, b.S(u, 'maxHp') * u.sk.regen, true); }
        },
      },
    },
    skill: {
      name: '재생 촉진', tag: () => '아군 전체 회복', cd: 8, params: { heal: 0.7, cleanse: 0, threshold: -50, rage: 0.4, regen: 0.015, fearChance: 0.6 },
      desc: (p) => `모든 아군의 자연 치유를 가속해 기술 위력 ${pct(p.heal)} 회복${p.cleanse ? ' + 해로운 상태이상 제거' : ''}. 이성이 ${p.threshold} 이하가 되면 체사레로 전환: 근접 도끼 공격, 피해 +${pct(p.rage)}, 초당 최대 체력 ${pct(p.regen)} 재생, 주변 적 ${pct(p.fearChance)} 확률 공포. 체사레의 재생 촉진은 자신에게만 2배로 쓰인다.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        if (u.mem.cesare) {
          b.heal(u, u, b.P(u, 'tech') * p.heal * 2, true);
          b.fx(u.x, u.y, 1, 'psy');
          for (const e of b.around(u, 1, b.enemiesOf(u))) fear(b, u, e, 1.5, p.fearChance);
          return true;
        }
        const allies = b.alliesOf(u);
        if (allies.every((a) => b.hpPct(a) > 0.95) && !p.cleanse) return false;
        b.fx(u.x, u.y, 0, 'holy');
        for (const a of allies) { b.heal(u, a, b.P(u, 'tech') * p.heal); if (p.cleanse) cleanse(a); }
        return true;
      },
    },
  },
  {
    id: 'sarma', name: '사르마', title: '미래 은하에서 온 시간 여행자 · 차원 연구자', factions: ['SIR'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.2 }, range: 4, base: B(6, 10, 8, 3, 5),
    sprite: 'soldier', palette: tint(PAL.SIR, '#6a5aa0', '#e8e2c8', '#c0b0ff'), lore: '"아, 실례했군요. 죄송해요. 제가 이번 은하는 처음이라."',
    skill: strike({
      name: '포켓 블랙홀', cd: 7, pow: 'shoot', elem: 'phys', mult: 2.0, params: { radius: 1, slow: 0.4 },
      desc: (p) => `융합포로 대상 지점에 소형 블랙홀을 열어 주변 ${p.radius}칸 적에게 사격 위력 ${pct(p.mult)} 물리 피해 + 둔화${p.stun ? ` + ${p.stun}초 기절` : ''}${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}${p.pen ? ` (방어도 관통 ${pct(p.pen)})` : ''}.`,
    }),
  },
  {
    id: 'kyle', name: '카일', title: '성도회 성전 기사', factions: ['SIR'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 1.1 }, range: 1, base: B(9, 7, 5, 8, 3),
    sprite: 'knight', palette: PAL.SIR, lore: '적진 한가운데가 그의 제단이다.',
    skill: strike({
      name: '성전 돌입', cd: 8, pow: 'strike', elem: 'holy', mult: 1.6, target: 'backline', blink: true, params: { radius: 1, selfShield: 0.25 },
      desc: (p) => `적 후방으로 돌입해 주변 ${p.radius}칸에 타격 위력 ${pct(p.mult)} 신성 피해${p.stun ? ` + ${p.stun}초 기절` : ''}, 최대 체력 ${pct(p.selfShield)} 보호막${p.lifesteal ? `, 피해의 ${pct(p.lifesteal)} 회복` : ''}.`,
    }),
  },
  {
    id: 'doros', name: '도로스', title: '성도회 수도원 요리사', factions: ['SIR'], traits: ['CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.0 }, range: 3, base: B(8, 5, 8, 6, 3),
    sprite: 'robe', palette: tint(PAL.SIR, '#c8a070', '#ffffff', '#ffd866'), lore: '빵을 굽는 동안 기도하고, 기도하는 동안 빵을 굽는다.',
    skill: support({
      name: '성찬', cd: 4.5, target: 'lowest', power: cookPower, params: { heal: 1.8, cleanse: 1, dmg: 0.3, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복, 해로운 상태이상 제거, ${p.dur}초간 피해 +${pct(p.dmg)}${p.shield ? `, ${pct(p.shield)} 보호막` : ''}${p.splash ? '. 주변 1칸 아군에게 50% 효과' : ''}.`,
    }),
  },
  {
    id: 'demiurgos', name: '데미우르고스', title: '당신의 친구, R', factions: ['SIR'], traits: ['RFRIEND', 'MED'], keywords: ['bio', 'phantom'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.0 }, range: 3, base: B(7, 7, 7, 6, 5),
    sprite: 'phantom', palette: tint(PAL.SIR, '#f0f0f8', '#ff7aa8', '#ff7aa8'), noStarter: true, lore: '처음 만났는데 오래 알던 사이 같다고? 응, 맞아.',
    skill: support({
      name: '친구의 손길', cd: 7, target: 'lowest', params: { heal: 2.0, red: 0.2, dur: 3 },
      desc: (p) => `체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 받는 피해 -${pct(p.red)}${p.radius ? ` (주변 ${p.radius}칸 포함)` : ''}.`,
    }),
  },
  // ───────── 범은하 공동체
  {
    id: 'aiden', name: '에이든', title: '구인류 안드로이드 · 에란테스 바텐더', factions: ['PAN'], traits: ['NAV'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 0.85 }, range: 1, base: B(6, 8, 7, 5, 7),
    sprite: 'soldier', palette: tint(PAL.PAN, '#c8ccd8', '#1a1a22', '#7fe3ff'), lore: '"반갑습니다. 오늘도 - 늘 먹던 것으로 드리나요?"',
    ace: {
      name: '기체 조종', desc: (k) => `회피 +${Math.round(7.5 * k)}%p, 회피할 때마다 공격자에게 타격 위력 ${Math.round(80 * k)}% 반격.`,
      effect: (k) => ({
        stats: { eva: 0.075 * k },
        hooks: { onEvade(b, u, src) { if (src.alive) b.dealDamage(u, src, b.S(u, 'strike') * 0.8 * k, { elem: 'phys', tag: 'proc' }); } },
      }),
    },
    skill: strike({
      name: '액체 금속 변형', cd: 6, pow: 'strike', elem: 'phys', mult: 2.2, target: 'lowest', blink: true, params: { fear: 0.8, fearChance: 0.4 },
      desc: (p) => `고양이로 변해 체력 비율이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''}. 환술로 ${pct(p.fearChance)} 확률 ${p.fear}초 공포${p.resetOnKill ? `. 처치 시 쿨다운 ${pct(p.resetOnKill)} 초기화` : ''}.`,
    }),
  },
  {
    id: 'vivian', name: '비비안', title: '생태계 분석관 · 군체 연구원', factions: ['PAN'], traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(6, 7, 8, 5, 5),
    sprite: 'medic', palette: tint(PAL.PAN, '#f0d040', '#1a1a22', '#ff8080'),
    summon: { name: '리키', art: 'sm_ricky', sprite: 'beast', palette: WOLF, atk: { type: 'strike', elem: 'phys', interval: 0.8 }, range: 1, hpMul: 1.1 },
    lore: '"흠흠- 만나서 반가워! 나는 정찰과 은하 생태학을 담당하는 비비안이야."',
    skill: {
      name: '동물 교감', tag: () => '리키 돌격 + 기절', cd: 7, params: { mult: 2.3, stun: 1, kazoo: 0, vuln: 0 },
      desc: (p) => `리키에게 공격 지시를 내린다. 리키가 비비안의 대상에게 덮쳐 리키 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}${p.kazoo ? `. 모든 아군 3초간 공격 속도 +${pct(p.kazoo)}` : ''}. 리키가 없으면 비비안이 직접 사격 위력 150%로 쏜다.`,
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
  },
  {
    id: 'yupito', name: '유피토', title: '"강철의 마녀" 특수공학자', factions: ['PAN'], traits: ['ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.0 }, range: 3, base: B(6, 7, 9, 5, 3),
    sprite: 'medic', palette: tint(PAL.PAN, '#2a3a6a', '#40e0c0', '#40e0c0'), lore: '"공학자는 언제나 상상력과 비장의 한 수가 있는 법이지"',
    skill: support({
      name: '임시 에너지 장벽', cd: 7, target: 'lowest', params: { radius: 1, shield: 1.0, turretShield: 1.0 },
      desc: (p) => `체력 비율이 가장 낮은 아군과 주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.shield)} 보호막${p.armor ? `, ${p.dur}초간 방어도 +${p.armor}` : ''}. 모든 포탑에도 ${pct(p.turretShield)} 보호막.`,
      after: (b, u, _ts, p) => { for (const t of b.alliesOf(u)) if (t.defId === 'turret') b.shield(t, b.P(u, 'tech') * p.turretShield); },
    }),
  },
  {
    id: 'ingel', name: '잉겔', title: '스타페어 가수 · 엘베스타드가 장녀', factions: ['PAN', 'FAM'], traits: ['STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.0 }, range: 3, base: B(6, 8, 8, 4, 5),
    sprite: 'medic', palette: tint(PAL.FAM, '#f4f4f8', '#d4b050', '#ffd860'),
    lore: '"매일 우리 흰사슴들의 관심을 빚지고 있잖아요. 오늘도 최고의 무대를 보여드릴게요, 기대해주세요-!"',
    skill: strike({
      name: '오늘도 최고의 무대', cd: 7, pow: 'tech', elem: 'psy', mult: 1.7, params: { radius: 2, fear: 1, fearChance: 0.3, noMiss: 1 },
      desc: (p) => `대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 정신 피해, ${pct(p.fearChance)} 확률로 ${p.fear}초 공포${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}.`,
    }),
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
      desc: (p) => `30년을 함께한 개조 기체가 가장 먼 적을 사격 위력 ${pct(p.mult)} 물리 피해로 포격 (방어도 관통 ${pct(p.pen)}${p.crit ? `, 치명타 확률 +${pct(p.crit)}` : ''}) + 둔화${p.hits > 1 ? `, ${p.hits}회` : ''}${p.radius ? `, 주변 ${p.radius}칸` : ''}.`,
    }),
  },
  {
    id: 'rachel', name: '레이첼', title: '아문센의 양녀 · 구인류 최후의 생존자', factions: ['FAM'], traits: [], keywords: ['bio'],
    atk: { type: 'strike', elem: 'psy', interval: 1.0 }, range: 1, base: B(10, 7, 5, 8, 3),
    sprite: 'soldier', palette: tint(PAL.FAM, '#121218', '#2a2a34', '#9a6aff'),
    lore: '"…이거 꼭 지금 해야 돼요? 하면 잘하긴 하는데."',
    skill: strike({
      name: '염동 제압', cd: 7, pow: 'strike', elem: 'psy', mult: 2.0, params: { stun: 1.5 },
      desc: (p) => `암흑물질 노심의 출력을 실어 대상에게 타격 위력 ${pct(p.mult)} 정신 피해 + ${p.stun}초 기절${p.radius ? ` (주변 ${p.radius}칸)` : ''}${p.selfShield ? `, 최대 체력 ${pct(p.selfShield)} 보호막` : ''}${p.lifesteal ? `, 피해의 ${pct(p.lifesteal)} 회복` : ''}.`,
    }),
  },
  {
    id: 'oliver', name: '올리버', title: '성간 항로 조합 메트로 기관사', factions: ['FAM'], traits: ['NAV'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(8, 9, 5, 6, 6),
    sprite: 'soldier', palette: tint(PAL.FAM, '#1c2438', '#d4a83a', '#ffcf40'),
    lore: '"오운완~! 화물 무사, 승객 대체로 무사!" — 과속 범칙금을 받은 당일 SNS',
    ace: {
      name: '오늘 운행 완료', desc: (k) => `전투 시작 시 모든 아군 공격 속도 +${Math.round(12 * k)}%. 동승자의 심장 건강은 보장하지 않는다.`,
      effect: (k) => ({ hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'ace.oliver', 999, { delta: { atkSpd: 0.12 * k }, label: '오운완' }); } } }),
    },
    skill: strike({
      name: '규정 속도 경계선', cd: 7, pow: 'tech', elem: 'phys', mult: 1.6, target: 'backline', blink: true, params: { radius: 1, stun: 0.5 },
      desc: (p) => `가장 뒤쪽 적에게 메트로처럼 들이받아 주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절${p.resetOnKill ? `. 처치 시 쿨다운 ${pct(p.resetOnKill)} 초기화` : ''}.`,
    }),
  },
  {
    id: 'rasmus', name: '라스무스', title: '엘베스타드가 조경사 · 경비견 맥스', factions: ['FAM'], traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, base: B(9, 7, 5, 7, 3),
    sprite: 'knight', palette: tint(PAL.FAM, '#4a5a3a', '#c8ccd8', '#ffcf40'),
    summon: { name: '맥스', art: 'sm_max', sprite: 'beast', palette: BEAR, atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, hpMul: 1.6 },
    lore: '본가의 정원을 40년 가꿨다. 정원을 망치는 것은 무엇이든 맥스가 먼저 쫓아낸다.',
    skill: {
      name: '불청객 퇴치', tag: () => '맥스 돌격 + 출혈', cd: 7, params: { mult: 2.5, bleed: 0.3, roar: 0 },
      desc: (p) => `맥스가 라스무스의 대상에게 달려들어 맥스 타격 위력 ${pct(p.mult)} 물리 피해 + 초당 ${pct(p.bleed)} 출혈${p.roar ? `, 맥스 주변 적 ${pct(p.roar)} 확률 1.2초 공포` : ''}. 맥스가 없으면 라스무스가 전정가위로 직접 150%.`,
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
          if (p.roar) { b.fx(bear.x, bear.y, 1, 'psy'); for (const e of b.around(bear, 1, b.enemiesOf(u))) fear(b, u, e, 1.2, p.roar); }
        }
        return true;
      },
    },
  },
  {
    id: 'sigmund', name: '시그문드', title: '엘베스타드가 집사', factions: ['FAM'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.2 }, range: 3, base: B(7, 7, 9, 6, 3),
    sprite: 'robe', palette: tint(PAL.FAM, '#1a1c2a', '#c8ccd8', '#ffd34d'), lore: '저택의 모든 문은 그의 허락으로 열리고, 모든 일정은 그의 수첩에서 시작된다.',
    skill: support({
      name: '집사의 보좌', cd: 8, target: 'commanded', params: { count: 1, dmg: 0.35, as: 0.15, dur: 6, famShield: 0.5 },
      desc: (p) => `가장 강한 아군 ${p.count}명에게 ${p.dur}초간 피해 +${pct(p.dmg)}, 공격 속도 +${pct(p.as)}${p.red ? `, 받는 피해 -${pct(p.red)}` : ''}. 엘베스타드 일가 아군 전원에게 기술 위력 ${pct(p.famShield)} 보호막.`,
      after: (b, u, _ts, p) => { for (const a of b.alliesOf(u)) if (a.synergies.has('FAM')) b.shield(a, b.P(u, 'tech') * p.famShield); },
    }),
  },
  {
    id: 'gunnir', name: '구닐라', title: '엘베스타드가 셰프', factions: ['FAM'], traits: ['MED', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(8, 5, 8, 7, 3),
    sprite: 'robe', palette: tint(PAL.FAM, '#1a1a1a', '#ffffff', '#c8ccd8'), lore: '3대째 같은 스튜를 끓인다. 레시피는 가주도 모른다.',
    skill: support({
      name: '가문의 스튜', cd: 4.5, target: 'lowest', power: cookPower, params: { shield: 1.8, heal: 0.6, armor: 200, dur: 5 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군에게 기술 위력 ${pct(p.shield)} 보호막 + ${pct(p.heal)} 회복${p.cleanse ? ', 해로운 상태이상 제거' : ''}, ${p.dur}초간 방어도 +${p.armor}${p.splash ? '. 주변 1칸 아군에게 50% 효과' : ''}.`,
    }),
  },
];
export { inc };
