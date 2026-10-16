// 전투 피드: 보드 위에 띄우던 스킬 이름 배너를 보드 밖 줄 목록으로 옮긴다.
//   · 스킬 피드 (왼쪽 피해 미터 아래): 기물 전투 기술 · 비술 사용
//   · 사건 피드 (오른쪽 패널, 고른 기물이 없을 때): 궁극기 · 신권 대행 · 부활 · 쓰러짐 · 소환 · 시너지 발동 등 큰 사건
// 좁은 화면 (피해 미터가 보드 아래로 접히는 배치)에서는 스킬 줄도 보드 바로 아래 사건 피드에 함께 쌓는다.
// 줄 하나 = 초상화 · 편(아군 / 적) 색 띠 · 이름. 새 줄은 위에 쌓이고, 오래된 줄은 흐려지다 사라진다.
// 같은 기물이 같은 것을 잇달아 쓰면 새 줄 대신 ×n 을 올린다 (DOM 갱신 최소).
import type { CUnit } from '../engine/combat';
import { hasPortrait, iconURL } from './portraits';

export interface FeedItem {
  /** 줄 종류 (CSS k-*): skill · cantrip · ult · div · revive · rewind · immortal · die · spawn · syn · event · gift */
  kind: string;
  u: CUnit;
  /** 큰 글씨 (스킬 · 사건 이름) */
  title: string;
  /** 사건 종류 표시 (궁극기 · 부활 등). 없으면 생략 */
  label?: string;
  /** 작은 글씨 (기물 이름 · 설명) */
  sub?: string;
  /** 같은 줄로 합칠 기준 (없으면 kind + 기물 + 이름) */
  key?: string;
  /** 줄 앞 작은 아이콘 HTML (학파 아이콘 등) */
  icon?: string;
  /** 데이터 색 (학파 색 등, --c) */
  color?: string;
  /** 전투 시각 (초): 사건 피드에만 표시 */
  t?: number;
}

type Play = (el: Element, kf: Keyframe[], ms: number, opt?: KeyframeAnimationOptions) => Animation | null;
interface Line { li: HTMLElement; n: number; at: number; fade: Animation | null }

/** 피드 목록 하나. 호스트는 id 로 찾는다 (전투 화면이 다시 그려져도 새 요소를 다시 찾음) */
export class FeedList {
  private lines = new Map<string, Line>();
  private el: HTMLElement | null = null;
  constructor(private id: string, private max: () => number, private play: Play) {}

  host(): HTMLElement | null {
    if (!this.el || !this.el.isConnected) { this.el = document.getElementById(this.id); this.lines.clear(); }
    return this.el;
  }

  /** now = 실시간 시계 (초, 정지 중 멈춤) · life = 줄이 머무는 시간 (ms, 끝 무렵 흐려짐) */
  push(it: FeedItem, now: number, life: number, focus: boolean, reduced: boolean) {
    const h = this.host();
    if (!h) return;
    const key = it.key || `${it.kind}|${it.u.id}|${it.title}`;
    const old = this.lines.get(key);
    if (old && old.li.isConnected && now - old.at < 2.5) {
      // 잇단 사용: ×n 만 올리고 맨 위로
      old.n++; old.at = now;
      const n = old.li.querySelector('.bf-n');
      if (n) n.textContent = `×${old.n}`;
      if (h.firstElementChild !== old.li) h.prepend(old.li);
      this.age(old, life, reduced, false);
      if (!reduced) this.play(old.li, [{ scale: '1.04' }, { scale: '1' }], 220);
      return;
    }
    const li = document.createElement('li');
    const u = it.u;
    li.className = `bf-ln s${u.side} k-${it.kind}${focus ? ' focus' : ''}`;
    li.dataset.a = 'bsel';
    li.dataset.v = String(u.id);
    if (it.color) li.style.setProperty('--c', it.color);
    const pt = `<img alt="" class="bf-pt${hasPortrait(u) ? '' : ' px'}" src="${iconURL(u)}">`;
    li.innerHTML = `${pt}<span class="bf-tx">${it.label ? '<i class="bf-k"></i>' : ''}${it.icon || ''}<b></b>${it.sub ? '<small></small>' : ''}</span><em class="bf-n"></em>${it.t !== undefined ? `<time class="bf-t">${it.t.toFixed(1)}초</time>` : ''}`;
    // 이름 · 설명은 글자로만 넣는다 (데이터 문자열을 HTML 로 해석하지 않음)
    if (it.label) li.querySelector('.bf-k')!.textContent = it.label;
    li.querySelector('b')!.textContent = it.title;
    if (it.sub) li.querySelector('small')!.textContent = it.sub;
    h.prepend(li);
    const ln: Line = { li, n: 1, at: now, fade: null };
    this.lines.set(key, ln);
    if (!reduced) this.play(li, [{ translate: '-10px 0' }, { translate: '0 0' }], 200);
    this.age(ln, life, reduced, true);
    // 넘치면 가장 오래된 줄부터
    const cap = this.max();
    while (h.childElementCount > cap) this.drop(h.lastElementChild as HTMLElement);
  }

  /** 흐려지기 시작 → 사라짐 (정지하면 멈춘다: play 가 전투 배속 · 정지를 따름) */
  private age(ln: Line, life: number, reduced: boolean, fresh: boolean) {
    ln.fade?.cancel();
    const kf: Keyframe[] = [{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: reduced ? 1 : 0.38, offset: 0.92 }, { opacity: 0 }];
    if (fresh && !reduced) kf.splice(0, 1, { opacity: 0 }, { opacity: 1, offset: Math.min(0.2, 180 / life) });
    const a = this.play(ln.li, kf, life, { fill: 'forwards' });
    ln.fade = a;
    if (a) a.finished.then(() => { if (ln.fade === a) this.drop(ln.li); }, () => {});
    else setTimeout(() => this.drop(ln.li), life);
  }

  private drop(li: HTMLElement | null) {
    if (!li) return;
    for (const [k, l] of this.lines) if (l.li === li) { l.fade?.cancel(); this.lines.delete(k); break; }
    li.remove();
  }

  /** 고른 기물의 줄 강조 */
  focus(id: number | null) {
    const h = this.host();
    if (!h) return;
    for (const li of Array.from(h.children) as HTMLElement[]) li.classList.toggle('focus', id !== null && li.dataset.v === String(id));
  }
}
