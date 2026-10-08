#!/usr/bin/env python3
"""Verificare LIVE a site-ului (6 oct 2026): ce promite pagina trebuie să existe pe pagina publicată, azi.
Rulează din launchd la 08:15, 12:45, 20:15. Orice lipsă → mesaj pe Telegram (tg_trimite.sh). Nu scrie nimic pe site.
Uz: site_check_live.py [--fara-telegram]"""
from __future__ import annotations
import datetime as dt, json, re, subprocess, sys, urllib.request
from zoneinfo import ZoneInfo

SITE = "https://poseidonstats.com"
API = "https://poseidon-members.poseidonstats.workers.dev"
TG = "/Users/andreeastratulat/odds_decoder/scripts/tg_trimite.sh"
LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]


def get(url: str, timeout: int = 25) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "poseidon-site-check/1", "cache-control": "no-cache"}), timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)


def verifica(acum: dt.datetime) -> list[str]:
    azi = acum.date(); ieri = azi - dt.timedelta(days=1); err: list[str] = []
    data_ro = f"{azi.day} {LUNI[azi.month - 1]} {azi.year}"
    st, html = get(f"{SITE}/index.html")
    if st != 200: return [f"index.html HTTP {st}"]
    for nume, semn in (("secțiunea Exemplul Pro", 'id="exemplu-pro"'), ("cardul Pro", 'class="pro-card"'), ("lista Pro de azi", 'class="pro-today"'),
                       ("blocul «Ce primești pentru 20 $»", 'class="plans-pro-detail"'), ("secțiunea Dovada", 'id="dovada"'), ("Repere azi", 'id="repere-azi"'),
                       ("abonamentele", 'id="abonament"'), ("banner-ul legal", "legal-banner"), ("eticheta trial Pro", "plans.pro.trial")):
        if semn not in html: err.append(f"index.html: lipsește {nume}")
    m = re.search(r'class="pro-card-head">(.*?)</div>', html, re.S)
    cap = re.sub(r"<[^>]+>", "", m.group(1)) if m else ""   # 8 oct 2026: capul are <span data-date> (i18n) — textul se citește fără taguri
    if m and acum.hour >= 8 and data_ro not in cap: err.append(f"cardul Pro nu e cel de azi ({data_ro}): «{cap[:80]}»")
    if 'id="repere-azi"' in html and data_ro not in html.split('id="repere-azi"')[1][:1500]: err.append(f"Repere azi nu are data de azi ({data_ro})")
    st, js = get(f"{SITE}/assets/app.js")
    if st != 200 or "trial-banner" not in js: err.append("app.js: banda de trial lipsește sau fișierul nu răspunde")
    st, body = get(f"{SITE}/data/predictions.json")
    try:
        d = json.loads(body); gen = d.get("generated_at", "")[:10]
        if gen != azi.isoformat(): err.append(f"predictions.json generat {gen or '?'}, nu azi")
        free = sum(1 for x in d.get("matches", []) if x.get("free")); 
        if free != 5: err.append(f"predicții gratuite: {free} în loc de 5")
    except Exception as e: err.append(f"predictions.json invalid ({st}): {e!r}"[:160])
    st, _ = get(f"{SITE}/analize/{ieri.isoformat()}.html")
    if st != 200 and acum.hour >= 8: err.append(f"arhiva Pro de ieri lipsește ({ieri}, HTTP {st})")
    # 7 oct 2026: regresia din 29 sept (membrul Basic vedea lacăte 50 de minute): CSP-ul paginilor care încarcă members.js
    # trebuie să permită cererile către Worker, altfel browserul le blochează tăcut și site-ul cade pe lista publică
    for pag in ("index.html", "simulator.html", "track-record.html", "istoric.html"):
        st, h = get(f"{SITE}/{pag}")
        if st == 200 and "members.js" in h:
            m = re.search(r"connect-src([^;\"]*)", h)
            if not m or "poseidon-members.poseidonstats.workers.dev" not in m.group(1): err.append(f"{pag}: încarcă members.js dar CSP connect-src NU permite Worker-ul (membrii ar vedea lacăte)")
    st, body = get(f"{API}/api/health?zi={azi.isoformat()}")
    try:
        h = json.loads(body); gen = (h.get("predictions_full") or {}).get("generated_at", "")[:10]
        if gen != azi.isoformat(): err.append(f"membri: predictions_full în KV e din {gen or '?'}, nu de azi")
        if acum.hour >= 8 and (h.get("pro") or 0) < 1: err.append("membri: ZERO analize Pro în KV pentru azi (abonații Pro nu văd nimic)")
    except Exception as e: err.append(f"membri: /api/health nu răspunde ({st}): {e!r}"[:160])
    return err


def main() -> None:
    acum = dt.datetime.now(ZoneInfo("Europe/Bucharest")); err = verifica(acum)
    if err:
        msg = f"❌ Site check {acum:%d.%m %H:%M}: {len(err)} probleme pe poseidonstats.com\n" + "\n".join(f"• {e}" for e in err)
        print(msg)
        if "--fara-telegram" not in sys.argv: subprocess.run([TG, msg], check=False)
        sys.exit(1)
    print(f"[site_check] OK {acum:%d.%m %H:%M}: exemplul Pro de azi, lista Pro, trial, 5 gratuite, JSON de azi, arhiva de ieri, KV membri de azi, CSP permite Worker-ul pe paginile de membri")


if __name__ == "__main__":
    main()
