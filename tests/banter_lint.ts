// 바 대사 문체 검사 (경고만, 실패하지 않는다): docs/SCENES.md '대사 지침 6차' · docs/BANTER.md 장면 모양 · src/data/voicereg.ts 대상별 어체.
// 읽는 대본: 만담(banter.gen) · 끼어들기 틀 · 말 걸기(talk) · 물어보기(ask) · 작별 · 혼잣말 · 주문 대사.
// 경고 종류: 어체 (상대에게 쓰는 어체와 다른 줄) · 줄 머리 '…' 과다 · '?!' 과다 · 명사 파편 · 같은 어미 쏠림 · 담화표지 과다 · 번역투 ·
//   만담 모양 (4줄 비율 · A-B-A-B 비율). npx esbuild tests/banter_lint.ts --bundle --platform=node --outfile=dist/banter_lint.cjs && node dist/banter_lint.cjs [--all]
import { BANTER } from '../src/data/bar/banter.gen';
import { FRAMES } from '../src/data/bar/frames';
import { BAR_TALK, BAR_IDLE } from '../src/data/bar/talk';
import { ASK } from '../src/data/bar/ask';
import { LEAVE_LINES } from '../src/data/bar/leave';
import { ERANTES_CREW, MONO } from '../src/data/bar/mono';
import { ORDER_TALK } from '../src/data/bar/orderlines';
import { FIRST_MEET } from '../src/data/bar/firstmeet';
import { UNITS } from '../src/data/units';
import { REG_NAME, VOICE, regFor, type Reg } from '../src/data/voicereg';
declare const process: { argv?: string[] };

const ALL = process.argv?.includes('--all');
const CREW = new Set([...ERANTES_CREW, 'rachel']);
const NAME_ID: Record<string, string> = Object.fromEntries([...UNITS.map((u) => [u.name, u.id]), ['포티니', 'fotini'], ['레이카', 'reika'], ['오닉스', 'onyx'], ['귀공자', 'exile'], ['체사레', 'cesare'], ['레이첼', 'rachel'], ['에이든', 'aiden']]);
const nm = (id: string) => VOICE[id]?.name || id;

/** 대사 한 줄: 화자 · 듣는 사람(모르면 '') · 글 · 출처 */
type L = { who: string; to: string; t: string; at: string };
const lines: L[] = [];
const parse = (l: string, owner: string): [string, string] | null => {
  if (l.startsWith('* ') || /^@\d$/.test(l)) return null;
  const m = l.match(/^([^:\s]{1,8}): (.*)$/);
  return m && NAME_ID[m[1]] ? [NAME_ID[m[1]], m[2]] : [owner, l];
};
for (const b of BANTER) {
  if (b.hold) continue;
  const cast = [...new Set(b.cast)];
  for (const [w0, t, nmx] of b.lines) { const w = nmx === '체사레' || w0 === 'cesare' ? 'cesare' : w0; lines.push({ who: w, to: cast.length === 2 ? cast.find((c) => c !== w0) || '' : '', t: t.replace(/^\(체사레\)\s*/, ''), at: `만담 ${b.id}` }); }
}
for (const f of FRAMES) {
  for (const l of f.lines) { const p = parse(l, f.cast[0]); if (p) lines.push({ who: p[0], to: f.cast.length === 2 ? f.cast.find((c) => c !== p[0]) || '' : '', t: p[1], at: `틀 ${f.id}` }); }
  for (const sl of f.slots) for (const [id, ls] of Object.entries(sl)) for (const l of ls) { const p = parse(l, id); if (p) lines.push({ who: p[0], to: '', t: p[1], at: `틀 ${f.id}/${id}` }); }
}
for (const [id, tk] of Object.entries(BAR_TALK)) {
  for (const tp of tk.topics) for (const l of tp.lines) { const p = parse(l, id); if (p) lines.push({ who: p[0], to: p[0] === id ? 'rachel' : '', t: p[1], at: `말 걸기 ${id}.${tp.key}` }); }
}
for (const it of BAR_IDLE) for (const l of it.lines) { const p = parse(l, 'aiden'); if (p) lines.push({ who: p[0], to: '', t: p[1], at: '바텐더 대화' }); }
for (const [id, a] of Object.entries(ASK)) for (const [k, v] of Object.entries(a)) for (const x of (Array.isArray(v) ? v : [v])) if (typeof x === 'string') for (const l of x.split(' / ')) { const p = parse(l.replace(/^\* [^/]*$/, ''), id); if (p && p[1]) lines.push({ who: p[0], to: p[0] === id ? 'rachel' : '', t: p[1], at: `물어보기 ${id}.${k}` }); }
for (const [id, ls] of Object.entries(LEAVE_LINES)) for (const l of ls) lines.push({ who: id, to: '', t: l.replace(/^〔(낮|밤)〕\s*/, ''), at: `작별 ${id}` });
for (const [id, m] of Object.entries(MONO)) for (const [k, l] of Object.entries(m)) lines.push({ who: id, to: '', t: l.replace(/^〔(낮|밤)〕\s*/, ''), at: `혼잣말 ${id}.${k}` });
for (const [id, ls] of Object.entries(FIRST_MEET)) for (const l of ls) { const p = parse(l, id); if (p) lines.push({ who: p[0], to: p[0] === id ? 'rachel' : p[0] === 'rachel' ? id : '', t: p[1], at: `첫 만남 ${id}` }); }
for (const [id, t] of Object.entries(ORDER_TALK)) for (const [k, v] of Object.entries(t)) for (const l of (Array.isArray(v) ? v : [v])) lines.push({ who: id, to: 'rachel', t: l, at: `주문 ${id}.${k}` });

// ───────── 문장 · 어미
/** 따옴표 속 인용을 뺀 문장들 (마침표 · 물음표 · 느낌표 · 말줄임 · 물결로 나눔) */
const sentences = (t: string) => t.replace(/'[^']*'|"[^"]*"|「[^」]*」/g, '').split(/(?<=[.!?…~])\s+|[.!?…~-]+$/).map((s) => s.replace(/[.!?…~\-—,\s)]+$/, '').trim()).filter(Boolean);
const HON = /(요|니다|니까|십시오|세요|지요|죠|까요|소서)$/;
const PLAIN = /(다|야|어|아|지|냐|니|래|게|자|거든|잖아|군|걸|데|라|해|줘|돼|봐|겠어|했어|었어|았어|할게|할래|거야|잖아|구나|던데|는데|은데|더라|마|렴)$/;
type Cls = 'hon' | 'plain' | null;
const clsOf = (s: string): Cls => (HON.test(s) ? 'hon' : PLAIN.test(s) ? 'plain' : null);
const want = (r: Reg | null): Cls => (r === 'yo' || r === 'hap' ? 'hon' : r === 'ban' ? 'plain' : null);

type W = { kind: string; who: string; msg: string; ex: string[] };
const warns: W[] = [];
const byWho = new Map<string, L[]>();
for (const l of lines) { if (!byWho.has(l.who)) byWho.set(l.who, []); byWho.get(l.who)!.push(l); }

// 1) 어체: 듣는 사람이 분명한 줄 (2인 만담 · 2인 틀 핵심 · 레이첼에게 하는 말)
const regMiss = new Map<string, string[]>();
for (const l of lines) {
  if (!l.to || !VOICE[l.who]) continue;
  const r = regFor(l.who, l.to, CREW);
  const w = want(r);
  if (!w) continue;
  const bad = sentences(l.t).map(clsOf).filter((c) => c && c !== w);
  if (bad.length && bad.length === sentences(l.t).map(clsOf).filter(Boolean).length) {
    const k = `${l.who}>${l.to}`;
    if (!regMiss.has(k)) regMiss.set(k, []);
    regMiss.get(k)!.push(`${l.at}: ${l.t}`);
  }
}
for (const [k, ex] of regMiss) { const [a, b] = k.split('>'); warns.push({ kind: '어체', who: a, msg: `${nm(a)} → ${nm(b)}: ${REG_NAME[regFor(a, b, CREW)!]} 이어야 하는데 다른 어체 ${ex.length}줄`, ex }); }

// 2) 인물별 버릇: 줄 머리 '…' · '?!' · 명사 파편 · 같은 어미 쏠림 · 담화표지
for (const [who, ls] of byWho) {
  if (!VOICE[who] || ls.length < 12) continue;
  const n = ls.length;
  const ell = ls.filter((l) => /^…/.test(l.t));
  if (ell.length / n > 0.25) warns.push({ kind: "줄 머리 '…'", who, msg: `${nm(who)}: ${ell.length}/${n}줄 (${Math.round((ell.length / n) * 100)}%, 기준 25%)`, ex: ell.map((l) => `${l.at}: ${l.t}`) });
  const qe = ls.filter((l) => /\?!|!\?/.test(l.t));
  if (qe.length > 3) warns.push({ kind: "'?!'", who, msg: `${nm(who)}: ${qe.length}줄 (기준 3)`, ex: qe.map((l) => `${l.at}: ${l.t}`) });
  const frag = ls.filter((l) => { const ss = sentences(l.t); return ss.length >= 2 && ss.filter((s) => s.split(/\s+/).length <= 2 && !clsOf(s) && !/[가-힣](요|다|까|네|군|지|오|소|게|나)$/.test(s)).length >= 2; });
  if (frag.length / n > 0.15) warns.push({ kind: '명사 파편', who, msg: `${nm(who)}: 짧은 명사 문장이 둘 이상인 줄 ${frag.length}/${n} (기준 15%)`, ex: frag.map((l) => `${l.at}: ${l.t}`) });
  const ends = new Map<string, number>();
  for (const l of ls) for (const s of sentences(l.t)) { const e = s.slice(-2); ends.set(e, (ends.get(e) || 0) + 1); }
  const tot = [...ends.values()].reduce((a, b) => a + b, 0);
  const top = [...ends.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && tot >= 30 && top[1] / tot > 0.3 && !(top[0] === '니다' && (VOICE[who].base === 'hap' || VOICE[who].base === 'mix'))) // 합쇼체 인물의 '~니다'는 어체 자체라 세지 않는다
    warns.push({ kind: '어미 쏠림', who, msg: `${nm(who)}: 문장 끝 '${top[0]}' ${top[1]}/${tot} (${Math.round((top[1] / tot) * 100)}%, 기준 30%)`, ex: [] });
  const mk = VOICE[who].marker.replace(/[.,…!?]+$/, '').trim();
  if (mk.length >= 2) {
    const hit = ls.filter((l) => l.t.includes(mk));
    if (hit.length / n > 0.2) warns.push({ kind: '담화표지 과다', who, msg: `${nm(who)}: '${mk}' ${hit.length}/${n}줄 (기준 20% — 장면당 한두 번)`, ex: hit.slice(0, 6).map((l) => `${l.at}: ${l.t}`) });
  }
}
// 3) 번역투
const TRANS = [/그것은 /, /에 대해서/, /하는 것은 /, /에 의해/, /을 가지고 있/, /를 가지고 있/, /하는 중이다/, /하는 중입니다/, /것이 필요하다/, /하지 않을 수 없/];
const tr = lines.filter((l) => TRANS.some((re) => re.test(l.t)));
if (tr.length) warns.push({ kind: '번역투', who: '', msg: `번역투 표현 ${tr.length}줄`, ex: tr.map((l) => `${l.at} (${nm(l.who)}): ${l.t}`) });

// 4) 만담 모양: 4줄 비율 · A-B-A-B 비율 (docs/BANTER.md: 4줄 30% 이하, 2~3줄 40% 안팎)
const live = BANTER.filter((b) => !b.hold);
const len = (k: number) => live.filter((b) => b.lines.length === k).length;
const four = len(4), short = len(2) + len(3);
const abab = live.filter((b) => b.lines.length === 4 && b.lines[0][0] === b.lines[2][0] && b.lines[1][0] === b.lines[3][0] && b.lines[0][0] !== b.lines[1][0]).length;
if (four / live.length > 0.3) warns.push({ kind: '만담 모양', who: '', msg: `4줄 만담 ${four}/${live.length} (${Math.round((four / live.length) * 100)}%, 목표 30% 이하) · 그중 A-B-A-B ${abab}편 · 2~3줄 ${short}편 (${Math.round((short / live.length) * 100)}%, 목표 40% 안팎)`, ex: [] });

// ───────── 출력
const kinds = [...new Set(warns.map((w) => w.kind))];
console.log(`바 대사 문체 검사 (경고): 대본 ${lines.length}줄 · 인물 ${byWho.size}명 · 어체 표 ${Object.keys(VOICE).length}명`);
for (const k of kinds) {
  const ws = warns.filter((w) => w.kind === k);
  const n = k === '어체' ? ws.reduce((a, w) => a + w.ex.length, 0) : ws.length;
  console.log(`  ${k}: ${n}${k === '어체' ? '줄' : '건'}`);
  for (const w of ws.slice(0, ALL ? 999 : 6)) {
    console.log(`    · ${w.msg}`);
    for (const e of w.ex.slice(0, ALL ? 999 : 2)) console.log(`        ${e}`);
  }
}
if (!warns.length) console.log('  경고 없음');
