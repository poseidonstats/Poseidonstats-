"""The dated public journal is a display ledger, independent of reconstructed audit metrics."""
from datetime import date, datetime
from pathlib import Path
import json
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from restore_public_recent_history import original_editions, original_rows, restore_history  # noqa: E402


DAY = date(2026, 11, 24)
KICKOFF = '2026-11-24T19:00:00Z'
COMMIT = 'f' * 40
GENERATED = '2026-11-24T05:30:00+02:00'
AS_PUBLISHED = datetime.fromisoformat('2026-11-24T05:32:00+02:00')
PICKS = [
    {'market': '1X', 'prob': 80, 'outcome': 'PENDING'},
    {'market': 'Over 2.5', 'prob': 69, 'outcome': 'PENDING'},
    {'market': 'HT Over 0.5', 'prob': 70, 'outcome': 'PENDING'},
]
IDENTITY = {'fixture_id': 9, 'match_date': KICKOFF, 'league': 'National Cup', 'country': 'X',
            'home_team': 'Cato', 'away_team': 'Dorian'}
ROW = {'fixture_id': 9, 'time': '21:00', 'country': 'X', 'league': 'National Cup',
       'home': 'Cato', 'away': 'Dorian', 'calibrated_lg': True, 'snapshot': 'dayof', 'picks': PICKS}


def history(*rows, generated=GENERATED, day=DAY):
    return {'generated_at': generated, 'days': [{'date': day.isoformat(), 'matches': list(rows)}]}


def predictions(*rows, free=1, locked=0):
    return {'generated_at': GENERATED, 'freemium': {'free': free, 'locked': locked}, 'matches': list(rows)}


def latest(*days):
    return {'generated_at': '2026-11-25T05:30:00+02:00', 'days': list(days),
            'cumulated_markets': [{'n': 123}], 'integritate': {'other_cohort': 44}}


def report(**score):
    return {'date': '2026-11-25', 'days': {DAY.isoformat(): {'results': {'9': {
        **IDENTITY, 'ft_h': 1, 'ft_a': 1, 'ht_h': 0, 'ht_a': 0, **score,
    }}}}}


def published():
    return {DAY: original_rows(history(ROW), predictions({**IDENTITY, 'free': True}), COMMIT, AS_PUBLISHED)}


def test_originals_require_same_edition_identity_free_and_before_kickoff():
    feed = predictions({**IDENTITY, 'free': True})
    rows = original_rows(history(ROW), feed, COMMIT, AS_PUBLISHED)
    assert len(rows) == 1
    assert rows[0]['picks'] == PICKS
    assert rows[0]['publication']['commit'] == COMMIT
    assert rows[0]['publication']['match_date'] == KICKOFF

    assert original_rows(history(ROW), feed, COMMIT, datetime.fromisoformat(KICKOFF)) == []
    assert original_rows(history(ROW), {**feed, 'generated_at': '2026-11-24T05:40:00+02:00'}, COMMIT, AS_PUBLISHED) == []
    assert original_rows(history({**ROW, 'away': 'Different opponent'}), feed, COMMIT, AS_PUBLISHED) == []
    assert original_rows(history(ROW), predictions({**IDENTITY, 'locked': True}, free=0, locked=1), COMMIT, AS_PUBLISHED) == []
    assert original_rows(history(ROW, ROW), feed, COMMIT, AS_PUBLISHED) == []


def test_git_origin_uses_first_eligible_same_day_edition(tmp_path, monkeypatch):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(tmp_path), *args], text=True)

    git('init', '-q')
    git('config', 'user.name', 'Visual History Test')
    git('config', 'user.email', 'history-test@example.invalid')
    data = tmp_path / 'data'
    data.mkdir()
    (data / 'predictions.json').write_text(json.dumps(predictions({**IDENTITY, 'free': True})))
    journal = data / 'history.json'
    journal.write_text(json.dumps(history(ROW)))
    for name in ('GIT_AUTHOR_DATE', 'GIT_COMMITTER_DATE'):
        monkeypatch.setenv(name, AS_PUBLISHED.isoformat())
    git('add', 'data')
    git('commit', '-qm', 'First public edition')
    first = git('rev-parse', 'HEAD').strip()
    journal.write_text(json.dumps(history({**ROW, 'picks': [{**PICKS[0], 'prob': 99}]})))
    for name in ('GIT_AUTHOR_DATE', 'GIT_COMMITTER_DATE'):
        monkeypatch.setenv(name, '2026-11-24T05:34:00+02:00')
    git('commit', '-qam', 'Later same-day edition')
    recovered = original_editions(tmp_path, date(2026, 11, 25), 'HEAD')
    assert recovered[DAY][0]['publication']['commit'] == first
    assert recovered[DAY][0]['picks'] == PICKS


def test_settlement_uses_only_original_picks_and_verified_scores_and_preserves_audit():
    raw = latest({'date': DAY.isoformat(), 'matches': [{**ROW, 'picks': [
        {'market': 'BTTS Da', 'prob': 88, 'outcome': 'WIN'},
    ]}]})
    result = restore_history(raw, published(), report(), {})
    day = result['days'][0]
    assert day['status'] == 'resolved'
    assert day['totals'] == {'picks': 3, 'wins': 1, 'losses': 2, 'pending': 0, 'locked_pending': 0}
    assert [p['prob'] for p in day['matches'][0]['picks']] == [80, 69, 70]
    assert [p['outcome'] for p in day['matches'][0]['picks']] == ['WIN', 'LOSS', 'LOSS']
    assert result['cumulated_markets'] == raw['cumulated_markets']
    assert result['integritate'] == raw['integritate']
    assert result['generated_at'] == raw['generated_at']


def test_score_requires_exact_fixture_and_coherent_halftime():
    for score in [{'match_date': '2026-11-24T18:00:00Z'}, {'away_team': 'Other'}, {'ft_h': True}, {'ht_a': 2}]:
        assert restore_history(latest(), published(), report(**score), {})['days'] == []
    only_ft = restore_history(latest(), published(), report(ht_h=None, ht_a=None), {})
    assert [p['market'] for p in only_ft['days'][0]['matches'][0]['picks']] == ['1X', 'Over 2.5']


def test_verified_rows_survive_score_window_but_not_forged_edit_or_new_contradiction():
    previous = restore_history(latest(), published(), report(), {})
    rolled = latest()
    rolled['generated_at'] = '2026-12-01T04:30:00+01:00'
    new_scores = {'date': '2026-12-01', 'days': {'2026-11-25': {'results': {}}}}
    kept = restore_history(rolled, published(), new_scores, previous)
    assert kept['days'] == previous['days']
    assert restore_history(kept, published(), new_scores, previous) == kept
    no_verified_active = {'date': '2026-11-25', 'days': {}}
    assert restore_history(latest(), published(), no_verified_active, previous)['days'] == []
    older_export = {'date': '2026-11-23', 'days': {}}
    assert restore_history(latest(), published(), older_export, previous)['days'] == previous['days']
    previous['days'][0]['matches'][0]['picks'][0]['prob'] = 99
    assert restore_history(rolled, published(), new_scores, previous)['days'] == []
    assert restore_history(latest(), published(), report(ft_h=-1), kept)['days'] == []
