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
    assert 'class="hero-title"' in html and 'Predicții Premier League</h1>' in html
    assert "Probabilități pentru meciurile din Premier League (Anglia)" in html


def test_pagina_zi_are_titlu_pe_rezultate_si_echipele_in_descriere():
    zi = {"date": "2026-09-29", "totals": {"wins": 3, "losses": 1}, "matches": [
        {"home": "Czech Republic", "away": "England", "league": "UEFA Nations League", "country": "World", "ft_h": 0, "ft_a": 2, "time": "21:45", "picks": [{"market": "Over 1.5", "prob": 83, "outcome": "WIN"}]},
        {"home": "Spain", "away": "Croatia", "league": "UEFA Nations League", "country": "World", "ft_h": 4, "ft_a": 1, "time": "21:45", "picks": [{"market": "1 (Home)", "prob": 72, "outcome": "WIN"}]}]}
    html = G.pagina_zi(zi)
    assert "<title>Rezultate și predicții verificate 29 septembrie 2026" in html
    assert 'name="description" content="' in html and "Czech Republic – England 0-2" in html.split('name="description" content="')[1].split('"')[0]
    assert "4 predicții rezolvate" in html or "4 predicții" in html
