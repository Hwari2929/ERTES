// 전투 중 바뀌는 지형 지물의 지금 상태 (engine/mapfx.ts 가 b.mem 에 둔 값에서): 지형 상세 이름 옆 상태 칩 · 전투 보드 카운트다운 배지가 같이 쓴다
import { CFG } from '../config';
import { laserSets, type TerrainGroup, terrainOf } from '../data/maps';
import type { Battle } from '../engine/combat';
import type { Geo } from '../types';

/** st = 지금 상태 · cls = 상태 칩 색 (good 좋음 · bad 위험) · cd = 배지 (다음에 일어날 일 · 남은 초) · soon = 곧 일어남 (배지가 깜빡인다) · key = 바뀌었는지 비교용 */
export interface DynLive { st: string; cls: '' | 'good' | 'bad'; cd?: { what: string; left: number }; soon: boolean; key: string }
const leftOf = (b: Battle, at: number | undefined) => Math.max(0, Math.ceil((at ?? 0) - b.t - 1e-9));
const SOON = 3;

export function dynLive(b: Battle, g: Geo, grp: TerrainGroup): DynLive | null {
  const C = CFG.maps, k = grp.k;
  const out = (st: string, cls: DynLive['cls'], cd?: DynLive['cd'], soon = !!cd && cd.left <= SOON): DynLive => ({ st, cls, cd, soon, key: `${st}|${cd?.what}|${cd?.left}` });
  if (k === 'holo' && b.mem.holoNext !== undefined) { const on = !!b.mem.holoOn; return out(on ? '켜짐' : '꺼짐', on ? '' : 'good', { what: on ? '꺼짐' : '켜짐', left: leftOf(b, b.mem.holoNext) }); }
  if (k === 'laser' && b.mem.laserNext !== undefined) {
    const on = laserSets(terrainOf(g)).get(grp.cells[0].y) === b.mem.laserOn;
    return out(on ? '켜짐' : '꺼짐', on ? 'bad' : 'good', { what: on ? '꺼짐' : '켜짐', left: leftOf(b, b.mem.laserNext) });
  }
  if (k === 'vault' && b.mem.vaultNext !== undefined) {
    const open = grp.cells.filter((c) => !b.terrainAt(c.x, c.y)).length;
    return out(`틈 ${open}칸`, '', { what: '회전', left: leftOf(b, b.mem.vaultNext) });
  }
  if (k === 'power') {
    if (grp.off) return out('차단', 'good');
    if (b.mem.powNext === undefined) return null;
    if (b.mem.powLive) return out('전류 흐름', 'bad', undefined, true);
    const left = leftOf(b, b.mem.powNext);
    return out('꺼짐', '', { what: '전류', left }, left <= C.power.warn);
  }
  if (k === 'sprinkler' && b.mem.sprNext !== undefined) return out('대기', '', { what: '살수', left: leftOf(b, b.mem.sprNext) });
  if (k === 'vaultcell' && b.mem.vaultT !== undefined) {
    const N = C.vaultCell;
    return b.mem.vaultPay ? out(`반출 +${b.mem.vaultPay}`, 'good') : out(`${Math.floor(b.mem.vaultT)}/${N.need}초`, '', undefined, false);
  }
  return null;
}
