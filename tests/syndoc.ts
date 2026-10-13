// 시너지 표 문서 생성: npm run -s syn-doc  → docs/SYNERGY_TABLE.md
import { SYNERGIES } from '../src/data/synergies';
import { UNITS } from '../src/data/units';
import { CTYPE_NAME, TTYPE_NAME } from '../src/types';

declare const process: { stdout: { write(s: string): void } };
const out: string[] = [];
const p = (s = '') => out.push(s);
const name = (id: string) => SYNERGIES.find((s) => s.id === id)?.name || id;
const facs = SYNERGIES.filter((s) => s.kind === 'faction'), traits = SYNERGIES.filter((s) => s.kind === 'trait');
const rec = UNITS.filter((u) => !u.eventOnly);

p('# 기물 시너지 표');
p();
p(`기물 ${UNITS.length}종 (영입 가능 ${rec.length} · 사건 전용 ${UNITS.length - rec.length}) · 세력 ${facs.length} · 특성 ${traits.length} (1인 전용 ${traits.filter((s) => s.tiers.length === 1).length} 포함)`);
p();
p('> `npm run -s syn-doc` 으로 게임 데이터에서 생성한 문서입니다.');
p();
p('## 기물별');
p();
p('| 기물 | 세력 | 특성 | 전투 유형 | 전술 유형 | 비고 |');
p('|---|---|---|---|---|---|');
for (const u of UNITS) p(`| ${u.name} | ${u.factions.map(name).join(' · ')} | ${u.traits.map(name).join(' · ') || '—'} | ${CTYPE_NAME[u.ctype]} | ${TTYPE_NAME[u.ttype]} | ${u.eventOnly ? '사건 전용' : ''} |`);
p();
p('## 시너지별 소속');
p();
p('| 시너지 | 종류 | 단계 | 인원 (영입+사건) | 소속 |');
p('|---|---|---|---|---|');
for (const s of SYNERGIES) {
  const m = UNITS.filter((u) => (u.factions as string[]).includes(s.id) || (u.traits as string[]).includes(s.id));
  const tiers = s.tiers.join('/');
  p(`| ${s.name} | ${s.kind === 'faction' ? '세력' : '특성'} | ${tiers} | ${m.filter((u) => !u.eventOnly).length}+${m.filter((u) => u.eventOnly).length} | ${m.map((u) => u.name + (u.eventOnly ? '*' : '')).join(' · ')} |`);
}
p();
p('\\* 사건 전용');
p();
p('## 시너지 효과');
for (const s of SYNERGIES) {
  p();
  p(`### ${s.name} (${s.kind === 'faction' ? '세력' : '특성'} ${s.tiers.join('/')})`);
  p();
  p(s.desc.replace(/\n/g, '  \n'));
  p();
  s.tierDesc.forEach((d, i) => p(`- **(${s.tiers[i]})** ${d}`));
}
process.stdout.write(out.join('\n') + '\n');
