"""Public dashboard settlement and venue samples."""
import json
import sys
from datetime import date, datetime
from pathlib import Path
from sqlite3 import DatabaseError, connect

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import gen_dashboard_market_history as generator  # noqa: E402
from gen_dashboard_market_history import (  # noqa: E402
    closed_snapshot,
    fixture_matches,
    public_identities,
    published_inputs,
    summarize_dossier,
    timestamp,
    verified_result,
)


FIXTURE = {
    "fixture_id": 99,
    "match_date": "2026-11-22T21:30:00Z",
    "home_team": "Gazdă",
    "away_team": "Oaspete",
    "country": "Romania",
    "league": "Liga I",
    "free": True,
    "prob_btts": 0.6,
    "prob_btts_raw": 0.61,
    "private_payload": "secret",
}
DAY = date(2026, 11, 22)
CUTOFF = "2026-11-23T01:00:00+02:00"
FT = {
    "id": 99,
    "date": FIXTURE["match_date"],
    "home_name": "Gazdă",
    "away_name": "Oaspete",
    "country": "Romania",
    "league": "Liga I",
    "updated_at": "2026-11-22T23:45:00Z",
    "status_short": "FT",
    "fulltime_home": 2,
    "fulltime_away": 0,
    "halftime_home": None,
    "halftime_away": None,
}


def test_only_unique_freemium_prestart_forecasts_are_exported():
    locked = {**FIXTURE, "fixture_id": 100, "free": False, "locked": True}
    late = {**FIXTURE, "fixture_id": 101, "match_date": "2026-11-22T01:00:00Z"}
    data = {"matches": [FIXTURE, locked, late], "generated_at": "2026-11-22T03:00:00Z",
            "freemium": {"free": 2, "locked": 1}}
    public, free = public_identities(data, DAY)
    assert set(public) == {99, 100, 101}
    assert free == [fixture_matches(FIXTURE)]
    assert "private_payload" not in free[0] and "prob_btts_raw" not in free[0]
    assert set(public_identities({**data, "matches": [FIXTURE, FIXTURE]}, DAY)[0]) == set()
    assert public_identities({**data, "freemium": False}, DAY) == ({}, [])
    assert public_identities(data, date(2026, 11, 23)) == ({}, [])


@pytest.mark.parametrize(("marker", "matches"), [
    ({}, [FIXTURE]),
    ({"free": 1, "locked": 1}, [FIXTURE]),
    ({"free": 2, "locked": 0}, [FIXTURE]),
    ({"free": True, "locked": 0}, [FIXTURE]),
    ({"free": "1", "locked": 0}, [FIXTURE]),
    ({"free": 6, "locked": 0}, [{**FIXTURE, "fixture_id": 99 + i} for i in range(6)]),
    ({"free": 1, "locked": 0}, [{**FIXTURE, "locked": True}]),
    ({"free": 2, "locked": 0}, [FIXTURE, FIXTURE, {**FIXTURE, "fixture_id": 100}]),
])
def test_suspicious_freemium_cohort_carries_public_identities_but_no_forecasts(marker, matches):
    data = {"matches": matches, "generated_at": "2026-11-22T03:00:00Z", "freemium": marker}
    public, free = public_identities(data, DAY)
    assert public
    assert all("prob_btts" not in row for row in public.values())
    assert free == []


def test_dossier_samples_are_venue_specific_with_separate_ht_denominator():
    def row(fid, when, home=True, ft=(1, 0), ht=(0, 0)):
        return dict(id=fid, date=when, home=home, scored=ft[0], conceded=ft[1],
                    halfScored=ht[0], halfConceded=ht[1])

    old, recent = "2026-11-04T20:00:00+02:00", "2026-11-11T20:00:00+02:00"
    archive = {
        "date": DAY.isoformat(),
        "as_of": "2026-11-21T23:00:00+02:00",
        "dossiers": {"99": {
            "fixture_id": 99, "match_date": FIXTURE["match_date"],
            "league": "Liga I", "history_context": "same_competition_season",
            "teams": [
                {"home": True, "name": "Gazdă", "matches": [
                    row(2, recent, ft=(2, 1), ht=(1, 0)),
                    row(1, old, ht=(None, None)),
                    row(3, recent, home=False, ft=(2, 2), ht=(1, 0)),
                    row(4, FIXTURE["match_date"], ft=(2, 2), ht=(1, 0)),
                ]},
                {"home": False, "name": "Oaspete", "matches": [
                    row(5, recent, home=False, ft=(1, 1)),
                    row(6, old),
                ]},
            ],
        }},
    }
    value = summarize_dossier(archive, FIXTURE, DAY)
    assert value["home"]["btts"] == {"hits": 1, "n": 2, "from": "2026-11-04", "to": "2026-11-11"}
    assert value["home"]["over_2_5"]["hits"] == 1
    assert value["home"]["ht_over_0_5"] == {"hits": 1, "n": 1, "from": "2026-11-11", "to": "2026-11-11"}
    assert value["away"]["btts"]["hits"] == 1
    assert value["away"]["ht_over_0_5"]["hits"] == 0
    assert summarize_dossier(archive, {**FIXTURE, "home_team": "Vecini"}, DAY) is None


def strict_fixture_score(row):
    # Delegate score semantics to production in the real export. This test
    # supplies a deterministic validator to isolate identity and cutoff gates.
    return (row["fulltime_home"], row["fulltime_away"]) if row["status_short"] == "FT" else None


def test_results_require_exact_public_identity_final_and_a_known_snapshot():
    before_kickoff = datetime.fromisoformat("2026-11-22T21:00:00+00:00")
    after_update = timestamp("2026-11-23T00:00:00Z")
    assert verified_result(FIXTURE, FT, before_kickoff, strict_fixture_score) is None
    assert verified_result(FIXTURE, FT, timestamp(CUTOFF), strict_fixture_score) is None
    assert verified_result(FIXTURE, {**FT, "home_name": "Altă gazdă"}, after_update, strict_fixture_score) is None
    assert verified_result(FIXTURE, {**FT, "status_short": "NS"}, after_update, strict_fixture_score) is None
    result = verified_result(FIXTURE, FT, after_update, strict_fixture_score)
    assert result["ft_h"] == 2 and result["ft_a"] == 0
    assert result["ht_h"] is None and result["ht_a"] is None
    assert "prob_btts" not in result and "free" not in result
    assert verified_result(FIXTURE, {**FT, "halftime_home": 3, "halftime_away": 0}, after_update, strict_fixture_score) is None


def test_previous_day_uses_the_published_ref_even_during_rollover(tmp_path, monkeypatch):
    previous = {"generated_at": "2026-11-22T03:00:00Z", "freemium": {"free": 1, "locked": 0},
                "matches": [FIXTURE]}
    current = {**previous, "matches": [{**FIXTURE, "prob_btts": 0.9}]}
    (tmp_path / "data").mkdir()
    (tmp_path / "data/predictions.json").write_text(json.dumps(current), encoding="utf-8")

    def fake_git_output(repo, action, *args):
        assert repo == tmp_path
        if action == "log":
            assert "origin/main" in args
            return "published\n"
        assert args == ("published:data/predictions.json",)
        return json.dumps(previous)

    monkeypatch.setattr(generator, "git_output", fake_git_output)
    assert published_inputs(tmp_path, DAY, date(2026, 11, 23), "origin/main") == {DAY: previous}


def test_active_sqlite_sidecar_is_rejected(tmp_path):
    db = tmp_path / "football.db"
    db.write_bytes(b"fixture")
    signature = closed_snapshot(db)
    wal = db.with_name("football.db-wal")
    wal.write_bytes(b"")
    assert closed_snapshot(db) == signature
    wal.write_bytes(b"transaction")
    with pytest.raises(ValueError, match="WAL"):
        closed_snapshot(db)


def score_source(path):
    with connect(path) as db:
        db.executescript("""
            CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE leagues (id INTEGER PRIMARY KEY, name TEXT, country TEXT);
            CREATE TABLE fixtures (
                id INTEGER PRIMARY KEY, date TEXT, updated_at TEXT, status_short TEXT,
                fulltime_home INTEGER, fulltime_away INTEGER, halftime_home INTEGER, halftime_away INTEGER,
                home_team_id INTEGER, away_team_id INTEGER, league_id INTEGER
            );
            INSERT INTO teams VALUES (1, 'Gazdă'), (2, 'Oaspete');
            INSERT INTO leagues VALUES (1, 'Liga I', 'Romania');
            INSERT INTO fixtures VALUES
                (99, '2026-11-22 21:30:00', '2026-11-23 03:00:10', 'FT', 0, 1, 0, 1, 1, 2, 1),
                (100, '2026-11-22 21:30:00', '2026-11-23 03:00:10', 'NS', NULL, NULL, NULL, NULL, 1, 2, 1);
        """)
    return path


def test_canonical_scores_are_consistent_read_only_and_respect_an_exact_cutoff(tmp_path):
    source = score_source(tmp_path / "canonical.db")
    matches = {DAY.isoformat(): {"99": FIXTURE, "100": {**FIXTURE, "fixture_id": 100}}}
    first = True
    with connect(source) as writer:
        writer.execute("PRAGMA journal_mode=WAL")

        def concurrent_update(row):
            nonlocal first
            if first:
                first = False
                writer.execute("UPDATE fixtures SET status_short='FT', fulltime_home=1, fulltime_away=0 WHERE id=100")
                writer.commit()
            return strict_fixture_score(row)

        early = timestamp("2026-11-23T03:00:09Z")
        late = timestamp("2026-11-23T03:00:10Z")
        assert generator.read_scores(source, matches, early, strict_fixture_score)[0] == {}
        scores, _ = generator.read_scores(source, matches, late, concurrent_update)
        assert set(scores[DAY.isoformat()]) == {"99"}
        assert [scores[DAY.isoformat()]["99"][key] for key in ("ft_h", "ft_a", "ht_h", "ht_a")] == [0, 1, 0, 1]
        assert set(generator.read_scores(source, matches, late, strict_fixture_score)[0][DAY.isoformat()]) == {"99", "100"}


def test_backup_must_not_erase_a_previously_confirmed_score(tmp_path):
    previous_score = verified_result(FIXTURE, FT, timestamp("2026-11-23T03:15:00Z"), strict_fixture_score)
    previous = {"days": {DAY.isoformat(): {"results": {"99": previous_score}}}}
    identities = {DAY.isoformat(): {"99": fixture_matches(FIXTURE)}}
    with pytest.raises(RuntimeError, match="scor.*confirmat"):
        generator.require_no_score_loss(previous, identities, {})
    old_backup = {DAY.isoformat(): {"99": {**previous_score, "ft_h": 0}}}
    with pytest.raises(RuntimeError, match="scor.*confirmat"):
        generator.require_no_score_loss(previous, identities, old_backup)
    generator.require_no_score_loss(previous, identities, {DAY.isoformat(): {"99": previous_score}})
    generator.require_no_score_loss(previous, {}, {})


def test_canonical_failure_uses_backup_and_never_treats_a_readable_pending_row_as_final(tmp_path, monkeypatch):
    source, backup = tmp_path / "canonical.db", tmp_path / "backup.db"
    cutoff = timestamp("2026-11-23T03:15:00Z")
    candidates = {DAY.isoformat(): {"99": FIXTURE}}
    score = verified_result(FIXTURE, FT, cutoff, strict_fixture_score)
    calls = []

    def fake_read(path, matches, as_of, scorer, *, closed_backup=False):
        calls.append((path, closed_backup))
        if path == source and len(calls) == 1:
            raise DatabaseError("busy")
        return ({DAY.isoformat(): {"99": score}} if closed_backup else {}), {}

    monkeypatch.setattr(generator, "read_scores", fake_read)
    rows, degraded = generator.resolve_scores(source, backup, candidates, cutoff, strict_fixture_score)
    assert degraded and rows[DAY.isoformat()]["99"] == score
    assert calls == [(source, False), (backup, True)]
    assert generator.resolve_scores(source, backup, candidates, cutoff, strict_fixture_score) == ({}, False)
    assert calls[-1] == (source, False)


def test_historical_replay_cannot_replace_the_default_export(monkeypatch, capsys):
    yesterday = generator.local_day(generator.datetime.now(generator.UTC)) - generator.timedelta(days=1)
    monkeypatch.setattr(generator.sys, "argv", ["generator", "--date", yesterday.isoformat()])
    with pytest.raises(SystemExit) as exc:
        generator.main()
    assert exc.value.code == 2
    assert "--output" in capsys.readouterr().err
