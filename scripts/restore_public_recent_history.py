#!/usr/bin/env python3
"""Verify already-published free selections against existing FT90/HT results.

The original selection and displayed probability come from the day-of Git
edition, never from a later calibration or from the private predictions file.
The row-by-row recent journal is separate from the existing cumulative audit.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import date, datetime, time, timedelta
from pathlib import Path

from gen_dashboard_market_history import (
    BUCHAREST, DAYS as SCORE_DAYS, SCORES, git_output, local_day, nonnegative_int, public_identities,
    read_json, timestamp,
)
from make_public_predictions import atomic_write

DAYS = 10  # Same retrospective horizon as the existing history builder.
MARKET_RULES = {
    "1 (Home)": lambda h, a: h > a,
    "X (Draw)": lambda h, a: h == a,
    "2 (Away)": lambda h, a: h < a,
    "1X": lambda h, a: h >= a,
    "X2": lambda h, a: h <= a,
    "12": lambda h, a: h != a,
    "BTTS Da": lambda h, a: h > 0 and a > 0,
    "BTTS Nu": lambda h, a: h == 0 or a == 0,
    "Over 1.5": lambda h, a: h + a >= 2,
    "Over 2.5": lambda h, a: h + a >= 3,
    "Over 3.5": lambda h, a: h + a >= 4,
    "Under 2.5": lambda h, a: h + a <= 2,
    "Under 3.5": lambda h, a: h + a <= 3,
    "HT Over 0.5": lambda h, a: h + a >= 1,
    "HT Over 1.5": lambda h, a: h + a >= 2,
}
IDENTITY = (("fixture_id", "fixture_id"), ("home", "home_team"), ("away", "away_team"),
            ("country", "country"), ("league", "league"))


def same_match(match: dict, reference: dict) -> bool:
    return all(match.get(left) == reference.get(right) for left, right in IDENTITY)


def original_rows(history: dict, predictions: dict, commit: str | None, edition_time: datetime) -> list:
    generated = timestamp(history.get("generated_at"))
    day = local_day(edition_time)
    if not generated or not generated <= edition_time or local_day(generated) != day:
        return []
    if generated != timestamp(predictions.get("generated_at")):
        return []
    _, free = public_identities(predictions, day)
    by_id = {m["fixture_id"]: m for m in free}
    matches = [m for d in history.get("days", []) if d.get("date") == day.isoformat() for m in d.get("matches", [])]
    counts = Counter(m.get("fixture_id") for m in matches)
    rows = []
    for match in matches:
        fixture = match.get("fixture_id")
        source = by_id.get(fixture)
        if counts[fixture] != 1 or not source or not same_match(match, source):
            continue
        kickoff = timestamp(source["match_date"])
        if not edition_time < kickoff or match.get("time") != kickoff.astimezone(BUCHAREST).strftime("%H:%M"):
            continue
        pending = [p for p in match.get("picks", []) if p.get("outcome") == "PENDING"]
        markets = Counter(p.get("market") for p in pending)
        picks = [{"market": p["market"], "prob": p["prob"], "outcome": "PENDING"} for p in pending
                 if p.get("market") in MARKET_RULES and markets[p["market"]] == 1
                 and nonnegative_int(p.get("prob")) and p["prob"] <= 100]
        if not picks:
            continue
        row = {k: match[k] for k in ("fixture_id", "time", "country", "league", "home", "away")}
        row.update({"calibrated_lg": match.get("calibrated_lg") is True,
                    "snapshot": match.get("snapshot"), "picks": picks, **dict.fromkeys(SCORES)})
        if commit is not None:
            row["publication"] = {"commit": commit, "generated_at": history["generated_at"],
                                  "edition_time": edition_time.isoformat(), "match_date": source["match_date"]}
        rows.append(row)
    return rows


def original_editions(repo: Path, today: date, ref: str) -> dict:
    first = today - timedelta(days=DAYS)
    cutoff = datetime.combine(first, time.min, tzinfo=BUCHAREST).isoformat()
    log = git_output(repo, "log", "--first-parent", f"--since={cutoff}", "--format=%H%x09%cI",
                     ref, "--", "data/history.json")
    dated = {}
    for line in reversed(log.splitlines()):
        commit, committed = line.split("\t", 1)
        edition_time = timestamp(committed)
        day = local_day(edition_time)
        if day in dated or not first <= day < today:
            continue
        history = json.loads(git_output(repo, "show", f"{commit}:data/history.json"))
        predictions = json.loads(git_output(repo, "show", f"{commit}:data/predictions.json"))
        rows = original_rows(history, predictions, commit, edition_time)
        if rows:
            dated[day] = rows
    return dated


def settle(match: dict, score: dict) -> dict | None:
    ft = tuple(score.get(k) for k in SCORES[:2])
    ht = tuple(score.get(k) for k in SCORES[2:])
    have_half = all(nonnegative_int(x) for x in ht)
    if (not all(nonnegative_int(x) for x in ft)
            or (not have_half and ht != (None, None))
            or (have_half and any(h > f for h, f in zip(ht, ft)))):
        return None
    picks = []
    for pick in match["picks"]:
        market = pick["market"]
        if market.startswith("HT ") and not have_half:
            continue
        actual = ht if market.startswith("HT ") else ft
        outcome = "WIN" if MARKET_RULES[market](*actual) else "LOSS"
        picks.append({**pick, "outcome": outcome})
    if not picks:
        return None
    return {**match, **dict(zip(SCORES, (*ft, *ht))), "picks": picks}


def restore_history(history: dict, originals: dict, verified: dict, previous: dict, pending: list = ()) -> dict:
    today = local_day(timestamp(history["generated_at"]))
    score_date = date.fromisoformat(verified["date"])
    results = verified.get("days")
    if score_date > today or not isinstance(results, dict):
        raise ValueError("Exportul scorurilor este ulterior ediției curente sau are o structură invalidă.")
    first_scored = score_date - timedelta(days=SCORE_DAYS - 1)
    # Only reuse a prior result outside the score feed's dated window.
    # If verification in the active window now rejects a result, do not resurrect it.
    carry = {}
    if previous.get("recent_journal", {}).get("schema") == 1:
        carry = {(d["date"], m["fixture_id"]): m for d in previous.get("days", []) for m in d.get("matches", [])}
    days = []
    for day, rows in sorted(originals.items(), reverse=True):
        if not today - timedelta(days=DAYS) <= day < today:
            continue
        key = day.isoformat()
        scored = []
        for match in rows:
            fixture = match["fixture_id"]
            source = results.get(key, {}).get("results", {}).get(str(fixture))
            if source is not None:
                proven_kickoff = timestamp(match["publication"]["match_date"])
                if not same_match(match, source) or timestamp(source.get("match_date")) != proven_kickoff:
                    continue
                row = settle(match, source)
            elif (day < first_scored or day >= score_date) and (old := carry.get((key, fixture))) and old.get("publication") == match["publication"]:
                row = settle(match, old)
                if row != old:
                    row = None
            else:
                row = None
            if row:
                scored.append(row)
        if scored:
            days.append(make_day(key, "resolved", scored))
    dates = [d["date"] for d in days]
    if pending:
        today_key = today.isoformat()
        today_info = next((d for d in history.get("days", []) if d["date"] == today_key), {})
        hidden = today_info.get("totals", {}).get("locked_pending", 0)
        days.insert(0, make_day(today_key, "in_progress", pending, hidden))
    return {**history, "days": days, "recent_journal": {
        "schema": 1, "from": min(dates, default=None), "to": max(dates, default=None),
    }}


def make_day(day: str, status: str, matches: list, hidden: int = 0) -> dict:
    counts = Counter(p["outcome"] for m in matches for p in m["picks"])
    return {"date": day, "status": status, "matches": matches, "totals": {
        "picks": sum(counts.values()), "wins": counts["WIN"], "losses": counts["LOSS"],
        "pending": counts["PENDING"], "locked_pending": hidden,
    }}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published-ref", default="origin/main")
    parser.add_argument("--data-dir", type=Path, help="Copie izolată a exporturilor publice pentru verificare.")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    data = args.data_dir or repo / "data"
    path = data / "history.json"
    history = read_json(path)
    generated = timestamp(history.get("generated_at"))
    if not generated:
        raise ValueError("Ediția curentă nu are timestamp de generare.")
    previous = json.loads(git_output(repo, "show", f"{args.published_ref}:data/history.json"))
    verified = read_json(data / "dashboard-market-history.json")
    pending = original_rows(history, read_json(data / "predictions.json"), None, generated)
    restored = restore_history(history, original_editions(repo, local_day(generated), args.published_ref),
                               verified, previous, pending)
    atomic_write(path, json.dumps(restored, ensure_ascii=False, indent=1) + "\n")
    print(f"[istoric-public] {sum(d['status'] == 'resolved' for d in restored['days'])} zile decontate din ediții publice.")


if __name__ == "__main__":
    main()
