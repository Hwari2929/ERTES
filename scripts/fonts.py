#!/usr/bin/env python3
"""폰트 서브셋 → src/ui/fonts.css (data URI @font-face).

아티팩트는 외부 폰트 호스트를 막고, 게임은 오프라인으로도 돌아야 하므로 폰트를 HTML 안에 넣는다.
- 리디바탕 (@kfonts/ridi-batang) : 제목 · 이야기 · 장식 부호
- Pretendard (pretendard)        : 본문 · 라벨 · 숫자 (디자인 키트의 Paperozi 자리, 키트 폴백 그대로)
글자 범위: 자주 쓰는 한글 2,350자(KS X 1001) + 소스에 쓰인 모든 글자 + ASCII.

사용법:
  npm pack @kfonts/ridi-batang pretendard   # 아무 폴더에서
  tar xzf kfonts-ridi-batang-*.tgz -C ridi && tar xzf pretendard-*.tgz -C pt
  pip install fonttools brotli
  python3 scripts/fonts.py <ridi/package 경로> <pt/package 경로>
"""
import base64, glob, io, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ridi, pt = sys.argv[1], sys.argv[2]

chars = set(chr(c) for c in range(0x20, 0x7F))
for b1 in range(0xB0, 0xC9):  # KS X 1001 한글 2,350자
    for b2 in range(0xA1, 0xFF):
        try: chars.add(bytes([b1, b2]).decode('euc-kr'))
        except UnicodeDecodeError: pass
for path in glob.glob(os.path.join(ROOT, 'src', '**', '*.*'), recursive=True):
    if path.endswith(('.ts', '.html', '.css')) and not path.endswith('fonts.css'):
        chars |= set(open(path, encoding='utf-8').read())
chars = {c for c in chars if c.isprintable()}
text = ''.join(sorted(chars))

def sub(src: str) -> str:
    font = TTFont(src)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return base64.b64encode(buf.getvalue()).decode()

faces = [
    ('Ridibatang', 400, os.path.join(ridi, 'RIDIBatang.woff2')),
    ('Pretendard', 400, os.path.join(pt, 'dist/web/static/woff2/Pretendard-Regular.woff2')),
    ('Pretendard', 600, os.path.join(pt, 'dist/web/static/woff2/Pretendard-SemiBold.woff2')),
    ('Pretendard', 800, os.path.join(pt, 'dist/web/static/woff2/Pretendard-ExtraBold.woff2')),
]
out = ['/* 자동 생성: scripts/fonts.py — 직접 고치지 말 것 */']
for fam, w, src in faces:
    data = sub(src)
    out.append(f"@font-face {{ font-family: '{fam}'; src: url(data:font/woff2;base64,{data}) format('woff2'); font-weight: {w}; font-style: normal; font-display: swap; }}")
    print(f'{fam} {w}: {len(data) * 3 // 4 // 1024} KB')
open(os.path.join(ROOT, 'src', 'ui', 'fonts.css'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(f'glyphs: {len(text)}')
