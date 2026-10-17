# 단일 변경 밸런스 실험 집계 (docs/BALANCE_EXPERIMENTS.md · docs/balance_experiments.json)
# 실행: python3 tests/balance_experiments.py <결과 폴더> > docs/balance_experiments.json
#  결과 폴더 구조 (재현 명령은 docs/BALANCE_EXPERIMENTS.md 끝):
#   runs/<변형>_<봇>/part*.json   tests/balance.ts 출력 (변형 = base · v1_eng …, 봇 = def · pool · d6def · d6pool · chr …)
#   comps/<변형>_<조합 번호>.json  tests/buildsim.ts comps 출력 (조합 1개씩)
#  기준선(base)과 변형은 같은 시드 · 같은 인자로 돌린다. 변형은 기준선 대비 한 가지만 바꾼 작업 사본에서 만든 번들이다.
import glob
import json
import math
import os
import sys

ROOT = sys.argv[1]

# ───────── 실험 정의: (id, 이름, 변형 폴더 접두어, 전체 런 봇, 조합 번호, 대상 시너지/장비 키)
EXPS = [
    {'id': 'v1_eng', 'name': '엔지니어 1단계 포탑 상속률 150 → 180%', 'bots': ['def', 'pool'], 'comps': ['G_UNI5', 'G_HUNTER4', 'H_HUNT5_UNI', 'H_STL6_ENG', 'H_UNI7_SWAP'], 'keys': ['s:ENG|1', 's:ENG|2']},
    {'id': 'v2_hunt1', 'name': '사냥꾼 1단계 공격 속도 15 → 20%', 'bots': ['def', 'pool'], 'comps': [], 'keys': ['s:HUNTER|1', 's:HUNTER|2']},
    {'id': 'v3_hunt2', 'name': '사냥꾼 2단계 최대 체력 비례 고정 피해 2 → 2.5%', 'bots': ['def', 'pool'], 'comps': ['G_HUNTER4', 'H_HUNT5_UNI', 'H_HUNT5'], 'keys': ['s:HUNTER|1', 's:HUNTER|2']},
    {'id': 'v4_taunt', 'name': '위협 신호기 도발 배율 1당 받는 피해 감소 3 → 2.5%', 'bots': ['def', 'pool'], 'comps': [], 'keys': ['i:A_taunt', 'i:L_taunt']},
    {'id': 'v5_tesla', 'name': '테슬라 코일 바운스 계수 50 → 40%', 'bots': [], 'comps': ['G_ENG4|T_tesla', 'H_TURRET|T_tesla'], 'keys': []},
    {'id': 'v6_sir', 'name': '성도회 3단계 부활 3 → 2회', 'bots': [], 'comps': ['H_SIR7_DEMI'], 'keys': []},
    {'id': 'v7_d6', 'name': '모험(위험 6) 적 최소 장비 1개 보장 1 → 3페이즈부터', 'bots': ['d6def', 'd6pool'], 'comps': [], 'keys': []},
]
COMP_IDS = ['G_UNI5', 'G_HUNTER4', 'H_HUNT5_UNI', 'H_STL6_ENG', 'H_UNI7_SWAP', 'H_HUNT5', 'G_ENG4|T_tesla', 'H_TURRET|T_tesla', 'H_SIR7_DEMI']


def wilson(k, n, z=1.96):
    if not n:
        return [0, 0]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def sign_p(a, b):
    """부호 검정 (양측, 정확 이항): a = 성공→실패, b = 실패→성공"""
    n = a + b
    if not n:
        return 1.0
    k = min(a, b)
    s = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return round(min(1.0, 2 * s), 4)


def load_runs(name):
    agg, runs = {}, {}
    files = sorted(glob.glob(os.path.join(ROOT, 'runs', name, 'part*.json')))
    if not files:
        return None
    for p in files:
        d = json.load(open(p))
        for t, rows in d['agg'].items():
            T = agg.setdefault(t, {})
            for k, v in rows.items():
                a = T.setdefault(k, {})
                for f, x in v.items():
                    a[f] = a.get(f, 0) + x
        for r in d['runs']:
            runs[r['seed']] = r
    return agg, runs


def rate_cluster(runs, f):
    """런 군집 비율: f(run) → (n, wins). 반환 (n, 승률, 95% 반폭)"""
    xs = [f(r) for r in runs]
    xs = [x for x in xs if x[0]]
    N = sum(x[0] for x in xs)
    W = sum(x[1] for x in xs)
    if not N:
        return {'n': 0, 'win': None, 'pm': None}
    p = W / N
    R = len(xs)
    var = sum((w - p * n) ** 2 for n, w in xs) * R / max(1, R - 1) / N / N
    return {'n': N, 'win': round(p, 4), 'pm': round(1.96 * math.sqrt(var), 4)}


def lift(agg, runs, key):
    """같은 (페이즈, 노드) 평균 승률 대비 승률 차이. det 키 접두어(s:ENG|1 · i:A_taunt) 기준, 런 군집 오차"""
    base = {k: v['wins'] / v['n'] for k, v in agg['node'].items() if v['n']}
    xs = []
    for r in runs:
        n = w = e = 0
        for k, (bn, bw) in (r.get('det') or {}).items():
            pre, pn = k.rsplit('|', 1)
            if pre != key:
                continue
            ph, nt = pn.split(':')
            n += bn
            w += bw
            e += bn * base.get(f'{ph}|{nt}', 0)
        if n:
            xs.append((n, w, e))
    N = sum(x[0] for x in xs)
    if not N:
        return {'n': 0, 'runs': 0}
    L = sum(w - e for _, w, e in xs) / N
    R = len(xs)
    var = sum(((w - e) - L * n) ** 2 for n, w, e in xs) * R / max(1, R - 1) / N / N
    return {'n': N, 'runs': R, 'win': round(sum(x[1] for x in xs) / N, 4), 'lift': round(100 * L, 2), 'pm': round(196 * math.sqrt(var), 2)}


def by_phase(agg, runs):
    """페이즈별 보스 외 전투 · 보스전 승률 (전투 단위), 페이즈 도달률"""
    out = {}
    rs = list(runs.values())
    for ph in range(1, 7):
        nb = [v for k, v in agg['node'].items() if k.split('|')[0] == str(ph) and k.split('|')[1] != 'boss']
        bo = agg['node'].get(f'{ph}|boss', {'n': 0, 'wins': 0})
        n = sum(v['n'] for v in nb)
        out[str(ph)] = {'reach': round(sum(1 for r in rs if r['phase'] >= ph) / len(rs), 4),
                        'nonBossN': n, 'nonBoss': round(sum(v['wins'] for v in nb) / n, 4) if n else None,
                        'bossN': bo['n'], 'boss': round(bo['wins'] / bo['n'], 4) if bo['n'] else None}
    return out


def run_summary(agg, runs):
    rs = list(runs.values())
    n = len(rs)
    c = sum(1 for r in rs if r['cleared'])
    nb = rate_cluster(rs, lambda r: (r['bw'][2], r['bw'][3]))
    bo = rate_cluster(rs, lambda r: (r['bw'][0], r['bw'][1]))
    return {'runs': n, 'clears': c, 'clear': round(c / n, 4), 'ci': wilson(c, n), 'nonBoss': nb, 'boss': bo,
            'phase': round(sum(r['phase'] for r in rs) / n, 3), 'byPhase': by_phase(agg, runs)}


def compare_runs(b, v):
    (ab, rb), (av, rv) = b, v
    seeds = sorted(set(rb) & set(rv))
    sf = sum(1 for s in seeds if rb[s]['cleared'] and not rv[s]['cleared'])
    fs = sum(1 for s in seeds if not rb[s]['cleared'] and rv[s]['cleared'])
    dph = [rv[s]['phase'] - rb[s]['phase'] for s in seeds]
    m = sum(dph) / len(dph)
    sd = math.sqrt(sum((x - m) ** 2 for x in dph) / max(1, len(dph) - 1))
    B, V = run_summary(ab, rb), run_summary(av, rv)
    return {'base': B, 'var': V, 'dClear': round(V['clear'] - B['clear'], 4), 'SF': sf, 'FS': fs, 'signP': sign_p(sf, fs),
            'dPhase': round(m, 3), 'dPhasePm': round(1.96 * sd / math.sqrt(len(dph)), 3),
            'dNonBoss': round(V['nonBoss']['win'] - B['nonBoss']['win'], 4), 'dBoss': round(V['boss']['win'] - B['boss']['win'], 4)}


def load_comp(v, cid):
    p = os.path.join(ROOT, 'comps', f'{v}_{COMP_IDS.index(cid)}.json')
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    assert d[0]['id'] == cid, (p, d[0]['id'], cid)
    return {(r['f'], r['ph'], r['s'], r['t']): r for r in d[0]['rows'] if r['t'] != 'battle'}, d[0]['syn']


def comp_summary(rows):
    rs = list(rows.values())
    n = len(rs)
    w = sum(r['w'] for r in rs)
    bs = [r for r in rs if r['t'] == 'boss']
    bw = sum(r['w'] for r in bs)
    p6 = [r for r in rs if r['ph'] == 6]
    return {'n': n, 'win': round(w / n, 4), 'ci': wilson(w, n), 'bossN': len(bs), 'bossWin': round(bw / max(1, len(bs)), 4), 'bossCi': wilson(bw, len(bs)),
            'advWin': round(sum(r['w'] for r in rs if r['t'] == 'adversity') / max(1, n - len(bs)), 4),
            'p6Win': round(sum(r['w'] for r in p6) / max(1, len(p6)), 4),
            'dur': round(sum(r['dur'] for r in rs) / n, 2), 'hpLeft': round(sum(r['hpLeft'] for r in rs) / n, 4)}


def compare_comp(v, cid):
    b, x = load_comp('base', cid), load_comp(v, cid)
    if not b or not x:
        return None
    (rb, syn), (rv, _) = b, x
    keys = sorted(set(rb) & set(rv))
    sf = sum(1 for k in keys if rb[k]['w'] and not rv[k]['w'])
    fs = sum(1 for k in keys if not rb[k]['w'] and rv[k]['w'])
    B, V = comp_summary(rb), comp_summary(rv)
    return {'id': cid, 'syn': syn, 'base': B, 'var': V, 'dWin': round(V['win'] - B['win'], 4), 'dBoss': round(V['bossWin'] - B['bossWin'], 4), 'SF': sf, 'FS': fs, 'signP': sign_p(sf, fs)}


# ───────── 무휼 인과 단계. 곡선은 data/chungra.ts causalNeed 와 같게 (JS Math.round 반올림). 후보 곡선은 그 곡선으로 바꾼 번들에서 돌린 결과 폴더 이름으로 고른다
def jr(x):
    return math.floor(x + 0.5)


CURVES = {
    'base': lambda n: jr(9 * (n - 1) ** 2),  # 현재: 9 × (n − 1)²
    'cA_top60': lambda n: jr(9 * (n - 1) ** 2) if n <= 8 else 441 + 60 * (n - 8),  # 후보 A: 8단계까지 그대로, 9 · 10단계는 +60씩 (501 · 561)
    'cB_pow16': lambda n: jr(16.8 * (n - 1) ** 1.6),  # 후보 B: 16.8 × (n − 1)^1.6
}


def stage(pts, need, mx=10):
    n = 1
    while n < mx and pts >= need(n + 1):
        n += 1
    return n


def dist(xs):
    n = len(xs)
    if not n:
        return {'n': 0}
    out = {'n': n, 'mean': round(sum(xs) / n, 2)}
    for s in range(1, 11):
        c = sum(1 for x in xs if x == s)
        if c:
            out[str(s)] = round(c / n, 4)
    out['ge9'] = round(sum(1 for x in xs if x >= 9) / n, 4)
    out['ge9ci'] = wilson(sum(1 for x in xs if x >= 9), n)
    out['eq10'] = round(sum(1 for x in xs if x >= 10) / n, 4)
    out['eq10ci'] = wilson(sum(1 for x in xs if x >= 10), n)
    return out


def chungra(name, curve):
    d = load_runs(name)
    if not d:
        return None
    _, runs = d
    rs = list(runs.values())
    need = CURVES[curve]
    out = {'runs': len(rs), 'curve': curve, 'need': [need(n) for n in range(1, 11)], 'clear': round(sum(1 for r in rs if r['cleared']) / len(rs), 4),
           'clearCi': wilson(sum(1 for r in rs if r['cleared']), len(rs)), 'phase': round(sum(r['phase'] for r in rs) / len(rs), 3)}
    groups = {'chr7': lambda r: r.get('chrMax', 0) >= 3, 'chr5': lambda r: r.get('chrMax', 0) == 2, 'chrAll': lambda r: r.get('chrMax', 0) >= 1}
    for g, f in groups.items():
        sel = [r for r in rs if f(r)]
        o = {'runs': len(sel)}
        for lab, get in [('p5entry', lambda r: (r.get('cz') or {}).get('5', [None])[0]), ('p5boss', lambda r: (r.get('kb') or {}).get('5')),
                         ('p6entry', lambda r: (r.get('cz') or {}).get('6', [None])[0]), ('p6boss', lambda r: (r.get('kb') or {}).get('6')),
                         ('final', lambda r: r.get('causal', 0) if r['cleared'] else None)]:
            pts = [get(r) for r in sel]
            pts = [p for p in pts if p is not None]
            st = [stage(p, need) for p in pts]
            dd = dist(st)
            if pts:
                sp = sorted(pts)
                dd['ptsMed'] = sp[len(sp) // 2]
                dd['ptsMean'] = round(sum(pts) / len(pts), 1)
            o[lab] = dd
        o['clear'] = round(sum(1 for r in sel if r['cleared']) / max(1, len(sel)), 4)
        out[g] = o
    return out


def main():
    res = {'meta': {'baseHead': '5c2ad65', 'note': '각 변형은 기준선 대비 한 가지만 바꾼 작업 사본의 번들. 전체 런 = tests/balance.ts (실제 buildBattle 경로), 조합 = tests/buildsim.ts comps (위험 9, 5 · 6페이즈 역경 + 보스, 조합당 600전)'},
           'exps': [], 'chungra': {}, 'pathCheck': None}
    for e in EXPS:
        o = {'id': e['id'], 'name': e['name'], 'runs': {}, 'comps': [], 'lift': {}}
        for bot in e['bots']:
            b, v = load_runs(f'base_{bot}'), load_runs(f"{e['id']}_{bot}")
            if not b or not v:
                continue
            o['runs'][bot] = compare_runs(b, v)
            for key in e['keys']:
                o['lift'].setdefault(key, {})[bot] = {'base': lift(b[0], b[1].values(), key), 'var': lift(v[0], v[1].values(), key)}
        for cid in e['comps']:
            c = compare_comp(e['id'], cid)
            if c:
                o['comps'].append(c)
        res['exps'].append(o)
    for name in sorted(os.listdir(os.path.join(ROOT, 'runs'))):
        if name.endswith('_chr') and not name.startswith('chk'):
            curve = name[:-4] if name[:-4] in CURVES else 'base'
            c = chungra(name, curve)
            if c:
                if curve != 'base' and load_runs('base_chr'):
                    c['vsBase'] = compare_runs(load_runs('base_chr'), load_runs(name))
                    for k in ('base', 'var'):
                        c['vsBase'][k].pop('byPhase', None)
                res['chungra'][name] = c
    pc = os.path.join(ROOT, 'pathcheck.json')
    if os.path.exists(pc):
        res['pathCheck'] = json.load(open(pc))
    json.dump(res, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
