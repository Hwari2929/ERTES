"""NAI 시안 고르기 페이지 (사용자가 시안을 보고 고르면 아티팩트 db 에 저장된다).

  python3 scripts/pick_page.py OUT_DIR --title "전장 고유 적 시안" --col picks en_sw_cargo en_cr_bats ...
      [--latest N]   각 id 의 art/raw/<id>/ 에서 최근 N장만 (기본: 전부)
      [--icons]      능력 아이콘 시안: art/icons/cand/<id>/ (nai_icon.mjs --cand), 이름은 art/icon_prompts.json 의 name, 정사각 칸.
                     문서 id = 아이콘 id 의 '.' 을 '_' 로 (ult.donovan → ult_donovan), seed = 파일 이름 (예: v2-123456)

  → OUT_DIR/index.html + OUT_DIR/img/<id>_<seed>.webp, 그리고 게시용 files 목록 OUT_DIR/files.json
  게시: Artifact 도구로 OUT_DIR/index.html 을 root=OUT_DIR, files=files.json 내용, capabilities={"db": {}} 로.
  읽기: ArtifactData list (collection = --col) → 문서 id = 시안 id (en_ 뺀 것), seed = 고른 파일 이름 (redo = 다시 뽑기).
  고른 뒤: art/picks.json 에 "<id>": "<seed>.png" → art/picked/<id>.webp → python3 scripts/art.py build <id ...>.
"""
import argparse, html, json, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('ids', nargs='+')
ap.add_argument('--title', default='시안 고르기'); ap.add_argument('--col', default='picks'); ap.add_argument('--latest', type=int, default=0); ap.add_argument('--icons', action='store_true')
a = ap.parse_args()
P = json.load(open('art/icon_prompts.json' if a.icons else 'art/prompts.json'))
TW, TH = (256, 256) if a.icons else (360, 526)
os.makedirs(f'{a.out}/img', exist_ok=True)
rows, files = [], []
for pid in a.ids:
    d = f'art/icons/cand/{pid}' if a.icons else f'art/raw/{pid}'
    pngs = sorted((p for p in os.listdir(d) if p.endswith('.png')), key=lambda p: os.path.getmtime(f'{d}/{p}'))
    if a.latest:
        pngs = pngs[-a.latest:]
    key, name = (pid.replace('.', '_') if a.icons else pid.removeprefix('en_')), P.get(pid, {}).get('name', pid)
    opts = []
    for i, p in enumerate(pngs):
        seed, out = p[:-4], f'img/{key}_{p[:-4]}.webp'
        im = Image.open(f'{d}/{p}').convert('RGBA'); im.thumbnail((TW, TH)); im.save(f'{a.out}/{out}', 'WEBP', quality=82)
        files.append({'path': out})
        opts.append(f'<button class="opt" data-id="{key}" data-seed="{seed}" aria-pressed="false"><img src="{out}" alt="{html.escape(name)} 시안 {i + 1}" loading="lazy" width="{TW}" height="{TH}"><span class="num">{i + 1}</span></button>')
    rows.append(f'<article class="foe" id="f-{key}"><header><h3>{html.escape(name)}</h3><span class="state" data-for="{key}"></span></header><div class="opts">{"".join(opts)}<button class="opt redo" data-id="{key}" data-seed="redo" aria-pressed="false"><span>다시 뽑기</span></button></div></article>')
tpl = open('tools/pick/tpl.html').read()
if a.icons: tpl = tpl.replace('aspect-ratio:360/526', 'aspect-ratio:1/1')
page = tpl.replace('%%TITLE%%', html.escape(a.title)).replace('%%N%%', str(len(a.ids))).replace('%%COL%%', a.col).replace('%%BODY%%', '<section>' + ''.join(rows) + '</section>')
open(f'{a.out}/index.html', 'w').write(page)
json.dump(files, open(f'{a.out}/files.json', 'w'), ensure_ascii=False)
print(f'{a.out}/index.html · 시안 {len(files)}장')
