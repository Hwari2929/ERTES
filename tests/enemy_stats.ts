// 페이즈별 적 회피 · 치명타 · 효과 저항 · 효과 명중 · 명중 분포 (빌드된 적 기준, 난이도 0)
// 실행: npx esbuild tests/enemy_stats.ts --bundle --platform=node --format=cjs --outfile=dist/enemy_stats.cjs && node dist/enemy_stats.cjs
import { buildEnemy } from '../src/engine/build';
import { Battle } from '../src/engine/combat';
import { ENEMIES } from '../src/data/enemies';
import { Rng } from '../src/rng';
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };
const f = (x: number) => `${Math.round(x * 100)}`.padStart(4);
console.log('P   tier    | eva 중앙/최대 | crit 중앙/최대 | effRes 중앙/최대 | effHit 중앙 | acc 중앙');
for (const ph of [1, 3, 6, 9, 11]) for (const tier of ['minion', 'elite', 'boss']) {
  const rows = ENEMIES.filter((e) => e.tier === tier).map((e) => { const b = new Battle(9, 9, new Rng(1), { phase: ph, credits: 0 }); const c = buildEnemy(b, e, ph, 1); return { eva: b.S(c, 'eva'), crit: b.S(c, 'crit'), res: b.S(c, 'effRes'), hit: b.S(c, 'effHit'), acc: b.S(c, 'acc') }; });
  if (!rows.length) continue;
  const g = (k: keyof typeof rows[0]) => rows.map((r) => r[k]);
  console.log(`P${String(ph).padEnd(2)} ${tier.padEnd(7)} | ${f(q(g('eva'), 0.5))} ${f(q(g('eva'), 1))}     | ${f(q(g('crit'), 0.5))} ${f(q(g('crit'), 1))}      | ${f(q(g('res'), 0.5))} ${f(q(g('res'), 1))}        | ${f(q(g('hit'), 0.5))}       | ${f(q(g('acc'), 0.5))}`);
}
