#!/usr/bin/env python3
"""Pagini statice long-tail pentru Google — o pagină per ligă + arhivă pe zile.

DE CE: homepage-ul randează meciurile din JS, deci crawler-ul vede shell-ul, nu
predicțiile. Nicio căutare de tip „predicții Premier League" nu ne putea găsi.
Scriptul scrie HTML STATIC, complet, fără JS, pentru fiecare ligă din whitelist.

CE SCRIE:
  predictii/index.html                 — hub, listează toate ligile
  predictii/<slug>.html                — o pagină per ligă (meciurile din fereastră,
                                         profilul de calibrare, jurnalul ligii)
  predictii/arhiva/<YYYY-MM-DD>.html   — ce s-a predicit în ziua X și ce a ieșit
  sitemap.xml                          — regenerat integral (core + tot ce e mai sus)

REGULI RESPECTATE (CLAUDE.md + gardurile de brand):
  - probabilități CALIBRATE, round(p*100), praguri pick identice cu assets/app.js;
  - fără echipe W / tineret / rezerve, fără ligi feminine (aceleași filtre ca
    gen_static_daily.py);
  - eșantion sub PRAG_TIER_MIN → NU se dă verdict pe ligă, se scrie explicit că
    eșantionul e insuficient (regula de sample a Andreei: N<30 = zgomot);
  - zero limbaj de tipster: fără „garantat", „sigur", „valoare", „bilet";
  - liga necalibrată → marker ⚠️ vizibil, nu ascuns.

Rulare manuală:
    ~/football_predictor/.venv/bin/python3 ~/poseidon-site/scripts/gen_seo_pages.py

Integrarea în daily_publish.sh o face supervizorul (vezi RAPORT_SITE).
"""
from __future__ import annotations

import html
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Europe/Bucharest")
except Exception:                                    # pragma: no cover
    TZ = timezone(timedelta(hours=3))

SITE = Path.home() / "poseidon-site"
DATA = SITE / "data"
OUT = SITE / "predictii"
ARH = OUT / "arhiva"
SITEMAP = SITE / "sitemap.xml"
INDEX = SITE / "index.html"
BASE = "https://poseidonstats.com"

LINKS_START = "<!-- LEAGUES_LINKS_START -->"
LINKS_END = "<!-- LEAGUES_LINKS_END -->"

FEREASTRA_ZILE = 7          # câte zile în față listăm pe pagina de ligă
ARHIVA_ZILE = 30            # câte zile din jurnal primesc pagină proprie
PRAG_TIER_MIN = 30          # sub atât NU dăm verdict pe ligă (N<30 = zgomot)

# Praguri pick — sincron cu pickBadge() din assets/app.js și cu gen_static_daily.py.
MARKETS = [
    ("Over 1.5 goluri", "prob_over_1_5", 0.75),
    ("Over 2.5 goluri", "prob_over_2_5", 0.65),
    ("Over 3.5 goluri", "prob_over_3_5", 0.65),
    ("Victorie gazde", "prob_home", 0.65),
    ("Victorie oaspeți", "prob_away", 0.65),
    ("Ambele marchează", "prob_btts", 0.65),
]
MAX_PROB_DISPLAY = 0.88

EXCLUDE_TEAM = re.compile(
    r"\b(II|III|B|C|Reserves?|U1[4-9]|U2[0-3]|W|Women|Ladies|Femenino|Femenil|Feminin)\b",
    re.IGNORECASE,
)
EXCLUDE_LEAGUE = re.compile(r"women|femenil|femenino|feminin|ladies|w-league", re.IGNORECASE)

RO_MONTHS = ["", "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
             "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]
RO_DAYS = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"]

# Whitelist EDITORIAL: (țară din date, ligă din date, slug URL, nume afișat RO).
# Fixă pe scop: URL-urile trebuie să fie stabile chiar în săptămânile fără meciuri
# (pauze internaționale, intersezon). O ligă intră aici doar dacă are intrare în
# calibration.json, ca pagina să aibă întotdeauna conținut propriu, nu doar tabel gol.
LEAGUES = [
    ("Romania", "Liga I", "romania-liga-1", "Liga 1 (SuperLiga României)"),
    ("Romania", "Liga II", "romania-liga-2", "Liga 2 (România)"),
    ("England", "Premier League", "anglia-premier-league", "Premier League (Anglia)"),
    ("England", "Championship", "anglia-championship", "Championship (Anglia)"),
    ("England", "League One", "anglia-league-one", "League One (Anglia)"),
    ("England", "League Two", "anglia-league-two", "League Two (Anglia)"),
    ("England", "National League", "anglia-national-league", "National League (Anglia)"),
    ("Spain", "La Liga", "spania-la-liga", "La Liga (Spania)"),
    ("Spain", "Segunda División", "spania-segunda-division", "Segunda División (Spania)"),
    ("Italy", "Serie A", "italia-serie-a", "Serie A (Italia)"),
    ("Italy", "Serie B", "italia-serie-b", "Serie B (Italia)"),
    ("Germany", "Bundesliga", "germania-bundesliga", "Bundesliga (Germania)"),
    ("Germany", "2. Bundesliga", "germania-2-bundesliga", "2. Bundesliga (Germania)"),
    ("France", "Ligue 1", "franta-ligue-1", "Ligue 1 (Franța)"),
    ("France", "Ligue 2", "franta-ligue-2", "Ligue 2 (Franța)"),
    ("Netherlands", "Eredivisie", "olanda-eredivisie", "Eredivisie (Olanda)"),
    ("Portugal", "Primeira Liga", "portugalia-primeira-liga", "Primeira Liga (Portugalia)"),
    ("Portugal", "Segunda Liga", "portugalia-segunda-liga", "Segunda Liga (Portugalia)"),
    ("Turkey", "Süper Lig", "turcia-super-lig", "Süper Lig (Turcia)"),
    ("Belgium", "Jupiler Pro League", "belgia-jupiler-pro-league", "Jupiler Pro League (Belgia)"),
    ("Scotland", "Premiership", "scotia-premiership", "Premiership (Scoția)"),
    ("Austria", "Bundesliga", "austria-bundesliga", "Bundesliga (Austria)"),
    ("Switzerland", "Super League", "elvetia-super-league", "Super League (Elveția)"),
    ("Greece", "Super League 1", "grecia-super-league", "Super League 1 (Grecia)"),
    ("Poland", "Ekstraklasa", "polonia-ekstraklasa", "Ekstraklasa (Polonia)"),
    ("Czech-Republic", "Czech Liga", "cehia-liga-1", "Prima ligă (Cehia)"),
    ("Denmark", "Superliga", "danemarca-superliga", "Superliga (Danemarca)"),
    ("Norway", "Eliteserien", "norvegia-eliteserien", "Eliteserien (Norvegia)"),
    ("Sweden", "Allsvenskan", "suedia-allsvenskan", "Allsvenskan (Suedia)"),
    ("Russia", "Premier League", "rusia-premier-league", "Premier League (Rusia)"),
    ("Ukraine", "Premier League", "ucraina-premier-league", "Premier League (Ucraina)"),
    ("USA", "Major League Soccer", "sua-mls", "Major League Soccer (SUA)"),
    ("Brazil", "Serie A", "brazilia-serie-a", "Brasileirão Série A (Brazilia)"),
    ("Argentina", "Liga Profesional Argentina", "argentina-liga-profesional",
     "Liga Profesional (Argentina)"),
    ("World", "UEFA Champions League", "uefa-champions-league", "UEFA Champions League"),
    ("World", "UEFA Europa League", "uefa-europa-league", "UEFA Europa League"),
]


# ───────────────────────────── helpers ─────────────────────────────

def e(s) -> str:
    return html.escape(str(s), quote=True)


def azi() -> datetime:
    return datetime.now(TZ)


def data_ro(d: datetime | str, cu_zi: bool = False) -> str:
    if isinstance(d, str):
        d = datetime.strptime(d, "%Y-%m-%d")
    txt = f"{d.day} {RO_MONTHS[d.month]} {d.year}"
    return f"{RO_DAYS[d.weekday()]}, {txt}" if cu_zi else txt


def nr_ro(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def cu_de(n: int) -> str:
    """Numeralul românesc: „7 meciuri" dar „20 de meciuri" (ultimele două cifre 0 sau ≥20)."""
    r = n % 100
    return f"{nr_ro(n)} de" if (r == 0 or r >= 20) else nr_ro(n)


def plural(n: int, unu: str, multi: str) -> str:
    return unu if n == 1 else multi


def echipa_exclusa(m: dict) -> bool:
    liga = f"{m.get('country', '')} · {m.get('league', '')}"
    return bool(EXCLUDE_TEAM.search(str(m.get("home_team", "")))
                or EXCLUDE_TEAM.search(str(m.get("away_team", "")))
                or EXCLUDE_LEAGUE.search(liga))


def citeste(nume: str):
    try:
        return json.loads((DATA / nume).read_text())
    except (OSError, ValueError) as exc:
        print(f"[gen_seo_pages] EROARE la {nume}: {exc}", file=sys.stderr)
        return None


def wilson_lo(wins: int, n: int) -> float:
    """Limita Wilson inferioară la 95% — aceeași convenție ca în restul proiectului."""
    if n == 0:
        return 0.0
    z = 1.96
    p = wins / n
    d = 1 + z * z / n
    centru = p + z * z / (2 * n)
    marja = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return max(0.0, (centru - marja) / d) * 100


# ───────────────────────────── shell HTML ─────────────────────────────

def shell(*, titlu: str, descriere: str, canonical: str, corp: str,
          adancime: int, jsonld: str = "") -> str:
    """Shell identic ca stil cu restul site-ului. Fără app.js: paginile sunt
    100% statice (nimic de randat din JS) — mai rapide și indexabile integral."""
    sus = "../" * adancime
    if len(titlu) > 62 or len(descriere) > 160:
        print(f"[gen_seo_pages] ATENȚIE trunchiere Google: titlu={len(titlu)} "
              f"descriere={len(descriere)} → {canonical}", file=sys.stderr)
    return f"""<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://poseidonstats.goatcounter.com; font-src 'self'; base-uri 'self'; form-action 'none';">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{e(titlu)}</title>
<meta name="description" content="{e(descriere)}">
<meta property="og:title" content="{e(titlu)}">
<meta property="og:description" content="{e(descriere)}">
<meta property="og:image" content="{BASE}/assets/icon-512.png">
<meta property="og:url" content="{e(canonical)}">
<meta property="og:type" content="website">
<link rel="canonical" href="{e(canonical)}">
<link rel="stylesheet" href="{sus}assets/style.css">
<meta name="theme-color" content="#1e3a8a">
<link rel="apple-touch-icon" href="{sus}assets/icon-192.png">
<script data-goatcounter="https://poseidonstats.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
{jsonld}</head>
<body>

<div class="legal-banner">⚠️ Statistici informative. Modelul poate greși. Verifică sursa. 18+.</div>

<header>
  <div class="container">
    <a href="{sus}index.html" class="brand">
      <span class="brand-icon">🔱</span>
      <span class="brand-name">POSEIDON</span>
      <span class="brand-pulse"></span>
    </a>
    <p class="tagline">Predicții fotbal calibrate pe <strong>65.250 meciuri reale</strong> · zero leakage</p>
    <nav>
      <a href="{sus}index.html">Predicții</a>
      <a href="{sus}predictii/index.html">Pe ligi</a>
      <a href="{sus}istoric.html">Istoric</a>
      <a href="{sus}track-record.html">Track record</a>
      <a href="{sus}metodologie.html">Metodologie</a>
      <a href="{sus}index.html#abonament">💎 Abonamente</a>
    </nav>
  </div>
</header>

<main class="container">
{corp}
</main>

<footer>
  <div class="container">
    <p><strong>POSEIDON</strong> — model statistic propriu, ratings Bayesian cu calibrare per-ligă.</p>
    <p>⚠️ <strong>Informativ.</strong> NU sfat de pariere. <strong>NU garanție.</strong> Folosește responsabil. <strong>18+</strong>.</p>
    <p class="muted">Contact: <a href="mailto:contact@poseidonstats.com">contact@poseidonstats.com</a> · Joc responsabil: <a href="https://www.jocresponsabil.ro" target="_blank" rel="noopener">jocresponsabil.ro</a> · <a href="{sus}terms.html">Termeni și Condiții</a></p>
  </div>
</footer>
</body>
</html>
"""


def breadcrumb(items: list[tuple[str, str]]) -> str:
    ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": nume, "item": url}
            for i, (nume, url) in enumerate(items)
        ],
    }
    return ('<script type="application/ld+json">\n'
            + json.dumps(ld, ensure_ascii=False, indent=2) + "\n</script>\n")


# ───────────────────────────── conținut ─────────────────────────────

def tabel_meciuri(meciuri: list[dict]) -> str:
    """Meciurile din fereastră, cu probabilitățile CALIBRATE, în HTML static."""
    randuri = []
    for m in meciuri:
        dt = datetime.fromisoformat(m["match_date"].replace("Z", "+00:00")).astimezone(TZ)
        pick = ""
        best = None
        for eticheta, cheie, prag in MARKETS:
            p = m.get(cheie)
            if p is not None and p >= prag and p <= MAX_PROB_DISPLAY:
                if best is None or p > best[0]:
                    best = (p, eticheta)
        if best:
            cls = ("pick-elite" if best[0] >= 0.80
                   else "pick-strong" if best[0] >= 0.70 else "pick-good")
            pick = (f'<span class="pick-badge {cls}">★ {e(best[1])} '
                    f'{round(best[0] * 100)}%</span>')
        necal = "" if m.get("calibrated") else ' <span class="warn-tag">⚠️ necalibrată</span>'
        randuri.append(f"""        <tr>
          <td>{dt.strftime('%d.%m')} <span class="muted">{dt.strftime('%H:%M')}</span></td>
          <td><strong>{e(m['home_team'])}</strong> – <strong>{e(m['away_team'])}</strong>{necal}</td>
          <td>{round(m['prob_home'] * 100)}% · {round(m['prob_draw'] * 100)}% · {round(m['prob_away'] * 100)}%</td>
          <td>{round(m['prob_over_1_5'] * 100)}%</td>
          <td>{round(m['prob_over_2_5'] * 100)}%</td>
          <td>{round(m['prob_btts'] * 100)}%</td>
          <td>{pick}</td>
        </tr>""")
    return f"""    <div class="calibration-card">
      <table>
        <thead><tr>
          <th>Când</th><th>Meci</th><th>1 · X · 2</th>
          <th>Peste 1.5</th><th>Peste 2.5</th><th>Ambele</th><th>Reper</th>
        </tr></thead>
        <tbody>
{chr(10).join(randuri)}
        </tbody>
      </table>
      <p class="muted" style="font-size:.82rem">Ora e cea a României. Probabilitățile sunt cele calibrate empiric, nu ieșirea brută a modelului. „Reper" = piața cu cea mai mare probabilitate care trece pragul de afișare al site-ului.</p>
    </div>"""


def profil_calibrare(intrare: dict | None, nume: str, n_marcate: int = 0,
                     n_total: int = 0) -> str:
    if not intrare:
        return ('<p class="muted">Această ligă nu are încă un profil de calibrare propriu '
                '(pragul e de minimum 80 de meciuri în backtest). Probabilitățile rămân '
                'calibrate global.</p>')
    n, bias, ok = intrare["n"], intrare["bias_pp"], intrare["calibrated"]
    directie = ("mai multe" if bias > 0 else "mai puține")
    marker = ('<span class="ok-tag">✓ calibrată</span>' if ok
              else '<span class="warn-tag">⚠️ calibrare slabă</span>')
    explicatie = (
        f"Pe backtest-ul de calibrare (ianuarie–mai 2026, ratings înghețate la 31 decembrie "
        f"2025), modelul a văzut <strong>{cu_de(n)} {plural(n, 'meci', 'meciuri')}</strong> din {e(nume)}. "
        f"Golurile pe care le aștepta erau cu <strong>{abs(bias):.1f}%</strong> {directie} "
        f"decât cele marcate efectiv — exact abaterea pe care o corectează calibrarea per-ligă."
    )
    if ok:
        verdict = ("Abaterea intră în pragul de ±10% pe care îl cerem ca să considerăm profilul "
                   "de goluri al ligii validat separat, nu doar acoperit de calibrarea globală.")
    else:
        verdict = ("Abaterea depășește pragul de ±10%, așa că marcăm liga explicit ca având "
                   "calibrare slabă: probabilitățile rămân calibrate global, dar profilul ei "
                   "propriu nu e validat separat. Preferăm să scrie asta pe pagină decât să nu "
                   "știi.")
    # Cele două „calibrări" vin din surse diferite: marcajul de pe fiecare meci ține de
    # lista strictă de ligi verificate, iar profilul de mai sus de abaterea de goluri din
    # backtest. Când nu spun același lucru, o scriem — altfel pagina pare că se contrazice.
    lamurire = ""
    if ok and n_total and n_marcate == n_total:
        lamurire = (
            '<p class="muted">De ce apar totuși meciurile de mai sus cu '
            '<span class="warn-tag">⚠️ necalibrată</span>: sunt două criterii diferite. Marcajul '
            "de pe meci arată că liga nu e în lista strictă de campionate cu calibrare verificată "
            "separat, folosită de site pentru acel semn. Profilul de aici măsoară altceva — "
            "abaterea golurilor așteptate față de cele marcate, pe backtest. Le arătăm pe "
            "amândouă, cu criteriul lor cu tot, în loc să alegem varianta care sună mai bine.</p>"
        )
    return f"<p>{explicatie} {marker}</p><p>{verdict}</p>{lamurire}"


def jurnal_liga(zile: list[dict], tara: str, liga: str) -> str:
    """Ce a ieșit din predicțiile deja rezolvate PE ACEASTĂ LIGĂ.

    Sub PRAG_TIER_MIN nu se dă niciun verdict — eșantionul e prea mic ca să
    însemne ceva, iar a-l prezenta ca performanță ar fi exact greșeala pe care
    regulile de sample o interzic.
    """
    wins = losses = 0
    per_piata: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for zi in zile:
        for m in zi.get("matches", []):
            if m.get("country") != tara or m.get("league") != liga:
                continue
            for p in m.get("picks", []):
                if p["outcome"] == "WIN":
                    wins += 1
                    per_piata[p["market"]][0] += 1
                elif p["outcome"] == "LOSS":
                    losses += 1
                    per_piata[p["market"]][1] += 1
    n = wins + losses
    if n == 0:
        return ('<p class="muted">Încă nu avem predicții rezolvate pe această ligă în jurnalul '
                'forward (pornit pe 2 iunie 2026). Cum se joacă meciurile, apar aici — și cele '
                'nimerite, și cele ratate.</p>')
    hit = wins / n * 100
    wlo = wilson_lo(wins, n)
    randuri = "".join(
        f"<tr><td>{e(k)}</td><td>{v[0] + v[1]}</td>"
        f'<td class="num-win">{v[0]}</td><td class="num-loss">{v[1]}</td></tr>'
        for k, v in sorted(per_piata.items(), key=lambda x: -(x[1][0] + x[1][1]))
    )
    tabel = (f'<table class="cumulat-table"><thead><tr><th>Piață</th><th>N</th>'
             f"<th>WIN</th><th>LOSS</th></tr></thead><tbody>{randuri}</tbody></table>")
    if n < PRAG_TIER_MIN:
        nota = (f'<p><strong>{n}</strong> {plural(n, "predicție rezolvată", "predicții rezolvate")} '
                f'până acum ({wins} {plural(wins, "nimerită", "nimerite")}, '
                f'{losses} {plural(losses, "ratată", "ratate")}). '
                f"<strong>Prea puține pentru un verdict</strong>: sub "
                f"{PRAG_TIER_MIN} de rezultate, procentul e zgomot, nu performanță, așa că nu "
                f"îl prezentăm ca atare. Cifra care contează acum e cea globală, de pe "
                f'<a href="../track-record.html">track record</a>.</p>')
    else:
        nota = (f'<p><strong>{n}</strong> predicții rezolvate: {wins} '
                f'{plural(wins, "nimerită", "nimerite")}, {losses} '
                f'{plural(losses, "ratată", "ratate")} '
                f"— <strong>{hit:.1f}%</strong>, cu un minim statistic (Wilson 95%) de "
                f"<strong>{wlo:.1f}%</strong>. Eșantionul e încă mic; îl publicăm pentru că e "
                f"real, nu pentru că e concludent.</p>")
    return nota + tabel


def pagina_liga(tara: str, liga: str, slug: str, nume: str, *,
                meciuri: list[dict], cal: dict | None, zile: list[dict]) -> str:
    canonical = f"{BASE}/predictii/{slug}.html"
    n_meci = len(meciuri)

    if meciuri:
        xg_mediu = sum(m["xg_home"] + m["xg_away"] for m in meciuri) / n_meci
        peste15 = sum(1 for m in meciuri if m["prob_over_1_5"] >= 0.75)
        prima = min(datetime.fromisoformat(m["match_date"].replace("Z", "+00:00")) for m in meciuri)
        prag15 = (
            f"<strong>{peste15}</strong> dintre ele trec pragul de afișare la „peste 1.5 goluri”"
            if peste15 else
            "niciunul nu trece pragul de afișare la „peste 1.5 goluri”"
        )
        rezumat = (
            f"Modelul a analizat <strong>{cu_de(n_meci)} "
            f"{plural(n_meci, 'meci', 'meciuri')}</strong> din {e(nume)} în următoarele "
            f"{FEREASTRA_ZILE} zile, primul pe "
            f"{data_ro(prima.astimezone(TZ))}. Media golurilor așteptate de model pe aceste "
            f"meciuri este <strong>{xg_mediu:.2f}</strong> pe partidă, iar {prag15}."
        )
        continut = tabel_meciuri(meciuri)
        descriere = (f"{n_meci} {plural(n_meci, 'meci', 'meciuri')} din {nume}, cu probabilități "
                     f"calibrate empiric pentru 1X2, peste 1.5, peste 2.5 și ambele marchează. "
                     f"Gratuit, informativ.")
    else:
        rezumat = (f"În următoarele {FEREASTRA_ZILE} zile nu e programat niciun meci din "
                   f"{e(nume)} în datele noastre — probabil pauză competițională sau "
                   f"intersezon. Pagina rămâne aici: profilul de calibrare de mai jos e "
                   f"valabil oricum, iar meciurile reapar automat la reluare.")
        continut = ""
        descriere = (f"Predicții {nume} de la modelul POSEIDON: profilul de calibrare al ligii "
                     f"și jurnalul predicțiilor verificate. Gratuit, informativ.")

    corp = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Predicții {e(nume)}</h1>
      <p class="hero-sub">Probabilități calculate de un model Poisson + Dixon-Coles și calibrate pe rezultate reale. Predicțiile se publică înainte de meci și rămân verificabile după.</p>
      <p class="hero-free">Gratuit · fără cont · fără reclame · zero link-uri către case de pariuri</p>
    </div>
    <p>{rezumat}</p>
  </section>

  <section>
    <h2>Meciurile următoare din {e(nume)}</h2>
{continut if continut else '    <p class="muted">Niciun meci programat în fereastra curentă. Vezi <a href="../index.html">toate predicțiile zilei</a>.</p>'}
  </section>

  <section>
    <h2>Cât de bine cunoaște modelul această ligă</h2>
{profil_calibrare(cal, nume, sum(1 for m in meciuri if not m.get("calibrated")), n_meci)}
    <p class="muted">Metoda completă, cu ce corectăm și ce nu, e pe pagina de <a href="../metodologie.html">metodologie</a>.</p>
  </section>

  <section>
    <h2>Ce a ieșit până acum în {e(nume)}</h2>
{jurnal_liga(zile, tara, liga)}
  </section>

  <section class="plans-free" style="margin-top:26px">
    Predicțiile de pe această pagină sunt gratuite și rămân gratuite. Dacă vrei selecția zilei
    livrată pe Discord sau analiza scrisă per meci, sunt la <a href="../index.html#abonament">abonamente</a>.
    Restul ligilor: <a href="index.html">toate paginile pe ligi</a>.
  </section>

  <p class="pro-disclaimer">Probabilități calibrate empiric · informativ · nu sfat de pariere · 18+</p>
"""
    ld = breadcrumb([("POSEIDON", f"{BASE}/"),
                     ("Predicții pe ligi", f"{BASE}/predictii/index.html"),
                     (f"Predicții {nume}", canonical)])
    return shell(titlu=f"Predicții {nume} | POSEIDON",
                 descriere=descriere, canonical=canonical, corp=corp, adancime=1, jsonld=ld)


def pagina_hub(randuri: list[dict]) -> str:
    canonical = f"{BASE}/predictii/index.html"
    cu_meci = [r for r in randuri if r["n"] > 0]
    total = sum(r["n"] for r in randuri)
    lista = "".join(
        f'      <tr><td><a href="{r["slug"]}.html">Predicții {e(r["nume"])}</a></td>'
        f'<td>{r["n"] or "—"}</td>'
        f'<td>{"<span class=\"ok-tag\">✓ calibrată</span>" if r["cal_ok"] else "<span class=\"warn-tag\">⚠️ calibrare slabă</span>" if r["cal_ok"] is False else "<span class=\"muted\">—</span>"}</td></tr>'
        for r in randuri
    )
    corp = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Predicții fotbal pe ligi</h1>
      <p class="hero-sub">Câte o pagină pentru fiecare campionat urmărit îndeaproape: meciurile următoare cu probabilități calibrate, profilul de calibrare al ligii și ce a ieșit din predicțiile deja rezolvate.</p>
      <p class="hero-free">Gratuit · fără cont · fără reclame · zero link-uri către case de pariuri</p>
    </div>
    <p>În acest moment sunt <strong>{total}</strong> meciuri programate în următoarele {FEREASTRA_ZILE} zile pe cele <strong>{len(cu_meci)}</strong> ligi cu program activ, din {len(randuri)} urmărite. Modelul analizează zilnic mult mai multe competiții — lista completă, cu filtre, e pe <a href="../index.html">pagina principală</a>.</p>
  </section>

  <section>
    <h2>Toate ligile urmărite</h2>
    <div class="calibration-card">
      <table>
        <thead><tr><th>Ligă</th><th>Meciuri în {FEREASTRA_ZILE} zile</th><th>Calibrare</th></tr></thead>
        <tbody>
{lista}
        </tbody>
      </table>
    </div>
    <p class="muted">„Calibrare" arată dacă profilul de goluri al ligii e validat separat, pe minimum 80 de meciuri de backtest, cu abatere sub ±10%. Ligile fără profil propriu folosesc calibrarea globală.</p>
  </section>

  <section>
    <h2>Arhiva pe zile</h2>
    <p>Fiecare zi din jurnal are pagina ei: ce s-a prezis dimineața și ce a ieșit după meciuri, inclusiv predicțiile ratate. <a href="arhiva/index.html">Vezi arhiva</a>.</p>
  </section>

  <p class="pro-disclaimer">Probabilități calibrate empiric · informativ · nu sfat de pariere · 18+</p>
"""
    ld = breadcrumb([("POSEIDON", f"{BASE}/"), ("Predicții pe ligi", canonical)])
    return shell(titlu="Predicții fotbal pe ligi | POSEIDON",
                 descriere=("Predicții pe ligi: Premier League, La Liga, Serie A, Bundesliga, "
                            "Ligue 1, Liga 1 și încă 30 de campionate, cu probabilități "
                            "calibrate empiric."),
                 canonical=canonical, corp=corp, adancime=1, jsonld=ld)


def pagina_zi(zi: dict) -> str:
    d = zi["date"]
    canonical = f"{BASE}/predictii/arhiva/{d}.html"
    t = zi.get("totals", {})
    wins, losses = t.get("wins", 0), t.get("losses", 0)
    n = wins + losses
    randuri = []
    for m in sorted(zi.get("matches", []), key=lambda x: x.get("time", "")):
        if echipa_exclusa({"home_team": m.get("home", ""), "away_team": m.get("away", ""),
                           "country": m.get("country", ""), "league": m.get("league", "")}):
            continue
        scor = (f'{m["ft_h"]}-{m["ft_a"]}' if m.get("ft_h") is not None else "—")
        picks = " ".join(
            f'<span class="pick-row {"pick-loss" if p["outcome"] == "LOSS" else "pick-pending" if p["outcome"] == "PENDING" else ""}">'
            f'{"✅" if p["outcome"] == "WIN" else "❌" if p["outcome"] == "LOSS" else "⏳"} '
            f'{e(p["market"])} {p["prob"]}%</span>'
            for p in m.get("picks", [])
        )
        randuri.append(
            f'        <tr><td>{e(m.get("time", ""))}</td>'
            f'<td><strong>{e(m.get("home", ""))}</strong> – <strong>{e(m.get("away", ""))}</strong>'
            f'<br><span class="muted" style="font-size:.82rem">{e(m.get("country", ""))} · {e(m.get("league", ""))}</span></td>'
            f"<td>{scor}</td><td>{picks}</td></tr>"
        )
    if not randuri:
        return ""
    if n:
        hit = wins / n * 100
        antet = (f'Din <strong>{n}</strong> predicții rezolvate în această zi, '
                 f'<strong>{wins}</strong> s-au adeverit și <strong>{losses}</strong> nu — '
                 f"{hit:.1f}%. Ratările rămân în tabel; nu ștergem zilele slabe.")
    else:
        antet = ("Predicțiile acestei zile nu erau încă rezolvate la ultima actualizare a "
                 "paginii. Reveniți după ce se joacă meciurile.")
    corp = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Predicții fotbal {data_ro(d)}</h1>
      <p class="hero-sub">Predicțiile publicate în dimineața acelei zile, exact cum au fost înghețate, alături de rezultatul real.</p>
    </div>
    <p>{antet}</p>
  </section>

  <section>
    <h2>Predicții și rezultate — {data_ro(d, cu_zi=True)}</h2>
    <div class="calibration-card">
      <table>
        <thead><tr><th>Ora</th><th>Meci</th><th>Scor</th><th>Predicții</th></tr></thead>
        <tbody>
{chr(10).join(randuri)}
        </tbody>
      </table>
    </div>
  </section>

  <section class="plans-free" style="margin-top:26px">
    Toate predicțiile zilei curente sunt pe <a href="../../index.html">pagina principală</a>,
    gratuit. Restul arhivei: <a href="index.html">zi cu zi</a>. Pe ligi:
    <a href="../index.html">paginile de campionat</a>.
  </section>

  <p class="pro-disclaimer">Probabilități calibrate empiric · informativ · nu sfat de pariere · 18+</p>
"""
    ld = breadcrumb([("POSEIDON", f"{BASE}/"),
                     ("Predicții pe ligi", f"{BASE}/predictii/index.html"),
                     ("Arhivă", f"{BASE}/predictii/arhiva/index.html"),
                     (f"Predicții {data_ro(d)}", canonical)])
    return shell(titlu=f"Predicții fotbal {data_ro(d)} — rezultate | POSEIDON",
                 descriere=(f"Predicțiile POSEIDON pentru {data_ro(d)}, înghețate înainte de "
                            f"meciuri, alături de rezultatele reale — inclusiv predicțiile ratate."),
                 canonical=canonical, corp=corp, adancime=2, jsonld=ld)


def pagina_arhiva(zile_scrise: list[str]) -> str:
    canonical = f"{BASE}/predictii/arhiva/index.html"
    lista = "".join(f'      <li><a href="{z}.html">Predicții fotbal {data_ro(z)}</a></li>'
                    for z in zile_scrise)
    corp = f"""  <section class="intro">
    <div class="hero">
      <h1 class="hero-title">Arhiva predicțiilor, zi cu zi</h1>
      <p class="hero-sub">Fiecare zi păstrează predicțiile exact cum au fost publicate dimineața, cu rezultatul real alături. Nimic nu se rescrie după meci.</p>
    </div>
    <p>Sunt <strong>{len(zile_scrise)}</strong> zile în arhiva publică. Tabelul cumulat pe piețe e pe <a href="../../istoric.html">istoric</a>, iar calibrarea completă pe <a href="../../track-record.html">track record</a>.</p>
  </section>

  <section>
    <h2>Zile arhivate</h2>
    <ul class="arhiva-list">
{lista}
    </ul>
  </section>

  <p class="pro-disclaimer">Probabilități calibrate empiric · informativ · nu sfat de pariere · 18+</p>
"""
    ld = breadcrumb([("POSEIDON", f"{BASE}/"),
                     ("Predicții pe ligi", f"{BASE}/predictii/index.html"),
                     ("Arhivă", canonical)])
    return shell(titlu="Arhiva predicțiilor, zi cu zi | POSEIDON",
                 descriere=("Arhiva zilnică a predicțiilor POSEIDON: ce s-a prezis în fiecare "
                            "dimineață și ce a ieșit după meciuri, fără retușuri."),
                 canonical=canonical, corp=corp, adancime=2, jsonld=ld)


def scrie_legaturi_index(randuri: list[dict]) -> None:
    """Legături din index.html către paginile de ligă.

    Fără ele, paginile generate n-ar fi legate de nicăieri: sitemap-ul le anunță,
    dar link-urile interne sunt cele care le dau greutate și le țin crawl-uite.
    Blocul e generat din aceeași whitelist ca paginile, deci nu poate rămâne în urmă.
    """
    if not INDEX.exists():
        return
    html_src = INDEX.read_text()
    if LINKS_START not in html_src or LINKS_END not in html_src:
        print(f"[gen_seo_pages] markerii {LINKS_START} lipsesc din index.html — sar peste "
              "legăturile interne", file=sys.stderr)
        return
    cu_meci = [r for r in randuri if r["n"] > 0]
    lista = "".join(
        f'      <li><a href="predictii/{r["slug"]}.html">{e(r["nume"])}</a>'
        f'<span class="liga-n">{r["n"]}</span></li>\n'
        for r in cu_meci
    )
    bloc = f"""{LINKS_START}
  <section class="ligi-links">
    <h2>Predicții pe ligi</h2>
    <p>Fiecare campionat urmărit are pagina lui: meciurile următoare cu probabilitățile
    calibrate, profilul de calibrare al ligii și ce a ieșit din predicțiile deja rezolvate.
    Cifra din dreptul ligii = meciuri programate în următoarele {FEREASTRA_ZILE} zile.</p>
    <ul class="ligi-grid">
{lista}    </ul>
    <p class="muted"><a href="predictii/index.html">Toate ligile urmărite</a> ·
    <a href="predictii/arhiva/index.html">arhiva zi cu zi</a></p>
  </section>
  {LINKS_END}"""
    INDEX.write_text(re.sub(re.escape(LINKS_START) + r".*?" + re.escape(LINKS_END),
                            lambda _: bloc, html_src, flags=re.S))


# ───────────────────────────── sitemap ─────────────────────────────

def _lastmod(loc: str, freq: str) -> str:
    """Pentru paginile care se schimbă zilnic: azi. Pentru restul: data reală a
    fișierului — un lastmod fals pe terms.html doar învață crawler-ul să nu ne creadă."""
    azi_iso = azi().date().isoformat()
    if freq == "daily":
        return azi_iso
    rel = loc.replace(BASE + "/", "") or "index.html"
    f = SITE / rel
    try:
        return datetime.fromtimestamp(f.stat().st_mtime, TZ).date().isoformat()
    except OSError:
        return azi_iso


def scrie_sitemap(pagini: list[tuple[str, str, str]]) -> None:
    """pagini = [(loc, changefreq, priority)]."""
    corp = "\n".join(
        f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{_lastmod(loc, freq)}</lastmod>\n"
        f"    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>\n  </url>"
        for loc, freq, prio in pagini
    )
    SITEMAP.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{corp}\n</urlset>\n"
    )


# ───────────────────────────── main ─────────────────────────────

def main() -> int:
    pred = citeste("predictions.json")
    cal = citeste("calibration.json")
    hist = citeste("history.json")
    if not pred:
        print("[gen_seo_pages] predictions.json indisponibil — abort", file=sys.stderr)
        return 1

    meciuri = pred["matches"] if isinstance(pred, dict) else pred
    cal_map = {(l["country"], l["league"]): l for l in (cal or {}).get("leagues", [])}
    zile = (hist or {}).get("days", [])

    acum = azi()
    limita = acum + timedelta(days=FEREASTRA_ZILE)
    per_liga: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for m in meciuri:
        if echipa_exclusa(m):
            continue
        try:
            dt = datetime.fromisoformat(m["match_date"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        if not (acum - timedelta(hours=3) <= dt <= limita):
            continue
        per_liga[(m["country"], m["league"])].append(m)
    for v in per_liga.values():
        v.sort(key=lambda x: x["match_date"])

    OUT.mkdir(exist_ok=True)
    ARH.mkdir(exist_ok=True)

    pagini = [(f"{BASE}/", "daily", "1.0"),
              (f"{BASE}/istoric.html", "daily", "0.8"),
              (f"{BASE}/track-record.html", "daily", "0.8"),
              (f"{BASE}/metodologie.html", "monthly", "0.6"),
              (f"{BASE}/terms.html", "yearly", "0.3"),
              (f"{BASE}/predictii/index.html", "daily", "0.9")]

    randuri_hub = []
    for tara, liga, slug, nume in LEAGUES:
        lst = per_liga.get((tara, liga), [])
        intrare = cal_map.get((tara, liga))
        (OUT / f"{slug}.html").write_text(
            pagina_liga(tara, liga, slug, nume, meciuri=lst, cal=intrare, zile=zile))
        randuri_hub.append({"slug": slug, "nume": nume, "n": len(lst),
                            "cal_ok": intrare["calibrated"] if intrare else None})
        pagini.append((f"{BASE}/predictii/{slug}.html", "daily", "0.7"))

    (OUT / "index.html").write_text(pagina_hub(randuri_hub))
    scrie_legaturi_index(randuri_hub)

    zile_scrise = []
    for zi in sorted(zile, key=lambda z: z["date"], reverse=True):
        if zi["date"] > acum.date().isoformat():
            continue                                  # ziua viitoare n-are ce arăta
        if len(zile_scrise) >= ARHIVA_ZILE:
            break
        pag = pagina_zi(zi)
        if not pag:
            continue
        (ARH / f'{zi["date"]}.html').write_text(pag)
        zile_scrise.append(zi["date"])
        pagini.append((f'{BASE}/predictii/arhiva/{zi["date"]}.html', "weekly", "0.5"))

    (ARH / "index.html").write_text(pagina_arhiva(zile_scrise))
    pagini.append((f"{BASE}/predictii/arhiva/index.html", "daily", "0.6"))

    scrie_sitemap(pagini)
    print(f"[gen_seo_pages] OK — {len(LEAGUES)} pagini de ligă, {len(zile_scrise)} zile de "
          f"arhivă, sitemap cu {len(pagini)} URL-uri")
    return 0


if __name__ == "__main__":
    sys.exit(main())
