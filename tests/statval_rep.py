# 주요 능력치 가치 측정 집계 (tests/balance.ts statval 기록 sv). 사용: python3 tests/statval_rep.py <폴더 (parts/*.json)>
# 전투당 승률 · 여유(아군 체력비 − 적 체력비) 차를 크레딧 사다리(공명도 구매 16 · 32 · 64 크레딧)의 페이즈별 기울기로 크레딧 환산한다.
import json, glob, math, collections
import sys
S=sys.argv[1] if len(sys.argv) > 1 else '.'  # 조각 폴더의 부모 (parts/*.json 이 있는 곳)
NAME={'vit':'생명력','pow':'전투력','mnd':'정신력','def':'방어력','agi':'기동력'}
CT={'VAN':'돌격가','MARK':'명사수','CMD':'지휘관','SPEC':'전문가','SUP':'지원가','ASN':'암살자'}
recs=[]
for f in sorted(glob.glob(S+'/parts/*.json')):
    bot=f.split('/')[-1].split('_')[0]
    for r in json.load(open(f))['runs']:
        for x in r.get('sv') or []:
            x['bot']=bot; recs.append(x)
print('기록', len(recs), '전투 시드', sum(x['n'] for x in recs))
def d(x, res):  # 승 · 여유(아군 체력비 − 적 체력비) 차, 전투당
    b=x['base']; n=x['n']
    return ((res[0]-b[0])/n, ((res[1]-res[2])-(b[1]-b[2]))/n)
# 크레딧 사다리: 페이즈별 Δm / K 기울기 (원점 통과)
lad=collections.defaultdict(lambda:[0,0,0,0])
for x in recs:
    for name,res in x['v']:
        if name.startswith('cr:'):
            K=int(name[3:]); dw,dm=d(x,res); a=lad[x['ph']]; a[0]+=K*dm; a[1]+=K*K; a[2]+=K*dw; a[3]+=1
slope={ph:(a[0]/a[1], a[2]/a[1]) for ph,a in lad.items()}
allA=[sum(lad[p][i] for p in lad) for i in range(3)]
slopeAll=(allA[0]/allA[1], allA[2]/allA[1])
print('크레딧 1당 여유 · 승률(%%p): 전체 %.5f · %.4f' % (slopeAll[0], 100*slopeAll[1]))
for ph in sorted(slope): print('  페이즈', ph, '여유 %.5f · 승률 %.4f%%p (n=%d)' % (slope[ph][0], 100*slope[ph][1], lad[ph][3]))
def stats(vals):
    n=len(vals); m=sum(vals)/n; sd=math.sqrt(sum((v-m)**2 for v in vals)/max(1,n-1)); return m, 1.96*sd/math.sqrt(n), n
out={}
# 팀 +5: 출전 전원에게 +5 → 기물 1명 1점당 = Δ / (5 × 출전 수)
print('\n[팀 +5 (출전 전원)] 전투당 승률 · 여유 · 크레딧 환산 (페이즈 기울기로)')
for s in ['pow','def','mnd','vit','agi']:
    W=[];M=[];C=[];P=[]
    for x in recs:
        for name,res in x['v']:
            if name==f'team:{s}':
                dw,dm=d(x,res); k=len(x['dep']); W.append(dw); M.append(dm); C.append(dm/slope[x['ph']][0]); P.append(dm/slope[x['ph']][0]/(5*k))
    w=stats(W); m=stats(M); c=stats(C); p=stats(P)
    out['team:'+s]={'win':w,'m':m,'cr':c,'crPerPt':p}
    print(f'  {NAME[s]}: 승률 {100*w[0]:+.2f} ±{100*w[1]:.2f}%p · 여유 {m[0]:+.4f} · 팀 +5 = {c[0]:.1f} ±{c[1]:.1f} 크레딧 · 기물 1명 1점 = {p[0]:.2f} 크레딧 (n={w[2]})')
# 기물 1명 +10: 전투 유형별
print('\n[기물 1명 +10] 1점당 크레딧 환산 (전투 유형별)')
by=collections.defaultdict(list); byW=collections.defaultdict(list)
for x in recs:
    ct={u[0]:u[1] for u in x['dep']}
    for name,res in x['v']:
        if name.startswith('unit:'):
            _,uid,s=name.split(':'); dw,dm=d(x,res)
            by[(ct.get(uid,'?'),s)].append(dm/slope[x['ph']][0]/10); by[('전체',s)].append(dm/slope[x['ph']][0]/10); byW[('전체',s)].append(dw/10)
cts=['전체']+sorted({k[0] for k in by if k[0]!='전체'})
print('  유형      ' + ''.join(f'{NAME[s]:>12}' for s in ['pow','def','mnd','vit','agi']))
for c in cts:
    row=[]
    for s in ['pow','def','mnd','vit','agi']:
        v=by.get((c,s))
        if v: m,e,n=stats(v); row.append(f'{m:6.2f}±{e:4.2f}'); out.setdefault('unit',{})[f'{c}:{s}']=[m,e,n]
        else: row.append(' '*11)
    print(f'  {CT.get(c,c):8}' + ' '.join(row) + f'  (n={len(by.get((c,"pow"),[]))})')
for s in ['pow','def','mnd','vit','agi']:
    w=stats(byW[('전체',s)]); print(f'  {NAME[s]} 1점 승률 {100*w[0]:+.3f} ±{100*w[1]:.3f}%p')
# 페이즈별 팀 +5 크레딧
print('\n[팀 +5] 페이즈별 크레딧')
for ph in sorted(slope):
    row=[]
    for s in ['pow','def','mnd','vit','agi']:
        v=[d(x,res)[1]/slope[ph][0] for x in recs if x['ph']==ph for name,res in x['v'] if name==f'team:{s}']
        m,e,n=stats(v); row.append(f'{NAME[s]} {m:5.1f}')
    print(f'  페이즈 {ph}: ' + ' · '.join(row) + f' (n={n})')
json.dump(out, open(S+'/statval_rep.json','w'), ensure_ascii=False)
