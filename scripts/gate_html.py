#!/usr/bin/env python3
"""Verifică separat structura primei pagini și secțiunile generate din catalog."""
from __future__ import annotations
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
OBLIGATORII = ['id="exemplu-pro"', "PRO_SAMPLE_CARD_START", "PRO_SAMPLE_CARD_END", "PRO_TODAY_LIST_START", "PRO_TODAY_LIST_END",
               'class="pro-card"', 'class="plans-pro-detail"', 'id="dovada"', 'id="repere-azi"', 'class="ligi-links"', 'id="abonament"',
               'id="acces"', 'id="intrebari"', 'id="pro-analize"', 'id="matches"', "legal-banner", "PROOF_STATIC_START", "DAILY_STATIC_START",
               "LEAGUES_LINKS_START"]
PERECHI = ["PRO_SAMPLE_CARD", "PRO_TODAY_LIST", "PROOF_STATIC", "DAILY_STATIC", "LEAGUES_LINKS"]


class Structura(HTMLParser):
    def __init__(self, html: str):
        super().__init__()
        self.atribute: list[str] = []
        self.taguri: list[str] = []
        self.iduri: set[str] = set()
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        self.taguri.append(tag)
        for name, value in attrs:
            if name.startswith("data-"):
                self.atribute.append(name)
            elif name == "id":
                self.iduri.add(value)


def verifica_prima_pagina(html: str) -> list[str]:
    pagina = Structura(html)
    erori = []
    etape = ("data-visitor-matches", "data-visitor-sample", "data-visitor-locked")
    for nume in ("data-home-page", "data-compact-home", *etape):
        if pagina.atribute.count(nume) != 1:
            erori.append(f"{nume}: trebuie să apară o singură dată")
    if not erori and sorted(etape, key=pagina.atribute.index) != list(etape):
        erori.append("ordinea obligatorie este gratuite, exemplul Pro, meciuri cu lacăt")
    if pagina.taguri.count("main") != 1:
        erori.append("prima pagină trebuie să conțină un singur element main")
    if "data-match-catalog" in pagina.atribute or pagina.iduri & {"dovada", "repere-azi", "pro-analize", "discord-access-details"}:
        erori.append("prima pagină conține blocuri din catalogul complet")
    return erori


def verifica(html: str, vechi: str | None, fisier: str = "") -> list[str]:
    pagina = Structura(html)
    if fisier == "index.html" or "data-home-page" in pagina.atribute:
        return verifica_prima_pagina(html)
    catalog = "data-match-catalog" in pagina.atribute
    if fisier == "meciuri.html" and not catalog:
        return ["catalogul complet nu are identificatorul data-match-catalog"]
    compact = catalog or "data-compact-home" in pagina.atribute
    fara_exemplu = compact and all(
        re.search(rf"<!-- PRO_SAMPLE_{rol}_START -->\s*<!-- PRO_SAMPLE_{rol}_END -->", html)
        for rol in ("CARD", "PREVIEW")
    )
    err = [f"lipsește: {o}" for o in OBLIGATORII if o not in html and not (fara_exemplu and o == 'class="pro-card"')]
    perechi = [*PERECHI, "PRO_SAMPLE_PREVIEW"] if compact else PERECHI
    for p in perechi:
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
        ids0 = set(re.findall(r'<section[^>]*id="([^"]+)"', vechi))
        ids1 = set(re.findall(r'<section[^>]*id="([^"]+)"', html))
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
        rel = cale.relative_to(SITE).as_posix()
        git = ["git", "-C", str(SITE), "show"]
        rezultat = subprocess.run([*git, f"{ref}:{rel}"], text=True, capture_output=True)
        if rezultat.returncode == 0:
            vechi = rezultat.stdout
        elif rel == "meciuri.html":
            # Prima publicare după separare: comparăm catalogul cu secțiunile sale din vechea pagină.
            index = subprocess.check_output([*git, f"{ref}:index.html"], text=True)
            principal = re.search(r'<main class="container visitor-expanded"[^>]*>.*?</main>', index, re.S)
            if principal is None:
                sys.exit(f"[gate_html] Nu pot identifica vechiul catalog în {ref}.")
            vechi = principal.group()
        else:
            sys.exit(f"[gate_html] Nu pot citi {ref}:{rel}.")
    err = verifica(html, vechi, cale.name)
    if err:
        print("[gate_html] BLOCAT: " + " | ".join(err))
        sys.exit(1)
    print(f"[gate_html] OK: {cale.name}, {len(re.findall(r'<section[\s>]', html))} secțiuni")


if __name__ == "__main__":
    main()
