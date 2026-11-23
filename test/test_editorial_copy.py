from pathlib import Path
import re
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from editorial_copy import editorial_text


@pytest.mark.parametrize(
    ("lang", "phrase"),
    [
        ("ro", "Sezonul curent"),
        ("en", "Current season"),
        ("es", "Temporada actual"),
        ("it", "Stagione in corso"),
        ("fr", "Saison en cours"),
        ("id", "Musim berjalan"),
    ],
)
def test_retains_sample_counts_in_each_language(lang, phrase):
    assert editorial_text(f"aPi–FooTball, {phrase.lower()}: 40/77.", lang) == f"{phrase}: 40/77."


def test_displays_historical_data_limit_without_attribution():
    assert editorial_text("H2H: nessun precedente nel database API-Football.", "it") == "H2H: nessun precedente."
    assert editorial_text("Le classement reçu d'API-Football appartient à une autre série.", "fr") == (
        "Le classement appartient à une autre série."
    )


def test_shipped_html_has_no_vendor_references():
    root = Path(__file__).resolve().parents[1]
    paths = [root / "index.html", root / "meciuri.html", *(root / "analize").glob("*.html")]
    provider = re.compile(r"\bapi[-‐‑–—\s]*football\b", re.IGNORECASE)
    assert not [path for path in paths if provider.search(path.read_text(encoding="utf-8"))]
