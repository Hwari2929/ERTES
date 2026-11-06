"""불규칙한 별 하늘 타일 (SVG data URI) — --mt-sky 토큰용. 무작위 위치 · 크기 · 색 · 밝기, 타일 경계에 걸친 별은 반대편에 이어 그린다 (이음매 없음)
사용: python3 scripts/mt_sky.py → CSS 값을 출력 (src/ui/css/01-themes.css 의 --mt-sky 에 붙여 넣는다)"""
import random, urllib.parse

PAPER, MINT, VIOLET = '#ecebe7', '#7fd3bd', '#9a8cf0'


def tile(seed, W, H, n, glints):
    rnd = random.Random(seed)
    parts = []
    def put(x, y, shape):
        for dx in (-W, 0, W):
            for dy in (-H, 0, H):
                X, Y = x + dx, y + dy
                if -6 <= X <= W + 6 and -6 <= Y <= H + 6:
                    parts.append(shape(X, Y))
    for _ in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        u = rnd.random()
        r = 0.45 + rnd.random() * 0.35 if u < 0.68 else (0.85 + rnd.random() * 0.4 if u < 0.93 else 1.3 + rnd.random() * 0.5)
        c = rnd.choices([PAPER, MINT, VIOLET], weights=[72, 14, 14])[0]
        o = round(0.45 + rnd.random() * 0.5 if r < 0.9 else 0.65 + rnd.random() * 0.35, 2)
        put(x, y, lambda X, Y, r=r, c=c, o=o: f"<circle cx='{X:.1f}' cy='{Y:.1f}' r='{r:.2f}' fill='{c}' fill-opacity='{o}'/>")
    for _ in range(glints):  # 네 갈래 반짝이 별 (둥근 오목 변)
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        s = 2.6 + rnd.random() * 1.6
        c = rnd.choice([PAPER, MINT, VIOLET])
        put(x, y, lambda X, Y, s=s, c=c: f"<path d='M{X:.1f} {Y - s:.1f}Q{X:.1f} {Y:.1f} {X + s:.1f} {Y:.1f}Q{X:.1f} {Y:.1f} {X:.1f} {Y + s:.1f}Q{X:.1f} {Y:.1f} {X - s:.1f} {Y:.1f}Q{X:.1f} {Y:.1f} {X:.1f} {Y - s:.1f}Z' fill='{c}' fill-opacity='.9'/>")
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='{W}' height='{H}' viewBox='0 0 {W} {H}'>" + ''.join(parts) + '</svg>'
    enc = svg.replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E').replace('"', "'")
    return f'url("data:image/svg+xml,{enc}") 0 0 / {W}px {H}px', len(enc)


a, la = tile(11, 600, 400, 92, 3)
b, lb = tile(29, 470, 330, 52, 2)
val = f'{a},\n    {b}'
print(val)
import sys; print('bytes', la, lb, file=sys.stderr)
