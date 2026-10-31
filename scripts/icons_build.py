"""능력 아이콘 원본(art/icons/raw/*.png) → src/ui/abilicons.gen.ts (88px WebP 데이터 URI 내장)
  python3 scripts/icons_build.py
원본 폴더에 없는 아이콘은 지금 abilicons.gen.ts 의 것을 그대로 둔다 (원본은 깃에 없어 새 환경에서는 새로 뽑은 것만 있다).
원본이 있는 아이콘만 새로 굽는다. 지우려면 abilicons.gen.ts 에서 직접 지운다.
"""
import os, io, re, base64
from PIL import Image
src, S, OUT = 'art/icons/raw', 88, 'src/ui/abilicons.gen.ts'
# 기존 아이콘 (키 순서 유지)
items = dict(re.findall(r"^  '([^']+)': '([^']+)',$", open(OUT).read(), re.M)) if os.path.exists(OUT) else {}
baked, total = 0, 0
os.makedirs(src, exist_ok=True)
for f in sorted(os.listdir(src)):
  if not f.endswith('.png'):
    continue
  im = Image.open(f'{src}/{f}').convert('RGB')
  w, h = im.size; m = int(min(w, h) * 0.04)  # 가장자리를 살짝 잘라 여백을 줄인다
  im = im.crop((m, m, w - m, h - m)).resize((S, S), Image.LANCZOS)
  b = io.BytesIO(); im.save(b, 'WEBP', quality=72, method=6); total += b.tell()
  items[f[:-4]] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode(); baked += 1
with open(OUT, 'w') as o:
  o.write('// 자동 생성: python3 scripts/icons_build.py — 직접 고치지 말 것\n')
  o.write('/** 능력 아이콘 (88px WebP 데이터 URI). 키: skill.<기물> · trait.<기물> · ult.<기물> · weapon.<기물> · cantrip.<전공> · passive.<전공> · faith.<신앙> · divine.<전투 유형> */\n')
  o.write('export const ABIL_ICONS: Record<string, string> = {\n')
  for k, v in items.items():
    o.write(f"  '{k}': '{v}',\n")
  o.write('};\n')
print(f'{len(items)}개 (원본에서 구움 {baked} · 기존 그대로 {len(items) - baked} · 구운 용량 {total // 1024} KB)')
