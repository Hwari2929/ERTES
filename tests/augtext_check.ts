// 증강 설명문(abil/*.ts · abiltext.ts) 과 데이터 desc 의 숫자가 어긋난 증강을 찾는다 (문구 형식 차이로 일부 오탐 있음)
// 실행: npx esbuild tests/augtext_check.ts --bundle --platform=node --format=cjs --outfile=dist/augtext_check.cjs && node dist/augtext_check.cjs
import { UNITS } from '../src/data/units';
import { augAbilText } from '../src/data/abiltext';
const nums = (s: string, tok: boolean) => {
  const out: number[] = [];
  if (tok) {
    s = s.replace(/\[([a-z+]+):([^\]]*)\]/g, (_m, k: string, a: string) => {
      const parts = a.split(':');
      const n = parts.map(Number).filter((x) => !isNaN(x));
      if (['p', 'pp', 'dmg+', 'heal+', 'shield+', 'heal', 'shield', 'dmg'].includes(k)) n.forEach((x) => out.push(Math.round(x * 100)));
      else if (['s', 't'].includes(k)) n.forEach((x) => out.push(x));
      else if (k === 'st') { const v = Number(parts[1]); if (!isNaN(v)) out.push(v); }
      return ' ';
    });
  }
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)/g)) out.push(Number(m[1]));
  return out.sort((a, b) => a - b);
};
let bad = 0;
for (const u of UNITS) for (const a of [...u.augs, ...((u as any).specialAugs || [])]) {
  const t = augAbilText(a.id);
  if (!t) continue;
  const d = nums(a.desc, false), x = nums(t, true);
  const miss = d.filter((v) => !x.includes(v));
  if (miss.length) { bad++; console.log(`${a.id}\n  data: ${a.desc}\n  text: ${t}`); }
}
console.log('mismatch', bad);
