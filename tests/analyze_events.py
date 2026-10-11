import json, collections, statistics as st
m = json.load(open('meta.json')); runs=[json.loads(l) for l in open('runs.jsonl')]; N=len(runs); E=m['events']
# 페이즈 p 도달 런의 성공률 (기준선)
reach=collections.defaultdict(list)
for r in runs:
    maxph = r['phase'] if not r['cleared'] else 6
    for p in range(1, maxph+1): reach[p].append(r['cleared'])
base={p:st.mean(v) for p,v in reach.items()}
print('기준선(해당 페이즈 도달 시 최종 성공률):', {p:f"{v*100:.0f}%" for p,v in sorted(base.items())})
ev=collections.defaultdict(list); ch=collections.defaultdict(list); seen=collections.Counter()
for r in runs:
    for e in r['events']:
        lift=r['cleared']-base[e['ph']]
        ev[e['id']].append(lift); ch[(e['id'],e['c'])].append((lift,e['d'])); seen[e['id']]+=1
print(f"\n사건 발생 총 {sum(seen.values())}회, 런당 {sum(seen.values())/N:.1f}회, 한 번도 안 나온 사건: {[E[k]['title'] for k in E if seen[k]==0]}")
rows=[]
for k,v in ev.items():
    se=(0.25/len(v))**0.5
    rows.append((st.mean(v), len(v), se, k))
rows.sort()
print('\n== 성공률 편차(선택 후 최종 성공 - 같은 페이즈 기준선), 하위 12 / 상위 8 (n>=40)')
f=[x for x in rows if x[1]>=40]
for x in f[:12]+[None]+f[-8:]:
    if x is None: print('   ...'); continue
    l,n,se,k=x
    print(f"  {l*100:+5.1f}%p ±{se*100*1.96:4.1f}  n={n:4d}  {E[k]['title']}")
# 선택지별 즉시 손익
print('\n== 선택지별 평균 즉시 변화 (n>=25) — 크레딧/체력/등급합/장비/영구스탯/팀효과')
def agg(lst,key): return st.mean([d.get(key,0) for _,d in lst])
out=[]
for (k,c),lst in ch.items():
    if len(lst)<25: continue
    out.append((k,c,len(lst),agg(lst,'cr'),agg(lst,'hp'),agg(lst,'rank'),agg(lst,'items'),agg(lst,'perm'),agg(lst,'boons'),agg(lst,'mhp'),agg(lst,'power'),st.mean([l for l,_ in lst])))
# 값 점수: 크레딧 1, 체력 0.6, 등급 4, 장비 5, 영구스탯 1.2, 팀효과 8, 최대체력 0.5, 권능 2
def val(o): return o[3]+0.6*o[4]+4*o[5]+5*o[6]+1.2*o[7]+8*o[8]+0.5*o[9]+2*o[10]
out.sort(key=val)
print('  최저 가치 10:')
for o in out[:10]: print(f"   {val(o):6.1f}  {E[o[0]]['title']} · {E[o[0]]['choices'][o[1]]} (n={o[2]}) cr {o[3]:+.1f} hp {o[4]:+.1f} rank {o[5]:+.2f} item {o[6]:+.2f} perm {o[7]:+.1f} boon {o[8]:+.2f}")
print('  최고 가치 10:')
for o in out[-10:]: print(f"   {val(o):6.1f}  {E[o[0]]['title']} · {E[o[0]]['choices'][o[1]]} (n={o[2]}) cr {o[3]:+.1f} hp {o[4]:+.1f} rank {o[5]:+.2f} item {o[6]:+.2f} perm {o[7]:+.1f} boon {o[8]:+.2f}")
# 사건별 선택지 가치 격차 (지배적 선택지)
print('\n== 선택지 가치 격차가 큰 사건 (최고-최저, 3선택지 모두 n>=15)')
byev=collections.defaultdict(dict)
for (k,c),lst in ch.items():
    if len(lst)>=15:
        o=(k,c,len(lst),agg(lst,'cr'),agg(lst,'hp'),agg(lst,'rank'),agg(lst,'items'),agg(lst,'perm'),agg(lst,'boons'),agg(lst,'mhp'),agg(lst,'power'),0)
        byev[k][c]=val(o)
gap=[(max(v.values())-min(v.values()),k,v) for k,v in byev.items() if len(v)==3]
gap.sort(reverse=True)
for g,k,v in gap[:10]: print(f"  {g:5.1f}  {E[k]['title']}: "+' / '.join(f"{E[k]['choices'][c]} {v[c]:.0f}" for c in sorted(v)))
# 연계 사건 도달률
print('\n== 연계 후속 사건 등장률 (런 대비)')
for k,info in E.items():
    if info['req']: print(f"  {seen[k]/N*100:5.1f}%  {info['title']}")
# 전장별 사망 페이즈
print('\n== 전장별 사망 지점 상위')
fd=collections.defaultdict(collections.Counter)
for r in runs:
    if not r['cleared'] and r['deathBy']:
        t,ph=r['deathBy'].split(':')[:2]; b=r['deathBy'].split(':')[2] if r['deathBy'].count(':')>=2 else ''
        fd[r['field']][(int(ph),t,m['enemies'].get(b,''))]+=1
for f,c in fd.items():
    print(f"  {m['fields'][f]}: "+', '.join(f"P{ph} {t}{('('+b+')') if b else ''} {n}" for (ph,t,b),n in c.most_common(5)))
