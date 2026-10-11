import json, collections, math, statistics as st
m = json.load(open('meta.json'))
runs = [json.loads(l) for l in open('runs.jsonl')]
N = len(runs)
U = m['units']; S = m['syn']; E = m['events']
clr = sum(r['cleared'] for r in runs)/N
print(f"== 전체: {N}판, 의뢰 성공 {clr*100:.1f}%")
# 사망 지점
death = collections.Counter()
for r in runs:
    if not r['cleared']:
        d = r['deathBy'] or 'timeout'
        t, ph = d.split(':')[:2]
        death[(int(ph), t)] += 1
print("\n== 사망 지점 (페이즈, 노드)")
for (ph,t),c in sorted(death.items()): print(f"  P{ph} {t:9s} {c:4d} ({c/N*100:.1f}%)")
# 보스별 승률
bw = collections.defaultdict(lambda:[0,0]); nodeW = collections.defaultdict(lambda:[0,0])
for r in runs:
    for b in r['battles']:
        k=(b['ph'],b['t']); nodeW[k][0]+=b['won']; nodeW[k][1]+=1
        if b.get('boss'): bw[(b['ph'],b['boss'])][0]+=b['won']; bw[(b['ph'],b['boss'])][1]+=1
print("\n== 페이즈별 전투 승률")
for ph in range(1,8):
    row=[]
    for t in ['battle','adversity','boss']:
        w,n=nodeW.get((ph,t),[0,0]); row.append(f"{t} {w/n*100:5.1f}% ({n})" if n else f"{t} -")
    print(f"  P{ph}: "+" | ".join(row))
print("\n== 보스별 승률 (시도 20회 이상)")
for (ph,bid),(w,n) in sorted(bw.items()):
    if n>=20: print(f"  P{ph} {m['enemies'].get(bid,bid):16s} {w/n*100:5.1f}% ({w}/{n})")
# 전장
fc = collections.defaultdict(lambda:[0,0])
for r in runs: fc[r['field']][0]+=r['cleared']; fc[r['field']][1]+=1
print("\n== 전장별 성공률")
for f,(c,n) in sorted(fc.items(), key=lambda x:-x[1][0]/x[1][1]): print(f"  {m['fields'][f]:18s} {c/n*100:5.1f}% (n={n})")
# 시작 기물별 성공률 (무작위 4명이라 인과 신호)
sc = collections.defaultdict(lambda:[0,0])
for r in runs:
    for s in r['starters']: sc[s][0]+=r['cleared']; sc[s][1]+=1
# 기물 기여: 출전 전투당 피해 점유율, 지원 점유율, 사망률
share = collections.defaultdict(list); sups = collections.defaultdict(list); deaths = collections.defaultdict(lambda:[0,0])
for r in runs:
    for b in r['battles']:
        tot = sum(b['dmg'].values()) or 1; stot = sum(b['sup'].values()) or 1
        k = len(b['dmg'])
        for u,v in b['dmg'].items():
            share[u].append(v/tot*k)  # 1.0 = 평균 기여
            sups[u].append(b['sup'].get(u,0)/stot*k if stot>1 else 0)
            deaths[u][1]+=1; deaths[u][0]+= u in b['died']
pick = collections.Counter(); finalc = collections.Counter()
for r in runs:
    for u in r['used']: pick[u]+=1
print("\n== 기물: 시작 기물 성공률 | 전투 피해 기여(1=평균) | 지원 기여 | 전투 중 사망률 | 런 합류율")
rows=[]
for u,info in U.items():
    c,n = sc.get(u,[0,0])
    sr = c/n if n else float('nan')
    rows.append((u, info['name'], info['ct'], info['tt'], sr, n, st.mean(share[u]) if share[u] else 0, st.mean(sups[u]) if sups[u] else 0, deaths[u][0]/deaths[u][1] if deaths[u][1] else 0, pick[u]/N))
rows.sort(key=lambda x: -(x[6]))
for u,nm,ct,tt,sr,n,sh,su,dr,pk in rows:
    print(f"  {nm:8s} {ct:4s} {tt:8s} 시작 {'%5.1f%%'%(sr*100) if n else '   - '} (n={n:3d}) | 피해 {sh:4.2f} | 지원 {su:4.2f} | 사망 {dr*100:4.1f}% | 합류 {pk*100:4.1f}%")
# 전투유형/전술유형 집계
print("\n== 전투 유형별 평균 피해 기여")
by=collections.defaultdict(list)
for u,info in U.items(): by[info['ct']]+=share[u]
for k,v in by.items(): print(f"  {k}: {st.mean(v):.2f} (표본 {len(v)})")
by=collections.defaultdict(list)
for u,info in U.items(): by[info['tt']]+=share[u]
print("== 전술 유형별 평균 피해 기여")
for k,v in by.items(): print(f"  {k}: {st.mean(v):.2f}")
# 시너지 완성률
print("\n== 시너지: 최고 단계 도달률 (1/2/3단계) | 도달 시 성공률 vs 미도달")
for sid,info in S.items():
    t = [r['synMax'].get(sid,0) for r in runs]
    n = len(info['tiers'])
    reach = [sum(1 for x in t if x>=k)/N for k in range(1,n+1)]
    c_hi = [r['cleared'] for r in runs if r['synMax'].get(sid,0)>=2]
    c_lo = [r['cleared'] for r in runs if r['synMax'].get(sid,0)<2]
    c1 = [r['cleared'] for r in runs if r['synMax'].get(sid,0)>=1]
    print(f"  {info['name']:12s} " + " / ".join(f"{x*100:4.1f}%" for x in reach) + f" | 1단계↑ 성공 {st.mean(c1)*100 if c1 else 0:4.1f}% | 2단계↑ 성공 {st.mean(c_hi)*100 if c_hi else float('nan'):4.1f}% (n={len(c_hi)})")
json.dump({'rows':rows}, open('rep_units.json','w'))
