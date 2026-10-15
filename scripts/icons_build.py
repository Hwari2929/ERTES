"""능력 아이콘 원본(art/icons/raw/*.png) → src/ui/abilicons.gen.ts (88px WebP 데이터 URI 내장)
  python3 scripts/icons_build.py
"""
import os, io, base64
from PIL import Image
src, S = 'art/icons/raw', 88
items, total = {}, 0
for f in sorted(os.listdir(src)):
  if not f.endswith('.png'):
    continue
  im = Image.open(f'{src}/{f}').convert('RGB')
  w, h = im.size; m = int(min(w, h) * 0.04)  # 가장자리를 살짝 잘라 여백을 줄인다
  im = im.crop((m, m, w - m, h - m)).resize((S, S), Image.LANCZOS)
  b = io.BytesIO(); im.save(b, 'WEBP', quality=72, method=6); total += b.tell()
  items[f[:-4]] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
with open('src/ui/abilicons.gen.ts', 'w') as o:
  o.write('// 자동 생성: python3 scripts/icons_build.py — 직접 고치지 말 것\n')
  o.write('/** 능력 아이콘 (88px WebP 데이터 URI). 키: skill.<기물> · trait.<기물> · ult.<기물> · weapon.<기물> · cantrip.<전공> · passive.<전공> · faith.<신앙> · divine.<전투 유형> */\n')
  o.write('export const ABIL_ICONS: Record<string, string> = {\n')
  for k, v in items.items():
    o.write(f"  '{k}': '{v}',\n")
  o.write('};\n')
print(len(items), f'{total // 1024} KB')
