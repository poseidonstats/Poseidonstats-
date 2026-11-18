"""Etichetele localizate ale pronosticului principal din exemplul public."""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gen_pro_sample as S

RO = (
    "⚡ **Verdict:** Liderul e favorit.\n📊 **Context:** Joacă acasă.\n🧮 **Modelul:** 65% victorie.\n🎯 **Picks:**\n"
    "🔒 **Bază:** Peste 1,5 goluri — **88%**. Bedford marchează acasă.\n🎯 **Principal:** 1X — **82%**. Liderul joacă acasă.\n"
    "👁️ **De urmărit:** Startul.\n*informativ*"
)
EN = (
    "⚡ **Verdict:** The leaders are favourites.\n📊 **Context:** At home.\n🧮 **Model:** 65% win.\n🎯 **Picks:**\n"
    "🔒 **Base:** Over 1.5 goals — **88%**. Bedford score at home.\n🎯 **Main:** 1X — **82%**. The leaders are at home.\n"
    "👁️ **Watch:** The start."
)
FR = (
    "⚡ **Verdict :** Le leader est favori.\n📊 **Contexte :** À domicile.\n🧮 **Modèle :** 65 % de victoire.\n🎯 **Picks :**\n"
    "🔒 **Base :** Plus de 1,5 buts — **88%**. Bedford marque à domicile.\n🎯 **Principal :** 1X — **82%**. Le leader joue à domicile.\n"
    "👁️ **À surveiller :** Le début."
)
MECI = {
    "home": "Real Bedford",
    "away": "Stourbridge",
    "league": "Non League Premier",
    "country": "England",
    "date": "2026-10-27T18:45:00+00:00",
    "fixture_id": 1596968,
}
ITEM = {"match": MECI, "analysis": RO, "analysis_en": EN, "analysis_fr": FR}


def _variante(bloc: str) -> dict[str, str]:
    """Bucățile de HTML ale fiecărei variante [data-lang], de la deschidere până la următoarea variantă sau la sfârșitul grupului."""
    poz = [
        (m.start(), m.group(1))
        for m in re.finditer(r'<(?:div|p)\b[^>]*\bdata-lang="(\w+)"', bloc)
    ]
    return {
        cod: bloc[a : (poz[i + 1][0] if i + 1 < len(poz) else len(bloc))]
        for i, (a, cod) in enumerate(poz)
    }


def test_piata_din_linie_in_orice_limba_si_in_formatul_vechi():
    assert (
        S.piata_din_linie("🔒 **Bază:** Peste 1,5 goluri — **88%**. Bedford marchează")
        == "Peste 1,5 goluri"
    )
    assert (
        S.piata_din_linie("🔒 **Base:** Over 1.5 goals — **88%**. Bedford score")
        == "Over 1.5 goals"
    )
    assert (
        S.piata_din_linie("🔒 **Base :** Plus de 1,5 buts — **88%**.")
        == "Plus de 1,5 buts"
    )
    assert (
        S.piata_din_linie("🔒 **Bază:** **Peste 1.5 goluri — 88%.** motivul")
        == "Peste 1.5 goluri"
    )
    assert S.piata_din_linie("🎯 **Main:** 1X — **82%**. The leaders") == "1X"
    # formatul din iulie–septembrie: eticheta și piața în același bold („**Siguranță: Peste 1.5 goluri — 70%.**”)
    assert (
        S.piata_din_linie(
            "🔒 **Siguranță: Peste 1.5 goluri — 70%.** Cea mai mare probabilitate"
        )
        == "Peste 1.5 goluri"
    )
    assert (
        S.piata_din_linie(
            "🔒 **Safe pick: Over 1.5 goals — 70%.** The highest probability"
        )
        == "Over 1.5 goals"
    )


def test_cardul_pune_piata_principala_in_toate_limbile():
    item = {
        **ITEM,
        **{f"analysis_{lang}": EN for lang in ("es", "it", "id")},
        "provenance": {
            "inputs": {
                "picks": [
                    {
                        "rol": "Principal",
                        "key": "over_1_5",
                        "piata": "Peste 1,5 goluri",
                        "p": 82,
                    }
                ]
            }
        },
    }
    card = S.html_card(item, "2026-10-27", (0, 1), False)
    variants = _variante(card)
    labels = {
        "ro": "Peste 1,5 goluri în meci",
        "en": "Over 1.5 total goals",
        "es": "Más de 1,5 goles en el partido",
        "it": "Over 1,5 gol totali",
        "fr": "Plus de 1,5 buts dans le match",
        "id": "Di atas 1,5 gol total",
    }
    assert set(variants) == set(labels)
    for lang, label in labels.items():
        assert f"<strong>{label} · 82%</strong>" in variants[lang]
        assert 'data-i18n="arhiva.semn.nu"' in variants[lang]
        assert 'href="analize/2026-10-27.html#m1596968"' in variants[lang]
        assert "88%" not in variants[lang]


def test_cardul_cu_principalul_neevaluabil_are_cheie_de_traducere():
    card = S.html_card(ITEM, "2026-10-27", (0, 1))
    assert all(
        'data-i18n="arhiva.semn.neev"' in text for text in _variante(card).values()
    )


def test_cardul_fara_traduceri_pastreaza_principalul_original():
    card = S.html_card({"match": MECI, "analysis": RO}, "2026-10-27", (0, 1), False)
    assert "data-lang" not in card
    assert "<strong>1X · 82%</strong>" in card


def test_randul_ieri_are_link_catre_meciul_lui_si_nicio_selectie():
    linie = S.html_ieri(ITEM, "2026-10-27", (0, 1))
    assert "data-lang" not in linie and linie.startswith('<p class="pro-ieri"')
    assert 'href="analize/2026-10-27.html#m1596968"' in linie
    assert "Real Bedford – Stourbridge" in linie and "0-1" in linie
    assert "82%" not in linie and "88%" not in linie
