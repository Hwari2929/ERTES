// 성유물 15종: 디바인 전용 장비. 장착한 성유물이 곧 신권 대행 (전투당 1회).
// 신권 대행의 지속 효과는 발동한 뒤 전투가 끝날 때까지 유지된다. k = 강화 배율 (강화하면 다음 전투 한정 3)
import type { Battle, CUnit } from '../engine/combat';
import { inc, red, vuln } from '../engine/effects';
import { blinkTo, pct, shock } from './kit';

export interface RelicDef {
  id: string;
  name: string;
  /** 기본으로 장착하는 디바인 (없으면 순례 전용) */
  owner?: string;
  /** 순례 구매가 · 강화 비용 (권능) */
  price: number; enh: number;
  /** 신권 대행 설명 (k = 강화 배율) */
  desc: (k: number) => string;
  act: (b: Battle, u: CUnit, k: number) => void;
}

const FOREVER = 9999;
const mainPow = (b: Battle, u: CUnit) => (u.ctype === 'MARK' ? b.S(u, 'shoot') : u.ctype === 'VAN' ? b.S(u, 'strike') : b.P(u, 'tech'));

export const RELICS: RelicDef[] = [
  { id: 'lantern', name: '달무리 등불', owner: 'eleni', price: 20, enh: 25,
    desc: (k) => `아군 전원 최대 체력 ${pct(0.12 * k)} 회복. 전투 끝까지 주변 2칸 아군이 초당 최대 체력 ${pct(0.008 * k)} 회복.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) b.heal(u, a, b.S(a, 'maxHp') * 0.12 * k);
      b.fx(u.x, u.y, 2, 'holy', 'heal');
      u.hooks.push({ onTick(bb, self, dt) {
        self.mem.lanternT = (self.mem.lanternT || 0) + dt;
        if (self.mem.lanternT < 1) return;
        self.mem.lanternT -= 1;
        bb.fx(self.x, self.y, 2, 'holy', 'aura');
        for (const a of bb.around(self, 2, bb.alliesOf(self))) bb.heal(self, a, bb.S(a, 'maxHp') * 0.008 * k);
      } });
    } },
  { id: 'sandals', name: '헤르메스의 날개 신', owner: 'iris', price: 20, enh: 25,
    desc: (k) => `아군 전원 기술 쿨다운 즉시 -2초. 전투 끝까지 아군 전원 공격 속도 +${pct(0.2 * k)}, 이동 속도 +${pct(0.3 * k)}.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) { a.cd = Math.max(0, a.cd - 2); b.buff(u, a, 'rel.sandals', FOREVER, { delta: { atkSpd: 0.2 * k, moveSpd: 0.3 * k }, label: '날개 신' }); }
      b.fx(u.x, u.y, 0, 'elec', 'buff');
    } },
  { id: 'bow', name: '귀환의 활', owner: 'odysseus', price: 25, enh: 30,
    desc: (k) => `체력 비율이 가장 낮은 적 3명에게 사격 위력 (지휘관이면 전술 위력 중 높은 쪽) ${pct(6 * k)} 신성 관통 화살. 전투 끝까지 자신의 치명타 확률 +${pct(0.15 * k)}p.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u).sort((a, z) => b.hpPct(a) - b.hpPct(z)).slice(0, 3)) {
        b.emit({ k: 'atk', from: u.id, to: e.id, elem: 'holy', ranged: true });
        b.dealDamage(u, e, Math.max(b.S(u, 'shoot'), b.P(u, 'shoot')) * 6 * k, { elem: 'holy', tag: 'skill', kind: 'shoot', canMiss: false, pen: 1 });
      }
      b.buff(u, u, 'rel.bow', FOREVER, { delta: { crit: 0.15 * k }, label: '귀환자의 시선' });
    } },
  { id: 'spear', name: '성전의 창', owner: 'kyle', price: 25, enh: 30,
    desc: (k) => `적이 가장 많이 모인 곳으로 돌입해 2초 무적, 주변 2칸 적에게 타격 위력 ${pct(4 * k)} 신성 피해 + 1.5초 기절. 전투 끝까지 자신의 피해량 경감 ${pct(Math.min(0.6, 0.15 * k))}.`,
    act(b, u, k) {
      const es = b.enemiesOf(u);
      const c = es.slice().sort((a, z) => b.around(z, 2, es).length - b.around(a, 2, es).length)[0];
      if (c) blinkTo(b, u, c);
      u.mem.invulnUntil = b.t + 2;
      b.fx(u.x, u.y, 2, 'holy');
      for (const e of b.around(u, 2, b.enemiesOf(u))) { b.dealDamage(u, e, b.S(u, 'strike') * 4 * k, { elem: 'holy', tag: 'skill', kind: 'strike', canMiss: false }); if (e.alive) b.stun(u, e, 1.5); }
      b.buff(u, u, 'rel.spear', FOREVER, { taken: [red('all', Math.min(0.6, 0.15 * k))], label: '성전의 가호' });
    } },
  { id: 'platter', name: '최후의 만찬 접시', owner: 'doros', price: 20, enh: 25,
    desc: (k) => `아군 전원 최대 체력 ${pct(0.15 * k)} 회복 + 해로운 효과 제거. 전투 끝까지 아군 전원 피해 +${pct(0.1 * k)}.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) {
        b.heal(u, a, b.S(a, 'maxHp') * 0.15 * k);
        a.statuses = a.statuses.filter((s) => s.type === 'buff' && !s.taken?.some((t) => t.kind === 'vuln'));
        b.buff(u, a, 'rel.platter', FOREVER, { mods: [inc('all', 0.1 * k)], label: '만찬' });
      }
      b.fx(u.x, u.y, 0, 'holy', 'heal');
    } },
  { id: 'flag', name: '관광 명소 깃발', owner: 'fotini', price: 25, enh: 30,
    // 스킬 한쪽 원칙: 적 취약만 (아군 피해 증가 제거, 취약 12 → 15%)
    desc: (k) => `전투 끝까지 모든 적이 받는 피해 +${pct(0.15 * k)}.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) b.applyStatus(u, e, { type: 'buff', key: 'rel.flag', dur: FOREVER, taken: [vuln('all', 0.15 * k)], label: '관광객의 시선' });
    } },
  { id: 'mic', name: '골든 마이크', owner: 'reika', price: 30, enh: 35,
    desc: (k) => `모든 적에게 주력 위력 ${pct(3.5 * k)} 전기 피해 + 2초 감전. 전투 끝까지 [시청자] 상한 +${10 * k}, 즉시 시청자 +${10 * k}.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) { b.dealDamage(u, e, mainPow(b, u) * 3.5 * k, { elem: 'elec', tag: 'skill', kind: 'tech', canMiss: false }); if (e.alive) shock(b, u, e, 2, 1); }
      u.mem.viewerCap = (u.mem.viewerCap || 0) + 10 * k;
      u.mem.viewers = (u.mem.viewers || 0) + 10 * k;
    } },
  { id: 'dividend', name: '배당 결의서', owner: 'skadi', price: 25, enh: 30,
    desc: (k) => `가장 체력이 많은 적에게 보유 크레딧 1당 주력 위력 ${pct(0.06 * k)} 고정 피해, 크레딧 +3. 전투 끝까지 자신의 피해 +${pct(0.1 * k)}.`,
    act(b, u, k) {
      const es = b.enemiesOf(u);
      const t = es.length ? es.reduce((a, c) => (c.hp > a.hp ? c : a)) : null;
      if (t) b.dealDamage(u, t, mainPow(b, u) * 0.06 * k * Math.max(1, b.ctx.credits), { elem: 'true', tag: 'skill', canMiss: false });
      u.mem.g_divCredit = (u.mem.g_divCredit || 0) + 3;
      b.buff(u, u, 'rel.dividend', FOREVER, { mods: [inc('all', 0.1 * k)], label: '배당' });
    } },
  { id: 'aspis', name: '300의 방패', owner: 'thermo', price: 25, enh: 30,
    desc: (k) => `주변 2칸 아군 3초간 피해 무효. 전투 끝까지 아군 전원 피해량 경감 ${pct(Math.min(0.5, 0.1 * k))}.`,
    act(b, u, k) {
      for (const a of b.around(u, 2, b.alliesOf(u))) a.mem.invulnUntil = b.t + 3;
      for (const a of b.alliesOf(u)) b.buff(u, a, 'rel.aspis', FOREVER, { taken: [red('all', Math.min(0.5, 0.1 * k))], label: '팔랑크스 대형' });
      b.fx(u.x, u.y, 2, 'holy', 'buff');
    } },
  { id: 'gauge', name: '절대 영점 측량기', owner: 'dobin', price: 25, enh: 30,
    desc: (k) => `모든 적에게 주력 위력 ${pct(2.5 * k)} 신성 피해 + 2초 고정 (움직일 수 없음). 전투 끝까지 아군 감시 포탑 공격 속도 +${pct(0.4 * k)}.`,
    act(b, u, k) {
      for (const e of b.enemiesOf(u)) {
        b.dealDamage(u, e, mainPow(b, u) * 2.5 * k, { elem: 'holy', tag: 'skill', kind: 'tech', canMiss: false });
        if (e.alive) b.applyStatus(u, e, { type: 'buff', key: 'root', dur: 2, label: '고정' });
      }
      for (const a of b.alliesOf(u)) if (a.defId === 'turret') b.buff(u, a, 'rel.gauge', FOREVER, { delta: { atkSpd: 0.4 * k }, label: '영점 조정' });
      b.fx(u.x, u.y, 0, 'holy', 'buff');
    } },
  { id: 'bell', name: '흰 무녀의 방울', owner: 'gayoung', price: 25, enh: 30,
    desc: (k) => `아군 전원 해로운 효과 제거 + 최대 체력 ${pct(0.12 * k)} 회복. 전투 끝까지 자신의 피해 +${pct(0.2 * k)}, 주변 1칸 적이 받는 피해 +${pct(0.1 * k)}.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) {
        a.statuses = a.statuses.filter((s) => s.type === 'buff' && !s.taken?.some((t) => t.kind === 'vuln'));
        b.heal(u, a, b.S(a, 'maxHp') * 0.12 * k);
      }
      b.buff(u, u, 'rel.bell', FOREVER, { mods: [inc('all', 0.2 * k)], label: '방울 소리' });
      u.hooks.push({ onTick(bb, self) {
        if (!self.alive) return;
        for (const e of bb.around(self, 1, bb.enemiesOf(self))) bb.applyStatus(self, e, { type: 'buff', key: 'rel.bell.v', dur: 0.4, taken: [vuln('all', 0.1 * k)], label: '' });
      } });
      b.fx(u.x, u.y, 1, 'holy', 'heal');
    } },
  // ── 순례 전용
  { id: 'key', name: '하데스의 열쇠', price: 30, enh: 40,
    desc: (k) => `쓰러진 아군 1명을 체력 ${pct(Math.min(1, 0.5 * k))}로 부활 (없으면 아군 전원 최대 체력 ${pct(0.18 * k)} 보호막). 전투 끝까지 아군 전원 흡혈 +${pct(0.05 * k)}.`,
    act(b, u, k) {
      const d = b.units.find((x) => !x.alive && x.side === u.side && !x.isSummon);
      const c = d && b.freeCellNear(u.x, u.y);
      if (d && c) {
        d.alive = true; d.hp = b.S(d, 'maxHp') * Math.min(1, 0.5 * k); d.statuses = []; d.x = d.px = c.x; d.y = d.py = c.y; d.moveT = 0;
        b.emit({ k: 'spawn', id: d.id }); b.emit({ k: 'mark', id: d.id, name: '명부 귀환', style: 'revive' });
      } else for (const a of b.alliesOf(u)) b.shield(a, b.S(a, 'maxHp') * 0.18 * k);
      for (const a of b.alliesOf(u)) b.buff(u, a, 'rel.key', FOREVER, { delta: { lifesteal: 0.05 * k }, label: '명부의 계약' });
    } },
  { id: 'bolt', name: '제우스의 번개창', price: 30, enh: 35,
    desc: (k) => `무작위 적 5명에게 주력 위력 ${pct(3 * k)} 전기 피해. 전투 끝까지 자신의 치명타 확률 +${pct(0.1 * k)}p.`,
    act(b, u, k) {
      const es = b.enemiesOf(u).slice().sort(() => b.rng.next() - 0.5).slice(0, 5);
      for (const e of es) { b.fx(e.x, e.y, 0, 'elec'); b.dealDamage(u, e, mainPow(b, u) * 3 * k, { elem: 'elec', tag: 'skill', kind: 'tech', canMiss: false }); }
      b.buff(u, u, 'rel.bolt', FOREVER, { delta: { crit: 0.1 * k }, label: '뇌신의 가호' });
    } },
  { id: 'aegis', name: '아테나의 방패', price: 20, enh: 25,
    desc: (k) => `전투 끝까지 아군 전원 피해량 경감 ${pct(Math.min(0.5, 0.12 * k))}, 효과 저항 +${pct(0.25 * k)}p.`,
    act(b, u, k) {
      for (const a of b.alliesOf(u)) b.buff(u, a, 'rel.aegis', FOREVER, { taken: [red('all', Math.min(0.5, 0.12 * k))], delta: { effRes: 0.25 * k }, label: '아이기스' });
      b.fx(u.x, u.y, 0, 'holy', 'buff');
    } },
  { id: 'helm', name: '아레스의 투구', price: 20, enh: 25,
    desc: (k) => `전투 끝까지 자신의 피해 +${pct(0.35 * k)}, 공격이 주변 1칸 적에게 ${pct(0.3 * k)} 피해로 번진다.`,
    act(b, u, k) {
      b.buff(u, u, 'rel.helm', FOREVER, { mods: [inc('all', 0.35 * k)], label: '전쟁의 투구' });
      u.hooks.push({ onBasic(bb, self, t, r) {
        if (r.amount <= 0) return;
        for (const e of bb.around(t, 1, bb.enemiesOf(self))) if (e !== t) bb.dealDamage(self, e, r.amount * 0.3 * k, { elem: 'phys', tag: 'proc', noHooks: true });
      } });
    } },
];
export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
/** 디바인의 기본 성유물 */
export const DEFAULT_RELIC: Record<string, string> = Object.fromEntries(RELICS.filter((r) => r.owner).map((r) => [r.owner!, r.id]));
