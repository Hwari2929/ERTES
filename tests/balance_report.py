# 밸런스 보고서 집계: balance.cjs 워커 출력(part*.json)을 합쳐 지표를 계산하고 report_data.json 으로 저장한다.
# 실행: python3 tests/balance_report.py <part 디렉터리> <meta.json> <출력.json>
import json, sys, glob, math, collections

src_dir, meta_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
M = json.load(open(meta_path))
agg, runs = collections.defaultdict(dict), []
for p in sorted(glob.glob(f'{src_dir}/part*.json')):
    d = json.load(open(p))
    runs += d['runs']
    for t, rows in d['agg'].items():
        for k, v in rows.items():
            a = agg[t].setdefault(k, {})
            for f, x in v.items(): a[f] = a.get(f, 0) + x
for r in runs: r['phase'] = min(r['phase'], 6)  # 의뢰 성공 후 페이즈 7로 넘어간 값은 6으로 (도달 기준)
N = len(runs)
G = lambda t: agg.get(t, {})
div = lambda a, b: (a / b) if b else None
r1 = lambda x, n=1: None if x is None else round(x, n)

# ───────── 전체 · 페이즈
phases = sorted(int(k) for k in G('phase'))
ph = {}
for p in phases:
    a = G('phase')[str(p)]
    n = a['battles']
    ph[p] = {
        'battles': n, 'win': div(a['wins'], n),
        'dmg': a['dmg'] / n, 'heal': a['heal'] / n, 'shield': a['shield'] / n, 'taken': a['taken'] / n,
        'evaded': a['evaded'] / n, 'enemyDmg': a['enemyDmg'] / n, 'dur': a['dur'] / n,
        'deaths': a['deaths'] / n, 'units': a['units'] / n, 'kills': a['kills'] / n,
    }
base_win = {p: ph[p]['win'] for p in phases}
# 기물 1명 평균 (페이즈별): 지표 정규화 기준
per_unit_avg = {}
for p in phases:
    a = G('phase')[str(p)]
    u = a['units'] or 1
    per_unit_avg[p] = {k: a[k] / u for k in ['dmg', 'heal', 'shield', 'taken', 'evaded', 'kills']}

reach = {p: sum(1 for r in runs if r['phase'] >= p) / N for p in range(1, max(r['phase'] for r in runs) + 1)}
clear = sum(r['cleared'] for r in runs) / N
avg_phase = sum(r['phase'] for r in runs) / N
death = []
for k, v in G('death').items():
    p, t = k.split('|')
    death.append({'ph': int(p), 't': t, 'n': v['n'], 'pct': v['n'] / N})
death.sort(key=lambda x: (x['ph'], x['t']))
nodes = []
for k, v in G('node').items():
    p, t = k.split('|')
    nodes.append({'ph': int(p), 't': t, 'n': v['n'], 'win': v['wins'] / v['n'], 'dur': v['dur'] / v['n']})
fields = collections.defaultdict(lambda: [0, 0, 0])
for r in runs:
    f = fields[r['field']]; f[0] += r['cleared']; f[1] += 1; f[2] += r['phase']
fields = [{'id': k, 'name': M['fields'].get(k, k), 'n': v[1], 'clear': v[0] / v[1], 'phase': v[2] / v[1]} for k, v in fields.items()]

def lift(table_ph, key_fn):
    """페이즈별 기준 승률 대비 승률 차이 (전투 가중)"""
    out = collections.defaultdict(lambda: [0, 0, 0.0])
    for k, v in table_ph.items():
        key, p = key_fn(k)
        if p not in base_win: continue
        o = out[key]; o[0] += v['wins']; o[1] += v['n']; o[2] += v['n'] * base_win[p]
    return {k: {'n': n, 'win': w / n, 'lift': (w - e) / n} for k, (w, n, e) in out.items() if n}

# ───────── 기물
unit_lift = lift(G('unit_ph'), lambda k: (k.split('|')[0], int(k.split('|')[1])))
def norm_index(table_ph, key, metric):
    """페이즈 평균(기물 1명) 대비 지표 배율: 1.0 = 평균"""
    s = e = 0
    for k, v in table_ph.items():
        kk, p = k.rsplit('|', 1)
        if kk != key: continue
        p = int(p)
        s += v[metric]; e += v['n'] * per_unit_avg[p][metric]
    return div(s, e)
starter = collections.defaultdict(lambda: [0, 0, 0])
for r in runs:
    for s in r['starters']:
        a = starter[s]; a[0] += r['cleared']; a[1] += 1; a[2] += r['phase']
used = collections.Counter(u for r in runs for u in r['used'])
final = collections.Counter(u for r in runs for u in set(r['final']))
final_clear = collections.Counter(u for r in runs if r['cleared'] for u in set(r['final']))
units = []
for uid, info in M['units'].items():
    a = G('unit').get(uid)
    off = G('offer').get(uid, {'offered': 0, 'picked': 0})
    st = starter.get(uid)
    row = {'id': uid, 'name': info['name'], 'ct': info['ct'], 'tt': info['tt'], 'syn': info['syn'], 'starter': info['starter'],
           'offered': off['offered'], 'pickRate': div(off['picked'], off['offered']),
           'startN': st[1] if st else 0, 'startClear': div(st[0], st[1]) if st else None, 'startPhase': div(st[2], st[1]) if st else None,
           'joinRate': used[uid] / N, 'finalClear': div(final_clear[uid], final[uid])}
    if a:
        n = a['n']
        row.update({'battles': n, 'win': a['wins'] / n, 'lift': unit_lift.get(uid, {}).get('lift'),
                    'share': a['share'] / n, 'tshare': a['tshare'] / n, 'death': a['died'] / n, 'survive': 1 - a['died'] / n,
                    'kills': a['kills'] / n, 'rank': a['rank'] / n,
                    'iDmg': norm_index(G('unit_ph'), uid, 'dmg'), 'iHeal': norm_index(G('unit_ph'), uid, 'heal'),
                    'iShield': norm_index(G('unit_ph'), uid, 'shield'), 'iTaken': norm_index(G('unit_ph'), uid, 'taken'),
                    'iEvaded': norm_index(G('unit_ph'), uid, 'evaded')})
    units.append(row)

# ───────── 전투 유형 · 전술 유형
def type_rows(tbl, tbl_ph, names):
    lf = lift(tbl_ph, lambda k: (k.split('|')[0], int(k.split('|')[1])))
    out = []
    for key, a in tbl.items():
        n = a['n']
        out.append({'id': key, 'name': names.get(key, key), 'battles': n, 'win': a['wins'] / n, 'lift': lf.get(key, {}).get('lift'),
                    'share': a['share'] / n, 'tshare': a['tshare'] / n, 'death': a['died'] / n, 'kills': a['kills'] / n,
                    'iDmg': norm_index(tbl_ph, key, 'dmg'), 'iHeal': norm_index(tbl_ph, key, 'heal'), 'iShield': norm_index(tbl_ph, key, 'shield'),
                    'iTaken': norm_index(tbl_ph, key, 'taken'), 'iEvaded': norm_index(tbl_ph, key, 'evaded'),
                    'byPh': {p: (lambda v: {'share': v['share'] / v['n'], 'death': v['died'] / v['n']} if v else None)(tbl_ph.get(f'{key}|{p}')) for p in phases}})
    return sorted(out, key=lambda x: -x['share'])
ctypes = type_rows(G('ct'), G('ct_ph'), M['ct'])
ttypes = type_rows(G('tt'), G('tt_ph'), M['tt'])
combo = []
for k, a in G('cttt').items():
    c, t = k.split('|')
    combo.append({'ct': c, 'tt': t, 'n': a['n'], 'share': a['share'] / a['n'], 'death': a['died'] / a['n'], 'win': a['wins'] / a['n']})

# ───────── 유형 상성 행렬
def matrix(side, kind, stage='all'):
    out = []
    for pair, v in G(f'mx_{side}_{kind}_{stage}').items():
        s, t = pair.split('>')
        out.append({'src': s, 'tgt': t, 'hits': v.get('hits', 0), 'mult': div(v.get('dealt', 0), v.get('base', 0)),
                    'hit': 1 - div(v.get('miss', 0), v.get('hits', 0)) if v.get('hits') else None,
                    'crit': div(v.get('crit', 0), v.get('hits', 0) - v.get('miss', 0)), 'dealt': v.get('dealt', 0)})
    return out
mx = {f'{s}_{k}_{st}': matrix(s, k, st) for s in 'AE' for k in ['ct', 'tt'] for st in ['all', 'early', 'mid', 'late']}

# ───────── 시너지
syn_tier = collections.defaultdict(dict)
syn_lift = lift(G('syn_ph'), lambda k: ('|'.join(k.split('|')[:2]), int(k.split('|')[2])))
for k, v in G('syn').items():
    sid, t = k.split('|')
    syn_tier[sid][int(t)] = {'n': v['n'], 'win': v['wins'] / v['n'], 'lift': syn_lift.get(k, {}).get('lift')}
syns = []
for sid, info in M['syn'].items():
    mt = [r['synMax'].get(sid, 0) for r in runs]
    any1 = [r for r in runs if r['synMax'].get(sid, 0) >= 1]
    none = [r for r in runs if r['synMax'].get(sid, 0) == 0]
    cf = G('cf').get(sid)
    row = {'id': sid, 'name': info['name'], 'kind': info['kind'], 'color': info['color'], 'tiers': info['tiers'],
           'reach': [sum(1 for x in mt if x >= t) / N for t in range(1, len(info['tiers']) + 1)],
           'clearWith': div(sum(r['cleared'] for r in any1), len(any1)), 'clearWithout': div(sum(r['cleared'] for r in none), len(none)),
           'phaseWith': div(sum(r['phase'] for r in any1), len(any1)),
           'tiersData': syn_tier.get(sid, {})}
    allb = [v for v in syn_tier.get(sid, {}).values()]
    nb = sum(v['n'] for v in allb)
    row['battles'] = nb
    row['lift'] = div(sum(v['n'] * (v['lift'] or 0) for v in allb), nb)
    if cf:
        row['cf'] = {'n': cf['n'], 'dmgUp': div(cf['full'] - cf['without'], cf['without']), 'dmgAbs': (cf['full'] - cf['without']) / cf['n'],
                     'winFull': cf['winFull'] / cf['n'], 'winWithout': cf['winWithout'] / cf['n'],
                     'durFull': cf['durFull'] / cf['n'], 'durWithout': cf['durWithout'] / cf['n']}
        row['cfTier'] = {}
        for k, v in G('cf_t').items():
            s2, t = k.split('|')
            if s2 == sid: row['cfTier'][int(t)] = {'n': v['n'], 'dmgUp': div(v['full'] - v['without'], v['without']), 'winDelta': (v['winFull'] - v['winWithout']) / v['n']}
    syns.append(row)

# ───────── 장비
item_lift = lift(G('item_ph'), lambda k: (k.rsplit('|', 1)[0], int(k.rsplit('|', 1)[1])))
items = []
for it, a in G('item').items():
    info = M['items'].get(it, {'name': it, 'tier': '?'})
    items.append({'id': it, 'name': info['name'], 'tier': info['tier'], 'n': a['n'], 'win': a['wins'] / a['n'], 'lift': item_lift.get(it, {}).get('lift'),
                  'share': a['share'] / a['n'], 'death': a['died'] / a['n']})
tier_sum = collections.defaultdict(lambda: [0, 0, 0.0, 0.0])
for x in items:
    t = tier_sum[x['tier']]; t[0] += x['n']; t[1] += x['n'] * x['win']; t[2] += x['n'] * (x['lift'] or 0); t[3] += x['n'] * x['share']
tiers = [{'tier': k, 'n': v[0], 'win': v[1] / v[0], 'lift': v[2] / v[0], 'share': v[3] / v[0]} for k, v in tier_sum.items()]
# 기물별 장비: 그 기물의 같은 페이즈 평균 승률 대비
unit_base = {}
for k, v in G('unit_ph').items():
    u, p = k.split('|'); unit_base[(u, int(p))] = v['wins'] / v['n']
unit_share_ph = {}
for k, v in G('unit_ph').items():
    u, p = k.split('|'); unit_share_ph[(u, int(p))] = v['share'] / v['n']
ui = collections.defaultdict(lambda: [0, 0, 0.0, 0.0, 0.0])
for k, v in G('unit_item_ph').items():
    u, it, p = k.split('|'); p = int(p)
    o = ui[(u, it)]; o[0] += v['wins']; o[1] += v['n']; o[2] += v['n'] * unit_base.get((u, p), 0); o[3] += v['share']; o[4] += v['n'] * unit_share_ph.get((u, p), 0)
unit_items = collections.defaultdict(list)
for (u, it), (w, n, e, sh, esh) in ui.items():
    if n < 40 or it.startswith('U_'): continue
    info = M['items'].get(it, {'name': it, 'tier': '?'})
    lf, su = (w - e) / n, (sh - esh) / n
    # 표본이 작을수록 0 쪽으로 당긴 점수로 순위를 매긴다 (n=60 이면 절반)
    unit_items[u].append({'id': it, 'name': info['name'], 'tier': info['tier'], 'n': n, 'win': w / n, 'lift': lf, 'shareUp': su, 'score': (lf + su * 0.1) * n / (n + 60)})
best_items = {u: sorted(v, key=lambda x: -x['score'])[:3] for u, v in unit_items.items()}
worst_items = {u: sorted(v, key=lambda x: x['score'])[:2] for u, v in unit_items.items()}
nitems = collections.defaultdict(lambda: [0, 0, 0.0])
for k, v in G('nitems').items():
    c, p = k.split('|'); o = nitems[int(c)]; o[0] += v['wins']; o[1] += v['n']; o[2] += v['n'] * base_win.get(int(p), 0)
nitems = [{'k': k, 'n': v[1], 'lift': (v[0] - v[2]) / v[1]} for k, v in sorted(nitems.items())]
nsyn = collections.defaultdict(lambda: [0, 0, 0.0])
for k, v in G('nsyn').items():
    c, p = k.split('|'); o = nsyn[int(c)]; o[0] += v['wins']; o[1] += v['n']; o[2] += v['n'] * base_win.get(int(p), 0)
nsyn = [{'k': k, 'n': v[1], 'lift': (v[0] - v[2]) / v[1]} for k, v in sorted(nsyn.items())]

out = {
    'N': N, 'clear': clear, 'avgPhase': avg_phase, 'reach': reach, 'death': death, 'nodes': nodes, 'fields': fields,
    'phases': {str(p): ph[p] for p in phases}, 'perUnitAvg': {str(p): per_unit_avg[p] for p in phases},
    'units': units, 'ctypes': ctypes, 'ttypes': ttypes, 'combo': combo, 'mx': mx,
    'syns': syns, 'items': items, 'itemTiers': tiers, 'bestItems': best_items, 'worstItems': worst_items,
    'nitems': nitems, 'nsyn': nsyn, 'ctName': M['ct'], 'ttName': M['tt'],
    'battlesTotal': sum(v['battles'] for v in G('phase').values()), 'cfTotal': sum(v['n'] for v in G('cf').values()),
}
json.dump(out, open(out_path, 'w'), ensure_ascii=False, default=lambda o: None)
print('ok', N, 'runs', out['battlesTotal'], 'battles', out['cfTotal'], 'counterfactual')
