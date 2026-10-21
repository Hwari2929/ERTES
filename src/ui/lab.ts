// 에란테스 훈련장 패널 (편성 화면 오른쪽 · 좁은 화면은 아래 시트): 기물 · 장비 · 소모품 · 적 · 전장을 바로 불러 고친다.
//   조작은 모두 engine/lab.ts 함수로. 이름 · 수치는 그릴 때마다 데이터 표에서 읽는다 (UNIT_BY_ID · ENEMY_BY_ID · 장비 표(codex2 itemCatalog) · MAPS · FIELDS · RELIC_BY_ID).
//   main.ts 는 labHtml(그리기) · labAct(data-a="lab" 동작) · labInit(바꾸기 입력 → 동작) · labStart(타이틀 진입)만 부른다.
import { CFG } from '../config';
import { FIELDS, fieldOf } from '../data/battlefields';
import { ENEMIES, ENEMY_BY_ID, type EnemyDef } from '../data/enemies';
import { CONSUMABLES, isMod, itemInfo } from '../data/items';
import { MAPS, mapOf } from '../data/maps';
import { RELIC_BY_ID } from '../data/relics';
import { SYN_BY_ID } from '../data/synergies';
import { UNIT_BY_ID, UNITS, type UnitDef } from '../data/units';
import { deployed, encGeo, ZONE } from '../engine/build';
import * as L from '../engine/lab';
import * as R from '../engine/run';
import type { RunState, SynergyId } from '../types';
import { IGRP_NAME, itemCatalog, type IGrp } from './codex2';
import { hasPortrait, iconURL } from './portraits';
import { loadRun } from './save';

type Tab = 'units' | 'items' | 'foes' | 'field';
const TABS: [Tab, string][] = [['units', '기물'], ['items', '장비 · 소모품'], ['foes', '적'], ['field', '전장']];
/** 패널 상태 (이 브라우저 세션 동안 유지) */
const LS = {
  open: true,
  tab: 'units' as Tab,
  q: { units: '', items: '', foes: '', field: '' } as Record<Tab, string>,
  uf: 'all' as 'all' | 'rec' | 'special',
  ef: 'all' as 'all' | 'field' | 'minion' | 'elite' | 'boss',
  rank: 1,
  /** 적 추가 진형 (포위 지형): 자동 · 위 · 아래 */
  zone: 'auto' as 'auto' | 'up' | 'down',
  confirm: false,
};

interface Deps { act(v: string): void; itemIcon(id: string): string; relicTok(id: string): string }
let D: Deps | null = null;
/** main.ts 가 처음 한 번: 동작 보내기 · 장비 아이콘 */
export function labInit(d: Deps) { D = d; }

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const go = (v: string) => `data-a="lab" data-v="${esc(v)}"`;
const spr = (x: UnitDef | EnemyDef) => `<img class="spr${hasPortrait(x) ? ' pt' : ''}" alt="" src="${iconURL(x)}">`;
const tierKo = (e: EnemyDef) => (e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '일반');
const ROW_NAME = ['뒷줄', '가운데', '앞줄'];

// ───────── 검색: 타일의 data-q 에 이름을 넣고, 입력할 때마다 다시 그리지 않고 숨긴다 (도감 검색과 같은 방식)
const norm = (s: string) => s.toLowerCase();
const qHit = (q: string, text: string) => q.trim().toLowerCase().split(/\s+/).filter(Boolean).every((w) => norm(text).includes(w));
const qAttr = (text: string) => ` data-q="${esc(norm(text))}"${LS.q[LS.tab] && !qHit(LS.q[LS.tab], text) ? ' hidden' : ''}`;
const search = (ph: string) => `<input class="lab-q" type="search" placeholder="${esc(ph)}" value="${esc(LS.q[LS.tab])}" aria-label="검색" autocomplete="off">`;
function applyQuery(scope: ParentNode, q: string) {
  scope.querySelectorAll<HTMLElement>('[data-q]').forEach((el) => { el.hidden = !!q && !qHit(q, el.dataset.q || ''); });
  scope.querySelectorAll<HTMLElement>('.lab-grp').forEach((g) => { g.hidden = !!q && !g.querySelector('[data-q]:not([hidden])'); });
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el?.classList?.contains('lab-q')) return;
    LS.q[LS.tab] = el.value;
    applyQuery(el.closest('.lab-body') || document, el.value);
  });
  // 숫자 칸 · 고르기: 바뀌면 동작 (data-lab = 동작 이름, 값을 끝에 붙인다)
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const k = (el as HTMLElement)?.dataset?.lab;
    if (!k || !D) return;
    D.act(`${k}:${el.value}`);
  });
}

// ───────── 조각
/** 이름 + 값 칸 */
const kv = (k: string, v: string) => `<div class="lab-kv"><span class="lab-k">${esc(k)}</span><div class="lab-v">${v}</div></div>`;
/** − 값 + (값은 직접 입력도) */
function stepper(op: string, v: number, min: number, max: number, step = 1, label = '') {
  return `<span class="lab-step"><button class="btn tiny" ${go(`${op}:${+(v - step).toFixed(2)}`)} ${v - step < min - 1e-9 ? 'disabled' : ''} aria-label="줄이기">−</button>`
    + `<input class="lab-num" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${v}" data-lab="${esc(op)}" aria-label="${esc(label || op)}">`
    + `<button class="btn tiny" ${go(`${op}:${+(v + step).toFixed(2)}`)} ${v + step > max + 1e-9 ? 'disabled' : ''} aria-label="늘리기">+</button></span>`;
}
/** 하나만 고르는 분절 단추 (도감 분류 단추와 같은 모양) */
const seg = (label: string, opts: [string, string][], cur: string, op: string, dis: (k: string) => boolean = () => false) =>
  `<div class="cx-seg lab-seg" role="group" aria-label="${esc(label)}">${opts.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" ${go(`${op}:${k}`)} aria-pressed="${cur === k}" ${dis(k) ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>`;
const grp = (title: string, n: number, inner: string) => `<section class="lab-grp"><h4>${esc(title)} <span class="f-num muted">${n}</span></h4>${inner}</section>`;
const synNames = (d: UnitDef) => [...d.factions, ...d.traits].map((s) => SYN_BY_ID[s as SynergyId]?.name || '').join(' ');

// ───────── 탭: 기물
function unitsTab(run: RunState) {
  const cap = R.deployCap(run), lab = run.lab || {};
  const capCtl = `${stepper('cap', cap, 1, L.LAB_CAP_MAX, 1, '출전 한도')}${lab.cap ? `<button class="btn tiny ghost" ${go('cap-reset')} title="보통 규칙 (함대 확장 · 전역 증강)으로">기본</button>` : ''}`;
  const head = kv('출전', `<b class="f-num">${deployed(run).length}</b> / ${capCtl}`)
    + kv('합류 등급', stepper('newrank', LS.rank, 1, CFG.maxRank, 1, '합류 공명 등급'))
    + kv('등급 상승 선택', seg('등급 상승 선택', [['auto', '자동'], ['manual', '직접']], lab.manual ? 'manual' : 'auto', 'manual'));
  const rows = run.units.map((u) => {
    const d = UNIT_BY_ID[u.defId];
    if (!d) return '';
    return `<li class="lab-row">${spr(d)}<span class="lab-nm"><b>${esc(d.name)}</b><small class="${u.pos ? 'on' : 'muted'}">${u.pos ? '출전' : '대기'}</small></span>${stepper(`rank:${u.uid}`, u.rank, 1, CFG.maxRank, 1, `${d.name} 공명 등급`)}<button class="btn tiny ghost lab-del" ${go(`unit-del:${u.uid}`)} title="빼기 (장비는 보관함으로)" aria-label="${esc(d.name)} 빼기">✕</button></li>`;
  }).join('');
  // 공왕 무휼은 기물로 합류하지 않는다 (청라공국 시너지가 전투 때 부른다) → 목록에서 뺀다
  const pool = UNITS.filter((d) => !d.king && (LS.uf === 'rec' ? !d.eventOnly : LS.uf === 'special' ? d.eventOnly : true));
  const tiles = pool.map((d) => `<button class="lab-tile" ${go(`unit:${d.id}`)}${qAttr(`${d.name} ${d.title || ''} ${synNames(d)}`)} title="${esc(`${d.name} · ${d.title || ''}`)}">${spr(d)}<span>${esc(d.name)}</span></button>`).join('');
  return `${head}
    ${grp('보유', run.units.length, `<ul class="lab-rows">${rows || '<li class="muted small">기물이 없습니다.</li>'}</ul>`)}
    <section class="lab-add"><h4>추가 <span class="muted small">누르면 합류 등급으로 합류</span></h4>
      <div class="lab-tools">${search('이름 · 시너지 검색')}${seg('분류', [['all', '전체'], ['rec', '영입 가능'], ['special', '사건 · 특수']], LS.uf, 'uf')}</div>
      <div class="lab-grid">${tiles}</div></section>`;
}

// ───────── 탭: 장비 · 소모품
function itemsTab(run: RunState) {
  const scope = run.scope || run.inventory.includes('K_scope') ? kv(CONSUMABLES.K_scope?.name || '', stepper('scope', run.scope?.n || 0, 0, 99, 1, '사용 횟수')) : '';
  const head = kv('보관함', `<b class="f-num">${run.inventory.length}</b> <span class="muted small">/ ${CFG.inventoryMax} (훈련장은 넘쳐도 들어감)</span><button class="btn tiny ghost" ${go('inv-clear')} ${run.inventory.length ? '' : 'disabled'}>비우기</button>`) + scope;
  const groups = itemCatalog().map(([g, ids]) => {
    const tiles = ids.map((id) => {
      if (id.startsWith('R:')) {
        const r = RELIC_BY_ID[id.slice(2)];
        return r ? `<button class="lab-tile it" ${go(`relic:${r.id}`)}${qAttr(r.name)} title="${esc(`${r.name} — ${r.desc(1)}`)}">${D?.relicTok(r.id) || ''}<span>${esc(r.name)}</span></button>` : '';
      }
      let nm = id;
      try { nm = itemInfo(id).name; } catch { return ''; }
      return `<button class="lab-tile it" ${go(`item:${id}`)}${qAttr(nm)}>${D?.itemIcon(id) || ''}<span>${esc(nm)}</span></button>`;
    }).join('');
    return grp(IGRP_NAME[g as IGrp], ids.length, `<div class="lab-grid">${tiles}</div>`);
  }).join('');
  return `${head}<div class="lab-tools">${search('장비 · 소모품 검색')}</div>${groups}`;
}

// ───────── 탭: 적
/** 적 장비 고르기: 재료 · 고급 · 희귀 · 전설 · 문장 · 신비 개조부품 */
let gearOpts = '';
function gearOptions() {
  if (gearOpts) return gearOpts;
  gearOpts = itemCatalog().filter(([g]) => ['C', 'G', 'A', 'L', 'M', 'X'].includes(g)).map(([g, ids]) => {
    const ok = ids.filter((id) => g !== 'X' || isMod(id));
    return ok.length ? `<optgroup label="${esc(IGRP_NAME[g as IGrp])}">${ok.map((id) => `<option value="${esc(id)}">${esc(itemInfo(id).name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return gearOpts;
}
function foesTab(run: RunState) {
  const enc = run.node?.enc;
  if (!enc) return '<p class="muted small">전투 칸이 아닙니다.</p>';
  const lab = run.lab || {}, sur = !!encGeo(enc).foe2, [zUp, zDn] = encGeo(enc).rot ? ['오른쪽', '왼쪽'] : ['위', '아래']; // 가로 지형은 돌려 그린다 (위 진형 → 오른쪽)
  const head = kv('강도 페이즈', stepper('ephase', enc.phase ?? run.phase, 1, L.LAB_PHASE_MAX, 1, '적 강도 페이즈'))
    + kv('강도 배율', stepper('emult', +enc.mult.toFixed(2), 0.1, 20, 0.1, '적 체력 · 피해 배율'))
    + kv('다음 칸', seg('다음 칸 조우', [['same', '같은 구성'], ['fresh', '새 조우']], lab.fresh ? 'fresh' : 'same', 'next'))
    + `<div class="lab-btns"><button class="btn tiny" ${go('repeat')} ${lab.last ? '' : 'disabled'} title="직전 전투의 적 · 지형으로">같은 구성 다시</button><button class="btn tiny" ${go('reroll')} title="전장 풀에서 새로 뽑기">새 조우</button><button class="btn tiny ghost" ${go('foe-clear')} ${enc.enemies.length ? '' : 'disabled'}>모두 지우기</button></div>`;
  const opt = (n: number, cur: number, names?: string[]) => [...Array(n).keys()].map((i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${names ? names[i] : `${i + 1}열`}</option>`).join('');
  const rows = enc.enemies.map((s, i) => {
    const e = ENEMY_BY_ID[s.defId];
    if (!e) return '';
    const gear = [...(s.stripped ? [] : (e.items || []).filter((x): x is string => !!x).map((id) => ({ id, slot: 'def' as const }))), ...(s.items || []).map((id, k) => ({ id, slot: k })), ...(s.mod ? [{ id: s.mod, slot: -1 }] : [])];
    return `<li class="lab-row foe">${spr(e)}<span class="lab-nm"><b>${esc(e.name)}</b><small class="tier-${e.tier}">${tierKo(e)}</small></span>
      <span class="lab-cell"><select data-lab="foe-c:${i}" aria-label="열">${opt(enc.n, s.c)}</select><select data-lab="foe-r:${i}" aria-label="줄">${opt(ZONE, s.row, ROW_NAME)}</select>${sur ? `<select data-lab="foe-z:${i}" aria-label="진형"><option value="0"${s.flip ? '' : ' selected'}>${zUp}</option><option value="1"${s.flip ? ' selected' : ''}>${zDn}</option></select>` : ''}</span>
      <span class="lab-gear">${gear.map((g) => `<button class="lab-gi" ${go(`foe-ungear:${i}:${g.slot}`)} title="${esc(`${itemInfo(g.id).name} — 눌러서 떼기${g.slot === 'def' ? ' (기본 장비 모두)' : ''}`)}">${D?.itemIcon(g.id) || ''}</button>`).join('')}<select class="lab-gsel" data-lab="foe-gear:${i}" aria-label="장비 달기"><option value="" selected>장비 +</option>${gearOptions()}</select></span>
      <button class="btn tiny ghost lab-del" ${go(`foe-del:${i}`)} aria-label="${esc(e.name)} 빼기">✕</button></li>`;
  }).join('');
  const fd = fieldOf(run.field), here = new Set([...fd.pool, fd.elite, ...fd.bosses]);
  const pool = ENEMIES.filter((e) => (LS.ef === 'all' ? true : LS.ef === 'field' ? here.has(e.id) : e.tier === LS.ef));
  const tiles = pool.map((e) => `<button class="lab-tile" ${go(`foe:${e.id}`)}${qAttr(`${e.name} ${tierKo(e)}`)} title="${esc(`${e.name} · ${tierKo(e)}`)}">${spr(e)}<span>${esc(e.name)}</span>${e.tier !== 'minion' ? `<i class="lab-tier tier-${e.tier}">${e.tier === 'boss' ? 'B' : 'E'}</i>` : ''}</button>`).join('');
  return `${head}
    ${grp('이번 조우', enc.enemies.length, `<ul class="lab-rows">${rows || '<li class="muted small">적이 없습니다.</li>'}</ul>`)}
    <section class="lab-add"><h4>추가 <span class="muted small">누르면 빈칸에 (근접은 앞줄부터)</span></h4>
      <div class="lab-tools">${search('적 이름 검색')}${seg('분류', [['all', '전체'], ['field', '이 전장'], ['minion', '일반'], ['elite', '정예'], ['boss', '보스']], LS.ef, 'ef')}${sur ? seg('진형', [['auto', '자동'], ['up', zUp], ['down', zDn]], LS.zone, 'zone') : ''}</div>
      <div class="lab-grid">${tiles}</div></section>`;
}

// ───────── 탭: 전장
function fieldTab(run: RunState) {
  const enc = run.node?.enc, lab = run.lab || {};
  const mapId = enc ? mapOf(enc.map).id : lab.map ?? 'open', narrow = mapOf(mapId).narrow;
  const n = enc?.n ?? lab.n ?? CFG.bossBoard;
  return kv('전장', `<select data-lab="field" aria-label="전장">${FIELDS.map((f) => `<option value="${esc(f.id)}"${f.id === run.field ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>`)
    + kv('지형 틀', seg('지형 틀', MAPS.map((m) => [m.id, m.name]), mapId, 'map'))
    + kv('폭', seg('배치 폭', L.LAB_WIDTHS.map((w) => [String(w), `${w}칸`]), String(n), 'width', () => !!narrow) + (narrow ? `<span class="muted small">${esc(mapOf(mapId).name)} ${narrow}칸 고정</span>` : ''))
    + kv('런 페이즈', stepper('phase', run.phase, 1, L.LAB_PHASE_MAX, 1, '런 페이즈'))
    + kv('크레딧', `<input class="lab-num wide" type="number" min="0" step="10" value="${run.credits}" data-lab="credits" aria-label="크레딧">`)
    + `<section class="lab-grp"><h4>훈련장</h4><div class="lab-btns">${LS.confirm ? `<button class="btn tiny danger" ${go('reset-ok')}>처음부터 — 확인</button><button class="btn tiny ghost" ${go('reset-no')}>취소</button>` : `<button class="btn tiny ghost" ${go('reset')}>처음부터</button>`}</div></section>`;
}

// ───────── 패널
/** 편성 화면의 훈련장 패널 (훈련장 런이 아니면 빈 문자열) */
export function labHtml(run: RunState, screen: string): string {
  if (!run.lab || screen !== 'prep') return '';
  if (!LS.open) return `<button class="btn lab-fab" ${go('open')} title="훈련장 패널 열기">훈련장</button>`;
  const body = LS.tab === 'units' ? unitsTab(run) : LS.tab === 'items' ? itemsTab(run) : LS.tab === 'foes' ? foesTab(run) : fieldTab(run);
  const chip = (k: string, v: string, cls = '') => `<span class="lab-chip ${cls}"><small>${esc(k)}</small><b class="f-num">${v}</b></span>`;
  return `<aside class="lab-panel" aria-label="훈련장">
    <header class="lab-hd"><b>훈련장</b>${chip('칸', `${run.step + 1}/${run.map.length}`)}${chip('전적', `${run.stats.wins}승 ${run.stats.losses}패`, 'rec')}<button class="btn tiny primary lab-go" data-a="fight" ${deployed(run).length ? '' : 'disabled'}>전투</button><button class="btn tiny ghost lab-x" ${go('close')} aria-label="패널 접기">✕</button></header>
    <nav class="lab-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" class="${LS.tab === k ? 'on' : ''}" aria-selected="${LS.tab === k}" ${go(`tab:${k}`)}>${esc(l)}</button>`).join('')}</nav>
    <div class="lab-body">${body}</div>
  </aside>`;
}

/** 동작 결과: msg = 알림 · run = 런을 바꿈 (처음부터) · dirty = 저장할 변경 */
export interface LabRes { msg?: string; run?: RunState; dirty?: boolean }
/** data-a="lab" 동작 (data-v = '이름:인자…') */
export function labAct(run: RunState, v: string): LabRes {
  const [op, a = '', b = ''] = v.split(':');
  const num = (x: string) => +x;
  switch (op) {
    case 'open': LS.open = true; return {};
    case 'close': LS.open = false; return {};
    case 'tab': if (TABS.some(([k]) => k === a)) LS.tab = a as Tab; LS.confirm = false; return {};
    case 'uf': LS.uf = a as typeof LS.uf; return {};
    case 'ef': LS.ef = a as typeof LS.ef; return {};
    case 'zone': LS.zone = a as typeof LS.zone; return {};
    case 'newrank': LS.rank = Math.max(1, Math.min(CFG.maxRank, Math.round(num(a)) || 1)); return {};
    // 기물
    case 'unit': { const u = L.addLabUnit(run, a, LS.rank); return u ? { dirty: true, msg: `${UNIT_BY_ID[a]?.name || a} 합류 (공명 ${u.rank})${u.pos ? '' : ' · 대기석'}` } : {}; }
    case 'rank': { const u = L.setLabRank(run, a, num(b)); return u ? { dirty: true } : {}; }
    case 'unit-del': L.removeLabUnit(run, a); return { dirty: true };
    case 'cap': L.setLabCap(run, num(a)); return { dirty: true };
    case 'cap-reset': L.setLabCap(run, undefined); return { dirty: true };
    case 'manual': (run.lab ||= {}).manual = a === 'manual'; if (a !== 'manual') L.labAutoPending(run); return { dirty: true };
    // 장비 · 소모품
    case 'item': { const got = L.addLabItem(run, a); return got ? { dirty: true, msg: `보관함 +1 · ${itemInfo(got).name}` } : {}; }
    case 'relic': L.addLabRelic(run, a); return { dirty: true, msg: `성유물 보관 · ${RELIC_BY_ID[a]?.name || a}` };
    case 'scope': L.setScopeUses(run, num(a)); return { dirty: true };
    case 'inv-clear': L.clearLabInventory(run); return { dirty: true };
    // 적
    case 'foe': { const s = L.addLabEnemy(run, a, LS.zone === 'auto' ? undefined : LS.zone === 'down'); return s ? { dirty: true } : { msg: '빈 적 칸이 없습니다' }; }
    case 'foe-del': L.removeLabEnemy(run, num(a)); return { dirty: true };
    case 'foe-clear': L.clearLabEnemies(run); return { dirty: true };
    case 'foe-c': L.moveLabEnemy(run, num(a), { c: num(b) }); return { dirty: true };
    case 'foe-r': L.moveLabEnemy(run, num(a), { row: num(b) }); return { dirty: true };
    case 'foe-z': L.moveLabEnemy(run, num(a), { flip: b === '1' }); return { dirty: true };
    case 'foe-gear': if (b) L.gearLabEnemy(run, num(a), b); return { dirty: true };
    case 'foe-ungear': L.ungearLabEnemy(run, num(a), b === 'def' ? 'def' : num(b)); return { dirty: true };
    case 'ephase': L.setLabEncPhase(run, num(a)); return { dirty: true };
    case 'emult': L.setLabEncMult(run, num(a)); return { dirty: true };
    case 'next': (run.lab ||= {}).fresh = a === 'fresh'; return { dirty: true };
    case 'repeat': { const e = L.labRepeat(run); return e ? { msg: e } : { dirty: true, msg: '직전 전투와 같은 구성' }; }
    case 'reroll': L.labReroll(run); return { dirty: true };
    // 전장
    case 'field': L.setLabField(run, a); return { dirty: true };
    case 'map': case 'width': { const out = L.setLabShape(run, op === 'map' ? a : undefined, op === 'width' ? num(a) : undefined); return { dirty: true, ...(out ? { msg: `자리가 없어 적 ${out}명을 뺐습니다` } : {}) }; }
    case 'phase': L.setLabPhase(run, num(a)); return { dirty: true };
    case 'credits': L.setLabCredits(run, num(a)); return { dirty: true };
    case 'reset': LS.confirm = true; return {};
    case 'reset-no': LS.confirm = false; return {};
    case 'reset-ok': LS.confirm = false; return { run: L.newLabRun(), msg: '훈련장을 처음부터 다시 엽니다' };
    default: return {};
  }
}

/** 타이틀 진입: 저장된 훈련장이 있으면 이어서, 없으면 새로 */
export function labStart(): RunState {
  const saved = loadRun(L.LAB_SLOT);
  if (saved?.lab && !saved.over) return saved;
  LS.open = true; LS.tab = 'units';
  return L.newLabRun();
}
/** 타이틀 단추 부제: 저장된 훈련장 진행 (없으면 null) */
export function labSaveInfo(): { step: number; len: number } | null {
  const r = loadRun(L.LAB_SLOT);
  return r?.lab ? { step: r.step, len: r.map.length } : null;
}
export const LAB_SLOT = L.LAB_SLOT;
