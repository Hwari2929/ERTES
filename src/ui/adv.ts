// 미연시(ADV) 화면: 배경 · 스탠딩(좌 · 중 · 우) · 이름표 · 대사창. 클릭 · 스페이스로 한 줄씩 넘긴다.
// render() 와 따로 document.body 위에 떠 있으며, 끝나면 선택지 · 확인 버튼을 대사창 자리에 띄운다.
import type { Beat, Face, Pos } from '../data/scene';
import { BGS } from '../data/scene';
import { bgURL, standURL } from './portraits';
import * as SND from './sound';

export interface AdvChoice { label: string; desc?: string; why?: string }
export interface AdvOpts {
  /** 장면 제목 (첫 화면 위쪽에 잠깐) */
  title?: string;
  /** 끝에 띄울 선택지. 없으면 '확인' 하나 */
  choices?: AdvChoice[];
  /** 끝에 선택지 대신 보여 줄 결과 문구 */
  result?: string;
  /** 화자 이름 · 색 · 스탠딩 id */
  speaker: (id: string) => { name: string; color: string; stand?: string | null };
  /** 선택 (확인만 있으면 0) */
  onDone: (choice: number) => void;
  /** 대사 문자열을 HTML 로 (아이콘 치환 등). 기본은 이스케이프만 */
  fmt?: (s: string) => string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** 표정 차분이 있는 인물 → 표정 목록 (art/<id>.<face>.webp). 지금은 모두 기본 스탠딩을 쓴다 (차분은 직접 받아서 추가) */
export const FACE_VARIANTS: Record<string, Face[]> = {};
const faceURL = (stand: string, face?: Face) => {
  const base = standURL(stand);
  if (!base || !face || face === 'base' || !FACE_VARIANTS[stand]?.includes(face)) return base;
  return base.replace(/\.webp$/, `.${face}.webp`);
};

let cur: { el: HTMLElement; key: string } | null = null;
/** 지금 떠 있는 장면의 키 (같은 장면을 다시 열지 않게) */
export const advKey = () => cur?.key ?? null;
export function closeAdv() { cur?.el.remove(); cur = null; }

export function playAdv(key: string, beats: Beat[], o: AdvOpts) {
  if (cur?.key === key) return;
  closeAdv();
  const fmt = o.fmt ?? esc;
  const el = document.createElement('div');
  el.className = 'adv';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="adv-bg"></div><div class="adv-shade"></div>
    <div class="adv-stage"><div class="adv-slot" data-pos="L"></div><div class="adv-slot" data-pos="C"></div><div class="adv-slot" data-pos="R"></div></div>
    <div class="adv-place" hidden></div>
    ${o.title ? `<div class="adv-title">${esc(o.title)}</div>` : ''}
    <div class="adv-tools"><button data-x="log">로그</button><button data-x="auto">자동</button><button data-x="skip">건너뛰기</button></div>
    <div class="adv-box"><span class="adv-name" hidden></span><p class="adv-text"></p><span class="adv-next" aria-hidden="true">▼</span></div>
    <div class="adv-end" hidden></div>
    <div class="adv-log" hidden><div class="adv-log-in"></div><button data-x="log-close" class="btn">닫기</button></div>`;
  document.body.appendChild(el);
  cur = { el, key };
  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q)!;
  const box = $('.adv-box'), nameEl = $('.adv-name'), textEl = $('.adv-text'), endEl = $('.adv-end');
  const on = new Map<string, Pos>(); // 무대 위 인물 → 위치
  const faces = new Map<string, Face | undefined>();
  const logLines: string[] = [];
  let i = -1, typing = 0, full = '', auto = false, autoT = 0, bg = '', done = false;

  const slot = (p: Pos) => el.querySelector<HTMLElement>(`.adv-slot[data-pos="${p}"]`)!;
  function place(id: string, p: Pos, face?: Face) {
    const sp = o.speaker(id);
    if (!sp.stand) return;
    const prev = on.get(id);
    if (prev && prev !== p) slot(prev).innerHTML = '';
    for (const [k, q] of on) if (q === p && k !== id) on.delete(k); // 같은 자리의 다른 인물은 내려간다
    on.set(id, p);
    if (face !== undefined) faces.set(id, face);
    const s = slot(p);
    const url = faceURL(sp.stand, faces.get(id)), base = standURL(sp.stand);
    const img = s.querySelector<HTMLImageElement>('img');
    if (img && img.dataset.id === id) { if (img.getAttribute('src') !== url) img.src = url!; return; }
    s.innerHTML = `<img data-id="${id}" alt="" src="${url}" onerror="if(this.src!=='${base}'){this.src='${base}'}">`;
  }
  function exit(ids: string[]) { for (const id of ids) { const p = on.get(id); if (p) { slot(p).innerHTML = ''; on.delete(id); } } }
  function setBg(k: string) {
    if (k === bg) return;
    bg = k;
    $('.adv-bg').style.backgroundImage = `url('${bgURL(k)}')`;
    const pl = $('.adv-place');
    pl.textContent = (BGS[k] || k).split(' — ')[0];
    pl.hidden = false; pl.classList.remove('show'); void pl.offsetWidth; pl.classList.add('show');
  }
  function fx(f?: string) {
    if (!f) return;
    el.classList.remove(`fx-${f}`); void el.offsetWidth; el.classList.add(`fx-${f}`);
    setTimeout(() => el.classList.remove(`fx-${f}`), 900);
  }
  function type() {
    clearInterval(typing);
    let n = 0;
    const chars = [...full];
    textEl.innerHTML = '';
    typing = window.setInterval(() => {
      n += 2;
      textEl.innerHTML = fmt(chars.slice(0, n).join(''));
      if (n >= chars.length) finishType();
    }, 22);
  }
  function finishType() {
    clearInterval(typing); typing = 0;
    textEl.innerHTML = fmt(full);
    box.classList.add('ready');
    if (auto) { clearTimeout(autoT); autoT = window.setTimeout(next, 900 + full.length * 35); }
  }
  function show(b: Beat) {
    if (b.bg) setBg(b.bg);
    for (const s of b.stage || []) place(s.id, s.at, s.face);
    if (b.who) {
      const p = b.at ?? on.get(b.who) ?? (on.size ? (['L', 'R', 'C'] as Pos[]).find((q) => ![...on.values()].includes(q)) ?? 'C' : 'C');
      place(b.who, p, b.face);
    }
    // 말하는 사람만 밝게
    el.querySelectorAll<HTMLElement>('.adv-slot').forEach((s) => {
      const id = s.querySelector('img')?.dataset.id;
      s.classList.toggle('talk', !!b.who && id === b.who && !b.think);
      s.classList.toggle('dim', !!b.who && id !== b.who);
    });
    const sp = b.who ? o.speaker(b.who) : null;
    const nm = b.name || sp?.name || '';
    nameEl.hidden = !nm;
    nameEl.textContent = nm;
    nameEl.style.setProperty('--c', sp?.color || 'var(--dim)');
    box.className = `adv-box${b.think ? ' think' : ''}${b.who ? '' : ' narr'}`;
    full = b.text;
    logLines.push(`${nm ? `<b style="--c:${sp?.color || 'var(--dim)'}">${esc(nm)}</b>` : ''}<span class="${b.think ? 'think' : b.who ? '' : 'narr'}">${fmt(b.text)}</span>`);
    fx(b.fx);
    if (b.sfx) SND.scene(b.sfx); // 효과음: 이 줄의 sfx 태그 (합성음 근사)
    type();
    if (b.exit) setTimeout(() => exit(b.exit === true ? (b.who ? [b.who] : []) : b.exit as string[]), 0);
  }
  function end() {
    if (done) return;
    done = true; clearTimeout(autoT); clearInterval(typing);
    if (full) textEl.innerHTML = fmt(full);
    box.classList.add('ended');
    const ch = o.choices?.length ? o.choices : null;
    endEl.innerHTML = `${o.result ? `<p class="adv-result">${fmt(o.result)}</p>` : ''}${ch
      ? ch.map((c, k) => `<button class="adv-choice" data-c="${k}" ${c.why ? 'disabled' : ''}><b>${fmt(c.label)}</b>${c.desc ? `<span>${fmt(c.desc)}</span>` : ''}${c.why ? `<span class="down small">${esc(c.why)}</span>` : ''}</button>`).join('')
      : '<button class="adv-choice ok" data-c="0"><b>확인</b></button>'}`;
    endEl.hidden = false;
    endEl.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }
  function next() {
    if (done) return;
    if (typing) { finishType(); return; }
    clearTimeout(autoT);
    if (++i >= beats.length) { end(); return; }
    box.classList.remove('ready');
    show(beats[i]);
  }
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const c = t.closest<HTMLButtonElement>('[data-c]');
    if (c && !c.disabled) SND.sfx('confirm'); // 효과음: 선택지 확정
    if (c) { if (!c.disabled) { closeAdv(); o.onDone(+c.dataset.c!); } return; }
    const x = t.closest<HTMLElement>('[data-x]')?.dataset.x;
    if (x === 'log') { $('.adv-log-in').innerHTML = logLines.map((l) => `<p>${l}</p>`).join(''); $('.adv-log').hidden = false; $('.adv-log-in').scrollTop = 1e6; return; }
    if (x === 'log-close') { $('.adv-log').hidden = true; return; }
    if (x === 'auto') { auto = !auto; t.classList.toggle('on', auto); if (auto && !typing) next(); return; }
    if (x === 'skip') { while (i < beats.length - 1) { i++; const b = beats[i]; if (b.bg) setBg(b.bg); for (const s of b.stage || []) place(s.id, s.at, s.face); } end(); return; }
    if (!$('.adv-log').hidden || t.closest('.adv-end')) return;
    next();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { if ((e.target as HTMLElement).closest('[data-c]')) return; e.preventDefault(); next(); }
  });
  el.tabIndex = -1;
  el.focus();
  if (!beats.length) end(); else next();
}
