"""8 oct 2026: cu doar două ligi calibrate în bucket, „max 2 pe ligă” lăsa 4 gratuite în loc de 5 (site_check a alertat).
Fallback: când nu se umplu 5, a treia trecere ignoră plafonul pe ligă (prioritatea rămâne probabilitatea)."""
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import make_public_predictions as M


def _m(fid, liga, p, tara="Israel"):
    azi = datetime.now(timezone.utc) + timedelta(hours=6)
    return {"fixture_id": fid, "match_date": azi.strftime("%Y-%m-%dT%H:%M:%SZ"), "calibrated": True,
            "prob_over_1_5": p, "country": tara, "league": liga}


def test_fallback_umple_5_cand_plafonul_pe_liga_lasa_mai_putine():
    ms = [_m(1, "Liga Alef", 0.86), _m(2, "Liga Alef", 0.85), _m(3, "Liga Alef", 0.84), _m(4, "Liga Alef", 0.83),
          _m(5, "First League", 0.80, "Montenegro"), _m(6, "First League", 0.79, "Montenegro")]
    free = M.pick_free(ms)
    assert len(free) == 5
    assert {1, 2, 5, 6}.issubset(free) and 3 in free      # plafonul se relaxează în ordinea probabilității


def test_plafonul_pe_liga_ramane_cand_sunt_destule_ligi():
    ms = [_m(i, f"Liga {i % 4}", 0.86 - i * 0.01) for i in range(1, 9)]
    free = M.pick_free(ms)
    assert len(free) == 5
    from collections import Counter
    assert max(Counter(f"Israel/Liga {i % 4}" for i in free).values()) <= 2
