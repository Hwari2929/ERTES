import { CFG, phaseAmpMult, phaseHpMult } from './config';
import { AUG_BY_ID, augDesc } from './data/augments';
import { ENEMIES, ENEMY_BY_ID } from './data/enemies';
import { ENEMY_DESC } from './data/enemyText';
import { DIFFS } from './data/difficulty';
import { BOONS, EVENT_BY_ID, EVENTS } from './data/events';
import { STORIES } from './data/stories';
import { FIELDS, fieldOf } from './data/battlefields';
import { BLESSING_BY_ID, GLOBAL_BY_ID } from './data/globals';
import { combine, emblemOf, isLocked, isMod, itemInfo } from './data/items';
import { aceTargetUid, rankTitle, SYN_BY_ID, SYNERGIES, TITLE_NAME, tierOf } from './data/synergies';
import { UNIT_BY_ID, UNITS, type UnitDef } from './data/units';
import { DIVINE_ACT, FAITH_DEF, recMajors } from './data/rework';
import { BRIEF, GROWTH_BRIEF, PSI_BRIEF } from './data/brief';
import {
  activeTiers, buildAlly, buildBattle, buildEnemy, deployed, layout, memberships, playerRows, synergyCounts, totalMajors, unitEffects,
} from './engine/build';
import { Battle, type CUnit } from './engine/combat';
import * as R from './engine/run';
import { Rng } from './rng';
import { type Weapon, CTYPE_NAME, ELEM_NAME, type FaithId, FAITH_NAME, FAITHS, KEYWORD_NAME, MAJOR_NAME, TTYPE_NAME, MAJORS, NODE_NAME, type Major, type NodeType, type RunState, type SynergyId, type UnitState } from './types';
import { BattleView, fmt } from './ui/battleview';
import { exportCode, importCode, listSaves, loadRun, saveRun, SLOT_NAME } from './ui/save';
import { loadMeta, metaBattle, metaClear, metaEvent, metaRunEnd } from './ui/meta';
import { hasPortrait, iconURL, standImg } from './ui/portraits';
import { augKey, lineIcon, synIcon, typeIcon } from './ui/synicons';

// 편의 설정 (이 브라우저에만 저장): 전투 속도, 진형 속도 등
const PREF_KEY = 'errantes.prefs.v1';
/** 전투 배속 (단축키 1~5) */
const SPEEDS = [0.5, 1, 2, 4, 8];
function loadPrefs(): { speed?: number; detail?: boolean } {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
function savePref(k: string, v: unknown) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPrefs(), [k]: v })); } catch { /* 저장 불가 환경 */ }
}

type Screen = 'title' | 'newrun' | 'map' | 'prep' | 'battle' | 'shop' | 'news' | 'invest' | 'over' | 'codex';
type Sel = { k: 'unit'; uid: string } | { k: 'item'; idx: number } | { k: 'enemy'; i: number } | { k: 'def'; id: string } | null;

const app = {
  screen: 'title' as Screen,
  run: null as RunState | null,
  sel: null as Sel,
  starters: [] as string[],
  pool: [] as string[], // 시작 기물 후보 (무작위 8명)
  detail: !!loadPrefs().detail, // 상세 보기: 계수 · 메커니즘 표시
  recruitPick: null as string | null, // 영입 창에서 고른 기물 (확정 전)
  cardOpen: null as string | null, // 터치 화면: 설명을 펼친 시작 기물 카드
  subOpen: new Set<string>(), // 특성 하위 항목(전투 · 전술 유형, 신앙) 펼침 상태
  menu: null as null | 'menu' | 'export' | 'import',
  view: null as BattleView | null,
  summary: null as R.BattleSummary | null,
  picks: [] as Major[],
  augPick: null as number | null, // 증강 창에서 고른 칸 (확정 전)
  speed: SPEEDS.includes(loadPrefs().speed || 0) ? loadPrefs().speed! : 1,
  toast: '',
  toastT: 0 as ReturnType<typeof setTimeout> | 0,
  importErr: '',
  needMount: false,
  diff: 0, // 새 런 난이도
  codexTab: 'units' as 'units' | 'enemies' | 'events' | 'records',
  meterTab: 'dmg' as 'dmg' | 'taken' | 'support' | 'kills',
  battleSel: null as number | null, // 전투 중 선택한 아군 (장비 확인)
  releaseConfirm: null as string | null,
  lastBattle: null as Battle | null,
};

const root = document.getElementById('app')!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pctTxt = (x: number) => `${Math.round(x * 100)}%`;

function toast(msg: string) {
  app.toast = msg;
  if (app.toastT) clearTimeout(app.toastT);
  app.toastT = setTimeout(() => { app.toast = ''; const t = document.getElementById('toast'); if (t) t.hidden = true; }, 2400);
  const t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.hidden = false; }
}
function persist() { if (app.run && !app.run.over) saveRun(app.run, 'auto'); }

// ───────────────────────── 공용 조각
const NODE_ICON = new Proxy({} as Record<NodeType, string>, { get: (_t, k: string) => lineIcon(`n.${k}`) });

function chip(id: string) {
  const s = SYN_BY_ID[id as keyof typeof SYN_BY_ID];
  return `<span class="chip" style="--c:${s.color}">${synIcon(id) || s.icon} ${esc(s.name)}</span>`;
}
function sprite(defOrUnit: Parameters<typeof iconURL>[0], cls = 'spr') {
  return `<img class="${cls}${hasPortrait(defOrUnit) ? ' pt' : ''}" alt="" src="${iconURL(defOrUnit)}">`;
}
/** 스탠딩 상단 배너 (클릭하면 전신 보기) */
function hero(id: string, cls = 'hero') {
  const img = standImg(id, 'stand', true);
  return img ? `<div class="${cls}" data-stand="${id}">${img}</div>` : '';
}
// 메이저 스탯 아이콘 (24×24 선 아이콘, 색은 CSS --c)
const MAJOR_ICON: Record<Major, string> = {
  vit: '<path d="M12 20s-7-4.4-9-8.6A4.9 4.9 0 0 1 12 6.3a4.9 4.9 0 0 1 9 5.1C19 15.6 12 20 12 20z"/>',
  pow: '<path d="M14 4h6v6L9.5 20.5l-6-6z"/><path d="M5.5 12.5l6 6M3 21l3-3"/>',
  mnd: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  def: '<path d="M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z"/>',
  agi: '<path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z"/>',
};
function majorIcon(m: Major, cls = 'mi') {
  return `<svg class="${cls} mi-${m}" viewBox="0 0 24 24" aria-hidden="true">${MAJOR_ICON[m]}</svg>`;
}
/** 증강 임시 아이콘: id 로 정해지는 색 · 무늬 + 이름 첫 글자 (정식 아이콘이 생기면 교체) */
function augIcon(id: string, cls = 'aug-ic') {
  const a = AUG_BY_ID[id];
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  // 풀별 색: 스페셜 금 · 사이오닉 보라 · 메이저 회청 · 전용은 기물별
  const hue = a?.pool === 'special' ? 42 : a?.pool === 'psionic' ? 275 : a?.pool === 'major' ? 210 : h % 360;
  return `<span class="${cls}" style="--h:${hue}" aria-hidden="true">${lineIcon(augKey(`${a?.name || ''} ${a?.desc || ''}`))}</span>`;
}

/** 능력치 추천: 기본 스탯 성향 + 스킬이 쓰는 위력 + 사거리로 2개 */
const recommendedMajors = (d: UnitDef): Major[] => recMajors(d);

function rankPips(rank: number) {
  return `<span class="rank" title="공명 등급 ${rank}">R${rank}</span>`;
}
function xpBar(u: UnitState) {
  if (u.rank >= CFG.maxRank) return `<div class="xp max"><i style="width:100%"></i><b>MAX</b></div>`;
  const need = CFG.xpToNext(u.rank);
  return `<div class="xp"><i style="width:${(u.xp / need) * 100}%"></i><b>${u.xp}/${need}</b></div>`;
}
function itemIcon(id: string | null, attrs = '') {
  if (!id) return `<span class="item empty" ${attrs}></span>`;
  const it = itemInfo(id);
  return `<span class="item t${it.tier}" title="${esc(it.name + ' — ' + it.desc)}" ${attrs}>${itemGlyph(id) || it.icon}</span>`;
}
/** 장비 아이콘: 재료 = 메이저 아이콘, 고급 · 전설 = 고유 아이콘, 문장 = 시너지 아이콘 */
function itemGlyph(id: string) {
  if (isMod(id)) return synIcon(emblemOf(id), 'ii');
  if (id.startsWith('U_')) return lineIcon(`i.${id}`, 'ii');
  if (id.startsWith('C_')) return majorIcon(id.slice(2) as Major, 'ii mi');
  return lineIcon(`i.${id.slice(2)}`, 'ii');
}

/** 상단 바: 활성 시너지 아이콘 + 단계 */
function topSynergies(r: RunState) {
  const counts = synergyCounts(deployed(r), r);
  const act = SYNERGIES.map((sd) => ({ sd, n: counts[sd.id] || 0, t: tierOf(sd.id, counts[sd.id] || 0) })).filter((x) => x.t > 0)
    .sort((a, b) => (a.sd.kind === b.sd.kind ? b.t - a.t || b.n - a.n : a.sd.kind === 'faction' ? -1 : 1));
  if (!act.length) return '';
  return `<div class="top-syn" aria-label="활성 시너지">${act.map(({ sd, n, t }) => `<span class="ts" style="--c:${sd.color}" title="${esc(sd.name)} ${n}명 · ${t}단계">${synIcon(sd.id)}<b>${t}</b></span>`).join('')}</div>`;
}
function topbar() {
  const r = app.run;
  if (!r) return '';
  const cap = R.deployCap(r);
  return `<header class="top">
    <div class="brand">ERRANTEs</div>
    <div class="stat-row">
      <span class="pill field" style="--c:${fieldOf(r.field).color}" title="${esc(fieldOf(r.field).rules.join(' / '))}">${fieldOf(r.field).icon} ${esc(fieldOf(r.field).name)}</span>
      <span class="pill">페이즈 <b>${r.phase}</b> · 노드 ${Math.min(r.step + 1, r.map.length)}/${r.map.length}</span>
      <span class="pill hp">체력 <b>${r.hp}</b>/${r.maxHp}</span>
      <span class="pill cr">크레딧 <b>${r.credits}</b>${r.loan ? ` <small>(대출 ${r.loan})</small>` : ''}</span>
      ${r.streak >= 2 ? `<span class="pill">🔥 ${r.streak}연승</span>` : ''}
      ${r.power || R.hasDivine(r) ? `<span class="pill faith" title="권능 포인트: 디바인 기물이 전투에서 모은 신성력 ÷ ${CFG.powerPerDiv}. 순례 노드에서 사용">권능 <b>${r.power}</b></span>` : ''}
      ${r.fame ? `<span class="pill fame">명성 <b>${r.fame}</b></span>` : ''}
      ${r.blessing ? `<span class="pill faith" title="${esc(BLESSING_BY_ID[r.blessing].desc)}">축복: ${esc(BLESSING_BY_ID[r.blessing].name)}</span>` : ''}
      <span class="pill">출전 ${deployed(r).length}/${cap}</span>
    </div>
    ${topSynergies(r)}
    ${app.screen === 'battle' ? '' : '<button class="btn ghost" data-a="menu">메뉴</button>'}
  </header>`;
}

function synergyPanel(run: RunState) {
  const counts = synergyCounts(deployed(run), run);
  const raw = synergyCounts(deployed(run));
  const uncapped = synergyCounts(deployed(run), run, true);
  // 시너지별 소속 기물: 출전 / 대기 (같은 기물은 1회)
  const members = new Map<string, { dep: string[]; bench: string[] }>();
  for (const u of run.units) for (const sid of memberships(u)) {
    const m = members.get(sid) || { dep: [], bench: [] };
    const name = UNIT_BY_ID[u.defId].name;
    if (u.pos) { if (!m.dep.includes(name)) m.dep.push(name); } else if (!m.bench.includes(name)) m.bench.push(name);
    members.set(sid, m);
  }
  const list = SYNERGIES.filter((s) => counts[s.id] || members.get(s.id)?.bench.length)
    .sort((a, b) => tierOf(b.id, counts[b.id] || 0) - tierOf(a.id, counts[a.id] || 0) || (counts[b.id] || 0) - (counts[a.id] || 0));
  if (!list.length) return `<div class="muted small">출전한 기물이 없습니다.</div>`;
  return list.map((s) => {
    const c = counts[s.id] || 0;
    const t = tierOf(s.id, c);
    const m = members.get(s.id) || { dep: [], bench: [] };
    const next = s.tiers.find((need) => need > c);
    const steps = s.tiers.map((need, i) => `<span class="${c >= need ? 'on' : ''}${i === t - 1 ? ' cur' : ''}">${need}</span>`).join('');
    const bonus = c - (raw[s.id] || 0);
    const locked = s.lockFinal && (uncapped[s.id] || 0) > c;
    return `<details class="syn ${t ? 'active' : ''} ${c ? '' : 'benchonly'}" style="--c:${s.color}">
      <summary><span class="syn-ic">${synIcon(s.id) || s.icon}</span><span class="syn-count">${c}</span><span class="syn-name">${esc(s.name)}${bonus > 0 ? ` <small class="accent">+${bonus}</small>` : ''}
        <small class="syn-next">${locked ? '🔒 최종 단계는 증표 필요' : next ? `다음 단계까지 ${next - c}명` : '최고 단계'}${m.bench.length ? ` · 대기 ${m.bench.length}` : ''}</small></span><span class="syn-steps">${steps}</span></summary>
      <div class="syn-members">${m.dep.map((n) => `<span class="on">${esc(n)}</span>`).join('')}${m.bench.map((n) => `<span class="bench">${esc(n)} (대기)</span>`).join('')}</div>
      <p>${esc(s.desc)}</p>
      <ol>${s.tierDesc.map((d, i) => `<li class="${i === t - 1 ? 'cur' : ''}">(${s.tiers[i]}${s.lockFinal && i === s.tiers.length - 1 ? ' · 증표' : ''}) ${esc(d)}</li>`).join('')}</ol>
    </details>`;
  }).join('');
}

// ───────────────────────── 화면: 타이틀
function titleScreen() {
  const saves = listSaves();
  const auto = saves.find((s) => s.slot === 'auto');
  return `<main class="title-screen">
    <div class="logo">ERRANTEs</div>
    <p class="tagline">은하 용병단 오토배틀러 · 증강 도파민 MAX</p>
    <div class="title-actions">
      ${auto ? `<button class="btn primary" data-a="load" data-v="auto">이어하기 <small>페이즈 ${auto.phase} · 체력 ${auto.hp}</small></button>` : ''}
      <button class="btn ${auto ? '' : 'primary'}" data-a="newrun">새 계약</button>
      <button class="btn" data-a="codex">도감 · 기록</button>
      <button class="btn" data-a="menu-import">저장 코드 불러오기</button>
    </div>
    ${(() => { const m = loadMeta(); return m.runs ? `<p class="muted small">의뢰 ${m.runs}회 · 성공 ${m.clears}회 · 해금된 위험 등급 ${m.maxDiff}</p>` : ''; })()}
    ${saves.filter((s) => s.slot !== 'auto').length ? `<div class="slots">${saves.filter((s) => s.slot !== 'auto').map((s) =>
      `<button class="btn ghost" data-a="load" data-v="${s.slot}">${SLOT_NAME[s.slot]} · 페이즈 ${s.phase} · 기물 ${s.units}</button>`).join('')}</div>` : ''}
    <p class="muted small fine">싱글 PvE · 오프라인 플레이 · 진행은 이 브라우저에 자동 저장됩니다.</p>
  </main>`;
}

// ───────────────────────── 화면: 시작 기물 선택
/** 영입 카드용: 이 시너지를 가진 보유 기물 수 (출전 + 대기, 같은 기물은 1회) → 영입 후 */
function ownedChip(defId: string) {
  return (id: string) => {
    const run = app.run;
    if (!run) return chip(id);
    const owners = new Set(run.units.filter((u) => memberships(u).includes(id as SynergyId)).map((u) => u.defId));
    const n = owners.size, after = owners.has(defId) ? n : n + 1;
    return n ? chip(id).replace('</span>', ` <b class="own" title="보유 중인 ${esc(SYN_BY_ID[id as keyof typeof SYN_BY_ID].name)} 기물 ${n}명">${n}→${after}</b></span>`) : chip(id);
  };
}
const CTYPE_ICON = (k: string) => typeIcon(k);
const TTYPE_ICON = (k: string) => typeIcon(k);
const WPOS = (r: number) => (r <= 1 ? '근거리' : r <= 3 ? '중거리' : '원거리');
/** 이름 옆 유형 아이콘 (설명은 특성 아래) */
function typeIcons(d: UnitDef) {
  return `<span class="ticons"><i class="ct-${d.ctype}" title="전투 유형: ${CTYPE_NAME[d.ctype]}">${CTYPE_ICON(d.ctype)}</i><i class="tt-${d.ttype}" title="전술 유형: ${TTYPE_NAME[d.ttype]}">${TTYPE_ICON(d.ttype)}</i></span>`;
}
/** 이름 + 유형 아이콘, 그 아래 시너지 · 공명 등급 */
function nameBlock(d: UnitDef, syns: string[], rank: number | undefined, chipFn: (id: string) => string = chip, extra = '') {
  return `<div class="nb"><div class="nb-name"><b>${esc(d.name)}</b>${typeIcons(d)}</div>
    <div class="chips nb-syn">${rank ? rankPips(rank) : ''}${syns.map(chipFn).join('')}</div>${extra}</div>`;
}
const CTYPE_DESC: Record<string, [string, string]> = {
  MARK: ['사격으로 싸운다. 사격 위력 · 공격 속도 · 재장전 · 명중 · 치명타가 중요하다.', '주력: 사격 위력, 사격 속도, 재장전 속도, 명중, 치명 확률 · 피해. 탄창을 다 쓰면 재장전하는 동안 기본 공격을 못 한다 (스킬은 가능).'],
  VAN: ['근접 타격으로 싸운다. 타격 위력 · 콤보와 피니쉬 · 치명타가 중요하다.', `주력: 타격 위력, 타격 속도, 명중, 콤보 · 피니쉬 피해량, 치명 확률 · 피해. 무기별 N번째 공격이 피니쉬 (×${CFG.finishMult}).`],
  SPEC: ['기술로 싸운다. 기술 위력 · 효과 명중 · 쿨다운이 중요하다.', '주력: 기술 위력, 효과 명중, 쿨다운 감소 속도, 기술 범위. 기술 피해는 치명타가 없다 (일부 특성 예외).'],
  CMD: ['아군이 함께 쓰는 전술 위력으로 스킬을 쓴다. 출전 인원이 적을수록, 지휘관이 많고 정신력이 높을수록 강하다.', `스킬은 전술 위력으로 계산한다. 전술 위력 = 20 − 출전 기물 수 × 2 + Σ(지휘관마다 2 + ⌊정신력 × 0.25⌋), 1당 위력 ${CFG.tacScale}.`],
};
const TTYPE_DESC: Record<string, [string, string]> = {
  major: ['자주 증강을 고르며, 모두가 쓸 수 있는 메이저 증강도 나온다.', '3등급마다 능력치 2개 +3, 3등급마다 증강 (전용 + 메이저 공용 풀).'],
  minor: ['런 동안 조금씩 쌓이는 성장 특성을 가진다.', '3등급마다 능력치 2개 +3, 5등급마다 증강. 성장 특성은 런 내내 누적된다.'],
  special: ['합류할 때 스페셜 증강을 하나 더 고르고, 능력치는 알아서 자란다.', '매 등급 추천 능력치 2종 중 하나가 자동으로 +3 (선택 창 없음), 5등급마다 증강, 합류 시 스페셜 증강 1개 추가.'],
  psionic: ['이성 수치에 따라 강해지거나 흔들린다.', `3등급마다 능력치 2개 +3, 5등급마다 증강, 4등급마다 사이오닉 증강. 이성은 ${CFG.reasonStart}에서 시작해 전투마다 초기화.`],
  divine: ['신성력을 모아 전투당 한 번 신권 대행을 쓴다. 전투 후 권능 포인트를 얻는다.', `3등급마다 능력치 2개 +3, 5등급마다 증강. 신성력 0~100, 전투당 수집 상한 ${CFG.divCap}, 권능 = 모은 신성력 ÷ ${CFG.powerPerDiv} (최대 ${CFG.powerMax}).`],
};
/** 특성 하위 항목 (접힘) */
function sub(key: string, icon: string, cls: string, name: string, kind: string, body: string) {
  const open = app.subOpen.has(key);
  return `<div class="sub ${open ? 'open' : ''}"><span class="sub-h" data-a="toggle-sub" data-v="${key}" aria-expanded="${open}"><i class="${cls}">${icon}</i><b>${esc(name)}</b><span class="muted">${kind}</span><span class="caret">${open ? '▾' : '▸'}</span></span>${open ? `<div class="sub-b">${body}</div>` : ''}</div>`;
}
/** 전술 유형별 고유 정보 (성장 특성 · 이성 · 신권 대행) */
function ttypeExtra(d: UnitDef, u: UnitState | null, run: RunState | null) {
  const out: string[] = [];
  const g = u?.grow || {};
  if (d.ttype === 'minor' && d.growth) {
    const prog = Object.entries(g).filter(([k]) => !k.startsWith('f_')).map(([k, v]) => `${k} ${v}`).join(', ');
    out.push(`<p><b>${esc(d.growth.name)}</b> · ${esc(app.detail ? d.growth.desc : GROWTH_BRIEF[d.id] || d.growth.desc)}${app.detail && prog ? ` <span class="accent">(누적: ${esc(prog)})</span>` : ''}</p>`);
  }
  if (d.ttype === 'psionic' && d.psi) out.push(`<p><b>이성</b> · ${esc(app.detail
    ? `${d.psi.desc} 이성이 높으면 받는 정신·신성 피해 감소 · 지원 효율 증가, 음수면 정신 피해 증폭 · 흡혈, -50 이하는 광폭 (피해 +30%, 초당 최대 체력 2% 손실).`
    : `${PSI_BRIEF[d.id] || d.psi.desc} 높으면 단단해지고, 낮으면 정신 피해가 강해지며, 너무 낮으면 광폭한다.`)}</p>`);
  if (d.ttype === 'special') out.push(`<p class="muted">자동 성장: ${recMajors(d).map((m) => MAJOR_NAME[m]).join(' · ')}</p>`);
  if (d.ttype === 'divine') {
    const act = DIVINE_ACT[d.ctype];
    out.push(`<p><b>신권 대행 · ${esc(act.name)}</b> · ${esc(app.detail ? `${act.desc}. 신앙 효과가 더해진다.` : act.desc.split(',')[0] + '.')}</p>`);
  }
  void run;
  return out.join('');
}
function faithBody(d: UnitDef, f: FaithId, run: RunState | null) {
  const fd = FAITH_DEF[f];
  if (d.ttype !== 'divine') return `<p class="muted">디바인이 아니라 평소에는 효과가 없다. (도로스의 성찬을 받으면 그 전투 동안 깨어난다)</p>`;
  return `<p>${esc(app.detail ? `신성력 획득: ${fd.gain}, 초당 +2. 신권 대행에 더해지는 효과: ${fd.act}. 수집 상한 ${CFG.divCap + (run?.divCap || 0)}.` : `신권 대행에 더해지는 가호: ${fd.act}.`)}</p>`;
}
/** 특성 블록: 고유 특성 + 전투 유형 · 전술 유형 · 고유 신앙 (접힘) */
function traitGroup(d: UnitDef, u: UnitState | null, run: RunState | null) {
  const f = u?.faith || d.faith;
  const k = (x: string) => `${d.id}:${x}`;
  const ct = CTYPE_DESC[d.ctype], tt = TTYPE_DESC[d.ttype];
  return `<div class="abil ab-trait"><div class="ab-head"><span class="ab-kind">특성</span><b>${esc(d.trait.name)}</b></div><p>${esc(traitText(d))}</p>
    <div class="subs">
      ${sub(k('ct'), CTYPE_ICON(d.ctype), `ct-${d.ctype}`, CTYPE_NAME[d.ctype], '전투 유형', `<p>${esc(app.detail ? ct[1] : ct[0])}</p>`)}
      ${sub(k('tt'), TTYPE_ICON(d.ttype), `tt-${d.ttype}`, TTYPE_NAME[d.ttype], '전술 유형', `<p>${esc(app.detail ? tt[1] : tt[0])}</p>${ttypeExtra(d, u, run)}`)}
      ${sub(k('faith'), typeIcon('faith'), `faith-${d.ttype === 'divine' ? 'on' : 'off'}`, FAITH_NAME[f], '고유 신앙', faithBody(d, f, run))}
    </div></div>`;
}
const AB_KIND = { weapon: '무기', trait: '특성', skill: '스킬', grow: '성장', psi: '이성', div: '신권' } as const;
/** 무기 · 특성 · 스킬 등을 같은 모양의 블록으로 */
function abil(kind: keyof typeof AB_KIND, name: string, meta: string, desc: string) {
  return `<div class="abil ab-${kind}"><div class="ab-head"><span class="ab-kind">${AB_KIND[kind]}</span><b>${esc(name)}</b>${meta ? `<span class="ab-meta">${meta}</span>` : ''}</div><p>${esc(desc)}</p></div>`;
}
function weaponAbil(w: Weapon, elem = w.elem) {
  const el = elem !== 'phys' ? `${ELEM_NAME[elem]} 피해 · ` : '';
  if (w.kind === 'none') return abil('weapon', w.name, '', '기본 공격을 하지 않는다.');
  const brief = w.kind === 'mag' ? `${el}탄창 ${w.mag}발, 다 쓰면 재장전한다.` : `${el}${w.combo}번째 공격마다 강력한 피니쉬.`;
  const pow = w.tactical ? '전술 위력' : w.type === 'shoot' ? '사격 위력' : '타격 위력';
  const full = `${ELEM_NAME[elem]} · ${pow} ${Math.round(w.mult * 100)}% · ${w.kind === 'mag' ? `탄 ${w.mag} · 재장전 ${w.reload}초` : `콤보 ${w.combo} (피니쉬 ×${CFG.finishMult})`} · 공격 간격 ${w.interval}초`;
  return abil('weapon', w.name, app.detail ? `${WPOS(w.range)} · 사거리 ${w.range}` : WPOS(w.range), app.detail ? full : brief);
}
/** 지휘관 스킬은 전술 위력으로 계산된다 */
function skillText(d: UnitDef, sk = d.skill.params) {
  if (!app.detail) return BRIEF[d.id]?.skill || d.skill.desc(sk);
  const t = d.skill.desc(sk);
  return d.ctype === 'CMD' ? t.replace(/기술 위력/g, '전술 위력') : t;
}
const traitText = (d: UnitDef) => (app.detail ? d.trait.desc : BRIEF[d.id]?.trait || d.trait.desc);
function detailToggle() {
  return `<button class="btn tiny dtoggle ${app.detail ? 'on' : ''}" data-a="toggle-detail" aria-pressed="${app.detail}" title="계수 · 세부 규칙 표시 (단축키 D)">상세 보기 ${app.detail ? 'ON' : 'OFF'}</button>`;
}
function unitCard(d: UnitDef, opts: { selected?: boolean; action?: string; rank?: number; clone?: boolean } = {}) {
  return `<button class="ucard ${opts.selected ? 'sel' : ''}" ${opts.clone ? 'aria-hidden="true" tabindex="-1"' : ''} data-a="${opts.action || 'pick-starter'}" data-v="${d.id}">
    ${hero(d.id, 'hero sm')}<div class="ucard-head">${sprite(d, 'spr big')}${nameBlock(d, [...d.factions, ...d.traits], opts.rank, opts.action === 'pick-recruit' ? ownedChip(d.id) : chip)}</div>
    ${unitInfo(d)}
  </button>`;
}
/** 무기 · 특성 · 스킬 · 기본 능력치 */
function unitInfo(d: UnitDef) {
  return `${weaponAbil(d.weapon)}
    ${traitGroup(d, null, app.run)}
    ${abil('skill', d.skill.name, app.detail ? `${d.skill.cd}초` : '', skillText(d))}
    <div class="majors-mini">${MAJORS.map((m) => `<span title="${MAJOR_NAME[m]}">${majorIcon(m)}<b>${d.base[m]}</b></span>`).join('')}</div>`;
}
/** 역할: 전투 유형 · 전술 유형 (아이콘 + 이름) */
function roleTag(d: UnitDef) {
  return `<span class="pc-role"><span class="ct-${d.ctype}">${CTYPE_ICON(d.ctype)} ${CTYPE_NAME[d.ctype]}</span><span class="tt-${d.ttype}">${TTYPE_ICON(d.ttype)} ${TTYPE_NAME[d.ttype]}</span></span>`;
}
/** 시작 기물 후보 카드: 스탠딩 + 이름 + 역할 + 시너지. 호버(터치는 탭)하면 카드 안에서 설명이 올라온다 */
interface PickOpts { clone?: boolean; on: boolean; badge?: string; tapAct: string; full?: boolean; fullLabel?: string; chipFn?: (id: string) => string; extra?: string }
function pickCard(d: UnitDef, o: PickOpts) {
  const { clone, on, full } = o;
  return `<div class="pcard ${on ? 'sel' : ''} ${app.cardOpen === d.id && !clone ? 'open' : ''}" data-a="${o.tapAct}" data-v="${d.id}" ${clone ? 'aria-hidden="true"' : 'tabindex="0" role="button"'} aria-label="${esc(d.name)}">
    <div class="pc-art">${standImg(d.id, 'stand') || sprite(d, 'spr big')}</div>
    ${on ? `<span class="pc-check">✓${o.badge ? ` ${o.badge}` : ''}</span>` : ''}
    <div class="pc-syn">${[...d.factions, ...d.traits].map((id) => { const sd = SYN_BY_ID[id as SynergyId]; return `<span class="syn-b" style="--c:${sd.color}" data-a="syn-peek" aria-label="${esc(sd.name)}"><span class="syn-dia">${synIcon(id)}</span><span class="syn-label">${esc(sd.name)}</span></span>`; }).join('')}</div>
    <div class="pc-panel">
      <div class="pc-top"><b class="pc-name">${esc(d.name)}</b>${roleTag(d)}${o.extra || ''}
        <div class="chips">${[...d.factions, ...d.traits].map(o.chipFn || chip).join('')}</div>
        <button class="pc-more" data-a="card-open" data-v="${d.id}" ${clone ? 'tabindex="-1"' : ''}>${app.cardOpen === d.id && !clone ? '접기 ▼' : '상세 보기 ▲'}</button></div>
      <div class="pc-desc" data-a="noop">${unitInfo(d)}
        <button class="btn ${on ? '' : 'primary'} pc-pick" data-a="${o.tapAct}" data-v="${d.id}" ${full ? 'disabled' : ''} ${clone ? 'tabindex="-1"' : ''}>${on ? '선택 해제' : full ? o.fullLabel || '선택 불가' : '선택'}</button></div>
    </div>
  </div>`;
}
const CAN_HOVER = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;

function newRunScreen() {
  const n = app.starters.length;
  return `<main class="wrap nr">
    <div class="nr-head">
      <div><h1>계약 기물 선택</h1><p class="muted small">이번 출격에 응한 ${app.pool.length}명 중 ${CFG.startUnits}명을 고르세요. ${CAN_HOVER ? '카드에 마우스를 올리면 설명이 나오고, 누르면 선택합니다.' : '카드를 누르면 선택합니다. 하단을 위로 끌어올리거나 [상세 보기]를 누르면 설명이 나옵니다.'}</p></div>
      ${detailToggle()}
      ${diffMini()}
    </div>
    <div class="carousel">
      <button class="car-btn prev" data-a="car-prev" aria-label="이전 기물">‹</button>
      <div class="car-track" aria-label="후보 기물 (좌우로 넘겨 보기)">${[0, 1, 2].map((k) => app.pool.map((id) => {
        const on = app.starters.includes(id);
        return pickCard(UNIT_BY_ID[id], { clone: k !== 1, on, badge: on ? String(app.starters.indexOf(id) + 1) : '', tapAct: 'card-tap', full: !on && app.starters.length >= CFG.startUnits, fullLabel: `이미 ${CFG.startUnits}명 선택` });
      }).join('')).join('')}</div>
      <button class="car-btn next" data-a="car-next" aria-label="다음 기물">›</button>
    </div>
    <div class="nr-foot">
      <div class="picked">${app.starters.map((id) => `<button class="picked-u" data-a="pick-starter" data-v="${id}" title="${esc(UNIT_BY_ID[id].name)} 빼기">${sprite(UNIT_BY_ID[id], 'spr')}</button>`).join('')}${'<span class="picked-u empty"></span>'.repeat(CFG.startUnits - n)}</div>
      <button class="btn ghost" data-a="to-title">뒤로</button>
      <button class="btn ghost" data-a="random-starters">무작위</button>
      <button class="btn primary" data-a="start-run" ${n === CFG.startUnits ? '' : 'disabled'}>출격 (${n}/${CFG.startUnits})</button>
    </div>
  </main>`;
}

// ───────────────────────── 화면: 맵
function mapScreen(run: RunState) {
  const p = run.phase;
  const scale = `적 체력 ×${fmt(phaseHpMult(p))} (이번 페이즈 ×${p > 1 ? CFG.phaseHpFactor(p).toFixed(2) : '1'}) · 방어도 ×${Math.pow(CFG.phaseArmor, p - 1).toFixed(2)} · 피해 ×${phaseAmpMult(p).toFixed(2)}`;
  const track = run.map.map((opts, i) => {
    const state = i < run.step ? 'done' : i === run.step ? 'cur' : 'next';
    const picked = run.picked[i];
    const label = i < run.step && picked ? `${NODE_ICON[picked]} ${NODE_NAME[picked]}` : opts.map((o) => `${NODE_ICON[o]} ${NODE_NAME[o]}`).join(' / ');
    return `<li class="${state}">${label}</li>`;
  }).join('');
  const opts = R.currentOptions(run);
  const choices = run.node ? `<button class="node-btn n-${run.node.type}" data-a="resume"><span class="node-ic">${NODE_ICON[run.node.type]}</span><b>${NODE_NAME[run.node.type]} 진행 중</b><span class="small muted">돌아가서 계속하기</span></button>` : opts.map((o, i) => `<button class="node-btn n-${o}" data-a="enter" data-v="${o}" title="단축키 ${i + 1}">
      <span class="node-ic">${NODE_ICON[o]}</span><kbd class="node-key">${i + 1}</kbd><b>${NODE_NAME[o]}</b><span class="small muted">${nodeHint(o)}</span></button>`).join('');
  const pet = tierOf('PET', synergyCounts(deployed(run), run).PET || 0);
  return `<main class="wrap map">
    <section class="map-main">
      <div class="screen-head"><h1>페이즈 ${p}</h1><p class="muted small">${scale}</p></div>
      ${fieldCard(run, true)}
      <ol class="track">${track}</ol>
      <h2>다음 노드</h2>
      <div class="node-choices">${choices}</div>
      <div class="row-btns">
        <button class="btn" data-a="manage">편성 · 장비 관리</button>
        ${pet >= 2 ? `<button class="btn" data-a="loan" ${run.loan ? 'disabled' : ''}>페트라 대출 (+25, 상환 30)</button>` : ''}
      </div>
    </section>
    <aside class="side">
      <h2>파티 <span class="muted small">출전 ${deployed(run).length}/${R.deployCap(run)} · 보유 ${run.units.length}/${CFG.maxParty}</span></h2>
      <div class="party">${run.units.map(rosterTile).join('')}</div>
      <h2>시너지</h2>
      <div class="syn-list">${synergyPanel(run)}</div>
      ${run.quests.length ? `<h2>헬레니우스 퀘스트</h2><ul class="quests">${run.quests.map((q) =>
        `<li class="${q.done ? 'done' : ''}">${esc(R.questText(q))} <span class="muted">${Math.min(q.progress, q.target)}/${q.target} · 보상 ${R.questRewardText(q)}</span></li>`).join('')}</ul>` : ''}
      ${run.privilege ? `<h2>특권</h2><ul class="globals"><li><b>${esc(R.privilegeName(run.privilege))}</b> <span class="muted">${esc(R.privilegeDesc(run.privilege))}</span></li></ul>` : ''}
      ${run.boons.length || run.phaseBoons.length || run.mods.nodeIncome || run.mods.interestCap ? `<h2>사건 효과</h2><ul class="globals">${run.boons.map((id) => `<li><b>${esc(BOONS[id]?.name || id)}</b> <span class="muted">영구</span></li>`).join('')}${run.phaseBoons.map((id) => `<li><b>${esc(BOONS[id]?.name || id)}</b> <span class="muted">이번 페이즈</span></li>`).join('')}${run.mods.nodeIncome ? `<li><b>분할 정산</b> <span class="muted">노드마다 크레딧 +${run.mods.nodeIncome}, 이자 상한 ${run.mods.interestCap}</span></li>` : ''}</ul>` : ''}
      ${run.globals.length ? `<h2>전역 증강</h2><ul class="globals">${run.globals.map((g) => `<li><b>${esc(GLOBAL_BY_ID[g].name)}</b> <span class="muted">${esc(GLOBAL_BY_ID[g].desc)}</span></li>`).join('')}</ul>` : ''}
      <h2>기록</h2>
      <ul class="log">${run.log.slice(0, 8).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </aside>
  </main>`;
}
function nodeHint(o: NodeType) {
  return ({
    battle: '공명도 · 크레딧 · 재료 확률', adversity: `적 ×${CFG.adversityMult} · 보상 1.5배 + 재료 확률`, shop: '장비 재료 · 고급 장비 구매',
    supply: '보급품 3종 중 택1', recruit: '새 동료 3명 중 택1', boss: `승리 시 페이즈 클리어 · ${CFG.drop.bossAdvEvery}페이즈마다 고급 장비`,
    pilgrim: '신앙 획득 + 이번 페이즈 축복 선택', news: '명성을 보상으로 교환', invest: '호이슌 투자 상품 · 크레딧으로 문장 · 증강 · 다음 페이즈 수익', event: '전장에 얽힌 사건 · 선택에 따라 판이 바뀝니다',
  } as Record<NodeType, string>)[o];
}
/** 파티 타일: 초상화(좌하단 공명 등급) · 장비 · 소속 시너지 */
function rosterTile(u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  const run = app.run;
  const locked = !!run && u.lock === run.phase;
  const syns = memberships(u, run).map((id) => SYN_BY_ID[id]).filter(Boolean)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'faction' ? -1 : 1));
  const tip = `${d.name} · 공명 등급 ${u.rank}${u.pos ? '' : ' · 대기'}${locked ? ' · 이번 페이즈 출전 불가' : ''}`;
  return `<button class="rt${u.pos ? '' : ' rt-off'}" data-a="manage" data-v="${u.uid}" title="${esc(tip)}" aria-label="${esc(tip)}">
    <span class="rt-art">${sprite(d)}<span class="rt-rank">${u.rank}</span>${locked ? '<span class="rt-lock" aria-hidden="true">⛓</span>' : ''}</span>
    <span class="rt-items">${u.items.map((i) => itemIcon(i)).join('')}${u.mod ? itemIcon(u.mod) : ''}</span>
    <span class="rt-syn">${syns.map((sd) => `<span class="rt-s" style="--c:${sd.color}" title="${esc(sd.name)}">${synIcon(sd.id)}</span>`).join('')}</span>
  </button>`;
}
function rosterRow(u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  return `<button class="roster-row ${u.pos ? '' : 'bench'}" data-a="manage" data-v="${u.uid}">
    ${sprite(d)}<span class="rr-main"><b>${esc(d.name)}${app.run && u.lock === app.run.phase ? ' <small class="down">⛓ 이번 페이즈 출전 불가</small>' : ''}</b>${xpBar(u)}</span>${rankPips(u.rank)}
    <span class="rr-items">${u.items.map((i) => itemIcon(i)).join('')}${u.mod ? itemIcon(u.mod) : ''}</span>
  </button>`;
}

// ───────────────────────── 화면: 편성 (전투 준비 / 관리)
function prepScreen(run: RunState) {
  const node = run.node;
  const isBattle = !!node?.enc;
  const n = node?.enc?.n || CFG.bossBoard;
  const rows = playerRows(n);
  const lay = layout(run, n);
  const cap = R.deployCap(run);
  let cells = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const mine = y >= n - rows;
      const enemyZone = y < rows;
      cells += `<div class="cell ${mine ? 'mine' : enemyZone ? 'foe' : 'mid'}" ${mine ? `data-drop="cell:${x}:${y}"` : ''}></div>`;
    }
  let units = '';
  for (const u of deployed(run)) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const d = UNIT_BY_ID[u.defId];
    const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
    units += `<div class="u side0 placed ${sel ? 'sel' : ''}" style="left:${(p.x / n) * 100}%;top:${(p.y / n) * 100}%;width:${100 / n}%;height:${100 / n}%"
      data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}">
      ${sprite(d, '')}<span class="ubadge">R${u.rank}</span><span class="uitems">${u.items.filter(Boolean).map(() => '<i></i>').join('')}</span></div>`;
  }
  if (node?.enc) node.enc.enemies.forEach((s, i) => {
    const e = ENEMY_BY_ID[s.defId];
    const sel = app.sel?.k === 'enemy' && app.sel.i === i;
    units += `<div class="u side1 placed ${e.tier !== 'minion' ? 'big' : ''} ${sel ? 'sel' : ''}" style="left:${(Math.min(s.c, n - 1) / n) * 100}%;top:${(Math.min(s.row, n - 1) / n) * 100}%;width:${100 / n}%;height:${100 / n}%"
      data-a="sel-enemy" data-v="${i}" title="${esc(`${e.name} — ${ENEMY_DESC[e.id] || ''}`)}">${sprite(e, '')}</div>`;
  });
  const bench = run.units.filter((u) => !u.pos);
  const free = cap - deployed(run).length;
  const canFill = bench.some((u) => R.canDeploy(run, u));
  const env = node?.enc ? `${node.enc.env} ${n}×${n}${node.type === 'adversity' ? ' · 역경' : ''}${node.type === 'boss' ? ' · 보스전' : ''}` : '편성 관리';
  return `<main class="wrap prep">
    <aside class="side left">
      <h2>시너지</h2><div class="syn-list">${synergyPanel(run)}</div>
    </aside>
    <section class="board-col">
      <div class="board-head"><b>${esc(env)}</b><span class="muted small">출전 ${deployed(run).length}/${cap} · 아래 ${rows}줄에 배치</span>
        ${free > 0 && canFill ? `<span class="small warn">빈 자리 ${free}</span><button class="btn tiny" data-a="autofill" title="단축키 A">자동 배치</button>` : ''}</div>
      <div class="board" style="--n:${n}"><div class="cells">${cells}</div>${units}</div>
      <div class="bench" data-drop="bench">
        <span class="bench-label">대기</span>
        ${bench.length ? bench.map((u) => {
          const d = UNIT_BY_ID[u.defId];
          const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
          return `<div class="bench-u ${sel ? 'sel' : ''}" data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}">${sprite(d, '')}<span class="ubadge">R${u.rank}</span></div>`;
        }).join('') : '<span class="muted small">기물을 여기로 끌어 출전에서 뺄 수 있습니다.</span>'}
      </div>
      ${inventoryPanel(run)}
      <div class="sticky-actions">
        ${isBattle ? `<button class="btn ghost" data-a="to-map">맵으로</button><button class="btn primary" data-a="fight" title="단축키 Space" ${deployed(run).length ? '' : 'disabled'}>전투 시작</button>`
          : `<button class="btn primary" data-a="to-map">완료</button>`}
      </div>
    </section>
    <aside class="side right">${detailPanel(run)}</aside>
  </main>`;
}

function inventoryPanel(run: RunState) {
  const selIdx = app.sel?.k === 'item' ? app.sel.idx : -1;
  const sel = selIdx >= 0 ? run.inventory[selIdx] : null;
  return `<div class="inv" data-drop="inv">
    <div class="inv-head"><b>장비 보관함</b><span class="muted small">${run.inventory.length}/${CFG.inventoryMax} · 기물에게 끌어다 장착, 재료끼리 겹치면 조합</span></div>
    <div class="inv-items">${run.inventory.map((id, i) => itemIcon(id, `data-drag="item:${i}" data-drop="invitem:${i}" data-a="sel-item" data-v="${i}"`).replace('class="item', `class="item${i === selIdx ? ' sel' : ''}`)).join('') || '<span class="muted small">비어 있음</span>'}</div>
    ${sel ? `<div class="inv-detail"><b>${esc(itemInfo(sel).name)}</b> <span class="muted">${esc(itemInfo(sel).desc)}</span>
      <div class="row-btns"><button class="btn small" data-a="sell" data-v="${selIdx}">판매 +${CFG.sell[sel[0]]}</button>
      ${run.inventory.some((x, j) => j !== selIdx && combine(sel, x)) ? `<span class="muted small">조합 가능한 장비를 클릭하면 조합합니다.</span>` : ''}</div></div>` : ''}
  </div>`;
}

function statLines(c: CUnit, b: Battle) {
  const S = (k: keyof CUnit['st']) => b.S(c, k);
  const armor = S('armor');
  const lines: [string, string][] = [
    ['최대 체력', fmt(S('maxHp'))], ['회복 효율', '+' + pctTxt(S('healEff'))],
    ['사격 위력', fmt(S('shoot'))], ['타격 위력', fmt(S('strike'))], ['기술 위력', fmt(S('tech'))],
    ['명중', '+' + pctTxt(S('acc'))], ['치명타', pctTxt(S('crit'))], ['치명타 피해', pctTxt(S('critDmg'))], ['효과 명중', '+' + pctTxt(S('effHit'))],
    ['방어도', `${fmt(armor)} (물리 -${pctTxt(armor / (armor + CFG.armorK))})`], ['효과 저항', '+' + pctTxt(S('effRes'))],
    ['이동 속도', pctTxt(S('moveSpd'))], ['회피', pctTxt(S('eva'))],
    ['공격 속도', `${(Math.max(0.2, 1 + S('atkSpd')) / c.atk.interval).toFixed(2)}/초`], ['쿨다운 감소', '+' + pctTxt(S('cdr'))], ['사거리', String(S('range'))],
  ];
  if (S('armorPen')) lines.push(['방어도 관통', pctTxt(S('armorPen'))]);
  if (S('lifesteal')) lines.push(['흡혈', pctTxt(S('lifesteal'))]);
  return `<dl class="stats">${lines.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

function previewAlly(run: RunState, u: UnitState) {
  const b = new Battle(6, new Rng(1), { phase: run.phase, credits: run.credits });
  b.keepEvents = false;
  const counts = synergyCounts(deployed(run), run);
  const tmp = { ...u, pos: u.pos || { c: 0, r: 0 } };
  const c = u.pos ? buildAlly(b, run, tmp, counts) : buildAlly(b, null, tmp, {});
  return { b, c };
}

function aceLine(run: RunState, u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  if (!u.pos || !d.ace || !tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0)) return '';
  const k = [1, 1, 1.6, 2.5][tierOf('NAV', synergyCounts(deployed(run), run).NAV || 0)];
  const info = `<div class="small muted">에이스 능력 · ${esc(d.ace.name)}: ${esc(d.ace.desc(k))}</div>`;
  return aceTargetUid(run) === u.uid
    ? `<div class="small staff-on">✈ 에이스 파일럿</div>${info}`
    : `<button class="btn small" data-a="ace-target" data-v="${u.uid}">✈ 에이스 파일럿으로 지정</button>${info}`;
}

function detailPanel(run: RunState) {
  const sel = app.sel;
  if (sel?.k === 'enemy' && run.node?.enc) {
    const s = run.node.enc.enemies[sel.i];
    if (!s) return '';
    const e = ENEMY_BY_ID[s.defId];
    const b = new Battle(6, new Rng(1), { phase: run.phase, credits: 0 });
    const c = buildEnemy(b, e, run.phase, run.node.enc.mult);
    return `<div class="detail">
      <div class="d-head">${sprite(e, 'spr big')}<div><b>${esc(e.name)}</b><div class="muted small">${e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '엘리트' : '일반'} · ${e.keywords.map((k) => KEYWORD_NAME[k]).join('/')}</div></div></div>
      <div class="small">${e.atk.type === 'shoot' ? '사격' : '타격'} · ${ELEM_NAME[e.atk.elem]} · 사거리 ${e.range}${e.immobile ? ' · 고정' : ''}</div>
      ${ENEMY_DESC[e.id] ? `<p class="small">${esc(ENEMY_DESC[e.id])}</p>` : ''}
      ${e.skill ? `<div class="skill-line"><b>${esc(e.skill.name)}</b> <span class="muted">(${e.skill.cd}초)</span> ${esc(e.skill.desc({}))}</div>` : ''}
      ${(() => { const k = loadMeta().enemies[e.id]; return k ? `<div class="small muted">도감: 조우 ${k.seen} · 처치 ${k.kills}</div>` : ''; })()}
      <div class="small accent">페이즈 피해 배율 ×${c.phaseAmp.toFixed(2)}</div>
      ${statLines(c, b)}
    </div>`;
  }
  if (sel?.k !== 'unit') return `<div class="detail muted small">기물을 선택하면 스탯 · 스킬 · 증강 · 장비를 볼 수 있습니다.<br><br>
    · 기물을 끌어 배치를 바꿉니다 (보드 ↔ 대기열).<br>· 장비를 기물에게 끌어 장착합니다.<br>· 적을 누르면 적 정보를 봅니다.</div>`;
  const u = run.units.find((x) => x.uid === sel.uid);
  if (!u) return '';
  const d = UNIT_BY_ID[u.defId];
  const { b, c } = previewAlly(run, u);
  const effects = unitEffects(run, u, synergyCounts(deployed(run), run), !!u.pos);
  const tm = totalMajors(u, effects);
  const title = rankTitle(u.rank) + effects.reduce((s, e) => s + (e.title || 0), 0);
  const cost = R.xpCost(run);
  return `<div class="detail">
    ${hero(d.id)}<div class="d-tools">${detailToggle()}</div><div class="d-head">${sprite(d, 'spr big')}${nameBlock(d, memberships(u, run), u.rank, chip, memberships(u, run).includes('KAL') ? `<div class="small accent">작위: ${TITLE_NAME[Math.min(6, title)]}</div>` : '')}</div>
    ${aceLine(run, u)}
    ${xpBar(u)}
    <button class="btn small" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost ? 'disabled' : ''}>공명도 +${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)} (크레딧 ${cost})</button>
    <h3>메이저 스탯</h3>
    <div class="majors">${MAJORS.map((m) => {
      const base = d.base[m], add = tm[m] - base;
      return `<div class="major"><span>${majorIcon(m)}${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`;
    }).join('')}</div>
    <h3>능력</h3>
    <div class="abils">
      ${weaponAbil(c.weapon || d.weapon, c.atk.elem)}
      ${traitGroup(d, u, run)}
      ${abil('skill', d.skill.name, app.detail ? `${c.cdMax.toFixed(1)}초${d.ctype === 'CMD' ? ' · 전술 위력' : ''}` : '', skillText(d, c.sk))}
    </div>
    <h3>증강 <span class="muted">${u.augments.length}</span></h3>
    ${u.augments.length ? `<ul class="augs">${u.augments.map((a) => { const ad = AUG_BY_ID[a.id]; return `<li class="aug-li">${augIcon(a.id)}<span><b>${esc(ad?.name || a.id)}</b><br><span class="muted">${esc(augDesc(a.id, a.param))}</span></span></li>`; }).join('')}</ul>` : '<p class="muted small">공명 등급이 오르면 증강을 고릅니다.</p>'}
    <h3>장비</h3>
    <div class="eq">${u.items.map((it, i) => it ? `<div class="eq-slot" data-drag="eq:${u.uid}:${i}">${itemIcon(it)}<span><b>${esc(itemInfo(it).name)}</b><br><span class="muted small">${esc(itemInfo(it).desc)}</span></span>
      ${isLocked(it) ? '<span class="muted small">고정</span>' : `<button class="btn tiny" data-a="unequip" data-v="${u.uid}:${i}">해제</button>`}</div>` : `<div class="eq-slot empty" data-drop="unit:${u.uid}">${itemIcon(null)}<span class="muted small">빈 슬롯</span></div>`).join('')}</div>
    <h3>개조부품 <span class="muted small">시너지 ${memberships(u).length}/5</span></h3>
    <div class="eq">${u.mod ? `<div class="eq-slot mod" data-drag="eq:${u.uid}:-1">${itemIcon(u.mod)}<span><b>${esc(itemInfo(u.mod).name)}</b><br><span class="muted small">${esc(itemInfo(u.mod).desc)}</span></span>
      <button class="btn tiny" data-a="unequip" data-v="${u.uid}:-1">해제</button></div>` : `<div class="eq-slot empty mod" data-drop="unit:${u.uid}"><span class="item empty tM"></span><span class="muted small">빈 개조부품 칸 · 문장을 끌어다 장착</span></div>`}</div>
    <h3>전투 스탯 ${u.pos ? '' : '<span class="muted">(시너지 미적용)</span>'}</h3>
    ${statLines(c, b)}
    <p class="lore">${esc(d.lore)}</p>
    ${releaseBlock(run, u)}
  </div>`;
}

// ───────────────────────── 화면: 전투
function battleScreen(run: RunState) {
  const enc = run.node!.enc!;
  return `<main class="wrap battle">
    <section class="board-col">
      <div class="board-head"><b>${esc(enc.env)}</b><span id="btime" class="mono">0.0초</span>
        <span class="speed">${SPEEDS.map((s) => `<button class="btn tiny ${app.speed === s ? 'on' : ''}" data-a="speed" data-v="${s}">${s}×</button>`).join('')}
        <button class="btn tiny" data-a="skip">결과로</button></span></div>
      <div class="board" id="bboard" style="--n:${enc.n}"><div class="cells">${'<div class="cell"></div>'.repeat(enc.n * enc.n)}</div></div>
    </section>
    <aside class="side right">
      <div class="meter-tabs">${([['dmg', '준 피해'], ['taken', '받은 피해'], ['support', '회복 · 보호막'], ['kills', '결정타']] as const).map(([k, l]) => `<button class="btn tiny ${app.meterTab === k ? 'on' : ''}" data-a="meter-tab" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="meter" class="meter"></div>
      <div id="bunit" class="bunit"></div>
    </aside>
    ${app.summary ? summaryModal(run) : ''}
  </main>`;
}

let meterAt = 0;
function updateMeter(force = false) {
  const v = app.view;
  if (!v) return;
  // 매 프레임 다시 그리면 클릭이 씹히므로 0.25초 간격으로
  const now = performance.now();
  if (!force && now - meterAt < 250 && !v.b.over) return;
  meterAt = now;
  const t = document.getElementById('btime');
  if (t) t.textContent = `${v.b.t.toFixed(1)}초${v.b.t > CFG.overtimeStart ? ' · 연장전' : ''}`;
  const m = document.getElementById('meter');
  if (!m) return;
  // 소환물 수치는 주인에게 합산. 탭: 준 피해(속성 비중) / 받은 피해 / 회복 · 보호막 / 결정타
  const tab = app.meterTab;
  const val = (a: Agg) => (tab === 'dmg' ? a.dmg : tab === 'taken' ? a.taken : tab === 'support' ? a.healed + a.shield : a.kills);
  const rows = aggAllies(v.b).sort((x, y) => val(y) - val(x));
  const max = Math.max(1, ...rows.map(val));
  m.innerHTML = rows.map((a) => `<div class="mrow ${a.u.alive ? '' : 'dead'} ${app.battleSel === a.u.id ? 'sel' : ''}" data-a="bsel" data-v="${a.u.id}">${sprite(a.u)}<span class="mname">${esc(a.u.name)}</span>
    ${tab === 'dmg' ? `<span class="mbar">${elemBar(a)}<i class="fill" style="width:${(a.dmg / max) * 100}%"></i></span>` : `<span class="mbar"><i style="width:${(val(a) / max) * 100}%"></i></span>`}
    <b class="mono">${tab === 'kills' ? a.kills : fmt(val(a))}</b>
    ${tab === 'support' ? `<small class="heal-t">회복 ${fmt(a.healed)} · 보호막 ${fmt(a.shield)}</small>` : ''}</div>`).join('');
  const bu = document.getElementById('bunit');
  const sel = v.b.units.find((x) => x.id === app.battleSel);
  if (bu) bu.innerHTML = sel ? battleUnitInfo(v.b, sel) : '<p class="muted small">기물을 누르면 장비(캠핑 러버 임시 장비 포함)를 볼 수 있습니다.</p>';
}

function summaryModal(run: RunState) {
  const s = app.summary!;
  const xp = s.xp.filter((x) => x.amount > 0).map((x) => {
    const u = run.units.find((y) => y.uid === x.uid);
    return u ? `<li>${sprite(UNIT_BY_ID[u.defId])} ${esc(UNIT_BY_ID[u.defId].name)} <b>+${x.amount}</b></li>` : '';
  }).join('');
  return `<div class="modal-bg"><div class="modal result ${s.won ? 'win' : 'lose'}">
    <h1>${s.gameOver ? '용병단 전멸' : s.won ? '승리' : '패배'}</h1>
    <ul class="lines">${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    ${xp ? `<h3>공명도 획득</h3><ul class="xp-gain">${xp}</ul>` : ''}
    ${app.lastBattle ? `<h3>전투 기록</h3>${battleTable(app.lastBattle)}` : ''}
    <button class="btn primary" data-a="after-battle">${s.gameOver ? '결과 보기' : '계속'}</button>
  </div></div>`;
}

// ───────────────────────── 화면: 상점
function shopScreen(run: RunState) {
  const stock = run.node?.shop || [];
  return `<main class="wrap">
    <div class="screen-head"><h1>암시장 상점</h1><p class="muted">재료 2개를 같은 기물에 장착하거나 보관함에서 겹치면 고급 장비가 됩니다. 같은 고급 장비 2개는 전설(효과 3배)이 됩니다.</p></div>
    <div class="shop">${stock.map((s, i) => {
      const it = itemInfo(s.item);
      return `<div class="shop-item t${it.tier} ${s.sold ? 'sold' : ''}">${itemIcon(s.item)}<div><b>${esc(it.name)}</b><div class="small muted">${esc(it.desc)}</div></div>
        <button class="btn small" data-a="buy" data-v="${i}" ${s.sold || run.credits < s.price ? 'disabled' : ''}>${s.sold ? '판매됨' : `${s.price} 크레딧`}</button></div>`;
    }).join('')}</div>
    ${inventoryPanel(run)}
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">떠나기</button></div>
  </main>`;
}

function newsScreen(run: RunState) {
  const offers = run.node?.news || [];
  return `<main class="wrap">
    <div class="screen-head"><h1>은하 속보</h1><p class="muted">보스전을 앞두고 언론이 몰려왔습니다. 쌓아 둔 명성 <b class="accent">${run.fame}</b>을 보상으로 바꾸세요.</p></div>
    <div class="shop">${offers.map((o, i) => {
      const d = R.NEWS_OFFERS[o.id];
      return `<div class="shop-item ${o.sold ? 'sold' : ''}"><span class="item tA">✪</span><div><b>${esc(d.name)}</b><div class="small muted">${esc(d.desc)}</div></div>
        <button class="btn small" data-a="buy-news" data-v="${i}" ${o.sold || run.fame < o.cost ? 'disabled' : ''}>${o.sold ? '교환함' : `명성 ${o.cost}`}</button></div>`;
    }).join('')}</div>
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">보스전으로</button></div>
  </main>`;
}

function investScreen(run: RunState) {
  const offers = run.node?.invest || [];
  return `<main class="wrap">
    <div class="screen-head"><h1>호이슌 투자 창구</h1><p class="muted">호이슌 홀딩스가 특별 상품을 내밀었습니다. 보유 크레딧 <b class="accent">${run.credits}</b>${run.fund ? ` · 다음 페이즈 정산 예정 <b>${run.fund}</b>` : ''}</p></div>
    <div class="shop">${offers.map((o, i) => {
      const d = R.INVEST_OFFERS[o.id];
      return `<div class="shop-item ${o.sold ? 'sold' : ''}"><span class="item tA">${synIcon('HOI')}</span><div><b>${esc(d.name)}</b><div class="small muted">${esc(d.desc(run, o))}</div></div>
        <button class="btn small" data-a="buy-invest" data-v="${i}" ${o.sold || run.credits < o.cost ? 'disabled' : ''}>${o.sold ? '계약함' : `${o.cost} 크레딧`}</button></div>`;
    }).join('')}</div>
    <div class="sticky-actions"><button class="btn" data-a="manage">편성 · 장비</button><button class="btn primary" data-a="leave-shop">떠나기</button></div>
  </main>`;
}

function overScreen(run: RunState) {
  return `<main class="wrap over">
    <div class="screen-head"><h1>${run.cleared ? '의뢰 성공' : '계약 종료'}</h1><p class="muted">${run.cleared ? `${esc(fieldOf(run.field).name)} 의뢰 완료${run.endless ? ` · 무한 모드 페이즈 ${run.phase}에서 귀환 불가` : ''}.` : `ERRANTEs 는 페이즈 ${run.phase}에서 무너졌습니다.`}${run.diff ? ` 위험 등급 ${run.diff}.` : ''}</p></div>
    <dl class="stats big">
      <dt>도달 페이즈</dt><dd>${run.phase}</dd><dt>전투</dt><dd>${run.stats.wins}승 ${run.stats.losses}패</dd>
      <dt>처치</dt><dd>${run.stats.kills}</dd><dt>최대 단일 피해</dt><dd>${fmt(run.stats.bestHit)}</dd>
    </dl>
    <div class="roster">${run.units.map(rosterRow).join('')}</div>
    <div class="sticky-actions"><button class="btn primary" data-a="newrun">새 계약</button><button class="btn" data-a="codex">도감</button><button class="btn" data-a="to-title">타이틀</button></div>
  </main>`;
}

/** 전장 정보: 이름 · 지역 · 조건 · 출현 적 · 보스 */
function fieldCard(run: RunState, compact = false) {
  const f = fieldOf(run.field);
  const nm = (id: string) => esc(ENEMY_BY_ID[id]?.name || id);
  const bossNow = f.bosses[(run.phase - 1) % f.bosses.length];
  return `<div class="field-card ${compact ? 'compact' : ''}" style="--c:${f.color}">
    <div class="fc-head"><span class="fc-ic">${f.icon}</span><div><b>${esc(f.name)}</b><div class="muted small">${esc(f.region)}</div></div></div>
    ${compact ? '' : `<p class="small">${esc(f.desc)}</p>`}
    <ul class="fc-rules">${f.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="small muted">출현: ${f.pool.map(nm).join(' · ')} · 정예 ${nm(f.elite)}</div>
    <div class="small"><span class="accent">보스</span> ${f.bosses.map((id) => (id === bossNow ? `<b>${nm(id)}</b>` : nm(id))).join(' → ')} <span class="muted">(페이즈마다 순환)</span></div>
  </div>`;
}

// ───────────────────────── 모달: 대기 중인 선택
function pendingModal(run: RunState): string {
  const p = run.pending[0];
  if (!p || app.screen === 'battle' || app.screen === 'over') return '';
  let body = '', mcls = '';
  if (p.t === 'global') {
    body = `<h1>전역 증강</h1><p class="muted">런 전체에 적용되는 증강을 하나 고르세요.</p>
      <div class="cards">${p.options.map((id) => { const g = GLOBAL_BY_ID[id]; return `<button class="card" data-a="pick-global" data-v="${id}"><b>${esc(g.name)}</b><span>${esc(g.desc)}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'event') {
    const ev = EVENT_BY_ID[p.id];
    body = `<div class="event ${ev.rare ? 'rare' : ''}"><h1>${ev.rare ? '✦ ' : ''}${esc(ev.title)}</h1>${ev.rare ? '<p class="accent small">희귀 사건</p>' : ''}
      <p>${esc(ev.text)}</p>
      <div class="cards">${ev.choices.map((c, i) => { const why = c.block?.(run); return `<button class="card" data-a="event-choice" data-v="${i}" ${why ? 'disabled' : ''}><b>${esc(c.label)}</b><span>${esc(c.desc)}</span>${why ? `<span class="down small">${esc(why)}</span>` : ''}</button>`; }).join('')}</div></div>`;
  } else if (p.t === 'victory') {
    body = `<h1>의뢰 성공</h1><p>페이즈 ${run.phase} 보스를 격파했습니다. ${esc(fieldOf(run.field).name)} 의뢰가 완료되었습니다${run.diff ? ` (위험 등급 ${run.diff})` : ''}.</p>
      <p class="muted small">귀환하면 런이 끝나고 기록이 남습니다. 계속하면 무한 모드로 이어지며, 적은 계속 강해집니다. 어느 쪽이든 다음 위험 등급이 해금됩니다.</p>
      <div class="row-btns"><button class="btn primary" data-a="victory-end">귀환 (의뢰 완료)</button><button class="btn" data-a="victory-endless">무한 모드로 계속</button></div>`;
  } else if (p.t === 'field') {
    body = `<h1>전장 브리핑</h1><p class="muted">이번 런의 무대입니다. 전장에 따라 적 구성과 조건이 달라집니다.</p>
      ${fieldCard(run)}
      <div class="row-btns"><button class="btn primary" data-a="field-ok">출격 준비</button></div>`;
  } else if (p.t === 'privilege') {
    body = `<h1>특권 증강</h1><p class="muted">이번 런에만 적용되는 출격 특권을 하나 고르세요. 새로고침 ${p.rerolls}회 남음.</p>
      <div class="cards">${p.options.map((o, i) => `<button class="card aug-unit" data-a="pick-privilege" data-v="${i}"><b>${esc(R.privilegeName(o))}</b><span>${esc(R.privilegeDesc(o))}</span></button>`).join('')}</div>
      <div class="row-btns"><button class="btn" data-a="reroll-privilege" ${p.rerolls > 0 ? '' : 'disabled'}>새로고침 (${p.rerolls}회)</button></div>`;
  } else if (p.t === 'rankup') {
    const u = run.units.find((x) => x.uid === p.uid)!;
    const d = UNIT_BY_ID[u.defId];
    const art = standImg(d.id, 'stand full') + standImg(d.id, 'stand bust', true); // 넓은 화면은 전신, 좁은 화면은 얼굴 기준 상반신
    // 이름 · 등급은 일러스트 위에 (넓은 화면 좌하단, 좁은 화면 우상단)
    const side = `<div class="ru-art" data-stand="${d.id}">${art || sprite(d, 'spr big')}
      <div class="ru-tag"><b>${esc(d.name)}</b><span>${p.join ? `공명 등급 ${p.rank}로 합류` : `공명 등급 <b>${p.rank}</b> 달성`}</span></div></div>`;
    mcls = 'rankup';
    if (!p.allocDone) {
      const left = CFG.rankPicks - app.picks.length;
      const effects = unitEffects(run, u, synergyCounts(deployed(run), run), !!u.pos);
      const tm = totalMajors(u, effects);
      const rec = recommendedMajors(d);
      const conv = (m: Major) => Object.entries(CFG.conv[m]).map(([k, v]) => `${STAT_SHORT[k] || k} +${(v as number) < 1 ? Math.round((v as number) * 100) + '%' : v}`).join(', ');
      body = `${side}<div class="ru-main">
        <div class="ru-head"><h1>${p.rank}등급 달성 보상 · 능력치</h1></div>
        <p class="muted small">공명 등급 3의 배수마다 받는 보상입니다. 서로 다른 스탯 ${CFG.rankPicks}개를 골라 각각 <b class="accent">+${p.points}</b>${p.options?.length === 0 ? '' : ` · 이어서 ${p.rank}등급 증강`}<br>(등급이 오를 때마다 모든 스탯 +${CFG.rankAll}은 이미 반영됨)</p>
        <div class="alloc-grid">${MAJORS.map((m) => {
          const on = app.picks.includes(m);
          return `<button class="stat-pick ${on ? 'on' : ''} ${rec.includes(m) ? 'rec' : ''}" data-a="alloc-pick" data-v="${m}" aria-pressed="${on}" aria-label="${MAJOR_NAME[m]} ${on ? tm[m] + p.points : tm[m]}" ${on || left ? '' : 'disabled'}>
            ${majorIcon(m, 'mi big')}${rec.includes(m) ? '<span class="rec-tag">추천</span>' : ''}
            <span class="sp-val"><b>${on ? tm[m] + p.points : tm[m]}</b></span>
            <span class="tip" role="tooltip"><b>${MAJOR_NAME[m]}</b> 1pt당<br>${conv(m)}${rec.includes(m) ? '<br><span class="accent">이 기물의 공격 방식 · 기본 성향에 맞는 스탯</span>' : ''}</span></button>`;
        }).join('')}
        </div>
        <div class="ru-foot"><button class="btn primary alloc-ok" data-a="alloc-ok" ${left ? 'disabled' : ''}>${left ? `${left}개 더 고르세요` : '확정'}</button></div></div>`;
    } else {
      R.ensureRankupOptions(run, p);
      const opts = p.options || [];
      body = `${side}<div class="ru-main">
        <div class="ru-head"><h1>${p.kind === 'special' ? '합류 보상 · 스페셜 증강' : p.kind === 'psionic' ? `${p.rank}등급 달성 보상 · 사이오닉 증강` : p.join ? '합류 보상 · 증강' : `${p.rank}등급 달성 보상 · 증강`}</h1>
          <span class="muted small">${p.kind === 'special' ? '스페셜 기물은 합류할 때 스페셜 증강 1개를 추가로 고릅니다.' : p.kind === 'psionic' ? '사이오닉 기물은 공명 등급 4의 배수마다 사이오닉 증강을 고릅니다.' : p.join ? '합류할 때 전용 증강 1개를 고릅니다.' : d.ttype === 'major' ? '메이저 기물은 공명 등급 3의 배수마다 전용 · 메이저 공용 증강 중 1개를 고릅니다.' : '공명 등급 5의 배수마다 전용 증강 1개를 고릅니다.'}</span>
          ${p.rerolls > 0 ? `<button class="btn small ru-reroll" data-a="reroll" title="단축키 R">새로고침 ${p.rerolls}</button>` : '<span class="muted small ru-reroll">새로고침 없음</span>'}</div>
        <div class="aug-list">${opts.map((a, i) => {
          const ad = AUG_BY_ID[a.id];
          return `<button class="aug-opt ${app.augPick === i ? 'on' : ''}" data-a="pick-augsel" data-v="${i}" aria-pressed="${app.augPick === i}">${augIcon(a.id)}<span class="ao-txt"><b>${esc(ad.name)}</b><span>${esc(augDesc(a.id, a.param))}</span></span><kbd>${i + 1}</kbd></button>`;
        }).join('') || '<p class="muted">고를 수 있는 증강이 없습니다.</p>'}</div>
        <div class="ru-foot">${opts.length
          ? `<button class="btn primary aug-ok" data-a="pick-aug" data-v="${app.augPick ?? ''}" ${app.augPick === null ? 'disabled' : ''}>${app.augPick === null ? '증강을 고르세요' : '확정'}</button>`
          : '<button class="btn primary" data-a="skip-aug">넘어가기</button>'}</div>
      </div>`;
    }
  } else if (p.t === 'itemPick') {
    body = `<h1>${esc(p.title)}</h1><div class="cards">${p.options.map((id, i) => { const it = itemInfo(id); return `<button class="card" data-a="pick-item" data-v="${i}">${itemIcon(id)}<b>${esc(it.name)}</b><span>${esc(it.desc)}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'recruit') {
    const rank = Math.min(CFG.maxRank, Math.max(1, run.phase - 1) + (R.hasGlobal(run, 'G.scout') ? 1 : 0));
    mcls = 'recruit';
    const pick = app.recruitPick && p.options.includes(app.recruitPick) ? app.recruitPick : null;
    body = `<div class="rc-head"><div><h1>기물 영입</h1><p class="muted small">새 동료 한 명을 고르세요. 공명 등급 ${rank}로 합류합니다. 보유 ${run.units.length}/${CFG.maxParty} (출전 최대 ${R.deployCap(run)}명)</p></div>${detailToggle()}</div>
      <div class="rc-track">${p.options.map((id) => pickCard(UNIT_BY_ID[id], { on: pick === id, tapAct: 'rc-tap', chipFn: ownedChip(id), extra: `<span class="rank rc-rank">R${rank}</span>` })).join('')}</div>
      <div class="rc-foot"><span class="muted small">${pick ? `${esc(UNIT_BY_ID[pick].name)} 선택됨` : CAN_HOVER ? '카드에 마우스를 올리면 설명, 누르면 선택' : '탭하면 선택 · 하단을 끌어올리면 설명'}</span>
        <button class="btn primary" data-a="pick-recruit" data-v="${pick || ''}" ${pick ? '' : 'disabled'}>영입</button></div>`;
  } else if (p.t === 'supply') {
    body = `<h1>보급</h1><div class="cards">${p.options.map((o) => `<button class="card" data-a="pick-supply" data-v="${o}"><b>${esc(R.SUPPLY_TEXT[o])}</b></button>`).join('')}</div>`;
  } else if (p.t === 'pilgrim') {
    const divs = run.units.filter((x) => UNIT_BY_ID[x.defId].ttype === 'divine');
    const C = R.PILGRIM_COST;
    const btn = (act: string, label: string, cost: number, extra = '') => `<button class="card" data-a="pilgrim" data-v="${act}" ${run.power < cost ? 'disabled' : ''}><b>${label}</b><span>${extra}</span><span class="accent small">권능 ${cost}</span></button>`;
    body = `<h1>순례</h1><p class="muted">권능 포인트 <b class="accent">${run.power}</b> · 디바인 기물이 전투에서 모은 신성력으로 얻습니다.</p>
      <div class="cards">
        ${btn('cap', '신성력 수집 상한 +50', C.cap, `현재 전투당 ${CFG.divCap + run.divCap}`)}
        ${btn('bless', '이번 페이즈 축복', C.bless, '축복 3개 중 1개')}
        ${btn('credits', '헌금 환전', C.credits, '크레딧 +3')}
        ${btn('xp', '수행', C.xp, '공명도 4 분배')}
      </div>
      <h3>신앙 변경 <span class="muted small">권능 ${C.faith}</span></h3>
      ${divs.length ? divs.map((x) => `<div class="pil-row"><b>${esc(UNIT_BY_ID[x.defId].name)}</b> <select data-faith="${x.uid}" ${run.power < C.faith ? 'disabled' : ''}>${FAITHS.map((f) => `<option value="${f}" ${f === x.faith ? 'selected' : ''}>${FAITH_NAME[f]}</option>`).join('')}</select>
        <span class="muted small">${esc(FAITH_DEF[x.faith || UNIT_BY_ID[x.defId].faith].act)}</span></div>`).join('') : '<p class="muted small">디바인 기물이 없습니다.</p>'}
      <div class="row-btns"><button class="btn primary" data-a="pilgrim-done">순례 마치기</button></div>`;
  } else if (p.t === 'blessing') {
    body = `<h1>순례 — 축복 선택</h1><p class="muted">축복은 이번 페이즈가 끝날 때까지 유지됩니다.</p>
      <div class="cards">${p.options.map((id) => { const d = BLESSING_BY_ID[id]; return `<button class="card" data-a="pick-blessing" data-v="${id}"><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'notice') {
    body = `<h1>${esc(p.title)}</h1><p>${esc(p.body)}</p><button class="btn primary" data-a="notice-ok">확인</button>`;
  }
  return `<div class="modal-bg"><div class="modal ${mcls}">${body}</div></div>`;
}
const STAT_SHORT: Record<string, string> = {
  maxHp: '체력', healEff: '회복 효율', shoot: '사격', strike: '타격', tech: '기술', acc: '명중', crit: '치명', effHit: '효과 명중',
  armor: '방어도', effRes: '효과 저항', moveSpd: '이동', eva: '회피',
};

function menuModal(run: RunState | null) {
  if (!app.menu) return '';
  if (app.menu === 'import') {
    return `<div class="modal-bg"><div class="modal">
      <h1>저장 코드 불러오기</h1>
      <p class="muted small">다른 기기에서 내보낸 저장 코드를 붙여 넣거나, 저장 파일(.txt)을 선택하세요.</p>
      <textarea id="import-code" rows="5" placeholder="ERR1:..."></textarea>
      <input id="import-file" type="file" accept=".txt,.json,text/plain">
      ${app.importErr ? `<p class="bad small">${esc(app.importErr)}</p>` : ''}
      <div class="row-btns"><button class="btn ghost" data-a="menu-close">닫기</button><button class="btn primary" data-a="import-go">불러오기</button></div>
    </div></div>`;
  }
  if (app.menu === 'export' && run) {
    return `<div class="modal-bg"><div class="modal">
      <h1>저장 코드</h1><p class="muted small">이 코드를 복사해 두면 어떤 브라우저에서든 그대로 이어서 할 수 있습니다.</p>
      <textarea id="export-code" rows="6" readonly>${exportCode(run)}</textarea>
      <div class="row-btns"><button class="btn ghost" data-a="menu">뒤로</button><button class="btn primary" data-a="copy-code">복사</button></div>
    </div></div>`;
  }
  const saves = listSaves();
  const meta = (slot: string) => { const s = saves.find((x) => x.slot === slot); return s ? `페이즈 ${s.phase} · ${new Date(s.time).toLocaleString()}` : '비어 있음'; };
  return `<div class="modal-bg"><div class="modal">
    <h1>메뉴</h1>
    ${run ? `<h3>저장</h3><div class="slot-list">${['slot1', 'slot2', 'slot3'].map((s) => `<div class="slot"><span><b>${SLOT_NAME[s]}</b> <span class="muted small">${meta(s)}</span></span>
      <span><button class="btn tiny" data-a="save" data-v="${s}">저장</button><button class="btn tiny" data-a="load" data-v="${s}" ${saves.some((x) => x.slot === s) ? '' : 'disabled'}>불러오기</button></span></div>`).join('')}
      <div class="slot"><span><b>자동 저장</b> <span class="muted small">${meta('auto')}</span></span><span><button class="btn tiny" data-a="load" data-v="auto" ${saves.some((x) => x.slot === 'auto') ? '' : 'disabled'}>불러오기</button></span></div></div>` : ''}
    <div class="row-btns">
      ${run ? '<button class="btn" data-a="menu-export">저장 코드 내보내기</button>' : ''}
      <button class="btn" data-a="menu-import">저장 코드 불러오기</button>
      <button class="btn" data-a="to-title">타이틀로</button>
      <button class="btn primary" data-a="menu-close">닫기</button>
    </div>
    <h3>단축키</h3>
    <ul class="keys small">
      <li><kbd>1</kbd>~<kbd>9</kbd> 선택지 고르기 (증강 · 영입 · 보급 · 사건 · 다음 노드)</li>
      <li><kbd>Enter</kbd> 확인 · 계속 / <kbd>R</kbd> 새로고침 / <kbd>Esc</kbd> 닫기 · 선택 해제</li>
      <li>편성: <kbd>Space</kbd> 전투 시작, <kbd>A</kbd> 자동 배치 / 맵: <kbd>M</kbd> 편성 관리</li>
      <li>전투: <kbd>1</kbd>~<kbd>4</kbd> 속도 1·2·4·8배, <kbd>Space</kbd> 결과로 · 계속</li>
    </ul>
    <p class="muted small">진행 상황은 노드를 지날 때마다 자동 저장됩니다. 전투 도중 불러오면 전투 직전 편성 화면으로 돌아갑니다.</p>
  </div></div>`;
}

// ───────────────────────── 렌더
const lastView = { screen: '' as string, modal: '' };
function render() {
  if (app.screen !== 'battle' && app.view) { app.view.destroy(); app.view = null; }
  const run = app.run;
  let body = '';
  if (app.screen === 'codex') body = codexScreen();
  else if (app.screen === 'title' || !run) body = app.screen === 'newrun' ? newRunScreen() : titleScreen();
  else if (app.screen === 'newrun') body = newRunScreen();
  else if (app.screen === 'map') body = mapScreen(run);
  else if (app.screen === 'prep') body = prepScreen(run);
  else if (app.screen === 'battle') body = battleScreen(run);
  else if (app.screen === 'shop') body = shopScreen(run);
  else if (app.screen === 'news') body = newsScreen(run);
  else if (app.screen === 'invest') body = investScreen(run);
  else if (app.screen === 'over') body = overScreen(run);
  const showTop = run && app.screen !== 'title' && app.screen !== 'newrun' && app.screen !== 'codex';
  // 다시 그려도 같은 화면 · 같은 창이면 스크롤 위치를 유지한다
  const modalKey = run?.pending[0] ? JSON.stringify([run.pending[0].t, (run.pending[0] as { uid?: string }).uid, (run.pending[0] as { allocDone?: boolean }).allocDone]) : app.menu || '';
  const sameView = lastView.screen === app.screen;
  const keep = ['.side.left', '.side.right', 'aside.side', '.codex-grid'].map((sel) => [sel, root.querySelector(sel)?.scrollTop || 0] as const);
  const modalTop = lastView.modal === modalKey ? root.querySelector('.modal')?.scrollTop || 0 : 0;
  const winY = window.scrollY;
  lastView.screen = app.screen; lastView.modal = modalKey;
  root.innerHTML = `${showTop ? topbar() : ''}${body}${run && app.screen !== 'codex' ? pendingModal(run) : ''}${menuModal(run)}<div id="toast" class="toast" ${app.toast ? '' : 'hidden'}>${esc(app.toast)}</div>`;
  if (sameView) {
    for (const [sel, top] of keep) { const el = root.querySelector(sel); if (el && top) el.scrollTop = top; }
    if (winY) window.scrollTo(0, winY);
  }
  const md = root.querySelector('.modal');
  if (md && modalTop) md.scrollTop = modalTop;
  if (app.screen === 'newrun') setupCarousel();
  const rc = root.querySelector<HTMLElement>('.rc-track');
  if (rc) bindCardDrag(rc);
  if (app.screen === 'battle' && app.needMount) {
    app.needMount = false;
    mountBattleView(document.getElementById('bboard')!);
  }
  const fi = document.getElementById('import-file') as HTMLInputElement | null;
  if (fi) fi.onchange = () => {
    const f = fi.files?.[0];
    if (!f) return;
    f.text().then((t) => { (document.getElementById('import-code') as HTMLTextAreaElement).value = t; });
  };
}

// ───────────────────────── 시작 기물 캐러셀 (무한 순환)
let carX: number | null = null;
function carSet(track: HTMLElement) {
  const cards = track.querySelectorAll<HTMLElement>(':scope > *');
  const n = cards.length / 3;
  return n ? cards[n].offsetLeft - cards[0].offsetLeft : 0;
}
/** 가운데 묶음 밖으로 나가면 같은 위치의 가운데 묶음으로 옮긴다 */
function carWrap(track: HTMLElement) {
  const w = carSet(track);
  if (!w) return;
  if (track.scrollLeft < w * 0.5) track.scrollLeft += w;
  else if (track.scrollLeft > w * 1.5) track.scrollLeft -= w;
  carX = track.scrollLeft;
}
/** 다시 그리지 않고 펼침 상태만 바꾼다 (트랜지션 유지) */
function syncCardOpen() {
  root.querySelectorAll<HTMLElement>('.pcard').forEach((c) => {
    const on = !c.hasAttribute('aria-hidden') && c.dataset.v === app.cardOpen;
    c.classList.toggle('open', on);
    const b = c.querySelector('.pc-more');
    if (b) b.textContent = on ? '접기 ▼' : '상세 보기 ▲';
  });
}
function setupCarousel() {
  const track = root.querySelector<HTMLElement>('.car-track');
  if (!track) return;
  track.style.scrollSnapType = 'none';
  track.scrollLeft = carX ?? carSet(track);
  track.style.scrollSnapType = '';
  let t: ReturnType<typeof setTimeout> | 0 = 0;
  track.addEventListener('scroll', () => { carX = track.scrollLeft; if (t) clearTimeout(t); t = setTimeout(() => carWrap(track), 120); }, { passive: true });
  bindCardDrag(track);
  let lock = 0;
  track.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 가로 스크롤은 그대로
    const desc = (e.target as HTMLElement).closest('.pc-desc') as HTMLElement | null;
    if (desc && desc.scrollHeight > desc.clientHeight + 2) return; // 설명 스크롤 우선
    e.preventDefault();
    const now = Date.now();
    if (now - lock < 250) return;
    lock = now;
    carStep(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}
/** 터치: 카드 하단(이름 · 시너지)을 위로 끌어올리면 설명 펼치기, 아래로 내리면 접기 */
function bindCardDrag(track: HTMLElement) {
  let drag: { id: string; y: number; x: number } | null = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const top = (e.target as HTMLElement).closest('.pc-top');
    const card = top?.closest('.pcard') as HTMLElement | null;
    if (card?.dataset.v) drag = { id: card.dataset.v, y: e.clientY, x: e.clientX };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
    const open = dy < 0;
    if ((app.cardOpen === drag.id) !== open) { app.cardOpen = open ? drag.id : null; syncCardOpen(); }
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    drag = null;
  });
  const end = () => { drag = null; };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
}
function carStep(dir: number) {
  const track = root.querySelector<HTMLElement>('.car-track');
  const card = track?.querySelector<HTMLElement>(':scope > *');
  if (!track || !card) return;
  carWrap(track);
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  track.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
}

function mountBattleView(board: HTMLElement) {
  const run = app.run!;
  const b = buildBattle(run, run.node!.enc!);
  app.lastBattle = b;
  app.battleSel = null;
  app.view = new BattleView(board, b, updateMeter, () => {
    app.summary = R.resolveBattle(run, b);
    metaBattle(b);
    persist();
    // 보드는 그대로 두고 상단 바와 결과 창만 갱신
    const top = root.querySelector('header.top');
    if (top) top.outerHTML = topbar();
    root.querySelector('main.battle')?.insertAdjacentHTML('beforeend', summaryModal(run));
  });
  app.view.speed = app.speed;
  app.view.start();
}

function goPrepOrMap() {
  const run = app.run!;
  if (run.over) { app.screen = 'over'; metaRunEnd(run); }
  else if (run.node?.enc) app.screen = 'prep';
  else if (run.node?.type === 'shop') app.screen = 'shop';
  else if (run.node?.type === 'news') app.screen = 'news';
  else if (run.node?.type === 'invest') app.screen = 'invest';
  else app.screen = 'map';
}


// ───────────────────────── 난이도 선택
/** 한 줄 위험 등급 선택 (조건은 툴팁) */
function diffMini() {
  const max = loadMeta().maxDiff;
  const d = Math.min(app.diff, max);
  const conds = DIFFS.filter((x) => x.lvl >= 1 && x.lvl <= d).map((x) => x.desc);
  return `<div class="diff-mini"><b>위험 등급</b><div class="diff-row">${DIFFS.map((x) => `<button class="btn tiny ${x.lvl === d ? 'on' : ''}" data-a="diff" data-v="${x.lvl}" ${x.lvl > max ? 'disabled title="이전 등급을 클리어하면 해금"' : ''}>${x.lvl === 0 ? '표준' : x.lvl}</button>`).join('')}</div>
    <span class="small muted" title="${esc(conds.join('\n') || '추가 조건 없음')}">${d ? `추가 조건 ${conds.length}개 ⓘ` : `${CFG.victoryPhase}페이즈 보스 격파 시 의뢰 성공`}</span></div>`;
}
function diffPicker() {
  const max = loadMeta().maxDiff;
  const d = Math.min(app.diff, max);
  return `<div class="diff-picker"><b>위험 등급</b>
    <div class="diff-row">${DIFFS.map((x) => `<button class="btn tiny ${x.lvl === d ? 'on' : ''}" data-a="diff" data-v="${x.lvl}" ${x.lvl > max ? 'disabled title="이전 등급을 클리어하면 해금"' : ''}>${x.lvl === 0 ? '표준' : x.lvl}</button>`).join('')}</div>
    <ul class="small muted">${d === 0 ? '<li>추가 조건 없음.</li>' : DIFFS.filter((x) => x.lvl >= 1 && x.lvl <= d).map((x) => `<li>${esc(x.desc)}</li>`).join('')}</ul>
    <p class="small muted">${CFG.victoryPhase}페이즈 보스를 이기면 의뢰 성공. 성공하면 다음 위험 등급이 해금됩니다.</p></div>`;
}

// ───────────────────────── 기물 방출
function releaseBlock(run: RunState, u: UnitState) {
  const v = R.releaseValue(run, u);
  const name = UNIT_BY_ID[u.defId].name;
  const lines = [
    `에너지 크레딧 <b>+${v.credits}</b> (3 + 공명 등급 ${u.rank} × 2)`,
    `공명도 <b>${v.xp}</b> — 이 기물에 쌓인 공명도 ${v.invested}의 60%를 남은 파티에 분배 (출전 기물 우선)`,
    v.items.length ? `장비 · 개조부품 ${v.items.length}개는 보관함으로 (${v.items.map((x) => esc(itemInfo(x).name)).join(', ')})` : '장착한 장비 없음',
    ...(v.lost.length ? [`<span class="down">고유 장비 ${v.lost.map((x) => esc(itemInfo(x).name)).join(', ')}는 함께 사라짐</span>`] : []),
  ];
  const confirm = app.releaseConfirm === u.uid;
  return `<div class="release ${confirm ? 'confirm' : ''}">
    <h3>방출</h3>
    <ul class="small">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    ${confirm ? `<p class="small down">${esc(name)}을(를) 정말 방출할까요? 되돌릴 수 없습니다.</p>
      <div class="row-btns"><button class="btn danger" data-a="release-confirm" data-v="${u.uid}">방출 확정</button><button class="btn" data-a="release-cancel">취소</button></div>`
    : `<button class="btn small" data-a="release" data-v="${u.uid}" ${run.units.length <= 1 ? 'disabled' : ''}>방출하기</button>`}
  </div>`;
}

// ───────────────────────── 전투 기록 (진행 중 미터 · 결과 표)
const ELEM_COLOR: Record<string, string> = { phys: '#cfd3dc', chem: '#7fdc4a', elec: '#5ab8ff', psy: '#c07cff', holy: '#ffd866', true: '#ff6a6a' };
type Agg = { u: CUnit; dmg: number; taken: number; healed: number; shield: number; kills: number; elem: Record<string, number> };
/** 아군 기물별 집계 (소환물은 주인에게 합산) */
function aggAllies(b: Battle): Agg[] {
  return b.units.filter((u) => u.side === 0 && !u.isSummon).map((u) => {
    const parts = [u, ...b.units.filter((s) => s.owner === u)];
    const elem: Record<string, number> = {};
    for (const p of parts) for (const [k, x] of Object.entries(p.counters.elem)) elem[k] = (elem[k] || 0) + (x || 0);
    const sum = (k: 'dmg' | 'taken' | 'healed' | 'shield' | 'kills') => parts.reduce((s, p) => s + p.counters[k], 0);
    return { u, dmg: sum('dmg'), taken: sum('taken'), healed: sum('healed'), shield: sum('shield'), kills: sum('kills'), elem };
  });
}
function elemBar(a: Agg) {
  const tot = Math.max(1, a.dmg);
  return `<span class="ebar" title="${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `${ELEM_NAME[k as keyof typeof ELEM_NAME]} ${Math.round((x / tot) * 100)}%`).join(' · ')}">${Object.entries(a.elem).filter(([, x]) => x > 0).map(([k, x]) => `<i style="width:${(x / tot) * 100}%;background:${ELEM_COLOR[k]}"></i>`).join('')}</span>`;
}
function battleTable(b: Battle) {
  const rows = aggAllies(b).sort((x, y) => y.dmg - x.dmg);
  return `<div class="btable-wrap"><table class="btable"><thead><tr><th>기물</th><th>준 피해</th><th>속성 비중</th><th>받은 피해</th><th>회복</th><th>보호막</th><th>결정타</th></tr></thead><tbody>
    ${rows.map((a) => `<tr class="${a.u.alive ? '' : 'dead'}"><td>${sprite(a.u)} ${esc(a.u.name)}</td><td class="mono">${fmt(a.dmg)}</td><td>${elemBar(a)}</td><td class="mono">${fmt(a.taken)}</td><td class="mono">${fmt(a.healed)}</td><td class="mono">${fmt(a.shield)}</td><td class="mono">${a.kills}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="elegend small muted">${Object.entries(ELEM_COLOR).map(([k, c]) => `<span><i style="background:${c}"></i>${ELEM_NAME[k as keyof typeof ELEM_NAME]}</span>`).join('')}</div>`;
}
/** 전투 중 선택한 아군: 체력 · 장비 (캠핑 러버 임시 장비 포함) · 개조부품 */
function battleUnitInfo(b: Battle, u: CUnit) {
  const items = (u.src?.items || []).filter((x): x is string => !!x);
  const mod = u.src?.mod;
  const temp = u.tempItems || [];
  const row = (id: string, tag = '') => `<li>${itemIcon(id)} <span><b>${esc(itemInfo(id).name)}</b>${tag}<br><span class="muted small">${esc(itemInfo(id).desc)}</span></span></li>`;
  return `<h3>${sprite(u)} ${esc(u.name)} <span class="muted small">체력 ${fmt(Math.max(0, u.hp))}/${fmt(b.S(u, 'maxHp'))}${u.shield > 0 ? ` · 보호막 ${fmt(u.shield)}` : ''}</span></h3>
    <ul class="bitems">${items.map((x) => row(x)).join('')}${mod ? row(mod) : ''}${temp.map((x) => row(x, ' <span class="tag">임시 · 캠핑</span>')).join('')}${!items.length && !mod && !temp.length ? '<li class="muted small">장비 없음</li>' : ''}</ul>
    ${u.statuses.filter((s) => s.label).length ? `<div class="small muted">상태: ${u.statuses.filter((s) => s.label).map((s) => esc(s.label!)).join(' · ')}</div>` : ''}`;
}

// ───────────────────────── 도감
function codexScreen() {
  const m = loadMeta();
  const tabs = ([['units', '기물'], ['enemies', '적'], ['events', '사건'], ['records', '기록']] as const)
    .map(([k, l]) => `<button class="btn small ${app.codexTab === k ? 'primary' : ''}" data-a="codex-tab" data-v="${k}">${l}</button>`).join('');
  let body = '';
  if (app.codexTab === 'units') {
    body = `<div class="codex-grid">${UNITS.map((d) => {
      const r = m.units[d.id];
      const known = !d.eventOnly || !!r;
      return `<div class="codex-card ${known ? '' : 'unknown'}">
        ${known ? hero(d.id, 'hero sm') : ''}<div class="ucard-head">${sprite(d, 'spr big')}<div><b>${known ? esc(d.name) : '???'}</b><div class="muted small">${known ? esc(d.title) : '사건으로만 만날 수 있는 기물'}</div></div></div>
        ${known ? `<div class="chips">${[...d.factions, ...d.traits].map(chip).join('')}</div><p class="small">${esc(STORIES[d.id] || '')}</p>` : ''}
        <div class="codex-stats small">의뢰 <b>${r?.runs || 0}</b>회 · 누적 공명 등급 <b>${r?.ranks || 0}</b> · 최고 <b>${r?.best || 0}</b> · 성공 <b>${r?.clears || 0}</b></div>
      </div>`;
    }).join('')}</div>`;
  } else if (app.codexTab === 'enemies') {
    body = FIELDS.map((f) => {
      const ids = [...f.pool, f.elite, ...f.bosses];
      return `<h2 style="color:${f.color}">${f.icon} ${esc(f.name)}</h2><div class="codex-list">${ids.map((id) => {
        const e = ENEMY_BY_ID[id];
        const r = m.enemies[id];
        return `<div class="codex-row ${r ? '' : 'unknown'}">${sprite(e)}<div><b>${r ? esc(e.name) : '???'}</b> <span class="muted small">${e.tier === 'boss' ? '보스' : e.tier === 'elite' ? '정예' : '일반'}</span>
          <div class="small">${r ? esc(ENEMY_DESC[id] || '') : '아직 만나지 못했습니다.'}</div></div><div class="small mono">조우 ${r?.seen || 0}<br>처치 ${r?.kills || 0}</div></div>`;
      }).join('')}</div>`;
    }).join('') + (() => { const extra = ENEMIES.filter((e) => !FIELDS.some((f) => [...f.pool, f.elite, ...f.bosses].includes(e.id)) && m.enemies[e.id]); return extra.length ? `<h2>기타</h2><div class="codex-list">${extra.map((e) => `<div class="codex-row">${sprite(e)}<div><b>${esc(e.name)}</b></div><div class="small mono">처치 ${m.enemies[e.id].kills}</div></div>`).join('')}</div>` : ''; })();
  } else if (app.codexTab === 'events') {
    const story = (p: string) => EVENTS.filter((e) => e.id.startsWith(p));
    const groups: [string, typeof EVENTS][] = [['공용', EVENTS.filter((e) => !e.fields && !/^s[a-d]_/.test(e.id))], ...FIELDS.map((f) => [f.name, EVENTS.filter((e) => e.fields?.includes(f.id))] as [string, typeof EVENTS]),
      ['함선 생활 · 엘베스타드 일가', story('sa_')], ['세력 정치 · 의뢰', story('sb_')], ['우주 기담 · 사이오닉 · 신앙', story('sc_')], ['변경 생존 · 도박 · 인양', story('sd_')]];
    const seenN = EVENTS.filter((e) => m.events[e.id]).length;
    body = `<p class="muted small">겪은 사건 ${seenN} / ${EVENTS.length}종. 연계 사건은 앞선 사건의 선택에 따라 열립니다.</p>` + groups.filter(([, l]) => l.length).map(([g, list]) => `<h2>${esc(g)} <span class="muted small">${list.filter((e) => m.events[e.id]).length}/${list.length}</span></h2><div class="codex-list">${list.map((e) => {
      const n = m.events[e.id] || 0;
      return `<div class="codex-row ${n ? '' : 'unknown'} ${e.rare ? 'rare' : ''}"><div><b>${n ? esc(e.title) : '???'}</b>${e.rare ? ' <span class="tag">희귀</span>' : ''}<div class="small">${n ? esc(e.text) : '아직 겪지 못한 사건입니다.'}</div></div><div class="small mono">${n}회</div></div>`;
    }).join('')}</div>`).join('');
  } else {
    body = `<dl class="stats big"><dt>의뢰</dt><dd>${m.runs}</dd><dt>의뢰 성공</dt><dd>${m.clears}</dd><dt>최고 도달 페이즈</dt><dd>${m.bestPhase}</dd><dt>해금된 위험 등급</dt><dd>${m.maxDiff}</dd></dl>
      <h2>전장별</h2><div class="codex-list">${FIELDS.map((f) => { const r = m.fields[f.id]; return `<div class="codex-row"><div><b style="color:${f.color}">${f.icon} ${esc(f.name)}</b><div class="small muted">${esc(f.region)}</div></div><div class="small mono">의뢰 ${r?.runs || 0} · 성공 ${r?.clears || 0}${r && r.bestDiff >= 0 ? ` · 최고 위험 ${r.bestDiff}` : ''}</div></div>`; }).join('')}</div>`;
  }
  return `<main class="wrap codex"><div class="screen-head"><h1>도감 · 기록</h1><p class="muted small">이 브라우저에 저장됩니다.</p></div>
    <div class="row-btns">${tabs}<button class="btn ghost" data-a="codex-back">돌아가기</button></div>${body}</main>`;
}

// ───────────────────────── 액션
function act(a: string, v: string) {
  const run = app.run;
  // 전투 중에는 속도 조절 / 결과 보기 / 계속만 받는다 (재렌더하면 전투 화면이 초기화됨)
  if (app.screen === 'battle' && !['speed', 'skip', 'after-battle', 'meter-tab', 'bsel'].includes(a)) return;
  switch (a) {
    case 'newrun':
      app.starters = []; app.screen = 'newrun'; app.menu = null; carX = null; app.cardOpen = null;
      app.pool = new Rng((Date.now() ^ (Math.random() * 1e9)) | 0).sample(UNITS.filter((u) => !u.noStarter).map((u) => u.id), 8);
      break;
    case 'car-prev': case 'car-next': carStep(a === 'car-next' ? 1 : -1); return;
    case 'syn-peek': return; // 시너지 아이콘 탭: 이름만 보여준다 (클릭 핸들러에서 처리)
    case 'card-tap': return act('pick-starter', v); // 카드를 누르면 선택 · 해제
    case 'card-open': app.cardOpen = app.cardOpen === v ? null : v; syncCardOpen(); return; // 터치: 설명 펼치기 · 접기
    case 'toggle-detail': app.detail = !app.detail; savePref('detail', app.detail); break;
    case 'toggle-sub': if (app.subOpen.has(v)) app.subOpen.delete(v); else app.subOpen.add(v); break;
    case 'to-title': if (app.view) { app.view.destroy(); app.view = null; } app.screen = 'title'; app.menu = null; app.run = null; break;
    case 'pick-starter': {
      const i = app.starters.indexOf(v);
      if (i >= 0) app.starters.splice(i, 1);
      else if (app.starters.length < CFG.startUnits) app.starters.push(v);
      else toast(`${CFG.startUnits}명까지 고를 수 있습니다.`);
      break;
    }
    case 'random-starters': app.starters = new Rng(Date.now() | 0).sample(app.pool, CFG.startUnits); break;
    case 'start-run':
      if (app.starters.length !== CFG.startUnits) return;
      app.run = R.newRun((Date.now() ^ (Math.random() * 1e9)) | 0, app.starters, undefined, Math.min(app.diff, loadMeta().maxDiff));
      app.screen = 'map'; app.sel = null; persist(); break;
    case 'load': {
      const r = loadRun(v);
      if (!r) { toast('저장 데이터를 읽을 수 없습니다.'); return; }
      if (app.view) { app.view.destroy(); app.view = null; }
      app.run = r; app.menu = null; app.summary = null; app.sel = null;
      goPrepOrMap();
      toast(`${SLOT_NAME[v]} 불러옴`);
      break;
    }
    case 'save': if (run) { toast(saveRun(run, v) ? `${SLOT_NAME[v]}에 저장했습니다.` : '이 브라우저에서는 저장소를 쓸 수 없습니다. 저장 코드를 이용하세요.'); } break;
    case 'menu': app.menu = 'menu'; break;
    case 'menu-close': app.menu = null; app.importErr = ''; break;
    case 'menu-export': app.menu = 'export'; break;
    case 'menu-import': app.menu = 'import'; app.importErr = ''; break;
    case 'copy-code': {
      const ta = document.getElementById('export-code') as HTMLTextAreaElement;
      const done = () => toast('복사했습니다.');
      try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast('코드를 선택했습니다. 직접 복사하세요.'); }); } catch { ta.select(); }
      return;
    }
    case 'import-go': {
      const code = (document.getElementById('import-code') as HTMLTextAreaElement).value;
      const r = importCode(code);
      if (!r) { app.importErr = '올바른 저장 코드가 아닙니다. ERR1: 로 시작하는 코드 전체를 붙여 넣으세요.'; break; }
      if (app.view) { app.view.destroy(); app.view = null; }
      app.run = r; app.menu = null; app.summary = null; app.sel = null; persist();
      goPrepOrMap();
      toast('불러왔습니다.');
      break;
    }
    case 'enter': {
      if (!run || run.pending.length) return;
      R.enterNode(run, v as NodeType);
      app.sel = null;
      goPrepOrMap();
      persist();
      break;
    }
    case 'resume': goPrepOrMap(); break;
    case 'autofill': {
      if (!run) return;
      const n = R.autoFill(run);
      toast(n ? `${n}명을 배치했습니다.` : '배치할 수 있는 대기 기물이 없습니다.');
      if (n) persist();
      break;
    }
    case 'manage': app.screen = 'prep'; app.sel = v ? { k: 'unit', uid: v } : null; break;
    case 'to-map': app.screen = run?.node?.type === 'shop' ? 'shop' : run?.node?.type === 'news' ? 'news' : run?.node?.type === 'invest' ? 'invest' : 'map'; break;
    case 'fight':
      if (!run || !deployed(run).length) return;
      persist();
      app.summary = null;
      app.screen = 'battle';
      app.needMount = true; // render() 가 보드를 그린 뒤 전투 뷰를 붙인다
      break;
    case 'speed': app.speed = +v; savePref('speed', app.speed); if (app.view?.b) app.view.speed = app.speed; document.querySelectorAll('.speed .btn').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.v === v)); return;
    case 'skip': app.view?.skip?.(); return;
    case 'after-battle': app.summary = null; if (app.view) { app.view.destroy(); app.view = null; } goPrepOrMap(); break;
    case 'sel-unit': app.sel = app.sel?.k === 'item' && run ? equipSel(run, app.sel.idx, v) : { k: 'unit', uid: v }; break;
    case 'sel-enemy': app.sel = { k: 'enemy', i: +v }; break;
    case 'sel-item': {
      if (!run) return;
      if (app.sel?.k === 'item' && app.sel.idx !== +v) {
        const res = R.combineInv(run, app.sel.idx, +v);
        if (res) { toast(`조합 완료: ${itemInfo(res).name}`); app.sel = null; persist(); break; }
      }
      app.sel = app.sel?.k === 'item' && app.sel.idx === +v ? null : { k: 'item', idx: +v };
      break;
    }
    case 'sell': if (run) { R.sellItem(run, +v); app.sel = null; persist(); } break;
    case 'unequip': if (run) { const [uid, s] = v.split(':'); const e = R.unequip(run, uid, +s); if (e) toast(e); persist(); } break;
    case 'buyxp': if (run) { if (!R.buyXp(run, v)) toast('크레딧이 부족합니다.'); persist(); } break;
    case 'buy': if (run) { const e = R.buyShop(run, +v); if (e) toast(e); persist(); } break;
    case 'pick-blessing': if (run && run.pending[0]?.t === 'blessing') { R.pickBlessing(run, v); run.pending.shift(); persist(); } break;
    case 'buy-news': if (run) { const e = R.buyNews(run, +v); if (e) toast(e); persist(); } break;
    case 'buy-invest': if (run) { const e = R.buyInvest(run, +v); if (e) toast(e); persist(); } break;
    case 'ace-target': if (run) { run.aceTarget = v; toast('에이스 파일럿으로 지정했습니다.'); persist(); } break;
    case 'pilgrim': if (run) { const e = R.pilgrimAct(run, v as 'cap' | 'bless' | 'credits' | 'xp'); if (e) toast(e); persist(); } break;
    case 'pilgrim-done': if (run?.pending.some((x) => x.t === 'pilgrim')) { run.pending = run.pending.filter((x) => x.t !== 'pilgrim'); persist(); } break;
    case 'leave-shop': if (run) { R.leaveShop(run); app.screen = 'map'; persist(); } break;
    case 'loan': if (run) { toast(R.takeLoan(run) ? '대출 실행: 크레딧 +25' : '대출할 수 없습니다.'); persist(); } break;
    // 대기 선택
    case 'pick-global': if (run) { R.pickGlobal(run, v); run.pending.shift(); persist(); } break;
    case 'field-ok': run?.pending.shift(); persist(); break;
    case 'event-choice': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'event') return;
      const err = R.chooseEvent(run, +v);
      if (err) { toast(err); return; }
      metaEvent(p.id);
      persist();
      break;
    }
    case 'victory-end': if (run) { run.pending.shift(); metaClear(run); run.over = true; goPrepOrMap(); } break;
    case 'victory-endless': if (run) { run.pending.shift(); metaClear(run); run.endless = true; toast('무한 모드: 적은 계속 강해집니다.'); persist(); } break;
    case 'diff': app.diff = +v; break;
    case 'codex': app.screen = 'codex'; app.menu = null; break;
    case 'codex-tab': app.codexTab = v as typeof app.codexTab; break;
    case 'codex-back': app.screen = app.run ? (app.run.over ? 'over' : 'map') : 'title'; if (app.run && !app.run.over) goPrepOrMap(); break;
    case 'meter-tab': app.meterTab = v as typeof app.meterTab; document.querySelectorAll('.meter-tabs .btn').forEach((e) => e.classList.toggle('on', (e as HTMLElement).dataset.v === v)); updateMeter(true); return;
    case 'bsel': app.battleSel = +v; updateMeter(true); return;
    case 'release': app.releaseConfirm = v; break;
    case 'release-cancel': app.releaseConfirm = null; break;
    case 'release-confirm': {
      if (!run) return;
      const err = R.releaseUnit(run, v);
      app.releaseConfirm = null;
      if (err) { toast(err); return; }
      app.sel = null;
      toast('기물을 방출했습니다.');
      persist();
      break;
    }
    case 'pick-privilege': if (run) { R.pickPrivilege(run, +v); persist(); } break;
    case 'reroll-privilege': if (run) { R.rerollPrivilege(run); persist(); } break;
    case 'alloc-pick': {
      const m = v as Major;
      if (app.picks.includes(m)) app.picks = app.picks.filter((x) => x !== m);
      else if (app.picks.length < CFG.rankPicks) app.picks.push(m);
      break;
    }
    case 'alloc-ok': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'rankup') return;
      if (!R.applyRankPicks(run, p.uid, app.picks, p.points)) return;
      app.picks = [];
      p.allocDone = true;
      if (p.options && !p.options.length) run.pending.shift(); // 이번 등급은 능력치만
      persist();
      break;
    }
    case 'reroll': { const p = run?.pending[0]; if (run && p?.t === 'rankup' && p.rerolls > 0) { p.rerolls--; p.options = null; app.augPick = null; } break; }
    case 'pick-augsel': app.augPick = +v; break;
    case 'pick-aug': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'rankup' || !p.options || v === '' || !p.options[+v]) return;
      R.chooseAug(run, p.uid, p.options[+v]);
      app.augPick = null;
      run.pending.shift(); persist(); break;
    }
    case 'skip-aug': app.augPick = null; run?.pending.shift(); persist(); break;
    case 'pick-item': { const p = run?.pending[0]; if (run && p?.t === 'itemPick') { R.gainItem(run, p.options[+v]); run.pending.shift(); persist(); } break; }
    case 'rc-tap': app.recruitPick = app.recruitPick === v ? null : v; break;
    case 'pick-recruit': if (run && v && run.pending[0]?.t === 'recruit') { R.recruit(run, v); run.pending.shift(); app.recruitPick = null; app.cardOpen = null; persist(); } break;
    case 'pick-supply': if (run && run.pending[0]?.t === 'supply') { run.pending.shift(); R.takeSupply(run, v); persist(); } break;
    case 'notice-ok': run?.pending.shift(); persist(); break;
    default: return;
  }
  render();
}

function equipSel(run: RunState, idx: number, uid: string): Sel {
  const e = R.equip(run, idx, uid);
  if (e) toast(e); else { toast('장착했습니다.'); persist(); }
  return { k: 'unit', uid };
}

// ───────────────────────── 드래그 앤 드롭 (마우스 + 터치 공용)
let drag: { src: string; x: number; y: number; ghost: HTMLElement | null; el: HTMLElement } | null = null;
let suppressClick = false;

root.addEventListener('pointerdown', (ev) => {
  const el = (ev.target as HTMLElement).closest('[data-drag]') as HTMLElement | null;
  if (!el || ev.button > 0) return;
  drag = { src: el.dataset.drag!, x: ev.clientX, y: ev.clientY, ghost: null, el };
});
window.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (!drag.ghost) {
    if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
    const g = document.createElement('div');
    g.className = 'drag-ghost';
    const img = drag.el.querySelector('img');
    g.innerHTML = img ? `<img alt="" src="${img.src}">` : drag.el.textContent || '';
    document.body.appendChild(g);
    drag.ghost = g;
    drag.el.classList.add('dragging');
  }
  drag.ghost.style.left = `${ev.clientX}px`;
  drag.ghost.style.top = `${ev.clientY}px`;
  ev.preventDefault();
}, { passive: false });
window.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.ghost) return;
  d.ghost.remove();
  d.el.classList.remove('dragging');
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 50);
  const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
  const tgt = under?.closest('[data-drop]') as HTMLElement | null;
  if (tgt) onDrop(d.src, tgt.dataset.drop!);
});
window.addEventListener('pointercancel', () => { if (drag?.ghost) { drag.ghost.remove(); drag.el.classList.remove('dragging'); } drag = null; });

function onDrop(src: string, dst: string) {
  const run = app.run;
  if (!run) return;
  const [sk, ...sv] = src.split(':');
  const [dk, ...dv] = dst.split(':');
  const n = run.node?.enc?.n || CFG.bossBoard;
  if (sk === 'unit') {
    const u = run.units.find((x) => x.uid === sv[0]);
    if (!u) return;
    const lay = layout(run, n);
    const toPos = (x: number, y: number) => ({ c: x, r: n - 1 - y });
    // 탐험가는 정해진 페이즈 전에는 보드에 올릴 수 없다
    const other0 = dk === 'unit' ? run.units.find((x) => x.uid === dv[0]) : null;
    const blocked = (dk === 'cell' && !R.canDeploy(run, u)) || (dk === 'unit' && other0 && ((other0.pos && !R.canDeploy(run, u)) || (u.pos && !R.canDeploy(run, other0))));
    if (blocked) { toast(`아문센은 ${CFG.explorerPhase}페이즈부터 배치할 수 있습니다.`); render(); return; }
    if (dk === 'cell') {
      const x = +dv[0], y = +dv[1];
      const other = deployed(run).find((o) => { const p = lay.get(o.uid); return p && p.x === x && p.y === y; });
      if (other === u) return;
      if (other) {
        const mine = lay.get(u.uid);
        other.pos = mine ? toPos(mine.x, mine.y) : null;
      } else if (!u.pos && deployed(run).length >= R.deployCap(run)) { toast(`출전 인원이 가득 찼습니다 (${R.deployCap(run)}명).`); render(); return; }
      u.pos = toPos(x, y);
    } else if (dk === 'bench') {
      u.pos = null;
    } else if (dk === 'unit') {
      const o = run.units.find((x) => x.uid === dv[0]);
      if (!o || o === u) return;
      const pu = lay.get(u.uid), po = lay.get(o.uid);
      u.pos = po ? toPos(po.x, po.y) : null;
      o.pos = pu ? toPos(pu.x, pu.y) : null;
    }
    app.sel = { k: 'unit', uid: u.uid };
  } else if (sk === 'item') {
    const idx = +sv[0];
    if (dk === 'unit') app.sel = equipSel(run, idx, dv[0]);
    else if (dk === 'invitem') {
      const res = R.combineInv(run, idx, +dv[0]);
      if (res) toast(`조합 완료: ${itemInfo(res).name}`); else if (idx !== +dv[0]) toast('조합할 수 없는 장비입니다.');
      app.sel = null;
    }
  } else if (sk === 'eq') {
    const [uid, slot] = sv;
    if (dk === 'inv' || dk === 'invitem') { const e = R.unequip(run, uid, +slot); if (e) toast(e); }
    else if (dk === 'unit' && dv[0] !== uid) {
      const e = R.unequip(run, uid, +slot);
      if (e) toast(e); else app.sel = equipSel(run, run.inventory.length - 1, dv[0]);
    }
  }
  persist();
  render();
}

// ───────────────────────── 단축키
const CONFIRM_ACTS = ['alloc-ok', 'pick-aug', 'after-battle', 'field-ok', 'notice-ok', 'skip-aug', 'menu-close', 'pick-recruit'];
function clickFirst(sel: string) {
  const el = Array.from(document.querySelectorAll<HTMLButtonElement>(sel)).find((b) => !b.disabled);
  if (!el) return false;
  el.click();
  return true;
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if ((e.target as HTMLElement).closest('input, textarea, select')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const sv = document.querySelector('.stand-view');
  if (k === 'Escape') {
    if (sv) sv.remove();
    else if (app.cardOpen) { app.cardOpen = null; render(); }
    else if (app.menu) act('menu-close', '');
    else if (app.releaseConfirm) act('release-cancel', '');
    else if (app.sel && app.screen !== 'battle') { app.sel = null; render(); }
    return;
  }
  if (sv) return;
  if (k === 'd') { act('toggle-detail', ''); return; }
  if (app.screen === 'newrun' && (k === 'ArrowLeft' || k === 'ArrowRight')) { carStep(k === 'ArrowRight' ? 1 : -1); e.preventDefault(); return; }
  const modal = document.querySelector('.modal-bg .modal');
  const digit = /^[1-9]$/.test(k) ? +k : 0;
  if (modal && app.screen !== 'battle') {
    if (digit) {
      const opts = Array.from(modal.querySelectorAll<HTMLButtonElement>('[data-a^="pick-"]:not(.aug-ok), [data-a="event-choice"], [data-a="alloc-pick"]'));
      const b = opts[digit - 1];
      if (b && !b.disabled) { b.click(); e.preventDefault(); }
    } else if (k === 'r') clickFirst('.modal [data-a="reroll"], .modal [data-a="reroll-privilege"]');
    else if (k === 'Enter' || k === ' ') { if (clickFirst(CONFIRM_ACTS.map((a) => `.modal [data-a="${a}"]`).join(', '))) e.preventDefault(); }
    return;
  }
  if (app.screen === 'battle') {
    if (digit >= 1 && digit <= SPEEDS.length) act('speed', String(SPEEDS[digit - 1]));
    else if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!clickFirst('[data-a="after-battle"]')) act('skip', ''); }
    return;
  }
  if (app.screen === 'prep') {
    if (k === ' ' || k === 'Enter') { if (clickFirst('[data-a="fight"]')) e.preventDefault(); }
    else if (k === 'a') act('autofill', '');
    return;
  }
  if (app.screen === 'map') {
    if (digit) clickFirst(`.node-choices .node-btn:nth-child(${digit})`);
    else if (k === 'm') act('manage', '');
  }
});

// 스탠딩 전신 보기 (카드 버튼 안의 배너는 카드 선택이 우선)
document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const open = document.querySelector('.stand-view');
  if (open) { open.remove(); return; }
  const h = t.closest('[data-stand]') as HTMLElement | null;
  if (!h || h.closest('[data-a]')) return;
  const d = UNIT_BY_ID[h.dataset.stand!];
  const v = document.createElement('div');
  v.className = 'stand-view';
  v.innerHTML = `${standImg(d.id, 'stand full')}<div class="stand-cap"><b>${esc(d.name)}</b> <span class="muted">${esc(d.title)}</span></div>`;
  document.body.appendChild(v);
});

root.addEventListener('click', (ev) => {
  if (suppressClick) return;
  const el = (ev.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return;
  if (el.dataset.a === 'syn-peek') {
    const on = !el.classList.contains('peek');
    root.querySelectorAll('.syn-b.peek').forEach((x) => x.classList.remove('peek'));
    if (on) { el.classList.add('peek'); setTimeout(() => el.classList.remove('peek'), 1800); }
    return;
  }
  act(el.dataset.a!, el.dataset.v || '');
});

// 순례: 신앙 변경
root.addEventListener('change', (ev) => {
  const el = ev.target as HTMLSelectElement;
  const uid = el.dataset?.faith;
  if (!uid || !app.run) return;
  const e = R.pilgrimAct(app.run, 'faith', uid, el.value as FaithId);
  if (e) toast(e); else toast(`신앙 변경: ${FAITH_NAME[el.value as FaithId]}`);
  persist(); render();
});

// 아티팩트 뷰어 업데이트 시 진행 상황 유지
type Hot = { snapshot?: (f: () => unknown) => void; ready?: (f: (d: unknown) => void) => void; data?: unknown };
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ run: app.run }));
function boot(data: unknown) {
  const r = (data as { run?: RunState } | null)?.run;
  if (r) { app.run = r; goPrepOrMap(); }
  render();
}
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? null);
void activeTiers;
