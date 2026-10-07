#!/usr/bin/env python3
"""Conținut static zilnic pentru SEO — rulat de daily_publish.sh la fiecare publish.

Face trei lucruri:
  1. Rescrie secțiunea dintre markerii DAILY_STATIC din index.html cu top 3
     picks calibrate ale zilei (text static în HTML — Google primește conținut
     proaspăt zilnic, nu doar JSON încărcat din JS).
  2. Rescrie secțiunea dintre markerii PROOF_STATIC din index.html cu tabelul
     „ce s-a adeverit" din data/history.json (cumulated_markets) — dovada de
     conversie de pe homepage, statică pentru crawler și niciodată inventată.
  3. Actualizează <lastmod> în sitemap.xml pentru paginile cu changefreq daily
     (era înghețat la 2026-06-11 — semnal de site mort pentru crawler).

Regulile de onestitate (CLAUDE.md): probabilități CALIBRATE, round(p*100),
prag pick identic cu app.js (O1.5 ≥0.75, restul ≥0.65), MAX_PROB_DISPLAY=0.88
(fără super-favoriți umflați ca exemple), fără echipe W/tineret/rezerve.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Filtrul de ligi pentru AFIȘAJ PUBLIC vine din modulul UNIC — un singur loc, ca să
# nu existe două liste care se depărtează (29 aug 2026). „Repere azi" e vitrina de pe
# homepage: până acum scotea în față Hungary NB III / Czech 4. liga, adică exact
# opusul a ce vrea să demonstreze blocul.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _leagues_public import is_public_league

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

MAX_PROB_DISPLAY = 0.88
EXCLUDE_TEAM = re.compile(
    r"\b(II|III|B|C|Reserves?|U1[4-9]|U2[0-3]|W|Women|Ladies|Femenino|Femenil|Feminin)\b",
    re.IGNORECASE,
)
EXCLUDE_LEAGUE = re.compile(r"women|femenil|femenino|feminin|ladies|w-league", re.IGNORECASE)

# piață → (cheie JSON, prag pick — sincron cu pickBadge() din assets/app.js)
MARKETS = [
    ("Over 1.5 goluri", "prob_over_1_5", 0.75),
    ("Over 2.5 goluri", "prob_over_2_5", 0.65),
    ("Over 3.5 goluri", "prob_over_3_5", 0.65),
    ("Victorie gazde", "prob_home", 0.65),
    ("Victorie oaspeți", "prob_away", 0.65),
    ("Ambele marchează", "prob_btts", 0.65),
]

RO_MONTHS = ["", "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
             "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]


def bucharest_today() -> datetime:
    # EEST vara (UTC+3) — suficient pentru granița de zi; iarna +2 nu strică
    # selecția (meciurile de la miezul nopții alunecă o zi, acceptabil pentru extras).
    return datetime.now(timezone(timedelta(hours=3)))


def todays_picks(limit: int = 3) -> tuple[list[str], int, int]:
    """Returnează (repere, meciuri_azi, repere_respinse_de_filtrul_public).

    Al treilea număr contează pentru onestitatea mesajului de rezervă: „niciun reper
    peste praguri" ar fi FALS în zilele în care există repere, dar toate în ligi mici.
    """
    data = json.loads(PRED.read_text())
    matches = data["matches"] if isinstance(data, dict) and "matches" in data else data
    today = bucharest_today().date().isoformat()
    picks = []
    n_today = 0
    n_respinse = 0
    for m in matches:
        if not str(m.get("match_date", "")).startswith(today):
            continue
        n_today += 1
        if not m.get("calibrated"):
            continue
        home, away = str(m.get("home_team", "")), str(m.get("away_team", ""))
        league = f"{m.get('country', '')} · {m.get('league', '')}"
        if EXCLUDE_TEAM.search(home) or EXCLUDE_TEAM.search(away) or EXCLUDE_LEAGUE.search(league):
            continue
        if not is_public_league(m.get("country", ""), m.get("league", "")):
            if any((m.get(k) is not None and prag <= m[k] <= MAX_PROB_DISPLAY)
                   for _, k, prag in MARKETS):
                n_respinse += 1
            continue
        for label, key, prag in MARKETS:
            p = m.get(key)
            if p is None or p < prag or p > MAX_PROB_DISPLAY:
                continue
            picks.append((p, f"<li><strong>{home} – {away}</strong> ({league}): "
                             f"{label} — <strong>{round(p * 100)}%</strong> calibrat</li>"))
    picks.sort(key=lambda x: -x[0])
    # un singur pick per meci (cel mai probabil), apoi top N
    seen, out = set(), []
    for p, html in picks:
        match_key = html.split("(")[0]
        if match_key in seen:
            continue
        seen.add(match_key)
        out.append(html)
        if len(out) >= limit:
            break
    return out, n_today, n_respinse


def build_section() -> str:
    d = bucharest_today()
    date_ro = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    picks, n_today, n_respinse = todays_picks()
    lines = [
        START,
        '  <section class="daily-static" id="repere-azi">',
        f"    <h2 data-i18n=\"repere.h2\" data-i18n-vars='{{\"data\":\"<span data-date=\\\"{d.date().isoformat()}\\\">{date_ro}</span>\"}}'>Predicții fotbal azi — <span data-date=\"{d.date().isoformat()}\">{date_ro}</span></h2>",
    ]
    if picks:
        lines.append(f"    <p data-i18n=\"repere.p\" data-i18n-vars='{{\"n\":\"{n_today}\"}}'>Repere calibrate din cele {n_today} meciuri analizate azi de model "
                     "(lista completă, cu filtre, mai jos):</p>")
        lines.append("    <ul>")
        lines += ["      " + p for p in picks]
        lines.append("    </ul>")
    elif n_respinse:
        # Există repere, dar toate în competiții pe care nu le punem în vitrină.
        # A scrie „niciun reper peste praguri" ar fi minciună prin omisiune.
        lines.append(f"    <p>Modelul a analizat azi {n_today} meciuri. În campionatele mari nu "
                     f"e azi niciun reper peste pragurile de afișare; cele "
                     f"{n_respinse} care trec pragul sunt în competiții mici, pe care nu le "
                     "scoatem în față. Lista completă, cu filtre, e mai jos.</p>")
    else:
        lines.append(f"    <p>Modelul a analizat azi {n_today} meciuri; niciun reper calibrat "
                     "peste pragurile de afișare — lista completă mai jos.</p>")
    lines.append('    <p class="pro-disclaimer">probabilități calibrate empiric · informativ · '
                 "nu sfat de pariere · 18+</p>")
    lines.append("  </section>")
    lines.append("  " + END)
    return "\n".join(lines)


# Pragurile de afișare (build_public_json.market_def): N din tabel = predicțiile cu probabilitate ≥ prag, NU toate predicțiile (29 sept 2026).
PRAG_AFISARE = {"Over 1.5": 75, "Over 2.5": 65, "Over 3.5": 65, "BTTS Da": 65, "HT Over 0.5": 65, "HT Over 1.5": 65}


def _metrici_paragraf() -> str:
    """7 oct 2026: Brier, log loss, ECE și testul contra prețului de închidere, pe prima pagină (ChatGPT ne citea doar
    prima pagină și spunea că „lipsesc"). Cifrele vin din data/audit.json; textul în 4 limbi e scris și în i18n.json."""
    try:
        a = json.loads(AUDIT.read_text()); P = {x["cheie"]: x for x in a["piete"]}; V = a["vs_piata"]
    except Exception as e:
        print(f"[gen_static_daily] audit.json indisponibil ({e}) — fără paragraful de metrici"); return ""
    ro = lambda x, d=3: f"{x:.{d}f}".replace(".", ",")
    n = f"{a['n_rezolvate']:,}".replace(",", "."); o15, o25, gg = P["over_1_5"], P["over_2_5"], P["btts"]; v = V["over_2_5"]
    nv = f"{v['n']:,}".replace(",", "."); castig = v["informatie"]["castig_ll"]
    T = {
        "ro": f"<strong>Metrici pe toate cele {n} de predicții rezolvate</strong> (din 2 iunie 2026, nu doar cele peste prag): peste 1,5 — Brier {ro(o15['brier'])}, log loss {ro(o15['log_loss'])}, eroare de calibrare {ro(o15['ece'],1)} pp · peste 2,5 — Brier {ro(o25['brier'])}, log loss {ro(o25['log_loss'])}, ECE {ro(o25['ece'],2)} pp · GG — Brier {ro(gg['brier'])}, log loss {ro(gg['log_loss'])}. Test contra prețului de închidere al pieței, pe {nv} meciuri (peste 2,5): Brier model {ro(v['brier_model'])} față de piață {ro(v['brier_piata'])}; ce adaugă modelul peste preț: {ro(castig,4)} log loss, adică nimic. <strong>Modelul e calibrat și nu bate piața.</strong> Diagrama de fiabilitate, Brier și log loss pe fiecare piață și jurnalul CSV cu ora înghețării fiecărei predicții: <a href=\"track-record.html\">track record</a>.",
        "en": f"<strong>Metrics on all {a['n_rezolvate']:,} resolved predictions</strong> (since 2 June 2026, not just those above the threshold): over 1.5 — Brier {o15['brier']:.3f}, log loss {o15['log_loss']:.3f}, calibration error {o15['ece']:.1f} pp · over 2.5 — Brier {o25['brier']:.3f}, log loss {o25['log_loss']:.3f}, ECE {o25['ece']:.2f} pp · BTTS — Brier {gg['brier']:.3f}, log loss {gg['log_loss']:.3f}. Tested against the market's closing price on {v['n']:,} matches (over 2.5): model Brier {v['brier_model']:.3f} vs market {v['brier_piata']:.3f}; what the model adds on top of the price: {castig:+.4f} log loss, i.e. nothing. <strong>The model is calibrated and does not beat the market.</strong> Reliability diagram, Brier and log loss per market, and the CSV journal with each prediction's freeze time: <a href=\"track-record.html\">track record</a>.",
        "es": f"<strong>Métricas sobre las {n} predicciones resueltas</strong> (desde el 2 de junio de 2026, no solo las que superan el umbral): más de 1,5 — Brier {ro(o15['brier'])}, log loss {ro(o15['log_loss'])}, error de calibración {ro(o15['ece'],1)} pp · más de 2,5 — Brier {ro(o25['brier'])}, log loss {ro(o25['log_loss'])}, ECE {ro(o25['ece'],2)} pp · ambos marcan — Brier {ro(gg['brier'])}, log loss {ro(gg['log_loss'])}. Comparado con el precio de cierre del mercado en {nv} partidos (más de 2,5): Brier modelo {ro(v['brier_model'])} frente a mercado {ro(v['brier_piata'])}; lo que el modelo añade sobre el precio: {ro(castig,4)} log loss, es decir, nada. <strong>El modelo está calibrado y no supera al mercado.</strong> Diagrama de fiabilidad, Brier y log loss por mercado y el diario CSV con la hora de congelación: <a href=\"track-record.html\">track record</a>.",
        "it": f"<strong>Metriche su tutte le {n} previsioni risolte</strong> (dal 2 giugno 2026, non solo quelle sopra soglia): over 1,5 — Brier {ro(o15['brier'])}, log loss {ro(o15['log_loss'])}, errore di calibrazione {ro(o15['ece'],1)} pp · over 2,5 — Brier {ro(o25['brier'])}, log loss {ro(o25['log_loss'])}, ECE {ro(o25['ece'],2)} pp · GG — Brier {ro(gg['brier'])}, log loss {ro(gg['log_loss'])}. Testato contro il prezzo di chiusura del mercato su {nv} partite (over 2,5): Brier modello {ro(v['brier_model'])} contro mercato {ro(v['brier_piata'])}; ciò che il modello aggiunge al prezzo: {ro(castig,4)} log loss, cioè niente. <strong>Il modello è calibrato e non batte il mercato.</strong> Diagramma di affidabilità, Brier e log loss per mercato e il diario CSV con l'ora di congelamento: <a href=\"track-record.html\">track record</a>.",
    }
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
        n_ro = f'{m["n"]:,}'.replace(",", ".")   # separator de mii românesc
        rows.append(
            f'          <tr{tr_cls}>'
            f'<td><strong>{m["name"]}</strong>' + (f' <small class="proof-prag">≥ {PRAG_AFISARE[m["name"]]} %</small>' if m["name"] in PRAG_AFISARE else '') + '</td>'
            f'<td>{n_ro}</td>'
            f'<td class="hit">{m["hit_pct"]:.1f}%</td>'
            f'<td>{m["wlo_pct"]:.1f}%</td>'
            f'<td><span class="tier-badge {cls}">{tier}</span></td>'
            f'</tr>'
        )

    return "\n".join([
        PROOF_START,
        '  <section class="proof" id="dovada">',
        '    <h2 data-i18n="proof.h2">Ce s-a adeverit, din predicții înghețate</h2>',
        '    <p class="proof-lead" data-i18n="proof.lead">Jurnal deschis din 2 iunie 2026. '
        'Fiecare predicție e înghețată la generare (05:30), publicată înainte de meci și '
        'comparată apoi cu rezultatul real. Nu ștergem nimic retroactiv.</p>',
        '    <div class="proof-table-wrap">',
        '      <table class="proof-table">',
        '        <thead><tr>',
        '          <th data-i18n="proof.th.market">Piață</th>',
        '          <th data-i18n="proof.th.n">Selecții peste prag, rezolvate</th>',
        '          <th data-i18n="proof.th.hit">S-au adeverit</th>',
        '          <th data-i18n="proof.th.wlo">Minim statistic (Wilson 95%)</th>',
        '          <th data-i18n="proof.th.tier">Verdict propriu</th>',
        '        </tr></thead>',
        '        <tbody>',
        *rows,
        '        </tbody>',
        '      </table>',
        '    </div>',
        '    <p class="proof-note" data-i18n="proof.note">Rândul roșu e aici intenționat: acolo '
        'modelul <strong>nu</strong> prezice suficient de bine, iar noi îl marcăm <strong>DROP</strong> '
        'în propriul nostru tabel. Un site care îți arată doar ce a mers nu-ți arată nimic.</p>',
        '    <p class="proof-note">N = doar selecțiile la care probabilitatea a trecut pragul din dreptul pieței, nu toate predicțiile; '
        'cifrele pe toate predicțiile, piață cu piață, sunt în auditul de pe track record. „Verdict propriu\" ține de mărimea eșantionului și de limita '
        'Wilson, <strong>nu</strong> de avantajul peste rata naturală a pieței. Tabelul complet, '
        'bucket cu bucket: <a href="track-record.html">track record</a> · '
        '<a href="istoric.html">istoric zi cu zi</a>.</p>',
        _metrici_paragraf(),
        f'    <p class="proof-asof" data-i18n="proof.asof" data-i18n-vars=\'{{"data":"<span data-date=\\"{d.date().isoformat()}\\">{date_ro}</span>"}}\'>Cifre din jurnalul forward, actualizate <span data-date="{d.date().isoformat()}">{date_ro}</span> · '
        'informativ · nu sfat de pariere · 18+</p>',
        '  </section>',
        "  " + PROOF_END,
    ])


def update_proof() -> None:
    html = INDEX.read_text()
    if PROOF_START not in html or PROOF_END not in html:
        print(f"[gen_static_daily] markerii {PROOF_START} lipsesc — sar peste dovadă")
        return
    section = build_proof_section()
    if section is None:
        print("[gen_static_daily] history.json indisponibil/gol — dovada rămâne neatinsă")
        return
    _fara_sectiuni_straine(re.search(re.escape(PROOF_START) + r".*?" + re.escape(PROOF_END), html, flags=re.S).group(0), section, "PROOF_STATIC")
    new = re.sub(re.escape(PROOF_START) + r".*?" + re.escape(PROOF_END), lambda _: section,
                 html, flags=re.S)
    INDEX.write_text(new)


def _fara_sectiuni_straine(vechi: str, nou: str, nume: str) -> None:
    """6 oct 2026: blocul dintre markeri se înlocuiește INTEGRAL. Refuz dacă blocul vechi conține secțiuni/id-uri/markeri
    care nu există în blocul nou (pe 3 oct a șters exemplul Pro pus între markerii PROOF_STATIC)."""
    import re as _re
    vechi_ids = set(_re.findall(r'id="([^"]+)"', vechi)); noi_ids = set(_re.findall(r'id="([^"]+)"', nou))
    straine = sorted(vechi_ids - noi_ids)
    markeri = [m for m in _re.findall(r"<!-- ([A-Z_]+_START) -->", vechi) if m not in nou]
    if straine or markeri:
        sys.exit(f"[gen_static_daily] între markerii {nume} sunt elemente negenerate (id: {straine}, markeri: {markeri}) — abort, mută-le în afara markerilor")


def update_index() -> None:
    html = INDEX.read_text()
    if START not in html or END not in html:
        sys.exit(f"[gen_static_daily] markerii {START} lipsesc din index.html — abort")
    sect = build_section()
    _fara_sectiuni_straine(re.search(re.escape(START) + r".*?" + re.escape(END), html, flags=re.S).group(0), sect, "DAILY_STATIC")
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: sect, html, flags=re.S)
    INDEX.write_text(new)


def update_sitemap() -> None:
    today = bucharest_today().date().isoformat()
    xml = SITEMAP.read_text()
    # lastmod la zi DOAR pentru URL-urile cu changefreq daily
    def bump(m: re.Match) -> str:
        block = m.group(0)
        if "<changefreq>daily</changefreq>" in block:
            block = re.sub(r"<lastmod>[^<]*</lastmod>", f"<lastmod>{today}</lastmod>", block)
        return block
    SITEMAP.write_text(re.sub(r"<url>.*?</url>", bump, xml, flags=re.S))


if __name__ == "__main__":
    update_index()
    update_proof()
    update_sitemap()
    print(f"[gen_static_daily] OK — index.html + sitemap.xml la {bucharest_today().date().isoformat()}")
