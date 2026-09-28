"""生成した画像をスライド用に整える：白い背景を透明にし（外周から塗りつぶし、絵の中の白は残す）、余白を切り、縮めて webp にする。

  python to_webp.py in.png [out.webp] [--max 1400] [--keep-bg] [--thresh 24] [--pad 12]

--keep-bg を付けると背景を残す（写真・背景まで描いた絵）。どのテーマ（和風の生成り・ダークの紺）にも絵がなじむよう、既定では透明にする。
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def knockout(img: Image.Image, thresh: int) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    key = (255, 0, 255, 0)
    work = img.copy()
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        r, g, b, a = work.getpixel(xy)
        if a and min(r, g, b) > 255 - thresh * 3:
            ImageDraw.floodfill(work, xy, key, thresh=thresh)
    px, out = work.load(), img.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == key:
                out[x, y] = (255, 255, 255, 0)
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--max", type=int, default=1400, help="長い辺の最大 px")
    ap.add_argument("--keep-bg", action="store_true")
    ap.add_argument("--thresh", type=int, default=24)
    ap.add_argument("--pad", type=int, default=12)
    ap.add_argument("--quality", type=int, default=88)
    a = ap.parse_args()
    src = Path(a.src)
    dst = Path(a.dst) if a.dst else src.with_suffix(".webp")
    img = Image.open(src)
    if not a.keep_bg:
        img = knockout(img, a.thresh)
        box = img.getchannel("A").getbbox()
        if box:
            l, t, r, b = box
            img = img.crop((max(0, l - a.pad), max(0, t - a.pad), min(img.width, r + a.pad), min(img.height, b + a.pad)))
    img.thumbnail((a.max, a.max), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "WEBP", quality=a.quality, method=6)
    print(f"{dst}  {img.width}x{img.height}  {dst.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
