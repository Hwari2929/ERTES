"""디바인 경제 · 전술 유형 집계 (2026-10-31 디바인 개편 뒤 보고서용, 표준 표는 balance_rep.py)

사용:
  python3 tests/balance_divine.py --names <names.json> --new <봇>= <조각 …> [<봇>= <조각 …>] \
      [--base <봇>= <조각 …> …] [--base-names <names.json>] [--base-mark <names.json>] [--json <out.json>]

- 조각 = `tests/balance.ts ... instr gearlog pool detail` 출력 (조각마다 runs 배열)
- names.json = `tests/balance_names.ts` 출력 ({units: {id: {name, tt, faith, relic …}}}).
  --base-names 는 기준 코드의 유형표, --base-mark 는 '이번 디바인' 표시를 기준 자료에 씌운 유형표 (같은 기물끼리 비교)
- lift = 출전 기물-전투 승률 − 같은 봇 · 페이즈 × 노드 평균, 95% CI 는 런 군집 (비율 추정량 분산)
- 시드 짝 비교: 같은 시드에서 기준만 클리어 · 이번만 클리어 수 → 차이 ± 1.96 · √(b + c − (c − b)²/N) / N
"""
import json, math, sys
from collections import defaultdict

TT = ('major', 'minor', 'psionic', 'divine')
TTN = {'major': '메이저', 'minor': '스페셜', 'psionic': '사이오닉', 'divine': '디바인'}
BOTN = {'chulsu': '철수', 'younghee': '영희'}


def parse(argv):
    o = {'new': {}, 'base': {}, 'names': None, 'bnames': None, 'bmark': None, 'json': None}
    cur = None
    for a in argv:
        if a in ('--new', '--base'): cur = a[2:]; continue
        if a == '--names': cur = 'names'; continue
        if a == '--base-names': cur = 'bnames'; continue
        if a == '--base-mark': cur = 'bmark'; continue
        if a == '--json': cur = 'json'; continue
        if cur in ('names', 'bnames', 'bmark', 'json'): o[cur] = a; cur = None; continue
        if cur in ('new', 'base'):
            if '=' in a:
                bot, f = a.split('=', 1); o['_bot'] = bot; o[cur].setdefault(bot, [])
                if f: o[cur][bot].append(f)
            else:
                o[cur].setdefault(o['_bot'], []).append(a)
    return o


def load(fs):
    runs = []
    for f in fs:
        d = json.load(open(f))
        runs += [r for r in d['runs'] if 'err' not in r]
    runs.sort(key=lambda r: r['seed'])
    return runs


class Acc:
    """런 군집 lift 누적: 키마다 [Σr, Σn, Σr², Σrn, Σn², 런 수] (r = 런 안의 Σ(승 − 기대), n = 기물-전투 수)"""
    def __init__(self): self.d = defaultdict(lambda: [0.0] * 6)
    def run(self, per):
        for key, (n, w, e) in per.items():
            if n <= 0: continue
            r = w - e; a = self.d[key]
            a[0] += r; a[1] += n; a[2] += r * r; a[3] += r * n; a[4] += n * n; a[5] += 1
    def merge(self, other):
        for k, v in other.d.items():
            a = self.d[k]
            for i in range(6): a[i] += v[i]
    def fin(self, key):
        a = self.d.get(key)
        if not a or a[1] <= 0: return None
        Sr, Sn, Srr, Srn, Snn, k = a
        L = Sr / Sn
        var = (k / (k - 1) if k > 1 else 1) * max(0.0, Srr - 2 * L * Srn + L * L * Snn) / (Sn * Sn)
        return 100 * L, 196 * math.sqrt(var), int(Sn), int(k)


def lifts(runs, U):
    """봇 하나의 런들 → 표별 Acc (tt · tt_ph · u · dvst · ndv · dvu_st)"""
    base = defaultdict(lambda: [0, 0])
    for r in runs:
        for t in r['trace']:
            k = (t['ph'], t['type']); base[k][0] += 1; base[k][1] += 1 if t['won'] else 0
    P = {k: v[1] / v[0] for k, v in base.items()}
    A = defaultdict(Acc)
    for r in runs:
        per = defaultdict(lambda: defaultdict(lambda: [0, 0, 0.0]))
        for t in r['trace']:
            ph, w = t['ph'], 1 if t['won'] else 0
            p = P[(ph, t['type'])]
            def add(tab, key):
                v = per[tab][key]; v[0] += 1; v[1] += w; v[2] += p
            for m in t['party']:
                tt = U.get(m['id'], {}).get('tt', '?')
                add('tt', tt); add('tt_ph', f'{tt}|{ph}'); add('u', m['id'])
            for d in t.get('dv', []):
                st = min(int(d[5]), 6)
                add('dvst', str(st)); add('dvst_ph', f'{ph}|{st}')
            add('ndv', str(min(len(t.get('dv', [])), 3)))
        for tab, d in per.items(): A[tab].run(d)
    return A


def pooled(As, tab):
    acc = Acc()
    for A in As: acc.merge(A[tab])
    return acc


def fmt(f, n=True):
    if not f: return '—'
    s = f'{f[0]:+.1f} ±{f[1]:.1f}'
    return s + (f' ({f[2]:,})' if n else '')


def wilson(k, n):
    if n == 0: return 0, 0
    p = k / n; z = 1.96; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return 100 * (c - h), 100 * (c + h)


def paired(runs, bruns):
    bm = {r['seed']: r['cleared'] for r in bruns}
    both = [r for r in runs if r['seed'] in bm]
    N = len(both)
    if not N: return None
    b = sum(1 for r in both if bm[r['seed']] and not r['cleared'])
    c = sum(1 for r in both if r['cleared'] and not bm[r['seed']])
    bc = sum(1 for r in both if bm[r['seed']])
    d = (c - b) / N
    se = math.sqrt(max(0.0, b + c - (c - b) ** 2 / N)) / N
    return {'N': N, 'base': 100 * bc / N, 'new': 100 * (bc + c - b) / N, 'diff': 100 * d, 'ci': 196 * se, 'b': b, 'c': c}


def econ(runs, U):
    """런 단위 디바인 경제 (dvx)"""
    e = defaultdict(float); cnt = defaultdict(int)
    og = defaultdict(float); og_runs = 0
    stage_end = defaultdict(int); stage_end_dep = defaultdict(int)
    ph_stage = defaultdict(lambda: [0, 0]); ph_pw = defaultdict(list); ph_cons = defaultdict(int)
    pil_ph = defaultdict(lambda: [0, 0, 0])  # 페이즈 → [도달 런, 항로에 있음, 방문]
    took = defaultdict(int); rite_n = []; pw_in = []; relic_offer = 0; conv_offer = 0; conv_buy = 0; relic_buy = 0
    cons_by_ph = defaultdict(int)
    have = dep = 0
    for r in runs:
        x = r['ins'].get('dvx') or {}
        ost = x.get('ost') or []
        has = any(len(o) > 2 for o in ost)
        deployed = any(t.get('dv') for t in r['trace'])
        have += has; dep += deployed
        src = x.get('src') or {}; sp = x.get('sp') or {}
        e['earn_battle'] += src.get('battle', 0); e['earn_event'] += src.get('event', 0)
        e['earn_other'] += sum(v for k, v in src.items() if k not in ('battle', 'event') and not k.startswith('neg:') and v > 0)
        for k in ('cons', 'relic', 'convert'):
            v = sp.get(k) or [0, 0]; e[f'sp_{k}_n'] += v[0]; e[f'sp_{k}'] += v[1]
        e['end'] += x.get('end', 0)
        if has:
            og_runs += 1
            for k, v in (x.get('og') or {}).items(): og[k] += v
            e['end_has'] += x.get('end', 0); e['cons_has'] += (sp.get('cons') or [0])[0]
            e['earn_has'] += src.get('battle', 0) + src.get('event', 0)
        # 페이즈 시작 단계 · 권능
        for o in ost[:-1]:
            if len(o) <= 2: continue
            ph_pw[o[0]].append(o[1])
            for s in o[2:]:
                _, st, pos = s.rsplit(':', 2)
                if pos == '1': ph_stage[o[0]][0] += 1; ph_stage[o[0]][1] += int(st)
        if ost and len(ost[-1]) > 2:
            for s in ost[-1][2:]:
                _, st, pos = s.rsplit(':', 2)
                stage_end[int(st)] += 1
                if pos == '1': stage_end_dep[int(st)] += 1
        reached = r['phase']
        pm = {p[0]: p[1] for p in x.get('pmap') or []}
        for p in x.get('pmap') or []:
            if p[2] > 0: pil_ph[p[0]][0] += 1; pil_ph[p[0]][1] += p[1]
        for p in x.get('pil') or []:
            pil_ph[p[0]][2] += 1
            tk = (p[4] or '-').split(':')[0]; took[tk] += 1
            if tk == 'rite': rite_n.append(p[11])
            pw_in.append(p[2])
            relic_offer += len([z for z in (p[5] or '').split(',') if z])
            relic_buy += len([z for z in (p[6] or '').split(',') if z])
            if p[12]: conv_offer += 1; conv_buy += int(p[12].split(':')[1])
    n = len(runs)
    return {
        'runs': n, 'have': 100 * have / n, 'dep': 100 * dep / n,
        'earn_battle': e['earn_battle'] / n, 'earn_event': e['earn_event'] / n, 'earn_other': e['earn_other'] / n,
        'sp_cons': e['sp_cons'] / n, 'sp_cons_n': e['sp_cons_n'] / n, 'sp_relic': e['sp_relic'] / n, 'sp_relic_n': e['sp_relic_n'] / n,
        'sp_convert': e['sp_convert'] / n, 'sp_convert_n': e['sp_convert_n'] / n, 'end': e['end'] / n,
        'has_runs': og_runs, 'end_has': e['end_has'] / max(1, og_runs), 'cons_has': e['cons_has'] / max(1, og_runs), 'earn_has': e['earn_has'] / max(1, og_runs),
        'og': {k: v / max(1, og_runs) for k, v in og.items()},
        'stage_end': dict(stage_end), 'stage_end_dep': dict(stage_end_dep),
        'ph_stage': {ph: v[1] / max(1, v[0]) for ph, v in sorted(ph_stage.items())},
        'ph_pw': {ph: sum(v) / len(v) for ph, v in sorted(ph_pw.items()) if v},
        'pil_ph': {ph: v for ph, v in sorted(pil_ph.items())},
        'pil_per_run': sum(took.values()) / n, 'took': dict(took), 'rite_n': sum(rite_n) / max(1, len(rite_n)),
        'pw_in': sum(pw_in) / max(1, len(pw_in)), 'relic_offer': relic_offer, 'relic_buy': relic_buy, 'conv_offer': conv_offer, 'conv_buy': conv_buy,
    }


def unit_extra(runs):
    """디바인 기물별: 출전 런 수 · 평균 단계 · 신권 대행 사용률 · 첫 사용 시각 · 신성력"""
    d = defaultdict(lambda: {'runs': set(), 'n': 0, 'st': 0, 'used': 0, 't1': 0.0, 't1n': 0, 'div': 0})
    for r in runs:
        for t in r['trace']:
            for v in t.get('dv', []):
                a = d[v[0]]; a['runs'].add(r['seed']); a['n'] += 1; a['st'] += v[5]; a['div'] += v[1]
                if v[2] > 0: a['used'] += 1
                if v[3] >= 0: a['t1'] += v[3]; a['t1n'] += 1
    return {k: {'runs': len(a['runs']), 'n': a['n'], 'st': a['st'] / max(1, a['n']), 'use': 100 * a['used'] / max(1, a['n']),
                't1': a['t1'] / max(1, a['t1n']), 'div': a['div'] / max(1, a['n'])} for k, a in d.items()}


def deploy_runs(runs, U):
    """기물별 출전 런 비율"""
    c = defaultdict(int)
    for r in runs:
        ids = {m['id'] for t in r['trace'] for m in t['party']}
        for i in ids: c[i] += 1
    return {k: 100 * v / len(runs) for k, v in c.items()}


def main():
    o = parse(sys.argv[1:])
    NM = json.load(open(o['names']))
    U = NM['units']
    for k, rid in (NM.get('defRelic') or {}).items():
        if k in U: U[k]['relicName'] = NM['relics'].get(rid, {}).get('name', rid)
    UB = json.load(open(o['bnames']))['units'] if o['bnames'] else U
    UM = json.load(open(o['bmark']))['units'] if o['bmark'] else UB
    bots = [b for b in ('chulsu', 'younghee') if b in o['new']]
    R = {b: load(o['new'][b]) for b in bots}
    B = {b: load(o['base'][b]) for b in bots if b in o['base']}
    LN = {b: lifts(R[b], U) for b in bots}
    LB = {b: lifts(B[b], UB) for b in B}
    LM = {b: lifts(B[b], UM) for b in B}
    out = {'bots': {}, 'units': {}, 'tt': {}, 'econ': {}}
    P = lambda *a: print(*a)

    P('### 요약')
    P('| 항목 | ' + ' | '.join(BOTN[b] for b in bots) + ' |')
    P('|---|' + '---|' * len(bots))
    row = []
    for b in bots:
        rs = R[b]; k = sum(r['cleared'] for r in rs); lo, hi = wilson(k, len(rs))
        row.append(f'**{100 * k / len(rs):.1f}%** ({lo:.1f}–{hi:.1f}, {len(rs):,}판)')
        out['bots'][b] = {'runs': len(rs), 'clear': 100 * k / len(rs), 'ci': [lo, hi], 'phase': sum(r['phase'] for r in rs) / len(rs)}
    P('| 클리어 (95% CI) | ' + ' | '.join(row) + ' |')
    if B:
        row = []
        for b in bots:
            pr = paired(R[b], B.get(b, []))
            out['bots'][b]['paired'] = pr
            row.append(f"{pr['base']:.1f}% → {pr['new']:.1f}% · **{pr['diff']:+.1f} ±{pr['ci']:.1f}%p** (기준만 {pr['b']} · 이번만 {pr['c']}, {pr['N']:,}판)" if pr else '—')
        P('| 같은 시드 짝 비교 (기준 → 이번) | ' + ' | '.join(row) + ' |')
    P('| 평균 도달 페이즈 | ' + ' | '.join(f"{out['bots'][b]['phase']:.2f}" + (f" (기준 {sum(r['phase'] for r in B[b]) / len(B[b]):.2f})" if b in B else '') for b in bots) + ' |')

    P('\n### 전술 유형 lift (기물-전투)')
    P('| 유형 | ' + ' | '.join(f'{BOTN[b]} 이번 | {BOTN[b]} 기준 (그때 유형) | {BOTN[b]} 기준 (이번 유형으로)' for b in bots) + ' | 두 봇 이번 | 두 봇 기준 (이번 유형으로) |')
    P('|---|' + '---|---|---|' * len(bots) + '---|---|')
    for tt in TT:
        cells = []
        for b in bots:
            cells += [fmt(LN[b]['tt'].fin(tt)), fmt(LB[b]['tt'].fin(tt)) if b in LB else '—', fmt(LM[b]['tt'].fin(tt)) if b in LM else '—']
        pn = pooled([LN[b] for b in bots], 'tt').fin(tt); pm = pooled([LM[b] for b in LM], 'tt').fin(tt) if LM else None
        out['tt'][tt] = {'new': {b: LN[b]['tt'].fin(tt) for b in bots}, 'base': {b: LB[b]['tt'].fin(tt) for b in LB}, 'base_mark': {b: LM[b]['tt'].fin(tt) for b in LM}, 'pooled': pn, 'pooled_base_mark': pm}
        P(f'| {TTN[tt]} | ' + ' | '.join(cells) + f' | **{fmt(pn)}** | {fmt(pm)} |')
    P('\n페이즈별 (두 봇 이번): ' + ' · '.join(f'{TTN[tt]} ' + ' '.join(f'P{ph} {pooled([LN[b] for b in bots], "tt_ph").fin(f"{tt}|{ph}")[0]:+.1f}' for ph in range(1, 6) if pooled([LN[b] for b in bots], 'tt_ph').fin(f'{tt}|{ph}')) for tt in TT))

    UX = {b: unit_extra(R[b]) for b in bots}
    DR = {b: deploy_runs(R[b], U) for b in bots}
    DRB = {b: deploy_runs(B[b], UB) for b in B}
    P('\n### 디바인 기물별')
    P('| 기물 | 신앙 | 성유물 | ' + ' | '.join(f'{BOTN[b]} lift' for b in bots) + ' | 두 봇 | 기준 두 봇 | 변화 | 출전 런 % (' + ' / '.join(BOTN[b] for b in bots) + ') | 평균 봉헌 단계 | 신권 대행 사용률 | 첫 사용 (초) |')
    P('|---|---|---|' + '---|' * len(bots) + '---|---|---|---|---|---|---|')
    dvs = [k for k, v in U.items() if v['tt'] == 'divine']
    rows = []
    for k in dvs:
        pn = pooled([LN[b] for b in bots], 'u').fin(k)
        if not pn: continue
        pb = pooled([LM[b] for b in LM], 'u').fin(k) if LM else None
        n_all = sum(UX[b].get(k, {}).get('n', 0) for b in bots) or 1
        st = sum(UX[b].get(k, {}).get('st', 0) * UX[b].get(k, {}).get('n', 0) for b in bots) / n_all
        use = sum(UX[b].get(k, {}).get('use', 0) * UX[b].get(k, {}).get('n', 0) for b in bots) / n_all
        t1 = sum(UX[b].get(k, {}).get('t1', 0) * UX[b].get(k, {}).get('n', 0) for b in bots) / n_all
        rows.append((pn[0], k, pn, pb, st, use, t1))
    for _, k, pn, pb, st, use, t1 in sorted(rows, reverse=True):
        u = U[k]; conv = UB.get(k, {}).get('tt') == 'minor'
        out['units'][k] = {'name': u['name'], 'new': {b: LN[b]['u'].fin(k) for b in bots}, 'pooled': pn, 'base_pooled': pb, 'stage': st, 'use': use, 't1': t1,
                           'dep': {b: DR[b].get(k, 0) for b in bots}, 'dep_base': {b: DRB[b].get(k, 0) for b in DRB}, 'converted': conv}
        P(f"| {u['name']}{' ★' if conv else ''} | {u.get('faith', '-')} | {u.get('relicName', u.get('relic', '-'))} | " + ' | '.join(fmt(LN[b]['u'].fin(k)) for b in bots)
          + f" | **{fmt(pn, False)}** | {fmt(pb, False)} | {(pn[0] - pb[0]) if pb else 0:+.1f} | " + ' / '.join(f'{DR[b].get(k, 0):.1f}' for b in bots)
          + f' | {st:.2f} | {use:.0f}% | {t1:.1f} |')
    P('★ = 2026-10-31 스페셜에서 옮긴 5명 (기준 lift 는 스페셜일 때)')

    P('\n### 남은 스페셜 · 사이오닉')
    for tt in ('minor', 'psionic'):
        ks = [k for k, v in U.items() if v['tt'] == tt]
        rs = sorted(((pooled([LN[b] for b in bots], 'u').fin(k), k) for k in ks), key=lambda z: -(z[0] or (-99,))[0])
        P(f'- {TTN[tt]}: ' + ' · '.join(f"{U[k]['name']} {f[0]:+.1f} ±{f[1]:.1f} (기준 {fmt(pooled([LM[b] for b in LM], 'u').fin(k), False) if LM else '—'})" for f, k in rs if f))
        for f, k in rs:
            if f: out['units'][k] = {'name': U[k]['name'], 'pooled': f, 'base_pooled': pooled([LM[b] for b in LM], 'u').fin(k) if LM else None, 'tt': tt}

    P('\n### 봉헌 단계 · 출전 디바인 수')
    st_acc = pooled([LN[b] for b in bots], 'dvst')
    P('| 봉헌 단계 | ' + ' | '.join(str(s) for s in range(7)) + ' |')
    P('|---|' + '---|' * 7)
    P('| 디바인-전투 lift (두 봇) | ' + ' | '.join(fmt(st_acc.fin(str(s))) for s in range(7)) + ' |')
    nd = pooled([LN[b] for b in bots], 'ndv'); ndb = pooled([LM[b] for b in LM], 'ndv') if LM else None
    P('\n출전 디바인 수별 전투 lift (두 봇, 그 전투에 출전한 기물 전원 기준): ' + ' · '.join(f"{s}{'+' if s == 3 else ''}명 {fmt(nd.fin(str(s)))} (기준 {fmt(ndb.fin(str(s)), False) if ndb else '—'})" for s in range(4)))
    out['stage_lift'] = {s: st_acc.fin(str(s)) for s in range(7)}

    E = {b: econ(R[b], U) for b in bots}
    out['econ'] = E
    P('\n### 권능 · 봉헌 경제 (런 단위 평균)')
    P('| 항목 | ' + ' | '.join(BOTN[b] for b in bots) + ' |')
    P('|---|' + '---|' * len(bots))
    rowsE = [
        ('디바인 보유 런 · 출전 런', lambda e: f"{e['have']:.1f}% · {e['dep']:.1f}%"),
        ('권능 획득: 전투 정산 · 사건', lambda e: f"{e['earn_battle']:.1f} · {e['earn_event']:.2f}"),
        ('권능 사용: 축성 (회수)', lambda e: f"{e['sp_cons']:.1f} ({e['sp_cons_n']:.2f}회)"),
        ('권능 사용: 성유물 구매 · 개종', lambda e: f"{e['sp_relic']:.1f} ({e['sp_relic_n']:.2f}회) · {e['sp_convert']:.1f} ({e['sp_convert_n']:.2f}회)"),
        ('끝날 때 남은 권능', lambda e: f"{e['end']:.1f}"),
        ('디바인 보유 런: 획득 · 축성 회수 · 남음', lambda e: f"{e['earn_has']:.1f} · {e['cons_has']:.2f} · {e['end_has']:.1f}"),
        ('봉헌 출처 (디바인 보유 런, 기물 합)', lambda e: ' · '.join(f"{ {'auto': '자동', 'cons': '축성', 'rite': '제례', 'join': '합류 시작값'}.get(k, k)} {v:.0f} ({100 * v / max(1, sum(e['og'].values())):.0f}%)" for k, v in sorted(e['og'].items(), key=lambda z: -z[1]))),
        ('순례 방문 (판당) · 제례 / 나눔', lambda e: f"{e['pil_per_run']:.2f} · {e['took'].get('rite', 0)} / {e['took'].get('alms', 0)}"),
        ('제례 대상 디바인 (평균) · 들어갈 때 권능', lambda e: f"{e['rite_n']:.2f} · {e['pw_in']:.1f}"),
        ('진열장 성유물 제시 → 구매 · 개종 제시 → 구매', lambda e: f"{e['relic_offer']} → {e['relic_buy']} · {e['conv_offer']} → {e['conv_buy']}"),
        ('페이즈 시작 출전 디바인 평균 단계', lambda e: ' · '.join(f'P{ph} {v:.2f}' for ph, v in e['ph_stage'].items())),
        ('페이즈 시작 권능 (디바인 보유 런)', lambda e: ' · '.join(f'P{ph} {v:.1f}' for ph, v in e['ph_pw'].items())),
    ]
    for name, f in rowsE: P(f'| {name} | ' + ' | '.join(f(E[b]) for b in bots) + ' |')
    P('\n런 끝 봉헌 단계 분포 (보유 디바인 전원 / 출전 중 디바인)')
    P('| 단계 | ' + ' | '.join(str(s) for s in range(7)) + ' |')
    P('|---|' + '---|' * 7)
    for b in bots:
        for key, nm in (('stage_end', '보유'), ('stage_end_dep', '출전')):
            d = E[b][key]; tot = sum(d.values()) or 1
            P(f'| {BOTN[b]} {nm} | ' + ' | '.join(f"{100 * d.get(s, 0) / tot:.0f}%" for s in range(7)) + ' |')
    P('\n순례 노드: 페이즈별 [디바인 보유 도달 런 · 항로에 있음 · 방문]')
    P('| 페이즈 | ' + ' | '.join(f'{BOTN[b]}' for b in bots) + ' |')
    P('|---|' + '---|' * len(bots))
    for ph in range(1, 6):
        P(f'| P{ph} | ' + ' | '.join((lambda v: f'{v[0]:,} · {100 * v[1] / max(1, v[0]):.0f}% · {100 * v[2] / max(1, v[0]):.0f}%')(E[b]['pil_ph'].get(ph, [0, 0, 0])) for b in bots) + ' |')
    if o['json']:
        json.dump(out, open(o['json'], 'w'), ensure_ascii=False, indent=1, default=lambda z: list(z) if isinstance(z, (set, tuple)) else str(z))


if __name__ == '__main__':
    main()
