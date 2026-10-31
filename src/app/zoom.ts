// 편성 보드 확대 · 창 길잡이 · 확대 제스처 (main.ts 에서 분리)
import { type RunState } from '../types';
import { lineIcon } from '../ui/synicons';
import { app, loadPrefs, root, savePref } from './state';
import { prepVpMid } from './popups';
import { battleZoomTo, bcam, cellMinOf, clampN } from './battlecam';
import { blockClicks } from './drag';

// ───────── 편성 보드 확대 · 축소: 보드는 .board-vp 창 안에서만 커지고 (가로 · 세로 스크롤), 화면(페이지) 배율은 그대로.
// 보는 사람마다 errantes.prefs.v1 boardZoom = 칸 크기 / 최소 칸 크기 (CSS --cell-min), 0 = 전체 보기 (창에 보드 전체), 없으면 최소 칸 크기 (폭은 창 안)
/** 보드 왼쪽 세로 확대 단추 줄 (위 → 아래): [+] [전체 ↔ 확대 (전체 보기 ↔ 마지막 확대)] [−]. 가운데 단추의 아이콘 · 이름 · 상태 · 보이기는 prepZoomSync 가 실제 크기를 재서 맞춘다 */
export function prepZoomCtl() {
  return `<div class="bz-ctl bz-prep" role="group" aria-label="보드 확대" hidden>
    <button class="btn tiny bz-step" data-a="bzoom" data-v="in" title="확대 (Ctrl + 휠 · 두 손가락)" aria-label="확대">${lineIcon('u.zoomin', 'li')}</button>
    <button class="btn tiny bz-fit" data-a="board-fit">${lineIcon('u.zoomin', 'li')}<span>확대</span></button>
    <button class="btn tiny bz-step" data-a="bzoom" data-v="out" title="축소 (Ctrl + 휠 · 두 손가락)" aria-label="축소">${lineIcon('u.zoomout', 'li')}</button>
  </div>`;
}
/** 편성 보드 최대 칸 크기 (px): 기물 초상 · 장비 칸이 편히 읽히는 크기. 이보다 크면 한 화면에 보이는 칸만 줄어든다 */
export const PREP_CELL_MAX = 96;
/** 긴 보드의 처음 칸 크기 상한 = 최소 칸 (CSS --cell-min) 의 이 배 (창에 여유가 있을 때만: 데스크톱 약 68px · 휴대폰 약 57px) */
export const PREP_CELL_DEF = 1.3;
/** 편성 보드 창의 칸 크기 범위 (px): fit = 보드 전체가 창에 들어가는 크기 · min = CSS --cell-min
 *  max = min(PREP_CELL_MAX, 아군 진형 (포탑 열 포함) 전체가 창에 들어가는 크기) — 끝까지 확대해도 내 배치 구역은 한눈에 (휴대폰 세로에서 넓은 보드는 거의 확대 없음).
 *  단 max 는 min · fit 보다 작아지지 않는다 */
export function prepZoomRange(vp: HTMLElement, b: HTMLElement) {
  const row = vp.parentElement!, rs = getComputedStyle(row), rail = row.querySelector<HTMLElement>(':scope > .inv-rail');
  const availW = Math.max(120, row.clientWidth - (rs.flexDirection.startsWith('row') && rail ? rail.offsetWidth + (parseFloat(rs.columnGap) || 0) : 0));
  const availH = Math.max(160, parseFloat(getComputedStyle(vp).maxHeight) || innerHeight);
  const bw = +b.dataset.bw! || 1, bh = +b.dataset.bh! || 1, min = cellMinOf(vp), fit = Math.min(availW / bw, availH / bh);
  const az = vpZones(b).find((z) => z.k === 'ally'), allyFit = az ? Math.min(availW / az.r[2], availH / az.r[3]) : Infinity;
  return { bw, bh, availW, availH, fit, min, max: Math.max(fit, min, Math.min(PREP_CELL_MAX, allyFit)) };
}
export type PrepZoomRange = ReturnType<typeof prepZoomRange>;
/** 저장한 확대 → 칸 크기 (px) */
export function prepCellOf(m: PrepZoomRange) {
  const p = loadPrefs(), z = p.boardZoom ?? (p.boardFit ? 0 : undefined); // 예전 '전체 보기' 설정 (boardFit) 도 읽는다
  // 기본: 보드가 최소 칸 크기로 창에 다 들어가면 전체 (fit). 아니면 (긴 통로 · 포위) 짧은 축이 창을 채우는 만큼 키우되 최소 칸의 PREP_CELL_DEF 배까지
  // (세로로 긴 보드는 폭, 가로로 긴 보드는 높이) — 긴 축은 창 안 스크롤, 처음 위치는 아군 진형 (prepViewInit)
  if (z === undefined) return m.fit >= m.min ? m.fit : clampN(m.bw > m.bh ? m.availH / m.bh : m.availW / m.bw, m.min, Math.min(m.max, PREP_CELL_DEF * m.min));
  return z <= 0 ? m.fit : clampN(z * m.min, m.fit, m.max);
}
/** 보드 크기를 칸 크기 cell (없으면 저장값) 로 맞추고 단추 상태를 고친다. at = 그 자리에 머물 화면 점 (확대 · 축소 기준) */
export function prepZoomSync(cell?: number, at?: { x: number; y: number }) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board');
  if (!vp || !b) return;
  // 확대 단추 줄은 보드 왼쪽에 자리를 차지하므로, 단추 줄이 있는 폭으로 재서 확대할 여지가 있을 때만 남긴다 (없으면 숨기고 그 폭까지 보드에)
  const ctl = root.querySelector<HTMLElement>('.bz-prep');
  if (ctl) ctl.hidden = false;
  let m = prepZoomRange(vp, b);
  if (ctl && m.max - m.fit < 1) { ctl.hidden = true; m = prepZoomRange(vp, b); }
  const c = clampN(cell ?? prepCellOf(m), m.fit, m.max);
  const r0 = at ? b.getBoundingClientRect() : null;
  b.style.width = `${c * m.bw}px`;
  vp.classList.toggle('scroll', c * m.bw > m.availW + 0.5 || c * m.bh > m.availH + 0.5); // 창보다 크면 창 안 스크롤 (아니면 넘침 허용: 보드 가장자리 화살표 · 이름표가 잘리지 않게)
  vp.onscroll = () => { vpMoreSync(vp); if (prepView.key) { prepView.l = vp.scrollLeft; prepView.t = vp.scrollTop; } };
  if (at && r0) { // 가리킨 점 아래 칸이 그대로 있게 창을 민다
    const r1 = b.getBoundingClientRect(), fx = (at.x - r0.left) / r0.width, fy = (at.y - r0.top) / r0.height;
    vp.scrollLeft += r1.left + fx * r1.width - at.x;
    vp.scrollTop += r1.top + fy * r1.height - at.y;
  }
  vpMoreSync(vp);
  if (!ctl || ctl.hidden) return;
  const zoomed = c > m.fit + 0.5;
  ctl.querySelector<HTMLButtonElement>('[data-v="out"]')!.disabled = !zoomed;
  ctl.querySelector<HTMLButtonElement>('[data-v="in"]')!.disabled = c >= m.max - 0.5;
  // 가운데 단추: 확대해 둔 동안 = [축소 아이콘 · 전체] (전체 보기로) · 전체 보기 = [확대 아이콘 · 확대] (마지막 확대로). 보드가 최소 칸 크기로 창에 다 들어가고 돌아갈 확대도 없으면 꺼 둔다
  const fb = ctl.querySelector<HTMLButtonElement>('.bz-fit')!, last = (loadPrefs().boardZoomLast || 0) * m.min;
  fb.disabled = !zoomed && m.fit >= m.min - 0.5 && Math.min(last, m.max) <= m.fit + 0.5;
  if (fb.dataset.z !== String(zoomed)) { fb.dataset.z = String(zoomed); fb.innerHTML = `${lineIcon(zoomed ? 'u.zoomout' : 'u.zoomin', 'li')}<span>${zoomed ? '전체' : '확대'}</span>`; }
  fb.title = zoomed ? '전체: 보드 전체를 창에 맞춰 보기' : '확대: 마지막 확대로 (아군 진형부터)';
  fb.setAttribute('aria-label', fb.title);
  fb.setAttribute('aria-pressed', String(!zoomed));
}
/** 편성 보드 창 가장자리 흐림: 그쪽으로 더 볼 칸이 있으면 (가로로 긴 지형 · 확대) */
export function vpMoreSync(vp: HTMLElement) {
  const l = vp.scrollLeft, t = vp.scrollTop, on = vp.classList.contains('scroll'); // 클래스 대신 data-more (다시 그릴 때 스크롤 위치 복원은 클래스 이름으로 요소를 찾는다)
  const more = on ? [l > 1 && 'l', l + vp.clientWidth < vp.scrollWidth - 1 && 'r', t > 1 && 't', t + vp.clientHeight < vp.scrollHeight - 1 && 'b'].filter(Boolean).join(' ') : '';
  if (vp.dataset.more !== more) vp.dataset.more = more;
  vpCueSync(vp);
}
// ───────── 편성 보드 창 길잡이: 처음에는 아군 진형을 보이고 (prepViewInit), 창 밖에 있는 적 진형은 창 가장자리 칩 [적 n →] 으로 알린다 (누르면 그쪽으로)
/** 진형 (prepScreen 의 .board data-zones): k = ally · foe0 (위 · 가로 지형은 오른쪽) · foe1 (포위의 아래 · 왼쪽), r = 보이는 틀 기준 화면 칸 [x, y, w, h], n = 기물 · 적 수 */
export type VpZone = { k: string; r: [number, number, number, number]; n: number };
export function vpZones(b: HTMLElement): VpZone[] { try { return JSON.parse(b.dataset.zones || '[]'); } catch { return []; } }
/** 진형 → 창 안 내용 좌표 사각형 (px, 스크롤 원점) */
export function vpZoneRect(vp: HTMLElement, b: HTMLElement, z: VpZone) {
  const br = b.getBoundingClientRect(), vr = vp.getBoundingClientRect(), cw = br.width / (+b.dataset.bw! || 1), ch = br.height / (+b.dataset.bh! || 1);
  const ox = br.left - vr.left - vp.clientLeft + vp.scrollLeft, oy = br.top - vr.top - vp.clientTop + vp.scrollTop;
  return { l: ox + z.r[0] * cw, t: oy + z.r[1] * ch, w: z.r[2] * cw, h: z.r[3] * ch };
}
/** 첫 편성의 적 쪽 가장자리 깜빡임 길이 (ms) */
export const VP_PULSE_MS = 2400;
/** 지금 조우의 편성 창: key = 조우 (런 · 조우 씨앗 · 지형 · 폭), t0 = 처음 연 시각, l · t = 마지막 창 스크롤 (맵에 다녀와도 그 자리로) */
export let prepView = { key: '', t0: 0, l: 0, t: 0 };
export const prepViewKey = (run: RunState | null) => { const e = run?.node?.enc; return run ? `${run.seed}:${e ? `${e.seed}:${e.map || ''}:${e.n}` : '-'}` : ''; };
/** 진형 하나를 창 가운데로 (창 끝에서 멈춘다) */
export function prepCenterOn(k: string, smooth = false) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board'), z = b && vpZones(b).find((q) => q.k === k);
  if (!vp || !b || !z) return;
  const r = vpZoneRect(vp, b, z);
  const left = clampN(r.l + r.w / 2 - vp.clientWidth / 2, 0, vp.scrollWidth - vp.clientWidth), top = clampN(r.t + r.h / 2 - vp.clientHeight / 2, 0, vp.scrollHeight - vp.clientHeight);
  vp.scrollTo({ left, top, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
}
/** 그린 뒤 편성 창 위치: 조우가 바뀌어 처음 열면 아군 진형을 가운데로 · 같은 조우에 다른 화면에서 돌아오면 마지막 자리로 (같은 화면을 다시 그릴 때는 scrollRestore 가 둔다) */
export function prepViewInit(sameView: boolean) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp');
  if (!vp) return;
  const key = prepViewKey(app.run);
  if (key !== prepView.key) { prepView = { key, t0: performance.now(), l: 0, t: 0 }; prepCenterOn('ally'); }
  else if (!sameView) { vp.scrollLeft = prepView.l; vp.scrollTop = prepView.t; }
  prepView.l = vp.scrollLeft; prepView.t = vp.scrollTop;
  vpMoreSync(vp);
}
export const CUE_ARR: Record<string, string> = { l: 'M19 12H5M11 6l-6 6 6 6', r: 'M5 12h14M13 6l6 6-6 6', t: 'M12 19V5M6 11l6-6 6 6', b: 'M12 5v14M6 13l6 6 6-6' };
/** 창 가장자리 칩: 진형이 절반 넘게 창 밖이면 그쪽 가장자리에 [적 n →] · [아군 n ←] (적이 없는 진형은 빼고). 진형이 보이면 사라진다.
 *  포위 지형 (적 진형 2곳) 첫 편성의 깜빡이는 동안은 보이는 적 진형도 칩으로 (양쪽에서 적이 온다는 것을 수로). 칩 자리는 vpCuePlace */
export function vpCueSync(vp: HTMLElement) {
  const host = vp.parentElement?.querySelector<HTMLElement>(':scope > .vp-cues'), b = vp.querySelector<HTMLElement>(':scope > .board');
  if (!host || !b) return;
  const st = `left:${vp.offsetLeft}px;top:${vp.offsetTop}px;width:${vp.offsetWidth}px;height:${vp.offsetHeight}px`;
  if (host.getAttribute('style') !== st) host.setAttribute('style', st);
  const ovl = vp.parentElement?.querySelector<HTMLElement>(':scope > .tool-ovl'), os = `left:${vp.offsetLeft}px;top:${vp.offsetTop + 6}px;width:${vp.offsetWidth}px;right:auto`; // 쥔 도구 칩: 보드 창 위쪽 가장자리 가운데
  if (ovl && ovl.getAttribute('style') !== os) ovl.setAttribute('style', os);
  const sides: Record<string, string[]> = { l: [], r: [], t: [], b: [] }, W = vp.clientWidth, H = vp.clientHeight, x0 = vp.scrollLeft, y0 = vp.scrollTop;
  const age = performance.now() - prepView.t0, pulse = age < VP_PULSE_MS && prepView.key === prepViewKey(app.run), delay = `animation-delay:-${Math.round(age)}ms`; // 다시 그려도 깜빡임은 이어서 (한 번만)
  const zones = vpZones(b), sur = pulse && zones.some((z) => z.k === 'foe1'); // 포위 첫 편성: 적 진형 양쪽 모두
  let key = '', edge = '';
  if (vp.classList.contains('scroll') || sur) for (const z of zones) {
    const ally = z.k === 'ally';
    if (!ally && !z.n) continue;
    const r = vpZoneRect(vp, b, z), ow = Math.max(0, Math.min(r.l + r.w, x0 + W) - Math.max(r.l, x0)), oh = Math.max(0, Math.min(r.t + r.h, y0 + H) - Math.max(r.t, y0));
    if ((ow * oh) / Math.max(1, r.w * r.h) >= 0.5 && !(sur && !ally)) continue;
    const dx = (r.l + r.w / 2 - (x0 + W / 2)) / W, dy = (r.t + r.h / 2 - (y0 + H / 2)) / H;
    const side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'l' : 'r') : dy < 0 ? 't' : 'b';
    const arr = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${CUE_ARR[side]}"/></svg>`, txt = `<b>${ally ? '아군' : '적'}</b>${z.n ? `<span>${z.n}</span>` : ''}`;
    const tip = ally ? `아군 진형으로 (출전 ${z.n})` : `적 진형으로 (적 ${z.n})`;
    const pz = !ally && pulse;
    sides[side][ally ? 'unshift' : 'push'](`<button class="vp-cue ${ally ? 'ally' : 'foe'}${pz ? ' pulse' : ''}" data-a="vp-cue" data-v="${z.k}" title="${tip}" aria-label="${tip}"${pz ? ` style="${delay}"` : ''}>${side === 'l' ? arr + txt : txt + arr}</button>`);
    if (pz) edge += `<i class="vp-edge s-${side}" style="${delay}"></i>`; // 첫 편성: 적 쪽 가장자리가 한 번 빛난다
    key += `${z.k}${side}${z.n};`;
  }
  if (pulse) key += 'p';
  if (host.dataset.ck !== key) {
    host.dataset.ck = key;
    host.innerHTML = edge + Object.entries(sides).filter(([, a]) => a.length).map(([sd, a]) => `<div class="vp-cs s-${sd}">${a.join('')}</div>`).join('');
    if (pulse) setTimeout(() => { const v = root.querySelector<HTMLElement>('.prep .board-vp'); if (v) vpCueSync(v); }, Math.max(0, VP_PULSE_MS - (performance.now() - prepView.t0)) + 30);
  }
  vpCuePlace(vp, host, b);
}
/** 칩이 피할 보드 위 대상: 기물 · 적 · 포탑 · 소환물 · 장치 (가중 100) · 지형 지물 칸 (가중 1) */
export const VP_CUE_AVOID: [string, number][] = [[':scope > .u, .dev-mark, .dev-wall2', 100], ['.cell[data-a="sel-terrain"]', 1]];
/** 가장자리 칩 묶음을 그 가장자리를 따라 밀어, 덮는 기물 · 적 · 장치가 가장 적은 자리 (같으면 가운데에 가까운 자리)에 둔다.
 *  덮는 넓이는 칸 단위 (대상이 놓인 칸 전체) — 빈칸이 있으면 차 있는 칸 위에는 놓지 않는다. 스크롤 · 확대 · 다시 그리기마다 다시 잰다 */
export function vpCuePlace(vp: HTMLElement, host: HTMLElement, b: HTMLElement) {
  const groups = host.querySelectorAll<HTMLElement>(':scope > .vp-cs');
  if (!groups.length) return;
  const hr = host.getBoundingClientRect(), br = b.getBoundingClientRect(), W = vp.clientWidth, H = vp.clientHeight, M = 4;
  const cw = br.width / (+b.dataset.bw! || 1), ch = br.height / (+b.dataset.bh! || 1);
  const snap = (v: number, o: number, c: number, up: boolean) => o + (up ? Math.ceil((v - o - 1) / c) : Math.floor((v - o + 1) / c)) * c;
  const obs: { l: number; t: number; r: number; b: number; w: number }[] = [];
  for (const [sel, w] of VP_CUE_AVOID) for (const e of Array.from(b.querySelectorAll<HTMLElement>(sel))) {
    const r = e.getBoundingClientRect();
    if (!r.width || r.right < hr.left || r.bottom < hr.top || r.left > hr.left + W || r.top > hr.top + H) continue;
    obs.push({ l: snap(r.left, br.left, cw, false) - hr.left, t: snap(r.top, br.top, ch, false) - hr.top, r: snap(r.right, br.left, cw, true) - hr.left, b: snap(r.bottom, br.top, ch, true) - hr.top, w });
  }
  for (const g of Array.from(groups)) {
    const sd = /s-([lrtb])/.exec(g.className)?.[1] || 't', horiz = sd === 't' || sd === 'b', gw = g.offsetWidth, gh = g.offsetHeight;
    const span = horiz ? W : H, len = horiz ? gw : gh, fix = sd === 't' ? M : sd === 'b' ? H - M - gh : sd === 'l' ? M : W - M - gw;
    const lo = M, hi = Math.max(lo, span - M - len), mid = clampN((span - len) / 2, lo, hi);
    let best = mid, bc = Infinity;
    const cost = (p: number) => {
      const l = horiz ? p : fix, t = horiz ? fix : p, r = l + gw, bt = t + gh;
      let c = Math.abs(p - mid) / Math.max(1, span); // 같으면 가운데 쪽
      for (const o of obs) { const ox = Math.min(r, o.r) - Math.max(l, o.l), oy = Math.min(bt, o.b) - Math.max(t, o.t); if (ox > 0 && oy > 0) c += o.w * (1 + (ox * oy) / (gw * gh)); }
      return c;
    };
    for (let p = lo; p <= hi + 0.5; p += 4) { const c = cost(Math.min(p, hi)); if (c < bc) { bc = c; best = Math.min(p, hi); } }
    if (cost(mid) <= bc) best = mid;
    const st = horiz ? `left:${Math.round(best)}px;top:${Math.round(fix)}px` : `left:${Math.round(fix)}px;top:${Math.round(best)}px`;
    if (g.getAttribute('style') !== st) g.setAttribute('style', st);
  }
}
/** 편성 보드 확대 바꾸기 + 저장 (끄는 동안은 저장을 모아서) */
export let pzSaveT = 0;
export function prepZoomTo(cell: number, at?: { x: number; y: number }) {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board');
  if (!vp || !b) return;
  const m = prepZoomRange(vp, b), c = clampN(cell, m.fit, m.max);
  prepZoomSync(c, at ?? prepVpMid());
  clearTimeout(pzSaveT);
  pzSaveT = window.setTimeout(() => savePref('boardZoom', c <= m.fit + 0.5 ? 0 : +(c / m.min).toFixed(3)), 200);
}
/** 지금 편성 보드 칸 크기 (px) */
export function prepCellNow() {
  const vp = root.querySelector<HTMLElement>('.prep .board-vp'), b = vp?.querySelector<HTMLElement>(':scope > .board');
  return vp && b ? { m: prepZoomRange(vp, b), c: b.getBoundingClientRect().width / (+b.dataset.bw! || 1) } : null;
}
/** ± 단추 · 전환 단추 */
export const ZOOM_STEP = 1.25;
export function prepZoomAct(kind: string) {
  const now = prepCellNow();
  if (!now) return;
  const { m, c } = now;
  if (kind === 'fit') {
    if (c > m.fit + 0.5) { savePref('boardZoomLast', +(c / m.min).toFixed(3)); prepZoomTo(m.fit); }
    else { prepZoomTo(Math.max(m.min, (loadPrefs().boardZoomLast || 1) * m.min, m.fit * ZOOM_STEP)); prepCenterOn('ally'); } // 확대하면 아군 진형부터
  } else prepZoomTo(kind === 'in' ? c * ZOOM_STEP : c / ZOOM_STEP);
}
/** 전투 창 ± 단추 */
export function battleZoomAct(kind: string) { battleZoomTo(kind === 'in' ? bcam.bz * ZOOM_STEP : bcam.bz / ZOOM_STEP); }
// ───────── 확대 제스처: 편성 보드 창 · 전투 창 안에서만 (Ctrl/⌘ + 휠 · 트랙패드 핀치 · 두 손가락). 그 밖에서는 브라우저 확대를 막는다 (아래 '브라우저 확대 막기')
export const zoomHost = (t: EventTarget | null) => {
  const el = t instanceof Element ? t : null;
  return el?.closest<HTMLElement>('.prep .board-vp') ? 'prep' : el?.closest<HTMLElement>('.bview:not(.full)') ? 'battle' : '';
};
export function zoomBy(host: string, f: number, at: { x: number; y: number }) {
  if (host === 'prep') { const now = prepCellNow(); if (now) prepZoomTo(now.c * f, at); }
  else if (host === 'battle') battleZoomTo(bcam.bz * f, at);
}
/** 두 손가락 확대 (터치): 두 손가락 사이 거리 비율만큼, 가운데 점 기준. 편성 보드는 가운데 점이 움직이면 창도 민다 */
export let pinch: { host: string; d: number; mx: number; my: number } | null = null;
export function setPinch(v: typeof pinch) { pinch = v; }
export const touchMid = (e: TouchEvent) => { const [a, b] = [e.touches[0], e.touches[1]]; return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }; };
export const pinchEnd = (e: TouchEvent) => { if (pinch && e.touches.length < 2) { pinch = null; blockClicks(60); } };

/** 스크롤된 요소 목록: [클래스 이름, 같은 클래스 중 순번, 위, 왼쪽, 창 안 여부] */
export type ScrollMark = [string, number, number, number, boolean];
export function scrollSnapshot(): ScrollMark[] {
  const out: ScrollMark[] = [];
  const seen = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (!(el instanceof HTMLElement) || !el.className || typeof el.className !== 'string') continue;
    const cls = el.className.replace(/\b(on|enter|sel|peek|dragging|played|landed|opened)\b/g, '').trim();
    const n = seen.get(cls) ?? 0;
    seen.set(cls, n + 1);
    if (el.scrollTop > 0 || el.scrollLeft > 0) out.push([cls, n, el.scrollTop, el.scrollLeft, !!el.closest('.modal')]);
  }
  return out;
}
export function scrollRestore(marks: ScrollMark[], newModal: boolean) {
  if (!marks.length) return;
  const want = new Map(marks.filter((m) => !(newModal && m[4])).map((m) => [`${m[0]}#${m[1]}`, m]));
  if (!want.size) return;
  const seen = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (!(el instanceof HTMLElement) || !el.className || typeof el.className !== 'string') continue;
    const cls = el.className.replace(/\b(on|enter|sel|peek|dragging|played|landed|opened)\b/g, '').trim();
    const n = seen.get(cls) ?? 0;
    seen.set(cls, n + 1);
    const m = want.get(`${cls}#${n}`);
    if (m) { el.scrollTop = m[2]; el.scrollLeft = m[3]; }
  }
}
/** 다시 그릴 때 이미 해독된 그림 요소를 옮겨 심는다 (같은 src 의 <img>, 자식 없는 배경 그림 칸).
 *  화면 전체를 새로 그리면 데이터 URI 그림을 다시 해독하느라 한 프레임 비어 깜빡인다 (도감 항목 고르기 등). 속성은 새 요소 것으로 맞춘다 */
export function keepMedia() {
  const Q = 'img[src], [style*="background-image"]';
  const keyOf = (el: Element) => (el.tagName === 'IMG' ? `i${el.getAttribute('src')}` : el.firstChild ? '' : `${el.tagName}${el.getAttribute('style')}`);
  const pool = new Map<string, Element[]>();
  root.querySelectorAll(Q).forEach((el) => { const k = keyOf(el); if (k) (pool.get(k) ?? pool.set(k, []).get(k)!).push(el); });
  return () => {
    if (!pool.size) return;
    root.querySelectorAll(Q).forEach((el) => {
      const k = keyOf(el), old = k ? pool.get(k)?.shift() : undefined;
      if (!old) return;
      for (const a of Array.from(old.attributes)) if (!el.hasAttribute(a.name)) old.removeAttribute(a.name);
      for (const a of Array.from(el.attributes)) if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
      el.replaceWith(old);
    });
  };
}
