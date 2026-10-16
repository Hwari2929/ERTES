# 한글 수사 + 단위 → 아라비아 숫자 (일회성 변환 도우미). 사용: python3 scripts/numfix.py [--apply] 파일...
# '한'(하나) · '첫' · 어림수(한두, 두세) · 친족 서수(둘째 딸) · 높임 '분'(두 분)은 바꾸지 않는다 (tests/number_check.ts 허용 목록과 같다).
import re, sys
ONES = {'하나':1,'둘':2,'두':2,'셋':3,'세':3,'석':3,'서':3,'넷':4,'네':4,'넉':4,'너':4,'다섯':5,'여섯':6,'일곱':7,'여덟':8,'아홉':9}
TENS = {'열':10,'스물':20,'스무':20,'서른':30,'마흔':40,'쉰':50,'예순':60,'일흔':70,'여든':80,'아흔':90}
SINO = {'일':1,'이':2,'삼':3,'사':4,'오':5,'육':6,'칠':7,'팔':8,'구':9}
ONE_RE = '다섯|여섯|일곱|여덟|아홉|두|세|석|네|넉'
TEN_RE = '스물|스무|서른|마흔|예순|일흔|여든|아흔|열|쉰'
BIG_RE = '(?:[이삼사오육칠팔구]?천)?(?:[이삼사오육칠팔구]?백)?'
# 고유어 수 (단위 앞 형태: 두 · 세 · 네 …, 열한 · 스물두 …, 백열두 처럼 한자어 백 · 천이 앞에 붙을 수 있다)
NATIVE = f'(?:{BIG_RE}(?:{TEN_RE})(?:{ONE_RE}|한|둘|셋|넷)?|{BIG_RE}(?:{ONE_RE}))'
# 한자어 수 (삼십 · 이백 · 십오): 반드시 띄어 쓴 것만 ('오십시오' · '천장' 오탐 방지)
SINO_RE = '(?:[이삼사오육칠팔구]?천)?(?:[이삼사오육칠팔구]?백)?(?:[이삼사오육칠팔구]?십)?[일이삼사오육칠팔구]?'
NUM = f'(?:{NATIVE}|둘|셋|넷)'
UNITS = '번째|건|문제|문장|글자|자리|그루|바늘|끼|숟갈|합|쌍|페이즈|시간|개월|주일|그릇|접시|마리|조각|마디|봉지|상자|포대|걸음|바퀴|송이|켤레|퍼센트|미터|킬로미터|킬로|크레딧|남매|형제|군데|모금|덩이|페이지|가지|개|번|명|잔|살|시|초|층|권|장|척|대|년|달|병|줄|칸|판|곡|편|통|알|근|배|위|호|벌|쪽|회|겹|입|갑|점|분|째|해|주'
PAT = re.compile(rf'(?<![가-힣0-9])({NUM})(\s?)({UNITS})(?![가-힣])|(?<![가-힣0-9])({NUM})(\s?)({UNITS})(?=[가-힣])|(?<![가-힣0-9])({SINO_RE})( )({UNITS})(?![가-힣])|(?<![가-힣0-9])({SINO_RE})( )({UNITS})(?=[가-힣])')
def val(s):
    n=0
    m=re.match(rf'^(?:([이삼사오육칠팔구]?)천)?(?:([이삼사오육칠팔구]?)백)?(.*)$',s)
    if '천' in s.split('백')[0] if '백' in s else '천' in s:
        pass
    a,b,rest=m.group(1),m.group(2),m.group(3)
    if s.find('천')>=0 and (s.find('백')<0 or s.find('천')<s.find('백')): n+=(SINO.get(a,1) if a else 1)*1000
    if '백' in s: n+=(SINO.get(b,1) if b else 1)*100
    r=rest
    m2=re.match(r'^([이삼사오육칠팔구]?)십([일이삼사오육칠팔구]?)$',r)
    if m2: return n+(SINO.get(m2.group(1),1) if m2.group(1) else 1)*10+(SINO.get(m2.group(2),0) if m2.group(2) else 0)
    if r in SINO and n: return n+SINO[r]
    for t,v in TENS.items():
        if r.startswith(t):
            n+=v; r=r[len(t):]; break
    if r=='한': r='하나'
    if r: n+=ONES[r]
    return n
KIN = re.compile(r'(둘|셋|넷|다섯|여섯)째\s?(딸|아들|형|누나|언니|오빠|동생|며느리|사위|손자|손녀|이모|삼촌|도련님|아가씨)')
ORD = re.compile(r'(?<![가-힣])(둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열)째(\s(?:줄|잔|자리|방법|날|판|칸|장|그릇|접시|조각|병|곡|문제))')
DAY_N = {'이틀':2,'사흘':3,'나흘':4,'닷새':5,'엿새':6,'열흘':10}
DAYS = re.compile(r'(?<![가-힣])(이틀|사흘|나흘|닷새|엿새|열흘)')
ORD_N = {'둘':2,'셋':3,'넷':4,'다섯':5,'여섯':6,'일곱':7,'여덟':8,'아홉':9,'열':10}
def fix(line):
    out=[]; cnt=0
    line, k0 = ORD.subn(lambda m: f'{ORD_N[m.group(1)]}번째{m.group(2)}', line)
    line, k1 = DAYS.subn(lambda m: f'{DAY_N[m.group(1)]}일', line)
    cnt += k0 + k1
    def rep(m):
        nonlocal cnt
        g=[i for i in (1,4,7,10) if m.group(i)]
        if not g: return m.group(0)
        i=g[0]; num=m.group(i); sp=m.group(i+1); unit=m.group(i+2)
        whole=m.group(0)
        sino = i>=7
        if sino and not re.search('[십백천]', num) and not (num in '삼육칠팔구오' and len(num)==1 and unit in ('초','분','년','미터','킬로미터','퍼센트','개월','시간')): return whole  # 한 글자 한자어(이 · 사 · 일)는 단어일 때가 많다
        if num in ('둘','셋','넷') and unit!='째': return whole
        if unit=='째': return whole  # 맨 서수(둘째 · 셋째)는 아래 ORD 에서 뒤 명사가 있을 때만
        if not sino and unit=='분': return whole  # 고유어 + 분 = 높임 (두 분 · 일곱 분)
        if unit=='째' and num in ('둘','셋','넷','다섯','여섯','일곱','여덟','아홉','열'):  # 셋째 → 3번째 (친족은 아래에서 제외)
            pass
        if unit=='째' and sp: return whole
        if unit in ('시','해','주','배','점','입','위','장','대','통','판','줄','알','벌','편','달','갑','분','년','살','층','칸','쪽','근','호','회','겹','곡','병','척','권','초') and num in ('세','네','두','서','너') and not sp:
            return whole  # 붙여 쓴 '세시' 같은 단어 오탐 방지: 띄어 쓴 것만
        if num in ('서','너') and unit not in ('번째',): return whole
        try: v=val(num)
        except Exception: return whole
        cnt+=1
        if unit=='달': return f'{v}개월'
        if unit=='해': return f'{v}년'
        return f'{v}{unit}'
    if KIN.search(line) or re.search(r'(한두|두세|서너|두어|대여섯|예닐곱|일고여덟)', line):
        # 친족 서수 · 어림수가 있는 줄은 그 부분만 보존
        keep={}
        def hold(m):
            k=f'\x00{len(keep)}\x00'; keep[k]=m.group(0); return k
        line=re.sub(r'(한두|두세|서너|두어|대여섯|예닐곱|일고여덟)\s?\S+|' + KIN.pattern, hold, line)
        line=PAT.sub(rep,line)
        for k,v in keep.items(): line=line.replace(k,v)
        return line,cnt
    return PAT.sub(rep,line),cnt
if __name__=='__main__':
    apply='--apply' in sys.argv
    tot=0
    for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
        L=open(f,encoding='utf8').read().split('\n'); c=0
        for i,l in enumerate(L):
            n,k=fix(l)
            if k:
                c+=k
                if not apply and '--quiet' not in sys.argv: print(f'{f}:{i+1}: {l.strip()[:110]}\n   → {n.strip()[:110]}')
                L[i]=n
        if apply and c: open(f,'w',encoding='utf8').write('\n'.join(L))
        if c: print(f'## {f}: {c}')
        tot+=c
    print('total',tot)
