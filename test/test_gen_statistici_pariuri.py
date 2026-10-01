"""1 oct 2026 — pagina „Statistici pariuri fotbal” (interogările reale din Search Console): tabelele din master, fără nume de case, RO + EN cu hreflang."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_statistici_pariuri as S


def _rows():
    rows = []
    for i in range(400):
        h, a = (2, 0) if i % 3 == 0 else (1, 1) if i % 3 == 1 else (0, 1)
        rows.append({"ko": f"2026-0{1 + i % 9}-10 18:00", "ft_h": h, "ft_a": a, "ht_h": 1 if i % 2 else 0, "ht_a": 0, "fem": i % 10 == 0, "tineret": False, "rez": False,
                     "close": {"1x2": {"o1": 1.5, "ox": 4.0, "o2": 6.0, "p1": 0.6, "px": 0.23, "p2": 0.17, "marja": 0.08}, "ft_o25": {"p": 0.5, "odd": 1.9, "marja": 0.07}, "gg": {"p": 0.55, "odd": 1.8, "marja": 0.06}}})
    return rows


def test_statistici_calculeaza_tabelele_si_separa_femininul():
    st = S.statistici(_rows())
    assert st["n_total"] == 400 and st["n_fem"] == 40 and st["n_seniori"] == 360
    c = {r["interval"]: r for r in st["cota"]}; assert "1,41–1,60" in c and c["1,41–1,60"]["n"] == 360 and 0 < c["1,41–1,60"]["adeverit"] < 100 and c["1,41–1,60"]["wlo"] < c["1,41–1,60"]["adeverit"]
    assert any(r["piata"] == "Peste 2,5 goluri" and r["n"] == 360 for r in st["goluri"]) and any(r["piata"] == "Peste 2,5 goluri" and r["n"] == 40 for r in st["goluri_fem"])
    assert st["marje"]["1X2"]["n"] == 400 and abs(st["marje"]["1X2"]["medie"] - 8.0) < 1e-9
    assert st["favorit"][0]["interval"] == "1,30–1,50" or any(r["interval"] == "1,50–1,80" for r in st["favorit"])


def test_html_ro_en_fara_nume_de_case_cu_hreflang():
    st = S.statistici(_rows()); ro, en = S.html_ro(st), S.html_en(st)
    for html in (ro, en):
        for nume in ("Superbet", "superbet", "Betfair", "bet365", "Unibet", "Fortuna"):
            assert nume not in html
        assert "<script" in html and "gc.zgo.at" in html and "legal-banner" in html
    assert "<title>Statistici pariuri fotbal" in ro and 'hreflang="en" href="https://poseidonstats.com/en/betting-odds-statistics.html"' in ro
    assert "<title>Betting Odds Statistics" in en and 'hreflang="ro" href="https://poseidonstats.com/statistici-pariuri.html"' in en and '<html lang="en">' in en
    assert "Predicții" not in en and "1,41–1,60" in ro and "1.41–1.60" in en
