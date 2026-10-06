"""Teste (înaintea codului) pentru gen_pro_sample: exemplul de analiză Pro de pe site, reîmprospătat zilnic cu analiza de ieri + rezultatul real."""
import pytest

import gen_pro_sample as G

TEXT = """## 💎 ESMTK – Dabas · NB III - Southeast · 2026-09-27

⚡ **Verdict:** ESMTK (locul 4, 15p) primește o Dabas în cădere liberă. Modelul dă 78% gazdelor.

📊 **Context:** ESMTK 4 (17:9) vs Dabas 10 (12:18). Forma gazdelor: 3 victorii. H2H: ESMTK a luat 4 din 5. Fără absențe.

🧮 **Modelul vs realitate:** Datele verificate confirmă modelul, nu îl contrazic.

🎯 **Picks:**
🔒 **Bază:** 1X (ESMTK nu pierde) — **91%**. Cea mai mare probabilitate din meci.
🎯 **Principal:** Peste 1.5 goluri — **86%**. Banda 85-100% a livrat 87.1%.
💎 **Curajos:** Peste 2.5 goluri — **68%** *(pick de cotă, cu risc asumat)*.
*(Informativ: modelul indică 2-0 ca scor cel mai probabil.)*

👁️ **De urmărit:** Dacă Dabas înscrie prima, ESMTK se deschide.

*informativ · nu sfat de pariere · 18+* """


def test_parseaza_sectiunile():
    p = G.parseaza(TEXT)
    assert p["verdict"].startswith("ESMTK (locul 4, 15p)") and "78%" in p["verdict"]
    assert p["context"].startswith("ESMTK 4 (17:9)") and p["model"].startswith("Datele verificate")
    assert p["picks"][0].startswith("🔒") and len(p["picks"]) == 3 and p["urmarit"].startswith("Dacă Dabas")
    assert G.piata_baza(p["picks"]) == "1X (ESMTK nu pierde)"


@pytest.mark.parametrize("piata,scor,ok", [
    ("1X (ESMTK nu pierde)", (6, 0), True), ("1X", (0, 1), False), ("X2", (1, 1), True), ("12", (2, 2), False),
    ("Peste 1.5 goluri", (1, 0), False), ("Peste 1.5 goluri", (2, 0), True), ("Sub 2.5 goluri", (1, 1), True), ("Sub 2,5 goluri", (2, 1), False),
    ("Ambele înscriu", (1, 1), True), ("GG", (1, 0), False), ("Victorie gazde", (2, 1), True), ("2 (Dabas câștigă)", (0, 3), True),
    ("ESMTK peste 0.5 goluri", (1, 0), None), ("Egal", (1, 1), True),
])
def test_evalueaza_piata(piata, scor, ok):
    assert G.evalueaza(piata, *scor) is ok


def test_alege_prefera_analiza_cu_baza_iesita_si_rezultat_cunoscut():
    items = [{"match": {"fixture_id": 1, "home": "A", "away": "B"}, "analysis": TEXT.replace("1X (ESMTK nu pierde)", "2 (B câștigă)")},
             {"match": {"fixture_id": 2, "home": "C", "away": "D"}, "analysis": TEXT},
             {"match": {"fixture_id": 3, "home": "E", "away": "F"}, "analysis": TEXT}]
    rez = {1: (3, 0), 3: (2, 0)}                                     # fid 2 fără rezultat; fid 1 baza a picat; fid 3 baza a ieșit
    it, scor, baza, ok = G.alege(items, rez)
    assert it["match"]["fixture_id"] == 3 and scor == (2, 0) and baza == "1X (ESMTK nu pierde)" and ok is True
    it, scor, baza, ok = G.alege(items[:1], rez)                     # doar una cu rezultat, chiar dacă baza a picat
    assert it["match"]["fixture_id"] == 1 and ok is False
    assert G.alege([items[1]], rez) is None                           # fără rezultat → nimic de publicat


def test_html_card_are_scorul_verdictul_si_partea_blocata():
    it = {"match": {"fixture_id": 3, "home": "ESMTK", "away": "Dabas", "league": "NB III - Southeast", "country": "Hungary", "date": "2026-09-27"}, "analysis": TEXT}
    h = G.html_card(it, "2026-09-27", "2026-09-27T07:30:00", (6, 0), "1X (ESMTK nu pierde)", True)
    assert "ESMTK – Dabas" in h and "27 septembrie 2026" in h and "rezultat final 6-0" in h
    # 2 oct 2026: cardul e analiza completă, fără lacăt; verificarea stă sub el
    assert "a ieșit" in h and 'href="analize/2026-09-27.html#m3"' in h and "1X (ESMTK nu pierde)" in h
    assert "a ieșit" in h and "**" not in h and "<strong>91%</strong>" in h
    assert "<script" not in h and "&lt;" not in G.html_card(it, "2026-09-27", "2026-09-27T07:30:00", (6, 0), "1X", None)


def test_injecteaza_refuza_fara_markeri_si_e_idempotent_cu_markeri():
    # 6 oct 2026: fără markeri → abort (fallback-ul vechi ștergea blocul „Ce primești pentru 20 $” dintre .pro-card și .pro-disclaimer)
    import pytest
    vechi = ('  <section class="pro-sample">\n    <div class="pro-card">VECHI</div>\n    <div class="plans-pro-detail">BANI</div>\n'
             '    <p class="pro-disclaimer" data-i18n="pro.disclaimer">d</p>\n  </section>\n')
    with pytest.raises(SystemExit):
        G.injecteaza(vechi, '<div class="pro-card">NOU</div>')
    cu = vechi.replace('<div class="pro-card">VECHI</div>', f'{G.START}\n    <div class="pro-card">VECHI</div>\n    {G.END}')
    nou = G.injecteaza(cu, '<div class="pro-card">NOU</div>')
    assert "VECHI" not in nou and "NOU" in nou and "BANI" in nou and 'data-i18n="pro.disclaimer"' in nou
    nou2 = G.injecteaza(nou, '<div class="pro-card">NOU2</div>')
    assert "NOU2" in nou2 and "NOU<" not in nou2 and "BANI" in nou2 and nou2.count(G.START) == 1 and nou2.count(G.END) == 1


def test_piata_baza_scoate_steluțele_din_formatul_real():
    assert G.piata_baza(["🔒 **Bază:** **Peste 1.5 goluri — 88%.** text"]) == "Peste 1.5 goluri"
    assert G.piata_baza(["🔒 **Bază:** 1X (dublă șansă) — **91%**"]) == "1X (dublă șansă)"
    assert G.evalueaza(G.piata_baza(["🔒 **Bază:** **Peste 1.5 goluri — 88%.**"]), 1, 1) is True


def test_lista_pro_azi_cu_lacat_si_injectare_idempotenta():
    rows = [{"home": "ESMTK", "away": "Dabas", "league": "NB III - Southeast", "country": "Hungary", "date": "2026-09-28", "match_date": "2026-09-28T13:00:00Z"},
            {"home": "Kassel", "away": "Hanau", "league": "Oberliga - Hessen", "country": "Germany", "date": "2026-09-28", "match_date": "2026-09-28T16:00:00Z"}]
    h = G.html_lista_pro(rows)
    assert "2 analize" in h and "ESMTK – Dabas" in h and "Kassel – Hanau" in h and "16:00" in h and "19:00" in h and h.count("🔒") >= 2 and "<script" not in h
    assert G.html_lista_pro([]) == ""
    pagina = "<section class=\"pro-sample\">\n    " + G.START + "\n    card\n    " + G.END + "\n    <p class=\"pro-disclaimer\" data-i18n=\"pro.disclaimer\">d</p>\n  </section>"
    p1 = G.injecteaza_lista(pagina, "<div class='pro-today'>L1</div>")
    assert "L1" in p1 and G.LISTA_START in p1 and p1.index(G.END) < p1.index(G.LISTA_START) < p1.index("pro-disclaimer")
    p2 = G.injecteaza_lista(p1, "<div class='pro-today'>L2</div>")
    assert "L2" in p2 and "L1" not in p2 and p2.count(G.LISTA_START) == 1
    assert G.injecteaza_lista(p2, "") == p2                                                  # fără listă → pagina rămâne
