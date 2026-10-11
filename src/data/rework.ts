// 시스템 리워크: 기물별 전투 유형 · 전술 유형 · 무기 · 고유 특성 · 성장 · 스페셜 증강 · 이성 규칙 · 신앙
import { CFG } from '../config';
import { type Battle, type CUnit, DIVINE_HOOK, type Hooks, type Status } from '../engine/combat';
import { type AugDef, type Effect, applyLive, inc, red, vuln } from '../engine/effects';
import { type CType, type Elem, type FaithId, FAITH_NAME, type Major, MAJORS, type RunState, type Weapon } from '../types';
import { itemEffect } from './items';
import { blinkTo, lineTargets, pct, skillHit, summonsOf } from './kit';
import { kairoSnipe } from './rosterB';
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
const harmful = (s: Status) => (s.type !== 'buff' || s.key === 'corrode' || s.key === 'slow' || s.key === 'suppress' || !!s.taken?.some((t) => t.kind === 'vuln')) && s.key !== 'frenzy';
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

// ───────── 성장 수치 조회
const gv = (g: Record<string, number>, k: string) => g[k] || 0;

// ───────── 스페셜 증강
const sp = (owner: string, id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef =>
  ({ ...uaug(owner, `sp.${id}`, name, desc, effect, extra), pool: 'special' });

export const REWORK: Record<string, ReworkDef> = {
  // ───────────────────────── 성간 인류 연합
  yelena: {
    ctype: 'MARK', ttype: 'psionic', faith: 'human', weapon: G('델타-9 제식 권총', 'psy', 0.95, 3, 1.0, 12, 1.5),
    factions: ['UNI'], traits: ['NATURE'],
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
    ctype: 'MARK', ttype: 'major', faith: 'human', weapon: G('깜찍이', 'phys', 1.0, 5, 1.2, 4, 2.5),
    factions: ['UNI'], traits: ['NATURE'],
    trait: {
      name: '물질주의 캠퍼', desc: '장착한 장비 · 개조부품 · 임시 장비 1개당 회피 · 치명타 확률 +5%p (최대 +30%p).',
      effect: { hooks: { onStart(_b, u) {
        const n = (u.src?.items.filter(Boolean).length || 0) + (u.src?.mod ? 1 : 0) + (u.tempItems?.length || 0);
        const v = Math.min(0.3, 0.05 * n);
        u.st.eva += v; u.st.crit += v;
      } } },
    },
  },
  gebek: {
    ctype: 'MARK', ttype: 'major', faith: 'human', weapon: G('헤비 버니', 'phys', 0.45, 4, 0.5, 40, 4.5),
    factions: ['UNI'], traits: ['ENG'],
    trait: {
      name: '괴수', desc: '기본 공격이 맞으면 25% 확률로 [제압]: 대상의 다음 공격 피해가 1이 된다.',
      effect: { hooks: { onBasic(b, u, t, r) { if (r.amount > 0 && t.alive && b.rng.chance(0.25)) b.applyStatus(u, t, { type: 'buff', key: 'suppress', dur: 10, label: '제압' }); } } },
    },
  },
  donovan: {
    ctype: 'SPEC', ttype: 'special', faith: 'human', weapon: K('단분자 와이어', 'phys', 0.8, 1, 0.8, 4),
    factions: ['UNI'], traits: ['INFIL', 'BUDDY'],
    trait: { name: '자안의 사수', desc: '기술 피해도 치명타가 터진다. 체력 비율이 가장 낮은 적을 우선 노린다.', effect: { setup: (u) => { u.mem.techCrit = 1; u.mem.lowestFocus = 1; } } },
    specialAugs: [
      sp('donovan', 'eye', '자안 개방', '기술 피해가 치명타로 터지면 기술 쿨다운 -1초.', { hooks: { onDeal(_b, u, _t, r, o) { if (r.crit && o.kind === 'tech') u.cd -= 1; } } }),
      sp('donovan', 'crow', '까악이 해킹', '까악이의 공격이 30% 확률로 1초 감전을 건다.', { hooks: { onStart(_b, u) { u.mem.crowShock = 1; } } }),
      sp('donovan', 'shadow', '그림자 와이어', '피니쉬가 대상 주변 1칸 적에게 타격 위력 80% 연쇄 피해를 준다.', { hooks: { onBasic(b, u, t) {
        if (!u.mem.finished) return;
        for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) proc(b, u, e, b.S(u, 'strike') * 0.8, 'phys', 'strike');
      } } }),
    ],
  },
  chloe: {
    ctype: 'SPEC', ttype: 'minor', faith: 'science', weapon: G('다트 권총', 'phys', 1.0, 3, 0.9, 6, 1.8),
    factions: ['UNI'], traits: ['MED', 'STAR'],
    trait: {
      name: '항밈 처방', desc: '회복할 때 대상의 해로운 상태이상 1개를 제거한다.',
      effect: { hooks: { onHealDone(_b, u, t) {
        const i = t.statuses.findIndex(harmful);
        if (i < 0) return;
        t.statuses.splice(i, 1);
        cnt(u, 'g_clin', 3);
      } } },
    },
    growth: { name: '임상 기록', desc: '상태이상을 제거할 때마다 효과 명중 +0.2%p (전투당 3회, 상한 +20%p).', effect: (g) => ({ stats: { effHit: Math.min(0.2, 0.002 * gv(g, 'clin')) } }) },
  },
  west: {
    ctype: 'MARK', ttype: 'minor', faith: 'human', weapon: G('리벳건', 'phys', 0.6, 3, 0.6, 20, 3),
    factions: ['UNI'], traits: ['ENG'],
    trait: {
      name: '현장 반장', desc: '포탑의 공격이 웨스트 사격 위력 15%의 고정 피해를 추가로 준다.',
      effect: { hooks: { onTick(b, u) {
        if (u.mem.westInit) return;
        u.mem.westInit = 1;
        for (const tur of b.units) {
          if (tur.defId !== 'turret' || tur.side !== u.side) continue;
          tur.st.atkSpd += u.mem.westAs || 0;
          tur.hooks.push({
            onBasic(bb, self, tgt, r) { if (r.amount > 0 && tgt.alive) bb.dealDamage(self, tgt, bb.S(u, 'shoot') * 0.15, { elem: 'true', tag: 'proc', noHooks: true }); },
            onKill() { u.mem.g_wlog = (u.mem.g_wlog || 0) + 1; },
          });
        }
      } } },
    },
    growth: { name: '정비 일지', desc: '포탑이 처치할 때마다 포탑 공격 속도 +0.3% (상한 +30%).', effect: (g) => ({ setup: (u) => { u.mem.westAs = Math.min(0.3, 0.003 * gv(g, 'wlog')); } }) },
  },

  // ───────────────────────── 주식회사 페트라
  lindiwe: {
    ctype: 'VAN', ttype: 'major', faith: 'index', weapon: K('방어막 건틀릿', 'phys', 0.9, 1, 0.8, 3),
    factions: ['PET'], traits: [],
    trait: {
      name: '특별경호팀', desc: '자신과 주변 1칸 아군의 받는 피해 -30%p. 주변 아군이 받는 피해의 절반은 린디웨가 나눠 받는다.',
      effect: { hooks: { onTick(b, u, dt) {
        u.mem.lindT = (u.mem.lindT || 0) - dt;
        if (u.mem.lindT > 0) return;
        u.mem.lindT = 0.5;
        for (const a of b.around(u, 1, b.alliesOf(u))) {
          b.applyStatus(u, a, { type: 'buff', key: 'lindiwe.guard', dur: 0.7, taken: [red('all', 0.3)], share: a === u ? undefined : u, shareRate: 0.5 });
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
        if (r.amount <= 0 || (o.tag !== 'basic' && o.tag !== 'skill') || !b.rng.chance(0.2) || !icd(b, u, 'orcaIcd', 1)) return;
        const es = b.enemiesOf(u);
        if (es.length) b.stun(u, es[Math.floor(b.rng.next() * es.length)], 0.6);
      } } },
    },
    growth: { name: '재정 건전성', desc: '전투 후 이자로 받은 크레딧 1당 기술 위력 +0.5 (상한 +40).', effect: (g) => ({ stats: { tech: Math.min(40, 0.5 * gv(g, 'fin')) } }) },
  },
  franze: {
    ctype: 'CMD', ttype: 'major', faith: 'index', weapon: K('에너지 블레이드', 'phys', 0.9, 1, 0.6, 4),
    factions: ['PET'], traits: ['TIME'],
    trait: {
      name: '은하법 검사', desc: '흡혈 +10%p. 기본 공격이 맞은 적에게 5초간 [심판]: 그동안 아군이 준 피해의 20%를 기록하고, 끝날 때 기록의 100%를 고정 피해로 정산한다.',
      effect: {
        stats: { lifesteal: 0.1 },
        hooks: { onBasic(b, u, t, r) {
          if (r.amount <= 0 || !t.alive || t.statuses.some((s) => s.key === 'franze.judge')) return;
          b.applyStatus(u, t, { type: 'buff', key: 'franze.judge', dur: 5, rec: 0, label: '심판',
            onExpire(bb, tgt, s) { if (s.rec && s.src && tgt.alive) bb.dealDamage(s.src, tgt, s.rec, { elem: 'true', tag: 'proc' }); } });
        } },
      },
    },
  },
  grenholm: {
    ctype: 'VAN', ttype: 'major', faith: 'index', weapon: K('7중 방호 블레이드', 'phys', 1.1, 1, 0.8, 3),
    factions: ['PET'], traits: ['STAR'],
    trait: {
      name: '7중 방호 슈트', desc: '기본 공격 · 기술을 쓸 때마다 최대 체력 5% 보호막 (최대 30%까지 쌓임).',
      effect: { hooks: {
        onBasic(b, u) { grenShield(b, u); },
        onSkill(b, u) { grenShield(b, u); },
      } },
    },
  },
  lars: {
    ctype: 'CMD', ttype: 'special', faith: 'index', weapon: { name: '비무장', kind: 'none', type: 'shoot', elem: 'phys', interval: 1, range: 3, mult: 0 },
    factions: ['PET'], traits: ['BUDDY'],
    trait: {
      name: '합리적인 거래', desc: '기본 공격을 하지 않는다. 라르스가 함께한 뒤 번 크레딧 10당 경호원 메이저 +1 (100에서 상한 +10). 이자 상한 +2.',
      effect: { setup: (u) => { u.mem.summonMaj = Math.min(10, Math.floor(gv(u.src?.grow || {}, 'earn') / 10)); } },
    },
    specialAugs: [
      sp('lars', 'bribe', '매수', '거래 대상 적이 4초간 공포에 걸리고 받는 피해 +25%.', { hooks: { onSkill(b, u) {
        const t = b.units.find((e) => e.alive && e.side !== u.side && e.statuses.some((s) => s.key === 'deal.lars'));
        if (t) b.applyStatus(u, t, { type: 'fear', key: 'fear', dur: 4, taken: [vuln('all', 0.25)] });
      } } }),
      sp('lars', 'ledger', '장부 정리', '경호원이 1명 줄지만, 전투 승리 시 크레딧 +3.', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) - 1; } },
        { after: (run, _u, won) => { if (won) run.credits += 3; } }),
      sp('lars', 'pen', '직접 협상', '비무장 해제: 만년필을 던진다 (사격, 탄 1 · 재장전 1.5초, 계수 180%).', { setup: (u) => {
        u.noAttack = false;
        u.weapon = G('만년필', 'phys', 1.0, 3, 1.8, 1, 1.5);
        u.atk = { type: 'shoot', elem: 'phys', interval: 1.0 };
      } }),
    ],
  },
  falcon: {
    ctype: 'MARK', ttype: 'major', faith: 'science', weapon: G('레일건', 'phys', 1.2, 6, 1.3, 3, 3.5),
    factions: ['PET'], traits: ['ENG'],
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
    factions: ['KAL'], traits: ['STAR'],
    trait: {
      name: '점괘', desc: '전투 시작 시 점괘를 본다. 길: 아군 전원 12초간 피해 +12%. 흉: 아군 전원 6초간 받는 피해 +8%. 이성이 높을수록 길이 잘 나온다.',
      effect: { hooks: { onStart(b, u) {
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
    factions: ['KAL'], traits: [],
    trait: {
      name: '사이오닉 영사', desc: '기본 공격이 맞으면 대상 주변 2칸의 다른 적에게 튕겨 기술 위력 50% 정신 피해.',
      effect: { hooks: { onBasic(b, u, t, r) {
        if (r.amount <= 0) return;
        const e = b.nearest(t, b.around(t, 2, b.enemiesOf(u)).filter((x) => x !== t));
        if (e) proc(b, u, e, b.P(u, 'tech') * 0.5, 'psy', 'tech');
      } } },
    },
    psi: { desc: '전투 스킬 사용 시 이성 -10, 결정타 +6.', effect: { hooks: { onSkill: (b, u) => b.addReason(u, -10), onKill: (b, u) => b.addReason(u, 6) } } },
  },
  temur: {
    ctype: 'VAN', ttype: 'major', faith: 'emperor', weapon: K('검투사 대검', 'phys', 1.0, 1, 0.85, 3),
    factions: ['KAL'], traits: ['NATURE'],
    trait: {
      name: '투사', desc: '효과 저항 +100%p. 피해를 받을 때마다 타격 피해량 +2%p (전투 동안, 최대 +200%p).',
      effect: {
        stats: { effRes: 1 },
        hooks: {
          onHurt(_b, u, _s, r) { if (r.amount > 0) u.mem.fighter = Math.min(100, (u.mem.fighter || 0) + 1); },
          dmgMult: (_b, u, _t, o) => (o.kind === 'strike' ? 1 + 0.02 * (u.mem.fighter || 0) : 1),
        },
      },
    },
  },
  kairo: {
    ctype: 'MARK', ttype: 'special', faith: 'emperor', weapon: G('안단테-7 저격총', 'phys', 1.0, 6, 1.2, 5, 3),
    factions: ['KAL'], traits: ['CHEF'],
    trait: {
      name: '기다림의 미학', desc: '칵테일 1잔 또는 아군 기본 공격 12회마다 1스택. 8스택이면 안단테-7 저격.',
      effect: { hooks: { onAllyBasic(b, u, a) {
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
    ],
  },
  zahara: {
    ctype: 'VAN', ttype: 'minor', faith: 'emperor', weapon: K('쌍곡도', 'phys', 0.8, 1, 0.7, 5),
    factions: ['KAL'], traits: ['STAR', 'CHEF'],
    trait: {
      name: '복수자', desc: '피해를 받으면 공격자에게 타격 위력 150% 반격. 주변 1칸 아군이 맞았을 때도 50% 확률로 반격 (0.4초에 1회).',
      effect: { hooks: {
        onHurt(b, u, src, r, o) { if (src.side !== u.side && src.alive && r.amount > 0 && o.tag !== 'dot' && icd(b, u, 'zIcd', 0.4)) proc(b, u, src, b.S(u, 'strike') * 1.5, 'phys', 'strike'); },
        onAllyHurt(b, u, ally, src, r) {
          if (src.side === u.side || !src.alive || r.amount <= 0 || b.dist(u, ally) > 1 || !b.rng.chance(0.5) || !icd(b, u, 'zIcd', 0.4)) return;
          proc(b, u, src, b.S(u, 'strike') * 1.5, 'phys', 'strike');
        },
        onAnyDeath(_b, u, dead, killer) {
          if (killer && dead.side !== u.side && killer.statuses.some((s) => s.key === 'sup.zahara')) cnt(u, 'g_recipe', 2);
        },
      } },
    },
    growth: { name: '레시피 복원', desc: '요리받은 아군이 적을 처치할 때마다 [요리] 피해 증가 +1%p (전투당 2회).', effect: (g) => setSk((s) => { s.dmg += 0.01 * gv(g, 'recipe'); }) },
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
        hooks: { onAnyDeath(b, u, dead) { if (dead.side !== u.side && b.rng.chance(0.3)) u.mem.g_genes = (u.mem.g_genes || 0) + 1; } },
      },
    },
    specialAugs: [
      sp('bianca', 'unleash', '베헤모스 해방', '베헤모스 상속률 +60%p, 피해 +50%. 비앙카는 기본 공격을 하지 않는다.', { setup: (u) => {
        u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.6; u.mem.bondAmp = (u.mem.bondAmp || 0) + 0.5; u.noAttack = true;
      } }),
      sp('bianca', 'drone', '드론 편대', '치유 탄환이 대상 주변 1칸 아군에게도 50% 효과.', setSk((s) => { s.splash = 1; })),
      sp('bianca', 'cold', '냉혈 처방', '치유 탄환이 회복 대신 보호막을 준다 (양 +50%).', setSk((s) => { s.shield += s.heal * 1.5; s.heal = 0; })),
    ],
  },

  // ───────────────────────── 헬레니우스 동맹
  zephyro: {
    ctype: 'CMD', ttype: 'psionic', faith: 'athena', weapon: G('깃펜', 'phys', 0.8, 4, 0.6, 2, 1),
    factions: ['HEL'], traits: ['NAV'],
    trait: {
      name: '뱃사공 철학', desc: '기본 공격이 대상 근처의 적 1명을 추가로 맞힌다. 아군 전원 치명타 확률 +20%p.',
      effect: { hooks: {
        onBasic(b, u, t) {
          const e = b.nearest(t, b.enemiesOf(u).filter((x) => x !== t && b.dist(u, x) <= b.S(u, 'range')));
          if (e) b.dealDamage(u, e, b.S(u, 'shoot') * (u.weapon?.mult || 1), { elem: u.atk.elem, tag: 'basic', kind: 'shoot', canMiss: true });
        },
        onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'zephyro.calm', 999, { delta: { crit: 0.2 } }); },
      } },
    },
    psi: { desc: '초당 이성 +1 (느긋함), 염동(전투 스킬) 사용 시 -6.', effect: { hooks: {
      onTick(b, u, dt) { u.mem.zt = (u.mem.zt || 0) + dt; if (u.mem.zt >= 1) { u.mem.zt -= 1; b.addReason(u, 1); } },
      onSkill: (b, u) => b.addReason(u, -6),
    } } },
  },
  phyllis: {
    ctype: 'SPEC', ttype: 'special', faith: 'hades', weapon: K('만능 렌치', 'holy', 0.8, 1, 0.8, 4),
    factions: ['HEL'], traits: ['INFIL'],
    trait: {
      name: '균열 회피', desc: '회피 +10%p. 회피하면 공격자에게 타격 위력 100% 반격하고 무작위 적에게 순간이동한다 (0.5초에 1회).',
      effect: { stats: { eva: 0.1 }, hooks: { onEvade(b, u, src) {
        if (!src.alive || !icd(b, u, 'phIcd', 0.5)) return;
        proc(b, u, src, b.S(u, 'strike'), 'holy', 'strike');
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
    ],
  },
  eleni: {
    ctype: 'VAN', ttype: 'divine', faith: 'selene', weapon: K('진혼 대검', 'phys', 1.1, 1, 0.85, 3),
    factions: ['HEL'], traits: ['MED'],
    trait: {
      name: '등대기사', desc: '주변 2칸 아군이 초당 최대 체력 2% 회복.',
      effect: { hooks: { onTick(b, u, dt) {
        u.mem.lightT = (u.mem.lightT || 0) + dt;
        if (u.mem.lightT < 1) return;
        u.mem.lightT -= 1;
        for (const a of b.around(u, 2, b.alliesOf(u))) b.heal(u, a, b.S(a, 'maxHp') * 0.02);
      } } },
    },
  },
  iris: {
    ctype: 'CMD', ttype: 'divine', faith: 'hermes', weapon: G('날개 단검 투척', 'holy', 0.9, 3, 0.6, 6, 1.5),
    factions: ['HEL'], traits: [],
    trait: {
      name: '헤르메스의 날개', desc: '아군 전원 이동 속도 · 공격 속도 +25%p.',
      effect: { hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) b.buff(u, a, 'iris.wing', 999, { delta: { moveSpd: 0.25, atkSpd: 0.25 } }); } } },
    },
  },
  odysseus: {
    ctype: 'MARK', ttype: 'divine', faith: 'athena', weapon: G('장궁', 'phys', 0.75, 4, 1.0, 1, 0.8),
    factions: ['HEL'], traits: ['INFIL'],
    trait: { name: '귀환자의 눈', desc: '체력 비율이 가장 낮은 적을 노린다. 치명타 확률 +50%p.', effect: { stats: { crit: 0.5 }, setup: (u) => { u.mem.lowestFocus = 1; } } },
  },
  argon: {
    ctype: 'MARK', ttype: 'major', faith: 'hades', weapon: G('선상 작살총', 'phys', 0.9, 4, 1.1, 2, 2.5),
    factions: ['HEL'], traits: ['NAV'],
    trait: { name: '망자의 뱃사공', desc: '다른 기물이 주는 이로운 버프를 받지 않는다. 효과 저항 +40%p.', effect: { stats: { effRes: 0.4 }, setup: (u) => { u.mem.noBless = 1; } } },
  },

  // ───────────────────────── 시리우스 성도회
  romani: {
    ctype: 'MARK', ttype: 'psionic', faith: 'sirius', weapon: K('중거리 채찍', 'phys', 0.9, 2, 0.7, 3),
    factions: ['SIR'], traits: ['INFIL'],
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
    factions: ['SIR'], traits: ['MED'],
    trait: { name: '체사레', desc: '이성이 -50 이하로 떨어지면 체사레로 전환된다.' },
    psi: { desc: '아군(자신 포함)이 잃은 체력 비율만큼 이성 감소 (최대 체력 10%당 -3), 회복할 때마다 +3.', effect: { hooks: {
      onAllyHurt(b, u, ally, _s, r) { if (!ally.isSummon) b.addReason(u, -30 * r.amount / b.S(ally, 'maxHp')); },
      onHurt(b, u, _s, r) { b.addReason(u, -30 * r.amount / b.S(u, 'maxHp')); },
      onHealDone(b, u, _t, amt) { if (amt > 0) b.addReason(u, 3); },
    } } },
  },
  sarma: {
    ctype: 'MARK', ttype: 'major', faith: 'science', weapon: G('융합포', 'phys', 1.1, 4, 1.3, 2, 3),
    factions: ['SIR'], traits: ['TIME'],
    trait: {
      name: '차원 융합', desc: '기본 공격이 대상 주변 1칸 적에게 30% 피해로 번진다.',
      effect: { hooks: { onBasic(b, u, t) {
        for (const e of b.around(t, 1, b.enemiesOf(u))) if (e !== t) proc(b, u, e, b.S(u, 'shoot') * (u.weapon?.mult || 1) * 0.3, 'phys', 'shoot');
      } } },
    },
  },
  kyle: {
    ctype: 'VAN', ttype: 'divine', faith: 'sirius', weapon: K('성전 장검', 'holy', 1.0, 1, 0.8, 4),
    factions: ['SIR'], traits: ['INFIL'],
    trait: { name: '성전 기사', desc: '신성 피해량 +20%. 전투 스킬을 쓸 때 최대 체력 15% 보호막.', effect: { mods: [inc('holy', 0.2)], hooks: { onSkill(b, u) { b.shield(u, b.S(u, 'maxHp') * 0.15); } } } },
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
    factions: ['SIR'], traits: ['RFRIEND', 'MED'],
    trait: {
      name: '친구의 손길', desc: '회복받은 아군은 3초간 받는 피해 -10%.',
      effect: { hooks: { onHealDone(b, u, t, amt) {
        if (amt <= 0) return;
        b.buff(u, t, 'demi.friend', 3, { taken: [red('all', 0.1)] });
        if (!t.isSummon && t !== u) u.mem[`g_f_${t.defId}`] = 1;
      } } },
    },
    growth: {
      name: '친구 목록', desc: '회복시킨 서로 다른 아군 1명당 회복량 +2% (런 누적).',
      effect: (g) => {
        const n = Object.keys(g).filter((k) => k.startsWith('f_')).length;
        return { hooks: { healMult: () => 1 + 0.02 * n } };
      },
    },
  },

  // ───────────────────────── 범은하 공동체
  aiden: {
    ctype: 'VAN', ttype: 'special', faith: 'science', weapon: K('액체 금속 칼날', 'phys', 0.75, 1, 0.75, 5),
    factions: ['PAN'], traits: ['TIME', 'NAV'],
    trait: {
      name: '고양이 형태', desc: '전투 시작 5초 · 회피 시 2초 · 처치 시 5초 동안 고양이 형태: 회피 · 공격 속도 +30%p.',
      effect: { hooks: {
        onStart(b, u) { cat(b, u, 5); },
        onEvade(b, u) { cat(b, u, 2); },
        onKill(b, u) { cat(b, u, 5); },
      } },
    },
    specialAugs: [
      sp('aiden', 'cat', '고양이 상시', '고양이 형태가 계속 유지되고 이동 속도 +40%, 최대 체력 -30%.', { pct: { maxHp: -0.3 }, stats: { moveSpd: 0.4 }, hooks: { onStart(b, u) { cat(b, u, 999); } } }),
      sp('aiden', 'bar', '바텐더 근무', '전투 스킬을 쓸 때 체력 비율이 가장 낮은 아군을 기술 위력 120% 회복.', { hooks: { onSkill(b, u) { const a = b.lowestHpAlly(u); if (a) b.heal(u, a, b.P(u, 'tech') * 1.2); } } }),
      sp('aiden', 'crystal', '수정 섭취', '처치하면 최대 체력 15% 회복, 콤보 +2.', { hooks: { onKill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * 0.15); u.combo += 2; } } }),
    ],
  },
  vivian: {
    ctype: 'SPEC', ttype: 'minor', faith: 'science', weapon: G('다트 소총', 'phys', 1.0, 3, 0.9, 5, 2),
    factions: ['PAN'], traits: ['BUDDY', 'NATURE'],
    trait: {
      name: '생태 분석', desc: '비비안과 리키의 기본 공격이 대상의 방어도를 10%p 깎는다 (최대 3중첩, 5초).',
      effect: { hooks: {
        onBasic(b, u, t, r) { if (r.amount > 0) shred(b, u, t); },
        onTick(b, u) {
          if (u.mem.vivInit) return;
          u.mem.vivInit = 1;
          for (const pet of summonsOf(b, u)) pet.hooks.push({ onBasic(bb, self, t, r) { if (r.amount > 0) shred(bb, self, t); } });
        },
        onInflict(b, u, _t, s) { if (s.type === 'stun' && summonsOf(b, u).length) cnt(u, 'g_bond', 3); },
      } },
    },
    growth: { name: '교감', desc: '리키가 적을 기절시킬 때마다 리키 스탯 상속률 +0.5%p (전투당 3회, 상한 +40%p).', effect: (g) => ({ setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + Math.min(0.4, 0.005 * gv(g, 'bond')); } }) },
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
    factions: ['FAM'], traits: ['STAR'],
    trait: {
      name: '무대 위의 달', desc: '출전한 다른 아군 기물 1명당 피해 +10%p, 소환물 · 시설 1개당 +5%p.',
      effect: { hooks: { onTick(b, u) {
        if (u.mem.ingInit) return;
        u.mem.ingInit = 1;
        const as = b.alliesOf(u, false);
        const v = 0.1 * as.filter((a) => !a.isSummon).length + 0.05 * as.filter((a) => a.isSummon).length;
        u.mods.push(inc('all', v));
      } } },
    },
    growth: { name: '팬덤', desc: '출전해 승리한 전투 1회당 스킬 피해 +1% (상한 +40%).', effect: (g) => ({ mods: [inc('skill', Math.min(0.4, 0.01 * gv(g, 'fan')))] }) },
  },
  onyx: {
    ctype: 'SPEC', ttype: 'psionic', faith: 'human', weapon: G('합창', 'psy', 1.0, 3, 0.9, 10, 2),
    factions: ['PAN'], traits: [],
    trait: { name: '오닉스 합창', desc: '이성이 낮을수록 주는 정신 피해 증폭이 50% 더 커진다.', effect: { setup: (u) => { u.mem.abyss = (u.mem.abyss || 0) + 0.5; } } },
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
      sp('amundsen', 'mount', '7703 탑승', '움직이지 않지만 포격 피해 ×1.6, 사거리 +2.', { stats: { range: 2 }, setup: (u) => { u.immobile = true; if (u.weapon) u.weapon = { ...u.weapon, mult: u.weapon.mult * 1.6 }; } }),
      sp('amundsen', 'order', '단장의 명령', '기본 공격을 하지 않지만 전술 위력 +6.', { setup: (u) => { u.noAttack = true; u.mem.tacBonus = (u.mem.tacBonus || 0) + 6; } }),
    ],
  },
  rachel: {
    ctype: 'VAN', ttype: 'psionic', faith: 'human', weapon: K('암흑물질 노심', 'psy', 0.9, 1, 0.85, 4),
    factions: ['FAM'], traits: ['TIME'],
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
    factions: ['FAM'], traits: ['NAV'],
    trait: { name: '메트로 기관사', desc: '이동 속도가 100%를 넘는 만큼 기술 위력이 1.5배로 오른다.', effect: { hooks: { onStart(b, u) { u.st.tech *= 1 + 1.5 * Math.max(0, b.S(u, 'moveSpd') - 1); } } } },
  },
  rasmus: {
    ctype: 'VAN', ttype: 'minor', faith: 'human', weapon: K('전정가위', 'phys', 1.0, 1, 0.8, 4),
    factions: ['FAM'], traits: ['NATURE', 'BUDDY'],
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
    growth: { name: '정원 가꾸기', desc: '노드 10개를 지날 때마다 맥스 최대 체력 +2% (대기실에 있어도 쌓임).', effect: (g) => ({ setup: (u) => { u.mem.summonHpPct = (u.mem.summonHpPct || 0) + 0.02 * Math.floor(gv(g, 'nodes') / 10); } }) },
  },
  sigmund: {
    ctype: 'CMD', ttype: 'minor', faith: 'index', weapon: G('은식기 투척', 'phys', 1.1, 3, 0.6, 6, 2),
    factions: ['FAM'], traits: [],
    trait: {
      name: '집사의 예법', desc: '공명 등급이 가장 높은 아군을 모신다 (보좌 우선 대상). 그 기물이 엘베스타드가 아니면 엘베스타드 시너지에 합류시키고, 이미 엘베스타드면 모든 메이저 +5.',
      effect: { setup(u, _b, ctx) {
        const uid = ctx.run ? sigmundTarget(ctx.run) : null;
        if (!uid) return;
        u.hooks.push({ onStart(b, self) {
          const a = b.alliesOf(self).find((x) => x.src?.uid === uid);
          if (a) { a.mem.staffed = 1; self.mem.serveId = a.id; }
        } });
      }, hooks: { onAnyDeath(_b, u, dead, killer) { if (killer && killer.id === u.mem.serveId && dead.side !== u.side) cnt(u, 'g_serve', 2); } } },
    },
    growth: { name: '근속', desc: '모시는 기물이 처치할 때마다 보좌 피해 증가 +0.5%p (전투당 2회, 상한 +30%p).', effect: (g) => setSk((s) => { s.dmg += Math.min(0.3, 0.005 * gv(g, 'serve')); }) },
  },
  gunnir: {
    ctype: 'SPEC', ttype: 'minor', faith: 'index', weapon: G('주방 칼 투척', 'phys', 1.0, 3, 0.8, 5, 2),
    factions: ['FAM'], traits: ['MED', 'CHEF'],
    trait: {
      name: '저택의 실세', desc: '전투 스킬을 쓴 뒤 아군 전원을 기술 위력 25% 회복.',
      effect: { hooks: { onSkill(b, u) {
        for (const a of b.alliesOf(u)) b.heal(u, a, b.P(u, 'tech') * 0.25);
        u.mem.g_cook = (u.mem.g_cook || 0) + 1;
      } } },
    },
    growth: { name: '육수', desc: '요리 5회마다 [요리] 보호막 +1%p (상한 +60%p).', effect: (g) => setSk((s) => { s.shield += Math.min(0.6, 0.01 * Math.floor(gv(g, 'cook') / 5)); }) },
  },
  mingki: {
    ctype: 'VAN', ttype: 'special', faith: 'index', weapon: K('발톱', 'phys', 0.65, 1, 0.7, 6),
    factions: ['FAM'], traits: ['INFIL'],
    trait: { name: '내면의 괴물', desc: '체력이 처음 50% 이하가 되면 피해 +80%, 공격 속도 +50%.' },
    specialAugs: [
      sp('mingki', 'awake', '상시 각성', '내면의 괴물이 전투 시작부터 깨어 있지만 초당 최대 체력 2%를 잃는다.', { setup: (u) => { u.sk.monsterAt = 1; }, hooks: {
        onStart(b, u) { u.mem.monster = 1; b.buff(u, u, 'mingki.monster', 999, { delta: { atkSpd: 0.5 }, mods: [inc('all', 0.8)], label: '내면의 괴물' }); },
        onTick(b, u, dt) { u.mem.mt = (u.mem.mt || 0) + dt; if (u.mem.mt >= 1) { u.mem.mt -= 1; if (b.hpPct(u) > 0.1) b.dealDamage(u, u, b.S(u, 'maxHp') * 0.02, { elem: 'true', tag: 'dot', noHooks: true }); } },
      } }),
      sp('mingki', 'master', '저택의 주인', '엘베스타드 아군 전원 피해 +10%.', { hooks: { onStart(b, u) { for (const a of b.alliesOf(u)) if (a.synergies.has('FAM')) b.buff(u, a, 'mingki.master', 999, { mods: [inc('all', 0.1)] }); } } }),
      sp('mingki', 'full', '배부른 고양이', '츄르 사냥 쿨다운 -2초, 회복 +15%p.', { setup: (u) => { u.cdMax = Math.max(1, u.cdMax - 2); u.sk.heal += 0.15; } }),
    ],
  },

  // ───────────────────────── 사건 전용
  exile: {
    ctype: 'VAN', ttype: 'major', faith: 'emperor', weapon: K('혈검', 'phys', 0.85, 1, 0.8, 4),
    factions: ['KAL'], traits: ['INFIL'],
    trait: { name: '혈족의 갈증', desc: '피니쉬로 준 피해의 30%만큼 회복.', effect: { hooks: { onBasic(b, u, _t, r) { if (u.mem.finished && r.amount > 0) b.heal(u, u, r.amount * 0.3, true); } } } },
  },
  thermo: {
    ctype: 'VAN', ttype: 'divine', faith: 'ares', weapon: K('도리와 방패', 'phys', 1.1, 2, 0.85, 3),
    factions: ['HEL'], traits: [],
    trait: {
      name: '팔랑크스', desc: '자신과 주변 1칸 아군의 받는 피해 -10%.',
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
    growth: { name: '분기 실적', desc: '전투 피해 목표(페이즈 비례)를 달성할 때마다 타격 위력 +1% (상한 +30%).', effect: (g) => ({ pct: { strike: Math.min(0.3, 0.01 * gv(g, 'quota')) } }) },
  },
};

// ───────── 특성 보조 함수
function grenShield(b: Battle, u: CUnit) {
  const max = b.S(u, 'maxHp');
  const cap = max * 0.3;
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
  b.buff(u, u, 'aiden.cat', dur, { delta: { eva: 0.3, atkSpd: 0.3 }, label: '고양이' });
}
function shred(b: Battle, u: CUnit, t: CUnit) {
  stack(b, u, t, 'vivian.shred', 3, 5, (n) => ({ type: 'buff', armorMul: 1 - 0.1 * n, label: n === 1 ? '방어 분석' : undefined }));
}
function wound(b: Battle, u: CUnit, t: CUnit) {
  stack(b, u, t, 'wound', 5, 6, () => ({}));
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
];
/** [임시] 사이오닉 증강: 사용자 명세를 받아 교체 예정 */
export const PSI_AUGS: AugDef[] = [
  { id: 'psi.clarity', name: '명징', desc: '전투 시작 이성 +30.', pool: 'psionic', effect: () => ({ setup: (u) => { u.mem.reasonStart = (u.mem.reasonStart || 0) + 30; } }) },
  { id: 'psi.abyss', name: '심연 응시', desc: '이성이 낮을 때 주는 정신 피해 증폭 +50%.', pool: 'psionic', effect: () => ({ setup: (u) => { u.mem.abyss = (u.mem.abyss || 0) + 0.5; } }) },
  { id: 'psi.bulwark', name: '이성의 방벽', desc: '이성이 높을 때 받는 정신 · 신성 피해 감소와 지원 효율 증가 +50%.', pool: 'psionic', effect: () => ({ setup: (u) => { u.mem.bulwark = (u.mem.bulwark || 0) + 0.5; } }) },
  { id: 'psi.calm', name: '광폭 제어', desc: '광폭 상태의 초당 지속 피해를 받지 않는다.', pool: 'psionic', effect: () => ({ setup: (u) => { u.mem.calmFrenzy = 1; } }) },
  { id: 'psi.resonance', name: '공명 증폭', desc: '이성 증감량 +50%.', pool: 'psionic', effect: () => ({ setup: (u) => { u.mem.reasonAmp = (u.mem.reasonAmp || 0) + 0.5; } }) },
];

// ───────────────────────── 신앙 · 신권 대행
interface FaithDef { gain: string; act: string; hooks: Hooks; mod(b: Battle, u: CUnit): void }
const dv = (b: Battle, u: CUnit, v: number, key = 'fIcd', sec = 0.3) => { if (icd(b, u, key, sec)) b.addDiv(u, v); };
export const FAITH_DEF: Record<FaithId, FaithDef> = {
  emperor: { gain: '결정타 +35', act: '아군 전원 8초간 피해 +15% (칙령)',
    hooks: { onKill: (b, u) => b.addDiv(u, 35) },
    mod: (b, u) => { for (const a of b.alliesOf(u)) b.buff(u, a, 'div.edict', 8, { mods: [inc('all', 0.15)], label: '칙령' }); } },
  athena: { gain: '적에게 상태이상을 걸 때 +12', act: '8초간 자신이 받는 피해 -30%',
    hooks: { onInflict(b, u, t) { if (t.side !== u.side) dv(b, u, 12); } },
    mod: (b, u) => { b.buff(u, u, 'div.aegis', 8, { taken: [red('all', 0.3)], label: '아이기스' }); } },
  hermes: { gain: '이동 1칸 +6, 아군에게 버프를 걸 때 +8', act: '아군 전원 8초간 공격 속도 +30%',
    hooks: { onMove: (b, u) => b.addDiv(u, 6), onInflict(b, u, t) { if (t.side === u.side && t !== u) dv(b, u, 8); } },
    mod: (b, u) => { for (const a of b.alliesOf(u)) b.buff(u, a, 'div.hermes', 8, { delta: { atkSpd: 0.3 }, label: '전령의 발' }); } },
  ares: { gain: '피해를 받을 때 +4, 근접한 적이 있으면 초당 +3', act: '8초간 자신의 피해 +50%, 받는 피해 +20%',
    hooks: {
      onHurt(b, u, _s, r) { if (r.amount > 0) dv(b, u, 4, 'aIcd', 0.2); },
      onTick(b, u, dt) { u.mem.areT = (u.mem.areT || 0) + dt; if (u.mem.areT >= 1) { u.mem.areT -= 1; if (b.around(u, 1, b.enemiesOf(u)).length) b.addDiv(u, 3); } },
    },
    mod: (b, u) => { b.buff(u, u, 'div.ares', 8, { mods: [inc('all', 0.5)], taken: [vuln('all', 0.2)], label: '전쟁광' }); } },
  hades: { gain: '누구든 쓰러질 때 +25', act: '쓰러진 아군 1명을 체력 30%로 부활',
    hooks: { onAnyDeath: (b, u) => b.addDiv(u, 25) },
    mod: (b, u) => {
      const d = b.units.find((x) => !x.alive && x.side === u.side && !x.isSummon);
      const c = d && b.freeCellNear(u.x, u.y);
      if (!d || !c) return;
      d.alive = true; d.hp = b.S(d, 'maxHp') * 0.3; d.statuses = []; d.x = d.px = c.x; d.y = d.py = c.y; d.moveT = 0;
      b.emit({ k: 'spawn', id: d.id }); b.emit({ k: 'status', id: d.id, name: '명부 귀환' });
    } },
  zeus: { gain: '치명타 +10', act: '낙뢰가 무작위 적 3명에게 주력 위력 200% 전기 피해',
    hooks: { onDeal(b, u, _t, r) { if (r.crit) dv(b, u, 10, 'zIcd', 0.2); } },
    mod: (b, u) => {
      const es = b.enemiesOf(u).slice().sort(() => b.rng.next() - 0.5).slice(0, 3);
      for (const e of es) { b.fx(e.x, e.y, 0, 'elec'); b.dealDamage(u, e, mainPow(b, u) * 2, { elem: 'elec', tag: 'skill', kind: 'tech' }); }
    } },
  selene: { gain: '회복 · 보호막 부여 +6 (40초 이후 2배)', act: '아군 전원 최대 체력 20% 회복, 이성 +20',
    hooks: { onHealDone(b, u, _t, amt) { if (amt > 0) dv(b, u, b.t > 40 ? 12 : 6); } },
    mod: (b, u) => { for (const a of b.alliesOf(u)) { b.heal(u, a, b.S(a, 'maxHp') * 0.2); b.addReason(a, 20); } } },
  human: { gain: '다른 아군과 같은 적을 공격할 때 +4', act: '아군 전원 6초간 피해 +20%, 받는 피해 -10% (연대)',
    hooks: { onDeal(b, u, t, r) { if (r.amount > 0 && b.alliesOf(u, false).some((a) => a.target === t)) dv(b, u, 4); } },
    mod: (b, u) => { for (const a of b.alliesOf(u)) b.buff(u, a, 'div.human', 6, { mods: [inc('all', 0.2)], taken: [red('all', 0.1)], label: '연대' }); } },
  index: { gain: '피해를 줄 때 +3 (3초마다 바뀌는 상승장에서는 2배)', act: '보유 크레딧 1당 주력 위력 4% 고정 피해를 대상에게',
    hooks: { onDeal(b, u, _t, r) { if (r.amount > 0) dv(b, u, Math.floor(b.t / 3) % 2 ? 6 : 3, 'iIcd', 0.4); } },
    mod: (b, u) => { const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u)); if (t) b.dealDamage(u, t, mainPow(b, u) * 0.04 * Math.min(100, b.ctx.credits), { elem: 'true', tag: 'skill' }); } },
  science: { gain: '아군 소환물 · 포탑이 공격할 때 +4', act: '모든 아군 소환물 · 포탑 8초간 공격 속도 +100% (과부하)',
    hooks: { onAllyBasic(b, u, a) { if (a.isSummon) dv(b, u, 4, 'sIcd', 0.2); } },
    mod: (b, u) => { for (const a of b.alliesOf(u)) if (a.isSummon) b.buff(u, a, 'div.overload', 8, { delta: { atkSpd: 1 }, label: '과부하' }); } },
  sirius: { gain: '신성 피해를 줄 때 +4, 아군을 회복 · 보호할 때 +6', act: '주변 2칸 아군 2초간 피해 무효 (성역)',
    hooks: {
      onDeal(b, u, _t, r, o) { if (r.amount > 0 && o.elem === 'holy') dv(b, u, 4); },
      onHealDone(b, u, t, amt) { if (amt > 0 && t !== u) dv(b, u, 6, 'hIcd', 0.3); },
    },
    mod: (b, u) => { for (const a of b.around(u, 2, b.alliesOf(u))) a.mem.invulnUntil = b.t + 2; b.fx(u.x, u.y, 2, 'holy'); } },
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
  if (u.faith) FAITH_DEF[u.faith].mod(b, u);
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
export const MARK_BASIC = 1.25;
/** 하위권 기물 보정: w = 기본 공격 계수 배율, s = 스킬 주 계수(피해 · 회복 · 보호막) 배율 */
export const TUNE: Record<string, { w?: number; s?: number }> = {
  falcon: { w: 1.35, s: 1.3 }, west: { w: 1.3, s: 1.3 }, argon: { w: 1.3, s: 1.3 }, romani: { w: 1.1, s: 1.15 },
  gebek: { w: 1.1, s: 1.15 }, mirinae: { w: 1.05, s: 1.15 }, odysseus: { w: 1.15, s: 1.2 }, yupito: { w: 1.25, s: 1.35 },
  joshua: { w: 1.2, s: 1.35 }, iris: { w: 1.15, s: 1.2 }, phyllis: { w: 1.2, s: 1.25 }, eleni: { w: 1.1, s: 1.15 },
  kyle: { w: 1.1, s: 1.1 }, temur: { s: 1.1 }, vivian: { w: 1.1, s: 1.1 },
};
/** 스킬 계수 중 배율을 적용할 항목 */
export const TUNE_KEYS = ['mult', 'heal', 'shield', 'snipe', 'supply'];
