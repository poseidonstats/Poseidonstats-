#!/usr/bin/env python3
"""Exemplul de analiză Pro de pe site, reîmprospătat ZILNIC (28 sept 2026, cerut de Andreea: „vreau să se publice pe site o
analiză Pro în fiecare zi, să se vadă exemplu cum arată”).

Ia arhiva analizelor Pro de IERI (~/football_predictor/data/pro_analyses/<zi>.json, ce s-a postat în #analize-pro), caută
rezultatul final în football.db, alege o analiză cu rezultat cunoscut (de preferat una la care pick-ul de Bază a ieșit, dar
rezultatul se afișează oricând, și când a greșit) și rescrie cardul dintre markerii PRO_SAMPLE_CARD din index.html:
Verdict + Context vizibile, cu scorul final și verdictul Bazei; Modelul vs realitate / Picks / De urmărit rămân acoperite
(blur + „pe Discord Pro”), ca în designul din iunie. HTML static, citibil de Google și de ChatGPT.
Uz: gen_pro_sample.py [--date 2026-09-27] [--dry-run]     (implicit: ieri, ora României; chemat din daily_publish.sh)"""
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
            return m.group(1).strip() if m else re.sub(r"^🔒\s*", "", l).split("—")[0].strip()
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


def html_card(item: dict, scor: tuple[int, int], baza: str, ok) -> str:
    m = item["match"]; p = parseaza(item["analysis"]); gh, ga = scor
    liga = m.get("league", ""); tara = m.get("country", "")
    head = f"💎 {H.escape(m['home'])} – {H.escape(m['away'])} · {H.escape(liga)}" + (f" ({H.escape(tara)})" if tara else "") + f" · {_data_ro(m.get('date', ''))} · <strong>rezultat final {gh}-{ga}</strong>"
    if baza:
        verdict_baza = {True: f"✅ Pick-ul de bază al analizei, <strong>{_inline(baza)}</strong>, a ieșit.", False: f"❌ Pick-ul de bază al analizei, <strong>{_inline(baza)}</strong>, nu a ieșit — publicăm și când greșim.",
                        None: f"Pick-ul de bază al analizei: <strong>{_inline(baza)}</strong>."}[ok]
    else:
        verdict_baza = ""
    picks = " ".join(_scurt(_inline(l), 120) for l in p["picks"])
    return "\n".join([
        '<div class="pro-card">',
        f'      <div class="pro-card-head">{head}</div>',
        '      <div class="pro-visible">',
        f'        <p><strong>⚡ Verdict:</strong> {_inline(p["verdict"])}</p>',
        f'        <p><strong>📊 Context:</strong> {_inline(p["context"])}</p>',
        (f'        <p class="pro-verificat">{verdict_baza}</p>' if verdict_baza else ''),
        '      </div>',
        '      <div class="pro-locked">',
        '        <div class="pro-locked-content" aria-hidden="true">',
        f'          <p><strong>🧮 Modelul vs realitate:</strong> {_scurt(_inline(p["model"]), 220)}</p>',
        f'          <p><strong>🎯 Piețele alese:</strong> {picks}</p>',
        f'          <p><strong>👁️ De urmărit:</strong> {_scurt(_inline(p["urmarit"]), 160)}</p>',
        '        </div>',
        '        <div class="pro-lock-overlay">',
        '          <span class="pro-lock-icon">🔒</span>',
        '          <span data-i18n="pro.locked">Reconcilierea model–realitate, piețele alese și riscul asumat — pe Discord Pro.</span>',
        '        </div>',
        '      </div>',
        '    </div>'])


def injecteaza(html: str, card: str) -> str:
    bloc = f"{START}\n    {card}\n    {END}"
    if START in html and END in html:
        return re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: bloc, html, flags=re.S)
    i = html.find('<div class="pro-card">'); j = html.find('<p class="pro-disclaimer"', i)
    if i < 0 or j < 0:
        raise SystemExit("[gen_pro_sample] nu găsesc cardul .pro-card / .pro-disclaimer în index.html")
    html = html[:i] + bloc + "\n    " + html[j:]
    return re.sub(r"<!-- Exemplu analiză Pro — [^\n]*-->", "<!-- Exemplu analiză Pro — analiza de IERI din arhiva #analize-pro, cu rezultatul real; rescris zilnic de scripts/gen_pro_sample.py -->", html)


# ----------------------------------------------------------------- lista Pro de azi (cu lacăt)
def _ora_ro_iso(iso: str) -> str:
    try:
        from datetime import timezone
        d = datetime.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        return d.astimezone(RO).strftime("%H:%M")
    except (ValueError, TypeError):
        return ""


def html_lista_pro(rows: list[dict]) -> str:
    """Meciurile analizate azi în Pro, doar nume/ligă/oră, cu lacăt — vizitatorul vede ce ar primi, nu primește."""
    if not rows:
        return ""
    li = []
    for r in rows:
        ora = _ora_ro_iso(r.get("match_date", "")); tara = f" ({H.escape(r['country'])})" if r.get("country") else ""
        li.append(f"        <li>🔒 <strong>{H.escape(r['home'])} – {H.escape(r['away'])}</strong> · {H.escape(r.get('league', ''))}{tara}" + (f" · {ora}" if ora else "") + "</li>")
    n = len(rows)
    return "\n".join(['<div class="pro-today">',
                      f'      <p class="pro-today-head">🔒 <strong>Azi în Pro: {n} analize scrise</strong>, cu context verificat (clasament, formă, H2H, absențe) — pe Discord, dimineața.</p>',
                      '      <ul class="pro-today-list">', *li, '      </ul>', '    </div>'])


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
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=(datetime.now(RO) - timedelta(days=1)).strftime("%Y-%m-%d")); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    f = ARHIVA / f"{a.date}.json"
    if not f.exists():
        print(f"[gen_pro_sample] fără arhivă Pro pentru {a.date} ({f}) — cardul rămâne cel de ieri"); return
    items = json.loads(f.read_text()).get("items") or []
    ales = alege(items, rezultate([it["match"].get("fixture_id") for it in items if it["match"].get("fixture_id")]))
    if not ales:
        print(f"[gen_pro_sample] {a.date}: {len(items)} analize, niciuna cu rezultat final în bază — cardul rămâne"); return
    it, scor, baza, ok = ales
    card = html_card(it, scor, baza, ok)
    print(f"[gen_pro_sample] {a.date}: {it['match']['home']} – {it['match']['away']} ({it['match'].get('league')}) {scor[0]}-{scor[1]} · bază «{baza}» → {'a ieșit' if ok else ('nu a ieșit' if ok is False else 'neevaluat')}")
    azi = datetime.now(RO).strftime("%Y-%m-%d"); rows = lista_pro_azi(azi)
    print(f"[gen_pro_sample] lista Pro de azi ({azi}): {len(rows)} meciuri")
    if a.dry_run:
        print(card); print(html_lista_pro(rows)); return
    html = injecteaza(INDEX.read_text(encoding="utf-8"), card)
    html = injecteaza_lista(html, html_lista_pro(rows))
    INDEX.write_text(html, encoding="utf-8")
    print(f"[gen_pro_sample] scris {INDEX}")


if __name__ == "__main__":
    main()
