import { CFG } from '../config';
import { itemInfo } from '../data/items';
import type { BEvent, Battle, CUnit } from '../engine/combat';
import type { Elem } from '../types';
import { hasPortrait, iconURL } from './portraits';

export const ELEM_COLOR: Record<Elem, string> = {
  phys: 'var(--el-phys)', chem: 'var(--el-chem)', elec: 'var(--el-elec)', psy: 'var(--el-psy)', holy: 'var(--el-holy)', true: 'var(--el-true)',
};

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

interface UEl {
  el: HTMLElement; face: HTMLElement; hp: HTMLElement; loss: HTMLElement; sh: HTMLElement; cd: HTMLElement; gx: HTMLElement | null;
  sti: HTMLElement; stk: HTMLElement; rl: HTMLElement;
  u: CUnit; dead: boolean;
  /** 체력 바 손실 구간 (큰 피해 뒤 잠깐 남는 흰 띠) */
  trail: number; trailHold: number;
  stiSig: string; stkSig: string; rlMax: number;
}
/** 최근 행동 한 줄 */
export interface ActLine { t: number; key: string; text: string; v?: number; ids?: Set<number> }

// 연출 시간 (게임 초 · 배속에 비례)
const T_MELEE = 0.08; // 근접: 기울기 정점에서 적중
const T_SKILL = 0.12; // 스킬명 → 효과
const T_SUPPORT = 0.22; // 회복 · 보호막 표식 이동
const flightOf = (d: number) => Math.min(0.26, 0.07 + 0.035 * d);
// 곡선: 급하게 출발해 감속 (선형 대신)
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
const EASE_IN = 'cubic-bezier(.5, 0, .9, .5)';
const EASE_SHOT = 'cubic-bezier(.3, .7, .6, 1)';
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** 표시 우선순위: 0 일반 숫자 · 1 스킬 피해 · 범위 · 2 스킬명 · 부활 · 상태이상 (생략하지 않음) */
type Prio = 0 | 1 | 2;

/** 전투를 실시간으로 진행하며 보드 위 DOM 을 갱신한다.
 *  행동마다 '시전자 → 전달 → 대상 반응' 을 보여 주고, 탄환 · 표식이 닿는 순간에 피해 숫자 · 체력 변화 · 사망을 맞춘다 */
export class BattleView {
  private _speed = 1;
  private els = new Map<number, UEl>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  /** 연출 시계 (게임 초) */
  private vt = 0;
  private overAt = -1;
  private fxLayer: HTMLElement;
  private svg: SVGSVGElement;
  private ended = false;
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** 늦게 보여 줄 일 (표시 시각 순) */
  private q: { at: number; fn: () => void }[] = [];
  /** 아직 표시하지 않은 체력 · 보호막 변화 (실제값 − 이것 = 화면값) */
  private lagHp = new Map<number, number>();
  private lagSh = new Map<number, number>();
  private pendN = new Map<number, number>();
  /** 이 기물에게 날아가는 탄환이 닿는 시각 (연쇄 탄환은 그 다음에 출발) */
  private projLand = new Map<number, number>();
  private anims = new Set<Animation>();
  private merges = new Map<string, { el: HTMLElement; v: number; until: number; fmt: (v: number) => string }>();
  private castSeen = new Set<number>();
  private lanes = new Map<number, number>();
  private statusSeen = new Map<string, number>();
  private logs = new Map<number, ActLine[]>();
  /** 장비 아이콘 HTML (main 에서 주입) */
  itemHtml: (id: string) => string = () => '';

  constructor(private board: HTMLElement, public b: Battle, private onTick: () => void, private onEnd: () => void) {
    this.fxLayer = document.createElement('div');
    this.fxLayer.className = 'fx-layer';
    board.appendChild(this.fxLayer);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'focus-lines');
    this.svg.setAttribute('viewBox', '0 0 100 100');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    board.appendChild(this.svg);
    for (const u of b.units) this.mount(u);
    this.sync();
  }

  get speed() { return this._speed; }
  /** 0 = 정지. 진행 중인 연출도 같은 배율로 느려지거나 멈춘다 */
  set speed(v: number) {
    this._speed = v;
    for (const a of this.anims) this.rateOf(a);
  }
  private rateOf(a: Animation) {
    const text = (a as Animation & { text?: boolean }).text;
    if (this._speed === 0) { a.pause(); return; }
    a.playbackRate = text ? Math.max(0.6, Math.min(2, this._speed)) : this._speed;
    if (a.playState === 'paused') a.play();
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const adv = dt * this._speed;
      this.acc += adv;
      this.vt += adv;
      let steps = 0;
      while (this.acc >= CFG.tick && !this.b.over && steps < 200) { this.b.step(CFG.tick); this.acc -= CFG.tick; steps++; }
      this.drain();
      this.flush();
      this.sync();
      this.onTick();
      if (this.b.over) {
        if (this.overAt < 0) this.overAt = this.vt;
        // 마지막 탄환 · 표식이 닿을 때까지 기다린다
        if (!this.q.length || this.vt - this.overAt > 1.2) { this.flush(true); this.sync(); this.finish(); return; }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  skip() {
    this.b.keepEvents = false;
    this.b.events.length = 0;
    this.b.runToEnd();
    this.flush(true);
    this.sync();
    this.finish();
  }

  destroy() { cancelAnimationFrame(this.raf); for (const a of this.anims) a.cancel(); this.anims.clear(); }

  /** 상세 정보로 보고 있는 기물 표시 */
  private selId: number | null = null;
  select(id: number | null) {
    if (id === this.selId) return;
    if (this.selId !== null) this.els.get(this.selId)?.el.classList.remove('sel');
    if (id !== null) this.els.get(id)?.el.classList.add('sel');
    this.selId = id;
    this.board.classList.toggle('has-focus', id !== null);
    this.drawFocus();
  }

  /** 선택 기물의 최근 행동 (최신 순, 최대 n개) */
  recent(id: number, n = 3): ActLine[] { return (this.logs.get(id) || []).slice(-n).reverse(); }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.onTick();
    setTimeout(() => this.onEnd(), this.b.keepEvents ? 500 : 0);
  }

  private pos(x: number, y: number) {
    return { left: `${(x / this.b.w) * 100}%`, top: `${(y / this.b.h) * 100}%` };
  }

  private mount(u: CUnit) {
    const el = document.createElement('div');
    const card = hasPortrait(u);
    el.className = `u side${u.side}${card ? ' tkb' : ''}${u.big ? ' big' : ''}${u.isBoss ? ' boss' : ''}`;
    el.style.width = `${100 / this.b.w}%`;
    el.style.height = `${100 / this.b.h}%`;
    el.dataset.a = 'bsel';
    el.dataset.v = String(u.id);
    const inner = `<div class="bars"><i class="loss"></i><i class="hp"></i><i class="sh"></i></div><img alt="" class="${card ? 'pt' : ''}" src="${iconURL(u)}"><div class="cd"><i></i></div>${u.side === 0 && (u.reason !== null || u.div !== null) ? '<div class="gx"><i></i></div>' : ''}<div class="sti"></div><div class="stk"></div><div class="rl" hidden title="재장전 중"><i class="rl-ring"></i><svg viewBox="0 0 10 16" aria-hidden="true"><path d="M5 .8C3.4 2.2 2.8 3.8 2.8 5.6V7h4.4V5.6C7.2 3.8 6.6 2.2 5 .8Z"/><rect x="2.8" y="7.8" width="4.4" height="6.2" rx=".5"/><rect x="2.2" y="14.4" width="5.6" height="1.2" rx=".4"/></svg></div>`;
    el.innerHTML = card ? `<div class="tk-card">${inner}</div>` : inner;
    this.board.appendChild(el);
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    this.els.set(u.id, {
      el, face: (el.querySelector<HTMLElement>('.tk-card') || q('img')), hp: q('.hp'), loss: q('.loss'), sh: q('.sh'), cd: q('.cd i'), gx: el.querySelector<HTMLElement>('.gx i'),
      sti: q('.sti'), stk: q('.stk'), rl: q('.rl'), u, dead: false, trail: 1, trailHold: 0, stiSig: '', stkSig: '', rlMax: 1,
    });
  }

  // ───────── 표시 시계
  private later(at: number, fn: () => void) {
    if (at <= this.vt) { fn(); return; }
    let i = this.q.length;
    while (i > 0 && this.q[i - 1].at > at) i--;
    this.q.splice(i, 0, { at, fn });
  }
  private flush(all = false) {
    while (this.q.length && (all || this.q[0].at <= this.vt)) this.q.shift()!.fn();
  }
  /** 체력 · 보호막 변화를 at 에 보여 준다 (그때까지 화면은 이전 값) */
  private delta(id: number, dhp: number, dsh: number, at: number, then?: () => void) {
    if (at <= this.vt) { then?.(); return; }
    const add = (m: Map<number, number>, v: number) => m.set(id, (m.get(id) || 0) + v);
    add(this.lagHp, dhp); add(this.lagSh, dsh); add(this.pendN, 1);
    this.later(at, () => { add(this.lagHp, -dhp); add(this.lagSh, -dsh); add(this.pendN, -1); then?.(); });
  }

  private sync() {
    const now = this.vt;
    for (const [id, e] of this.els) {
      const u = e.u;
      let x = u.x, y = u.y;
      if (u.moveT > 0 && u.moveDur > 0) {
        const t = easeOut(1 - u.moveT / u.moveDur);
        x = u.px + (u.x - u.px) * t;
        y = u.py + (u.y - u.py) * t;
      }
      const p = this.pos(x, y);
      e.el.style.left = p.left;
      e.el.style.top = p.top;
      const max = this.b.S(u, 'maxHp');
      const hp = Math.max(0, Math.min(max, u.hp - (this.lagHp.get(id) || 0)));
      const sh = Math.max(0, u.shield - (this.lagSh.get(id) || 0));
      const f = hp / max;
      // 손실 구간: 잠깐 머문 뒤 줄어든다
      if (f < e.trail) { if (e.trailHold <= 0) e.trailHold = now + 0.35; if (now >= e.trailHold) e.trail = Math.max(f, e.trail - 0.02 * Math.max(1, this._speed)); }
      else { e.trail = f; e.trailHold = 0; }
      e.hp.style.width = `${f * 100}%`;
      e.loss.style.width = `${e.trail * 100}%`;
      e.sh.style.width = `${Math.min(100, (sh / max) * 100)}%`;
      e.cd.style.width = u.cdMax ? `${Math.max(0, Math.min(100, (1 - u.cd / u.cdMax) * 100))}%` : '0';
      if (e.gx) {
        // 사이오닉 이성(보라, -100~100) / 디바인 신성력(금색, 0~100)
        if (u.div !== null) { e.gx.style.setProperty('--v', `${u.divUsed ? 100 : u.div}%`); e.gx.className = u.divUsed ? 'div used' : 'div'; e.el.title = `신성력 ${Math.round(u.div)} (수집 ${Math.round(u.divGot)}/${u.divCap})`; }
        else if (u.reason !== null) { e.gx.style.setProperty('--v', `${(u.reason + 100) / 2}%`); e.gx.className = u.reason <= -50 ? 'psi frenzy' : 'psi'; e.el.title = `이성 ${Math.round(u.reason)}`; }
      }
      const alive = u.alive || (this.pendN.get(id) || 0) > 0;
      // 재장전: 탄창 표식 + 진행 고리
      if (alive && u.reloadT > 0) {
        if (e.rl.hidden) { e.rl.hidden = false; e.rlMax = u.reloadT; }
        e.rl.style.setProperty('--p', `${Math.round((1 - u.reloadT / Math.max(0.01, e.rlMax)) * 100)}%`);
      } else if (!e.rl.hidden) e.rl.hidden = true;
      // 행동을 막는 상태: 머리 위 아이콘
      const blk = !alive ? '' : [this.b.has(u, 'stun') && 'stun', this.b.has(u, 'fear') && 'fear', this.b.has(u, 'shock') && 'shock'].filter(Boolean).join(',');
      if (blk !== e.stiSig) {
        e.stiSig = blk;
        e.sti.innerHTML = blk ? blk.split(',').map((k) => `<i class="sti-${k}" title="${k === 'stun' ? '기절: 행동 불가' : k === 'fear' ? '공포: 공격 · 기술 불가' : '감전: 기술 쿨다운 정지'}">${k === 'stun' ? '✦' : k === 'fear' ? '!' : 'ϟ'}</i>`).join('') : '';
      }
      e.el.classList.toggle('stunned', !!alive && blk.includes('stun'));
      e.el.classList.toggle('feared', !!alive && blk.includes('fear'));
      e.el.classList.toggle('shocked', !!alive && blk.includes('shock'));
      // 중첩 표식: 분석 (분절) · 암운 (개수)
      let stk = '';
      if (alive) for (const s of u.statuses) {
        if (s.key === 'vivian.shred' && s.stacks) { const m = s.stacks > 3 ? 5 : 3; stk += `<span class="stk-seg" title="방어 분석 ${s.stacks}/${m}">${'<i class="on"></i>'.repeat(s.stacks)}${'<i></i>'.repeat(Math.max(0, m - s.stacks))}</span>`; }
        if (s.key === 'gloom' && s.stacks) stk += `<span class="stk-gloom" title="암운 ${s.stacks}중첩">☁${s.stacks}</span>`;
      }
      if (stk !== e.stkSig) { e.stkSig = stk; e.stk.innerHTML = stk; }
      if (!alive && !e.dead) { e.dead = true; e.el.classList.add('dead'); }
      else if (alive && e.dead && u.alive) { e.dead = false; e.el.classList.remove('dead'); }
    }
    this.drawFocus();
  }

  /** 선택 기물: 현재 대상 연결선 + 이동 목적지 */
  private focusSig = '';
  private drawFocus() {
    const u = this.selId !== null ? this.els.get(this.selId)?.u : undefined;
    if (!u || !u.alive) { if (this.focusSig) { this.svg.innerHTML = ''; this.focusSig = ''; } return; }
    const c = this.centerAt(u);
    let s = '';
    const t = u.target;
    if (t && t.alive) {
      const d = this.centerAt(t);
      s += `<line class="fl-tgt side${u.side}" x1="${c.x}" y1="${c.y}" x2="${d.x}" y2="${d.y}" /><circle class="fl-ring side${u.side}" cx="${d.x}" cy="${d.y}" r="${50 / this.b.w}" />`;
    }
    if (u.moveT > 0) {
      const g = this.center(u);
      s += `<rect class="fl-dest" x="${g.x - 40 / this.b.w}" y="${g.y - 40 / this.b.h}" width="${80 / this.b.w}" height="${80 / this.b.h}" />`;
    }
    if (s !== this.focusSig) { this.svg.innerHTML = s; this.focusSig = s; }
  }

  /** 칸 중앙 (이동 목적지 기준) */
  private center(u: CUnit) { return { x: ((u.x + 0.5) / this.b.w) * 100, y: ((u.y + 0.5) / this.b.h) * 100 }; }
  /** 화면상 현재 위치 (이동 보간) */
  private centerAt(u: CUnit) {
    let x = u.x, y = u.y;
    if (u.moveT > 0 && u.moveDur > 0) { const t = easeOut(1 - u.moveT / u.moveDur); x = u.px + (u.x - u.px) * t; y = u.py + (u.y - u.py) * t; }
    return { x: ((x + 0.5) / this.b.w) * 100, y: ((y + 0.5) / this.b.h) * 100 };
  }
  private dir(a: CUnit, t: CUnit) {
    const dx = t.x - a.x, dy = t.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, d: Math.max(Math.abs(dx), Math.abs(dy)) };
  }

  // ───────── 애니메이션 도우미
  private play(el: Element, kf: Keyframe[], ms: number, opt: KeyframeAnimationOptions = {}, text = false): Animation | null {
    if (!el.animate) return null;
    const a = el.animate(kf, { duration: ms, ...opt }) as Animation & { text?: boolean };
    a.text = text;
    this.anims.add(a);
    this.rateOf(a);
    const done = () => this.anims.delete(a);
    a.finished.then(done, done);
    return a;
  }
  /** 연출 전용 요소: 애니메이션이 끝나면 지운다 */
  private spawnFx(cls: string, x: number, y: number, kf: Keyframe[], ms: number, opt: KeyframeAnimationOptions = {}, html = '', text = false) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.left = `${x}%`; d.style.top = `${y}%`;
    if (html) d.innerHTML = html;
    this.fxLayer.appendChild(d);
    const a = this.play(d, kf, ms, { fill: 'both', ...opt }, text);
    if (a) { const rm = () => d.remove(); a.finished.then(rm, rm); } else d.remove();
    return d;
  }
  private crowd(prio: Prio, rel: boolean) {
    if (prio === 2 || rel) return false;
    const n = this.fxLayer.childElementCount;
    return prio === 0 ? n > 70 : n > 130;
  }
  private rel(...ids: (number | undefined)[]) { return this.selId !== null && ids.includes(this.selId); }

  /** 떠오르는 글자. side: 피해는 가운데, 회복은 오른쪽, 보호막은 왼쪽 */
  private float(u: CUnit, text: string, cls: string, o: { color?: string; prio?: Prio; side?: 'c' | 'l' | 'r'; rel?: boolean; merge?: string; v?: number; fmt?: (v: number) => string } = {}) {
    const prio = o.prio ?? 0, rel = !!o.rel;
    if (o.merge && o.v !== undefined) {
      const m = this.merges.get(o.merge);
      if (m && this.vt < m.until && m.el.isConnected) { m.v += o.v; m.el.textContent = m.fmt(m.v); m.until = this.vt + 0.35; return; }
    }
    if (this.crowd(prio, rel)) return;
    const c = this.centerAt(u);
    // 같은 기물 위 숫자가 겹치지 않도록 세 줄로 번갈아 띄운다
    const lane = (this.lanes.get(u.id) || 0) % 3;
    this.lanes.set(u.id, lane + 1);
    const dx = o.side === 'r' ? 3.2 : o.side === 'l' ? -3.2 : (lane - 1) * 2.2;
    const sel = this.selId !== null;
    const d = this.spawnFx(`ft ${cls}${rel ? ' focus' : sel ? ' dimf' : ''}`, c.x + dx, c.y - 100 / this.b.h * 0.3 - lane * 1.8,
      [{ transform: 'translate(-50%, 20%) scale(1.25)', opacity: 0, easing: EASE_OUT }, { transform: 'translate(-50%, -70%) scale(1)', opacity: 1, offset: 0.2, easing: 'linear' }, { transform: 'translate(-50%, -110%)', opacity: 1, offset: 0.7, easing: 'ease-in' }, { transform: 'translate(-50%, -140%)', opacity: 0 }],
      cls.includes('skb') ? 1500 : 900, { easing: EASE_OUT }, '', true);
    d.textContent = text;
    if (o.color) d.style.color = o.color;
    if (o.merge && o.v !== undefined) this.merges.set(o.merge, { el: d, v: o.v, until: this.vt + 0.35, fmt: o.fmt || ((v) => fmt(v)) });
  }
  /** 머리 위 작은 아이콘 점등 (회복 · 보호막 · 강화를 '누가' 했는지) */
  private casterIcon(u: CUnit, glyph: string, cls: string) {
    const c = this.centerAt(u);
    this.spawnFx(`cic ${cls}`, c.x, c.y - 100 / this.b.h * 0.42, [{ transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%, -80%) scale(1)', opacity: 0 }], 520, {}, glyph);
  }
  /** 토큰 동작: 기물마다 한 번에 하나만. 우선순위가 낮은 동작은 진행 중인 높은 동작을 끊지 않는다
   *  (시전 4 > 근접 공격 3 > 회피 · 반동 2 > 피격 1). 빠르게 정점에 닿은 뒤 감속하며 돌아온다 */
  private motion = new Map<number, { a: Animation; prio: number; t: number }>();
  private move(id: number, peak: Keyframe, ms: number, prio: number, peakAt = 0.22) {
    const e = this.els.get(id);
    if (!e || this.reduced) return;
    const cur = this.motion.get(id);
    if (cur && cur.a.playState === 'running') {
      if (cur.prio > prio) return;
      if (cur.prio === prio && this.vt - cur.t < 0.15) return; // 같은 동작 연타는 하나로
      cur.a.cancel();
    }
    const a = this.play(e.el, [{ transform: 'none', opacity: 1, easing: EASE_IN }, { ...peak, offset: peakAt, easing: EASE_OUT }, { transform: 'none', opacity: 1 }], ms);
    if (a) this.motion.set(id, { a, prio, t: this.vt });
  }
  private flashes = new Map<number, Animation>();
  private flash(id: number, filter: string, ms: number) {
    const e = this.els.get(id);
    if (!e || this.reduced) return;
    this.flashes.get(id)?.cancel();
    const a = this.play(e.face, [{ filter: 'none', easing: EASE_IN }, { filter, offset: 0.15, easing: EASE_OUT }, { filter: 'none' }], ms);
    if (a) this.flashes.set(id, a);
  }
  /** 곡선으로 날아가는 표식 (회복 · 보호막 · 장비) */
  private arc(from: CUnit, to: CUnit, cls: string, startIn: number, dur: number, html = '') {
    if (this.reduced) return;
    const p0 = this.centerAt(from), p1 = this.center(to);
    const mx = (p0.x + p1.x) / 2, my = Math.min(p0.y, p1.y) - 6;
    this.spawnFx(cls, p0.x, p0.y, [
      { left: `${p0.x}%`, top: `${p0.y}%`, opacity: 0.2, transform: 'translate(-50%, -50%) scale(.6)' },
      { left: `${mx}%`, top: `${my}%`, opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.5 },
      { left: `${p1.x}%`, top: `${p1.y}%`, opacity: 1, transform: 'translate(-50%, -50%) scale(.8)' },
    ], dur * 1000, { delay: Math.max(0, startIn) * 1000, easing: EASE_OUT, fill: 'forwards' }, html);
  }

  // ───────── 최근 행동
  private log(id: number, key: string, text: string, v?: number, show?: (v: number) => string) {
    const u = this.els.get(id)?.u;
    if (!u || u.isSummon && u.defId === 'turret') return;
    const arr = this.logs.get(id) || [];
    const last = arr[arr.length - 1];
    if (last && last.key === key && this.vt - last.t < 2) {
      last.t = this.vt;
      if (v !== undefined && show) { last.v = (last.v || 0) + v; last.text = show(last.v); }
      return;
    }
    arr.push({ t: this.vt, key, text: v !== undefined && show ? show(v) : text, v });
    if (arr.length > 6) arr.shift();
    this.logs.set(id, arr);
  }

  // ───────── 이벤트 처리
  private atkCtx: { from: number; to: number; land: number; ranged: boolean } | null = null;
  private skillCtx: { id: number; land: number } | null = null;

  private drain() {
    const evs = this.b.events;
    this.b.events = [];
    for (const e of evs) this.handle(e);
    this.atkCtx = null; this.skillCtx = null;
    for (const u of this.b.units) if (!this.els.has(u.id)) this.mount(u);
  }
  private unit(id: number | undefined) { return id === undefined ? undefined : this.els.get(id)?.u || this.b.units.find((x) => x.id === id); }

  private handle(e: BEvent) {
    switch (e.k) {
      case 'atk': return this.onAtk(e);
      case 'dmg': return this.onDmg(e);
      case 'heal': case 'shield': return this.onSupport(e);
      case 'status': return this.onStatus(e);
      case 'skill': return this.onSkill(e);
      case 'skillEnd': if (this.skillCtx?.id === e.id) this.skillCtx = null; return;
      case 'fx': return this.onArea(e);
      case 'mark': return this.onMark(e);
      case 'gift': return this.onGift(e);
      case 'spawn': return this.onSpawn(e.id);
      case 'die': {
        const u = this.unit(e.id), by = this.unit(e.by);
        if (u && by && by.side !== u.side) this.log(by.id, `kill`, `${u.name} 처치`, 1, (n) => n > 1 ? `적 ${n}명 처치` : `${u.name} 처치`);
        return;
      }
      case 'crash': this.crash(e.side); return;
    }
  }

  /** 기본 공격 · 탄환: 사격은 반동 + 꼬리 달린 탄환, 근접은 대상 방향으로 기울기 */
  private onAtk(e: Extract<BEvent, { k: 'atk' }>) {
    const a = this.unit(e.from), t = this.unit(e.to);
    if (!a || !t) return;
    const v = this.dir(a, t);
    if (!e.ranged) {
      this.atkCtx = { from: e.from, to: e.to, land: this.vt + T_MELEE, ranged: false };
      this.move(e.from, { transform: `translate(${v.x * 30}%, ${v.y * 30}%) rotate(${v.x * 7}deg)` }, 280, 3, 0.3);
      return;
    }
    // 연쇄 탄환: 이 기물에게 날아오는 탄환이 닿은 뒤에 출발
    const start = Math.max(this.vt, this.projLand.get(e.from) ?? 0);
    const fl = flightOf(v.d);
    const land = start + fl;
    this.atkCtx = { from: e.from, to: e.to, land, ranged: true };
    this.projLand.set(e.to, land);
    if (start <= this.vt) this.move(e.from, { transform: `translate(${-v.x * 9}%, ${-v.y * 9}%)` }, 200, 2, 0.15);
    if (this.reduced || this._speed > 4) return;
    if (this.crowd(0, this.rel(e.from, e.to))) return;
    const p0 = start > this.vt ? this.center(a) : this.centerAt(a), p1 = this.center(t);
    const ang = (Math.atan2((p1.y - p0.y) * this.b.h, (p1.x - p0.x) * this.b.w) * 180) / Math.PI;
    const d = this.spawnFx(`proj2${this.rel(e.from, e.to) ? ' focus' : ''}`, p0.x, p0.y, [
      { left: `${p0.x}%`, top: `${p0.y}%`, opacity: 1 }, { left: `${p1.x}%`, top: `${p1.y}%`, opacity: 1 },
    ], fl * 1000, { delay: (start - this.vt) * 1000, easing: EASE_SHOT, fill: 'both' });
    d.style.setProperty('--c', ELEM_COLOR[e.elem]);
    d.style.setProperty('--a', `${ang}deg`);
  }

  private onDmg(e: Extract<BEvent, { k: 'dmg' }>) {
    const u = this.unit(e.id); if (!u) return;
    const src = this.unit(e.src);
    let land = this.vt, ranged = false;
    const ctx = this.atkCtx;
    if (ctx && ctx.to === e.id && (e.tag === 'basic' || e.tag === 'skill' || e.tag === 'proc')) { land = ctx.land; ranged = ctx.ranged; this.atkCtx = null; }
    else if (this.skillCtx && e.src === this.skillCtx.id && e.tag !== 'dot') land = this.skillCtx.land;
    const rel = this.rel(e.id, e.src);
    const dot = e.tag === 'dot';
    this.delta(e.id, e.dhp || 0, e.dsh || 0, land, () => {
      const v = src && src !== u ? this.dir(src, u) : { x: 0, y: -1, d: 0 };
      if (e.miss && !e.graze) {
        // 완전 회피: 비켜서는 동작만 (피격 섬광 없음)
        this.move(e.id, { transform: `translate(${-v.y * 24}%, ${v.x * 24}%)`, opacity: 0.55 }, 320, 2, 0.2);
        this.float(u, '회피', 'miss', { rel });
        return;
      }
      if (e.v < 1) return;
      const c = this.center(u);
      if (!dot) {
        this.move(e.id, { transform: `translate(${v.x * 8}%, ${v.y * 8}%) scale(${e.graze ? '.96, .94' : '.9, .84'})` }, 240, 1, 0.12);
        if (!e.graze) this.flash(e.id, 'brightness(1.6)', 180);
        if (!this.crowd(0, rel)) {
          if (ranged || e.tag === 'skill') this.spawnFx('impact', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 }], 240).style.setProperty('--c', ELEM_COLOR[e.elem]);
          else if (src) { const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI + 90; const d = this.spawnFx('slash', c.x, c.y, [{ transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.45 }, { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1.1)`, opacity: 0 }], 220); d.style.setProperty('--c', ELEM_COLOR[e.elem]); }
        }
      } else if (e.syn === 'SCHEME') {
        // 암운 맥동
        const st = this.els.get(e.id)?.stk.querySelector('.stk-gloom');
        if (st) this.play(st, [{ transform: 'scale(1)' }, { transform: 'scale(1.5)', filter: 'brightness(1.8)', offset: 0.3 }, { transform: 'scale(1)' }], 320);
        this.flash(e.id, 'brightness(.7) saturate(1.6) hue-rotate(250deg)', 260);
      }
      // 보호막 파괴
      if ((e.dsh || 0) < 0 && u.shield - (this.lagSh.get(e.id) || 0) <= 0.5) {
        this.spawnFx('shbreak', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], 380);
        this.float(u, '보호막 파괴', 'mark-sh', { prio: 2, rel });
      }
      const basic = e.tag === 'basic' && !e.crit;
      const txt = (e.graze ? '찰과 ' : '') + fmt(e.v) + (e.crit ? '!' : '');
      if (dot) this.float(u, fmt(e.v), 'dot', { color: ELEM_COLOR[e.elem], rel, merge: `dot:${e.id}:${e.elem}`, v: e.v });
      else this.float(u, txt, e.crit ? 'crit' : e.graze ? 'graze' : basic ? 'dmg sm' : 'dmg', { color: ELEM_COLOR[e.elem], rel, prio: basic ? 0 : 1 });
    });
  }

  /** 회복 · 보호막: 제공자 점등 → 곡선 표식 → 대상 반응 */
  private onSupport(e: Extract<BEvent, { k: 'heal' | 'shield' }>) {
    const u = this.unit(e.id); if (!u) return;
    const src = this.unit(e.src);
    const heal = e.k === 'heal';
    const rel = this.rel(e.id, e.src);
    const other = !!src && src !== u;
    let land = this.vt;
    if (other) {
      const start = this.skillCtx && this.skillCtx.id === src!.id ? T_SKILL * 0.5 : 0;
      land = this.vt + start + T_SUPPORT;
      // 같은 제공자 → 대상 표식은 짧은 간격으로 한 번만
      const k = `${heal ? 'h' : 's'}:${src!.id}>${e.id}`;
      if ((this.statusSeen.get(k) ?? -9) < this.vt - 0.5 && !this.crowd(1, rel)) {
        this.statusSeen.set(k, this.vt);
        this.casterIcon(src!, heal ? '+' : '◇', heal ? 'heal' : 'shield');
        this.arc(src!, u, `orb ${heal ? 'heal' : 'shield'}`, start, T_SUPPORT);
      }
      if (src!.side === u.side) {
        // 제공자 쪽: 여러 대상은 한 줄로 묶는다 (아군 3명 회복 +120)
        const arr = this.logs.get(src!.id) || [];
        const last = arr[arr.length - 1];
        const key = `${e.k}>`;
        if (last && last.key === key && this.vt - last.t < 1.5) { last.t = this.vt; last.v = (last.v || 0) + e.v; last.ids!.add(e.id); }
        else { arr.push({ t: this.vt, key, text: '', v: e.v, ids: new Set([e.id]) }); if (arr.length > 6) arr.shift(); this.logs.set(src!.id, arr); }
        const l = arr[arr.length - 1];
        const who = l.ids!.size > 1 ? `아군 ${l.ids!.size}명` : u.name;
        l.text = heal ? `${who} 회복 +${fmt(l.v!)}` : `${who}에게 보호막 ${fmt(l.v!)}`;
        this.log(u.id, `${e.k}<${src!.id}`, '', e.v, (v) => heal ? `${src!.name}의 회복 +${fmt(v)}` : `${src!.name}의 보호막 ${fmt(v)}`);
      }
    }
    this.delta(e.id, heal ? (e.dhp ?? e.v) : 0, heal ? 0 : (e.dsh ?? e.v), land, () => {
      const c = this.center(u);
      if (heal) {
        if (other || e.v >= this.b.S(u, 'maxHp') * 0.05) this.flash(e.id, 'brightness(1.35) drop-shadow(0 0 6px var(--good))', 320);
        if (other && !this.crowd(1, rel)) for (let i = 0; i < 2; i++) this.spawnFx('rise', c.x + (i ? 1.6 : -1.6), c.y, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-260%)', opacity: 0 }], 520, { delay: i * 90 });
        this.float(u, '+' + fmt(e.v), 'heal', { side: 'r', rel, prio: other ? 1 : 0, merge: `heal:${e.id}`, v: e.v, fmt: (v) => '+' + fmt(v) });
      } else {
        this.spawnFx('shring', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(1.45)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], 420);
        this.float(u, '◇' + fmt(e.v), 'shield', { side: 'l', rel, prio: other ? 1 : 0, merge: `sh:${e.id}`, v: e.v, fmt: (v) => '◇' + fmt(v) });
      }
    });
  }

  private onStatus(e: Extract<BEvent, { k: 'status' }>) {
    const u = this.unit(e.id); if (!u) return;
    const src = this.unit(e.src);
    const rel = this.rel(e.id, e.src);
    // 같은 표시는 1.2초에 한 번
    const k = `st:${e.id}:${e.name}`;
    if ((this.statusSeen.get(k) ?? -9) > this.vt - 1.2) return;
    this.statusSeen.set(k, this.vt);
    const at = this.skillCtx && e.src === this.skillCtx.id ? this.skillCtx.land : this.vt;
    if (src && src !== u) {
      if (e.harm) this.log(src.id, `inf:${e.id}:${e.name}`, `${u.name}에게 ${e.name}`);
      else { this.log(src.id, `buf:${e.id}:${e.name}`, `${u.name}에게 ${e.name} 부여`); this.log(u.id, `bufr:${src.id}:${e.name}`, `${src.name}의 ${e.name}`); }
    }
    this.later(at, () => {
      if (!e.harm && src && src !== u && e.stype === 'buff') {
        // 버프: 얇은 파동 → 대상 머리 위에 아이콘 착지
        const c = this.center(u);
        this.spawnFx('buffland', c.x, c.y - 100 / this.b.h * 0.42, [{ transform: 'translate(-50%,-180%)', opacity: 0 }, { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-50%)', opacity: 0 }], 600, {}, '▲');
      }
      this.float(u, e.name, e.harm ? 'status harm' : 'status', { prio: 2, rel });
    });
  }

  private onSkill(e: Extract<BEvent, { k: 'skill' }>) {
    const u = this.unit(e.id); if (!u) return;
    this.skillCtx = { id: e.id, land: this.vt + T_SKILL };
    const ee = this.els.get(e.id);
    if (ee && !this.reduced) {
      this.play(ee.face, [{ boxShadow: '0 0 0 0 var(--accent)' }, { boxShadow: '0 0 0 3px var(--accent), 0 0 16px var(--accent)', offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], 420);
      this.move(e.id, { transform: 'translate(0,-10%) scale(1.07)' }, 380, 4, 0.25);
    }
    // 설명은 처음 발동했을 때와 선택한 기물에만
    const first = !this.castSeen.has(e.id);
    this.castSeen.add(e.id);
    const showTag = !!e.tag && (first || this.rel(e.id));
    this.log(e.id, `sk:${e.name}`, `${e.name}${e.tag ? ` · ${e.tag}` : ''} 발동`, 1, (n) => `${e.name}${e.tag ? ` · ${e.tag}` : ''} 발동${n > 1 ? ` ×${n}` : ''}`);
    if (this.crowd(2, false)) return;
    const c = this.centerAt(u);
    const d = this.spawnFx(`skb${this.rel(e.id) ? ' focus' : this.selId !== null ? ' dimf' : ''}`, c.x, c.y - 100 / this.b.h * 0.55,
      [{ transform: 'translate(-50%, -30%)', opacity: 0 }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%, -100%)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%, -150%)', opacity: 0 }],
      1500, { easing: EASE_OUT }, `<b></b>${showTag ? '<small></small>' : ''}`, true);
    d.querySelector('b')!.textContent = e.name;
    if (showTag) d.querySelector('small')!.textContent = e.tag!;
  }

  /** 범위: 공격 = 터지는 원 · 회복 = 부드러운 빛 · 강화 = 점선 고리 */
  private onArea(e: Extract<BEvent, { k: 'fx' }>) {
    if (this.reduced) return;
    const at = this.skillCtx ? this.skillCtx.land : this.vt;
    this.later(at, () => {
      if (this.crowd(1, false)) return;
      const { w, h } = this.b;
      const kind = e.kind || 'atk';
      const sw = ((2 * e.r + 1) / w) * 100, sh = ((2 * e.r + 1) / h) * 100;
      const d = this.spawnFx(`area2 ${kind}`, ((e.x + 0.5) / w) * 100, ((e.y + 0.5) / h) * 100,
        kind === 'buff' ? [{ transform: 'translate(-50%,-50%) scale(1.3) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }]
          : kind === 'heal' ? [{ transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 }]
            : [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 0 }], 520);
      d.style.width = `${sw}%`; d.style.height = `${sh}%`;
      d.style.setProperty('--c', ELEM_COLOR[e.elem]);
    });
  }

  /** 부활 · 시간 역행 · 처형 · 불사: 숫자보다 고유 표식 */
  private onMark(e: Extract<BEvent, { k: 'mark' }>) {
    const u = this.unit(e.id); if (!u) return;
    const c = this.center(u);
    const at = Math.max(this.vt, this.projLand.get(e.id) ?? 0);
    if (e.style !== 'execute') this.log(e.id, `mk:${e.name}`, `${e.name}${e.style === 'immortal' ? '로 버팀' : '으로 부활'}`);
    this.later(at, () => {
      if (e.style === 'rewind') {
        this.spawnFx('rewind', c.x, c.y, [{ transform: 'translate(-50%,-50%) rotate(0) scale(1.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(-300deg) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) rotate(-360deg) scale(.9)', opacity: 0 }], 800);
        const ee = this.els.get(e.id);
        if (ee) this.play(ee.face, [{ filter: 'grayscale(1) brightness(.6)', transform: 'rotate(25deg)' }, { filter: 'grayscale(.4)', transform: 'rotate(-8deg)', offset: 0.6 }, { filter: 'none', transform: 'rotate(0)' }], 700, { composite: 'add' } as KeyframeAnimationOptions);
      } else if (e.style === 'revive') {
        this.spawnFx('pillar', c.x, c.y, [{ transform: 'translate(-50%,-100%) scaleY(0)', opacity: 0 }, { transform: 'translate(-50%,-100%) scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-100%) scaleY(1)', opacity: 0 }], 900);
        const ee = this.els.get(e.id);
        if (ee) this.play(ee.face, [{ opacity: 0.2, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], 600, { composite: 'add' } as KeyframeAnimationOptions);
      } else if (e.style === 'execute') {
        this.spawnFx('exec', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], 700, {}, '✕');
      } else {
        this.spawnFx('shring gold', c.x, c.y, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], 600);
      }
      this.float(u, e.name, `mark ${e.style}`, { prio: 2, rel: this.rel(e.id) });
    });
  }

  /** 장비 지급: 장비 아이콘이 제공자에게서 대상에게 날아가 붙는다 */
  private onGift(e: Extract<BEvent, { k: 'gift' }>) {
    const a = this.unit(e.from), t = this.unit(e.to); if (!a || !t) return;
    const nm = itemInfo(e.item).name;
    this.log(e.from, `gift:${e.to}:${e.item}`, `${t.name}에게 ${nm} 지급`);
    if (a !== t) this.log(e.to, `giftr:${e.item}`, `${a.name}에게서 ${nm} 받음`);
    const start = this.skillCtx?.id === e.from ? T_SKILL : 0, dur = 0.45;
    this.arc(a, t, 'gift-fly', start, dur, this.itemHtml(e.item));
    this.later(this.vt + start + dur, () => {
      const ee = this.els.get(e.to);
      if (ee) this.play(ee.face, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'scale(1)' }], 300, { composite: 'add' } as KeyframeAnimationOptions);
      this.float(t, nm, 'status gift', { prio: 2, rel: this.rel(e.from, e.to) });
    });
  }

  private onSpawn(id: number) {
    const u = this.unit(id); if (!u) return;
    const ee = this.els.get(id);
    if (ee?.dead && u.alive) { ee.dead = false; ee.el.classList.remove('dead'); }
    if (!ee || this.reduced) return;
    if (u.defId === 'turret') {
      // 포탑 설치: 내려앉으며 공구 문양
      this.play(ee.el, [{ transform: 'translateY(-40%) scale(.5)', opacity: 0 }, { transform: 'translateY(4%) scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], 380);
      const c = this.center(u);
      this.spawnFx('tool', c.x, c.y, [{ transform: 'translate(-50%,-50%) rotate(-90deg) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(0) scale(1.2)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-80%) rotate(30deg) scale(1)', opacity: 0 }], 650, {}, '⚙');
    } else this.play(ee.el, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 300);
  }

  /** 스텔라레이서: 경기장 밖 비행선이 대각선으로 적진 한가운데에 내리꽂힌 뒤 섬광 · 충격파 · 화면 흔들림 */
  private crash(side: 0 | 1, late = false) {
    if (this.reduced) return;
    if (!late && this.b.t < 0.3) { setTimeout(() => this.crash(side, true), 750); return; } // 전투 개시 배너가 걷힌 뒤에 보이도록
    const foes = this.b.units.filter((u) => u.alive && u.side !== side);
    if (!foes.length) return;
    const cx = foes.reduce((s, u) => s + this.center(u).x, 0) / foes.length, cy = foes.reduce((s, u) => s + this.center(u).y, 0) / foes.length;
    const sx = cx < 50 ? cx + 70 : cx - 70, sy = side === 0 ? -25 : 125;
    const ang = (Math.atan2(cy - sy, cx - sx) * 180) / Math.PI;
    const fly = 520 / Math.min(Math.max(this._speed, 0.25), 4);
    const ship = document.createElement('div');
    ship.className = 'crash-ship';
    ship.style.setProperty('--a', `${ang}deg`);
    this.fxLayer.appendChild(ship);
    ship.animate([{ left: `${sx}%`, top: `${sy}%`, opacity: 0.4 }, { left: `${cx}%`, top: `${cy}%`, opacity: 1 }], { duration: fly, easing: 'cubic-bezier(.5, 0, .9, .6)', fill: 'forwards' });
    setTimeout(() => {
      ship.remove();
      const boom = document.createElement('div');
      boom.className = 'crash-boom';
      boom.style.left = `${cx}%`; boom.style.top = `${cy}%`;
      this.fxLayer.appendChild(boom);
      setTimeout(() => boom.remove(), 900);
      const view = this.board.parentElement;
      if (view) { view.classList.remove('crash-shake'); void view.offsetWidth; view.classList.add('crash-shake'); setTimeout(() => view.classList.remove('crash-shake'), 450); }
    }, fly);
  }
}
