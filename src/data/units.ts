import type { Battle, CUnit, SkillDef } from '../engine/combat';
import { type AugDef, type Effect, inc } from '../engine/effects';
import type { Elem, FactionId, Keyword, Major, TraitId } from '../types';
import { bleed, corrode, fear, lineTargets, poison, pct, shock, skillHit } from './kit';

export interface UnitDef {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  traits: TraitId[];
  keywords: Keyword[];
  atk: { type: 'shoot' | 'strike'; elem: Elem; interval: number };
  range: number;
  base: Record<Major, number>;
  sprite: string;
  palette: string[];
  skill: SkillDef;
  lore: string;
  augs: AugDef[];
}

const B = (vit: number, pow: number, mnd: number, def: number, agi: number) => ({ vit, pow, mnd, def, agi });

function uaug(owner: string, id: string, name: string, desc: string, effect: Effect, extra: Partial<AugDef> = {}): AugDef {
  return { id: `${owner}.${id}`, name, desc, pool: 'unit', owner, effect: () => effect, ...extra };
}
const setSk = (f: (sk: Record<string, number>, u: CUnit) => void): Effect => ({ setup: (u) => f(u.sk, u) });

// 팔레트: [외곽선, 주색, 보조색, 피부, 바이저, 금속, 하이라이트]
const PAL = {
  UNI: ['#10131c', '#3b6fd8', '#c9d6f2', '#f0c8a0', '#7fe3ff', '#59606e', '#ffffff'],
  KAL: ['#140c0c', '#a8283a', '#e0b040', '#e8c09a', '#ffd34d', '#6a5a50', '#fff3c0'],
  HEL: ['#0b1614', '#2fa39a', '#e8eef0', '#d8b090', '#b07cff', '#4f6866', '#ffffff'],
  PET: ['#141008', '#e07a1f', '#3a3a40', '#e6bc94', '#7dff8a', '#55555c', '#fff0d0'],
};

export const UNITS: UnitDef[] = [
  // ───────────────────────── 성간 인류 연합
  {
    id: 'lea', name: '레아 바스케스', title: '연합 해병대 저격수', faction: 'UNI', traits: ['MARK'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(5, 9, 8, 3, 5),
    sprite: 'soldier', palette: PAL.UNI,
    lore: '세 번 전역하고 세 번 재입대했다. 이유는 묻지 마라.',
    skill: {
      name: '정조준 사격', cd: 6, needsRange: true,
      params: { mult: 2.6, critBonus: 0.3, shots: 1, second: 0.6, pen: 0, resetOnKill: 0, medal: 0 },
      desc: (p) => `대상에게 사격 위력 ${pct(p.mult)} 물리 피해. 이 공격의 치명타 확률 +${pct(p.critBonus)}p.` +
        (p.shots > 1 ? ` ${p.shots}회 발사 (추가 탄 ${pct(p.second)}).` : '') + (p.pen ? ` 방어도 관통 ${pct(p.pen)}.` : ''),
      cast(b, u) {
        const p = u.sk;
        for (let i = 0; i < p.shots; i++) {
          const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
          if (!t) break;
          b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
          const r = skillHit(b, u, t, 'shoot', p.mult * (i ? p.second : 1), 'phys', { critBonus: p.critBonus, pen: p.pen });
          if (r.killed && p.resetOnKill) u.cd = 0.3;
          if (r.crit && p.medal) for (const a of b.alliesOf(u)) b.buff(u, a, 'lea.medal', 3, { delta: { crit: 0.15 }, label: '명예 훈장' });
        }
        return true;
      },
    },
    augs: [
      uaug('lea', 'double', '더블 탭', '정조준 사격을 2회 발사한다 (두 번째 탄 60%).', setSk((s) => { s.shots = 2; })),
      uaug('lea', 'pen', '약점 사격', '정조준 사격이 방어도를 50% 관통한다.', setSk((s) => { s.pen = 0.5; })),
      uaug('lea', 'hunt', '사냥꾼의 직감', '정조준 사격으로 적을 처치하면 쿨다운이 즉시 초기화된다.', setSk((s) => { s.resetOnKill = 1; })),
      uaug('lea', 'calc', '탄도 계산기', '기본 공격 3회마다 사격 위력 70% 추가 사격.', {
        hooks: {
          onBasic(b, u, t) {
            u.mem.calc = (u.mem.calc || 0) + 1;
            if (u.mem.calc % 3 === 0 && t.alive) skillHit(b, u, t, 'shoot', 0.7, 'phys', { tag: 'proc' });
          },
        },
      }),
      uaug('lea', 'medal', '명예 훈장', '정조준 사격이 치명타로 적중하면 3초간 모든 아군 치명타 확률 +15%p.', setSk((s) => { s.medal = 1; })),
    ],
  },
  {
    id: 'tom', name: '톰 하울리', title: '연합 강습 방패병', faction: 'UNI', traits: ['VAN', 'MED'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, base: B(9, 6, 4, 9, 2),
    sprite: 'knight', palette: PAL.UNI,
    lore: '방패에 붙은 스티커는 딸이 붙여준 것. 떼면 죽는다.',
    skill: {
      name: '방패 돌진', cd: 8, needsRange: true,
      params: { mult: 1.5, stun: 1.5, shield: 0.15, aoe: 0, guard: 0, steel: 0, heal: 0 },
      desc: (p) => `대상에게 타격 위력 ${pct(p.mult)} 물리 피해 + ${p.stun}초 기절. 자신에게 최대 체력 ${pct(p.shield)} 보호막.`,
      cast(b, u) {
        const t = u.target;
        if (!t || !t.alive) return false;
        const p = u.sk;
        const victims = p.aoe ? b.around(t, 1, b.enemiesOf(u)) : [t];
        b.fx(t.x, t.y, p.aoe ? 1 : 0, 'phys');
        for (const v of victims) { skillHit(b, u, v, 'strike', p.mult, 'phys'); b.stun(u, v, p.stun); }
        const sh = b.S(u, 'maxHp') * p.shield;
        b.shield(u, sh);
        if (p.guard) { const l = b.lowestHpAlly(u); if (l && l !== u) b.shield(l, sh); }
        if (p.steel) b.buff(u, u, 'tom.steel', 5, { delta: { armor: 400 }, label: '강철 의지' });
        if (p.heal) for (const a of b.around(u, 1, b.alliesOf(u))) b.heal(u, a, b.S(u, 'tech') * 1.2);
        return true;
      },
    },
    augs: [
      uaug('tom', 'wall', '방패벽', '방패 돌진의 보호막이 2배가 된다.', setSk((s) => { s.shield *= 2; })),
      uaug('tom', 'quake', '진동 타격', '방패 돌진이 대상 주변 1칸의 모든 적을 강타하고 기절시킨다.', setSk((s) => { s.aoe = 1; })),
      uaug('tom', 'guard', '수호 본능', '방패 돌진 시 체력 비율이 가장 낮은 아군에게도 같은 보호막을 준다.', setSk((s) => { s.guard = 1; })),
      uaug('tom', 'steel', '강철 의지', '방패 돌진 후 5초간 방어도 +400.', setSk((s) => { s.steel = 1; })),
      uaug('tom', 'medic', '야전 응급', '방패 돌진 시 주변 아군을 기술 위력 120%만큼 회복.', setSk((s) => { s.heal = 1; })),
    ],
  },
  {
    id: 'miko', name: '미코 앨런', title: '연합 나노 의무관', faction: 'UNI', traits: ['SPEC', 'MED'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'chem', interval: 1.0 }, range: 3, base: B(6, 6, 7, 4, 5),
    sprite: 'medic', palette: PAL.UNI,
    lore: '"치료용 나노봇과 공격용 나노봇의 차이요? 설정값 하나요."',
    skill: {
      name: '나노 치유 구름', cd: 7,
      params: { mult: 2.0, radius: 1, toxic: 0, over: 0, adren: 0 },
      desc: (p) => `체력 비율이 가장 낮은 아군과 주변 ${p.radius}칸 아군을 기술 위력 ${pct(p.mult)}만큼 회복.`,
      cast(b, u) {
        const t = b.lowestHpAlly(u);
        if (!t || (b.hpPct(t) > 0.9 && !u.sk.toxic)) return false;
        const p = u.sk;
        b.fx(t.x, t.y, p.radius, 'chem');
        for (const a of b.around(t, p.radius, b.alliesOf(u))) {
          b.heal(u, a, b.S(u, 'tech') * p.mult);
          if (p.adren) b.buff(u, a, 'miko.adren', 4, { delta: { atkSpd: 0.3 }, label: '아드레날린' });
        }
        if (p.toxic) for (const e of b.around(t, p.radius, b.enemiesOf(u))) {
          skillHit(b, u, e, 'tech', 1.0, 'chem', { noMiss: true });
          poison(b, u, e, b.S(u, 'tech') * 0.3, 4, 0.8);
        }
        return true;
      },
    },
    augs: [
      uaug('miko', 'toxic', '독성 나노', '치유 구름 범위의 적에게 기술 위력 100% 화학 피해 + 중독.', setSk((s) => { s.toxic = 1; })),
      uaug('miko', 'over', '과잉 치유', '초과 회복량을 보호막으로 전환한다.', {
        hooks: { onHealDone(b, u, t, _a, over) { if (over > 0) b.shield(t, over); } },
      }),
      uaug('miko', 'wide', '광역 살포', '치유 구름 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('miko', 'adren', '아드레날린', '회복받은 아군의 공격 속도 4초간 +30%.', setSk((s) => { s.adren = 1; })),
      uaug('miko', 'quick', '속효성 배양', '나노 치유 구름 쿨다운 -2초, 치유량 +30%.', setSk((s, u) => { u.cdMax -= 2; s.mult *= 1.3; })),
    ],
  },
  // ───────────────────────── 칼리토 제국
  {
    id: 'verm', name: '베르무트 폰 칼리토', title: '제국 처형 기사', faction: 'KAL', traits: ['VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.95 }, range: 1, base: B(8, 9, 5, 6, 4),
    sprite: 'knight', palette: PAL.KAL,
    lore: '황제의 서른일곱 번째 조카. 그래서 직접 칼을 든다.',
    skill: {
      name: '처형 일격', cd: 7, needsRange: true,
      params: { mult: 2.0, lost: 0.08, guillotine: 0, oath: 0, bleed: 0, sweep: 0 },
      desc: (p) => `대상에게 타격 위력 ${pct(p.mult)} + 대상이 잃은 체력의 ${pct(p.lost)} 물리 피해.`,
      cast(b, u) {
        const t = u.target;
        if (!t || !t.alive) return false;
        const p = u.sk;
        const lost = Math.max(0, b.S(t, 'maxHp') - t.hp);
        const r = b.dealDamage(u, t, b.S(u, 'strike') * p.mult + lost * p.lost, { elem: 'phys', tag: 'skill', canMiss: true });
        b.fx(t.x, t.y, 0, 'phys');
        if (p.oath) b.heal(u, u, r.amount * 0.3, true);
        if (p.bleed && t.alive) bleed(b, u, t, b.S(u, 'strike') * 0.25, 5);
        if (p.sweep) for (const e of b.around(u, 1, b.enemiesOf(u))) if (e !== t) skillHit(b, u, e, 'strike', p.mult * 0.7, 'phys');
        if (r.killed && p.guillotine) u.cd = 0.3;
        return true;
      },
    },
    augs: [
      uaug('verm', 'guillotine', '단두대', '처형 일격으로 적을 처치하면 쿨다운이 즉시 초기화된다.', setSk((s) => { s.guillotine = 1; })),
      uaug('verm', 'oath', '기사의 맹세', '처형 일격 피해량의 30%만큼 체력을 회복한다.', setSk((s) => { s.oath = 1; })),
      uaug('verm', 'bleed', '출혈 상처', '처형 일격이 5초간 초당 타격 위력 25% 출혈을 남긴다.', setSk((s) => { s.bleed = 1; })),
      uaug('verm', 'sweep', '검무', '처형 일격이 주변 모든 적에게 70% 피해를 준다.', setSk((s) => { s.sweep = 1; })),
      uaug('verm', 'count', '백작 승진', '작위 +1. 모든 메이저 스탯 +2.', { title: 1, majors: { vit: 2, pow: 2, mnd: 2, def: 2, agi: 2 } }),
    ],
  },
  {
    id: 'grendel', name: 'Mk.IV 그렌델', title: '제국 근위 기갑', faction: 'KAL', traits: ['VAN'], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(10, 7, 4, 9, 1),
    sprite: 'mech', palette: PAL.KAL,
    lore: '조종사는 없다. 황실 문장이 조종한다고들 한다.',
    skill: {
      name: '과전류 방출', cd: 9,
      params: { mult: 1.8, radius: 1, shockDur: 2.5, shockChance: 0.6, loop: 0, absorb: 0, conductor: 0 },
      desc: (p) => `주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.mult)} 전기 피해, ${pct(p.shockChance)} 확률로 ${p.shockDur}초 감전 (쿨다운 정지).`,
      cast(b, u) {
        const p = u.sk;
        const es = b.around(u, p.radius, b.enemiesOf(u));
        if (!es.length) return false;
        b.fx(u.x, u.y, p.radius, 'elec');
        for (const e of es) {
          skillHit(b, u, e, 'tech', p.mult, 'elec', { noMiss: true });
          shock(b, u, e, p.shockDur, p.shockChance, p.conductor);
          if (p.absorb) b.shield(u, b.S(u, 'maxHp') * 0.04);
        }
        if (p.loop) u.mem.loop = 3;
        return true;
      },
    },
    augs: [
      uaug('grendel', 'coil', '테슬라 코일', '과전류 방출 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('grendel', 'loop', '과부하 루프', '방출 후 3초간 매초 기술 위력 50% 전기 펄스.', {
        setup: (u) => { u.sk.loop = 1; },
        hooks: {
          onTick(b, u, dt) {
            if (!u.mem.loop || u.mem.loop <= 0) return;
            const before = Math.ceil(u.mem.loop);
            u.mem.loop -= dt;
            if (Math.ceil(u.mem.loop) < before) {
              b.fx(u.x, u.y, u.sk.radius, 'elec');
              for (const e of b.around(u, u.sk.radius, b.enemiesOf(u))) skillHit(b, u, e, 'tech', 0.5, 'elec', { noMiss: true, tag: 'proc' });
            }
          },
        },
      }),
      uaug('grendel', 'absorb', '흡수 장갑', '방출에 맞은 적 1명당 최대 체력 4% 보호막.', setSk((s) => { s.absorb = 1; })),
      uaug('grendel', 'conductor', '전도체', '감전된 적이 받는 모든 피해 +20%. 감전 확률 +20%p.', setSk((s) => { s.conductor = 0.2; s.shockChance += 0.2; })),
      uaug('grendel', 'heavy', '중장갑 개조', '방어력 +6, 생명력 +3, 기동력 -1.', { majors: { def: 6, vit: 3, agi: -1 } }),
    ],
  },
  {
    id: 'seraphine', name: '세라핀 드 칼리토', title: '제국 황실 사냥꾼', faction: 'KAL', traits: ['MARK', 'SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.3 }, range: 5, base: B(4, 10, 8, 3, 5),
    sprite: 'soldier', palette: PAL.KAL,
    lore: '사냥감의 종(種)은 따지지 않는다. 신분은 따진다.',
    skill: {
      name: '관통탄', cd: 8, needsRange: true,
      params: { mult: 2.0, pen: 0.5, shots: 1, bleed: 0 },
      desc: (p) => `대상 방향 직선 위 모든 적에게 사격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)}).`,
      cast(b, u) {
        const p = u.sk;
        let t = u.target;
        if (!t || !t.alive) return false;
        for (let i = 0; i < p.shots; i++) {
          if (i > 0) {
            const others = b.enemiesOf(u).filter((e) => e !== t);
            t = b.nearest(u, others.length ? others : b.enemiesOf(u));
            if (!t) break;
          }
          for (const e of lineTargets(b, u, t!)) {
            b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
            skillHit(b, u, e, 'shoot', p.mult, 'phys', { pen: p.pen });
            if (p.bleed && e.alive) bleed(b, u, e, b.S(u, 'shoot') * 0.3, 4);
          }
        }
        return true;
      },
    },
    augs: [
      uaug('seraphine', 'ap', '고폭 철갑탄', '관통탄 피해 +60%p.', setSk((s) => { s.mult += 0.6; })),
      uaug('seraphine', 'bleed', '귀족의 사냥', '관통탄에 맞은 적에게 4초간 초당 사격 위력 30% 출혈.', setSk((s) => { s.bleed = 1; })),
      uaug('seraphine', 'double', '연속 장전', '관통탄을 다른 대상에게 한 번 더 발사한다.', setSk((s) => { s.shots = 2; })),
      uaug('seraphine', 'cold', '냉철함', '치명타 확률 +20%p, 치명타 피해 +30%p.', { stats: { crit: 0.2, critDmg: 0.3 } }),
      uaug('seraphine', 'imperial', '제국 저격수', '적을 처치할 때마다 쿨다운 50% 회복.', {
        hooks: { onKill(_b, u) { u.cd -= u.cdMax * 0.5; } },
      }),
    ],
  },
  // ───────────────────────── 헬레니우스 동맹
  {
    id: 'orthea', name: '오르테아', title: '동맹 사이오닉 외교관', faction: 'HEL', traits: ['SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.1 }, range: 4, base: B(5, 8, 9, 3, 5),
    sprite: 'phantom', palette: PAL.HEL,
    lore: '협상이 결렬되면, 상대의 생각을 대신 정리해 준다.',
    skill: {
      name: '정신 붕괴', cd: 8, needsRange: true,
      params: { mult: 2.2, radius: 1, fearDur: 2.5, fearChance: 0.5, nightmare: 0, steal: 0, madness: 0 },
      desc: (p) => `대상과 주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.mult)} 정신 피해, ${pct(p.fearChance)} 확률로 ${p.fearDur}초 공포 (공격/기술 불가).`,
      cast(b, u) {
        const t = u.target;
        if (!t || !t.alive) return false;
        const p = u.sk;
        b.fx(t.x, t.y, p.radius, 'psy');
        for (const e of b.around(t, p.radius, b.enemiesOf(u))) {
          const r = skillHit(b, u, e, 'tech', p.mult, 'psy');
          if (e.alive) {
            fear(b, u, e, p.fearDur, p.fearChance, p.nightmare ? 0.2 : 0);
            if (p.steal) e.cd += 2;
          } else if (r.killed && p.madness) {
            for (const x of b.around(e, 1, b.enemiesOf(u))) fear(b, u, x, p.fearDur, 0.5);
          }
        }
        return true;
      },
    },
    augs: [
      uaug('orthea', 'nightmare', '악몽', '공포 지속 +1.5초. 공포에 걸린 적은 받는 피해 +20%.', setSk((s) => { s.fearDur += 1.5; s.nightmare = 1; })),
      uaug('orthea', 'resonance', '정신 공명', '정신 붕괴 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('orthea', 'steal', '사고 강탈', '정신 붕괴에 맞은 적의 기술 쿨다운 +2초.', setSk((s) => { s.steal = 1; })),
      uaug('orthea', 'madness', '광기 전파', '정신 붕괴로 처치한 적 주변의 적에게 50% 확률로 공포.', setSk((s) => { s.madness = 1; })),
      uaug('orthea', 'smile', '외교관의 미소', '효과 명중 +40%p, 공포 확률 +20%p.', { stats: { effHit: 0.4 }, setup: (u) => { u.sk.fearChance += 0.2; } }),
    ],
  },
  {
    id: 'kass', name: '카산드로스', title: '동맹 맹약 수호자', faction: 'HEL', traits: ['MED', 'VAN'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 1.1 }, range: 1, base: B(9, 6, 5, 8, 3),
    sprite: 'knight', palette: PAL.HEL,
    lore: '맹세는 지킨다. 맹세한 대상이 누구였는지는 가끔 잊는다.',
    skill: {
      name: '동맹의 맹세', cd: 9,
      params: { shield: 1.5, armor: 200, dur: 4, radius: 1, reflect: 0, heal: 0, lead: 0 },
      desc: (p) => `자신과 주변 ${p.radius >= 99 ? '모든' : p.radius + '칸'} 아군에게 기술 위력 ${pct(p.shield)} 보호막 + ${p.dur}초간 방어도 +${p.armor}.`,
      cast(b, u) {
        if (!b.enemiesOf(u).length) return false;
        const p = u.sk;
        b.fx(u.x, u.y, Math.min(p.radius, b.n), 'holy');
        for (const a of b.around(u, p.radius, b.alliesOf(u))) {
          b.shield(a, b.S(u, 'tech') * p.shield);
          b.buff(u, a, 'kass.oath', p.dur, {
            delta: { armor: p.armor }, reflect: p.reflect || undefined,
            mods: p.lead ? [inc('all', 0.2)] : undefined, label: '맹세',
          });
          if (p.heal) b.heal(u, a, b.S(u, 'tech') * 1.0);
        }
        return true;
      },
    },
    augs: [
      uaug('kass', 'citadel', '성채', '동맹의 맹세가 모든 아군에게 적용된다.', setSk((s) => { s.radius = 99; })),
      uaug('kass', 'reflect', '반사 맹세', '맹세가 지속되는 동안 받는 피해의 25%를 공격자에게 반사.', setSk((s) => { s.reflect = 0.25; })),
      uaug('kass', 'iron', '철의 동맹', '맹세의 방어도 증가량 +300.', setSk((s) => { s.armor += 300; })),
      uaug('kass', 'heal', '치유의 맹세', '맹세 대상을 기술 위력 100%만큼 회복.', setSk((s) => { s.heal = 1; })),
      uaug('kass', 'lead', '선두 지휘', '맹세 대상의 피해 +20% (지속 시간 동안).', setSk((s) => { s.lead = 1; })),
    ],
  },
  // ───────────────────────── 주식회사 페트라
  {
    id: 'px7', name: 'PX-7 "가디언"', title: '페트라 보안 로봇', faction: 'PET', traits: ['MARK'], keywords: ['mech'],
    atk: { type: 'shoot', elem: 'phys', interval: 0.8 }, range: 3, base: B(6, 7, 6, 6, 4),
    sprite: 'drone', palette: PAL.PET,
    lore: '이용 약관 제14조 3항에 따라 귀하를 제압합니다.',
    skill: {
      name: '제압 사격', cd: 7,
      params: { shots: 5, mult: 0.6, shockChance: 0.15, sure: 0 },
      desc: (p) => `무작위 적에게 사격 위력 ${pct(p.mult)} 전기 사격 ${p.shots}회. 발당 ${pct(p.shockChance)} 확률로 1.5초 감전.`,
      cast(b, u) {
        const p = u.sk;
        if (!b.enemiesOf(u).length) return false;
        for (let i = 0; i < p.shots; i++) {
          const es = b.enemiesOf(u);
          if (!es.length) break;
          const t = p.sure && u.target?.alive ? u.target : b.rng.pick(es);
          b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
          const r = skillHit(b, u, t, 'shoot', p.mult, 'elec', { noMiss: !!p.sure });
          if (!r.miss) shock(b, u, t, 1.5, p.shockChance);
        }
        return true;
      },
    },
    augs: [
      uaug('px7', 'mag', '탄창 확장', '제압 사격 발사 수 +3.', setSk((s) => { s.shots += 3; })),
      uaug('px7', 'track', '추적 탄두', '제압 사격이 현재 대상에게 집중되며 반드시 명중한다.', setSk((s) => { s.sure = 1; })),
      uaug('px7', 'hv', '고전압 탄', '감전 확률 +35%p, 제압 사격 피해 +20%p.', setSk((s) => { s.shockChance += 0.35; s.mult += 0.2; })),
      uaug('px7', 'sec', '보안 프로토콜', '체력이 처음 50% 이하가 되면 전투 끝까지 방어도 +500.', {
        hooks: {
          onHurt(b, u) {
            if (!u.mem.sec && b.hpPct(u) <= 0.5) { u.mem.sec = 1; b.buff(u, u, 'px7.sec', 999, { delta: { armor: 500 }, label: '보안 프로토콜' }); }
          },
        },
      }),
      uaug('px7', 'warranty', '성능 보증', '피해 증가 +10%. 전투 승리 시 크레딧 +1.', { mods: [inc('all', 0.1)] }, {
        after: (run, _u, won) => { if (won) run.credits += 1; },
      }),
    ],
  },
  {
    id: 'mona', name: '모나 킴', title: '페트라 화학 컨설턴트', faction: 'PET', traits: ['MARK', 'SPEC'], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(5, 8, 7, 4, 6),
    sprite: 'medic', palette: PAL.PET,
    lore: '시간당 컨설팅 비용에 유탄 값은 포함되어 있지 않습니다.',
    skill: {
      name: '독성 유탄', cd: 8, needsRange: true, reach: 1,
      params: { mult: 1.3, radius: 1, poisonDps: 0.35, poisonDur: 4, poisonChance: 0.8, neuro: 0, corrode: 0 },
      desc: (p) => `대상 주변 ${p.radius}칸 적에게 기술 위력 ${pct(p.mult)} 화학 피해, ${pct(p.poisonChance)} 확률로 ${p.poisonDur}초간 초당 기술 위력 ${pct(p.poisonDps)} 중독.`,
      cast(b, u) {
        const t = u.target;
        if (!t || !t.alive) return false;
        const p = u.sk;
        b.fx(t.x, t.y, p.radius, 'chem');
        for (const e of b.around(t, p.radius, b.enemiesOf(u))) {
          skillHit(b, u, e, 'tech', p.mult, 'chem', { noMiss: true });
          if (!e.alive) continue;
          poison(b, u, e, b.S(u, 'tech') * p.poisonDps, p.poisonDur, p.poisonChance,
            p.neuro ? { delta: { acc: -0.2, atkSpd: -0.2 } } : {});
          if (p.corrode) corrode(b, u, e, 0.7, 5);
        }
        return true;
      },
    },
    augs: [
      uaug('mona', 'neuro', '신경독', '중독된 적의 명중 -20%p, 공격 속도 -20%.', setSk((s) => { s.neuro = 1; })),
      uaug('mona', 'corrode', '부식 용제', '독성 유탄이 5초간 방어도 30% 감소(부식)를 건다.', setSk((s) => { s.corrode = 1; })),
      uaug('mona', 'wide', '확장형 유탄', '독성 유탄 범위 +1칸.', setSk((s) => { s.radius += 1; })),
      uaug('mona', 'dividend', '고배당 계약', '중독 피해 +60%, 중독 확률 +20%p.', setSk((s) => { s.poisonDps *= 1.6; s.poisonChance += 0.2; })),
      uaug('mona', 'hedge', '리스크 헤지', '전투 시작 시 보유 크레딧이 20 이상이면 기술 위력 +40%.', {
        setup: (u, _b, ctx) => { if (ctx.credits >= 20) u.st.tech *= 1.4; },
      }),
    ],
  },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export type { Battle };
