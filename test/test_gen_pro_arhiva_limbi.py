"""Teste (înaintea codului) pentru arhiva analizelor în limba paginii (28 oct 2026, Andreea: „Avem o greșeală de traducere”): variantele
traduse primeau pick-urile, tabelul de verificare și lecția din analiza românească, iar rândul „Model înainte de meci” lipea etichetele
în română („Peste 1.5”, „scor probabil”) în fraza tradusă."""

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_pro_arhiva as A

RO = (
    "⚡ **Verdict:** Liderul e favorit.\n📊 **Context:** Joacă acasă.\n🧮 **Modelul:** 65% victorie.\n🎯 **Picks:**\n"
    "🔒 **Bază:** Peste 1,5 goluri — **88%**. Bedford marchează acasă.\n🎯 **Principal:** 1X — **82%**. Liderul joacă acasă.\n"
    "💎 fără pick curajos azi\n👁️ **De urmărit:** Startul.\n*informativ*"
)
EN = (
    "⚡ **Verdict:** The leaders are favourites.\n📊 **Context:** At home.\n🧮 **Model:** 65% win.\n🎯 **Picks:**\n"
    "🔒 **Base:** Over 1.5 goals — **88%**. Bedford score at home.\n🎯 **Main:** 1X — **82%**. The leaders are at home.\n"
    "💎 no bold pick today\n👁️ **Watch:** The start."
)
MECI = {
    "home": "Real Bedford",
    "away": "Stourbridge",
    "league": "Non League Premier",
    "country": "England",
    "date": "2026-10-27T18:45:00+00:00",
    "fixture_id": 1596968,
    "p_home": 65,
    "p_draw": 20,
    "p_away": 15,
    "over15": 85,
    "over25": 66,
    "btts": 53,
    "score": "2-0",
    "xg_home": 2.49,
    "xg_away": 1.21,
}
ITEM = {"match": MECI, "analysis": RO, "analysis_en": EN}
REZ = {"gh": 0, "ga": 1, "hth": 0, "hta": 0}
GENERAT = "2026-10-27T07:25:00"
LIMBI = ("ro", "en", "es", "it", "fr", "id")
DICTIONAR = json.loads(
    (Path(__file__).resolve().parent.parent / "assets" / "i18n.json").read_text(
        encoding="utf-8"
    )
)


def _vars(bucata: str, cheie: str) -> dict:
    """Variabilele unui element, citite ca în browser: atributul cu entitățile decodate, apoi JSON."""
    m = re.search(rf'data-i18n="{re.escape(cheie)}" data-i18n-vars=\'(.*?)\'>', bucata)
    assert m, f"lipsește {cheie}"
    return json.loads(html.unescape(m.group(1)))


def _text_vizibil(bucata: str) -> str:
    """Textul pe care îl vede vizitatorul fără elementele [data-i18n], al căror conținut îl înlocuiește dicționarul la rulare."""
    fara = re.sub(
        r'<(\w+)[^>]*\bdata-i18n="[^"]+"[^>]*>.*?</\1>', " ", bucata, flags=re.S
    )
    return " ".join(re.sub(r"<[^>]+>", " ", fara).split())


def test_randul_cu_cifrele_modelului_are_etichete_traductibile_si_json_valid():
    v = A.verifica(ITEM, REZ)
    cifre = _vars(A.html_analiza(ITEM, v, GENERAT), "arhiva.model.arhivat")["cifre"]
    for cheie, ro in (
        ("ligi.tm.o15", "Peste 1.5"),
        ("ligi.tm.o25", "Peste 2.5"),
        ("arhiva.cifre.gg", "GG"),
        ("arhiva.cifre.scor", "scor probabil"),
    ):
        assert f'<span data-i18n="{cheie}">{ro}</span>' in cifre
    assert (
        re.sub(r"<[^>]+>", "", cifre)
        == "1 65% · X 20% · 2 15% · Peste 1.5 85% · Peste 2.5 66% · GG 53% · scor probabil 2-0"
    )
    for limba in LIMBI:
        assert DICTIONAR[limba].get("arhiva.cifre.gg") and DICTIONAR[limba].get(
            "arhiva.cifre.scor"
        ), limba


def test_varianta_engleza_are_pickurile_si_tabelul_in_engleza():
    v = A.verifica(ITEM, REZ)
    en = A.html_analiza({**ITEM, "analysis": EN}, v, GENERAT, "en")
    assert (
        "Over 1.5 goals" in en
        and "<td>Base</td><td>Over 1.5 goals</td><td>88%</td>" in en
    )
    assert "<td>Main</td><td>1X</td><td>82%</td>" in en
    romana = re.findall(
        r"\b(Peste|goluri|Bază|Principal|marchează|ieșit|Liderul)\b", _text_vizibil(en)
    )
    assert romana == [], romana


def test_varianta_romana_ramane_cum_era():
    v = A.verifica(ITEM, REZ)
    ro = A.html_analiza(ITEM, v, GENERAT)
    assert "<li>Bază: <strong>Peste 1,5 goluri</strong> — 88%" in ro
    assert "<td>Bază</td><td>Peste 1,5 goluri</td><td>88%</td>" in ro


def test_lectia_se_traduce_pe_fraze_si_textul_romanesc_ramane_acelasi():
    v = A.verifica(ITEM, REZ)
    assert v["lectie"] == (
        "Modelul a supraestimat golurile: aștepta 3.7, au fost 1. Rezultatului care s-a produs (2) modelul îi dădea 15% "
        "înainte de meci. Probabilitățile nu se modifică retroactiv."
    )
    en = A.html_analiza({**ITEM, "analysis": EN}, v, GENERAT, "en")
    assert _vars(en, "arhiva.lectie.supra") == {"a": "3.7", "b": "1"}
    assert _vars(en, "arhiva.lectie.rezultat") == {"s": "2", "p": "15"}
    assert 'data-i18n="arhiva.lectie.retro"' in en
    for cheie in (
        "confirmat",
        "principal",
        "principal0",
        "supra",
        "sub",
        "baza",
        "amestecat",
        "neev",
        "rezultat",
        "retro",
    ):
        ro = DICTIONAR["ro"][f"arhiva.lectie.{cheie}"]
        for limba in LIMBI:
            text = DICTIONAR[limba].get(f"arhiva.lectie.{cheie}")
            assert text and sorted(re.findall(r"\{\w+\}", text)) == sorted(
                re.findall(r"\{\w+\}", ro)
            ), (limba, cheie)


def test_formatul_vechi_al_pickurilor_se_traduce_si_in_tabel():
    """Analizele din iulie–septembrie au eticheta și piața în același bold: „🔒 **Siguranță: Peste 1.5 goluri — 70%.** motiv”."""
    ro = RO.replace(
        "🔒 **Bază:** Peste 1,5 goluri — **88%**. Bedford marchează acasă.",
        "🔒 **Siguranță: Peste 1.5 goluri — 70%.** Bedford marchează acasă.",
    )
    en = EN.replace(
        "🔒 **Base:** Over 1.5 goals — **88%**. Bedford score at home.",
        "🔒 **Safe pick: Over 1.5 goals — 70%.** Bedford score at home.",
    )
    assert (
        A.eticheta_din_linie("🔒 **Safe pick: Over 1.5 goals — 70%.** Bedford")
        == "Safe pick"
    )
    item = {**ITEM, "analysis": ro, "analysis_en": en}
    html_en = A.html_analiza(
        {**item, "analysis": en}, A.verifica(item, REZ), GENERAT, "en"
    )
    assert "<td>Safe pick</td><td>Over 1.5 goals</td><td>70%</td>" in html_en
    romana = re.findall(r"\b(Peste|goluri|Bază|Siguranță)\b", _text_vizibil(html_en))
    assert romana == [], romana


def test_pagina_zilei_trimite_limba_fiecarei_variante():
    pagina = A.html_zi(
        {"zi": "2026-10-27", "generat": GENERAT, "items": [ITEM]},
        {1596968: REZ},
        None,
        None,
    )
    en = pagina[pagina.index('<div data-lang="en"') :]
    assert "<td>Base</td><td>Over 1.5 goals</td>" in en
