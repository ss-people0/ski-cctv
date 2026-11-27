#!/usr/bin/env python3
"""파비콘 둥근 배지 생성 (public/favicon-16/32/48.png, public/favicon.png).

- 바탕: 브랜드 스노우 화이트 #F8FAFC 둥근 사각형, 모서리 반경 = 한 변의 25%
- 바깥 모서리는 완전 투명(alpha=0) — 어두운 탭 바에서 흰 사각형이 각져 보이지 않게
- A안 심볼(public/brand/logo-solid.png)을 한 변의 74%로 가운데 배치
- 8배 슈퍼샘플링 후 LANCZOS 다운스케일, 32px 이하는 약한 언샤프로 가장자리 보정

apple-touch-icon·icon-192/512/1024·*-maskable은 OS가 직접 마스킹하므로 여기서 만들지 않는다
(투명 모서리를 넣으면 iOS 홈 화면에서 검은 모서리가 생긴다). 불투명 배경 그대로 둔다.

사용: python3 scripts/gen_favicons.py   (Pillow 필요)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SNOW = (248, 250, 252)
SS = 8                 # 슈퍼샘플링 배율
RADIUS_RATIO = 0.25    # 모서리 반경 / 한 변
SYMBOL_RATIO = 0.74    # 심볼 크기 / 한 변
SRC_SYMBOL = ROOT / "public/brand/logo-solid.png"

TARGETS = [
    (16, ROOT / "public/favicon-16.png"),
    (32, ROOT / "public/favicon-32.png"),
    (48, ROOT / "public/favicon-48.png"),
    (48, ROOT / "public/favicon.png"),
]


def make_badge(size: int, symbol: Image.Image) -> Image.Image:
    w = size * SS
    canvas = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        [0, 0, w - 1, w - 1], radius=w * RADIUS_RATIO, fill=SNOW + (255,)
    )

    sw = w * SYMBOL_RATIO
    sh = sw * symbol.height / symbol.width
    sym = symbol.resize((max(1, round(sw)), max(1, round(sh))), Image.LANCZOS)
    canvas.alpha_composite(sym, ((w - sym.width) // 2, (w - sym.height) // 2))

    out = canvas.resize((size, size), Image.LANCZOS)
    if size <= 32:
        # 작은 크기에서 심볼이 뭉개지지 않게 살짝만 (알파는 건드리지 않는다)
        rgb = out.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.6, percent=45, threshold=0))
        out = Image.merge("RGBA", (*rgb.split(), out.getchannel("A")))
    return out


def main() -> None:
    symbol = Image.open(SRC_SYMBOL).convert("RGBA")
    for size, path in TARGETS:
        make_badge(size, symbol).save(path, optimize=True)
        print(f"{path.relative_to(ROOT)} {size}x{size}")


if __name__ == "__main__":
    main()
