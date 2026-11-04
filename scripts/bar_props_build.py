#!/usr/bin/env python3
"""바 제조대 일러스트 소품 굽기 (2026-11-04): 고른 원본 art/picked/bar_glass_<잔 id>.webp · bar_printer_front.webp · bar_bell_front.webp (투명 배경)
→ public/art/bar_glass_<잔 id>.webp · bar_printer.webp · bar_bell.webp · bar_ice.webp (art/picked/bar_ice_cube.webp) + src/ui/glassart.gen.ts (잔마다 그림 자리 · 액체가 차는 안쪽 영역).

  python3 scripts/bar_props_build.py

잔 그림은 SVG 잔(src/ui/drinkart.ts SHAPES)과 같은 48 × 72 상자에 같은 높이로 세운다 (바닥 y = 70, 잔마다 높이 = SVG 잔의 높이) → 잔 크기 차이가 그대로 남고,
층 · 얼음 · 가니쉬 그리는 코드를 그대로 쓴다. 액체는 잔 그림 '뒤'에 그린다 — 그래서 잔 안쪽의 반투명 유리만 투명하게 낮춰(INNER_ALPHA) 음료가 비쳐 보이게 굽는다.
안쪽 영역 = 액면 최고점(top) ~ 안쪽 바닥(floor) 사이 줄마다 그림 실루엣(알파)의 좌우 끝에서 벽 두께(inset)만큼 들인 곳. top · floor · inset 은 그림을 보고 정한 값 (GEOM).
잔 그림은 조금 위에서 본 모습이라 수평 단면이 타원으로 보인다 — K = 타원 세로 / 가로 비 [테두리, 바닥] (그림의 테두리 · 바닥 타원을 재서 정함, 2026-11-04).
drinkart 가 층 경계를 그 높이의 타원 앞쪽 호(가운데가 아래로 처짐)로, 액면을 타원 뒤쪽 호 + 윗면으로 그린다 (rows = 줄마다 [y, 왼쪽 x, 오른쪽 x]).
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
# 잔 id: (액면 최고점 top, 안쪽 바닥 floor, 벽 두께 inset — 그림 높이 · 폭에 대한 비율, 테두리 줄 rim, 48×72 상자 안 그림 높이 · 바닥 y = 70)
GEOM = {
    'rock': (0.12, 0.76, 0.06, 0.07, 30),
    'highball': (0.07, 0.91, 0.06, 0.04, 50),
    'pint': (0.09, 0.87, 0.05, 0.05, 58),
    'coupe': (0.09, 0.48, 0.035, 0.07, 34),
    'wine': (0.06, 0.46, 0.045, 0.03, 52),
    'goblet': (0.07, 0.52, 0.045, 0.04, 58),
}
K = {'rock': (0.13, 0.22), 'highball': (0.11, 0.18), 'pint': (0.15, 0.22), 'coupe': (0.11, 0.16), 'wine': (0.16, 0.2), 'goblet': (0.14, 0.18)}
GLASS_PX = 760      # 게임용 잔 그림 높이 (큰 잔 340px × 고해상도 화면)
INNER_ALPHA = 0.38  # 안쪽 반투명 유리 알파 배율 (선 · 강한 반사 = 알파 230 이상은 그대로)
ROWS = 28           # 안쪽 영역 다각형의 줄 수


def silhouette(a, y):
    xs = np.nonzero(a[y] > 40)[0]
    return (int(xs[0]), int(xs[-1])) if len(xs) else None


out = {}
os.makedirs('public/art', exist_ok=True)
for gid, (top, floor, inset, rimf, span) in GEOM.items():
    im = Image.open(f'art/picked/bar_glass_{gid}.webp').convert('RGBA')
    W, H = im.size
    a = np.asarray(im)[..., 3]
    ins = inset * W
    left, right = [], []
    for k in range(ROWS + 1):
        y = int(round((top + (floor - top) * k / ROWS) * (H - 1)))
        s = silhouette(a, y)
        if not s:
            continue
        l, r = s[0] + ins, s[1] - ins
        if r - l < 2:
            c = (s[0] + s[1]) / 2
            l, r = c - 1, c + 1
        left.append((l, y)); right.append((r, y))
    poly = left + right[::-1]
    # 안쪽 반투명 유리를 더 투명하게 (액체가 비치게)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    m = np.asarray(mask) > 0
    arr = np.asarray(im).copy()
    al = arr[..., 3].astype(np.float32)
    soft = m & (al < 230)
    al[soft] *= INNER_ALPHA
    arr[..., 3] = al.astype(np.uint8)
    baked = Image.fromarray(arr, 'RGBA')
    s = GLASS_PX / H
    baked.resize((max(1, round(W * s)), GLASS_PX), Image.LANCZOS).save(f'public/art/bar_glass_{gid}.webp', 'WEBP', quality=86, method=6)
    # 48 × 72 상자 안 자리: 높이 span, 바닥 y = 70, 가운데
    ih = span; iw = span * W / H; ix = 24 - iw / 2; iy = 70 - ih
    P = lambda x, y: (round(ix + x / W * iw, 2), round(iy + y / H * ih, 2))
    pts = [P(x, y) for x, y in poly]
    rs = silhouette(a, int(rimf * (H - 1))) or (0, W - 1)
    r0, r1 = P(rs[0], 0)[0], P(rs[1], 0)[0]
    out[gid] = {
        'img': [round(ix, 2), round(iy, 2), round(iw, 2), round(ih, 2)],
        'liq': 'M' + ' L'.join(f'{x} {y}' for x, y in pts) + ' Z',
        'top': P(0, top * (H - 1))[1], 'bot': P(0, floor * (H - 1))[1],
        'rim': [r0, r1, P(0, rimf * (H - 1))[1]],
        'rows': [[P(l[0], l[1])[1], P(l[0], l[1])[0], P(r[0], r[1])[0]] for l, r in zip(left, right)],
        'k': list(K[gid]),
    }
    print(f'{gid}: {W}×{H} → 48×72 상자 {out[gid]["img"]} · 액면 {out[gid]["top"]} ~ 바닥 {out[gid]["bot"]}')

for src, dst, width in [('bar_printer_front', 'bar_printer', 900), ('bar_bell_front', 'bar_bell', 560), ('bar_ice_cube', 'bar_ice', 320)]:
    im = Image.open(f'art/picked/{src}.webp').convert('RGBA')
    s = width / im.width
    im.resize((width, max(1, round(im.height * s))), Image.LANCZOS).save(f'public/art/{dst}.webp', 'WEBP', quality=86, method=6)
    print(f'{dst}: {width}×{round(im.height * s)}')
    if dst == 'bar_ice': ice = round(im.height / im.width, 4)  # 얼음 그림 세로/가로 (drinkart 가 층으로 쌓는다)

lines = ['// 자동 생성: python3 scripts/bar_props_build.py — 직접 고치지 말 것',
         '/** 바 잔 일러스트 (public/art/bar_glass_<잔 id>.webp) 의 48 × 72 상자 안 자리와 액체 영역: img = [x, y, w, h] · liq = 액체가 차는 안쪽 경로 · top · bot = 가득 찼을 때 액면 · 안쪽 바닥 · rim = 테두리 [x0, x1, y] · rows = 안쪽 줄마다 [y, 왼쪽 x, 오른쪽 x] (위 → 아래) · k = 수평 단면 타원 세로/가로 비 [테두리, 바닥] */',
         'export const GLASS_ART: Record<string, { img: [number, number, number, number]; liq: string; top: number; bot: number; rim: [number, number, number]; rows: [number, number, number][]; k: [number, number] }> = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';',
         '/** 잔 속 얼음 그림 (public/art/bar_ice.webp, 시안 bar_ice_cube 2차 3번) 의 세로 / 가로 */',
         f'export const ICE_ASPECT = {ice};']
open('src/ui/glassart.gen.ts', 'w').write('\n'.join(lines) + '\n')
print('src/ui/glassart.gen.ts')
