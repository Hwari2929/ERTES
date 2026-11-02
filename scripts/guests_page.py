#!/usr/bin/env python3
"""바 낯선 손님 명부 검토 페이지 (사용자가 손님마다 '고칠 것' 표시 · 메모 → 아티팩트 db 에 저장).

  python3 scripts/guests_page.py OUT_DIR [--col notes] [--img id=path.png ...]
  → OUT_DIR/index.html (+ OUT_DIR/img/*.webp, 게시용 목록 OUT_DIR/files.json)
  게시: Artifact 도구로 OUT_DIR/index.html, root=OUT_DIR, files=files.json, capabilities={"db": {}}
  읽기: ArtifactData list (collection = --col) → 문서 id = 손님 id, { fix: true|false, memo: '…' }
"""
import argparse, html, json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--col', default='notes'); ap.add_argument('--img', nargs='*', default=[])
a = ap.parse_args()
GROUPS = [('union', '성간 인류 연합'), ('empire', '칼리토 제국'), ('alliance', '헬레니우스 동맹'), ('petra', '주식회사 페트라'), ('pan', '범은하 공동체'), ('tour', '관광객 · 여행자'), ('anon', '익명 손님 그림 (이름 없음)')]
RACE = {'human': '인간', 'beast': '환수', 'machine': '기계', 'wraith': '망령', 'other': '그 밖'}
WHEN = {'day': '낮', 'night': '밤', 'any': '아무 때'}
STYLE = {'vague': '느낌으로', 'photo': '사진으로', 'name': '이름으로', 'usual': '늘 마시던 거'}
TIP = {0: '팁 짬', 1: '팁 보통', 2: '팁 후함'}
SEX = {'f': '여', 'm': '남', 'x': '무성'}
names = open('art/guests/_names.txt').read().split('# 레시피 id')[1]
RECIPE = dict(re.findall(r'^([a-z0-9]+) (.+)$', names, re.M))
e = lambda s: html.escape(str(s or ''))
os.makedirs(f'{a.out}/img', exist_ok=True)
imgs = {}
files = []
for spec in a.img:
    gid, path = spec.split('=', 1)
    im = Image.open(path).convert('RGBA'); im.thumbnail((360, 526))
    out = f'img/{gid}.webp'; im.save(f'{a.out}/{out}', 'WEBP', quality=84); files.append({'path': out}); imgs[gid] = out

sections, nav, total = [], [], 0
for g, label in GROUPS:
    f = f'art/guests/{g}.json'
    if not os.path.exists(f):
        continue
    rows = json.load(open(f))
    races = {}
    for r in rows: races[r['race']] = races.get(r['race'], 0) + 1
    cards = []
    for r in rows:
        total += 1
        gid = r['id']
        chips = [f'<span class="chip race-{r["race"]}">{e(RACE.get(r["race"], r["race"]))}</span>'] + ([f'<span class="chip">{e(r["kind"])}</span>'] if r['kind'] != RACE.get(r['race']) else []) + [f'<span class="chip">{SEX.get(r.get("sex"), "")} · {e(r.get("age", ""))}</span>']
        if g != 'anon':
            chips += [f'<span class="chip">{WHEN[r["when"]]}</span>', f'<span class="chip">{STYLE[r["style"]]}</span>', f'<span class="chip">{TIP[r["tip"]]}</span>']
        dl = [('외형', r['look'])]
        if g != 'anon':
            dl = [('소속', r['org']), ('출신', r['from'])] + dl + [('성격', r['persona']), ('말투', r['voice']), ('오는 이유', r['why']), ('이름 밝히는 화제', r['hook']), ('단골 메뉴', RECIPE.get(r['menu'], r['menu']))]
        pic = f'<img class="pic" src="{imgs[gid]}" alt="{e(r.get("name") or gid)} 시험 그림" width="180" height="263" loading="lazy">' if gid in imgs else ''
        cards.append(f'''<article class="g" id="g-{gid}"{' data-pic' if pic else ''}>{pic}<div class="body"><header><h3>{e(r.get("name") or "이름 없음")}</h3><code>{gid}</code></header>
<div class="chips">{''.join(chips)}</div><dl>{''.join(f'<dt>{k}</dt><dd>{e(v)}</dd>' for k, v in dl)}</dl>
<div class="note"><button class="fix" data-id="{gid}" aria-pressed="false">고칠 것</button><label class="sr" for="m-{gid}">메모</label><textarea id="m-{gid}" data-id="{gid}" rows="1" placeholder="고칠 점 메모 (선택)"></textarea></div></div></article>''')
    summary = ' · '.join(f'{RACE[k]} {v}' for k, v in sorted(races.items(), key=lambda x: -x[1]))
    sections.append(f'<section id="s-{g}"><h2>{label} <small>{len(rows)}명 · {summary}</small></h2>{"".join(cards)}</section>')
    nav.append(f'<a href="#s-{g}">{label.split(" (")[0]} <b>{len(rows)}</b></a>')

intro = '''<section class="intro"><h2>그림 시험 <small>구독 무료 범위 23스텝 · 단원 스탠딩과 같은 화풍 · 투명 배경</small></h2>
<p>왼쪽 두 장은 이 명부의 태그로 한 명씩 뽑은 시험 그림입니다. 오른쪽은 한 장에 10명을 늘어세운 시험인데, 지정한 10명이 아니라 교복 차림 12명이 나와 인물 구분이 사라져서 쓰지 않습니다.</p>
<div class="tests">%s</div></section>''' % ''.join(f'<figure><img src="{imgs[k]}" alt="" width="180" height="263"><figcaption>{c}</figcaption></figure>' for k, c in [('e_duchil', '곽두칠 (제국 · 백호 수인)'), ('u_eve', '이브 카사도 (연합 · 사이보그)'), ('lineup', '한 장에 10명 (쓰지 않음)')] if k in imgs)

tpl = open('tools/guests/tpl.html').read()
page = tpl.replace('%%COL%%', a.col).replace('%%N%%', str(total)).replace('%%NAV%%', ''.join(nav)).replace('%%BODY%%', intro + ''.join(sections))
open(f'{a.out}/index.html', 'w').write(page)
json.dump(files, open(f'{a.out}/files.json', 'w'), ensure_ascii=False)
print(f'{a.out}/index.html · 손님 {total}명 · 그림 {len(files)}장')
