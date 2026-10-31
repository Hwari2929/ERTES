"""NovelAI img2img (배경 등 일반 이미지).
  python3 scripts/nai_i2i.py <입력.png> <출력 폴더> --prompt "..." [--strength 0.6] [--noise 0.2] [--n 4]
  배경 공용 태그(art/bg_prompts.json 의 base · negative)를 붙인다.
  유료(Anlas) 29스텝 · 1회 최대 8장 · 동시 실행 금지 · 장 사이 6~15초 (scripts/nai_guard.py).
"""
import base64, io, json, os, random, ssl, sys, time, urllib.request, zipfile
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from nai_guard import STEPS, guard, pause
args = sys.argv[1:]
def opt(k, d=None):
  return args[args.index(k) + 1] if k in args else d
src, out = args[0], args[1]
os.makedirs(out, exist_ok=True)
cfg = json.load(open('art/nai.config.json')); B = json.load(open('art/bg_prompts.json'))
im = Image.open(src).convert('RGB'); W, H = im.size
bio = io.BytesIO(); im.save(bio, 'PNG'); img = base64.b64encode(bio.getvalue()).decode()
prompt = f"{opt('--prompt')}, {B['base']}"; neg = B['negative']
ctx = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
HEAD = {'Authorization': f"Bearer {os.environ['NOVELAI_TOKEN']}", 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Origin': 'https://novelai.net', 'Referer': 'https://novelai.net/'}
N = int(opt('--n', '4'))
guard(N)
for k in range(N):
  seed = random.randrange(2**32)
  p = {'params_version': 3, 'width': W, 'height': H, 'scale': cfg['scale'], 'sampler': cfg['sampler'], 'steps': STEPS, 'n_samples': 1, 'ucPreset': 0, 'qualityToggle': False,
       'seed': seed, 'extra_noise_seed': seed, 'noise_schedule': cfg['noise_schedule'], 'negative_prompt': neg, 'image': img,
       'strength': float(opt('--strength', '0.6')), 'noise': float(opt('--noise', '0.2')), 'cfg_rescale': 0, 'sm': False, 'sm_dyn': False, 'dynamic_thresholding': False, 'legacy': False, 'add_original_image': True,
       'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True},
       'v4_negative_prompt': {'caption': {'base_caption': neg, 'char_captions': []}, 'legacy_uc': False}}
  body = json.dumps({'input': prompt, 'model': cfg['model'], 'action': 'img2img', 'parameters': p}).encode()
  for a in range(5):
    try:
      with urllib.request.urlopen(urllib.request.Request('https://image.novelai.net/ai/generate-image', data=body, headers=HEAD), context=ctx, timeout=240) as r: data = r.read(); break
    except urllib.error.HTTPError as e:
      if e.code == 429: time.sleep(8 * (a + 1)); continue
      print('HTTP', e.code, e.read()[:200]); data = None; break
  if not data: continue
  z = zipfile.ZipFile(io.BytesIO(data)); open(f'{out}/{seed}.png', 'wb').write(z.read(z.namelist()[0])); print('ok', seed)
  if k < N - 1: pause()
