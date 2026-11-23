"""Select the daily public Pro report by football prominence. Scores, odds and probability are excluded."""

from datetime import datetime
from zoneinfo import ZoneInfo
import unicodedata

# The order applies only after the importance of the fixture and its clubs.
COMPETITIONS = [
    ("World", "World Cup"),
    ("World", "Euro Championship"),
    ("World", "UEFA Champions League"),
    ("England", "Premier League"),
    ("Spain", "La Liga"),
    ("Italy", "Serie A"),
    ("Germany", "Bundesliga"),
    ("France", "Ligue 1"),
    ("Romania", "Liga I"),
    ("Romania", "Superliga"),
    ("World", "UEFA Europa League"),
]
CLUBS = {
    "real madrid",
    "barcelona",
    "bayern munich",
    "bayern munchen",
    "borussia dortmund",
    "manchester city",
    "manchester united",
    "liverpool",
    "arsenal",
    "chelsea",
    "paris saint germain",
    "juventus",
    "inter",
    "ac milan",
    "atletico madrid",
}
RIVALRIES = {
    frozenset(pair)
    for pair in [
        ("real madrid", "barcelona"),
        ("real madrid", "atletico madrid"),
        ("liverpool", "manchester united"),
        ("manchester united", "manchester city"),
        ("arsenal", "tottenham"),
        ("inter", "ac milan"),
        ("inter", "juventus"),
        ("bayern munich", "borussia dortmund"),
        ("paris saint germain", "marseille"),
        ("fcsb", "dinamo bucuresti"),
        ("fcsb", "rapid"),
        ("dinamo bucuresti", "rapid"),
        ("cfr 1907 cluj", "universitatea cluj"),
    ]
}
ALIASES = {
    "bayern munchen": "bayern munich",
    "fc barcelona": "barcelona",
    "internazionale": "inter",
    "milan": "ac milan",
    "fc rapid bucuresti": "rapid",
    "rapid bucuresti": "rapid",
    "tottenham hotspur": "tottenham",
}
ROUNDS = {
    "final": 5,
    "semi-finals": 4,
    "semi-final": 4,
    "quarter-finals": 3,
    "quarter-final": 3,
    "round of 16": 2,
    "8th finals": 2,
}


def canonical(s):
    name = " ".join(
        "".join(
            ch
            for ch in unicodedata.normalize("NFKD", s.casefold())
            if not unicodedata.combining(ch)
        )
        .replace("-", " ")
        .split()
    )
    return ALIASES.get(name, name)


def priority(match, round_name):
    competition = (match["country"], match["league"])
    if competition not in COMPETITIONS:
        return None
    teams = {canonical(match["home"]), canonical(match["away"])}
    phase = (
        ROUNDS.get((round_name or "").strip().casefold(), 0)
        if competition[0] == "World"
        else 0
    )
    return (
        phase,
        int(frozenset(teams) in RIVALRIES),
        len(teams & CLUBS),
        -COMPETITIONS.index(competition),
        -int(match["fixture_id"]),
    )


def on_day(match, day):
    try:
        when = datetime.fromisoformat(match["match_date"].replace("Z", "+00:00"))
        return (
            when.tzinfo is not None
            and when.astimezone(ZoneInfo("Europe/Bucharest")).date() == day
        )
    except (KeyError, TypeError, ValueError, AttributeError):
        return False


def edition_for(day):
    """Select one documented pre-match report; other reports contribute only match identities."""
    import json
    import sqlite3
    from hashlib import sha256
    import gen_pro_sample as sample

    day_key = day.isoformat()
    data = {"date": day_key, "item": None, "altele": []}
    path = sample.ARHIVA / f"{day_key}.json"
    if not path.exists():
        return data
    raw = path.read_bytes()
    edition = json.loads(raw)
    flags = (
        "published_late",
        "recovery_kind",
        "recovery_of",
        "exclude_from_forward_test",
        "dry_run",
        "dryrun",
    )
    if edition.get("date") != day_key or any(edition.get(flag) for flag in flags):
        return data
    receipt = sample.PP.citeste_livrari(path)
    verified_archive = receipt.get("archive_sha256") == sha256(raw).hexdigest()
    items = edition.get("items") or []
    candidates = []
    with sqlite3.connect(sample.DB, uri=True) as db:
        for item in items:
            match = item["match"]
            if (
                not on_day(match, day)
                or (match["country"], match["league"]) not in COMPETITIONS
            ):
                continue
            if not all(
                (
                    item.get("analysis" if lang == "ro" else f"analysis_{lang}") or ""
                ).strip()
                for lang in sample.TOTAL_MARKET
            ):
                continue
            if not sample._principal(item, sample.parseaza(item["analysis"])["picks"]):
                continue
            if not verified_archive:
                raise ValueError("Lipsește confirmarea ediției originale.")
            if sample._site_delivery(item, receipt):
                row = db.execute(
                    "SELECT league_round FROM fixtures WHERE id=?",
                    (match["fixture_id"],),
                ).fetchone()
                candidates.append((priority(match, row[0] if row else ""), item))
    if candidates:
        _, selected = max(candidates, key=lambda candidate: candidate[0])
        data["item"] = selected
        fields = ("fixture_id", "home", "away", "country", "league", "date")
        data["altele"] = [
            {field: item["match"][field] for field in fields if field in item["match"]}
            for item in items
            if item["match"]["fixture_id"] != selected["match"]["fixture_id"]
        ]
    return data


if __name__ == "__main__":
    import argparse
    from datetime import date
    import json
    from pathlib import Path

    cli = argparse.ArgumentParser()
    cli.add_argument("--date", type=date.fromisoformat, required=True)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    payload = edition_for(args.date)
    args.output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(
        args.date,
        (payload["item"] or {})
        .get("match", {})
        .get("fixture_id", "fără mostră eligibilă"),
    )
