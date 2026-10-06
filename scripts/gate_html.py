#!/usr/bin/env python3
"""Gate HTML (6 oct 2026): înainte de git add, index.html trebuie să aibă toate secțiunile și markerii și cel puțin
atâtea <section> cât în commit-ul anterior. Ieșire ≠0 = NU publica. Pe 3 oct generatorul a șters „Exemplul Pro” și
nimic n-a observat 3 zile — asta e plasa.
Uz: gate_html.py [index.html] [--vs HEAD]"""
from __future__ import annotations
import re, subprocess, sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
OBLIGATORII = ['id="exemplu-pro"', "PRO_SAMPLE_CARD_START", "PRO_SAMPLE_CARD_END", "PRO_TODAY_LIST_START", "PRO_TODAY_LIST_END",
               'class="pro-card"', 'class="plans-pro-detail"', 'id="dovada"', 'id="repere-azi"', 'class="ligi-links"', 'id="abonament"',
               'id="acces"', 'id="intrebari"', 'id="pro-analize"', 'id="matches"', "legal-banner", "PROOF_STATIC_START", "DAILY_STATIC_START",
               "LEAGUES_LINKS_START"]
PERECHI = ["PRO_SAMPLE_CARD", "PRO_TODAY_LIST", "PROOF_STATIC", "DAILY_STATIC", "LEAGUES_LINKS"]


def verifica(html: str, vechi: str | None) -> list[str]:
    err = [f"lipsește: {o}" for o in OBLIGATORII if o not in html]
    for p in PERECHI:
        a, b = html.count(f"<!-- {p}_START -->"), html.count(f"<!-- {p}_END -->")
        if a != 1 or b != 1:
            err.append(f"markerii {p}: START×{a} END×{b} (trebuie exact 1/1)")
    for tag in ("section", "div", "main"):
        o, c = len(re.findall(rf"<{tag}[\s>]", html)), html.count(f"</{tag}>")
        if o != c:
            err.append(f"<{tag}> dezechilibrat: {o} deschise, {c} închise")
    if vechi is not None:
        n0, n1 = len(re.findall(r"<section[\s>]", vechi)), len(re.findall(r"<section[\s>]", html))
        if n1 < n0:
            err.append(f"secțiuni: {n1} acum, {n0} în commit-ul anterior — s-a pierdut conținut")
        ids0 = set(re.findall(r'<section[^>]*id="([^"]+)"', vechi)); ids1 = set(re.findall(r'<section[^>]*id="([^"]+)"', html))
        if ids0 - ids1:
            err.append(f"secțiuni dispărute față de commit-ul anterior: {sorted(ids0 - ids1)}")
    return err


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cale = (Path(args[0]) if args else SITE / "index.html").resolve()
    html = cale.read_text(encoding="utf-8")
    vechi = None
    if "--vs" in sys.argv:
        ref = sys.argv[sys.argv.index("--vs") + 1]
        try:
            vechi = subprocess.check_output(["git", "-C", str(SITE), "show", f"{ref}:{cale.relative_to(SITE).as_posix()}"], text=True)
        except Exception as e:
            print(f"[gate_html] nu pot citi {ref}: {e}")
    err = verifica(html, vechi)
    if err:
        print("[gate_html] BLOCAT: " + " | ".join(err)); sys.exit(1)
    print(f"[gate_html] OK: {cale.name}, {len(re.findall(r'<section[\s>]', html))} secțiuni, markeri 5/5")


if __name__ == "__main__":
    main()
