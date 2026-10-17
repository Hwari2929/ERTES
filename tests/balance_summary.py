# 밸런스 보고서(docs/BALANCE_REPORT.md)용 집계: 신뢰구간 포함 시너지 · 기물 · 장비 · 유형 표와 고위험 조합 승률.
# 입력
#   <parts 디렉터리>  balance.cjs <시작> <런 수> 0.06 0 detail 출력 (part*.json)
#   <meta.json>       balance_meta.ts 출력 (장비 id 목록을 인자로)
#   <report_data.json> balance_report.py 출력 (기물 기여 지수 등)
#   <hr.json>         buildsim.cjs comps ... 위험 8 출력 (고위험 후반)
#   <turret.json>     buildsim.cjs comps turret_comps.json ... 위험 8 출력 (포탑 장비 비교, 없으면 '-')
#   <출력.json>
#   선택 (2026-10-17 판에서 추가, 여러 번 줄 수 있음):
#   --diff=<이름>=<parts 디렉터리>   balance.cjs <시작> <런 수> 0 <위험 등급> [oath=…] 출력 → 난이도별 요약 (예: --diff=쉬움=d3)
#   --fac=<이름>=<parts 디렉터리>    balance.cjs … chr 또는 fac=<세력> 출력 → 세력 우선 봇 (청라 인과 단계 분포)
#   --pool=<parts 디렉터리>          balance.cjs … pool 출력 → 계약 기물 후보(우세 시너지 보장) 봇, 같은 시드의 전체 런과 비교
#   --hrnoadd=<hr.json>              BS_NOADD=1 buildsim.cjs comps … 출력 (적 증원 끔) → 고위험 조합 증원 효과
#   --prev=<이전 balance_report.json> 이전 보고서 대비 변화
# 오차: 전투 단위 지표는 런 단위 군집 표준오차(비율 추정량), 런 단위 비율은 윌슨 95% 구간.
import json, sys, glob, math, collections, re

parts_dir, meta_p, rd_p, hr_p, tur_p, out_p = sys.argv[1:7]
OPT = collections.defaultdict(list)
for a in sys.argv[7:]:
    k, v = a[2:].split('=', 1); OPT[k].append(v)
M = json.load(open(meta_p))
RD = json.load(open(rd_p))
def load_parts(dir_):
    agg, runs = collections.defaultdict(dict), []
    for p in sorted(glob.glob(f'{dir_}/part*.json')):
        d = json.load(open(p))
        runs += d['runs']
        for t, rows in d['agg'].items():
            for k, v in rows.items():
                a = agg[t].setdefault(k, {})
                for f, x in v.items(): a[f] = a.get(f, 0) + x
    for r in runs: r['phase'] = min(r['phase'], 6)  # 의뢰 성공 뒤 7페이즈로 넘어간 값은 6으로 (도달 기준)
    return agg, runs
agg, runs = load_parts(parts_dir)
N = len(runs)
CLEAR = sum(r['cleared'] for r in runs) / N
Z = 1.96

def wilson(k, n):
    if not n: return None
    p = k / n; d = 1 + Z * Z / n
    c = (p + Z * Z / (2 * n)) / d; h = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / d
    return [round(c - h, 4), round(c + h, 4)]

# 기준 승률: (페이즈, 노드 유형)
base = {}
for k, v in agg['node'].items():
    p, t = k.split('|'); base[(int(p), t)] = v['wins'] / v['n']

EARLY, MID, LATE = {1, 2}, {3, 4}, {5, 6}
def stage_of(p): return 'early' if p in EARLY else 'mid' if p in MID else 'late'

# det: 런마다 `키|페이즈:노드` → [전투, 승리]
def parse(k):
    key, pn = k.rsplit('|', 1)
    p, t = pn.split(':')
    return key, int(p), t

# 런 단위 누적: acc[key][stage] = list of per-run (n, wins, expWins, expLoss)
def collect(match):
    """match(key) -> group 이름 또는 None. 반환: group -> stage -> [(n, w, e) per run]"""
    out = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in runs:
        loc = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0.0]))
        for k, (n, w) in r.get('det', {}).items():
            key, p, t = parse(k)
            g = match(key)
            if g is None: continue
            b = base.get((p, t))
            if b is None: continue
            for gg in (g if isinstance(g, list) else [g]):
                for st in (stage_of(p), 'all'):
                    a = loc[gg][st]; a[0] += n; a[1] += w; a[2] += n * b
                if t == 'boss':
                    a = loc[gg]['boss']; a[0] += n; a[1] += w; a[2] += n * b
        for g, sts in loc.items():
            for st, a in sts.items(): out[g][st].append(tuple(a))
    return out

def stat(lst):
    """lift(승률 - 기대) · 패배율 배수(실제 패배 / 기대 패배) 와 군집 표준오차"""
    n = sum(x[0] for x in lst)
    if not n: return None
    w = sum(x[1] for x in lst); e = sum(x[2] for x in lst)
    lift = (w - e) / n
    se = math.sqrt(sum(((x[1] - x[2]) - lift * x[0]) ** 2 for x in lst)) / n
    el = n - e; lo = n - w
    lr = lo / el if el > 0 else None
    lse = math.sqrt(sum(((x[0] - x[1]) - lr * (x[0] - x[2])) ** 2 for x in lst)) / el if el > 0 else None
    return {'n': n, 'runs': len(lst), 'win': w / n, 'lift': lift, 'liftCI': Z * se, 'lossRatio': lr, 'lossRatioCI': None if lse is None else Z * lse}

def stats_for(groups):
    return {g: {st: stat(v) for st, v in sts.items()} for g, sts in groups.items()}

R4 = lambda x: None if x is None else round(x, 4)
def clean(o):
    if isinstance(o, float): return round(o, 4)
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    return o

# ───────── 고위험 후반 조합 (buildsim, 위험 8 · 5~6페이즈 역경 + 보스)
def comp_rows(path):
    if path == '-': return []
    res = []
    for c in json.load(open(path)):
        late = [x for x in c['rows'] if x['ph'] in (5, 6) and x['t'] in ('adversity', 'boss')]
        boss = [x for x in late if x['t'] == 'boss']
        k = sum(x['w'] for x in late)
        res.append({'id': c['id'], 'syn': c.get('syn', {}), 'n': len(late), 'win': k / len(late) if late else None, 'ci': wilson(k, len(late)),
                    'bossN': len(boss), 'bossWin': sum(x['w'] for x in boss) / len(boss) if boss else None,
                    'dur': sum(x['dur'] for x in late) / max(1, len(late)), 'hpLeft': sum(x['hpLeft'] for x in late) / max(1, len(late)),
                    'per': {u: sum(x['per'].get(u, 0) for x in late) / max(1, len(late)) for u in {u for x in late for u in x['per']}}})
    return res
HR = comp_rows(hr_p)
TUR = comp_rows(tur_p)

# ───────── 1. 시너지
syn_groups = stats_for(collect(lambda k: [k[2:], k[2:].split('|')[0]] if k.startswith('s:') else None))
syn_ph = agg['syn_ph']
synergies = []
for sid, info in M['syn'].items():
    tiers = info['tiers']
    # 주력 단계: 4~6페이즈 전투 수가 가장 많은 단계
    late_n = collections.Counter()
    for k, v in syn_ph.items():
        s2, t, p = k.split('|')
        if s2 == sid and int(p) >= 4: late_n[int(t)] += v['n']
    main = late_n.most_common(1)[0][0] if late_n else None
    tier_rows = []
    for ti in range(1, len(tiers) + 1):
        g = syn_groups.get(f'{sid}|{ti}')
        reached = [r for r in runs if r['synMax'].get(sid, 0) >= ti]
        k = sum(r['cleared'] for r in reached)
        tier_rows.append({'tier': ti, 'count': tiers[ti - 1], 'runsReached': len(reached), 'reachRate': len(reached) / N,
                          'clearIfReached': k / len(reached) if reached else None, 'clearCI': wilson(k, len(reached)),
                          'all': g.get('all') if g else None, 'early': g.get('early') if g else None, 'late': g.get('late') if g else None, 'boss': g.get('boss') if g else None})
    pooled = syn_groups.get(sid, {})
    # 대표 조합: 조합 id 에 시너지 이름이 들어간 것 (그 시너지를 노린 조합). 없으면 그 시너지가 2단계 이상인 조합
    alias = {'VOYAGE': ['VOY'], 'HUNTER': ['HUNTER', 'HUNT'], 'ENG': ['ENG', 'TURRET']}.get(sid, [sid])
    # 민감도 조합(H_CHR7_S1 · H_CHR7_S10: 무휼 인과 단계를 1 · 10으로 고정)은 대표 조합에서 뺀다
    HRr = [c for c in HR if not re.search(r'_S\d+$', c['id'])]
    hr = [c for c in HRr if c['syn'].get(sid, [0, 0])[1] >= 1 and any(x in c['id'].split('_', 1)[1] for x in alias)] or [c for c in HRr if c['syn'].get(sid, [0, 0])[1] >= 2]
    hr = sorted(hr, key=lambda c: -(c['win'] or 0))
    cf = RD and next((x for x in RD['syns'] if x['id'] == sid), {}).get('cf')
    synergies.append({'id': sid, 'name': info['name'], 'kind': info['kind'], 'tiers': tiers, 'mainTier': main,
                      'mainCount': tiers[main - 1] if main else None, 'byTier': tier_rows,
                      'pooled': pooled, 'cf': cf,
                      'hr': [{'id': c['id'], 'tier': c['syn'][sid][1], 'count': c['syn'][sid][0], 'n': c['n'], 'win': c['win'], 'ci': c['ci'], 'bossWin': c['bossWin']} for c in hr]})

def classify(s):
    """초반(P1~2) · 후반(P5~6, 보스 포함) 패배율 배수(1.0 = 같은 페이즈 · 노드 평균)와 고위험 조합 승률로 분류.
    강함 = 95% 구간 상한 < 1.0 (후반은 고위험 대표 조합 최고 승률 ≥ 30% 도 강함으로 본다)
    약함 = 점추정 ≥ 1.0 (후반은 고위험 대표 조합 최고 승률 < 20% 일 때만)"""
    e, l = s['pooled'].get('early'), s['pooled'].get('late')
    if not e or not l or e['n'] < 300 or l['n'] < 150: return '보류(표본 부족)', {}
    hr = max((c['win'] for c in s['hr']), default=None)
    es = e['lossRatio'] + e['lossRatioCI'] < 1.0
    ls = l['lossRatio'] + l['lossRatioCI'] < 1.0 or (hr is not None and hr >= 0.30)
    # 약세: 초반 · 후반 모두 평균 이하(점추정 ≥ 1.0), 또는 어느 한쪽이 유의하게 평균 이하(구간 하한 > 1.0), 또는 후반 ≥ 1.0 이면서 고위험 최고 < 10%
    sig_bad = e['lossRatio'] - e['lossRatioCI'] > 1.0 or l['lossRatio'] - l['lossRatioCI'] > 1.0
    ew = (e['lossRatio'] >= 1.0 and l['lossRatio'] >= 1.0) or sig_bad
    lw = ew or (l['lossRatio'] >= 1.0 and (hr is None or hr < 0.10))
    why = {'earlyLR': e['lossRatio'], 'earlyCI': e['lossRatioCI'], 'lateLR': l['lossRatio'], 'lateCI': l['lossRatioCI'], 'hrBest': hr,
           'earlyStrong': es, 'lateStrong': ls, 'earlyWeak': ew, 'lateWeak': lw}
    if es and ls: c = '꾸준형'
    elif es: c = '초반형'
    elif ls: c = '후반형'
    elif ew or lw: c = '약세'
    else: c = '평균권'
    return c, why
for s in synergies:
    s['class'], s['classWhy'] = classify(s)
# 종합 순위: 전체 런 lift(전 단계 합산) 백분위와 고위험 대표 조합 최고 승률 백분위의 평균 (고위험 조합이 없으면 lift 만)
DUMMY_SYN = ('KING', 'SANGUN', 'EXPLORER', 'RFRIEND')  # 기물 한 명짜리 표식 특성 (공왕 · 산군 · 탐험가 · 당신의 친구): 순위 · 분류에서 뺀다
synergies = [s for s in synergies if s['id'] not in DUMMY_SYN]
ranked = [s for s in synergies if s['pooled'].get('all') and s['pooled']['all']['n'] >= 1000]
def pct(vals, v): return sum(1 for x in vals if x < v) / max(1, len(vals) - 1)
lifts = [s['pooled']['all']['lift'] for s in ranked]
hrs = [max(c['win'] for c in s['hr']) for s in ranked if s['hr']]
for s in ranked:
    a1 = pct(lifts, s['pooled']['all']['lift'])
    a2 = pct(hrs, max(c['win'] for c in s['hr'])) if s['hr'] else None
    s['score'] = a1 if a2 is None else (a1 + a2) / 2
    s['scoreParts'] = {'liftPct': a1, 'hrPct': a2}

# ───────── 2. 기물
unit_groups = stats_for(collect(lambda k: k[2:] if k.startswith('u:') else None))
rd_units = {u['id']: u for u in RD['units']}
starter = collections.defaultdict(lambda: [0, 0])
for r in runs:
    for s in r['starters']: starter[s][0] += r['cleared']; starter[s][1] += 1
final = collections.defaultdict(lambda: [0, 0])
for r in runs:
    for u in set(r['final']): final[u][0] += r['cleared']; final[u][1] += 1
held = collections.defaultdict(lambda: [0, 0])
for r in runs:
    for u in set(r['used']): held[u][0] += r['cleared']; held[u][1] += 1
units = []
for uid, info in M['units'].items():
    g = unit_groups.get(uid, {})
    ru = rd_units.get(uid, {})
    st, fi, he = starter.get(uid, [0, 0]), final.get(uid, [0, 0]), held.get(uid, [0, 0])
    units.append({'id': uid, 'name': info['name'], 'ct': info['ct'], 'tt': info['tt'], 'syn': info['syn'], 'acq': 'event' if info.get('eventOnly') else 'starter' if info['starter'] else 'recruit',
                  'baseSum': sum(info.get('base', {}).values()), 'range': info.get('range'), 'skill': info.get('skill'),
                  'all': g.get('all'), 'early': g.get('early'), 'late': g.get('late'), 'boss': g.get('boss'),
                  'startN': st[1], 'startClear': st[0] / st[1] if st[1] else None, 'startCI': wilson(*st),
                  'usedN': he[1], 'usedClear': he[0] / he[1] if he[1] else None,
                  'finalN': fi[1], 'finalClear': fi[0] / fi[1] if fi[1] else None, 'finalCI': wilson(*fi),
                  'iDmg': ru.get('iDmg'), 'iHeal': ru.get('iHeal'), 'iShield': ru.get('iShield'), 'iTaken': ru.get('iTaken'), 'iEvaded': ru.get('iEvaded'),
                  'share': ru.get('share'), 'tshare': ru.get('tshare'), 'death': ru.get('death'), 'kills': ru.get('kills'), 'pickRate': ru.get('pickRate'), 'avgRank': ru.get('rank')})
# 역할(전투 유형) 정규화: 같은 전투 유형 평균 대비
for ct in {u['ct'] for u in units}:
    grp = [u for u in units if u['ct'] == ct and u['all']]
    n = sum(u['all']['n'] for u in grp)
    ml = sum(u['all']['lift'] * u['all']['n'] for u in grp) / n
    def wavg(f):
        xs = [(u[f], u['all']['n']) for u in grp if u[f] is not None]
        return sum(a * b for a, b in xs) / sum(b for _, b in xs) if xs else None
    md, mh, ms, mt = wavg('iDmg'), wavg('iHeal'), wavg('iShield'), wavg('iTaken')
    for u in grp:
        u['liftVsRole'] = u['all']['lift'] - ml
        u['dmgVsRole'] = u['iDmg'] / md if md and u['iDmg'] is not None else None
        u['takenVsRole'] = u['iTaken'] / mt if mt and u['iTaken'] is not None else None
        u['supVsRole'] = ((u['iHeal'] or 0) + (u['iShield'] or 0)) / ((mh or 0) + (ms or 0)) if (mh or ms) else None
# 종합 점수: 출전 lift(군집 표본 가중) + 시작 기물 클리어 차이 (무작위 배정이라 인과에 가까움)
for u in units:
    if not u['all']: u['score'] = None; continue
    s1 = u['all']['lift'] / max(u['all']['liftCI'] / Z, 1e-6)  # z
    s2 = ((u['startClear'] - CLEAR) / math.sqrt(CLEAR * (1 - CLEAR) / u['startN'])) if u['startN'] else 0
    u['z'] = {'deploy': s1, 'starter': s2}
    u['score'] = (s1 + s2) / 2

# ───────── 3. 장비
item_groups = stats_for(collect(lambda k: k[2:] if k.startswith('i:') else None))
# 기물 보정 lift: 같은 기물 · 같은 페이즈 승률 대비
unit_base = {}
for k, v in agg['unit_ph'].items():
    u, p = k.split('|'); unit_base[(u, int(p))] = v['wins'] / v['n']
ui = collections.defaultdict(lambda: [0, 0, 0.0])
for k, v in agg['unit_item_ph'].items():
    u, it, p = k.split('|')
    o = ui[it]; o[0] += v['wins']; o[1] += v['n']; o[2] += v['n'] * unit_base.get((u, int(p)), 0)
MAJ = {'vit': '생명', 'pow': '전투', 'mnd': '기술', 'def': '방어', 'agi': '민첩'}
def role_of(it):
    if it[:2] in ('A_', 'L_') and it.count('_') == 2:
        a, b = it[2:].split('_')
        s = {a, b}
        if s <= {'vit', 'def'}: return '생존'
        if s <= {'pow', 'agi'}: return '화력'
        if 'mnd' in s and s <= {'mnd', 'agi', 'pow'}: return '기술 · 치명'
        return '혼합'
    return '-'
def cat_of(it):
    c = it[0]
    if it[2:] in ('helanchor', 'hellight', 'helrelic'): return '동맹 전용'
    return {'C': '재료', 'G': '고급', 'A': '희귀', 'L': '전설', 'U': '고유', 'M': '문장', 'O': '신비 부품', 'K': '소모품', 'T': '포탑'}.get(c, '?')
items = []
for it, a in agg['item'].items():
    g = item_groups.get(it, {})
    w, n, e = ui.get(it, [0, 0, 0])
    nm = M['items'].get(it, {}).get('name', it)
    items.append({'id': it, 'name': nm, 'cat': cat_of(it), 'role': role_of(it), 'n': a['n'], 'win': a['wins'] / a['n'],
                  'all': g.get('all'), 'early': g.get('early'), 'late': g.get('late'),
                  'unitAdjLift': (w - e) / n if n else None, 'share': a['share'] / a['n'], 'death': a['died'] / a['n']})
cat_sum = collections.defaultdict(lambda: [0, 0.0, 0.0])
for x in items:
    if not x['all']: continue
    c = cat_sum[x['cat']]; c[0] += x['n']; c[1] += x['n'] * x['all']['lift']; c[2] += x['n'] * (x['unitAdjLift'] or 0)
cats = [{'cat': k, 'n': v[0], 'lift': v[1] / v[0], 'unitAdjLift': v[2] / v[0]} for k, v in cat_sum.items()]
role_sum = collections.defaultdict(lambda: [0, 0.0, 0.0])
for x in items:
    if x['role'] == '-' or not x['all']: continue
    c = role_sum[(x['cat'], x['role'])]; c[0] += x['n']; c[1] += x['n'] * x['all']['lift']; c[2] += x['n'] * (x['unitAdjLift'] or 0)
roles = [{'cat': k[0], 'role': k[1], 'n': v[0], 'lift': v[1] / v[0], 'unitAdjLift': v[2] / v[0]} for k, v in role_sum.items()]
turret = [{'id': c['id'], 'n': c['n'], 'win': c['win'], 'ci': c['ci'], 'bossWin': c['bossWin'], 'dur': c['dur']} for c in TUR]

# ───────── 4. 유형
def by_type(field):
    names = M['ct'] if field == 'ct' else M['tt']
    g = stats_for(collect(lambda k: (lambda d: d[field] if d else None)(M['units'].get(k[2:])) if k.startswith('u:') else None))
    rows = []
    src = RD['ctypes'] if field == 'ct' else RD['ttypes']
    for t in src:
        st = collections.defaultdict(lambda: [0, 0])
        for u in units:
            if u[field] == t['id'] and u['startN']: st['x'][0] += u['startClear'] * u['startN']; st['x'][1] += u['startN']
        k, n = st['x']
        rows.append({'id': t['id'], 'name': names.get(t['id'], t['id']), 'units': sum(1 for u in units if u[field] == t['id']),
                     'all': g.get(t['id'], {}).get('all'), 'early': g.get(t['id'], {}).get('early'), 'late': g.get(t['id'], {}).get('late'), 'boss': g.get(t['id'], {}).get('boss'),
                     'share': t['share'], 'tshare': t['tshare'], 'death': t['death'], 'iDmg': t['iDmg'], 'iHeal': t['iHeal'], 'iShield': t['iShield'], 'iTaken': t['iTaken'],
                     'startN': n, 'startClear': k / n if n else None, 'startCI': wilson(round(k), n)})
    return rows
ctypes, ttypes = by_type('ct'), by_type('tt')
combo = RD['combo']
# 고위험: 유형 몰빵 조합
hr_type = [c for c in HR if c['id'] in ('H_PSI7', 'H_PSI_SEC', 'H_DIV7', 'H_DIV_SIR', 'H_MARK_PAN', 'H_TURRET')]

# ───────── 5. 증강 (런 단위 군집 lift, 공명 증강 · 학파 · 전공 · 스페셜. 사건 증강 ev.* 제외)
aug_groups = stats_for(collect(lambda k: k[2:] if k.startswith('a:') else None))
augs = []
for aid, g in aug_groups.items():
    info = M.get('augs', {}).get(aid, {'name': aid, 'src': '?', 'owner': ''})
    augs.append({'id': aid, 'name': info['name'], 'src': info['src'], 'owner': info.get('owner', ''), 'all': g.get('all'), 'early': g.get('early'), 'late': g.get('late'), 'boss': g.get('boss')})
aug_src = collections.defaultdict(lambda: [0, 0.0, 0])
for a in augs:
    if not a['all']: continue
    o = aug_src[a['src'] if a['src'] in ('메이저', '스페셜', '사이오닉', '학파', '전용', '공용') else '시너지']; o[0] += a['all']['n']; o[1] += a['all']['n'] * a['all']['lift']; o[2] += 1
aug_src = [{'src': k, 'n': v[0], 'lift': v[1] / v[0], 'kinds': v[2]} for k, v in aug_src.items()]

# ───────── 6. 경제 (run.rep 전투 기록: 이자 · 상한 · 정산 수입, 지출 종류별, 페이즈별 전투 직전 보유 크레딧)
def econ(rs):
    rs = [r for r in rs if r.get('eco')]
    if not rs: return None
    nb = sum(r['eco']['nb'] for r in rs) or 1
    cr = collections.defaultdict(lambda: [0, 0])
    for r in rs:
        for p, (sm, n) in r['eco']['crAt'].items(): c = cr[int(p)]; c[0] += sm; c[1] += n
    sp = collections.Counter()
    for r in rs: sp.update(r['eco']['sp'])
    return {'runs': len(rs), 'battles': nb, 'interestPerBattle': sum(r['eco']['i'] for r in rs) / nb, 'capPerBattle': sum(r['eco']['cap'] for r in rs) / nb,
            'atCapRate': sum(r['eco']['atCap'] for r in rs) / nb, 'incomePerBattle': sum(r['eco']['inc'] for r in rs) / nb,
            'creditsAtBattle': {p: v[0] / v[1] for p, v in sorted(cr.items()) if v[1]},
            'spendPerRun': {k: v / len(rs) for k, v in sp.most_common()}, 'endCredits': sum(r['eco']['end'] for r in rs) / len(rs),
            'loanRuns': sum(1 for r in rs if r['eco'].get('loan', 0) > 0) / len(rs)}
economy = {'all': econ(runs), 'cleared': econ([r for r in runs if r['cleared']]), 'failed': econ([r for r in runs if not r['cleared']])}

# ───────── 7. 난이도별 요약 (봇 기준)
def run_summary(agg2, runs2):
    n = len(runs2)
    if not n: return None
    k = sum(r['cleared'] for r in runs2)
    ph2 = {}
    for p, a in sorted(agg2.get('phase', {}).items(), key=lambda x: int(x[0])):
        if int(p) > 6: continue
        ph2[int(p)] = {'battles': a['battles'], 'win': a['wins'] / a['battles']}
    boss = {}
    for kk, v in agg2.get('node', {}).items():
        p, t = kk.split('|')
        if t == 'boss' and int(p) <= 6: boss[int(p)] = {'n': v['n'], 'win': v['wins'] / v['n']}
    reach = {p: sum(1 for r in runs2 if r['phase'] >= p) / n for p in range(1, 7)}
    deaths = collections.Counter()
    for kk, v in agg2.get('death', {}).items(): deaths[int(kk.split('|')[0])] += v['n']
    return {'runs': n, 'clear': k / n, 'clearCI': wilson(k, n), 'avgPhase': sum(r['phase'] for r in runs2) / n, 'reach': reach,
            'phaseWin': ph2, 'bossWin': dict(sorted(boss.items())), 'deathPhase': {p: deaths[p] / n for p in sorted(deaths)},
            'heat': sum(r.get('heat', 0) for r in runs2) / n, 'despairs': sum(len(r.get('despairs', [])) for r in runs2) / n,
            'econ': econ(runs2)}
difficulty = [{'name': '표준 (위험 0)', 'dir': parts_dir, **run_summary(agg, runs)}]
for spec in OPT['diff']:
    name, d = spec.split('=', 1)
    a2, r2 = load_parts(d)
    difficulty.append({'name': name, 'dir': d, **run_summary(a2, r2)})

# ───────── 1-5. 세력 우선 봇 (청라공국: 무휼 인과 단계)
def fac_summary(name, d):
    a2, r2 = load_parts(d)
    base_s = run_summary(a2, r2)
    fid = 'CHR' if name.startswith('청라') else None
    out2 = {'name': name, 'dir': d, **base_s}
    sid = next((x for x in M['syn'] if M['syn'][x]['name'] == name), fid)
    if sid:
        tiers = collections.Counter(r['synMax'].get(sid, 0) for r in r2)
        out2['synId'] = sid
        out2['maxTier'] = {t: tiers[t] / len(r2) for t in sorted(tiers)}
        out2['clearByTier'] = {t: (lambda rs: {'n': len(rs), 'clear': sum(x['cleared'] for x in rs) / len(rs), 'ci': wilson(sum(x['cleared'] for x in rs), len(rs))} if rs else None)([x for x in r2 if x['synMax'].get(sid, 0) == t]) for t in sorted(tiers)}
    if any(r.get('causal') for r in r2):
        def kings(rs):
            c = collections.Counter(r['king'] for r in rs)
            return {'n': len(rs), 'dist': {k: c[k] / len(rs) for k in sorted(c)}, 'mean': sum(r['king'] for r in rs) / len(rs) if rs else None,
                    'meanCausal': sum(r['causal'] for r in rs) / len(rs) if rs else None}
        t3 = [r for r in r2 if r['synMax'].get('CHR', 0) >= 3]
        out2['king'] = {'tier3': kings(t3), 'tier3cleared': kings([r for r in t3 if r['cleared']]), 'tier2only': kings([r for r in r2 if r['synMax'].get('CHR', 0) == 2]), 'all': kings([r for r in r2 if r['synMax'].get('CHR', 0) >= 1])}
        # 페이즈 첫 전투 직전 인과율 (청라 3단계 도달 런, 그 페이즈 청라 단계별 중앙값)
        cz = collections.defaultdict(list)
        for r in t3:
            for p, (pts, t) in r.get('cz', {}).items(): cz[int(p)].append(pts)
        med = lambda xs: sorted(xs)[len(xs) // 2] if xs else None
        out2['causalAtPhase'] = {p: {'n': len(v), 'median': med(v), 'mean': sum(v) / len(v)} for p, v in sorted(cz.items())}
    return out2
factions = [fac_summary(*spec.split('=', 1)) for spec in OPT['fac']]

# 계약 기물 후보(우세 시너지 보장) 봇: 같은 시드의 무작위 시작과 비교
pool = None
if OPT['pool']:
    a2, r2 = load_parts(OPT['pool'][0])
    seeds = {r['seed'] for r in r2}
    same = [r for r in runs if r['seed'] in seeds]
    pool = {'pool': run_summary(a2, r2), 'randomSameSeeds': {'runs': len(same), 'clear': sum(r['cleared'] for r in same) / max(1, len(same)), 'clearCI': wilson(sum(r['cleared'] for r in same), len(same)), 'avgPhase': sum(r['phase'] for r in same) / max(1, len(same))}}

HR_NOADD = comp_rows(OPT['hrnoadd'][0]) if OPT['hrnoadd'] else []

# ───────── 이전 보고서 대비
prev = None
if OPT['prev']:
    P = json.load(open(OPT['prev'][0]))
    pm = P['meta']
    pu = {u['id']: u for u in P['units']}
    ps = {x['id']: x for x in P['synergies']}
    ph_ = P['phases']
    prev = {'clear': [pm['clear'], CLEAR], 'avgPhase': [pm['avgPhase'], RD['avgPhase']],
            'phaseWin': {p: [ph_.get(p, {}).get('win'), RD['phases'].get(p, {}).get('win')] for p in RD['phases'] if int(p) <= 6},
            'syn': {x['id']: {'lift': [((ps.get(x['id']) or {}).get('pooled') or {}).get('all', {}).get('lift') if ps.get(x['id']) else None, (x['pooled'].get('all') or {}).get('lift')],
                              'hrBest': [max((c['win'] for c in ps[x['id']]['hr']), default=None) if x['id'] in ps else None, max((c['win'] for c in x['hr']), default=None)],
                              'class': [ps[x['id']]['class'] if x['id'] in ps else None, x['class']]} for x in synergies},
            'units': {u['id']: {'lift': [(pu[u['id']].get('all') or {}).get('lift') if u['id'] in pu and pu[u['id']].get('all') else None, (u['all'] or {}).get('lift')],
                                'startClear': [pu[u['id']].get('startClear') if u['id'] in pu else None, u['startClear']],
                                'score': [pu[u['id']].get('score') if u['id'] in pu else None, u.get('score')]} for u in units},
            'hr': {c['id']: [next((x['win'] for x in P['hrComps'] if x['id'] == c['id']), None), c['win']] for c in HR},
            'turret': {c['id']: [next((x['win'] for x in P['turret'] if x['id'] == c['id']), None), c['win']] for c in TUR}}

out = clean({
    'meta': {'runs': N, 'battles': RD['battlesTotal'], 'clear': CLEAR, 'clearCI': wilson(sum(r['cleared'] for r in runs), N), 'avgPhase': RD['avgPhase'],
             'cfBattles': RD['cfTotal'], 'hrComps': len(HR), 'hrBattlesPerComp': HR[0]['n'] if HR else 0,
             'baseline': {f'{p}|{t}': v for (p, t), v in sorted(base.items())},
             'defs': {
                 'lift': '같은 (페이즈, 노드 유형) 평균 승률 대비 승률 차이. liftCI = 런 단위 군집 표준오차 × 1.96',
                 'lossRatio': '실제 패배 수 / 같은 (페이즈, 노드) 평균으로 기대한 패배 수. 1.0 = 평균, 0.7 = 패배 30% 감소',
                 'stages': 'early = P1~2, mid = P3~4, late = P5~6 (보스 포함), boss = 보스 노드만',
                 'ci': '런 단위 비율은 윌슨 95% 구간',
                 'hr': '고위험 후반 = 위험 9 (2026-10-17 체계 판 2, 예전 위험 8과 같은 조건 + 2페이즈마다 적 증원. 절망 증강은 걸리지 않음), 5 · 6페이즈 역경 + 보스, 전장 5곳(swarm · crimson · sparta · petra · waste) × 시드 30 = 조합당 600전',
                 'hrNoAdd': '같은 고위험 조건에서 적 증원(CFG.diffAdd)만 끈 값 (BS_NOADD=1) — 예전 보고서와 비교용',
                 'economy': '전투 종료 보고서 기록(run.rep.b): 이자 · 이자 상한 · 정산 수입은 전투당 평균, 보유 크레딧은 전투 직전 값의 페이즈별 평균',
                 'difficulty': '봇 런 요약: 같은 봇 · 같은 시드, 위험 등급만 바꿈. 고난(위험 7)의 절망 증강은 봇이 무작위로 고름',
                 'iDmg': '기물 1명 평균(같은 페이즈) 대비 전투당 피해 배율. iHeal · iShield · iTaken 도 같은 방식',
                 'liftVsRole': '같은 전투 유형(역할) 출전 가중 평균 lift 대비 차이 (게임에 기물 코스트가 없어 역할로 정규화)',
                 'unitAdjLift': '장비를 든 기물의 같은 페이즈 평균 승률 대비 차이 (기물 강약 보정)',
                 'score(syn)': '전 단계 lift 백분위와 고위험 대표 조합 최고 승률 백분위의 평균',
                 'score(unit)': '출전 lift z 와 시작 기물 클리어 z 의 평균'}},
    'phases': RD['phases'], 'nodes': RD['nodes'], 'fields': RD['fields'], 'death': RD['death'],
    'synergies': synergies, 'units': units, 'items': items, 'itemCats': cats, 'itemRoles': roles, 'turret': turret,
    'ctypes': ctypes, 'ttypes': ttypes, 'combo': combo, 'hrComps': [{k: v for k, v in c.items()} for c in HR], 'hrTypeComps': [c['id'] for c in hr_type],
    'hrNoAdd': [{k: v for k, v in c.items() if k != 'per'} for c in HR_NOADD],
    'augs': augs, 'augSrc': aug_src, 'economy': economy, 'difficulty': difficulty, 'factions': factions, 'pool': pool, 'prev': prev,
})
json.dump(out, open(out_p, 'w'), ensure_ascii=False, indent=1)
print('ok', N, 'runs')
