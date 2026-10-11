"""스탠딩 · 초상화 에셋 파이프라인.

  python3 scripts/art.py pick     art/picks.json 의 선택본(art/raw) → art/picked/<id>.webp (보관용 원본, 깃에 넣음)
  python3 scripts/art.py faces    머리 위치를 못 정한 기물만 자동 추정 → art/faces.json [머리 중심 x, y, 머리 높이] (손으로 고쳐도 됨)
  python3 scripts/art.py build    art/picked + art/faces.json → public/art/<id>.webp (전신)
                                  + public/art/<id>.bust.webp (머리 크기를 맞춘 상반신 배너)
                                  + src/ui/portraits.gen.ts (머리 크기를 맞춘 아이콘, 데이터 URI 내장)
  NAI V5 투명 배경 원본(RGBA)은 그대로 쓰고, 흰 배경 원본만 배경을 깎는다.
  python3 scripts/art.py sheet OUT.png   아이콘 확인용 시트
  python3 scripts/art.py holes OUT.png   갇힌 배경 후보 표시 (art/cut.json 에 지울 점 기록)
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PICKS, FACES, CUTS, PICKED, OUT = 'art/picks.json', 'art/faces.json', 'art/cut.json', 'art/picked', 'public/art'
STAND_H, ICON = 960, 128
# 머리 크기 정규화: 아이콘은 머리 높이의 ICON_K 배 정사각, 배너는 머리 높이를 BUST_HEAD px 로 맞춘 BUST_W×BUST_H
ICON_K, BUST_W, BUST_H, BUST_HEAD, BUST_CY = 1.45, 480, 360, 120, 105


def load_json(p, default):
    return json.load(open(p)) if os.path.exists(p) else default


def ids():
    return list(json.load(open('art/prompts.json')))


def cmd_pick():
    picks = json.load(open(PICKS))
    os.makedirs(PICKED, exist_ok=True)
    for i, f in picks.items():
        src = f'art/raw/{i}/{f}'
        if f == 'user' or not os.path.exists(src):
            continue  # 사용자 제공본은 이미 art/picked 에 있음
        im = Image.open(src)
        im = im.convert('RGBA') if 'A' in im.getbands() else im.convert('RGB')
        im.save(f'{PICKED}/{i}.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
        print('pick', i, f)


def cut_background(im, holes=()):
    """테두리에 닿은 배경색 영역만 투명하게 (선 안쪽 흰 옷은 유지). 경계 1~2px 은 배경색을 빼서 반투명으로.
    holes: 팔과 몸 사이처럼 갇힌 배경 — art/cut.json 에 적은 점에서 추가로 지운다."""
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    corners = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3), rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.abs(rgb - bg).max(axis=2)
    # 테두리에서 번지는 배경 (PIL floodfill 로 연결 성분 찾기)
    near = Image.fromarray(((dist < 26) * 255).astype(np.uint8)).copy()
    near.paste(255, (0, 0, w, 3)); near.paste(255, (0, h - 3, w, h)); near.paste(255, (0, 0, 3, h)); near.paste(255, (w - 3, 0, w, h))  # 원본 테두리선 무시
    for x, y in holes:
        if near.getpixel((x, y)) == 255:
            ImageDraw.floodfill(near, (x, y), 128)
    for x, y in [(x, 0) for x in range(0, w, 7)] + [(x, h - 1) for x in range(0, w, 7)] + [(0, y) for y in range(0, h, 7)] + [(w - 1, y) for y in range(0, h, 7)]:
        if near.getpixel((x, y)) == 255:
            ImageDraw.floodfill(near, (x, y), 128)
    bgmask = np.asarray(near) == 128
    # 경계 띠: 배경을 2px 팽창한 영역
    band = np.asarray(Image.fromarray((bgmask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    band &= ~bgmask
    alpha = np.ones((h, w), np.float32)
    alpha[bgmask] = 0
    a = np.clip(dist / 110.0, 0, 1)
    alpha[band] = np.minimum(alpha[band], a[band])
    # 배경색 언믹스: c = (c - (1-a)·bg) / a
    safe = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((rgb - (1 - alpha[..., None]) * bg) / safe, 0, 255)
    col[alpha == 0] = 0
    out = np.dstack([col, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def cut_of(i):
    im = Image.open(f'{PICKED}/{i}.webp')
    if 'A' in im.getbands() and im.getextrema()[3][0] < 8:
        return im.convert('RGBA')  # 생성 단계에서 이미 투명
    return cut_background(im, load_json(CUTS, {}).get(i, ()))


def cmd_holes(out):
    """갇힌 배경 후보(넓은 순수 배경색 덩어리)를 번호와 함께 빨갛게 표시 → art/cut.json 에 고를 점 기록."""
    C, T = 6, 300
    tiles = []
    for i in ids():
        im = Image.open(f'{PICKED}/{i}.webp').convert('RGB')
        cut = cut_of(i)
        a = np.asarray(cut.split()[-1])
        rgb = np.asarray(im).astype(np.int16)
        bg = np.array([255, 255, 255]) if a.min() > 0 else rgb[np.asarray(a) == 0].mean(axis=0)
        cand = ((np.abs(rgb - bg).max(axis=2) < 10) & (a == 255))
        m = Image.fromarray((cand * 255).astype(np.uint8)).copy()
        found = []
        for y in range(0, im.height, 6):
            for x in range(0, im.width, 6):
                if m.getpixel((x, y)) == 255:
                    ImageDraw.floodfill(m, (x, y), 100 + len(found) % 100)
                    area = (np.asarray(m) == 100 + len(found) % 100).sum()
                    if area > 1500:
                        found.append((x, y, int(area)))
                    ImageDraw.floodfill(m, (x, y), 1)
        if not found:
            continue
        view = im.copy(); d = ImageDraw.Draw(view)
        for n, (x, y, area) in enumerate(found):
            tint = Image.new('RGB', im.size, (255, 0, 0))
            mm = Image.fromarray((cand * 255).astype(np.uint8)).copy()
            ImageDraw.floodfill(mm, (x, y), 77)
            view.paste(tint, (0, 0), Image.fromarray(((np.asarray(mm) == 77) * 160).astype(np.uint8)))
            d.text((x, y), str(n), fill=(0, 0, 255))
        print(i, [(n, x, y, area) for n, (x, y, area) in enumerate(found)])
        view.thumbnail((T, T * 1.5)); tiles.append((i, view))
    sheet = Image.new('RGB', (C * T, ((len(tiles) + C - 1) // C) * (int(T * 1.5) + 14)), 'white'); d = ImageDraw.Draw(sheet)
    for n, (i, v) in enumerate(tiles):
        x, y = (n % C) * T, (n // C) * (int(T * 1.5) + 14)
        sheet.paste(v, (x, y)); d.text((x + 4, y + int(T * 1.5)), i, fill='black')
    sheet.save(out)


def guess_face(im):
    """알파 기준 머리 추정: 몸통 중심 위의 첫 덩어리를 머리로, 목(가장 좁은 줄)까지를 머리 높이로. 앉은 자세·비인간은 손으로 고친다."""
    a = np.asarray(im.split()[-1]) > 128
    h, w = a.shape
    ys = np.nonzero(a.any(axis=1))[0]
    top0, bot = int(ys[0]), int(ys[-1])
    hf = bot - top0
    torso = a[top0 + int(hf * 0.2): top0 + int(hf * 0.45)]
    cols = torso.sum(axis=0)
    bx = int((np.arange(w) * cols).sum() / max(1, cols.sum()))
    win = slice(max(0, bx - int(w * 0.16)), min(w, bx + int(w * 0.16)))
    rows = a[:, win].sum(axis=1)
    top = next((y for y in range(top0, bot - 30) if (rows[y:y + 30] > 12).all()), top0)
    lo, hi = top + int(hf * 0.08), top + int(hf * 0.22)
    neck = lo + int(np.argmin(rows[lo:hi])) if hi > lo else top + hf // 7
    head = neck - top if hf * 0.09 < neck - top < hf * 0.21 else hf // 7
    band = a[top:top + head, win]
    c = band.sum(axis=0)
    cx = win.start + int((np.arange(c.size) * c).sum() / max(1, c.sum()))
    return [cx, top + head // 2, int(head)]


def cmd_faces():
    faces = load_json(FACES, {})
    for i in ids():
        if i in faces or not os.path.exists(f'{PICKED}/{i}.webp'):
            continue
        faces[i] = guess_face(cut_of(i))
        print('face', i, faces[i])
    json.dump(faces, open(FACES, 'w'), indent=1)


def icon_of(cut, face):
    cx, cy, hh = face
    s = int(hh * ICON_K)
    box = (cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2)
    # 원본 밖으로 나가는 크롭도 허용 (투명으로 채움)
    canvas = Image.new('RGBA', (cut.width + 2 * s, cut.height + 2 * s), (0, 0, 0, 0))
    canvas.paste(cut, (s, s))
    return canvas.crop((box[0] + s, box[1] + s, box[2] + s, box[3] + s)).resize((ICON, ICON), Image.LANCZOS)


def bust_of(cut, face):
    """머리 높이를 BUST_HEAD px 로 맞추고 머리 중심을 (가운데, BUST_CY) 에 둔 상반신 배너"""
    cx, cy, hh = face
    k = BUST_HEAD / hh
    big = cut.resize((max(1, round(cut.width * k)), max(1, round(cut.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (BUST_W, BUST_H), (0, 0, 0, 0))
    out.paste(big, (round(BUST_W / 2 - cx * k), round(BUST_CY - cy * k)), big)
    return out


def cmd_build():
    faces = load_json(FACES, {})
    os.makedirs(OUT, exist_ok=True)
    icons, total = {}, 0
    for i in ids():
        src = f'{PICKED}/{i}.webp'
        if not os.path.exists(src):
            continue
        cut = cut_of(i)
        bbox = cut.split()[-1].getbbox()
        stand = cut.crop(bbox) if bbox else cut
        scale = STAND_H / cut.height
        stand = stand.resize((max(1, round(stand.width * scale)), max(1, round(stand.height * scale))), Image.LANCZOS)
        stand.save(f'{OUT}/{i}.webp', 'WEBP', quality=82, method=6)
        total += os.path.getsize(f'{OUT}/{i}.webp')
        if i in faces:
            bust_of(cut, faces[i]).save(f'{OUT}/{i}.bust.webp', 'WEBP', quality=82, method=6)
            total += os.path.getsize(f'{OUT}/{i}.bust.webp')
            buf = io.BytesIO()
            icon_of(cut, faces[i]).save(buf, 'WEBP', quality=82, method=6)
            icons[i] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    with open('src/ui/portraits.gen.ts', 'w') as f:
        f.write('// 자동 생성: python3 scripts/art.py build — 직접 고치지 말 것\n')
        f.write('/** 기물 id → 머리 크롭 아이콘 (128px WebP 데이터 URI) */\n')
        f.write('export const ICONS: Record<string, string> = {\n')
        for k, v in icons.items():
            f.write(f"  {k}: '{v}',\n")
        f.write('};\n')
    print(f'art {len(os.listdir(OUT))}개 {total / 1024 / 1024:.1f} MB, icon {len(icons)}개 {sum(map(len, icons.values())) / 1024:.0f} KB')


def cmd_sheet(out):
    faces = load_json(FACES, {})
    items = [i for i in ids() if i in faces and os.path.exists(f'{PICKED}/{i}.webp')]
    C, T = 8, 160
    rows = (len(items) + C - 1) // C
    sheet = Image.new('RGB', (C * T, rows * (T + 16)), (23, 28, 38))
    d = ImageDraw.Draw(sheet)
    for n, i in enumerate(items):
        ic = icon_of(cut_of(i), faces[i]).resize((T, T))
        x, y = (n % C) * T, (n // C) * (T + 16)
        sheet.paste(ic, (x, y), ic)
        d.text((x + 4, y + T + 2), i, fill='white')
    sheet.save(out)
    print(out)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'pick': cmd_pick, 'faces': cmd_faces, 'build': cmd_build}.get(cmd, lambda: cmd_sheet(sys.argv[2]) if cmd == 'sheet' else cmd_holes(sys.argv[2]) if cmd == 'holes' else print(__doc__))()
