#!/usr/bin/env python3
"""인트로 구장 배경 + 14장 타격 프레임 흰 배경 제거."""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC_STADIUM = Path(
    "/home/ubuntu/.cursor/projects/workspace/assets/76ec0203-5ba8-4bd3-80f6-4082705f7559.png"
)
OUT_STADIUM = ROOT / "assets/user/intro-stadium-home.jpg"
FRAMES_DIR = ROOT / "assets/user/intro-batting-frames"

NEAR_WHITE = 242


def cover_kling_watermark(rgb: np.ndarray) -> np.ndarray:
    """우측 하단 KlingAI 워터마크를 옆 흙으로 덮는다."""
    h, w, _ = rgb.shape
    y0, y1 = int(h * 0.90), h
    x0, x1 = int(w * 0.78), w
    src_x0 = max(0, x0 - (x1 - x0) - 8)
    src = rgb[y0:y1, src_x0 : src_x0 + (x1 - x0)]
    if src.shape[1] != (x1 - x0):
        src = np.repeat(rgb[y0:y1, x0 - 12 : x0], 40, axis=1)[:, : x1 - x0]
    patch = src.copy()
    # 살짝 블러
    from PIL import ImageFilter

    blur = Image.fromarray(patch).filter(ImageFilter.GaussianBlur(radius=2.2))
    rgb = rgb.copy()
    rgb[y0:y1, x0:x1] = np.array(blur)
    return rgb


def flood_alpha(rgb: np.ndarray) -> np.ndarray:
    """가장자리와 이어진 흰 배경만 투명. 유니폼·공은 남긴다."""
    h, w, _ = rgb.shape
    vis = np.zeros((h, w), dtype=np.uint8)
    q: deque[tuple[int, int]] = deque()

    def is_bg(y: int, x: int) -> bool:
        r, g, b = rgb[y, x]
        return int(r) >= NEAR_WHITE and int(g) >= NEAR_WHITE and int(b) >= NEAR_WHITE

    for x in range(w):
        if is_bg(0, x):
            q.append((0, x))
            vis[0, x] = 1
        if is_bg(h - 1, x):
            q.append((h - 1, x))
            vis[h - 1, x] = 1
    for y in range(h):
        if vis[y, 0] == 0 and is_bg(y, 0):
            q.append((y, 0))
            vis[y, 0] = 1
        if vis[y, w - 1] == 0 and is_bg(y, w - 1):
            q.append((y, w - 1))
            vis[y, w - 1] = 1

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and vis[ny, nx] == 0 and is_bg(ny, nx):
                vis[ny, nx] = 1
                q.append((ny, nx))

    alpha = np.where(vis == 1, 0, 255).astype(np.uint8)
    # 가장자리 안티앨리어스
    from PIL import ImageFilter

    a_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(radius=0.8))
    alpha = np.array(a_img)
    alpha = np.where(vis == 1, np.minimum(alpha, 40), np.maximum(alpha, 210))
    rgba = np.dstack([rgb, alpha])
    return rgba


def character_bbox(rgba: np.ndarray) -> tuple[int, int, int, int]:
    a = rgba[:, :, 3]
    ys, xs = np.where(a > 80)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def main() -> int:
    if not SRC_STADIUM.exists():
        print("missing stadium source", SRC_STADIUM, file=sys.stderr)
        return 1

    stadium = np.array(Image.open(SRC_STADIUM).convert("RGB"))
    stadium = cover_kling_watermark(stadium)
    out = Image.fromarray(stadium)
    out = out.convert("RGB")
    OUT_STADIUM.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT_STADIUM, "JPEG", quality=88, optimize=True)
    print("wrote", OUT_STADIUM, OUT_STADIUM.stat().st_size)

    bboxes = []
    for path in sorted(FRAMES_DIR.glob("*.webp")):
        rgb = np.array(Image.open(path).convert("RGB"))
        rgba = flood_alpha(rgb)
        Image.fromarray(rgba, "RGBA").save(path, "WEBP", quality=82, method=6)
        box = character_bbox(rgba)
        bboxes.append((path.name, *box, rgb.shape[1], rgb.shape[0]))
        print(path.name, "bbox", box, "size", path.stat().st_size)

    # frame 01 alignment hints vs stadium
    name, x0, y0, x1, y1, fw, fh = bboxes[0]
    sh, sw = stadium.shape[0], stadium.shape[1]
    # 구장 빠몽이 발: 가로 중앙 조금 오른쪽, 홈플레이트 위
    feet_sx, feet_sy = 0.512 * sw, 0.875 * sh
    feet_fx, feet_fy = (x0 + x1) / 2, y1
    # 캐릭터 높이를 구장 높이의 ~52%로
    target_h = 0.52 * sh
    scale = target_h / (y1 - y0)
    disp_w, disp_h = fw * scale, fh * scale
    left = feet_sx - feet_fx * scale
    top = feet_sy - feet_fy * scale
    print(
        "css hint",
        {
            "left%": round(100 * left / sw, 2),
            "top%": round(100 * top / sh, 2),
            "width%": round(100 * disp_w / sw, 2),
            "height%": round(100 * disp_h / sh, 2),
            "scale": round(scale, 4),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
