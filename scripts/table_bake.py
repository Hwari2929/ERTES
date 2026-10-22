"""출격 계약 바 테이블: 알베도(조명 없는 나무 무늬) → 노멀 → 한 방향 결 음영을 구워 넣는다.
  python3 scripts/table_bake.py <알베도.png> <출력.webp> [--sheet 미리보기.png]
- 알베도에 남은 큰 밝기 변화(조명 흔적)는 큰 반경 블러로 나눠 평평하게 한다.
- 높이 = 밝기의 고주파 성분 (나뭇결 · 판자 이음), 노멀 = 높이의 기울기.
- 빛 = 왼쪽 위 한 방향 (모든 소품 · 종이 그림자와 같은 방향). 평평한 면의 밝기를 1로 맞춰 평균 밝기는 그대로 둔다.
- 빛 웅덩이는 여기서 굽지 않는다 (화면 맨 위 한 장 .ct-light 가 종이까지 함께 비춘다).
- --bright B --contrast C: 굽고 난 뒤 명도(평균 밝기 배율) · 대비(평균에서 떨어진 정도 배율)를 낮춘다 (종이 밑에서 무늬가 시끄럽지 않게).
- --cool K (0~1): 한색 필터. 채도를 K 만큼 빼고, 밝기는 그대로 둔 채 남색(#1d2a44 쪽) 색조를 K 만큼 섞는다 (네이비 표지 · 파우더 블루 종이와 같은 쪽 온도)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

LIGHT = np.array([-1.0, -1.0, 1.6]); LIGHT /= np.linalg.norm(LIGHT)
STRENGTH = 2.2   # 결 요철 세기
MIX = 0.55       # 음영 섞는 비율

def tone(img, bright=1.0, contrast=1.0):
    a = np.asarray(img).astype(np.float32) / 255
    m = a.mean(axis=(0, 1), keepdims=True)
    a = (m + (a - m) * contrast) * bright
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))

COOL = np.array([0.114, 0.165, 0.267], np.float32)  # 남색 색조 기준 (#1d2a44)

def cool(img, k=0.0):
    if k <= 0: return img
    a = np.asarray(img).astype(np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    grey = np.repeat(lum[..., None], 3, axis=2)
    a = a + (grey - a) * k * 0.6                                  # 채도 빼기
    tint = COOL / (COOL @ np.array([0.299, 0.587, 0.114], np.float32))  # 밝기 1 짜리 남색 색조
    a = a * (1 - k) + (lum[..., None] * tint) * k                # 같은 밝기의 남색 쪽으로
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))

def bake(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    # 1) 조명 흔적 펴기: 큰 반경 평균 밝기로 나눈다
    low = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(90))).astype(np.float32) / 255
    flat = a * (lum.mean() / np.maximum(low, 0.05))[..., None]
    # 2) 높이 → 노멀
    fl = flat @ np.array([0.299, 0.587, 0.114], np.float32)
    h = np.asarray(Image.fromarray(np.clip(fl * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    h = h - np.asarray(Image.fromarray(np.clip(h * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12))).astype(np.float32) / 255
    gy, gx = np.gradient(h)
    n = np.dstack([-gx * STRENGTH * 10, -gy * STRENGTH * 10, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    # 3) 한 방향 빛: 평평한 면 = 1
    shade = np.clip(n @ LIGHT, 0, None) / LIGHT[2]
    shade = 1 + (shade - 1) * MIX
    out = np.clip(flat * shade[..., None], 0, 1)
    return Image.fromarray((out * 255).astype(np.uint8)), Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    img, nrm = bake(src)
    opt = lambda f, d: float(sys.argv[sys.argv.index(f) + 1]) if f in sys.argv else d
    img = cool(tone(img, opt('--bright', 1.0), opt('--contrast', 1.0)), opt('--cool', 0.0))
    img.save(dst, 'WEBP', quality=84, method=6)
    if '--normal' in sys.argv: nrm.save(sys.argv[sys.argv.index('--normal') + 1])
