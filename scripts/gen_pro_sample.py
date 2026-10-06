#!/usr/bin/env python3
"""Exemplul de analiză Pro de pe prima pagină (28 sept 2026, cerut de Andreea; 2 oct 2026: „zilnic una nouă, ÎNAINTE de meci, nu după”).

Cardul = analiza de AZI, completă, fără lacăt — prima din arhiva zilei (~/football_predictor/data/pro_analyses/<zi>.json, cea
scrisă la 07:20 și postată în #analize-pro). Până apare fișierul zilei (publicarea site-ului e la 06:10, analizele la 07:28),
cardul rămâne analiza de ieri, aceeași, acum cu scorul final. Sub card: rezultatul analizei de ieri + link la verificarea de a
doua zi din arhivă (analize/<zi>.html). Lista „azi în Pro” rămâne cu lacăt, fără meciul publicat.
Se cheamă din daily_publish.sh (06:10) și din publish_pro_sample.sh (07:45, după cronul Pro, cu push propriu).
Uz: gen_pro_sample.py [--date 2026-10-02] [--dry-run]     (implicit: azi, ora României)"""
from __future__ import annotations

import argparse
import html as H
import json
import re
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

SITE = Path(__file__).resolve().parent.parent
INDEX = SITE / "index.html"
ARHIVA = Path.home() / "football_predictor" / "data" / "pro_analyses"
DB = "file:" + str(Path.home() / "football_predictor" / "football.db") + "?mode=ro"
RO = ZoneInfo("Europe/Bucharest")
START, END = "<!-- PRO_SAMPLE_CARD_START -->", "<!-- PRO_SAMPLE_CARD_END -->"
LISTA_START, LISTA_END = "<!-- PRO_TODAY_LIST_START -->", "<!-- PRO_TODAY_LIST_END -->"
POSEIDON_SCRIPTS = Path.home() / "football_predictor" / "scripts" / "poseidon"
PRED_FULL = Path.home() / "football_predictor" / "data" / "predictions_full.json"
LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]


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
    s = text[i + len(marker):j].strip()
    s = re.sub(r"^\*\*[^*]+:\*\*\s*", "", s)          # „**Verdict:** ”
    return s.strip()


def parseaza(text: str) -> dict:
    p = {"verdict": _sectiune(text, "⚡", ("📊", "🧮", "🎯 **Picks", "👁️")),
         "context": _sectiune(text, "📊", ("🧮", "🎯 **Picks", "👁️")),
         "model": _sectiune(text, "🧮", ("🎯 **Picks", "👁️")),
         "urmarit": _sectiune(text, "👁️", ("*informativ",))}
    i = text.find("🎯 **Picks"); j = text.find("👁️", i) if i >= 0 else -1
    bloc = text[i:j if j >= 0 else len(text)] if i >= 0 else ""
    p["picks"] = [l.strip() for l in bloc.splitlines()[1:] if l.strip() and l.strip()[0] in "🔒🎯💎"]
    return p


def piata_baza(picks: list[str]) -> str:
    for l in picks:
        if l.startswith("🔒"):
            m = re.search(r"\*\*Baz[ăa]:\*\*\s*(.+?)\s+—", l)
            piata = m.group(1) if m else re.sub(r"^🔒\s*", "", l).split("—")[0]
            return piata.replace("**", "").strip(" .*")   # 6 oct 2026: „**Peste 1.5 goluri” → „Peste 1.5 goluri”
    return ""


def evalueaza(piata: str, gh: int, ga: int):
    """True/False dacă piața de Bază a ieșit; None dacă nu e o piață pe care o știu evalua din scor."""
    p = piata.strip(); t = gh + ga; low = p.lower()
    m = re.match(r"(?i)peste\s+(\d)[.,]5", p)
    if m:
        return t > int(m.group(1))
    m = re.match(r"(?i)sub\s+(\d)[.,]5", p)
    if m:
        return t <= int(m.group(1))
    if re.match(r"(?i)(ambele înscriu|ambele marchează|btts|gg)\b", p):
        return gh > 0 and ga > 0
    if re.match(r"1X\b", p):
        return gh >= ga
    if re.match(r"X2\b", p):
        return ga >= gh
    if re.match(r"12\b", p):
        return gh != ga
    if re.match(r"(?i)(egal|x)\b", p):
        return gh == ga
    if re.match(r"1\b", p) or "victorie gazde" in low or "gazdele câștigă" in low:
        return gh > ga
    if re.match(r"2\b", p) or "victorie oaspeți" in low or "oaspeții câștigă" in low:
        return ga > gh
    return None


# ----------------------------------------------------------------- date
def rezultate(fids: list[int]) -> dict[int, tuple[int, int]]:
    con = sqlite3.connect(DB, uri=True); out = {}
    for fid in fids:
        r = con.execute("select goals_home, goals_away, status_short from fixtures where id=?", (fid,)).fetchone()
        if r and r[0] is not None and r[2] in ("FT", "AET", "PEN"):
            out[fid] = (int(r[0]), int(r[1]))
    return out


def alege(items: list[dict], rez: dict):
    """(item, scor, piața de bază, a ieșit?) — cu rezultat cunoscut; întâi cele la care Baza a ieșit, apoi cele neevaluabile,
    apoi cele picate; în interiorul grupului, ordinea arhivei (cel mai bun pick primul). None dacă nimic nu are rezultat."""
    cand = []
    for i, it in enumerate(items):
        fid = it["match"].get("fixture_id"); scor = rez.get(fid)
        if not scor:
            continue
        baza = piata_baza(parseaza(it["analysis"])["picks"]); ok = evalueaza(baza, *scor) if baza else None
        cand.append(({True: 0, None: 1, False: 2}[ok], i, it, scor, baza, ok))
    if not cand:
        return None
    cand.sort(key=lambda c: (c[0], c[1]))
    _, _, it, scor, baza, ok = cand[0]
    return it, scor, baza, ok


# ----------------------------------------------------------------- HTML
def _inline(s: str) -> str:
    s = H.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*\((.+?)\)\*", r"<em>(\1)</em>", s)
    s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
    return s


def _scurt(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def _data_ro(iso: str) -> str:
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d"); return f"{d.day} {LUNI[d.month - 1]} {d.year}"
    except ValueError:
        return iso


def html_card(item: dict, zi: str, generat: str, scor: tuple[int, int] | None, baza: str, ok) -> str:
    """Analiza completă, fără lacăt. Dacă meciul s-a jucat deja (cardul de ieri, dimineața devreme), capul arată scorul și verdictul Bazei."""
    m = item["match"]; p = parseaza(item["analysis"])
    liga = m.get("league", ""); tara = m.get("country", "")
    ora = generat[11:16] if len(generat) >= 16 else ""
    head = f"💎 {H.escape(m['home'])} – {H.escape(m['away'])} · {H.escape(liga)}" + (f" ({H.escape(tara)})" if tara else "") + f" · {_data_ro(m.get('date', zi))}"
    head += f" · <strong>rezultat final {scor[0]}-{scor[1]}</strong>" if scor else (f" · <strong>publicată la {ora}, înainte de meci</strong>" if ora else " · <strong>publicată înainte de meci</strong>")
    picks = "".join(f"<li>{_inline(l)}</li>" for l in p["picks"])
    verif = ""
    if scor and baza:
        verif = {True: f"✅ Pick-ul de bază, <strong>{_inline(baza)}</strong>, a ieșit.", False: f"❌ Pick-ul de bază, <strong>{_inline(baza)}</strong>, nu a ieșit — publicăm și când greșim.", None: f"Pick-ul de bază: <strong>{_inline(baza)}</strong>."}[ok]
        verif = f'        <p class="pro-verificat">{verif} <a href="analize/{zi}.html#m{m.get("fixture_id")}">Verificarea completă →</a></p>\n'
    return "\n".join([
        '<div class="pro-card">',
        f'      <div class="pro-card-head">{head}</div>',
        '      <div class="pro-visible">',
        f'        <p><strong>⚡ Verdict:</strong> {_inline(p["verdict"])}</p>',
        f'        <p><strong>📊 Context:</strong> {_inline(p["context"])}</p>',
        f'        <p><strong>🧮 Modelul vs realitate:</strong> {_inline(p["model"])}</p>',
        f'        <p><strong>🎯 Piețele alese:</strong></p><ul>{picks}</ul>',
        f'        <p><strong>👁️ De urmărit:</strong> {_inline(p["urmarit"])}</p>',
        verif.rstrip("\n") if verif else '        <p class="muted">Rezultatul și verificarea pick-urilor apar mâine dimineață, în <a href="analize/index.html">arhiva analizelor</a>.</p>',
        '      </div>',
        '    </div>'])


def html_ieri(item: dict, zi: str, scor: tuple[int, int] | None, baza: str, ok) -> str:
    """Linia de sub card: ce s-a întâmplat cu analiza publicată ieri în același loc."""
    m = item["match"]; nume = f"{H.escape(m['home'])} – {H.escape(m['away'])}"
    if not scor:
        return f'<p class="pro-ieri muted">Ieri, aici: <strong>{nume}</strong> — rezultatul final nu e încă în bază; verificarea apare în <a href="analize/{zi}.html">arhiva zilei</a>.</p>'
    semn = {True: "✅ a ieșit", False: "❌ nu a ieșit", None: ""}[ok]
    return f'<p class="pro-ieri">Ieri, aici: <strong>{nume}</strong>, {scor[0]}-{scor[1]}' + (f" — bază <strong>{_inline(baza)}</strong> {semn}" if baza else "") + f'. <a href="analize/{zi}.html#m{m.get("fixture_id")}">Verificarea de a doua zi →</a></p>'


def injecteaza(html: str, card: str, ieri: str = "") -> str:
    bloc = f"{START}\n    {card}" + (f"\n    {ieri}" if ieri else "") + f"\n    {END}"
    if START in html and END in html:
        return re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: bloc, html, flags=re.S)
    # 6 oct 2026: fără fallback „între .pro-card și .pro-disclaimer” — ștergea tot ce stătea între ele (blocul „Ce primești pentru 20 $”).
    raise SystemExit(f"[gen_pro_sample] markerii {START} / {END} lipsesc din index.html — abort, nimic scris")


# ----------------------------------------------------------------- lista Pro de azi (cu lacăt)
def _ora_ro_iso(iso: str) -> str:
    try:
        from datetime import timezone
        d = datetime.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        return d.astimezone(RO).strftime("%H:%M")
    except (ValueError, TypeError):
        return ""


def stat_30_zile(azi: str) -> tuple[int, int, int, int]:
    """(zile, medie, minim, maxim) analize Pro pe zi în ultimele 30 de zile dinaintea lui `azi` (din arhivă)."""
    de_la = (datetime.strptime(azi, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d"); n = []
    for f in sorted(ARHIVA.glob("????-??-??.json")):
        if de_la <= f.stem < azi:
            try:
                n.append(len([it for it in (json.loads(f.read_text()).get("items") or []) if it.get("match", {}).get("fixture_id")]))
            except (OSError, ValueError):
                pass
    n = [x for x in n if x]
    return (len(n), round(sum(n) / len(n)), min(n), max(n)) if n else (0, 0, 0, 0)


def html_lista_pro(rows: list[dict], fara_fid: int | None = None, stat: tuple[int, int, int, int] | None = None) -> str:
    """Meciurile analizate azi în Pro, doar nume/ligă/oră, cu lacăt — vizitatorul vede ce ar primi, nu primește."""
    rows = [r for r in rows if fara_fid is None or r.get("fixture_id") != fara_fid]   # 6 oct 2026: fără card publicat → nimic exclus
    if not rows:
        return ""
    li = []
    for r in rows:
        ora = _ora_ro_iso(r.get("match_date", "")); tara = f" ({H.escape(r['country'])})" if r.get("country") else ""
        li.append(f"        <li>🔒 <strong>{H.escape(r['home'])} – {H.escape(r['away'])}</strong> · {H.escape(r.get('league', ''))}{tara}" + (f" · {ora}" if ora else "") + "</li>")
    n = len(rows); linie_stat = []
    if stat and stat[0]:
        linie_stat = [f'      <p class="pro-today-stat muted">În ultimele {stat[0]} de zile: în medie <strong>{stat[1]} analize Pro pe zi</strong>, minim {stat[2]}, maxim {stat[3]}.</p>']
    return "\n".join(['<div class="pro-today">',
                      f'      <p class="pro-today-head">🔒 <strong>Încă {n} analize azi în Pro</strong>, cu context verificat (clasament, formă, H2H, absențe) — pe site și pe Discord, dimineața.</p>',
                      '      <ul class="pro-today-list">', *li, '      </ul>', *linie_stat, '    </div>'])


def injecteaza_lista(html: str, lista: str) -> str:
    if not lista:
        return html
    bloc = f"{LISTA_START}\n    {lista}\n    {LISTA_END}"
    if LISTA_START in html and LISTA_END in html:
        return re.sub(re.escape(LISTA_START) + r".*?" + re.escape(LISTA_END), lambda _: bloc, html, flags=re.S)
    i = html.find(END)
    if i < 0:
        raise SystemExit("[gen_pro_sample] lipsește markerul cardului; rulează întâi cardul")
    i += len(END)
    return html[:i] + "\n    " + bloc + html[i:]


def lista_pro_azi(zi: str, limit: int = 12) -> list[dict]:
    """Aceeași selecție pe care o analizează cronul Pro la 07:20 (emit_matches), cu ora din predictions_full."""
    sys.path.insert(0, str(POSEIDON_SCRIPTS))
    try:
        from discord_premium_daily import emit_matches
    except Exception as e:
        print(f"[gen_pro_sample] nu pot importa emit_matches: {e}"); return []
    rows = emit_matches(limit=limit, target_date=zi)
    try:
        ore = {m.get("fixture_id"): m.get("match_date") for m in json.loads(PRED_FULL.read_text()).get("matches", [])}
    except Exception:
        ore = {}
    for r in rows:
        r["match_date"] = ore.get(r.get("fixture_id"), "") or ""
    return rows


# ----------------------------------------------------------------- CLI
def _incarca(zi: str):
    f = ARHIVA / f"{zi}.json"
    if not f.exists():
        return None, ""
    d = json.loads(f.read_text()); items = [it for it in d.get("items") or [] if it.get("match", {}).get("fixture_id")]
    return (items[0] if items else None), d.get("generated_at", "")


def _verdict(item: dict):
    """(scor, piața de bază, a ieșit?) pentru un item — scor None dacă meciul nu e încheiat în bază."""
    fid = item["match"]["fixture_id"]; scor = rezultate([fid]).get(fid)
    baza = piata_baza(parseaza(item["analysis"])["picks"])
    return scor, baza, (evalueaza(baza, *scor) if (scor and baza) else None)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=datetime.now(RO).strftime("%Y-%m-%d")); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    azi = a.date; ieri = (datetime.strptime(azi, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    it_azi, gen_azi = _incarca(azi); it_ieri, gen_ieri = _incarca(ieri)
    if it_azi:
        scor, baza, ok = _verdict(it_azi)
        card = html_card(it_azi, azi, gen_azi, scor, baza, ok); zi_card = azi; fid_card = it_azi["match"]["fixture_id"]
        linie = html_ieri(it_ieri, ieri, *_verdict(it_ieri)) if it_ieri else ""
        print(f"[gen_pro_sample] card AZI {azi}: {it_azi['match']['home']} – {it_azi['match']['away']} ({it_azi['match'].get('league')}), scrisă la {gen_azi[11:16]}")
    elif it_ieri:
        scor, baza, ok = _verdict(it_ieri)
        card = html_card(it_ieri, ieri, gen_ieri, scor, baza, ok); zi_card = ieri; fid_card = None; linie = ""
        print(f"[gen_pro_sample] fără arhivă Pro pentru {azi} încă — cardul rămâne analiza de ieri ({ieri}: {it_ieri['match']['home']} – {it_ieri['match']['away']}), " + (f"rezultat {scor[0]}-{scor[1]}" if scor else "fără rezultat încă"))
    else:
        print(f"[gen_pro_sample] nicio arhivă Pro pentru {azi} sau {ieri} — cardul rămâne"); return
    rows = lista_pro_azi(azi)
    print(f"[gen_pro_sample] lista Pro de azi ({azi}): {len(rows)} meciuri" + (", fără cel publicat" if fid_card else ""))
    if a.dry_run:
        print(card); print(linie); print(html_lista_pro(rows, fid_card, stat_30_zile(azi))); return
    html = injecteaza(INDEX.read_text(encoding="utf-8"), card, linie)
    html = injecteaza_lista(html, html_lista_pro(rows, fid_card, stat_30_zile(azi)))
    INDEX.write_text(html, encoding="utf-8")
    print(f"[gen_pro_sample] scris {INDEX} (card {zi_card})")


if __name__ == "__main__":
    main()
