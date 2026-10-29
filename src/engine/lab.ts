// 에란테스 훈련장: 실험용 런. 보통 RunState 에 lab 표식만 붙인다 (types.ts RunState.lab).
//   항로 = 전투 LAB_NODES칸 (끝까지 가면 처음 칸으로). 전투는 보상 · 피해 · 기록(보고서 · 도감 · 업적) 없이 다음 칸으로 넘어가고,
//   다음 칸 조우는 직전 전투의 조우를 그대로 복사한다 (lab.fresh 면 전장 풀에서 새로). 기물 · 장비 · 적 · 전장은 편성 화면의 훈련장 패널(ui/lab.ts)이 고친다.
//   이름 · 수치는 데이터 표(UNIT_BY_ID · ENEMY_BY_ID · 장비 표 · MAPS · FIELDS)를 그대로 쓴다.
import { CFG } from '../config';
import { fieldOf } from '../data/battlefields';
import { DEV } from '../data/devices';
import { ENEMY_BY_ID } from '../data/enemies';
import { isConsumable, itemInfo, isMod } from '../data/items';
import { mapOf } from '../data/maps';
import { recMajors } from '../data/rework';
import { RECRUITABLE, UNIT_BY_ID } from '../data/units';
import { Rng } from '../rng';
import { type Encounter, type EnemySpawn, MAJORS, type Major, type Pending, type RunState, type UnitState } from '../types';
import { encGeo, ZONE } from './build';
import type { Battle } from './combat';
import * as R from './run';

/** 항로 칸 수 */
export const LAB_NODES = 99;
/** 저장 칸 (일반 이어하기 · 캠페인 · 튜토리얼과 따로) */
export const LAB_SLOT = 'lab';
/** 처음 크레딧 · 처음 기물 수 */
const LAB_CREDITS = 500;
const LAB_STARTERS = 4;
/** 출전 한도 직접 지정 범위 (아군 진형 3줄 × 최대 폭 8) */
export const LAB_CAP_MAX = ZONE * 8;
export const LAB_WIDTHS = [6, 7, 8];
export const LAB_PHASE_MAX = 20;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const log = (run: RunState, s: string) => { run.log.unshift(s); if (run.log.length > 60) run.log.length = 60; };

// ───────── 런
/** 새 훈련장: 무작위 영입 가능 기물 4명 · 위험 0 · 특권 없음 · 첫 칸 조우까지 */
export function newLabRun(seed = (Date.now() ^ (Math.random() * 1e9)) | 0): RunState {
  const r = new Rng(seed || 1);
  const starters = r.sample(RECRUITABLE.filter((d) => !d.inert).map((d) => d.id), LAB_STARTERS);
  const run = R.newRun(seed, starters, fieldOf(null).id, 0);
  run.lab = {};
  labAutoPending(run); // 시작 기물 합류 선택 (스페셜 전용 증강 · 사이오닉 학파)
  run.pending = []; // 특권 증강 · 절망 증강 없음
  run.credits = LAB_CREDITS;
  run.map = Array.from({ length: LAB_NODES }, () => ['battle']); R.clearRoute(run); // 훈련장: 한 줄 항로
  run.picked = [];
  run.log = ['에란테스 훈련장 개장.'];
  enterLabNode(run);
  return run;
}
/** 지금 칸에 들어간다 (전투 노드 · 조우) */
function enterLabNode(run: RunState) {
  run.picked[run.step] = 'battle';
  run.node = { type: 'battle', enc: labEncounter(run) };
}

// ───────── 조우
/** 다음 칸 조우: 직전 조우 복사 (새 시드) · lab.fresh 거나 직전 조우가 없으면 새로 */
export function labEncounter(run: RunState): Encounter {
  const last = run.lab?.last;
  if (last && !run.lab?.fresh) return { ...clone(last), seed: R.rng(run, (r) => r.int(1, 2 ** 31 - 1)) };
  return labFresh(run);
}
/** 전장 풀에서 새 조우 (지금 페이즈 기준). 지형 틀 · 폭을 정해 두었으면 그대로 */
export function labFresh(run: RunState): Encounter {
  const enc = R.genEncounter(run, 'battle');
  if (run.lab?.map !== undefined || run.lab?.n !== undefined) shapeEnc(enc, run.lab.map ?? enc.map ?? 'open', run.lab.n ?? enc.n);
  return enc;
}
/** 같은 구성 다시: 지금 칸 조우를 직전 전투 조우로 (장치는 보관함으로 돌려받은 뒤) */
export function labRepeat(run: RunState): string | null {
  const last = run.lab?.last;
  if (!last || !run.node?.enc) return '아직 치른 전투가 없습니다';
  recallAll(run);
  run.node.enc = { ...clone(last), seed: R.rng(run, (r) => r.int(1, 2 ** 31 - 1)) };
  return null;
}
/** 새 조우: 지금 칸 조우를 전장 풀에서 새로 */
export function labReroll(run: RunState) {
  if (!run.node?.enc) return;
  recallAll(run);
  run.node.enc = labFresh(run);
}
/** 놓은 장치를 모두 거둔다 (지형 · 폭이 바뀌면 칸이 맞지 않으므로) */
function recallAll(run: RunState) {
  const ds = run.node?.enc?.devices;
  while (ds?.length) R.recallDevice(run, ds.length - 1);
}

/** 적 칸 열쇠: 진형(위 0 · 아래 1) · 열 · 줄 */
const cellKey = (s: Pick<EnemySpawn, 'c' | 'row' | 'flip'>) => `${s.flip ? 1 : 0},${s.c},${s.row}`;
/** 빈 적 칸: 근접은 앞줄부터, 원거리는 뒷줄부터, 열은 가운데부터. 포위 지형이면 사람이 적은 진형부터 (flip 을 정하면 그 진형만) */
function freeCell(enc: Encounter, taken: Set<string>, melee: boolean, flip?: boolean): Pick<EnemySpawn, 'c' | 'row' | 'flip'> | null {
  const sur = !!encGeo(enc).foe2;
  const rows = melee ? [ZONE - 1, 1, 0] : [0, 1, ZONE - 1];
  const mid = (enc.n - 1) / 2;
  const cols = [...Array(enc.n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  const down = enc.enemies.filter((e) => e.flip).length, up = enc.enemies.length - down;
  const zones = !sur ? [false] : flip !== undefined ? [flip] : down < up ? [true, false] : [false, true];
  for (const f of zones) for (const row of rows) for (const c of cols) {
    const s = { c, row, ...(f ? { flip: true } : {}) };
    if (!taken.has(cellKey(s))) return s;
  }
  return null;
}
/** 폭 · 지형이 바뀐 조우에 적을 맞춘다: 들어가는 칸은 그대로, 밖이거나 겹치면 빈칸으로, 자리가 없으면 뺀다. 반환 = 뺀 수 */
function fitEnemies(enc: Encounter): number {
  const sur = !!encGeo(enc).foe2, taken = new Set<string>(), keep: EnemySpawn[] = [];
  const all = enc.enemies;
  enc.enemies = keep;
  for (const s of all) {
    if (!sur) delete s.flip;
    if (s.c >= enc.n || s.row >= ZONE || taken.has(cellKey(s))) {
      const cell = freeCell(enc, taken, !!ENEMY_BY_ID[s.defId]?.melee, sur ? !!s.flip : undefined) || (sur ? freeCell(enc, taken, !!ENEMY_BY_ID[s.defId]?.melee) : null);
      if (!cell) continue;
      delete s.flip;
      Object.assign(s, cell);
    }
    taken.add(cellKey(s));
    keep.push(s);
  }
  return all.length - keep.length;
}
/** 조우의 지형 틀 · 폭을 바꾼다 (통로처럼 폭이 정해진 틀은 그 폭). 포위로 바뀌면 적의 절반을 아래 진형으로 */
function shapeEnc(enc: Encounter, map: string, n: number): number {
  const m = mapOf(map), wasSur = !!encGeo(enc).foe2;
  if ((enc.map || 'open') !== m.id || enc.n !== (m.narrow ?? n)) { delete enc.gateOpen; delete enc.bridgeFold; delete enc.crane; delete enc.sprLate; delete enc.laserB; delete enc.breaker; } // 지형 · 폭이 바뀌면 전투 전 지형 선택 (수문 · 연결교 · 크레인)도 처음으로
  if (m.id === 'open') delete enc.map; else enc.map = m.id;
  enc.n = m.narrow ?? n;
  if (m.surround && !wasSur) enc.enemies.forEach((e, i) => { if (i % 2) e.flip = true; });
  return fitEnemies(enc);
}

// ───────── 전장 탭
/** 전장 (FIELDS) */
export function setLabField(run: RunState, id: string) { run.field = fieldOf(id).id; }
/** 지형 틀 · 폭: 지금 조우에 바로 적용하고 다음 새 조우에도 쓴다. 반환 = 자리가 없어 뺀 적 수 */
export function setLabShape(run: RunState, map: string | undefined, n: number | undefined): number {
  const lab = (run.lab ||= {});
  if (map !== undefined) lab.map = mapOf(map).id;
  if (n !== undefined && LAB_WIDTHS.includes(n)) lab.n = n;
  const enc = run.node?.enc;
  if (!enc) return 0;
  recallAll(run);
  return shapeEnc(enc, lab.map ?? enc.map ?? 'open', lab.n ?? enc.n);
}
export function setLabCredits(run: RunState, v: number) { run.credits = Math.max(0, Math.round(v) || 0); }
/** 런 페이즈 (적 강도 · 적 풀 · 영입 등급 기준) */
export function setLabPhase(run: RunState, p: number) { run.phase = Math.max(1, Math.min(LAB_PHASE_MAX, Math.round(p) || 1)); }

// ───────── 기물 탭
/** 기물 추가 (사건 전용 · 특수 기물 포함, 보유 한도 무시) */
export function addLabUnit(run: RunState, defId: string, rank: number): UnitState | null {
  if (!UNIT_BY_ID[defId] || UNIT_BY_ID[defId].king) return null; // 공왕은 청라공국 시너지가 부른다
  const u = R.addUnit(run, defId, clampRank(rank));
  R.autoPlace(run, [u]);
  labAutoPending(run);
  return u;
}
const clampRank = (r: number) => Math.max(1, Math.min(CFG.maxRank, Math.round(r) || 1));
/** 공명 등급 바꾸기: 올리면 그만큼 공명도를 넣어 정상 등급 상승 (이정표 · 증강 포함), 내리면 그 등급으로 다시 합류 (증강 초기화, 장비 · 자리는 그대로) */
export function setLabRank(run: RunState, uid: string, rank: number): UnitState | null {
  const u = run.units.find((x) => x.uid === uid);
  if (!u) return null;
  rank = clampRank(rank);
  if (rank > u.rank) {
    let need = -u.xp;
    for (let r = u.rank; r < rank; r++) need += CFG.xpToNext(r);
    u.xp += Math.max(0, need);
    R.settleXp(run, u);
    labAutoPending(run);
    return u;
  }
  if (rank === u.rank) return u;
  const i = run.units.indexOf(u);
  run.pending = run.pending.filter((p) => !('uid' in p && p.uid === u.uid));
  run.units.splice(i, 1);
  const nu = R.addUnit(run, u.defId, rank);
  run.units.splice(run.units.indexOf(nu), 1);
  run.units.splice(i, 0, nu);
  Object.assign(nu, { items: u.items, mod: u.mod, pos: u.pos, ...(u.relic ? { relic: u.relic } : {}) });
  if (run.aceTarget === u.uid) run.aceTarget = nu.uid;
  labAutoPending(run);
  return nu;
}
/** 기물 빼기: 장비 · 개조부품은 보관함으로 (고유 장비 제외) */
export function removeLabUnit(run: RunState, uid: string) {
  const u = run.units.find((x) => x.uid === uid);
  if (!u) return;
  for (const id of [...u.items, u.mod]) if (id && !id.startsWith('U_') && id !== UNIT_BY_ID[u.defId]?.item) run.inventory.push(id);
  run.units = run.units.filter((x) => x !== u);
  run.pending = run.pending.filter((p) => !('uid' in p && p.uid === uid));
  if (run.aceTarget === uid) run.aceTarget = null;
}
/** 출전 한도 직접 지정 (undefined = 보통 규칙) */
export function setLabCap(run: RunState, cap: number | undefined) {
  const lab = (run.lab ||= {});
  if (cap === undefined) delete lab.cap; else lab.cap = Math.max(1, Math.min(LAB_CAP_MAX, Math.round(cap)));
  const over = run.units.filter((u) => u.pos).slice(R.deployCap(run));
  for (const u of over) u.pos = null; // 줄인 한도를 넘는 출전 기물은 대기석으로 (뒤에 합류한 순서부터)
  R.autoPlace(run);
}
/** 등급 상승 선택 (능력치 · 증강 · 학파)을 자동으로 고른다: 능력치는 추천 능력치, 증강은 첫 선택지. lab.manual 이면 그대로 둔다 (창이 뜬다) */
export function labAutoPending(run: RunState) {
  if (run.lab?.manual) return;
  const keep: Pending[] = [];
  for (const p of run.pending) {
    if (p.t !== 'rankup') { keep.push(p); continue; }
    const u = run.units.find((x) => x.uid === p.uid);
    if (!u) continue;
    if (!p.allocDone) {
      const rec = recMajors(UNIT_BY_ID[u.defId]);
      const picks = [...new Set<Major>([...rec, ...MAJORS])].slice(0, CFG.rankPicks);
      R.allocRank(run, p, picks);
    }
    R.ensureRankupOptions(run, p);
    if (p.options?.length) R.chooseAug(run, p.uid, p.options[0]);
  }
  run.pending = keep;
}

// ───────── 장비 · 소모품 탭
/** 보관함에 넣는다 (보관함 한도 무시). 표시 망원경은 사용 횟수도 채운다 */
export function addLabItem(run: RunState, id: string): string | null {
  try { itemInfo(id); } catch { return null; }
  if (id === 'K_scope') {
    const sc = (run.scope ||= { n: 0, nav: 0 });
    sc.n += DEV.scope.base;
    if (run.inventory.includes('K_scope')) return id; // 망원경은 1개 (사용 횟수만 늘린다)
  }
  return R.gainItem(run, id, undefined, true, true);
}
/** 성유물 보관 (디바인에게 장착) */
export function addLabRelic(run: RunState, id: string) { (run.relics ||= []).push(id); }
export function setScopeUses(run: RunState, n: number) { (run.scope ||= { n: 0, nav: 0 }).n = Math.max(0, Math.round(n) || 0); }
export function clearLabInventory(run: RunState) { run.inventory = []; run.breadFresh = []; }

// ───────── 적 탭
/** 적 추가 (모든 등급 · 전장 전용 · 보스 포함). 빈칸이 없으면 null */
export function addLabEnemy(run: RunState, defId: string, flip?: boolean): EnemySpawn | null {
  const enc = run.node?.enc, d = ENEMY_BY_ID[defId];
  if (!enc || !d) return null;
  const taken = new Set(enc.enemies.map(cellKey));
  const cell = freeCell(enc, taken, d.melee, flip);
  if (!cell) return null;
  const s: EnemySpawn = { defId, ...cell };
  enc.enemies.push(s);
  return s;
}
/** 적 칸 옮기기: 그 칸에 다른 적이 있으면 서로 바꾼다 */
export function moveLabEnemy(run: RunState, i: number, to: { c?: number; row?: number; flip?: boolean }) {
  const enc = run.node?.enc, s = enc?.enemies[i];
  if (!enc || !s) return;
  const sur = !!encGeo(enc).foe2;
  const next = { c: Math.max(0, Math.min(enc.n - 1, to.c ?? s.c)), row: Math.max(0, Math.min(ZONE - 1, to.row ?? s.row)), flip: sur && (to.flip ?? !!s.flip) };
  const other = enc.enemies.find((e) => e !== s && cellKey(e) === cellKey(next));
  if (other) { other.c = s.c; other.row = s.row; if (s.flip) other.flip = true; else delete other.flip; }
  s.c = next.c; s.row = next.row;
  if (next.flip) s.flip = true; else delete s.flip;
}
export function removeLabEnemy(run: RunState, i: number) { run.node?.enc?.enemies.splice(i, 1); }
export function clearLabEnemies(run: RunState) { if (run.node?.enc) run.node.enc.enemies = []; }
/** 적 장비: 개조부품(문장 · 신비 부품)은 개조부품 칸, 그 밖은 장비 칸 (3칸, 가득 차면 마지막 칸을 바꾼다) */
export function gearLabEnemy(run: RunState, i: number, id: string) {
  const s = run.node?.enc?.enemies[i];
  if (!s || isConsumable(id)) return;
  if (isMod(id)) { s.mod = id; return; }
  const items = (s.items ||= []);
  if (items.length >= 3) items[2] = id; else items.push(id);
}
/** 적 장비 떼기: slot -1 = 개조부품, 'def' = 적 정의에 달린 기본 장비까지 모두 떼기 */
export function ungearLabEnemy(run: RunState, i: number, slot: number | 'def') {
  const s = run.node?.enc?.enemies[i];
  if (!s) return;
  if (slot === 'def') { s.stripped = true; delete s.items; delete s.mod; return; }
  if (slot === -1) { delete s.mod; return; }
  s.items?.splice(slot, 1);
  if (!s.items?.length) delete s.items;
}
/** 적 강도 페이즈 (런 페이즈와 같으면 지운다) · 배율 */
export function setLabEncPhase(run: RunState, p: number) {
  const enc = run.node?.enc;
  if (!enc) return;
  const v = Math.max(1, Math.min(LAB_PHASE_MAX, Math.round(p) || 1));
  if (v === run.phase) delete enc.phase; else enc.phase = v;
}
export function setLabEncMult(run: RunState, m: number) {
  const enc = run.node?.enc;
  if (enc) enc.mult = Math.max(0.1, Math.min(20, Math.round((m || 1) * 100) / 100));
}

// ───────── 전투 정산 (run.ts resolveBattle 이 부른다)
/** 훈련장 전투 끝: 보상 · 피해 · 보고서 기록 없이 승패만 남기고 다음 칸으로, 다음 칸 조우를 바로 만든다 (편성 화면으로 돌아간다) */
function labResolve(run: RunState, b: Battle): R.BattleSummary {
  const won = b.winner === 0;
  const enc = run.node?.enc;
  // 놓았던 장치는 전투 뒤 보관함으로 돌려받는다 (다음 칸에 저절로 다시 놓이지 않는다)
  let back = 0;
  if (enc?.devices?.length) { back = enc.devices.length; while (enc.devices.length) R.recallDevice(run, enc.devices.length - 1); }
  if (enc) (run.lab ||= {}).last = clone(enc);
  if (won) run.stats.wins++; else run.stats.losses++;
  run.stats.kills += b.counters.kills;
  run.stats.bestHit = Math.max(run.stats.bestHit, Math.round(b.counters.bestHit));
  const at = run.step + 1;
  log(run, `훈련 ${at}칸 ${won ? '승리' : '패배'}`);
  R.advance(run);
  enterLabNode(run);
  return { won, lines: [`훈련 ${at}/${run.map.length}칸 ${won ? '승리' : '패배'}`, '훈련장: 보상 · 피해 · 기록 없음', ...(back ? [`장치 ${back}개 회수 (보관함)`] : []), run.lab?.fresh ? '다음 칸: 새 조우' : '다음 칸: 같은 구성'], xp: [], hpLoss: 0, gameOver: false, items: [] };
}
R.LAB_HOOK.enc = labEncounter;
R.LAB_HOOK.resolve = labResolve;
