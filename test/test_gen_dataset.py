"""Teste (înaintea codului) pentru gen_dataset: datasetul public al jurnalului forward — doar meciuri rezolvate, coloane neutre (fără nume de case), fișiere pe luni."""
import csv, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_dataset as D


def _rows():
    base = {"freeze_ts": "2026-06-02T04:15:00+00:00", "league": "L", "home_team": "A", "away_team": "B", "prob_over_2_5": "0.6", "outcome_over_2_5": "1", "sb_p_o25": "0.55", "dayof_sb_p_o25": "", "mkt_p_o25": ""}
    return [dict(base, fixture_id="1", match_date="2026-06-02 18:00:00", status="RESOLVED"), dict(base, fixture_id="2", match_date="2026-09-03 18:00:00", status="RESOLVED"),
            dict(base, fixture_id="3", match_date="2026-09-30 18:00:00", status="PENDING")]


def test_randuri_publice_doar_rezolvate_si_coloane_neutre():
    R = D.randuri_publice(_rows(), {1: {"over_2_5": 0.58, "home": 0.4, "ore": 2.0}})
    assert [r["fixture_id"] for r in R] == ["1", "2"]
    for r in R:
        assert not any(k.startswith("sb_") or "_sb_" in k for k in r) and "mkt_ro_p_o25" in r
    assert R[0]["close_p_over_2_5"] == "0.58" and R[0]["close_p_home"] == "0.4" and R[0]["close_hours_before_ko"] == "2.0" and R[1]["close_p_over_2_5"] == ""
    assert set(D.COLOANE) >= {"close_p_over_2_5", "close_hours_before_ko", "mkt_ro_p_o25"} and all(list(r.keys()) == D.COLOANE for r in R)


def test_scrie_pe_luni_si_index(tmp_path):
    R = D.randuri_publice(_rows(), {}); idx = D.scrie(R, tmp_path)
    assert sorted(p.name for p in tmp_path.glob("*.csv")) == ["jurnal_2026-06.csv", "jurnal_2026-09.csv"]
    got = list(csv.DictReader(open(tmp_path / "jurnal_2026-09.csv", newline="", encoding="utf-8"))); assert len(got) == 1 and got[0]["fixture_id"] == "2"
    j = json.loads((tmp_path / "index.json").read_text()); assert j["n_total"] == 2 and j["fisiere"][0]["fisier"] == "jurnal_2026-06.csv" and j["fisiere"][0]["n"] == 1 and j["coloane"] == D.COLOANE
    assert idx == j


def test_html_bloc_si_injectare_dupa_audit():
    j = {"generat_la": "2026-09-29 09:00", "n_total": 2, "fisiere": [{"fisier": "jurnal_2026-09.csv", "n": 2, "luna": "2026-09"}], "coloane": D.COLOANE}
    h = D.html_dataset(j)
    assert "Date deschise" in h and 'href="data/dataset/jurnal_2026-09.csv"' in h and "<script" not in h
    assert all(c in h for c in D.COLOANE) and not any(s in h for s in ("Superbet", "Betfair", "Pinnacle", "API-Football"))
    pagina = "<!-- AUDIT_STATIC_START -->\n  <section>a</section>\n  <!-- AUDIT_STATIC_END -->\n\n  <section>\n  b\n  </section>"
    p1 = D.injecteaza(pagina, h); assert p1.index(D.START) > p1.index("AUDIT_STATIC_END") and p1.index(D.START) < p1.index("<section>\n  b")
    p2 = D.injecteaza(p1, h.replace("Date deschise", "DATE2")); assert "DATE2" in p2 and p2.count(D.START) == 1 and "Date deschise" not in p2


def test_meciul_cu_data_mutata_in_viitor_intra_in_luna_inghetarii(tmp_path):
    rows = _rows(); rows[1]["match_date"] = "2026-10-04 12:00:00"; rows[1]["freeze_ts"] = "2026-09-27T04:15:00+00:00"
    R = D.randuri_publice(rows, {}); idx = D.scrie(R, tmp_path, azi="2026-09-29")
    assert [f["fisier"] for f in idx["fisiere"]] == ["jurnal_2026-06.csv", "jurnal_2026-09.csv"] and not (tmp_path / "jurnal_2026-10.csv").exists()
    h = D.html_dataset(idx); assert "1 predicție<" in h and "1 predicții" not in h and "rezolvate, exact cum" in h
