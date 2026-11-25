import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import pytest

import prepare_daily_pro as pro


@pytest.fixture
def job(tmp_path):
    day = datetime.now(pro.RO).date().isoformat()
    stamp = day + "T05:20:00+02:00"
    data = tmp_path / "data"
    archive = data / "pro_analyses" / f"{day}.json"
    archive.parent.mkdir(parents=True)
    for name in ("predictions.json", "predictions_full.json"):
        (data / name).write_text(json.dumps({"generated_at": stamp}))
    return day, tmp_path, archive


def test_upload_requires_receipt_and_retry_reuses_original(job):
    day, root, archive = job
    calls = []

    def run(command, *, check):
        script = Path(command[1]).name
        calls.append(script)
        assert check and "--discord" not in command
        if script == "poseidon_pro_cron.py":
            assert command[2:] == ["--date", day, "--no-post"]
            if not archive.exists():
                rows = [{"provenance": {"prediction_id": "p1"}, "match": {"fixture_id": 123}}]
                archive.write_text(json.dumps({"date": day, "reteta": "fisa", "items": rows}))
        else:
            assert command[2:] == ["--zi", day, "--upload"]
            if calls.count(script) > 1:
                pro.proof.marcheaza_livrare(archive, [0], "site")

    with pytest.raises(ValueError, match="confirmarea"):
        pro.prepare(day, site=root, predictor=root, run=run)
    pro.prepare(day, site=root, predictor=root, run=run)
    receipt = archive.with_suffix(".delivery.json").read_bytes()
    pro.prepare(day, site=root, predictor=root, run=run)
    assert calls.count("traduce_analize.py") == 2
    assert receipt == archive.with_suffix(".delivery.json").read_bytes()


def test_empty_day_and_failed_generation_do_not_upload(job):
    day, root, _ = job
    commands = []
    pro.prepare(day, site=root, predictor=root, run=lambda cmd, **kw: commands.append(cmd))
    assert len(commands) == 1 and "--no-post" in commands[0]

    def fail(cmd, *, check):
        assert "--no-post" in cmd and check
        raise subprocess.CalledProcessError(1, cmd)

    with pytest.raises(subprocess.CalledProcessError):
        pro.prepare(day, site=root, predictor=root, run=fail)


@pytest.mark.parametrize("different_build", [False, True])
def test_rejects_wrong_day_or_mismatched_export(job, different_build):
    day, root, _ = job
    if different_build:
        (root / "data/predictions.json").write_text('{"generated_at": "invalid"}')
    else:
        day = (datetime.now(pro.RO).date() - timedelta(days=1)).isoformat()
    with pytest.raises(ValueError, match="ediție"):
        pro.prepare(day, site=root, predictor=root, run=lambda *a, **kw: pytest.fail("ran publisher"))
