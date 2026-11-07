// UI 촬영 · 지표 (피드백 보고서 지표 재현 + 회귀 비교용): dist/index.html 을 저장 상태별로 열어 찍고 DOM 지표를 모은다.
// 사용: node scripts/ui_shots.mjs [--out dist/ui_shots/now] [--themes metro,galaxy] [--sizes 1440x900,844x390] [--only map,shop] [--css 덧씌울.css] [--html dist/다른빌드.html]
//   --html: 비교 기준을 찍을 때 (예: git show HEAD:dist/index.html > dist/base.html — 그림 경로가 같도록 dist/ 안에 둔다, 찍은 뒤 지운다)
//   먼저 `npm run -s build` 와 상태 생성(tests/ui_states.ts 머리 주석)이 필요하다 — 상태 파일이 없으면 여기서 만든다.
// 결과: <out>/<theme>/<화면>_<W>.png · <out>/metrics.json (화면별: 한글 글자 수 · 13px 미만 · 누를 것 · 44px · 24px 미만 · 둥글기 값 · 잘린 칸 · 문서 높이).
// 밝은 면적 · 유채색 면적 · 두 촬영의 픽셀 비교는 scripts/ui_metrics.py.
// 같은 코드면 같은 그림: Math.random 고정 · 연출 끔(uiFx off) · 촬영 때 애니메이션 정지. 전투 화면(battle · bossbattle)은 시각에 따라 달라 비교에서 뺀다(nodiff).
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out', 'dist/ui_shots/now');
const THEMES = arg('themes', 'metro,galaxy').split(',');
const SIZES = arg('sizes', '1440x900,844x390').split(',').map((s) => s.split('x').map(Number));
const ONLY = arg('only', '') ? arg('only').split(',') : null;
const CSS = arg('css', '') ? readFileSync(arg('css'), 'utf8') : '';
const ROOT = new URL('..', import.meta.url).pathname;
const URL_ = `file://${ROOT}${arg('html', 'dist/index.html')}`;

if (!existsSync(`${ROOT}dist/ui_states.json`)) execSync('npx esbuild tests/ui_states.ts --bundle --platform=node --log-level=error --outfile=dist/ui_states.cjs && node dist/ui_states.cjs > dist/ui_states.json', { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const STATES = JSON.parse(readFileSync(`${ROOT}dist/ui_states.json`, 'utf8'));

const click = (s) => `document.querySelector(${JSON.stringify(s)})?.click()`;
/** [화면, 상태 키(null = 타이틀), 불러온 뒤 실행할 js, 기다림 ms, 비교 제외] */
const SCREENS = [
  ['title', 'map', null, 0, false, true],
  ['map', 'map'], ['map_detail', 'map', click('[data-a=tl-pick]')], ['map_env', 'map', click('[data-a=map-tab][data-v="1"]')], ['map_log', 'map', click('[data-a=map-tab][data-v="2"]')], ['bossmap', 'bossmap'], ['shopmap', 'shopmap'], ['battlemap', 'battlemap'],
  ['prep', 'prep'], ['bossprep', 'bossprep'],
  ['prep_unit', 'prep', click('.board .u, .bench .u, [data-a=sel-unit]')],
  ['prep_menu', 'prep', click('[data-a=menu], .menu-btn, [aria-label*=메뉴]')],
  ['unitmax', 'prep', `${click('.board .u')}; setTimeout(() => ${click('[data-a=card-max], [data-a=um-open], .pc-full, [data-a=detail-max]')}, 400)`],
  ['priv', 'priv'], ['council', 'council'], ['supply', 'supply'], ['recruit', 'recruit'], ['muster', 'muster'],
  ['rankup', 'rankup'], ['item', 'item'], ['turret', 'turret'], ['blessing', 'blessing'], ['despair', 'despair'],
  ['branch', 'branch'], ['fork', 'fork'], ['notice', 'notice'],
  ['shop', 'shop'], ['shopback', 'shop', click('[data-a=shop-close]')], ['shopinv', 'shop', click('[data-a=shop-inv]')], ['ws', 'ws'], ['news', 'news'], ['invest', 'invest'], ['pilgrim', 'pilgrim'],
  ['win', 'win'], ['lose', 'lose'], ['codex', 'win', click('[data-a=codex]')],
  ['battle', 'prep', click('[data-a=fight]'), 4200, true], ['bossbattle', 'bossprep', click('[data-a=fight]'), 6500, true],
];

/** 화면 안 DOM 지표 (브라우저에서 실행) */
function collect() {
  const vw = innerWidth, vh = innerHeight;
  const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  const vis = (el) => el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false && inView(el.getBoundingClientRect());
  const scaleOf = (el) => { let e = el; while (e && !(e.offsetWidth > 0)) e = e.parentElement; if (!e) return 1; return e.getBoundingClientRect().width / e.offsetWidth || 1; };
  const key = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  // 1) 한글 글자 크기 (보이는 글자만, 조상 transform 배율 반영). SVG 안 글자(항로도 주석 등 그림의 일부)는 koSvg 로 따로 센다 — 보고서 지표와 같게
  let ko = 0, koSmall = 0, koSvg = 0; const koSize = {}, koOff = {};
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const m = n.nodeValue.match(/[가-힣]/g); if (!m) continue;
    const el = n.parentElement; if (!el || !vis(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); if (!inView(rg.getBoundingClientRect())) continue;
    if (el.closest('svg')) { koSvg += m.length; continue; }
    const fs = parseFloat(getComputedStyle(el).fontSize) * scaleOf(el);
    ko += m.length; bump(koSize, String(Math.round(fs * 2) / 2), m.length);
    if (fs < 12.95) { koSmall += m.length; bump(koOff, `${key(el)} ${Math.round(fs * 10) / 10}px`, m.length); }
  }
  // 2) 누를 것 (보이는 것만, 같은 누를 것 안쪽은 한 번)
  const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [data-a], [tabindex]:not([tabindex="-1"])';
  let tgt = 0, t44 = 0, t24 = 0; const tOff = {}; const counted = new Set();
  for (const el of document.querySelectorAll(SEL)) {
    if (!vis(el)) continue;
    let p = el.parentElement, inner = false; while (p) { if (counted.has(p)) { inner = true; break; } p = p.parentElement; }
    if (inner) continue;
    counted.add(el); tgt++;
    const r = el.getBoundingClientRect(), mn = Math.min(r.width, r.height);
    if (mn < 44) { t44++; bump(tOff, `${key(el)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
    if (mn < 24) t24++;
  }
  // 3) 둥글기 (면 · 윤곽 · 그림자가 있는 보이는 요소)
  const radius = {};
  const all = [...document.querySelectorAll('body *')];
  for (const el of all) {
    const cs = getComputedStyle(el), r0 = cs.borderTopLeftRadius;
    if (!(parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none')) continue;
    if (!vis(el)) continue;
    bump(radius, r0);
  }
  // 4) 잘린 칸: overflow 숨김인데 글자 내용이 더 크다 (말줄임 · 줄 수 제한도 잡힌다 — 전후 비교용)
  const clip = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (!/hidden|clip/.test(cs.overflowX + cs.overflowY) || !(el.textContent || '').trim()) continue;
    if (!(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) || !vis(el)) continue;
    clip.push(`${key(el)} ${el.scrollWidth - el.clientWidth}/${el.scrollHeight - el.clientHeight}`);
  }
  return { ko, koSmall, koSvg, koSize, koOff, tgt, t44, t24, tOff, radius, clip, docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth };
}

const finish = () => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* 무한 반복 */ } });

(async () => {
  const b = await chromium.launch();
  const metrics = existsSync(`${OUT}/metrics.json`) ? JSON.parse(readFileSync(`${OUT}/metrics.json`, 'utf8')) : {};
  for (const theme of THEMES) {
    mkdirSync(`${OUT}/${theme}`, { recursive: true });
    for (const [W, H] of SIZES) {
      for (const [name, key, js, wait = 900, nodiff = false, title = false] of SCREENS) {
        if (ONLY && !ONLY.includes(name)) continue;
        if (!STATES[key]) { console.log(`상태 없음: ${key}`); continue; }
        const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 1000, isMobile: W < 1000 });
        await ctx.addInitScript(() => { let s = 0x2f6b1d; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
        const p = await ctx.newPage();
        const errs = []; p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(URL_);
        await p.evaluate(([run, theme]) => { localStorage.clear(); localStorage.setItem('errantes.prefs.v1', JSON.stringify({ uiTheme: theme, uiFx: 'off' })); localStorage.setItem('errantes.v1.auto', JSON.stringify({ time: 0, run })); }, [STATES[key], theme]);
        await p.goto(URL_); await p.waitForTimeout(700);
        await p.evaluate(() => document.querySelector('[data-a=tut-ask-skip]')?.click());
        if (!title) { await p.evaluate(() => document.querySelector('[data-a=load][data-v=auto]')?.click()); await p.waitForTimeout(3300); }
        await p.evaluate(() => document.querySelector('.toast')?.remove());
        await p.evaluate(finish);
        if (js) { await p.evaluate(js); await p.waitForTimeout(wait); if (!nodiff) await p.evaluate(finish); }
        if (CSS) { await p.addStyleTag({ content: CSS }); await p.waitForTimeout(150); }
        await p.mouse.move(1, H - 1);
        await p.evaluate(() => document.fonts.ready);
        await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(250);
        await p.screenshot({ path: `${OUT}/${theme}/${name}_${W}.png`, animations: 'disabled', caret: 'hide' });
        metrics[`${theme}/${name}_${W}`] = { ...(await p.evaluate(collect)), nodiff };
        if (errs.length) console.log(theme, name, W, errs.slice(0, 2));
        await ctx.close();
      }
    }
  }
  writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
  await b.close();
  console.log(`촬영 끝: ${OUT}`);
})();
