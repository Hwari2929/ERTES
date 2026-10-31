"""스탠딩 · 초상화 에셋 파이프라인.

  python3 scripts/art.py pick     art/picks.json 의 선택본(art/raw) → art/picked/<id>.webp (보관용 원본, 깃에 넣음)
  python3 scripts/art.py faces    얼굴 위치를 못 정한 기물만 자동 추정 → art/faces.json [얼굴 중심 x, 눈썹 y, 턱 y] (손으로 고치는 게 기본)
  python3 scripts/art.py build [id ...]   id 를 주면 그 그림만 다시 (아이콘 · 얼굴 위치표의 다른 줄은 그대로)
  python3 scripts/art.py build    art/picked + art/faces.json → public/art/<id>.webp (전신) · <id>.<표정>.webp (표정 차분)
                                  + public/art/<id>.bust.webp (머리 크기를 맞춘 상반신 배너)
                                  + src/ui/portraits.gen.ts (머리 크기를 맞춘 아이콘, 데이터 URI 내장)
                                  + src/ui/standface.gen.ts (스탠딩 그림 안의 얼굴 위치표, 아래 standfaces)
  python3 scripts/art.py standfaces   스탠딩 그림 안의 얼굴 위치표만 다시 → src/ui/standface.gen.ts
                                  (바 무대가 인물을 얼굴 기준으로 가운데 · 같은 턱 높이 · 같은 얼굴 크기로 세울 때 쓴다)
  NAI V5 투명 배경 원본(RGBA)은 그대로 쓰고, 흰 배경 원본만 배경을 깎는다.
  python3 scripts/art.py croptool       초상화 크롭 도구 → dist/crop/index.html + dist/crop/img/ (아티팩트로 게시)
                                  도구에서 저장한 값은 art/crops.json [x, y, 한 변] 에 옮겨 두면 faces.json 보다 우선한다
  python3 scripts/art.py sheet OUT.png   아이콘 확인용 시트
  python3 scripts/art.py holes OUT.png   갇힌 배경 후보 표시 (art/cut.json 에 지울 점 기록)
"""
import base64, io, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PICKS, FACES, CROPS, CUTS, PICKED, OUT = 'art/picks.json', 'art/faces.json', 'art/crops.json', 'art/cut.json', 'art/picked', 'public/art'
STAND_H, ICON = 960, 128
# 얼굴 크기 정규화 (눈썹~턱 = F)
#  아이콘: F 가 한 변의 ICON_FACE 비율, 턱은 위에서 ICON_CHIN 지점 (턱은 안 잘리고 머리카락 윗부분은 잘려도 됨)
#  배너: F 를 BUST_FACE px 로 맞추고 턱을 BUST_CHIN 높이에 둔 BUST_W×BUST_H
ICON_FACE, ICON_CHIN = 0.4, 0.9
BUST_W, BUST_H, BUST_FACE, BUST_CHIN = 480, 360, 80, 165


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
    return [cx, top + int(head * 0.45), top + int(head * 0.95)]


def cmd_faces():
    faces = load_json(FACES, {})
    for i in ids():
        if i in faces or not os.path.exists(f'{PICKED}/{i}.webp'):
            continue
        faces[i] = guess_face(cut_of(i))
        print('face', i, faces[i])
    json.dump(faces, open(FACES, 'w'), indent=1)


def crop_box(i, faces=None):
    """초상화 정사각 [x, y, 한 변] — 직접 잡은 크롭(art/crops.json)이 있으면 그것, 없으면 얼굴 표시로 계산"""
    crops = load_json(CROPS, {})
    if i in crops:
        return [int(v) for v in crops[i]]
    fx, brow, chin = (faces or load_json(FACES, {}))[i]
    s = round((chin - brow) / ICON_FACE)
    return [fx - s // 2, round(chin - s * ICON_CHIN), s]


def face_of(i, faces=None):
    """배너용 [얼굴 중심 x, 눈썹, 턱] — 직접 잡은 크롭이 있으면 거기서 거꾸로 계산해 두 결과를 맞춘다"""
    x, y, s = crop_box(i, faces)
    chin = y + s * ICON_CHIN
    return [x + s / 2, chin - s * ICON_FACE, chin]


def icon_of(cut, box):
    x, y, s = box
    box = (x, y, x + s, y + s)
    # 원본 밖으로 나가는 크롭도 허용 (투명으로 채움)
    canvas = Image.new('RGBA', (cut.width + 2 * s, cut.height + 2 * s), (0, 0, 0, 0))
    canvas.paste(cut, (s, s))
    return canvas.crop((box[0] + s, box[1] + s, box[2] + s, box[3] + s)).resize((ICON, ICON), Image.LANCZOS)


def bust_of(cut, face):
    """얼굴(눈썹~턱)을 BUST_FACE px 로 맞추고 턱을 (가운데, BUST_CHIN) 에 둔 상반신 배너"""
    fx, brow, chin = face
    k = BUST_FACE / (chin - brow)
    big = cut.resize((max(1, round(cut.width * k)), max(1, round(cut.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (BUST_W, BUST_H), (0, 0, 0, 0))
    out.paste(big, (round(BUST_W / 2 - fx * k), round(BUST_CHIN - chin * k)), big)
    return out


def gen_rows(path, pat):
    """이미 만든 생성 파일에서 'id: 값' 줄을 읽는다 (build [id ...] 에서 나머지 줄을 그대로 두려고)"""
    if not os.path.exists(path):
        return {}
    return {m.group(1): m.group(2) for m in re.finditer(pat, open(path).read(), re.M)}


def cmd_build(only=None):
    faces = load_json(FACES, {})
    os.makedirs(OUT, exist_ok=True)
    icons, total, faced = {}, 0, []
    if only:
        icons = gen_rows('src/ui/portraits.gen.ts', r"^  (\w+): '(.*)',$")
        keep = gen_rows('src/ui/standface.gen.ts', r"^  (\w+): (\[.*\]),$")
    for i in (only or ids()):
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
        # 표정 차분 (art/picked/<id>.<표정>.webp): 기본 스탠딩과 같은 틀로 잘라 바꿔 끼워도 위치가 맞게
        for fn in sorted(os.listdir(PICKED)):
            parts = fn.split('.')
            if len(parts) != 3 or parts[0] != i or parts[2] != 'webp':
                continue
            v = Image.open(f'{PICKED}/{fn}').convert('RGBA').resize(cut.size)
            v = v.crop(bbox) if bbox else v
            v = v.resize(stand.size, Image.LANCZOS)
            v.save(f'{OUT}/{fn}', 'WEBP', quality=82, method=6)
            total += os.path.getsize(f'{OUT}/{fn}')
        if i in faces or i in load_json(CROPS, {}):
            bust_of(cut, face_of(i, faces)).save(f'{OUT}/{i}.bust.webp', 'WEBP', quality=82, method=6)
            total += os.path.getsize(f'{OUT}/{i}.bust.webp')
            buf = io.BytesIO()
            icon_of(cut, crop_box(i, faces)).save(buf, 'WEBP', quality=70, alpha_quality=80, method=6)
            icons[i] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
            row = standface_row(i, cut, faces)
            if row:
                faced.append(row)
                if only:
                    keep.pop(i, None)
    with open('src/ui/portraits.gen.ts', 'w') as f:
        f.write('// 자동 생성: python3 scripts/art.py build — 직접 고치지 말 것\n')
        f.write('/** 기물 id → 머리 크롭 아이콘 (128px WebP 데이터 URI) */\n')
        f.write('export const ICONS: Record<string, string> = {\n')
        for k, v in icons.items():
            f.write(f"  {k}: '{v}',\n")
        f.write('};\n')
    print(f'art {len(os.listdir(OUT))}개 {total / 1024 / 1024:.1f} MB, icon {len(icons)}개 {sum(map(len, icons.values())) / 1024:.0f} KB')
    write_standfaces(faced + [f'  {k}: {v},' for k, v in keep.items()] if only else faced)


def standface_row(i, cut, faces):
    """스탠딩 그림(투명 테두리를 깎은 전신 = build 의 bbox) 안의 얼굴: [얼굴 가운데 x, 눈썹 y, 턱 y] 를 그림 폭 · 높이 비율로. 적 · 소환물 · 배경은 뺀다"""
    if i.startswith(('en_', 'sm_', 'lore_', 'bg_')):
        return None
    x0, y0, x1, y1 = cut.split()[-1].getbbox() or (0, 0, cut.width, cut.height)
    fx, brow, chin = face_of(i, faces)
    return f'  {i}: [{(fx - x0) / (x1 - x0):.3f}, {(brow - y0) / (y1 - y0):.3f}, {(chin - y0) / (y1 - y0):.3f}],'


def cmd_standfaces():
    """얼굴 위치표만 다시 (build 없이) → src/ui/standface.gen.ts"""
    faces = load_json(FACES, {})
    crops = load_json(CROPS, {})
    rows = [standface_row(i, cut_of(i), faces) for i in ids() if os.path.exists(f'{PICKED}/{i}.webp') and (i in faces or i in crops) and not i.startswith(('en_', 'sm_', 'lore_', 'bg_'))]
    write_standfaces([r for r in rows if r])


def write_standfaces(rows):
    with open('src/ui/standface.gen.ts', 'w') as f:
        f.write('// 자동 생성: python3 scripts/art.py standfaces (build 때도 함께) — 직접 고치지 말 것\n')
        f.write('/** 스탠딩 그림(public/art/<id>.webp) 안의 얼굴: [얼굴 가운데 x, 눈썹 y, 턱 y] — 그림 폭 · 높이에 대한 비율 */\n')
        f.write('export const STAND_FACE: Record<string, [number, number, number]> = {\n')
        f.write('\n'.join(rows) + '\n};\n')
    print(f'standface {len(rows)}개')


def cmd_variants(only=None):
    """표정 차분만 빠르게 다시 내기: python3 scripts/art.py variants [id.face ...]"""
    for fn in sorted(os.listdir(PICKED)):
        parts = fn.split('.')
        if len(parts) != 3 or parts[2] != 'webp' or parts[0].startswith('bg_'):
            continue
        if only and f'{parts[0]}.{parts[1]}' not in only:
            continue
        i = parts[0]
        cut = cut_of(i)
        bbox = cut.split()[-1].getbbox()
        scale = STAND_H / cut.height
        w, h = (bbox[2] - bbox[0], bbox[3] - bbox[1]) if bbox else cut.size
        v = Image.open(f'{PICKED}/{fn}').convert('RGBA').resize(cut.size)
        v = v.crop(bbox) if bbox else v
        v = v.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        v.save(f'{OUT}/{fn}', 'WEBP', quality=82, method=6)
        print('variant', fn)


def cmd_sheet(out):
    faces = load_json(FACES, {})
    items = [i for i in ids() if i in faces and os.path.exists(f'{PICKED}/{i}.webp')]
    C, T = 8, 160
    rows = (len(items) + C - 1) // C
    sheet = Image.new('RGB', (C * T, rows * (T + 16)), (23, 28, 38))
    d = ImageDraw.Draw(sheet)
    for n, i in enumerate(items):
        ic = icon_of(cut_of(i), crop_box(i, faces)).resize((T, T))
        x, y = (n % C) * T, (n // C) * (T + 16)
        sheet.paste(ic, (x, y), ic)
        d.text((x + 4, y + T + 2), i, fill='white')
    sheet.save(out)
    print(out)


def cmd_croptool():
    names = {k: v['name'] for k, v in json.load(open('art/prompts.json')).items()}
    faces = load_json(FACES, {})
    units = [{'id': i, 'name': names[i], 'crop': dict(zip('xys', crop_box(i, faces)))} for i in ids() if os.path.exists(f'{PICKED}/{i}.webp')]
    html = open('tools/crop-tool.html').read().replace('/*__UNITS__*/[]', json.dumps(units, ensure_ascii=False))
    os.makedirs('dist/crop/img', exist_ok=True)
    for u in units:
        Image.open(f"{PICKED}/{u['id']}.webp").save(f"dist/crop/img/{u['id']}.webp", 'WEBP', quality=88, alpha_quality=90, method=4)
    open('dist/crop/index.html', 'w').write(html)
    print('dist/crop/index.html', len(units))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'pick': cmd_pick, 'faces': cmd_faces, 'build': lambda: cmd_build(sys.argv[2:] or None), 'standfaces': cmd_standfaces, 'croptool': cmd_croptool, 'variants': lambda: cmd_variants(sys.argv[2:] or None)}.get(cmd, lambda: cmd_sheet(sys.argv[2]) if cmd == 'sheet' else cmd_holes(sys.argv[2]) if cmd == 'holes' else print(__doc__))()
