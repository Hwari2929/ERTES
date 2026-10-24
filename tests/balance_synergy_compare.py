# 시너지 단계별 승률 비교 (docs/BALANCE_SYNERGY_LIFT.md 3차): python3 tests/balance_synergy_compare.py <names.json> 철수=<폴더> 영희=<폴더>
# 단계마다: 도달 런 비율 · 전체 전투 lift · 보스전 lift · 후반(P4~6) lift · 도달 런 클리어 (lift = 같은 페이즈 · 노드 평균 승률 대비, ± 런 군집 95%)
import json, glob, sys, math, collections as C
NM = json.load(open(sys.argv[1]))['syn']; Z = 1.96
cols = [a.split('=', 1) for a in sys.argv[2:]]
def load(d):
    runs = []; node = C.defaultdict(lambda: [0, 0])
    for p in sorted(glob.glob(d + '/h7_*.json')):
        j = json.load(open(p)); runs += [r for r in j['runs'] if 'err' not in r]
        for k, v in j['agg']['node'].items(): node[k][0] += v['n']; node[k][1] += v['wins']
    return runs, {k: v[1] / v[0] for k, v in node.items() if v[0]}
def lift(runs, base, ok):
    per = C.defaultdict(lambda: C.defaultdict(lambda: [0, 0.0, 0]))
    for r in runs:
        for key, (n, w) in r['det'].items():
            if not key.startswith('s:'): continue
            body, pn = key[2:].rsplit('|', 1); ph, nd = pn.split(':')
            if not ok(int(ph), nd): continue
            b = base.get(f'{ph}|{nd}')
            if b is None: continue
            a = per[body][r['seed']]; a[0] += n; a[1] += n * b; a[2] += w
    out = {}
    for body, rs in per.items():
        N = sum(a[0] for a in rs.values()); E = sum(a[1] for a in rs.values()); W = sum(a[2] for a in rs.values())
        L = (W - E) / N; k = len(rs)
        var = sum(((a[2] - a[1]) - L * a[0]) ** 2 for a in rs.values()) / (N * N) * (k / (k - 1) if k > 1 else 1)
        out[body] = (N, k, L, Z * math.sqrt(var), set(rs))
    return out
D = []
for name, d in cols:
    runs, base = load(d)
    D.append(dict(name=name, runs=runs, n=len(runs), clear=sum(r['cleared'] for r in runs) / len(runs),
                  all=lift(runs, base, lambda p, n: True), boss=lift(runs, base, lambda p, n: n == 'boss'), late=lift(runs, base, lambda p, n: p >= 4)))
def f(x, minN):
    if not x: return '—'
    if x[0] < minN: return f'({x[0]}전)'
    s = f'{x[2]*100:+.1f}'
    return f'**{s}**' if abs(x[2]) > x[3] else s
print('| 구분 | 시너지 | 단계 (인원) | ' + ' | '.join(f"{d['name']} 도달 | {d['name']} 전투 lift | {d['name']} 보스 lift | {d['name']} P4~6 lift | {d['name']} 도달 런 클리어" for d in D) + ' |')
print('|---|---|---|' + '---|---|---|---|---|' * len(D))
for sid, v in sorted(NM.items(), key=lambda kv: (kv[1].get('kind') != 'faction', kv[1]['name'])):
    tiers = v.get('tiers', [])
    if len(tiers) < 2: continue
    for t in range(1, min(4, len(tiers)) + 1):
        k = f'{sid}|{t}'
        if not any(d['all'].get(k) for d in D): continue
        cells = []
        for d in D:
            a = d['all'].get(k)
            if not a: cells += ['0%', '—', '—', '—', '—']; continue
            seeds = a[4]; cl = sum(r['cleared'] for r in d['runs'] if r['seed'] in seeds) / len(seeds)
            cells += [f"{len(seeds)/d['n']*100:.0f}%", f(a, 150), f(d['boss'].get(k), 60), f(d['late'].get(k), 150), f"{cl*100:.0f}% ({(cl-d['clear'])*100:+.0f})" if len(seeds) >= 15 else f'({len(seeds)}런)']
        print(f"| {'진영' if v.get('kind') == 'faction' else '특성'} | {v['name']} | {t}단계 ({tiers[t-1]}) | " + ' | '.join(cells) + ' |')
print('\n' + ' · '.join(f"{d['name']} 클리어 {d['clear']*100:.1f}% ({d['n']}런)" for d in D))
