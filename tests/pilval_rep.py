"""순례 항목 가치 (pilval) 집계: python3 ana.py <names.json> <relics.ts> <조각 …> [--json out.json]
지표: 전투당 승률 차 Δw · 체력 차 Δm = ((아군 남은 체력 − 적 남은 체력) 비율 합 차) / 전투 수.
크레딧 환산: 같은 페이즈의 크레딧 사다리 (16 · 32 · 64 크레딧 → 공명도) 로 '크레딧 1 당 Δ' 를 원점 회귀 (Σ K·Δ / Σ K²) → 항목 Δ ÷ 그 값.
봉헌: up (다음 단계까지 채움) 의 Δ 를 그 단계 폭 24 · (n+1) 으로 나눠 '봉헌 1 당' 으로, 축성 = × 30, 제례 = 축복 + 대상 디바인 × 40.
"""
import json, math, re, sys
from collections import defaultdict

a = sys.argv[1:]
js = None
if '--json' in a: i = a.index('--json'); js = a[i + 1]; a = a[:i] + a[i + 2:]
NAMES = json.load(open(a[0]))['units']
RN = dict(re.findall(r"\{ id: '(\w+)', name: '([^']+)',", open(a[1]).read()))
FN = {'emperor': '황제 숭배', 'athena': '아테나', 'ares': '아레스', 'hermes': '헤르메스', 'hades': '하데스', 'zeus': '제우스', 'selene': '셀레네',
      'sirius': '시리우스', 'index': '지수추종', 'science': '과학', 'human': '인간찬가'}
STEP, CONS, RITE = 24, 30, 40

recs = []  # (bot, rec)
for f in a[2:]:
    bot = 'chulsu' if 'chulsu' in f else 'younghee'
    for r in json.load(open(f))['runs']:
        for v in r.get('pv', []): recs.append((bot, v))

def dl(v, x):
    n = v['n']; b = v['base']
    return ((x[0] - b[0]) / n, ((x[1] - x[2]) - (b[1] - b[2])) / n)

# 1) 크레딧 사다리 → 페이즈별 크레딧 1 당 Δ (두 지표)
lad = defaultdict(lambda: [0.0, 0.0, 0.0, 0])  # ph -> [ΣKΔw, ΣKΔm, ΣK², n]
lad_k = defaultdict(lambda: [[], []])  # (ph, K) -> [Δw…], [Δm…]
for bot, v in recs:
    for nm, c, x in v['v']:
        if nm.startswith('cr:'):
            dw, dm = dl(v, x); K = c; L = lad[v['ph']]
            L[0] += K * dw; L[1] += K * dm; L[2] += K * K; L[3] += 1
            lad_k[(v['ph'], K)][0].append(dw); lad_k[(v['ph'], K)][1].append(dm)
rate = {ph: (L[0] / L[2], L[1] / L[2]) for ph, L in lad.items()}
allL = [sum(L[i] for L in lad.values()) for i in range(3)]
rate_all = (allL[0] / allL[2], allL[1] / allL[2])

def ms(xs):
    n = len(xs)
    if not n: return (float('nan'), float('nan'), 0)
    m = sum(xs) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in xs) / max(1, n - 1))
    return (m, 1.96 * sd / math.sqrt(n), n)

# 2) 항목별 크레딧 환산 (Δm 기준, 페이즈 환율) — 기록마다 환산한 뒤 평균
def cred(v, d):  # d = (dw, dm) → 크레딧 (Δm 환율)
    r = rate.get(v['ph'], rate_all)[1]
    return d[1] / r if r > 1e-9 else float('nan')

items = defaultdict(list)       # 종류 → 크레딧 값들
items_w = defaultdict(list)     # 종류 → Δw
relic = defaultdict(list)       # (성유물) → 크레딧 (출전 디바인에 장착)
relic_ct = defaultdict(list)    # (성유물, 전투 유형) → 크레딧
relic_from = defaultdict(list)  # (지금 성유물) → 크레딧 (빼앗기는 쪽: 이 성유물을 다른 것으로 바꿨을 때)
conv = defaultdict(list)        # (전 신앙 → 새 신앙) → 크레딧
conv_to = defaultdict(list)
up_by = defaultdict(list)       # 단계 n → 봉헌 1 당 크레딧
bless = defaultdict(list)
alms_ratio = []                 # 나눔: 측정 크레딧 ÷ 공시 가치
for bot, v in recs:
    dv = {d[0]: d for d in v['dv']}
    cr_up = {}
    for nm, c, x in v['v']:
        d = dl(v, x); k = cred(v, d)
        if nm.startswith('cr:'): continue
        t = nm.split(':')
        if t[0] == 'up':
            sg = dv[t[1]][3]; per = k / (STEP * (sg + 1)); cr_up[t[1]] = per
            up_by[sg].append(per); items['봉헌 1 (축성 · 제례 몫의 단위)'].append(per); items_w['봉헌 1 (축성 · 제례 몫의 단위)'].append(d[0] / (STEP * (sg + 1)))
        elif t[0] == 'bless':
            bless[t[1]].append(k); items['제례 축복 (이번 페이즈)'].append(k); items_w['제례 축복 (이번 페이즈)'].append(d[0])
        elif t[0] == 'alms':
            items['나눔 카드'].append(k); items_w['나눔 카드'].append(d[0])
            if c: alms_ratio.append(k / c)
        elif t[0] == 'relic':
            rid, uid = t[1], t[2]
            items['성유물 구매 + 장착 (출전 디바인 1명)'].append(k); items_w['성유물 구매 + 장착 (출전 디바인 1명)'].append(d[0])
            relic[rid].append(k); relic_ct[(rid, NAMES.get(uid, {}).get('ct', '?'))].append(k); relic_from[dv[uid][2]].append(k)
        elif t[0] == 'conv':
            fr = dv[t[2]][1]
            items['개종 (출전 디바인 1명)'].append(k); items_w['개종 (출전 디바인 1명)'].append(d[0])
            conv[(fr, t[1])].append(k); conv_to[t[1]].append(k)
    # 축성 = 봉헌 30 (그 디바인), 제례 = 축복 + 그 신앙 출전 디바인 × 40 (대기 디바인 몫은 0 으로 둔다)
    for uid, per in cr_up.items():
        items['축성 (봉헌 +30, 권능 20)'].append(per * CONS)
    for nm, c, x in v['v']:
        if nm.startswith('bless:'):
            f = nm.split(':')[1]; k = cred(v, dl(v, x))
            items['제례 카드 (축복 + 출전 디바인 봉헌 +40)'].append(k + sum(cr_up.get(u, 0) * RITE for u, d in dv.items() if d[1] == f))

def curve(ph):
    pts = [(0, 0.0)] + [(K, ms(lad_k[(ph, K)][1])[0]) for K in (16, 32, 64) if lad_k[(ph, K)][1]]
    return pts
def inv(ph, y):
    pts = curve(ph)
    for (k0, y0), (k1, y1) in zip(pts, pts[1:]):
        if y1 > y0 and y0 <= y <= y1: return k0 + (y - y0) / (y1 - y0) * (k1 - k0)
    if y < 0 and len(pts) > 1 and pts[1][1] > 0: return y / pts[1][1] * pts[1][0]
    (k0, y0), (k1, y1) = pts[-2], pts[-1]
    sl = (y1 - y0) / (k1 - k0) if y1 > y0 else (y1 / k1 if y1 > 0 else float('nan'))
    return k1 + (y - y1) / sl if sl and sl > 0 else float('nan')
out = {'n_visits': len(recs), 'rate': {str(k): v for k, v in rate.items()}, 'rate_all': rate_all}
P = print
P(f'순례 방문 {len(recs)} (철수 {sum(1 for b, _ in recs if b == "chulsu")} · 영희 {sum(1 for b, _ in recs if b == "younghee")}), 방문당 시험 전투 {recs[0][1]["n"] if recs else 0}')
P('\n### 크레딧 사다리 (공명도 구매) — 전투당 Δ승률 · Δ체력차, 페이즈별')
P('| 페이즈 | 방문 | 16 크레딧 Δw / Δm | 32 | 64 | 크레딧 1 당 Δm | 크레딧 1 당 Δw |')
P('|---|---|---|---|---|---|---|')
for ph in sorted(rate):
    cells = []
    for K in (16, 32, 64):
        w = ms(lad_k[(ph, K)][0]); m = ms(lad_k[(ph, K)][1])
        cells.append(f'{100*w[0]:+.1f}%p / {m[0]:+.3f} ±{m[1]:.3f}')
    P(f'| P{ph} | {lad[ph][3] // 3} | ' + ' | '.join(cells) + f' | {rate[ph][1]:.5f} | {100*rate[ph][0]:.3f}%p |')
P(f'| 전체 | {sum(L[3] for L in lad.values()) // 3} | | | | {rate_all[1]:.5f} | {100*rate_all[0]:.3f}%p |')

P('\n### 항목별 크레딧 환산 (Δm 기준 · 페이즈 환율, 평균 ±95%)')
P('| 항목 | 크레딧 환산 | 표본 | 전투당 Δ승률 |')
P('|---|---|---|---|')
order = ['봉헌 1 (축성 · 제례 몫의 단위)', '축성 (봉헌 +30, 권능 20)', '제례 축복 (이번 페이즈)', '제례 카드 (축복 + 출전 디바인 봉헌 +40)', '나눔 카드', '성유물 구매 + 장착 (출전 디바인 1명)', '개종 (출전 디바인 1명)']
out['items'] = {}
for k in order:
    m = ms(items[k]); w = ms(items_w[k]) if k in items_w else (float('nan'),) * 3
    P(f'| {k} | {m[0]:+.1f} ±{m[1]:.1f} | {m[2]} | {"" if math.isnan(w[0]) else f"{100*w[0]:+.2f}%p"} |')
    out['items'][k] = m
if alms_ratio: P(f'\n나눔: 측정 크레딧 ÷ 공시 가치 (보급 기준값 × 1) = {ms(alms_ratio)[0]:.2f} ±{ms(alms_ratio)[1]:.2f}')
P('\n봉헌 1 당 크레딧 (지금 단계별): ' + ' · '.join(f'{n}→{n+1} {ms(up_by[n])[0]:+.2f} ±{ms(up_by[n])[1]:.2f} ({len(up_by[n])})' for n in sorted(up_by)))
P('제례 축복 (신앙별): ' + ' · '.join(f'{FN.get(f, f)} {ms(x)[0]:+.1f} ±{ms(x)[1]:.1f} ({len(x)})' for f, x in sorted(bless.items(), key=lambda t: -ms(t[1])[0])))

P('\n### 진열장 성유물 (출전 디바인에 장착했을 때, 크레딧 환산)')
P('| 성유물 | 값 | 표본 | 사격형 MARK | 타격형 VAN | 기술형 SPEC | 지원형 SUP | 이 성유물을 빼면 (다른 것으로 바꿀 때) |')
P('|---|---|---|---|---|---|---|---|')
out['relic'] = {}
for rid in sorted(relic, key=lambda r: -ms(relic[r])[0]):
    m = ms(relic[rid])
    cts = []
    for ct in ('MARK', 'VAN', 'SPEC', 'SUP'):
        x = relic_ct.get((rid, ct), [])
        cts.append(f'{ms(x)[0]:+.1f} ({len(x)})' if len(x) >= 5 else '—')
    fr = relic_from.get(rid, [])
    P(f'| {RN.get(rid, rid)} `{rid}` | **{m[0]:+.1f}** ±{m[1]:.1f} | {m[2]} | ' + ' | '.join(cts) + f' | {ms(fr)[0]:+.1f} ({len(fr)}) |' if fr else f'| {RN.get(rid, rid)} `{rid}` | **{m[0]:+.1f}** ±{m[1]:.1f} | {m[2]} | ' + ' | '.join(cts) + ' | — |')
    out['relic'][rid] = {'all': m, 'ct': {ct: ms(relic_ct.get((rid, ct), [])) for ct in ('MARK', 'VAN', 'SPEC', 'SUP')}, 'from': ms(fr)}

P('\n### 개종 (새 신앙별, 크레딧 환산)')
P(' · '.join(f'{FN.get(f, f)} {ms(x)[0]:+.1f} ±{ms(x)[1]:.1f} ({len(x)})' for f, x in sorted(conv_to.items(), key=lambda t: -ms(t[1])[0])))
cf = defaultdict(list)
for (fr, to), x in conv.items(): cf[fr] += x
P('바꾸기 전 신앙별: ' + ' · '.join(f'{FN.get(f, f)} {ms(x)[0]:+.1f} ±{ms(x)[1]:.1f} ({len(x)})' for f, x in sorted(cf.items(), key=lambda t: -ms(t[1])[0])))
out['conv_to'] = {f: ms(x) for f, x in conv_to.items()}; out['conv_from'] = {f: ms(x) for f, x in cf.items()}
if js: json.dump(out, open(js, 'w'), ensure_ascii=False, indent=1)
