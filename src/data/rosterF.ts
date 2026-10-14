// 4차 확장 기물 11종: 기본 정의(명단) + 리워크 정보(무기 · 특성 · 유형)를 한 파일에 둔다.
import type { Battle, CUnit } from '../engine/combat';
import { type AugDef, type Effect, inc, red } from '../engine/effects';
import type { Elem, Weapon } from '../types';
import { gw, isHarmful, pct, poison, shock, skillHit, slow } from './kit';
import { cookPower, strike, support } from './tpl';
import { B, PAL, type BaseUnit, type ReworkDef, setSk, tint, uaug } from './unitkit';

const G = (name: string, elem: Elem, interval: number, range: number, mult: number, mag: number, reload: number): Weapon =>
  ({ name, kind: 'mag', type: 'shoot', elem, interval, range, mult, mag, reload });
const K = (name: string, elem: Elem, interval: number, range: number, mult: number, combo: number): Weapon =>
  ({ name, kind: 'combo', type: 'strike', elem, interval, range, mult, combo });
const sp = (owner: string, id: string, name: string, desc: string, effect: Effect): AugDef =>
  ({ ...uaug(owner, `sp.${id}`, name, desc, effect), pool: 'special' });
/** 전투당 n회까지 성장 기록 */
const rec = (u: CUnit, key: string, max: number) => { if ((u.mem[key] || 0) < max) u.mem[key] = (u.mem[key] || 0) + 1; };
const lowestAlly = (b: Battle, u: CUnit) => b.lowestHpAlly(u);

const SEC_PAL = ['#0c0e14', '#3a4258', '#b8c0d0', '#e8c8a8', '#7fe3ff', '#4a5060', '#ffffff'];
const STL_PAL = ['#140a06', '#ff6a3d', '#2a2a34', '#f0c8a0', '#ffe14d', '#5a4a44', '#ffffff'];
const HOI_PAL = ['#0e0c06', '#1c1c24', '#d4af37', '#ecd0b8', '#ff4d9a', '#4a4430', '#fff4c0'];
const SLIME = ['#06100a', '#4cc860', '#2a7a3a', '#9af0a0', '#ffffff', '#2a4a30', '#e0ffe0'];

export const ROSTER_F: BaseUnit[] = [
  {
    id: 'bjorn', name: '비외른', title: '범은하 구조대장 · 북해의 바이킹', factions: ['PAN'], traits: ['COND', 'GUARD'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.1 }, range: 3, base: B(9, 8, 4, 8, 3),
    sprite: 'knight', palette: tint(PAL.PAN, '#5a6a78', '#d4af37', '#ffd84d'),
    lore: '"뒤는 걱정 마라. 내가 서 있는 한, 아무도 남겨 두고 가지 않는다."',
    skill: strike({
      name: '구조 작살', cd: 7, pow: 'shoot', elem: 'elec', mult: 2.2, target: 'farthest', params: { stun: 1, rescue: 1.2 },
      desc: (p) => `가장 먼 적에게 전기 작살을 박아 사격 위력 ${pct(p.mult)} 전기 피해, ${p.stun}초 기절. 체력 비율이 가장 낮은 아군에게 사격 위력 ${pct(p.rescue)} 보호막.`,
      after: (b, u, _t, _d, p) => { const l = lowestAlly(b, u); if (l) b.shield(l, b.P(u, 'shoot') * p.rescue); },
    }),
  },
  {
    id: 'zina', name: '지나', title: '꽃집 주인 · 전직 성도회 암살자', factions: ['SIR'], traits: ['INFIL', 'DECOMP'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 0.9 }, range: 4, base: B(5, 9, 6, 3, 9),
    sprite: 'soldier', palette: tint(PAL.SIR, '#1a1a1a', '#ff8ab0', '#ff8ab0'),
    lore: '"오늘의 꽃은 백합이에요. 꽃말이요? …그건 받는 분이 알게 되실 거예요."',
    skill: strike({
      name: '마지막 꽃다발', cd: 7, pow: 'shoot', elem: 'chem', mult: 2.6, target: 'lowest', blink: true, params: { poison: 0.5, resetOnKill: 0.5 },
      desc: (p) => `체력 비율이 가장 낮은 적 곁으로 숨어들어 사격 위력 ${pct(p.mult)} 화학 피해 + 중독 (초당 ${pct(p.poison)}). 처치하면 쿨다운 ${pct(p.resetOnKill)} 회복.`,
    }),
  },
  {
    id: 'fotini', name: '포티니 양', title: '헬레니우스 관광청 안내 로봇', factions: ['HEL'], traits: ['STAR'], keywords: ['mech'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.0 }, range: 4, base: B(6, 7, 7, 5, 6),
    sprite: 'drone', palette: tint(PAL.HEL, '#f0f0f8', '#ff9de2', '#7fe3ff'),
    lore: '"여러분~ 이쪽입니다 ^^ 왼쪽에 보이시는 것이 바로 전장입니다 ^^"',
    skill: strike({
      name: '관광 명소 소개', cd: 6.5, pow: 'shoot', elem: 'holy', mult: 1.6, params: { radius: 1, vuln: 0.15 },
      desc: (p) => `안내 깃발로 대상 주변 ${p.radius}칸에 사격 위력 ${pct(p.mult)} 신성 피해, 4초간 받는 피해 +${pct(p.vuln)} (관광객의 시선 집중).`,
    }),
  },
  {
    id: 'kaburaya', name: '카부라야', title: '호이슌 홀딩스 리스크관리본부장', factions: ['HOI'], traits: ['COND', 'SCHEME'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.2 }, range: 3, base: B(5, 4, 10, 5, 5),
    sprite: 'soldier', palette: tint(HOI_PAL, '#1c1c24', '#8a8a96', '#4fc3ff'),
    lore: '"…아, 네. 리스크요. 다 처리했습니다. 이제 퇴근해도 됩니까."',
    skill: strike({
      name: '야근 수당 청구', cd: 7, pow: 'tech', elem: 'elec', mult: 1.9, params: { radius: 1, shock: 1.5, shockChance: 0.8 },
      desc: (p) => `대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 전기 피해, ${pct(p.shockChance)} 확률로 ${p.shock}초 감전.`,
    }),
  },
  {
    id: 'bill', name: '빌', title: '보안위원회 위원 · 영원한 휴가객', factions: ['SEC', 'STL'], traits: ['SCHEME'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 0.9 }, range: 3, base: B(7, 5, 7, 5, 6),
    sprite: 'soldier', palette: tint(SEC_PAL, '#ff8a3d', '#5ad08a', '#b07cff'),
    lore: '"하하! 일은 무슨, 난 휴가 중이라네. …아, 그 친구? 방금 처리했지. 하하!"',
    skill: strike({
      name: '기념사진 플래시', cd: 6, pow: 'tech', elem: 'elec', mult: 1.4, params: { radius: 1, fear: 1.5, fearChance: 0.6 },
      desc: (p) => `"자, 김치~!" 대상 주변 ${p.radius}칸에 기술 위력 ${pct(p.mult)} 전기 피해, ${pct(p.fearChance)} 확률로 ${p.fear}초 공포.`,
    }),
  },
  {
    id: 'winter', name: '윈터', title: '연합 생명과학 교수 · 레이서 팀 주치의', factions: ['UNI', 'STL'], traits: ['MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 1.0 }, range: 3, base: B(6, 4, 10, 4, 5),
    sprite: 'medic', palette: tint(PAL.UNI, '#e8eef0', '#3b6fd8', '#9ad0ff'),
    lore: '"마스크는 벗지 않을 거예요. 당신들 미생물 수치, 생각보다 꽤 끔찍하거든요."',
    skill: support({
      name: '임상 시험 혈청', cd: 6, target: 'lowest', params: { heal: 2.2, red: 0.15, dur: 4 },
      desc: (p) => `체력 비율이 가장 낮은 아군에게 기술 위력 ${pct(p.heal)} 회복, ${p.dur}초간 받는 피해 -${pct(p.red)}${p.splash ? '. 주변 1칸 아군에게 50% 효과' : ''}.`,
    }),
  },
  {
    id: 'issac', name: 'ISSAC', title: '연합 생체 실험체 · 흰 정장의 신사', factions: ['UNI'], traits: ['DECOMP', 'HUNTER'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'chem', interval: 0.85 }, range: 1, base: B(10, 8, 3, 8, 3),
    sprite: 'knight', palette: tint(SLIME, '#f0f0f0', '#4cc860', '#ffffff'),
    lore: '"놀라셨다면 죄송합니다. 붕대는… 예의상 감고 있는 것입니다."',
    skill: strike({
      name: '붕대 해제', cd: 7, pow: 'strike', elem: 'chem', mult: 1.8, aroundSelf: true, params: { radius: 1, poison: 0.3, selfShield: 0.15 },
      desc: (p) => `붕대를 풀어 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 화학 피해 + 중독 (초당 ${pct(p.poison)}), 최대 체력 ${pct(p.selfShield)} 보호막.`,
    }),
  },
  {
    id: 'eden', name: '이든', title: '연합 하층 출신 · 보안위원회 비정규 요원', factions: ['UNI', 'SEC'], traits: ['DECOMP'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(6, 8, 5, 4, 7),
    sprite: 'soldier', palette: tint(PAL.UNI, '#3a3a44', '#8a6a4a', '#ffd040'),
    lore: '"트레이닝복이 어때서. 도망칠 땐 이게 제일 편해."',
    skill: strike({
      name: '뒷골목 수법', cd: 6, pow: 'shoot', elem: 'chem', mult: 1.4, params: { radius: 1, strip: 0.5, stripN: 1, vuln: 0 },
      desc: (p) => `대상과 주변 ${p.radius}칸에 독한 약품을 뿌려 전술 위력 ${pct(p.mult)} 화학 피해. 맞은 적마다 ${pct(p.strip)} 확률로 이로운 효과 ${p.stripN}종 제거${p.vuln ? `, 4초간 받는 피해 +${pct(p.vuln)}` : ''}.`,
      after: (b, u, t, _d, p) => {
        for (const e of b.around(t, p.radius, b.enemiesOf(u))) {
          if (!e.alive || !b.rng.chance(p.strip)) continue;
          let n = 0;
          e.statuses = e.statuses.filter((s) => (n < p.stripN && !isHarmful(s) && s.type === 'buff' ? (n++, false) : true));
          if (n) b.emit({ k: 'status', id: e.id, name: '강화 해제' });
        }
      },
    }),
  },
  {
    id: 'reika', name: '레이카 0호', title: '호이슌 엔터 소속 버추얼 아이돌', factions: ['HOI'], traits: ['STAR', 'COND'], keywords: ['mech'],
    atk: { type: 'shoot', elem: 'elec', interval: 0.9 }, range: 4, base: B(5, 4, 10, 4, 7),
    sprite: 'robe', palette: tint(HOI_PAL, '#ff4d9a', '#7fe3ff', '#ffe14d'),
    lore: '"안녕안녕~ 레이카 0호야! 오늘도 은하 끝까지 방송 켜 둘게~☆"',
    skill: {
      name: '라이브 피날레', tag: () => '적 전체 전기 공격 + 감전', cd: 8, params: { mult: 0.9, shockChance: 0.4, shock: 1.2, encore: 0 },
      desc: (p) => `모든 적에게 기술 위력 ${pct(p.mult)} 전기 피해, ${pct(p.shockChance)} 확률로 ${p.shock}초 감전${p.encore ? `. 앙코르: 같은 공연을 ${pct(p.encore)} 위력으로 한 번 더` : ''}.`,
      cast(b, u) {
        const es = b.enemiesOf(u);
        if (!es.length) return false;
        const p = u.sk;
        const show = (k: number) => {
          for (const e of b.enemiesOf(u)) {
            skillHit(b, u, e, 'tech', p.mult * k, 'elec', { noMiss: true });
            if (e.alive) shock(b, u, e, p.shock, p.shockChance);
          }
        };
        b.fx(u.x, u.y, 0, 'elec');
        show(1);
        if (p.encore) show(p.encore);
        return true;
      },
    },
  },
  {
    id: 'mao', name: '마오', title: '호이슌 홀딩스 회장', factions: ['HOI', 'STL'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.1 }, range: 3, base: B(6, 4, 9, 5, 6),
    sprite: 'robe', palette: tint(HOI_PAL, '#1c1c24', '#ff4d9a', '#7fe3ff'),
    lore: '"한 잔 하실래요? 오늘 계약서에 서명하시면, 이 잔은 제가 사죠."',
    skill: support({
      name: '네온 칵테일', cd: 5.5, target: 'strongest', power: cookPower, params: { heal: 0.8, dmg: 0.35, as: 0.25, dur: 6 },
      desc: (p) => `[요리] 가장 강한 아군에게 기술 위력 ${pct(p.heal)} 회복, ${p.dur}초간 피해 +${pct(p.dmg)} · 공격 속도 +${pct(p.as)}.`,
    }),
  },
  {
    id: 'skadi', name: '스카디', title: '페트라 자산운용 인재개발실장', factions: ['PET', 'STL'], traits: ['COND'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'elec', interval: 0.9 }, range: 1, base: B(9, 8, 5, 7, 4),
    sprite: 'knight', palette: tint(STL_PAL, '#1c1c24', '#ffe14d', '#4fc3ff'),
    lore: '"잠재력이 보이네요. 연봉 협상은 살아서 돌아온 다음에 하죠."',
    skill: strike({
      name: '분기 실적 보고', cd: 6.5, pow: 'strike', elem: 'elec', mult: 2.0, aroundSelf: true, params: { radius: 1, stun: 0.8, selfShield: 0.2 },
      desc: (p) => `서류 가방을 휘둘러 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 전기 피해, ${p.stun}초 기절, 최대 체력 ${pct(p.selfShield)} 보호막.`,
    }),
  },
];

/** 리워크 정보 */
export const REWORK_F: Record<string, ReworkDef> = {
  bjorn: {
    ctype: 'MARK', ttype: 'special', faith: 'human', weapon: G('구조용 전기 작살포', 'elec', 1.1, 3, 1.0, 6, 2.0),
    trait: {
      name: '바이킹의 피', desc: '피해량 경감 15%. 잃은 체력 1%당 주는 피해 +1%.',
      effect: { taken: [red('all', 0.15)], hooks: { dmgMult: (b, u) => 1 + (1 - b.hpPct(u)) } },
    },
    specialAugs: [
      sp('bjorn', 'first', '구조 우선', '아군이 쓰러질 피해를 받으면 전투당 1회 비외른이 대신 맞아 그 아군은 체력 1로 버틴다.', {
        hooks: { onStart(b, u) {
          for (const a of b.alliesOf(u, false)) a.hooks.push({ onLethal(bb, self) {
            if (u.mem.saved || !u.alive) return false;
            u.mem.saved = 1; self.hp = 1; bb.dealDamage(self, u, bb.S(u, 'maxHp') * 0.2, { elem: 'true', tag: 'proc', noHooks: true });
            bb.emit({ k: 'status', id: self.id, name: '구조!' });
            return true;
          } });
        } },
      }),
      sp('bjorn', 'thunder', '토르의 작살', '기본 공격이 30% 확률로 1초 감전을 건다.', { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) shock(b, u, t, 1, 0.3); } } }),
      sp('bjorn', 'song', '전사의 노래', '전투 시작 시 모든 아군 8초간 피해 +20%.', { hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'bjorn.song', 8, { mods: [inc('all', 0.2)], label: '전사의 노래' }); } } }),
    ],
  },
  zina: {
    ctype: 'MARK', ttype: 'psionic', faith: 'sirius', weapon: G('꽃다발 속 소음 권총', 'chem', 0.9, 4, 1.0, 8, 1.6),
    trait: {
      name: '꽃집 아가씨', desc: '기본 공격이 사격 위력 20% 화학 중독을 건다 (4초). 중독된 적에게 주는 피해 +25%.',
      effect: { hooks: {
        onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) poison(b, u, t, b.S(u, 'shoot') * 0.2, 4, 1); },
        dmgMult: (_b, u, t) => (t.statuses.some((s) => s.key === 'poison') ? 1.25 + (u.mem.zinaVenom || 0) : 1),
      } },
    },
    psi: { desc: '마지막 꽃다발을 쓰면 이성 -10, 적을 처치하면 +6.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -10), onKill: (b, u) => b.addReason(u, 6) } } },
  },
  fotini: {
    ctype: 'MARK', ttype: 'divine', faith: 'hermes', weapon: G('안내 깃발 레이저', 'holy', 1.0, 4, 0.9, 8, 1.8),
    trait: {
      name: '여러분 이쪽입니다 ^^', desc: '전투 시작 시 모든 아군 이동 속도 +20%, 6초간 피해 +15%.',
      effect: { hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) { a.st.moveSpd += 0.2; b.buff(u, a, 'fotini.tour', 6, { mods: [inc('all', 0.15)], label: '관광 시작' }); } } } },
    },
  },
  kaburaya: {
    ctype: 'CMD', ttype: 'major', faith: 'index', weapon: G('지루한 스턴건', 'elec', 1.2, 3, 0.9, 4, 2.0),
    trait: {
      name: '권태', desc: '기본 공격이 30% 확률로 1초 감전을 건다. 감전된 적에게 주는 피해 +25%.',
      effect: { hooks: {
        onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) shock(b, u, t, 1, 0.3); },
        dmgMult: (b, u, t) => (b.has(t, 'shock') ? 1.25 + (u.mem.kabBored || 0) : 1),
      } },
    },
  },
  bill: {
    ctype: 'SPEC', ttype: 'minor', faith: 'human', weapon: G('관광용 물총', 'chem', 0.9, 3, 0.9, 10, 2.0),
    trait: {
      name: '호쾌한 관광객', desc: '기본 공격이 25% 확률로 3초 둔화를 건다. 해로운 효과가 걸린 적이 받는 피해 +10% (빌의 공격).',
      effect: { hooks: {
        onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) slow(b, u, t, 0.25, 3, 0.25); },
        dmgMult: (_b, u, t) => (t.statuses.some((s) => s.type !== 'buff' || s.key === 'slow' || s.key === 'gloom') ? 1 + 0.1 * gw(u) : 1),
      } },
    },
  },
  winter: {
    ctype: 'SPEC', ttype: 'special', faith: 'science', weapon: G('주사기 권총', 'chem', 1.0, 3, 0.8, 6, 1.8),
    trait: {
      name: '생명과학 교수', desc: '치료한 아군의 최대 체력이 전투 동안 2% 오른다 (대상당 최대 5회).',
      effect: { hooks: { onHealDone(b, u, t) {
        const k = `winter${u.id}`;
        if ((t.mem[k] || 0) >= 5) return;
        t.mem[k] = (t.mem[k] || 0) + 1;
        const add = b.S(t, 'maxHp') * 0.02;
        t.st.maxHp += add; t.hp += add;
      } } },
    },
    specialAugs: [
      sp('winter', 'vaccine', '광역 백신', '임상 시험 혈청이 모든 아군에게 40% 효과로 퍼진다.', { hooks: { onSkill(b, u) { for (const a of b.alliesOf(u)) b.heal(u, a, b.P(u, 'tech') * u.sk.heal * 0.4); } } }),
      sp('winter', 'antidote', '해독제', '치료할 때 해로운 효과를 모두 없앤다.', { hooks: { onHealDone(_b, _u, t) { t.statuses = t.statuses.filter((s) => !isHarmful(s)); } } }),
      sp('winter', 'pathogen', '병원체 샘플', '기본 공격이 기술 위력 30% 화학 중독을 건다 (4초).', { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive) poison(b, u, t, b.S(u, 'tech') * 0.3, 4, 1); } } }),
    ],
  },
  issac: {
    ctype: 'VAN', ttype: 'major', faith: 'science', weapon: K('붕대 감은 주먹', 'chem', 0.85, 1, 1.0, 3),
    trait: {
      name: '재생하는 괴물', desc: '초당 최대 체력 0.5% 재생. 화학 피해량 경감 30%.',
      effect: { taken: [red('chem', 0.3)], hooks: { onTick(b, u, dt) { u.mem.issacT = (u.mem.issacT || 0) + dt; if (u.mem.issacT >= 1) { u.mem.issacT = 0; b.heal(u, u, b.S(u, 'maxHp') * 0.005, true); } } } },
    },
  },
  eden: {
    ctype: 'CMD', ttype: 'minor', faith: 'human', weapon: G('낡은 리볼버', 'phys', 1.0, 4, 1.1, 6, 2.0),
    trait: {
      name: '밑바닥 생존자', desc: '체력이 50% 이하이면 회피 +10%p, 주는 피해 +20%.',
      effect: { hooks: {
        dmgMult: (b, u) => (b.hpPct(u) <= 0.5 ? 1 + 0.2 * gw(u) : 1),
        onHurt(b, u) { if (!u.mem.edenLow && b.hpPct(u) <= 0.5) { u.mem.edenLow = 1; u.st.eva += 0.1; b.emit({ k: 'status', id: u.id, name: '생존 본능' }); } },
      } },
    },
  },
  reika: {
    ctype: 'CMD', ttype: 'divine', faith: 'zeus', weapon: G('라이트 스틱 빔', 'elec', 0.9, 4, 0.9, 10, 1.6),
    trait: {
      name: '구독과 좋아요', desc: '아군이 전투 스킬을 쓸 때마다 [시청자] +1 (최대 30). 시청자 1명당 레이카의 기술 피해 +3%.',
      effect: {
        setup: (u) => { u.mem.viewers = u.mem.viewers || 0; },
        hooks: {
          onAllySkill(_b, u) { u.mem.viewers = Math.min(30 + (u.mem.viewerCap || 0), (u.mem.viewers || 0) + 1); },
          onSkill(_b, u) { u.mem.viewers = Math.min(30 + (u.mem.viewerCap || 0), (u.mem.viewers || 0) + 1); },
          dmgMult: (_b, u, _t, o) => (o.kind === 'tech' ? 1 + 0.03 * (u.mem.viewers || 0) : 1),
        },
      },
    },
  },
  mao: {
    ctype: 'CMD', ttype: 'special', faith: 'index', weapon: G('칵테일 셰이커 블래스터', 'elec', 1.1, 3, 0.8, 6, 2.0),
    trait: {
      name: '회장님의 접대', desc: '요리받은 아군의 기술 쿨다운 -2초.',
      effect: { hooks: { onInflict(_b, _u, t, s) { if (s.key === 'sup.mao' && t.skill) t.cd -= 2; } } },
    },
    specialAugs: [
      sp('mao', 'bar', '펜트하우스 바', '요리를 2명에게 낸다 (가장 강한 아군 2명).', setSk((s) => { s.count = 2; })),
      sp('mao', 'contract', '서명은 여기에', '요리받은 아군이 6초간 피해량 경감 20%.', setSk((s) => { s.red = 0.2; })),
      sp('mao', 'yukata', '사이버 유카타', '전투 시작 시 모든 호이슌 · 스텔라레이서 아군 피해 +20% (전투 동안).', { hooks: { onStart(b, u) {
        for (const a of b.alliesOf(u)) if (a.synergies.has('HOI') || a.synergies.has('STL')) a.mods.push(inc('all', 0.2));
      } } }),
    ],
  },
  skadi: {
    ctype: 'VAN', ttype: 'divine', faith: 'index', weapon: K('결재 서류 가방', 'elec', 0.9, 1, 1.0, 3),
    trait: {
      name: '인재 육성', desc: '전투 시작 시 공명 등급이 가장 낮은 다른 출전 아군에게 전투 동안 피해 +30%, 피해량 경감 15%.',
      effect: { hooks: { onStart(b, u) {
        const pool = b.alliesOf(u, false).filter((a) => a.src && !a.isSummon);
        if (!pool.length) return;
        const t = pool.reduce((a, c) => ((c.src!.rank < a.src!.rank) ? c : a));
        b.buff(u, t, 'skadi.mentee', 999, { mods: [inc('all', 0.3 + (u.mem.skadiMentor || 0))], taken: [red('all', 0.15)], label: '인재 육성' });
      } } },
    },
  },
};
