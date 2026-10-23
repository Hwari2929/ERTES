// FIELD_STORIES.md 생성기 (보관본, 경로는 이 폴더 기준). 원래 자리는 tests/fielddoc.ts 였다.
import { FIELD_BY_ID } from '../../src/data/battlefields';
import { NPCS, PC_NAME } from '../../src/data/scene';
import { UNIT_BY_ID } from '../../src/data/units';
import { FIELD_INTRO_ALIAS, FIELD_INTROS } from './fields';
import '../../src/data/scenes/index';

const back: Record<string, string> = Object.fromEntries(Object.entries(FIELD_INTRO_ALIAS).map(([a, b]) => [b, a]));
const who = (id: string, name?: string) => name || (id === 'pc' ? PC_NAME : UNIT_BY_ID[id]?.name || NPCS[id]?.name || id);
const out: string[] = [
  '# 전장 도입 이야기 (FIELD_STORIES)',
  '',
  '출격 직후, 특권 증강을 고르기 전에 한 번 나오는 의뢰 브리핑 미연시. 원본은 `src/data/scenes/fields.ts` 이고 이 문서는 거기서 생성한다 (`tests/fielddoc.ts`).',
  '',
];
for (const [key, f] of Object.entries(FIELD_INTROS)) {
  const id = back[key] || key;
  const fd = FIELD_BY_ID[id];
  out.push(`## ${f.title} — ${fd ? fd.name : `(전장 id \`${id}\` 미등록)`}`, '');
  out.push(`- **전장 id**: \`${id}\``, `- **의뢰인**: ${f.client}`, `- **의뢰 내용**: ${f.brief}`);
  if (f.reward) out.push(`- **보상**: ${f.reward}`);
  out.push('- **핵심**', ...f.core.map((c) => `  - ${c}`), '');
  for (const b of f.beats) out.push(b.who ? `> **${who(b.who, b.name)}**: ${b.text}  ` : `> *${b.text}*  `);
  out.push('');
}
console.log(out.join('\n'));
