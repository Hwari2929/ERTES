// 소재 사용 횟수 검사. npm run check 에서 함께 돈다. 3차 정리로 초과 0건이 되어, 이제 기준을 넘으면 실패한다 (--warn 이면 경고만).
//   인물별 표면 소재(말버릇 · 취미 · 반복 개그 키워드)가 만담 · 사건 장면 · 바 대본에서 몇 번 쓰였는지 센다.
//   기준(limit)을 넘으면 경고 → 그 소재 대신 이상 · 실재 층(docs/VOICES.md '새어 나오는 방식')으로 쓴다.
//   표 갱신: node dist/motif_check.cjs --doc  (docs/MOTIFS.md)
declare const process: { argv: string[]; exitCode?: number };
declare function require(m: 'node:fs'): { readFileSync(p: string, e: 'utf8'): string; writeFileSync(p: string, s: string): void; readdirSync(p: string): string[] };
const fs = require('node:fs');

/** 인물 → [소재 이름, 정규식, 기준 횟수] (기준 생략 = 8) */
export const MOTIFS: Record<string, [string, RegExp, number?][]> = {
  게베크: [['스콜치', /스콜치/], ['지르곤', /지르곤/, 5], ['유행어 흉내', /킹받|맵부심|요즘 애들 말로|유행어/], ['핵융합볶음면', /핵융합볶음면/], ['트림에 불', /트림/, 5]],
  웨스트: [['꿀', /꿀(?!잠)/], ['점검구', /점검구/, 5], ['이불 · 일광 건조', /이불|일광/], ['담배', /담배/], ['부계정 · 좋아요', /부계정|좋아요/, 2], ['시드르', /시드르/]],
  비비안: [['에취(재채기)', /에취/], ['카주', /카주/, 5], ['셀카 보정', /셀카|보정/, 5], ['스튜', /스튜/]],
  테무르: [['아이스크림 · 냉동고', /아이스크림|냉동고/], ['고기', /고기/, 15], ['돌 조각', /돌 조각|돌을 깎|조각칼/, 6]],
  필리스: [['긴급 조달', /긴급 조달/], ['체리', /체리/], ['땡땡이', /땡땡이/, 5]],
  예레나: [['가챠 · 천장', /가챠|천장/], ['다크 링거', /다크 링거/], ['주식', /주식/], ['급여 공제', /공제/]],
  린디웨: [['포케', /포케/, 5], ['네일', /네일/, 5], ['고양이', /고양이/, 15]],
  오르카: [['염도', /염도/], ['여자친구', /여자친구/], ['블랑카', /블랑카/, 5], ['동전 마술', /동전/, 5]],
  프란체: [['머리에 불', /불이 붙|불 붙|머리에 불/], ['아이스 아메리카노', /아메리카노/, 6], ['화분', /화분/, 6], ['3분 라면', /3분 라면|라면/, 6]],
  나디르: [['백수정 저글링', /저글링/, 6], ['샴페인', /샴페인/, 5], ['사마라', /사마라/, 6]],
  유피토: [['콩이', /콩이/], ['비장의 한 수', /비장의 한 수/, 6], ['에이든 팔 뜯기', /팔 한쪽|뜯어 보/, 4]],
  에이든: [['핫초코 곱빼기', /핫초코 곱빼기/, 10], ['마시멜로', /마시멜로/, 6], ['고양이로 변신', /고양이로 변/, 5]],
  아문센: [['땅콩버터', /땅콩버터/], ['음치', /음치/, 4], ['회중시계', /회중시계/, 4]],
  제피로: [['눕기', /눕|누워/, 12], ['한 잔에 기절', /기절/, 5]],
  엘레니: [['바클라바', /바클라바/, 6], ['똥 · 방귀', /똥|방귀/, 6], ['위협용 대검', /위협용/, 4]],
  카이로: [['에덴 글라스', /에덴 글라스/, 4], ['11.8킬로미터', /11\.8/, 3], ['다트', /다트/, 6]],
  도노반: [['비타민 캔디', /비타민 캔디/, 5], ['까악이', /까악이|리비볼드/, 6], ['유행어 뜻 묻기', /뜻이 뭐|뭔데\./, 5]],
  자하라: [['딸기', /딸기/, 6], ['추천 수', /추천 수/, 4], ['술 대 차', /술 대 차/, 4]],
  클로에: [['머리만 뜬 사진', /머리만/, 4], ['졸기', /졸|조는/, 8]],
  비앙카: [['손 일곱 번', /일곱 번/, 4], ['몇 번 표정', /번 표정/, 4], ['베헤모스', /베헤모스/, 6]],
  조슈아: [['당근 주스', /당근 주스/, 4], ['감자 그림', /감자/, 4], ['해장약', /해장약/, 5]],
  라르스: [['할러', /할러/, 6], ['탈모 · 머리', /탈모|머리숱/, 6], ['밍키 협상', /츄르/, 8]],
  그렌홀름: [['악어', /악어/, 4], ['554년', /554/, 5]],
  이리스: [['굿즈', /굿즈/, 6], ['벽에 부딪힘', /벽에|또 벽/, 4]],
};

/** 인물 이름 → 기물 id (사건 · 바 대본의 화자 id) */
const ID: Record<string, string> = {
  게베크: 'gebek', 웨스트: 'west', 비비안: 'vivian', 테무르: 'temur', 필리스: 'phyllis', 예레나: 'yelena', 린디웨: 'lindiwe', 오르카: 'orca', 프란체: 'franze',
  나디르: 'nadir', 유피토: 'yupito', 에이든: 'aiden', 아문센: 'amundsen', 제피로: 'zephyro', 엘레니: 'eleni', 카이로: 'kairo', 도노반: 'donovan', 자하라: 'zahara',
  클로에: 'chloe', 비앙카: 'bianca', 조슈아: 'joshua', 라르스: 'lars', 그렌홀름: 'grenholm', 이리스: 'iris',
};
const SOURCES: [string, string, RegExp][] = [
  ['만담', 'docs/banter', /\.md$/],
  ['사건', 'src/data/scenes', /\.ts$/],
  ['바', 'src/data/bar', /^(talk|frames.*|ask.*)\.ts$/],
];
// 줄마다 '이 줄이 누구 몫인가'를 붙인다: 만담 = 그 편의 출연자 전원, 코드 = 화자 id · 묶음 키 · 이름표
type Line = { t: string; who: Set<string>; at: string };
const text: Record<string, Line[]> = {};
const NAMES = Object.keys(ID);
for (const [k, dir, re] of SOURCES) {
  text[k] = [];
  for (const f of fs.readdirSync(dir).filter((x) => re.test(x)).sort()) {
    let cast = new Set<string>(), block = '';
    let ln = 0;
    for (const t of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
      ln++;
      const who = new Set<string>();
      if (k === '만담') {
        const h = t.match(/^\*\*(.+?)\*\*/);
        if (h) cast = new Set(h[1].split('×').map((x) => x.trim()));
        if (!t.trim()) cast = new Set();
        cast.forEach((n) => who.add(n));
      } else {
        const b = t.match(/^\s{2,6}(\w+): [\[{]/);
        if (b) block = b[1];
        for (const n of NAMES) if (t.includes(`'${ID[n]}'`) || t.includes(n) || block === ID[n]) who.add(n);
      }
      text[k].push({ t, who, at: `${dir}/${f}:${ln}` });
    }
  }
}
interface Row { who: string; name: string; n: Record<string, number>; total: number; limit: number }
const rows: Row[] = [];
for (const [who, list] of Object.entries(MOTIFS)) {
  for (const [name, re, lim] of list) {
    const n: Record<string, number> = {};
    for (const [k] of SOURCES) n[k] = text[k].filter((l) => l.who.has(who) && re.test(l.t)).length;
    const total = Object.values(n).reduce((a, b) => a + b, 0);
    rows.push({ who, name, n, total, limit: lim ?? 8 });
  }
}
rows.sort((a, b) => b.total / b.limit - a.total / a.limit);
const over = rows.filter((r) => r.total > r.limit);
if (process.argv.includes('--list')) { // 기준을 넘은 소재의 줄 위치
  for (const r of rows.filter((x) => x.total > x.limit)) {
    console.log(`## ${r.who} ${r.name} ${r.total}/${r.limit}`);
    const re = MOTIFS[r.who].find((m) => m[0] === r.name)![1];
    for (const [k] of SOURCES) for (const l of text[k]) if (l.who.has(r.who) && re.test(l.t)) console.log(`${l.at}  ${l.t.trim().slice(0, 150)}`);
  }
}
if (process.argv.includes('--doc')) {
  const head = `# 소재 사용 횟수 (자동 생성: tests/motif_check.ts --doc)

인물별 표면 소재가 그 인물이 나오는 만담(docs/banter) · 사건 장면(src/data/scenes) · 바 대본(src/data/bar)에 나온 줄 수. 기준을 넘으면 \`npm run check\` 가 실패한다 (3차 정리 뒤 초과 0건).
넘은 소재는 새 글에서 쉬게 하고, 그 인물의 이상 · 실재 층(docs/VOICES.md '새어 나오는 방식')으로 쓴다.

| 인물 | 소재 | 만담 | 사건 | 바 | 합계 | 기준 | |
|---|---|---:|---:|---:|---:|---:|---|
`;
  fs.writeFileSync('docs/MOTIFS.md', head + rows.map((r) => `| ${r.who} | ${r.name} | ${r.n['만담']} | ${r.n['사건']} | ${r.n['바']} | ${r.total} | ${r.limit} | ${r.total > r.limit ? '⚠ 초과' : ''} |`).join('\n') + '\n');
}
if (over.length) {
  console.log(`소재 검사: 기준 초과 ${over.length}건 (표는 docs/MOTIFS.md). 그 소재 대신 이상 · 실재 층으로 쓰거나 다른 개그로 바꾼다`);
  for (const r of over.slice(0, 12)) console.log(` · ${r.who} '${r.name}' ${r.total}회 (기준 ${r.limit}) — 만담 ${r.n['만담']} · 사건 ${r.n['사건']} · 바 ${r.n['바']}`);
  if (over.length > 12) console.log(`   … 외 ${over.length - 12}건`);
  if (!process.argv.includes('--warn')) process.exitCode = 1;
} else console.log('소재 검사: 통과');
