"""밸런스 조각 집계 2단계 (v471 보고서에서 처음 씀): 작업 폴더의 acc_chulsu.json · acc_younghee.json (tests/balance_acc.py) → tables.md (보고서 표 재료) + summary.json (docs 원자료).
사용: python3 tests/balance_rep.py <작업 폴더> [직전 보고 원자료 json (기본 docs/balance_2026_10_30_v457.json)]
직전 보고 비교 열은 v457 원자료 키 (rep · byPhaseNode · foe) 를 읽는다. v471 부터의 원자료 (이 스크립트의 summary.json) 도 받는다:
byPhaseNode · foe 를 v457 모양으로 바꿔 읽고, 시드별 클리어 (seeds) 가 있으면 같은 시드 짝 비교를 낸다. 비교 열 이름은 파일 이름의 vNNN (BAL_PREV 로 바꿀 수 있다).
디바인 개편 (2026-10-31, 서약 증강 · 참배 카드 없음 — 이름표 vows 가 빈 표) 뒤 자료면 서약 · 참배 카드 · 초안 봉헌 대입 표를 건너뛰고 dv 여섯째 칸을 봉헌 단계로 읽는다."""
import json, os, math, sys, re
from collections import defaultdict, Counter

HERE = sys.argv[1]
N = json.load(open(os.path.join(HERE, 'names.json')))
U = N['units']; EN = N['enemy']
_PREV = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'balance_2026_10_30_v457.json')
V457 = json.load(open(_PREV))
PL = os.environ.get('BAL_PREV') or (re.search(r'v\d+', os.path.basename(_PREV)) or re.search('', '')).group(0) or '직전'  # 비교 열 이름
if 'byPhaseNode' not in V457:  # v471 이후 원자료: v457 모양으로 바꿔 읽는다 (lift 는 % → 비율)
    V457['byPhaseNode'] = {b: {k.replace('|', ':'): {'rank': x[3]} for k, x in V457['rep'][b]['node'].items()} for b in ['chulsu', 'younghee']}
    _fo = V457['foe']
    V457['foe'] = {b: {'tend': {k: {'lift': x['lift'] / 100} for k, x in _fo['tend'][b].items() if x},
                       'squad': {k: {'lift': x['lift'] / 100} for k, x in _fo['squad'][b].items() if x},
                       'foe': {k: {'lift': u[b[0]]['lift'] / 100} for k, u in _fo['units'].items() if u.get(b[0])}} for b in ['chulsu', 'younghee']}
BOTS = ['chulsu', 'younghee']
BN = {'chulsu': '철수', 'younghee': '영희'}
D = {b: json.load(open(os.path.join(HERE, f'acc_{b}.json'))) for b in BOTS}
POST = not N.get('vows')  # 디바인 개편 뒤 (서약 증강 없음)
MINOR = ['gunnir', 'demiurgos', 'ingel', 'zahara', 'jaehwon', 'vivian', 'bill', 'orca', 'eden', 'chloe', 'west', 'rasmus', 'sigmund', 'u404', 'petrock']
GRP = {'toDivine': '디바인으로 (5)', 'toPsionic': '사이오닉으로 (4)', 'toMajor': '메이저로 (6)'}
DIVINE = [k for k, v in U.items() if v['tt'] == 'divine']
NODE_KO = {'battle': '일반', 'adversity': '역경', 'challenge': '도전', 'boss': '보스'}
TT_KO = {'major': '메이저', 'minor': '스페셜', 'psionic': '사이오닉', 'divine': '디바인'}
CT_KO = {'VAN': '돌격가', 'MARK': '명사수', 'SPEC': '전문가', 'CMD': '지휘관'}
out_lines = []
def P(*a): out_lines.append(' '.join(str(x) for x in a))
def nm(i): return U.get(i, {}).get('name') or EN.get(i, {}).get('name') or i


def fin(a):
    if not a: return None
    Sr, Sn, Srr, Srn, Snn, k, Sw = a
    if Sn <= 0: return None
    L = Sr / Sn
    var = (k / (k - 1) if k > 1 else 1) * max(0.0, Srr - 2 * L * Srn + L * L * Snn) / (Sn * Sn)
    return {'lift': 100 * L, 'ci': 196 * math.sqrt(var), 'n': int(Sn), 'runs': int(k), 'win': 100 * Sw / Sn}


def acc(b, tab, key): return D[b]['acc'].get(tab, {}).get(key)
def both(tab, key):
    a, c = acc('chulsu', tab, key), acc('younghee', tab, key)
    if not a: return c
    if not c: return a
    return [x + y for x, y in zip(a, c)]
def L(b, tab, key): return fin(acc(b, tab, key) if b != 'both' else both(tab, key))
def fl(x, ci=True, n=False):
    if not x: return '—'
    s = f"{x['lift']:+.1f}"
    if ci: s += f" ±{x['ci']:.1f}"
    if n: s += f" ({x['n']:,})"
    return s


def wilson(k, n, z=1.96):
    if n == 0: return (0, 0)
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - h) / d, (c + h) / d)


def runlift(b, pred):
    R = D[b]['runs']; w = [r for r in R if pred(r)]; wo = [r for r in R if not pred(r)]
    if not w or not wo: return None
    p1 = sum(r['cl'] for r in w) / len(w); p0 = sum(r['cl'] for r in wo) / len(wo)
    se = math.sqrt(p1 * (1 - p1) / len(w) + p0 * (1 - p0) / len(wo))
    return {'d': 100 * (p1 - p0), 'ci': 196 * se, 'n': len(w), 'p1': 100 * p1}
def frl(x): return '—' if not x else f"{x['d']:+.1f} ±{x['ci']:.1f} ({x['n']})"


summary = {'note': os.environ.get('BAL_NOTE', ''), 'rep': {}, 'minor': {}, 'divine': {}, 'foe': {}, 'seeds': {}}  # BAL_NOTE: 원자료 json 머리 설명 (측정 커밋 · 표본)

# ───────── 0. 실행
P('## 0. 실행')
for b in BOTS:
    d = D[b]; R = d['runs']
    ms = [r['ms'] for r in R]
    P(f"- {BN[b]}: 런 {len(R)} · 실패 {len(d['errs'])} · 200노드 상한 {d['capped']} · 판당 {sum(ms)/len(ms)/1000:.1f}초 (CPU 합 {sum(ms)/3.6e6:.2f}시간)")
    summary['seeds'][b] = {'from': min(r['seed'] for r in R), 'cleared': ''.join(str(r['cl']) for r in sorted(R, key=lambda r: r['seed']))}

# ───────── 1. 요약
P('\n## 1. 요약')
P(f'| 항목 | 철수 | 영희 | {PL} (철수 / 영희) |'); P('|---|---|---|---|')
row = {}
for b in BOTS:
    R = D[b]['runs']; n = len(R); k = sum(r['cl'] for r in R); lo, hi = wilson(k, n)
    fb = {}
    for ph in range(1, 6):
        xs = [r['fb'][str(ph)] for r in R if str(ph) in r['fb']]
        fb[ph] = (100 * sum(xs) / len(xs) if xs else 0, len(xs))
    fa = Counter(r['fail'] for r in R if r['fail'])
    row[b] = dict(clear=f"**{100*k/n:.1f}%** ({100*lo:.1f}–{100*hi:.1f})", fb=' / '.join(f"{fb[p][0]:.0f}" for p in range(1, 6)),
                  fail=' · '.join(f"{x.replace('battle','일반').replace('adversity','역경').replace('boss','보스').replace('challenge','도전')} {c}" for x, c in fa.most_common(4)),
                  nb=f"{sum(r['nb'] for r in R)/n:.1f} · {sum(r['hp'] for r in R)/n:.0f}", ph=f"{sum(r['ph'] for r in R)/n:.2f}")
    summary['rep'][b] = {'n': n, 'clear': k / n, 'clearCI': [lo, hi], 'phase': sum(r['ph'] for r in R) / n, 'failAt': fa.most_common(), 'bossFirst': {p: fb[p] for p in fb},
                         'battlesPerRun': sum(r['nb'] for r in R) / n, 'hpEnd': sum(r['hp'] for r in R) / n}
v = V457['rep']
P(f"| 클리어 (95% CI) | {row['chulsu']['clear']} | {row['younghee']['clear']} | {100*v['chulsu']['clear']:.1f}% / {100*v['younghee']['clear']:.1f}% |")
P(f"| 보스 첫 시도 P1–P5 | {row['chulsu']['fb']} | {row['younghee']['fb']} | " + ' · '.join(' / '.join(f"{(lambda x: x if x > 1.5 else 100 * x)(v[b]['bossFirst'][str(p)][0]):.0f}" for p in range(1, 6)) for b in BOTS) + ' |')
P(f"| 실패 위치 상위 | {row['chulsu']['fail']} | {row['younghee']['fail']} | |")
P(f"| 판당 전투 · 끝난 뒤 체력 | {row['chulsu']['nb']} | {row['younghee']['nb']} | {' / '.join(f"{v[b]['battlesPerRun']:.1f} · {v[b]['hpEnd']:.0f}" for b in BOTS) if 'battlesPerRun' in v['chulsu'] else '24.1 · 21 / 24.3 · 32'} |")
P(f"| 평균 도달 페이즈 | {row['chulsu']['ph']} | {row['younghee']['ph']} | {v['chulsu']['phase']:.2f} / {v['younghee']['phase']:.2f} |")
# 같은 시드 짝 비교 (직전 원자료에 시드별 클리어가 있을 때) · 없으면 v457 처럼 같은 시드 2,000판만 (30001–32000)
for b in BOTS:
    sd = V457.get('seeds', {}).get(b)
    if not sd: continue
    old = {sd['from'] + i: int(c) for i, c in enumerate(sd['cleared'])}
    R = [r for r in D[b]['runs'] if r['seed'] in old]; N_ = len(R)
    if not N_: continue
    ob = sum(1 for r in R if old[r['seed']] and not r['cl']); nb_ = sum(1 for r in R if r['cl'] and not old[r['seed']])
    d_ = (nb_ - ob) / N_; se = math.sqrt(max(0.0, ob + nb_ - (nb_ - ob) ** 2 / N_)) / N_
    P(f"- {BN[b]} 같은 시드 짝 ({N_}판): {PL} {100*sum(old[r['seed']] for r in R)/N_:.1f}% → 이번 {100*sum(r['cl'] for r in R)/N_:.1f}% · **{100*d_:+.1f} ±{196*se:.1f}%p** ({PL}만 클리어 {ob} · 이번만 {nb_})")
    summary.setdefault('paired', {})[b] = {'n': N_, 'prevOnly': ob, 'newOnly': nb_, 'd': d_, 'ci': 1.96 * se}
for b in BOTS:
    if V457.get('seeds', {}).get(b): continue
    R = [r for r in D[b]['runs'] if r['seed'] <= 32000]
    if R: P(f"- {BN[b]} 시드 30001–32000 ({len(R)}판) 클리어 {100*sum(r['cl'] for r in R)/len(R):.1f}% ({PL} {100*v[b]['clear']:.1f}%)")
    R2 = [r for r in D[b]['runs'] if r['seed'] > 32000]
    if R2: P(f"- {BN[b]} 시드 32001–32500 ({len(R2)}판) 클리어 {100*sum(r['cl'] for r in R2)/len(R2):.1f}%")
_cs = {r['seed']: r['cl'] for r in D['chulsu']['runs']}; _ys = {r['seed']: r['cl'] for r in D['younghee']['runs']}
_both = [s for s in _cs if s in _ys]
P(f"- 같은 시드 짝 ({len(_both)}판): 둘 다 성공 {sum(1 for s in _both if _cs[s] and _ys[s])} · 철수만 {sum(1 for s in _both if _cs[s] and not _ys[s])} · 영희만 {sum(1 for s in _both if _ys[s] and not _cs[s])} · 둘 다 실패 {sum(1 for s in _both if not _cs[s] and not _ys[s])}")

# ───────── 2. 페이즈 × 노드
P('\n## 2. 페이즈 × 노드 (전투 승률 · 재도전 포함)')
for b in BOTS:
    S = D[b]['S']; vn = V457['rep'][b]['node']; vb = V457['byPhaseNode'][b]
    P(f'\n{BN[b]}'); P('| 페이즈 | 일반 | 역경 | 도전 | 보스 | 보스전 등급 | 보스전 적 수 | 일반 · 역경 · 보스 시간 |'); P('|---|---|---|---|---|---|---|---|')
    summary['rep'][b]['node'] = {}
    for ph in range(1, 6):
        cells = []
        for nd in ['battle', 'adversity', 'challenge', 'boss']:
            s = S.get(f'pn|{ph}|{nd}')
            if not s: cells.append(''); continue
            w = 100 * s['w'] / s['n']; old = vn.get(f'{ph}|{nd}')
            cells.append(f"{w:.1f} ({100*old[0]:.1f})" if old else f"{w:.1f}")
            summary['rep'][b]['node'][f'{ph}|{nd}'] = [s['w'] / s['n'], s['n'], s['sec'] / s['n'], s['rank'] / s['n'], s['foes'] / s['n'], s['alive'] / s['n'], s['ad'] / s['n']]
        sb = S.get(f'pn|{ph}|boss'); ob = vb.get(f'{ph}:boss')
        secs = ' · '.join(f"{S[f'pn|{ph}|{nd}']['sec']/S[f'pn|{ph}|{nd}']['n']:.1f}" for nd in ['battle', 'adversity', 'boss'] if f'pn|{ph}|{nd}' in S)
        P(f"| P{ph} | " + ' | '.join(cells) + f" | {sb['rank']/sb['n']:.2f} ({ob['rank']:.2f}) | {sb['foes']/sb['n']:.1f} | {secs} |")

# ───────── 3. 전술 유형 · 전투 유형
P('\n## 3. 전술 유형 · 전투 유형 (기물-전투 lift)')
def v457grp(key):  # v457 unitLift 를 기물-전투 수로 가중 평균 (유형 lift 와 같은 정의)
    out = []
    for b in BOTS:
        xs = [x for x in V457['rep'][b]['unitLift'] if key(x[0])]; n = sum(x[3] for x in xs)
        out.append(f"{sum(x[1]*x[3] for x in xs)/n:+.1f}" if n else '—')
    return ' / '.join(out)
P(f'| 유형 | 철수 | 영희 | 두 봇 | P1 | P2 | P3 | P4 | P5 | {PL} (철수 / 영희) |'); P('|---|---|---|---|---|---|---|---|---|---|')
summary['type'] = {}
for tt in ['major', 'minor', 'psionic', 'divine']:
    ph = ' | '.join(fl(L('both', 'tt_ph', f'{tt}|{p}'), ci=False) for p in range(1, 6))
    P(f"| {TT_KO[tt]} | {fl(L('chulsu','tt',tt),n=True)} | {fl(L('younghee','tt',tt),n=True)} | {fl(L('both','tt',tt))} | {ph} | {v457grp(lambda u: U.get(u,{}).get('tt')==tt)} |")
    summary['type'][tt] = {'c': L('chulsu', 'tt', tt), 'y': L('younghee', 'tt', tt), 'both': L('both', 'tt', tt), 'ph': {p: L('both', 'tt_ph', f'{tt}|{p}') for p in range(1, 6)}}
for ct in ['VAN', 'MARK', 'SPEC', 'CMD']:
    P(f"| {CT_KO[ct]} | {fl(L('chulsu','ct',ct),n=True)} | {fl(L('younghee','ct',ct),n=True)} | {fl(L('both','ct',ct))} | | | | | | {v457grp(lambda u: U.get(u,{}).get('ct')==ct)} |")
    summary['type'][ct] = {'c': L('chulsu', 'ct', ct), 'y': L('younghee', 'ct', ct), 'both': L('both', 'ct', ct)}
P('\n유형별 평균 출전 등급 P1–P5 (철수 / 영희)')
for tt in ['major', 'minor', 'psionic', 'divine']:
    P(f"- {TT_KO[tt]}: " + ' · '.join('/'.join(f"{D[b]['S'].get('rk',{}).get(f'{tt}|{ph}|s',0)/max(1,D[b]['S'].get('rk',{}).get(f'{tt}|{ph}|n',0)):.1f}" for b in BOTS) for ph in range(1, 6)))
P('\n유형 × 등급 묶음 (두 봇, lift ±CI (기물-전투))')
P('| 유형 | 1-3 | 4-6 | 7-9 | 10-12 | 13-15 | 16+ |'); P('|---|---|---|---|---|---|---|')
for tt in ['major', 'minor', 'psionic', 'divine']:
    P(f"| {TT_KO[tt]} | " + ' | '.join(fl(L('both', 'ttrk', f'{tt}|{rk}'), n=True) for rk in ['1-3', '4-6', '7-9', '10-12', '13-15', '16+']) + ' |')

# ───────── 4. 스페셜 15명
P('\n## 4. 스페셜 15명')
uLift457 = {b: {x[0]: x for x in V457['rep'][b]['unitLift']} for b in BOTS}
P(f'| 기물 | {"지금 유형" if POST else "옮길 유형"} | 전투 유형 | 철수 lift (전투) | 영희 lift | 두 봇 | 런 lift 철수 | 런 lift 영희 | 사용 런 % (철수 / 영희) | {PL} (철수 / 영희) |'); P('|---|---|---|---|---|---|---|---|---|---|')
mins = {}
grp_of = {}
for x in ['gunnir', 'demiurgos', 'ingel', 'zahara', 'jaehwon']: grp_of[x] = 'toDivine'
for x in ['vivian', 'bill', 'orca', 'eden']: grp_of[x] = 'toPsionic'
for x in ['chloe', 'west', 'rasmus', 'sigmund', 'u404', 'petrock']: grp_of[x] = 'toMajor'
for u in MINOR:
    lc, ly, lb = L('chulsu', 'u', u), L('younghee', 'u', u), L('both', 'u', u)
    rc = runlift('chulsu', lambda r: u in r['used']); ry = runlift('younghee', lambda r: u in r['used'])
    use = ' / '.join(f"{100*sum(1 for r in D[b]['runs'] if u in r['used'])/len(D[b]['runs']):.1f}" for b in BOTS)
    old = ' / '.join(f"{uLift457[b][u][1]:+.1f}" if u in uLift457[b] else '—' for b in BOTS)
    P(f"| {nm(u)} `{u}` | {TT_KO[U[u]['tt']] if POST else GRP[grp_of[u]][:-4]} | {CT_KO.get(U[u]['ct'],'')} | {fl(lc,n=True)} | {fl(ly,n=True)} | {fl(lb)} | {frl(rc)} | {frl(ry)} | {use} | {old} |")
    mins[u] = {'c': lc, 'y': ly, 'b': lb, 'runC': rc, 'runY': ry, 'ph': {p: L('both', 'u_ph', f'{u}|{p}') for p in range(1, 6)},
               'phC': {p: L('chulsu', 'u_ph', f'{u}|{p}') for p in range(1, 6)}, 'phY': {p: L('younghee', 'u_ph', f'{u}|{p}') for p in range(1, 6)}}
P('\n스페셜 페이즈별 전투 lift (두 봇, ±CI, 표본)')
P('| 기물 | P1 | P2 | P3 | P4 | P5 |'); P('|---|---|---|---|---|---|')
for u in MINOR:
    P(f"| {nm(u)} | " + ' | '.join(fl(mins[u]['ph'][p], n=True) for p in range(1, 6)) + ' |')
P('\n옮긴 · 옮길 유형별 묶음 (개편 전 스페셜 15명, 기물-전투 lift)' if POST else '\n옮길 유형별 묶음 (기물-전투 lift)')
P('| 묶음 | 철수 | 영희 | 두 봇 | P1 | P2 | P3 | P4 | P5 |'); P('|---|---|---|---|---|---|---|---|---|')
for g in ['toDivine', 'toPsionic', 'toMajor']:
    P(f"| {GRP[g]} | {fl(L('chulsu','mgrp',g),n=True)} | {fl(L('younghee','mgrp',g),n=True)} | {fl(L('both','mgrp',g))} | " + ' | '.join(fl(L('both', 'mgrp_ph', f'{g}|{p}'), ci=False) for p in range(1, 6)) + ' |')
P('\n스페셜 성장: 대성공 (같은 등급 묶음 안, 두 봇) — 대성공 0 / 1 / 2+')
P('| 등급 | 대성공 0 | 1 | 2+ | 평균 선택 점수 | 평균 대성공 |'); P('|---|---|---|---|---|---|')
for rk in ['1-3', '4-6', '7-9', '10-12', '13-15', '16+']:
    mp = defaultdict(float)
    for b in BOTS:
        for k, vv in D[b]['S'].get('mpp', {}).items(): mp[k] += vv
    n = mp.get(f'{rk}|n', 0)
    P(f"| {rk} | " + ' | '.join(fl(L('both', 'mgreat', f'{rk}|{g}'), n=True) for g in range(3)) + f" | {mp.get(f'{rk}|pp',0)/n if n else 0:.1f} | {mp.get(f'{rk}|gr',0)/n if n else 0:.2f} |")
for b in ['chulsu', 'younghee', 'both']:
    a0, a1 = L(b, 'mgreat_all', '0'), L(b, 'mgreat_all', '1')
    # 등급 묶음으로 층화한 차 (대성공 1회 이상 − 0회, 대성공 쪽 표본으로 가중)
    num = den = var = 0.0
    for rk in ['1-3', '4-6', '7-9', '10-12', '13-15', '16+']:
        x0 = L(b, 'mgreat', f'{rk}|0'); xs = [L(b, 'mgreat', f'{rk}|{g}') for g in (1, 2)]
        for x1 in xs:
            if x0 and x1: num += x1['n'] * (x1['lift'] - x0['lift']); den += x1['n']; var += (x1['n'] ** 2) * ((x1['ci'] / 1.96) ** 2 + (x0['ci'] / 1.96) ** 2)
    strat = f" · 등급 층화 차 **{num/den:+.1f} ±{1.96*math.sqrt(var)/den:.1f}%p**" if den else ''
    P(f"- {BN.get(b,'두 봇')}: 대성공 0회 {fl(a0,n=True)} · 1회 이상 {fl(a1,n=True)}{strat}")
    summary.setdefault('minor_great', {})[b] = {'g0': a0, 'g1': a1, 'strat': [num / den, 1.96 * math.sqrt(var) / den] if den else None}
for b in BOTS:
    mp = Counter(); ng = 0; nt = 0
    for r in D[b]['runs']:
        for ph, uid, rk, picks, gr in r['dvx'].get('mpk', []): mp[picks] += 1; ng += gr; nt += 1
    P(f"- {BN[b]} 능력치 선택 {nt:,}회 (판당 {nt/len(D[b]['runs']):.1f}) · 대성공 {100*ng/max(1,nt):.1f}% · 고른 능력치: " + ' · '.join(f"{k} {100*v/max(1,nt):.0f}%" for k, v in mp.most_common(5)))
    summary.setdefault('minor_pick', {})[b] = {'n': nt, 'great': ng, 'picks': dict(mp)}
summary['minor'] = {u: {'c': mins[u]['c'], 'y': mins[u]['y'], 'both': mins[u]['b'], 'runC': mins[u]['runC'], 'runY': mins[u]['runY'], 'ph': mins[u]['ph']} for u in MINOR}
summary['minor']['_groups'] = {g: {'c': L('chulsu', 'mgrp', g), 'y': L('younghee', 'mgrp', g), 'both': L('both', 'mgrp', g), 'ph': {p: L('both', 'mgrp_ph', f'{g}|{p}') for p in range(1, 6)}} for g in GRP}
summary['minor']['_great'] = {rk: {g: L('both', 'mgreat', f'{rk}|{g}') for g in range(3)} for rk in ['1-3', '4-6', '7-9', '10-12', '13-15', '16+']}
summary['minor']['_ttrk'] = {tt: {rk: L('both', 'ttrk', f'{tt}|{rk}') for rk in ['1-3', '4-6', '7-9', '10-12', '13-15', '16+']} for tt in TT_KO}

# ───────── 5. 디바인
P('\n## 5. 디바인')
P(f'| 기물 | 신앙 | 성유물 | 철수 lift | 영희 lift | 두 봇 | 런 lift 철수 | 런 lift 영희 | 출전 런 % | 신성력 (전투당) | 신권 대행 사용률 | 첫 사용 (초) | 권능 몫 / 전투 | 상한 200 도달 | {PL} |'); P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
dvs = {}
for u in DIVINE:
    s = defaultdict(float)
    for b in BOTS:
        for k, vv in D[b]['S'].get(f'dv|{u}', {}).items(): s[k] += vv
    lc, ly, lb = L('chulsu', 'u', u), L('younghee', 'u', u), L('both', 'u', u)
    rc = runlift('chulsu', lambda r: u in r['dvd']); ry = runlift('younghee', lambda r: u in r['dvd'])
    use = ' / '.join(f"{100*sum(1 for r in D[b]['runs'] if u in r['dvd'])/len(D[b]['runs']):.1f}" for b in BOTS)
    n = s['n'] or 1
    old = ' / '.join(f"{uLift457[b][u][1]:+.1f}" if u in uLift457[b] else '—' for b in BOTS)
    rel = N['defRelic'].get(u, '')
    P(f"| {nm(u)} | {N.get('faiths', {}).get(U[u]['faith'], U[u]['faith'])} | {N['relics'].get(rel,{}).get('name','')} | {fl(lc,n=True)} | {fl(ly,n=True)} | {fl(lb)} | {frl(rc)} | {frl(ry)} | {use} | {s['got']/n:.0f} | {100*s['used']/n:.0f}% | {s['t1']/s['t1n'] if s['t1n'] else 0:.1f} | {s['pwc']/n:.2f} | {100*s['cap']/n:.0f}% | {old} |")
    dvs[u] = {'c': lc, 'y': ly, 'both': lb, 'runC': rc, 'runY': ry, 'battles': s['n'], 'got': s['got'] / n, 'useRate': s['used'] / n, 'acts': s['acts'] / n, 't1': s['t1'] / s['t1n'] if s['t1n'] else None, 'pwc': s['pwc'] / n, 'cap': s['cap'] / n, 'enh': s['enh'] / n,
              'ph': {p: L('both', 'u_ph', f'{u}|{p}') for p in range(1, 6)}}
P('\n디바인 페이즈별 (두 봇): 신성력 · 사용률 · 권능 몫')
P('| 페이즈 | 디바인-전투 | 신성력 | 사용률 | 횟수 | 권능 몫 | 전투당 권능 (디바인 출전 전투) | 상한 12 도달 전투 | 출전 디바인 0 / 1 / 2 / 3+ 승률 lift |'); P('|---|---|---|---|---|---|---|---|---|')
for ph in range(1, 6):
    s = defaultdict(float); pb = defaultdict(float)
    for b in BOTS:
        for k, vv in D[b]['S'].get(f'dvph|*|{ph}', {}).items(): s[k] += vv
        for k, vv in D[b]['S'].get('pwb', {}).items(): pb[k] += vv
    n = s['n'] or 1
    nd = ' / '.join(fl(L('both', 'ndv_ph', f'{k}|{ph}'), ci=False, n=False) for k in range(4))
    P(f"| P{ph} | {int(s['n']):,} | {s['got']/n:.0f} | {100*s['used']/n:.0f}% | {s['acts']/n:.2f} | {s['pwc']/n:.2f} | {pb[f'{ph}|pw_dv']/(pb[f'{ph}|nb_dv'] or 1):.2f} | {100*pb[f'{ph}|cap12']/(pb[f'{ph}|nb_dv'] or 1):.1f}% | {nd} |")
P('\n출전 디바인 수별 lift (전 페이즈, 철수 / 영희)')
for k in range(4): P(f"- {k}{'+' if k==3 else ''}명: {fl(L('chulsu','ndv',str(k)),n=True)} / {fl(L('younghee','ndv',str(k)),n=True)}")
# 신앙
P('\n신앙별 (두 봇, 디바인-전투)')
fa = defaultdict(float)
for b in BOTS:
    for k, vv in D[b]['S'].get('dvfaith', {}).items(): fa[k] += vv
for f in sorted({k.split('|')[0] for k in fa}):
    n = fa[f'{f}|n']; P(f"- {N.get('faiths', {}).get(f, f)}: {int(n):,}전 · 신성력 {fa[f'{f}|got']/n:.0f} · 사용률 {100*fa[f'{f}|used']/n:.0f}%")

# 권능 경제 (런 단위)
P('\n권능 경제 (런 단위 평균)')
P('| 항목 | 철수 | 영희 |'); P('|---|---|---|')
econ = {}
for b in BOTS:
    R = D[b]['runs']; n = len(R)
    own = [r for r in R if any(U.get(x, {}).get('tt') == 'divine' for x in r['final']) or r['dvd']]
    dep = [r for r in R if r['dvd']]
    src = Counter(); sp = Counter(); spn = Counter(); end = 0; pil = 0; pil_buy = 0; pil_enh = 0; pil_any = 0; pil_pw = 0
    pil_ph = Counter(); offer_ph = Counter(); pmap_ph = Counter(); pmap_n = Counter(); card_off = Counter(); card_buy = Counter(); rel_off = 0
    vow_off = Counter(); vow_pick = Counter(); vow_n = 0; vow_off_first = Counter()
    pw_ph_start = defaultdict(list)
    for r in R:
        x = r['dvx']
        for k, vv in x.get('src', {}).items(): src[k] += vv
        for k, (c, cost) in x.get('sp', {}).items(): sp[k] += cost; spn[k] += c
        end += x.get('end', 0)
        for p in x.get('pil', []):
            pil += 1; pil_ph[p[0]] += 1; pil_pw += p[2]
            bought = [c for c in p[4].split(',') if c]
            if bought or p[7]: pil_any += 1
            pil_buy += len(bought); pil_enh += 1 if p[7] else 0
            for c in p[3].split(','):
                if c: card_off[c] += 1
            for c in bought: card_buy[c] += 1
            rel_off += len([c for c in p[5].split(',') if c])
        for ph, has, ndv in x.get('pmap', []):
            pmap_n[ph] += 1; pmap_ph[ph] += has
        seen = set()
        for rt in r['route']:
            if 'pilgrim' in rt[1].split(',') and rt[0] not in seen: seen.add(rt[0]); offer_ph[rt[0]] += 1
        for v_ in x.get('vow', []):
            vow_n += 1
            for o in v_[4].split(','): vow_off[o] += 1
            for o in v_[3].split(','): vow_off_first[o] += 1
            vow_pick[v_[5]] += 1
        for ph, pw in r['pwph'].items(): pw_ph_start[int(ph)].append(pw)
    tot_src = sum(src.values()); tot_sp = sum(sp.values())
    econ[b] = dict(n=n, own=len(own), dep=len(dep), src={k: vv / n for k, vv in src.items()}, sp={k: vv / n for k, vv in sp.items()}, spn={k: vv / n for k, vv in spn.items()}, end=end / n,
                   pil=pil / n, pil_ph={k: vv / n for k, vv in pil_ph.items()}, offer_ph={k: vv / n for k, vv in offer_ph.items()}, pmap_ph={k: pmap_ph[k] / pmap_n[k] for k in pmap_n}, pmap_reach={k: pmap_n[k] for k in pmap_n},
                   pil_any=pil_any, pil_tot=pil, pil_buy=pil_buy, pil_enh=pil_enh, pil_pw=pil_pw / pil if pil else 0, card_off=dict(card_off), card_buy=dict(card_buy), rel_off=rel_off,
                   vow_n=vow_n, vow_off=dict(vow_off), vow_off_first=dict(vow_off_first), vow_pick=dict(vow_pick), pwStart={k: sum(vv) / len(vv) for k, vv in pw_ph_start.items()},
                   ownRunsEnd=sum(r['dvx'].get('end', 0) for r in own) / max(1, len(own)), srcOwn=sum(sum(v_ for k_, v_ in r['dvx'].get('src', {}).items() if not k_.startswith('neg:')) for r in dep) / max(1, len(dep)),
                   spOwn=sum(sum(c for _, c in r['dvx'].get('sp', {}).values()) for r in dep) / max(1, len(dep)), endDep=sum(r['dvx'].get('end', 0) for r in dep) / max(1, len(dep)))
for lab, f in [('디바인 보유 런 (최종 명단 또는 출전)', lambda e: f"{100*e['own']/e['n']:.1f}%"), ('디바인 출전 런', lambda e: f"{100*e['dep']/e['n']:.1f}%"),
               ('권능 획득 (전투 정산)', lambda e: f"{e['src'].get('battle',0):.1f}"), ('권능 획득 (사건)', lambda e: f"{e['src'].get('event',0):.2f}"),
               ('권능 획득 (그 밖)', lambda e: ', '.join(f"{k} {v:.2f}" for k, v in e['src'].items() if k not in ('battle', 'event') and not k.startswith('neg:')) or '0'),
               ('권능 사용 합', lambda e: f"{sum(e['sp'].values()):.1f}"),
               *([('— 축성 (봉헌 +, 회수)', lambda e: f"{e['sp'].get('cons',0):.1f} ({e['spn'].get('cons',0):.2f}회)"), ('— 성유물 구매', lambda e: f"{e['sp'].get('relic',0):.2f}"),
                  ('순례 제례 · 나눔 (판당 횟수, 무료)', lambda e: f"{e['spn'].get('rite',0):.2f} · {e['spn'].get('alms',0):.2f}")] if POST else
                 [('— 참배 카드', lambda e: f"{sum(v for k,v in e['sp'].items() if k not in ('relic','enh')):.1f}"), ('— 성유물 구매', lambda e: f"{e['sp'].get('relic',0):.2f}"), ('— 축성 (강화)', lambda e: f"{e['sp'].get('enh',0):.2f} ({e['spn'].get('enh',0):.3f}회)")]),
               ('— 개종', lambda e: f"{e['sp'].get('convert',0):.2f}"),
               ('끝날 때 남은 권능', lambda e: f"{e['end']:.1f}"), ('디바인 출전 런: 획득 · 사용 · 남음', lambda e: f"{e['srcOwn']:.1f} · {e['spOwn']:.1f} · {e['endDep']:.1f}"),
               ('순례 방문 (판당)', lambda e: f"{e['pil']:.2f}"), *([] if POST else [('순례에서 뭐라도 산 비율', lambda e: f"{100*e['pil_any']/max(1,e['pil_tot']):.0f}%")]), ('순례 들어갈 때 권능', lambda e: f"{e['pil_pw']:.1f}"),
               *([] if POST else [('순례당 산 카드 · 축성', lambda e: f"{e['pil_buy']/max(1,e['pil_tot']):.2f} · {e['pil_enh']/max(1,e['pil_tot']):.2f}"), ('서약 증강 선택 (판당)', lambda e: f"{e['vow_n']/e['n']:.2f}")])]:
    P(f"| {lab} | {f(econ['chulsu'])} | {f(econ['younghee'])} |")
P('\n순례 노드: 페이즈별 [항로에 있음 · 선택지로 보임 · 들어감] (판당 비율)')
P('| 페이즈 | 철수 항로 | 철수 선택지 | 철수 방문 | 영희 항로 | 영희 선택지 | 영희 방문 |'); P('|---|---|---|---|---|---|---|')
for ph in range(1, 6):
    cells = []
    for b in BOTS:
        e = econ[b]; reach = e['pmap_reach'].get(ph, 0)
        cells += [f"{100*e['pmap_ph'].get(ph,0):.0f}% (도달 {reach})", f"{100*e['offer_ph'].get(ph,0)*e['n']/max(1,reach):.0f}%", f"{100*e['pil_ph'].get(ph,0)*e['n']/max(1,reach):.0f}%"]
    P(f"| P{ph} | " + ' | '.join(cells) + ' |')
P('\n순례 카드 (제례 · 나눔, 제시 → 받음, 두 봇 합)' if POST else '\n참배 카드 (제시 → 구매, 두 봇 합)')
co = Counter(); cb = Counter()
for b in BOTS: co.update(econ[b]['card_off']); cb.update(econ[b]['card_buy'])
def card_name(c):
    if POST and c.startswith('rite:'): return '제례 — ' + N.get('faiths', {}).get(c[5:], c[5:])
    if POST and c == 'alms': return '나눔'
    return N['cards'].get(c, {}).get('name', c)
P('| 카드 | 제시 | 받음 | 받은 비율 | 철수 받음 | 영희 받음 |' if POST else '| 카드 | 권능 | 제시 | 구매 | 구매율 | 철수 구매 | 영희 구매 |'); P('|---|---|---|---|---|---|' + ('' if POST else '---|'))
for c, n in co.most_common():
    P(f"| {card_name(c)} `{c}` | " + ('' if POST else f"{N['cards'].get(c,{}).get('cost','')} | ") + f"{n} | {cb[c]} | {100*cb[c]/n:.0f}% | {econ['chulsu']['card_buy'].get(c,0)} | {econ['younghee']['card_buy'].get(c,0)} |")
P(f"- 성유물 제시 {sum(econ[b]['rel_off'] for b in BOTS)}개 · 구매 {sum(econ[b]['sp'].get('relic',0)*econ[b]['n'] for b in BOTS):.0f}")
if not POST: P('\n서약 증강 (제시 = 최종 선택지 기준, 처음 제시는 새로고침 전)')
if not POST: P('| 서약 | 처음 제시 | 최종 제시 | 고름 (철수 / 영희) | 고름 / 최종 제시 | 전투 lift 철수 | 영희 | 두 봇 | 런 lift (철수 / 영희) |'); P('|---|---|---|---|---|---|---|---|---|')
vows = {}
for vid, vn_ in N['vows'].items():
    of = sum(econ[b]['vow_off'].get(vid, 0) for b in BOTS); off1 = sum(econ[b]['vow_off_first'].get(vid, 0) for b in BOTS)
    pc = [econ[b]['vow_pick'].get(vid, 0) for b in BOTS]
    rc = runlift('chulsu', lambda r: any(vid in a for _, a in r['uaug'])); ry = runlift('younghee', lambda r: any(vid in a for _, a in r['uaug']))
    lc, ly, lb = L('chulsu', 'a', vid), L('younghee', 'a', vid), L('both', 'a', vid)
    P(f"| {vn_} `{vid}` | {off1} | {of} | {pc[0]} / {pc[1]} | {100*sum(pc)/max(1,of):.0f}% | {fl(lc,n=True)} | {fl(ly,n=True)} | {fl(lb)} | {frl(rc)} / {frl(ry)} |")
    vows[vid] = {'off1': off1, 'off': of, 'pick': pc, 'c': lc, 'y': ly, 'both': lb, 'runC': rc, 'runY': ry}
P('\n성유물 (r: 키 = 장착한 디바인-전투)')
P('| 성유물 | 주인 | 철수 | 영희 | 두 봇 |'); P('|---|---|---|---|---|')
rel = {}
for rid, rr in N['relics'].items():
    lc, ly, lb = L('chulsu', 'r', rid), L('younghee', 'r', rid), L('both', 'r', rid)
    if not (lc or ly): continue
    P(f"| {rr['name']} `{rid}` | {nm(rr['owner']) if rr['owner'] else '—'} | {fl(lc,n=True)} | {fl(ly,n=True)} | {fl(lb)} |"); rel[rid] = {'c': lc, 'y': ly, 'both': lb}
if POST:  # 개편 뒤: dv 여섯째 칸 = 봉헌 단계 (balance_acc.py 는 같은 칸을 dv_enh 로 묶는다)
    P('\n봉헌 단계별 디바인-전투 lift (같은 디바인끼리가 아니라 전체, 단계는 런이 길수록 높아 페이즈와 섞여 있다)')
    for b in ['chulsu', 'younghee', 'both']:
        P(f"- {BN.get(b,'두 봇')}: " + ' · '.join(f"{st}단계 {fl(L(b,'dv_enh_all',str(st)),n=True)}" for st in range(7) if L(b, 'dv_enh_all', str(st))))
else:
    P('\n축성 (다음 전투 ×3) 받은 전투 vs 아닌 전투 (같은 디바인)')
    for b in ['chulsu', 'younghee', 'both']:
        P(f"- {BN.get(b,'두 봇')}: 축성 {fl(L(b,'dv_enh_all','1'),n=True)} · 안 함 {fl(L(b,'dv_enh_all','0'),n=True)}")
P('\n신권 대행을 쓴 전투 vs 못 쓴 전투 (같은 디바인, 결과 편향 있음 — 참고)')
for u in DIVINE:
    a1, a0 = L('both', 'dv_act', f'{u}|1'), L('both', 'dv_act', f'{u}|0')
    if a1 or a0: P(f"- {nm(u)}: 씀 {fl(a1,n=True)} · 못 씀 {fl(a0,n=True)}")
summary['divine'] = {'units': dvs, 'econ': econ, 'vows': vows, 'relics': rel,
                     'phase': {}, 'enh': {b: {'1': L(b, 'dv_enh_all', '1'), '0': L(b, 'dv_enh_all', '0')} for b in ['chulsu', 'younghee', 'both']}}

# 초안 자동 봉헌 공식 대입 (추정): 전투마다 출전 디바인 2 + 권능 몫
def stage(x):
    n = 0
    while n < 6 and 12 * (n + 1) * (n + 2) / 2 <= x: n += 1
    return n
if not POST: P('\n[추정] 초안 자동 봉헌 공식 (출전 전투마다 2 + 그 기물 권능 몫) 을 이번 실측에 대입한 누계 · 단계 (단계 = 12 · 36 · 72 · 120 · 180 · 252)')
if not POST: P('| 기물 | 클리어 런 끝 누계 (철수 / 영희) | 단계 분포 0-1 / 2-3 / 4-5 / 6 (두 봇, 클리어 런) | P1 / P2 / P3 / P4 / P5 끝 평균 누계 (두 봇, 그 페이즈까지 출전) | 출전 전투 (클리어 런) |'); P('|---|---|---|---|---|')
offs = {}
for u in ([] if POST else DIVINE):
    fin_ = {b: [] for b in BOTS}; phv = defaultdict(list); nb = []
    for b in BOTS:
        for r in D[b]['runs']:
            o = r.get('off', {}).get(u)
            if not o: continue
            if r['cl']: fin_[b].append(max(o.values())); nb.append(r['offN'].get(u, 0))
            last = 0
            for ph in range(1, 6):
                if str(ph) in o: last = o[str(ph)]
                if r['ph'] > ph or (r['ph'] == ph and r['cl']) or r['ph'] >= 6:
                    if last: phv[ph].append(last)
    allf = fin_['chulsu'] + fin_['younghee']
    if not allf: continue
    st = Counter(stage(x) for x in allf); tot = len(allf)
    dist = ' / '.join(f"{100*sum(st[s] for s in g)/tot:.0f}%" for g in [(0, 1), (2, 3), (4, 5), (6,)])
    P(f"| {nm(u)} | {sum(fin_['chulsu'])/max(1,len(fin_['chulsu'])):.0f} ({len(fin_['chulsu'])}) / {sum(fin_['younghee'])/max(1,len(fin_['younghee'])):.0f} ({len(fin_['younghee'])}) | {dist} | " + ' / '.join(f"{sum(phv[p])/len(phv[p]):.0f}" if phv[p] else '—' for p in range(1, 6)) + f" | {sum(nb)/len(nb):.1f} |")
    offs[u] = {'finalC': fin_['chulsu'] and sum(fin_['chulsu']) / len(fin_['chulsu']), 'finalY': fin_['younghee'] and sum(fin_['younghee']) / len(fin_['younghee']), 'stage': dict(st), 'phase': {p: (sum(phv[p]) / len(phv[p]) if phv[p] else None) for p in range(1, 6)}}
summary['divine']['offerSim'] = offs
P('\n페이즈별 권능 획득 (판당, 그 페이즈에 들어간 런)')
for b in BOTS:
    R = D[b]['runs']
    P(f"- {BN[b]}: " + ' / '.join(f"P{p} {sum(r['pwp'].get(str(p), r['pwp'].get(p, 0)) for r in R if r['ph'] >= p)/max(1,sum(1 for r in R if r['ph'] >= p)):.1f}" for p in range(1, 6))
               + ' · 보유 권능 (페이즈 첫 전투 직전) ' + ' / '.join(f"{econ[b]['pwStart'].get(p,0):.1f}" for p in range(1, 6)))

# ───────── 6. 기물 전체
P('\n## 6. 기물 (두 봇 가중 전투 lift, 300전 이상)')
allu = []
for u in U:
    lb = L('both', 'u', u)
    if lb and lb['n'] >= 300: allu.append((lb['lift'], u, lb, L('chulsu', 'u', u), L('younghee', 'u', u)))
allu.sort(reverse=True)
old = {}
for b in BOTS:
    for x in V457['rep'][b]['unitLift']: old.setdefault(x[0], []).append((x[1], x[3]))
def oldw(u):
    xs = old.get(u, []); n = sum(x[1] for x in xs)
    return sum(x[0] * x[1] for x in xs) / n if n else None
P(f'| 순위 | 기물 | 유형 | 두 봇 lift | 철수 | 영희 | {PL} (가중) |'); P('|---|---|---|---|---|---|---|')
for i, (l, u, lb, lc, ly) in enumerate(allu):
    o = oldw(u)
    P(f"| {i+1} | {nm(u)} | {TT_KO[U[u]['tt']]} | {fl(lb,n=True)} | {fl(lc,ci=False)} | {fl(ly,ci=False)} | {o:+.1f} |" if o is not None else f"| {i+1} | {nm(u)} | {TT_KO[U[u]['tt']]} | {fl(lb,n=True)} | {fl(lc,ci=False)} | {fl(ly,ci=False)} | — |")
for b in BOTS:
    summary['rep'][b]['unitLift'] = sorted([[u, x['lift'], x['ci'], x['n'], x['win']] for u in U for x in [L(b, 'u', u)] if x], key=lambda z: -z[1])

# ───────── 7. 시너지
P('\n## 7. 시너지 (단계 lift, 두 봇 가중, 300전 이상)')
sy = []
keys = set()
for b in BOTS: keys |= set(D[b]['acc'].get('s', {}).keys())
for k in keys:
    lb = L('both', 's', k)
    if lb and lb['n'] >= 300: sy.append((lb['lift'], k, lb))
sy.sort(reverse=True)
def synname(k):
    sid, t = k.split('|'); return f"{N['syn'].get(sid,{}).get('name',sid)} {t}단"
oldsyn = {}
for b in BOTS:
    for x in V457['rep'][b]['synLift']: oldsyn.setdefault(x[0], []).append((x[1], x[3]))
def oldsw(k):
    xs = oldsyn.get(k, []); n = sum(x[1] for x in xs); return f"{sum(x[0]*x[1] for x in xs)/n:+.1f}" if n else '—'
P('- 시너지 상위: ' + ' · '.join(f"{synname(k)} **{x['lift']:+.1f}** ({x['n']:,}전, {PL} {oldsw(k)})" for _, k, x in sy[:12]))
P('- 시너지 하위: ' + ' · '.join(f"{synname(k)} {x['lift']:+.1f} ({x['n']:,}전, {PL} {oldsw(k)})" for _, k, x in sy[-10:][::-1]))
for b in BOTS:
    summary['rep'][b]['synLift'] = sorted([[k, x['lift'], x['ci'], x['n'], x['win']] for k in D[b]['acc'].get('s', {}) for x in [L(b, 's', k)] if x], key=lambda z: -z[1])
# 반사실
P('\n반사실 (그 시너지만 끈 재전투 승률 차, %p, 철수 / 영희, 표본 전투)')
cfr = []
for sid in N['syn']:
    cells = []
    for b in BOTS:
        c = D[b]['agg'].get('cf', {}).get(sid)
        cells.append((100 * (c['winFull'] - c['winWithout']) / c['n'], int(c['n'])) if c and c['n'] >= 30 else None)
    if any(cells): cfr.append((sum(x[0] for x in cells if x) / len([x for x in cells if x]), sid, cells))
cfr.sort(reverse=True)
P('- 반사실 상위: ' + ' · '.join(f"{N['syn'][s]['name']} " + ' / '.join(f"{c[0]:.1f}" if c else '—' for c in cells) for _, s, cells in cfr[:10]))
P('- 반사실 하위: ' + ' · '.join(f"{N['syn'][s]['name']} " + ' / '.join(f"{c[0]:.1f}" if c else '—' for c in cells) for _, s, cells in cfr[-8:]))

# ───────── 8. 장비 · 제련 · 잠재
P('\n## 8. 장비 · 제련 · 잠재능력 (두 봇 가중, 300전 이상)')
it = []
keys = set()
for b in BOTS: keys |= set(D[b]['acc'].get('i', {}).keys())
for k in keys:
    lb = L('both', 'i', k)
    if lb and lb['n'] >= 300: it.append((lb['lift'], k, lb))
it.sort(reverse=True)
P('- 장비 상위: ' + ' · '.join(f"{N['item'].get(k,{}).get('name',k)} `{k}` {x['lift']:+.1f} ({x['n']:,})" for _, k, x in it[:12]))
P('- 장비 하위: ' + ' · '.join(f"{N['item'].get(k,{}).get('name',k)} `{k}` {x['lift']:+.1f} ({x['n']:,})" for _, k, x in it[-10:][::-1]))
for b in BOTS:
    summary['rep'][b]['itemLift'] = sorted([[k, x['lift'], x['ci'], x['n'], x['win']] for k in D[b]['acc'].get('i', {}) for x in [L(b, 'i', k)] if x], key=lambda z: -z[1])
P('\n제련 lift (두 봇): ' + ' · '.join(f"{k} {fl(L('both','refine',k),n=True)}" for k in ['G+0', 'G+1', 'G+2', 'G+3', 'G+4', 'G+5', 'L+0', 'L+1', 'L+2']))
for b in BOTS:
    R = D[b]['S'].get('refine', {}); Pt = D[b]['S'].get('pot', {})
    P(f"- {BN[b]} 고급 평균 제련 P1–P5: " + ' / '.join(f"{R.get(f'{ph}|G|ref',0)/max(1,R.get(f'{ph}|G|n',0)):.2f} ({100*R.get(f'{ph}|G|r5',0)/max(1,R.get(f'{ph}|G|n',0)):.0f}% 5제련)" for ph in range(1, 6))
               + ' · 잠재 열림 ' + ' / '.join(f"{100*Pt.get(f'{ph}|open',0)/max(1,Pt.get(f'{ph}|n',0)):.0f}%" for ph in range(1, 6)))
    summary['rep'][b]['refineLift'] = {k: L(b, 'refine', k) for k in ['G+0', 'G+1', 'G+2', 'G+3', 'G+4', 'G+5']}
pt = []
keys = set()
for b in BOTS: keys |= set(D[b]['acc'].get('pot', {}).keys())
for k in keys:
    lb = L('both', 'pot', k)
    if lb and lb['n'] >= 500: pt.append((lb['lift'], k, lb))
pt.sort(reverse=True)
P('- 잠재능력 상위: ' + ' · '.join(f"{k} {x['lift']:+.1f}" for _, k, x in pt[:6]) + ' / 하위: ' + ' · '.join(f"{k} {x['lift']:+.1f}" for _, k, x in pt[-4:]))

# ───────── 9. 증강
P('\n## 9. 증강')
ag = []
keys = set()
for b in BOTS: keys |= set(D[b]['acc'].get('a', {}).keys())
for k in keys:
    lb = L('both', 'a', k)
    if lb and lb['n'] >= 300 and not k.startswith('vow.'): ag.append((lb['lift'], k, lb))
ag.sort(reverse=True)
an_ = lambda k: N['aug'].get(k, {}).get('name', k)
_SCH = {'pyro': '홍염', 'chrono': '시공', 'volt': '뇌전', 'wave': '파장', 'seed': '파종', 'mind': '정신', 'gold': '보화', 'illusion': '환조'}  # 사이오닉 전공 공용 증강 (owner = 전공 id, data/schools.ts)
ow = lambda k: (lambda o: nm(o) if o in U else f"{_SCH.get(o, o)} 전공")(N['aug'].get(k, {}).get('owner', ''))
P('- 기물 증강 상위 (300전): ' + ' · '.join(f"{ow(k)} · {an_(k)} {x['lift']:+.1f} ({x['n']:,})" for _, k, x in ag[:10]))
P('- 기물 증강 하위: ' + ' · '.join(f"{ow(k)} · {an_(k)} {x['lift']:+.1f} ({x['n']:,})" for _, k, x in ag[-10:][::-1]))
for b in BOTS:
    summary['rep'][b]['augLift'] = sorted([[k, x['lift'], x['ci'], x['n'], x['win']] for k in D[b]['acc'].get('a', {}) for x in [L(b, 'a', k)] if x and x['n'] >= 50], key=lambda z: -z[1])
gl_ = lambda k: N['glob'].get(k, {}).get('name', k)
for b in BOTS:
    R = D[b]['runs']; cnt = Counter(g for r in R for g in set(r['glob']))
    rows = []
    for g, c in cnt.items():
        if c < 30: continue
        x = runlift(b, lambda r: g in r['glob']); rows.append((x['d'], g, x))
    rows.sort(reverse=True)
    P(f"- {BN[b]} 전역 증강 (30판 이상) 상위: " + ' · '.join(f"{gl_(g)} {x['d']:+.1f} ({x['n']})" for _, g, x in rows[:6]) + ' / 하위: ' + ' · '.join(f"{gl_(g)} {x['d']:+.1f} ({x['n']})" for _, g, x in rows[-5:][::-1]))
    summary['rep'][b]['glob'] = [[gl_(g), x['n'], x['p1'], x['d']] for _, g, x in rows]
    cnt = Counter(g for r in R for g in set(r['desp']))
    rows = []
    for g, c in cnt.items():
        if c < 30: continue
        x = runlift(b, lambda r: g in r['desp']); rows.append((x['d'], g, x))
    rows.sort(reverse=True)
    dn = lambda k: N['desp'].get(k, {}).get('name', k)
    P(f"- {BN[b]} 절망 증강 상위: " + ' · '.join(f"{dn(g)} {x['d']:+.1f} ({x['n']})" for _, g, x in rows[:4]) + ' / 하위: ' + ' · '.join(f"{dn(g)} {x['d']:+.1f} ({x['n']})" for _, g, x in rows[-4:][::-1]))
    summary['rep'][b]['despair'] = [[dn(g), x['n'], x['p1'], x['d']] for _, g, x in rows]

# ───────── 10. 적 · 분대 · 성향
P('\n## 10. 적 · 분대 · 성향 (일반 · 역경, 전장 × 페이즈 × 노드 평균 대비)')
TEND_KO = {'charge': '돌격', 'sniper': '저격', 'assassin': '암살', 'escort': '호위형', 'disrupt': '교란형', 'pack': '무리형'}
VF = {b: V457['foe'][b] for b in BOTS}
v4 = lambda tab, k: ' / '.join(f"{100*VF[b][tab][k]['lift']:+.1f}" if k in VF[b][tab] else '—' for b in BOTS)
P(f'| 성향 | 철수 | 영희 | {PL} (철수 / 영희) |'); P('|---|---|---|---|')
for td in TEND_KO:
    P(f"| {TEND_KO[td]} | {fl(L('chulsu','tend',td),n=True)} | {fl(L('younghee','tend',td),n=True)} | {v4('tend', td)} |")
P(f'\n| 분대 | 철수 | 영희 | {PL} (철수 / 영희) |'); P('|---|---|---|---|')
keys = set()
for b in BOTS: keys |= set(D[b]['acc'].get('squad', {}).keys())
for q in sorted(keys, key=lambda q: -(L('both', 'squad', q) or {'n': 0})['n']):
    P(f"| {q} | {fl(L('chulsu','squad',q),n=True)} | {fl(L('younghee','squad',q),n=True)} | {v4('squad', q)} |")
P('\n전장 고유 기믹 적 39종 (+ 홀로그램) · 공용 기믹 적 12종')
P(f'| 적 | 전장 | 등장 전투 (두 봇) | 기수 | lift 철수 | 영희 | {PL} (철수 / 영희) | 처치율 (진 전투) | 쓰러진 시각 | 적 피해 몫 | 전투 시간 · 아군 사망 |'); P('|---|---|---|---|---|---|---|---|---|---|---|')
FF = 'sw_cargo sw_cyst sw_synapse cr_bats cr_valet cr_starved sp_aspis sp_peltast sp_agoge pt_crate pt_counsel pt_temp ws_rider ws_hyena ws_watch cf_mower cf_kids cf_shrine lv_ketzal lv_fumig lv_egg rd_guardian rd_phase rd_billboard rd_holo kr_mourner kr_papers kr_actor ol_cell ol_zealot ol_cleric cw_sweeper cw_cats cw_hunter hy_dealer hy_adjuster hy_robber bs_salt bs_jelly bs_sentry'.split()
fld_of = {}
for fid, f in N['fields'].items():
    for e in f['pool'] + [f['elite']] + f['bosses']: fld_of.setdefault(e, fid)
foes = {}
def foerow(e):
    s = defaultdict(float)
    for b in BOTS:
        for k, vv in D[b]['S'].get(f'foe|{e}', {}).items(): s[k] += vv
    return s
for e in FF + [k for k in EN if k.startswith('mx_')]:
    s = foerow(e)
    if not s.get('units'): continue
    lc, ly = L('chulsu', 'foe', e), L('younghee', 'foe', e)
    bt = s['battles'] or 1
    P(f"| {nm(e)} `{e}` | {N['fields'].get(fld_of.get(e,''),{}).get('name','공용') if not e.startswith('mx_') else '공용'} | {int(s['battles']):,} | {int(s['units']):,} | {fl(lc,ci=True)} | {fl(ly,ci=True)} | {v4('foe', e)} | {100*s['dead']/s['units']:.0f}% ({100*s['dead_l']/max(1,s['units_l']):.0f}%) | {s['dt']/max(1,s['dtn']):.1f}초 | {100*s['share']/s['units']:.0f}% | {s['sec']/bt:.1f}초 · {s['ad']/bt:.2f} |")
    foes[e] = {'battles': s['battles'], 'units': s['units'], 'c': lc, 'y': ly, 'kill': s['dead'] / s['units'], 'killLost': s['dead_l'] / max(1, s['units_l']), 'dt': s['dt'] / max(1, s['dtn']), 'share': s['share'] / s['units'], 'sec': s['sec'] / bt, 'ad': s['ad'] / bt}
P(f"- 전장 고유 적이 1기 이상 나온 전투: 철수 {fl(L('chulsu','ffoe_any','any'),n=True)} · 영희 {fl(L('younghee','ffoe_any','any'),n=True)}")
summary['foe'] = {'units': foes, 'tend': {b: {td: L(b, 'tend', td) for td in TEND_KO} for b in BOTS},
                  'squad': {b: {q: L(b, 'squad', q) for q in D[b]['acc'].get('squad', {})} for b in BOTS}}
# 모든 적 lift 상하위
fa_ = []
keys = set()
for b in BOTS: keys |= set(D[b]['acc'].get('foe', {}).keys())
for k in keys:
    lb = L('both', 'foe', k)
    if lb and lb['n'] >= 600 and k != 'kr_echo': fa_.append((lb['lift'], k, lb))  # 서사의 망령: 아군이 쓰러질 때 생기는 적 (결과라 뺀다)
fa_.sort()
P('- 적 lift 하위 (두 봇 600전 이상, 어려운 적): ' + ' · '.join(f"{nm(k)} {x['lift']:+.1f} ({x['n']:,})" for _, k, x in fa_[:12]))
P('- 적 lift 상위 (쉬운 적): ' + ' · '.join(f"{nm(k)} {x['lift']:+.1f} ({x['n']:,})" for _, k, x in fa_[-8:][::-1]))

# ───────── 11. 전장
P('\n## 11. 전장')
P(f'| 전장 | 철수 | 영희 | 두 봇 | {PL} (철수 / 영희 / 평균) | 일반 · 역경 승률 (두 봇) | 보스 승률 (두 봇) |'); P('|---|---|---|---|---|---|---|')
fv = {b: {x[0]: x for x in V457['rep'][b]['field']} for b in BOTS}
frows = []
for fid in N['fields']:
    cl = {}
    for b in BOTS:
        R = [r for r in D[b]['runs'] if r['field'] == fid]; cl[b] = (100 * sum(r['cl'] for r in R) / len(R) if R else 0, len(R))
    nb = defaultdict(float)
    for b in BOTS:
        S = D[b]['S']
        for ph in range(1, 6):
            for nd in ['battle', 'adversity', 'boss']:
                s = S.get(f'fpn|{fid}|{ph}|{nd}')
                if s: k_ = 'b' if nd == 'boss' else 'n'; nb[k_ + 'n'] += s['n']; nb[k_ + 'w'] += s['w']
    o = [fv[b][fid][1] if fid in fv[b] else None for b in BOTS]
    frows.append(((cl['chulsu'][0] + cl['younghee'][0]) / 2, fid, cl, o, nb))
frows.sort(reverse=True)
for avg, fid, cl, o, nb in frows:
    P(f"| {N['fields'][fid]['name']} | {cl['chulsu'][0]:.1f} ({cl['chulsu'][1]}) | {cl['younghee'][0]:.1f} ({cl['younghee'][1]}) | **{avg:.1f}** | {o[0]:.1f} / {o[1]:.1f} / {(o[0]+o[1])/2:.1f} | {100*nb['nw']/max(1,nb['nn']):.1f} | {100*nb['bw']/max(1,nb['bn']):.1f} |")
for b in BOTS:
    summary['rep'][b]['field'] = [[fid, cl[b][0], cl[b][1]] for _, fid, cl, _, _ in frows]

# ───────── 12. 경제 · 경로
P('\n## 12. 경제 · 경로 (판당)')
P(f'| 항목 | 철수 | 영희 | {PL} (철수 / 영희) |'); P('|---|---|---|---|')
ec = {}
for b in BOTS:
    R = D[b]['runs']; n = len(R)
    e = {'income': sum(r['eco']['inc'] for r in R) / n, 'interest': sum(r['eco']['i'] for r in R) / n, 'atCap': sum(r['eco']['atCap'] for r in R) / max(1, sum(r['eco']['nb'] for r in R)), 'end': sum(r['eco']['end'] for r in R) / n}
    sp = Counter()
    for r in R: sp.update(r['eco']['sp'])
    e['spend'] = {k: vv / n for k, vv in sp.items()}
    cr = defaultdict(lambda: [0, 0])
    for r in R:
        for ph, (s_, c_) in r['eco']['crAt'].items(): cr[ph][0] += s_; cr[ph][1] += c_
    e['crAt'] = {ph: v_[0] / v_[1] for ph, v_ in cr.items()}
    rt = Counter(x[3] if len(x) > 3 else x[2] for r in R for x in r['route'])
    e['route'] = {k: vv / n for k, vv in rt.items()}
    ec[b] = e; summary['rep'][b]['eco'] = e
ve = {b: V457['rep'][b]['eco'] for b in BOTS}
P(f"| 전투 정산 수입 | {ec['chulsu']['income']:.0f} | {ec['younghee']['income']:.0f} | {ve['chulsu']['income']:.0f} / {ve['younghee']['income']:.0f} |")
P(f"| 이자 | {ec['chulsu']['interest']:.0f} | {ec['younghee']['interest']:.0f} | {ve['chulsu']['interest']:.0f} / {ve['younghee']['interest']:.0f} |")
P(f"| 이자 상한 도달 전투 | {100*ec['chulsu']['atCap']:.0f}% | {100*ec['younghee']['atCap']:.0f}% | {100*ve['chulsu']['atCap']:.0f}% / {100*ve['younghee']['atCap']:.0f}% |")
for k in ['xp', 'fleet', 'muster', 'shop', 'event', 'invest', 'loan']:
    P(f"| 지출 {k} | {ec['chulsu']['spend'].get(k,0):.0f} | {ec['younghee']['spend'].get(k,0):.0f} | {ve['chulsu']['spend'].get(k,0):.0f} / {ve['younghee']['spend'].get(k,0):.0f} |")
P(f"| 전투 직전 크레딧 P1–P5 | " + ' / '.join(f"{ec['chulsu']['crAt'].get(str(p),0):.0f}" for p in range(1, 6)) + ' | ' + ' / '.join(f"{ec['younghee']['crAt'].get(str(p),0):.0f}" for p in range(1, 6)) + ' | |')
P('\n경로 (실제로 고른 노드, 판당): ' + ' / '.join(f"{BN[b]} " + ' · '.join(f"{k} {vv:.2f}" for k, vv in sorted(ec[b]['route'].items(), key=lambda z: -z[1])) for b in BOTS))

open(os.path.join(HERE, 'tables.md'), 'w').write('\n'.join(out_lines))
json.dump(summary, open(os.path.join(HERE, 'summary.json'), 'w'), ensure_ascii=False)
print('\n'.join(out_lines))
