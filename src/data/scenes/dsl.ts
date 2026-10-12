// 연출 작성용 짧은 생성자. N = 서술, S = 대사, T = 독백, SUB = 동적 조연 자리
import type { Beat } from '../scene';

type Opt = Omit<Beat, 'text' | 'who' | 'think'>;
export const N = (text: string, o: Opt = {}): Beat => ({ text, ...o });
export const S = (who: string, text: string, o: Opt & { name?: string } = {}): Beat => ({ who, text, ...o });
export const T = (who: string, text: string, o: Opt = {}): Beat => ({ who, think: true, text, ...o });
export const SUB = { slot: 'sub' } as const;
