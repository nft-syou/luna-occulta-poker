"""Composes public/og.png (1200x630): the brushed logo on the 宵闇 dark, with the fan-work line
beneath it.

One-off tooling (needs Pillow). scripts/logo-source.jpg is the logo the title screen shows;
replace it and re-run to refresh the card.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
DARK = (19, 19, 31)  # the logo's own background, so its edges disappear
SUBLABEL, GOLD = (168, 164, 196), (217, 169, 76)


def font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont:
    for name in candidates:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise SystemExit(f"none of {candidates} found")


card = Image.new("RGB", (W, H), DARK)

logo = Image.open(ROOT / "scripts/logo-source.jpg").convert("RGB")
lh = 520
lw = round(logo.width * lh / logo.height)
logo = logo.resize((lw, lh), Image.LANCZOS)
# Fade the logo's rectangle out towards its edges so no box shows on the card.
mask = Image.new("L", (lw, lh), 0)
md = ImageDraw.Draw(mask)
steps = 60
for i in range(steps):
    inset = i * 1.2
    md.rounded_rectangle(
        (inset, inset, lw - inset, lh - inset), radius=80, fill=int(255 * (i + 1) / steps)
    )
card.paste(logo, ((W - lw) // 2, 10), mask)

d = ImageDraw.Draw(card)
line = "月蝕綺譚 -Luna Occulta- 非公式二次創作ポーカー"
f = font(["yumindb.ttf", "yumin.ttf", "BIZ-UDMinchoM.ttc"], 30)
box = d.textbbox((0, 0), line, font=f)
d.text(((W - (box[2] - box[0])) / 2, 540), line, font=f, fill=SUBLABEL)
url = "yoiyami.syou.io"
fu = font(["yumin.ttf", "BIZ-UDMinchoM.ttc"], 22)
box = d.textbbox((0, 0), url, font=fu)
d.text(((W - (box[2] - box[0])) / 2, 584), url, font=fu, fill=GOLD)

out = ROOT / "public/og.png"
card.save(out, optimize=True)
print("wrote", out, out.stat().st_size, "bytes")
