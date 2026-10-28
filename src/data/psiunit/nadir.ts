// 사이오닉 전용 전공 증강: nadir (kit.ts 참고)
// 나디르: 백수정 기록을 현실에 비추는 [사이오닉 영사] (기본 공격 · 전투 스킬의 정신 바운스), 백수정 조각 탄창 (6발 · 재장전),
// 전투 스킬 [백수정 섬광] (주변 1칸 정신 피해 + 명중 감소), 빛을 한 점에 모아 태우는 전투 방식, 대기 시간마다 하는 백수정 저글링,
// 주변 풍경을 영사해 숨는 위장. 수치는 NX, 설명문도 NX 를 읽는다.
import type { Battle, CUnit, DmgOpts, Status } from '../../engine/combat';
import type { AugDef } from '../../engine/effects';
import { mp, resonanceStatus } from '../psionic';
import { PSI } from '../psinum';
import { pu } from './kit';

/** 나디르 전용 전공 증강 수치 */
export const NX = {
  volt: {
    /** 유도 영사: 전도를 걸 확률 · 같은 적 대기 */
    inductP: 0.3, inductIcd: 1.5,
    /** 저글링: 피해 (주요 위력 배수) · 더하는 전도 중첩 */
    juggleCoef: 0.9, juggleAdd: 1,
    /** 집광: 세는 전도 최대 중첩 · 1중첩당 피해 (주요 위력 배수) */
    focusMax: 6, focusPer: 0.5,
  },
  wave: {
    /** 눈부심: 기절 */
    dazzleStun: 0.8,
    /** 공명 영사: 확률 · 같은 적 대기 */
    echoP: 0.25, echoIcd: 2,
    /** 위장 영사: 은신 · 대기 */
    veilDur: 2, veilIcd: 8,
  },
} as const;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const foe = (b: Battle, u: CUnit, t: CUnit) => t !== u && t.alive && b.sideOf(t) !== b.sideOf(u);
/** 대기 시간: key 가 아직 막혀 있으면 false, 아니면 막고 true */
const icd = (b: Battle, holder: CUnit, key: string, sec: number) => {
  if ((holder.mem[key] || 0) > b.t) return false;
  holder.mem[key] = b.t + sec;
  return true;
};
/** 자신이 건 전도 */
const myConduct = (u: CUnit, t: CUnit) => t.statuses.find((s) => s.key === 'conduct' && s.src === u && s.dur > 0);
/** [사이오닉 영사] 바운스 (rework.ts nadirEcho: 정신 · 기술 부가 피해, 키 없음) */
const isEcho = (o: DmgOpts) => o.tag === 'proc' && o.elem === 'psy' && o.kind === 'tech' && !o.key;
/** [백수정 섬광] 적중 (비술은 key 'cantrip' 이라 빠진다) */
const isFlash = (o: DmgOpts) => o.tag === 'skill' && o.elem === 'psy' && !o.key;

/** 이번 섬광에 맞은 적 (onDeal 에서 모으고, 같은 틱의 onSkill 에서 쓴다) */
const FLASH = new WeakMap<CUnit, { t: number; hit: Set<CUnit> }>();
const noteFlash = (b: Battle, u: CUnit, t: CUnit) => {
  let h = FLASH.get(u);
  if (!h || h.t !== b.t) { h = { t: b.t, hit: new Set() }; FLASH.set(u, h); }
  h.hit.add(t);
};
const flashHits = (b: Battle, u: CUnit) => { const h = FLASH.get(u); return h && h.t === b.t ? [...h.hit].filter((e) => foe(b, u, e)) : []; };

/** 마지막으로 적에게 건 자신의 전도 (전도가 없는 적에게 새로 걸 때의 틀: 엔진의 전도 생성 함수가 바깥에 없어 복사한다) */
const CONDUCT_TPL = new WeakMap<CUnit, Status>();
const captureConduct = { onInflict(b: Battle, u: CUnit, t: CUnit, s: Status) { if (s.key === 'conduct' && foe(b, u, t)) CONDUCT_TPL.set(u, s); } };
/** 대상의 자신이 건 전도에 n중첩을 더한다 (없으면 새로 건다, 최대 중첩까지) */
function growConduct(b: Battle, u: CUnit, t: CUnit, n: number) {
  const base = myConduct(u, t) || CONDUCT_TPL.get(u);
  if (!base || !t.alive) return false;
  return b.applyStatus(u, t, { ...base, stacks: n, dur: PSI.volt.dur, tickAcc: undefined });
}

const V = NX.volt, W = NX.wave;

export const AUGS: AugDef[] = [
  // ───────── 뇌전
  pu('nadir', 'volt', 'induct', '유도 영사',
    `사이오닉 영사 바운스가 맞힌 적에게 기록의 전류가 옮겨 간다: 자신이 건 전도가 있으면 즉시 한 번 반응하고 (그 적이 행동한 것처럼), 없으면 ${pc(V.inductP)} 확률로 전도 1중첩을 건다 (같은 적에게 ${V.inductIcd}초에 1회).`,
    { hooks: { ...captureConduct, onDeal(b, u, t, _r, o) {
      if (!isEcho(o) || !foe(b, u, t) || !icd(b, t, `nvInd${u.id}`, V.inductIcd)) return;
      const s = myConduct(u, t);
      if (s) { b.fx(t.x, t.y, 1, 'elec'); s.onAct?.(b, t, s); }
      else if (b.rng.chance(V.inductP)) growConduct(b, u, t, 1);
    } } }),
  pu('nadir', 'volt', 'juggle', '저글링',
    `재장전을 마칠 때마다 손에서 굴리던 백수정을 던진다: 사거리 안에서 자신이 건 전도가 가장 많은 적(없으면 지금 대상)에게 주요 위력 ${pc(V.juggleCoef)} 전기 피해, 전도 ${V.juggleAdd}중첩 추가 (없으면 새로 건다).`,
    { hooks: { ...captureConduct, onTick(b, u) {
      const was = u.mem.nvJugRl || 0;
      u.mem.nvJugRl = u.reloadT;
      if (!(was > 0 && u.reloadT <= 0) || !u.alive) return;
      const pool = b.targetable(u).filter((e) => b.dist(u, e) <= b.S(u, 'range'));
      if (!pool.length) return;
      let t: CUnit | null = null, best = 0;
      for (const e of pool) { const n = myConduct(u, e)?.stacks || 0; if (n > best || (n === best && n > 0 && t && b.dist(u, e) < b.dist(u, t))) { best = n; t = e; } }
      t ??= u.target && pool.includes(u.target) ? u.target : b.nearest(u, pool);
      if (!t) return;
      b.emit({ k: 'atk', from: u.id, to: t.id, elem: 'elec', ranged: true });
      b.dealDamage(u, t, mp(b, u) * V.juggleCoef, { elem: 'elec', tag: 'proc', kind: 'tech' });
      if (t.alive) growConduct(b, u, t, V.juggleAdd);
    } } }),
  pu('nadir', 'volt', 'focus', '집광',
    `백수정 섬광이 맞힌 적들의 자신이 건 전도 중첩을 모두 세어 (최대 ${V.focusMax}중첩), 그 빛을 지금 대상 한 점에 모아 태운다: 1중첩당 주요 위력 ${pc(V.focusPer)} 전기 피해 (전도는 그대로).`,
    { hooks: {
      onDeal(b, u, t, _r, o) { if (isFlash(o) && foe(b, u, t)) noteFlash(b, u, t); },
      onSkill(b, u) {
        const hit = flashHits(b, u);
        if (!hit.length) return;
        const t = u.target && hit.includes(u.target) ? u.target : hit.reduce((a, c) => (c.hp > a.hp ? c : a));
        let n = 0;
        for (const e of hit) {
          const k = myConduct(u, e)?.stacks || 0;
          if (!k) continue;
          n += k;
          if (e !== t) b.emit({ k: 'atk', from: e.id, to: t.id, elem: 'elec', ranged: true, chain: true });
        }
        n = Math.min(V.focusMax, n);
        if (!n) return;
        b.fx(t.x, t.y, 0, 'elec');
        b.emit({ k: 'status', id: t.id, name: '집광', src: u.id, harm: true });
        b.dealDamage(u, t, mp(b, u) * V.focusPer * n, { elem: 'elec', tag: 'proc', kind: 'tech' });
      },
    } }),
  // ───────── 파장
  pu('nadir', 'wave', 'dazzle', '눈부심',
    `백수정 섬광에 맞은 적 중 공진된 적은 빛이 공진에 맞물려 ${W.dazzleStun}초 기절하고, 공진 시간이 처음으로 돌아간다.`,
    { hooks: {
      onDeal(b, u, t, _r, o) { if (isFlash(o) && foe(b, u, t)) noteFlash(b, u, t); },
      onSkill(b, u) {
        for (const e of flashHits(b, u)) {
          const s = e.statuses.find((x) => x.key === 'resonance' && x.dur > 0);
          if (!s) continue;
          s.dur = Math.max(s.dur, PSI.wave.resDur);
          b.stun(u, e, W.dazzleStun);
        }
      },
    } }),
  pu('nadir', 'wave', 'echo', '공명 영사',
    `사이오닉 영사 바운스가 맞힌 적에게 ${pc(W.echoP)} 확률로 공진을 건다 (같은 적에게 ${W.echoIcd}초에 1회 판정).`,
    { hooks: { onDeal(b, u, t, _r, o) {
      if (!isEcho(o) || !foe(b, u, t) || !icd(b, t, `nwEcho${u.id}`, W.echoIcd)) return;
      b.applyStatus(u, t, resonanceStatus(b, u), W.echoP);
    } } }),
  pu('nadir', 'wave', 'veil', '위장 영사',
    `적을 밀쳐내거나 끌어당기면 주변 풍경을 자신에게 영사해 ${W.veilDur}초간 은신한다 (${W.veilIcd}초에 1회).`,
    { hooks: { onDisplace(b, u, victim, src, kind) {
      if (src !== u || kind === 'move' || !u.alive || !foe(b, u, victim) || !icd(b, u, 'nwVeil', W.veilIcd)) return;
      b.buff(u, u, 'stealth', W.veilDur, { label: '위장 영사' });
      b.fx(u.x, u.y, 0, 'psy', 'aura');
    } } }),
];
