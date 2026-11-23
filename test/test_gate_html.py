import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import gate_html as G


def pagina(sentinela):
    return (
        f'<main>{sentinela}<section id="exemplu-pro"></section>'
        '<section id="dovada"></section><section id="repere-azi"></section>'
        '<section id="abonament"></section><section id="acces"></section>'
        '<section id="intrebari"></section><section id="pro-analize"></section>'
        '<div id="matches"></div><div class="plans-pro-detail"></div>'
        '<div class="ligi-links"></div><div class="legal-banner"></div>'
        + ''.join(f'<!-- {p}_START -->\n<!-- {p}_END -->' for p in (
            "PRO_SAMPLE_CARD", "PRO_SAMPLE_PREVIEW", "PRO_TODAY_LIST", "PROOF_STATIC",
            "DAILY_STATIC", "LEAGUES_LINKS",
        ))
        + '</main>'
    )


def test_pagina_compacta_accepta_lipsa_exemplului_pro():
    assert G.verifica(pagina('<section data-compact-home></section>'), None) == []


def test_pagina_compacta_verifica_markerii_ambelor_carduri():
    html = pagina('<section data-compact-home></section>')
    for rol in ("CARD", "PREVIEW"):
        marker = f"<!-- PRO_SAMPLE_{rol}_END -->"
        for schimbare in ("", marker * 2):
            assert any(f"markerii PRO_SAMPLE_{rol}:" in err for err in G.verifica(html.replace(marker, schimbare), None))


def test_pagina_veche_cere_card_chiar_daca_sentinela_apare_in_text():
    assert 'lipsește: class="pro-card"' in G.verifica(pagina('<!-- data-compact-home -->'), None)


def test_prima_pagina_respinge_regresia_la_catalog_chiar_fara_marker():
    html = pagina('<section data-compact-home></section>')
    erori = G.verifica(html, None, "index.html")
    assert any("data-home-page" in eroare for eroare in erori)
    assert any("blocuri din catalog" in eroare for eroare in erori)


def test_catalogul_cere_markeri_de_generare_si_permita_o_zi_fara_mostra():
    html = pagina('<section data-match-catalog></section>')
    assert G.verifica(html, None, "meciuri.html") == []
    assert G.verifica(html.replace("data-match-catalog", ""), None, "meciuri.html")
    assert G.verifica(html.replace("PRO_SAMPLE_PREVIEW_START", "INVALID"), None, "meciuri.html")
