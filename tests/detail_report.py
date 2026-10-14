# 상세 밸런스 집계: balance.cjs detail 모드 출력(런마다 `키|페이즈` → [전투, 승리])을 모아
# 기물 · 증강 · 학파 · 성유물별 '페이즈 보정 승률 차이'와 런 군집 95% 신뢰구간을 계산한다.
# 실행: python3 tests/detail_report.py <A 폴더(일반)> <B 폴더(성유물 무작위)> <meta.json> > 표.md
#  - 페이즈 보정: 각 전투의 승리(0/1)에서 그 페이즈의 전체 평균 승률을 뺀 값의 평균 (= 기준 대비 %p)
#  - 기물 내 비교: 같은 기물이 그 증강을 가졌을 때 vs 안 가졌을 때 (기물 차이를 지움)
#  - 신뢰구간: 같은 런의 전투는 서로 묶여 있으므로 런 단위 군집 표준오차 (±1.96 SE)
import json, glob, sys, math, collections

A, B, META = sys.argv[1], sys.argv[2], sys.argv[3]
M = json.load(open(META))
UN = {u['id']: u for u in M['units']}
AUG = M.get('augs', {})

def load(d):
    runs = []
    for p in sorted(glob.glob(f'{d}/part*.json')): runs += json.load(open(p))['runs']
    return runs

def baseline(runs):
    t = collections.defaultdict(lambda: [0, 0])
    for r in runs:
        for k, (n, w) in r['det'].items():
            if k.startswith('u:'):
                ph = k.rsplit('|', 1)[1]; t[ph][0] += n; t[ph][1] += w
    return {ph: w / n for ph, (n, w) in t.items()}

def clusters(runs, bw):
    """키 → 런별 (n, d) 목록. d = Σ(승리 - 기준 승률)"""
    c = collections.defaultdict(list)
    for r in runs:
        acc = collections.defaultdict(lambda: [0, 0.0])
        for k, (n, w) in r['det'].items():
            key, ph = k.rsplit('|', 1)
            a = acc[key]; a[0] += n; a[1] += w - n * bw[ph]
        for key, (n, d) in acc.items(): c[key].append((n, d))
    return c

def est(rows):
    N = sum(n for n, _ in rows)
    if not N: return None
    L = sum(d for _, d in rows) / N
    R = len(rows)
    var = sum((d - L * n) ** 2 for n, d in rows) * (R / (R - 1) if R > 1 else 1)
    return {'n': N, 'runs': R, 'lift': L, 'se': math.sqrt(var) / N}

def minus(c, a, b):
    """a 키 런별 값에서 b 키 런별 값을 뺀 것 (기물 전체 - 증강 보유 = 미보유)"""
    # 런 순서가 같지 않으므로 런 인덱스로 맞추기 어렵다 → 합계 근사: 분산은 독립 가정
    ra, rb = est(c.get(a, [])), est(c.get(b, []))
    if not ra or not rb: return None
    Na, Nb = ra['n'], rb['n']
    if Na - Nb <= 0: return None
    Da = ra['lift'] * Na; Db = rb['lift'] * Nb
    L = (Da - Db) / (Na - Nb)
    return {'n': Na - Nb, 'lift': L, 'se': math.hypot(ra['se'] * Na, rb['se'] * Nb) / (Na - Nb)}

pp = lambda x: f"{x * 100:+.1f}"
ci = lambda e: f"±{e['se'] * 196:.1f}"
sig = lambda e: ' ✱' if abs(e['lift']) > 1.96 * e['se'] else ''
name = lambda i: UN.get(i, {}).get('name', i)
aname = lambda i: AUG.get(i, {}).get('name', i)

runsA, runsB = load(A), load(B)
bwA, bwB = baseline(runsA), baseline(runsB)
cA, cB = clusters(runsA, bwA), clusters(runsB, bwB)
out = []
P = out.append

# ── 1. 기물
P('## 기물별 페이즈 보정 승률 (기준 대비 %p, 실험 A)')
P('| 기물 | 전술 | 전투 | 전투 수 | 런 | 승률 차 | 95% 구간 |'); P('|---|---|---|---|---|---|---|')
rows = []
for k in cA:
    if not k.startswith('u:'): continue
    e = est(cA[k]); i = k[2:]
    if e and e['n'] >= 200: rows.append((e['lift'], i, e))
for _, i, e in sorted(rows, reverse=True):
    u = UN.get(i, {})
    P(f"| {name(i)} | {u.get('ttName','')} | {u.get('ctName','')} | {e['n']} | {e['runs']} | {pp(e['lift'])}{sig(e)} | {ci(e)} |")

def within(c, unit, key):
    w = est(c.get(f'ua:{unit}|{key}', [])); wo = minus(c, f'u:{unit}', f'ua:{unit}|{key}')
    if not w or not wo: return None
    return {'n': w['n'], 'runs': w['runs'], 'with': w['lift'], 'without': wo['lift'], 'lift': w['lift'] - wo['lift'], 'se': math.hypot(w['se'], wo['se'])}

# ── 2. 스페셜 전용 증강 (기물별)
P('\n## 스페셜 전용 증강: 기물 내 상대 승률 (보유 − 미보유, %p, 실험 A)')
for i, u in UN.items():
    if u.get('tt') != 'special': continue
    keys = sorted({k.split('|', 1)[1] for k in cA if k.startswith(f'ua:{i}|')})
    res = [(k, within(cA, i, k)) for k in keys]
    res = [(k, e) for k, e in res if e]
    if not res: continue
    mean = sum(e['lift'] * e['n'] for _, e in res) / sum(e['n'] for _, e in res)
    P(f"\n### {name(i)}  (증강 평균 {pp(mean)}%p)")
    P('| 증강 | 보유 전투 | 런 | 보유 − 미보유 | 95% 구간 | 기물 내 상대 |'); P('|---|---|---|---|---|---|')
    for k, e in sorted(res, key=lambda x: -x[1]['lift']):
        P(f"| {aname(k)} | {e['n']} | {e['runs']} | {pp(e['lift'])}{sig(e)} | {ci(e)} | {pp(e['lift'] - mean)} |")

# ── 3. 메이저 공용 증강 (전 기물 합산, 기물 내 비교를 전투 수로 가중)
def pooled(c, units, key):
    acc = []
    for i in units:
        e = within(c, i, key)
        if e: acc.append(e)
    if not acc: return None
    N = sum(e['n'] for e in acc)
    return {'n': N, 'runs': sum(e['runs'] for e in acc), 'lift': sum(e['lift'] * e['n'] for e in acc) / N, 'se': math.sqrt(sum((e['se'] * e['n']) ** 2 for e in acc)) / N}

majors = [i for i, u in UN.items() if u.get('tt') == 'major']
P('\n## 메이저 공용 증강 (메이저 기물 전체, 기물 내 보유 − 미보유를 합산, %p)')
P('| 증강 | 보유 전투 | 승률 차 | 95% 구간 |'); P('|---|---|---|---|')
mk = sorted({k.split('|', 1)[1] for k in cA if k.startswith('ua:') and '|maj.' in k})
for k, e in sorted([(k, pooled(cA, majors, k)) for k in mk], key=lambda x: -(x[1]['lift'] if x[1] else -9)):
    if e: P(f"| {aname(k)} | {e['n']} | {pp(e['lift'])}{sig(e)} | {ci(e)} |")
P('\n### 메이저 기물별 증강 상대 승률 (보유 − 미보유, %p)')
P('| 기물 | ' + ' | '.join(aname(k) for k in mk) + ' |'); P('|---|' + '---|' * len(mk))
for i in majors:
    cells = []
    for k in mk:
        e = within(cA, i, k)
        cells.append(f"{pp(e['lift'])}{sig(e)}" if e and e['n'] >= 40 else '·')
    P(f"| {name(i)} | " + ' | '.join(cells) + ' |')

# ── 4. 사이오닉 학파 · 전공
psi = [i for i, u in UN.items() if u.get('tt') == 'psionic']
schools = sorted({k.split('|', 1)[1] for k in cA if k.startswith('ua:') and '|school.' in k})
P('\n## 사이오닉 학파 (기물 차이를 지운 학파 효과, %p, 실험 A)')
P('| 학파 | 전투 | 학파 효과 (보유 − 같은 기물의 다른 학파) | 95% 구간 | 단순 승률 차 |'); P('|---|---|---|---|---|')
for k, e in sorted([(k, pooled(cA, psi, k)) for k in schools], key=lambda x: -(x[1]['lift'] if x[1] else -9)):
    raw = est(cA.get(f'a:{k}', []))
    if e: P(f"| {aname(k)} | {e['n']} | {pp(e['lift'])}{sig(e)} | {ci(e)} | {pp(raw['lift']) if raw else '·'} |")
P('\n### 기물 × 학파 (보유 − 미보유, %p · 표본 40전투 미만은 ·)')
P('| 기물 | ' + ' | '.join(aname(k).replace('학파', '') for k in schools) + ' |'); P('|---|' + '---|' * len(schools))
for i in psi:
    cells = []
    for k in schools:
        e = within(cA, i, k)
        cells.append(f"{pp(e['lift'])}{sig(e)}" if e and e['n'] >= 40 else '·')
    P(f"| {name(i)} | " + ' | '.join(cells) + ' |')
P('\n### 학파 전공 (사이오닉 기물 전체, 보유 − 미보유, %p)')
for s in schools:
    sid = s.split('.')[1]
    ks = sorted({k.split('|', 1)[1] for k in cA if k.startswith('ua:') and f'|psi.{sid}.' in k})
    res = [(k, pooled(cA, psi, k)) for k in ks]
    res = [(k, e) for k, e in res if e]
    if not res: continue
    mean = sum(e['lift'] * e['n'] for _, e in res) / sum(e['n'] for _, e in res)
    P(f"\n**{aname(s)}** (전공 평균 {pp(mean)}%p)\n")
    P('| 전공 | 보유 전투 | 보유 − 미보유 | 95% 구간 | 학파 내 상대 |'); P('|---|---|---|---|---|')
    for k, e in sorted(res, key=lambda x: -x[1]['lift']):
        P(f"| {aname(k)} | {e['n']} | {pp(e['lift'])}{sig(e)} | {ci(e)} | {pp(e['lift'] - mean)} |")

# ── 5. 디바인 성유물 (실험 B: 성유물 무작위)
div = [i for i, u in UN.items() if u.get('tt') == 'divine']
rel = sorted({k.split('|', 1)[1] for k in cB if k.startswith('ur:')})
P('\n## 디바인 성유물 (실험 B: 디바인에게 성유물을 무작위 장착, 기물 차이를 지운 효과, %p)')
P('| 성유물 | 전투 | 성유물 효과 | 95% 구간 | 단순 승률 차 |'); P('|---|---|---|---|---|')
def rel_within(c, unit, r):
    w = est(c.get(f'ur:{unit}|{r}', [])); wo = minus(c, f'u:{unit}', f'ur:{unit}|{r}')
    if not w or not wo: return None
    return {'n': w['n'], 'runs': w['runs'], 'lift': w['lift'] - wo['lift'], 'se': math.hypot(w['se'], wo['se'])}
def rel_pooled(r):
    acc = [e for e in (rel_within(cB, i, r) for i in div) if e]
    if not acc: return None
    N = sum(e['n'] for e in acc)
    return {'n': N, 'lift': sum(e['lift'] * e['n'] for e in acc) / N, 'se': math.sqrt(sum((e['se'] * e['n']) ** 2 for e in acc)) / N}
for r, e in sorted([(r, rel_pooled(r)) for r in rel], key=lambda x: -(x[1]['lift'] if x[1] else -9)):
    raw = est(cB.get(f'r:{r}', []))
    if e: P(f"| {M['relics'].get(r, r)} | {e['n']} | {pp(e['lift'])}{sig(e)} | {ci(e)} | {pp(raw['lift']) if raw else '·'} |")
P('\n### 디바인 × 성유물 (보유 − 미보유, %p · 표본 40전투 미만은 ·, 굵게 = 기본 성유물)')
P('| 기물 | ' + ' | '.join(M['relics'].get(r, r) for r in rel) + ' |'); P('|---|' + '---|' * len(rel))
for i in div:
    cells = []
    for r in rel:
        e = rel_within(cB, i, r)
        v = f"{pp(e['lift'])}{sig(e)}" if e and e['n'] >= 40 else '·'
        cells.append(f"**{v}**" if M['defaultRelic'].get(i) == r else v)
    P(f"| {name(i)} | " + ' | '.join(cells) + ' |')
P('\n### 기본 성유물 기준 디바인 기물 (실험 A)')
P('| 기물 | 기본 성유물 | 전투 | 승률 차 | 95% 구간 |'); P('|---|---|---|---|---|')
for i in div:
    e = est(cA.get(f'u:{i}', []))
    if e: P(f"| {name(i)} | {M['relics'].get(M['defaultRelic'].get(i), '-')} | {e['n']} | {pp(e['lift'])}{sig(e)} | {ci(e)} |")

print('\n'.join(out))
