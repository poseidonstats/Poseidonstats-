"""Template REUTILIZABIL: generează MP4 vertical 1080×1920 cu TOP 3 meciuri ale zilei.

Logic ONEST:
  - Filtru CALIBRAT obligatoriu (calibrated=True)
  - Bucket "calibrat bun": Over 1.5 70-85% (diff ±5pp confirmat empiric)
  - Exclude prob ≥ 88% (după lecția 3 iun: super-favoriți = umflat percepție)
  - Exclude meciuri în trecut (UTC now)
  - Folosește prob CALIBRATĂ (NU brut) — predictions.json deja are valoarea afișată

Output: ~/Desktop/POSEIDON-top3-{YYYY-MM-DD}.mp4

Usage:
    python3 ~/poseidon-site/scripts/gen_top3_clip.py
    # sau cu fereastră custom:
    python3 ~/poseidon-site/scripts/gen_top3_clip.py --hours 24

CRON sugerat (după publish 07:50):
    08:00 daily — pune fișier pe Desktop pentru postare manuală
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
NAVY1 = (15, 30, 74)
NAVY2 = (30, 58, 138)
GOLD = (245, 197, 66)
WHITE = (255, 255, 255)
MUTED = (200, 210, 230)
GREEN_SOFT = (90, 200, 130)

FONT = "/System/Library/Fonts/Helvetica.ttc"
FONT_BOLD = "/System/Library/Fonts/HelveticaNeue.ttc"

PRED_URL = "https://poseidonstats.com/data/predictions.json"
WHITELIST_CSV = Path.home() / "football_predictor/data/poseidon_whitelist_leagues.csv"

# ALLOW-LIST EXPLICIT (anti-contradicție): doar ligi tier 1-2 + competiții majore.
# Tot whitelist-ul POSEIDON conține și non-league/regional — astea ies AFARĂ.
# Format: (country, league_substring) — match case-insensitive pe substring.
ALLOW_LEAGUES = [
    # Top 5 Europa
    ("England", "Premier League"),
    ("Spain", "La Liga"),
    ("Germany", "Bundesliga"),         # tier 1 + 2.Bundesliga
    ("Italy", "Serie A"),
    ("Italy", "Serie B"),
    ("France", "Ligue 1"),
    ("France", "Ligue 2"),
    # Tier 2 majore
    ("England", "Championship"),
    ("Spain", "Segunda"),
    ("Germany", "2. Bundesliga"),
    # Top alte ligi mari
    ("Netherlands", "Eredivisie"),
    ("Portugal", "Primeira Liga"),
    ("Belgium", "Jupiler Pro League"),
    ("Turkey", "Süper Lig"),
    ("Scotland", "Premiership"),
    ("Greece", "Super League"),
    ("Russia", "Premier League"),
    ("Ukraine", "Premier League"),
    ("Austria", "Bundesliga"),         # NU Landesliga
    ("Switzerland", "Super League"),
    ("Denmark", "Superliga"),
    ("Sweden", "Allsvenskan"),
    ("Norway", "Eliteserien"),
    ("Croatia", "HNL"),
    ("Czech-Republic", "Czech Liga"),  # tier 1 NU 3/4. liga
    ("Poland", "Ekstraklasa"),
    # Tier 1 extra-EU
    ("USA", "MLS"),
    ("Mexico", "Liga MX"),
    ("Brazil", "Serie A"),
    ("Argentina", "Liga Profesional"),
    ("Saudi-Arabia", "Pro League"),
    ("Japan", "J1 League"),
    ("South-Korea", "K League 1"),
    ("Australia", "A-League"),
    # Competiții internaționale
    ("World", "UEFA Champions League"),
    ("World", "UEFA Europa League"),
    ("World", "UEFA Conference League"),
    ("World", "FIFA World Cup"),
    ("Europe", "Euro Championship"),
]

# Filtre de calibrare ONESTE (conform calibration.json)
MAX_PROB = 0.88   # exclude super-favoriți (lecția 3 iun)
MIN_PROB = 0.70   # bucket 70-90% Over 1.5/2.5 calibrat optim

# Filtru ANTI-CONTRADICȚIE STRICT (lecția 3 iun): doar tier 1-2 majore.
# Patterns oneste: clipul 5 spune "pe ligi mici e slab" → TOP 3 EXCLUDE TOATE alea.
EXCLUDE_LEAGUE_PATTERNS = [
    "Friendly", "Friendlies",
    "U23", "U21", "U20", "U19", "U18", "U17",
    "Youth", "Primavera", "Junior",
    "Reserve",
    "Women", "W ", "Wom.",
    # Anti-tier mic (chiar dacă sunt în whitelist):
    "Non League", "Amateur", "Regionalliga",
    "3. liga", "4. liga", "5. liga",
    "II Liga", "III Liga",
    "Div One", "Div Two", "Division 4", "Division 5",
    "Reserves", "Réservas",
]
EXCLUDE_COUNTRY = {"World"}  # amicale internaționale

# Reserve teams pattern în NUMELE echipei (Teplice II, Bayern II, etc.)
EXCLUDE_TEAM_SUFFIX = (" II", " III", " B", " C", " Reserve", " Reserves", " U21", " U19", " U18", " U23", " U20")


def gradient_bg():
    img = Image.new("RGB", (W, H), NAVY1)
    px = img.load()
    for y in range(H):
        t = y / H
        r = int(NAVY1[0] * (1 - t) + NAVY2[0] * t)
        g = int(NAVY1[1] * (1 - t) + NAVY2[1] * t)
        b = int(NAVY1[2] * (1 - t) + NAVY2[2] * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    return img


def draw_centered(draw, text, y, font, color=WHITE):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((W - w) / 2, y), text, font=font, fill=color)
    return bbox[3] - bbox[1]


def draw_trident(draw, cx, cy, size=70):
    s = size
    draw.rectangle([cx-4, cy-s*0.3, cx+4, cy+s*0.8], fill=GOLD)
    for dx in (-s*0.55, 0, s*0.55):
        x = cx + dx
        draw.polygon([(x-12, cy-s*0.2), (x+12, cy-s*0.2), (x, cy-s*0.85)], fill=GOLD)
        draw.rectangle([x-4, cy-s*0.3, x+4, cy+s*0.1], fill=GOLD)
    draw.arc([cx-s*0.6, cy-s*0.4, cx+s*0.6, cy+s*0.3], 0, 180, fill=GOLD, width=8)
    draw.line([(cx, cy+s*0.3), (cx, cy+s*0.95)], fill=GOLD, width=8)
    draw.ellipse([cx-12, cy+s*0.85, cx+12, cy+s*1.1], fill=GOLD)


def add_trident_top(draw):
    draw_trident(draw, W // 2, 165, size=90)
    f2 = ImageFont.truetype(FONT_BOLD, 44)
    draw_centered(draw, "POSEIDON", 280, f2, WHITE)


def add_disclaimer(draw):
    f = ImageFont.truetype(FONT, 32)
    draw_centered(draw, "date informative · 18+ · nu garanție", H - 90, f, MUTED)


def truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def load_whitelist_ids() -> set[int]:
    """Citește league_id-urile din whitelist-ul POSEIDON (114 ligi bine calibrate)."""
    import csv
    ids = set()
    with open(WHITELIST_CSV) as f:
        for row in csv.DictReader(f):
            try:
                ids.add(int(row["league_id"]))
            except (ValueError, KeyError):
                continue
    return ids


def league_allowed(league: str, country: str) -> bool:
    """True DOAR dacă (country, league) e în ALLOW_LEAGUES.
    Allow-list explicit > deny-list nesfârșit (lecția 3 iun).
    """
    league_l = league.lower()
    for allow_country, allow_substr in ALLOW_LEAGUES:
        if country == allow_country and allow_substr.lower() in league_l:
            return True
    return False


def team_excluded(name: str) -> bool:
    """True dacă echipa e rezerve/tineret (sufix II/B/U21 etc.)."""
    return any(name.endswith(suf) for suf in EXCLUDE_TEAM_SUFFIX)


def select_top3(hours_ahead: int, verbose: bool = False) -> list[dict]:
    data = json.loads(urllib.request.urlopen(PRED_URL, timeout=15).read())
    matches = data.get("matches", [])
    whitelist = load_whitelist_ids()
    now = datetime.now(timezone.utc)
    end = now + timedelta(hours=hours_ahead)
    candidates = []
    stats = {"total": 0, "window": 0, "calibrated": 0, "whitelist": 0, "non_minor": 0, "in_bucket": 0}
    for m in matches:
        stats["total"] += 1
        try:
            md = datetime.fromisoformat(m["match_date"].replace("Z", "+00:00"))
        except Exception:
            continue
        if md < now or md > end:
            continue
        stats["window"] += 1
        if not m.get("calibrated", False):
            continue
        stats["calibrated"] += 1
        # FILTRU NOU: doar ligi din whitelist
        lid = m.get("league_id") or m.get("fixture_id")  # fallback dacă lipsește
        # league_id NU e în predictions.json — caut prin league name în whitelist
        # → folosesc filtrul după nume + țară (mai robust)
        if not league_allowed(m["league"], m["country"]):
            continue
        if team_excluded(m["home_team"]) or team_excluded(m["away_team"]):
            continue
        stats["non_minor"] += 1
        # markets calibrate bine (Over 1.5 70-90%, Over 2.5 50-70%, HT Over 0.5 60-80%)
        picks = []
        if MIN_PROB <= m["prob_over_1_5"] < MAX_PROB:
            picks.append(("Over 1.5", m["prob_over_1_5"]))
        if 0.50 <= m["prob_over_2_5"] < 0.70:
            picks.append(("Over 2.5", m["prob_over_2_5"]))
        if 0.60 <= m["prob_ht_over_0_5"] < 0.80:
            picks.append(("HT Over 0.5", m["prob_ht_over_0_5"]))
        if not picks:
            continue
        stats["in_bucket"] += 1
        market, prob = max(picks, key=lambda x: x[1])
        candidates.append({
            "fixture_id": m["fixture_id"],
            "ts": md,
            "home": m["home_team"],
            "away": m["away_team"],
            "country": m["country"],
            "league": m["league"],
            "market": market,
            "prob": prob,
        })
    candidates.sort(key=lambda x: -x["prob"])
    if verbose:
        print(f"[funnel] total={stats['total']} → în fereastră={stats['window']} "
              f"→ calibrat={stats['calibrated']} → non-minor={stats['non_minor']} → în bucket={stats['in_bucket']}")
    return candidates[:3]


def make_match_card(d: ImageDraw.ImageDraw, y_top: int, idx: int, pick: dict):
    """Renderează card meci compact pe MP4."""
    cy = y_top + 110
    # Box
    box_top = y_top
    box_bottom = y_top + 360
    d.rectangle([60, box_top, W - 60, box_bottom], outline=GOLD, width=3)

    # Index #1/#2/#3
    f_idx = ImageFont.truetype(FONT_BOLD, 56)
    d.text((90, box_top + 20), f"#{idx}", font=f_idx, fill=GOLD)

    # Ora
    ts_local = pick["ts"].astimezone(timezone(timedelta(hours=3)))  # EEST
    ora = ts_local.strftime("%H:%M")
    f_ora = ImageFont.truetype(FONT_BOLD, 48)
    bbox = d.textbbox((0, 0), ora, font=f_ora)
    d.text((W - 90 - (bbox[2] - bbox[0]), box_top + 28), ora, font=f_ora, fill=WHITE)

    # Țara + ligă
    f_lig = ImageFont.truetype(FONT, 32)
    txt = truncate(f"{pick['country']} · {pick['league']}", 38)
    d.text((90, box_top + 100), txt, font=f_lig, fill=MUTED)

    # Echipele (centrat)
    f_team = ImageFont.truetype(FONT_BOLD, 50)
    home = truncate(pick["home"], 24)
    away = truncate(pick["away"], 24)
    draw_centered(d, home, box_top + 160, f_team, WHITE)
    f_vs = ImageFont.truetype(FONT, 36)
    draw_centered(d, "vs", box_top + 220, f_vs, MUTED)
    draw_centered(d, away, box_top + 260, f_team, WHITE)


def cadru1(pick_count: int, ts_label: str) -> Image.Image:
    """Cadru hook."""
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    add_trident_top(d)
    huge = ImageFont.truetype(FONT_BOLD, 130)
    draw_centered(d, "TOP 3", 580, huge, GOLD)
    big = ImageFont.truetype(FONT_BOLD, 88)
    draw_centered(d, "meciuri azi", 740, big, WHITE)
    med = ImageFont.truetype(FONT_BOLD, 58)
    draw_centered(d, "unde modelul e", 940, med, WHITE)
    draw_centered(d, "cel mai sigur.", 1010, med, WHITE)
    small = ImageFont.truetype(FONT, 44)
    draw_centered(d, f"calibrat pe 65.250 meciuri", 1180, small, MUTED)
    draw_centered(d, ts_label, 1240, small, MUTED)
    add_disclaimer(d)
    return img


def cadru_pick(idx: int, pick: dict) -> Image.Image:
    """Cadru meci individual."""
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    add_trident_top(d)
    # Header
    f_h = ImageFont.truetype(FONT_BOLD, 70)
    draw_centered(d, f"#{idx} din 3", 440, f_h, GOLD)

    # Card
    make_match_card(d, 580, idx, pick)

    # Prob calibrată mare
    big = ImageFont.truetype(FONT_BOLD, 78)
    draw_centered(d, pick["market"], 1010, big, WHITE)
    huge = ImageFont.truetype(FONT_BOLD, 220)
    draw_centered(d, f"{int(pick['prob']*100)}%", 1100, huge, GREEN_SOFT)
    small = ImageFont.truetype(FONT, 40)
    draw_centered(d, "(probabilitate calibrată empiric)", 1380, small, MUTED)
    add_disclaimer(d)
    return img


def cadru_outro() -> Image.Image:
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    add_trident_top(d)
    big = ImageFont.truetype(FONT_BOLD, 80)
    parts = ["NU pariază pe astea.", "", "Astea sunt meciurile", "unde modelul e", "cel mai sigur azi."]
    y = 540
    for line in parts:
        h = draw_centered(d, line, y, big, WHITE)
        y += h + 22
    huge = ImageFont.truetype(FONT_BOLD, 78)
    draw_centered(d, "Verifică pe site:", 1180, ImageFont.truetype(FONT_BOLD, 56), MUTED)
    draw_centered(d, "poseidonstats", 1280, huge, GOLD)
    draw_centered(d, ".com", 1380, huge, GOLD)
    add_disclaimer(d)
    return img


def render_video(frames_dir: Path, output: Path, hold=3.5, xfade=0.5):
    files = sorted(frames_dir.glob("*.png"))
    if len(files) < 2:
        raise RuntimeError(f"Doar {len(files)} cadre")
    n = len(files)
    inputs = []
    for f in files:
        inputs += ["-loop", "1", "-t", str(hold), "-i", str(f)]
    # offset_i = i * (hold - xfade) — cumulative corect pentru xfade chain
    chain = ""
    prev = "[0:v]"
    step = hold - xfade
    for i in range(1, n):
        off = i * step
        out = f"[v{i}]" if i < n - 1 else "[vfinal]"
        end = "" if i < n - 1 else ",format=yuv420p"
        chain += f"{prev}[{i}:v]xfade=transition=fade:duration={xfade}:offset={off:.2f}{end}{out};"
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=24, help="Fereastra în ore (default 24)")
    ap.add_argument("--output", default=None, help="Path output MP4")
    args = ap.parse_args()

    picks = select_top3(args.hours, verbose=True)
    if len(picks) < 3:
        print(f"\n❌ Doar {len(picks)} picks pe ligi mari calibrate în fereastra de {args.hours}h.")
        print("    Output ANULAT — onestitate înainte de volum.")
        if picks:
            print("\n    Ce a trecut (insuficient pentru TOP 3):")
            for p in picks:
                ts = p["ts"].astimezone(timezone(timedelta(hours=3))).strftime("%H:%M")
                print(f"     {ts}  {p['home']} vs {p['away']}  | {p['market']} {int(p['prob']*100)}%  | {p['country']}/{p['league']}")
        return 1

    today_label = datetime.now().strftime("%d %b %Y")
    out_dir = Path("/tmp/poseidon_top3_frames")
    out_dir.mkdir(exist_ok=True)
    for f in out_dir.glob("*.png"):
        f.unlink()

    cadru1(len(picks), today_label).save(out_dir / "01_hook.png")
    for i, p in enumerate(picks, 1):
        cadru_pick(i, p).save(out_dir / f"0{i+1}_pick{i}.png")
    cadru_outro().save(out_dir / "05_outro.png")

    if args.output:
        output = Path(args.output)
    else:
        date_tag = datetime.now().strftime("%Y-%m-%d")
        output = Path.home() / f"Desktop/POSEIDON-top3-{date_tag}.mp4"

    render_video(out_dir, output)
    size = output.stat().st_size // 1024
    print(f"✓ {output}  {size} KB")
    print()
    print("=== TOP 3 selectat (verificare onestă cifre) ===")
    for i, p in enumerate(picks, 1):
        ts = p["ts"].astimezone(timezone(timedelta(hours=3))).strftime("%H:%M")
        print(f"  #{i}  {ts}  {p['home']} vs {p['away']}  | {p['market']} {int(p['prob']*100)}%  | {p['country']}/{p['league']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
