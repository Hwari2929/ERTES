// 디바인 서약 증강: 디바인 기물이 공명 등급 5마다 고른다 (디바인 기물끼리 같은 풀). 신권 대행 강화 · 사용 횟수 · 아군 공유 · 아군 신앙 효과 가져오기 등
// id 는 'vow.<키>' ('oath.<키>' 는 절망 서약이 도감에서 쓴다). 신앙 · 전투 유형 · 성유물과 상관없이 작동한다.
// 엔진 쪽 연결점: Battle.divReady · divineAct (mem.divExtra 추가 횟수), rework.ts DIVINE_HOOK.act (mem.divK 위력 가산),
//   run.ts settleGrowth (축성의 서약 enhKept), ui/battleview.ts (추가 횟수 게이지)
import type { Battle, CUnit } from '../engine/combat';
import { type AugDef, applyLive, inc, type Effect } from '../engine/effects';
import { FAITH_NAME, type FaithId } from '../types';
import { enableDivine, FAITH_DEF } from './rework';
import { RELIC_BY_ID } from './relics';

/** 서약 수치 (설명문도 이 값을 읽는다) */
export const VOW = {
  /** 권능의 서약: 신권 대행 위력 */
  might: 0.3,
  /** 헌신의 서약: 기본 위력 · 신권 대행을 쓴 전투마다 영구 가산 · 가산 상한 */
  devote: 0.1, devoteStep: 0.05, devoteMax: 0.5,
  /** 재림의 서약: 추가 횟수 · 수집 상한 */
  twiceCap: 100,
  /** 열성의 서약: 신성력 획득 · 시작 신성력 */
  zeal: 0.3, zealStart: 20,
  /** 순교의 서약: 버티는 체력 */
  martyrHp: 0.3,
  /** 철야의 서약: 다른 아군이 피해를 받을 때 (대기) · 아군이 쓰러질 때 */
  vigil: 1, vigilIcd: 0.5, vigilDeath: 15,
  /** 메아리의 서약: 가장 가까운 아군이 쓰는 신권 대행 위력 */
  echo: 0.5,
  /** 나눔의 서약: 신성력 공유 비율 · 신권 대행 때 궁극기 게이지 · 기술 쿨다운 */
  share: 0.3, shareUlt: 0.2, shareCd: 2,
  /** 은총의 서약: 보호막 (최대 체력) · 피해 증가 · 지속 */
  graceShield: 0.15, graceDmg: 0.15, graceDur: 6,
  /** 합창의 서약: 같은 신앙 아군 1명당 위력 · 최대 인원 */
  choir: 0.2, choirMax: 3,
} as const;

/** 축성의 서약: 강화가 한 전투 더 남는다 (engine/run.ts settleGrowth 가 읽는다) */
export const VOW_ENH_KEEP = 'vow.relay';

const pc = (v: number) => `${Math.round(v * 100)}%`;
/** 소환물 · 반려 돌을 뺀 다른 아군 */
const realAllies = (b: Battle, u: CUnit) => b.alliesOf(u, false).filter((a) => !a.isSummon && !a.mem.inert);
/** 그 신앙의 상시 버프가 이미 켜져 있는지 (디바인 자신의 신앙 · 서약으로 받은 것) */
const hasFaithFx = (a: CUnit, f: FaithId) => !!a.mem[`vowFaith.${f}`] || (a.ttype === 'divine' && a.faith === f);
/** 신앙 상시 버프를 전투 중에 켠다 (같은 신앙은 한 번만) */
function grantFaithFx(b: Battle, a: CUnit, f: FaithId) {
  if (hasFaithFx(a, f)) return false;
  a.mem[`vowFaith.${f}`] = 1;
  applyLive(a, FAITH_DEF[f].passive, b, { run: null, unit: null, counts: {}, phase: b.ctx.phase, credits: b.ctx.credits });
  return true;
}
const addK = (u: CUnit, v: number) => { u.mem.divK = (u.mem.divK || 0) + v; };

const V = (key: string, name: string, desc: string, effect: () => Effect): AugDef => ({ id: `vow.${key}`, name, desc, pool: 'oath', owner: 'divine', effect });

export const OATH_AUGS: AugDef[] = [
  // ───── 신권 대행 강화
  V('might', '권능의 서약', `신권 대행 위력 +${pc(VOW.might)}.`,
    () => ({ setup: (u) => addK(u, VOW.might) })),
  V('devote', '헌신의 서약', `신권 대행 위력 +${pc(VOW.devote)}. 신권 대행을 쓴 전투가 끝날 때마다 위력이 영구히 ${pc(VOW.devoteStep)}p씩 더 오른다 (최대 +${pc(VOW.devoteMax)}p).`,
    () => ({
      // 쓴 전투 수는 g_ 기록 → UnitState.grow.vowDevote (run.ts settleGrowth)
      setup: (u) => addK(u, VOW.devote + Math.min(VOW.devoteMax, VOW.devoteStep * (u.src?.grow?.vowDevote || 0))),
      hooks: { onDivine(_b, u) { u.mem.g_vowDevote = 1; } },
    })),
  V('relay', '축성의 서약', '신권 대행 강화가 다음 전투까지 한 번 더 이어진다 (강화한 뒤 2전투 동안 ×3).',
    () => ({})),
  // ───── 사용 횟수 · 신성력
  V('twice', '재림의 서약', `신권 대행을 전투당 1번 더 쓸 수 있다. 신성력 수집 상한 +${VOW.twiceCap}.`,
    () => ({
      setup: (u) => { u.mem.divExtra = (u.mem.divExtra || 0) + 1; },
      hooks: { onStart(_b, u) { if (u.div !== null) u.divCap += VOW.twiceCap; } },
    })),
  V('zeal', '열성의 서약', `신성력 획득 +${pc(VOW.zeal)}. 전투 시작 시 신성력 +${VOW.zealStart}.`,
    () => ({
      setup: (u) => { u.mem.divBoost = (u.mem.divBoost || 0) + VOW.zeal; },
      hooks: { onStart(_b, u) { if (u.div !== null) u.div = Math.min(100, u.div + VOW.zealStart); } },
    })),
  V('martyr', '순교의 서약', `전투당 1회, 쓰러질 피해를 받을 때 신권 대행을 쓸 수 있는 횟수가 남아 있으면 즉시 신권 대행을 쓰고 체력 ${pc(VOW.martyrHp)}로 버틴다.`,
    () => ({ hooks: { onLethal(b, u) {
      if (u.mem.vowMartyr || !b.divReady(u)) return false;
      u.mem.vowMartyr = 1;
      u.hp = b.S(u, 'maxHp') * VOW.martyrHp;
      b.emit({ k: 'mark', id: u.id, name: '순교', style: 'revive' });
      b.divineAct(u);
      return u.hp > 0;
    } } })),
  V('vigil', '철야의 서약', `다른 아군이 피해를 받으면 신성력 +${VOW.vigil} (${VOW.vigilIcd}초에 1회). 아군이 쓰러지면 신성력 +${VOW.vigilDeath}.`,
    () => ({ hooks: {
      onAllyHurt(b, u, a, _src, r) {
        if (a === u || r.amount <= 0 || (u.mem.vowVigilT || 0) > b.t) return;
        u.mem.vowVigilT = b.t + VOW.vigilIcd;
        b.addDiv(u, VOW.vigil);
      },
      onAllyDeath(b, u, dead) { if (dead !== u && !dead.isSummon) b.addDiv(u, VOW.vigilDeath); },
    } })),
  // ───── 아군에게 나누기
  V('echo', '메아리의 서약', `신권 대행을 쓰면 가장 가까운 다른 아군(소환물 제외)도 같은 신권 대행을 위력 ${pc(VOW.echo)}로 쓴다 (그 아군을 기준으로).`,
    () => ({ hooks: { onDivine(b, u) {
      const rel = u.relic ? RELIC_BY_ID[u.relic] : null;
      const al = realAllies(b, u);
      const a = rel && al.length ? b.nearest(u, al) : null;
      if (!rel || !a) return;
      b.emit({ k: 'status', id: a.id, name: `메아리: ${rel.name}`, src: u.id });
      b.fx(a.x, a.y, 0, 'holy', 'buff');
      rel.act(b, a, (u.mem.enh || 1) * (1 + (u.mem.divK || 0)) * VOW.echo);
    } } })),
  V('share', '나눔의 서약', `자신이 얻은 신성력의 ${pc(VOW.share)}를 신성력이 있는 다른 아군도 얻는다 (나눠 받은 신성력은 다시 나누지 않는다). 신권 대행을 쓰면 다른 아군 전원의 궁극기 게이지 +${pc(VOW.shareUlt)}, 기술 쿨다운 -${VOW.shareCd}초.`,
    () => ({ hooks: {
      onTick(b, u) {
        // 자기 몫으로 얻은 신성력 = 수집량 - 나눠 받은 양 (mem.divIn). 지난번 이후 늘어난 만큼 나눈다
        if (u.div === null) return;
        const own = u.divGot - (u.mem.divIn || 0), d = own - (u.mem.vowShareSeen || 0);
        if (d <= 0) return;
        u.mem.vowShareSeen = own;
        for (const a of b.alliesOf(u, false)) {
          if (a.div === null) continue;
          const before = a.divGot;
          b.addDiv(a, d * VOW.share);
          a.mem.divIn = (a.mem.divIn || 0) + (a.divGot - before);
        }
      },
      onDivine(b, u) {
        for (const a of b.alliesOf(u, false)) {
          if (a.ult) a.ultG = Math.min(1, (a.ultG || 0) + VOW.shareUlt);
          a.cd = Math.max(0, a.cd - VOW.shareCd);
        }
        b.fx(u.x, u.y, 2, 'holy', 'buff');
      },
    } })),
  V('grace', '은총의 서약', `신권 대행을 쓰면 아군 전원에게 최대 체력 ${pc(VOW.graceShield)} 보호막, ${VOW.graceDur}초간 주는 피해 +${pc(VOW.graceDmg)}.`,
    () => ({ hooks: { onDivine(b, u) {
      for (const a of b.alliesOf(u)) {
        b.shield(a, b.S(a, 'maxHp') * VOW.graceShield);
        b.buff(u, a, 'vow.grace', VOW.graceDur, { mods: [inc('all', VOW.graceDmg)], label: '은총' });
      }
      b.fx(u.x, u.y, 2, 'holy', 'heal');
    } } })),
  // ───── 아군의 신앙
  V('awaken', '전도의 서약', '전투 시작 때 신성력이 없는 가장 가까운 아군 1명(소환물 제외)의 신앙을 깨운다: 그 아군도 자기 신앙으로 신성력을 모아 전투 유형 기본 신권 대행을 쓰고, 신앙 상시 버프가 켜진다.',
    () => ({ hooks: { onStart(b, u) {
      const pool = realAllies(b, u).filter((a) => a.div === null && a.faith);
      const a = pool.length ? b.nearest(u, pool) : null;
      if (!a) return;
      enableDivine(a, a.faith!, 0);
      grantFaithFx(b, a, a.faith!);
      b.emit({ k: 'status', id: a.id, name: `${FAITH_NAME[a.faith!]} 각성`, src: u.id });
    } } })),
  V('borrow', '개종자의 서약', '전투 시작 때 자신과 신앙이 다른 무작위 아군 1명(소환물 제외)의 신앙 상시 버프와 신성력 획득 조건을 함께 얻는다.',
    () => ({ hooks: { onStart(b, u) {
      const fs = [...new Set(realAllies(b, u).map((a) => a.faith).filter((f): f is FaithId => !!f && f !== u.faith && !u.mem[`vowFaith.${f}`]))];
      if (!fs.length || u.div === null) return;
      const f = b.rng.pick(fs);
      grantFaithFx(b, u, f);
      u.hooks.push(FAITH_DEF[f].hooks);
      b.emit({ k: 'status', id: u.id, name: `${FAITH_NAME[f]}의 은총` });
    } } })),
  V('choir', '합창의 서약', `자신과 신앙이 같은 다른 아군 1명당 신권 대행 위력 +${pc(VOW.choir)} (최대 ${VOW.choirMax}명). 그 아군들도 신앙 상시 버프를 받는다.`,
    () => ({ hooks: { onStart(b, u) {
      if (!u.faith) return;
      const same = realAllies(b, u).filter((a) => a.faith === u.faith);
      addK(u, VOW.choir * Math.min(VOW.choirMax, same.length));
      for (const a of same) grantFaithFx(b, a, u.faith);
    } } })),
  V('saint', '성인의 서약', '신권 대행을 쓰면 전투가 끝날 때까지 다른 아군 전원(소환물 제외)이 자신의 신앙 상시 버프를 받는다.',
    () => ({ hooks: { onDivine(b, u) {
      if (!u.faith) return;
      for (const a of realAllies(b, u)) if (grantFaithFx(b, a, u.faith)) b.fx(a.x, a.y, 0, 'holy', 'buff');
    } } })),
];
