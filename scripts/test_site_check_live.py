"""16 oct 2026: alerta „predictions.json invalid (0)” de la 20:15 — o singură cerere fără răspuns, fișierul era bun.
O cerere fără răspuns se reîncearcă o dată; dacă pică iar, mesajul spune „fără răspuns” cu eroarea de rețea, nu „invalid”."""
import datetime as dt
import json
import sys
import urllib.error

import pytest
from email.message import Message
from pathlib import Path
from zoneinfo import ZoneInfo
sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_check_live as S

ACUM = dt.datetime(2026, 10, 16, 20, 15, tzinfo=ZoneInfo("Europe/Bucharest"))
PREVIEW = '<article data-dashboard-pro-fallback data-sample-day="2026-10-16" data-sample-fixture="123" data-public-pro-report><div class="pro-card-head"><h3>Gazdă – Oaspeți</h3></div></article>'
CARD = '<div class="pro-card" data-public-pro-report data-sample-day="2026-10-16" data-sample-fixture="123">'
CATALOG = ('<main data-match-catalog><section id="exemplu-pro">' + PREVIEW + '</section>' + CARD + '<div class="pro-card-head">Exemplul Pro · <span data-date>16 octombrie 2026</span></div>'
         '<ul class="pro-today"></ul></div><div class="plans-pro-detail"></div><section id="dovada"></section><section id="repere-azi">16 octombrie 2026</section>'
         '<section id="abonament"></section><div class="legal-banner"></div><span data-i18n="plans.pro.trial"></span></main>')
PREDICTII = json.dumps({"generated_at": "2026-10-16T02:28:11+00:00", "matches": [{"free": True, "fixture_id": i+1, "home_team":"A", "away_team":"B", "match_date":"2026-10-16T17:30:00Z", "prob_home":0.4, "prob_draw":0.2, "prob_away":0.4} for i in range(5)]})
HEALTH = json.dumps({"predictions_full": {"generated_at": "2026-10-16T02:28:11+00:00"}, "pro": 3})
EXEMPLU = json.dumps({"date": "2026-10-16", "item": {"match": {"fixture_id": 123}}})
INDEX = ('<main data-home-page data-compact-home><section data-visitor-matches></section>'
         '<section data-visitor-sample></section><section data-visitor-locked></section></main>')


class Raspuns:
    status = 200

    def __init__(self, corp: bytes):
        self.corp = corp

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.corp


def urlopen_din(pasi: list, apeluri: list):
    """urlopen fals: fiecare apel consumă un pas — o excepție se ridică, un bytes devine răspunsul 200."""
    def urlopen(req, timeout=None):
        apeluri.append(req.full_url)
        pas = pasi.pop(0)
        if isinstance(pas, Exception):
            raise pas
        return Raspuns(pas)
    return urlopen


def test_cererea_fara_raspuns_se_reincearca_o_data(monkeypatch):
    apeluri, pauze = [], []
    monkeypatch.setattr(S.urllib.request, "urlopen", urlopen_din([TimeoutError("The read operation timed out"), b'{"a": 1}'], apeluri))
    monkeypatch.setattr(S.time, "sleep", pauze.append)
    assert S.get("https://x/data/predictions.json") == (200, '{"a": 1}')
    assert len(apeluri) == 2 and pauze == [S.PAUZA]


def test_dupa_doua_esecuri_intoarce_eroarea_de_retea(monkeypatch):
    apeluri = []
    monkeypatch.setattr(S.urllib.request, "urlopen", urlopen_din([TimeoutError("The read operation timed out")] * 2, apeluri))
    monkeypatch.setattr(S.time, "sleep", lambda s: None)
    assert S.get("https://x/data/predictions.json") == (0, "TimeoutError: The read operation timed out")
    assert len(apeluri) == S.INCERCARI == 2


def test_raspunsul_http_de_eroare_nu_se_reincearca(monkeypatch):
    apeluri = []
    monkeypatch.setattr(S.urllib.request, "urlopen", urlopen_din([urllib.error.HTTPError("https://x", 404, "Not Found", Message(), None)], apeluri))
    assert S.get("https://x/analize/2026-10-15.html") == (404, "")
    assert len(apeluri) == 1


def site_fals(monkeypatch, **inlocuiri):
    """get fals pentru verifica(): site-ul bun de pe 16 oct, cu răspunsurile din `inlocuiri` (după bucata de URL) puse peste."""
    def get(url, timeout=25):
        for bucata, raspuns in inlocuiri.items():
            if bucata in url:
                return raspuns
        if "/api/health" in url:
            return 200, HEALTH
        if "/api/exemplu/" in url:
            return 200, EXEMPLU
        if url.endswith("/data/predictions.json"):
            return 200, PREDICTII
        if url.endswith("/assets/i18n.json"):
            return 200, (Path(__file__).resolve().parents[1] / "assets/i18n.json").read_text()
        if url.endswith("/assets/app.js"):
            return 200, "trial-banner"
        if url.endswith("/meciuri.html"):
            return 200, CATALOG
        return 200, INDEX if url.endswith("/index.html") else "<html></html>"
    monkeypatch.setattr(S, "get", get)


def test_site_bun_fara_probleme(monkeypatch):
    site_fals(monkeypatch)
    assert S.verifica(ACUM) == []


def test_alerta_de_la_20_15_spune_fara_raspuns_nu_invalid(monkeypatch):
    site_fals(monkeypatch, **{"predictions.json": (0, "TimeoutError: The read operation timed out")})
    assert S.verifica(ACUM) == ["predictions.json: fără răspuns după 2 încercări (TimeoutError: The read operation timed out)"]


def test_json_stricat_ramane_invalid(monkeypatch):
    site_fals(monkeypatch, **{"predictions.json": (200, "<html>")})
    err = S.verifica(ACUM)
    assert len(err) == 1 and err[0].startswith("predictions.json invalid: JSONDecodeError")


def test_fara_raspuns_la_pagini_si_la_api(monkeypatch):
    retea = (0, "URLError: <urlopen error [Errno 8] nodename nor servname provided, or not known>")
    site_fals(monkeypatch, **{"app.js": retea, "2026-10-15.html": (404, ""), "/api/health": retea})
    assert S.verifica(ACUM) == [f"app.js: fără răspuns după 2 încercări ({retea[1]})", "arhiva Pro de ieri nu se deschide (2026-10-15, HTTP 404)",
                                f"membri: /api/health fără răspuns după 2 încercări ({retea[1]})"[:160]]
    site_fals(monkeypatch, **{"index.html": retea})
    assert S.verifica(ACUM) == [f"index.html: fără răspuns după 2 încercări ({retea[1]})"]

@pytest.mark.parametrize("card,rol", [(PREVIEW, "previzualizare"), (CARD, "card complet")])
@pytest.mark.parametrize("data,mesaj", [
    ('data-sample-day="2026-10-15"', "2026-10-15"),
    ("", "dată lipsă"),
])
def test_verifica_editia_fiecarui_card(monkeypatch, card, rol, data, mesaj):
    vechi = card.replace('data-sample-day="2026-10-16"', data)
    site_fals(monkeypatch, **{"meciuri.html": (200, CATALOG.replace(card, vechi))})
    assert S.verifica(ACUM) == [f"ediția Pro ({rol}): așteptat 2026-10-16, găsit {mesaj}"]


def test_pagina_compacta_poate_sa_nu_aiba_exemplu_public(monkeypatch):
    html = CATALOG.replace(PREVIEW, '').replace(CARD, '<div>')
    site_fals(monkeypatch, **{"meciuri.html": (200, html), "/api/exemplu/": (404, "")})
    assert S.verifica(ACUM) == []


@pytest.mark.parametrize("raspuns,mesaj", [
    ((503, ""), "HTTP 503"),
    ((0, "TimeoutError: expirat"), "fără răspuns după 2 încercări (TimeoutError: expirat)"),
])
def test_pagina_compacta_raporteaza_eroarea_api_exemplu(monkeypatch, raspuns, mesaj):
    site_fals(monkeypatch, **{"meciuri.html": (200, CATALOG), "/api/exemplu/": raspuns})
    assert S.verifica(ACUM) == [f"exemplu Pro: /api/exemplu/2026-10-16 {mesaj}"]


def test_pagina_compacta_verifica_acelasi_meci_din_exemplu(monkeypatch):
    site_fals(monkeypatch, **{"meciuri.html": (200, CATALOG)})
    assert S.verifica(ACUM) == []
    alt_card = CARD.replace('data-sample-fixture="123"', 'data-sample-fixture="321"')
    site_fals(monkeypatch, **{"meciuri.html": (200, CATALOG.replace(CARD, alt_card))})
    assert S.verifica(ACUM) == ["ediția Pro (card complet): așteptat meciul 123, găsit 321"]


def test_monitorul_verifica_ordinea_pe_prima_pagina_si_disponibilitatea_catalogului(monkeypatch):
    eronat = INDEX.replace("data-visitor-matches", "temporar").replace("data-visitor-locked", "data-visitor-matches").replace("temporar", "data-visitor-locked")
    site_fals(monkeypatch, **{"index.html": (200, eronat), "meciuri.html": (503, "")})
    assert S.verifica(ACUM) == ["index.html: ordinea obligatorie este gratuite, exemplul Pro, meciuri cu lacăt", "meciuri.html: HTTP 503"]


def test_monitorul_detecteaza_date_incorecte_chiar_daca_sunt_cinci_gratuite():
    meciuri = json.loads(PREDICTII)["matches"]
    meciuri[0]["match_date"] = "2026-10-16T23:00:00Z"
    meciuri[1]["fixture_id"] = meciuri[2]["fixture_id"]
    meciuri[3]["locked"] = True
    meciuri[4]["prob_draw"] = None
    erori = S.verifica_gratuite(meciuri, ACUM.date())
    assert len(erori) == 4
    assert any("duplicat" in e for e in erori)
    assert any("1/X/2" in e for e in erori)


def test_monitorul_semnaleaza_pagina_cazuta_si_limba_lipsa(monkeypatch):
    catalog = json.loads((Path(__file__).resolve().parents[1] / "assets/i18n.json").read_text())
    del catalog["en"]["visitor.home.free"]
    site_fals(monkeypatch, **{"meciuri.html": (200, CATALOG), "simulator.html": (503, ""),
                               "assets/i18n.json": (200, json.dumps(catalog))})
    assert S.verifica(ACUM) == ["i18n.json: lipsește traducerea en/visitor.home.free", "simulator.html: HTTP 503"]
