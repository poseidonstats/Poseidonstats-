"""6 oct 2026: garda din gen_static_daily refuză să rescrie un bloc dintre markeri care conține elemente negenerate."""
import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_static_daily as S


def test_garda_refuza_sectiune_straina():
    vechi = '<!-- PROOF_STATIC_START -->\n<section id="exemplu-pro">x</section>\n<section id="dovada">y</section>\n<!-- PROOF_STATIC_END -->'
    nou = '<!-- PROOF_STATIC_START -->\n<section id="dovada">z</section>\n<!-- PROOF_STATIC_END -->'
    with pytest.raises(SystemExit):
        S._fara_sectiuni_straine(vechi, nou, "PROOF_STATIC")


def test_garda_refuza_marker_interior():
    vechi = '<!-- DAILY_STATIC_START -->\n<!-- PRO_SAMPLE_CARD_START -->a<!-- PRO_SAMPLE_CARD_END -->\n<section id="repere-azi">y</section>\n<!-- DAILY_STATIC_END -->'
    nou = '<!-- DAILY_STATIC_START -->\n<section id="repere-azi">z</section>\n<!-- DAILY_STATIC_END -->'
    with pytest.raises(SystemExit):
        S._fara_sectiuni_straine(vechi, nou, "DAILY_STATIC")


def test_garda_lasa_blocul_curat():
    vechi = '<!-- DAILY_STATIC_START -->\n<section id="repere-azi">y</section>\n<!-- DAILY_STATIC_END -->'
    nou = '<!-- DAILY_STATIC_START -->\n<section id="repere-azi">z</section>\n<!-- DAILY_STATIC_END -->'
    S._fara_sectiuni_straine(vechi, nou, "DAILY_STATIC")
