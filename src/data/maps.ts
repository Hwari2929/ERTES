import type { Geo } from '../types';

/** 전투 지형 칸 (engine/combat.ts T_NOWALK · T_NOSHOT 비트와 같은 값): 물 = 통행 불가 (탄은 넘어감) · 유리 온실 = 통행 불가 (보이고 쏠 수 있음) · 벽 · 탱크 = 둘 다 막음 · 수문 = 닫히면 벽, 열리면 길 */
export type TerrainKind = 'water' | 'glass' | 'wall' | 'tank' | 'gate';
export const TERRAIN: Record<TerrainKind, { name: string; bits: number; desc: string }> = {
  water: { name: '물', bits: 1, desc: '지나갈 수 없지만 탄과 기술은 넘어간다' },
  glass: { name: '유리 온실', bits: 1, desc: '지나갈 수 없지만 안이 보여 탄과 기술은 넘어간다' },
  wall: { name: '방벽', bits: 3, desc: '지나갈 수도, 쏠 수도 없다' },
  tank: { name: '배양 탱크', bits: 3, desc: '지나갈 수도, 쏠 수도 없다' },
  gate: { name: '수문', bits: 3, desc: '닫혀 있으면 방벽, 열리면 길' },
};

/** 전장 지형 틀. 세로: 테두리 · 적 진형 · 사이 gap 줄 · 아군 진형 · (포위: 사이 gap 줄 · 아래 적 진형) · 테두리. 가로: 배치 폭 n (narrow 면 그 폭으로 줄인다) */
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
  /** 이 전장(FieldDef.id)에서만 나온다 (없으면 공용) */
  field?: string;
  /** 지형 칸 (전장 좌표) */
  terrain?: (g: Geo) => { x: number; y: number; k: TerrainKind }[];
  /** 수문: 닫힘 · 열림 주기 (초, 닫힌 채 시작) */
  gateCycle?: [number, number];
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
  { id: 'open', name: '개활지', desc: '막힌 곳 없는 평지. 적 진형과 아군 진형 사이가 1줄.' },
  // ── 공용 지형 틀
  { id: 'corridor', name: '긴 통로', narrow: 4, gap: 5, desc: '폭 4칸 · 사이 5줄의 좁고 긴 통로. 적이 길게 늘어서 다가오고, 원거리 기물이 오래 쏠 수 있다. 바리케이드 하나로도 길을 크게 막는다.' },
  { id: 'surround', name: '포위', surround: true, desc: '아군 진형이 가운데, 적 진형이 위아래에 하나씩. 적의 절반이 아래에서 나와 양쪽에서 조여 온다.' },
  // ── 리빈 낙원동 (방역 시즌)
  { id: 'lv_gate', field: 'livin', name: '방역 수문', gap: 3, gateCycle: [8, 6],
    desc: '가운데 줄을 방벽이 가로지르고, 한가운데 수문이 8초 닫혔다 6초 열린다 (닫힌 채 시작). 양 끝 1칸은 늘 열린 우회로.',
    terrain: pattern(['.......', '.##=##.', '.......']) },
  { id: 'lv_lake', field: 'livin', name: '호수변 관측소', gap: 3,
    desc: '가운데가 둥근 호수 (지나갈 수 없지만 탄과 기술은 넘어간다). 양 가장자리 뭍길로만 건너가고, 가운데 줄은 1칸으로 좁아진다 — 원거리 기물은 물 너머로 쏠 수 있다.',
    terrain: pattern(['..~~~..', '.~~~~~.', '..~~~..']) },
  { id: 'lv_farm', field: 'livin', name: '격리 재배 구획', gap: 3,
    desc: '유리 온실 (보이지만 못 지나감)과 배양 탱크 (못 지나가고 가림)가 사이를 나눈다. 입구가 좁아 지뢰 · 바리케이드로 막기 좋다.',
    terrain: pattern(['gg.T.gg', '...T...', 'T..g..T']) },
];
export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
export const mapOf = (id?: string) => MAP_BY_ID[id || 'open'] || MAP_BY_ID.open;
