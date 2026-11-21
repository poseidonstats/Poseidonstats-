#!/usr/bin/env python3
"""Exemplul de analiză Pro de pe prima pagină (28 sept 2026, cerut de Andreea; 2 oct 2026: „zilnic una nouă, ÎNAINTE de meci, nu după”).

Cardul = analiza de AZI, completă, fără lacăt — prima din arhiva zilei (~/football_predictor/data/pro_analyses/<zi>.json, cea
scrisă la 07:20 și postată în #analize-pro). Până apare fișierul zilei (publicarea site-ului e la 06:10, analizele la 07:28),
cardul rămâne analiza de ieri, aceeași, acum cu scorul final. Sub card: rezultatul analizei de ieri + link la verificarea de a
doua zi din arhivă (analize/<zi>.html). Lista „azi în Pro” rămâne cu lacăt, fără meciul publicat.
Exemplul trebuie să coincidă cu exemplul deja aprobat pe ruta publică; eticheta pre-meci cere chitanța originală de site.
Se cheamă din daily_publish.sh (06:10) și din publish_pro_sample.sh (07:50 și la reîncercarea de la 12:35).
Uz: gen_pro_sample.py [--date 2026-10-02] [--dry-run]     (implicit: azi, ora României)"""

from __future__ import annotations

import argparse
import html as H
import json
import re
import sys
from datetime import datetime, timedelta
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from editorial_copy import editorial_text, public_analysis_text
import provenienta_pro as PP  # noqa: E402

SITE = Path(__file__).resolve().parent.parent
INDEX = SITE / "index.html"
ARHIVA = Path.home() / "football_predictor" / "data" / "pro_analyses"
DB = "file:" + str(Path.home() / "football_predictor" / "football.db") + "?mode=ro"
RO = ZoneInfo("Europe/Bucharest")
START, END = "<!-- PRO_SAMPLE_CARD_START -->", "<!-- PRO_SAMPLE_CARD_END -->"
LISTA_START, LISTA_END = "<!-- PRO_TODAY_LIST_START -->", "<!-- PRO_TODAY_LIST_END -->"
PUBLIC_EXAMPLE = "https://poseidon-members.poseidonstats.workers.dev/api/exemplu"
TOTAL_MARKET = {
    "ro": "Peste {n} goluri în meci",
    "en": "Over {n} total goals",
    "es": "Más de {n} goles en el partido",
    "it": "Over {n} gol totali",
    "fr": "Plus de {n} buts dans le match",
    "id": "Di atas {n} gol total",
}
SOURCE_TOTAL_MARKET = {
    "ro": ("Peste {n} goluri", "Sub {n} goluri"),
    "en": ("Over {n} goals", "Under {n} goals"),
    "es": ("Más de {n} goles", "Menos de {n} goles"),
    "it": ("Over {n} gol", "Under {n} gol"),
    "fr": ("Plus de {n} buts", "Moins de {n} buts"),
    "id": ("Di atas {n} gol", "Di bawah {n} gol"),
}
PRO_MARKETS = {
    "ht_over_0_5": (
        "Peste 0,5 goluri în prima repriză",
        "Over 0.5 first-half goals",
        "Más de 0,5 goles en la primera parte",
        "Over 0,5 gol nel primo tempo",
        "Plus de 0,5 but en première mi-temps",
        "Di atas 0,5 gol babak pertama",
    ),
    "btts": (
        "Ambele marchează",
        "Both teams to score",
        "Ambos marcan",
        "Entrambe segnano",
        "Les deux équipes marquent",
        "Kedua tim mencetak gol",
    ),
    "ng": (
        "Cel puțin o echipă nu marchează",
        "At least one team fails to score",
        "Al menos un equipo no marca",
        "Almeno una squadra non segna",
        "Au moins une équipe ne marque pas",
        "Setidaknya satu tim tidak mencetak gol",
    ),
    **{
        f"{key}_{goals}_5": tuple(
            labels[index].format(n=f"{goals}{'.' if lang == 'en' else ','}5")
            for lang, labels in SOURCE_TOTAL_MARKET.items()
        )
        for key, index, lines in (("over", 0, (1, 2, 3)), ("under", 1, (2, 3)))
        for goals in lines
    },
}
TEAM_GOALS = {
    "team_goals_home_2_plus": "home",
    "team_goals_away_2_plus": "away",
}
TOTAL_RANGES = {
    "total_goals_2_3": "2–3",
    "total_goals_2_4": "2–4",
    "total_goals_3_5": "3–5",
}
TEAM_GOALS_LABELS = (
    "{team} marchează cel puțin 2 goluri în 90 de minute",
    "{team} to score at least 2 goals in 90 minutes",
    "{team} marca al menos 2 goles en 90 minutos",
    "{team} segna almeno 2 gol in 90 minuti",
    "{team} marque au moins 2 buts en 90 minutes",
    "{team} mencetak minimal 2 gol dalam 90 menit",
)
TOTAL_RANGE_LABELS = (
    "{bounds} goluri în total după 90 de minute, inclusiv",
    "{bounds} total goals after 90 minutes, inclusive",
    "{bounds} goles totales tras 90 minutos, ambos incluidos",
    "{bounds} gol totali dopo 90 minuti, estremi inclusi",
    "{bounds} buts au total après 90 minutes, bornes incluses",
    "{bounds} gol total setelah 90 menit, batas termasuk",
)
ALTERNATIVE = dict(zip(TOTAL_MARKET, ("Alternativă", "Alternative", "Alternativa", "Alternativa", "Alternative", "Alternatif"), strict=True))
NO_SELECTION = dict(
    zip(
        TOTAL_MARKET,
        (
            "Fără selecție",
            "No selection",
            "Sin selección",
            "Nessuna selezione",
            "Aucune sélection",
            "Tidak ada pilihan",
        ),
        strict=True,
    )
)
LUNI = [
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


# ----------------------------------------------------------------- parsare
def _sectiune(text: str, marker: str, urmatoarele: tuple[str, ...]) -> str:
    i = text.find(marker)
    if i < 0:
        return ""
    j = len(text)
    for u in urmatoarele:
        k = text.find(u, i + len(marker))
        if k >= 0:
            j = min(j, k)
    s = text[i + len(marker) : j].strip()
    s = re.sub(r"^\*\*[^*]+:\*\*\s*", "", s)  # „**Verdict:** ”
    return s.strip()


def _titlu_picks(text: str) -> str:
    """Recunoaște titlul separat, inclusiv „🎯 **Selezioni:**” și „🎯 **Pick:**”."""
    titles = (
        "picks?", "selecții", "selecciones", "selections", "sélections",
        "selezioni", "pilihan", "pronostici", "pronósticos", "pronostics",
    )
    known = re.compile(r"^🎯\s+\*\*(?:" + "|".join(titles) + r")(?:\s*:)?\*\*\s*:?$", re.I)
    for linie in text.splitlines():
        t = linie.strip()
        if known.fullmatch(t) or re.fullmatch(r"🎯 \*\*[^:*]+\*\*", t):
            return t
    return "🎯 **Picks"


def parseaza(text: str) -> dict:
    tp = _titlu_picks(text)
    p = {
        "verdict": _sectiune(text, "⚡", ("📊", "🧮", tp, "👁️")),
        "context": _sectiune(text, "📊", ("🧮", tp, "👁️")),
        "model": _sectiune(text, "🧮", (tp, "👁️")),
        "urmarit": _sectiune(text, "👁️", ("*informativ",)),
    }
    i = text.find(tp)
    j = text.find("👁️", i) if i >= 0 else -1
    bloc = text[i : j if j >= 0 else len(text)] if i >= 0 else ""
    p["picks"] = [
        linie.strip()
        for linie in bloc.splitlines()[1:]
        if linie.strip() and linie.strip()[0] in "🔒🎯💎↪"
    ]
    return p


def piata_baza(picks: list[str]) -> str:
    for linie in picks:
        if linie.startswith("🔒"):
            m = re.search(r"\*\*Baz[ăa]:\*\*\s*(.+?)\s+—", linie)
            piata = m.group(1) if m else re.sub(r"^🔒\s*", "", linie).split("—")[0]
            return piata.replace("**", "").strip(
                " .*"
            )  # 6 oct 2026: „**Peste 1.5 goluri” → „Peste 1.5 goluri”
    return ""


def piata_din_linie(linie: str) -> str:
    """Piața unui rând de pick, în limba rândului (28 oct 2026, Andreea: „Avem o greșeală de traducere”): eticheta în bold de la început,
    oricare ar fi limba („**Bază:**”, „**Base:**”, „**Base :**”), se scoate; piața e textul până la primul „ — ”. Merge și pe formatul vechi
    „🔒 **Bază:** **Peste 1.5 goluri — 88%.** motiv” și pe cel din iulie–septembrie, cu eticheta și piața în același bold:
    „🔒 **Siguranță: Peste 1.5 goluri — 70%.** motiv”."""
    rest = re.sub(r"^\W*\*\*[^*:]+?\s?:(?:\*\*)?\s*", "", linie.strip())
    return re.split(r"\s+[—–·-]\s+", rest)[0].replace("**", "").strip(" .*")


def baza_in_limba(text: str, rezerva: str) -> str:
    """Piața de Bază din analiza unei limbi (rândul cu 🔒); fără traducere sau fără rând, rămâne piața din analiza românească."""
    for linie in parseaza(text)["picks"] if text else []:
        if linie.startswith("🔒"):
            return piata_din_linie(linie) or rezerva
    return rezerva


def evalueaza(piata: str, gh: int, ga: int, hth=None, hta=None, *, home="", away=""):
    """Același evaluator ca arhiva; fără HT valid nu judecăm piețe de pauză."""
    # Import lazy: arhiva reutilizează funcțiile de afișare/parsat din acest modul.
    from gen_pro_arhiva import este_piata_pauza, evalueaza_pick, piata_fara_perioada

    # Domeniul FT al sample-ului rămâne conservator: un nume de echipă urmat
    # de „peste0.5” nu dovedește un total de meci. Guardul doar recunoaște
    # formulările; calculele și alegerea țintei sunt exclusiv în evaluatorul comun.
    p = piata_fara_perioada(piata)
    simple = bool(
        re.match(
            r"(?i)^(peste\s+\d[.,]5|sub\s+\d[.,]5|ambele inscriu|ambele marcheaza|btts|gg|cel putin o echipa nu marcheaza|1x\b|x2\b|12\b|egal\b|x\b|1\b|2\b)",
            p,
        )
    )
    simple = simple or any(
        text in p.lower()
        for text in (
            "victorie gazde",
            "gazdele castiga",
            "victorie oaspeti",
            "oaspetii castiga",
        )
    )
    if este_piata_pauza(piata) and re.match(r"^(over|o|under|u)\s*\d[.,]5\b", p):
        simple = (
            True  # formulări HT canonice deja suportate, nu orice prefix necunoscut
        )
    # Familii deja evaluate de arhivă: scor exact și rezultat nominal cu
    # marker. Acesta este doar guardul de domeniu; evaluatorul comun cere
    # potrivirea integrală a numelui, semnului și adnotării.
    simple = simple or bool(
        re.match(r"^scor(?:ul)?\b", p)
        or re.fullmatch(r"[^()]+\((?:1x|x2|12|1|2|x)\)", p)
        or re.fullmatch(r"(?:2[–-][34]|3[–-]5) goluri in total dupa 90 de minute, inclusiv", p)
        or re.fullmatch(r".+ marcheaza cel putin 2 goluri in 90 de minute", p)
    )
    if not simple:
        return None
    return evalueaza_pick(piata, gh, ga, home, away, hth, hta)


# ----------------------------------------------------------------- date
def rezultate(fids: list[int]) -> dict[int, dict]:
    """Același cititor și aceeași pereche HT validată ca în arhivă."""
    from gen_pro_arhiva import rezultate as rezultate_arhiva

    return rezultate_arhiva(fids, database=DB)


def _date_rezultat(result):
    """FT+HT din cititorul comun; tuplurile FT vechi nu conțin dovadă HT."""
    if result is None:
        return None, (None, None)
    if isinstance(result, dict):
        return (result["gh"], result["ga"]), (result.get("hth"), result.get("hta"))
    return result, (None, None)


def alege(items: list[dict], rez: dict):
    """(item, scor, piața de bază, a ieșit?) — cu rezultat cunoscut; întâi cele la care Baza a ieșit, apoi cele neevaluabile,
    apoi cele picate; în interiorul grupului, ordinea arhivei (cel mai bun pick primul). None dacă nimic nu are rezultat."""
    cand = []
    for i, it in enumerate(items):
        fid = it["match"].get("fixture_id")
        scor, half = _date_rezultat(rez.get(fid))
        if not scor:
            continue
        baza = piata_baza(parseaza(it["analysis"])["picks"])
        ok = (
            evalueaza(
                baza,
                *scor,
                *half,
                home=it["match"].get("home", ""),
                away=it["match"].get("away", ""),
            )
            if baza
            else None
        )
        cand.append(({True: 0, None: 1, False: 2}[ok], i, it, scor, baza, ok))
    if not cand:
        return None
    cand.sort(key=lambda c: (c[0], c[1]))
    _, _, it, scor, baza, ok = cand[0]
    return it, scor, baza, ok


# ----------------------------------------------------------------- HTML
def _inline(s: str, lang: str = "ro") -> str:
    s = H.escape(editorial_text(s, lang), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*\((.+?)\)\*", r"<em>(\1)</em>", s)
    s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
    return s


def _scurt(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def _data_ro(iso: str) -> str:
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d")
        return f"{d.day} {LUNI[d.month - 1]} {d.year}"
    except ValueError:
        return iso


def _principal_row(picks: list[str]) -> str:
    rows = [line for line in picks if line.startswith("🎯")]
    return rows[0] if len(rows) == 1 else ""


def contextual_reason(item: dict, picks: list[str], lang: str, selection=None) -> str:
    if selection is None:
        selection = next((p for p in contextual_picks(item) if p["tip"] == "Principal"), None)
    is_alternative = selection and selection["tip"] == "Alternativă"
    rows = [row for row in picks if row.startswith("↪")] if is_alternative else [_principal_row(picks)]
    if not selection:
        labels = (NO_SELECTION[lang], NO_SELECTION["ro"])
    else:
        labels = (pro_market_label(selection["key"], lang, item["match"]), selection["source_market"])
    for row in rows:
        content = re.sub(r"^(?:🎯|↪️?)\s*\*\*[^*]+:\*\*\s*", "", row).replace("**", "")
        for label in labels:
            if not isinstance(label, str) or not label:
                continue
            prefix = rf"^{re.escape(label)}(?:\s+[—–-]\s+\d+(?:[.,]\d+)?\s*%)?[.·]\s*"
            match = re.match(prefix, content, re.I)
            if match:
                return content[match.end() :].strip()
    return ""


def contextual_pro(item: dict) -> bool:
    return (item.get("provenance") or {}).get("inputs", {}).get(
        "selection_mode"
    ) == "contextual"


def pro_market_label(key: str, lang: str, match: dict | None = None) -> str:
    index = tuple(TOTAL_MARKET).index(lang)
    if key in TEAM_GOALS:
        side = TEAM_GOALS[key]
        fallback = {"home": "Gazda", "away": "Oaspetele"}[side]
        return TEAM_GOALS_LABELS[index].format(team=(match or {}).get(side) or fallback)
    if key in TOTAL_RANGES:
        return TOTAL_RANGE_LABELS[index].format(bounds=TOTAL_RANGES[key])
    return PRO_MARKETS[key][index]


def pro_market_for_settlement(key: str, label: str) -> str:
    if key in PRO_MARKETS or key in TEAM_GOALS or key in TOTAL_RANGES:
        return pro_market_label(key, "ro").removesuffix(" în meci")
    return label


def contextual_picks(item: dict) -> list[dict]:
    structured = (item.get("provenance") or {}).get("inputs", {}).get("picks")
    if not isinstance(structured, list) or not 1 <= len(structured) <= 3:
        return []
    picked = []
    keys = set()
    for pick in structured:
        if not isinstance(pick, dict):
            return []
        key, role, probability = pick.get("key"), pick.get("rol"), pick.get("p")
        if not isinstance(key, str) or key in keys or role not in ("Principal", "Alternativă"):
            return []
        if key not in PRO_MARKETS and key not in TEAM_GOALS and key not in TOTAL_RANGES:
            return []
        if probability is not None and (type(probability) not in (int, float) or not 0 <= probability <= 100):
            return []
        keys.add(key)
        picked.append({"tip": role, "key": key, "piata": pro_market_label(key, "ro", item["match"]), "prob": probability, "source_market": pick.get("piata")})
    primary = [pick for pick in picked if pick["tip"] == "Principal"]
    return primary + [pick for pick in picked if pick["tip"] == "Alternativă"] if len(primary) == 1 else []


def _principal(
    item: dict, picks: list[str]
) -> tuple[str, int | float | None, str] | None:
    """Preferă pronosticul structurat al dosarului. Pentru fișele vechi, citește doar rândul principal."""
    if contextual_pro(item):
        primary = contextual_picks(item)
        return (primary[0]["piata"], primary[0]["prob"], primary[0]["key"]) if primary else None
    structured = (item.get("provenance") or {}).get("inputs", {}).get("picks") or []
    if not isinstance(structured, list):
        return None
    primary = [
        p for p in structured if isinstance(p, dict) and p.get("rol") == "Principal"
    ]
    if len(primary) == 1:
        pick = primary[0]
        key, market, probability = pick.get("key"), pick.get("piata"), pick.get("p")
        valid_probability = (
            type(probability) in (int, float) and 0 <= probability <= 100
        )
        if (
            isinstance(market, str)
            and market
            and isinstance(key, str)
            and valid_probability
        ):
            return market, probability, key
    row = _principal_row(picks)
    match = re.search(r"\s+[—–-]\s+(\d+(?:[.,]\d+)?)\s*%", row.replace("**", ""))
    if not match:
        return None
    probability = float(match[1].replace(",", "."))
    market = piata_din_linie(row)
    return (market, probability, "") if market and 0 <= probability <= 100 else None


def html_card(
    item: dict,
    zi: str,
    scor: tuple[int, int] | None,
    principal_ok: bool | None = None,
) -> str:
    """Arată pronosticul principal și textul exemplului public, cu verificarea aceluiași meci."""
    m = item["match"]
    p = parseaza(item["analysis"])
    principal = _principal(item, p["picks"])
    contextual = contextual_pro(item)
    published = bool(item.get("_public_site_delivery"))
    liga = m.get("league", "")
    tara = m.get("country", "")
    head = (
        f"{H.escape(m['home'])} – {H.escape(m['away'])} · {H.escape(liga)}"
        + (
            f' (<span data-sample-country="{H.escape(tara)}">{H.escape(tara)}</span>)'
            if tara
            else ""
        )
        + f' · <span data-date="{(m.get("date") or zi)[:10]}">{_data_ro(m.get("date", zi))}</span>'
    )
    if scor:
        head += f' · <strong data-i18n="pro.card.rezfinal" data-i18n-vars=\'{{"s":"{scor[0]}-{scor[1]}"}}\'>rezultat final {scor[0]}-{scor[1]}</strong>'
    status = (
        '<span data-i18n="pro.card.publicata0">publicată înainte de meci</span>'
        if published
        else '<span data-i18n="pro.card.archived">Analiză arhivată; publicarea înainte de start nu este confirmată.</span>'
    )

    def _titlu_principal(sectiuni: dict, lang: str) -> str:
        if not principal:
            if contextual:
                return f'<div class="dossier-published">{status} · <strong>{NO_SELECTION[lang]}</strong></div>'
            return f'<div class="dossier-published">{status}</div>'
        market, probability, key = principal
        pct = (
            f"{probability:.2f}".rstrip("0").rstrip(".")
            if probability is not None
            else ""
        )
        total = re.fullmatch(r"over_([12])_5", key)
        if total and not contextual:
            n = total[1] + (".5" if lang == "en" else ",5")
            market = TOTAL_MARKET[lang].format(n=n)
        elif contextual or key in PRO_MARKETS:
            market = pro_market_label(key, lang, m)
        elif key in ("dc_1x", "dc_x2", "dc_12"):
            market = key.removeprefix("dc_").upper()
        elif lang != "ro":
            row = _principal_row(sectiuni["picks"])
            market = piata_din_linie(row) or market
        if lang != "en":
            pct = pct.replace(".", ",")
        estimate = f" · {pct}%" if pct else ""
        return f'<div class="dossier-published">{status} · <strong>{H.escape(market)}{estimate}</strong></div>'

    def _corp(p: dict, lang: str) -> str:
        verdict = f'<p><strong data-i18n="arhiva.sect.verdict">Verdict:</strong> {_inline(p["verdict"], lang)}</p>'
        reason = re.search(
            r"\s+[—–-]\s+(\d+(?:[.,]\d+)?)\s*%[.·]\s*(.+)",
            _principal_row(p["picks"]).replace("**", ""),
        )
        argument = (
            contextual_reason(item, p["picks"], lang)
            if contextual
            else (
                reason[2]
                if principal
                and reason
                and float(reason[1].replace(",", ".")) == principal[1]
                else ""
            )
        )
        if scor:
            result_key, result_text = {
                True: ("da", "✅ a ieșit"),
                False: ("nu", "❌ nu a ieșit"),
                None: ("neev", "neevaluabil din scor"),
            }[principal_ok]
            result = (
                f' · <span data-i18n="arhiva.semn.{result_key}">{result_text}</span>'
                if principal
                else ""
            )
            verif = (
                f'<p class="pro-verificat"><span data-i18n="pro.card.rezfinal" data-i18n-vars=\'{{"s":"{scor[0]}-{scor[1]}"}}\'>Rezultat final {scor[0]}-{scor[1]}</span>{result} '
                f'<a href="analize/{zi}.html#m{m["fixture_id"]}" data-i18n="pro.card.verif.link">Verificarea completă →</a></p>'
            )
        else:
            verif = '<p data-i18n="arhiva.fararez">Fără rezultat final în bază.</p>'
        alternatives = []
        if contextual:
            for pick in contextual_picks(item)[1:]:
                market = H.escape(pro_market_label(pick["key"], lang, m))
                reason = contextual_reason(item, p["picks"], lang, pick)
                alternatives.append(
                    f'<li>{ALTERNATIVE[lang]} · <strong>{market}</strong>'
                    + (f"<p>{_inline(reason, lang)}</p>" if reason else "")
                    + "</li>"
                )
        return "\n".join(
            [
                '      <div class="pro-visible">',
                f"        {_titlu_principal(p, lang)}",
                f"        <p>{_inline(argument, lang)}</p>"
                if argument
                else f"        {verdict}",
                '        <details class="dossier-context"><summary data-i18n="dashboard.analysis.read">Citește analiza</summary>',
                f"        {verdict}" if argument else "",
                f'        <p><strong data-i18n="arhiva.sect.context">Context:</strong> {_inline(p["context"], lang)}</p>',
                f'        <p><strong data-i18n="arhiva.sect.model">Modelul vs realitate:</strong> {_inline(p["model"], lang)}</p>',
                f'        <p><strong data-i18n="arhiva.sect.urmarit">De urmărit:</strong> {_inline(p["urmarit"], lang)}</p>',
                f'        <ul>{"".join(alternatives)}</ul>' if alternatives else "",
                "        </details>",
                '        <details class="dossier-review"><summary data-i18n="arhiva.th.rezultat">Rezultat</summary>',
                f"        {verif}",
                "        </details>",
                "      </div>",
            ]
        )

    # 7 oct 2026: analiza în limba aleasă când există traduceri (analysis_en/es/it din traduce_analize.py); app.js arată varianta [data-lang]
    variante = [f'<div data-lang="ro">\n{_corp(p, "ro")}\n</div>']
    for cod in (
        "en",
        "es",
        "it",
        "fr",
        "id",
    ):  # 14 oct 2026: + fr, + id (traduce_analize.py)
        text = item.get(f"analysis_{cod}") or ""
        pt = parseaza(text)
        if pt["verdict"] and (contextual or pt["picks"]):
            variante.append(f'<div data-lang="{cod}" hidden>\n{_corp(pt, cod)}\n</div>')
    corp = (
        f"<div data-lang-grup>{''.join(variante)}</div>"
        if len(variante) > 1
        else _corp(p, "ro")
    )
    return "\n".join(
        [
            (
                '<div class="pro-card" data-public-pro-report'
                f' data-sample-fixture="{int(m["fixture_id"])}"'
                f' data-sample-day="{H.escape(zi, quote=True)}">'
            ),
            f'      <div class="pro-card-head">{head}</div>',
            corp,
            "    </div>",
        ]
    )


def html_ieri(item: dict, zi: str, scor: tuple[int, int] | None) -> str:
    """Arată scorul exemplului public anterior, separat de pronosticul zilei."""
    m = item["match"]
    nume = f"{H.escape(m['home'])} – {H.escape(m['away'])}"
    v = {
        "meci": nume,
        "zi": zi,
        "fid": str(m["fixture_id"]),
        "scor": f"{scor[0]}-{scor[1]}" if scor else "",
        "baza": "",
    }
    var_attrs = H.escape(json.dumps(v, ensure_ascii=False), quote=True)
    if not scor:
        return f'<p class="pro-ieri muted" data-i18n="pro.ieri.fara" data-i18n-vars="{var_attrs}">Ieri, aici: <strong>{nume}</strong> — rezultatul final nu e încă în bază; verificarea apare în <a href="analize/{zi}.html">arhiva zilei</a>.</p>'
    return (
        f'<p class="pro-ieri" data-i18n="pro.ieri.cu" data-i18n-vars="{var_attrs}">Ieri, aici: <strong>{nume}</strong>, {v["scor"]}. '
        f'<a href="analize/{zi}.html#m{m["fixture_id"]}">Verificarea de a doua zi →</a></p>'
    )


def injecteaza(html: str, card: str, ieri: str = "") -> str:
    bloc = f"{START}\n    {card}" + (f"\n    {ieri}" if ieri else "") + f"\n    {END}"
    if START in html and END in html:
        return re.sub(
            re.escape(START) + r".*?" + re.escape(END), lambda _: bloc, html, flags=re.S
        )
    # 6 oct 2026: fără fallback „între .pro-card și .pro-disclaimer” — ștergea tot ce stătea între ele (blocul „Ce primești pentru 20 $”).
    raise SystemExit(
        f"[gen_pro_sample] markerii {START} / {END} lipsesc din index.html — abort, nimic scris"
    )


# ----------------------------------------------------------------- lista Pro de azi (cu lacăt)
def _ora_ro_iso(iso: str) -> str:
    try:
        from datetime import timezone

        d = datetime.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S").replace(
            tzinfo=timezone.utc
        )
        return d.astimezone(RO).strftime("%H:%M")
    except (ValueError, TypeError):
        return ""


def stat_30_zile(azi: str) -> tuple[int, int, int, int]:
    """(zile, medie, minim, maxim) analize Pro pe zi în ultimele 30 de zile dinaintea lui `azi` (din arhivă)."""
    de_la = (datetime.strptime(azi, "%Y-%m-%d") - timedelta(days=30)).strftime(
        "%Y-%m-%d"
    )
    n = []
    for f in sorted(ARHIVA.glob("????-??-??.json")):
        if de_la <= f.stem < azi:
            try:
                n.append(
                    len(
                        [
                            it
                            for it in (json.loads(f.read_text()).get("items") or [])
                            if it.get("match", {}).get("fixture_id")
                        ]
                    )
                )
            except (OSError, ValueError):
                pass
    n = [x for x in n if x]
    return (len(n), round(sum(n) / len(n)), min(n), max(n)) if n else (0, 0, 0, 0)


def html_lista_pro(
    rows: list[dict],
    fara_fid: int | None = None,
    stat: tuple[int, int, int, int] | None = None,
) -> str:
    """Meciurile analizate azi în Pro, doar nume/ligă/oră, cu lacăt — vizitatorul vede ce ar primi, nu primește."""
    rows = [
        r for r in rows if fara_fid is None or r.get("fixture_id") != fara_fid
    ]  # 6 oct 2026: fără card publicat → nimic exclus
    if not rows:
        return ""
    li = []
    for r in rows:
        ora = _ora_ro_iso(r.get("match_date", ""))
        tara = f" ({H.escape(r['country'])})" if r.get("country") else ""
        li.append(
            f"        <li>🔒 <strong>{H.escape(r['home'])} – {H.escape(r['away'])}</strong> · {H.escape(r.get('league', ''))}{tara}"
            + (f" · {ora}" if ora else "")
            + "</li>"
        )
    n = len(rows)
    linie_stat = []
    if stat and stat[0]:
        linie_stat = [
            f'      <p class="pro-today-stat muted" data-i18n="pro.today.stat" data-i18n-vars=\'{{"z":"{stat[0]}","m":"{stat[1]}","mi":"{stat[2]}","ma":"{stat[3]}"}}\'>În ultimele {stat[0]} de zile: în medie <strong>{stat[1]} analize Pro pe zi</strong>, minim {stat[2]}, maxim {stat[3]}.</p>'
        ]
    return "\n".join(
        [
            '<div class="pro-today">',
            f'      <p class="pro-today-head" data-i18n="pro.today.head" data-i18n-vars=\'{{"n":"{n}"}}\'>🔒 <strong>Încă {n} analize azi în Pro</strong>, cu context verificat (clasament, formă, H2H, absențe) — pe site și pe Discord, dimineața.</p>',
            '      <ul class="pro-today-list">',
            *li,
            "      </ul>",
            *linie_stat,
            "    </div>",
        ]
    )


def injecteaza_lista(html: str, lista: str) -> str:
    if not lista:
        return html
    bloc = f"{LISTA_START}\n    {lista}\n    {LISTA_END}"
    if LISTA_START in html and LISTA_END in html:
        return re.sub(
            re.escape(LISTA_START) + r".*?" + re.escape(LISTA_END),
            lambda _: bloc,
            html,
            flags=re.S,
        )
    i = html.find(END)
    if i < 0:
        raise SystemExit(
            "[gen_pro_sample] lipsește markerul cardului; rulează întâi cardul"
        )
    i += len(END)
    return html[:i] + "\n    " + bloc + html[i:]


def lista_pro_azi(zi: str) -> list[dict]:
    """Arată toate analizele zilei, după ce arhiva a fost scrisă."""
    try:
        day = json.loads((ARHIVA / f"{zi}.json").read_bytes())
    except (OSError, ValueError):
        return []
    if (
        not isinstance(day, dict)
        or day.get("date", zi) != zi
        or day.get("dry_run")
        or day.get("dryrun")
    ):
        return []
    rows = []
    for item in day.get("items") or []:
        match = item.get("match") or {}
        if not (
            match.get("fixture_id")
            and match.get("home")
            and match.get("away")
            and (item.get("analysis") or "").strip()
        ):
            continue
        rows.append(
            {
                "fixture_id": match["fixture_id"],
                "home": match["home"],
                "away": match["away"],
                "league": match.get("league") or "",
                "country": match.get("country") or "",
                "match_date": (item.get("provenance") or {}).get("original_kickoff_utc")
                or match.get("match_date")
                or "",
            }
        )
    return rows


# ----------------------------------------------------------------- CLI
def _public_sample(zi: str) -> dict | None:
    """Consultă doar ruta anonimă a exemplului, niciodată istoricul complet al membrilor."""
    try:
        request = Request(
            f"{PUBLIC_EXAMPLE}/{zi}",
            headers={"User-Agent": "POSEIDON-Site/1.0", "Accept": "application/json"},
        )
        with urlopen(request, timeout=4) as response:
            data = json.load(response)
        item = (
            data.get("item")
            if isinstance(data, dict) and data.get("date") == zi
            else None
        )
        return item if isinstance(item, dict) else None
    except (OSError, ValueError):
        return None


def _site_delivery(item: dict, receipt: dict) -> str | None:
    """Cu SHA-ul arhivei validat de citeste_livrari, păstrează doar chitanța exactă de site."""
    rows = receipt.get("deliveries")
    if receipt.get("schema") != 1 or not isinstance(rows, list):
        return None
    site_rows = [r for r in rows if isinstance(r, dict) and r.get("channel") == "site"]
    proof = item.get("provenance") or {}
    generated = PP.stamp(proof.get("generated_at_utc"))
    kickoff = PP.stamp(proof.get("original_kickoff_utc"))
    try:
        now = PP.utc_now()
        eligible, _ = PP.eligibilitate(item, {"deliveries": site_rows}, now=now)
    except (AttributeError, TypeError, ValueError):
        return None
    if not eligible:
        return None
    latest_allowed = PP.stamp(now)
    return min(
        published
        for row in site_rows
        if row.get("prediction_id") == proof["prediction_id"]
        and row.get("fixture_id") == item["match"]["fixture_id"]
        and row.get("original_kickoff_utc") == proof["original_kickoff_utc"]
        and (published := PP.stamp(row.get("published_at_utc")))
        and generated <= published < kickoff
        and published <= latest_allowed
    ).isoformat()


def _incarca(zi: str):
    f = ARHIVA / f"{zi}.json"
    if not f.exists():
        return None, ""
    raw = f.read_bytes()
    d = json.loads(raw)
    items = d.get("items") or []
    if not items or not items[0].get("match", {}).get("fixture_id"):
        return None, ""
    item = items[0]
    public = _public_sample(zi)
    # Worker-ul poate serializa 2.0 ca 2 și poate publica proiecția editorială.
    # Verificăm identitatea și proveniența exact, inclusiv pentru copia publică proiectată.
    if not public or any(item.get(key) != public.get(key) for key in ("match", "provenance")):
        return None, ""
    text_keys = {lang: "analysis" if lang == "ro" else f"analysis_{lang}" for lang in TOTAL_MARKET}
    canonical_text = {lang: item.get(key) for lang, key in text_keys.items()}
    public_text = {lang: public.get(key) for lang, key in text_keys.items()}
    projected_text = {
        lang: public_analysis_text(text, lang) if isinstance(text, str) else text
        for lang, text in canonical_text.items()
    }
    if public_text != canonical_text and public_text != projected_text:
        return None, ""
    try:
        receipt = PP.citeste_livrari(f)
        # Leagă chitanța de aceiași octeți din care am luat exemplul, inclusiv la scrieri concurente.
        if receipt.get("archive_sha256") != sha256(raw).hexdigest():
            receipt = {}
    except (AttributeError, OSError, ValueError):
        receipt = {}
    timestamp = (
        None
        if any(
            d.get(flag)
            for flag in (
                "published_late",
                "recovery_kind",
                "recovery_of",
                "exclude_from_forward_test",
                "dry_run",
                "dryrun",
            )
        )
        else _site_delivery(item, receipt)
    )
    return {**item, "_public_site_delivery": timestamp}, d.get("generated_at", "")


def _verdict(item: dict, result) -> tuple[tuple[int, int] | None, bool | None]:
    from gen_pro_arhiva import evalueaza_pick

    m = item["match"]
    scor, half = _date_rezultat(result)
    principal = _principal(item, parseaza(item["analysis"])["picks"])
    principal_ok = None
    if scor and principal:
        market = pro_market_for_settlement(principal[2], principal[0])
        principal_ok = evalueaza_pick(market, *scor, m["home"], m["away"], *half)
    return scor, principal_ok


def _exemplul_deja_pe_site(zi: str) -> int | None:
    """Identifică exemplul zilei și păstrează-l dacă verificarea externă cade."""
    html = INDEX.read_text(encoding="utf-8")
    _, _, sample = html.partition(START)
    sample, end, _ = sample.partition(END)
    if not end or f'data-sample-day="{zi}"' not in sample:
        return None
    fixture = re.search(r'\bdata-sample-fixture="(\d+)"', sample)
    return int(fixture[1]) if fixture else None


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--date", default=datetime.now(RO).strftime("%Y-%m-%d"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    azi = a.date
    ieri = (datetime.strptime(azi, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    it_azi, gen_azi = _incarca(azi)
    fid_card = None if it_azi else _exemplul_deja_pe_site(azi)
    it_ieri, _ = _incarca(ieri) if fid_card is None else (None, "")
    fids = [i["match"]["fixture_id"] for i in (it_azi, it_ieri) if i]
    rez = rezultate(fids) if fids else {}
    card, linie = None, ""
    if it_azi:
        zi_card = azi
        fid_card = it_azi["match"]["fixture_id"]
        card = html_card(it_azi, azi, *_verdict(it_azi, rez.get(fid_card)))
        linie = (
            html_ieri(
                it_ieri,
                ieri,
                _date_rezultat(rez.get(it_ieri["match"]["fixture_id"]))[0],
            )
            if it_ieri
            else ""
        )
        print(
            f"[gen_pro_sample] card AZI {azi}: {it_azi['match']['home']} – {it_azi['match']['away']} ({it_azi['match'].get('league')}), scrisă la {gen_azi[11:16]}"
        )
    elif it_ieri:
        card = html_card(
            it_ieri, ieri, *_verdict(it_ieri, rez.get(it_ieri["match"]["fixture_id"]))
        )
        zi_card = ieri
        fid_card = None
        linie = ""
        print(
            f"[gen_pro_sample] fără exemplu public confirmat pentru {azi} — rămâne exemplul de ieri ({ieri}: {it_ieri['match']['home']} – {it_ieri['match']['away']})"
        )
    else:
        print(f"[gen_pro_sample] nicio confirmare publică nouă pentru exemplul din {azi}")
    rows = lista_pro_azi(azi)
    if card is None and not rows:
        return
    print(
        f"[gen_pro_sample] lista Pro de azi ({azi}): {len(rows)} meciuri"
        + (", fără cel publicat" if fid_card else "")
    )
    if a.dry_run:
        if card is not None:
            print(card)
            print(linie)
        print(html_lista_pro(rows, fid_card, stat_30_zile(azi)))
        return
    html = INDEX.read_text(encoding="utf-8")
    if card is not None:
        html = injecteaza(html, card, linie)
    html = injecteaza_lista(html, html_lista_pro(rows, fid_card, stat_30_zile(azi)))
    INDEX.write_text(html, encoding="utf-8")
    print(f"[gen_pro_sample] scris {INDEX}" + (f" (card {zi_card})" if card else " (lista Pro)"))


if __name__ == "__main__":
    main()
