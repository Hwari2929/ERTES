# 시너지 단계별 lift (docs/BALANCE_SYNERGY_LIFT.md)
# 시너지 · 단계별 lift: python3 synlift.py names.json 철수=<폴더> 영희=<폴더> > out.md
import json,glob,sys,math,collections as C
NM=json.load(open(sys.argv[1]))['syn']; Z=1.96
cols=[a.split('=',1) for a in sys.argv[2:]]
def load(d):
    runs=[];node=C.defaultdict(lambda:[0,0])
    for p in sorted(glob.glob(d+'/h7_*.json')):
        j=json.load(open(p));runs+=[r for r in j['runs'] if 'err' not in r]
        for k,v in j['agg']['node'].items(): node[k][0]+=v['n'];node[k][1]+=v['wins']
    return runs,{k:v[1]/v[0] for k,v in node.items() if v[0]}
def lift(runs,base,phs):
    per=C.defaultdict(lambda:C.defaultdict(lambda:[0,0.0,0]))
    for r in runs:
        for key,(n,w) in r['det'].items():
            if not key.startswith('s:'):continue
            body,pn=key[2:].rsplit('|',1);ph,nd=pn.split(':')
            if int(ph) not in phs:continue
            b=base.get(f'{ph}|{nd}')
            if b is None:continue
            a=per[body][r['seed']];a[0]+=n;a[1]+=n*b;a[2]+=w
    out={}
    for body,rs in per.items():
        N=sum(a[0] for a in rs.values());E=sum(a[1] for a in rs.values());W=sum(a[2] for a in rs.values())
        L=(W-E)/N;k=len(rs)
        var=sum(((a[2]-a[1])-L*a[0])**2 for a in rs.values())/(N*N)*(k/(k-1) if k>1 else 1)
        out[body]=(N,k,W/N,L,Z*math.sqrt(var))
    return out
D=[]
for name,d in cols:
    runs,base=load(d)
    D.append((name,runs,lift(runs,base,range(1,7)),lift(runs,base,(1,2,3)),lift(runs,base,(4,5,6))))
print('## 요약\n\n| 지표 | '+' | '.join(n for n,*_ in D)+' |\n|---|'+'---|'*len(D))
def row(lab,f): print(f'| {lab} | '+' | '.join(f(r) for _,r,*_ in D)+' |')
row('런',lambda r:str(len(r)))
row('클리어',lambda r:f"{sum(x['cleared'] for x in r)/len(r)*100:.1f}%")
row('정비 방문 (런당)',lambda r:f"{sum(1 for x in r for b in x['ins'].get('br',[]) if b[2]=='maint')/len(r):.2f}")
row('정비 제시 (런당)',lambda r:f"{sum(1 for x in r for b in x['ins'].get('br',[]) if 'maint' in b[1].split(','))/len(r):.2f}")
row('상점 방문 (런당)',lambda r:f"{sum(1 for x in r for b in x['ins'].get('br',[]) if b[2]=='shop')/len(r):.2f}")
def f(x,minN=150):
    if not x or x[0]<minN: return '—' if not x else f'({x[0]}전)'
    return f'{x[3]*100:+.1f} ± {x[4]*100:.1f}'
syns=sorted({b.split('|')[0] for _,_,L,*_ in D for b in L},key=lambda s:(NM.get(s,{}).get('kind',''),NM.get(s,{}).get('name',s)))
for title,idx in (('전체 페이즈',2),('P1~3',3),('P4~6',4)):
    print(f'\n## 단계별 전투 lift — {title} (%p, 같은 페이즈 · 노드 평균 대비, ± 런 군집 95%. 150전 미만은 전투 수만)\n')
    print('| 시너지 | 단계 | '+' | '.join(f'{n} 전투 · 도달 런 | {n} lift' for n,*_ in D)+' |')
    print('|---|---|'+'---|---|'*len(D))
    for s in syns:
        for t in range(1,5):
            xs=[d[idx].get(f'{s}|{t}') for d in D]
            if not any(xs):continue
            nm=NM.get(s,{}).get('name',s);tr=NM.get(s,{}).get('tiers',[])
            cells=[]
            for (n,runs,*_),x in zip(D,xs):
                cells.append(f"{x[0] if x else 0} · {x[1]/len(runs)*100:.0f}%" if x else '0 · 0%'); cells.append(f(x))
            print(f"| {nm} | {t}단계 ({tr[t-1] if len(tr)>=t else '?'}) | "+' | '.join(cells)+' |')
