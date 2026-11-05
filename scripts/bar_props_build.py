#!/usr/bin/env python3
"""바 제조대 일러스트 소품 굽기 (2026-11-04): 고른 원본 art/picked/bar_glass_<잔 id>.webp · bar_printer_front.webp · bar_bell_front.webp (투명 배경)
→ public/art/bar_glass_<잔 id>.webp · bar_printer.webp · bar_bell.webp · bar_ice_0~3.webp (얼음 4종) · 고른 잔 위 가니쉬 bar_ong_* · 카운터 소품 bar_prop_* + src/ui/glassart.gen.ts (잔마다 그림 자리 · 액체가 차는 안쪽 영역).

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
# 잔 id: (액면 최고점 top, 안쪽 바닥 floor, 벽 두께 inset — 그림 높이 · 폭에 대한 비율, 테두리 줄 rim, 48×72 상자 안 그림 높이 · 바닥 y = 70[, curve, p])
#   curve · p = 아래로 갈수록 벽 두께를 더하는 양 (폭 비율, 바닥에서 curve, 위에서부터 t^p 로) — 와인 잔은 볼 바닥이 급하게 오목해져 U 자로 (2026-11-05 사용자)
GEOM = {
    'rock': (0.12, 0.76, 0.06, 0.07, 30),
    'highball': (0.07, 0.91, 0.06, 0.04, 50),
    'pint': (0.09, 0.87, 0.05, 0.05, 58),
    'coupe': (0.09, 0.48, 0.035, 0.07, 34),
    'wine': (0.06, 0.50, 0.045, 0.03, 52, 0.06, 3),
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
for gid, g in GEOM.items():
    top, floor, inset, rimf, span = g[:5]; curve, cp = (g[5], g[6]) if len(g) > 5 else (0, 1)
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
        e = curve * W * (k / ROWS) ** cp
        l, r = s[0] + ins + e, s[1] - ins - e
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

# 얼음 그림 4종 (2026-11-04 사용자 선택, 쌓인 얼음마다 번갈아): 0 원본 3번 · 1 투명 프롬프트 1 · 2 · 3 img2img 0.65 1번 · 6번 + 후처리 3 (art/bar_items_pick.json)
ICE_SRC = ['bar_ice_cube', 'bar_ice_clear', 'bar_ice_i2i_a', 'bar_ice_i2i_b']
def pp3(im):
    """후처리 3 (얼음 몸통 걷기): 알파 a → a · smoothstep(중앙값 + 0.03, 97% 값, a) — 테두리 · 반사광만 남는다"""
    A = np.asarray(im).astype(np.float32) / 255; a = A[..., 3]; m = a[a > 0.03]
    lo, hi = float(np.median(m)) + 0.03, float(np.quantile(m, 0.97)); t = np.clip((a - lo) / (hi - lo), 0, 1)
    A[..., 3] = a * t * t * (3 - 2 * t)
    return Image.fromarray((A * 255).astype(np.uint8), 'RGBA')


ICE_PP = {'bar_ice_cube'}  # 원본 3번도 다른 시안과 같은 후처리로 더 투명하게 (2026-11-04 사용자) — 나머지 셋은 picked 가 이미 후처리됨
ice = []
for src, dst, width in [('bar_printer_front', 'bar_printer', 900), ('bar_bell_front', 'bar_bell', 560), ('bar_bubble', 'bar_bubble', 192)] + [(k, f'bar_ice_{i}', 320) for i, k in enumerate(ICE_SRC)]:
    im = Image.open(f'art/picked/{src}.webp').convert('RGBA')
    if src in ICE_PP: im = pp3(im)
    s = width / im.width
    im.resize((width, max(1, round(im.height * s))), Image.LANCZOS).save(f'public/art/{dst}.webp', 'WEBP', quality=86, method=6)
    print(f'{dst}: {width}×{round(im.height * s)}')
    if dst.startswith('bar_ice_'): ice.append(round(im.height / im.width, 4))  # 얼음 그림 세로/가로 (drinkart 가 층으로 쌓는다)

# 역광 테두리 마스크 (2026-11-05 시험): 잔 실루엣의 바깥 가장자리 띠 (흰색, 알파 = 띠) → public/art/bar_glass_<잔 id>_rim.webp. 색 · 한쪽 쏠림은 drinkart 가 장면마다
from PIL import ImageFilter as _IF
for gid in GEOM:
    im = Image.open(f'public/art/bar_glass_{gid}.webp').convert('RGBA'); a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    r = max(3, round(im.width * 0.022)) | 1
    inner = a.filter(_IF.MinFilter(r)); edge = Image.fromarray(np.clip(np.asarray(a, np.int16) - np.asarray(inner, np.int16), 0, 255).astype(np.uint8)).filter(_IF.GaussianBlur(1.2))
    rim = Image.new('RGBA', im.size, (255, 255, 255, 0)); rim.putalpha(edge); rim.save(f'public/art/bar_glass_{gid}_rim.webp', 'WEBP', quality=86, method=6)
print('역광 테두리', list(GEOM))

# 잔 위 가니쉬 (bar_ong_<가니쉬 id>) · 카운터 소품 (bar_prop_<종류>): 고른 원본 art/picked/<키>.webp → public/art/<키>.webp (긴 변 320px), 세로/가로 비를 gen 으로
picked = json.load(open('art/bar_items_pick.json'))
props_ar = {}
for key in sorted(k for k in picked if k.startswith('bar_ong_') or k.startswith('bar_prop_')):
    im = Image.open(f'art/picked/{key}.webp').convert('RGBA')
    sc = 320 / max(im.size)
    im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS).save(f'public/art/{key}.webp', 'WEBP', quality=86, method=6)
    props_ar[key.removeprefix('bar_')] = round(im.height / im.width, 4)
print('가니쉬 · 소품', len(props_ar))

# 거품 · 기포 텍스처 (2026-11-04 사용자: 3 · 7 · 8 고름, 혼합 plus-lighter · 거품 screen · 흐림 0.15): 배경을 지운 원본 art/picked/bar_foam_<번호>.webp
# → 2×2 뒤집어 붙인 이음매 없는 타일 768px + 흐림을 미리 굽는다 (움직이는 층에 SVG 필터를 걸면 매 프레임 다시 계산해 무겁다).
# 흐림 = 0.15 (48 × 72 상자 단위) × 768 / 타일 한 변 — drinkart FOAM_FX 의 가장 큰 타일 기준
from PIL import ImageFilter, ImageOps
FOAM_BLUR, FOAM_TILE = 0.15, {'3': 44, '7': 28, '8': 40}
for k, tile in FOAM_TILE.items():
    im = Image.open(f'art/picked/bar_foam_{k}.webp').convert('RGBA'); w, h = im.size
    t = Image.new('RGBA', (w * 2, h * 2)); t.paste(im, (0, 0)); t.paste(ImageOps.mirror(im), (w, 0)); t.paste(ImageOps.flip(im), (0, h)); t.paste(ImageOps.flip(ImageOps.mirror(im)), (w, h))
    t = t.resize((768, 768), Image.LANCZOS).filter(ImageFilter.GaussianBlur(FOAM_BLUR * 768 / tile))
    t.save(f'public/art/bar_foam_{k}.webp', 'WEBP', quality=88, method=6)
print('거품 텍스처', list(FOAM_TILE))

lines = ['// 자동 생성: python3 scripts/bar_props_build.py — 직접 고치지 말 것',
         '/** 바 잔 일러스트 (public/art/bar_glass_<잔 id>.webp) 의 48 × 72 상자 안 자리와 액체 영역: img = [x, y, w, h] · liq = 액체가 차는 안쪽 경로 · top · bot = 가득 찼을 때 액면 · 안쪽 바닥 · rim = 테두리 [x0, x1, y] · rows = 안쪽 줄마다 [y, 왼쪽 x, 오른쪽 x] (위 → 아래) · k = 수평 단면 타원 세로/가로 비 [테두리, 바닥] */',
         'export const GLASS_ART: Record<string, { img: [number, number, number, number]; liq: string; top: number; bot: number; rim: [number, number, number]; rows: [number, number, number][]; k: [number, number] }> = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';',
         '/** 잔 속 얼음 그림 (public/art/bar_ice_<번호>.webp — 원본 3번 · 투명 프롬프트 1 · img2img 0.65 1번 · 6번 후처리) 의 세로 / 가로, 쌓인 얼음마다 번갈아 쓴다 */',
         f'export const ICE_ART: number[] = {json.dumps(ice)};',
         '/** 고른 잔 위 가니쉬 (ong_<가니쉬 id>) · 카운터 소품 (prop_<종류>) 그림 (public/art/bar_<키>.webp) 의 세로 / 가로 — 없는 것은 선 그림 */',
         'export const PROP_ART: Record<string, number> = ' + json.dumps(props_ar, ensure_ascii=False, separators=(',', ':')) + ';']
open('src/ui/glassart.gen.ts', 'w').write('\n'.join(lines) + '\n')
print('src/ui/glassart.gen.ts')
