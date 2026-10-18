// 철수 봇: 판단 기록 (dlog 인자). 고른 행동 · 팀 가치 변화 · 유력 대안 · 이유를 남겨, 점수는 높은데 실제로 약한 선택이 생기면 평가 규칙을 추적한다.
import type { RunState } from '../../src/types';

export interface DEntry { ph: number; st: number; k: string; pick: string; v0: number; v1: number; alt: string[]; why?: string }
export class DLog {
  on: boolean;
  list: DEntry[] = [];
  constructor(private run: RunState, on: boolean) { this.on = on; }
  add(k: string, pick: string, v0: number, v1: number, alt: string[], why?: string) {
    if (!this.on) return;
    const r = (x: number) => Math.round(x);
    this.list.push({ ph: this.run.phase, st: this.run.step, k, pick, v0: r(v0), v1: r(v1), alt, ...(why ? { why } : {}) });
  }
}
