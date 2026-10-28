"""Teste (înaintea codului) pentru piața de bază în limba paginii (28 oct 2026, Andreea: „Avem o greșeală de traducere”, captura cu
„The base pick, Peste 1,5 goluri, did not come true”): cardul Pro și rândul „ieri” puneau numele pieței din analiza românească în
frazele traduse. Piața vine acum din analiza tradusă a fiecărei limbi, iar româna rămâne doar pentru varianta română."""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_pro_sample as S

RO = ("⚡ **Verdict:** Liderul e favorit.\n📊 **Context:** Joacă acasă.\n🧮 **Modelul:** 65% victorie.\n🎯 **Picks:**\n"
      "🔒 **Bază:** Peste 1,5 goluri — **88%**. Bedford marchează acasă.\n🎯 **Principal:** 1X — **82%**. Liderul joacă acasă.\n"
      "👁️ **De urmărit:** Startul.\n*informativ*")
EN = ("⚡ **Verdict:** The leaders are favourites.\n📊 **Context:** At home.\n🧮 **Model:** 65% win.\n🎯 **Picks:**\n"
      "🔒 **Base:** Over 1.5 goals — **88%**. Bedford score at home.\n🎯 **Main:** 1X — **82%**. The leaders are at home.\n"
      "👁️ **Watch:** The start.")
FR = ("⚡ **Verdict :** Le leader est favori.\n📊 **Contexte :** À domicile.\n🧮 **Modèle :** 65 % de victoire.\n🎯 **Picks :**\n"
      "🔒 **Base :** Plus de 1,5 buts — **88%**. Bedford marque à domicile.\n🎯 **Principal :** 1X — **82%**. Le leader joue à domicile.\n"
      "👁️ **À surveiller :** Le début.")
MECI = {"home": "Real Bedford", "away": "Stourbridge", "league": "Non League Premier", "country": "England", "date": "2026-10-27T18:45:00+00:00",
        "fixture_id": 1596968}
ITEM = {"match": MECI, "analysis": RO, "analysis_en": EN, "analysis_fr": FR}


def _variante(bloc: str) -> dict[str, str]:
    """Bucățile de HTML ale fiecărei variante [data-lang], de la deschidere până la următoarea variantă sau la sfârșitul grupului."""
    poz = [(m.start(), m.group(1)) for m in re.finditer(r'<(?:div|p)\b[^>]*\bdata-lang="(\w+)"', bloc)]
    return {cod: bloc[a:(poz[i + 1][0] if i + 1 < len(poz) else len(bloc))] for i, (a, cod) in enumerate(poz)}


def _vars(bucata: str, cheie: str) -> dict:
    """Variabilele unui element, citite ca în browser: atributul cu entitățile decodate (&#39; → '), apoi JSON."""
    m = re.search(rf'data-i18n="{re.escape(cheie)}" data-i18n-vars=\'(.*?)\'>', bucata)
    assert m, f"lipsește {cheie}"
    return json.loads(html.unescape(m.group(1)))


def test_piata_din_linie_in_orice_limba_si_in_formatul_vechi():
    assert S.piata_din_linie("🔒 **Bază:** Peste 1,5 goluri — **88%**. Bedford marchează") == "Peste 1,5 goluri"
    assert S.piata_din_linie("🔒 **Base:** Over 1.5 goals — **88%**. Bedford score") == "Over 1.5 goals"
    assert S.piata_din_linie("🔒 **Base :** Plus de 1,5 buts — **88%**.") == "Plus de 1,5 buts"
    assert S.piata_din_linie("🔒 **Bază:** **Peste 1.5 goluri — 88%.** motivul") == "Peste 1.5 goluri"
    assert S.piata_din_linie("🎯 **Main:** 1X — **82%**. The leaders") == "1X"
    # formatul din iulie–septembrie: eticheta și piața în același bold („**Siguranță: Peste 1.5 goluri — 70%.**”)
    assert S.piata_din_linie("🔒 **Siguranță: Peste 1.5 goluri — 70%.** Cea mai mare probabilitate") == "Peste 1.5 goluri"
    assert S.piata_din_linie("🔒 **Safe pick: Over 1.5 goals — 70%.** The highest probability") == "Over 1.5 goals"


def test_cardul_pune_piata_de_baza_in_limba_fiecarei_variante():
    card = S.html_card(ITEM, "2026-10-27", "2026-10-27T07:25:00", (0, 1), "Peste 1,5 goluri", False)
    v = _variante(card)
    assert set(v) == {"ro", "en", "fr"}
    assert _vars(v["ro"], "pro.card.verif.nu") == {"p": "Peste 1,5 goluri"}
    assert _vars(v["en"], "pro.card.verif.nu") == {"p": "Over 1.5 goals"}
    assert _vars(v["fr"], "pro.card.verif.nu") == {"p": "Plus de 1,5 buts"}
    # linkul spre verificare rămânea „Verificarea completă →” în toate limbile
    assert card.count('data-i18n="pro.card.verif.link">Verificarea completă →</a>') == 3
    dictionar = json.loads((Path(__file__).resolve().parent.parent / "assets" / "i18n.json").read_text(encoding="utf-8"))
    assert all(dictionar[limba].get("pro.card.verif.link") for limba in ("ro", "en", "es", "it", "fr", "id"))


def test_cardul_cu_baza_neevaluabila_are_si_el_cheie_de_traducere():
    card = S.html_card(ITEM, "2026-10-27", "2026-10-27T07:25:00", (0, 1), "Peste 1,5 goluri", None)
    v = _variante(card)
    assert _vars(v["ro"], "pro.card.verif.neev") == {"p": "Peste 1,5 goluri"}
    assert _vars(v["en"], "pro.card.verif.neev") == {"p": "Over 1.5 goals"}
    dictionar = json.loads((Path(__file__).resolve().parent.parent / "assets" / "i18n.json").read_text(encoding="utf-8"))
    for limba in ("ro", "en", "es", "it", "fr", "id"):
        assert "{p}" in dictionar[limba]["pro.card.verif.neev"], limba


def test_cardul_fara_traduceri_ramane_cum_era():
    card = S.html_card({"match": MECI, "analysis": RO}, "2026-10-27", "2026-10-27T07:25:00", (0, 1), "Peste 1,5 goluri", False)
    assert "data-lang" not in card
    assert _vars(card, "pro.card.verif.nu") == {"p": "Peste 1,5 goluri"}


def test_randul_ieri_are_piata_in_limba_fiecarei_variante():
    linie = S.html_ieri(ITEM, "2026-10-27", (0, 1), "Peste 1,5 goluri", False)
    v = _variante(linie)
    assert set(v) == {"ro", "en", "fr"}
    assert "data-lang-grup" in linie and ' hidden' in v["en"] and ' hidden' not in v["ro"].split(">")[0]
    for cod, piata in (("ro", "Peste 1,5 goluri"), ("en", "Over 1.5 goals"), ("fr", "Plus de 1,5 buts")):
        baza = _vars(v[cod], "pro.ieri.cu")["baza"]
        assert f'data-i18n-vars=\'{{"b":"{piata}"}}\'' in baza, (cod, baza)


def test_randul_ieri_fara_traduceri_ramane_un_singur_paragraf():
    linie = S.html_ieri({"match": MECI, "analysis": RO}, "2026-10-27", (0, 1), "Peste 1,5 goluri", False)
    assert "data-lang" not in linie and linie.startswith('<p class="pro-ieri"')
    assert '"b":"Peste 1,5 goluri"' in _vars(linie, "pro.ieri.cu")["baza"]
