// 성유물 20종: 디바인 전용 장비. 장착한 성유물이 곧 신권 대행 (전투당 1회).
// 신권 대행의 지속 효과는 발동한 뒤 전투가 끝날 때까지 유지된다. k = 신권 대행 위력 배율 (1 + 봉헌 단계 × CFG.offer.act, engine/run.ts offerStage)
// 장착하면 그 기물의 추천 주요 능력치 첫째가 봉헌 단계에 따라 오른다 (engine/build.ts unitEffects, CFG.offer).
// 상한이 있는 효과 (k 가 커져도 넘지 않는다): 성전의 창 피해량 경감 60% · 300의 방패 50% · 아테나의 방패 50% · 하데스의 열쇠 부활 체력 100%
// 구닐라 · 데미우르고스 · 잉겔 · 자하라 · 재훤의 기본 성유물 5종 (stew · pact · spot · whip · warrant)은 [임시] 이름 · 컨셉 — 사용자가 나중에 바꿀 수 있다 (2026-10-31)
import { CFG } from '../config';
import type { Battle, CUnit } from '../engine/combat';
import { inc, red, vuln } from '../engine/effects';
import { blinkTo, fear, pct, shock } from './kit';

// ───── 봉헌 (CFG.offer): 기물별 누계 → 단계. 화면 · 엔진 · 봇이 같은 식을 쓴다
/** n단계에 필요한 봉헌 누계: step × n(n+1)/2 */
export const offerNeed = (n: number) => (CFG.offer.step * n * (n + 1)) / 2;
/** 봉헌 누계 → 단계 (0 ~ CFG.offer.max) */
export function offerStage(offer = 0): number {
  let n = 0;
  while (n < CFG.offer.max && offer >= offerNeed(n + 1)) n++;
  return n;
}
/** 봉헌 누계 상한 (최대 단계에 닿으면 더 쌓지 않는다) */
export const offerCap = () => offerNeed(CFG.offer.max);
/** n단계: 장착한 성유물이 주는 주요 능력치 (추천 주요 능력치 첫째) */
export const offerStat = (n: number) => CFG.offer.stat0 + CFG.offer.stat * n;
/** n단계: 신권 대행 위력 배율 (성유물 효과의 k) */
export const offerMul = (n: number) => 1 + CFG.offer.act * n;

export interface RelicDef {
  id: string;
  name: string;
  /** 기본으로 장착하는 디바인 (없으면 순례 전용) */
  owner?: string;
  /** 순례 구매가 (권능) */
  price: number;
  /** 신권 대행 설명 (k = 위력 배율) */
  desc: (k: number) => string;
  /** 상세 보기 꺼짐 한 줄 (수치 없음, docs/ABILITY_TEXT.md 1절) */
  brief: string;
  /** 상세 문장 (토큰, 줄마다 한 문장, k = 위력 배율) */
  text: (k: number) => string;
  act: (b: Battle, u: CUnit, k: number) => void;
}

const FOREVER = 9999;
const mainPow = (b: Battle, u: CUnit) => (u.ctype === 'MARK' ? b.S(u, 'shoot') : u.ctype === 'VAN' ? b.S(u, 'strike') : b.P(u, 'tech'));

const RELICS_BASE: Omit<RelicDef, 'brief' | 'text'>[] = [
  { id: 'lantern', name: '달무리 등불', owner: 'eleni', price: 20,
    desc: (k) => `아군 전원 최대 체력 ${pct(0.12 * k)} 회복. 전투 끝까지 주변 2칸 아군이 초당 최대 체력 ${pct(0.008 * k)} 회복.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) b.heal(u, a, b.S(a, 'maxHp') * 0.12 * k);
      b.fx(u.x, u.y, 2, 'holy', 'heal');
      if (u.mem.relLantern) return; // 다시 발동해도 지속 회복은 겹치지 않는다
      u.mem.relLantern = 1;
      u.hooks.push({ onTick(bb, self, dt) {
        self.mem.lanternT = (self.mem.lanternT || 0) + dt;
        if (self.mem.lanternT < 1) return;
        self.mem.lanternT -= 1;
        bb.fx(self.x, self.y, 2, 'holy', 'aura');
        for (const a of bb.around(self, 2, bb.alliesOf(self))) bb.heal(self, a, bb.S(a, 'maxHp') * 0.008 * k);
      } });
    } },
  { id: 'sandals', name: '헤르메스의 날개 신', owner: 'iris', price: 20,
    desc: (k) => `아군 전원 기술 쿨다운 즉시 -2초. 전투 끝까지 아군 전원 공격 속도 +${pct(0.3 * k)}p, 이동 속도 +${pct(0.3 * k)}p.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) { a.cd = Math.max(0, a.cd - 2); b.buff(u, a, 'rel.sandals', FOREVER, { delta: { atkSpd: 0.3 * k, moveSpd: 0.3 * k }, label: '날개 신' }); }
      b.fx(u.x, u.y, 0, 'elec', 'buff');
    } },
  { id: 'bow', name: '귀환의 활', owner: 'odysseus', price: 25,
    desc: (k) => `체력 비율이 가장 낮은 적 3명에게 사격 위력 (지휘관이면 전술 위력 중 높은 쪽) ${pct(7.5 * k)} 신성 관통 화살. 전투 끝까지 자신의 치명타 확률 +${pct(0.15 * k)}p.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u).sort((a, z) => b.hpPct(a) - b.hpPct(z)).slice(0, 3)) {
        b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'holy', ranged: true });
        b.dealDamage(u, e, Math.max(b.S(u, 'shoot'), b.P(u, 'shoot')) * 7.5 * k, { elem: 'holy', tag: 'skill', kind: 'shoot', canMiss: false, pen: 1 });
      }
      b.buff(u, u, 'rel.bow', FOREVER, { delta: { crit: 0.15 * k }, label: '귀환자의 시선' });
    } },
  { id: 'spear', name: '성전의 창', owner: 'kyle', price: 25,
    desc: (k) => `적이 가장 많이 모인 곳으로 돌입해 2초 무적, 주변 2칸 적에게 타격 위력 ${pct(5 * k)} 신성 피해 + 1.5초 기절. 전투 끝까지 자신의 피해량 경감 ${pct(Math.min(0.6, 0.15 * k))}p.`,
    act(b, u, k) {
      const es = b.enemiesOf(u);
      const c = es.slice().sort((a, z) => b.around(z, 2, es).length - b.around(a, 2, es).length)[0];
      if (c) blinkTo(b, u, c);
      u.mem.invulnUntil = b.t + 2;
      b.fx(u.x, u.y, 2, 'holy');
      for (const e of b.around(u, 2, b.enemiesOf(u))) { const r = b.dealDamage(u, e, b.S(u, 'strike') * 5 * k, { elem: 'holy', tag: 'skill', kind: 'strike', canMiss: false }); if (!r.miss && e.alive) b.stun(u, e, 1.5); }
      b.buff(u, u, 'rel.spear', FOREVER, { taken: [red('all', Math.min(0.6, 0.15 * k))], label: '성전의 가호' });
    } },
  { id: 'platter', name: '최후의 만찬 접시', owner: 'doros', price: 20,
    desc: (k) => `아군 전원 최대 체력 ${pct(0.15 * k)} 회복 + 해로운 효과 제거. 전투 끝까지 아군 전원 피해 +${pct(0.1 * k)}p.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) {
        b.heal(u, a, b.S(a, 'maxHp') * 0.15 * k);
        a.statuses = a.statuses.filter((s) => s.type === 'buff' && !s.taken?.some((t) => t.kind === 'vuln'));
        b.buff(u, a, 'rel.platter', FOREVER, { mods: [inc('all', 0.1 * k)], label: '만찬' });
      }
      b.fx(u.x, u.y, 0, 'holy', 'heal');
    } },
  { id: 'flag', name: '관광 명소 깃발', owner: 'fotini', price: 25,
    // 스킬 한쪽 원칙: 적 취약만 (아군 피해 증가 제거, 취약 12 → 15 → 20%)
    desc: (k) => `전투 끝까지 모든 적이 받는 피해 +${pct(0.2 * k)}p.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) b.applyStatus(u, e, { type: 'buff', key: 'rel.flag', dur: FOREVER, taken: [vuln('all', 0.2 * k)], label: '관광객의 시선' });
    } },
  { id: 'mic', name: '골든 마이크', owner: 'reika', price: 30,
    desc: (k) => `모든 적에게 주력 위력 ${pct(4.375 * k)} 전기 피해 + 2초 감전. 전투 끝까지 [시청자] 상한 +${10 * k}, 즉시 시청자 +${10 * k}.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) { const r = b.dealDamage(u, e, mainPow(b, u) * 4.375 * k, { elem: 'elec', tag: 'skill', kind: 'tech', canMiss: false }); if (!r.miss && e.alive) shock(b, u, e, 2, 1); }
      u.mem.viewerCap = (u.mem.viewerCap || 0) + 10 * k;
      u.mem.viewers = (u.mem.viewers || 0) + 10 * k;
    } },
  { id: 'dividend', name: '배당 결의서', owner: 'skadi', price: 25,
    desc: (k) => `가장 체력이 많은 적에게 보유 크레딧 1당 주력 위력 ${pct(0.06 * k)} 고정 피해, 크레딧 +3. 전투 끝까지 자신의 피해 +${pct(0.1 * k)}p.`,
    act(b, u, k) {
      const es = b.enemiesOf(u);
      const t = es.length ? es.reduce((a, c) => (c.hp > a.hp ? c : a)) : null;
      if (t) b.dealDamage(u, t, mainPow(b, u) * 0.06 * k * Math.max(1, b.ctx.credits), { elem: 'true', tag: 'skill', canMiss: false });
      u.mem.g_divCredit = (u.mem.g_divCredit || 0) + 3;
      b.buff(u, u, 'rel.dividend', FOREVER, { mods: [inc('all', 0.1 * k)], label: '배당' });
    } },
  { id: 'aspis', name: '300의 방패', owner: 'thermo', price: 25,
    desc: (k) => `주변 2칸 아군 3초간 피해 무효. 전투 끝까지 아군 전원 피해량 경감 ${pct(Math.min(0.5, 0.1 * k))}p.`,
    act(b, u, k) {
      for (const a of b.around(u, 2, b.alliesOf(u))) a.mem.invulnUntil = b.t + 3;
      for (const a of b.alliesOf(u)) b.buff(u, a, 'rel.aspis', FOREVER, { taken: [red('all', Math.min(0.5, 0.1 * k))], label: '팔랑크스 대형' });
      b.fx(u.x, u.y, 2, 'holy', 'buff');
    } },
  { id: 'gauge', name: '절대 영점 측량기', owner: 'dobin', price: 25,
    desc: (k) => `모든 적에게 주력 위력 ${pct(3.125 * k)} 신성 피해 + 2초 고정 (움직일 수 없음). 전투 끝까지 아군 감시 포탑 공격 속도 +${pct(0.4 * k)}p.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) {
        const r = b.dealDamage(u, e, mainPow(b, u) * 3.125 * k, { elem: 'holy', tag: 'skill', kind: 'tech', canMiss: false });
        if (!r.miss && e.alive) b.applyStatus(u, e, { type: 'buff', key: 'root', dur: 2, label: '고정' });
      }
      for (const a of b.alliesOf(u)) if (a.defId === 'turret') b.buff(u, a, 'rel.gauge', FOREVER, { delta: { atkSpd: 0.4 * k }, label: '영점 조정' });
      b.fx(u.x, u.y, 0, 'holy', 'buff');
    } },
  { id: 'bell', name: '흰 무녀의 방울', owner: 'gayoung', price: 25,
    desc: (k) => `아군 전원 해로운 효과 제거 + 최대 체력 ${pct(0.12 * k)} 회복. 전투 끝까지 자신의 피해 +${pct(0.2 * k)}p, 주변 1칸 적이 받는 피해 +${pct(0.1 * k)}p.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) {
        a.statuses = a.statuses.filter((s) => s.type === 'buff' && !s.taken?.some((t) => t.kind === 'vuln'));
        b.heal(u, a, b.S(a, 'maxHp') * 0.12 * k);
      }
      b.buff(u, u, 'rel.bell', FOREVER, { mods: [inc('all', 0.2 * k)], label: '방울 소리' });
      if (!u.mem.relBell) { // 다시 발동해도 주변 취약은 겹치지 않는다
        u.mem.relBell = 1;
        u.hooks.push({ onTick(bb, self) {
          if (!self.alive) return;
          for (const e of bb.around(self, 1, bb.enemiesOf(self))) bb.applyStatus(self, e, { type: 'buff', key: 'rel.bell.v', dur: 0.4, taken: [vuln('all', 0.1 * k)], label: '' });
        } });
      }
      b.fx(u.x, u.y, 1, 'holy', 'heal');
    } },
  // ── 구닐라 · 데미우르고스 · 잉겔 · 자하라 · 재훤 [임시]
  { id: 'stew', name: '가보 스튜 냄비', owner: 'gunnir', price: 25,
    desc: (k) => `아군 전원 주력 위력 ${pct(1.8 * k)} 회복. 전투 끝까지 아군 전원 쿨다운 감소 속도 +${pct(0.15 * k)}p.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) {
        b.heal(u, a, mainPow(b, u) * 1.8 * k);
        b.buff(u, a, 'rel.stew', FOREVER, { delta: { cdr: 0.15 * k }, label: '든든한 한 끼' });
      }
      b.fx(u.x, u.y, 0, 'holy', 'heal');
    } },
  { id: 'pact', name: '청유의 서한', owner: 'demiurgos', price: 25,
    desc: (k) => `체력 비율이 가장 낮은 아군 3명을 주력 위력 ${pct(2.5 * k)} 회복. 전투 끝까지 그 아군이 처음 쓰러질 피해를 받으면 체력 ${pct(0.2 * k)}로 버틴다 (아군마다 1회).`,
    act(b, u, k) {
      for (const a of b.alliesOf(u).sort((x, z) => b.hpPct(x) - b.hpPct(z)).slice(0, 3)) {
        b.heal(u, a, mainPow(b, u) * 2.5 * k);
        if (a.mem.relPact) continue; // 다시 발동해도 약속은 아군마다 한 번
        a.mem.relPact = 1;
        b.buff(u, a, 'rel.pact', FOREVER, { label: '친구의 약속' });
        a.hooks.push({ onLethal(bb, self) {
          if (self.mem.relPact !== 1) return false;
          self.mem.relPact = 2;
          self.hp = bb.S(self, 'maxHp') * 0.2 * k;
          self.statuses = self.statuses.filter((s) => s.key !== 'rel.pact');
          bb.emit({ k: 'mark', id: self.id, name: '약속', style: 'revive' });
          return self.hp > 0;
        } });
      }
      b.fx(u.x, u.y, 1, 'holy', 'heal');
    } },
  { id: 'spot', name: '달빛 핀 조명', owner: 'ingel', price: 25,
    desc: (k) => `모든 적에게 주력 위력 ${pct(2.5 * k)} 정신 피해 + 1.5초 공포. 전투 끝까지 주변 2칸 아군이 초당 최대 체력 ${pct(0.006 * k)} 회복.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) { const r = b.dealDamage(u, e, mainPow(b, u) * 2.5 * k, { elem: 'psy', tag: 'skill', kind: 'tech', canMiss: false }); if (!r.miss && e.alive) fear(b, u, e, 1.5, 1); }
      b.fx(u.x, u.y, 0, 'psy');
      if (u.mem.relSpot) return; // 다시 발동해도 지속 회복은 겹치지 않는다
      u.mem.relSpot = 1;
      u.hooks.push({ onTick(bb, self, dt) {
        if (!self.alive) return;
        self.mem.spotT = (self.mem.spotT || 0) + dt;
        if (self.mem.spotT < 1) return;
        self.mem.spotT -= 1;
        bb.fx(self.x, self.y, 2, 'holy', 'aura');
        for (const a of bb.around(self, 2, bb.alliesOf(self))) bb.heal(self, a, bb.S(a, 'maxHp') * 0.006 * k);
      } });
    } },
  { id: 'whip', name: '백수정 채찍', owner: 'zahara', price: 25,
    desc: (k) => `주변 3칸의 가장 가까운 적 3명에게 타격 위력 ${pct(3.5 * k)} 물리 피해 (방어도 50% 무시) + 스킬 쿨다운 3초 증가. 전투 끝까지 자신의 방어도 관통 +${pct(0.2 * k)}p.`,
    act(b, u, k) {
      const es = b.around(u, 3, b.enemiesOf(u)).sort((a, z) => b.dist(u, a) - b.dist(u, z)).slice(0, 3);
      for (const e of es) {
        b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'phys', ranged: true });
        const r = b.dealDamage(u, e, b.S(u, 'strike') * 3.5 * k, { elem: 'phys', tag: 'skill', kind: 'strike', canMiss: false, pen: 0.5 });
        if (!r.miss && e.alive && e.skill) e.cd += 3;
      }
      b.buff(u, u, 'rel.whip', FOREVER, { delta: { armorPen: 0.2 * k }, label: '백수정 날' });
      b.fx(u.x, u.y, 1, 'phys');
    } },
  { id: 'warrant', name: '절멸파 수배첩', owner: 'jaehwon', price: 25,
    desc: (k) => `체력이 가장 많은 적에게 사격 위력 ${pct(5 * k)} 물리 피해 (방어도 50% 무시) + [사냥감] 표식. 전투 끝까지 표식이 붙은 적이 받는 피해 +${pct(0.25 * k)}p (쓰러지면 체력이 가장 많은 적에게 옮겨 간다).`,
    act(b, u, k) {
      const mark = (bb: Battle, self: CUnit) => {
        const es = bb.enemiesOf(self);
        const t = es.length ? es.reduce((a, c) => (c.hp > a.hp ? c : a)) : null;
        if (t) bb.applyStatus(self, t, { type: 'buff', key: 'rel.warrant', dur: FOREVER, taken: [vuln('all', 0.25 * k)], label: '사냥감' });
        return t;
      };
      const t = mark(b, u);
      if (t) {
        b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'phys', ranged: true });
        b.dealDamage(u, t, b.S(u, 'shoot') * 5 * k, { elem: 'phys', tag: 'skill', kind: 'shoot', canMiss: false, pen: 0.5 });
      }
      if (u.mem.relWarrant) return; // 다시 발동해도 표식 옮기기는 하나
      u.mem.relWarrant = 1;
      u.hooks.push({ onAnyDeath(bb, self, dead) {
        if (dead.side === self.side || !dead.statuses.some((s) => s.key === 'rel.warrant')) return;
        if (!bb.enemiesOf(self).some((e) => e.statuses.some((s) => s.key === 'rel.warrant'))) mark(bb, self);
      } });
    } },
  // ── 순례 전용
  { id: 'key', name: '하데스의 열쇠', price: 30,
    desc: (k) => `쓰러진 아군 1명을 체력 ${pct(Math.min(1, 0.5 * k))}로 부활 (없으면 아군 전원 최대 체력 ${pct(0.18 * k)} 보호막). 전투 끝까지 아군 전원 흡혈 +${pct(0.05 * k)}p.`,
    act(b, u, k) {
      const d = b.units.find((x) => !x.alive && x.side === u.side && !x.isSummon);
      const c = d && b.freeCellNear(u.x, u.y);
      if (d && c) {
        d.alive = true; d.hp = b.S(d, 'maxHp') * Math.min(1, 0.5 * k); d.statuses = []; d.x = d.px = c.x; d.y = d.py = c.y; d.moveT = 0;
        b.emit({ k: 'spawn', id: d.id }); b.emit({ k: 'mark', id: d.id, name: '명부 귀환', style: 'revive' });
      } else for (const a of b.alliesOf(u)) b.shield(a, b.S(a, 'maxHp') * 0.18 * k);
      for (const a of b.alliesOf(u)) b.buff(u, a, 'rel.key', FOREVER, { delta: { lifesteal: 0.05 * k }, label: '명부의 계약' });
    } },
  { id: 'bolt', name: '제우스의 번개창', price: 30,
    desc: (k) => `무작위 적 5명에게 주력 위력 ${pct(3.75 * k)} 전기 피해. 전투 끝까지 자신의 치명타 확률 +${pct(0.1 * k)}p.`,
    act(b, u, k) {
      const es = b.enemiesOf(u).slice().sort(() => b.rng.next() - 0.5).slice(0, 5);
      for (const e of es) { b.fx(e.x, e.y, 0, 'elec'); b.dealDamage(u, e, mainPow(b, u) * 3.75 * k, { elem: 'elec', tag: 'skill', kind: 'tech', canMiss: false }); }
      b.buff(u, u, 'rel.bolt', FOREVER, { delta: { crit: 0.1 * k }, label: '뇌신의 가호' });
    } },
  { id: 'aegis', name: '아테나의 방패', price: 20,
    desc: (k) => `전투 끝까지 아군 전원 피해량 경감 ${pct(Math.min(0.5, 0.12 * k))}p, 효과 저항 +${pct(0.25 * k)}p.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) b.buff(u, a, 'rel.aegis', FOREVER, { taken: [red('all', Math.min(0.5, 0.12 * k))], delta: { effRes: 0.25 * k }, label: '아이기스' });
      b.fx(u.x, u.y, 0, 'holy', 'buff');
    } },
  { id: 'helm', name: '아레스의 투구', price: 20,
    desc: (k) => `전투 끝까지 자신의 피해 +${pct(0.35 * k)}p, 공격이 주변 1칸 적에게 ${pct(0.3 * k)} 피해로 번진다.`,
    act(b, u, k) {
      b.buff(u, u, 'rel.helm', FOREVER, { mods: [inc('all', 0.35 * k)], label: '전쟁의 투구' });
      if (u.mem.relHelm) return; // 다시 발동해도 번지는 피해는 겹치지 않는다
      u.mem.relHelm = 1;
      u.hooks.push({ onBasic(bb, self, t, r) {
        if (r.amount <= 0) return;
        for (const e of bb.around(t, 1, bb.enemiesOf(self))) if (e !== t) bb.dealDamage(self, e, r.amount * 0.3 * k, { elem: 'phys', tag: 'proc', noHooks: true });
      } });
    } },
];
const END = '전투가 끝날 때까지';
/** 성유물 설명 두 벌: brief (상세 보기 꺼짐) · text (상세 문장). 수치는 act 와 같은 값 */
const RELIC_TX: Record<string, Pick<RelicDef, 'brief' | 'text'>> = {
  lantern: { brief: '아군 전체를 회복시키고, 전투 끝까지 주변 아군을 계속 회복시킵니다.',
    text: (k) => `아군 전체를 각자 최대 체력의 [p:${0.12 * k}]만큼 회복시킵니다.\n${END} 1초마다 자신으로부터 [t:2] 이내의 아군을 각자 최대 체력의 [p:${0.008 * k}]만큼 회복시킵니다.` },
  sandals: { brief: '아군 전체의 스킬을 앞당기고, 전투 끝까지 아군을 빠르게 합니다.',
    text: (k) => `아군 전체의 스킬 쿨다운을 [s:2] 감소시킵니다.\n${END} 아군 전체의 공격 속도를 [pv:${0.3 * k}], 이동 속도를 [pv:${0.3 * k}] 증가시킵니다.` },
  bow: { brief: '가장 다친 적들에게 방어도를 무시하는 신성 피해를 주고, 전투 끝까지 치명타 확률을 증가시킵니다.',
    text: (k) => `체력 비율이 가장 낮은 적 3명에게 각각 [pw:shoot:${7.5 * k}:holy] 피해를 가합니다.\n지휘관이면 사격 위력과 전술 위력 중 높은 쪽으로 계산합니다.\n이 공격은 대상의 방어도를 [p:1] 무시합니다.\n${END} 자신의 치명타 확률을 [pv:${0.15 * k}] 증가시킵니다.` },
  spear: { brief: '적이 모인 곳에 뛰어들어 신성 피해를 주고 [기절]시키며, 전투 끝까지 받는 피해를 감소시킵니다.',
    text: (k) => `적이 가장 많이 모인 곳으로 이동하고, [s:2]간 받는 피해가 0이 됩니다.\n자신으로부터 [t:2] 이내의 적들에게 [pw:strike:${5 * k}:holy] 피해를 가합니다.\n공격이 적중하면 대상에게 반드시 [fx:stun:1.5] 효과를 부여합니다.\n${END} 자신이 받는 피해를 [pv:${Math.min(0.6, 0.15 * k)}] 감소시킵니다.` },
  platter: { brief: '아군 전체를 치료 · 정화하고, 전투 끝까지 아군이 가하는 피해를 증가시킵니다.',
    text: (k) => `아군 전체를 각자 최대 체력의 [p:${0.15 * k}]만큼 회복시키고, 해로운 효과를 모두 제거합니다.\n${END} 아군 전체가 가하는 피해를 [pv:${0.1 * k}] 증가시킵니다.` },
  flag: { brief: '전투 끝까지 모든 적이 받는 피해를 증가시킵니다.',
    text: (k) => `${END} 적 전체가 받는 피해를 [pv:${0.2 * k}] 증가시킵니다.` },
  mic: { brief: '모든 적에게 전기 피해를 주고 [감전]시키며, 시청자를 얻습니다.',
    text: (k) => `적 전체에게 [pw:prime:${4.375 * k}:elec] 피해를 가합니다.\n공격이 적중하면 대상에게 반드시 [fx:shock:2] 효과를 부여합니다.\n${END} 시청자 상한을 ${10 * k} 증가시키고, 시청자를 바로 ${10 * k} 얻습니다.` },
  dividend: { brief: '체력이 가장 많은 적에게 보유 크레딧에 비례한 고정 피해를 주고, 크레딧을 얻습니다.',
    text: (k) => `체력이 가장 많은 적에게 보유 크레딧 1당 [pw:prime:${0.06 * k}] [el:true] 피해를 가합니다.\n크레딧을 3 얻습니다.\n${END} 자신이 가하는 피해를 [pv:${0.1 * k}] 증가시킵니다.` },
  aspis: { brief: '주변 아군이 잠시 피해를 받지 않게 하고, 전투 끝까지 아군 전체가 받는 피해를 감소시킵니다.',
    text: (k) => `[s:3]간 자신으로부터 [t:2] 이내의 아군이 받는 피해가 0이 됩니다.\n${END} 아군 전체가 받는 피해를 [pv:${Math.min(0.5, 0.1 * k)}] 감소시킵니다.` },
  gauge: { brief: '모든 적에게 신성 피해를 주고 잠시 [속박]하며, 전투 끝까지 포탑을 빠르게 합니다.',
    text: (k) => `적 전체에게 [pw:prime:${3.125 * k}:holy] 피해를 가합니다.\n공격이 적중하면 대상에게 반드시 [fx:root:2] 효과를 부여합니다.\n${END} 아군 포탑의 공격 속도를 [pv:${0.4 * k}] 증가시킵니다.` },
  bell: { brief: '아군 전체를 정화 · 회복시키고, 전투 끝까지 자신의 피해와 주변 적이 받는 피해를 증가시킵니다.',
    text: (k) => `아군 전체의 해로운 효과를 모두 제거하고, 각자 최대 체력의 [p:${0.12 * k}]만큼 회복시킵니다.\n${END} 자신이 가하는 피해를 [pv:${0.2 * k}] 증가시킵니다.\n${END} 자신으로부터 [t:1] 이내의 적이 받는 피해를 [pv:${0.1 * k}] 증가시킵니다.` },
  stew: { brief: '아군 전체를 회복시키고, 전투 끝까지 아군의 스킬을 빠르게 돌립니다.',
    text: (k) => `아군 전체를 각자 [pw:prime:${1.8 * k}]만큼 회복시킵니다.\n${END} 아군 전체의 쿨다운 감소 속도를 [pv:${0.15 * k}] 증가시킵니다.` },
  pact: { brief: '가장 다친 아군들을 회복시키고, 전투 끝까지 그 아군이 한 번 쓰러지지 않고 버티게 합니다.',
    text: (k) => `체력 비율이 가장 낮은 아군 3명을 각자 [pw:prime:${2.5 * k}]만큼 회복시킵니다.\n${END} 그 아군들이 처음으로 쓰러질 피해를 받으면, 쓰러지지 않고 체력 [p:${0.2 * k}]로 버팁니다.\n아군마다 전투당 1회.` },
  spot: { brief: '모든 적에게 정신 피해를 주고 [공포]에 빠뜨리며, 전투 끝까지 주변 아군을 계속 회복시킵니다.',
    text: (k) => `적 전체에게 [pw:prime:${2.5 * k}:psy] 피해를 가합니다.\n공격이 적중하면 대상에게 반드시 [fx:fear:1.5] 효과를 부여합니다.\n${END} 1초마다 자신으로부터 [t:2] 이내의 아군을 각자 최대 체력의 [p:${0.006 * k}]만큼 회복시킵니다.` },
  whip: { brief: '가까운 적들을 휘감아 방어도를 무시하는 물리 피해를 주고 스킬을 늦추며, 전투 끝까지 방어도 관통을 증가시킵니다.',
    text: (k) => `자신으로부터 [t:3] 이내의 가장 가까운 적 3명에게 각각 [pw:strike:${3.5 * k}:phys] 피해를 가합니다.\n이 공격은 대상의 방어도를 [p:0.5] 무시합니다.\n공격이 적중하면 대상의 스킬 쿨다운을 [s:3] 증가시킵니다.\n${END} 자신의 방어도 관통을 [pv:${0.2 * k}] 증가시킵니다.` },
  warrant: { brief: '체력이 가장 많은 적을 저격하고 사냥감으로 표시해, 전투 끝까지 그 적이 받는 피해를 증가시킵니다.',
    text: (k) => `체력이 가장 많은 적에게 [pw:shoot:${5 * k}:phys] 피해를 가합니다.\n이 공격은 대상의 방어도를 [p:0.5] 무시합니다.\n그 적에게 사냥감 표식을 남깁니다.\n${END} 표식이 붙은 적이 받는 피해를 [pv:${0.25 * k}] 증가시킵니다.\n표식이 붙은 적이 쓰러지면, 자신이 살아 있는 동안 남은 적 중 체력이 가장 많은 적에게 표식이 옮겨 갑니다.` },
  key: { brief: '쓰러진 아군을 되살리고, 전투 끝까지 아군 전체에 흡혈을 줍니다.',
    text: (k) => `쓰러진 아군 1명을 체력 [p:${Math.min(1, 0.5 * k)}]로 되살립니다.\n쓰러진 아군이 없으면 아군 전체에게 각자 최대 체력의 [p:${0.18 * k}]만큼 보호막을 부여합니다.\n${END} 아군 전체의 [g:lifesteal]을 [pv:${0.05 * k}] 증가시킵니다.` },
  bolt: { brief: '무작위 적들에게 전기 피해를 주고, 전투 끝까지 치명타 확률을 증가시킵니다.',
    text: (k) => `무작위 적 5명에게 각각 [pw:prime:${3.75 * k}:elec] 피해를 가합니다.\n${END} 자신의 치명타 확률을 [pv:${0.1 * k}] 증가시킵니다.` },
  aegis: { brief: '전투 끝까지 아군 전체가 받는 피해를 감소시키고 효과 저항을 증가시킵니다.',
    text: (k) => `${END} 아군 전체가 받는 피해를 [pv:${Math.min(0.5, 0.12 * k)}] 감소시키고, 효과 저항을 [pv:${0.25 * k}] 증가시킵니다.` },
  helm: { brief: '전투 끝까지 자신의 피해를 증가시키고, 기본 공격이 주변 적에게 번집니다.',
    text: (k) => `${END} 자신이 가하는 피해를 [pv:${0.35 * k}] 증가시킵니다.\n${END} 기본 공격이 적중하면 대상으로부터 [t:1] 이내의 다른 적들에게 그 피해의 [p:${0.3 * k}]만큼 [el:phys] 피해를 가합니다.` },
};
export const RELICS: RelicDef[] = RELICS_BASE.map((r) => ({ ...r, ...RELIC_TX[r.id] }));
export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
/** 디바인의 기본 성유물 */
export const DEFAULT_RELIC: Record<string, string> = Object.fromEntries(RELICS.filter((r) => r.owner).map((r) => [r.owner!, r.id]));
