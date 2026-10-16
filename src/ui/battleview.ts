import { CFG } from '../config';
import { itemInfo } from '../data/items';
import type { BEvent, Battle, CUnit, Status } from '../engine/combat';
import { isHarmful } from '../data/kit';
import type { Elem } from '../types';
import { hasPortrait, iconURL, standURL } from './portraits';
import { ULTS } from '../data/ults';
import { VOICE, voicePick } from '../data/voicelines';
import { RELIC_BY_ID } from '../data/relics';
import { DIVINE_ACT } from '../data/rework';
import { SCHOOL_BY_ID, type SchoolId } from '../data/schools';
import { cantripView } from '../data/psiinfo';
import { lineIcon } from './synicons';

export const ELEM_COLOR: Record<Elem, string> = {
  phys: 'var(--el-phys)', chem: 'var(--el-chem)', elec: 'var(--el-elec)', psy: 'var(--el-psy)', holy: 'var(--el-holy)', true: 'var(--el-true)',
};

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

interface UEl {
  el: HTMLElement; face: HTMLElement; hp: HTMLElement; loss: HTMLElement; sh: HTMLElement; cd: HTMLElement; gx: HTMLElement | null; cpi: HTMLElement | null;
  /** 궁극기(파랑) · 신성력(노랑) 테두리 게이지 */
  ug: HTMLElement | null; ugSig: string;
  sti: HTMLElement; stc: HTMLElement; stk: HTMLElement; rl: HTMLElement;
  u: CUnit; dead: boolean;
  /** 체력 바 손실 구간 (큰 피해 뒤 잠깐 남는 흰 띠) */
  trail: number; trailHold: number;
  /** 상태 표시 서명 (바뀔 때만 다시 그림) · sti = 디버프 줄, stk = 버프 줄 */
  stiSig: string; stkSig: string; rlMax: number;
}
/** 최근 행동 한 줄 */
export interface ActLine { t: number; key: string; text: string; v?: number; ids?: Set<number> }

// 연출 시간 (게임 초 · 배속에 비례)
const T_MELEE = 0.08; // 근접: 기울기 정점에서 적중
const T_SKILL = 0.12; // 스킬명 → 효과
const T_SUPPORT = 0.22; // 회복 · 보호막 표식 이동
/** 효과 색: 아군이 준 피해 흰색 · 적이 준 피해 빨강 (속성색은 숫자에만) */
const sideColor = (side: 0 | 1 | undefined) => (side === 1 ? 'var(--bad)' : '#f2f4f8');
/** 상태 아이콘 (SVG, 상자 크기에 맞춰 늘어남) */
const svg = (d: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON_STUN = svg('M12 1.5l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 15.7l-5.8 3.6 1.6-6.6-5.2-4.4 6.8-.5Z');
const ICON_FEAR = svg('M10 3h4l-.8 12h-2.4Zm2 14.5a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z');
const DROP = 'M12 2.5C9 7 6 10.4 6 14a6 6 0 0 0 12 0c0-3.6-3-7-6-11.5Z';
const TOP_ICON: Record<string, { t: string; svg: string }> = {
  shock: { t: '감전: 기술 쿨다운 정지', svg: svg('M13.5 2 5 13.5h5.5L9 22l9-12h-5.6Z') },
  bleed: { t: '출혈: 지속 물리 피해', svg: svg(DROP) },
  poison: { t: '중독: 지속 화학 피해', svg: svg(DROP) },
  dot: { t: '지속 피해', svg: svg(DROP) },
  judge: { t: '심판: 받은 피해 기록', svg: svg('M11 3h2v2.2l6 1.6-.5 1.9-.6-.2L21 14a3.5 3.5 0 0 1-7 0l2.9-5.6L13 7.3V19h4v2H7v-2h4V7.3L7.1 8.4 10 14a3.5 3.5 0 0 1-7 0l3.1-5.5-.6.2L5 6.8l6-1.6Zm-5 7.7L4.5 14h3Zm12 0L16.5 14h3Z') },
  corrode: { t: '침식 · 부식: 방어도 감소', svg: svg('M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Zm1 4-2 5h3l-3 7 1-5H9Z') },
  slow: { t: '둔화: 공격 · 이동 속도 감소', svg: svg('M6 2h12v4l-4 6 4 6v4H6v-4l4-6-4-6Zm3 2v1.4L12 10l3-4.6V4Z') },
  wound: { t: '부상: 회복 · 보호막 차단', svg: svg('M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z') },
  vuln: { t: '취약: 받는 피해 증가', svg: svg('M12 2 2 21h20Zm-1 7h2v6h-2Zm0 8h2v2h-2Z') },
  suppress: { t: '제압: 다음 공격 피해 1', svg: svg('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-6.3 5.1 11.2 11.2A8 8 0 0 1 5.7 7.1Zm12.6 9.8L7.1 5.7A8 8 0 0 1 18.3 16.9Z') },
  // 사이오닉 학파 상태이상
  burn: { t: '연소: 지속 물리 피해 (중첩)', svg: svg('M12 2c1 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.3 2.7-5.6.3 2.2 1.3 3.3 2.4 3.6C11.2 8.2 11 5 12 2Z') },
  conduct: { t: '전도: 행동할 때마다 주변 적에게 전기 피해', svg: svg('M12.5 2 7 11h4l-1.5 7 6.5-9.5h-4L14 2ZM2 20a2 2 0 1 0 4 0 2 2 0 1 0-4 0ZM18 20a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z') },
  chill: { t: '오한: 공격 · 이동 속도 감소 (중첩, 빙결 확률)', svg: svg('M11 2h2v20h-2ZM2 11h20v2H2ZM4.2 5.6 5.6 4.2 19.8 18.4 18.4 19.8ZM18.4 4.2 19.8 5.6 5.6 19.8 4.2 18.4Z') },
  regen: { t: '지속 회복', svg: svg('M20 3C10 3 4 8 4 15c0 2 .6 3.6 1.4 5L7 18.5C8 13 12 9 16 7c-3.5 3-6 6.5-7 11.5 1 .4 2 .5 3 .5 6 0 9-6 8-16Z') },
  bond: { t: '결속: 받는 피해 증가 · 피해 공유', svg: svg('M3.5 9.5a4 4 0 0 1 5.7-5.7l3 3-1.4 1.4-3-3a2 2 0 0 0-2.9 2.9l3 3-1.4 1.4ZM20.5 14.5a4 4 0 0 1-5.7 5.7l-3-3 1.4-1.4 3 3a2 2 0 0 0 2.9-2.9l-3-3 1.4-1.4ZM8.5 7.1l8.4 8.4-1.4 1.4-8.4-8.4Z') },
  resonance: { t: '공진: 피격될 때마다 주변 적에게 피해', svg: svg('M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM7.05 7.05l1.41 1.41a5 5 0 0 0 0 7.08l-1.41 1.41a7 7 0 0 1 0-9.9ZM16.95 7.05a7 7 0 0 1 0 9.9l-1.41-1.41a5 5 0 0 0 0-7.08ZM4.22 4.22l1.42 1.42a9 9 0 0 0 0 12.72l-1.42 1.42a11 11 0 0 1 0-15.56ZM19.78 4.22a11 11 0 0 1 0 15.56l-1.42-1.42a9 9 0 0 0 0-12.72Z') },
  confuse: { t: '혼란: 가까운 아무나 공격 (같은 편 포함)', svg: svg('M12 3a9 9 0 1 0 9 9h-2.2A6.8 6.8 0 1 1 12 5.2a4.6 4.6 0 1 1-4.6 4.6H5.2A6.8 6.8 0 1 0 12 3Zm0 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z') },
  scent: { t: '향취: 회피 감소 · 받는 피해 증가', svg: svg('M11 2c-1.5 2 1.5 3.5 0 5.5s1.5 3.5 0 5.5h2c1.5-2-1.5-3.5 0-5.5S11.5 4 13 2ZM7 15h10l-1.5 7h-7Z') },
};
const ICON_FREEZE = svg('M12 1.5 21 6.75v10.5L12 22.5 3 17.25V6.75Zm0 4L7 8.4v7.2l5 2.9 5-2.9V8.4Z');
const ICON_CHARM = svg('M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.7 12 21 12 21Z');
const BIG_ICON: Record<string, [string, string]> = { stun: [ICON_STUN, '기절: 행동 불가'], fear: [ICON_FEAR, '공포: 공격 · 기술 불가'], freeze: [ICON_FREEZE, '빙결: 행동 불가'], charm: [ICON_CHARM, '매혹: 잠시 상대 편으로 싸움'] };
/** 사이오닉 학파 (엔진 필드가 없을 때도 안전하게) */
const schoolOfC = (u: CUnit): string | null => (u as { school?: string | null }).school ?? null;
/** 이성 막대 디자인: 정신은 기존 초월 막대를 쓴다 */
const barOf = (sc: string) => (sc === 'mind' ? 'trans' : sc);
const hasKey = (u: CUnit, k: string) => u.statuses.some((s) => s.key === k && s.dur > 0);
const inFrenzy = (u: CUnit) => !!u.mem.frenzy || u.statuses.some((s) => s.key === 'frenzy');
const PSI_TOP: Record<string, 1> = { burn: 1, conduct: 1, chill: 1, regen: 1, bond: 1, resonance: 1, confuse: 1, scent: 1 };
/** 위쪽 아이콘 줄에 올릴 상태 (기절 · 공포는 중앙, 암운 · 분석은 아래 중첩 표식) */
function topIconKey(st: { key: string; type: string; taken?: { kind: string }[]; elem?: string }): string | null {
  if (st.key === 'shock' || st.key === 'bleed' || st.key === 'poison' || st.key === 'slow' || st.key === 'wound' || st.key === 'suppress' || st.key in PSI_TOP) return st.key;
  if (st.key === 'franze.judge') return 'judge';
  if (st.key === 'corrode' || st.key === 'decay') return 'corrode';
  if (st.key === 'gloom' || st.key === 'vivian.shred' || st.key === 'stun' || st.key === 'fear' || st.key === 'freeze' || st.key === 'charm') return null;
  if (st.type === 'dot') return 'dot';
  if (st.taken?.some((t) => t.kind === 'vuln')) return 'vuln';
  return null;
}
// ───────── 필드 상태 토큰: 디버프 = 왼쪽 세로 줄 (빨간 테두리) · 버프 = 오른쪽 세로 줄 (파란 테두리)
// 같은 아이콘 종류는 한 칸으로 합치고 (중첩 · 개수 합을 숫자로), 한 줄에 최대 3칸 (넘치면 2칸 + '+n').
// 순서: 전투 내내 가는 효과는 뒤로 → 중요도(STS_W) 높은 것 → 남은 지속이 짧은 것.
const UP = 'M12 3 4 11h5v10h6V11h5Z';
const STS_ICON: Record<string, { t: string; svg: string }> = {
  gloom: { t: '암운: 매초 고정 피해 (중첩)', svg: svg('M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 7.5 4.5 4.5 0 0 1 17.5 18Z') },
  shred: { t: '방어 분석: 방어도 감소 (중첩)', svg: svg('M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Zm-1 5h2v6h-2Zm0 8h2v2h-2Z') },
  weak: { t: '약화: 주는 피해 · 위력 감소', svg: svg('M12 21 4 13h5V3h6v10h5Z') },
  down: { t: '해로운 효과', svg: svg('M12 21 4 13h5V3h6v10h5Z') },
  power: { t: '강화: 주는 피해 · 위력 증가', svg: svg('M14.5 2 21 2v6.5l-9.8 9.8 1.4 1.4-1.4 1.4-2.8-2.8L5.6 21.1 2.9 18.4l2.8-2.8-2.8-2.8 1.4-1.4 1.4 1.4Z') },
  guard: { t: '보호: 받는 피해 감소 · 방어 증가', svg: svg('M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z') },
  haste: { t: '가속: 공격 · 이동 · 쿨다운 가속', svg: svg('M4 5h3l6 7-6 7H4l6-7Zm7 0h3l6 7-6 7h-3l6-7Z') },
  regen: TOP_ICON.regen,
  up: { t: '이로운 효과', svg: svg(UP) },
};
const STS_W: Record<string, number> = {
  confuse: 9, shock: 9, suppress: 8, wound: 7, vuln: 7, judge: 6, bond: 6, burn: 5, bleed: 5, poison: 5, dot: 5, chill: 5, slow: 5,
  corrode: 4, shred: 4, gloom: 4, conduct: 3, resonance: 3, scent: 3, weak: 3, down: 1,
  guard: 5, regen: 4, power: 4, haste: 3, up: 1,
};
const CENTER_KEYS = new Set(['stun', 'fear', 'freeze', 'charm', 'frenzy']);
const ATK_KEYS = ['shoot', 'strike', 'tech', 'crit', 'critDmg', 'armorPen', 'acc', 'effHit'];
const DEF_KEYS = ['armor', 'effRes', 'maxHp', 'eva'];
const SPD_KEYS = ['atkSpd', 'moveSpd', 'cdr', 'reloadSpd'];
type StsTok = { k: string; n: number; w: number; dur: number; names: string[] };
/** 상태 하나 → [디버프?, 아이콘 종류] (보여 줄 것이 없으면 null) */
function stsKind(u: CUnit, s: Status): [boolean, string] | null {
  if (s.dur <= 0 || CENTER_KEYS.has(s.key) || s.share === u) return null;
  let good = 0, bad = 0, atk = 0, def = 0, spd = 0;
  const add = (v: number, k: 'a' | 'd' | 's' | '') => { if (!v) return; if (v > 0) good++; else bad++; if (v > 0) { if (k === 'a') atk++; else if (k === 'd') def++; else if (k === 's') spd++; } };
  for (const [k, v] of Object.entries(s.delta || {})) add(v as number, ATK_KEYS.includes(k) ? 'a' : DEF_KEYS.includes(k) ? 'd' : SPD_KEYS.includes(k) ? 's' : '');
  if (s.armorMul !== undefined && s.armorMul !== 1) add(s.armorMul - 1, 'd');
  for (const m of s.mods || []) add(m.v, 'a');
  for (const t of s.taken || []) add(t.kind === 'red' ? t.v : -t.v, 'd');
  if (s.reflect || s.reflectTrue || (s.share && s.share !== u)) { good++; def++; }
  if (s.hps) good++;
  if (s.healMul !== undefined && s.healMul < 1) bad++;
  if (s.dps) bad++;
  const foe = !!s.src && s.src.side !== u.side;
  const harm = isHarmful(s) || (bad > 0 && !good) || (bad > 0 && good > 0 && foe) || (!bad && !good && foe);
  if (harm) {
    if (s.key === 'gloom') return [true, 'gloom'];
    if (s.key === 'vivian.shred') return [true, 'shred'];
    const k = topIconKey(s);
    if (k) return [true, k];
    if (s.armorMul !== undefined && s.armorMul < 1 || Object.entries(s.delta || {}).some(([k2, v]) => k2 === 'armor' && (v as number) < 0)) return [true, 'corrode'];
    if (Object.entries(s.delta || {}).some(([k2, v]) => SPD_KEYS.includes(k2) && (v as number) < 0)) return [true, 'slow'];
    if ((s.mods || []).some((m) => m.v < 0) || Object.entries(s.delta || {}).some(([k2, v]) => ATK_KEYS.includes(k2) && (v as number) < 0)) return [true, 'weak'];
    return [true, 'down'];
  }
  if (!good && !s.label) return null; // 효과 없는 내부 표식
  return [false, s.hps ? 'regen' : atk ? 'power' : def ? 'guard' : spd ? 'haste' : 'up'];
}
/** 기물의 상태를 디버프 · 버프 토큰으로 묶는다 (우선순위 순) */
function statusTokens(u: CUnit): { deb: StsTok[]; buf: StsTok[] } {
  const deb = new Map<string, StsTok>(), buf = new Map<string, StsTok>();
  for (const s of u.statuses) {
    const r = stsKind(u, s);
    if (!r) continue;
    const m = r[0] ? deb : buf;
    const t = m.get(r[1]) || { k: r[1], n: 0, w: STS_W[r[1]] ?? 1, dur: Infinity, names: [] };
    t.n += Math.max(1, s.stacks || 1);
    t.dur = Math.min(t.dur, s.dur);
    if (s.label && !t.names.includes(s.label)) t.names.push(s.label);
    m.set(r[1], t);
  }
  const ord = (a: StsTok, b: StsTok) => (+(a.dur > 900) - +(b.dur > 900)) || b.w - a.w || a.dur - b.dur || (a.k < b.k ? -1 : 1);
  return { deb: [...deb.values()].sort(ord), buf: [...buf.values()].sort(ord) };
}
const STS_MAX = 3;
const tokSig = (l: StsTok[]) => l.slice(0, STS_MAX).map((t) => `${t.k}${t.n}`).join(',') + (l.length > STS_MAX ? `+${l.length}` : '');
function tokHtml(l: StsTok[]) {
  const show = l.length > STS_MAX ? l.slice(0, STS_MAX - 1) : l;
  const rest = l.slice(show.length);
  const ic = (t: StsTok) => { const d = STS_ICON[t.k] || TOP_ICON[t.k]; return `<i class="sts-${t.k}" title="${d.t}${t.names.length ? ` (${t.names.join(', ')})` : ''}">${d.svg}${t.n > 1 ? `<b>${t.n > 99 ? '99' : t.n}</b>` : ''}</i>`; };
  return show.map(ic).join('') + (rest.length ? `<i class="sts-more" title="${rest.map((t) => (STS_ICON[t.k] || TOP_ICON[t.k]).t.split(':')[0]).join(', ')}">+${rest.length}</i>` : '');
}
/** 디바인 신권 대행 컷인 대사 */
const DIV_LINE: Record<string, string> = {
  eleni: '셀레네시여, 이 길을 비춰 주소서.', iris: '헤르메스님, 지금이에요! 날개를!', odysseus: '돌아왔다. 이번에도.',
  kyle: '적진이 곧 나의 제단이다.', doros: '기도는 짧게. 다 같이, 드시죠.', fotini: '여러분~ 지금부터가 하이라이트입니다 ^^',
  reika: '다들 봐 줘~ 이게 진짜 피날레야☆', skadi: '배당금은 지금 지급합니다.', thermo: '물러서지 않는다.',
};
const SHAKE: Keyframe[] = [{ translate: '0 0' }, { translate: '-6px 3px' }, { translate: '5px -4px' }, { translate: '-4px -2px' }, { translate: '3px 3px' }, { translate: '-1px 1px' }, { translate: '0 0' }];
const SKULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 3 5.6 3 10.2c0 2.7 1.3 4.6 3 5.8V19a1 1 0 0 0 1 1h1.5v-2h1.5v2h4v-2h1.5v2H17a1 1 0 0 0 1-1v-3c1.7-1.2 3-3.1 3-5.8C21 5.6 17.5 2 12 2Zm-3.5 11.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm7 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4ZM12 13.6l1.3 2.2h-2.6Z"/></svg>';
const flightOf = (d: number) => Math.min(0.26, 0.07 + 0.035 * d);
// 곡선: 급하게 출발해 감속 (선형 대신)
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
const EASE_IN = 'cubic-bezier(.5, 0, .9, .5)';
const EASE_SHOT = 'cubic-bezier(.3, .7, .6, 1)';
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** 연출 설정 (설정 메뉴에서 바꿈): 이펙트 · 숫자 지속 ms, 스킬 연출 ms, 모션 속도 */
export type MotionPreset = 'fast' | 'mid' | 'slow';
/** 사망 연출 6종 (DEATH_STYLES). 처형은 설정과 무관하게 항상 갈라짐 + 해골 */
export type DeathStyle = 'spin' | 'fade' | 'shatter' | 'glitch' | 'vapor' | 'soul';
/** 궁극기 컷인: 전체 · 짧게 · 끄기 */
export type UltCut = 'full' | 'short' | 'off';
export const FX = { fxMs: 1200, skillMs: 1800, motion: 'mid' as MotionPreset, death: 'spin' as DeathStyle, ultCut: 'full' as UltCut };
export const FX_DEFAULT = { fxMs: 1200, skillMs: 1800, motion: 'mid' as MotionPreset, death: 'spin' as DeathStyle, ultCut: 'full' as UltCut };
/** 모션 프리셋: 날렵 · 보통 (날렵 6 : 느긋 4) · 느긋 */
const MOTION: Record<MotionPreset, { mul: number; ein: string; eout: string; peak: (p: number) => number; cell: (t: number) => number }> = {
  fast: { mul: 1, ein: EASE_IN, eout: EASE_OUT, peak: (p) => p, cell: easeOut },
  mid: { mul: 1.3, ein: 'cubic-bezier(.4, 0, .7, .6)', eout: 'cubic-bezier(.2, .64, .28, 1)', peak: (p) => p * 0.6 + 0.4 * 0.4, cell: (t) => 0.6 * easeOut(t) + 0.4 * Math.max(0, Math.min(1, t)) },
  slow: { mul: 1.7, ein: 'ease-in-out', eout: 'ease-out', peak: () => 0.4, cell: (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); } },
};
const motion = () => MOTION[FX.motion] || MOTION.mid;
/** 이펙트 지속 배율 (기본 900ms = 1) */
const fxK = () => Math.max(0.2, FX.fxMs / 900);
const skK = () => Math.max(0.2, FX.skillMs / 1500);

// ───────── 사망 연출 (전투 화면 · 설정 미리보기 공용)
/** 설정 메뉴용 이름 · 한 줄 설명 (순서 = 선택지 순서) */
export const DEATH_STYLES: { id: DeathStyle; name: string; desc: string }[] = [
  { id: 'spin', name: '휘리릭', desc: '맞은 반대쪽으로 낮은 포물선을 그리며 회전하며 날아감' },
  { id: 'fade', name: '스르륵', desc: '일섬 한 줄 → 짧은 정지 → 카드가 위아래로 닫히며 꺼짐' },
  { id: 'shatter', name: '파쇄', desc: '금이 간 카드가 여섯 조각으로 터져 흩어지며 떨어짐' },
  { id: 'glitch', name: '소거', desc: '신호가 깨지며 화면이 어긋나다 브라운관처럼 한 점으로 꺼짐' },
  { id: 'vapor', name: '증발', desc: '하얗게 타오르는 섬광 뒤 입자가 되어 위로 흩어짐' },
  { id: 'soul', name: '이탈', desc: '몸이 잿빛으로 가라앉고 보랏빛 혼이 빠져나가 떠오름' },
];
export const isDeathStyle = (v: unknown): v is DeathStyle => DEATH_STYLES.some((d) => d.id === v);
/** 연출 환경: el = 사라질 기물(카드), spawn = 카드 크기 · 카드 중앙에 놓이는 연출 요소 (ms 는 1배 기준) */
export interface DeathCtx {
  el: HTMLElement; img: string; pixel: boolean; sx: number;
  play(el: Element, kf: Keyframe[], ms: number, opt?: KeyframeAnimationOptions): Animation | null;
  spawn(cls: string, kf: Keyframe[], ms: number, opt?: KeyframeAnimationOptions, html?: string): HTMLElement;
}
const C0 = 'translate(-50%,-50%)';
/** 사망 연출 실행. 반환: 기물 본체 애니메이션 (끝나면 숨김). 처형 · 모션 감소는 호출 쪽에서 처리 */
export function deathFx(style: DeathStyle, x: DeathCtx): Animation | null {
  const pic = (cls = '') => `<img alt="" class="${x.pixel ? 'px' : ''} ${cls}" src="${x.img}">`;
  switch (style) {
    case 'spin': {
      // 휘리릭: 맞은 반대쪽으로 낮게 튀어 올랐다가 아래로 떨어지며 화면 밖으로 (회전)
      const rot = x.sx * 900;
      const t0 = 0.22, A = 95 / (t0 * t0), B = -2 * A * t0; // 포물선: t=0.22 에서 최고점 -95%, 끝에서 +1100%
      const kf: Keyframe[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        kf.push({ transform: `translate(${(x.sx * 420 * t).toFixed(1)}%, ${(A * t * t + B * t).toFixed(1)}%) rotate(${(rot * t).toFixed(0)}deg) scale(${(1 - 0.2 * t).toFixed(2)})`, opacity: 1, offset: t });
      }
      return x.play(x.el, kf, 1000, { fill: 'forwards', easing: 'linear' });
    }
    case 'fade': {
      // 스르륵: 일섬 (0.09초) → 히트스톱 (흰 섬광으로 0.1초 정지) → 위아래로 닫혀 가로 한 줄 → 한 점으로 꺼짐
      const ang = x.sx > 0 ? -24 : 24;
      x.spawn('dslash', [
        { transform: `${C0} rotate(${ang}deg) scaleX(0)`, opacity: 1, easing: 'cubic-bezier(.1,.9,.2,1)' },
        { transform: `${C0} rotate(${ang}deg) scaleX(1.25)`, opacity: 1, offset: 0.12 },
        { transform: `${C0} rotate(${ang}deg) scaleX(1.25)`, opacity: 1, offset: 0.26, easing: 'ease-in' },
        { transform: `${C0} rotate(${ang}deg) scaleX(1.25) scaleY(0)`, opacity: 0, offset: 0.4 },
        { transform: `${C0} rotate(${ang}deg) scaleX(1.25) scaleY(0)`, opacity: 0 },
      ], 760);
      return x.play(x.el, [
        { transform: 'none', filter: 'none', opacity: 1 },
        { transform: 'none', filter: 'none', opacity: 1, offset: 0.11, easing: 'steps(1, end)' },
        { transform: 'translateX(0)', filter: 'brightness(2.4) contrast(1.4)', opacity: 1, offset: 0.12 },
        { transform: 'translateX(0)', filter: 'brightness(2.4) contrast(1.4)', opacity: 1, offset: 0.25, easing: 'cubic-bezier(.7,0,.9,.4)' },
        { transform: 'scale(1.04, .05)', filter: 'brightness(4)', opacity: 1, offset: 0.46, easing: 'cubic-bezier(.7,0,.9,.4)' },
        { transform: 'scale(0, .05)', filter: 'brightness(4)', opacity: 1, offset: 0.6 },
        { transform: 'scale(0, 0)', filter: 'brightness(4)', opacity: 0 },
      ], 760, { fill: 'forwards' });
    }
    case 'shatter': {
      // 파쇄: 금이 간 채 0.08초 멈췄다가 여섯 조각이 바깥으로 터지며 떨어진다 (중앙 충격파 1)
      const C = [52, 46];
      const parts: number[][][] = [
        [[0, 0], [55, 0]], [[55, 0], [100, 0], [100, 40]], [[100, 40], [100, 100], [70, 100]],
        [[70, 100], [25, 100]], [[25, 100], [0, 100], [0, 60]], [[0, 60], [0, 0]],
      ];
      parts.forEach((pts, i) => {
        const poly = [C, ...pts];
        const cx = poly.reduce((a2, q) => a2 + q[0], 0) / poly.length - C[0], cy = poly.reduce((a2, q) => a2 + q[1], 0) / poly.length - C[1];
        const l = Math.hypot(cx, cy) || 1, dx = (cx / l) * (70 + (i % 3) * 18) + x.sx * 25, dy = (cy / l) * 60;
        const r = (cx >= 0 ? 1 : -1) * (40 + i * 23);
        const d = x.spawn('dfx dshard', [
          { transform: C0, filter: 'brightness(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${(cx / l) * 3}%), calc(-50% + ${(cy / l) * 3}%))`, filter: 'brightness(1.8)', opacity: 1, offset: 0.08, easing: 'steps(1, end)' },
          { transform: `translate(calc(-50% + ${(cx / l) * 3}%), calc(-50% + ${(cy / l) * 3}%))`, filter: 'brightness(1.8)', opacity: 1, offset: 0.16, easing: 'cubic-bezier(.15,.8,.3,1)' },
          { transform: `translate(calc(-50% + ${dx * 0.7}%), calc(-50% + ${dy * 0.7 - 10}%)) rotate(${r * 0.6}deg)`, filter: 'brightness(1)', opacity: 1, offset: 0.55, easing: 'ease-in' },
          { transform: `translate(calc(-50% + ${dx}%), calc(-50% + ${dy + 70}%)) rotate(${r}deg)`, filter: 'brightness(.6)', opacity: 0 },
        ], 1050, {}, pic());
        d.style.clipPath = `polygon(${poly.map((q) => `${q[0]}% ${q[1]}%`).join(',')})`;
      });
      x.spawn('dring', [{ transform: `${C0} scale(.2)`, opacity: 0 }, { transform: `${C0} scale(.2)`, opacity: 1, offset: 0.1 }, { transform: `${C0} scale(1.5)`, opacity: 0, offset: 0.45 }, { transform: `${C0} scale(1.5)`, opacity: 0 }], 1050);
      return x.play(x.el, [{ opacity: 0 }, { opacity: 0 }], 1050, { fill: 'forwards' });
    }
    case 'glitch': {
      // 소거: 색이 갈라지며 띠가 어긋나는 신호 오류 (0.45초) → 세로로 눌려 가로 한 줄 → 한 점 → 꺼짐
      const j = [[3, 0], [-4, 1], [2, -1], [-2, 0], [5, 0], [-3, -1], [0, 0]];
      const kf: Keyframe[] = j.map(([dx, dy], i) => ({ transform: `translate(${dx}%, ${dy}%)`, filter: i % 2 ? 'hue-rotate(160deg) saturate(3) contrast(1.6)' : 'saturate(.4) brightness(1.4)', opacity: i === 3 ? 0.55 : 1, offset: (i / j.length) * 0.45, easing: 'steps(1, end)' }));
      kf.push({ transform: 'scale(1, 1)', filter: 'brightness(2.2) saturate(0)', opacity: 1, offset: 0.46, easing: 'cubic-bezier(.8,0,.9,.3)' },
        { transform: 'scale(1.08, .03)', filter: 'brightness(4) saturate(0)', opacity: 1, offset: 0.62, easing: 'cubic-bezier(.8,0,.9,.3)' },
        { transform: 'scale(.03, .03)', filter: 'brightness(5) saturate(0)', opacity: 1, offset: 0.78 },
        { transform: 'scale(0, 0)', filter: 'brightness(5) saturate(0)', opacity: 0 });
      const bands = [[12, 70], [44, 42], [72, 14]];
      bands.forEach(([t, b], i) => {
        const sh = (i % 2 ? -1 : 1) * (9 + i * 4);
        const d = x.spawn('dfx dglitch', [
          { transform: C0, opacity: 0, easing: 'steps(1, end)' },
          { transform: `translate(calc(-50% + ${sh}%), -50%)`, opacity: 0.9, offset: 0.06 + i * 0.05, easing: 'steps(1, end)' },
          { transform: `translate(calc(-50% + ${-sh * 0.6}%), -50%)`, opacity: 0.9, offset: 0.2 + i * 0.05, easing: 'steps(1, end)' },
          { transform: `translate(calc(-50% + ${sh * 1.4}%), -50%)`, opacity: 0.8, offset: 0.33 + i * 0.03, easing: 'steps(1, end)' },
          { transform: C0, opacity: 0, offset: 0.45 },
          { transform: C0, opacity: 0 },
        ], 950, {}, pic());
        d.style.clipPath = `inset(${t}% 0 ${b}% 0)`;
      });
      return x.play(x.el, kf, 950, { fill: 'forwards' });
    }
    case 'vapor': {
      // 증발: 0.1초 만에 하얗게 타오르고 (섬광) 위로 번지며 흩어진다 + 입자 6
      x.spawn('dflash', [{ transform: `${C0} scale(.4)`, opacity: 0 }, { transform: `${C0} scale(1.25)`, opacity: 1, offset: 0.1 }, { transform: `${C0} scale(1.6)`, opacity: 0, offset: 0.4 }, { transform: `${C0} scale(1.6)`, opacity: 0 }], 1100);
      for (let i = 0; i < 6; i++) {
        const px = 14 + i * 14 + ((i * 37) % 9), py = 40 + ((i * 53) % 40), rise = 90 + ((i * 29) % 60), drift = ((i % 3) - 1) * 18 + x.sx * 6;
        const d = x.spawn('dmote', [
          { transform: C0, opacity: 0 },
          { transform: C0, opacity: 0, offset: 0.14 + i * 0.03 },
          { transform: 'translate(-50%, calc(-50% - 10%))', opacity: 1, offset: 0.28 + i * 0.03, easing: 'cubic-bezier(.2,.6,.4,1)' },
          { transform: `translate(calc(-50% + ${drift}%), calc(-50% - ${rise}%)) scale(.4)`, opacity: 0 },
        ], 1100);
        d.style.setProperty('--mx', `${px}%`); d.style.setProperty('--my', `${py}%`);
      }
      return x.play(x.el, [
        { transform: 'none', filter: 'none', opacity: 1, easing: 'ease-out' },
        { transform: 'scale(1.06)', filter: 'brightness(4) saturate(0)', opacity: 1, offset: 0.1 },
        { transform: 'scale(1.06)', filter: 'brightness(4) saturate(0)', opacity: 1, offset: 0.2, easing: 'cubic-bezier(.3,0,.6,1)' },
        { transform: 'translateY(-14%) scale(.92, 1.12)', filter: 'brightness(3) saturate(0) blur(3px)', opacity: 0.35, offset: 0.62 },
        { transform: 'translateY(-22%) scale(.8, 1.25)', filter: 'brightness(3) saturate(0) blur(6px)', opacity: 0 },
      ], 1100, { fill: 'forwards' });
    }
    case 'soul': {
      // 이탈: 몸은 잿빛으로 가라앉고, 보랏빛 혼(초상 잔상)이 일렁이며 떠올라 사라진다 + 사이오닉 고리
      x.spawn('dfx dsoul', [
        { transform: `${C0} scale(1)`, opacity: 0 },
        { transform: `${C0} scale(1.02)`, opacity: 0.85, offset: 0.16, easing: 'ease-out' },
        { transform: 'translate(calc(-50% + 6%), calc(-50% - 40%)) scale(1.12)', opacity: 0.65, offset: 0.5, easing: 'ease-in-out' },
        { transform: 'translate(calc(-50% - 5%), calc(-50% - 85%)) scale(1.22)', opacity: 0.3, offset: 0.78, easing: 'ease-in' },
        { transform: 'translate(-50%, calc(-50% - 120%)) scale(1.3, 1.5)', opacity: 0 },
      ], 1150, {}, pic());
      x.spawn('dring psi', [{ transform: `${C0} scale(.5)`, opacity: 0 }, { transform: `${C0} scale(.6)`, opacity: 1, offset: 0.14 }, { transform: `${C0} scale(1.45)`, opacity: 0, offset: 0.55 }, { transform: `${C0} scale(1.45)`, opacity: 0 }], 1150);
      return x.play(x.el, [
        { transform: 'none', filter: 'none', opacity: 1 },
        { transform: 'none', filter: 'grayscale(1) brightness(.55)', opacity: 1, offset: 0.16, easing: 'ease-in' },
        { transform: 'translateY(8%) scale(.96)', filter: 'grayscale(1) brightness(.35)', opacity: 0.6, offset: 0.6 },
        { transform: 'translateY(14%) scale(.92)', filter: 'grayscale(1) brightness(.2)', opacity: 0 },
      ], 1150, { fill: 'forwards' });
    }
  }
}
/** 설정 미리보기: host 안의 .dpv-card 를 대상으로 연출을 한 번 재생 */
export function previewDeath(host: HTMLElement, style: DeathStyle) {
  const card = host.querySelector<HTMLElement>('.dpv-card');
  const img = card?.querySelector('img');
  if (!card || !img) return;
  for (const a of card.getAnimations()) a.cancel();
  host.querySelectorAll('.dpv-fx').forEach((n) => n.remove());
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const k = fxK();
  const play = (el: Element, kf: Keyframe[], ms: number, opt: KeyframeAnimationOptions = {}) => (el.animate ? el.animate(kf, { duration: ms * k, ...opt }) : null);
  const a = deathFx(style, {
    el: card, img: img.src, pixel: false, sx: 1, play,
    spawn(cls, kf, ms, opt = {}, html = '') {
      const d = document.createElement('div');
      d.className = `${cls} dpv-fx`;
      d.style.left = '50%'; d.style.top = '50%'; d.style.width = `${card.offsetWidth}px`; d.style.height = `${card.offsetHeight}px`;
      if (html) d.innerHTML = html;
      host.appendChild(d);
      const an = play(d, kf, ms, { fill: 'both', ...opt });
      if (an) { const rm = () => d.remove(); an.finished.then(rm, rm); } else d.remove();
      return d;
    },
  });
  // 끝나면 잠시 뒤 카드를 되살린다
  const back = () => setTimeout(() => { for (const an of card.getAnimations()) an.cancel(); }, 450);
  if (a) a.finished.then(back, back);
}

/** 표시 우선순위: 0 일반 숫자 · 1 스킬 피해 · 범위 · 2 스킬명 · 부활 · 상태이상 (생략하지 않음) */
type Prio = 0 | 1 | 2;

/** 전투를 실시간으로 진행하며 보드 위 DOM 을 갱신한다.
 *  행동마다 '시전자 → 전달 → 대상 반응' 을 보여 주고, 탄환 · 표식이 닿는 순간에 피해 숫자 · 체력 변화 · 사망을 맞춘다 */
export class BattleView {
  private _speed = 1;
  private els = new Map<number, UEl>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  /** 연출 시계 (게임 초) */
  private vt = 0;
  private overAt = -1;
  private fxLayer: HTMLElement;
  private svg: SVGSVGElement;
  private ended = false;
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** 늦게 보여 줄 일 (표시 시각 순) */
  private q: { at: number; fn: () => void }[] = [];
  /** 아직 표시하지 않은 체력 · 보호막 변화 (실제값 − 이것 = 화면값) */
  private lagHp = new Map<number, number>();
  private lagSh = new Map<number, number>();
  private pendN = new Map<number, number>();
  /** 이 기물에게 날아가는 탄환이 닿는 시각 (연쇄 탄환은 그 다음에 출발) */
  private projLand = new Map<number, number>();
  private anims = new Set<Animation>();
  private merges = new Map<string, { el: HTMLElement; v: number; until: number; fmt: (v: number) => string }>();
  private castSeen = new Set<number>();
  /** 종료 연출: 시간 배율 · 마지막 쓰러진 기물 */
  private slowMul = 1;
  /** 궁극기 컷인 감속 · 대기열 */
  private cutMul = 1;
  private cutQ: { u: CUnit; name: string; line: string; theme: { pat: string; c1: string; c2: string; txt: string }; label: string }[] = [];
  private cutEnd = -1;
  private cutEl: HTMLElement | null = null;
  private finaleHit = -1;
  private rt = 0;
  private syncVt = 0;
  private lastDown: number | null = null;
  private executed = new Set<number>();
  private lastHitFrom = new Map<number, number>();
  private lanes = new Map<number, number>();
  private statusSeen = new Map<string, number>();
  private logs = new Map<number, ActLine[]>();
  /** 장비 아이콘 HTML (main 에서 주입) */
  itemHtml: (id: string) => string = () => '';

  constructor(private board: HTMLElement, public b: Battle, private onTick: () => void, private onEnd: () => void) {
    this.fxLayer = document.createElement('div');
    this.fxLayer.className = 'fx-layer';
    board.appendChild(this.fxLayer);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'focus-lines');
    this.svg.setAttribute('viewBox', '0 0 100 100');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    board.appendChild(this.svg);
    for (const u of b.units) this.mount(u);
    this.sync();
  }

  get speed() { return this._speed; }
  /** 0 = 정지. 진행 중인 연출도 같은 배율로 느려지거나 멈춘다 */
  set speed(v: number) {
    this._speed = v;
    for (const a of this.anims) this.rateOf(a);
  }
  private rateOf(a: Animation) {
    const text = (a as Animation & { text?: boolean | 'ui' }).text;
    if (this._speed === 0) { a.pause(); return; }
    const sp = this._speed * this.slowMul * this.cutMul;
    // ui: 컷인처럼 배속과 무관하게 실시간 (정지만 따름)
    a.playbackRate = text === 'ui' ? 1 : text ? Math.max(0.3, Math.min(2, sp)) : sp;
    if (a.playState === 'paused') a.play();
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const adv = dt * this._speed * this.slowMul * this.cutMul;
      if (this._speed > 0) this.rt += dt; // 정지 중에는 멈추는 실시간 시계 (종료 연출용)
      if (this.cutEnd >= 0 && this.rt >= this.cutEnd) { this.endCut(); this.nextCut(); }
      this.acc += adv;
      this.vt += adv;
      let steps = 0;
      while (this.acc >= CFG.tick && !this.b.over && steps < 200) { this.b.step(CFG.tick); this.acc -= CFG.tick; steps++; }
      this.drain();
      this.flush();
      this.sync();
      this.onTick();
      if (this.b.over) {
        if (this.overAt < 0) { this.overAt = this.vt; this.cutQ.length = 0; this.endCut(); this.finaleStart(); }
        // 마지막 탄환 · 표식이 닿으면 흔들림 + 종료 배너, 잠시 뒤 보고서로
        if (this.finaleHit < 0 && (!this.q.length || this.vt - this.overAt > 1.2)) { this.flush(true); this.sync(); this.finaleImpact(); }
        if (this.finaleHit >= 0 && this.slowMul < 1 && this.rt - this.finaleHit > 0.9) { this.slowMul = 1; for (const a of this.anims) this.rateOf(a); } // 배너가 뜬 뒤 감속 해제
        if (this.finaleHit >= 0 && this.rt - this.finaleHit > (this.b.keepEvents && !this.reduced ? 1.7 : 0)) { this.finish(); return; }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  skip() {
    this.cutQ.length = 0; this.endCut();
    this.b.keepEvents = false;
    this.b.events.length = 0;
    this.b.runToEnd();
    this.flush(true);
    this.sync();
    this.finish();
  }

  destroy() { cancelAnimationFrame(this.raf); for (const a of this.anims) a.cancel(); this.anims.clear(); }

  /** 상세 정보로 보고 있는 기물 표시 */
  private selId: number | null = null;
  select(id: number | null) {
    if (id === this.selId) return;
    if (this.selId !== null) this.els.get(this.selId)?.el.classList.remove('sel');
    if (id !== null) this.els.get(id)?.el.classList.add('sel');
    this.selId = id;
    this.board.classList.toggle('has-focus', id !== null);
    this.drawFocus();
  }

  /** 선택 기물의 최근 행동 (최신 순, 최대 n개) */
  recent(id: number, n = 3): ActLine[] { return (this.logs.get(id) || []).slice(-n).reverse(); }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.onTick();
    setTimeout(() => this.onEnd(), 0);
  }

  private pos(x: number, y: number) {
    return { left: `${(x / this.b.w) * 100}%`, top: `${(y / this.b.h) * 100}%` };
  }

  private mount(u: CUnit) {
    const el = document.createElement('div');
    const card = hasPortrait(u);
    const turret = card && u.isSummon && u.defId === 'turret'; // 엔지니어 감시 포탑: 우측 상단 '기계' 배지
    el.className = `u side${u.side}${card ? ' tkb' : ''}${turret ? ' has-cat' : ''}${u.big ? ' big' : ''}${u.isBoss ? ' boss' : ''}`;
    el.style.width = `${100 / this.b.w}%`;
    el.style.height = `${100 / this.b.h}%`;
    el.dataset.a = 'bsel';
    el.dataset.v = String(u.id);
    const inner = `<div class="bars"><i class="loss"></i><i class="hp"></i><i class="sh"></i></div><img alt="" class="${card ? 'pt' : ''}" src="${iconURL(u)}"><div class="cd"><i></i></div>${u.side === 0 && u.reason !== null ? `<div class="gx${schoolOfC(u) ? ` sc sc-${barOf(schoolOfC(u)!)}` : ''}"><i></i></div>` : ''}${schoolOfC(u) ? `<div class="cpi" style="--sc:${SCHOOL_BY_ID[schoolOfC(u) as SchoolId]?.color || '#b07cff'}" title="비술 준비"><i class="cpi-ring"></i>${lineIcon(`s.${schoolOfC(u)}`, 'li')}</div>` : ''}${turret ? `<span class="tk-cat cat-mech" title="기계 · 구조물">${lineIcon('k.mech', 'li')}</span>` : ''}<div class="sti sts deb"></div><div class="stc"></div><div class="stk sts buf"></div><div class="rl" hidden title="재장전 중"><i class="rl-ring"></i><svg viewBox="0 0 10 16" aria-hidden="true"><path d="M5 .8C3.4 2.2 2.8 3.8 2.8 5.6V7h4.4V5.6C7.2 3.8 6.6 2.2 5 .8Z"/><rect x="2.8" y="7.8" width="4.4" height="6.2" rx=".5"/><rect x="2.2" y="14.4" width="5.6" height="1.2" rx=".4"/></svg></div>`;
    el.innerHTML = card ? `<div class="tk-card">${inner}</div>` : inner;
    this.board.appendChild(el);
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    this.els.set(u.id, {
      ug: null, ugSig: '',
      el, face: (el.querySelector<HTMLElement>('.tk-card') || q('img')), hp: q('.hp'), loss: q('.loss'), sh: q('.sh'), cd: q('.cd i'), gx: el.querySelector<HTMLElement>('.gx i'), cpi: el.querySelector<HTMLElement>('.cpi'),
      sti: q('.sti'), stc: q('.stc'), stk: q('.stk'), rl: q('.rl'), u, dead: false, trail: 1, trailHold: 0, stiSig: '', stkSig: '', rlMax: 1,
    });
    if (u.ult || u.div !== null) {
      // 테두리 게이지: 12시에서 반시계 방향으로 차오르고, 찰수록 선명해진다
      const ring = document.createElement('div');
      ring.className = `ug ${u.ult ? 'ult' : 'div'}`;
      (el.querySelector<HTMLElement>('.tk-card') || el).appendChild(ring);
      this.els.get(u.id)!.ug = ring;
    }
  }

  // ───────── 표시 시계
  private later(at: number, fn: () => void) {
    if (at <= this.vt) { fn(); return; }
    let i = this.q.length;
    while (i > 0 && this.q[i - 1].at > at) i--;
    this.q.splice(i, 0, { at, fn });
  }
  private flush(all = false) {
    while (this.q.length && (all || this.q[0].at <= this.vt)) this.q.shift()!.fn();
  }
  /** 체력 · 보호막 변화를 at 에 보여 준다 (그때까지 화면은 이전 값) */
  private delta(id: number, dhp: number, dsh: number, at: number, then?: () => void) {
    if (at <= this.vt) { then?.(); return; }
    const add = (m: Map<number, number>, v: number) => m.set(id, (m.get(id) || 0) + v);
    add(this.lagHp, dhp); add(this.lagSh, dsh); add(this.pendN, 1);
    this.later(at, () => { add(this.lagHp, -dhp); add(this.lagSh, -dsh); add(this.pendN, -1); then?.(); });
  }

  private sync() {
    const now = this.vt;
    const dvt = Math.max(0, now - this.syncVt); // 표시 시간 변화량 (정지 중 0, 주사율과 무관)
    this.syncVt = now;
    for (const [id, e] of this.els) {
      const u = e.u;
      let x = u.x, y = u.y;
      if (u.moveT > 0 && u.moveDur > 0) {
        const t = motion().cell(1 - u.moveT / u.moveDur);
        x = u.px + (u.x - u.px) * t;
        y = u.py + (u.y - u.py) * t;
      }
      const p = this.pos(x, y);
      e.el.style.left = p.left;
      e.el.style.top = p.top;
      // 전장 맨 왼쪽 · 오른쪽 열: 상태 줄 · 배지를 카드 안쪽으로 (화면 밖으로 잘리지 않게)
      const edge = u.x <= 0 ? 'l' : u.x >= this.b.w - 1 ? 'r' : '';
      if (e.el.dataset.edge !== edge) { e.el.dataset.edge = edge; e.el.classList.toggle('edge-l', edge === 'l'); e.el.classList.toggle('edge-r', edge === 'r'); }
      const max = this.b.S(u, 'maxHp');
      const hp = Math.max(0, Math.min(max, u.hp - (this.lagHp.get(id) || 0)));
      const sh = Math.max(0, u.shield - (this.lagSh.get(id) || 0));
      const f = hp / max;
      // 손실 구간: 잠깐 머문 뒤 줄어든다
      if (f < e.trail) { if (e.trailHold <= 0) e.trailHold = now + 0.35; if (now >= e.trailHold) e.trail = Math.max(f, e.trail - 1.2 * dvt); }
      else { e.trail = f; e.trailHold = 0; }
      e.hp.style.width = `${f * 100}%`;
      e.loss.style.width = `${e.trail * 100}%`;
      e.sh.style.width = `${Math.min(100, (sh / max) * 100)}%`;
      e.cd.style.width = u.cdMax ? `${Math.max(0, Math.min(100, (1 - u.cd / u.cdMax) * 100))}%` : '0';
      if (e.gx) {
        // 사이오닉 이성(보라, -100~100) / 디바인 신성력(금색, 0~100)
        if (u.reason !== null) {
          const sc = schoolOfC(u), fz = inFrenzy(u);
          if (sc) {
            // 학파 막대: 가운데가 0, 고이성은 위(오른쪽) · 저이성은 아래(왼쪽)로 채움
            const r = Math.max(-1, Math.min(1, u.reason / 100)), g = e.gx.parentElement!;
            g.style.setProperty('--a', '0%');
            g.style.setProperty('--w', `${(r + 1) * 50}%`);
            g.style.setProperty('--k', Math.abs(r).toFixed(2));
            const mode = fz ? 'frz' : r > 0.15 ? 'hi' : r < -0.15 ? 'lo' : 'mid';
            if (g.dataset.m !== mode) { g.dataset.m = mode; g.className = `gx sc sc-${barOf(sc)} ${mode}`; e.el.classList.toggle('psi-lo', mode === 'lo' || mode === 'frz'); e.el.dataset.sc = sc; }
          } else { e.gx.style.setProperty('--v', `${(u.reason + 100) / 2}%`); e.gx.className = fz ? 'psi frenzy' : 'psi'; }
          e.el.title = `이성 ${Math.round(u.reason)}${fz ? ' · 광폭' : ''}`;
        }
      }
      if (e.cpi) {
        const mx = u.cantripMax || 1, p = Math.max(0, Math.min(1, 1 - (u.cantripCd || 0) / mx));
        e.cpi.style.setProperty('--p', `${Math.round(p * 100)}%`);
        e.cpi.classList.toggle('ready', p >= 1 && !inFrenzy(u));
        e.cpi.classList.toggle('off', inFrenzy(u));
        e.cpi.hidden = !u.alive;
      }
      const alive = u.alive || (this.pendN.get(id) || 0) > 0;
      if (!e.ug && u.div !== null && !u.ult) { // 성찬(도로스)으로 전투 중에 신앙이 깨어난 기물: 신성력 게이지를 새로 단다
        const ring = document.createElement('div');
        ring.className = 'ug div';
        (e.el.querySelector<HTMLElement>('.tk-card') || e.el).appendChild(ring);
        e.ug = ring;
      }
      if (e.ug) {
        const f = u.ult ? (u.ultG || 0) : u.div !== null ? (u.divUsed ? 1 : u.div / 100) : 0;
        const st = u.ult ? (f >= 1 ? 'full' : '') : u.divUsed ? 'used' : f >= 1 ? 'full' : '';
        const sig = `${Math.round(f * 200)}|${st}|${alive ? 1 : 0}`;
        if (sig !== e.ugSig) {
          e.ugSig = sig;
          e.ug.style.setProperty('--p', `${(f * 100).toFixed(1)}%`);
          e.ug.style.setProperty('--o', (0.25 + 0.75 * f).toFixed(2));
          e.ug.classList.toggle('full', st === 'full');
          e.ug.classList.toggle('used', st === 'used');
          e.ug.hidden = !alive;
          if (u.div !== null) e.el.title = `신성력 ${Math.round(u.div)} (수집 ${Math.round(u.divGot)}/${u.divCap})`;
        }
      }
      // 재장전: 탄창 표식 + 진행 고리
      if (alive && u.reloadT > 0) {
        if (e.rl.hidden) { e.rl.hidden = false; e.rlMax = u.reloadT; }
        e.rl.style.setProperty('--p', `${Math.round((1 - u.reloadT / Math.max(0.01, e.rlMax)) * 100)}%`);
      } else if (!e.rl.hidden) e.rl.hidden = true;
      // 행동 불가류(기절 · 빙결 · 매혹 · 공포)는 초상화 중앙에 크게, 나머지 상태는 좌(디버프) · 우(버프) 세로 줄 (statusTokens)
      const big = !alive ? '' : hasKey(u, 'freeze') ? 'freeze' : this.b.has(u, 'stun') ? 'stun' : hasKey(u, 'charm') ? 'charm' : this.b.has(u, 'fear') ? 'fear' : '';
      const { deb, buf } = alive ? statusTokens(u) : { deb: [], buf: [] };
      const sig = `${big}|${tokSig(deb)}|${tokSig(buf)}`;
      if (sig !== e.stiSig) {
        const prevBig = e.stiSig.split('|')[0];
        e.stiSig = sig;
        e.stc.innerHTML = big ? `<i class="stc-${big}" title="${BIG_ICON[big][1]}">${BIG_ICON[big][0]}</i>` : '';
        e.sti.innerHTML = tokHtml(deb);
        e.stk.innerHTML = tokHtml(buf);
        if (big && big !== prevBig && !this.reduced) this.play(e.stc, [{ transform: 'scale(1.6)', opacity: 0, easing: EASE_OUT }, { transform: 'scale(1)', opacity: 1 }], 260);
      }
      e.el.classList.toggle('stunned', big === 'stun');
      e.el.classList.toggle('frozen', big === 'freeze');
      e.el.classList.toggle('charmed', big === 'charm');
      e.el.classList.toggle('feared', big === 'fear');
      e.el.classList.toggle('shocked', alive && hasKey(u, 'shock'));
      if (!alive && !e.dead) { e.dead = true; this.dieFx(e); }
      else if (alive && e.dead && u.alive) { e.dead = false; e.el.classList.remove('dead'); }
    }
    this.drawFocus();
  }

  /** 선택 기물: 현재 대상 연결선 + 이동 목적지 */
  private focusSig = '';
  private drawFocus() {
    const u = this.selId !== null ? this.els.get(this.selId)?.u : undefined;
    if (!u || !u.alive) { if (this.focusSig) { this.svg.innerHTML = ''; this.focusSig = ''; } return; }
    const c = this.centerAt(u);
    let s = '';
    const t = u.target;
    if (t && t.alive) {
      const d = this.centerAt(t);
      s += `<line class="fl-tgt side${u.side}" x1="${c.x}" y1="${c.y}" x2="${d.x}" y2="${d.y}" /><circle class="fl-ring side${u.side}" cx="${d.x}" cy="${d.y}" r="${50 / this.b.w}" />`;
    }
    if (u.moveT > 0) {
      const g = this.center(u);
      s += `<rect class="fl-dest" x="${g.x - 40 / this.b.w}" y="${g.y - 40 / this.b.h}" width="${80 / this.b.w}" height="${80 / this.b.h}" />`;
    }
    if (s !== this.focusSig) { this.svg.innerHTML = s; this.focusSig = s; }
  }

  /** 칸 중앙 (이동 목적지 기준) */
  private center(u: CUnit) { return { x: ((u.x + 0.5) / this.b.w) * 100, y: ((u.y + 0.5) / this.b.h) * 100 }; }
  /** 화면상 현재 위치 (이동 보간) */
  private centerAt(u: CUnit) {
    let x = u.x, y = u.y;
    if (u.moveT > 0 && u.moveDur > 0) { const t = motion().cell(1 - u.moveT / u.moveDur); x = u.px + (u.x - u.px) * t; y = u.py + (u.y - u.py) * t; }
    return { x: ((x + 0.5) / this.b.w) * 100, y: ((y + 0.5) / this.b.h) * 100 };
  }
  private dir(a: CUnit, t: CUnit) {
    const dx = t.x - a.x, dy = t.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, d: Math.max(Math.abs(dx), Math.abs(dy)) };
  }

  // ───────── 애니메이션 도우미
  private play(el: Element, kf: Keyframe[], ms: number, opt: KeyframeAnimationOptions = {}, text: boolean | 'ui' = false): Animation | null {
    if (!el.animate) return null;
    const a = el.animate(kf, { duration: ms, ...opt }) as Animation & { text?: boolean | 'ui' };
    a.text = text;
    this.anims.add(a);
    this.rateOf(a);
    const done = () => this.anims.delete(a);
    a.finished.then(done, done);
    return a;
  }
  /** 연출 전용 요소: 애니메이션이 끝나면 지운다 */
  private spawnFx(cls: string, x: number, y: number, kf: Keyframe[], ms: number, opt: KeyframeAnimationOptions = {}, html = '', text = false) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.left = `${x}%`; d.style.top = `${y}%`;
    if (html) d.innerHTML = html;
    this.fxLayer.appendChild(d);
    // 탄환 · 표식처럼 도착 시각에 맞춘 것은 그대로, 나머지 이펙트는 설정 배율 적용
    const timed = (opt as { timed?: boolean }).timed;
    const a = this.play(d, kf, timed || text ? ms : ms * fxK(), { fill: 'both', ...opt }, text);
    if (a) { const rm = () => d.remove(); a.finished.then(rm, rm); } else d.remove();
    return d;
  }
  private crowd(prio: Prio, rel: boolean) {
    if (prio === 2 || rel) return false;
    const n = this.fxLayer.childElementCount;
    return prio === 0 ? n > 70 : n > 130;
  }
  private rel(...ids: (number | undefined)[]) { return this.selId !== null && ids.includes(this.selId); }

  /** 떠오르는 글자. side: 피해는 가운데, 회복은 오른쪽, 보호막은 왼쪽 */
  private float(u: CUnit, text: string, cls: string, o: { color?: string; prio?: Prio; side?: 'c' | 'l' | 'r'; rel?: boolean; merge?: string; v?: number; fmt?: (v: number) => string } = {}) {
    const prio = o.prio ?? 0, rel = !!o.rel;
    if (o.merge && o.v !== undefined) {
      const m = this.merges.get(o.merge);
      if (m && this.vt < m.until && m.el.isConnected) { m.v += o.v; m.el.textContent = m.fmt(m.v); m.until = this.vt + 0.35; return; }
    }
    if (this.crowd(prio, rel)) return;
    const c = this.centerAt(u);
    // 같은 기물 위 숫자가 겹치지 않도록 세 줄로 번갈아 띄운다
    const lane = (this.lanes.get(u.id) || 0) % 3;
    this.lanes.set(u.id, lane + 1);
    const dx = o.side === 'r' ? 3.2 : o.side === 'l' ? -3.2 : (lane - 1) * 2.2;
    const sel = this.selId !== null;
    const d = this.spawnFx(`ft ${cls}${rel ? ' focus' : sel ? ' dimf' : ''}`, c.x + dx, c.y - 100 / this.b.h * 0.3 - lane * 1.8,
      [{ transform: 'translate(-50%, 20%) scale(1.25)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%, -70%) scale(1)', opacity: 1, offset: 0.2, easing: 'linear' }, { transform: 'translate(-50%, -110%)', opacity: 1, offset: 0.7, easing: 'ease-in' }, { transform: 'translate(-50%, -140%)', opacity: 0 }],
      FX.fxMs, {}, '', true);
    d.textContent = text;
    if (o.color) d.style.color = o.color;
    if (o.merge && o.v !== undefined) this.merges.set(o.merge, { el: d, v: o.v, until: this.vt + 0.35, fmt: o.fmt || ((v) => fmt(v)) });
  }
  /** 머리 위 작은 아이콘 점등 (회복 · 보호막 · 강화를 '누가' 했는지) */
  private casterIcon(u: CUnit, glyph: string, cls: string) {
    const c = this.centerAt(u);
    this.spawnFx(`cic ${cls}`, c.x, c.y - 100 / this.b.h * 0.42, [{ transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%, -80%) scale(1)', opacity: 0 }], 520, {}, glyph);
  }
  /** 토큰 동작: 기물마다 한 번에 하나만. 우선순위가 낮은 동작은 진행 중인 높은 동작을 끊지 않는다
   *  (시전 4 > 근접 공격 3 > 회피 · 반동 2 > 피격 1). 빠르게 정점에 닿은 뒤 감속하며 돌아온다 */
  private motion = new Map<number, { a: Animation; prio: number; t: number }>();
  private move(id: number, peak: Keyframe, ms: number, prio: number, peakAt = 0.22) {
    const e = this.els.get(id);
    if (!e || this.reduced) return;
    const cur = this.motion.get(id);
    if (cur && cur.a.playState === 'running') {
      if (cur.prio > prio) return;
      if (cur.prio === prio && this.vt - cur.t < 0.15) return; // 같은 동작 연타는 하나로
      cur.a.cancel();
    }
    const m = motion();
    const a = this.play(e.el, [{ transform: 'none', opacity: 1, easing: m.ein }, { ...peak, offset: m.peak(peakAt), easing: m.eout }, { transform: 'none', opacity: 1 }], ms * m.mul);
    if (a) this.motion.set(id, { a, prio, t: this.vt });
  }
  /** 회복 · 보호막 테두리: 양에 비례한 굵기 · 진하기 (작아도 희미하게는 보인다) */
  private rims = new Map<number, { a: Animation; t: number; kind: 'heal' | 'shield' }>();
  private rim(id: number, kind: 'heal' | 'shield', ratio: number) {
    const e = this.els.get(id);
    if (!e || this.reduced) return;
    const k = Math.max(0, Math.min(1, ratio));
    const cur = this.rims.get(id);
    if (cur && cur.a.playState === 'running') {
      if (cur.kind === 'shield' && kind === 'heal') return; // 보호막 장착 연출을 회복 점멸이 끊지 않는다
      if (cur.kind === kind && this.vt - cur.t < 0.3 && k < 0.5) return; // 짤힐 · 짤보호막 연타는 한 번만
    }
    cur?.a.cancel();
    const alpha = (0.3 + 0.7 * Math.sqrt(k)).toFixed(2);
    let a: Animation | null;
    if (kind === 'shield') {
      const w = (1 + 3 * k).toFixed(1), on = `rgb(255 255 255 / ${alpha})`, off = 'rgb(255 255 255 / 0)';
      a = this.play(e.face, [
        { outline: `${w}px solid ${off}`, outlineOffset: `${(4 + 8 * k).toFixed(1)}px`, easing: EASE_OUT },
        { outline: `${w}px solid ${on}`, outlineOffset: '0px', offset: 0.35 },
        { outline: `${w}px solid ${on}`, outlineOffset: '0px', offset: 0.7 },
        { outline: `${w}px solid ${off}`, outlineOffset: '0px' },
      ], 560 * fxK());
    } else {
      const w = (1 + 1.5 * k).toFixed(1), on = `rgb(99 210 151 / ${alpha})`, off = 'rgb(99 210 151 / 0)';
      a = this.play(e.face, [
        { outline: `${w}px solid ${off}`, outlineOffset: '1px', easing: EASE_OUT },
        { outline: `${w}px solid ${on}`, outlineOffset: '1px', offset: 0.2 },
        { outline: `${w}px solid ${off}`, outlineOffset: '1px', offset: 0.5 },
        { outline: `${w}px solid ${on}`, outlineOffset: '1px', offset: 0.7 },
        { outline: `${w}px solid ${off}`, outlineOffset: '1px' },
      ], 520 * fxK());
    }
    if (a) this.rims.set(id, { a, t: this.vt, kind });
  }
  private flashes = new Map<number, Animation>();
  private flash(id: number, filter: string, ms: number) {
    const e = this.els.get(id);
    if (!e || this.reduced) return;
    this.flashes.get(id)?.cancel();
    const a = this.play(e.face, [{ filter: 'none', easing: EASE_IN }, { filter, offset: 0.15, easing: EASE_OUT }, { filter: 'none' }], ms * fxK());
    if (a) this.flashes.set(id, a);
  }
  /** 곡선으로 날아가는 표식 (회복 · 보호막 · 장비) */
  private arc(from: CUnit, to: CUnit, cls: string, startIn: number, dur: number, html = '') {
    if (this.reduced) return;
    const p0 = this.centerAt(from), p1 = this.center(to);
    const mx = (p0.x + p1.x) / 2, my = Math.min(p0.y, p1.y) - 6;
    this.spawnFx(cls, p0.x, p0.y, [
      { left: `${p0.x}%`, top: `${p0.y}%`, opacity: 0.2, transform: 'translate(-50%, -50%) scale(.6)' },
      { left: `${mx}%`, top: `${my}%`, opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.5 },
      { left: `${p1.x}%`, top: `${p1.y}%`, opacity: 1, transform: 'translate(-50%, -50%) scale(.8)' },
    ], dur * 1000, { delay: Math.max(0, startIn) * 1000, easing: EASE_OUT, fill: 'forwards', timed: true } as KeyframeAnimationOptions, html);
  }

  // ───────── 최근 행동
  private log(id: number, key: string, text: string, v?: number, show?: (v: number) => string) {
    const u = this.els.get(id)?.u;
    if (!u || u.isSummon && u.defId === 'turret') return;
    const arr = this.logs.get(id) || [];
    const last = arr[arr.length - 1];
    if (last && last.key === key && this.vt - last.t < 2) {
      last.t = this.vt;
      if (v !== undefined && show) { last.v = (last.v || 0) + v; last.text = show(last.v); }
      return;
    }
    arr.push({ t: this.vt, key, text: v !== undefined && show ? show(v) : text, v });
    if (arr.length > 6) arr.shift();
    this.logs.set(id, arr);
  }

  // ───────── 이벤트 처리
  private atkCtx: { from: number; to: number; land: number; ranged: boolean } | null = null;
  private skillCtx: { id: number; land: number } | null = null;

  private drain() {
    const evs = this.b.events;
    this.b.events = [];
    for (const e of evs) this.handle(e);
    this.atkCtx = null; this.skillCtx = null;
    for (const u of this.b.units) if (!this.els.has(u.id)) this.mount(u);
  }
  private unit(id: number | undefined) { return id === undefined ? undefined : this.els.get(id)?.u || this.b.units.find((x) => x.id === id); }

  private handle(e: BEvent) {
    if ((e as { k: string }).k === 'cantrip') return this.onCantrip(e as unknown as { id: number; school: string; to?: number; name: string });
    switch (e.k) {
      case 'atk': return this.onAtk(e);
      case 'dmg': return this.onDmg(e);
      case 'heal': case 'shield': return this.onSupport(e);
      case 'status': return this.onStatus(e);
      case 'skill': return this.onSkill(e);
      case 'ult': return this.onUlt(e);
      case 'divact': return this.onDivAct(e.id);
      case 'skillEnd': if (this.skillCtx?.id === e.id) this.skillCtx = null; return;
      case 'fx': return this.onArea(e);
      case 'mark': return this.onMark(e);
      case 'gift': return this.onGift(e);
      case 'spawn': return this.onSpawn(e.id);
      case 'die': {
        const u = this.unit(e.id), by = this.unit(e.by);
        if (u && (!u.isSummon || this.lastDown === null)) this.lastDown = e.id;
        if (u && by && by.side !== u.side) this.log(by.id, `kill`, `${u.name} 처치`, 1, (n) => n > 1 ? `적 ${n}명 처치` : `${u.name} 처치`);
        return;
      }
      case 'crash': this.crash(e.side); return;
    }
  }

  /** 기본 공격 · 탄환: 사격은 반동 + 꼬리 달린 탄환, 근접은 대상 방향으로 기울기 */
  private onAtk(e: Extract<BEvent, { k: 'atk' }>) {
    const a = this.unit(e.from), t = this.unit(e.to);
    if (!a || !t) return;
    const v = this.dir(a, t);
    if (!e.ranged) {
      this.atkCtx = { from: e.from, to: e.to, land: this.vt + T_MELEE, ranged: false };
      this.move(e.from, { transform: `translate(${v.x * 30}%, ${v.y * 30}%) rotate(${v.x * 7}deg)` }, 280, 3, 0.3);
      return;
    }
    // 연쇄 탄환: 이 기물에게 날아오는 탄환이 닿은 뒤에 출발
    // 연쇄 탄환만 앞 탄환이 닿은 뒤 출발 (독립적인 기본 공격 · 반격은 기다리지 않음)
    const start = e.chain ? Math.max(this.vt, this.projLand.get(e.from) ?? 0) : this.vt;
    const fl = flightOf(v.d);
    const land = start + fl;
    this.atkCtx = { from: e.from, to: e.to, land, ranged: true };
    this.projLand.set(e.to, land);
    if (start <= this.vt) this.move(e.from, { transform: `translate(${-v.x * 9}%, ${-v.y * 9}%)` }, 200, 2, 0.15);
    if (this.reduced || this._speed > 4) return;
    if (this.crowd(0, this.rel(e.from, e.to))) return;
    const p0 = start > this.vt ? this.center(a) : this.centerAt(a), p1 = this.center(t);
    const ang = (Math.atan2((p1.y - p0.y) * this.b.h, (p1.x - p0.x) * this.b.w) * 180) / Math.PI;
    const d = this.spawnFx(`proj2${this.rel(e.from, e.to) ? ' focus' : ''}`, p0.x, p0.y, [
      { left: `${p0.x}%`, top: `${p0.y}%`, opacity: 1 }, { left: `${p1.x}%`, top: `${p1.y}%`, opacity: 1 },
    ], fl * 1000, { delay: (start - this.vt) * 1000, easing: EASE_SHOT, fill: 'both', timed: true } as KeyframeAnimationOptions);
    d.style.setProperty('--c', sideColor(a.side));
    d.style.setProperty('--a', `${ang}deg`);
  }

  private onDmg(e: Extract<BEvent, { k: 'dmg' }>) {
    const u = this.unit(e.id); if (!u) return;
    const src = this.unit(e.src);
    let land = this.vt, ranged = false;
    const ctx = this.atkCtx;
    if (ctx && ctx.to === e.id && (e.tag === 'basic' || e.tag === 'skill' || e.tag === 'proc')) { land = ctx.land; ranged = ctx.ranged; this.atkCtx = null; }
    else if (this.skillCtx && e.src === this.skillCtx.id && e.tag !== 'dot') land = this.skillCtx.land;
    const rel = this.rel(e.id, e.src);
    const dot = e.tag === 'dot';
    this.delta(e.id, e.dhp || 0, e.dsh || 0, land, () => {
      if (src && src !== u && e.v > 0) this.lastHitFrom.set(e.id, src.id);
      const v = src && src !== u ? this.dir(src, u) : { x: 0, y: -1, d: 0 };
      if (e.miss && !e.graze) {
        // 완전 회피: 비켜서는 동작만 (피격 섬광 없음)
        this.move(e.id, { transform: `translate(${-v.y * 24}%, ${v.x * 24}%)`, opacity: 0.55 }, 320, 2, 0.2);
        this.float(u, '회피', 'miss', { rel });
        return;
      }
      if (e.v < 1) return;
      const c = this.center(u);
      if (!dot) {
        this.move(e.id, { transform: `translate(${v.x * 8}%, ${v.y * 8}%) scale(${e.graze ? '.96, .94' : '.9, .84'})` }, 240, 1, 0.12);
        if (!e.graze) this.flash(e.id, 'brightness(1.6)', 180);
        if (!this.crowd(0, rel)) {
          if (ranged || e.tag === 'skill') this.spawnFx('impact', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 }], 240).style.setProperty('--c', sideColor(src?.side));
          else if (src) { const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI + 90; const d = this.spawnFx('slash', c.x, c.y, [{ transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.45 }, { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1.1)`, opacity: 0 }], 220); d.style.setProperty('--c', sideColor(src.side)); }
        }
      } else if (e.syn === 'SCHEME') {
        // 암운 맥동
        const st = this.els.get(e.id)?.sti.querySelector('.sts-gloom');
        if (st) this.play(st, [{ transform: 'scale(1)' }, { transform: 'scale(1.5)', filter: 'brightness(1.8)', offset: 0.3 }, { transform: 'scale(1)' }], 320);
        this.flash(e.id, 'brightness(.7) saturate(1.6) hue-rotate(250deg)', 260);
      }
      // 보호막 파괴
      if ((e.dsh || 0) < 0 && u.shield - (this.lagSh.get(e.id) || 0) <= 0.5) {
        this.spawnFx('shbreak', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], 380);
        this.float(u, '보호막 파괴', 'mark-sh', { prio: 2, rel });
      }
      const basic = e.tag === 'basic' && !e.crit;
      const txt = (e.graze ? '찰과 ' : '') + fmt(e.v) + (e.crit ? '!' : '');
      if (dot) this.float(u, fmt(e.v), 'dot', { color: ELEM_COLOR[e.elem], rel, merge: `dot:${e.id}:${e.elem}`, v: e.v });
      else this.float(u, txt, e.crit ? 'crit' : e.graze ? 'graze' : basic ? 'dmg sm' : 'dmg', { color: ELEM_COLOR[e.elem], rel, prio: basic ? 0 : 1 });
    });
  }

  /** 회복 · 보호막: 제공자 점등 → 곡선 표식 → 대상 반응 */
  private onSupport(e: Extract<BEvent, { k: 'heal' | 'shield' }>) {
    const u = this.unit(e.id); if (!u) return;
    const src = this.unit(e.src);
    const heal = e.k === 'heal';
    const rel = this.rel(e.id, e.src);
    const other = !!src && src !== u;
    let land = this.vt;
    if (other) {
      const start = this.skillCtx && this.skillCtx.id === src!.id ? T_SKILL * 0.5 : 0;
      land = this.vt + start + (heal ? 0 : T_SUPPORT);
      // 같은 제공자 → 대상 표식은 짧은 간격으로 한 번만
      const k = `${heal ? 'h' : 's'}:${src!.id}>${e.id}`;
      if ((this.statusSeen.get(k) ?? -9) < this.vt - 0.5 && !this.crowd(1, rel)) {
        this.statusSeen.set(k, this.vt);
        // 회복은 날아가는 표식 없이 대상 반응만 (기술 회복일 때만 제공자 아이콘), 보호막은 부여 표식
        if (!heal) { this.casterIcon(src!, '◇', 'shield'); this.arc(src!, u, 'orb shield', start, T_SUPPORT); }
        else if (this.skillCtx?.id === src!.id) this.casterIcon(src!, '+', 'heal');
      }
      if (src!.side === u.side) {
        // 제공자 쪽: 여러 대상은 한 줄로 묶는다 (아군 3명 회복 +120)
        const arr = this.logs.get(src!.id) || [];
        const last = arr[arr.length - 1];
        const key = `${e.k}>`;
        if (last && last.key === key && this.vt - last.t < 1.5) { last.t = this.vt; last.v = (last.v || 0) + e.v; last.ids!.add(e.id); }
        else { arr.push({ t: this.vt, key, text: '', v: e.v, ids: new Set([e.id]) }); if (arr.length > 6) arr.shift(); this.logs.set(src!.id, arr); }
        const l = arr[arr.length - 1];
        const who = l.ids!.size > 1 ? `아군 ${l.ids!.size}명` : u.name;
        l.text = heal ? `${who} 회복 +${fmt(l.v!)}` : `${who}에게 보호막 ${fmt(l.v!)}`;
        this.log(u.id, `${e.k}<${src!.id}`, '', e.v, (v) => heal ? `${src!.name}의 회복 +${fmt(v)}` : `${src!.name}의 보호막 ${fmt(v)}`);
      }
    }
    this.delta(e.id, heal ? (e.dhp ?? e.v) : 0, heal ? 0 : (e.dsh ?? e.v), land, () => {
      const c = this.center(u);
      if (heal) {
        // 회복: 얇은 초록 테두리 점멸 (최대 체력 30% 이상 회복에서 가장 진하게)
        this.rim(e.id, 'heal', e.v / (this.b.S(u, 'maxHp') * 0.3));
        if (other && e.v >= this.b.S(u, 'maxHp') * 0.05 && !this.crowd(1, rel)) for (let i = 0; i < 2; i++) this.spawnFx('rise', c.x + (i ? 1.6 : -1.6), c.y, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-260%)', opacity: 0 }], 520, { delay: i * 90 });
        this.float(u, '+' + fmt(e.v), 'heal', { side: 'r', rel, prio: other ? 1 : 0, merge: `heal:${e.id}`, v: e.v, fmt: (v) => '+' + fmt(v) });
      } else {
        // 보호막: 흰 테두리가 바깥에서 조여 들어와 장착된 뒤 사라진다 (최대 체력 50% 이상에서 가장 굵게)
        this.rim(e.id, 'shield', e.v / (this.b.S(u, 'maxHp') * 0.5));
        this.float(u, '◇' + fmt(e.v), 'shield', { side: 'l', rel, prio: other ? 1 : 0, merge: `sh:${e.id}`, v: e.v, fmt: (v) => '◇' + fmt(v) });
      }
    });
  }

  private onStatus(e: Extract<BEvent, { k: 'status' }>) {
    const u = this.unit(e.id); if (!u) return;
    const src = this.unit(e.src);
    const rel = this.rel(e.id, e.src);
    // 같은 표시는 1.2초에 한 번
    const k = `st:${e.id}:${e.name}`;
    if ((this.statusSeen.get(k) ?? -9) > this.vt - 1.2) return;
    this.statusSeen.set(k, this.vt);
    const at = this.skillCtx && e.src === this.skillCtx.id ? this.skillCtx.land : this.vt;
    if (src && src !== u) {
      if (e.harm) this.log(src.id, `inf:${e.id}:${e.name}`, `${u.name}에게 ${e.name}`);
      else { this.log(src.id, `buf:${e.id}:${e.name}`, `${u.name}에게 ${e.name} 부여`); this.log(u.id, `bufr:${src.id}:${e.name}`, `${src.name}의 ${e.name}`); }
    }
    this.later(at, () => {
      if (!e.harm && src && src !== u && e.stype === 'buff') {
        // 버프: 얇은 파동 → 대상 머리 위에 아이콘 착지
        const c = this.center(u);
        this.spawnFx('buffland', c.x, c.y - 100 / this.b.h * 0.42, [{ transform: 'translate(-50%,-180%)', opacity: 0 }, { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-50%)', opacity: 0 }], 600, {}, '▲');
      }
      this.float(u, e.name, e.harm ? 'status harm' : 'status', { prio: 2, rel });
    });
  }

  private onSkill(e: Extract<BEvent, { k: 'skill' }>) {
    const u = this.unit(e.id); if (!u) return;
    this.skillCtx = { id: e.id, land: this.vt + T_SKILL };
    const ee = this.els.get(e.id);
    if (ee && !this.reduced) {
      this.play(ee.face, [{ boxShadow: '0 0 0 0 #fff' }, { boxShadow: '0 0 0 3px #fff, 0 0 16px rgb(255 255 255 / .8)', offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], 420 * skK());
      this.move(e.id, { transform: 'translate(0,-10%) scale(1.07)' }, 380, 4, 0.25);
    }
    // 설명은 처음 발동했을 때와 선택한 기물에만
    const first = !this.castSeen.has(e.id);
    this.castSeen.add(e.id);
    const showTag = !!e.tag && (first || this.rel(e.id));
    this.log(e.id, `sk:${e.name}`, `${e.name}${e.tag ? ` · ${e.tag}` : ''} 발동`, 1, (n) => `${e.name}${e.tag ? ` · ${e.tag}` : ''} 발동${n > 1 ? ` ×${n}` : ''}`);
    if (this.crowd(2, false)) return;
    const c = this.centerAt(u);
    const d = this.spawnFx(`skb${this.rel(e.id) ? ' focus' : this.selId !== null ? ' dimf' : ''}`, c.x, c.y - 100 / this.b.h * 0.55,
      [{ transform: 'translate(-50%, -30%)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.75, easing: 'ease-in' }, { transform: 'translate(-50%, -150%)', opacity: 0 }],
      FX.skillMs, {}, `<b></b>${showTag ? '<small></small>' : ''}`, true);
    d.querySelector('b')!.textContent = e.name;
    if (showTag) d.querySelector('small')!.textContent = e.tag!;
  }

  /** 범위: 공격 = 터지는 원 · 회복 = 부드러운 빛 · 강화 = 점선 고리 */
  private onArea(e: Extract<BEvent, { k: 'fx' }>) {
    if (this.reduced) return;
    const at = this.skillCtx ? this.skillCtx.land : this.vt;
    this.later(at, () => {
      if (this.crowd(e.kind === 'aura' ? 0 : 1, false)) return;
      const { w, h } = this.b;
      const kind = e.kind || 'atk';
      const sw = ((2 * e.r + 1) / w) * 100, sh = ((2 * e.r + 1) / h) * 100;
      const d = this.spawnFx(`area2 ${kind}`, ((e.x + 0.5) / w) * 100, ((e.y + 0.5) / h) * 100,
        kind === 'aura' ? [{ transform: 'translate(-50%,-50%)', opacity: 0 }, { transform: 'translate(-50%,-50%)', opacity: 0.35, offset: 0.25 }, { transform: 'translate(-50%,-50%)', opacity: 0 }]
        : kind === 'buff' ? [{ transform: 'translate(-50%,-50%) scale(1.3) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }]
          : kind === 'heal' ? [{ transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 }]
            : [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 0 }], kind === 'aura' ? 800 : 520);
      d.style.width = `${sw}%`; d.style.height = `${sh}%`;
      d.style.setProperty('--c', kind === 'atk' ? sideColor(e.side) : kind === 'buff' ? '#f2f4f8' : 'var(--good)');
    });
  }

  /** 부활 · 시간 역행 · 처형 · 불사: 숫자보다 고유 표식 */
  /** 사이오닉 비술: 시전자 학파 색 테두리 + 학파 이름표 + 대상까지 광선 + 대상 이중 고리 */
  /** 비술 표시 이름: ◆ 변형 증강을 받았으면 바뀐 이름 (cantripView) */
  private cpName = new Map<number, string>();
  private cantripName(u: CUnit, school: string, base: string) {
    let n = this.cpName.get(u.id);
    if (n === undefined) {
      n = base;
      try { if (SCHOOL_BY_ID[school as SchoolId] && u.src) { const v = cantripView(school as SchoolId, u.src.augments); n = v.transform || v.name || base; } } catch { /* 기본 이름 */ }
      this.cpName.set(u.id, n);
    }
    return n;
  }
  private onCantrip(e0: { id: number; school: string; to?: number; name: string }) {
    const u = this.unit(e0.id); if (!u) return;
    const e = { ...e0, name: this.cantripName(u, e0.school, e0.name) };
    const t = this.unit(e.to);
    const color = SCHOOL_BY_ID[e.school as SchoolId]?.color || '#b07cff';
    this.log(e.id, `cp:${e.name}`, `비술 ${e.name}`, 1, (n) => `비술 ${e.name}${n > 1 ? ` ×${n}` : ''}`);
    const ee = this.els.get(e.id);
    if (ee && !this.reduced) {
      this.play(ee.face, [{ boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 0 3px ${color}, 0 0 14px ${color}`, offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], 420);
      if (ee.cpi) this.play(ee.cpi, [{ transform: 'scale(1.6)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], 320);
    }
    if (!this.crowd(1, this.rel(e.id))) {
      const c = this.center(u);
      const d = this.spawnFx(`cpb${this.rel(e.id) ? ' focus' : this.selId !== null ? ' dimf' : ''}`, c.x, c.y - 100 / this.b.h * 0.5,
        [{ transform: 'translate(-50%, -20%) scale(.8)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%, -100%) scale(1)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.72, easing: 'ease-in' }, { transform: 'translate(-50%, -140%)', opacity: 0 }],
        FX.skillMs * 0.75, {}, `${lineIcon(`s.${e.school}`, 'li')}<b></b>`, true);
      d.style.setProperty('--sc', color);
      d.querySelector('b')!.textContent = e.name;
    }
    if (this.reduced) return;
    const ct = this.center(t || u);
    if (t && t !== u) {
      // 시전자 → 대상 광선
      const ca = this.center(u), r = this.fxLayer.getBoundingClientRect();
      const dx = ((ct.x - ca.x) / 100) * r.width, dy = ((ct.y - ca.y) / 100) * r.height;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const bm = this.spawnFx(`cbeam cb-${e.school}`, ca.x, ca.y, [{ transform: `rotate(${ang}deg) scaleX(0)`, opacity: 1 }, { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.35 }, { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 0 }], 460);
      bm.style.width = `${Math.hypot(dx, dy)}px`;
      bm.style.setProperty('--sc', color);
    }
    for (const [i, s0] of [[0, 0.35], [1, 0.6]] as const) {
      const fx = this.spawnFx(`cring cr-${e.school}`, ct.x, ct.y, [{ transform: `translate(-50%,-50%) scale(${s0})`, opacity: 0.95 }, { transform: `translate(-50%,-50%) scale(${1.3 + i * 0.35})`, opacity: 0 }], 520 + i * 160);
      fx.style.setProperty('--sc', color);
    }
  }
  private onMark(e: Extract<BEvent, { k: 'mark' }>) {
    const u = this.unit(e.id); if (!u) return;
    const c = this.center(u);
    if (e.style === 'execute') this.executed.add(e.id);
    const at = Math.max(this.vt, this.projLand.get(e.id) ?? 0);
    if (e.style !== 'execute') this.log(e.id, `mk:${e.name}`, `${e.name}${e.style === 'immortal' ? '로 버팀' : '으로 부활'}`);
    this.later(at, () => {
      if (e.style === 'rewind') {
        this.spawnFx('rewind', c.x, c.y, [{ transform: 'translate(-50%,-50%) rotate(0) scale(1.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(-300deg) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) rotate(-360deg) scale(.9)', opacity: 0 }], 800);
        const ee = this.els.get(e.id);
        if (ee) this.play(ee.face, [{ filter: 'grayscale(1) brightness(.6)', transform: 'rotate(25deg)' }, { filter: 'grayscale(.4)', transform: 'rotate(-8deg)', offset: 0.6 }, { filter: 'none', transform: 'rotate(0)' }], 700, { composite: 'add' } as KeyframeAnimationOptions);
      } else if (e.style === 'revive') {
        this.spawnFx('pillar', c.x, c.y, [{ transform: 'translate(-50%,-100%) scaleY(0)', opacity: 0 }, { transform: 'translate(-50%,-100%) scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-100%) scaleY(1)', opacity: 0 }], 900);
        const ee = this.els.get(e.id);
        if (ee) this.play(ee.face, [{ opacity: 0.2, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], 600, { composite: 'add' } as KeyframeAnimationOptions);
      } else if (e.style === 'execute') {
        this.executed.add(e.id); // 사망 연출에서 반으로 갈라짐 + 해골
      } else {
        this.spawnFx('shring gold', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], 600);
      }
      this.float(u, e.name, `mark ${e.style}`, { prio: 2, rel: this.rel(e.id) });
    });
  }

  /** 장비 지급: 장비 아이콘이 제공자에게서 대상에게 날아가 붙는다 */
  private onGift(e: Extract<BEvent, { k: 'gift' }>) {
    const a = this.unit(e.from), t = this.unit(e.to); if (!a || !t) return;
    const nm = itemInfo(e.item).name;
    this.log(e.from, `gift:${e.to}:${e.item}`, `${t.name}에게 ${nm} 지급`);
    if (a !== t) this.log(e.to, `giftr:${e.item}`, `${a.name}에게서 ${nm} 받음`);
    const start = this.skillCtx?.id === e.from ? T_SKILL : 0, dur = 0.45;
    this.arc(a, t, 'gift-fly', start, dur, this.itemHtml(e.item));
    this.later(this.vt + start + dur, () => {
      const ee = this.els.get(e.to);
      if (ee) this.play(ee.face, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'scale(1)' }], 300, { composite: 'add' } as KeyframeAnimationOptions);
      this.float(t, nm, 'status gift', { prio: 2, rel: this.rel(e.from, e.to) });
    });
  }

  private onSpawn(id: number) {
    const u = this.unit(id); if (!u) return;
    const ee = this.els.get(id);
    if (ee?.dead && u.alive) { ee.dead = false; ee.el.classList.remove('dead'); for (const a of ee.el.getAnimations()) a.cancel(); }
    if (!ee || this.reduced) return;
    if (u.defId === 'turret') {
      // 포탑 설치: 내려앉으며 공구 문양
      this.play(ee.el, [{ transform: 'translateY(-40%) scale(.5)', opacity: 0 }, { transform: 'translateY(4%) scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], 380);
      const c = this.center(u);
      this.spawnFx('tool', c.x, c.y, [{ transform: 'translate(-50%,-50%) rotate(-90deg) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(0) scale(1.2)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-80%) rotate(30deg) scale(1)', opacity: 0 }], 650, {}, '⚙');
    } else this.play(ee.el, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 300);
  }

  // ───────── 메이저 궁극기: 컷인 (좌측 스탠딩 · 스킬명 · 대사) + 클로즈업 + 감속
  private onUlt(e: Extract<BEvent, { k: 'ult' }>) {
    const u = this.unit(e.id), ult = ULTS[e.ult];
    if (!u || !ult) return;
    const off = FX.ultCut === 'off' || this.reduced || !this.b.keepEvents;
    // 효과는 컷인 직후에 닿도록 (감속 중이라 게임 시간으로는 짧다)
    this.skillCtx = { id: e.id, land: this.vt + (off ? T_SKILL : 0.18) };
    this.castSeen.add(e.id);
    this.log(e.id, `ult:${ult.id}`, `궁극기 · ${ult.name}`, 1, (n) => `궁극기 · ${ult.name}${n > 1 ? ` ×${n}` : ''}`);
    const ee = this.els.get(e.id);
    if (ee && !this.reduced) this.play(ee.face, [{ boxShadow: '0 0 0 0 #4aa8ff' }, { boxShadow: '0 0 0 4px #4aa8ff, 0 0 22px #4aa8ff', offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], 600);
    if (off) {
      const c = this.centerAt(u);
      const d = this.spawnFx('skb ult', c.x, c.y - 100 / this.b.h * 0.55, [{ transform: 'translate(-50%, -30%)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.75, easing: 'ease-in' }, { transform: 'translate(-50%, -150%)', opacity: 0 }], FX.skillMs, {}, '<b></b><small>궁극기</small>', true);
      d.querySelector('b')!.textContent = ult.name;
      return;
    }
    // 대사: 기물 음성 대사 중 하나 (같은 시전이면 같은 줄)
    const line = voicePick(VOICE[u.defId]?.ult, `${e.id}|${this.b.t.toFixed(2)}`) || ult.line;
    this.cutQ.push({ u, name: ult.name, line, theme: ult.theme, label: '궁극기' });
    this.nextCut();
  }
  /** 디바인 신권 대행: 궁극기와 같은 틀에 금빛 신성 테마 (강화되면 더 밝게) */
  private onDivAct(id: number) {
    const u = this.unit(id);
    if (!u) return;
    const rel = u.relic ? RELIC_BY_ID[u.relic] : null;
    const name = rel?.name || (u.ctype ? DIVINE_ACT[u.ctype].name : '신권 대행'); // 성유물이 없으면 (성찬으로 깨어난 기물) 전투 유형 기본형
    const enh = (u.mem.enh || 1) > 1;
    this.skillCtx = { id, land: this.vt + 0.18 };
    this.log(id, 'divact', `신권 대행 · ${name}${enh ? ' (강화)' : ''}`);
    const ee = this.els.get(id);
    if (ee && !this.reduced) this.play(ee.face, [{ boxShadow: '0 0 0 0 #ffd34d' }, { boxShadow: '0 0 0 4px #ffd34d, 0 0 24px #ffd34d', offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], 700);
    if (FX.ultCut === 'off' || this.reduced || !this.b.keepEvents) {
      const c = this.centerAt(u);
      const d = this.spawnFx('skb div', c.x, c.y - 100 / this.b.h * 0.55, [{ transform: 'translate(-50%, -30%)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.75, easing: 'ease-in' }, { transform: 'translate(-50%, -150%)', opacity: 0 }], FX.skillMs, {}, '<b></b><small>신권 대행</small>', true);
      d.querySelector('b')!.textContent = name;
      return;
    }
    this.cutQ.push({ u, name, line: voicePick(VOICE[u.defId]?.divine, `${id}|${this.b.t.toFixed(2)}`) || DIV_LINE[u.defId] || '신이시여, 지금 이 손에 권능을.', theme: { pat: 'halo', c1: enh ? '#fff6c8' : '#ffd34d', c2: enh ? '#5a4410' : '#2a2008', txt: enh ? 'spark' : 'mist' }, label: enh ? '신권 대행 · 강화' : '신권 대행' });
    this.nextCut();
  }
  private nextCut() {
    if (this.cutEnd >= 0 || !this.cutQ.length || this.b.over) return;
    const ult = this.cutQ.shift()!;
    const u = ult.u;
    const view = this.board.parentElement;
    if (!view) return;
    const short = FX.ultCut === 'short' || this.cutQ.length > 0; // 줄이 밀리면 짧게
    const dur = short ? 0.7 : 1.25;
    this.cutEnd = this.rt + dur;
    this.cutMul = 0.15;
    for (const a of this.anims) this.rateOf(a);
    // 클로즈업
    const c = this.center(u);
    this.board.style.transformOrigin = `${c.x}% ${c.y}%`;
    this.play(this.board, [{ scale: '1', easing: EASE_OUT }, { scale: '1.12', offset: 0.25 }, { scale: '1.12', offset: 0.8, easing: 'ease-in-out' }, { scale: '1' }], dur * 1000, {}, 'ui');
    const th = ult.theme;
    const el = document.createElement('div');
    el.className = `cutin ci-pat-${th.pat}${short ? ' short' : ''}`;
    el.style.setProperty('--c1', th.c1); el.style.setProperty('--c2', th.c2);
    const art = standURL(u.defId);
    const chars = [...ult.name].map((ch) => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    el.innerHTML = `<div class="ci-band"></div>${art ? `<div class="ci-art"><img alt="" src="${art}"></div>` : ''}
      <div class="ci-text"><small class="ci-who"></small><b class="ci-name">${chars}</b>${short ? '' : '<span class="ci-line"></span>'}</div>`;
    el.querySelector('.ci-who')!.textContent = `${u.name} · ${ult.label}`;
    const ln = el.querySelector('.ci-line');
    if (ln) ln.textContent = `“${ult.line}”`;
    view.appendChild(el);
    this.cutEl = el;
    const ms = dur * 1000;
    this.play(el.querySelector('.ci-band')!, [{ transform: 'skewY(-6deg) translateX(-105%)', opacity: 1, easing: EASE_OUT }, { transform: 'skewY(-6deg) translateX(0)', opacity: 1, offset: 0.18 }, { transform: 'skewY(-6deg) translateX(0)', opacity: 1, offset: 0.85, easing: 'ease-in' }, { transform: 'skewY(-6deg) translateX(8%)', opacity: 0 }], ms, { fill: 'both' }, 'ui');
    const ai = el.querySelector('.ci-art');
    if (ai) this.play(ai, [{ transform: 'translateX(-40%)', opacity: 0, easing: EASE_OUT }, { transform: 'translateX(0)', opacity: 1, offset: 0.22 }, { transform: 'translateX(2%)', opacity: 1, offset: 0.85, easing: 'ease-in' }, { transform: 'translateX(4%)', opacity: 0 }], ms, { fill: 'both' }, 'ui');
    const tx = el.querySelector('.ci-text')!;
    this.play(tx, [{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], ms, { fill: 'both' }, 'ui');
    this.textFx(th.txt, el.querySelector('.ci-name')!, short ? 0.6 : 1);
    if (ln) this.play(ln, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 0, offset: 0.25 }, { opacity: 1, transform: 'translateY(0)', offset: 0.4 }, { opacity: 1 }], ms, { fill: 'both' }, 'ui');
  }
  private endCut() {
    if (this.cutEnd < 0) return;
    this.cutEnd = -1;
    this.cutMul = 1;
    for (const a of this.anims) this.rateOf(a);
    const el = this.cutEl;
    this.cutEl = null;
    el?.remove();
  }
  /** 스킬명 글자 연출 (기물마다 다름) */
  private textFx(kind: string, name: Element, k: number) {
    const chars = Array.from(name.querySelectorAll('span'));
    const each = (gap: number, kf: (i: number) => Keyframe[], ms: number, rev = false) => chars.forEach((ch, i) => this.play(ch, kf(i), ms * k, { delay: (rev ? chars.length - 1 - i : i) * gap * k, fill: 'both', easing: EASE_OUT }, 'ui'));
    const whole = (kf: Keyframe[], ms: number) => this.play(name, kf, ms * k, { fill: 'both', easing: EASE_OUT, delay: 90 * k }, 'ui');
    switch (kind) {
      case 'heat': whole([{ filter: 'blur(6px)', transform: 'skewX(-14deg) translateY(8px)', opacity: 0 }, { filter: 'blur(1px)', transform: 'skewX(6deg)', opacity: 1, offset: 0.6 }, { filter: 'blur(0)', transform: 'skewX(0)', opacity: 1 }], 520); break;
      case 'shake': whole([{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(-7px,3px)', opacity: 1, offset: 0.2 }, { transform: 'translate(6px,-3px)', offset: 0.4 }, { transform: 'translate(-4px,2px)', offset: 0.6 }, { transform: 'translate(2px,-1px)', offset: 0.8 }, { transform: 'translate(0,0)', opacity: 1 }], 480); break;
      case 'stamp': whole([{ transform: 'scale(2.4) rotate(-8deg)', opacity: 0 }, { transform: 'scale(.92) rotate(-3deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1) rotate(-3deg)', opacity: 1 }], 380); break;
      case 'glitch': whole([{ transform: 'translateX(-24px)', opacity: 0, filter: 'hue-rotate(120deg)' }, { transform: 'translateX(8px)', opacity: 1, offset: 0.3 }, { transform: 'translateX(-4px)', filter: 'hue-rotate(40deg)', offset: 0.55 }, { transform: 'translateX(2px)', offset: 0.75 }, { transform: 'none', filter: 'none', opacity: 1 }], 460); break;
      case 'roar': whole([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 1 }], 440); break;
      case 'mist': whole([{ filter: 'blur(12px)', opacity: 0, letterSpacing: '.5em' }, { filter: 'blur(0)', opacity: 1, letterSpacing: '.06em' }], 760); break;
      case 'slide': whole([{ transform: 'translateX(-120%)', opacity: 0 }, { transform: 'translateX(5%)', opacity: 1, offset: 0.6 }, { transform: 'translateX(0)', opacity: 1 }], 380); break;
      case 'unwrap': whole([{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], 520); break;
      case 'smear': whole([{ filter: 'blur(8px)', transform: 'scaleX(1.7)', opacity: 0 }, { filter: 'blur(0)', transform: 'scaleX(1)', opacity: 1 }], 480); break;
      case 'type': each(45, () => [{ opacity: 0 }, { opacity: 1 }], 60); break;
      case 'bored': each(85, () => [{ opacity: 0 }, { opacity: 1 }], 80); break;
      case 'reverse': each(55, () => [{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], 220, true); break;
      case 'spark': each(50, () => [{ opacity: 0, textShadow: '0 0 18px #fff, 0 0 30px var(--c2)' }, { opacity: 1, textShadow: '0 0 12px var(--c1), 0 2px 0 #000' }], 320); break;
      default: whole([{ opacity: 0 }, { opacity: 1 }], 300);
    }
  }

  // ───────── 사망 · 종료 연출
  private dieFx(e: UEl) {
    const u = e.u;
    const hide = () => { if (!e.u.alive) e.el.classList.add('dead'); };
    this.motion.get(u.id)?.a.cancel();
    if (this.reduced || !this.b.keepEvents) { hide(); return; }
    const c = this.center(u);
    const cw = 100 / this.b.w, ch = 100 / this.b.h;
    if (this.executed.has(u.id)) {
      // 처형: 초상화가 사선으로 갈라져 양쪽으로 미끄러지고 해골이 떠오른다
      e.el.classList.add('dead', 'instant');
      const src = iconURL(u);
      for (const side of ['l', 'r'] as const) {
        const d = this.spawnFx(`half ${side}`, c.x, c.y, [
          { transform: 'translate(-50%,-50%)', opacity: 1, easing: EASE_OUT },
          { transform: `translate(${side === 'l' ? -78 : -22}%, ${side === 'l' ? -38 : -62}%) rotate(${side === 'l' ? -14 : 12}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${side === 'l' ? -85 : -15}%, ${side === 'l' ? -20 : -70}%) rotate(${side === 'l' ? -18 : 16}deg)`, opacity: 0 },
        ], 1000, {}, `<img alt="" src="${src}">`);
        d.style.width = `${cw * 0.8}%`; d.style.height = `${ch * 0.8}%`;
      }
      const sl = this.spawnFx('cutline', c.x, c.y, [{ transform: 'translate(-50%,-50%) rotate(-62deg) scaleX(0)', opacity: 1, easing: EASE_OUT }, { transform: 'translate(-50%,-50%) rotate(-62deg) scaleX(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) rotate(-62deg) scaleX(1.1)', opacity: 0 }], 500);
      sl.style.width = `${cw * 1.3}%`;
      this.spawnFx('skull', c.x, c.y, [{ transform: 'translate(-50%,-30%) scale(.4)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%,-70%) scale(1.15)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-120%) scale(1)', opacity: 0 }], 1200, {}, SKULL);
      return;
    }
    const finish = (a: Animation | null) => { if (a) { const f = () => hide(); a.finished.then(f, f); } else hide(); };
    const from = this.unit(this.lastHitFrom.get(u.id));
    const sx = from ? Math.sign(u.x - from.x) || (u.side === 0 ? -1 : 1) : (u.side === 0 ? -1 : 1);
    const card = hasPortrait(u);
    const W = `${cw * (card ? 0.8 : 0.82)}%`, H = `${ch * (card ? 0.8 : 0.82)}%`;
    finish(deathFx(FX.death, {
      el: e.el, img: iconURL(u), pixel: !card, sx,
      play: (el, kf, ms, opt = {}) => this.play(el, kf, ms * fxK(), opt),
      spawn: (cls, kf, ms, opt = {}, html = '') => { const d = this.spawnFx(cls, c.x, c.y, kf, ms, opt, html); d.style.width = W; d.style.height = H; return d; },
    }));
  }

  /** 승패가 갈린 순간: 마지막으로 쓰러진 기물로 확대 + 감속 */
  private finaleStart() {
    if (!this.b.keepEvents || this.reduced) return;
    this.slowMul = 0.3;
    for (const a of this.anims) this.rateOf(a);
    const u = this.unit(this.lastDown ?? undefined);
    if (!u) return;
    const c = this.center(u);
    this.board.style.transformOrigin = `${c.x}% ${c.y}%`;
    this.play(this.board, [{ scale: '1' }, { scale: '1.55' }], 700, { easing: EASE_OUT, fill: 'forwards' }, true);
  }
  /** 마지막 일격이 닿음: 화면 흔들림 + 전투 종료 배너 */
  private finaleImpact() {
    this.finaleHit = this.rt;
    if (!this.b.keepEvents || this.reduced) return;
    const view = this.board.parentElement;
    if (!view) return;
    this.play(view, SHAKE, 480, { easing: 'ease-out' }, true);
    const won = this.b.winner === 0;
    const bn = document.createElement('div');
    bn.className = `finale ${won ? 'win' : 'lose'}`;
    bn.innerHTML = '<b>전투 종료</b>'; // 승패는 보고서에서
    view.appendChild(bn);
    this.play(bn, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)', letterSpacing: '.6em' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', letterSpacing: '.18em', offset: 0.35 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', letterSpacing: '.22em' }], 1500, { easing: EASE_OUT, fill: 'forwards' }, true);
  }

  /** 스텔라레이서: 경기장 밖 비행선이 대각선으로 적진 한가운데에 내리꽂힌 뒤 섬광 · 충격파 · 화면 흔들림 */
  private crash(side: 0 | 1, late = false) {
    if (this.reduced) return;
    if (!late && this.b.t < 0.3) { this.later(this.vt + 0.75, () => this.crash(side, true)); return; } // 전투 개시 배너가 걷힌 뒤에 보이도록
    const foes = this.b.units.filter((u) => u.alive && u.side !== side);
    if (!foes.length) return;
    const cx = foes.reduce((s, u) => s + this.center(u).x, 0) / foes.length, cy = foes.reduce((s, u) => s + this.center(u).y, 0) / foes.length;
    const sx = cx < 50 ? cx + 70 : cx - 70, sy = side === 0 ? -25 : 125;
    const ang = (Math.atan2(cy - sy, cx - sx) * 180) / Math.PI;
    // 비행 · 폭발 · 흔들림 모두 표시 시계를 따른다 (정지하면 멈춤)
    const ship = this.spawnFx('crash-ship', sx, sy, [{ left: `${sx}%`, top: `${sy}%`, opacity: 0.4 }, { left: `${cx}%`, top: `${cy}%`, opacity: 1 }], 520, { easing: 'cubic-bezier(.5, 0, .9, .6)', fill: 'forwards', timed: true } as KeyframeAnimationOptions);
    ship.style.setProperty('--a', `${ang}deg`);
    this.later(this.vt + 0.52, () => {
      ship.remove();
      this.spawnFx('crash-boom', cx, cy, [{ opacity: 1 }, { opacity: 1 }], 900, { timed: true } as KeyframeAnimationOptions);
      const view = this.board.parentElement;
      if (view) this.play(view, SHAKE, 450, { easing: 'cubic-bezier(.36, .07, .19, .97)' });
    });
  }
}
