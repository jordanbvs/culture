"""Génère les icônes PWA de Culture. (Pillow + Instrument Serif)."""
from PIL import Image, ImageDraw, ImageFont
import os, sys

FONT = os.environ.get("CULTURE_FONT", "/workspace/fonts/InstrumentSerif-Regular.ttf")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
PAPER, INK, ACCENT = (243, 239, 230), (22, 20, 15), (210, 67, 42)
SS = 4  # supersampling

def render(size, group_w, radius=0.0, dy=0.0, weight=0.0):
    """group_w : largeur du groupe « C. » en fraction du côté ; radius : coins arrondis (fraction)."""
    S = size * SS
    img = Image.new("RGBA", (S, S), PAPER + (255,))
    # taille de police calibrée pour que « C. » occupe group_w
    probe = ImageFont.truetype(FONT, 1000)
    cb = probe.getbbox("C"); db = probe.getbbox(".")
    adv_c = probe.getlength("C")
    track = -0.035 * 1000  # letter-spacing du logo
    dot_x0 = adv_c + track + db[0]
    w = (dot_x0 + (db[2] - db[0])) - cb[0]
    fs = 1000 * group_w * S / w
    f = ImageFont.truetype(FONT, int(round(fs)))
    k = fs / 1000
    cb = f.getbbox("C"); db = f.getbbox(".")
    gx0 = cb[0]; gx1 = adv_c * k + track * k + db[2]
    gy0 = cb[1]; gy1 = max(cb[3], db[3])
    ox = (S - (gx1 - gx0)) / 2 - gx0
    oy = (S - (gy1 - gy0)) / 2 - gy0 + dy * S
    d = ImageDraw.Draw(img)
    sw = int(round(weight * S))  # épaissit le fût aux petites tailles
    d.text((ox, oy), "C", font=f, fill=INK, stroke_width=sw, stroke_fill=INK)
    d.text((ox + (adv_c + track) * k + sw, oy), ".", font=f, fill=ACCENT, stroke_width=sw, stroke_fill=ACCENT)
    if radius:
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(radius * S), fill=255)
        img.putalpha(m)
    return img.resize((size, size), Image.LANCZOS)

def save(img, name, rgb=True):
    p = os.path.join(OUT, name)
    (img.convert("RGB") if rgb else img).save(p, optimize=True)
    print(p, img.size)

os.makedirs(OUT, exist_ok=True)
for s in (192, 512):
    save(render(s, 0.62, dy=0.01), f"icon-{s}.png")
save(render(512, 0.5, dy=0.008), "icon-maskable-512.png")   # dans le cercle de sécurité (80 %)
save(render(192, 0.5, dy=0.008), "icon-maskable-192.png")
save(render(180, 0.58, dy=0.01), "apple-touch-icon.png")      # iOS arrondit lui-même
fav = {s: render(s, 0.78, radius=0.22, weight={16: .045, 32: .03, 48: .02}[s]) for s in (16, 32, 48)}
save(fav[32], "favicon-32.png", rgb=False)
fav[48].save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)],
             append_images=[fav[16], fav[32]])
print("favicon.ico")
