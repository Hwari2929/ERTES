"""표정 차분 색 보정: 다시 그린 얼굴 부위의 색 분포(RGB 평균)를 원본 얼굴에 맞춘다.
  python3 scripts/face_fix.py art/faces_raw/*.png
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
F = json.load(open('art/faces.json'))
for path in sys.argv[1:]:
  name = path.split('/')[-1]; uid = name.split('.')[0]
  src = Image.open(f'art/picked/{uid}.webp').convert('RGBA'); img = Image.open(path).convert('RGBA')
  cx, brow, chin = F[uid]; h = chin - brow
  m = Image.new('L', src.size, 0)
  ImageDraw.Draw(m).ellipse((cx - h * 1.05, brow - h * 0.95, cx + h * 1.05, brow + h * 1.28), fill=255)
  a = np.array(src.split()[3]) > 200
  sel = (np.array(m) > 0) & a
  rs = np.array(src.convert('RGB')).astype(float); ri = np.array(img.convert('RGB')).astype(float)
  # 밝은 피부 영역 위주로 (선 · 머리카락 제외) RGB 평균 차이만 옮긴다
  lum = rs.mean(axis=2)
  skin = sel & (lum > np.percentile(lum[sel], 40))
  shift = rs[skin].mean(axis=0) - ri[skin].mean(axis=0)
  fixed = Image.fromarray(np.clip(ri + shift, 0, 255).astype('uint8'), 'RGB').convert('RGBA')
  soft = m.filter(ImageFilter.GaussianBlur(h * 0.18))
  soft = Image.fromarray(np.minimum(np.array(soft), np.array(src.split()[3])))
  res = Image.composite(fixed, img, soft); res.putalpha(img.split()[3])
  res.save(path)
  print(uid, name, 'fixed')
