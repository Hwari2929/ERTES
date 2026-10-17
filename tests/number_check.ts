// 숫자 표기 검사: 대사 · 서술의 수량 · 횟수 · 서수는 아라비아 숫자로 쓴다 (CLAUDE.md · docs/SCENES.md · docs/VOICES.md).
//   '세 잔' → '3잔', '백열두 번째' → '112번째', '사흘' → '3일', '셋째 줄' → '3번째 줄'.
//   예외 (허용): '한 번' · '한 잔'처럼 '한'(하나) · '첫' · 어림수(한두 · 두세 · 서너) · 높임 '두 분' · 친족 · 순서 단어(둘째 딸 · 첫째, 둘째, 셋째 나열) · ALLOW 목록.
//   일괄 변환 도우미: python3 scripts/numfix.py [--apply] 파일…
declare const process: { exitCode?: number };
declare function require(m: 'node:fs'): { readFileSync(p: string, e: 'utf8'): string; readdirSync(p: string): string[] };
const fs = require('node:fs');

const FILES: string[] = [
  ...fs.readdirSync('src/data/bar').filter((f) => f.endsWith('.ts')).map((f) => `src/data/bar/${f}`),
  ...fs.readdirSync('docs/banter').filter((f) => f.endsWith('.md')).map((f) => `docs/banter/${f}`),
  ...fs.readdirSync('src/data/scenes').filter((f) => f.endsWith('.ts')).map((f) => `src/data/scenes/${f}`),
  'src/data/voicelines.ts',
  'src/data/achievements.ts', // 업적 이름 · 설명 · 귀띔
];
/** 수량이 아닌 관용 표현 · 고유 표현 (줄에 이 문자열이 있으면 그 부분은 건너뛴다) */
export const ALLOW: string[] = ['하나같이', '한두', '두세', '서너', '두어', '대여섯', '예닐곱', '두 분', '세 분', '네 분'];

const ONE = '두|세|석|네|넉|다섯|여섯|일곱|여덟|아홉';
const TEN = '스물|스무|서른|마흔|예순|일흔|여든|아흔|열|쉰';
const BIG = '(?:[이삼사오육칠팔구]?천)?(?:[이삼사오육칠팔구]?백)?';
const NATIVE = `(?:${BIG}(?:${TEN})(?:${ONE}|한)?|${BIG}(?:${ONE}))`;
const SINO = '(?:[이삼사오육칠팔구]?천|[이삼사오육칠팔구]?백|[이삼사오육칠팔구]?십)(?:[이삼사오육칠팔구]?백)?(?:[이삼사오육칠팔구]?십)?[일이삼사오육칠팔구]?';
const UNIT = '번째|건|문제|문장|글자|자리|그루|바늘|끼|숟갈|합|쌍|페이즈|시간|개월|주일|그릇|접시|마리|조각|마디|봉지|상자|포대|걸음|바퀴|송이|켤레|퍼센트|킬로미터|미터|크레딧|군데|모금|덩이|페이지|가지|개|번|명|잔|살|시|초|층|권|장|척|대|년|달|병|줄|칸|판|곡|편|통|알|근|배|호|벌|쪽|회|겹|갑|점|해';
const RULES: [string, RegExp][] = [
  ['한글 수 + 단위', new RegExp(`(?<![가-힣0-9])(${NATIVE}) (${UNIT})(?![가-힣])|(?<![가-힣0-9])(${NATIVE}) (${UNIT})(?=[째이을를은는의에도만로과와씩짜쯤])`, 'g')],
  ['한자어 수 + 단위', new RegExp(`(?<![가-힣0-9])(${SINO}) (${UNIT}|분)(?![가-힣])|(?<![가-힣0-9])(${SINO}) (${UNIT}|분)(?=[째이을를은는의에도만로과와씩짜쯤])`, 'g')],
  ['날수', /(?<![가-힣])(이틀|사흘|나흘|닷새|엿새|열흘)/g],
  ['두 자리 한글 수', /(?<![가-힣])(열|스물|서른|마흔|쉰)(하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉)(?![가-힣]|[이을를은는의에도만로과와])|(?<![가-힣])(열|스물|서른|마흔|쉰)(하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉)(?=(이|을|를|은|는|의|에|에서|도|만|로|과|와)(?![가-힣]))/g],
  ['서수 + 명사', /(?<![가-힣])(둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열)째 (줄|잔|자리|방법|날|판|칸|장|그릇|접시|조각|병|곡|문제)/g],
];
const hits: string[] = [];
for (const f of FILES) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
    let l = raw;
    for (const a of ALLOW) l = l.split(a).join('　'.repeat(a.length));
    if (/^\s*\/\//.test(l)) return; // 주석
    for (const [name, re] of RULES) for (const m of l.matchAll(re)) hits.push(`${f}:${i + 1} [${name}] '${m[0]}' — ${raw.trim().slice(0, 90)}`);
  });
}
if (hits.length) {
  console.log(`숫자 표기 검사 실패 ${hits.length}건 (아라비아 숫자로: '세 잔' → '3잔'. 관용 표현이면 tests/number_check.ts ALLOW 에 추가)`);
  hits.slice(0, 30).forEach((h) => console.log(' · ' + h));
  process.exitCode = 1;
} else console.log(`숫자 표기 검사: 통과 (${FILES.length}개 파일)`);
