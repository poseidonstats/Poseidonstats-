#!/usr/bin/env python3
"""AUDIT public al jurnalului forward POSEIDON (29 sept 2026, decizia Andreei după evaluarea ChatGPT): pentru fiecare piață —
N, rata reală, Brier, BSS față de rata de bază, log loss, ECE și calibrarea pe intervale de 10 pp (toate intervalele cu N ≥ 100),
panta și interceptul de calibrare (regresie logistică pe logit), diagrama de fiabilitate (SVG inline), plus comparația cu PIAȚA:
cota de ÎNCHIDERE (ultimul preț dinaintea startului, fără marjă, la o casă de pariuri licențiată în România — nu o numim pe site),
pe meciurile cu mapare validată nume + scor (odds_decoder/data/sbmap + superbet_master.jsonl), cu testul „aduce modelul informație
peste piață?” (logistică y ~ logit(model) + logit(piață), învățată pe primele două treimi cronologic, testată pe ultima treime).
Fără mapare → cade pe cota de la ora predicției (peste 2,5: mkt_p_o25). Sursa: ~/football_predictor/data/poseidon_history.csv
(predicții înghețate la 07:15, status RESOLVED). Scrie data/audit.json și blocul static din track-record.html (markeri AUDIT_STATIC),
citibil de Google și de asistenții AI. Spus pe șleau: calibrat față de rata de bază; nu bate piața.
Uz: gen_audit.py [--dry-run]                (chemat din daily_publish.sh)
    gen_audit.py --public data/dataset      (oricine: aceleași cifre, doar din fișierele descărcabile)"""
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
MAPARE = Path.home() / "odds_decoder" / "data" / "sbmap" / "sb_matched_odds.csv"     # fixture_id ↔ eveniment la casă (validat prin scor)
MASTER = Path.home() / "odds_decoder" / "data" / "superbet_master.jsonl"             # open/close per eveniment, fără marjă (strat_corectie --construieste)
INCHIDERE_KEY = {"ft_o15": "over_1_5", "ft_o25": "over_2_5", "ft_o35": "over_3_5", "gg": "btts", "ht_o05": "ht_over_0_5", "ht_o15": "ht_over_1_5"}
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


def _solve(A: list[list[float]], b: list[float]) -> list[float]:
    """Gauss cu pivotare parțială pentru sisteme mici (≤ 3 necunoscute)."""
    n = len(b); M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c])); M[c], M[piv] = M[piv], M[c]
        if abs(M[c][c]) < 1e-12:
            M[c][c] = 1e-12
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]; M[r] = [a - f * bb for a, bb in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] for i in range(n)]


def _logit(p: float) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6); return math.log(p / (1 - p))


def _logistic(X: list[list[float]], y: list[int], iters: int = 40) -> list[float]:
    """Regresie logistică prin Newton, fără dependențe: [b0, b1, …] pentru sigmoid(b0 + Σ bj·xj). Ridge 1e-6 doar pentru stabilitate."""
    d = len(X[0]); w = [0.0] * (d + 1); lam = 1e-6
    for _ in range(iters):
        g = [0.0] * (d + 1); H = [[0.0] * (d + 1) for _ in range(d + 1)]
        for xi, yi in zip(X, y):
            z = w[0] + sum(wj * xj for wj, xj in zip(w[1:], xi)); z = max(min(z, 35.0), -35.0); pr = 1 / (1 + math.exp(-z))
            v = (1.0,) + tuple(xi); r = pr - yi; sc = pr * (1 - pr)
            for a in range(d + 1):
                g[a] += r * v[a]; Ha = H[a]
                for bb in range(d + 1):
                    Ha[bb] += sc * v[a] * v[bb]
        for a in range(d + 1):
            g[a] += lam * w[a]; H[a][a] += lam
        step = _solve(H, g); w = [wa - sa for wa, sa in zip(w, step)]
        if max(abs(sa) for sa in step) < 1e-7:
            break
    return w


def panta_intercept(pairs: list[tuple[float, int]]) -> tuple[float, float]:
    """Calibrare Cox: y ~ sigmoid(a·logit(p) + b). a=1, b=0 = perfect calibrat; a<1 = prea încrezător; b>0 = subestimează."""
    w = _logistic([[_logit(p)] for p, _ in pairs], [y for _, y in pairs]); return w[1], w[0]


def _prob(w: list[float], x: list[float]) -> float:
    z = w[0] + sum(wj * xj for wj, xj in zip(w[1:], x)); z = max(min(z, 35.0), -35.0); return 1 / (1 + math.exp(-z))


def _log_loss(P: list[float], Y: list[int]) -> float:
    return -sum(y * math.log(max(p, 1e-6)) + (1 - y) * math.log(max(1 - p, 1e-6)) for p, y in zip(P, Y)) / len(Y)


def test_informatie(tri: list[tuple[float, float, int, str]]) -> dict:
    """tri = (p_model, p_piață, y, data). Învață pe primele două treimi cronologic, testează pe ultima: piața singură vs piața + model."""
    tri = sorted(tri, key=lambda t: t[3]); cut = len(tri) * 2 // 3; tr, te = tri[:cut], tri[cut:]
    ytr = [t[2] for t in tr]; yte = [t[2] for t in te]
    w1 = _logistic([[_logit(t[1])] for t in tr], ytr); w2 = _logistic([[_logit(t[0]), _logit(t[1])] for t in tr], ytr)
    ll1 = _log_loss([_prob(w1, [_logit(t[1])]) for t in te], yte); ll2 = _log_loss([_prob(w2, [_logit(t[0]), _logit(t[1])]) for t in te], yte)
    return {"n_train": len(tr), "n_test": len(te), "de_la_test": te[0][3][:10] if te else None, "ll_piata": ll1, "ll_piata_model": ll2, "castig_ll": ll1 - ll2, "coef_model": w2[1], "coef_piata": w2[2]}


def incarca_inchidere(map_path: Path = MAPARE, master_path: Path = MASTER) -> dict[int, dict]:
    """fixture_id → probabilitățile de închidere ale pieței (fără marjă) pe piețele noastre + „ore” înainte de start. {} dacă lipsește ceva."""
    try:
        with open(map_path, newline="", encoding="utf-8") as f:
            eid_of = {int(r["fixture_id"]): int(r["sb_event_id"]) for r in csv.DictReader(f)}
    except (OSError, ValueError, KeyError):
        return {}
    wanted = set(eid_of.values()); ev = {}
    try:
        with open(master_path, encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                if r.get("eid") in wanted and r.get("close"):
                    ev[r["eid"]] = r
    except (OSError, ValueError):
        return {}
    out = {}
    for fid, eid in eid_of.items():
        r = ev.get(eid)
        if not r:
            continue
        c = r["close"]; d = {}
        if "1x2" in c and all(k in c["1x2"] for k in ("p1", "px", "p2")):
            d["home"], d["draw"], d["away"] = c["1x2"]["p1"], c["1x2"]["px"], c["1x2"]["p2"]
        for k, ours in INCHIDERE_KEY.items():
            if k in c and c[k].get("p") is not None:
                d[ours] = c[k]["p"]
        if d:
            d["ore"] = r.get("ore_close"); out[fid] = d
    return out


def svg_fiabilitate(iv: list[dict], w: int = 240) -> str:
    """Diagrama de fiabilitate, SVG inline (fără JS): x = ce a spus modelul, y = ce s-a întâmplat, mărimea = N. Diagonala = calibrare perfectă."""
    m = 26; s = w - 2 * m; X = lambda v: m + v / 100 * s; Y = lambda v: w - m - v / 100 * s; nmax = max((b["n"] for b in iv), default=1)
    L = [f'<svg class="fiab" viewBox="0 0 {w} {w}" width="{w}" height="{w}" role="img" aria-label="diagramă de fiabilitate: orizontal ce a spus modelul, vertical ce s-a întâmplat">',
         f'<rect x="{m}" y="{m}" width="{s}" height="{s}" fill="none" stroke="#cbd5e1"/>',
         f'<line x1="{X(0):.0f}" y1="{Y(0):.0f}" x2="{X(100):.0f}" y2="{Y(100):.0f}" stroke="#94a3b8" stroke-dasharray="4 3"/>']
    for v in (0, 50, 100):
        L.append(f'<text x="{X(v):.0f}" y="{w - 8}" font-size="9" text-anchor="middle" fill="#64748b">{v}</text><text x="{m - 4}" y="{Y(v) + 3:.0f}" font-size="9" text-anchor="end" fill="#64748b">{v}</text>')
    for b in iv:
        r = 3 + 8 * math.sqrt(b["n"] / nmax)
        L.append(f'<circle cx="{X(b["spus"]):.1f}" cy="{Y(b["iesit"]):.1f}" r="{r:.1f}" fill="#1e3a8a" fill-opacity="0.75"><title>{b["interval"]}: modelul {b["spus"]} %, real {b["iesit"]} %, N={b["n"]}</title></circle>')
    L.append('</svg>'); return "".join(L)


def _inchidere_din_rand(r: dict) -> dict | None:
    """Datasetul PUBLIC poartă cota de închidere în coloanele close_p_<piață> + close_hours_before_ko — același benchmark, fără fișiere private."""
    d = {k: float(r[f"close_p_{k}"]) for k in PLATT_KEY if r.get(f"close_p_{k}") not in (None, "")}
    if not d:
        return None
    d["ore"] = float(r["close_hours_before_ko"]) if r.get("close_hours_before_ko") not in (None, "") else None
    return d


def citeste_public(director: Path) -> tuple[list[dict], dict]:
    """Rândurile din toate jurnal_*.csv (ordinea fișierelor) + parametrii Platt publicați lângă ele. Așa reface oricine cifrele auditului."""
    rows = []
    for f in sorted(Path(director).glob("jurnal_*.csv")):
        rows.extend(csv.DictReader(open(f, newline="", encoding="utf-8")))
    try:
        pl = json.loads((Path(director) / "platt_calibration.json").read_text(encoding="utf-8"))["markets"]
    except (OSError, ValueError, KeyError):
        pl = {}
    return rows, pl


def _y(oc: str, val: str, cheie: str) -> int | None:
    if val in (None, ""):
        return None
    if oc == "outcome_1x2":
        return 1 if val in X12[cheie] else 0
    return 1 if val in ("1", "1.0", "True", "true") else 0


def audit(rows: list[dict], platt: dict | None = None, inchidere: dict[int, dict] | None = None) -> dict:
    """platt = parametrii (a, b) per piață aplicați peste probabilitățile BRUTE din jurnal (așa publică site-ul); None = brut.
    inchidere = fixture_id → probabilități de închidere ale pieței (incarca_inchidere); None/{} → cade pe cota de la ora predicției (mkt_p_o25)."""
    R = [r for r in rows if r.get("status") == "RESOLVED"]; platt = platt or {}; inchidere = inchidere or {}
    piete = []; vs = {}; ore = []
    for cheie, pc, oc, nume in PIETE:
        mp = platt.get(PLATT_KEY[cheie]); pairs = []; brute = []; tri = []
        for r in R:
            p = r.get(pc); y = _y(oc, r.get(oc), cheie)
            if p in (None, "") or y is None:
                continue
            pm = aplica_platt(float(p), mp); pairs.append((pm, y)); brute.append((float(p), y))
            try:
                c = inchidere.get(int(r.get("fixture_id") or -1)) if inchidere else _inchidere_din_rand(r)
            except ValueError:
                c = None
            if c and c.get(cheie) is not None:
                tri.append((pm, float(c[cheie]), y, r.get("match_date") or ""))
                if cheie == "over_2_5" and c.get("ore") is not None:
                    ore.append(float(c["ore"]))
        if len(pairs) < MIN_N:
            continue
        m = metrici(pairs); mb = metrici(brute); a_, b_ = panta_intercept(pairs)
        piete.append({"cheie": cheie, "nume": nume, **m, "bss_brut": mb["bss"], "ece_brut": mb["ece"], "panta": a_, "intercept": b_, "calibrat": bool(mp), "intervale": intervale(pairs)})
        if len(tri) >= MIN_N:
            mm = metrici([(p, y) for p, _, y, _ in tri]); mq = metrici([(q, y) for _, q, y, _ in tri])
            vs[cheie] = {"nume": nume, "n": len(tri), "sursa": "inchidere", "bss_model": mm["bss"], "bss_piata": mq["bss"], "brier_model": mm["brier"], "brier_piata": mq["brier"],
                         "ll_model": mm["log_loss"], "ll_piata": mq["log_loss"], "ece_model": mm["ece"], "ece_piata": mq["ece"], "informatie": test_informatie(tri),
                         "de_la": min(t[3] for t in tri)[:10], "pana_la": max(t[3] for t in tri)[:10]}
    ore_med = sorted(ore)[len(ore) // 2] if ore else None
    mp25 = platt.get("over_2_5")
    pm = [(aplica_platt(float(r["prob_over_2_5"]), mp25), float(r["mkt_p_o25"]), _y("outcome_over_2_5", r.get("outcome_over_2_5"), "over_2_5")) for r in R
          if r.get("mkt_p_o25") not in (None, "") and r.get("prob_over_2_5") not in (None, "") and r.get("outcome_over_2_5") not in (None, "")]
    if not vs and len(pm) >= MIN_N:
        mm = metrici([(p, y) for p, _, y in pm]); mp = metrici([(q, y) for _, q, y in pm])
        vs["over_2_5"] = {"nume": "Peste 2,5 goluri", "n": len(pm), "sursa": "ora_predictiei", "bss_model": mm["bss"], "bss_piata": mp["bss"], "brier_model": mm["brier"], "brier_piata": mp["brier"],
                          "ll_model": mm["log_loss"], "ll_piata": mp["log_loss"], "ece_model": mm["ece"], "ece_piata": mp["ece"]}
    azi = datetime.now(RO).strftime("%Y-%m-%d")
    zile = sorted({(r.get("match_date") or "")[:10] for r in R if r.get("match_date") and (r.get("match_date") or "")[:10] <= azi})  # API mută uneori data meciului după rezolvare
    return {"generat_la": datetime.now(RO).strftime("%Y-%m-%d %H:%M"), "n_rezolvate": len(R), "de_la": zile[0] if zile else None, "pana_la": zile[-1] if zile else None, "piete": piete, "vs_piata": vs, "ore_inchidere_mediana": ore_med, "calibrare": "platt" if platt else "brut"}


def _f(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def _semn(x: float, d: int = 1) -> str:
    return ("+" if x >= 0 else "") + _f(x, d)


def html_audit(a: dict) -> str:
    L = [f'<section id="audit-section" class="audit">',
         '  <h3>Audit statistic — jurnalul forward, cifrele complete</h3>',
         f'  <p>Calculat automat în fiecare dimineață din predicțiile înghețate la 07:15 (jurnal din {a.get("de_la")} până la {a.get("pana_la")}, {a["n_rezolvate"]:,} predicții rezolvate). '
         'Brier și log loss = cât de aproape sunt probabilitățile de realitate (mai mic = mai bine); BSS = câștigul față de „rata de bază" a evenimentului (0 = nimic peste a spune mereu media); '
         'ECE = eroarea medie de calibrare pe intervale de 10 pp; pantă și intercept = calibrarea Cox (regresie logistică a rezultatului pe logit-ul probabilității: pantă 1 și intercept 0 = perfect calibrat, '
         'pantă sub 1 = prea încrezător la extreme, intercept peste 0 = subestimează evenimentul). Cifrele sunt pe probabilitățile <strong>publicate</strong> (după calibrarea Platt per piață, refăcută săptămânal pe jurnal — deci ușor in-sample; '
         'cu parametrii fitați înainte de 16 august, testul pe meciurile de după dă la peste 2,5 BSS +4,5 față de +4,1 brut). Coloana „BSS brut" = modelul fără calibrare. '
         'Pe scurt: modelul este calibrat față de rata de bază, dar <strong>nu bate piața</strong> — vezi ultimul tabel.</p>',
         '  <div class="table-wrap"><table class="audit-table"><thead><tr><th>Piață</th><th>N</th><th>Rata reală</th><th>Brier</th><th>BSS</th><th>BSS brut</th><th>log loss</th><th>ECE</th><th>pantă</th><th>intercept</th></tr></thead><tbody>']
    for p in a["piete"]:
        L.append(f'    <tr><td>{p["nume"]}</td><td>{p["n"]}</td><td>{_f(p["rata"] * 100)} %</td><td>{_f(p["brier"], 4)}</td><td>{_semn(p["bss"])} %</td><td>{_semn(p["bss_brut"])} %</td><td>{_f(p["log_loss"], 4)}</td><td>{_f(p["ece"])} pp</td>'
                 f'<td>{_f(p.get("panta", 1.0), 2)}</td><td>{_semn(p.get("intercept", 0.0), 2)}</td></tr>')
    L.append('  </tbody></table></div>')
    L.append('  <h4>Calibrarea pe intervale — când modelul spune X %, în câte cazuri s-a întâmplat (toate intervalele cu cel puțin 100 de predicții) + diagrama de fiabilitate</h4>')
    for p in a["piete"]:
        if not p["intervale"]:
            continue
        L.append(f'  <details><summary>{p["nume"]} — {p["n"]} predicții</summary><div class="fiab-wrap">{svg_fiabilitate(p["intervale"])}</div><div class="table-wrap"><table class="audit-table"><thead><tr><th>interval</th><th>N</th><th>modelul spunea</th><th>s-a întâmplat</th><th>Wilson 95 % jos</th><th>diferență</th></tr></thead><tbody>')
        for b in p["intervale"]:
            L.append(f'    <tr><td>{b["interval"]}</td><td>{b["n"]}</td><td>{_f(b["spus"])} %</td><td>{_f(b["iesit"])} %</td><td>{_f(b["wlo"])} %</td><td>{_semn(b["dif"])} pp</td></tr>')
        L.append('  </tbody></table></div></details>')
    vs = a.get("vs_piata") or {}
    if vs and all(v.get("sursa") == "inchidere" for v in vs.values()):
        zile = [v["de_la"] for v in vs.values()] + [v["pana_la"] for v in vs.values()]; ore = a.get("ore_inchidere_mediana")
        L.append('  <h4>Modelul față de cota de închidere a pieței — și testul „aduce modelul informație peste piață?"</h4>')
        L.append(f'  <p>Piața = ultimul preț disponibil înainte de start la o casă de pariuri licențiată în România, cu marja scoasă'
                 + (f' (mediana: {_f(ore)} ore înainte de start)' if ore is not None else '') + f', pe meciurile din jurnal la care maparea cu evenimentul casei a fost validată prin nume și scor final ({min(zile)} → {max(zile)}). '
                 'Testul de informație: o regresie logistică a rezultatului pe logit-ul cotei și logit-ul modelului, învățată pe primele două treimi cronologic și testată pe ultima treime. '
                 'Dacă adăugarea modelului nu scade log loss-ul pieței, modelul nu știe nimic în plus față de cotă.</p>')
        L.append('  <div class="table-wrap"><table class="audit-table"><thead><tr><th>Piață</th><th>N</th><th>BSS model</th><th>BSS piață</th><th>log loss model</th><th>log loss piață</th><th>ECE model</th><th>ECE piață</th>'
                 '<th>test: N</th><th>log loss piață</th><th>piață + model</th><th>coeficient model</th></tr></thead><tbody>')
        for v in vs.values():
            t = v["informatie"]
            L.append(f'    <tr><td>{v["nume"]}</td><td>{v["n"]}</td><td>{_semn(v["bss_model"])} %</td><td>{_semn(v["bss_piata"])} %</td><td>{_f(v["ll_model"], 4)}</td><td>{_f(v["ll_piata"], 4)}</td><td>{_f(v["ece_model"])} pp</td><td>{_f(v["ece_piata"])} pp</td>'
                     f'<td>{t["n_test"]}</td><td>{_f(t["ll_piata"], 4)}</td><td>{_f(t["ll_piata_model"], 4)}</td><td>{_semn(t["coef_model"], 2)}</td></tr>')
        L.append('  </tbody></table></div>')
        cmax = max(v["informatie"]["castig_ll"] for v in vs.values())
        verdict = ('modelul <strong>nu aduce informație peste cota de închidere</strong>: adăugat peste cotă, schimbă log loss-ul cu cel mult ' + _f(cmax, 4) + ' pe piața cea mai favorabilă lui, iar piața singură are BSS mai mare pe toate piețele'
                   if cmax < 0.002 and all(v["bss_piata"] >= v["bss_model"] for v in vs.values()) else
                   'pe unele piețe modelul adaugă ceva peste cotă (câștig de log loss până la ' + _f(cmax, 4) + ') — de urmărit în timp, nu e o promisiune')
        L.append(f'  <p class="muted">Verdictul, în cuvinte: {verdict}. Îl publicăm exact așa. Predicțiile rămân informative, fără garanție.</p>')
    elif vs:
        L.append('  <h4>Modelul față de piață — pe meciurile la care avem cota casei la ora predicției</h4>')
        L.append('  <div class="table-wrap"><table class="audit-table"><thead><tr><th>Piață</th><th>N</th><th>BSS model</th><th>BSS piață</th><th>Brier model</th><th>Brier piață</th><th>ECE model</th><th>ECE piață</th></tr></thead><tbody>')
        for k, v in vs.items():
            L.append(f'    <tr><td>{v["nume"]}</td><td>{v["n"]}</td><td>{_semn(v["bss_model"])} %</td><td>{_semn(v["bss_piata"])} %</td><td>{_f(v["brier_model"], 4)}</td><td>{_f(v["brier_piata"], 4)}</td><td>{_f(v["ece_model"])} pp</td><td>{_f(v["ece_piata"])} pp</td></tr>')
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
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--public", metavar="DIR", help="reface auditul STRICT din fișierele publice (jurnal_*.csv + platt_calibration.json din DIR) și scrie JSON-ul la stdout; nu atinge site-ul")
    a = ap.parse_args()
    if a.public:
        rows, pl = citeste_public(Path(a.public)); au = audit(rows, pl, None)
        print(json.dumps(au, ensure_ascii=False, indent=1)); return
    rows = list(csv.DictReader(open(JURNAL, newline="", encoding="utf-8")))
    pl = platt_params(); inc = incarca_inchidere(); au = audit(rows, pl, inc); h = html_audit(au)
    print(f"[gen_audit] cote de închidere mapate: {len(inc)} meciuri (mapare {MAPARE.name}, master {MASTER.name})")
    print(f"[gen_audit] calibrare: {'Platt (' + str(len(pl)) + ' piețe)' if pl else 'BRUT — platt_calibration.json lipsește'}")
    print(f"[gen_audit] {au['n_rezolvate']} predicții rezolvate · {len(au['piete'])} piețe · vs piață: {list(au['vs_piata'].keys())}")
    if a.dry_run:
        print(h[:1500]); return
    OUT_JSON.write_text(json.dumps(au, ensure_ascii=False, indent=1), encoding="utf-8")
    PAGINA.write_text(injecteaza(PAGINA.read_text(encoding="utf-8"), h), encoding="utf-8")
    print(f"[gen_audit] scris {OUT_JSON} + blocul din {PAGINA}")


if __name__ == "__main__":
    main()
