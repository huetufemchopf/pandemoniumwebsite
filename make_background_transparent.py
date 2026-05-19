#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

from PIL import Image


def _iter_border_pixels(img: Image.Image, stride: int) -> Iterable[tuple[int, int, int]]:
    w, h = img.size
    px = img.load()

    # Top / bottom rows
    for x in range(0, w, stride):
        r, g, b, _a = px[x, 0]
        yield (r, g, b)
        r, g, b, _a = px[x, h - 1]
        yield (r, g, b)

    # Left / right columns
    for y in range(0, h, stride):
        r, g, b, _a = px[0, y]
        yield (r, g, b)
        r, g, b, _a = px[w - 1, y]
        yield (r, g, b)


def _estimate_background_colors(
    img_rgba: Image.Image,
    max_colors: int = 3,
    quantize_bits: int = 3,
) -> list[tuple[int, int, int]]:
    """
    Estimate up to `max_colors` background RGB colors from the image border.
    Uses coarse quantization to handle slight background variation (e.g. pinkish).
    """
    w, h = img_rgba.size
    stride = max(1, min(w, h) // 200)

    # Bin colors by quantized RGB (e.g. 3 bits -> 8 buckets/channel)
    shift = max(0, 8 - quantize_bits)
    bins: Counter[tuple[int, int, int]] = Counter()
    members: dict[tuple[int, int, int], list[tuple[int, int, int]]] = defaultdict(list)

    for r, g, b in _iter_border_pixels(img_rgba, stride=stride):
        key = (r >> shift, g >> shift, b >> shift)
        bins[key] += 1
        members[key].append((r, g, b))

    if not bins:
        return [(255, 255, 255)]

    bg_colors: list[tuple[int, int, int]] = []
    for key, _count in bins.most_common(max_colors):
        vals = members[key]
        rr = round(sum(v[0] for v in vals) / len(vals))
        gg = round(sum(v[1] for v in vals) / len(vals))
        bb = round(sum(v[2] for v in vals) / len(vals))
        bg_colors.append((rr, gg, bb))

    return bg_colors


def _srgb_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    dr = a[0] - b[0]
    dg = a[1] - b[1]
    db = a[2] - b[2]
    return math.sqrt(dr * dr + dg * dg + db * db)


def make_background_transparent(
    input_path: Path,
    output_path: Path,
    threshold: float = 40.0,
    feather: float = 20.0,
    max_bg_colors: int = 3,
) -> None:
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    px = img.load()

    bg_colors = _estimate_background_colors(img, max_colors=max_bg_colors)

    thr = float(threshold)
    feather = max(0.0, float(feather))
    feather_end = thr + feather if feather > 0 else thr

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue

            d = min(_srgb_distance((r, g, b), bg) for bg in bg_colors)
            if d <= thr:
                px[x, y] = (r, g, b, 0)
            elif feather > 0 and d < feather_end:
                # Smooth edges: ramp alpha from 0..255 over (thr..thr+feather)
                t = (d - thr) / feather
                px[x, y] = (r, g, b, max(0, min(255, round(255 * t))))
            else:
                px[x, y] = (r, g, b, 255)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, format="PNG")


def _is_image_file(p: Path) -> bool:
    return p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Make the (white/pink-ish) background transparent while keeping foreground pixels."
    )
    parser.add_argument("input", type=Path, help="Input image file OR a directory of images")
    parser.add_argument("output", type=Path, help="Output file (if input is file) OR output directory")
    parser.add_argument("--threshold", type=float, default=40.0, help="Background color distance threshold (default: 40)")
    parser.add_argument("--feather", type=float, default=20.0, help="Edge feathering distance (default: 20, 0 disables)")
    parser.add_argument("--max-bg-colors", type=int, default=3, help="How many background tones to detect (default: 3)")
    args = parser.parse_args()

    inp: Path = args.input
    out: Path = args.output

    if inp.is_dir():
        out.mkdir(parents=True, exist_ok=True)
        files = sorted([p for p in inp.iterdir() if p.is_file() and _is_image_file(p)])
        for p in files:
            make_background_transparent(
                input_path=p,
                output_path=out / f"{p.stem}.transparent.png",
                threshold=args.threshold,
                feather=args.feather,
                max_bg_colors=args.max_bg_colors,
            )
        return 0

    if not _is_image_file(inp):
        raise SystemExit(f"Unsupported input file type: {inp}")

    # If output is a directory, place output next to it
    if out.exists() and out.is_dir():
        out = out / f"{inp.stem}.transparent.png"
    elif out.suffix == "":
        out = out / f"{inp.stem}.transparent.png"

    make_background_transparent(
        input_path=inp,
        output_path=out,
        threshold=args.threshold,
        feather=args.feather,
        max_bg_colors=args.max_bg_colors,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
