"""순례 항목 가치 (balance.ts pilval) → 봇 실측표 tests/pilval.gen.ts.
사용: python3 tests/pilval_model.py <names.json> src/data/relics.ts <pilval 조각 …> [--gen tests/pilval.gen.ts] [--src <측정 기준 설명>]
- 크레딧 환산: 페이즈별 크레딧 사다리 (16 · 32 · 64 → 공명도) 의 Δ체력차 원점 회귀
- 축복: 같은 축복 id 끼리 묶은 '이번 페이즈 전투당' 값 (봇이 남은 기간 몫을 곱한다), 기간 보정 표도 함께 출력
- 성유물 g · 신앙 h: 바꿨을 때 이득 = g[새] − g[지금] 의 최소제곱 (합 0), 봉헌 1 당 값은 단계별, 나눔은 측정 ÷ 공시 가치
"""
import json, math, re, sys
from collections import defaultdict
import numpy as np
a = sys.argv[1:]
GEN = SRC = None
if '--gen' in a: i = a.index('--gen'); GEN = a[i + 1]; a = a[:i] + a[i + 2:]
if '--src' in a: i = a.index('--src'); SRC = a[i + 1]; a = a[:i] + a[i + 2:]
NAMES = json.load(open(a[0]))['units']
RN = dict(re.findall(r"\{ id: '(\w+)', name: '([^']+)',", open(a[1]).read()))
FN = {'emperor': '황제 숭배', 'athena': '아테나', 'ares': '아레스', 'hermes': '헤르메스', 'hades': '하데스', 'zeus': '제우스', 'selene': '셀레네', 'sirius': '시리우스', 'index': '지수추종', 'science': '과학', 'human': '인간찬가'}
recs = []
for f in a[2:]:
    bot = 'chulsu' if 'chulsu' in f else 'younghee'
    for r in json.load(open(f))['runs']:
        for v in r.get('pv', []): recs.append((bot, v))
# 페이즈 환율 (Δm, 크레딧 사다리 원점 회귀)
L = defaultdict(lambda: [0.0, 0.0])
dm = lambda v, x: ((x[1] - x[2]) - (v['base'][1] - v['base'][2])) / v['n']
for _, v in recs:
    for nm, c, x in v['v']:
        if nm.startswith('cr:'): L[v['ph']][0] += c * dm(v, x); L[v['ph']][1] += c * c
rate = {ph: s / q for ph, (s, q) in L.items()}
cr = lambda v, x: dm(v, x) / rate[v['ph']]
B = 24.4 / 5  # 페이즈당 전투 (판당 24.4)
def horizon(v):  # 이번 페이즈에만 걸리는 효과의 기간 몫: 이번 페이즈 남은 전투 ÷ 런 남은 전투
    rem = B * max(0.5, 12 - v['st']) / 12
    return rem / (rem + B * max(0, 5 - v['ph']))
def ms(xs):
    n = len(xs); m = sum(xs) / n if n else float('nan')
    sd = math.sqrt(sum((x - m) ** 2 for x in xs) / max(1, n - 1)) if n > 1 else 0
    return m, 1.96 * sd / math.sqrt(max(1, n)), n
bl = defaultdict(list); hz = []; rite = []; alms = []; best_choice = defaultdict(int)
up = {}
for bot, v in recs:
    dv = {d[0]: d for d in v['dv']}
    h = horizon(v); hz.append(h)
    ups = {nm.split(':')[1]: cr(v, x) / (24 * (dv[nm.split(':')[1]][3] + 1)) for nm, c, x in v['v'] if nm.startswith('up:')}
    cards = []
    for nm, c, x in v['v']:
        if nm.startswith('bless:'):
            f = nm.split(':')[1]; val = cr(v, x) * h
            bl[f].append(val)
            off = sum(ups.get(u, 0.07) * 40 for u, d in dv.items() if d[1] == f)
            rite.append(val + off); cards.append(('rite', val + off))
        elif nm.startswith('alms:'):
            alms.append(cr(v, x)); cards.append(('alms', cr(v, x)))
    if cards: best_choice[max(cards, key=lambda t: t[1])[0]] += 1
print(f'축복 기간 몫 (이번 페이즈 남은 전투 ÷ 런 남은 전투) 평균 {sum(hz)/len(hz):.2f}')
print('제례 축복 (기간 보정, 크레딧): ' + ' · '.join(f'{FN[f]} {ms(x)[0]:+.1f} ±{ms(x)[1]:.1f} ({len(x)})' for f, x in sorted(bl.items(), key=lambda t: -ms(t[1])[0])))
print(f'제례 카드 (기간 보정 축복 + 출전 디바인 봉헌 +40): {ms(rite)[0]:+.1f} ±{ms(rite)[1]:.1f} ({len(rite)}) · 나눔 카드 {ms(alms)[0]:+.1f} ±{ms(alms)[1]:.1f} ({len(alms)})')
print('방문마다 더 나은 카드 (측정값 기준):', dict(best_choice))
# 성유물 가산 모형: Δ(x 를 지금 c 대신) = g[x] − g[c]
rel = sorted({nm.split(':')[1] for _, v in recs for nm, _, _ in v['v'] if nm.startswith('relic:')} | {d[2] for _, v in recs for d in v['dv'] if d[2]})
ix = {r: i for i, r in enumerate(rel)}
rows, ys = [], []
for _, v in recs:
    dv = {d[0]: d for d in v['dv']}
    for nm, c, x in v['v']:
        if nm.startswith('relic:'):
            _, rid, uid = nm.split(':'); cur = dv[uid][2]
            row = np.zeros(len(rel) + 1); row[ix[rid]] += 1
            if cur: row[ix[cur]] -= 1
            rows.append(row); ys.append(cr(v, x))
A = np.array(rows); A[:, -1] = 0
# 합 0 제약 행
A = np.vstack([A, np.r_[np.ones(len(rel)), 0] * 10]); y = np.r_[ys, 0]
g, *_ = np.linalg.lstsq(A[:, :-1], y, rcond=None)
res = y[:-1] - A[:-1, :-1] @ g
s2 = (res ** 2).sum() / max(1, len(res) - len(rel))
cov = s2 * np.linalg.pinv(A[:, :-1].T @ A[:, :-1])
own = {rid: NAMES.get(o, {}).get('name', o) for rid, o in re.findall(r"\{ id: '(\w+)', name: '[^']+', owner: '(\w+)'", open(a[1]).read())}
print('\n성유물 고유 가치 g (가산 모형, 크레딧, 평균 0 기준 — 바꿀 때 이득 = g[새] − g[지금])')
for r in sorted(rel, key=lambda r: -g[ix[r]]):
    print(f'  {RN.get(r, r)} `{r}` {g[ix[r]]:+.1f} ±{1.96*math.sqrt(max(0, cov[ix[r], ix[r]])):.1f}  ({own.get(r, "순례 전용")})')
# 신앙 가산 모형
fa = sorted(FN); fx = {f: i for i, f in enumerate(fa)}
rows, ys = [], []
for _, v in recs:
    dv = {d[0]: d for d in v['dv']}
    for nm, c, x in v['v']:
        if nm.startswith('conv:'):
            _, nf, uid = nm.split(':'); row = np.zeros(len(fa)); row[fx[nf]] += 1; row[fx[dv[uid][1]]] -= 1; rows.append(row); ys.append(cr(v, x))
A = np.vstack([np.array(rows), np.ones(len(fa)) * 10]); y = np.r_[ys, 0]
h, *_ = np.linalg.lstsq(A, y, rcond=None)
res = y[:-1] - A[:-1] @ h; s2 = (res ** 2).sum() / max(1, len(res) - len(fa)); cov = s2 * np.linalg.pinv(A.T @ A)
print('\n신앙 고유 가치 h (가산 모형, 크레딧 — 개종 이득 = h[새] − h[지금])')
for f in sorted(fa, key=lambda f: -h[fx[f]]): print(f'  {FN[f]} {h[fx[f]]:+.1f} ±{1.96*math.sqrt(max(0, cov[fx[f], fx[f]])):.1f}')

# 축복 id 별 (이번 페이즈 전투당, 기간 보정 전) · 봉헌 1 당 (단계별) · 나눔 비 · 권능 1 의 값 (축성)
BL = {'B.martyr': ['hades', 'ares', 'human'], 'B.flame': ['sirius', 'zeus', 'emperor'], 'B.sanctum': ['selene', 'athena', 'science'], 'B.zeal': ['hermes', 'index']}
raw = defaultdict(list); upst = defaultdict(list); ar = []; cons = []
for _, v in recs:
    dv = {d[0]: d for d in v['dv']}
    for nm, c, x in v['v']:
        t = nm.split(':')
        if t[0] == 'bless': raw[next(b for b, fs in BL.items() if t[1] in fs)].append(cr(v, x))
        elif t[0] == 'up':
            sg = dv[t[1]][3]; per = cr(v, x) / (24 * (sg + 1)); upst[sg].append(per); cons.append(per * 30)
        elif t[0] == 'alms' and c: ar.append(cr(v, x) / c)
print('\n축복 (이번 페이즈 전투당, 기간 보정 전): ' + ' · '.join(f'{b} {ms(x)[0]:+.1f} ±{ms(x)[1]:.1f} ({len(x)})' for b, x in raw.items()))
up = [round(ms(upst[n])[0], 3) if upst[n] else 0.07 for n in range(6)]
pw = ms(cons)[0] / 20
print('봉헌 1 당 (단계 0–5):', up, '· 권능 1 =', round(pw, 3), '크레딧 (축성) · 나눔 비', round(ms(ar)[0], 2))
if GEN:
    r1 = lambda d: '{ ' + ', '.join(f"{k if k.isidentifier() else repr(k)}: {v:.1f}" for k, v in d.items()) + ' }'
    open(GEN, 'w').write(f"""// 자동 생성: tests/pilval_model.py (balance.ts pilval 측정 → 순례 봇 실측표). 손으로 고치지 않는다.
// 측정: {SRC or '?'} · 순례 방문 {len(recs)}회. 단위 = 크레딧 (같은 시험 조우에서 크레딧 사다리 → 공명도 구매와 같은 전력 변화).
// 성유물 · 신앙 · 봉헌 · 나눔 수치가 바뀌면 다시 잰다 (docs/TOOLS.md pilval).
/** 성유물 고유 가치: 바꿨을 때 이득 ≈ RELIC_G[새] − RELIC_G[지금] */
export const RELIC_G: Record<string, number> = {r1({r: float(g[ix[r]]) for r in sorted(rel, key=lambda r: -g[ix[r]])})};
/** 신앙 고유 가치: 개종 이득 ≈ FAITH_H[새] − FAITH_H[지금] */
export const FAITH_H: Record<string, number> = {r1({f: float(h[fx[f]]) for f in sorted(fa, key=lambda f: -h[fx[f]])})};
/** 축복: 이번 페이즈 전투당 가치 (봇이 '이번 페이즈 남은 전투 ÷ 런 남은 전투' 를 곱한다) */
export const BLESS_V: Record<string, number> = {r1({b: ms(x)[0] for b, x in raw.items()})};
/** 봉헌 1 당 가치 (지금 단계 0–5) */
export const OFFER_V = {up};
/** 권능 1 의 가치 (축성 = 봉헌 30 ÷ 권능 20) */
export const POWER_V = {pw:.3f};
/** 나눔: 측정 가치 ÷ 공시 가치 (보급 기준값 × CFG.alms.ratio) */
export const ALMS_K = {ms(ar)[0]:.2f};
""")
    print('→', GEN)
