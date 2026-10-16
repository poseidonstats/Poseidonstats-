"""16 oct 2026: alerta „predictions.json invalid (0)” de la 20:15 — o singură cerere fără răspuns, fișierul era bun.
O cerere fără răspuns se reîncearcă o dată; dacă pică iar, mesajul spune „fără răspuns” cu eroarea de rețea, nu „invalid”."""
import datetime as dt
import json
import sys
import urllib.error
from email.message import Message
from pathlib import Path
from zoneinfo import ZoneInfo
sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_check_live as S

ACUM = dt.datetime(2026, 10, 16, 20, 15, tzinfo=ZoneInfo("Europe/Bucharest"))
INDEX = ('<section id="exemplu-pro"></section><div class="pro-card"><div class="pro-card-head">Exemplul Pro · <span data-date>16 octombrie 2026</span></div>'
         '<ul class="pro-today"></ul></div><div class="plans-pro-detail"></div><section id="dovada"></section><section id="repere-azi">16 octombrie 2026</section>'
         '<section id="abonament"></section><div class="legal-banner"></div><span data-i18n="plans.pro.trial"></span>')
PREDICTII = json.dumps({"generated_at": "2026-10-16T02:28:11+00:00", "matches": [{"free": True}] * 5})
HEALTH = json.dumps({"predictions_full": {"generated_at": "2026-10-16T02:28:11+00:00"}, "pro": 3})


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
        if url.endswith("/data/predictions.json"):
            return 200, PREDICTII
        if url.endswith("/assets/app.js"):
            return 200, "trial-banner"
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
