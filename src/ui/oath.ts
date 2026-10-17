// 절망 서약 화면 · 표시 (data/oaths.ts). 타이틀 [절망 서약]에서 따로 여는 화면이고, 설정은 도감 기록(ui/meta.ts Meta.oath)에 남는다.
// 고난(위험 CFG.oathFrom) 이상으로 출격할 때만 런에 옮겨진다. 이름 · 효과 · 단계 · 절망 수치는 전부 데이터(OATHS · CFG.oath)에서 그릴 때마다 읽는다.
// 색은 절망 증강의 어두운 토큰(--c-despair 계열)을 그대로 쓴다.
import { CFG } from '../config';
import { FIELDS } from '../data/battlefields';
import { diffName } from '../data/difficulty';
import { OATHS, oathDespairEvery, oathDiff, oathHeat, oathHeatMax, oathHeatOf, oathLine, oathLv, oathMax, oathsOn, oathV, type OathDef, type OathSel } from '../data/oaths';
import type { RunState } from '../types';
import { loadMeta, metaOath, oathSel } from './meta';
import { lineIcon } from './synicons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** 서약 체계 아이콘 (상단 바 · 난이도 카드 · 화면 제목) */
export const OATH_ICON = 'r.lantern';
/** 지금 설정 (도감 기록) · 그 절망 수치 */
export const sel = (): OathSel => oathSel();
export const heatNow = () => oathHeat(sel());
/** 이 위험 등급 런에 서약이 걸리는지 (고난 이상) */
export const applies = (lvl: number) => oathDiff(lvl);
/** 절망 증강을 더 고르는 간격 (심연의 서약 반영) */
export const despairEvery = (r: RunState) => oathDespairEvery(r);
const hardName = () => diffName(CFG.oathFrom) || `위험 ${CFG.oathFrom}`;

/** 서약 카드: 단계 줄을 누르면 그 단계로 (지금 단계를 다시 누르면 1단계 내림) */
function card(d: OathDef, s: OathSel) {
  const n = oathLv({ oaths: s }, d.id), max = oathMax(d.id), heat = CFG.oath[d.id].heat;
  const lvs = Array.from({ length: max }, (_, i) => i + 1).map((k) =>
    `<button class="oh-lv${k <= n ? ' on' : ''}${k === n ? ' cur' : ''}" data-a="oath-set" data-v="${d.id}:${k === n ? k - 1 : k}" aria-pressed="${k <= n}" title="${k === n ? (k > 1 ? `${k - 1}단계로 내리기` : '끄기') : `${k}단계로`}"><span class="oh-k">${k}</span><span class="oh-tx">${esc(d.lv(k))}</span><span class="oh-h">+${heat[k - 1]}</span></button>`).join('');
  return `<div class="oh-card${n ? ' on' : ''}">
    <div class="oh-hd"><span class="oh-ic" aria-hidden="true">${lineIcon(d.icon, 'li')}</span><b>${esc(d.name)}</b><span class="oh-cost">${n ? `${n}/${max}단계 · 절망 ${oathHeatOf(d.id, n)}` : `최대 ${max}단계`}</span></div>
    <p class="oh-quip">${esc(d.quip)}</p>
    <div class="oh-lvs" role="group" aria-label="${esc(d.name)} 단계">${lvs}</div>
  </div>`;
}
/** 타이틀 [절망 서약] 화면 */
export function oathScreen() {
  const s = sel(), heat = oathHeat(s), on = oathsOn(s), best = loadMeta().oath?.best || {};
  const rec = FIELDS.map((f) => { const b = best[f.id]; return `<li><b style="color:${f.color}">${f.icon} ${esc(f.name)}</b><span class="mono">${b !== undefined && b >= 0 ? `절망 ${b}` : '—'}</span></li>`; }).join('');
  return `<main class="wrap oath">
    <header class="oh-top">
      <div class="oh-title"><span class="oh-kicker">${esc(hardName())} 의뢰 전용</span><h1>${lineIcon(OATH_ICON, 'li')}절망 서약</h1>
        <p class="muted small">${esc(hardName())}(위험 ${CFG.oathFrom})으로 출격할 때만 걸리는 조건입니다. 쉬움 · 모험에서는 무시합니다. 서약을 켜고 단계를 올릴수록 절망 수치가 쌓이고, ${esc(hardName())} 의뢰에 성공하면 전장별 최고 절망 수치가 기록됩니다. 런 중에 무작위로 고르는 절망 증강과 따로 걸립니다.</p></div>
      <div class="oh-heat" aria-live="polite"><span>절망 수치</span><b>${heat}</b><small>서약 ${on.length}개 · 최대 ${oathHeatMax()}</small></div>
    </header>
    <div class="oh-grid">${OATHS.map((d) => card(d, s)).join('')}</div>
    <section class="oh-rec"><h2>전장별 최고 절망 수치 성공</h2><ul>${rec}</ul></section>
    <div class="oh-act"><button class="btn ghost" data-a="oath-clear" ${on.length ? '' : 'disabled'}>모두 해제</button><button class="btn primary" data-a="oath-back">돌아가기</button></div>
  </main>`;
}
/** 화면 조작: 'oath-set' v = '서약 id:단계' · 'oath-clear' */
export function oathAct(a: string, v: string) {
  const s = sel();
  if (a === 'oath-clear') { metaOath({}); return; }
  if (a !== 'oath-set') return;
  const [id, k] = v.split(':');
  const d = OATHS.find((o) => o.id === id);
  if (!d) return;
  s[d.id] = Math.max(0, Math.min(oathMax(d.id), +k || 0));
  metaOath(s);
}
/** 난이도 선택 화면 고난 카드: 지금 절망 수치 */
export function oathCardNote() {
  const s = sel(), on = oathsOn(s);
  return `<span class="ds-oath${on.length ? ' on' : ''}">${lineIcon(OATH_ICON, 'li')}<span>절망 서약 <b>${oathHeat(s)}</b>${on.length ? ` · 서약 ${on.length}개` : ' · 켠 서약 없음 (타이틀에서 설정)'}</span></span>`;
}
/** 난이도 카드 ⓘ 세부 조건에 덧붙이는 줄 */
export const oathConds = () => { const s = sel(), on = oathsOn(s); return on.length ? [`절망 서약 (절망 수치 ${oathHeat(s)}): ${on.map((x) => oathLine(x.def, x.n)).join(' / ')}`] : []; };
/** 런 중 상단 바: 켠 서약이 있을 때만 (누르면 목록) */
export function oathPill(r: RunState) {
  const on = oathsOn(r.oaths);
  if (!on.length) return '';
  const tip = `절망 서약 — 절망 수치 ${r.oathHeat ?? oathHeat(r.oaths)}\n${on.map((x) => oathLine(x.def, x.n)).join('\n')}`;
  return `<button class="pill oath" data-a="oath-info" title="${esc(tip)}">${lineIcon(OATH_ICON, 'li')}<span class="oh-pl">서약</span><b>${r.oathHeat ?? oathHeat(r.oaths)}</b></button>`;
}
export const oathToast = (r: RunState | null) => { const on = oathsOn(r?.oaths); return on.length ? `절망 서약 ${r!.oathHeat ?? oathHeat(r!.oaths)}: ${on.map((x) => `[${x.def.name} ${x.n}단계]`).join(' ')} — 효과는 지도 [환경] 탭` : ''; };
/** 지도 환경 탭: 켠 서약과 단계별 효과 */
export function oathEnv(r: RunState) {
  const on = oathsOn(r.oaths);
  if (!on.length) return '';
  return `<h2>절망 서약 <span class="muted small">절망 수치 ${r.oathHeat ?? oathHeat(r.oaths)}</span></h2><ul class="globals despair">${on.map((x) => `<li>${lineIcon(x.def.icon, 'li')}<b>${esc(x.def.name)} ${x.n}단계</b> <span class="muted">${esc(x.def.lv(x.n))}</span></li>`).join('')}</ul>`;
}
/** 결과 문구: 의뢰 성공 창(victory, 기록 전 — 이 전장 최고면 표시) · 결과 화면(기록 뒤 — 이 전장 최고). 서약 없이 출격했으면 '' */
export function oathResult(r: RunState, victory: boolean) {
  if (!r.oaths) return '';
  const heat = r.oathHeat ?? oathHeat(r.oaths), best = loadMeta().oath?.best?.[r.field];
  if (victory) return ` · 절망 서약 ${heat}${best === undefined || heat > best ? ' (이 전장 최고 기록)' : ''}`;
  return ` 절망 서약 ${heat}${r.cleared && best !== undefined ? ` (이 전장 최고 ${best})` : ''}.`;
}
/** 군세의 서약: 지도 모디파이어의 적 수량에 더하는 수 */
export const hordeAdd = (r: RunState) => oathV(r, 'horde', 'add');
/** 도감 기록: 모든 전장 중 최고 절망 수치 성공 (없으면 '—') */
export const bestAll = () => { const v = Object.values(loadMeta().oath?.best || {}).filter((x) => x >= 0); return v.length ? String(Math.max(...v)) : '—'; };
/** 도감 기록: 이 전장의 최고 절망 수치 성공 (없으면 '') */
export const oathBest = (fieldId: string) => { const b = loadMeta().oath?.best?.[fieldId]; return b !== undefined && b >= 0 ? ` · 최고 절망 ${b}` : ''; };
