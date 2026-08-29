#!/usr/bin/env python3
"""Conținut static zilnic pentru SEO — rulat de daily_publish.sh la fiecare publish.

Face trei lucruri:
  1. Rescrie secțiunea dintre markerii DAILY_STATIC din index.html cu top 3
     picks calibrate ale zilei (text static în HTML — Google primește conținut
     proaspăt zilnic, nu doar JSON încărcat din JS).
  2. Rescrie secțiunea dintre markerii PROOF_STATIC din index.html cu tabelul
     „ce s-a adeverit" din data/history.json (cumulated_markets) — dovada de
     conversie de pe homepage, statică pentru crawler și niciodată inventată.
  3. Actualizează <lastmod> în sitemap.xml pentru paginile cu changefreq daily
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

# Filtrul de ligi pentru AFIȘAJ PUBLIC vine din modulul UNIC — un singur loc, ca să
# nu existe două liste care se depărtează (29 aug 2026). „Repere azi" e vitrina de pe
# homepage: până acum scotea în față Hungary NB III / Czech 4. liga, adică exact
# opusul a ce vrea să demonstreze blocul.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _leagues_public import is_public_league

SITE = Path.home() / "poseidon-site"
PRED = SITE / "data" / "predictions.json"
HIST = SITE / "data" / "history.json"
INDEX = SITE / "index.html"
SITEMAP = SITE / "sitemap.xml"

START = "<!-- DAILY_STATIC_START -->"
END = "<!-- DAILY_STATIC_END -->"
PROOF_START = "<!-- PROOF_STATIC_START -->"
PROOF_END = "<!-- PROOF_STATIC_END -->"

# tier → clasă badge; identic cu maparea din assets/app.js (renderIstoric)
TIER_CLASS = {
    "STRONG ROBUST": "tier-elite",
    "ROBUST": "tier-strong",
    "PROMISING": "tier-good",
    "PRE-PROMISING": "tier-mid",
    "DROP": "tier-drop",
}

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


def todays_picks(limit: int = 3) -> tuple[list[str], int, int]:
    """Returnează (repere, meciuri_azi, repere_respinse_de_filtrul_public).

    Al treilea număr contează pentru onestitatea mesajului de rezervă: „niciun reper
    peste praguri" ar fi FALS în zilele în care există repere, dar toate în ligi mici.
    """
    data = json.loads(PRED.read_text())
    matches = data["matches"] if isinstance(data, dict) and "matches" in data else data
    today = bucharest_today().date().isoformat()
    picks = []
    n_today = 0
    n_respinse = 0
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
        if not is_public_league(m.get("country", ""), m.get("league", "")):
            if any((m.get(k) is not None and prag <= m[k] <= MAX_PROB_DISPLAY)
                   for _, k, prag in MARKETS):
                n_respinse += 1
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
    return out, n_today, n_respinse


def build_section() -> str:
    d = bucharest_today()
    date_ro = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    picks, n_today, n_respinse = todays_picks()
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
    elif n_respinse:
        # Există repere, dar toate în competiții pe care nu le punem în vitrină.
        # A scrie „niciun reper peste praguri" ar fi minciună prin omisiune.
        lines.append(f"    <p>Modelul a analizat azi {n_today} meciuri. În campionatele mari nu "
                     f"e azi niciun reper peste pragurile de afișare; cele "
                     f"{n_respinse} care trec pragul sunt în competiții mici, pe care nu le "
                     "scoatem în față. Lista completă, cu filtre, e mai jos.</p>")
    else:
        lines.append(f"    <p>Modelul a analizat azi {n_today} meciuri; niciun reper calibrat "
                     "peste pragurile de afișare — lista completă mai jos.</p>")
    lines.append('    <p class="pro-disclaimer">probabilități calibrate empiric · informativ · '
                 "nu sfat de pariere · 18+</p>")
    lines.append("  </section>")
    lines.append("  " + END)
    return "\n".join(lines)


def build_proof_section() -> str | None:
    """Tabelul „ce s-a adeverit" din jurnalul forward (history.json).

    Cifrele NU se ating: hit_pct / wlo_pct / tier vin exact așa cum le-a scris
    pipeline-ul. Rândul DROP se afișează deliberat — e diferențiatorul de brand
    (arătăm și piața pe care modelul NU prezice bine). Fără history.json valid →
    None, iar update_proof() lasă secțiunea existentă neatinsă.
    """
    try:
        data = json.loads(HIST.read_text())
    except (OSError, ValueError):
        return None
    markets = data.get("cumulated_markets") or []
    if not markets:
        return None

    d = bucharest_today()
    date_ro = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    rows = []
    for m in markets:
        tier = str(m.get("tier", ""))
        cls = TIER_CLASS.get(tier, "tier-noise")
        tr_cls = ' class="is-drop"' if tier == "DROP" else ""
        n_ro = f'{m["n"]:,}'.replace(",", ".")   # separator de mii românesc
        rows.append(
            f'          <tr{tr_cls}>'
            f'<td><strong>{m["name"]}</strong></td>'
            f'<td>{n_ro}</td>'
            f'<td class="hit">{m["hit_pct"]:.1f}%</td>'
            f'<td>{m["wlo_pct"]:.1f}%</td>'
            f'<td><span class="tier-badge {cls}">{tier}</span></td>'
            f'</tr>'
        )

    return "\n".join([
        PROOF_START,
        '  <section class="proof" id="dovada">',
        '    <h2 data-i18n="proof.h2">Ce s-a adeverit, din predicții înghețate</h2>',
        '    <p class="proof-lead" data-i18n="proof.lead">Jurnal deschis din 2 iunie 2026. '
        'Fiecare predicție e înghețată la generare (07:15), publicată înainte de meci și '
        'comparată apoi cu rezultatul real. Nu ștergem nimic retroactiv.</p>',
        '    <div class="proof-table-wrap">',
        '      <table class="proof-table">',
        '        <thead><tr>',
        '          <th data-i18n="proof.th.market">Piață</th>',
        '          <th data-i18n="proof.th.n">Predicții rezolvate</th>',
        '          <th data-i18n="proof.th.hit">S-au adeverit</th>',
        '          <th data-i18n="proof.th.wlo">Minim statistic (Wilson 95%)</th>',
        '          <th data-i18n="proof.th.tier">Verdict propriu</th>',
        '        </tr></thead>',
        '        <tbody>',
        *rows,
        '        </tbody>',
        '      </table>',
        '    </div>',
        '    <p class="proof-note" data-i18n="proof.note">Rândul roșu e aici intenționat: acolo '
        'modelul <strong>nu</strong> prezice suficient de bine, iar noi îl marcăm <strong>DROP</strong> '
        'în propriul nostru tabel. Un site care îți arată doar ce a mers nu-ți arată nimic.</p>',
        '    <p class="proof-note">„Verdict propriu\" ține de mărimea eșantionului și de limita '
        'Wilson, <strong>nu</strong> de avantajul peste rata naturală a pieței. Tabelul complet, '
        'bucket cu bucket: <a href="track-record.html">track record</a> · '
        '<a href="istoric.html">istoric zi cu zi</a>.</p>',
        f'    <p class="proof-asof">Cifre din jurnalul forward, actualizate {date_ro} · '
        'informativ · nu sfat de pariere · 18+</p>',
        '  </section>',
        "  " + PROOF_END,
    ])


def update_proof() -> None:
    html = INDEX.read_text()
    if PROOF_START not in html or PROOF_END not in html:
        print(f"[gen_static_daily] markerii {PROOF_START} lipsesc — sar peste dovadă")
        return
    section = build_proof_section()
    if section is None:
        print("[gen_static_daily] history.json indisponibil/gol — dovada rămâne neatinsă")
        return
    new = re.sub(re.escape(PROOF_START) + r".*?" + re.escape(PROOF_END), lambda _: section,
                 html, flags=re.S)
    INDEX.write_text(new)


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
    update_proof()
    update_sitemap()
    print(f"[gen_static_daily] OK — index.html + sitemap.xml la {bucharest_today().date().isoformat()}")
