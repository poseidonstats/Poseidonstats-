#!/usr/bin/env python3
"""DATASET public al jurnalului forward POSEIDON (29 sept 2026, OK Andreea după evaluarea ChatGPT): fiecare predicție REZOLVATĂ, cu ora înghețării,
probabilitățile brute, rezultatul și — unde avem mapare validată prin nume + scor — cota de închidere a pieței, fără marjă.
Fără nume de case de pariuri nicăieri (decizia Andreei): coloanele și textul sunt neutre („piață", „casă de pariuri licențiată în România").
Scrie data/dataset/jurnal_YYYY-MM.csv (pe luna meciului; git comprimă bine textul care doar crește), index.json, platt_calibration.json
(parametrii cu care site-ul afișează probabilitățile) și blocul „Date deschise" din track-record.html (markeri DATASET_STATIC, după audit).
Doar meciuri rezolvate → nu dă nimic din selecția zilei (produsul Basic/Pro).
Uz: gen_dataset.py [--dry-run]   (chemat din daily_publish.sh, după gen_audit)"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_audit as GA  # JURNAL, PLATT, incarca_inchidere

SITE = Path(__file__).resolve().parent.parent
OUT_DIR = SITE / "data" / "dataset"
PAGINA = SITE / "track-record.html"
START, END = "<!-- DATASET_STATIC_START -->", "<!-- DATASET_STATIC_END -->"
RO = ZoneInfo("Europe/Bucharest")
REPO_SCRIPT = "https://github.com/poseidonstats/Poseidonstats-/blob/main/scripts/gen_audit.py"
RENUME = {"sb_p_o25": "mkt_ro_p_o25", "dayof_sb_p_o25": "dayof_mkt_ro_p_o25"}            # nume neutre în public
INCHIDERE = ["home", "draw", "away", "over_1_5", "over_2_5", "over_3_5", "btts", "ht_over_0_5", "ht_over_1_5"]
JURNAL_COLOANE = ["freeze_ts", "fixture_id", "match_date", "country", "league", "home_team", "away_team", "xg_home", "xg_away",
                  "prob_home", "prob_draw", "prob_away", "prob_over_1_5", "prob_over_2_5", "prob_over_3_5", "prob_btts", "prob_ht_over_0_5", "prob_ht_over_1_5",
                  "top_score_h", "top_score_a", "top_score_prob", "mkt_p_o25", "sb_p_o25", "ft_home", "ft_away", "ht_home", "ht_away",
                  "outcome_over_1_5", "outcome_over_2_5", "outcome_over_3_5", "outcome_btts", "outcome_ht_over_0_5", "outcome_ht_over_1_5", "outcome_1x2", "status", "resolved_ts",
                  "dayof_ts", "dayof_xg_home", "dayof_xg_away", "dayof_prob_home", "dayof_prob_draw", "dayof_prob_away", "dayof_prob_over_1_5", "dayof_prob_over_2_5",
                  "dayof_prob_over_3_5", "dayof_prob_btts", "dayof_prob_ht_over_0_5", "dayof_prob_ht_over_1_5", "dayof_mkt_p_o25", "dayof_sb_p_o25"]
COLOANE = [RENUME.get(c, c) for c in JURNAL_COLOANE] + [f"close_p_{k}" for k in INCHIDERE] + ["close_hours_before_ko"]
DESCRIERI = {
    "freeze_ts": "momentul (UTC) la care predicția a fost înghețată și jurnalizată — înainte de meci", "fixture_id": "identificatorul meciului la furnizorul de date sportive",
    "match_date": "data și ora meciului (UTC), așa cum le avea furnizorul la rezolvare", "country": "țara competiției", "league": "competiția", "home_team": "gazde", "away_team": "oaspeți",
    "xg_home": "goluri așteptate estimate de model pentru gazde (λ)", "xg_away": "goluri așteptate estimate de model pentru oaspeți (λ)",
    "prob_home": "probabilitate BRUTĂ înghețată: victorie gazde", "prob_draw": "probabilitate brută: egal", "prob_away": "probabilitate brută: victorie oaspeți",
    "prob_over_1_5": "probabilitate brută: peste 1,5 goluri", "prob_over_2_5": "probabilitate brută: peste 2,5 goluri", "prob_over_3_5": "probabilitate brută: peste 3,5 goluri",
    "prob_btts": "probabilitate brută: ambele echipe marchează", "prob_ht_over_0_5": "probabilitate brută: gol în prima repriză", "prob_ht_over_1_5": "probabilitate brută: peste 1,5 goluri în prima repriză",
    "top_score_h": "scorul exact cel mai probabil — goluri gazde", "top_score_a": "scorul exact cel mai probabil — goluri oaspeți", "top_score_prob": "probabilitatea acelui scor exact",
    "mkt_p_o25": "probabilitatea implicită a pieței pentru peste 2,5 la ora predicției (agregator de cote), unde era disponibilă", "mkt_ro_p_o25": "probabilitatea implicită pentru peste 2,5 la ora predicției, la o casă de pariuri licențiată în România, unde era disponibilă",
    "ft_home": "goluri gazde la final", "ft_away": "goluri oaspeți la final", "ht_home": "goluri gazde la pauză", "ht_away": "goluri oaspeți la pauză",
    "outcome_over_1_5": "1 dacă s-au marcat peste 1,5 goluri, altfel 0", "outcome_over_2_5": "1 dacă peste 2,5, altfel 0", "outcome_over_3_5": "1 dacă peste 3,5, altfel 0", "outcome_btts": "1 dacă ambele au marcat, altfel 0",
    "outcome_ht_over_0_5": "1 dacă a fost gol în prima repriză, altfel 0", "outcome_ht_over_1_5": "1 dacă peste 1,5 goluri în prima repriză, altfel 0", "outcome_1x2": "rezultatul: 1 gazde, X egal, 2 oaspeți",
    "status": "RESOLVED — doar meciurile cu rezultat intră în dataset", "resolved_ts": "momentul (UTC) la care rezultatul a fost înregistrat",
    "dayof_ts": "momentul unei a doua rulări, în ziua meciului, când există (probabilitățile brute de atunci — NU sunt cele publicate)",
    "dayof_xg_home": "λ gazde la rularea din ziua meciului", "dayof_xg_away": "λ oaspeți la rularea din ziua meciului", "dayof_prob_home": "probabilitate brută la rularea din ziua meciului: gazde",
    "dayof_prob_draw": "idem: egal", "dayof_prob_away": "idem: oaspeți", "dayof_prob_over_1_5": "idem: peste 1,5", "dayof_prob_over_2_5": "idem: peste 2,5", "dayof_prob_over_3_5": "idem: peste 3,5",
    "dayof_prob_btts": "idem: ambele marchează", "dayof_prob_ht_over_0_5": "idem: gol în prima repriză", "dayof_prob_ht_over_1_5": "idem: peste 1,5 în prima repriză",
    "dayof_mkt_p_o25": "probabilitatea implicită a pieței (agregator) pentru peste 2,5 la rularea din ziua meciului", "dayof_mkt_ro_p_o25": "idem, la casa licențiată în România",
    "close_p_home": "cota de închidere a pieței, fără marjă: victorie gazde (gol dacă meciul nu are mapare validată)", "close_p_draw": "închidere: egal", "close_p_away": "închidere: victorie oaspeți",
    "close_p_over_1_5": "închidere: peste 1,5", "close_p_over_2_5": "închidere: peste 2,5", "close_p_over_3_5": "închidere: peste 3,5", "close_p_btts": "închidere: ambele marchează",
    "close_p_ht_over_0_5": "închidere: gol în prima repriză", "close_p_ht_over_1_5": "închidere: peste 1,5 în prima repriză",
    "close_hours_before_ko": "câte ore înainte de start a fost luat prețul de închidere (ultimul disponibil)",
}


def _mii(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _num(v) -> str:
    return "" if v is None else repr(float(v))     # precizie completă: auditul refăcut din CSV dă EXACT cifrele publicate (rotunjirea la 4 zecimale le mișca în a 4-a zecimală)


def _inghetat_inainte(r: dict) -> bool:
    f = str(r.get("freeze_ts") or "")[:19].replace("T", " "); m = str(r.get("match_date") or "")[:19].replace("T", " ")
    return not (f and m) or f < m


def randuri_publice(rows: list[dict], inchidere: dict[int, dict]) -> list[dict]:
    """Doar RESOLVED; coloanele jurnalului redenumite neutru; + cota de închidere unde există mapare. Fiecare rând are exact COLOANE."""
    out = []
    for r in rows:
        if r.get("status") != "RESOLVED" or not _inghetat_inainte(r):   # 6 oct 2026: fără rândurile înghețate după kickoff (339, iunie)
            continue
        d = {RENUME.get(c, c): (r.get(c) if r.get(c) is not None else "") for c in JURNAL_COLOANE}
        try:
            c = inchidere.get(int(r.get("fixture_id") or -1)) or {}
        except ValueError:
            c = {}
        for k in INCHIDERE:
            d[f"close_p_{k}"] = _num(c.get(k)) if c.get(k) is not None else ""
        d["close_hours_before_ko"] = _num(c.get("ore")) if c.get("ore") is not None else ""
        out.append({k: d.get(k, "") for k in COLOANE})
    return out


def luna_fisier(r: dict, azi: str) -> str:
    """Luna meciului; dacă furnizorul a mutat data meciului după azi (se întâmplă la rezolvare), luna înghețării — ca să nu apară fișiere „din viitor"."""
    md = (r.get("match_date") or "")[:10]
    if md and md <= azi:
        return md[:7]
    return (r.get("freeze_ts") or md or "necunoscut")[:7]


def scrie(R: list[dict], out_dir: Path, azi: str | None = None) -> dict:
    """Un CSV pe luna meciului + index.json. Întoarce indexul."""
    out_dir.mkdir(parents=True, exist_ok=True); luni = defaultdict(list); azi = azi or datetime.now(RO).strftime("%Y-%m-%d")
    for r in R:
        luni[luna_fisier(r, azi)].append(r)
    fis = []
    for luna in sorted(luni):
        nume = f"jurnal_{luna}.csv"
        with open(out_dir / nume, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLOANE); w.writeheader(); w.writerows(sorted(luni[luna], key=lambda r: (r.get("match_date") or "", r.get("fixture_id") or "")))
        fis.append({"fisier": nume, "luna": luna, "n": len(luni[luna])})
    idx = {"generat_la": datetime.now(RO).strftime("%Y-%m-%d %H:%M"), "n_total": len(R), "fisiere": fis, "coloane": COLOANE,
           "nota": "Doar predicții rezolvate, înghețate înainte de meci. prob_* sunt brute; site-ul afișează Platt(prob_*) cu parametrii din platt_calibration.json. Utilizare liberă cu menționarea sursei: poseidonstats.com"}
    (out_dir / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    return idx


def html_dataset(j: dict) -> str:
    L = ['<section id="dataset-section" class="audit">', '  <h3>Date deschise — jurnalul complet, de descărcat</h3>',
         f'  <p>Toate predicțiile rezolvate, exact cum au fost înghețate la 07:15, câte un fișier CSV pe luna meciului: {_mii(j["n_total"])} rânduri, actualizate zilnic (ultima dată {j["generat_la"]}). '
         'Fiecare rând are ora înghețării, probabilitățile brute ale modelului, rezultatul și, unde maparea cu evenimentul casei a fost validată prin nume și scor, cota de închidere a pieței fără marjă. '
         f'Fără cont, fără limită. Cifrele din auditul de mai sus se refac strict din aceste fișiere, cu <a href="{REPO_SCRIPT}" rel="noopener">scriptul de audit din depozitul public al site-ului</a> '
         '(Python 3, fără alte biblioteci): descarci fișierele într-un folder și rulezi <code>python3 gen_audit.py --public folderul_tau</code>.</p>',
         '  <ul class="dataset-files">']
    for f in j["fisiere"]:
        L.append(f'    <li><a href="data/dataset/{f["fisier"]}" download>{f["fisier"]}</a> — {_mii(f["n"])} {"predicție" if f["n"] == 1 else "predicții"}</li>')
    L.append(f'    <li><a href="data/dataset/index.json">index.json</a> — lista fișierelor și schema · <a href="data/dataset/platt_calibration.json">platt_calibration.json</a> — parametrii de calibrare cu care site-ul afișează probabilitățile</li>')
    L.append('  </ul>')
    L.append('  <details><summary>Schema coloanelor</summary><div class="table-wrap"><table class="audit-table"><thead><tr><th>coloană</th><th>ce conține</th></tr></thead><tbody>')
    for c in j["coloane"]:
        L.append(f'    <tr><td><code>{c}</code></td><td>{DESCRIERI.get(c, "")}</td></tr>')
    L.append('  </tbody></table></div></details>')
    L.append('  <p class="muted">Probabilitățile <code>prob_*</code> sunt cele brute, înghețate; pe site le vezi după calibrarea Platt per piață (pantă sub 1), cu parametrii publicați mai sus și refăcuți săptămânal. '
             'Utilizare liberă, cu menționarea sursei: poseidonstats.com. Informativ, nu sfat de pariere, 18+.</p>')
    L.append('</section>')
    return "\n".join(L)


def injecteaza(html: str, bloc: str) -> str:
    b = f"{START}\n  {bloc}\n  {END}"
    if START in html and END in html:
        return re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: b, html, flags=re.S)
    anc = "<!-- AUDIT_STATIC_END -->"; i = html.find(anc)
    if i < 0:
        raise SystemExit("[gen_dataset] nu găsesc blocul de audit în track-record.html (rulează întâi gen_audit.py)")
    i += len(anc)
    return html[:i] + "\n\n  " + b + html[i:]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    rows = list(csv.DictReader(open(GA.JURNAL, newline="", encoding="utf-8"))); inc = GA.incarca_inchidere(); R = randuri_publice(rows, inc)
    cu_close = sum(1 for r in R if r["close_p_over_2_5"] != "")
    print(f"[gen_dataset] {len(R)} predicții rezolvate · {cu_close} cu cotă de închidere · {len({r['match_date'][:7] for r in R})} luni")
    if a.dry_run:
        print(html_dataset({"generat_la": "-", "n_total": len(R), "fisiere": [], "coloane": COLOANE})[:800]); return
    idx = scrie(R, OUT_DIR)
    try:
        (OUT_DIR / "platt_calibration.json").write_text(GA.PLATT.read_text(encoding="utf-8"), encoding="utf-8")
    except OSError:
        print("[gen_dataset] platt_calibration.json lipsește — nu îl public")
    PAGINA.write_text(injecteaza(PAGINA.read_text(encoding="utf-8"), html_dataset(idx)), encoding="utf-8")
    print(f"[gen_dataset] scris {len(idx['fisiere'])} fișiere în {OUT_DIR} + blocul din {PAGINA}")


if __name__ == "__main__":
    main()
