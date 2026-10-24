# 철수 봇 2,000판 밸런스 보고서 집계 (docs/BALANCE_CHULSU_2000.md · docs/balance_chulsu_2000.json).
# 입력: balance.cjs 조각 출력 <폴더>/<태그>_<시작 시드>.json (태그 n0 · n3 · n6 · n7 = 이번 커밋, o6 · o7 = 직전 커밋)
#       + 이름표 names.json (tests/chulsu2000_names.ts)
# 실행: [FOEPROBE=<이번.json>,<직전.json>] python3 tests/balance_chulsu2000.py <조각 폴더> <names.json> <출력.json> [표.md]
import json, sys, glob, math, collections, os, re

if sys.argv[1] == 'ids':  # 이름표에 넘길 장비 id 목록: python3 tests/balance_chulsu2000.py ids <조각 폴더> > ids.json
    ids = set()
    for p in glob.glob(f'{sys.argv[2]}/*_*.json'):
        for r in json.load(open(p))['runs']:
            ids.update(k[2:].rsplit('|', 1)[0] for k in (r.get('det') or {}) if k.startswith('i:'))
    print(json.dumps(sorted(ids))); sys.exit(0)
src, names_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
md_path = sys.argv[4] if len(sys.argv) > 4 else None
NM = json.load(open(names_path))
Z = 1.96
TAGS = {'n0': ('표준', 0, 'new'), 'n3': ('쉬움', 3, 'new'), 'n6': ('모험', 6, 'new'), 'n7': ('고난', 7, 'new'), 'o6': ('모험', 6, 'old'), 'o7': ('고난', 7, 'old')}
NODE = ['battle', 'adversity', 'challenge', 'boss']


def load(tag):
    runs, agg = [], collections.defaultdict(dict)
    for p in sorted(glob.glob(f'{src}/{tag}_*.json')):
        d = json.load(open(p))
        runs += d['runs']
        for t, rows in d['agg'].items():
            for k, v in rows.items():
                a = agg[t].setdefault(k, {})
                for f, x in v.items(): a[f] = a.get(f, 0) + x
    runs.sort(key=lambda r: r['seed'])
    return runs, agg


def wilson(k, n):
    if not n: return [None, None]
    p = k / n; d = 1 + Z * Z / n; c = p + Z * Z / (2 * n); h = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n))
    return [(c - h) / d, (c + h) / d]


def mean_ci(xs):
    n = len(xs)
    if n < 2: return [sum(xs) / n if n else None, None]
    m = sum(xs) / n; v = sum((x - m) ** 2 for x in xs) / (n - 1)
    return [m, Z * math.sqrt(v / n)]


def reach(r): return 7 if r['cleared'] else min(r['phase'], 6)


def r4(x): return None if x is None else round(x, 4)


def wr(rows):
    n = len(rows); w = sum(rows)
    return {'n': n, 'w': w, 'p': r4(w / n) if n else None}


def summarize(runs, agg):
    ok = [r for r in runs if 'err' not in r]
    N = len(ok); cl = sum(1 for r in ok if r['cleared'])
    rp = mean_ci([reach(r) for r in ok])
    p12 = sum(1 for r in ok if not r['cleared'] and r['phase'] <= 2)
    first_adv, boss, boss_first, adv, allb = [], collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
    death = collections.Counter()
    for r in ok:
        enc = r['ins']['enc']
        fa = next((e for e in enc if e[1] == 1), None)
        if fa: first_adv.append(fa[10])
        seen = set()
        for e in enc:
            ph, nd, w = e[0], e[1], e[10]
            allb[(ph, nd)].append(w)
            if nd == 3:
                boss[ph].append(w)
                if ph not in seen: boss_first[ph].append(w); seen.add(ph)
            if nd == 1: adv[ph].append(w)
        if not r['cleared']:
            last = enc[-1] if enc else None
            death[f"P{min(r['phase'], 6)}|{NODE[last[1]] if last else '?'}"] += 1
    ms = [r['ins']['ms'] for r in ok]
    return {
        'runs': N, 'err': len(runs) - N, 'capped': sum(1 for r in ok if r['ins'].get('capped')),
        'clear': {'k': cl, 'p': r4(cl / N), 'ci': [r4(x) for x in wilson(cl, N)]},
        'reach': {'mean': r4(rp[0]), 'ci': r4(rp[1])},
        'reachDist': dict(sorted(collections.Counter(reach(r) for r in ok).items())),
        'p12end': {'k': p12, 'p': r4(p12 / N)},
        'firstAdv': wr(first_adv),
        'bossByPh': {ph: wr(v) for ph, v in sorted(boss.items())},
        'bossFirstByPh': {ph: wr(v) for ph, v in sorted(boss_first.items())},
        'advByPh': {ph: wr(v) for ph, v in sorted(adv.items())},
        'nodeByPh': {f'{ph}|{NODE[nd]}': wr(v) for (ph, nd), v in sorted(allb.items())},
        'death': dict(sorted(death.items())),
        'deathPh': dict(sorted(collections.Counter(min(r['phase'], 6) for r in ok if not r['cleared']).items())),
        'msPerRun': round(sum(ms) / len(ms)) if ms else None,
        'battlesPerRun': r4(sum(r['battles'] for r in ok) / N),
    }


def base_rates(agg):
    return {k: v['wins'] / v['n'] for k, v in agg['node'].items() if v['n']}


def det_lift(runs, base, prefix):
    """det 키 '<prefix>:<id>|<ph>:<node>' → 같은 (페이즈, 노드) 평균 대비 승률 차 (lift) · 런 군집 95% 오차"""
    per = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0.0, 0]))  # id → seed → [n, E, W]
    for r in runs:
        for key, (n, w) in (r.get('det') or {}).items():
            if not key.startswith(prefix + ':'): continue
            body, pn = key[len(prefix) + 1:].rsplit('|', 1)
            ph, nd = pn.split(':')
            b = base.get(f'{ph}|{nd}')
            if b is None: continue
            a = per[body][r['seed']]; a[0] += n; a[1] += n * b; a[2] += w
    out = {}
    R = len(runs)
    for body, rs in per.items():
        N = sum(a[0] for a in rs.values()); E = sum(a[1] for a in rs.values()); W = sum(a[2] for a in rs.values())
        if not N: continue
        lift = (W - E) / N
        k = len(rs)
        var = sum(((a[2] - a[1]) - lift * a[0]) ** 2 for a in rs.values()) / (N * N) * (k / (k - 1) if k > 1 else 1)
        out[body] = {'battles': N, 'runs': k, 'win': r4(W / N), 'lift': r4(lift), 'ci': r4(Z * math.sqrt(var))}
    return out


def run_split(ok, has):
    """has(r) 인 런과 아닌 런의 클리어 · 도달 페이즈 차"""
    A = [r for r in ok if has(r)]; B = [r for r in ok if not has(r)]
    if not A or not B: return None
    ka, kb = sum(r['cleared'] for r in A), sum(r['cleared'] for r in B)
    ca, cb = ka / len(A), kb / len(B)
    qa, qb = (ka + 1) / (len(A) + 2), (kb + 1) / (len(B) + 2)  # 오차는 Agresti–Caffo (0% · 100% 근처에서 0 이 되지 않게)
    se = math.sqrt(qa * (1 - qa) / (len(A) + 2) + qb * (1 - qb) / (len(B) + 2))
    ra, rb = mean_ci([reach(r) for r in A]), mean_ci([reach(r) for r in B])
    sea = (ra[1] or 0) / Z; seb = (rb[1] or 0) / Z
    return {'n': len(A), 'rate': r4(len(A) / len(ok)), 'clear': r4(ca), 'dClear': r4(ca - cb), 'dClearCi': r4(Z * se), 'reach': r4(ra[0]), 'dReach': r4(ra[0] - rb[0]), 'dReachCi': r4(Z * math.sqrt(sea * sea + seb * seb))}


def detail(runs, agg):
    ok = [r for r in runs if 'err' not in r]
    base = base_rates(agg)
    # 시너지: 런 최고 단계 (engine tierOf) 기준 등장률 · 런 lift, 전투 lift
    syn_b = det_lift(ok, base, 's')
    syn = {}
    for sid, info in NM['syn'].items():
        rows = {}
        for t in range(1, len(info['tiers']) + 1):
            sp = run_split(ok, lambda r, t=t: (r['synMax'].get(sid, 0) >= t))
            bl = syn_b.get(f'{sid}|{t}')
            if sp or bl: rows[t] = {'need': info['tiers'][t - 1], 'run': sp, 'battle': bl}
        if rows: syn[sid] = rows
    # 기물: 출전 런 비율 · 런 lift · 전투 lift
    ub = det_lift(ok, base, 'u')
    units = {}
    for uid in NM['units']:
        sp = run_split(ok, lambda r: uid in r['used'])
        if sp or uid in ub: units[uid] = {'run': sp, 'battle': ub.get(uid), 'start': r4(sum(uid in r['starters'] for r in ok) / len(ok))}
    # 장비 (출전 기물 장착): 런 = 그 장비를 단 기물이 1전 이상 출전, 전투 lift
    ib = det_lift(ok, base, 'i')
    used_items = collections.defaultdict(set)
    for r in ok:
        for key in (r.get('det') or {}):
            if key.startswith('i:'): used_items[key[2:].rsplit('|', 1)[0]].add(r['seed'])
    items = {it: {'run': run_split(ok, lambda r, s=s: r['seed'] in s), 'battle': ib.get(it)} for it, s in used_items.items()}
    # 기물 증강 (출전 기물 보유): 전투 lift + 런
    ab = det_lift(ok, base, 'a')
    used_aug = collections.defaultdict(set)
    for r in ok:
        for key in (r.get('det') or {}):
            if key.startswith('a:'): used_aug[key[2:].rsplit('|', 1)[0]].add(r['seed'])
    augs = {a: {'run': run_split(ok, lambda r, s=s: r['seed'] in s), 'battle': ab.get(a)} for a, s in used_aug.items()}
    # 전역 증강 (런 단위)
    gl = collections.Counter(g for r in ok for g in set(r['ins'].get('glob') or []))
    globs = {g: run_split(ok, lambda r, g=g: g in (r['ins'].get('glob') or [])) for g in gl}
    desp = collections.Counter(d for r in ok for d in set(r.get('despairs') or []))
    desps = {d: run_split(ok, lambda r, d=d: d in (r.get('despairs') or [])) for d in desp}
    # 적 장비 (전투 직전, 위험 등급 장비 s.items · 개조부품 s.mod)
    fg = {}
    for key, v in agg.get('foegear', {}).items():
        nd, ph, tier = key.split('|')
        g = fg.setdefault(f'{nd}|{tier}', collections.Counter()); g.update(v)
        g2 = fg.setdefault(f'{nd}|{tier}|P{ph}', collections.Counter()); g2.update(v)
    foe = {}
    for k, c in fg.items():
        n = c['n']; it = c['items'] or 1
        foe[k] = {'enemies': n, 'perFoe': r4(c['items'] / n), 'k0': r4(c['k0'] / n), 'k1': r4(c['k1'] / n), 'k2': r4(c['k2'] / n), 'k3': r4(c['k3'] / n),
                  'C': r4(c['C'] / it), 'G': r4(c['G'] / it), 'A': r4(c['A'] / it), 'L': r4(c['L'] / it), 'modPerFoe': r4(c['mod'] / n), 'strip': r4(c['strip'] / n)}
    return {'syn': syn, 'units': units, 'items': items, 'augs': augs, 'globs': globs, 'desps': desps, 'foe': foe}


def paired(new, old):
    a = {r['seed']: r for r in new if 'err' not in r}; b = {r['seed']: r for r in old if 'err' not in r}
    seeds = sorted(set(a) & set(b))
    dc = [a[s]['cleared'] - b[s]['cleared'] for s in seeds]
    dr = [reach(a[s]) - reach(b[s]) for s in seeds]
    def fadv(r): return next((e[10] for e in r['ins']['enc'] if e[1] == 1), None)
    fa = [(fadv(a[s]), fadv(b[s])) for s in seeds]
    fa = [x - y for x, y in fa if x is not None and y is not None]
    p12 = [int(not a[s]['cleared'] and a[s]['phase'] <= 2) - int(not b[s]['cleared'] and b[s]['phase'] <= 2) for s in seeds]
    m = lambda xs: [r4(v) for v in mean_ci(xs)]
    # 보스 승률 (페이즈별, 반복 시도 포함 · 시드 군집 무시한 두 비율 차)
    def bwin(runs):
        d = collections.defaultdict(lambda: [0, 0])
        for r in runs:
            for e in r['ins']['enc']:
                if e[1] == 3: d[e[0]][0] += 1; d[e[0]][1] += e[10]
        return d
    bn, bo = bwin(a.values()), bwin(b.values())
    boss = {}
    for ph in sorted(set(bn) | set(bo)):
        n1, w1 = bn[ph]; n0, w0 = bo[ph]
        if n1 and n0:
            p1, p0 = w1 / n1, w0 / n0
            boss[ph] = {'new': r4(p1), 'nNew': n1, 'old': r4(p0), 'nOld': n0, 'd': r4(p1 - p0), 'ci': r4(Z * math.sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0))}
    return {'seeds': len(seeds), 'dClear': m(dc), 'sf': sum(1 for x in dc if x < 0), 'fs': sum(1 for x in dc if x > 0), 'dReach': m(dr), 'dFirstAdv': m(fa), 'nFirstAdv': len(fa), 'dP12': m(p12), 'boss': boss}


out = {'meta': {'defs': {
    'clear': '6페이즈 보스 승리. 95% Wilson', 'reach': '도달 페이즈 (클리어 = 7). 평균 ± 1.96 SE', 'p12end': 'P1–2 에서 끝난 런 (클리어 못 함)',
    'firstAdv': '런의 첫 역경 전투 승률', 'bossByPh': '페이즈별 보스전 승률 (반복 시도 포함). bossFirstByPh = 그 페이즈 첫 시도만',
    'battle lift': '같은 (페이즈, 노드) 평균 승률 대비 차, ± 런 군집 1.96 SE', 'run lift': '그 조건 런 vs 아닌 런의 클리어율 · 도달 페이즈 차 (교란 있음, 인과 아님). 클리어 차 오차는 Agresti–Caffo 1.96 SE',
    'syn tier': '런 최고 활성 단계 (engine tierOf) ≥ t', 'unit run': '1전 이상 출전한 런', 'item run': '그 장비를 단 기물이 1전 이상 출전한 런',
    'aug': '출전 기물이 가진 기물 증강 (전투) · 전역 증강 (런)', 'foe': '전투 직전 적 1명당 위험 등급 장비 수 · 등급 비율 (C 재료 · G 고급 · A 희귀 · L 전설, 적 정의 고유 장비 제외) · 개조부품',
    'paired': '같은 시드 짝 차이 평균 ± 1.96 SE (이번 − 직전). 보스는 두 비율 차 ± 1.96 SE'}}, 'tags': {}}
loaded = {}
for tag, (nm, dv, ver) in TAGS.items():
    if not glob.glob(f'{src}/{tag}_*.json'): continue
    runs, agg = load(tag)
    loaded[tag] = runs
    out['tags'][tag] = {'name': nm, 'diff': dv, 'ver': ver, 'seeds': [runs[0]['seed'], runs[-1]['seed']], 'summary': summarize(runs, agg), **detail(runs, agg)}
    print(tag, out['tags'][tag]['summary']['runs'], out['tags'][tag]['summary']['clear'], file=sys.stderr)
out['paired'] = {d: paired(loaded[f'n{d}'], loaded[f'o{d}']) for d in ('7', '6') if f'n{d}' in loaded and f'o{d}' in loaded}
# 적 장비 풀 확인 (tests/chulsu2000_foeprobe.ts 출력, 이번 · 직전): 환경 변수 FOEPROBE=<이번.json>,<직전.json>
if os.environ.get('FOEPROBE'):
    fn, fo = os.environ['FOEPROBE'].split(',')
    out['foeProbe'] = {'new': json.load(open(fn)), 'old': json.load(open(fo)), 'def': '위험|노드 → 적 장비 id 별 개수 (_foes 적 수 · _boss 보스 수 · _mod 개조부품), 시드 70001~, 페이즈 1~6 조우 생성만'}
json.dump(out, open(out_path, 'w'), ensure_ascii=False, separators=(',', ':'))

# ───────── 표 (Markdown) — 보고서 본문에 붙여 넣는 초안
if not md_path: sys.exit(0)
L = []
P = lambda x: '-' if x is None else f'{x * 100:.1f}%'
PP = lambda x, c: '-' if x is None else f'{x * 100:+.1f} ± {c * 100:.1f}%p'
F = lambda x, c, d=2: '-' if x is None else f'{x:+.{d}f} ± {c:.{d}f}'
un = lambda u: NM['units'].get(u, {}).get('name', u)
TIERN = {'C': '재료', 'G': '고급', 'A': '희귀', 'L': '전설', 'M': '문장', 'U': '고유', 'T': '포탑', 'J': '잡동사니', 'O': '개조'}
itn = lambda i: f"{NM['item'].get(i, {}).get('name', i)} ({TIERN.get(NM['item'].get(i, {}).get('tier', '?'), NM['item'].get(i, {}).get('tier', '?'))})"
an = lambda a: NM['aug'].get(a, {}).get('name', a)
gn = lambda g: NM['glob'].get(g, {}).get('name', g)
sn = lambda s: NM['syn'].get(s, {}).get('name', s)
new_tags = [t for t in ('n0', 'n3', 'n6', 'n7') if t in out['tags']]
L.append('## 난이도별 요약\n')
L.append('| 난이도 | 런 | 클리어 (95% CI) | 도달 페이즈 | P1–2 종료 | 첫 역경 | P1 보스 | P6 보스 | 런당 전투 | 런당 시간 |')
L.append('|---|---|---|---|---|---|---|---|---|---|')
for t in [*new_tags, 'o6', 'o7']:
    if t not in out['tags']: continue
    T = out['tags'][t]; s = T['summary']
    L.append(f"| {T['name']} ({T['diff']}){' 직전' if T['ver'] == 'old' else ''} | {s['runs']} | {P(s['clear']['p'])} ({P(s['clear']['ci'][0])}–{P(s['clear']['ci'][1])}) | {s['reach']['mean']:.2f} ± {s['reach']['ci']:.2f} | {P(s['p12end']['p'])} | {P(s['firstAdv']['p'])} ({s['firstAdv']['n']}) | {P(s['bossByPh'].get(1, {}).get('p'))} | {P(s['bossByPh'].get(6, {}).get('p'))} ({s['bossByPh'].get(6, {}).get('n', 0)}) | {s['battlesPerRun']:.1f} | {s['msPerRun'] / 1000:.1f}s |")
for t in [*new_tags, 'o6', 'o7']:
    if t not in out['tags']: continue
    T = out['tags'][t]; s = T['summary']
    L.append(f"\n### {T['name']} (위험 {T['diff']}){' — 직전 커밋' if T['ver'] == 'old' else ''}\n")
    L.append('| 페이즈 | 일반 | 역경 | 도전 | 보스 (전체) | 보스 첫 시도 | 이 페이즈에서 끝난 런 |')
    L.append('|---|---|---|---|---|---|---|')
    for ph in range(1, 7):
        g = lambda nd: s['nodeByPh'].get(f'{ph}|{nd}')
        c = lambda x: '-' if not x else f"{P(x['p'])} ({x['n']})"
        L.append(f"| P{ph} | {c(g('battle'))} | {c(g('adversity'))} | {c(g('challenge'))} | {c(g('boss'))} | {c(s['bossFirstByPh'].get(ph))} | {s['deathPh'].get(ph, 0)} |")
    dn = collections.Counter(); [dn.update({k.split('|')[1]: v}) for k, v in s['death'].items()]
    L.append(f"\n- 끝난 노드: " + ' · '.join(f'{k} {v}' for k, v in dn.most_common()) + f" · 클리어 {s['clear']['k']} · 실행 실패 {s['err']} · 전투 상한 {s['capped']}")
    L.append(f"- 도달 페이즈 분포: " + ' · '.join(f'{k}: {v}' for k, v in s['reachDist'].items()))
# 시너지 · 기물 · 장비 · 증강: 표준 · 쉬움 · 모험은 클리어가 98% 이상이라 lift 는 고난 기준 (모험은 전투 lift 만 곁들임)
COLS = [t for t in ('n0', 'n3', 'n6', 'n7', 'o7') if t in out['tags']]
cname = lambda t: out['tags'][t]['name'] + (' 직전' if out['tags'][t]['ver'] == 'old' else '')
H, M6 = out['tags'].get('n7'), out['tags'].get('n6')
L.append('\n## 시너지 등장률 (런 최고 단계 ≥ t, 어느 난이도든 3% 이상)\n')
L.append('| 시너지 | 단계 (인원) | ' + ' | '.join(cname(t) for t in COLS) + ' |')
L.append('|---|---|' + '---|' * len(COLS))
for sid, info in NM['syn'].items():
    for tt in range(1, len(info['tiers']) + 1):
        rates = [((out['tags'][t]['syn'].get(sid, {}).get(tt) or {}).get('run') or {}).get('rate') for t in COLS]
        if max((x or 0) for x in rates) < 0.03: continue
        L.append(f"| {sn(sid)} | {tt} ({info['tiers'][tt - 1]}) | " + ' | '.join(P(x) for x in rates) + ' |')
if H:
    rows = [(sid, tt, v) for sid, tiers in H['syn'].items() for tt, v in tiers.items() if v['run'] and v['run']['n'] >= 25]
    L.append('\n## 시너지 단계별 lift — 고난 (등장 25런 이상, 런 lift 클리어 순)\n')
    L.append('| 시너지 | 단계 (인원) | 등장 런 | 클리어 | 런 lift 클리어 | 런 lift 도달 | 전투 | 고난 전투 lift | 모험 전투 lift |')
    L.append('|---|---|---|---|---|---|---|---|---|')
    for sid, tt, v in sorted(rows, key=lambda x: -(x[2]['run']['dClear'] or 0)):
        r, b = v['run'], v['battle']
        m = ((M6 or {}).get('syn', {}).get(sid, {}).get(tt) or {}).get('battle') if M6 else None
        L.append(f"| {sn(sid)} | {tt} ({v['need']}) | {P(r['rate'])} ({r['n']}) | {P(r['clear'])} | {PP(r['dClear'], r['dClearCi'])} | {F(r['dReach'], r['dReachCi'])} | {b['battles'] if b else 0} | {PP(b['lift'], b['ci']) if b else '-'} | {PP(m['lift'], m['ci']) if m else '-'} |")
L.append('\n## 전도체 단계별 (모든 난이도)\n')
L.append('| 난이도 | 단계 (인원) | 등장 런 | 클리어 | 런 lift 클리어 | 런 lift 도달 | 전투 | 전투 승률 | 전투 lift |')
L.append('|---|---|---|---|---|---|---|---|---|')
for t in [*new_tags, 'o6', 'o7']:
    if t not in out['tags']: continue
    T = out['tags'][t]
    for tt, v in T['syn'].get('COND', {}).items():
        r, b = v['run'], v['battle']
        L.append(f"| {cname(t)} | {tt} ({v['need']}) | {P(r['rate']) if r else '-'} ({r['n'] if r else 0}) | {P(r['clear']) if r else '-'} | {PP(r['dClear'], r['dClearCi']) if r else '-'} | {F(r['dReach'], r['dReachCi']) if r else '-'} | {b['battles'] if b else 0} | {P(b['win']) if b else '-'} | {PP(b['lift'], b['ci']) if b else '-'} |")
def topbot(d, n=10, minb=300):
    rows = [(k, v) for k, v in d.items() if v.get('battle') and v['battle']['battles'] >= minb]
    rows.sort(key=lambda x: -x[1]['battle']['lift'])
    return rows[:n], rows[-n:][::-1]
def adopt(kind, k): return ' | '.join(P(((out['tags'][t][kind].get(k) or {}).get('run') or {}).get('rate')) for t in COLS)
if H:
    L.append('\n## 기물 — 고난 전투 lift 상위 · 하위 10 (고난 출전 300전 이상)\n')
    L.append('| | 기물 | ' + ' | '.join(f'출전 런 {cname(t)}' for t in COLS) + ' | 고난 전투 | 고난 전투 lift | 고난 런 lift 클리어 | 고난 런 lift 도달 | 모험 전투 lift |')
    L.append('|---|---|' + '---|' * (len(COLS) + 5))
    top, bot = topbot(H['units'])
    for lab, rows in (('상위', top), ('하위', bot)):
        for i, (k, v) in enumerate(rows):
            r, b = v['run'], v['battle']; m = ((M6 or {}).get('units', {}).get(k) or {}).get('battle')
            L.append(f"| {lab} {i + 1} | {un(k)} | {adopt('units', k)} | {b['battles']} | {PP(b['lift'], b['ci'])} | {PP(r['dClear'], r['dClearCi']) if r else '-'} | {F(r['dReach'], r['dReachCi']) if r else '-'} | {PP(m['lift'], m['ci']) if m else '-'} |")
    L.append('\n## 기물 — 고난 출전 런 비율 상위 10\n')
    L.append('| | 기물 | ' + ' | '.join(f'출전 런 {cname(t)}' for t in COLS) + ' | 고난 시작 | 고난 전투 lift | 고난 런 lift 클리어 |')
    L.append('|---|---|' + '---|' * (len(COLS) + 3))
    rows = sorted([(k, v) for k, v in H['units'].items() if v['run']], key=lambda x: -x[1]['run']['rate'])[:10]
    for i, (k, v) in enumerate(rows):
        r, b = v['run'], v['battle']
        L.append(f"| {i + 1} | {un(k)} | {adopt('units', k)} | {P(v['start'])} | {PP(b['lift'], b['ci']) if b else '-'} | {PP(r['dClear'], r['dClearCi'])} |")
    for what, kind, nmf, minb in (('장비', 'items', itn, 300), ('기물 증강', 'augs', an, 200)):
        top, bot = topbot(H[kind], 10, minb)
        L.append(f"\n## {what} — 고난 전투 lift 상위 · 하위 10 (고난 전투 {minb} 이상)\n")
        L.append('| | 이름 | 채택 런 (고난) | 채택 런 (모험) | 고난 전투 | 고난 전투 lift | 고난 런 lift 클리어 | 모험 전투 lift |')
        L.append('|---|---|---|---|---|---|---|---|')
        for lab, rows in (('상위', top), ('하위', bot)):
            for i, (k, v) in enumerate(rows):
                r, b = v['run'], v['battle']; mm = (M6 or {}).get(kind, {}).get(k) or {}; m = mm.get('battle')
                L.append(f"| {lab} {i + 1} | {nmf(k)} | {P(r['rate']) if r else '-'} | {P((mm.get('run') or {}).get('rate'))} | {b['battles']} | {PP(b['lift'], b['ci'])} | {PP(r['dClear'], r['dClearCi']) if r else '-'} | {PP(m['lift'], m['ci']) if m else '-'} |")
    for what, kind, nmf in (('전역 증강', 'globs', gn), ('절망 증강', 'desps', lambda d: NM['desp'].get(d, {}).get('name', d))):
        rows = sorted([(g, v) for g, v in H[kind].items() if v and v['n'] >= 40], key=lambda x: -x[1]['dClear'])
        k = min(8 if kind == 'globs' else 5, len(rows) // 2)  # 상위 · 하위가 겹치지 않게
        L.append(f"\n## {what} — 고난 (런 40개 이상, 런 lift 클리어 순: 상위 · 하위 {k})\n")
        L.append('| | 이름 | 채택 런 | 클리어 | 런 lift 클리어 | 런 lift 도달 |')
        L.append('|---|---|---|---|---|---|')
        for lab, rr in (('상위', rows[:k]), ('하위', rows[len(rows) - k:][::-1])):
            for i, (g, v) in enumerate(rr):
                L.append(f"| {lab} {i + 1} | {nmf(g)} | {P(v['rate'])} | {P(v['clear'])} | {PP(v['dClear'], v['dClearCi'])} | {F(v['dReach'], v['dReachCi'])} |")
# 적 장비
L.append('\n## 적 장비 (전투 직전 적 1명당)\n')
L.append('| 난이도 | 노드 · 등급 | 적 수 | 장비 / 적 | 0개 | 1개 | 2개 | 3개 | 재료 | 고급 | 희귀 | 전설 | 개조부품 / 적 | 징수 |')
L.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for t in ('n7', 'o7', 'n6', 'o6', 'n3', 'n0'):
    if t not in out['tags']: continue
    T = out['tags'][t]
    for k in ('adversity|minion', 'adversity|elite', 'boss|boss', 'boss|minion', 'boss|elite', 'challenge|minion', 'battle|minion', 'battle|elite'):
        v = T['foe'].get(k)
        if not v: continue
        L.append(f"| {T['name']}{' 직전' if T['ver'] == 'old' else ''} | {k} | {v['enemies']} | {v['perFoe']:.2f} | {P(v['k0'])} | {P(v['k1'])} | {P(v['k2'])} | {P(v['k3'])} | {P(v['C'])} | {P(v['G'])} | {P(v['A'])} | {P(v['L'])} | {v['modPerFoe']:.2f} | {P(v['strip'])} |")
L.append('\n## 짝 비교 (이번 − 직전, 같은 시드)\n')
L.append('| 난이도 | 시드 | 클리어 차 | 성공→실패 · 실패→성공 | 도달 페이즈 차 | 첫 역경 승률 차 | P1–2 종료 차 |')
L.append('|---|---|---|---|---|---|---|')
for d, v in out['paired'].items():
    L.append(f"| {'고난' if d == '7' else '모험'} | {v['seeds']} | {PP(v['dClear'][0], v['dClear'][1])} | {v['sf']} · {v['fs']} | {F(v['dReach'][0], v['dReach'][1])} | {PP(v['dFirstAdv'][0], v['dFirstAdv'][1])} ({v['nFirstAdv']}) | {PP(v['dP12'][0], v['dP12'][1])} |")
for d, v in out['paired'].items():
    L.append(f"\n{'고난' if d == '7' else '모험'} 보스 승률 (페이즈별, 반복 시도 포함)\n")
    L.append('| 페이즈 | 이번 | 직전 | 차 |')
    L.append('|---|---|---|---|')
    for ph, b in v['boss'].items():
        L.append(f"| P{ph} | {P(b['new'])} ({b['nNew']}) | {P(b['old'])} ({b['nOld']}) | {PP(b['d'], b['ci'])} |")
open(md_path, 'w').write('\n'.join(L) + '\n')
