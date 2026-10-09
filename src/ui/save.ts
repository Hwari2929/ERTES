import { SAVE_VERSION } from '../engine/run';
import type { RunState } from '../types';

const PREFIX = 'errantes.v1.';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
export const SLOT_NAME: Record<string, string> = { auto: '자동 저장', slot1: '슬롯 1', slot2: '슬롯 2', slot3: '슬롯 3' };

function ls(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export interface SaveMeta { slot: string; phase: number; step: number; hp: number; units: number; time: number }

export function saveRun(run: RunState, slot: string): boolean {
  try {
    ls()?.setItem(PREFIX + slot, JSON.stringify({ time: Date.now(), run }));
    return !!ls();
  } catch { return false; }
}
export function loadRun(slot: string): RunState | null {
  try {
    const raw = ls()?.getItem(PREFIX + slot);
    if (!raw) return null;
    return validate(JSON.parse(raw).run);
  } catch { return null; }
}
export function deleteSave(slot: string) { try { ls()?.removeItem(PREFIX + slot); } catch { /* 무시 */ } }

export function listSaves(): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const slot of SLOTS) {
    try {
      const raw = ls()?.getItem(PREFIX + slot);
      if (!raw) continue;
      const { time, run } = JSON.parse(raw);
      out.push({ slot, phase: run.phase, step: run.step, hp: run.hp, units: run.units.length, time });
    } catch { /* 손상된 슬롯 무시 */ }
  }
  return out;
}

function validate(run: unknown): RunState | null {
  const r = run as RunState;
  if (!r || typeof r !== 'object' || r.version !== SAVE_VERSION || !Array.isArray(r.units)) return null;
  return r;
}

// 저장 코드: UTF-8 JSON → base64
export function exportCode(run: RunState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(run));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'ERR1:' + btoa(bin);
}
export function importCode(code: string): RunState | null {
  try {
    const s = code.trim();
    if (s.startsWith('{')) return validate(JSON.parse(s));
    const bin = atob(s.replace(/^ERR1:/, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return validate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return null; }
}
