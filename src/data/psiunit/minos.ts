// 사이오닉 전용 전공 증강: minos (kit.ts 참고)
// 미노스: 크레타 대집행관 (순수 관료). 특성 [저승청 대집행관] (관료를 계속 불러냄, 관료 공격이 공포),
// 전투 스킬 [대기열 정리] (체력 비율이 가장 낮은 적 + 관료 일제 사격, 체력 30% 이하면 [접수 완료]),
// 사망 등록 · 접수 번호 · 독촉 · 반려 같은 행정 업무, "대기열은 언제나 줄어듭니다".
// 수치는 MX, 설명문도 MX 를 읽는다.
import type { Battle, CUnit, DmgOpts, Status } from '../../engine/combat';
import { type AugDef, vuln } from '../../engine/effects';
import { summonsOf } from '../kit';
import { confuse, mp } from '../psionic';
import { PSI, psiStackCap } from '../psinum';
import { CLERKS } from '../rosterG';
import { PSI_STATUS } from '../schools';
import { pu } from './kit';

/** 미노스 전용 전공 증강 수치 */
export const MX = {
  seed: {
    /** 독촉장: 관료가 거는 중독 · 같은 적 대기 */
    dunPoison: 1, dunIcd: 2,
    /** 다음 번호: 대기열 정리 쿨다운 감소 */
    nextCd: 2,
    /** 사망 신고 접수: 관료가 앞당겨 나오는 초 · 관료가 다 있으면 회복 (주요 위력 배수) */
    regAdv: 3, regHeal: 0.3,
  },
  mind: {
    /** 민원 반려: 혼란 확률 · 지속 · 같은 적 대기 */
    rejP: 0.35, rejDur: 1, rejIcd: 2,
    /** 줄 서기 안내: 매혹 지속 */
    usherCharm: 2,
    /** 명부 대조: 장마다 [접수 완료] 기준 체력 · 최대 장 수 */
    ledgerPer: 0.05, ledgerMax: 4,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${Math.round(v * 100)}%p`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && b.sideOf(t) !== b.sideOf(u);
const P = (u: CUnit, k: string) => !!u.mem[`ps.${k}`];
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 자신의 중독 (psionic.ts poisonStatus 와 같은 모양: 맹독 · 부패 · 괴사 · 독성 농축 반영. 그 함수는 내보내지 않아 여기서 같은 수치로 만든다) */
function poisonOf(b: Battle, u: CUnit, n: number): Status {
  const per = mp(b, u) * (P(u, 'seed.venom') ? PSI.seed.venomPer : PSI.seed.per);
  return {
    type: 'dot', key: 'poison', dur: PSI.seed.dur, elem: 'chem', perDps: per, dps: per * n, stacks: n, maxStacks: psiStackCap('poison', (k) => P(u, k)),
    healMul: P(u, 'seed.rot') ? 0.4 : undefined, label: PSI_STATUS.poison.name,
    onStack: P(u, 'seed.necro') ? (s) => { s.taken = (s.stacks || 0) >= PSI.seed.necroAt ? [vuln('all', PSI.seed.necroVuln)] : undefined; } : undefined,
  };
}
/** 저승청 관료 (포자 군락 · 환영 같은 다른 소환물 제외)에게 한 번씩 훅을 붙인다 */
function tagClerks(b: Battle, u: CUnit, key: string, f: (c: CUnit) => void) {
  for (const c of summonsOf(b, u)) if (!c.mem[key] && !c.mem.colony && !c.mem.illusion && !c.mem.mirror) { c.mem[key] = 1; f(c); }
}
/** 대기열 정리의 정신 피해 (기본 공격 · 비술과 구분: 비술은 key 'cantrip') */
const isQueue = (o: DmgOpts) => o.tag === 'skill' && o.key !== 'cantrip' && o.elem === 'psy';
/** 이번 대기열 정리의 대상 (같은 시각에만 유효) */
const QUEUE = new WeakMap<CUnit, { t: CUnit; at: number }>();
const noteQueue = (b: Battle, u: CUnit, t: CUnit, o: DmgOpts) => { if (isQueue(o) && foe(b, u, t)) QUEUE.set(u, { t, at: b.t }); };
const queued = (b: Battle, u: CUnit) => { const q = QUEUE.get(u); return q && q.at === b.t ? q.t : null; };

const S = MX.seed, M = MX.mind;

export const AUGS: AugDef[] = [
  // ───────── 파종
  pu('minos', 'seed', 'dun', '독촉장',
    `저승청 관료의 기본 공격이 맞은 적에게 자신의 중독 ${S.dunPoison}중첩 (같은 적은 ${S.dunIcd}초에 1회).`,
    { hooks: { onTick(b, u) {
      tagClerks(b, u, 'puDun', (c) => c.hooks.push({ onBasic(bb, _self, t, r) {
        if (!u.alive || r.miss || r.amount <= 0 || !t.alive || !foe(bb, u, t) || !icd(bb, t, `puDun${u.id}`, S.dunIcd)) return;
        bb.applyStatus(u, t, poisonOf(bb, u, S.dunPoison));
      } }));
    } } }),
  pu('minos', 'seed', 'next', '다음 번호',
    `대기열 정리(관료 일제 사격 포함)로 적을 쓰러뜨리면 그 적에게 남은 자신의 중독을 체력 비율이 가장 낮은 다른 적에게 그대로 넘기고 (중첩은 늘지 않는다), 대기열 정리 쿨다운 -${S.nextCd}초.`,
    { hooks: {
      onDeal(b, u, t, _r, o) { noteQueue(b, u, t, o); },
      onAnyDeath(b, u, dead, killer) {
        if (!u.alive || !killer || (killer !== u && killer.owner !== u) || queued(b, u) !== dead) return;
        const s = dead.statuses.find((x) => x.key === 'poison' && x.src === u);
        if (!s) return;
        QUEUE.delete(u); // 시전 1번에 1회
        const rest = b.targetable(u).filter((e) => e !== dead && e.alive);
        const e = rest.length ? rest.reduce((a, c) => (b.hpPct(c) < b.hpPct(a) ? c : a)) : null;
        if (e) {
          b.emit({ k: 'atk', from: dead.id, to: e.id, elem: 'chem', ranged: true, chain: true });
          b.applyStatus(u, e, { ...s, dur: Math.max(s.dur, 1) }); // 옮길 뿐 늘지 않는다
        }
        u.cd = Math.max(0, u.cd - S.nextCd);
        b.emit({ k: 'status', id: u.id, name: '다음 번호', src: u.id });
      },
    } }),
  pu('minos', 'seed', 'reg', '사망 신고 접수',
    `자신이 건 중독이 남은 적이 쓰러지면 다음 저승청 관료가 ${S.regAdv}초 빨리 나온다. 관료가 이미 ${CLERKS.max}기면 대신 체력 비율이 가장 낮은 관료를 주요 위력 ${pc(S.regHeal)}만큼 회복.`,
    { hooks: { onAnyDeath(b, u, dead) {
      if (!u.alive || dead.isSummon || !foe(b, u, dead) || !dead.statuses.some((x) => x.key === 'poison' && x.src === u)) return;
      const clerks = summonsOf(b, u).filter((c) => !c.mem.colony && !c.mem.illusion && !c.mem.mirror);
      if (clerks.length < CLERKS.max) {
        // 특성의 관료 소환 타이머 = mem.clerkT (data/kit.ts every: 남은 초가 0 이하면 소환)
        u.mem.clerkT = (u.mem.clerkT ?? CLERKS.every / 2) - S.regAdv;
        return;
      }
      const c = clerks.reduce((a, x) => (b.hpPct(x) < b.hpPct(a) ? x : a));
      b.heal(u, c, mp(b, u) * S.regHeal);
      b.fx(c.x, c.y, 0, 'chem', 'heal');
    } } }),

  // ───────── 정신
  pu('minos', 'mind', 'reject', '민원 반려',
    `저승청 관료의 기본 공격이 자신이 결속한 적에게 맞으면 ${pc(M.rejP)} 확률로 ${M.rejDur}초 혼란 (같은 적은 ${M.rejIcd}초에 1회 판정).`,
    { hooks: { onTick(b, u) {
      tagClerks(b, u, 'puRej', (c) => c.hooks.push({ onBasic(bb, _self, t, r) {
        if (!u.alive || r.miss || r.amount <= 0 || !t.alive || !foe(bb, u, t)) return;
        if (!t.statuses.some((s) => s.key === 'bond' && s.src === u) || !icd(bb, t, `puRej${u.id}`, M.rejIcd)) return;
        confuse(bb, u, t, M.rejDur, M.rejP);
      } }));
    } } }),
  pu('minos', 'mind', 'usher', '줄 서기 안내',
    `대기열 정리와 관료 일제 사격을 받고도 버틴 대상이 [접수 완료] 기준 체력 이하면 ${M.usherCharm}초 매혹 (상대편으로 싸움, 보스 제외, 엘리트는 절반).`,
    { hooks: {
      onDeal(b, u, t, _r, o) { noteQueue(b, u, t, o); },
      onSkill(b, u) {
        const t = queued(b, u);
        QUEUE.delete(u);
        if (!t || !t.alive || t.isBoss || !foe(b, u, t) || b.hpPct(t) > (u.sk.exec ?? 0)) return;
        b.applyStatus(u, t, { type: 'buff', key: 'charm', dur: M.usherCharm, label: PSI_STATUS.charm.name });
      },
    } }),
  pu('minos', 'mind', 'ledger', '명부 대조',
    `자신이 결속한 적이 쓰러질 때마다 [명부] 1장 (전투당 최대 ${M.ledgerMax}장). 장마다 대기열 정리의 [접수 완료] 기준 체력 +${pp(M.ledgerPer)}.`,
    { hooks: { onAnyDeath(b, u, dead) {
      if (!u.alive || dead.isSummon || !foe(b, u, dead) || (u.mem.puLedger || 0) >= M.ledgerMax) return;
      if (!dead.statuses.some((x) => x.key === 'bond' && x.src === u)) return;
      u.mem.puLedger = (u.mem.puLedger || 0) + 1;
      u.sk.exec = (u.sk.exec ?? 0) + M.ledgerPer; // 전투마다 새로 만드는 스킬 수치 (build.ts) — 이번 전투에만
      b.emit({ k: 'status', id: u.id, name: `명부 ${u.mem.puLedger}장`, src: u.id });
    } } }),
];
