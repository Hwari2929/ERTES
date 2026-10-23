"""에이든 손 (HAND I 캔버스 확장 EXT 4) 오리기: 넓힌 쪽 모서리선 · 손밑 종이 · 그려진 그림자를 지우고 팔만 남긴다.
  python3 scripts/hand_cut.py <확장본.png> <출력.png>
- 모서리선: 행마다 배경 열의 선 색을 재고, 선 위아래가 배경인 열은 띠 전체, 팔에 걸린 열은 팔 경계까지만 지운다.
- 종이: 넓게 잡은 다각형 안에서 '피부가 아닌 칸' 중 바깥과 이어진 것만 (손가락 속 반사광 · 손톱 광택은 남는다).
- 그림자: 밝은 팔에서 4px 넘게 떨어진 어둡고 채도 낮은 칸. 마지막에 가장 큰 덩어리만 남긴다."""
import sys, numpy as np
from collections import deque
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, 'scripts')
from art import cut_background

src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.int16).copy()
H, W, _ = a.shape
bg = np.array([88, 83, 80])
dist = lambda p: np.abs(p - bg).max(-1)

def flood(seed_mask, passable):
    """seed 에서 passable 칸으로 4방향 번지기"""
    seen = seed_mask & passable
    q = deque(zip(*np.nonzero(seen)))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen

# 1) 모서리선
y0, y1 = 396, 436
cols = [x for x in range(W) if dist(a[y0 - 3, x]) < 14 and dist(a[y1 + 3, x]) < 14]
line = np.zeros((H, W), bool)
for y in range(y0, y1 + 1):
    lc = np.median(a[y, cols], axis=0)
    line[y] = np.abs(a[y] - lc).max(-1) < 22
band = np.zeros((H, W), bool); band[y0:y1 + 1] = True
seed = np.zeros((H, W), bool); seed[y0, :] = True; seed[y1, :] = True
for x in cols: seed[y0:y1 + 1, x] = True
erase = flood(seed & (line | (dist(a) < 14)), band & (line | (dist(a) < 14)))
a[erase] = bg

# 2) 종이: 확장본 좌표로 손가락 아래쪽 윤곽을 손으로 따서, 종이 다각형에서 손 다각형을 뺀 곳을 지운다
PAPER = [(192, 945), (312, 893), (700, 898), (700, 962), (420, 1068), (186, 962)]
HAND = [(332, 878), (300, 905), (290, 918), (286, 935), (292, 950), (286, 960), (288, 975), (298, 987), (320, 996), (345, 997), (370, 989),
        (400, 976), (430, 962), (455, 950), (468, 946), (472, 955), (478, 964), (500, 967), (530, 963), (560, 961), (590, 955), (620, 946), (650, 936), (700, 925), (720, 878)]
pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon(PAPER, fill=255)
hm = Image.new('L', (W, H), 0); ImageDraw.Draw(hm).polygon(HAND, fill=255)
a[(np.asarray(pm) > 0) & ~(np.asarray(hm) > 0)] = bg
# 2b) 손 다각형 안에 남은 종이 (원본 좌표 + 위로 넓힌 384px)
f = a.astype(np.float32) / 255; mx = f.max(2); mn = f.min(2); s = (mx - mn) / (mx + 1e-6); d = mx - mn + 1e-6
r, g, b = f[..., 0], f[..., 1], f[..., 2]
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
oy = 384
P = [(178, 552), (292, 506), (600, 548), (606, 606), (334, 708), (172, 590)]
poly = Image.new('L', (W, H), 0); ImageDraw.Draw(poly).polygon([(x, y + oy) for x, y in P], fill=255)
inpoly = np.asarray(poly) > 0
skin = ((h <= 22) | (h >= 330)) & (s >= 0.16) & (mx > 0.4)
edge = inpoly & ~(np.asarray(poly.filter(ImageFilter.MinFilter(5))) > 0)   # 다각형 테두리 = 바깥과 닿는 곳
paper = flood(edge & ~skin, inpoly & ~skin)
paper = (np.asarray(Image.fromarray((paper * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0) & inpoly
a[paper] = bg

# 3) 오리기 · 그려진 그림자 · 가장 큰 덩어리
cut = np.asarray(cut_background(Image.fromarray(a.astype(np.uint8)))).copy()
fa = cut[..., :3].astype(np.float32) / 255; v = fa.max(2); ss = (fa.max(2) - fa.min(2)) / (v + 1e-6)
near = np.asarray(Image.fromarray(((v > 0.45) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
cut[(v < 0.42) & (ss < 0.2) & ~near, 3] = 0
alpha = cut[..., 3] > 40
hand = np.zeros((H, W), bool); hand[684, 600] = True  # 손등 한 점에서 번진 덩어리만
keep = flood(hand, alpha)
keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
cut[~keep, 3] = 0
Image.fromarray(cut).save(out)
print('saved', out, cut.shape)

# 4) 손 안의 구멍 메우기 · 가장자리 부드럽게
cut = np.asarray(Image.open(out)).copy()
opaque = cut[..., 3] > 0
border = np.zeros((H, W), bool); border[0, :] = border[-1, :] = True; border[:, 0] = border[:, -1] = True
outside = flood(border & ~opaque, ~opaque)
holes = ~opaque & ~outside
if holes.any():
    med = np.asarray(Image.fromarray(cut[..., :3]).filter(ImageFilter.MedianFilter(7)))
    cut[holes, :3] = med[holes]; cut[holes, 3] = 255
specks = (np.abs(cut[..., :3].astype(np.int16) - bg).max(-1) < 18) & opaque & ~(np.asarray(Image.fromarray((~opaque * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0)
if specks.any():
    med = np.asarray(Image.fromarray(cut[..., :3]).filter(ImageFilter.MedianFilter(9)))
    cut[specks, :3] = med[specks]
al = Image.fromarray(cut[..., 3]).filter(ImageFilter.GaussianBlur(0.7))
cut[..., 3] = np.minimum(cut[..., 3], np.asarray(al)) if False else np.asarray(al)
# 5) 엄지 끝 (영수증 밑으로 가는 층) 과 나머지 (영수증 위)
THUMB = [(468, 950), (478, 935), (530, 906), (580, 891), (640, 880), (640, 942), (605, 948), (530, 963), (480, 964)]
tm = Image.new('L', (W, H), 0); ImageDraw.Draw(tm).polygon(THUMB, fill=255); tm = np.asarray(tm.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
tk = Image.new('L', (W, H), 0); ImageDraw.Draw(tk).polygon(THUMB, fill=255); tk = np.asarray(tk.filter(ImageFilter.MaxFilter(5))) > 0  # 엄지 층은 조금 넓게 · 가장자리 단단히 (두 층이 겹치는 곳에 이음새가 비치지 않게)
front = cut.copy(); thumb = cut.copy()
front[..., 3] = (cut[..., 3] * (1 - tm)).astype(np.uint8)
thumb[..., 3] = np.where(tk, cut[..., 3], 0).astype(np.uint8)
Image.fromarray(cut).save(out)
Image.fromarray(front).save(out.replace('.png', '.front.png'))
Image.fromarray(thumb).save(out.replace('.png', '.thumb.png'))
print('layers', out.replace('.png', '.front.png'), out.replace('.png', '.thumb.png'))
