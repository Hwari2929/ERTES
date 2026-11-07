// 디자인 시스템 ADMIT ONE 토큰 ↔ 메트로 테마 토큰 대응 검사 (피드백 보고서 4단계 — 손으로 옮겨 적은 값이 원본과 어긋나지 않게).
// 원본: design/admit-one/tokens.json (디자인 시스템 아티팩트 https://claude.ai/artifact/RDQXUuFp34p1JYhJgW3n1Z 의 tokens.json — 원본이 바뀌면 새로 받아 덮어쓴다)
// 사용: node scripts/metro_tokens.mjs            → 대응표 · 어긋남 보고 (같아야 할 값이 다르면 종료 코드 1)
//       node scripts/metro_tokens.mjs --write    → '같음' 대응의 메트로 값을 원본 값으로 고쳐 쓴다 (src/ui/css/01-themes.css 메트로 블록)
// '의도한 차이' 는 사용자 결정으로 원본과 다르게 둔 값 — 원본이 바뀌어도 건드리지 않고 표에만 보여 준다.
import { readFileSync, writeFileSync } from 'fs';

const DS = JSON.parse(readFileSync(new URL('../design/admit-one/tokens.json', import.meta.url), 'utf8'));
const CSS_PATH = new URL('../src/ui/css/01-themes.css', import.meta.url);
const THEME = 'dark';
/** [메트로 변수, 원본 경로 (분류.이름), '같음' | 의도한 차이 설명] */
const MAP = [
  ['--mt-a', 'color.accent', '같음'],
  ['--mt-b', 'color.accent-2', '같음'],
  ['--mt-on', 'color.on', '같음'],
  ['--mt-paper', 'color.ink', '같음'],
  ['--c-text', 'color.ink', '같음'],
  ['--mt-r', 'radius.radius-lg', '같음'],
  ['--mt-r-md', 'radius.radius-md', '같음'],
  ['--mt-r-sm', 'radius.radius-sm', '같음'],
  ['--mt-r-panel', 'radius.radius-xs', '같음'],
  ['--mt-stroke', 'borderWidth.stroke', '구조선 2px (2026-11-07 사용자 결정 2단계 B6 — 원본 1.5px)'],
  ['--mt-notch', 'spacing.notch', '절취 홈 반지름 9px (2026-11-06 실제 구멍으로 바꿀 때 — 원본 11px)'],
  ['--mt-sh', 'shadow.shadow-sm', '누를 것 그림자 = 잿빛 (2026-11-06 사용자 결정 — 원본 종이색은 과하다)'],
  ['--bg', 'color.desk', '게임 공용 토큰 값 그대로 (원본과 맞출지 정하지 않음)'],
  ['--panel', 'color.paper', '게임 공용 토큰 값 그대로 (원본과 맞출지 정하지 않음)'],
  ['--line', 'color.line', '게임 공용 토큰 값 그대로 (불투명 선 · 원본과 맞출지 정하지 않음)'],
  ['--mt-grid', 'color.grid', '메트로 도입 때 정한 값 (원본과 맞출지 정하지 않음)'],
  ['--c-text-2', 'color.muted', '게임 공용 토큰 값 그대로 (원본과 맞출지 정하지 않음)'],
  ['--c-bad', 'color.danger', '게임 공용 토큰 값 그대로 (상태색 체계 · 원본과 맞출지 정하지 않음)'],
];

function dsValue(path) {
  const [group, name] = path.split('.');
  const g = DS[group];
  const list = Array.isArray(g) ? g : g?.tokens;
  const t = list?.find((x) => x.name === name);
  if (!t) return null;
  const v = t.value;
  return typeof v === 'object' && v !== null ? v[THEME] ?? v.dark ?? Object.values(v)[0] : v;
}
const css = readFileSync(CSS_PATH, 'utf8');
const start = css.indexOf('[data-ui-theme="metro"] {');
const end = css.indexOf('\n}', start);
if (start < 0 || end < 0) { console.error('메트로 블록을 찾지 못했습니다'); process.exit(2); }
const block = css.slice(start, end);
const decl = (name) => { const m = block.match(new RegExp(`\\n\\s*${name.replace(/-/g, '\\-')}:\\s*([^;]+);`)); return m ? m[1].trim() : null; };
const norm = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');

let drift = 0, next = block;
const rows = MAP.map(([v, path, note]) => {
  const want = dsValue(path), have = decl(v);
  const same = norm(want) === norm(have);
  const kind = note === '같음' ? (same ? '같음' : '어긋남') : '의도한 차이';
  if (kind === '어긋남') {
    drift++;
    if (process.argv.includes('--write') && have !== null && want !== null) next = next.replace(new RegExp(`(\\n\\s*${v.replace(/-/g, '\\-')}:\\s*)([^;]+);`), `$1${want};`);
  }
  return [v, have ?? '(없음)', path, want ?? '(없음)', kind === '의도한 차이' ? `의도한 차이 — ${note}` : kind];
});
const w = [16, 30, 24, 30];
console.log(`ADMIT ONE ${DS.version ? `v${DS.version} ` : ''}(${THEME}) ↔ 메트로 토큰 — ${MAP.length}개`);
for (const r of rows) console.log(r.map((c, i) => (i < 4 ? String(c).slice(0, w[i]).padEnd(w[i]) : c)).join(' '));
if (process.argv.includes('--write') && drift) { writeFileSync(CSS_PATH, css.slice(0, start) + next + css.slice(end)); console.log(`\n${drift}개를 원본 값으로 고쳐 썼습니다 (01-themes.css). npm run -s build · CSS 검사 · 촬영 비교로 확인하세요.`); }
else console.log(drift ? `\n어긋남 ${drift}개 — 원본이 바뀌었으면 --write, 일부러 바꾼 값이면 MAP 의 설명을 '의도한 차이'로 적는다` : '\n어긋남 없음');
process.exit(drift && !process.argv.includes('--write') ? 1 : 0);
