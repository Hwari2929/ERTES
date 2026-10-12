// 사건 연출 검사: 화자 · 등록부 키 · 조연 자리 · 결과 장면 키 · 줄 수 · 인물 등장 빈도
// 실행: npx esbuild tests/scenes_check.ts --bundle --platform=node --format=cjs --outfile=dist/scenes_check.cjs && node dist/scenes_check.cjs
import { EVENTS } from '../src/data/events';
import { BGMS, BGS, NPCS, SFXS, type Beat, type ScriptLine } from '../src/data/scene';
import { EVENT_SCENES } from '../src/data/scenes';
import { UNIT_BY_ID } from '../src/data/units';

declare const process: { exitCode: number };
const errs: string[] = [], warns: string[] = [];
const lead = new Map<string, number>(), subN = new Map<string, number>();
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
const isSlot = (l: ScriptLine): l is { slot: 'sub' } => 'slot' in l;

function checkBeats(where: string, beats: Beat[], vars: Set<string>) {
  for (const b of beats) {
    if (b.who && b.who !== 'pc' && !UNIT_BY_ID[b.who] && !NPCS[b.who]) errs.push(`${where}: 화자 '${b.who}' 없음`);
    if (b.who === 'pc') errs.push(`${where}: 주인공 대사`);
    for (const s of b.stage || []) if (!UNIT_BY_ID[s.id] && !NPCS[s.id]) errs.push(`${where}: stage '${s.id}' 없음`);
    if (b.bg && !BGS[b.bg]) errs.push(`${where}: 배경 '${b.bg}' 미등록`);
    if (b.bgm && !BGMS[b.bgm]) errs.push(`${where}: 배경음 '${b.bgm}' 미등록`);
    if (b.sfx && !SFXS[b.sfx]) errs.push(`${where}: 효과음 '${b.sfx}' 미등록`);
    for (const m of b.text.matchAll(/\{(\w+)\}/g)) if (!vars.has(m[1])) errs.push(`${where}: 변수 {${m[1]}} 를 넘기는 곳 없음`);
    if (/^["“]/.test(b.text) && b.who) warns.push(`${where}: 대사에 따옴표`);
  }
}

let done = 0;
for (const ev of EVENTS) {
  const sc = EVENT_SCENES[ev.id];
  if (!sc) { warns.push(`${ev.id}: 연출 없음`); continue; }
  done++;
  sc.cast.forEach((c) => { if (!UNIT_BY_ID[c] && !NPCS[c]) errs.push(`${ev.id}: 주연 '${c}' 없음`); bump(lead, c); });
  const body = sc.scene.filter((l): l is Beat => !isSlot(l));
  const slots = sc.scene.length - body.length;
  if (sc.subs && slots !== 1) errs.push(`${ev.id}: 조연 자리 ${slots}개`);
  if (!body[0]?.bg || !body[0]?.bgm) warns.push(`${ev.id}: 첫 줄 bg/bgm 없음`);
  if (body.length < 14 || body.length > 27) warns.push(`${ev.id}: 본문 ${body.length}줄`);
  const base = new Set(['pc', 'sub']);
  checkBeats(`${ev.id}/본문`, body, base);
  for (const [id, beats] of Object.entries(sc.subs || {})) {
    if (!UNIT_BY_ID[id]) errs.push(`${ev.id}: 조연 후보 '${id}' 는 기물이 아님`);
    if (sc.cast.includes(id)) errs.push(`${ev.id}: 조연 후보 '${id}' 가 주연`);
    if (beats.length < 2 || beats.length > 6) warns.push(`${ev.id}/조연 ${id}: ${beats.length}줄`);
    checkBeats(`${ev.id}/조연 ${id}`, beats, base);
    bump(subN, id);
  }
  const n = Object.keys(sc.subs || {}).length;
  if (n && (n < 4 || n > 6)) warns.push(`${ev.id}: 조연 후보 ${n}명`);
  if ((sc.after?.length ?? 0) > ev.choices.length) errs.push(`${ev.id}: 결과 장면 ${sc.after!.length}개 > 선택지 ${ev.choices.length}개`);
  ev.choices.forEach((c, i) => {
    const a = sc.after?.[i];
    const src = c.apply.toString();
    const vars = new Set([...base, ...[...src.matchAll(/outcome\([^)]*\{\s*([^}]*)\}/g)].flatMap((m) => m[1].split(',').map((x) => x.split(':')[0].trim())).filter(Boolean)]);
    if (!a) { warns.push(`${ev.id}: 선택지 ${i} 결과 장면 없음`); return; }
    const sets = Array.isArray(a) ? { default: a } : a;
    for (const [k, beats] of Object.entries(sets)) {
      if (!Array.isArray(a) && k !== 'default' && !new RegExp(`outcome\\(['"]${k}['"]`).test(src)) errs.push(`${ev.id}: 선택지 ${i} 결말 '${k}' 를 고르는 outcome 호출 없음`);
      if (beats.length < 2 || beats.length > 8) warns.push(`${ev.id}: 선택지 ${i}/${k} ${beats.length}줄`);
      checkBeats(`${ev.id}/선택 ${i}/${k}`, beats, vars);
    }
    if (!Array.isArray(a)) for (const m of src.matchAll(/outcome\(['"](\w+)['"]/g)) if (!(m[1] in a) && !('default' in a)) errs.push(`${ev.id}: 선택지 ${i} 결말 '${m[1]}' 장면 없음`);
  });
}

const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${UNIT_BY_ID[k]?.name || k} ${v}`).join(', ');
console.log(`연출 ${done}/${EVENTS.length}편`);
console.log(`주연 빈도: ${top(lead)}`);
console.log(`조연 빈도: ${top(subN)}`);
if (warns.length) console.log(`\n경고 ${warns.length}\n- ${warns.join('\n- ')}`);
if (errs.length) { console.log(`\n오류 ${errs.length}\n- ${errs.join('\n- ')}`); process.exitCode = 1; }
