#!/usr/bin/env python3
"""바 제조대 재료 · 가니쉬 아이콘 굽기: art/raw/prop/bar_ing_<id>/ · bar_gar_<id>/ 의 투명 PNG (scripts/nai_prop.mjs, C안 빈티지 판화)
→ 알파 테두리에 맞춰 자르고 작은 WebP 로 → src/ui/baritems.gen.ts (데이터 URI, 키 'ing.<재료 id>' · 'gar.<가니쉬 id>').

  python3 scripts/bar_items_build.py            # 폴더마다 가장 최근 그림
  art/bar_items_pick.json 에 { "bar_ing_dustrain": "3529743753", ... } 로 시드를 적으면 그 그림을 쓴다

원본(art/raw/)은 깃에 넣지 않는다 — 다시 구울 때는 원본이 있는 작업 환경에서. 생성 기록은 프롬프트(art/prop_prompts.json)와 시드(파일 이름).
"""
import base64, io, json, os, re, sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
P = json.load(open('art/prop_prompts.json'))['props']
PICK = json.load(open('art/bar_items_pick.json')) if os.path.exists('art/bar_items_pick.json') else {}
KEYS = [k for k in P if re.fullmatch(r'bar_(ing|gar)_[a-z0-9]+', k) and not re.fullmatch(r'bar_(ing|gar)_[abc]', k)]
TALL_H, WIDE = 144, 112  # 병 · 통: 높이 144px · 가니쉬 · 둥근 통: 긴 변 112px (화면에서는 절반 크기로 · 고해상도 화면 대비)


def latest(key):
    d = f'art/raw/prop/{key}'
    if not os.path.isdir(d):
        return None
    if key in PICK and os.path.exists(f'{d}/{PICK[key]}.png'):
        return f'{d}/{PICK[key]}.png'
    fs = [f'{d}/{f}' for f in os.listdir(d) if f.endswith('.png')]
    return max(fs, key=os.path.getmtime) if fs else None


out, miss = {}, []
for key in KEYS:
    f = latest(key)
    if not f:
        miss.append(key)
        continue
    im = Image.open(f).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 8 else 0)
    box = a.getbbox() or (0, 0, im.width, im.height)
    pad = int(max(box[2] - box[0], box[3] - box[1]) * 0.04)
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    im = im.crop(box)
    tall = P[key]['h'] > P[key]['w']
    if tall:
        h = TALL_H; w = max(1, round(im.width * h / im.height))
    else:
        s = WIDE / max(im.width, im.height); w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((w, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=82, method=6)
    kind, iid = key[4:7], key[8:]
    out[f'{kind}.{iid}'] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

lines = ['// 자동 생성: python3 scripts/bar_items_build.py — 직접 고치지 말 것',
         "/** 바 제조대 재료 · 가니쉬 그림 (빈티지 판화 · 투명 배경 WebP 데이터 URI). 키 'ing.<재료 id>' · 'gar.<가니쉬 id>' (src/data/bar/drinks.ts) */",
         'export const BAR_ITEM_ART: Record<string, string> = {']
lines += [f"  '{k}': '{v}'," for k, v in sorted(out.items())]
lines.append('};')
open('src/ui/baritems.gen.ts', 'w').write('\n'.join(lines) + '\n')
size = sum(len(v) for v in out.values())
print(f'바 재료 · 가니쉬 그림 {len(out)}개 → src/ui/baritems.gen.ts ({size // 1024}KB)' + (f' · 원본 없음 {len(miss)}: {" ".join(miss)}' if miss else ''))
sys.exit(0)
