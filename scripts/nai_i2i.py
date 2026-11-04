"""NovelAI img2img (배경 등 일반 이미지).
  python3 scripts/nai_i2i.py <입력.png> <출력 폴더> --prompt "..." [--strength 0.6] [--noise 0.2] [--n 4] [--plain] [--neg "..."]
  배경 공용 태그(art/bg_prompts.json 의 base · negative)를 붙인다.
  --plain: 배경 공용 태그 대신 품질 태그만 (소품 한 개 — 화풍은 프롬프트에서 정한다) · --neg: 부정 태그를 이것으로 (없으면 배경 공용 negative)
  투명 배경(RGBA) 입력은 흰 바탕에 얹어 보낸다 (결과는 흰 바탕 — art.py cut_background 로 오린다).
  편집이라 유료(Anlas) 29스텝 · 1회 최대 8장 · 동시 실행 금지 · 장 사이 6~16초 (scripts/nai_guard.py).
"""
import base64, io, json, os, random, ssl, sys, time, urllib.request, zipfile
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from nai_guard import STEPS, backoff, guard, pause
args = sys.argv[1:]
def opt(k, d=None):
  return args[args.index(k) + 1] if k in args else d
src, out = args[0], args[1]
os.makedirs(out, exist_ok=True)
cfg = json.load(open('art/nai.config.json')); B = json.load(open('art/bg_prompts.json'))
im0 = Image.open(src)
if im0.mode in ('RGBA', 'LA') or 'transparency' in im0.info:
  bg = Image.new('RGBA', im0.size, (255, 255, 255, 255)); bg.alpha_composite(im0.convert('RGBA')); im = bg.convert('RGB')
else:
  im = im0.convert('RGB')
W, H = im.size
bio = io.BytesIO(); im.save(bio, 'PNG'); img = base64.b64encode(bio.getvalue()).decode()
prompt = f"{opt('--prompt')}, no humans, best quality, masterpiece, highres, year2026" if '--plain' in args else f"{opt('--prompt')}, {B['base']}"
neg = opt('--neg') or B['negative']
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
      if e.code == 429: backoff(a); continue
      print('HTTP', e.code, e.read()[:200]); data = None; break
  if not data: continue
  z = zipfile.ZipFile(io.BytesIO(data)); open(f'{out}/{seed}.png', 'wb').write(z.read(z.namelist()[0])); print('ok', seed)
  if k < N - 1: pause()
