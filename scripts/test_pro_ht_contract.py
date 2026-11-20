"""Revizie SITE-PRO-03: aceeași țintă HT și același evaluator sample/arhivă."""

import sqlite3

import pytest

import gen_pro_arhiva as G
import gen_pro_sample as S

MARKET = "Peste 0.5 goluri la pauză"


def test_sample_does_not_judge_a_half_time_market_from_final_score():
    assert G.evalueaza_pick(MARKET, 2, 1, "A", "B", 0, 0) is False
    assert S.evalueaza(MARKET, 2, 1) is None


def test_archive_does_not_accept_fractional_half_time_score():
    assert G.evalueaza_pick(MARKET, 2, 1, "A", "B", 0.5, 0) is None


@pytest.mark.parametrize(
    "hth,hta",
    [(None, 0), (0, None), (0.5, 0), (-1, 0), (True, 0), (0, False), (3, 0), (0, 2)],
)
def test_invalid_ht_is_unknown_for_both_and_does_not_change_ft(hth, hta):
    assert G.evalueaza_pick(MARKET, 2, 1, "A", "B", hth, hta) is None
    assert S.evalueaza(MARKET, 2, 1, hth, hta) is None
    assert G.evalueaza_pick("Peste 2.5", 2, 1, "A", "B", hth, hta) is True
    assert S.evalueaza("Peste 2.5", 2, 1, hth, hta) is True


@pytest.mark.parametrize(
    "market,half,expected",
    [
        ("Peste 0.5 goluri la pauză", (0, 0), False),
        ("Peste 0.5 goluri la pauză", (1, 0), True),
        ("Sub 1.5 prima repriză", (1, 0), True),
        ("HT Over 1.5", (1, 1), True),
        ("Under 0.5 first half", (0, 0), True),
        ("O0.5 1st half", (0, 0), False),
        ("Peste 1.5 repriza 1", (0, 1), False),
        ("GG la pauză", (1, 0), False),
        ("1X HT", (1, 1), True),
    ],
)
def test_supported_ht_formulations_share_the_same_evaluator(market, half, expected):
    assert G.evalueaza_pick(market, 2, 1, "A", "B", *half) is expected
    assert S.evalueaza(market, 2, 1, *half) is expected


def test_readers_propagate_validated_half_to_sample_verdict_and_legacy_choice(
    tmp_path, monkeypatch
):
    db = tmp_path / "fixture.sqlite"
    with sqlite3.connect(db) as con:
        con.execute(
            "CREATE TABLE fixtures(id INTEGER PRIMARY KEY,status_short TEXT,goals_home INT,goals_away INT,fulltime_home INT,fulltime_away INT,halftime_home REAL,halftime_away REAL)"
        )
        con.executemany(
            "INSERT INTO fixtures VALUES(?,?,?,?,?,?,?,?)",
            [
                (1, "FT", 2, 1, 2, 1, 0, 0),
                (2, "FT", 2, 1, 2, 1, 0.5, 0),
                (3, "FT", 2, 1, 2, 1, None, None),
            ],
        )
    monkeypatch.setattr(G, "DB", f"file:{db}?mode=ro")
    monkeypatch.setattr(S, "DB", f"file:{db}?mode=ro")
    results = S.rezultate([1, 2, 3])
    assert results == G.rezultate([1, 2, 3])
    assert results[1] == dict(gh=2, ga=1, hth=0, hta=0)
    assert results[2] == results[3] == dict(gh=2, ga=1, hth=None, hta=None)
    item = dict(
        match=dict(fixture_id=1, home="A", away="B"),
        analysis="🎯 **Picks**\n🔒 **Bază:** **Peste 0.5 goluri la pauză — 70%.** text\n"
        "🎯 **Principal:** **Peste 0.5 goluri la pauză — 70%.** text\n👁️ x",
    )
    assert S._verdict(item, results[1]) == ((2, 1), False)
    assert S._verdict(item, results[2]) == ((2, 1), None)
    assert S.alege([item], results)[1:] == ((2, 1), MARKET, False)


@pytest.mark.parametrize("market", ["ESMTK peste 0.5 goluri", "Over 1.5 goluri"])
def test_sample_guard_limits_recognition_without_recalculating_ft(market):
    assert S.evalueaza(market, 2, 1) is None
    assert S.evalueaza("Peste 1.5 goluri", 2, 1) is G.evalueaza_pick(
        "Peste 1.5 goluri", 2, 1, "", ""
    )


@pytest.mark.parametrize(
    "team", ["ESMTK", "Dabas", "Gazda FC", "Oaspete FC", "gazdele", "oaspeții"]
)
@pytest.mark.parametrize(
    "period", ["HT", "la pauză", "prima repriză", "first half", "1st half", "repriza 1"]
)
@pytest.mark.parametrize("where", ["period_prefix", "period_suffix", "team_suffix"])
@pytest.mark.parametrize("half", [(0, 1), (1, 0)])
def test_half_time_marker_never_authorizes_an_unknown_team_total(
    team, period, where, half
):
    market = {
        "period_prefix": f"{period} {team} peste 0.5",
        "period_suffix": f"{team} peste 0.5 {period}",
        "team_suffix": f"Peste 0.5 {team} {period}",
    }[where]
    assert S.evalueaza(market, 2, 1, *half) is None
    assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", *half) is None


def test_team_total_base_does_not_become_match_total_with_or_without_ht():
    for label in ["ESMTK peste 0.5", "Dabas sub 1.5", "Peste 0.5 ESMTK"]:
        assert S.evalueaza(label, 2, 1) is None
        assert G.evalueaza_pick(label, 2, 1, "ESMTK", "Dabas") is None


@pytest.mark.parametrize(
    "alias", ["GG/BTTS", "BTTS (GG)", "Ambele înscriu (GG)", "GG / ambele marchează"]
)
@pytest.mark.parametrize("half,expected", [((1, 1), True), ((0, 1), False)])
def test_existing_btts_aliases_remain_recognized_independently_of_period(
    alias, half, expected
):
    assert G.evalueaza_pick(alias, 2, 1, "A", "B") is True
    assert G.evalueaza_pick(alias + " la pauză", 2, 1, "A", "B", *half) is expected
    assert S.evalueaza(alias + " la pauză", 2, 1, *half) is expected


@pytest.mark.parametrize("score,expected", [((1, 0), True), ((3, 0), False)])
def test_existing_ampersand_compound_keeps_both_components(score, expected):
    assert (
        G.evalueaza_pick("Gazda FC câștigă & Sub 2.5", *score, "Gazda FC", "Oaspete FC")
        is expected
    )
    assert (
        G.evalueaza_pick(
            "Gazda FC câștigă & Sub 2.5 la pauză",
            3,
            0,
            "Gazda FC",
            "Oaspete FC",
            *score,
        )
        is expected
    )


@pytest.mark.parametrize(
    "market",
    [
        "1X cu minimum 4 cornere",
        "Peste 1.5 + 1X cu minimum 4 cornere",
        "1X cu minimum 4 cornere HT",
        "HT Peste 1.5 + 1X cu minimum 4 cornere",
    ],
)
def test_result_component_never_ignores_a_corner_condition(market):
    assert S.evalueaza(market, 2, 1, 1, 0) is None
    assert G.evalueaza_pick(market, 2, 1, "A", "B", 1, 0) is None


@pytest.mark.parametrize("evaluate", ["sample", "archive"])
@pytest.mark.parametrize(
    "market",
    [
        "Peste 1.5",
        "GG",
        "1",
        "2",
        "X",
        "1X",
        "X2",
        "12",
        "Victorie gazde",
        "Victorie oaspeți",
        "Scor corect 2-1",
        "1X (ESMTK nu pierde)",
        "2 (Dabas câștigă)",
        "ESMTK câștigă",
        "Peste 1.5 + 1X",
        "GG + Scor exact 2-1",
    ],
)
@pytest.mark.parametrize("period", ["", " HT", " la pauză", " prima repriză"])
def test_every_component_must_recognize_the_whole_market(evaluate, market, period):
    text = market + " cu minimum 4 cornere" + period
    if evaluate == "sample":
        assert S.evalueaza(text, 2, 1, 1, 0) is None
    else:
        assert G.evalueaza_pick(text, 2, 1, "ESMTK", "Dabas", 1, 0) is None


@pytest.mark.parametrize("market", ["1X (ESMTK nu pierde)", "2 (Dabas câștigă)"])
def test_unknown_named_annotation_without_team_context_is_not_evaluated(market):
    assert S.evalueaza(market, 2, 1, 1, 0) is None
    assert G.evalueaza_pick(market, 2, 1, "", "", 1, 0) is None


@pytest.mark.parametrize(
    "market",
    [
        "1 (Dabas câștigă)",
        "2 (ESMTK câștigă)",
        "1X (Necunoscut nu pierde)",
        "Victorie gazde (2)",
        "2 (Dabas câștigă cu minimum 4 cornere)",
    ],
)
def test_result_annotation_must_match_the_full_known_team_and_sign(market):
    assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", 1, 0) is None


@pytest.mark.parametrize(
    "market,expected",
    [
        ("1 (ESMTK câștigă)", True),
        ("2 (Dabas câștigă)", False),
        ("1X (ESMTK nu pierde)", True),
        ("X2 (Dabas nu pierde)", False),
        ("Victorie gazde (1)", True),
        ("Victorie oaspeți (2)", False),
        ("1X (dublă șansă)", True),
        ("Peste 1.5 + 1X", True),
    ],
)
@pytest.mark.parametrize("period", ["", " HT", " la pauză", " prima repriză"])
def test_known_result_annotations_keep_their_meaning_with_explicit_context(
    market, expected, period
):
    assert G.evalueaza_pick(market + period, 2, 1, "ESMTK", "Dabas", 2, 1) is expected
    assert (
        S.evalueaza(market + period, 2, 1, 2, 1, home="ESMTK", away="Dabas") is expected
    )


@pytest.mark.parametrize(
    "market",
    [
        "1 (Dabas câștigă)",
        "2 (ESMTK câștigă)",
        "1X (Necunoscut nu pierde)",
        "2 (Dabas câștigă cu minimum 4 cornere)",
    ],
)
def test_sample_validates_the_entire_named_annotation_in_context(market):
    assert S.evalueaza(market, 2, 1, 1, 0, home="ESMTK", away="Dabas") is None


@pytest.mark.parametrize(
    "market",
    [
        "1X pauza4cornere",
        "1X pauzatoare",
        "1X prima repriza4cornere",
        "Peste 0.5 pauza4cornere",
        "GG prima repriza4cornere",
    ],
)
@pytest.mark.parametrize("engine", ["sample", "archive"])
def test_unknown_period_token_is_never_deleted(market, engine):
    if engine == "sample":
        assert S.evalueaza(market, 2, 1, 1, 0, home="ESMTK", away="Dabas") is None
    else:
        assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", 1, 0) is None


@pytest.mark.parametrize(
    "market", ["1 (Galatasaray)", "Galatasaray (1)", "1X (Galatasaray)"]
)
def test_bare_team_name_marker_requires_the_complete_matching_identity(market):
    assert G.evalueaza_pick(market, 2, 1, "Galatasaray", "Fenerbahce", 1, 0) is True
    assert (
        S.evalueaza(market, 2, 1, 1, 0, home="Galatasaray", away="Fenerbahce") is True
    )
    assert G.evalueaza_pick(market, 2, 1, "Fenerbahce", "Galatasaray", 1, 0) is None
    assert G.evalueaza_pick(market, 2, 1, "", "", 1, 0) is None


@pytest.mark.parametrize("gh", range(6))
@pytest.mark.parametrize("ga", range(6))
@pytest.mark.parametrize("period", ["", " la pauză"])
def test_complete_exact_score_zero_to_five_precedes_numeric_heuristics(gh, ga, period):
    market = f"Scor corect {gh}-{ga}" + period
    assert G.evalueaza_pick(market, gh, ga, "ESMTK", "Dabas", gh, ga) is True
    assert S.evalueaza(market, gh, ga, gh, ga, home="ESMTK", away="Dabas") is True
    assert G.evalueaza_pick(market, gh + 1, ga, "ESMTK", "Dabas", gh + 1, ga) is False
    assert (
        S.evalueaza(market, gh + 1, ga, gh + 1, ga, home="ESMTK", away="Dabas") is False
    )


@pytest.mark.parametrize("period", ["", " la pauză"])
def test_exact_score_with_unknown_condition_stays_unknown(period):
    market = "Scor corect 1-5 cu minimum 4 cornere" + period
    assert G.evalueaza_pick(market, 1, 5, "ESMTK", "Dabas", 1, 5) is None
    assert S.evalueaza(market, 1, 5, 1, 5, home="ESMTK", away="Dabas") is None


@pytest.mark.parametrize("code", ["1", "2"])
@pytest.mark.parametrize("sign", ["-", "+", "−"])
@pytest.mark.parametrize("period", ["", " la pauză"])
@pytest.mark.parametrize("engine", ["sample", "archive"])
def test_signed_annotation_cannot_normalize_into_a_result_code(
    code, sign, period, engine
):
    market = f"{code} ({sign}{code})" + period
    if engine == "sample":
        assert S.evalueaza(market, 2, 1, 1, 0, home="ESMTK", away="Dabas") is None
    else:
        assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", 1, 0) is None


@pytest.mark.parametrize("name", ["ESMTK", "Bodø/Glimt", "Kfar-Shalem", "Diósgyőri"])
def test_complete_known_team_annotation_preserves_its_identity_and_punctuation(name):
    market = f"1 ({name})"
    assert G.evalueaza_pick(market, 2, 1, name, "Dabas", 1, 0) is True
    assert S.evalueaza(market, 2, 1, 1, 0, home=name, away="Dabas") is True


@pytest.mark.parametrize(
    "market",
    [
        "Peste (-2.5)",
        "Sub (-2.5)",
        "Peste 2/5",
        "Sub 2/5",
        "Peste -2.5",
        "Peste +2.5",
        "Peste 2 5",
        "Peste 2:5",
        "Peste (2.5)",
        "Sub (2.5)",
        "-1",
        "-2",
        "+1",
        "+2",
        "1/",
        "1*",
        "Scor corect -1-5",
        "Scor corect 1--5",
        "Scor corect 1/-5",
    ],
)
@pytest.mark.parametrize("period", ["", " la pauză"])
@pytest.mark.parametrize("engine", ["sample", "archive"])
def test_numeric_operator_mutations_never_become_a_known_market(market, period, engine):
    market += period
    if engine == "sample":
        assert S.evalueaza(market, 2, 1, 1, 0, home="ESMTK", away="Dabas") is None
    else:
        assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", 1, 0) is None


@pytest.mark.parametrize(
    "market", ["Peste 2.5", "Peste 2,5", "GG/BTTS", "BTTS (GG)", "Ambele înscriu (GG)"]
)
def test_canonical_decimal_and_explicit_btts_aliases_keep_their_verdict(market):
    assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", 2, 1) is True
    assert S.evalueaza(market, 2, 1, 2, 1, home="ESMTK", away="Dabas") is True


@pytest.mark.parametrize("market", ["1 ()", "Peste ()2.5", "GG ()"])
def test_unknown_empty_annotation_is_not_deleted_by_period_normalization(market):
    assert G.evalueaza_pick(market, 2, 1, "ESMTK", "Dabas", 1, 0) is None
    assert S.evalueaza(market, 2, 1, 1, 0, home="ESMTK", away="Dabas") is None


def test_parenthesized_known_period_remains_an_explicit_form():
    assert G.evalueaza_pick("Peste 2.5 (HT)", 2, 1, "ESMTK", "Dabas", 2, 1) is True
    assert S.evalueaza("Peste 2.5 (HT)", 2, 1, 2, 1, home="ESMTK", away="Dabas") is True


@pytest.mark.parametrize(
    "key,label,english,expected",
    [
        (
            "ht_over_0_5",
            "Peste 0,5 goluri în prima repriză",
            "Over 0.5 first-half goals",
            False,
        ),
        ("btts", "Ambele marchează", "Both teams to score", True),
    ],
)
def test_new_pro_markets_keep_the_published_selection_in_sample_and_archive(
    key, label, english, expected
):
    analysis = (
        "⚡ **Verdict:** Text.\n"
        "🎯 **Picks:**\n"
        f"🎯 **Principal:** **{label} — 76%.** Text.\n"
        "👁️ **De urmărit:** Text."
    )
    item = {
        "match": {"fixture_id": 1, "home": "A", "away": "B"},
        "analysis": analysis,
        "analysis_en": analysis,
        "provenance": {
            "inputs": {
                "picks": [{"rol": "Principal", "key": key, "piata": label, "p": 76}]
            }
        },
    }
    result = dict(gh=2, ga=1, hth=0, hta=0)
    assert S.evalueaza(label, 2, 1, 0, 0) is expected
    assert S._verdict(item, result) == ((2, 1), expected)
    assert G.verifica(item, result)["picks"][0]["ok"] is expected
    assert english + " · 76%" in S.html_card(item, "2026-11-21", (2, 1), expected)
    if key == "ht_over_0_5":
        result.update(hth=None, hta=None)
        assert S._verdict(item, result) == ((2, 1), None)
        assert G.verifica(item, result)["picks"][0]["ok"] is None


@pytest.mark.parametrize(
    "picks,expected",
    [
        ([], None),
        ([{"rol": "Principal", "key": "under_3_5", "piata": "Sub 3,5 goluri"}], True),
    ],
)
def test_contextual_publication_uses_only_the_structured_selection(picks, expected):
    analysis = (
        "⚡ **Verdict:** Argument de context.\n"
        "🎯 **Picks:**\n"
        "🔒 **Bază:** **GG — 90%.** Alternativă.\n"
        "🎯 **Principal:** **Peste 0,5 goluri în prima repriză — 76%.** Text.\n"
        "👁️ **De urmărit:** Text."
    )
    item = {
        "match": {"fixture_id": 1, "home": "A", "away": "B"},
        "analysis": analysis,
        "analysis_en": analysis,
        "provenance": {"inputs": {"selection_mode": "contextual", "picks": picks}},
    }
    result = dict(gh=2, ga=1, hth=0, hta=0)
    assert S._verdict(item, result) == ((2, 1), expected)
    archive_picks = G.verifica(item, result)["picks"]
    if picks:
        assert len(archive_picks) == 1
        assert archive_picks[0]["ok"] is True
        assert archive_picks[0]["prob"] is None
        assert "Under 3.5 goals" in S.html_card(
            item, "2026-11-21", (2, 1), expected
        )
    else:
        assert archive_picks == []
        html = S.html_card(item, "2026-11-21", (2, 1), expected)
        assert "No selection" in html
        assert "76%" not in html and "90%" not in html


@pytest.mark.parametrize(
    "key,label,expected",
    [
        ("ht_over_0_5", "Peste 0,5 goluri în prima repriză", False),
        ("btts", "Ambele marchează", True),
        ("ng", "Cel puțin o echipă nu marchează", False),
        ("over_1_5", "Peste 1,5 goluri", True),
        ("over_2_5", "Peste 2,5 goluri", True),
        ("over_3_5", "Peste 3,5 goluri", False),
        ("under_2_5", "Sub 2,5 goluri", False),
        ("under_3_5", "Sub 3,5 goluri", True),
    ],
)
def test_all_contextual_goal_markets_use_the_correct_score(key, label, expected):
    analysis = (
        "⚡ **Verdict:** Argument de context.\n"
        "🎯 **Picks:**\n"
        f"🎯 **Principal:** {label}. Argumentul publicat.\n"
        "👁️ **De urmărit:** Text."
    )
    item = {
        "match": {"fixture_id": 1, "home": "A", "away": "B"},
        "analysis": analysis,
        "provenance": {
            "inputs": {
                "selection_mode": "contextual",
                "picks": [{"rol": "Principal", "key": key, "piata": label}],
            }
        },
    }
    result = dict(gh=2, ga=1, hth=0, hta=0)
    assert S.evalueaza(label, 2, 1, 0, 0) is expected
    assert S._verdict(item, result) == ((2, 1), expected)
    archive_result = G.verifica(item, result)
    assert archive_result["picks"][0]["ok"] is expected
    html = G.html_analiza(item, archive_result, "2026-11-21")
    assert f'data-pro-market-key="{key}"' in html
    assert "Argumentul publicat." in html
    assert "Argumentul publicat." in S.html_card(item, "2026-11-21", (2, 1), expected)
    if key == "ng":
        assert S.evalueaza(label, 1, 0) is True
        assert S.evalueaza(label + " cu 4 cornere", 1, 0) is None


@pytest.mark.parametrize("goals,expected", [(1, False), (2, True), (3, True), (4, False)])
def test_contextual_range_includes_both_endpoints(goals, expected):
    label = "2–3 goluri în total după 90 de minute, inclusiv"
    assert G.evalueaza_pick(label, 0, goals, "A", "B", 0, 0) is expected
    assert S.evalueaza(label, 0, goals) is expected
    assert G.evalueaza_pick(label + " la pauză", 0, goals, "A", "B", 0, 0) is None


@pytest.mark.parametrize("lang", ["ro", "en", "es", "it", "fr", "id"])
def test_contextual_dossier_can_settle_and_localize_each_market(lang):
    selections = [
        {"rol": "Principal", "key": "total_goals_2_3"},
        {"rol": "Alternativă", "key": "team_goals_home_2_plus"},
        {"rol": "Alternativă", "key": "team_goals_away_2_plus"},
    ]
    match = {"fixture_id": 1, "home": "A & B", "away": "C"}
    analysis = "⚡ **Verdict:** Argument de context.\n🎯 **Picks:**\n"
    for pick in selections:
        label = S.pro_market_label(pick["key"], lang, match)
        pick["piata"] = label
        if pick["rol"] == "Principal":
            analysis += f"🎯 **Principal:** {label}. Argument principal.\n"
        else:
            analysis += f"↪️ **{S.ALTERNATIVE[lang]}:** {label}. Argument {pick['key']}.\n"
    analysis += "👁️ **De urmărit:** Text."
    item = {
        "match": match,
        "analysis": analysis,
        "provenance": {"inputs": {"selection_mode": "contextual", "picks": selections}},
    }
    result = dict(gh=1, ga=2, hth=0, hta=0)
    archive_result = G.verifica(item, result)
    assert [(p["tip"], p["ok"]) for p in archive_result["picks"]] == [
        ("Principal", True), ("Alternativă", False), ("Alternativă", True)
    ]
    assert S._verdict(item, result) == ((1, 2), True)
    html = G.html_analiza(item, archive_result, "2026-11-21", lang)
    assert html.count('data-archive-role="alternative"') == 4
    for pick in selections[1:]:
        assert f'data-pro-market-key="{pick["key"]}"' in html
        assert f"Argument {pick['key']}." in html
    assert "A &amp; B" in html
    assert G.evalueaza_pick("C marchează cel puțin 2 goluri în 90 de minute", 1, 2, "A & B", "C") is True
    assert G.evalueaza_pick("Unknown marchează cel puțin 2 goluri în 90 de minute", 1, 2, "A & B", "C") is None
