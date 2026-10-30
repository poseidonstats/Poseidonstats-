#!/usr/bin/env python3
"""Conținut static zilnic pentru SEO — rulat de daily_publish.sh la fiecare publish.

Face trei lucruri:
  1. Rescrie secțiunea dintre markerii DAILY_STATIC din index.html cu numărul
     meciurilor zilei și accesul la filtre. Vizitatorul alege piața; nu generăm
     un pariu principal sau un clasament după probabilitate.
  2. Rescrie secțiunea dintre markerii PROOF_STATIC din index.html cu tabelul
     „ce s-a adeverit" din data/history.json (cumulated_markets) — dovada de
     conversie de pe homepage, statică pentru crawler și niciodată inventată.
  3. Actualizează <lastmod> în sitemap.xml pentru paginile cu changefreq daily
     (era înghețat la 2026-06-11 — semnal de site mort pentru crawler).

26 oct 2026: rezumatul zilei nu mai selectează automat piețe. Tabelul istoric
și cifrele lui rămân neschimbate.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from zoneinfo import ZoneInfo


def zi_ro(iso: str) -> str:
    """Ziua României (AAAA-LL-ZZ) a unui moment ISO UTC („2026-10-24T21:30:00Z” → „2026-10-25”); fără dată validă → primele 10 caractere."""
    try:
        t = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return t.astimezone(ZoneInfo("Europe/Bucharest")).date().isoformat()
    except ValueError:
        return str(iso)[:10]


SITE = Path.home() / "poseidon-site"
PRED = SITE / "data" / "predictions.json"
HIST = SITE / "data" / "history.json"
AUDIT = SITE / "data" / "audit.json"
I18N = SITE / "assets" / "i18n.json"
INDEX = SITE / "index.html"
SITEMAP = SITE / "sitemap.xml"

START = "<!-- DAILY_STATIC_START -->"
END = "<!-- DAILY_STATIC_END -->"
PROOF_START = "<!-- PROOF_STATIC_START -->"
PROOF_END = "<!-- PROOF_STATIC_END -->"

# tier → clasă badge; identic cu maparea din assets/app.js (renderIstoric)
TIER_CLASS = {
    "STRONG ROBUST": "tier-elite",
    "ROBUST": "tier-strong",
    "PROMISING": "tier-good",
    "PRE-PROMISING": "tier-mid",
    "DROP": "tier-drop",
}

RO_MONTHS = [
    "",
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
]


def bucharest_today() -> datetime:
    return datetime.now(ZoneInfo("Europe/Bucharest"))


def build_section() -> str:
    d = bucharest_today()
    date_ro = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    data = json.loads(PRED.read_text())
    matches = data["matches"] if isinstance(data, dict) and "matches" in data else data
    # Numără aceeași zi RO ca înainte, fără selecție pe piață sau probabilitate.
    n_today = sum(
        zi_ro(m.get("match_date", "")) == d.date().isoformat() for m in matches
    )
    lines = [
        START,
        '  <section class="daily-static" id="repere-azi">',
        f'    <h2 data-i18n="repere.h2" data-i18n-vars=\'{{"data":"<span data-date=\\"{d.date().isoformat()}\\">{date_ro}</span>"}}\'>Predicții fotbal azi — <span data-date="{d.date().isoformat()}">{date_ro}</span></h2>',
    ]
    lines.append(
        f'    <p data-i18n="repere.p" data-i18n-vars=\'{{"n":"{n_today}"}}\'>Modelul a analizat azi {n_today} meciuri. '
        "Alege meciul și piața care te interesează din lista completă.</p>"
    )
    lines.append(
        '    <p><a href="#matches" data-i18n="repere.link">Vezi meciurile și filtrele</a></p>'
    )
    lines.append(
        '    <p class="pro-disclaimer" data-i18n="repere.disclaimer">probabilități calibrate empiric · informativ · '
        "nu sfat de pariere · 18+</p>"
    )
    lines.append("  </section>")
    lines.append("  " + END)
    return "\n".join(lines)


# Pragurile de afișare (build_public_json.market_def): N din tabel = predicțiile cu probabilitate ≥ prag, NU toate predicțiile (29 sept 2026).
PRAG_AFISARE = {
    "Over 1.5": 75,
    "Over 2.5": 65,
    "Over 3.5": 65,
    "BTTS Da": 65,
    "HT Over 0.5": 65,
    "HT Over 1.5": 65,
}


def _metrici_paragraf() -> str:
    """7 oct 2026: Brier, log loss, ECE și testul contra prețului de închidere, pe prima pagină (ChatGPT ne citea doar
    prima pagină și spunea că „lipsesc"). Cifrele vin din data/audit.json; textul în 4 limbi e scris și în i18n.json."""
    try:
        a = json.loads(AUDIT.read_text())
        P = {x["cheie"]: x for x in a["piete"]}
        V = a["vs_piata"]
    except Exception as e:
        print(
            f"[gen_static_daily] audit.json indisponibil ({e}) — fără paragraful de metrici"
        )
        return ""
    def ro(x, d=3):
        return f"{x:.{d}f}".replace(".", ",")
    n = f"{a['n_rezolvate']:,}".replace(",", ".")
    o15, o25, gg = P["over_1_5"], P["over_2_5"], P["btts"]
    v = V["over_2_5"]
    nv = f"{v['n']:,}".replace(",", ".")
    castig = v["informatie"]["castig_ll"]
    T = {
        "ro": f'<strong>Metrici pe toate cele {n} de predicții rezolvate</strong> (din 2 iunie 2026, nu doar cele peste prag): peste 1,5 — Brier {ro(o15["brier"])}, log loss {ro(o15["log_loss"])}, eroare de calibrare {ro(o15["ece"], 1)} pp · peste 2,5 — Brier {ro(o25["brier"])}, log loss {ro(o25["log_loss"])}, ECE {ro(o25["ece"], 2)} pp · GG — Brier {ro(gg["brier"])}, log loss {ro(gg["log_loss"])}. Test contra prețului de închidere al pieței, pe {nv} meciuri (peste 2,5): Brier model {ro(v["brier_model"])} față de piață {ro(v["brier_piata"])}; ce adaugă modelul peste preț: {ro(castig, 4)} log loss. <strong>Diferență descriptivă; acest test nu demonstrează un avantaj predictiv general.</strong> Diagrama de fiabilitate, Brier și log loss pe fiecare piață și jurnalul CSV cu ora înghețării fiecărei predicții: <a href="track-record.html">track record</a>.',
        "en": f"<strong>Metrics on all {a['n_rezolvate']:,} resolved predictions</strong> (since 2 June 2026, not just those above the threshold): over 1.5 — Brier {o15['brier']:.3f}, log loss {o15['log_loss']:.3f}, calibration error {o15['ece']:.1f} pp · over 2.5 — Brier {o25['brier']:.3f}, log loss {o25['log_loss']:.3f}, ECE {o25['ece']:.2f} pp · BTTS — Brier {gg['brier']:.3f}, log loss {gg['log_loss']:.3f}. Tested against the market's closing price on {v['n']:,} matches (over 2.5): model Brier {v['brier_model']:.3f} vs market {v['brier_piata']:.3f}; what the model adds on top of the price: {castig:+.4f} log loss. <strong>Descriptive difference; this test does not establish a general predictive advantage.</strong> Reliability diagram, Brier and log loss per market, and the CSV journal with each prediction's freeze time: <a href=\"track-record.html\">track record</a>.",
        "es": f'<strong>Métricas sobre las {n} predicciones resueltas</strong> (desde el 2 de junio de 2026, no solo las que superan el umbral): más de 1,5 — Brier {ro(o15["brier"])}, log loss {ro(o15["log_loss"])}, error de calibración {ro(o15["ece"], 1)} pp · más de 2,5 — Brier {ro(o25["brier"])}, log loss {ro(o25["log_loss"])}, ECE {ro(o25["ece"], 2)} pp · ambos marcan — Brier {ro(gg["brier"])}, log loss {ro(gg["log_loss"])}. Comparado con el precio de cierre del mercado en {nv} partidos (más de 2,5): Brier modelo {ro(v["brier_model"])} frente a mercado {ro(v["brier_piata"])}; lo que el modelo añade sobre el precio: {ro(castig, 4)} log loss. <strong>Diferencia descriptiva; esta prueba no demuestra una ventaja predictiva general.</strong> Diagrama de fiabilidad, Brier y log loss por mercado y el diario CSV con la hora de congelación: <a href="track-record.html">track record</a>.',
        "fr": f"<strong>Métriques sur les {n.replace('.', ' ')} prédictions résolues</strong> (depuis le 2 juin 2026, pas seulement celles au-dessus du seuil) : plus de 1,5 — Brier {ro(o15['brier'])}, log loss {ro(o15['log_loss'])}, erreur de calibration {ro(o15['ece'], 1)} pp · plus de 2,5 — Brier {ro(o25['brier'])}, log loss {ro(o25['log_loss'])}, ECE {ro(o25['ece'], 2)} pp · BTTS — Brier {ro(gg['brier'])}, log loss {ro(gg['log_loss'])}. Test contre le prix de clôture du marché, sur {nv.replace('.', ' ')} matchs (plus de 2,5) : Brier modèle {ro(v['brier_model'])} contre marché {ro(v['brier_piata'])} ; ce que le modèle ajoute au-delà du prix : {ro(castig, 4)} de log loss. <strong>Écart descriptif ; ce test ne démontre pas un avantage prédictif général.</strong> Diagramme de fiabilité, Brier et log loss par marché, et le journal CSV avec l'heure de gel de chaque prédiction : <a href=\"track-record.html\">track record</a>.",
        "id": f'<strong>Metrik pada semua {n} prediksi yang selesai</strong> (sejak 2 Juni 2026, bukan hanya yang di atas ambang): over 1,5 — Brier {ro(o15["brier"])}, log loss {ro(o15["log_loss"])}, kesalahan kalibrasi {ro(o15["ece"], 1)} pp · over 2,5 — Brier {ro(o25["brier"])}, log loss {ro(o25["log_loss"])}, ECE {ro(o25["ece"], 2)} pp · BTTS — Brier {ro(gg["brier"])}, log loss {ro(gg["log_loss"])}. Diuji terhadap harga penutupan pasar pada {nv} pertandingan (over 2,5): Brier model {ro(v["brier_model"])} vs pasar {ro(v["brier_piata"])}; apa yang ditambahkan model di atas harga: {ro(castig, 4)} log loss. <strong>Perbedaan deskriptif; pengujian ini tidak membuktikan keunggulan prediksi umum.</strong> Diagram keandalan, Brier dan log loss per pasar, dan jurnal CSV dengan waktu pembekuan setiap prediksi: <a href="track-record.html">track record</a>.',
        "it": f'<strong>Metriche su tutte le {n} previsioni risolte</strong> (dal 2 giugno 2026, non solo quelle sopra soglia): over 1,5 — Brier {ro(o15["brier"])}, log loss {ro(o15["log_loss"])}, errore di calibrazione {ro(o15["ece"], 1)} pp · over 2,5 — Brier {ro(o25["brier"])}, log loss {ro(o25["log_loss"])}, ECE {ro(o25["ece"], 2)} pp · GG — Brier {ro(gg["brier"])}, log loss {ro(gg["log_loss"])}. Testato contro il prezzo di chiusura del mercato su {nv} partite (over 2,5): Brier modello {ro(v["brier_model"])} contro mercato {ro(v["brier_piata"])}; ciò che il modello aggiunge al prezzo: {ro(castig, 4)} log loss. <strong>Differenza descrittiva; questo test non dimostra un vantaggio predittivo generale.</strong> Diagramma di affidabilità, Brier e log loss per mercato e il diario CSV con l\'ora di congelamento: <a href="track-record.html">track record</a>.',
    }
    qualified = {
        "ro": (
            "din 2 iunie 2026",
            "Cohortă eligibilă: calibration_available și evaluation_eligible; reconstrucție din snapshot brut și versiune Platt arhivată disponibilă, nu dovada paginii originale servite.",
        ),
        "en": (
            "since 2 June 2026",
            "Eligible cohort: calibration_available and evaluation_eligible; reconstruction from raw snapshots and available archived Platt versions, not proof of the original served page.",
        ),
        "es": (
            "desde el 2 de junio de 2026",
            "Cohorte elegible: calibration_available y evaluation_eligible; reconstrucción de datos brutos y versiones Platt archivadas disponibles, no prueba de la página original publicada.",
        ),
        "it": (
            "dal 2 giugno 2026",
            "Coorte idonea: calibration_available e evaluation_eligible; ricostruzione da dati grezzi e versioni Platt archiviate disponibili, non prova della pagina originale pubblicata.",
        ),
        "fr": (
            "depuis le 2 juin 2026",
            "Cohorte admissible : calibration_available et evaluation_eligible ; reconstruction depuis les données brutes et versions Platt archivées disponibles, pas une preuve de la page originale servie.",
        ),
        "id": (
            "sejak 2 Juni 2026",
            "Kohor layak: calibration_available dan evaluation_eligible; rekonstruksi dari data mentah dan versi Platt arsip tersedia, bukan bukti halaman asli yang diterbitkan.",
        ),
    }
    period = f"{a.get('de_la')}–{a.get('pana_la')}"
    for language, (old_period, note) in qualified.items():
        T[language] = T[language].replace(old_period, period) + " " + note
    try:
        d = json.loads(I18N.read_text(encoding="utf-8"))
        for lang, txt in T.items():
            d.setdefault(lang, {})["proof.metrici"] = txt
        I18N.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[gen_static_daily] i18n.json: nu pot scrie proof.metrici ({e})")
    return f'    <p class="proof-note proof-metrici" data-i18n="proof.metrici">{T["ro"]}</p>'


def build_proof_section() -> str | None:
    """Tabelul „ce s-a adeverit" din jurnalul forward (history.json).

    Cifrele NU se ating: hit_pct / wlo_pct / tier vin exact așa cum le-a scris
    pipeline-ul. Rândul DROP se afișează deliberat — e diferențiatorul de brand
    (arătăm și piața pe care modelul NU prezice bine). Fără history.json valid →
    None, iar update_proof() lasă secțiunea existentă neatinsă.
    """
    try:
        data = json.loads(HIST.read_text())
    except (OSError, ValueError):
        return None
    markets = data.get("cumulated_markets") or []
    if not markets:
        return None

    d = bucharest_today()
    date_ro = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    rows = []
    for m in markets:
        tier = str(m.get("tier", ""))
        cls = TIER_CLASS.get(tier, "tier-noise")
        tr_cls = ' class="is-drop"' if tier == "DROP" else ""
        n_ro = f"{m['n']:,}".replace(",", ".")  # separator de mii românesc
        rows.append(
            f"          <tr{tr_cls}>"
            f"<td><strong>{m['name']}</strong>"
            + (
                f' <small class="proof-prag">≥ {PRAG_AFISARE[m["name"]]} %</small>'
                if m["name"] in PRAG_AFISARE
                else ""
            )
            + "</td>"
            f"<td>{n_ro}</td>"
            f'<td class="hit">{m["hit_pct"]:.1f}%</td>'
            f"<td>{m['wlo_pct']:.1f}%</td>"
            f'<td><span class="tier-badge {cls}">{tier}</span></td>'
            f"</tr>"
        )

    return "\n".join(
        [
            PROOF_START,
            '  <section class="proof" id="dovada">',
            '    <h2 data-i18n="proof.h2">Ce s-a adeverit, din predicții înghețate</h2>',
            '    <p class="proof-lead" data-i18n="proof.lead">Cohortă calibrată eligibilă, reconstruită din snapshot-uri brute înghețate '
            "și versiuni Platt arhivate disponibile înaintea lor. Lipsa provenienței este exclusă; "
            "nu certificăm conținutul exact servit sau toate intrările istorice. Originalele rămân păstrate.</p>",
            '    <div class="proof-table-wrap">',
            '      <table class="proof-table">',
            "        <thead><tr>",
            '          <th data-i18n="proof.th.market">Piață</th>',
            '          <th data-i18n="proof.th.n">Selecții peste prag, rezolvate</th>',
            '          <th data-i18n="proof.th.hit">S-au adeverit</th>',
            '          <th data-i18n="proof.th.wlo">Minim statistic (Wilson 95%)</th>',
            '          <th data-i18n="proof.th.tier">Verdict propriu</th>',
            "        </tr></thead>",
            "        <tbody>",
            *rows,
            "        </tbody>",
            "      </table>",
            "    </div>",
            '    <p class="proof-note" data-i18n="proof.note">Rândul roșu e aici intenționat: acolo '
            "modelul <strong>nu</strong> prezice suficient de bine, iar noi îl marcăm <strong>DROP</strong> "
            "în propriul nostru tabel. Un site care îți arată doar ce a mers nu-ți arată nimic.</p>",
            '    <p class="proof-note" data-i18n="proof.note2">N = doar selecțiile la care probabilitatea a trecut pragul din dreptul pieței, nu toate predicțiile; '
            'cifrele pe toate predicțiile, piață cu piață, sunt în auditul de pe track record. „Verdict propriu" ține de mărimea eșantionului și de limita '
            "Wilson, <strong>nu</strong> de avantajul peste rata naturală a pieței. Tabelul complet, "
            'bucket cu bucket: <a href="track-record.html">track record</a> · '
            '<a href="istoric.html">istoric zi cu zi</a>.</p>',
            _metrici_paragraf(),
            f'    <p class="proof-asof" data-i18n="proof.asof" data-i18n-vars=\'{{"data":"<span data-date=\\"{d.date().isoformat()}\\">{date_ro}</span>"}}\'>Cifre din jurnalul forward, actualizate <span data-date="{d.date().isoformat()}">{date_ro}</span> · '
            "informativ · nu sfat de pariere · 18+</p>",
            "  </section>",
            "  " + PROOF_END,
        ]
    )


def update_proof() -> None:
    html = INDEX.read_text()
    if PROOF_START not in html or PROOF_END not in html:
        print(f"[gen_static_daily] markerii {PROOF_START} lipsesc — sar peste dovadă")
        return
    section = build_proof_section()
    if section is None:
        print(
            "[gen_static_daily] history.json indisponibil/gol — dovada rămâne neatinsă"
        )
        return
    _fara_sectiuni_straine(
        re.search(
            re.escape(PROOF_START) + r".*?" + re.escape(PROOF_END), html, flags=re.S
        ).group(0),
        section,
        "PROOF_STATIC",
    )
    new = re.sub(
        re.escape(PROOF_START) + r".*?" + re.escape(PROOF_END),
        lambda _: section,
        html,
        flags=re.S,
    )
    INDEX.write_text(new)


def _fara_sectiuni_straine(vechi: str, nou: str, nume: str) -> None:
    """6 oct 2026: blocul dintre markeri se înlocuiește INTEGRAL. Refuz dacă blocul vechi conține secțiuni/id-uri/markeri
    care nu există în blocul nou (pe 3 oct a șters exemplul Pro pus între markerii PROOF_STATIC)."""
    import re as _re

    vechi_ids = set(_re.findall(r'id="([^"]+)"', vechi))
    noi_ids = set(_re.findall(r'id="([^"]+)"', nou))
    straine = sorted(vechi_ids - noi_ids)
    markeri = [
        m for m in _re.findall(r"<!-- ([A-Z_]+_START) -->", vechi) if m not in nou
    ]
    if straine or markeri:
        sys.exit(
            f"[gen_static_daily] între markerii {nume} sunt elemente negenerate (id: {straine}, markeri: {markeri}) — abort, mută-le în afara markerilor"
        )


def update_index() -> None:
    html = INDEX.read_text()
    if START not in html or END not in html:
        sys.exit(f"[gen_static_daily] markerii {START} lipsesc din index.html — abort")
    sect = build_section()
    _fara_sectiuni_straine(
        re.search(re.escape(START) + r".*?" + re.escape(END), html, flags=re.S).group(
            0
        ),
        sect,
        "DAILY_STATIC",
    )
    new = re.sub(
        re.escape(START) + r".*?" + re.escape(END), lambda _: sect, html, flags=re.S
    )
    INDEX.write_text(new)


def update_sitemap() -> None:
    today = bucharest_today().date().isoformat()
    xml = SITEMAP.read_text()

    # lastmod la zi DOAR pentru URL-urile cu changefreq daily
    def bump(m: re.Match) -> str:
        block = m.group(0)
        if "<changefreq>daily</changefreq>" in block:
            block = re.sub(
                r"<lastmod>[^<]*</lastmod>", f"<lastmod>{today}</lastmod>", block
            )
        return block

    SITEMAP.write_text(re.sub(r"<url>.*?</url>", bump, xml, flags=re.S))


if __name__ == "__main__":
    update_index()
    update_proof()
    update_sitemap()
    print(
        f"[gen_static_daily] OK — index.html + sitemap.xml la {bucharest_today().date().isoformat()}"
    )
