"""1 oct 2026 — titlurile paginilor de ligă prind intenția de căutare: „Predicții <ligă> <an> | Probabilități și meciuri”, țara doar unde liga e ambiguă."""
import sys
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_seo_pages as G


def test_nume_scurt():
    assert G.nume_scurt("Premier League (Anglia)") == "Premier League"
    assert G.nume_scurt("Premier League (Rusia)") == "Premier League Rusia"
    assert G.nume_scurt("Liga 1 (SuperLiga României)") == "Liga 1 România"
    assert G.nume_scurt("Serie A (Brazilia)") == "Serie A Brazilia"
    assert G.nume_scurt("Championship (Anglia)") == "Championship"
    assert G.nume_scurt("Fără paranteze") == "Fără paranteze"


def test_pagina_liga_are_titlul_si_h1_noi():
    html = G.pagina_liga("England", "Premier League", "anglia-premier-league", "Premier League (Anglia)", meciuri=[], cal=None, zile=[])
    an = datetime.now().year
    assert f"<title>Predicții Premier League {an} | Probabilități și meciuri</title>" in html
    assert '<h1 class="hero-title">Predicții Premier League</h1>' in html
    assert "Probabilități pentru meciurile din Premier League (Anglia)" in html
