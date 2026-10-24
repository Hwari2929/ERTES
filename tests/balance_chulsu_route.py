# 철수 고난 경로 · 자산 · 상점 구매 · 재료 승률 집계 (docs/BALANCE_CHULSU_ROUTE.md): python3 tests/balance_chulsu_route.py <조각 폴더 (h7_*.json)> <names.json>
# 조각: node balance.cjs <시작 시드> 25 0 7 pool instr bot=chulsu detail (tests/balance.ts 번들, 시드 10001–10500) · 이름표: tests/chulsu2000_names.ts [장비 id 목록]
import json, glob, math, collections, sys, statistics as st
src, NM = sys.argv[1], json.load(open(sys.argv[2]))
Z = 1.96
runs, agg = [], collections.defaultdict(dict)
for p in sorted(glob.glob(f'{src}/h7_*.json')):
    d = json.load(open(p)); runs += d['runs']
    for t, rows in d['agg'].items():
        for k, v in rows.items():
            a = agg[t].setdefault(k, {})
            for f, x in v.items(): a[f] = a.get(f, 0) + x
runs = [r for r in runs if 'err' not in r]
R = len(runs)
reach = lambda r: 7 if r['cleared'] else min(r['phase'], 6)
P = lambda x: f'{x*100:.1f}%'
def nm(i): return (NM['item'].get(i) or {}).get('name', i)
NODEKO = {'battle': '일반 전투', 'adversity': '역경', 'shop': '상점', 'supply': '보급', 'recruit': '영입', 'boss': '보스', 'invest': '투자', 'pilgrim': '순례', 'news': '소식', 'event': '사건', 'challenge': '도전', 'rest': '휴식', 'synth': '합성', 'maint': '정비', '-': '(없음)'}
ko = lambda t: NODEKO.get(t, t)
def split(has):
    A = [r for r in runs if has(r)]; B = [r for r in runs if not has(r)]
    if len(A) < 5 or len(B) < 5: return None
    ka, kb = sum(r['cleared'] for r in A), sum(r['cleared'] for r in B)
    qa, qb = (ka + 1) / (len(A) + 2), (kb + 1) / (len(B) + 2)
    se = math.sqrt(qa * (1 - qa) / (len(A) + 2) + qb * (1 - qb) / (len(B) + 2))
    return len(A), ka / len(A), ka / len(A) - kb / len(B), Z * se
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
