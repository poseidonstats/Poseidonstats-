"""Teste — arhiva publică a analizelor Pro (20 oct 2026): rândul „fără pick curajos” nu e pick; numele cu diacritice străine se evaluează."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_pro_arhiva as G  # noqa: E402


def test_randul_fara_pick_curajos_nu_e_pick():
    assert G.pick_din_linie("💎 **Curajos:** fără pick curajos azi — nicio piață de cotă nu trece de 55 %.") is None
    p = G.pick_din_linie("💎 **Curajos:** Peste 2,5 goluri — **58%**. E pick de cotă, cu risc asumat. Motiv.")
    assert p["tip"] == "Curajos" and p["piata"] == "Peste 2,5 goluri" and p["prob"] == 58


def test_victoria_unei_echipe_cu_diacritice_straine_se_evalueaza():
    assert G.evalueaza_pick("Victorie Rīgas FS", 2, 0, "Rīgas FS", "Tukums") is True
    assert G.evalueaza_pick("Victorie Rīgas FS", 1, 1, "Rīgas FS", "Tukums") is False
    assert G.evalueaza_pick("Victorie Diósgyőri VTK", 0, 1, "Diósgyőri VTK", "Paks") is False
    assert G._norm("Rīgas FS · Diósgyőri · Știința").split() == ["rigas", "fs", "diosgyori", "stiinta"]
