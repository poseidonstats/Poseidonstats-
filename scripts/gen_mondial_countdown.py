"""Clip COUNTDOWN Mondial 2026 — publicat 9 iun seara, 2 zile până start.

Format v2:
- LOOP perfect (cadru 0 = cadru final identic)
- HOOK <3s = cifra "2" MARE roșu
- Mesaj educativ (modelul rulează, nu promisiuni)
- ÎNTREBARE penultimă pentru comentarii
- 15-18s, MUTE
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys, tempfile

sys.path.insert(0, str(Path(__file__).parent))
from _v2_common import (
    gradient_bg, draw_centered, add_brand_top,
    add_disclaimer, cadru_intrebare, render,
    GOLD, GOLD_DARK, WHITE, MUTED, RED_SOFT, GREEN_BRIGHT,
    FONT_SERIF, FONT_BOLD, FONT, W, H,
)


def cadru_loop_brand():
    """Cadru loop = brand SIMPLU, fără trident, fără hook.
    Text mare POSEIDON + tagline. Folosit ca prim ȘI ultim cadru → loop perfect."""
    img = gradient_bg(); d = ImageDraw.Draw(img)

    f_brand = ImageFont.truetype(FONT_BOLD, 180)
    draw_centered(d, "POSEIDON", 700, f_brand, GOLD)
    d.line([(W/2 - 200, 920), (W/2 + 200, 920)], fill=GOLD, width=3)

    f_sub = ImageFont.truetype(FONT, 56)
    draw_centered(d, "statistici fotbal", 980, f_sub, WHITE)
    draw_centered(d, "calibrate empiric", 1060, f_sub, WHITE)

    f_dom = ImageFont.truetype(FONT_SERIF, 60)
    draw_centered(d, "poseidonstats.com", 1260, f_dom, MUTED)

    add_disclaimer(d)
    return img


def cadru_hook():
    """HOOK separat: cifra '2' MARE roșu — <3s, atrage atenția."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    add_brand_top(d)

    f_lbl = ImageFont.truetype(FONT_BOLD, 68)
    draw_centered(d, "În", 400, f_lbl, MUTED)

    f_huge = ImageFont.truetype(FONT_SERIF, 540)
    draw_centered(d, "2", 530, f_huge, RED_SOFT)

    f_em = ImageFont.truetype(FONT_BOLD, 96)
    draw_centered(d, "zile", 1140, f_em, WHITE)
    draw_centered(d, "începe", 1260, f_em, WHITE)
    draw_centered(d, "MONDIALUL", 1380, f_em, GOLD)

    add_disclaimer(d)
    return img


def cadru_hook():
    """Hook punchy: cifra '2' MARE roșu — atrage atenția <3s."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    add_brand_top(d)

    f_lbl = ImageFont.truetype(FONT_BOLD, 68)
    draw_centered(d, "În", 400, f_lbl, MUTED)

    f_huge = ImageFont.truetype(FONT_SERIF, 540)
    draw_centered(d, "2", 530, f_huge, RED_SOFT)

    f_em = ImageFont.truetype(FONT_BOLD, 96)
    draw_centered(d, "zile", 1140, f_em, WHITE)
    draw_centered(d, "începe", 1260, f_em, WHITE)
    draw_centered(d, "MONDIALUL", 1380, f_em, GOLD)

    add_disclaimer(d)
    return img


def cadru_data():
    """Data exactă + ora deschidere."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    add_brand_top(d)

    f_lbl = ImageFont.truetype(FONT_BOLD, 72)
    draw_centered(d, "MONDIAL 2026", 460, f_lbl, GOLD)

    f_huge = ImageFont.truetype(FONT_SERIF, 260)
    draw_centered(d, "11", 600, f_huge, WHITE)

    f_em = ImageFont.truetype(FONT_BOLD, 88)
    draw_centered(d, "iunie", 920, f_em, WHITE)

    f_n = ImageFont.truetype(FONT, 58)
    draw_centered(d, "deschiderea grupelor", 1100, f_n, MUTED)

    f_em2 = ImageFont.truetype(FONT_BOLD, 70)
    draw_centered(d, "JOI", 1240, f_em2, GOLD)

    add_disclaimer(d)
    return img


def cadru_model():
    """Modelul rulează deja — cifra MARE 65.000."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    add_brand_top(d)

    f_title = ImageFont.truetype(FONT_BOLD, 78)
    draw_centered(d, "Modelul rulează", 400, f_title, WHITE)
    draw_centered(d, "deja.", 500, f_title, WHITE)

    f_huge = ImageFont.truetype(FONT_SERIF, 280)
    draw_centered(d, "65.000", 650, f_huge, GOLD)

    f_em = ImageFont.truetype(FONT_BOLD, 60)
    draw_centered(d, "meciuri reale", 980, f_em, WHITE)
    draw_centered(d, "în calibrare istorică.", 1070, f_em, WHITE)

    f_n = ImageFont.truetype(FONT, 50)
    draw_centered(d, "Statistici, nu ponturi.", 1240, f_n, MUTED)

    add_disclaimer(d)
    return img


def cadru_volum():
    """Volum Mondial: 14 meciuri pe 13 iun (peak)."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    add_brand_top(d)

    f_lbl = ImageFont.truetype(FONT_BOLD, 72)
    draw_centered(d, "13 iunie:", 420, f_lbl, GOLD)

    f_huge = ImageFont.truetype(FONT_SERIF, 360)
    draw_centered(d, "14", 530, f_huge, WHITE)

    f_em = ImageFont.truetype(FONT_BOLD, 76)
    draw_centered(d, "meciuri grupă", 950, f_em, WHITE)

    f_n = ImageFont.truetype(FONT, 50)
    draw_centered(d, "fiecare cu estimări calibrate", 1130, f_n, MUTED)
    draw_centered(d, "pe naționale (6.746 amicale)", 1200, f_n, MUTED)

    f_em2 = ImageFont.truetype(FONT_BOLD, 56)
    draw_centered(d, "Inclusiv ratările.", 1340, f_em2, RED_SOFT)

    add_disclaimer(d)
    return img


def cadru_cta():
    """Call to action — site brand."""
    img = gradient_bg(); d = ImageDraw.Draw(img)
    add_brand_top(d)

    f_title = ImageFont.truetype(FONT_BOLD, 86)
    draw_centered(d, "Vino pe site.", 460, f_title, WHITE)

    f_em = ImageFont.truetype(FONT_BOLD, 60)
    draw_centered(d, "Gratis. Fără reclame.", 620, f_em, MUTED)
    draw_centered(d, "Fără afiliere case pariuri.", 700, f_em, MUTED)

    f_site = ImageFont.truetype(FONT_SERIF, 96)
    draw_centered(d, "poseidonstats", 900, f_site, GOLD)
    draw_centered(d, ".com", 1010, f_site, GOLD)

    f_n = ImageFont.truetype(FONT, 48)
    draw_centered(d, "Cifre verificabile, scor cu scor.", 1200, f_n, WHITE)

    f_em2 = ImageFont.truetype(FONT_BOLD, 54)
    draw_centered(d, "Inclusiv LOSS-urile.", 1320, f_em2, GREEN_BRIGHT)

    add_disclaimer(d)
    return img


def main():
    out = Path.home() / "Desktop" / "POSEIDON-mondial-countdown.mp4"
    tmpdir = Path(tempfile.mkdtemp(prefix="mondial_"))
    print(f"Frames temp: {tmpdir}")

    # Ordinea cadrelor: loop_brand → HOOK separat → data → model → volum → întrebare → cta → loop_brand
    frames = [
        ("00_loop_start.png", cadru_loop_brand()),
        ("01_hook_2zile.png", cadru_hook()),
        ("02_data_11iun.png", cadru_data()),
        ("03_model_65k.png", cadru_model()),
        ("04_volum_14meci.png", cadru_volum()),
        ("05_intrebare.png", cadru_intrebare(
            "Ce naționala", "îți place mai mult", "la Mondial 2026?")),
        ("06_cta_site.png", cadru_cta()),
        ("07_loop_end.png", cadru_loop_brand()),
    ]
    for name, img in frames:
        img.save(tmpdir / name)
        print(f"✓ {name}")

    print(f"\nRender → {out}")
    render(tmpdir, out, hold=2.2, xfade=0.35)
    print(f"\n✅ DONE: {out}")
    print(f"Durata aproximativă: ~{(len(frames)-1) * (2.2 - 0.35) + 2.2:.1f}s")


if __name__ == "__main__":
    main()
