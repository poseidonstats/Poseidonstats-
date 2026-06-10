"""Clip ZILNIC "Predicția de AZI" — meciuri din predictions.json LIVE.

Optimizat TikTok 2026: LOOP perfect + HOOK + ÎNTREBARE + MUTE.
"""
from __future__ import annotations
import csv
import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from _v2_common import (
    W, H, GOLD, GOLD_DARK, WHITE, MUTED, GREEN_BRIGHT, GREEN_DARK,
    FONT_SERIF, FONT_BOLD, FONT,
    gradient_bg, draw_centered, add_brand_top, add_disclaimer,
    cadru_loop, cadru_intrebare, truncate, render,
)

PRED_URL = "https://poseidonstats.com/data/predictions.json"
WHITELIST_CSV = Path.home() / "football_predictor/data/poseidon_whitelist_leagues.csv"

EXCLUDE_TEAM_SUFFIX = (" II", " III", " B", " C", " Reserve", " U21", " U19", " U18", " U20")
EXCLUDE_LIG = ["U23","U21","U20","U19","U18","Youth","Primavera","Reserve","Women","W "]


def picks_of(m):
    """Replic exact logica site-ului (assets/app.js)."""
    p = []
    if (m.get('prob_home') or 0) >= 0.65: p.append(('1 (Home)', m['prob_home']))
    if (m.get('prob_away') or 0) >= 0.65: p.append(('2 (Away)', m['prob_away']))
    if (m.get('prob_over_2_5') or 0) >= 0.65: p.append(('Over 2.5', m['prob_over_2_5']))
    if (m.get('prob_over_1_5') or 0) >= 0.75: p.append(('Over 1.5', m['prob_over_1_5']))
    if (m.get('prob_over_3_5') or 0) >= 0.65: p.append(('Over 3.5', m['prob_over_3_5']))
    if (m.get('prob_btts') or 0) >= 0.65: p.append(('BTTS Da', m['prob_btts']))
    if (1 - (m.get('prob_btts') or 0)) >= 0.65: p.append(('BTTS Nu', 1 - m['prob_btts']))
    if (1 - (m.get('prob_over_2_5') or 0)) >= 0.65: p.append(('Under 2.5', 1 - m['prob_over_2_5']))
    if (1 - (m.get('prob_over_1_5') or 0)) >= 0.65: p.append(('Under 1.5', 1 - m['prob_over_1_5']))
    if (1 - (m.get('prob_over_3_5') or 0)) >= 0.65: p.append(('Under 3.5', 1 - m['prob_over_3_5']))
    p.sort(key=lambda x: -x[1])
    return p


def load_today():
    d = json.loads(urllib.request.urlopen(PRED_URL, timeout=15).read())
    today = datetime.now(timezone.utc).date().isoformat()
    cands = []
    for m in d.get("matches", []):
        if not m["match_date"].startswith(today): continue
        if not m.get("calibrated", False): continue
        if any(p.lower() in str(m["league"]).lower() for p in EXCLUDE_LIG): continue
        if any(m["home_team"].endswith(s) or m["away_team"].endswith(s) for s in EXCLUDE_TEAM_SUFFIX): continue
        picks = picks_of(m)
        if not picks: continue
        ts = datetime.fromisoformat(m["match_date"].replace("Z","+00:00"))
        cands.append({"ts": ts, "home": m["home_team"], "away": m["away_team"],
                      "country": m["country"], "league": m["league"],
                      "picks": [(mk, round(pr*100)) for mk, pr in picks]})
    cands.sort(key=lambda x: x["ts"])
    return cands


def color_for(p):
    if p >= 80: return GREEN_BRIGHT
    if p >= 70: return GREEN_DARK
    return (140, 230, 170)


def cadru_hook(n_total):
    """HOOK AGRESIV: cifră MARE + provocare 'CÂTE vor ieși?'"""
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    # CIFRA MARE instant — N picks
    f_huge = ImageFont.truetype(FONT_SERIF, 400)
    draw_centered(d, str(n_total), 470, f_huge, GOLD)
    f_big = ImageFont.truetype(FONT_BOLD, 78)
    draw_centered(d, "picks azi.", 920, f_big, WHITE)
    # Întrebare provocatoare
    f_q = ImageFont.truetype(FONT_BOLD, 80)
    draw_centered(d, "CÂTE vor", 1100, f_q, MUTED)
    draw_centered(d, "ieși? →", 1200, f_q, GOLD)
    f_n = ImageFont.truetype(FONT, 38)
    draw_centered(d, "verificare automată mâine", 1330, f_n, MUTED)
    add_disclaimer(d)
    return img


def cadru_lista(picks_subset, idx_label):
    img = gradient_bg(); d = ImageDraw.Draw(img); add_brand_top(d)
    f_lbl = ImageFont.truetype(FONT_BOLD, 44)
    draw_centered(d, idx_label, 360, f_lbl, GOLD)
    n = len(picks_subset)
    if n == 0: return img
    avail = H - 440 - 200
    h_per = avail // n
    y = 440
    for c in picks_subset:
        d.rectangle([60, y, W - 60, y + h_per - 20], outline=GOLD_DARK, width=2)
        ts_local = (c["ts"] + timedelta(hours=3)).strftime("%H:%M")
        f_ora = ImageFont.truetype(FONT_BOLD, 32)
        d.text((90, y + 16), ts_local, font=f_ora, fill=GOLD)
        f_m = ImageFont.truetype(FONT_BOLD, 36)
        d.text((220, y + 14), truncate(f"{c['home']} vs {c['away']}", 32), font=f_m, fill=WHITE)
        f_p = ImageFont.truetype(FONT_BOLD, 28)
        py = y + 80; x_off = 90
        for mk, prob in c["picks"]:
            col = color_for(prob)
            txt = f"★ {mk} {prob}%"
            bbox = d.textbbox((0,0), txt, font=f_p)
            tw = bbox[2] - bbox[0]
            if x_off + tw + 30 > W - 90:
                py += 50; x_off = 90
                if py + 28 > y + h_per - 25: break
            d.rounded_rectangle([x_off-10, py-6, x_off+tw+20, py+40], radius=18,
                                 fill=(20, 60, 35), outline=col, width=2)
            d.text((x_off, py), txt, font=f_p, fill=col)
            x_off += tw + 35
        y += h_per
    add_disclaimer(d)
    return img


def main():
    cands = load_today()
    if not cands:
        print("❌ Niciun pick calibrat azi.")
        return 1

    out_dir = Path("/tmp/poseidon_today_v2"); out_dir.mkdir(exist_ok=True)
    for f in out_dir.glob("*.png"): f.unlink()

    cadru_loop().save(out_dir / "01_loop.png")
    cadru_hook(len(cands)).save(out_dir / "02_hook.png")

    # Split în max 3 grupuri
    n = len(cands)
    g = max(1, (n + 3) // 4)  # ~4 meciuri / cadru
    groups = [cands[i:i+g] for i in range(0, n, g)]
    labels = [f"{groups[i][0]['ts'].astimezone(timezone(timedelta(hours=3))).strftime('%H:%M')}+" if len(groups) > 1 else "" for i in range(len(groups))]

    for i, gp in enumerate(groups[:3]):
        lbl = f"{i*g+1} – {min((i+1)*g, n)}"
        cadru_lista(gp, lbl).save(out_dir / f"0{i+3}_picks.png")

    cadru_intrebare("Tu pe", "care l-ai", "alege?").save(out_dir / f"0{len(groups[:3])+3}_intrebare.png")
    cadru_loop().save(out_dir / f"0{len(groups[:3])+4}_loop.png")

    date_tag = datetime.now().strftime("%Y-%m-%d")
    output = Path.home() / f"Desktop/POSEIDON-azi-{date_tag}.mp4"
    render(out_dir, output, hold=2.5, xfade=0.4)
    sz = output.stat().st_size // 1024
    print(f"✓ {output}  {sz} KB")
    print(f"=== {n} meciuri AZI cu sugestii ★ ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
