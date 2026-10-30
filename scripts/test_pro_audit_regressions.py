"""Audit 30 oct: cohorte prospective și decontare la 90′."""

import json
import sqlite3
from copy import deepcopy
import gen_pro_arhiva as G
import gen_pro_sample as S

TEXT = "🎯 **Picks**\n🔒 **Bază:** **Peste 2.5 goluri — 70%.**\n👁️ x"


def test_archive_unknown_or_explicitly_excluded_never_enters_prospective_cohort():
    item = {
        "match": {"fixture_id": 1, "home": "A", "away": "B"},
        "analysis": TEXT,
        "exclude_from_forward_test": True,
    }
    days = [
        {
            "zi": "2099-01-01",
            "generat": "2099-01-01T10:00:00",
            "items": [item, deepcopy(item)],
        }
    ]
    totals, _ = G.bilant(days, {1: {"gh": 2, "ga": 1}})
    assert totals["Bază"]["n"] == 0


def test_result_readers_use_90_minutes_and_quarantine_ambiguous_et(
    tmp_path, monkeypatch
):
    db = tmp_path / "f.sqlite"
    con = sqlite3.connect(db)
    con.execute(
        "CREATE TABLE fixtures(id INTEGER PRIMARY KEY,status_short TEXT,goals_home INT,goals_away INT,fulltime_home INT,fulltime_away INT,extratime_home INT,extratime_away INT,halftime_home INT,halftime_away INT)"
    )
    con.executemany(
        "INSERT INTO fixtures VALUES(?,?,?,?,?,?,?,?,?,?)",
        [
            (1, "AET", 2, 1, 1, 1, 1, 0, 0, 0),
            (2, "AET", 2, 1, None, None, None, None, 0, 0),
            (3, "PEN", 1, 1, 1, 1, 0, 0, 0, 0),
            (4, "FT", 1, 0, 1, 0, None, None, 0, 0),
            (5, "FT", 1, None, 1, None, None, None, 0, 0),
            (6, "AET", 2, 0, 4, 0, 0, 2, 0, 0),
        ],
    )
    con.commit()
    con.close()
    uri = f"file:{db}?mode=ro"
    monkeypatch.setattr(G, "DB", uri)
    monkeypatch.setattr(S, "DB", uri)
    a = G.rezultate([1, 2, 3, 4, 5, 6])
    b = S.rezultate([1, 2, 3, 4, 5, 6])
    assert {k: (v["gh"], v["ga"]) for k, v in a.items()} == {
        1: (1, 1),
        3: (1, 1),
        4: (1, 0),
    }
    assert b == a  # sample păstrează acum și perechea HT validată, fără a schimba FT
    assert G.evalueaza_pick("Peste 2.5", a[1]["gh"], a[1]["ga"], "A", "B") is False


def test_prospective_uses_earliest_original_once_independent_of_order_or_outcome(
    tmp_path, monkeypatch
):
    import provenienta_pro as P

    monkeypatch.setattr(P, "utc_now", lambda: "2099-10-31T00:00:00Z")

    def record(name, gen, analysis):
        item = {
            "match": {
                "fixture_id": 7,
                "home": "A",
                "away": "B",
                "match_date": "2099-10-30T12:00:00Z",
            },
            "analysis": analysis,
        }
        item = P.cu_provenienta(
            item,
            {"match": item["match"]},
            "a" * 64,
            captured_at="2099-10-30T07:00:00Z",
            generated_at=gen,
        )
        path = tmp_path / name
        path.write_text(json.dumps({"items": [item]}))
        P.marcheaza_livrare(path, [0], "site", at="2099-10-30T09:00:00Z")
        return {**item, "_deliveries": P.citeste_livrari(path)}

    first = record("first.json", "2099-10-30T08:00:00Z", TEXT)
    later = record(
        "later.json", "2099-10-30T08:01:00Z", TEXT.replace("Peste 2.5", "Sub 2.5")
    )
    days = [{"zi": "2099-10-30", "generat": "", "items": [later, first]}]
    totals, _ = G.bilant(days, {7: {"gh": 1, "ga": 1}})
    assert totals["Bază"]["n"] == 1 and totals["Bază"]["k"] == 0
    days[0]["items"].reverse()
    assert G.bilant(days, {7: {"gh": 1, "ga": 1}})[0] == totals
    assert G.bilant(days, {7: {"gh": 2, "ga": 1}})[0]["Bază"]["k"] == 1


def test_no_provenance_is_an_explicit_empty_cohort_not_a_historical_hit_claim():
    item = {"match": {"fixture_id": 1, "home": "A", "away": "B"}, "analysis": TEXT}
    days = [{"zi": "2026-10-29", "generat": "", "items": [item]}]
    totals, perday = G.bilant(days, {1: {"gh": 2, "ga": 1}})
    html = G.html_index(days, totals, perday, "2026-10-29")
    assert "arhiva.bilant.faraeligibile" in html
    assert "Eligibile prospectiv: 0" in html
