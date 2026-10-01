#!/usr/bin/env python3
"""Paginile de ligă în ENGLEZĂ — /en/predictions/<slug>.html + hub (1 oct 2026, după răspunsurile 4-5 ChatGPT: clientul care
plătește caută în engleză „premier league predictions”, „football probability model”). Aceleași date ca paginile românești
(gen_seo_pages: LEAGUES, predictions.json, calibration.json, history.json), text propriu în engleză (nu traducere mecanică),
titlu pe intenția de căutare, hreflang ro ↔ en. Chemat din gen_seo_pages.main() după paginile românești; întoarce URL-urile pentru sitemap."""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime

import gen_seo_pages as G
from gen_seo_pages import BASE, FEREASTRA_ZILE, PRAG_TIER_MIN, TZ, blocat, e, wilson_lo

OUT_EN = G.SITE / "en" / "predictions"
TARI_EN = {"anglia": "england", "spania": "spain", "italia": "italy", "germania": "germany", "franta": "france", "olanda": "netherlands",
           "portugalia": "portugal", "turcia": "turkey", "belgia": "belgium", "scotia": "scotland", "elvetia": "switzerland", "grecia": "greece",
           "polonia": "poland", "cehia": "czechia", "danemarca": "denmark", "norvegia": "norway", "suedia": "sweden", "rusia": "russia",
           "ucraina": "ukraine", "sua": "usa", "brazilia": "brazil", "romania": "romania", "austria": "austria", "argentina": "argentina"}
NUME_TARA_EN = {"Anglia": "England", "Spania": "Spain", "Italia": "Italy", "Germania": "Germany", "Franța": "France", "Olanda": "Netherlands",
                "Portugalia": "Portugal", "Turcia": "Turkey", "Belgia": "Belgium", "Scoția": "Scotland", "Elveția": "Switzerland", "Grecia": "Greece",
                "Polonia": "Poland", "Cehia": "Czechia", "Danemarca": "Denmark", "Norvegia": "Norway", "Suedia": "Sweden", "Rusia": "Russia",
                "Ucraina": "Ukraine", "SUA": "USA", "Brazilia": "Brazil", "România": "Romania", "SuperLiga României": "Romania", "Austria": "Austria", "Argentina": "Argentina"}
LIGA_EN = {"Prima ligă": "First League", "Brasileirão Série A": "Serie A"}
# liga → țara pentru care numele merge FĂRĂ țară în engleză; altfel „<Țară> <Ligă>” (Romania Liga 1, Brazil Serie A, Russia Premier League)
TARA_IMPLICITA = {"Premier League": "England", "Serie A": "Italy", "Bundesliga": "Germany", "Super League": None, "Liga 1": None, "Liga 2": None,
                  "Superliga": None, "Premiership": "Scotland", "First League": None}
MARKETS_EN = [("Over 1.5 goals", "prob_over_1_5"), ("Over 2.5 goals", "prob_over_2_5"), ("Over 3.5 goals", "prob_over_3_5"),
              ("Home win", "prob_home"), ("Away win", "prob_away"), ("Both teams to score", "prob_btts")]


def slug_en(slug: str) -> str:
    pre, _, rest = slug.partition("-")
    return f"{TARI_EN[pre]}-{rest}" if pre in TARI_EN and rest else slug


ADJ_TARA = {"Czechia": "Czech", "Denmark": "Danish", "Switzerland": "Swiss", "Greece": "Greek"}   # „Czech First League”, „Swiss Super League”


def nume_en(nume: str) -> str:
    m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", nume)
    if not m:
        return nume
    liga, tara = LIGA_EN.get(m.group(1).strip(), m.group(1).strip()), NUME_TARA_EN.get(m.group(2).strip(), m.group(2).strip())
    if liga not in TARA_IMPLICITA or TARA_IMPLICITA[liga] == tara:
        return liga
    return f"{ADJ_TARA.get(tara, tara)} {liga}"


def url_en(slug: str) -> str:
    return f"{BASE}/en/predictions/{slug_en(slug)}.html"


def url_ro(slug: str) -> str:
    return f"{BASE}/predictii/{slug}.html"


def hreflang(ro: str, en: str) -> str:
    return (f'<link rel="alternate" hreflang="ro" href="{e(ro)}">\n<link rel="alternate" hreflang="en" href="{e(en)}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{e(ro)}">\n')


def shell_en(*, title: str, description: str, canonical: str, body: str, jsonld: str = "", alternate_ro: str | None = None) -> str:
    up = "../../"
    alt = hreflang(alternate_ro, canonical) if alternate_ro else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://poseidonstats.goatcounter.com; font-src 'self'; base-uri 'self'; form-action 'none';">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{BASE}/assets/icon-512.png">
<meta property="og:url" content="{e(canonical)}">
<meta property="og:type" content="website">
<link rel="canonical" href="{e(canonical)}">
{alt}<link rel="stylesheet" href="{up}assets/style.css">
<meta name="theme-color" content="#1e3a8a">
<link rel="apple-touch-icon" href="{up}assets/icon-192.png">
<script data-goatcounter="https://poseidonstats.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
{jsonld}</head>
<body>

<div class="legal-banner">⚠️ Statistical information only. The model can be wrong. Verify the source. 18+.</div>

<header>
  <div class="container">
    <a href="{up}index.html" class="brand">
      <span class="brand-icon">🔱</span>
      <span class="brand-name">POSEIDON</span>
      <span class="brand-pulse"></span>
    </a>
    <p class="tagline">Probabilities published before kick-off · <strong>verifiable track record</strong> · public dataset</p>
    <nav>
      <a href="{up}index.html">Predictions</a>
      <a href="index.html">By league</a>
      <a href="{up}simulator.html">Simulator</a>
      <a href="{up}analize/index.html">Analyses</a>
      <a href="{up}istoric.html">History</a>
      <a href="{up}track-record.html">Track record</a>
      <a href="{up}metodologie.html">Methodology</a>
      <a href="{up}index.html#abonament">💎 Membership</a>
    </nav>
  </div>
</header>

<main class="container">
{body}
</main>

<footer>
  <div class="container">
    <p><strong>POSEIDON</strong> — our own statistical model, Bayesian ratings with per-league calibration.</p>
    <p>⚠️ <strong>Informational.</strong> NOT betting advice. <strong>NO guarantee.</strong> Play responsibly. <strong>18+</strong>.</p>
    <p class="muted">Contact: <a href="mailto:contact@poseidonstats.com">contact@poseidonstats.com</a> · <a href="{up}terms.html">Terms</a></p>
  </div>
</footer>
</body>
</html>
"""


def match_table_en(matches: list[dict]) -> str:
    rows = []
    for m in matches:
        dt = datetime.fromisoformat(m["match_date"].replace("Z", "+00:00")).astimezone(TZ)
        best = None
        if not blocat(m):
            for label, key in MARKETS_EN:
                p = m.get(key)
                if p is not None and (best is None or p > best[0]):
                    best = (p, label)
        top = f'<span class="piata-max">{e(best[1])} · {round(best[0] * 100)}%</span>' if best else '<span class="muted">—</span>'
        uncal = "" if m.get("calibrated") else ' <span class="warn-tag">⚠️ uncalibrated</span>'
        when = f"{dt.strftime('%d.%m')} <span class=\"muted\">{dt.strftime('%H:%M')}</span>"
        fixture = f"<strong>{e(m['home_team'])}</strong> – <strong>{e(m['away_team'])}</strong>{uncal}"
        if blocat(m):
            rows.append(f"""        <tr class="rand-blocat">
          <td>{when}</td>
          <td>{fixture}</td>
          <td colspan="4" class="blocat-note">🔒 this match's probabilities are for members</td>
          <td><a href="../../index.html#abonament" class="blocat-link">membership</a></td>
        </tr>""")
        else:
            rows.append(f"""        <tr class="rand-liber">
          <td>{when}</td>
          <td>{fixture} <span class="free-tag">✓ FREE TODAY</span></td>
          <td>{round(m['prob_home'] * 100)}% · {round(m['prob_draw'] * 100)}% · {round(m['prob_away'] * 100)}%</td>
          <td>{round(m['prob_over_1_5'] * 100)}%</td>
          <td>{round(m['prob_over_2_5'] * 100)}%</td>
          <td>{round(m['prob_btts'] * 100)}%</td>
          <td>{top}</td>
        </tr>""")
    return f"""    <div class="calibration-card">
      <table>
        <thead><tr>
          <th>When</th><th>Match</th><th>1 · X · 2</th>
          <th>Over 1.5</th><th>Over 2.5</th><th>BTTS</th><th>Most likely market</th>
        </tr></thead>
        <tbody>
{chr(10).join(rows)}
        </tbody>
      </table>
      <p class="muted" style="font-size:.82rem">Times are Romania time (CET+1). Probabilities are the empirically calibrated ones, not the raw model output. The last column only says which of the tracked markets has the highest calibrated probability — a description of the model's output, not a recommendation; a high percentage is still a probability, not a certainty. The model computes every match in the list; 5 a day are published free, the rest are for <a href="../../index.html#abonament">members</a>.</p>
    </div>"""


def calibration_en(entry: dict | None, name: str) -> str:
    if not entry:
        return '<p class="muted">This league has no calibration profile of its own yet (the threshold is 80 backtest matches). Its probabilities use the global calibration.</p>'
    n, bias, ok = entry["n"], entry["bias_pp"], entry["calibrated"]
    direction = "more" if bias > 0 else "fewer"
    marker = '<span class="ok-tag">✓ calibrated</span>' if ok else '<span class="warn-tag">⚠️ weak calibration</span>'
    text = (f"On the calibration backtest (January–May 2026, ratings frozen on 31 December 2025) the model saw <strong>{n} matches</strong> from {e(name)}. "
            f"It expected <strong>{abs(bias):.1f}%</strong> {direction} goals than were actually scored — exactly the deviation the per-league calibration corrects.")
    verdict = ("That deviation is within the ±10% we require to call the league's goal profile separately validated, not just covered by the global calibration." if ok
               else "That deviation exceeds ±10%, so we mark the league explicitly as weakly calibrated: probabilities stay globally calibrated, but its own profile is not separately validated. We would rather say so on the page than have you not know.")
    return f"<p>{text} {marker}</p><p>{verdict}</p>"


def journal_en(days: list[dict], country: str, league: str) -> str:
    wins = losses = 0
    per: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for d in days:
        for m in d.get("matches", []):
            if m.get("country") != country or m.get("league") != league:
                continue
            for p in m.get("picks", []):
                if p["outcome"] == "WIN":
                    wins += 1; per[p["market"]][0] += 1
                elif p["outcome"] == "LOSS":
                    losses += 1; per[p["market"]][1] += 1
    n = wins + losses
    if n == 0:
        return '<p class="muted">No resolved predictions for this league yet in the forward journal (started 2 June 2026). As matches are played they appear here — hits and misses alike.</p>'
    rows = "".join(f"<tr><td>{e(k)}</td><td>{v[0] + v[1]}</td><td class=\"num-win\">{v[0]}</td><td class=\"num-loss\">{v[1]}</td></tr>"
                   for k, v in sorted(per.items(), key=lambda x: -(x[1][0] + x[1][1])))
    table = f'<table class="cumulat-table"><thead><tr><th>Market</th><th>N</th><th>WIN</th><th>LOSS</th></tr></thead><tbody>{rows}</tbody></table>'
    if n < PRAG_TIER_MIN:
        note = (f"<p><strong>{n}</strong> resolved predictions so far ({wins} hit, {losses} missed). <strong>Too few for a verdict</strong>: under {PRAG_TIER_MIN} results the percentage is noise, "
                f'not performance, so we do not present it as such. The number that matters now is the global one on the <a href="../../track-record.html">track record</a>.</p>')
    else:
        note = (f"<p><strong>{n}</strong> resolved predictions: {wins} hit, {losses} missed — <strong>{wins / n * 100:.1f}%</strong>, with a statistical floor (Wilson 95%) of "
                f"<strong>{wilson_lo(wins, n):.1f}%</strong>. The sample is still small; we publish it because it is real, not because it is conclusive.</p>")
    return note + table


def pagina_liga_en(country: str, league: str, slug: str, nume: str, *, meciuri: list[dict], cal: dict | None, zile: list[dict]) -> str:
    name = nume_en(nume); canonical = url_en(slug); year = datetime.now().year
    n = len(meciuri)
    if meciuri:
        first = min(datetime.fromisoformat(m["match_date"].replace("Z", "+00:00")) for m in meciuri).astimezone(TZ)
        summary = f"The model has analysed <strong>{n} {'match' if n == 1 else 'matches'}</strong> from {e(name)} in the next {FEREASTRA_ZILE} days, the first on {first.strftime('%d %B %Y')}."
        content = match_table_en(meciuri)
        description = f"{n} {'match' if n == 1 else 'matches'} in {name}: fixtures, calibration profile and the verified prediction journal. 5 complete predictions free every day."
    else:
        summary = f"No {e(name)} match is scheduled in the next {FEREASTRA_ZILE} days in our data — most likely a break or the off-season. The page stays: the calibration profile below holds, and fixtures reappear automatically."
        content = ""
        description = f"{name} predictions from the POSEIDON model: the league's calibration profile and the verified prediction journal. Free access."
    title = f"{name} Predictions {year} | Match Probabilities"
    if len(title) > 62:
        title = f"{name} Predictions {year} | Probabilities"
    body = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">{e(name)} Predictions</h1>
      <p class="hero-sub">Probabilities for {e(nume_long(nume))} matches, computed by a Poisson + Dixon-Coles model and calibrated on real results — published and frozen before kick-off, verifiable after.</p>
      <p class="hero-free">5 complete predictions free every day · no account · no ads · zero bookmaker links</p>
    </div>
    <p>{summary}</p>
  </section>

  <section>
    <h2>Upcoming {e(name)} fixtures</h2>
{content if content else '    <p class="muted">No fixture in the current window. See <a href="../../index.html">today&#39;s free predictions</a>.</p>'}
  </section>

  <section>
    <h2>How well the model knows this league</h2>
{calibration_en(cal, name)}
    <p class="muted">The full method, with what we correct and what we don't, is on the <a href="../../metodologie.html">methodology</a> page.</p>
  </section>

  <section>
    <h2>What came true so far in {e(name)}</h2>
{journal_en(zile, country, league)}
  </section>

  <section class="plans-free" style="margin-top:26px">
    Every day we publish 5 complete predictions for free, plus the entire track record — misses included. The rest of the day's
    predictions, the Discord delivery and the written analyses are part of the <a href="../../index.html#abonament">membership</a>.
    Other leagues: <a href="index.html">all league pages</a>. Această pagină există și în <a href="{e(url_ro(slug))}">română</a>.
  </section>

  <p class="pro-disclaimer">Empirically calibrated probabilities · informational · not betting advice · 18+</p>
"""
    ld = G.breadcrumb([("POSEIDON", f"{BASE}/"), ("Predictions by league", f"{BASE}/en/predictions/index.html"), (f"{name} predictions", canonical)])
    return shell_en(title=title, description=description, canonical=canonical, body=body, jsonld=ld, alternate_ro=url_ro(slug))


def nume_long(nume: str) -> str:
    m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", nume)
    if not m:
        return nume
    return f"{LIGA_EN.get(m.group(1).strip(), m.group(1).strip())} ({NUME_TARA_EN.get(m.group(2).strip(), m.group(2).strip())})"


def pagina_hub_en(rows: list[dict]) -> str:
    canonical = f"{BASE}/en/predictions/index.html"
    with_m = [r for r in rows if r["n"] > 0]; total = sum(r["n"] for r in rows)
    lst = "".join(f'      <tr><td><a href="{slug_en(r["slug"])}.html">{e(nume_en(r["nume"]))} predictions</a></td><td>{r["n"] or "—"}</td>'
                  f'<td>{"<span class=\"ok-tag\">✓ calibrated</span>" if r["cal_ok"] else "<span class=\"warn-tag\">⚠️ weak calibration</span>" if r["cal_ok"] is False else "<span class=\"muted\">—</span>"}</td></tr>' for r in rows)
    body = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Football predictions by league</h1>
      <p class="hero-sub">One page per closely tracked competition: upcoming fixtures with calibrated probabilities, the league's calibration profile and what came true from the resolved predictions.</p>
      <p class="hero-free">5 complete predictions free every day · no account · no ads · zero bookmaker links</p>
    </div>
    <p>Right now there are <strong>{total}</strong> fixtures scheduled in the next {FEREASTRA_ZILE} days across the <strong>{len(with_m)}</strong> leagues with an active schedule, out of {len(rows)} tracked. The model analyses many more competitions every day — the full list, with filters, is on the <a href="../../index.html">home page</a>.</p>
  </section>

  <section>
    <h2>All tracked leagues</h2>
    <div class="calibration-card">
      <table>
        <thead><tr><th>League</th><th>Fixtures in {FEREASTRA_ZILE} days</th><th>Calibration</th></tr></thead>
        <tbody>
{lst}
        </tbody>
      </table>
    </div>
    <p class="muted">“Calibration” says whether the league's goal profile is validated separately, on at least 80 backtest matches with a deviation under ±10%. Leagues without their own profile use the global calibration.</p>
  </section>

  <p class="pro-disclaimer">Empirically calibrated probabilities · informational · not betting advice · 18+</p>
"""
    ld = G.breadcrumb([("POSEIDON", f"{BASE}/"), ("Predictions by league", canonical)])
    return shell_en(title="Football Predictions by League | Match Probabilities", description="Football predictions by league: Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and 30 more competitions, with empirically calibrated probabilities and a public track record.",
                    canonical=canonical, body=body, jsonld=ld, alternate_ro=f"{BASE}/predictii/index.html")


def genereaza(per_liga: dict, cal_map: dict, zile: list[dict]) -> list[tuple[str, str, str]]:
    """Scrie toate paginile EN; întoarce (loc, changefreq, priority) pentru sitemap."""
    OUT_EN.mkdir(parents=True, exist_ok=True); pagini = []; rows = []
    for country, league, slug, nume in G.LEAGUES:
        lst = per_liga.get((country, league), []); entry = cal_map.get((country, league))
        (OUT_EN / f"{slug_en(slug)}.html").write_text(pagina_liga_en(country, league, slug, nume, meciuri=lst, cal=entry, zile=zile), encoding="utf-8")
        rows.append({"slug": slug, "nume": nume, "n": len(lst), "cal_ok": entry["calibrated"] if entry else None})
        pagini.append((url_en(slug), "daily", "0.7"))
    (OUT_EN / "index.html").write_text(pagina_hub_en(rows), encoding="utf-8")
    pagini.append((f"{BASE}/en/predictions/index.html", "daily", "0.8"))
    return pagini
