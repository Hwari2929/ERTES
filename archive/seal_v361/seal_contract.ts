/** 회중시계 (그늘): 케이스 · 테 · 고리 = 런의 강조 호박색, 법랑 문자판, 시침 + 끝이 닻 모양인 분침 (끊김 없이 돈다) */
const WATCH_SVG = `<svg viewBox="0 0 140 150" aria-hidden="true">
  <g transform="translate(10 0)">
    <circle class="ct-bow" cx="60" cy="10" r="9"/>
    <circle class="ct-case" cx="60" cy="84" r="60"/><circle class="ct-rim" cx="60" cy="84" r="56"/>
    <circle class="ct-enamel-o" cx="60" cy="84" r="51"/><circle class="ct-enamel" cx="60" cy="84" r="41"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6, r1 = i % 3 ? 45 : 42; return `<line class="ct-tick" x1="${(60 + Math.sin(a) * r1).toFixed(1)}" y1="${(84 - Math.cos(a) * r1).toFixed(1)}" x2="${(60 + Math.sin(a) * 49).toFixed(1)}" y2="${(84 - Math.cos(a) * 49).toFixed(1)}"/>`; }).join('')}
    <line class="ct-hh" x1="60" y1="84" x2="78" y2="72"/><g class="ct-hand"><path class="ct-mh" d="M60 84V41M51.5 46.5Q52.5 40.6 60 40Q67.5 40.6 68.5 46.5M49.4 44.2L51.5 46.5L54.4 45.6M70.6 44.2L68.5 46.5L65.6 45.6"/></g><circle class="ct-pin" cx="60" cy="84" r="4"/>
  </g>
</svg>`;
/** 그늘 도중에 화면을 다시 그려야 할 때의 대체 화면 (보통은 보드 위에서 그대로 이어진다 — startSeal) */
function sealHtml() {
  return `<main class="ct ct-seal" data-a="ct-skip" aria-label="그늘 — 누르면 넘깁니다"></main>`;
}
/** 지금 그늘의 체인 장면 (명부로 넘어간 뒤에도 씬 위에서 끌려 올라가며 사라진다) */
let sealChains: { pulse(): void; lift(): void } | null = null;

/** 벨 → 그늘: 화면을 갈아 끼우지 않고 보드 위에서 이어진다 (카메라 연출).
 *  보드(main.ct) 한 장을 세계로 삼아 카메라처럼 움직인다: 출력기 쪽으로 다가가 전표를 똑바로 세우고 (밀어 들어감),
 *  종이는 출력기 슬롯에서 곧게 끌려 나와 위로 빠져나가고, 카메라가 뒤늦게 따라 올라가며 물러난다 (줌 아웃).
 *  그동안 종이 말고는 모두(메뉴판 · 도면 · 출력기 몸체 · 램프 빛) 서서히 옅어져 뒤의 어둠 → 은하 하늘(.ct-sealbg, body 맨 뒤)이 드러난다.
 *  체인 · 회중시계는 화면 위 별도 층(.ct-chainfx) — 명부로 넘어간 뒤에도 그 위에서 끌려 올라가며 사라진다 */
function startSeal(ct: HTMLElement) {
  const slip = ct.querySelector<HTMLElement>('.ct-slip'), wrap = slip?.closest<HTMLElement>('.ct-slipwrap');
  CT.step = 'seal';
  if (reduced() || !slip || !wrap) { later(reduced() ? 600 : 0, finish); return; }
  const SC = CT.vet ? 0.8 : 1; // 두 번째부터는 같은 순서를 0.8배 시간으로 (약 4.5초) — 의식은 처음에만 길다
  const r = slip.getBoundingClientRect(), ow = slip.offsetWidth, oh = slip.offsetHeight, rot = (CT.rot.pr * Math.PI) / 180;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const geo: SealGeo = { slot: { x: cx - (Math.sin(rot) * oh) / 2, y: cy + (Math.cos(rot) * oh) / 2 }, rot, ow, oh };
  ct.style.setProperty('--sc', String(SC));
  // 보드(main.ct) 자체가 세계: 다시 그리지도 옮겨 담지도 않으니 종이 · 각도 · 체크 표시 · 조명이 그대로다. 뒤의 어둠 · 하늘과 맨 위 안내 층은 보드 밖(body)에
  document.querySelectorAll('.ct-sealbg, .ct-sealtop').forEach((el) => el.remove());
  document.body.insertAdjacentHTML('afterbegin', '<div class="ct-sealbg" aria-hidden="true"><div class="ct-sky"></div></div>');
  document.body.insertAdjacentHTML('beforeend', `<div class="ct-sealtop${CT.vet ? ' quick' : ''}" data-a="ct-skip" role="button" aria-label="그늘 — 누르면 넘깁니다" style="--sc:${SC}">
    <p class="ct-load"><span>계약 기물 명부를 펼치는 중</span><i>.</i><i>.</i><i>.</i></p><p class="ct-skip-k">누르면 넘깁니다</p></div>`);
  const world = ct;
  document.querySelector('.ct-sealtop')?.addEventListener('click', () => { if (CT.step === 'seal') finish(); }); // 앱 밖(body) 층이라 누름을 직접 받는다
  // 슬롯 아래로 이어진 빈 종이 (전표와 함께 끌려 나온다) · 빛에 물드는 층
  wrap.insertAdjacentHTML('beforeend', '<i class="ct-feed lp-carbon" aria-hidden="true"><i class="ct-shine"></i></i>');
  slip.insertAdjacentHTML('beforeend', '<i class="ct-shine" aria-hidden="true"></i>');
  ct.classList.add('sealing', 'seal-0');
  void ct.offsetWidth;
  ct.classList.remove('seal-0'); // 둘레 테이블은 보이는 채로 시작해 함께 어둠에 잠긴다
  const sky = document.querySelector<HTMLElement>('.ct-sealbg .ct-sky');
  if (sky) galaxySky(sky);
  document.querySelector('.ct-chainfx')?.remove();
  const cf = document.createElement('div');
  cf.className = 'ct-chainfx';
  cf.setAttribute('aria-hidden', 'true');
  cf.innerHTML = `<canvas class="ct-chains"></canvas><div class="ct-watch">${WATCH_SVG}</div><canvas class="ct-chains front"></canvas>`;
  document.body.appendChild(cf);
  const k = (x: number) => x * SC;
  sealChains = chainScene(cf.querySelector('canvas.ct-chains:not(.front)')!, cf.querySelector('canvas.ct-chains.front'), cf.querySelector('.ct-watch'),
    { win: [k(2.65), k(3.5)], wout: [k(4.9), k(5.7)], watchIn: k(2.5), watchOut: k(5.3) }, () => cf.remove()); // 종이가 빠져나간 뒤 회중시계가 먼저 → 체인
  const feed = wrap.querySelector<HTMLElement>('.ct-feed');
  if (feed) camera(world, slip, feed, geo, SC, () => sfx('despair', { pitch: 1.4 }));
  sfx('paper');
  // 0 출력기 쪽으로 다가가 전표를 세운다 (램프는 서서히 꺼지고 바는 어둠에) → 0.95 종이가 곧게 끌려 올라가 화면 밖으로 → 1.3 카메라가 뒤늦게 따라 올라가며 물러난다 (한 줄기 빛)
  //   → 1.8 은하 하늘 → 2.1 미친 듯이 가속해 종이 끝까지 빠져나간다 → 2.5 회중시계 · 2.65~3.5 체인 → 4.1 심장 박동 → 4.9~5.7 끌려 올라가기 시작 → 5.65 명부 (체인은 그 위에서 마저 올라간다)
  const t = [2500, 4100, 5000, 5650].map(k);
  later(t[0], () => sfx('chain'));
  later(t[1], () => { sealChains?.pulse(); sfx('heart'); sfx('despair'); });
  later(t[2], () => { document.querySelector('.ct-sealtop')?.classList.add('lift'); sfx('chain'); });
  later(t[3], finish);
}

interface SealGeo { slot: { x: number; y: number }; rot: number; ow: number; oh: number }
/** 카메라 연출. 세계 좌표 = 벨을 누른 순간의 화면 좌표. 종이는 전표 축(출력기 각도) 위에서만 움직인다 (곧게 끌려 나온다):
 *  ① 0~0.9 밀어 들어감: 슬롯을 화면 아래쪽 가운데로 데려오며 전표를 똑바로 세우고 전표가 화면에 차도록 확대한다.
 *  ② 0.95~ 종이가 위로 끌려 나온다 — 느리게 시작해 점점 빨라져 전표가 화면 위로 완전히 빠져나간다 (카메라는 그대로).
 *  ③ 1.3~ 카메라가 뒤늦게 따라 올라가며 빠르게 물러난다 (처음 빠르게, 점점 느리게): 전표가 위에서 작게 다시 들어오고, 슬롯(출력기)은 화면 아래로 멀어지며 종이는 얇은 빛줄기가 된다.
 *  ④ 2.1~ 멀어진 만큼 느리게 오르던 전표가 미친 듯이 가속해 빠져나가고 (그동안에도 더 물러나 긴 선이 된다), 끌려 나온 종이 끝까지 화면 위로 사라진다.
 *  매 프레임 시각의 함수로 계산한다 (프레임이 밀려도 같은 곡선) */
function camera(world: HTMLElement, slip: HTMLElement, feed: HTMLElement, g: SealGeo, SC: number, onExit: () => void) {
  const W = innerWidth, H = innerHeight, PY = H * 0.84; // 밀어 들어간 뒤 슬롯이 놓이는 화면 높이
  const Z0 = Math.max(1, Math.min(Math.min(494, W * 0.8) / g.ow, (PY - H * 0.1) / g.oh)); // 밀어 들어간 배율: 전표가 화면에 차되 슬롯은 보이게
  const WMIN = 10, WLINE = 3; // 줌 아웃 뒤 · 마지막에 화면에 보이는 종이 폭 (px)
  const IN = 0.9, RISE = 0.95, ZOOM = 1.3, BURST = 2.1;
  const shines = [slip, feed].map((e) => e.querySelector<HTMLElement>(':scope > .ct-shine'));
  const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  /** ② 끌려 나온 길이 (세계 px): 0.3초 동안 점점 빨라져 2600px/초 */
  const pulled = (t: number) => { const u = t - RISE; if (u <= 0) return 0; if (u < 0.3) return (2600 * u ** 3) / 0.27; const w = u - 0.3; return 260 + 2600 * w + 800 * w * w; };
  /** ③ 줌 아웃 뒤 전표 머리의 화면 높이: 위에서 내려와 자리를 잡고, 멀어진 만큼 느리게 올라간다 */
  const after = (u: number) => H * (0.32 - 0.155 * u - 0.035 * u * u);
  /** ④ 마지막 가속 (화면 px): 0.075초마다 e배 */
  const burst = (t: number) => (t < BURST ? 0 : 2.2 * (Math.exp((t - BURST) / 0.075) - 1));
  const y0 = PY - (g.oh + pulled(ZOOM)) * Z0; // 줌 아웃이 시작될 때 전표 머리의 화면 높이 (화면 위 밖)
  let d = 0, cut = 0, exited = false;
  const t0 = performance.now();
  const frame = (now: number) => {
    if (!world.isConnected || CT.step !== 'seal') return;
    const t = (now - t0) / 1000 / SC;
    let px = W / 2, py = PY, cr = -g.rot, z = Z0, c = 0; // 화면 기준점 (px, py) 에 세계의 '슬롯에서 축 위로 c 만큼' 점이 놓인다
    if (t < IN) { const e = smooth(t / IN); px = lerp(g.slot.x, W / 2, e); py = lerp(g.slot.y, PY, e); cr = -g.rot * e; z = lerp(1, Z0, e); }
    if (t < ZOOM) d = pulled(t);
    else {
      const u = t - ZOOM, floor = t < BURST ? WMIN : WLINE + (WMIN - WLINE) * Math.exp(-(t - BURST) / 0.12);
      z = (floor + (g.ow * Z0 - WMIN) * Math.exp(-u / 0.17)) / g.ow;
      const hy = after(u) + (y0 - after(0)) * Math.exp(-u / 0.13) - burst(t); // 전표 머리
      const sy = lerp(PY, H * 1.3, smooth(u / 0.35)); // 슬롯은 화면 아래 밖으로 멀어진다 (카메라가 따라 올라가니까)
      d = Math.max(d, (sy - hy) / z - g.oh); // 끌려 나온 길이 (머리와 슬롯 사이)
      c = (sy - PY) / z;
      if (t >= BURST && !cut) cut = d + 60; // 가속하는 순간 종이가 끊겨 끝까지 따라 빠져나간다
      if (!exited && t > BURST && hy + g.oh * z < 0) { exited = true; onExit(); }
    }
    // 세계 → 화면: 기준점으로 옮기고 · 전표 축이 똑바로 서게 돌리고 · 확대하고 · 슬롯에서 축 위로 c 만큼 간 점을 원점으로
    const ux = Math.sin(g.rot), uy = -Math.cos(g.rot);
    world.style.transform = `translate(${px}px, ${py}px) rotate(${cr}rad) scale(${z}) translate(${-(g.slot.x + ux * c)}px, ${-(g.slot.y + uy * c)}px)`;
    slip.style.translate = feed.style.translate = `0 ${-d}px`;
    feed.style.height = `${cut || d + 60}px`;
    if (t >= RISE) world.style.willChange = 'transform'; // 밀어 들어가는 동안은 매 프레임 다시 그려 글자가 또렷하게
    const gl = Math.log((g.ow * Z0) / (z * g.ow)) / Math.log((g.ow * Z0) / WMIN);
    shines.forEach((e) => { if (e) e.style.opacity = String(0.62 * smooth((gl - 0.35) / 0.55)); }); // 멀어질수록 빛에 물든다
    const endY = cut ? PY + c * z - (d - cut) * z + 0 : H; // 끊긴 종이 끝의 화면 높이 (슬롯 아래에서 따라 올라온다)
    if (!cut || endY > -40) requestAnimationFrame(frame);
    else { const w = world.querySelector<HTMLElement>('.ct-slipwrap'); if (w) w.style.visibility = 'hidden'; } // 종이 끝까지 다 빠져나갔다
  };
  frame(t0);
}

