// docs/TUTORIAL_SCRIPT.md 생성 (읽기용 사본): npm run -s tut-doc. 원본: src/data/scenes/tutorial.ts
import { TUTORIAL_FLOW, TUTORIAL_SCENES, TUTORIAL_TIPS, TUTORIAL_REG, TUTORIAL_EVENT, TUTORIAL_EVENT_SCENE } from '../src/data/scenes/tutorial';
import { UNIT_BY_ID } from '../src/data/units';
import type { Beat } from '../src/data/scene';

const nameOf = (id: string) => UNIT_BY_ID[id]?.name || TUTORIAL_REG.npcs?.[id]?.name || id;
const ann = (b: Beat) => {
  const a: string[] = [];
  if (b.bg) a.push(`배경 ${b.bg}`);
  if (b.bgm) a.push(`음악 ${b.bgm}`);
  if (b.sfx) a.push(`효과음 ${b.sfx}`);
  if (b.fx) a.push(`연출 ${b.fx}`);
  return a.length ? ` [${a.join(' · ')}]` : '';
};
const line = (b: Beat) => {
  if (!b.who) return `- *${b.text}*${ann(b)}`;
  const nm = b.name || nameOf(b.who);
  if (b.think) return `- **${nm}** (${b.text})${ann(b)}`;
  return `- **${nm}**: ${b.text}${ann(b)}`;
};
const out: string[] = [];
out.push('# 튜토리얼 대본 — 「당직 근무 중 승계」', '');
out.push('> 읽기용 사본. 원본은 `src/data/scenes/tutorial.ts` 이며, 이 문서는 그 데이터에서 생성했다. 고칠 때는 원본을 고친다.');
out.push('> 표기: 서술은 *기울임*, 속마음은 (괄호), 대사는 **이름** 뒤에. [배경 · 음악 · 효과음 · 연출]은 대괄호. 수치는 원본이 설정값(src/config.ts)에서 읽은 지금 값이다.', '');
out.push('## 진행 순서', '', '| # | 종류 | 키 | 메모 |', '|---|---|---|---|');
TUTORIAL_FLOW.forEach(([k, key, memo], i) => out.push(`| ${i + 1} | ${k === 'scene' ? '장면' : '안내'} | \`${key}\` | ${memo} |`));
out.push('');
for (const [kind, key] of TUTORIAL_FLOW) {
  if (kind === 'scene') {
    const sc = TUTORIAL_SCENES[key];
    out.push(`## ${sc.title} \`${key}\``, '');
    for (const b of sc.beats) out.push(line(b));
    out.push('');
  } else {
    out.push(`### 안내 말풍선 \`${key}\``, '', '| 담당 | 대상 UI | 말풍선 |', '|---|---|---|');
    for (const [who, ui, text] of TUTORIAL_TIPS[key]) out.push(`| ${nameOf(who)} | ${ui} | ${text} |`);
    out.push('');
    if (key === 'ch4_event') {
      const ev = TUTORIAL_EVENT, sc = TUTORIAL_EVENT_SCENE;
      out.push(`## 4장 사건 — ${ev.title} \`${ev.id}\``, '');
      out.push(`> 튜토리얼 전용 사건 (본편에는 나오지 않는다). ${ev.text}`, '');
      for (const b of sc.scene as Beat[]) out.push(line(b));
      out.push('', '| 선택지 | 효과 |', '|---|---|');
      for (const c of ev.choices) out.push(`| ${c.label} | ${c.desc} |`);
      out.push('');
      (sc.after as (Beat[] | null)[]).forEach((af, i) => {
        if (!af) return;
        out.push(`#### 결과 — ${ev.choices[i].label}`, '');
        for (const b of af) out.push(line(b));
        out.push('');
      });
    }
  }
}
out.push('## 등록부', '');
for (const [k, v] of Object.entries(TUTORIAL_REG.bgs || {})) out.push(`- 배경 \`${k}\`: ${v}`);
for (const [k, v] of Object.entries(TUTORIAL_REG.bgms || {})) out.push(`- 음악 \`${k}\`: ${v}`);
for (const [k, v] of Object.entries(TUTORIAL_REG.sfxs || {})) out.push(`- 효과음 \`${k}\`: ${v}`);
for (const [k, v] of Object.entries(TUTORIAL_REG.npcs || {})) out.push(`- NPC \`${k}\` ${v.name}: ${v.desc}`);
console.log(out.join('\n'));
