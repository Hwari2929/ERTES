// 확장 설정 정합성 검사 (lore/인물/확장/*.md)
//   대본을 쓰며 새로 생긴 인물 설정은 lore/인물/확장/<이름>.md 에 출처와 함께 적는다 (docs/SCENES.md · docs/VOICES.md).
//   자동으로 보는 것:
//     1. 문서 이름이 실제 기물 이름이다.
//     2. '원본 시트:' 줄이 lore/인물/<이름>.md 를 가리키면 그 파일이 있다. 없으면 '없음'이라고 적혀 있다.
//     3. 항목마다 〔관계: 원본 확장 | 원본 해석 | 새 설정〕 이 있다.
//     4. 〔출처: 파일 「문구」〕 의 파일이 있고, 그 파일에 「문구」가 그대로 들어 있다 (대본이 바뀌면 여기서 걸린다).
//     5. '금지 설정:' 줄의 쉼표로 나눈 핵심어가 항목 설정 문장에 들어 있지 않다.
//   나머지 (원본 인적사항 · 세계관 사실과의 일치)는 각 문서 머리의 체크리스트로 사람이 확인한다.
import { UNITS } from '../src/data/units';
declare const process: { exitCode?: number };
declare function require(m: 'node:fs'): { readFileSync(p: string, e: 'utf8'): string; readdirSync(p: string): string[]; existsSync(p: string): boolean };
const fs = require('node:fs');

const DIR = 'lore/인물/확장';
const RELS = ['원본 확장', '원본 해석', '새 설정'];
const names = new Set(UNITS.map((u) => u.name));
const errs: string[] = [];
let docs = 0, items = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md')).sort()) {
  docs++;
  const name = f.replace(/\.md$/, '');
  const at = `${DIR}/${f}`;
  const txt = fs.readFileSync(at, 'utf8');
  if (!names.has(name)) errs.push(`${at}: '${name}'은(는) 기물 이름이 아니다`);
  const sheet = /^원본 시트: (.*)$/m.exec(txt)?.[1] ?? '';
  if (!sheet) errs.push(`${at}: '원본 시트:' 줄이 없다`);
  else if (!sheet.startsWith('없음')) {
    const p = /\((lore\/인물\/[^)]+\.md)\)/.exec(sheet)?.[1];
    if (!p || !fs.existsSync(p)) errs.push(`${at}: 원본 시트 ${p ?? '(경로 없음)'} 가 없다`);
  } else if (fs.existsSync(`lore/인물/${name}.md`)) errs.push(`${at}: lore/인물/${name}.md 가 있는데 '없음'으로 적혀 있다`);
  const banLine = /^금지 설정: (.*)$/m.exec(txt)?.[1];
  if (banLine === undefined) errs.push(`${at}: '금지 설정:' 줄이 없다`);
  const bans = (banLine ?? '').startsWith('(없음)') ? [] : (banLine ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!txt.includes('## 확인 체크리스트')) errs.push(`${at}: 확인 체크리스트가 없다`);
  const body = txt.split('## 항목')[1] ?? '';
  for (const line of body.split('\n').filter((l) => l.startsWith('- '))) {
    items++;
    const rel = /〔관계: ([^〕]+)〕/.exec(line)?.[1];
    if (!rel || !RELS.includes(rel)) errs.push(`${at}: 관계 표시가 없거나 틀렸다 — ${line}`);
    const src = /〔출처: (\S+) 「(.+?)」〕/.exec(line);
    if (!src) errs.push(`${at}: 출처 표시가 없다 — ${line}`);
    else if (!fs.existsSync(src[1])) errs.push(`${at}: 출처 파일 ${src[1]} 이 없다`);
    else if (!fs.readFileSync(src[1], 'utf8').includes(src[2])) errs.push(`${at}: ${src[1]} 에 「${src[2]}」 문구가 없다`);
    const claim = line.slice(2).split('〔')[0];
    for (const b of bans) if (claim.includes(b)) errs.push(`${at}: 금지 설정 '${b}'에 걸린다 — ${claim}`);
  }
}
if (errs.length) {
  console.log(`확장 설정 검사 실패 ${errs.length}건`);
  for (const e of errs) console.log('  ' + e);
  process.exitCode = 1;
} else console.log(`확장 설정 검사 통과 (${docs}개 문서 · ${items}개 항목)`);
