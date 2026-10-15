// 시스템 리워크: 기물별 전투 유형 · 전술 유형 · 무기 · 고유 특성 · 성장 · 스페셜 증강 · 이성 규칙 · 신앙
import { CFG } from '../config';
import { type Battle, type CUnit, DIVINE_HOOK, type Hooks, type Status } from '../engine/combat';
import { type AugDef, type Effect, applyLive, inc, red, vuln } from '../engine/effects';
import { type CType, type Elem, type FaithId, FAITH_NAME, type Major, MAJORS, type RunState, type Weapon } from '../types';
import { itemEffect } from './items';
import { RELIC_BY_ID } from './relics';
import { blinkTo, corrode, every, fear, gw, isHarmful, lineTargets, nth, pct, skillHit, summonsOf } from './kit';
import { kairoSnipe } from './rosterB';
import { pickEnemy } from './tpl';
import { type BaseUnit, type ReworkDef, setSk, uaug } from './unitkit';

// ───────── 무기 헬퍼: G = 탄창형(사격), K = 콤보형(타격)
const G = (name: string, elem: Elem, interval: number, range: number, mult: number, mag: number, reload: number, x: Partial<Weapon> = {}): Weapon =>
  ({ name, kind: 'mag', type: 'shoot', elem, interval, range, mult, mag, reload, ...x });
const K = (name: string, elem: Elem, interval: number, range: number, mult: number, combo: number, x: Partial<Weapon> = {}): Weapon =>
  ({ name, kind: 'combo', type: 'strike', elem, interval, range, mult, combo, ...x });

const icd = (b: Battle, u: CUnit, key: string, sec: number) => {
  if ((u.mem[key] || 0) > b.t) return false;
  u.mem[key] = b.t + sec;
  return true;
};
const cnt = (u: CUnit, key: string, max: number) => { if ((u.mem[key] || 0) < max) u.mem[key] = (u.mem[key] || 0) + 1; };
const harmful = isHarmful;
const aura = (b: Battle, u: CUnit, r: number, key: string, p: Partial<Status>) => {
  for (const a of b.around(u, r, b.alliesOf(u))) b.applyStatus(u, a, { type: 'buff', key, dur: 0.7, ...p });
};
/** 반격 · 추가타 같은 부가 피해 */
const proc = (b: Battle, u: CUnit, t: CUnit, amt: number, elem: Elem, kind?: 'shoot' | 'strike' | 'tech') =>
  b.dealDamage(u, t, amt, { elem, tag: 'proc', kind });
const stack = (b: Battle, u: CUnit, t: CUnit, key: string, max: number, dur: number, make: (n: number) => Partial<Status>) => {
  const ex = t.statuses.find((s) => s.key === key);
  if (ex) { ex.stacks = Math.min(max, (ex.stacks || 1) + 1); ex.dur = dur; Object.assign(ex, make(ex.stacks)); return; }
  b.applyStatus(u, t, { type: 'dot', key, dur, stacks: 1, ...make(1) });
};

/** 마이너: 성장 배율 g 에 따른 특성 주요 수치 (상세 창 표시용, 특성 코드의 gw(u) 와 같은 식) */
export const MINOR_TRAIT_GROW: Record<string, (g: number) => string> = {
  chloe: (g) => `[항밈 처방] 중독 초당 기술 위력 ${pct(0.25 * g)}`,
  west: (g) => `[현장 반장] 포탑 추가 고정 피해 사격 위력 ${pct(0.15 * g)}`,
  orca: (g) => `[깜짝 마술] 기절 확률 ${pct(Math.min(0.6, 0.2 * g))}`,
  zahara: (g) => `[복수자] 반격 타격 위력 ${pct(1.5 * g)}`,
  demiurgos: (g) => `[친구의 손길] 피해량 경감 ${pct(Math.min(0.3, 0.1 * g))}`,
  vivian: (g) => `[생태 분석] 중첩당 방어도 -${pct(Math.min(0.2, 0.1 * g))}`,
  ingel: (g) => `[무대 위의 달] 아군 1명당 피해 +${pct(0.1 * g)} · 소환물당 +${pct(0.05 * g)}`,
  rasmus: (g) => `[가지치기] 부상 최대 ${Math.round(5 * g)}중첩`,
  sigmund: (g) => `[집사의 예법] 모시는 엘베스타드 모든 메이저 +${Math.round(5 * g)}`,
  gunnir: (g) => `[저택의 실세] 기술 후 아군 전원 회복 기술 위력 ${pct(0.25 * g)}`,
  bill: (g) => `[호쾌한 관광객] 해로운 효과 대상 피해 +${pct(0.1 * g)}`,
  eden: (g) => `[밑바닥 생존자] 체력 50% 이하 피해 +${pct(0.2 * g)}`,
  u404: (g) => `[1원칙] 기술마다 피해 +${pct(0.1 * g)} 중첩`,
};

// ───────── 성장 수치 조회
const gv = (g: Record<string, number>, k: string) => g[k] || 0;

// ───────── 스페셜 증강
const sp = (owner: string, id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef =>
  ({ ...uaug(owner, `sp.${id}`, name, desc, effect, extra), pool: 'special' });
/** 함께 제시하지 않는 증강 (같은 기물의 sp 키) */
const ex = (owner: string, ...keys: string[]): Partial<AugDef> => ({ excl: keys.map((k) => `${owner}.sp.${k}`) });
/** 소환물에 훅을 한 번 붙인다 (소환물은 전투 시작 훅에서 생기므로 첫 틱에) */
const petHook = (key: string, make: (owner: CUnit) => Hooks): Hooks => ({ onTick(b, u) {
  if (u.mem[key]) return;
  u.mem[key] = 1;
  for (const pet of summonsOf(b, u)) pet.hooks.push(make(u));
} });
/** 라르스: 이번 거래 대상 */
const dealTarget = (b: Battle, u: CUnit) => b.units.find((e) => e.alive && e.side !== u.side && e.id === u.mem.dealId) || null;

export const REWORK: Record<string, ReworkDef> = {
  // ───────────────────────── 성간 인류 연합
  yelena: {
    ctype: 'SPEC', ttype: 'psionic', faith: 'human', weapon: G('델타-9 제식 권총', 'psy', 0.95, 3, 1.0, 12, 1.5),
    factions: ['SEC'], traits: ['SCHEME'],
    trait: {
      name: '항밈 요원', desc: '사격이 정신 피해가 된다 (사격 피해량 -25%p). 정신 피해를 받은 적은 기술 쿨다운 +1초 (대상당 1초에 1회).',
      effect: {
        mods: [inc('shoot', -0.25)],
        hooks: { onDeal(b, _u, t, r, o) { if (o.elem === 'psy' && r.amount > 0 && t.skill && icd(b, t, 'yelIcd', 1)) t.cd += 1; } },
      },
    },
    psi: { desc: '항밈 소거 사용 시 이성 -8, 아군이 전투 스킬을 쓸 때 +2.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -8), onAllySkill: (b, u) => b.addReason(u, 2) } } },
  },
  mirinae: {
    ctype: 'MARK', ttype: 'major', faith: 'human', weapon: G('깜찍이', 'phys', 1.0, 5, 1.4, 4, 2.5),
    factions: ['UNI'], traits: ['HUNTER'],
    trait: {
      name: '물질주의 캠퍼', desc: '장착한 장비 · 개조부품 · 임시 장비 1개당 회피 · 치명타 확률 +2.5%p (최대 +15%p).',
      effect: { hooks: { onStart(_b, u) {
        const n = (u.src?.items.filter(Boolean).length || 0) + (u.src?.mod ? 1 : 0) + (u.tempItems?.length || 0);
        const v = Math.min(0.15, 0.025 * n);
        u.st.eva += v; u.st.crit += v;
      } } },
    },
  },
  gebek: {
    ctype: 'MARK', ttype: 'major', faith: 'human', weapon: G('헤비 버니', 'phys', 0.45, 4, 0.5, 40, 4.5),
    factions: ['UNI', 'STL'], traits: ['ENG'],
    trait: {
      name: '괴수', desc: '기본 공격이 맞으면 25% 확률로 [제압]: 대상의 다음 공격 피해가 1이 된다.',
      effect: { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive && b.rng.chance(0.25)) b.applyStatus(u, t, { type: 'buff', key: 'suppress', dur: 10, label: '제압' }); } } },
    },
  },
  donovan: {
    ctype: 'SPEC', ttype: 'special', faith: 'human', weapon: K('단분자 와이어', 'phys', 0.8, 1, 0.8, 4),
    factions: ['UNI', 'SEC'], traits: ['BUDDY'],
    trait: { name: '자안의 사수', desc: '기술 피해도 치명타가 터진다. 체력 비율이 가장 낮은 적을 우선 노린다. 까악이 공격 속도 +30%.', effect: {
      setup: (u) => { u.mem.techCrit = 1; u.mem.lowestFocus = 1; },
      hooks: { onTick(b, u) {
        if (u.mem.crowInit) return;
        u.mem.crowInit = 1;
        for (const d of summonsOf(b, u)) b.buff(u, d, 'donovan.crow', 999, { delta: { atkSpd: 0.3 }, label: '해킹 지원' });
      } },
    } },
    specialAugs: [
      sp('donovan', 'eye', '자안 개방', '기술 피해가 치명타로 터지면 기술 쿨다운 -1초.', { hooks: { onDeal(_b, u, _t, r, o) { if (r.crit && o.kind === 'tech') u.cd -= 1; } } }),
      sp('donovan', 'crow', '까악이 해킹', '까악이의 공격이 30% 확률로 1초 감전을 건다.', { hooks: { onStart(_b, u) { u.mem.crowShock = 1; } } }),
      sp('donovan', 'shadow', '그림자 와이어', '피니쉬가 대상 주변 1칸 적에게 타격 위력 80% 연쇄 피해를 준다.', { hooks: { onBasic(b, u, t) {
        if (!u.mem.finished) return;
        for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) proc(b, u, e, b.S(u, 'strike') * 0.8, 'phys', 'strike');
      } } }),
      sp('donovan', 'execute', '처형 와이어', '스킬 대상의 체력이 30% 이하이면 스킬 피해 ×1.8.', { hooks: { dmgMult: (b, _u, t, o) => (o.tag === 'skill' && b.hpPct(t) <= 0.3 ? 1.8 : 1) } }),
      sp('donovan', 'night', '밤까마귀', '전투 시작 후 4초간 은신해 대상으로 지정되지 않는다. 은신 중 첫 스킬은 반드시 치명타.', { hooks: {
        onStart(b, u) { b.buff(u, u, 'stealth', 4, { label: '은신' }); u.mem.nightCrit = 1; u.sk.crit += 10; },
        onSkill(_b, u) { if (u.mem.nightCrit) { u.mem.nightCrit = 0; u.sk.crit -= 10; } },
        onTick(b, u) { if (u.mem.nightCrit && !b.hidden(u)) { u.mem.nightCrit = 0; u.sk.crit -= 10; } },
      } }),
      sp('donovan', 'weak', '약점 간파', '치명타 피해 +40%p. 기술 피해가 치명타로 터지면 대상 방어도 4초간 -30%.', { stats: { critDmg: 0.4 }, hooks: { onDeal(b, u, t, r, o) {
        if (r.crit && o.kind === 'tech' && t.alive) corrode(b, u, t, 0.7, 4);
      } } }),
      sp('donovan', 'council', '전 보안위원회', '스킬 대상에게 6초간 [표식]: 모든 아군이 그 적에게 주는 치명타 피해 +25%p.', { hooks: { onDeal(b, u, t, _r, o) {
        if (o.tag === 'skill' && t.alive) b.applyStatus(u, t, { type: 'buff', key: 'donovan.mark', dur: 6, critVuln: 0.25, label: '표식' });
      } } }),
      sp('donovan', 'track', '외길 추적', '대상이 쓰러질 때까지 대상을 바꾸지 않는다 (스킬 포함). 같은 대상을 공격할 때마다 피해 +6% (최대 +60%).', {
        setup: (u) => { u.mem.lockTarget = 1; u.mem.lowestFocus = 0; },
        hooks: {
          onDeal(_b, u, t, _r, o) {
            if (o.tag !== 'basic' && o.tag !== 'skill') return;
            if (u.mem.trackId === t.id) u.mem.trackN = Math.min(10, (u.mem.trackN || 0) + 1);
            else { u.mem.trackId = t.id; u.mem.trackN = 0; }
          },
          dmgMult: (_b, u, t) => (u.mem.trackId === t.id ? 1 + 0.06 * (u.mem.trackN || 0) : 1),
        },
      }),
    ],
  },
  chloe: {
    ctype: 'SPEC', ttype: 'minor', faith: 'science', weapon: G('다트 권총', 'chem', 1.0, 3, 0.9, 6, 1.8),
    factions: ['SEC'], traits: ['MED', 'DECOMP'],
    trait: {
      name: '항밈 처방', desc: '기본 공격이 대상에게 [중독]을 건다 (4초간 초당 기술 위력 25% 화학 피해). 다트가 6번 맞을 때마다 항밈 수면제: 대상이 50% 확률로 2초 기절. 회복할 때 대상의 해로운 상태이상 1개를 제거한다.',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (r.amount > 0 && t.alive) b.applyStatus(u, t, { type: 'dot', key: 'poison', dur: 4, dps: b.S(u, 'tech') * 0.25 * gw(u), elem: 'chem' }, 1);
        if (r.amount > 0 && t.alive && nth(u, 'sleepN', 6)) b.stun(u, t, u.sk.sleep || 2, u.sk.sleepChance || 0.5);
      }, onHealDone(_b, u, t) {
        const i = t.statuses.findIndex(harmful);
        if (i < 0) return;
        t.statuses.splice(i, 1);
      } } },
    },
  },
  west: {
    ctype: 'MARK', ttype: 'minor', faith: 'human', weapon: G('리벳건', 'phys', 0.6, 3, 0.6, 20, 3),
    factions: ['UNI'], traits: ['ENG'],
    trait: {
      name: '현장 반장', desc: '포탑의 공격이 웨스트 사격 위력 15%의 고정 피해를 추가로 준다. 7초마다 모든 포탑을 기술 위력 100% 수리하고 4초간 공격 속도 +35%.',
      effect: { hooks: { onTick(b, u, dt) {
        if (every(u, 'westFixT', dt, 7) && b.enemiesOf(u).length) {
          for (const tur of b.alliesOf(u)) if (tur.defId === 'turret') { b.heal(u, tur, b.P(u, 'tech') * (u.sk.fix ?? 1)); b.buff(u, tur, 'west.oc', 4, { delta: { atkSpd: u.sk.overclock ?? 0.35 }, label: '정비' }); }
        }
        if (u.mem.westInit) return;
        u.mem.westInit = 1;
        for (const tur of b.units) {
          if (tur.defId !== 'turret' || tur.side !== u.side) continue;
          tur.st.atkSpd += u.mem.westAs || 0;
          tur.hooks.push({
            onBasic(bb, self, tgt, r) { if (r.amount > 0 && tgt.alive) bb.dealDamage(self, tgt, bb.S(u, 'shoot') * 0.15 * gw(u), { elem: 'true', tag: 'proc', noHooks: true }); },
          });
        }
      } } },
    },
  },

  // ───────────────────────── 주식회사 페트라
  lindiwe: {
    ctype: 'VAN', ttype: 'major', faith: 'index', weapon: K('방어막 건틀릿', 'phys', 0.9, 1, 0.8, 3),
    factions: ['PET'], traits: ['SCHEME', 'GUARD'],
    trait: {
      name: '특별경호팀', desc: '자신과 주변 1칸 아군의 피해량 경감 30%p. 주변 아군이 받는 피해의 절반은 린디웨가 나눠 받는다. 전투 스킬을 쓸 때 최대 체력 18% 보호막.',
      effect: { hooks: { onSkill(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.18); }, onTick(b, u, dt) {
        u.mem.lindT = (u.mem.lindT || 0) - dt;
        if (u.mem.lindT > 0) return;
        u.mem.lindT = 0.5;
        for (const a of b.around(u, 1, b.alliesOf(u))) {
          b.applyStatus(u, a, { type: 'buff', key: 'lindiwe.aura', dur: 0.7, taken: [red('all', 0.3)], share: a === u ? undefined : u, shareRate: 0.5 });
        }
      } } },
    },
  },
  orca: {
    ctype: 'MARK', ttype: 'minor', faith: 'index', weapon: G('작살총', 'phys', 1.4, 3, 1.6, 1, 2),
    factions: ['PET'], traits: ['CHEF'],
    trait: {
      name: '깜짝 마술', desc: '공격 · 기술이 맞으면 20% 확률로 무작위 적 하나를 0.6초 기절시킨다 (1초에 1회).',
      effect: { hooks: { onDeal(b, u, _t, r, o) {
        if (r.amount <= 0 || (o.tag !== 'basic' && o.tag !== 'skill') || !b.rng.chance(Math.min(0.6, 0.2 * gw(u))) || !icd(b, u, 'orcaIcd', 1)) return;
        const es = b.enemiesOf(u);
        if (es.length) b.stun(u, es[Math.floor(b.rng.next() * es.length)], 0.6);
      } } },
    },
  },
  franze: {
    ctype: 'CMD', ttype: 'major', faith: 'index', weapon: K('에너지 블레이드', 'phys', 0.9, 1, 0.6, 4),
    factions: ['PET', 'TIME', 'KAL'], traits: [],
    trait: {
      name: '은하법 검사', desc: '흡혈 +10%p. 전투 스킬을 쓴 뒤 잃은 체력의 12.5%를 재생한다. 기본 공격이 맞은 적에게 5초간 [심판]: 그동안 아군이 준 피해의 20%를 기록하고, 끝날 때 기록의 100%를 고정 피해로 정산한다.',
      effect: {
        stats: { lifesteal: 0.1 },
        hooks: { onSkill(b, u) { b.heal(u, u, (b.S(u, 'maxHp') - u.hp) * (u.sk.rewind ?? 0.125), true); }, onBasic(b, u, t, r) {
          if (r.amount <= 0 || !t.alive || t.statuses.some((s) => s.key === 'franze.judge')) return;
          b.applyStatus(u, t, { type: 'buff', key: 'franze.judge', dur: 5, rec: 0, label: '심판',
            onExpire(bb, tgt, s) { if (s.rec && s.src && tgt.alive) bb.dealDamage(s.src, tgt, s.rec, { elem: 'true', tag: 'proc' }); } });
        } },
      },
    },
  },
  grenholm: {
    ctype: 'VAN', ttype: 'major', faith: 'index', weapon: K('7중 방호 블레이드', 'phys', 1.1, 1, 0.8, 3),
    factions: ['PET'], traits: ['STAR', 'INFIL'],
    trait: {
      name: '7중 방호 슈트', desc: '기본 공격 · 기술을 쓸 때마다 최대 체력 5% 보호막 (최대 20%까지 쌓임). 전투 스킬을 쓸 때는 최대 체력 15% 보호막을 추가로 전개한다.',
      effect: { hooks: {
        onBasic(b, u) { grenShield(b, u); },
        onSkill(b, u) { grenShield(b, u); b.shield(u, b.S(u, 'maxHp') * 0.15); },
      } },
    },
  },
  lars: {
    ctype: 'CMD', ttype: 'special', faith: 'index', weapon: { name: '비무장', kind: 'none', type: 'shoot', elem: 'phys', interval: 1, range: 3, mult: 0 },
    factions: ['PET'], traits: ['BUDDY'],
    trait: {
      name: '합리적인 거래', desc: '기본 공격을 하지 않는다. 라르스가 함께한 뒤 번 크레딧 10당 경호원 메이저 +1 (100에서 상한 +10). 이자 상한 +2. [경호 계약] 8초마다 경호원 전원에게 기술 위력 150% 보호막.',
      effect: {
        setup: (u) => { u.mem.summonMaj = Math.min(10, Math.floor(gv(u.src?.grow || {}, 'earn') / 10)); },
        hooks: { onTick(b, u, dt) {
          if (!every(u, 'guardT', dt, 8) || !b.enemiesOf(u).length) return;
          const amt = b.P(u, 'tech') * (u.sk.shield ?? 1.5);
          // 하청: 경호원 대신 무작위 아군 2명
          if (u.sk.subcon) {
            const pool = b.alliesOf(u, false).filter((a) => !a.isSummon);
            for (const a of (pool.length ? b.rng.sample(pool, 2) : [u])) b.shield(a, amt);
          }
          for (const bot of summonsOf(b, u)) b.shield(bot, amt);
        } },
      },
    },
    specialAugs: [
      sp('lars', 'bribe', '매수', '거래 대상 적이 4초간 공포에 걸리고 받는 피해 +25%.', { hooks: { onSkill(b, u) {
        const t = dealTarget(b, u);
        if (t) b.applyStatus(u, t, { type: 'fear', key: 'fear', dur: 4, taken: [vuln('all', 0.25)] });
      } } }),
      sp('lars', 'counsel', '변호인단', '경호원이 1명 줄지만, 남은 경호원의 최대 체력 ×2, 피해 ×1.5.', { setup: (u) => {
        u.mem.extraSummon = (u.mem.extraSummon || 0) - 1;
        u.mem.summonHpMul = (u.mem.summonHpMul || 1) * 2;
        u.mem.summonDmg = (u.mem.summonDmg || 0) + 0.5;
      } }, ex('lars', 'subcon')),
      sp('lars', 'pen', '직접 협상', '비무장 해제: 만년필을 던진다 (사격, 탄 1 · 재장전 1.5초, 계수 180%).', { setup: (u) => {
        u.noAttack = false;
        u.weapon = G('만년필', 'phys', 1.0, 3, 1.8, 1, 1.5);
        u.atk = { type: 'shoot', elem: 'phys', interval: 1.0 };
      } }),
      sp('lars', 'elite', '정예 경호', '경호원 최대 체력 +40%, 경호원 메이저 +2.', { setup: (u) => {
        u.mem.summonHpPct = (u.mem.summonHpPct || 0) + 0.4;
        u.mem.summonMaj = (u.mem.summonMaj || 0) + 2;
      } }, ex('lars', 'subcon')),
      sp('lars', 'penalty', '위약금', '경호원이 쓰러지면 체력이 가장 높은 적에게 기술 위력 250% 피해를 주고 6초간 받는 피해 +20%.', { hooks: { onAllyDeath(b, u, dead) {
        if (!dead.isSummon || dead.owner !== u) return;
        const t = pickEnemy(b, u, 'strongest');
        if (!t) return;
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
        skillHit(b, u, t, 'tech', 2.5, 'phys', { noMiss: true });
        if (t.alive) b.applyStatus(u, t, { type: 'buff', key: 'lars.penalty', dur: 6, taken: [vuln('all', 0.2)], label: '위약금' });
      } } }, ex('lars', 'subcon')),
      sp('lars', 'exclusive', '독점 계약', '거래 대상 적이 4초간 속박(이동 불가)되고 공격 속도 -30%.', { hooks: { onSkill(b, u) {
        const t = dealTarget(b, u);
        if (t) b.applyStatus(u, t, { type: 'buff', key: 'root', dur: 4, delta: { atkSpd: -0.3 }, label: '속박' });
      } } }),
      sp('lars', 'installment', '분할 상환', '거래 제안 쿨다운 +2초. 대신 같은 적과 거래할 때마다 주는 피해 감소가 20%에서 10%p씩 쌓인다 (최대 60%, 전투 동안 유지).', { setup: (u) => {
        u.cdMax += 2; u.sk.installment = 1;
      } }),
      sp('lars', 'subcon', '하청', '경호원을 데려오지 않는다. 대신 경호 계약 보호막 (기술 위력 150%)을 무작위 아군 2명에게 준다.', { setup: (u) => {
        u.mem.noSummon = 1; u.sk.subcon = 1;
      } }, ex('lars', 'counsel', 'elite', 'penalty')),
    ],
  },
  falcon: {
    ctype: 'MARK', ttype: 'major', faith: 'science', weapon: G('레일건', 'phys', 1.2, 6, 1.3, 3, 3.5),
    factions: ['PET'], traits: ['ENG', 'HUNTER'],
    trait: {
      name: '관통 시험', desc: '기본 공격이 직선 위의 다른 적도 관통해 50% 피해를 준다.',
      effect: { hooks: { onBasic(b, u, t) {
        for (const e of lineTargets(b, u, t)) if (e !== t) proc(b, u, e, b.S(u, 'shoot') * (u.weapon?.mult || 1) * 0.5, 'phys', 'shoot');
      } } },
    },
  },

  // ───────────────────────── 칼리토 제국
  hiiro: {
    ctype: 'CMD', ttype: 'psionic', faith: 'emperor', weapon: G('여우불 부적', 'psy', 1.1, 3, 0.6, 5, 2),
    factions: ['KAL', 'HOI'], traits: ['STAR'],
    trait: {
      name: '점괘', desc: '전투 시작 시 점괘를 본다. 길: 아군 전원 12초간 피해 +12%. 흉: 아군 전원 6초간 받는 피해 +8%. 이성이 높을수록 길이 잘 나온다. 여우불 부적이 맞으면 10% 확률로 대상이 환술에 걸려 2초 공포 (3초에 1회).',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (r.amount > 0 && t.alive && b.rng.chance(0.1) && icd(b, u, 'hiiroFear', 3)) fear(b, u, t, 2, 1);
      }, onStart(b, u) {
        const good = b.rng.chance(Math.min(0.95, 0.5 + (u.reason ?? 50) / 200));
        for (const a of b.alliesOf(u)) {
          if (good) b.buff(u, a, 'hiiro.start', 12, { mods: [inc('all', 0.12)] });
          else b.buff(u, a, 'hiiro.start', 6, { taken: [vuln('all', 0.08)] });
        }
        b.emit({ k: 'status', id: u.id, name: good ? '점괘: 길' : '점괘: 흉' });
        b.addReason(u, good ? 10 : -10);
      } } },
    },
    psi: { desc: '점괘가 길이면 이성 +10, 흉이면 -10.', effect: {} },
  },
  nadir: {
    ctype: 'SPEC', ttype: 'psionic', faith: 'emperor', weapon: G('백수정 조각', 'psy', 0.9, 3, 0.9, 6, 1.5),
    factions: ['KAL', 'VOYAGE'], traits: ['OCCULT'],
    trait: {
      name: '사이오닉 영사', desc: '기본 공격이 맞으면 대상 주변 2칸의 다른 적에게 튕겨 기술 위력 50% 정신 피해.',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (r.amount <= 0) return;
        const e = b.nearest(t, b.around(t, 2, b.enemiesOf(u)).filter((x) => x !== t));
        if (e) proc(b, u, e, b.S(u, 'tech') * 0.5, 'psy', 'tech');
      } } },
    },
    psi: { desc: '전투 스킬 사용 시 이성 -10, 결정타 +6.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -10), onKill: (b, u) => b.addReason(u, 6) } } },
  },
  temur: {
    ctype: 'VAN', ttype: 'major', faith: 'emperor', weapon: K('검투사 대검', 'phys', 1.0, 1, 0.85, 3),
    factions: ['KAL', 'VOYAGE'], traits: ['INFIL'],
    trait: {
      name: '투사', desc: '효과 저항 +100%p. 피해를 받을 때마다 타격 피해량 +2%p (전투 동안, 최대 +200%p).',
      effect: {
        stats: { effRes: 1 },
        hooks: {
          onHurt(b, u, _s, r) { if (r.amount > 0) u.mem.fighter = Math.min(100, (u.mem.fighter || 0) + ((u.mem.kingUntil || 0) > b.t ? 2 : 1)); }, // 경기장의 왕: 2배
          dmgMult: (_b, u, _t, o) => (o.kind === 'strike' ? 1 + 0.02 * (u.mem.fighter || 0) : 1),
        },
      },
    },
  },
  kairo: {
    ctype: 'MARK', ttype: 'special', faith: 'emperor', weapon: G('안단테-7 저격총', 'phys', 1.0, 6, 1.2, 5, 3),
    factions: ['KAL'], traits: ['CHEF', 'HUNTER'],
    trait: {
      name: '기다림의 미학', desc: '칵테일 1잔 또는 아군 기본 공격 12회마다 1스택 (전투 시작 시 2스택). 8스택이면 안단테-7로 체력이 가장 높은 적에게 사격 위력 800% 물리 저격 (치명타 확률 +15%p, 회피 불가).',
      effect: { hooks: { onTick(b, u) { if ((u.mem.wait ?? 0) >= u.sk.need) kairoSnipe(b, u); }, onAllyBasic(b, u, a) {
        if (a.isSummon) return;
        u.mem.kc = (u.mem.kc || 0) + 1;
        if (u.mem.kc < 12) return;
        u.mem.kc = 0;
        u.mem.wait = (u.mem.wait ?? u.sk.start) + 1;
        kairoSnipe(b, u);
      } } },
    },
    specialAugs: [
      sp('kairo', 'cocktail', '칵테일 전문', '칵테일 쿨다운이 절반이 되지만 저격을 하지 않는다.', { setup: (u) => { u.cdMax *= 0.5; u.sk.need = 999; } }),
      sp('kairo', 'kilo', '콜사인 킬로', '자신의 기본 공격이 2번 맞을 때마다 기다림의 미학 1스택.', { hooks: { onBasic(b, u, _t, r) {
        if (r.amount <= 0) return;
        u.mem.kilo = (u.mem.kilo || 0) + 1;
        if (u.mem.kilo % 2) return;
        u.mem.wait = (u.mem.wait ?? u.sk.start) + 1;
        kairoSnipe(b, u);
      } } }),
      sp('kairo', 'andante', '안단테', '탄창이 1발이 되지만 기본 공격 피해 ×4.', { setup: (u) => { if (u.weapon) u.weapon = { ...u.weapon, mag: 1, mult: u.weapon.mult * 4 }; } }),
      sp('kairo', 'lastorder', '라스트 오더', '저격 대상이 체력 25% 이하로 남으면 즉시 처형한다.', setSk((s) => { s.lastOrder = 0.25; }), ex('kairo', 'cocktail')),
      sp('kairo', 'double', '더블 샷', '저격이 두 번째로 체력이 높은 적에게도 50% 피해를 준다.', setSk((s) => { s.double = 0.5; }), ex('kairo', 'cocktail')),
      sp('kairo', 'signature', '시그니처', '칵테일이 보호막 대신 대상의 기술 쿨다운을 1.5초 줄이고, 치명타 확률 +15%p를 준다.', setSk((s) => { s.shield = 0; s.crit = 0.15; s.sigCd = 1.5; })),
      sp('kairo', 'patience', '인내', '저격에 12스택이 필요하지만 저격 피해 ×2, 방어도를 무시한다.', setSk((s) => { s.need = 12; s.snipe *= 2; s.snipePen = 1; }), ex('kairo', 'cocktail')),
      sp('kairo', 'regular', '단골 손님', '전투 시작 시 칼리토 아군 수만큼 기다림의 미학 스택을 더 얻는다.', { hooks: { onStart(b, u) {
        const n = b.alliesOf(u).filter((a) => !a.isSummon && a.synergies.has('KAL')).length;
        u.mem.wait = (u.mem.wait ?? u.sk.start) + n;
      } } }),
    ],
  },
  zahara: {
    ctype: 'VAN', ttype: 'minor', faith: 'emperor', weapon: K('쌍곡도', 'phys', 0.8, 1, 0.7, 5),
    factions: ['KAL'], traits: ['STAR', 'CHEF'],
    trait: {
      name: '복수자', desc: '피해를 받으면 공격자에게 타격 위력 150% 반격. 주변 1칸 아군이 맞았을 때도 50% 확률로 반격 (0.4초에 1회).',
      effect: { hooks: {
        onHurt(b, u, src, r, o) { if (src.side !== u.side && src.alive && r.amount > 0 && o.tag !== 'dot' && icd(b, u, 'zIcd', 0.4)) proc(b, u, src, b.S(u, 'strike') * 1.5 * gw(u), 'phys', 'strike'); },
        onAllyHurt(b, u, ally, src, r) {
          if (src.side === u.side || !src.alive || r.amount <= 0 || b.dist(u, ally) > 1 || !b.rng.chance(0.5) || !icd(b, u, 'zIcd', 0.4)) return;
          proc(b, u, src, b.S(u, 'strike') * 1.5 * gw(u), 'phys', 'strike');
        },
      } },
    },
  },
  bianca: {
    ctype: 'SPEC', ttype: 'special', faith: 'science', weapon: G('치유탄 권총', 'phys', 0.9, 3, 0.9, 8, 2),
    factions: ['KAL'], traits: ['MED', 'BUDDY'],
    trait: {
      name: '냉혈한 성녀', desc: '적이 쓰러질 때 30% 확률로 유전 물질을 수집한다 (런 누적). 10 / 30 / 60개에서 베헤모스 상속률 +10 / 25 / 45%p, 피해 +10 / 25 / 50%.',
      effect: {
        setup: (u) => {
          const n = gv(u.src?.grow || {}, 'genes');
          const k = n >= 60 ? 2 : n >= 30 ? 1 : n >= 10 ? 0 : -1;
          if (k < 0) return;
          u.mem.bondBonus = (u.mem.bondBonus || 0) + [0.1, 0.25, 0.45][k];
          u.mem.bondAmp = (u.mem.bondAmp || 0) + [0.1, 0.25, 0.5][k];
        },
        hooks: { onAnyDeath(b, u, dead) { if (dead.side !== u.side && b.rng.chance(u.mem.geneRate || 0.3)) u.mem.g_genes = (u.mem.g_genes || 0) + 1; } },
      },
    },
    specialAugs: [
      sp('bianca', 'unleash', '베헤모스 해방', '베헤모스 상속률 +60%p, 피해 +50%. 비앙카는 기본 공격을 하지 않는다.', { setup: (u) => {
        u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.6; u.mem.bondAmp = (u.mem.bondAmp || 0) + 0.5; u.noAttack = true;
      } }),
      sp('bianca', 'drone', '드론 편대', '치유 탄환이 대상 주변 1칸 아군에게도 50% 효과.', setSk((s) => { s.splash = 1; })),
      sp('bianca', 'cold', '냉혈 처방', '치유 탄환이 회복 대신 보호막을 준다 (양 +50%).', setSk((s) => { s.shield += s.heal * 1.5; s.heal = 0; })),
      sp('bianca', 'genes', '유전 표본', '유전 물질 수집 확률 30% → 50%.', { setup: (u) => { u.mem.geneRate = 0.5; } }),
      sp('bianca', 'symbiosis', '공생', '베헤모스가 준 피해의 15%만큼 체력 비율이 가장 낮은 아군을 회복한다.', { hooks: petHook('symInit', (o) => ({ onDeal(bb, _self, _t, r) {
        if (r.amount <= 0 || !o.alive) return;
        const a = bb.lowestHpAlly(o);
        if (a) bb.heal(o, a, r.amount * 0.15);
      } })) }, ex('bianca', 'sample')),
      sp('bianca', 'regen', '야생 재생', '베헤모스가 쓰러질 피해를 받으면 전투당 1회 체력 50%로 재기동한다.', { hooks: petHook('regenInit', (o) => ({ onLethal(bb, self) {
        if (o.mem.petRevive) return false;
        o.mem.petRevive = 1;
        self.hp = bb.S(self, 'maxHp') * 0.5;
        bb.emit({ k: 'mark', id: self.id, name: '재기동', style: 'revive' });
        return true;
      } })) }, ex('bianca', 'sample')),
      sp('bianca', 'serum', '생체 강화 탄', '치유 탄환 대상이 4초간 피해 +20% (베헤모스 버프와 별도).', setSk((s) => { s.dmg += 0.2; s.dur = 4; })),
      sp('bianca', 'sample', '표본 회수', '베헤모스를 부르지 않는다. 대신 유전 물질 단계의 피해 보너스를 비앙카가 얻고, 치유 탄환 대상이 4초간 변이 (피해 +40% + 유전 물질 단계 피해 보너스).', { setup: (u) => {
        u.mem.noSummon = 1; u.mem.sample = 1;
        if (u.mem.bondAmp) u.mods.push(inc('all', u.mem.bondAmp));
      } }, ex('bianca', 'unleash')),
    ],
  },

  // ───────────────────────── 헬레니우스 동맹
  zephyro: {
    ctype: 'CMD', ttype: 'psionic', faith: 'athena', weapon: G('깃펜', 'phys', 0.8, 4, 0.6, 2, 1),
    factions: ['HEL', 'PAN'], traits: ['NAV'],
    trait: {
      name: '뱃사공 철학', desc: '기본 공격이 대상 근처의 적 1명을 추가로 맞힌다. 아군 전원 치명타 확률 +10%p.',
      effect: { hooks: {
        onBasic(b, u, t) {
          const e = b.nearest(t, b.enemiesOf(u).filter((x) => x !== t && b.dist(u, x) <= b.S(u, 'range')));
          if (e) b.dealDamage(u, e, b.S(u, 'shoot') * (u.weapon?.mult || 1), { elem: u.atk.elem, tag: 'basic', kind: 'shoot', canMiss: true });
        },
        onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'zephyro.calm', 999, { delta: { crit: 0.1 } }); },
      } },
    },
    psi: { desc: '초당 이성 +1 (느긋함), 염동(전투 스킬) 사용 시 -6.', effect: { hooks: {
      onTick(b, u, dt) { u.mem.zt = (u.mem.zt || 0) + dt; if (u.mem.zt >= 1) { u.mem.zt -= 1; b.addReason(u, 1); } },
      onSkill: (b, u) => b.addReason(u, -6),
    } } },
  },
  phyllis: {
    ctype: 'SPEC', ttype: 'special', faith: 'hades', weapon: K('만능 렌치', 'holy', 0.8, 1, 0.8, 4),
    factions: ['HEL', 'VOYAGE'], traits: ['INFIL'],
    trait: {
      name: '균열 회피', desc: '회피 +5%p. 회피하면 공격자에게 타격 위력 100% 반격하고 무작위 적에게 순간이동한다 (0.5초에 1회). [물자 전송] 6초마다 체력 비율이 가장 낮은 아군에게 기술 위력 100% 보호막.',
      effect: { stats: { eva: 0.05 }, hooks: { onTick(b, u, dt) {
        if (!every(u, 'supplyT', dt, 6) || !b.enemiesOf(u).length) return;
        const a = b.lowestHpAlly(u);
        if (!a) return;
        b.shield(a, b.P(u, 'tech') * (u.sk.supply ?? 0.8));
        b.fx(a.x, a.y, 0, 'holy', 'heal');
        if (u.sk.supplyCleanse) { const i = a.statuses.findIndex(isHarmful); if (i >= 0) a.statuses.splice(i, 1); } // 하데스 택배
      }, onEvade(b, u, src) {
        if (!src.alive || !icd(b, u, 'phIcd', 0.5)) return;
        proc(b, u, src, b.S(u, 'strike') * (u.mem.counterMul || 1), 'holy', 'strike');
        const es = b.enemiesOf(u);
        if (es.length) blinkTo(b, u, es[Math.floor(b.rng.next() * es.length)]);
      } } },
    },
    specialAugs: [
      sp('phyllis', 'mail', '균열 우편', '전투 시작 시 첫 번째 장비의 효과를 무작위 아군 1명에게도 전송한다.', { setup(u, b, ctx) {
        const it = u.src?.items.find(Boolean);
        if (!it) return;
        u.hooks.push({ onStart(bb, self) {
          const as = bb.alliesOf(self, false).filter((a) => !a.isSummon);
          if (as.length) applyLive(as[Math.floor(bb.rng.next() * as.length)], itemEffect(it), bb, ctx);
        } });
        void b;
      } }),
      sp('phyllis', 'slack', '땡땡이', '처음 3초는 쉬지만 이후 피해 +60%.', { mods: [inc('all', 0.6)], hooks: { onStart(b, u) { b.applyStatus(u, u, { type: 'stun', key: 'stun', dur: 3, label: '땡땡이' }); } } }),
      sp('phyllis', 'chain', '연쇄 도약', '처치하면 즉시 체력 비율이 가장 낮은 적에게 도약하고 다음 공격이 바로 나간다.', { hooks: { onKill(b, u) {
        const t = b.lowestEnemy(u) || b.nearest(u, b.enemiesOf(u));
        if (t && blinkTo(b, u, t)) u.atkTimer = 0;
      } } }),
      sp('phyllis', 'hades', '하데스 택배', '물자 전송 보호막 ×1.6 (기술 위력 100% → 160%), 보호막을 받은 아군의 해로운 효과 1개 제거.', setSk((s) => { s.supply *= 1.6; s.supplyCleanse = 1; })),
      sp('phyllis', 'rift', '균열 잔상', '균열 도약으로 떠난 자리에 2초간 균열 (주변 1칸): 지나는 적에게 기술 위력 40% 신성 피해 (균열마다 적 1회).', { hooks: {
        onTick(b, u) {
          if ((u.mem.riftUntil || 0) > b.t) {
            const key = `rift${u.id}`;
            for (const e of b.around({ x: u.mem.riftX, y: u.mem.riftY }, 1, b.enemiesOf(u))) {
              if (e.mem[key] === u.mem.riftN) continue;
              e.mem[key] = u.mem.riftN;
              proc(b, u, e, b.P(u, 'tech') * 0.4, 'holy', 'tech');
            }
          }
          u.mem.lastX = u.x; u.mem.lastY = u.y;
        },
        onSkill(b, u) {
          u.mem.riftN = (u.mem.riftN || 0) + 1;
          u.mem.riftUntil = b.t + 2;
          u.mem.riftX = u.mem.lastX ?? u.x; u.mem.riftY = u.mem.lastY ?? u.y;
          b.fx(u.mem.riftX, u.mem.riftY, 1, 'holy');
        },
      } }),
      sp('phyllis', 'dodge', '회피 달인', '회피 +10%p, 균열 회피 반격 피해 100% → 150%.', { stats: { eva: 0.1 }, setup: (u) => { u.mem.counterMul = 1.5; } }),
      sp('phyllis', 'supply', '긴급 조달', '전투 시작 시 모든 아군에게 기술 위력 60% 보호막.', { hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.shield(a, b.P(u, 'tech') * 0.6); } } }),
      sp('phyllis', 'underworld', '명계 출장', '균열 도약이 적 대신 가장 뒤에 있는 아군 곁으로 순간이동해, 자신과 주변 1칸 아군 모두에게 보호막 (물자 전송 보호막 수치). 피해는 주지 않는다.', { setup: (u) => {
        const base = u.skill;
        if (!base) return;
        u.skill = { ...base, needsRange: false, tag: () => '아군 후방 순간이동 · 보호막', cast(b, self) {
          if (!b.enemiesOf(self).length) return false;
          const as = b.alliesOf(self, false).filter((a) => !a.isSummon);
          const back = as.length ? as.reduce((a, c) => ((self.side === 0 ? c.y > a.y : c.y < a.y) ? c : a)) : null;
          if (back && b.dist(self, back) > 1) { blinkTo(b, self, back); self.target = null; }
          const p = self.sk;
          b.fx(self.x, self.y, 1, 'holy', 'heal');
          for (const a of b.around(self, 1, b.alliesOf(self))) {
            b.shield(a, b.P(self, 'tech') * p.supply);
            if (p.supplyCleanse) { const i = a.statuses.findIndex(isHarmful); if (i >= 0) a.statuses.splice(i, 1); }
          }
          return true;
        } };
      } }),
    ],
  },
  eleni: {
    ctype: 'VAN', ttype: 'divine', faith: 'selene', weapon: K('진혼 대검', 'phys', 1.1, 1, 0.85, 3),
    factions: ['HEL'], traits: ['MED', 'GUARD'],
    trait: {
      name: '등대기사', desc: '주변 2칸 아군이 초당 최대 체력 1% 회복. 피니쉬가 주변 1칸 적 모두에게 타격 위력 50% 물리 피해 (달빛 베기).',
      effect: { hooks: { onBasic(b, u) {
        if (!u.mem.finished) return;
        for (const e of b.around(u, 1, b.enemiesOf(u))) proc(b, u, e, b.S(u, 'strike') * 0.5, 'phys', 'strike');
      }, onTick(b, u, dt) {
        u.mem.lightT = (u.mem.lightT || 0) + dt;
        if (u.mem.lightT < 1) return;
        u.mem.lightT -= 1;
        b.fx(u.x, u.y, 2, 'holy', 'aura'); // 연출: 희미하게 점멸하는 회복 장판
        for (const a of b.around(u, 2, b.alliesOf(u))) b.heal(u, a, b.S(a, 'maxHp') * 0.01);
      } } },
    },
  },
  iris: {
    ctype: 'CMD', ttype: 'divine', faith: 'hermes', weapon: G('날개 단검 투척', 'holy', 0.9, 3, 0.6, 6, 1.5),
    factions: ['HEL', 'STL'], traits: [],
    trait: {
      name: '헤르메스의 날개', desc: '아군 전원 이동 속도 · 공격 속도 +25%p. 날개 단검이 5번 맞을 때마다 대상의 인지를 교란해 기술 위력 120% 신성 피해 + 50% 확률로 1.5초 공포.',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (r.amount <= 0 || !t.alive || !nth(u, 'irisN', 5)) return;
        skillHit(b, u, t, 'tech', u.sk.jam ?? 1.2, 'holy', { noMiss: true });
        if (t.alive) fear(b, u, t, 1.5, u.sk.fearChance ?? 0.5);
      }, onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'iris.wing', 999, { delta: { moveSpd: 0.25, atkSpd: 0.25 } }); } } },
    },
  },
  odysseus: {
    ctype: 'CMD', ttype: 'divine', faith: 'athena', weapon: G('장궁', 'phys', 0.75, 4, 1.0, 1, 0.8),
    factions: ['HEL'], traits: ['SCHEME'],
    trait: { name: '귀환자의 눈', desc: '체력 비율이 가장 낮은 적을 노린다. 치명타 확률 +25%p.', effect: { stats: { crit: 0.25 }, setup: (u) => { u.mem.lowestFocus = 1; } } },
  },
  argon: {
    ctype: 'MARK', ttype: 'major', faith: 'hades', weapon: G('선상 작살총', 'chem', 0.9, 4, 1.1, 2, 2.5),
    factions: ['HEL'], traits: ['NAV', 'DECOMP'],
    trait: { name: '망자의 뱃사공', desc: '다른 기물이 주는 이로운 버프를 받지 않는다. 효과 저항 +40%p.', effect: { stats: { effRes: 0.4 }, setup: (u) => { u.mem.noBless = 1; } } },
  },

  // ───────────────────────── 시리우스 성도회
  romani: {
    ctype: 'VAN', ttype: 'psionic', faith: 'sirius', weapon: K('중거리 채찍', 'phys', 0.9, 2, 0.7, 3),
    factions: ['SIR'], traits: ['INFIL', 'SCHEME'],
    trait: {
      name: '염동 회수', desc: '기본 공격 · 기술이 맞으면 가장 먼 적을 바로 옆으로 끌어와 타격 위력 50% 추가 피해 (3초에 1회). 엘리트 · 보스는 끌려오지 않고 150% 추가 피해를 받는다.',
      effect: { hooks: {
        onBasic(b, u, _t, r) { if (r.amount > 0) romaniPull(b, u); },
        onSkill(b, u) { romaniPull(b, u); },
      } },
    },
    psi: { desc: '전투 스킬(집행자 투척) 사용 시 이성 -8, 결정타 +10.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -8), onKill: (b, u) => b.addReason(u, 10) } } },
  },
  joshua: {
    ctype: 'SPEC', ttype: 'psionic', faith: 'sirius', weapon: G('진정제 다트 권총', 'holy', 1.0, 3, 0.9, 6, 2),
    factions: ['SIR', 'PAN'], traits: ['MED'],
    trait: { name: '체사레', desc: '이성이 -50 이하로 떨어지면 체사레로 전환된다.' },
    psi: { desc: '아군(자신 포함)이 잃은 체력 비율만큼 이성 감소 (최대 체력 10%당 -3), 회복할 때마다 +3.', effect: { hooks: {
      onAllyHurt(b, u, ally, _s, r) { if (!ally.isSummon) b.addReason(u, -30 * r.amount / b.S(ally, 'maxHp')); },
      onHurt(b, u, _s, r) { b.addReason(u, -30 * r.amount / b.S(u, 'maxHp')); },
      onHealDone(b, u, _t, amt) { if (amt > 0) b.addReason(u, 3); },
    } } },
  },
  sarma: {
    ctype: 'MARK', ttype: 'major', faith: 'science', weapon: G('융합포', 'phys', 1.1, 4, 1.3, 2, 3),
    factions: ['SIR', 'TIME'], traits: ['OCCULT'],
    trait: {
      name: '차원 융합', desc: '기본 공격이 대상 주변 1칸 적에게 30% 피해로 번진다.',
      effect: { hooks: { onBasic(b, u, t) {
        for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) proc(b, u, e, b.S(u, 'shoot') * (u.weapon?.mult || 1) * 0.3, 'phys', 'shoot');
      } } },
    },
  },
  kyle: {
    ctype: 'VAN', ttype: 'divine', faith: 'sirius', weapon: K('성전 장검', 'holy', 1.0, 1, 0.8, 4),
    factions: ['SIR'], traits: ['GUARD'],
    trait: { name: '성전 기사', desc: '신성 피해량 +20%. 전투 스킬을 쓸 때 최대 체력 25% 보호막.', effect: { mods: [inc('holy', 0.2)], hooks: { onSkill(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.25); } } } },
  },
  doros: {
    ctype: 'CMD', ttype: 'divine', faith: 'sirius', weapon: G('빵 투척', 'holy', 1.0, 3, 0.6, 6, 2),
    factions: ['SIR'], traits: ['CHEF'],
    trait: {
      name: '성찬', desc: '요리받은 아군의 고유 신앙이 이번 전투 동안 깨어난다 (신성력 · 신권 대행 사용 가능). 이미 디바인이면 신성력 획득 +100%p.',
      effect: { hooks: { onInflict(b, _u, t, s) { if (s.key === 'sup.doros') awaken(b, t); } } },
    },
  },
  demiurgos: {
    ctype: 'SPEC', ttype: 'minor', faith: 'sirius', weapon: K('친구의 손', 'psy', 1.0, 2, 0.8, 3),
    factions: ['SIR'], traits: ['RFRIEND', 'OCCULT'],
    trait: {
      name: '친구의 손길', desc: '회복받은 아군은 3초간 피해량 경감 10%.',
      effect: { hooks: { onHealDone(b, u, t, amt) {
        if (amt <= 0) return;
        b.buff(u, t, 'demi.friend', 3, { taken: [red('all', Math.min(0.3, 0.1 * gw(u)))] });
      } } },
    },
  },

  // ───────────────────────── 범은하 공동체
  aiden: {
    ctype: 'VAN', ttype: 'special', faith: 'science', weapon: K('액체 금속 칼날', 'phys', 0.75, 1, 0.75, 5),
    factions: ['TIME'], traits: ['OCCULT'],
    trait: {
      name: '고양이 형태', desc: '전투 시작 5초 · 회피 시 2초 · 처치 시 5초 동안 고양이 형태: 회피 +15%p, 공격 속도 +30%p.',
      effect: { hooks: {
        onStart(b, u) { cat(b, u, 5); },
        onEvade(b, u) { cat(b, u, 2); },
        onKill(b, u) { cat(b, u, 5); },
      } },
    },
    specialAugs: [
      sp('aiden', 'cat', '고양이 상시', '고양이 형태가 계속 유지되고 이동 속도 +40%, 최대 체력 -30%.', { pct: { maxHp: -0.3 }, stats: { moveSpd: 0.4 }, hooks: { onStart(b, u) { cat(b, u, 999); } } }),
      sp('aiden', 'bar', '바텐더 근무', '액체 금속 변형이 바텐더 근무로 바뀐다: 적에게 파고드는 대신 체력 비율이 가장 낮은 아군을 기술 위력 180% 회복 (피해 · 공포 없음).', { setup: (u) => {
        const base = u.skill;
        if (!base) return;
        u.skill = { ...base, needsRange: false, tag: () => '약한 아군 회복', cast(b, self) {
          if (!b.enemiesOf(self).length) return false;
          const a = b.lowestHpAlly(self);
          if (!a || b.hpPct(a) > 0.95) return false;
          b.heal(self, a, b.P(self, 'tech') * 1.8);
          b.fx(a.x, a.y, 0, 'holy', 'heal');
          return true;
        } };
      } }, ex('aiden', 'illusion')),
      sp('aiden', 'crystal', '수정 섭취', '처치하면 최대 체력 7.5% 회복, 콤보 +2.', { hooks: { onKill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * 0.075); u.combo += 2; } } }),
      sp('aiden', 'nine', '아홉 목숨', '쓰러질 피해를 받으면 전투당 1회 체력 1로 버티고, 고양이 형태로 3초간 모든 공격을 회피한다 (회피 +100%p, 피해 무시).', { hooks: { onLethal(b, u) {
        if (u.mem.nine) return false;
        u.mem.nine = 1;
        u.hp = 1;
        cat(b, u, 3);
        b.buff(u, u, 'aiden.nine', 3, { delta: { eva: 1 }, label: '아홉 목숨' });
        u.mem.invulnUntil = b.t + 3;
        b.emit({ k: 'mark', id: u.id, name: '아홉 목숨', style: 'immortal' });
        return true;
      } } }),
      sp('aiden', 'tail', '칼날 꼬리', '고양이 형태일 때 기본 공격이 대상 주변 1칸 적에게 50% 피해를 준다.', { hooks: { onBasic(b, u, t) {
        if (!b.has(u, 'buff', 'aiden.cat')) return;
        for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) proc(b, u, e, b.S(u, 'strike') * (u.weapon?.mult || 1) * 0.5, 'phys', 'strike');
      } } }, ex('aiden', 'human')),
      sp('aiden', 'illusion', '환술 심화', '액체 금속 변형의 공포 확률 40% → 70%, 지속 0.8 → 1.5초.', setSk((s) => { s.fearChance = 0.7; s.fear = 1.5; })),
      sp('aiden', 'gap', '시간의 틈', '고양이 형태가 될 때 주변 2칸 아군이 2초간 공격 속도 +30%.', { hooks: { onInflict(b, u, t, s) {
        if (s.key !== 'aiden.cat' || t !== u) return;
        for (const a of b.around(u, 2, b.alliesOf(u, false))) b.buff(u, a, 'aiden.gap', 2, { delta: { atkSpd: 0.3 }, label: '시간의 틈' });
      } } }, ex('aiden', 'human')),
      sp('aiden', 'human', '인간 형태', '고양이 형태가 되지 않는다. 대신 최대 체력 +40%, 방어도 +30, 스킬 피해 +50%.', {
        pct: { maxHp: 0.4 }, stats: { armor: 30 }, mods: [inc('skill', 0.5)], setup: (u) => { u.mem.noCat = 1; },
      }, ex('aiden', 'cat')),
    ],
  },
  vivian: {
    ctype: 'SPEC', ttype: 'minor', faith: 'science', weapon: G('다트 소총', 'phys', 1.0, 3, 0.9, 5, 2),
    factions: ['PAN', 'VOYAGE'], traits: ['BUDDY'],
    trait: {
      name: '생태 분석', desc: '비비안과 리키의 기본 공격이 대상의 방어도를 10%p 깎는다 (최대 3중첩, 5초).',
      effect: { hooks: {
        onBasic(b, u, t, r) { if (r.amount > 0) shred(b, u, t); },
        onTick(b, u) {
          if (u.mem.vivInit) return;
          u.mem.vivInit = 1;
          for (const pet of summonsOf(b, u)) pet.hooks.push({ onBasic(bb, self, t, r) { if (r.amount > 0) shred(bb, self, t); } });
        },
      } },
    },
  },
  yupito: {
    ctype: 'SPEC', ttype: 'major', faith: 'science', weapon: G('용접 아크건', 'elec', 0.8, 3, 0.8, 10, 2.5),
    factions: ['PAN'], traits: ['ENG'],
    trait: {
      name: '강철의 마녀', desc: '전투 시작 시 무작위 아군 1명에게 특제 장비: 피해 +20%, 방어도 +200. 공동체 · 엔지니어 아군이면 2배.',
      effect: { hooks: { onStart(b, u) {
        const as = b.alliesOf(u).filter((a) => !a.isSummon);
        if (!as.length) return;
        const a = as[Math.floor(b.rng.next() * as.length)];
        const k = a.synergies.has('PAN') || a.synergies.has('ENG') ? 2 : 1;
        b.buff(u, a, 'yupito.gear', 999, { mods: [inc('all', 0.2 * k)], delta: { armor: 200 * k }, label: '특제 장비' });
      } } },
    },
  },
  ingel: {
    ctype: 'SPEC', ttype: 'minor', faith: 'selene', weapon: G('음파 마이크', 'psy', 0.9, 3, 0.9, 8, 2),
    factions: ['PAN'], traits: ['STAR', 'SCHEME'],
    trait: {
      name: '무대 위의 달', desc: '출전한 다른 아군 기물 1명당 피해 +10%p, 소환물 · 시설 1개당 +5%p.',
      effect: { hooks: { onTick(b, u) {
        if (u.mem.ingInit) return;
        u.mem.ingInit = 1;
        const as = b.alliesOf(u, false);
        const v = (0.1 * as.filter((a) => !a.isSummon).length + 0.05 * as.filter((a) => a.isSummon).length) * gw(u);
        u.mods.push(inc('all', v));
      } } },
    },
  },
  onyx: {
    ctype: 'SPEC', ttype: 'psionic', faith: 'human', weapon: G('합창', 'psy', 1.0, 3, 0.9, 10, 2),
    factions: ['PAN'], traits: ['COND'],
    trait: { name: '오닉스 합창', desc: '이성이 낮을수록 주는 정신 피해 증가 (이성 -100에서 최대 +30%).', effect: { hooks: {
      dmgMult: (_b, u, t, o) => (o.elem === 'psy' && t !== u && u.reason !== null && u.reason < 0 ? 1 + 0.3 * (-u.reason / 100) : 1),
    } } },
    psi: { desc: '초당 이성 -2 (합창이 이성을 깎는다).', effect: { hooks: { onTick(b, u, dt) { u.mem.ot = (u.mem.ot || 0) + dt; if (u.mem.ot >= 1) { u.mem.ot -= 1; b.addReason(u, -2); } } } } },
  },
  rus: {
    ctype: 'MARK', ttype: 'major', faith: 'zeus', weapon: G('쌍권총', 'phys', 0.7, 3, 0.8, 12, 2),
    factions: ['PAN'], traits: [],
    trait: { name: '약탈자', desc: '적을 처치하면 크레딧 +1 (전투당 3회).', effect: { hooks: { onKill(_b, u) { cnt(u, 'g_loot', 3); } } } },
  },

  // ───────────────────────── 엘베스타드 일가
  amundsen: {
    ctype: 'CMD', ttype: 'special', faith: 'human', weapon: G('에란테-7703 포격', 'phys', 1.0, 4, 1.0, 2, 4, { tactical: true }),
    factions: ['FAM'], traits: ['EXPLORER', 'NAV'],
    trait: { name: '탐험가', desc: '고유 전설 장비 [그늘]을 장착한 채 합류한다. 포격은 전술 위력으로 계산한다.' },
    specialAugs: [
      sp('amundsen', 'shade', '그늘의 되감기', '전투당 1회, 쓰러질 피해를 받으면 체력 50%로 되돌아온다.', { hooks: { onLethal(b, u) {
        if (u.mem.rewind) return false;
        u.mem.rewind = 1; u.hp = b.S(u, 'maxHp') * 0.5;
        b.emit({ k: 'status', id: u.id, name: '되감기' });
        return true;
      } } }),
      sp('amundsen', 'mount', '7703 탑승', '움직이지 않지만 포격 피해 ×1.6, 사거리 +2.', { stats: { range: 2 }, setup: (u) => { u.immobile = true; if (u.weapon) u.weapon = { ...u.weapon, mult: u.weapon.mult * 1.6 }; } }, ex('amundsen', 'order')),
      sp('amundsen', 'order', '단장의 명령', '기본 공격을 하지 않지만 전술 위력 +48.', { setup: (u) => { u.noAttack = true; u.mem.tacBonus = (u.mem.tacBonus || 0) + 48; } }),
      sp('amundsen', 'volley', '일제 포격', '스킬 포격이 대상 주변 1칸 적에게도 60% 피해를 준다.', { hooks: { onDeal(b, u, t, _r, o) {
        if (o.tag !== 'skill' || o.kind !== 'shoot') return;
        b.fx(t.x, t.y, 1, 'phys');
        for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) b.dealDamage(u, e, b.P(u, 'shoot') * u.sk.mult * 0.6, { elem: 'phys', tag: 'proc', kind: 'shoot', pen: u.sk.pen });
      } } }),
      sp('amundsen', 'journal', '탐험 일지', '이번 런에서 방문한 사건 노드 1개당 아문센의 전술 위력 +1% (최대 +30%).', { setup: (u, _b, ctx) => {
        u.mem.tacPct = (u.mem.tacPct || 0) + Math.min(0.3, 0.01 * (ctx.run?.seenEvents?.length || 0));
      } }),
      sp('amundsen', 'motto', '엘베스타드 가훈', '전투 시작 시 엘베스타드 아군 전원 피해량 경감 10%, 최대 체력 +10% (전투 동안).', { hooks: { onStart(b, u) {
        for (const a of b.alliesOf(u)) {
          if (a.isSummon || !a.synergies.has('FAM')) continue;
          const add = a.st.maxHp * 0.1;
          a.st.maxHp += add; a.hp += add;
          b.buff(u, a, 'amundsen.motto', 999, { taken: [red('all', 0.1)], label: '엘베스타드 가훈' });
        }
      } } }),
      sp('amundsen', 'cover', '그늘 아래', '아문센의 체력이 처음 50% 이하가 되면 모든 아군이 3초간 피해량 경감 60%.', { hooks: { onHurt(b, u) {
        if (u.mem.coverUsed || b.hpPct(u) > 0.5) return;
        u.mem.coverUsed = 1;
        for (const a of b.alliesOf(u)) b.buff(u, a, 'amundsen.cover', 3, { taken: [red('all', 0.6)], label: '그늘 아래' });
      } } }),
      sp('amundsen', 'maint', '30년의 정비', '화력 지원 쿨다운 -2초, 방어도 관통 30% → 60%.', { setup: (u) => { u.cdMax = Math.max(1, u.cdMax - 2); u.sk.pen += 0.3; } }),
    ],
  },
  rachel: {
    ctype: 'VAN', ttype: 'psionic', faith: 'human', weapon: K('암흑물질 노심', 'psy', 0.9, 1, 0.85, 4),
    factions: ['FAM', 'TIME', 'VOYAGE'], traits: [],
    trait: {
      name: '암흑물질 붕괴', desc: '피니쉬가 대상 주변 1칸 적에게 타격 위력 50% 고정 피해를 주고, 준 피해의 20%를 보호막으로 얻는다.',
      effect: { hooks: { onBasic(b, u, t) {
        if (!u.mem.finished) return;
        let sum = 0;
        for (const e of b.around(t, 1, b.enemiesOf(u))) sum += b.dealDamage(u, e, b.S(u, 'strike') * 0.5, { elem: 'true', tag: 'proc' }).amount;
        b.fx(t.x, t.y, 1, 'psy');
        if (sum > 0) b.shield(u, sum * 0.2);
      } } },
    },
    psi: { desc: '피니쉬마다 이성 -5, 주변 1칸 아군이 맞을 때 +4 (1초에 1회).', effect: { hooks: {
      onBasic(b, u) { if (u.mem.finished) b.addReason(u, -5); },
      onAllyHurt(b, u, ally) { if (b.dist(u, ally) <= 1 && icd(b, u, 'rIcd', 1)) b.addReason(u, 4); },
    } } },
  },
  oliver: {
    ctype: 'SPEC', ttype: 'major', faith: 'hermes', weapon: K('기관사 렌치', 'phys', 0.85, 1, 0.8, 3),
    factions: ['FAM', 'PAN'], traits: ['NAV'],
    trait: { name: '메트로 기관사', desc: '이동 속도가 100%를 넘는 만큼 기술 위력이 1.5배로 오른다.', effect: { hooks: { onStart(b, u) { u.st.tech *= 1 + 1.5 * Math.max(0, b.S(u, 'moveSpd') - 1); } } } },
  },
  rasmus: {
    ctype: 'VAN', ttype: 'minor', faith: 'human', weapon: K('전정가위', 'phys', 1.0, 1, 0.8, 4),
    factions: ['FAM'], traits: ['BUDDY', 'HUNTER'],
    trait: {
      name: '가지치기', desc: '라스무스와 맥스의 공격이 [부상]을 쌓는다 (최대 5, 6초). 부상은 회복 · 보호막을 1회씩 대신 소모시킨다.',
      effect: { hooks: {
        onBasic(b, u, t, r) { if (r.amount > 0) wound(b, u, t); },
        onTick(b, u) {
          if (u.mem.rasInit) return;
          u.mem.rasInit = 1;
          for (const pet of summonsOf(b, u)) pet.hooks.push({ onBasic(bb, self, t, r) { if (r.amount > 0) wound(bb, self, t); } });
        },
      } },
    },
  },
  sigmund: {
    ctype: 'CMD', ttype: 'minor', faith: 'index', weapon: G('은식기 투척', 'phys', 1.1, 3, 0.6, 6, 2),
    factions: ['FAM'], traits: ['GUARD'],
    trait: {
      name: '집사의 예법', desc: '공명 등급이 가장 높은 아군을 모신다 (보좌 우선 대상). 그 기물이 엘베스타드가 아니면 엘베스타드 시너지에 합류시키고, 이미 엘베스타드면 모든 메이저 +5.',
      effect: { setup(u, _b, ctx) {
        const uid = ctx.run ? sigmundTarget(ctx.run) : null;
        if (!uid) return;
        u.hooks.push({ onStart(b, self) {
          const a = b.alliesOf(self).find((x) => x.src?.uid === uid);
          if (a) { a.mem.staffed = 1; self.mem.serveId = a.id; }
        } });
      }},
    },
  },
  gunnir: {
    ctype: 'SPEC', ttype: 'minor', faith: 'index', weapon: G('주방 칼 투척', 'phys', 1.0, 3, 0.8, 5, 2),
    factions: ['FAM'], traits: ['MED', 'CHEF'],
    trait: {
      name: '저택의 실세', desc: '전투 스킬을 쓴 뒤 아군 전원을 기술 위력 25% 회복.',
      effect: { hooks: { onSkill(b, u) {
        for (const a of b.alliesOf(u)) b.heal(u, a, b.P(u, 'tech') * 0.25 * gw(u));
      } } },
    },
  },
  mingki: {
    ctype: 'VAN', ttype: 'special', faith: 'index', weapon: K('발톱', 'phys', 0.65, 1, 0.7, 6),
    factions: ['FAM'], traits: ['INFIL'],
    trait: { name: '내면의 괴물', desc: '체력이 처음 50% 이하가 되면 피해 +80%, 공격 속도 +50%. 전투 스킬을 쓸 때마다 츄르 간식으로 최대 체력 5% 회복.',
      effect: { hooks: { onSkill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * (u.sk.heal ?? 0.05)); } } } },
    specialAugs: [
      sp('mingki', 'awake', '상시 각성', '내면의 괴물이 전투 시작부터 깨어 있지만 초당 최대 체력 2%를 잃는다.', { setup: (u) => { u.sk.monsterAt = 1; }, hooks: {
        onStart(b, u) { u.mem.monster = 1; b.buff(u, u, 'mingki.monster', 999, { delta: { atkSpd: 0.5 }, mods: [inc('all', 0.8)], label: '내면의 괴물' }); },
        onTick(b, u, dt) { u.mem.mt = (u.mem.mt || 0) + dt; if (u.mem.mt >= 1) { u.mem.mt -= 1; if (b.hpPct(u) > 0.1) b.dealDamage(u, u, b.S(u, 'maxHp') * 0.02, { elem: 'true', tag: 'dot', noHooks: true }); } },
      } }),
      sp('mingki', 'master', '저택의 주인', '엘베스타드 아군 전원 피해 +10%.', { hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) if (a.synergies.has('FAM')) b.buff(u, a, 'mingki.master', 999, { mods: [inc('all', 0.1)] }); } } }),
      sp('mingki', 'full', '배부른 고양이', '츄르 사냥 쿨다운 -2초, 츄르 간식 회복 +7.5%p.', { setup: (u) => { u.cdMax = Math.max(1, u.cdMax - 2); u.sk.heal += 0.075; } }),
      sp('mingki', 'appetite', '괴물의 식욕', '각성 중 적을 처치하면 최대 체력 10% 회복, 피해 +10% 누적 (최대 +50%).', { hooks: {
        onKill(b, u) {
          if (!b.has(u, 'buff', 'mingki.monster')) return;
          b.heal(u, u, b.S(u, 'maxHp') * 0.1);
          u.mem.appetite = Math.min(5, (u.mem.appetite || 0) + 1);
        },
        dmgMult: (b, u) => (b.has(u, 'buff', 'mingki.monster') ? 1 + 0.1 * (u.mem.appetite || 0) : 1),
      } }, ex('mingki', 'tame')),
      sp('mingki', 'purr', '그르릉', '각성할 때 주변 2칸 적을 1.5초 공포에 빠뜨린다.', { hooks: { onInflict(b, u, t, s) {
        if (s.key !== 'mingki.monster' || t !== u) return;
        for (const e of b.around(u, 2, b.enemiesOf(u))) fear(b, u, e, 1.5, 1);
      } } }, ex('mingki', 'tame')),
      sp('mingki', 'liquid', '고양이는 액체', '회피 +10%p. 각성 중에는 추가로 +15%p.', { stats: { eva: 0.1 }, hooks: { onInflict(b, u, t, s) {
        if (s.key === 'mingki.monster' && t === u) b.buff(u, u, 'mingki.liquid', 999, { delta: { eva: 0.15 }, label: '액체' });
      } } }),
      sp('mingki', 'second', '두 번째 괴물', '체력이 처음 20% 이하가 되면 2단 각성: 피해 +50%, 흡혈 20%.', { hooks: { onHurt(b, u) {
        if (u.mem.monster2 || b.hpPct(u) > 0.2) return;
        u.mem.monster2 = 1;
        b.buff(u, u, 'mingki.monster2', 999, { mods: [inc('all', 0.5)], delta: { lifesteal: 0.2 }, label: '두 번째 괴물' });
        b.emit({ k: 'status', id: u.id, name: '두 번째 괴물이 깨어났다!' });
      } } }, ex('mingki', 'tame')),
      sp('mingki', 'tame', '얌전한 고양이', '내면의 괴물이 깨어나지 않는다. 츄르 사냥이 그르릉으로 바뀐다: 적에게 뛰어드는 대신 다른 아군 전원을 최대 체력 6% 회복시키고, 자신 포함 아군 전원에게 3초간 최대 체력 10% 보호막을 준다 (피해 없음).', { setup: (u) => {
        u.mem.tame = 1;
        const base = u.skill;
        if (!base) return;
        u.skill = { ...base, needsRange: false, tag: () => '아군 전체 회복 · 보호막', cast(b, self) {
          if (!b.enemiesOf(self).length) return false;
          b.fx(self.x, self.y, 0, 'holy', 'heal');
          for (const a of b.alliesOf(self)) {
            if (a !== self) b.heal(self, a, b.S(a, 'maxHp') * 0.06);
            const before = a.shield;
            b.shield(a, b.S(a, 'maxHp') * 0.1);
            const got = a.shield - before;
            if (got <= 0) continue;
            a.mem.purrSh = (a.mem.purrSh || 0) + got;
            b.applyStatus(self, a, { type: 'buff', key: 'mingki.purr', dur: 3, onExpire(_bb, tgt) { tgt.shield = Math.max(0, tgt.shield - (tgt.mem.purrSh || 0)); tgt.mem.purrSh = 0; } });
          }
          return true;
        } };
      } }, ex('mingki', 'awake')),
    ],
  },

  // ───────────────────────── 사건 전용
  exile: {
    ctype: 'VAN', ttype: 'major', faith: 'emperor', weapon: K('혈검', 'phys', 0.85, 1, 0.8, 4),
    factions: ['KAL'], traits: ['INFIL'],
    trait: { name: '혈족의 갈증', desc: '피니쉬 · 전투 스킬 · 궁극기로 준 피해의 35%만큼 회복.', effect: { hooks: {
      onBasic(b, u, _t, r) { if (u.mem.finished && r.amount > 0) b.heal(u, u, r.amount * 0.35, true); },
      onDeal(b, u, t, r, o) { if (o.tag === 'skill' && t !== u && r.amount > 0) b.heal(u, u, r.amount * 0.35, true); },
    } } },
  },
  thermo: {
    ctype: 'VAN', ttype: 'divine', faith: 'ares', weapon: K('도리와 방패', 'phys', 1.1, 2, 0.85, 3),
    factions: ['HEL'], traits: [],
    trait: {
      name: '팔랑크스', desc: '자신과 주변 1칸 아군의 피해량 경감 10%.',
      effect: { hooks: { onTick(b, u, dt) {
        u.mem.phT = (u.mem.phT || 0) - dt;
        if (u.mem.phT > 0) return;
        u.mem.phT = 0.5;
        aura(b, u, 1, 'thermo.phalanx', { taken: [red('all', 0.1)] });
      } } },
    },
  },
  u404: {
    ctype: 'VAN', ttype: 'minor', faith: 'index', weapon: K('유압 프레스 팔', 'phys', 1.0, 1, 0.85, 3),
    factions: ['PET'], traits: ['ENG'],
    trait: { name: '1원칙', desc: '전투 스킬을 쓸 때마다 피해가 오른다 (전투 동안 중첩).' },
  },
};

// ───────── 특성 보조 함수
function grenShield(b: Battle, u: CUnit) {
  const max = b.S(u, 'maxHp');
  const cap = max * 0.2;
  if (u.shield < cap) b.shield(u, Math.min(max * 0.05, cap - u.shield));
}
function romaniPull(b: Battle, u: CUnit) {
  if (!icd(b, u, 'pullIcd', 3)) return;
  const e = b.farthest(u);
  if (!e) return;
  if (e.big || e.isBoss) { proc(b, u, e, b.S(u, 'strike') * 1.5, 'phys', 'strike'); return; }
  if (b.dist(u, e) > 1) {
    const c = b.freeCellNear(u.x, u.y);
    if (c && b.dist(u, c) <= 1) { e.x = e.px = c.x; e.y = e.py = c.y; e.moveT = 0; b.fx(c.x, c.y, 0, 'psy'); }
  }
  proc(b, u, e, b.S(u, 'strike') * 0.5, 'phys', 'strike');
}
function cat(b: Battle, u: CUnit, dur: number) {
  if (u.mem.noCat) return; // 인간 형태
  b.buff(u, u, 'aiden.cat', dur, { delta: { eva: 0.15, atkSpd: 0.3 }, label: '고양이' });
}
function shred(b: Battle, u: CUnit, t: CUnit) {
  // 우리의 출항기! [정밀 분석]: 최대 5중첩, 중첩당 받는 모든 피해 +15%
  const voy = (u.owner || u).mem.voyViv;
  stack(b, u, t, 'vivian.shred', voy ? 5 : 3, 5, (n) => ({ type: 'buff', armorMul: Math.max(0.1, 1 - Math.min(0.2, 0.1 * gw(u)) * n), label: n === 1 ? '방어 분석' : undefined, ...(voy ? { taken: [vuln('all', 0.15 * n)] } : {}) }));
}
function wound(b: Battle, u: CUnit, t: CUnit) {
  stack(b, u, t, 'wound', Math.round(5 * gw(u)), 6, () => ({}));
}

/** 시그문드가 모시는 기물: 출전한 다른 기물 중 공명 등급이 가장 높은 기물 */
export function sigmundTarget(run: RunState): string | null {
  const dep = run.units.filter((u) => u.pos);
  if (!dep.some((u) => u.defId === 'sigmund')) return null;
  return dep.filter((u) => u.defId !== 'sigmund').sort((a, b) => b.rank - a.rank)[0]?.uid ?? null;
}

// ───────────────────────── 메이저 공용 · 사이오닉 증강
const MAJOR_KO: Record<Major, string> = { vit: '생명력', pow: '전투력', mnd: '정신력', def: '방어력', agi: '기동력' };
export const MAJOR_AUGS: AugDef[] = [
  { id: 'maj.stat', name: '집중 단련', desc: '지정 메이저 +10.', pool: 'major', stack: true, effect: (p) => ({ majors: { [p as Major || 'pow']: 10 } }),
    roll: (pick) => pick(MAJORS), descParam: (p) => `${MAJOR_KO[p as Major]} +10.` },
  { id: 'maj.shoot', name: '사격 교범', desc: '사격 피해량 +20%.', pool: 'major', stack: true, effect: () => ({ mods: [inc('shoot', 0.2)] }) },
  { id: 'maj.strike', name: '타격 교범', desc: '타격 피해량 +20%.', pool: 'major', stack: true, effect: () => ({ mods: [inc('strike', 0.2)] }) },
  { id: 'maj.tech', name: '기술 교범', desc: '기술 피해량 +20%.', pool: 'major', stack: true, effect: () => ({ mods: [inc('tech', 0.2)] }) },
  { id: 'maj.crit', name: '급소 연구', desc: '치명타 피해 +30%p.', pool: 'major', stack: true, effect: () => ({ stats: { critDmg: 0.3 } }) },
  { id: 'maj.hp', name: '체력 단련', desc: '최대 체력 +15%.', pool: 'major', stack: true, effect: () => ({ pct: { maxHp: 0.15 } }) },
  { id: 'maj.reload', name: '재장전 훈련', desc: '재장전 속도 +25%.', pool: 'major', stack: true, effect: () => ({ stats: { reloadSpd: 0.25 } }) },
  { id: 'maj.finish', name: '마무리 일격', desc: '피니쉬 피해량 +40%.', pool: 'major', stack: true, effect: () => ({ mods: [inc('finish', 0.4)] }) },
  { id: 'maj.cdr', name: '전술 숙련', desc: '쿨다운 감소 속도 +20%.', pool: 'major', stack: true, effect: () => ({ stats: { cdr: 0.2 } }) },
  { id: 'maj.dot', name: '지속 피해 연구', desc: '지속 피해량 +30%.', pool: 'major', stack: true, effect: () => ({ mods: [inc('dot', 0.3)] }) },
  { id: 'maj.ultc', name: '충전 회로', desc: '궁극기 충전 효율 +25%.', pool: 'major', stack: true, effect: () => ({ stats: { ultCharge: 0.25 } }) },
  { id: 'maj.ults', name: '선제 장전', desc: '전투 시작 시 궁극기 게이지 +30%.', pool: 'major', effect: () => ({ setup: (u) => { u.mem.ultStart = (u.mem.ultStart || 0) + 0.3; } }) },
];
/** 사이오닉 전공 증강 (학파별 지속 능력 42종): psionic.ts */
export { PSI_AUGS } from './psionic';

// ───────────────────────── 신앙 · 신권 대행
/** 고유 신앙 (디바인만 활성): 신성력 획득 조건 · 상시 버프 */
interface FaithDef { gain: string; buff: string; hooks: Hooks; passive: Effect }
const dv = (b: Battle, u: CUnit, v: number, key = 'fIcd', sec = 0.3) => { if (icd(b, u, key, sec)) b.addDiv(u, v); };
export const FAITH_DEF: Record<FaithId, FaithDef> = {
  emperor: { gain: '결정타 +35', buff: '주는 피해 +10%',
    hooks: { onKill: (b, u) => b.addDiv(u, 35) },
    passive: { mods: [inc('all', 0.1)] } },
  athena: { gain: '적에게 상태이상을 걸 때 +20, 치명타 +5', buff: '효과 명중 +25%p',
    hooks: { onInflict(b, u, t) { if (t.side !== u.side) dv(b, u, 20); }, onDeal(b, u, _t, r) { if (r.crit) dv(b, u, 5, 'atIcd', 0.3); } },
    passive: { stats: { effHit: 0.25 } } },
  hermes: { gain: '이동 1칸 +8, 아군에게 버프를 걸 때 +12, 기본 공격 +2', buff: '이동 속도 +20%, 공격 속도 +10%',
    hooks: { onMove: (b, u) => b.addDiv(u, 8), onInflict(b, u, t) { if (t.side === u.side && t !== u) dv(b, u, 12); }, onBasic(b, u) { dv(b, u, 2, 'hmIcd', 0.4); } },
    passive: { stats: { moveSpd: 0.2, atkSpd: 0.1 } } },
  ares: { gain: '피해를 받을 때 +4, 근접한 적이 있으면 초당 +3', buff: '주변 1칸 적 1명당 피해 +5% (최대 +20%)',
    hooks: {
      onHurt(b, u, _s, r) { if (r.amount > 0) dv(b, u, 4, 'aIcd', 0.2); },
      onTick(b, u, dt) { u.mem.areT = (u.mem.areT || 0) + dt; if (u.mem.areT >= 1) { u.mem.areT -= 1; if (b.around(u, 1, b.enemiesOf(u)).length) b.addDiv(u, 3); } },
    },
    passive: { hooks: { dmgMult: (b, u) => 1 + Math.min(0.2, 0.05 * b.around(u, 1, b.enemiesOf(u)).length) } } },
  hades: { gain: '누구든 쓰러질 때 +25', buff: '쓰러진 아군 1명당 피해 +8%',
    hooks: { onAnyDeath: (b, u) => b.addDiv(u, 25) },
    passive: { hooks: { dmgMult: (b, u) => 1 + 0.08 * b.units.filter((x) => !x.alive && x.side === u.side && !x.isSummon).length } } },
  zeus: { gain: '치명타 +10', buff: '치명타 확률 +10%p',
    hooks: { onDeal(b, u, _t, r) { if (r.crit) dv(b, u, 10, 'zIcd', 0.2); } },
    passive: { stats: { crit: 0.1 } } },
  selene: { gain: '회복 · 보호막 부여 +6 (40초 이후 2배)', buff: '주는 회복량 +20%',
    hooks: { onHealDone(b, u, _t, amt) { if (amt > 0) dv(b, u, b.t > 40 ? 12 : 6); } },
    passive: { hooks: { healMult: () => 1.2 } } },
  human: { gain: '다른 아군과 같은 적을 공격할 때 +4', buff: '다른 아군과 같은 적을 공격하면 피해 +10%',
    hooks: { onDeal(b, u, t, r) { if (r.amount > 0 && b.alliesOf(u, false).some((a) => a.target === t)) dv(b, u, 4); } },
    passive: { hooks: { dmgMult: (b, u, t) => (b.alliesOf(u, false).some((a) => a.target === t) ? 1.1 : 1) } } },
  index: { gain: '피해를 줄 때 +3 (3초마다 바뀌는 상승장에서는 2배)', buff: '보유 크레딧 50당 피해 +3% (최대 +15%)',
    hooks: { onDeal(b, u, _t, r) { if (r.amount > 0) dv(b, u, Math.floor(b.t / 3) % 2 ? 6 : 3, 'iIcd', 0.4); } },
    passive: { hooks: { dmgMult: (b) => 1 + Math.min(0.15, 0.03 * Math.floor(b.ctx.credits / 50)) } } },
  science: { gain: '아군 소환물 · 포탑이 공격할 때 +4', buff: '아군 소환물 · 포탑 피해 +20%',
    hooks: { onAllyBasic(b, u, a) { if (a.isSummon) dv(b, u, 4, 'sIcd', 0.2); } },
    passive: { hooks: { onTick(b, u) {
      if ((u.mem.sciT || 0) > 0 || b.t < 0.5) return;
      u.mem.sciT = 1;
      for (const a of b.alliesOf(u)) if (a.isSummon && !a.mem.sciAmp) { a.mem.sciAmp = 1; a.mods.push(inc('all', 0.2)); }
    } } } },
  sirius: { gain: '신성 피해를 줄 때 +4, 아군을 회복 · 보호할 때 +6', buff: '주는 신성 피해 +20%, 받는 신성 피해 -20%',
    hooks: {
      onDeal(b, u, _t, r, o) { if (r.amount > 0 && o.elem === 'holy') dv(b, u, 4); },
      onHealDone(b, u, t, amt) { if (amt > 0 && t !== u) dv(b, u, 6, 'hIcd', 0.3); },
    },
    passive: { mods: [inc('holy', 0.2)], taken: [red('holy', 0.2)] } },
};
/** 신권 대행 기본형 (전투 유형별) */
export const DIVINE_ACT: Record<CType, { name: string; desc: string }> = {
  MARK: { name: '심판의 탄환', desc: '탄창을 즉시 채우고, 다음 탄창 전부 신성 관통탄' },
  VAN: { name: '성전 돌입', desc: '대상 옆으로 돌입해 2초 무적, 주변 1칸 적에게 타격 위력 300% 신성 피해' },
  SPEC: { name: '기적', desc: '전투 스킬을 즉시 2회 연속 시전' },
  CMD: { name: '신탁', desc: '6초간 아군 전술 위력 ×2' },
};
const mainPow = (b: Battle, u: CUnit) => (u.ctype === 'MARK' ? b.S(u, 'shoot') : u.ctype === 'VAN' ? b.S(u, 'strike') : b.P(u, 'tech'));

DIVINE_HOOK.act = (b, u) => {
  // 장착한 성유물이 신권 대행 (강화하면 다음 전투 한정 ×3). 성유물이 없으면 (성찬으로 깨어난 기물) 전투 유형 기본형
  const rel = u.relic ? RELIC_BY_ID[u.relic] : null;
  if (rel) { rel.act(b, u, u.mem.enh || 1); return; }
  switch (u.ctype) {
    case 'MARK':
      u.reloadT = 0; u.ammo = u.weapon?.mag || 1;
      u.mem.holyShots = u.weapon?.mag || 1;
      break;
    case 'VAN': {
      const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
      if (t) blinkTo(b, u, t);
      u.mem.invulnUntil = b.t + 2;
      b.fx(u.x, u.y, 1, 'holy');
      for (const e of b.around(u, 1, b.enemiesOf(u))) b.dealDamage(u, e, b.S(u, 'strike') * 3, { elem: 'holy', tag: 'skill', kind: 'strike' });
      break;
    }
    case 'SPEC':
      for (let i = 0; i < 2 && u.skill && b.enemiesOf(u).length; i++) { if (u.skill.cast(b, u)) for (const h of u.hooks) h.onSkill?.(b, u); }
      break;
    case 'CMD':
      b.mem[`oracle${u.side}`] = b.t + 6;
      break;
  }
};

/** 디바인 체계 활성화 (디바인 기물 · 도로스의 성찬) */
export function enableDivine(u: CUnit, faith: FaithId, capBonus: number) {
  u.div = 0; u.divGot = 0; u.divUsed = false; u.divCap = CFG.divCap + capBonus;
  u.faith = faith;
  u.hooks.push(FAITH_DEF[faith].hooks);
  u.hooks.push({ onTick(b, self, dt) { self.mem.divT = (self.mem.divT || 0) + dt; if (self.mem.divT >= 1) { self.mem.divT -= 1; b.addDiv(self, 2); } } });
}
function awaken(b: Battle, t: CUnit) {
  if (t.isSummon) return;
  if (t.div === null) {
    const f = t.src?.faith || REWORK[t.defId]?.faith;
    if (!f) return;
    enableDivine(t, f, 0);
    b.emit({ k: 'status', id: t.id, name: `${FAITH_NAME[f]} 각성` });
  } else if (!t.mem.dorosBoost) { t.mem.dorosBoost = 1; t.mem.divBoost = (t.mem.divBoost || 0) + 1; }
}

/** 적: 전원 이성 50으로 시작, 정신 피해를 받을 때마다 -4 */
export const ENEMY_PSI: Hooks = { onHurt(b, u, _s, _r, o) { if (o.elem === 'psy') b.addReason(u, -4); } };

/** 추천 메이저 (스페셜 자동 성장 · 능력치 선택 추천) */
export function recMajors(d: BaseUnit & ReworkDef): Major[] {
  const main: Major = d.ctype === 'SPEC' || d.ctype === 'CMD' ? 'mnd' : 'pow';
  const second: Major = d.ctype === 'VAN' ? 'vit' : d.ctype === 'MARK' ? 'agi' : d.ctype === 'CMD' ? 'def' : 'vit';
  return [main, second];
}

/** 표시용: 무기 한 줄 요약 */
export function weaponLine(w: Weapon): string {
  if (w.kind === 'none') return `${w.name} · 기본 공격 없음`;
  const pos = w.range <= 1 ? '근거리' : w.range <= 3 ? '중거리' : '원거리';
  const pow = w.tactical ? '전술 위력' : w.type === 'shoot' ? '사격 위력' : '타격 위력';
  const body = w.kind === 'mag' ? `탄 ${w.mag} · 재장전 ${w.reload}초` : `콤보 ${w.combo} (피니쉬 ×${CFG.finishMult})`;
  return `${pos} ${w.range} · ${w.name} · ${pow} ${pct(w.mult)} · ${body}`;
}

void skillHit;

// ───────────────────────── 밸런스 보정 (1000판 분석 반영)
/** 명사수 기본 공격 계수 전반 상향 (지원형 오르카 제외) */
export const MARK_BASIC = 1.35; // 명사수 기본 공격 계수 배율 (오르카 제외). 1.25 → 1.35 (+8%)
/** 하위권 기물 보정: w = 기본 공격 계수 배율, s = 스킬 주 계수(피해 · 회복 · 보호막) 배율 */
export const TUNE: Record<string, { w?: number; s?: number }> = {
  falcon: { w: 1.35, s: 1.3 }, west: { w: 1.3, s: 1.3 }, argon: { w: 1.3, s: 1.3 }, romani: { w: 1.1, s: 1.15 },
  gebek: { w: 1.1, s: 1.15 }, mirinae: { w: 1.05, s: 1.15 }, odysseus: { w: 1.15, s: 1.2 }, yupito: { w: 1.25, s: 1.35 },
  joshua: { w: 1.2, s: 1.35 }, iris: { w: 1.15, s: 1.2 }, phyllis: { w: 1.2, s: 1.25 }, eleni: { w: 1.1, s: 1.15 },
  kyle: { w: 1.1, s: 1.2 }, temur: { s: 1.1 }, vivian: { w: 1.1, s: 1.1 },
  zina: { w: 0.85, s: 0.85 }, skadi: { w: 0.85, s: 0.85 }, // 화학 · 전기는 방어도를 절반만 받아 초반 가치가 높다
};
/** 스킬 계수 중 배율을 적용할 항목 */
export const TUNE_KEYS = ['mult', 'heal', 'shield', 'snipe', 'supply'];
