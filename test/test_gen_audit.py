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


# ---- 29 sept, OK Andreea: pantă/intercept, diagramă de fiabilitate, benchmark pe cota de închidere (fără nume de site) ----
import random


def _pairs_calibrate(n=3000, k=1.0, seed=1):
    """y ~ Bernoulli(p_adevarat); p raportat = sigmoid(logit(p_adevarat)/k): k=1 calibrat, k=0.5 supra-încrezător."""
    rnd = random.Random(seed); out = []
    for _ in range(n):
        pa = rnd.uniform(0.15, 0.9); y = 1 if rnd.random() < pa else 0
        z = math.log(pa / (1 - pa)) / k; out.append((1 / (1 + math.exp(-z)), y))
    return out


def test_panta_si_intercept_de_calibrare():
    a, b = G.panta_intercept(_pairs_calibrate(k=1.0)); assert abs(a - 1.0) < 0.15 and abs(b) < 0.15
    a2, _ = G.panta_intercept(_pairs_calibrate(k=0.5)); assert abs(a2 - 0.5) < 0.12


def test_diagrama_de_fiabilitate_svg():
    iv = G.intervale(_pairs_calibrate(n=2000)); s = G.svg_fiabilitate(iv)
    assert s.startswith("<svg") and s.count("<circle") == len(iv) and "<line" in s and "<script" not in s and len(s) < 6000


def test_incarca_inchidere_din_mapare_si_master(tmp_path):
    m = tmp_path / "map.csv"; m.write_text("fixture_id,sb_event_id,kickoff_utc,scrape_ts_utc\n11,901,2026-08-01T10:00:00,2026-08-01T07:00:00\n12,902,2026-08-01T10:00:00,2026-08-01T07:00:00\n")
    ms = tmp_path / "master.jsonl"
    ms.write_text(json.dumps({"eid": 901, "ore_close": 2.5, "close": {"1x2": {"p1": 0.5, "px": 0.3, "p2": 0.2}, "ft_o25": {"p": 0.61}, "ht_o05": {"p": 0.7}}}) + "\n" + json.dumps({"eid": 999, "close": {"gg": {"p": 0.5}}}) + "\n")
    inc = G.incarca_inchidere(m, ms)
    assert inc[11]["home"] == 0.5 and inc[11]["away"] == 0.2 and inc[11]["over_2_5"] == 0.61 and inc[11]["ht_over_0_5"] == 0.7 and inc[11]["ore"] == 2.5
    assert "btts" not in inc[11] and 12 not in inc and G.incarca_inchidere(tmp_path / "nu.csv", ms) == {}


def _rows_cu_inchidere(n=1200):
    rnd = random.Random(3); rows = []; inc = {}
    for i in range(n):
        pa = rnd.uniform(0.2, 0.9); y = 1 if rnd.random() < pa else 0; zi = "2026-07-01" if i < 800 else "2026-09-01"
        zm = 0.6 * math.log(pa / (1 - pa)) + rnd.gauss(0, 0.7); pmod = 1 / (1 + math.exp(-zm))      # modelul: atenuat + zgomot; piața: adevărul
        rows.append({"status": "RESOLVED", "fixture_id": str(i), "match_date": zi, "prob_over_2_5": f"{pmod:.3f}", "outcome_over_2_5": str(y),
                     "prob_home": f"{pa:.3f}", "outcome_1x2": "1" if y else "2"})
        inc[i] = {"over_2_5": pa, "home": pa, "ore": 3.0}
    return rows, inc


def test_vs_piata_pe_cota_de_inchidere_cu_test_de_informatie():
    rows, inc = _rows_cu_inchidere(); a = G.audit(rows, None, inc)
    v = a["vs_piata"]["over_2_5"]; assert v["n"] == 1200 and v["bss_piata"] > v["bss_model"] and v["sursa"] == "inchidere"
    t = v["informatie"]; assert t["n_test"] == 400 and t["ll_piata"] > 0 and "ll_piata_model" in t and abs(t["coef_model"]) < 0.35 and t["coef_piata"] > 0.6 and t["castig_ll"] < 0.01
    assert "home" in a["vs_piata"] and a["ore_inchidere_mediana"] == 3.0 and v["de_la"] == "2026-07-01" and v["pana_la"] == "2026-09-01"
    h = G.html_audit(a); assert "casă de pariuri" in h and "informație" in h.lower()


def test_html_fara_nume_de_site():
    rows, inc = _rows_cu_inchidere(); h = G.html_audit(G.audit(rows, None, inc))
    assert not any(s in h for s in ("Superbet", "superbet", "Betfair", "Pinnacle", "API-Football", "FBref", "Understat")) and "pantă" in h and "<svg" in h


# ---- reproductibil din fișierele PUBLICE: coloanele close_p_* țin loc de mapare + master ----
def test_benchmarkul_se_reface_din_coloanele_publice_close_p():
    rows, inc = _rows_cu_inchidere()
    pub = [dict(r, close_p_over_2_5=str(inc[int(r["fixture_id"])]["over_2_5"]), close_p_home=str(inc[int(r["fixture_id"])]["home"]), close_hours_before_ko="3.0") for r in rows]
    a1 = G.audit(rows, None, inc); a2 = G.audit(pub, None, None)
    v1, v2 = a1["vs_piata"]["over_2_5"], a2["vs_piata"]["over_2_5"]
    assert v2["n"] == v1["n"] and math.isclose(v2["bss_piata"], v1["bss_piata"]) and math.isclose(v2["informatie"]["ll_piata_model"], v1["informatie"]["ll_piata_model"]) and a2["ore_inchidere_mediana"] == 3.0
    assert "home" in a2["vs_piata"] and a2["vs_piata"]["home"]["sursa"] == "inchidere"


def test_citeste_dataset_public(tmp_path):
    for luna, fid in (("2026-06", "1"), ("2026-07", "2")):
        (tmp_path / f"jurnal_{luna}.csv").write_text(f"fixture_id,status,prob_over_2_5,outcome_over_2_5,match_date\n{fid},RESOLVED,0.6,1,{luna}-10 18:00:00\n")
    (tmp_path / "platt_calibration.json").write_text(json.dumps({"markets": {"over_2_5": {"a": 0.9, "b": 0.1}}}))
    rows, pl = G.citeste_public(tmp_path)
    assert [r["fixture_id"] for r in rows] == ["1", "2"] and pl == {"over_2_5": {"a": 0.9, "b": 0.1}}
