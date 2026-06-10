"""Template Mondial 2026 — clipuri zilnice WC.

Optimizat TikTok 2026: LOOP perfect + HOOK + ÎNTREBARE + MUTE.
Filtru ONEST naționale:
  - Over 1.5 70-90% (calibrat ±2pp pe N=6.746 backtest)
  - HT Over 0.5 60-80% (calibrat ±5pp)
  - EXCLUDE BTTS (umflat -17pp), HT Over 1.5 (catastrofic), Over 3.5
"""
from __future__ import annotations
import argparse
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from PIL import ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from _v2_common import (
    W, H, GOLD, GOLD_DARK, WHITE, MUTED, GREEN_BRIGHT,
    FONT_SERIF, FONT_BOLD, FONT,
    gradient_bg, draw_centered, add_brand_top, add_disclaimer,
    cadru_loop, cadru_intrebare, truncate, render,
)

PRED_CSV = Path.home() / "football_predictor/data/poisson_advanced_predictions.csv"


def load_wc_picks(target_date=None):
    if not PRED_CSV.exists(): return []
    df = pd.read_csv(PRED_CSV, low_memory=False)
    df = df[df["league_id"] == 1].copy()
    if df.empty: return []
    df["match_dt"] = pd.to_datetime(df["date"], errors="coerce", utc=True)
    if target_date:
        df = df[df["match_dt"].dt.date == target_date]
    else:
        now = pd.Timestamp.now(tz=timezone.utc)
        df = df[(df["match_dt"] >= now) & (df["match_dt"] <= now + pd.Timedelta(hours=72))]
    if df.empty: return []
    picks = []
    for _, r in df.iterrows():
        cands = []
        if 0.70 <= r.get("prob_over_1_5", 0) < 0.90:
            cands.append(("Over 1.5", r["prob_over_1_5"]))
        if "ht_prob_over_0_5" in r and 0.60 <= r.get("ht_prob_over_0_5", 0) < 0.80:
            cands.append(("HT Over 0.5", r["ht_prob_over_0_5"]))
        if not cands: continue
        mk, pr = max(cands, key=lambda x: x[1])
        picks.append({"ts": r["match_dt"], "home": r["home_team"], "away": r["away_team"],
                      "market": mk, "prob": float(pr)})
    picks.sort(key=lambda x: x["ts"])
    return picks[:3]


def cadru_hook(target_date):
    """HOOK AGRESIV: countdown la WC + provocare 'Pe ce e SIGUR?'"""
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    # Calculează zile rămase până la 11 iun 2026
    from datetime import date as _date
    days_to = (_date(2026, 6, 11) - _date.today()).days
    if days_to > 0:
        f_huge = ImageFont.truetype(FONT_SERIF, 380)
        draw_centered(d, f"{days_to}", 380, f_huge, GOLD)
        f_med = ImageFont.truetype(FONT_BOLD, 68)
        draw_centered(d, "zile până la", 800, f_med, WHITE)
        f_big = ImageFont.truetype(FONT_BOLD, 110)
        draw_centered(d, "MONDIAL", 920, f_big, GOLD)
    else:
        f_big = ImageFont.truetype(FONT_BOLD, 130)
        draw_centered(d, "MONDIAL 2026", 480, f_big, GOLD)
        f_huge = ImageFont.truetype(FONT_BOLD, 90)
        draw_centered(d, target_date.strftime("%d %b"), 660, f_huge, WHITE)
    f_q = ImageFont.truetype(FONT_BOLD, 78)
    draw_centered(d, "Pe ce e SIGUR", 1100, f_q, MUTED)
    draw_centered(d, "modelul? →", 1200, f_q, GOLD)
    f_n = ImageFont.truetype(FONT, 40)
    draw_centered(d, "calibrat pe 6.746 meciuri naționale", 1340, f_n, MUTED)
    add_disclaimer(d)
    return img


def cadru_pick(idx, total, pick):
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    f_idx = ImageFont.truetype(FONT_BOLD, 60)
    draw_centered(d, f"#{idx} din {total}", 420, f_idx, GOLD)
    d.rectangle([60, 580, W - 60, 970], outline=GOLD, width=3)
    f_lg = ImageFont.truetype(FONT, 34)
    d.text((90, 605), "World Cup · faza grupe", font=f_lg, fill=MUTED)
    ts_local = pick["ts"].to_pydatetime().astimezone(timezone(timedelta(hours=3)))
    f_ora = ImageFont.truetype(FONT_BOLD, 46)
    bbox = d.textbbox((0,0), ts_local.strftime("%H:%M"), font=f_ora)
    d.text((W - 90 - (bbox[2]-bbox[0]), 600), ts_local.strftime("%H:%M"), font=f_ora, fill=WHITE)
    f_t = ImageFont.truetype(FONT_BOLD, 60)
    draw_centered(d, truncate(pick["home"], 22), 700, f_t, WHITE)
    f_vs = ImageFont.truetype(FONT, 38)
    draw_centered(d, "vs", 770, f_vs, MUTED)
    draw_centered(d, truncate(pick["away"], 22), 815, f_t, WHITE)
    f_p = ImageFont.truetype(FONT_BOLD, 70)
    draw_centered(d, pick["market"], 1020, f_p, WHITE)
    f_h = ImageFont.truetype(FONT_SERIF, 200)
    draw_centered(d, f"{int(pick['prob']*100)}%", 1110, f_h, GREEN_BRIGHT)
    f_lbl = ImageFont.truetype(FONT_BOLD, 50)
    draw_centered(d, "calibrare ROBUSTĂ", 1340, f_lbl, GREEN_BRIGHT)
    add_disclaimer(d)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="Data țintă YYYY-MM-DD")
    args = ap.parse_args()
    target_date = None
    if args.date:
        target_date = datetime.strptime(args.date, "%Y-%m-%d").date()

    picks = load_wc_picks(target_date)
    if not picks:
        print("❌ Niciun pick WC în window cu Over 1.5/HT 0.5 calibrate.")
        return 1

    out_dir = Path("/tmp/poseidon_wc_v2"); out_dir.mkdir(exist_ok=True)
    for f in out_dir.glob("*.png"): f.unlink()

    dt_label = target_date or picks[0]["ts"].to_pydatetime().date()
    cadru_loop().save(out_dir / "01_loop.png")
    cadru_hook(dt_label).save(out_dir / "02_hook.png")
    for i, p in enumerate(picks, 1):
        cadru_pick(i, len(picks), p).save(out_dir / f"0{i+2}_pick.png")
    cadru_intrebare("Pe cine", "vezi", "câștigând?").save(out_dir / f"0{len(picks)+3}_intrebare.png")
    cadru_loop().save(out_dir / f"0{len(picks)+4}_loop.png")

    tag = (target_date or date.today()).isoformat()
    output = Path.home() / f"Desktop/POSEIDON-WC-{tag}.mp4"
    render(out_dir, output, hold=2.6, xfade=0.4)
    sz = output.stat().st_size // 1024
    print(f"✓ {output}  {sz} KB")
    for i, p in enumerate(picks, 1):
        ts = p["ts"].to_pydatetime().astimezone(timezone(timedelta(hours=3))).strftime("%d %b %H:%M")
        print(f"  #{i} {ts}  {p['home']} vs {p['away']}  | {p['market']} {int(p['prob']*100)}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
