// 메이저 궁극기 15종: 자연 충전(기준 35초 × 충전 계수), 발동하면 컷인 + 강력한 효과
import type { Battle, CUnit, Hooks, UltDef } from '../engine/combat';
import { inc, red, vuln } from '../engine/effects';
import { bleed, blinkTo, lineTargets, poison, shock } from './kit';
import { ENG_HOOK } from './synergies';
import { EXTRA_ULTS } from './majoraugs';

/** 일정 시간 동안 주기적으로 실행 (궁극기 지속 효과). 끝나면 end 실행 */
function channel(u: CUnit, dur: number, every: number, fn: (b: Battle, i: number) => void, end?: (b: Battle) => void) {
  let t = 0, acc = every, i = 0;
  const h: Hooks = {
    onTick(b, self, dt) {
      if (!h.onTick) return;
      t += dt; acc += dt;
      while (acc >= every && t <= dur + 1e-6) { acc -= every; if (self.alive) fn(b, i++); }
      if (t >= dur) { h.onTick = undefined; end?.(b); }
    },
  };
  u.hooks.push(h);
}
const S = (b: Battle, u: CUnit, k: 'shoot' | 'strike' | 'tech') => b.S(u, k);
const shot = (b: Battle, u: CUnit, t: CUnit, mult: number, elem: 'phys' | 'chem' | 'elec' = 'phys', o: { pen?: number; crit?: number; noMiss?: boolean } = {}) => {
  b.emit({ k: 'atk', from: u.id, to: t.id, elem, ranged: true });
  return b.dealDamage(u, t, S(b, u, 'shoot') * mult, { elem, tag: 'skill', kind: 'shoot', canMiss: !o.noMiss, pen: o.pen, critBonus: o.crit });
};
const slash = (b: Battle, u: CUnit, t: CUnit, mult: number, elem: 'phys' | 'chem' = 'phys', pen = 0) =>
  b.dealDamage(u, t, S(b, u, 'strike') * mult, { elem, tag: 'skill', kind: 'strike', canMiss: false, pen });
/** 적이 가장 많이 모인 칸 */
function densest(b: Battle, u: CUnit, r: number) {
  const es = b.enemiesOf(u);
  return es.length ? es.slice().sort((a, z) => b.around(z, r, es).length - b.around(a, r, es).length)[0] : null;
}

const BASE_ULTS: Record<string, UltDef> = {
  mirinae: {
    id: 'mirinae', name: '신기루 종막', charge: 1.0, line: '캠핑 장비값은 이걸로 충당할게.',
    desc: '가장 체력이 높은 적의 배후로 이동해 사격 위력 1200% 물리 단발 (치명타 확정, 빗나가지 않음).',
    theme: { pat: 'haze', c1: '#ffb46a', c2: '#5a3a1a', txt: 'heat' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      const t = es.reduce((a, c) => (c.hp > a.hp ? c : a));
      blinkTo(b, u, t);
      shot(b, u, t, 12, 'phys', { crit: 1, noMiss: true });
      return true;
    },
  },
  gebek: {
    id: 'gebek', name: '헤비 버니 풀오토', charge: 0.9, line: '유리야, 아빠 일 좀 하고 갈게.',
    desc: '2초 동안 대상 주변 2칸에 사격 위력 60% 물리 20연사. 맞은 적은 50% 확률로 [제압] (다음 공격 피해 1).',
    theme: { pat: 'shells', c1: '#c8b46a', c2: '#3a3a22', txt: 'shake' },
    cast(b, u) {
      const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
      if (!t) return false;
      const cx = t.x, cy = t.y;
      channel(u, 2, 0.1, (bb) => {
        const vs = bb.around({ x: cx, y: cy }, 2, bb.enemiesOf(u));
        if (!vs.length) return;
        const v = bb.rng.pick(vs);
        const r = shot(bb, u, v, 0.6);
        if (r.amount > 0 && v.alive && bb.rng.chance(0.5)) bb.applyStatus(u, v, { type: 'buff', key: 'suppress', dur: 10, label: '제압' });
      });
      return true;
    },
  },
  lindiwe: {
    id: 'lindiwe', name: '신용 보증', charge: 1.0, line: '보증 서드리죠. 이자는 나중에.',
    // 스킬 한쪽 원칙: 아군 보호 전용 (예전의 '끝날 때 적에게 되돌리기'는 제거, 대신 아군 전원 피해량 경감)
    desc: '아군 전원에게 각자 최대 체력 15% 보호막. 6초간 다른 아군이 받는 피해의 절반을 대신 받고 (자신의 피해량 경감 50%), 그동안 아군 전원 피해량 경감 15%.',
    theme: { pat: 'hex', c1: '#5ad8c8', c2: '#c8a040', txt: 'stamp' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      for (const a of b.alliesOf(u)) b.shield(a, b.S(a, 'maxHp') * 0.15);
      for (const a of b.alliesOf(u, false)) b.buff(u, a, 'lind.ult', 6, { share: u, shareRate: 0.5, taken: [red('all', 0.15)], label: '신용 보증' });
      b.buff(u, u, 'lind.vault', 6, { taken: [red('all', 0.5)], label: '보증 금고' });
      return true;
    },
  },
  franze: {
    id: 'franze', name: '판결 선고', charge: 1.0, line: '본 법정은 피고에게 유죄를 선고합니다.',
    desc: '모든 적에게 4초간 [판결]: 그동안 아군이 준 피해의 40%를 기록하고, 끝날 때 기록의 150%를 고정 피해로 정산한다.',
    theme: { pat: 'law', c1: '#e04050', c2: '#e8d8b0', txt: 'type' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      for (const e of es) b.applyStatus(u, e, { type: 'buff', key: 'franze.verdict', dur: 4, rec: 0, recRate: 0.4, label: '판결',
        onExpire(bb, tgt, s) { if (s.rec && s.src && tgt.alive) bb.dealDamage(s.src, tgt, s.rec * 1.5, { elem: 'true', tag: 'proc' }); } });
      return true;
    },
  },
  grenholm: {
    id: 'grenholm', name: '7중 방호 전면 전개', charge: 0.9, line: '이 양식 다시 써 와. 살아서.',
    // 스킬 한쪽 원칙: 방호 전용 (주변 적 피해 · 기절 제거, 대신 아군 전원 보호막)
    desc: '자신에게 최대 체력 50% 보호막, 다른 아군 전원에게 각자 최대 체력 15% 보호막. 6초간 아군 전원 방어도 +300, 피해량 경감 15%.',
    theme: { pat: 'form', c1: '#c8ccd4', c2: '#d03838', txt: 'stamp' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      b.shield(u, b.S(u, 'maxHp') * 0.5);
      b.fx(u.x, u.y, 2, 'phys', 'buff');
      for (const a of b.alliesOf(u, false)) b.shield(a, b.S(a, 'maxHp') * 0.15);
      for (const a of b.alliesOf(u)) b.buff(u, a, 'gren.wall', 6, { delta: { armor: 300 }, taken: [red('all', 0.15)], label: '방호 전개' });
      return true;
    },
  },
  falcon: {
    id: 'falcon', name: '시험 사격 1,205회차', charge: 0.85, line: '사고 보고서는… 나중에 쓸게요.',
    desc: '대상 방향 직선 위 모든 적에게 사격 위력 1100% 물리 피해 (방어도 완전 관통). 30% 확률로 사고: 자신이 최대 체력 10% 고정 피해.',
    theme: { pat: 'rail', c1: '#6ae8ff', c2: '#ffffff', txt: 'glitch' },
    cast(b, u) {
      const t = u.target?.alive ? u.target : b.nearest(u, b.enemiesOf(u));
      if (!t) return false;
      for (const e of lineTargets(b, u, t)) shot(b, u, e, 11, 'phys', { pen: 1, noMiss: true });
      if (b.rng.chance(0.3)) { b.emit({ k: 'status', id: u.id, name: '사고 발생!' }); b.dealDamage(u, u, b.S(u, 'maxHp') * 0.1, { elem: 'true', tag: 'proc', noHooks: true }); }
      return true;
    },
  },
  temur: {
    id: 'temur', name: '경기장의 왕', charge: 1.1, line: '자, 주인님. 이번엔 얼마나 줄 텐가?',
    desc: '6초간 매초 주변 1칸 적에게 타격 위력 150% 물리 피해. 그동안 [투사] 중첩이 2배로 쌓이고, 기절 · 공포에 걸리지 않으며, 적을 처치하면 최대 체력 15% 회복.',
    theme: { pat: 'arena', c1: '#ff7a3a', c2: '#ffd36a', txt: 'roar' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      u.mem.kingUntil = b.t + 6; u.mem.ccImmuneUntil = b.t + 6;
      const h: Hooks = { onKill(bb, self) { if (h.onKill && (self.mem.kingUntil || 0) > bb.t) bb.heal(self, self, bb.S(self, 'maxHp') * 0.15, true); } };
      u.hooks.push(h);
      channel(u, 6, 1, (bb) => { const vs = bb.around(u, 1, bb.enemiesOf(u)); if (vs.length) bb.fx(u.x, u.y, 1, 'phys'); for (const e of vs) slash(bb, u, e, 1.5); }, () => { h.onKill = undefined; });
      return true;
    },
  },
  argon: {
    id: 'argon', name: '망자의 항로', charge: 1.0, line: '…늦더라도, 반드시 도착한다.',
    desc: '1.5초 동안 무작위 적에게 작살 12회 (사격 위력 90% 화학). 맞은 적은 4초간 받는 피해 +15%.',
    theme: { pat: 'sea', c1: '#3ad0c0', c2: '#0a1418', txt: 'mist' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      channel(u, 1.5, 0.125, (bb) => {
        const es = bb.enemiesOf(u);
        if (!es.length) return;
        const t = bb.rng.pick(es);
        const r = shot(bb, u, t, 0.9, 'chem');
        if (r.amount > 0 && t.alive) bb.applyStatus(u, t, { type: 'buff', key: 'argon.mark', dur: 4, taken: [vuln('all', 0.15)], label: '망자의 표식' });
      });
      return true;
    },
  },
  sarma: {
    id: 'sarma', name: '사건의 지평선', charge: 0.95, line: '아, 실례했어요. 이 은하에선 이게 처음이라.',
    desc: '적이 가장 많이 모인 곳에 4초간 블랙홀: 매초 주변 2칸 적을 한 칸씩 끌어당기며 사격 위력 120% 물리 피해, 끝나면 폭발해 사격 위력 400%.',
    theme: { pat: 'vortex', c1: '#a06aff', c2: '#0a0614', txt: 'reverse' },
    cast(b, u) {
      const c = densest(b, u, 2);
      if (!c) return false;
      const cx = c.x, cy = c.y;
      channel(u, 4, 1, (bb) => {
        bb.fx(cx, cy, 2, 'psy');
        for (const e of bb.around({ x: cx, y: cy }, 2, bb.enemiesOf(u))) {
          const nx = e.x + Math.sign(cx - e.x), ny = e.y + Math.sign(cy - e.y);
          if (!e.immobile && !e.isBoss && (nx !== e.x || ny !== e.y) && bb.inBounds(nx, ny) && !bb.unitAt(nx, ny)) { e.px = e.x; e.py = e.y; e.x = nx; e.y = ny; e.moveT = e.moveDur = 0.2; bb.displaced(u, e, 'pull'); }
          bb.dealDamage(u, e, S(bb, u, 'shoot') * 1.2, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false });
        }
      }, (bb) => {
        if (!u.alive) return;
        bb.fx(cx, cy, 2, 'psy');
        for (const e of bb.around({ x: cx, y: cy }, 2, bb.enemiesOf(u))) bb.dealDamage(u, e, S(bb, u, 'shoot') * 4, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false });
      });
      return true;
    },
  },
  yupito: {
    id: 'yupito', name: '비장의 한 수', charge: 1.0, line: '공학자는 언제나 비장의 한 수가 있지.',
    desc: '아군 전원에게 기술 위력 200% 보호막. 감시 포탑 1기를 추가로 설치하고, 8초간 모든 포탑 공격 속도 +60%.',
    theme: { pat: 'blueprint', c1: '#4a9cff', c2: '#ff9a3a', txt: 'spark' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      for (const a of b.alliesOf(u)) b.shield(a, b.P(u, 'tech') * 2);
      ENG_HOOK.spawn?.(b, u, [u], 1, 99); // 편성 장비 · 개조부품이 없는 추가 포탑 (포탑 번호 99)
      for (const t of b.alliesOf(u).filter((x) => x.defId === 'turret')) b.buff(u, t, 'yup.over', 8, { delta: { atkSpd: 0.6 }, label: '과부하' });
      return true;
    },
  },
  oliver: {
    id: 'oliver', name: '막차 급행', charge: 1.05, line: '다음 역은— 종점입니다~!',
    desc: '가장 뒤쪽 적까지 3줄 폭으로 돌진해 경로의 모든 적에게 기술 위력 350% 물리 피해 + 1초 기절, 1칸 밀쳐낸다.',
    theme: { pat: 'metro', c1: '#ffd23a', c2: '#141414', txt: 'slide' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      const t = es.reduce((a, c) => ((u.side === 0 ? c.y < a.y : c.y > a.y) ? c : a));
      const dx = t.x - u.x, dy = t.y - u.y, len = Math.hypot(dx, dy) || 1;
      const hit = es.filter((e) => {
        const along = ((e.x - u.x) * dx + (e.y - u.y) * dy) / len;
        const off = Math.abs((e.x - u.x) * dy - (e.y - u.y) * dx) / len;
        return along >= -0.5 && along <= len + 0.5 && off <= 1.5;
      });
      blinkTo(b, u, t);
      for (const e of hit) {
        b.dealDamage(u, e, b.P(u, 'tech') * 3.5, { elem: 'phys', tag: 'skill', kind: 'tech', canMiss: false });
        if (!e.alive) continue;
        b.stun(u, e, 1);
        const nx = e.x + Math.sign(dx), ny = e.y + Math.sign(dy);
        if (!e.immobile && !e.isBoss && b.inBounds(nx, ny) && !b.unitAt(nx, ny)) { e.px = e.x; e.py = e.y; e.x = nx; e.y = ny; e.moveT = e.moveDur = 0.2; b.displaced(u, e, 'knock'); }
      }
      return true;
    },
  },
  kaburaya: {
    id: 'kaburaya', name: '정시 퇴근', charge: 1.0, line: '18시입니다. 퇴근하겠습니다.',
    // 스킬 한쪽 원칙: 적 전용 (아군 쿨다운 감소 제거, 피해 250 → 300%)
    desc: '모든 적에게 전술 위력 300% 전기 피해 + 2초 감전.',
    theme: { pat: 'office', c1: '#e8e05a', c2: '#2a2c30', txt: 'bored' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      for (const e of es) {
        b.dealDamage(u, e, b.P(u, 'tech') * 3, { elem: 'elec', tag: 'skill', kind: 'tech', canMiss: false });
        if (e.alive) shock(b, u, e, 2, 1);
      }
      return true;
    },
  },
  issac: {
    id: 'issac', name: '실험체 해방', charge: 0.9, line: '실례하겠습니다. 잠시… 예의를 벗겠습니다.',
    desc: '8초간 주는 피해 +50%, 피해량 경감 30%, 초당 최대 체력 3% 재생. 기본 공격이 주변 1칸 적에게도 타격 위력 60% 화학 피해 + 중독.',
    theme: { pat: 'tape', c1: '#7aff6a', c2: '#f4f4f0', txt: 'unwrap' },
    cast(b, u) {
      if (!b.enemiesOf(u).length) return false;
      b.buff(u, u, 'issac.free', 8, { mods: [inc('all', 0.5)], taken: [red('all', 0.3)], label: '해방' });
      channel(u, 8, 1, (bb) => bb.heal(u, u, bb.S(u, 'maxHp') * 0.03, true));
      const until = b.t + 8;
      const h: Hooks = { onBasic(bb, self, t) {
        if (!h.onBasic || bb.t > until) { h.onBasic = undefined; return; }
        for (const e of bb.around(t, 1, bb.enemiesOf(self))) {
          if (e === t) continue;
          bb.dealDamage(self, e, bb.S(self, 'strike') * 0.6, { elem: 'chem', tag: 'proc', kind: 'strike' });
          if (e.alive) poison(bb, self, e, bb.S(self, 'strike') * 0.2, 3, 1);
        }
      } };
      u.hooks.push(h);
      return true;
    },
  },
  exile: {
    id: 'exile', name: '혈월', charge: 1.0, line: '피는 덜 흘리겠다 했지. 내 피 말이네.',
    desc: '체력 비율이 가장 낮은 적 3명에게 차례로 순간이동해 타격 위력 300% 물리 피해 + 출혈. (회복은 특성 [혈족의 갈증]: 준 피해의 35%)',
    theme: { pat: 'moon', c1: '#e02040', c2: '#120408', txt: 'smear' },
    cast(b, u) {
      const es = b.enemiesOf(u).slice().sort((a, z) => b.hpPct(a) - b.hpPct(z)).slice(0, 3);
      if (!es.length) return false;
      for (const e of es) {
        if (!e.alive) continue;
        blinkTo(b, u, e);
        slash(b, u, e, 3);
        if (e.alive) bleed(b, u, e, b.S(u, 'strike') * 0.3, 4);
      }
      return true;
    },
  },
  rus: {
    id: 'rus', name: '약탈 개시', charge: 1.05, line: '공평하게 나눠 갖자고. 내가 다 갖는 걸로.',
    desc: '모든 적에게 쌍권총 난사 (적마다 사격 위력 180% 물리). 이 공격으로 처치하면 크레딧 +2 (전투당 최대 3회).',
    theme: { pat: 'bounty', c1: '#c08a3a', c2: '#3a2414', txt: 'stamp' },
    cast(b, u) {
      const es = b.enemiesOf(u);
      if (!es.length) return false;
      for (const e of es) {
        const r = shot(b, u, e, 1.8);
        if (r.killed && (u.mem.ultLoot || 0) < 3) { u.mem.ultLoot = (u.mem.ultLoot || 0) + 1; u.mem.g_ultLoot = (u.mem.g_ultLoot || 0) + 2; }
      }
      return true;
    },
  },
  // 청라공국: 공왕 무휼 (지휘관이면 전술 위력, 명사수면 사격 위력 — b.P)
  muhyul: {
    id: 'muhyul', name: '귀허의 섬광', charge: 0.9, line: '본좌는 마땅히 있어야 할 곳으로 돌아가겠다!',
    desc: '적이 가장 많이 모인 곳 주변 2칸에 기억의 유성을 떨어뜨려 전술 위력 380% 물리 피해 + 1초 기절, 맞은 적에게 [기록] (6초, 받는 피해 +15%).',
    theme: { pat: 'rail', c1: '#7fe3ff', c2: '#c8303a', txt: 'glitch' },
    cast(b, u) {
      const c = densest(b, u, 2);
      if (!c) return false;
      b.fx(c.x, c.y, 2, 'phys');
      for (const e of b.around(c, 2, b.enemiesOf(u))) {
        b.dealDamage(u, e, b.P(u, 'shoot') * 3.8, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false });
        if (!e.alive) continue;
        b.stun(u, e, 1);
        b.applyStatus(u, e, { type: 'buff', key: 'king.rec', dur: 6, taken: [vuln('all', Math.max(0.15, u.sk.vuln || 0))], label: '기록' });
      }
      return true;
    },
  },
  juseong: {
    id: 'juseong', name: '월하 호위', charge: 1.0, line: '왕자는 뒤로. 여기서부터는 통행료 받는다.',
    desc: '주변 2칸 적에게 타격 위력 320% 물리 피해 + 1초 기절, 자신에게 최대 체력 25% 보호막.',
    theme: { pat: 'shells', c1: '#5ad08a', c2: '#14201a', txt: 'shake' },
    cast(b, u) {
      const es = b.around(u, 2, b.enemiesOf(u));
      if (!es.length) return false;
      b.fx(u.x, u.y, 2, 'phys');
      for (const e of es) { slash(b, u, e, 3.2); if (e.alive) b.stun(u, e, 1); }
      b.shield(u, b.S(u, 'maxHp') * 0.25);
      return true;
    },
  },
  // 칼리토 제국 (5 · 7 · 9) 소환물 [근위기사] 전용 (기물 궁극기와 같은 틀)
  kal_guard: {
    id: 'kal_guard', name: '제국의 검', charge: 0.8, line: '황제 폐하의 이름으로!',
    desc: '대상과 주변 1칸 적에게 타격 위력 300% 물리 피해 + 1초 기절.',
    theme: { pat: 'shells', c1: '#e0b040', c2: '#5a1018', txt: 'shake' },
    cast(b, u) {
      const t = u.target?.alive && b.dist(u, u.target) <= 2 ? u.target : null;
      if (!t) return false;
      b.fx(t.x, t.y, 1, 'phys');
      for (const e of b.around(t, 1, b.enemiesOf(u))) { slash(b, u, e, 3); if (e.alive) b.stun(u, e, 1); }
      return true;
    },
  },
};
/** 메이저 궁극기: 기본 + 예전 스페셜 기물에 새로 준 궁극기 (majoraugs) */
export const ULTS: Record<string, UltDef> = { ...BASE_ULTS, ...EXTRA_ULTS };
