#!/usr/bin/env python3
"""원정 팔짱 대기 PNG를 홈 대기 스프라이트와 같은 여백·종횡비로 자른다."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "assets" / "game"
HOME = GAME / "pyamong-waiting.png"
AWAY = GAME / "pyamong-waiting-away.png"


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    bbox = im.split()[-1].getbbox()
    if not bbox:
        raise SystemExit(f"no opaque pixels: {im.size}")
    return bbox


def main() -> None:
    home = Image.open(HOME).convert("RGBA")
    away = Image.open(AWAY).convert("RGBA")
    hb = alpha_bbox(home)
    ab = alpha_bbox(away)
    hc_w, hc_h = hb[2] - hb[0], hb[3] - hb[1]
    pad_ratio = (
        hb[0] / hc_w,
        hb[1] / hc_h,
        (home.size[0] - hb[2]) / hc_w,
        (home.size[1] - hb[3]) / hc_h,
    )
    ac_w, ac_h = ab[2] - ab[0], ab[3] - ab[1]
    pad_px = (
        int(round(pad_ratio[0] * ac_w)),
        int(round(pad_ratio[1] * ac_h)),
        int(round(pad_ratio[2] * ac_w)),
        int(round(pad_ratio[3] * ac_h)),
    )
    crop = (
        max(0, ab[0] - pad_px[0]),
        max(0, ab[1] - pad_px[1]),
        min(away.size[0], ab[2] + pad_px[2]),
        min(away.size[1], ab[3] + pad_px[3]),
    )
    out = away.crop(crop)
    out.save(AWAY, "PNG")
    print(
        f"waiting-away {away.size} -> {out.size} "
        f"aspect={out.size[0]/out.size[1]:.3f} (home {home.size[0]/home.size[1]:.3f})"
    )


if __name__ == "__main__":
    main()
