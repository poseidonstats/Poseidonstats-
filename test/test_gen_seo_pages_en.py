"""1 oct 2026 — paginile de ligă în ENGLEZĂ (întrebările 4-5 ChatGPT: clientul care plătește caută în engleză): /en/predictions/<slug>.html,
titlu pe intenția de căutare („Premier League Predictions 2026 | Match Probabilities”), hreflang în ambele sensuri, conținut editorial în engleză."""
import sys
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_seo_pages as G
import gen_seo_pages_en as E

M = {"match_date": "2099-01-05T15:00:00Z", "home_team": "Arsenal", "away_team": "Chelsea", "country": "England", "league": "Premier League", "calibrated": True,
     "prob_home": 0.45, "prob_draw": 0.25, "prob_away": 0.30, "prob_over_1_5": 0.78, "prob_over_2_5": 0.55, "prob_over_3_5": 0.30, "prob_btts": 0.56, "xg_home": 1.6, "xg_away": 1.2}
ENGLAND = ("England", "Premier League", "anglia-premier-league", "Premier League (Anglia)")


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


def _assert_hero_language_anchor(html, link):
    hero = html.split('class="hero-sub"', 1)[1].split('class="hero-free"', 1)[0]
    assert link in hero
    assert html.count(link) == 1


def test_paginile_ligii_au_link_de_limba_in_hero():
    liga = ("England", "Premier League", "anglia-premier-league", "Premier League (Anglia)")
    ro = G.pagina_liga(*liga, meciuri=[], cal=None, zile=[])
    en = E.pagina_liga_en(*liga, meciuri=[], cal=None, zile=[])
    _assert_hero_language_anchor(ro, '<a lang="en" hreflang="en" href="../en/predictions/england-premier-league.html">Read in English</a>')
    _assert_hero_language_anchor(en, '<a lang="ro" hreflang="ro" href="../../predictii/anglia-premier-league.html">Română</a>')
    assert 'Other leagues: <a href="index.html">all league pages</a>.' in en
    assert 'Această pagină există și în' not in en


def test_huburile_au_link_de_limba_in_hero():
    _assert_hero_language_anchor(G.pagina_hub([]), '<a lang="en" hreflang="en" href="../en/predictions/index.html">Read in English</a>')
    _assert_hero_language_anchor(E.pagina_hub_en([]), '<a lang="ro" hreflang="ro" href="../../predictii/index.html">Română</a>')


def test_scriptul_de_limba_este_versionat_pentru_pagini_pereche():
    liga = ("Russia", "Premier League", "rusia-premier-league", "Premier League (Rusia)")
    pagini_ro = [G.pagina_liga(*liga, meciuri=[], cal=None, zile=[]), G.pagina_hub([])]
    pagini_en = [E.pagina_liga_en(*liga, meciuri=[], cal=None, zile=[]), E.pagina_hub_en([])]
    for html in pagini_ro:
        assert '<script src="../assets/i18n-lite.js?release=20261120-seo-language" data-sus="../"></script>' in html
    for html in pagini_en:
        assert '<script src="../../assets/i18n-lite.js?release=20261120-seo-language" data-sus="../../"></script>' in html


def test_pagina_engleza_pastreaza_limba_la_abonament(tmp_path):
    meci_blocat = {**M, "locked": True}
    html = E.pagina_liga_en(*ENGLAND, meciuri=[meci_blocat], cal=None, zile=[], archive_dir=tmp_path)
    assert '<script src="../../assets/i18n-lite.js?release=20261123-markets-follow" data-sus="../../"></script>' in html
    assert html.count('href="../../index.html?lang=en#abonament"') == 4
    assert 'href="../../index.html#abonament"' not in html


def _write_archive(directory, day, *fixtures):
    html = G.pagina_zi({"date": day, "matches": fixtures})
    (directory / f"{day}.html").write_text(html, encoding="utf-8")


def _archived_fixture(*outcomes, country="England", home="Arsenal", away="Chelsea"):
    return {
        "country": country, "league": "Premier League", "home": home, "away": away,
        "ft_h": 2, "ft_a": 1,
        "picks": [{"market": market, "outcome": outcome, "prob": 75} for market, outcome in outcomes],
    }


def test_istoric_anglia_numara_selectii_rezolvate_in_interval(tmp_path):
    _write_archive(
        tmp_path, "2026-09-11",
        _archived_fixture(("Over 1.5", "WIN"), ("Under 2.5", "LOSS")),
        _archived_fixture(("Over 1.5", "WIN"), country="Russia"),
    )
    _write_archive(tmp_path, "2026-09-12", _archived_fixture(("Over 1.5", "WIN")))
    _write_archive(tmp_path, "2026-10-10", _archived_fixture(("Over 1.5", "PENDING")))
    _write_archive(tmp_path, "2026-10-12", _archived_fixture(("Over 1.5", "WIN")))
    html = E.pagina_liga_en(
        *ENGLAND, meciuri=[], cal=None, zile=[], archive_dir=tmp_path,
        as_of=datetime.fromisoformat("2026-10-11T08:00:00+00:00"),
    )

    assert "11 September 2026" in html and "12 September 2026" in html
    assert "<strong>3</strong> settled selections from <strong>2</strong> fixtures" in html
    assert '<td>Over 1.5</td><td>2</td><td class="num-win">2</td><td class="num-loss">0</td>' in html
    assert '<td>Under 2.5</td><td>1</td><td class="num-win">0</td><td class="num-loss">1</td>' in html


def test_istoric_anglia_cu_selectii_inca_nerezolvate(tmp_path, monkeypatch):
    _write_archive(tmp_path, "2026-11-22", _archived_fixture(
        ("Over 1.5", "PENDING"), home="Liverpool", away="Manchester United",
    ))
    monkeypatch.setattr(G, "SITE", tmp_path)
    editorial_dir = tmp_path / "analize"
    editorial_dir.mkdir()
    (editorial_dir / "2026-11-22.html").write_text("<p>Pro editorial archive</p>", encoding="utf-8")
    html = E.pagina_liga_en(
        *ENGLAND, meciuri=[], cal=None, zile=[], archive_dir=tmp_path,
        as_of=datetime.fromisoformat("2026-11-23T08:00:00+00:00"),
    )

    assert "No settled model selections" in html
    assert "22 November 2026" in html
    assert "Liverpool – Manchester United" in html
    assert 'href="../../predictii/arhiva/2026-11-22.html?lang=en"' in html
    assert 'href="../../analize/2026-11-22.html?lang=en">Pro editorial archive for this date' in html
    assert "#m1557473" not in html and "4–0" not in html
    assert 'class="cumulat-table"' not in html
    assert "since 2 June" not in html


def test_program_anglia_filtreaza_tara_si_ordoneaza_dupa_instant(tmp_path):
    def fixture(home, match_date, **extra):
        return {**M, "home_team": home, "match_date": match_date, **extra}

    html = E.pagina_liga_en(
        *ENGLAND,
        meciuri=[
            fixture("Ultimul", "2026-08-29T12:00:00+00:00"),
            fixture("Premier League extern", "2026-08-22T13:00:00Z", country="Wales"),
            fixture("Deja inceput", "2026-08-22T12:00:00Z"),
            fixture("Al doilea", "2026-08-22T15:00:00+01:00"),
            fixture("Primul", "2026-08-22T15:30:00+02:00"),
            fixture("Peste limita", "2026-08-29T12:01:00Z"),
        ],
        cal=None, zile=[], archive_dir=tmp_path,
        as_of=datetime.fromisoformat("2026-08-22T12:00:00+00:00"),
    )

    assert "<strong>3 matches</strong>" in html
    assert html.index("Primul") < html.index("Al doilea") < html.index("Ultimul")
    assert '<time datetime="2026-08-22T13:30:00+00:00">' in html
    assert '>14:30</span>' in html
    assert "UK local time" in html
    for absent in ("Premier League extern", "Deja inceput", "Peste limita"):
        assert absent not in html
