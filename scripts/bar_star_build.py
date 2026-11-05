#!/usr/bin/env python3
"""바 잔 속 별무리 그림 굽기 (2026-11-05 사용자: 졸리 밀키웨이 · 크리스탈블룸 별무리를 살짝 흐리게 구워 쓴다)
→ public/art/bar_star.webp (128px, 흰 4갈래 별 + 둘레의 옅은 빛, 투명 배경). drinkart ING_FX 가 <image> 로 얹는다 (움직이는 별마다 SVG 필터를 걸면 무겁다).

  python3 scripts/bar_star_build.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 128 * 4  # 크게 그려 줄인다
c = S / 2
glow = Image.new('L', (S, S), 0)
ImageDraw.Draw(glow).ellipse([c - S * 0.16, c - S * 0.16, c + S * 0.16, c + S * 0.16], fill=150)
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.07))
star = Image.new('L', (S, S), 0)
d = ImageDraw.Draw(star)
L, w = S * 0.44, S * 0.055  # 갈래 길이 · 허리 폭
d.polygon([(c, c - L), (c + w, c - w), (c + L, c), (c + w, c + w), (c, c + L), (c - w, c + w), (c - L, c), (c - w, c - w)], fill=255)
d.ellipse([c - S * 0.05, c - S * 0.05, c + S * 0.05, c + S * 0.05], fill=255)
star = star.filter(ImageFilter.GaussianBlur(S * 0.012))  # 살짝 흐림
a = Image.fromarray(np.maximum(np.asarray(glow), np.asarray(star)))
im = Image.new('RGBA', (S, S), (255, 255, 255, 0)); im.putalpha(a)
im = im.resize((128, 128), Image.LANCZOS)
im.save(os.path.join(ROOT, 'public/art/bar_star.webp'), 'WEBP', quality=90, method=6)
print('bar_star: 128×128')
