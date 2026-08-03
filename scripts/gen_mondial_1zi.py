"""Clip COUNTDOWN final Mondial 2026 — MÂINE începe.
10 iun seara, ultima zi înainte de meciul de deschidere Mexico - South Africa.

Reguli aplicate:
- ZERO trident (regula no-trident pe clipuri)
- Hook = cifra MARE roșu
- 11-13s, LOOP perfect, MUTE
- Logo apare DOAR în outro
- Meci de deschidere fără procente (Over 1.5=40% NU se încadrează în 70-90% prag)
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


def cadru_hook_maine():
    """Hook sec 0: 'MÂINE' MARE — ZERO logo, urgență vizuală."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_huge = ImageFont.truetype(FONT_SERIF, 280)
    draw_centered(d, "MÂINE", 700, f_huge, RED_SOFT)

    f_em = ImageFont.truetype(FONT_BOLD, 96)
    draw_centered(d, "începe", 1080, f_em, WHITE)

    f_em2 = ImageFont.truetype(FONT_BOLD, 130)
    draw_centered(d, "MONDIALUL", 1240, f_em2, GOLD)

    add_disclaimer(d)
    return img


def cadru_1zi():
    """O singură zi rămasă — cifra 1 MARE."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_em = ImageFont.truetype(FONT_BOLD, 84)
    draw_centered(d, "Mai e", 460, f_em, WHITE)

    f_huge = ImageFont.truetype(FONT_SERIF, 600)
    draw_centered(d, "1", 580, f_huge, RED_SOFT)

    f_em2 = ImageFont.truetype(FONT_BOLD, 110)
    draw_centered(d, "ZI.", 1270, f_em2, WHITE)

    add_disclaimer(d)
    return img


def cadru_deschidere():
    """Meciul de deschidere — Mexic vs Africa de Sud."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_lbl = ImageFont.truetype(FONT_BOLD, 70)
    draw_centered(d, "Deschiderea", 380, f_lbl, GOLD)

    f_em = ImageFont.truetype(FONT_BOLD, 110)
    draw_centered(d, "MEXIC", 580, f_em, WHITE)

    f_vs = ImageFont.truetype(FONT_SERIF, 90)
    draw_centered(d, "vs", 730, f_vs, GOLD)

    draw_centered(d, "AFRICA", 830, f_em, WHITE)
    draw_centered(d, "DE SUD", 950, f_em, WHITE)

    f_ora = ImageFont.truetype(FONT_BOLD, 84)
    draw_centered(d, "22:00", 1180, f_ora, GOLD)

    f_n = ImageFont.truetype(FONT, 42)
    draw_centered(d, "ora României", 1290, f_n, MUTED)

    add_disclaimer(d)
    return img


def cadru_model_ready():
    """Modelul calculează deja — fără cifre, doar context."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_em = ImageFont.truetype(FONT_BOLD, 92)
    draw_centered(d, "Eu am calculat", 530, f_em, WHITE)
    draw_centered(d, "probabilitățile", 660, f_em, WHITE)

    f_huge = ImageFont.truetype(FONT_SERIF, 200)
    draw_centered(d, "OnEST", 820, f_huge, GOLD)

    f_n = ImageFont.truetype(FONT_BOLD, 64)
    draw_centered(d, "Inclusiv unde", 1080, f_n, WHITE)
    draw_centered(d, "modelul poate", 1170, f_n, WHITE)

    f_em2 = ImageFont.truetype(FONT_BOLD, 88)
    draw_centered(d, "GREȘI.", 1280, f_em2, RED_SOFT)

    add_disclaimer(d)
    return img


def cadru_intrebare_mondial():
    """Engagement — întrebare ce echipă favorită."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_q = ImageFont.truetype(FONT_BOLD, 92)
    draw_centered(d, "Tu cu ce", 480, f_q, WHITE)
    draw_centered(d, "națională ții", 610, f_q, WHITE)
    draw_centered(d, "la Mondial?", 740, f_q, GOLD)

    f_n = ImageFont.truetype(FONT, 56)
    draw_centered(d, "💬 Scrie în comentarii", 960, f_n, MUTED)

    f_em = ImageFont.truetype(FONT_BOLD, 60)
    draw_centered(d, "(eu țin cu cea", 1140, f_em, MUTED)
    draw_centered(d, "care GREȘEȘTE mai puțin)", 1230, f_em, MUTED)

    add_disclaimer(d)
    return img


def cadru_outro():
    """Outro + LOGO POSEIDON + site."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_brand = ImageFont.truetype(FONT_BOLD, 160)
    draw_centered(d, "POSEIDON", 420, f_brand, GOLD)
    d.line([(W/2 - 220, 605), (W/2 + 220, 605)], fill=GOLD, width=3)

    f_em = ImageFont.truetype(FONT_BOLD, 64)
    draw_centered(d, "De la 11 iunie", 730, f_em, WHITE)

    f_site = ImageFont.truetype(FONT_SERIF, 92)
    draw_centered(d, "poseidonstats", 910, f_site, GOLD)
    draw_centered(d, ".com", 1020, f_site, GOLD)

    f_em2 = ImageFont.truetype(FONT_BOLD, 100)
    draw_centered(d, "GRATIS", 1220, f_em2, GREEN_BRIGHT)

    add_disclaimer(d)
    return img


def main():
    out = Path.home() / "Desktop" / "POSEIDON-mondial-1zi.mp4"
    tmpdir = Path(tempfile.mkdtemp(prefix="m1zi_"))
    print(f"Frames temp: {tmpdir}")

    hook = cadru_hook_maine()
    frames = [
        ("00_hook.png", hook),
        ("01_1zi.png", cadru_1zi()),
        ("02_deschidere.png", cadru_deschidere()),
        ("03_model.png", cadru_model_ready()),
        ("04_intrebare.png", cadru_intrebare_mondial()),
        ("05_outro.png", cadru_outro()),
        ("06_loop_hook.png", hook),
    ]
    for name, img in frames:
        img.save(tmpdir / name)
        print(f"✓ {name}")

    # Hold 1.8s + xfade 0.3s → step 1.5s/cadru
    # Total: 6 * 1.5 + 1.8 = 10.8s — în zona optim 11-13s
    print(f"\nRender → {out}")
    render(tmpdir, out, hold=1.9, xfade=0.3)
    print(f"\n✅ DONE: {out}")


if __name__ == "__main__":
    main()
