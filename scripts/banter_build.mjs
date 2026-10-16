// 만담(docs/banter/*.md) → src/data/bar/banter.gen.ts 변환. 실행: node scripts/banter_build.mjs
// 형식: `**A × B** — 상황 한 줄` 다음 줄부터 `화자: 대사` (빈 줄로 끝). `## 소제목` 은 묶음 이름.
// 장소 분류: 바(0) · 어디서나(1) · 바 밖(2). 바 밖 만담은 바에서 '통신 기록'으로만 재생한다.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'docs/banter');
const OUT = join(ROOT, 'src/data/bar/banter.gen.ts');

// 화자 이름 → 화자 id (기물 id · 바 전용 id)
const NAME_ID = {
  예레나: 'yelena', 미리내: 'mirinae', 게베크: 'gebek', 도노반: 'donovan', 클로에: 'chloe', 웨스트: 'west', 린디웨: 'lindiwe', 오르카: 'orca',
  프란체: 'franze', 그렌홀름: 'grenholm', 라르스: 'lars', 케빈: 'falcon', 히이로: 'hiiro', 나디르: 'nadir', 테무르: 'temur', 카이로: 'kairo',
  자하라: 'zahara', 비앙카: 'bianca', 제피로: 'zephyro', 필리스: 'phyllis', 엘레니: 'eleni', 이리스: 'iris', 오디세우스: 'odysseus', 아르곤: 'argon',
  로마니: 'romani', 조슈아: 'joshua', 사르마: 'sarma', 카일: 'kyle', 도로스: 'doros', 데미우르고스: 'demiurgos', 에이든: 'aiden', 비비안: 'vivian',
  유피토: 'yupito', 잉겔: 'ingel', 아문센: 'amundsen', 레이첼: 'rachel', 올리버: 'oliver', 라스무스: 'rasmus', 시그문드: 'sigmund', 구닐라: 'gunnir',
  비외른: 'bjorn', 지나: 'zina', 포티니: 'fotini', 카부라야: 'kaburaya', 빌: 'bill', 윈터: 'winter', ISSAC: 'issac', 이든: 'eden', 레이카: 'reika',
  마오: 'mao', 스카디: 'skadi', 밍키: 'mingki', 오닉스: 'onyx', 귀공자: 'exile', 테르모필레: 'thermo', 'U-404': 'u404', 루스: 'rus',
  체사레: 'cesare', 맥스: 'max',
};
// 바 밖 주제 (전장 · 함선 · 셔틀 · 상점)
const AWAY_TOPIC = new Set(['01_deploy', '02_victory', '03_supply', '05_travel', '12_inbattle', '13_shiplife', '15_fields', '17_missions', '21_shopquick']);
const AWAY_WORD = /함선|셔틀|화물칸|함교|격납고|기관실|덕트|식당|휴게실|의무실|전장|현장|강하|작전실|선실|갑판|주방|연구실|훈련장|사격장|정박|출격|전투|배치|교전|본가|저택|정원|성도회 수도원|보급|상점|병실|검진|우주|궤도|사막|설원|정글|폐광|해양|복도|침실|엔진|조타|항해|레이스|경기장|경주|대기실|관람석|돌격|작업실|창구|레이싱|무대|공연장|객실|사무실|회의|브리핑|집무실|매장|꽃집|시장|항구|부두|기도|체육관|본가|레일건|배에|검사|근력|도서관|해변|숲|산책/;
const BAR_WORD = /바 |바,|바에|바의|바$|카운터|당직|에란테스 바|술자리|발코니|창가|테이블/;

const files = readdirSync(DIR).filter((f) => /^\d\d_.*\.md$/.test(f)).sort();
const topics = [];
const out = [];
const unknown = new Set();
for (const f of files) {
  const key = f.replace(/\.md$/, '');
  const src = readFileSync(join(DIR, f), 'utf8').split('\n');
  const title = (src[0] || '').replace(/^#\s*/, '').trim();
  topics.push([key, title]);
  const ti = topics.length - 1;
  let sub = '', cur = null, n = 0;
  const flush = () => { if (cur && cur.lines.length) out.push(cur); cur = null; };
  for (const raw of src) {
    const ln = raw.trimEnd();
    const h = ln.match(/^##\s+(.+)/);
    if (h) { flush(); sub = h[1].trim(); continue; }
    const m = ln.match(/^\*\*(.+?)\*\*\s*—\s*(.*)$/);
    if (m) {
      flush();
      const cast = m[1].split('×').map((s) => s.trim()).map((nm) => NAME_ID[nm] || (unknown.add(nm), nm));
      cur = { id: `${key.slice(0, 2)}.${++n}`, t: ti, sub, sit: m[2].trim(), cast, lines: [] };
      continue;
    }
    if (!ln.trim()) { flush(); continue; }
    if (!cur) continue;
    const l = ln.match(/^([^:]{1,14}):\s(.*)$/);
    if (!l) { unknown.add(`줄: ${ln}`); continue; }
    // 'A · B: …' = 둘이 함께 말한다 (첫 사람 자리에 이름표는 둘 다)
    const names = l[1].split('·').map((s) => s.trim());
    const ids = names.map((nm) => NAME_ID[nm]);
    if (ids.some((x) => !x)) unknown.add(l[1].trim());
    cur.lines.push(names.length > 1 ? [ids[0] || names[0], l[2].trim(), names.join(' · ')] : [ids[0] || names[0], l[2].trim()]);
    if (names.length > 1) for (const x of ids.slice(1)) if (x && !cur.cast.includes(x)) cur.cast.push(x);
  }
  flush();
}
for (const b of out) {
  const key = topics[b.t][0];
  const text = b.sit + ' ' + b.sub;
  b.place = AWAY_TOPIC.has(key) || AWAY_WORD.test(b.sit) || (AWAY_WORD.test(b.sub) && !BAR_WORD.test(b.sit)) ? 2 : key === '04_bar' || BAR_WORD.test(text) ? 0 : 1;
  // 대사 속에 함선 공간이 나오면 바 밖으로
  if (b.place !== 2 && b.lines.some(([, t]) => /함선|셔틀|화물칸|격납고|함교|기관실/.test(t))) b.place = 2;
  // 출연자: 대사 화자 ∪ 머리줄 인물 (체사레는 조슈아로)
  const ids = new Set([...b.cast, ...b.lines.map(([w]) => w)].map((w) => (w === 'cesare' ? 'joshua' : w)));
  b.cast = [...ids];
}
// 층 태그: 표면(s, 말버릇 · 소재) · 이상(i, 가치 · 목표 · 입장) · 실재(r, 상처 · 기제). 키워드 자동 + LAYER_FIX 수동 보정
const DEEP = /사별|브샤크|로도스|거미집|기도서|살아남아라|벤데타|숨어 살|묘비|금서|읽혔|병합|유랑령|어머니|전도사|구토|표정 연습|기억이 비|기억 소실|노예|해리|돌아오지 못|못 지켰|무덤|장례|위령|유품|떠난 사람|마지막 수/;
const IDEAL = /정의|윤리|신념|원칙|목표|버킷리스트|승천|자유|책임|의미가|왜 싸|용병이|약속|지키는|믿어|추모|신앙|기도|꿈이|명예|배신|복수|계약서에 없는|사람을 살리|이기는 게/;
// 이상 · 실재는 키워드가 잘못 걸리기 쉬워 (기도 · 목표 · 책임 같은 말은 대개 개그) 수동으로만 올린다. DEEP 는 후보 표시용
const cand = [];
const LAYER_FIX = {
  '11.11': 'r', // 오르카 × 비비안: 브샤크 음식 기억 ("같은 걸 기억하는 사람이 있으니")
  '08.20': 'i', // 유피토 × 필리스: 후임 · 책임
  '11.32': 'i', // 미리내: 부모님께 계약을 숨긴다
  '10.19': 'i', // 테르모필레: '물러서라'
  '18.10': 'i', // 웨스트 × 테르모필레: 한 발 물러서는 게 고장
  '13.38': 'i', // 오닉스 × ISSAC: 혼자인데 합창으로 들린다 (군체 기색이 새어 나옴)
};
for (const b of out) {
  const all = [b.sit, b.sub, ...b.lines.map((l) => l[1])].join(' ');
  b.layer = LAYER_FIX[b.id] || 's';
  if (!LAYER_FIX[b.id] && (DEEP.test(all) || IDEAL.test(all))) cand.push(`${b.id} ${b.sit}`);
}
if (unknown.size) { console.error('알 수 없는 화자 · 줄:', [...unknown].join(', ')); process.exit(1); }

const J = (x) => JSON.stringify(x);
const body = `// 자동 생성: node scripts/banter_build.mjs (원본 docs/banter/*.md) — 직접 고치지 말 것
/** 만담 주제: [파일 키, 제목] */
export const BANTER_TOPICS: [string, string][] = ${J(topics)};
/** 만담 한 편: id · 주제 번호 · 소제목 · 상황 · 장소(0 바 · 1 어디서나 · 2 바 밖) · 층(s 표면 · i 이상 · r 실재) · 출연 기물 · 대사 [화자, 대사, 이름표?] */
export interface Banter { id: string; t: number; sub: string; sit: string; place: 0 | 1 | 2; layer: 's' | 'i' | 'r'; cast: string[]; lines: ([string, string] | [string, string, string])[] }
export const BANTER: Banter[] = [
${out.map((b) => `  {id:${J(b.id)},t:${b.t},sub:${J(b.sub)},sit:${J(b.sit)},place:${b.place},layer:${J(b.layer)},cast:${J(b.cast)},lines:${J(b.lines)}},`).join('\n')}
];
`;
writeFileSync(OUT, body);
const cnt = [0, 0, 0];
for (const b of out) cnt[b.place]++;
const lay = { s: 0, i: 0, r: 0 };
for (const b of out) lay[b.layer]++;
console.log(`층: 표면 ${lay.s} · 이상 ${lay.i} · 실재 ${lay.r} (키워드 후보 ${cand.length}편은 표면 유지, LAYER_FIX 로 수동 지정)`);
console.log(`만담 ${out.length}편 · 주제 ${topics.length}개 → ${OUT.replace(ROOT, '')} (바 ${cnt[0]} · 어디서나 ${cnt[1]} · 바 밖 ${cnt[2]})`);
