"""Teaser Mondial — unghi CURIOZITATE (nu brand differentiator).
Principii retenție de la transparenta-v2:
- HOOK sec 0 fără logo
- Text animat ritm ~1.4s/cadru
- 11-13s total
- Loop perfect (cadru final = cadru hook)
- MUTE
- Logo DOAR în outro
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys, tempfile

sys.path.insert(0, str(Path(__file__).parent))
from _v2_common import (
    gradient_bg, draw_centered, add_disclaimer, render,
    GOLD, WHITE, MUTED, RED_SOFT, GREEN_BRIGHT,
    FONT_SERIF, FONT_BOLD, FONT, W, H,
)


def cadru_hook_curio():
    """Hook sec 0: întrebare curiozitate, ZERO logo. Provocator."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_q = ImageFont.truetype(FONT_BOLD, 92)
    draw_centered(d, "Se poate prezice", 520, f_q, WHITE)
    draw_centered(d, "un meci de fotbal", 640, f_q, WHITE)

    f_em = ImageFont.truetype(FONT_BOLD, 100)
    draw_centered(d, "cu", 830, f_em, WHITE)

    f_huge = ImageFont.truetype(FONT_SERIF, 130)
    draw_centered(d, "MATEMATICA?", 970, f_huge, GOLD)

    add_disclaimer(d)
    return img


def cadru_incerc():
    """La Mondial, eu încerc. — Setup low-key, onest."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_em = ImageFont.truetype(FONT_BOLD, 110)
    draw_centered(d, "La Mondial,", 750, f_em, WHITE)

    f_em2 = ImageFont.truetype(FONT_BOLD, 130)
    draw_centered(d, "eu încerc.", 920, f_em2, GOLD)

    add_disclaimer(d)
    return img


def cadru_65k():
    """Cifră MARE — 65.000 meciuri analizate. Backtest real."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_huge = ImageFont.truetype(FONT_SERIF, 320)
    draw_centered(d, "65.000", 520, f_huge, GOLD)

    f_em = ImageFont.truetype(FONT_BOLD, 78)
    draw_centered(d, "de meciuri", 940, f_em, WHITE)
    draw_centered(d, "analizate.", 1040, f_em, WHITE)

    add_disclaimer(d)
    return img


def cadru_model():
    """Un model statistic. Calibrat empiric."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_em = ImageFont.truetype(FONT_BOLD, 108)
    draw_centered(d, "Un model", 700, f_em, WHITE)
    draw_centered(d, "statistic.", 830, f_em, WHITE)

    f_em2 = ImageFont.truetype(FONT_BOLD, 86)
    draw_centered(d, "Calibrat empiric.", 1020, f_em2, GOLD)

    add_disclaimer(d)
    return img


def cadru_sincer():
    """Îți arăt exact cât de bine merge. Sincer."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_em = ImageFont.truetype(FONT_BOLD, 92)
    draw_centered(d, "Îți arăt exact", 660, f_em, WHITE)
    draw_centered(d, "cât de bine", 780, f_em, WHITE)
    draw_centered(d, "merge.", 900, f_em, WHITE)

    f_em2 = ImageFont.truetype(FONT_BOLD, 140)
    draw_centered(d, "Sincer.", 1080, f_em2, GOLD)

    add_disclaimer(d)
    return img


def cadru_gresesc():
    """Inclusiv când GREȘESC. — Onestitatea, diferențiatorul."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_em = ImageFont.truetype(FONT_BOLD, 108)
    draw_centered(d, "Inclusiv", 720, f_em, WHITE)
    draw_centered(d, "când", 850, f_em, WHITE)

    f_huge = ImageFont.truetype(FONT_SERIF, 200)
    draw_centered(d, "GREȘESC.", 1010, f_huge, RED_SOFT)

    add_disclaimer(d)
    return img


def cadru_outro():
    """Outro + LOGO + site + data + GRATIS."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    # Logo POSEIDON apare DOAR aici
    f_brand = ImageFont.truetype(FONT_BOLD, 140)
    draw_centered(d, "POSEIDON", 400, f_brand, GOLD)
    d.line([(W/2 - 180, 565), (W/2 + 180, 565)], fill=GOLD, width=3)

    f_em = ImageFont.truetype(FONT_BOLD, 72)
    draw_centered(d, "De la 11 iunie", 700, f_em, WHITE)

    f_site = ImageFont.truetype(FONT_SERIF, 92)
    draw_centered(d, "poseidonstats", 880, f_site, GOLD)
    draw_centered(d, ".com", 990, f_site, GOLD)

    f_em2 = ImageFont.truetype(FONT_BOLD, 130)
    draw_centered(d, "GRATIS", 1200, f_em2, GREEN_BRIGHT)

    add_disclaimer(d)
    return img


def main():
    out = Path.home() / "Desktop" / "POSEIDON-mondial-teaser-curiozitate.mp4"
    tmpdir = Path(tempfile.mkdtemp(prefix="teaser_curio_"))
    print(f"Frames temp: {tmpdir}")

    # Cadrul 1 (hook) == cadrul final → loop perfect
    hook = cadru_hook_curio()
    frames = [
        ("00_hook.png", hook),
        ("01_incerc.png", cadru_incerc()),
        ("02_65k.png", cadru_65k()),
        ("03_model.png", cadru_model()),
        ("04_sincer.png", cadru_sincer()),
        ("05_gresesc.png", cadru_gresesc()),
        ("06_outro.png", cadru_outro()),
        ("07_loop_hook.png", hook),
    ]
    for name, img in frames:
        img.save(tmpdir / name)
        print(f"✓ {name}")

    # Hold 1.7s + xfade 0.3s → step 1.4s/cadru
    # Total: 7 * 1.4 + 1.7 = 11.5s ✓ în țintă 11-13s
    print(f"\nRender → {out}")
    render(tmpdir, out, hold=1.7, xfade=0.3)
    print(f"\n✅ DONE: {out}")
    print(f"Durată: ~{(len(frames)-1) * (1.7 - 0.3) + 1.7:.1f}s")


if __name__ == "__main__":
    main()
