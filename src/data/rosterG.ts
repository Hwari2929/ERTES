// 5차 확장: 청라공국 (lore/지역/제국/아카시.md 의 고대 청라공국) 9명 + 헬레니우스 동맹 미노스.
//  기본 정의(명단) + 리워크 정보(무기 · 특성 · 유형)를 한 파일에 둔다 (rosterF 와 같은 형식).
//  · 무휼: 공왕 (청라공국 시너지가 소환, 영입 · 판매 · 공명도 없음, 인과 단계로 성장 — data/chungra.ts)
//  · 궁오: 사건 전용 (영입 · 시작 기물 제외). 얻는 사건은 아직 없다 (대본은 docs/SCENES.md 지침으로 따로)
import type { Battle, CUnit } from '../engine/combat';
import { type AugDef, type Effect, inc, red, vuln } from '../engine/effects';
import type { CType, Elem, Weapon } from '../types';
import { CAUSAL, causalStage, KING } from './chungra';
import { every, gw, isHarmful, pct, poison, skillHit, summonsOf } from './kit';
import { addBurn } from './psionic';
import { cookPower, pickEnemy } from './tpl';
import { B, type BaseUnit, type ReworkDef, setSk, SUMMON_RT, type SummonDef, uaug } from './unitkit';

const G = (name: string, elem: Elem, interval: number, range: number, mult: number, mag: number, reload: number): Weapon =>
  ({ name, kind: 'mag', type: 'shoot', elem, interval, range, mult, mag, reload });
const K = (name: string, elem: Elem, interval: number, range: number, mult: number, combo: number): Weapon =>
  ({ name, kind: 'combo', type: 'strike', elem, interval, range, mult, combo });
const sp = (owner: string, id: string, name: string, desc: string, effect: Effect): AugDef =>
  ({ ...uaug(owner, `sp.${id}`, name, desc, effect), pool: 'special' });
const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
/** 이로운 효과 제거 (버프형 중 해로운 것 제외) */
const stripBuffs = (b: Battle, e: CUnit) => {
  const n0 = e.statuses.length;
  e.statuses = e.statuses.filter((s) => !(s.type === 'buff' && !isHarmful(s)));
  if (e.statuses.length < n0) b.emit({ k: 'status', id: e.id, name: '강화 해제' });
};
/** from 에서 시작해 radius 칸 안의 적에게 튀는 바운스 (아직 안 맞은 적 먼저, 없으면 직전 대상만 빼고) */
function bounce(b: Battle, u: CUnit, from: CUnit, hops: number, radius: number, dmg: number, elem: Elem, onHit?: (e: CUnit) => void) {
  const hit = new Set<CUnit>([from]);
  let at: CUnit = from, last: CUnit = from;
  for (let i = 0; i < hops; i++) {
    const near = b.around(at, radius, b.enemiesOf(u)).filter((e) => e !== last && e.alive);
    const fresh = near.filter((e) => !hit.has(e));
    const next = b.nearest(at, fresh.length ? fresh : near);
    if (!next) break;
    hit.add(next);
    b.emit({ k: 'atk', from: at.id, to: next.id, elem, ranged: true, chain: true });
    const r = b.dealDamage(u, next, dmg, { elem, tag: 'proc', kind: 'tech' });
    if (r.amount > 0) onHit?.(next);
    if (r.killed) u.mem.bounceKill = (u.mem.bounceKill || 0) + 1;
    at = next; last = next;
  }
}

const CHR_PAL = ['#0c1014', '#2f7a8a', '#d8e4ea', '#e8c8a8', '#7fe3ff', '#4a5a60', '#ffffff'];
const tint = (primary: string, secondary?: string, visor?: string, base = CHR_PAL) => { const p = base.slice(); p[1] = primary; if (secondary) p[2] = secondary; if (visor) p[4] = visor; return p; };
const HEL_PAL = ['#0b1614', '#2fa39a', '#e8eef0', '#d8b090', '#b07cff', '#4f6866', '#ffffff'];

/** 무휼의 전투 유형: 사용자 확인 중 (처음엔 명사수, 이번 정의는 지휘관). 'MARK' 로 바꾸면 명사수 — 이 한 줄만 바꾸면 된다
 *  (천명 기록 · 궁극기는 b.P(u, 'shoot') 라서 지휘관이면 전술 위력, 명사수면 사격 위력을 쓴다) */
export const MUHYUL_CTYPE: CType = 'CMD';

/** 농업 드론 · 저승청 관료 (주기적으로 더 불려 나오는 단짝 소환물) */
const DRONE: SummonDef = { name: '농업 드론', ctype: 'SPEC', art: 'sm_farmdrone', sprite: 'drone', palette: tint('#7ac84a', '#e8e0c0', '#ffe14d'), atk: { type: 'shoot', elem: 'phys', interval: 1.5 }, range: 3, hpMul: 0.6 };
const CLERK: SummonDef = { name: '저승청 관료', ctype: 'SPEC', art: 'sm_hadesclerk', sprite: 'robe', palette: tint('#2a2a34', '#c8ccd8', '#ffd84d', HEL_PAL), atk: { type: 'shoot', elem: 'holy', interval: 1.2 }, range: 3, hpMul: 0.8 };
/** 클로버 농작물 (드론 1기당 주기 · 회복 계수 = 드론 기술 위력 대비 · 요리 배율) */
export const CROP = { every: 3, heal: 1.5 };
/** 미노스: 관료 추가 소환 주기 · 최대 · 공포 확률 */
export const CLERKS = { every: 10, max: 3, fear: 0.25 };

/** 소환물에 훅을 한 번 붙인다 (주기적으로 새로 생기므로 매 틱 확인) */
const tagPets = (b: Battle, u: CUnit, key: string, f: (pet: CUnit) => void) => { for (const pet of summonsOf(b, u)) if (!pet.mem[key]) { pet.mem[key] = 1; f(pet); } };
/** 드론: 공격하지 않고 CROP.every 초마다 체력 비율이 가장 낮은 아군에게 농작물 (회복 · 요리 배율) */
function droneInit(owner: CUnit, pet: CUnit) {
  pet.noAttack = true;
  pet.hooks.push({ onTick(bb, self, dt) {
    if (!every(self, 'cropT', dt, CROP.every, 1)) return;
    const l = bb.lowestHpAlly(self);
    if (!l) return;
    const k = owner.sk.crop || CROP.heal;
    bb.emit({ k: 'atk', from: self.id, to: l.id, elem: 'phys', ranged: true });
    bb.heal(self, l, bb.S(self, 'tech') * k * cookPower(owner));
    if (owner.sk.cropShield) bb.shield(l, bb.S(l, 'maxHp') * owner.sk.cropShield);
    if (owner.sk.pest && (self.mem.cropN = (self.mem.cropN || 0) + 1) % 3 === 0) { // 농약 살포: 3번째마다 가장 가까운 적
      const e = bb.nearest(self, bb.enemiesOf(self));
      if (e) { bb.dealDamage(self, e, bb.S(self, 'tech') * 0.8, { elem: 'chem', tag: 'proc', kind: 'tech' }); if (e.alive) poison(bb, self, e, bb.S(self, 'tech') * 0.2, 4, 1); }
    }
  } });
}

export const ROSTER_G: BaseUnit[] = [
  {
    id: 'muhyul', name: '무휼', title: '청라공국 마지막 공왕 · 기록의 주체', factions: [], traits: ['KING'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 5, base: B(7, 8, 8, 5, 6),
    sprite: 'soldier', palette: tint('#b8282e', '#e0b040', '#7fe3ff'),
    king: true, eventOnly: true, noStarter: true, noBar: true,
    lore: '"본좌가 쓰러지면 이 기록도 처음으로 돌아간다. 그러니 이번에는 끝까지 쓴다."',
    skill: {
      name: '천명 기록', tag: (p) => (p.radius ? '광역 물리 공격 + 기록' : '강적 물리 공격 + 기록'), cd: 7,
      params: { mult: 2.4, vuln: 0.15, radius: 0, hits: 1, second: 0.7, final: 0, refund: 0 },
      desc: (p) => `가장 튼튼한 적에게 기록의 화살을 쏴 ${MUHYUL_CTYPE === 'CMD' ? '전술 위력' : '사격 위력'} ${pct(p.mult * (p.final ? 1.5 : 1))} 물리 피해${p.radius ? ` (대상 주변 ${p.radius}칸)` : ''}${p.hits > 1 ? `를 ${p.hits}번 (두 번째부터 ${pct(p.second)})` : ''}, 맞은 적에게 6초간 [기록]: 받는 피해 +${pct(p.vuln)}.${p.refund ? ` [기록]된 적이 쓰러지면 쿨다운 ${pct(p.refund)} 환급.` : ''}`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'strongest');
        if (!t) return false;
        const p = u.sk;
        const victims = p.radius ? b.around(t, p.radius, b.enemiesOf(u)) : [t];
        if (p.radius) b.fx(t.x, t.y, p.radius, 'phys');
        for (let h = 0; h < (p.hits || 1); h++) for (const v of victims) {
          if (!v.alive) continue;
          b.emit({ k: 'atk', from: u.id, to: v.id, elem: 'phys', ranged: true });
          const r = b.dealDamage(u, v, b.P(u, 'shoot') * p.mult * (h ? p.second : 1) * (p.final ? 1.5 : 1), { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: true });
          if (v.alive) b.applyStatus(u, v, { type: 'buff', key: 'king.rec', dur: 6, taken: [vuln('all', p.vuln)], label: '기록' });
          else if (r.killed && p.refund) u.cd = Math.min(u.cd, u.cdMax * (1 - p.refund));
        }
        return true;
      },
    },
  },
  {
    id: 'dobin', name: '도빈', title: '송문 우주공항 정비 기술자', factions: ['CHR'], traits: ['ENG'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'elec', interval: 1.0 }, range: 4, base: B(6, 5, 9, 5, 5),
    sprite: 'soldier', palette: tint('#3a4458', '#ffb040', '#7fe3ff'), noBar: true,
    lore: '"셔틀은 또 띄우면 돼요. 이번엔 대못부터 제대로 박고요."',
    skill: {
      name: '대못 고정', tag: () => '빠른 적 신성 공격 + 밀쳐내기 · 고정', cd: 7, params: { mult: 1.6, root: 2, rootChance: 0.4 },
      desc: (p) => `기동력이 가장 높은 적 2명 (적이 1명이면 그 적에게 2번)에게 대못을 박아 기술 위력 ${pct(p.mult)} 신성 피해, 1칸 밀쳐내고 ${pct(p.rootChance)} 확률로 ${p.root}초 [고정] (움직일 수 없음).`,
      cast(b, u) {
        const es = b.targetable(u);
        if (!es.length) return false;
        const p = u.sk;
        const fast = es.slice().sort((a, c) => b.S(c, 'moveSpd') - b.S(a, 'moveSpd'));
        const ts = fast.length >= 2 ? fast.slice(0, 2) : [fast[0], fast[0]];
        for (const t of ts) {
          if (!t.alive) continue;
          b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'holy', ranged: true });
          skillHit(b, u, t, 'tech', p.mult, 'holy');
          if (!t.alive) continue;
          b.knockback(u, t);
          if (t.alive) b.applyStatus(u, t, { type: 'buff', key: 'root', dur: p.root, label: '고정' }, p.rootChance);
        }
        return true;
      },
    },
  },
  {
    id: 'siu', name: '시우', title: '별무리 학자 · 임씨 가문', factions: ['CHR'], traits: ['OCCULT', 'DECOMP'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 0.9 }, range: 3, base: B(5, 5, 10, 4, 6),
    sprite: 'robe', palette: tint('#2a5ab8', '#e8eef8', '#5ad08a'), noBar: true,
    lore: '"별의 흐름은 이미 적혀 있어요. 저는 그걸 읽을 뿐이고… 가끔은 고쳐 쓰고 싶어질 뿐이에요."',
    skill: {
      name: '눈물의 해독', tag: () => '화학 공격 + 바운스', cd: 6.5, params: { mult: 2.9, bounce: 3, bk: 0.5, radius: 2 },
      desc: (p) => `대상에게 기술 위력 ${pct(p.mult)} 화학 피해. 이어서 기술 위력 ${pct(p.bk)} 계수의 화학 속성 피해가 ${p.radius}칸 내의 적에게 최대 ${p.bounce}회 바운스된다 (공명 등급 4등급마다 +1회).`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'current');
        if (!t) return false;
        const p = u.sk;
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'chem', ranged: true });
        skillHit(b, u, t, 'tech', p.mult, 'chem');
        u.mem.bounceKill = 0;
        const hops = p.bounce + Math.floor((u.src?.rank || 1) / 4);
        bounce(b, u, t, hops, p.radius, b.P(u, 'tech') * p.bk, 'chem', p.tears ? (e) => poison(b, u, e, b.S(u, 'tech') * 0.15, 4, 1) : undefined);
        if (p.final && u.mem.bounceKill) bounce(b, u, t, Math.min(3, u.mem.bounceKill), p.radius, b.P(u, 'tech') * p.bk, 'chem');
        return true;
      },
    },
  },
  {
    id: 'jaehwon', name: '재훤', title: '수렵회 절멸파 수장', factions: ['CHR'], traits: ['HUNTER', 'COND'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.2 }, range: 5, base: B(6, 9, 5, 4, 6),
    sprite: 'soldier', palette: tint('#4a3a2a', '#ff8ab0', '#ffd040'), noBar: true,
    lore: '"범이든 사람이든, 송향 냄새를 풍기면 쏜다. 그게 절멸파다."',
    skill: {
      name: '절멸 사격', tag: () => '약한 적 5연사 물리 공격', cd: 8, params: { mult: 0.9, hits: 5, refund: 0.7 },
      desc: (p) => `체력이 가장 낮은 적에게 사격 위력 ${pct(p.mult)} 물리 피해를 ${p.hits}번. 도중에 대상이 쓰러지면 남은 사격을 멈추고 쿨다운 ${pct(p.refund)} 환급.`,
      cast(b, u) {
        const es = b.targetable(u);
        if (!es.length) return false;
        const t = es.reduce((a, c) => (c.hp < a.hp ? c : a));
        const p = u.sk;
        for (let i = 0; i < p.hits; i++) {
          if (!t.alive) break;
          b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
          const r = skillHit(b, u, t, 'shoot', p.mult, 'phys', { critBonus: u.mem.jhCrit || 0 });
          if (r.killed) { u.cd = Math.min(u.cd, u.cdMax * (1 - p.refund)); break; }
        }
        return true;
      },
    },
  },
  {
    id: 'juseong', name: '주성', title: '연현문 출신 유랑 검객', factions: ['CHR'], traits: ['GUARD'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(10, 9, 3, 9, 4),
    sprite: 'knight', palette: tint('#1a1a22', '#2f6a4a', '#e8c8a8'), noBar: true,
    lore: '"물자는 훔쳤다. 왕자는 지켰다. 어느 쪽을 먼저 따질 텐가."',
    skill: {
      name: '설원 검무', tag: () => '주변 광역 물리 공격 + 피해량 감소', cd: 7, params: { mult: 2.0, radius: 1, weak: 0.3, dur: 4 },
      desc: (p) => `낡은 대검을 휘둘러 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 물리 피해, ${p.dur}초간 맞은 적이 가하는 피해 -${pct(p.weak)}.`,
      cast(b, u) {
        const p = u.sk;
        const vs = b.around(u, p.radius, b.enemiesOf(u));
        if (!vs.length) return false;
        b.fx(u.x, u.y, p.radius, 'phys');
        for (const v of vs) {
          skillHit(b, u, v, 'strike', p.mult, 'phys');
          if (v.alive) b.applyStatus(u, v, { type: 'buff', key: 'weaken', dur: p.dur, mods: [inc('all', -p.weak)], label: '피해량 감소' });
        }
        return true;
      },
    },
  },
  {
    id: 'clover', name: '클로버', title: '광양축산공사 자동화 AI 비서', factions: ['CHR'], traits: ['BUDDY', 'CHEF'], keywords: ['mech'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 2, base: B(8, 7, 7, 9, 2),
    sprite: 'drone', palette: tint('#3a8a3a', '#e8f0e0', '#9af0a0'), noBar: true, front: true,
    summon: DRONE,
    lore: '"유통 체계는 준수됩니다. 창고에 들어오신 분은 소각됩니다. 오늘의 작물은 송향초입니다."',
    skill: {
      name: '출하 지시', tag: () => '농업 드론 추가 + 농작물', cd: 8, params: { cap: 2, crop: CROP.heal },
      desc: (p) => `농업 드론을 1기 더 부른다 (최대 ${p.cap}기). 드론마다 곧바로 체력 비율이 가장 낮은 아군에게 농작물을 던져 드론 기술 위력 ${pct(p.crop)} × 요리 배율 회복.`,
      cast(b, u) {
        const p = u.sk;
        const pets = summonsOf(b, u);
        if (pets.length < p.cap) { const d = SUMMON_RT.make?.(b, u, DRONE); if (d) pets.push(d); }
        for (const d of pets) d.mem.cropT = 0; // 바로 던진다
        return pets.length > 0;
      },
    },
  },
  {
    id: 'hana', name: '한아', title: '녹림의원 임시 원장 · 무당', factions: ['CHR'], traits: ['OCCULT'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'psy', interval: 1.0 }, range: 2, base: B(5, 4, 10, 4, 7),
    sprite: 'robe', palette: tint('#1a1a24', '#e8e8f0', '#7fb8ff'), noBar: true,
    lore: '"녹림의원은 찾아온 손님을 거절하지 않아요. 범이라도요. 총부터 내리시죠, 사냥꾼 양반."',
    skill: {
      name: '해주굿', tag: () => '광역 정신 공격 + 위치 교란', cd: 7, params: { mult: 1.7, radius: 2, swap: 0.35 },
      desc: (p) => `대상과 대상 주변 ${p.radius}칸 적에게 전술 위력 ${pct(p.mult)} 정신 피해. 맞은 적마다 ${pct(p.swap)} 확률로 그 범위 안 무작위 빈칸으로 옮기고 이로운 효과를 모두 없앤다.`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'current');
        if (!t) return false;
        const p = u.sk;
        const cx = t.x, cy = t.y;
        b.fx(cx, cy, p.radius, 'psy');
        for (const e of b.around(t, p.radius, b.enemiesOf(u))) {
          skillHit(b, u, e, 'tech', p.mult, 'psy');
          if (!e.alive || !b.rng.chance(p.swap * (1 + b.S(u, 'effHit') - b.S(e, 'effRes')))) continue;
          stripBuffs(b, e);
          if (e.isBoss || e.immobile) continue;
          const cells: { x: number; y: number }[] = [];
          for (let dy = -p.radius; dy <= p.radius; dy++) for (let dx = -p.radius; dx <= p.radius; dx++) {
            const x = cx + dx, y = cy + dy;
            if (b.inBounds(x, y) && !b.unitAt(x, y)) cells.push({ x, y });
          }
          if (cells.length) { const c = b.rng.pick(cells); b.relocate(u, e, c.x, c.y, 'move'); b.emit({ k: 'status', id: e.id, name: '위치 교란', src: u.id, harm: true, stype: 'knock' }); }
        }
        return true;
      },
    },
  },
  {
    id: 'gayoung', name: '가영', title: '임씨 가문 · 흰 옷의 무녀', factions: ['CHR'], traits: ['NAV', 'INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 0.8 }, range: 1, base: B(8, 8, 6, 6, 7),
    sprite: 'robe', palette: tint('#f0f0f0', '#c8303a', '#ffd84d'), noBar: true,
    lore: '"춤이 끝나면 칼이 들어가요. 순서가 바뀌면… 그건 춤이 아니라 그냥 칼부림이고요."',
    ace: {
      name: '해원의 칼끝', desc: (k) => `백무 해원 피해 +${pct(0.2 * k)}, 실명한 적에게 주는 피해 +${pct(0.1 * k)}.`,
      effect: (k) => ({ mods: [inc('skill', 0.2 * k)], hooks: { dmgMult: (_b, _u, t) => (t.statuses.some((s) => s.key === 'blind') ? 1 + 0.1 * k : 1) } }),
    },
    skill: {
      name: '백무 해원', tag: () => '신성 공격 + 실명', cd: 7, params: { mult: 1.6, radius: 1, hp: 0.08, cap: 4, blind: 0.3, dur: 3 },
      desc: (p) => `대상과 대상 주변 ${p.radius}칸 적에게 타격 위력 ${pct(p.mult)} 신성 피해 + 대상 최대 체력 ${pct(p.hp)} 신성 피해 (타격 위력 ${pct(p.cap)} 상한), ${p.dur}초간 [실명]: 명중 -${pct(p.blind)}p.`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'current');
        if (!t) return false;
        const p = u.sk;
        b.fx(t.x, t.y, p.radius, 'holy');
        for (const e of b.around(t, p.radius, b.enemiesOf(u))) {
          skillHit(b, u, e, 'strike', p.mult, 'holy');
          if (!e.alive) continue;
          b.dealDamage(u, e, Math.min(b.S(e, 'maxHp') * p.hp, b.P(u, 'strike') * p.cap), { elem: 'holy', tag: 'skill', kind: 'strike', canMiss: false });
          if (e.alive) b.applyStatus(u, e, { type: 'buff', key: 'blind', dur: p.dur, delta: { acc: -p.blind }, label: '실명' });
        }
        return true;
      },
    },
  },
  {
    id: 'gungo', name: '궁오', title: '전등사의 산군', factions: ['CHR'], traits: ['SANGUN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(11, 9, 6, 7, 6),
    sprite: 'beast', palette: tint('#e07a1f', '#2a2a2a', '#ffd84d'), eventOnly: true, noStarter: true, noBar: true,
    lore: '"기름은 내가 닦는다. 너희는 그 왕자 놈이 어디로 갔는지만 대라."',
    skill: {
      name: '궤도 화승포', tag: () => '광역 물리 포격 + 연소', cd: 9, params: { mult: 2.2, radius: 1, burn: 2 },
      desc: (p) => `전등사의 패널로 화승포를 불러 적이 가장 많이 모인 곳 주변 ${p.radius}칸에 타격 위력 ${pct(p.mult)} 물리 피해 + 연소 ${p.burn}중첩.`,
      cast(b, u) {
        const es = b.targetable(u);
        if (!es.length) return false;
        const p = u.sk;
        const c = es.slice().sort((a, z) => b.around(z, p.radius, es).length - b.around(a, p.radius, es).length)[0];
        b.fx(c.x, c.y, p.radius, 'phys');
        for (const e of b.around(c, p.radius, b.enemiesOf(u))) {
          skillHit(b, u, e, 'strike', p.mult, 'phys', { noMiss: true });
          if (e.alive) addBurn(b, u, e, p.burn);
        }
        return true;
      },
    },
  },
  {
    id: 'minos', name: '미노스', title: '크레타 대집행관', factions: ['HEL'], traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.0 }, range: 3, base: B(6, 4, 10, 5, 5),
    sprite: 'robe', palette: tint('#1a1a22', '#9aa3b8', '#b07cff', HEL_PAL), noBar: true,
    summon: CLERK,
    lore: '"접수 번호 없이 오셨군요. 괜찮습니다. 대기열은 언제나 줄어듭니다."',
    skill: {
      name: '대기열 정리', tag: () => '약한 적 정신 공격 + 관료 일제 사격', cd: 7, params: { mult: 2.3, exec: 0.3, clerk: 0.8 },
      desc: (p) => `체력 비율이 가장 낮은 적에게 기술 위력 ${pct(p.mult)} 정신 피해 (대상 체력이 ${pct(p.exec)} 이하면 [접수 완료]: 피해 ×2, 보스 제외). 살아 있는 저승청 관료마다 같은 대상에게 관료 기술 위력 ${pct(p.clerk)} 신성 피해.`,
      cast(b, u) {
        const t = pickEnemy(b, u, 'lowest');
        if (!t) return false;
        const p = u.sk;
        const done = !t.isBoss && b.hpPct(t) <= p.exec;
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'psy', ranged: true });
        skillHit(b, u, t, 'tech', p.mult * (done ? 2 : 1), 'psy');
        if (done) b.emit({ k: 'status', id: t.id, name: '접수 완료' });
        for (const c of summonsOf(b, u)) {
          if (!t.alive) break;
          b.emit({ k: 'atk', from: c.id, to: t.id, elem: 'holy', ranged: true });
          b.dealDamage(c, t, b.S(c, 'tech') * p.clerk, { elem: 'holy', tag: 'proc', kind: 'tech', canMiss: false });
        }
        return true;
      },
    },
  },
];

/** 리워크 정보 */
export const REWORK_G: Record<string, ReworkDef> = {
  muhyul: {
    ctype: MUHYUL_CTYPE, ttype: 'major', faith: 'human', weapon: G('공왕의 각궁', 'phys', 1.1, 5, 1.1, 6, 1.8),
    trait: {
      name: '기록의 주체',
      desc: `공명도를 받지 않고, 승리할 때마다 모은 인과율로 성장한다 (인과 단계 1~${CAUSAL.max}). 단계마다 모든 주요 능력치 · 위력 · 주는 피해 · 최대 체력${MUHYUL_CTYPE === 'CMD' ? ' · 전술 위력' : ''}이 오르고, 4 · 7 · 10단계에 천명 기록이 강해진다. 전투당 1회 쓰러질 피해를 받으면 필서가 기록을 되감아 체력 40%로 버틴다.`,
      effect: {
        setup(u, _b, ctx) {
          const n = causalStage(ctx?.run?.causal || 0);
          u.mem.kingStage = n;
          u.mods.push(inc('all', KING.dmg(n)));
          u.st.maxHp *= 1 + KING.hp(n);
          u.mem.tacPct = (u.mem.tacPct || 0) + KING.tacBase + KING.tac(n); // 지휘관: 전술 위력도 단계마다 (명사수면 쓰이지 않음)
          if (n >= KING.ms[0]) u.sk.radius = 1;
          if (n >= KING.ms[1]) { u.sk.hits = 2; u.sk.vuln = 0.25; }
          if (n >= KING.ms[2]) { u.sk.final = 1; u.sk.refund = 0.5; }
        },
        hooks: {
          onStart(b, u) { if ((u.mem.kingStage || 1) >= KING.ms[2]) for (const a of b.alliesOf(u)) b.buff(u, a, 'king.last', 999, { mods: [inc('all', 0.15)], label: '마지막 공왕' }); },
          onLethal(b, u) {
            if (u.mem.rewound) return false;
            u.mem.rewound = 1;
            u.hp = b.S(u, 'maxHp') * 0.4;
            b.emit({ k: 'mark', id: u.id, name: '기록 되감기', style: 'rewind' });
            return true;
          },
        },
      },
    },
  },
  dobin: {
    ctype: 'SPEC', ttype: 'divine', faith: 'science', weapon: G('대못 발사기', 'elec', 1.0, 4, 1.0, 8, 1.8),
    trait: {
      name: '현장 감독', desc: '엔지니어 시너지로 설치된 감시 포탑이 피해를 줄 때마다 그 피해의 15%만큼 신성 피해를 더한다.',
      effect: { hooks: { onTick(b, u) {
        for (const tr of b.alliesOf(u)) {
          if (tr.defId !== 'turret' || tr.mem.dobin) continue;
          tr.mem.dobin = 1;
          tr.hooks.push({ onDeal(bb, self, tgt, r, o) {
            if (r.amount <= 0 || o.noHooks || !tgt.alive || bb.sideOf(tgt) === bb.sideOf(self)) return;
            bb.dealDamage(self, tgt, r.amount * 0.15, { elem: 'holy', tag: 'proc', noHooks: true });
          } });
        }
      } } },
    },
  },
  siu: {
    ctype: 'SPEC', ttype: 'special', faith: 'human', weapon: G('호신용 권총', 'phys', 0.9, 3, 0.9, 8, 1.6),
    trait: {
      name: '기록에게 읽힌 자', desc: '기본 공격이 맞으면 30% 확률로 기술 위력 50% 계수의 화학 속성 피해가 2칸 내의 적에게 최대 1회 바운스된다. 공명 등급 4등급마다 [눈물의 해독] 바운스 +1회.',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (r.amount <= 0 || !b.rng.chance(0.3 + (u.mem.siuTrigger || 0))) return;
        bounce(b, u, t, 1 + (u.mem.siuHop || 0), u.sk.radius || 2, b.S(u, 'tech') * (u.sk.bk || 0.5), 'chem');
      } } },
    },
    specialAugs: [
      sp('siu', 'record', '필서 연구', '바운스 계수 50% → 75% (눈물의 해독 · 기본 공격 바운스).', setSk((s) => { s.bk = 0.75; })),
      sp('siu', 'scope', '천구 지팡이', '바운스 범위 2 → 3칸, 눈물의 해독 바운스 +1회.', setSk((s) => { s.radius = 3; s.bounce += 1; })),
      sp('siu', 'tears', '흘러내린 기록', '눈물의 해독 바운스가 맞힌 적에게 중독 (4초, 초당 기술 위력 15%).', setSk((s) => { s.tears = 1; })),
      sp('siu', 'trigger', '호신술', '기본 공격 바운스 확률 30% → 60%, 바운스 +1회.', { setup: (u) => { u.mem.siuTrigger = 0.3; u.mem.siuHop = 1; } }),
      sp('siu', 'lab', '궤도 연구소', '쿨다운 감소 속도 +30%, 정신력 +6.', { stats: { cdr: 0.3 }, majors: { mnd: 6 } }),
      sp('siu', 'devotion', '일방적인 마음', '전투 시작 시 공왕 무휼이 있으면 무휼의 피해 +25% (전투 동안). 없으면 자신의 피해 +10%.', { hooks: { onTick(b, u) {
        if (u.mem.siuDev) return;
        u.mem.siuDev = 1;
        const k = b.alliesOf(u).find((a) => a.defId === 'muhyul');
        if (k) b.buff(u, k, 'siu.devotion', 999, { mods: [inc('all', 0.25)], label: '일방적인 마음' });
        else u.mods.push(inc('all', 0.1));
      } } }),
      sp('siu', 'melt', '녹는 기록', '눈물의 해독 주 대상이 6초간 받는 화학 피해 +20%.', { hooks: { onDeal(b, u, t, r, o) {
        if (o.tag === 'skill' && r.amount > 0 && t.alive) b.applyStatus(u, t, { type: 'buff', key: 'siu.melt', dur: 6, taken: [vuln('chem', 0.2)], label: '녹는 기록' });
      } } }),
      sp('siu', 'final', '마지막 기록', '눈물의 해독 바운스로 적을 쓰러뜨리면, 쓰러뜨린 수만큼 (최대 3회) 바운스를 다시 한다.', setSk((s) => { s.final = 1; })),
    ],
  },
  jaehwon: {
    ctype: 'MARK', ttype: 'minor', faith: 'human', weapon: G('수렵총', 'phys', 1.2, 5, 1.3, 5, 2.2),
    trait: {
      name: '절멸파 수장', desc: '사격(기본 공격 · 전투 스킬) 치명타가 적중하면 전투 스킬 쿨다운 -0.5초. 전투 스킬의 치명타 확률 +15%p.',
      effect: {
        setup: (u) => { u.mem.jhCrit = 0.15 * gw(u); },
        hooks: { onDeal(_b, u, _t, r, o) { if (r.crit && o.kind === 'shoot' && (o.tag === 'basic' || o.tag === 'skill')) u.cd = Math.max(0, u.cd - 0.5); } },
      },
    },
  },
  juseong: {
    ctype: 'VAN', ttype: 'major', faith: 'human', weapon: K('낡은 대검', 'phys', 1.0, 1, 1.0, 3),
    trait: {
      name: '연현문 검객', desc: '피니쉬가 맞으면 대상을 1칸 밀쳐내고 30% 확률로 1초 기절시킨다.',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (!u.mem.finished || r.miss || !t.alive) return;
        b.knockback(u, t);
        if (t.alive) b.stun(u, t, 1, 0.3);
      } } },
    },
  },
  clover: {
    ctype: 'MARK', ttype: 'special', faith: 'science', weapon: G('수확용 회전날', 'phys', 1.1, 2, 0.8, 8, 1.8),
    trait: {
      name: '광양 관리 AI', desc: '움직이지 않는다. 방어도 +60%. 기본 공격이 대상과 함께 2칸 안의 다른 적 모두에게 사격 위력 60% 물리 피해를 주고, 맞은 적마다 25% 확률로 연소 1중첩. 농업 드론은 공격하지 않고 3초마다 체력 비율이 가장 낮은 아군에게 농작물을 던져 회복시킨다 (요리 배율).',
      effect: {
        pct: { armor: 0.6 },
        setup: (u) => { u.immobile = true; },
        hooks: {
          onBasic(b, u, t, r) {
            if (!r.miss && t.alive) addBurn(b, u, t, 1, 0.25 + (u.mem.cloverBurn || 0));
            for (const e of b.around(u, 2, b.enemiesOf(u))) {
              if (e === t || !e.alive) continue;
              const x = b.dealDamage(u, e, b.S(u, 'shoot') * 0.6, { elem: 'phys', tag: 'proc', kind: 'shoot' });
              if (x.amount > 0 && e.alive) addBurn(b, u, e, 1, 0.25 + (u.mem.cloverBurn || 0));
            }
          },
          onTick(b, u) { tagPets(b, u, 'crop', (pet) => droneInit(u, pet)); },
        },
      },
    },
    specialAugs: [
      sp('clover', 'fleet', '드론 증차', '농업 드론 최대 2 → 3기.', setSk((s) => { s.cap = 3; })),
      sp('clover', 'harvest', '풍년', '농작물 회복 +40%.', setSk((s) => { s.crop *= 1.4; })),
      sp('clover', 'greenhouse', '비닐하우스', '농작물을 받은 아군에게 최대 체력 5% 보호막.', setSk((s) => { s.cropShield = 0.05; })),
      sp('clover', 'incinerate', '소각 규정', '연소 확률 25% → 50%.', { setup: (u) => { u.mem.cloverBurn = 0.25; } }),
      sp('clover', 'quota', '출하 할당량', '출하 지시 쿨다운 -2초.', { setup: (u) => { u.cdMax = Math.max(1, u.cdMax - 2); } }),
      sp('clover', 'pesticide', '농약 살포', '드론이 농작물 3번째마다 가장 가까운 적에게 드론 기술 위력 80% 화학 피해 + 중독 (4초, 초당 20%).', setSk((s) => { s.pest = 1; })),
      sp('clover', 'silo', '잠긴 창고', '방어도 +30%, 피해량 경감 10%.', { pct: { armor: 0.3 }, taken: [red('all', 0.1)] }),
      sp('clover', 'protocol', '유통 체계 준수', '요리 배율 +20% (농작물 회복에 적용).', { setup: (u) => { u.mem.cookBonus = (u.mem.cookBonus || 0) + 0.2; } }),
    ],
  },
  hana: {
    ctype: 'CMD', ttype: 'psionic', faith: 'human', weapon: K('부적', 'psy', 1.0, 2, 1.0, 3),
    trait: {
      name: '혼란한 땅', desc: '적이 자신이나 아군의 효과(밀쳐내기 · 끌어당기기 · 위치 교란 등)로 위치가 강제로 바뀌면 그 적에게 전술 위력 60% 정신 피해를 주고 30% 확률로 1.5초 공포 (대상당 0.4초에 1번).',
      effect: { hooks: { onDisplace(b, u, v, src) {
        if (!v.alive || b.sideOf(v) === b.sideOf(u) || b.sideOf(src) !== b.sideOf(u)) return;
        if (!icd(b, v, `hana${u.id}`, 0.4)) return;
        b.emit({ k: 'atk', from: u.id, to: v.id, elem: 'psy', ranged: true });
        b.dealDamage(u, v, b.P(u, 'tech') * 0.6, { elem: 'psy', tag: 'proc', kind: 'tech', canMiss: false });
        if (v.alive) b.applyStatus(u, v, { type: 'fear', key: 'fear', dur: 1.5 }, 0.3);
        b.addReason(u, 2);
      } } },
    },
    psi: { desc: '해주굿 사용 시 이성 -8, [혼란한 땅] 발동마다 +2.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -8) } } },
  },
  gayoung: {
    ctype: 'VAN', ttype: 'divine', faith: 'human', weapon: K('무녀의 단도', 'holy', 0.8, 1, 0.9, 4),
    trait: {
      name: '흰 옷의 칼춤', desc: '자신과 1칸 안에 붙은 적의 회피 -15%p.',
      effect: { hooks: { onTick(b, u, dt) {
        if (!every(u, 'gyT', dt, 0.5, 0)) return;
        for (const e of b.around(u, 1, b.enemiesOf(u))) b.applyStatus(u, e, { type: 'buff', key: 'evadown', dur: 0.7, delta: { eva: -0.15 }, label: '' });
      } } },
    },
  },
  gungo: {
    ctype: 'VAN', ttype: 'psionic', faith: 'human', weapon: K('범의 발톱', 'phys', 0.9, 1, 1.0, 3),
    trait: {
      name: '범기름', desc: '기본 공격 · 전투 스킬이 맞으면 대상의 보호막을 절반 벗겨 낸다. 받는 정신 피해 -30%.',
      effect: { taken: [red('psy', 0.3)], hooks: { onDeal(_b, _u, t, r, o) { if ((o.tag === 'basic' || o.tag === 'skill') && r.amount > 0 && t.shield > 0) t.shield *= 0.5; } } },
    },
    psi: { desc: '피해를 받으면 이성 -1 (0.5초에 1번), 적을 처치하면 +8.', effect: { hooks: {
      onHurt(b, u) { if (icd(b, u, 'gungoR', 0.5)) b.addReason(u, -1); },
      onKill: (b, u) => b.addReason(u, 8),
    } } },
  },
  minos: {
    ctype: 'SPEC', ttype: 'psionic', faith: 'human', weapon: G('대집행 인장', 'psy', 1.0, 3, 0.9, 6, 1.8),
    trait: {
      name: '저승청 대집행관', desc: `${CLERKS.every}초마다 저승청 관료를 1기 더 부른다 (최대 ${CLERKS.max}기). 관료의 기본 공격은 ${pct(CLERKS.fear)} 확률로 1초 공포를 건다.`,
      effect: { hooks: { onTick(b, u, dt) {
        tagPets(b, u, 'clerk', (pet) => pet.hooks.push({ onBasic(bb, self, t, r) { if (r.amount > 0 && t.alive) bb.applyStatus(self, t, { type: 'fear', key: 'fear', dur: 1 }, CLERKS.fear); } }));
        if (!every(u, 'clerkT', dt, CLERKS.every) || !b.enemiesOf(u).length) return;
        if (summonsOf(b, u).length < CLERKS.max && SUMMON_RT.make?.(b, u, CLERK)) b.addReason(u, 4);
      } } },
    },
    psi: { desc: '대기열 정리 사용 시 이성 -6, 관료가 새로 불려 나오면 +4.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -6) } } },
  },
};
