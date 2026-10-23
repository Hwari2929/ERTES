"""에이든 손 임시본: 마스크 테두리를 매끄럽게 정리해 장면용 두 층으로 굽는다 (마스크 붓으로 다시 칠하면 이 스크립트를 다시 돌린다).
  python3 scripts/hand_layers.py <원본 확장본.png> <masks 문서.json> [--scale 0.9]
- 테두리 정규화: 마스크를 가우스(σ 3) 흐림 → 0.5 문턱 → σ 0.9 흐림 (계단 · 뾰족한 잔가지를 둥글게, 가장자리 1px 부드럽게)
- 새로 메워진 테두리 칸의 색은 주변 피부 · 소매에서 메워(cv2.inpaint) 배경 회색이 비치지 않게
- 출력: public/art/ct_hand.webp (영수증 위: 손 − 엄지 끝) · public/art/ct_hand_thumb.webp (영수증 밑: 엄지 끝)
  둘은 같은 크기 · 같은 원점 (잘라낸 사각형). 잘라낸 원점과 집는 점은 표준 출력에 찍는다."""
import base64, io, json, sys
import cv2, numpy as np
from PIL import Image, ImageFilter
args = sys.argv[1:]
src, docf = args[0], args[1]
scale = float(args[args.index('--scale') + 1]) if '--scale' in args else 0.9
doc = json.load(open(docf)); doc = doc.get('data', doc)
im = np.asarray(Image.open(src).convert('RGB')); H, W, _ = im.shape
def m(k):
    raw = base64.b64decode(doc[k].split(',', 1)[1])
    return np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA').resize((W, H)).getchannel('A')).astype(np.float32) / 255
def smooth(a, s1=3.0, s2=0.9):
    b = cv2.GaussianBlur(a, (0, 0), s1); b = (b > 0.5).astype(np.float32)
    return cv2.GaussianBlur(b, (0, 0), s2)
hand = smooth(m('hand')); thumb = smooth(m('thumb'), 2.0, 0.8)
# 테두리 색: 원래 손 안쪽(확실한 곳)이 아닌 칸은 안쪽 색으로 메운다
sure = cv2.erode((m('hand') > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8))
fill = ((hand > 0.02) & (sure == 0)).astype(np.uint8) * 255
rgb = cv2.inpaint(im[..., ::-1].copy(), fill, 5, cv2.INPAINT_TELEA)[..., ::-1]
rgb = np.where(sure[..., None] > 0, im, rgb)
ys, xs = np.nonzero(hand > 0.02); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
def out(alpha, path):
    o = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])[y0:y1, x0:x1]
    img = Image.fromarray(o, 'RGBA'); img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img.save(path, 'WEBP', quality=90, method=6); print('saved', path, img.size)
front = hand * (1 - thumb)
th = hand * cv2.dilate((thumb > 0.02).astype(np.float32), np.ones((5, 5), np.uint8))  # 엄지 층은 조금 넓게 (두 층 이음새가 비치지 않게)
out(front, 'public/art/ct_hand.webp'); out(th, 'public/art/ct_hand_thumb.webp')
pinch = (300, 975)  # 확장본 좌표: 검지 끝 (영수증 왼쪽 위에 얹힌다)
print('crop origin', (int(x0), int(y0)), 'size', (int(x1 - x0), int(y1 - y0)), 'scale', scale)
print('pinch in asset px', (round((pinch[0] - x0) * scale), round((pinch[1] - y0) * scale)))
