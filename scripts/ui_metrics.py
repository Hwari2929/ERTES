#!/usr/bin/env python3
"""UI 촬영 지표 · 비교 (scripts/ui_shots.mjs 결과를 읽는다).

  python3 scripts/ui_metrics.py area <촬영 dir> [--theme metro]
      화면별 밝은 면적(L* >= 기준) · 유채색 면적(C* >= 기준) + metrics.json 의 13px 미만 한글 · 44px 미만 누를 것 · 문서 높이.
  python3 scripts/ui_metrics.py diff <전 dir> <후 dir> [--tol 0]
      같은 이름 그림의 바뀐 픽셀 비율 (채널 차이 > 8 = 바뀜). 바뀐 그림이 있으면 종료 코드 1, 차이 그림은 <후 dir>/_diff/.
  python3 scripts/ui_metrics.py dom <촬영 dir> <화면 키> [--top 12]
      한 화면의 13px 미만 한글 · 44px 미만 누를 것 · 둥글기 값 · 잘린 칸 목록 (어디를 고칠지 찾기).

밝은 면적 기준 L* 70 · 유채색 C* 30 은 피드백 보고서(v588 측정: 지도 1.1~1.2% · 편성 2.9~3.0%)에 맞춘 값이다 (v591 지도 1.3% · 편성 2.8%).
"""
import json
import sys


def ko_stats(m: dict) -> tuple[int, int]:
    """(한글 글자 수, 13px 미만) — SVG 안 글자(그림의 일부)는 뺀다. koSvg 가 없는 옛 기록은 text · tspan 요소 글자를 빼서 맞춘다"""
    ko, small = m.get('ko', 0), m.get('koSmall', 0)
    if 'koSvg' not in m:
        svg = sum(n for k, n in m.get('koOff', {}).items() if k.split(' ')[0].split('.')[0] in ('text', 'tspan'))
        ko, small = ko - svg, small - svg
    return ko, small
from pathlib import Path

import numpy as np
from PIL import Image

L_BRIGHT = 70.0
C_CHROMA = 30.0


def lab(img: Image.Image) -> np.ndarray:
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255.0
    a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]], dtype=np.float32)
    xyz = a @ m.T / np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    A = 500 * (f[..., 0] - f[..., 1])
    B = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, A, B], axis=-1)


def area(path: Path) -> tuple[float, float]:
    x = lab(Image.open(path))
    bright = float((x[..., 0] >= L_BRIGHT).mean() * 100)
    chroma = float((np.hypot(x[..., 1], x[..., 2]) >= C_CHROMA).mean() * 100)
    return bright, chroma


def cmd_area(d: Path, theme: str | None):
    met = json.loads((d / 'metrics.json').read_text()) if (d / 'metrics.json').exists() else {}
    print(f'{"화면":<26}{"밝은%":>7}{"유채%":>7}{"한글<13":>9}{"누름<44":>9}{"문서높이":>9}')
    rows = []
    for p in sorted(d.glob('*/*.png')):
        k = f'{p.parent.name}/{p.stem}'
        if theme and p.parent.name != theme:
            continue
        b, c = area(p)
        m = met.get(k, {})
        k0, k1 = ko_stats(m)
        ko = k1 / k0 * 100 if k0 else float('nan')
        tg = m.get('t44', 0) / m['tgt'] * 100 if m.get('tgt') else float('nan')
        rows.append((k, b, c, ko, tg, m.get('docH', 0)))
        print(f'{k:<26}{b:7.1f}{c:7.1f}{ko:9.1f}{tg:9.1f}{m.get("docH", 0):9}')
    # 모음: 테마 × 폭별 (한글 · 누를 것은 글자 수 · 개수 합으로)
    groups: dict[str, list] = {}
    for k, *_ in rows:
        th, rest = k.split('/')
        groups.setdefault(f'{th} {rest.rsplit("_", 1)[1]}', []).append(k)
    print()
    for g, ks in groups.items():
        ko = sum(ko_stats(met.get(k, {}))[0] for k in ks)
        kos = sum(ko_stats(met.get(k, {}))[1] for k in ks)
        tg = sum(met.get(k, {}).get('tgt', 0) for k in ks)
        t44 = sum(met.get(k, {}).get('t44', 0) for k in ks)
        br = [r[1] for r in rows if r[0] in ks]
        print(f'{g:<16} 화면 {len(ks):2}  밝은 면적 {min(br):.1f}~{max(br):.1f}% (중앙 {np.median(br):.1f})  한글<13px {kos / max(ko, 1) * 100:.1f}%  누를 것<44px {t44 / max(tg, 1) * 100:.1f}%')


def cmd_diff(a: Path, b: Path, tol: float):
    bad = 0
    met = json.loads((b / 'metrics.json').read_text()) if (b / 'metrics.json').exists() else {}
    for pb in sorted(b.glob('*/*.png')):
        k = f'{pb.parent.name}/{pb.stem}'
        pa = a / pb.parent.name / pb.name
        if not pa.exists() or met.get(k, {}).get('nodiff'):
            continue
        x, y = np.asarray(Image.open(pa).convert('RGB'), dtype=np.int16), np.asarray(Image.open(pb).convert('RGB'), dtype=np.int16)
        if x.shape != y.shape:
            print(f'{k:<26} 크기 다름 {x.shape} → {y.shape}')
            bad += 1
            continue
        ch = np.abs(x - y).max(axis=-1) > 8
        frac = float(ch.mean() * 100)
        if frac > tol:
            bad += 1
            ys, xs = np.nonzero(ch)
            print(f'{k:<26} 바뀐 픽셀 {frac:.3f}%  범위 x {xs.min()}~{xs.max()} y {ys.min()}~{ys.max()}')
            out = b / '_diff'
            out.mkdir(exist_ok=True)
            vis = (y * 0.35).astype(np.uint8)
            vis[ch] = [255, 0, 255]
            Image.fromarray(vis).save(out / f'{pb.parent.name}_{pb.stem}.png')
    print(f'바뀐 그림 {bad}개' if bad else '바뀐 그림 없음')
    sys.exit(1 if bad else 0)


def cmd_dom(d: Path, k: str, top: int):
    m = json.loads((d / 'metrics.json').read_text())[k]
    print(f'{k}: 한글 {m["ko"]}자 중 13px 미만 {m["koSmall"]} ({m["koSmall"] / max(m["ko"], 1) * 100:.1f}%) · 누를 것 {m["tgt"]} 중 44px 미만 {m["t44"]} · 24px 미만 {m["t24"]} · 문서 {m["docW"]}×{m["docH"]}')
    for title, o in (('13px 미만 한글 (글자 수)', m['koOff']), ('44px 미만 누를 것', m['tOff']), ('둥글기', m['radius'])):
        print(f'— {title}')
        for kk, n in sorted(o.items(), key=lambda t: -t[1])[:top]:
            print(f'   {n:5}  {kk}')
    if m['clip']:
        print(f'— 잘린 칸 {len(m["clip"])}: ' + ' | '.join(m['clip'][:top]))


if __name__ == '__main__':
    av = sys.argv[1:]
    opt = lambda k, d: av[av.index(k) + 1] if k in av else d
    if not av:
        print(__doc__)
    elif av[0] == 'area':
        cmd_area(Path(av[1]), opt('--theme', None))
    elif av[0] == 'diff':
        cmd_diff(Path(av[1]), Path(av[2]), float(opt('--tol', 0)))
    elif av[0] == 'dom':
        cmd_dom(Path(av[1]), av[2], int(opt('--top', 12)))
