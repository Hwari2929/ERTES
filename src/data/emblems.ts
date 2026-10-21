// 문장 (개조부품 M_<시너지>) 고유 효과: 그 시너지에 추가로 소속되는 기존 기능에 더해 효과 하나.
// 장착한 기물 1명에게만, 시너지가 켜졌는지와 무관하게 항상 같은 수치 (예외: 페트라 = 함대 이자 상한, 출항기 = 출항기 시너지가 켜졌을 때만).
// 범은하 공동체 문장은 [증표] 규칙(synergies.ts PAN)만 쓰고 여기에는 없다.
// 수치는 EMB 한곳에서 정하고, 설명 문장(EMBLEM_FX.text)도 같은 수치로 만든다 (장비 설명 · 도감은 itemInfo 가 이 문장을 읽는다).
import { CFG } from '../config';
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import { ELEM_NAME, MAJOR_NAME, type Major, type SynergyId } from '../types';
import { mainPower } from './synergies';
import { type SummonDef, SUMMON_RT } from './unitkit';

/** 문장 효과 수치 (사용자 지정 값) */
export const EMB = {
  UNI: 5, KAL: 5, HEL: 5, SIR: 5, HOI: 5, // 주요 능력치 1종
  PET: 1, // 함대 이자 상한 (출전 기물이 단 문장 1개당)
  SEC: 0.3, // 효과 명중 (%p)
  CHR: 0.3, // 효과 저항 (%p)
  DECOMP: 0.2, COND: 0.2, OCCULT: 0.2, // 가하는 화학 · 전기 · 정신 피해
  SCHEME: 0.2, // 가하는 지속 피해
  MED: 0.2, // 최대 체력
  CHEF: 0.25, // 회복 효율
  GUARD: 0.25, // 방어도
  HUNTER: 0.3, // 치명타 피해 (%p)
  STL: 0.3, // 이동 속도
  TIME: 0.2, // 쿨다운 감소
  INFIL: 0.1, // 회피 (%p)
  NAV: 0.1, // 치명타 확률 (%p)
  FAM: 0.1, // 받는 피해 감소
  STAR: { fame: 2, per: 0.01, max: 0.15 }, // 명성 fame 당 가하는 피해 +per, 최대 max
  ENG: 0.25, // 아군 감시 포탑 최대 체력 (문장끼리 더한다)
  BUDDY: { rate: 0.25, blast: 1.0, r: 1, prov: 4.5 }, // 반려 돌(인화성): 기본 상속률 · 폭발 계수 (주인 주요 위력) · 반경 · 기본 도발 배율
  VOYAGE: { every: 6, pct: 0.1 }, // [활력 충전] 주기 · 최대 체력 회복 비율
};

/** 최고의 친구 문장 소환물: 반려 돌(인화성). 상속률 = 최고의 친구 소환물 규칙(build.ts summonBond) × rate → 기본 EMB.BUDDY.rate */
/** 반려 돌(인화성) 자리 (전장은 적 진형 · 가운데 1줄 · 아군 진형이 위아래로 대칭): 가운데 줄 한가운데 한 칸 → 차 있으면 적진 안으로 (가까운 줄부터, 각 줄은 가운데부터 좌우로) */
function rockCell(b: Parameters<NonNullable<typeof SUMMON_RT.make>>[0], side: 0 | 1) {
  const mid = b.geo ? b.geo.ay0 - 1 : Math.floor(b.h / 2), dir = side === 0 ? -1 : 1, cx = Math.floor(b.w / 2); // 아군 진형 바로 앞줄 (지형 틀에 따라 다름)
  if (b.inBounds(cx, mid) && !b.unitAt(cx, mid)) return { x: cx, y: mid };
  for (let y = mid + dir; y >= 0 && y < b.h; y += dir)
    for (let k = 0; k < b.w; k++) {
      const x = cx + (k % 2 ? (k + 1) / 2 : -k / 2);
      if (b.inBounds(x, y) && !b.unitAt(x, y)) return { x, y };
    }
  return null;
}
export const EMB_ROCK: SummonDef = {
  name: '반려 돌(인화성)', ctype: 'VAN', art: 'sm_rockfire', sprite: 'turret', palette: ['#0e0e0e', '#8a8a86', '#c8502a', '#c8c8c0', '#ffb36b', '#3a3a38', '#e8e8e0'],
  atk: { type: 'strike', elem: 'phys', interval: 1.2 }, range: 1, moveSpd: 1, rate: EMB.BUDDY.rate / CFG.bond.base, struct: true, prov: EMB.BUDDY.prov,
};

const pc = (v: number) => `${Math.round(v * 100)}%`;
const major = (m: Major, v: number): EmblemDef => ({ text: `${MAJOR_NAME[m]} +${v}.`, effect: () => ({ majors: { [m]: v } }) });

interface EmblemDef { text: string; effect: () => Effect }

export const EMBLEM_FX: Partial<Record<SynergyId, EmblemDef>> = {
  UNI: major('vit', EMB.UNI),
  KAL: major('def', EMB.KAL),
  HEL: major('pow', EMB.HEL),
  SIR: major('mnd', EMB.SIR),
  HOI: major('agi', EMB.HOI),
  // 경제 효과 (유일한 예외): 장착한 기물이 아니라 함대 전체의 이자 상한. engine/run.ts interestInfo 가 출전 기물의 문장 수를 센다
  PET: { text: `함대 전체 이자 상한 +${EMB.PET} (출전 기물에 단 이 문장 1개당, 보관함 제외).`, effect: () => ({}) },
  SEC: { text: `효과 명중 +${pc(EMB.SEC)}p.`, effect: () => ({ stats: { effHit: EMB.SEC } }) },
  CHR: { text: `효과 저항 +${pc(EMB.CHR)}p.`, effect: () => ({ stats: { effRes: EMB.CHR } }) },
  DECOMP: { text: `가하는 ${ELEM_NAME.chem} 피해 +${pc(EMB.DECOMP)}.`, effect: () => ({ mods: [inc('chem', EMB.DECOMP)] }) },
  COND: { text: `가하는 ${ELEM_NAME.elec} 피해 +${pc(EMB.COND)}.`, effect: () => ({ mods: [inc('elec', EMB.COND)] }) },
  OCCULT: { text: `가하는 ${ELEM_NAME.psy} 피해 +${pc(EMB.OCCULT)}.`, effect: () => ({ mods: [inc('psy', EMB.OCCULT)] }) },
  SCHEME: { text: `가하는 지속 피해 +${pc(EMB.SCHEME)}.`, effect: () => ({ mods: [inc('dot', EMB.SCHEME)] }) },
  MED: { text: `최대 체력 +${pc(EMB.MED)}.`, effect: () => ({ pct: { maxHp: EMB.MED } }) },
  CHEF: { text: `회복 효율 +${pc(EMB.CHEF)}.`, effect: () => ({ stats: { healEff: EMB.CHEF } }) },
  GUARD: { text: `방어도 +${pc(EMB.GUARD)}.`, effect: () => ({ pct: { armor: EMB.GUARD } }) },
  HUNTER: { text: `치명타 피해 +${pc(EMB.HUNTER)}p.`, effect: () => ({ stats: { critDmg: EMB.HUNTER } }) },
  STL: { text: `이동 속도 +${pc(EMB.STL)}.`, effect: () => ({ pct: { moveSpd: EMB.STL } }) },
  TIME: { text: `쿨다운 감소 +${pc(EMB.TIME)}.`, effect: () => ({ stats: { cdr: EMB.TIME } }) },
  INFIL: { text: `회피 +${pc(EMB.INFIL)}p.`, effect: () => ({ stats: { eva: EMB.INFIL } }) },
  NAV: { text: `치명타 확률 +${pc(EMB.NAV)}p.`, effect: () => ({ stats: { crit: EMB.NAV } }) },
  FAM: { text: `받는 피해 -${pc(EMB.FAM)}.`, effect: () => ({ taken: [red('all', EMB.FAM)] }) },
  STAR: {
    text: `명성 ${EMB.STAR.fame}당 가하는 피해 +${pc(EMB.STAR.per)} (최대 +${pc(EMB.STAR.max)}).`,
    effect: () => ({ setup: (u, _b, ctx) => {
      const v = Math.min(EMB.STAR.max, Math.floor((ctx.run?.fame || 0) / EMB.STAR.fame) * EMB.STAR.per);
      if (v > 0) u.mods.push(inc('all', v));
    } }),
  },
  // 포탑은 출전한 엔지니어(문장 포함)의 mem.turretMaxHp 합만큼 최대 체력이 는다 (engine/build.ts ENG_HOOK.spawn)
  ENG: { text: `아군 감시 포탑 최대 체력 +${pc(EMB.ENG)} (문장끼리 더한다).`, effect: () => ({ setup: (u) => { u.mem.turretMaxHp = (u.mem.turretMaxHp || 0) + EMB.ENG; } }) },
  BUDDY: {
    text: `전투 시작 시 소환물 [${EMB_ROCK.name}]을 부른다 (기본 상속률 ${pc(EMB.BUDDY.rate)}, 원래 소환물과 따로). 전장 가운데 줄(배치 불가 구역)의 한가운데에 놓이고, 그 자리가 차 있으면 적진 쪽으로 밀려난다. 구조물이라 움직이지 않고 체력 대신 내구도를 가지며, 기본 도발 배율은 ×${EMB.BUDDY.prov}이다. 내구도가 다하면 폭발해 주변 ${EMB.BUDDY.r}칸 적에게 주인 주요 위력 ${pc(EMB.BUDDY.blast)} ${ELEM_NAME.phys} 피해.`,
    effect: () => ({ hooks: {
      onStart(b, u) {
        const r = SUMMON_RT.make?.(b, u, EMB_ROCK);
        if (!r) return;
        r.mem.embRock = 1;
        // 자리: 전장 가운데 줄(배치 불가 구역)의 한가운데. 이미 차 있으면 적진 쪽으로 한 줄씩 밀려난다 (아군 쪽에서 본 위 방향)
        const cell = rockCell(b, u.side);
        if (cell) { r.x = r.px = cell.x; r.y = r.py = cell.y; }
      },
      // 주인이 먼저 쓰러지면 소환물은 폭발 없이 사라진다 (combat.ts kill)
      onAllyDeath(b, u, dead) {
        if (dead.owner !== u || !dead.mem.embRock) return;
        b.fx(dead.x, dead.y, 0, 'phys');
        b.emit({ k: 'status', id: dead.id, name: '인화 폭발' });
        const pow = mainPower(b, u) * EMB.BUDDY.blast;
        for (const e of b.around(dead, EMB.BUDDY.r, b.enemiesOf(u))) b.dealDamage(u, e, pow, { elem: 'phys', tag: 'proc' });
      },
    } }),
  },
  VOYAGE: {
    text: `고유 능력 [활력 충전]: ${EMB.VOYAGE.every}초마다 최대 체력 ${pc(EMB.VOYAGE.pct)} 회복. 우리의 출항기! 시너지가 켜져 있을 때만 (정확히 1명 또는 5명).`,
    effect: () => ({
      setup: (u, _b, ctx) => { const n = ctx.counts.VOYAGE || 0; u.mem.embVoyOn = n === 1 || n >= 5 ? 1 : 0; }, // synergies.ts VOYAGE special 과 같은 조건
      hooks: { onTick(b, u, dt) {
        if (!u.mem.embVoyOn) return;
        u.mem.embVoy = (u.mem.embVoy || 0) + dt;
        if (u.mem.embVoy < EMB.VOYAGE.every) return;
        u.mem.embVoy -= EMB.VOYAGE.every;
        b.heal(u, u, b.S(u, 'maxHp') * EMB.VOYAGE.pct);
      } },
    }),
  },
};

/** 문장 고유 효과 설명 (없으면 '') */
export const emblemText = (syn: SynergyId) => EMBLEM_FX[syn]?.text || '';
/** 문장 고유 효과 (장착한 기물 1명) */
export const emblemEffect = (syn: SynergyId): Effect => EMBLEM_FX[syn]?.effect() || {};
/** 최고의 친구 문장을 단 기물이면 소환물 목록에 반려 돌(인화성)을 더한 기물 정의 (기물 상세 소환물 섹션 미리보기 · 전투 중 표시용) */
export function withEmblemSummon<T extends { summon?: SummonDef }>(d: T, mod: string | null | undefined): T {
  if (mod !== 'M_BUDDY') return d;
  return { ...d, summon: d.summon ? { ...d.summon, also: [...(d.summon.also || []), EMB_ROCK] } : EMB_ROCK };
}
