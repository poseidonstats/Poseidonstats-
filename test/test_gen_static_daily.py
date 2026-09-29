"""Test (înaintea codului) pentru eticheta tabelului „ce s-a adeverit": N = selecțiile peste pragul de afișare, nu toate predicțiile (confuzia ChatGPT, 29 sept)."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_static_daily as S


def test_tabelul_dovada_arata_pragul_si_eticheta_corecta(tmp_path, monkeypatch):
    h = tmp_path / "history.json"
    h.write_text(json.dumps({"cumulated_markets": [{"name": "Over 1.5", "n": 18397, "wins": 1, "losses": 1, "hit_pct": 82.7, "wlo_pct": 82.1, "tier": "STRONG ROBUST"},
                                                    {"name": "HT Over 1.5", "n": 207, "wins": 1, "losses": 1, "hit_pct": 58.0, "wlo_pct": 51.2, "tier": "DROP"}]}))
    monkeypatch.setattr(S, "HIST", h); out = S.build_proof_section()
    assert "Selecții peste prag, rezolvate" in out and "≥ 75 %" in out and "≥ 65 %" in out and "Predicții rezolvate" not in out and "toate predicțiile" in out
