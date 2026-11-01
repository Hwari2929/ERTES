"""배치 영향 집계 (docs/BALANCE_2026_11_01_placement.md): balance.ts 조각 (`placeval`) → 표 (마크다운) + 요약 json.
사용: python3 tests/balance_placement.py <조각 폴더> [출력 폴더]
  - 조각 폴더의 <bot>_*.json 을 읽는다 (node bal.cjs <시드> <판 수> 0.06 7 bot=<bot> instr gearlog pool detail placeval > <bot>_<시드>.json)
  - 출력 폴더 (기본: 조각 폴더) 에 place_tables.md · place_summary.json 을 쓴다
배치 (tests/placeval.ts): bot 봇 배치 · fb 앞뒤 뒤집기 · lr 좌우 뒤집기 · rnd1… 무작위 · S 묶음 공통 시드.
  운 기준선 bot2 = 봇 배치를 다른 시드 묶음 S2 로. 최선 · 최악 = S 에서 고른 배치를 S2 로 다시 잰 값 (best2 · worst2) − bot2.
오차 = 런 군집 95% (같은 런의 전투를 한 묶음, CR0 표준오차 × 1.96)."""
import json, glob, os, sys, math, random
from collections import defaultdict

PARTS = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else PARTS
COLS = ['w', 'aHp', 'eHp', 't', 'tCb', 'tCf', 'tHb', 'dB', 'cB', 'tDb', 'nDb', 'nDf', 'fd', 'pass', 'passM', 'tPass', 'zoc', 'dVan', 'tCbp', 'dBp', 'tCbpRole', 'adj']
C = {k: i for i, k in enumerate(COLS)}
NODES = ['battle', 'adversity', 'challenge', 'boss']
NODE_KO = {'battle': '일반', 'adversity': '역경', 'challenge': '도전', 'boss': '보스', 'all': '전체'}
TENDS = ['charge', 'assassin', 'sniper', 'escort', 'disrupt', 'pack']
TEND_KO = {'charge': '돌격형', 'assassin': '암살형', 'sniper': '저격형', 'escort': '호위형', 'disrupt': '교란형', 'pack': '무리형'}
NARROW = {'corridor', 'corridor5', 'hcorridor'}


def mapclass(r):
    if r['sur']: return '포위'
    if r['map'] in NARROW: return '긴 통로 (4줄)'
    if r['map'] == 'open': return '개활지'
    return '전장 지형 틀'


# ───────── 읽기
B = {}  # bot → [(seed, rec)]
RUNS = {}
ERR = {}
for f in sorted(glob.glob(os.path.join(PARTS, '*_*.json'))):
    bot = os.path.basename(f).split('_')[0]
    if bot not in ('chulsu', 'younghee'): continue
    d = json.load(open(f))
    for run in d['runs']:
        RUNS.setdefault(bot, []).append(run)
        if run.get('err'): ERR[bot] = ERR.get(bot, 0) + 1; continue
        for rec in run.get('pl', []): B.setdefault(bot, []).append((run['seed'], rec))
BOTS = [b for b in ('chulsu', 'younghee') if b in B]
ALL = [(f'{b}:{s}', r) for b in BOTS for s, r in B[b]]  # 두 봇 합침 (군집 = 봇 × 시드)


def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')


def wr(rows, k='w'):
    return mean([x[C[k]] for x in rows])


def V(rec, name):
    """배치 기록 (시드마다): S 묶음 이름 · bot2 · best2 · worst2"""
    if name == 'bot2': return rec['bot2']
    if name == 'best2': return rec.get('best2') or rec['bot2']
    if name == 'worst2': return rec.get('worst2') or rec['bot2']
    if name == 'rnd': return [x for k in rec['v'] if k.startswith('rnd') for x in rec['v'][k]]
    return rec['v'][name]


def clus(items):
    """items: [(군집, 값)] → (평균, 95% 반폭, n)"""
    xs = [v for _, v in items if v == v]
    n = len(xs)
    if not n: return float('nan'), float('nan'), 0
    m = sum(xs) / n
    g = defaultdict(float)
    for c, v in items:
        if v == v: g[c] += v - m
    se = math.sqrt(sum(s * s for s in g.values())) / n
    return m, 1.96 * se, n


def pp(m, h=None, sign=True):
    if m != m: return '–'
    s = f'{m * 100:+.1f}' if sign else f'{m * 100:.1f}'
    return s + (f' ± {h * 100:.1f}' if h is not None and h == h else '')


def diff_items(recs, a, b, k='w'):
    return [(c, wr(V(r, a), k) - wr(V(r, b), k)) for c, r in recs]


def sd(xs):
    xs = [x for x in xs if x == x]
    if len(xs) < 2: return float('nan')
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


OUTL = []


def out(s=''):
    OUTL.append(s)


SUM = {'bots': BOTS, 'battles': {b: len(B[b]) for b in BOTS}, 'runs': {b: len(RUNS[b]) for b in BOTS}, 'err': ERR}

# ───────── 1. 배치별 승률 (노드 종류)
PL = ['fb', 'lr', 'rnd']


def win_table(title, groups, note=''):
    out(f'### {title}')
    out()
    if note: out(note); out()
    out('| 묶음 | 전투 | 봇 배치 승률 | 앞뒤 뒤집기 | 좌우 뒤집기 | 무작위 (3개 평균) | 최선 (S2) | 최악 (S2) | 운: 시드만 바꿈 (S2 − S) |')
    out('|---|---|---|---|---|---|---|---|---|')
    rows = {}
    for name, recs in groups:
        if not recs: continue
        base = clus([(c, wr(V(r, 'bot'))) for c, r in recs])
        cells = [clus(diff_items(recs, p, 'bot')) for p in PL]
        best = clus(diff_items(recs, 'best2', 'bot2'))
        worst = clus(diff_items(recs, 'worst2', 'bot2'))
        luck = clus(diff_items(recs, 'bot2', 'bot'))
        out(f'| {name} | {len(recs)} | {pp(base[0], sign=False)}% | ' + ' | '.join(pp(m, h) for m, h, _ in cells) + f' | {pp(*best[:2])} | {pp(*worst[:2])} | {pp(*luck[:2])} |')
        rows[name] = {'n': len(recs), 'bot': base[0], **{p: cells[i][:2] for i, p in enumerate(PL)}, 'best2': best[:2], 'worst2': worst[:2], 'luck': luck[:2]}
    out()
    return rows


def hp_table(title, groups):
    out(f'### {title}')
    out()
    out('| 묶음 | 봇 배치 아군 / 적 남은 체력 | 앞뒤 뒤집기 Δ아군 / Δ적 | 무작위 Δ아군 / Δ적 | 최선 (S2) Δ아군 / Δ적 | 운 Δ아군 / Δ적 |')
    out('|---|---|---|---|---|---|')
    for name, recs in groups:
        if not recs: continue
        a0 = clus([(c, wr(V(r, 'bot'), 'aHp')) for c, r in recs])[0]
        e0 = clus([(c, wr(V(r, 'bot'), 'eHp')) for c, r in recs])[0]
        cell = []
        for a, b in (('fb', 'bot'), ('rnd', 'bot'), ('best2', 'bot2'), ('bot2', 'bot')):
            da = clus(diff_items(recs, a, b, 'aHp')); de = clus(diff_items(recs, a, b, 'eHp'))
            cell.append(f'{pp(*da[:2])} / {pp(*de[:2])}')
        out(f'| {name} | {a0 * 100:.1f}% / {e0 * 100:.1f}% | ' + ' | '.join(cell) + ' |')
    out()


def by_node(recs):
    g = [(NODE_KO[n], [x for x in recs if x[1]['t'] == n]) for n in NODES]
    return g + [('전체', recs)]


out('## 1. 배치별 승률 (같은 조우 · 같은 시드 묶음 S, 차이는 봇 배치 대비 %p)')
out()
SUM['win'] = {}
for b in BOTS:
    recs = [(f'{b}:{s}', r) for s, r in B[b]]
    SUM['win'][b] = win_table(f'{b}', by_node(recs))
SUM['win']['both'] = win_table('두 봇 합침', by_node(ALL))
hp_table('남은 체력 비율 차 (두 봇 합침, %p)', by_node(ALL))

# ───────── 2. 전투 하나의 민감도: 배치를 바꿀 때 vs 시드만 바꿀 때
out('## 2. 전투 하나의 승률이 움직이는 폭 (표준편차, %p) — 배치 변화 vs 시드 변화')
out()
out('같은 전투에서 (배치 X 승률 − 봇 배치 승률) 의 전투 간 표준편차. 시드 3개 평균끼리의 차라 운만으로도 폭이 생긴다 — "운" 열이 그 기준. 배치 고유 폭 = √(배치 폭² − 운 폭²).')
out()
out('| 묶음 | 운: 시드만 바꿈 | 앞뒤 뒤집기 | 좌우 뒤집기 | 무작위 1개 | 배치 고유 폭 (앞뒤) | 배치 고유 폭 (무작위) | 6개 배치 범위 (최대 − 최소) 관측 | 같은 범위, 운만 (모의) |')
out('|---|---|---|---|---|---|---|---|---|')
rnd_ = random.Random(7)


def null_range(recs, reps=3):
    """운만 있을 때 6개 배치 범위: 전투마다 6개 배치 승률을 모두 합친 p 로 이항(K, p) 6번 → 최대 − 최소 (K = 시드 묶음 크기)"""
    tot = 0; n = 0
    for _, r in recs:
        allw = [x[0] for k in r['v'] for x in r['v'][k]]
        p = mean(allw)
        for _ in range(reps):
            K = len(r['v']['bot'])
            ws = [sum(1 for _ in range(K) if rnd_.random() < p) / K for _ in range(len(r['v']))]
            tot += max(ws) - min(ws); n += 1
    return tot / n


SUM['sens'] = {}
for name, recs in by_node(ALL):
    if not recs: continue
    luck = sd([v for _, v in diff_items(recs, 'bot2', 'bot')])
    s_fb = sd([v for _, v in diff_items(recs, 'fb', 'bot')])
    s_lr = sd([v for _, v in diff_items(recs, 'lr', 'bot')])
    s_rn = sd([wr(r['v'][k]) - wr(r['v']['bot']) for _, r in recs for k in r['v'] if k.startswith('rnd')])
    own = lambda s: math.sqrt(max(0, s * s - luck * luck))
    rng_obs = mean([max(wr(r['v'][k]) for k in r['v']) - min(wr(r['v'][k]) for k in r['v']) for _, r in recs])
    rng_null = null_range(recs)
    out(f'| {name} | {luck * 100:.1f} | {s_fb * 100:.1f} | {s_lr * 100:.1f} | {s_rn * 100:.1f} | {own(s_fb) * 100:.1f} | {own(s_rn) * 100:.1f} | {rng_obs * 100:.1f} | {rng_null * 100:.1f} |')
    SUM['sens'][name] = {'luck': luck, 'fb': s_fb, 'lr': s_lr, 'rnd': s_rn, 'own_fb': own(s_fb), 'own_rnd': own(s_rn), 'range_obs': rng_obs, 'range_null': rng_null}
out()

# 공통 시드 상관: 같은 시드의 봇 배치 · 다른 배치 결과가 얼마나 같이 움직이나 (0 이면 '운' 기준선과 바로 비교해도 된다)
def resid_corr(recs, a, b):
    sxy = sxx = syy = 0.0
    for _, r in recs:
        A = [x[0] for x in V(r, a)]; Bv = [x[0] for x in V(r, b)]
        ma, mb = mean(A), mean(Bv)
        for x, y in zip(A, Bv): sxy += (x - ma) * (y - mb); sxx += (x - ma) ** 2; syy += (y - mb) ** 2
    return sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else float('nan')


# 분산 나누기: 전투 한 번 (시드 1개) 의 승패 분산 = 조우 · 전력 (전투마다 다른 기대 승률) + 배치 (같은 전투에서 배치마다 다른 기대 승률) + 시드 운
def var_split(recs):
    vp = []; vs = []; pb = []
    for _, r in recs:
        ws = [[x[0] for x in r['v'][k]] for k in r['v']]
        K = len(ws[0]); J = len(ws)
        means = [mean(w) for w in ws]
        within = mean([sum((x - m) ** 2 for x in w) / (K - 1) for w, m in zip(ws, means)]) if K > 1 else 0
        gm = mean(means)
        between = sum((m - gm) ** 2 for m in means) / (J - 1)
        vp.append(between - within / K)  # 배치 몫 (치우침 보정, 음수 가능)
        vs.append(within)
        pb.append(gm)
    gp = mean(pb)
    vb = sum((p - gp) ** 2 for p in pb) / max(1, len(pb) - 1)
    P, S_, Bv = max(0.0, mean(vp)), mean(vs), vb
    tot = P + S_ + Bv
    return {'place': P, 'seed': S_, 'enc': Bv, 'tot': tot}


out('### 전투 한 번 결과의 분산 나누기')
out()
out('전투 한 번 (시드 1개) 의 승패 분산을 셋으로 나눈다: 조우 · 전력 (전투마다 기대 승률이 다른 몫) · 배치 (같은 전투에서 6개 배치의 기대 승률이 다른 몫, 시드 3개 평균의 치우침을 뺀 값) · 시드 운 (같은 전투 · 같은 배치에서 시드만 바뀐 몫). 표준편차는 √분산 (%p).')
out()
out('| 묶음 | 조우 · 전력 | 배치 | 시드 운 | 배치 표준편차 | 시드 운 표준편차 |')
out('|---|---|---|---|---|---|')
SUM['var'] = {}
for name, recs in by_node(ALL):
    if not recs: continue
    v = var_split(recs)
    SUM['var'][name] = v
    t = v['tot'] or 1
    out(f'| {name} | {v["enc"] / t * 100:.0f}% | {v["place"] / t * 100:.1f}% | {v["seed"] / t * 100:.0f}% | {math.sqrt(v["place"]) * 100:.1f} | {math.sqrt(v["seed"]) * 100:.1f} |')
out()

cc = {k: resid_corr(ALL, 'bot', k) for k in ('fb', 'lr', 'rnd1', 'bot2')}
out(f'- 공통 시드 상관 (전투 안에서 시드마다 승패의 상관, 두 봇 합침): 봇 배치 ↔ 앞뒤 {cc["fb"]:.2f} · 좌우 {cc["lr"]:.2f} · 무작위 1 {cc["rnd1"]:.2f} · (다른 시드 묶음 S2 {cc["bot2"]:.2f}). 0 에 가까우면 공통 시드가 운을 줄이지 못한 것이라 "운" 열과 바로 견줄 수 있다.')
out()
SUM['crn'] = cc

# ───────── 3. 돌파 지표 (봇 배치 vs 앞뒤 뒤집기 vs 무작위)
def sims(recs, name):
    return [(c, x, r) for c, r in recs for x in V(r, name)]


def bt_rows(recs, name):
    S = sims(recs, name)
    if not S: return None
    dur = [x[C['t']] for _, x, _ in S]
    cont = [x[C['tCb']] for _, x, _ in S]
    hit = [t for t in cont if t >= 0]
    nb = mean([r['dep'][2] / max(1, r['dep'][1] + r['dep'][2]) for _, _, r in S])
    pass_ = [(c, x[C['pass']] / r['foe'][0]) for c, x, r in S if x[C['pass']] >= 0 and r['foe'][0] > 0]
    passM = [(c, x[C['passM']] / r['foe'][1]) for c, x, r in S if x[C['passM']] >= 0 and r['foe'][1] > 0]
    tpass = sorted(x[C['tPass']] for _, x, _ in S if x[C['tPass']] >= 0)
    fdd = [x[C['fd']] for _, x, _ in S if x[C['fd']] > 0]
    bdeaths = [x[C['nDb']] / max(1, r['dep'][2]) for _, x, r in S if r['dep'][2] > 0]
    fdeaths = [x[C['nDf']] / max(1, r['dep'][1]) for _, x, r in S if r['dep'][1] > 0]
    med = lambda xs: sorted(xs)[len(xs) // 2] if xs else float('nan')
    return {
        'n': len(S), 'dur': mean(dur), 'nb_share': nb,
        'cont_rate': len(hit) / len(S), 'cont5': sum(1 for t in hit if t <= 5) / len(S), 'cont10': sum(1 for t in hit if t <= 10) / len(S),
        'cont_med': med(hit), 'cont_rel': med([x[C['tCb']] / x[C['t']] for _, x, _ in S if x[C['tCb']] >= 0 and x[C['t']] > 0]),
        'dB': clus([(c, x[C['dB']]) for c, x, _ in S]), 'cB': mean([x[C['cB']] for _, x, _ in S if x[C['cB']] >= 0]),
        'adj': mean([x[C['adj']] for _, x, _ in S]), 'dVan': mean([x[C['dVan']] for _, x, _ in S]),
        'pass': clus(pass_), 'passM': clus(passM), 'tpass_med': med(tpass),
        'zoc': mean([x[C['zoc']] for _, x, _ in S]),
        'fdB': (sum(1 for v in fdd if v == 2) / len(fdd)) if fdd else float('nan'),
        'bdeath': mean(bdeaths), 'fdeath': mean(fdeaths),
        'tDb_med': med([x[C['tDb']] for _, x, _ in S if x[C['tDb']] >= 0]),
        'dBp': mean([x[C['dBp']] for _, x, _ in S]), 'tCbp_rate': sum(1 for _, x, _ in S if x[C['tCbp']] >= 0) / len(S),
    }


def f1(x, p=False, d=1):
    if x != x: return '–'
    return f'{x * 100:.{d}f}%' if p else f'{x:.{d}f}'


def bt_table(title, groups, names=(('bot', '봇'), ('fb', '앞뒤'), ('rnd', '무작위'))):
    out(f'### {title}')
    out()
    out('| 묶음 | 배치 | 전투 수 (×시드) | 전투 시간 | 후열 인원 몫 | 후열 접촉 (전투 중) | 5초 안 | 10초 안 | 첫 접촉 (중앙값, 초) | 후열 피해 몫 | 돌격가 피해 몫 | 붙은 적 피해 중 후열 몫 | 아군 피해 중 붙은 적 몫 | 적이 앞줄 뒤로 (이동 적당) | 근접 적만 | 첫 침투 (중앙값, 초) | 경계 걸림 | 첫 사망이 후열 | 후열 사망률 | 전열 사망률 |')
    out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    res = {}
    for gname, recs in groups:
        if not recs: continue
        for k, kn in names:
            m = bt_rows(recs, k)
            if not m: continue
            res[f'{gname}|{k}'] = m
            out(f'| {gname} | {kn} | {m["n"]} | {f1(m["dur"])} | {f1(m["nb_share"], True, 0)} | {f1(m["cont_rate"], True, 0)} | {f1(m["cont5"], True, 0)} | {f1(m["cont10"], True, 0)} | {f1(m["cont_med"])} | {pp(m["dB"][0], m["dB"][1], sign=False)}% | {f1(m["dVan"], True, 0)} | {f1(m["cB"], True, 0)} | {f1(m["adj"], True, 0)} | {pp(m["pass"][0], m["pass"][1], sign=False)}% | {f1(m["passM"][0], True, 0)} | {f1(m["tpass_med"])} | {f1(m["zoc"])} | {f1(m["fdB"], True, 0)} | {f1(m["bdeath"], True, 0)} | {f1(m["fdeath"], True, 0)} |')
    out()
    return res


out('## 3. 돌파 지표 (두 봇 합침, 시드마다 1전투로 셈)')
out()
out('후열 = 전열 역할 (근접 · 돌격가 · 앞줄 기물, tests/chulsu/eval.ts isFront) 이 아닌 출전 기물. 봇 배치에서는 뒷줄, 앞뒤 뒤집기에서는 앞줄에 선다. 접촉 = 1칸 안의 적에게 피해 (지속 피해 제외). "적이 앞줄 뒤로" = 아군 맨 앞줄보다 안쪽 칸에 한 번이라도 들어선 적 / 이동하는 적 (포위 지형 제외).')
out()
SUM['bt'] = bt_table('노드 종류', by_node(ALL))

# 위치 기준: 맨 앞줄이 아닌 칸에서 시작한 기물 (역할과 무관)
out('### 위치 기준 (시작 줄): 맨 앞줄이 아닌 칸에 선 기물')
out()
out('| 배치 | 뒷칸 기물 접촉률 | 뒷칸 기물 피해 몫 |')
out('|---|---|---|')
for k, kn in (('bot', '봇'), ('fb', '앞뒤'), ('rnd', '무작위')):
    m = bt_rows(ALL, k)
    out(f'| {kn} | {f1(m["tCbp_rate"], True, 0)} | {f1(m["dBp"], True, 0)} |')
out()

# 시각별 진형 · 표적 (열 yF1 … 이 있는 자료에서만: placeval 보충 측정)
SNAP = [1, 3, 6, 10]
if any(len(x) > len(COLS) for _, r in ALL[:50] for x in r['v']['bot']):
    out('### 진형이 다시 짜이는가: 시각별 평균 깊이 · 후열을 노리는 적 몫')
    out()
    out('깊이 = 아군 맨 앞줄 0, 한 줄 뒤마다 +1 (사이 줄 · 적 진형 쪽으로 나가면 음수). 살아 있는 기물만, 포위 지형 제외. 후열 노림 = 표적이 있는 이동 적 중 후열 역할 기물을 노리는 몫 (후열 인원 몫과 견준다).')
    out()
    out('| 묶음 | 배치 | ' + ' | '.join(f'{t}초 전열 / 후열 깊이 · 후열 노림' for t in SNAP) + ' |')
    out('|---|---|' + '---|' * len(SNAP))
    SUM['snap'] = {}
    for gname, recs in by_node(ALL):
        for k, kn in (('bot', '봇'), ('fb', '앞뒤'), ('rnd', '무작위')):
            S_ = [x for _, r in recs for x in V(r, k) if len(x) > len(COLS)]
            if not S_: continue
            cells = []
            for i, t in enumerate(SNAP):
                j = len(COLS) + 3 * i
                yf = mean([x[j] for x in S_ if x[j] > -9]); yb = mean([x[j + 1] for x in S_ if x[j + 1] > -9]); tg = mean([x[j + 2] for x in S_ if x[j + 2] > -9])
                cells.append(f'{f1(yf, d=2)} / {f1(yb, d=2)} · {f1(tg, True, 0)}')
                SUM['snap'][f'{gname}|{k}|{t}'] = [yf, yb, tg]
            out(f'| {gname} | {kn} | ' + ' | '.join(cells) + ' |')
    out()

# ───────── 4. 나눠 보기
def groups_by(key, recs, order=None, minn=60):
    g = defaultdict(list)
    for c, r in recs:
        k = key(r)
        if k is None: continue
        g[k].append((c, r))
    ks = order if order else sorted(g)
    return [(str(k), g[k]) for k in ks if k in g and len(g[k]) >= minn]


out('## 4. 나눠 보기 (두 봇 합침, 전투 60 이상)')
out()
SUM['split'] = {}
ph_node = groups_by(lambda r: f'P{r["ph"]} {NODE_KO[r["t"]]}', ALL, [f'P{p} {NODE_KO[n]}' for p in range(1, 9) for n in NODES], 40)
SUM['split']['phase_node'] = win_table('페이즈 × 노드', ph_node, '전투 40 이상.')
mc = groups_by(mapclass, ALL, ['개활지', '전장 지형 틀', '긴 통로 (4줄)', '포위'], 30)
SUM['split']['map'] = win_table('지형 틀 묶음', mc, '전투 30 이상. 긴 통로 = corridor · corridor5 · hcorridor (아군 4줄 · 사이 5줄 이상), 포위 = 위아래 (가로 포위는 양옆) 에서 적.')
fld = groups_by(lambda r: r['field'], ALL, None, 60)
SUM['split']['field'] = win_table('전장', fld)


def tendkey(r):
    f = r['foe']
    if f[3] > 0: return '암살형 있음'
    return None


def domtend(r):
    f = r['foe'][2:8]
    tot = sum(f)
    if not tot: return None
    i = max(range(6), key=lambda j: f[j])
    return f'{TEND_KO[TENDS[i]]} 최다'


tg = [('암살형 있음', [x for x in ALL if x[1]['foe'][3] > 0]), ('암살형 없음', [x for x in ALL if x[1]['foe'][3] == 0])]
tg += groups_by(domtend, ALL, [f'{TEND_KO[t]} 최다' for t in TENDS], 60)
SUM['split']['tend'] = win_table('적 성향', tg, '"최다" = 그 조우 적 (이동하지 않는 적 포함) 중 가장 많은 성향.')
vg = groups_by(lambda r: min(r['dep'][3], 3), ALL, [0, 1, 2, 3], 40)
vg = [(f'돌격가 {k}{"+" if k == "3" else ""}명', v) for k, v in vg]
SUM['split']['van'] = win_table('출전 돌격가 수 (돌격가처럼 포함)', vg)
fg = groups_by(lambda r: min(r['dep'][1], 4), ALL, [0, 1, 2, 3, 4], 40)
fg = [(f'전열 역할 {k}{"+" if k == "4" else ""}명', v) for k, v in fg]
SUM['split']['front'] = win_table('출전 전열 역할 수 (근접 · 돌격가 · 앞줄)', fg)
mg = groups_by(lambda r: '근접 적 절반 이상' if r['foe'][0] and r['foe'][1] / r['foe'][0] >= 0.5 else '근접 적 절반 미만', ALL, ['근접 적 절반 이상', '근접 적 절반 미만'])
SUM['split']['melee'] = win_table('적 근접 비율 (이동하는 적 중 사거리 1)', mg)

SUM['bt_split'] = {}
SUM['bt_split']['map'] = bt_table('돌파 지표: 지형 틀 묶음', mc, (('bot', '봇'), ('fb', '앞뒤')))
SUM['bt_split']['van'] = bt_table('돌파 지표: 출전 돌격가 수', vg, (('bot', '봇'), ('fb', '앞뒤')))
SUM['bt_split']['tend'] = bt_table('돌파 지표: 적 성향', tg[:2] + [x for x in tg[2:] if x[0] in ('돌격형 최다', '저격형 최다', '호위형 최다', '무리형 최다', '교란형 최다')], (('bot', '봇'), ('fb', '앞뒤')))
SUM['bt_split']['phase'] = bt_table('돌파 지표: 페이즈', groups_by(lambda r: f'P{r["ph"]}', ALL, [f'P{p}' for p in range(1, 9)], 40), (('bot', '봇'), ('fb', '앞뒤')))

# ───────── 5. 결과를 뒤집는 비율 · 이긴 전투 시간
out('## 5. 배치로 결과가 뒤집히는 비율 (두 봇 합침)')
out()
out('봇 배치가 S 묶음에서 모두 진 전투 중 S2 묶음에서 1승이라도 한 비율: 봇 배치 그대로 (운) vs S 에서 고른 최선 배치. 모두 이긴 전투 중 S2 에서 1패라도 한 비율: 그대로 vs 최악 배치.')
out()
out('| 묶음 | 봇 배치 S 전패 | → S2 1승+: 그대로 | → S2 1승+: 최선 배치 | 봇 배치 S 전승 | → S2 1패+: 그대로 | → S2 1패+: 최악 배치 | 이긴 전투 시간 봇 / 앞뒤 / 무작위 (초) |')
out('|---|---|---|---|---|---|---|---|')
SUM['flip'] = {}
for name, recs in by_node(ALL):
    if not recs: continue
    lost = [r for _, r in recs if wr(V(r, 'bot')) == 0]
    won = [r for _, r in recs if wr(V(r, 'bot')) == 1]
    any_w = lambda rows: any(x[0] for x in rows)
    any_l = lambda rows: any(not x[0] for x in rows)
    a1 = mean([1 if any_w(V(r, 'bot2')) else 0 for r in lost]); a2 = mean([1 if any_w(V(r, 'best2')) else 0 for r in lost])
    b1 = mean([1 if any_l(V(r, 'bot2')) else 0 for r in won]); b2 = mean([1 if any_l(V(r, 'worst2')) else 0 for r in won])
    tw = lambda k: mean([x[C['t']] for _, r in recs for x in V(r, k) if x[0]])
    out(f'| {name} | {len(lost)} | {f1(a1, True, 0)} | {f1(a2, True, 0)} | {len(won)} | {f1(b1, True, 0)} | {f1(b2, True, 0)} | {f1(tw("bot"))} / {f1(tw("fb"))} / {f1(tw("rnd"))} |')
    SUM['flip'][name] = {'lost': len(lost), 'lost_bot2': a1, 'lost_best2': a2, 'won': len(won), 'won_bot2': b1, 'won_worst2': b2, 'tw': [tw('bot'), tw('fb'), tw('rnd')]}
out()

# ───────── 6. 확인: 봇 배치 시드 묶음 승률 vs 실제 전투 (진짜 시드)
out('## 6. 확인')
out()
for b in BOTS:
    recs = [(f'{b}:{s}', r) for s, r in B[b]]
    real = mean([r['real'] for _, r in recs if 'real' in r])
    sim = mean([wr(V(r, 'bot')) for _, r in recs])
    sim2 = mean([wr(V(r, 'bot2')) for _, r in recs])
    out(f'- {b}: 런 {len(RUNS[b])} (실행 실패 {ERR.get(b, 0)}) · 계측 전투 {len(recs)} · 실제 전투 승률 {real * 100:.1f}% · 봇 배치 S {sim * 100:.1f}% · S2 {sim2 * 100:.1f}%')
    bs = defaultdict(int)
    for _, r in recs: bs[r['best']] += 1
    out(f'  - S 에서 최선으로 뽑힌 배치: ' + ' · '.join(f'{k} {v}' for k, v in sorted(bs.items(), key=lambda x: -x[1])))
out()

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'place_tables.md'), 'w').write('\n'.join(OUTL) + '\n')
json.dump(SUM, open(os.path.join(OUT, 'place_summary.json'), 'w'), ensure_ascii=False, indent=1, default=lambda x: None)
print('\n'.join(OUTL))
