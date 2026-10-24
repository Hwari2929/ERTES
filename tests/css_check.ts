// CSS 토큰 검사 (src/ui/style.css). npm run check 에서 함께 돈다.
//   · :root (토큰 정의 블록) 밖에 새 색 값(#hex · rgb() · hsl())이 생기면 실패
//   · 옛 토큰(--accent 등) 사용 횟수가 기준보다 늘면 실패
//   · 정의되지 않은 CSS 변수를 쓰면 실패 (JS 가 인라인으로 주입하는 변수는 JS_VARS 허용 목록)
//   · 글자 크기 · 모서리 둥글기 · z-index 리터럴이 기준보다 늘면 실패, !important 수가 기준보다 늘면 실패
// 이미 남아 있는 것은 tests/css_baseline.json 이 허용 목록이다 (선택자 · 값별 개수).
// 줄이는 것은 언제나 통과 → 줄였으면 기준을 갱신해 둔다:  node dist/css_check.cjs --update
// 수치만 보기: node dist/css_check.cjs --report
declare const process: { argv: string[]; exit(code: number): never };
declare function require(m: 'node:fs'): { readFileSync(p: string, e: 'utf8'): string; writeFileSync(p: string, s: string): void; existsSync(p: string): boolean };
const fs = require('node:fs');

const CSS_PATH = (process.argv.find((a) => a.startsWith('--css=')) || '--css=src/ui/style.css').slice(6);
const BASE_PATH = 'tests/css_baseline.json';

/** 옛 토큰: 역할 토큰의 별칭으로만 남아 있다. 새 코드는 오른쪽 역할 토큰을 쓴다 */
export const LEGACY: Record<string, string> = {
  '--accent': '--c-select', '--accent-ink': '--c-select-ink', '--fg': '--c-text', '--dim': '--c-text-2', '--muted': '--c-text-2',
  '--good': '--c-good', '--bad': '--c-bad', '--info': '--c-info',
};
/** JS(main.ts · battleview.ts 등)가 style="--x:…" / setProperty('--x') 로 주입하는 변수 */
export const JS_VARS = ['--rot-bp', '--fc', '--gx', '--gy', '--gs', '--tx', '--ty', '--tw', '--nx', '--ny', '--nw', '--ns', '--ox', '--oy', '--ow', '--oh', '--oz', '--rot-mn', '--rot-pr', '--rot-rd', '--rot-ls', '--el', '--d', '--sw-el', // ui/contract.ts: 도면 · 차림표가 놓인 각도
 
  '--c', '--sc', '--h', '--w', '--fw', '--fh', '--ox', '--oy', '--i', '--x', '--y', '--s', '--d', '--n', '--o', '--p', '--v', '--mx', '--my', '--hc', '--top-h', '--a', '--k', '--dl', '--oi-r',
];

interface Decl { sel: string; prop: string; value: string; line: number; root: boolean; important: boolean }

export const braceErrors: string[] = [];
export function parse(css: string): Decl[] {
  const out: Decl[] = [];
  // 주석 제거 (줄 번호 유지)
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const stack: string[] = [];
  let buf = '', bufLine = 1, line = 1;
  const flushDecl = (text: string, at: number) => {
    const t = text.trim();
    if (!t) return;
    const k = t.indexOf(':');
    if (k < 0) return;
    const kf = stack.find((s) => s.startsWith('@kf '));
    const inner = stack.filter((s) => !s.startsWith('@')).pop() || '';
    const sel = kf ? `${kf.slice(4)} ${inner}` : inner;
    if (!sel) return; // @font-face 등이 아닌 at-rule 문장 (e.g. @import)
    const prop = t.slice(0, k).trim();
    let value = t.slice(k + 1).trim();
    const important = /!important\s*$/.test(value);
    value = value.replace(/\s*!important\s*$/, '');
    const root = /(^|,)\s*:root\b/.test(sel) || /^\s*\[data-ui-theme="[\w-]+"\]\s*$/.test(sel); // 토큰 정의 블록 = :root · 테마 블록
    out.push({ sel: sel.replace(/\s+/g, ' ').trim(), prop, value, line: at, root, important });
  };
  let depthParen = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\n') line++;
    if (ch === '(') depthParen++;
    if (ch === ')') depthParen--;
    if (ch === '{' && depthParen === 0) {
      const head = buf.trim(); buf = '';
      stack.push(/^@(-webkit-)?keyframes/.test(head) ? '@kf @keyframes ' + head.split(/\s+/)[1] : head);
      bufLine = line; continue;
    }
    if (ch === '}' && depthParen === 0) {
      flushDecl(buf, bufLine); buf = '';
      if (!stack.length) braceErrors.push(`${line}행: 여는 괄호 없이 닫는 } (지우다 남은 괄호?)`);
      stack.pop(); bufLine = line; continue;
    }
    if (ch === ';' && depthParen === 0) { flushDecl(buf, bufLine); buf = ''; bufLine = line; continue; }
    if (!buf.trim()) bufLine = line;
    buf += ch;
  }
  if (stack.length) braceErrors.push(`파일 끝: 닫히지 않은 블록 ${stack.length}개 (${stack.slice(-1)[0]})`);
  return out;
}

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\((?![^)]*var\()[^)]*\)/g;
const FS_PROPS = new Set(['font-size']);
/** font 단축 속성에서 크기 부분 */
function fontShorthandSize(v: string): string | null {
  const m = /(?:^|\s)((?:clamp|calc|min|max)\((?:[^()]|\([^()]*\))*\)|var\([^)]*\)|[\d.]+(?:px|rem|em|%|cqw|vw))(?:\/\S+)?\s+(?:var\(|['"a-zA-Z])/.exec(v);
  return m ? m[1] : null;
}
const isTokenOnly = (v: string) => /^var\(--[\w-]+\)$/.test(v.trim()) || /^calc\(var\(--(?:fs|r)-[\w-]+\) \* var\(--[\w-]+\)\)$/.test(v.trim()); // 토큰 × 배율 변수 (화면을 따라 커지는 조각을 실제 치수로 다시 그릴 때: 예레나 토스트 --k)
/** 크기 · 둥글기 값 중 토큰이 아닌 리터럴 (0 · 50% · inherit 같은 모양 값은 제외) */
function literalOf(prop: string, v: string): string | null {
  if (isTokenOnly(v) || /^(inherit|initial|unset|0|50%|auto|100%)$/.test(v.trim())) return null;
  if (prop === 'z-index') return /^-?\d+$/.test(v.trim()) && !/^-?[01]$/.test(v.trim()) ? v.trim() : null; // 0 · ±1 은 국소 쌓임 (허용)
  if (prop === 'border-radius' && !/(^|[\s/])(\d*\.?\d+)(px|rem|em)\b/.test(v.replace(/var\([^)]*\)/g, ''))) return null; // 토큰 · % · 0 만으로 된 모양 값
  return v.trim();
}

export interface Stats {
  colors: Record<string, number>; // "선택자 :: 값"
  legacy: Record<string, number>;
  fontSize: Record<string, number>;
  radius: Record<string, number>;
  zIndex: Record<string, number>;
  important: number;
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] || 0) + 1; };

export function collect(decls: Decl[]) {
  const st: Stats = { colors: {}, legacy: {}, fontSize: {}, radius: {}, zIndex: {}, important: 0 };
  const where: Record<string, number[]> = {};
  const note = (kind: string, k: string, line: number) => { (where[kind + '|' + k] ||= []).push(line); };
  for (const d of decls) {
    if (d.important) { st.important++; note('important', '', d.line); }
    for (const [name] of Object.entries(LEGACY)) {
      const n = (d.value.match(new RegExp(`var\\(${name}[,)]`, 'g')) || []).length;
      if (n && !(d.root && d.prop.startsWith('--'))) for (let i = 0; i < n; i++) { inc(st.legacy, name); note('legacy', name, d.line); }
    }
    if (!d.root) for (const m of d.value.match(COLOR_RE) || []) { const k = `${d.sel} :: ${m.toLowerCase()}`; inc(st.colors, k); note('colors', k, d.line); }
    if (d.root) continue;
    let fsv: string | null = null;
    if (FS_PROPS.has(d.prop)) fsv = d.value;
    else if (d.prop === 'font') fsv = fontShorthandSize(d.value);
    if (fsv) { const l = literalOf('font-size', fsv); if (l) { inc(st.fontSize, l); note('fontSize', l, d.line); } }
    if (d.prop === 'border-radius') { const l = literalOf('border-radius', d.value); if (l) { inc(st.radius, l); note('radius', l, d.line); } }
    if (d.prop === 'z-index') { const l = literalOf('z-index', d.value); if (l) { inc(st.zIndex, l); note('zIndex', l, d.line); } }
  }
  return { st, where };
}

/** 테마 블록: [data-ui-theme="id"] 단독 선택자 (기본 테마는 ':root, [data-ui-theme="galaxy"]') → 정의한 토큰 */
export function themeBlocks(decls: Decl[]) {
  const out: Record<string, { props: Set<string>; line: number }> = {};
  for (const d of decls) {
    const m = /^(?::root,\s*)?\[data-ui-theme="([\w-]+)"\]$/.exec(d.sel);
    if (!m) continue;
    (out[m[1]] ||= { props: new Set(), line: d.line }).props.add(d.prop);
  }
  return out;
}
/** 기본 테마가 정의한 토큰을 다른 테마가 모두 정의했는지 (빠진 토큰이 있으면 그 테마에서 기본값이 새어 나온다) */
export function themeMissing(decls: Decl[], base = 'galaxy') {
  const th = themeBlocks(decls);
  const need = th[base]?.props;
  const miss: { theme: string; line: number; props: string[] }[] = [];
  if (!need) return { themes: Object.keys(th), miss: [{ theme: base, line: 0, props: ['(기본 테마 블록 없음)'] }] };
  for (const [id, t] of Object.entries(th)) {
    if (id === base) continue;
    const m = [...need].filter((p) => !t.props.has(p));
    if (m.length) miss.push({ theme: id, line: t.line, props: m });
  }
  return { themes: Object.keys(th), miss };
}

export function undefinedVars(decls: Decl[]) {
  const defined = new Set(decls.filter((d) => d.prop.startsWith('--')).map((d) => d.prop));
  JS_VARS.forEach((v) => defined.add(v));
  const bad: { name: string; line: number; sel: string }[] = [];
  for (const d of decls) for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1])) bad.push({ name: m[1], line: d.line, sel: d.sel });
  return bad;
}

function summary(st: Stats) {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { colors: sum(st.colors), legacy: sum(st.legacy), fontSizeKinds: Object.keys(st.fontSize).length, fontSize: sum(st.fontSize), radiusKinds: Object.keys(st.radius).length, radius: sum(st.radius), zKinds: Object.keys(st.zIndex).length, zIndex: sum(st.zIndex), important: st.important };
}

function main() {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const decls = parse(css);
  const { st, where } = collect(decls);
  const s = summary(st);
  if (process.argv.includes('--report')) {
    const roleUse = (n: string) => (css.match(new RegExp(`var\\(${n}[,)]`, 'g')) || []).length;
    console.log(JSON.stringify({ ...s, legacyBy: st.legacy, selectUse: roleUse('--c-select'), accentUse: roleUse('--accent'), fontSizes: st.fontSize, radii: st.radius, zs: st.zIndex }, null, 1));
    return;
  }
  if (process.argv.includes('--update')) {
    fs.writeFileSync(BASE_PATH, JSON.stringify(st, null, 1) + '\n');
    console.log(`CSS 기준 갱신: ${BASE_PATH}`, JSON.stringify(s));
    return;
  }
  const base: Stats = fs.existsSync(BASE_PATH) ? JSON.parse(fs.readFileSync(BASE_PATH, 'utf8')) : { colors: {}, legacy: {}, fontSize: {}, radius: {}, zIndex: {}, important: 0 };
  const fails: string[] = [];
  const lines = (kind: string, k: string) => (where[kind + '|' + k] || []).slice(0, 6).map((l) => `${CSS_PATH}:${l}`).join(', ');
  const cmp = (kind: keyof Omit<Stats, 'important'>, label: string, hint: (k: string) => string) => {
    for (const [k, n] of Object.entries(st[kind])) {
      const b = (base[kind] as Record<string, number>)[k] || 0;
      if (n > b) fails.push(`${label} 늘어남: ${k} (${b} → ${n})\n    위치: ${lines(kind, k)}\n    고치기: ${hint(k)}`);
    }
  };
  cmp('colors', '색 직접 지정', () => ':root 의 역할 토큰(--c-text · --c-text-2 · --c-select · --c-good · --c-bad · --c-info · --bg · --panel · --line · --c-white · --c-black …)을 var() 로 쓰거나, 투명도는 color-mix(in srgb, var(--토큰) N%, transparent). 새 색이 꼭 필요하면 :root 에 역할 토큰으로 정의');
  cmp('legacy', '옛 토큰 사용', (k) => `var(${k}) 대신 var(${LEGACY[k]})`);
  cmp('fontSize', '글자 크기 리터럴', () => 'var(--fs-2xs|xs|sm|base|md|lg|xl|2xl|3xl) 중 가까운 단계 (:root 참고)');
  cmp('radius', '둥글기 리터럴', () => 'var(--r-sm) 4px · var(--r-md) 6px · var(--r-lg) 10px · var(--r-pill) (원은 50%)');
  cmp('zIndex', 'z-index 리터럴', () => ':root 의 --z-* 층 이름 (--z-raise · --z-board-fx · --z-sticky · --z-top · --z-pop · --z-modal · --z-over · --z-adv · --z-coach · --z-toast)');
  if (st.important > base.important) fails.push(`!important 늘어남 (${base.important} → ${st.important})\n    위치: ${lines('important', '')}\n    고치기: 덮어쓰기 대신 원래 규칙을 고치거나 선택자 우선순위로 해결`);
  for (const e of braceErrors) fails.push(`괄호 짝이 맞지 않음 — ${CSS_PATH} ${e}`);
  const tm = themeMissing(decls);
  for (const m of tm.miss) fails.push(`테마 '${m.theme}' 에 빠진 토큰 ${m.props.length}개: ${m.props.join(' · ')} (${CSS_PATH}:${m.line})\n    고치기: 기본 테마 블록(:root, [data-ui-theme="galaxy"])에 있는 역할 · 면 · 선 토큰은 모든 [data-ui-theme] 블록이 다시 정의한다`);
  for (const u of undefinedVars(decls)) fails.push(`정의되지 않은 변수 ${u.name} (${CSS_PATH}:${u.line} ${u.sel})\n    고치기: :root 에 정의하거나, JS 가 주입하는 변수라면 tests/css_check.ts 의 JS_VARS 에 추가`);
  const shrunk = (['colors', 'legacy', 'fontSize', 'radius', 'zIndex'] as const).some((k) => Object.entries(base[k]).some(([key, n]) => (st[k][key] || 0) < n)) || st.important < base.important;
  if (fails.length) {
    console.log(`CSS 검사 실패 ${fails.length}건\n` + fails.map((f) => ' · ' + f).join('\n'));
    console.log('\n의도한 변경이면 (예: 다른 구획이 들어와 기준을 맞출 때) node dist/css_check.cjs --update 로 기준을 갱신하고 diff 를 확인한다.');
    process.exit(1);
  }
  console.log(`CSS 검사: 테마 ${tm.themes.length}종 (${tm.themes.join(' · ')}) · 색 ${s.colors} · 옛 토큰 ${s.legacy} · 글자 크기 ${s.fontSizeKinds}종 ${s.fontSize} · 둥글기 ${s.radiusKinds}종 · z-index ${s.zKinds}종 · !important ${s.important}${shrunk ? ' (기준보다 줄었음: --update 로 갱신 가능)' : ''}`);
  console.log('통과');
}
main();
