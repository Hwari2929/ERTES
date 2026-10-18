# 역경 배수 연구 집계: tests/balance.ts advstudy · advpol 결과 → 마크다운 표 (docs/BALANCE_ADVERSITY.md 재료)
# 실행: python3 tests/balance_adversity.py <계측 · 정책 결과 폴더> <일반 스윕 폴더> [all|head|study|pol|field] > tables.md
# 파일 이름: study_a{배수}_d7_s*.json (advstudy) · pol_{역경-도전}_a{배수}_d{등급}_s*.json (advpol=) · 일반 스윕 a{배수}_d{등급}_s*.json
import json, glob, math, sys, collections, statistics as st

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
PLAIN = sys.argv[2] if len(sys.argv) > 2 else OUT
ADVS = ['1.15', '1.2', '1.25', '1.3']
MK = ['1', 'n', '1.15', '1.2', '1.25', '1.3']
MKN = {'1': '1.0', 'n': '일반 배수', '1.15': '1.15', '1.2': '1.2', '1.25': '1.25', '1.3': '1.3'}

def wilson(k, n):
    if n == 0: return (0, 0)
    z = 1.96; p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))
def pct(k, n, ci=True):
    if n == 0: return '–'
    lo, hi = wilson(k, n)
    return f'{100*k/n:.1f}% ({100*lo:.0f}–{100*hi:.0f})' if ci else f'{100*k/n:.1f}%'
def pc(x): return f'{100*x:.1f}%'
def mean_ci(xs):
    if not xs: return '–'
    m = sum(xs) / len(xs)
    if len(xs) < 2: return f'{m:.2f}'
    se = st.stdev(xs) / math.sqrt(len(xs))
    return f'{m:.2f} ± {1.96*se:.2f}'
def med(xs):
    return f'{st.median(xs):.1f}' if xs else '–'
def row(*c): print('| ' + ' | '.join(str(x) for x in c) + ' |')
def head(*c): row(*c); print('|' + '---|' * len(c))

def load(pattern):
    runs = []; agg = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    for f in sorted(glob.glob(pattern)):
        try: j = json.load(open(f))
        except Exception: continue
        runs += j['runs']
        for cat, m in j['agg'].items():
            if cat not in ('node', 'death'): continue
            for k, v in m.items():
                for kk, vv in v.items(): agg[cat][k][kk] += vv
    runs.sort(key=lambda r: r['seed'])
    return runs, agg

# ───────── 1. 전체 결과 (일반 스윕: 예전 봇 정책)
def headline():
    print('\n## H. 전체 클리어율 · 도달 페이즈 (일반 스윕, 예전 봇)\n')
    for d, name in (('7', '고난'), ('6', '모험'), ('3', '쉬움')):
        base = None
        print(f'\n### {name} (위험 {d})\n')
        head('역경 배수', '런', '클리어 (95% CI)', '평균 도달 페이즈', 'P2 도달', 'P3 도달', 'P4 도달', 'P5 도달', 'P6 도달', 'P1–2 사망', '1.3 대비 도달 페이즈 (짝)')
        data = {a: load(f'{PLAIN}/a{a}_d{d}_s*.json')[0] for a in ADVS}
        ref = {r['seed']: r for r in data['1.3']}
        for a in ADVS:
            rs = data[a]; n = len(rs)
            if not n: continue
            ph = [r['phase'] for r in rs]
            reach = [sum(1 for x in ph if x >= k) for k in range(2, 7)]
            early = sum(1 for r in rs if not r['cleared'] and r['phase'] <= 2)
            diffs = [r['phase'] - ref[r['seed']]['phase'] for r in rs if r['seed'] in ref]
            up = sum(1 for x in diffs if x > 0); dn = sum(1 for x in diffs if x < 0)
            row(a, n, pct(sum(r['cleared'] for r in rs), n), mean_ci(ph), *[pc(x / n) for x in reach], pc(early / n),
                '기준' if a == '1.3' else f'{mean_ci(diffs)} (높음 {up} · 낮음 {dn})')
    print()

def node_wr():
    print('\n### 노드별 승률 (일반 스윕)\n')
    for d, name in (('7', '고난'), ('6', '모험'), ('3', '쉬움')):
        print(f'\n{name}\n')
        head('역경 배수', 'P1 일반', 'P1 역경', 'P2 일반', 'P2 역경', 'P2 도전', 'P3 일반', 'P3 역경', 'P4 역경', '역경에서 런 종료', '일반전에서 런 종료', '보스에서 런 종료')
        for a in ADVS:
            rs, agg = load(f'{PLAIN}/a{a}_d{d}_s*.json')
            if not rs: continue
            nd = agg['node']
            def w(ph, t):
                v = nd.get(f'{ph}|{t}')
                return pct(v['wins'], v['n'], False) + f' ({int(v["n"])})' if v and v['n'] else '–'
            de = collections.Counter()
            for k, v in agg['death'].items(): de[k.split('|')[1]] += v['n']
            row(a, w(1, 'battle'), w(1, 'adversity'), w(2, 'battle'), w(2, 'adversity'), w(2, 'challenge'), w(3, 'battle'), w(3, 'adversity'), w(4, 'adversity'),
                int(de['adversity'] + de['challenge']), int(de['battle']), int(de['boss']))

# ───────── 2. 계측 (advstudy, 고난)
S = {a: load(f'{OUT}/study_a{a}_d7_s*.json')[0] for a in ADVS}

def advrecs(a, typ='adversity'):
    for r in S[a]:
        for x in r.get('adv', []):
            if x['type'] == typ: yield r, x

def check_same():
    # 계측이 결과를 바꾸지 않는지: 일반 스윕과 같은 시드의 도달 페이즈 · 클리어 비교
    print('\n### 계측 동일성 확인\n')
    head('역경 배수', '계측 런', '일반 스윕과 결과(페이즈 · 클리어 · 전투 수 · 체력) 일치')
    for a in ADVS:
        pl = {r['seed']: r for r in load(f'{PLAIN}/a{a}_d7_s*.json')[0]}
        k = lambda r: (r['phase'], r['cleared'], r['battles'], r['hp'])
        same = sum(1 for r in S[a] if r['seed'] in pl and k(r) == k(pl[r['seed']]))
        row(a, len(S[a]), f'{same} / {sum(1 for r in S[a] if r["seed"] in pl)}')

def early():
    print('\n## B. 고난 초반: 역경 순서별 실제 승률 (각 배수의 실제 런)\n')
    head('역경 배수', '1번째 (P1 4칸)', '2번째 (P1 9칸)', '3번째 (P2 4칸)', '4번째 (P2 9칸)', '5번째 (P3 4칸)', '6번째 이후', 'P2 도전')
    for a in ADVS:
        by = collections.defaultdict(lambda: [0, 0])
        for r, x in advrecs(a):
            o = min(x['ord'], 6); by[o][0] += 1; by[o][1] += x['real']['w']
        ch = [0, 0]
        for r, x in advrecs(a, 'challenge'): ch[0] += 1; ch[1] += x['real']['w']
        row(a, *[pct(by[o][1], by[o][0]) + f' n={by[o][0]}' for o in range(1, 7)], pct(ch[1], ch[0]) + f' n={ch[0]}')
    print('\n역경 순서별 진입 상태 (배수 1.3 런)\n')
    head('순서', '전투 수', '페이즈 (최빈)', '진입 체력 평균', '출전 기물 평균', '착용 장비 평균', '승률')
    by = collections.defaultdict(list)
    for r, x in advrecs('1.3'): by[min(x['ord'], 6)].append(x)
    for o in range(1, 7):
        xs = by[o]
        if not xs: continue
        row(f'{o}' + ('+' if o == 6 else ''), len(xs), collections.Counter(x['ph'] for x in xs).most_common(1)[0][0], f'{st.mean(x["hp0"] for x in xs):.0f} / {xs[0]["maxHp"]}',
            f'{st.mean(x["nDep"] for x in xs):.1f}', f'{st.mean(x["gear"] for x in xs):.1f}', pct(sum(x['real']['w'] for x in xs), len(xs), False))

def sweep():
    print('\n## B2. 같은 상태 · 같은 조우를 배수만 바꿔 다시 싸움 (배수 1.3 런의 역경 진입 상태)\n')
    print('일반 배수 = 같은 칸 일반 전투의 배수 (1 + 0.04 × 칸: 4칸 1.16 · 9칸 1.36). 조우 구성(정예 확정 · 위험 5 적 +1 · 역경 장비)은 그대로.\n')
    head('순서', '전투 수', *[MKN[m] for m in MK], '실제 승률 1.3 (시드 5개 평균)')
    for o in (1, 2, 3, 4, 5):
        xs = [x for r, x in advrecs('1.3') if (x['ord'] == o if o < 5 else x['ord'] >= 5)]
        if not xs: continue
        n = len(xs)
        cells = [pct(sum(x['mult_w'][m] for x in xs), n) for m in MK]
        seedp = st.mean((x['real']['w'] + sum(x['seeds'])) / 5 for x in xs)
        row(f'{o}' + ('+' if o == 5 else ''), n, *cells, pc(seedp))
    # 1번째 역경은 4가지 배수 런에서 상태가 같다 → 확인
    print('\n같은 1번째 역경 상태(400개)에서 배수별 승률 — 4가지 배수 런 모두 같은 상태라 1.3 런으로 셈.')

def norm_vs_adv():
    print('\n## C. 같은 진입 상태에서 일반전 vs 역경\n')
    print('### C1. 역경 칸 상태 (같은 칸 일반 전투를 따로 생성해 싸움, 배수 1.3 런 · 1~4번째 역경)\n')
    head('역경 배수 (같은 조우)', '전투 수', '일반 승 · 역경 승', '일반 승 · 역경 패', '일반 패 · 역경 승', '일반 패 · 역경 패', '일반전 승률', '일반전을 이긴 상태의 역경 승률')
    xs = [x for r, x in advrecs('1.3') if x['ord'] <= 4]
    for m in ['1', 'n', '1.15', '1.2', '1.25', '1.3']:
        c = collections.Counter((x['norm']['w'], x['mult_w'][m]) for x in xs); n = len(xs)
        nw = c[(1, 1)] + c[(1, 0)]
        row(MKN[m], n, c[(1, 1)], c[(1, 0)], c[(0, 1)], c[(0, 0)], pct(nw, n, False), pct(c[(1, 1)], nw))
    # 여유(남은 아군 체력) 구간별
    bins = [(0, 0.001, '일반전 패배'), (0.001, 0.4, '승 · 남은 체력 < 40%'), (0.4, 0.6, '40–60%'), (0.6, 0.8, '60–80%'), (0.8, 1.01, '≥ 80%')]
    def binof(fr):
        v = fr['aHp'] if fr['w'] else 0
        for lo, hi, nm in bins:
            if fr['w'] == 0 and lo == 0: return nm
            if fr['w'] and lo <= v < hi and lo > 0: return nm
        return bins[-1][2]
    print('\n### C2. 일반전 여유(일반전 승리 시 남은 아군 체력 비율)별 역경 승률\n')
    print('자료: (가) 역경 칸 상태에서 생성한 일반전 + 실제 역경 조우의 배수 스윕, (나) 1~3페이즈 일반 전투 칸 상태 + 그 상태로 생성한 가상 역경 조우의 배수 스윕. 둘 다 배수 1.3 런.\n')
    head('자료', '일반전 여유', '상태 수', *[MKN[m] for m in MK])
    for src in ('가', '나'):
        grp = collections.defaultdict(list)
        if src == '가':
            for r, x in advrecs('1.3'):
                if x['ord'] <= 4: grp[binof(x['norm'])].append(x['mult_w'])
        else:
            for r in S['1.3']:
                for x in r.get('nb', []):
                    if 'adv' in x: grp[binof(x['real'])].append(x['adv'])
        for lo, hi, nm in bins:
            g = grp.get(nm, [])
            if not g: continue
            row(src, nm, len(g), *[pc(sum(w[m] for w in g) / len(g)) for m in MK])
    # 일반전 승리 시간 구간
    print('\n### C3. 일반전 승리 시간별 역경 승률 (자료 나, 일반전을 이긴 상태만)\n')
    head('일반전 승리 시간', '상태 수', *[MKN[m] for m in MK])
    tb = [(0, 15, '< 15초'), (15, 25, '15–25초'), (25, 40, '25–40초'), (40, 999, '≥ 40초')]
    g = collections.defaultdict(list)
    for r in S['1.3']:
        for x in r.get('nb', []):
            if 'adv' in x and x['real']['w']:
                for lo, hi, nm in tb:
                    if lo <= x['real']['t'] < hi: g[nm].append(x['adv'])
    for lo, hi, nm in tb:
        if g[nm]: row(nm, len(g[nm]), *[pc(sum(w[m] for w in g[nm]) / len(g[nm])) for m in MK])

def timeline():
    print('\n## D. 전투 시간선 · 패배 양상 (실제 역경, 고난)\n')
    head('역경 배수', '역경 전투', '승률', '승리 전투 시간 (중앙)', '패배: 첫 적 처치 (중앙, 초)', '패배: 첫 아군 사망 (중앙, 초)', '패배: 적 하나도 못 쓰러뜨림', '패배: 아군이 먼저 쓰러짐', '패배: 적을 먼저 쓰러뜨린 뒤 역전', '패배: 시간 초과')
    for a in ADVS:
        xs = [x['real'] for r, x in advrecs(a)]
        L = [f for f in xs if not f['w']]; W = [f for f in xs if f['w']]
        if not xs: continue
        nfe = sum(1 for f in L if f['fe'] < 0 and not f['to'])
        first_a = sum(1 for f in L if f['fe'] >= 0 and 0 <= f['fa'] < f['fe'] and not f['to'])
        later = sum(1 for f in L if f['fe'] >= 0 and not (0 <= f['fa'] < f['fe']) and not f['to'])
        to = sum(1 for f in L if f['to'])
        nl = len(L)
        row(a, len(xs), pc(len(W) / len(xs)), med([f['t'] for f in W]), med([f['fe'] for f in L if f['fe'] >= 0]), med([f['fa'] for f in L if f['fa'] >= 0]),
            pc(nfe / nl), pc(first_a / nl), pc(later / nl), pc(to / nl))
    print('\n같은 1~3페이즈 상태의 일반 전투 (배수 1.3 런, 실제 일반 전투)\n')
    head('구분', '전투', '승률', '승리 전투 시간 (중앙)', '패배: 첫 적 처치 (중앙)', '패배: 첫 아군 사망 (중앙)', '패배: 적 하나도 못 쓰러뜨림', '패배: 시간 초과')
    xs = [x['real'] for r in S['1.3'] for x in r.get('nb', []) if x['ph'] <= 3]
    L = [f for f in xs if not f['w']]; W = [f for f in xs if f['w']]
    row('일반 전투 P1–3', len(xs), pc(len(W) / len(xs)), med([f['t'] for f in W]), med([f['fe'] for f in L if f['fe'] >= 0]), med([f['fa'] for f in L if f['fa'] >= 0]),
        pc(sum(1 for f in L if f['fe'] < 0 and not f['to']) / max(1, len(L))), pc(sum(f['to'] for f in L) / max(1, len(L))))

    print('\n### D2. 패배 시 남은 적 · 체력 (실제 역경 패배)\n')
    head('역경 배수', '패배', '남은 적 수 (중앙 / 평균)', '남은 적 비율 평균', '적 남은 체력 < 15% (아슬아슬)', '15–40%', '40–70%', '≥ 70% (전혀 안 됨)', '적 체력 평균')
    for a in ADVS:
        L = [x['real'] for r, x in advrecs(a) if not x['real']['w']]
        if not L: continue
        n = len(L); e = [f['eHp'] for f in L]
        row(a, n, f'{st.median([f["aE"] for f in L]):.0f} / {st.mean([f["aE"] for f in L]):.1f}', pc(st.mean(f['aE'] / max(1, f['nE']) for f in L)),
            pc(sum(1 for v in e if v < 0.15) / n), pc(sum(1 for v in e if 0.15 <= v < 0.4) / n), pc(sum(1 for v in e if 0.4 <= v < 0.7) / n), pc(sum(1 for v in e if v >= 0.7) / n), pc(st.mean(e)))
    print('\n순서별 (배수 1.3 런, 역경 패배)\n')
    head('순서', '패배', '적 남은 체력 평균', '< 15%', '≥ 70%', '적 하나도 못 쓰러뜨림')
    for o in (1, 2, 3, 4):
        L = [x['real'] for r, x in advrecs('1.3') if x['ord'] == o and not x['real']['w']]
        if not L: continue
        n = len(L)
        row(o, n, pc(st.mean(f['eHp'] for f in L)), pc(sum(1 for f in L if f['eHp'] < 0.15) / n), pc(sum(1 for f in L if f['eHp'] >= 0.7) / n), pc(sum(1 for f in L if f['fe'] < 0) / n))

def prep():
    print('\n## F. 준비의 영향 (같은 상태 · 같은 조우 재전투, 실제 역경)\n')
    print('봇 배치 = 근접 앞줄 · 원거리 뒷줄, 가운데부터. 무작위 배치 5회 평균. 운 기준선 = 같은 배치로 전투 시드만 4번 바꿈.\n')
    head('역경 배수', '역경 전투', '봇 배치 (실제)', '전투 시드만 바꿈 (평균)', '무작위 배치 (평균)', '앞뒤 뒤집기', '장비 뺌', '실제 패배 중 시드 4회 안에 1번이라도 승', '실제 패배 중 무작위 배치 4회 안에 1번이라도 승', '장비 착용 평균')
    for a in ADVS:
        xs = [x for r, x in advrecs(a)]
        if not xs: continue
        n = len(xs)
        L = [x for x in xs if not x['real']['w']]
        row(a, n, pc(sum(x['real']['w'] for x in xs) / n), pc(st.mean(sum(x['seeds']) / 4 for x in xs)), pc(st.mean(sum(x['rand']) / 5 for x in xs)),
            pc(sum(x['flip'] for x in xs) / n), pc(sum(x['nogear'] for x in xs) / n),
            pc(sum(1 for x in L if any(x['seeds'])) / max(1, len(L))), pc(sum(1 for x in L if any(x['rand'][:4])) / max(1, len(L))), f'{st.mean(x["gear"] for x in xs):.2f}')
    print('\n순서별 (배수 1.3 런)\n')
    head('순서', '전투', '봇 배치', '시드만 바꿈', '무작위 배치', '앞뒤 뒤집기', '장비 뺌', '장비 착용 평균', '장비가 있던 전투에서: 있음 → 뺌')
    for o in (1, 2, 3, 4):
        xs = [x for r, x in advrecs('1.3') if x['ord'] == o]
        if not xs: continue
        n = len(xs); g = [x for x in xs if x['gear'] > 0]
        row(o, n, pc(sum(x['real']['w'] for x in xs) / n), pc(st.mean(sum(x['seeds']) / 4 for x in xs)), pc(st.mean(sum(x['rand']) / 5 for x in xs)), pc(sum(x['flip'] for x in xs) / n), pc(sum(x['nogear'] for x in xs) / n),
            f'{st.mean(x["gear"] for x in xs):.2f}', f'{pc(sum(x["real"]["w"] for x in g) / max(1, len(g)))} → {pc(sum(x["nogear"] for x in g) / max(1, len(g)))} (n={len(g)})')
    # 소모품
    tot = sum(1 for a in ADVS for _ in advrecs(a))
    cons = sum(1 for a in ADVS for r, x in advrecs(a) if x['cons'] > 0)
    uns = [x for a in ADVS for r, x in advrecs(a) if 'unseized' in x]
    print(f'\n소모품: 역경 {tot}전 중 직전 정비에서 소모품을 쓴 전투 {cons}전 ({pc(cons / max(1, tot))}). 강제 징수기(적 장비 떼기)를 쓴 역경 {len(uns)}전'
          + (f' — 쓴 상태 승률 {pc(sum(x["real"]["w"] for x in uns) / len(uns))}, 쓰기 전 조우로 다시 싸우면 {pc(sum(x["unseized"] for x in uns) / len(uns))}' if uns else '') + '.')

def comps():
    print('\n## G. 조합 · 시작 기물 · 전장 (고난, 1~2번째 역경 = 1페이즈)\n')
    print('배수 1.3 런의 1~2번째 역경 상태에서 같은 조우를 배수만 바꿔 다시 싸운 결과 (1번째 상태는 4배수 런이 모두 같다). 표본 15 이상만. ▲▼ = 그 묶음의 95% 신뢰구간이 전체 평균을 벗어남.\n')
    xs = [(r, x) for r, x in advrecs('1.3') if x['ord'] <= 2]
    allw = {m: sum(x['mult_w'][m] for r, x in xs) / len(xs) for m in MK}
    def table(title, keyf, minn=15):
        print(f'\n### {title}\n')
        head(title, '전투', '1.15', '1.2', '1.25', '1.3', '런 평균 도달 페이즈 (1.3 런)')
        g = collections.defaultdict(list)
        for r, x in xs:
            for k in keyf(r, x): g[k].append((r, x))
        out = []
        for k, v in g.items():
            if len(v) < minn: continue
            out.append((sum(x['mult_w']['1.3'] for r, x in v) / len(v), k, v))
        out.sort(reverse=True)
        for p, k, v in out:
            n = len(v); cells = []
            for m in ('1.15', '1.2', '1.25', '1.3'):
                kk = sum(x['mult_w'][m] for r, x in v); lo, hi = wilson(kk, n)
                flag = ' ▲' if lo > allw[m] else ' ▼' if hi < allw[m] else ''
                cells.append(f'{100*kk/n:.0f}%{flag}')
            runs = {r['seed']: r for r, x in v}
            row(k, n, *cells, f'{st.mean(r["phase"] for r in runs.values()):.2f}')
        row('전체', len(xs), *[pc(allw[m]) for m in ('1.15', '1.2', '1.25', '1.3')], f'{st.mean(r["phase"] for r in S["1.3"]):.2f}')
    table('주력 시너지 (전투 시점 최고 단계)', lambda r, x: [x['syn'].split(':')[0]])
    table('시작 기물 (4명 중 하나라도)', lambda r, x: r['starters'])
    table('전장', lambda r, x: [r['field']])

def policies():
    print('\n## P. 진입 정책 비교 (시드 짝 맞춤)\n')
    POLS = [('must:state', '역경 필수 · 도전 상태 (현재 게임 + 예전 봇)'), ('must:always', '역경 필수 · 도전 항상'), ('must:never', '역경 필수 · 도전 안 함'), ('must:power', '역경 필수 · 도전은 전력 우세일 때'),
            ('avoid:never', '역경 회피 (가상) · 도전 안 함'), ('state:state', '역경 · 도전 상태 (가상)'), ('power:power', '역경 · 도전 전력 우세일 때 (가상)')]
    for d, name in (('7', '고난'), ('6', '모험')):
        print(f'\n### {name} (위험 {d})\n')
        head('정책', '역경 배수', '런', '클리어', '평균 도달 페이즈', 'P3 도달', 'P4 도달', 'P1–2 사망', '역경 전투 / 런', '역경 승률', '도전 시도 / 런', '도전 승률', '기준 대비 도달 페이즈 (짝)')
        for a in ADVS:
            ref = {r['seed']: r for r in load(f'{OUT}/pol_must-state_a{a}_d{d}_s*.json')[0]}
            for p, nm in POLS:
                rs, agg = load(f'{OUT}/pol_{p.replace(":", "-")}_a{a}_d{d}_s*.json')
                if not rs: continue
                n = len(rs); nd = agg['node']
                an = sum(v['n'] for k, v in nd.items() if k.endswith('|adversity')); aw = sum(v['wins'] for k, v in nd.items() if k.endswith('|adversity'))
                cn = sum(v['n'] for k, v in nd.items() if k.endswith('|challenge')); cw = sum(v['wins'] for k, v in nd.items() if k.endswith('|challenge'))
                ph = [r['phase'] for r in rs]
                diffs = [r['phase'] - ref[r['seed']]['phase'] for r in rs if r['seed'] in ref]
                row(nm, a, n, pct(sum(r['cleared'] for r in rs), n), mean_ci(ph), pc(sum(1 for x in ph if x >= 3) / n), pc(sum(1 for x in ph if x >= 4) / n),
                    pc(sum(1 for r in rs if not r['cleared'] and r['phase'] <= 2) / n), f'{an / n:.2f}', pct(aw, an, False) if an else '–', f'{cn / n:.2f}', pct(cw, cn, False) if cn else '–',
                    '기준' if p == 'must:state' else mean_ci(diffs))

def field_extra():
    print('\n### 전장별 1페이즈 일반전 · 역경 비교 (배수 1.3 런)\n')
    head('전장', 'P1 일반 전투', 'P1 일반 승률', 'P1 역경 상태 (1~2번째)', '역경 1.0', '역경 1.15', '역경 1.3', '일반 승률 − 역경 1.3 승률')
    g = collections.defaultdict(lambda: {'nb': [], 'adv': []})
    for r in S['1.3']:
        for x in r.get('nb', []):
            if x['ph'] == 1: g[r['field']]['nb'].append(x['real']['w'])
        for x in r.get('adv', []):
            if x['type'] == 'adversity' and x['ord'] <= 2: g[r['field']]['adv'].append(x['mult_w'])
    out = []
    for f, v in g.items():
        nw = sum(v['nb']) / max(1, len(v['nb'])); a = v['adv']
        out.append((nw - sum(w['1.3'] for w in a) / len(a), f, v))
    for d, f, v in sorted(out, reverse=True):
        a = v['adv']; n = len(a)
        row(f, len(v['nb']), pc(sum(v['nb']) / len(v['nb'])), n, pc(sum(w['1'] for w in a) / n), pc(sum(w['1.15'] for w in a) / n), pc(sum(w['1.3'] for w in a) / n), f'{100*d:.0f}%p')

if __name__ == '__main__':
    what = sys.argv[3] if len(sys.argv) > 3 else 'all'
    if what in ('all', 'head'): headline(); node_wr()
    if what in ('all', 'study'):
        check_same(); early(); sweep(); norm_vs_adv(); timeline(); prep(); comps()
    if what in ('all', 'study', 'field'): field_extra()
    if what in ('all', 'pol'): policies()
