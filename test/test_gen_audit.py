"""Teste (înaintea codului) pentru gen_audit: auditul public al jurnalului forward (Brier, log loss, ECE, intervale, vs piață)."""
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_audit as G


def _rows():
    rows = []
    for i in range(400):
        p = 0.55 + (i % 40) / 100                     # 0,55 … 0,94
        y = 1 if (i * 7919) % 100 < int(p * 100) else 0  # cam calibrat
        rows.append({"status": "RESOLVED", "prob_over_2_5": f"{p:.3f}", "outcome_over_2_5": str(y), "prob_over_1_5": f"{min(p+0.2, 0.99):.3f}", "outcome_over_1_5": "1",
                     "prob_home": f"{p:.3f}", "outcome_1x2": "1" if y else "X", "mkt_p_o25": f"{p+0.01:.3f}", "match_date": "2026-09-01"})
    return rows


def test_metrici_pe_o_piata():
    m = G.metrici([(0.9, 1), (0.9, 1), (0.1, 0), (0.1, 0)])
    assert m["n"] == 4 and m["rata"] == 0.5 and math.isclose(m["brier"], 0.01) and math.isclose(m["bss"], (1 - 0.01 / 0.25) * 100)
    assert math.isclose(m["log_loss"], -math.log(0.9)) and math.isclose(m["ece"], 10.0)


def test_intervale_de_10pp_cu_prag_minim():
    b = G.intervale([(0.62, 1), (0.64, 0), (0.91, 1)], minim=2)
    assert b == [{"interval": "60–70 %", "n": 2, "spus": 63.0, "iesit": 50.0, "wlo": G.wlo(1, 2) * 100, "dif": -13.0}]


def test_audit_din_jurnal_are_toate_pietele_si_piata(tmp_path):
    a = G.audit(_rows())
    assert {p["cheie"] for p in a["piete"]} >= {"over_2_5", "over_1_5", "home"}
    o25 = next(p for p in a["piete"] if p["cheie"] == "over_2_5")
    assert o25["n"] == 400 and 0 < o25["brier"] < 0.25 and o25["intervale"] and all(b["n"] >= 100 for b in o25["intervale"])
    assert a["vs_piata"]["over_2_5"]["n"] == 400 and "bss_model" in a["vs_piata"]["over_2_5"] and "bss_piata" in a["vs_piata"]["over_2_5"]
    assert a["n_rezolvate"] == 400 and a["generat_la"]


def test_html_static_si_injectare_idempotenta():
    a = G.audit(_rows()); h = G.html_audit(a)
    assert "Brier" in h and "log loss" in h and "ECE" in h and "piaț" in h and "<script" not in h and "over_2_5" not in h and "Peste 2,5" in h
    pagina = '<section id="forward-section">\n  x\n  </section>\n\n  <section>\n  y\n  </section>'
    p1 = G.injecteaza(pagina, h); assert G.START in p1 and p1.index(G.START) > p1.index('id="forward-section"') and p1.count("Brier") >= 1
    p2 = G.injecteaza(p1, h.replace("Brier", "BRIER2")); assert "BRIER2" in p2 and p2.count(G.START) == 1 and "Brier</th>" not in p2.split(G.START)[0]


def test_platt_se_aplica_peste_brut_si_se_raporteaza_ambele():
    rows = _rows(); pl = {"over_2_5": {"a": 0.5, "b": 0.0}}
    a = G.audit(rows, pl); o = next(p for p in a["piete"] if p["cheie"] == "over_2_5")
    assert o["calibrat"] is True and a["calibrare"] == "platt" and "bss_brut" in o and o["bss"] != o["bss_brut"]
    assert math.isclose(G.aplica_platt(0.8, {"a": 1.0, "b": 0.0}), 0.8) and G.aplica_platt(0.9, {"a": 0.5, "b": 0.0}) < 0.9 and G.aplica_platt(0.5, None) == 0.5
    b = G.audit(rows); assert b["calibrare"] == "brut" and next(p for p in b["piete"] if p["cheie"] == "over_2_5")["calibrat"] is False


def test_intervalul_de_zile_ignora_datele_din_viitor():
    rows = _rows(); rows[0]["match_date"] = "2099-01-01 00:00:00"
    a = G.audit(rows); assert a["pana_la"] < "2099-01-01"
