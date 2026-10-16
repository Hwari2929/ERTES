// 에란테스 바: 런 기록 반응 규칙. 기록(src/ui/meta.ts)을 읽어 조건이 맞는 반응 하나를 고른다.
// 대사는 talk.ts 의 BAR_TALK[기물].react[키] (없으면 GENERIC_REACT). 우선순위가 높은 것부터, 같은 런 결과에 같은 반응은 한 번만.
import type { BarLast } from '../../ui/meta';
import type { ReactKey } from './talk';

export interface ReactCtx {
  /** 완료한 런 수 */
  runs: number;
  /** 직전 런 요약 (없으면 반응 대부분이 꺼진다) */
  last?: BarLast;
  /** 기물별 마지막으로 기용한 런 번호 */
  used: Record<string, number>;
  /** 진행 중인 런 (자동 저장): 전장 · 페이즈 · 출전 기물 */
  resume?: { field: string; phase: number; units: string[] };
}
export interface ReactRule {
  key: ReactKey;
  /** 높을수록 먼저 */
  pri: number;
  /** 도감 · 문서용 설명 */
  desc: string;
  /** 맞으면 치환 변수, 아니면 null. {field} 는 전장 id 로 넘기고 화면에서 이름으로 바꾼다 */
  test: (c: ReactCtx, id: string, watch: boolean) => Record<string, string> | null;
}

const inLast = (c: ReactCtx, id: string) => !!c.last?.units.includes(id);
/** 바에서 홀로그램으로 지켜본 인물 (watch: 에이든): 출전하지 않았을 때 전장 · 사건 이야기를 한다 */
const saw = (c: ReactCtx, id: string, w: boolean) => !!c.last && (w ? !inLast(c, id) : inLast(c, id));
/** 오래 안 쓴 기준: 마지막 기용 뒤로 이만큼 런이 지났다 */
export const NEGLECT_RUNS = 3;

export const REACT_RULES: ReactRule[] = [
  { key: 'mvp', pri: 100, desc: '직전 런 MVP (전투 MVP 최다)', test: (c, id) => (c.last?.mvp === id ? { field: c.last.field } : null) },
  { key: 'neglect', pri: 85, desc: `마지막 기용 뒤 ${NEGLECT_RUNS}런 이상 쉬었다`, test: (c, id) => {
    const u = c.used[id];
    return u !== undefined && c.runs - u >= NEGLECT_RUNS ? { gap: String(c.runs - u) } : null;
  } },
  { key: 'clear', pri: 80, desc: '직전 런 의뢰 성공에 함께했다 (지켜본 인물은 출전 무관)', test: (c, id, w) => ((w || inLast(c, id)) && c.last?.cleared ? { field: c.last!.field } : null) },
  { key: 'wipe', pri: 80, desc: '직전 런 전멸에 함께했다 (지켜본 인물은 출전 무관)', test: (c, id, w) => ((w || inLast(c, id)) && c.last && !c.last.cleared ? { field: c.last!.field, phase: String(c.last!.phase) } : null) },
  { key: 'newEvent', pri: 70, desc: '직전 런에서 처음 겪은 사건이 있다 (함께했거나, 지켜본 인물은 바에 있었을 때)', test: (c, id, w) => (saw(c, id, w) && c.last!.newEvents.length ? { event: c.last!.newEvents[0] } : null) },
  { key: 'mvpOther', pri: 65, desc: '직전 런을 함께했고 MVP 는 다른 단원', test: (c, id) => (inLast(c, id) && c.last!.mvp && c.last!.mvp !== id ? { mvp: c.last!.mvp } : null) },
  { key: 'field', pri: 60, desc: '직전 런 전장 이야기 (함께했거나, 지켜본 인물은 바에 있었을 때)', test: (c, id, w) => (saw(c, id, w) ? { field: c.last!.field } : null) },
  { key: 'resume', pri: 50, desc: '진행 중인 런에 출전해 있다', test: (c, id) => (c.resume?.units.includes(id) ? { field: c.resume.field, phase: String(c.resume.phase) } : null) },
];
