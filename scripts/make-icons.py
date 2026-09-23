"""Renders the site icons from the logo's eclipse: a black moon with a crimson rim and a thin
gold edge of light, on the 宵闇 dark. The larger icons also carry the logo's brushed 宵.

One-off tooling (needs Pillow); the outputs under public/ are committed. Re-run after
changing the design here or in public/favicon.svg, which is the same eclipse by hand.
The brushed 宵 is cut from scripts/logo-source.jpg, the logo the title screen shows.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
LOGO = ROOT / "scripts" / "logo-source.jpg"
DARK = (19, 19, 32)
MOON = (10, 10, 18)
CRIMSON = (150, 28, 52)
GOLD = (232, 196, 120)


def glyph() -> Image.Image:
    """The logo's 宵 as a gold-on-transparent image, alpha taken from its brightness."""
    logo = Image.open(LOGO).convert("RGB")
    # The glyph sits at the left of the cropped logo; these bounds keep 闇 out.
    w, h = logo.size
    g = logo.crop((int(w * 0.053), int(h * 0.262), int(w * 0.253), int(h * 0.695)))
    alpha = g.convert("L").point(lambda v: max(0, min(255, (v - 40) * 3)))
    out = Image.new("RGBA", g.size, GOLD + (0,))
    out.paste(g, (0, 0))
    out.putalpha(alpha)
    return out


def eclipse(size: int, rounded: bool, with_glyph: bool) -> Image.Image:
    # Draw at 4x and downsample: PIL's primitives have no anti-aliasing of their own.
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    base = ImageDraw.Draw(img)
    if rounded:
        base.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.2), fill=DARK + (255,))
    else:
        base.rectangle((0, 0, s, s), fill=DARK + (255,))
    c, r = s / 2, s * 0.34

    # The crimson corona: a soft ring just outside the moon.
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    ring = r * 1.08
    hd.ellipse((c - ring, c - ring, c + ring, c + ring), fill=CRIMSON + (255,))
    halo = halo.filter(ImageFilter.GaussianBlur(s * 0.045))
    img = Image.alpha_composite(img, halo)

    # The gold edge of light, thicker on the right like the logo's crescent.
    light = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ld = ImageDraw.Draw(light)
    ld.ellipse((c - r * 1.03, c - r * 1.03, c + r * 1.03, c + r * 1.03), fill=GOLD + (255,))
    light = light.filter(ImageFilter.GaussianBlur(s * 0.01))
    img = Image.alpha_composite(img, light)

    moon = ImageDraw.Draw(img)
    dx = r * 0.07  # shift the moon left so the light shows as a crescent on the right
    moon.ellipse((c - r - dx, c - r, c + r - dx, c + r), fill=MOON + (255,))

    if with_glyph:
        g = glyph()
        gh = int(r * 1.7)
        gw = int(g.width * gh / g.height)
        g = g.resize((gw, gh), Image.LANCZOS)
        img.alpha_composite(g, (int(c - gw / 2 - dx * 0.5), int(c - gh / 2)))

    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.2), fill=255)
        img.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return img.resize((size, size), Image.LANCZOS)


PUBLIC.mkdir(exist_ok=True)
for size, name in [(512, "icon-512.png"), (192, "icon-192.png")]:
    eclipse(size, rounded=True, with_glyph=True).save(PUBLIC / name)
# iOS composites its own rounded corners and dislikes transparency: a full square.
eclipse(180, rounded=False, with_glyph=True).save(PUBLIC / "apple-touch-icon.png")
# At tab size the brushed glyph turns to noise: the eclipse alone reads.
eclipse(64, rounded=True, with_glyph=False).save(
    PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)
print("icons written to", PUBLIC)
