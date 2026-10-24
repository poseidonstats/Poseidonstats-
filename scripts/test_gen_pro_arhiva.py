"""Teste pentru evaluatorul pick-urilor din arhiva Pro (24 oct 2026, auditul Codex, constatarea GRAV „victorii false la pick-uri compuse”):
`evalueaza_pick` întorcea rezultatul primei condiții pe goluri și ignora restul (Diegem – Termien 5-2, „X2 + O2.5” → ✅; Entebbe – Lugazi 0-1,
„Entebbe câștigă și Sub 2.5” → ✅). Acum toate componentele recunoscute trebuie să iasă; o formulare pe care n-o înțelege întreagă e neevaluabilă.
Rulare: ~/football_predictor/.venv/bin/python3 -m pytest -q -p no:cacheprovider scripts/test_gen_pro_arhiva.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_pro_arhiva import evalueaza_pick  # noqa: E402


def ev(piata, gh, ga, home="Gazda FC", away="Oaspete FC", hth=None, hta=None):
    return evalueaza_pick(piata, gh, ga, home, away, hth, hta)


def test_pick_urile_simple_raman_la_fel():
    assert ev("Peste 1.5 goluri", 2, 0) is True and ev("Peste 2.5 goluri", 1, 1) is False
    assert ev("Sub 2.5 goluri", 1, 1) is True and ev("Sub 3.5", 2, 2) is False
    assert ev("GG", 1, 1) is True and ev("GG Nu", 2, 0) is True and ev("Ambele marchează", 2, 0) is False
    assert ev("1X Gazda FC", 1, 1) is True and ev("X2", 2, 1) is False and ev("12", 1, 1) is False
    assert ev("Victorie gazde (1)", 2, 1) is True and ev("Scor corect 2-1", 2, 1) is True
    assert ev("Peste 0.5 goluri la pauză", 0, 2, hth=0, hta=0) is False and ev("Peste 0.5 la pauză", 0, 2) is None


def test_pick_compus_cere_toate_componentele():
    # Diegem – Termien 5-2: X2 pierde, peste 2,5 iese → pick-ul compus NU a ieșit
    assert ev("X2 (Termien nu pierde) + O2.5", 5, 2, "Diegem", "Termien") is False
    assert ev("X2 (Termien nu pierde) + O2.5", 1, 3, "Diegem", "Termien") is True
    # Entebbe – Lugazi 0-1: Entebbe pierde, sub 2,5 iese → NU a ieșit
    assert ev("Entebbe câștigă și Sub 2.5", 0, 1, "Entebbe", "Lugazi") is False
    assert ev("Entebbe câștigă și Sub 2.5", 1, 0, "Entebbe", "Lugazi") is True
    assert ev("1X + Peste 1.5 goluri", 2, 0) is True and ev("1X + Peste 1.5 goluri", 1, 0) is False
    assert ev("GG + Peste 2.5", 2, 1) is True and ev("GG + Peste 2.5", 3, 0) is False


def test_formularile_ambigue_sunt_neevaluabile():
    # „primește sub 1,5” e o linie pe golurile primite, nu pe total: nu se judecă din total
    assert ev("Chester câștigă și primește sub 1.5", 0, 1, "Chester", "Morecambe") is None
    assert ev("Chester câștigă și primește sub 1.5", 2, 0, "Chester", "Morecambe") is None
    assert ev("Gazda marchează 2+ goluri", 2, 0) is None
    assert ev("Fără pick clar", 1, 0) is None
