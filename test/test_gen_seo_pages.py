"""1 oct 2026 — titlurile paginilor de ligă prind intenția de căutare: „Predicții <ligă> <an> | Probabilități și meciuri”, țara doar unde liga e ambiguă."""
import re
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
    assert '<script src="../assets/country-label.js?v=20261118e"></script>' in html
    assert r'Premier League (<span data-country-label=\"England\">Anglia</span>)' in html
    assert "data-i18n-vars-en='{\"liga\": \"Premier League (England)\"}'" in html
    assert "data-i18n-vars-en='{\"liga\": \"Premier League\"}'>Predicții Premier League</h1>" in html


def test_sample_and_bias_expose_raw_values_for_localization():
    html = G.profil_calibrare({"n": 194, "bias_pp": 3.9, "calibrated": True}, "Test",
                              nume_i18n="Test", vars_en="")
    assert '<span data-match-count="194">194 de meciuri</span>' in html
    assert '<span data-decimal="3.9">3.9</span>' in html


def test_pagina_zi_are_titlu_pe_rezultate_si_echipele_in_descriere():
    zi = {"date": "2026-09-29", "totals": {"wins": 3, "losses": 1}, "matches": [
        {"home": "Czech Republic", "away": "England", "league": "UEFA Nations League", "country": "World", "ft_h": 0, "ft_a": 2, "time": "21:45", "picks": [{"market": "Over 1.5", "prob": 83, "outcome": "WIN"}]},
        {"home": "Spain", "away": "Croatia", "league": "UEFA Nations League", "country": "World", "ft_h": 4, "ft_a": 1, "time": "21:45", "picks": [{"market": "1 (Home)", "prob": 72, "outcome": "WIN"}]}]}
    html = G.pagina_zi(zi)
    assert "<title>Rezultate și predicții verificate 29 septembrie 2026" in html
    assert 'name="description" content="' in html and "Czech Republic – England 0-2" in html.split('name="description" content="')[1].split('"')[0]
    assert "4 predicții rezolvate" in html or "4 predicții" in html


def test_rularea_zilnica_indexeaza_zilele_pastrate_si_analizele_noi(tmp_path, monkeypatch):
    site = tmp_path
    out = site / "predictii"
    arhiva = out / "arhiva"
    arhiva.mkdir(parents=True)
    (site / "analize").mkdir()
    (site / "analize" / "2026-11-17.html").touch()
    (arhiva / "2026-08-19.html").write_text("Predicțiile înghețate din august.")
    (arhiva / "2026-10-05.html").touch()
    (arhiva / "README.html").touch()
    (arhiva / "2026-13-90.html").touch()
    monkeypatch.setattr(G, "SITE", site)
    monkeypatch.setattr(G, "OUT", out)
    monkeypatch.setattr(G, "ARH", arhiva)
    monkeypatch.setattr(G, "SITEMAP", site / "sitemap.xml")
    monkeypatch.setattr(G, "LEAGUES", [])
    monkeypatch.setattr(G, "scrie_legaturi_index", lambda _: None)
    monkeypatch.setattr(G, "azi", lambda: datetime(2026, 11, 18, tzinfo=G.TZ))
    import gen_seo_pages_en as EN
    monkeypatch.setattr(EN, "OUT_EN", site / "en" / "predictions")
    data = {
        "predictions.json": {"matches": []},
        "history.json": {"days": [{
            "date": "2026-11-18",
            "matches": [{"home": "Arsenal", "away": "Chelsea"}],
        }]},
    }
    monkeypatch.setattr(G, "citeste", data.get)

    assert G.main() == 0
    index = (arhiva / "index.html").read_text()
    assert re.findall(r'href="(\d{4}-\d{2}-\d{2})\.html"', index) == [
        "2026-11-18", "2026-10-05", "2026-08-19",
    ]
    assert re.findall(r'data-month="([^"]+)"', index) == ["2026-11", "2026-10", "2026-08"]
    assert index.count('<details class="archive-month" open>') == 1
    assert "Predicțiile înghețate din august." == (arhiva / "2026-08-19.html").read_text()
    sitemap = (site / "sitemap.xml").read_text()
    links = re.findall(r"<loc>[^<]+?\.com(/[^<]*)</loc>", sitemap)
    assert len(links) == len(set(links))
    assert {
        "/privacy.html", "/analize/2026-11-17.html",
        "/predictii/arhiva/2026-08-19.html", "/predictii/arhiva/2026-11-18.html",
    } <= set(links)


def test_publicarea_zilnica_genereaza_pro_inaintea_sitemapului():
    script = Path(G.__file__).with_name("daily_publish.sh").read_text()
    assert script.index("scripts/gen_pro_arhiva.py") < script.index("scripts/gen_seo_pages.py")
