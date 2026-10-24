# 철수 고난 경로 · 자산 · 상점 구매 · 재료 승률 집계 (docs/BALANCE_CHULSU_ROUTE.md): python3 tests/balance_chulsu_route.py <조각 폴더 (h7_*.json)> <names.json> [파일 접두사, 기본 h7_]
# 조각: node balance.cjs <시작 시드> 25 0 7 pool instr bot=chulsu detail (tests/balance.ts 번들, 시드 10001–10500) · 이름표: tests/chulsu2000_names.ts [장비 id 목록]
# 비교 (docs/BOT_YOUNGHEE.md): python3 tests/balance_chulsu_route.py compare <names.json> 철수=<폴더> 영희=<폴더> 영희_last=<폴더> [prefix=h7_]  — 첫 열이 짝 비교 기준
import json, glob, math, collections, sys, statistics as st
Z = 1.96
P = lambda x: f'{x*100:.1f}%'
reach = lambda r: 7 if r['cleared'] else min(r['phase'], 6)
NODEKO = {'battle': '일반 전투', 'adversity': '역경', 'shop': '상점', 'supply': '보급', 'recruit': '영입', 'boss': '보스', 'invest': '투자', 'pilgrim': '순례', 'news': '소식', 'event': '사건', 'challenge': '도전', 'rest': '휴식', 'synth': '합성', 'maint': '정비', '-': '(없음)'}
ko = lambda t: NODEKO.get(t, t)
def cat(i):
    if i.startswith('C_'): return '재료'
    if i.startswith('G_'): return '고급'
    if i.startswith('A_'): return '희귀'
    if i.startswith('L_'): return '전설'
    if i.startswith('K_'): return '소모품'
    if i.startswith('T_') or i.startswith('E_'): return '포탑'
    if i.startswith('O_'): return '개조부품'
    if i.startswith('M_'): return '문장'
    return '기타'
def load(src, prefix='h7_'):
    runs, agg = [], collections.defaultdict(dict)
    for p in sorted(glob.glob(f'{src}/{prefix}*.json')):
        d = json.load(open(p)); runs += d['runs']
        for t, rows in d['agg'].items():
            for k, v in rows.items():
                a = agg[t].setdefault(k, {})
                for f, x in v.items(): a[f] = a.get(f, 0) + x
    return [r for r in runs if 'err' not in r], agg
def mk_split(runs):
    def split(has):
        A = [r for r in runs if has(r)]; B = [r for r in runs if not has(r)]
        if len(A) < 5 or len(B) < 5: return None
        ka, kb = sum(r['cleared'] for r in A), sum(r['cleared'] for r in B)
        qa, qb = (ka + 1) / (len(A) + 2), (kb + 1) / (len(B) + 2)
        se = math.sqrt(qa * (1 - qa) / (len(A) + 2) + qb * (1 - qb) / (len(B) + 2))
        return len(A), ka / len(A), ka / len(A) - kb / len(B), Z * se
    return split
def mk_lift(agg):
    base = {k: v['wins'] / v['n'] for k, v in agg['node'].items() if v['n']}
    def lift_rows(pairs):  # pairs: seed → [(ph, type, won)]
        N = E = W = 0; per = []
        for bs in pairs.values():
            n = len(bs); e = sum(base.get(f'{ph}|{t}', 0) for ph, t, _ in bs); w = sum(1 for *_, x in bs if x)
            if n: per.append((n, e, w)); N += n; E += e; W += w
        if not N: return None
        l = (W - E) / N; k = len(per)
        var = sum(((w - e) - l * n) ** 2 for n, e, w in per) / (N * N) * (k / (k - 1) if k > 1 else 1)
        return N, W / N, l, Z * math.sqrt(var)
    return lift_rows
def buy_lift_rows(runs, agg, min_runs=20):
    """상점에서 산 아이템별: 산 뒤 전투 lift · 런 lift (산 런 min_runs 이상)"""
    lift_rows, split = mk_lift(agg), mk_split(runs)
    buys = [(r, b) for r in runs for b in r['ins'].get('buy', [])]
    rows = []
    for i in collections.Counter(b[1] for _, b in buys):
        first = {}
        for r, b in buys:
            if b[1] == i: first.setdefault(r['seed'], (r, b[0]))
        if len(first) < min_runs: continue
        pairs = {s: [(x['ph'], x['type'], x['won']) for x in r['trace'] if x['ph'] >= ph0] for s, (r, ph0) in first.items()}
        L = lift_rows(pairs); S = split(lambda r, i=i: any(b[1] == i for b in r['ins'].get('buy', [])))
        if L and S: rows.append((L[2], i, len(first), L, S))
    return sorted(rows, reverse=True)

def single(src, NM, prefix='h7_'):
    runs, agg = load(src, prefix)
    R = len(runs)
    def nm(i): return (NM['item'].get(i) or {}).get('name', i)
    split, lift_rows = mk_split(runs), mk_lift(agg)
    out = []
    pr = out.append
    clr = sum(r['cleared'] for r in runs)
    pr(f'# 철수 고난 경로 · 자산 · 상점 (런 {R}, 클리어 {P(clr/R)})\n')
    # 1. 갈림길
    pr('## 1. 갈림길 선택 (branch)\n')
    off, pick = collections.Counter(), collections.Counter(); byph = collections.defaultdict(collections.Counter)
    for r in runs:
        for ph, opts, c in r['ins'].get('br', []):
            for o in opts.split(','): off[o] += 1
            pick[c] += 1; byph[ph][c] += 1
    tot = sum(pick.values())
    pr(f'런당 갈림길 {tot/R:.2f}회\n')
    pr('| 선택지 | 제시 | 고름 | 제시 대비 선택률 | 전체 선택 중 |\n|---|---|---|---|---|')
    for o, n in off.most_common(): pr(f'| {ko(o)} | {n} | {pick[o]} | {P(pick[o]/n)} | {P(pick[o]/tot)} |')
    pr('\n페이즈별 선택 비율\n')
    opts_all = [o for o, _ in pick.most_common()]
    pr('| 페이즈 | ' + ' | '.join(ko(o) for o in opts_all) + ' | 갈림길 수 |\n|---|' + '---|' * (len(opts_all) + 1))
    for ph in sorted(byph):
        c = byph[ph]; s = sum(c.values()); pr(f'| P{ph} | ' + ' | '.join(P(c[o]/s) for o in opts_all) + f' | {s} |')
    # 2. 지도 진입
    pr('\n## 2. 지도 칸 진입 (전투 외 노드 포함)\n')
    rt = collections.defaultdict(collections.Counter); rtall = collections.Counter()
    for r in runs:
        for ph, opts, t in r['ins'].get('route', []): rt[ph][t] += 1; rtall[t] += 1
    for r in runs:
        for x in r['trace']: rt[x['ph']][x['type']] += 0  # 키만
    types = [t for t, _ in rtall.most_common()]
    pr('런당 비전투 노드 진입: ' + ' · '.join(f'{ko(t)} {n/R:.2f}' for t, n in rtall.most_common()) + '\n')
    pr('| 페이즈 | ' + ' | '.join(ko(t) for t in types) + ' |\n|---|' + '---|' * len(types))
    for ph in sorted(rt):
        pr(f'| P{ph} | ' + ' | '.join(f'{rt[ph][t]/R:.2f}' for t in types) + ' |')
    # 전투 노드 (trace)
    bt = collections.defaultdict(collections.Counter)
    for r in runs:
        for x in r['trace']: bt[x['ph']][x['type']] += 1
    pr('\n런당 전투 수 (페이즈별): ')
    pr('| 페이즈 | 일반 | 역경 | 도전 | 보스 |\n|---|---|---|---|---|')
    for ph in sorted(bt): pr(f'| P{ph} | ' + ' | '.join(f'{bt[ph][t]/R:.2f}' for t in ['battle', 'adversity', 'challenge', 'boss']) + ' |')
    # 3. 자산
    pr('\n## 3. 페이즈별 자산 (전투 직전 보유 크레딧)\n')
    pr('| 페이즈 | 런 | 평균 | 중앙 | 25% | 75% | 클리어 런 평균 | 실패 런 평균 |\n|---|---|---|---|---|---|---|---|')
    for ph in range(1, 7):
        xs = [(r['eco']['crAt'][str(ph)][0] / r['eco']['crAt'][str(ph)][1], r['cleared']) for r in runs if str(ph) in r['eco']['crAt'] and r['eco']['crAt'][str(ph)][1]]
        v = [x for x, _ in xs]; q = st.quantiles(v, n=4) if len(v) > 3 else [0, 0, 0]
        a = [x for x, c in xs if c]; b = [x for x, c in xs if not c]
        pr(f'| P{ph} | {len(v)} | {st.mean(v):.0f} | {st.median(v):.0f} | {q[0]:.0f} | {q[2]:.0f} | {st.mean(a) if a else 0:.0f} | {st.mean(b) if b else 0:.0f} |')
    sp = collections.Counter()
    for r in runs:
        for k, v in (r['eco'].get('sp') or {}).items(): sp[k] += v
    pr('\n런당 지출 (종류별 평균 크레딧): ' + ' · '.join(f'{k} {v/R:.0f}' for k, v in sp.most_common()))
    pr(f"\n런당 전투 정산 수입 {st.mean(r['eco']['inc'] for r in runs):.0f} · 이자 {st.mean(r['eco']['i'] for r in runs):.0f} · 이자 상한에 걸린 전투 {st.mean(r['eco']['atCap'] for r in runs):.1f} · 끝 크레딧 {st.mean(r['eco']['end'] for r in runs):.0f}")
    # 4. 상점 구매
    pr('\n## 4. 상점 구매\n')
    buys = [(r, b) for r in runs for b in r['ins'].get('buy', [])]
    shopv = sum(1 for r in runs for x in r['ins'].get('route', []) if x[2] == 'shop')
    pr(f'상점 방문 {shopv/R:.2f}회/런 · 구매 {len(buys)/R:.2f}개/런 · 구매액 {sum(b[2] for _, b in buys)/R:.0f}/런 · 방문당 구매 {len(buys)/max(1,shopv):.2f}개\n')
    def cat(i):
        if i.startswith('C_'): return '재료'
        if i.startswith('G_'): return '고급'
        if i.startswith('A_'): return '희귀'
        if i.startswith('L_'): return '전설'
        if i.startswith('K_'): return '소모품'
        if i.startswith('T_') or i.startswith('E_'): return '포탑'
        if i.startswith('O_'): return '개조부품'
        return '기타'
    cc = collections.Counter(cat(b[1]) for _, b in buys); cs = collections.Counter()
    for _, b in buys: cs[cat(b[1])] += b[2]
    pr('| 종류 | 구매 수 | 비율 | 런당 | 평균 가격 |\n|---|---|---|---|---|')
    for k, n in cc.most_common(): pr(f'| {k} | {n} | {P(n/len(buys))} | {n/R:.2f} | {cs[k]/n:.0f} |')
    ic = collections.Counter(b[1] for _, b in buys)
    ip = collections.defaultdict(list); iph = collections.defaultdict(list)
    for _, b in buys: ip[b[1]].append(b[2]); iph[b[1]].append(b[0])
    pr('\n구매 상위 25\n\n| 아이템 | 종류 | 구매 수 | 산 런 | 평균 가격 | 평균 페이즈 |\n|---|---|---|---|---|---|')
    for i, n in ic.most_common(25):
        k = len({r['seed'] for r, b in buys if b[1] == i})
        pr(f'| {nm(i)} | {cat(i)} | {n} | {P(k/R)} | {st.mean(ip[i]):.0f} | {st.mean(iph[i]):.1f} |')
    # 5. 구매 아이템 승률
    pr('\n## 5. 상점에서 산 아이템별 성과 (산 런 20개 이상)\n')
    pr('- 전투 lift = 산 뒤(같은 페이즈부터) 그 런의 전투 승률 − 같은 (페이즈, 노드) 평균. ± 런 군집 95%.')
    pr('- 런 lift = 산 런과 안 산 런의 클리어 차 (교란 있음).\n')
    pr('| 아이템 | 종류 | 산 런 | 산 뒤 전투 | 산 뒤 승률 | 전투 lift | 런 클리어 | 런 lift |\n|---|---|---|---|---|---|---|---|')
    rows = []
    for i in ic:
        first = {}
        for r, b in buys:
            if b[1] == i: first.setdefault(r['seed'], (r, b[0]))
        if len(first) < 20: continue
        pairs = {s: [(x['ph'], x['type'], x['won']) for x in r['trace'] if x['ph'] >= ph0] for s, (r, ph0) in first.items()}
        L = lift_rows(pairs); S = split(lambda r, i=i: any(b[1] == i for b in r['ins'].get('buy', [])))
        if L and S: rows.append((L[2], i, len(first), L, S))
    for l, i, k, L, S in sorted(rows, reverse=True):
        pr(f'| {nm(i)} | {cat(i)} | {k} | {L[0]} | {P(L[1])} | {L[2]*100:+.1f} ± {L[3]*100:.1f}%p | {P(S[1])} | {S[2]*100:+.1f} ± {S[3]*100:.1f}%p |')
    # 6. 재료 · 고급 장비 승률 (장착 전투)
    pr('\n## 6. 장비 재료 · 고급 장비별 승률 (그 장비를 단 기물이 출전한 전투)\n')
    pr('| 장비 | 종류 | 장착 전투 | 런 | 승률 | 전투 lift | 장착 런 클리어 | 런 lift |\n|---|---|---|---|---|---|---|---|')
    per = collections.defaultdict(dict)
    for r in runs:
        for key, (n, w) in (r.get('det') or {}).items():
            if not key.startswith('i:'): continue
            body, pn = key[2:].rsplit('|', 1); ph, nd = pn.split(':')
            if not (body.startswith('C_') or body.startswith('G_')): continue
            lst = per[body].setdefault(r['seed'], [])
            lst += [(int(ph), nd, True)] * w + [(int(ph), nd, False)] * (n - w)
    mrows = []
    for body, pairs in per.items():
        L = lift_rows(pairs); S = split(lambda r, b=body: any(k.startswith('i:' + b + '|') for k in (r.get('det') or {})))
        if L: mrows.append((body[0], -L[2], body, len(pairs), L, S))
    for _, _, body, k, L, S in sorted(mrows):
        pr(f'| {nm(body)} | {cat(body)} | {L[0]} | {k} | {P(L[1])} | {L[2]*100:+.1f} ± {L[3]*100:.1f}%p | ' + (f'{P(S[1])} | {S[2]*100:+.1f} ± {S[3]*100:.1f}%p |' if S else '- | - |'))
    print('\n'.join(out))

# ───────────────────────── 비교 (철수 · 영희 · 영희_last 같은 시드): docs/BOT_YOUNGHEE.md
def compare(NM, cols, prefix='h7_'):
    def nm(i): return (NM['item'].get(i) or {}).get('name', i)
    D = [(name, *load(src, prefix)) for name, src in cols]
    out = []; pr = out.append
    names = [n for n, *_ in D]
    hdr = lambda first: pr(f'| {first} | ' + ' | '.join(names) + ' |\n|---|' + '---|' * len(names))
    row = lambda k, xs: pr(f'| {k} | ' + ' | '.join(xs) + ' |')
    pr('## 1. 결과\n'); hdr('지표')
    row('런', [str(len(r)) for _, r, _ in D])
    def ci(r):
        n = len(r); p = sum(x['cleared'] for x in r) / n; return f'{P(p)} ± {Z * math.sqrt(p * (1 - p) / n) * 100:.1f}%p'
    row('클리어 (95%)', [ci(r) for _, r, _ in D])
    row('도달 페이즈 평균 (클리어 = 7)', [f"{st.mean(reach(x) for x in r):.2f}" for _, r, _ in D])
    for ph in range(1, 7): row(f'P{ph} 통과', [P(sum(reach(x) >= ph + 1 for x in r) / len(r)) for _, r, _ in D])
    # 짝 비교 (첫 열 기준)
    base = {x['seed']: x['cleared'] for x in D[0][1]}
    pr(f'\n짝 비교 (같은 시드, 기준 {names[0]})\n'); hdr('지표')
    def pair(r):
        ps = [(base[x['seed']], x['cleared']) for x in r if x['seed'] in base]
        d = [int(b) - int(a) for a, b in ps]; m = st.mean(d); se = st.pstdev(d) / math.sqrt(len(d))
        return len(ps), sum(1 for a, b in ps if a and not b), sum(1 for a, b in ps if not a and b), m, Z * se
    ps = [pair(r) for _, r, _ in D]
    row('짝 수', [str(p[0]) for p in ps])
    row('성공 → 실패', [str(p[1]) for p in ps]); row('실패 → 성공', [str(p[2]) for p in ps])
    row('클리어 차', [f'{p[3]*100:+.1f} ± {p[4]*100:.1f}%p' for p in ps])
    # 보스 · 역경 승률
    pr('\n페이즈별 보스 · 역경 승률 (전투 수)\n'); hdr('페이즈 · 노드')
    for ph in range(1, 7):
        for t in ['boss', 'adversity']:
            xs = []
            for _, r, _ in D:
                b = [x['won'] for y in r for x in y['trace'] if x['ph'] == ph and x['type'] == t]
                xs.append(f'{P(sum(b)/len(b))} ({len(b)})' if b else '-')
            row(f'P{ph} {ko(t)}', xs)
    # 2. 자산
    pr('\n## 2. 페이즈별 전투 직전 보유 크레딧 (런 평균 → 런 사이 평균 · 중앙 · 25/75%)\n'); hdr('페이즈')
    for ph in range(1, 7):
        xs = []
        for _, r, _ in D:
            v = [x['eco']['crAt'][str(ph)][0] / x['eco']['crAt'][str(ph)][1] for x in r if str(ph) in x['eco']['crAt'] and x['eco']['crAt'][str(ph)][1]]
            q = st.quantiles(v, n=4) if len(v) > 3 else [0, 0, 0]
            xs.append(f'{st.mean(v):.0f} · {st.median(v):.0f} · {q[0]:.0f}/{q[2]:.0f}')
        row(f'P{ph}', xs)
    pr('\n전투 직전 보유 크레딧 40 이상인 전투 비율\n'); hdr('페이즈')
    for ph in range(1, 7):
        xs = []
        for _, r, _ in D:
            c = [e[4] for x in r for e in x['ins']['enc'] if e[0] == ph]
            xs.append(P(sum(1 for y in c if y >= 40) / len(c)) if c else '-')
        row(f'P{ph}', xs)
    row('영희 바닥 위반 (yhBreach, 런당)', [f"{sum((x['ins'].get('ch') or {}).get('yhBreach', 0) for x in r)/len(r):.2f}" for _, r, _ in D])
    pr('\n런당 지출 · 수입 (크레딧)\n'); hdr('항목')
    keys = ['xp', 'fleet', 'muster', 'shop', 'invest', 'event', 'loan']
    KO = {'xp': '공명도', 'fleet': '함대 확장', 'muster': '지정 소집', 'shop': '상점 · 정비 · 합성', 'invest': '투자', 'event': '사건', 'loan': '대출 상환'}
    for k in keys: row(f'지출: {KO[k]}', [f"{sum((x['eco'].get('sp') or {}).get(k, 0) for x in r)/len(r):.0f}" for _, r, _ in D])
    row('지출 합', [f"{sum(sum((x['eco'].get('sp') or {}).values()) for x in r)/len(r):.0f}" for _, r, _ in D])
    row('공명도 몫', [P(sum((x['eco'].get('sp') or {}).get('xp', 0) for x in r) / max(1, sum(sum((x['eco'].get('sp') or {}).values()) for x in r))) for _, r, _ in D])
    row('전투 정산 수입', [f"{st.mean(x['eco']['inc'] for x in r):.0f}" for _, r, _ in D])
    row('이자 수입', [f"{st.mean(x['eco']['i'] for x in r):.0f}" for _, r, _ in D])
    row('이자 상한에 걸린 전투 (런당)', [f"{st.mean(x['eco']['atCap'] for x in r):.1f}" for _, r, _ in D])
    row('이자 상한 도달률 (전투당)', [P(sum(x['eco']['atCap'] for x in r) / max(1, sum(x['eco']['nb'] for x in r))) for _, r, _ in D])
    row('끝 크레딧', [f"{st.mean(x['eco']['end'] for x in r):.0f}" for _, r, _ in D])
    row('지정 소집 (런당 횟수)', [f"{st.mean((x['ins'].get('ch') or {}).get('muster', 0) for x in r):.2f}" for _, r, _ in D])
    # 3. 갈림길 · 상점
    pr('\n## 3. 갈림길 선택 (전체 선택 중 비율)\n')
    allo = collections.Counter(c for _, r, _ in D for x in r for *_, c in x['ins'].get('br', []))
    hdr('선택지')
    row('런당 갈림길', [f"{sum(len(x['ins'].get('br', [])) for x in r)/len(r):.2f}" for _, r, _ in D])
    for o, _ in allo.most_common():
        xs = []
        for _, r, _ in D:
            c = collections.Counter(cc for x in r for *_, cc in x['ins'].get('br', [])); n = sum(c.values()); off = sum(1 for x in r for _, opts, _ in x['ins'].get('br', []) if o in opts.split(','))
            xs.append(f'{P(c[o]/n)} (제시 대비 {P(c[o]/max(1, off))})')
        row(ko(o), xs)
    pr('\n페이즈별 상점 선택 비율 (그 페이즈 갈림길 중)\n'); hdr('페이즈')
    for ph in range(1, 7):
        xs = []
        for _, r, _ in D:
            c = [cc for x in r for p, _, cc in x['ins'].get('br', []) if p == ph]
            xs.append(f"상점 {P(c.count('shop')/len(c))} · 보급 {P(c.count('supply')/len(c))} · 영입 {P(c.count('recruit')/len(c))}" if c else '-')
        row(f'P{ph}', xs)
    pr('\n상점 (정비 · 합성 포함, 구매 기록 기준)\n'); hdr('지표')
    def shopv(r): return sum(1 for x in r for b in x['ins'].get('br', []) if b[2] in ('shop', 'maint'))
    row('상점 · 정비 방문 (런당)', [f'{shopv(r)/len(r):.2f}' for _, r, _ in D])
    row('구매 (런당 개수)', [f"{sum(len(x['ins'].get('buy', [])) for x in r)/len(r):.2f}" for _, r, _ in D])
    row('구매액 (런당)', [f"{sum(b[2] for x in r for b in x['ins'].get('buy', []))/len(r):.0f}" for _, r, _ in D])
    row('방문당 구매', [f"{sum(len(x['ins'].get('buy', [])) for x in r)/max(1, shopv(r)):.2f}" for _, r, _ in D])
    for k in ['재료', '고급', '희귀', '전설', '문장', '소모품', '포탑']:
        row(f'구매: {k}', [f"{sum(1 for x in r for b in x['ins'].get('buy', []) if cat(b[1]) == k)/len(r):.2f}" for _, r, _ in D])
    for name, r, _ in D[1:]:
        buys = [b for x in r for b in x['ins'].get('buy', [])]
        if not buys: continue
        ic = collections.Counter(b[1] for b in buys)
        pr(f'\n{name} 구매 상위 15\n\n| 아이템 | 종류 | 구매 수 | 산 런 | 평균 가격 | 평균 페이즈 |\n|---|---|---|---|---|---|')
        for i, n in ic.most_common(15):
            k = len({x['seed'] for x in r if any(b[1] == i for b in x['ins'].get('buy', []))})
            pr(f"| {nm(i)} | {cat(i)} | {n} | {P(k/len(r))} | {st.mean(b[2] for b in buys if b[1] == i):.0f} | {st.mean(b[0] for b in buys if b[1] == i):.1f} |")
    # 4. 편성
    pr('\n## 4. 최종 편성 (마지막 전투)\n'); hdr('지표')
    last = lambda x: x['trace'][-1] if x['trace'] else None
    row('출전 인원 평균', [f"{st.mean(len(last(x)['party']) for x in r if last(x)):.2f}" for _, r, _ in D])
    row('보유 기물 평균', [f"{st.mean(len(x['final']) for x in r):.2f}" for _, r, _ in D])
    row('평균 기물 등급 (출전)', [f"{st.mean(st.mean(p['rank'] for p in last(x)['party']) for x in r if last(x) and last(x)['party']):.2f}" for _, r, _ in D])
    row('최고 기물 등급 (출전)', [f"{st.mean(max(p['rank'] for p in last(x)['party']) for x in r if last(x) and last(x)['party']):.2f}" for _, r, _ in D])
    smax = lambda x: max(x['synMax'].values()) if x['synMax'] else 0
    for t in [0, 1, 2, 3]: row(f'시너지 최고 단계 = {t}', [P(sum(1 for x in r if smax(x) == t) / len(r)) for _, r, _ in D])
    row('시너지 최고 단계 ≥ 4', [P(sum(1 for x in r if smax(x) >= 4) / len(r)) for _, r, _ in D])
    row('2단계 이상 시너지가 있는 런', [P(sum(1 for x in r if any(v >= 2 for v in x['synMax'].values())) / len(r)) for _, r, _ in D])
    row('2단계 이상 시너지 수 (런 평균)', [f"{st.mean(sum(1 for v in x['synMax'].values() if v >= 2) for x in r):.2f}" for _, r, _ in D])
    row('마지막 전투 활성 단계 합', [f"{st.mean(e[8] for x in r for e in x['ins']['enc'][-1:]):.2f}" for _, r, _ in D])
    # 5. 상점 아이템 성과
    for name, r, agg in D:
        rows = buy_lift_rows(r, agg)
        if not rows: continue
        pr(f'\n## 5. {name}: 상점에서 산 아이템별 성과 (산 런 20개 이상)\n')
        pr('- 전투 lift = 산 뒤(같은 페이즈부터) 그 런의 전투 승률 − 같은 (페이즈, 노드) 평균. ± 런 군집 95%. 런 lift = 산 런과 안 산 런의 클리어 차 (교란 있음).\n')
        pr('| 아이템 | 종류 | 산 런 | 산 뒤 전투 | 산 뒤 승률 | 전투 lift | 런 클리어 | 런 lift |\n|---|---|---|---|---|---|---|---|')
        for l, i, k, L, S in rows:
            pr(f'| {nm(i)} | {cat(i)} | {k} | {L[0]} | {P(L[1])} | {L[2]*100:+.1f} ± {L[3]*100:.1f}%p | {P(S[1])} | {S[2]*100:+.1f} ± {S[3]*100:.1f}%p |')
    print('\n'.join(out))

if __name__ == '__main__':
    if sys.argv[1] == 'compare':
        NM = json.load(open(sys.argv[2]))
        kv = [a.split('=', 1) for a in sys.argv[3:]]
        pre = next((v for k, v in kv if k == 'prefix'), 'h7_')
        compare(NM, [(k, v) for k, v in kv if k != 'prefix'], pre)
    else:
        single(sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3] if len(sys.argv) > 3 else 'h7_')
