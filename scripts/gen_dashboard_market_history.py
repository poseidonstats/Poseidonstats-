#!/usr/bin/env python3
"""Publică un export restrâns pentru piețele din prima listă.

Predicțiile vin exclusiv din edițiile freemium publice, cu generare înainte de
start. Bilanțurile sunt agregate din dosarele înghețate înainte de meci. Scorurile
vin din baza canonică, cu backupul nocturn ca rezervă, doar pentru identități publice.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from contextlib import closing
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from sqlite3 import DatabaseError, Row, connect
from zoneinfo import ZoneInfo

from make_public_predictions import N_FREE, atomic_write

BUCHAREST = ZoneInfo("Europe/Bucharest")
UTC = timezone.utc
DAYS = 7
IDENTITY = ("fixture_id", "match_date", "home_team", "away_team", "country", "league")
SCORES = ("ft_h", "ft_a", "ht_h", "ht_a")
MARKETS = ("btts", "over_2_5", "ht_over_0_5")
PROBABILITIES = ("prob_home", "prob_draw", "prob_away", *(f"prob_{market}" for market in MARKETS))
SCORE_SQL = """
    SELECT f.*, h.name AS home_name, a.name AS away_name, l.name AS league, l.country AS country
    FROM fixtures f
    JOIN teams h ON h.id = f.home_team_id
    JOIN teams a ON a.id = f.away_team_id
    JOIN leagues l ON l.id = f.league_id
    WHERE f.id = ?
"""


def timestamp(value: object, *, legacy_utc: bool = False) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value)
    except ValueError:
        return None
    if result.utcoffset() is None:
        return result.replace(tzinfo=UTC) if legacy_utc else None
    return result


def nonnegative_int(value: object) -> bool:
    return type(value) is int and value >= 0


def fixture_identity(row: dict) -> dict:
    return {name: row[name] for name in IDENTITY}


def fixture_matches(row: dict) -> dict:
    return {
        **fixture_identity(row),
        "free": True,
        **{key: value for key in PROBABILITIES
           if type(value := row.get(key)) in (int, float) and 0 <= value <= 1},
    }


def local_day(moment: datetime) -> date:
    return moment.astimezone(BUCHAREST).date()


def free_cohort(matches: list, marker: dict, public: dict) -> list:
    """Require the published counts to describe one unambiguous free cohort."""
    declared_free, declared_locked = marker.get("free"), marker.get("locked")
    if not nonnegative_int(declared_free) or not nonnegative_int(declared_locked):
        return []
    if declared_free > N_FREE or declared_free + declared_locked != len(matches):
        return []
    free = []
    for row in matches:
        if not isinstance(row, dict):
            return []
        is_free, is_locked = row.get("free", False), row.get("locked", False)
        if type(is_free) is not bool or type(is_locked) is not bool or is_free == is_locked:
            return []
        if is_free:
            fixture = row.get("fixture_id")
            if type(fixture) is not int or fixture not in public:
                return []
            free.append(row)
    return free if len(free) == declared_free else []


def public_identities(data: dict, day: date) -> tuple[dict, list]:
    generated = timestamp(data.get("generated_at"))
    matches = data.get("matches")
    marker = data.get("freemium")
    if not isinstance(marker, dict) or not generated or local_day(generated) != day:
        return {}, []
    if not isinstance(matches, list):
        return {}, []
    ids = Counter(row.get("fixture_id") for row in matches
                  if isinstance(row, dict) and type(row.get("fixture_id")) is int)
    public = {}
    for row in matches:
        if not isinstance(row, dict):
            continue
        fixture = row.get("fixture_id")
        kickoff = timestamp(row.get("match_date"))
        if (
            type(fixture) is not int or fixture <= 0 or ids[fixture] != 1
            or not kickoff or local_day(kickoff) != day
            or not (row.get("free") is True or row.get("locked") is True)
            or not all(isinstance(row.get(key), str) and row[key].strip() for key in IDENTITY[2:])
        ):
            continue
        public[fixture] = fixture_identity(row)
    free = [fixture_matches(row) for row in free_cohort(matches, marker, public)
            if generated < timestamp(row["match_date"])]
    return public, free


def sample_counts(matches: object, *, at_home: bool, cutoff: datetime, fixture: int) -> dict:
    if not isinstance(matches, list):
        return {}
    ids = Counter(row.get("id") for row in matches
                  if isinstance(row, dict) and type(row.get("id")) is int)
    samples: dict[str, list[tuple[str, bool]]] = {market: [] for market in MARKETS}
    for row in matches:
        if not isinstance(row, dict) or row.get("home") is not at_home:
            continue
        historical_id = row.get("id")
        kickoff = timestamp(row.get("date"))
        scored, conceded = row.get("scored"), row.get("conceded")
        if (
            type(historical_id) is not int or historical_id <= 0 or historical_id == fixture
            or ids[historical_id] != 1 or not kickoff or kickoff >= cutoff
            or not nonnegative_int(scored) or not nonnegative_int(conceded)
        ):
            continue
        day = local_day(kickoff).isoformat()
        samples["btts"].append((day, scored > 0 and conceded > 0))
        samples["over_2_5"].append((day, scored + conceded >= 3))
        half_scored, half_conceded = row.get("halfScored"), row.get("halfConceded")
        if (nonnegative_int(half_scored) and nonnegative_int(half_conceded)
                and half_scored <= scored and half_conceded <= conceded):
            samples["ht_over_0_5"].append((day, half_scored + half_conceded >= 1))
    return {
        market: {"hits": sum(hit for _, hit in rows), "n": len(rows),
                 "from": min(day for day, _ in rows), "to": max(day for day, _ in rows)}
        for market, rows in samples.items() if rows
    }


def summarize_dossier(archive: dict, match: dict, day: date) -> dict | None:
    if archive.get("date") != day.isoformat() or not isinstance(archive.get("dossiers"), dict):
        return None
    fixture = match["fixture_id"]
    dossier = archive["dossiers"].get(str(fixture))
    if not isinstance(dossier, dict):
        return None
    kickoff = timestamp(match["match_date"])
    cutoff = timestamp(dossier.get("as_of", archive.get("as_of")))
    teams = dossier.get("teams")
    if (
        dossier.get("fixture_id") != fixture or dossier.get("league") != match["league"]
        or dossier.get("history_context") != "same_competition_season"
        or not kickoff or kickoff != timestamp(dossier.get("match_date"))
        or not cutoff or cutoff >= kickoff
        or not isinstance(teams, list) or len(teams) != 2 or not all(isinstance(team, dict) for team in teams)
        or teams[0].get("name") != match["home_team"] or teams[0].get("home") is not True
        or teams[1].get("name") != match["away_team"] or teams[1].get("home") is not False
    ):
        return None
    return {
        "home": sample_counts(teams[0].get("matches"), at_home=True, cutoff=cutoff, fixture=fixture),
        "away": sample_counts(teams[1].get("matches"), at_home=False, cutoff=cutoff, fixture=fixture),
    }


def verified_result(match: dict, row: dict, as_of: datetime, scorer) -> dict | None:
    kickoff = timestamp(match["match_date"])
    updated = timestamp(row.get("updated_at"), legacy_utc=True)
    if (
        row.get("id") != match["fixture_id"]
        or not kickoff or kickoff != timestamp(row.get("date"), legacy_utc=True)
        or not updated or not kickoff < updated <= as_of
        or any(row.get(source) != match[key] for key, source in (
            ("home_team", "home_name"), ("away_team", "away_name"), ("country", "country"), ("league", "league")
        ))
    ):
        return None
    ft = scorer(row)
    if ft is None:
        return None
    ht = (row.get("halftime_home"), row.get("halftime_away"))
    if any(nonnegative_int(half) and half > final for half, final in zip(ht, ft)):
        return None
    if not all(nonnegative_int(half) for half in ht):
        ht = (None, None)
    return {**fixture_identity(match), "ft_h": ft[0], "ft_a": ft[1], "ht_h": ht[0], "ht_a": ht[1]}


def git_output(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True)


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path.name}: se aștepta un obiect JSON")
    return value


def published_inputs(repo: Path, first: date, today: date, ref: str, as_of: datetime | None = None) -> dict:
    current = read_json(repo / "data/predictions.json")
    published = {}
    refs = git_output(repo, "log", "--first-parent", "-24", "--format=%H", ref, "--",
                      "data/predictions.json").splitlines()
    for commit in refs:
        previous = json.loads(git_output(repo, "show", f"{commit}:data/predictions.json"))
        moment = timestamp(previous.get("generated_at"))
        if not moment or (as_of is not None and moment > as_of) or not isinstance(previous.get("freemium"), dict):
            continue
        day = local_day(moment)
        if first <= day <= today:
            published.setdefault(day, previous)
        if len(published) == (today - first).days + 1:
            break
    moment = timestamp(current.get("generated_at"))
    if (moment and local_day(moment) == today and (as_of is None or moment <= as_of)
            and isinstance(current.get("freemium"), dict)):
        published[today] = current
    return published


def prepare_export(repo: Path, archive: Path, as_of: datetime, today: date, ref: str) -> tuple[dict, dict]:
    first = today - timedelta(days=DAYS - 1)
    output = {"date": today.isoformat(), "days": {}}
    candidates = {}
    for day, data in sorted(published_inputs(repo, first, today, ref, as_of).items(), reverse=True):
        public, matches = public_identities(data, day)
        if not public:
            continue
        item = {"matches": matches, "stats": {}, "results": {}}
        dossier_path = archive / f"basic_dossiers_{day}.json"
        if matches and dossier_path.is_file():
            dossier_data = read_json(dossier_path)
            for match in matches:
                samples = summarize_dossier(dossier_data, match, day)
                if samples and any(samples.values()):
                    item["stats"][str(match["fixture_id"])] = samples
        key = day.isoformat()
        if day < today:
            candidates[key] = {str(fixture): match for fixture, match in public.items()}
        output["days"][key] = item
    return output, candidates


def closed_snapshot(path: Path) -> tuple[int, int, int]:
    wal = path.with_name(path.name + "-wal")
    journal = path.with_name(path.name + "-journal")
    if any(sidecar.exists() and sidecar.stat().st_size for sidecar in (wal, journal)):
        raise ValueError("Este necesar un backup SQLite închis, fără WAL sau jurnal activ")
    source = path.stat()
    return source.st_ino, source.st_size, source.st_mtime_ns


def read_scores(path: Path, candidates: dict, as_of: datetime, scorer, *, closed_backup: bool = False) -> tuple[dict, dict]:
    """Read results in one deferred transaction. The canonical database may have a live WAL."""
    source = path.resolve()
    signature = closed_snapshot(source) if closed_backup else None
    cutoff = as_of
    if signature:
        cutoff = datetime.fromtimestamp(signature[2] / 1e9, UTC)
        if cutoff > as_of:
            raise ValueError("Backup-ul de rezultate este ulterior limitei as-of")
    uri = f"{source.as_uri()}?mode=ro" + ("&immutable=1" if closed_backup else "")
    scores, newer = {}, {}
    with closing(connect(uri, uri=True, timeout=2)) as db:
        db.row_factory = Row
        db.execute("PRAGMA query_only=ON")
        db.execute("BEGIN")
        for day, matches in candidates.items():
            for key, match in matches.items():
                row = db.execute(SCORE_SQL, (match["fixture_id"],)).fetchone()
                if row is None:
                    continue
                updated = timestamp(row["updated_at"], legacy_utc=True)
                if not closed_backup and updated and updated > cutoff:
                    newer.setdefault(day, {})[key] = match
                    continue
                result = verified_result(match, dict(row), cutoff, scorer)
                if result is not None:
                    scores.setdefault(day, {})[key] = result
    if signature and signature != closed_snapshot(source):
        raise RuntimeError("Backup-ul de rezultate s-a schimbat în timpul citirii")
    return scores, newer


def resolve_scores(source: Path, backup: Path, candidates: dict, as_of: datetime, scorer, *,
                   historical: bool = False) -> tuple[dict, bool]:
    if not candidates:
        return {}, False
    try:
        scores, newer = read_scores(source, candidates, as_of, scorer)
    except (DatabaseError, OSError) as exc:
        print(f"[dashboard-markets] Baza canonică indisponibilă ({exc.__class__.__name__}); citesc backupul.")
        return read_scores(backup, candidates, as_of, scorer, closed_backup=True)[0], True

    if historical and newer and backup.is_file():
        try:
            older, _ = read_scores(backup, newer, as_of, scorer, closed_backup=True)
        except (DatabaseError, OSError, RuntimeError, ValueError):
            print("[dashboard-markets] Backupul istoric nu poate confirma versiunile anterioare.")
        else:
            for day, results in older.items():
                scores.setdefault(day, {}).update(results)
    return scores, False


def require_no_score_loss(previous: dict, candidates: dict, scores: dict) -> None:
    """Keep the original export when a backup would lose a score already confirmed."""
    for day, matches in candidates.items():
        old_results = previous.get("days", {}).get(day, {}).get("results", {})
        for key, old in old_results.items():
            match = matches.get(key)
            if match is None or any(old.get(field) != match[field] for field in IDENTITY):
                continue
            result = scores.get(day, {}).get(key, {})
            if any(nonnegative_int(old.get(field)) and result.get(field) != old[field] for field in SCORES):
                raise RuntimeError(f"Backupul ar pierde sau schimba un scor deja confirmat: {day}/{key}")


def main() -> None:
    home = Path.home()
    now = datetime.now(UTC)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", type=date.fromisoformat, default=local_day(now))
    parser.add_argument("--as-of", help="Limită ISO 8601 cu fus orar pentru rezultatele disponibile")
    parser.add_argument("--archive", type=Path,
                        default=home / ".local/share/poseidon-members/basic-dosare-private")
    parser.add_argument("--database", type=Path, default=home / "football_predictor/football.db")
    parser.add_argument("--snapshot", type=Path)
    parser.add_argument("--published-ref", default="origin/main")
    parser.add_argument("--output", type=Path, help="Destinație separată pentru o generare de verificare")
    args = parser.parse_args()
    end_of_day = datetime.combine(args.date, time.max, tzinfo=BUCHAREST)
    as_of = timestamp(args.as_of) if args.as_of else min(now, end_of_day)
    if args.date > local_day(now) or not as_of or as_of > min(now, end_of_day):
        parser.error("Data și limita as-of trebuie să fie valide și să nu depășească ziua cerută sau prezentul.")
    historical = args.as_of is not None or args.date < local_day(now)
    repo = Path(__file__).resolve().parents[1]
    snapshot = args.snapshot or (home / "backups" / f"football_{args.date - timedelta(days=1):%Y%m%d}"
                                 / "v2_db/football.db")
    default_output = repo / "data/dashboard-market-history.json"
    output = args.output or default_output
    if historical and output.resolve() == default_output.resolve():
        parser.error("Pentru o reluare istorică, folosește --output cu o destinație separată de exportul curent.")
    sys.path.insert(0, str(home / "football_predictor/scripts/poseidon"))
    from scor90 import scor_90

    payload, candidates = prepare_export(repo, args.archive, as_of, args.date, args.published_ref)
    scores, used_backup = resolve_scores(args.database, snapshot, candidates, as_of, scor_90, historical=historical)
    if used_backup and not historical and output.is_file():
        require_no_score_loss(read_json(output), candidates, scores)
    for day, results in scores.items():
        payload["days"][day]["results"] = results
    atomic_write(output,
                 json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
    print(f"[dashboard-markets] {len(payload['days'])} zile în export")


if __name__ == "__main__":
    main()
