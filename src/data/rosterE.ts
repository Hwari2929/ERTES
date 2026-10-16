// 사건 전용 기물: 사건 노드로만 합류한다 (시작 기물 · 영입 노드에는 나오지 않음)
import type { CUnit, Status } from '../engine/combat';
import { inc, red } from '../engine/effects';
import { fear, pct, skillHit } from './kit';
import { strike, support } from './tpl';
import { B, PAL, setSk, tint, uaug, type BaseUnit } from './unitkit';

/** 밍키 내면의 괴물 (얌전한 고양이면 수호 각성: 피해 +80% 대신 받는 피해 -25%) */
export function monsterBuff(u: CUnit): Partial<Status> {
  return u.mem.tame ? { delta: { atkSpd: 0.5 }, taken: [red('all', 0.25)], label: '수호 각성' } : { delta: { atkSpd: 0.5 }, mods: [inc('all', 0.8)], label: '내면의 괴물' };
}
const CAT = ['#0c0a10', '#3a3448', '#e8e0f0', '#c8b8d8', '#9ad0ff', '#2a2434', '#ffffff'];
const CRIMSON = ['#100406', '#4a0a14', '#d0c0c0', '#e8c8b8', '#ff2030', '#2a0a10', '#fff0f0'];
const SPARTA = ['#0c0a06', '#b08a30', '#5a4a30', '#f0d080', '#ff6020', '#6a5a30', '#fff0c0'];
const UNIX = ['#0c0c0c', '#b0b0a0', '#6a6a60', '#e0e0d0', '#30ff60', '#4a4a40', '#ffffff'];
const RAIDER = ['#1a0f0a', '#7a5a3a', '#c04a2a', '#d0a080', '#ffd040', '#55504a', '#f0d0a0'];

export const ROSTER_E: BaseUnit[] = [
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
          b.buff(u, u, 'mingki.monster', 999, monsterBuff(u));
          b.emit({ k: 'status', id: u.id, name: u.mem.tame ? '수호 각성!' : '내면의 괴물이 깨어났다!' });
        },
      },
    },
    skill: strike({
      // heal: 특성 [내면의 괴물]의 츄르 간식 회복 비율 (전투 스킬을 쓴 뒤)
      name: '츄르 사냥', cd: 6, pow: 'strike', elem: 'phys', mult: 1.8, target: 'lowest', blink: true, params: { monsterAt: 0.5, heal: 0.05 },
      desc: (p) => `[내면의 괴물] 체력이 처음 ${pct(p.monsterAt)} 이하가 되면 피해 +80%, 공격 속도 +50%. 기술: 체력 비율이 가장 낮은 적에게 뛰어들어 타격 위력 ${pct(p.mult)} 물리 피해${p.hits > 1 ? ` ${p.hits}회` : ''}.`,
    }),
  },
  {
    id: 'onyx', name: '오닉스 감응자', title: '오닉스 합창단 · 사이오닉 감응 집단', factions: ['PAN'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'psy', interval: 1.1 }, range: 3, base: B(5, 5, 11, 3, 5),
    sprite: 'robe', palette: tint(PAL.PAN, '#1a1a2a', '#9a5ad0', '#d0b0ff'), eventOnly: true, noStarter: true,
    lore: '설계되지 않았는데 꾸어지는 꿈이 있다. 합창단은 그것을 "의뢰하지 않은 꿈"이라 부른다. [임시]',
    skill: {
      name: '의뢰하지 않은 꿈', tag: () => '적 전체 정신 공격 + 공포', cd: 8, params: { mult: 0.9, fearChance: 0.25, fear: 1.5, vuln: 0 },
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
  },
  {
    id: 'exile', name: '망명 혈족 귀공자', title: '크림슨 대공령 출신 · 이름을 버린 혈족', factions: ['KAL'], traits: ['INFIL'], keywords: ['bio'],
    atk: { type: 'strike', elem: 'phys', interval: 0.9 }, range: 1, base: B(7, 9, 5, 4, 7),
    sprite: 'knight', palette: CRIMSON, eventOnly: true, noStarter: true,
    lore: '"제국의 방패는 피로 만들어졌다지. 나는 그 피를 조금 덜 흘리기로 했을 뿐이네." [임시]',
    skill: strike({
      name: '혈검', cd: 6, pow: 'strike', elem: 'phys', mult: 2.2, target: 'lowest', blink: true, params: { bleed: 0.3 },
      desc: (p) => `체력 비율이 가장 낮은 적에게 파고들어 타격 위력 ${pct(p.mult)} 물리 피해 + 출혈${p.resetOnKill ? `. 처치 시 쿨다운 ${pct(p.resetOnKill)} 초기화` : ''}.`,
    }),
  },
  {
    id: 'thermo', name: '테르모필레', title: '탈주한 호플리테 메카 · 스파르타 전쟁 궤도', factions: ['HEL'], traits: [], keywords: ['mech'],
    atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, base: B(12, 6, 4, 10, 2),
    sprite: 'mech', palette: SPARTA, eventOnly: true, noStarter: true,
    lore: '"물러서라"는 명령을 끝까지 지킨 끝에, 궤도에서 가장 멀리 물러나 버린 메카. [임시]',
    skill: support({
      name: '팔랑크스', cd: 8, target: 'aroundSelf', params: { radius: 1, shield: 1.4, red: 0.2, dur: 4 },
      desc: (p) => `주변 ${p.radius}칸 아군에게 기술 위력 ${pct(p.shield)} 보호막, ${p.dur}초간 받는 피해 -${pct(p.red)}.`,
    }),
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
  },
  {
    id: 'rus', name: '루스', title: '약탈 함장 바르가의 전 부관', factions: ['PAN'], traits: [], keywords: ['bio'],
    atk: { type: 'shoot', elem: 'phys', interval: 1.0 }, range: 4, base: B(6, 10, 6, 4, 6),
    sprite: 'soldier', palette: RAIDER, eventOnly: true, noStarter: true,
    lore: '"바르가는 배를 잃었고, 나는 배를 챙겼지. 공평하잖아?" [임시]',
    skill: strike({
      name: '약탈 사격', cd: 7, pow: 'shoot', elem: 'phys', mult: 2.4, target: 'farthest', params: { pen: 0.2, hits: 1 },
      desc: (p) => `가장 먼 적에게 사격 위력 ${pct(p.mult)} 물리 피해 (방어도 관통 ${pct(p.pen)})${p.hits > 1 ? ` ${p.hits}회` : ''}.`,
    }),
  },
];
