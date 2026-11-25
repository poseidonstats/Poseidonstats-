"""Livrarea ediției Pro după publicarea exportului validat. Discord are orarul său."""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import provenienta_pro as proof

RO = ZoneInfo("Europe/Bucharest")
SITE = Path(__file__).resolve().parents[1]
PREDICTOR = Path.home() / "football_predictor"


def delivered(path, items):
    receipt = proof.citeste_livrari(path)
    seen = {r["prediction_id"] for r in receipt.get("deliveries", []) if r["channel"] == "site"}
    return all(item["provenance"]["prediction_id"] in seen for item in items)


def prepare(day, *, site=SITE, predictor=PREDICTOR, run=subprocess.run):
    full = json.loads((predictor / "data/predictions_full.json").read_bytes())
    public = json.loads((site / "data/predictions.json").read_bytes())
    stamp = proof.stamp(full.get("generated_at"))
    if (not stamp or stamp.astimezone(RO).date().isoformat() != day
            or day != datetime.now(RO).date().isoformat()
            or full["generated_at"] != public.get("generated_at")):
        raise ValueError("Exportul complet și lista publicată trebuie să fie din aceeași ediție de azi.")

    scripts = predictor / "scripts/poseidon"
    path = predictor / "data/pro_analyses" / f"{day}.json"
    # Generatorul blochează scrierile concurente și păstrează prima arhivă canonică.
    run([sys.executable, scripts / "poseidon_pro_cron.py", "--date", day, "--no-post"], check=True)
    if not path.exists():
        print(f"[pro] {day}: fără meciuri eligibile.")
        return
    edition = json.loads(path.read_bytes())
    items = edition.get("items")
    if edition.get("date") != day or edition.get("reteta") != "fisa" or not items:
        raise ValueError("Arhiva Pro a zilei nu este o ediție de fișe validă.")
    if not delivered(path, items):
        run([sys.executable, scripts / "traduce_analize.py", "--zi", day, "--upload"], check=True)
        if not delivered(path, items):
            raise ValueError("Lipsește confirmarea livrării tuturor fișelor pe site.")
    print(f"[pro] {day}: {len(items)} fișe cu livrarea confirmată.")


if __name__ == "__main__":
    prepare(sys.argv[1])
