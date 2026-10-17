# 밸런스 보고서(docs/BALANCE_REPORT.md)의 표를 docs/balance_report.json 에서 다시 그린다 (손으로 옮겨 적지 않기 위해).
# 실행: python3 tests/balance_tables.py docs/balance_report.json            → 모든 표 (키마다 '<!-- 표: 키 -->' 머리)
#       python3 tests/balance_tables.py docs/balance_report.json syn_rank   → 표 하나
#       python3 tests/balance_tables.py docs/balance_report.json --fill 틀.md → 틀의 {{표:키}} 자리를 표로 바꿔 출력
import json, sys, re, collections

D = json.load(open(sys.argv[1]))
CT = {t['id']: t['name'] for t in D['ctypes']}
TT = {t['id']: t['name'] for t in D['ttypes']}
SYN = {s['id']: s for s in D['synergies']}
SYN_NAME = {s['id']: s['name'] for s in D['synergies']}
CLASS_ORDER = ['꾸준형', '초반형', '후반형', '평균권', '약세', '보류(표본 부족)']

def P(x, d=0):
    return '-' if x is None else f'{x * 100:.{d}f}%'
def CI(c, d=0):
    return '' if not c else f' ({c[0] * 100:.{d}f}–{c[1] * 100:.{d}f})'
def PC(x, c, d=0):
    return '-' if x is None else f'{P(x, d)}{CI(c, d)}'
def L(g):
    return '-' if not g or g.get('lift') is None else f"{g['lift'] * 100:+.1f} ± {g['liftCI'] * 100:.1f}"
def LR(g):
    return '-' if not g or g.get('lossRatio') is None else f"{g['lossRatio']:.2f} ± {(g.get('lossRatioCI') or 0):.2f}"
def N(x):
    return '-' if x is None else f'{x:,}'
def F(x, d=2):
    return '-' if x is None else f'{x:.{d}f}'
def PP(x, d=1):
    return '-' if x is None else f'{x * 100:+.{d}f}'
def table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)

def hr_best(s):
    return s['hr'][0] if s['hr'] else None
def syn_ranked():
    return sorted([s for s in D['synergies'] if s.get('score') is not None], key=lambda s: -s['score'])
def unit_type(u):
    return f"{CT.get(u['ct'], u['ct'])} · {TT.get(u['tt'], u['tt'])}"
def comp_syn(c):
    # 2명 이상이 켠 시너지만 (1명짜리 범은하 공동체 · 출항기 1단계는 생략)
    return ', '.join(f'{SYN_NAME.get(k, k)} {v[0]}' for k, v in sorted(c['syn'].items(), key=lambda kv: SYN_NAME.get(kv[0], kv[0])) if v[1] >= 1 and v[0] >= 2 and k in SYN_NAME)

# ───────── 1. 시너지
def t_syn_rank():
    rows = []
    for i, s in enumerate(syn_ranked(), 1):
        a = s['pooled'].get('all')
        t1 = s['byTier'][0]
        h = hr_best(s)
        main = f"{s['mainTier']}단계 ({s['mainCount']}명) · {N(a['n'])}" if s['mainTier'] else '-'
        rows.append([i, s['name'], s['class'], main, L(a), LR(a), f"{PC(t1['clearIfReached'], t1['clearCI'])} n={t1['runsReached']}",
                     f"{h['id']} ({h['count']}명 · {h['tier']}단계)" if h else '-', PC(h['win'], h['ci']) if h else '-', F(s['score'])])
    return table(['순위', '시너지', '분류', '봇 주력 단계 (전투 수)', '전 단계 lift (%p)', '패배율 배수', '단계 1 도달 시 클리어 (95%)', '고위험 대표 조합 (단계)', '고위험 후반 승률 (95%)', '종합'], rows)

def t_syn_unranked():
    rows = []
    for s in D['synergies']:
        if s.get('score') is not None: continue
        a = s['pooled'].get('all')
        h = hr_best(s)
        rows.append([s['name'], N(a['n']) if a else 0, L(a), LR(a), f"{h['id']} ({h['count']}명 · {h['tier']}단계) {PC(h['win'], h['ci'])}" if h else '-'])
    return table(['시너지 (순위 제외: 전투 1,000 미만)', '전투 수', 'lift (%p)', '패배율 배수', '고위험 대표 조합'], rows)

def t_syn_tiers():
    rows = []
    for s in syn_ranked() + [s for s in D['synergies'] if s.get('score') is None]:
        for t in s['byTier']:
            a = t['all']
            if not a or a['n'] < 100: continue
            rows.append([s['name'], f"{t['tier']} ({t['count']})", t['runsReached'], PC(t['clearIfReached'], t['clearCI']), N(a['n']), L(a), LR(a)])
    return table(['시너지', '단계 (인원)', '도달 런', '도달 시 클리어 (95%)', '전투 수', 'lift (%p)', '패배율 배수'], rows)

def why_text(s):
    w = s['classWhy']
    if not w: return '표본 부족'
    parts = []
    parts.append('초반 유의 강세' if w['earlyStrong'] else '초반 평균 이하' if w['earlyLR'] >= 1.0 else '초반 차이 불확실')
    lt = w['lateLR'] + w['lateCI'] < 1.0
    parts.append('후반 유의 강세' if lt else '후반 평균 이하' if w['lateLR'] >= 1.0 else '후반 차이 불확실')
    if w['hrBest'] is not None and w['hrBest'] >= 0.30: parts.append('고위험 ≥30%')
    if w['hrBest'] is not None and w['hrBest'] < 0.10: parts.append('고위험 <10%')
    return ' · '.join(parts)

def t_syn_class():
    rows = []
    ss = sorted(D['synergies'], key=lambda s: (CLASS_ORDER.index(s['class']) if s['class'] in CLASS_ORDER else 9, -(s.get('score') or 0)))
    for s in ss:
        e, l, b = s['pooled'].get('early'), s['pooled'].get('late'), s['pooled'].get('boss')
        hb = max((c['win'] for c in s['hr']), default=None)
        rows.append([s['name'], f"**{s['class']}**", N(e['n']) if e else '-', LR(e), N(l['n']) if l else '-', LR(l), L(b), P(hb), why_text(s)])
    return table(['시너지', '분류', '초반 P1–2 전투', '초반 패배율 배수', '후반 P5–6 전투', '후반 패배율 배수', '보스전 lift (%p)', '고위험 최고', '판정 근거'], rows)

def t_syn_class_short():
    g = collections.defaultdict(list)
    for s in sorted(D['synergies'], key=lambda s: -(s.get('score') or 0)): g[s['class']].append(s['name'])
    return table(['분류', '시너지'], [[c, ' · '.join(g[c])] for c in CLASS_ORDER if g.get(c)])

def hr_rows(comps, noadd=None, prev=None):
    na = {c['id']: c for c in (noadd or [])}
    rows = []
    for c in sorted(comps, key=lambda c: -(c['win'] or 0)):
        r = [c['id'], comp_syn(c), c['n'], PC(c['win'], c['ci']), P(c['bossWin']), f"{c['dur']:.0f}"]
        if noadd is not None: r.append(P(na[c['id']]['win']) if c['id'] in na else '-')
        if prev is not None:
            pv = prev.get(c['id'], [None, None])[0]
            cur = na[c['id']]['win'] if c['id'] in na else c['win']  # 이전 보고서(증원 없던 위험 8)와는 증원 끈 값으로 비교
            r.append('신규' if pv is None else f"{P(pv)} ({(cur - pv) * 100:+.0f})")
        rows.append(r)
    return rows

def t_hr():
    prev = (D.get('prev') or {}).get('hr')
    head = ['조합', '주요 시너지 (인원)', '전투', '고위험 후반 승률 (95%)', '보스전만', '평균 전투(초)', '증원 끔', '이전 보고서 (증원 끔 − 이전, %p)']
    return table(head, hr_rows(D['hrComps'], D.get('hrNoAdd') or [], prev or {}))

# ───────── 1-5. 청라공국 · 세력 우선 봇
def t_fac():
    rows = []
    for f in D.get('factions') or []:
        mt = f.get('maxTier', {})
        rows.append([f['name'], f['runs'], PC(f['clear'], f['clearCI'], 1), F(f['avgPhase']),
                     ' · '.join(f"{t}단계 {P(v)}" for t, v in mt.items())])
    return table(['봇 (세력 우선)', '런', '클리어 (95%)', '평균 도달 페이즈', '최고 세력 단계 분포'], rows)

def t_fac_tier():
    rows = []
    for f in D.get('factions') or []:
        for t, v in (f.get('clearByTier') or {}).items():
            if v: rows.append([f['name'], f'{t}단계', v['n'], PC(v['clear'], v['ci'])])
    return table(['봇', '런 최고 세력 단계', '런', '클리어 (95%)'], rows)

def t_king():
    f = next((x for x in D.get('factions') or [] if x.get('king')), None)
    if not f: return '(청라 봇 자료 없음)'
    rows = []
    for key, name in [('tier3', '청라 7명(3단계) 도달 런 전체'), ('tier3cleared', '그중 클리어 런'), ('tier2only', '최고 5명(2단계) 런'), ('all', '청라 1단계 이상 전체')]:
        k = f['king'][key]
        if not k['n']: rows.append([name, 0, '-', '-', '-']); continue
        dist = ' · '.join(f"{s}단계 {P(v)}" for s, v in k['dist'].items())
        rows.append([name, k['n'], F(k['mean'], 1), F(k['meanCausal'], 0), dist])
    return table(['구분', '런', '평균 최종 인과 단계', '평균 인과율', '최종 인과 단계 분포'], rows)

def t_causal_phase():
    f = next((x for x in D.get('factions') or [] if x.get('causalAtPhase')), None)
    if not f: return '(자료 없음)'
    return table(['페이즈', '런', '페이즈 1번째 전투 직전 인과율 중앙값', '평균'], [[p, v['n'], v['median'], F(v['mean'], 0)] for p, v in f['causalAtPhase'].items()])

# ───────── 2. 기물
def ranked_units():
    us = [u for u in D['units'] if u['acq'] != 'event' and u['all'] and u['all']['n'] >= 1000 and u.get('score') is not None]
    return sorted(us, key=lambda u: -u['score'])
def unit_row(i, u):
    idx = f"{F(u['iDmg'])} / {F(u['iHeal'])} / {F(u['iShield'])} / {F(u['iTaken'])}"
    return [i, u['name'], unit_type(u), N(u['all']['n']), L(u['all']), PP(u.get('liftVsRole')), f"{PC(u['startClear'], u['startCI'])} n={u['startN']}",
            f"{P(u['finalClear'])} n={u['finalN']}", idx, P(u['death']), f"{u['score']:+.2f}"]
UHEAD = ['순위', '기물', '유형', '출전 전투', '출전 lift (%p)', '역할 대비 (%p)', '시작 기물 클리어 (95%)', '끝까지 보유 클리어', '피해 / 회복 / 보호막 / 받은 피해 지수', '전투 중 사망률', '종합 z']
def t_unit_top():
    us = ranked_units()
    return table(UHEAD, [unit_row(i, u) for i, u in enumerate(us[:8], 1)])
def t_unit_bottom():
    us = ranked_units()[::-1]
    return table(UHEAD, [unit_row(i, u) for i, u in enumerate(us[:8], 1)])
def t_unit_all():
    return table(UHEAD, [unit_row(i, u) for i, u in enumerate(ranked_units(), 1)])
def t_unit_role():
    rows = []
    us = ranked_units()
    for ct in ['MARK', 'VAN', 'SPEC', 'CMD']:
        g = sorted([u for u in us if u['ct'] == ct], key=lambda u: -u['liftVsRole'])
        if not g: continue
        rows.append([CT.get(ct, ct), len(g), ', '.join(f"{u['name']} {PP(u['liftVsRole'])}" for u in g[:2]), ', '.join(f"{u['name']} {PP(u['liftVsRole'])}" for u in g[::-1][:2]),
                     f"{(g[0]['liftVsRole'] - g[-1]['liftVsRole']) * 100:.1f}"])
    return table(['역할 (전투 유형)', '기물', '역할 안 최고 (역할 대비 %p)', '역할 안 최저 (역할 대비 %p)', '역할 안 lift 폭 (%p)'], rows)
NEW_UNITS = ['dobin', 'siu', 'jaehwon', 'juseong', 'clover', 'hana', 'gayoung', 'minos', 'gungo']
def t_unit_new():
    rank = {u['id']: i for i, u in enumerate(ranked_units(), 1)}
    tot = len(rank)
    rows = []
    for uid in NEW_UNITS:
        u = next((x for x in D['units'] if x['id'] == uid), None)
        if not u: continue
        syn = ' · '.join(SYN_NAME.get(x, x) for x in u['syn'] if x in SYN_NAME)
        if not u['all']:
            rows.append([u['name'], unit_type(u), syn, '표본 없음 (사건 전용)' if u['acq'] == 'event' else '표본 없음', '-', '-', '-', '-', '-']); continue
        idx = f"{F(u['iDmg'])} / {F(u['iHeal'])} / {F(u['iShield'])} / {F(u['iTaken'])}"
        rows.append([u['name'], unit_type(u), syn, N(u['all']['n']), L(u['all']), f"{PC(u['startClear'], u['startCI'])} n={u['startN']}", idx, P(u['death']),
                     f"{rank[uid]} / {tot} ({u['score']:+.2f})" if uid in rank else '-'])
    return table(['기물', '유형', '시너지', '출전 전투', '출전 lift (%p)', '시작 기물 클리어 (95%)', '피해 / 회복 / 보호막 / 받은 피해 지수', '사망률', '종합 순위 (z)'], rows)

# ───────── 3. 장비
def t_item_cat():
    order = ['동맹 전용', '문장', '전설', '희귀', '고급', '재료', '신비 부품', '포탑', '고유', '소모품', '?']
    cs = sorted(D['itemCats'], key=lambda c: order.index(c['cat']) if c['cat'] in order else 99)
    return table(['분류', '장착 전투', 'lift (%p)', '기물 보정 lift (%p)'], [[c['cat'], N(c['n']), PP(c['lift']), PP(c['unitAdjLift'])] for c in cs])
def t_item_role():
    rs = sorted([r for r in D['itemRoles'] if r['cat'] in ('전설', '희귀')], key=lambda r: (r['cat'] != '전설', -r['unitAdjLift']))
    return table(['등급', '역할 (주요 능력치 조합)', '장착 전투', 'lift (%p)', '기물 보정 lift (%p)'], [[r['cat'], r['role'], N(r['n']), PP(r['lift']), PP(r['unitAdjLift'])] for r in rs])
def t_item_all():
    order = ['희귀', '전설', '고급', '재료', '동맹 전용', '문장', '신비 부품', '고유', '포탑', '소모품', '?']
    its = sorted([x for x in D['items'] if x['all'] and x['cat'] not in ('고유', '소모품')], key=lambda x: (order.index(x['cat']) if x['cat'] in order else 99, -(x['unitAdjLift'] or 0)))
    return table(['분류', '장비', '역할', '장착 전투', 'lift (%p, 95%)', '기물 보정 lift (%p)', '후반 lift (%p)', '피해 점유'],
                 [[x['cat'], x['name'], x['role'], N(x['n']), L(x['all']), PP(x['unitAdjLift']), L(x['late']), F(x['share'])] for x in its])
def t_item_sel(ids):
    its = [x for x in D['items'] if x['id'] in ids]
    return table(['장비', '장착 전투', 'lift (%p, 95%)', '기물 보정 lift (%p)', '후반 lift (%p)', '피해 점유', '착용자 사망률'],
                 [[x['name'], N(x['n']), L(x['all']), PP(x['unitAdjLift']), L(x['late']), F(x['share']), P(x['death'])] for x in sorted(its, key=lambda x: x['id'])])
def t_turret():
    base = {}
    for c in D['turret']:
        comp, g = c['id'].split('|')
        if g == 'none': base[comp] = c['win']
    prev = (D.get('prev') or {}).get('turret') or {}
    rows = []
    for comp in sorted(base):
        for c in sorted([c for c in D['turret'] if c['id'].startswith(comp + '|')], key=lambda c: -c['win']):
            pv = prev.get(c['id'], [None])[0]
            rows.append([comp, c['id'].split('|')[1], c['n'], PC(c['win'], c['ci']), P(c['bossWin']), PP(c['win'] - base[comp]), '-' if pv is None else P(pv)])
    return table(['조합', '포탑 장비 (모든 포탑 1칸)', '전투', '고위험 후반 승률 (95%)', '보스', '장비 없음 대비 (%p)', '이전 보고서'], rows)

# ───────── 4. 유형
def t_types():
    rows = []
    for kind, lst in [('전투 유형', D['ctypes']), ('전술 유형', D['ttypes'])]:
        for t in sorted(lst, key=lambda t: -(t['all']['lift'] if t['all'] else -9)):
            if not t['all']: continue
            rows.append([kind, t['name'], t['units'], N(t['all']['n']), L(t['all']), LR(t['early']), LR(t['late']), L(t['boss']),
                         f"{F(t['iDmg'])} / {F(t['iHeal'])} / {F(t['iShield'])} / {F(t['iTaken'])}", P(t['death']), f"{P(t['startClear'], 1)}{CI(t['startCI'])} n={t['startN']}"])
    return table(['분류', '유형', '기물 수', '출전 전투', 'lift (%p)', '초반 패배율 배수', '후반 패배율 배수', '보스 lift (%p)', '피해 / 회복 / 보호막 / 받은 피해', '사망률', '시작 기물 클리어 (95%)'], rows)
def t_combo():
    cts = ['MARK', 'VAN', 'SPEC', 'CMD']; tts = ['major', 'minor', 'special', 'psionic', 'divine']
    m = {(c['ct'], c['tt']): c for c in D['combo']}
    rows = []
    for ct in cts:
        r = [CT.get(ct, ct)]
        for tt in tts:
            c = m.get((ct, tt))
            r.append(f"승 {P(c['win'], 1)} · 점유 {F(c['share'])} · 사망 {P(c['death'])}" if c else '-')
        rows.append(r)
    return table(['전투 \\ 전술'] + [TT.get(t, t) for t in tts], rows)

# ───────── 5. 증강
def t_aug_src():
    return table(['출처', '종류', '전투 (기물 × 전투)', 'lift (%p)'], [[a['src'], a['kinds'], N(a['n']), PP(a['lift'])] for a in sorted(D['augSrc'], key=lambda a: -a['lift'])])
UNAME = {u['id']: u['name'] for u in D['units']}
def aug_owner(a):
    o = a.get('owner') or ''
    return f" ({UNAME.get(o) or SYN_NAME.get(o) or o})" if o else ''
def aug_rows(xs):
    return [[a['name'], a['src'] + aug_owner(a), N(a['all']['n']), a['all']['runs'], L(a['all']), L(a['late'])] for a in xs]
AUG_MIN = 1500
def t_aug_top():
    xs = sorted([a for a in D['augs'] if a['all'] and a['all']['n'] >= AUG_MIN], key=lambda a: -a['all']['lift'])
    return table(['증강', '출처 (주인)', '전투', '런', 'lift (%p)', '후반 lift (%p)'], aug_rows(xs[:12]))
def t_aug_bottom():
    xs = sorted([a for a in D['augs'] if a['all'] and a['all']['n'] >= AUG_MIN], key=lambda a: a['all']['lift'])
    return table(['증강', '출처 (주인)', '전투', '런', 'lift (%p)', '후반 lift (%p)'], aug_rows(xs[:12]))
def t_aug_owner():
    # 스페셜 증강을 주인 기물별로 묶어 lift 폭 (같은 기물 증강끼리 비교)
    g = collections.defaultdict(list)
    for a in D['augs']:
        if a['src'] == '스페셜' and a['all'] and a['all']['n'] >= 500: g[a['owner']].append(a)
    rows = []
    for o, xs in sorted(g.items(), key=lambda kv: -max(x['all']['lift'] for x in kv[1]) + min(x['all']['lift'] for x in kv[1]))[:10]:
        xs.sort(key=lambda x: -x['all']['lift'])
        rows.append([UNAME.get(o, o), len(xs), f"{xs[0]['name']} {PP(xs[0]['all']['lift'])}", f"{xs[-1]['name']} {PP(xs[-1]['all']['lift'])}", f"{(xs[0]['all']['lift'] - xs[-1]['all']['lift']) * 100:.1f}"])
    return table(['기물', '스페셜 증강 (전투 500+)', '최고', '최저', '폭 (%p)'], rows)

# ───────── 6. 경제
def t_econ():
    rows = []
    for key, name in [('all', '전체'), ('cleared', '클리어 런'), ('failed', '실패 런')]:
        e = D['economy'][key]
        if not e: continue
        rows.append([name, e['runs'], F(e['interestPerBattle'], 2), F(e['capPerBattle'], 2), P(e['atCapRate']), F(e['incomePerBattle'], 1), F(e['endCredits'], 0), P(e['loanRuns'])])
    return table(['구분', '런', '전투당 이자', '전투당 이자 상한', '상한까지 받은 전투', '전투당 정산 수입', '런 끝 보유 크레딧', '대출 런'], rows)
def t_econ_phase():
    rows = []
    for key, name in [('all', '전체'), ('cleared', '클리어 런'), ('failed', '실패 런')]:
        e = D['economy'][key]
        if e: rows.append([name] + [F(e['creditsAtBattle'].get(str(p)), 0) for p in range(1, 7)])
    for d in D.get('difficulty') or []:
        e = d.get('econ')
        if e and d['name'] != '표준 (위험 0)': rows.append([d['name']] + [F(e['creditsAtBattle'].get(str(p)), 0) for p in range(1, 7)])
    return table(['구분', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'], rows)
SPEND_NAME = {'shop': '상점 구매', 'xp': '공명도 구매', 'fleet': '함대 확장', 'muster': '지정 소집', 'invest': '투자', 'event': '사건', 'loan': '대출 상환'}
def t_econ_spend():
    e = D['economy']['all']
    tot = sum(e['spendPerRun'].values()) or 1
    return table(['지출', '런당 크레딧', '비중'], [[SPEND_NAME.get(k, k), F(v, 0), P(v / tot)] for k, v in e['spendPerRun'].items()])

# ───────── 7. 난이도
def t_diff():
    rows = []
    for d in D.get('difficulty') or []:
        rows.append([d['name'], d['runs'], PC(d['clear'], d['clearCI'], 1), F(d['avgPhase']), ' · '.join(P(d['reach'].get(str(p))) for p in range(2, 7)), F(d['despairs'], 1)])
    return table(['난이도', '런', '클리어 (95%)', '평균 도달 페이즈', '페이즈 2 · 3 · 4 · 5 · 6 도달', '평균 절망 증강 수'], rows)
def t_diff_phase():
    rows = []
    for d in D.get('difficulty') or []:
        rows.append([d['name']] + [P((d['phaseWin'].get(str(p)) or {}).get('win'), 1) for p in range(1, 7)] + [' · '.join(f"P{p} {P(v['win'])}" for p, v in d['bossWin'].items())])
    return table(['난이도', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', '보스전 승률'], rows)
def t_pool():
    p = D.get('pool')
    if not p: return '(자료 없음)'
    a, b = p['pool'], p['randomSameSeeds']
    return table(['계약 기물', '런', '클리어 (95%)', '평균 도달 페이즈'],
                 [['무작위 4명 (보고서 기본 봇)', b['runs'], PC(b['clear'], b['clearCI'], 1), F(b['avgPhase'])],
                  ['계약 후보 8명 중 우세 시너지 2명 보장 (실제 게임)', a['runs'], PC(a['clear'], a['clearCI'], 1), F(a['avgPhase'])]])

# ───────── 변경 이력 대비
def t_prev_main():
    p = D.get('prev')
    if not p: return '(자료 없음)'
    rows = [['전체 클리어율', P(p['clear'][0], 1), P(p['clear'][1], 1), PP(p['clear'][1] - p['clear'][0])],
            ['평균 도달 페이즈', F(p['avgPhase'][0]), F(p['avgPhase'][1]), f"{p['avgPhase'][1] - p['avgPhase'][0]:+.2f}"]]
    for ph, (a, b) in p['phaseWin'].items():
        if a is not None and b is not None: rows.append([f'P{ph} 전투 승률', P(a, 1), P(b, 1), PP(b - a)])
    return table(['지표', '이전 (10-15)', '이번', '차이 (%p)'], rows)
def t_prev_syn():
    p = D.get('prev')
    if not p: return '(자료 없음)'
    rows = []
    for sid, v in sorted(p['syn'].items(), key=lambda kv: -abs(((kv[1]['lift'][1] or 0) - (kv[1]['lift'][0] or 0)))):
        a, b = v['lift']; ha, hb = v['hrBest']
        rows.append([SYN_NAME.get(sid, sid), PP(a), PP(b), '신규' if a is None else PP((b or 0) - a), P(ha), P(hb), f"{v['class'][0] or '신규'} → {v['class'][1]}"])
    return table(['시너지', '이전 lift', '이번 lift', '차이 (%p)', '이전 고위험 최고', '이번 고위험 최고', '분류'], rows)
def t_prev_units(k=10):
    p = D.get('prev')
    if not p: return '(자료 없음)'
    us = {u['id']: u for u in D['units']}
    xs = [(uid, v) for uid, v in p['units'].items() if v['lift'][0] is not None and v['lift'][1] is not None and us[uid]['acq'] != 'event']
    xs.sort(key=lambda kv: -abs(kv[1]['lift'][1] - kv[1]['lift'][0]))
    rows = [[us[uid]['name'], PP(v['lift'][0]), PP(v['lift'][1]), PP(v['lift'][1] - v['lift'][0]), P(v['startClear'][0]), P(v['startClear'][1]),
             F(v['score'][0]), F(v['score'][1])] for uid, v in xs[:k]]
    return table(['기물', '이전 lift', '이번 lift', '차이 (%p)', '이전 시작 클리어', '이번 시작 클리어', '이전 종합 z', '이번 종합 z'], rows)

# ───────── 부록
def t_fields():
    import math
    def w(k, n, z=1.96):
        p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
        return [c - h, c + h]
    return table(['전장', '런', '클리어 (95%)', '평균 도달 페이즈'], [[f['name'], f['n'], PC(f['clear'], w(round(f['clear'] * f['n']), f['n'])), F(f['phase'])] for f in sorted(D['fields'], key=lambda f: -f['clear'])])
def t_nodes():
    rows = []
    for n in sorted(D['nodes'], key=lambda n: (n['ph'], n['t'])):
        if n['ph'] <= 6: rows.append([n['ph'], n['t'], N(n['n']), P(n['win'], 1), F(n['dur'], 0)])
    return table(['페이즈', '노드', '전투', '승률', '평균 전투(초)'], rows)

T = {k[2:]: v for k, v in globals().items() if k.startswith('t_') and callable(v)}
T['item_new'] = lambda: t_item_sel({'A_vit_def', 'L_vit_def', 'A_taunt', 'L_taunt'} | {x['id'] for x in D['items'] if 'taunt' in x['id'] or x['name'] in ('위협 신호기',)})

if __name__ == '__main__':
    if len(sys.argv) > 3 and sys.argv[2] == '--fill':
        src = open(sys.argv[3]).read()
        print(re.sub(r'\{\{표:(\w+)\}\}', lambda m: T[m.group(1)](), src), end='')
    elif len(sys.argv) > 2:
        print(T[sys.argv[2]]())
    else:
        for k, f in T.items(): print(f'<!-- 표: {k} -->\n{f()}\n')
