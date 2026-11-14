"""
Social-preview image (Open Graph, 1200x630) for the web app, composed from the project's own
LOLA shaded relief and the NASA PGDA long-term sunlight overlay. Output: frontend/public/og.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "frontend" / "public"
W, H = 1200, 630


def font(names, size):
    for n in names:
        for d in (Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")):
            p = d / n
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def main():
    base = Image.open(PUB / "data" / "basemap" / "pole.jpg").convert("RGBA")
    sun = Image.open(PUB / "data" / "pgda" / "sun_pole.png").convert("RGBA").resize(base.size)
    lit = Image.alpha_composite(base, sun)
    # Square map (centred on the pole) on the right, cropped to the card height.
    m = lit.resize((H + 140, H + 140)).crop((70, 70, 70 + H, 70 + H))
    card = Image.new("RGBA", (W, H), (8, 11, 22, 255))
    card.paste(m, (W - H, 0))
    fade = Image.new("L", (W, H), 0)
    fd = ImageDraw.Draw(fade)
    for x in range(W):  # opaque on the left, map shows through on the right
        a = 255 if x < W - H else int(255 * max(0.0, 1 - (x - (W - H)) / 260))
        fd.line([(x, 0), (x, H)], fill=a)
    card = Image.composite(Image.new("RGBA", (W, H), (8, 11, 22, 255)), card, fade)

    d = ImageDraw.Draw(card)
    # mark
    d.rounded_rectangle([64, 70, 144, 150], 18, fill=(11, 15, 28))
    d.ellipse([112, 86, 132, 106], fill=(251, 191, 36))
    d.polygon([(70, 136), (88, 114), (97, 123), (108, 104), (123, 124), (131, 118), (141, 128), (141, 148), (70, 148)], fill=(148, 163, 184))
    d.ellipse([80, 82, 89, 91], fill=(56, 189, 248))

    d.text((170, 70), "AetherRidge", font=font(["seguisb.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"], 78), fill=(248, 250, 252))
    d.text((66, 190), "Sun & Earth line-of-sight navigator", font=font(["segoeui.ttf", "DejaVuSans.ttf"], 40), fill=(226, 232, 240))
    d.text((66, 240), "for lunar south pole landings", font=font(["segoeui.ttf", "DejaVuSans.ttf"], 40), fill=(226, 232, 240))
    small = font(["segoeui.ttf", "DejaVuSans.ttf"], 26)
    lines = [
        ("Power ON/OFF and Earth link countdowns at any site", (251, 191, 36)),
        ("Real LOLA terrain in 3D, live Sun shadows", (203, 213, 225)),
        ("JPL Horizons ephemerides · checked against NASA maps", (125, 211, 252)),
    ]
    for i, (t, c) in enumerate(lines):
        y = 340 + i * 46
        d.ellipse([68, y + 10, 80, y + 22], fill=c)
        d.text((94, y), t, font=small, fill=(226, 232, 240))
    d.text((66, 560), "NASA Space Apps 2026 · Team Akasha Solo", font=font(["segoeui.ttf", "DejaVuSans.ttf"], 24), fill=(148, 163, 184))
    card.convert("RGB").save(PUB / "og.png", optimize=True)
    print("og.png", (PUB / "og.png").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
