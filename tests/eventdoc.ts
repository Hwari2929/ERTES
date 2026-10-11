// 사건 일람 문서 생성: node dist/eventdoc.cjs > docs/EVENTS.md
import { BOONS, EVENTS } from '../src/data/events';
import { FIELDS } from '../src/data/battlefields';

const fieldName = (id: string) => FIELDS.find((f) => f.id === id)?.name || id;
const flagsSet = (src: string) => [...src.matchAll(/flag\(['"]([\w-]+)['"]\)/g)].map((m) => m[1]);
// 표식 → 그 표식을 세우는 사건
const setters: Record<string, string[]> = {};
for (const e of EVENTS) for (const c of e.choices) for (const f of flagsSet(c.apply.toString())) (setters[f] ||= []).includes(e.title) || setters[f].push(e.title);

const out: string[] = [];
out.push('# 사건 일람', '', `> 자동 생성 (\`npm run -s events-doc\`). 사건 ${EVENTS.length}종 · 선택지 ${EVENTS.reduce((s, e) => s + e.choices.length, 0)}개.`, '');
out.push('- **가중치**: 등장 확률 비중 (1 = 보통). 같은 런에서 겪은 사건은 다시 나올 확률이 크게 줄어든다.', '- **연계**: 앞선 사건의 선택이 남긴 표식이 있어야 등장한다.', '');
const groups: [string, typeof EVENTS][] = [
  ['공용 (기존)', EVENTS.filter((e) => !e.fields && !/^s[a-d]_/.test(e.id))],
  ...FIELDS.map((f) => [`전장 · ${f.name}`, EVENTS.filter((e) => e.fields?.includes(f.id))] as [string, typeof EVENTS]),
  ['이야기 A · 함선 생활 · 엘베스타드 일가', EVENTS.filter((e) => e.id.startsWith('sa_'))],
  ['이야기 B · 세력 정치 · 의뢰', EVENTS.filter((e) => e.id.startsWith('sb_'))],
  ['이야기 C · 우주 기담 · 사이오닉 · 신앙', EVENTS.filter((e) => e.id.startsWith('sc_'))],
  ['이야기 D · 변경 생존 · 도박 · 인양', EVENTS.filter((e) => e.id.startsWith('sd_'))],
];
out.push('## 목차', '', ...groups.map(([g, l]) => `- ${g} (${l.length})`), '');
for (const [g, list] of groups) {
  if (!list.length) continue;
  out.push(`## ${g}`, '');
  for (const e of list) {
    const tags = [
      `가중치 ${e.weight}`, e.minPhase ? `${e.minPhase}페이즈부터` : '', e.rare ? '희귀' : '', e.once ? '런당 1회' : '',
      e.fields ? e.fields.map(fieldName).join(' · ') : '',
      e.req ? `연계: [${(setters[e.req] || ['?']).join(', ')}] 이후` : '',
    ].filter(Boolean).join(' · ');
    out.push(`### ${e.title}`, `\`${e.id}\` · ${tags}`, '', `> ${e.text}`, '');
    e.choices.forEach((c, i) => {
      const f = flagsSet(c.apply.toString());
      out.push(`${i + 1}. **${c.label}** — ${c.desc}${f.length ? ` _(연계 표식: ${f.join(', ')})_` : ''}`);
    });
    out.push('');
  }
}
out.push('## 사건 팀 효과', '', ...Object.entries(BOONS).map(([id, b]) => `- \`${id}\` ${b.name}`), '');
console.log(out.join('\n'));
