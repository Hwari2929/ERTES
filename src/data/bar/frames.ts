// 에란테스 바: 확장 만담 '핵심 틀 + 끼어들기 슬롯'.
// 핵심 대화(두 인물, 2~5줄) 사이에 '@0' '@1' 자리가 있고, 그 자리에는 지금 바에 있는 3번째 단원의 대사가 들어간다.
// 후보가 아무도 없으면 그 자리는 건너뛴다 (건너뛰어도 핵심 대화만으로 읽힌다).
// 같은 틀도 끼어든 단원이 다르면 다른 장면이다 → 본 기록은 '틀 id + 끼어든 인물'.
//
// 줄 형식: '이름: 대사' · '* 서술' · '@n' (슬롯). 슬롯 후보의 줄은 이름이 없으면 그 후보가 말한다.
// 층: s 표면(개그 · 소재) · i 이상(가치 · 입장) · r 실재(상처 · 기제, 심야 · 관계가 쌓인 뒤에만: deep 인물 기준)
// 로어는 재료로만 쓴다 (docs/SCENES.md 3차 지침). 인물마다 입장이 갈리게.
import { FRAMES_A } from './frames_a';
import { FRAMES_B } from './frames_b';

export type FrameTheme = 'gag' | 'trend' | 'politics' | 'debate';
export const FRAME_THEME: Record<FrameTheme, string> = { gag: '뜬금없는 소리', trend: '요즘 유행', politics: '시사 · 정치', debate: '진지한 토론' };

export interface Frame {
  id: string;
  theme: FrameTheme;
  layer: 's' | 'i' | 'r';
  /** 실재 층: 이 인물과의 관계가 쌓여야 열린다 */
  deep?: string;
  /** 상황 한 줄 (구경 화면 위쪽 · 도감) */
  sit: string;
  /** 핵심 두 인물 (화자 id) */
  cast: string[];
  lines: string[];
  /** 슬롯별 후보 → 대사 */
  slots: Record<string, string[]>[];
}

export const FRAMES: Frame[] = [...FRAMES_A, ...FRAMES_B];
export const FRAME_BY_ID: Record<string, Frame> = Object.fromEntries(FRAMES.map((f) => [f.id, f]));
