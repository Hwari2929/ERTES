import type { Geo } from '../types';

/** 전투 지형 칸 (engine/combat.ts T_NOWALK · T_NOSHOT 비트와 같은 값): 물 = 통행 불가 (탄은 넘어감) · 유리 온실 = 통행 불가 (보이고 쏠 수 있음) · 벽 · 탱크 = 둘 다 막음 · 수문 = 닫히면 벽, 열리면 길 */
export type TerrainKind = 'water' | 'glass' | 'wall' | 'tank' | 'gate';
export const TERRAIN: Record<TerrainKind, { name: string; bits: number; desc: string; icon: string; lore: string }> = {
  water: { name: '물', bits: 1, icon: 'tr.water', desc: '지나갈 수 없지만 탄과 기술은 넘어간다', lore: '방역 시즌마다 물을 갈아 대는 인공 호수. 둑과 뭍길로만 건널 수 있다.' },
  glass: { name: '유리 온실', bits: 1, icon: 'tr.glass', desc: '지나갈 수 없지만 안이 보여 탄과 기술은 넘어간다', lore: '격리 재배 중인 사료 작물 온실. 유리벽 너머가 훤히 보이지만 문은 봉인돼 있다.' },
  wall: { name: '방벽', bits: 3, icon: 'tr.wall', desc: '지나갈 수도, 쏠 수도 없다', lore: '방역 구역을 가르는 두꺼운 차단벽.' },
  tank: { name: '배양 탱크', bits: 3, icon: 'tr.tank', desc: '지나갈 수도, 쏠 수도 없다', lore: '배양액이 가득 찬 원통형 탱크. 몸을 숨기기 좋다.' },
  gate: { name: '수문', bits: 3, icon: 'tr.gate', desc: '닫혀 있으면 방벽, 열리면 길', lore: '방역 수로의 차단 수문. 정해진 주기로 저절로 여닫힌다.' },
};
/** 지형 칸이 막는 것: 이동 · 탄도 (bits 에서) */
export const terrainBlocks = (k: TerrainKind) => ({ walk: !!(TERRAIN[k].bits & 1), shot: !!(TERRAIN[k].bits & 2) });

/** 전장 지형 틀 (가로 지형 rot 은 아래 구조를 돌려 그린다). 세로: 테두리 · 적 진형 · 사이 gap 줄 · 아군 진형 · (포위: 사이 gap 줄 · 아래 적 진형) · 테두리. 가로: 배치 폭 n (narrow 면 그 폭으로 줄인다) */
export interface MapDef {
  id: string;
  name: string;
  /** 편성 화면 머리 칩 툴팁 · 교범 */
  desc: string;
  /** 적 진형과 아군 진형 사이 줄 수 (기본 1) */
  gap?: number;
  /** 포위: 아군 진형 아래에 적 진형이 하나 더 (사이 gap 줄 같음), 적의 절반이 아래에서 나온다 */
  surround?: boolean;
  /** 배치 폭을 이 값으로 (통로) */
  narrow?: number;
  /** 아군 진형 줄 수 (기본 3). 저장 배치 r 이 이 줄 수까지 쓰인다 (다른 지형에서는 가까운 빈칸으로) */
  allyRows?: number;
  /** 이 전장(FieldDef.id)에서만 나온다 (없으면 공용) */
  field?: string;
  /** 지형 칸 (전장 좌표) */
  terrain?: (g: Geo) => { x: number; y: number; k: TerrainKind }[];
  /** 수문: 닫힘 · 열림 주기 (초, 닫힌 채 시작) */
  gateCycle?: [number, number];
  /** 복합 지형: 이 런에서 같은 전장 전용 틀이 한 번 나온 뒤부터 나온다 (첫 노출은 단순한 틀로) */
  later?: boolean;
  /** 가로 지형: 엔진에서는 세로 틀 그대로 (위 적 · 아래 아군), 화면에서만 시계 방향 90° 돌려 그린다 → 적은 오른쪽(포위면 양옆), 아군은 왼쪽(포위면 가운데) */
  rot?: boolean;
  /** 공용 틀 뽑기 무게 (기본 1) */
  weight?: number;
}

/** 사이 줄(mid) 칸을 패턴으로: 문자열 한 줄 = mid 한 줄, 한 글자 = 배치 열 하나 (폭이 다르면 가운데 기준으로 늘이거나 자른다).
 *  '.' 빈칸 · '~' 물 · 'g' 유리 온실 · '#' 방벽 · 'T' 배양 탱크 · '=' 수문 */
const KIND: Record<string, TerrainKind | null> = { '.': null, '~': 'water', g: 'glass', '#': 'wall', T: 'tank', '=': 'gate' };
function pattern(rows: string[]) {
  return (g: Geo) => {
    const out: { x: number; y: number; k: TerrainKind }[] = [];
    rows.forEach((row, i) => {
      const y = g.ay0 - rows.length + i;
      for (let c = 0; c < g.n; c++) {
        // 양 끝 글자는 양 끝 열에 그대로, 안쪽은 폭에 맞춰 늘이거나 줄인다 (패턴 폭 7 기준)
        const L = row.length, k = c === 0 ? 0 : c === g.n - 1 ? L - 1 : Math.round(1 + ((c - 1) * (L - 3)) / Math.max(1, g.n - 3));
        const kind = KIND[row[Math.max(0, Math.min(L - 1, k))]];
        if (kind) out.push({ x: g.x0 + c, y, k: kind });
      }
    });
    return out;
  };
}

export const MAPS: MapDef[] = [
  { id: 'open', name: '개활지', desc: '막힌 곳 없는 평지.' },
  // ── 공용 지형 틀
  { id: 'corridor', name: '긴 통로', narrow: 4, allyRows: 4, gap: 5, desc: '좁고 긴 통로. 적이 줄지어 다가온다.' },
  { id: 'surround', name: '포위', surround: true, desc: '아군이 가운데, 적이 위아래에서 조여 온다.' },
  { id: 'hcorridor', name: '가로 통로', rot: true, narrow: 4, allyRows: 4, gap: 9, weight: 0.5, desc: '아주 긴 가로 통로. 적이 오른쪽 끝에서 줄지어 온다.' },
  { id: 'hsurround', name: '가로 포위', rot: true, surround: true, narrow: 5, allyRows: 4, gap: 4, weight: 0.5, desc: '긴 전장 한가운데에 아군, 적이 양옆에서 조여 온다.' },
  // ── 리빈 낙원동 (방역 시즌)
  { id: 'lv_gate', field: 'livin', name: '방역 수문', gap: 3, gateCycle: [8, 6],
    desc: '방벽이 가운데를 가르고, 수문이 주기적으로 여닫힌다. 양 끝은 우회로.',
    terrain: pattern(['.......', '.##=##.', '.......']) },
  { id: 'lv_lake', field: 'livin', name: '호수변 관측소', gap: 3,
    desc: '호수를 사이에 두고 양쪽 뭍길로만 건넌다. 물 너머로는 쏠 수 있다.',
    terrain: pattern(['..~~~..', '.~~~~~.', '..~~~..']) },
  { id: 'lv_farm', field: 'livin', name: '격리 재배 구획', gap: 3, later: true,
    desc: '온실과 배양 탱크가 길을 나눈다. 입구가 좁다.',
    terrain: pattern(['gg.T.gg', '...T...', 'T..g..T']) },
];
export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
export const mapOf = (id?: string) => MAP_BY_ID[id || 'open'] || MAP_BY_ID.open;

/** 지형 지물: 같은 종류의 지형 칸이 상하좌우로 이어진 덩어리 (호수 하나 · 온실 한 동 · 방벽 한 줄). 편성 · 전투 화면에서 누르면 덩어리 전체를 표시하고 성질을 보여 준다 */
export interface TerrainGroup { id: number; k: TerrainKind; cells: { x: number; y: number }[] }
export function terrainGroups(g: Geo): TerrainGroup[] {
  const cells = mapOf(g.map).terrain?.(g) || [];
  const at = new Map(cells.map((c) => [`${c.x},${c.y}`, c]));
  const seen = new Set<string>(), out: TerrainGroup[] = [];
  for (const c of cells) {
    const key = `${c.x},${c.y}`;
    if (seen.has(key)) continue;
    const grp: TerrainGroup = { id: out.length, k: c.k, cells: [] }, q = [c];
    seen.add(key);
    while (q.length) {
      const p = q.pop()!;
      grp.cells.push({ x: p.x, y: p.y });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k2 = `${p.x + dx},${p.y + dy}`, n = at.get(k2);
        if (n && n.k === c.k && !seen.has(k2)) { seen.add(k2); q.push(n); }
      }
    }
    out.push(grp);
  }
  return out;
}
