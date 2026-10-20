// 캠페인 「회수 계약」 (베르타–산노디스 물류망): 전용 시너지 · 소속표 · 장 정의.
// 캠페인 런(run.campaign)에서만 쓰인다. 일반 런의 시너지 표(SYNERGIES)와 섞이지 않게 별도 목록으로 두고,
// 시너지 단계 계산(tierOf)이 찾을 수 있도록 SYN_BY_ID 에만 등록한다 (registerSyns).
import { CFG } from '../config';
import type { Battle, CUnit } from '../engine/combat';
import { inc, red, type Effect } from '../engine/effects';
import type { CampSynId, NodeType, RunState, SynergyId } from '../types';
import { registerSyns, type SynDef, VOYAGE_SPECIAL } from './synergies';

const allMaj = (v: number) => ({ vit: v, pow: v, mnd: v, def: v, agi: v });

/** 캠페인 시너지 수치 (초안 · 조정용 한곳) */
export const CAMP = {
  voyHeal: 0.04, voyMaj: 8, voyOt: 1.0, voyTeam: 0.2,
  petRed: [0.1, 0.2], petWin: 2,
  lazyDelay: 2, lazyPow: [0.6, 1.0], lazyHeal: 0.15, lazyRevive: 0.4, lazyNap: 3,
  campHeal: 0.015, campAs: 0.15, campAfterHp: 3,
  bncK: 0.5, bncHops: [1, 2],
  agitTime: 2, agitBelow: 20, agitDmg: 0.15,
};

/** 모닥불 장판: 아군 진영 가운데 2×2 칸 (기물이 아니라 칸 효과 — 공격 · 파괴 · 충돌 없음) */
export function campfireCells(b: Battle): { x0: number; x1: number; y0: number; y1: number } {
  const cx = Math.floor(b.w / 2), y1 = b.h - 2; // 아군 진영: 아래쪽 3줄 (맨 아랫줄 = 테두리 바로 위)
  return { x0: cx - 1, x1: cx, y0: y1 - 1, y1 };
}
const inCamp = (b: Battle, u: CUnit) => { const z = campfireCells(b); return u.x >= z.x0 && u.x <= z.x1 && u.y >= z.y0 && u.y <= z.y1; };

/** 바운스: 기본 공격이 맞은 적에서 다른 적에게 튕긴다. 처음 맞은 적 · 직전 대상은 제외, 튕긴 피해는 다시 튕기거나 적중 효과를 내지 않는다 (noHooks) */
function bounce(b: Battle, u: CUnit, from: CUnit, hops: number) {
  const w = u.weapon;
  const dmg = b.S(u, w?.type === 'strike' ? 'strike' : 'shoot') * (w?.mult || 1) * CAMP.bncK;
  const hit = new Set<CUnit>([from]);
  let at: CUnit = from;
  for (let i = 0; i < hops; i++) {
    const next = b.nearest(at, b.around(at, 3, b.enemiesOf(u)).filter((e) => !hit.has(e)));
    if (!next) break;
    hit.add(next);
    b.emit({ k: 'atk', from: at.id, to: next.id, elem: w?.elem || 'phys', ranged: true, chain: true });
    b.dealDamage(u, next, dmg, { elem: w?.elem || 'phys', tag: 'proc', kind: w?.type || 'shoot', noHooks: true, syn: 'CP_BNC' });
    at = next;
  }
}

export const CAMP_SYNERGIES: SynDef[] = [
  {
    id: 'CP_VOY', name: '우리의 출항기!', kind: 'faction', tiers: [1, 2, 3, 4, 5], color: '#4fc3c8', icon: '⛵',
    desc: '한 배를 탄 다섯 동료. 하나씩 합류할 때마다 단계가 쌓입니다 (캠페인 전용 · 아래 단계 효과를 모두 포함).',
    tierDesc: ['구성원: 전투 기술을 쓰면 최대 체력 4% 회복', '구성원: 주요 능력치 +8', '구성원: 고유 능력 (기물마다 다름)', '구성원: 연장전 피해 증폭 +100%', '아군 전원: 주는 피해 +20%'],
    member: (t) => ({
      majors: t >= 2 ? allMaj(CAMP.voyMaj) : undefined,
      hooks: {
        onSkill(b, u) { b.heal(u, u, b.S(u, 'maxHp') * CAMP.voyHeal, false, 'CP_VOY'); },
        ...(t >= 4 ? { dmgMult: (b: Battle) => (b.t > CFG.overtimeStart - (b.ctx.otShift || 0) ? 1 + CAMP.voyOt : 1) } : {}),
      },
    }),
    team: (t) => (t >= 5 ? { mods: [inc('all', CAMP.voyTeam)] } : null),
    special: (n, ctx) => (n >= 3 && ctx.unit ? VOYAGE_SPECIAL[ctx.unit.defId]?.effect || null : null),
  },
  {
    id: 'CP_PET', name: '페트라', kind: 'faction', tiers: [2, 3], color: '#e07a1f', icon: '¤',
    desc: '주식회사 페트라 쪽 사람들. 계약은 지키고, 정산은 확실하게.',
    tierDesc: [`구성원: 피해량 경감 ${CAMP.petRed[0] * 100}% · 전투 승리 시 크레딧 +${CAMP.petWin}`, `구성원: 피해량 경감 ${CAMP.petRed[1] * 100}% · 장 정산 보너스 1단계 위`],
    member: (t) => ({ taken: [red('all', CAMP.petRed[Math.min(t, 2) - 1])] }),
  },
  {
    id: 'CP_LAZY', name: '귀차니스트', kind: 'trait', tiers: [2, 3, 4], color: '#9b8ec4', icon: '☾',
    desc: '"꼭 지금 해야 돼?" 미루다가 한 번은 제대로 한다. 전투의 첫 기술이 늦게 준비되는 대신 강해집니다.',
    tierDesc: [`구성원: 첫 전투 기술 준비 +${CAMP.lazyDelay}초, 그 기술 위력 +${CAMP.lazyPow[0] * 100}%`, `구성원: 첫 기술 위력 +${CAMP.lazyPow[1] * 100}%, 첫 기술을 쓰면 최대 체력 ${CAMP.lazyHeal * 100}% 회복`, `구성원: 처음 쓰러질 때 "5분만 더" — ${CAMP.lazyNap}초 낮잠 뒤 체력 ${CAMP.lazyRevive * 100}%로 일어남`],
    member: (t): Effect => ({
      setup(u) { if (u.skill) { u.cd += CAMP.lazyDelay; u.mem.lazy = 1; } },
      hooks: {
        dmgMult: (_b, u, _tgt, o) => (u.mem.lazy && o.tag === 'skill' ? 1 + CAMP.lazyPow[Math.min(t, 2) - 1] : 1),
        onSkill(b, u) {
          if (!u.mem.lazy) return;
          u.mem.lazy = 0;
          if (t >= 2) b.heal(u, u, b.S(u, 'maxHp') * CAMP.lazyHeal, false, 'CP_LAZY');
        },
        ...(t >= 3 ? {
          onLethal(b: Battle, u: CUnit) {
            if (u.isSummon || u.mem.lazyRev) return false;
            u.mem.lazyRev = 1;
            u.hp = b.S(u, 'maxHp') * CAMP.lazyRevive;
            u.mem.invulnUntil = b.t + CAMP.lazyNap;
            b.applyStatus(u, u, { type: 'stun', key: 'stun', dur: CAMP.lazyNap, label: '낮잠' });
            b.emit({ k: 'mark', id: u.id, name: '5분만 더', style: 'revive' });
            return true;
          },
        } : {}),
      },
    }),
  },
  {
    id: 'CP_CAMP', name: '캠핑 러버', kind: 'trait', tiers: [2, 3, 4], color: '#e0a050', icon: '⛺',
    desc: '모닥불 앞에서 밥 먹는 사람들. 아군 진영 가운데 2×2 칸에 모닥불을 피웁니다 (칸 효과 · 소환물 포함 · 적에게는 없음).',
    tierDesc: [`아군 전원: 모닥불 칸 위에서 초당 최대 체력 ${CAMP.campHeal * 100}% 회복`, `아군 전원: 모닥불 칸 위에서 공격 속도 +${CAMP.campAs * 100}%`, `전투가 끝나면 플레이어 체력 +${CAMP.campAfterHp}`],
    team: (t) => ({
      hooks: {
        onTick(b, u, dt) {
          if (!u.alive || !inCamp(b, u)) return;
          b.heal(u, u, b.S(u, 'maxHp') * CAMP.campHeal * dt, false, 'CP_CAMP');
          if (t >= 2) b.buff(u, u, 'camp.fire', 0.5, { delta: { atkSpd: CAMP.campAs }, label: '모닥불' });
        },
      },
    }),
  },
  {
    id: 'CP_BNC', name: '바운스', kind: 'trait', tiers: [2, 3], color: '#5fb7ad', icon: '↯',
    desc: '튀고 꺾이고 돌아 나오는 공격. 기본 공격이 다른 적에게 튕깁니다 (처음 맞은 적 제외 · 튕긴 피해는 다시 튕기지 않음).',
    tierDesc: [`구성원: 기본 공격이 주변 3칸의 다른 적 1명에게 ${CAMP.bncK * 100}% 위력으로 튕김`, '구성원: 2번 튕김'],
    member: (t) => ({ hooks: { onBasic(b, u, tgt, r) { if (!r.miss) bounce(b, u, tgt, CAMP.bncHops[Math.min(t, 2) - 1]); } } }),
  },
  {
    id: 'CP_AGIT', name: '선동가', kind: 'trait', tiers: [3], color: '#d4b24a', icon: '📣',
    desc: '판을 흔드는 말재주. 마감이 다가올수록 사람들을 더 세게 몰아붙입니다 (후반 전용).',
    tierDesc: [`전투 승리 시 AH +${CAMP.agitTime} · 남은 AH ${CAMP.agitBelow} 미만이면 아군 전원 주는 피해 +${CAMP.agitDmg * 100}%`],
    team: (_t, ctx) => ((ctx.run?.campaign?.time ?? 99) < CAMP.agitBelow ? { mods: [inc('all', CAMP.agitDmg)] } : null),
  },
];
registerSyns(CAMP_SYNERGIES);
export const CAMP_SYN_IDS = CAMP_SYNERGIES.map((s) => s.id as CampSynId);

/** 캠페인 소속표: 캠페인 런에서는 기물 기본 소속 · 증강 · 문장 대신 이 표만 쓴다 */
export const CAMP_MEMBERS: Record<string, CampSynId[]> = {
  rachel: ['CP_VOY', 'CP_LAZY', 'CP_CAMP'],
  vivian: ['CP_VOY', 'CP_CAMP', 'CP_BNC'],
  nadir: ['CP_VOY', 'CP_CAMP', 'CP_BNC'],
  temur: ['CP_VOY', 'CP_AGIT'],
  phyllis: ['CP_VOY', 'CP_LAZY', 'CP_BNC'],
  lars: ['CP_PET', 'CP_LAZY', 'CP_AGIT'],
  lindiwe: ['CP_PET', 'CP_LAZY', 'CP_CAMP'],
  franche: ['CP_PET', 'CP_AGIT'],
};
export const campMembers = (defId: string): SynergyId[] => CAMP_MEMBERS[defId] || [];

// ───────────────────────── 장 정의 (검증판: 프롤로그 + 1 · 2 · 3장)
export interface ChapterDef {
  ch: number; name: string; place: string;
  /** 출전 인원 상한 */
  deploy: number;
  /** 장 시작 AH (접근시간) */
  time: number;
  map: NodeType[][];
  /** 사건 칸(지도 칸 번호) → 고정 사건 id (data/events.ts 의 캠페인 사건) */
  events: Record<number, string>;
  boss: string;
  /** 적 성장 단계 (일반 런의 페이즈와 같은 배율). 캠페인은 출전 인원이 적어 기물이 빨리 자라므로 장 번호보다 높게 잡는다 */
  phase: number;
  /** 정예: 이 칸 번호부터 일반 전투에 1마리 */
  elite?: { id: string; from: number };
}
/** 노드별 AH 비용 (고른 행동에만 든다 — 대화 · 설명을 읽는 시간은 들지 않는다) */
export const TIME_COST: Partial<Record<NodeType, number>> = { battle: 6, adversity: 6, boss: 6, event: 3, maint: 2, supply: 2, shop: 1 };
/** 1장 기본 경로 비용 = 전투 3 · 보스 · 사건 4 · 보급 · 분기점 = 39 → 시작 53 이면 14 남음 (정산 최고 단계).
 *  비비안 조사(-4) · 필리스 확인(-2)을 쓰면 단계가 내려간다 */
export const CHAPTERS: ChapterDef[] = [
  { ch: 1, name: '1장 · TS-7 환적 정거장', place: '환적 정거장 TS-7', deploy: 2, time: 53, phase: 1,
    map: [['battle'], ['event'], ['battle'], ['event'], ['supply'], ['event'], ['battle'], ['shop'], ['event'], ['boss']],
    events: { 1: 'cp_phyllis', 3: 'cp_cargo1', 5: 'cp_survey', 8: 'cp_cargo2' }, boss: 'cp_loader' },
  // 2장 기본 경로 비용 = 전투 4 · 보스 · 사건 4 · 보급 · 분기점 = 45 → 시작 59 면 14 남음. 나디르 영사(-4) · 필리스 확인(-2) · 지름길(+2)
  { ch: 2, name: '2장 · A-117 광석 하역장', place: '광석 소행성 하역장 A-117', deploy: 3, time: 59, phase: 3,
    map: [['battle'], ['event'], ['battle'], ['event'], ['battle'], ['supply'], ['event'], ['battle'], ['shop'], ['event'], ['boss']],
    events: { 1: 'cp2_nadir', 3: 'cp2_cargo3', 6: 'cp2_record', 9: 'cp2_cargo4' }, boss: 'cp_borer', elite: { id: 'sw_brood', from: 7 } },
  // 3장 기본 경로 비용 = 전투 5 · 보스 · 사건 4 · 보급 · 분기점 = 51 → 시작 65 면 14 남음. 배전실(-4) · 필리스 확인(-2) · 따뜻한 길(+2) · 라르스 보상 AH(+4)
  { ch: 3, name: '3장 · RL-2 중계 위성', place: '중계 위성 RL-2 연구 정거장', deploy: 4, time: 65, phase: 4,
    map: [['battle'], ['event'], ['battle'], ['event'], ['battle'], ['supply'], ['event'], ['battle'], ['event'], ['battle'], ['shop'], ['boss']],
    events: { 1: 'cp3_temur', 3: 'cp3_cargo5', 6: 'cp3_relay', 8: 'cp3_vault' }, boss: 'cp_herald', elite: { id: 'sw_brood', from: 7 } },
];
/** 검증판 마지막 장 다음에 올 장 (정산 알림에 이름만 보여 준다) */
export const CAMP_NEXT = '4장 · 베르타-4 제4링 궤도 하역장';
export const chapterOf = (run: RunState) => CHAPTERS.find((c) => c.ch === run.campaign?.ch) || CHAPTERS[0];
/** 장 정산 보너스: 남은 시간 구간별 크레딧 (상한 있음 — 강한 편성이 돈까지 더 버는 순환을 막는다). 페트라 3단계면 한 단계 위 */
export const SETTLE: Record<number, { from: number; cr: number }[]> = {
  1: [{ from: 14, cr: 8 }, { from: 8, cr: 4 }, { from: -999, cr: 0 }],
  2: [{ from: 14, cr: 10 }, { from: 8, cr: 5 }, { from: -999, cr: 0 }],
  3: [{ from: 14, cr: 12 }, { from: 8, cr: 6 }, { from: -999, cr: 0 }],
};
