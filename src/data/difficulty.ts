// 난이도 단계 (위험 등급). 단계 n 은 1~n 의 조건을 모두 포함한다. 단계 n 을 클리어하면 n+1 해금 (기록).
// 선택 화면의 세 단계: 쉬움 = 위험 3 · 모험 = 위험 6 · 고난 = 위험 7 (위험 6 + 절망 증강 · 빠른 증원). 적 증원은 CFG.diffAdd, 절망 증강은 CFG.despair.
// 체계 판 2 (위험 7 = 절망 증강 삽입): 예전 위험 7 · 8 은 8 · 9 가 됐다 — 예전 기록 · 저장은 ui/meta.ts loadMeta · engine/run.ts migrate 에서 옮긴다.
import { CFG } from '../config';
const p1 = (x: number) => `${+(x * 100).toFixed(1)}%`;
const FG = CFG.foeGear;
import { despairRule } from './despair';
import { oathHeat, type OathSel } from './oaths';

export interface DiffDef { lvl: number; name: string; desc: string }

/** 위험 등급 d 의 적 증원 간격 (페이즈, 0 = 없음): CFG.diffAdd 에서 d 이하 가장 높은 등급의 값 */
export function diffAddEvery(d: number | undefined): number {
  let lvl = -1, every = 0;
  for (const [l, k] of CFG.diffAdd) if ((d || 0) >= l && l > lvl) { lvl = l; every = k; }
  return every;
}
/** 위험 등급 d · 페이즈 p 의 적 증원 수 = ⌊p ÷ 간격⌋ (조우마다 기본 구성에 더한다. 보드 칸 상한은 genEncounter) */
export const diffAddCount = (d: number | undefined, p: number) => { const k = diffAddEvery(d); return k > 0 ? Math.floor(p / k) : 0; };
/** 증원 규칙 한 줄: '3페이즈마다 적 +1' (간격이 없으면 '') */
export const diffAddRule = (d: number | undefined) => { const k = diffAddEvery(d); return k > 0 ? `${k}페이즈마다 적 +1` : ''; };
/** 위험 등급 설명에 붙는 증원 조건: 그 등급에서 간격이 새로 정해질 때만 (CFG.diffAdd), 의뢰 페이즈 안의 예시 포함 */
function addDesc(lvl: number): string {
  const e = CFG.diffAdd.find(([l]) => l === lvl);
  if (!e) return '';
  const prev = CFG.diffAdd.filter(([l]) => l < lvl).sort((a, b) => b[0] - a[0])[0];
  const ex: string[] = [];
  for (let p = e[1]; p <= CFG.victoryPhase; p += e[1]) ex.push(`${p}페이즈 +${diffAddCount(lvl, p)}`);
  return `적 증원: ${e[1]}페이즈마다 모든 전투의 적 +1 (${ex.join(' · ')}${prev ? `, 위험 ${prev[0]} 대체` : ''}).`;
}

const BASE: DiffDef[] = [
  { lvl: 0, name: '표준 의뢰', desc: '추가 조건 없음.' },
  { lvl: 1, name: '위험 1', desc: '적 체력 +15%.' },
  { lvl: 2, name: '위험 2', desc: `적 피해 +15%. 적이 장비 칸마다 ${p1(FG.slot)} 확률 (역경 · 보스전 ${p1(FG.big)}, 정예 ×${FG.elite} · 보스 ×${FG.boss})로 장비 재료를 달고, 역경 · 보스전에서는 그중 ${p1(FG.graded)}가 고급 장비입니다 (장비 칸은 1칸에서 2페이즈마다 +1, 최대 3).` },
  { lvl: 3, name: '위험 3', desc: '적 피해 ×1.25 (위험 2 대체). 시작 크레딧 0. 대신 승리 크레딧 ×1.25.' },
  { lvl: 4, name: '위험 4', desc: '보스 체력 +25%, 보스 호위 +1.' },
  { lvl: 5, name: '위험 5', desc: `역경 적 +1, 일반 전투 정예 출현 확률 2배, 적 회피 +10%p. 적이 개조부품(문장 제외)을 ${p1(FG.mod[0])} 확률 (정예 ${p1(FG.mod[1])} · 보스 ${p1(FG.mod[2])})로 달고, 보스는 ${p1(FG.bossLegend)} 확률로 전설 장비를 장착합니다.` },
  { lvl: 6, name: '위험 6', desc: '적 피해 ×1.5 (위험 3 대체). 이자 상한 -1. 승리 크레딧 ×1.5 (위험 3 대체). 1페이즈부터 모든 적이 장비 재료(역경 · 보스전은 고급 장비도)를 최소 1개 장착합니다.' },
  { lvl: 7, name: '위험 7', desc: `최대 플레이어 체력 -25. 절망 증강: ${despairRule()} 역경 적은 재료 · 고급 · 희귀 중 등급별 동일 확률로 뽑은 장비 3개를 확정 장착합니다 (전설 제외).` },
  { lvl: 8, name: '위험 8', desc: '적 방어도 +25%, 효과 저항 +15%p, 적 회피 +10%p 추가.' },
  { lvl: 9, name: '위험 9', desc: '페이즈마다 적 체력 +5% 추가 (누적).' },
];
/** 분리 용제 규칙 (CFG.solventFrom 등급에서 켜진다, run.ts unequip) */
export const SOLVENT_RULE = '장착한 장비(개조부품 제외)를 떼어 보관함 · 다른 기물로 옮기려면 분리 용제 1개를 소모합니다 (보관함에서 장착하는 것은 그대로).';
/** 위험 등급표: 기본 조건 + 적 증원 조건 · 분리 용제 규칙 (설정값에서 읽는다) */
export const DIFFS: DiffDef[] = BASE.map((x) => { const a = [addDesc(x.lvl), x.lvl === CFG.solventFrom ? SOLVENT_RULE : ''].filter(Boolean).join(' '); return a ? { ...x, desc: `${x.desc} ${a}` } : x; });
export const MAX_DIFF = DIFFS.length - 1;
/** 난이도 선택 화면의 세 단계 (위험 3 · 6 · 7). 이름은 선택 화면 · 기록 · 결과 문구가 여기서 읽는다 */
export const DIFF_PRESETS: { lvl: number; name: string }[] = [{ lvl: 3, name: '쉬움' }, { lvl: 6, name: '모험' }, { lvl: 7, name: '고난' }];
export const diffName = (d: number) => DIFF_PRESETS.find((x) => x.lvl === d)?.name || '';
/** 기록 표기: '고난 (위험 7)' · 단계 이름이 없는 등급은 '위험 4' */
export const diffLabel = (d: number) => (diffName(d) ? `${diffName(d)} (위험 ${d})` : `위험 ${d}`);
/**
 * 실효(표기) 위험 등급: 서약이 걸리는 등급(고난, CFG.oathFrom) 이상이면 절망 서약의 절망 수치 CFG.oathDiffStep 마다 +1 (고난 + 절망 5 → 위험 8, 10 → 9, …).
 * 표기 · 기록(전장별 최고 위험 등급) · 업적만 이 값을 읽는다. 적 배율 · 증원 · 조건(diffHas)은 실제 등급 d 그대로
 */
export const oathDiffAdd = (d: number | undefined, heat: number | undefined) => ((d || 0) >= CFG.oathFrom ? Math.floor(Math.max(0, heat || 0) / CFG.oathDiffStep) : 0);
export const effDiff = (d: number | undefined, heat?: number) => (d || 0) + oathDiffAdd(d, heat);
/** 표기: '고난 (위험 9)' — 이름은 실제 등급에서(고난), 숫자는 실효 등급. 서약이 없거나 절망 수치가 모자라면 diffLabel 과 같다 */
export const effDiffLabel = (d: number, heat?: number) => { const e = effDiff(d, heat), n = diffName(d); return n ? `${n} (위험 ${e})` : `위험 ${e}`; };
/** 런의 절망 수치 (서약 없이 출격했으면 0) · 실효 위험 등급 */
export const runHeat = (r: { oaths?: OathSel; oathHeat?: number } | null | undefined) => (r?.oaths ? r.oathHeat ?? oathHeat(r.oaths) : 0);
export const runEffDiff = (r: { diff?: number; oaths?: OathSel; oathHeat?: number }) => effDiff(r.diff, runHeat(r));
/** 다음 표기 등급까지 남은 절망 수치 (서약이 걸리지 않는 등급이면 0) */
export const oathDiffNext = (d: number | undefined, heat: number) => ((d || 0) >= CFG.oathFrom ? CFG.oathDiffStep - (Math.max(0, heat) % CFG.oathDiffStep) : 0);
/** 단계 d 에서 조건 n 이 켜져 있는지 */
export const diffHas = (d: number | undefined, n: number) => (d || 0) >= n;
