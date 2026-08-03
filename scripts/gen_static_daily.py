#!/usr/bin/env python3
"""Conținut static zilnic pentru SEO — rulat de daily_publish.sh la fiecare publish.

Face două lucruri:
  1. Rescrie secțiunea dintre markerii DAILY_STATIC din index.html cu top 3
     picks calibrate ale zilei (text static în HTML — Google primește conținut
     proaspăt zilnic, nu doar JSON încărcat din JS).
  2. Actualizează <lastmod> în sitemap.xml pentru paginile cu changefreq daily
     (era înghețat la 2026-06-11 — semnal de site mort pentru crawler).

Regulile de onestitate (CLAUDE.md): probabilități CALIBRATE, round(p*100),
prag pick identic cu app.js (O1.5 ≥0.75, restul ≥0.65), MAX_PROB_DISPLAY=0.88
(fără super-favoriți umflați ca exemple), fără echipe W/tineret/rezerve.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SITE = Path.home() / "poseidon-site"
PRED = SITE / "data" / "predictions.json"
INDEX = SITE / "index.html"
SITEMAP = SITE / "sitemap.xml"

START = "<!-- DAILY_STATIC_START -->"
END = "<!-- DAILY_STATIC_END -->"

MAX_PROB_DISPLAY = 0.88
EXCLUDE_TEAM = re.compile(
    r"\b(II|III|B|C|Reserves?|U1[4-9]|U2[0-3]|W|Women|Ladies|Femenino|Femenil|Feminin)\b",
    re.IGNORECASE,
)
EXCLUDE_LEAGUE = re.compile(r"women|femenil|femenino|feminin|ladies|w-league", re.IGNORECASE)

# piață → (cheie JSON, prag pick — sincron cu pickBadge() din assets/app.js)
MARKETS = [
    ("Over 1.5 goluri", "prob_over_1_5", 0.75),
    ("Over 2.5 goluri", "prob_over_2_5", 0.65),
    ("Over 3.5 goluri", "prob_over_3_5", 0.65),
    ("Victorie gazde", "prob_home", 0.65),
    ("Victorie oaspeți", "prob_away", 0.65),
    ("Ambele marchează", "prob_btts", 0.65),
]

RO_MONTHS = ["", "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
             "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]


def bucharest_today() -> datetime:
    # EEST vara (UTC+3) — suficient pentru granița de zi; iarna +2 nu strică
    # selecția (meciurile de la miezul nopții alunecă o zi, acceptabil pentru extras).
    return datetime.now(timezone(timedelta(hours=3)))


def todays_picks(limit: int = 3) -> tuple[list[str], int]:
    data = json.loads(PRED.read_text())
    matches = data["matches"] if isinstance(data, dict) and "matches" in data else data
    today = bucharest_today().date().isoformat()
    picks = []
    n_today = 0
    for m in matches:
        if not str(m.get("match_date", "")).startswith(today):
            continue
        n_today += 1
        if not m.get("calibrated"):
            continue
        home, away = str(m.get("home_team", "")), str(m.get("away_team", ""))
        league = f"{m.get('country', '')} · {m.get('league', '')}"
        if EXCLUDE_TEAM.search(home) or EXCLUDE_TEAM.search(away) or EXCLUDE_LEAGUE.search(league):
            continue
        for label, key, prag in MARKETS:
            p = m.get(key)
            if p is None or p < prag or p > MAX_PROB_DISPLAY:
                continue
            picks.append((p, f"<li><strong>{home} – {away}</strong> ({league}): "
                             f"{label} — <strong>{round(p * 100)}%</strong> calibrat</li>"))
    picks.sort(key=lambda x: -x[0])
    # un singur pick per meci (cel mai probabil), apoi top N
    seen, out = set(), []
    for p, html in picks:
        match_key = html.split("(")[0]
        if match_key in seen:
            continue
        seen.add(match_key)
        out.append(html)
        if len(out) >= limit:
            break
    return out, n_today


def build_section() -> str:
    d = bucharest_today()
    date_ro = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    picks, n_today = todays_picks()
    lines = [
        START,
        '  <section class="daily-static" id="repere-azi">',
        f"    <h2>⭐ Predicții fotbal azi — {date_ro}</h2>",
    ]
    if picks:
        lines.append(f"    <p>Repere calibrate din cele {n_today} meciuri analizate azi de model "
                     "(lista completă, cu filtre, mai jos):</p>")
        lines.append("    <ul>")
        lines += ["      " + p for p in picks]
        lines.append("    </ul>")
    else:
        lines.append(f"    <p>Modelul a analizat azi {n_today} meciuri; niciun reper calibrat "
                     "peste pragurile de afișare — lista completă mai jos.</p>")
    lines.append('    <p class="pro-disclaimer">probabilități calibrate empiric · informativ · '
                 "nu sfat de pariere · 18+</p>")
    lines.append("  </section>")
    lines.append("  " + END)
    return "\n".join(lines)


def update_index() -> None:
    html = INDEX.read_text()
    if START not in html or END not in html:
        sys.exit(f"[gen_static_daily] markerii {START} lipsesc din index.html — abort")
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), build_section(), html, flags=re.S)
    INDEX.write_text(new)


def update_sitemap() -> None:
    today = bucharest_today().date().isoformat()
    xml = SITEMAP.read_text()
    # lastmod la zi DOAR pentru URL-urile cu changefreq daily
    def bump(m: re.Match) -> str:
        block = m.group(0)
        if "<changefreq>daily</changefreq>" in block:
            block = re.sub(r"<lastmod>[^<]*</lastmod>", f"<lastmod>{today}</lastmod>", block)
        return block
    SITEMAP.write_text(re.sub(r"<url>.*?</url>", bump, xml, flags=re.S))


if __name__ == "__main__":
    update_index()
    update_sitemap()
    print(f"[gen_static_daily] OK — index.html + sitemap.xml la {bucharest_today().date().isoformat()}")
