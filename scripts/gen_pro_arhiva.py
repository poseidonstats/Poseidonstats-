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
import html as H
import json
import math
import re
import sqlite3
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_pro_sample import LUNI, _data_ro, _inline, parseaza  # noqa: E402  (aceeași parsare ca exemplul de pe prima pagină)

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
    if not tip:
        return None
    rest = re.sub(r"^.\s*\*\*[^*]+:\*\*\s*", "", linie).strip()
    m = re.match(r"\*\*(.+?)\*\*\s*(.*)$", rest, re.S)
    piata_raw = (m.group(1) if m else rest.split("—")[0]).strip(); motiv = (m.group(2) if m else rest[len(piata_raw):]).strip()
    prob = None
    pm = re.search(r"(\d{1,3})\s*%", piata_raw)
    if pm:
        prob = int(pm.group(1))
    else:
        pm = re.match(r"^[^%]{0,60}?(\d{1,3})\s*%\*{0,2}\.?", motiv)
        if pm:
            prob = int(pm.group(1)); motiv = motiv[pm.end():]
    piata = re.split(r"\s+[—–·-]\s+", piata_raw)[0]
    piata = re.sub(r"\s*\(?~?\d{1,3}(?:\s*-\s*\d{1,3})?\s*%.*$", "", piata).strip(" *.")
    return {"tip": tip, "piata": piata, "prob": prob if prob is None or prob <= 100 else None, "motiv": motiv.strip(" —–-·.*")}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("ș", "s").replace("ş", "s").replace("ț", "t").replace("ţ", "t").replace("ă", "a").replace("â", "a").replace("î", "i")).strip()


def evalueaza_pick(piata: str, gh: int, ga: int, home: str, away: str, hth: int | None = None, hta: int | None = None):
    """True/False dacă pick-ul a ieșit; None dacă nu-l pot judeca din scor. Acoperă formulările reale din arhivă."""
    p = piata.strip(); low = _norm(p); t = gh + ga
    ht = (hth is not None and hta is not None)
    pauza = bool(re.search(r"\b(ht|pauz|prima repriz|1st half|repriza 1)\b", low))
    if pauza and not ht:
        return None
    g_h, g_a, tot = (hth, hta, hth + hta) if pauza else (gh, ga, t)
    m = re.search(r"\b(?:o|over|peste|\+)\s*(\d)[.,\s]5\b", low) or re.search(r"\b(\d)[.,\s]5\s*\+", low)
    if m and not re.search(r"\b(sub|under|u\d)", low):
        return tot > int(m.group(1))
    m = re.search(r"\b(?:u|under|sub)\s*(\d)[.,\s]5\b", low)
    if m:
        return tot <= int(m.group(1))
    if re.search(r"\b(gg|btts|ambele|both teams)\b", low):
        nu = bool(re.search(r"\b(nu|no)\b", low)) and not re.search(r"\bgg\s*(da|yes)\b", low)
        return (g_h > 0 and g_a > 0) != nu
    semn = re.search(r"\((1|2|x)\)", p.lower())
    if semn and not re.search(r"\b(scor|exact)\b", low):
        return {"1": g_h > g_a, "2": g_a > g_h, "x": g_h == g_a}[semn.group(1)]
    GEN = {"fc", "club", "united", "city", "town", "sport", "sporting", "real", "athletic", "atletico", "deportivo", "stadt", "1908", "1928", "1948", "team", "women"}
    def _tok(n: str) -> set[str]:
        return {t for t in _norm(n).split() if len(t) >= 4 and t not in GEN}
    cuv = set(low.split()); h_in = bool(_tok(home) & cuv); a_in = bool(_tok(away) & cuv)
    if re.search(r"\b1x\b", low) or re.search(r"\bdubla sansa 1x\b", low) or (h_in and re.search(r"nu pierde|sau egal", low)):
        return g_h >= g_a
    if re.search(r"\bx2\b", low) or (a_in and re.search(r"nu pierde|sau egal", low)):
        return g_a >= g_h
    if re.search(r"\b12\b", low):
        return g_h != g_a
    if re.search(r"\(1\)|\bvictorie gazd|\bgazdele? castig|^1\b|\b1 \(", low) or (h_in and re.search(r"castig|victorie", low) and not a_in):
        return g_h > g_a
    if re.search(r"\(2\)|\bvictorie oaspet|\boaspetii castig|^2\b|\b2 \(", low) or (a_in and re.search(r"castig|victorie", low) and not h_in):
        return g_a > g_h
    if re.search(r"\begal\b|\(x\)|^x\b|\bdraw\b", low):
        return g_h == g_a
    m = re.search(r"\bscor(?:ul)?\s*(?:corect|exact)?\s*(\d)\s*[-–:\s]\s*(\d)\b", low)
    if m:
        return (g_h, g_a) == (int(m.group(1)), int(m.group(2)))
    return None


def wilson_lo(k: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    p = k / n; d = 1 + z * z / n
    return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d


# ----------------------------------------------------------------- date
def rezultate(fids: list[int]) -> dict[int, dict]:
    con = sqlite3.connect(DB, uri=True); out = {}
    for fid in fids:
        r = con.execute("select goals_home, goals_away, halftime_home, halftime_away, status_short from fixtures where id=?", (fid,)).fetchone()
        if r and r[0] is not None and r[4] in ("FT", "AET", "PEN"):
            out[fid] = {"gh": int(r[0]), "ga": int(r[1]), "hth": r[2], "hta": r[3]}
    return out


def citeste_arhiva() -> list[dict]:
    zile = []
    for f in sorted(ARHIVA.glob("????-??-??.json")):
        d = json.loads(f.read_text()); items = [it for it in d.get("items") or [] if it.get("match", {}).get("fixture_id")]
        if items:
            zile.append({"zi": d.get("date") or f.stem, "generat": d.get("generated_at", ""), "items": items})
    return zile


# ----------------------------------------------------------------- verificare
def verifica(item: dict, rez: dict | None) -> dict:
    m = item["match"]; p = parseaza(item["analysis"])
    picks = [x for x in (pick_din_linie(l) for l in p["picks"]) if x]
    v = {"picks": picks, "rez": rez, "lectie": "", "model_goluri": None, "p_rezultat": None}
    if not rez:
        return v
    gh, ga = rez["gh"], rez["ga"]
    for pk in picks:
        pk["ok"] = evalueaza_pick(pk["piata"], gh, ga, m["home"], m["away"], rez.get("hth"), rez.get("hta"))
    xg = (m.get("xg_home") or 0) + (m.get("xg_away") or 0)
    v["model_goluri"] = (round(xg, 1), gh + ga) if xg else None
    semn = "1" if gh > ga else "2" if ga > gh else "X"
    pr = {"1": m.get("p_home"), "X": m.get("p_draw"), "2": m.get("p_away")}[semn]
    v["p_rezultat"] = (semn, pr)
    baza = next((pk for pk in picks if pk["tip"] == "Bază"), None); princ = next((pk for pk in picks if pk["tip"] == "Principal"), None)
    ev = [pk for pk in picks if pk.get("ok") is not None]
    frz = []
    if ev and all(pk["ok"] for pk in ev):
        frz.append("Modelul și contextul au mers în aceeași direcție, iar rezultatul le-a confirmat.")
    elif baza and baza.get("ok") and princ and princ.get("ok") is False:
        frz.append(f"Cifra de bază a ținut; pick-ul principal ({princ['prob']}%) nu — rezultatul a căzut în cei {100 - princ['prob']}% pe care analiza îi declara." if princ.get("prob") else "Cifra de bază a ținut; pick-ul principal nu a ieșit.")
    elif baza and baza.get("ok") is False:
        if v["model_goluri"] and re.search(r"(?i)peste|over|sub|under|\bo\d|\bu\d", baza["piata"]):
            a, b = v["model_goluri"]; frz.append(f"Modelul a {'supra' if a > b else 'sub'}estimat golurile: aștepta {a:.1f}, au fost {b}.")
        else:
            frz.append("Pick-ul de bază, cel cu probabilitatea cea mai mare din analiză, nu a ieșit.")
    elif ev:
        frz.append("Rezultat amestecat: o parte din pick-uri au ieșit, o parte nu.")
    else:
        frz.append("Pick-urile nu pot fi judecate automat din scor.")
    if pr is not None:
        frz.append(f"Rezultatului care s-a produs ({semn}) modelul îi dădea {pr}% înainte de meci.")
    frz.append("Probabilitățile nu se modifică retroactiv.")
    v["lectie"] = " ".join(frz)
    return v


# ----------------------------------------------------------------- HTML
def shell(titlu: str, descriere: str, canonical: str, corp: str, sus: str = "../") -> str:
    return f"""<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://poseidonstats.goatcounter.com https://poseidon-members.poseidonstats.workers.dev; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'">
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
    <p class="tagline" data-i18n="arhiva.tagline">Analize Pro arhivate · textul de dinaintea meciului, neschimbat · verificarea de a doua zi</p>
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
    <p><strong>POSEIDON</strong> — model statistic propriu, ratings Bayesian cu calibrare per-ligă.</p>
    <p><strong>Informativ.</strong> NU sfat de pariere. NU garanție. Folosește responsabil. <strong>18+</strong>.</p>
    <p class="muted">Contact: <a href="mailto:contact@poseidonstats.com">contact@poseidonstats.com</a> · <a href="{sus}terms.html">Termeni</a></p>
  </div>
</footer>
</body>
</html>
"""


def _p(s: str) -> str:
    return "<br>".join(_inline(x) for x in s.split("\n") if x.strip())


def html_analiza(item: dict, v: dict, generat: str) -> str:
    m = item["match"]; p = parseaza(item["analysis"]); rez = v["rez"]
    liga = H.escape(m.get("league", "")) + (f" ({H.escape(m['country'])})" if m.get("country") else "")
    scor = f"<strong>rezultat final {rez['gh']}-{rez['ga']}</strong>" if rez else "<em>fără rezultat final în bază</em>"
    ora = generat[11:16] if len(generat) >= 16 else ""
    cifre = f"1 {m.get('p_home')}% · X {m.get('p_draw')}% · 2 {m.get('p_away')}% · Peste 1.5 {m.get('over15')}% · Peste 2.5 {m.get('over25')}% · GG {m.get('btts')}% · scor probabil {H.escape(str(m.get('score', '')))}"
    picks_html = "".join(f"<li>{H.escape(pk['tip'])}: <strong>{_inline(pk['piata'])}</strong>" + (f" — {pk['prob']}%" if pk.get("prob") is not None else "") + (f" — {_inline(pk['motiv'])}" if pk.get("motiv") else "") + "</li>" for pk in v["picks"])
    ver = ""
    if rez:
        rand = []
        for pk in v["picks"]:
            ok = pk.get("ok"); semn = "✅ a ieșit" if ok else ("❌ nu a ieșit" if ok is False else "– neevaluabil din scor")
            rand.append(f"<tr><td>{H.escape(pk['tip'])}</td><td>{_inline(pk['piata'])}</td><td>{'' if pk.get('prob') is None else str(pk['prob']) + '%'}</td><td>{semn}</td></tr>")
        mg = v["model_goluri"]; pr = v["p_rezultat"]
        extra = []
        if mg:
            extra.append(f"Goluri: modelul aștepta <strong>{mg[0]:.1f}</strong>, au fost <strong>{mg[1]}</strong>.")
        if pr and pr[1] is not None:
            extra.append(f"Rezultat 1X2: <strong>{pr[0]}</strong>, cu <strong>{pr[1]}%</strong> în model.")
        ver = f"""
      <div class="pro-verificare">
        <h4>🔎 Verificarea de a doua zi · {rez['gh']}-{rez['ga']}{f" (pauză {rez['hth']}-{rez['hta']})" if rez.get('hth') is not None else ''}</h4>
        <div class="table-wrap"><table class="audit-table"><thead><tr><th>Pick</th><th>Piața</th><th>Anunțat</th><th>Rezultat</th></tr></thead><tbody>{''.join(rand) or '<tr><td colspan="4">Analiza nu are pick-uri în formatul standard.</td></tr>'}</tbody></table></div>
        <p>{' '.join(extra)}</p>
        <p class="pro-lectie"><strong>Lecția:</strong> {H.escape(v['lectie'])}</p>
      </div>"""
    return f"""
    <article class="pro-card pro-card-full" id="m{m['fixture_id']}">
      <div class="pro-card-head">💎 {H.escape(m['home'])} – {H.escape(m['away'])} · {liga} · {_data_ro(m.get('date', ''))} · {scor}</div>
      <div class="pro-visible">
        <p class="muted">Model înainte de meci: {cifre}.{f' Analiza scrisă la {ora}, în dimineața meciului; reprodusă neschimbată.' if ora else ' Reprodusă neschimbată.'}</p>
        <p><strong>⚡ Verdict:</strong> {_p(p['verdict'])}</p>
        <p><strong>📊 Context:</strong> {_p(p['context'])}</p>
        <p><strong>🧮 Modelul vs realitate:</strong> {_p(p['model'])}</p>
        <p><strong>🎯 Piețele alese:</strong></p><ul>{picks_html or '<li class="muted">—</li>'}</ul>
        <p><strong>👁️ De urmărit:</strong> {_p(p['urmarit'])}</p>{ver}
      </div>
    </article>"""


def bilant(zile: list[dict], rez: dict) -> tuple[dict, list[dict]]:
    """Pe tip de pick: N evaluabil, câte au ieșit, Wilson lower, media probabilității anunțate. Plus rândul pe zi."""
    tot = {t: {"n": 0, "k": 0, "sp": 0, "np": 0} for t in TIP.values()}; pe_zi = []
    for z in zile:
        r = {"zi": z["zi"], "n": len(z["items"]), "rez": 0, "baza": [0, 0], "princ": [0, 0]}
        for it in z["items"]:
            v = verifica(it, rez.get(it["match"]["fixture_id"]))
            if v["rez"]:
                r["rez"] += 1
            for pk in v["picks"]:
                if pk.get("ok") is None:
                    continue
                t = tot[pk["tip"]]; t["n"] += 1; t["k"] += int(pk["ok"])
                if pk.get("prob") is not None:
                    t["sp"] += pk["prob"]; t["np"] += 1
                if pk["tip"] == "Bază":
                    r["baza"][0] += int(pk["ok"]); r["baza"][1] += 1
                elif pk["tip"] == "Principal":
                    r["princ"][0] += int(pk["ok"]); r["princ"][1] += 1
        pe_zi.append(r)
    return tot, pe_zi


def html_index(zile: list[dict], tot: dict, pe_zi: list[dict], azi: str) -> str:
    rows = ""
    for t, d in tot.items():
        if not d["n"]:
            continue
        hit = d["k"] / d["n"]; wlo = wilson_lo(d["k"], d["n"]); medie = d["sp"] / d["np"] if d["np"] else None
        rows += f"<tr><td>{t}</td><td>{d['n']}</td><td>{hit * 100:.1f}%</td><td>{wlo * 100:.1f}%</td><td>{'' if medie is None else f'{medie:.1f}%'}</td><td>{'' if medie is None else f'{(hit * 100 - medie):+.1f} pp'}</td></tr>"
    zile_html = "".join(f"<li><a href=\"{r['zi']}.html\">{_data_ro(r['zi'])}</a> — {r['n']} analize" + (f", bază {r['baza'][0]}/{r['baza'][1]}, principal {r['princ'][0]}/{r['princ'][1]}" if r["rez"] else ", rezultate încă nerezolvate") + "</li>" for r in reversed(pe_zi))
    n_tot = sum(len(z["items"]) for z in zile)
    corp = f"""
  <section class="intro">
    <h1>💎 Analizele Pro, arhivate și verificate</h1>
    <p>Aici sunt <strong>toate analizele Pro de până ieri</strong>, {n_tot} de la {_data_ro(zile[0]['zi'])}, exact cum au fost scrise în dimineața meciului, plus <strong>verificarea de a doua zi</strong> făcută automat din scorul final. Inclusiv cele care au greșit. Analizele de azi sunt pentru membrii Pro, pe <a href="../index.html#abonament">site și Discord</a>.</p>
  </section>

  <section class="plans-pro-detail">
    <h2>Ce primești pentru 20 $ pe lună</h2>
    <p>Nu cumperi o probabilitate diferită de cea publică: modelul și calibrarea sunt aceleași pentru toată lumea. Cumperi munca din jurul cifrei. În fiecare dimineață alegem meciurile la care contextul merită citit și, pentru fiecare, primești:</p>
    <ul>
      <li>ce spune modelul și cât de puternică e probabilitatea, cu banda ei istorică</li>
      <li>forma recentă cu scoruri, clasamentul, absențele relevante, H2H când spune ceva</li>
      <li>unde contextul <strong>susține</strong> modelul și unde <strong>îl contrazice</strong></li>
      <li>capcanele pe care modelul numeric nu le vede</li>
      <li>pick-urile analizei: Bază, Principal, Curajos, fiecare cu probabilitatea anunțată</li>
    </ul>
    <p>A doua zi revenim la aceeași analiză: ce am spus înainte de meci rămâne neschimbat, arătăm unde modelul și contextul au avut dreptate, unde au greșit și unde rezultatul a fost pur și simplu zgomot. Nu promitem profit. Nu vindem „ponturi sigure”. Nu schimbăm predicțiile după rezultat.</p>
    <h3>O zi în Pro</h3>
    <ol>
      <li><strong>05:30</strong> — predicțiile zilei sunt generate și înghețate.</li>
      <li><strong>07:30</strong> — apar analizele scrise pentru meciurile alese, pe site (cu contul Patreon) și pe Discord.</li>
      <li><strong>În analiză</strong> — model + context + contradicții + capcane + pick-uri cu probabilitate.</li>
      <li><strong>A doua zi</strong> — scorul final și verificarea analizei, aici, public.</li>
    </ol>
    <p class="plans-steps"><a class="plan-btn plan-btn-pro" href="../index.html#abonament">💎 Alege Pro — 20 $/lună</a> <span class="muted">Vrei doar cifrele? Basic, 5 $/lună.</span></p>
  </section>

  <section class="audit">
    <h2>Bilanțul pick-urilor, până la {_data_ro(azi)}</h2>
    <p>Fiecare pick e judecat automat din scorul final; cele care nu pot fi judecate din scor (de exemplu formulări libere) nu intră. „Anunțat” e media probabilității scrise în analiză; „diferența” e cât de des a ieșit față de cât am anunțat — zero ar fi calibrare perfectă. Interval Wilson 95 % (limita de jos) lângă fiecare rată, pentru că N contează mai mult decât procentul.</p>
    <div class="table-wrap"><table class="audit-table"><thead><tr><th>Pick</th><th>N</th><th>A ieșit</th><th>Wilson jos</th><th>Anunțat</th><th>Diferența</th></tr></thead><tbody>{rows}</tbody></table></div>
    <p class="muted">Bază = piața cu probabilitatea cea mai mare din model; Principal = pick-ul analizei; Curajos = pick de cotă, cu risc declarat. Bilanțul e pe pick-uri, nu pe bani: o rată mare pe probabilități mari nu înseamnă profit.</p>
  </section>

  <section>
    <h2>Zilele arhivate</h2>
    <ul class="pro-zile">{zile_html}</ul>
  </section>
"""
    return shell("Analize Pro arhivate, cu verificarea de a doua zi | POSEIDON", f"Toate analizele Pro POSEIDON de până ieri ({n_tot}), neschimbate, cu scorul final și verificarea automată a fiecărui pick. Inclusiv cele care au greșit.", f"{BASE}/analize/index.html", corp)


def html_zi(z: dict, rez: dict, prev: str | None, nxt: str | None) -> str:
    def _multi(it):
        # 7 oct 2026: analiza în 4 limbi când există traduceri (analysis_en/es/it, din traduce_analize.py); i18n-lite arată varianta limbii alese
        v = verifica(it, rez.get(it["match"]["fixture_id"])); ro = html_analiza(it, v, z["generat"])
        var = [f'<div data-lang="ro">{ro}</div>']
        for cod in ("en", "es", "it"):
            if it.get(f"analysis_{cod}"):
                var.append(f'<div data-lang="{cod}" hidden>{html_analiza({**it, "analysis": it[f"analysis_{cod}"]}, v, z["generat"])}</div>')
        return f'<div data-lang-grup>{"".join(var)}</div>' if len(var) > 1 else ro
    arts = "".join(_multi(it) for it in z["items"])
    nav = " · ".join(x for x in [f'<a href="{prev}.html">← {_data_ro(prev)}</a>' if prev else "", '<a href="index.html">toate zilele</a>', f'<a href="{nxt}.html">{_data_ro(nxt)} →</a>' if nxt else ""] if x)
    n_rez = sum(1 for it in z["items"] if rez.get(it["match"]["fixture_id"]))
    corp = f"""
  <section class="intro">
    <h1>💎 Analizele Pro din {_data_ro(z['zi'])}</h1>
    <p>{len(z['items'])} analize scrise în dimineața zilei, reproduse neschimbate; {n_rez} cu rezultat final și verificarea de a doua zi. <a href="index.html">Ce e Pro și bilanțul tuturor pick-urilor →</a></p>
    <p class="muted">{nav}</p>
  </section>
  {arts}
  <p class="muted">{nav}</p>
  <p class="pro-disclaimer">Exemple reale, pe date înghețate. Statistic · informativ · nu sfat de pariere · 18+</p>
"""
    primele = ", ".join(f"{it['match']['home']} – {it['match']['away']}" for it in z["items"][:3])
    return shell(f"Analize Pro {_data_ro(z['zi'])}, cu rezultate | POSEIDON", f"{len(z['items'])} analize Pro din {_data_ro(z['zi'])} ({primele}…), textul de dinaintea meciului neschimbat, scorul final și verificarea fiecărui pick.", f"{BASE}/analize/{z['zi']}.html", corp)


# ----------------------------------------------------------------- CLI
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    azi = datetime.now(RO).strftime("%Y-%m-%d")
    zile = [z for z in citeste_arhiva() if z["zi"] < azi]
    if not zile:
        print("[gen_pro_arhiva] nicio zi trecută în arhivă"); return
    rez = rezultate([it["match"]["fixture_id"] for z in zile for it in z["items"]])
    tot, pe_zi = bilant(zile, rez)
    neev = Counter(); n_pk = 0
    for z in zile:
        for it in z["items"]:
            for pk in verifica(it, rez.get(it["match"]["fixture_id"]))["picks"]:
                n_pk += 1
                if rez.get(it["match"]["fixture_id"]) and pk.get("ok") is None:
                    neev[pk["piata"][:40]] += 1
    print(f"[gen_pro_arhiva] {len(zile)} zile, {sum(len(z['items']) for z in zile)} analize, {len(rez)} cu rezultat, {n_pk} pick-uri, neevaluabile {sum(neev.values())}")
    for t, d in tot.items():
        print(f"  {t:10s} N={d['n']} a ieșit={d['k']} ({d['k'] / d['n'] * 100 if d['n'] else 0:.1f}%) Wlo={wilson_lo(d['k'], d['n']) * 100:.1f}% anunțat={d['sp'] / d['np'] if d['np'] else 0:.1f}%")
    if neev:
        print("  neevaluabile:", neev.most_common(12))
    if a.dry_run:
        return
    OUT.mkdir(exist_ok=True)
    for i, z in enumerate(zile):
        (OUT / f"{z['zi']}.html").write_text(html_zi(z, rez, zile[i - 1]["zi"] if i else None, zile[i + 1]["zi"] if i + 1 < len(zile) else None), encoding="utf-8")
    (OUT / "index.html").write_text(html_index(zile, tot, pe_zi, zile[-1]["zi"]), encoding="utf-8")
    print(f"[gen_pro_arhiva] scris {len(zile)} pagini + index în {OUT}")


if __name__ == "__main__":
    main()
