import { CFG, phaseHpMult } from './config';
import { AUG_BY_ID, augDesc, augSource } from './data/augments';
import { ENEMY_BY_ID } from './data/enemies';
import { BLESSING_BY_ID, GLOBAL_BY_ID } from './data/globals';
import { combine, itemInfo } from './data/items';
import { rankTitle, staffTargetUid, SYN_BY_ID, SYNERGIES, TITLE_NAME, tierOf } from './data/synergies';
import { UNIT_BY_ID, UNITS, type UnitDef } from './data/units';
import {
  activeTiers, buildAlly, buildBattle, buildEnemy, deployed, layout, memberships, playerRows, synergyCounts, totalMajors, unitEffects,
} from './engine/build';
import { Battle, type CUnit } from './engine/combat';
import * as R from './engine/run';
import { Rng } from './rng';
import { ELEM_NAME, KEYWORD_NAME, MAJOR_NAME, MAJORS, NODE_NAME, type Major, type NodeType, type RunState, type UnitState } from './types';
import { BattleView, fmt } from './ui/battleview';
import { exportCode, importCode, listSaves, loadRun, saveRun, SLOT_NAME } from './ui/save';
import { spriteURL } from './ui/sprites';

type Screen = 'title' | 'newrun' | 'map' | 'prep' | 'battle' | 'shop' | 'news' | 'over';
type Sel = { k: 'unit'; uid: string } | { k: 'item'; idx: number } | { k: 'enemy'; i: number } | { k: 'def'; id: string } | null;

const app = {
  screen: 'title' as Screen,
  run: null as RunState | null,
  sel: null as Sel,
  starters: [] as string[],
  menu: null as null | 'menu' | 'export' | 'import',
  view: null as BattleView | null,
  summary: null as R.BattleSummary | null,
  alloc: { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 } as Record<Major, number>,
  speed: 1,
  toast: '',
  toastT: 0 as ReturnType<typeof setTimeout> | 0,
  importErr: '',
  needMount: false,
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
const NODE_ICON: Record<NodeType, string> = { battle: '⚔', adversity: '☠', shop: '¤', supply: '▣', recruit: '✚', boss: '♜', pilgrim: '✟', news: '✪' };

function chip(id: string) {
  const s = SYN_BY_ID[id as keyof typeof SYN_BY_ID];
  return `<span class="chip" style="--c:${s.color}">${s.icon} ${esc(s.name)}</span>`;
}
function sprite(defOrUnit: { sprite: string; palette: string[] }, cls = 'spr') {
  return `<img class="${cls}" alt="" src="${spriteURL(defOrUnit.sprite, defOrUnit.palette)}">`;
}
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
  return `<span class="item t${it.tier}" title="${esc(it.name + ' — ' + it.desc)}" ${attrs}>${it.icon}</span>`;
}

function topbar() {
  const r = app.run;
  if (!r) return '';
  const cap = R.deployCap(r);
  return `<header class="top">
    <div class="brand">ERRANTEs</div>
    <div class="stat-row">
      <span class="pill">페이즈 <b>${r.phase}</b> · 노드 ${Math.min(r.step + 1, r.map.length)}/${r.map.length}</span>
      <span class="pill hp">체력 <b>${r.hp}</b>/${r.maxHp}</span>
      <span class="pill cr">크레딧 <b>${r.credits}</b>${r.loan ? ` <small>(대출 ${r.loan})</small>` : ''}</span>
      ${r.streak >= 2 ? `<span class="pill">🔥 ${r.streak}연승</span>` : ''}
      ${r.faith ? `<span class="pill faith">신앙 <b>${r.faith}</b></span>` : ''}
      ${r.fame ? `<span class="pill fame">명성 <b>${r.fame}</b></span>` : ''}
      ${r.blessing ? `<span class="pill faith" title="${esc(BLESSING_BY_ID[r.blessing].desc)}">축복: ${esc(BLESSING_BY_ID[r.blessing].name)}</span>` : ''}
      <span class="pill">출전 ${deployed(r).length}/${cap}</span>
    </div>
    ${app.screen === 'battle' ? '' : '<button class="btn ghost" data-a="menu">메뉴</button>'}
  </header>`;
}

function synergyPanel(run: RunState) {
  const counts = synergyCounts(deployed(run));
  const list = SYNERGIES.filter((s) => counts[s.id]).sort((a, b) => tierOf(b.id, counts[b.id]!) - tierOf(a.id, counts[a.id]!) || counts[b.id]! - counts[a.id]!);
  if (!list.length) return `<div class="muted small">출전한 기물이 없습니다.</div>`;
  return list.map((s) => {
    const c = counts[s.id]!;
    const t = tierOf(s.id, c);
    const steps = s.tiers.map((need, i) => `<span class="${c >= need ? 'on' : ''}${i === t - 1 ? ' cur' : ''}">${need}</span>`).join('');
    return `<details class="syn ${t ? 'active' : ''}" style="--c:${s.color}">
      <summary><span class="syn-ic">${s.icon}</span><span class="syn-name">${esc(s.name)}</span><span class="syn-steps">${steps}</span></summary>
      <p>${esc(s.desc)}</p>
      <ol>${s.tierDesc.map((d, i) => `<li class="${i === t - 1 ? 'cur' : ''}">(${s.tiers[i]}) ${esc(d)}</li>`).join('')}</ol>
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
      <button class="btn" data-a="menu-import">저장 코드 불러오기</button>
    </div>
    ${saves.filter((s) => s.slot !== 'auto').length ? `<div class="slots">${saves.filter((s) => s.slot !== 'auto').map((s) =>
      `<button class="btn ghost" data-a="load" data-v="${s.slot}">${SLOT_NAME[s.slot]} · 페이즈 ${s.phase} · 기물 ${s.units}</button>`).join('')}</div>` : ''}
    <p class="muted small fine">싱글 PvE · 오프라인 플레이 · 진행은 이 브라우저에 자동 저장됩니다.</p>
  </main>`;
}

// ───────────────────────── 화면: 시작 기물 선택
function unitCard(d: UnitDef, opts: { selected?: boolean; action?: string; rank?: number } = {}) {
  return `<button class="ucard ${opts.selected ? 'sel' : ''}" data-a="${opts.action || 'pick-starter'}" data-v="${d.id}">
    <div class="ucard-head">${sprite(d, 'spr big')}<div><b>${esc(d.name)}</b><div class="muted small">${esc(d.title)}</div></div></div>
    <div class="chips">${chip(d.faction)}${d.traits.map(chip).join('')}</div>
    <div class="small">${d.atk.type === 'shoot' ? '사격' : '타격'} · 사거리 ${d.range} · ${ELEM_NAME[d.atk.elem]} · ${d.keywords.map((k) => KEYWORD_NAME[k]).join('/')}</div>
    <div class="skill-line"><b>${esc(d.skill.name)}</b> <span class="muted">(${d.skill.cd}초)</span><br>${esc(d.skill.desc(d.skill.params))}</div>
    <div class="majors-mini">${MAJORS.map((m) => `<span>${MAJOR_NAME[m].slice(0, 2)} <b>${d.base[m]}</b></span>`).join('')}</div>
    ${opts.rank ? `<div class="small accent">공명 등급 ${opts.rank}로 합류</div>` : ''}
  </button>`;
}
function newRunScreen() {
  const n = app.starters.length;
  return `<main class="wrap">
    <div class="screen-head"><h1>계약 기물 선택</h1><p class="muted">첫 출격에 데려갈 기물 ${CFG.startUnits}명을 고르세요. 나머지는 페이즈 중간 영입 노드에서 만날 수 있습니다.</p></div>
    <div class="ucard-grid">${UNITS.map((d) => unitCard(d, { selected: app.starters.includes(d.id) })).join('')}</div>
    <div class="sticky-actions">
      <button class="btn ghost" data-a="to-title">뒤로</button>
      <button class="btn ghost" data-a="random-starters">무작위</button>
      <button class="btn primary" data-a="start-run" ${n === CFG.startUnits ? '' : 'disabled'}>출격 (${n}/${CFG.startUnits})</button>
    </div>
  </main>`;
}

// ───────────────────────── 화면: 맵
function mapScreen(run: RunState) {
  const p = run.phase;
  const scale = `적 체력 ×${fmt(phaseHpMult(p))} (이번 페이즈 ×${p > 1 ? CFG.phaseHpFactor(p).toFixed(1) : '1'}) · 방어도 ×${Math.pow(CFG.phaseArmor, p - 1).toFixed(2)} · 피해 ×${Math.pow(CFG.phaseAmp, p - 1).toFixed(2)}`;
  const track = run.map.map((opts, i) => {
    const state = i < run.step ? 'done' : i === run.step ? 'cur' : 'next';
    const picked = run.picked[i];
    const label = i < run.step && picked ? `${NODE_ICON[picked]} ${NODE_NAME[picked]}` : opts.map((o) => `${NODE_ICON[o]} ${NODE_NAME[o]}`).join(' / ');
    return `<li class="${state}">${label}</li>`;
  }).join('');
  const opts = R.currentOptions(run);
  const choices = run.node ? `<button class="node-btn n-${run.node.type}" data-a="resume"><span class="node-ic">${NODE_ICON[run.node.type]}</span><b>${NODE_NAME[run.node.type]} 진행 중</b><span class="small muted">돌아가서 계속하기</span></button>` : opts.map((o) => `<button class="node-btn n-${o}" data-a="enter" data-v="${o}">
      <span class="node-ic">${NODE_ICON[o]}</span><b>${NODE_NAME[o]}</b><span class="small muted">${nodeHint(o)}</span></button>`).join('');
  const pet = tierOf('PET', synergyCounts(deployed(run)).PET || 0);
  return `<main class="wrap map">
    <section class="map-main">
      <div class="screen-head"><h1>페이즈 ${p}</h1><p class="muted small">${scale}</p></div>
      <ol class="track">${track}</ol>
      <h2>다음 노드</h2>
      <div class="node-choices">${choices}</div>
      <div class="row-btns">
        <button class="btn" data-a="manage">편성 · 장비 관리</button>
        ${pet >= 2 ? `<button class="btn" data-a="loan" ${run.loan ? 'disabled' : ''}>페트라 대출 (+25, 상환 30)</button>` : ''}
      </div>
    </section>
    <aside class="side">
      <h2>파티 <span class="muted small">${run.units.length}/${CFG.maxParty}</span></h2>
      <div class="roster">${run.units.map((u) => rosterRow(u)).join('')}</div>
      <h2>시너지</h2>
      <div class="syn-list">${synergyPanel(run)}</div>
      ${run.quests.length ? `<h2>헬레니우스 퀘스트</h2><ul class="quests">${run.quests.map((q) =>
        `<li class="${q.done ? 'done' : ''}">${esc(R.questText(q))} <span class="muted">${Math.min(q.progress, q.target)}/${q.target} · 보상 ${R.questRewardText(q)}</span></li>`).join('')}</ul>` : ''}
      ${run.globals.length ? `<h2>전역 증강</h2><ul class="globals">${run.globals.map((g) => `<li><b>${esc(GLOBAL_BY_ID[g].name)}</b> <span class="muted">${esc(GLOBAL_BY_ID[g].desc)}</span></li>`).join('')}</ul>` : ''}
      <h2>기록</h2>
      <ul class="log">${run.log.slice(0, 8).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </aside>
  </main>`;
}
function nodeHint(o: NodeType) {
  return ({
    battle: '공명도 · 크레딧 · 재료 확률', adversity: `적 ×${CFG.adversityMult} · 보상 1.5배 + 재료`, shop: '장비 재료 · 고급 장비 구매',
    supply: '보급품 3종 중 택1', recruit: '새 동료 3명 중 택1', boss: '승리 시 페이즈 클리어 + 고급 장비',
    pilgrim: '신앙 획득 + 이번 페이즈 축복 선택', news: '명성을 보상으로 교환',
  } as Record<NodeType, string>)[o];
}
function rosterRow(u: UnitState) {
  const d = UNIT_BY_ID[u.defId];
  return `<button class="roster-row ${u.pos ? '' : 'bench'}" data-a="manage" data-v="${u.uid}">
    ${sprite(d)}<span class="rr-main"><b>${esc(d.name)}</b>${xpBar(u)}</span>${rankPips(u.rank)}
    <span class="rr-items">${u.items.map((i) => itemIcon(i)).join('')}</span>
  </button>`;
}

// ───────────────────────── 화면: 편성 (전투 준비 / 관리)
function prepScreen(run: RunState) {
  const node = run.node;
  const isBattle = !!node?.enc;
  const n = node?.enc?.n || 6;
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
  const staffed = tierOf('STAFF', synergyCounts(deployed(run)).STAFF || 0) ? staffTargetUid(run) : null;
  for (const u of deployed(run)) {
    const p = lay.get(u.uid);
    if (!p) continue;
    const d = UNIT_BY_ID[u.defId];
    const sel = app.sel?.k === 'unit' && app.sel.uid === u.uid;
    units += `<div class="u side0 placed ${sel ? 'sel' : ''}" style="left:${(p.x / n) * 100}%;top:${(p.y / n) * 100}%;width:${100 / n}%;height:${100 / n}%"
      data-drag="unit:${u.uid}" data-drop="unit:${u.uid}" data-a="sel-unit" data-v="${u.uid}">
      ${sprite(d, '')}<span class="ubadge">R${u.rank}</span>${staffed === u.uid ? '<span class="ustaff">✎</span>' : ''}<span class="uitems">${u.items.filter(Boolean).map(() => '<i></i>').join('')}</span></div>`;
  }
  if (node?.enc) node.enc.enemies.forEach((s, i) => {
    const e = ENEMY_BY_ID[s.defId];
    const sel = app.sel?.k === 'enemy' && app.sel.i === i;
    units += `<div class="u side1 placed ${e.tier !== 'minion' ? 'big' : ''} ${sel ? 'sel' : ''}" style="left:${(Math.min(s.c, n - 1) / n) * 100}%;top:${(Math.min(s.row, n - 1) / n) * 100}%;width:${100 / n}%;height:${100 / n}%"
      data-a="sel-enemy" data-v="${i}">${sprite(e, '')}</div>`;
  });
  const bench = run.units.filter((u) => !u.pos);
  const env = node?.enc ? `${node.enc.env} ${n}×${n}${node.type === 'adversity' ? ' · 역경' : ''}${node.type === 'boss' ? ' · 보스전' : ''}` : '편성 관리';
  return `<main class="wrap prep">
    <aside class="side left">
      <h2>시너지</h2><div class="syn-list">${synergyPanel(run)}</div>
    </aside>
    <section class="board-col">
      <div class="board-head"><b>${esc(env)}</b><span class="muted small">출전 ${deployed(run).length}/${cap} · 아래 ${rows}줄에 배치</span></div>
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
        ${isBattle ? `<button class="btn ghost" data-a="to-map">맵으로</button><button class="btn primary" data-a="fight" ${deployed(run).length ? '' : 'disabled'}>전투 시작</button>`
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
  const counts = synergyCounts(deployed(run));
  const tmp = { ...u, pos: u.pos || { c: 0, r: 0 } };
  const c = u.pos ? buildAlly(b, run, tmp, counts) : buildAlly(b, null, tmp, {});
  return { b, c };
}

function staffLine(run: RunState, u: UnitState) {
  if (!u.pos || UNIT_BY_ID[u.defId].traits.includes('STAFF')) return '';
  if (!tierOf('STAFF', synergyCounts(deployed(run)).STAFF || 0)) return '';
  return staffTargetUid(run) === u.uid
    ? '<div class="small staff-on">✎ 참모단 지원 대상</div>'
    : `<button class="btn small" data-a="staff-target" data-v="${u.uid}">✎ 참모단 지원 대상으로 지정</button>`;
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
      ${e.skill ? `<div class="skill-line"><b>${esc(e.skill.name)}</b> <span class="muted">(${e.skill.cd}초)</span> ${esc(e.skill.desc({}))}</div>` : ''}
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
  const effects = unitEffects(run, u, synergyCounts(deployed(run)), !!u.pos);
  const tm = totalMajors(u, effects);
  const title = rankTitle(u.rank) + effects.reduce((s, e) => s + (e.title || 0), 0);
  const cost = R.xpCost(run);
  return `<div class="detail">
    <div class="d-head">${sprite(d, 'spr big')}<div><b>${esc(d.name)}</b><div class="muted small">${esc(d.title)}</div>${memberships(u).includes('KAL') ? `<div class="small accent">작위: ${TITLE_NAME[Math.min(6, title)]}</div>` : ''}</div>${rankPips(u.rank)}</div>
    <div class="chips">${memberships(u).map(chip).join('')}</div>
    ${staffLine(run, u)}
    ${xpBar(u)}
    <button class="btn small" data-a="buyxp" data-v="${u.uid}" ${u.rank >= CFG.maxRank || run.credits < cost ? 'disabled' : ''}>공명도 +${CFG.buyXpAmount + (R.hasGlobal(run, 'G.study') ? 1 : 0)} (크레딧 ${cost})</button>
    <h3>메이저 스탯</h3>
    <div class="majors">${MAJORS.map((m) => {
      const base = d.base[m], add = tm[m] - base;
      return `<div class="major"><span>${MAJOR_NAME[m]}</span><span class="mbar"><i style="width:${Math.min(100, tm[m] * 3)}%"></i></span><b>${tm[m]}</b>${add ? `<small class="${add > 0 ? 'up' : 'down'}">${add > 0 ? '+' : ''}${add}</small>` : ''}</div>`;
    }).join('')}</div>
    <h3>스킬 · ${esc(d.skill.name)} <span class="muted">${c.cdMax.toFixed(1)}초</span></h3>
    <p class="small">${esc(d.skill.desc(c.sk))}</p>
    <p class="small muted">기본 공격: ${d.atk.type === 'shoot' ? '사격' : '타격'} · ${ELEM_NAME[d.atk.elem]} · ${d.keywords.map((k) => KEYWORD_NAME[k]).join('/')}</p>
    <h3>증강 <span class="muted">${u.augments.length}</span></h3>
    ${u.augments.length ? `<ul class="augs">${u.augments.map((a) => { const ad = AUG_BY_ID[a.id]; return `<li><b>${esc(ad?.name || a.id)}</b> <span class="src">${ad ? augSource(ad) : ''}</span><br><span class="muted">${esc(augDesc(a.id, a.param))}</span></li>`; }).join('')}</ul>` : '<p class="muted small">공명 등급이 오르면 증강을 고릅니다.</p>'}
    <h3>장비</h3>
    <div class="eq">${u.items.map((it, i) => it ? `<div class="eq-slot" data-drag="eq:${u.uid}:${i}">${itemIcon(it)}<span><b>${esc(itemInfo(it).name)}</b><br><span class="muted small">${esc(itemInfo(it).desc)}</span></span>
      <button class="btn tiny" data-a="unequip" data-v="${u.uid}:${i}">해제</button></div>` : `<div class="eq-slot empty" data-drop="unit:${u.uid}">${itemIcon(null)}<span class="muted small">빈 슬롯</span></div>`).join('')}</div>
    <h3>전투 스탯 ${u.pos ? '' : '<span class="muted">(시너지 미적용)</span>'}</h3>
    ${statLines(c, b)}
    <p class="lore">${esc(d.lore)}</p>
  </div>`;
}

// ───────────────────────── 화면: 전투
function battleScreen(run: RunState) {
  const enc = run.node!.enc!;
  return `<main class="wrap battle">
    <section class="board-col">
      <div class="board-head"><b>${esc(enc.env)}</b><span id="btime" class="mono">0.0초</span>
        <span class="speed">${[1, 2, 4, 8].map((s) => `<button class="btn tiny ${app.speed === s ? 'on' : ''}" data-a="speed" data-v="${s}">${s}×</button>`).join('')}
        <button class="btn tiny" data-a="skip">결과로</button></span></div>
      <div class="board" id="bboard" style="--n:${enc.n}"><div class="cells">${'<div class="cell"></div>'.repeat(enc.n * enc.n)}</div></div>
    </section>
    <aside class="side right"><h2>피해량</h2><div id="meter" class="meter"></div></aside>
    ${app.summary ? summaryModal(run) : ''}
  </main>`;
}

function updateMeter() {
  const v = app.view;
  if (!v) return;
  const t = document.getElementById('btime');
  if (t) t.textContent = `${v.b.t.toFixed(1)}초${v.b.t > CFG.overtimeStart ? ' · 연장전' : ''}`;
  const m = document.getElementById('meter');
  if (!m) return;
  // 소환물 피해량은 주인에게 합산
  const dmgOf = (u: CUnit) => u.counters.dmg + v.b.units.filter((s) => s.owner === u).reduce((sum, s) => sum + s.counters.dmg, 0);
  const allies = v.b.units.filter((u) => u.side === 0 && !u.isSummon).sort((a, b) => dmgOf(b) - dmgOf(a));
  const max = Math.max(1, ...allies.map(dmgOf));
  m.innerHTML = allies.map((u) => `<div class="mrow ${u.alive ? '' : 'dead'}">${sprite(u)}<span class="mname">${esc(u.name)}</span>
    <span class="mbar"><i style="width:${(dmgOf(u) / max) * 100}%"></i></span><b class="mono">${fmt(dmgOf(u))}</b>
    ${u.counters.healed >= 1 ? `<small class="heal-t">+${fmt(u.counters.healed)}</small>` : ''}</div>`).join('');
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

function overScreen(run: RunState) {
  return `<main class="wrap over">
    <div class="screen-head"><h1>계약 종료</h1><p class="muted">ERRANTEs 는 페이즈 ${run.phase}에서 무너졌습니다.</p></div>
    <dl class="stats big">
      <dt>도달 페이즈</dt><dd>${run.phase}</dd><dt>전투</dt><dd>${run.stats.wins}승 ${run.stats.losses}패</dd>
      <dt>처치</dt><dd>${run.stats.kills}</dd><dt>최대 단일 피해</dt><dd>${fmt(run.stats.bestHit)}</dd>
    </dl>
    <div class="roster">${run.units.map(rosterRow).join('')}</div>
    <div class="sticky-actions"><button class="btn primary" data-a="newrun">새 계약</button><button class="btn" data-a="to-title">타이틀</button></div>
  </main>`;
}

// ───────────────────────── 모달: 대기 중인 선택
function pendingModal(run: RunState): string {
  const p = run.pending[0];
  if (!p || app.screen === 'battle' || app.screen === 'over') return '';
  let body = '';
  if (p.t === 'global') {
    body = `<h1>전역 증강</h1><p class="muted">런 전체에 적용되는 증강을 하나 고르세요.</p>
      <div class="cards">${p.options.map((id) => { const g = GLOBAL_BY_ID[id]; return `<button class="card" data-a="pick-global" data-v="${id}"><b>${esc(g.name)}</b><span>${esc(g.desc)}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'rankup') {
    const u = run.units.find((x) => x.uid === p.uid)!;
    const d = UNIT_BY_ID[u.defId];
    const head = `<div class="d-head">${sprite(d, 'spr big')}<div><b>${esc(d.name)}</b><div class="accent">공명 등급 ${p.rank - 1} → ${p.rank}</div></div></div>`;
    if (!p.allocDone) {
      const used = MAJORS.reduce((s, m) => s + app.alloc[m], 0);
      const left = p.points - used;
      const effects = unitEffects(run, u, synergyCounts(deployed(run)), !!u.pos);
      const tm = totalMajors(u, effects);
      const conv = (m: Major) => Object.entries(CFG.conv[m]).map(([k, v]) => `${STAT_SHORT[k] || k} +${(v as number) < 1 ? Math.round((v as number) * 100) + '%' : v}`).join(', ');
      body = `<h1>공명 등급 상승</h1>${head}
        <p class="muted">메이저 스탯 포인트 <b class="accent">${p.points}</b>를 배분하세요. 1포인트마다 아래 마이너 스탯이 함께 오릅니다.${p.rank > CFG.augmentMaxRank ? ' 공명 등급 10을 넘으면 증강 없이 스탯만 오릅니다.' : ''}</p>
        <div class="alloc">${MAJORS.map((m) => `<div class="alloc-row"><span class="a-name">${MAJOR_NAME[m]} <b>${tm[m]}</b>${app.alloc[m] ? `<b class="up"> +${app.alloc[m]}</b>` : ''}</span>
          <span class="small muted">${conv(m)}</span>
          <span class="a-btns"><button class="btn tiny" data-a="alloc-dec" data-v="${m}" ${app.alloc[m] ? '' : 'disabled'}>−</button><button class="btn tiny" data-a="alloc-inc" data-v="${m}" ${left ? '' : 'disabled'}>+</button></span></div>`).join('')}</div>
        <button class="btn primary" data-a="alloc-ok" ${left ? 'disabled' : ''}>${left ? `${left}포인트 남음` : '확정'}</button>`;
    } else {
      R.ensureRankupOptions(run, p);
      const forced = CFG.forcedUnitAugRanks.includes(p.rank);
      body = `<h1>증강 선택</h1>${head}${forced ? '<p class="accent small">공명 등급 3 · 6 · 9 — 전용 증강 확정</p>' : ''}
        <div class="cards">${(p.options || []).map((a, i) => {
          const ad = AUG_BY_ID[a.id];
          return `<button class="card aug-${ad.pool}" data-a="pick-aug" data-v="${i}"><span class="src">${augSource(ad)}</span><b>${esc(ad.name)}</b><span>${esc(augDesc(a.id, a.param))}</span></button>`;
        }).join('') || '<p class="muted">고를 수 있는 증강이 없습니다.</p>'}</div>
        <div class="row-btns">${p.rerolls > 0 ? `<button class="btn" data-a="reroll">새로고침 (${p.rerolls}회)</button>` : ''}${(p.options || []).length ? '' : '<button class="btn primary" data-a="skip-aug">넘어가기</button>'}</div>`;
    }
  } else if (p.t === 'itemPick') {
    body = `<h1>${esc(p.title)}</h1><div class="cards">${p.options.map((id, i) => { const it = itemInfo(id); return `<button class="card" data-a="pick-item" data-v="${i}">${itemIcon(id)}<b>${esc(it.name)}</b><span>${esc(it.desc)}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'recruit') {
    const rank = Math.min(CFG.maxRank, Math.max(1, run.phase - 1) + (R.hasGlobal(run, 'G.scout') ? 1 : 0));
    body = `<h1>기물 영입</h1><p class="muted">새 동료 한 명을 고르세요. 파티 ${run.units.length}/${CFG.maxParty}</p>
      <div class="ucard-grid">${p.options.map((id) => unitCard(UNIT_BY_ID[id], { action: 'pick-recruit', rank })).join('')}</div>`;
  } else if (p.t === 'supply') {
    body = `<h1>보급</h1><div class="cards">${p.options.map((o) => `<button class="card" data-a="pick-supply" data-v="${o}"><b>${esc(R.SUPPLY_TEXT[o])}</b></button>`).join('')}</div>`;
  } else if (p.t === 'blessing') {
    body = `<h1>순례 — 축복 선택</h1><p class="muted">신앙 ${run.faith}. 축복은 이번 페이즈가 끝날 때까지 유지됩니다.</p>
      <div class="cards">${p.options.map((id) => { const d = BLESSING_BY_ID[id]; return `<button class="card" data-a="pick-blessing" data-v="${id}"><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></button>`; }).join('')}</div>`;
  } else if (p.t === 'notice') {
    body = `<h1>${esc(p.title)}</h1><p>${esc(p.body)}</p><button class="btn primary" data-a="notice-ok">확인</button>`;
  }
  return `<div class="modal-bg"><div class="modal">${body}</div></div>`;
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
    <p class="muted small">진행 상황은 노드를 지날 때마다 자동 저장됩니다. 전투 도중 불러오면 전투 직전 편성 화면으로 돌아갑니다.</p>
  </div></div>`;
}

// ───────────────────────── 렌더
function render() {
  if (app.screen !== 'battle' && app.view) { app.view.destroy(); app.view = null; }
  const run = app.run;
  let body = '';
  if (app.screen === 'title' || !run) body = app.screen === 'newrun' ? newRunScreen() : titleScreen();
  else if (app.screen === 'newrun') body = newRunScreen();
  else if (app.screen === 'map') body = mapScreen(run);
  else if (app.screen === 'prep') body = prepScreen(run);
  else if (app.screen === 'battle') body = battleScreen(run);
  else if (app.screen === 'shop') body = shopScreen(run);
  else if (app.screen === 'news') body = newsScreen(run);
  else if (app.screen === 'over') body = overScreen(run);
  const showTop = run && app.screen !== 'title' && app.screen !== 'newrun';
  root.innerHTML = `${showTop ? topbar() : ''}${body}${run ? pendingModal(run) : ''}${menuModal(run)}<div id="toast" class="toast" ${app.toast ? '' : 'hidden'}>${esc(app.toast)}</div>`;
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

function mountBattleView(board: HTMLElement) {
  const run = app.run!;
  const b = buildBattle(run, run.node!.enc!);
  app.view = new BattleView(board, b, updateMeter, () => {
    app.summary = R.resolveBattle(run, b);
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
  if (run.over) app.screen = 'over';
  else if (run.node?.enc) app.screen = 'prep';
  else if (run.node?.type === 'shop') app.screen = 'shop';
  else if (run.node?.type === 'news') app.screen = 'news';
  else app.screen = 'map';
}

// ───────────────────────── 액션
function act(a: string, v: string) {
  const run = app.run;
  // 전투 중에는 속도 조절 / 결과 보기 / 계속만 받는다 (재렌더하면 전투 화면이 초기화됨)
  if (app.screen === 'battle' && !['speed', 'skip', 'after-battle'].includes(a)) return;
  switch (a) {
    case 'newrun': app.starters = []; app.screen = 'newrun'; app.menu = null; break;
    case 'to-title': if (app.view) { app.view.destroy(); app.view = null; } app.screen = 'title'; app.menu = null; app.run = null; break;
    case 'pick-starter': {
      const i = app.starters.indexOf(v);
      if (i >= 0) app.starters.splice(i, 1);
      else if (app.starters.length < CFG.startUnits) app.starters.push(v);
      else toast(`${CFG.startUnits}명까지 고를 수 있습니다.`);
      break;
    }
    case 'random-starters': app.starters = new Rng(Date.now() | 0).sample(UNITS.map((u) => u.id), CFG.startUnits); break;
    case 'start-run':
      if (app.starters.length !== CFG.startUnits) return;
      app.run = R.newRun((Date.now() ^ (Math.random() * 1e9)) | 0, app.starters);
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
    case 'manage': app.screen = 'prep'; app.sel = v ? { k: 'unit', uid: v } : null; break;
    case 'to-map': app.screen = run?.node?.type === 'shop' ? 'shop' : run?.node?.type === 'news' ? 'news' : 'map'; break;
    case 'fight':
      if (!run || !deployed(run).length) return;
      persist();
      app.summary = null;
      app.screen = 'battle';
      app.needMount = true; // render() 가 보드를 그린 뒤 전투 뷰를 붙인다
      break;
    case 'speed': app.speed = +v; if (app.view?.b) app.view.speed = app.speed; document.querySelectorAll('.speed .btn').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.v === v)); return;
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
    case 'staff-target': if (run) { run.staffTarget = v; toast('참모단 지원 대상으로 지정했습니다.'); persist(); } break;
    case 'leave-shop': if (run) { R.leaveShop(run); app.screen = 'map'; persist(); } break;
    case 'loan': if (run) { toast(R.takeLoan(run) ? '대출 실행: 크레딧 +25' : '대출할 수 없습니다.'); persist(); } break;
    // 대기 선택
    case 'pick-global': if (run) { R.pickGlobal(run, v); run.pending.shift(); persist(); } break;
    case 'alloc-inc': app.alloc[v as Major]++; break;
    case 'alloc-dec': app.alloc[v as Major] = Math.max(0, app.alloc[v as Major] - 1); break;
    case 'alloc-ok': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'rankup') return;
      R.applyRankAlloc(run, p.uid, app.alloc);
      app.alloc = { vit: 0, pow: 0, mnd: 0, def: 0, agi: 0 };
      p.allocDone = true;
      if (p.rank > CFG.augmentMaxRank) run.pending.shift(); // 10등급 초과: 스탯만
      persist();
      break;
    }
    case 'reroll': { const p = run?.pending[0]; if (run && p?.t === 'rankup' && p.rerolls > 0) { p.rerolls--; p.options = null; } break; }
    case 'pick-aug': {
      const p = run?.pending[0];
      if (!run || p?.t !== 'rankup' || !p.options) return;
      R.chooseAug(run, p.uid, p.options[+v]);
      run.pending.shift(); persist(); break;
    }
    case 'skip-aug': run?.pending.shift(); persist(); break;
    case 'pick-item': { const p = run?.pending[0]; if (run && p?.t === 'itemPick') { R.gainItem(run, p.options[+v]); run.pending.shift(); persist(); } break; }
    case 'pick-recruit': if (run && run.pending[0]?.t === 'recruit') { R.recruit(run, v); run.pending.shift(); persist(); } break;
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
  const n = run.node?.enc?.n || 6;
  if (sk === 'unit') {
    const u = run.units.find((x) => x.uid === sv[0]);
    if (!u) return;
    const lay = layout(run, n);
    const toPos = (x: number, y: number) => ({ c: x, r: n - 1 - y });
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

root.addEventListener('click', (ev) => {
  if (suppressClick) return;
  const el = (ev.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return;
  act(el.dataset.a!, el.dataset.v || '');
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
