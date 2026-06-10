"""Clip ZILNIC "ce a ieșit IERI" — verificare onestă din poseidon_history.csv.

Optimizat TikTok 2026:
- LOOP perfect (cadru 1 == ultim)
- HOOK punchy <3s
- Întrebare finală pentru comentarii
- MUTE

Usage: python3 gen_yesterday_clip.py
"""
from __future__ import annotations
import csv
import sys
from datetime import datetime, timedelta
from pathlib import Path

from PIL import ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from _v2_common import (
    W, H, GOLD, WHITE, MUTED, GREEN_BRIGHT, RED_SOFT, ORANGE_WARN,
    FONT_SERIF, FONT_BOLD, FONT,
    gradient_bg, draw_centered, add_brand_top, add_disclaimer,
    cadru_loop, cadru_intrebare, truncate, render,
)

HIST_CSV = Path.home() / "football_predictor/data/poseidon_history.csv"
MIN_PROB = 0.65
MAX_PROB_DISPLAY = 0.88  # exclude super-favoriți umflați din AFIȘAJ
EXCLUDE_TEAM_SUFFIX = (" II", " III", " B", " C", " Reserve", " Reserves",
                       " U23", " U21", " U20", " U19", " U18", " U17", " U16", " U15", " U14",
                       " W", " Women", " Ladies", " Femenino", " Femenil", " Feminin")
EXCLUDE_LEAGUE_KEY = ("women", "femenil", "femenino", "feminin", "ladies", "w-league", " w ")


def load_yesterday():
    yest = (datetime.now() - timedelta(days=1)).date()
    rows = []
    with open(HIST_CSV) as f:
        for r in csv.DictReader(f):
            if r["status"] != "RESOLVED": continue
            if not r["match_date"].startswith(yest.isoformat()): continue
            try: p = float(r["prob_over_1_5"])
            except: continue
            if p < MIN_PROB: continue
            if r["outcome_over_1_5"] not in ("0", "1"): continue
            rows.append({
                "home": r["home_team"], "away": r["away_team"],
                "country": r["country"], "league": r["league"],
                "prob": p, "outcome": int(r["outcome_over_1_5"]),
                "ft_h": r["ft_home"], "ft_a": r["ft_away"],
            })
    return rows, yest


def cadru_hook(yest, n_total, n_wins):
    """HOOK AGRESIV: cifră MARE 'N/total' instant + provocare.
    Scop: stop scroll în <1.5s."""
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    # CIFRA principală — N/total MARE, instant vizibil
    f_huge = ImageFont.truetype(FONT_SERIF, 380)
    draw_centered(d, f"{n_wins}/{n_total}", 500, f_huge, GOLD)
    f_med = ImageFont.truetype(FONT_BOLD, 64)
    draw_centered(d, "picks ieri.", 970, f_med, WHITE)
    # Provocare → curiozitate
    f_big = ImageFont.truetype(FONT_BOLD, 70)
    draw_centered(d, "Recunosc și", 1130, f_big, MUTED)
    draw_centered(d, "unde GREȘESC →", 1220, f_big, GOLD)
    f_d = ImageFont.truetype(FONT, 36)
    draw_centered(d, yest.strftime("%d %b %Y"), 1340, f_d, MUTED)
    add_disclaimer(d)
    return img


def cadru_score(wins, losses, hit, calib):
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    f_med = ImageFont.truetype(FONT_BOLD, 64)
    draw_centered(d, "Au ieșit:", 440, f_med, WHITE)
    f_h = ImageFont.truetype(FONT_SERIF, 200)
    draw_centered(d, str(wins), 570, f_h, GREEN_BRIGHT)
    f_b = ImageFont.truetype(FONT_BOLD, 56)
    draw_centered(d, "WIN", 800, f_b, GREEN_BRIGHT)
    draw_centered(d, str(losses), 880, f_h, RED_SOFT)
    draw_centered(d, "LOSS", 1100, f_b, RED_SOFT)
    f_x = ImageFont.truetype(FONT_BOLD, 60)
    draw_centered(d, f"Hit rate: {int(hit)}%", 1220, f_x, WHITE)
    f_n = ImageFont.truetype(FONT, 38)
    draw_centered(d, f"calibrare istorică: {int(calib)}%", 1300, f_n, MUTED)
    add_disclaimer(d)
    return img


def cadru_pick(label, pick, color):
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    f_b = ImageFont.truetype(FONT_BOLD, 90)
    draw_centered(d, label, 440, f_b, color)
    d.rectangle([60, 590, W - 60, 990], outline=GOLD, width=3)
    f_lg = ImageFont.truetype(FONT, 34)
    d.text((90, 615), truncate(f"{pick['country']} · {pick['league']}", 38), font=f_lg, fill=MUTED)
    f_t = ImageFont.truetype(FONT_BOLD, 52)
    draw_centered(d, truncate(pick["home"], 22), 700, f_t, WHITE)
    f_vs = ImageFont.truetype(FONT, 38)
    draw_centered(d, "vs", 768, f_vs, MUTED)
    draw_centered(d, truncate(pick["away"], 22), 815, f_t, WHITE)
    f_p = ImageFont.truetype(FONT_BOLD, 64)
    draw_centered(d, f"Over 1.5 — {int(pick['prob']*100)}%", 1060, f_p, WHITE)
    f_sc = ImageFont.truetype(FONT_SERIF, 120)
    draw_centered(d, f"FT: {pick['ft_h']}-{pick['ft_a']}", 1170, f_sc, color)
    f_n = ImageFont.truetype(FONT, 40)
    if label.startswith("WIN"):
        draw_centered(d, "modelul a nimerit", 1370, f_n, MUTED)
    else:
        draw_centered(d, "modelul a greșit aici", 1370, f_n, MUTED)
    add_disclaimer(d)
    return img


def main():
    rows, yest = load_yesterday()
    if not rows:
        print(f"❌ Niciun pick RESOLVED ieri ({yest}). Output anulat.")
        return 1

    def displayable(p):
        if any(p["home"].endswith(s) or p["away"].endswith(s) for s in EXCLUDE_TEAM_SUFFIX):
            return False
        lg = p.get("league", "").lower()
        if any(k in lg for k in EXCLUDE_LEAGUE_KEY):
            return False
        # Exclude prob extreme (zona umflată) din AFIȘAJ vizual — scorul total rămâne neschimbat
        if p["prob"] >= MAX_PROB_DISPLAY:
            return False
        return True

    wins = [r for r in rows if r["outcome"] == 1]
    losses = [r for r in rows if r["outcome"] == 0]
    n_total = len(rows)
    n_win = len(wins)
    n_loss = len(losses)
    hit = n_win / n_total * 100
    calib = 78

    wins_disp = sorted([w for w in wins if displayable(w)] or wins, key=lambda x: -x["prob"])[:2]
    losses_disp = [l for l in losses if displayable(l)] or losses
    top_loss = max(losses_disp, key=lambda x: x["prob"]) if losses_disp else None

    out_dir = Path("/tmp/poseidon_yesterday_v2")
    out_dir.mkdir(exist_ok=True)
    for f in out_dir.glob("*.png"): f.unlink()

    # CADRE: 1=loop, 2=hook, 3=score, 4=win1, 5=win2(opt), 6=loss(opt), 7=întrebare, 8=loop
    cadru_loop().save(out_dir / "01_loop.png")
    cadru_hook(yest, n_total, n_win).save(out_dir / "02_hook.png")
    cadru_score(n_win, n_loss, hit, calib).save(out_dir / "03_score.png")
    if wins_disp:
        cadru_pick(f"WIN — {int(wins_disp[0]['prob']*100)}%", wins_disp[0], GREEN_BRIGHT).save(out_dir / "04_win.png")
    if top_loss:
        cadru_pick(f"LOSS — {int(top_loss['prob']*100)}%", top_loss, RED_SOFT).save(out_dir / "05_loss.png")
    cadru_intrebare("Tu ce-ai", "pune", "mâine?").save(out_dir / "06_intrebare.png")
    cadru_loop().save(out_dir / "07_loop.png")

    output = Path.home() / f"Desktop/POSEIDON-ieri-{yest.isoformat()}.mp4"
    render(out_dir, output, hold=2.6, xfade=0.4)
    sz = output.stat().st_size // 1024
    print(f"✓ {output}  {sz} KB")
    print()
    print(f"=== Ieri ({yest}): Over 1.5 ≥65% ===")
    print(f"  N={n_total}  WIN={n_win}  LOSS={n_loss}  hit={hit:.0f}% (vs istoric {calib}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
