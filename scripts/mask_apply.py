"""마스크 붓(tools/mask-paint.html)에서 칠해 저장한 마스크를 원본에 적용한다.
  python3 scripts/mask_apply.py <원본.png|webp> <masks 문서.json> <출력 폴더> [--feather 0.8] [--under thumb]
- masks 문서: ArtifactData get(collection "masks", doc_id <name>, out_dir ...) 로 받은 JSON. 층마다 흰색 PNG data URL.
- --keep 층 (기본 hand) = 남길 곳, 그 밖은 투명.
- 출력: <name>.png (남길 곳만), 그리고 --under 로 준 층마다 <name>.<층>.png (그 층 ∩ 남길 곳) 과 <name>.front.png (남길 곳 − 그 층들).
  예: 에이든 손 = keep 'hand', under 'thumb' → hand.png · hand.thumb.png (영수증 밑) · hand.front.png (영수증 위)
- --feather: 마스크 가장자리 흐림 반경(px). 붓 가장자리 계단을 누그러뜨린다."""
import base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
def opt(k, d=None):
    return args[args.index(k) + 1] if k in args else d
src, docf, out = args[0], args[1], args[2]
keep = opt('--keep', 'hand'); unders = [u for u in (opt('--under', '') or '').split(',') if u]
feather = float(opt('--feather', '0.8'))
doc = json.load(open(docf)); doc = doc.get('data', doc)
im = Image.open(src).convert('RGBA'); W, H = im.size
def layer(k):
    url = doc[k]; raw = base64.b64decode(url.split(',', 1)[1])
    m = Image.open(io.BytesIO(raw)).convert('RGBA').resize((W, H)).getchannel('A')
    if feather > 0: m = m.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(m).astype(np.float32) / 255
os.makedirs(out, exist_ok=True)
rgb = np.asarray(im).astype(np.float32); a0 = rgb[..., 3] / 255
k = layer(keep)
def save(alpha, name):
    o = rgb.copy(); o[..., 3] = np.clip(a0 * alpha, 0, 1) * 255
    Image.fromarray(o.astype(np.uint8)).save(os.path.join(out, name)); print('saved', os.path.join(out, name))
save(k, f'{keep}.png')
if unders:
    rest = k.copy()
    for u in unders:
        m = layer(u); save(k * m, f'{keep}.{u}.png'); rest = rest * (1 - m)
    save(rest, f'{keep}.front.png')
