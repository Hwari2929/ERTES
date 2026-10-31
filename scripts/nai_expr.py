"""NovelAI 전신 img2img 로 스탠딩 표정 차분 만들기 (Anlas 사용).
  python3 scripts/nai_expr.py <id> <face...> [--strength 0.5] [--noise 0.3] [--seed N] [--subtle] [--out art/picked]
원본: art/raw/<id>/<picks.json 의 파일> (없으면 art/picked/<id>.webp) — 원래 생성 프롬프트에 표정 태그를 얹어 전신을 다시 그린다.
유료(Anlas) 29스텝 · 1회 최대 8장 · 동시 실행 금지 · 장 사이 6~15초 (scripts/nai_guard.py).
결과: <out>/<id>.<face>.webp (art.py build 가 기본 스탠딩과 같은 틀로 잘라 public/art 에 낸다)
"""
import base64, io, json, os, random, ssl, sys, time, urllib.request, zipfile
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from nai_guard import STEPS, guard, pause

FACE_TAGS = {
  'smile': 'smile, happy, gentle smile',
  'serious': 'serious, determined, closed mouth, slight frown',
  'angry': 'angry, furrowed brow, glaring, clenched teeth',
  'surprise': 'surprised, wide eyes, open mouth, raised eyebrows',
  'worried': 'worried, troubled, raised inner eyebrows, sweatdrop, nervous',
  'sad': 'sad, downcast eyes, frown',
}
SUBTLE = {
  'smile': 'light smile, closed mouth smile',
  'serious': 'serious, closed mouth, slight frown',
  'angry': 'annoyed, slight frown, closed mouth',
  'surprise': 'slightly surprised, raised eyebrows, small open mouth',
  'worried': 'worried, raised inner eyebrows, closed mouth',
  'sad': 'sad, downcast eyes, closed mouth',
}
# 기물별로 표정이 바뀌어도 지킬 특징
KEEP = {
  'yelena': 'heterochromia, white eye, blue eye, left eye white, right eye blue',
  'franze': 'red eyes, pale skin',
  'temur': 'dark skin',
}
# 표정을 미리 적어 둔 원래 프롬프트에서 걷어낼 태그
STRIP = ['calm smile, ', 'slight smile, ', 'faint smile, ', 'smile, ', 'smirk, ', 'grin, ', 'open mouth, ', 'sharp eyes, ', 'expressionless, ']

args = sys.argv[1:]
def opt(k, d=None):
  return args[args.index(k) + 1] if k in args else d
VAL = {'--strength', '--noise', '--seed', '--out'}
pos = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] not in VAL)]
uid, faces = pos[0], pos[1:]
out = opt('--out', 'art/picked')
os.makedirs(out, exist_ok=True)
cfg = json.load(open('art/nai.config.json'))
token = os.environ['NOVELAI_TOKEN']
pick = json.load(open('art/picks.json'))[uid]
log = [x for x in json.load(open('art/gen-log.json')) if x['id'] == uid and (f"{x['seed']}.png" == pick or f"{x.get('alt')}-{x['seed']}.png" == pick)]
base_prompt = log[-1]['prompt'] if log else uid
for t in STRIP:
  base_prompt = base_prompt.replace(t, '')
raw = f'art/raw/{uid}/{pick}'
src = Image.open(raw if os.path.exists(raw) else f'art/picked/{uid}.webp').convert('RGBA')
W, H = src.size
flat = Image.new('RGB', (W, H), (255, 255, 255)); flat.paste(src, mask=src.split()[3])
bio = io.BytesIO(); (flat if '--flat' in args else src).save(bio, 'PNG'); img_b64 = base64.b64encode(bio.getvalue()).decode()
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE', '/root/.ccr/ca-bundle.crt'))
HEAD = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Origin': 'https://novelai.net', 'Referer': 'https://novelai.net/'}
NEG = cfg['negative']

guard(len(faces))
for n, face in enumerate(faces):
  tags = (SUBTLE if '--subtle' in args else FACE_TAGS)[face]
  keep = f', ::1.2::{KEEP[uid]}::' if uid in KEEP else ''
  prompt = f'::1.5::{tags}::{keep}, {base_prompt}'
  seed = int(opt('--seed') or random.randrange(2**32))
  params = {
    'params_version': 3, 'width': W, 'height': H, 'scale': cfg['scale'], 'sampler': cfg['sampler'], 'steps': STEPS,
    'n_samples': 1, 'ucPreset': 0, 'qualityToggle': False, 'seed': seed, 'extra_noise_seed': seed, 'noise_schedule': cfg['noise_schedule'],
    'negative_prompt': NEG, 'image': img_b64, 'strength': float(opt('--strength', '0.5')), 'noise': float(opt('--noise', '0.3')),
    'cfg_rescale': 0, 'sm': False, 'sm_dyn': False, 'dynamic_thresholding': False, 'legacy': False, 'add_original_image': True,
    'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True},
    'v4_negative_prompt': {'caption': {'base_caption': NEG, 'char_captions': []}, 'legacy_uc': False},
  }
  if cfg.get('transparent'):
    params.update(straight_alpha=True, tag_hint_transparent_background=True)
  body = {'input': prompt, 'model': cfg['model'], 'action': 'img2img', 'parameters': params}
  data = None
  for attempt in range(5):
    req = urllib.request.Request('https://image.novelai.net/ai/generate-image', data=json.dumps(body).encode(), headers=HEAD)
    try:
      with urllib.request.urlopen(req, context=ctx, timeout=240) as r:
        data = r.read(); break
    except urllib.error.HTTPError as e:
      if e.code == 429: time.sleep(8 * (attempt + 1)); continue
      print(uid, face, 'HTTP', e.code, e.read()[:300]); break
  if not data:
    continue
  z = zipfile.ZipFile(io.BytesIO(data))
  im = Image.open(io.BytesIO(z.read(z.namelist()[0])))
  im = im.convert('RGBA') if 'A' in im.getbands() else im.convert('RGB')
  im.save(f'{out}/{uid}.{face}.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
  print(uid, face, 'ok', seed, im.mode)
  if n < len(faces) - 1: pause()
