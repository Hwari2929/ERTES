// 칼리토 제국 · 헬레니우스 동맹
import { inc } from '../engine/effects';
import { pct, skillHit, summonsOf } from './kit';
import { cookPower, pickEnemy, strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type UnitDef } from './unitkit';

const nat = (n: number) => ({ setup: (u: { mem: Record<string, number> }) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + n; } });
const faithWin = { after: (run: { faith: number }, _u: unknown, won: boolean) => { if (won) run.faith += 1; } };
const HOUND = ['#140808', '#8a2020', '#e0b040', '#d0a080', '#ffe040', '#4a2020', '#fff0c0'];

export const ROSTER_B: UnitDef[] = [
  // ───────── 칼리토 제국
  {
    id: 'hiiro', name: '히이로', title: '제국 황태자 겸 전략가', factions: ['KAL'], traits: ['STAFF', 'STAR'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.2 }, range: 3, base: B(6, 7, 9, 4, 5),
    sprite: 'robe', palette: tint(PAL.KAL, '#a8283a', '#ffd34d', '#ffffff'), lore: '황위 계승 서열 1위. 전쟁 계획 승인 서열도 1위.',
    skill: support({
      name: '황명', cd: 8, target: 'commanded', params: { count: 1, dmg: 0.4, as: 0.2, dur: 5 },
      desc: (p) => `가장 강한 아군 ${p.count}명(참모단 지원 대상 우선)에게 ${p.dur}초간 피해 +${pct(p.dmg)}, 공격 속도 +${pct(p.as)}.`,
    }),
    augs: [
      uaug('hiiro', 'decree', '칙령 공포', '황명 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('hiiro', 'glory', '영광의 이름으로', '피해 증가 +15%p.', setSk((s) => { s.dmg += 0.15; })),
      uaug('hiiro', 'long', '장기 원정', '황명 지속 +3초.', setSk((s) => { s.dur += 3; })),
      uaug('hiiro', 'crown', '왕관의 무게', '작위 +1, 정신력 +3.', { title: 1, majors: { mnd: 3 } }),
      uaug('hiiro', 'press', '황실 대변인', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'nadir', name: '나디르', title: '사막 행성 출신 궁정 술사', factions: ['KAL', 'PAN'], traits: ['SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'robe', palette: tint(PAL.KAL, '#c89a4a', '#3fbfa8', '#ff8040'), lore: '제국에선 이방인, 고향에선 배신자. 모래폭풍만이 그를 반긴다.',
    skill: strike({
      name: '모래 폭풍', cd: 7, pow: 'tech', elem: 'chem', mult: 1.4, params: { radius: 2, slow: 0.3, poison: 0.2, noMiss: 1 },
      desc: (p) => `대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 화학 피해 + 둔화 + 4초간 초당 기술 위력 ${pct(p.poison)} 중독.`,
    }),
    augs: [
      uaug('nadir', 'storm', '대폭풍', '모래 폭풍 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('nadir', 'sand', '작열하는 모래', '모래 폭풍 피해 +40%p.', setSk((s) => { s.mult += 0.4; })),
      uaug('nadir', 'venom', '전갈 독', '중독 피해 +20%p.', setSk((s) => { s.poison += 0.2; })),
      uaug('nadir', 'erode', '침식', '모래 폭풍이 방어도 30% 감소 (5초).', setSk((s) => { s.corrode = 0.3; })),
      uaug('nadir', 'mirage', '신기루', '모래 폭풍에 맞은 적 40% 확률로 1초 공포.', setSk((s) => { s.fear = 1; s.fearChance = 0.4; })),
    ],
  },
  {
    id: 'temur', name: '테무르', title: '제국 변경 기마 대장', factions: ['KAL'], traits: ['VAN', 'NATURE'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(9, 8, 5, 7, 4),
    sprite: 'knight', palette: tint(PAL.KAL, '#7a4a2a', '#e0b040', '#ffd34d'), lore: '말이 없는 행성에서도 기마 대장이다. 무엇을 타는지는 묻지 마라.',
    skill: strike({
      name: '초원의 돌격', cd: 7, pow: 'strike', elem: 'phys', mult: 2.0, target: 'farthest', blink: true, params: { stun: 0.8, bleed: 0.25 },
      desc: (p) => `가장 먼 적에게 돌격해 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절 + 출혈.`,
    }),
    augs: [
      uaug('temur', 'lance', '기병창', '돌격 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('temur', 'wound', '깊은 상처', '출혈 피해 +25%p.', setSk((s) => { s.bleed += 0.25; })),
      uaug('temur', 'guard', '기마 갑주', '돌격 후 최대 체력 25% 보호막.', setSk((s) => { s.selfShield = 0.25; })),
      uaug('temur', 'trample', '짓밟기', '돌격이 대상 주변 1칸 적에게도 피해.', setSk((s) => { s.radius = 1; })),
      uaug('temur', 'yurt', '이동식 천막', '캠핑 러버 임시 장비 +1개, 생명력 +3.', { ...nat(1), majors: { vit: 3 } }),
    ],
  },
  {
    id: 'kairo', name: '카이로', title: '제국 궁정 저격수 겸 요리장', factions: ['KAL'], traits: ['MARK', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 6, base: B(6, 9, 8, 4, 4),
    sprite: 'soldier', palette: tint(PAL.KAL, '#1a1a22', '#e0b040', '#ff3040'), lore: '수프가 끓는 시간과 표적이 지치는 시간은 같다.',
    skill: {
      name: '저격수의 도시락', cd: 4.5, params: { shield: 1.2, crit: 0.15, dur: 5, need: 6, snipe: 8, snipeCrit: 0.3, keep: 0, start: 2 },
      desc: (p) => `[요리] 체력 비율이 가장 낮은 아군에게 기술 위력 ${pct(p.shield)} 보호막 + ${p.dur}초간 치명타 +${pct(p.crit)}p. 요리할 때마다 [기다림의 미학] 1스택, ${p.need}스택이면 체력이 가장 높은 적에게 사격 위력 ${pct(p.snipe)} 물리 저격 (치명타 확률 +${pct(p.snipeCrit)}p). 전투 시작 시 ${p.start}스택.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        const t = b.lowestHpAlly(u);
        if (t) {
          b.shield(t, b.S(u, 'tech') * p.shield * cookPower(u));
          b.buff(u, t, 'kairo.bento', p.dur, { delta: { crit: p.crit * cookPower(u) }, label: '도시락' });
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
      uaug('kairo', 'patience', '조급함 없는 기다림', '저격에 필요한 스택 -1 (5스택).', setSk((s) => { s.need -= 1; })),
      uaug('kairo', 'magnum', '대구경 탄', '저격 피해 +300%p.', setSk((s) => { s.snipe += 3; })),
      uaug('kairo', 'stock', '육수 보관', '저격 후 스택 2개가 남는다.', setSk((s) => { s.keep = 2; })),
      uaug('kairo', 'aim', '숨 고르기', '저격 치명타 확률 +30%p, 치명타 피해 +50%p.', { stats: { critDmg: 0.5 }, setup: (u) => { u.sk.snipeCrit += 0.3; } }),
      uaug('kairo', 'bento', '2단 도시락', '도시락 보호막 +50%p.', setSk((s) => { s.shield += 0.5; })),
    ],
  },
  {
    id: 'zahara', name: '자하라', title: '제국 황실 디저트 장인', factions: ['KAL'], traits: ['STAR', 'CHEF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(7, 5, 8, 6, 3),
    sprite: 'medic', palette: tint(PAL.KAL, '#ffb0d0', '#a8283a', '#ffd34d'), lore: '황제가 웃은 날은 기록된다. 전부 그녀의 케이크가 나온 날이다.',
    skill: support({
      name: '황실 디저트', cd: 4.5, target: 'strongest', power: cookPower, params: { heal: 1.2, dmg: 0.45, dur: 5, count: 1 },
      desc: (p) => `[요리] 가장 강한 아군 ${p.count}명을 기술 위력 ${pct(p.heal)} 회복하고 ${p.dur}초간 피해 +${pct(p.dmg)}.`,
    }),
    augs: [
      uaug('zahara', 'sugar', '슈가 하이', '피해 증가 +15%p.', setSk((s) => { s.dmg += 0.15; })),
      uaug('zahara', 'cream', '생크림 듬뿍', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('zahara', 'macaron', '마카롱 탑', '요리받은 아군 공격 속도 +20%.', setSk((s) => { s.as = 0.2; })),
      uaug('zahara', 'tower', '디저트 타워', '요리 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('zahara', 'show', '쿠킹 쇼', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
    ],
  },
  {
    id: 'bianca', name: '비앙카', title: '제국 황녀 · 사냥개 루비', factions: ['KAL'], traits: ['BUDDY', 'MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 3, base: B(7, 6, 8, 5, 4),
    sprite: 'medic', palette: tint(PAL.KAL, '#f0e0ff', '#a8283a', '#ffd34d'),
    summon: { name: '루비', sprite: 'beast', palette: HOUND, atk: { type: 'strike', elem: 'phys', interval: 0.8 }, range: 1, hpMul: 1.0 },
    lore: '궁정 예법 수업보다 사냥개 훈련 시간이 길었다.',
    skill: support({
      name: '호루라기', cd: 7, target: 'lowest', params: { heal: 1.8, petDmg: 0.4 },
      desc: (p) => `체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복. 루비는 4초간 피해 +${pct(p.petDmg)}.`,
      after: (b, u, _ts, p) => { for (const d of summonsOf(b, u)) b.buff(u, d, 'bianca.whistle', 4, { mods: [inc('all', p.petDmg)], label: '물어!' }); },
    }),
    augs: [
      uaug('bianca', 'nurse', '황실 시의', '회복량 +50%p.', setSk((s) => { s.heal += 0.5; })),
      uaug('bianca', 'ruby', '명견 혈통', '루비 스탯 상속률 +30%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.3; } }),
      uaug('bianca', 'guard', '호위', '호루라기가 기술 위력 80% 보호막도 준다.', setSk((s) => { s.shield = 0.8; })),
      uaug('bianca', 'pack', '사냥개 무리', '사냥개를 하나 더 데려온다 (상속률 60%).', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } }),
      uaug('bianca', 'royal', '황녀의 권위', '작위 +1, 생명력 +3.', { title: 1, majors: { vit: 3 } }),
    ],
  },
  // ───────── 헬레니우스 동맹
  {
    id: 'zephyro', name: '제피로', title: '동맹 함대 항해장', factions: ['HEL'], traits: ['STAFF', 'NAV'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 3, base: B(6, 7, 8, 5, 5),
    sprite: 'soldier', palette: tint(PAL.HEL, '#2f7aa3', '#e8eef0', '#ffd34d'), lore: '항로를 그리는 손이 떨린 적은 없다. 커피 잔을 들 때만 떨린다.',
    ace: {
      name: '편대 지휘', desc: (k) => `전투 시작 시 모든 아군 공격 속도 +${Math.round(10 * k)}%.`,
      effect: (k) => ({ hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'ace.zephyro', 999, { delta: { atkSpd: 0.1 * k }, label: '편대 지휘' }); } } }),
    },
    skill: support({
      name: '항로 지정', cd: 8, target: 'commanded', params: { count: 2, as: 0.25, dur: 5 },
      desc: (p) => `가장 강한 아군 ${p.count}명에게 ${p.dur}초간 공격 속도 +${pct(p.as)}.`,
    }),
    augs: [
      uaug('zephyro', 'fleet', '함대 기동', '항로 지정 대상 +1명.', setSk((s) => { s.count += 1; })),
      uaug('zephyro', 'wind', '순풍', '공격 속도 증가 +15%p.', setSk((s) => { s.as += 0.15; })),
      uaug('zephyro', 'escort', '호위 항로', '항로 지정 대상의 받는 피해 -15%.', setSk((s) => { s.red = 0.15; })),
      uaug('zephyro', 'long', '장거리 항해', '항로 지정 지속 +3초.', setSk((s) => { s.dur += 3; })),
      uaug('zephyro', 'attack', '공격 항로', '항로 지정 대상 피해 +15%.', setSk((s) => { s.dmg = 0.15; })),
    ],
  },
  {
    id: 'phyllis', name: '필리스', title: '동맹 비밀 수녀', factions: ['HEL'], traits: ['INFIL', 'CLERIC'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 0.9 }, range: 1, base: B(5, 9, 7, 3, 8),
    sprite: 'robe', palette: tint(PAL.HEL, '#1a2a2a', '#e8eef0', '#b07cff'), lore: '고해성사는 언제든 받는다. 대개 상대가 마지막으로 하는 말이다.',
    skill: strike({
      name: '신성 단검', cd: 6, pow: 'strike', elem: 'holy', mult: 2.4, target: 'lowest', blink: true,
      desc: (p) => `체력 비율이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 신성 피해${p.hits > 1 ? ` ${p.hits}회` : ''}.`,
    }),
    augs: [
      uaug('phyllis', 'twin', '쌍단검', '신성 단검이 2회 공격 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('phyllis', 'mark', '죄의 낙인', '대상은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('phyllis', 'next', '다음 고해', '신성 단검으로 처치하면 쿨다운 70% 회복.', setSk((s) => { s.resetOnKill = 0.7; })),
      uaug('phyllis', 'habit', '수녀복 속 갑옷', '회피 +15%p, 방어력 +3.', { stats: { eva: 0.15 }, majors: { def: 3 } }),
      uaug('phyllis', 'vespers', '저녁 기도', '전투 승리 시 신앙 +1.', {}, faithWin),
    ],
  },
  {
    id: 'eleni', name: '엘레니', title: '동맹 야전 방패 의무관', factions: ['HEL'], traits: ['VAN', 'MED'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, base: B(10, 6, 6, 8, 2),
    sprite: 'knight', palette: tint(PAL.HEL, '#2fa39a', '#ffffff', '#ff6060'), lore: '방패 안쪽에 구급상자를 매단 최초의 의무관.',
    skill: support({
      name: '방패 붕대', cd: 7, target: 'aroundSelf', params: { radius: 1, shield: 1.2, heal: 0.6 },
      desc: (p) => `자신과 주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.shield)} 보호막 + ${pct(p.heal)} 회복.`,
    }),
    augs: [
      uaug('eleni', 'thick', '두꺼운 붕대', '보호막 +50%p.', setSk((s) => { s.shield += 0.5; })),
      uaug('eleni', 'wide', '야전 병상', '범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('eleni', 'salve', '연고', '회복량 +40%p.', setSk((s) => { s.heal += 0.4; })),
      uaug('eleni', 'plate', '방탄 붕대', '대상 4초간 방어도 +250.', setSk((s) => { s.armor = 250; })),
      uaug('eleni', 'clean', '소독', '대상의 해로운 상태이상 제거.', setSk((s) => { s.cleanse = 1; })),
    ],
  },
  {
    id: 'iris', name: '이리스', title: '동맹 무지개 사제', factions: ['HEL'], traits: ['CLERIC', 'SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.1 }, range: 4, base: B(6, 7, 9, 4, 4),
    sprite: 'robe', palette: tint(PAL.HEL, '#e8eef0', '#ff8ac8', '#7ae0ff'), lore: '일곱 신 중 누구에게 기도하냐고? 그날 기분에 맞는 신.',
    skill: strike({
      name: '무지개 성광', cd: 7, pow: 'tech', elem: 'holy', mult: 1.7, params: { radius: 1, healBack: 0.6 },
      desc: (p) => `대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 신성 피해, 체력이 가장 낮은 아군을 ${pct(p.healBack)} 회복.`,
      after: (b, u, _t, _d, p) => { const l = b.lowestHpAlly(u); if (l) b.heal(u, l, b.S(u, 'tech') * p.healBack); },
    }),
    augs: [
      uaug('iris', 'spectrum', '스펙트럼', '성광 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('iris', 'bright', '눈부신 빛', '성광 피해 +50%p.', setSk((s) => { s.mult += 0.5; })),
      uaug('iris', 'judge', '빛의 심판', '맞은 적은 4초간 받는 피해 +20%.', setSk((s) => { s.vuln = 0.2; })),
      uaug('iris', 'mercy', '자비', '회복량 +60%p.', setSk((s) => { s.healBack += 0.6; })),
      uaug('iris', 'seven', '일곱 신의 축복', '전투 승리 시 신앙 +1.', {}, faithWin),
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
