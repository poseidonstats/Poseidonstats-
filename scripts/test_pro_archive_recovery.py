"""Arhiva recuperată rămâne descriptivă și nu poate deveni dovadă prospectivă."""
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_pro_arhiva as A

LIMBI = ('ro', 'en', 'es', 'it', 'fr', 'id')
TEXT = ('⚡ **Verdict:** Gazda poate înscrie.\n📊 **Context:** Arhivă.\n'
        '🧮 **Modelul:** 60% victorie.\n🎯 **Picks**\n'
        '🔒 **Bază:** Peste 1.5 goluri — **80%**.\n'
        '🎯 **Principal:** 1X — **75%**.\n👁️ **De urmărit:** Startul.')


def arhiva(zi='2026-10-15'):
    it = {'match': {'fixture_id': 7, 'home': 'Gazda FC', 'away': 'Oaspete FC',
                    'date': zi, 'p_home': 60, 'p_draw': 25, 'p_away': 15}, 'analysis': TEXT}
    it.update({f'analysis_{lang}': TEXT for lang in LIMBI if lang != 'ro'})
    return {'date': zi, 'generated_at': zi + 'T04:22:48', 'items': [it], 'count': 1}


def surse(tmp_path):
    root = tmp_path / 'pro_analyses'
    rec = root / 'recuperate'
    rec.mkdir(parents=True)
    normal = arhiva('2026-10-14')
    (root / '2026-10-14.json').write_text(json.dumps(normal))
    original = root / '2026-10-15.dryrun.json'
    original.write_text(json.dumps(arhiva()))
    recovered = arhiva()
    recovered.update({'generated_at_timezone': 'Europe/Bucharest',
                      'generated_at_utc': '2026-10-15T01:22:48Z',
                      'published_at_utc': '2026-10-16T05:05:56Z',
                      'published_late': True, 'exclude_from_forward_test': True,
                      'recovery_kind': 'existing_pre_kickoff_cache_only',
                      'recovery_of': original.name,
                      'recovery_of_sha256': hashlib.sha256(original.read_bytes()).hexdigest()})
    path = rec / '2026-10-15.json'
    path.write_text(json.dumps(recovered))
    return root, path, recovered


def test_loader_include_recuperat_si_forteaza_excluderea(monkeypatch, tmp_path):
    root, path, recovered = surse(tmp_path)
    monkeypatch.setattr(A, 'ARHIVA', root)
    # Chiar dacă cineva elimină flagurile de excludere, amplasarea recuperate
    # rămâne autoritatea; sidecarul/per-item nu pot legitima o livrare târzie.
    recovered['exclude_from_forward_test'] = False
    recovered['published_late'] = False
    recovered['items'][0].update({'exclude_from_forward_test': False, 'published_late': False})
    path.write_text(json.dumps(recovered))
    zile = A.citeste_arhiva()
    assert [z['zi'] for z in zile] == ['2026-10-14', '2026-10-15']
    z = zile[-1]
    assert z['_recovery']['published_at_utc'] == recovered['published_at_utc']
    assert all(it['_archive_excluded'] for it in z['items'])
    monkeypatch.setattr(A.PP, 'eligibilitate', lambda *a, **k: (True, 'eligibil'))
    tot, pe_zi = A.bilant([z], {7: {'gh': 2, 'ga': 0, 'hth': 1, 'hta': 0}})
    assert all(t['n'] == 0 for t in tot.values())
    assert pe_zi[0]['eligibile'] == 0
    assert pe_zi[0]['excluderi']['exclus_explicit'] == 1


def test_coliziunea_canonica_este_refuzata(monkeypatch, tmp_path):
    root, _, recovered = surse(tmp_path)
    (root / '2026-10-15.json').write_text(json.dumps(recovered))
    monkeypatch.setattr(A, 'ARHIVA', root)
    with pytest.raises(ValueError, match='coliziune'):
        A.citeste_arhiva()


@pytest.mark.parametrize('key,value', [
    ('date', '2026-10-16'), ('recovery_kind', 'regenerated'),
    ('recovery_of', '../x.json'), ('recovery_of_sha256', 'b' * 64),
    ('published_at_utc', '2026-10-16T05:05:56'),
    ('generated_at_utc', '2026-10-16T06:00:00Z'),
])
def test_metadatele_recuperarii_sunt_validate(monkeypatch, tmp_path, key, value):
    root, path, recovered = surse(tmp_path)
    recovered[key] = value
    path.write_text(json.dumps(recovered))
    monkeypatch.setattr(A, 'ARHIVA', root)
    with pytest.raises(ValueError):
        A.citeste_arhiva()


def test_pagina_sase_limbi_timestamp_si_index_descriptiv(monkeypatch, tmp_path):
    root, _, _ = surse(tmp_path)
    monkeypatch.setattr(A, 'ARHIVA', root)
    zile = A.citeste_arhiva()
    z = zile[-1]
    page = A.html_zi(z, {}, '2026-10-14', None)
    assert 'data-pro-archive-kind="recovered-late"' in page
    assert '2026-10-16T05:05:56Z' in page
    assert 'Publicată cu întârziere' in page
    assert 'Published late' in page
    for lang in LIMBI:
        assert f'data-recovery-lang="{lang}"' in page
    tot, pe_zi = A.bilant(zile, {})
    index = A.html_index(zile, tot, pe_zi, '2026-10-15')
    assert '2026-10-15.html' in index
    assert 'data-pro-archive-kind="recovered-late"' in index
    assert all(t['n'] == 0 for t in tot.values())


def test_rerun_nu_rescrie_nicio_sursa(monkeypatch, tmp_path):
    root, _, _ = surse(tmp_path)
    monkeypatch.setattr(A, 'ARHIVA', root)
    before = {str(p): p.read_bytes() for p in root.rglob('*.json')}
    a = A.citeste_arhiva()
    b = A.citeste_arhiva()
    assert a == b
    assert before == {str(p): p.read_bytes() for p in root.rglob('*.json')}
    assert not (root / '2026-10-15.json').exists()


def test_ziua_normala_nu_primeste_eticheta_recuperata():
    normal = {'zi': '2026-10-14', 'generat': '2026-10-14T04:22:48', 'items': arhiva('2026-10-14')['items']}
    page = A.html_zi(normal, {}, None, None)
    assert 'data-pro-archive-kind=' not in page
    assert 'Publicată cu întârziere' not in page
    assert 'pro-card-full' in page


def test_atributele_json_ale_indexului_sunt_valide_in_browser():
    import html
    import re
    zile = [{'zi': '2026-10-14', 'items': []}]
    tot, pe_zi = A.bilant(zile, {})
    page = A.html_index(zile, tot, pe_zi, '2026-10-14')
    for attr in re.findall(r"data-i18n-vars='(.*?)'", page):
        json.loads(html.unescape(attr))


def test_atributele_json_ale_zilei_sunt_valide_in_browser():
    import html
    import re
    normal = {'zi': '2026-10-14', 'generat': '2026-10-14T04:22:48', 'items': arhiva('2026-10-14')['items']}
    for attr in re.findall(r"data-i18n-vars='(.*?)'", A.html_zi(normal, {}, None, None)):
        json.loads(html.unescape(attr))
