"""레이첼의 핫초코 머그 (MUG A): 흰 바탕에서 오리고, 그려진 그림자는 반투명한 어둠으로 바꾼다 (나무 위에 깔리게).
  python3 scripts/mug_cut.py <원본.png> <출력.webp> [--size 300] [--cool 0.16]
- 90° 반시계로 돌린다: 그려진 그림자가 오른쪽 아래로 (장면의 왼쪽 위 빛 · 다른 소품 그림자와 같은 쪽), 손잡이는 위 (카운터 쪽). 돌리기만으로는 그림자 오른쪽 아래 + 손잡이 아래가 함께 안 된다
- 머그 = 남색 테두리 · 손잡이 + 그 고리 안 (코코아 · 거품). 나머지 흰 바탕이 아닌 곳 = 그림자 → 검정, 알파 = 바탕보다 어두운 만큼
- --cool: 벨과 같은 한색 필터 (scripts/table_bake.py cool)"""
import sys
import cv2, numpy as np
from PIL import Image
sys.path.insert(0, 'scripts')
from table_bake import cool
args = sys.argv[1:]
src, dst = args[0], args[1]
size = int(args[args.index('--size') + 1]) if '--size' in args else 300
K = float(args[args.index('--cool') + 1]) if '--cool' in args else 0.16
im = Image.open(src).convert('RGB').rotate(90, expand=True)  # PIL 의 +90 = 반시계
a = np.asarray(im).astype(np.float32) / 255
L = a @ np.array([0.299, 0.587, 0.114], np.float32)
mx, mn = a.max(2), a.min(2); sat = (mx - mn) / (mx + 1e-6)
bg = np.median(np.concatenate([L[:10, :10].ravel(), L[-10:, -10:].ravel(), L[:10, -10:].ravel(), L[-10:, :10].ravel()]))
solid = ((a[..., 2] > a[..., 0] + 0.04) & (L < 0.7)).astype(np.uint8)  # 남색 유약 (테두리 · 손잡이). 안쪽 코코아 · 거품은 아래에서 고리 안을 메워 얻는다 (그림자는 난색이라 빠진다)
solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
# 구멍(거품 · 반사) 메우기: 테두리에서 번진 바깥이 아닌 곳은 모두 머그
h, w = solid.shape
ff = solid.copy() * 255; mask = np.zeros((h + 2, w + 2), np.uint8)
cv2.floodFill(ff, mask, (0, 0), 128)
mug = ((ff != 128) & ~((L > bg - 0.04) & (sat < 0.08))).astype(np.float32)  # 손잡이 고리 안의 흰 바탕은 빼고
mug = cv2.GaussianBlur(mug, (0, 0), 1.0)
# 그림자: 머그 밖에서 바탕보다 어두운 만큼
sh = np.clip((bg - L) / bg * 1.9, 0, 0.62) * (1 - mug)
sh = cv2.GaussianBlur(sh, (0, 0), 2.0)
rgb = np.asarray(cool(Image.fromarray((a * 255).astype(np.uint8)), K)).astype(np.float32) / 255
dark = np.array([0.10, 0.07, 0.06], np.float32)
alpha = np.clip(mug + sh, 0, 1)
col = (rgb * mug[..., None] + dark * sh[..., None]) / np.maximum(alpha[..., None], 1e-4)
out = np.dstack([np.clip(col, 0, 1), alpha])
ys, xs = np.nonzero(alpha > 0.02); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
img = Image.fromarray((out[y0:y1, x0:x1] * 255).astype(np.uint8), 'RGBA')
s = size / max(img.size); img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
img.save(dst, 'WEBP', quality=90, method=6); print('saved', dst, img.size)
