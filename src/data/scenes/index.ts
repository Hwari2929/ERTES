// 사건 연출 모음: 사건 id → 연출. 연출이 없는 사건은 기존 text 를 서술 한 줄로 보여 준다.
import type { EventScene } from '../scene';
import { PILOT_SCENES } from './pilot';

export const EVENT_SCENES: Record<string, EventScene> = { ...PILOT_SCENES };
