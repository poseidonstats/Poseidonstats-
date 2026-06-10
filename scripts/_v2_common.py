"""Helpers comune pentru clipurile v2 (optim TikTok 2026):
- LOOP perfect (cadru prim + ultim identic)
- HOOK punchy <3s
- ÎNTREBARE pentru comentarii
- Stil PROMO (gradient profund + serif + trident + logo)
- MUTE (sunet adăugat în TikTok la upload)
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import subprocess

W, H = 1080, 1920
NAVY_DARK = (8, 15, 50)
NAVY_MID = (20, 35, 95)
NAVY_LIGHT = (35, 60, 140)
GOLD = (245, 197, 66)
GOLD_DARK = (180, 140, 30)
WHITE = (255, 255, 255)
MUTED = (190, 200, 225)
GREEN_BRIGHT = (80, 220, 130)
GREEN_DARK = (50, 170, 100)
RED_SOFT = (235, 95, 95)
ORANGE_WARN = (240, 165, 80)

FONT_SERIF = "/System/Library/Fonts/Times.ttc"
FONT_BOLD = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT = "/System/Library/Fonts/Helvetica.ttc"


def gradient_bg():
    img = Image.new("RGB", (W, H), NAVY_DARK)
    px = img.load()
    cy = H // 2
    for y in range(H):
        d = abs(y - cy) / cy
        if d < 0.5:
            t = d * 2
            r = int(NAVY_LIGHT[0] * (1 - t) + NAVY_MID[0] * t)
            g = int(NAVY_LIGHT[1] * (1 - t) + NAVY_MID[1] * t)
            b = int(NAVY_LIGHT[2] * (1 - t) + NAVY_MID[2] * t)
        else:
            t = (d - 0.5) * 2
            r = int(NAVY_MID[0] * (1 - t) + NAVY_DARK[0] * t)
            g = int(NAVY_MID[1] * (1 - t) + NAVY_DARK[1] * t)
            b = int(NAVY_MID[2] * (1 - t) + NAVY_DARK[2] * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    return img


def draw_centered(d, text, y, font, color=WHITE):
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    d.text(((W - w) / 2, y), text, font=font, fill=color)
    return bbox[3] - bbox[1]


def draw_trident_big(d, cx, cy, size=260):
    s = size
    d.rectangle([cx-8, cy-s*0.3, cx+8, cy+s*0.9], fill=GOLD)
    for dx in (-s*0.55, 0, s*0.55):
        x = cx + dx
        d.polygon([(x-22, cy-s*0.2), (x+22, cy-s*0.2), (x, cy-s*0.95)], fill=GOLD)
        d.rectangle([x-8, cy-s*0.3, x+8, cy+s*0.15], fill=GOLD)
    d.arc([cx-s*0.62, cy-s*0.42, cx+s*0.62, cy+s*0.3], 0, 180, fill=GOLD, width=14)
    d.line([(cx, cy+s*0.3), (cx, cy+s*0.95)], fill=GOLD, width=14)
    d.ellipse([cx-22, cy+s*0.83, cx+22, cy+s*1.1], fill=GOLD)


def add_disclaimer(d):
    f = ImageFont.truetype(FONT, 30)
    draw_centered(d, "informativ · 18+ · nu garanție", H - 50, f, MUTED)


def add_brand_top(d):
    f = ImageFont.truetype(FONT_BOLD, 52)
    draw_centered(d, "POSEIDON", 180, f, GOLD)
    d.line([(W / 2 - 80, 245), (W / 2 + 80, 245)], fill=GOLD, width=2)


def cadru_loop():
    """Cadru PRIM + ULTIM identic — pentru loop perfect TikTok."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    draw_trident_big(d, W // 2, 800)
    f_brand = ImageFont.truetype(FONT_BOLD, 130)
    draw_centered(d, "POSEIDON", 1300, f_brand, GOLD)
    f_sub = ImageFont.truetype(FONT, 48)
    draw_centered(d, "predicții calibrate, onest", 1450, f_sub, MUTED)
    add_disclaimer(d)
    return img


def cadru_intrebare(line1, line2, highlight, cta="💬 Comentează mai jos."):
    """Cadru cu întrebare pentru a provoca comentarii (+40% distribuție)."""
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    f_lbl = ImageFont.truetype(FONT_BOLD, 64)
    draw_centered(d, "Întrebare:", 470, f_lbl, MUTED)
    f_q = ImageFont.truetype(FONT_BOLD, 88)
    draw_centered(d, line1, 620, f_q, WHITE)
    if line2:
        draw_centered(d, line2, 740, f_q, WHITE)
    draw_centered(d, highlight, 870, f_q, GOLD)
    f_n = ImageFont.truetype(FONT, 50)
    draw_centered(d, cta, 1130, f_n, MUTED)
    f_site = ImageFont.truetype(FONT_SERIF, 80)
    draw_centered(d, "poseidonstats.com", 1260, f_site, GOLD)
    add_disclaimer(d)
    return img


def truncate(s, n):
    return s if len(s) <= n else s[: n - 1] + "…"


def render(frames_dir: Path, output: Path, hold=2.6, xfade=0.4):
    """Render MP4 cu xfade chain. Hold + xfade per cadru."""
    files = sorted(frames_dir.glob("*.png"))
    n = len(files)
    if n < 2:
        raise RuntimeError(f"Doar {n} cadre")
    step = hold - xfade
    inputs = []
    for f in files:
        inputs += ["-loop", "1", "-t", str(hold), "-i", str(f)]
    chain = ""
    prev = "[0:v]"
    trs = ["fadeblack", "fadewhite", "fadeblack", "slideright", "fadeblack"]
    for i in range(1, n):
        off = i * step
        outl = f"[v{i}]" if i < n - 1 else "[vfinal]"
        end = "" if i < n - 1 else ",format=yuv420p"
        # Ultimul transition = fade simplu pentru loop natural
        tr = "fade" if i == n - 1 else trs[i % len(trs)]
        chain += f"{prev}[{i}:v]xfade=transition={tr}:duration={xfade}:offset={off:.2f}{end}{outl};"
        prev = f"[v{i}]"
    chain = chain.rstrip(";")
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", chain, "-map", "[vfinal]",
        "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-r", "30",
        str(output)
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode()[-500:])
