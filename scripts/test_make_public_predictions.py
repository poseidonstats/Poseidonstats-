"""Teste pentru make_public_predictions.py — reducerea history.json (18 oct 2026).

Scurgerea găsită pe 18 oct: history.json publica selecțiile și procentele TUTUROR meciurilor
din azi și din următoarele 6 zile, inclusiv ale celor `locked` din predictions.json (2.740 de meciuri).
Regula aprobată de Andreea: selecția unui meci blocat devine publică abia după ce meciul s-a jucat
(WIN/LOSS); înainte de meci rămân vizibile doar cele gratuite. Track record-ul rezolvat nu se atinge.
"""
import copy

from make_public_predictions import reduce_history

HIST = {
    "generated_at": "2026-10-18T05:28:00Z",
    "note": "x",
    "cumulated_markets": [{"name": "Over 1.5", "n": 10, "wins": 8, "losses": 2, "hit_pct": 80.0, "wlo_pct": 49.0, "tier": "noise"}],
    "days": [
        {"date": "2026-10-17", "status": "resolved",
         "totals": {"picks": 2, "wins": 1, "losses": 1, "pending": 0},
         "matches": [{"fixture_id": 1, "time": "20:00", "home": "A", "away": "B", "picks": [
             {"market": "Over 1.5", "prob": 80, "outcome": "WIN"}, {"market": "BTTS Da", "prob": 66, "outcome": "LOSS"}]}]},
        {"date": "2026-10-18", "status": "in_progress",
         "totals": {"picks": 4, "wins": 1, "losses": 0, "pending": 3},
         "matches": [
             {"fixture_id": 2, "time": "13:00", "home": "C", "away": "D", "picks": [{"market": "Over 1.5", "prob": 86, "outcome": "WIN"}]},
             {"fixture_id": 3, "time": "16:00", "home": "E", "away": "F", "picks": [{"market": "Over 1.5", "prob": 84, "outcome": "PENDING"}]},
             {"fixture_id": 4, "time": "18:00", "home": "G", "away": "H", "picks": [
                 {"market": "Over 1.5", "prob": 79, "outcome": "PENDING"}, {"market": "Over 2.5", "prob": 66, "outcome": "PENDING"}]},
         ]},
        {"date": "2026-10-19", "status": "scheduled",
         "totals": {"picks": 1, "wins": 0, "losses": 0, "pending": 1},
         "matches": [{"fixture_id": 5, "time": "19:00", "home": "I", "away": "J", "picks": [{"market": "Over 2.5", "prob": 70, "outcome": "PENDING"}]}]},
    ],
}


def _hist():
    return copy.deepcopy(HIST)


def test_selectiile_pending_ale_meciurilor_blocate_dispar_iar_cele_gratuite_si_rezolvate_raman():
    out = reduce_history(_hist(), free_ids={3})
    azi = next(d for d in out["days"] if d["date"] == "2026-10-18")
    ids = [m["fixture_id"] for m in azi["matches"]]
    assert ids == [2, 3]                      # 2 = rezolvat (WIN), 3 = gratuit; 4 = blocat, doar PENDING → dispare
    assert azi["matches"][1]["picks"][0]["outcome"] == "PENDING"   # la gratuit rămâne și PENDING-ul
    ieri = next(d for d in out["days"] if d["date"] == "2026-10-17")
    assert ieri["matches"][0]["picks"] == HIST["days"][0]["matches"][0]["picks"]   # rezolvatele neatinse


def test_zilele_ramase_fara_meciuri_dispar_si_totalurile_se_recalculeaza():
    out = reduce_history(_hist(), free_ids=set())
    assert [d["date"] for d in out["days"]] == ["2026-10-17", "2026-10-18"]   # 19 oct avea doar PENDING blocat
    azi = next(d for d in out["days"] if d["date"] == "2026-10-18")
    assert azi["totals"] == {"picks": 1, "wins": 1, "losses": 0, "pending": 0, "locked_pending": 3}
    assert azi["status"] == "in_progress"


def test_antetul_si_cumulatul_raman_neatinse_si_reducerea_e_idempotenta():
    o1 = reduce_history(_hist(), free_ids={3})
    assert o1["generated_at"] == HIST["generated_at"]
    assert o1["cumulated_markets"] == HIST["cumulated_markets"]
    assert reduce_history(copy.deepcopy(o1), free_ids={3}) == o1


def test_un_meci_blocat_cu_o_selectie_rezolvata_si_una_pending_pastreaza_doar_rezolvata():
    h = _hist()
    h["days"][1]["matches"][2]["picks"][0]["outcome"] = "LOSS"
    out = reduce_history(h, free_ids=set())
    azi = next(d for d in out["days"] if d["date"] == "2026-10-18")
    m4 = next(m for m in azi["matches"] if m["fixture_id"] == 4)
    assert [p["outcome"] for p in m4["picks"]] == ["LOSS"]
    assert azi["totals"]["locked_pending"] == 2
