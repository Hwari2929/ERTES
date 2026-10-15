# 2차 밸런스 측정 집계: tests/probe2.ts 출력(arm 별 폴더의 part*.json)을 모아 RESULTS.md + results.json 을 만든다.
# 실행: python3 tests/probe2_report.py <루트 폴더> <meta.json>
#   루트 폴더 아래: base/ (seeds 1..9600, cf) · noreasondot/ · nofrenzyally/ · reasonbot/ (seeds 1..4800) · randrelic/
# 통계: 승률 보정 = 전투 승리(0/1) - 같은 페이즈 · 노드 종류의 평균 승률 (기물-전투 가중, tests/detail_report.py 와 같은 방식)
#       신뢰구간 = 런 군집 선형화 표준오차 (±1.96 SE). 기물 내 비교는 같은 런의 보유 · 미보유를 정확히 나눠 계산.
#       팔 비교 = 같은 시드끼리의 대응 차이 (런 단위).
import json, glob, sys, math, collections, os

ROOT, META = sys.argv[1], sys.argv[2]
M = json.load(open(META))
UN = {u['id']: u for u in M['units']}
AUG = M['augs']; REL = M['relics']; FLD = M['fields']; EN = M['enemies']
name = lambda i: UN.get(i, {}).get('name', i)
aname = lambda i: AUG.get(i, i)
CTN = {'MARK': '명사수', 'VAN': '돌격가', 'SPEC': '전문가', 'CMD': '지휘관'}
TTN = {'major': '메이저', 'minor': '마이너', 'special': '스페셜', 'psionic': '사이오닉', 'divine': '디바인'}

def load(arm):
    d = os.path.join(ROOT, arm)
    parts = sorted(glob.glob(f'{d}/part*.json'))
    runs, agg = [], {}
    for p in parts:
        try: j = json.load(open(p))
        except Exception:
            sys.stderr.write(f'skip unreadable {p}\n'); continue
        runs += j['runs']
        for t, tab in j['agg'].items():
            T = agg.setdefault(t, {})
            for k, v in tab.items():
                a = T.setdefault(k, {})
                for f, x in v.items(): a[f] = a.get(f, 0) + x
    if not runs: return None
    runs.sort(key=lambda r: r['seed'])
    return {'runs': runs, 'agg': agg}

out = []; P = out.append; RES = {}
pp = lambda x: f"{x * 100:+.1f}"
pc = lambda x: f"{x * 100:.1f}%"
f1 = lambda x: f"{x:.1f}"
f2 = lambda x: f"{x:.2f}"
def ci(e): return f"±{e['se'] * 196:.1f}"
def sig(e): return ' ✱' if e['se'] > 0 and e.get('rw', 99) >= 30 and e.get('rwo', 99) >= 30 and abs(e['est']) > 1.96 * e['se'] else ''

# ───────── 공통 추정기
def adj_runs(runs, bw):
    """런마다 acc 의 (키|페이즈:노드) → [n, w] 를 키 → (n, d = Σ w - n·기준) 로"""
    res = []
    for r in runs:
        acc = collections.defaultdict(lambda: [0, 0.0])
        for k, v in r['acc'].items():
            if k.startswith('m2|'): continue
            key, pn = k.rsplit('|', 1)
            a = acc[key]; a[0] += v[0]; a[1] += v[1] - v[0] * bw[pn]
        res.append(acc)
    return res

def within_pooled(A, pairs):
    """pairs: [(보유 키, 전체 키)] → 기물 내 (보유 - 미보유) 보정 승률 차, 보유 전투 수로 가중 합산, 런 군집 SE"""
    R = len(A); comps = []
    for kw, kt in pairs:
        nw = dw = nt = dt = 0
        for acc in A:
            w = acc.get(kw); t = acc.get(kt)
            if w: nw += w[0]; dw += w[1]
            if t: nt += t[0]; dt += t[1]
        no, do = nt - nw, dt - dw
        if nw < 1 or no < 1: continue
        comps.append((kw, kt, nw, dw / nw, no, do / no))
    if not comps: return None
    rw = sum(1 for acc in A if any(acc.get(c[0]) for c in comps))
    rwo = sum(1 for acc in A if any((acc.get(c[1], (0, 0))[0] - acc.get(c[0], (0, 0))[0]) > 0 for c in comps))
    NW = sum(c[2] for c in comps)
    est = sum(c[2] / NW * (c[3] - c[5]) for c in comps)
    lw = sum(c[2] / NW * c[3] for c in comps); lo = sum(c[2] / NW * c[5] for c in comps)
    ss = 0.0
    for acc in A:
        z = 0.0
        for kw, kt, nw, Lw, no, Lo in comps:
            w = acc.get(kw, (0, 0)); t = acc.get(kt, (0, 0))
            zw = (w[1] - Lw * w[0]) / nw
            zo = ((t[1] - w[1]) - Lo * (t[0] - w[0])) / no
            z += nw / NW * (zw - zo)
        ss += z * z
    se = math.sqrt(ss * R / (R - 1)) if R > 1 else 0
    return {'n': NW, 'nwo': sum(c[4] for c in comps), 'est': est, 'se': se, 'with': lw, 'without': lo, 'units': len(comps), 'rw': rw, 'rwo': rwo}

def strat_ratio_diff(runs, strata, num, den):
    """strata: [(보유 키, 미보유 키)] (런 acc 의 배열 키). 지표 = Σ arr[num] / Σ arr[den] (den=0 이면 전투 수).
    층별 (보유 - 미보유) 를 보유 전투 수로 가중 합산, 런 군집 SE"""
    R = len(runs); comps = []
    for kw, ko in strata:
        sw = [0, 0, 0]; so = [0, 0, 0]
        for r in runs:
            a = r['acc'].get(kw); b = r['acc'].get(ko)
            if a: sw[0] += a[num]; sw[1] += a[den]; sw[2] += a[0]
            if b: so[0] += b[num]; so[1] += b[den]; so[2] += b[0]
        if sw[1] <= 0 or so[1] <= 0 or sw[2] < 1 or so[2] < 1: continue
        comps.append((kw, ko, sw[2], sw[0] / sw[1], sw[1], so[0] / so[1], so[1], so[2]))
    if not comps: return None
    rw = sum(1 for r in runs if any(c[0] in r['acc'] for c in comps)); rwo = sum(1 for r in runs if any(c[1] in r['acc'] for c in comps))
    NW = sum(c[2] for c in comps)
    est = sum(c[2] / NW * (c[3] - c[5]) for c in comps)
    mw = sum(c[2] / NW * c[3] for c in comps); mo = sum(c[2] / NW * c[5] for c in comps)
    ss = 0.0
    for r in runs:
        z = 0.0
        for kw, ko, nw, Mw, Dw, Mo, Do, no in comps:
            a = r['acc'].get(kw); b = r['acc'].get(ko)
            zw = (a[num] - Mw * a[den]) / Dw if a else 0
            zo = (b[num] - Mo * b[den]) / Do if b else 0
            z += nw / NW * (zw - zo)
        ss += z * z
    se = math.sqrt(ss * R / (R - 1)) if R > 1 else 0
    return {'n': NW, 'nwo': sum(c[7] for c in comps), 'est': est, 'se': se, 'with': mw, 'without': mo, 'rw': rw, 'rwo': rwo}

def ratio_cluster(rows):
    """rows: 런별 (분자, 분모) → 비율, 런 군집 SE"""
    N = sum(d for _, d in rows);
    if N <= 0: return None
    L = sum(x for x, _ in rows) / N; R = len(rows)
    ss = sum((x - L * d) ** 2 for x, d in rows)
    return {'est': L, 'se': math.sqrt(ss * R / (R - 1)) / N if R > 1 else 0, 'n': N}

def paired_ratio(rowsA, rowsB):
    """같은 시드 순서의 (분자, 분모) 두 팔 → B - A 비율 차, 대응 런 군집 SE"""
    NA = sum(d for _, d in rowsA); NB = sum(d for _, d in rowsB)
    LA = sum(x for x, _ in rowsA) / NA; LB = sum(x for x, _ in rowsB) / NB
    R = len(rowsA); ss = 0.0
    for (xa, da), (xb, db) in zip(rowsA, rowsB):
        z = (xb - LB * db) / NB - (xa - LA * da) / NA
        ss += z * z
    return {'A': LA, 'B': LB, 'est': LB - LA, 'se': math.sqrt(ss * R / (R - 1))}

def spearman(x, y):
    def rank(v):
        o = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0] * len(v); i = 0
        while i < len(o):
            j = i
            while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]: j += 1
            for k in range(i, j + 1): r[o[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    n = len(x)
    if n < 3: return float('nan')
    rx, ry = rank(x), rank(y)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else float('nan')

def tbl(head, rows):
    P('| ' + ' | '.join(head) + ' |'); P('|' + '---|' * len(head))
    for r in rows: P('| ' + ' | '.join(str(x) for x in r) + ' |')

# ───────── 로드
B = load('base')
runsB = B['runs']; aggB = B['agg']
bw = {k: v['w'] / v['n'] for k, v in aggB['bw'].items()}
A_adj = adj_runs(runsB, bw)
P(f"# 2차 밸런스 측정 결과 (probe2)\n")
P(f"- 기준 팔(base): 시드 1..{runsB[-1]['seed']} ({len(runsB)}런), 클리어 {pc(sum(r['cleared'] for r in runsB) / len(runsB))}, 런당 전투 {sum(r['battles'] for r in runsB) / len(runsB):.1f}")
tf = os.path.join(ROOT, 'times.txt')
if os.path.exists(tf): P('- 실행 시간 (4 워커): ' + ', '.join(l.strip() for l in open(tf) if l.strip()))
P('- 팔: base = 현행 (시드 1..9600, cf 반사실 포함) · noreasondot = CFG.reasonDot 0 · nofrenzyally = CFG.frenzyFriendly false · reasonbot = 이성 관리 봇 (모두 시드 1..4800) · randrelic = 디바인 성유물 무작위 (시드 50001..54800)')
P('- 봇 · 난수 소비는 tests/balance.ts 와 동일 (같은 시드 = 같은 런, 40런 대조로 확인). 위험 등급 0.')
P("- 승률 차 단위: %p. 보정 = 같은 페이즈 × 노드 종류 평균 승률 대비. 95% 구간 = 런 군집 ±1.96 SE. ✱ = 0 에서 유의하게 벗어남.\n")

# ═════════ 1. 사이오닉 전공 (같은 기물 · 같은 학파)
P('## 1. 사이오닉 전공: 같은 기물 · 같은 학파 안에서 보유 vs 미보유\n')
P('대상: 그 학파를 가진 사이오닉 기물이 전공을 1개 이상 가진 전투. 미보유 = 같은 기물 · 같은 학파가 다른 전공을 고른 전투. 기물별 차이를 보유 전투 수로 가중 합산.\n')
keys = set()
for acc in A_adj:
    for k in acc:
        if k.startswith('pp|'): keys.add(k)
bys = collections.defaultdict(lambda: collections.defaultdict(list))  # school → passive → [(kw, kt)]
for k in keys:
    _, u, s, p = k.split('|')
    bys[s][p].append((k, f'pu|{u}|{s}'))
r1 = {}
for s in sorted(bys):
    res = []
    for p, pairs in bys[s].items():
        e = within_pooled(A_adj, pairs)
        if e: res.append((p, e))
    if not res: continue
    mean = sum(e['est'] * e['n'] for _, e in res) / sum(e['n'] for _, e in res)
    P(f"\n### {aname('school.' + s)}\n")
    rows = []
    for p, e in sorted(res, key=lambda x: -x[1]['est']):
        rows.append([aname(p), e['n'], e['nwo'], e['units'], e['rw'], pp(e['with']), pp(e['without']), pp(e['est']) + sig(e), ci(e)])
        r1[p] = e
    tbl(['전공', '보유 전투', '미보유 전투', '기물 수', '보유 런', '보유 보정승률', '미보유 보정승률', '보유 − 미보유', '95% 구간'], rows)
RES['exp1'] = r1

# ═════════ 2. 메이저 공용 증강
P('\n## 2. 메이저 공용 증강\n')
P('### 2a. 기물 내 비교 (메이저 증강을 1개 이상 가진 전투만: 비교군 = 다른 메이저 증강을 고른 같은 기물)\n')
mk = collections.defaultdict(list)
for acc in A_adj:
    for k in acc:
        if k.startswith('maa|'):
            _, u, g = k.split('|')
            if (k, f'ma|{u}') not in mk[g]: mk[g].append((k, f'ma|{u}'))
rows = []; r2a = {}
for g, pairs in mk.items():
    e = within_pooled(A_adj, pairs)
    if e: rows.append((e['est'], g, e)); r2a[g] = e
tbl(['증강', '보유 전투', '미보유 전투', '보유 − 미보유', '95% 구간'], [[aname(g), e['n'], e['nwo'], pp(e['est']) + sig(e), ci(e)] for _, g, e in sorted(rows, reverse=True)])
RES['exp2a'] = r2a

P('\n### 2b. 직접 지표 (궁극기 보유 메이저, 메이저 증강 ≥1 보유 전투, 같은 기물 × 같은 페이즈 층 안에서 보유 − 미보유)\n')
P('지표 배열: [전투, 기본 공격 수, 궁극기 시전, 첫 궁극기 전 사망, 생존 시간(초), 전투 시간, 사망, 승리]\n')
ultU = [u for u, d in UN.items() if d['tt'] == 'major' and d.get('ult')]
def strata(g, units):
    st = []
    for u in units:
        for ph in range(1, 12):
            st.append((f'm2|{u}|{g}|1|{ph}', f'm2|{u}|{g}|0|{ph}'))
    return st
magU = [u for u in ultU if UN[u]['mag']]; nomagU = [u for u in ultU if not UN[u]['mag']]
r2b = {}
def m2row(label, g, units, num, den, scale=1, fmt=f2):
    e = strat_ratio_diff(runsB, strata(g, units), num, den)
    if not e: return [label, '·'] * 1 + ['·'] * 4
    r2b[label] = e
    return [label, e['n'], e['nwo'], fmt(e['with'] * scale), fmt(e['without'] * scale), (f"{e['est'] * scale:+.2f}") + sig(e), f"±{e['se'] * scale * 1.96:.2f}"]
rows = [
    m2row('재장전 훈련 · 탄창 무기: 기본 공격/전투', 'maj.reload', magU, 1, 0),
    m2row('재장전 훈련 · 탄창 무기: 기본 공격/생존 초', 'maj.reload', magU, 1, 4),
    m2row('재장전 훈련 · 비탄창 무기: 기본 공격/전투', 'maj.reload', nomagU, 1, 0),
    m2row('재장전 훈련 · 탄창 무기: 승률', 'maj.reload', magU, 7, 0),
    m2row('충전 회로: 궁극기 시전/전투', 'maj.ultc', ultU, 2, 0),
    m2row('충전 회로: 궁극기 시전/생존 분', 'maj.ultc', ultU, 2, 4, 60),
    m2row('충전 회로: 첫 궁극기 전 사망률', 'maj.ultc', ultU, 3, 0),
    m2row('충전 회로: 승률', 'maj.ultc', ultU, 7, 0),
    m2row('선제 장전: 첫 궁극기 전 사망률', 'maj.ults', ultU, 3, 0),
    m2row('선제 장전: 궁극기 시전/전투', 'maj.ults', ultU, 2, 0),
    m2row('선제 장전: 생존 시간(초)', 'maj.ults', ultU, 4, 0),
    m2row('선제 장전: 승률', 'maj.ults', ultU, 7, 0),
]
tbl(['지표', '보유 전투', '미보유 전투', '보유', '미보유', '차이', '95% 구간'], rows)
# 전체 기준값
tot = collections.defaultdict(lambda: [0] * 8)
for r in runsB:
    for k, v in r['acc'].items():
        if k.startswith('m2|') and '|maj.ultc|' in k:
            for i in range(8): tot['all'][i] += v[i]
t = tot['all']
P(f"\n참고 (궁극기 메이저, 증강 ≥1 전투 {t[0]}): 전투당 기본 공격 {t[1] / t[0]:.1f}, 궁극기 {t[2] / t[0]:.2f}회, 첫 궁극기 전 사망 {pc(t[3] / t[0])}, 생존 {t[4] / t[0]:.1f}초 / 전투 {t[5] / t[0]:.1f}초, 사망 {pc(t[6] / t[0])}")
RES['exp2b'] = r2b

# ═════════ 3. 실패 분해
P('\n## 3. 실패 분해: 전투 유형 · 전술 유형\n')
e3b = aggB['e3bat']
P('### 3a. 전투 단위 (첫 아군 사망 · 첫 적 처치 · 전열 붕괴 시각)\n')
rows = []
for g in ['all', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6+', 'P4boss']:
    for res in ['W', 'L']:
        v = e3b.get(f'{g}|{res}')
        if not v: continue
        n = v['n']
        rows.append([g, '승' if res == 'W' else '패', n, f1(v['dur'] / n), pc(v['hasAD'] / n), f1(v['adT'] / max(1, v['hasAD'])), f1(v['kT'] / max(1, v['hasK'])),
                     pc(v['hasF'] / n), f1(v['fT'] / max(1, v['hasF'])), pc(v['adBeforeK'] / n), f2(v['deaths'] / n),
                     pc(v['conv'] / max(1, v['conv'] + v['unconv'])), pc(v.get('timeout', 0) / n) if res == 'L' else '·'])
tbl(['구간', '결과', '전투', '시간(초)', '아군 사망 발생', '첫 아군 사망(초)', '첫 적 처치(초)', '전열 붕괴 발생', '전열 붕괴(초)', '처치 전 아군 사망', '아군 사망 수', '전환 피해 비율', '시간 초과 패배'], rows)
P('\n전열 붕괴 = 첫 돌격가 사망 (돌격가가 없으면 첫 아군 사망). 전환 피해 = 전투 끝까지 쓰러진 적에게 준 피해 (초과 피해 제외). 승리 전투는 정의상 100%.')

def e3rows(tab, keyf, labels):
    rows = []
    for lab, key in labels:
        for res in ['W', 'L']:
            v = tab.get(f'{key}|{res}')
            if not v or v['n'] < 30: continue
            n = v['n']
            rows.append([lab, '승' if res == 'W' else '패', n, pc(v['died'] / n), f1(v['deathT'] / max(1, v['died'])), pc(v['aliveFrac'] / n), f"{v['dmg'] / n / 1000:.1f}k",
                         pc(v['conv'] / max(1, v['conv'] + v['unconv'])), pc(v['overkill'] / max(1, v['dmg'] + v['overkill'])),
                         pc(v['fAfter'] / max(1, v['fDmg'])) if v['fN'] else '·', pc(v['fTimeAfter'] / max(1, v['fN'])) if v['fN'] else '·'])
    return rows
H3 = ['유형', '결과', '기물-전투', '사망률', '평균 사망 시각(초)', '생존 시간 비율', '피해/전투', '전환 피해 비율', '초과 피해 비율', '전열 붕괴 후 피해 비중', '전열 붕괴 후 시간 비중']
for grp, title in [('all', '전체'), ('P4', 'P4 (보스 포함 전체)'), ('P4boss', 'P4 보스')]:
    P(f'\n### 3b. 전투 유형별 ({title})\n')
    tbl(H3, e3rows(aggB['e3ct'], None, [(CTN[c], f'{c}|{grp}') for c in ['MARK', 'VAN', 'SPEC', 'CMD']]))
    P(f'\n### 3c. 전술 유형별 ({title})\n')
    tbl(H3, e3rows(aggB['e3tt'], None, [(TTN[t], f'{t}|{grp}') for t in ['major', 'minor', 'special', 'psionic', 'divine']]))
P('\n### 3d. 전투 유형 × 전술 유형 (전체)\n')
labs = [(f"{CTN[c]}·{TTN[t]}", f'{c}|{t}') for c in ['MARK', 'VAN', 'SPEC', 'CMD'] for t in ['major', 'minor', 'special', 'psionic', 'divine']]
tbl(H3, e3rows(aggB['e3cttt'], None, labs))
P('\n### 3e. 기물별 (패배 전투): 사망률 상 · 하위 10 / 전환 피해 비율 상 · 하위 10 (기물-전투 ≥ 200)\n')
eu = aggB['e3u']
L = [(u.split('|')[0], v) for u, v in eu.items() if u.endswith('|L') and u.count('|') == 1 and v['n'] >= 200]
def urow(u, v):
    w = eu.get(f'{u}|W', {'n': 0})
    n = v['n']
    return [name(u), CTN.get(UN.get(u, {}).get('ct'), '?'), TTN.get(UN.get(u, {}).get('tt'), '?'), n, pc(v['died'] / n), f1(v['deathT'] / max(1, v['died'])), pc(v['aliveFrac'] / n),
            pc(v['conv'] / max(1, v['conv'] + v['unconv'])), pc(v['fAfter'] / max(1, v['fDmg'])) if v['fN'] else '·', pc(w['died'] / w['n']) if w['n'] else '·']
HU = ['기물', '전투', '전술', '패배 전투', '패배 시 사망률', '사망 시각', '생존 시간 비율', '전환 비율', '전열 붕괴 후 피해 비중', '승리 시 사망률']
srt = sorted(L, key=lambda x: -x[1]['died'] / x[1]['n'])
P('**패배 시 사망률 높은 순**\n'); tbl(HU, [urow(u, v) for u, v in srt[:10]])
P('\n**패배 시 사망률 낮은 순**\n'); tbl(HU, [urow(u, v) for u, v in srt[-10:][::-1]])
srt = sorted(L, key=lambda x: -x[1]['conv'] / max(1, x[1]['conv'] + x[1]['unconv']))
P('\n**패배 시 전환 비율 높은 순**\n'); tbl(HU, [urow(u, v) for u, v in srt[:10]])
P('\n**패배 시 전환 비율 낮은 순**\n'); tbl(HU, [urow(u, v) for u, v in srt[-10:][::-1]])
P('\n**명사수 · 사이오닉 기물 전체 (패배 전투)**\n')
tbl(HU, [urow(u, v) for u, v in sorted(L, key=lambda x: -x[1]['died'] / x[1]['n']) if UN.get(u, {}).get('ct') == 'MARK' or UN.get(u, {}).get('tt') == 'psionic'])
P('\n### 3f. P4 보스 패배, 기물별 (기물-전투 ≥ 60)\n')
L4 = [(u.split('|')[0], v) for u, v in eu.items() if u.endswith('|P4boss|L') and v['n'] >= 60]
def urow4(u, v):
    n = v['n']
    return [name(u), CTN.get(UN.get(u, {}).get('ct'), '?'), TTN.get(UN.get(u, {}).get('tt'), '?'), n, pc(v['died'] / n), f1(v['deathT'] / max(1, v['died'])), pc(v['aliveFrac'] / n), pc(v['conv'] / max(1, v['conv'] + v['unconv'])), f"{v['dmg'] / n / 1000:.1f}k"]
tbl(['기물', '전투', '전술', '패배 전투', '사망률', '사망 시각', '생존 시간 비율', '전환 비율', '피해/전투'], [urow4(u, v) for u, v in sorted(L4, key=lambda x: -x[1]['died'] / x[1]['n'])])
RES['exp3'] = {'bat': e3b, 'ct': aggB['e3ct'], 'tt': aggB['e3tt']}

# ═════════ 4. 사이오닉 팔 비교
P('\n## 4. 사이오닉 실험 팔 (같은 시드 1..4800, 대응 비교)\n')
ARMS = [('base', 'A 기준'), ('noreasondot', 'B 저이성 정신 피해 0'), ('nofrenzyally', 'C 광폭이 아군을 노리지 않음'), ('reasonbot', 'D 이성 관리 봇')]
data = {}
for a, _ in ARMS:
    d = B if a == 'base' else load(a)
    if not d: continue
    rs = [r for r in d['runs'] if r['seed'] <= 4800]
    data[a] = {r['seed']: r for r in rs}
seeds = sorted(set.intersection(*[set(v) for v in data.values()])) if data else []
P(f"공통 시드 {len(seeds)}개. D 봇의 우선 전공: 축전(psi.volt.store) · 엔트로피 역행(psi.chrono.revert) · 광합성(psi.seed.photo) · 역장(psi.wave.field) · 상승장(psi.gold.bull) (홍염 · 초월은 해당 전공 없음 → 기존 무작위). 레이첼 학파 = 무작위 (기준: 항상 첫 번째 = 홍염).\n")
psiU = [u for u, d in UN.items() if d['tt'] == 'psionic']
rows = []; r4 = {}
for a, lab in ARMS:
    if a not in data: continue
    rs = [data[a][s] for s in seeds]; ra = [data['base'][s] for s in seeds]
    clr = paired_ratio([(r['cleared'], 1) for r in ra], [(r['cleared'], 1) for r in rs])
    dth = paired_ratio([(r['psi']['died'], r['psi']['n']) for r in ra], [(r['psi']['died'], r['psi']['n']) for r in rs])
    pst = [s for s in seeds if any(UN.get(x, {}).get('tt') == 'psionic' for x in data['base'][s]['starters'])]
    sclr = paired_ratio([(data['base'][s]['cleared'], 1) for s in pst], [(data[a][s]['cleared'], 1) for s in pst])
    ps = {k: sum(r['psi'].get(k, 0) for r in rs) for k in ['n', 'died', 'reason', 'ally', 'enemy', 'other', 'frenzyT', 'alive', 'fAlly', 'fEnemy', 'dmg', 'frenzied']}
    r4[a] = {'clear': clr, 'psiDeath': dth, 'psiStarterClear': sclr, 'n_psiStarter': len(pst), 'psi': ps}
    rows.append([lab, pc(clr['B']), (pp(clr['est']) + sig(clr) + ' ' + ci(clr)) if a != 'base' else '·', pc(dth['B']), (pp(dth['est']) + sig(dth) + ' ' + ci(dth)) if a != 'base' else '·',
                 f"{pc(sclr['B'])} (n={len(pst)})", (pp(sclr['est']) + sig(sclr) + ' ' + ci(sclr)) if a != 'base' else '·',
                 pc(ps['reason'] / max(1, ps['died'])), pc(ps['ally'] / max(1, ps['died'])), pc(ps['enemy'] / max(1, ps['died'])),
                 pc(ps['frenzyT'] / max(1, ps['alive'])), pc(ps['frenzied'] / max(1, ps['n'])), pc(ps['fAlly'] / max(1, ps['dmg'] + ps['fAlly']))])
tbl(['팔', '클리어', 'Δ vs A', '사이오닉 전투 내 사망률', 'Δ vs A', '사이오닉 시작 런 클리어', 'Δ vs A', '사망 원인: 저이성', '아군', '적', '광폭 시간 비율 (생존 시간 대비)', '광폭 발생 전투', '광폭 중 아군에게 준 피해 ÷ (적에게 준 전체 피해 + 그 피해)'], rows)
P('\n사망 원인 = 치명타를 준 피해원: 저이성 정신 피해(key reason) · 아군(광폭 · 매혹 아군 포함) · 적. 광폭 아군 피해는 사이오닉 본인이 광폭 중 아군에게 준 피해.')
# 사이오닉 시작 기물별 클리어
P('\n### 4b. 사이오닉 시작 기물별 클리어율 (팔별)\n')
rows = []
for u in psiU:
    ss = [s for s in seeds if u in data['base'][s]['starters']]
    if len(ss) < 30: continue
    row = [name(u), len(ss)]
    for a, _ in ARMS:
        if a not in data: row.append('·'); continue
        e = paired_ratio([(data['base'][s]['cleared'], 1) for s in ss], [(data[a][s]['cleared'], 1) for s in ss])
        row.append(pc(e['B']) + ('' if a == 'base' else f" ({pp(e['est'])}{sig(e)})"))
    rows.append(row)
tbl(['기물', '시작 런', *[l for _, l in ARMS]], rows)
P('\n### 4c. 기준 팔 사이오닉 기물별 사망 원인 · 광폭 (시드 1..9600)\n')
rows = []
for u, v in sorted(aggB['e4u'].items(), key=lambda x: -x[1]['n']):
    n = v['n']; d = max(1, v['died'])
    rows.append([name(u), n, pc(v['died'] / n), pc(v['reason'] / d), pc(v['ally'] / d), pc(v['enemy'] / d), pc(v['negT'] / max(1, v['alive'])), pc(v['frenzyT'] / max(1, v['alive'])), pc(v['frenzied'] / n), pc(v['fAlly'] / max(1, v['dmg'] + v['fAlly']))])
tbl(['기물', '전투', '사망률', '원인 저이성', '아군', '적', '저이성(이성<0) 시간', '광폭 시간', '광폭 발생 전투', '광폭 아군 피해 비중'], rows)
P('\n### 4d. 기준 팔 학파별\n')
rows = []
for s, v in sorted(aggB['e4s'].items(), key=lambda x: -x[1]['n']):
    n = v['n']; d = max(1, v['died'])
    rows.append([aname('school.' + s) if s != '-' else '(학파 없음)', n, pc(v['died'] / n), pc(v['reason'] / d), pc(v['ally'] / d), pc(v['negT'] / max(1, v['alive'])), pc(v['frenzyT'] / max(1, v['alive'])), pc(v['frenzied'] / n)])
tbl(['학파', '전투', '사망률', '원인 저이성', '아군', '저이성 시간', '광폭 시간', '광폭 발생 전투'], rows)
RES['exp4'] = r4
pcf = os.path.join(ROOT, 'psicf.json')
if os.path.exists(pcf):
    pr = json.load(open(pcf))['runs']
    P('\n### 4e. 보조: 전투 단위 대응 반사실 (시드 1..%d, 사이오닉이 출전한 모든 전투를 같은 시드로 B · C 조건만 바꿔 재실행)\n' % pr[-1]['seed'])
    rows = []
    for lab, f in [('사이오닉 출전 전투 전체', lambda x: True), ('이성 < 0 이 있었던 전투', lambda x: x[8]), ('광폭이 일어난 전투', lambda x: x[7])]:
        bys = collections.defaultdict(list)
        for r in pr:
            for x in r.get('cf', []):
                if f(x): bys[r['seed']].append(x)
        sel = [x for v in bys.values() for x in v]; n = len(sel)
        if not n: continue
        row = [lab, n, pc(sum(x[1] for x in sel) / n)]
        for wi, di in [(3, 4), (5, 6)]:
            e = ratio_cluster([(sum(x[wi] - x[1] for x in v), len(v)) for v in bys.values()])
            row += [f"{pp(e['est'])}{sig(e)} {ci(e)} (↑{sum(x[wi] > x[1] for x in sel)} ↓{sum(x[wi] < x[1] for x in sel)})", f"{sum(x[di] for x in sel) / n:.2f}"]
        row.append(f"{sum(x[2] for x in sel) / n:.2f}")
        rows.append(row)
    tbl(['전투', '수', '기준 승률', 'B 저이성 피해 0: 승률 차', 'B 아군 사망', 'C 광폭 아군 공격 없음: 승률 차', 'C 아군 사망', '기준 아군 사망'], rows)
    P('\n해석 (가설): B 의 손해는 광폭 전투에서 가장 크다. 저이성 정신 피해가 광폭한 사이오닉의 체력을 깎아 아군을 공격하는 시간을 줄이는 제동 역할을 하는 것으로 보인다 (직접 검증은 안 함).')

# ═════════ 5. 홍염 · 시공
P('\n## 5. 홍염 · 시공 메커니즘 계측 (기준 팔, 학파 사이오닉 기물-전투 기준)\n')
e5 = aggB['e5']
def e5pyro(v):
    n = v['n']; burnEff = v['burnTickDealt'] / max(1, v['burnTickRaw'])
    return [n, f2(v['cantrips'] / n), f2(v['ign'] / n), f"{v['ignConsumed'] / max(1, v['ign']):.0f}", f"{v['ignDealt'] / max(1, v['ign']):.0f}",
            f2(v['ignDealt'] / max(1, v['ignConsumed'] * burnEff)), f2(v['burnSec'] / n), f2(v['burnStackSec'] / max(1, v['burnSec'])), f2(v['whiteSec'] / n),
            f2(v['ignLostStackSec'] / n), f2(v['ignLostWhite'] / n), pc(v['ignLostWhite'] / max(1e-9, v['whiteSec'] + v['ignLostWhite'])) if v['whiteSec'] else '·', pc(v['win'] / n)]
HP = ['조건', '기물-전투', '불씨/전투', '점화/전투', '점화당 소모 연소(원값)', '점화당 피해', '점화 피해 ÷ 소모 연소(실효 환산)', '연소 적-초/전투', '평균 중첩', '백열 방어 감소 적-초×강도/전투', '점화로 잃은 중첩-초/전투', '점화로 잃은 백열(초×강도)/전투', '백열 손실 비율', '승률']
rows = [['홍염 전체'] + e5pyro(e5['pyro|all'])] if 'pyro|all' in e5 else []
for k, lab in [('ignite', '점화'), ('white', '백열'), ('boil', '비등점')]:
    for h in ['1', '0']:
        v = e5.get(f'pyro|{k}|{h}')
        if v: rows.append([f"{lab} {'보유' if h == '1' else '미보유'}"] + e5pyro(v))
for c, v in sorted(e5.items()):
    if c.startswith('pyro|combo|'):
        bits = c.split('|')[2]
        rows.append([f"점화{bits[0]} 백열{bits[1]} 비등{bits[2]}"] + e5pyro(v))
tbl(HP, rows)
P('\n점화 소모 연소(원값) = 남은 연소 초당 피해 × 남은 시간 (방어 · 배율 전). 실효 환산 = 같은 기물의 연소 틱 실효/원값 비율을 곱한 값과 점화 실제 피해의 비. "백열 강도" = 1 − 방어도 배율.')
def e5chrono(v):
    n = v['n']
    return [n, f2(v['cantrips'] / n), f2(v['frzN'] / n), f2(v['frzApplied'] / max(1, v['frzN'])), f2(v['frzSec'] / n), f2(v['chillConsumed'] / max(1, v['frzN'])), f2(v['chillConsumed'] / n),
            f2(v['chillSec'] / n), f2(v['chillStackSec'] / max(1, v['chillSec'])), pc(v['win'] / n)]
HC = ['조건', '기물-전투', '엔트로피/전투', '빙결/전투', '빙결당 지속(초)', '빙결 적-초/전투 (실측)', '빙결당 소모 오한', '소모 오한/전투', '오한 적-초/전투', '평균 오한 중첩', '승률']
rows = [['시공 전체'] + e5chrono(e5['chrono|all'])] if 'chrono|all' in e5 else []
for k, lab in [('zero', '절대영도'), ('perma', '영구 동토'), ('revert', '엔트로피 역행'), ('delay', '시간 지연')]:
    for h in ['1', '0']:
        v = e5.get(f'chrono|{k}|{h}')
        if v: rows.append([f"{lab} {'보유' if h == '1' else '미보유'}"] + e5chrono(v))
for c, v in sorted(e5.items()):
    if c.startswith('chrono|combo|'):
        bits = c.split('|')[2]
        rows.append([f"영도{bits[0]} 동토{bits[1]} 역행{bits[2]}"] + e5chrono(v))
P(''); tbl(HC, rows)
P('\n주의: 보유 · 미보유는 단순 비교 (등급 · 페이즈 차이가 섞임). 전공은 5등급마다 하나씩 늘어난다.')
RES['exp5'] = e5

# ═════════ 6. P4 병목
P('\n## 6. P4 병목\n')
P('### 6a. 보스 · 전장별 (페이즈 3 ~ 5)\n')
e6 = aggB['e6']
ELS = ['phys', 'chem', 'elec', 'psy', 'holy', 'true']
ELN = {'phys': '물리', 'chem': '화학', 'elec': '전기', 'psy': '정신', 'holy': '신성', 'true': '고정'}
def e6row(lab, v):
    n = v['n']; ed = max(1, v['edmg'])
    stb = sorted([(k[3:], x) for k, x in v.items() if k.startswith('sb_')], key=lambda x: -x[1])[:3]
    stn = sorted([(k[3:], x) for k, x in v.items() if k.startswith('sn_')], key=lambda x: -x[1])[:3]
    ln = max(1, v.get('lossN', 0))
    return [lab, n, pc(v['win'] / n), f1(v['dur'] / n), pc(v.get('timeout', 0) / ln) if v.get('lossN') else '·', pc(v.get('bossLeft', 0) / ln) if v.get('lossN') and '보스' in lab else '·', f2(v['deaths'] / n), f2(v['edmg'] / max(1, v['allyHp'])),
            ' · '.join(f"{ELN[e]} {v.get('el_' + e, 0) / ed * 100:.0f}" for e in ELS if v.get('el_' + e, 0) / ed >= 0.03),
            ', '.join(f"{k.split(':')[1]} {x / n:.1f}" for k, x in stb) or '·', ', '.join(f"{k.split(':')[1]} {x / n:.1f}" for k, x in stn) or '·']
H6 = ['전투', '전투 수', '승률', '시간(초)', '패배 중 시간 초과', '패배 시 보스 남은 체력', '아군 사망', '적 피해 ÷ 아군 최대 체력 합', '적 피해 원소 비율 %', '보스가 건 상태 (전투당 횟수)', '일반 적이 건 상태 (전투당)']
P('**요약 (전장별 P3 ~ P5 보스 · P4 일반 · 역경 승률)**\n')
rows = []
def g6(f, ph, t):
    vs = [v for k, v in e6.items() if k.startswith(f'{f}|{ph}|{t}|')]
    if not vs: return None
    n = sum(v['n'] for v in vs); w = sum(v['win'] for v in vs); ln = sum(v.get('lossN', 0) for v in vs); to = sum(v.get('timeout', 0) for v in vs); bl = sum(v.get('bossLeft', 0) for v in vs)
    return n, w / n, to / max(1, ln), bl / max(1, ln)
for f in sorted(FLD):
    r3, r4, r5, n4, a4 = g6(f, 3, 'boss'), g6(f, 4, 'boss'), g6(f, 5, 'boss'), g6(f, 4, 'battle'), g6(f, 4, 'adversity')
    if not r4: continue
    bn = [EN.get(k.split('|')[3], '?') for k in e6 if k.startswith(f'{f}|4|boss|')]
    rows.append([FLD[f], ', '.join(bn), f"{pc(r4[1])} (n={r4[0]})", pc(r4[2]), pc(r4[3]), pc(r3[1]) if r3 else '·', pc(r5[1]) if r5 else '·', pc(n4[1]) if n4 else '·', pc(a4[1]) if a4 else '·'])
tbl(['전장', 'P4 보스', 'P4 보스 승률', 'P4 보스 패배 중 시간 초과', 'P4 보스 패배 시 보스 남은 체력', 'P3 보스 승률', 'P5 보스 승률', 'P4 일반 승률', 'P4 역경 승률'], rows)
for f in sorted(FLD):
    rows = []
    for ph in [3, 4, 5]:
        bs = [(k, v) for k, v in e6.items() if k.startswith(f'{f}|{ph}|boss|')]
        for k, v in bs: rows.append(e6row(f"P{ph} 보스 {EN.get(k.split('|')[3], k.split('|')[3])}", v))
        v = e6.get(f'{f}|{ph}|battle|-')
        if v: rows.append(e6row(f'P{ph} 일반', v))
        v = e6.get(f'{f}|{ph}|adversity|-')
        if v: rows.append(e6row(f'P{ph} 역경', v))
    P(f"\n**{FLD[f]}**\n"); tbl(H6, rows)
# 반사실
P('\n### 6b. 반사실 (같은 전투를 같은 시드로 다시: 아군 피해 +15% / 아군 최대 체력 +15% / 아군 받는 회복 +30%)\n')
cf = [(r['seed'], row) for r in runsB for row in r.get('cf', [])]
GN = {1: 'P4 보스', 2: 'P4 일반 전투', 3: 'P3 보스'}
rows = []; r6 = {}
for g in [1, 2, 3]:
    sel = [(s, x) for s, x in cf if x[0] == g]
    if not sel: continue
    bys = collections.defaultdict(list)
    for s, x in sel: bys[s].append(x)
    ctl_match = sum(1 for _, x in sel if x[1] == x[2]) / len(sel)
    base = sum(x[2] for _, x in sel) / len(sel)
    row = [GN[g], len(sel), pc(ctl_match), pc(base)]
    for i, lab in [(3, 'dmg'), (4, 'hp'), (5, 'heal')]:
        rr = [(sum(x[i] - x[2] for x in xs), len(xs)) for xs in bys.values()]
        e = ratio_cluster(rr)
        r6[f'{g}|{lab}'] = e
        flips_up = sum(1 for _, x in sel if x[i] > x[2]) / len(sel); flips_dn = sum(1 for _, x in sel if x[i] < x[2]) / len(sel)
        row.append(f"{pp(e['est'])}{sig(e)} {ci(e)} (↑{flips_up * 100:.1f} ↓{flips_dn * 100:.1f})")
    rows.append(row)
tbl(['표본', '전투', '대조군 = 원래 결과', '기준 승률', '피해 +15%', '최대 체력 +15%', '받는 회복 +30%'], rows)
P('\n괄호: 패→승 / 승→패로 뒤집힌 전투 비율 (%). 대조군 재실행이 원래 결과와 100% 일치해야 결정론이 성립.')
RES['exp6b'] = r6

# ═════════ 7. 전장별 기물 강도 일관성
P('\n## 7. 전장별 시작 기물 클리어율 (기준 팔 9600런)\n')
st = collections.defaultdict(lambda: [0, 0])
fieldsSeen = sorted({r['field'] for r in runsB})
for r in runsB:
    for u in r['starters']:
        st[(u, r['field'])][0] += 1; st[(u, r['field'])][1] += r['cleared']
    st[('_all', r['field'])][0] += 1; st[('_all', r['field'])][1] += r['cleared']
units = sorted({u for u, _ in st if u != '_all'}, key=lambda u: -sum(st[(u, f)][1] for f in fieldsSeen) / max(1, sum(st[(u, f)][0] for f in fieldsSeen)))
rows = []
for u in units:
    tn = sum(st[(u, f)][0] for f in fieldsSeen); tw = sum(st[(u, f)][1] for f in fieldsSeen)
    rows.append([name(u), TTN.get(UN.get(u, {}).get('tt'), '?'), tn, pc(tw / tn)] + [f"{pc(st[(u, f)][1] / st[(u, f)][0])} ({st[(u, f)][0]})" if st[(u, f)][0] else '·' for f in fieldsSeen])
rows.append(['(전체)', '', sum(st[('_all', f)][0] for f in fieldsSeen), pc(sum(st[('_all', f)][1] for f in fieldsSeen) / len(runsB))] + [pc(st[('_all', f)][1] / st[('_all', f)][0]) for f in fieldsSeen])
tbl(['기물', '전술', '시작 런', '전체 클리어'] + [FLD.get(f, f) for f in fieldsSeen], rows)
P('\n### 전장 쌍별 기물 순위 스피어만 상관 (기물별 시작 클리어율, 각 전장 시작 런 ≥ 40 인 기물)\n')
rows = []; r7 = {}
for i, a in enumerate(fieldsSeen):
    for b in fieldsSeen[i + 1:]:
        us = [u for u in units if st[(u, a)][0] >= 40 and st[(u, b)][0] >= 40]
        x = [st[(u, a)][1] / st[(u, a)][0] for u in us]; y = [st[(u, b)][1] / st[(u, b)][0] for u in us]
        rho = spearman(x, y); r7[f'{a}|{b}'] = rho
        rows.append([FLD.get(a, a), FLD.get(b, b), len(us), f2(rho)])
tbl(['전장 A', '전장 B', '기물 수', 'ρ'], rows)
# 표본 잡음 기준: 반으로 나눈 같은 전장끼리의 상관
half = []
for f in fieldsSeen:
    s1 = collections.defaultdict(lambda: [0, 0]); s2 = collections.defaultdict(lambda: [0, 0])
    for r in runsB:
        if r['field'] != f: continue
        s = s1 if r['seed'] % 2 else s2
        for u in r['starters']: s[u][0] += 1; s[u][1] += r['cleared']
    us = [u for u in units if s1[u][0] >= 20 and s2[u][0] >= 20]
    half.append((f, len(us), spearman([s1[u][1] / s1[u][0] for u in us], [s2[u][1] / s2[u][0] for u in us])))
P('\n잡음 기준 (같은 전장을 홀 · 짝 시드로 나눈 두 절반 사이 ρ): ' + ', '.join(f"{FLD.get(f, f)} {r:.2f} (n={n})" for f, n, r in half))
rel = {f: 2 * r / (1 + r) for f, n, r in half}  # 스피어만-브라운: 전체 표본 신뢰도
P('\n전체 표본 신뢰도 (스피어만-브라운 2r/(1+r)): ' + ', '.join(f"{FLD.get(f, f)} {rel[f]:.2f}" for f in fieldsSeen))
P('\n**잡음 보정 상관 (ρ ÷ √(신뢰도A · 신뢰도B), 1 에 가까울수록 전장이 달라도 순위가 같다)**\n')
tbl(['전장 A', '전장 B', 'ρ', '보정 ρ'], [[FLD.get(a, a), FLD.get(b, b), f2(r7[f'{a}|{b}']), f2(r7[f'{a}|{b}'] / math.sqrt(rel[a] * rel[b]))] for i, a in enumerate(fieldsSeen) for b in fieldsSeen[i + 1:]])
RES_rel = rel
RES['exp7'] = {'rho': r7, 'split_half': half}

# ═════════ 8. 성유물
P('\n## 8. 디바인 성유물\n')
P('### 8a. 기준 팔 (기본 성유물)\n')
rows = []
for rel, v in sorted(aggB['e8r'].items(), key=lambda x: -x[1]['act'] / x[1]['n']):
    n = v['n']; a = max(1, v['act'])
    rows.append([REL.get(rel, rel), n, pc(v['act'] / n), f1(v['actT'] / a), f1(v['remain'] / a), pc(v['remain'] / max(1, v['remain'] + v['actT'])), pc(v['win'] / n)])
tbl(['성유물', '디바인-전투', '발동률', '평균 발동 시각(초)', '발동 후 남은 시간(초)', '발동 후 시간 비중', '승률'], rows)
P('\n### 8b. 성유물 무작위 팔\n')
RR = load('randrelic')
if RR:
    rr = RR['runs']; ag = RR['agg']
    P(f"시드 {rr[0]['seed']}..{rr[-1]['seed']} ({len(rr)}런), 클리어 {pc(sum(r['cleared'] for r in rr) / len(rr))}\n")
    rows = []
    for rel, v in sorted(ag['e8r'].items(), key=lambda x: -x[1]['act'] / x[1]['n']):
        n = v['n']; a = max(1, v['act'])
        rows.append([REL.get(rel, rel), n, pc(v['act'] / n), f1(v['actT'] / a), f1(v['remain'] / a), pc(v['remain'] / max(1, v['remain'] + v['actT'])), f1(v['dur'] / n), pc(v['died'] / n), pc(v['win'] / n)])
    tbl(['성유물', '디바인-전투', '발동률', '평균 발동 시각(초)', '발동 후 남은 시간(초)', '발동 후 시간 비중', '전투 시간', '디바인 사망률', '승률'], rows)
    k = ag.get('e8key', {})
    if 'all' in k:
        v = k['all']; n = v['n']
        P(f"\n**하데스의 열쇠**: 부활 {n}회 (열쇠 발동 {ag['e8r'].get('key', {}).get('act', 0)}회 중 {pc(n / max(1, ag['e8r'].get('key', {}).get('act', 1)))}), 평균 부활 시각 {v['t'] / n:.1f}초, 부활 후 남은 시간 {v['remain'] / n:.1f}초, 부활 기물 전투 끝 생존 {pc(v['survived'] / n)}, 그 전투 승률 {pc(v['win'] / n)}\n")
        rows = []
        for kk, vv in sorted(k.items(), key=lambda x: -x[1]['n']):
            if kk.startswith('ct|') or kk.startswith('tt|'):
                t, c = kk.split('|')
                rows.append([('전투 ' + CTN.get(c, c)) if t == 'ct' else ('전술 ' + TTN.get(c, c)), vv['n'], pc(vv['n'] / n), pc(vv['survived'] / vv['n'])])
        tbl(['부활 기물 유형', '횟수', '비중', '끝까지 생존'], rows)
        rows = [[name(kk[2:]), vv['n'], pc(vv['survived'] / vv['n'])] for kk, vv in sorted(k.items(), key=lambda x: -x[1]['n']) if kk.startswith('u|')][:12]
        P('\n부활 기물 상위 12\n'); tbl(['기물', '횟수', '끝까지 생존'], rows)
    P('\n### 성유물 × 디바인 기물: 평균 발동 시각 (초, 발동률) — 신앙 · 기물 의존도\n')
    divs = sorted({k.split('|')[1] for k in ag['e8ru']})
    rels = sorted(ag['e8r'], key=lambda r: REL.get(r, r))
    rows = []
    for d in divs:
        row = [name(d)]
        for rel in rels:
            v = ag['e8ru'].get(f'{rel}|{d}')
            row.append(f"{v['actT'] / v['act']:.1f} ({v['act'] / v['n'] * 100:.0f}%)" if v and v['act'] >= 10 else '·')
        rows.append(row)
    tbl(['기물'] + [REL.get(r, r) for r in rels], rows)
    RES['exp8'] = {'relic': ag['e8r'], 'key': k, 'relic_unit': ag['e8ru']}

open(os.path.join(ROOT, 'RESULTS.md'), 'w').write('\n'.join(out) + '\n')
json.dump(RES, open(os.path.join(ROOT, 'results.json'), 'w'), ensure_ascii=False, indent=1, default=str)
print('\n'.join(out))
