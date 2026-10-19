from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(r"E:\TIRTA-NATIVE-BUILD")
SRC = Image.open(ROOT / "public" / "tirta-logo.png").convert("RGBA")
BG = (223, 245, 252, 255)
DARK = (11, 83, 117, 255)


def fit_logo(canvas, scale=0.68):
    max_side = int(min(canvas.size) * scale)
    logo = SRC.copy()
    logo.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (canvas.width - logo.width) // 2
    y = (canvas.height - logo.height) // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas

# Windows ICO
ico_base = Image.new("RGBA", (512, 512), BG)
draw = ImageDraw.Draw(ico_base)
draw.rounded_rectangle((6, 6, 506, 506), radius=108, fill=BG, outline=(166, 222, 236, 255), width=6)
fit_logo(ico_base, 0.72)
ico_base.save(ROOT / "native" / "electron" / "tirta.ico", format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

res = ROOT / "android" / "app" / "src" / "main" / "res"
densities = {"mdpi":48, "hdpi":72, "xhdpi":96, "xxhdpi":144, "xxxhdpi":192}
for density, size in densities.items():
    folder = res / f"mipmap-{density}"
    folder.mkdir(parents=True, exist_ok=True)
    icon = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(icon)
    d.rounded_rectangle((0,0,size-1,size-1), radius=max(8,size//5), fill=BG)
    fit_logo(icon, 0.70)
    icon.save(folder / "ic_launcher.png")

    round_icon = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(round_icon)
    d.ellipse((0,0,size-1,size-1), fill=BG)
    fit_logo(round_icon, 0.66)
    round_icon.save(folder / "ic_launcher_round.png")

    fg_size = int(size * 2.25)
    foreground = Image.new("RGBA", (fg_size, fg_size), (0,0,0,0))
    fit_logo(foreground, 0.55)
    foreground.save(folder / "ic_launcher_foreground.png")

# Splash: retain each generated resource's exact dimensions, replace generic art with TIRTA.
for splash in res.glob("drawable*/splash.png"):
    old = Image.open(splash)
    canvas = Image.new("RGBA", old.size, BG)
    fit_logo(canvas, 0.22 if old.width >= old.height else 0.26)
    canvas.convert("RGB").save(splash, optimize=True)

print("icons generated")
