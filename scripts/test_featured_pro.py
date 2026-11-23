from datetime import date
from featured_pro import on_day, priority


def match(fid, home, away, country="England", league="Premier League"):
    return dict(fixture_id=fid, home=home, away=away, country=country, league=league)


def test_showcase_excludes_minor_competitions_and_homonyms():
    assert priority(match(1, "A", "B", "Uganda"), "") is None
    assert priority(match(2, "A", "B", "Spain", "Tercera División"), "") is None


def test_derby_wins_and_the_order_of_the_feed_cannot_break_a_tie():
    derby = match(10, "Liverpool", "Manchester United")
    famous = match(11, "Chelsea", "Arsenal")
    ordinary = match(2, "Brentford", "Everton")
    assert priority(derby, "") > priority(famous, "") > priority(ordinary, "")
    assert priority(ordinary, "") > priority(dict(ordinary, fixture_id=3), "")


def test_international_final_and_bucharest_calendar():
    final = match(8, "A", "B", "World", "UEFA Champions League")
    assert priority(final, "Final") > priority(match(1, "Liverpool", "Manchester United"), "")
    assert on_day({"match_date": "2026-11-22T22:05:00Z"}, date(2026, 11, 23))
    assert not on_day({"match_date": "2026-11-22T21:00:00Z"}, date(2026, 11, 23))
