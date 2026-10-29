import { CFG } from '../config';
import type { Geo, MapOpt } from '../types';

/** 긴 통로 폭 5칸 몫 (페이즈별, CFG.maps.wide5) */
const wide5 = (p: number) => CFG.maps.wide5[Math.min(CFG.maps.wide5.length, Math.max(1, p)) - 1];

/** 전투 지형 칸 (engine/combat.ts T_NOWALK · T_NOSHOT 비트와 같은 값): 물 = 통행 불가 (탄은 넘어감) · 유리 온실 = 통행 불가 (보이고 쏠 수 있음) · 벽 · 탱크 = 둘 다 막음 · 수문 = 닫히면 벽, 열리면 길.
 *  물류망(swarm): 진공 틈 = 통행 불가 (탄은 넘어감) · 연결교 = 길 (위에 서면 받는 피해 +taken) · 컨테이너 = 둘 다 막음 (크레인으로 옮긴다) · 선로 = 길 (운반차가 지나간다) · 광석 더미 = 둘 다 막음 */
export type TerrainKind = 'water' | 'glass' | 'wall' | 'tank' | 'gate' | 'void' | 'bridge' | 'container' | 'rail' | 'ore';
export const TERRAIN: Record<TerrainKind, { name: string; bits: number; desc: string; icon: string; lore: string; /** 위에 선 기물이 받는 피해 증가 (몫) */ taken?: number }> = {
  water: { name: '물', bits: 1, icon: 'tr.water', desc: '지나갈 수 없지만 탄과 기술은 넘어간다', lore: '방역 시즌마다 물을 갈아 대는 인공 호수. 둑과 뭍길로만 건널 수 있다.' },
  glass: { name: '유리 온실', bits: 1, icon: 'tr.glass', desc: '지나갈 수 없지만 안이 보여 탄과 기술은 넘어간다', lore: '격리 재배 중인 사료 작물 온실. 유리벽 너머가 훤히 보이지만 문은 봉인돼 있다.' },
  wall: { name: '방벽', bits: 3, icon: 'tr.wall', desc: '지나갈 수도, 쏠 수도 없다', lore: '방역 구역을 가르는 두꺼운 차단벽.' },
  tank: { name: '배양 탱크', bits: 3, icon: 'tr.tank', desc: '지나갈 수도, 쏠 수도 없다', lore: '배양액이 가득 찬 원통형 탱크. 몸을 숨기기 좋다.' },
  gate: { name: '수문', bits: 3, icon: 'tr.gate', desc: '닫혀 있으면 방벽, 열리면 길', lore: '방역 수로의 차단 수문. 정해진 주기로 저절로 여닫힌다.' },
  void: { name: '진공 틈', bits: 1, icon: 'tr.void', desc: '지나갈 수 없지만 탄과 기술은 넘어간다', lore: '도킹 고리가 뜯겨 나간 자리. 별빛 너머로 쏠 수는 있어도 건널 수는 없다.' },
  bridge: { name: '연결교', bits: 0, icon: 'tr.bridge', taken: CFG.maps.bridgeTaken, desc: '건널 수 있지만 엄폐가 없어 위에 선 기물이 피해를 더 받는다', lore: '두 선체를 잇던 비상 연결교. 군체가 갉아 먹어 난간 하나 남지 않았다.' },
  container: { name: '컨테이너', bits: 3, icon: 'tr.container', desc: '지나갈 수도, 쏠 수도 없다 · 전투 전에 크레인으로 옮긴다', lore: '수도로 가지 못한 연합 보급품. 봉인 위에 포자가 눌어붙었다.' },
  rail: { name: '선로', bits: 0, icon: 'tr.rail', desc: '건널 수 있지만 광석 운반차가 정해진 시각에 지나간다', lore: '무인 광석 운반차가 아직도 돈다. 실어 보낼 곳이 사라진 줄도 모르고.' },
  ore: { name: '광석 더미', bits: 3, icon: 'tr.ore', desc: '지나갈 수도, 쏠 수도 없다', lore: '실어 가지 못한 정련 광석. 군체 점액이 굳어 돌더미처럼 단단하다.' },
};
/** 지형 칸이 막는 것: 이동 · 탄도 (bits 에서) */
export const terrainBlocks = (k: TerrainKind, bits = TERRAIN[k].bits) => ({ walk: !!(bits & 1), shot: !!(bits & 2) });
/** 지형 칸 하나: crate = 컨테이너 번호 (같은 번호끼리만 한 덩어리) · bits = 실제로 막는 것 (없으면 종류 기본값, 접은 연결교는 1) */
export interface TCell { x: number; y: number; k: TerrainKind; crate?: number; bits?: number }
/** 크레인 적재칸 (전장 좌표, 왼쪽 위 x · y, 폭 w · 높이 h): 같은 크기의 컨테이너만 들어간다 */
export interface Bay { x: number; y: number; w: number; h: number }

/** 전장 지형 틀 (가로 지형 rot 은 아래 구조를 돌려 그린다). 세로: 테두리 · 적 진형 · 사이 gap 줄 · 아군 진형 · (포위: 사이 gap 줄 · 아래 적 진형) · 테두리. 가로: 배치 폭 n (narrow 면 그 폭으로 줄인다) */
export interface MapDef {
  id: string;
  name: string;
  /** 편성 화면 '이번 전투' 지형 설명 줄 · 교범 */
  desc: string;
  /** 적 진형과 아군 진형 사이 줄 수 (기본 1) */
  gap?: number;
  /** 포위: 아군 진형 아래에 적 진형이 하나 더 (사이 gap 줄 같음), 적의 절반이 아래에서 나온다 */
  surround?: boolean;
  /** 배치 폭을 이 값으로 (통로) */
  narrow?: number;
  /** 공용 틀 안에서의 무게 배율 (페이즈에 따라, 기본 1) — 긴 통로 4칸 · 5칸이 한 자리를 나눠 가진다 */
  phaseW?: (phase: number) => number;
  /** 아군 진형 줄 수 (기본 3). 저장 배치 r 이 이 줄 수까지 쓰인다 (다른 지형에서는 가까운 빈칸으로) */
  allyRows?: number;
  /** 이 전장(FieldDef.id)에서만 나온다 (없으면 공용) */
  field?: string;
  /** 지형 칸 (전장 좌표, 처음 모양) — 편성 화면 선택을 반영한 실제 칸은 terrainOf */
  terrain?: (g: Geo) => TCell[];
  /** 크레인 적재칸 (컨테이너를 옮길 수 있는 빈 자리) */
  bays?: (g: Geo) => Bay[];
  /** 광석 운반차가 다니는 틀 (값 = 조우 정보가 없을 때의 첫 방향, 1 = 오른쪽으로). 실제 첫 방향은 조우마다 무작위 (build.ts cartDirOf → Geo.opt.cart), 이후 번갈아. 시각 · 피해는 CFG.maps.cart */
  cartDir?: 1 | -1;
  /** 수문: 닫힘 · 열림 주기 (초, 닫힌 채 시작) */
  gateCycle?: [number, number];
  /** 복합 지형: 이 런에서 같은 전장 전용 틀이 한 번 나온 뒤부터 나온다 (첫 노출은 단순한 틀로) */
  later?: boolean;
  /** 가로 지형: 엔진에서는 세로 틀 그대로 (위 적 · 아래 아군), 화면에서만 시계 방향 90° 돌려 그린다 → 적은 오른쪽(포위면 양옆), 아군은 왼쪽(포위면 가운데) */
  rot?: boolean;
  /** 공용 틀 뽑기 무게 (기본 1) */
  weight?: number;
}

/** 사이 줄(mid) 칸을 패턴으로: 문자열 한 줄 = mid 한 줄, 한 글자 = 배치 열 하나.
 *  '.' 빈칸 · '~' 물 · 'g' 유리 온실 · '#' 방벽 · 'T' 배양 탱크 · '=' 수문 · 'v' 진공 틈 · 'b' 연결교 · 'r' 선로 · 'o' 광석 더미 · 'A'~'Z' 컨테이너 (글자 순서 = 번호)
 *  그 밖의 소문자 = 크레인 적재칸 (같은 글자끼리 한 자리, 사각형, 처음엔 빈칸) */
const KIND: Record<string, TerrainKind | null> = { '.': null, '~': 'water', g: 'glass', '#': 'wall', T: 'tank', '=': 'gate', v: 'void', b: 'bridge', r: 'rail', o: 'ore' };
/** 패턴 열 고르기: 양 끝 글자는 양 끝 열에 그대로, 안쪽은 폭에 맞춰 늘이거나 줄인다 (패턴 폭 7 기준) */
const colOf = (c: number, n: number, L: number) => Math.max(0, Math.min(L - 1, c === 0 ? 0 : c === n - 1 ? L - 1 : Math.round(1 + ((c - 1) * (L - 3)) / Math.max(1, n - 3))));
/** 패턴 한 장을 칸마다: 폭별 패턴(Record)에 그 폭이 있으면 그대로 (모양이 늘어나지 않게), 없으면 7칸 패턴을 늘이거나 줄여서 */
function gridOf(rows: string[] | Record<number, string[]>, g: Geo, f: (ch: string, x: number, y: number) => void) {
  const exact = Array.isArray(rows) ? undefined : rows[g.n], rs = Array.isArray(rows) ? rows : exact || rows[7];
  rs.forEach((row, i) => {
    const y = g.ay0 - rs.length + i;
    for (let c = 0; c < g.n; c++) f(row[exact ? Math.min(row.length - 1, c) : colOf(c, g.n, row.length)], g.x0 + c, y);
  });
}
function pattern(rows: string[] | Record<number, string[]>) {
  return (g: Geo) => {
    const out: TCell[] = [];
    gridOf(rows, g, (ch, x, y) => {
      if (ch >= 'A' && ch <= 'Z' && ch !== 'T') out.push({ x, y, k: 'container', crate: ch.charCodeAt(0) - 65 });
      else { const kind = KIND[ch]; if (kind) out.push({ x, y, k: kind }); }
    });
    return out;
  };
}
function bays(rows: Record<number, string[]>) {
  return (g: Geo): Bay[] => {
    const at = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    gridOf(rows, g, (ch, x, y) => {
      if (!(ch >= 'a' && ch <= 'z') || ch in KIND) return;
      const r = at.get(ch);
      if (!r) at.set(ch, { x0: x, y0: y, x1: x, y1: y });
      else Object.assign(r, { x0: Math.min(r.x0, x), y0: Math.min(r.y0, y), x1: Math.max(r.x1, x), y1: Math.max(r.y1, y) });
    });
    return [...at.keys()].sort().map((k) => { const r = at.get(k)!; return { x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 }; });
  };
}
/** 도킹 연결부 (폭 6 · 7 · 8): 가운데 1칸 연결교 (짝수 폭은 가운데 오른쪽 열) · 양 끝 1칸 통로 · 사이는 진공 틈 */
const DOCK: Record<number, string[]> = { 6: Array(3).fill('.vvbv.'), 7: Array(3).fill('.vvbvv.'), 8: Array(3).fill('.vvvbvv.') };
/** 컨테이너 환적장 (폭 6 · 7 · 8): A 2×2 · B · C 1×2 컨테이너 (폭 6 은 A · B), 적재칸 p · s · u 1×2 · q 2×2 */
const YARD: Record<number, string[]> = {
  6: ['.AA.BB', '.AAqq.', 'pp.qq.'],
  7: ['.AAqqBB', '.AAqquu', 'ppssCC.'],
  8: ['.AA.qqBB', '.AA.qquu', 'ppss.CC.'],
};
/** 쌍둥이 연결교 (폭 6 · 7 · 8): 가운데 통로 · 양쪽 1칸 연결교 · 사이는 진공 틈 */
const TWIN: Record<number, string[]> = { 6: Array(3).fill('vb..bv'), 7: Array(3).fill('vbv.vbv'), 8: Array(3).fill('vbv..vbv') };
/** 광석 야적장 (폭 6 · 7 · 8): 가운데 진공 틈 · 양옆 광석 더미 */
const ORE: Record<number, string[]> = {
  6: ['o.vv.o', '..vv..', 'o.vv.o'],
  7: ['oo.v.oo', '...v...', 'oo.v.oo'],
  8: ['oo.vv.oo', '...vv...', 'oo.vv.oo'],
};
/** 광석 하역장 (폭 6 · 7 · 8): 위 A · B 1×2 컨테이너 · 가운데 선로 · 아래 적재칸 p · q 1×2 */
const UNLOAD: Record<number, string[]> = {
  6: ['AA..BB', 'rrrrrr', 'pp..qq'],
  7: ['.AA.BB.', 'rrrrrrr', '.pp.qq.'],
  8: ['.AA..BB.', 'rrrrrrrr', '.pp..qq.'],
};
/** 배양 탱크 창고 (폭 6 · 7 · 8): 위 탱크 엄폐 · 아래 방벽 (가운데 길 · 수문 2개) */
const DEPOT: Record<number, string[]> = {
  6: ['T.TT.T', '......', '#=..=#'],
  7: ['T.T.T.T', '.......', '#=#.#=#'],
  8: ['T.T..T.T', '........', '#=#..#=#'],
};

export const MAPS: MapDef[] = [
  { id: 'open', name: '개활지', desc: '막힌 곳 없는 평지.' },
  // ── 공용 지형 틀
  { id: 'corridor', name: '긴 통로', narrow: 4, phaseW: (p) => 1 - wide5(p), allyRows: 4, gap: 5, desc: '좁고 긴 통로. 적이 줄지어 다가온다.' },
  { id: 'corridor5', name: '긴 통로', narrow: 5, phaseW: wide5, allyRows: 4, gap: 5, desc: '좁고 긴 통로. 적이 줄지어 다가온다.' },
  { id: 'surround', name: '포위', surround: true, weight: 0.5, desc: '아군이 가운데, 적이 위아래에서 조여 온다.' },
  { id: 'hcorridor', name: '가로 통로', rot: true, narrow: 4, allyRows: 4, gap: 9, weight: 0.5, desc: '아주 긴 가로 통로. 적이 오른쪽 끝에서 줄지어 온다.' },
  { id: 'hsurround', name: '가로 포위', rot: true, surround: true, narrow: 5, allyRows: 4, gap: 4, weight: 0.25, desc: '긴 전장 한가운데에 아군, 적이 양옆에서 조여 온다.' },
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
  { id: 'lv_canal', field: 'livin', name: '방역 수로', gap: 3, gateCycle: [6, 6],
    desc: '수로가 전장을 가로지른다. 수문 2개가 주기적으로 여닫히며 건널목이 되고, 양 끝은 뭍길. 물 너머로는 쏠 수 있다.',
    terrain: pattern(['..T.T..', '.~=~=~.', '.......']) },
  { id: 'lv_green', field: 'livin', name: '온실 회랑', gap: 3, later: true,
    desc: '유리 온실이 줄지어 서 좁은 골목을 만든다. 온실 너머로는 보이고 쏠 수 있다.',
    terrain: pattern({ 6: ['g.gg.g', '..~~..', 'g.gg.g'], 7: ['g.g.g.g', '.~...~.', 'g.g.g.g'], 8: ['g.g..g.g', '.~....~.', 'g.g..g.g'] }) },
  { id: 'lv_depot', field: 'livin', name: '배양 탱크 창고', gap: 3, later: true, gateCycle: [8, 5],
    desc: '배양 탱크가 엄폐가 되고, 아래 방벽은 가운데 길과 주기적으로 여닫히는 수문 2개로만 지난다.',
    terrain: pattern(DEPOT) },
  // ── 베르타–산노디스 물류망 (군체가 끊은 연합 수도 물류망)
  { id: 'sw_dock', field: 'swarm', name: '도킹 연결부', gap: 3,
    desc: '진공 틈을 가운데 연결교와 양 끝 통로로만 건넌다. 연결교 위는 엄폐가 없다. 전투 전에 연결교를 접을 수 있다.',
    terrain: pattern(DOCK) },
  { id: 'sw_yard', field: 'swarm', name: '컨테이너 환적장', gap: 3, later: true,
    desc: '컨테이너가 길과 사선을 막는다. 전투 전에 크레인으로 컨테이너를 빈 적재칸에 옮길 수 있다.',
    terrain: pattern(YARD), bays: bays(YARD) },
  { id: 'sw_rail', field: 'swarm', name: '광석 운반차 선로', gap: 3, later: true, cartDir: 1,
    desc: '가운데 선로로 광석 운반차가 정해진 시각에 지나가며, 선로 위 기물을 아군 · 적 가리지 않고 쳐 낸다.',
    terrain: pattern(['..o..o.', 'rrrrrrr', '.o..o..']) },
  { id: 'sw_twin', field: 'swarm', name: '쌍둥이 연결교', gap: 3,
    desc: '진공 틈 사이로 가운데 통로와 양쪽 연결교 2개. 연결교 위는 엄폐가 없다. 전투 전에 연결교를 접으면 가운데 통로만 남는다.',
    terrain: pattern(TWIN) },
  { id: 'sw_ore', field: 'swarm', name: '광석 야적장', gap: 3,
    desc: '광석 더미가 양옆을 막고, 가운데 진공 틈이 전장을 둘로 가른다. 틈 너머로는 쏠 수 있다.',
    terrain: pattern(ORE) },
  { id: 'sw_unload', field: 'swarm', name: '광석 하역장', gap: 3, later: true, cartDir: -1,
    desc: '가운데 선로로 광석 운반차가 지나간다. 전투 전에 크레인으로 컨테이너를 선로 건너편 적재칸에 옮길 수 있다.',
    terrain: pattern(UNLOAD), bays: bays(UNLOAD) },
];
export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
export const mapOf = (id?: string) => MAP_BY_ID[id || 'open'] || MAP_BY_ID.open;

export const rectCells = (b: Bay) => { const out: { x: number; y: number }[] = []; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) out.push({ x, y }); return out; };
/** 컨테이너 원위치 (번호순): 칸 · 둘레 사각형 */
export function crateHomes(cells: TCell[]) {
  const by = new Map<number, { x: number; y: number }[]>();
  for (const c of cells) if (c.crate !== undefined) { if (!by.has(c.crate)) by.set(c.crate, []); by.get(c.crate)!.push({ x: c.x, y: c.y }); }
  return [...by.keys()].sort((a, b) => a - b).map((i) => {
    const cs = by.get(i)!, xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
    return { i, cells: cs, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  });
}
/** 이 칸 구조의 실제 지형 칸 (편성 화면 선택 opt 반영, 기본 g.opt).
 *  접은 연결교 = 통행 불가 (bits 1, 종류는 연결교 그대로 — 눌러서 다시 펼 수 있게).
 *  크레인으로 옮긴 컨테이너 = 그 적재칸으로 (같은 크기만, 다른 지형 · 컨테이너와 겹치면 원위치).
 *  순서: 컨테이너가 아닌 칸 → 컨테이너 번호순 (컨테이너를 옮겨도 덩어리 번호가 바뀌지 않게) */
export function terrainOf(g: Geo, opt: MapOpt | undefined = g.opt): TCell[] {
  const m = mapOf(g.map), base = (m.terrain?.(g) || []).map((c) => ({ ...c, bits: c.k === 'bridge' && opt?.fold ? 1 : c.bits ?? TERRAIN[c.k].bits }));
  const crates = crateHomes(base);
  if (!crates.length) return base;
  const out = base.filter((c) => c.crate === undefined), bs = m.bays?.(g) || [];
  const key = (c: { x: number; y: number }) => `${c.x},${c.y}`, used = new Set(out.map(key));
  const dest = crates.map((cr) => { const bi = opt?.crane?.[cr.i], b = bi === undefined ? undefined : bs[bi]; return b && b.w === cr.w && b.h === cr.h ? rectCells(b) : null; });
  for (const cr of crates) if (!dest[cr.i]) cr.cells.forEach((c) => used.add(key(c))); // 옮기지 않은 컨테이너 자리를 먼저 잡는다
  const at = crates.map((cr) => {
    const to = dest[cr.i];
    if (!to) return cr.cells;
    const cells = to.some((c) => used.has(key(c))) ? cr.cells : to; // 겹치면 원위치
    cells.forEach((c) => used.add(key(c)));
    return cells;
  });
  crates.forEach((cr, j) => { for (const c of at[j]) out.push({ x: c.x, y: c.y, k: 'container', crate: cr.i, bits: TERRAIN.container.bits }); });
  return out;
}

/** 지형 지물: 같은 종류의 지형 칸이 상하좌우로 이어진 덩어리 (호수 하나 · 온실 한 동 · 방벽 한 줄 · 컨테이너 하나). 편성 · 전투 화면에서 누르면 덩어리 전체를 표시하고 성질을 보여 준다 */
export interface TerrainGroup { id: number; k: TerrainKind; cells: { x: number; y: number }[]; /** 컨테이너 번호 (크레인) */ crate?: number; /** 실제로 막는 것 (접은 연결교 1) */ bits: number }
export function terrainGroups(g: Geo): TerrainGroup[] {
  const cells = terrainOf(g);
  const at = new Map(cells.map((c) => [`${c.x},${c.y}`, c]));
  const seen = new Set<string>(), out: TerrainGroup[] = [];
  for (const c of cells) {
    const key = `${c.x},${c.y}`;
    if (seen.has(key)) continue;
    const grp: TerrainGroup = { id: out.length, k: c.k, cells: [], bits: c.bits ?? TERRAIN[c.k].bits, ...(c.crate !== undefined ? { crate: c.crate } : {}) }, q = [c];
    seen.add(key);
    while (q.length) {
      const p = q.pop()!;
      grp.cells.push({ x: p.x, y: p.y });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k2 = `${p.x + dx},${p.y + dy}`, n = at.get(k2);
        if (n && n.k === c.k && n.crate === c.crate && !seen.has(k2)) { seen.add(k2); q.push(n); }
      }
    }
    out.push(grp);
  }
  return out;
}
