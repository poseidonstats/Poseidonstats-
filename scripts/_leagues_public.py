"""Filtru UNIC de ligi permise în conținut PUBLIC (clipuri, Telegram, captions).

Sursa regulii: feedback_social_caption_rules (9 iun 2026) — public DOAR top divizii
mari + naționale + cupe europene. Un singur loc, importat de toate scripturile de
conținut (gen_top3_clip, gen_yesterday_clip, viitorul post_telegram_public), ca să
nu existe două filtre care se depărtează.

Match EXACT (case-insensitive) pe (country, league) — nu substring, ca „Bundesliga"
să nu prindă „U19 Bundesliga"/„2. Bundesliga". Ligă absentă din liste = respinsă
(fail-closed). Numele se verifică contra predictions.json la orice adăugare.

DECIZIA D1 (29 aug, la Andreea): EXTENDED on/off. Comută INCLUDE_EXTENDED mai jos
(sau env POSEIDON_PUBLIC_EXTENDED=1/0 pentru teste, care are prioritate).
"""
from __future__ import annotations

import os

# ── CERT (regula scrisă): top divizii mari ─────────────────────────────────
CORE_EXACT = {
    ("england", "premier league"),
    ("spain", "la liga"),
    ("germany", "bundesliga"),
    ("italy", "serie a"),
    ("france", "ligue 1"),
    ("netherlands", "eredivisie"),
    ("portugal", "primeira liga"),
}
# Cupe europene + naționale (country="World" în API-Football) — substring aici e
# intenționat: prinde „World Cup - Qualification Europe" etc. (tot fotbal de națiuni).
CORE_WORLD_SUBSTR = (
    "champions league", "europa league", "conference league",
    "world cup", "euro championship", "nations league", "friendlies",
)

# ── ZONA GRI (D1 — recomandarea executorului FUNNEL, 29 aug) ───────────────
EXTENDED_EXACT = {
    # palierul 2 european
    ("england", "championship"), ("germany", "2. bundesliga"),
    ("italy", "serie b"), ("france", "ligue 2"), ("spain", "segunda división"),
    # cupele naționale top-5
    ("england", "fa cup"), ("england", "league cup"), ("germany", "dfb pokal"),
    ("italy", "coppa italia"), ("spain", "copa del rey"), ("france", "coupe de france"),
    # tier 1 european mai mic (+ România — publicul nostru)
    ("romania", "liga i"), ("turkey", "süper lig"), ("belgium", "jupiler pro league"),
    ("switzerland", "super league"), ("austria", "bundesliga"), ("denmark", "superliga"),
    ("greece", "super league 1"), ("croatia", "hnl"), ("poland", "ekstraklasa"),
    ("czech-republic", "czech liga"), ("scotland", "premiership"),
    # tier 1 non-european (legitim, dar „DA rar" — conținut, nu reguli)
    ("saudi-arabia", "pro league"), ("usa", "major league soccer"),
    ("mexico", "liga mx"), ("brazil", "serie a"),
    ("argentina", "liga profesional argentina"),
    ("japan", "j1 league"), ("south-korea", "k league 1"),
}

# Centură de siguranță peste orice listă: tineret/rezerve/feminin nu ies public.
EXCLUDE_SUBSTR = (
    "u17", "u18", "u19", "u20", "u21", "u23", "youth", "primavera",
    "reserve", "women", "frauen", "femenin",
)

INCLUDE_EXTENDED = False  # ← D1: Andreea comută aici


def _extended_on() -> bool:
    env = os.environ.get("POSEIDON_PUBLIC_EXTENDED")
    if env is not None:
        return env == "1"
    return INCLUDE_EXTENDED


def is_public_league(country: str, league: str) -> bool:
    """True dacă (country, league) are voie în conținut public."""
    c = (country or "").strip().lower()
    lg = (league or "").strip().lower()
    if any(x in lg for x in EXCLUDE_SUBSTR):
        return False
    if c == "world":
        return any(x in lg for x in CORE_WORLD_SUBSTR)
    if (c, lg) in CORE_EXACT:
        return True
    if _extended_on() and (c, lg) in EXTENDED_EXACT:
        return True
    return False
