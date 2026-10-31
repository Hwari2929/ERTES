"""밸런스 조각 집계 1단계 (v471 보고서 docs/BALANCE_2026_10_31_v471.md 에서 처음 씀): balance.ts 조각 (`instr gearlog detail`) → 봇별 군집 누적값.
사용: python3 tests/balance_acc.py <bot> <조각 폴더> [작업 폴더]
  - 조각 폴더의 <bot>_*.json 을 읽는다 (node bal.cjs <시드> 125 0.06 7 bot=<bot> instr gearlog pool detail > <bot>_<시드>.json)
  - 작업 폴더 (기본: 조각 폴더의 부모)에 names.json (tests/balance_names.ts 출력)이 있어야 하고, acc_<bot>.json 을 쓴다
  - 다음 단계: python3 tests/balance_rep.py <작업 폴더> [직전 보고 원자료 json]
lift (전투) = 그 요소가 있는 (기물-)전투 승률 − 같은 페이즈 × 노드 평균. 적 · 분대 · 성향은 전장 × 페이즈 × 노드 평균을 뺀다.
오차 = 런 군집 비율 추정량 표준오차 (같은 런의 전투를 한 묶음). 누적값 [Σr, Σn, Σr², Σrn, Σn², 런 수, Σ승] 을 남겨 두 봇을 더할 수 있게 한다."""
import json, glob, os, sys, math, re
from collections import defaultdict

BOT = sys.argv[1]
PARTS = sys.argv[2]
HERE = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.abspath(PARTS))
FILES = sorted(glob.glob(os.path.join(PARTS, f'{BOT}_*.json')))
N = json.load(open(os.path.join(HERE, 'names.json')))
U = N['units']
TT = {k: v['tt'] for k, v in U.items()}
CT = {k: v['ct'] for k, v in U.items()}
EN = N['enemy']
NODES = ['battle', 'adversity', 'challenge', 'boss']
MINOR_GROUP = {}
for x in ['gunnir', 'demiurgos', 'ingel', 'zahara', 'jaehwon']: MINOR_GROUP[x] = 'toDivine'
for x in ['vivian', 'bill', 'orca', 'eden']: MINOR_GROUP[x] = 'toPsionic'
for x in ['chloe', 'west', 'rasmus', 'sigmund', 'u404', 'petrock']: MINOR_GROUP[x] = 'toMajor'
FIELD_FOES = set('sw_cargo sw_cyst sw_synapse cr_bats cr_valet cr_starved sp_aspis sp_peltast sp_agoge pt_crate pt_counsel pt_temp ws_rider ws_hyena ws_watch cf_mower cf_kids cf_shrine lv_ketzal lv_fumig lv_egg rd_guardian rd_phase rd_billboard rd_holo kr_mourner kr_papers kr_actor ol_cell ol_zealot ol_cleric cw_sweeper cw_cats cw_hunter hy_dealer hy_adjuster hy_robber bs_salt bs_jelly bs_sentry'.split())


def rb(r):  # 등급 묶음
    return '1-3' if r <= 3 else '4-6' if r <= 6 else '7-9' if r <= 9 else '10-12' if r <= 12 else '13-15' if r <= 15 else '16+'


def runs_iter():
    for f in FILES:
        d = json.load(open(f))
        yield d['agg'], d['runs']


# ───────── 1차: 기준 승률 (페이즈 × 노드, 전장 × 페이즈 × 노드)
base = defaultdict(lambda: [0, 0]); fbase = defaultdict(lambda: [0, 0])
for agg, runs in runs_iter():
    for r in runs:
        if 'err' in r: continue
        for t in r['trace']:
            k = (t['ph'], t['type']); base[k][0] += 1; base[k][1] += t['won']
            k2 = (r['field'], t['ph'], t['type']); fbase[k2][0] += 1; fbase[k2][1] += t['won']
P = {k: v[1] / v[0] for k, v in base.items()}
PF = {k: v[1] / v[0] for k, v in fbase.items()}


# ───────── 군집 누적: key → [Sr, Sn, Srr, Srn, Snn, k, Sw]
class Acc:
    def __init__(self): self.d = defaultdict(lambda: [0.0] * 7)
    def run(self, per):  # per: key → [n, w, e] (그 런의 합)
        for key, (n, w, e) in per.items():
            if n <= 0: continue
            r = w - e; a = self.d[key]
            a[0] += r; a[1] += n; a[2] += r * r; a[3] += r * n; a[4] += n * n; a[5] += 1; a[6] += w
    def dump(self): return {k if isinstance(k, str) else '§'.join(map(str, k)): v for k, v in self.d.items()}


def fin(a):
    Sr, Sn, Srr, Srn, Snn, k, Sw = a
    if Sn <= 0: return None
    L = Sr / Sn
    var = (k / (k - 1) if k > 1 else 1) * max(0.0, Srr - 2 * L * Srn + L * L * Snn) / (Sn * Sn)
    return {'lift': 100 * L, 'ci': 196 * math.sqrt(var), 'n': int(Sn), 'runs': int(k), 'win': 100 * Sw / Sn}


ACC = defaultdict(Acc)   # 이름 → Acc
runlev = []               # 런 단위 요약
S = defaultdict(lambda: defaultdict(float))  # 단순 합계 표
agg_sum = {}


def addagg(agg):
    for tname, tab in agg.items():
        T = agg_sum.setdefault(tname, {})
        for k, vals in tab.items():
            a = T.setdefault(k, {})
            for f, v in vals.items(): a[f] = a.get(f, 0) + v


def pk():  # key → [n, w, e]
    return defaultdict(lambda: [0, 0, 0.0])


errs = []; capped = 0
for agg, runs in runs_iter():
    addagg(agg)
    for r in runs:
        if 'err' in r: errs.append([r['seed'], r['err'][:200]]); continue
        ins = r['ins']; tr = r['trace']
        if ins.get('capped'): capped += 1
        per = defaultdict(pk)  # 표 이름 → key → [n,w,e]
        def put(tab, key, w, e, n=1):
            v = per[tab][key]; v[0] += n; v[1] += w; v[2] += e
        # det 기반 (기물 · 증강 · 장비 · 시너지 · 성유물)
        merged = defaultdict(lambda: [0, 0, 0.0])
        for key, (n, w) in r['det'].items():
            body, pn = key.rsplit('|', 1)
            ph, node = pn.split(':'); ph = int(ph)
            e = n * P[(ph, node)]
            kind, rest = body.split(':', 1)
            if kind == 'ua': continue
            if kind == 'i': rest = re.split(r'[+#]', rest)[0]  # 장비 기본 id (제련 · 잠재능력 떼기)
            for tab, kk in [(kind, rest), (kind + '_ph', f'{rest}|{ph}'), (kind + '_pn', f'{rest}|{ph}|{node}')]:
                v = per[tab][kk]; v[0] += n; v[1] += w; v[2] += e
        # trace 기반
        gl = r.get('gl') or []
        for bi, t in enumerate(tr):
            ph, node, w = t['ph'], t['type'], 1 if t['won'] else 0
            p = P[(ph, node)]; pf = PF[(r['field'], ph, node)]
            party = t['party']
            for m in party:
                tt = TT.get(m['id'], '?'); ct = CT.get(m['id'], '?')
                put('tt', tt, w, p); put('tt_ph', f'{tt}|{ph}', w, p); put('ct', ct, w, p)
                put('ttrk', f'{tt}|{rb(m["rank"])}', w, p)
                S['rk'][f'{tt}|{ph}|n'] += 1; S['rk'][f'{tt}|{ph}|s'] += m['rank']
                if tt == 'minor':
                    g = MINOR_GROUP.get(m['id'], '?'); put('mgrp', g, w, p); put('mgrp_ph', f'{g}|{ph}', w, p)
                    put('mrk', f'{m["id"]}|{rb(m["rank"])}', w, p)
            # 스페셜 대성공 (자연 실험): 같은 등급 묶음 안에서 대성공 0 / 1+
            for mid, rk, gr, pp in t.get('mn', []):
                put('mgreat', f'{rb(rk)}|{min(gr, 2)}', w, p); put('mgreat_all', f'{min(gr, 1)}', w, p)
                put('mgreat_u', f'{mid}|{min(gr, 1)}', w, p)
                S['mpp'][f'{rb(rk)}|n'] += 1; S['mpp'][f'{rb(rk)}|pp'] += pp; S['mpp'][f'{rb(rk)}|gr'] += gr
            # 디바인
            for (did, got, acts, t1, rel, enh, faith, pwc, alive, dmg, rk) in t.get('dv', []):
                put('dv_enh', f'{did}|{enh}', w, p); put('dv_enh_all', str(enh), w, p)
                put('dv_act', f'{did}|{1 if acts else 0}', w, p)
                s = S[f'dv|{did}']; s['n'] += 1; s['got'] += got; s['acts'] += acts; s['used'] += 1 if acts else 0; s['pwc'] += pwc; s['enh'] += enh; s['alive'] += alive; s['w'] += w
                if t1 >= 0: s['t1'] += t1; s['t1n'] += 1
                if got >= 200: s['cap'] += 1
                s2 = S[f'dvph|{did}|{ph}']; s2['n'] += 1; s2['got'] += got; s2['used'] += 1 if acts else 0; s2['pwc'] += pwc
                s3 = S[f'dvph|*|{ph}']; s3['n'] += 1; s3['got'] += got; s3['used'] += 1 if acts else 0; s3['pwc'] += pwc; s3['acts'] += acts
                S['dvfaith'][f'{faith}|n'] += 1; S['dvfaith'][f'{faith}|used'] += 1 if acts else 0; S['dvfaith'][f'{faith}|got'] += got
            ndv = len(t.get('dv', []))
            S['pwb'][f'{ph}|n'] += 1; S['pwb'][f'{ph}|pw'] += t.get('pw', 0); S['pwb'][f'{ph}|ndv'] += ndv
            if ndv: S['pwb'][f'{ph}|nb_dv'] += 1; S['pwb'][f'{ph}|pw_dv'] += t.get('pw', 0)
            if t.get('pw', 0) >= 12: S['pwb'][f'{ph}|cap12'] += 1
            put('ndv', f'{min(ndv, 3)}', w, p); put('ndv_ph', f'{min(ndv, 3)}|{ph}', w, p)
            # 적 (일반 · 역경, 처음부터 있던 적)
            if node in ('battle', 'adversity'):
                ids = {z[0] for z in t.get('fz', []) if not z[4]}
                for eid in ids:
                    put('foe', eid, w, pf)
                tends = {EN.get(e, {}).get('tend', '') for e in ids if e != 'kr_echo'}  # 서사의 망령 (아군이 쓰러지면 생김) 은 성향 집계에서 뺀다
                for td in tends:
                    if td: put('tend', td, w, pf)
                for q in set(t.get('sq', [])): put('squad', q.rstrip('+'), w, pf)
                if any(e in FIELD_FOES for e in ids): put('ffoe_any', 'any', w, pf)
                tot = sum(z[2] for z in t.get('fz', [])) or 1
                for z in t.get('fz', []):
                    eid = z[0]
                    if eid not in FIELD_FOES and not eid.startswith('mx_'): continue
                    s = S[f'foe|{eid}']; s['units'] += 1; s['dead'] += 1 - z[1]; s['dmg'] += z[2]; s['share'] += z[2] / tot
                    if not w: s['units_l'] += 1; s['dead_l'] += 1 - z[1]
                    if z[3] >= 0: s['dt'] += z[3]; s['dtn'] += 1
                    if z[4]: s['summ'] += 1
                for eid in ids:
                    s = S[f'foe|{eid}']; s['battles'] += 1; s['sec'] += t['sec']; s['ad'] += t.get('ad', 0); s['w'] += w
            # 페이즈 × 노드
            s = S[f'pn|{ph}|{node}']; s['n'] += 1; s['w'] += w; s['sec'] += t['sec']; s['foes'] += t['foes']; s['alive'] += t['alive']; s['nparty'] += len(party)
            s['rank'] += (sum(m['rank'] for m in party) / len(party)) if party else 0
            s['ad'] += t.get('ad', 0)
            s = S[f'fpn|{r["field"]}|{ph}|{node}']; s['n'] += 1; s['w'] += w
            # 제련 · 잠재능력 (gearlog, 같은 순서)
            if bi < len(gl):
                for it in gl[bi][3]:
                    m = re.match(r'^([A-Z])_[^+#]*(?:\+(\d))?(?:#(.*))?$', it)
                    if not m: continue
                    tier, ref, pot = m.group(1), m.group(2), m.group(3)
                    if tier in ('G', 'L'): put('refine', f'{tier}+{ref or 0}', w, p); S['refine'][f'{ph}|{tier}|n'] += 1; S['refine'][f'{ph}|{tier}|ref'] += int(ref or 0); S['refine'][f'{ph}|{tier}|r5'] += 1 if ref == '5' else 0
                    if tier in ('A', 'L'):
                        S['pot'][f'{ph}|n'] += 1; S['pot'][f'{ph}|open'] += 1 if pot else 0
                        if pot:
                            for q in pot.split('.'): put('pot', q, w, p)
        for tab, d in per.items(): ACC[tab].run(d)
        # 런 단위
        dvx = ins.get('dvx', {})
        last = tr[-1] if tr else None
        fail = None
        if not r['cleared'] and last is not None: fail = f'P{last["ph"]} {last["type"]}'
        firstboss = {}
        for ph, bid, bw in ins.get('boss', []):
            if ph not in firstboss: firstboss[ph] = bw
        dvd = set(m[0] for t in tr for m in t.get('dv', []))
        # 초안 자동 봉헌 공식 대입 (추정): 전투마다 출전 디바인마다 2 + 그 기물 권능 몫 → 페이즈 끝 누계 · 페이즈별 권능 획득
        off = {}; pwp = defaultdict(int); dvb = defaultdict(int)
        for t in tr:
            pwp[t['ph']] += t.get('pw', 0)
            for m in t.get('dv', []):
                o = off.setdefault(m[0], [0, {}]); o[0] += 2 + m[7]; o[1][str(t['ph'])] = o[0]; dvb[m[0]] += 1
        runlev.append({'off': {k: v[1] for k, v in off.items()}, 'offN': dict(dvb), 'pwp': dict(pwp),'seed': r['seed'], 'cl': 1 if r['cleared'] else 0, 'ph': r['phase'], 'nb': r['battles'], 'hp': r['hp'], 'field': r['field'], 'fail': fail,
                       'used': r['used'], 'final': r['final'], 'desp': r['despairs'], 'glob': ins.get('glob', []), 'fb': firstboss,
                       'uaug': ins.get('uaug', []), 'eco': r['eco'], 'ms': ins.get('ms', 0), 'dvx': dvx, 'dvd': sorted(dvd),
                       'route': [x for x in ins.get('route', [])], 'buy': ins.get('buy', []),
                       'pwph': {str(t['ph']): t['pw0'] for t in reversed(tr)},
                       'mx': max([m['rank'] for t in tr for m in t['party']] or [0])})

out = {'bot': BOT, 'files': len(FILES), 'errs': errs, 'capped': capped, 'P': {f'{a}|{b}': v for (a, b), v in P.items()}, 'Pn': {f'{a}|{b}': base[(a, b)][0] for (a, b) in base},
       'acc': {k: v.dump() for k, v in ACC.items()}, 'S': {k: dict(v) for k, v in S.items()}, 'runs': runlev, 'agg': {k: agg_sum[k] for k in ('cf', 'cf_t', 'tt', 'ct', 'unit', 'relic', 'offer', 'death', 'node', 'phase', 'cons') if k in agg_sum}}
json.dump(out, open(os.path.join(HERE, f'acc_{BOT}.json'), 'w'), ensure_ascii=False)
print(BOT, 'files', len(FILES), 'runs', len(runlev), 'errs', len(errs), 'capped', capped)
