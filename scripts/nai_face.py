"""NovelAI 인페인팅으로 스탠딩 표정 차분 만들기.
  python3 scripts/nai_face.py yelena smile angry ...     (기물 id, 표정 키들)
  --model nai-diffusion-4-5-full-inpainting  --seed N  --out art/faces_raw
원본: art/picked/<id>.webp (RGBA) · 얼굴 위치: art/faces.json [중심 x, 눈썹 y, 턱 y]
유료(Anlas) 29스텝 · 1회 최대 8장 · 동시 실행 금지 · 장 사이 6~15초 (scripts/nai_guard.py).
얼굴 부위만 다시 그린 뒤 원본 알파 위에 부드럽게 합성 → <out>/<id>.<face>.png
"""
import base64, io, json, os, random, ssl, sys, time, urllib.request, zipfile
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from nai_guard import STEPS, guard, pause

FACE_TAGS = {
  'smile': 'smile, happy, gentle smile, closed eyes smile',
  'serious': 'serious, determined, frown, closed mouth, narrowed eyes',
  'angry': 'angry, furrowed brow, clenched teeth, glaring, v-shaped eyebrows',
  'surprise': 'surprised, wide eyes, open mouth, raised eyebrows, :o',
  'worried': 'worried, troubled, sweatdrop, raised inner eyebrows, wavy mouth, nervous',
  'sad': 'sad, downcast eyes, frown, teary eyes',
  'smug': 'smug, smirk, half-closed eyes, raised eyebrow',
  'shy': 'blush, embarrassed, looking away, shy smile',
  'tired': 'tired, half-closed eyes, sigh, exhausted',
  'laugh': 'laughing, open mouth smile, closed eyes, happy',
  'grin': 'grin, toothy smile, confident',
  'blank': 'expressionless, blank stare, empty eyes, closed mouth',
}
# 표정 변화를 작게 (--subtle)
SUBTLE = {
  'smile': 'light smile, closed mouth smile',
  'serious': 'serious, closed mouth, slight frown',
  'angry': 'annoyed, slight frown, closed mouth, furrowed brow',
  'surprise': 'slightly surprised, raised eyebrows, small open mouth',
  'worried': 'worried, raised inner eyebrows, closed mouth, sweatdrop',
}
# 기물별 고정 특징 (표정이 바뀌어도 유지)
KEEP = {
  'yelena': '::1.3::heterochromia, white eye, blue eye, left eye white, right eye blue::',
  'franze': '::1.3::red eyes, glowing red eyes, pale skin::',
  'temur': '::1.3::dark skin, tan skin::',
  'phyllis': 'gold hair ornament, one eye closed',
  'lindiwe': 'earrings',
  'franze': '::1.3::red eyes, glowing red eyes, pale skin::',
  'temur': '::1.3::dark skin, tan skin::',
  'phyllis': 'gold hair ornament, one eye closed',
  'lindiwe': 'earrings',
}
args = sys.argv[1:]
def opt(k, d=None):
  return args[args.index(k) + 1] if k in args else d
vals = {opt('--model'), opt('--seed'), opt('--out')}
pos = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or not args[i - 1].startswith('--'))]
uid, faces = pos[0], pos[1:]
model = opt('--model', cfg_model := json.load(open('art/nai.config.json'))['model'])
mode = opt('--mode', 'img2img')
out = opt('--out', 'art/faces_raw')
os.makedirs(out, exist_ok=True)
token = os.environ['NOVELAI_TOKEN']
cfg = json.load(open('art/nai.config.json'))
pick = json.load(open('art/picks.json'))[uid]
log = [x for x in json.load(open('art/gen-log.json')) if x['id'] == uid and f"{x['seed']}.png" == pick]
base_prompt = log[-1]['prompt'] if log else uid
cx, brow, chin = json.load(open('art/faces.json'))[uid]
src = Image.open(f'art/picked/{uid}.webp').convert('RGBA')
W, H = src.size
flat = Image.new('RGB', (W, H), (255, 255, 255)); flat.paste(src, mask=src.split()[3])
h = chin - brow
# 얼굴 주변만 잘라 1024 로 키워서 다시 그린다 (전신 크기 그대로면 얼굴이 작아 뭉개진다)
side = int(h * 3.4)
cy = (brow + chin) / 2
crop = (int(cx - side / 2), int(cy - side * 0.5), int(cx + side / 2), int(cy + side * 0.5))
S = 1024
flatc = flat.crop(crop).resize((S, S), Image.LANCZOS)
k = S / side
fx, fy = (cx - crop[0]) * k, (brow - crop[1]) * k
hh = h * k
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).ellipse((int(fx - hh * 1.05), int(fy - hh * 0.95), int(fx + hh * 1.05), int(fy + hh * 1.28)), fill=255)
def b64(im):
  bio = io.BytesIO(); im.save(bio, 'PNG'); return base64.b64encode(bio.getvalue()).decode()
NEG = cfg['negative'] + ', glasses, eyewear, goggles, mask, blindfold, bandage, face paint, censor bar'
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE', '/root/.ccr/ca-bundle.crt'))
guard(len(faces))
for n, face in enumerate(faces):
  tags = (SUBTLE if '--subtle' in args else FACE_TAGS)[face]
  if uid in KEEP: tags = f'{tags}, {KEEP[uid]}'
  prompt = base_prompt.replace('transparent background, ', 'white background, ').replace('full body, ', 'portrait, upper body, face focus, ').replace('standing illustration, ', '').replace('calm smile, ', '').replace('smile, ', '')
  prompt = f'::1.5::{tags}::, {prompt}'
  seed = int(opt('--seed') or random.randrange(2**32))
  body = {'input': prompt, 'model': model, 'action': mode, 'parameters': {
    'params_version': 3, 'width': S, 'height': S, 'scale': cfg['scale'], 'sampler': cfg['sampler'], 'steps': STEPS,
    'n_samples': 1, 'ucPreset': 0, 'qualityToggle': False, 'seed': seed, 'noise_schedule': cfg['noise_schedule'], 'negative_prompt': NEG,
    'image': b64(flatc), **({'mask': b64(mask)} if mode == 'infill' else {}), 'extra_noise_seed': seed, 'strength': float(opt('--strength', '0.7')), 'noise': 0, 'add_original_image': False, 'inpaintImg2ImgStrength': 1,
    'cfg_rescale': 0, 'sm': False, 'sm_dyn': False, 'dynamic_thresholding': False, 'legacy': False,
    'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True},
    'v4_negative_prompt': {'caption': {'base_caption': NEG, 'char_captions': []}, 'legacy_uc': False}}}
  for attempt in range(4):
    req = urllib.request.Request('https://image.novelai.net/ai/generate-image', data=json.dumps(body).encode(), headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Origin': 'https://novelai.net', 'Referer': 'https://novelai.net/'})
    try:
      with urllib.request.urlopen(req, context=ctx, timeout=180) as r: data = r.read(); break
    except urllib.error.HTTPError as e:
      if e.code == 429: time.sleep(8 * (attempt + 1)); continue
      print(face, 'HTTP', e.code, e.read()[:300]); data = None; break
  if not data: continue
  z = zipfile.ZipFile(io.BytesIO(data)); gen = Image.open(io.BytesIO(z.read(z.namelist()[0]))).convert('RGB')
  soft = mask.filter(ImageFilter.GaussianBlur(hh * 0.18))
  patch = Image.composite(gen, flatc, soft).resize((crop[2] - crop[0], crop[3] - crop[1]), Image.LANCZOS)
  pm = soft.resize(patch.size, Image.LANCZOS)
  res = src.copy()
  layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); layer.paste(patch.convert('RGBA'), crop[:2])
  lm = Image.new('L', (W, H), 0); lm.paste(pm, crop[:2])
  lm = Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(lm), __import__('numpy').array(src.split()[3])))
  res = Image.composite(layer, res, lm)
  res.save(f'{out}/{uid}.{face}.png'); print(uid, face, 'ok', seed)
  if n < len(faces) - 1: pause()
