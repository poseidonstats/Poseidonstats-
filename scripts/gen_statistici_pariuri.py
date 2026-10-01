#!/usr/bin/env python3
"""„Statistici pariuri fotbal” — pagină publică pe interogările reale din Search Console (1 oct 2026: „statistici pariuri”,
„statistici cote pariuri”, „statistici pariuri fotbal” = 6 din primele 8 interogări, 0 clicuri, poziția 10-15).
Conținut pe care nu-l are nimeni: cât de des se adeveresc cotele de închidere ale unei case licențiate în România, pe 34.000+
meciuri, piață cu piață, cotă cu cotă, plus marja casei. Sursa: ~/odds_decoder/data/superbet_master.jsonl (privat; pe site
NU se numește casa — regula Andreei). Scrie statistici-pariuri.html (RO) și en/betting-odds-statistics.html (EN) + data/statistici_pariuri.json.
Uz: gen_statistici_pariuri.py [--dry-run]   (chemat din daily_publish.sh, best-effort)"""
from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SITE = Path(__file__).resolve().parent.parent
MASTER = Path.home() / "odds_decoder" / "data" / "superbet_master.jsonl"
OUT_RO = SITE / "statistici-pariuri.html"
OUT_EN = SITE / "en" / "betting-odds-statistics.html"
OUT_JSON = SITE / "data" / "statistici_pariuri.json"
BASE = "https://poseidonstats.com"
RO = ZoneInfo("Europe/Bucharest")
COTE = [(1.20, "1,01–1,20"), (1.40, "1,21–1,40"), (1.60, "1,41–1,60"), (1.80, "1,61–1,80"), (2.00, "1,81–2,00"), (2.50, "2,01–2,50"), (3.00, "2,51–3,00"),
        (4.00, "3,01–4,00"), (6.00, "4,01–6,00"), (10.0, "6,01–10,00"), (1e9, "peste 10")]
FAV = [(1.30, "sub 1,30"), (1.50, "1,30–1,50"), (1.80, "1,50–1,80"), (2.20, "1,80–2,20"), (1e9, "peste 2,20")]
PIETE = [("ft_o15", "Peste 1,5 goluri", "Over 1.5 goals"), ("ft_o25", "Peste 2,5 goluri", "Over 2.5 goals"), ("ft_o35", "Peste 3,5 goluri", "Over 3.5 goals"),
         ("gg", "Ambele echipe marchează", "Both teams to score"), ("ht_o05", "Gol în prima repriză", "Goal in the first half")]


def wlo(k: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    p = k / n
    return max(0.0, (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n))


def _bucket(x: float, scara) -> str:
    for lim, nume in scara:
        if x <= lim:
            return nume
    return scara[-1][1]


def citeste(path: Path = MASTER) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r.get("close") and r.get("ft_h") is not None and r.get("ft_a") is not None:
                rows.append(r)
    return rows


def statistici(rows: list[dict]) -> dict:
    """Toate tabelele paginii, din meciurile cu cotă de închidere + rezultat. Excludem femininul/tineretul/rezervele din tabelele pe
    cotă (profil de goluri diferit), dar le raportăm separat ca mărime."""
    seniori = [r for r in rows if not (r.get("fem") or r.get("tineret") or r.get("rez"))]
    cota = defaultdict(lambda: [0, 0, 0.0]); marje = defaultdict(list); gol = defaultdict(lambda: [0, 0, 0.0]); fav = defaultdict(lambda: [0, 0]); egal = defaultdict(lambda: [0, 0])
    gol_fem = defaultdict(lambda: [0, 0, 0.0])
    for r in rows:
        c = r["close"]; h, a = r["ft_h"], r["ft_a"]; tot = h + a; fem = r.get("fem") or r.get("tineret") or r.get("rez")
        m = c.get("1x2")
        if m and all(m.get(k) for k in ("o1", "ox", "o2")):
            marje["1X2"].append(m.get("marja", 0))
            if not fem:
                for k, ev in (("o1", h > a), ("ox", h == a), ("o2", h < a)):
                    b = _bucket(m[k], COTE); cota[b][0] += ev; cota[b][1] += 1; cota[b][2] += 1 / m[k]
                fav_odd, fav_k = min((m["o1"], "o1"), (m["o2"], "o2")); win = (h > a) if fav_k == "o1" else (a > h)
                b = _bucket(fav_odd, FAV); fav[b][0] += win; fav[b][1] += 1
                d = abs(m["p1"] - m["p2"]); b = "sub 5 pp" if d < 0.05 else "5–15 pp" if d < 0.15 else "15–30 pp" if d < 0.30 else "peste 30 pp"
                egal[b][0] += h == a; egal[b][1] += 1
        ht = ((r.get("ht_h") or 0) + (r.get("ht_a") or 0) > 0) if r.get("ht_h") is not None else None
        for k, ro, en in PIETE:
            if k in c and c[k].get("p") is not None:
                if c[k].get("marja") is not None:
                    marje[ro].append(c[k]["marja"])
                ev = {"ft_o15": tot > 1.5, "ft_o25": tot > 2.5, "ft_o35": tot > 3.5, "gg": h > 0 and a > 0, "ht_o05": ht}[k]
                if ev is None:
                    continue
                tgt = gol_fem if fem else gol; tgt[ro][0] += ev; tgt[ro][1] += 1; tgt[ro][2] += c[k]["p"]
    return {
        "generat_la": datetime.now(RO).strftime("%Y-%m-%d"), "n_total": len(rows), "n_seniori": len(seniori),
        "n_fem": sum(1 for r in rows if r.get("fem")), "n_tineret": sum(1 for r in rows if r.get("tineret")), "n_rez": sum(1 for r in rows if r.get("rez")),
        "de_la": min(r["ko"][:10] for r in rows), "pana_la": max(r["ko"][:10] for r in rows),
        "cota": [{"interval": nume, "n": cota[nume][1], "implicit": cota[nume][2] / cota[nume][1] * 100, "adeverit": cota[nume][0] / cota[nume][1] * 100, "wlo": wlo(cota[nume][0], cota[nume][1]) * 100}
                 for _, nume in COTE if cota[nume][1] >= 30],
        "marje": {k: {"medie": sum(v) / len(v) * 100, "n": len(v)} for k, v in marje.items() if v},
        "goluri": [{"piata": ro, "piata_en": en, "n": gol[ro][1], "casa": gol[ro][2] / gol[ro][1] * 100, "real": gol[ro][0] / gol[ro][1] * 100, "wlo": wlo(gol[ro][0], gol[ro][1]) * 100}
                   for _, ro, en in PIETE if gol[ro][1] >= 30],
        "goluri_fem": [{"piata": ro, "piata_en": en, "n": gol_fem[ro][1], "casa": gol_fem[ro][2] / gol_fem[ro][1] * 100, "real": gol_fem[ro][0] / gol_fem[ro][1] * 100}
                       for _, ro, en in PIETE if gol_fem[ro][1] >= 30],
        "favorit": [{"interval": nume, "n": fav[nume][1], "castiga": fav[nume][0] / fav[nume][1] * 100, "wlo": wlo(fav[nume][0], fav[nume][1]) * 100} for _, nume in FAV if fav[nume][1] >= 30],
        "egal": [{"interval": b, "n": egal[b][1], "egal": egal[b][0] / egal[b][1] * 100} for b in ("sub 5 pp", "5–15 pp", "15–30 pp", "peste 30 pp") if egal[b][1] >= 30],
    }


def _f(x: float, d: int = 1, en: bool = False) -> str:
    s = f"{x:.{d}f}"
    return s if en else s.replace(".", ",")


def _mii(n: int, en: bool = False) -> str:
    return f"{n:,}" if en else f"{n:,}".replace(",", ".")


def _shell(*, lang: str, title: str, description: str, canonical: str, body: str, alternate: str, up: str) -> str:
    ro = lang == "ro"
    alt = (f'<link rel="alternate" hreflang="ro" href="{canonical if ro else alternate}">\n<link rel="alternate" hreflang="en" href="{alternate if ro else canonical}">\n'
           f'<link rel="alternate" hreflang="x-default" href="{canonical if ro else alternate}">\n')
    nav = ("Predicții", "Pe ligi", "Simulator", "Istoric", "Track record", "Metodologie", "💎 Abonamente") if ro else ("Predictions", "By league", "Simulator", "History", "Track record", "Methodology", "💎 Membership")
    banner = "⚠️ Statistici informative. Modelul poate greși. Verifică sursa. 18+." if ro else "⚠️ Statistical information only. The model can be wrong. Verify the source. 18+."
    tag = "Probabilități publicate înainte de meci · <strong>track record verificabil</strong> · dataset public" if ro else "Probabilities published before kick-off · <strong>verifiable track record</strong> · public dataset"
    foot = ("⚠️ <strong>Informativ.</strong> NU sfat de pariere. <strong>NU garanție.</strong> Folosește responsabil. <strong>18+</strong>." if ro
            else "⚠️ <strong>Informational.</strong> NOT betting advice. <strong>NO guarantee.</strong> Play responsibly. <strong>18+</strong>.")
    terms = "Termeni și Condiții" if ro else "Terms"
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://poseidonstats.goatcounter.com; font-src 'self'; base-uri 'self'; form-action 'none';">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{BASE}/assets/icon-512.png">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<link rel="canonical" href="{canonical}">
{alt}<link rel="stylesheet" href="{up}assets/style.css">
<meta name="theme-color" content="#1e3a8a">
<link rel="apple-touch-icon" href="{up}assets/icon-192.png">
<script data-goatcounter="https://poseidonstats.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</head>
<body>

<div class="legal-banner">{banner}</div>

<header>
  <div class="container">
    <a href="{up}index.html" class="brand"><span class="brand-icon">🔱</span><span class="brand-name">POSEIDON</span><span class="brand-pulse"></span></a>
    <p class="tagline">{tag}</p>
    <nav>
      <a href="{up}index.html">{nav[0]}</a>
      <a href="{up}{'predictii' if ro else 'en/predictions'}/index.html">{nav[1]}</a>
      <a href="{up}simulator.html">{nav[2]}</a>
      <a href="{up}istoric.html">{nav[3]}</a>
      <a href="{up}track-record.html">{nav[4]}</a>
      <a href="{up}metodologie.html">{nav[5]}</a>
      <a href="{up}index.html#abonament">{nav[6]}</a>
    </nav>
  </div>
</header>

<main class="container">
{body}
</main>

<footer>
  <div class="container">
    <p><strong>POSEIDON</strong> — {'model statistic propriu, ratings Bayesian cu calibrare per-ligă.' if ro else 'our own statistical model, Bayesian ratings with per-league calibration.'}</p>
    <p>{foot}</p>
    <p class="muted">Contact: <a href="mailto:contact@poseidonstats.com">contact@poseidonstats.com</a> · <a href="{up}terms.html">{terms}</a></p>
  </div>
</footer>
</body>
</html>
"""


def _tabel(head: list[str], rows: list[list[str]]) -> str:
    th = "".join(f"<th>{h}</th>" for h in head); tr = "\n".join("      <tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'    <div class="table-wrap"><table class="audit-table"><thead><tr>{th}</tr></thead><tbody>\n{tr}\n    </tbody></table></div>'


def html_ro(S: dict) -> str:
    n = _mii(S["n_total"]); ns = _mii(S["n_seniori"])
    body = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Statistici pariuri fotbal: cât de des se adeveresc cotele</h1>
      <p class="hero-sub">{n} de meciuri jucate între {S['de_la']} și {S['pana_la']}, cu cota de închidere a unei case de pariuri licențiate în România și rezultatul real. Fără teorie: pe fiecare interval de cotă, câte s-au adeverit. Actualizat săptămânal.</p>
      <p class="hero-free">date reale · fără linkuri către case de pariuri · informativ · 18+</p>
    </div>
    <p>Cota spune cât cere casa; probabilitatea „implicită” e 1/cotă, cu marja casei inclusă. Coloana „s-a adeverit” e ce s-a întâmplat pe teren. Diferența dintre ele e marja plus eroarea casei. Tabelele de pe această pagină sunt pe meciuri de seniori ({ns}); femininul, tineretul și rezervele ({_mii(S['n_fem'])}, {_mii(S['n_tineret'])}, {_mii(S['n_rez'])} meciuri) sunt raportate separat mai jos, pentru că au alt profil de goluri.</p>
  </section>

  <section>
    <h2>1. Rezultatul final (1X2): cota și cât de des a ieșit</h2>
    <p>Fiecare selecție 1, X sau 2 din fiecare meci, grupată după cota ei de închidere. „Implicit” = media lui 1/cotă pe interval. „Minim 95 %” = limita de jos Wilson, ca să vezi cât e sigur și cât e zgomot.</p>
{_tabel(["Cota", "Selecții", "Implicit (1/cotă)", "S-a adeverit", "Minim 95 %"], [[r["interval"], _mii(r["n"]), _f(r["implicit"]) + " %", f"<strong>{_f(r['adeverit'])} %</strong>", _f(r["wlo"]) + " %"] for r in S["cota"]])}
    <p class="muted">Citire: la cotele mici, „s-a adeverit” e sub „implicit” cu 1–3 puncte, adică marja casei. La cotele mari diferența crește la 4–5 puncte: outsiderii ies mai rar decât spune cota, un tipar cunoscut al pieței, pentru care casa ia marja mai ales de la ei. Nicăieri „s-a adeverit” nu depășește 1/cotă cu o marjă sigură, ceea ce e răspunsul scurt la „ce cotă se adeverește mai des decât spune casa”: niciuna, pe termen lung.</p>
  </section>

  <section>
    <h2>2. Favoritul: cât de des câștigă, după cota lui</h2>
{_tabel(["Cota favoritului", "Meciuri", "Favoritul câștigă", "Minim 95 %"], [[r["interval"], _mii(r["n"]), f"<strong>{_f(r['castiga'])} %</strong>", _f(r["wlo"]) + " %"] for r in S["favorit"]])}
    <p class="muted">Un favorit sub 1,30 câștigă cam 4 din 5 meciuri; unul la 1,80–2,20 câștigă sub jumătate. Cota mică nu înseamnă „sigur”, înseamnă „des”.</p>
  </section>

  <section>
    <h2>3. Egalul: cât de des apare, după cât de echilibrat e meciul</h2>
{_tabel(["Diferența gazde–oaspeți (fără marjă)", "Meciuri", "Egal"], [[r["interval"], _mii(r["n"]), f"<strong>{_f(r['egal'])} %</strong>"] for r in S["egal"]])}
    <p class="muted">Egalul stă în jur de 1 din 4 la meciurile echilibrate și scade la 1 din 5 când e un favorit clar. „Meci echilibrat, deci iese egal” nu e o regulă: 3 din 4 meciuri echilibrate au un câștigător.</p>
  </section>

  <section>
    <h2>4. Golurile: ce spune casa și ce s-a întâmplat</h2>
{_tabel(["Piață", "Meciuri", "Casa spune (fără marjă)", "S-a întâmplat", "Minim 95 %"], [[r["piata"], _mii(r["n"]), _f(r["casa"]) + " %", f"<strong>{_f(r['real'])} %</strong>", _f(r["wlo"]) + " %"] for r in S["goluri"]])}
    <p class="muted">Pe goluri casa e aproape perfect calibrată: diferențele sunt de 0–3 puncte. Unde există o abatere, e în direcția „mai multe goluri decât spune casa”, dar mică și acoperită de marjă.</p>
    <h3>Feminin, tineret și rezerve, separat</h3>
{_tabel(["Piață", "Meciuri", "Casa spune", "S-a întâmplat"], [[r["piata"], _mii(r["n"]), _f(r["casa"]) + " %", f"<strong>{_f(r['real'])} %</strong>"] for r in S["goluri_fem"]])}
  </section>

  <section>
    <h2>5. Marja casei, pe piețe</h2>
{_tabel(["Piață", "Marja medie", "Meciuri"], [[k, f"<strong>{_f(v['medie'])} %</strong>", _mii(v["n"])] for k, v in sorted(S["marje"].items(), key=lambda kv: -kv[1]["medie"])])}
    <p class="muted">Marja e cât depășește 100 % suma probabilităților implicate de cote. La 10 % marjă, o cotă de 2,00 „spune” 50 %, dar șansa reală pe care o plătește casa e cam 45 %. Asta e prețul pe care îl plătești pe orice bilet, indiferent cât de bine alegi.</p>
  </section>

  <section>
    <h2>Ce faci cu statisticile astea</h2>
    <p>Trei lucruri, în ordinea importanței. Întâi, nicio cotă nu „se adeverește mai des decât spune casa” pe termen lung: tabelul 1 e dovada, pe {ns} de meciuri. Doi, calibrarea casei e foarte bună pe goluri și pe favoriți, deci cotele sunt o estimare onestă a șanselor, minus marja. Trei, dacă vrei probabilități fără marjă, pe toate meciurile zilei, calculate înainte de meci și verificate public după, pentru asta există <a href="index.html">POSEIDON</a>: 5 predicții complete gratuit pe zi, iar <a href="track-record.html">track record-ul</a> și <a href="track-record.html#dataset-section">datasetul</a> sunt publice.</p>
    <p class="muted">Sursa: cotele de închidere ale unei case de pariuri licențiate în România, colectate zilnic din {S['de_la']}, cu rezultatele finale. Marja e scoasă prin metoda „putere” (favoritul e mai supraevaluat decât outsiderul). Actualizat {S['generat_la']}. Pagina nu conține și nu va conține linkuri către case de pariuri.</p>
  </section>

  <p class="pro-disclaimer">statistici informative · nu sfat de pariere · nu garanție · 18+</p>
"""
    return _shell(lang="ro", title="Statistici pariuri fotbal: cât de des se adeveresc cotele | POSEIDON",
                  description=f"Statistici pariuri pe {n} de meciuri reale: cât de des se adeverește fiecare cotă, cât câștigă favoritul, cât de des iese egal, marja casei pe piețe. Date, nu păreri.",
                  canonical=f"{BASE}/statistici-pariuri.html", body=body, alternate=f"{BASE}/en/betting-odds-statistics.html", up="")


def html_en(S: dict) -> str:
    n = _mii(S["n_total"], True); ns = _mii(S["n_seniori"], True); E = True
    body = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Betting odds statistics: how often the odds come true</h1>
      <p class="hero-sub">{n} football matches played between {S['de_la']} and {S['pana_la']}, with the closing odds of a bookmaker licensed in Romania and the real result. No theory: for every odds range, how many came true. Updated weekly.</p>
      <p class="hero-free">real data · no bookmaker links · informational · 18+</p>
    </div>
    <p>The odds say what the bookmaker charges; the "implied" probability is 1/odds, margin included. "Came true" is what happened on the pitch. The gap between them is the margin plus the bookmaker's error. The tables are on senior matches ({ns}); women's, youth and reserve matches ({_mii(S['n_fem'], E)}, {_mii(S['n_tineret'], E)}, {_mii(S['n_rez'], E)}) are reported separately below, because their goal profile differs.</p>
  </section>

  <section>
    <h2>1. Full-time result (1X2): the odds and how often they came true</h2>
    <p>Every 1, X or 2 selection of every match, grouped by its closing odds. "Implied" = average of 1/odds in the range. "Floor 95%" = Wilson lower bound, so you can tell signal from noise.</p>
{_tabel(["Odds", "Selections", "Implied (1/odds)", "Came true", "Floor 95%"], [[r["interval"].replace(",", ".").replace("peste", "over"), _mii(r["n"], E), _f(r["implicit"], 1, E) + "%", f"<strong>{_f(r['adeverit'], 1, E)}%</strong>", _f(r["wlo"], 1, E) + "%"] for r in S["cota"]])}
    <p class="muted">Reading: at short odds, "came true" sits 1–3 points under "implied" — that is the margin. At long odds the gap grows to 4–5 points: outsiders win less often than the odds say, the well-known favourite-longshot bias, where the bookmaker takes most of its margin. Nowhere does "came true" beat 1/odds by a safe margin, which is the short answer to "which odds come true more often than the bookmaker says": none, in the long run.</p>
  </section>

  <section>
    <h2>2. The favourite: how often it wins, by its odds</h2>
{_tabel(["Favourite's odds", "Matches", "Favourite wins", "Floor 95%"], [[r["interval"].replace(",", ".").replace("sub", "under").replace("peste", "over"), _mii(r["n"], E), f"<strong>{_f(r['castiga'], 1, E)}%</strong>", _f(r["wlo"], 1, E) + "%"] for r in S["favorit"]])}
    <p class="muted">A favourite under 1.30 wins about 4 matches in 5; one at 1.80–2.20 wins fewer than half. Short odds do not mean "certain", they mean "often".</p>
  </section>

  <section>
    <h2>3. The draw: how often it happens, by how balanced the match is</h2>
{_tabel(["Home–away gap (margin removed)", "Matches", "Draw"], [[r["interval"].replace("sub", "under").replace("peste", "over"), _mii(r["n"], E), f"<strong>{_f(r['egal'], 1, E)}%</strong>"] for r in S["egal"]])}
    <p class="muted">The draw sits around 1 in 4 for balanced matches and drops to 1 in 5 with a clear favourite. "Balanced match, so it ends level" is not a rule: 3 balanced matches in 4 have a winner.</p>
  </section>

  <section>
    <h2>4. Goals: what the bookmaker says and what happened</h2>
{_tabel(["Market", "Matches", "Bookmaker says (margin removed)", "Happened", "Floor 95%"], [[r["piata_en"], _mii(r["n"], E), _f(r["casa"], 1, E) + "%", f"<strong>{_f(r['real'], 1, E)}%</strong>", _f(r["wlo"], 1, E) + "%"] for r in S["goluri"]])}
    <p class="muted">On goals the bookmaker is almost perfectly calibrated: the gaps are 0–3 points. Where there is a deviation it points to "more goals than the odds say", but it is small and covered by the margin.</p>
    <h3>Women's, youth and reserve matches, separately</h3>
{_tabel(["Market", "Matches", "Bookmaker says", "Happened"], [[r["piata_en"], _mii(r["n"], E), _f(r["casa"], 1, E) + "%", f"<strong>{_f(r['real'], 1, E)}%</strong>"] for r in S["goluri_fem"]])}
  </section>

  <section>
    <h2>5. The bookmaker's margin, by market</h2>
{_tabel(["Market", "Average margin", "Matches"], [[{"1X2": "1X2", "Peste 1,5 goluri": "Over/under 1.5", "Peste 2,5 goluri": "Over/under 2.5", "Peste 3,5 goluri": "Over/under 3.5", "Ambele echipe marchează": "Both teams to score", "Gol în prima repriză": "First-half goal"}.get(k, k), f"<strong>{_f(v['medie'], 1, E)}%</strong>", _mii(v["n"], E)] for k, v in sorted(S["marje"].items(), key=lambda kv: -kv[1]["medie"])])}
    <p class="muted">The margin is how far the sum of the implied probabilities exceeds 100%. At a 10% margin, odds of 2.00 "say" 50%, but the real chance the bookmaker pays for is about 45%. That is the price on every slip, however well you pick.</p>
  </section>

  <section>
    <h2>What to do with these statistics</h2>
    <p>Three things, in order. First, no odds "come true more often than the bookmaker says" in the long run: table 1 is the evidence, on {ns} matches. Second, the bookmaker's calibration is very good on goals and on favourites, so the odds are an honest estimate of the chances, minus the margin. Third, if you want margin-free probabilities for every match of the day, computed before kick-off and publicly verified after, that is what <a href="../index.html">POSEIDON</a> is for: 5 complete predictions free every day, with a public <a href="../track-record.html">track record</a> and <a href="../track-record.html#dataset-section">dataset</a>.</p>
    <p class="muted">Source: closing odds of a bookmaker licensed in Romania, collected daily since {S['de_la']}, with final results. Margin removed with the "power" method (the favourite is more overpriced than the outsider). Updated {S['generat_la']}. This page contains no bookmaker links and never will.</p>
  </section>

  <p class="pro-disclaimer">informational statistics · not betting advice · no guarantee · 18+</p>
"""
    return _shell(lang="en", title="Betting Odds Statistics: How Often Football Odds Come True | POSEIDON",
                  description=f"Betting statistics on {n} real football matches: how often each odds range comes true, how often the favourite wins, how often the draw happens, the bookmaker's margin by market.",
                  canonical=f"{BASE}/en/betting-odds-statistics.html", body=body, alternate=f"{BASE}/statistici-pariuri.html", up="../")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    rows = citeste(); S = statistici(rows)
    print(f"[statistici_pariuri] {S['n_total']} meciuri ({S['n_seniori']} seniori) · {len(S['cota'])} intervale de cotă · {len(S['goluri'])} piețe de goluri")
    if a.dry_run:
        print(json.dumps({k: v for k, v in S.items() if k != "cota"}, ensure_ascii=False)[:600]); return
    OUT_JSON.write_text(json.dumps(S, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_RO.write_text(html_ro(S), encoding="utf-8"); OUT_EN.parent.mkdir(parents=True, exist_ok=True); OUT_EN.write_text(html_en(S), encoding="utf-8")
    print(f"[statistici_pariuri] scris {OUT_RO.name} + en/{OUT_EN.name} + {OUT_JSON.name}")


if __name__ == "__main__":
    main()
