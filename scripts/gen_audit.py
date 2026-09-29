#!/usr/bin/env python3
"""AUDIT public al jurnalului forward POSEIDON (29 sept 2026, decizia Andreei după evaluarea ChatGPT): pentru fiecare piață —
N, rata reală, Brier, BSS față de rata de bază, log loss, ECE și calibrarea pe intervale de 10 pp (toate intervalele cu N ≥ 100),
plus comparația cu PIAȚA acolo unde avem cota (peste 2,5: mkt_p_o25). Sursa: ~/football_predictor/data/poseidon_history.csv
(predicții înghețate la 07:15, status RESOLVED). Scrie data/audit.json și blocul static din track-record.html (markeri AUDIT_STATIC),
citibil de Google și de asistenții AI. Spus pe șleau: calibrat față de rata de bază; nu bate piața.
Uz: gen_audit.py [--dry-run]   (chemat din daily_publish.sh)"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SITE = Path(__file__).resolve().parent.parent
JURNAL = Path.home() / "football_predictor" / "data" / "poseidon_history.csv"
OUT_JSON = SITE / "data" / "audit.json"
PAGINA = SITE / "track-record.html"
START, END = "<!-- AUDIT_STATIC_START -->", "<!-- AUDIT_STATIC_END -->"
RO = ZoneInfo("Europe/Bucharest")
PIETE = [("over_1_5", "prob_over_1_5", "outcome_over_1_5", "Peste 1,5 goluri"), ("over_2_5", "prob_over_2_5", "outcome_over_2_5", "Peste 2,5 goluri"),
         ("over_3_5", "prob_over_3_5", "outcome_over_3_5", "Peste 3,5 goluri"), ("btts", "prob_btts", "outcome_btts", "Ambele echipe marchează"),
         ("ht_over_0_5", "prob_ht_over_0_5", "outcome_ht_over_0_5", "Gol în prima repriză"), ("ht_over_1_5", "prob_ht_over_1_5", "outcome_ht_over_1_5", "Peste 1,5 în prima repriză"),
         ("home", "prob_home", "outcome_1x2", "Gazdele câștigă"), ("draw", "prob_draw", "outcome_1x2", "Egal"), ("away", "prob_away", "outcome_1x2", "Oaspeții câștigă")]
X12 = {"home": ("1",), "draw": ("X",), "away": ("2",)}
MIN_N = 100
PLATT = Path.home() / "football_predictor" / "data" / "platt_calibration.json"
PLATT_KEY = {"over_1_5": "over_1_5", "over_2_5": "over_2_5", "over_3_5": "over_3_5", "btts": "btts", "ht_over_0_5": "ht_over_0_5", "ht_over_1_5": "ht_over_1_5", "home": "1x2_home", "draw": "1x2_draw", "away": "1x2_away"}


def platt_params() -> dict:
    """(a, b) per piață, cum le aplică site-ul (build_public_json); {} dacă lipsesc → cifre brute, marcate ca atare."""
    try:
        return json.loads(PLATT.read_text())["markets"]
    except Exception:
        return {}


def aplica_platt(p: float, mp: dict | None) -> float:
    if not mp:
        return p
    p = min(max(p, 1e-6), 1 - 1e-6); z = mp["a"] * math.log(p / (1 - p)) + mp["b"]
    return 1 / (1 + math.exp(-z))


def wlo(k: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    p = k / n
    return max(0.0, (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n))


def metrici(pairs: list[tuple[float, int]]) -> dict:
    n = len(pairs); rata = sum(y for _, y in pairs) / n
    brier = sum((p - y) ** 2 for p, y in pairs) / n; b0 = rata * (1 - rata)
    ll = -sum(y * math.log(max(p, 1e-6)) + (1 - y) * math.log(max(1 - p, 1e-6)) for p, y in pairs) / n
    b = defaultdict(list)
    for p, y in pairs:
        b[min(int(p * 10), 9)].append((p, y))
    ece = sum(len(v) / n * abs(sum(p for p, _ in v) / len(v) - sum(y for _, y in v) / len(v)) for v in b.values()) * 100
    return {"n": n, "rata": rata, "brier": brier, "bss": (1 - brier / b0) * 100 if b0 > 0 else 0.0, "log_loss": ll, "ece": ece}


def intervale(pairs: list[tuple[float, int]], minim: int = MIN_N) -> list[dict]:
    b = defaultdict(list)
    for p, y in pairs:
        b[min(int(p * 10), 9)].append((p, y))
    out = []
    for k in sorted(b):
        v = b[k]
        if len(v) < minim:
            continue
        spus = sum(p for p, _ in v) / len(v) * 100; iesit = sum(y for _, y in v) / len(v) * 100
        out.append({"interval": f"{k * 10}–{k * 10 + 10} %", "n": len(v), "spus": round(spus, 1), "iesit": round(iesit, 1), "wlo": wlo(sum(y for _, y in v), len(v)) * 100, "dif": round(iesit - spus, 1)})
    return out


def _y(oc: str, val: str, cheie: str) -> int | None:
    if val in (None, ""):
        return None
    if oc == "outcome_1x2":
        return 1 if val in X12[cheie] else 0
    return 1 if val in ("1", "1.0", "True", "true") else 0


def audit(rows: list[dict], platt: dict | None = None) -> dict:
    """platt = parametrii (a, b) per piață aplicați peste probabilitățile BRUTE din jurnal (așa publică site-ul); None = brut."""
    R = [r for r in rows if r.get("status") == "RESOLVED"]; platt = platt or {}
    piete = []
    for cheie, pc, oc, nume in PIETE:
        mp = platt.get(PLATT_KEY[cheie]); pairs = []; brute = []
        for r in R:
            p = r.get(pc); y = _y(oc, r.get(oc), cheie)
            if p in (None, "") or y is None:
                continue
            pairs.append((aplica_platt(float(p), mp), y)); brute.append((float(p), y))
        if len(pairs) < MIN_N:
            continue
        m = metrici(pairs); mb = metrici(brute)
        piete.append({"cheie": cheie, "nume": nume, **m, "bss_brut": mb["bss"], "ece_brut": mb["ece"], "calibrat": bool(mp), "intervale": intervale(pairs)})
    vs = {}
    mp25 = platt.get("over_2_5")
    pm = [(aplica_platt(float(r["prob_over_2_5"]), mp25), float(r["mkt_p_o25"]), _y("outcome_over_2_5", r.get("outcome_over_2_5"), "over_2_5")) for r in R
          if r.get("mkt_p_o25") not in (None, "") and r.get("prob_over_2_5") not in (None, "") and r.get("outcome_over_2_5") not in (None, "")]
    if len(pm) >= MIN_N:
        mm = metrici([(p, y) for p, _, y in pm]); mp = metrici([(q, y) for _, q, y in pm])
        vs["over_2_5"] = {"nume": "Peste 2,5 goluri", "n": len(pm), "bss_model": mm["bss"], "bss_piata": mp["bss"], "brier_model": mm["brier"], "brier_piata": mp["brier"], "ece_model": mm["ece"], "ece_piata": mp["ece"]}
    azi = datetime.now(RO).strftime("%Y-%m-%d")
    zile = sorted({(r.get("match_date") or "")[:10] for r in R if r.get("match_date") and (r.get("match_date") or "")[:10] <= azi})  # API mută uneori data meciului după rezolvare
    return {"generat_la": datetime.now(RO).strftime("%Y-%m-%d %H:%M"), "n_rezolvate": len(R), "de_la": zile[0] if zile else None, "pana_la": zile[-1] if zile else None, "piete": piete, "vs_piata": vs, "calibrare": "platt" if platt else "brut"}


def _f(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def html_audit(a: dict) -> str:
    L = [f'<section id="audit-section" class="audit">',
         '  <h3>Audit statistic — jurnalul forward, cifrele complete</h3>',
         f'  <p>Calculat automat în fiecare dimineață din predicțiile înghețate la 07:15 (jurnal din {a.get("de_la")} până la {a.get("pana_la")}, {a["n_rezolvate"]:,} predicții rezolvate). '
         'Brier și log loss = cât de aproape sunt probabilitățile de realitate (mai mic = mai bine); BSS = câștigul față de „rata de bază" a evenimentului (0 = nimic peste a spune mereu media); '
         'ECE = eroarea medie de calibrare pe intervale de 10 pp. Cifrele sunt pe probabilitățile <strong>publicate</strong> (după calibrarea Platt per piață, refăcută săptămânal pe jurnal — deci ușor in-sample; '
         'cu parametrii fitați înainte de 16 august, testul pe meciurile de după dă la peste 2,5 BSS +4,5 față de +4,1 brut). Coloana „BSS brut" = modelul fără calibrare. '
         'Pe scurt: modelul este calibrat față de rata de bază, dar <strong>nu bate piața</strong> — vezi ultimul tabel.</p>',
         '  <div class="table-wrap"><table class="audit-table"><thead><tr><th>Piață</th><th>N</th><th>Rata reală</th><th>Brier</th><th>BSS</th><th>BSS brut</th><th>log loss</th><th>ECE</th></tr></thead><tbody>']
    for p in a["piete"]:
        L.append(f'    <tr><td>{p["nume"]}</td><td>{p["n"]:,}</td><td>{_f(p["rata"] * 100)} %</td><td>{_f(p["brier"], 4)}</td><td>{"+" if p["bss"] >= 0 else ""}{_f(p["bss"])} %</td><td>{_f(p["log_loss"], 4)}</td><td>{_f(p["ece"])} pp</td></tr>'.replace(",", ".", 1) if False else
                 f'    <tr><td>{p["nume"]}</td><td>{p["n"]}</td><td>{_f(p["rata"] * 100)} %</td><td>{_f(p["brier"], 4)}</td><td>{"+" if p["bss"] >= 0 else ""}{_f(p["bss"])} %</td><td>{"+" if p["bss_brut"] >= 0 else ""}{_f(p["bss_brut"])} %</td><td>{_f(p["log_loss"], 4)}</td><td>{_f(p["ece"])} pp</td></tr>')
    L.append('  </tbody></table></div>')
    L.append('  <h4>Calibrarea pe intervale — când modelul spune X %, în câte cazuri s-a întâmplat (toate intervalele cu cel puțin 100 de predicții)</h4>')
    for p in a["piete"]:
        if not p["intervale"]:
            continue
        L.append(f'  <details><summary>{p["nume"]} — {p["n"]} predicții</summary><div class="table-wrap"><table class="audit-table"><thead><tr><th>interval</th><th>N</th><th>modelul spunea</th><th>s-a întâmplat</th><th>Wilson 95 % jos</th><th>diferență</th></tr></thead><tbody>')
        for b in p["intervale"]:
            L.append(f'    <tr><td>{b["interval"]}</td><td>{b["n"]}</td><td>{_f(b["spus"])} %</td><td>{_f(b["iesit"])} %</td><td>{_f(b["wlo"])} %</td><td>{"+" if b["dif"] >= 0 else ""}{_f(b["dif"])} pp</td></tr>')
        L.append('  </tbody></table></div></details>')
    if a.get("vs_piata"):
        L.append('  <h4>Modelul față de piață — pe meciurile la care avem cota casei la ora predicției</h4>')
        L.append('  <div class="table-wrap"><table class="audit-table"><thead><tr><th>Piață</th><th>N</th><th>BSS model</th><th>BSS piață</th><th>Brier model</th><th>Brier piață</th><th>ECE model</th><th>ECE piață</th></tr></thead><tbody>')
        for k, v in a["vs_piata"].items():
            L.append(f'    <tr><td>{v["nume"]}</td><td>{v["n"]}</td><td>{"+" if v["bss_model"] >= 0 else ""}{_f(v["bss_model"])} %</td><td>{"+" if v["bss_piata"] >= 0 else ""}{_f(v["bss_piata"])} %</td><td>{_f(v["brier_model"], 4)}</td><td>{_f(v["brier_piata"], 4)}</td><td>{_f(v["ece_model"])} pp</td><td>{_f(v["ece_piata"])} pp</td></tr>')
        L.append('  </tbody></table></div>')
        L.append('  <p class="muted">Piața (cota casei fără marjă) are un BSS mai mare decât modelul: modelul nu aduce informație peste cotă. Îl publicăm exact așa. Predicțiile rămân informative, fără garanție.</p>')
    L.append('</section>')
    return "\n".join(L)


def injecteaza(html: str, bloc: str) -> str:
    b = f"{START}\n  {bloc}\n  {END}"
    if START in html and END in html:
        return re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: b, html, flags=re.S)
    i = html.find('id="forward-section"')
    j = html.find("</section>", i)
    if i < 0 or j < 0:
        raise SystemExit("[gen_audit] nu găsesc secțiunea forward în track-record.html")
    j += len("</section>")
    return html[:j] + "\n\n  " + b + html[j:]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    rows = list(csv.DictReader(open(JURNAL, newline="", encoding="utf-8")))
    pl = platt_params(); au = audit(rows, pl); h = html_audit(au)
    print(f"[gen_audit] calibrare: {'Platt (' + str(len(pl)) + ' piețe)' if pl else 'BRUT — platt_calibration.json lipsește'}")
    print(f"[gen_audit] {au['n_rezolvate']} predicții rezolvate · {len(au['piete'])} piețe · vs piață: {list(au['vs_piata'].keys())}")
    if a.dry_run:
        print(h[:1500]); return
    OUT_JSON.write_text(json.dumps(au, ensure_ascii=False, indent=1), encoding="utf-8")
    PAGINA.write_text(injecteaza(PAGINA.read_text(encoding="utf-8"), h), encoding="utf-8")
    print(f"[gen_audit] scris {OUT_JSON} + blocul din {PAGINA}")


if __name__ == "__main__":
    main()
