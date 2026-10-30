from datetime import datetime, timezone
import json
import pytest
import gen_static_daily as G


@pytest.mark.parametrize(
    "fixed,expected",
    [
        ((2026, 10, 29, 21, 30), "2026-10-29"),
        ((2026, 7, 10, 20, 30), "2026-07-10"),
        ((2026, 7, 10, 21, 30), "2026-07-11"),
    ],
)
def test_today_uses_bucharest_at_winter_and_summer_midnight(
    monkeypatch, fixed, expected
):
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(*fixed, tzinfo=timezone.utc).astimezone(tz)

    monkeypatch.setattr(G, "datetime", Clock)
    assert G.bucharest_today().date().isoformat() == expected


def test_static_metrics_preserve_qualified_cohort_in_all_six_languages(
    tmp_path, monkeypatch
):
    audit = {
        "n_rezolvate": 3,
        "de_la": "2026-07-20",
        "pana_la": "2026-10-29",
        "piete": [
            {"cheie": k, "brier": 0.2, "log_loss": 0.6, "ece": 1.2}
            for k in ["over_1_5", "over_2_5", "btts"]
        ],
        "vs_piata": {
            "over_2_5": {
                "n": 2,
                "brier_model": 0.2,
                "brier_piata": 0.19,
                "informatie": {"castig_ll": -0.001},
            }
        },
    }
    p = tmp_path / "a.json"
    p.write_text(json.dumps(audit))
    d = tmp_path / "i.json"
    d.write_text(json.dumps({lang: {} for lang in ["ro", "en", "es", "it", "fr", "id"]}))
    monkeypatch.setattr(G, "AUDIT", p)
    monkeypatch.setattr(G, "I18N", d)
    G._metrici_paragraf()
    for value in json.loads(d.read_text()).values():
        assert "2026-07-20" in value["proof.metrici"]
        assert "calibration_available" in value["proof.metrici"]
