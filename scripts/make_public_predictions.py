#!/usr/bin/env python3
"""FREEMIUM (decizia Andreei 29 aug 2026): reduce predictions.json PUBLIC la
4-5 meciuri gratuite pe zi; restul rămân DOAR ca listă (echipe/ligă/oră) cu
`locked: true`, FĂRĂ probabilități/xG/scoruri — nepublicate tehnic nicăieri.

Fluxul (daily_publish.sh, imediat după build_public_json):
  1. copiază FULL-ul în ~/football_predictor/data/predictions_full.json
     (sursa consumatorilor INTERNI: discord_premium_daily, pro_cron, clipuri)
  2. rescrie poseidon-site/data/predictions.json în format freemium

Selecția FREE (ziua curentă Europe/Bucharest): calibrated + ligă publică
(_leagues_public) + Over 1.5 în bucketul calibrat [0.70, 0.88), sortate
descrescător, max 2 per ligă (diversitate). Fallback dacă nu se umplu 5:
calibrate din orice ligă, același bucket. Track-record-ul rezolvat (history
WIN/LOSS, forward) NU e atins — rămâne public integral, e dovada care vinde.

18 oct 2026 (scurgere găsită la cartografierea pentru aplicația iOS, regula aprobată de
Andreea): history.json publica selecțiile și procentele TUTUROR meciurilor din azi și din
următoarele 6 zile, inclusiv ale celor `locked` (2.740 de meciuri în ziua aia), prin
istoric.html și predictii/arhiva/<zi>.html. Acum, pasul 3: history.json se reduce cu
aceleași free_ids — la meciurile care nu sunt gratuite rămân doar selecțiile rezolvate
(WIN/LOSS); cele PENDING se scot până se joacă meciul. Meciurile rămase fără selecții și
zilele rămase fără meciuri dispar; totalurile se recalculează; `locked_pending` spune câte
selecții sunt ascunse. generated_at și cumulated_markets nu se ating (gate-ul de freshness).
Rulează și când predictions.json e deja freemium (free_ids din `free: true`), idempotent.

Fail-closed: orice excepție => exit != 0 => daily_publish (set -e + trap ERR)
NU publică fișierul întreg din greșeală.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _leagues_public import is_public_league  # noqa: E402

SITE_JSON = Path.home() / "poseidon-site" / "data" / "predictions.json"
HIST_JSON = SITE_JSON.parent / "history.json"
FULL_JSON = Path.home() / "football_predictor" / "data" / "predictions_full.json"
RO = ZoneInfo("Europe/Bucharest")

N_FREE = 5
PROB_LO, PROB_HI = 0.70, 0.88   # bucketul O1.5 calibrat (aceleași praguri ca vitrina)
MAX_PER_LEAGUE = 2

# Câmpurile păstrate la meciurile LOCKED — identitate, zero predicție.
LOCKED_KEYS = ("fixture_id", "match_date", "country", "league",
               "home_team", "away_team", "calibrated")


def pick_free(matches: list[dict]) -> set[int]:
    today = datetime.now(RO).date()

    def is_today(m):
        try:
            md = datetime.fromisoformat(m["match_date"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            return False
        return md.astimezone(RO).date() == today

    def in_bucket(m):
        p = m.get("prob_over_1_5")
        return p is not None and PROB_LO <= p < PROB_HI

    todays = [m for m in matches if is_today(m) and m.get("calibrated") and in_bucket(m)]
    tier1 = [m for m in todays if is_public_league(m.get("country", ""), m.get("league", ""))]
    tier2 = [m for m in todays if m not in tier1]

    free: list[dict] = []
    per_league: dict[str, int] = {}
    for pool in (tier1, tier2):
        for m in sorted(pool, key=lambda x: -x["prob_over_1_5"]):
            if len(free) >= N_FREE:
                break
            lg = f"{m.get('country')}/{m.get('league')}"
            if per_league.get(lg, 0) >= MAX_PER_LEAGUE:
                continue
            free.append(m)
            per_league[lg] = per_league.get(lg, 0) + 1
    # 8 oct 2026: fallback promis în docstring, dar lipsă — cu doar 2 ligi calibrate în bucket, plafonul lăsa 4 gratuite.
    # A treia trecere ignoră plafonul pe ligă; ordinea rămâne probabilitatea, tier1 înaintea tier2.
    if len(free) < N_FREE:
        for pool in (tier1, tier2):
            for m in sorted(pool, key=lambda x: -x["prob_over_1_5"]):
                if len(free) >= N_FREE:
                    break
                if m not in free:
                    free.append(m)
    return {m["fixture_id"] for m in free}


def reduce_history(hist: dict, free_ids: set[int]) -> dict:
    """history.json public: la meciurile care nu sunt gratuite rămân doar selecțiile rezolvate (WIN/LOSS);
    PENDING-ul lor se scoate până se joacă meciul. Meciurile fără selecții rămase și zilele fără meciuri
    dispar; totalurile se recalculează; `locked_pending` = câte selecții sunt ascunse. Idempotent."""
    days_out = []
    for d in hist.get("days", []):
        kept = []
        hidden = int((d.get("totals") or {}).get("locked_pending", 0))   # ce era deja ascuns la o reducere anterioară (idempotență)
        for m in d.get("matches", []):
            picks = m.get("picks", [])
            if m.get("fixture_id") in free_ids:
                kept.append(m)
                continue
            vizibile = [p for p in picks if p.get("outcome") != "PENDING"]
            hidden += len(picks) - len(vizibile)
            if vizibile:
                kept.append({**m, "picks": vizibile})
        if not kept:
            continue
        toate = [p for m in kept for p in m.get("picks", [])]
        totals = {
            "picks": len(toate),
            "wins": sum(1 for p in toate if p.get("outcome") == "WIN"),
            "losses": sum(1 for p in toate if p.get("outcome") == "LOSS"),
            "pending": sum(1 for p in toate if p.get("outcome") == "PENDING"),
            "locked_pending": hidden,
        }
        days_out.append({**d, "matches": kept, "totals": totals})
    return {**hist, "days": days_out}


def atomic_write(path: Path, text: str) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.tmp.")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main() -> int:
    data = json.loads(SITE_JSON.read_text())
    matches = data.get("matches", [])
    if not matches:
        print("[make_public] FULL gol — nimic de redus, abort (fail-closed).")
        return 2

    # Idempotență ÎNTÂI: dacă fișierul site-ului e DEJA redus (re-rulare în
    # aceeași zi fără rebuild), NU suprascrie FULL-ul intern cu redusul și
    # nu re-reduce; free_ids vin din `free: true`, ca history să se reducă la fel.
    if data.get("freemium"):
        print("[make_public] predictions.json e DEJA freemium — nu-l ating.")
        free_ids = {m["fixture_id"] for m in matches if m.get("free")}
    else:
        # 1) FULL privat pentru consumatorii interni — doar dintr-un fișier întreg.
        atomic_write(FULL_JSON, json.dumps(data, ensure_ascii=False, indent=1))

        # 2) predictions.json redus.
        free_ids = pick_free(matches)
        out_matches = []
        for m in matches:
            if m["fixture_id"] in free_ids:
                m2 = dict(m)
                m2["free"] = True
                out_matches.append(m2)
            else:
                locked = {k: m.get(k) for k in LOCKED_KEYS}
                locked["locked"] = True
                out_matches.append(locked)

        data["matches"] = out_matches
        data["freemium"] = {
            "free": len(free_ids),
            "locked": len(out_matches) - len(free_ids),
            "policy": f"{N_FREE} meciuri gratuite pe zi; restul pe abonament (Patreon).",
        }
        atomic_write(SITE_JSON, json.dumps(data, ensure_ascii=False, indent=1))
        print(f"[make_public] OK: {len(free_ids)} free + {len(out_matches)-len(free_ids)} locked "
              f"| FULL intern: {FULL_JSON}")

    # 3) history.json redus cu aceleași free_ids (18 oct 2026). Lipsa fișierului nu e scurgere → doar mesaj.
    if not HIST_JSON.exists():
        print("[make_public] history.json lipsă — nimic de redus.")
        return 0
    hist = json.loads(HIST_JSON.read_text())
    inainte = sum(len(m.get("picks", [])) for d in hist.get("days", []) for m in d.get("matches", []))
    red = reduce_history(hist, free_ids)
    dupa = sum(len(m.get("picks", [])) for d in red["days"] for m in d["matches"])
    atomic_write(HIST_JSON, json.dumps(red, ensure_ascii=False, indent=1))
    print(f"[make_public] history.json: {len(hist.get('days', []))} → {len(red['days'])} zile, "
          f"{inainte} → {dupa} selecții ({inainte - dupa} PENDING blocate ascunse).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
