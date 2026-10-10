import { CFG } from '../config';
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

interface UEl { el: HTMLElement; hp: HTMLElement; sh: HTMLElement; cd: HTMLElement; u: CUnit; dead: boolean }

/** 전투를 실시간으로 진행하며 보드 위 DOM 을 갱신한다 */
export class BattleView {
  speed = 1;
  private els = new Map<number, UEl>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private fxLayer: HTMLElement;
  private ended = false;
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private board: HTMLElement, public b: Battle, private onTick: () => void, private onEnd: () => void) {
    this.fxLayer = document.createElement('div');
    this.fxLayer.className = 'fx-layer';
    board.appendChild(this.fxLayer);
    for (const u of b.units) this.mount(u);
    this.sync();
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= CFG.tick && !this.b.over && steps < 200) { this.b.step(CFG.tick); this.acc -= CFG.tick; steps++; }
      this.drain();
      this.sync();
      this.onTick();
      if (this.b.over) { this.finish(); return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  skip() {
    this.b.keepEvents = false;
    this.b.events.length = 0;
    this.b.runToEnd();
    this.sync();
    this.finish();
  }

  destroy() { cancelAnimationFrame(this.raf); }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.onTick();
    setTimeout(() => this.onEnd(), this.b.keepEvents ? 500 : 0);
  }

  private pos(x: number, y: number) {
    const n = this.b.n;
    return { left: `${(x / n) * 100}%`, top: `${(y / n) * 100}%` };
  }

  private mount(u: CUnit) {
    const el = document.createElement('div');
    el.className = `u side${u.side}${u.big ? ' big' : ''}${u.isBoss ? ' boss' : ''}`;
    el.style.width = el.style.height = `${100 / this.b.n}%`;
    el.innerHTML = `<div class="bars"><i class="hp"></i><i class="sh"></i></div><img alt="" class="${hasPortrait(u) ? 'pt' : ''}" src="${iconURL(u)}"><div class="cd"><i></i></div>`;
    this.board.appendChild(el);
    this.els.set(u.id, { el, hp: el.querySelector('.hp')!, sh: el.querySelector('.sh')!, cd: el.querySelector('.cd i')!, u, dead: false });
  }

  private sync() {
    for (const [, e] of this.els) {
      const u = e.u;
      let x = u.x, y = u.y;
      if (u.moveT > 0 && u.moveDur > 0) {
        const t = 1 - u.moveT / u.moveDur;
        x = u.px + (u.x - u.px) * t;
        y = u.py + (u.y - u.py) * t;
      }
      const p = this.pos(x, y);
      e.el.style.left = p.left;
      e.el.style.top = p.top;
      const max = this.b.S(u, 'maxHp');
      e.hp.style.width = `${Math.max(0, (u.hp / max) * 100)}%`;
      e.sh.style.width = `${Math.min(100, (u.shield / max) * 100)}%`;
      e.cd.style.width = u.cdMax ? `${Math.max(0, Math.min(100, (1 - u.cd / u.cdMax) * 100))}%` : '0';
      e.el.classList.toggle('stunned', u.alive && u.statuses.some((s) => s.type === 'stun'));
      e.el.classList.toggle('feared', u.alive && u.statuses.some((s) => s.type === 'fear'));
      e.el.classList.toggle('shocked', u.alive && u.statuses.some((s) => s.type === 'shock'));
      if (!u.alive && !e.dead) { e.dead = true; e.el.classList.add('dead'); }
    }
  }

  private center(u: CUnit) { return { x: ((u.x + 0.5) / this.b.n) * 100, y: ((u.y + 0.5) / this.b.n) * 100 }; }

  private float(u: CUnit, text: string, cls: string, color?: string) {
    if (this.fxLayer.childElementCount > 120) return;
    const c = this.center(u);
    const d = document.createElement('div');
    d.className = `ft ${cls}`;
    d.textContent = text;
    d.style.left = `${c.x + (Math.random() - 0.5) * 6}%`;
    d.style.top = `${c.y - 4}%`;
    if (color) d.style.color = color;
    this.fxLayer.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  private drain() {
    const evs = this.b.events;
    this.b.events = [];
    const byId = (id: number) => this.els.get(id)?.u;
    for (const e of evs) this.handle(e, byId);
    for (const u of this.b.units) if (!this.els.has(u.id)) this.mount(u);
  }

  private handle(e: BEvent, byId: (id: number) => CUnit | undefined) {
    switch (e.k) {
      case 'dmg': {
        const u = byId(e.id); if (!u) return;
        if (e.miss && !e.graze) this.float(u, '회피', 'miss');
        else if (e.v >= 1) this.float(u, (e.graze ? '찰과 ' : '') + fmt(e.v) + (e.crit ? '!' : ''), e.crit ? 'crit' : e.graze ? 'graze' : 'dmg', ELEM_COLOR[e.elem]);
        const el = this.els.get(e.id)?.el;
        if (el && !this.reduced) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
        break;
      }
      case 'heal': { const u = byId(e.id); if (u) this.float(u, '+' + fmt(e.v), 'heal'); break; }
      case 'shield': { const u = byId(e.id); if (u) this.float(u, '◇' + fmt(e.v), 'shield'); break; }
      case 'status': { const u = byId(e.id); if (u) this.float(u, e.name, 'status'); break; }
      case 'skill': {
        const u = byId(e.id); if (!u) return;
        this.float(u, e.name, 'skill');
        break;
      }
      case 'atk': {
        const a = byId(e.from), t = byId(e.to); if (!a || !t) return;
        if (!e.ranged) {
          const el = this.els.get(e.from)?.el;
          if (el && !this.reduced) { el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge'); }
          return;
        }
        if (this.reduced || this.speed > 4) return;
        const p0 = this.center(a), p1 = this.center(t);
        const d = document.createElement('div');
        d.className = 'proj';
        d.style.background = ELEM_COLOR[e.elem];
        d.style.left = `${p0.x}%`; d.style.top = `${p0.y}%`;
        this.fxLayer.appendChild(d);
        const dur = 160 / this.speed;
        d.animate([{ left: `${p0.x}%`, top: `${p0.y}%` }, { left: `${p1.x}%`, top: `${p1.y}%` }], { duration: dur, easing: 'linear' });
        setTimeout(() => d.remove(), dur);
        break;
      }
      case 'fx': {
        if (this.fxLayer.childElementCount > 120) return;
        const n = this.b.n;
        const d = document.createElement('div');
        d.className = 'area';
        const size = ((2 * e.r + 1) / n) * 100;
        d.style.width = d.style.height = `${size}%`;
        d.style.left = `${((e.x + 0.5) / n) * 100 - size / 2}%`;
        d.style.top = `${((e.y + 0.5) / n) * 100 - size / 2}%`;
        d.style.borderColor = ELEM_COLOR[e.elem];
        this.fxLayer.appendChild(d);
        setTimeout(() => d.remove(), 600);
        break;
      }
      default: break;
    }
  }
}
