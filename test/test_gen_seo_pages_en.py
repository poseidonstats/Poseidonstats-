"""1 oct 2026 — paginile de ligă în ENGLEZĂ (întrebările 4-5 ChatGPT: clientul care plătește caută în engleză): /en/predictions/<slug>.html,
titlu pe intenția de căutare („Premier League Predictions 2026 | Match Probabilities”), hreflang în ambele sensuri, zero română în pagină."""
import sys
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_seo_pages as G
import gen_seo_pages_en as E

M = {"match_date": "2099-01-05T15:00:00Z", "home_team": "Arsenal", "away_team": "Chelsea", "country": "England", "league": "Premier League", "calibrated": True,
     "prob_home": 0.45, "prob_draw": 0.25, "prob_away": 0.30, "prob_over_1_5": 0.78, "prob_over_2_5": 0.55, "prob_over_3_5": 0.30, "prob_btts": 0.56, "xg_home": 1.6, "xg_away": 1.2}


def test_slug_si_nume_en():
    assert E.slug_en("anglia-premier-league") == "england-premier-league"
    assert E.slug_en("romania-liga-1") == "romania-liga-1" and E.slug_en("sua-mls") == "usa-mls" and E.slug_en("uefa-champions-league") == "uefa-champions-league"
    assert E.nume_en("Premier League (Anglia)") == "Premier League" and E.nume_en("Liga 1 (SuperLiga României)") == "Romania Liga 1"
    assert E.nume_en("Serie A (Brazilia)") == "Brazil Serie A" and E.nume_en("Prima ligă (Cehia)") == "Czech First League" and E.nume_en("UEFA Champions League") == "UEFA Champions League"


def test_pagina_en_este_in_engleza_cu_hreflang():
    html = E.pagina_liga_en("England", "Premier League", "anglia-premier-league", "Premier League (Anglia)", meciuri=[M], cal={"n": 300, "bias_pp": -2.1, "calibrated": True}, zile=[])
    an = datetime.now().year
    assert f"<title>Premier League Predictions {an} | Match Probabilities</title>" in html and '<html lang="en">' in html
    assert '<h1 class="hero-title">Premier League Predictions</h1>' in html
    assert 'hreflang="ro" href="https://poseidonstats.com/predictii/anglia-premier-league.html"' in html
    assert 'hreflang="en" href="https://poseidonstats.com/en/predictions/england-premier-league.html"' in html
    assert "Arsenal" in html and "Over 2.5" in html and "frozen" in html.lower()
    for ro in ("Predicții", "meciuri", "Abonamente", "Când", "necalibrată", "ratate"):
        assert ro not in html, ro


def test_pagina_ro_trimite_la_en():
    html = G.pagina_liga("England", "Premier League", "anglia-premier-league", "Premier League (Anglia)", meciuri=[], cal=None, zile=[])
    assert 'hreflang="en" href="https://poseidonstats.com/en/predictions/england-premier-league.html"' in html
    assert 'hreflang="ro" href="https://poseidonstats.com/predictii/anglia-premier-league.html"' in html


def test_hub_en():
    html = E.pagina_hub_en([{"slug": "anglia-premier-league", "nume": "Premier League (Anglia)", "n": 3, "cal_ok": True}])
    assert "<title>Football Predictions by League" in html and 'href="england-premier-league.html"' in html and "Predicții" not in html
