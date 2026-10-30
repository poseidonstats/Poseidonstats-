#!/usr/bin/env python3
"""Arhiva publică a analizelor Pro, cu „verificarea de a doua zi” (1 oct 2026, decizia Andreei: Pro în față, produs demonstrabil).

Ia TOATE analizele Pro arhivate (~/football_predictor/data/pro_analyses/<zi>.json — exact textul postat în #analize-pro și pe
site, generat în dimineața meciului), caută scorul final în football.db și scrie, pentru fiecare zi TRECUTĂ, o pagină cu
analizele integrale + un bloc de verificare generat automat din scor: fiecare pick (Bază / Principal / Curajos) cu
probabilitatea anunțată și dacă a ieșit, golurile așteptate vs reale, probabilitatea pe care modelul o dădea rezultatului
care s-a produs, și o lecție-șablon strict factuală. Textul de dinaintea meciului NU se modifică niciodată.
Ziua curentă nu se publică (e produsul Pro); trecutul e demonstrația — inclusiv analizele care au greșit.

Scrie: analize/index.html (ce e Pro, o zi în Pro, bilanțul pick-urilor cu N/hit/Wilson, lista zilelor) + analize/<zi>.html.
Uz: gen_pro_arhiva.py [--dry-run]   (chemat zilnic din daily_publish.sh după gen_pro_sample.py)"""

from __future__ import annotations

import argparse
import hashlib
import html as H
import json
import math
import re
import unicodedata
import sqlite3
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scor90 import _gol, scor_90  # noqa: E402
import provenienta_pro as PP  # noqa: E402
from gen_pro_sample import _data_ro, _inline, parseaza, piata_din_linie  # noqa: E402  (aceeași parsare ca exemplul de pe prima pagină)

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "analize"
ARHIVA = Path.home() / "football_predictor" / "data" / "pro_analyses"
DB = "file:" + str(Path.home() / "football_predictor" / "football.db") + "?mode=ro"
RO = ZoneInfo("Europe/Bucharest")
BASE = "https://poseidonstats.com"
TIP = {"🔒": "Bază", "🎯": "Principal", "💎": "Curajos"}
VERSIUNE_JS = "202610011300"


# ----------------------------------------------------------------- pick-uri
def pick_din_linie(linie: str) -> dict | None:
    """„🔒 **Bază:** **Peste 1.5 goluri — 88%.** motiv…” → {tip, piata, prob, motiv}. None dacă linia nu e un pick.
    Probabilitatea anunțată = primul procent din partea bold sau din primele ~60 de caractere de după ea (formatele reale:
    „— 88%.”, „· 76%”, „— **71%**”, „prob. reală ~13%”)."""
    tip = TIP.get(linie[:1])
    if (
        not tip or "fără pick curajos" in linie
    ):  # 20 oct 2026: rândul fix „fără pick curajos azi” nu e un pick
        return None
    rest = re.sub(r"^.\s*\*\*[^*]+:\*\*\s*", "", linie).strip()
    m = re.match(r"\*\*(.+?)\*\*\s*(.*)$", rest, re.S)
    piata_raw = (m.group(1) if m else rest.split("—")[0]).strip()
    motiv = (m.group(2) if m else rest[len(piata_raw) :]).strip()
    prob = None
    pm = re.search(r"(\d{1,3})\s*%", piata_raw)
    if pm:
        prob = int(pm.group(1))
    else:
        pm = re.match(r"^[^%]{0,60}?(\d{1,3})\s*%\*{0,2}\.?", motiv)
        if pm:
            prob = int(pm.group(1))
            motiv = motiv[pm.end() :]
    piata = re.split(r"\s+[—–·-]\s+", piata_raw)[0]
    piata = re.sub(r"\s*\(?~?\d{1,3}(?:\s*-\s*\d{1,3})?\s*%.*$", "", piata).strip(" *.")
    return {
        "tip": tip,
        "piata": piata,
        "prob": prob if prob is None or prob <= 100 else None,
        "motiv": motiv.strip(" —–-·.*"),
    }


def _norm(s: str) -> str:
    """Litere mici, fără diacritice (NFKD, 20 oct 2026: „Rīgas”, „Diósgyőri” rămâneau neevaluabile cu înlocuirea doar a diacriticelor românești)."""
    s = "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).strip()


def _text_piata(text: str) -> str:
    """Normalizează numai diacritice, case și spații; operatorii rămân în text."""
    text = "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    ).lower()
    return " ".join(text.split())


def _componenta_rezultat(p: str, low: str, g_h: int, g_a: int, home: str, away: str):
    """Recunoaște integral rezultatul și adnotarea, apoi judecă un singur scor.

    Numele/aliasurile provin numai din echipele meciului. Un semn sau un
    fragment de nume nu autorizează o condiție suplimentară necunoscută.
    """
    score = re.fullmatch(r"scor(?:ul)?\s*(?:corect|exact)?\s*(\d+)\s*[-–: ]\s*(\d+)", p)
    if score:
        return (g_h, g_a) == (int(score[1]), int(score[2]))

    def words(text):
        # Identitatea lexicală păstrează operatorii: „-1” nu este codul „1”.
        return _text_piata(text)

    known = {
        "1": "1",
        "2": "2",
        "x": "x",
        "egal": "x",
        "draw": "x",
        "1x": "1x",
        "x2": "x2",
        "12": "12",
        "dubla sansa 1x": "1x",
        "dubla sansa x2": "x2",
        "dubla sansa 12": "12",
        "victorie gazde": "1",
        "victorie gazdelor": "1",
        "gazda castiga": "1",
        "gazdele castiga": "1",
        "victorie oaspeti": "2",
        "victorie oaspetilor": "2",
        "oaspetii castiga": "2",
    }
    generic = {
        "fc",
        "club",
        "united",
        "city",
        "town",
        "sport",
        "sporting",
        "real",
        "athletic",
        "atletico",
        "deportivo",
        "stadt",
        "1908",
        "1928",
        "1948",
        "team",
        "women",
    }
    normalized = [words(home), words(away)]
    tokens = [
        {t for t in _norm(name).split() if len(t) >= 4 and t not in generic}
        for name in (home, away)
    ]
    aliases = [
        ({name} if name else set()) | (tokens[i] - tokens[1 - i])
        for i, name in enumerate(normalized)
    ]
    ambiguous = set()

    def register(text, code):
        if text in known and known[text] != code:
            ambiguous.add(text)
        else:
            known[text] = code

    for i, names in enumerate(aliases):
        win, double = ("1", "1x") if i == 0 else ("2", "x2")
        for name in names:
            register(name + " castiga", win)
            register("victorie " + name, win)
            register("victorie pentru " + name, win)
            register(name + " nu pierde", double)
            register(name + " sau egal", double)

    def lookup(text):
        key = words(text)
        return None if key in ambiguous else known.get(key)

    def annotation_matches(text, code):
        if lookup(text) == code:
            return True
        # The legacy bare-team annotation is allowed only with its exact side.
        side = 0 if code in ("1", "1x") else 1 if code in ("2", "x2") else None
        key = words(text)
        return (
            side is not None and key in aliases[side] and key not in aliases[1 - side]
        )

    # Parentheses are structural: validate all annotation text, never discard it.
    marked = re.fullmatch(r"(1x|x2|12|1|2|x)\s*\(([^()]+)\)", p)
    if marked:
        code, annotation = marked.groups()
        annotation_code = lookup(annotation)
        if words(annotation) == "dubla sansa" and code in ("1x", "x2", "12"):
            annotation_code = code
        if annotation_code != code and not annotation_matches(annotation, code):
            return None
    else:
        reversed_mark = re.fullmatch(r"([^()]+)\s*\((1x|x2|12|1|2|x)\)", p)
        if reversed_mark:
            annotation, code = reversed_mark.groups()
            if not annotation_matches(annotation, code):
                return None
        elif "(" in p or ")" in p:
            return None
        else:
            code = lookup(p)
            if code is None:
                # Existing abbreviated sign + full known team name/alias.
                labelled = re.fullmatch(r"(1x|x2|1|2)\s+(.+)", p)
                if labelled:
                    candidate, name = labelled.groups()
                    side = 0 if candidate in ("1", "1x") else 1
                    if (
                        words(name) in aliases[side]
                        and words(name) not in aliases[1 - side]
                    ):
                        code = candidate
            if code is None:
                return None
    return {
        "1": g_h > g_a,
        "2": g_a > g_h,
        "x": g_h == g_a,
        "1x": g_h >= g_a,
        "x2": g_a >= g_h,
        "12": g_h != g_a,
    }[code]


def scor_pauza(gh, ga, hth, hta) -> tuple[int, int] | None:
    """Pereche HT întreagă, nenegativă și compatibilă cu FT; fără fallback0.

    Refolosește validatorul numeric al scorerului comun FP/site. Nu schimbă
    politica de confirmare FT90 și nu lasă HT incomplet să devină0-0.
    """
    final = tuple(_gol(value) for value in (gh, ga))
    half = tuple(_gol(value) for value in (hth, hta))
    if None in final or None in half or any(h > f for h, f in zip(half, final)):
        return None
    return half


_PAUZA = r"\b(?:ht|pauza|pauzei|prima repriza|first half|1st half|repriza 1)\b"


def este_piata_pauza(piata: str) -> bool:
    """Perioada alege scorul, fără să autorizeze o piață necunoscută."""
    return bool(re.search(_PAUZA, _text_piata(piata)))


def piata_fara_perioada(piata: str) -> str:
    """Piața semantică rămâne aceeași, cu sau fără prefixul/sufixul HT."""
    text = _text_piata(piata)
    # Eliminăm numai parantezele care conțin o perioadă recunoscută;
    # o adnotare goală originară nu devine o piață validă.
    text = re.sub(r"\(\s*(?:(?:la|in|din)\s+)?" + _PAUZA + r"\s*\)", " ", text)
    text = re.sub(r"(?:(?:la|in|din)\s+)?" + _PAUZA, " ", text)
    text = re.sub(
        r"^\s*[🔒🎯💎]?\s*\*{0,2}(?:baza|principal|curajos|siguranta)\s*:\s*", "", text
    )
    return re.sub(r"\s+", " ", text).strip()


def evalueaza_pick(
    piata: str,
    gh: int,
    ga: int,
    home: str,
    away: str,
    hth: int | None = None,
    hta: int | None = None,
):
    """Gramatică ancorată comună: total de meci, GG și rezultat recunoscut.

    HT schimbă exclusiv ținta. Un nume de echipă lipit de peste/sub nu este
    total de meci nici înainte, nici după adăugarea perioadei. Nu validăm
    totaluri de echipă din totalul FT/HT. Componentele unui pick compus
    trebuie recunoscute integral și trebuie să iasă toate.
    """
    baza = piata_fara_perioada(piata)
    parts = re.split(r"\s*(?:\+(?!\s*$)|\bsi\b|\band\b|(?<=\s)&(?=\s))\s*", baza)
    components = []
    for part in parts:
        low = _norm(part)
        total = re.fullmatch(
            r"(?:total(?: goluri)?\s+)?(o|over|peste|u|under|sub)\s*(\d)[.,]5(?:\s+(?:goluri|goals|gol|goal|total))*",
            part,
        )
        alias = r"gg|btts|ambele(?: echipe)?(?: marcheaza| inscriu| marca)?|both teams(?: to score)?"
        btts = re.fullmatch(
            rf"(?:{alias})(?:(?:\s*/\s*|\s+)(?:{alias})|\s*\(\s*(?:{alias})\s*\))*(?:\s+(da|yes|nu|no))?",
            part,
        )
        if total:
            components.append(("total", (total[1], int(total[2]))))
        elif btts:
            components.append(("btts", btts[1] in ("nu", "no")))
        else:
            # Recunoașterea integrală a rezultatului/scorului are prioritate față
            # de euristici numerice: „1-5” nu este o linie de total „1.5”.
            # Parserul strict de mai jos refuză în continuare orice text necunoscut.
            components.append(("rezultat", (part, low)))
    pauza = este_piata_pauza(piata)
    half = scor_pauza(gh, ga, hth, hta)
    if pauza and half is None:
        return None
    g_h, g_a = half if pauza else (gh, ga)
    tot = g_h + g_a
    outcomes = []
    for kind, value in components:
        if kind == "total":
            operator, floor = value
            outcomes.append(
                tot > floor if operator in ("o", "over", "peste") else tot <= floor
            )
        elif kind == "btts":
            outcomes.append((g_h > 0 and g_a > 0) != value)
        else:
            raw, low = value
            result = _componenta_rezultat(raw, low, g_h, g_a, home, away)
            if result is None:
                return None
            outcomes.append(result)
    return all(outcomes) if outcomes else None


def wilson_lo(k: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    p = k / n
    d = 1 + z * z / n
    return (
        p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    ) / d


# ----------------------------------------------------------------- date
def rezultate(fids: list[int], *, database: str | None = None) -> dict[int, dict]:
    out = {}
    with sqlite3.connect(database or DB, uri=True) as con:
        con.execute("PRAGMA query_only=ON")
        con.row_factory = sqlite3.Row
        for fid in set(fids):
            row = con.execute("SELECT * FROM fixtures WHERE id=?", (fid,)).fetchone()
            r = dict(row) if row else {}
            score = scor_90(r)
            if score is not None:
                half = scor_pauza(
                    *score, r.get("halftime_home"), r.get("halftime_away")
                )
                out[fid] = {
                    "gh": score[0],
                    "ga": score[1],
                    "hth": half[0] if half is not None else None,
                    "hta": half[1] if half is not None else None,
                }
    return out


def _recuperare(f: Path, d: dict) -> dict:
    """Validează recuperarea separată; nu o promovează la publicare prematch.

    Cache-ul original identificat prin hash rămâne read-only. O coliziune cu
    arhiva canonică este refuzată, fără alegere implicită între două texte.
    """
    if (ARHIVA / f.name).exists():
        raise ValueError(f"coliziune arhivă canonică/recuperată: {f.name}")
    try:
        if datetime.strptime(f.stem, "%Y-%m-%d").strftime("%Y-%m-%d") != f.stem:
            raise ValueError("zi necanonică")
        if (
            d.get("date") != f.stem
            or d.get("recovery_kind") != "existing_pre_kickoff_cache_only"
            or d.get("recovery_of") != f"{f.stem}.dryrun.json"
            or d.get("generated_at_timezone") != "Europe/Bucharest"
            or not re.fullmatch(r"[0-9a-f]{64}", d.get("recovery_of_sha256", ""))
        ):
            raise ValueError("metadate incompatibile")
        generated = PP.stamp(d.get("generated_at_utc"))
        published = PP.stamp(d.get("published_at_utc"))
        local = datetime.fromisoformat(d["generated_at"])
        if (
            local.tzinfo is not None
            or local.date().isoformat() != f.stem
            or generated is None
            or published is None
            or generated != local.replace(tzinfo=RO)
            or published <= generated
        ):
            raise ValueError("cronologie invalidă")
        original = ARHIVA / d["recovery_of"]
        if hashlib.sha256(original.read_bytes()).hexdigest() != d["recovery_of_sha256"]:
            raise ValueError("hash cache original diferit")
    except (KeyError, TypeError, OSError, ValueError) as exc:
        raise ValueError(f"recuperare invalidă {f.name}: {exc}") from exc
    return {
        key: d[key]
        for key in (
            "generated_at_utc", "published_at_utc", "recovery_kind",
            "recovery_of", "recovery_of_sha256",
        )
    }


def citeste_arhiva() -> list[dict]:
    zile = []
    canonice = sorted(ARHIVA.glob("????-??-??.json"))
    recuperate = sorted((ARHIVA / "recuperate").glob("????-??-??.json"))
    for f in canonice + recuperate:
        d = json.loads(f.read_text())
        recovery = _recuperare(f, d) if f.parent.name == "recuperate" else None
        delivery = PP.citeste_livrari(f)
        items = [
            {
                **it,
                "_archive_excluded": bool(
                    recovery is not None
                    or d.get("exclude_from_forward_test") or d.get("published_late")
                ),
                "_deliveries": delivery,
            }
            for it in d.get("items") or []
            if it.get("match", {}).get("fixture_id")
        ]
        if items:
            zile.append(
                {
                    "zi": d.get("date") or f.stem,
                    "generat": d.get("generated_at", ""),
                    "items": items,
                    **({"_recovery": recovery} if recovery else {}),
                }
            )
    return sorted(zile, key=lambda z: z["zi"])


# ----------------------------------------------------------------- verificare
def verifica(item: dict, rez: dict | None) -> dict:
    m = item["match"]
    p = parseaza(item["analysis"])
    picks = [x for x in (pick_din_linie(linie) for linie in p["picks"]) if x]
    v = {
        "picks": picks,
        "rez": rez,
        "lectie": "",
        "model_goluri": None,
        "p_rezultat": None,
    }
    if not rez:
        return v
    gh, ga = rez["gh"], rez["ga"]
    for pk in picks:
        pk["ok"] = evalueaza_pick(
            pk["piata"], gh, ga, m["home"], m["away"], rez.get("hth"), rez.get("hta")
        )
    xg = (m.get("xg_home") or 0) + (m.get("xg_away") or 0)
    v["model_goluri"] = (round(xg, 1), gh + ga) if xg else None
    semn = "1" if gh > ga else "2" if ga > gh else "X"
    pr = {"1": m.get("p_home"), "X": m.get("p_draw"), "2": m.get("p_away")}[semn]
    v["p_rezultat"] = (semn, pr)
    baza = next((pk for pk in picks if pk["tip"] == "Bază"), None)
    princ = next((pk for pk in picks if pk["tip"] == "Principal"), None)
    ev = [pk for pk in picks if pk.get("ok") is not None]
    # 28 oct 2026 (Andreea: „Avem o greșeală de traducere”): fiecare frază a lecției are cheia ei în i18n.json, ca să se traducă în pagină;
    # textul românesc rămâne identic în v["lectie"]
    frz: list[tuple[str, dict[str, str], str]] = []

    def fraza(cheie: str, text: str, **variabile) -> None:
        frz.append(
            (f"arhiva.lectie.{cheie}", {k: str(x) for k, x in variabile.items()}, text)
        )

    if ev and all(pk["ok"] for pk in ev):
        fraza(
            "confirmat",
            "Modelul și contextul au mers în aceeași direcție, iar rezultatul le-a confirmat.",
        )
    elif baza and baza.get("ok") and princ and princ.get("ok") is False:
        if princ.get("prob"):
            fraza(
                "principal",
                f"Cifra de bază a ținut; pick-ul principal ({princ['prob']}%) nu — rezultatul a căzut în cei {100 - princ['prob']}% pe care analiza îi declara.",
                p=princ["prob"],
                r=100 - princ["prob"],
            )
        else:
            fraza("principal0", "Cifra de bază a ținut; pick-ul principal nu a ieșit.")
    elif baza and baza.get("ok") is False:
        if v["model_goluri"] and re.search(
            r"(?i)peste|over|sub|under|\bo\d|\bu\d", baza["piata"]
        ):
            a, b = v["model_goluri"]
            fraza(
                "supra" if a > b else "sub",
                f"Modelul a {'supra' if a > b else 'sub'}estimat golurile: aștepta {a:.1f}, au fost {b}.",
                a=f"{a:.1f}",
                b=b,
            )
        else:
            fraza(
                "baza",
                "Pick-ul de bază, cel cu probabilitatea cea mai mare din analiză, nu a ieșit.",
            )
    elif ev:
        fraza(
            "amestecat",
            "Rezultat amestecat: o parte din pick-uri au ieșit, o parte nu.",
        )
    else:
        fraza("neev", "Pick-urile nu pot fi judecate automat din scor.")
    if pr is not None:
        fraza(
            "rezultat",
            f"Rezultatului care s-a produs ({semn}) modelul îi dădea {pr}% înainte de meci.",
            s=semn,
            p=pr,
        )
    fraza("retro", "Probabilitățile nu se modifică retroactiv.")
    v["lectie"] = " ".join(text for _, _, text in frz)
    v["lectie_fraze"] = frz
    return v


# ----------------------------------------------------------------- HTML
def shell(
    titlu: str, descriere: str, canonical: str, corp: str, sus: str = "../"
) -> str:
    return f"""<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://poseidonstats.goatcounter.com https://poseidon-members.poseidonstats.workers.dev; font-src 'self'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{H.escape(titlu)}</title>
<meta name="description" content="{H.escape(descriere, quote=True)}">
<meta property="og:title" content="{H.escape(titlu, quote=True)}">
<meta property="og:description" content="{H.escape(descriere, quote=True)}">
<meta property="og:image" content="{BASE}/assets/icon-512.png">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<link rel="canonical" href="{canonical}">
<link rel="stylesheet" href="{sus}assets/style.css">
<link rel="manifest" href="{sus}manifest.json">
<meta name="theme-color" content="#1e3a8a">
<link rel="apple-touch-icon" href="{sus}assets/icon-192.png">
<script data-goatcounter="https://poseidonstats.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</head>
<body>

<div class="legal-banner" data-i18n="banner.legal">Statistici informative. Modelul poate greși. Verifică sursa. 18+.</div>

<header>
  <div class="container">
    <a class="brand" href="{sus}index.html"><img src="{sus}assets/icon-192.png" alt="POSEIDON" width="36" height="36"> <span>POSEIDON</span></a>
    <p class="tagline" data-i18n="arhiva.tagline">Analize Pro arhivate · text original neschimbat · verificare la 90 de minute</p>
    <nav>
      <a href="{sus}index.html" data-i18n="nav.predictii">Predicții</a>
      <a href="{sus}predictii/index.html" data-i18n="nav.ligi">Pe ligi</a>
      <a href="{sus}analize/index.html" class="active" data-i18n="nav.analize">Analize</a>
      <a href="{sus}istoric.html" data-i18n="nav.istoric">Istoric</a>
      <a href="{sus}track-record.html" data-i18n="nav.trackrecord">Track record</a>
      <a href="{sus}metodologie.html" data-i18n="nav.metodologie">Metodologie</a>
      <a class="patreon" href="{sus}index.html#abonament" data-i18n="nav.abonamente">Abonamente</a>
    </nav>
    <script src="{sus}assets/i18n-lite.js" data-sus="{sus}"></script>
  </div>
</header>

<main class="container">
{corp}
</main>

<footer>
  <div class="container">
    <p data-i18n="footer.title"><strong>POSEIDON</strong> — model statistic propriu, ratings Bayesian și calibrare Platt pe piață.</p>
    <p><strong>Informativ.</strong> NU sfat de pariere. NU garanție. Folosește responsabil. <strong>18+</strong>.</p>
    <p class="muted">Contact: <a href="mailto:contact@poseidonstats.com">contact@poseidonstats.com</a> · <a href="{sus}terms.html">Termeni</a></p>
  </div>
</footer>
</body>
</html>
"""


def _p(s: str) -> str:
    return "<br>".join(_inline(x) for x in s.split("\n") if x.strip())


def _vars(d: dict) -> str:
    """Variabilele unui element [data-i18n] ca JSON valid în atributul cu apostrofuri (valorile pot conține HTML)."""
    return json.dumps(d, ensure_ascii=False).replace("'", "&#39;")


def eticheta_din_linie(linie: str) -> str:
    """„🔒 **Base:** Over 1.5 goals — …” sau, în formatul din iulie–septembrie, „🔒 **Safe pick: Over 1.5 goals — 70%.**” → eticheta
    pick-ului, în limba rândului („Base”, „Safe pick”)."""
    m = re.match(r"^\W*\*\*([^*:]+?)\s?:", linie.strip())
    return m.group(1).strip() if m else ""


def html_analiza(item: dict, v: dict, generat: str, lang: str = "ro") -> str:
    """Analiza unei zile din arhivă. `item["analysis"]` e textul în limba variantei; `v` e verificarea făcută pe analiza românească.
    28 oct 2026 (Andreea: „Avem o greșeală de traducere”): variantele traduse iau pick-urile și rândurile tabelului din textul tradus,
    etichetele cifrelor modelului și frazele lecției au chei în i18n.json."""
    m = item["match"]
    p = parseaza(item["analysis"])
    rez = v["rez"]
    liga = H.escape(m.get("league", "")) + (
        f" ({H.escape(m['country'])})" if m.get("country") else ""
    )
    scor = (
        f'<strong data-i18n="arhiva.rezfinal" data-i18n-vars=\'{{"s":"{rez["gh"]}-{rez["ga"]}"}}\'>rezultat final {rez["gh"]}-{rez["ga"]}</strong>'
        if rez
        else '<em data-i18n="arhiva.fararez">fără rezultat final în bază</em>'
    )
    ora = generat[11:16] if len(generat) >= 16 else ""

    def _et(cheie: str, text: str) -> str:
        return f'<span data-i18n="{cheie}">{text}</span>'

    cifre = (
        f"1 {m.get('p_home')}% · X {m.get('p_draw')}% · 2 {m.get('p_away')}% · {_et('ligi.tm.o15', 'Peste 1.5')} {m.get('over15')}% · "
        f"{_et('ligi.tm.o25', 'Peste 2.5')} {m.get('over25')}% · {_et('arhiva.cifre.gg', 'GG')} {m.get('btts')}% · "
        f"{_et('arhiva.cifre.scor', 'scor probabil')} {H.escape(str(m.get('score', '')))}"
    )
    # pick-urile din textul tradus, pe tip (emoji): fiecare tip apare o dată într-o analiză; rândul „fără pick curajos” nu are pereche în verificare
    traduse: dict[str, tuple[str, str]] = {}
    if lang != "ro":
        for linie in p["picks"]:
            if linie[:1] in TIP and linie[:1] not in traduse:
                traduse[linie[:1]] = (eticheta_din_linie(linie), piata_din_linie(linie))
    emoji = {nume: e for e, nume in TIP.items()}
    if traduse:
        picks_html = "".join(f"<li>{_inline(linie)}</li>" for linie in p["picks"])
    else:
        picks_html = "".join(
            f"<li>{H.escape(pk['tip'])}: <strong>{_inline(pk['piata'])}</strong>"
            + (f" — {pk['prob']}%" if pk.get("prob") is not None else "")
            + (f" — {_inline(pk['motiv'])}" if pk.get("motiv") else "")
            + "</li>"
            for pk in v["picks"]
        )
    ver = ""
    if rez:
        rand = []
        for pk in v["picks"]:
            ok = pk.get("ok")
            semn = (
                '<span data-i18n="arhiva.semn.da">✅ a ieșit</span>'
                if ok
                else (
                    '<span data-i18n="arhiva.semn.nu">❌ nu a ieșit</span>'
                    if ok is False
                    else '<span data-i18n="arhiva.semn.neev">– neevaluabil din scor</span>'
                )
            )
            tip, piata = traduse.get(emoji.get(pk["tip"], ""), ("", ""))
            tip_html, piata_html = (
                (H.escape(tip), _inline(piata))
                if tip and piata
                else (H.escape(pk["tip"]), _inline(pk["piata"]))
            )
            rand.append(
                f"<tr><td>{tip_html}</td><td>{piata_html}</td><td>{'' if pk.get('prob') is None else str(pk['prob']) + '%'}</td><td>{semn}</td></tr>"
            )
        mg = v["model_goluri"]
        pr = v["p_rezultat"]
        lectie = " ".join(
            (
                f"<span data-i18n=\"{cheie}\" data-i18n-vars='{_vars(var)}'>{H.escape(text)}</span>"
                if var
                else f'<span data-i18n="{cheie}">{H.escape(text)}</span>'
            )
            for cheie, var, text in v.get("lectie_fraze") or []
        ) or H.escape(v["lectie"])
        extra = []
        if mg:
            extra.append(
                f'<span data-i18n="arhiva.goluri" data-i18n-vars=\'{{"a":"{mg[0]:.1f}","b":"{mg[1]}"}}\'>Goluri: modelul aștepta <strong>{mg[0]:.1f}</strong>, au fost <strong>{mg[1]}</strong>.</span>'
            )
        if pr and pr[1] is not None:
            extra.append(
                f'<span data-i18n="arhiva.rez1x2" data-i18n-vars=\'{{"r":"{pr[0]}","p":"{pr[1]}"}}\'>Rezultat 1X2: <strong>{pr[0]}</strong>, cu <strong>{pr[1]}%</strong> în model.</span>'
            )
        ver = f"""
      <div class="pro-verificare">
        <h4 data-i18n="arhiva.verif.h" data-i18n-vars='{{"scor":"{rez["gh"]}-{rez["ga"]}{f" ({rez['hth']}-{rez['hta']})" if rez.get("hth") is not None else ""}"}}'>Verificarea de a doua zi · {rez["gh"]}-{rez["ga"]}{f" (pauză {rez['hth']}-{rez['hta']})" if rez.get("hth") is not None else ""}</h4>
        <div class="table-wrap"><table class="audit-table"><thead><tr><th data-i18n="arhiva.th.pick">Pick</th><th data-i18n="arhiva.th.piata">Piața</th><th data-i18n="arhiva.th.anuntat">Anunțat</th><th data-i18n="arhiva.th.rezultat">Rezultat</th></tr></thead><tbody>{"".join(rand) or '<tr><td colspan="4">Analiza nu are pick-uri în formatul standard.</td></tr>'}</tbody></table></div>
        <p>{" ".join(extra)}</p>
        <p class="pro-lectie"><strong data-i18n="arhiva.lectia">Lecția:</strong> {lectie}</p>
      </div>"""
    return f"""
    <article class="pro-card pro-card-full" id="m{m["fixture_id"]}">
      <div class="pro-card-head">{H.escape(m["home"])} – {H.escape(m["away"])} · {liga} · <span data-date="{m.get("date", "")[:10]}">{_data_ro(m.get("date", ""))}</span> · {scor}</div>
      <div class="pro-visible">
        <p class="muted" data-i18n="arhiva.model.arhivat" data-i18n-vars='{_vars({"cifre": cifre, "ora": ora or "—"})}'>Cifrele arhivate: {cifre}. Ora din arhivă: {ora or "—"}. Textul original este reprodus neschimbat; eligibilitatea prospectivă se verifică separat.</p>
        <p><strong data-i18n="arhiva.sect.verdict">Verdict:</strong> {_p(p["verdict"])}</p>
        <p><strong data-i18n="arhiva.sect.context">Context:</strong> {_p(p["context"])}</p>
        <p><strong data-i18n="arhiva.sect.model">Modelul vs realitate:</strong> {_p(p["model"])}</p>
        <p><strong data-i18n="arhiva.sect.piete">Piețele alese:</strong></p><ul>{picks_html or '<li class="muted">—</li>'}</ul>
        <p><strong data-i18n="arhiva.sect.urmarit">De urmărit:</strong> {_p(p["urmarit"])}</p>{ver}
      </div>
    </article>"""


def html_recuperare(recovery: dict | None) -> str:
    """Notă vizibilă în șase limbi; ora publicării nu devine ora generării."""
    if not recovery:
        return ""
    notices = {
        "ro": "Publicată cu întârziere dintr-un cache existent. Nu intră în bilanțul prospectiv. Publicarea recuperării pentru membri, consemnată (UTC):",
        "en": "Published late from an existing cache. Excluded from the prospective record. Recorded publication of the recovery to members (UTC):",
        "es": "Publicada con retraso desde una caché existente. Excluida del balance prospectivo. Publicación de la recuperación para miembros, registrada (UTC):",
        "it": "Pubblicata in ritardo da una cache esistente. Esclusa dal bilancio prospettico. Pubblicazione del recupero per i membri, registrata (UTC):",
        "fr": "Publiée en retard depuis un cache existant. Exclue du bilan prospectif. Publication de la récupération pour les membres, enregistrée (UTC) :",
        "id": "Diterbitkan terlambat dari cache yang sudah ada. Tidak termasuk dalam catatan prospektif. Publikasi pemulihan kepada anggota, tercatat (UTC):",
    }
    published = H.escape(recovery["published_at_utc"], quote=True)
    variants = "".join(
        f'<p class="muted" data-lang="{lang}" data-recovery-lang="{lang}"'
        + (" hidden" if lang != "ro" else "")
        + f'>{H.escape(text)} <time datetime="{published}">{published}</time></p>'
        for lang, text in notices.items()
    )
    return '<div data-lang-grup data-pro-archive-kind="recovered-late">' + variants + "</div>"


def bilant(zile: list[dict], rez: dict) -> tuple[dict, list[dict]]:
    """Cohortă prospectivă: prima analiză eligibilă per fixture, un pick per rol.

    Ordinea se fixează prin generated_at_utc, prediction_id, zi. Nu depinde de
    rezultat sau probabilitate. Arhiva descriptivă completă rămâne vizibilă.
    Fiecare rol are cel mult o observație per fixture; rolurile nu se cumulează.
    """
    tot = {t: {"n": 0, "k": 0, "sp": 0, "np": 0} for t in TIP.values()}
    pe_zi = [
        {
            "zi": z["zi"],
            "n": len(z["items"]),
            "rez": 0,
            "baza": [0, 0],
            "princ": [0, 0],
            "eligibile": 0,
            "excluderi": Counter(),
            **({"_recovery": z["_recovery"]} if z.get("_recovery") else {}),
        }
        for z in zile
    ]
    candidates = []
    for zi_idx, z in enumerate(zile):
        for it in z["items"]:
            v = verifica(it, rez.get(it["match"]["fixture_id"]))
            pe_zi[zi_idx]["rez"] += bool(v["rez"])
            eligible, reason = PP.eligibilitate(it, it.get("_deliveries", {}))
            if it.get("_archive_excluded"):
                eligible, reason = False, "exclus_explicit"
            if not eligible:
                pe_zi[zi_idx]["excluderi"][reason] += 1
                continue
            proof = it["provenance"]
            candidates.append(
                (
                    PP.stamp(proof["generated_at_utc"]),
                    proof["prediction_id"],
                    z["zi"],
                    zi_idx,
                    it,
                    v,
                )
            )
    seen = set()
    for _, _, _, zi_idx, it, v in sorted(candidates, key=lambda c: c[:4]):
        fid = it["match"]["fixture_id"]
        if fid in seen:
            pe_zi[zi_idx]["excluderi"]["duplicat_fixture"] += 1
            continue
        seen.add(fid)
        r = pe_zi[zi_idx]
        r["eligibile"] += 1
        roles = set()
        for pk in v["picks"]:
            if pk["tip"] in roles:
                continue
            roles.add(pk["tip"])
            if pk.get("ok") is None:
                continue
            t = tot[pk["tip"]]
            t["n"] += 1
            t["k"] += int(pk["ok"])
            if pk.get("prob") is not None:
                t["sp"] += pk["prob"]
                t["np"] += 1
            key = {"Bază": "baza", "Principal": "princ"}.get(pk["tip"])
            if key:
                r[key][0] += int(pk["ok"])
                r[key][1] += 1
    return tot, pe_zi


def html_index(zile: list[dict], tot: dict, pe_zi: list[dict], azi: str) -> str:
    rows = ""
    for t, d in tot.items():
        if not d["n"]:
            continue
        hit = d["k"] / d["n"]
        wlo = wilson_lo(d["k"], d["n"])
        medie = d["sp"] / d["np"] if d["np"] else None
        rows += f"<tr><td>{t}</td><td>{d['n']}</td><td>{hit * 100:.1f}%</td><td>{wlo * 100:.1f}%</td><td>{'' if medie is None else f'{medie:.1f}%'}</td><td>{'' if medie is None else f'{(hit * 100 - medie):+.1f} pp'}</td></tr>"
    if not rows:
        rows = '<tr><td colspan="6" data-i18n="arhiva.bilant.faraeligibile">Nicio predicție eligibilă evaluabilă încă; arhiva descriptivă nu dovedește o rată prospectivă.</td></tr>'
    zile_html = "".join(
        f'<li><a href="{r["zi"]}.html"><span data-date="{r["zi"]}">{_data_ro(r["zi"])}</span></a> — <span data-i18n="arhiva.zi.linie" data-i18n-vars=\'{{"n":"{r["n"]}"}}\'>{r["n"]} analize</span>'
        + (
            f', <span data-i18n="arhiva.zi.baza" data-i18n-vars=\'{{"a":"{r["baza"][0]}/{r["baza"][1]}","b":"{r["princ"][0]}/{r["princ"][1]}"}}\'>bază {r["baza"][0]}/{r["baza"][1]}, principal {r["princ"][0]}/{r["princ"][1]}</span>'
            if r["rez"]
            else ', <span data-i18n="arhiva.zi.nerez">rezultate încă nerezolvate</span>'
        )
        + html_recuperare(r.get("_recovery")) + "</li>"
        for r in reversed(pe_zi)
    )
    n_tot = sum(len(z["items"]) for z in zile)
    n_eligible = sum(r["eligibile"] for r in pe_zi)
    n_excluded = sum(sum(r["excluderi"].values()) for r in pe_zi)
    intro_vars = _vars({
        "n": str(n_tot),
        "de_la": f'<span data-date="{zile[0]["zi"]}">{_data_ro(zile[0]["zi"])}</span>',
    })
    date_vars = _vars({"data": f'<span data-date="{azi}">{_data_ro(azi)}</span>'})
    corp = f"""
  <section class="intro">
    <h1 data-i18n="arhiva.h1">Analizele Pro, arhivate și verificate</h1>
    <p data-i18n="arhiva.intro.descriptiv" data-i18n-vars='{intro_vars}'>Aici sunt <strong>toate analizele Pro de până ieri</strong>, {n_tot} de la <span data-date="{zile[0]["zi"]}">{_data_ro(zile[0]["zi"])}</span>, reproduse din fișierele originale, plus <strong>verificarea de a doua zi</strong> făcută automat din scorul final. Inclusiv cele care au greșit. Analizele de azi sunt pentru membrii Pro, pe <a href="../index.html#abonament">site și Discord</a>.</p>
  </section>

  <section class="plans-pro-detail">
    <h2 data-i18n="plans.get.h">Ce primești pentru 20 $ pe lună</h2>
    <p data-i18n="plans.get.p">Nu cumperi o probabilitate diferită de cea publică: modelul și calibrarea sunt aceleași pentru toată lumea. Cumperi munca din jurul cifrei. În fiecare dimineață alegem meciurile la care contextul merită citit și, pentru fiecare, primești:</p>
    <div data-i18n="plans.get.list"><ul>
      <li>ce spune modelul și cât de puternică e probabilitatea, cu banda ei istorică</li>
      <li>forma recentă cu scoruri, clasamentul, absențele relevante, H2H când spune ceva</li>
      <li>unde contextul <strong>susține</strong> modelul și unde <strong>îl contrazice</strong></li>
      <li>capcanele pe care modelul numeric nu le vede</li>
      <li>pick-urile analizei: Bază, Principal, Curajos, fiecare cu probabilitatea anunțată</li>
    </ul></div>
    <p class="muted" data-i18n="plans.glosar">xG în analizele POSEIDON = golurile așteptate de modelul nostru pentru fiecare echipă, calibrat pe meciurile trecute, nu xG din șuturi.</p>
    <p data-i18n="plans.get.after">A doua zi revenim la aceeași analiză: ce am spus înainte de meci rămâne neschimbat, arătăm unde modelul și contextul au avut dreptate, unde au greșit și unde rezultatul a fost pur și simplu zgomot. Nu promitem profit. Nu vindem „ponturi sigure”. Nu schimbăm predicțiile după rezultat.</p>
    <h3 data-i18n="plans.day.h">O zi în Pro</h3>
    <div data-i18n="plans.day.list"><ol>
      <li><strong>05:30</strong> — predicțiile zilei sunt generate și înghețate.</li>
      <li><strong>07:30</strong> — apar analizele scrise pentru meciurile alese, pe site (cu contul Patreon) și pe Discord.</li>
      <li><strong>În analiză</strong> — model + context + contradicții + capcane + pick-uri cu probabilitate.</li>
      <li><strong>A doua zi</strong> — scorul final și verificarea analizei, aici, public.</li>
    </ol></div>
    <p class="plans-steps"><a class="plan-btn plan-btn-pro" href="../index.html#abonament" data-i18n="plans.pro.btn">Alege Pro — $20/lună</a> <span class="muted" data-i18n="unlock.alt">Vrei doar cifrele? Basic, 5 $/lună.</span></p>
  </section>

  <section class="audit">
    <h2 data-i18n="arhiva.bilant.h" data-i18n-vars='{date_vars}'>Bilanțul pick-urilor, până la <span data-date="{azi}">{_data_ro(azi)}</span></h2>
    <p data-i18n="arhiva.bilant.prospectiv">Bilanț prospectiv: numai analize cu intrări și versiune identificate prin hash, start original UTC și livrare observată înainte de start. Prima analiză eligibilă per meci, apoi primul pick per rol; alegerea nu folosește rezultatul. Fiecare rol este calculat separat. N numără pick-urile evaluabile la 90 de minute, nu toate analizele din arhivă. „Anunțat” este media probabilităților; Wilson jos este limita inferioară 95 %, fără garanția independenței perfecte dintre meciuri.</p>
    <p class="muted" data-i18n="arhiva.bilant.cohorta" data-i18n-vars='{{"total":"{n_tot}","elig":"{n_eligible}","excl":"{n_excluded}"}}'>Arhivă descriptivă: {n_tot} analize. Eligibile prospectiv: {n_eligible}; excluse sau duplicate: {n_excluded}. Analizele vechi fără dovada originală de publicare rămân lizibile, în afara acestui bilanț.</p>
    <div class="table-wrap"><table class="audit-table"><thead><tr><th data-i18n="arhiva.th.pick">Pick</th><th>N</th><th data-i18n="arhiva.th.iesit">A ieșit</th><th data-i18n="arhiva.th.wlo">Wilson jos</th><th data-i18n="arhiva.th.anuntat">Anunțat</th><th data-i18n="arhiva.th.dif">Diferența</th></tr></thead><tbody>{rows}</tbody></table></div>
    <p class="muted" data-i18n="arhiva.bilant.note">Bază = piața cu probabilitatea cea mai mare din model; Principal = pick-ul analizei; Curajos = pick de cotă, cu risc declarat. Bilanțul e pe pick-uri, nu pe bani: o rată mare pe probabilități mari nu înseamnă profit.</p>
  </section>

  <section>
    <h2 data-i18n="arhiva.zile.h">Zilele arhivate</h2>
    <ul class="pro-zile">{zile_html}</ul>
  </section>
"""
    return shell(
        "Analize Pro arhivate, cu verificarea de a doua zi | POSEIDON",
        f"Toate analizele Pro POSEIDON de până ieri ({n_tot}), neschimbate, cu scorul final și verificarea automată a fiecărui pick. Inclusiv cele care au greșit.",
        f"{BASE}/analize/index.html",
        corp,
    )


def html_zi(z: dict, rez: dict, prev: str | None, nxt: str | None) -> str:
    def _multi(it):
        # 7 oct 2026: analiza în 4 limbi când există traduceri (analysis_en/es/it, din traduce_analize.py); i18n-lite arată varianta limbii alese
        v = verifica(it, rez.get(it["match"]["fixture_id"]))
        ro = html_analiza(it, v, z["generat"])
        var = [f'<div data-lang="ro">{ro}</div>']
        for cod in ("en", "es", "it", "fr", "id"):  # 14 oct 2026: + fr, + id
            if it.get(f"analysis_{cod}"):
                var.append(
                    f'<div data-lang="{cod}" hidden>{html_analiza({**it, "analysis": it[f"analysis_{cod}"]}, v, z["generat"], cod)}</div>'
                )
        return f"<div data-lang-grup>{''.join(var)}</div>" if len(var) > 1 else ro

    # Cu recuperare, nota de publicare este distinctă de textele originale.
    # Fără recuperare concatenarea cu șirul gol păstrează corpul analizelor.
    arts = html_recuperare(z.get("_recovery")) + "".join(_multi(it) for it in z["items"])
    nav = " · ".join(
        x
        for x in [
            f'<a href="{prev}.html">← <span data-date="{prev}">{_data_ro(prev)}</span></a>'
            if prev
            else "",
            '<a href="index.html" data-i18n="arhiva.toate">toate zilele</a>',
            f'<a href="{nxt}.html"><span data-date="{nxt}">{_data_ro(nxt)}</span> →</a>'
            if nxt
            else "",
        ]
        if x
    )
    n_rez = sum(1 for it in z["items"] if rez.get(it["match"]["fixture_id"]))
    title_vars = _vars({
        "data": f'<span data-date="{z["zi"]}">{_data_ro(z["zi"])}</span>',
    })
    corp = f"""
  <section class="intro">
    <h1 data-i18n="arhiva.zi.h1" data-i18n-vars='{title_vars}'>Analizele Pro din <span data-date="{z["zi"]}">{_data_ro(z["zi"])}</span></h1>
    <p data-i18n="arhiva.zi.descriptiv" data-i18n-vars='{{"n":"{len(z["items"])}","rez":"{n_rez}"}}'>{len(z["items"])} analize arhivate, reproduse neschimbate; {n_rez} cu rezultat final și verificarea de a doua zi. <a href="index.html">Ce e Pro și bilanțul tuturor pick-urilor →</a></p>
    <p class="muted">{nav}</p>
  </section>
  {arts}
  <p class="muted">{nav}</p>
  <p class="pro-disclaimer" data-i18n="arhiva.disclaimer.descriptiv">Arhivă descriptivă; dovada prospectivă se verifică separat. Statistic · informativ · nu sfat de pariere · 18+</p>
"""
    primele = ", ".join(
        f"{it['match']['home']} – {it['match']['away']}" for it in z["items"][:3]
    )
    return shell(
        f"Analize Pro {_data_ro(z['zi'])}, cu rezultate | POSEIDON",
        f"{len(z['items'])} analize Pro din {_data_ro(z['zi'])} ({primele}…), textul de dinaintea meciului neschimbat, scorul final și verificarea fiecărui pick.",
        f"{BASE}/analize/{z['zi']}.html",
        corp,
    )


# ----------------------------------------------------------------- CLI
def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    azi = datetime.now(RO).strftime("%Y-%m-%d")
    zile = [z for z in citeste_arhiva() if z["zi"] < azi]
    if not zile:
        print("[gen_pro_arhiva] nicio zi trecută în arhivă")
        return
    rez = rezultate([it["match"]["fixture_id"] for z in zile for it in z["items"]])
    tot, pe_zi = bilant(zile, rez)
    neev = Counter()
    n_pk = 0
    for z in zile:
        for it in z["items"]:
            for pk in verifica(it, rez.get(it["match"]["fixture_id"]))["picks"]:
                n_pk += 1
                if rez.get(it["match"]["fixture_id"]) and pk.get("ok") is None:
                    neev[pk["piata"][:40]] += 1
    print(
        f"[gen_pro_arhiva] {len(zile)} zile, {sum(len(z['items']) for z in zile)} analize, {len(rez)} cu rezultat, {n_pk} pick-uri, neevaluabile {sum(neev.values())}"
    )
    for t, d in tot.items():
        print(
            f"  {t:10s} N={d['n']} a ieșit={d['k']} ({d['k'] / d['n'] * 100 if d['n'] else 0:.1f}%) Wlo={wilson_lo(d['k'], d['n']) * 100:.1f}% anunțat={d['sp'] / d['np'] if d['np'] else 0:.1f}%"
        )
    if neev:
        print("  neevaluabile:", neev.most_common(12))
    if a.dry_run:
        return
    OUT.mkdir(exist_ok=True)
    for i, z in enumerate(zile):
        (OUT / f"{z['zi']}.html").write_text(
            html_zi(
                z,
                rez,
                zile[i - 1]["zi"] if i else None,
                zile[i + 1]["zi"] if i + 1 < len(zile) else None,
            ),
            encoding="utf-8",
        )
    (OUT / "index.html").write_text(
        html_index(zile, tot, pe_zi, zile[-1]["zi"]), encoding="utf-8"
    )
    print(f"[gen_pro_arhiva] scris {len(zile)} pagini + index în {OUT}")


if __name__ == "__main__":
    main()
