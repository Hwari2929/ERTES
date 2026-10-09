// 확장 기물 10종: 참모단 · 최고의 친구 · 자연주의자 · 성직자 · 은하 대스타 · 침투자, 시리우스 성도회 · 범은하 공동체
import type { Battle, CUnit } from '../engine/combat';
import { inc, red, vuln } from '../engine/effects';
import { blinkTo, cleanse, fear, pct, poison, skillHit, slow, summonsOf } from './kit';
import { B, PAL, setSk, uaug, type UnitDef } from './unitkit';

const BEAST = ['#120c08', '#8a5a34', '#d9b48a', '#f0d0a8', '#ffcf40', '#5a4030', '#fff0d8'];
const POPPY = ['#1a0c12', '#f5a8c8', '#ffffff', '#ffd0e0', '#40202a', '#c06080', '#ffffff'];
const GARDEN = ['#0a140a', '#4aa84a', '#e04a3a', '#c0e0a0', '#ffe060', '#3a503a', '#f0fff0'];

/** 지휘 대상: 참모단 지원 대상 → 없으면 피해량이 가장 높은 아군 */
function commandTargets(b: Battle, u: CUnit, n: number): CUnit[] {
  const pool = b.alliesOf(u, false).filter((a) => !a.isSummon);
  pool.sort((a, c) => (c.mem.staffed || 0) - (a.mem.staffed || 0) || c.counters.dmg - a.counters.dmg || b.S(c, 'shoot') + b.S(c, 'strike') - b.S(a, 'shoot') - b.S(a, 'strike'));
  return pool.slice(0, n);
}

export const EXT_UNITS: UnitDef[] = [
  // ───────── 성간 인류 연합 + 참모단
  {
    id: 'jiho', name: '한지호', title: '연합 작전 참모', faction: 'UNI', traits: ['STAFF', 'SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.1 }, range: 3, base: B(5, 7, 9, 4, 5),
    sprite: 'medic', palette: ['#10131c', '#2a3f6e', '#c9d6f2', '#f0c8a0', '#ffd34d', '#59606e', '#ffffff'],
    lore: '작전 계획서는 늘 세 가지. 두 개는 상관용이다.',
    skill: {
      name: '전술 지휘', cd: 8,
      params: { dur: 5, as: 0.4, dmg: 0.25, targets: 1, crit: 0, tempo: 0, cover: 0 },
      desc: (p) => `지원 대상(없으면 피해량이 가장 높은 아군) ${p.targets}명에게 ${p.dur}초간 공격 속도 +${pct(p.as)}, 피해 +${pct(p.dmg)}.`,
      cast(b, u) {
        const ts = commandTargets(b, u, u.sk.targets);
        if (!ts.length || !b.enemiesOf(u).length) return false;
        const p = u.sk;
        for (const t of ts) {
          b.buff(u, t, 'jiho.cmd', p.dur, { delta: { atkSpd: p.as, crit: p.crit }, mods: [inc('all', p.dmg)], label: '전술 지휘' });
          if (p.tempo) t.cd = Math.max(0, t.cd - 2);
          if (p.cover && t.target?.alive) {
            b.emit({ k: 'atk', from: u.id, to: t.target.id, elem: 'phys', ranged: true });
            skillHit(b, u, t.target, 'shoot', 1.5, 'phys');
          }
        }
        return true;
      },
    },
    augs: [
      uaug('jiho', 'wide', '전군 지휘', '전술 지휘 대상 +2명.', setSk((s) => { s.targets += 2; })),
      uaug('jiho', 'precise', '정밀 좌표', '지휘받은 아군 치명타 확률 +25%p.', setSk((s) => { s.crit = 0.25; })),
      uaug('jiho', 'tempo', '템포 조절', '지휘 대상의 기술 쿨다운을 2초 줄인다.', setSk((s) => { s.tempo = 1; })),
      uaug('jiho', 'long', '장기 작전', '지휘 지속 +3초, 피해 증가 +15%p.', setSk((s) => { s.dur += 3; s.dmg += 0.15; })),
      uaug('jiho', 'cover', '엄호 사격', '지휘할 때 대상이 노리는 적에게 사격 위력 150% 물리 사격.', setSk((s) => { s.cover = 1; })),
    ],
  },
  // ───────── 칼리토 제국 + 대스타 / 참모단
  {
    id: 'isolde', name: '레이디 이졸데', title: '제국 오페라 디바', faction: 'KAL', traits: ['STAR', 'STAFF'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.2 }, range: 3, base: B(6, 8, 8, 4, 4),
    sprite: 'robe', palette: PAL.KAL,
    lore: '그녀의 고음에 궁정 유리창 예산이 매년 증액된다.',
    skill: {
      name: '아리아', cd: 9,
      params: { mult: 1.9, radius: 2, heal: 0.9, slow: 0.3, stack: 0, mech: 0, fans: 0 },
      desc: (p) => `주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.mult)} 정신 피해 + 2초 둔화, 주변 ${p.radius}칸 아군을 기술 위력 ${pct(p.heal)} 회복.`,
      cast(b, u) {
        const es = b.around(u, u.sk.radius, b.enemiesOf(u));
        if (!es.length) return false;
        const p = u.sk;
        const bonus = 1 + (u.mem.aria || 0) * p.stack;
        b.fx(u.x, u.y, p.radius, 'psy');
        for (const e of es) {
          skillHit(b, u, e, 'tech', p.mult * bonus * (p.mech && e.keywords.includes('mech') ? 4 : 1), 'psy', { noMiss: true });
          if (e.alive) slow(b, u, e, p.slow, 2);
        }
        for (const a of b.around(u, p.radius, b.alliesOf(u))) {
          b.heal(u, a, b.S(u, 'tech') * p.heal);
          if (p.fans) b.buff(u, a, 'isolde.fans', 4, { mods: [inc('all', 0.15)], label: '열광' });
        }
        u.mem.aria = (u.mem.aria || 0) + 1;
        return true;
      },
    },
    augs: [
      uaug('isolde', 'crescendo', '크레센도', '아리아를 부를 때마다 다음 아리아 피해 +35% (전투 내 중첩).', setSk((s) => { s.stack = 0.35; })),
      uaug('isolde', 'glass', '유리 깨는 고음', '아리아가 기계 적에게 4배 피해 (정신 피해 감소 상쇄).', setSk((s) => { s.mech = 1; })),
      uaug('isolde', 'fans', '열성 팬', '아리아로 회복받은 아군의 피해 4초간 +15%.', setSk((s) => { s.fans = 1; })),
      uaug('isolde', 'finale', '그랜드 피날레', '아리아 범위 +1칸, 피해 +40%p.', setSk((s) => { s.radius += 1; s.mult += 0.4; })),
      uaug('isolde', 'patron', '황실 후원', '작위 +1, 정신력 +4.', { title: 1, majors: { mnd: 4 } }),
    ],
  },
  // ───────── 헬레니우스 동맹 + 최고의 친구
  {
    id: 'bran', name: '브란', title: '동맹 야수 조련사', faction: 'HEL', traits: ['BUDDY'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.0 }, range: 1, base: B(8, 7, 5, 6, 5),
    sprite: 'knight', palette: PAL.HEL,
    summon: { name: '코르', sprite: 'beast', palette: BEAST, atk: { type: 'strike', elem: 'phys', interval: 0.85 }, range: 1, hpMul: 1.2 },
    lore: '코르는 외교관이 아니다. 하지만 협상 테이블에서는 늘 이긴다.',
    skill: {
      name: '사냥 명령', cd: 7, needsRange: false,
      params: { mult: 2.5, stun: 1.5, feast: 0, tandem: 0 },
      desc: (p) => `코르가 브란의 대상에게 덮쳐 코르 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절. 코르가 없으면 브란이 직접 150%.`,
      cast(b, u) {
        const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
        if (!t) return false;
        const p = u.sk;
        const pets = summonsOf(b, u);
        let dealt = 0;
        if (pets.length) {
          for (const pet of pets) {
            if (b.dist(pet, t) > 1) blinkTo(b, pet, t);
            pet.target = t;
            dealt += skillHit(b, pet, t, 'strike', p.mult, 'phys').amount;
          }
        } else if (b.dist(u, t) <= 1) dealt += skillHit(b, u, t, 'strike', 1.5, 'phys').amount;
        else return false;
        if (t.alive) b.stun(u, t, p.stun);
        if (p.tandem && t.alive && b.dist(u, t) <= 1) dealt += skillHit(b, u, t, 'strike', 1.2, 'phys').amount;
        if (p.feast) for (const x of [u, ...pets]) b.heal(u, x, dealt * 0.4, true);
        return true;
      },
    },
    augs: [
      uaug('bran', 'alpha', '우두머리', '코르의 스탯 상속률 +25%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.25; } }),
      uaug('bran', 'feast', '포식', '사냥 명령 피해의 40%만큼 브란과 코르를 회복.', setSk((s) => { s.feast = 1; })),
      uaug('bran', 'wild', '야성 해방', '브란의 체력이 50% 이하가 되면 코르의 공격 속도 +60%.', {
        hooks: {
          onHurt(b, u) {
            if (u.mem.wild || b.hpPct(u) > 0.5) return;
            u.mem.wild = 1;
            for (const pet of summonsOf(b, u)) b.buff(u, pet, 'bran.wild', 999, { delta: { atkSpd: 0.6 }, label: '야성 해방' });
          },
        },
      }),
      uaug('bran', 'tandem', '연계 사냥', '사냥 명령 후 브란도 같은 대상을 타격 위력 120%로 공격.', setSk((s) => { s.tandem = 1; })),
      uaug('bran', 'twin', '두 번째 녀석', '코르와 똑같은 짐승을 하나 더 데려온다 (상속률 60%).', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } }),
    ],
  },
  // ───────── 주식회사 페트라 + 자연주의자
  {
    id: 'bella', name: '벨라 오쿠무', title: '페트라 원정 생물학자', faction: 'PET', traits: ['NATURE'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 1.0 }, range: 4, base: B(5, 8, 7, 4, 6),
    sprite: 'medic', palette: PAL.PET,
    lore: '모든 표본은 회사 자산입니다. 표본이 아직 살아 있어도요.',
    skill: {
      name: '채집 표본', cd: 7,
      params: { targets: 3, mult: 0.9, pdps: 0.25, sample: 0.08, spore: 0 },
      desc: (p) => `무작위 적 ${p.targets}명에게 기술 위력 ${pct(p.mult)} 화학 피해 + 4초 중독. 이 기술로 처치하면 전투 동안 기술 위력 +${pct(p.sample)} (중첩).`,
      cast(b, u) {
        const es = b.rng.sample(b.enemiesOf(u), u.sk.targets);
        if (!es.length) return false;
        const p = u.sk;
        for (const e of es) {
          b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'chem', ranged: true });
          const r = skillHit(b, u, e, 'tech', p.mult, 'chem');
          if (e.alive) poison(b, u, e, b.S(u, 'tech') * p.pdps, 4, 0.7);
          if (r.killed) {
            u.st.tech *= 1 + p.sample;
            b.emit({ k: 'status', id: u.id, name: '표본 확보' });
            if (p.spore) for (const x of b.around(e, 1, b.enemiesOf(u))) poison(b, u, x, b.S(u, 'tech') * p.pdps, 4, 1);
          }
        }
        return true;
      },
    },
    augs: [
      uaug('bella', 'mass', '대량 채집', '채집 표본 대상 +2명.', setSk((s) => { s.targets += 2; })),
      uaug('bella', 'catalog', '도감 완성', '표본 확보 보너스 2배, 중독 피해 +40%.', setSk((s) => { s.sample *= 2; s.pdps *= 1.4; })),
      uaug('bella', 'spore', '포자 확산', '채집 표본으로 처치하면 주변 적에게 중독이 퍼진다.', setSk((s) => { s.spore = 1; })),
      uaug('bella', 'grant', '연구비 지원', '기술 위력 +15%. 전투 승리 시 크레딧 +1.', { pct: { tech: 0.15 } }, { after: (run, _u, won) => { if (won) run.credits += 1; } }),
      uaug('bella', 'field', '현장 적응', '자연주의자 임시 장비 +1개, 생명력 +3.', { majors: { vit: 3 }, setup: (u) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + 1; } }),
    ],
  },
  // ───────── 시리우스 성도회
  {
    id: 'amelia', name: '성녀 아멜리아', title: '성도회 치유의 성녀', faction: 'SIR', traits: ['CLERIC', 'MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'holy', interval: 1.1 }, range: 3, base: B(7, 6, 8, 5, 4),
    sprite: 'robe', palette: PAL.SIR,
    lore: '기도는 짧게, 붕대는 단단하게.',
    skill: {
      name: '성광', cd: 7,
      params: { heal: 2.2, dmg: 1.0, radius: 1, purify: 0, grace: 0, saint: 0 },
      desc: (p) => `체력 비율이 가장 낮은 아군을 기술 위력 ${pct(p.heal)} 회복하고, 그 주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.dmg)} 신성 피해.`,
      cast(b, u) {
        const t = b.lowestHpAlly(u);
        if (!t || (b.hpPct(t) > 0.92 && !b.around(t, u.sk.radius, b.enemiesOf(u)).length)) return false;
        const p = u.sk;
        b.fx(t.x, t.y, p.radius, 'holy');
        b.heal(u, t, b.S(u, 'tech') * p.heal * (1 + (u.mem.faith || 0) * p.saint));
        if (p.purify) cleanse(t);
        if (p.grace) b.buff(u, t, 'amelia.grace', 4, { taken: [red('all', 0.25)], label: '은총' });
        for (const e of b.around(t, p.radius, b.enemiesOf(u))) skillHit(b, u, e, 'tech', p.dmg, 'holy', { noMiss: true });
        return true;
      },
    },
    augs: [
      uaug('amelia', 'purify', '정화', '성광 대상의 해로운 상태이상을 모두 없앤다.', setSk((s) => { s.purify = 1; })),
      uaug('amelia', 'radiance', '광휘', '성광 범위 +1칸, 신성 피해 +60%p.', setSk((s) => { s.radius += 1; s.dmg += 0.6; })),
      uaug('amelia', 'grace', '은총', '성광 대상은 4초간 받는 피해 -25%.', setSk((s) => { s.grace = 1; })),
      uaug('amelia', 'saint', '시성', '신앙 1당 성광 회복량 +3%.', { setup: (u, _b, ctx) => { u.sk.saint = 0.03; u.mem.faith = Math.min(40, ctx.run?.faith || 0); } }),
      uaug('amelia', 'miracle', '기적', '전투당 1회, 처음 쓰러지는 아군을 체력 40%로 되살린다.', {
        hooks: {
          onStart(b, u) {
            for (const a of b.alliesOf(u)) a.hooks.push({
              onLethal(bb, self) {
                if (u.mem.miracle || self.isSummon) return false;
                u.mem.miracle = 1;
                self.hp = bb.S(self, 'maxHp') * 0.4;
                bb.emit({ k: 'status', id: self.id, name: '기적' });
                return true;
              },
            });
          },
        },
      }),
    ],
  },
  {
    id: 'odo', name: '심판관 오도', title: '성도회 이단 심판관', faction: 'SIR', traits: ['CLERIC', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 1.1 }, range: 1, base: B(9, 7, 4, 8, 2),
    sprite: 'knight', palette: PAL.SIR,
    lore: '판결문은 미리 써 두었다. 재판은 형식이다.',
    skill: {
      name: '심판의 철퇴', cd: 8, needsRange: true,
      params: { mult: 2.4, stun: 1.5, brand: 0.25, all: 0, wave: 0, aegis: 0, verdict: 0, zealot: 0 },
      desc: (p) => `대상에게 기술 위력 ${pct(p.mult)} 신성 피해 + ${p.stun}초 기절 + 5초 낙인 (받는 신성 피해 +${pct(p.brand)}).`,
      cast(b, u) {
        const t = u.target;
        if (!t || !t.alive) return false;
        const p = u.sk;
        const victims = p.wave ? b.around(t, 1, b.enemiesOf(u)) : [t];
        b.fx(t.x, t.y, p.wave ? 1 : 0, 'holy');
        for (const v of victims) {
          const exec = p.verdict && b.hpPct(v) <= 0.3 ? 2 : 1;
          const r = skillHit(b, u, v, 'tech', p.mult * (v === t ? 1 : 0.7) * exec, 'holy');
          if (!v.alive) { if (r.killed && p.zealot) u.cd = 0.3; continue; }
          if (v === t) b.stun(u, v, p.stun);
          b.applyStatus(u, v, { type: 'buff', key: 'odo.brand', dur: 5, taken: [vuln(p.all ? 'all' : 'holy', p.brand)], label: '낙인' });
        }
        if (p.aegis) b.shield(u, b.S(u, 'tech') * 2);
        return true;
      },
    },
    augs: [
      uaug('odo', 'inquisition', '이단 심문', '낙인 효과 2배, 모든 피해에 적용.', setSk((s) => { s.brand *= 2; s.all = 1; })),
      uaug('odo', 'wave', '충격파', '심판의 철퇴가 대상 주변 1칸 적에게도 70% 피해와 낙인.', setSk((s) => { s.wave = 1; })),
      uaug('odo', 'zealot', '광신도', '심판의 철퇴로 처치하면 쿨다운이 즉시 초기화된다.', setSk((s) => { s.zealot = 1; })),
      uaug('odo', 'aegis', '성스러운 방패', '심판할 때마다 자신에게 기술 위력 200% 보호막.', setSk((s) => { s.aegis = 1; })),
      uaug('odo', 'verdict', '최종 판결', '체력 30% 이하인 적에게 심판의 철퇴 피해 2배.', setSk((s) => { s.verdict = 1; })),
    ],
  },
  {
    id: 'mir', name: '순례자 미르', title: '성도회 그림자 순례자', faction: 'SIR', traits: ['INFIL', 'NATURE'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'holy', interval: 0.85 }, range: 1, base: B(5, 8, 7, 3, 8),
    sprite: 'robe', palette: ['#0c0c14', '#3a3550', '#d4a83a', '#d8b090', '#c0b0ff', '#4a4660', '#e0d8ff'],
    lore: '순례길은 언제나 적진 한가운데를 지난다.',
    skill: {
      name: '그림자 순례', cd: 6,
      params: { mult: 2.6, hits: 1, relentless: 0, veil: 0, mark: 0 },
      desc: (p) => `체력이 가장 낮은 적 옆으로 순간이동해 타격 위력 ${pct(p.mult)} 신성 피해${p.hits > 1 ? ` (${p.hits}회)` : ''}.`,
      cast(b, u) {
        const es = b.enemiesOf(u);
        if (!es.length) return false;
        const t = es.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a));
        if (b.dist(u, t) > 1 && !blinkTo(b, u, t)) return false;
        const p = u.sk;
        if (p.veil) b.buff(u, u, 'mir.veil', 2, { delta: { eva: 0.4 }, label: '베일' });
        if (p.mark) b.applyStatus(u, t, { type: 'buff', key: 'mir.mark', dur: 4, taken: [vuln('all', 0.2)], label: '죄인의 표식' });
        for (let i = 0; i < p.hits && t.alive; i++) {
          const r = skillHit(b, u, t, 'strike', p.mult * (i ? 0.6 : 1), 'holy');
          if (r.killed && p.relentless) u.cd -= u.cdMax * 0.7;
        }
        return true;
      },
    },
    augs: [
      uaug('mir', 'relentless', '끝없는 길', '그림자 순례로 처치하면 쿨다운 70% 회복.', setSk((s) => { s.relentless = 1; })),
      uaug('mir', 'veil', '순례자의 베일', '순간이동 후 2초간 회피 +40%p.', setSk((s) => { s.veil = 1; })),
      uaug('mir', 'twin', '쌍검', '그림자 순례가 2회 타격한다 (두 번째 60%).', setSk((s) => { s.hits = 2; })),
      uaug('mir', 'mark', '죄인의 표식', '대상은 4초간 받는 모든 피해 +20%.', setSk((s) => { s.mark = 1; })),
      uaug('mir', 'harvest', '길 위의 수확', '자연주의자 임시 장비 +1개, 기동력 +3.', { majors: { agi: 3 }, setup: (u) => { u.mem.natureExtra = (u.mem.natureExtra || 0) + 1; } }),
    ],
  },
  // ───────── 범은하 공동체
  {
    id: 'juju', name: '주주 & 뽀삐', title: '공동체 출신 은하 아이돌', faction: 'PAN', traits: ['STAR', 'BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.0 }, range: 3, base: B(6, 8, 8, 4, 6),
    sprite: 'medic', palette: ['#160a14', '#ff8ac8', '#ffffff', '#f0c8a8', '#7ae0ff', '#a05080', '#fff0f8'],
    summon: { name: '뽀삐', sprite: 'beast', palette: POPPY, atk: { type: 'strike', elem: 'phys', interval: 0.8 }, range: 1, hpMul: 1.0 },
    lore: '데뷔 전에는 화물선 정비공이었다. 뽀삐는 그때 주운 밀항자.',
    skill: {
      name: '팬서비스', cd: 8,
      params: { as: 0.3, dur: 5, fearChance: 0.5, live: 0 },
      desc: (p) => `모든 아군 ${p.dur}초간 공격 속도 +${pct(p.as)}. 뽀삐가 짖어 주변 1칸 적에게 ${pct(p.fearChance)} 확률로 1.5초 공포.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        for (const a of b.alliesOf(u)) b.buff(u, a, 'juju.fan', p.dur, { delta: { atkSpd: p.as }, mods: p.live ? [inc('all', 0.15)] : undefined, label: '팬서비스' });
        for (const pet of summonsOf(b, u)) {
          b.fx(pet.x, pet.y, 1, 'psy');
          for (const e of b.around(pet, 1, b.enemiesOf(u))) fear(b, u, e, 1.5, p.fearChance);
        }
        return true;
      },
    },
    augs: [
      uaug('juju', 'viral', '바이럴', '팬서비스 공격 속도 +15%p, 지속 +2초.', setSk((s) => { s.as += 0.15; s.dur += 2; })),
      uaug('juju', 'merch', '굿즈 판매', '전투 승리 시 크레딧 +2.', {}, { after: (run, _u, won) => { if (won) run.credits += 2; } }),
      uaug('juju', 'fanclub', '공식 팬클럽', '전투 승리 시 명성 +1.', {}, { after: (run, _u, won) => { if (won) run.fame += 1; } }),
      uaug('juju', 'poppy', '뽀삐 대형화', '뽀삐 스탯 상속률 +30%p.', { setup: (u) => { u.mem.bondBonus = (u.mem.bondBonus || 0) + 0.3; } }),
      uaug('juju', 'live', '라이브 방송', '팬서비스 중인 아군 피해 +15%.', setSk((s) => { s.live = 1; })),
    ],
  },
  {
    id: 'kar', name: "카'르 투", title: '공동체 현상금 사냥꾼', faction: 'PAN', traits: ['INFIL', 'MARK'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(7, 9, 7, 4, 7),
    sprite: 'crawler', palette: ['#0a100c', '#5a7a4a', '#c04a7a', '#a0c080', '#ff5050', '#3a4a3a', '#e0ffd0'],
    lore: '여섯 다리 중 둘로 칼을, 넷으로 트로피를 든다.',
    skill: {
      name: '도약 암살', cd: 7,
      params: { mult: 3.0, crit: 0.5, pounce: 0, reset: 0 },
      desc: (p) => `가장 먼 적 옆으로 도약해 타격 위력 ${pct(p.mult)} 물리 피해 (치명타 확률 +${pct(p.crit)}p).`,
      cast(b, u) {
        const t = b.farthest(u);
        if (!t) return false;
        if (b.dist(u, t) > 1 && !blinkTo(b, u, t)) return false;
        const p = u.sk;
        const r = skillHit(b, u, t, 'strike', p.mult, 'phys', { critBonus: p.crit });
        if (t.alive && p.pounce) b.stun(u, t, 1);
        if (r.killed && p.reset) u.cd = 0.3;
        return true;
      },
    },
    augs: [
      uaug('kar', 'trophy', '전리품 수집', '적을 처치할 때마다 전투 동안 피해 +10% (중첩).', {
        hooks: { onKill(b, u) { u.mem.trophy = (u.mem.trophy || 0) + 1; b.buff(u, u, `kar.trophy${u.mem.trophy}`, 999, { mods: [inc('all', 0.1)], label: '전리품' }); } },
      }),
      uaug('kar', 'pounce', '덮치기', '도약 암살이 대상을 1초 기절시킨다.', setSk((s) => { s.pounce = 1; })),
      uaug('kar', 'camo', '광학 위장', '회피 +20%p, 기동력 +2.', { stats: { eva: 0.2 }, majors: { agi: 2 } }),
      uaug('kar', 'instinct', '사냥 본능', '체력 50% 이하인 적에게 주는 피해 +35%.', {
        hooks: { dmgMult: (b, _u, t) => (b.hpPct(t) <= 0.5 ? 1.35 : 1) },
      }),
      uaug('kar', 'reset', '재도약', '도약 암살로 처치하면 쿨다운이 즉시 초기화된다.', setSk((s) => { s.reset = 1; })),
    ],
  },
  {
    id: 'nova', name: '노바 할머니', title: '공동체 은하 텃밭지기', faction: 'PAN', traits: ['NATURE', 'BUDDY'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 1.2 }, range: 3, base: B(8, 6, 7, 5, 3),
    sprite: 'robe', palette: ['#10140a', '#7a9a4a', '#e8d8b0', '#e0b890', '#ff8040', '#5a6a4a', '#fffff0'],
    summon: { name: '토마토 3호', sprite: 'drone', palette: GARDEN, atk: { type: 'shoot', elem: 'chem', interval: 1.0 }, range: 2, hpMul: 0.7 },
    lore: '"밥은 먹고 싸우니?" 대답이 늦으면 수프가 날아온다.',
    skill: {
      name: '약초 수프', cd: 9,
      params: { heal: 0.9, hearty: 0, spicy: 0 },
      desc: (p) => `모든 아군을 기술 위력 ${pct(p.heal)} 회복하고 해로운 상태이상을 없앤다.`,
      cast(b, u) {
        const allies = b.alliesOf(u);
        if (!allies.some((a) => b.hpPct(a) < 0.85 || a.statuses.some((s) => s.type !== 'buff'))) return false;
        const p = u.sk;
        b.fx(u.x, u.y, 2, 'chem');
        for (const a of allies) {
          b.heal(u, a, b.S(u, 'tech') * p.heal);
          cleanse(a);
          if (p.hearty) a.mem.soup = 4;
          if (p.spicy) b.buff(u, a, 'nova.spicy', 4, { mods: [inc('all', 0.15)], label: '매운 맛' });
        }
        return true;
      },
    },
    augs: [
      uaug('nova', 'hearty', '든든한 한 그릇', '수프 회복량 +40%, 4초간 초당 최대 체력 2% 추가 회복.', {
        setup: (u) => { u.sk.heal *= 1.4; u.sk.hearty = 1; },
        hooks: {
          onTick(b, u, dt) {
            u.mem.soupT = (u.mem.soupT || 0) + dt;
            if (u.mem.soupT < 1) return;
            u.mem.soupT = 0;
            for (const a of b.alliesOf(u)) if ((a.mem.soup || 0) > 0) { a.mem.soup--; b.heal(u, a, b.S(a, 'maxHp') * 0.02); }
          },
        },
      }),
      uaug('nova', 'spicy', '매운 맛', '수프를 먹은 아군 4초간 피해 +15%.', setSk((s) => { s.spicy = 1; })),
      uaug('nova', 'tomato', '토마토 4호', '텃밭 드론을 하나 더 데려온다 (상속률 60%).', { setup: (u) => { u.mem.extraSummon = (u.mem.extraSummon || 0) + 1; } }),
      uaug('nova', 'compost', '퇴비', '적이 쓰러질 때마다 전투 동안 기술 위력 +5% (중첩).', {
        hooks: {
          onTick(b, u) {
            const dead = b.units.filter((x) => x.side !== u.side && !x.alive).length;
            if (dead > (u.mem.compost || 0)) { u.st.tech *= Math.pow(1.05, dead - (u.mem.compost || 0)); u.mem.compost = dead; }
          },
        },
      }),
      uaug('nova', 'hands', '할머니 손', '회복 효율 +30%, 생명력 +4.', { stats: { healEff: 0.3 }, majors: { vit: 4 } }),
    ],
  },
];
