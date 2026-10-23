"""에이든 손 톤 맞추기: 노멀(모양 + 결)로 왼쪽 위 한 방향 빛을 굽고, 바 테이블처럼 한색 필터를 건다.
  python3 scripts/hand_tone.py <출력 폴더> --cool K [--normal M] [--bright B] [--sat S] [--src public/art]
- 입력: <src>/ct_hand.webp · ct_hand_thumb.webp (scripts/hand_layers.py 결과, 같은 크기 · 같은 원점)
- 모양 노멀: 두 층을 합친 알파의 거리 변환 → √ 로 둥근 높이 (손가락 · 손등이 부풀어 보이게)
  결 노멀: 밝기의 고주파 (주름 · 마디). 둘을 더해 노멀을 만들고, 장면 빛(왼쪽 위)을 손이 돌아간 만큼(장면에서 −16°) 되돌려 비춘다.
- --normal M: 음영 섞는 비율 (0~1) · --cool K: table_bake 와 같은 한색 필터 (채도 K×0.6 빼고 같은 밝기의 남색 K 섞기)
- --bright B: 밝기 배율 · --sat S: 채도 배율 (1 = 그대로) · --detail D: 결(주름 · 마디) 음영 세기 (기본 35)"""
import os, sys
import cv2, numpy as np
from PIL import Image
sys.path.insert(0, 'scripts')
from table_bake import cool

args = sys.argv[1:]
out = args[0]
def opt(k, d): return float(args[args.index(k) + 1]) if k in args else d
K, M, B, S, DT = opt('--cool', 0.28), opt('--normal', 0.45), opt('--bright', 1.0), opt('--sat', 1.0), opt('--detail', 35)
src = args[args.index('--src') + 1] if '--src' in args else 'public/art'
fr = np.asarray(Image.open(f'{src}/ct_hand.webp').convert('RGBA')).astype(np.float32) / 255
th = np.asarray(Image.open(f'{src}/ct_hand_thumb.webp').convert('RGBA')).astype(np.float32) / 255
alpha = np.maximum(fr[..., 3], th[..., 3])
rgb = np.where(fr[..., 3:4] >= th[..., 3:4], fr[..., :3], th[..., :3])
# 모양 높이: 알파 안쪽 거리 → 둥글게
dist = cv2.distanceTransform((alpha > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
hs = np.sqrt(np.minimum(dist, 40) / 40) * 40
hs = cv2.GaussianBlur(hs, (0, 0), 3)
# 결 높이: 밝기 고주파
lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
hd = cv2.GaussianBlur(lum, (0, 0), 1.0) - cv2.GaussianBlur(lum, (0, 0), 8)
h = hs * 0.5 + hd * DT
gy, gx = np.gradient(h)
n = np.dstack([-gx, -gy, np.ones_like(h) * 1.6]); n /= np.linalg.norm(n, axis=2, keepdims=True)
r = np.radians(16)  # 장면에서 손이 −16° 돌아가 있으니 빛을 +16° 되돌린다
lx, ly = -1.0, -1.0
L = np.array([lx * np.cos(r) - ly * np.sin(r), lx * np.sin(r) + ly * np.cos(r), 1.6]); L /= np.linalg.norm(L)
flat = L[2] / np.linalg.norm([0, 0, 1])
shade = np.clip(n @ L, 0, None) / L[2]
shade = 1 + (shade - 1) * M
lit = np.clip(rgb * shade[..., None], 0, 1)
# 채도 · 밝기 · 한색
g = (lit @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
lit = np.clip((g + (lit - g) * S) * B, 0, 1)
lit = np.asarray(cool(Image.fromarray((lit * 255).astype(np.uint8)), K)).astype(np.float32) / 255
os.makedirs(out, exist_ok=True)
for name, layer in (('ct_hand.webp', fr), ('ct_hand_thumb.webp', th)):
    o = np.dstack([lit, layer[..., 3]])
    Image.fromarray((o * 255).astype(np.uint8), 'RGBA').save(f'{out}/{name}', 'WEBP', quality=90, method=6)
print('saved', out, f'cool {K} normal {M} bright {B} sat {S} detail {DT}')
