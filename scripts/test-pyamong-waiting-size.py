#!/usr/bin/env python3
"""홈/원정 팔짱 대기 빠몽이 같은 CSS 너비에서 비슷한 크기로 그려지는지 검증."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "assets" / "game"
CSS_WIDTH = 144.0


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    bbox = im.split()[-1].getbbox()
    if not bbox:
        raise SystemExit("empty alpha")
    return bbox


def displayed(im: Image.Image, css_w: float) -> tuple[float, float, float, float]:
    w, h = im.size
    box = alpha_bbox(im)
    scale = css_w / w
    char_w = (box[2] - box[0]) * scale
    char_h = (box[3] - box[1]) * scale
    return w / h, char_w, char_h, scale * h


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise SystemExit(msg)


def main() -> None:
    home = Image.open(GAME / "pyamong-waiting.png")
    away = Image.open(GAME / "pyamong-waiting-away.png")
    ha, hw, hh, hbox_h = displayed(home, CSS_WIDTH)
    aa, aw, ah, abox_h = displayed(away, CSS_WIDTH)
    assert_true(0.52 <= aa <= 0.66, f"away waiting aspect {aa:.3f} should match home ~0.58")
    assert_true(abs(ah / hh - 1) <= 0.08, f"away char height {ah:.1f} vs home {hh:.1f}")
    assert_true(abs(aw / hw - 1) <= 0.12, f"away char width {aw:.1f} vs home {hw:.1f}")
    print(
        "OK: waiting pyamong size",
        {
            "home": {"aspect": round(ha, 3), "char": (round(hw, 1), round(hh, 1))},
            "away": {"aspect": round(aa, 3), "char": (round(aw, 1), round(ah, 1))},
        },
    )


if __name__ == "__main__":
    main()
