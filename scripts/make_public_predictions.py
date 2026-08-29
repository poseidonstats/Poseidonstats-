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
calibrate din orice ligă, același bucket. Track-record-ul (history/forward)
NU e atins — rămâne public integral, e dovada care vinde.

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
    return {m["fixture_id"] for m in free}


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
    # nu re-reduce. Exit 0 — starea publicabilă e deja corectă.
    if data.get("freemium"):
        print("[make_public] predictions.json e DEJA freemium — nimic de făcut.")
        return 0

    # 1) FULL privat pentru consumatorii interni — doar dintr-un fișier întreg.
    atomic_write(FULL_JSON, json.dumps(data, ensure_ascii=False, indent=1))

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
    return 0


if __name__ == "__main__":
    sys.exit(main())
