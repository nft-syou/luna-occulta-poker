"""Composes public/og.png (1200x630): a frame of the table on the right, the brushed logo and
the fan-work line on the left, on the 宵闇 dark.

One-off tooling (needs Pillow). scripts/og-table.png is a 1600x900 screenshot of a watched
table (a hand with several spirits still in); scripts/logo-source.jpg is the title logo.
Replace either and re-run to refresh the card.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
DARK = (19, 19, 31)
SUBLABEL, GOLD = (168, 164, 196), (217, 169, 76)
# The felt and its seats inside the 1600x900 screenshot.
FELT_BOX = (392, 80, 1194, 706)


def font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont:
    for name in candidates:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise SystemExit(f"none of {candidates} found")


def faded(img: Image.Image, edge: int, radius: int) -> Image.Image:
    """An L mask that fades `img`'s rectangle out over `edge` pixels, so no box shows."""
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    for i in range(edge):
        md.rounded_rectangle(
            (i, i, img.width - i, img.height - i), radius=radius, fill=int(255 * (i + 1) / edge)
        )
    return mask


card = Image.new("RGB", (W, H), DARK)

# The table on the right.
table = Image.open(ROOT / "scripts/og-table.png").convert("RGB").crop(FELT_BOX)
th = 606
tw = round(table.width * th / table.height)
table = table.resize((tw, th), Image.LANCZOS)
card.paste(table, (W - tw - 8, (H - th) // 2), faded(table, 28, 40))

# The logo and the fan-work line on the left.
logo = Image.open(ROOT / "scripts/logo-source.jpg").convert("RGB")
lw = 430
lh = round(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
lx, ly = 0, 150
card.paste(logo, (lx, ly), faded(logo, 60, 70))

d = ImageDraw.Draw(card)
cx = lx + lw // 2
for text, size, fill, y, names in [
    ("月蝕綺譚 -Luna Occulta-", 24, SUBLABEL, ly + lh + 6, ["yumindb.ttf", "yumin.ttf"]),
    ("非公式二次創作ポーカー", 24, SUBLABEL, ly + lh + 42, ["yumindb.ttf", "yumin.ttf"]),
    ("yoiyami.syou.io", 22, GOLD, ly + lh + 90, ["yumin.ttf", "BIZ-UDMinchoM.ttc"]),
]:
    f = font(names, size)
    box = d.textbbox((0, 0), text, font=f)
    d.text((cx - (box[2] - box[0]) / 2, y), text, font=f, fill=fill)

out = ROOT / "public/og.png"
card.save(out, optimize=True)
print("wrote", out, out.stat().st_size, "bytes")
